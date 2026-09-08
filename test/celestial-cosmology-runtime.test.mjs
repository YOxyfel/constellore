import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  CELESTIAL_COSMOLOGY_ENTRY_TRANSITION,
  CELESTIAL_COSMOLOGY_DISTANCE_POLICY,
  CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG,
  CELESTIAL_COSMOLOGY_TIER_DEFINITIONS,
  CELESTIAL_COSMOLOGY_TIER_IDS,
  CELESTIAL_COSMOLOGY_TRANSITIONS,
  createCelestialCosmology,
  createCelestialCosmologyData,
  resolveCelestialCosmologyContinuitySnapshot,
  resolveCelestialCosmologyEntryOpacity,
  resolveCelestialCosmologyPointSizeScale,
  resolveCelestialCosmologyPresentation,
  resolveCelestialCosmologyWeights
} from "../public/celestial-cosmology-runtime.mjs";
import {
  PLANET_HUB_COSMIC_DISTANCE_STOPS,
  PLANET_HUB_STANDARD_WHEEL_MULTIPLIER,
  planetHubCosmicZoomDistanceToProgress,
  resolvePlanetHubCosmicRepresentedDistance
} from "../public/planet-hub-zoom.mjs";

const LIGHT_YEAR_METERS = CELESTIAL_COSMOLOGY_DISTANCE_POLICY.metersPerLightYear;

const relativeError = (actual, expected) => Math.abs(actual - expected)
  / Math.max(1, Math.abs(actual), Math.abs(expected));

test("cosmology tiers append to the published Milky Way boundary without gaps", () => {
  assert.deepEqual(CELESTIAL_COSMOLOGY_TIER_IDS, [
    "local-group",
    "nearby-groups",
    "supercluster",
    "cosmic-web",
    "observable-universe"
  ]);
  assert.equal(CELESTIAL_COSMOLOGY_TIER_DEFINITIONS[0].minimumLightYears, 203_884);
  assert.equal(CELESTIAL_COSMOLOGY_TIER_DEFINITIONS.at(-1).maximumLightYears, 46_500_000_000);
  for (let index = 1; index < CELESTIAL_COSMOLOGY_TIER_DEFINITIONS.length; index += 1) {
    assert.equal(
      CELESTIAL_COSMOLOGY_TIER_DEFINITIONS[index].minimumLightYears,
      CELESTIAL_COSMOLOGY_TIER_DEFINITIONS[index - 1].maximumLightYears,
      `tier ${index} starts at the previous physical endpoint`
    );
  }
  assert.equal(CELESTIAL_COSMOLOGY_TRANSITIONS.length, CELESTIAL_COSMOLOGY_TIER_IDS.length - 1);
  assert.ok(CELESTIAL_COSMOLOGY_TIER_DEFINITIONS.every(({ pivot }) => pivot && typeof pivot.kind === "string"));
});

test("Milky Way to Local Group handoff lasts fourteen standard wheel pulses", () => {
  assert.ok(CELESTIAL_COSMOLOGY_ENTRY_TRANSITION.wheelPulses >= 13);
  assert.ok(CELESTIAL_COSMOLOGY_ENTRY_TRANSITION.wheelPulses < 14);
  assert.ok(CELESTIAL_COSMOLOGY_TRANSITIONS.every(({ wheelPulses }) => wheelPulses >= 7),
    "every later cosmic handoff also spans several visible 1.2x pulses");
  const start = CELESTIAL_COSMOLOGY_ENTRY_TRANSITION.startLightYears;
  const end = CELESTIAL_COSMOLOGY_ENTRY_TRANSITION.endLightYears;
  assert.equal(resolveCelestialCosmologyEntryOpacity({ distanceMeters: start * LIGHT_YEAR_METERS }), 0);
  assert.equal(resolveCelestialCosmologyEntryOpacity({ distanceMeters: end * LIGHT_YEAR_METERS }), 1);
  assert.ok(Math.abs(resolveCelestialCosmologyEntryOpacity({
    distanceMeters: Math.sqrt(start * end) * LIGHT_YEAR_METERS
  }) - 0.5) < 1e-12);

  let previous = 0;
  let maximumDelta = 0;
  for (let sample = 1; sample <= 4_096; sample += 1) {
    const amount = sample / 4_096;
    const lightYears = Math.exp(Math.log(start) + (Math.log(end) - Math.log(start)) * amount);
    const opacity = resolveCelestialCosmologyEntryOpacity({ distanceMeters: lightYears * LIGHT_YEAR_METERS });
    maximumDelta = Math.max(maximumDelta, opacity - previous);
    assert.ok(opacity >= previous, "cosmology ownership cannot reverse during an outward sweep");
    const reverseOpacity = resolveCelestialCosmologyEntryOpacity({
      distanceMeters: Math.exp(Math.log(end) - (Math.log(end) - Math.log(start)) * (1 - amount))
        * LIGHT_YEAR_METERS
    });
    assert.ok(Math.abs(reverseOpacity - opacity) < 1e-12,
      "the same physical distance has identical inward and outward ownership");
    previous = opacity;
  }
  assert.ok(maximumDelta < 0.0004, "the widened cosmic entry has no one-frame opacity step");
});

