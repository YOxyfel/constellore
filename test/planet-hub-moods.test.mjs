import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";

import {
  PLANET_HUB_DESTINATION_MOODS,
  PLANET_HUB_MOOD_TRANSITION_MS,
  calculatePlanetHubLightningEnvelope,
  calculatePlanetHubMoodTransitionPhases,
  calculatePlanetHubRoadMood,
  calculatePlanetHubSunDiscVisibility,
  calculatePlanetHubSunLightingRig,
  createPlanetHubDestinationVfx,
  createPlanetHubRoadMaterial,
  createPlanetHubMoodTransition,
  resolvePlanetHubDestinationMood,
  resolvePlanetHubHeroFraming,
  resolvePlanetHubMoodEffects,
  resolvePlanetHubSurfaceHooks,
  retargetPlanetHubMoodTransition,
  samplePlanetHubMoodTransition,
  updatePlanetHubRoadMaterial
} from "../public/planet-hub-moods.mjs";

test("the visible Sun supplies one normalized lighting direction and occlusion contract", () => {
  const rig = calculatePlanetHubSunLightingRig({
    sunPosition: [8, 0, 0],
    planetPosition: [1, 0, 0],
    keyDistance: 4
  });
  assert.deepEqual(rig.direction, [1, 0, 0]);
  assert.deepEqual(rig.keyPosition, [5, 0, 0]);
  assert.deepEqual(rig.targetPosition, [1, 0, 0]);
  assert.equal(rig.physicalDistance, 7);

  const hidden = calculatePlanetHubSunDiscVisibility({
    cameraPosition: [0, 0, 5],
    planetPosition: [0, 0, 0],
    planetRadius: 1,
    sunPosition: [0, 0, -8],
    sunRadius: 0.3
  });
  assert.equal(hidden.visibility, 0);
  assert.equal(hidden.occlusion, 1);
  const visible = calculatePlanetHubSunDiscVisibility({
    cameraPosition: [0, 0, 5],
    planetPosition: [0, 0, 0],
    planetRadius: 1,
    sunPosition: [7, 0, -8],
    sunRadius: 0.3
  });
  assert.ok(visible.visibility > 0.99);
});

test("Earth destinations have distinct geographic cinematic identities", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(PLANET_HUB_DESTINATION_MOODS).map(([key, value]) => [key, {
      region: value.region,
      scene: value.scene
    }])),
    {
      forge: { region: "Europe", scene: "dawn" },
      journey: { region: "Antarctica", scene: "polar-twilight" },
      arena: { region: "North America", scene: "night-storm" }
    }
  );
  const forge = resolvePlanetHubDestinationMood("forge", { quality: "standard" });
  const journey = resolvePlanetHubDestinationMood("journey", { quality: "standard" });
  const arena = resolvePlanetHubDestinationMood("arena", { quality: "standard" });
  assert.notEqual(forge.space.accentColor, journey.space.accentColor);
  assert.notEqual(journey.space.accentColor, arena.space.accentColor);
  assert.ok(forge.atmosphere.horizonHaze > journey.atmosphere.horizonHaze);
  assert.ok(forge.atmosphere.nightOpacity >= 0.18,
    "dawn still preserves restrained city-light detail on Earth's night side");
  assert.ok(journey.atmosphere.nightOpacity > forge.atmosphere.nightOpacity);
  assert.ok(arena.atmosphere.nightOpacity > journey.atmosphere.nightOpacity);
  for (const mood of [forge, journey, arena]) {
    assert.ok(Object.values(mood.vfx).every((value) => value === 0),
      "destination mood must not reintroduce geometry-overlapping structure VFX");
  }
});

test("Earth night lights remain terminator-bound surface readability when effects are off", () => {
  for (const destination of ["forge", "journey", "arena"]) {
    const mood = resolvePlanetHubDestinationMood(destination, {
      worldId: "earth",
      quality: "standard",
      effectsLevel: "off"
    });
    assert.equal(mood.atmosphere.nightOpacity, 0.14);
    assert.equal(mood.atmosphere.cloudOpacity, 0);
  }
  const moon = resolvePlanetHubDestinationMood("forge", {
    worldId: "moon",
    quality: "standard",
    effectsLevel: "off"
  });
  assert.equal(moon.atmosphere.nightOpacity, 0);
});

