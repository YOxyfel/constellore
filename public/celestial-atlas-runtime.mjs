const TAU = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;

const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value)
  : fallback;

const positive = (value, fallback = 1) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const clamp = (value, minimum, maximum) => Math.max(
  minimum,
  Math.min(maximum, finite(value, minimum))
);

const smoothstep = (minimum, maximum, value) => {
  const amount = clamp((finite(value) - minimum) / Math.max(1e-9, maximum - minimum), 0, 1);
  return amount * amount * (3 - 2 * amount);
};

const vector3 = (value = [0, 0, 0]) => Array.isArray(value) || ArrayBuffer.isView(value)
  ? [finite(value?.[0]), finite(value?.[1]), finite(value?.[2])]
  : [finite(value?.x), finite(value?.y), finite(value?.z)];

const freezeBody = (body) => Object.freeze({ ...body });

const physicalDiagnosticWork = new WeakMap();

const representedDistanceLabel = (distanceMeters) => {
  const lightYears = distanceMeters / CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear;
  const au = distanceMeters / CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerAu;
  const unit = lightYears >= 1000 ? "kly" : lightYears >= 0.1 ? "ly"
    : au >= 0.01 ? "AU" : distanceMeters >= 1000 ? "km" : "m";
  const value = unit === "kly" ? lightYears / 1000 : unit === "ly" ? lightYears
    : unit === "AU" ? au : unit === "km" ? distanceMeters / 1000 : distanceMeters;
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : value >= 1 ? 2 : 3;
  return { unit, label: `${value.toFixed(digits)} ${unit}` };
};

const physicalDiagnosticVectors = (THREE) => {
  let work = physicalDiagnosticWork.get(THREE);
  if (!work) {
    work = {
      worldUp: new THREE.Vector3(0, 1, 0),
      actualUp: new THREE.Vector3(),
      idealUp: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      cross: new THREE.Vector3(),
      pivot: new THREE.Vector3(),
      planePoint: new THREE.Vector3(),
      planeNormal: new THREE.Vector3(),
      rayDirection: new THREE.Vector3(),
      intersection: new THREE.Vector3(),
      gridLocal: new THREE.Vector3(),
      quaternion: new THREE.Quaternion()
    };
    physicalDiagnosticWork.set(THREE, work);
  }
  return work;
};

const diagnosticGridCoversViewport = (grid, camera, work) => {
  if (!grid?.visible || !(Number(grid.material?.opacity) > 0.002)) return false;
  grid.updateWorldMatrix?.(true, false);
  grid.getWorldPosition?.(work.planePoint);
  grid.getWorldQuaternion?.(work.quaternion);
  work.planeNormal.set(0, 0, grid.isMesh ? 1 : 0);
  if (!grid.isMesh) work.planeNormal.copy(work.worldUp);
  work.planeNormal.applyQuaternion(work.quaternion).normalize();
  let intersections = 0;
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1]]) {
    work.rayDirection.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
    const denominator = work.rayDirection.dot(work.planeNormal);
    if (Math.abs(denominator) < 1e-7) continue;
    const distance = work.planePoint.clone().sub(camera.position)
      .dot(work.planeNormal) / denominator;
    if (!(distance > 0)) continue;
    intersections += 1;
    work.intersection.copy(camera.position).addScaledVector(work.rayDirection, distance);
    work.gridLocal.copy(work.intersection);
    grid.worldToLocal?.(work.gridLocal);
    const secondAxis = grid.isMesh ? work.gridLocal.y : work.gridLocal.z;
    if (Math.max(Math.abs(work.gridLocal.x), Math.abs(secondAxis)) > 0.94) return false;
  }
  return intersections >= 2;
};

export function publishPlanetHubPhysicalDiagnostics({
  THREE, canvas, camera, representedDistance, viewZoom, cosmicZoom,
  celestialSemanticPresentation, celestialCosmologyPresentation, spaceEnvironment,
  physicalSolarChart, cosmicActive, cameraOrbitState, sunEffectiveLod,
  targetSubject, target, viewportWidth, viewportHeight
} = {}) {
  if (!THREE?.Vector3 || !canvas?.dataset || !camera || !representedDistance) return false;
  const work = physicalDiagnosticVectors(THREE);
  const display = representedDistanceLabel(representedDistance.distanceMeters);
  const rawWeights = celestialSemanticPresentation?.weights || { solar: 1 };
  const cosmicWeights = celestialCosmologyPresentation?.weights || {};
  const layerWeights = {
    planetary: physicalSolarChart ? 0 : Number(rawWeights.solar) || 0,
    solar: physicalSolarChart
      ? (Number(rawWeights.solar) || 0) + (Number(rawWeights.solarMarker) || 0) : 0,
    stellar: (Number(rawWeights.stellar) || 0) + (Number(rawWeights.deepSky) || 0),
    galactic: (Number(rawWeights.galacticMarker) || 0) + (Number(rawWeights.milkyWay) || 0),
    ...cosmicWeights
  };
  const activeRoots = Object.entries(layerWeights)
    .filter(([, weight]) => weight > 0.001)
    .map(([owner]) => owner);
  const spaceSnapshot = spaceEnvironment?.snapshot?.() || {};
  const coreGrid = spaceEnvironment?.gridCarriers?.reduce?.((brightest, carrier) => (
    Number(carrier?.material?.opacity) > Number(brightest?.material?.opacity) ? carrier : brightest
  ), spaceEnvironment?.worldGrid || null) || spaceEnvironment?.worldGrid;
  const coreGridVisible = Boolean(spaceEnvironment?.gridFamily?.visible
    && Number(spaceSnapshot.gridPlaneOpacity) > 0.002);
  const activeGrid = coreGridVisible ? coreGrid : null;
  const meterWeights = spaceSnapshot.planeMeterWeights || [];
  const meterIndex = Number(meterWeights[1]) > Number(meterWeights[0]) ? 1 : 0;
  const nativeGridUnit = spaceSnapshot.planeMeterUnits?.[meterIndex] || display.unit;
  const gridOwner = cosmicActive ? cosmicZoom.tier
    : viewZoom.band === "universe" ? "galactic"
    : viewZoom.band === "galaxy" ? "stellar"
      : physicalSolarChart ? "solar" : "planetary";
  if (target?.isVector3) work.pivot.copy(target);
  else work.pivot.fromArray(target || [0, 0, 0]);
  work.pivot.project(camera);
  camera.getWorldDirection(work.forward).normalize();
  work.actualUp.copy(work.worldUp).applyQuaternion(camera.quaternion).normalize();
  work.idealUp.copy(work.worldUp).addScaledVector(work.forward, -work.worldUp.dot(work.forward));
  let cameraRoll = 0;
  if (work.idealUp.lengthSq() > 1e-8) {
    work.idealUp.normalize();
    work.cross.crossVectors(work.idealUp, work.actualUp);
    cameraRoll = Math.atan2(work.forward.dot(work.cross), work.idealUp.dot(work.actualUp));
  }
  let gridPlaneDotUp = 1;
  if (activeGrid) {
    activeGrid.getWorldQuaternion?.(work.quaternion);
    work.planeNormal.set(0, 0, activeGrid.isMesh ? 1 : 0);
    if (!activeGrid.isMesh) work.planeNormal.copy(work.worldUp);
    gridPlaneDotUp = work.planeNormal.applyQuaternion(work.quaternion)
      .normalize().dot(work.worldUp);
  }
  Object.assign(canvas.dataset, {
    planetHubDistanceMeters: representedDistance.distanceMeters.toExponential(9),
    planetHubDistanceLabel: display.label,
    planetHubDistanceUnit: display.unit,
    planetHubCameraRoll: cameraRoll.toFixed(6),
    planetHubCameraAzimuth: cameraOrbitState.azimuth.toFixed(6),
    planetHubCameraPolar: cameraOrbitState.polar.toFixed(6),
    planetHubCameraTargetSubject: targetSubject,
    planetHubProjectedPivotX: ((work.pivot.x + 1) * viewportWidth * 0.5).toFixed(2),
    planetHubProjectedPivotY: ((1 - work.pivot.y) * viewportHeight * 0.5).toFixed(2),
    planetHubActiveRootCount: String(activeRoots.length),
    planetHubActiveRoots: JSON.stringify(activeRoots),
    planetHubLayerWeights: JSON.stringify(layerWeights),
    planetHubGridCount: String(Number(coreGridVisible)),
    planetHubGridSource: "native-space",
    planetHubGridFamilyCount: String(spaceSnapshot.gridFamilyCount ?? 0),
    planetHubGridCarrierCount: String(spaceSnapshot.gridCarrierCount ?? 0),
    planetHubGridDecades: JSON.stringify(spaceSnapshot.gridDecades || []),
    planetHubGridCellSizes: JSON.stringify(spaceSnapshot.gridCellSizes || []),
    planetHubGridWeights: JSON.stringify(spaceSnapshot.gridWeights || []),
    planetHubGridWeightSum: Number(spaceSnapshot.gridWeightSum || 0).toFixed(6),
    planetHubGridPlaneOpacity: Number(spaceSnapshot.gridPlaneOpacity || 0).toFixed(6),
    planetHubGridCameraSide: Number(spaceSnapshot.gridCameraSide || 0).toExponential(6),
    planetHubGridViewNormalDot: Number(spaceSnapshot.gridViewNormalDot || 0).toFixed(6),
    planetHubGridCarrierExtent: Number(spaceSnapshot.gridCarrierExtent || 0).toExponential(6),
    planetHubGridEdgeFadeStart: Number(spaceSnapshot.gridEdgeFadeStart || 0).toFixed(6),
    planetHubPlaneMeterCount: String(spaceSnapshot.planeMeterCount ?? 0),
    planetHubPlaneMeterLabels: JSON.stringify(spaceSnapshot.planeMeterLabels || []),
    planetHubPlaneMeterUnits: JSON.stringify(spaceSnapshot.planeMeterUnits || []),
    planetHubPlaneMeterWeights: JSON.stringify(spaceSnapshot.planeMeterWeights || []),
    planetHubPlaneMeterRadiiMeters: JSON.stringify(spaceSnapshot.planeMeterRadiiMeters || []),
    planetHubGridOwner: gridOwner,
    planetHubGridUnit: nativeGridUnit,
    planetHubGridCoversFrustum: String(diagnosticGridCoversViewport(activeGrid, camera, work)),
    planetHubGridPlaneDotUp: gridPlaneDotUp.toFixed(6),
    planetHubSunLod: sunEffectiveLod.mode,
    planetHubSunProjectedDiameterPixels: sunEffectiveLod.projectedDiameterPixels.toExponential(6),
    planetHubSunModelOpacity: sunEffectiveLod.modelOpacity.toFixed(6),
    planetHubSunParticleOpacity: sunEffectiveLod.particleOpacity.toFixed(6),
    planetHubSunParticleOwner: sunEffectiveLod.particleOwner,
    planetHubSunGlareOpacity: sunEffectiveLod.glareOpacity.toFixed(6)
  });
  return true;
}

export const CELESTIAL_ATLAS_SCALE_POLICY = Object.freeze({
  mode: "rebased-physical-units",
  physicallyToScale: true,
  disclosure: "Body radii and distances preserve physical ratios inside separate Earth-diameter, AU, light-year, and kilolight-year roots; each root is rebased for a readable display."
});

export const CELESTIAL_ATLAS_DISTANCE_POLICY = Object.freeze({
  metersPerAu: 149_597_870_700,
  metersPerLightYear: 9_460_730_472_580_800,
  minimumMeters: 12_742_000,
  maximumLightYears: 203_884
});

const ATLAS_MAXIMUM_METERS = CELESTIAL_ATLAS_DISTANCE_POLICY.maximumLightYears
  * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear;
const ATLAS_LOG_DISTANCE_SPAN = Math.log(ATLAS_MAXIMUM_METERS
  / CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters);

const atlasProgressForLightYears = (lightYears) => clamp(Math.log(
  positive(lightYears) * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear
    / CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters
) / ATLAS_LOG_DISTANCE_SPAN, 0, 1);

const atlasProgressForAu = (au) => clamp(Math.log(
  positive(au) * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerAu
    / CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters
) / ATLAS_LOG_DISTANCE_SPAN, 0, 1);

export const CELESTIAL_ATLAS_UNIT_SCALES = Object.freeze({
  solarUnitScale: CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerAu
    / CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters,
  deepUnitScale: CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear
    / CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters,
  galaxyUnitScale: CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear * 1_000
    / CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters
});

export const CELESTIAL_ATLAS_LOD_POLICY = Object.freeze({
  owners: Object.freeze(["solar", "solar-marker", "stellar", "deep-sky", "milky-way"]),
  // Transitions are authored in real distances, then projected onto the
  // logarithmic rail. Each handoff spans many 1.2x wheel pulses so incoming
  // structure grows out of the previous scale instead of arriving in a notch.
  transitionDistances: Object.freeze({
    solarToMarker: Object.freeze({ startAu: 1_000, endLightYears: 0.25 }),
    markerToStellar: Object.freeze({ startLightYears: 0.5, endLightYears: 4 }),
    stellarToDeepSky: Object.freeze({ startLightYears: 80, endLightYears: 1_500 }),
    deepSkyToMilkyWay: Object.freeze({ startLightYears: 1_500, endLightYears: 100_000 })
  }),
  transitions: Object.freeze({
    solarToMarker: Object.freeze([atlasProgressForAu(1_000), atlasProgressForLightYears(0.25)]),
    markerToStellar: Object.freeze([atlasProgressForLightYears(0.5), atlasProgressForLightYears(4)]),
    stellarToDeepSky: Object.freeze([atlasProgressForLightYears(80), atlasProgressForLightYears(1_500)]),
    deepSkyToMilkyWay: Object.freeze([atlasProgressForLightYears(1_500), atlasProgressForLightYears(100_000)])
  }),
  gpuPrewarmLead: 0.015,
  constructionLead: 0.055,
  emergenceScaleFloor: 0.85,
  rootScaleMode: "physical-invariant",
  rootScaleExponent: 0,
  physicalRootScale: 1
});

export const CELESTIAL_GALAXY_DISPLAY = Object.freeze({
  radius: 50,
  thickness: 1.8,
  gridHalfExtent: 64,
  // The real galactic plane is inclined by roughly 60 degrees to the
  // ecliptic. Keeping this fixed (instead of camera-billboarding it) gives the
  // default chart its edge-on Milky Way while an azimuth orbit can still
  // reveal the spiral face.
  inclinationRadians: 60.188 * Math.PI / 180,
  // Kilolight-year placement keeps the persistent Sun pivot about 26 kly from
  // the galactic centre, inside the disc instead of beside a detached thumbnail.
  galacticCenterOffsetFromSun: Object.freeze([0, -0.12, -26])
});

export const CELESTIAL_STELLAR_DISPLAY = Object.freeze({
  radius: 84,
  gridHalfExtent: 180
});

const equatorialPosition = (rightAscensionHours, declinationDegrees, distanceLightYears) => {
  const longitude = finite(rightAscensionHours) / 24 * TAU;
  const latitude = finite(declinationDegrees) * DEG_TO_RAD;
  const radius = positive(distanceLightYears, 1);
  const planar = Math.cos(latitude) * radius;
  return Object.freeze([
    Math.cos(longitude) * planar,
    Math.sin(latitude) * radius,
    Math.sin(longitude) * planar
  ]);
};

const freezeEquatorialCatalogEntry = ({
  id, label, distanceLightYears, rightAscensionHours, declinationDegrees
}) => Object.freeze({
  id,
  label,
  distanceLightYears,
  // distanceLy remains a deliberately explicit compatibility alias for data
  // consumers which predate the navigation catalogue.
  distanceLy: distanceLightYears,
  coordinateFrame: "ICRS",
  coordinateEpoch: "J2000",
  coordinateStatus: "catalog-approximate",
  rightAscensionHours,
  declinationDegrees,
  coordinates: Object.freeze({
    frame: "ICRS",
    epoch: "J2000",
    status: "catalog-approximate",
    rightAscensionHours,
    declinationDegrees
  }),
  nativePosition: equatorialPosition(rightAscensionHours, declinationDegrees, distanceLightYears)
});

// Approximate ICRS/J2000 equatorial coordinates replace the former
// display-authored directions. Distances remain heliocentric light-years, so
// both direction and radius are ready for a fuller catalogue without a visual
// coordinate migration.
export const CELESTIAL_NEARBY_STAR_CATALOG = Object.freeze([
  ["rigil-kent", "RIGIL KENT", 4.37, 14.6601, -60.8339], ["barnard", "BARNARD", 5.96, 17.9635, 4.6934],
  ["wolf-359", "WOLF 359", 7.86, 10.9414, 7.0147], ["lalande-21185", "LALANDE 21185", 8.31, 11.0556, 35.9699],
  ["sirius", "SIRIUS", 8.6, 6.7525, -16.7161], ["ross-154", "ROSS 154", 9.69, 18.8303, -23.8366],
  ["eps-eridani", "EPS ERI", 10.5, 3.5489, -9.4583], ["procyon", "PROCYON", 11.46, 7.655, 5.225],
  ["61-cygni", "61 CYG", 11.4, 21.114, 38.7494], ["tau-ceti", "TAU CETI", 11.9, 1.7345, -15.9375],
  ["altair", "ALTAIR", 16.7, 19.8464, 8.8683], ["fomalhaut", "FOMALHAUT", 25.1, 22.9608, -29.6222],
  ["vega", "VEGA", 25, 18.6156, 38.7837], ["pollux", "POLLUX", 33.7, 7.7553, 28.0262],
  ["arcturus", "ARCTURUS", 36.7, 14.261, 19.1824], ["capella", "CAPELLA", 42.9, 5.2782, 45.998],
  ["aldebaran", "ALDEBARAN", 65.3, 4.5987, 16.5093], ["regulus", "REGULUS", 79.3, 10.1395, 11.9672]
].map(([id, label, distanceLightYears, rightAscensionHours, declinationDegrees]) =>
  freezeEquatorialCatalogEntry({ id, label, distanceLightYears, rightAscensionHours, declinationDegrees })));

