import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const completedProfile = JSON.stringify({
  version: 10,
  wins: 12,
  firstOrbit: { seen: true, completed: true },
  secondOrbit: { seen: true, completed: true },
  routeRank: { rank: "gold", challengeRank: "gold" }
});

const LIGHT_YEAR_METERS = 9_460_730_472_580_800;
const LEGACY_BOUNDARY_METERS = 203_884 * LIGHT_YEAR_METERS;
const WHEEL_PULSE_PIXELS = 100;
const WHEEL_FACTOR = 1.2;
const TARGET_SIZE = 48;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__CONSTELLORE_PLANET_HUB_DIAGNOSTICS__ = true;
  });
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", completedProfile],
      ["constellore-local-profile-v1", completedProfile],
      ["constellore-birthday-voyage-complete-v1", "places-cosmic-journey"]
    ]
  });
  await page.goto("/play/?birthday=off&physicalDiagnostics=1&placesCosmicJourney=1");
  await expect(page.locator("body")).toHaveAttribute("data-home-stage", /core|established/);
});

async function prepareHub(page, testInfo, { mobile = false } = {}) {
  // The desktop project is the configured SwiftShader/WebGL harness. Its
  // fixed 390x844 viewport provides deterministic mobile layout and pointer
  // evidence without silently falling back to the static poster.
  const project = "chromium-desktop";
  test.skip(testInfo.project.name !== project,
    `The integrated Places journey runs once in the ${project} WebGL harness.`);
  await page.setViewportSize(mobile
    ? { width: 390, height: 844 }
    : { width: 1440, height: 900 });

  const orbit = page.locator("[data-home-orbit]");
  const stage = page.locator("[data-planet-hub]");
  const canvas = stage.locator("canvas[data-planet-hub-canvas]");
  const panel = orbit.locator("[data-planet-hub-places]");
  await expect(stage).toHaveAttribute("data-home-hub-renderer", "webgl");

  await page.locator("#homeOrbitTabForge").click();
  await expect(stage).toHaveAttribute("data-home-hub-phase", "ready");
  await expect(canvas).toHaveAttribute("data-planet-hub-camera-owner", "home-orbit");
  await expect(orbit).toHaveAttribute("data-planet-hub-places-layout", "sheet");
  const toggle = orbit.locator("[data-planet-hub-places-toggle]");
  await expect(toggle).toBeVisible();
  await expect(panel).toBeHidden();
  await toggle.click();
  await expect(panel).toBeVisible();
  await expect(panel.locator("[data-planet-hub-places-list] > li").first()).toBeVisible();
  return { orbit, stage, canvas, panel };
}

async function settle(canvas) {
  await expect.poll(
    () => canvas.evaluate((element) => ({
      zooming: element.dataset.planetHubZooming,
      phase: element.closest("[data-planet-hub]")?.dataset.homeHubPhase
    })),
    { timeout: 20_000, intervals: [16, 32, 64, 100] }
  ).toEqual({ zooming: "false", phase: "ready" });

  // The published `zooming` flag reflects positional error; the critically
  // damped spring can still carry a small residual velocity after it flips to
  // false. Require several stable represented-distance samples before taking
  // a navigation snapshot so Back compares settled state with settled state.
  let previousDistance = Number.NaN;
  let stableSamples = 0;
  await expect.poll(async () => {
    const distance = await canvas.evaluate((element) => Number(element.dataset.planetHubDistanceMeters));
    const relativeDelta = Number.isFinite(previousDistance) && previousDistance > 0
      ? Math.abs(distance / previousDistance - 1)
      : Number.POSITIVE_INFINITY;
    stableSamples = relativeDelta <= 1e-7 ? stableSamples + 1 : 0;
    previousDistance = distance;
    return stableSamples;
  }, { timeout: 20_000, intervals: [100, 100, 100, 100, 150] }).toBeGreaterThanOrEqual(3);
}