test("Moon remains airless and never inherits Earth-local weather", () => {
  for (const destination of ["forge", "journey", "arena"]) {
    const mood = resolvePlanetHubDestinationMood(destination, { worldId: "moon", quality: "standard" });
    assert.equal(mood.scene, "airless-night");
    assert.equal(mood.atmosphere.cloudOpacity, 0);
    assert.equal(mood.atmosphere.horizonHaze, 0);
    assert.ok(Object.values(mood.vfx).every((value) => value === 0));
  }
});

test("low, reduced, and off effect tiers stay deterministic and bounded", () => {
  const standard = resolvePlanetHubMoodEffects({ quality: "standard" });
  const low = resolvePlanetHubMoodEffects({ quality: "low" });
  const reduced = resolvePlanetHubMoodEffects({ quality: "standard", reducedMotion: true });
  const off = resolvePlanetHubMoodEffects({ quality: "standard", effectsLevel: "off" });
  assert.equal(standard.effectScale, 1);
  assert.equal(low.effectScale, 0.72);
  assert.equal(reduced.effectScale, 0.32);
  assert.equal(reduced.animated, false);
  assert.equal(off.effectScale, 0);
  assert.equal(off.enabled, false);
  const reducedJourney = resolvePlanetHubDestinationMood("journey", {
    quality: "standard",
    reducedMotion: true
  });
  assert.ok(Object.values(reducedJourney.vfx).every((value) => value === 0));
});

test("destination hero framing is facade-led, responsive, and destination-specific", () => {
  const forge = resolvePlanetHubHeroFraming("forge", { width: 1280, height: 720 });
  const journey = resolvePlanetHubHeroFraming("journey", { width: 1280, height: 720 });
  const arena = resolvePlanetHubHeroFraming("arena", { width: 1280, height: 720 });
  assert.equal(forge.key, "forge-wide");
  assert.equal(journey.key, "journey-wide");
  assert.equal(arena.key, "arena-wide");
  assert.notDeepEqual(forge.normal, journey.normal);
  assert.notDeepEqual(journey.normal, arena.normal);
  assert.ok(forge.position[0] < 0 && journey.position[0] < 0 && arena.position[0] < 0,
    "desktop landmarks reserve right-side negative space for their HTML lockup");
  const phone = resolvePlanetHubHeroFraming("forge", { width: 390, height: 690 });
  assert.equal(phone.position[0], 0, "portrait recenters the site above the lower action region");
  const short = resolvePlanetHubHeroFraming("journey", { width: 667, height: 375 });
  assert.equal(short.key, "journey-short-landscape");
});

test("cinematic phases release, rotate, relight, settle, and reveal in authored order", () => {
  const early = calculatePlanetHubMoodTransitionPhases(0.12);
  const middle = calculatePlanetHubMoodTransitionPhases(0.58);
  const late = calculatePlanetHubMoodTransitionPhases(0.88);
  assert.ok(early.rotation > 0 && early.reveal === 0);
  assert.ok(middle.rotation > middle.settle);
  assert.ok(middle.celestial > middle.reveal);
  assert.ok(late.settle > 0 && late.reveal > 0);
  assert.deepEqual(calculatePlanetHubMoodTransitionPhases(1), {
    progress: 1,
    release: 0,
    rotation: 1,
    celestial: 1,
    settle: 1,
    reveal: 1
  });
  const reduced = calculatePlanetHubMoodTransitionPhases(0.4, { reducedMotion: true });
  assert.equal(reduced.rotation, 0.4);
  assert.equal(reduced.celestial, 0.4);
});

test("mood transitions can retarget from their live sampled state without a color or light snap", () => {
  const forge = resolvePlanetHubDestinationMood("forge", { quality: "standard" });
  const journey = resolvePlanetHubDestinationMood("journey", { quality: "standard" });
  const arena = resolvePlanetHubDestinationMood("arena", { quality: "standard" });
  const first = createPlanetHubMoodTransition({ from: forge, to: journey, startedAt: 100 });
  const midpointTime = 100 + PLANET_HUB_MOOD_TRANSITION_MS * 0.47;
  const midpoint = samplePlanetHubMoodTransition(first, midpointTime);
  const retargeted = retargetPlanetHubMoodTransition({
    transition: first,
    to: arena,
    nowMs: midpointTime
  });
  assert.deepEqual(retargeted.from, midpoint.state);
  const firstRetargetSample = samplePlanetHubMoodTransition(retargeted, midpointTime);
  assert.deepEqual(firstRetargetSample.state, midpoint.state);
  assert.equal(firstRetargetSample.progress, 0);
  const complete = samplePlanetHubMoodTransition(retargeted, midpointTime + PLANET_HUB_MOOD_TRANSITION_MS);
  assert.equal(complete.complete, true);
  assert.equal(complete.state.scene, "night-storm");
});

