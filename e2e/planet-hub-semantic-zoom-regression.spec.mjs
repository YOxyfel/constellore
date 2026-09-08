import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";
import {
  PLANET_HUB_DISTANCE_STOPS,
  PLANET_HUB_STANDARD_WHEEL_MULTIPLIER,
  PLANET_HUB_ZOOM_ANCHOR_PROGRESS
} from "../public/planet-hub-zoom.mjs";

const completedProfile = JSON.stringify({
  version: 10,
  wins: 12,
  firstOrbit: { seen: true, completed: true },
  secondOrbit: { seen: true, completed: true },
  routeRank: { rank: "gold", challengeRank: "gold" }
});

const EXPECTED_BANDS = Object.freeze(["planet", "orbit", "system", "galaxy", "universe"]);
const WHEEL_PULSE_PIXELS = 100;
const NOMINAL_END_TO_END_PULSES = Math.ceil(Math.log(
  PLANET_HUB_DISTANCE_STOPS.universe / PLANET_HUB_DISTANCE_STOPS.planet
) / Math.log(PLANET_HUB_STANDARD_WHEEL_MULTIPLIER));
const MIN_END_TO_END_PULSES = NOMINAL_END_TO_END_PULSES - 2;
const MAX_END_TO_END_PULSES = NOMINAL_END_TO_END_PULSES + 2;
const MAX_RADIAL_FACTOR_PER_FRAME = 1.18;
const PULSE_SAMPLE_DELAY_MS = 250;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__CONSTELLORE_PLANET_HUB_DIAGNOSTICS__ = true;
  });
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", completedProfile],
      ["constellore-local-profile-v1", completedProfile],
      ["constellore-birthday-voyage-complete-v1", "semantic-zoom-regression"]
    ]
  });
  await page.goto("/play/?birthday=off&semanticZoomRegression=1");
  await expect(page.locator("body")).toHaveAttribute("data-home-stage", /core|established/);
});

async function prepareWebGlHome(page, testInfo) {
  test.skip(!testInfo.project.name.includes("desktop"), "Frame-by-frame WebGL semantics run in the desktop harness.");
  await page.setViewportSize({ width: 1280, height: 720 });
  const stage = page.locator("[data-planet-hub]");
  const canvas = stage.locator("canvas[data-planet-hub-canvas]");
  await expect(stage).toHaveAttribute("data-home-hub-renderer", "webgl");
  await page.locator("#homeOrbitTabForge").click();
  await expect(stage).toHaveAttribute("data-home-hub-phase", "ready");
  await expect(canvas).toHaveAttribute("data-planet-hub-camera-owner", "home-orbit");
  const bounds = await stage.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
  return { stage, canvas, bounds };
}

async function waitForProgress(canvas, target, tolerance = 0.003) {
  await expect.poll(
    () => canvas.evaluate((element, expected) => Math.abs(
      Number(element.dataset.planetHubZoom) - expected
    ), target),
    { timeout: 12_000, intervals: [16, 32, 64, 100] }
  ).toBeLessThanOrEqual(tolerance);
}

async function dispatchWheelPulse(canvas, deltaY = WHEEL_PULSE_PIXELS) {
  await canvas.evaluate((element, pixels) => {
    element.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      deltaY: pixels
    }));
  }, deltaY);
}

async function sampleCanvas(canvas) {
  return canvas.evaluate((element) => ({
    progress: Number(element.dataset.planetHubZoom),
    radius: Number(element.dataset.planetHubCameraRadius),
    distance: Number(element.dataset.planetHubDistanceMeters),
    band: element.dataset.planetHubView,
    zooming: element.dataset.planetHubZooming
  }));
}