// Catalogue distances are approximate heliocentric light-years. Display radii
// are derived logarithmically when geometry is built; they are never used as
// substitutes for physical distance or LOD ordering.
export const CELESTIAL_DEEP_SKY_CATALOG = Object.freeze([
  ["pleiades", "PLEIADES", 444, 3.7833, 24.1167], ["beehive", "BEEHIVE", 577, 8.6667, 19.6667],
  ["messier-39", "MESSIER 39", 1_010, 21.5333, 48.4333], ["messier-46", "MESSIER 46", 4_920, 7.6833, -14.8167],
  ["messier-79", "MESSIER 79", 42_100, 5.4, -24.5167], ["messier-54", "MESSIER 54", 87_400, 18.9167, -30.4833]
].map(([id, label, distanceLightYears, rightAscensionHours, declinationDegrees]) =>
  freezeEquatorialCatalogEntry({ id, label, distanceLightYears, rightAscensionHours, declinationDegrees })));

// These extents are deliberately cluster radii, not marker sizes. Open
// clusters remain loose, irregular associations while the two distant
// globular clusters use centrally concentrated spheroids. All six clouds are
// merged into one Points draw so adding a visitable cluster does not add a
// render call per landmark.
export const CELESTIAL_DEEP_SKY_CLUSTER_PROFILES = Object.freeze({
  pleiades: Object.freeze({ kind: "open-cluster", radiusLightYears: 22, lowCount: 42, standardCount: 112 }),
  beehive: Object.freeze({ kind: "open-cluster", radiusLightYears: 12, lowCount: 54, standardCount: 144 }),
  "messier-39": Object.freeze({ kind: "open-cluster", radiusLightYears: 7, lowCount: 38, standardCount: 96 }),
  "messier-46": Object.freeze({ kind: "open-cluster", radiusLightYears: 15, lowCount: 52, standardCount: 136 }),
  "messier-79": Object.freeze({ kind: "globular-cluster", radiusLightYears: 59, lowCount: 84, standardCount: 224 }),
  "messier-54": Object.freeze({ kind: "globular-cluster", radiusLightYears: 77, lowCount: 96, standardCount: 256 })
});

export function createCelestialDeepSkyClusterData({ quality = "standard", seed = 0x636c7573 } = {}) {
  const lowQuality = quality === "low";
  const entries = CELESTIAL_DEEP_SKY_CATALOG.filter(({ id }) => CELESTIAL_DEEP_SKY_CLUSTER_PROFILES[id]);
  const count = entries.reduce((sum, { id }) => {
    const profile = CELESTIAL_DEEP_SKY_CLUSTER_PROFILES[id];
    return sum + (lowQuality ? profile.lowCount : profile.standardCount);
  }, 0);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const clusters = [];
  let state = seed >>> 0;
  const random = () => ((state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 4294967296);
  let cursor = 0;
  for (const entry of entries) {
    const profile = CELESTIAL_DEEP_SKY_CLUSTER_PROFILES[entry.id];
    const clusterCount = lowQuality ? profile.lowCount : profile.standardCount;
    const start = cursor;
    for (let index = 0; index < clusterCount; index += 1) {
      const vertical = random() * 2 - 1;
      const longitude = random() * TAU;
      const planar = Math.sqrt(Math.max(0, 1 - vertical * vertical));
      const radialBias = profile.kind === "globular-cluster" ? 1.85 : 0.42;
      const radius = profile.radiusLightYears * Math.pow(random(), radialBias);
      const irregularity = profile.kind === "open-cluster" ? 0.72 + random() * 0.56 : 1;
      positions.set([
        entry.nativePosition[0] + Math.cos(longitude) * planar * radius * irregularity,
        entry.nativePosition[1] + vertical * radius * (profile.kind === "open-cluster" ? 0.72 : 1),
        entry.nativePosition[2] + Math.sin(longitude) * planar * radius * irregularity
      ], cursor * 3);
      const bright = 0.48 + Math.pow(random(), 2.2) * 0.52;
      const warm = profile.kind === "globular-cluster";
      colors.set(warm
        ? [bright * 1.08, bright * 0.93, bright * 0.72]
        : [bright * 0.82, bright * 0.94, bright * 1.14], cursor * 3);
      cursor += 1;
    }
    clusters.push(Object.freeze({
      id: entry.id,
      kind: profile.kind,
      start,
      count: clusterCount,
      radiusLightYears: profile.radiusLightYears,
      center: entry.nativePosition
    }));
  }
  return Object.freeze({ positions, colors, count, clusters: Object.freeze(clusters) });
}

// The procedural Milky Way has a stable local kly frame centered on the
// Galactic Centre. Regions without one authoritative boundary are explicitly
// schematic instead of masquerading as catalogue coordinates.
export const CELESTIAL_MILKY_WAY_REGION_CATALOG = Object.freeze([
  Object.freeze({
    id: "milky-way", label: "Milky Way", nativePosition: Object.freeze([0, 0, 0]), nativeExtent: 50,
    coordinateFrame: "galactocentric-display", coordinateStatus: "schematic-extent",
    galacticLongitudeDegrees: null, galacticLatitudeDegrees: null, recommendedDistanceLightYears: 203_884
  }),
  Object.freeze({
    id: "galactic-center", label: "Galactic Centre", nativePosition: Object.freeze([0, 0, 0]), nativeExtent: 9.5,
    coordinateFrame: "galactic", coordinateStatus: "catalog-approximate",
    galacticLongitudeDegrees: 0, galacticLatitudeDegrees: 0, recommendedDistanceLightYears: 26_000
  }),
  Object.freeze({
    id: "orion-spur", label: "Orion Spur", nativePosition: Object.freeze([0, 0.12, 26]), nativeExtent: 5.5,
    coordinateFrame: "galactocentric-display", coordinateStatus: "schematic",
    galacticLongitudeDegrees: null, galacticLatitudeDegrees: null, recommendedDistanceLightYears: 10_000
  }),
  Object.freeze({
    id: "sagittarius-arm", label: "Sagittarius Arm", nativePosition: Object.freeze([12, 0, 11]), nativeExtent: 8,
    coordinateFrame: "galactocentric-display", coordinateStatus: "schematic",
    galacticLongitudeDegrees: null, galacticLatitudeDegrees: null, recommendedDistanceLightYears: 35_000
  }),
  Object.freeze({
    id: "perseus-arm", label: "Perseus Arm", nativePosition: Object.freeze([-14, 0, 20]), nativeExtent: 11,
    coordinateFrame: "galactocentric-display", coordinateStatus: "schematic",
    galacticLongitudeDegrees: null, galacticLatitudeDegrees: null, recommendedDistanceLightYears: 52_000
  })
]);

const PLANET_SURFACES = Object.freeze({
  mercury: { dark: 0x514d49, light: 0xbdb7ad, bands: 4, noise: 0.58, kind: "cratered", roughness: 0.94, tilt: 0.03 },
  venus: { dark: 0x9a612d, light: 0xf3dda5, bands: 13, noise: 0.22, kind: "cloud", roughness: 0.8, tilt: 177.4 },
  mars: { dark: 0x5c211c, light: 0xdb8553, bands: 5, noise: 0.66, kind: "rocky", roughness: 0.91, tilt: 25.2 },
  jupiter: { dark: 0x6f493e, light: 0xf0dbba, bands: 18, noise: 0.26, spot: 0xb74731, kind: "gas", roughness: 0.7, tilt: 3.1 },
  saturn: { dark: 0x9a713f, light: 0xeee0b4, bands: 22, noise: 0.16, kind: "gas", roughness: 0.73, tilt: 26.7 },
  uranus: { dark: 0x3c8696, light: 0xb3e9e5, bands: 9, noise: 0.08, kind: "ice", roughness: 0.67, tilt: 97.8 },
  neptune: { dark: 0x12317f, light: 0x5c8fec, bands: 13, noise: 0.2, kind: "ice", roughness: 0.69, tilt: 28.3 }
});

const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const hashNoise = (x, y, seed = 0) => {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 53.3) * 43758.5453123;
  return value - Math.floor(value);
};

export function createCelestialPlanetSurfaceData(body, { width = 256, height = 128 } = {}) {
  const profile = PLANET_SURFACES[body.id];
  if (!profile) return null;
  const w = Math.max(32, Math.floor(width));
  const h = Math.max(16, Math.floor(height));
  const data = new Uint8Array(w * h * 4);
  const dark = rgb(profile.dark), light = rgb(profile.light), spot = profile.spot ? rgb(profile.spot) : null;
  for (let y = 0; y < h; y += 1) {
    const latitude = 1 - (y + 0.5) / h * 2;
    for (let x = 0; x < w; x += 1) {
      const longitude = (x + 0.5) / w * TAU - Math.PI;
      const turbulence = (Math.sin(longitude * 3.1 + latitude * 9.7)
        + Math.sin(longitude * 7.3 - latitude * 4.6) * 0.55) / 1.55;
      const band = 0.5 + 0.5 * Math.sin((latitude + turbulence * profile.noise * 0.08) * profile.bands * Math.PI);
      // Periodic spherical detail avoids the visible square texel islands of
      // cell-hashed noise when a generated world becomes the full-screen
      // focus. Integer longitude frequencies also keep the map seam closed.
      const grain = 0.5
        + Math.sin(longitude * 17 + latitude * 23 + Math.sin(longitude * 5) * 2.1) * 0.24
        + Math.sin(longitude * 37 - latitude * 19 + Math.sin(latitude * 9) * 1.4) * 0.16
        + Math.sin(longitude * 71 + latitude * 43) * 0.07;
      const continents = 0.5 + 0.25 * Math.sin(longitude * 2.7 + latitude * 8.1)
        + 0.25 * Math.sin(longitude * 7.9 - latitude * 3.8);
      let blend = 0.2 + band * 0.58 + (grain - 0.5) * profile.noise * 0.32;
      if (profile.kind === "cratered") {
        const crater = Math.pow(Math.max(0, hashNoise(Math.floor(x / 7), Math.floor(y / 6), 9) - 0.72) / 0.28, 2);
        blend = 0.34 + continents * 0.28 + (grain - 0.5) * 0.3 - crater * 0.34;
      } else if (profile.kind === "rocky") {
        blend = 0.23 + continents * 0.48 + (grain - 0.5) * 0.34;
        blend += Math.pow(Math.max(0, Math.abs(latitude) - 0.78) / 0.22, 2) * 0.42;
      } else if (profile.kind === "cloud") {
        blend = 0.42 + band * 0.34 + Math.sin(longitude * 5 + turbulence * 3) * 0.08;
      } else if (profile.kind === "ice") {
        blend = 0.42 + band * 0.22 + turbulence * 0.05;
      }
      blend = clamp(blend, 0.03, 0.98);
      const channels = dark.map((value, channel) => value + (light[channel] - value) * blend);
      if (spot) {
        const delta = Math.atan2(Math.sin(longitude - 0.72), Math.cos(longitude - 0.72));
        const mix = Math.exp(-((latitude + 0.23) ** 2 / 0.012 + delta ** 2 / 0.18)) * 0.88;
        channels.forEach((value, channel) => { channels[channel] = value + (spot[channel] - value) * mix; });
      }
      const offset = (y * w + x) * 4;
      data[offset] = channels[0];
      data[offset + 1] = channels[1];
      data[offset + 2] = channels[2];
      data[offset + 3] = 255;
    }
  }
  return Object.freeze({ data, width: w, height: h });
}

export function createCelestialParticulateData({ quality = "standard", seed = 0x87a57e1 } = {}) {
  const mainCount = quality === "low" ? 260 : 620;
  const kuiperCount = quality === "low" ? 150 : 380;
  const count = mainCount + kuiperCount;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  let state = seed >>> 0;
  const next = () => ((state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 4294967296);
  for (let index = 0; index < count; index += 1) {
    const main = index < mainCount;
    const radius = main ? 2.1 + next() * 1.2 : 30 + Math.pow(next(), 0.72) * 20;
    const angle = next() * TAU;
    const height = (next() - 0.5) * (main ? 0.14 : 0.52) * (0.55 + next());
    positions.set([Math.cos(angle) * radius, height, Math.sin(angle) * radius], index * 3);
    const brightness = main ? 0.42 + next() * 0.36 : 0.24 + next() * 0.34;
    colors.set([brightness * 1.08, brightness, brightness * (main ? 0.82 : 1.12)], index * 3);
  }
  return Object.freeze({ positions, colors, count, mainCount, kuiperCount });
}

export function createCelestialStellarNeighborhoodData({ quality = "standard", seed = 0x73746172 } = {}) {
  const backgroundCount = quality === "low" ? 900 : 2200;
  const positions = new Float32Array(backgroundCount * 3);
  const colors = new Float32Array(backgroundCount * 3);
  let state = seed >>> 0;
  const random = () => ((state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 4294967296);
  for (let index = 0; index < backgroundCount; index += 1) {
    const radius = 5 + Math.pow(random(), 0.64) * (CELESTIAL_STELLAR_DISPLAY.radius - 5);
    const longitude = random() * TAU;
    const latitude = Math.asin(random() * 2 - 1);
    const planar = Math.cos(latitude) * radius;
    positions.set([
      Math.cos(longitude) * planar,
      Math.sin(latitude) * radius,
      Math.sin(longitude) * planar
    ], index * 3);
    const warmth = random(), brightness = 0.48 + Math.pow(random(), 2) * 0.52;
    colors.set([
      brightness * (warmth > 0.82 ? 1.12 : 0.9),
      brightness * (0.9 + (1 - Math.abs(warmth - 0.5) * 2) * 0.1),
      brightness * (warmth < 0.28 ? 1.16 : 0.94)
    ], index * 3);
  }
  const named = CELESTIAL_NEARBY_STAR_CATALOG.map((entry) => Object.freeze({
    id: entry.id,
    label: entry.label,
    distanceLy: entry.distanceLightYears,
    coordinateFrame: entry.coordinateFrame,
    coordinateEpoch: entry.coordinateEpoch,
    coordinateStatus: entry.coordinateStatus,
    rightAscensionHours: entry.rightAscensionHours,
    declinationDegrees: entry.declinationDegrees,
    position: entry.nativePosition
  }));
  return Object.freeze({ positions, colors, count: backgroundCount, named: Object.freeze(named) });
}

const CELESTIAL_LABEL_GLYPHS = Object.freeze({
  A:"01110100011000111111100011000110001",B:"11110100011000111110100011000111110",
  C:"01111100001000010000100001000001111",D:"11110100011000110001100011000111110",
  E:"11111100001000011110100001000011111",F:"11111100001000011110100001000010000",
  G:"01111100001000010111100011000101111",H:"10001100011000111111100011000110001",
  I:"11111001000010000100001000010011111",J:"00111000100001000010100100110001100",
  K:"10001100101010011000101001001010001",L:"10000100001000010000100001000011111",
  M:"10001110111010110101100011000110001",N:"10001110011100110101100111001110001",
  O:"01110100011000110001100011000101110",P:"11110100011000111110100001000010000",
  Q:"01110100011000110001101011001001101",R:"11110100011000111110101001001010001",
  S:"01111100001000001110000010000111110",T:"11111001000010000100001000010000100",
  U:"10001100011000110001100011000101110",V:"10001100011000110001100010101000100",
  W:"10001100011000110101101011101101010",X:"10001100010101000100010101000110001",
  Y:"10001100010101000100001000010000100",Z:"11111000010001000100010001000011111",
  0:"01110100011001110101110011000101110",1:"00100011000010000100001000010001110",
  2:"01110100010000100010001000100011111",3:"11110000010000101110000010000111110",
  4:"00010001100101010010111110001000010",5:"11111100001000011110000010000111110",
  6:"01110100001000011110100011000101110",7:"11111000010001000100010000100001000",
  8:"01110100011000101110100011000101110",9:"01110100011000101111000010000101110"
});

const flipLabelRows = (source, width, height) => {
  const output = new Uint8Array(source.length), stride = width * 4;
  for (let y = 0; y < height; y += 1) {
    output.set(source.subarray(y * stride, (y + 1) * stride), (height - 1 - y) * stride);
  }
  for (let offset = 0; offset < output.length; offset += 4) {
    output[offset] = output[offset + 1] = output[offset + 2] = 255;
  }
  return output;
};

function createCelestialLabelBitmap(text = "") {
  const value = String(text).toUpperCase();
  try {
    const canvas = globalThis.document?.createElement?.("canvas"), context = canvas?.getContext?.("2d");
    if (context) {
      const font = '600 20px "Segoe UI",Arial,sans-serif', spacing = 1.25, padding = 6;
      context.font = font;
      const widths = [...value].map((character) => context.measureText(character).width);
      canvas.width = Math.ceil(widths.reduce((sum, width) => sum + width, 0)
        + Math.max(0, widths.length - 1) * spacing + padding * 2);
      canvas.height = 34;
      const drawing = canvas.getContext("2d");
      drawing.font = font;
      drawing.textAlign = "left";
      drawing.textBaseline = "middle";
      drawing.fillStyle = "#fff";
      drawing.shadowColor = "rgba(255,255,255,.55)";
      drawing.shadowBlur = 2;
      let x = padding;
      for (let index = 0; index < value.length; index += 1) {
        drawing.fillText(value[index], x, canvas.height * 0.52);
        x += widths[index] + spacing;
      }
      return Object.freeze({
        data: flipLabelRows(drawing.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height),
        width: canvas.width,
        height: canvas.height,
        source: "canvas"
      });
    }
  } catch { /* deterministic bitmap fallback below */ }
  const scale = 2, padding = 3;
  let logicalWidth = 0;
  for (const character of value) logicalWidth += character === " " ? 4 : 6;
  logicalWidth = Math.max(1, logicalWidth - 1);
  const width = logicalWidth * scale + padding * 2, height = 7 * scale + padding * 2;
  const data = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = data[offset + 1] = data[offset + 2] = 255;
  }
  const write = (x, y, alpha) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = ((height - 1 - y) * width + x) * 4;
    data[offset + 3] = Math.max(data[offset + 3], alpha);
  };
  let cursor = padding;
  for (const character of value) {
    const glyph = CELESTIAL_LABEL_GLYPHS[character];
    if (glyph) for (let index = 0; index < glyph.length; index += 1) {
      if (glyph[index] !== "1") continue;
      const left = cursor + index % 5 * scale, top = padding + Math.floor(index / 5) * scale;
      for (let y = -1; y <= scale; y += 1) for (let x = -1; x <= scale; x += 1) write(left + x, top + y, 56);
      for (let y = 0; y < scale; y += 1) for (let x = 0; x < scale; x += 1) write(left + x, top + y, 255);
    }
    cursor += (character === " " ? 4 : 6) * scale;
  }
  return Object.freeze({ data, width, height, source: "bitmap" });
}

