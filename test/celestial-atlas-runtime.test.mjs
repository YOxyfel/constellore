import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  CELESTIAL_ATLAS_BODY_DEFINITIONS,
  CELESTIAL_ATLAS_BODY_REGISTRY,
  CELESTIAL_ATLAS_DISTANCE_POLICY,
  CELESTIAL_ATLAS_LOD_POLICY,
  CELESTIAL_ATLAS_NAVIGATION_ALIASES,
  CELESTIAL_ATLAS_NAVIGATION_DESCRIPTORS,
  CELESTIAL_ATLAS_SCALE_POLICY,
  CELESTIAL_ATLAS_UNIT_SCALES,
  CELESTIAL_DEEP_SKY_CATALOG,
  CELESTIAL_DEEP_SKY_CLUSTER_PROFILES,
  CELESTIAL_GALAXY_DISPLAY,
  CELESTIAL_MILKY_WAY_REGION_CATALOG,
  CELESTIAL_NEARBY_STAR_CATALOG,
  CELESTIAL_STELLAR_DISPLAY,
  calculateBodyFocusFit,
  calculateCelestialFocusFit,
  calculateCelestialLayout,
  createCelestialParticulateData,
  createCelestialDeepSkyClusterData,
  createCelestialGalaxyData,
  createCelestialNavigationDescriptors,
  createCelestialStellarNeighborhoodData,
  createCelestialPlanetSurfaceData,
  createCelestialAtlas,
  createCelestialBodyRegistry,
  isCelestialPointOccluded,
  prioritizeCelestialLabels,
  publishPlanetHubPhysicalDiagnostics,
  projectCelestialLabels,
  projectCelestialPoint,
  resolveCelestialAtlasPresentation,
  resolveCelestialNavigationPlaceId
} from "../public/celestial-atlas-runtime.mjs";

const expectedIds = [
  "sun", "mercury", "venus", "earth", "moon",
  "mars", "jupiter", "saturn", "uranus", "neptune"
];

const distance = (left, right) => Math.hypot(
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2]
);

test("query-only physical diagnostics retain the complete live dataset contract", () => {
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.01, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const canvas = { dataset: {} };
  assert.equal(publishPlanetHubPhysicalDiagnostics({
    THREE,
    canvas,
    camera,
    representedDistance: { distanceMeters: CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerAu },
    viewZoom: { band: "system" },
    cosmicZoom: { tier: "local-group" },
    celestialSemanticPresentation: { weights: { solar: 0.75, solarMarker: 0.25 } },
    celestialCosmologyPresentation: { weights: {} },
    physicalSolarChart: true,
    cosmicActive: false,
    cameraOrbitState: { azimuth: 0, polar: Math.PI / 2 },
    sunEffectiveLod: {
      mode: "particle",
      projectedDiameterPixels: 0.2,
      modelOpacity: 0,
      particleOpacity: 1,
      particleOwner: "local-particle",
      glareOpacity: 0
    },
    targetSubject: "earth",
    target: new THREE.Vector3(),
    viewportWidth: 1280,
    viewportHeight: 720
  }), true);
  assert.equal(canvas.dataset.planetHubDistanceLabel, "1.00 AU");
  assert.equal(canvas.dataset.planetHubCameraTargetSubject, "earth");
  assert.equal(canvas.dataset.planetHubProjectedPivotX, "640.00");
  assert.equal(canvas.dataset.planetHubProjectedPivotY, "360.00");
  assert.equal(canvas.dataset.planetHubGridOwner, "solar");
  assert.equal(canvas.dataset.planetHubGridSource, "native-space");
  assert.equal(canvas.dataset.planetHubSunParticleOwner, "local-particle");
  assert.deepEqual(JSON.parse(canvas.dataset.planetHubLayerWeights), {
    planetary: 0,
    solar: 1,
    stellar: 0,
    galactic: 0
  });
});

test("the atlas registry is complete, immutable, and progression-aware", () => {
  assert.deepEqual(CELESTIAL_ATLAS_BODY_DEFINITIONS.map(({ id }) => id), expectedIds);
  assert.deepEqual(Object.keys(CELESTIAL_ATLAS_BODY_REGISTRY), expectedIds);
  for (const body of Object.values(CELESTIAL_ATLAS_BODY_REGISTRY)) {
    assert.equal(typeof body.label, "string");
    assert.ok(body.radius > 0);
    assert.ok(body.focusRadius > body.radius);
    assert.equal(typeof body.selectable, "boolean");
    assert.equal(typeof body.available, "boolean");
    assert.equal(Object.isFrozen(body), true);
  }
  assert.equal(CELESTIAL_ATLAS_BODY_REGISTRY.earth.available, true);
  assert.equal(CELESTIAL_ATLAS_BODY_REGISTRY.mars.available, false);
  assert.equal(CELESTIAL_ATLAS_BODY_REGISTRY.moon.parentId, "earth");
});

test("the atlas publishes explicit rebased physical units for renderer integration", () => {
  const policy = CELESTIAL_ATLAS_SCALE_POLICY;
  assert.ok(policy && typeof policy === "object",
    "chart consumers need structured scale metadata instead of inferring intent from source comments");
  assert.equal(policy.mode, "rebased-physical-units");
  assert.equal(policy.physicallyToScale, true);
  assert.equal(Object.isFrozen(policy), true);
  assert.match(String(policy.disclosure || ""), /radii/i);
  assert.match(String(policy.disclosure || ""), /distance/i);
  assert.match(String(policy.disclosure || ""), /rebased/i);
  assert.equal(CELESTIAL_ATLAS_UNIT_SCALES.solarUnitScale,
    CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerAu / CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters);
  assert.equal(CELESTIAL_ATLAS_UNIT_SCALES.deepUnitScale,
    CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear / CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters);
  assert.equal(CELESTIAL_ATLAS_UNIT_SCALES.galaxyUnitScale,
    CELESTIAL_ATLAS_UNIT_SCALES.deepUnitScale * 1_000);
  assert.equal(CELESTIAL_ATLAS_DISTANCE_POLICY.maximumLightYears, 203_884,
    "the atlas reaches the audited SolarSystemScope outer reference frame");
  assert.equal(CELESTIAL_ATLAS_LOD_POLICY.rootScaleMode, "physical-invariant");
  assert.equal(CELESTIAL_ATLAS_LOD_POLICY.rootScaleExponent, 0);
  assert.equal(CELESTIAL_ATLAS_LOD_POLICY.physicalRootScale, 1);
});

test("the canonical chart profile preserves real relative radii and AU orbit ratios", () => {
  const radii = Object.fromEntries(Object.entries(CELESTIAL_ATLAS_BODY_REGISTRY)
    .map(([id, body]) => [id, body.radius]));
  assert.deepEqual(radii, {
    sun: 54.65,
    mercury: 0.1915,
    venus: 0.4749,
    earth: 0.5,
    moon: 0.1363,
    mars: 0.266,
    jupiter: 5.487,
    saturn: 4.57,
    uranus: 1.99,
    neptune: 1.932
  });
  assert.equal(CELESTIAL_ATLAS_BODY_REGISTRY.earth.orbitRadius, 1);
  assert.equal(CELESTIAL_ATLAS_BODY_REGISTRY.neptune.orbitRadius, 30.061);
  assert.ok(CELESTIAL_ATLAS_BODY_REGISTRY.sun.radius > CELESTIAL_ATLAS_BODY_REGISTRY.jupiter.radius * 9);
  assert.ok(CELESTIAL_ATLAS_BODY_REGISTRY.saturn.ringRadius > CELESTIAL_ATLAS_BODY_REGISTRY.saturn.radius * 2);
});

test("registry overrides never mutate canonical metadata and validate hierarchy", () => {
  const custom = createCelestialBodyRegistry({ overrides: { mars: { available: true, label: "Mars Base" } } });
  assert.equal(custom.mars.available, true);
  assert.equal(custom.mars.label, "Mars Base");
  assert.equal(CELESTIAL_ATLAS_BODY_REGISTRY.mars.available, false);
  assert.throws(() => createCelestialBodyRegistry({
    definitions: [{ ...CELESTIAL_ATLAS_BODY_REGISTRY.earth, parentId: "missing" }]
  }), /Unknown parent/);
});

test("procedural planet surfaces stay deterministic while preserving distinct world identities", () => {
  const mars = createCelestialPlanetSurfaceData(CELESTIAL_ATLAS_BODY_REGISTRY.mars, { width: 64, height: 32 });
  const repeat = createCelestialPlanetSurfaceData(CELESTIAL_ATLAS_BODY_REGISTRY.mars, { width: 64, height: 32 });
  const jupiter = createCelestialPlanetSurfaceData(CELESTIAL_ATLAS_BODY_REGISTRY.jupiter, { width: 64, height: 32 });
  assert.equal(mars.width, 64);
  assert.equal(mars.height, 32);
  assert.equal(mars.data.length, 64 * 32 * 4);
  assert.deepEqual(mars.data, repeat.data);
  assert.notDeepEqual(mars.data, jupiter.data,
    "rocky terrain and gas bands must not collapse into one generic procedural skin");
  assert.equal(createCelestialPlanetSurfaceData(CELESTIAL_ATLAS_BODY_REGISTRY.sun), null);
});

test("quality-bounded particulate data separates the main and Kuiper belts", () => {
  const low = createCelestialParticulateData({ quality: "low", seed: 73 });
  const repeat = createCelestialParticulateData({ quality: "low", seed: 73 });
  const standard = createCelestialParticulateData({ quality: "standard", seed: 73 });
  assert.equal(low.mainCount, 260);
  assert.equal(low.kuiperCount, 150);
  assert.equal(low.count, 410);
  assert.equal(standard.count, 1000);
  assert.deepEqual(low.positions, repeat.positions);
  for (let index = 0; index < low.count; index += 1) {
    const offset = index * 3;
    const radius = Math.hypot(low.positions[offset], low.positions[offset + 2]);
    if (index < low.mainCount) assert.ok(radius >= 2.1 && radius <= 3.3);
    else assert.ok(radius >= 30 && radius <= 50);
  }
});

test("procedural Milky Way data is deterministic, quality-bounded, and contains authored layers", () => {
  const low = createCelestialGalaxyData({ quality: "low", seed: 73 });
  const repeat = createCelestialGalaxyData({ quality: "low", seed: 73 });
  const standard = createCelestialGalaxyData({ quality: "standard", seed: 73 });
  assert.deepEqual(low, repeat);
  assert.deepEqual(low.counts, { spiral: 2400, bulge: 640, dust: 840 });
  assert.equal(low.count, 3880);
  assert.equal(standard.count, 10800);
  assert.equal(low.radius, CELESTIAL_GALAXY_DISPLAY.radius);
  for (const layer of [low.spiral, low.bulge, low.dust]) {
    assert.equal(layer.positions.length, layer.count * 3);
    assert.equal(layer.colors.length, layer.count * 3);
  }
});

