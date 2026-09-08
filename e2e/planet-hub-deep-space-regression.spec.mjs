import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const completedProfile = JSON.stringify({
  version: 10,
  wins: 12,
  firstOrbit: { seen: true, completed: true },
  secondOrbit: { seen: true, completed: true },
  routeRank: { rank: "gold", challengeRank: "gold" }
});

const WHEEL_PULSE_PIXELS = 100;
const MIN_DISTANCE_FACTOR = 1.18;
const MAX_DISTANCE_FACTOR = 1.22;
const MIN_END_TO_END_PULSES = 158;
const MAX_END_TO_END_PULSES = 182;
const SWEEP_SAFETY_CAP = MAX_END_TO_END_PULSES + 2;
const MIN_END_TO_END_DISTANCE_FACTOR = 1e12;
const EXPECTED_BANDS = Object.freeze(["planet", "orbit", "system", "galaxy", "universe"]);
const ROOT_ORDER = Object.freeze(["planetary", "solar", "stellar", "galactic"]);
const UNIT_ORDER = Object.freeze(["m", "km", "AU", "ly", "kly"]);
const ASTRONOMICAL_UNIT_METERS = 149_597_870_700;
const LIGHT_YEAR_METERS = 9_460_730_472_580_800;
const FIXED_STOPS = Object.freeze([
  { stop: "planet", label: "Planet", band: "planet", root: "planetary", subject: "earth", distanceMeters: 12_742_000, unit: /^(?:m|km)$/ },
  { stop: "orbit", label: "Orbit", band: "orbit", root: "planetary", subject: "earth", distanceMeters: 384_400_000, unit: /^(?:km|AU)$/ },
  { stop: "system", label: "System", band: "system", root: "solar", subject: "sun", distanceMeters: 2 * ASTRONOMICAL_UNIT_METERS, unit: /^AU$/ },
  { stop: "galaxy", label: "Stars", band: "galaxy", root: "stellar", subject: "sun", distanceMeters: 10 * LIGHT_YEAR_METERS, unit: /^ly$/ },
  { stop: "universe", label: "Milky Way", band: "universe", root: "galactic", subject: "sun", distanceMeters: 100_000 * LIGHT_YEAR_METERS, unit: /^kly$/ }
]);
const FIXED_VIEWPORTS = Object.freeze([
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 }
]);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__CONSTELLORE_PLANET_HUB_DIAGNOSTICS__ = true;
  });
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", completedProfile],
      ["constellore-local-profile-v1", completedProfile],
      ["constellore-birthday-voyage-complete-v1", "deep-space-regression"]
    ]
  });
  await page.goto("/play/?birthday=off&deepSpaceRegression=1");
  await expect(page.locator("body")).toHaveAttribute("data-home-stage", /core|established/);
});

async function prepareWebGlHome(page, testInfo) {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "Deep-space WebGL evidence runs once in the Chromium desktop GPU harness; the same harness also captures the fixed mobile viewport."
  );
  const stage = page.locator("[data-planet-hub]");
  const canvas = stage.locator("canvas[data-planet-hub-canvas]");
  await expect(stage).toHaveAttribute("data-home-hub-renderer", /webgl|fallback/);
  const renderer = await stage.getAttribute("data-home-hub-renderer");
  test.fixme(
    renderer !== "webgl",
    "The configured Chromium desktop project did not expose the WebGL planet hub, so physical deep-space frames cannot be audited."
  );
  await page.locator("#homeOrbitTabForge").click();
  await expect(stage).toHaveAttribute("data-home-hub-phase", "ready");
  await expect(canvas).toHaveAttribute("data-planet-hub-camera-owner", "home-orbit");
  return { stage, canvas };
}

function requiredDiagnosticAttributes(sample) {
  return {
    distanceMeters: "data-planet-hub-distance-meters",
    distanceLabel: "data-planet-hub-distance-label",
    distanceUnit: "data-planet-hub-distance-unit",
    cameraRoll: "data-planet-hub-camera-roll",
    cameraTargetSubject: "data-planet-hub-camera-target-subject",
    projectedPivotX: "data-planet-hub-projected-pivot-x",
    projectedPivotY: "data-planet-hub-projected-pivot-y",
    activeRootCount: "data-planet-hub-active-root-count",
    activeRoots: "data-planet-hub-active-roots",
    layerWeights: "data-planet-hub-layer-weights",
    gridCount: "data-planet-hub-grid-count",
    gridOwner: "data-planet-hub-grid-owner",
    gridUnit: "data-planet-hub-grid-unit",
    gridCoversFrustum: "data-planet-hub-grid-covers-frustum",
    gridPlaneDotUp: "data-planet-hub-grid-plane-dot-up"
  };
}