export function createCelestialGalaxyData({ quality = "standard", seed = 0x6d696c6b } = {}) {
  const lowQuality = quality === "low";
  const counts = Object.freeze({
    spiral: lowQuality ? 2400 : 6800,
    bulge: lowQuality ? 640 : 1800,
    dust: lowQuality ? 840 : 2200
  });
  let state = seed >>> 0;
  const next = () => ((state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 4294967296);
  const build = (count, sample) => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const point = sample(index, next);
      positions.set(point.position, index * 3);
      colors.set(point.color, index * 3);
    }
    return Object.freeze({ positions, colors, count });
  };
  const spiral = build(counts.spiral, (index, random) => {
    const radius = 3.2 + Math.pow(random(), 0.68) * (CELESTIAL_GALAXY_DISPLAY.radius - 3.2);
    const arm = index % 4;
    const angle = arm * TAU / 4 + radius * 0.245 + (random() - 0.5) * (0.34 + radius * 0.006);
    const height = (random() - 0.5) * CELESTIAL_GALAXY_DISPLAY.thickness * (0.22 + radius / CELESTIAL_GALAXY_DISPLAY.radius);
    const warmth = 1 - radius / CELESTIAL_GALAXY_DISPLAY.radius;
    const brightness = 0.48 + random() * 0.5;
    return {
      position: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
      color: [brightness, brightness * (0.78 + warmth * 0.2), brightness * (0.9 + (1 - warmth) * 0.25)]
    };
  });
  const bulge = build(counts.bulge, (_index, random) => {
    const radius = Math.pow(random(), 1.8) * 9.5;
    const angle = random() * TAU;
    const height = (random() - 0.5) * (9.5 - radius * 0.45);
    const brightness = 0.58 + random() * 0.42;
    return {
      position: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
      color: [brightness * 1.08, brightness * 0.86, brightness * 0.57]
    };
  });
  const dust = build(counts.dust, (index, random) => {
    const radius = 6 + Math.pow(random(), 0.76) * (CELESTIAL_GALAXY_DISPLAY.radius - 6);
    const arm = index % 4;
    const angle = arm * TAU / 4 + radius * 0.245 + 0.17 + (random() - 0.5) * 0.22;
    const value = 0.12 + random() * 0.11;
    return {
      position: [Math.cos(angle) * radius, (random() - 0.5) * 0.55, Math.sin(angle) * radius],
      color: [value * 1.18, value * 0.72, value * 0.5]
    };
  });
  return Object.freeze({
    spiral,
    bulge,
    dust,
    counts,
    count: counts.spiral + counts.bulge + counts.dust,
    radius: CELESTIAL_GALAXY_DISPLAY.radius
  });
}

const atlasProgressForMeters = (meters) => clamp(Math.log(positive(meters,
  CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters) / CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters)
  / ATLAS_LOG_DISTANCE_SPAN, 0, 1);

const atlasMetersForProgress = (progress) => CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters
  * Math.exp(clamp(progress, 0, 1) * ATLAS_LOG_DISTANCE_SPAN);

const atlasDistanceDisplay = (meters) => {
  const lightYears = meters / CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear;
  const au = meters / CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerAu;
  if (lightYears >= 1_000) return { unit: "kly", value: lightYears / 1_000 };
  if (lightYears >= 0.1) return { unit: "ly", value: lightYears };
  if (au >= 0.01) return { unit: "AU", value: au };
  return { unit: "km", value: meters / 1_000 };
};

const atlasOwnerWeights = (progress) => {
  const amount = clamp(progress, 0, 1);
  const weights = { solar: 0, solarMarker: 0, stellar: 0, deepSky: 0, milkyWay: 0 };
  const transition = (from, to, start, end) => {
    const next = smoothstep(start, end, amount);
    weights[from] = 1 - next;
    weights[to] = next;
  };
  const windows = CELESTIAL_ATLAS_LOD_POLICY.transitions;
  if (amount < windows.solarToMarker[0]) weights.solar = 1;
  else if (amount < windows.solarToMarker[1]) transition("solar", "solarMarker", ...windows.solarToMarker);
  else if (amount < windows.markerToStellar[0]) weights.solarMarker = 1;
  else if (amount < windows.markerToStellar[1]) transition("solarMarker", "stellar", ...windows.markerToStellar);
  else if (amount < windows.stellarToDeepSky[0]) weights.stellar = 1;
  else if (amount < windows.stellarToDeepSky[1]) transition("stellar", "deepSky", ...windows.stellarToDeepSky);
  else if (amount < windows.deepSkyToMilkyWay[0]) weights.deepSky = 1;
  else transition("deepSky", "milkyWay", ...windows.deepSkyToMilkyWay);
  return Object.freeze(weights);
};

const atlasCatalogGate = (distanceLightYears, progress, lead = 0.025, width = 0.015) => {
  const entryProgress = atlasProgressForMeters(distanceLightYears
    * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear);
  return smoothstep(entryProgress - lead, entryProgress - lead + width, progress);
};

export function resolveCelestialAtlasPresentation({
  band = "planet",
  progress = 0,
  representedDistanceMeters = null,
  distanceMeters = null,
  metersPerUnit = CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters,
  sunPosition = [0, 0, 0],
  galacticCenterPosition = null
} = {}) {
  const suppliedMeters = representedDistanceMeters ?? distanceMeters;
  const meters = suppliedMeters == null
    ? atlasMetersForProgress(progress)
    : clamp(suppliedMeters, CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters, ATLAS_MAXIMUM_METERS);
  const amount = suppliedMeters == null ? clamp(progress, 0, 1) : atlasProgressForMeters(meters);
  const sun = vector3(sunPosition);
  const center = galacticCenterPosition == null
    ? sun.map((coordinate, index) => coordinate
      + CELESTIAL_GALAXY_DISPLAY.galacticCenterOffsetFromSun[index] * CELESTIAL_ATLAS_UNIT_SCALES.galaxyUnitScale)
    : vector3(galacticCenterPosition);
  const weights = atlasOwnerWeights(amount);
  const activeRoots = Object.freeze(Object.entries(weights)
    .filter(([, weight]) => weight > 1e-6)
    .map(([owner]) => owner));
  const owner = activeRoots.reduce((best, candidate) => weights[candidate] > weights[best] ? candidate : best,
    activeRoots[0] || "solar");
  const nearbyStarOpacities = Object.freeze(Object.fromEntries(CELESTIAL_NEARBY_STAR_CATALOG.map(
    ({ id, distanceLightYears }) => [id, weights.stellar * atlasCatalogGate(distanceLightYears, amount)]
  )));
  const deepSkyEntryOpacities = Object.freeze(Object.fromEntries(CELESTIAL_DEEP_SKY_CATALOG.map(
    ({ id, distanceLightYears }) => [id, weights.deepSky * atlasCatalogGate(distanceLightYears, amount, 0.06, 0.025)]
  )));
  const rootPulseScales = Object.freeze({
    // Every physical root already converts its native unit into the shared
    // Earth-diameter rebase. A progress-dependent multiplier here would apply
    // distance twice and make real structures contract as the camera recedes.
    solar: CELESTIAL_ATLAS_LOD_POLICY.physicalRootScale,
    stellar: CELESTIAL_ATLAS_LOD_POLICY.physicalRootScale,
    deepSky: CELESTIAL_ATLAS_LOD_POLICY.physicalRootScale,
    milkyWay: CELESTIAL_ATLAS_LOD_POLICY.physicalRootScale
  });
  // The persistent Solar marker is a screen-readable additive point, not a
  // second celestial sphere. Its root may compensate for rebasing, while the
  // point material alone owns the small fixed screen footprint.
  const markerTaper = Math.exp(Math.log(0.35) * smoothstep(0.6, 1, amount));
  const pivotScale = meters / CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters * 0.006 * markerTaper;
  const rootScales = Object.freeze({
    solar: rootPulseScales.solar,
    solarMarker: pivotScale,
    stellar: CELESTIAL_ATLAS_UNIT_SCALES.deepUnitScale * rootPulseScales.stellar,
    deepSky: CELESTIAL_ATLAS_UNIT_SCALES.deepUnitScale * rootPulseScales.deepSky,
    milkyWay: CELESTIAL_ATLAS_UNIT_SCALES.galaxyUnitScale * rootPulseScales.milkyWay
  });
  const prewarmLead = CELESTIAL_ATLAS_LOD_POLICY.gpuPrewarmLead;
  const stellarStart = CELESTIAL_ATLAS_LOD_POLICY.transitions.markerToStellar[0];
  const deepSkyStart = CELESTIAL_ATLAS_LOD_POLICY.transitions.stellarToDeepSky[0];
  const milkyWayStart = CELESTIAL_ATLAS_LOD_POLICY.transitions.deepSkyToMilkyWay[0];
  const prewarmIncoming = (start, end, weight) => amount >= start - prewarmLead
    && amount <= end && weight <= 0.01;
  const prewarmRoots = Object.freeze({
    stellar: prewarmIncoming(stellarStart,
      CELESTIAL_ATLAS_LOD_POLICY.transitions.markerToStellar[1], weights.stellar),
    deepSky: prewarmIncoming(deepSkyStart,
      CELESTIAL_ATLAS_LOD_POLICY.transitions.stellarToDeepSky[1], weights.deepSky),
    milkyWay: prewarmIncoming(milkyWayStart,
      CELESTIAL_ATLAS_LOD_POLICY.transitions.deepSkyToMilkyWay[1], weights.milkyWay)
  });
  const emergence = (weight) => CELESTIAL_ATLAS_LOD_POLICY.emergenceScaleFloor
    + (1 - CELESTIAL_ATLAS_LOD_POLICY.emergenceScaleFloor) * smoothstep(0, 1, weight);
  const emergenceScales = Object.freeze({
    stellar: emergence(weights.stellar),
    deepSky: emergence(weights.deepSky),
    milkyWay: emergence(weights.milkyWay)
  });
  const distance = atlasDistanceDisplay(meters);
  const solarMarkerOpacity = 1 - weights.solar;
  const stellarGridOpacity = weights.stellar + weights.deepSky;
  const gridLightYears = meters / CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear;
  const gridUnit = gridLightYears >= 1_000 ? "kly" : "ly";
  const gridDistance = gridUnit === "kly" ? gridLightYears / 1_000 : gridLightYears;
  const gridSpacing = 10 ** Math.floor(Math.log10(Math.max(1e-6, gridDistance / 8)));
  return Object.freeze({
    band,
    progress: amount,
    representedDistanceMeters: meters,
    representedDistanceLightYears: meters / CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear,
    logDistanceMeters: Math.log10(meters),
    metersPerUnit: positive(metersPerUnit, CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters),
    distanceUnit: distance.unit,
    distanceValue: distance.value,
    owner,
    nextOwner: activeRoots.find((candidate) => candidate !== owner) || null,
    activeRoots,
    weights,
    prewarmRoots,
    emergenceScales,
    rootScales,
    rootPulseScales,
    rootUnits: CELESTIAL_ATLAS_UNIT_SCALES,
    solarDetailOpacity: weights.solar,
    solarMarkerOpacity,
    stellarOpacity: weights.stellar,
    nearbyStarOpacities,
    deepSkyOpacity: weights.deepSky,
    deepSkyEntryOpacities,
    stellarGridOpacity,
    galaxyOpacity: weights.milkyWay,
    galaxyGridOpacity: weights.milkyWay,
    gridOwner: weights.milkyWay > 0 ? "milky-way"
      : stellarGridOpacity > 0 ? (weights.deepSky > weights.stellar ? "deep-sky" : "stellar") : null,
    gridUnit,
    gridSpacing,
    gridScale: weights.stellar * rootScales.stellar + weights.deepSky * rootScales.deepSky
      + weights.milkyWay * rootScales.milkyWay,
    pivot: "sun",
    pivotPosition: Object.freeze(sun),
    sunPosition: Object.freeze(sun),
    galacticCenterPosition: Object.freeze(center),
    galacticCenterOffsetKly: CELESTIAL_GALAXY_DISPLAY.galacticCenterOffsetFromSun,
    galaxyRequired: amount >= CELESTIAL_ATLAS_LOD_POLICY.transitions.solarToMarker[0]
      - CELESTIAL_ATLAS_LOD_POLICY.constructionLead
      || band === "galaxy" || band === "universe"
  });
}

// Radii use Earth-diameter units and heliocentric orbit radii use AU. The
// renderer supplies CELESTIAL_ATLAS_UNIT_SCALES.solarUnitScale as orbitalScale,
// so relative body size and distance remain physical inside the solar root.
export const CELESTIAL_ATLAS_BODY_DEFINITIONS = Object.freeze([
  freezeBody({
    id: "sun", label: "Sun", parentId: null, radius: 54.65, focusRadius: 73,
    orbitRadius: 0, orbitalPeriodDays: 0, phaseDegrees: 0, inclinationDegrees: 0,
    selectable: true, available: true, color: 0xffc45c, emissive: 0xff8b24
  }),
  freezeBody({
    id: "mercury", label: "Mercury", parentId: "sun", radius: 0.1915, focusRadius: 0.52,
    orbitRadius: 0.3871, orbitalPeriodDays: 87.969, phaseDegrees: 18, inclinationDegrees: 7,
    selectable: true, available: false, color: 0x9d9286, emissive: 0x000000
  }),
  freezeBody({
    id: "venus", label: "Venus", parentId: "sun", radius: 0.4749, focusRadius: 1.12,
    orbitRadius: 0.7233, orbitalPeriodDays: 224.701, phaseDegrees: 136, inclinationDegrees: 3.39,
    selectable: true, available: false, color: 0xd8a95f, emissive: 0x000000
  }),
  freezeBody({
    id: "earth", label: "Earth", parentId: "sun", radius: 0.5, focusRadius: 1.18,
    orbitRadius: 1, orbitalPeriodDays: 365.256, phaseDegrees: 208, inclinationDegrees: 0,
    selectable: true, available: true, color: 0x3f78bf, emissive: 0x001426
  }),
  freezeBody({
    id: "moon", label: "Moon", parentId: "earth", radius: 0.1363, focusRadius: 0.42,
    orbitRadius: 0.00257, orbitalPeriodDays: 27.322, phaseDegrees: 34, inclinationDegrees: 5.15,
    selectable: true, available: true, color: 0xb9bdc1, emissive: 0x000000
  }),
  freezeBody({
    id: "mars", label: "Mars", parentId: "sun", radius: 0.266, focusRadius: 0.68,
    orbitRadius: 1.5237, orbitalPeriodDays: 686.98, phaseDegrees: 286, inclinationDegrees: 1.85,
    selectable: true, available: false, color: 0xb55234, emissive: 0x000000
  }),
  freezeBody({
    id: "jupiter", label: "Jupiter", parentId: "sun", radius: 5.487, focusRadius: 7.5,
    orbitRadius: 5.2028, orbitalPeriodDays: 4332.59, phaseDegrees: 72, inclinationDegrees: 1.3,
    selectable: true, available: false, color: 0xc6a17e, emissive: 0x000000
  }),
  freezeBody({
    id: "saturn", label: "Saturn", parentId: "sun", radius: 4.57, focusRadius: 7.1,
    orbitRadius: 9.5388, orbitalPeriodDays: 10759.22, phaseDegrees: 329, inclinationDegrees: 2.49,
    selectable: true, available: false, color: 0xd0b878, emissive: 0x000000,
    ringRadius: 10.73
  }),
  freezeBody({
    id: "uranus", label: "Uranus", parentId: "sun", radius: 1.99, focusRadius: 3.2,
    orbitRadius: 19.191, orbitalPeriodDays: 30688.5, phaseDegrees: 198, inclinationDegrees: 0.77,
    selectable: true, available: false, color: 0x75c7cf, emissive: 0x000000
  }),
  freezeBody({
    id: "neptune", label: "Neptune", parentId: "sun", radius: 1.932, focusRadius: 3.1,
    orbitRadius: 30.061, orbitalPeriodDays: 60182, phaseDegrees: 252, inclinationDegrees: 1.77,
    selectable: true, available: false, color: 0x3159c4, emissive: 0x000000
  })
]);

