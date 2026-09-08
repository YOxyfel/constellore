const TAU = Math.PI * 2;
const LIGHT_YEAR_METERS = 9_460_730_472_580_800;
const LEGACY_MAXIMUM_LIGHT_YEARS = 203_884;
const OBSERVABLE_RADIUS_LIGHT_YEARS = 46_500_000_000;
const TRANSITION_FACTOR = 2;
const STANDARD_WHEEL_MULTIPLIER = 1.2;
const COSMOLOGY_PREWARM_FACTOR = 1.35;
const CANONICAL_UNIVERSE_COLOR = 0x8bc9d7;
const LAST_SCATTERING_RADIUS_LIGHT_YEARS = 45_200_000_000;
const HORIZON_THICKNESS_LIGHT_YEARS = 720_000_000;

// Once a galaxy or cluster is below the renderer's resolving power it behaves
// like an emissive point-spread function, not like a metre-sized body. Keep
// these kernels at a restrained, stable apparent diameter while their *spatial
// separation* continues to shrink with the physical camera. Multiplying by the
// precision-cell dolly is what makes the apparent PSF diameter continuous when
// metresPerUnit rebases; sizeAttenuation remains enabled so camera orbit and
// depth still read as a true 3D volume.
const UNRESOLVED_PSF_SIZE = Object.freeze({
  low: Object.freeze({
    "density-samples": 0.007,
    "procedural-structure-cores": 0.028,
    "catalog-anchors": 0.038,
    "survey-filament-density": 0.005
  }),
  standard: Object.freeze({
    "density-samples": 0.009,
    "procedural-structure-cores": 0.036,
    "catalog-anchors": 0.048,
    "survey-filament-density": 0.006
  })
});

// The web is one stable curve rendered at three radiance scales.  These are
// perceptual widths rather than world-space tubes: keeping every pass on the
// same BufferGeometry is what prevents a filament from being replaced during
// a semantic zoom hand-off.
export const CINEMATIC_FILAMENT_PASSES = Object.freeze([
  Object.freeze({ id: "haze", width: 1.35, opacity: 0.16, sharpness: 1.25 }),
  Object.freeze({ id: "strand", width: 0.62, opacity: 0.2, sharpness: 2.8 }),
  Object.freeze({ id: "spine", width: 0.16, opacity: 0.12, sharpness: 6.5 })
]);

export function resolveCosmicQualityPolicy({
  quality = "standard",
  effectsLevel = "full",
  reducedMotion = false,
  devicePixelRatio = 1
} = {}) {
  const lowQuality = quality === "low";
  const requestedEffects = String(effectsLevel || "full").toLowerCase();
  const off = requestedEffects === "off";
  const restrained = lowQuality || requestedEffects === "low" || requestedEffects === "reduced";
  const expensiveDisplay = Number(devicePixelRatio) > 2.25;
  const raySteps = off ? 0 : restrained ? (expensiveDisplay ? 8 : 10)
    : expensiveDisplay ? 18 : 24;
  const splatLayers = off ? 1 : restrained ? 2 : expensiveDisplay ? 3 : 4;
  return Object.freeze({
    id: off ? "off" : restrained ? "restrained" : expensiveDisplay ? "balanced" : "cinematic",
    raySteps,
    splatLayers,
    filamentPasses: CINEMATIC_FILAMENT_PASSES.length,
    visibleFilamentPasses: off ? 0 : restrained ? 2 : CINEMATIC_FILAMENT_PASSES.length,
    animate: !off && !Boolean(reducedMotion),
    volumesEnabled: !off
  });
}

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
  const amount = clamp((finite(value) - minimum) / Math.max(1e-12, maximum - minimum), 0, 1);
  return amount * amount * (3 - 2 * amount);
};

const mix = (from, to, amount) => from + (to - from) * clamp(amount, 0, 1);

const mixHexColor = (from, to, amount) => {
  const weight = clamp(amount, 0, 1);
  const channel = (shift) => Math.round(mix((from >>> shift) & 0xff, (to >>> shift) & 0xff, weight));
  return channel(16) << 16 | channel(8) << 8 | channel(0);
};

const freezeVector = (value = [0, 0, 0]) => Object.freeze([
  finite(value?.[0]), finite(value?.[1]), finite(value?.[2])
]);

const freezeTier = (tier) => Object.freeze({
  ...tier,
  pivot: Object.freeze({ ...tier.pivot })
});

export const CELESTIAL_COSMOLOGY_DISTANCE_POLICY = Object.freeze({
  metersPerLightYear: LIGHT_YEAR_METERS,
  legacyMaximumLightYears: LEGACY_MAXIMUM_LIGHT_YEARS,
  observableRadiusLightYears: OBSERVABLE_RADIUS_LIGHT_YEARS,
  standardWheelMultiplier: 1.2,
  placementDistance: "comoving",
  displayDistances: Object.freeze(["redshift", "lookback-time", "comoving-distance"]),
  cosmology: Object.freeze({ model: "flat-lambda-cdm", h0KilometersPerSecondPerMegaparsec: 67.4, omegaMatter: 0.315 })
});

export const CELESTIAL_COSMOLOGY_ENTRY_TRANSITION = Object.freeze({
  startLightYears: LEGACY_MAXIMUM_LIGHT_YEARS,
  endLightYears: 2_500_000,
  wheelPulses: Math.log(2_500_000 / LEGACY_MAXIMUM_LIGHT_YEARS)
    / Math.log(STANDARD_WHEEL_MULTIPLIER)
});

export function resolveCelestialCosmologyEntryOpacity({
  distanceMeters = LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS
} = {}) {
  const lightYears = positive(distanceMeters, LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS)
    / LIGHT_YEAR_METERS;
  return smoothstep(Math.log(CELESTIAL_COSMOLOGY_ENTRY_TRANSITION.startLightYears),
    Math.log(CELESTIAL_COSMOLOGY_ENTRY_TRANSITION.endLightYears), Math.log(lightYears));
}

export const CELESTIAL_COSMOLOGY_TIER_DEFINITIONS = Object.freeze([
  freezeTier({
    id: "local-group",
    label: "Local Group",
    minimumLightYears: LEGACY_MAXIMUM_LIGHT_YEARS,
    maximumLightYears: 10_000_000,
    nativeUnitLightYears: 1_000_000,
    color: 0x72d4df,
    pivot: {
      id: "local-group-fit",
      kind: "fitted-barycenter",
      reference: "milky-way-m31",
      observerCentered: false,
      scientificCertainty: "approximate"
    }
  }),
  freezeTier({
    id: "nearby-groups",
    label: "Nearby Groups",
    minimumLightYears: 10_000_000,
    maximumLightYears: 330_000_000,
    nativeUnitLightYears: 10_000_000,
    color: 0x67b9d1,
    pivot: {
      id: "local-volume-fit",
      kind: "catalog-fit",
      reference: "local-volume",
      observerCentered: false,
      scientificCertainty: "catalog-derived"
    }
  }),
  freezeTier({
    id: "supercluster",
    label: "Supercluster",
    minimumLightYears: 330_000_000,
    maximumLightYears: 1_400_000_000,
    nativeUnitLightYears: 100_000_000,
    color: 0x9b78d4,
    pivot: {
      id: "laniakea-flow-fit",
      kind: "velocity-basin-fit",
      reference: "cosmicflows",
      observerCentered: false,
      scientificCertainty: "probabilistic"
    }
  }),
  freezeTier({
    id: "cosmic-web",
    label: "Cosmic Web",
    minimumLightYears: 1_400_000_000,
    maximumLightYears: 10_000_000_000,
    nativeUnitLightYears: 1_000_000_000,
    color: 0xc06ee2,
    pivot: {
      id: "observer-survey-volume",
      kind: "observer-origin",
      reference: "past-light-cone",
      observerCentered: true,
      scientificCertainty: "survey-reconstruction"
    }
  }),
  freezeTier({
    id: "observable-universe",
    label: "Observable Universe",
    minimumLightYears: 10_000_000_000,
    maximumLightYears: OBSERVABLE_RADIUS_LIGHT_YEARS,
    nativeUnitLightYears: 1_000_000_000,
    color: 0xd7b3ef,
    pivot: {
      id: "observer-particle-horizon",
      kind: "observer-origin",
      reference: "observable-particle-horizon",
      observerCentered: true,
      scientificCertainty: "cosmology-dependent"
    }
  })
]);

export const CELESTIAL_COSMOLOGY_TIER_IDS = Object.freeze(
  CELESTIAL_COSMOLOGY_TIER_DEFINITIONS.map(({ id }) => id)
);

const TIER_BY_ID = new Map(CELESTIAL_COSMOLOGY_TIER_DEFINITIONS.map((tier) => [tier.id, tier]));

const RAW_NAVIGATION_CATALOG = Object.freeze([
  // Our home galaxy and its best-known Local Group neighbours. A zero distance
  // means the observer is inside the structure; recommendedDistanceMeters below
  // still frames it at the owning semantic scale.
  ["milky-way-home", "Milky Way (Home)", "local-group", "spiral-galaxy", 0, 17.761, -29.008, 100_000, null, null, false, true],
  ["large-magellanic-cloud", "Large Magellanic Cloud", "local-group", "dwarf-galaxy", 163_000, 5.39, -69.756, 32_200],
  ["small-magellanic-cloud", "Small Magellanic Cloud", "local-group", "dwarf-galaxy", 200_000, 0.88, -72.829, 18_900],
  ["andromeda", "Andromeda Galaxy", "local-group", "spiral-galaxy", 2_500_000, 0.712, 41.269, 260_000],
  ["triangulum", "Triangulum Galaxy", "local-group", "spiral-galaxy", 2_730_000, 1.564, 30.66, 60_000],

  // Nearby groups highlighted in the scale references.
  ["ic342-maffei-group", "IC 342 / Maffei Group", "nearby-groups", "galaxy-group", 10_000_000, 3.78, 68.1, 4_000_000],
  ["m81-group", "M81 Group", "nearby-groups", "galaxy-group", 12_000_000, 9.926, 69.065, 1_500_000],
  ["centaurus-a-group", "Centaurus A Group", "nearby-groups", "galaxy-group", 11_500_000, 13.424, -43.019, 2_000_000],
  ["sculptor-group", "Sculptor Group", "nearby-groups", "galaxy-group", 11_400_000, 0.88, -25.3, 4_000_000],
  ["virgo-cluster", "Virgo Cluster", "nearby-groups", "galaxy-cluster", 54_000_000, 12.5, 12.7, 10_000_000],

  // Home large-scale structures and neighbouring superclusters. Laniakea and
  // Pisces-Cetus contain the observer, so their placement is explicitly a
  // reconstructed extent rather than a fictitious point at their own diameter.
  ["laniakea", "Laniakea (Reconstruction)", "supercluster", "velocity-basin", 0, 10.54, -27, 520_000_000, null, null, true, true],
  ["pisces-cetus-complex", "Pisces-Cetus Complex (Reconstruction)", "supercluster", "supercluster-complex", 0, 0.8, -10, 1_000_000_000, null, null, true, true],
  ["hercules-supercluster", "Hercules Supercluster", "supercluster", "supercluster", 500_000_000, 16.08, 17.75, 330_000_000, null, null, true],
  ["corona-borealis-supercluster", "Corona Borealis Supercluster", "supercluster", "supercluster", 960_000_000, 15.4, 28, 330_000_000, null, null, true],
  ["shapley-concentration", "Shapley Concentration", "supercluster", "supercluster", 650_000_000, 13.47, -31, 100_000_000],

  // Survey-scale web. Spatial placement uses comoving distance where redshift is supplied.
  ["abell-1689", "Abell 1689", "cosmic-web", "galaxy-cluster", 2_200_000_000, 13.19, -1.34, 3_000_000, 0.183],
  ["3c-273", "3C 273", "cosmic-web", "quasar", 2_500_000_000, 12.486, 2.052, 200_000, 0.158],
  ["bullet-cluster", "Bullet Cluster", "cosmic-web", "galaxy-cluster", 3_800_000_000, 6.976, -55.95, 10_000_000, 0.296],
  ["boss-great-wall", "BOSS Great Wall", "cosmic-web", "supercluster-complex", 6_030_000_000, 14, 30, 1_000_000_000, 0.47, null, true],
  ["el-gordo", "El Gordo", "cosmic-web", "galaxy-cluster", 10_000_000_000, 1.035, -49.26, 12_000_000, 0.87],

  // Cosmic-dawn landmarks and the oldest electromagnetic surface we can observe.
  ["earendel", "Earendel", "observable-universe", "lensed-star", 27_740_000_000, 1.623, -8.465, 1, 6.2, 12_900_000_000],
  ["gn-z11", "GN-z11", "observable-universe", "early-galaxy", 31_810_000_000, 12.608, 62.24, 4_000, 10.6, 13_400_000_000],
  ["jades-gs-z14-0", "JADES-GS-z14-0", "observable-universe", "early-galaxy", 33_780_000_000, 3.544, -27.78, 2_000, 14.32, 13_500_000_000],
  ["mom-z14", "MoM-z14", "observable-universe", "early-galaxy", 33_830_000_000, 10, 2.2, 240, 14.44, 13_500_000_000, true],
  ["cmb-last-scattering", "CMB Last-Scattering Surface", "observable-universe", "observer-surface", 45_200_000_000, 0, 0, 45_200_000_000, 1089, 13_799_620_000, false, true]
]);

const equatorialPosition = (distanceLightYears, rightAscensionHours, declinationDegrees) => {
  const rightAscension = finite(rightAscensionHours) * 15 * Math.PI / 180;
  const declination = finite(declinationDegrees) * Math.PI / 180;
  const radius = positive(distanceLightYears, 1);
  const horizontal = Math.cos(declination) * radius;
  return [
    horizontal * Math.cos(rightAscension),
    Math.sin(declination) * radius,
    horizontal * Math.sin(rightAscension)
  ];
};

const createNavigationRecord = (raw) => {
  const [id, label, tierId, kind, distanceLightYears, rightAscensionHours,
    declinationDegrees, extentLightYears, redshift = null, lookbackLightYears = null,
    positionApproximate = false, observerCentered = false] = raw;
  const tier = TIER_BY_ID.get(tierId);
  const nativeUnitLightYears = tier.nativeUnitLightYears;
  const positionLightYears = observerCentered
    ? [0, 0, 0]
    : equatorialPosition(distanceLightYears, rightAscensionHours, declinationDegrees);
  const nativePosition = freezeVector(positionLightYears.map((coordinate) => coordinate / nativeUnitLightYears));
  const nativeExtent = positive(extentLightYears, 1) / nativeUnitLightYears;
  const recommendedLightYears = clamp(
    positive(distanceLightYears, tier.minimumLightYears),
    tier.minimumLightYears,
    tier.maximumLightYears
  );
  return Object.freeze({
    id,
    label,
    tierId,
    kind,
    available: true,
    selectable: true,
    visitable: true,
    distanceLightYears,
    distanceMeters: distanceLightYears * LIGHT_YEAR_METERS,
    recommendedDistanceMeters: recommendedLightYears * LIGHT_YEAR_METERS,
    extentLightYears,
    rightAscensionHours,
    declinationDegrees,
    redshift,
    lookbackLightYears,
    positionApproximate: Boolean(positionApproximate),
    observerCentered: Boolean(observerCentered),
    distanceMeaning: observerCentered ? "contains-observer" : "catalog-distance",
    worldIndependent: true,
    coordinateFrame: "observer-equatorial-j2000",
    nativeUnitLightYears,
    nativePosition,
    localPosition: nativePosition,
    position: nativePosition,
    nativeExtent,
    extent: nativeExtent,
    pivot: tier.pivot
  });
};

