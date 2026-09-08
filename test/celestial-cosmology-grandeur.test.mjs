import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  CELESTIAL_COSMOLOGY_DISTANCE_POLICY,
  createCelestialCosmology,
  createCelestialCosmologyData,
  resolveCelestialCosmologyContinuitySnapshot,
  resolveCelestialCosmologyGrandeurSnapshot,
  resolveCelestialCosmologyArtDirection
} from "../public/celestial-cosmology-runtime.mjs";

const LIGHT_YEAR_METERS = CELESTIAL_COSMOLOGY_DISTANCE_POLICY.metersPerLightYear;
const SEED = 0x6772616e;
const LANDMARK_LIGHT_YEARS = Object.freeze([
  16_200_000,
  19_400_000,
  330_000_000,
  1_400_000_000,
  10_000_000_000,
  46_500_000_000
]);

const relativeError = (actual, expected) => Math.abs(actual - expected)
  / Math.max(1, Math.abs(actual), Math.abs(expected));

const snapshotAt = (distanceLightYears, quality = "low") => (
  resolveCelestialCosmologyGrandeurSnapshot({
    distanceMeters: distanceLightYears * LIGHT_YEAR_METERS,
    metersPerUnit: distanceLightYears * LIGHT_YEAR_METERS,
    quality,
    seed: SEED
  })
);

const directChildren = (nodes, parentId) => nodes.filter((node) => node.parentId === parentId);

const colorChannels = (color) => [
  color >>> 16 & 0xff,
  color >>> 8 & 0xff,
  color & 0xff
];

function assertSameStableGeometry(reference, candidate, context) {
  assert.deepEqual(candidate.nodeEnergy.map(({ id }) => id), reference.nodeEnergy.map(({ id }) => id),
    `${context}: the canonical node universe cannot change`);
  assert.deepEqual(candidate.aggregateVolumes.map(({ id, parentId }) => ({ id, parentId })),
    reference.aggregateVolumes.map(({ id, parentId }) => ({ id, parentId })),
    `${context}: aggregate ownership cannot change`);
  assert.deepEqual(candidate.aggregateVolumes.map(({ volumeSampleIds }) => volumeSampleIds),
    reference.aggregateVolumes.map(({ volumeSampleIds }) => volumeSampleIds),
    `${context}: volume samples keep stable IDs`);
  assert.deepEqual(candidate.aggregateVolumes.map(({ volumePositionsLightYears }) => volumePositionsLightYears),
    reference.aggregateVolumes.map(({ volumePositionsLightYears }) => volumePositionsLightYears),
    `${context}: volume samples keep stable canonical coordinates`);
  assert.deepEqual(candidate.filamentAuras.map(({ id, parentEdgeId, fromId, toId, sampleIds }) => ({
    id, parentEdgeId, fromId, toId, sampleIds
  })), reference.filamentAuras.map(({ id, parentEdgeId, fromId, toId, sampleIds }) => ({
    id, parentEdgeId, fromId, toId, sampleIds
  })), `${context}: the shared filament graph cannot be regenerated`);
  assert.deepEqual(candidate.filamentAuras.map(({ controlPointsLightYears, positionsLightYears }) => ({
    controlPointsLightYears, positionsLightYears
  })), reference.filamentAuras.map(({ controlPointsLightYears, positionsLightYears }) => ({
    controlPointsLightYears, positionsLightYears
  })), `${context}: filament curves keep stable canonical geometry`);
  assert.deepEqual(candidate.horizon.sampleIds, reference.horizon.sampleIds,
    `${context}: horizon samples keep stable IDs`);
  assert.deepEqual(candidate.horizon.positionsLightYears, reference.horizon.positionsLightYears,
    `${context}: the physical horizon cannot be regenerated while zooming`);
}