test("roads favor the active destination, fade on the far side, and freeze under reduced motion", () => {
  const mood = resolvePlanetHubDestinationMood("forge", { quality: "standard" });
  const activeNear = calculatePlanetHubRoadMood({
    roadFrom: "forge",
    roadTo: "journey",
    activeDestination: "forge",
    frontFacing: 1,
    elapsedMs: 210,
    mood
  });
  const inactiveNear = calculatePlanetHubRoadMood({
    roadFrom: "journey",
    roadTo: "arena",
    activeDestination: "forge",
    frontFacing: 1,
    elapsedMs: 210,
    mood
  });
  const far = calculatePlanetHubRoadMood({
    roadFrom: "forge",
    roadTo: "journey",
    activeDestination: "forge",
    frontFacing: -1,
    elapsedMs: 210,
    mood
  });
  assert.ok(activeNear.opacity > inactiveNear.opacity);
  assert.equal(far.opacity, 0);
  const reducedA = calculatePlanetHubRoadMood({
    roadFrom: "forge",
    roadTo: "journey",
    activeDestination: "forge",
    frontFacing: 1,
    elapsedMs: 0,
    mood,
    reducedMotion: true
  });
  const reducedB = calculatePlanetHubRoadMood({
    roadFrom: "forge",
    roadTo: "journey",
    activeDestination: "forge",
    frontFacing: 1,
    elapsedMs: 9000,
    mood,
    reducedMotion: true
  });
  assert.equal(reducedA.opacity, reducedB.opacity);
});

test("road shader performs per-fragment far-side fading and one selective travelling pulse", () => {
  const material = createPlanetHubRoadMaterial(THREE);
  const mood = resolvePlanetHubDestinationMood("arena", { quality: "standard" });
  const state = calculatePlanetHubRoadMood({
    roadFrom: "journey",
    roadTo: "arena",
    activeDestination: "arena",
    frontFacing: 1,
    mood
  });
  assert.equal(updatePlanetHubRoadMaterial(material, state, { elapsedMs: 2500 }), true);
  assert.equal(material.uniforms.uActive.value, 1);
  assert.equal(material.uniforms.uColor.value.getHex(), mood.road.color);
  assert.ok(material.uniforms.uOpacity.value > 0);
  assert.match(material.vertexShader, /vFacing=dot\(radial,viewDirection\)/);
  assert.match(material.fragmentShader, /visibleSide=smoothstep/);
  assert.match(material.fragmentShader, /travelling=pow/);
  updatePlanetHubRoadMaterial(material, state, { elapsedMs: 5000, reducedMotion: true });
  assert.equal(material.uniforms.uMotion.value, 0);
  material.dispose();
});

test("retired structure lightning export remains inert for compatibility", () => {
  const values = Array.from({ length: 2000 }, (_, index) => (
    calculatePlanetHubLightningEnvelope({ elapsedMs: index * 10, seed: 73 })
  ));
  assert.ok(values.every((value) => value === 0),
    "an older renderer cannot revive the removed Arena lightning flash");
  assert.equal(calculatePlanetHubLightningEnvelope({ elapsedMs: 1000, reducedMotion: true }), 0);
  assert.equal(calculatePlanetHubLightningEnvelope({ elapsedMs: 1000, effectsLevel: "reduced" }), 0);
});

test("manifest surface hooks remain optional and source only declared derivatives", () => {
  assert.deepEqual(resolvePlanetHubSurfaceHooks({}, "earth", "low"), {
    clouds: null,
    night: null,
    roughness: null,
    normal: null,
    sunEmissive: null
  });
  const manifest = {
    worlds: {
      earth: {
        tiers: {
          standard: {
            surface: {
              clouds: { url: "clouds.png" },
              nightMap: "night.jpg",
              roughness: "roughness.jpg",
              normalMap: { url: "normal.jpg" }
            }
          }
        }
      }
    }
  };
  assert.deepEqual(resolvePlanetHubSurfaceHooks(manifest, "earth", "standard"), {
    clouds: "clouds.png",
    night: "night.jpg",
    roughness: "roughness.jpg",
    normal: "normal.jpg",
    sunEmissive: null
  });
});

