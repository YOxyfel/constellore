import assert from "node:assert/strict";
import test from "node:test";

import {
  CELESTIAL_COSMOLOGY_DISTANCE_POLICY,
  CELESTIAL_COSMOLOGY_TIER_DEFINITIONS,
  createCelestialCosmologyData,
  resolveCelestialCosmologyContinuitySnapshot
} from "../public/celestial-cosmology-runtime.mjs";
import {
  PLANET_HUB_COSMIC_DISTANCE_STOPS,
  PLANET_HUB_STANDARD_WHEEL_MULTIPLIER,
  planetHubCosmicZoomDistanceToProgress,
  resolvePlanetHubCosmicRepresentedDistance
} from "../public/planet-hub-zoom.mjs";

const LIGHT_YEAR_METERS = CELESTIAL_COSMOLOGY_DISTANCE_POLICY.metersPerLightYear;
const WHEEL_FACTOR = PLANET_HUB_STANDARD_WHEEL_MULTIPLIER;
const REPORTED_SEAM_LIGHT_YEARS = Object.freeze([
  16_100_000,
  16_208_135.195216126,
  16_300_000,
  19_300_000,
  19_400_000,
  19_500_000
]);

const relativeError = (actual, expected) => Math.abs(actual - expected)
  / Math.max(1, Math.abs(actual), Math.abs(expected));

const nodeById = (snapshot) => new Map(snapshot.nodes.map((node) => [node.id, node]));
const edgeById = (snapshot) => new Map(snapshot.filamentEdges.map((edge) => [edge.id, edge]));

function standardPulseDistances() {
  const minimum = PLANET_HUB_COSMIC_DISTANCE_STOPS.milkyWayBoundary;
  const maximum = PLANET_HUB_COSMIC_DISTANCE_STOPS.observableUniverse;
  const distances = [];
  for (let distance = minimum; distance < maximum; distance *= WHEEL_FACTOR) distances.push(distance);
  distances.push(maximum);
  return distances;
}

function snapshotAt(distanceMeters) {
  const progress = planetHubCosmicZoomDistanceToProgress(distanceMeters);
  const represented = resolvePlanetHubCosmicRepresentedDistance(progress);
  assert.ok(relativeError(represented.distanceMeters, distanceMeters) < 2e-14,
    `zoom resolver reconstructs ${distanceMeters}m`);
  return {
    represented,
    snapshot: resolveCelestialCosmologyContinuitySnapshot({
      distanceMeters,
      metersPerUnit: represented.metersPerUnit,
      seed: 0x636f736d
    })
  };
}

function assertStableUniverse(reference, candidate, context) {
  const referenceNodes = nodeById(reference);
  const candidateNodes = nodeById(candidate);
  assert.deepEqual([...candidateNodes.keys()], [...referenceNodes.keys()],
    `${context}: a zoom pulse cannot replace the node universe`);
  for (const [id, expected] of referenceNodes) {
    const actual = candidateNodes.get(id);
    assert.equal(actual.parentId, expected.parentId, `${context}: ${id} retains its parent`);
    assert.equal(actual.originTierId, expected.originTierId, `${context}: ${id} retains its origin tier`);
    assert.equal(actual.kind, expected.kind, `${context}: ${id} retains its semantic kind`);
    assert.deepEqual(actual.positionLightYears, expected.positionLightYears,
      `${context}: ${id} retains its canonical physical coordinate`);
    assert.equal(actual.brightness, expected.brightness, `${context}: ${id} retains its energy`);
  }

  const referenceEdges = edgeById(reference);
  const candidateEdges = edgeById(candidate);
  assert.deepEqual([...candidateEdges.keys()], [...referenceEdges.keys()],
    `${context}: a zoom pulse cannot replace the filament graph`);
  for (const [id, expected] of referenceEdges) {
    const actual = candidateEdges.get(id);
    assert.equal(actual.fromId, expected.fromId, `${context}: ${id} retains its first endpoint`);
    assert.equal(actual.toId, expected.toId, `${context}: ${id} retains its second endpoint`);
    assert.equal(actual.originTierId, expected.originTierId, `${context}: ${id} retains its origin tier`);
    assert.equal(actual.kind, expected.kind, `${context}: ${id} retains its semantic kind`);
  }
}