test("grandeur LOD retains the exact canonical hierarchy at every requested forward and reverse landmark", () => {
  const data = createCelestialCosmologyData({ quality: "low", seed: SEED });
  const canonicalIdentity = data.hierarchy.nodes.map(({ id, parentId, originTierId, kind, positionLightYears }) => ({
    id, parentId, originTierId, kind, positionLightYears
  }));
  const forward = LANDMARK_LIGHT_YEARS.map((distance) => snapshotAt(distance));
  const reverse = [...LANDMARK_LIGHT_YEARS].reverse().map((distance) => snapshotAt(distance)).reverse();

  for (let index = 0; index < forward.length; index += 1) {
    const distance = LANDMARK_LIGHT_YEARS[index];
    const grandeur = forward[index];
    const continuity = resolveCelestialCosmologyContinuitySnapshot({
      distanceMeters: distance * LIGHT_YEAR_METERS,
      metersPerUnit: distance * LIGHT_YEAR_METERS,
      seed: SEED
    });
    assert.deepEqual(continuity.nodes.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      originTierId: node.originTierId,
      kind: node.kind,
      positionLightYears: node.positionLightYears
    })), canonicalIdentity, `${distance} ly: grandeur cannot replace canonical identity`);
    assert.deepEqual(grandeur.nodeEnergy.map(({ id }) => id), canonicalIdentity.map(({ id }) => id),
      `${distance} ly: every energy allocation belongs to an existing canonical node`);
    assert.deepEqual(reverse[index], grandeur,
      `${distance} ly: inward navigation exactly retraces outward grandeur state`);
    assertSameStableGeometry(forward[0], grandeur, `${distance} ly`);
  }
});

test("every parent-child LOD partition conserves luminosity instead of double-brightening", () => {
  const nodes = createCelestialCosmologyData({ quality: "low", seed: SEED }).hierarchy.nodes;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  for (const distance of LANDMARK_LIGHT_YEARS) {
    const snapshot = snapshotAt(distance);
    const energyById = new Map(snapshot.nodeEnergy.map((energy) => [energy.id, energy]));
    let explicitTotal = 0;
    for (const energy of snapshot.nodeEnergy) {
      const node = nodeById.get(energy.id);
      assert.ok(node, `${distance} ly: ${energy.id} has a canonical owner`);
      assert.ok(energy.incomingBrightness >= 0 && energy.emittedBrightness >= 0,
        `${distance} ly: ${energy.id} cannot create negative light`);
      assert.ok(energy.collapse >= 0 && energy.collapse <= 1,
        `${distance} ly: ${energy.id} has a bounded collapse`);
      explicitTotal += energy.emittedBrightness;
      const children = directChildren(nodes, energy.id);
      if (node.kind === "aggregate") {
        const distributed = children.reduce((sum, child) => (
          sum + energyById.get(child.id).incomingBrightness
        ), 0);
        assert.ok(relativeError(energy.incomingBrightness,
          energy.emittedBrightness + distributed) < 2e-14,
        `${distance} ly: ${energy.id} partitions energy between itself and its direct children`);
        assert.ok(relativeError(energy.emittedBrightness,
          energy.incomingBrightness * energy.collapse) < 2e-14,
        `${distance} ly: ${energy.id} emits exactly its collapsed share`);
      } else {
        assert.equal(children.length, 0);
        assert.ok(relativeError(energy.emittedBrightness, energy.incomingBrightness) < 2e-14,
          `${distance} ly: a leaf emits all light allocated to it`);
      }
    }
    assert.ok(relativeError(snapshot.totalEmittedBrightness, explicitTotal) < 2e-14,
      `${distance} ly: published emitted energy matches the node ledger`);
    assert.ok(relativeError(snapshot.totalEmittedBrightness, snapshot.totalLeafBrightness) < 2e-14,
      `${distance} ly: parent plus children conserve the canonical root luminosity`);
  }
});