async function sampleNavigation(canvas) {
  return canvas.evaluate((element) => ({
    segment: element.dataset.planetHubZoomSegment ?? null,
    legacyProgress: Number(element.dataset.planetHubZoom),
    cosmicProgress: Number(element.dataset.planetHubCosmicZoom),
    distanceMeters: Number(element.dataset.planetHubDistanceMeters),
    target: element.dataset.planetHubCameraTargetSubject ?? null,
    owner: element.dataset.planetHubCameraOwner ?? null,
    orbitBody: element.dataset.planetHubOrbitBody ?? null,
    selectedPlace: element.dataset.planetHubSelectedPlace ?? null,
    radius: Number(element.dataset.planetHubCameraRadius),
    rebaseIndex: Number(element.dataset.planetHubRebaseIndex),
    cameraNear: Number(element.dataset.planetHubCameraNear),
    cameraFar: Number(element.dataset.planetHubCameraFar),
    azimuth: Number(element.dataset.planetHubCameraAzimuth),
    polar: Number(element.dataset.planetHubCameraPolar)
  }));
}

function expectPrecisionDiagnostics(sample, context) {
  expect(Number.isInteger(sample.rebaseIndex), `${context}: rebase index is published`).toBe(true);
  expect(sample.rebaseIndex, `${context}: rebase index is nonnegative`).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(sample.cameraNear), `${context}: camera near is finite`).toBe(true);
  expect(Number.isFinite(sample.cameraFar), `${context}: camera far is finite`).toBe(true);
  expect(sample.cameraNear, `${context}: camera near is positive`).toBeGreaterThan(0);
  expect(sample.cameraFar, `${context}: camera far stays beyond the camera`).toBeGreaterThan(sample.radius);
  expect(sample.cameraFar / sample.cameraNear,
    `${context}: the precision-cell frustum retains usable depth`).toBeGreaterThan(1_000);
}

async function dispatchWheelPulses(canvas, count, deltaY = WHEEL_PULSE_PIXELS) {
  await canvas.evaluate((element, { pulses, pixels }) => {
    for (let index = 0; index < pulses; index += 1) {
      element.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
        deltaY: pixels
      }));
    }
  }, { pulses: count, pixels: deltaY });
}

async function waitForOutwardDistanceChange(canvas, previousDistance) {
  await expect.poll(
    () => canvas.evaluate((element) => Number(element.dataset.planetHubDistanceMeters)),
    { timeout: 20_000, intervals: [16, 32, 64, 100] }
  ).toBeGreaterThan(previousDistance * 1.001);
  await settle(canvas);
}

async function wheelUntilDistance(canvas, minimumMeters, maximumPulses = 220) {
  let sample = await sampleNavigation(canvas);
  let pulses = 0;
  while (sample.distanceMeters < minimumMeters && pulses < maximumPulses) {
    const remainingFactor = minimumMeters / Math.max(1, sample.distanceMeters);
    let batch = Math.max(1, Math.min(8, Math.ceil(Math.log(remainingFactor) / Math.log(WHEEL_FACTOR))));
    if (minimumMeters > LEGACY_BOUNDARY_METERS && sample.segment === "legacy") {
      // Land on the legacy boundary first, then start cosmic travel with a
      // separate pulse. This avoids sampling the intentional one-frame
      // pending-segment handoff as if queued cosmic pulses had already landed.
      const boundaryFactor = LEGACY_BOUNDARY_METERS / Math.max(1, sample.distanceMeters);
      const pulsesToBoundary = boundaryFactor > 1.000001
        ? Math.ceil(Math.log(boundaryFactor) / Math.log(WHEEL_FACTOR) - 1e-10)
        : 1;
      batch = Math.max(1, Math.min(batch, pulsesToBoundary));
    }
    const previousDistance = sample.distanceMeters;
    await dispatchWheelPulses(canvas, batch);
    pulses += batch;
    await waitForOutwardDistanceChange(canvas, previousDistance);
    sample = await sampleNavigation(canvas);
  }
  expect(sample.distanceMeters, JSON.stringify({ minimumMeters, pulses, sample }))
    .toBeGreaterThanOrEqual(minimumMeters);
  return sample;
}

