import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";

import {
  PLANET_HUB_SUN_EFFECTS_FRAGMENT_SHADER,
  PLANET_HUB_SUN_EFFECTS_VERTEX_SHADER,
  calculatePlanetHubSunAngularPlane,
  calculatePlanetHubSunOcclusionSplit,
  calculatePlanetHubSunOpticalScale,
  calculatePlanetHubSunViewportVisibility,
  createPlanetHubSunEffectsRig,
  createPlanetHubSunRayLobes,
  resolvePlanetHubSunEffectsProfile
} from "../public/planet-hub-sun-effects.mjs";

test("Sun effect profiles bound quality, reduced motion, and off behavior", () => {
  const low = resolvePlanetHubSunEffectsProfile({ quality: "low" });
  const standard = resolvePlanetHubSunEffectsProfile({ quality: "standard" });
  const reduced = resolvePlanetHubSunEffectsProfile({ quality: "standard", reducedMotion: true });
  const off = resolvePlanetHubSunEffectsProfile({ quality: "standard", effectsLevel: "off" });
  assert.ok(low.rayCount > 0);
  assert.ok(standard.rayCount >= low.rayCount && standard.rayCount <= 8,
    "quality may add restrained rays without restoring the old starburst");
  for (const profile of [low, standard]) {
    assert.ok(profile.angularDiameterDegrees >= 3 && profile.angularDiameterDegrees <= 8,
      "the near solar optic stays compact enough to reveal the authored disc");
    assert.ok(profile.streakStrength >= 0.7,
      "full effects must keep the geometric lens glare visibly present");
  }
  assert.equal(reduced.animated, false);
  assert.equal(reduced.motion, 0);
  assert.ok(reduced.rayCount < standard.rayCount);
  assert.equal(off.enabled, false);
  assert.equal(off.opacity, 0);
  assert.equal(off.rayCount, 0);
});

test("irregular ray lobes are deterministic, separated, and bounded", () => {
  const first = createPlanetHubSunRayLobes({ quality: "standard", seed: 73 });
  const repeat = createPlanetHubSunRayLobes({ quality: "standard", seed: 73 });
  const other = createPlanetHubSunRayLobes({ quality: "standard", seed: 74 });
  assert.deepEqual(first, repeat);
  assert.notDeepEqual(first, other);
  assert.equal(first.length, resolvePlanetHubSunEffectsProfile({ quality: "standard" }).rayCount);
  assert.equal(Object.isFrozen(first), true);
  assert.ok(first.every((ray) => ray.angle >= -Math.PI / 12 && ray.angle < Math.PI));
  assert.ok(first.every((ray) => ray.sharpness >= 50 && ray.sharpness <= 190));
  assert.ok(first.every((ray) => ray.reach >= 1.15 && ray.reach <= 2.9));
  assert.ok(first.every((ray) => ray.intensity >= 0.2 && ray.intensity <= 0.65));
  assert.ok(new Set(first.map((ray) => ray.intensity.toFixed(5))).size >= first.length * 0.75);
  assert.deepEqual(createPlanetHubSunRayLobes({ count: 0 }), []);
});

test("camera optics preserve direct semantic scale across zoom bands", () => {
  assert.equal(calculatePlanetHubSunOpticalScale(1), 1);
  assert.equal(calculatePlanetHubSunOpticalScale(0.28), 0.28);
  assert.equal(calculatePlanetHubSunOpticalScale(0.1), 0.1);
  assert.equal(calculatePlanetHubSunOpticalScale(0), 0,
    "zero angular glare stays zero instead of receiving a display floor");
});