export const CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG = Object.freeze(
  RAW_NAVIGATION_CATALOG.map(createNavigationRecord)
);

const NAVIGATION_ALIASES = Object.freeze(new Map([
  ["lmc", "large-magellanic-cloud"],
  ["smc", "small-magellanic-cloud"],
  ["pisces-cetus", "pisces-cetus-complex"]
]));

// The nearest named galaxies remain resolved for long enough to establish the
// Local Group as a place rather than a handful of interchangeable light dots.
// These are physical 3D point populations attached to the same catalog IDs;
// no billboard, plane, or alternate sky is introduced at this scale. Position
// angles and inclinations are observational approximations in the J2000 frame.
const GALAXY_SILHOUETTE_PROFILES = Object.freeze([
  Object.freeze({
    placeId: "milky-way-home", morphology: "barred-spiral", armCount: 4,
    inclinationDegrees: 0, positionAngleDegrees: 0, diameterLightYears: 100_000,
    thicknessRatio: 0.024, standardSamples: 3_800, lowSamples: 760,
    poleRightAscensionHours: 12.85948, poleDeclinationDegrees: 27.12825,
    majorRightAscensionHours: 17.761, majorDeclinationDegrees: -29.008
  }),
  Object.freeze({
    placeId: "large-magellanic-cloud", morphology: "irregular", armCount: 0,
    inclinationDegrees: 34.7, positionAngleDegrees: 129.9, diameterLightYears: 32_200,
    thicknessRatio: 0.12, standardSamples: 1_650, lowSamples: 360
  }),
  Object.freeze({
    placeId: "small-magellanic-cloud", morphology: "irregular", armCount: 0,
    inclinationDegrees: 55, positionAngleDegrees: 45, diameterLightYears: 18_900,
    thicknessRatio: 0.16, standardSamples: 1_250, lowSamples: 300
  }),
  Object.freeze({
    placeId: "andromeda", morphology: "spiral", armCount: 2,
    inclinationDegrees: 77.5, positionAngleDegrees: 37.7, diameterLightYears: 260_000,
    thicknessRatio: 0.018, standardSamples: 4_800, lowSamples: 920
  }),
  Object.freeze({
    placeId: "triangulum", morphology: "spiral", armCount: 2,
    inclinationDegrees: 54.7, positionAngleDegrees: 22.5, diameterLightYears: 60_000,
    thicknessRatio: 0.026, standardSamples: 2_100, lowSamples: 440
  }),
  Object.freeze({
    placeId: "ic342-maffei-group", morphology: "galaxy-group", armCount: 2,
    inclinationDegrees: 35, positionAngleDegrees: 70, diameterLightYears: 4_000_000,
    memberDiameterLightYears: 190_000, islandCount: 5, thicknessRatio: 0.08,
    standardSamples: 3_000, lowSamples: 640, pointSizeFactor: 4.2
  }),
  Object.freeze({
    placeId: "m81-group", morphology: "galaxy-group", armCount: 2,
    inclinationDegrees: 59, positionAngleDegrees: 157, diameterLightYears: 1_500_000,
    memberDiameterLightYears: 150_000, islandCount: 4, thicknessRatio: 0.07,
    standardSamples: 2_600, lowSamples: 560, pointSizeFactor: 4
  }),
  Object.freeze({
    placeId: "centaurus-a-group", morphology: "galaxy-group", armCount: 2,
    inclinationDegrees: 70, positionAngleDegrees: 35, diameterLightYears: 2_000_000,
    memberDiameterLightYears: 170_000, islandCount: 4, thicknessRatio: 0.09,
    standardSamples: 2_600, lowSamples: 560, pointSizeFactor: 4.1
  }),
  Object.freeze({
    placeId: "sculptor-group", morphology: "galaxy-group", armCount: 2,
    inclinationDegrees: 48, positionAngleDegrees: 98, diameterLightYears: 4_000_000,
    memberDiameterLightYears: 140_000, islandCount: 5, thicknessRatio: 0.08,
    standardSamples: 3_000, lowSamples: 640, pointSizeFactor: 4.3
  }),
  Object.freeze({
    placeId: "virgo-cluster", morphology: "galaxy-group", armCount: 2,
    inclinationDegrees: 26, positionAngleDegrees: 112, diameterLightYears: 10_000_000,
    memberDiameterLightYears: 220_000, islandCount: 10, thicknessRatio: 0.12,
    standardSamples: 5_200, lowSamples: 1_100, pointSizeFactor: 4.6
  })
]);

const normalizeVector = (vector, fallback = [1, 0, 0]) => {
  const length = Math.hypot(...vector);
  return length > 1e-12 ? vector.map((value) => value / length) : [...fallback];
};

const crossVector = (left, right) => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0]
];

const scaleAndAddBasis = (major, minor, normal, x, y, z) => [
  major[0] * x + minor[0] * y + normal[0] * z,
  major[1] * x + minor[1] * y + normal[1] * z,
  major[2] * x + minor[2] * y + normal[2] * z
];

const galaxyDiskBasis = (profile, place) => {
  if (profile.placeId === "milky-way-home") {
    const normal = normalizeVector(equatorialPosition(
      1, profile.poleRightAscensionHours, profile.poleDeclinationDegrees
    ));
    const rawMajor = normalizeVector(equatorialPosition(
      1, profile.majorRightAscensionHours, profile.majorDeclinationDegrees
    ));
    // Remove the tiny catalog-coordinate component perpendicular to the disk.
    const normalProjection = rawMajor.reduce((sum, value, axis) => sum + value * normal[axis], 0);
    const major = normalizeVector(rawMajor.map((value, axis) => value - normal[axis] * normalProjection));
    return Object.freeze({
      major: freezeVector(major),
      minor: freezeVector(normalizeVector(crossVector(normal, major))),
      normal: freezeVector(normal)
    });
  }

  const radial = normalizeVector(place.positionLightYears);
  // J2000 position angle is measured north through east on the tangent plane.
  let east = normalizeVector(crossVector(radial, [0, 1, 0]), [0, 0, 1]);
  if (Math.abs(radial[1]) > 0.995) east = normalizeVector(crossVector(radial, [1, 0, 0]));
  const north = normalizeVector(crossVector(east, radial));
  const positionAngle = profile.positionAngleDegrees * Math.PI / 180;
  const inclination = profile.inclinationDegrees * Math.PI / 180;
  const major = normalizeVector(north.map((value, axis) => (
    value * Math.cos(positionAngle) + east[axis] * Math.sin(positionAngle)
  )));
  const projectedMinor = normalizeVector(north.map((value, axis) => (
    -value * Math.sin(positionAngle) + east[axis] * Math.cos(positionAngle)
  )));
  const minor = normalizeVector(projectedMinor.map((value, axis) => (
    value * Math.cos(inclination) + radial[axis] * Math.sin(inclination)
  )));
  return Object.freeze({
    major: freezeVector(major),
    minor: freezeVector(minor),
    normal: freezeVector(normalizeVector(crossVector(major, minor)))
  });
};

const galaxySilhouetteCache = new Map();

/**
 * Deterministic, physically oriented morphology for the Local and nearby
 * navigation anchors. Standard and low quality share stable ID prefixes and
 * coordinates; low quality merely submits a shorter prefix of each population.
 */
export function createCelestialCosmologyGalaxySilhouetteBlueprint({
  quality = "standard",
  seed = 0x636f736d
} = {}) {
  const resolvedQuality = quality === "low" ? "low" : "standard";
  const resolvedSeed = (Number(seed) || 0x636f736d) >>> 0;
  const cacheKey = `${resolvedSeed}:${resolvedQuality}`;
  if (galaxySilhouetteCache.has(cacheKey)) return galaxySilhouetteCache.get(cacheKey);
  const silhouettes = GALAXY_SILHOUETTE_PROFILES.map((profile) => {
    const place = CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG.find(({ id }) => id === profile.placeId);
    const positionLightYears = freezeVector(place.position.map(
      (coordinate) => coordinate * place.nativeUnitLightYears
    ));
    const basis = galaxyDiskBasis(profile, { positionLightYears });
    const random = randomGenerator(resolvedSeed ^ hashString(`galaxy-silhouette:${profile.placeId}`));
    const sampleCount = resolvedQuality === "low" ? profile.lowSamples : profile.standardSamples;
    const radius = profile.diameterLightYears * 0.5;
    const positionsLightYears = new Float64Array(sampleCount * 3);
    const colors = new Float32Array(sampleCount * 3);
    const sampleIds = [];
    const groupMembers = profile.morphology === "galaxy-group"
      ? Array.from({ length: profile.islandCount }, (_, index) => {
        const centerRadius = radius * (0.16 + 0.68 * Math.sqrt(random()));
        const centerAngle = index * Math.PI * (3 - Math.sqrt(5)) + random() * 0.42;
        return Object.freeze({
          x: Math.cos(centerAngle) * centerRadius,
          y: Math.sin(centerAngle) * centerRadius * 0.66,
          z: normalRandom(random) * radius * profile.thicknessRatio,
          radius: profile.memberDiameterLightYears * 0.5 * mix(0.58, 1.18, random()),
          angle: random() * TAU,
          arms: 2 + (index % 2)
        });
      }) : null;
    const clumps = Array.from({ length: profile.placeId === "small-magellanic-cloud" ? 4 : 6 }, () => ({
      x: (random() - 0.5) * radius * 1.25,
      y: (random() - 0.5) * radius * 0.72,
      spread: radius * (0.1 + random() * 0.16)
    }));
    for (let index = 0; index < sampleCount; index += 1) {
      const population = random();
      let x;
      let y;
      let z;
      let coreAmount = 0;
      if (profile.morphology === "galaxy-group") {
        const member = groupMembers[index % groupMembers.length];
        const radialAmount = Math.pow(random(), 0.66);
        const bulge = population < 0.24;
        const arm = index % member.arms;
        const azimuth = bulge ? random() * TAU
          : arm * TAU / member.arms + radialAmount * 5.4 + normalRandom(random) * 0.15;
        const memberRadius = member.radius * (bulge ? Math.pow(random(), 1.9) * 0.34 : radialAmount);
        const memberX = Math.cos(azimuth) * memberRadius;
        const memberY = Math.sin(azimuth) * memberRadius * (bulge ? 0.8 : 1);
        x = member.x + memberX * Math.cos(member.angle) - memberY * Math.sin(member.angle);
        y = member.y + memberX * Math.sin(member.angle) + memberY * Math.cos(member.angle);
        z = member.z + normalRandom(random) * member.radius * profile.thicknessRatio;
        coreAmount = bulge ? clamp(1 - memberRadius / (member.radius * 0.34), 0, 1)
          : clamp(1 - radialAmount * 2.1, 0, 1);
      } else if (profile.morphology === "irregular") {
        const clump = clumps[Math.floor(random() * clumps.length) % clumps.length];
        x = clump.x + normalRandom(random) * clump.spread;
        y = clump.y + normalRandom(random) * clump.spread * (0.5 + random() * 0.45);
        z = normalRandom(random) * radius * profile.thicknessRatio;
        coreAmount = clamp(1 - Math.hypot(x, y) / radius, 0, 1) * 0.35;
      } else if (population < 0.17) {
        const bulgeRadius = radius * Math.pow(random(), 2.25) * 0.34;
        const azimuth = random() * TAU;
        x = Math.cos(azimuth) * bulgeRadius;
        y = Math.sin(azimuth) * bulgeRadius * 0.72;
        z = normalRandom(random) * radius * profile.thicknessRatio * 2.4;
        coreAmount = 1 - bulgeRadius / (radius * 0.34);
      } else if (population < 0.93) {
        const radialAmount = Math.pow(random(), 0.61) * (0.96 + random() * 0.04);
        const arm = Math.floor(random() * profile.armCount) % profile.armCount;
        const armAngle = arm * TAU / profile.armCount;
        const trailingAngle = armAngle + radialAmount * (profile.placeId === "milky-way-home" ? 7.8 : 6.2);
        const azimuth = trailingAngle + normalRandom(random) * (0.11 + radialAmount * 0.11);
        const jitter = normalRandom(random) * radius * (0.012 + radialAmount * 0.018);
        x = Math.cos(azimuth) * radialAmount * radius + Math.cos(azimuth + Math.PI / 2) * jitter;
        y = Math.sin(azimuth) * radialAmount * radius + Math.sin(azimuth + Math.PI / 2) * jitter;
        z = normalRandom(random) * radius * profile.thicknessRatio * (1.2 - radialAmount * 0.55);
        coreAmount = clamp(1 - radialAmount * 2.1, 0, 1);
      } else {
        const haloRadius = radius * (0.35 + Math.pow(random(), 0.35) * 0.75);
        const azimuth = random() * TAU;
        const vertical = normalRandom(random) * radius * 0.1;
        x = Math.cos(azimuth) * haloRadius;
        y = Math.sin(azimuth) * haloRadius;
        z = vertical;
      }
      const local = scaleAndAddBasis(basis.major, basis.minor, basis.normal, x, y, z);
      positionsLightYears.set(local, index * 3);
      // Warm old bulges and cool active arms create readable morphology without
      // an image texture or screen-aligned quad.
      const youngStar = profile.morphology === "irregular" ? 0.5 + random() * 0.5 : random() * 0.55;
      colors[index * 3] = clamp(0.48 + coreAmount * 0.5 - youngStar * 0.1, 0, 1);
      colors[index * 3 + 1] = clamp(0.63 + coreAmount * 0.26 + youngStar * 0.2, 0, 1);
      colors[index * 3 + 2] = clamp(0.86 - coreAmount * 0.22 + youngStar * 0.14, 0, 1);
      sampleIds.push(`galaxy-silhouette:${profile.placeId}:sample:${index}`);
    }
    return Object.freeze({
      id: `galaxy-silhouette:${profile.placeId}`,
      placeId: profile.placeId,
      catalogNodeId: `catalog:${profile.placeId}`,
      tierId: place.tierId,
      morphology: profile.morphology,
      coordinateFrame: "observer-equatorial-j2000-light-years",
      orientationSource: "observed-position-angle-and-inclination-approximation",
      inclinationDegrees: profile.inclinationDegrees,
      positionAngleDegrees: profile.positionAngleDegrees,
      diameterLightYears: profile.diameterLightYears,
      islandCount: profile.islandCount || 1,
      pointSizeFactor: profile.pointSizeFactor || 1,
      positionLightYears,
      basis,
      sampleIds: Object.freeze(sampleIds),
      positionsLightYears,
      colors
    });
  });
  const blueprint = Object.freeze(silhouettes);
  galaxySilhouetteCache.set(cacheKey, blueprint);
  return blueprint;
}