async function searchPlace(panel, query, expectedId) {
  if (!await panel.isVisible()) await panel.page().locator("[data-planet-hub-places-toggle]").click();
  await expect(panel).toBeVisible();
  const search = panel.locator("[data-planet-hub-places-search]");
  await search.fill(query);
  const item = panel.locator(`[data-place-id="${expectedId}"]`);
  await expect(item).toBeVisible();
  return item;
}

async function visitSearchResult({ panel, canvas, query, id }) {
  const item = await searchPlace(panel, query, id);
  await item.locator(`[data-planet-hub-place-visit="${id}"]`).click();
  await expect.poll(
    () => canvas.evaluate((element) => element.dataset.planetHubCameraTargetSubject),
    { timeout: 30_000, intervals: [16, 32, 64, 100] }
  ).toBe(id);
  await settle(canvas);
  return sampleNavigation(canvas);
}

function expectSameNavigation(actual, expected) {
  expect(actual.segment).toBe(expected.segment);
  expect(actual.legacyProgress).toBeCloseTo(expected.legacyProgress, 3);
  expect(actual.cosmicProgress).toBeCloseTo(expected.cosmicProgress, 3);
  expect(Math.abs(actual.distanceMeters / expected.distanceMeters - 1))
    .toBeLessThanOrEqual(0.0025);
  expect(actual.target).toBe(expected.target);
  expect(actual.orbitBody).toBe(expected.orbitBody);
  expect(Math.abs(actual.radius / expected.radius - 1)).toBeLessThanOrEqual(0.0025);
  // The idle chart can coast a fraction of a degree while the UI promise
  // resolves; Back's contractual invariants are exact segment, progress,
  // and target. Published distance/radius diagnostics carry the same small
  // spring/frame quantization as the live camera.
  expect(Math.abs(actual.azimuth - expected.azimuth)).toBeLessThanOrEqual(0.003);
  expect(Math.abs(actual.polar - expected.polar)).toBeLessThanOrEqual(0.003);
}

async function backToNavigationSnapshot(orbit, canvas, snapshot) {
  const back = orbit.locator("[data-planet-hub-orbit-return]");
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute("data-planet-hub-return-kind", "place-history");
  await back.click();
  await expect.poll(
    () => canvas.evaluate((element) => element.dataset.planetHubCameraTargetSubject),
    { timeout: 30_000, intervals: [16, 32, 64, 100] }
  ).toBe(snapshot.target);
  await settle(canvas);
  expectSameNavigation(await sampleNavigation(canvas), snapshot);
}

