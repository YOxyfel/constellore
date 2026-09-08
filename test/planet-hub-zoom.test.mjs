import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PLANET_HUB_COSMIC_DISTANCE_STOPS,
  PLANET_HUB_COSMIC_EXTENSION_WHEEL_PULSES,
  PLANET_HUB_COSMIC_MILESTONES,
  PLANET_HUB_COSMIC_VIEW_TIERS,
  PLANET_HUB_DISTANCE_METERS,
  PLANET_HUB_DISTANCE_STOPS,
  PLANET_HUB_STANDARD_WHEEL_MULTIPLIER,
  PLANET_HUB_VIEW_BANDS,
  PLANET_HUB_ZOOM_ANCHOR_FACTORS,
  PLANET_HUB_ZOOM_ANCHOR_PROGRESS,
  calculatePlanetHubCelestialExtent,
  calculatePlanetHubCosmicWheelZoom,
  calculatePlanetHubHorizontalFov,
  calculatePlanetHubPinchZoom,
  calculatePlanetHubSemanticCameraTarget,
  calculatePlanetHubWheelZoom,
  calculatePlanetHubZoomBounds,
  classifyPlanetHubViewBand,
  classifyPlanetHubCosmicViewTier,
  clampPlanetHubCosmicZoomProgress,
  clampPlanetHubZoomProgress,
  isPlanetHubZoomBlockedTarget,
  normalizePlanetHubWheelDelta,
  planetHubZoomDistanceToProgress,
  planetHubCosmicZoomDistanceToProgress,
  planetHubCosmicZoomProgressToDistance,
  planetHubZoomProgressToDistance,
  planetHubZoomProgressToRadius,
  planetHubZoomRadiusToProgress,
  resolvePlanetHubRepresentedDistance,
  resolvePlanetHubCosmicRepresentedDistance,
  resolvePlanetHubZoomInteractionRules,
  resolvePlanetHubZoomOwnership,
  stabilizePlanetHubViewBand,
  stepPlanetHubZoomSpring
} from "../public/planet-hub-zoom.mjs";

test("zoom progress clamps to one stable normalized range", () => {
  assert.equal(clampPlanetHubZoomProgress(-1), 0);
  assert.equal(clampPlanetHubZoomProgress(0.42), 0.42);
  assert.equal(clampPlanetHubZoomProgress(3), 1);
  assert.equal(clampPlanetHubZoomProgress(Number.NaN), 0);
});

test("unselected semantic camera target holds Earth before handing off to the Sun", () => {
  const input = {
    worldPosition: [0, 0, 0],
    earthPosition: [0, 0, 0],
    moonPosition: [2, 0, 0],
    sunPosition: [10, 0, 0]
  };
  assert.deepEqual(calculatePlanetHubSemanticCameraTarget({ ...input, progress: 0 }), [0, 0, 0]);
  const boundary = (PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit
    + PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system) * 0.5;
  assert.deepEqual(calculatePlanetHubSemanticCameraTarget({ ...input, progress: boundary }), [0, 0, 0]);
  const midpoint = (boundary + PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system) * 0.5;
  const midpointTarget = calculatePlanetHubSemanticCameraTarget({ ...input, progress: midpoint });
  assert.ok(Math.abs(midpointTarget[0] - 5) < 1e-12);
  assert.deepEqual(midpointTarget.slice(1), [0, 0]);
  assert.deepEqual(calculatePlanetHubSemanticCameraTarget({
    ...input,
    progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system
  }), [10, 0, 0]);
  assert.deepEqual(calculatePlanetHubSemanticCameraTarget({ ...input, progress: 0.68 }), [10, 0, 0]);
});

test("an explicitly selected celestial body remains the zoom pivot at every semantic band", () => {
  const selectedBodyPosition = [7.5, -1.25, 4.75];
  const input = {
    worldPosition: [0, 0, 0],
    earthPosition: [1, 0, 0],
    moonPosition: [3.7, 0.2, -0.4],
    sunPosition: [-2.002874, 0, 11.41766],
    selectedBodyPosition
  };
  for (const progress of [0, 0.16, 0.32, 0.5, 0.7, 1]) {
    assert.deepEqual(calculatePlanetHubSemanticCameraTarget({ ...input, progress }), selectedBodyPosition,
      `selected body remains the exact pivot at zoom progress ${progress}`);
  }
});

test("unselected semantic zoom acquires Earth locally and the immutable atlas Sun at System scale", () => {
  const earthPosition = [1.2, -0.1, 0.4];
  const moonPosition = [3.9, 0.3, -1.8];
  const immutableSunPosition = [-2.002874, 0, 11.41766];
  const input = {
    // A stale world/camera target is deliberately far away. With no explicit
    // celestial selection it must not own the next zoom gesture.
    worldPosition: [90, -40, 25],
    earthPosition,
    moonPosition,
    sunPosition: immutableSunPosition,
    selectedBodyPosition: null
  };
  assert.deepEqual(calculatePlanetHubSemanticCameraTarget({ ...input, progress: 0 }), earthPosition,
    "close unselected navigation reacquires Earth instead of retaining a stale pivot");
  assert.deepEqual(calculatePlanetHubSemanticCameraTarget({
    ...input,
    progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system
  }), immutableSunPosition,
    "System navigation lands on the immutable atlas Sun coordinate");
  assert.deepEqual(calculatePlanetHubSemanticCameraTarget({ ...input, progress: 1 }), immutableSunPosition,
    "Universe navigation cannot drift with a rendered Sun proxy");
});