test("aggregate grandeur volumes use exact child centroids and covariance without flattening into cards", () => {
  const nodes = createCelestialCosmologyData({ quality: "low", seed: SEED }).hierarchy.nodes;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const snapshot = snapshotAt(1_400_000_000);

  for (const volume of snapshot.aggregateVolumes) {
    const aggregate = nodeById.get(volume.id);
    const children = directChildren(nodes, volume.id);
    const brightness = children.reduce((sum, child) => sum + child.brightness, 0);
    assert.ok(children.length > 1, `${volume.id} derives shape from a real child population`);
    assert.ok(relativeError(brightness, aggregate.brightness) < 2e-14,
      `${volume.id} child luminosity equals aggregate luminosity`);
    const centroid = [0, 0, 0];
    for (const child of children) for (let axis = 0; axis < 3; axis += 1) {
      centroid[axis] += child.positionLightYears[axis] * child.brightness / brightness;
    }
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(relativeError(volume.centroidLightYears[axis], centroid[axis]) < 2e-14,
        `${volume.id} axis ${axis} stays at the luminosity centroid`);
      assert.ok(relativeError(volume.centroidLightYears[axis], aggregate.positionLightYears[axis]) < 2e-14,
        `${volume.id} shares the canonical aggregate position`);
    }

    const covariance = new Array(9).fill(0);
    for (const child of children) {
      const delta = child.positionLightYears.map((value, axis) => value - centroid[axis]);
      for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) {
        covariance[row * 3 + column] += delta[row] * delta[column] * child.brightness / brightness;
      }
    }
    for (let index = 0; index < 9; index += 1) {
      assert.ok(relativeError(volume.covariance[index], covariance[index]) < 3e-14,
        `${volume.id} covariance cell ${index} is child-derived`);
      assert.ok(Number.isFinite(volume.covariance[index]));
    }
    for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) {
      assert.ok(relativeError(volume.covariance[row * 3 + column],
        volume.covariance[column * 3 + row]) < 2e-14,
      `${volume.id} covariance is symmetric`);
    }
    assert.equal(volume.extentLightYears.length, 3);
    assert.ok(volume.extentLightYears.every((extent) => Number.isFinite(extent) && extent > 0));
    assert.ok(volume.extentLightYears[0] >= volume.extentLightYears[1]
      && volume.extentLightYears[1] >= volume.extentLightYears[2],
    `${volume.id} publishes descending 3D principal extents`);
    assert.ok(volume.covariance[0] > 0 && volume.covariance[4] > 0 && volume.covariance[8] > 0,
      `${volume.id} occupies all three physical axes rather than a plane`);
    assert.equal(volume.volumePositionsLightYears.length, volume.volumeSampleIds.length * 3);
    assert.equal(new Set(volume.volumeSampleIds).size, volume.volumeSampleIds.length,
      `${volume.id} volume samples have unique stable IDs`);
    const tierIndex = ["local-group", "nearby-groups", "supercluster", "cosmic-web",
      "observable-universe"].indexOf(volume.tierId);
    assert.equal(volume.volumeSampleIds.length, 1_000 + tierIndex * 500,
      `${volume.id} has enough stable 3D density samples to read at reference scale`);
  }
});

test("filament geometry is stable while complementary core and aura passes reveal continuously", () => {
  const nodes = createCelestialCosmologyData({ quality: "low", seed: SEED }).hierarchy.nodes;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const reference = snapshotAt(330_000_000);
  assert.ok(reference.filamentAuras.some(({ parentEdgeId }) => parentEdgeId),
    "the filament graph publishes stable parent-edge ancestry");

  for (const distance of LANDMARK_LIGHT_YEARS.slice(2)) {
    const snapshot = snapshotAt(distance);
    assert.equal(snapshot.filamentAuras.length, reference.filamentAuras.length);
    for (let index = 0; index < snapshot.filamentAuras.length; index += 1) {
      const aura = snapshot.filamentAuras[index];
      const stable = reference.filamentAuras[index];
      assert.equal(aura.id, stable.id);
      assert.equal(aura.parentEdgeId, stable.parentEdgeId);
      assert.deepEqual(aura.controlPointsLightYears, stable.controlPointsLightYears);
      assert.deepEqual(aura.sampleIds, stable.sampleIds);
      assert.deepEqual(aura.positionsLightYears, stable.positionsLightYears);
      assert.equal(aura.positionsLightYears.length, aura.sampleIds.length * 3);
      assert.equal(new Set(aura.sampleIds).size, aura.sampleIds.length);
      assert.deepEqual(aura.controlPointsLightYears[0], nodeById.get(aura.fromId).positionLightYears);
      assert.deepEqual(aura.controlPointsLightYears[2], nodeById.get(aura.toId).positionLightYears);
      assert.ok(aura.emittedOpacity >= 0 && aura.emittedOpacity <= 1);
      assert.ok(relativeError(aura.coreOpacity, aura.emittedOpacity * 0.2) < 2e-14,
        `${distance} ly/${aura.id}: stable bright core receives its authored share`);
      assert.ok(relativeError(aura.auraOpacity, aura.emittedOpacity * 0.54) < 2e-14,
        `${distance} ly/${aura.id}: stable soft aura receives its authored share`);
    }
  }
});