test("Planet-scale Select changes semantic selection without moving the camera", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const { canvas, panel } = await prepareHub(page, testInfo);
  await expect(panel.locator("[data-planet-hub-places-list] > li")).toHaveCount(5);
  await expect(panel.locator("[data-planet-hub-places-context]")).toContainText(/^Featured 5 of /);

  const mars = await searchPlace(panel, "Mars", "mars");
  const beforeSelect = await sampleNavigation(canvas);
  await mars.locator('[data-planet-hub-place-select="mars"]').click();
  await expect(canvas).toHaveAttribute("data-planet-hub-selected-place", "mars");
  await expect(mars.locator('[data-planet-hub-place-select="mars"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#homeOrbitStatus")).toContainText("Mars selected. Choose Visit");
  await page.waitForTimeout(250);
  const afterSelect = await sampleNavigation(canvas);
  expect(afterSelect.segment).toBe(beforeSelect.segment);
  expect(afterSelect.legacyProgress).toBe(beforeSelect.legacyProgress);
  expect(afterSelect.cosmicProgress).toBe(beforeSelect.cosmicProgress);
  expect(afterSelect.distanceMeters).toBe(beforeSelect.distanceMeters);
  expect(afterSelect.target).toBe(beforeSelect.target);
  expect(afterSelect.orbitBody).toBe(beforeSelect.orbitBody);
  expect(afterSelect.radius).toBe(beforeSelect.radius);
});

test("Places keeps five contextual features, separates Select from Visit, and restores a deep-space visit exactly", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const { orbit, canvas, panel } = await prepareHub(page, testInfo);

  const featuredItems = panel.locator("[data-planet-hub-places-list] > li");
  await expect(featuredItems).toHaveCount(5);
  await expect(panel.locator("[data-planet-hub-places-context]")).toContainText(/^Featured 5 of /);
  await expect(panel.locator("[data-planet-hub-places-all]")).toHaveText(/^All \d+$/);

  const mars = await searchPlace(panel, "Mars", "mars");
  const beforeSelect = await sampleNavigation(canvas);
  await mars.locator('[data-planet-hub-place-select="mars"]').click();
  await expect(canvas).toHaveAttribute("data-planet-hub-selected-place", "mars");
  await expect(page.locator("#homeOrbitStatus")).toContainText("Mars selected. Choose Visit");
  await page.waitForTimeout(250);
  const afterSelect = await sampleNavigation(canvas);
  expect(afterSelect.segment).toBe(beforeSelect.segment);
  expect(afterSelect.legacyProgress).toBe(beforeSelect.legacyProgress);
  expect(afterSelect.cosmicProgress).toBe(beforeSelect.cosmicProgress);
  expect(afterSelect.distanceMeters).toBe(beforeSelect.distanceMeters);
  expect(afterSelect.target).toBe(beforeSelect.target);
  expect(afterSelect.orbitBody).toBe(beforeSelect.orbitBody);
  expect(afterSelect.radius).toBe(beforeSelect.radius);

  const beforeMars = await sampleNavigation(canvas);
  await mars.locator('[data-planet-hub-place-visit="mars"]').click();
  await expect.poll(
    () => canvas.evaluate((element) => element.dataset.planetHubCameraTargetSubject),
    { timeout: 30_000, intervals: [16, 32, 64, 100] }
  ).toBe("mars");
  await settle(canvas);
  await backToNavigationSnapshot(orbit, canvas, beforeMars);

  await wheelUntilDistance(canvas, 10.5 * LIGHT_YEAR_METERS);
  const beforeEpsEridani = await sampleNavigation(canvas);
  await visitSearchResult({ panel, canvas, query: "EPS ERI", id: "eps-eridani" });
  await backToNavigationSnapshot(orbit, canvas, beforeEpsEridani);

  await wheelUntilDistance(canvas, 577 * LIGHT_YEAR_METERS);
  const beforeBeehive = await sampleNavigation(canvas);
  await visitSearchResult({ panel, canvas, query: "Beehive", id: "beehive" });
  await backToNavigationSnapshot(orbit, canvas, beforeBeehive);

  await wheelUntilDistance(canvas, 2_500_000 * LIGHT_YEAR_METERS);
  await expect(canvas).toHaveAttribute("data-planet-hub-zoom-segment", "cosmic");
  await expect(canvas).toHaveAttribute("data-planet-hub-cosmic-tier", "local-group");
  const beforeAndromeda = await sampleNavigation(canvas);
  await visitSearchResult({ panel, canvas, query: "Andromeda", id: "andromeda" });
  await backToNavigationSnapshot(orbit, canvas, beforeAndromeda);

  await wheelUntilDistance(canvas, 330_000_001 * LIGHT_YEAR_METERS);
  await expect(canvas).toHaveAttribute("data-planet-hub-cosmic-tier", "supercluster");
  const beforeLaniakea = await sampleNavigation(canvas);
  await visitSearchResult({ panel, canvas, query: "Laniakea", id: "laniakea" });
  const atLaniakea = await sampleNavigation(canvas);
  expect(atLaniakea.target).toBe("laniakea");
  expect(atLaniakea.segment).toBe("cosmic");
  await backToNavigationSnapshot(orbit, canvas, beforeLaniakea);
});