export function resolveCelestialCosmologyGalaxySilhouetteWeight({
  distanceMeters = LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS,
  tierId = "local-group"
} = {}) {
  const distanceLightYears = clamp(positive(distanceMeters) / LIGHT_YEAR_METERS,
    LEGACY_MAXIMUM_LIGHT_YEARS, OBSERVABLE_RADIUS_LIGHT_YEARS);
  const nearby = tierId === "nearby-groups";
  const reveal = smoothstep(Math.log(nearby ? 5_000_000 : 185_000),
    Math.log(nearby ? 16_000_000 : 720_000), Math.log(distanceLightYears));
  const retirement = 1 - smoothstep(Math.log(nearby ? 150_000_000 : 55_000_000),
    Math.log(nearby ? 420_000_000 : 260_000_000), Math.log(distanceLightYears));
  return reveal * retirement;
}

const randomGenerator = (seed = 0x636f736d) => {
  let state = (Number(seed) || 0x636f736d) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
};

const normalRandom = (random) => {
  const radius = Math.sqrt(-2 * Math.log(Math.max(1e-12, random())));
  return radius * Math.cos(TAU * random());
};

const hashString = (value = "") => {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const POINT_COUNTS = Object.freeze({
  low: Object.freeze({
    "local-group": 2_200,
    "nearby-groups": 3_200,
    supercluster: 4_400,
    "cosmic-web": 6_000,
    "observable-universe": 7_000
  }),
  standard: Object.freeze({
    "local-group": 5_200,
    "nearby-groups": 7_600,
    supercluster: 9_800,
    "cosmic-web": 14_000,
    "observable-universe": 18_000
  })
});

const FILAMENT_TRACE_COUNTS = Object.freeze({
  low: Object.freeze({
    "local-group": 1_200,
    "nearby-groups": 2_000,
    supercluster: 3_000,
    "cosmic-web": 4_200,
    "observable-universe": 3_400
  }),
  standard: Object.freeze({
    "local-group": 2_800,
    "nearby-groups": 4_800,
    supercluster: 6_800,
    "cosmic-web": 10_000,
    "observable-universe": 8_000
  })
});

// These profiles describe resolution bands inside one canonical hierarchy. A
// band is not a replacement sky: every renderer tier receives the same master
// point population and graph, expressed in its own numeric unit. Consequently
// camera scale reveals outer geometry while crossfades only exchange coincident
// copies of the same objects.
const STRUCTURE_PROFILES = Object.freeze({
  "local-group": Object.freeze({ shellCount: 7, nodesPerShell: 5, flatten: 0.34, spread: 0.052 }),
  "nearby-groups": Object.freeze({ shellCount: 9, nodesPerShell: 7, flatten: 0.48, spread: 0.046 }),
  supercluster: Object.freeze({ shellCount: 9, nodesPerShell: 9, flatten: 0.62, spread: 0.052 }),
  "cosmic-web": Object.freeze({ shellCount: 10, nodesPerShell: 12, flatten: 0.86, spread: 0.044 }),
  "observable-universe": Object.freeze({ shellCount: 10, nodesPerShell: 14, flatten: 1, spread: 0.036 })
});

const hierarchyCache = new Map();

const createCanonicalCosmologyHierarchy = (seed) => {
  const resolvedSeed = (Number(seed) || 0x636f736d) >>> 0;
  if (hierarchyCache.has(resolvedSeed)) return hierarchyCache.get(resolvedSeed);
  const drafts = [];
  const supportByTier = new Map();
  const catalogByTier = new Map();
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (const tier of CELESTIAL_COSMOLOGY_TIER_DEFINITIONS) {
    const profile = STRUCTURE_PROFILES[tier.id];
    const random = randomGenerator(resolvedSeed ^ hashString(`nodes:${tier.id}`));
    const support = [];
    const minimumRadius = Math.max(80_000, tier.minimumLightYears * 0.72);
    const maximumRadius = tier.id === "observable-universe"
      ? 45_200_000_000
      : tier.maximumLightYears * 0.9;
    for (let shell = 0; shell < profile.shellCount; shell += 1) {
      const shellAmount = profile.shellCount === 1 ? 0 : shell / (profile.shellCount - 1);
      const shellRadius = Math.exp(
        Math.log(minimumRadius) + (Math.log(maximumRadius) - Math.log(minimumRadius)) * shellAmount
      );
      for (let index = 0; index < profile.nodesPerShell; index += 1) {
        const verticalUnit = 1 - 2 * (index + 0.5) / profile.nodesPerShell;
        const vertical = verticalUnit * profile.flatten;
        const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
        const azimuth = index * goldenAngle + shell * 1.713 + (random() - 0.5) * 0.24;
        const radius = shellRadius * (0.93 + random() * 0.14);
        const node = {
          id: `support:${tier.id}:${shell}:${index}`,
          parentId: null,
          originTierId: tier.id,
          kind: "support",
          shell,
          index,
          brightness: 1,
          positionLightYears: freezeVector([
            radius * horizontal * Math.cos(azimuth),
            radius * vertical,
            radius * horizontal * Math.sin(azimuth)
          ])
        };
        drafts.push(node);
        support.push(node);
      }
    }
    supportByTier.set(tier.id, support);

    const catalog = CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG
      .filter((place) => place.tierId === tier.id)
      .map((place) => {
        const node = {
          id: `catalog:${place.id}`,
          parentId: null,
          originTierId: tier.id,
          kind: "catalog",
          brightness: place.observerCentered ? 3 : 4,
          positionLightYears: freezeVector(place.nativePosition.map(
            (coordinate) => coordinate * place.nativeUnitLightYears
          ))
        };
        drafts.push(node);
        return node;
      });
    catalogByTier.set(tier.id, catalog);
  }

  let previousAggregate = null;
  const aggregates = [];
  for (const tier of CELESTIAL_COSMOLOGY_TIER_DEFINITIONS) {
    const children = [...supportByTier.get(tier.id), ...catalogByTier.get(tier.id)];
    if (previousAggregate) children.push(previousAggregate);
    const brightness = children.reduce((sum, child) => sum + child.brightness, 0);
    const centroid = [0, 0, 0];
    for (const child of children) for (let axis = 0; axis < 3; axis += 1) {
      centroid[axis] += child.positionLightYears[axis] * child.brightness / brightness;
    }
    const aggregate = {
      id: `aggregate:${tier.id}`,
      parentId: null,
      originTierId: tier.id,
      kind: "aggregate",
      brightness,
      childIds: Object.freeze(children.map(({ id }) => id)),
      positionLightYears: freezeVector(centroid)
    };
    for (const child of children) child.parentId = aggregate.id;
    drafts.push(aggregate);
    aggregates.push(aggregate);
    previousAggregate = aggregate;
  }

  const nodes = Object.freeze(drafts.map((node) => Object.freeze({ ...node })));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = [];
  const edgeIds = new Set();
  const addEdge = (fromId, toId, originTierId, kind = "structure") => {
    if (!nodeById.has(fromId) || !nodeById.has(toId) || fromId === toId) return;
    const ordered = [fromId, toId].sort();
    const id = `${kind}:${ordered[0]}->${ordered[1]}`;
    if (edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push(Object.freeze({ id, fromId, toId, originTierId, kind }));
  };

  for (const tier of CELESTIAL_COSMOLOGY_TIER_DEFINITIONS) {
    const profile = STRUCTURE_PROFILES[tier.id];
    const support = supportByTier.get(tier.id);
    for (const node of support) {
      if (node.index % 2 === node.shell % 2) {
        const neighbor = support[node.shell * profile.nodesPerShell
          + (node.index + 1) % profile.nodesPerShell];
        addEdge(node.id, neighbor.id, tier.id);
      }
      if (node.shell > 0) {
        const previousIndex = (node.index + (node.shell % 2)) % profile.nodesPerShell;
        const neighbor = support[(node.shell - 1) * profile.nodesPerShell + previousIndex];
        addEdge(neighbor.id, node.id, tier.id);
      }
    }
    const catalog = catalogByTier.get(tier.id);
    for (let index = 1; index < catalog.length; index += 1) {
      addEdge(catalog[index - 1].id, catalog[index].id, tier.id, "catalog");
    }
    const aggregate = aggregates[CELESTIAL_COSMOLOGY_TIER_IDS.indexOf(tier.id)];
    for (const node of catalog) addEdge(aggregate.id, node.id, tier.id, "aggregate");
  }
  for (let index = 1; index < aggregates.length; index += 1) {
    addEdge(aggregates[index - 1].id, aggregates[index].id,
      CELESTIAL_COSMOLOGY_TIER_IDS[index], "hierarchy");
  }

  const result = Object.freeze({
    seed: resolvedSeed,
    nodes,
    nodeById,
    edges: Object.freeze(edges),
    supportNodes: Object.freeze(nodes.filter(({ kind }) => kind === "support")),
    structureCoreNodes: Object.freeze(nodes.filter(({ kind }) => kind === "support" || kind === "aggregate")),
    catalogNodes: Object.freeze(nodes.filter(({ kind }) => kind === "catalog")),
    aggregates: Object.freeze(aggregates.map(({ id }) => nodeById.get(id)))
  });
  hierarchyCache.set(resolvedSeed, result);
  return result;
};

const createCanonicalPointPositions = (hierarchy, resolvedQuality, seed) => {
  const maximumCount = Math.max(...Object.values(POINT_COUNTS[resolvedQuality]));
  const positions = new Float64Array(maximumCount * 3);
  let cursor = 0;
  let previousCount = 0;
  for (const tier of CELESTIAL_COSMOLOGY_TIER_DEFINITIONS) {
    const targetCount = POINT_COUNTS[resolvedQuality][tier.id];
    const count = targetCount - previousCount;
    const random = randomGenerator(((Number(seed) || 0x636f736d) >>> 0) ^ hashString(`points:${tier.id}:${resolvedQuality}`));
    const profile = STRUCTURE_PROFILES[tier.id];
    const support = hierarchy.supportNodes.filter(({ originTierId }) => originTierId === tier.id);
    const catalog = hierarchy.catalogNodes.filter(
      ({ originTierId, positionLightYears }) => originTierId === tier.id && Math.hypot(...positionLightYears) > 0
    );
    for (let localIndex = 0; localIndex < count; localIndex += 1, cursor += 1) {
      if (tier.id === "observable-universe" && localIndex >= Math.floor(count * 0.72)) {
        const radius = 42_500_000_000 + 2_700_000_000 * Math.cbrt(random());
        const vertical = random() * 2 - 1;
        const azimuth = random() * TAU;
        const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
        positions[cursor * 3] = radius * horizontal * Math.cos(azimuth);
        positions[cursor * 3 + 1] = radius * vertical;
        positions[cursor * 3 + 2] = radius * horizontal * Math.sin(azimuth);
        continue;
      }
      const catalogSample = catalog.length > 0 && localIndex % 11 === 0;
      const node = support[((localIndex * 17) + Math.floor(random() * support.length)) % support.length];
      const center = catalogSample
        ? catalog[(localIndex / 11) % catalog.length | 0].positionLightYears
        : node.positionLightYears;
      const centerRadius = Math.max(tier.nativeUnitLightYears * 0.08, Math.hypot(...center));
      const maximumSpread = tier.nativeUnitLightYears
        * (tier.id === "cosmic-web" ? 1.2 : tier.id === "supercluster" ? 0.72 : 0.5);
      const spread = clamp(centerRadius * profile.spread, tier.nativeUnitLightYears * 0.006, maximumSpread);
      const verticalSpread = spread * (0.38 + profile.flatten * 0.62);
      positions[cursor * 3] = center[0] + normalRandom(random) * spread * 1.45;
      positions[cursor * 3 + 1] = center[1] + normalRandom(random) * verticalSpread;
      positions[cursor * 3 + 2] = center[2] + normalRandom(random) * spread;
    }
    previousCount = targetCount;
  }
  return positions;
};

const convertCanonicalPositions = (positionsLightYears, nativeUnitLightYears) => {
  const positions = new Float32Array(positionsLightYears.length);
  for (let index = 0; index < positions.length; index += 1) {
    positions[index] = positionsLightYears[index] / nativeUnitLightYears;
  }
  return positions;
};

const createCanonicalFilamentPositions = (hierarchy) => {
  const positions = new Float64Array(hierarchy.edges.length * 6);
  hierarchy.edges.forEach((edge, index) => {
    const from = hierarchy.nodeById.get(edge.fromId).positionLightYears;
    const to = hierarchy.nodeById.get(edge.toId).positionLightYears;
    positions.set(from, index * 6);
    positions.set(to, index * 6 + 3);
  });
  return positions;
};

const createCanonicalFilamentTracePositions = (hierarchy, count, seed) => {
  if (!count || hierarchy.edges.length === 0) return new Float64Array(0);
  const random = randomGenerator(((Number(seed) || 0x636f736d) >>> 0) ^ hashString("filament-traces"));
  const positions = new Float64Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const edge = hierarchy.edges[((index * 11) + Math.floor(random() * hierarchy.edges.length))
      % hierarchy.edges.length];
    const from = hierarchy.nodeById.get(edge.fromId).positionLightYears;
    const to = hierarchy.nodeById.get(edge.toId).positionLightYears;
    const amount = random();
    const delta = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const length = Math.hypot(...delta);
    const nativeUnit = TIER_BY_ID.get(edge.originTierId).nativeUnitLightYears;
    const spread = clamp(length * 0.026, nativeUnit * 0.0025, nativeUnit * 0.32);
    for (let axis = 0; axis < 3; axis += 1) {
      positions[index * 3 + axis] = from[axis] + delta[axis] * amount + normalRandom(random) * spread;
    }
  }
  return positions;
};

const grandeurBlueprintCache = new Map();

const directChildrenOf = (hierarchy, parentId) => hierarchy.nodes.filter(
  ({ parentId: candidateParentId }) => candidateParentId === parentId
);

const covarianceOf = (children, centroid, brightness) => {
  const covariance = new Array(9).fill(0);
  for (const child of children) {
    const delta = child.positionLightYears.map((value, axis) => value - centroid[axis]);
    for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) {
      covariance[row * 3 + column] += delta[row] * delta[column] * child.brightness / brightness;
    }
  }
  return Object.freeze(covariance);
};

const covarianceExtents = (covariance, nativeUnitLightYears) => Object.freeze([
  Math.max(nativeUnitLightYears * 0.08, Math.sqrt(Math.max(0, covariance[0])) * 2.6),
  Math.max(nativeUnitLightYears * 0.08, Math.sqrt(Math.max(0, covariance[4])) * 2.6),
  Math.max(nativeUnitLightYears * 0.08, Math.sqrt(Math.max(0, covariance[8])) * 2.6)
].sort((left, right) => right - left));