test("stellar-neighborhood data is deterministic, bounded, and preserves the named catalogue", () => {
  const low = createCelestialStellarNeighborhoodData({ quality: "low", seed: 73 });
  const repeat = createCelestialStellarNeighborhoodData({ quality: "low", seed: 73 });
  const standard = createCelestialStellarNeighborhoodData({ quality: "standard", seed: 73 });
  assert.deepEqual(low, repeat);
  assert.equal(low.count, 900);
  assert.equal(standard.count, 2200);
  assert.equal(low.positions.length, low.count * 3);
  assert.equal(low.colors.length, low.count * 3);
  assert.equal(low.named.length, CELESTIAL_NEARBY_STAR_CATALOG.length);
  assert.equal(new Set(low.named.map(({ id }) => id)).size, low.named.length);
  for (const star of low.named) {
    assert.ok(star.distanceLy > 0);
    assert.ok(Math.abs(Math.hypot(...star.position) - star.distanceLy) < 1e-10,
      `${star.id} keeps its physical light-year radius`);
    assert.ok(star.distanceLy < CELESTIAL_STELLAR_DISPLAY.radius);
  }
});

test("stellar and deep-sky landmarks use catalogue coordinates and real distance ordering", () => {
  assert.deepEqual(CELESTIAL_DEEP_SKY_CATALOG.map(({ id }) => id), [
    "pleiades", "beehive", "messier-39", "messier-46", "messier-79", "messier-54"
  ]);
  const distances = CELESTIAL_DEEP_SKY_CATALOG.map(({ distanceLightYears }) => distanceLightYears);
  assert.deepEqual(distances, [...distances].sort((left, right) => left - right));
  assert.ok(distances[0] > CELESTIAL_NEARBY_STAR_CATALOG.at(-1).distanceLightYears);
  assert.ok(distances.at(-1) > 80_000);
  for (const entry of [...CELESTIAL_NEARBY_STAR_CATALOG, ...CELESTIAL_DEEP_SKY_CATALOG]) {
    assert.equal(entry.coordinateFrame, "ICRS");
    assert.equal(entry.coordinateEpoch, "J2000");
    assert.equal(entry.coordinateStatus, "catalog-approximate");
    assert.ok(entry.rightAscensionHours >= 0 && entry.rightAscensionHours < 24);
    assert.ok(entry.declinationDegrees >= -90 && entry.declinationDegrees <= 90);
    assert.ok(Math.abs(Math.hypot(...entry.nativePosition) - entry.distanceLightYears) < 1e-8);
    assert.equal(Object.isFrozen(entry.coordinates), true);
  }
});

test("open and globular destinations are deterministic 3D member clouds rather than single fake stars", () => {
  const low = createCelestialDeepSkyClusterData({ quality: "low", seed: 91 });
  const repeat = createCelestialDeepSkyClusterData({ quality: "low", seed: 91 });
  const standard = createCelestialDeepSkyClusterData({ quality: "standard", seed: 91 });
  assert.deepEqual(low, repeat);
  assert.ok(standard.count > low.count);
  assert.equal(low.positions.length, low.count * 3);
  assert.equal(low.colors.length, low.count * 3);
  assert.deepEqual(low.clusters.map(({ id }) => id), CELESTIAL_DEEP_SKY_CATALOG.map(({ id }) => id));
  for (const cluster of standard.clusters) {
    const profile = CELESTIAL_DEEP_SKY_CLUSTER_PROFILES[cluster.id];
    const entry = CELESTIAL_DEEP_SKY_CATALOG.find(({ id }) => id === cluster.id);
    assert.equal(cluster.kind, profile.kind);
    assert.equal(cluster.radiusLightYears, profile.radiusLightYears);
    assert.ok(cluster.count >= 90);
    let maximumRadius = 0;
    for (let index = cluster.start; index < cluster.start + cluster.count; index += 1) {
      const offset = index * 3;
      maximumRadius = Math.max(maximumRadius, Math.hypot(
        standard.positions[offset] - entry.nativePosition[0],
        standard.positions[offset + 1] - entry.nativePosition[1],
        standard.positions[offset + 2] - entry.nativePosition[2]
      ));
    }
    assert.ok(maximumRadius > profile.radiusLightYears * 0.55,
      `${cluster.id} occupies a real navigable volume`);
    assert.ok(maximumRadius <= profile.radiusLightYears * 1.3,
      `${cluster.id} remains inside its approximate physical extent`);
  }
  const deepDescriptors = CELESTIAL_ATLAS_NAVIGATION_DESCRIPTORS
    .filter(({ kind }) => kind === "deep-sky-object");
  for (const descriptor of deepDescriptors) {
    const profile = CELESTIAL_DEEP_SKY_CLUSTER_PROFILES[descriptor.id];
    assert.equal(descriptor.objectKind, profile.kind);
    assert.equal(descriptor.nativeExtent, profile.radiusLightYears);
  }
});

test("navigation descriptors stably cover every solar, stellar, deep-sky, and Milky Way place", () => {
  const descriptors = CELESTIAL_ATLAS_NAVIGATION_DESCRIPTORS;
  const expectedCount = expectedIds.length + CELESTIAL_NEARBY_STAR_CATALOG.length
    + CELESTIAL_DEEP_SKY_CATALOG.length + CELESTIAL_MILKY_WAY_REGION_CATALOG.length;
  assert.equal(descriptors.length, expectedCount);
  assert.equal(new Set(descriptors.map(({ id }) => id)).size, expectedCount);
  assert.equal(Object.isFrozen(descriptors), true);
  assert.deepEqual(new Set(descriptors.map(({ kind }) => kind)), new Set([
    "solar-body", "nearby-star", "deep-sky-object", "milky-way-region"
  ]));
  for (const descriptor of descriptors) {
    assert.equal(Object.isFrozen(descriptor), true);
    assert.ok(descriptor.recommendedDistanceMeters > 0);
    assert.ok(descriptor.nativeExtent > 0);
    assert.ok(["catalog-approximate", "ephemeris-derived", "schematic", "schematic-extent"]
      .includes(descriptor.coordinateStatus));
    if (descriptor.kind === "nearby-star" || descriptor.kind === "deep-sky-object") {
      assert.equal(descriptor.coordinateFrame, "ICRS");
      assert.ok(Number.isFinite(descriptor.rightAscensionHours));
      assert.ok(Number.isFinite(descriptor.declinationDegrees));
    }
    if (descriptor.coordinateStatus.startsWith("schematic")) {
      assert.equal(descriptor.kind, "milky-way-region");
    }
  }
  assert.equal(descriptors.find(({ id }) => id === "galactic-center").coordinateStatus,
    "catalog-approximate");
  const custom = createCelestialNavigationDescriptors({
    registry: createCelestialBodyRegistry({ overrides: { mars: { label: "Mars Base", available: true } } })
  });
  assert.equal(custom.find(({ id }) => id === "mars").label, "Mars Base");
  assert.equal(custom.find(({ id }) => id === "mars").available, true);
  assert.equal(CELESTIAL_ATLAS_NAVIGATION_DESCRIPTORS.find(({ id }) => id === "mars").available, false);
  assert.deepEqual(CELESTIAL_ATLAS_NAVIGATION_ALIASES, {
    "eps-eri": "eps-eridani",
    "rigil-kentaurus": "rigil-kent",
    "galactic-centre": "galactic-center",
    "solar-system": "sun"
  });
  assert.equal(resolveCelestialNavigationPlaceId(" RIGIL-KENTAURUS "), "rigil-kent");
  assert.equal(resolveCelestialNavigationPlaceId("beehive"), "beehive");
});

test("navigation targets expose transform-safe roots even before a distant tier becomes visible", () => {
  const atlas = createCelestialAtlas(THREE, { quality: "low", originBodyId: "earth" });
  assert.equal(atlas.galaxy, null);
  const stellarTarget = atlas.getNavigationTarget("rigil-kent");
  assert.equal(stellarTarget.root, atlas.galaxy.stellarRoot);
  assert.deepEqual(stellarTarget.positionInRoot, stellarTarget.nativePosition);
  assert.equal(stellarTarget.extent, stellarTarget.nativeExtent,
    "focus extents stay in root-local light-years so renderer scaling applies exactly once");
  atlas.root.updateMatrixWorld(true);
  const stellarWorld = stellarTarget.root.localToWorld(
    new THREE.Vector3().fromArray(stellarTarget.positionInRoot)
  );
  assert.ok(stellarWorld.distanceTo(new THREE.Vector3().fromArray(stellarTarget.position)) < 1e-5);
  const regionTarget = atlas.getNavigationTarget("perseus-arm");
  assert.equal(regionTarget.root, atlas.galaxy.galaxyRoot);
  assert.equal(regionTarget.extent, regionTarget.nativeExtent,
    "Milky Way focus extents stay in root-local kilolight-years");
  atlas.root.updateMatrixWorld(true);
  const regionWorld = regionTarget.root.localToWorld(
    new THREE.Vector3().fromArray(regionTarget.positionInRoot)
  );
  assert.ok(regionWorld.distanceTo(new THREE.Vector3().fromArray(regionTarget.position)) < 0.01,
    "kilolight-year rebasing agrees within floating-point precision at trillion-unit coordinates");
  const centreAlias = atlas.getNavigationTarget("galactic-centre");
  assert.equal(centreAlias.id, "galactic-center");
  assert.equal(centreAlias.canonicalId, "galactic-center");
  assert.equal(centreAlias.requestedId, "galactic-centre");
  assert.equal(centreAlias.recommendedDistanceMeters,
    CELESTIAL_ATLAS_DISTANCE_POLICY.maximumLightYears
      * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear,
  "galactic-region Visit enters the visible Milky Way LOD before focusing");
  assert.equal(atlas.getNavigationTarget("solar-system").canonicalId, "sun");
  assert.equal(atlas.getNavigationTarget("eps-eri").canonicalId, "eps-eridani");
  assert.equal(atlas.getNavigationTarget("rigil-kentaurus").canonicalId, "rigil-kent");
  const beehiveTarget = atlas.getNavigationTarget("beehive");
  assert.equal(beehiveTarget.extent, CELESTIAL_DEEP_SKY_CLUSTER_PROFILES.beehive.radiusLightYears,
    "cluster Visit fits the physical member-cloud radius instead of a doubly converted extent");
  assert.equal(atlas.getNavigationTarget("not-a-place"), null);
  atlas.dispose();
});

test("every distant Visit recommendation activates the target's owning physical LOD", () => {
  for (const descriptor of CELESTIAL_ATLAS_NAVIGATION_DESCRIPTORS) {
    if (!["nearby-star", "deep-sky-object", "milky-way-region"].includes(descriptor.kind)) continue;
    const presentation = resolveCelestialAtlasPresentation({
      distanceMeters: descriptor.recommendedDistanceMeters
    });
    const ownerOpacity = descriptor.kind === "nearby-star"
      ? presentation.stellarOpacity
      : descriptor.kind === "deep-sky-object"
        ? presentation.deepSkyOpacity
        : presentation.galaxyOpacity;
    assert.ok(ownerOpacity > 0.1,
      `${descriptor.id} Visit must not focus an intentionally hidden ${descriptor.tier} root`);
  }
});