test("one canonical cosmic hierarchy survives every standard 1.2x pulse forward and reverse", () => {
  const distances = standardPulseDistances();
  const forward = distances.map(snapshotAt);
  const reverse = [...distances].reverse().map(snapshotAt);
  const reference = forward[0].snapshot;
  const referenceActiveNodes = reference.nodes
    .filter(({ effectiveBrightness }) => effectiveBrightness > 1e-12)
    .map(({ id }) => id);
  const referenceBrightness = reference.totalEffectiveBrightness;
  const referenceEdges = reference.activeEdgeIds;

  for (const [direction, samples] of [["outward", forward], ["inward", reverse]]) {
    for (let index = 0; index < samples.length; index += 1) {
      const { represented, snapshot } = samples[index];
      const context = `${direction} pulse ${index} at ${(snapshot.distanceMeters / LIGHT_YEAR_METERS).toFixed(3)} ly`;
      assertStableUniverse(reference, snapshot, context);
      assert.deepEqual(snapshot.nodes
        .filter(({ effectiveBrightness }) => effectiveBrightness > 1e-12)
        .map(({ id }) => id), referenceActiveNodes,
      `${context}: no unmatched node may be born or die`);
      assert.ok(relativeError(snapshot.totalEffectiveBrightness, referenceBrightness) < 1e-14,
        `${context}: aggregate luminosity is conserved`);
      assert.deepEqual(snapshot.activeEdgeIds, referenceEdges,
        `${context}: filaments remain the same spatial graph`);

      const nodes = nodeById(snapshot);
      for (const edge of snapshot.filamentEdges) {
        assert.ok(nodes.has(edge.fromId), `${context}: ${edge.id} has a stable first endpoint`);
        assert.ok(nodes.has(edge.toId), `${context}: ${edge.id} has a stable second endpoint`);
        assert.ok(edge.effectiveOpacity >= 0 && edge.effectiveOpacity <= 1,
          `${context}: ${edge.id} has a bounded reveal`);
      }

      for (const node of snapshot.nodes) {
        if (node.parentId != null) assert.ok(nodes.has(node.parentId),
          `${context}: ${node.id} cannot outlive an absent parent`);
        for (let axis = 0; axis < 3; axis += 1) {
          const canonical = node.localPosition[axis] * represented.metersPerUnit / LIGHT_YEAR_METERS;
          assert.ok(relativeError(canonical, node.positionLightYears[axis]) < 2e-14,
            `${context}: ${node.id} local projection rebases without moving its canonical coordinate`);
        }
      }
    }
  }

  for (let index = 0; index < forward.length; index += 1) {
    const outward = forward[index].snapshot;
    const inward = reverse[reverse.length - 1 - index].snapshot;
    assert.deepEqual(inward, outward,
      `reverse navigation exactly retraces forward state at ${outward.distanceMeters / LIGHT_YEAR_METERS} ly`);
  }
});