const covarianceCholesky = (covariance, floor) => {
  const a00 = Math.max(covariance[0], floor);
  const l00 = Math.sqrt(a00);
  const l10 = covariance[3] / l00;
  const l20 = covariance[6] / l00;
  const l11 = Math.sqrt(Math.max(floor, covariance[4] - l10 * l10));
  const l21 = (covariance[7] - l20 * l10) / l11;
  const l22 = Math.sqrt(Math.max(floor, covariance[8] - l20 * l20 - l21 * l21));
  return [l00, 0, 0, l10, l11, 0, l20, l21, l22];
};

const transformGaussian = (matrix, gaussian) => [
  matrix[0] * gaussian[0],
  matrix[3] * gaussian[0] + matrix[4] * gaussian[1],
  matrix[6] * gaussian[0] + matrix[7] * gaussian[1] + matrix[8] * gaussian[2]
];

const createGrandeurBlueprint = (hierarchy, quality, seed) => {
  const cacheKey = `${hierarchy.seed}:${quality}`;
  if (grandeurBlueprintCache.has(cacheKey)) return grandeurBlueprintCache.get(cacheKey);
  const aggregateVolumes = [];
  for (const aggregate of hierarchy.aggregates) {
    const tier = TIER_BY_ID.get(aggregate.originTierId);
    const children = directChildrenOf(hierarchy, aggregate.id);
    const covariance = covarianceOf(children, aggregate.positionLightYears, aggregate.brightness);
    const extentLightYears = covarianceExtents(covariance, tier.nativeUnitLightYears);
    const random = randomGenerator(((Number(seed) || 0x636f736d) >>> 0)
      ^ hashString(`grandeur-volume:${aggregate.id}:${quality}`));
    const tierIndex = CELESTIAL_COSMOLOGY_TIER_IDS.indexOf(aggregate.originTierId);
    // The reference-scale clouds derive their grandeur from resolved density,
    // not oversized cards. Later tiers therefore receive progressively more
    // stable 3D samples as their covariance volume grows.
    const sampleCount = (quality === "low" ? 1_000 : 2_400)
      + tierIndex * (quality === "low" ? 500 : 1_200);
    const matrix = covarianceCholesky(covariance, (tier.nativeUnitLightYears * 0.018) ** 2);
    const positions = new Float64Array(sampleCount * 3);
    const sampleIds = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const gaussian = [normalRandom(random), normalRandom(random), normalRandom(random)]
        .map((value) => clamp(value, -2.65, 2.65));
      const delta = transformGaussian(matrix, gaussian);
      for (let axis = 0; axis < 3; axis += 1) {
        positions[index * 3 + axis] = aggregate.positionLightYears[axis] + delta[axis];
      }
      sampleIds.push(`${aggregate.id}:volume:${index}`);
    }
    aggregateVolumes.push(Object.freeze({
      id: aggregate.id,
      parentId: aggregate.parentId,
      tierId: aggregate.originTierId,
      centroidLightYears: aggregate.positionLightYears,
      covariance,
      extentLightYears,
      brightness: aggregate.brightness,
      volumeSampleIds: Object.freeze(sampleIds),
      volumePositionsLightYears: positions
    }));
  }

  const filamentAuras = [];
  for (const edge of hierarchy.edges) {
    const fromNode = hierarchy.nodeById.get(edge.fromId);
    const toNode = hierarchy.nodeById.get(edge.toId);
    const from = fromNode.positionLightYears;
    const to = toNode.positionLightYears;
    const delta = to.map((value, axis) => value - from[axis]);
    const length = Math.max(1, Math.hypot(...delta));
    const random = randomGenerator(((Number(seed) || 0x636f736d) >>> 0)
      ^ hashString(`grandeur-filament:${edge.id}:${quality}`));
    const bendDirection = [normalRandom(random), normalRandom(random), normalRandom(random)];
    const projection = bendDirection.reduce((sum, value, axis) => sum + value * delta[axis], 0)
      / (length * length);
    const perpendicular = bendDirection.map((value, axis) => value - delta[axis] * projection);
    const perpendicularLength = Math.max(1e-12, Math.hypot(...perpendicular));
    const bend = Math.min(length * 0.22, TIER_BY_ID.get(edge.originTierId).nativeUnitLightYears * 0.9);
    const control = from.map((value, axis) => (
      value + delta[axis] * 0.5 + perpendicular[axis] / perpendicularLength * bend
    ));
    const steps = quality === "low" ? 32 : 64;
    const strands = quality === "low" ? 2 : 3;
    const positions = new Float64Array(steps * strands * 3);
    const sampleIds = [];
    let cursor = 0;
    for (let strand = 0; strand < strands; strand += 1) for (let step = 0; step < steps; step += 1) {
      const amount = (step + 0.5) / steps;
      const inverse = 1 - amount;
      const strandOffset = strands === 1 ? 0 : strand / (strands - 1) * 2 - 1;
      const strandSpread = length * 0.009 * strandOffset;
      for (let axis = 0; axis < 3; axis += 1) {
        positions[cursor * 3 + axis] = inverse * inverse * from[axis]
          + 2 * inverse * amount * control[axis] + amount * amount * to[axis]
          + perpendicular[axis] / perpendicularLength * strandSpread;
      }
      sampleIds.push(`${edge.id}:aura:${strand}:${step}`);
      cursor += 1;
    }
    const parentPair = [fromNode.parentId, toNode.parentId].filter(Boolean).sort();
    filamentAuras.push(Object.freeze({
      id: edge.id,
      parentEdgeId: parentPair.length === 2 && parentPair[0] !== parentPair[1]
        ? `parent-link:${parentPair[0]}->${parentPair[1]}` : null,
      fromId: edge.fromId,
      toId: edge.toId,
      tierId: edge.originTierId,
      controlPointsLightYears: Object.freeze([from, freezeVector(control), to]),
      sampleIds: Object.freeze(sampleIds),
      positionsLightYears: positions
    }));
  }

  const horizonCount = quality === "low" ? 2_200 : 4_800;
  const horizonPositions = new Float64Array(horizonCount * 3);
  const horizonSampleIds = [];
  const horizonRandom = randomGenerator(((Number(seed) || 0x636f736d) >>> 0)
    ^ hashString(`observable-horizon:${quality}`));
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < horizonCount; index += 1) {
    const vertical = 1 - 2 * (index + 0.5) / horizonCount;
    const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
    const azimuth = index * goldenAngle + (horizonRandom() - 0.5) * 0.045;
    const radius = LAST_SCATTERING_RADIUS_LIGHT_YEARS
      + (horizonRandom() - 0.5) * HORIZON_THICKNESS_LIGHT_YEARS;
    horizonPositions[index * 3] = radius * horizontal * Math.cos(azimuth);
    horizonPositions[index * 3 + 1] = radius * vertical;
    horizonPositions[index * 3 + 2] = radius * horizontal * Math.sin(azimuth);
    horizonSampleIds.push(`observer-horizon:${index}`);
  }
  const blueprint = Object.freeze({
    aggregateVolumes: Object.freeze(aggregateVolumes),
    filamentAuras: Object.freeze(filamentAuras),
    horizon: Object.freeze({
      id: "observable-particle-horizon",
      geometryKind: "observer-centered-spherical-shell",
      observerCentered: true,
      radiusLightYears: LAST_SCATTERING_RADIUS_LIGHT_YEARS,
      thicknessLightYears: HORIZON_THICKNESS_LIGHT_YEARS,
      sampleIds: Object.freeze(horizonSampleIds),
      positionsLightYears: horizonPositions
    })
  });
  grandeurBlueprintCache.set(cacheKey, blueprint);
  return blueprint;
};

const resolveAggregateCollapse = (tierId, distanceLightYears) => {
  const tier = TIER_BY_ID.get(tierId);
  const cinematicParent = tierId === "supercluster" || tierId === "cosmic-web"
    || tierId === "observable-universe";
  const start = tier.minimumLightYears * (cinematicParent ? 0.72 : 1.12);
  const end = tier.maximumLightYears * (tierId === "observable-universe" ? 0.82
    : cinematicParent ? 0.62 : 0.72);
  return smoothstep(Math.log(start), Math.log(Math.max(start * 1.01, end)), Math.log(distanceLightYears));
};

const resolveContinuousCosmicPalette = (distanceLightYears) => {
  const amount = smoothstep(Math.log(450_000_000), Math.log(1_800_000_000),
    Math.log(distanceLightYears));
  const terminal = smoothstep(Math.log(8_000_000_000), Math.log(OBSERVABLE_RADIUS_LIGHT_YEARS),
    Math.log(distanceLightYears));
  return Object.freeze({
    amount: clamp(amount * 0.84 + terminal * 0.16, 0, 1),
    deepSpace: mixHexColor(0x01070d, 0x050015, amount),
    density: mixHexColor(mixHexColor(0xb8e4ec, 0x8a64e4, amount), 0x7041d4, terminal),
    core: mixHexColor(0xffffff, 0xffe7ff, amount),
    filament: mixHexColor(mixHexColor(0xbdf9ff, 0xa66cff, amount), 0xc071ff, terminal),
    horizon: mixHexColor(0xb98eff, 0xe2c5ff, terminal)
  });
};

// A continuous perceptual exposure curve sits on top of the conserved energy
// ledger. It retires unresolved generic grain as coherent parents emerge, then
// turns the existing last-scattering sphere into a late cinematic overview.
// No population, coordinate, or semantic owner changes along this curve.
export function resolveCelestialCosmologyArtDirection({
  distanceMeters = LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS
} = {}) {
  const distanceLightYears = clamp(positive(distanceMeters) / LIGHT_YEAR_METERS,
    LEGACY_MAXIMUM_LIGHT_YEARS, OBSERVABLE_RADIUS_LIGHT_YEARS);
  const logDistance = Math.log(distanceLightYears);
  const supercluster = smoothstep(Math.log(90_000_000), Math.log(450_000_000), logDistance);
  const web = smoothstep(Math.log(800_000_000), Math.log(2_400_000_000), logDistance);
  const nearbyIslands = smoothstep(Math.log(8_000_000), Math.log(28_000_000), logDistance)
    * (1 - smoothstep(Math.log(120_000_000), Math.log(280_000_000), logDistance));
  const terminal = smoothstep(Math.log(30_000_000_000), Math.log(44_000_000_000), logDistance);
  let detailCarpet = mix(1, 0.16, supercluster);
  detailCarpet = mix(detailCarpet, 0.045, web);
  detailCarpet = mix(detailCarpet, 0.012, terminal);
  const volumeGain = mix(mix(1, 1.45, supercluster), 1.62, web) * mix(1, 0.12, terminal);
  const filamentGain = mix(mix(0.82, 1.18, supercluster), 1.34, web) * mix(1, 0.18, terminal);
  return Object.freeze({
    distanceLightYears,
    detailCarpet,
    landmarkDetail: Math.sqrt(detailCarpet),
    structureDetail: detailCarpet * mix(0.82, 0.52, web),
    volumeGain,
    filamentGain,
    filamentPassGain: Object.freeze({
      haze: mix(1, 1.08, web),
      strand: mix(mix(1, 0.28, nearbyIslands), 0.3, supercluster),
      spine: mix(mix(1, 0.04, nearbyIslands), 0.035, supercluster)
    }),
    nearbyIslandGain: mix(1, 1.38, nearbyIslands),
    filamentExponent: mix(1.15, 0.72, supercluster),
    branchScale: mix(mix(1, 1.7, supercluster), 2.25, web),
    coreGain: mix(mix(1, 0.5, supercluster), 0.32, web),
    horizonOverview: terminal,
    horizonScale: mix(1, 0.225, terminal),
    horizonGain: mix(0.72, 1.15, terminal)
  });
}

export function resolveCelestialCosmologyGrandeurSnapshot({
  distanceMeters = LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS,
  metersPerUnit = null,
  quality = "standard",
  seed = 0x636f736d
} = {}) {
  const distanceLightYears = clamp(positive(distanceMeters) / LIGHT_YEAR_METERS,
    LEGACY_MAXIMUM_LIGHT_YEARS, OBSERVABLE_RADIUS_LIGHT_YEARS);
  const hierarchy = createCanonicalCosmologyHierarchy(seed);
  const blueprint = createGrandeurBlueprint(hierarchy, quality === "low" ? "low" : "standard", seed);
  const collapseById = new Map(hierarchy.aggregates.map((aggregate) => [
    aggregate.id, resolveAggregateCollapse(aggregate.originTierId, distanceLightYears)
  ]));
  const incomingById = new Map();
  const emittedById = new Map();
  const rootAggregate = hierarchy.aggregates.at(-1);
  const allocate = (node, incoming) => {
    incomingById.set(node.id, incoming);
    if (node.kind !== "aggregate") {
      emittedById.set(node.id, incoming);
      return;
    }
    const collapse = collapseById.get(node.id) || 0;
    emittedById.set(node.id, incoming * collapse);
    const children = directChildrenOf(hierarchy, node.id);
    for (const child of children) allocate(child, incoming * (1 - collapse)
      * child.brightness / node.brightness);
  };
  allocate(rootAggregate, rootAggregate.brightness);
  const renderPositionOf = (node) => {
    let position = [...node.positionLightYears];
    let parentId = node.parentId;
    while (parentId) {
      const parent = hierarchy.nodeById.get(parentId);
      const collapse = collapseById.get(parent.id) || 0;
      position = position.map((value, axis) => mix(value, parent.positionLightYears[axis], collapse));
      parentId = parent.parentId;
    }
    return freezeVector(position);
  };
  const aggregateVolumes = Object.freeze(blueprint.aggregateVolumes.map((volume) => Object.freeze({
    ...volume,
    collapse: collapseById.get(volume.id) || 0,
    detailWeight: volume.brightness > 0 ? (emittedById.get(volume.id) || 0) / volume.brightness : 0,
    incomingBrightness: incomingById.get(volume.id) || 0,
    emittedBrightness: emittedById.get(volume.id) || 0,
    renderPositionLightYears: renderPositionOf(hierarchy.nodeById.get(volume.id))
  })));
  const filamentAuras = Object.freeze(blueprint.filamentAuras.map((aura) => {
    const tier = TIER_BY_ID.get(aura.tierId);
    const cinematicParent = aura.tierId === "supercluster" || aura.tierId === "cosmic-web";
    const reveal = smoothstep(Math.log(tier.minimumLightYears * (cinematicParent ? 0.62 : 0.7)),
      Math.log(cinematicParent ? tier.minimumLightYears * 1.18
        : tier.maximumLightYears * 0.72), Math.log(distanceLightYears));
    const retirement = aura.tierId === "observable-universe" ? 1 : 1 - smoothstep(
      Math.log(tier.maximumLightYears * 0.55), Math.log(tier.maximumLightYears * 1.1),
      Math.log(distanceLightYears)
    );
    // The curve is canonical, but its presentation follows the exact same
    // aggregate collapse chain as the density it describes. This is one
    // continuous affine morph: no parent curve, alternate root, or sample ID
    // is swapped in at a semantic boundary.
    let renderScale = 1;
    let renderOffsetLightYears = [0, 0, 0];
    // The terminal tier is the still-resolved interior of the bounded horizon,
    // not a sixth parent waiting to replace it, so it keeps its full extent.
    let aggregate = aura.tierId === "observable-universe" ? null
      : hierarchy.nodeById.get(`aggregate:${aura.tierId}`);
    while (aggregate) {
      const collapse = collapseById.get(aggregate.id) || 0;
      renderOffsetLightYears = renderOffsetLightYears.map((value, axis) => (
        value * (1 - collapse) + aggregate.positionLightYears[axis] * collapse
      ));
      renderScale *= 1 - collapse;
      aggregate = aggregate.parentId ? hierarchy.nodeById.get(aggregate.parentId) : null;
    }
    const emittedOpacity = reveal * retirement * renderScale;
    return Object.freeze({ ...aura, coreOpacity: emittedOpacity * 0.2,
      auraOpacity: emittedOpacity * 0.54, emittedOpacity, renderScale,
      renderOffsetLightYears: freezeVector(renderOffsetLightYears) });
  }));
  const horizonOpacity = smoothstep(Math.log(7_500_000_000), Math.log(38_000_000_000),
    Math.log(distanceLightYears));
  const totalEmittedBrightness = hierarchy.nodes.reduce(
    (sum, node) => sum + (emittedById.get(node.id) || 0), 0
  );
  return Object.freeze({
    distanceLightYears,
    metersPerUnit: positive(metersPerUnit, positive(distanceMeters)),
    palette: resolveContinuousCosmicPalette(distanceLightYears),
    aggregateVolumes,
    filamentAuras,
    horizon: Object.freeze({ ...blueprint.horizon, opacity: horizonOpacity }),
    nodeEnergy: Object.freeze(hierarchy.nodes.map((node) => Object.freeze({
      id: node.id,
      incomingBrightness: incomingById.get(node.id) || 0,
      emittedBrightness: emittedById.get(node.id) || 0,
      collapse: collapseById.get(node.id) || 0,
      renderPositionLightYears: renderPositionOf(node)
    }))),
    totalLeafBrightness: rootAggregate.brightness,
    totalEmittedBrightness
  });
}

