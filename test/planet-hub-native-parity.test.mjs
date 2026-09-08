import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";
import * as renderer from "../public/planet-hub-renderer.mjs";
import * as space from "../public/planet-hub-space.mjs";
import * as zoom from "../public/planet-hub-zoom.mjs";
import * as PINNED_THREE from "../public/vendor/three/planet-hub-three.mjs";

const EPSILON = 1e-9;

function requiredFunction(module, name, owner) {
  assert.equal(typeof module[name], "function",
    `${owner} must export ${name} so native-reference parity is numerically testable`);
  return module[name];
}

function assertClose(actual, expected, tolerance = EPSILON, message = "values differ") {
  assert.ok(Number.isFinite(actual), `${message}: actual must be finite (${actual})`);
  assert.ok(Number.isFinite(expected), `${message}: expected must be finite (${expected})`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}, tolerance ${tolerance}`);
}

function magnitude(vector) {
  return Math.hypot(...vector);
}

function normalize(vector) {
  const length = magnitude(vector) || 1;
  return vector.map((coordinate) => coordinate / length);
}

function dot(left, right) {
  return left.reduce((sum, coordinate, index) => sum + coordinate * right[index], 0);
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function weightByDecade(result) {
  return new Map(result.layers.map((layer) => [layer.decade, layer.weight]));
}

test("shipped tree-shaken Three runtime can construct the native grid and meters", async () => {
  const source = await readFile(new URL("../public/planet-hub-space.mjs", import.meta.url), "utf8");
  for (const obsolete of [
    "LineLoop",
    "CanvasTexture",
    "SpriteMaterial",
    "Sprite",
    "LinearMipmapLinearFilter"
  ]) {
    assert.doesNotMatch(source, new RegExp(`\\bTHREE[?]?[.]${obsolete}\\b`),
      `${obsolete} would expand or crash the shipped tree-shaken Three surface`);
  }

  const camera = new PINNED_THREE.PerspectiveCamera(28, 16 / 9, 0.05, 448);
  camera.position.set(3, 4, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const view = space.createPlanetHubSpaceEnvironment(PINNED_THREE, {
    quality: "low",
    camera,
    width: 1280,
    height: 720
  });
  try {
    assert.equal(view.snapshot().gridCarrierCount, 3);
    assert.equal(view.snapshot().planeMeterCount, 2);
  } finally {
    view.dispose();
  }
});

test("native grid LOD is three adjacent decades whose crossfade conserves opacity", () => {
  const resolveGridLod = requiredFunction(space, "resolvePlanetHubGridLod", "planet-hub-space");
  for (const cellSize of [0.001, 0.1, 1, Math.sqrt(10), 9.999, 10, 73, 1e4, 1e11]) {
    const result = resolveGridLod(cellSize);
    assert.equal(result.layers.length, 3, `${cellSize} must keep three resident grid carriers`);
    assert.deepEqual(result.layers.map((layer) => layer.decade), [
      result.baseDecade - 1,
      result.baseDecade,
      result.baseDecade + 1
    ], `${cellSize} must use adjacent decimal LODs`);
    for (const layer of result.layers) {
      assertClose(layer.cellSize, 10 ** layer.decade,
        Math.max(EPSILON, 10 ** layer.decade * 1e-12), "grid cell size must match its decade");
      assert.ok(layer.weight >= 0 && layer.weight <= 1,
        `decade ${layer.decade} exposes a bounded crossfade weight`);
    }
    assertClose(result.layers.reduce((sum, layer) => sum + layer.weight, 0), 1, 1e-12,
      "grid carrier weights must sum to one");
    assert.ok(result.layers.some((layer) => layer.weight > EPSILON),
      "at least one resident grid decade must contribute at every distance");
  }

  for (const decade of [-3, -1, 0, 1, 4, 9]) {
    const boundary = 10 ** decade;
    const before = weightByDecade(resolveGridLod(boundary * (1 - 1e-10)));
    const after = weightByDecade(resolveGridLod(boundary * (1 + 1e-10)));
    assertClose(before.get(decade) || 0, after.get(decade) || 0, 2e-8,
      `decade ${decade} must not pop when the carrier ring rebases`);
  }
});

test("native grid carrier fades radially into black before its edge", () => {
  const edgeOpacity = requiredFunction(space, "resolvePlanetHubGridEdgeOpacity", "planet-hub-space");
  assert.ok(Number.isFinite(space.PLANET_HUB_GRID_EDGE_FADE_START),
    "planet-hub-space must export the shader's edge-fade start");
  const fadeStart = space.PLANET_HUB_GRID_EDGE_FADE_START;
  assert.ok(fadeStart > 0.5 && fadeStart < 1);
  assert.equal(edgeOpacity({ normalizedRadius: 0, fadeStart }), 1);
  assert.equal(edgeOpacity({ normalizedRadius: fadeStart, fadeStart }), 1);
  const ramp = [0.25, 0.5, 0.75].map((amount) => edgeOpacity({
    normalizedRadius: fadeStart + (1 - fadeStart) * amount,
    fadeStart
  }));
  assert.ok(ramp[0] > ramp[1] && ramp[1] > ramp[2],
    "radial carrier opacity must descend monotonically through the fade runway");
  assert.equal(edgeOpacity({ normalizedRadius: 1, fadeStart }), 0);
  assert.equal(edgeOpacity({ normalizedRadius: 1.4, fadeStart }), 0);
});

test("native chart uses one plane, hides its underside, and ramps near edge-on", () => {
  const planeOpacity = requiredFunction(space, "resolvePlanetHubGridPlaneOpacity", "planet-hub-space");
  assert.equal(planeOpacity({ cameraSide: -1, viewNormalDot: 1 }), 0,
    "the grid underside must be completely hidden");
  assert.equal(planeOpacity({ cameraSide: 1, viewNormalDot: 0 }), 0,
    "an exactly edge-on carrier must disappear");
  const ramp = [0.01, 0.04, 0.1, 0.25, 0.6, 1]
    .map((towardPlane) => planeOpacity({ cameraSide: 1, viewNormalDot: -towardPlane }));
  for (let index = 1; index < ramp.length; index += 1) {
    assert.ok(ramp[index] >= ramp[index - 1] - EPSILON,
      "front-side opacity must rise monotonically away from edge-on");
  }
  assert.ok(ramp.some((opacity) => opacity > 0 && opacity < 1),
    "near-edge-on visibility needs a real ramp rather than an on/off threshold");
  assert.equal(ramp.at(-1), 1);
});

test("native environment exposes one three-carrier family and separate meter rings", () => {
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 448);
  camera.position.set(3, 4, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const view = space.createPlanetHubSpaceEnvironment(THREE, {
    quality: "low",
    camera,
    width: 1280,
    height: 720
  });
  try {
    assert.ok(view.gridFamily?.isGroup, "one Group must own the complete logarithmic grid family");
    assert.equal(view.gridCarriers?.length, 3, "three Mesh carriers must remain resident");
    assert.ok(view.gridCarriers.every((carrier) => carrier?.isMesh && carrier.parent === view.gridFamily),
      "each carrier must be a co-planar textured quad under the same family");
    assert.equal(view.worldGrid, view.gridCarriers[1],
      "the compatibility worldGrid handle must address the middle LOD carrier");
    assert.ok(view.planeMeter?.isGroup, "metric rings need a distinct PlaneMeter-style group");
    assert.notEqual(view.planeMeter.parent, view.gridFamily,
      "measurement rings cannot be baked into or counted as grid carriers");
    assert.equal(typeof view.setWorldGridPlaneView, "function",
      "camera-side visibility must be an explicit environment seam");

    view.setWorldGridAnchor({ scope: "system", position: [0, 0, 0], bodyRadius: 2.6 });
    view.setViewDepth({ progress: zoom.PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system, band: "system" });
    view.setWorldGridPlaneView({ cameraSide: 1, viewNormalDot: 1 });
    const front = view.snapshot();
    assert.equal(front.gridFamilyCount, 1);
    assert.equal(front.gridCarrierCount, 3);
    assert.equal(front.planeMeterCount, 2);
    assertClose(front.gridWeightSum, 1, 1e-9);
    assert.deepEqual(front.gridDecades, [
      front.gridDecades[0],
      front.gridDecades[0] + 1,
      front.gridDecades[0] + 2
    ]);
    assert.equal(front.planeMeterLabels.length, 2);
    assert.equal(front.planeMeterUnits.length, 2);
    assert.equal(front.planeMeterRadiiMeters.length, 2);

    view.setWorldGridPlaneView({ cameraSide: -1, viewNormalDot: 1 });
    const underside = view.snapshot();
    assert.equal(underside.gridPlaneOpacity, 0);
    assert.equal(underside.gridCameraSide, -1);
  } finally {
    view.dispose();
  }
});

test("native plane meters are decimal measurement rings, not extra grids", () => {
  const resolveMeters = requiredFunction(space, "resolvePlanetHubPlaneMeters", "planet-hub-space");
  for (const [targetRadiusMeters, metersPerUnit] of [
    [6_371_000, 1_000_000],
    [384_400_000, 10_000_000],
    [zoom.PLANET_HUB_DISTANCE_METERS.au * 2, zoom.PLANET_HUB_DISTANCE_METERS.au]
  ]) {
    const result = resolveMeters({ targetRadiusMeters, metersPerUnit });
    assert.equal(result.meters.length, 2);
    assert.equal(result.meters[1].decade, result.meters[0].decade + 1);
    assertClose(result.meters.reduce((sum, meter) => sum + meter.weight, 0), 1, 1e-12,
      "meter crossfade weights must sum to one");
    for (const meter of result.meters) {
      assertClose(meter.radiusMeters, 10 ** meter.decade,
        Math.max(EPSILON, meter.radiusMeters * 1e-12));
      assertClose(meter.radiusWorld, meter.radiusMeters / metersPerUnit,
        Math.max(EPSILON, meter.radiusWorld * 1e-12));
      assert.ok(typeof meter.label === "string" && meter.label.length > 0);
      assert.ok(typeof meter.unit === "string" && meter.unit.length > 0);
    }
  }
});

test("one native grid plane remains authoritative from Orbit through the Milky Way", () => {
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 448);
  camera.position.set(3, 4, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const view = space.createPlanetHubSpaceEnvironment(THREE, { camera, quality: "low" });
  try {
    view.setWorldGridAnchor({ scope: "system", position: [0, 0, 0], bodyRadius: 2.6 });
    view.setWorldGridPlaneView({ cameraSide: 1, viewNormalDot: -1 });
    for (const band of ["orbit", "system", "galaxy", "universe"]) {
      view.setViewDepth({
        progress: zoom.PLANET_HUB_ZOOM_ANCHOR_PROGRESS[band],
        band,
        // A legacy atlas owner may still describe semantic content, but it
        // must never retire or replace the native carrier family.
        gridOwner: band === "galaxy" || band === "universe" ? "milky-way" : null
      });
      const snapshot = view.snapshot();
      assert.equal(snapshot.gridFamilyCount, 1, `${band} must retain exactly one chart plane`);
      assert.equal(snapshot.gridCarrierCount, 3, `${band} keeps three LODs of the same plane`);
      assertClose(snapshot.gridWeightSum, 1, 1e-9);
      assert.ok(snapshot.gridPlaneOpacity > 0, `${band} must not swap to a finite atlas grid`);
      assert.equal(view.gridFamily.visible, true);
      assert.ok(view.gridCarriers.some((carrier) => carrier.visible));
    }
  } finally {
    view.dispose();
  }
});

test("astronomical camera can orbit below the plane without acquiring roll", () => {
  const createOrbit = requiredFunction(renderer, "createPlanetHubCameraOrbitState", "planet-hub-renderer");
  const constrainOrbit = requiredFunction(renderer, "constrainPlanetHubCameraOrbitForView", "planet-hub-renderer");
  const calculatePose = requiredFunction(renderer, "calculatePlanetHubCameraOrbitPose", "planet-hub-renderer");
  const below = createOrbit({
    position: [2.4, -4.2, 3.1],
    target: [0, 0, 0],
    up: [0, 1, 0],
    velocity: { yaw: 0.4, pitch: -0.3 }
  });
  const constrained = constrainOrbit(below, {
    progress: zoom.PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system,
    worldUp: [0, 1, 0]
  });
  const pose = calculatePose(constrained);
  const outward = normalize(pose.position.map((coordinate, index) => coordinate - pose.target[index]));
  assert.ok(outward[1] < -0.5,
    `chart navigation must preserve a deliberate below-plane orbit (received y=${outward[1]})`);

  const forward = outward.map((coordinate) => -coordinate);
  const worldUp = [0, 1, 0];
  const idealUp = normalize(worldUp.map((coordinate, index) => (
    coordinate - forward[index] * dot(worldUp, forward)
  )));
  const actualUp = normalize(pose.up);
  const roll = Math.atan2(dot(forward, cross(idealUp, actualUp)), dot(idealUp, actualUp));
  assert.ok(Math.abs(roll) <= 1e-6,
    `below-plane orbit must remain horizon-level instead of rolling (${roll} radians)`);
});

test("physical celestial discs share inverse-distance projection with no pixel minimum", () => {
  const projectedDiameter = requiredFunction(renderer,
    "calculatePlanetHubProjectedBodyDiameterPixels", "planet-hub-renderer");
  const common = { verticalFovDegrees: 42, viewportHeight: 720 };
  // The native projection uses the exact apparent tangent of a sphere. At
  // astronomical distances this converges to inverse distance without the
  // near-camera approximation error that a distance of only a few radii has.
  const distances = [1e4, 2e4, 4e4, 8e4, 1e12];
  const sun = distances.map((cameraDistance) => projectedDiameter({
    ...common,
    physicalWorldRadius: 1,
    cameraDistance
  }));
  const earth = distances.map((cameraDistance) => projectedDiameter({
    ...common,
    physicalWorldRadius: 1 / 109,
    cameraDistance
  }));
  for (let index = 1; index < distances.length - 1; index += 1) {
    assertClose(sun[index], sun[index - 1] * 0.5, sun[index] * 1e-8,
      "doubling camera distance must halve the visible Sun diameter");
    assertClose(earth[index], earth[index - 1] * 0.5, earth[index] * 1e-8,
      "every other body must contract at the same projective rate");
  }
  for (let index = 0; index < distances.length; index += 1) {
    assertClose(sun[index] / earth[index], 109, 1e-4,
      "projection may preserve a physical radius ratio but never apply a Sun-only screen floor");
  }
  assert.ok(sun.at(-1) < 1e-8,
    "the distant physical sphere must become subpixel rather than stop at a visible-disc minimum");

  const displayScale = requiredFunction(renderer, "calculatePlanetHubChartBodyDisplayScale", "planet-hub-renderer");
  for (const bodyId of ["sun", "jupiter", "earth", "mercury"]) {
    for (const cameraDistance of [8, 80, 8000]) {
      assert.equal(displayScale({
        bodyId,
        physicalWorldRadius: bodyId === "sun" ? 1 : 0.01,
        cameraDistance,
        verticalFovDegrees: 42,
        viewportWidth: 1280,
        viewportHeight: 720,
        progress: zoom.PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system,
        solarDetailOpacity: 1
      }), 1, `${bodyId} cannot be enlarged toward a body-specific target pixel diameter`);
    }
  }
});

test("Sun ownership hands off Model to ModelAndParticle to Particle while glare stays distinct", () => {
  const resolveSunLod = requiredFunction(renderer, "resolvePlanetHubSunLod", "planet-hub-renderer");
  const samples = Array.from({ length: 401 }, (_, index) => {
    const exponent = index / 400 * 12;
    return resolveSunLod({
      physicalWorldRadius: 1,
      cameraDistance: 2 * 10 ** exponent,
      verticalFovDegrees: 42,
      viewportHeight: 720,
      progress: index / 400
    });
  });
  const orderedModes = [];
  let previousDiameter = Infinity;
  for (const [index, sample] of samples.entries()) {
    assert.ok(["model", "model-particle", "particle"].includes(sample.mode),
      `sample ${index} exposes the native Model/ModelAndParticle/Particle ownership states`);
    if (sample.mode !== orderedModes.at(-1)) orderedModes.push(sample.mode);
    assert.ok(sample.projectedDiameterPixels <= previousDiameter + EPSILON,
      "projected surface diameter must never grow while travelling outward");
    previousDiameter = sample.projectedDiameterPixels;
    assertClose(sample.modelOpacity + sample.particleOpacity, 1, 1e-9,
      "surface and distant-particle handoff weights must sum to one");
    assert.ok(sample.glareOpacity >= 0 && sample.glareOpacity <= 1,
      "glare is an independently bounded optical layer");
    assert.ok(sample.glareScale >= 0, "glare scale must remain finite and non-negative");
    if (sample.mode === "model") {
      assert.equal(sample.modelOpacity, 1);
      assert.equal(sample.particleOpacity, 0);
    } else if (sample.mode === "model-particle") {
      assert.ok(sample.modelOpacity > 0 && sample.particleOpacity > 0);
    } else {
      assert.equal(sample.modelOpacity, 0);
      assert.equal(sample.particleOpacity, 1);
    }
  }
  assert.deepEqual(orderedModes, ["model", "model-particle", "particle"]);
  const distant = samples.at(-1);
  assert.ok(distant.projectedDiameterPixels < 1e-6);
  assert.equal(distant.modelOpacity, 0, "the distant Sun cannot retain a visible sphere");
  assert.equal(distant.particleOpacity, 1, "a luminous additive point preserves distant Sun presence");
  assert.ok(samples.some((sample) => sample.mode === "model-particle" && sample.glareOpacity > 0),
    "glare remains a distinct optical layer through the surface-to-particle handoff");
});

test("logarithmic zoom and rebasing preserve physical distance on every frame", () => {
  const min = zoom.PLANET_HUB_DISTANCE_STOPS.planet;
  const max = zoom.PLANET_HUB_DISTANCE_STOPS.universe;
  let priorDistance = 0;
  let priorRebase = -1;
  let rebaseCount = 0;
  for (let index = 0; index <= 10_000; index += 1) {
    const progress = index / 10_000;
    const represented = zoom.resolvePlanetHubRepresentedDistance(progress);
    assert.ok(represented.distanceMeters >= priorDistance,
      "represented distance must remain monotonic across every rebase cell");
    assertClose(represented.distanceMeters,
      represented.metersPerUnit * represented.localDollyFactor,
      Math.max(1e-3, represented.distanceMeters * 2e-13),
      "rebase scale and local dolly must reconstruct the same physical distance");
    assertClose(zoom.planetHubZoomDistanceToProgress(represented.distanceMeters), progress,
      2e-12, "log-distance conversion must round-trip continuously");
    if (priorRebase >= 0 && represented.rebaseIndex !== priorRebase) rebaseCount += 1;
    priorRebase = represented.rebaseIndex;
    priorDistance = represented.distanceMeters;
  }
  assert.ok(rebaseCount > 10, "the regression sweep must cross many real rebase cells");
  assertClose(zoom.planetHubZoomProgressToDistance(0), min, 1e-6);
  assertClose(zoom.planetHubZoomProgressToDistance(1), max, max * 1e-12);

  let progress = 0.2;
  for (let pulse = 0; pulse < 30; pulse += 1) {
    const before = zoom.planetHubZoomProgressToDistance(progress);
    const result = zoom.calculatePlanetHubWheelZoom({ progress, deltaY: 100 });
    const after = zoom.planetHubZoomProgressToDistance(result.progress);
    assertClose(after / before, zoom.PLANET_HUB_STANDARD_WHEEL_MULTIPLIER, 1e-12,
      "each standard wheel pulse must still travel a substantial physical factor");
    progress = result.progress;
  }

  let spring = { progress: 0, velocity: 0 };
  let last = zoom.planetHubZoomProgressToDistance(0);
  for (let frame = 0; frame < 10_000 && spring.progress < 1; frame += 1) {
    spring = zoom.stepPlanetHubZoomSpring({
      progress: spring.progress,
      velocity: spring.velocity,
      targetProgress: 1,
      deltaSeconds: 1 / 60
    });
    const distance = zoom.planetHubZoomProgressToDistance(spring.progress);
    assert.ok(distance >= last, "spring interpolation must not reverse an outward journey");
    assert.ok(distance / last <= 1.25,
      `one rendered frame cannot teleport across scale (${distance / last}x)`);
    last = distance;
    if (spring.settled) break;
  }
  assertClose(spring.progress, 1, 1e-9, "the progressive spring must reach the Milky Way stop");
});

test("browser diagnostics expose every native-parity value required for frame validation", async () => {
  const source = await readFile(new URL("../public/celestial-atlas-runtime.mjs", import.meta.url), "utf8");
  const required = [
    "planetHubGridFamilyCount",
    "planetHubGridCarrierCount",
    "planetHubGridSource",
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
  ];
  const missing = required.filter((key) => !source.includes(key));
  assert.deepEqual(missing, [],
    `publishPhysicalDiagnostics must expose frame-auditable native parity state: ${missing.join(", ")}`);
  assert.match(source, /spaceEnvironment[?]?[.]snapshot[?]?[.]\(/,
    "renderer diagnostics must consume the grid environment's authoritative snapshot");
  assert.match(source, /planetHubGridSource:\s*["']native-space["']/,
    "frame diagnostics must prove the native carrier is visible instead of the legacy finite atlas grid");
  assert.doesNotMatch(source,
    /planetHubSunParticleOpacity:\s*sunLod[.]particleOpacity/,
    "diagnostics must publish the effective local/atlas point ownership, not an invisible nominal LOD weight");
});