test("semantic LOD owns one scale at a time with only adjacent physical crossfades", () => {
  const sun = [12, 0, -4];
  const ly = CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear;
  const close = resolveCelestialAtlasPresentation({ band: "system", progress: 0.315, sunPosition: sun });
  const marker = resolveCelestialAtlasPresentation({ distanceMeters: 0.25 * ly, sunPosition: sun });
  const stellarEmergence = resolveCelestialAtlasPresentation({ distanceMeters: 1 * ly, sunPosition: sun });
  const stellar = resolveCelestialAtlasPresentation({ distanceMeters: 4 * ly, sunPosition: sun });
  const deepSky = resolveCelestialAtlasPresentation({ distanceMeters: 1_500 * ly, sunPosition: sun });
  const galacticEmergence = resolveCelestialAtlasPresentation({ distanceMeters: 10_000 * ly, sunPosition: sun });
  const galaxy = resolveCelestialAtlasPresentation({
    distanceMeters: CELESTIAL_ATLAS_DISTANCE_POLICY.maximumLightYears * ly,
    sunPosition: sun
  });
  assert.equal(close.solarDetailOpacity, 1);
  assert.equal(close.solarMarkerOpacity, 0);
  assert.equal(close.stellarOpacity, 0);
  assert.equal(close.galaxyOpacity, 0);
  assert.equal(marker.solarDetailOpacity, 0);
  assert.equal(marker.solarMarkerOpacity, 1);
  assert.equal(marker.stellarOpacity, 0,
    "the solar chart is fully reduced to one marker before nearby stars become readable");
  assert.equal(stellar.solarDetailOpacity, 0);
  assert.equal(stellar.solarMarkerOpacity, 1);
  assert.equal(stellar.stellarOpacity, 1);
  assert.equal(stellar.deepSkyOpacity, 0);
  assert.equal(stellar.galaxyOpacity, 0);
  assert.ok(stellarEmergence.weights.solarMarker > 0 && stellarEmergence.weights.stellar > 0,
    "nearby stars grow from the Solar marker over a physically broad light-year interval");
  assert.equal(deepSky.stellarOpacity, 0);
  assert.equal(deepSky.deepSkyOpacity, 1);
  assert.equal(deepSky.galaxyOpacity, 0);
  assert.ok(galacticEmergence.deepSkyOpacity > 0 && galacticEmergence.galaxyOpacity > 0,
    "the Milky Way grows in place while the deep-sky catalogue recedes");
  assert.equal(galaxy.solarDetailOpacity, 0);
  assert.equal(galaxy.solarMarkerOpacity, 1);
  assert.equal(galaxy.stellarOpacity, 0);
  assert.equal(galaxy.deepSkyOpacity, 0);
  assert.equal(galaxy.galaxyOpacity, 1);
  assert.ok(Math.abs(
    galaxy.rootScales.solarMarker
      / (galaxy.representedDistanceMeters / CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters)
      - 0.006 * 0.35
  ) < 1e-12, "the persistent Solar marker keeps shrinking instead of becoming a constant-size foreground glyph");
  assert.notDeepEqual(galaxy.galacticCenterPosition, sun);
  for (const presentation of [close, marker, stellarEmergence, stellar, deepSky, galacticEmergence, galaxy]) {
    assert.equal(presentation.pivot, "sun");
    assert.deepEqual(presentation.pivotPosition, sun,
      "deep-space LOD changes presentation, never the selected astronomical centre");
    assert.equal(Object.isFrozen(presentation.pivotPosition), true);
  }
});

test("physical atlas handoffs remain visible for many standard 1.2x wheel pulses", () => {
  const distances = CELESTIAL_ATLAS_LOD_POLICY.transitionDistances;
  const auInLightYears = CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerAu
    / CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear;
  const spans = {
    solarToMarker: [distances.solarToMarker.startAu * auInLightYears,
      distances.solarToMarker.endLightYears],
    markerToStellar: [distances.markerToStellar.startLightYears,
      distances.markerToStellar.endLightYears],
    stellarToDeepSky: [distances.stellarToDeepSky.startLightYears,
      distances.stellarToDeepSky.endLightYears],
    deepSkyToMilkyWay: [distances.deepSkyToMilkyWay.startLightYears,
      distances.deepSkyToMilkyWay.endLightYears]
  };
  for (const [name, [start, end]] of Object.entries(spans)) {
    const pulseCount = Math.log(end / start) / Math.log(1.2);
    assert.ok(pulseCount >= 10,
      `${name} lasts ${pulseCount.toFixed(1)} standard 1.2x wheel pulses`);
  }
});

test("dense forward and reverse atlas sweeps grow adjacent geometry at stable coordinates", () => {
  const incomingByTransition = {
    solarToMarker: "solarMarker",
    markerToStellar: "stellar",
    stellarToDeepSky: "deepSky",
    deepSkyToMilkyWay: "milkyWay"
  };
  for (const [name, [start, end]] of Object.entries(CELESTIAL_ATLAS_LOD_POLICY.transitions)) {
    const incoming = incomingByTransition[name];
    let previous = resolveCelestialAtlasPresentation({ progress: start });
    let maximumWeightDelta = 0;
    for (let sample = 1; sample <= 2_048; sample += 1) {
      const progress = start + (end - start) * sample / 2_048;
      const forward = resolveCelestialAtlasPresentation({ progress });
      const reverse = resolveCelestialAtlasPresentation({ progress: end - (end - progress) });
      const delta = Object.keys(forward.weights).reduce((sum, id) =>
        sum + Math.abs(forward.weights[id] - previous.weights[id]), 0);
      maximumWeightDelta = Math.max(maximumWeightDelta, delta);
      assert.ok(Object.keys(forward.weights).every((id) =>
        Math.abs(reverse.weights[id] - forward.weights[id]) < 1e-12),
      `${name} has no direction-dependent ownership state`);
      assert.ok(forward.weights[incoming] + 1e-12 >= previous.weights[incoming],
        `${name} incoming geometry grows monotonically in place`);
      assert.deepEqual(forward.pivotPosition, previous.pivotPosition,
        `${name} never shifts the astronomical pivot during its reveal`);
      previous = forward;
    }
    assert.ok(maximumWeightDelta < 0.0016,
      `${name} has no single-sample opacity jump in a dense sweep`);
  }

  for (const [name, incoming] of Object.entries({
    markerToStellar: "stellar",
    stellarToDeepSky: "deepSky",
    deepSkyToMilkyWay: "milkyWay"
  })) {
    const [start] = CELESTIAL_ATLAS_LOD_POLICY.transitions[name];
    const presentation = resolveCelestialAtlasPresentation({
      progress: start - CELESTIAL_ATLAS_LOD_POLICY.gpuPrewarmLead * 0.5
    });
    assert.equal(presentation.weights[incoming], 0);
    assert.equal(presentation.prewarmRoots[incoming], true,
      `${incoming} is instantiated before its first visible pixel`);
    assert.equal(presentation.emergenceScales[incoming],
      CELESTIAL_ATLAS_LOD_POLICY.emergenceScaleFloor);
  }
});

test("a 1000-sample LOD sweep preserves exclusive ownership, physical metadata, and catalogue order", () => {
  const allowedPairs = new Set([
    "solar,solarMarker", "solarMarker,stellar", "stellar,deepSky",
    "deepSky,milkyWay"
  ]);
  let previousMeters = 0;
  const nearbyFirst = new Map(), deepFirst = new Map();
  for (let index = 0; index <= 1_000; index += 1) {
    const progress = index / 1_000;
    const presentation = resolveCelestialAtlasPresentation({ progress });
    const total = Object.values(presentation.weights).reduce((sum, weight) => sum + weight, 0);
    assert.ok(Math.abs(total - 1) < 1e-12, `weights sum at ${progress}`);
    assert.ok(presentation.activeRoots.length >= 1 && presentation.activeRoots.length <= 2);
    if (presentation.activeRoots.length === 2) {
      assert.ok(allowedPairs.has(presentation.activeRoots.join(",")),
        `only immediate scale neighbours overlap at ${progress}`);
    }
    assert.ok(presentation.representedDistanceMeters >= previousMeters);
    previousMeters = presentation.representedDistanceMeters;
    assert.ok(presentation.rootScales.solar > 0 && presentation.rootScales.milkyWay > 0);
    if (presentation.stellarOpacity > 0 || Object.values(presentation.nearbyStarOpacities).some(Boolean)) {
      assert.equal(presentation.solarDetailOpacity, 0);
    }
    if (presentation.galaxyOpacity > 0) {
      assert.equal(presentation.stellarOpacity, 0);
    }
    if (presentation.galaxyOpacity === 1) {
      assert.equal(presentation.deepSkyOpacity, 0);
    }
    for (const [id, opacity] of Object.entries(presentation.nearbyStarOpacities)) {
      if (opacity > 0.1 && !nearbyFirst.has(id)) nearbyFirst.set(id, progress);
    }
    for (const [id, opacity] of Object.entries(presentation.deepSkyEntryOpacities)) {
      if (opacity > 0.1 && !deepFirst.has(id)) deepFirst.set(id, progress);
    }
  }
  const nearbyOrder = CELESTIAL_NEARBY_STAR_CATALOG
    .slice().sort((left, right) => left.distanceLightYears - right.distanceLightYears)
    .map(({ id }) => nearbyFirst.get(id));
  const deepOrder = CELESTIAL_DEEP_SKY_CATALOG.map(({ id }) => deepFirst.get(id));
  for (const order of [nearbyOrder, deepOrder]) {
    assert.ok(order.every(Number.isFinite));
    assert.deepEqual(order, [...order].sort((left, right) => left - right));
  }
  const explicit = resolveCelestialAtlasPresentation({
    progress: 0,
    distanceMeters: CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear * 10,
    metersPerUnit: CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear
  });
  assert.ok(Math.abs(explicit.progress - 0.6960957823) < 1e-9);
  assert.equal(explicit.distanceUnit, "ly");
  assert.equal(explicit.distanceValue, 10);
  assert.equal(explicit.metersPerUnit, CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear);
  const beforeNotch = resolveCelestialAtlasPresentation({ progress: 0.72 });
  const afterNotch = resolveCelestialAtlasPresentation({
    distanceMeters: beforeNotch.representedDistanceMeters * 1.2
  });
  assert.deepEqual(beforeNotch.rootPulseScales, {
    solar: 1, stellar: 1, deepSky: 1, milkyWay: 1
  });
  assert.deepEqual(afterNotch.rootPulseScales, beforeNotch.rootPulseScales,
    "camera distance changes projection once; it never contracts an already physical root again");
});

test("the persistent Solar locator keeps shrinking from nearby stars to the Milky Way", () => {
  const samples = [0.6, 0.7, 0.8, 0.9, 1].map((progress) => {
    const presentation = resolveCelestialAtlasPresentation({ progress });
    return presentation.rootScales.solarMarker
      / (presentation.representedDistanceMeters / CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters);
  });
  assert.ok(Math.abs(samples[0] - 0.006) < 1e-12);
  assert.ok(Math.abs(samples.at(-1) - 0.006 * 0.35) < 1e-12);
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok(samples[index] < samples[index - 1],
      "the deep-space Sun marker cannot hold one constant angular size");
  }
});