const createSoftPointTexture = (THREE) => {
  const width = 32;
  const data = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x + 0.5) / width * 2 - 1;
      const ny = (y + 0.5) / width * 2 - 1;
      const radius = Math.hypot(nx, ny);
      const alpha = Math.round(255 * Math.pow(clamp(1 - radius, 0, 1), 1.75));
      const offset = (y * width + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = alpha;
    }
  }
  const texture = new THREE.DataTexture(data, width, width, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
};

// One analytic kernel serves both unresolved galaxies and cluster fog.  The
// fragment shader integrates an elliptical Gaussian in point space and adds a
// restrained diffraction core; no screen-sized plane or sprite is involved.
// Per-sample size/intensity/seed make the cloud read as a luminous volume while
// the vertex positions remain the canonical hierarchy's stable population.
const createCinematicRadianceMaterial = (THREE, {
  color = CANONICAL_UNIVERSE_COLOR,
  opacity = 0,
  sharpness = 2.4,
  volume = false
} = {}) => {
  const material = new THREE.ShaderMaterial({
    uniforms: {
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: opacity },
    uPointScale: { value: 1 },
    uViewportHeight: { value: 900 },
    uSharpness: { value: sharpness },
    uTime: { value: 0 },
    uMotion: { value: 1 },
    uRaySteps: { value: volume ? 24 : 1 }
  },
  vertexShader: `
    attribute float size;
    attribute float intensity;
    attribute float seed;
    attribute vec3 color;
    uniform float uPointScale;
    uniform float uViewportHeight;
    uniform float uTime;
    uniform float uMotion;
    varying float vIntensity;
    varying float vSeed;
    varying vec3 vColor;
    void main() {
      vIntensity = intensity;
      vSeed = seed;
      vColor = color;
      vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
      float shimmer = 1.0 + sin(seed * 91.7 + uTime * 0.32) * 0.045 * uMotion;
      float perspective = uViewportHeight / max(1.0, -viewPosition.z);
      gl_PointSize = max(1.0, size * uPointScale * perspective * shimmer);
      gl_Position = projectionMatrix * viewPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uSharpness;
    uniform float uRaySteps;
    varying float vIntensity;
    varying float vSeed;
    varying vec3 vColor;
    void main() {
      vec2 p = gl_PointCoord * 2.0 - 1.0;
      float angle = vSeed * 6.28318530718;
      mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
      p = rotation * p;
      float aspect = mix(0.54, 0.9, fract(vSeed * 17.13));
      p.x /= aspect;
      float radius2 = dot(p, p);
      if (radius2 > 1.0) discard;
      float edgeApodization = 1.0 - smoothstep(0.72, 1.0, radius2);
      float samples = max(1.0, uRaySteps);
      float integratedDensity = 0.0;
      for (int index = 0; index < 32; index += 1) {
        if (float(index) >= samples) break;
        float z = ((float(index) + 0.5) / samples) * 2.0 - 1.0;
        integratedDensity += exp(-(radius2 + z * z * 0.82) * uSharpness);
      }
      float gaussian = integratedDensity / samples;
      float core = exp(-radius2 * (uSharpness * 4.8 + 2.0));
      float stepGain = mix(0.88, 1.18, clamp(uRaySteps / 24.0, 0.0, 1.0));
      float alpha = (gaussian * 0.72 + core * 0.5) * vIntensity * uOpacity
        * stepGain * edgeApodization;
      if (alpha < 0.001) discard;
      vec3 radiance = mix(uColor, vColor, 0.42) * (0.76 + core * 0.82);
      gl_FragColor = vec4(radiance, alpha);
    }
  `,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthTest: true,
  depthWrite: false,
    toneMapped: false
  });
  // Match the small mutable surface used by PointsMaterial so the existing
  // presentation ledger can drive shader and fallback paths identically.
  material.color = material.uniforms.uColor.value;
  material.sizeAttenuation = true;
  material.alphaTest = 0;
  Object.defineProperties(material, {
    opacity: {
      configurable: true,
      get: () => material.uniforms.uOpacity.value,
      set: (value) => { material.uniforms.uOpacity.value = finite(value); }
    },
    size: {
      configurable: true,
      get: () => material.uniforms.uPointScale.value,
      set: (value) => { material.uniforms.uPointScale.value = positive(value); }
    }
  });
  return material;
};