export const CELESTIAL_ATLAS_BODY_REGISTRY = Object.freeze(Object.fromEntries(
  CELESTIAL_ATLAS_BODY_DEFINITIONS.map((body) => [body.id, body])
));

const freezeNavigationDescriptor = (descriptor) => Object.freeze({
  ...descriptor,
  canonicalId: descriptor.canonicalId || descriptor.id,
  nativePosition: descriptor.nativePosition == null
    ? null
    : Object.freeze(vector3(descriptor.nativePosition)),
  coordinates: descriptor.coordinates ? Object.freeze({ ...descriptor.coordinates }) : null,
  capabilities: Object.freeze({
    select: descriptor.selectable !== false,
    visit: descriptor.available !== false
  })
});

export const CELESTIAL_ATLAS_NAVIGATION_ALIASES = Object.freeze({
  "eps-eri": "eps-eridani",
  "rigil-kentaurus": "rigil-kent",
  "galactic-centre": "galactic-center",
  "solar-system": "sun"
});

export function resolveCelestialNavigationPlaceId(id) {
  const normalized = String(id || "").trim().toLowerCase();
  return CELESTIAL_ATLAS_NAVIGATION_ALIASES[normalized] || normalized;
}

export function createCelestialNavigationDescriptors({ registry = CELESTIAL_ATLAS_BODY_REGISTRY } = {}) {
  const solarBodies = Object.values(registry).map((body) => freezeNavigationDescriptor({
    id: body.id,
    label: body.label,
    kind: "solar-body",
    tier: "solar",
    parentId: body.parentId,
    available: body.available,
    selectable: body.selectable,
    coordinateFrame: "heliocentric-ecliptic",
    coordinateStatus: "ephemeris-derived",
    positionSource: "current-layout",
    nativeUnit: "solar-chart-unit",
    nativePosition: null,
    nativeExtent: body.radius,
    recommendedDistanceMeters: body.focusRadius * CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters
  }));
  const nearbyStars = CELESTIAL_NEARBY_STAR_CATALOG.map((entry) => freezeNavigationDescriptor({
    id: entry.id,
    label: entry.label,
    kind: "nearby-star",
    tier: "stellar",
    parentId: "sun",
    available: true,
    selectable: true,
    coordinateFrame: entry.coordinateFrame,
    coordinateEpoch: entry.coordinateEpoch,
    coordinateStatus: entry.coordinateStatus,
    rightAscensionHours: entry.rightAscensionHours,
    declinationDegrees: entry.declinationDegrees,
    coordinates: entry.coordinates,
    distanceLightYears: entry.distanceLightYears,
    nativeUnit: "light-year",
    nativePosition: entry.nativePosition,
    nativeExtent: clamp(entry.distanceLightYears * 0.015, 0.08, 0.6),
    recommendedDistanceMeters: entry.distanceLightYears * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear
  }));
  const deepSky = CELESTIAL_DEEP_SKY_CATALOG.map((entry) => freezeNavigationDescriptor({
    id: entry.id,
    label: entry.label,
    kind: "deep-sky-object",
    tier: "deep-sky",
    parentId: "sun",
    available: true,
    selectable: true,
    coordinateFrame: entry.coordinateFrame,
    coordinateEpoch: entry.coordinateEpoch,
    coordinateStatus: entry.coordinateStatus,
    rightAscensionHours: entry.rightAscensionHours,
    declinationDegrees: entry.declinationDegrees,
    coordinates: entry.coordinates,
    distanceLightYears: entry.distanceLightYears,
    nativeUnit: "light-year",
    nativePosition: entry.nativePosition,
    nativeExtent: CELESTIAL_DEEP_SKY_CLUSTER_PROFILES[entry.id]?.radiusLightYears
      || clamp(entry.distanceLightYears * 0.004, 4, 320),
    objectKind: CELESTIAL_DEEP_SKY_CLUSTER_PROFILES[entry.id]?.kind || "deep-sky-object",
    // The anchor keeps its catalogue position; only the camera framing is
    // capped so a Visit cannot land after the deep-sky root has retired.
    recommendedDistanceMeters: Math.min(
      entry.distanceLightYears,
      CELESTIAL_ATLAS_LOD_POLICY.transitionDistances.deepSkyToMilkyWay.endLightYears * 0.4
    ) * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear
  }));
  const milkyWayRegions = CELESTIAL_MILKY_WAY_REGION_CATALOG.map((entry) => freezeNavigationDescriptor({
    ...entry,
    kind: "milky-way-region",
    tier: "milky-way",
    parentId: entry.id === "milky-way" ? null : "milky-way",
    available: true,
    selectable: true,
    nativeUnit: "kilolight-year",
    coordinates: Object.freeze({
      frame: entry.coordinateFrame,
      status: entry.coordinateStatus,
      galacticLongitudeDegrees: entry.galacticLongitudeDegrees,
      galacticLatitudeDegrees: entry.galacticLatitudeDegrees
    }),
    // A galactic subregion is physically nearer than the full disk diameter,
    // but its navigable geometry belongs to the Milky Way LOD root. Enter
    // that root before reframing the region so Visit never targets an
    // intentionally hidden galaxy layer.
    recommendedDistanceMeters: Math.max(
      entry.recommendedDistanceLightYears,
      CELESTIAL_ATLAS_DISTANCE_POLICY.maximumLightYears
    ) * CELESTIAL_ATLAS_DISTANCE_POLICY.metersPerLightYear
  }));
  return Object.freeze([...solarBodies, ...nearbyStars, ...deepSky, ...milkyWayRegions]);
}

export const CELESTIAL_ATLAS_NAVIGATION_DESCRIPTORS = createCelestialNavigationDescriptors();

export function createCelestialBodyRegistry({ definitions = CELESTIAL_ATLAS_BODY_DEFINITIONS, overrides = {} } = {}) {
  const registry = {};
  for (const source of definitions) {
    const override = overrides?.[source.id] || {};
    const body = {
      ...source,
      ...override,
      id: String(source.id || "").trim().toLowerCase(),
      label: String(override.label ?? source.label ?? source.id),
      parentId: override.parentId === null
        ? null
        : String(override.parentId ?? source.parentId ?? "").trim().toLowerCase() || null,
      radius: positive(override.radius ?? source.radius, 0.1),
      focusRadius: positive(override.focusRadius ?? source.focusRadius, 0.5),
      selectable: override.selectable ?? source.selectable !== false,
      available: Boolean(override.available ?? source.available)
    };
    if (!body.id || registry[body.id]) {
      throw new Error(body.id ? `Duplicate celestial body: ${body.id}` : "Celestial body id is required");
    }
    registry[body.id] = freezeBody(body);
  }
  for (const body of Object.values(registry)) {
    if (body.parentId && !registry[body.parentId]) {
      throw new Error(`Unknown parent ${body.parentId} for celestial body ${body.id}`);
    }
  }
  return Object.freeze(registry);
}

function resolveOrbitalPosition(body, epochDays, orbitalScale) {
  if (!body.parentId || !(body.orbitRadius > 0)) return [0, 0, 0];
  const period = positive(body.orbitalPeriodDays, Infinity);
  const phase = finite(body.phaseDegrees) * DEG_TO_RAD;
  const advance = Number.isFinite(period) ? TAU * finite(epochDays) / period : 0;
  const angle = phase + advance;
  const inclination = finite(body.inclinationDegrees) * DEG_TO_RAD;
  const radius = positive(body.orbitRadius, 1) * positive(orbitalScale, 1);
  const projected = Math.sin(angle);
  return [
    Math.cos(angle) * radius,
    projected * Math.sin(inclination) * radius,
    projected * Math.cos(inclination) * radius
  ];
}

export function calculateCelestialLayout({
  registry = CELESTIAL_ATLAS_BODY_REGISTRY,
  epochDays = 0,
  originBodyId = "sun",
  orbitalScale = 1
} = {}) {
  const fallbackRootId = Object.values(registry).find((body) => !body.parentId)?.id;
  const originId = registry[originBodyId]
    ? originBodyId
    : (registry.sun ? "sun" : fallbackRootId);
  if (!registry[originId]) throw new Error("Celestial layout requires a root body");
  const absolutePositions = {};
  const visiting = new Set();

  const visit = (id) => {
    if (absolutePositions[id]) return absolutePositions[id];
    if (visiting.has(id)) throw new Error(`Cyclic celestial hierarchy at ${id}`);
    const body = registry[id];
    if (!body) throw new Error(`Unknown celestial body: ${id}`);
    visiting.add(id);
    const local = resolveOrbitalPosition(body, epochDays, orbitalScale);
    const parent = body.parentId ? visit(body.parentId) : [0, 0, 0];
    const absolute = [parent[0] + local[0], parent[1] + local[1], parent[2] + local[2]];
    absolutePositions[id] = Object.freeze(absolute);
    visiting.delete(id);
    return absolutePositions[id];
  };

  Object.keys(registry).forEach(visit);
  const origin = absolutePositions[originId];
  const positions = {};
  const orbitCenters = {};
  let extent = 0;
  for (const body of Object.values(registry)) {
    const absolute = absolutePositions[body.id];
    const position = Object.freeze([
      absolute[0] - origin[0],
      absolute[1] - origin[1],
      absolute[2] - origin[2]
    ]);
    positions[body.id] = position;
    const parent = body.parentId ? absolutePositions[body.parentId] : absolute;
    orbitCenters[body.id] = Object.freeze([
      parent[0] - origin[0],
      parent[1] - origin[1],
      parent[2] - origin[2]
    ]);
    extent = Math.max(extent, Math.hypot(...position) + positive(body.radius, 0.1));
  }
  return Object.freeze({
    epochDays: finite(epochDays),
    originBodyId: originId,
    orbitalScale: positive(orbitalScale, 1),
    extent,
    positions: Object.freeze(positions),
    absolutePositions: Object.freeze(absolutePositions),
    orbitCenters: Object.freeze(orbitCenters)
  });
}

export function calculateCelestialFocusFit({
  radius = 1,
  focusRadius = 0,
  verticalFovDegrees = 45,
  aspect = 1,
  fill = 0.62,
  padding = 1.08
} = {}) {
  const bodyRadius = positive(radius, 1);
  const safeAspect = positive(aspect, 1);
  const verticalHalfFov = clamp(verticalFovDegrees, 5, 140) * DEG_TO_RAD * 0.5;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * safeAspect);
  const limitingHalfFov = Math.max(2 * DEG_TO_RAD, Math.min(verticalHalfFov, horizontalHalfFov));
  const occupiedHalfAngle = limitingHalfFov * clamp(fill, 0.15, 0.92);
  const fittedDistance = bodyRadius / Math.sin(occupiedHalfAngle) * positive(padding, 1.08);
  const distance = Math.max(positive(focusRadius, bodyRadius * 2), fittedDistance, bodyRadius * 1.08);
  return Object.freeze({
    distance,
    near: Math.max(0.001, distance - bodyRadius * 1.75),
    far: Math.max(distance + bodyRadius * 6, distance * 3),
    limitingHalfFovRadians: limitingHalfFov,
    projectedFill: bodyRadius / distance / Math.sin(limitingHalfFov)
  });
}

export function calculateBodyFocusFit(bodyOrId, options = {}) {
  const body = typeof bodyOrId === "string"
    ? (options.registry || CELESTIAL_ATLAS_BODY_REGISTRY)[bodyOrId]
    : bodyOrId;
  if (!body) throw new Error(`Unknown celestial body: ${bodyOrId}`);
  return calculateCelestialFocusFit({
    ...options,
    radius: options.radius ?? body.radius,
    focusRadius: options.focusRadius ?? body.focusRadius
  });
}

function matrixElements(matrix) {
  const elements = matrix?.elements || matrix;
  return elements && elements.length === 16 ? elements : null;
}

export function projectCelestialPoint(position, viewProjectionMatrix, viewport = {}) {
  const [x, y, z] = vector3(position);
  const elements = matrixElements(viewProjectionMatrix);
  if (!elements) throw new Error("A 4x4 view-projection matrix is required");
  const clipX = elements[0] * x + elements[4] * y + elements[8] * z + elements[12];
  const clipY = elements[1] * x + elements[5] * y + elements[9] * z + elements[13];
  const clipZ = elements[2] * x + elements[6] * y + elements[10] * z + elements[14];
  const clipW = elements[3] * x + elements[7] * y + elements[11] * z + elements[15];
  const width = positive(viewport.width, 1);
  const height = positive(viewport.height, 1);
  const left = finite(viewport.left);
  const top = finite(viewport.top);
  if (!(clipW > 0)) {
    return Object.freeze({ x: 0, y: 0, ndcX: 0, ndcY: 0, ndcZ: 2, depth: Infinity, visible: false });
  }
  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;
  const ndcZ = clipZ / clipW;
  return Object.freeze({
    x: left + (ndcX * 0.5 + 0.5) * width,
    y: top + (-ndcY * 0.5 + 0.5) * height,
    ndcX,
    ndcY,
    ndcZ,
    depth: clipW,
    visible: ndcX >= -1 && ndcX <= 1 && ndcY >= -1 && ndcY <= 1 && ndcZ >= -1 && ndcZ <= 1
  });
}

export function isCelestialPointOccluded({
  cameraPosition = [0, 0, 0],
  targetPosition = [0, 0, 0],
  occluders = [],
  excludeId = null,
  radiusPadding = 1.01
} = {}) {
  const camera = vector3(cameraPosition);
  const target = vector3(targetPosition);
  const direction = [target[0] - camera[0], target[1] - camera[1], target[2] - camera[2]];
  const a = direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2;
  if (a < 1e-12) return false;
  for (const occluder of occluders) {
    if (!occluder || occluder.id === excludeId) continue;
    const center = vector3(occluder.position);
    const radius = positive(occluder.radius, 0) * positive(radiusPadding, 1.01);
    if (!(radius > 0)) continue;
    const offset = [camera[0] - center[0], camera[1] - center[1], camera[2] - center[2]];
    const b = 2 * (offset[0] * direction[0] + offset[1] * direction[1] + offset[2] * direction[2]);
    const c = offset[0] ** 2 + offset[1] ** 2 + offset[2] ** 2 - radius ** 2;
    const discriminant = b ** 2 - 4 * a * c;
    if (discriminant < 0) continue;
    const root = Math.sqrt(discriminant);
    const enter = (-b - root) / (2 * a);
    const leave = (-b + root) / (2 * a);
    if ((enter > 1e-5 && enter < 0.99999) || (leave > 1e-5 && leave < 0.99999)) return true;
  }
  return false;
}

const boxesOverlap = (a, b, gap) => !(
  a.right + gap <= b.left
  || a.left >= b.right + gap
  || a.bottom + gap <= b.top
  || a.top >= b.bottom + gap
);

export function prioritizeCelestialLabels(candidates = [], {
  selectedBodyId = null,
  focusedBodyId = null,
  maxLabels = 12,
  gap = 6
} = {}) {
  const ranked = candidates
    .filter((candidate) => candidate?.visible !== false && !candidate?.occluded)
    .map((candidate, index) => {
      const width = positive(candidate.width, Math.max(48, String(candidate.label || candidate.id || "").length * 8 + 22));
      const height = positive(candidate.height, 28);
      const x = finite(candidate.x);
      const y = finite(candidate.y);
      const priority = finite(candidate.priority)
        + (candidate.id === selectedBodyId ? 100000 : 0)
        + (candidate.id === focusedBodyId ? 50000 : 0)
        + (candidate.available ? 1000 : 0);
      return {
        ...candidate,
        width,
        height,
        priority,
        sourceIndex: index,
        bounds: {
          left: x - width * 0.5,
          right: x + width * 0.5,
          top: y,
          bottom: y + height
        }
      };
    })
    .sort((left, right) => right.priority - left.priority || left.sourceIndex - right.sourceIndex);
  const accepted = [];
  const limit = Math.max(0, Math.floor(finite(maxLabels, 12)));
  for (const candidate of ranked) {
    if (accepted.length >= limit) break;
    if (accepted.some((other) => boxesOverlap(candidate.bounds, other.bounds, positive(gap, 6)))) continue;
    accepted.push(Object.freeze(candidate));
  }
  return Object.freeze(accepted);
}

