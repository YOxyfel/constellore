import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  CELESTIAL_COSMOLOGY_DISTANCE_POLICY,
  CINEMATIC_FILAMENT_PASSES,
  createCelestialCosmology,
  resolveCelestialCosmologyGrandeurSnapshot,
  resolveCosmicQualityPolicy
} from "../public/celestial-cosmology-runtime.mjs";

const LIGHT_YEAR_METERS = CELESTIAL_COSMOLOGY_DISTANCE_POLICY.metersPerLightYear;
const SEED = 0x63696e65;
const DISTANCES = Object.freeze([
  16_200_000,
  19_400_000,
  330_000_000,
  1_400_000_000,
  10_000_000_000,
  46_500_000_000
]);

const snapshotAt = (distanceLightYears, options = {}) => resolveCelestialCosmologyGrandeurSnapshot({
  distanceMeters: distanceLightYears * LIGHT_YEAR_METERS,
  metersPerUnit: distanceLightYears * LIGHT_YEAR_METERS,
  quality: options.quality || "standard",
  seed: SEED,
  reducedMotion: Boolean(options.reducedMotion)
});

const shaderAttributes = (object) => Object.keys(object.geometry.attributes).sort();

test("cinematic policy scales GPU work while preserving the same physical universe", () => {
  const desktop = resolveCosmicQualityPolicy({
    quality: "standard", effectsLevel: "high", reducedMotion: false, devicePixelRatio: 1.5
  });
  const mobile = resolveCosmicQualityPolicy({
    quality: "low", effectsLevel: "low", reducedMotion: false, devicePixelRatio: 3
  });
  const still = resolveCosmicQualityPolicy({
    quality: "standard", effectsLevel: "high", reducedMotion: true, devicePixelRatio: 2
  });

  for (const policy of [desktop, mobile, still]) {
    assert.ok(Object.isFrozen(policy));
    assert.ok(Number.isInteger(policy.raySteps) && policy.raySteps >= 0);
    assert.ok(Number.isInteger(policy.splatLayers) && policy.splatLayers >= 1);
    assert.equal(policy.filamentPasses, 3, "all qualities keep haze, strand and spine topology");
  }
  assert.ok(desktop.raySteps >= 16 && desktop.raySteps <= 32,
    "desktop analytic density uses the authored 16-32 sample budget");
  assert.ok(mobile.raySteps < desktop.raySteps, "mobile reduces fill-rate before deleting structures");
  assert.ok(mobile.splatLayers <= desktop.splatLayers);
  assert.equal(desktop.animate, true);
  assert.equal(still.animate, false, "reduced motion freezes shimmer rather than changing geometry");
  assert.equal(still.raySteps, desktop.raySteps);
  assert.equal(still.splatLayers, desktop.splatLayers);
});

test("cinematic snapshots retain stable hierarchy and complementary energy", () => {
  const forward = DISTANCES.map((distance) => snapshotAt(distance));
  const reverse = [...DISTANCES].reverse().map((distance) => snapshotAt(distance)).reverse();
  const identity = (snapshot) => ({
    nodes: snapshot.nodeEnergy.map(({ id }) => id),
    volumes: snapshot.aggregateVolumes.map(({ id, parentId }) => ({ id, parentId })),
    filaments: snapshot.filamentAuras.map(({ id, fromId, toId, sampleIds }) => ({
      id, fromId, toId, sampleIds
    })),
    horizon: snapshot.horizon.sampleIds
  });
  const stable = identity(forward[0]);

  for (let index = 0; index < forward.length; index += 1) {
    const snapshot = forward[index];
    assert.deepEqual(identity(snapshot), stable, `${DISTANCES[index]} ly cannot swap populations`);
    assert.deepEqual(snapshot, reverse[index], `${DISTANCES[index]} ly retraces exactly in reverse`);
    const aggregate = snapshot.nodeEnergy.reduce((sum, energy) => (
      energy.collapse > 0 ? sum + energy.emittedBrightness : sum
    ), 0) / snapshot.totalLeafBrightness;
    const detail = 1 - aggregate;
    assert.ok(detail >= 0 && detail <= 1 && aggregate >= 0 && aggregate <= 1);
    assert.ok(Math.abs(detail + aggregate - 1) < 1e-12,
      "cinematic mass receives exactly the energy surrendered by resolved detail");
  }
});

test("three-pass filaments share stable curved geometry and progress haze to white-hot spine", () => {
  assert.deepEqual(CINEMATIC_FILAMENT_PASSES.map(({ id }) => id), ["haze", "strand", "spine"]);
  for (let index = 1; index < CINEMATIC_FILAMENT_PASSES.length; index += 1) {
    assert.ok(CINEMATIC_FILAMENT_PASSES[index - 1].width > CINEMATIC_FILAMENT_PASSES[index].width);
    assert.ok(CINEMATIC_FILAMENT_PASSES[index - 1].sharpness < CINEMATIC_FILAMENT_PASSES[index].sharpness);
  }
});

test("observable boundary remains a physical observer-centered sphere", () => {
  const { horizon } = snapshotAt(46_500_000_000);
  assert.equal(horizon.geometryKind, "observer-centered-spherical-shell");
  assert.equal(horizon.observerCentered, true);
  assert.equal(horizon.radiusLightYears, 45_200_000_000);
  assert.ok(horizon.thicknessLightYears > 0);
});