function fixmeMissingDiagnostics(sample, context) {
  const missing = Object.entries(requiredDiagnosticAttributes(sample))
    .filter(([key]) => sample[key] == null || sample[key] === "")
    .map(([, attribute]) => attribute);
  test.fixme(
    missing.length > 0,
    `${context} requires missing renderer diagnostic(s): ${missing.join(", ")}. Publish these only when __CONSTELLORE_PLANET_HUB_DIAGNOSTICS__ is enabled; pixels cannot prove physical distance, exclusive LOD ownership, pivot stability, or world-grid alignment.`
  );
}

function parseJsonDiagnostic(raw, attribute, expectedType) {
  let parsed;
  expect(() => {
    parsed = JSON.parse(raw);
  }, `${attribute} must contain valid JSON`).not.toThrow();
  if (expectedType === "array") expect(Array.isArray(parsed), `${attribute} must contain a JSON array`).toBe(true);
  if (expectedType === "object") {
    expect(parsed && typeof parsed === "object" && !Array.isArray(parsed), `${attribute} must contain a JSON object`).toBe(true);
  }
  return parsed;
}

async function sampleCanvas(canvas) {
  return canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      progress: Number(element.dataset.planetHubZoom),
      radius: Number(element.dataset.planetHubCameraRadius),
      band: element.dataset.planetHubView || null,
      zooming: element.dataset.planetHubZooming === "true",
      distanceMeters: element.dataset.planetHubDistanceMeters ?? null,
      distanceLabel: element.dataset.planetHubDistanceLabel ?? null,
      distanceUnit: element.dataset.planetHubDistanceUnit ?? null,
      cameraRoll: element.dataset.planetHubCameraRoll ?? null,
      cameraTargetSubject: element.dataset.planetHubCameraTargetSubject ?? null,
      projectedPivotX: element.dataset.planetHubProjectedPivotX ?? null,
      projectedPivotY: element.dataset.planetHubProjectedPivotY ?? null,
      activeRootCount: element.dataset.planetHubActiveRootCount ?? null,
      activeRoots: element.dataset.planetHubActiveRoots ?? null,
      layerWeights: element.dataset.planetHubLayerWeights ?? null,
      gridCount: element.dataset.planetHubGridCount ?? null,
      gridOwner: element.dataset.planetHubGridOwner ?? null,
      gridUnit: element.dataset.planetHubGridUnit ?? null,
      gridCoversFrustum: element.dataset.planetHubGridCoversFrustum ?? null,
      gridPlaneDotUp: element.dataset.planetHubGridPlaneDotUp ?? null,
      canvasWidth: bounds.width,
      canvasHeight: bounds.height
    };
  });
}

async function dispatchWheelPulse(canvas, deltaY) {
  await canvas.evaluate((element, pixels) => {
    element.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      deltaY: pixels
    }));
  }, deltaY);
}

async function waitForSettledChange(canvas, before, direction) {
  await expect.poll(async () => {
    const sample = await sampleCanvas(canvas);
    const beforeDistance = Number(before.distanceMeters);
    const afterDistance = Number(sample.distanceMeters);
    if (!(beforeDistance > 0) || !(afterDistance > 0)) return false;
    return direction > 0
      ? afterDistance > beforeDistance * 1.001
      : afterDistance < beforeDistance / 1.001;
  }, { timeout: 12_000, intervals: [16, 32, 64, 100] }).toBe(true);
  await expect.poll(
    async () => (await sampleCanvas(canvas)).zooming,
    { timeout: 12_000, intervals: [16, 32, 64, 100] }
  ).toBe(false);
  return sampleCanvas(canvas);
}

async function waitForSettledStop(canvas, expectedBand) {
  await expect.poll(
    async () => {
      const sample = await sampleCanvas(canvas);
      return sample.zooming ? null : sample.band;
    },
    { timeout: 12_000, intervals: [16, 32, 64, 100] }
  ).toBe(expectedBand);
  return sampleCanvas(canvas);
}

function orderedUnique(values) {
  return values.filter((value, index) => value != null && value !== values[index - 1]);
}

function numericDistance(sample) {
  const distance = Number(sample.distanceMeters);
  expect(Number.isFinite(distance), JSON.stringify(sample)).toBe(true);
  expect(distance, JSON.stringify(sample)).toBeGreaterThan(0);
  return distance;
}