const addCinematicRadianceAttributes = (THREE, geometry, count, seed, {
  baseSize = 1,
  intensity = 1,
  color = [0.55, 0.79, 0.85]
} = {}) => {
  const sizes = new Float32Array(count);
  const intensities = new Float32Array(count);
  const seeds = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const random = randomGenerator(((Number(seed) || 0x636f736d) >>> 0) ^ hashString("radiance-attributes"));
  for (let index = 0; index < count; index += 1) {
    const value = random();
    sizes[index] = baseSize * mix(0.62, 1.55, value * value);
    intensities[index] = intensity * mix(0.38, 1.0, random());
    seeds[index] = random();
    colors[index * 3] = color[0] * mix(0.82, 1.18, random());
    colors[index * 3 + 1] = color[1] * mix(0.84, 1.12, random());
    colors[index * 3 + 2] = color[2] * mix(0.88, 1.1, random());
  }
  geometry.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("intensity", new THREE.Float32BufferAttribute(intensities, 1));
  geometry.setAttribute("seed", new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
};

const createGalaxyPointTexture = (THREE) => {
  const width = 48;
  const data = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y += 1) for (let x = 0; x < width; x += 1) {
    const nx = (x + 0.5) / width * 2 - 1;
    const ny = ((y + 0.5) / width * 2 - 1) * 2.25;
    const radius = Math.hypot(nx, ny), angle = Math.atan2(ny, nx);
    const envelope = clamp(1 - radius, 0, 1);
    const arms = Math.pow(0.5 + 0.5 * Math.cos(angle * 2 - radius * 9), 4);
    const bulge = Math.exp(-radius * radius * 15);
    const alpha = Math.round(255 * clamp(envelope * envelope * (0.24 + arms * 0.52) + bulge * 0.82, 0, 1));
    const offset = (y * width + x) * 4;
    data[offset] = 226;
    data[offset + 1] = 241;
    data[offset + 2] = 255;
    data[offset + 3] = alpha;
  }
  const texture = new THREE.DataTexture(data, width, width, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
};

export function createCelestialCosmologyData({ quality = "standard", seed = 0x636f736d } = {}) {
  const resolvedQuality = quality === "low" ? "low" : "standard";
  const resolvedSeed = (Number(seed) || 0x636f736d) >>> 0;
  const hierarchy = createCanonicalCosmologyHierarchy(resolvedSeed);
  const canonicalPositions = createCanonicalPointPositions(hierarchy, resolvedQuality, resolvedSeed);
  const canonicalCorePositions = new Float64Array(hierarchy.structureCoreNodes
    .flatMap(({ positionLightYears }) => positionLightYears));
  const canonicalAnchorPositions = new Float64Array(hierarchy.catalogNodes
    .filter(({ id }) => id === "catalog:milky-way-home"
      || Math.hypot(...hierarchy.nodeById.get(id).positionLightYears) > 0)
    .flatMap(({ positionLightYears }) => positionLightYears));
  const canonicalFilamentPositions = createCanonicalFilamentPositions(hierarchy);
  const maximumTraceCount = Math.max(...Object.values(FILAMENT_TRACE_COUNTS[resolvedQuality]));
  const canonicalTracePositions = createCanonicalFilamentTracePositions(
    hierarchy, maximumTraceCount, resolvedSeed
  );
  const sharedPositions = convertCanonicalPositions(canonicalPositions, 1);
  const sharedAnchorPositions = convertCanonicalPositions(canonicalAnchorPositions, 1);
  const sharedStructureCorePositions = convertCanonicalPositions(canonicalCorePositions, 1);
  const sharedFilamentPositions = convertCanonicalPositions(canonicalFilamentPositions, 1);
  const sharedFilamentTracePositions = convertCanonicalPositions(canonicalTracePositions, 1);
  const tiers = {};
  for (const tier of CELESTIAL_COSMOLOGY_TIER_DEFINITIONS) {
    // All tier records deliberately share these exact Float32Array instances.
    // Visual children cancel their owning root's native-unit scale, so this one
    // canonical light-year geometry projects identically on both sides of every
    // semantic boundary and is uploaded only once by Three.
    const positions = sharedPositions;
    const anchorPositions = sharedAnchorPositions;
    const structureCorePositions = sharedStructureCorePositions;
    const filamentPositions = sharedFilamentPositions;
    const filamentTracePositions = sharedFilamentTracePositions;
    const aggregateNode = hierarchy.nodeById.get(`aggregate:${tier.id}`);
    tiers[tier.id] = Object.freeze({
      positions,
      anchorPositions,
      structureCorePositions,
      filamentPositions,
      filamentTracePositions,
      pointCount: positions.length / 3,
      anchorCount: anchorPositions.length / 3,
      structureCoreCount: structureCorePositions.length / 3,
      filamentSegmentCount: filamentPositions.length / 6,
      filamentTraceCount: filamentTracePositions.length / 3,
      visiblePointBudget: POINT_COUNTS[resolvedQuality][tier.id],
      visibleFilamentTraceBudget: FILAMENT_TRACE_COUNTS[resolvedQuality][tier.id],
      hierarchyNodeIds: Object.freeze(hierarchy.nodes.map(({ id }) => id)),
      aggregateNode: Object.freeze({
        id: aggregateNode.id,
        parentId: aggregateNode.parentId,
        positionLightYears: aggregateNode.positionLightYears,
        brightness: aggregateNode.brightness
      }),
      filamentEdges: hierarchy.edges,
      filamentEdgeIds: Object.freeze(hierarchy.edges.map(({ id }) => id)),
      canonicalCoordinateFrame: "observer-equatorial-j2000-light-years"
    });
  }
  return Object.freeze({
    quality: resolvedQuality,
    seed: resolvedSeed,
    hierarchy: Object.freeze({
      nodes: hierarchy.nodes,
      edges: hierarchy.edges,
      aggregateIds: Object.freeze(hierarchy.aggregates.map(({ id }) => id))
    }),
    tiers: Object.freeze(tiers)
  });
}

const transitionWindowAt = (distanceLightYears) => Object.freeze({
  startLightYears: distanceLightYears / TRANSITION_FACTOR,
  midpointLightYears: distanceLightYears,
  endLightYears: distanceLightYears * TRANSITION_FACTOR,
  wheelPulses: Math.log(TRANSITION_FACTOR * TRANSITION_FACTOR)
    / Math.log(STANDARD_WHEEL_MULTIPLIER)
});

export const CELESTIAL_COSMOLOGY_TRANSITIONS = Object.freeze(
  CELESTIAL_COSMOLOGY_TIER_DEFINITIONS.slice(0, -1).map((tier, index) => Object.freeze({
    from: tier.id,
    to: CELESTIAL_COSMOLOGY_TIER_DEFINITIONS[index + 1].id,
    ...transitionWindowAt(tier.maximumLightYears)
  }))
);

export function resolveCelestialCosmologyWeights({
  distanceMeters = LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS,
  reducedMotion = false
} = {}) {
  const distanceLightYears = clamp(
    positive(distanceMeters, LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS) / LIGHT_YEAR_METERS,
    LEGACY_MAXIMUM_LIGHT_YEARS,
    OBSERVABLE_RADIUS_LIGHT_YEARS
  );
  const weights = Object.fromEntries(CELESTIAL_COSMOLOGY_TIER_IDS.map((id) => [id, 0]));
  for (const transition of CELESTIAL_COSMOLOGY_TRANSITIONS) {
    if (distanceLightYears < transition.startLightYears || distanceLightYears > transition.endLightYears) continue;
    if (reducedMotion) {
      weights[distanceLightYears < transition.midpointLightYears ? transition.from : transition.to] = 1;
    } else {
      const amount = smoothstep(
        Math.log(transition.startLightYears),
        Math.log(transition.endLightYears),
        Math.log(distanceLightYears)
      );
      weights[transition.from] = 1 - amount;
      weights[transition.to] = amount;
    }
    return Object.freeze(weights);
  }
  const owner = CELESTIAL_COSMOLOGY_TIER_DEFINITIONS.find(
    (tier) => distanceLightYears <= tier.maximumLightYears
  ) || CELESTIAL_COSMOLOGY_TIER_DEFINITIONS.at(-1);
  weights[owner.id] = 1;
  return Object.freeze(weights);
}

const dominantTierId = (weights) => CELESTIAL_COSMOLOGY_TIER_IDS.reduce(
  (best, id) => weights[id] > weights[best] ? id : best,
  CELESTIAL_COSMOLOGY_TIER_IDS[0]
);

export function resolveCelestialCosmologyPresentation({
  distanceMeters = LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS,
  representedDistanceMeters = null,
  metersPerUnit = null,
  reducedMotion = false
} = {}) {
  const resolvedDistanceMeters = clamp(
    positive(representedDistanceMeters ?? distanceMeters, LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS),
    LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS,
    OBSERVABLE_RADIUS_LIGHT_YEARS * LIGHT_YEAR_METERS
  );
  const resolvedMetersPerUnit = positive(metersPerUnit, resolvedDistanceMeters);
  const weights = resolveCelestialCosmologyWeights({
    distanceMeters: resolvedDistanceMeters,
    reducedMotion
  });
  const tierId = dominantTierId(weights);
  const tier = TIER_BY_ID.get(tierId);
  const distanceLightYears = resolvedDistanceMeters / LIGHT_YEAR_METERS;
  const prewarmTierIds = Object.freeze(CELESTIAL_COSMOLOGY_TRANSITIONS
    .filter(({ startLightYears, endLightYears, to }) => (
      distanceLightYears >= startLightYears / COSMOLOGY_PREWARM_FACTOR
      && distanceLightYears <= endLightYears
      && weights[to] <= 0.01
    ))
    .map(({ to }) => to));
  return Object.freeze({
    distanceMeters: resolvedDistanceMeters,
    distanceLightYears: resolvedDistanceMeters / LIGHT_YEAR_METERS,
    metersPerUnit: resolvedMetersPerUnit,
    tierId,
    weights,
    activeTierIds: Object.freeze(CELESTIAL_COSMOLOGY_TIER_IDS.filter((id) => weights[id] > 0.001)),
    prewarmTierIds,
    pivot: tier.pivot,
    observerCentered: Boolean(tier.pivot.observerCentered),
    noFloorGrid: true,
    reducedMotion: Boolean(reducedMotion)
  });
}

// THREE.PointsMaterial sizes are expressed outside the Object3D transform: a
// precision rebase therefore scales point depths without scaling their sprite
// diameters.  Convert the authored size into the current render cell so a
// point keeps one physical/angular trajectory across every rebase epoch.  The
// camera's localDollyFactor remains deliberately absent here; it supplies the
// ordinary 1.2x apparent shrink between wheel pulses inside an epoch.
export function resolveCelestialCosmologyPointSizeScale({
  metersPerUnit = LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS
} = {}) {
  const authoredMetersPerUnit = LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS;
  return authoredMetersPerUnit / positive(metersPerUnit, authoredMetersPerUnit);
}

// Compact, allocation-bounded proof surface for continuity tests and runtime
// diagnostics. The node/edge universe is invariant at every distance; only
// coincident LOD ownership changes. Brightness is not globally crossfaded, so
// no structure can blink merely because a semantic label changes.
export function resolveCelestialCosmologyContinuitySnapshot({
  distanceMeters = LEGACY_MAXIMUM_LIGHT_YEARS * LIGHT_YEAR_METERS,
  metersPerUnit = null,
  reducedMotion = false,
  seed = 0x636f736d
} = {}) {
  const presentation = resolveCelestialCosmologyPresentation({
    distanceMeters,
    metersPerUnit,
    reducedMotion
  });
  const hierarchy = createCanonicalCosmologyHierarchy(seed);
  const nodes = Object.freeze(hierarchy.nodes.map((node) => Object.freeze({
    id: node.id,
    parentId: node.parentId,
    originTierId: node.originTierId,
    kind: node.kind,
    positionLightYears: node.positionLightYears,
    localPosition: freezeVector(node.positionLightYears.map(
      (coordinate) => coordinate * LIGHT_YEAR_METERS / presentation.metersPerUnit
    )),
    brightness: node.brightness,
    effectiveBrightness: node.brightness,
    ownerTierIds: Object.freeze(CELESTIAL_COSMOLOGY_TIER_IDS.filter(
      (tierId) => presentation.weights[tierId] > 0
    ))
  })));
  const filamentEdges = Object.freeze(hierarchy.edges.map((edge) => Object.freeze({
    ...edge,
    effectiveOpacity: 1
  })));
  return Object.freeze({
    tierId: presentation.tierId,
    distanceMeters: presentation.distanceMeters,
    metersPerUnit: presentation.metersPerUnit,
    weights: presentation.weights,
    nodes,
    filamentEdges,
    activeEdgeIds: Object.freeze(filamentEdges.map(({ id }) => id)),
    totalEffectiveBrightness: nodes.reduce((sum, { effectiveBrightness }) => sum + effectiveBrightness, 0)
  });
}

const requireThree = (THREE) => {
  for (const name of [
    "Group", "BufferGeometry", "Float32BufferAttribute", "Points", "PointsMaterial", "DataTexture",
    "LineSegments", "LineBasicMaterial", "ShaderMaterial", "Color", "SphereGeometry", "Mesh"
  ]) {
    if (typeof THREE?.[name] !== "function") throw new Error(`Celestial cosmology requires THREE.${name}`);
  }
  for (const name of ["RGBAFormat", "UnsignedByteType", "LinearFilter", "AdditiveBlending", "BackSide", "DoubleSide"]) {
    if (THREE?.[name] == null) throw new Error(`Celestial cosmology requires THREE.${name}`);
  }
};

export function createCelestialCosmology(THREE, {
  quality = "standard",
  seed = 0x636f736d,
  observerPosition = [0, 0, 0],
  reducedMotion = false,
  effectsLevel = "full",
  devicePixelRatio = 1,
  onInvalidate = null
} = {}) {
  requireThree(THREE);
  const resolvedQuality = quality === "low" ? "low" : "standard";
  let cinematicPolicy = resolveCosmicQualityPolicy({
    quality: resolvedQuality, effectsLevel, reducedMotion, devicePixelRatio
  });
  let cinematicReducedMotion = Boolean(reducedMotion);
  let cinematicEffectsLevel = effectsLevel;
  let renderContext = Object.freeze({
    viewportWidth: 1600,
    viewportHeight: 900,
    devicePixelRatio: positive(devicePixelRatio),
    elapsedSeconds: 0,
    moving: false
  });
  const data = createCelestialCosmologyData({ quality: resolvedQuality, seed });
  const root = new THREE.Group();
  root.name = "celestial-cosmology";
  root.position.fromArray(observerPosition);
  root.userData.celestialCosmology = true;
  root.userData.noFloorGrid = true;

  const tierRoots = new Map();
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const pointTexture = createSoftPointTexture(THREE);
  const galaxyPointTexture = createGalaxyPointTexture(THREE);
  textures.add(pointTexture).add(galaxyPointTexture);
  const materialOpacity = new Map();
  const materialSize = new Map();
  const registerGeometry = (geometry) => (geometries.add(geometry), geometry);
  const registerMaterial = (material, opacity) => {
    materials.add(material);
    materialOpacity.set(material, opacity);
    if (Number.isFinite(material.size)) materialSize.set(material, material.size);
    return material;
  };

  for (const tier of CELESTIAL_COSMOLOGY_TIER_DEFINITIONS) {
    const tierRoot = new THREE.Group();
    tierRoot.name = `celestial-cosmology-${tier.id}`;
    Object.assign(tierRoot.userData, {
      celestialCosmologyTier: tier.id,
      coordinateFrame: "observer-equatorial-j2000",
      nativeUnitLightYears: tier.nativeUnitLightYears,
      noFloorGrid: true
    });
    // Tier roots are semantic aliases over one canonical geometry, not five
    // independent skies. RenderOrder/depthWrite make coincident crossfades
    // deterministic when both adjacent aliases are visible.
    tierRoot.renderOrder = CELESTIAL_COSMOLOGY_TIER_IDS.indexOf(tier.id);
    const tierData = data.tiers[tier.id];

    const pointGeometry = registerGeometry(new THREE.BufferGeometry());
    pointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tierData.positions, 3));
    const pointMaterial = registerMaterial(new THREE.PointsMaterial({
      color: CANONICAL_UNIVERSE_COLOR,
      size: resolvedQuality === "low" ? 0.032 : 0.038,
      sizeAttenuation: true,
      map: pointTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.86,
      alphaTest: 0,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    }), 0.86);
    const pointField = new THREE.Points(pointGeometry, pointMaterial);
    pointField.name = `${tierRoot.name}-density`;
    pointField.userData.cosmologyVisualKind = "density-samples";
    pointField.renderOrder = tierRoot.renderOrder;
    tierRoot.add(pointField);

    const coreGeometry = registerGeometry(new THREE.BufferGeometry());
    coreGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tierData.structureCorePositions, 3));
    const coreMaterial = registerMaterial(new THREE.PointsMaterial({
      color: 0xf2fbff,
      size: resolvedQuality === "low" ? 0.11 : 0.14,
      sizeAttenuation: true,
      map: galaxyPointTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.76,
      alphaTest: 0,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    }), 0.76);
    const structureCores = new THREE.Points(coreGeometry, coreMaterial);
    structureCores.name = `${tierRoot.name}-structure-cores`;
    structureCores.userData.cosmologyVisualKind = "procedural-structure-cores";
    structureCores.renderOrder = tierRoot.renderOrder;
    tierRoot.add(structureCores);

    const anchorGeometry = registerGeometry(new THREE.BufferGeometry());
    anchorGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tierData.anchorPositions, 3));
    const anchorMaterial = registerMaterial(new THREE.PointsMaterial({
      color: 0xffffff,
      size: resolvedQuality === "low" ? 0.13 : 0.17,
      sizeAttenuation: true,
      map: galaxyPointTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.9,
      alphaTest: 0,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    }), 0.9);
    const anchors = new THREE.Points(anchorGeometry, anchorMaterial);
    anchors.name = `${tierRoot.name}-anchors`;
    anchors.userData.cosmologyVisualKind = "catalog-anchors";
    anchors.renderOrder = tierRoot.renderOrder;
    tierRoot.add(anchors);

    const filamentGeometry = registerGeometry(new THREE.BufferGeometry());
    filamentGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tierData.filamentPositions, 3));
    const filamentOpacity = 0.012;
    const filamentMaterial = registerMaterial(new THREE.LineBasicMaterial({
      color: CANONICAL_UNIVERSE_COLOR,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: filamentOpacity,
      depthTest: true,
      depthWrite: false
    }), filamentOpacity);
    const filaments = new THREE.LineSegments(filamentGeometry, filamentMaterial);
    filaments.name = `${tierRoot.name}-filaments`;
    filaments.userData.cosmologyVisualKind = "survey-filaments";
    filaments.userData.noFloorGrid = true;
    filaments.renderOrder = tierRoot.renderOrder;
    tierRoot.add(filaments);

    const traceGeometry = registerGeometry(new THREE.BufferGeometry());
    traceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tierData.filamentTracePositions, 3));
    const traceMaterial = registerMaterial(new THREE.PointsMaterial({
      color: CANONICAL_UNIVERSE_COLOR,
      size: resolvedQuality === "low" ? 0.026 : 0.032,
      sizeAttenuation: true,
      map: pointTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.7,
      alphaTest: 0,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    }), 0.7);
    const filamentTrace = new THREE.Points(traceGeometry, traceMaterial);
    filamentTrace.name = `${tierRoot.name}-filament-trace`;
    filamentTrace.userData.cosmologyVisualKind = "survey-filament-density";
    filamentTrace.renderOrder = tierRoot.renderOrder;
    tierRoot.add(filamentTrace);

    // Geometry coordinates are canonical light-years. Cancel the semantic
    // root's native-unit factor on visuals only; navigation anchors retain the
    // public native-unit contract below.
    for (const visual of [pointField, structureCores, anchors, filaments, filamentTrace]) {
      visual.scale.setScalar(1 / tier.nativeUnitLightYears);
    }

    root.add(tierRoot);
    tierRoots.set(tier.id, Object.freeze({
      tier, root: tierRoot, pointField, structureCores, anchors, filaments, filamentTrace
    }));
    // Budgets remain useful diagnostics, but semantic aliases submit the same
    // complete buffers. Changing a draw prefix at a tier boundary creates and
    // destroys unrelated stars across the whole frame.
    pointGeometry.setDrawRange(0, pointGeometry.getAttribute("position").count);
    traceGeometry.setDrawRange(0, traceGeometry.getAttribute("position").count);
  }

  // One persistent grandeur root augments the canonical hierarchy when its
  // children become unresolved. It is never replaced at a semantic boundary:
  // stable volume, strand, and horizon samples merely exchange conserved light
  // with the detail already present in the tier aliases above.
  const grandeurRoot = new THREE.Group();
  grandeurRoot.name = "celestial-cosmology-grandeur";
  Object.assign(grandeurRoot.userData, {
    celestialCosmologyGrandeur: true,
    coordinateFrame: "observer-equatorial-j2000-light-years",
    worldIndependent: true,
    noFloorGrid: true
  });
  grandeurRoot.renderOrder = CELESTIAL_COSMOLOGY_TIER_IDS.length + 1;
  root.add(grandeurRoot);

  const grandeurBlueprint = createGrandeurBlueprint(
    createCanonicalCosmologyHierarchy(data.seed), resolvedQuality, data.seed
  );
  const galaxySilhouetteBlueprint = createCelestialCosmologyGalaxySilhouetteBlueprint({
    quality: resolvedQuality,
    seed: data.seed
  });
  const galaxySilhouettes = new Map();
  for (const silhouette of galaxySilhouetteBlueprint) {
    const geometry = registerGeometry(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(
      convertCanonicalPositions(silhouette.positionsLightYears, 1), 3
    ));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(silhouette.colors, 3));
    const material = registerMaterial(new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.0018,
      sizeAttenuation: true,
      map: pointTexture,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0,
      alphaTest: 0,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    }), 1);
    const galaxy = new THREE.Points(geometry, material);
    galaxy.name = `celestial-cosmology-${silhouette.placeId}-physical-silhouette`;
    galaxy.position.fromArray(silhouette.positionLightYears);
    Object.assign(galaxy.userData, {
      cosmologyVisualKind: "resolved-galaxy-silhouette",
      cosmologyNodeId: silhouette.catalogNodeId,
      celestialCosmologyPlace: silhouette.placeId,
      morphology: silhouette.morphology,
      islandCount: silhouette.islandCount,
      silhouetteTierId: silhouette.tierId,
      pointSizeFactor: silhouette.pointSizeFactor,
      geometryKind: silhouette.morphology === "irregular"
        ? "physically-oriented-3d-irregular-cloud"
        : "physically-oriented-3d-star-disk",
      coordinateFrame: silhouette.coordinateFrame,
      orientationSource: silhouette.orientationSource,
      noFloorGrid: true
    });
    galaxy.visible = false;
    galaxy.renderOrder = grandeurRoot.renderOrder + 0.25;
    grandeurRoot.add(galaxy);
    galaxySilhouettes.set(silhouette.placeId, galaxy);
  }
  const aggregateVisuals = new Map();
  const radianceSplats = new Map();
  for (const volume of grandeurBlueprint.aggregateVolumes) {
    const recordRoot = new THREE.Group();
    recordRoot.name = `celestial-cosmology-volume-${volume.tierId}`;
    recordRoot.userData.cosmologyAggregateId = volume.id;

    const auraGeometry = registerGeometry(new THREE.BufferGeometry());
    auraGeometry.setAttribute("position", new THREE.Float32BufferAttribute(
      convertCanonicalPositions(volume.volumePositionsLightYears, 1), 3
    ));
    addCinematicRadianceAttributes(THREE, auraGeometry,
      auraGeometry.getAttribute("position").count,
      data.seed ^ hashString(volume.id), { baseSize: 1, intensity: 0.72 });
    const auraMaterial = registerMaterial(createCinematicRadianceMaterial(THREE, {
      color: CANONICAL_UNIVERSE_COLOR,
      opacity: 0,
      sharpness: resolvedQuality === "low" ? 2.15 : 1.75,
      volume: true
    }), 1);
    const aura = new THREE.Points(auraGeometry, auraMaterial);
    aura.name = `${recordRoot.name}-aura`;
    aura.userData.cosmologyVisualKind = "aggregate-volume-aura";
    aura.renderOrder = grandeurRoot.renderOrder;
    recordRoot.add(aura);

    const coreGeometry = registerGeometry(new THREE.BufferGeometry());
    coreGeometry.setAttribute("position", new THREE.Float32BufferAttribute(
      volume.centroidLightYears, 3
    ));
    const coreMaterial = registerMaterial(new THREE.PointsMaterial({
      color: 0xf2fbff,
      size: 0.03,
      sizeAttenuation: true,
      map: galaxyPointTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0,
      alphaTest: 0,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    }), 1);
    const core = new THREE.Points(coreGeometry, coreMaterial);
    core.name = `${recordRoot.name}-unresolved-core`;
    core.userData.cosmologyVisualKind = "unresolved-aggregate-light";
    core.renderOrder = grandeurRoot.renderOrder + 0.1;
    recordRoot.add(core);
    grandeurRoot.add(recordRoot);
    aggregateVisuals.set(volume.id, Object.freeze({ volume, root: recordRoot, aura, core }));
    radianceSplats.set(volume.id, aura);
  }

  const combinedFilamentAuraPositions = new Float64Array(grandeurBlueprint.filamentAuras.reduce(
    (count, aura) => count + aura.positionsLightYears.length, 0
  ));
  let combinedFilamentCursor = 0;
  for (const aura of grandeurBlueprint.filamentAuras) {
    combinedFilamentAuraPositions.set(aura.positionsLightYears, combinedFilamentCursor);
    combinedFilamentCursor += aura.positionsLightYears.length;
  }
  const filamentAuraGeometry = registerGeometry(new THREE.BufferGeometry());
  filamentAuraGeometry.setAttribute("position", new THREE.Float32BufferAttribute(
    convertCanonicalPositions(combinedFilamentAuraPositions, 1), 3
  ));
  addCinematicRadianceAttributes(THREE, filamentAuraGeometry,
    filamentAuraGeometry.getAttribute("position").count,
    data.seed ^ hashString("cinematic-web"), { baseSize: 1, intensity: 0.88,
      color: [0.52, 0.86, 0.95] });
  const filamentIntensityAttribute = filamentAuraGeometry.getAttribute("intensity");
  const filamentPositionAttribute = filamentAuraGeometry.getAttribute("position");
  const filamentBaseIntensity = Float32Array.from(filamentIntensityAttribute.array);
  const filamentEdgeKindWeight = new Float32Array(filamentIntensityAttribute.count);
  let filamentKindCursor = 0;
  for (const aura of grandeurBlueprint.filamentAuras) {
    const edgeKind = data.hierarchy.edges.find(({ id }) => id === aura.id)?.kind;
    const kindWeight = edgeKind === "structure" ? 1 : edgeKind === "catalog" ? 0.12 : 0;
    filamentEdgeKindWeight.fill(kindWeight, filamentKindCursor,
      filamentKindCursor + aura.sampleIds.length);
    filamentKindCursor += aura.sampleIds.length;
  }
  const filamentHaloMaterial = registerMaterial(createCinematicRadianceMaterial(THREE, {
    color: 0x55bdca, opacity: 0, sharpness: CINEMATIC_FILAMENT_PASSES[0].sharpness
  }), 1);
  const filamentHalo = new THREE.Points(filamentAuraGeometry, filamentHaloMaterial);
  filamentHalo.name = "celestial-cosmology-filament-aura";
  filamentHalo.userData.cosmologyVisualKind = "hierarchical-filament-aura";
  filamentHalo.renderOrder = grandeurRoot.renderOrder - 0.2;
  grandeurRoot.add(filamentHalo);

  const filamentStrandMaterial = registerMaterial(createCinematicRadianceMaterial(THREE, {
    color: 0x91e8f1, opacity: 0, sharpness: CINEMATIC_FILAMENT_PASSES[1].sharpness
  }), 1);
  const filamentStrand = new THREE.Points(filamentAuraGeometry, filamentStrandMaterial);
  filamentStrand.name = "celestial-cosmology-filament-strand";
  filamentStrand.userData.cosmologyVisualKind = "hierarchical-filament-strand";
  filamentStrand.renderOrder = grandeurRoot.renderOrder - 0.15;
  grandeurRoot.add(filamentStrand);

  const filamentSpineMaterial = registerMaterial(createCinematicRadianceMaterial(THREE, {
    color: 0xf4fdff, opacity: 0, sharpness: CINEMATIC_FILAMENT_PASSES[2].sharpness
  }), 1);
  const filamentSpine = new THREE.Points(filamentAuraGeometry, filamentSpineMaterial);
  filamentSpine.name = "celestial-cosmology-filament-spine";
  filamentSpine.userData.cosmologyVisualKind = "hierarchical-filament-spine";
  filamentSpine.renderOrder = grandeurRoot.renderOrder - 0.1;
  grandeurRoot.add(filamentSpine);

  let horizon;
  if (resolvedQuality === "low") {
    const horizonGeometry = registerGeometry(new THREE.BufferGeometry());
    horizonGeometry.setAttribute("position", new THREE.Float32BufferAttribute(
      convertCanonicalPositions(grandeurBlueprint.horizon.positionsLightYears, 1), 3
    ));
    const horizonMaterial = registerMaterial(new THREE.PointsMaterial({
      color: 0xd5a7ff,
      size: 0.025,
      sizeAttenuation: true,
      map: pointTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0,
      alphaTest: 0,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    }), 1);
    horizon = new THREE.Points(horizonGeometry, horizonMaterial);
  } else {
    // A true inside-facing sphere makes the last-scattering surface feel like
    // the boundary of the observer's light cone rather than a purple dot cloud.
    // The shader is analytic and direction keyed: the same granular knots and
    // limb return after a rebase, resize, or reverse zoom.
    const horizonGeometry = registerGeometry(new THREE.SphereGeometry(
      LAST_SCATTERING_RADIUS_LIGHT_YEARS, 96, 64
    ));
    const horizonMaterial = registerMaterial(new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xd5a7ff) },
        uOpacity: { value: 0 },
        uGranularity: { value: 1 },
        uTime: { value: 0 },
        uMotion: { value: 1 }
      },
      vertexShader: `
        varying vec3 vDirection;
        varying vec3 vViewNormal;
        void main() {
          vDirection = normalize(position);
          vViewNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uGranularity;
        uniform float uTime;
        uniform float uMotion;
        varying vec3 vDirection;
        varying vec3 vViewNormal;

        float hash31(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }

        float valueNoise(vec3 p) {
          vec3 cell = floor(p);
          vec3 amount = fract(p);
          amount = amount * amount * (3.0 - 2.0 * amount);
          return mix(
            mix(mix(hash31(cell), hash31(cell + vec3(1, 0, 0)), amount.x),
                mix(hash31(cell + vec3(0, 1, 0)), hash31(cell + vec3(1, 1, 0)), amount.x), amount.y),
            mix(mix(hash31(cell + vec3(0, 0, 1)), hash31(cell + vec3(1, 0, 1)), amount.x),
                mix(hash31(cell + vec3(0, 1, 1)), hash31(cell + vec3(1, 1, 1)), amount.x), amount.y),
            amount.z
          );
        }

        void main() {
          vec3 direction = normalize(vDirection);
          float coarse = valueNoise(direction * 38.0);
          float middle = valueNoise(direction * 113.0 + coarse * 8.0);
          float fine = valueNoise(direction * 347.0 + middle * 17.0);
          float acoustic = sin(direction.x * 211.0 + coarse * 7.0)
            * sin(direction.y * 187.0 - middle * 5.0)
            * 0.5 + 0.5;
          float grains = smoothstep(0.44, 0.91,
            coarse * 0.29 + middle * 0.37 + fine * 0.25 + acoustic * 0.09);
          float limb = pow(1.0 - abs(dot(normalize(vViewNormal), vec3(0.0, 0.0, 1.0))), 1.8);
          float breathing = 1.0 + sin(uTime * 0.035 + coarse * 6.28318) * 0.015 * uMotion;
          float alpha = uOpacity * breathing * (0.012 + grains * 0.3 + limb * 0.76) * uGranularity;
          if (alpha < 0.001) discard;
          vec3 violet = mix(uColor * 0.48, uColor * 1.28 + vec3(0.07, 0.025, 0.1), grains);
          gl_FragColor = vec4(violet, alpha);
        }
      `,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    }), 1);
    horizon = new THREE.Mesh(horizonGeometry, horizonMaterial);
  }
  horizon.name = "celestial-cosmology-observable-horizon";
  Object.assign(horizon.userData, {
    cosmologyVisualKind: "observer-centered-spherical-horizon",
    observerCentered: true,
    geometryKind: "observer-centered-spherical-shell"
  });
  horizon.renderOrder = grandeurRoot.renderOrder - 0.3;
  grandeurRoot.add(horizon);

  const grandeurVisuals = Object.freeze({
    aggregateVisuals,
    galaxySilhouettes,
    radianceSplats,
    volumeVisuals: aggregateVisuals,
    filamentHalo,
    filamentHaze: filamentHalo,
    filamentStrand,
    filamentSpine,
    horizon,
    get policy() { return cinematicPolicy; }
  });

  // Navigation descriptors stay serializable, while per-instance targets add
  // an empty Object3D anchor beneath the correctly rebased/scaled tier root.
  // Renderers can therefore call anchor.getWorldPosition() without rebuilding
  // cosmological transforms or treating catalog coordinates as scene units.
  const navigationTargets = new Map();
  for (const place of CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG) {
    const tierRecord = tierRoots.get(place.tierId);
    const anchor = new THREE.Group();
    anchor.name = `celestial-cosmology-place-${place.id}`;
    anchor.position.fromArray(place.nativePosition);
    Object.assign(anchor.userData, {
      celestialCosmologyPlace: place.id,
      worldIndependent: true,
      noFloorGrid: true
    });
    tierRecord.root.add(anchor);
    navigationTargets.set(place.id, Object.freeze({ ...place, root: tierRecord.root, object: anchor, anchor }));
  }

  const selectionRoot = new THREE.Group();
  selectionRoot.name = "celestial-cosmology-selection";
  selectionRoot.visible = false;
  const selectionGeometry = registerGeometry(new THREE.BufferGeometry());
  selectionGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -1, 0, 0, 1, 0, 0,
    0, -1, 0, 0, 1, 0,
    0, 0, -1, 0, 0, 1
  ], 3));
  const selectionMaterial = registerMaterial(new THREE.LineBasicMaterial({
    color: 0xffdd82,
    transparent: true,
    opacity: 0.95,
    depthWrite: false
  }), 0.95);
  selectionRoot.add(new THREE.LineSegments(selectionGeometry, selectionMaterial));

  let selectedPlaceId = null;
  let disposed = false;
  let transitionOpacity = 1;
  let transitionPrewarm = false;
  let semanticPresentation = resolveCelestialCosmologyPresentation({ reducedMotion });
  let grandeurSnapshot = resolveCelestialCosmologyGrandeurSnapshot({
    distanceMeters: semanticPresentation.distanceMeters,
    metersPerUnit: semanticPresentation.metersPerUnit,
    quality: resolvedQuality,
    seed: data.seed
  });
  let lastFilamentMorphDistanceLightYears = Number.NaN;

  const grandeurEnergyFractions = (snapshot) => {
    const denominator = Math.max(1e-12, snapshot.totalLeafBrightness);
    const aggregateEnergy = snapshot.nodeEnergy.reduce((sum, energy) => (
      energy.collapse > 0 ? sum + energy.emittedBrightness : sum
    ), 0) / denominator;
    return Object.freeze({
      aggregateEnergy: clamp(aggregateEnergy, 0, 1),
      detailEnergy: clamp(1 - aggregateEnergy, 0, 1)
    });
  };

  const setGrandeurPresentation = () => {
    const snapshot = resolveCelestialCosmologyGrandeurSnapshot({
      distanceMeters: semanticPresentation.distanceMeters,
      metersPerUnit: semanticPresentation.metersPerUnit,
      quality: resolvedQuality,
      seed: data.seed
    });
    grandeurSnapshot = snapshot;
    grandeurRoot.scale.setScalar(LIGHT_YEAR_METERS / semanticPresentation.metersPerUnit);
    grandeurRoot.visible = transitionPrewarm || transitionOpacity > 0.001;
    const localDolly = semanticPresentation.distanceMeters / semanticPresentation.metersPerUnit;
    const palette = snapshot.palette;
    const energy = grandeurEnergyFractions(snapshot);
    const art = resolveCelestialCosmologyArtDirection({
      distanceMeters: semanticPresentation.distanceMeters
    });
    for (const aggregate of snapshot.aggregateVolumes) {
      const visual = aggregateVisuals.get(aggregate.id);
      if (!visual) continue;
      const rootOffset = aggregate.renderPositionLightYears.map(
        (value, axis) => value - aggregate.centroidLightYears[axis]
      );
      visual.root.position.fromArray(rootOffset);
      const normalizedEnergy = aggregate.emittedBrightness
        / Math.max(1e-12, snapshot.totalLeafBrightness);
      // Luminosity is linear in the energy ledger, but perceived density on a
      // black display is closer to a square-root response. This makes the real
      // covariance extent readable before it owns all energy, without changing
      // the complementary detail/aggregate accounting below.
      const presence = Math.sqrt(clamp(normalizedEnergy, 0, 1)) * transitionOpacity;
      const volumePresence = presence * art.volumeGain;
      visual.root.visible = transitionPrewarm || presence > 0.001;
      const volumeCount = visual.aura.geometry.getAttribute("position")?.count || 0;
      visual.aura.geometry.setDrawRange(0, Math.ceil(volumeCount
        * cinematicPolicy.splatLayers / 4));
      visual.aura.material.color.setHex(palette.density);
      visual.core.material.color.setHex(palette.core);
      // These are emissive unresolved-light kernels rather than physical body
      // diameters. Their depth attenuation remains enabled, while localDolly
      // compensates precision-cell changes so the same energy does not blink at
      // a rebase. Spatial extent still comes solely from the real 3D samples.
      visual.aura.material.size = (resolvedQuality === "low" ? 0.04 : 0.05)
        * localDolly * mix(1, 1.62, clamp(art.branchScale - 1, 0, 1));
      visual.core.material.size = (resolvedQuality === "low" ? 0.095 : 0.12) * localDolly;
      visual.aura.material.opacity = volumePresence * (0.48 + palette.amount * 0.12);
      visual.core.material.opacity = presence * art.coreGain * (0.72 + palette.amount * 0.12);
      if (visual.aura.material.uniforms?.uRaySteps) {
        visual.aura.material.uniforms.uRaySteps.value = cinematicPolicy.raySteps;
        visual.aura.material.uniforms.uMotion.value = cinematicPolicy.animate ? 1 : 0;
      }
      visual.aura.visible = cinematicPolicy.volumesEnabled && visual.root.visible;
    }
    let filamentCursor = 0;
    let filamentPresence = 0;
    const updateFilamentMorph = snapshot.distanceLightYears !== lastFilamentMorphDistanceLightYears;
    for (const aura of snapshot.filamentAuras) {
      const auraPresence = Math.pow(aura.emittedOpacity, art.filamentExponent);
      filamentPresence = Math.max(filamentPresence, auraPresence);
      for (let index = 0; index < aura.sampleIds.length; index += 1, filamentCursor += 1) {
        filamentIntensityAttribute.array[filamentCursor] = filamentBaseIntensity[filamentCursor]
          * Math.sqrt(auraPresence) * filamentEdgeKindWeight[filamentCursor];
        // Only luminous curves need a position upload. Retired tiers stay dark;
        // when reverse zoom re-enters them this deterministic affine is applied
        // again to the same stable buffer prefix.
        if (updateFilamentMorph && auraPresence > 0.000001) for (let axis = 0; axis < 3; axis += 1) {
          filamentPositionAttribute.array[filamentCursor * 3 + axis]
            = aura.positionsLightYears[index * 3 + axis] * aura.renderScale
              + aura.renderOffsetLightYears[axis];
        }
      }
    }
    filamentIntensityAttribute.needsUpdate = true;
    if (updateFilamentMorph) {
      filamentPositionAttribute.needsUpdate = true;
      lastFilamentMorphDistanceLightYears = snapshot.distanceLightYears;
    }
    filamentHalo.material.color.setHex(palette.filament);
    filamentStrand.material.color.setHex(mixHexColor(palette.filament, palette.core, 0.52));
    filamentSpine.material.color.setHex(palette.core);
    const webScale = (resolvedQuality === "low" ? 0.03 : 0.042)
      * localDolly * art.branchScale;
    filamentHalo.material.size = webScale * CINEMATIC_FILAMENT_PASSES[0].width;
    filamentStrand.material.size = webScale * CINEMATIC_FILAMENT_PASSES[1].width;
    filamentSpine.material.size = webScale * CINEMATIC_FILAMENT_PASSES[2].width;
    filamentHalo.material.opacity = clamp(filamentPresence * art.filamentGain * transitionOpacity
      * CINEMATIC_FILAMENT_PASSES[0].opacity * art.filamentPassGain.haze, 0, 1);
    filamentStrand.material.opacity = clamp(filamentPresence * art.filamentGain * transitionOpacity
      * CINEMATIC_FILAMENT_PASSES[1].opacity * art.filamentPassGain.strand, 0, 1);
    filamentSpine.material.opacity = clamp(filamentPresence * art.filamentGain * transitionOpacity
      * CINEMATIC_FILAMENT_PASSES[2].opacity * art.filamentPassGain.spine, 0, 1);
    const filamentPasses = [filamentHalo, filamentStrand, filamentSpine];
    for (const [index, web] of filamentPasses.entries()) {
      web.visible = index >= filamentPasses.length - cinematicPolicy.visibleFilamentPasses
        && cinematicPolicy.volumesEnabled && (transitionPrewarm || web.material.opacity > 0.001);
      if (web.material.uniforms?.uMotion) {
        web.material.uniforms.uMotion.value = cinematicPolicy.animate ? 1 : 0;
        web.material.uniforms.uRaySteps.value = 1;
      }
    }
    for (const galaxy of galaxySilhouettes.values()) {
      const silhouetteWeight = resolveCelestialCosmologyGalaxySilhouetteWeight({
        distanceMeters: semanticPresentation.distanceMeters,
        tierId: galaxy.userData.silhouetteTierId
      }) * energy.detailEnergy * transitionOpacity;
      galaxy.material.color.setHex(mixHexColor(0xffffff, palette.core, palette.amount * 0.25));
      galaxy.material.size = (resolvedQuality === "low" ? 0.00125 : 0.0018)
        * galaxy.userData.pointSizeFactor * localDolly;
      const islandGain = galaxy.userData.silhouetteTierId === "nearby-groups"
        ? art.nearbyIslandGain : 1;
      galaxy.material.opacity = clamp(silhouetteWeight * islandGain
        * (resolvedQuality === "low" ? 0.62 : 0.78), 0, 1);
      galaxy.visible = transitionPrewarm || galaxy.material.opacity > 0.001;
    }
    const horizonOpacity = clamp(snapshot.horizon.opacity * transitionOpacity * art.horizonGain
      * (resolvedQuality === "low" ? 0.3 : 0.82), 0, 1);
    horizon.scale.setScalar(art.horizonScale);
    if (horizon.material.uniforms?.uOpacity) {
      horizon.material.uniforms.uColor.value.setHex(palette.horizon);
      horizon.material.uniforms.uOpacity.value = horizonOpacity;
      horizon.material.uniforms.uGranularity.value = cinematicPolicy.volumesEnabled ? 1 : 0.42;
      horizon.material.uniforms.uMotion.value = cinematicPolicy.animate ? 1 : 0;
    } else {
      horizon.material.color.setHex(palette.horizon);
      horizon.material.size = 0.01 * localDolly;
      horizon.material.opacity = horizonOpacity;
    }
    horizon.visible = transitionPrewarm || horizonOpacity > 0.001;
    grandeurRoot.userData.palette = palette;
    grandeurRoot.userData.snapshot = snapshot;
    grandeurRoot.userData.detailEnergy = energy.detailEnergy;
    grandeurRoot.userData.aggregateEnergy = energy.aggregateEnergy;
    grandeurRoot.userData.totalVisualEnergy = energy.detailEnergy + energy.aggregateEnergy;
    grandeurRoot.userData.horizonEnergy = snapshot.horizon.opacity;
    grandeurRoot.userData.artDirection = art;
    return snapshot;
  };

  const setEffectsLevel = (level = "full", options = {}) => {
    cinematicEffectsLevel = level;
    cinematicReducedMotion = Boolean(options.reducedMotion ?? cinematicReducedMotion);
    cinematicPolicy = resolveCosmicQualityPolicy({
      quality: resolvedQuality,
      effectsLevel: cinematicEffectsLevel,
      reducedMotion: cinematicReducedMotion,
      devicePixelRatio: options.devicePixelRatio ?? renderContext.devicePixelRatio
    });
    setGrandeurPresentation();
    invalidate();
    return cinematicPolicy;
  };

  const setRenderContext = (context = {}) => {
    renderContext = Object.freeze({
      viewportWidth: positive(context.viewportWidth, renderContext.viewportWidth),
      viewportHeight: positive(context.viewportHeight, renderContext.viewportHeight),
      devicePixelRatio: positive(context.devicePixelRatio, renderContext.devicePixelRatio),
      elapsedSeconds: Math.max(0, finite(context.elapsedSeconds, renderContext.elapsedSeconds)),
      moving: Boolean(context.moving)
    });
    const motion = !cinematicPolicy.animate ? 0 : renderContext.moving ? 0.28 : 1;
    for (const visual of radianceSplats.values()) {
      if (visual.material.uniforms?.uTime) {
        visual.material.uniforms.uTime.value = renderContext.elapsedSeconds;
        visual.material.uniforms.uMotion.value = motion;
        visual.material.uniforms.uViewportHeight.value = renderContext.viewportHeight
          * renderContext.devicePixelRatio;
      }
    }
    for (const visual of [filamentHalo, filamentStrand, filamentSpine]) {
      if (visual.material.uniforms?.uTime) {
        visual.material.uniforms.uTime.value = renderContext.elapsedSeconds;
        visual.material.uniforms.uMotion.value = motion;
        visual.material.uniforms.uViewportHeight.value = renderContext.viewportHeight
          * renderContext.devicePixelRatio;
      }
    }
    if (horizon.material.uniforms?.uTime) {
      horizon.material.uniforms.uTime.value = renderContext.elapsedSeconds;
      horizon.material.uniforms.uMotion.value = motion;
    }
    return renderContext;
  };

  const invalidate = () => {
    if (typeof onInvalidate === "function") onInvalidate();
  };

  const setTierOpacity = (record, opacity, { prewarm = false } = {}) => {
    const amount = clamp(opacity, 0, 1);
    const detailEnergy = grandeurEnergyFractions(grandeurSnapshot).detailEnergy;
    const art = resolveCelestialCosmologyArtDirection({
      distanceMeters: semanticPresentation.distanceMeters
    });
    const localDolly = semanticPresentation.distanceMeters / semanticPresentation.metersPerUnit;
    const psfSizes = UNRESOLVED_PSF_SIZE[resolvedQuality];
    record.root.visible = prewarm || amount > 0.001;
    record.root.traverse((object) => {
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of objectMaterials) {
        if (!material || !materialOpacity.has(material)) continue;
        // Canonical galaxy/detail light is the exact complement of the
        // unresolved aggregate ledger. This prevents the grandeur pass from
        // becoming an additive second universe as parent kernels emerge.
        const visualKind = object.userData?.cosmologyVisualKind;
        const perceptualDetail = visualKind === "density-samples" ? art.detailCarpet
          : visualKind === "survey-filament-density" ? art.detailCarpet * 0.48
            : visualKind === "survey-filaments" ? art.structureDetail
              : art.landmarkDetail;
        material.opacity = materialOpacity.get(material) * amount * detailEnergy * perceptualDetail;
        // Adjacent semantic roots are aliases of the same physical universe.
        // Semantic aliases share one unresolved PSF calibration. The PSF
        // follows localDolly (rather than physical body diameter) so galaxies
        // remain legible as their separations contract, and the ratio
        // size/camera-depth is unchanged at a precision-cell rebase.
        if (materialSize.has(material)) {
          const psfSize = psfSizes[object.userData?.cosmologyVisualKind];
          material.size = Number.isFinite(psfSize)
            ? psfSize * localDolly
            : materialSize.get(material) * resolveCelestialCosmologyPointSizeScale(
              semanticPresentation
            );
        }
      }
    });
    // All tiers contain the same canonical edge graph in the same stable hash
    // order. Never reveal an arbitrary buffer prefix as opacity changes: that
    // made topology crawl and pop even though the camera had not moved.
    const count = record.filaments.geometry.getAttribute("position")?.count || 0;
    record.filaments.geometry.setDrawRange(0, count);
  };

  const setSemanticTier = (input = {}) => {
    const options = typeof input === "string" ? { tierId: input } : input || {};
    const requestedTier = TIER_BY_ID.get(options.tierId || options.tier || options.id || options.band);
    const fallbackLightYears = requestedTier
      ? Math.sqrt(requestedTier.minimumLightYears * requestedTier.maximumLightYears)
      : LEGACY_MAXIMUM_LIGHT_YEARS;
    semanticPresentation = resolveCelestialCosmologyPresentation({
      distanceMeters: options.distanceMeters ?? fallbackLightYears * LIGHT_YEAR_METERS,
      representedDistanceMeters: options.representedDistanceMeters,
      metersPerUnit: options.metersPerUnit,
      reducedMotion: options.reducedMotion ?? reducedMotion
    });
    grandeurSnapshot = resolveCelestialCosmologyGrandeurSnapshot({
      distanceMeters: semanticPresentation.distanceMeters,
      metersPerUnit: semanticPresentation.metersPerUnit,
      quality: resolvedQuality,
      seed: data.seed
    });
    for (const [tierId, record] of tierRoots) {
      record.root.scale.setScalar(
        record.tier.nativeUnitLightYears * LIGHT_YEAR_METERS / semanticPresentation.metersPerUnit
      );
      const prewarm = semanticPresentation.prewarmTierIds.includes(tierId)
        || transitionPrewarm && semanticPresentation.weights[tierId] > 0.001;
      setTierOpacity(record, semanticPresentation.weights[tierId] * transitionOpacity, { prewarm });
    }
    setGrandeurPresentation();
    invalidate();
    return semanticPresentation;
  };

  const setTransitionOpacity = (value = 1, { prewarm = false } = {}) => {
    transitionOpacity = clamp(value, 0, 1);
    transitionPrewarm = Boolean(prewarm);
    for (const [tierId, record] of tierRoots) {
      const tierPrewarm = semanticPresentation.prewarmTierIds.includes(tierId)
        || transitionPrewarm && semanticPresentation.weights[tierId] > 0.001;
      setTierOpacity(record, semanticPresentation.weights[tierId] * transitionOpacity,
        { prewarm: tierPrewarm });
    }
    setGrandeurPresentation();
    invalidate();
    return transitionOpacity;
  };

  const getNavigationPlaces = (context = {}) => {
    const options = typeof context === "string" ? { tierId: context } : context || {};
    const tierId = options.tierId || options.tier || null;
    const activeOnly = Boolean(options.activeOnly);
    return Object.freeze(CELESTIAL_COSMOLOGY_NAVIGATION_CATALOG.filter((place) => (
      (!tierId || place.tierId === tierId)
      && (!activeOnly || semanticPresentation.weights[place.tierId] > 0.001)
    )));
  };

  const getNavigationTarget = (id) => {
    const requestedId = String(id || "");
    return navigationTargets.get(NAVIGATION_ALIASES.get(requestedId) || requestedId) || null;
  };

  const setSelectedPlace = (id = null) => {
    const place = getNavigationTarget(id);
    selectionRoot.removeFromParent();
    if (!place) {
      selectedPlaceId = null;
      selectionRoot.visible = false;
      invalidate();
      return null;
    }
    place.anchor.add(selectionRoot);
    selectionRoot.position.set(0, 0, 0);
    selectionRoot.scale.setScalar(clamp(place.nativeExtent * 1.2, 0.025, 2.5));
    selectionRoot.visible = true;
    selectedPlaceId = place.id;
    invalidate();
    return place;
  };

  setSemanticTier(semanticPresentation);

  return Object.freeze({
    root,
    tierRoots,
    grandeurRoot,
    grandeurVisuals,
    selectionRoot,
    quality: resolvedQuality,
    data,
    get semanticPresentation() { return semanticPresentation; },
    get transitionOpacity() { return transitionOpacity; },
    get selectedPlaceId() { return selectedPlaceId; },
    get disposed() { return disposed; },
    getNavigationPlaces,
    getNavigationTarget,
    setSelectedPlace,
    setSemanticTier,
    setTransitionOpacity,
    setEffectsLevel,
    setRenderContext,
    dispose() {
      if (disposed) return;
      disposed = true;
      selectedPlaceId = null;
      selectionRoot.removeFromParent();
      root.removeFromParent();
      root.clear();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      geometries.clear();
      materials.clear();
      textures.clear();
      materialOpacity.clear();
    }
  });
}
