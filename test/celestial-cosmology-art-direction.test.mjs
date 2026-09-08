import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  CELESTIAL_COSMOLOGY_DISTANCE_POLICY,
  createCelestialCosmology,
  resolveCelestialCosmologyArtDirection,
  resolveCelestialCosmologyGrandeurSnapshot,
  resolveCosmicQualityPolicy
} from "../public/celestial-cosmology-runtime.mjs";

const LY = CELESTIAL_COSMOLOGY_DISTANCE_POLICY.metersPerLightYear;
const artAt = (lightYears) => resolveCelestialCosmologyArtDirection({
  distanceMeters: lightYears * LY
});

test("reference exposure keeps nearby groups while retiring the supercluster detail carpet", () => {
  const nearby = artAt(83_600_000);
  const supercluster = artAt(360_000_000);
  const web = artAt(1_550_000_000);
  assert.equal(nearby.detailCarpet, 1);
  assert.ok(supercluster.detailCarpet < 0.24 && supercluster.filamentGain > 1.1);
  assert.ok(web.detailCarpet < 0.1 && web.volumeGain > supercluster.volumeGain);
  assert.ok(web.filamentGain > 1.25 && web.filamentGain > supercluster.filamentGain);
  assert.ok(web.branchScale > 2 && supercluster.branchScale > 1.6);
});

test("large parent basins begin emitting before their semantic boundary", () => {
  const checkpoints = [
    [330_000_000, "supercluster"],
    [360_000_000, "supercluster"],
    [1_400_000_000, "cosmic-web"],
    [1_550_000_000, "cosmic-web"]
  ];
  const identities = [];
  for (const [distance, tierId] of checkpoints) {
    const snapshot = resolveCelestialCosmologyGrandeurSnapshot({
      distanceMeters: distance * LY, quality: "standard", seed: 0x617274
    });
    const parent = snapshot.aggregateVolumes.find((volume) => volume.tierId === tierId);
    assert.ok(parent.emittedBrightness > 0, `${tierId} emits at ${distance} ly`);
    assert.ok(parent.detailWeight > 0 && parent.collapse > 0);
    identities.push(snapshot.aggregateVolumes.map(({ id, volumeSampleIds }) => ({ id, volumeSampleIds })));
  }
  for (const identity of identities.slice(1)) assert.deepEqual(identity, identities[0]);
  for (const [distance] of checkpoints.toReversed()) {
    const reverse = resolveCelestialCosmologyGrandeurSnapshot({
      distanceMeters: distance * LY, quality: "standard", seed: 0x617274
    });
    const forward = resolveCelestialCosmologyGrandeurSnapshot({
      distanceMeters: distance * LY, quality: "standard", seed: 0x617274
    });
    assert.deepEqual(reverse, forward);
  }
});

test("late observable overview is continuous, reversible, and leaves stable geometry untouched", () => {
  const distances = [30_000_000_000, 36_000_000_000, 40_000_000_000,
    44_000_000_000, 45_200_000_000, 46_500_000_000];
  const forward = distances.map(artAt);
  const reverse = distances.toReversed().map(artAt).reverse();
  assert.deepEqual(reverse, forward);
  for (let index = 1; index < forward.length; index += 1) {
    assert.ok(forward[index].horizonOverview >= forward[index - 1].horizonOverview);
    assert.ok(forward[index].horizonScale <= forward[index - 1].horizonScale);
  }
  assert.equal(forward[0].horizonScale, 1);
  assert.ok(forward.at(-1).horizonScale >= 0.2 && forward.at(-1).horizonScale <= 0.3);

  const cosmology = createCelestialCosmology(THREE, { quality: "standard", seed: 0x617274 });
  const { horizon } = cosmology.grandeurVisuals;
  const geometry = horizon.geometry;
  const snapshotIds = resolveCelestialCosmologyGrandeurSnapshot({
    distanceMeters: distances[0] * LY, quality: "standard", seed: 0x617274
  }).horizon.sampleIds;
  for (const distance of [...distances, ...distances.toReversed()]) {
    cosmology.setSemanticTier({ distanceMeters: distance * LY, metersPerUnit: distance * LY });
    assert.equal(cosmology.grandeurVisuals.horizon, horizon);
    assert.equal(horizon.geometry, geometry);
    assert.deepEqual(cosmology.grandeurRoot.userData.snapshot.horizon.sampleIds, snapshotIds);
  }
  cosmology.setSemanticTier({ distanceMeters: distances.at(-1) * LY,
    metersPerUnit: distances.at(-1) * LY });
  assert.equal(horizon.material.side, THREE.DoubleSide);
  assert.ok(horizon.scale.x >= 0.2 && horizon.scale.x <= 0.3);
  cosmology.dispose();
});