test("stellar and Milky Way LODs preserve the Sun as the unselected camera pivot", () => {
  const sun = [12, 0, -4];
  const galaxy = [-48, 3, 18];
  const input = {
    earthPosition: [0, 0, 0],
    sunPosition: sun,
    galacticCenterPosition: galaxy
  };
  for (const progress of [PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system, 0.5, 0.7, 0.8, 0.94, 1]) {
    assert.deepEqual(calculatePlanetHubSemanticCameraTarget({ ...input, progress }), sun,
      `LOD progress ${progress} changes scale around the Sun instead of stealing focus for the galactic centre`);
  }
});

test("unselected semantic target motion is continuous and remains inside its fixed celestial hull", () => {
  const earth = [0, 0, 0];
  const moon = [2.7, 0.36, 0.8];
  const sun = [-2.002874, 0, 11.41766];
  const hull = [earth, moon, sun];
  const minimum = [0, 1, 2].map((axis) => Math.min(...hull.map((point) => point[axis])));
  const maximum = [0, 1, 2].map((axis) => Math.max(...hull.map((point) => point[axis])));
  const semanticSpan = Math.hypot(...sun.map((coordinate, axis) => coordinate - earth[axis]));
  const maximumContinuousStep = semanticSpan * 0.1;
  let previous = null;
  for (let frame = 0; frame <= 400; frame += 1) {
    const target = calculatePlanetHubSemanticCameraTarget({
      progress: frame / 400,
      worldPosition: earth,
      earthPosition: earth,
      moonPosition: moon,
      sunPosition: sun,
      selectedBodyPosition: null
    });
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(target[axis] >= minimum[axis] - 1e-12 && target[axis] <= maximum[axis] + 1e-12,
        `frame ${frame} axis ${axis} remains within the immutable celestial hull`);
    }
    if (previous) {
      const step = Math.hypot(...target.map((coordinate, axis) => coordinate - previous[axis]));
      assert.ok(step < maximumContinuousStep,
        `frame ${frame} target step stays below ten percent of the complete semantic span (${step})`);
    }
    previous = target;
  }
});

test("Orbit remains Earth-local and System completes one bounded Sun handoff", () => {
  const bounds = calculatePlanetHubZoomBounds({
    baseRadius: 4.5,
    aspect: 16 / 9
  });
  const earthPosition = [1.2, -0.1, 0.4];
  const sunPosition = [-2.002874, 0, 11.41766];
  const samples = [];

  for (let frame = 0; frame <= 1000; frame += 1) {
    const progress = frame / 1000;
    const radius = planetHubZoomProgressToRadius(progress, bounds);
    const band = classifyPlanetHubViewBand({ radius, bounds });
    if (band !== "orbit" && band !== "system") continue;
    const target = calculatePlanetHubSemanticCameraTarget({
      progress,
      worldPosition: earthPosition,
      earthPosition,
      sunPosition,
      selectedBodyPosition: null
    });
    samples.push({ band, progress, target });
  }

  assert.ok(samples.some(({ band }) => band === "orbit"));
  assert.ok(samples.some(({ band }) => band === "system"));
  for (const sample of samples.filter(({ band }) => band === "orbit")) {
    assert.deepEqual(sample.target, earthPosition,
      `Orbit at ${sample.progress.toFixed(3)} remains exactly Earth-local`);
  }
  for (const sample of samples.filter(({ band }) => band === "system")) {
    const handoff = (PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit
      + PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system) * 0.5;
    const expected = sample.progress <= handoff ? earthPosition
      : sample.progress >= PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system ? sunPosition : null;
    if (expected) assert.deepEqual(sample.target, expected,
      `System endpoint at ${sample.progress.toFixed(3)} has one stable semantic centre`);
    else {
      const span = sunPosition.map((coordinate, axis) => coordinate - earthPosition[axis]);
      const progress = span.reduce((best, coordinate, axis) => Math.abs(coordinate) > Math.abs(span[best]) ? axis : best, 0);
      const amount = (sample.target[progress] - earthPosition[progress]) / span[progress];
      assert.ok(amount > 0 && amount < 1,
        `System handoff at ${sample.progress.toFixed(3)} stays on the single Earth-to-Sun segment`);
    }
  }
});

