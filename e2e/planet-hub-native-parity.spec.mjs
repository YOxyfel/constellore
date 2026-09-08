import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const completedProfile = JSON.stringify({
  version: 10,
  wins: 12,
  firstOrbit: { seen: true, completed: true },
  secondOrbit: { seen: true, completed: true },
  routeRank: { rank: "gold", challengeRank: "gold" }
});

const REQUIRED_DIAGNOSTICS = Object.freeze([
  "planetHubDistanceMeters",
  "planetHubGridCount",
  "planetHubGridSource",
  "planetHubGridFamilyCount",
  "planetHubGridCarrierCount",
  "planetHubGridDecades",
  "planetHubGridCellSizes",
  "planetHubGridWeights",
  "planetHubGridWeightSum",
  "planetHubGridPlaneOpacity",
  "planetHubGridCameraSide",
  "planetHubGridViewNormalDot",
  "planetHubGridCarrierExtent",
  "planetHubGridEdgeFadeStart",
  "planetHubPlaneMeterCount",
  "planetHubPlaneMeterLabels",
  "planetHubPlaneMeterUnits",
  "planetHubPlaneMeterWeights",
  "planetHubPlaneMeterRadiiMeters",
  "planetHubSunLod",
  "planetHubSunProjectedDiameterPixels",
  "planetHubSunModelOpacity",
  "planetHubSunParticleOpacity",
  "planetHubSunParticleOwner",
  "planetHubSunGlareOpacity"
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
      ["constellore-birthday-voyage-complete-v1", "native-parity-regression"]
    ]
  });
  await page.goto("/play/?birthday=off&physicalDiagnostics=1&nativeParity=1");
  await expect(page.locator("body")).toHaveAttribute("data-home-stage", /core|established/);
});

function parsedArray(value, name) {
  let parsed;
  expect(() => { parsed = JSON.parse(value); }, `${name} must contain JSON`).not.toThrow();
  expect(Array.isArray(parsed), `${name} must contain an array`).toBe(true);
  return parsed;
}