test("cinematic filaments use dense stable samples and splats apodize their elliptical edge", () => {
  const standard = resolveCelestialCosmologyGrandeurSnapshot({
    distanceMeters: 1_550_000_000 * LY, quality: "standard", seed: 0x617274
  });
  const low = resolveCelestialCosmologyGrandeurSnapshot({
    distanceMeters: 1_550_000_000 * LY, quality: "low", seed: 0x617274
  });
  assert.ok(standard.filamentAuras.every((aura) => aura.sampleIds.length === 64 * 3));
  assert.ok(low.filamentAuras.every((aura) => aura.sampleIds.length === 32 * 2));
  const cosmology = createCelestialCosmology(THREE, { quality: "standard", seed: 0x617274 });
  const shader = cosmology.grandeurVisuals.filamentHaze.material.fragmentShader;
  assert.match(shader, /p\.x \/= aspect/);
  assert.match(shader, /edgeApodization/);
  assert.doesNotMatch(shader, /p\.x \*=/);
  cosmology.dispose();
});

test("dense filament subdivisions overlap continuously instead of becoming dotted beads", () => {
  for (const quality of ["standard", "low"]) {
    const snapshot = resolveCelestialCosmologyGrandeurSnapshot({
      distanceMeters: 1_550_000_000 * LY, quality, seed: 0x617274
    });
    const steps = quality === "low" ? 32 : 64;
    const strands = quality === "low" ? 2 : 3;
    for (const aura of snapshot.filamentAuras) {
      const curve = aura.controlPointsLightYears;
      const chord = Math.hypot(...curve[2].map((value, axis) => value - curve[0][axis]));
      for (let strand = 0; strand < strands; strand += 1) {
        let maximumGap = 0;
        for (let step = 1; step < steps; step += 1) {
          const offset = (strand * steps + step) * 3;
          const previous = offset - 3;
          maximumGap = Math.max(maximumGap, Math.hypot(
            aura.positionsLightYears[offset] - aura.positionsLightYears[previous],
            aura.positionsLightYears[offset + 1] - aura.positionsLightYears[previous + 1],
            aura.positionsLightYears[offset + 2] - aura.positionsLightYears[previous + 2]
          ));
        }
        assert.ok(maximumGap / Math.max(1, chord) < (quality === "low" ? 0.04 : 0.022),
          `${quality}/${aura.id}: adjacent samples form a continuous branch`);
      }
    }
  }
});

test("palette is cyan-white at 360 Mly and visibly violet by 1.55 Gly without a seam", () => {
  const paletteAt = (distance) => resolveCelestialCosmologyGrandeurSnapshot({
    distanceMeters: distance * LY, quality: "standard", seed: 0x617274
  }).palette;
  const channels = (hex) => [hex >> 16 & 255, hex >> 8 & 255, hex & 255];
  const supercluster = channels(paletteAt(360_000_000).filament);
  const web = channels(paletteAt(1_550_000_000).filament);
  assert.ok(supercluster[1] > supercluster[0] && supercluster[2] >= supercluster[1]);
  assert.ok(web[2] > web[1] + 35 && web[0] > web[1], "cosmic web has a violet identity");
  const epsilon = 1_550_000_000 * 1e-8;
  const before = channels(paletteAt(1_550_000_000 - epsilon).filament);
  const after = channels(paletteAt(1_550_000_000 + epsilon).filament);
  assert.ok(before.every((value, index) => Math.abs(value - after[index]) <= 1));
});

test("only physical support edges carry the luminous web", () => {
  const cosmology = createCelestialCosmology(THREE, { quality: "standard", seed: 0x617274 });
  cosmology.setSemanticTier({ distanceMeters: 360_000_000 * LY,
    metersPerUnit: 360_000_000 * LY });
  const intensity = cosmology.grandeurVisuals.filamentHaze.geometry.getAttribute("intensity").array;
  const snapshot = cosmology.grandeurRoot.userData.snapshot;
  let cursor = 0;
  for (const aura of snapshot.filamentAuras) {
    const edge = cosmology.data.hierarchy.edges.find(({ id }) => id === aura.id);
    const values = intensity.subarray(cursor, cursor + aura.sampleIds.length);
    const maximum = Math.max(...values);
    if (edge.kind === "aggregate" || edge.kind === "hierarchy") assert.equal(maximum, 0,
      `${edge.kind} connector cannot create a central star polygon`);
    if (edge.kind === "catalog") assert.ok(maximum <= 0.12 + 1e-6);
    if (edge.kind === "structure" && aura.emittedOpacity > 0) assert.ok(maximum > 0);
    cursor += aura.sampleIds.length;
  }
  cosmology.dispose();
});