test("cosmic palette changes continuously instead of crossfading independent canvases", () => {
  const colorKeys = ["deepSpace", "density", "core", "filament", "horizon"];
  let previousAmount = -1;
  for (const distance of LANDMARK_LIGHT_YEARS) {
    const epsilon = distance * 1e-8;
    const before = snapshotAt(distance - epsilon).palette;
    const at = snapshotAt(distance).palette;
    const after = snapshotAt(distance + epsilon).palette;
    assert.ok(at.amount >= previousAmount, `${distance} ly: palette progression is monotonic`);
    previousAmount = at.amount;
    assert.ok(Math.abs(after.amount - before.amount) < 1e-7,
      `${distance} ly: palette amount has no semantic-tier step`);
    for (const key of colorKeys) {
      for (const palette of [before, at, after]) {
        assert.ok(Number.isInteger(palette[key]) && palette[key] >= 0 && palette[key] <= 0xffffff,
          `${key} is a valid deterministic color`);
      }
      const beforeChannels = colorChannels(before[key]);
      const afterChannels = colorChannels(after[key]);
      assert.ok(beforeChannels.every((channel, index) => Math.abs(channel - afterChannels[index]) <= 1),
        `${distance} ly/${key}: quantized RGB changes by at most one channel step across the boundary`);
    }
  }
  const near = snapshotAt(LANDMARK_LIGHT_YEARS[0]).palette;
  const far = snapshotAt(LANDMARK_LIGHT_YEARS.at(-1)).palette;
  assert.ok(far.amount > near.amount + 0.75, "the continuous palette still has a grand far-universe destination");
  assert.notEqual(far.deepSpace, near.deepSpace);
  assert.notEqual(far.density, near.density);
  assert.notEqual(far.filament, near.filament);
});

test("the observable boundary is a physical 45.2 Gly spherical shell, never a screen plane", () => {
  const near = snapshotAt(330_000_000, "standard");
  const far = snapshotAt(46_500_000_000, "standard");
  const { horizon } = far;
  assert.equal(horizon.id, "observable-particle-horizon");
  assert.equal(horizon.geometryKind, "observer-centered-spherical-shell");
  assert.equal(horizon.observerCentered, true);
  assert.equal(horizon.radiusLightYears, 45_200_000_000);
  assert.ok(horizon.thicknessLightYears > 0
    && horizon.thicknessLightYears / horizon.radiusLightYears < 0.02,
  "the last-scattering surface has a thin physical radial extent");
  assert.equal(horizon.sampleIds.length, 4_800);
  assert.equal(horizon.positionsLightYears.length, horizon.sampleIds.length * 3);
  assert.equal(new Set(horizon.sampleIds).size, horizon.sampleIds.length);
  assert.ok(far.horizon.opacity > 0.99);
  assert.ok(near.horizon.opacity < 0.01);

  const minimum = horizon.radiusLightYears - horizon.thicknessLightYears / 2;
  const maximum = horizon.radiusLightYears + horizon.thicknessLightYears / 2;
  let observedMinimum = Infinity;
  let observedMaximum = -Infinity;
  for (let index = 0; index < horizon.positionsLightYears.length; index += 3) {
    const radius = Math.hypot(
      horizon.positionsLightYears[index],
      horizon.positionsLightYears[index + 1],
      horizon.positionsLightYears[index + 2]
    );
    assert.ok(radius >= minimum - 1e-4 && radius <= maximum + 1e-4,
      `horizon sample ${index / 3} lies on the physical shell`);
    observedMinimum = Math.min(observedMinimum, radius);
    observedMaximum = Math.max(observedMaximum, radius);
  }
  assert.ok(observedMinimum < horizon.radiusLightYears - horizon.thicknessLightYears * 0.4);
  assert.ok(observedMaximum > horizon.radiusLightYears + horizon.thicknessLightYears * 0.4);
  assertSameStableGeometry(near, far, "observable shell sweep");
});