function assertPerPulseDistanceFactor(before, after, direction, allowClippedBoundary = false) {
  const beforeDistance = numericDistance(before);
  const afterDistance = numericDistance(after);
  const factor = direction > 0
    ? afterDistance / beforeDistance
    : beforeDistance / afterDistance;
  if (allowClippedBoundary) {
    expect(factor, JSON.stringify({ before, after, factor })).toBeGreaterThan(1);
    expect(factor, JSON.stringify({ before, after, factor })).toBeLessThanOrEqual(MAX_DISTANCE_FACTOR);
    return;
  }
  expect(factor, JSON.stringify({ before, after, factor })).toBeGreaterThanOrEqual(MIN_DISTANCE_FACTOR);
  expect(factor, JSON.stringify({ before, after, factor })).toBeLessThanOrEqual(MAX_DISTANCE_FACTOR);
}

function assertFrameInvariants(sample) {
  fixmeMissingDiagnostics(sample, `Deep-space sample at progress ${sample.progress}`);
  expect(Math.abs(Number(sample.cameraRoll)), JSON.stringify(sample)).toBeLessThanOrEqual(0.002);
  expect(Number(sample.projectedPivotX), JSON.stringify(sample)).toBeCloseTo(sample.canvasWidth * 0.5, 0);
  expect(Number(sample.projectedPivotY), JSON.stringify(sample)).toBeCloseTo(sample.canvasHeight * 0.5, 0);
  const gridCount = Number(sample.gridCount);
  if (sample.band === "planet") {
    // The close cinematic globe legitimately has no chart grid. If a local
    // accessibility/effects tier elects to retain one, it must still be the
    // sole level grid rather than a second overlapping coordinate frame.
    expect([0, 1], JSON.stringify(sample)).toContain(gridCount);
  } else {
    expect(gridCount, JSON.stringify(sample)).toBe(1);
    expect(sample.gridCoversFrustum, JSON.stringify(sample)).toBe("true");
    expect(Math.abs(Number(sample.gridPlaneDotUp)), JSON.stringify(sample)).toBeGreaterThanOrEqual(0.999);
  }

  const activeRoots = parseJsonDiagnostic(sample.activeRoots, "data-planet-hub-active-roots", "array");
  const weights = parseJsonDiagnostic(sample.layerWeights, "data-planet-hub-layer-weights", "object");
  const weightedRoots = ROOT_ORDER.filter((root) => Number(weights[root]) > 0.001);
  const weightSum = ROOT_ORDER.reduce((sum, root) => sum + (Number(weights[root]) || 0), 0);
  expect(Number(sample.activeRootCount), JSON.stringify(sample)).toBe(activeRoots.length);
  expect(activeRoots, JSON.stringify(sample)).toEqual(weightedRoots);
  expect(activeRoots.length, JSON.stringify(sample)).toBeGreaterThanOrEqual(1);
  expect(activeRoots.length, JSON.stringify(sample)).toBeLessThanOrEqual(2);
  expect(weightSum, JSON.stringify(sample)).toBeCloseTo(1, 2);
  if (activeRoots.length === 2) {
    expect(
      ROOT_ORDER.indexOf(activeRoots[1]) - ROOT_ORDER.indexOf(activeRoots[0]),
      JSON.stringify(sample)
    ).toBe(1);
  }
  if (gridCount > 0) expect(activeRoots, JSON.stringify(sample)).toContain(sample.gridOwner);
}

async function sweep(canvas, direction) {
  const boundary = direction > 0 ? 0.999 : 0.001;
  const samples = [await sampleCanvas(canvas)];
  let pulseCount = 0;
  while ((direction > 0 ? samples.at(-1).progress < boundary : samples.at(-1).progress > boundary)
    && pulseCount < SWEEP_SAFETY_CAP) {
    const before = samples.at(-1);
    await dispatchWheelPulse(canvas, direction * WHEEL_PULSE_PIXELS);
    const after = await waitForSettledChange(canvas, before, direction);
    pulseCount += 1;
    const clipped = direction > 0 ? after.progress >= boundary : after.progress <= boundary;
    assertPerPulseDistanceFactor(before, after, direction, clipped);
    assertFrameInvariants(after);
    samples.push(after);
  }
  return { pulseCount, samples };
}