test("runtime uses one persistent depth-aware shader universe without cards", () => {
  const cosmology = createCelestialCosmology(THREE, { quality: "standard", seed: SEED });
  const { grandeurRoot, grandeurVisuals } = cosmology;
  assert.equal(grandeurRoot.parent, cosmology.root);
  assert.ok(grandeurVisuals.radianceSplats.size > 0);
  assert.ok(grandeurVisuals.volumeVisuals.size > 0);
  assert.ok(grandeurVisuals.filamentHaze);
  assert.ok(grandeurVisuals.filamentStrand);
  assert.ok(grandeurVisuals.filamentSpine);
  assert.equal(grandeurVisuals.filamentHaze.geometry, grandeurVisuals.filamentStrand.geometry);
  assert.equal(grandeurVisuals.filamentStrand.geometry, grandeurVisuals.filamentSpine.geometry);
  assert.ok(grandeurVisuals.galaxySilhouettes.size >= 5);

  const forbidden = [];
  const shaders = [];
  grandeurRoot.traverse((object) => {
    if (object.isSprite || object.userData?.geometryKind === "screen-card"
      || object.userData?.screenAligned === true) forbidden.push(object.name);
    if (object.material?.isShaderMaterial) shaders.push(object);
  });
  assert.deepEqual(forbidden, []);
  assert.ok(shaders.length >= 4, "radiance, volumes, web and horizon use custom shader materials");
  for (const object of grandeurVisuals.radianceSplats.values()) {
    assert.equal(object.material.isShaderMaterial, true);
    assert.deepEqual(shaderAttributes(object), ["color", "intensity", "position", "seed", "size"]);
    assert.equal(object.material.depthTest, true);
    assert.equal(object.material.depthWrite, false);
    assert.match(object.material.vertexShader, /gl_PointSize/);
    assert.match(object.material.fragmentShader, /gl_PointCoord/);
  }

  for (const id of ["milky-way-home", "andromeda", "triangulum",
    "large-magellanic-cloud", "small-magellanic-cloud"]) {
    const galaxy = grandeurVisuals.galaxySilhouettes.get(id);
    assert.ok(galaxy, `${id} has a recognizable procedural silhouette`);
    assert.equal(galaxy.userData.cosmologyNodeId, `catalog:${id}`);
    const expectedMorphology = id === "milky-way-home" ? "barred-spiral"
      : id.includes("magellanic") ? "irregular" : "spiral";
    assert.equal(galaxy.userData.morphology, expectedMorphology);
    assert.notEqual(galaxy.userData.geometryKind, "screen-card");
  }
  for (const id of ["ic342-maffei-group", "m81-group", "centaurus-a-group",
    "sculptor-group", "virgo-cluster"]) {
    const group = grandeurVisuals.galaxySilhouettes.get(id);
    assert.ok(group, `${id} has deterministic separated 3D galaxy islands`);
    assert.equal(group.userData.cosmologyNodeId, `catalog:${id}`);
    assert.equal(group.userData.morphology, "galaxy-group");
    assert.ok(group.userData.islandCount >= 4);
    assert.equal(group.material.depthTest, true);
    assert.equal(group.material.sizeAttenuation, true);
    assert.notEqual(group.userData.geometryKind, "screen-card");
  }

  assert.ok(grandeurVisuals.horizon.isMesh, "standard quality uses a continuous spherical horizon");
  assert.equal(grandeurVisuals.horizon.geometry.type, "SphereGeometry");
  assert.equal(grandeurVisuals.horizon.material.isShaderMaterial, true);
  assert.equal(grandeurVisuals.horizon.userData.observerCentered, true);

  const rootIdentity = grandeurRoot;
  const geometryIdentity = [...grandeurVisuals.radianceSplats.values()].map((object) => object.geometry);
  for (const distance of [...DISTANCES, ...DISTANCES.toReversed()]) {
    cosmology.setSemanticTier({
      distanceMeters: distance * LIGHT_YEAR_METERS,
      metersPerUnit: distance * LIGHT_YEAR_METERS
    });
    assert.equal(cosmology.grandeurRoot, rootIdentity);
    assert.deepEqual([...grandeurVisuals.radianceSplats.values()].map((object) => object.geometry), geometryIdentity,
      `${distance} ly changes uniforms and energy, never the population`);
  }
  cosmology.dispose();
});

test("reduced motion changes time policy only, not stable cinematic geometry", () => {
  const cosmology = createCelestialCosmology(THREE, { quality: "standard", seed: SEED });
  const geometries = [];
  cosmology.grandeurRoot.traverse((object) => {
    if (object.geometry) geometries.push(object.geometry);
  });
  const moving = cosmology.setEffectsLevel("high", { reducedMotion: false, devicePixelRatio: 2 });
  const still = cosmology.setEffectsLevel("high", { reducedMotion: true, devicePixelRatio: 2 });
  const after = [];
  cosmology.grandeurRoot.traverse((object) => {
    if (object.geometry) after.push(object.geometry);
  });
  assert.equal(moving.animate, true);
  assert.equal(still.animate, false);
  assert.deepEqual(after, geometries);
  cosmology.dispose();
});