test("the runtime renders grandeur as depth-aware 3D points with stable three-pass filaments", () => {
  const cosmology = createCelestialCosmology(THREE, { quality: "low", seed: SEED });
  const { grandeurRoot, grandeurVisuals } = cosmology;
  assert.ok(grandeurRoot?.isGroup, "one persistent grandeur root is publicly auditable");
  assert.equal(grandeurRoot.parent, cosmology.root);
  assert.equal(grandeurRoot.userData.celestialCosmologyGrandeur, true);
  assert.equal(grandeurVisuals.aggregateVisuals.size, 5);
  assert.notEqual(grandeurVisuals.filamentHalo, grandeurVisuals.filamentStrand);
  assert.notEqual(grandeurVisuals.filamentStrand, grandeurVisuals.filamentSpine,
    "filament haze, strand, and bright spine are distinct render passes");
  assert.equal(grandeurVisuals.filamentHalo.geometry, grandeurVisuals.filamentStrand.geometry);
  assert.equal(grandeurVisuals.filamentStrand.geometry, grandeurVisuals.filamentSpine.geometry,
    "all filament passes trace the exact same stable curved sample geometry");
  assert.ok(grandeurVisuals.filamentHalo.material.size > grandeurVisuals.filamentSpine.material.size,
    "the aura is physically broader than its luminous spine");

  const pointVisuals = [];
  const forbiddenPanels = [];
  grandeurRoot.traverse((object) => {
    if (object.isPoints) pointVisuals.push(object);
    if (object.isMesh || object.isSprite || object.isPlane) forbiddenPanels.push(object.name);
  });
  assert.equal(pointVisuals.length, 24,
    "five volume/core pairs, three filament passes, one low-quality point horizon, and ten physical galaxy silhouettes are rendered exactly once");
  assert.deepEqual(forbiddenPanels, [],
    "cosmic grandeur cannot be a plane, sprite card, or screen-aligned mesh");
  for (const object of pointVisuals) {
    assert.equal(object.material.sizeAttenuation, true, `${object.name} shrinks with physical depth`);
    assert.equal(object.material.depthTest, true, `${object.name} participates in 3D occlusion`);
    assert.equal(object.material.depthWrite, false, `${object.name} cannot become an opaque depth panel`);
    assert.equal(object.material.transparent, true);
    assert.equal(object.material.alphaTest, 0, `${object.name} keeps feathered edges during continuous LOD`);
  }
  const { horizon } = grandeurVisuals;
  assert.equal(horizon.isPoints, true);
  assert.equal(horizon.userData.geometryKind, "observer-centered-spherical-shell");
  assert.equal(horizon.userData.observerCentered, true);
  cosmology.setSemanticTier({
    distanceMeters: 46_500_000_000 * LIGHT_YEAR_METERS,
    metersPerUnit: 46_500_000_000 * LIGHT_YEAR_METERS
  });
  assert.ok(horizon.material.opacity >= 0.29,
    "the physical horizon reaches its restrained authored energy at the observable limit");
  assert.ok(grandeurVisuals.filamentHalo.material.opacity > 0,
    "the same interior web persists inside the observable shell");
  cosmology.dispose();
});