export function projectCelestialLabels({
  layout,
  registry = CELESTIAL_ATLAS_BODY_REGISTRY,
  viewProjectionMatrix,
  viewport,
  cameraPosition,
  labelSizes = {},
  selectedBodyId = null,
  focusedBodyId = null,
  maxLabels = 12,
  gap = 6,
  labelLift = 1.35
} = {}) {
  if (!layout?.positions) throw new Error("A celestial layout is required");
  const occluders = Object.values(registry).map((body) => ({
    id: body.id,
    position: layout.positions[body.id],
    radius: body.radius
  }));
  const candidates = Object.values(registry).map((body) => {
    const position = layout.positions[body.id];
    const anchor = [position[0], position[1] + body.radius * positive(labelLift, 1.35), position[2]];
    const projected = projectCelestialPoint(anchor, viewProjectionMatrix, viewport);
    const size = labelSizes[body.id] || {};
    return {
      id: body.id,
      label: body.label,
      available: body.available,
      selectable: body.selectable,
      x: projected.x,
      y: projected.y + 7,
      ndcZ: projected.ndcZ,
      depth: projected.depth,
      visible: projected.visible,
      occluded: projected.visible && isCelestialPointOccluded({
        cameraPosition,
        targetPosition: anchor,
        occluders,
        excludeId: body.id
      }),
      width: size.width,
      height: size.height,
      priority: body.radius * 100 - projected.depth * 0.01
    };
  });
  return prioritizeCelestialLabels(candidates, {
    selectedBodyId,
    focusedBodyId,
    maxLabels,
    gap
  });
}

function createOrbitPoints(THREE, body, segments, orbitalScale) {
  const points = [];
  const inclination = finite(body.inclinationDegrees) * DEG_TO_RAD;
  const radius = positive(body.orbitRadius, 1) * positive(orbitalScale, 1);
  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * TAU;
    const projected = Math.sin(angle);
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      projected * Math.sin(inclination) * radius,
      projected * Math.cos(inclination) * radius
    ));
  }
  return points;
}

function createOrbitSegments(THREE, body, segments, orbitalScale) {
  const points = createOrbitPoints(THREE, body, segments, orbitalScale);
  const pairs = [];
  for (let index = 0; index < points.length; index += 1) {
    pairs.push(points[index], points[(index + 1) % points.length]);
  }
  return pairs;
}

function requireThree(THREE) {
  for (const name of [
    "Group", "SphereGeometry", "RingGeometry", "PlaneGeometry", "BufferGeometry", "Mesh",
    "LineSegments", "Points", "MeshBasicMaterial", "MeshStandardMaterial", "LineBasicMaterial", "ShaderMaterial", "PointsMaterial", "DataTexture",
    "Float32BufferAttribute", "Color", "Vector3", "Quaternion"
  ]) {
    if (typeof THREE?.[name] !== "function") throw new Error(`Celestial atlas requires THREE.${name}`);
  }
}