test("frame sweep preserves native grid and physical Sun ownership contracts", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name !== "chromium-desktop",
    "The frame-by-frame native-reference audit runs once in the desktop WebGL harness.");

  const stage = page.locator("[data-planet-hub]");
  const canvas = stage.locator("canvas[data-planet-hub-canvas]");
  await expect(stage).toHaveAttribute("data-home-hub-renderer", "webgl");
  await page.locator("#homeOrbitTabForge").click();
  await expect(stage).toHaveAttribute("data-home-hub-phase", "ready");
  await expect(canvas).toHaveAttribute("data-planet-hub-camera-owner", "home-orbit");

  await expect.poll(async () => canvas.evaluate((element, keys) => keys.filter(
    (key) => element.dataset[key] == null || element.dataset[key] === ""
  ), REQUIRED_DIAGNOSTICS), {
    timeout: 15_000,
    intervals: [16, 32, 64, 100]
  }).toEqual([]);

  await page.locator("[data-planet-hub-zoom-reset]").click();
  await expect.poll(() => canvas.evaluate((element) => ({
    progress: Number(element.dataset.planetHubZoom),
    moving: element.dataset.planetHubZooming === "true"
  })), { timeout: 15_000, intervals: [16, 32, 64, 100] }).toEqual({ progress: 0, moving: false });

  await page.evaluate((keys) => {
    const capture = { active: true, frames: [], requestId: 0 };
    window.__planetHubNativeParityCapture = capture;
    const sample = (timestamp) => {
      if (!capture.active) return;
      const canvas = document.querySelector("canvas[data-planet-hub-canvas]");
      if (canvas && capture.frames.length < 4_000) {
        const data = Object.fromEntries(keys.map((key) => [key, canvas.dataset[key] ?? null]));
        capture.frames.push({
          timestamp,
          progress: Number(canvas.dataset.planetHubZoom),
          moving: canvas.dataset.planetHubZooming === "true",
          ...data
        });
      }
      capture.requestId = requestAnimationFrame(sample);
    };
    capture.requestId = requestAnimationFrame(sample);
  }, REQUIRED_DIAGNOSTICS);

  await page.locator('[data-planet-hub-zoom-stop="universe"]').click();
  await expect.poll(() => canvas.evaluate((element) => ({
    complete: Number(element.dataset.planetHubZoom) >= 0.999,
    moving: element.dataset.planetHubZooming === "true"
  })), { timeout: 30_000, intervals: [16, 32, 64, 100] }).toEqual({ complete: true, moving: false });

  const frames = await page.evaluate(() => {
    const capture = window.__planetHubNativeParityCapture;
    capture.active = false;
    cancelAnimationFrame(capture.requestId);
    return capture.frames;
  });
  expect(frames.length, "the audit needs interpolated frames, not stop-only snapshots").toBeGreaterThan(30);
  expect(frames.some((frame) => frame.moving)).toBe(true);

  const modeSequence = [];
  const decadeWindows = new Set();
  let previousDistance = 0;
  let previousDiameter = Infinity;
  let largestDiameterGrowthRatio = 1;
  let largestDiameterGrowth = Object.freeze({ ratio: 1, index: 0, deltaMs: 0 });
  let largestDistanceGrowth = Object.freeze({ ratio: 1, index: 0, deltaMs: 0 });
  for (const [index, frame] of frames.entries()) {
    const missing = REQUIRED_DIAGNOSTICS.filter((key) => frame[key] == null || frame[key] === "");
    expect(missing, `frame ${index} is missing native-reference diagnostics`).toEqual([]);

    const distance = Number(frame.planetHubDistanceMeters);
    const diameter = Number(frame.planetHubSunProjectedDiameterPixels);
    const modelOpacity = Number(frame.planetHubSunModelOpacity);
    const particleOpacity = Number(frame.planetHubSunParticleOpacity);
    const glareOpacity = Number(frame.planetHubSunGlareOpacity);
    const gridWeights = parsedArray(frame.planetHubGridWeights, "grid weights").map(Number);
    const gridDecades = parsedArray(frame.planetHubGridDecades, "grid decades").map(Number);
    const gridCellSizes = parsedArray(frame.planetHubGridCellSizes, "grid cell sizes").map(Number);
    const meterWeights = parsedArray(frame.planetHubPlaneMeterWeights, "meter weights").map(Number);
    const meterLabels = parsedArray(frame.planetHubPlaneMeterLabels, "meter labels");
    const meterUnits = parsedArray(frame.planetHubPlaneMeterUnits, "meter units");
    const meterRadii = parsedArray(frame.planetHubPlaneMeterRadiiMeters, "meter radii").map(Number);

    expect(Number(frame.planetHubGridFamilyCount)).toBe(1);
    expect(Number(frame.planetHubGridCarrierCount)).toBe(3);
    expect(frame.planetHubGridSource).toBe("native-space");
    expect(Number(frame.planetHubGridCount)).toBeLessThanOrEqual(1);
    expect(gridWeights).toHaveLength(3);
    expect(gridDecades).toHaveLength(3);
    expect(gridCellSizes).toHaveLength(3);
    expect(gridWeights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 6);
    expect(Number(frame.planetHubGridWeightSum)).toBeCloseTo(1, 6);
    expect(gridDecades).toEqual([gridDecades[0], gridDecades[0] + 1, gridDecades[0] + 2]);
    expect(gridCellSizes[1] / gridCellSizes[0]).toBeCloseTo(10, 8);
    expect(gridCellSizes[2] / gridCellSizes[1]).toBeCloseTo(10, 8);
    decadeWindows.add(gridDecades.join(","));
    expect(Number(frame.planetHubGridCarrierExtent)).toBeGreaterThan(0);
    expect(Number(frame.planetHubGridEdgeFadeStart)).toBeGreaterThan(0.5);
    expect(Number(frame.planetHubGridEdgeFadeStart)).toBeLessThan(1);
    const planeOpacity = Number(frame.planetHubGridPlaneOpacity);
    expect(planeOpacity).toBeGreaterThanOrEqual(0);
    expect(planeOpacity).toBeLessThanOrEqual(1);
    if (Number(frame.planetHubGridCameraSide) <= 0) expect(planeOpacity).toBe(0);

    expect(Number(frame.planetHubPlaneMeterCount)).toBe(2);
    expect(meterWeights).toHaveLength(2);
    expect(meterWeights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 6);
    expect(meterLabels).toHaveLength(2);
    expect(meterUnits).toHaveLength(2);
    expect(meterRadii).toHaveLength(2);
    expect(meterRadii[1] / meterRadii[0]).toBeCloseTo(10, 8);

    expect(["model", "model-particle", "particle"]).toContain(frame.planetHubSunLod);
    expect(["local", "atlas", "crossfade", "none"]).toContain(frame.planetHubSunParticleOwner);
    if (frame.planetHubSunLod !== modeSequence.at(-1)) modeSequence.push(frame.planetHubSunLod);
    expect(modelOpacity + particleOpacity).toBeCloseTo(1, 6);
    expect(glareOpacity).toBeGreaterThanOrEqual(0);
    expect(glareOpacity).toBeLessThanOrEqual(1);
    if (Number.isFinite(previousDiameter) && previousDiameter > 0) {
      const diameterRatio = diameter / previousDiameter;
      if (diameterRatio > largestDiameterGrowthRatio) {
        largestDiameterGrowthRatio = diameterRatio;
        largestDiameterGrowth = Object.freeze({
          ratio: diameterRatio,
          index,
          previousTimestamp: frames[index - 1]?.timestamp,
          timestamp: frame.timestamp,
          deltaMs: frame.timestamp - frames[index - 1]?.timestamp,
          previousDiameter,
          diameter,
          previousProgress: frames[index - 1]?.progress,
          progress: frame.progress,
          previousLod: frames[index - 1]?.planetHubSunLod,
          lod: frame.planetHubSunLod,
          previousOwner: frames[index - 1]?.planetHubSunParticleOwner,
          owner: frame.planetHubSunParticleOwner,
          previousModelOpacity: frames[index - 1]?.planetHubSunModelOpacity,
          modelOpacity: frame.planetHubSunModelOpacity,
          previousParticleOpacity: frames[index - 1]?.planetHubSunParticleOpacity,
          particleOpacity: frame.planetHubSunParticleOpacity
        });
      }
    }
    previousDiameter = diameter;

    expect(distance).toBeGreaterThanOrEqual(previousDistance);
    if (previousDistance > 0) {
      const distanceRatio = distance / previousDistance;
      const distanceFrame = Object.freeze({
        index,
        previousTimestamp: frames[index - 1]?.timestamp,
        timestamp: frame.timestamp,
        deltaMs: frame.timestamp - frames[index - 1]?.timestamp,
        previousDistance,
        distance,
        progress: frame.progress,
        previousProgress: frames[index - 1]?.progress
      });
      if (distanceRatio > largestDistanceGrowth.ratio) {
        largestDistanceGrowth = Object.freeze({ ratio: distanceRatio, ...distanceFrame });
      }
      expect(distanceRatio, JSON.stringify(distanceFrame)).toBeLessThanOrEqual(1.25);
    }
    previousDistance = distance;
  }

  console.log(`NATIVE_PARITY_MAX_DISTANCE_FACTOR ${JSON.stringify(largestDistanceGrowth)}`);
  console.log(`NATIVE_PARITY_GRID_WINDOWS ${JSON.stringify([...decadeWindows])}`);
  console.log(`NATIVE_PARITY_MAX_SUN_DIAMETER_GROWTH ${JSON.stringify(largestDiameterGrowth)}`);
  console.log(`NATIVE_PARITY_SUN_LOD_SEQUENCE ${JSON.stringify(modeSequence)}`);
  expect(decadeWindows.size, "the continuous sweep must exercise at least one actual grid LOD rebase")
    .toBeGreaterThan(1);
  expect(
    largestDiameterGrowthRatio,
    "outward travel may contain sub-pixel projection jitter, but no visible Sun-size rebound"
  ).toBeLessThanOrEqual(1.001);
  expect(modeSequence).toEqual(["model", "model-particle", "particle"]);
  const final = frames.at(-1);
  expect(final.planetHubSunLod).toBe("particle");
  expect(Number(final.planetHubGridCount)).toBe(1);
  expect(final.planetHubGridSource).toBe("native-space");
  expect(Number(final.planetHubSunModelOpacity)).toBe(0);
  expect(Number(final.planetHubSunParticleOpacity)).toBe(1);
  expect(final.planetHubSunParticleOwner).toBe("atlas");
  expect(Number(final.planetHubSunProjectedDiameterPixels)).toBeLessThan(0.55);

  await testInfo.attach("native-parity-universe-final", {
    body: await page.screenshot(),
    contentType: "image/png"
  });
});