test("filament ownership fully retires into the active parent at exact QA scales", () => {
  const tierOpacity = (distance) => {
    const snapshot = resolveCelestialCosmologyGrandeurSnapshot({
      distanceMeters: distance * LY, quality: "standard", seed: 0x617274
    });
    return Object.fromEntries(["local-group", "nearby-groups", "supercluster", "cosmic-web"]
      .map((tierId) => {
        const auras = snapshot.filamentAuras.filter((aura) => aura.tierId === tierId);
        return [tierId, auras.reduce((sum, aura) => sum + aura.emittedOpacity, 0) / auras.length];
      }));
  };
  const supercluster = tierOpacity(360_000_000);
  assert.equal(supercluster["local-group"], 0);
  assert.ok(supercluster["nearby-groups"] < 0.001);
  assert.ok(supercluster.supercluster > 0.7);
  const web = tierOpacity(1_550_000_000);
  assert.equal(web["local-group"], 0);
  assert.equal(web["nearby-groups"], 0);
  assert.equal(web.supercluster, 0);
  assert.ok(web["cosmic-web"] > 0.8);
  assert.deepEqual(tierOpacity(360_000_000), supercluster);
  assert.deepEqual(tierOpacity(1_550_000_000), web);
});

test("active parent filaments share the aggregate collapse frame without reviving old tiers", () => {
  const checkpoints = [[360_000_000, "supercluster"], [1_550_000_000, "cosmic-web"]];
  for (const [distance, activeTier] of checkpoints) {
    const snapshot = resolveCelestialCosmologyGrandeurSnapshot({
      distanceMeters: distance * LY, quality: "standard", seed: 0x617274
    });
    const active = snapshot.filamentAuras.filter(({ tierId }) => tierId === activeTier);
    assert.ok(active.every(({ renderScale, emittedOpacity }) => (
      renderScale > 0.7 && renderScale < 0.9 && emittedOpacity > 0.7
    )), `${activeTier} branches fill their entering parent volume`);
    assert.ok(snapshot.filamentAuras.filter(({ tierId }) => tierId !== activeTier)
      .filter(({ emittedOpacity }) => emittedOpacity > 0)
      .every(({ tierId }) => tierId !== "local-group" && tierId !== "nearby-groups"),
    "retired local tiers never overlay the active parent");
    const reverse = resolveCelestialCosmologyGrandeurSnapshot({
      distanceMeters: distance * LY, quality: "standard", seed: 0x617274
    });
    assert.deepEqual(reverse.filamentAuras, snapshot.filamentAuras);
  }

  const cosmology = createCelestialCosmology(THREE, { quality: "standard", seed: 0x617274 });
  cosmology.setSemanticTier({ distanceMeters: 360_000_000 * LY,
    metersPerUnit: 360_000_000 * LY });
  const position = cosmology.grandeurVisuals.filamentHaze.geometry.getAttribute("position");
  const geometry = cosmology.grandeurVisuals.filamentHaze.geometry;
  const snapshot = cosmology.grandeurRoot.userData.snapshot;
  let cursor = 0;
  for (const aura of snapshot.filamentAuras) {
    if (aura.tierId === "supercluster" && aura.emittedOpacity > 0) {
      for (let axis = 0; axis < 3; axis += 1) assert.ok(Math.abs(
        position.array[cursor * 3 + axis]
          - (aura.positionsLightYears[axis] * aura.renderScale + aura.renderOffsetLightYears[axis])
      ) < Math.max(1, Math.abs(position.array[cursor * 3 + axis])) * 1e-6);
      break;
    }
    cursor += aura.sampleIds.length;
  }
  const firstPositions = Float32Array.from(position.array);
  const firstIntensities = Float32Array.from(geometry.getAttribute("intensity").array);
  cosmology.setSemanticTier({ distanceMeters: 1_550_000_000 * LY,
    metersPerUnit: 1_550_000_000 * LY });
  cosmology.setSemanticTier({ distanceMeters: 360_000_000 * LY,
    metersPerUnit: 360_000_000 * LY });
  assert.ok(cosmology.grandeurVisuals.filamentHaze.geometry === geometry,
    "reverse travel keeps the existing filament geometry");
  assert.ok(geometry.getAttribute("position") === position,
    "reverse travel updates the existing position buffer");
  const returnedIntensities = geometry.getAttribute("intensity").array;
  assert.equal(returnedIntensities.length, firstIntensities.length);
  assert.equal(position.array.length, firstPositions.length);
  let luminousSamples = 0;
  for (let sample = 0; sample < firstIntensities.length; sample += 1) {
    assert.equal(returnedIntensities[sample], firstIntensities[sample],
      `filament sample ${sample} returns to its original brightness`);
    // The renderer deliberately leaves retired, dark tiers in their last
    // cached position. Only emitted samples have a visible positional contract;
    // re-entering a tier applies its deterministic affine transform again.
    if (firstIntensities[sample] <= 0) continue;
    luminousSamples += 1;
    for (let axis = 0; axis < 3; axis += 1) {
      const index = sample * 3 + axis;
      assert.equal(position.array[index], firstPositions[index],
        `luminous filament sample ${sample}, axis ${axis} returns to its original position`);
    }
  }
  assert.ok(luminousSamples > 0, "the comparison includes visible parent filaments");
  cosmology.dispose();
});