test("curated navigation catalog publishes five immutable real-scale anchors per tier", () => {
  assert.equal(CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG.length, 25);
  for (const tierId of CELESTIAL_COSMOLOGY_TIER_IDS) {
    const places = CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG.filter((place) => place.tierId === tierId);
    assert.equal(places.length, 5, `${tierId} exposes a compact five-place navigation set`);
  }
  for (const place of CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG) {
    const tier = CELESTIAL_COSMOLOGY_TIER_DEFINITIONS.find(({ id }) => id === place.tierId);
    assert.equal(Object.isFrozen(place), true);
    assert.equal(Object.isFrozen(place.position), true);
    assert.equal(place.worldIndependent, true);
    assert.equal(place.coordinateFrame, "observer-equatorial-j2000");
    assert.equal(place.position.length, 3);
    assert.ok(place.extent > 0);
    assert.ok(place.recommendedDistanceMeters > 0);
    assert.equal(place.distanceMeters, place.distanceLightYears * LIGHT_YEAR_METERS);
    assert.ok(place.recommendedDistanceMeters / LIGHT_YEAR_METERS >= tier.minimumLightYears,
      `${place.id} frames no nearer than its owning tier`);
    assert.ok(place.recommendedDistanceMeters / LIGHT_YEAR_METERS <= tier.maximumLightYears,
      `${place.id} frames no farther than its owning tier`);
    assert.equal(place.selectable, true);
    assert.equal(place.visitable, true);
  }
  const cmb = CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG.find(({ id }) => id === "cmb-last-scattering");
  assert.equal(cmb.observerCentered, true);
  assert.deepEqual(cmb.position, [0, 0, 0]);
  assert.equal(cmb.kind, "observer-surface");
  assert.deepEqual(
    CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG
      .filter(({ tierId }) => tierId === "local-group")
      .map(({ id }) => id),
    ["milky-way-home", "large-magellanic-cloud", "small-magellanic-cloud", "andromeda", "triangulum"]
  );
  assert.equal(CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG.find(({ id }) => id === "laniakea").distanceMeaning,
    "contains-observer");
  assert.equal(CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG.find(({ id }) => id === "pisces-cetus-complex").positionApproximate,
    true);
});