test("physical root projection ratios contain exactly one native-unit conversion", () => {
  const { minimumMeters, metersPerAu, metersPerLightYear, maximumLightYears } = CELESTIAL_ATLAS_DISTANCE_POLICY;
  const projectionRatio = (localUnits, rootScale, representedDistanceMeters) =>
    localUnits * rootScale / (representedDistanceMeters / minimumMeters);
  const expectedRatio = (physicalMeters, representedDistanceMeters) =>
    physicalMeters / representedDistanceMeters;

  const system = resolveCelestialAtlasPresentation({
    distanceMeters: metersPerAu * 2,
    metersPerUnit: metersPerAu
  });
  assert.equal(system.rootScales.solar, 1);
  assert.ok(Math.abs(projectionRatio(CELESTIAL_ATLAS_UNIT_SCALES.solarUnitScale,
    system.rootScales.solar, system.representedDistanceMeters)
    - expectedRatio(metersPerAu, system.representedDistanceMeters)) < 1e-12);

  const stellar = resolveCelestialAtlasPresentation({
    distanceMeters: metersPerLightYear * 10,
    metersPerUnit: metersPerLightYear
  });
  assert.equal(stellar.rootScales.stellar, CELESTIAL_ATLAS_UNIT_SCALES.deepUnitScale);
  assert.equal(stellar.rootScales.deepSky, CELESTIAL_ATLAS_UNIT_SCALES.deepUnitScale);
  assert.ok(Math.abs(projectionRatio(1, stellar.rootScales.stellar, stellar.representedDistanceMeters)
    - expectedRatio(metersPerLightYear, stellar.representedDistanceMeters)) < 1e-12);
  assert.ok(Math.abs(projectionRatio(1, stellar.rootScales.deepSky, stellar.representedDistanceMeters)
    - expectedRatio(metersPerLightYear, stellar.representedDistanceMeters)) < 1e-12);

  const maximumMeters = maximumLightYears * metersPerLightYear;
  const universe = resolveCelestialAtlasPresentation({
    distanceMeters: maximumMeters,
    metersPerUnit: metersPerLightYear * 1_000
  });
  assert.equal(universe.rootScales.milkyWay, CELESTIAL_ATLAS_UNIT_SCALES.galaxyUnitScale);
  const physicalGalaxyDiameterLightYears = CELESTIAL_GALAXY_DISPLAY.radius * 2 * 1_000;
  const galaxyDiameterRatio = projectionRatio(CELESTIAL_GALAXY_DISPLAY.radius * 2,
    universe.rootScales.milkyWay, universe.representedDistanceMeters);
  assert.ok(Math.abs(galaxyDiameterRatio - physicalGalaxyDiameterLightYears / maximumLightYears) < 1e-12);
  assert.ok(galaxyDiameterRatio > 0.49 && galaxyDiameterRatio < 0.491,
    "a 100 kly Milky Way remains a physically framed disc at the 203,884 ly reference distance");

  const rebasedRendererRatio = ({ localUnits, rootScale, representedDistanceMeters,
    metersPerUnit, cameraMinimumRadius }) => {
    const systemScale = minimumMeters * cameraMinimumRadius / metersPerUnit;
    const cameraRadius = cameraMinimumRadius * representedDistanceMeters / metersPerUnit;
    return localUnits * rootScale * systemScale / cameraRadius;
  };
  for (const cameraMinimumRadius of [1, 4.5, 9]) {
    assert.ok(Math.abs(rebasedRendererRatio({
      localUnits: CELESTIAL_GALAXY_DISPLAY.radius * 2,
      rootScale: universe.rootScales.milkyWay,
      representedDistanceMeters: universe.representedDistanceMeters,
      metersPerUnit: metersPerLightYear * 1_000,
      cameraMinimumRadius
    }) - galaxyDiameterRatio) < 1e-12,
    "the renderer applies its camera baseline to geometry too, so arbitrary minRadius cancels exactly");
  }
});

test("physical heliocentric layout is deterministic and preserves every AU orbit radius", () => {
  const first = calculateCelestialLayout({ epochDays: 73, originBodyId: "sun" });
  const repeat = calculateCelestialLayout({ epochDays: 73, originBodyId: "sun" });
  const later = calculateCelestialLayout({ epochDays: 173, originBodyId: "sun" });
  assert.deepEqual(first, repeat);
  assert.notDeepEqual(first.positions.earth, later.positions.earth);
  assert.deepEqual(first.positions.sun, [0, 0, 0]);
  for (const body of Object.values(CELESTIAL_ATLAS_BODY_REGISTRY)) {
    if (!body.parentId) continue;
    assert.ok(Math.abs(distance(first.absolutePositions[body.id], first.absolutePositions[body.parentId]) - body.orbitRadius) < 1e-10);
  }
});

test("changing the navigation origin recenters that body without changing relative astronomy", () => {
  const solar = calculateCelestialLayout({ epochDays: 12, originBodyId: "sun" });
  const earth = calculateCelestialLayout({ epochDays: 12, originBodyId: "earth" });
  const moon = calculateCelestialLayout({ epochDays: 12, originBodyId: "moon" });
  assert.deepEqual(earth.positions.earth, [0, 0, 0]);
  assert.deepEqual(moon.positions.moon, [0, 0, 0]);
  assert.ok(Math.abs(distance(earth.positions.sun, earth.positions.mars) - distance(solar.positions.sun, solar.positions.mars)) < 1e-12);
  assert.ok(Math.abs(distance(earth.positions.earth, earth.positions.moon) - CELESTIAL_ATLAS_BODY_REGISTRY.moon.orbitRadius) < 1e-12);
});

test("custom registries fall back to their own hierarchy root", () => {
  const registry = createCelestialBodyRegistry({
    definitions: [
      { id: "anchor", label: "Anchor", parentId: null, radius: 1, focusRadius: 3, selectable: true, available: true },
      { id: "satellite", label: "Satellite", parentId: "anchor", radius: 0.2, focusRadius: 1, orbitRadius: 2, orbitalPeriodDays: 10, selectable: true, available: true }
    ]
  });
  const layout = calculateCelestialLayout({ registry, originBodyId: "missing" });
  assert.equal(layout.originBodyId, "anchor");
  assert.deepEqual(layout.positions.anchor, [0, 0, 0]);
});

test("focus fit keeps a body framed on wide and narrow viewports", () => {
  const wide = calculateBodyFocusFit("earth", { aspect: 16 / 9, verticalFovDegrees: 28 });
  const portrait = calculateBodyFocusFit("earth", { aspect: 9 / 16, verticalFovDegrees: 28 });
  assert.ok(portrait.distance > wide.distance, "horizontal field of view governs narrow screens");
  assert.ok(wide.near > 0 && wide.far > wide.distance);
  assert.ok(wide.projectedFill > 0 && wide.projectedFill < 1);
  const explicit = calculateCelestialFocusFit({ radius: 2, focusRadius: 12, aspect: 1 });
  assert.equal(explicit.distance, 12, "authored composition distance can exceed the geometric minimum");
});