test("a requested angular size scales in world space without changing apparent angle", () => {
  const near = calculatePlanetHubSunAngularPlane({
    cameraPosition: [0, 0, 5],
    sunPosition: [0, 0, -5],
    angularDiameterDegrees: 12
  });
  const far = calculatePlanetHubSunAngularPlane({
    cameraPosition: [0, 0, 5],
    sunPosition: [0, 0, -15],
    angularDiameterDegrees: 12
  });
  assert.equal(near.distance, 10);
  assert.equal(far.distance, 20);
  assert.ok(Math.abs(far.worldDiameter / near.worldDiameter - 2) < 1e-12);
  assert.equal(near.angularDiameterDegrees, far.angularDiameterDegrees);
  assert.ok(near.worldDiameter > 2 && near.worldDiameter < 2.2);
});

test("physical solar angular size contracts continuously with inverse distance", () => {
  const samples = Array.from({ length: 2001 }, (_, index) => {
    const distance = 2 + index * 4;
    return calculatePlanetHubSunAngularPlane({
      cameraPosition: [0, 0, distance],
      sunPosition: [0, 0, 0],
      physicalRadius: 1
    });
  });
  for (let index = 1; index < samples.length; index += 1) {
    assert.equal(samples[index].physicalRadius, 1);
    assert.equal(samples[index].worldDiameter, 2);
    assert.ok(samples[index].angularDiameterRadians < samples[index - 1].angularDiameterRadians,
      `physical angular size has no plateau at sample ${index}`);
  }
  const far = calculatePlanetHubSunAngularPlane({
    cameraPosition: [0, 0, 20_000], sunPosition: [0, 0, 0], physicalRadius: 1
  });
  const farther = calculatePlanetHubSunAngularPlane({
    cameraPosition: [0, 0, 40_000], sunPosition: [0, 0, 0], physicalRadius: 1
  });
  assert.ok(Math.abs(farther.angularDiameterRadians / far.angularDiameterRadians - 0.5) < 1e-8);
});

test("eclipse occlusion hides the disc, suppresses rays, and retains only a thin corona rim", () => {
  const hidden = calculatePlanetHubSunOcclusionSplit({ discVisibility: 0, eclipseRim: 0.08 });
  const partial = calculatePlanetHubSunOcclusionSplit({ discVisibility: 0.5, eclipseRim: 0.08 });
  const visible = calculatePlanetHubSunOcclusionSplit({ discVisibility: 1, eclipseRim: 0.08 });
  assert.equal(hidden.disc, 0);
  assert.ok(hidden.corona > 0 && hidden.corona <= 0.1,
    "totality may keep a thin eclipse rim, not the full uneclipsed corona");
  assert.equal(hidden.rays, 0, "a body covering the Sun must also cover its radial rays");
  assert.equal(hidden.streak, 0, "a body covering the Sun must suppress its camera streak");
  for (const key of ["disc", "corona", "rays", "streak"]) {
    assert.ok(hidden[key] <= partial[key]);
    assert.ok(partial[key] <= visible[key]);
    assert.equal(visible[key], 1);
  }
});

test("viewport visibility rejects a Sun behind the camera and softly fades beyond screen edges", () => {
  assert.deepEqual(calculatePlanetHubSunViewportVisibility({ sunNdc: [0.2, -0.3, 0], facing: true }), {
    visible: true,
    opacity: 1,
    ndc: [0.2, -0.3, 0]
  });
  assert.equal(calculatePlanetHubSunViewportVisibility({ sunNdc: [0, 0, 0], facing: false }).opacity, 0);
  assert.equal(calculatePlanetHubSunViewportVisibility({ sunNdc: [0, 0, 1.2], facing: true }).opacity, 0);
  const edge = calculatePlanetHubSunViewportVisibility({ sunNdc: [1.09, 0, 0], facing: true });
  assert.ok(edge.opacity > 0 && edge.opacity < 1);
  assert.equal(calculatePlanetHubSunViewportVisibility({ sunNdc: [1.3, 0, 0], facing: true }).visible, false);
});