test("generated optional detail tiers resolve per field with quality fallback", async () => {
  const manifest = JSON.parse(await readFile(new URL(
    "../public/art/planet-hub/manifest.json",
    import.meta.url
  ), "utf8"));

  assert.deepEqual(resolvePlanetHubSurfaceHooks(manifest, "earth", "standard"), {
    clouds: "./art/planet-hub/details/earth-clouds-standard.webp",
    night: "./art/planet-hub/details/earth-night-standard.webp",
    roughness: null,
    normal: null,
    sunEmissive: "./art/planet-hub/details/sun-emissive-standard.webp"
  });
  assert.deepEqual(resolvePlanetHubSurfaceHooks(manifest, "earth", "low"), {
    clouds: "./art/planet-hub/details/earth-clouds-low.webp",
    night: "./art/planet-hub/details/earth-night-low.webp",
    roughness: null,
    normal: null,
    sunEmissive: "./art/planet-hub/details/sun-emissive-low.webp"
  });
  for (const tier of ["low", "standard"]) {
    const hooks = resolvePlanetHubSurfaceHooks(manifest, "earth", tier);
    for (const key of ["clouds", "night", "sunEmissive"]) {
      const bytes = await readFile(new URL(
        `../public/${hooks[key].replace(/^\.\//, "")}`,
        import.meta.url
      ));
      assert.ok(bytes.byteLength > 0, `${tier} ${key} must resolve to a generated release asset`);
    }
  }

  const partial = {
    optionalDetails: {
      tiers: {
        standard: {
          earth: { clouds: { url: "clouds-standard.webp" } },
          sun: { emissive: { url: "sun-standard.webp" } }
        },
        low: {
          earth: {
            clouds: { url: "clouds-low.webp" },
            night: { url: "night-low.webp" },
            roughnessMap: { url: "roughness-low.webp" },
            normal: "normal-low.webp"
          },
          sun: { emissive: "sun-low.webp" }
        }
      }
    }
  };
  assert.deepEqual(resolvePlanetHubSurfaceHooks(partial, "earth", "standard"), {
    clouds: "clouds-standard.webp",
    night: "night-low.webp",
    roughness: "roughness-low.webp",
    normal: "normal-low.webp",
    sunEmissive: "sun-standard.webp"
  });
});

test("retired local VFX controller preserves its API without creating geometry", () => {
  const roots = new Map(["forge", "journey", "arena"].map((destination) => [destination, new THREE.Group()]));
  const childCounts = Object.fromEntries([...roots].map(([destination, root]) => [destination, root.children.length]));
  const vfx = createPlanetHubDestinationVfx(THREE, {
    siteRoots: roots,
    worldId: "earth",
    quality: "low"
  });
  assert.equal(vfx.records.size, 0);
  assert.deepEqual(
    Object.fromEntries([...roots].map(([destination, root]) => [destination, root.children.length])),
    childCounts,
    "compatibility construction must not attach planes, rings, clouds, or lightning to a site"
  );
  assert.equal(vfx.update({ destination: "journey", focused: true, nowMs: 1200 }), false);
  const reduced = vfx.setEffects("full", { reducedMotion: true });
  assert.equal(reduced.animated, false);
  assert.equal(vfx.profile, reduced, "the compatibility profile remains synchronized for existing callers");
  assert.equal(vfx.update({ destination: "journey", focused: true, nowMs: 1800 }), false);
  const off = vfx.setEffects("off", { reducedMotion: false });
  assert.equal(off.enabled, false);
  assert.equal(vfx.update({ destination: "journey", focused: true, nowMs: 2200 }), false);
  assert.equal(vfx.dispose(), true);
  assert.equal(vfx.dispose(), false);
});

test("cinematic mood implementation contains no structure-local overlay geometry", async () => {
  const source = await readFile(new URL("../public/planet-hub-moods.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /UnrealBloomPass|EffectComposer|postprocessing/i);
  assert.doesNotMatch(source, /new THREE[.]Points|PointsMaterial/);
  assert.doesNotMatch(source, /castShadow\s*=\s*true|shadowMap[.]enabled\s*=\s*true/);
  assert.doesNotMatch(source, /forge-cinematic-vfx|journey-cinematic-vfx|arena-cinematic-vfx/);
  assert.doesNotMatch(source, /new THREE[.](?:PlaneGeometry|RingGeometry|SphereGeometry)/,
    "mood code must not attach occluding helper geometry to authored landmarks");
});