test("runtime transfers canonical detail energy complementarily into unresolved grandeur", () => {
  const cosmology = createCelestialCosmology(THREE, { quality: "low", seed: SEED });
  let previousDetailEnergy = 1;
  let previousAggregateEnergy = 0;
  for (const distance of LANDMARK_LIGHT_YEARS) {
    cosmology.setSemanticTier({
      distanceMeters: distance * LIGHT_YEAR_METERS,
      metersPerUnit: distance * LIGHT_YEAR_METERS
    });
    const { detailEnergy, aggregateEnergy, totalVisualEnergy } = cosmology.grandeurRoot.userData;
    assert.ok(Number.isFinite(detailEnergy) && detailEnergy >= 0 && detailEnergy <= 1);
    assert.ok(Number.isFinite(aggregateEnergy) && aggregateEnergy >= 0 && aggregateEnergy <= 1);
    assert.ok(relativeError(detailEnergy + aggregateEnergy, 1) < 2e-14,
      `${distance} ly: detail and unresolved light are exact complements`);
    assert.ok(relativeError(totalVisualEnergy, 1) < 2e-14,
      `${distance} ly: runtime visual luminosity stays bounded rather than double-brightening`);
    assert.ok(detailEnergy <= previousDetailEnergy + 1e-14,
      `${distance} ly: resolved detail retires monotonically as aggregates emerge`);
    assert.ok(aggregateEnergy >= previousAggregateEnergy - 1e-14,
      `${distance} ly: aggregate energy grows monotonically from the same hierarchy`);

    const canonicalPointOpacity = [...cosmology.tierRoots.values()]
      .reduce((sum, record) => sum + record.pointField.material.opacity, 0);
    const art = resolveCelestialCosmologyArtDirection({ distanceMeters: distance * LIGHT_YEAR_METERS });
    assert.ok(relativeError(canonicalPointOpacity / 0.86, detailEnergy * art.detailCarpet) < 2e-14,
      `${distance} ly: generic samples receive the perceptually exposed detail share`);
    for (const record of cosmology.tierRoots.values()) {
      const weight = cosmology.semanticPresentation.weights[record.tier.id];
      assert.ok(relativeError(record.pointField.material.opacity,
        0.86 * weight * detailEnergy * art.detailCarpet) < 2e-14,
        `${distance} ly/${record.tier.id}: alias weight cannot add a second detail universe`);
    }
    previousDetailEnergy = detailEnergy;
    previousAggregateEnergy = aggregateEnergy;
  }
  assert.ok(previousAggregateEnergy > 0.999,
    "at the observable limit unresolved aggregates own the canonical luminosity rather than overlaying it");
  cosmology.dispose();
});

test("all requested seams are differentiable and forward/reverse symmetric at sub-frame deltas", () => {
  for (const distance of LANDMARK_LIGHT_YEARS) {
    const epsilon = distance * 1e-8;
    const outward = [distance - epsilon, distance, distance + epsilon].map((sample) => snapshotAt(sample));
    const inward = [distance + epsilon, distance, distance - epsilon]
      .map((sample) => snapshotAt(sample)).reverse();
    assert.deepEqual(inward, outward, `${distance} ly: reverse sampling exactly retraces forward state`);
    for (let side = 0; side < 2; side += 1) {
      const from = outward[side];
      const to = outward[side + 1];
      assertSameStableGeometry(from, to, `${distance} ly seam side ${side}`);
      assert.ok(relativeError(from.totalEmittedBrightness, to.totalEmittedBrightness) < 2e-14);
      for (let index = 0; index < from.nodeEnergy.length; index += 1) {
        const previous = from.nodeEnergy[index];
        const next = to.nodeEnergy[index];
        assert.equal(previous.id, next.id);
        assert.ok(Math.abs(previous.collapse - next.collapse) < 2e-7,
          `${distance} ly/${previous.id}: collapse has no one-frame step`);
        assert.ok(Math.abs(previous.emittedBrightness - next.emittedBrightness)
          / Math.max(1, from.totalLeafBrightness) < 2e-7,
        `${distance} ly/${previous.id}: emitted energy has no one-frame step`);
        for (let axis = 0; axis < 3; axis += 1) {
          assert.ok(Math.abs(previous.renderPositionLightYears[axis] - next.renderPositionLightYears[axis])
            / Math.max(1, distance) < 2e-7,
          `${distance} ly/${previous.id}: render position follows a continuous morph`);
        }
      }
      for (let index = 0; index < from.filamentAuras.length; index += 1) {
        assert.ok(Math.abs(from.filamentAuras[index].emittedOpacity
          - to.filamentAuras[index].emittedOpacity) < 2e-7,
        `${distance} ly/${from.filamentAuras[index].id}: filament energy has no one-frame step`);
      }
      assert.ok(Math.abs(from.horizon.opacity - to.horizon.opacity) < 2e-7,
        `${distance} ly: horizon enters continuously`);
    }
  }
});