test("Three-injected rig is one bounded additive pass with no postprocessing dependency", () => {
  const rig = createPlanetHubSunEffectsRig(THREE, { quality: "standard", seed: 73 });
  assert.equal(rig.root.name, "planet-hub-sun-effects-root");
  assert.equal(rig.root.children.length, 1);
  assert.equal(rig.plane.material.transparent, true);
  assert.equal(rig.plane.material.depthTest, false,
    "camera optics use analytic body occlusion instead of pretending to be world geometry");
  assert.equal(rig.plane.material.depthWrite, false);
  assert.equal(rig.plane.material.blending, THREE.AdditiveBlending);
  assert.equal(rig.plane.material.toneMapped, false);
  assert.equal(rig.plane.material.side, THREE.DoubleSide);
  assert.equal(rig.plane.frustumCulled, false);
  assert.equal(rig.material.uniforms.uRayLobes.value.length, rig.lobes.length * 4);
  assert.match(PLANET_HUB_SUN_EFFECTS_VERTEX_SHADER, /gl_Position=vec4\(position[.]xy,0[.],1[.]\)/,
    "the existing one draw is a deterministic clip-space optical pass");
  assert.match(PLANET_HUB_SUN_EFFECTS_FRAGMENT_SHADER, /uSunNdc[\s\S]*uAspect[\s\S]*uRadius/);
  assert.match(PLANET_HUB_SUN_EFFECTS_FRAGMENT_SHADER, /innerCorona/);
  assert.doesNotMatch(PLANET_HUB_SUN_EFFECTS_FRAGMENT_SHADER, /float horizontal|float vertical/,
    "the old oversized cross flare must not return");
  assert.match(PLANET_HUB_SUN_EFFECTS_FRAGMENT_SHADER, /polygonAperture/,
    "camera glare uses an explicit geometric aperture rather than circular blur spots");
  assert.match(PLANET_HUB_SUN_EFFECTS_FRAGMENT_SHADER, /sourceHaze[\s\S]*axialHaze/,
    "a broad source veil and optical-axis haze keep the Sun dominant around its fine rays");
  assert.doesNotMatch(PLANET_HUB_SUN_EFFECTS_FRAGMENT_SHADER, /sampler2D|EffectComposer|texture2D/);
  rig.dispose();
});