async function beginFrameCapture(page) {
  await page.evaluate(() => {
    const existing = window.__planetHubSemanticZoomRegression;
    if (existing) existing.active = false;
    const capture = {
      active: true,
      frames: [],
      requestId: 0
    };
    window.__planetHubSemanticZoomRegression = capture;
    const sample = (timestamp) => {
      if (!capture.active) return;
      const canvas = document.querySelector("canvas[data-planet-hub-canvas]");
      if (canvas && capture.frames.length < 8_000) {
        capture.frames.push({
          timestamp,
          progress: Number(canvas.dataset.planetHubZoom),
          radius: Number(canvas.dataset.planetHubCameraRadius),
          distance: Number(canvas.dataset.planetHubDistanceMeters),
          band: canvas.dataset.planetHubView,
          zooming: canvas.dataset.planetHubZooming === "true"
        });
      }
      capture.requestId = requestAnimationFrame(sample);
    };
    capture.requestId = requestAnimationFrame(sample);
  });
}

async function endFrameCapture(page) {
  return page.evaluate(() => {
    const capture = window.__planetHubSemanticZoomRegression;
    if (!capture) return [];
    capture.active = false;
    if (capture.requestId) cancelAnimationFrame(capture.requestId);
    return capture.frames;
  });
}

function orderedUniqueBands(samples) {
  const ordered = [];
  for (const sample of samples) {
    if (!sample?.band || sample.band === ordered.at(-1)) continue;
    ordered.push(sample.band);
  }
  return ordered;
}

test("sustained wheel zoom visits every semantic band without a radial jump", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const { canvas } = await prepareWebGlHome(page, testInfo);
  await page.locator("[data-planet-hub-zoom-reset]").click();
  await waitForProgress(canvas, 0);

  const settledSamples = [await sampleCanvas(canvas)];
  expect(settledSamples[0].progress).toBeLessThanOrEqual(0.001);
  expect(settledSamples[0].band).toBe("planet");
  await beginFrameCapture(page);

  let pulseCount = 0;
  while (settledSamples.at(-1).progress < 0.999 && pulseCount < MAX_END_TO_END_PULSES + 2) {
    await dispatchWheelPulse(canvas);
    pulseCount += 1;
    await page.waitForTimeout(PULSE_SAMPLE_DELAY_MS);
    const after = await sampleCanvas(canvas);
    settledSamples.push(after);
  }

  await waitForProgress(canvas, 1);
  settledSamples.push(await sampleCanvas(canvas));
  const frames = await endFrameCapture(page);
  const final = settledSamples.at(-1);
  expect(final.progress, JSON.stringify({ pulseCount, final })).toBeGreaterThanOrEqual(0.999);
  expect(pulseCount, JSON.stringify({ pulseCount, settledSamples })).toBeGreaterThanOrEqual(MIN_END_TO_END_PULSES);
  expect(pulseCount, JSON.stringify({ pulseCount, settledSamples })).toBeLessThanOrEqual(MAX_END_TO_END_PULSES);

  // `data-planet-hub-zoom` is intentionally rounded to three decimals. Mixing
  // frame and settled samples and sorting by that rounded value can reorder
  // observations on opposite sides of one semantic threshold (for example,
  // Universe -> Galaxy -> Universe at the same published 0.848). The rAF
  // capture is already chronological and spans the complete gesture.
  const visited = orderedUniqueBands(frames);
  expect(visited, JSON.stringify({ visited, pulseCount, frameCount: frames.length })).toEqual(EXPECTED_BANDS);
  expect(frames.some((frame) => frame.zooming), "the capture must include interpolated frames, not only settled stops").toBe(true);
  for (let index = 1; index < frames.length; index += 1) {
    const before = frames[index - 1];
    const after = frames[index];
    // Local camera radius intentionally rebases every few wheel pulses so
    // WebGL coordinates remain precision-safe; every celestial root rebases
    // by the same factor, so that 4x local-radius reset is not a visual jump.
    // Represented physical distance is the projection-invariant radial value.
    const radialFactor = Math.max(
      after.distance / Math.max(1e-9, before.distance),
      before.distance / Math.max(1e-9, after.distance)
    );
    expect(radialFactor, JSON.stringify({ index, before, after })).toBeLessThanOrEqual(MAX_RADIAL_FACTOR_PER_FRAME);
  }
});