test("renderer semantic zoom never targets or relocates a moving visual Sun proxy", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const semanticAt = source.indexOf("function semanticCameraTarget(");
  const semanticEnd = source.indexOf("function overviewOrbitWithViewZoom(", semanticAt);
  const lightingAt = source.indexOf("function updateSunLightingRig(");
  const lightingEnd = source.indexOf("function updateSun(", lightingAt);
  assert.ok(semanticAt >= 0 && semanticEnd > semanticAt && lightingAt >= 0 && lightingEnd > lightingAt);
  const semantic = source.slice(semanticAt, semanticEnd);
  const lighting = source.slice(lightingAt, lightingEnd);

  assert.match(semantic,
    /celestialAtlas[?]?[.]layout[?]?[.]positions[?]?[.]sun|atlasSunPosition|immutableSunPosition/u,
    "semantic navigation reads the immutable atlas Sun coordinate");
  assert.doesNotMatch(semantic, /getCelestialBodyWorldPosition\(["']sun["']\)/u,
    "semantic navigation must not sample a presentation-space Sun root");
  assert.doesNotMatch(lighting, /sunRoot[.]position[.]set\(/u,
    "per-frame lighting may animate the Sun surface and optics, never its atlas position");
  assert.doesNotMatch(lighting, /sunRoot[.]scale[.]setScalar\(/u,
    "semantic zoom may scale the optical glare, never morph the physical atlas body");
});

test("celestial extent encloses both the Moon orbit and visible Sun corona", () => {
  const extent = calculatePlanetHubCelestialExtent();
  const moonExtent = 2.7 + 0.273;
  const sunExtent = Math.hypot(-2.35, 1.55, -8.8) + 0.22 * 1.42;
  assert.ok(extent > moonExtent);
  assert.ok(Math.abs(extent - sunExtent) < 1e-12);
});

test("responsive zoom bounds keep the full celestial extent and reach the astronomical chart", () => {
  const extent = calculatePlanetHubCelestialExtent();
  const wide = calculatePlanetHubZoomBounds({ baseRadius: 4.5, aspect: 16 / 9, celestialExtent: extent });
  const portrait = calculatePlanetHubZoomBounds({ baseRadius: 8, aspect: 9 / 16, celestialExtent: extent });

  assert.equal(wide.celestialExtent, extent);
  assert.equal(portrait.celestialExtent, extent);
  assert.equal(wide.fitExtent, 0);
  assert.equal(portrait.fitExtent, 0);
  assert.ok(Math.abs(wide.maxFactor - PLANET_HUB_ZOOM_ANCHOR_FACTORS.universe) < 1e-12);
  assert.ok(Math.abs(portrait.maxFactor - PLANET_HUB_ZOOM_ANCHOR_FACTORS.universe) < 1e-12);
  assert.ok(wide.maxRadius > wide.minRadius);
  assert.ok(portrait.maxRadius > portrait.minRadius);
  assert.ok(portrait.maxRadius > wide.maxRadius, "portrait backs farther away to honor its narrower horizontal FOV");
  assert.ok(calculatePlanetHubHorizontalFov({ aspect: 9 / 16 }) < calculatePlanetHubHorizontalFov({ aspect: 16 / 9 }));
});

test("legacy render-radius mapping stays monotonic and round-trips", () => {
  const bounds = calculatePlanetHubZoomBounds({ baseRadius: 4, aspect: 16 / 9 });
  assert.equal(planetHubZoomProgressToRadius(0, bounds), bounds.minRadius);
  assert.equal(planetHubZoomProgressToRadius(1, bounds), bounds.maxRadius);
  let previous = 0;
  for (const band of PLANET_HUB_VIEW_BANDS) {
    const radius = planetHubZoomProgressToRadius(PLANET_HUB_ZOOM_ANCHOR_PROGRESS[band], bounds);
    assert.ok(radius > previous);
    previous = radius;
  }
  for (const progress of [0, 0.13, 0.5, 0.87, 1]) {
    const radius = planetHubZoomProgressToRadius(progress, bounds);
    assert.ok(Math.abs(planetHubZoomRadiusToProgress(radius, bounds) - progress) < 1e-12);
  }
});

test("an explicit interactive fit extent may expand within, but never beyond, the authored cap", () => {
  const moonExtent = 2.7 + 0.273;
  const fitted = calculatePlanetHubZoomBounds({
    baseRadius: 4.5,
    aspect: 16 / 9,
    fitExtent: moonExtent,
    minimumMaximumFactor: 2
  });
  const oversized = calculatePlanetHubZoomBounds({
    baseRadius: 4.5,
    aspect: 16 / 9,
    fitExtent: 100
  });
  assert.equal(fitted.fitExtent, moonExtent);
  assert.ok(fitted.maxFactor > 2);
  assert.ok(fitted.maxFactor <= PLANET_HUB_ZOOM_ANCHOR_FACTORS.universe);
  assert.equal(oversized.maxFactor, PLANET_HUB_ZOOM_ANCHOR_FACTORS.universe);
});

test("view bands classify the physical log-distance rail instead of device-specific pixels", () => {
  const bounds = calculatePlanetHubZoomBounds({ baseRadius: 4 });
  assert.deepEqual(PLANET_HUB_VIEW_BANDS, ["planet", "orbit", "system", "galaxy", "universe"]);
  for (const band of PLANET_HUB_VIEW_BANDS) {
    const progress = PLANET_HUB_ZOOM_ANCHOR_PROGRESS[band];
    const radius = planetHubZoomProgressToRadius(progress, bounds);
    assert.equal(classifyPlanetHubViewBand({ radius, bounds }), band);
  }
});

test("Galaxy is a real semantic zoom tier between the solar system and the universe", () => {
  const { system, galaxy, universe } = PLANET_HUB_ZOOM_ANCHOR_FACTORS;
  assert.ok(Number.isFinite(galaxy), "Galaxy requires an authored physical-radius anchor");
  assert.ok(galaxy > system, "Galaxy begins beyond the complete solar-system chart");
  assert.ok(universe > galaxy, "Universe remains a distinct farther tier");
  const bounds = Object.freeze({
    minRadius: 1,
    maxRadius: universe,
    maxFactor: universe,
    logRange: Math.log(universe)
  });
  assert.equal(classifyPlanetHubViewBand({ radius: galaxy, bounds }), "galaxy");
});

test("progress-only band classification does not coerce a missing radius into the minimum", () => {
  const bounds = calculatePlanetHubZoomBounds({ baseRadius: 4, aspect: 16 / 9 });
  assert.equal(classifyPlanetHubViewBand({
    progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS.galaxy,
    radius: null,
    bounds
  }), "galaxy");
  assert.equal(classifyPlanetHubViewBand({ progress: 1, radius: undefined, bounds }), "universe");
});

test("wheel deltas normalize pixels, lines, and pages with a bounded impulse", () => {
  assert.equal(normalizePlanetHubWheelDelta({ deltaY: 80, deltaMode: 0 }), 80);
  assert.equal(normalizePlanetHubWheelDelta({ deltaY: 3, deltaMode: 1, lineHeight: 18 }), 54);
  assert.equal(normalizePlanetHubWheelDelta({ deltaY: 1, deltaMode: 2, viewportHeight: 900 }), 320);
  assert.equal(normalizePlanetHubWheelDelta({ deltaY: -99, deltaMode: 2, viewportHeight: 900 }), -320);
});

test("wheel zoom scrolls outward for positive delta and respects both boundaries", () => {
  const outward = calculatePlanetHubWheelZoom({ progress: 0.4, deltaY: 100 });
  const inward = calculatePlanetHubWheelZoom({ progress: 0.4, deltaY: -100 });
  assert.ok(outward.progress > 0.4);
  assert.equal(outward.direction, 1);
  assert.ok(inward.progress < 0.4);
  assert.equal(inward.direction, -1);
  assert.equal(calculatePlanetHubWheelZoom({ progress: 1, deltaY: 100 }).changed, false);
  assert.equal(calculatePlanetHubWheelZoom({ progress: 0, deltaY: -100 }).changed, false);
  assert.ok(Math.abs(calculatePlanetHubWheelZoom({ progress: 0.5, deltaY: 10000 }).step) <= 0.032 + 1e-12);
});

test("ordinary wheel pulses traverse Earth to Milky Way in 160-180 steps and preserve the reference-scale System journey", () => {
  const bounds = calculatePlanetHubZoomBounds({ baseRadius: 4.5, aspect: 16 / 9 });
  let progress = 0;
  let previousBand = "planet";
  const visited = [previousBand];
  let events = 0;
  while (progress < 1 && events < 200) {
    const beforeDistance = planetHubZoomProgressToDistance(progress, bounds);
    const next = calculatePlanetHubWheelZoom({ progress, deltaY: 100 });
    assert.ok(next.step > 0 && next.step <= 0.032 + 1e-12);
    const afterDistance = planetHubZoomProgressToDistance(next.progress, bounds);
    assert.ok(afterDistance / beforeDistance <= PLANET_HUB_STANDARD_WHEEL_MULTIPLIER + 1e-12,
      "a boundary-clipped wheel notch never exceeds the standard physical multiplier");
    progress = next.progress;
    const band = classifyPlanetHubViewBand({ progress, bounds });
    const previousIndex = PLANET_HUB_VIEW_BANDS.indexOf(previousBand);
    const nextIndex = PLANET_HUB_VIEW_BANDS.indexOf(band);
    assert.ok(nextIndex - previousIndex <= 1, `one wheel event skipped ${previousBand} -> ${band}`);
    if (band !== previousBand) visited.push(band);
    previousBand = band;
    events += 1;
  }
  assert.deepEqual(visited, PLANET_HUB_VIEW_BANDS);
  assert.equal(progress, 1, "the authored journey still reaches the Universe boundary");
  assert.ok(events >= 160 && events <= 180,
    `Earth to the complete Milky Way should take 160-180 ordinary wheel pulses, received ${events}`);

  let systemProgress = PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system;
  let systemEvents = 0;
  while (systemProgress < 1 && systemEvents < 140) {
    systemProgress = calculatePlanetHubWheelZoom({ progress: systemProgress, deltaY: 100 }).progress;
    systemEvents += 1;
  }
  assert.equal(systemEvents, 124,
    "the 2 AU System stop retains 124 visibly large scroll pulses before the 203,884-light-year Milky Way cap");

  let inwardProgress = 1;
  let inwardEvents = 0;
  while (inwardProgress > 0 && inwardEvents < 200) {
    inwardProgress = calculatePlanetHubWheelZoom({ progress: inwardProgress, deltaY: -100 }).progress;
    inwardEvents += 1;
  }
  assert.equal(inwardProgress, 0);
  assert.ok(Math.abs(inwardEvents - events) <= 1,
    "inward and outward astronomical travel use the same distance scale within one boundary pulse");
});

test("small trackpad deltas accumulate without changing their logarithmic distance", () => {
  let fine = 0.25;
  for (let index = 0; index < 20; index += 1) {
    fine = calculatePlanetHubWheelZoom({ progress: fine, deltaY: 2 }).progress;
  }
  const combined = calculatePlanetHubWheelZoom({ progress: 0.25, deltaY: 40 }).progress;
  assert.ok(Math.abs(fine - combined) < 1e-12);
  assert.ok(fine > 0.25 && fine < 0.26, "trackpad motion stays precise instead of behaving like a wheel notch");
});

test("every unclipped 100px wheel pulse is exactly 1.20x at every semantic tier", () => {
  for (let sample = 1; sample < 999; sample += 1) {
    const progress = sample / 1000;
    const before = planetHubZoomProgressToDistance(progress);
    const outward = calculatePlanetHubWheelZoom({ progress, deltaY: 100 });
    if (outward.progress === 1) continue;
    const after = planetHubZoomProgressToDistance(outward.progress);
    assert.ok(Math.abs(after / before - PLANET_HUB_STANDARD_WHEEL_MULTIPLIER) < 1e-12,
      `outward sample ${sample} keeps the standard multiplier`);

    const reverse = calculatePlanetHubWheelZoom({ progress: outward.progress, deltaY: -100 });
    assert.ok(Math.abs(reverse.progress - progress) < 1e-12,
      `outward then inward sample ${sample} is symmetric`);
    const reversedDistance = planetHubZoomProgressToDistance(reverse.progress);
    assert.ok(Math.abs(reversedDistance / before - 1) < 1e-12);
  }
});

test("distance stops are real scales on one invertible logarithmic rail", () => {
  assert.equal(PLANET_HUB_DISTANCE_STOPS.system, PLANET_HUB_DISTANCE_METERS.au * 2);
  assert.equal(PLANET_HUB_DISTANCE_STOPS.galaxy, PLANET_HUB_DISTANCE_METERS.lightYear * 10);
  assert.equal(PLANET_HUB_DISTANCE_STOPS.universe, PLANET_HUB_DISTANCE_METERS.lightYear * 203884);
  for (const band of PLANET_HUB_VIEW_BANDS) {
    const progress = PLANET_HUB_ZOOM_ANCHOR_PROGRESS[band];
    assert.ok(Math.abs(planetHubZoomProgressToDistance(progress) / PLANET_HUB_DISTANCE_STOPS[band] - 1) < 1e-12);
    assert.ok(Math.abs(planetHubZoomDistanceToProgress(PLANET_HUB_DISTANCE_STOPS[band]) - progress) < 1e-12);
  }
  for (let sample = 0; sample <= 1000; sample += 1) {
    const progress = sample / 1000;
    assert.ok(Math.abs(planetHubZoomDistanceToProgress(
      planetHubZoomProgressToDistance(progress)
    ) - progress) < 2e-15, `dense distance round-trip ${sample}`);
  }
});

test("rebased render cells stay precision-safe and projection-continuous", () => {
  const cellLimit = PLANET_HUB_STANDARD_WHEEL_MULTIPLIER ** 8;
  const totalPulses = Math.log(
    PLANET_HUB_DISTANCE_STOPS.universe / PLANET_HUB_DISTANCE_STOPS.planet
  ) / Math.log(PLANET_HUB_STANDARD_WHEEL_MULTIPLIER);
  let previous = resolvePlanetHubRepresentedDistance(0);
  for (let sample = 1; sample <= 1000; sample += 1) {
    const state = resolvePlanetHubRepresentedDistance(sample / 1000);
    assert.ok(state.localDollyFactor >= 1 - 1e-9 && state.localDollyFactor < cellLimit + 1e-9);
    assert.ok(Math.abs(state.metersPerUnit * state.localDollyFactor / state.distanceMeters - 1) < 2e-14,
      `render cell ${sample} exactly reconstructs represented distance`);
    assert.ok(state.rebaseIndex >= previous.rebaseIndex);
    previous = state;
  }
  for (let pulse = 8; pulse < totalPulses; pulse += 8) {
    const before = resolvePlanetHubRepresentedDistance((pulse - 1e-6) / totalPulses);
    const after = resolvePlanetHubRepresentedDistance((pulse + 1e-6) / totalPulses);
    assert.equal(after.rebaseIndex, before.rebaseIndex + 1,
      `pulse ${pulse} advances exactly one precision cell`);
    const beforeProjection = 1 / (before.metersPerUnit * before.localDollyFactor);
    const afterProjection = 1 / (after.metersPerUnit * after.localDollyFactor);
    assert.ok(Math.abs(afterProjection / beforeProjection - 1) < 1e-6,
      `pulse ${pulse} reciprocal root scaling cancels the camera rebase without a visual jump`);
  }
});

test("authored Earth projection cancels every rebase in both zoom directions", () => {
  const cameraBaseline = 4.5;
  const samples = Array.from({ length: 4001 }, (_, index) => index / 4000);
  const project = (progress) => {
    const state = resolvePlanetHubRepresentedDistance(progress);
    const authoredScale = PLANET_HUB_DISTANCE_STOPS.planet / state.metersPerUnit;
    const cameraRadius = cameraBaseline * state.localDollyFactor;
    return {
      scale: authoredScale,
      radius: cameraRadius,
      angularRadius: authoredScale / cameraRadius,
      expected: PLANET_HUB_DISTANCE_STOPS.planet
        / (cameraBaseline * state.distanceMeters)
    };
  };

  const initial = project(0);
  assert.equal(initial.scale, 1, "the shipped p=0 Earth framing remains unchanged");
  assert.equal(initial.radius, cameraBaseline);
  for (const sequence of [samples, [...samples].reverse()]) {
    let previous = null;
    for (const progress of sequence) {
      const sample = project(progress);
      assert.ok(Math.abs(sample.angularRadius / sample.expected - 1) < 3e-14,
        `progress ${progress.toFixed(5)} retains exact inverse-distance Earth size`);
      if (previous) {
        const outward = progress > previous.progress;
        assert.ok(outward
          ? sample.angularRadius <= previous.angularRadius * (1 + 1e-12)
          : sample.angularRadius >= previous.angularRadius * (1 - 1e-12),
        `progress ${progress.toFixed(5)} cannot reverse the visible size trend at a rebase`);
      }
      previous = { ...sample, progress };
    }
  }
});

test("pinch spreading zooms inward and pinching together zooms outward", () => {
  const bounds = calculatePlanetHubZoomBounds({ baseRadius: 4.5, aspect: 16 / 9 });
  const spread = calculatePlanetHubPinchZoom({ startProgress: 0.5, startSpan: 100, currentSpan: 180, bounds });
  const close = calculatePlanetHubPinchZoom({ startProgress: 0.5, startSpan: 100, currentSpan: 55, bounds });
  assert.ok(spread.progress < 0.5);
  assert.ok(close.progress > 0.5);
  assert.equal(calculatePlanetHubPinchZoom({ startProgress: 0.5, startSpan: 0, currentSpan: 20, bounds }).changed, false);
});

test("mobile pinch publishes a continuous logarithmic target across the full gesture", () => {
  const bounds = calculatePlanetHubZoomBounds({ baseRadius: 4.5, aspect: 390 / 844 });
  const spans = [100, 92, 84, 76, 68, 60];
  const progress = spans.map((currentSpan) => calculatePlanetHubPinchZoom({
    startProgress: 0.3,
    startSpan: 100,
    currentSpan,
    bounds
  }).progress);
  for (let index = 1; index < progress.length; index += 1) {
    assert.ok(progress[index] > progress[index - 1], "closing fingers moves steadily outward");
    assert.ok(progress[index] - progress[index - 1] < 0.04, "one touch sample remains a fine target correction");
  }
  const radiusRatios = progress.map((value) => planetHubZoomProgressToRadius(value, bounds) / bounds.minRadius);
  assert.ok(radiusRatios.at(-1) > radiusRatios[0]);
});

test("critical zoom spring converges monotonically without crossing its target", () => {
  let state = { progress: 0, velocity: 0 };
  let previous = state.progress;
  for (let frame = 0; frame < 180; frame += 1) {
    state = stepPlanetHubZoomSpring({ ...state, targetProgress: 0.82, deltaSeconds: 1 / 60 });
    assert.ok(state.progress >= previous - 1e-12);
    assert.ok(state.progress <= 0.82 + 1e-12);
    previous = state.progress;
  }
  assert.equal(state.progress, 0.82);
  assert.equal(state.velocity, 0);
  assert.equal(state.settled, true);

  const retargeted = stepPlanetHubZoomSpring({
    progress: 0.7,
    targetProgress: 0.2,
    velocity: 4,
    deltaSeconds: 1 / 60
  });
  assert.ok(retargeted.progress < 0.7, "away-facing inherited velocity is discarded on retarget");
  assert.ok(retargeted.progress >= 0.2);
});

test("delayed RAFs cannot skip more than one safe physical-distance frame", () => {
  const before = resolvePlanetHubRepresentedDistance(0);
  let delayed = { progress: 0, velocity: 0, settled: false };
  let previousDistance = before.distanceMeters;
  let maximumRatio = 1;
  for (let frame = 0; frame < 600 && !delayed.settled; frame += 1) {
    delayed = stepPlanetHubZoomSpring({
      ...delayed,
      targetProgress: 1,
      deltaSeconds: 0.15
    });
    const distance = resolvePlanetHubRepresentedDistance(delayed.progress).distanceMeters;
    maximumRatio = Math.max(maximumRatio, distance / previousDistance);
    previousDistance = distance;
  }
  assert.equal(delayed.settled, true);
  assert.ok(maximumRatio <= 1.25,
    `150ms main-thread stalls stay below the native-parity 1.25x frame bound (${maximumRatio}x)`);

  const wheelTarget = calculatePlanetHubWheelZoom({ progress: 0, deltaY: 100 }).progress;
  let wheel = { progress: 0, velocity: 0, settled: false };
  for (let frame = 0; frame < 120 && !wheel.settled; frame += 1) {
    wheel = stepPlanetHubZoomSpring({
      ...wheel,
      targetProgress: wheelTarget,
      deltaSeconds: frame === 0 ? 0.15 : 1 / 60
    });
  }
  assert.equal(wheel.settled, true);
  const settledDistance = resolvePlanetHubRepresentedDistance(wheel.progress).distanceMeters;
  assert.ok(Math.abs(settledDistance / before.distanceMeters - 1.2) < 1e-12,
    "the guard changes presentation cadence, never the exact 1.20x wheel target");
});

test("long named-stop travel is speed-limited while short corrections remain responsive", () => {
  let state = { progress: 0, velocity: 0 };
  const crossed = [];
  let frames = 0;
  let previousBand = "planet";
  while (!state.settled && frames < 600) {
    state = stepPlanetHubZoomSpring({ ...state, targetProgress: 1, deltaSeconds: 1 / 60 });
    const band = classifyPlanetHubViewBand({ progress: state.progress });
    if (band !== previousBand) crossed.push(band);
    previousBand = band;
    frames += 1;
  }
  assert.equal(state.settled, true);
  assert.deepEqual(crossed, ["orbit", "system", "galaxy", "universe"]);
  assert.ok(frames >= 120, `Planet to Universe must remain observable, settled in ${frames} frames`);

  let short = { progress: 0.4, velocity: 0 };
  let shortFrames = 0;
  while (!short.settled && shortFrames < 180) {
    short = stepPlanetHubZoomSpring({ ...short, targetProgress: 0.43, deltaSeconds: 1 / 60 });
    shortFrames += 1;
  }
  assert.equal(short.settled, true);
  assert.ok(shortFrames < frames / 3, "small wheel corrections must not inherit full-range travel time");
});

test("semantic band hysteresis rejects boundary chatter without hiding deliberate travel", () => {
  const bounds = calculatePlanetHubZoomBounds({ baseRadius: 4.5, aspect: 16 / 9 });
  let boundary = 0;
  for (let value = 0; value <= 1; value += 0.0005) {
    if (classifyPlanetHubViewBand({ progress: value, bounds }) === "orbit") {
      boundary = value;
      break;
    }
  }
  assert.ok(boundary > 0);
  assert.equal(stabilizePlanetHubViewBand({
    progress: boundary + 0.004,
    bounds,
    previousBand: "planet"
  }), "planet");
  assert.equal(stabilizePlanetHubViewBand({
    progress: boundary + 0.02,
    bounds,
    previousBand: "planet"
  }), "orbit");
  assert.equal(stabilizePlanetHubViewBand({
    progress: boundary - 0.004,
    bounds,
    previousBand: "orbit"
  }), "orbit");
  assert.equal(stabilizePlanetHubViewBand({
    progress: boundary - 0.02,
    bounds,
    previousBand: "orbit"
  }), "planet");
});

test("reduced motion resolves zoom immediately without retained velocity", () => {
  assert.deepEqual(stepPlanetHubZoomSpring({
    progress: 0.1,
    targetProgress: 0.9,
    velocity: 3,
    deltaSeconds: 1 / 60,
    reducedMotion: true
  }), {
    progress: 0.9,
    velocity: 0,
    moving: false,
    settled: true
  });
});

test("wheel target filter leaves controls and independently scrollable content alone", () => {
  const stage = { tagName: "DIV" };
  const canvas = { tagName: "CANVAS", parentElement: stage };
  const button = {
    tagName: "BUTTON",
    parentElement: stage,
    closest: () => button,
    scrollWidth: 10,
    clientWidth: 10,
    scrollHeight: 10,
    clientHeight: 10
  };
  const scroller = {
    tagName: "DIV",
    parentElement: stage,
    closest: () => null,
    scrollWidth: 200,
    clientWidth: 100,
    scrollHeight: 100,
    clientHeight: 100
  };
  const backdrop = {
    tagName: "DIV",
    parentElement: stage,
    closest: () => null,
    scrollWidth: 100,
    clientWidth: 100,
    scrollHeight: 100,
    clientHeight: 100
  };
  assert.equal(isPlanetHubZoomBlockedTarget(canvas, stage), false);
  assert.equal(isPlanetHubZoomBlockedTarget(button, stage), true);
  assert.equal(isPlanetHubZoomBlockedTarget(scroller, stage), true);
  assert.equal(isPlanetHubZoomBlockedTarget(backdrop, stage), false);
});

test("zoom ownership keeps flights and UI protected while a centered Moon remains navigable", () => {
  assert.equal(resolvePlanetHubZoomOwnership({ direction: 1 }).action, "zoom");
  assert.equal(resolvePlanetHubZoomOwnership({ phase: "transitioning", direction: 1 }).action, "retarget");
  assert.deepEqual(resolvePlanetHubZoomOwnership({ mode: "focused", direction: 1 }), {
    accepted: true,
    consume: true,
    action: "exit-focus",
    reason: "focus-exit"
  });
  assert.equal(resolvePlanetHubZoomOwnership({ mode: "focused", direction: -1 }).accepted, false);
  assert.equal(resolvePlanetHubZoomOwnership({ mode: "world-inspection", direction: 1 }).reason, "presentation-owned");
  assert.equal(resolvePlanetHubZoomOwnership({ cameraOwner: "moon-focus", direction: 1 }).action, "zoom");
  assert.equal(resolvePlanetHubZoomOwnership({ mode: "overview", cameraOwner: "moon-focus", direction: 1 }).action, "zoom");
  assert.equal(resolvePlanetHubZoomOwnership({ cameraOwner: "journey-flight", direction: 1 }).reason, "camera-owned");
  assert.equal(resolvePlanetHubZoomOwnership({ interactiveTarget: true, direction: 1 }).reason, "interactive-target");
  assert.equal(resolvePlanetHubZoomOwnership({ atMaximum: true, direction: 1 }).reason, "zoom-boundary");
});

test("all bands preserve direct drag while passive hover never steers the camera", () => {
  const planet = resolvePlanetHubZoomInteractionRules({ band: "planet" });
  assert.equal(planet.directDragOrbit, true);
  assert.equal(planet.passiveHoverOrbit, false);
  assert.equal(planet.landmarkPicking, true);
  assert.equal(planet.satellitePicking, true);

  const system = resolvePlanetHubZoomInteractionRules({ band: "system" });
  assert.equal(system.directDragOrbit, true);
  assert.equal(system.passiveHoverOrbit, false);
  assert.equal(system.landmarkPicking, false);
  assert.equal(system.autoCenterDestination, false);
  assert.equal(system.satellitePicking, false);
  assert.equal(system.celestialBodyPicking, true, "large bodies remain valid double-click targets at system scale");

  const flight = resolvePlanetHubZoomInteractionRules({
    band: "planet",
    cameraOwner: "journey-flight"
  });
  assert.ok(Object.values(flight).every((value) => value === false));
});

test("cosmic extension begins exactly at the unchanged legacy Universe stop", () => {
  assert.ok(Math.abs(planetHubZoomProgressToDistance(1) / PLANET_HUB_DISTANCE_STOPS.universe - 1) < 1e-12);
  assert.ok(Math.abs(planetHubCosmicZoomProgressToDistance(0) / PLANET_HUB_DISTANCE_STOPS.universe - 1) < 1e-12);
  assert.equal(PLANET_HUB_COSMIC_DISTANCE_STOPS.milkyWayBoundary, PLANET_HUB_DISTANCE_STOPS.universe);
  assert.ok(Math.abs(
    planetHubCosmicZoomProgressToDistance(1)
      / PLANET_HUB_COSMIC_DISTANCE_STOPS.observableUniverse - 1
  ) < 1e-12);
  assert.equal(clampPlanetHubCosmicZoomProgress(-1), 0);
  assert.equal(clampPlanetHubCosmicZoomProgress(2), 1);
});

test("cosmic milestones are ordered physical distances through the observable radius", () => {
  assert.deepEqual(PLANET_HUB_COSMIC_MILESTONES.map(({ id }) => id), [
    "milky-way-boundary",
    ...PLANET_HUB_COSMIC_VIEW_TIERS
  ]);
  const distances = PLANET_HUB_COSMIC_MILESTONES.map(({ distanceMeters }) => distanceMeters);
  assert.equal(distances[0], PLANET_HUB_DISTANCE_STOPS.universe);
  assert.equal(distances.at(-1), PLANET_HUB_DISTANCE_METERS.lightYear * 46_500_000_000);
  assert.ok(distances.every((distance, index) => index === 0 || distance > distances[index - 1]));
  assert.deepEqual(PLANET_HUB_COSMIC_VIEW_TIERS.map((tier, index) => (
    classifyPlanetHubCosmicViewTier({ distanceMeters: distances[index + 1] })
  )), PLANET_HUB_COSMIC_VIEW_TIERS);
});

test("cosmic distance mapping round-trips densely without renormalizing legacy progress", () => {
  for (let index = 0; index <= 200; index += 1) {
    const progress = index / 200;
    const distance = planetHubCosmicZoomProgressToDistance(progress);
    const roundTrip = planetHubCosmicZoomDistanceToProgress(distance);
    assert.ok(Math.abs(roundTrip - progress) < 1e-12, `${progress} round-tripped as ${roundTrip}`);
  }
});

test("one standard cosmic wheel pulse remains exactly 1.20x with a long physical rail", () => {
  const fromDistance = planetHubCosmicZoomProgressToDistance(0);
  const outward = calculatePlanetHubCosmicWheelZoom({ progress: 0, deltaY: 100 });
  const outwardDistance = planetHubCosmicZoomProgressToDistance(outward.progress);
  assert.ok(Math.abs(outwardDistance / fromDistance - PLANET_HUB_STANDARD_WHEEL_MULTIPLIER) < 1e-12);
  const inward = calculatePlanetHubCosmicWheelZoom({ progress: outward.progress, deltaY: -100 });
  assert.ok(Math.abs(inward.progress) < 1e-12);
  assert.ok(PLANET_HUB_COSMIC_EXTENSION_WHEEL_PULSES > 67);
  assert.ok(PLANET_HUB_COSMIC_EXTENSION_WHEEL_PULSES < 69);
});

test("cosmic rebasing reconstructs physical distance while bounding the local dolly", () => {
  const localMaximum = PLANET_HUB_STANDARD_WHEEL_MULTIPLIER ** 8;
  for (let index = 0; index <= 200; index += 1) {
    const represented = resolvePlanetHubCosmicRepresentedDistance(index / 200);
    const reconstructed = represented.metersPerUnit * represented.localDollyFactor;
    assert.ok(Math.abs(reconstructed / represented.distanceMeters - 1) < 1e-12);
    assert.ok(represented.localDollyFactor >= 1 - 1e-10);
    assert.ok(represented.localDollyFactor <= localMaximum * (1 + 1e-10));
  }
});