test("three rapid boundary notches preserve the exact 1.20 cubed cosmic distance", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const { canvas } = await prepareHub(page, testInfo);
  await page.locator("[data-planet-hub-places-close]").click();
  await page.locator('[data-planet-hub-zoom-stop="universe"]').click();
  await expect.poll(
    () => canvas.evaluate((element, boundary) => Math.abs(
      Number(element.dataset.planetHubDistanceMeters) / boundary - 1
    ), LEGACY_BOUNDARY_METERS),
    { timeout: 30_000, intervals: [16, 32, 64, 100] }
  ).toBeLessThanOrEqual(0.00001);
  await settle(canvas);
  const before = await sampleNavigation(canvas);
  expect(before.segment).toBe("legacy");
  expect(before.legacyProgress).toBeGreaterThanOrEqual(0.999);

  await dispatchWheelPulses(canvas, 3);
  await expect.poll(
    () => canvas.evaluate((element) => element.dataset.planetHubZoomSegment),
    { timeout: 30_000, intervals: [16, 32, 64, 100] }
  ).toBe("cosmic");
  await expect.poll(
    async () => (await sampleNavigation(canvas)).distanceMeters / before.distanceMeters,
    { timeout: 30_000, intervals: [16, 32, 64, 100] }
  ).toBeCloseTo(WHEEL_FACTOR ** 3, 4);
  await settle(canvas);
  const after = await sampleNavigation(canvas);
  expect(after.segment).toBe("cosmic");
  expect(after.cosmicProgress).toBeGreaterThan(0);
  expect(after.distanceMeters / before.distanceMeters, JSON.stringify({ before, after }))
    .toBeCloseTo(WHEEL_FACTOR ** 3, 4);
});

test("live 16.208 Mly precision epoch and 19.4 Mly seam remain symmetric", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const { canvas } = await prepareHub(page, testInfo);
  const exactRebaseMeters = 203_884 * WHEEL_FACTOR ** 24 * LIGHT_YEAR_METERS;
  await page.locator("[data-planet-hub-places-close]").click();
  await page.locator('[data-planet-hub-zoom-stop="universe"]').click();
  await expect.poll(
    () => canvas.evaluate((element, boundary) => Math.abs(
      Number(element.dataset.planetHubDistanceMeters) / boundary - 1
    ), LEGACY_BOUNDARY_METERS),
    { timeout: 30_000, intervals: [16, 32, 64, 100] }
  ).toBeLessThanOrEqual(0.00001);
  await settle(canvas);
  await dispatchWheelPulses(canvas, 23);
  await expect.poll(
    () => canvas.evaluate((element, target) => Math.abs(
      Number(element.dataset.planetHubDistanceMeters) / target - 1
    ), exactRebaseMeters / WHEEL_FACTOR),
    { timeout: 30_000, intervals: [16, 32, 64, 100] }
  ).toBeLessThanOrEqual(0.0001);
  await settle(canvas);
  const before = await sampleNavigation(canvas);
  expectPrecisionDiagnostics(before, "outward before 16.208 Mly");
  expect(before.rebaseIndex).toBe(2);

  await dispatchWheelPulses(canvas, 1);
  await waitForOutwardDistanceChange(canvas, before.distanceMeters);
  const atRebase = await sampleNavigation(canvas);
  expectPrecisionDiagnostics(atRebase, "outward at 16.208 Mly");
  expect(atRebase.distanceMeters / exactRebaseMeters).toBeCloseTo(1, 4);
  expect(atRebase.rebaseIndex).toBe(3);

  await dispatchWheelPulses(canvas, 1);
  await waitForOutwardDistanceChange(canvas, atRebase.distanceMeters);
  const atReportedSeam = await sampleNavigation(canvas);
  expectPrecisionDiagnostics(atReportedSeam, "outward at 19.4 Mly");
  expect(atReportedSeam.distanceMeters / (exactRebaseMeters * WHEEL_FACTOR)).toBeCloseTo(1, 4);
  expect(atReportedSeam.rebaseIndex).toBe(3);

  const reverse = [];
  for (let index = 0; index < 2; index += 1) {
    const previous = await sampleNavigation(canvas);
    await dispatchWheelPulses(canvas, 1, -WHEEL_PULSE_PIXELS);
    await expect.poll(
      () => canvas.evaluate((element) => Number(element.dataset.planetHubDistanceMeters)),
      { timeout: 20_000, intervals: [16, 32, 64, 100] }
    ).toBeLessThan(previous.distanceMeters / 1.001);
    await settle(canvas);
    const sample = await sampleNavigation(canvas);
    expectPrecisionDiagnostics(sample, `inward seam pulse ${index + 1}`);
    reverse.push(sample);
  }
  expect(reverse[0].distanceMeters / atRebase.distanceMeters).toBeCloseTo(1, 4);
  expect(reverse[0].rebaseIndex).toBe(3);
  expect(reverse[1].distanceMeters / before.distanceMeters).toBeCloseTo(1, 4);
  expect(reverse[1].rebaseIndex).toBe(2);

  await testInfo.attach("cosmic-continuity-live-seams.json", {
    body: Buffer.from(JSON.stringify({ exactRebaseMeters, before, atRebase, atReportedSeam, reverse }, null, 2)),
    contentType: "application/json"
  });
});