test("System anchor publishes the projected Sun center", async ({ page }, testInfo) => {
  const { canvas, bounds } = await prepareWebGlHome(page, testInfo);
  await page.locator('[data-planet-hub-zoom-stop="system"]').click();
  await waitForProgress(canvas, PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system);

  const diagnostic = await canvas.evaluate((element) => ({
    x: element.dataset.planetHubProjectedSunX,
    y: element.dataset.planetHubProjectedSunY,
    target: element.dataset.planetHubCameraTargetSubject
  }));
  const requiredDiagnostics = {
    x: "data-planet-hub-projected-sun-x",
    y: "data-planet-hub-projected-sun-y",
    target: "data-planet-hub-camera-target-subject"
  };
  const missing = Object.entries(diagnostic)
    .filter(([, value]) => value == null)
    .map(([name]) => requiredDiagnostics[name]);
  test.fixme(
    missing.length > 0,
    `Missing renderer diagnostic(s): ${missing.join(", ")}. Publish projected Sun canvas x/y and the semantic camera target; the lifted SUN HTML label cannot prove the rendered sphere is centered.`
  );

  expect(Number(diagnostic.x)).toBeCloseTo(bounds.width * 0.5, 0);
  expect(Number(diagnostic.y)).toBeCloseTo(bounds.height * 0.5, 0);
  expect(diagnostic.target).toBe("sun");
});

test("Stars anchor preserves the Sun while solar detail retires into one marker", async ({ page }, testInfo) => {
  const { canvas, bounds } = await prepareWebGlHome(page, testInfo);
  await page.locator('[data-planet-hub-zoom-stop="galaxy"]').click();
  await waitForProgress(canvas, PLANET_HUB_ZOOM_ANCHOR_PROGRESS.galaxy);

  const diagnostic = await canvas.evaluate((element) => ({
    x: element.dataset.planetHubProjectedGalacticCenterX,
    y: element.dataset.planetHubProjectedGalacticCenterY,
    target: element.dataset.planetHubCameraTargetSubject,
    detailOpacity: element.dataset.planetHubSolarDetailOpacity,
    markerOpacity: element.dataset.planetHubSolarMarkerOpacity,
    visibleSolarDetailCount: element.dataset.planetHubVisibleSolarDetailCount,
    visibleSolarMarkerCount: element.dataset.planetHubVisibleSolarMarkerCount
  }));
  const requiredDiagnostics = {
    x: "data-planet-hub-projected-galactic-center-x",
    y: "data-planet-hub-projected-galactic-center-y",
    target: "data-planet-hub-camera-target-subject",
    detailOpacity: "data-planet-hub-solar-detail-opacity",
    markerOpacity: "data-planet-hub-solar-marker-opacity",
    visibleSolarDetailCount: "data-planet-hub-visible-solar-detail-count",
    visibleSolarMarkerCount: "data-planet-hub-visible-solar-marker-count"
  };
  const missing = Object.entries(diagnostic)
    .filter(([, value]) => value == null)
    .map(([name]) => requiredDiagnostics[name]);
  test.fixme(
    missing.length > 0,
    `Missing renderer diagnostic(s): ${missing.join(", ")}. WebGL pixels and hidden body labels cannot prove persistent Sun ownership or exclude transparent solar-detail/marker overlap.`
  );

  expect(Number(diagnostic.x)).not.toBeNaN();
  expect(Number(diagnostic.y)).not.toBeNaN();
  expect(diagnostic.target).toBe("sun");
  expect(Number(diagnostic.detailOpacity)).toBeLessThanOrEqual(0.001);
  expect(Number(diagnostic.markerOpacity)).toBeGreaterThan(0.001);
  expect(Number(diagnostic.visibleSolarDetailCount)).toBe(0);
  expect(Number(diagnostic.visibleSolarMarkerCount)).toBe(1);
});