test("aggregate nodes occupy the exact luminosity-weighted centroid of their persistent children", () => {
  const snapshot = snapshotAt(19_400_000 * LIGHT_YEAR_METERS).snapshot;
  const nodes = nodeById(snapshot);
  const childrenByParent = new Map();
  for (const node of snapshot.nodes) {
    if (!node.parentId) continue;
    const children = childrenByParent.get(node.parentId) || [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }
  for (const aggregate of snapshot.nodes.filter(({ kind }) => kind === "aggregate")) {
    const children = childrenByParent.get(aggregate.id) || [];
    assert.ok(children.length > 0, `${aggregate.id} owns persistent children`);
    const childBrightness = children.reduce((sum, child) => sum + child.brightness, 0);
    assert.ok(relativeError(aggregate.brightness, childBrightness) < 1e-14,
      `${aggregate.id} conserves its children's luminosity`);
    for (let axis = 0; axis < 3; axis += 1) {
      const centroid = children.reduce((sum, child) => (
        sum + child.positionLightYears[axis] * child.brightness
      ), 0) / childBrightness;
      assert.ok(relativeError(aggregate.positionLightYears[axis], centroid) < 2e-14,
        `${aggregate.id} collapses at its children's exact axis-${axis} centroid`);
    }
  }
  assert.equal(nodes.get("aggregate:local-group").parentId, "aggregate:nearby-groups");
  assert.equal(nodes.get("aggregate:nearby-groups").parentId, "aggregate:supercluster");
  assert.equal(nodes.get("aggregate:supercluster").parentId, "aggregate:cosmic-web");
  assert.equal(nodes.get("aggregate:cosmic-web").parentId, "aggregate:observable-universe");
});

test("reported 16.2 and 19.4 Mly seams preserve identity, brightness, graph, and inverse-distance projection", () => {
  const exactRebaseLightYears = 203_884 * WHEEL_FACTOR ** 24;
  assert.ok(relativeError(exactRebaseLightYears, REPORTED_SEAM_LIGHT_YEARS[1]) < 1e-14);
  const seamLightYears = [
    ...REPORTED_SEAM_LIGHT_YEARS,
    exactRebaseLightYears * (1 - 1e-10),
    exactRebaseLightYears * (1 + 1e-10)
  ].sort((a, b) => a - b);
  const outward = seamLightYears.map((lightYears) => snapshotAt(lightYears * LIGHT_YEAR_METERS));
  const inward = [...seamLightYears].reverse()
    .map((lightYears) => snapshotAt(lightYears * LIGHT_YEAR_METERS));
  const reference = outward[0].snapshot;
  const referenceNode = nodeById(reference).get("support:local-group:0:0");
  const referenceCanonicalProjection = referenceNode.positionLightYears.map((coordinate) => coordinate);

  for (const [direction, samples] of [["outward", outward], ["inward", inward]]) {
    for (const { represented, snapshot } of samples) {
      const lightYears = snapshot.distanceMeters / LIGHT_YEAR_METERS;
      const context = `${direction} ${lightYears.toFixed(6)} ly seam`;
      assertStableUniverse(reference, snapshot, context);
      assert.equal(snapshot.totalEffectiveBrightness, reference.totalEffectiveBrightness,
        `${context}: luminosity cannot pulse at a seam`);
      assert.deepEqual(snapshot.activeEdgeIds, reference.activeEdgeIds,
        `${context}: a seam cannot replace its filaments`);

      const node = nodeById(snapshot).get(referenceNode.id);
      for (let axis = 0; axis < 3; axis += 1) {
        const projected = node.localPosition[axis] / represented.localDollyFactor;
        const expected = referenceCanonicalProjection[axis] * LIGHT_YEAR_METERS / snapshot.distanceMeters;
        assert.ok(relativeError(projected, expected) < 3e-14,
          `${context}: axis-${axis} follows one inverse-distance trajectory through the rebase`);
      }
    }
  }

  const immediatelyBefore = snapshotAt(exactRebaseLightYears * (1 - 1e-10) * LIGHT_YEAR_METERS);
  const immediatelyAfter = snapshotAt(exactRebaseLightYears * (1 + 1e-10) * LIGHT_YEAR_METERS);
  assert.equal(immediatelyAfter.represented.rebaseIndex, immediatelyBefore.represented.rebaseIndex + 1,
    "16.208135 Mly advances exactly one precision epoch");
  const beforeNode = nodeById(immediatelyBefore.snapshot).get(referenceNode.id);
  const afterNode = nodeById(immediatelyAfter.snapshot).get(referenceNode.id);
  for (let axis = 0; axis < 3; axis += 1) {
    const beforeProjection = beforeNode.localPosition[axis] / immediatelyBefore.represented.localDollyFactor;
    const afterProjection = afterNode.localPosition[axis] / immediatelyAfter.represented.localDollyFactor;
    const expectedRatio = immediatelyBefore.snapshot.distanceMeters / immediatelyAfter.snapshot.distanceMeters;
    assert.ok(relativeError(afterProjection / beforeProjection, expectedRatio) < 3e-14,
      `axis-${axis} crosses the precision epoch without a visual jump`);
  }
});

test("adjacent renderer tiers contain coincident prefixes of one point population and one filament graph", () => {
  const data = createCelestialCosmologyData({ quality: "low", seed: 0x636f736d });
  for (let tierIndex = 1; tierIndex < CELESTIAL_COSMOLOGY_TIER_DEFINITIONS.length; tierIndex += 1) {
    const previousTier = CELESTIAL_COSMOLOGY_TIER_DEFINITIONS[tierIndex - 1];
    const nextTier = CELESTIAL_COSMOLOGY_TIER_DEFINITIONS[tierIndex];
    const previous = data.tiers[previousTier.id];
    const next = data.tiers[nextTier.id];
    assert.deepEqual(next.hierarchyNodeIds, previous.hierarchyNodeIds,
      `${previousTier.id} -> ${nextTier.id} reuses stable hierarchy IDs`);
    assert.deepEqual(next.filamentEdgeIds, previous.filamentEdgeIds,
      `${previousTier.id} -> ${nextTier.id} reuses stable filament IDs`);
    assert.equal(next.positions.length, previous.positions.length,
      `${previousTier.id} -> ${nextTier.id} retains one canonical point buffer length`);
    assert.ok(next.visiblePointBudget >= previous.visiblePointBudget,
      `${nextTier.id} only resolves additional outer points`);
    const inheritedCoordinates = previous.visiblePointBudget * 3;
    for (let index = 0; index < inheritedCoordinates; index += 1) {
      assert.equal(next.positions[index], previous.positions[index],
        `${previousTier.id} -> ${nextTier.id} inherited point ${Math.floor(index / 3)} remains coincident`);
    }
    assert.equal(next.filamentPositions.length, previous.filamentPositions.length);
    for (let index = 0; index < previous.filamentPositions.length; index += 1) {
      assert.equal(next.filamentPositions[index], previous.filamentPositions[index],
        `${previousTier.id} -> ${nextTier.id} filament coordinate ${index} remains coincident`);
    }
  }
});