test("100px wheel pulses traverse physical deep space at one constant multiplier and reverse symmetrically", async ({ page }, testInfo) => {
  test.setTimeout(360_000);
  const { canvas } = await prepareWebGlHome(page, testInfo);
  await page.locator("[data-planet-hub-zoom-reset]").click();
  const start = await waitForSettledStop(canvas, "planet");
  fixmeMissingDiagnostics(start, "The physical-distance sweep");
  assertFrameInvariants(start);

  const forward = await sweep(canvas, 1);
  const farthest = forward.samples.at(-1);
  expect(farthest.progress, JSON.stringify(farthest)).toBeGreaterThanOrEqual(0.999);
  expect(forward.pulseCount).toBeGreaterThanOrEqual(MIN_END_TO_END_PULSES);
  expect(forward.pulseCount).toBeLessThanOrEqual(MAX_END_TO_END_PULSES);
  expect(orderedUnique(forward.samples.map((sample) => sample.band))).toEqual(EXPECTED_BANDS);
  expect(numericDistance(farthest) / numericDistance(start)).toBeGreaterThanOrEqual(MIN_END_TO_END_DISTANCE_FACTOR);

  const forwardUnits = orderedUnique(forward.samples.map((sample) => sample.distanceUnit));
  expect(forwardUnits[0]).toMatch(/^(?:m|km)$/);
  expect(forwardUnits).toContain("AU");
  expect(forwardUnits).toContain("ly");
  expect(forwardUnits.at(-1)).toBe("kly");
  for (let index = 1; index < forwardUnits.length; index += 1) {
    expect(UNIT_ORDER.indexOf(forwardUnits[index])).toBeGreaterThan(UNIT_ORDER.indexOf(forwardUnits[index - 1]));
  }

  const reverse = await sweep(canvas, -1);
  const returned = reverse.samples.at(-1);
  expect(returned.progress, JSON.stringify(returned)).toBeLessThanOrEqual(0.001);
  expect(reverse.pulseCount).toBeGreaterThanOrEqual(MIN_END_TO_END_PULSES);
  expect(reverse.pulseCount).toBeLessThanOrEqual(MAX_END_TO_END_PULSES);
  expect(Math.abs(reverse.pulseCount - forward.pulseCount)).toBeLessThanOrEqual(1);
  expect(orderedUnique(reverse.samples.map((sample) => sample.band))).toEqual([...EXPECTED_BANDS].reverse());
  expect(numericDistance(returned) / numericDistance(start)).toBeCloseTo(1, 2);

  await testInfo.attach("deep-space-forward-reverse-diagnostics.json", {
    body: Buffer.from(JSON.stringify({ forward, reverse }, null, 2)),
    contentType: "application/json"
  });
});

test("fixed Planet-to-Milky-Way transitions retain one pivot, one world-up chart grid, and exclusive LOD roots at desktop and mobile framing", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const { stage, canvas } = await prepareWebGlHome(page, testInfo);

  for (const viewport of FIXED_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const diagnostics = [];
    for (const milestone of FIXED_STOPS) {
      await page.locator(`[data-planet-hub-zoom-stop="${milestone.stop}"]`).click();
      const sample = await waitForSettledStop(canvas, milestone.band);
      fixmeMissingDiagnostics(sample, `${viewport.name} ${milestone.stop} milestone`);
      assertFrameInvariants(sample);
      expect(sample.cameraTargetSubject).toBe(milestone.subject);
      expect(sample.distanceUnit).toMatch(milestone.unit);
      expect(sample.distanceLabel).toContain(sample.distanceUnit);
      expect(Math.abs(numericDistance(sample) / milestone.distanceMeters - 1),
        JSON.stringify({ milestone, sample })).toBeLessThanOrEqual(1e-5);

      const weights = parseJsonDiagnostic(sample.layerWeights, "data-planet-hub-layer-weights", "object");
      const dominantRoot = ROOT_ORDER.reduce((best, root) => (
        Number(weights[root]) > Number(weights[best]) ? root : best
      ), ROOT_ORDER[0]);
      expect(dominantRoot, JSON.stringify({ milestone, sample })).toBe(milestone.root);
      if (Number(sample.gridCount) > 0) {
        expect(sample.gridOwner, JSON.stringify({ milestone, sample })).toBe(milestone.root);
      }
      const stop = page.locator(`[data-planet-hub-zoom-stop="${milestone.stop}"]`);
      await expect(stop).toHaveAttribute("aria-checked", "true");
      await expect(stop).toContainText(milestone.label);

      diagnostics.push({ milestone, sample });
      await testInfo.attach(`${viewport.name}-${milestone.stop}.png`, {
        body: await stage.screenshot({ animations: "disabled" }),
        contentType: "image/png"
      });
    }
    await testInfo.attach(`${viewport.name}-fixed-transition-diagnostics.json`, {
      body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
      contentType: "application/json"
    });
  }
});