test("mobile Places is a 48px-target bottom sheet and owns wheel and touch gestures", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const { orbit, canvas, panel } = await prepareHub(page, testInfo, { mobile: true });
  await expect(orbit).toHaveAttribute("data-planet-hub-places-layout", "sheet");
  await expect(orbit).toHaveAttribute("data-planet-hub-places-open", "true");

  const targets = panel.locator("button:visible, input:visible");
  const count = await targets.count();
  expect(count).toBeGreaterThanOrEqual(4);
  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    const box = await target.evaluate((element) => {
      // A wrapped input's label is part of its clickable target area.
      const hitTarget = element.matches("input") ? element.closest("label") || element : element;
      const bounds = hitTarget.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    });
    expect(box, `mobile Places target ${index} must be laid out`).not.toBeNull();
    // Chromium can report a CSS 48px box as 47.98px after device-scale
    // conversion, so retain a subpixel-only tolerance rather than accepting a
    // genuinely undersized target.
    expect(box.width, `mobile Places target ${index} width`).toBeGreaterThanOrEqual(TARGET_SIZE - 0.5);
    expect(box.height, `mobile Places target ${index} height`).toBeGreaterThanOrEqual(TARGET_SIZE - 0.5);
  }

  const before = await sampleNavigation(canvas);
  await panel.evaluate((element) => {
    element.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      deltaY: 300
    }));
    const dispatchTouchPointer = (type, pointerId, x, y, buttons) => element.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: "touch",
      isPrimary: pointerId === 41,
      clientX: x,
      clientY: y,
      buttons
    }));
    dispatchTouchPointer("pointerdown", 41, 90, 650, 1);
    dispatchTouchPointer("pointerdown", 42, 270, 650, 1);
    dispatchTouchPointer("pointermove", 41, 135, 650, 1);
    dispatchTouchPointer("pointermove", 42, 225, 650, 1);
    dispatchTouchPointer("pointerup", 41, 135, 650, 0);
    dispatchTouchPointer("pointerup", 42, 225, 650, 0);
  });
  await page.waitForTimeout(500);
  const after = await sampleNavigation(canvas);
  expect(after.segment).toBe(before.segment);
  expect(after.legacyProgress).toBe(before.legacyProgress);
  expect(after.cosmicProgress).toBe(before.cosmicProgress);
  expect(after.distanceMeters).toBe(before.distanceMeters);
  expect(after.target).toBe(before.target);
  expect(after.radius).toBe(before.radius);
  await expect(orbit).not.toHaveAttribute("data-planet-hub-dragging", "true");
});