test("world points project to stable viewport coordinates and reject points behind the camera", () => {
  const camera = new THREE.PerspectiveCamera(45, 2, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const center = projectCelestialPoint([0, 0, 0], viewProjection, { left: 10, top: 20, width: 1000, height: 500 });
  const behind = projectCelestialPoint([0, 0, 10], viewProjection, { width: 1000, height: 500 });
  assert.ok(Math.abs(center.x - 510) < 1e-8);
  assert.ok(Math.abs(center.y - 270) < 1e-8);
  assert.equal(center.visible, true);
  assert.equal(behind.visible, false);
  const objectPosition = projectCelestialPoint(new THREE.Vector3(0, 0, 0), viewProjection, { width: 1000, height: 500 });
  assert.equal(objectPosition.visible, true);
});

test("sphere occlusion considers only bodies between the camera and label", () => {
  assert.equal(isCelestialPointOccluded({
    cameraPosition: [0, 0, 5],
    targetPosition: [0, 0, -5],
    occluders: [{ id: "earth", position: [0, 0, 0], radius: 1 }]
  }), true);
  assert.equal(isCelestialPointOccluded({
    cameraPosition: [0, 0, 5],
    targetPosition: [0, 0, -5],
    occluders: [{ id: "earth", position: [3, 0, 0], radius: 1 }]
  }), false);
  assert.equal(isCelestialPointOccluded({
    cameraPosition: [0, 0, 5],
    targetPosition: [0, 0, -5],
    excludeId: "earth",
    occluders: [{ id: "earth", position: [0, 0, 0], radius: 1 }]
  }), false);
});

test("label collision priority preserves selection, focus, and stable ordering", () => {
  const labels = prioritizeCelestialLabels([
    { id: "mars", label: "Mars", x: 100, y: 100, width: 80, height: 30, priority: 5, available: false },
    { id: "earth", label: "Earth", x: 102, y: 102, width: 80, height: 30, priority: 1, available: true },
    { id: "sun", label: "Sun", x: 300, y: 100, width: 60, height: 30, priority: 0, available: true },
    { id: "hidden", label: "Hidden", x: 500, y: 100, visible: false }
  ], { selectedBodyId: "earth", focusedBodyId: "sun", maxLabels: 2 });
  assert.deepEqual(labels.map(({ id }) => id), ["earth", "sun"]);
  assert.equal(Object.isFrozen(labels), true);
});

test("projected label layout culls occluded bodies and gives selection first claim", () => {
  const registry = createCelestialBodyRegistry({
    definitions: [
      { id: "near", label: "Near", parentId: null, radius: 0.8, focusRadius: 2, selectable: true, available: true },
      { id: "far", label: "Far", parentId: null, radius: 0.3, focusRadius: 1, selectable: true, available: true }
    ]
  });
  const layout = {
    positions: { near: [0, -0.2, 0], far: [0, -0.08, -2] }
  };
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const labels = projectCelestialLabels({
    layout,
    registry,
    viewProjectionMatrix: viewProjection,
    viewport: { width: 800, height: 800 },
    cameraPosition: camera.position.toArray(),
    selectedBodyId: "near"
  });
  assert.deepEqual(labels.map(({ id }) => id), ["near"]);
});

test("scene builder creates lightweight bodies, orbit loops, and a camera-facing selection", () => {
  const earth = new THREE.Group();
  earth.name = "existing-earth";
  const moon = new THREE.Group();
  moon.name = "existing-moon";
  const atlas = createCelestialAtlas(THREE, {
    externalRoots: { earth, moon },
    quality: "low",
    originBodyId: "earth",
    epochDays: 4
  });
  assert.equal(atlas.root.name, "celestial-atlas");
  assert.equal(atlas.solarRoot.name, "celestial-atlas-solar-system");
  assert.equal(atlas.galaxy, null, "Galaxy resources remain lazy in close Home views");
  assert.deepEqual(atlas.getNavigationPlaces().map(({ id }) => id), expectedIds,
    "the default Places context follows the currently visible solar tier");
  assert.equal(atlas.getNavigationPlaces({ all: true }), atlas.getNavigationPlaces({ all: true }),
    "the full navigation catalogue is a stable frozen descriptor array");
  assert.equal(atlas.getNavigationPlaces({ all: true }).length,
    CELESTIAL_ATLAS_NAVIGATION_DESCRIPTORS.length);
  const earthTarget = atlas.getNavigationTarget("earth");
  assert.equal(earthTarget.root, atlas.getBody("earth").anchor);
  assert.equal(earthTarget.anchor, atlas.getBody("earth").anchor);
  assert.deepEqual(earthTarget.positionInRoot, [0, 0, 0]);
  assert.deepEqual(earthTarget.position, atlas.layout.positions.earth);
  assert.ok(earthTarget.recommendedDistanceMeters > CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters);
  assert.equal(atlas.bodies.size, 10);
  assert.equal(atlas.orbits.size, 9);
  assert.equal(atlas.getBody("earth").visual, earth);
  assert.equal(atlas.getBody("earth").external, true);
  assert.equal(atlas.getBody("mars").visual.isMesh, true);
  assert.equal(atlas.getBody("mars").visual.material.map.image.width, 128);
  assert.equal(atlas.getBody("mars").visual.material.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(atlas.getBody("mars").visual.material.roughness, 0.91);
  assert.equal(atlas.orbits.get("mars").isLineSegments, true);
  assert.equal(atlas.orbits.get("mars").userData.celestialOrbitTier, "inner");
  assert.equal(atlas.orbits.get("saturn").userData.celestialOrbitTier, "outer");
  assert.equal(atlas.particulateField.isPoints, true);
  assert.equal(atlas.particulateField.parent, atlas.orbitRoot);
  assert.deepEqual(atlas.particulateField.userData.celestialParticulates, {
    mainBelt: 260,
    kuiperBelt: 150
  });
  assert.equal(atlas.particulateField.material.depthWrite, false);
  assert.deepEqual(atlas.getBody("earth").anchor.position.toArray(), [0, 0, 0]);

  const systemPresentation = atlas.setSemanticTier({ band: "system", progress: 0.315 });
  assert.equal(systemPresentation.galaxyRequired, false);
  assert.equal(atlas.galaxy, null);
  assert.equal(atlas.setBodyPresentationOpacity("mars", 0.35), true);
  assert.ok(Math.abs(atlas.getBody("mars").visual.material.opacity - 0.35) < 1e-12,
    "body proxy opacity can resolve continuously beneath an authored close model");
  assert.equal(atlas.setBodyPresentationOpacity("mars", 1), true);
  assert.equal(atlas.setBodyPresentationOpacity("not-a-body", 0.5), false);
  const stellarPresentation = atlas.setSemanticTier({ band: "galaxy", progress: 0.73 });
  assert.ok(atlas.galaxy, "deep-space geometry is created on first demand");
  assert.equal(atlas.galaxy.root.visible, true);
  assert.equal(atlas.solarRoot.visible, false, "the full solar atlas cannot duplicate its far marker");
  assert.equal(stellarPresentation.stellarOpacity, 1);
  assert.equal(stellarPresentation.galaxyOpacity, 0);
  assert.equal(stellarPresentation.pivot, "sun");
  assert.deepEqual(stellarPresentation.pivotPosition, atlas.layout.positions.sun);
  assert.equal(atlas.galaxy.stellarRoot.name, "celestial-atlas-stellar-neighborhood");
  assert.equal(atlas.galaxy.deepSkyRoot.name, "celestial-atlas-deep-sky");
  assert.equal(atlas.galaxy.galaxyRoot.name, "celestial-atlas-milky-way");
  assert.equal(atlas.galaxy.stellarField.visible, true);
  const maskedPointFields = [
    atlas.galaxy.stellarField,
    atlas.galaxy.namedStars,
    atlas.galaxy.deepSky,
    atlas.galaxy.deepClusterField,
    ...Object.values(atlas.galaxy.fields),
    ...atlas.galaxy.selectionLocator.children,
    ...atlas.galaxy.solarMarker.children
  ];
  const [sharedPointMask] = maskedPointFields.map(({ material }) => material.alphaMap);
  assert.ok(sharedPointMask?.isDataTexture,
    "atlas point sprites use a texture mask instead of exposing their square GPU quads");
  assert.equal(sharedPointMask.image.width, 32);
  assert.equal(sharedPointMask.image.height, 32);
  assert.equal(sharedPointMask.minFilter, THREE.LinearFilter);
  assert.equal(sharedPointMask.magFilter, THREE.LinearFilter);
  assert.equal(sharedPointMask.generateMipmaps, false);
  assert.ok(maskedPointFields.every(({ material }) => (
    material.alphaMap === sharedPointMask && material.alphaTest > 0
      && material.transparent === true && material.depthWrite === false
  )), "every stellar, deep-sky, galactic, and Solar marker family shares the smooth circular mask");
  const pointMaskSignal = sharedPointMask.image.data.filter((_value, index) => index % 4 === 1);
  assert.ok(pointMaskSignal.includes(0) && Math.max(...pointMaskSignal) > 230,
    "the shared mask fully clears sprite corners while preserving a luminous core");
  assert.equal(atlas.galaxy.galaxyRoot.visible, false,
    "the complete Milky Way waits until after the stellar-neighborhood view");
  assert.equal(atlas.galaxy.stellarData.count, 900);
  assert.equal(atlas.galaxy.stellarData.named.length, CELESTIAL_NEARBY_STAR_CATALOG.length);
  assert.ok(atlas.getNavigationPlaces().some(({ id }) => id === "rigil-kent"));
  assert.ok(atlas.getNavigationPlaces().every(({ kind }) =>
    kind === "nearby-star" || kind === "solar-body"));
  const stellarTarget = atlas.getNavigationTarget("rigil-kent");
  assert.equal(stellarTarget.root, atlas.galaxy.stellarRoot);
  assert.equal(stellarTarget.anchor, null);
  assert.deepEqual(stellarTarget.positionInRoot, CELESTIAL_NEARBY_STAR_CATALOG[0].nativePosition);
  atlas.root.updateMatrixWorld(true);
  const stellarWorld = stellarTarget.root.localToWorld(new THREE.Vector3().fromArray(stellarTarget.positionInRoot));
  assert.ok(stellarWorld.distanceTo(new THREE.Vector3().fromArray(stellarTarget.position)) < 1e-5,
    "root plus positionInRoot resolves the physical rebase without renderer guesswork");
  assert.equal(atlas.setSelectedPlace("rigil-kent").id, "rigil-kent");
  assert.equal(atlas.selectedPlaceId, "rigil-kent");
  assert.equal(atlas.selectedBodyId, null);
  assert.equal(atlas.selection.parent, atlas.galaxy.stellarRoot);
  assert.equal(atlas.galaxy.selectionLocator.visible, true,
    "a visited star gets a screen-space locator without inflating its physical model");
  assert.ok(atlas.galaxy.selectionLocator.children.every((child) => (
    child.isPoints && child.material.sizeAttenuation === false
      && child.material.depthTest === false && child.material.depthWrite === false
  )));
  assert.equal(atlas.galaxy.solarMarker.visible, true);
  assert.equal(atlas.galaxy.solarMarker.children.length, 2);
  assert.ok(atlas.galaxy.solarMarker.children.every((child) => child.isPoints),
    "the persistent Solar locator is additive point light, never a solid sphere");
  assert.ok(atlas.galaxy.solarMarker.children.every((child) => !child.isMesh));
  assert.ok(atlas.galaxy.solarMarker.children.every((child) => (
    child.material.blending === THREE.AdditiveBlending
      && child.material.sizeAttenuation === false
      && child.material.depthTest === false
      && child.material.depthWrite === false
  )));
  assert.equal(atlas.galaxy.solarMarkerLabel.userData.celestialSolarMarkerLabel, "sun");
  assert.equal(atlas.galaxy.solarMarkerLabel.material.depthTest, false,
    "the light-only Solar locator label remains readable above the measuring plane");
  assert.deepEqual(Object.keys(atlas.galaxy.fields), ["spiral", "bulge", "dust"]);
  assert.deepEqual(Object.fromEntries(Object.entries(atlas.galaxy.fields).map(([kind, field]) => [
    kind,
    field.userData.celestialGalaxyPointSpec
  ])), {
    spiral: {
      role: "sparkle", sourceCount: 2400, renderedCount: 2400,
      stride: 1, gpuVertexBytes: 57_600, size: 0.12, opacity: 0.045,
      sizeAttenuation: true, blending: "additive"
    },
    bulge: {
      role: "sparkle", sourceCount: 640, renderedCount: 640,
      stride: 1, gpuVertexBytes: 15_360, size: 0.16, opacity: 0.06,
      sizeAttenuation: true, blending: "additive"
    },
    dust: {
      role: "sparkle", sourceCount: 840, renderedCount: 840,
      stride: 1, gpuVertexBytes: 20_160, size: 0.08, opacity: 0.008,
      sizeAttenuation: true, blending: "normal"
    }
  });
  for (const field of Object.values(atlas.galaxy.fields)) {
    const pointSpec = field.userData.celestialGalaxyPointSpec;
    assert.equal(field.geometry.getAttribute("position").count, pointSpec.renderedCount);
    assert.equal(field.material.sizeAttenuation, true);
    assert.ok(field.material.opacity <= 0.2 || pointSpec.blending === "additive",
      "galaxy points remain restrained while gaining real near/far perspective");
  }
  assert.equal(Object.values(atlas.galaxy.fields).reduce((sum, field) =>
    sum + field.geometry.getAttribute("position").count, 0), 3_880,
  "low quality uploads every bounded source point in exactly three draws");
  assert.equal(atlas.galaxy.stellarGrid.name, "celestial-stellar-grid");
  assert.equal(atlas.galaxy.stellarGrid.isLineSegments, true);
  assert.equal(atlas.galaxy.stellarGrid.parent, atlas.galaxy.gridRoot);
  assert.deepEqual(atlas.galaxy.stellarGrid.userData.celestialGridProfile, {
    minorDivisions: 64,
    majorEvery: 8,
    normalizedHalfExtent: 1,
    layers: ["minor", "major", "axis"]
  });
  const stellarGridPositions = atlas.galaxy.stellarGrid.geometry.getAttribute("position");
  const stellarGridColors = atlas.galaxy.stellarGrid.geometry.getAttribute("color");
  assert.equal(stellarGridPositions.count, 260,
    "the low atlas uses a sparse 64-division grid instead of a moire-prone 256-line wall");
  assert.equal(stellarGridColors.count, stellarGridPositions.count);
  const gridTones = new Set();
  for (let index = 0; index < stellarGridColors.count; index += 1) {
    gridTones.add(`${stellarGridColors.getX(index).toFixed(3)}:${stellarGridColors.getY(index).toFixed(3)}:${stellarGridColors.getZ(index).toFixed(3)}`);
  }
  assert.equal(gridTones.size, 3, "minor, major, and world axes share one ranked line buffer");
  assert.equal(atlas.galaxy.textureLayers.length, 3);
  assert.equal(atlas.galaxy.volumeLayers.length, 3,
    "the low-quality Milky Way still has real slice depth rather than one flat glow card");
  assert.ok(Object.isFrozen(atlas.galaxy.textureLayers));
  assert.ok(Object.isFrozen(atlas.galaxy.volumeLayers));
  const deepPresentation = atlas.setSemanticTier({
    distanceMeters: 1_500 * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear
  });
  assert.equal(deepPresentation.deepSkyOpacity, 1);
  assert.equal(atlas.galaxy.stellarRoot.visible, false);
  assert.equal(atlas.galaxy.deepSkyRoot.visible, true);
  assert.equal(atlas.galaxy.deepLabels.find((label) => label.userData.celestialDeepSkyLabel === "pleiades").visible, true);
  assert.equal(atlas.galaxy.deepLabels.find((label) => label.userData.celestialDeepSkyLabel === "messier-54").visible, false,
    "an 87 kly landmark cannot leak into a 5 kly frame");
  const universePresentation = atlas.setSemanticTier({ band: "universe", progress: 1 });
  assert.equal(universePresentation.pivot, "sun");
  assert.deepEqual(universePresentation.pivotPosition, atlas.layout.positions.sun);
  assert.equal(universePresentation.stellarOpacity, 0);
  assert.equal(universePresentation.galaxyOpacity, 1);
  assert.equal(atlas.galaxy.stellarField.visible, false);
  assert.equal(atlas.galaxy.galaxyRoot.visible, true);
  assert.equal(atlas.setCosmicTransitionOpacity(1), 1,
    "entering the 204 kly boundary with zero cosmic progress preserves full atlas ownership");
  assert.equal(atlas.galaxy.galaxyRoot.visible, true,
    "the renderer's initial cosmic handoff call cannot hide the exact Milky Way stop");
  assert.equal(atlas.setCosmicTransitionOpacity(0), 0);
  assert.equal(atlas.galaxy.galaxyRoot.visible, false,
    "the atlas retires only after cosmology actually begins to take ownership");
  assert.equal(atlas.setCosmicTransitionOpacity(1), 1);
  assert.equal(atlas.galaxy.galaxyRoot.visible, true,
    "returning from cosmology restores the already-built Milky Way without rebuilding it");
  const galacticTarget = atlas.getNavigationTarget("galactic-center");
  assert.equal(galacticTarget.root, atlas.galaxy.galaxyRoot);
  assert.deepEqual(galacticTarget.positionInRoot, [0, 0, 0]);
  assert.ok(atlas.getNavigationPlaces().some(({ id }) => id === "milky-way"));
  assert.ok(atlas.getNavigationPlaces().some(({ id }) => id === "galactic-center"));
  assert.equal(atlas.galaxy.solarMarker.visible, true,
    "the selected Solar System remains locatable inside the Milky Way overview");
  assert.equal(atlas.galaxy.grid.name, "celestial-galaxy-grid");
  assert.equal(atlas.galaxy.grid.isLineSegments, true);
  assert.equal(atlas.galaxy.grid.parent, atlas.galaxy.gridRoot,
    "the world-up distance grid remains independent from the inclined Milky Way");
  assert.ok(atlas.galaxy.grid.geometry.getAttribute("position").count > 80);
  assert.equal(atlas.galaxy.grid.position.y, -CELESTIAL_GALAXY_DISPLAY.thickness * 1.075);
  const gridPosition = atlas.galaxy.grid.geometry.getAttribute("position");
  let gridHalfExtent = 0;
  for (let index = 0; index < gridPosition.count; index += 1) {
    gridHalfExtent = Math.max(gridHalfExtent,
      Math.abs(gridPosition.getX(index)), Math.abs(gridPosition.getZ(index)));
  }
  assert.equal(gridHalfExtent, 1, "one normalized grid is rescaled instead of duplicating geometry");
  assert.ok(atlas.galaxy.grid.scale.x >= CELESTIAL_GALAXY_DISPLAY.gridHalfExtent);
  assert.equal(atlas.galaxy.grid.userData.celestialGridMajorSpacing,
    atlas.galaxy.grid.userData.celestialGridMinorSpacing * 8);
  assert.equal(atlas.galaxy.grid.userData.celestialGridMinorSpacing,
    atlas.galaxy.grid.scale.x * 2 / atlas.galaxy.grid.userData.celestialGridProfile.minorDivisions);
  assert.ok(atlas.galaxy.grid.scale.x >= CELESTIAL_GALAXY_DISPLAY.radius * 8,
    "the adaptive grid remains comfortably beyond the Milky Way in every viewport");
  assert.equal(atlas.galaxy.grid, atlas.galaxy.stellarGrid,
    "stellar and galactic tiers reparent one adaptive grid object");
  assert.equal(universePresentation.rootScales.milkyWay,
    CELESTIAL_ATLAS_UNIT_SCALES.galaxyUnitScale * universePresentation.rootPulseScales.milkyWay);
  atlas.setSemanticTier({ band: "planet", progress: 0 });
  assert.equal(atlas.solarRoot.visible, true);
  assert.equal(atlas.galaxy.root.visible, false);

  const selection = atlas.setSelectedBody("mars");
  assert.equal(selection.body.id, "mars");
  assert.equal(atlas.selection.parent, selection.anchor);
  assert.equal(atlas.selection.visible, true);
  assert.equal(atlas.selectedPlaceId, "mars");
  assert.equal(atlas.galaxy.selectionLocator.visible, false,
    "solar bodies keep their physical selection ring instead of a distant-place locator");
  const camera = new THREE.PerspectiveCamera();
  camera.rotation.set(0.2, 0.3, 0);
  camera.updateMatrixWorld(true);
  assert.equal(atlas.updateSelectionFacingCamera(camera), true);
  assert.ok(atlas.selection.quaternion.angleTo(camera.quaternion) < 1e-9);

  const moonLayout = atlas.applyLayout({ originBodyId: "moon", epochDays: 4 });
  assert.deepEqual(moonLayout.positions.moon, [0, 0, 0]);
  assert.deepEqual(atlas.getBody("moon").anchor.position.toArray(), [0, 0, 0]);
  const scaledLayout = atlas.applyLayout({ orbitalScale: 2 });
  assert.equal(scaledLayout.originBodyId, "moon", "partial updates preserve the current navigation origin");
  assert.equal(atlas.orbits.get("mars").scale.x, 2, "orbit geometry follows runtime scale changes");
  assert.equal(atlas.particulateField.scale.x, 2, "both particulate belts follow the same semantic orbital scale");
  assert.deepEqual(atlas.particulateField.position.toArray(), scaledLayout.positions.sun);
  atlas.setSelectedBody(null);
  assert.equal(atlas.selection.visible, false);
  let surfaceDisposals = 0;
  atlas.getBody("mars").visual.material.map.addEventListener("dispose", () => { surfaceDisposals += 1; });
  atlas.dispose();
  assert.equal(surfaceDisposals, 1);
  assert.equal(earth.parent, null, "external roots are detached, never disposed as generated atlas art");
});

test("stellar and deep-sky stem reveals animate only through uniforms and freeze for reduced motion", () => {
  const atlas = createCelestialAtlas(THREE, { quality: "low" });
  atlas.setSemanticTier({
    distanceMeters: 0.25 * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear
  });
  const { stellarStems, deepSkyStems } = atlas.galaxy;
  for (const stems of [stellarStems, deepSkyStems]) {
    assert.equal(stems.material.isShaderMaterial, true);
    assert.ok(stems.material.uniforms.reveal);
    assert.ok(stems.material.uniforms.phase);
    assert.ok(stems.material.uniforms.animated);
    assert.equal(stems.geometry.getAttribute("celestialAlong").count,
      stems.geometry.getAttribute("position").count);
    assert.equal(stems.geometry.getAttribute("celestialSeed").count,
      stems.geometry.getAttribute("position").count);
  }
  const attributes = [
    stellarStems.geometry.getAttribute("position"),
    stellarStems.geometry.getAttribute("celestialAlong"),
    stellarStems.geometry.getAttribute("celestialSeed"),
    deepSkyStems.geometry.getAttribute("position"),
    deepSkyStems.geometry.getAttribute("celestialAlong"),
    deepSkyStems.geometry.getAttribute("celestialSeed")
  ];
  const versions = attributes.map(({ version }) => version);
  const arrays = attributes.map(({ array }) => array);
  let diagnostics;
  for (let frame = 0; frame < 120; frame += 1) {
    diagnostics = atlas.updateLineReveal({ deltaSeconds: 1 / 60 });
  }
  assert.ok(diagnostics.stellarReveal < 0.001);
  assert.ok(diagnostics.deepSkyReveal < 0.001);
  assert.equal(diagnostics.bufferUploads, 0);

  atlas.setSemanticTier({
    distanceMeters: 4 * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear
  });
  diagnostics = atlas.updateLineReveal({ deltaSeconds: 1 / 60 });
  assert.ok(diagnostics.stellarReveal > 0 && diagnostics.stellarReveal < 1,
    "a visible tier eases its stems instead of replacing geometry");
  for (let frame = 0; frame < 180; frame += 1) {
    diagnostics = atlas.updateLineReveal({ deltaSeconds: 1 / 60 });
  }
  assert.ok(diagnostics.stellarReveal > 0.999);
  assert.equal(stellarStems.material.uniforms.animated.value, 1);

  const movingPhase = diagnostics.phase;
  atlas.setSemanticTier({
    distanceMeters: 1_500 * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear
  });
  diagnostics = atlas.updateLineReveal({ deltaSeconds: 0.25, reducedMotion: true });
  assert.equal(diagnostics.phase, movingPhase, "reduced motion freezes the scan phase");
  assert.equal(diagnostics.stellarReveal, 0);
  assert.equal(diagnostics.deepSkyReveal, 1);
  assert.equal(deepSkyStems.material.uniforms.animated.value, 0);
  atlas.setLineReveal({ deepSky: 0.4, phase: 0.9, reducedMotion: true });
  assert.equal(deepSkyStems.material.uniforms.reveal.value, 0.4);
  assert.equal(deepSkyStems.material.uniforms.phase.value, movingPhase,
    "direct reveal control also refuses phase movement under reduced motion");
  assert.deepEqual(attributes.map(({ version }) => version), versions);
  assert.deepEqual(attributes.map(({ array }) => array), arrays,
    "per-frame reveal work never replaces or uploads a stem buffer");
  atlas.dispose();
});

test("incoming atlas roots prewarm invisibly and grow from 85 percent without moving", () => {
  const atlas = createCelestialAtlas(THREE, { quality: "low" });
  atlas.setSemanticTier({
    distanceMeters: 4 * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear
  });
  const fullSize = atlas.galaxy.stellarField.material.size;
  const stablePosition = atlas.galaxy.stellarRoot.position.toArray();
  const [start] = CELESTIAL_ATLAS_LOD_POLICY.transitions.markerToStellar;
  const prewarmPresentation = atlas.setSemanticTier({
    progress: start - CELESTIAL_ATLAS_LOD_POLICY.gpuPrewarmLead * 0.5
  });
  assert.equal(prewarmPresentation.stellarOpacity, 0);
  assert.equal(prewarmPresentation.prewarmRoots.stellar, true);
  assert.equal(atlas.galaxy.stellarRoot.visible, true,
    "the incoming root is GPU-ready before it contributes color");
  assert.equal(atlas.galaxy.stellarField.visible, true);
  assert.equal(atlas.galaxy.stellarField.material.opacity, 0);
  assert.ok(Math.abs(atlas.galaxy.stellarField.material.size / fullSize - 0.85) < 1e-12);
  assert.deepEqual(atlas.galaxy.stellarRoot.position.toArray(), stablePosition);

  const emerging = atlas.setSemanticTier({
    distanceMeters: 1 * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear
  });
  assert.ok(emerging.stellarOpacity > 0 && emerging.stellarOpacity < 1);
  assert.ok(atlas.galaxy.stellarField.material.size > fullSize * 0.85);
  assert.ok(atlas.galaxy.stellarField.material.size < fullSize);
  assert.deepEqual(atlas.galaxy.stellarRoot.position.toArray(), stablePosition,
    "emergence changes scale and opacity, never the projected anchor");
  atlas.dispose();
});

test("the Solar marker exists invisibly before its first ownership weight", () => {
  const atlas = createCelestialAtlas(THREE, { quality: "low" });
  const [start] = CELESTIAL_ATLAS_LOD_POLICY.transitions.solarToMarker;
  const prewarmProgress = start - CELESTIAL_ATLAS_LOD_POLICY.constructionLead * 0.5;
  const prewarm = atlas.setSemanticTier({ progress: prewarmProgress });
  assert.equal(prewarm.solarMarkerOpacity, 0);
  assert.equal(prewarm.galaxyRequired, true);
  assert.ok(atlas.galaxy?.solarMarker, "the incoming marker is constructed before it can draw");
  assert.equal(atlas.galaxy.solarMarker.visible, false);
  const marker = atlas.galaxy.solarMarker;

  const emerging = atlas.setSemanticTier({ progress: start + 0.001 });
  assert.ok(emerging.solarMarkerOpacity > 0);
  assert.equal(atlas.galaxy.solarMarker, marker,
    "the visible handoff reuses the prewarmed marker instead of constructing a replacement");

  const reverse = atlas.setSemanticTier({ progress: prewarmProgress });
  assert.equal(reverse.solarMarkerOpacity, 0);
  assert.equal(atlas.galaxy.solarMarker, marker,
    "reverse zoom keeps the same prepared marker and only changes its weight");
  atlas.dispose();
});

test("scene construction rejects incomplete injected Three.js implementations", () => {
  assert.throws(() => createCelestialAtlas({}), /THREE\.Group/);
});

test("standard celestial focus keeps full-screen procedural planets crisp", () => {
  const atlas = createCelestialAtlas(THREE, { quality: "standard" });
  const mars = atlas.getBody("mars").visual;
  assert.equal(mars.material.map.image.width, 512);
  assert.equal(mars.material.map.image.height, 256);
  assert.equal(mars.geometry.parameters.widthSegments, 96);
  assert.equal(mars.geometry.parameters.heightSegments, 64);
  atlas.dispose();
});

test("stellar labels face the camera and retain readable angular size without a body selection", () => {
  const atlas = createCelestialAtlas(THREE, { quality: "low", originBodyId: "sun" });
  atlas.root.rotation.set(0.12, -0.19, 0.07);
  atlas.setSemanticTier({ band: "galaxy", progress: 0.73 });
  atlas.root.scale.setScalar(CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters
    / CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear);
  atlas.setSelectedBody(null);
  atlas.root.updateMatrixWorld(true);

  const label = atlas.galaxy.stellarLabels[0];
  const chartLabels = atlas.galaxy.cameraLabels;
  assert.equal(atlas.selection.visible, false, "star-chart labels cannot depend on the body selection ring");
  assert.equal(label.visible, true);
  assert.equal(chartLabels.length, 25);
  assert.ok(chartLabels.every((entry) => entry.isMesh && entry.material.map?.isDataTexture),
    "labels use one textured plane rather than one point object per glyph pixel");
  assert.equal(chartLabels.reduce((sum, entry) => sum + entry.geometry.index.count / 3, 0), 50);
  assert.equal(new Set(chartLabels.map((entry) => entry.material.map)).size, chartLabels.length);
  assert.ok(chartLabels.reduce((sum, entry) => sum + entry.userData.celestialLabelRaster.bytes, 0) < 200_000,
    "the complete deterministic fallback label set stays below 200 KiB of decoded RGBA data");
  assert.equal(label.geometry.parameters.width,
    label.userData.celestialLabelRaster.width / label.userData.celestialLabelRaster.height);
  assert.equal(label.geometry.parameters.height, 1);
  assert.equal(label.material.map.generateMipmaps, false);
  assert.equal(label.material.map.minFilter, THREE.LinearFilter);
  const alpha = label.material.map.image.data.filter((_value, index) => index % 4 === 3);
  assert.ok(alpha.includes(0) && alpha.includes(255), "label texture contains transparent padding and crisp glyph cores");

  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
  camera.position.set(0, 36, 132);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  assert.equal(atlas.updateSelectionFacingCamera(camera), true);
  atlas.root.updateMatrixWorld(true);
  const cameraWorld = camera.getWorldQuaternion(new THREE.Quaternion());
  const labelWorld = label.getWorldQuaternion(new THREE.Quaternion());
  assert.ok(labelWorld.angleTo(cameraWorld) < 1e-6, "the label billboard matches camera orientation in world space");
  const nearScale = label.scale.x;

  atlas.root.scale.multiplyScalar(4.5);
  atlas.root.updateMatrixWorld(true);
  camera.position.multiplyScalar(4.5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  assert.equal(atlas.updateSelectionFacingCamera(camera), true);
  assert.ok(Math.abs(label.scale.x / nearScale - 1) < 1e-6,
    "uniform physical rebasing cannot inflate screen-space labels");
  atlas.root.scale.multiplyScalar(1 / 4.5);
  atlas.root.updateMatrixWorld(true);

  camera.position.set(0, 72, 264);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  assert.equal(atlas.updateSelectionFacingCamera(camera), true);
  assert.ok(label.scale.x > nearScale * 1.5,
    "label geometry grows with camera distance instead of collapsing into unreadable dots");
  assert.equal(label.scale.x, label.scale.y);
  assert.equal(label.scale.y, label.scale.z);
  let labelTextureDisposals = 0;
  label.material.map.addEventListener("dispose", () => { labelTextureDisposals += 1; });
  atlas.dispose();
  assert.equal(labelTextureDisposals, 1);
});

test("camera-facing updates still orient a selected body after stellar labels retire", () => {
  const atlas = createCelestialAtlas(THREE, { quality: "low" });
  atlas.setSemanticTier({ band: "universe", progress: 1 });
  assert.ok(atlas.galaxy.stellarLabels.every((label) => !label.visible));
  atlas.setSelectedBody("earth");
  atlas.root.rotation.set(-0.08, 0.24, 0.03);
  atlas.root.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(14, 22, 96);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  assert.equal(atlas.updateSelectionFacingCamera(camera), true);
  atlas.root.updateMatrixWorld(true);
  const cameraWorld = camera.getWorldQuaternion(new THREE.Quaternion());
  const selectionWorld = atlas.selection.getWorldQuaternion(new THREE.Quaternion());
  assert.ok(selectionWorld.angleTo(cameraWorld) < 1e-6,
    "selection billboarding remains correct beneath transformed atlas parents");
  atlas.dispose();
});

test("visited stellar and cluster targets keep a readable locator and label without changing physical extent", () => {
  const atlas = createCelestialAtlas(THREE, { quality: "standard", originBodyId: "sun" });
  atlas.setSemanticTier({ band: "galaxy", progress: 0.73 });
  atlas.root.scale.setScalar(CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters
    / CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear);
  const target = atlas.getNavigationTarget("eps-eridani");
  const selected = atlas.setSelectedPlace("eps-eridani");
  assert.equal(selected.nativeExtent, target.nativeExtent,
    "navigation feedback cannot enlarge the target's physical focus extent");
  assert.equal(atlas.galaxy.selectionLocator.visible, true);
  const label = atlas.galaxy.stellarLabels.find((entry) =>
    entry.userData.celestialStarLabel === "eps-eridani");
  assert.equal(label.userData.celestialSelectedPlaceLabel, true);
  assert.ok(label.position.y - selected.localPosition[1] < selected.nativeExtent * 0.08,
    "a focused stellar label stays near its real point instead of retaining an overview-scale offset");

  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
  camera.position.set(0, 18, 72);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  atlas.root.updateMatrixWorld(true);
  atlas.updateSelectionFacingCamera(camera);
  assert.equal(label.visible, true,
    "the selected destination wins label collision priority at its visit scale");
  assert.equal(label.userData.celestialCollisionVisible, true);

  atlas.setSelectedBody("earth");
  assert.equal(atlas.galaxy.selectionLocator.visible, false);
  assert.equal(label.userData.celestialSelectedPlaceLabel, undefined);
  assert.deepEqual(label.position.toArray(), label.userData.celestialLabelBasePosition);
  atlas.dispose();
});

test("chart label budgeting is collision-free, tier-aware, and stable across small camera motion", () => {
  const exercise = (quality, aspect, minimum, maximum) => {
    const atlas = createCelestialAtlas(THREE, { quality, originBodyId: "sun" });
    atlas.setSemanticTier({ band: "galaxy", progress: 0.73 });
    atlas.root.scale.setScalar(CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters
      / CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear);
    atlas.setSelectedBody("earth");
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.set(0, 12, 45);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    assert.equal(atlas.updateSelectionFacingCamera(camera), true);
    atlas.root.updateMatrixWorld(true);

    const visible = atlas.galaxy.cameraLabels.filter((label) => label.visible);
    assert.ok(visible.length >= minimum && visible.length <= maximum);
    assert.equal(visible.length, atlas.galaxy.visibleLabelCount);
    assert.ok(visible.length <= atlas.galaxy.labelBudget);
    assert.equal(visible[0].userData.celestialLabelText, "SUN",
      "the persistent Solar pivot keeps first claim across deep-space tiers");
    assert.ok(visible.some((label) => label.userData.celestialLabelText === "RIGIL KENT"),
      "the nearest catalogue entry remains readable beside the Solar pivot");
    assert.ok(visible.every((label) => label.userData.celestialStarLabel
      || label.userData.celestialSolarMarkerLabel),
      "strict ownership prevents deep-sky labels leaking into the nearby-star tier");
    assert.equal(atlas.selection.visible, true, "label culling never suppresses selected-body feedback");

    const bounds = visible.map((label) => {
      const projected = label.getWorldPosition(new THREE.Vector3()).project(camera);
      const raster = label.userData.celestialLabelRaster;
      const halfHeight = 0.0205;
      const halfWidth = 0.035 * raster.width / raster.height / aspect * 0.5 + 0.005;
      return { left: projected.x - halfWidth, right: projected.x + halfWidth,
        top: projected.y + halfHeight, bottom: projected.y - halfHeight };
    });
    for (let left = 0; left < bounds.length; left += 1) for (let right = left + 1; right < bounds.length; right += 1) {
      assert.equal(bounds[left].left < bounds[right].right && bounds[left].right > bounds[right].left
        && bounds[left].top > bounds[right].bottom && bounds[left].bottom < bounds[right].top, false,
      "accepted label rectangles cannot overlap");
    }

    const stableIds = visible.map((label) => label.name);
    camera.position.x += 0.02;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    atlas.updateSelectionFacingCamera(camera);
    assert.deepEqual(atlas.galaxy.cameraLabels.filter((label) => label.visible).map((label) => label.name), stableIds,
      "retained-label priority prevents flicker during sub-pixel camera motion");
    atlas.dispose();
  };
  exercise("low", 390 / 844, 5, 7);
  exercise("standard", 16 / 9, 7, 14);
});

test("the lazy Milky Way texture overlays the same spatial disc and invalidates once loaded", () => {
  let requestedUrl = "";
  let invalidations = 0;
  let disposed = false;
  const loadedTexture = {
    dispose() { disposed = true; }
  };
  class TextureLoader {
    load(url, onLoad) {
      requestedUrl = url;
      onLoad(loadedTexture);
      return loadedTexture;
    }
  }
  const atlas = createCelestialAtlas({ ...THREE, TextureLoader }, {
    quality: "standard",
    galaxyTextureUrl: "https://example.test/art/planet-hub/galaxy/milky-way-standard.webp",
    onInvalidate: () => { invalidations += 1; }
  });
  atlas.setSemanticTier({ band: "universe", progress: 1 });
  assert.equal(requestedUrl, "https://example.test/art/planet-hub/galaxy/milky-way-standard.webp");
  assert.equal(atlas.galaxy.textureLayer.name, "celestial-milky-way-texture");
  assert.equal(atlas.galaxy.textureLayer.material.uniforms.galaxyMap.value, loadedTexture);
  assert.equal(atlas.galaxy.textureLayers.length, 5);
  assert.ok(atlas.galaxy.textureLayers.every((layer) =>
    layer.material.uniforms.galaxyMap.value === loadedTexture));
  assert.ok(atlas.galaxy.textureLayers.every((layer) =>
    layer.material.fragmentShader.includes("textureReady")));
  assert.ok(atlas.galaxy.textureLayers.every((layer) =>
    layer.material.uniforms.textureReady.value === 0),
  "a completed image decode cannot replace the procedural galaxy in one frame");
  atlas.updateLineReveal({ deltaSeconds: 0.25 });
  assert.ok(atlas.galaxy.textureLayers.every((layer) =>
    layer.material.uniforms.textureReady.value > 0
      && layer.material.uniforms.textureReady.value < 1),
  "the decoded texture enters through the continuous render-loop readiness ramp");
  for (let frame = 0; frame < 180; frame += 1) {
    atlas.updateLineReveal({ deltaSeconds: 1 / 60 });
  }
  assert.ok(atlas.galaxy.textureLayers.every((layer) =>
    layer.material.uniforms.textureReady.value > 0.999));
  assert.deepEqual(atlas.galaxy.textureLayers.map((layer) => layer.position.y), [
    0,
    -CELESTIAL_GALAXY_DISPLAY.thickness * 0.62,
    CELESTIAL_GALAXY_DISPLAY.thickness * 0.62,
    -CELESTIAL_GALAXY_DISPLAY.thickness * 0.31,
    CELESTIAL_GALAXY_DISPLAY.thickness * 0.31
  ]);
  assert.deepEqual(atlas.galaxy.textureLayers.map((layer) =>
    layer.userData.celestialGalaxyTextureSpec.density), [0.72, 0.035, 0.035, 0.075, 0.075]);
  assert.equal(new Set(atlas.galaxy.textureLayers.map((layer) =>
    JSON.stringify(layer.userData.celestialGalaxyTextureSpec.uvOffset))).size, 5,
  "every source plate has a unique UV sample for visible orbit shear");
  assert.equal(atlas.galaxy.volumeLayers.length, 5,
    "standard quality resolves a coherent five-slice luminous disc");
  assert.deepEqual(atlas.galaxy.volumeLayers.map((layer) => layer.position.y), [
    -CELESTIAL_GALAXY_DISPLAY.thickness * 0.62,
    -CELESTIAL_GALAXY_DISPLAY.thickness * 0.31,
    0,
    CELESTIAL_GALAXY_DISPLAY.thickness * 0.31,
    CELESTIAL_GALAXY_DISPLAY.thickness * 0.62
  ]);
  assert.ok(atlas.galaxy.volumeLayers.every((layer) =>
    layer.userData.celestialGalaxyLayer === "haze-dust-slice"));
  assert.equal(atlas.galaxy.depthLayers.length, 10);
  assert.match(atlas.galaxy.volumeLayers[0].material.fragmentShader, /dustAlpha/);
  assert.ok(atlas.galaxy.volumeLayers.every((layer) =>
    layer.material.uniforms.absorption.value > 0));
  assert.doesNotMatch(atlas.galaxy.volumeLayers[0].material.fragmentShader, /pow\([^)]*,\s*7\.?\s*\)/,
    "soft haze replaces the former high-power arm mask that read as chunky rings");
  assert.deepEqual(Object.fromEntries(Object.entries(atlas.galaxy.fields).map(([kind, field]) => [
    kind,
    field.userData.celestialGalaxyPointSpec
  ])), {
    spiral: {
      role: "sparkle", sourceCount: 6800, renderedCount: 6800,
      stride: 1, gpuVertexBytes: 163_200, size: 0.14, opacity: 0.052,
      sizeAttenuation: true, blending: "additive"
    },
    bulge: {
      role: "sparkle", sourceCount: 1800, renderedCount: 1800,
      stride: 1, gpuVertexBytes: 43_200, size: 0.18, opacity: 0.068,
      sizeAttenuation: true, blending: "additive"
    },
    dust: {
      role: "sparkle", sourceCount: 2200, renderedCount: 2200,
      stride: 1, gpuVertexBytes: 52_800, size: 0.1, opacity: 0.01,
      sizeAttenuation: true, blending: "normal"
    }
  });
  assert.ok(Object.values(atlas.galaxy.fields).every((field) =>
    field.geometry.getAttribute("position").count === field.userData.celestialGalaxyPointSpec.sourceCount));
  assert.equal(Object.values(atlas.galaxy.fields).reduce((sum, field) =>
    sum + field.geometry.getAttribute("position").count, 0), 10_800,
  "standard quality raises perceived density about elevenfold without adding point draws");
  assert.equal(invalidations, 1);
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
  atlas.root.updateMatrixWorld(true);
  const galaxyCentre = atlas.galaxy.galaxyRoot.getWorldPosition(new THREE.Vector3());
  const galaxyNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(
    atlas.galaxy.galaxyRoot.getWorldQuaternion(new THREE.Quaternion())
  ).normalize();
  camera.position.copy(galaxyCentre).addScaledVector(galaxyNormal, 200);
  camera.lookAt(galaxyCentre);
  camera.updateMatrixWorld(true);
  atlas.updateSelectionFacingCamera(camera);
  const upperOrder = atlas.galaxy.textureLayers[2].renderOrder;
  const lowerOrder = atlas.galaxy.textureLayers[1].renderOrder;
  camera.position.copy(galaxyCentre).addScaledVector(galaxyNormal, -200);
  camera.lookAt(galaxyCentre);
  camera.updateMatrixWorld(true);
  atlas.updateSelectionFacingCamera(camera);
  assert.ok((upperOrder - lowerOrder)
    * (atlas.galaxy.textureLayers[2].renderOrder - atlas.galaxy.textureLayers[1].renderOrder) < 0,
  "transparent depth ordering reverses when the camera crosses the galactic plane");
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(atlas.galaxy.galaxyRoot.quaternion);
  assert.equal(atlas.galaxy.galaxyRoot.rotation.z,
    -CELESTIAL_GALAXY_DISPLAY.inclinationRadians);
  assert.ok(Math.abs(normal.dot(new THREE.Vector3(0, 1, 0))
    - Math.cos(CELESTIAL_GALAXY_DISPLAY.inclinationRadians)) < 1e-8,
  "the Milky Way keeps its physical inclination instead of sharing the floor grid");
  const gridNormal = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(atlas.galaxy.gridRoot.quaternion);
  assert.ok(gridNormal.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-8,
    "the adaptive grid remains a stable world-up measuring plane");
  assert.equal(atlas.galaxy.galaxyRoot.userData.celestialCameraAligned, false,
    "camera arrival never billboards or rotates the galactic chart");
  atlas.dispose();
  assert.equal(disposed, true);
});

test("parallel Milky Way image slices create perceptible orbit parallax instead of a flat billboard", () => {
  const atlas = createCelestialAtlas(THREE, { quality: "standard" });
  atlas.setSemanticTier({ band: "universe", progress: 1 });

  // Normalize the physical rebase so this measures only the authored galactic
  // volume. The camera framing keeps the 110-unit image stack comfortably in
  // view at a representative oblique Milky Way overview.
  atlas.root.position.set(0, 0, 0);
  atlas.root.scale.setScalar(1);
  atlas.galaxy.root.position.set(0, 0, 0);
  atlas.galaxy.galaxyRoot.position.set(0, 0, 0);
  atlas.galaxy.galaxyRoot.scale.setScalar(1);
  atlas.root.updateMatrixWorld(true);

  const projectLayerCentres = (cameraPosition) => {
    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 500);
    camera.position.fromArray(cameraPosition);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    return atlas.galaxy.textureLayers.map((layer) => {
      const ndc = layer.getWorldPosition(new THREE.Vector3()).project(camera);
      return {
        ndc,
        pixel: new THREE.Vector2((ndc.x + 1) * 640, (1 - ndc.y) * 360)
      };
    });
  };

  const leftOrbit = projectLayerCentres([75, 28, 110]);
  const rightOrbit = projectLayerCentres([-75, 28, 110]);
  const layerSeparation = (projection) => projection[1].pixel.distanceTo(projection[2].pixel);
  assert.ok(layerSeparation(leftOrbit) >= 8,
    "the lower and upper image slices need at least eight pixels of depth separation in a 720p overview");
  assert.ok(layerSeparation(rightOrbit) >= 8,
    "the image volume must remain visibly deep from the opposite camera orbit");

  const leftParallax = leftOrbit[2].pixel.clone().sub(leftOrbit[1].pixel);
  const rightParallax = rightOrbit[2].pixel.clone().sub(rightOrbit[1].pixel);
  assert.ok(leftParallax.distanceTo(rightParallax) >= 2,
    "orbiting the camera must change the image-layer disparity by a perceptible amount");
  assert.ok(atlas.galaxy.textureLayers.every((layer) => layer.parent === atlas.galaxy.galaxyRoot),
    "all image slices stay in the inclined galactic volume rather than billboarding to the camera");

  atlas.dispose();
});