test("distance-keyed LOD weights contain only adjacent roots and always sum to one", () => {
  for (let sample = 0; sample <= 2000; sample += 1) {
    const minimum = Math.log(203_884);
    const maximum = Math.log(46_500_000_000);
    const distanceLightYears = Math.exp(minimum + (maximum - minimum) * sample / 2000);
    const weights = resolveCelestialCosmologyWeights({
      distanceMeters: distanceLightYears * LIGHT_YEAR_METERS
    });
    const active = CELESTIAL_COSMOLOGY_TIER_IDS.filter((id) => weights[id] > 1e-12);
    assert.ok(active.length >= 1 && active.length <= 2, `sample ${sample} has one or two owners`);
    if (active.length === 2) {
      assert.equal(
        CELESTIAL_COSMOLOGY_TIER_IDS.indexOf(active[1]) - CELESTIAL_COSMOLOGY_TIER_IDS.indexOf(active[0]),
        1,
        `sample ${sample} crossfades adjacent roots only`
      );
    }
    assert.ok(Math.abs(Object.values(weights).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  }
  const boundary = CELESTIAL_COSMOLOGY_TRANSITIONS[0].midpointLightYears * LIGHT_YEAR_METERS;
  const animated = resolveCelestialCosmologyWeights({ distanceMeters: boundary });
  assert.ok(Math.abs(animated["local-group"] - 0.5) < 1e-12);
  assert.ok(Math.abs(animated["nearby-groups"] - 0.5) < 1e-12);
  const reduced = resolveCelestialCosmologyWeights({ distanceMeters: boundary, reducedMotion: true });
  assert.equal(Object.values(reduced).filter((weight) => weight > 0).length, 1);
  assert.equal(reduced["nearby-groups"], 1);
});

test("cosmology prewarms each adjacent owner before the first visible filament", () => {
  const first = CELESTIAL_COSMOLOGY_TRANSITIONS[0];
  const presentation = resolveCelestialCosmologyPresentation({
    distanceMeters: first.startLightYears / 1.2 * LIGHT_YEAR_METERS
  });
  assert.equal(presentation.weights["nearby-groups"], 0);
  assert.deepEqual(presentation.activeTierIds, ["local-group"]);
  assert.deepEqual(presentation.prewarmTierIds, ["nearby-groups"]);

  const cosmology = createCelestialCosmology(THREE, { quality: "low" });
  cosmology.setSemanticTier("nearby-groups");
  const incoming = cosmology.tierRoots.get("nearby-groups");
  const outgoing = cosmology.tierRoots.get("local-group");
  const fullFilamentCount = incoming.filaments.geometry.getAttribute("position").count;
  cosmology.setSemanticTier({
    distanceMeters: first.startLightYears / 1.2 * LIGHT_YEAR_METERS
  });
  assert.equal(incoming.root.visible, true);
  assert.equal(incoming.pointField.material.opacity, 0);
  assert.equal(incoming.pointField.material.size, outgoing.pointField.material.size,
    "an invisible semantic alias prewarms at the same physical size as its coincident owner");
  assert.equal(incoming.filaments.geometry.drawRange.count, fullFilamentCount,
    "the invisible prewarm submits complete geometry so shader compilation cannot pop later");

  cosmology.setSemanticTier({
    distanceMeters: first.startLightYears * 1.3 * LIGHT_YEAR_METERS
  });
  assert.ok(incoming.pointField.material.opacity > 0);
  assert.equal(incoming.pointField.material.size, outgoing.pointField.material.size,
    "opacity reveal cannot give coincident aliases different point diameters");
  assert.equal(incoming.filaments.geometry.drawRange.count, fullFilamentCount,
    "stable topology changes opacity without exposing an arbitrary edge prefix");
  cosmology.dispose();
});

test("procedural low and standard roots are deterministic and quality-bounded", () => {
  const first = createCelestialCosmologyData({ quality: "low", seed: 42 });
  const repeat = createCelestialCosmologyData({ quality: "low", seed: 42 });
  const different = createCelestialCosmologyData({ quality: "low", seed: 43 });
  const standard = createCelestialCosmologyData({ quality: "standard", seed: 42 });
  for (const tierId of CELESTIAL_COSMOLOGY_TIER_IDS) {
    assert.deepEqual(Array.from(first.tiers[tierId].positions), Array.from(repeat.tiers[tierId].positions));
    assert.deepEqual(
      Array.from(first.tiers[tierId].structureCorePositions),
      Array.from(repeat.tiers[tierId].structureCorePositions)
    );
    assert.deepEqual(
      Array.from(first.tiers[tierId].filamentPositions),
      Array.from(repeat.tiers[tierId].filamentPositions)
    );
    assert.ok(standard.tiers[tierId].pointCount > first.tiers[tierId].pointCount);
    assert.deepEqual(
      Array.from(first.tiers[tierId].filamentTracePositions),
      Array.from(repeat.tiers[tierId].filamentTracePositions)
    );
    assert.ok(standard.tiers[tierId].filamentTraceCount >= first.tiers[tierId].filamentTraceCount);
    assert.equal(first.tiers[tierId].anchorCount, 22,
      "every semantic renderer owns the same persistent catalog anchors");
    assert.ok(first.tiers[tierId].structureCoreCount >= 35);
  }
  assert.deepEqual(
    CELESTIAL_COSMOLOGY_TIER_IDS.map((id) => first.tiers[id].pointCount),
    [7_000, 7_000, 7_000, 7_000, 7_000]
  );
  assert.deepEqual(
    CELESTIAL_COSMOLOGY_TIER_IDS.map((id) => standard.tiers[id].pointCount),
    [18_000, 18_000, 18_000, 18_000, 18_000]
  );
  assert.ok(standard.tiers["local-group"].filamentSegmentCount >= 4,
    "the home galaxy connects smoothly to each navigable Local Group neighbour");
  assert.deepEqual(
    CELESTIAL_COSMOLOGY_TIER_IDS.map((id) => standard.tiers[id].filamentTraceCount),
    [10_000, 10_000, 10_000, 10_000, 10_000]
  );
  assert.ok(standard.tiers["observable-universe"].filamentSegmentCount > 150,
    "the horizon tier retains an inner web beneath its last-scattering shell");
  assert.notDeepEqual(
    Array.from(first.tiers["cosmic-web"].positions.slice(0, 12)),
    Array.from(different.tiers["cosmic-web"].positions.slice(0, 12))
  );
});

test("every tier has multi-shell clustered coverage around its default semantic frame", () => {
  const data = createCelestialCosmologyData({ quality: "standard", seed: 99 });
  for (const tier of CELESTIAL_COSMOLOGY_TIER_DEFINITIONS) {
    const tierData = data.tiers[tier.id];
    const defaultNativeRadius = Math.sqrt(tier.minimumLightYears * tier.maximumLightYears);
    let framePopulation = 0;
    for (let index = 0; index < tierData.positions.length; index += 3) {
      const radius = Math.hypot(
        tierData.positions[index], tierData.positions[index + 1], tierData.positions[index + 2]
      );
      assert.ok(Number.isFinite(radius), `${tier.id} publishes finite density coordinates`);
      if (radius >= defaultNativeRadius * 0.35 && radius <= defaultNativeRadius * 1.8) {
        framePopulation += 1;
      }
    }
    assert.ok(framePopulation >= 700,
      `${tier.id} keeps a substantial persistent population near its default camera shell`);

    const coreRadii = [];
    for (let index = 0; index < tierData.structureCorePositions.length; index += 3) {
      coreRadii.push(Math.hypot(
        tierData.structureCorePositions[index],
        tierData.structureCorePositions[index + 1],
        tierData.structureCorePositions[index + 2]
      ));
    }
    assert.ok(Math.min(...coreRadii) < defaultNativeRadius * 0.65,
      `${tier.id} has foreground structure before its default frame`);
    assert.ok(Math.max(...coreRadii) > defaultNativeRadius * 1.5,
      `${tier.id} has background structure beyond its default frame`);
    assert.ok(tierData.filamentSegmentCount > tierData.structureCoreCount,
      `${tier.id} connects clustered cores into a substantial filament network`);
  }
});

test("standard tier fields occupy a substantial 2120px default camera frame", () => {
  const data = createCelestialCosmologyData({ quality: "standard", seed: 0x636f736d });
  const camera = new THREE.PerspectiveCamera(28, 2120 / 1272, 0.05, 1_000);
  camera.position.set(0, 0.08, 4.5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const projectedPopulation = (tier, distanceLightYears) => {
    const positions = data.tiers[tier.id].positions;
    const scale = 4.5 / distanceLightYears;
    const projected = new THREE.Vector3();
    let visible = 0;
    let central = 0;
    for (let index = 0; index < positions.length; index += 3) {
      projected.set(
        positions[index] * scale,
        positions[index + 1] * scale,
        positions[index + 2] * scale
      ).project(camera);
      if (Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1
        || projected.z < -1 || projected.z > 1) continue;
      visible += 1;
      if (Math.abs(projected.x) < 0.65 && Math.abs(projected.y) < 0.65) central += 1;
    }
    return { visible, central };
  };

  for (const tier of CELESTIAL_COSMOLOGY_TIER_DEFINITIONS) {
    const distanceLightYears = Math.sqrt(tier.minimumLightYears * tier.maximumLightYears);
    const population = projectedPopulation(tier, distanceLightYears);
    assert.ok(population.visible >= 2_000,
      `${tier.id} has thousands of soft points inside its default viewport`);
    assert.ok(population.central >= 1_000,
      `${tier.id} keeps a dense central structure rather than an edge-only speck`);
  }
  const nearby = CELESTIAL_COSMOLOGY_TIER_DEFINITIONS.find(({ id }) => id === "nearby-groups");
  const reportedSparseFrame = projectedPopulation(nearby, 19_400_000);
  assert.ok(reportedSparseFrame.visible >= 1_500,
    "the reported 19.4 Mly frame is populated across multiple nearby-group shells");
  assert.ok(reportedSparseFrame.central >= 500,
    "the reported 19.4 Mly frame has a substantial center, not one lower-corner knot");
});

test("late semantic tiers are coincident views of one stable hierarchical universe", () => {
  const data = createCelestialCosmologyData({ quality: "low", seed: 73 });
  const local = data.tiers["local-group"];
  for (const tierId of CELESTIAL_COSMOLOGY_TIER_IDS.slice(1)) {
    const tier = data.tiers[tierId];
    assert.deepEqual(tier.hierarchyNodeIds, local.hierarchyNodeIds);
    assert.deepEqual(tier.filamentEdgeIds, local.filamentEdgeIds);
    assert.deepEqual(Array.from(tier.positions), Array.from(local.positions));
    assert.deepEqual(Array.from(tier.structureCorePositions), Array.from(local.structureCorePositions));
    assert.deepEqual(Array.from(tier.anchorPositions), Array.from(local.anchorPositions));
    assert.deepEqual(Array.from(tier.filamentPositions), Array.from(local.filamentPositions));
  }

  const before = resolveCelestialCosmologyContinuitySnapshot({
    distanceMeters: 16_200_000 * LIGHT_YEAR_METERS,
    seed: 73
  });
  const after = resolveCelestialCosmologyContinuitySnapshot({
    distanceMeters: 19_400_000 * LIGHT_YEAR_METERS,
    seed: 73
  });
  assert.deepEqual(
    before.nodes.map(({ id, parentId, positionLightYears }) => ({ id, parentId, positionLightYears })),
    after.nodes.map(({ id, parentId, positionLightYears }) => ({ id, parentId, positionLightYears }))
  );
  assert.deepEqual(before.activeEdgeIds, after.activeEdgeIds);
  assert.equal(before.totalEffectiveBrightness, after.totalEffectiveBrightness);
  const localAggregate = before.nodes.find(({ id }) => id === "aggregate:local-group");
  const nearbyAggregate = before.nodes.find(({ id }) => id === "aggregate:nearby-groups");
  assert.equal(localAggregate.parentId, nearbyAggregate.id,
    "the Local Group remains a child of the larger nearby volume instead of disappearing");
});

test("point sprites preserve one angular trajectory across exact precision rebases", () => {
  const boundaryLightYears = CELESTIAL_COSMOLOGY_DISTANCE_POLICY.legacyMaximumLightYears;
  const wheelFactor = PLANET_HUB_STANDARD_WHEEL_MULTIPLIER;
  const exactRebaseLightYears = boundaryLightYears * wheelFactor ** 24;
  const sampleLightYears = [
    exactRebaseLightYears / wheelFactor,
    exactRebaseLightYears * (1 - 1e-10),
    exactRebaseLightYears,
    exactRebaseLightYears * (1 + 1e-10),
    exactRebaseLightYears * wheelFactor
  ];

  const sample = (distanceLightYears) => {
    const distanceMeters = distanceLightYears * LIGHT_YEAR_METERS;
    const progress = planetHubCosmicZoomDistanceToProgress(distanceMeters);
    const represented = resolvePlanetHubCosmicRepresentedDistance(progress);
    const pointSizeScale = resolveCelestialCosmologyPointSizeScale(represented);
    // In a perspective PointsMaterial shader, nominal pixel diameter is
    // proportional to material.size / camera-space depth. The renderer's
    // camera radius is proportional to localDollyFactor.
    return Object.freeze({
      distanceLightYears,
      represented,
      pointSizeScale,
      nominalAngularSize: pointSizeScale / represented.localDollyFactor
    });
  };

  const outward = sampleLightYears.map(sample);
  const inward = [...sampleLightYears].reverse().map(sample);
  assert.equal(outward[2].represented.rebaseIndex, outward[1].represented.rebaseIndex + 1,
    "the exact 16.208135 Mly sample enters the next precision epoch");
  assert.equal(outward[3].represented.rebaseIndex, outward[2].represented.rebaseIndex,
    "the post-seam sample stays in that epoch");
  assert.equal(resolveCelestialCosmologyPointSizeScale({
    metersPerUnit: boundaryLightYears * LIGHT_YEAR_METERS
  }), 1, "the published Milky Way boundary retains authored sprite calibration");

  for (const [direction, samples] of [["outward", outward], ["inward", inward]]) {
    for (const current of samples) {
      const expectedAngularSize = boundaryLightYears / current.distanceLightYears;
      assert.ok(relativeError(current.nominalAngularSize, expectedAngularSize) < 3e-14,
        `${direction} ${current.distanceLightYears.toFixed(6)} ly follows one inverse-distance point-size curve`);
    }
    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1];
      const current = samples[index];
      const expectedRatio = previous.distanceLightYears / current.distanceLightYears;
      assert.ok(relativeError(current.nominalAngularSize / previous.nominalAngularSize, expectedRatio) < 3e-14,
        `${direction} point size changes only by the intended zoom across sample ${index}`);
    }
  }

  assert.ok(relativeError(
    outward.at(-1).nominalAngularSize / outward[2].nominalAngularSize,
    1 / wheelFactor
  ) < 3e-14, "one standard outward pulse shrinks point sprites by exactly 1/1.2");
  assert.ok(relativeError(
    inward.at(-1).nominalAngularSize / inward[2].nominalAngularSize,
    wheelFactor
  ) < 3e-14, "the reverse pulse retraces that point-size change exactly");
  assert.ok(PLANET_HUB_COSMIC_DISTANCE_STOPS.milkyWayBoundary > 0);
});

test("semantic aliases conserve complete point and filament energy at every late seam", () => {
  const cosmology = createCelestialCosmology(THREE, { quality: "low", seed: 91 });
  const records = [...cosmology.tierRoots.values()];
  const unresolvedPsfSizes = Object.freeze({
    "density-samples": 0.007,
    "procedural-structure-cores": 0.028,
    "catalog-anchors": 0.038,
    "survey-filament-density": 0.005
  });
  const referencePointColor = records[0].pointField.material.color.getHex();
  const referenceTraceColor = records[0].filamentTrace.material.color.getHex();
  for (const record of records) {
    assert.equal(record.pointField.geometry.drawRange.count,
      record.pointField.geometry.getAttribute("position").count,
    `${record.tier.id} submits the complete canonical point population`);
    assert.equal(record.filamentTrace.geometry.drawRange.count,
      record.filamentTrace.geometry.getAttribute("position").count,
    `${record.tier.id} submits the complete canonical filament trace`);
    assert.equal(record.pointField.material.color.getHex(), referencePointColor,
      `${record.tier.id} point alias keeps the canonical color`);
    assert.equal(record.filamentTrace.material.color.getHex(), referenceTraceColor,
      `${record.tier.id} trace alias keeps the canonical color`);
    for (const visual of [record.pointField, record.structureCores, record.anchors, record.filamentTrace]) {
      assert.equal(visual.material.alphaTest, 0,
        `${record.tier.id} ${visual.userData.cosmologyVisualKind} fades continuously from zero ownership`);
    }
  }

  const sampleLightYears = new Set([13_506_800, 16_208_135.195216126, 19_400_000]);
  for (const transition of CELESTIAL_COSMOLOGY_TRANSITIONS) {
    sampleLightYears.add(transition.startLightYears);
    sampleLightYears.add(transition.midpointLightYears);
    sampleLightYears.add(transition.endLightYears);
  }
  for (const distanceLightYears of [...sampleLightYears].sort((a, b) => a - b)) {
    const distanceMeters = distanceLightYears * LIGHT_YEAR_METERS;
    const represented = resolvePlanetHubCosmicRepresentedDistance(
      planetHubCosmicZoomDistanceToProgress(distanceMeters)
    );
    const presentation = cosmology.setSemanticTier({
      distanceMeters,
      metersPerUnit: represented.metersPerUnit
    });
    const detailEnergy = cosmology.grandeurRoot.userData.detailEnergy;
    const artDirection = cosmology.grandeurRoot.userData.artDirection;
    const expectedSize = unresolvedPsfSizes["density-samples"] * represented.localDollyFactor;
    let pointOpacity = 0;
    let pointFootprintEnergy = 0;
    let filamentOpacity = 0;
    for (const record of records) {
      assert.ok(relativeError(record.pointField.material.size, expectedSize) < 2e-14,
        `${distanceLightYears} ly: ${record.tier.id} has the shared unresolved PSF diameter`);
      for (const visual of [record.structureCores, record.anchors, record.filamentTrace]) {
        const visualSize = unresolvedPsfSizes[visual.userData.cosmologyVisualKind]
          * represented.localDollyFactor;
        assert.ok(relativeError(visual.material.size, visualSize) < 2e-14,
          `${distanceLightYears} ly: ${record.tier.id} ${visual.userData.cosmologyVisualKind}`
          + " keeps one rebase-continuous emissive PSF");
      }
      pointOpacity += record.pointField.material.opacity;
      pointFootprintEnergy += record.pointField.material.opacity * record.pointField.material.size ** 2;
      filamentOpacity += record.filaments.material.opacity;
      const weight = presentation.weights[record.tier.id];
      if (weight > 1e-12) {
        assert.ok(relativeError(record.pointField.material.opacity / weight,
          0.86 * detailEnergy * artDirection.detailCarpet) < 2e-14,
          `${distanceLightYears} ly: ${record.tier.id} transfers detail light into unresolved aggregates`);
        assert.ok(relativeError(record.filaments.material.opacity / weight,
          0.012 * detailEnergy * artDirection.structureDetail) < 2e-14,
          `${distanceLightYears} ly: ${record.tier.id} transfers survey-filament light into the grandeur web`);
      }
    }
    assert.ok(relativeError(pointOpacity, 0.86 * detailEnergy * artDirection.detailCarpet) < 2e-14,
      `${distanceLightYears} ly: alias weights conserve complementary detail opacity`);
    assert.ok(relativeError(pointFootprintEnergy,
      0.86 * detailEnergy * artDirection.detailCarpet * expectedSize ** 2) < 2e-14,
      `${distanceLightYears} ly: aliases conserve complementary opacity-times-area energy`);
    assert.ok(relativeError(cosmology.grandeurRoot.userData.totalVisualEnergy, 1) < 2e-14,
      `${distanceLightYears} ly: detail and aggregate ledgers sum to one universe`);
    assert.ok(relativeError(filamentOpacity,
      0.012 * detailEnergy * artDirection.structureDetail) < 2e-14,
      `${distanceLightYears} ly: aliases conserve complementary filament opacity`);
  }
  cosmology.dispose();
});

test("cosmology factory exposes stable renderer navigation and semantic-tier APIs", () => {
  let invalidations = 0;
  const cosmology = createCelestialCosmology(THREE, {
    quality: "low",
    seed: 7,
    onInvalidate: () => { invalidations += 1; }
  });
  assert.equal(cosmology.root.userData.noFloorGrid, true);
  assert.equal(cosmology.tierRoots.size, 5);
  const forbiddenFloor = [];
  cosmology.root.traverse((object) => {
    if (/grid|floor/i.test(object.name || "") || object.userData?.noFloorGrid === false) forbiddenFloor.push(object.name);
  });
  assert.deepEqual(forbiddenFloor, []);

  const localVisuals = cosmology.tierRoots.get("local-group");
  assert.equal(localVisuals.pointField.material.sizeAttenuation, true);
  assert.equal(localVisuals.structureCores.material.sizeAttenuation, true);
  assert.equal(localVisuals.anchors.material.sizeAttenuation, true);
  assert.equal(
    localVisuals.anchors.geometry.getAttribute("position").count,
    22,
    "one catalog persists through every semantic resolution"
  );
  assert.equal(localVisuals.filamentTrace.material.sizeAttenuation, true);
  assert.notEqual(localVisuals.pointField.material.map, localVisuals.structureCores.material.map,
    "group cores use a galaxy-shaped impostor while density samples stay round");
  assert.equal(localVisuals.structureCores.material.map, localVisuals.anchors.material.map);
  assert.equal(localVisuals.structureCores.material.map.isDataTexture, true);
  assert.equal(localVisuals.pointField.material.map, localVisuals.filamentTrace.material.map);
  assert.equal(localVisuals.pointField.material.blending, THREE.AdditiveBlending);
  assert.equal(localVisuals.structureCores.material.blending, THREE.AdditiveBlending);
  assert.equal(localVisuals.filamentTrace.material.blending, THREE.AdditiveBlending);
  assert.equal(localVisuals.pointField.material.map.isDataTexture, true);
  assert.ok(localVisuals.pointField.material.size > 0);
  assert.ok(localVisuals.structureCores.material.size > localVisuals.pointField.material.size);
  assert.ok(localVisuals.anchors.material.size > localVisuals.structureCores.material.size);
  assert.equal(
    localVisuals.structureCores.geometry.getAttribute("position").count,
    cosmology.data.tiers["local-group"].structureCoreCount
  );
  assert.equal(localVisuals.filaments.material.depthTest, true);
  assert.equal(localVisuals.filaments.material.blending, THREE.AdditiveBlending);
  assert.ok(localVisuals.filaments.material.opacity < localVisuals.filamentTrace.material.opacity * 0.03,
    "straight survey carriers stay subordinate to soft population traces");
  assert.ok(localVisuals.filamentTrace.geometry.getAttribute("position").count > 0);
  assert.ok(
    cosmology.tierRoots.get("cosmic-web").filamentTrace.geometry.getAttribute("position").count
      === localVisuals.filamentTrace.geometry.getAttribute("position").count,
    "all tiers share one persistent soft filament population"
  );

  const nearby = cosmology.getNavigationPlaces("nearby-groups");
  assert.equal(nearby.length, 5);
  assert.ok(nearby.every(({ tierId }) => tierId === "nearby-groups"));
  assert.ok(nearby.every((place) => !("root" in place) && !("object" in place) && !("anchor" in place)));
  assert.doesNotThrow(() => JSON.stringify(cosmology.getNavigationPlaces()));
  const andromeda = cosmology.getNavigationTarget("andromeda");
  assert.equal(andromeda.id, "andromeda");
  assert.equal(andromeda.position, andromeda.localPosition);
  assert.equal(andromeda.root, cosmology.tierRoots.get("local-group").root);
  assert.equal(andromeda.object, andromeda.anchor);
  assert.equal(andromeda.anchor.parent, andromeda.root);
  assert.equal(cosmology.getNavigationTarget("not-real"), null);
  assert.equal(cosmology.getNavigationTarget("lmc").id, "large-magellanic-cloud");
  assert.equal(cosmology.getNavigationTarget("pisces-cetus").id, "pisces-cetus-complex");

  const selected = cosmology.setSelectedPlace("andromeda");
  assert.equal(selected, andromeda);
  assert.equal(cosmology.selectedPlaceId, "andromeda");
  assert.equal(cosmology.selectionRoot.parent, andromeda.anchor);
  assert.equal(cosmology.setSelectedPlace(null), null);
  assert.equal(cosmology.selectedPlaceId, null);

  const rebaseMetersPerUnit = 100_000 * LIGHT_YEAR_METERS;
  cosmology.setSemanticTier({
    distanceMeters: andromeda.distanceMeters,
    metersPerUnit: rebaseMetersPerUnit
  });
  const rebasedWorldPosition = andromeda.anchor.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(
    rebasedWorldPosition.length() - andromeda.distanceMeters / rebaseMetersPerUnit
  ) < 1e-5, "runtime anchors inherit the active tier's physical rebase scale");

  const web = cosmology.setSemanticTier("cosmic-web");
  assert.equal(web.tierId, "cosmic-web");
  assert.deepEqual(web.activeTierIds, ["cosmic-web"]);
  assert.equal(web.noFloorGrid, true);
  assert.equal(cosmology.getNavigationPlaces({ activeOnly: true }).length, 5);
  const webVisuals = cosmology.tierRoots.get("cosmic-web");
  const fullWebOpacity = webVisuals.pointField.material.opacity;
  assert.equal(cosmology.setTransitionOpacity(0.25), 0.25);
  assert.ok(Math.abs(webVisuals.pointField.material.opacity - fullWebOpacity * 0.25) < 1e-12,
    "the first cosmic tier fades in as the Milky Way fades out instead of becoming a second panel");
  assert.equal(cosmology.transitionOpacity, 0.25);
  cosmology.setTransitionOpacity(1);
  assert.equal(webVisuals.pointField.material.opacity, fullWebOpacity);

  const transitionDistance = CELESTIAL_COSMOLOGY_TRANSITIONS[2].midpointLightYears * LIGHT_YEAR_METERS;
  const crossfade = cosmology.setSemanticTier({
    representedDistanceMeters: transitionDistance,
    metersPerUnit: transitionDistance,
    reducedMotion: false
  });
  assert.deepEqual(crossfade.activeTierIds, ["supercluster", "cosmic-web"]);
  assert.ok(cosmology.tierRoots.get("supercluster").root.visible);
  assert.ok(cosmology.tierRoots.get("cosmic-web").root.visible);
  assert.ok(invalidations >= 4);

  cosmology.dispose();
  assert.equal(cosmology.disposed, true);
  assert.equal(cosmology.root.children.length, 0);
  cosmology.dispose();
});

test("pure presentation remains observer-centered at cosmic scales and honors reduced motion", () => {
  const distanceMeters = 20_000_000_000 * LIGHT_YEAR_METERS;
  const presentation = resolveCelestialCosmologyPresentation({ distanceMeters, reducedMotion: true });
  assert.equal(presentation.tierId, "observable-universe");
  assert.equal(presentation.observerCentered, true);
  assert.equal(presentation.noFloorGrid, true);
  assert.equal(presentation.activeTierIds.length, 1);
});

test("factory rejects incomplete Three implementations", () => {
  assert.throws(() => createCelestialCosmology({}), /THREE[.]Group/);
});