test("layered polygonal aperture ghosts form one bounded Sun-to-center optical chain", () => {
  const shader = PLANET_HUB_SUN_EFFECTS_FRAGMENT_SHADER;
  const shaderRayLimit = Number(shader.match(/#define\s+PLANET_HUB_MAX_SUN_RAYS\s+(\d+)/)?.[1]);
  assert.ok(shaderRayLimit > 0 && shaderRayLimit <= 8,
    "polygonal camera glare cannot restore the old high-spoke radial wheel");
  const apertureUses = [...shader.matchAll(/polygonAperture\s*\(/g)].length;
  assert.ok(apertureUses >= 5,
    "the aperture helper plus at least four independently sized ghosts creates visible layered depth");
  assert.ok(apertureUses <= 8,
    "the lens treatment stays a concise chain rather than another giant geometric wheel");
  assert.match(shader, /vec2\s+flareAxis\s*=[^;]*(?:uSunNdc|axis)/,
    "all aperture centers derive from one camera-space Sun-to-viewport-center axis");
  assert.match(shader, /ghostAxis\s*=\s*flareAxis\s*\*\s*ghostScale[\s\S]*polygonAperture\([^;]*ghostAxis[\s\S]*polygonGhosts/,
    "the geometric ghosts remain aligned to the optical axis as the camera circles Earth");
  assert.match(shader, /ghostScale\s*=\s*clamp\(uRadius\s*\*[^;]+/,
    "far chart bands compress the aperture train with the Sun instead of resembling a miniature solar system");
  const ghostFloor = Number(shader.match(/ghostScale\s*=\s*clamp\([^,]+,\s*([0-9.]+)/)?.[1]);
  assert.ok(Number.isFinite(ghostFloor) && ghostFloor <= 0.08,
    "the far-view aperture floor stays too small to masquerade as a detached celestial chart");
  assert.match(shader, /(?:5[.]0|6[.]0)/,
    "at least one authored five- or six-sided aperture silhouette must remain visibly geometric");
  assert.match(shader, /ghostGate\s*=[^;]*uStreakStrength\s*\*\s*uStreakVisibility[\s\S]{0,240}polygonGhosts/,
    "planetary eclipse visibility gates the complete aperture chain");
  assert.match(shader, /warmGhosts[\s\S]*coolGhosts/,
    "near and far aperture ghosts retain distinct photographic color groups");
  assert.match(shader, /sourceHaze[\s\S]{0,300}uDiscVisibility/,
    "total eclipse removes the broad uneclipsed lens veil");
});

test("reduced motion preserves static aperture glare without animating or restoring the starburst", () => {
  const full = resolvePlanetHubSunEffectsProfile({ quality: "standard" });
  const reduced = resolvePlanetHubSunEffectsProfile({ quality: "standard", reducedMotion: true });
  assert.equal(reduced.animated, false);
  assert.equal(reduced.motion, 0);
  assert.ok(reduced.streakStrength > 0 && reduced.streakStrength < full.streakStrength,
    "reduced motion keeps the photographic cue but lowers its intensity");
  assert.ok(reduced.rayCount <= 4 && full.rayCount <= 8,
    "accessibility cannot regress to the old many-spoked Sun wheel");
  assert.doesNotMatch(PLANET_HUB_SUN_EFFECTS_FRAGMENT_SHADER, /uTime|elapsed|sin\s*\([^)]*(?:time|motion)/i,
    "polygon aperture placement is deterministic frame-to-frame");
});

test("rig projects the fixed world Sun, supports semantic glare scaling, and applies split visibility", () => {
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 30);
  camera.position.set(0, 0.08, 4.5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const rig = createPlanetHubSunEffectsRig(THREE, { quality: "low", seed: 73 });
  const animated = rig.update({
    camera,
    sunPosition: [-2.35, 1.55, -8.8],
    physicalRadius: 0.72,
    discVisibility: 0,
    elapsedSeconds: 2.4
  });
  assert.equal(animated, true);
  assert.deepEqual(rig.root.position.toArray(), [0, 0, 0], "optics never relocate the physical world Sun");
  const projected = new THREE.Vector3(-2.35, 1.55, -8.8).project(camera);
  assert.ok(Math.abs(rig.material.uniforms.uSunNdc.value[0] - projected.x) < 1e-6);
  assert.ok(Math.abs(rig.material.uniforms.uSunNdc.value[1] - projected.y) < 1e-6);
  assert.equal(rig.material.uniforms.uViewportVisibility.value, 1);
  assert.ok(rig.material.uniforms.uRadius.value > 0);
  assert.equal(rig.material.uniforms.uDiscVisibility.value, 0);
  assert.ok(rig.material.uniforms.uCoronaVisibility.value > 0);
  assert.equal(rig.material.uniforms.uRayVisibility.value, 0);
  assert.equal(rig.material.uniforms.uStreakVisibility.value, 0);
  assert.equal(rig.snapshot().occlusion.disc, 0);
  assert.equal(rig.snapshot().physicalRadius, 0.72);
  assert.ok(rig.snapshot().opticalRadiusNdc > 0);
  assert.ok(rig.snapshot().angularDiameterDegrees >= 3 && rig.snapshot().angularDiameterDegrees <= 8);
  const nearRadius = rig.material.uniforms.uRadius.value;
  const nearOpacity = rig.material.uniforms.uOpacity.value;
  rig.update({
    camera,
    sunPosition: [-2.35, 1.55, -8.8],
    physicalRadius: 0.72,
    scale: 0.28,
    opacity: 0.32
  });
  assert.ok(Math.abs(rig.material.uniforms.uRadius.value / nearRadius - 0.28) < 1e-9,
    "System optics use the direct semantic scale instead of a retained-size floor");
  assert.ok(Math.abs(rig.material.uniforms.uOpacity.value / nearOpacity - 0.32) < 1e-9,
    "System optics use their explicit opacity band");
  assert.equal(rig.snapshot().opticalScale, calculatePlanetHubSunOpticalScale(0.28));
  rig.update({
    camera,
    sunPosition: [-2.35, 1.55, -8.8],
    physicalRadius: 0.72,
    scale: 0.1,
    opacity: 0.12
  });
  assert.ok(Math.abs(rig.material.uniforms.uRadius.value / nearRadius - 0.1) < 1e-9,
    "Universe optics use the direct semantic scale");
  assert.ok(Math.abs(rig.material.uniforms.uOpacity.value / nearOpacity - 0.12) < 1e-9,
    "Universe optics use their explicit opacity band");
  assert.equal(rig.update({ camera, sunPosition: [0, 0, 8] }), false,
    "a Sun behind the camera neither draws nor holds the render loop");
  assert.equal(rig.root.visible, false);
  assert.equal(rig.snapshot().viewport.opacity, 0);
  assert.equal(rig.update({ camera, sunPosition: [100, 0, -8] }), false,
    "an offscreen Sun is suppressed before its full-screen shader can cost ambient frames");
  assert.equal(rig.root.visible, false);
  assert.equal(rig.update({ camera, sunPosition: [-2.35, 1.55, -8.8] }), true);
  assert.equal(rig.root.visible, true);
  assert.equal(rig.setEffects({ reducedMotion: true }).animated, false);
  assert.equal(rig.update({ camera, sunPosition: [-2.35, 1.55, -8.8] }), false);
  assert.equal(rig.setEffects({ effectsLevel: "off", reducedMotion: false }).enabled, false);
  assert.equal(rig.root.visible, false);
  assert.equal(rig.update({ camera }), false);
  assert.equal(rig.setEffects({ effectsLevel: "full" }).animated, true);
  assert.equal(rig.root.visible, true);
  assert.equal(rig.dispose(), true);
  assert.equal(rig.dispose(), false);
});

test("camera orbit refreshes the flare axis from the current projected Sun every frame", () => {
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 30);
  const sunPosition = [1.6, 0.8, -8];
  const rig = createPlanetHubSunEffectsRig(THREE, { quality: "standard" });
  camera.position.set(0, 0, 4.5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  rig.update({ camera, sunPosition });
  const first = [...rig.material.uniforms.uSunNdc.value];

  camera.position.set(-0.9, 0.4, 4.35);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const expected = new THREE.Vector3(...sunPosition).project(camera);
  rig.update({ camera, sunPosition });
  const second = [...rig.material.uniforms.uSunNdc.value];
  assert.notDeepEqual(second, first, "camera orbit must move the optical chain instead of leaving it screen-fixed");
  assert.ok(Math.abs(second[0] - expected.x) < 1e-6);
  assert.ok(Math.abs(second[1] - expected.y) < 1e-6);
  rig.dispose();
});

test("Sun disc, glare scale, and opacity stay continuous through every semantic zoom tier", async () => {
  const module = await import("../public/planet-hub-renderer.mjs");
  const calculate = module.resolvePlanetHubSunOptics;
  assert.equal(typeof calculate, "function",
    "Sun optics need a progress-based resolver instead of discontinuous band lookups");

  const samples = Array.from({ length: 1001 }, (_, index) => calculate(index / 1000));
  for (const [index, sample] of samples.entries()) {
    assert.ok(Number.isFinite(sample.scale) && sample.scale >= 0 && sample.scale <= 1,
      `sample ${index} exposes one bounded optical scale`);
    assert.ok(Number.isFinite(sample.opacity) && sample.opacity >= 0 && sample.opacity <= 1,
      `sample ${index} exposes one bounded optical opacity`);
    if (index === 0) continue;
    const previous = samples[index - 1];
    assert.ok(sample.scale <= previous.scale + 1e-9,
      `Sun scale cannot grow while zooming outward at sample ${index}`);
    assert.ok(sample.opacity <= previous.opacity + 1e-9,
      `Sun opacity cannot grow while zooming outward at sample ${index}`);
    assert.ok(Math.abs(sample.scale - previous.scale) <= 0.01,
      `Sun scale cannot pop at a semantic boundary (${index - 1} -> ${index})`);
    assert.ok(Math.abs(sample.opacity - previous.opacity) <= 0.01,
      `Sun opacity cannot pop at a semantic boundary (${index - 1} -> ${index})`);
  }
  assert.equal(samples[0].scale, 1);
  assert.equal(samples[0].opacity, 1);
  assert.ok(samples.at(-1).scale < 0.15 && samples.at(-1).opacity < 0.2,
    "the galaxy/universe chart fully retires glare while the additive point remains separate");
});

test("the physical chart Sun shrinks progressively across successive AU doublings", async () => {
  const [{ calculatePlanetHubChartBodyDisplayScale }, zoom, atlasModule] = await Promise.all([
    import("../public/planet-hub-renderer.mjs"),
    import("../public/planet-hub-zoom.mjs"),
    import("../public/celestial-atlas-runtime.mjs")
  ]);
  const {
    PLANET_HUB_DISTANCE_METERS,
    PLANET_HUB_DISTANCE_STOPS,
    planetHubZoomDistanceToProgress,
    resolvePlanetHubRepresentedDistance
  } = zoom;
  const verticalFovDegrees = 42;
  const viewportHeight = 720;
  const minimumCameraRadius = 4.5;
  const chartSunRadius = 2.6;
  const focalLengthPixels = viewportHeight
    / (2 * Math.tan(verticalFovDegrees * Math.PI / 360));

  const samples = [2, 4, 8, 16].map((distanceAu) => {
    const distanceMeters = distanceAu * PLANET_HUB_DISTANCE_METERS.au;
    const progress = planetHubZoomDistanceToProgress(distanceMeters);
    const represented = resolvePlanetHubRepresentedDistance(progress);
    const physicalWorldRadius = chartSunRadius
      * PLANET_HUB_DISTANCE_STOPS.planet
      * minimumCameraRadius
      / represented.metersPerUnit;
    const cameraDistance = minimumCameraRadius * represented.localDollyFactor;
    const solarDetailOpacity = atlasModule.resolveCelestialAtlasPresentation({
      representedDistanceMeters: distanceMeters
    }).solarDetailOpacity;
    const displayScale = calculatePlanetHubChartBodyDisplayScale({
      bodyId: "sun",
      physicalWorldRadius,
      cameraDistance,
      verticalFovDegrees,
      viewportWidth: 1280,
      viewportHeight,
      progress,
      solarDetailOpacity
    });
    assert.equal(displayScale, 1, "the physical sphere receives no chart pixel rescue");
    return {
      distanceAu,
      diameterPixels: 2 * physicalWorldRadius * focalLengthPixels
        / cameraDistance * displayScale
    };
  });

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    assert.ok(current.diameterPixels < previous.diameterPixels,
      `doubling from ${previous.distanceAu} to ${current.distanceAu} AU must shrink the Sun`);
    assert.ok(Math.abs(current.diameterPixels / previous.diameterPixels - 0.5) < 1e-9,
      "physical projection halves with each far-field distance doubling");
  }
  assert.ok(Math.abs(samples.at(-1).diameterPixels / samples[0].diameterPixels - 0.125) < 1e-9,
    "three doublings reduce the solid Sun to one eighth with no pixel floor");
});

test("Sun effects module remains small and free of renderer ownership", async () => {
  const source = await readFile(new URL("../public/planet-hub-sun-effects.mjs", import.meta.url), "utf8");
  assert.ok(Buffer.byteLength(source) < 24_000);
  assert.doesNotMatch(source, /WebGLRenderer|EffectComposer|UnrealBloomPass|requestAnimationFrame/);
  assert.match(source, /createPlanetHubSunEffectsRig/);
});