test("83.6 Mly favors separated nearby galaxy islands over wireframe strands", () => {
  const art = artAt(83_600_000);
  assert.ok(art.nearbyIslandGain > 1.35);
  assert.ok(art.filamentPassGain.strand < 0.3);
  assert.ok(art.filamentPassGain.spine < 0.05);
  const cosmology = createCelestialCosmology(THREE, { quality: "standard", seed: 0x617274 });
  cosmology.setSemanticTier({ distanceMeters: 83_600_000 * LY,
    metersPerUnit: 83_600_000 * LY });
  for (const id of ["ic342-maffei-group", "m81-group", "centaurus-a-group",
    "sculptor-group", "virgo-cluster"]) {
    const group = cosmology.grandeurVisuals.galaxySilhouettes.get(id);
    assert.equal(group.visible, true);
    assert.ok(group.userData.pointSizeFactor >= 4);
    assert.ok(group.material.opacity > 0.8);
    assert.ok(group.geometry.getAttribute("position").count >= 2_600);
  }
  assert.ok(cosmology.grandeurVisuals.filamentStrand.material.opacity
    < cosmology.grandeurVisuals.filamentHaze.material.opacity * 0.5);
  assert.ok(cosmology.grandeurVisuals.filamentSpine.material.opacity
    < cosmology.grandeurVisuals.filamentHaze.material.opacity * 0.08);
  cosmology.dispose();
});

test("effects policy lowers submitted samples and passes without replacing geometry", () => {
  const cosmology = createCelestialCosmology(THREE, { quality: "standard", seed: 0x617274 });
  cosmology.setSemanticTier({ distanceMeters: 1_550_000_000 * LY,
    metersPerUnit: 1_550_000_000 * LY });
  const aura = cosmology.grandeurVisuals.radianceSplats.values().next().value;
  const geometry = aura.geometry;
  const fullCount = geometry.getAttribute("position").count;
  assert.equal(geometry.drawRange.count, fullCount);
  const low = cosmology.setEffectsLevel("low", { devicePixelRatio: 3 });
  assert.equal(low.splatLayers, 2);
  assert.equal(low.visibleFilamentPasses, 2);
  assert.equal(aura.geometry, geometry);
  assert.equal(geometry.drawRange.count, Math.ceil(fullCount / 2));
  assert.equal(cosmology.grandeurVisuals.filamentHaze.visible, false);
  assert.equal(cosmology.grandeurVisuals.filamentStrand.visible, true);
  assert.equal(cosmology.grandeurVisuals.filamentSpine.visible, true);
  const off = cosmology.setEffectsLevel("off");
  assert.equal(off.visibleFilamentPasses, 0);
  assert.equal(cosmology.grandeurVisuals.filamentStrand.visible, false);
  assert.equal(cosmology.grandeurVisuals.filamentSpine.visible, false);
  const full = resolveCosmicQualityPolicy({ quality: "standard", effectsLevel: "full" });
  assert.equal(full.splatLayers, 4);
  cosmology.dispose();
});