export function createCelestialAtlas(THREE, {
  registry = CELESTIAL_ATLAS_BODY_REGISTRY,
  externalRoots = {},
  quality = "standard",
  epochDays = 0,
  originBodyId = "earth",
  orbitalScale = 1,
  galaxyTextureUrl = "",
  onInvalidate = null
} = {}) {
  requireThree(THREE);
  const root = new THREE.Group();
  const solarRoot = new THREE.Group();
  const orbitRoot = new THREE.Group();
  const bodyRoot = new THREE.Group();
  root.name = "celestial-atlas";
  solarRoot.name = "celestial-atlas-solar-system";
  orbitRoot.name = "celestial-atlas-orbits";
  bodyRoot.name = "celestial-atlas-bodies";
  root.add(solarRoot);
  solarRoot.add(orbitRoot, bodyRoot);

  const generatedGeometries = new Set();
  const generatedMaterials = new Set();
  const generatedTextures = new Set();
  const bodies = new Map();
  const orbits = new Map();
  const lowQuality = quality === "low";
  // These procedural globes can become the full-screen focus after a
  // double-click. Keep mobile economical, but give the standard tier enough
  // latitude samples for Jupiter/Saturn bands to read as surfaces rather than
  // interpolated low-poly wedges.
  const sphereWidth = lowQuality ? 36 : 96;
  const sphereHeight = lowQuality ? 24 : 64;
  const orbitSegments = lowQuality ? 48 : 96;

  const trackGeometry = (geometry) => (generatedGeometries.add(geometry), geometry);
  const trackMaterial = (material) => (generatedMaterials.add(material), material);
  const trackTexture = (texture) => (generatedTextures.add(texture), texture);
  const materialPresentationState = new WeakMap();
  const setObjectOpacity = (object, opacity = 1, { prewarm = false, emerge = false } = {}) => {
    const amount = clamp(opacity, 0, 1);
    object?.traverse?.((child) => {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!material) continue;
        if (!materialPresentationState.has(material)) {
          materialPresentationState.set(material, {
            opacity: Number.isFinite(material.opacity) ? material.opacity : 1,
            size: Number.isFinite(material.size) ? material.size : null,
            transparent: Boolean(material.transparent),
            depthWrite: material.depthWrite !== false
          });
        }
        const base = materialPresentationState.get(material);
        const transparent = base.transparent || amount < 0.999;
        if (material.transparent !== transparent) material.needsUpdate = true;
        material.opacity = base.opacity * amount;
        if (material.uniforms?.opacity) material.uniforms.opacity.value = base.opacity * amount;
        if (emerge && base.size != null) material.size = base.size
          * (CELESTIAL_ATLAS_LOD_POLICY.emergenceScaleFloor
            + (1 - CELESTIAL_ATLAS_LOD_POLICY.emergenceScaleFloor) * smoothstep(0, 1, amount));
        material.transparent = transparent;
        material.depthWrite = base.depthWrite && amount >= 0.999;
      }
    });
    object.visible = Boolean(prewarm) || amount > 0.001;
  };
  const externalFor = (id, body) => {
    const candidate = externalRoots instanceof Map ? externalRoots.get(id) : externalRoots?.[id];
    return typeof candidate === "function" ? candidate(body) : candidate;
  };

  const particulateData = createCelestialParticulateData({ quality: lowQuality ? "low" : "standard" });
  const particulateGeometry = trackGeometry(new THREE.BufferGeometry());
  particulateGeometry.setAttribute("position", new THREE.Float32BufferAttribute(particulateData.positions, 3));
  particulateGeometry.setAttribute("color", new THREE.Float32BufferAttribute(particulateData.colors, 3));
  const particulateMaterial = trackMaterial(new THREE.PointsMaterial({
    color: 0xffffff,
    vertexColors: true,
    size: lowQuality ? 0.026 : 0.021,
    sizeAttenuation: true,
    transparent: true,
    opacity: lowQuality ? 0.4 : 0.5,
    depthTest: true,
    depthWrite: false,
    toneMapped: true
  }));
  const particulateField = new THREE.Points(particulateGeometry, particulateMaterial);
  particulateField.name = "celestial-particulate-belts";
  particulateField.renderOrder = -2;
  particulateField.userData.celestialParticulates = Object.freeze({
    mainBelt: particulateData.mainCount,
    kuiperBelt: particulateData.kuiperCount
  });
  orbitRoot.add(particulateField);

  for (const body of Object.values(registry)) {
    if (body.parentId && body.orbitRadius > 0) {
      const orbitTier = body.parentId === "earth" ? "satellite"
        : body.id === "earth" ? "home"
          : body.orbitRadius <= 3.7 ? "inner" : "outer";
      const segments = Math.min(lowQuality ? 72 : 144,
        Math.round(orbitSegments + body.orbitRadius * (lowQuality ? 2 : 4)));
      const geometry = trackGeometry(new THREE.BufferGeometry().setFromPoints(
        createOrbitSegments(THREE, body, segments, orbitalScale)
      ));
      const material = trackMaterial(new THREE.LineBasicMaterial({
        color: orbitTier === "satellite" ? 0x74e7f2
          : orbitTier === "home" ? 0x48b8d8
            : orbitTier === "inner" ? 0x347e9c : 0x255d78,
        transparent: true,
        opacity: orbitTier === "satellite" ? 0.34
          : orbitTier === "home" ? 0.27
            : orbitTier === "inner" ? 0.2 : 0.14,
        depthTest: true,
        depthWrite: false,
        toneMapped: false
      }));
      const line = new THREE.LineSegments(geometry, material);
      line.name = `celestial-orbit-${body.id}`;
      line.renderOrder = -1;
      line.userData.celestialOrbitBodyId = body.id;
      line.userData.celestialOrbitTier = orbitTier;
      orbitRoot.add(line);
      orbits.set(body.id, line);
    }

    const anchor = new THREE.Group();
    anchor.name = `celestial-body-${body.id}`;
    anchor.userData.celestialBodyId = body.id;
    anchor.userData.celestialBody = body;
    const externalRoot = externalFor(body.id, body);
    let visual = externalRoot || null;
    let generated = false;
    if (!visual) {
      const geometry = trackGeometry(new THREE.SphereGeometry(body.radius, sphereWidth, sphereHeight));
      const surface = createCelestialPlanetSurfaceData(body, {
        width: lowQuality ? 128 : 512,
        height: lowQuality ? 64 : 256
      });
      const surfaceTexture = surface
        ? trackTexture(new THREE.DataTexture(surface.data, surface.width, surface.height, THREE.RGBAFormat, THREE.UnsignedByteType))
        : null;
      if (surfaceTexture) {
        surfaceTexture.name = `celestial-surface-${body.id}`;
        surfaceTexture.wrapS = THREE.RepeatWrapping;
        surfaceTexture.wrapT = THREE.ClampToEdgeWrapping;
        surfaceTexture.magFilter = THREE.LinearFilter;
        surfaceTexture.minFilter = THREE.LinearMipmapLinearFilter || THREE.LinearFilter;
        surfaceTexture.generateMipmaps = true;
        if (THREE.SRGBColorSpace) surfaceTexture.colorSpace = THREE.SRGBColorSpace;
        surfaceTexture.needsUpdate = true;
      }
      const profile = PLANET_SURFACES[body.id];
      const material = body.id === "sun"
        ? trackMaterial(new THREE.MeshBasicMaterial({ color: body.color, toneMapped: false }))
        : trackMaterial(new THREE.MeshStandardMaterial({
          color: surfaceTexture ? 0xffffff : body.color,
          map: surfaceTexture,
          emissive: body.color,
          emissiveIntensity: profile?.kind === "ice" ? 0.025 : 0.012,
          roughness: profile?.roughness ?? 0.86,
          metalness: 0
        }));
      visual = new THREE.Mesh(geometry, material);
      visual.name = `celestial-visual-${body.id}`;
      visual.rotation.z = (PLANET_SURFACES[body.id]?.tilt || 0) * DEG_TO_RAD;
      generated = true;
      if (body.ringRadius) {
        const ringGeometry = trackGeometry(new THREE.RingGeometry(body.radius * 1.25, body.ringRadius, 48));
        const ringMaterial = trackMaterial(new THREE.MeshStandardMaterial({
          color: 0xc6aa71,
          transparent: true,
          opacity: 0.66,
          side: THREE.DoubleSide,
          depthWrite: false,
          roughness: 0.72,
          metalness: 0
        }));
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.name = "celestial-saturn-rings";
        ring.rotation.x = Math.PI * 0.5;
        visual.add(ring);
      }
    }
    anchor.add(visual);
    bodyRoot.add(anchor);
    bodies.set(body.id, { body, anchor, visual, external: !generated });
  }

  const selection = new THREE.Group();
  selection.name = "celestial-selection";
  const ringGeometry = trackGeometry(new THREE.RingGeometry(0.992, 1, lowQuality ? 40 : 72));
  const ringMaterial = trackMaterial(new THREE.MeshBasicMaterial({
    color: 0x79f0ff,
    transparent: true,
    opacity: 0.36,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    toneMapped: false
  }));
  const selectionRing = new THREE.Mesh(ringGeometry, ringMaterial);
  selectionRing.name = "celestial-selection-ring";
  selection.add(selectionRing);
  selection.visible = false;
  solarRoot.add(selection);

  let layout = null;
  let selectedBodyId = null;
  let selectedPlaceId = null;
  let galaxy = null;
  let selectionLocator = null;
  let disposed = false;
  let semanticPresentation = resolveCelestialAtlasPresentation();
  let cosmicTransitionOpacity = 1;
  const navigationPlaces = createCelestialNavigationDescriptors({ registry });
  const navigationPlaceById = new Map(navigationPlaces.map((place) => [place.id, place]));
  const lineRevealState = {
    stellar: 1,
    deepSky: 1,
    stellarTarget: 0,
    deepSkyTarget: 0,
    phase: 0,
    reducedMotion: false
  };
  const ensureGalaxy = () => {
    if (galaxy) return galaxy;
    const deepRoot = new THREE.Group(), stellarRoot = new THREE.Group(), deepSkyRoot = new THREE.Group();
    const pivotRoot = new THREE.Group(), gridRoot = new THREE.Group(), galaxyRoot = new THREE.Group();
    deepRoot.name = "celestial-atlas-deep-space";
    deepRoot.userData.celestialLod = "deep-space";
    stellarRoot.name = "celestial-atlas-stellar-neighborhood";
    stellarRoot.userData.celestialLod = "stellar-neighborhood";
    deepSkyRoot.name = "celestial-atlas-deep-sky";
    deepSkyRoot.userData.celestialLod = "deep-sky";
    pivotRoot.name = "celestial-atlas-persistent-sun-pivot";
    pivotRoot.userData.celestialLod = "persistent-pivot";
    gridRoot.name = "celestial-atlas-stellar-grid-root";
    gridRoot.userData.celestialLod = "adaptive-grid";
    galaxyRoot.name = "celestial-atlas-milky-way";
    galaxyRoot.userData.celestialLod = "milky-way";
    galaxyRoot.rotation.z = -CELESTIAL_GALAXY_DISPLAY.inclinationRadians;
    deepRoot.add(stellarRoot, deepSkyRoot, pivotRoot, gridRoot, galaxyRoot);

    const createGrid = (parent, name, extent, divisions, y, opacity) => {
      const positions = [], colors = [];
      const majorEvery = 8;
      const axisIndex = Math.floor(divisions * 0.5);
      for (let index = 0; index <= divisions; index += 1) {
        const coordinate = -extent + index / divisions * extent * 2;
        const isAxis = index === axisIndex;
        const isMajor = index % majorEvery === 0;
        const tone = isAxis ? [0.22, 0.72, 0.88]
          : isMajor ? [0.095, 0.34, 0.46]
            : [0.025, 0.105, 0.145];
        positions.push(-extent, 0, coordinate, extent, 0, coordinate,
          coordinate, 0, -extent, coordinate, 0, extent);
        colors.push(...tone, ...tone, ...tone, ...tone);
      }
      const geometry = trackGeometry(new THREE.BufferGeometry());
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      const grid = new THREE.LineSegments(geometry, trackMaterial(new THREE.LineBasicMaterial({
        color: 0xffffff, vertexColors: true, transparent: true, opacity,
        depthTest: true, depthWrite: false, toneMapped: false
      })));
      grid.name = name;
      grid.position.y = y;
      grid.renderOrder = -3;
      grid.userData.celestialGridProfile = Object.freeze({
        minorDivisions: divisions,
        majorEvery,
        normalizedHalfExtent: extent,
        layers: Object.freeze(["minor", "major", "axis"])
      });
      parent.add(grid);
      return grid;
    };
    const grid = createGrid(gridRoot, "celestial-adaptive-grid", 1,
      lowQuality ? 64 : 96, 0, 0.32);
    grid.userData.celestialGridOwner = "stellar";
    const stellarGrid = grid;

    // Every PointsMaterial draws a screen-aligned quad. Without a shared alpha
    // mask the nearby stars and deep-sky anchors therefore reveal that quad as
    // a square "panel" during semantic cross-fades. Keep the mask large enough
    // for the fixed-size named markers and linearly filter it so outward scroll
    // transitions cannot expose nearest-neighbour pixels.
    const pointMapSize = 32, pointMapData = new Uint8Array(pointMapSize * pointMapSize * 4);
    for (let y = 0; y < pointMapSize; y += 1) for (let x = 0; x < pointMapSize; x += 1) {
      const radius = Math.hypot((x + 0.5) / pointMapSize * 2 - 1, (y + 0.5) / pointMapSize * 2 - 1);
      const value = Math.round(255 * Math.pow(Math.max(0, 1 - radius), 1.5));
      const offset = (y * pointMapSize + x) * 4;
      pointMapData[offset] = pointMapData[offset + 1] = pointMapData[offset + 2] = value;
      pointMapData[offset + 3] = 255;
    }
    const pointAlphaMap = trackTexture(new THREE.DataTexture(
      pointMapData, pointMapSize, pointMapSize, THREE.RGBAFormat, THREE.UnsignedByteType
    ));
    pointAlphaMap.minFilter = pointAlphaMap.magFilter = THREE.LinearFilter;
    pointAlphaMap.generateMipmaps = false;
    pointAlphaMap.needsUpdate = true;

    const stellarData = createCelestialStellarNeighborhoodData({ quality: lowQuality ? "low" : "standard" });
    const stellarGeometry = trackGeometry(new THREE.BufferGeometry());
    stellarGeometry.setAttribute("position", new THREE.Float32BufferAttribute(stellarData.positions, 3));
    stellarGeometry.setAttribute("color", new THREE.Float32BufferAttribute(stellarData.colors, 3));
    const stellarField = new THREE.Points(stellarGeometry, trackMaterial(new THREE.PointsMaterial({
      color: 0xffffff, vertexColors: true, size: lowQuality ? 1.35 : 1.1, sizeAttenuation: false,
      alphaMap: pointAlphaMap, alphaTest: 0.008,
      transparent: true, opacity: 0.82, depthTest: true, depthWrite: false, toneMapped: false
    })));
    stellarField.name = "celestial-stellar-field";
    stellarRoot.add(stellarField);

    const createChartLabel = ({ parent = stellarRoot, name, text, position, yOffset, color, opacity, dataKey, dataValue }) => {
      const bitmap = createCelestialLabelBitmap(text);
      const texture = trackTexture(new THREE.DataTexture(
        bitmap.data, bitmap.width, bitmap.height, THREE.RGBAFormat, THREE.UnsignedByteType
      ));
      texture.name = `${name}-texture`;
      texture.magFilter = texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      const label = new THREE.Mesh(
        trackGeometry(new THREE.PlaneGeometry(bitmap.width / bitmap.height, 1)),
        trackMaterial(new THREE.MeshBasicMaterial({
          color, map: texture, transparent: true, opacity, alphaTest: 0.025,
          depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
        }))
      );
      label.name = name;
      label.position.fromArray(position);
      label.position.y += yOffset;
      label.renderOrder = 3;
      label.userData[dataKey] = dataValue;
      label.userData.celestialLabelText = text;
      label.userData.celestialLabelBasePosition = Object.freeze(label.position.toArray());
      label.userData.celestialLabelRaster = Object.freeze({
        width: bitmap.width, height: bitmap.height, bytes: bitmap.data.byteLength, source: bitmap.source
      });
      parent.add(label);
      return label;
    };

    const revealVertexShader = "attribute float celestialAlong,celestialSeed;varying float vAlong,vSeed;void main(){vAlong=celestialAlong;vSeed=celestialSeed;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
    const revealFragmentShader = "uniform vec3 color;uniform float opacity,reveal,phase,animated;varying float vAlong,vSeed;void main(){float disclosed=smoothstep(0.,.02,reveal)*(1.-smoothstep(reveal-.035,reveal+.01,vAlong));float pulse=.8+.2*sin((vAlong*7.+vSeed*11.+phase*6.2831853));float alpha=opacity*disclosed*mix(1.,pulse,animated);if(alpha<.001)discard;gl_FragColor=vec4(color,alpha);}";
    const createRevealLineMaterial = (color, opacity) => trackMaterial(new THREE.ShaderMaterial({
      transparent: true,
      opacity,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        color: { value: new THREE.Color(color) },
        opacity: { value: opacity },
        reveal: { value: 1 },
        phase: { value: 0 },
        animated: { value: 0 }
      },
      vertexShader: revealVertexShader,
      fragmentShader: revealFragmentShader
    }));
    const pushStem = (positions, along, seeds, position, index, count) => {
      const seed = (index + 0.5) / Math.max(1, count);
      positions.push(0, 0, 0, ...position,
        position[0], -3.1, position[2], ...position);
      along.push(0, 1, 0, 1);
      seeds.push(seed, seed, seed, seed);
    };

    const namedPositions = [], namedColors = [], stemPositions = [], stemAlong = [], stemSeeds = [], stellarLabels = [];
    for (let index = 0; index < stellarData.named.length; index += 1) {
      const star = stellarData.named[index];
      namedPositions.push(...star.position);
      namedColors.push(0.74, 0.94, 1);
      pushStem(stemPositions, stemAlong, stemSeeds, star.position, index, stellarData.named.length);
      stellarLabels.push(createChartLabel({
        name: `celestial-star-label-${star.id}`, text: star.label, position: star.position,
        yOffset: 0.9, color: 0x73e8f6, opacity: 0.88,
        dataKey: "celestialStarLabel", dataValue: star.id
      }));
    }
    const namedGeometry = trackGeometry(new THREE.BufferGeometry());
    namedGeometry.setAttribute("position", new THREE.Float32BufferAttribute(namedPositions, 3));
    namedGeometry.setAttribute("color", new THREE.Float32BufferAttribute(namedColors, 3));
    const namedStars = new THREE.Points(namedGeometry, trackMaterial(new THREE.PointsMaterial({
      color: 0xffffff, vertexColors: true, size: lowQuality ? 3.4 : 4.2, sizeAttenuation: false,
      alphaMap: pointAlphaMap, alphaTest: 0.008,
      transparent: true, opacity: 0.95, depthTest: true, depthWrite: false, toneMapped: false
    })));
    namedStars.name = "celestial-named-stars";
    const stemsGeometry = trackGeometry(new THREE.BufferGeometry());
    stemsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(stemPositions, 3));
    stemsGeometry.setAttribute("celestialAlong", new THREE.Float32BufferAttribute(stemAlong, 1));
    stemsGeometry.setAttribute("celestialSeed", new THREE.Float32BufferAttribute(stemSeeds, 1));
    const stellarStems = new THREE.LineSegments(stemsGeometry, createRevealLineMaterial(0x39c9d8, 0.3));
    stellarStems.name = "celestial-stellar-links";
    stellarRoot.add(stellarStems, namedStars);

    const deepPositions = [], deepStems = [], deepStemAlong = [], deepStemSeeds = [], deepLabels = [];
    for (let index = 0; index < CELESTIAL_DEEP_SKY_CATALOG.length; index += 1) {
      const { id, label: labelText, nativePosition: position } = CELESTIAL_DEEP_SKY_CATALOG[index];
      deepPositions.push(...position);
      pushStem(deepStems, deepStemAlong, deepStemSeeds, position, index, CELESTIAL_DEEP_SKY_CATALOG.length);
      deepLabels.push(createChartLabel({
        parent: deepSkyRoot, name: `celestial-deep-label-${id}`, text: labelText, position,
        yOffset: 1.1, color: 0xae62ff, opacity: 0.9,
        dataKey: "celestialDeepSkyLabel", dataValue: id
      }));
    }
    const deepGeometry = trackGeometry(new THREE.BufferGeometry());
    deepGeometry.setAttribute("position", new THREE.Float32BufferAttribute(deepPositions, 3));
    const deepSky = new THREE.Points(deepGeometry, trackMaterial(new THREE.PointsMaterial({
      color: 0xc28aff, size: lowQuality ? 4.2 : 5.1, sizeAttenuation: false,
      alphaMap: pointAlphaMap, alphaTest: 0.008,
      transparent: true, opacity: 0.92, depthTest: true, depthWrite: false, toneMapped: false
    })));
    deepSky.name = "celestial-deep-sky";
    const deepClusterData = createCelestialDeepSkyClusterData({
      quality: lowQuality ? "low" : "standard"
    });
    const deepClusterGeometry = trackGeometry(new THREE.BufferGeometry());
    deepClusterGeometry.setAttribute("position", new THREE.Float32BufferAttribute(deepClusterData.positions, 3));
    deepClusterGeometry.setAttribute("color", new THREE.Float32BufferAttribute(deepClusterData.colors, 3));
    const deepClusterField = new THREE.Points(deepClusterGeometry, trackMaterial(new THREE.PointsMaterial({
      color: 0xffffff, vertexColors: true, size: lowQuality ? 1.35 : 1.65, sizeAttenuation: false,
      alphaMap: pointAlphaMap, alphaTest: 0.008,
      transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending,
      depthTest: true, depthWrite: false, toneMapped: false
    })));
    deepClusterField.name = "celestial-deep-sky-cluster-members";
    deepClusterField.userData.celestialDeepSkyClusterCount = deepClusterData.clusters.length;
    deepClusterField.userData.celestialDeepSkyMemberCount = deepClusterData.count;
    const deepStemGeometry = trackGeometry(new THREE.BufferGeometry());
    deepStemGeometry.setAttribute("position", new THREE.Float32BufferAttribute(deepStems, 3));
    deepStemGeometry.setAttribute("celestialAlong", new THREE.Float32BufferAttribute(deepStemAlong, 1));
    deepStemGeometry.setAttribute("celestialSeed", new THREE.Float32BufferAttribute(deepStemSeeds, 1));
    const deepSkyStems = new THREE.LineSegments(deepStemGeometry, createRevealLineMaterial(0x8742ec, 0.42));
    deepSkyStems.name = "celestial-deep-sky-links";
    deepSkyRoot.add(deepSkyStems, deepClusterField, deepSky);

    const data = createCelestialGalaxyData({ quality: lowQuality ? "low" : "standard" });
    const fields = {};
    const selectionLocatorGeometry = trackGeometry(new THREE.BufferGeometry());
    selectionLocatorGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const selectionLocatorHalo = new THREE.Points(selectionLocatorGeometry, trackMaterial(new THREE.PointsMaterial({
      color: 0x73e8f6, size: lowQuality ? 42 : 48, sizeAttenuation: false,
      alphaMap: pointAlphaMap, alphaTest: 0.004, transparent: true, opacity: 0.25,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
    })));
    const selectionLocatorCore = new THREE.Points(selectionLocatorGeometry, trackMaterial(new THREE.PointsMaterial({
      color: 0xe9fbff, size: lowQuality ? 15 : 18, sizeAttenuation: false,
      alphaMap: pointAlphaMap, alphaTest: 0.008, transparent: true, opacity: 0.94,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
    })));
    selectionLocator = new THREE.Group();
    selectionLocator.name = "celestial-selection-locator";
    selectionLocator.userData.celestialSelectionLocator = true;
    selectionLocatorHalo.name = "celestial-selection-locator-halo";
    selectionLocatorCore.name = "celestial-selection-locator-core";
    selectionLocatorHalo.renderOrder = 28;
    selectionLocatorCore.renderOrder = 29;
    selectionLocator.add(selectionLocatorHalo, selectionLocatorCore);
    selectionLocator.visible = false;
    selection.add(selectionLocator);
    const fieldSpecs = {
      // The source arrays are already quality-bounded. Uploading each one
      // directly gives the low and standard tiers 9.2x and 11.1x their former
      // perceived sparkle counts without adding draws or sampled CPU copies.
      spiral: { size: lowQuality ? 0.12 : 0.14, opacity: lowQuality ? 0.045 : 0.052 },
      bulge: { size: lowQuality ? 0.16 : 0.18, opacity: lowQuality ? 0.06 : 0.068 },
      dust: { size: lowQuality ? 0.08 : 0.1, opacity: lowQuality ? 0.008 : 0.01 }
    };
    for (const [kind, spec] of Object.entries(fieldSpecs)) {
      const fieldData = data[kind];
      const renderedCount = fieldData.count;
      const geometry = trackGeometry(new THREE.BufferGeometry());
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(fieldData.positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(fieldData.colors, 3));
      const material = trackMaterial(new THREE.PointsMaterial({
        color: 0xffffff,
        vertexColors: true,
        size: spec.size,
        sizeAttenuation: true,
        transparent: true,
        opacity: spec.opacity,
        alphaMap: pointAlphaMap,
        alphaTest: 0.01,
        blending: kind === "dust" ? THREE.NormalBlending : THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        toneMapped: false
      }));
      const field = new THREE.Points(geometry, material);
      field.name = `celestial-galaxy-${kind}`;
      field.userData.celestialGalaxyLayer = kind;
      field.userData.celestialGalaxyPointSpec = Object.freeze({
        role: "sparkle",
        sourceCount: fieldData.count,
        renderedCount,
        stride: 1,
        gpuVertexBytes: fieldData.positions.byteLength + fieldData.colors.byteLength,
        size: spec.size,
        opacity: spec.opacity,
        sizeAttenuation: true,
        blending: kind === "dust" ? "normal" : "additive"
      });
      galaxyRoot.add(field);
      fields[kind] = field;
    }
    let textureLayer = null;
    const textureLayers = [], volumeLayers = [];
    const textureReadiness = { value: galaxyTextureUrl ? 0 : 1, target: galaxyTextureUrl ? 0 : 1 };
    if (THREE.PlaneGeometry && THREE.ShaderMaterial) {
      const glowGeometry = trackGeometry(new THREE.PlaneGeometry(
        CELESTIAL_GALAXY_DISPLAY.radius * 2.2, CELESTIAL_GALAXY_DISPLAY.radius * 2.2
      ));
      const emptyGalaxyMap = trackTexture(new THREE.DataTexture(
        new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType
      ));
      emptyGalaxyMap.needsUpdate = true;
      const layerVertexShader = "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
      const textureFragmentShader = "uniform sampler2D galaxyMap;uniform float opacity,density,slice,uvRotation,detailBias,textureReady;uniform vec2 uvOffset;varying vec2 vUv;void main(){vec2 q=vUv-.5;float cs=cos(uvRotation),sn=sin(uvRotation);vec2 uv=mat2(cs,-sn,sn,cs)*q+.5+uvOffset;vec2 p=(uv-.5)*2.;vec3 c=texture2D(galaxyMap,uv).rgb;float l=max(c.r,max(c.g,c.b));float edge=1.-smoothstep(.7,1.,length(p));float signal=smoothstep(.006+detailBias,.2+detailBias,l);float knot=smoothstep(.08+detailBias,.42+detailBias,l);vec3 light=c*(1.04+l*.5)+vec3(.014,.022,.05)*signal*max(0.,1.-detailBias*6.);float alpha=signal*edge*density*(.72+knot*.28)*opacity*textureReady;gl_FragColor=vec4(light,alpha);}";
      const textureLayerSpecs = lowQuality ? [
        ["celestial-milky-way-texture", 0, 1, 0.72, 0, 0, 0, 0],
        ["celestial-milky-way-texture-lower", -0.55, 0.98, 0.06, -0.006, -0.003, 0.002, 0.11],
        ["celestial-milky-way-texture-upper", 0.55, 0.98, 0.06, 0.006, 0.003, -0.002, 0.12]
      ] : [
        ["celestial-milky-way-texture", 0, 1, 0.72, 0, 0, 0, 0],
        ["celestial-milky-way-texture-lower", -0.62, 0.975, 0.035, -0.007, -0.003, 0.002, 0.14],
        ["celestial-milky-way-texture-upper", 0.62, 0.975, 0.035, 0.007, 0.003, -0.002, 0.15],
        ["celestial-milky-way-texture-lower-mid", -0.31, 0.992, 0.075, -0.003, -0.0015, -0.001, 0.07],
        ["celestial-milky-way-texture-upper-mid", 0.31, 0.992, 0.075, 0.003, 0.0015, 0.001, 0.08]
      ];
      for (const [name, height, scale, density, uvRotation, offsetX, offsetY, detailBias] of textureLayerSpecs) {
        const material = trackMaterial(new THREE.ShaderMaterial({
          transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
          uniforms: {
            opacity: { value: 1 }, density: { value: density }, slice: { value: height },
            uvRotation: { value: uvRotation }, uvOffset: { value: new THREE.Vector2(offsetX, offsetY) },
            detailBias: { value: detailBias }, textureReady: { value: textureReadiness.value },
            galaxyMap: { value: emptyGalaxyMap }
          },
          vertexShader: layerVertexShader,
          fragmentShader: textureFragmentShader
        }));
        const layer = new THREE.Mesh(glowGeometry, material);
        layer.name = name;
        layer.rotation.x = -Math.PI * 0.5;
        layer.position.y = height * CELESTIAL_GALAXY_DISPLAY.thickness;
        layer.scale.setScalar(scale);
        layer.renderOrder = 10 + height;
        layer.userData.celestialGalaxyLayer = "texture-slice";
        layer.userData.celestialGalaxySlice = height;
        layer.userData.celestialGalaxyTextureSpec = Object.freeze({
          height, scale, density, uvRotation, uvOffset: Object.freeze([offsetX, offsetY]), detailBias
        });
        galaxyRoot.add(layer);
        textureLayers.push(layer);
      }
      [textureLayer] = textureLayers;
      if (galaxyTextureUrl && THREE.TextureLoader) {
        new THREE.TextureLoader().load(galaxyTextureUrl, (texture) => {
          if (disposed) return texture.dispose?.();
          trackTexture(texture);
          if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
          if (THREE.LinearFilter) texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = lowQuality ? 2 : 4;
          for (const layer of textureLayers) {
            layer.material.uniforms.galaxyMap.value = texture;
            layer.material.needsUpdate = true;
          }
          textureReadiness.target = 1;
          onInvalidate?.();
        }, undefined, () => {});
      }
      const volumeFragmentShader = "uniform float opacity,density,slice,absorption;varying vec2 vUv;float n(vec2 p){return .5+.25*sin(dot(p,vec2(12.9898,78.233)))+.25*sin(dot(p,vec2(39.346,11.135)));}void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);float grain=n(p*3.1+slice*5.7),warp=n(p*7.3-slice*3.2);float arm=smoothstep(.12,.92,.5+.5*cos(a*4.-r*10.+(grain-.5)*2.4+slice*.7));float envelope=1.-smoothstep(.36,1.,r),core=exp(-r*r*11.);float dust=smoothstep(.58,.9,.5+.5*sin(a*4.-r*12.6+warp*2.1+slice));float dustAlpha=dust*absorption*(1.-core)*envelope;vec3 c=mix(vec3(.055,.14,.32),vec3(1.,.55,.2),clamp(core*.92+grain*.12,0.,1.));c=mix(c,vec3(.008,.004,.014),dust*.82*(1.-core));float emission=(.018+arm*.105+core*.34)*envelope*(.72+grain*.28)*density;gl_FragColor=vec4(c,(emission+dustAlpha)*opacity);}";
      const sliceCount = lowQuality ? 3 : 5;
      for (let index = 0; index < sliceCount; index += 1) {
        const centered = sliceCount === 1 ? 0 : index / (sliceCount - 1) * 2 - 1;
        const density = 0.34 + (1 - Math.abs(centered)) * 0.42;
        const glow = new THREE.Mesh(glowGeometry, trackMaterial(new THREE.ShaderMaterial({
          transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
          uniforms: {
            opacity: { value: 1 }, density: { value: density }, slice: { value: centered },
            absorption: { value: 0.16 + (1 - Math.abs(centered)) * 0.12 }
          },
          vertexShader: layerVertexShader,
          fragmentShader: volumeFragmentShader
        })));
        glow.name = `celestial-milky-way-volume-${index + 1}`;
        glow.rotation.x = -Math.PI * 0.5;
        glow.position.y = centered * CELESTIAL_GALAXY_DISPLAY.thickness * 0.62;
        glow.scale.setScalar(1 - Math.abs(centered) * 0.08);
        glow.renderOrder = 10 + centered * 0.62;
        glow.userData.celestialGalaxyLayer = "haze-dust-slice";
        glow.userData.celestialGalaxySlice = centered * 0.62;
        galaxyRoot.add(glow);
        volumeLayers.push(glow);
      }
    }
    // Keep the galactic disc and its grid in one stable world-space plane.
    // Camera orbit changes the projected face/edge view; the scene never
    // billboards or reorients itself around the viewer.
    galaxyRoot.userData.celestialCameraAligned = false;
    const solarMarker = new THREE.Group();
    solarMarker.name = "celestial-solar-system-marker";
    solarMarker.userData.celestialLod = "solar-system-marker";
    const markerCoreGeometry = trackGeometry(new THREE.BufferGeometry());
    markerCoreGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const markerCore = new THREE.Points(
      markerCoreGeometry,
      trackMaterial(new THREE.PointsMaterial({
        color: 0xfff0c2,
        size: lowQuality ? 3.8 : 4.6,
        sizeAttenuation: false,
        alphaMap: pointAlphaMap,
        alphaTest: 0.01,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      }))
    );
    markerCore.name = "celestial-solar-system-marker-core";
    markerCore.renderOrder = 25;
    const markerHaloGeometry = trackGeometry(new THREE.BufferGeometry());
    markerHaloGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const markerHalo = new THREE.Points(
      markerHaloGeometry,
      trackMaterial(new THREE.PointsMaterial({
        color: 0xffc76f,
        size: lowQuality ? 10 : 12,
        sizeAttenuation: false,
        alphaMap: pointAlphaMap,
        alphaTest: 0.005,
        transparent: true,
        opacity: 0.18,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      }))
    );
    markerHalo.name = "celestial-solar-system-marker-halo";
    markerHalo.renderOrder = 24;
    solarMarker.add(markerHalo, markerCore);
    pivotRoot.add(solarMarker);
    const solarMarkerLabel = createChartLabel({
      parent: pivotRoot, name: "celestial-solar-system-marker-label", text: "SUN", position: [0, 0, 0],
      yOffset: 0.8, color: 0xffe4a3, opacity: 0.94,
      dataKey: "celestialSolarMarkerLabel", dataValue: "sun"
    });
    solarMarkerLabel.material.depthTest = false;
    solarMarkerLabel.renderOrder = 26;
    deepRoot.visible = false;
    root.add(deepRoot);
    const depthLayers = Object.freeze([...textureLayers, ...volumeLayers]);
    galaxy = {
      root: deepRoot, stellarRoot, deepSkyRoot, pivotRoot, gridRoot, galaxyRoot,
      fields: Object.freeze(fields), grid, stellarGrid,
      stellarField, namedStars, stellarStems, stellarLabels: Object.freeze(stellarLabels),
      deepSky, deepClusterField, deepClusterData, deepSkyStems, deepLabels: Object.freeze(deepLabels),
      cameraLabels: Object.freeze([solarMarkerLabel, ...stellarLabels, ...deepLabels]),
      textureLayer, textureLayers: Object.freeze(textureLayers),
      volumeLayers: Object.freeze(volumeLayers), depthLayers, solarMarker, solarMarkerLabel,
      selectionLocator, data, stellarData, textureReadiness
    };
    return galaxy;
  };

  const updateGalaxyPlacement = () => {
    if (!galaxy || !layout) return;
    const sun = vector3(layout.positions.sun);
    galaxy.root.position.fromArray(sun);
    galaxy.stellarRoot.position.set(0, 0, 0);
    galaxy.deepSkyRoot.position.set(0, 0, 0);
    galaxy.pivotRoot.position.set(0, 0, 0);
    galaxy.gridRoot.position.set(0, 0, 0);
    galaxy.galaxyRoot.position.fromArray(CELESTIAL_GALAXY_DISPLAY.galacticCenterOffsetFromSun.map(
      (coordinate) => coordinate * CELESTIAL_ATLAS_UNIT_SCALES.galaxyUnitScale
    ));
  };

  const lineRevealDiagnostics = () => Object.freeze({
    active: Boolean(galaxy && (semanticPresentation.stellarOpacity > 0.001
      || semanticPresentation.deepSkyOpacity > 0.001
      || Math.abs(galaxy.textureReadiness.target - galaxy.textureReadiness.value) > 0.002)),
    stellarReveal: lineRevealState.stellar,
    deepSkyReveal: lineRevealState.deepSky,
    phase: lineRevealState.phase,
    reducedMotion: lineRevealState.reducedMotion,
    bufferUploads: 0
  });
  const applyLineRevealUniforms = () => {
    if (!galaxy) return;
    const write = (object, reveal, visible) => {
      const uniforms = object?.material?.uniforms;
      if (!uniforms) return;
      uniforms.reveal.value = visible ? clamp(reveal, 0, 1) : 0;
      uniforms.phase.value = lineRevealState.phase;
      uniforms.animated.value = visible && !lineRevealState.reducedMotion ? 1 : 0;
    };
    write(galaxy.stellarStems, lineRevealState.stellar,
      semanticPresentation.stellarOpacity > 0.001);
    write(galaxy.deepSkyStems, lineRevealState.deepSky,
      semanticPresentation.deepSkyOpacity > 0.001);
    for (const layer of galaxy.textureLayers) {
      if (layer.material.uniforms?.textureReady) {
        layer.material.uniforms.textureReady.value = galaxy.textureReadiness.value;
      }
    }
    const stellarLabelReveal = smoothstep(0.12, 0.72, lineRevealState.stellar);
    const deepLabelReveal = smoothstep(0.12, 0.72, lineRevealState.deepSky);
    for (const label of galaxy.stellarLabels) setObjectOpacity(label,
      (semanticPresentation.nearbyStarOpacities[label.userData.celestialStarLabel] || 0)
        * stellarLabelReveal,
      { prewarm: semanticPresentation.prewarmRoots.stellar });
    for (const label of galaxy.deepLabels) setObjectOpacity(label,
      (semanticPresentation.deepSkyEntryOpacities[label.userData.celestialDeepSkyLabel] || 0)
        * deepLabelReveal,
      { prewarm: semanticPresentation.prewarmRoots.deepSky });
  };
  const setLineReveal = ({ stellar = lineRevealState.stellar,
    deepSky = lineRevealState.deepSky, phase = lineRevealState.phase,
    reducedMotion = lineRevealState.reducedMotion } = {}) => {
    lineRevealState.reducedMotion = Boolean(reducedMotion);
    lineRevealState.stellar = semanticPresentation.stellarOpacity > 0.001 ? clamp(stellar, 0, 1) : 0;
    lineRevealState.deepSky = semanticPresentation.deepSkyOpacity > 0.001 ? clamp(deepSky, 0, 1) : 0;
    if (!lineRevealState.reducedMotion) lineRevealState.phase = finite(phase) % 1;
    applyLineRevealUniforms();
    return lineRevealDiagnostics();
  };
  const updateLineReveal = ({ deltaSeconds = 1 / 60, elapsedSeconds = null,
    reducedMotion = lineRevealState.reducedMotion } = {}) => {
    const reduced = Boolean(reducedMotion);
    const seconds = clamp(deltaSeconds, 0, 0.25);
    lineRevealState.reducedMotion = reduced;
    if (reduced) {
      lineRevealState.stellar = lineRevealState.stellarTarget;
      lineRevealState.deepSky = lineRevealState.deepSkyTarget;
      if (galaxy) galaxy.textureReadiness.value = galaxy.textureReadiness.target;
    } else {
      const blend = 1 - Math.exp(-seconds * 5.5);
      lineRevealState.stellar += (lineRevealState.stellarTarget - lineRevealState.stellar) * blend;
      lineRevealState.deepSky += (lineRevealState.deepSkyTarget - lineRevealState.deepSky) * blend;
      if (galaxy) galaxy.textureReadiness.value += (galaxy.textureReadiness.target
        - galaxy.textureReadiness.value) * (1 - Math.exp(-seconds * 2.8));
      lineRevealState.phase = elapsedSeconds == null
        ? (lineRevealState.phase + seconds * 0.12) % 1
        : (finite(elapsedSeconds) * 0.12) % 1;
    }
    applyLineRevealUniforms();
    return lineRevealDiagnostics();
  };

  const setSemanticTier = ({ band = "planet", progress = 0, representedDistanceMeters = null,
    distanceMeters = null, metersPerUnit = CELESTIAL_ATLAS_DISTANCE_POLICY.minimumMeters } = {}) => {
    const sunPosition = layout?.positions?.sun || [0, 0, 0];
    semanticPresentation = resolveCelestialAtlasPresentation({
      band, progress, representedDistanceMeters, distanceMeters, metersPerUnit, sunPosition
    });
    lineRevealState.stellarTarget = semanticPresentation.stellarOpacity;
    lineRevealState.deepSkyTarget = semanticPresentation.deepSkyOpacity;
    if (lineRevealState.reducedMotion) {
      lineRevealState.stellar = lineRevealState.stellarTarget;
      lineRevealState.deepSky = lineRevealState.deepSkyTarget;
    }
    setObjectOpacity(solarRoot, semanticPresentation.solarDetailOpacity);
    solarRoot.scale.setScalar(semanticPresentation.rootScales.solar);
    if (semanticPresentation.galaxyRequired) {
      const presentation = ensureGalaxy();
      updateGalaxyPlacement();
      const stellarPrewarm = semanticPresentation.prewarmRoots.stellar;
      const deepPrewarm = semanticPresentation.prewarmRoots.deepSky;
      const galaxyPrewarm = semanticPresentation.prewarmRoots.milkyWay;
      setObjectOpacity(presentation.stellarField, semanticPresentation.stellarOpacity,
        { prewarm: stellarPrewarm, emerge: true });
      setObjectOpacity(presentation.namedStars, semanticPresentation.stellarOpacity,
        { prewarm: stellarPrewarm, emerge: true });
      setObjectOpacity(presentation.stellarStems, semanticPresentation.stellarOpacity,
        { prewarm: stellarPrewarm });
      setObjectOpacity(presentation.deepSky, semanticPresentation.deepSkyOpacity,
        { prewarm: deepPrewarm, emerge: true });
      setObjectOpacity(presentation.deepClusterField, semanticPresentation.deepSkyOpacity,
        { prewarm: deepPrewarm, emerge: true });
      setObjectOpacity(presentation.deepSkyStems, semanticPresentation.deepSkyOpacity,
        { prewarm: deepPrewarm });
      setObjectOpacity(presentation.galaxyRoot,
        semanticPresentation.galaxyOpacity * cosmicTransitionOpacity,
        { prewarm: galaxyPrewarm, emerge: true });
      presentation.galaxyRoot.visible = galaxyPrewarm || semanticPresentation.galaxyOpacity
        * cosmicTransitionOpacity > 0.001;
      const galaxyOwnsGrid = semanticPresentation.galaxyGridOpacity > 0;
      const gridLocalSpacing = semanticPresentation.gridSpacing
        * (semanticPresentation.gridUnit === "kly" && !galaxyOwnsGrid ? 1_000 : 1);
      // A normalized carrier can be large without losing precision because
      // the parent root rebases in physical units. Ninety-six base intervals
      // keep its edge beyond the widest portrait/landscape frustum while the
      // sparse, colour-ranked line buffer avoids the moire wall produced by a
      // hundreds-of-lines-per-axis screen-space grid.
      const gridHalfExtent = Math.max(24, gridLocalSpacing * 96);
      // The distance grid is an ecliptic/world-up measuring plane, matching a
      // Blender floor. The Milky Way has its own fixed physical inclination;
      // parenting the grid to it made both rotate into a face-on poster.
      presentation.gridRoot.add(presentation.grid);
      presentation.grid.name = galaxyOwnsGrid ? "celestial-galaxy-grid" : "celestial-stellar-grid";
      presentation.grid.userData.celestialGridOwner = semanticPresentation.gridOwner;
      presentation.grid.userData.celestialGridUnit = semanticPresentation.gridUnit;
      presentation.grid.userData.celestialGridBaseSpacing = gridLocalSpacing;
      presentation.grid.userData.celestialGridMinorSpacing = gridHalfExtent * 2
        / presentation.grid.userData.celestialGridProfile.minorDivisions;
      presentation.grid.userData.celestialGridMajorSpacing = presentation.grid.userData.celestialGridMinorSpacing
        * presentation.grid.userData.celestialGridProfile.majorEvery;
      presentation.grid.position.y = galaxyOwnsGrid
        ? -CELESTIAL_GALAXY_DISPLAY.thickness * 1.075 : -gridLocalSpacing;
      presentation.grid.scale.set(gridHalfExtent, 1, gridHalfExtent);
      setObjectOpacity(presentation.grid,
        Math.max(semanticPresentation.stellarGridOpacity, semanticPresentation.galaxyGridOpacity));
      setObjectOpacity(presentation.solarMarker, semanticPresentation.solarMarkerOpacity);
      setObjectOpacity(presentation.solarMarkerLabel, semanticPresentation.solarMarkerOpacity);
      presentation.stellarRoot.scale.setScalar(semanticPresentation.rootScales.stellar);
      presentation.deepSkyRoot.scale.setScalar(semanticPresentation.rootScales.deepSky);
      // kly spacing under the ly root and direct kly spacing under the galaxy
      // root are mathematically equivalent. Switching both factors together
      // keeps one grid continuous without interpolating through a 1000x size.
      presentation.gridRoot.scale.setScalar(galaxyOwnsGrid
        ? semanticPresentation.rootScales.milkyWay
        : semanticPresentation.rootScales.deepSky);
      presentation.pivotRoot.scale.setScalar(semanticPresentation.rootScales.solarMarker);
      presentation.galaxyRoot.scale.setScalar(semanticPresentation.rootScales.milkyWay);
      presentation.stellarRoot.visible = stellarPrewarm || semanticPresentation.stellarOpacity > 0.001;
      presentation.deepSkyRoot.visible = deepPrewarm || semanticPresentation.deepSkyOpacity > 0.001;
      presentation.gridRoot.visible = Math.max(semanticPresentation.stellarGridOpacity,
        semanticPresentation.galaxyGridOpacity) > 0.001;
      presentation.pivotRoot.visible = semanticPresentation.solarMarkerOpacity > 0.001;
      presentation.root.visible = stellarPrewarm || deepPrewarm || galaxyPrewarm
        || semanticPresentation.stellarOpacity > 0.001
        || semanticPresentation.deepSkyOpacity > 0.001
        || semanticPresentation.galaxyOpacity > 0.001
        || semanticPresentation.solarMarkerOpacity > 0.001;
      applyLineRevealUniforms();
    } else if (galaxy) {
      galaxy.root.visible = false;
    }
    return semanticPresentation;
  };

  const setCosmicTransitionOpacity = (value = 1) => {
    cosmicTransitionOpacity = clamp(value, 0, 1);
    if (galaxy) {
      const opacity = (semanticPresentation?.galaxyOpacity || 0) * cosmicTransitionOpacity;
      const prewarm = Boolean(semanticPresentation?.prewarmRoots?.milkyWay);
      setObjectOpacity(galaxy.galaxyRoot, opacity, { prewarm, emerge: true });
      galaxy.galaxyRoot.visible = prewarm || opacity > 0.001;
    }
    return cosmicTransitionOpacity;
  };

  // A renderer can retain a higher-detail close body while the physical
  // atlas proxy resolves underneath it.  Keep that ownership handoff inside
  // the atlas material-state system so opacity, depth writing, and reverse
  // zoom all use the same symmetric path instead of toggling a mesh abruptly.
  const setBodyPresentationOpacity = (id, value = 1) => {
    const record = bodies.get(String(id || "").toLowerCase());
    if (!record?.visual) return false;
    setObjectOpacity(record.visual, clamp(value, 0, 1));
    return true;
  };

  const applyLayout = (next = {}) => {
    layout = next?.positions ? next : calculateCelestialLayout({
      registry,
      epochDays: next.epochDays ?? layout?.epochDays ?? epochDays,
      originBodyId: next.originBodyId ?? layout?.originBodyId ?? originBodyId,
      orbitalScale: next.orbitalScale ?? layout?.orbitalScale ?? orbitalScale
    });
    for (const [id, record] of bodies) {
      record.anchor.position.fromArray(layout.positions[id]);
      const orbit = orbits.get(id);
      if (orbit) {
        orbit.position.fromArray(layout.orbitCenters[id]);
        orbit.scale.setScalar(layout.orbitalScale / positive(orbitalScale, 1));
      }
    }
    particulateField.position.fromArray(layout.positions.sun);
    particulateField.scale.setScalar(layout.orbitalScale / positive(orbitalScale, 1));
    updateGalaxyPlacement();
    setSemanticTier(semanticPresentation);
    return layout;
  };

  const getNavigationPlaces = (context = {}) => {
    const request = context && typeof context === "object" ? context : {};
    if (request.all === true) return navigationPlaces;
    const hasPresentationInput = ["band", "progress", "representedDistanceMeters", "distanceMeters"]
      .some((key) => Object.hasOwn(request, key));
    const presentation = request.presentation || (hasPresentationInput
      ? resolveCelestialAtlasPresentation({ ...request, sunPosition: layout?.positions?.sun || [0, 0, 0] })
      : semanticPresentation);
    const requestedKinds = request.kinds == null ? null : new Set(
      Array.isArray(request.kinds) ? request.kinds : [request.kinds]
    );
    const visible = navigationPlaces.filter((place) => {
      if (requestedKinds && !requestedKinds.has(place.kind)) return false;
      if (place.id === selectedPlaceId) return true;
      if (place.kind === "solar-body") {
        return presentation.solarDetailOpacity > 0.001
          || (place.id === "sun" && presentation.solarMarkerOpacity > 0.001);
      }
      if (place.kind === "nearby-star") {
        return (presentation.nearbyStarOpacities?.[place.id] || 0) > 0.001;
      }
      if (place.kind === "deep-sky-object") {
        return (presentation.deepSkyEntryOpacities?.[place.id] || 0) > 0.001;
      }
      return place.kind === "milky-way-region" && presentation.galaxyOpacity > 0.001;
    });
    return Object.freeze(visible);
  };

  const getNavigationTarget = (id) => {
    const requestedId = String(id || "").trim().toLowerCase();
    const canonicalId = resolveCelestialNavigationPlaceId(requestedId);
    const descriptor = navigationPlaceById.get(canonicalId) || null;
    if (!descriptor || !layout) return null;
    const sun = vector3(layout.positions.sun);
    let localPosition, position, extent, nativePosition, targetRoot, anchor = null, positionInRoot;
    if (descriptor.kind === "solar-body") {
      localPosition = vector3(layout.positions[descriptor.id]);
      nativePosition = localPosition;
      position = localPosition;
      extent = descriptor.nativeExtent;
      anchor = bodies.get(descriptor.id)?.anchor || null;
      targetRoot = anchor || solarRoot;
      positionInRoot = anchor ? [0, 0, 0] : localPosition;
    } else if (descriptor.kind === "nearby-star" || descriptor.kind === "deep-sky-object") {
      const presentation = ensureGalaxy();
      updateGalaxyPlacement();
      presentation.stellarRoot.scale.setScalar(semanticPresentation.rootScales.stellar);
      presentation.deepSkyRoot.scale.setScalar(semanticPresentation.rootScales.deepSky);
      localPosition = vector3(descriptor.nativePosition);
      nativePosition = localPosition;
      position = localPosition.map((coordinate, index) => sun[index]
        + coordinate * CELESTIAL_ATLAS_UNIT_SCALES.deepUnitScale);
      // Keep focus extents in the target root's native unit. The renderer
      // resolves them through root.getWorldScale(); pre-converting here would
      // apply the light-year scale twice and frame the selected place from
      // hundreds of millions of times too far away.
      extent = descriptor.nativeExtent;
      targetRoot = descriptor.kind === "nearby-star" ? presentation.stellarRoot : presentation.deepSkyRoot;
      positionInRoot = localPosition;
    } else {
      const presentation = ensureGalaxy();
      updateGalaxyPlacement();
      presentation.galaxyRoot.scale.setScalar(semanticPresentation.rootScales.milkyWay);
      localPosition = vector3(descriptor.nativePosition);
      nativePosition = localPosition;
      const angle = -CELESTIAL_GALAXY_DISPLAY.inclinationRadians;
      const rotated = [
        localPosition[0] * Math.cos(angle) - localPosition[1] * Math.sin(angle),
        localPosition[0] * Math.sin(angle) + localPosition[1] * Math.cos(angle),
        localPosition[2]
      ];
      position = rotated.map((coordinate, index) => sun[index]
        + (CELESTIAL_GALAXY_DISPLAY.galacticCenterOffsetFromSun[index] + coordinate)
          * CELESTIAL_ATLAS_UNIT_SCALES.galaxyUnitScale);
      extent = descriptor.nativeExtent;
      targetRoot = presentation.galaxyRoot;
      positionInRoot = localPosition;
    }
    return Object.freeze({
      ...descriptor,
      descriptor,
      requestedId,
      canonicalId,
      root: targetRoot,
      anchor,
      position: Object.freeze(position),
      localPosition: Object.freeze(localPosition),
      nativePosition: Object.freeze(nativePosition),
      positionInRoot: Object.freeze(positionInRoot),
      extent,
      nativeExtent: descriptor.nativeExtent,
      recommendedDistanceMeters: descriptor.recommendedDistanceMeters
    });
  };

  const setSelectedBody = (id = null) => {
    if (galaxy) for (const label of galaxy.cameraLabels) {
      if (!label.userData.celestialSelectedPlaceLabel) continue;
      label.position.fromArray(label.userData.celestialLabelBasePosition);
      delete label.userData.celestialSelectedPlaceLabel;
    }
    const record = id ? bodies.get(id) : null;
    if (!record || !record.body.selectable) {
      selectedBodyId = null;
      selectedPlaceId = null;
      selection.visible = false;
      solarRoot.add(selection);
      selection.position.set(0, 0, 0);
      selection.scale.setScalar(1);
      if (selectionLocator) selectionLocator.visible = false;
      return null;
    }
    selectedBodyId = id;
    selectedPlaceId = id;
    record.anchor.add(selection);
    selection.position.set(0, 0, 0);
    selection.scale.setScalar(record.body.radius * 1.1);
    selectionRing.material.color.setHex(0x79f0ff);
    if (selectionLocator) selectionLocator.visible = false;
    selection.visible = true;
    return record;
  };

  const setSelectedPlace = (id = null) => {
    const target = getNavigationTarget(id);
    if (!target || target.selectable === false) {
      setSelectedBody(null);
      return null;
    }
    if (target.kind === "solar-body") {
      setSelectedBody(target.id);
      return target;
    }
    const presentation = ensureGalaxy();
    for (const label of presentation.cameraLabels) {
      if (!label.userData.celestialSelectedPlaceLabel) continue;
      label.position.fromArray(label.userData.celestialLabelBasePosition);
      delete label.userData.celestialSelectedPlaceLabel;
    }
    updateGalaxyPlacement();
    const parent = target.kind === "nearby-star" ? presentation.stellarRoot
      : target.kind === "deep-sky-object" ? presentation.deepSkyRoot
        : presentation.galaxyRoot;
    selectedBodyId = null;
    selectedPlaceId = target.id;
    parent.add(selection);
    selection.position.fromArray(target.localPosition);
    selection.scale.setScalar(target.nativeExtent * 1.12);
    const locatorColor = target.kind === "deep-sky-object" ? 0xae62ff
      : target.kind === "milky-way-region" ? 0xffc76f : 0x73e8f6;
    selectionRing.material.color.setHex(locatorColor);
    if (selectionLocator) {
      selectionLocator.visible = true;
      selectionLocator.children[0]?.material?.color?.setHex(locatorColor);
      selectionLocator.children[1]?.material?.color?.setHex(target.kind === "deep-sky-object"
        ? 0xf4e6ff : target.kind === "milky-way-region" ? 0xfff2c7 : 0xe9fbff);
    }
    const selectedLabel = presentation.cameraLabels.find((label) => target.id === (
      label.userData.celestialStarLabel || label.userData.celestialDeepSkyLabel
      || label.userData.celestialSolarMarkerLabel
    ));
    if (selectedLabel) {
      selectedLabel.position.fromArray(target.localPosition);
      selectedLabel.position.y += Math.max(0.004, target.nativeExtent * 0.05);
      selectedLabel.userData.celestialSelectedPlaceLabel = true;
    }
    selection.visible = true;
    return target;
  };

  const facingCameraWorldQuaternion = new THREE.Quaternion();
  const facingParentWorldQuaternion = new THREE.Quaternion();
  const facingCameraWorldPosition = new THREE.Vector3();
  const facingObjectWorldPosition = new THREE.Vector3();
  const facingParentWorldScale = new THREE.Vector3();
  const facingProjectedPosition = new THREE.Vector3();
  const galaxyLocalUp = new THREE.Vector3(0, 1, 0);
  const galaxyDiscNormal = new THREE.Vector3();
  const galaxyCameraDirection = new THREE.Vector3();
  const galaxySunDirection = new THREE.Vector3();
  const galaxyAlignment = new THREE.Quaternion();
  const chartLabelCandidates = [], nearbyLabelCandidates = [], deepLabelCandidates = [], acceptedLabelCandidates = [];
  const labelCandidateOrder = (left, right) => Number(right.selected) - Number(left.selected)
    || Number(right.retained) - Number(left.retained)
    || left.index - right.index;
  const acceptChartLabels = (candidates, limit, totalLimit) => {
    let accepted = 0;
    for (const candidate of candidates) {
      if (accepted >= limit || acceptedLabelCandidates.length >= totalLimit) break;
      if (candidate.accepted) continue;
      let collides = false;
      for (const other of acceptedLabelCandidates) {
        if (candidate.left < other.right && candidate.right > other.left
          && candidate.top > other.bottom && candidate.bottom < other.top) {
          collides = true;
          break;
        }
      }
      if (collides) continue;
      candidate.accepted = true;
      acceptedLabelCandidates.push(candidate);
      accepted += 1;
    }
  };
  const updateSelectionFacingCamera = (camera) => {
    if (!camera) return false;
    const cameraWorld = typeof camera.getWorldQuaternion === "function"
      ? camera.getWorldQuaternion(facingCameraWorldQuaternion)
      : camera.quaternion;
    const cameraPosition = typeof camera.getWorldPosition === "function"
      ? camera.getWorldPosition(facingCameraWorldPosition)
      : camera.position;
    const faceCamera = (object, includeHidden = false) => {
      if (!object || (!includeHidden && !object.visible) || !cameraWorld) return false;
      if (typeof object.parent?.getWorldQuaternion === "function") {
        const parentWorld = object.parent.getWorldQuaternion(facingParentWorldQuaternion).invert();
        object.quaternion.copy(parentWorld.multiply(cameraWorld));
      } else {
        object.quaternion.copy(cameraWorld);
      }
      return true;
    };
    let updated = faceCamera(selection);
    if (galaxy?.galaxyRoot.visible && cameraPosition && galaxy.depthLayers?.length) {
      galaxy.galaxyRoot.getWorldQuaternion(galaxyAlignment);
      galaxyDiscNormal.copy(galaxyLocalUp).applyQuaternion(galaxyAlignment).normalize();
      galaxy.galaxyRoot.getWorldPosition(facingObjectWorldPosition);
      const cameraSide = Math.sign(galaxyDiscNormal.dot(
        galaxyCameraDirection.copy(cameraPosition).sub(facingObjectWorldPosition)
      )) || 1;
      for (const layer of galaxy.depthLayers) {
        layer.renderOrder = 10 + cameraSide * finite(layer.userData.celestialGalaxySlice) * 2;
      }
      updated = true;
    }
    if (galaxy?.root.visible && cameraPosition) {
      const fovScale = Math.tan(positive(camera.fov, 50) * DEG_TO_RAD * 0.5);
      const cameraAspect = positive(camera.aspect, 1), budget = lowQuality || cameraAspect < 0.82 ? 7 : 14;
      chartLabelCandidates.length = nearbyLabelCandidates.length = deepLabelCandidates.length = acceptedLabelCandidates.length = 0;
      for (let index = 0; index < galaxy.cameraLabels.length; index += 1) {
        const label = galaxy.cameraLabels[index], material = Array.isArray(label.material) ? label.material[0] : label.material;
        const selected = selectedPlaceId === (label.userData.celestialStarLabel
          || label.userData.celestialDeepSkyLabel || label.userData.celestialSolarMarkerLabel);
        const retained = selected || label.userData.celestialCollisionVisible === true;
        label.visible = false;
        label.userData.celestialCollisionVisible = false;
        if (!material || material.opacity < 0.004 || !faceCamera(label, true)) {
          label.userData.celestialCollisionVisible = false;
          continue;
        }
        label.getWorldPosition(facingObjectWorldPosition);
        label.parent?.getWorldScale?.(facingParentWorldScale);
        const parentScale = Math.max(1e-9, Math.abs(facingParentWorldScale.x || 1),
          Math.abs(facingParentWorldScale.y || 1), Math.abs(facingParentWorldScale.z || 1));
        const emergenceScale = label.userData.celestialDeepSkyLabel
          ? semanticPresentation.emergenceScales.deepSky
          : label.userData.celestialStarLabel
            ? semanticPresentation.emergenceScales.stellar : 1;
        label.scale.setScalar(clamp(
          facingObjectWorldPosition.distanceTo(cameraPosition) * fovScale * 0.035,
          0.02, 64
        ) * (selected ? 0.55 : 1) * emergenceScale / parentScale);
        facingProjectedPosition.copy(facingObjectWorldPosition).project(camera);
        const labelAspect = positive(label.userData.celestialLabelRaster?.width, 1)
          / positive(label.userData.celestialLabelRaster?.height, 1);
        const halfHeight = 0.0205, halfWidth = 0.035 * labelAspect / cameraAspect * 0.5 + 0.005;
        if (facingProjectedPosition.z < -1.05 || facingProjectedPosition.z > 1.05
          || Math.abs(facingProjectedPosition.x) > 1.04 + halfWidth
          || Math.abs(facingProjectedPosition.y) > 1.04 + halfHeight) {
          label.userData.celestialCollisionVisible = false;
          continue;
        }
        const candidate = label.userData.celestialLabelCandidate || (label.userData.celestialLabelCandidate = {});
        Object.assign(candidate, {
          label, index, selected, retained, accepted: false,
          left: facingProjectedPosition.x - halfWidth, right: facingProjectedPosition.x + halfWidth,
          top: facingProjectedPosition.y + halfHeight, bottom: facingProjectedPosition.y - halfHeight
        });
        chartLabelCandidates.push(candidate);
        (label.userData.celestialDeepSkyLabel ? deepLabelCandidates : nearbyLabelCandidates).push(candidate);
        updated = true;
      }
      nearbyLabelCandidates.sort(labelCandidateOrder);
      deepLabelCandidates.sort(labelCandidateOrder);
      chartLabelCandidates.sort(labelCandidateOrder);
      const deepQuota = deepLabelCandidates.length ? Math.min(deepLabelCandidates.length, lowQuality ? 2 : 4) : 0;
      acceptChartLabels(nearbyLabelCandidates, budget - deepQuota, budget);
      acceptChartLabels(deepLabelCandidates, budget - acceptedLabelCandidates.length, budget);
      acceptChartLabels(chartLabelCandidates, budget - acceptedLabelCandidates.length, budget);
      for (const candidate of acceptedLabelCandidates) {
        candidate.label.visible = true;
        candidate.label.userData.celestialCollisionVisible = true;
      }
      galaxy.visibleLabelCount = acceptedLabelCandidates.length;
      galaxy.labelBudget = budget;
    }
    return updated;
  };

  applyLayout();

  return Object.freeze({
    root,
    solarRoot,
    orbitRoot,
    bodyRoot,
    particulateField,
    bodies,
    orbits,
    selection,
    get galaxy() { return galaxy; },
    get semanticPresentation() { return semanticPresentation; },
    get layout() { return layout; },
    get selectedBodyId() { return selectedBodyId; },
    get selectedPlaceId() { return selectedPlaceId; },
    applyLayout,
    ensureGalaxy,
    setSemanticTier,
    setCosmicTransitionOpacity,
    setBodyPresentationOpacity,
    setLineReveal,
    updateLineReveal,
    setSelectedBody,
    setSelectedPlace,
    updateSelectionFacingCamera,
    getNavigationPlaces,
    getNavigationTarget,
    getBody: (id) => bodies.get(id) || null,
    focusFit: (id, options = {}) => calculateBodyFocusFit(id, { registry, ...options }),
    dispose() {
      disposed = true;
      for (const record of bodies.values()) {
        if (record.external) record.anchor.remove(record.visual);
      }
      selection.removeFromParent();
      root.clear();
      generatedGeometries.forEach((geometry) => geometry.dispose());
      generatedMaterials.forEach((material) => material.dispose());
      generatedTextures.forEach((texture) => texture.dispose());
      generatedGeometries.clear();
      generatedMaterials.clear();
      generatedTextures.clear();
    }
  });
}
