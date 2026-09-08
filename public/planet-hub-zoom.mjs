export const PLANET_HUB_VIEW_BANDS = Object.freeze([
  "planet",
  "orbit",
  "system",
  "galaxy",
  "universe"
]);

export const PLANET_HUB_DISTANCE_METERS = Object.freeze({
  au: 149597870700,
  lightYear: 9460730472580800
});

export const PLANET_HUB_DISTANCE_STOPS = Object.freeze({
  planet: 12742000,
  orbit: 384400000,
  system: PLANET_HUB_DISTANCE_METERS.au * 2,
  galaxy: PLANET_HUB_DISTANCE_METERS.lightYear * 10,
  // SolarSystemScope's outward journey stops at a complete-Milky-Way view
  // near 203,884 light-years. Matching that physical cap lets a roughly
  // 100,000-light-year disc fit naturally instead of compensating with a
  // second arbitrary visual shrink.
  universe: PLANET_HUB_DISTANCE_METERS.lightYear * 203884
});

// The published 0..1 rail above remains the complete legacy Solar/Milky-Way
// presentation. Deep space is a second logarithmic segment whose zero is the
// existing Universe stop. This keeps every current stop, LOD window, saved
// progress value, and 1.20x wheel pulse bit-for-bit stable while allowing a
// renderer to opt into cosmological navigation after the Milky Way boundary.
export const PLANET_HUB_COSMIC_VIEW_TIERS = Object.freeze([
  "local-group",
  "nearby-groups",
  "supercluster",
  "cosmic-web",
  "observable-universe"
]);

const COSMIC_DISTANCES = [
  PLANET_HUB_DISTANCE_STOPS.universe,
  PLANET_HUB_DISTANCE_METERS.lightYear * 10_000_000,
  PLANET_HUB_DISTANCE_METERS.lightYear * 330_000_000,
  PLANET_HUB_DISTANCE_METERS.lightYear * 1_400_000_000,
  PLANET_HUB_DISTANCE_METERS.lightYear * 10_000_000_000,
  PLANET_HUB_DISTANCE_METERS.lightYear * 46_500_000_000
];

export const PLANET_HUB_COSMIC_DISTANCE_STOPS = Object.freeze({
  milkyWayBoundary: COSMIC_DISTANCES[0],
  localGroup: COSMIC_DISTANCES[1],
  nearbyGroups: COSMIC_DISTANCES[2],
  supercluster: COSMIC_DISTANCES[3],
  cosmicWeb: COSMIC_DISTANCES[4],
  observableUniverse: COSMIC_DISTANCES[5]
});

export const PLANET_HUB_COSMIC_MILESTONES = Object.freeze([
  Object.freeze({ id: "milky-way-boundary", distanceMeters: PLANET_HUB_COSMIC_DISTANCE_STOPS.milkyWayBoundary }),
  Object.freeze({ id: "local-group", distanceMeters: PLANET_HUB_COSMIC_DISTANCE_STOPS.localGroup }),
  Object.freeze({ id: "nearby-groups", distanceMeters: PLANET_HUB_COSMIC_DISTANCE_STOPS.nearbyGroups }),
  Object.freeze({ id: "supercluster", distanceMeters: PLANET_HUB_COSMIC_DISTANCE_STOPS.supercluster }),
  Object.freeze({ id: "cosmic-web", distanceMeters: PLANET_HUB_COSMIC_DISTANCE_STOPS.cosmicWeb }),
  Object.freeze({ id: "observable-universe", distanceMeters: PLANET_HUB_COSMIC_DISTANCE_STOPS.observableUniverse })
]);

const PLANET_HUB_DISTANCE_LOG_RANGE = Math.log(
  PLANET_HUB_DISTANCE_STOPS.universe / PLANET_HUB_DISTANCE_STOPS.planet
);

export const PLANET_HUB_STANDARD_WHEEL_MULTIPLIER = 1.2;

const PLANET_HUB_COSMIC_DISTANCE_LOG_RANGE = Math.log(
  COSMIC_DISTANCES[5] / COSMIC_DISTANCES[0]
);

export const PLANET_HUB_COSMIC_EXTENSION_WHEEL_PULSES =
  PLANET_HUB_COSMIC_DISTANCE_LOG_RANGE / Math.log(PLANET_HUB_STANDARD_WHEEL_MULTIPLIER);

export const PLANET_HUB_COSMIC_ZOOM_DEFAULTS = Object.freeze({
  wheelSensitivity: Math.log(PLANET_HUB_STANDARD_WHEEL_MULTIPLIER)
    / PLANET_HUB_COSMIC_DISTANCE_LOG_RANGE / 100,
  wheelMaximumStep: 0.032,
  rebasePulseStride: 8
});

export const PLANET_HUB_ZOOM_ANCHOR_FACTORS = Object.freeze({
  planet: 1,
  orbit: 3,
  system: 12,
  galaxy: 36,
  universe: 72
});

export const PLANET_HUB_ZOOM_ANCHOR_PROGRESS = Object.freeze({
  planet: 0,
  orbit: Math.log(PLANET_HUB_DISTANCE_STOPS.orbit / PLANET_HUB_DISTANCE_STOPS.planet)
    / PLANET_HUB_DISTANCE_LOG_RANGE,
  system: Math.log(PLANET_HUB_DISTANCE_STOPS.system / PLANET_HUB_DISTANCE_STOPS.planet)
    / PLANET_HUB_DISTANCE_LOG_RANGE,
  galaxy: Math.log(PLANET_HUB_DISTANCE_STOPS.galaxy / PLANET_HUB_DISTANCE_STOPS.planet)
    / PLANET_HUB_DISTANCE_LOG_RANGE,
  universe: 1
});

export const PLANET_HUB_ZOOM_DEFAULTS = Object.freeze({
  verticalFovDegrees: 28,
  minimumMaximumFactor: PLANET_HUB_ZOOM_ANCHOR_FACTORS.universe,
  fitMargin: 1.08,
  wheelSensitivity: Math.log(PLANET_HUB_STANDARD_WHEEL_MULTIPLIER)
    / PLANET_HUB_DISTANCE_LOG_RANGE / 100,
  wheelMaximumStep: 0.032,
  springResponse: 12,
  rebasePulseStride: 8
});

const clamp = (value, minimum = 0, maximum = 1) => Math.max(
  minimum,
  Math.min(maximum, Number(value) || 0)
);

const finitePositive = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const vectorLength = (value = []) => Math.hypot(
  Number(value?.[0]) || 0,
  Number(value?.[1]) || 0,
  Number(value?.[2]) || 0
);

const vector3 = (value = [], fallback = [0, 0, 0]) => [0, 1, 2].map((index) => {
  const coordinate = Number(value?.[index]);
  return Number.isFinite(coordinate) ? coordinate : Number(fallback?.[index]) || 0;
});

const mixVector3 = (from, to, amount) => {
  const start = vector3(from);
  const end = vector3(to, start);
  const progress = clamp(amount);
  return start.map((coordinate, index) => coordinate + (end[index] - coordinate) * progress);
};

const smoothMixVector3 = (from, to, amount) => {
  const progress = clamp(amount);
  return mixVector3(from, to, progress * progress * (3 - 2 * progress));
};

export function clampPlanetHubZoomProgress(value = 0) {
  return clamp(value, 0, 1);
}

export const clampPlanetHubCosmicZoomProgress = clampPlanetHubZoomProgress;

const resolveDistanceBounds = (bounds = {}) => {
  const minDistanceMeters = finitePositive(bounds?.minDistanceMeters,
    PLANET_HUB_DISTANCE_STOPS.planet);
  const maxDistanceMeters = Math.max(minDistanceMeters, finitePositive(bounds?.maxDistanceMeters,
    PLANET_HUB_DISTANCE_STOPS.universe));
  return { minDistanceMeters, maxDistanceMeters,
    distanceLogRange: Math.log(maxDistanceMeters / minDistanceMeters) };
};

export function planetHubZoomProgressToDistance(progress = 0, bounds = {}) {
  const { minDistanceMeters, distanceLogRange } = resolveDistanceBounds(bounds);
  return minDistanceMeters * Math.exp(clampPlanetHubZoomProgress(progress) * distanceLogRange);
}

export function planetHubZoomDistanceToProgress(distanceMeters = 0, bounds = {}) {
  const { minDistanceMeters, maxDistanceMeters, distanceLogRange } = resolveDistanceBounds(bounds);
  if (!(distanceLogRange > 0)) return 0;
  return clampPlanetHubZoomProgress(Math.log(
    clamp(finitePositive(distanceMeters, minDistanceMeters), minDistanceMeters, maxDistanceMeters)
    / minDistanceMeters
  ) / distanceLogRange);
}

const COSMIC_DISTANCE_BOUNDS = Object.freeze({
  minDistanceMeters: COSMIC_DISTANCES[0],
  maxDistanceMeters: COSMIC_DISTANCES[5]
});

export function planetHubCosmicZoomProgressToDistance(progress = 0) {
  return planetHubZoomProgressToDistance(progress, COSMIC_DISTANCE_BOUNDS);
}

export function planetHubCosmicZoomDistanceToProgress(distanceMeters = 0) {
  return planetHubZoomDistanceToProgress(distanceMeters, COSMIC_DISTANCE_BOUNDS);
}

export function classifyPlanetHubCosmicViewTier({ progress = 0, distanceMeters = null } = {}) {
  const numericDistance = Number(distanceMeters);
  const distance = distanceMeters != null && Number.isFinite(numericDistance)
    ? numericDistance
    : planetHubCosmicZoomProgressToDistance(progress);
  if (distance <= COSMIC_DISTANCES[1]) return "local-group";
  if (distance <= COSMIC_DISTANCES[2]) return "nearby-groups";
  if (distance <= COSMIC_DISTANCES[3]) return "supercluster";
  if (distance <= COSMIC_DISTANCES[4]) return "cosmic-web";
  return "observable-universe";
}

export function resolvePlanetHubCosmicRepresentedDistance(progress = 0) {
  return resolvePlanetHubRepresentedDistance(progress, COSMIC_DISTANCE_BOUNDS);
}

/**
 * Maps the enormous represented distance onto a small, precision-safe render
 * cell. Divide physical positions and radii by metersPerUnit, then use
 * localDollyFactor for the camera radius. Both values rebase together every
 * few wheel pulses, preserving the projection while coordinates stay small.
 */
export function resolvePlanetHubRepresentedDistance(progress = 0, bounds = {}) {
  const amount = clampPlanetHubZoomProgress(progress);
  const distance = resolveDistanceBounds(bounds);
  const logDistanceMeters = Math.log(distance.minDistanceMeters)
    + amount * distance.distanceLogRange;
  const wheelLog = Math.log(PLANET_HUB_STANDARD_WHEEL_MULTIPLIER);
  const wheelPulses = (logDistanceMeters - Math.log(distance.minDistanceMeters)) / wheelLog;
  const stride = Math.max(1, Math.round(finitePositive(bounds?.rebasePulseStride,
    PLANET_HUB_ZOOM_DEFAULTS.rebasePulseStride)));
  const rebaseIndex = Math.floor((wheelPulses + 1e-10) / stride);
  const rebasePulses = rebaseIndex * stride;
  return Object.freeze({
    progress: amount,
    distanceMeters: Math.exp(logDistanceMeters),
    logDistanceMeters,
    wheelPulses,
    rebaseIndex,
    metersPerUnit: distance.minDistanceMeters * Math.exp(rebasePulses * wheelLog),
    localDollyFactor: Math.exp((wheelPulses - rebasePulses) * wheelLog)
  });
}

/**
 * Resolves the semantic centre of the continuous astronomical zoom.
 *
 * An explicit celestial subject owns every zoom level. Without one, close
 * views reacquire Earth and the camera hands off once, at the Orbit/System
 * boundary, to the immutable atlas Sun. Keeping the handoff narrow prevents
 * an entire published band from orbiting an empty point between both bodies.
 */
export function calculatePlanetHubSemanticCameraTarget({
  progress = 0,
  worldPosition = [0, 0, 0],
  earthPosition = worldPosition,
  sunPosition = earthPosition,
  galacticCenterPosition: _galacticCenterPosition = sunPosition,
  selectedBodyPosition = null
} = {}) {
  const amount = clampPlanetHubZoomProgress(progress);
  const earth = vector3(earthPosition, vector3(worldPosition));
  if (selectedBodyPosition != null) {
    return Object.freeze(vector3(selectedBodyPosition, earth));
  }
  const sun = vector3(sunPosition, earth);
  const handoff = (PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit
    + PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system) * 0.5;
  if (amount <= handoff) return Object.freeze(earth);
  if (amount < PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system) {
    return Object.freeze(smoothMixVector3(earth, sun, (amount - handoff)
      / (PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system - handoff)));
  }
  return Object.freeze(sun);
}

export function calculatePlanetHubHorizontalFov({
  verticalFovDegrees = PLANET_HUB_ZOOM_DEFAULTS.verticalFovDegrees,
  aspect = 1
} = {}) {
  const verticalRadians = finitePositive(verticalFovDegrees, 28) * Math.PI / 180;
  const safeAspect = finitePositive(aspect, 1);
  return 2 * Math.atan(Math.tan(verticalRadians * 0.5) * safeAspect);
}

export function calculatePlanetHubCelestialExtent({
  moonOrbitRadius = 2.7,
  moonRadius = 0.273,
  sunPosition = [-2.35, 1.55, -8.8],
  sunScale = 0.22,
  sunVisualRadius = 1.42
} = {}) {
  const moonExtent = Math.max(0, Number(moonOrbitRadius) || 0)
    + Math.max(0, Number(moonRadius) || 0);
  const sunExtent = vectorLength(sunPosition)
    + Math.max(0, Number(sunScale) || 0) * Math.max(0, Number(sunVisualRadius) || 0);
  return Math.max(1, moonExtent, sunExtent);
}

export function calculatePlanetHubZoomBounds({
  baseRadius = 4.5,
  verticalFovDegrees = PLANET_HUB_ZOOM_DEFAULTS.verticalFovDegrees,
  aspect = 1,
  celestialExtent = calculatePlanetHubCelestialExtent(),
  fitExtent = null,
  minimumMaximumFactor = PLANET_HUB_ZOOM_DEFAULTS.minimumMaximumFactor,
  fitMargin = PLANET_HUB_ZOOM_DEFAULTS.fitMargin,
  minDistanceMeters = PLANET_HUB_DISTANCE_STOPS.planet,
  maxDistanceMeters = PLANET_HUB_DISTANCE_STOPS.universe
} = {}) {
  const minRadius = finitePositive(baseRadius, 4.5);
  const safeAspect = finitePositive(aspect, 1);
  const verticalFovRadians = finitePositive(verticalFovDegrees, 28) * Math.PI / 180;
  const horizontalFovRadians = calculatePlanetHubHorizontalFov({
    verticalFovDegrees,
    aspect: safeAspect
  });
  const limitingHalfFovRadians = Math.max(
    1 * Math.PI / 180,
    Math.min(verticalFovRadians, horizontalFovRadians) * 0.5
  );
  const extent = finitePositive(celestialExtent, calculatePlanetHubCelestialExtent());
  // Camera distance is logarithmic and may cross from a body-local view into
  // the complete astronomical chart. Presentation bands only decide which
  // guides are legible; they never cap the physical navigation range.
  const requiredFitExtent = finitePositive(fitExtent, 0);
  const margin = finitePositive(fitMargin, PLANET_HUB_ZOOM_DEFAULTS.fitMargin);
  const maximumFactor = PLANET_HUB_ZOOM_ANCHOR_FACTORS.universe;
  const requestedFactor = Math.min(maximumFactor, Math.max(
    1.01,
    finitePositive(minimumMaximumFactor, PLANET_HUB_ZOOM_DEFAULTS.minimumMaximumFactor)
  ));
  const fittedRadius = requiredFitExtent > 0
    ? requiredFitExtent / Math.tan(limitingHalfFovRadians) * margin
    : 0;
  const maxRadius = Math.min(
    minRadius * maximumFactor,
    Math.max(minRadius * requestedFactor, fittedRadius, minRadius + 0.01)
  );
  const maxFactor = maxRadius / minRadius;
  const distance = resolveDistanceBounds({ minDistanceMeters, maxDistanceMeters });
  return Object.freeze({
    minRadius,
    maxRadius,
    maxFactor,
    logRange: Math.log(maxFactor),
    ...distance,
    celestialExtent: extent,
    fitExtent: requiredFitExtent,
    maximumFactor,
    verticalFovRadians,
    horizontalFovRadians,
    limitingHalfFovRadians
  });
}

export function planetHubZoomProgressToRadius(progress = 0, bounds = {}) {
  const minRadius = finitePositive(bounds?.minRadius, 4.5);
  const maxRadius = Math.max(minRadius, finitePositive(bounds?.maxRadius, minRadius));
  if (maxRadius <= minRadius) return minRadius;
  return minRadius * Math.exp(clampPlanetHubZoomProgress(progress) * Math.log(maxRadius / minRadius));
}

export function planetHubZoomRadiusToProgress(radius = 0, bounds = {}) {
  const minRadius = finitePositive(bounds?.minRadius, 4.5);
  const maxRadius = Math.max(minRadius, finitePositive(bounds?.maxRadius, minRadius));
  if (maxRadius <= minRadius) return 0;
  const safeRadius = clamp(finitePositive(radius, minRadius), minRadius, maxRadius);
  return clampPlanetHubZoomProgress(Math.log(safeRadius / minRadius) / Math.log(maxRadius / minRadius));
}

export function classifyPlanetHubViewBand({
  progress = 0,
  radius = null,
  bounds = null
} = {}) {
  const zoomBounds = bounds || calculatePlanetHubZoomBounds();
  const numericRadius = Number(radius);
  const amount = radius != null && Number.isFinite(numericRadius)
    ? planetHubZoomRadiusToProgress(numericRadius, zoomBounds)
    : clampPlanetHubZoomProgress(progress);
  for (let index = 1; index < PLANET_HUB_VIEW_BANDS.length; index += 1) {
    const boundary = (PLANET_HUB_ZOOM_ANCHOR_PROGRESS[PLANET_HUB_VIEW_BANDS[index - 1]]
      + PLANET_HUB_ZOOM_ANCHOR_PROGRESS[PLANET_HUB_VIEW_BANDS[index]]) * 0.5;
    if (amount < boundary) return PLANET_HUB_VIEW_BANDS[index - 1];
  }
  return "universe";
}

/**
 * Stabilizes the published semantic label while the continuous camera passes
 * a tier boundary. The physical zoom never snaps: only the UI/LOD name waits
 * for a small, symmetric dead band before changing. Deliberate travel can
 * still cross several bands when restoring a saved view.
 */
export function stabilizePlanetHubViewBand({
  progress = 0,
  previousBand = "planet"
} = {}) {
  const amount = clampPlanetHubZoomProgress(progress);
  const candidate = classifyPlanetHubViewBand({ progress: amount });
  let stableIndex = PLANET_HUB_VIEW_BANDS.indexOf(previousBand);
  const candidateIndex = PLANET_HUB_VIEW_BANDS.indexOf(candidate);
  if (stableIndex < 0 || stableIndex === candidateIndex) return candidate;
  const boundary = (index) => (
    PLANET_HUB_ZOOM_ANCHOR_PROGRESS[PLANET_HUB_VIEW_BANDS[index]]
    + PLANET_HUB_ZOOM_ANCHOR_PROGRESS[PLANET_HUB_VIEW_BANDS[index + 1]]
  ) * 0.5;
  if (candidateIndex > stableIndex) {
    while (stableIndex < candidateIndex
      && amount >= boundary(stableIndex) + 0.012) stableIndex += 1;
  } else {
    while (stableIndex > candidateIndex
      && amount <= boundary(stableIndex - 1) - 0.012) stableIndex -= 1;
  }
  return PLANET_HUB_VIEW_BANDS[stableIndex];
}

export function normalizePlanetHubWheelDelta({
  deltaY = 0,
  deltaMode = 0,
  lineHeight = 16,
  viewportHeight = 720,
  maximumPixels = 320
} = {}) {
  const raw = Number(deltaY);
  if (!Number.isFinite(raw) || raw === 0) return 0;
  const mode = Number(deltaMode) || 0;
  const multiplier = mode === 1
    ? finitePositive(lineHeight, 16)
    : mode === 2
      ? finitePositive(viewportHeight, 720)
      : 1;
  const pixels = raw * multiplier;
  const limit = finitePositive(maximumPixels, 320);
  return Math.max(-limit, Math.min(limit, pixels));
}

export function calculatePlanetHubWheelZoom({
  progress = 0,
  deltaY = 0,
  deltaMode = 0,
  lineHeight = 16,
  viewportHeight = 720,
  sensitivity = PLANET_HUB_ZOOM_DEFAULTS.wheelSensitivity,
  maximumStep = PLANET_HUB_ZOOM_DEFAULTS.wheelMaximumStep
} = {}) {
  const from = clampPlanetHubZoomProgress(progress);
  const pixels = normalizePlanetHubWheelDelta({ deltaY, deltaMode, lineHeight, viewportHeight });
  const stepLimit = finitePositive(maximumStep, PLANET_HUB_ZOOM_DEFAULTS.wheelMaximumStep);
  const step = Math.max(-stepLimit, Math.min(
    stepLimit,
    pixels * finitePositive(sensitivity, PLANET_HUB_ZOOM_DEFAULTS.wheelSensitivity)
  ));
  const target = clampPlanetHubZoomProgress(from + step);
  return Object.freeze({
    progress: target,
    previousProgress: from,
    pixels,
    step: target - from,
    direction: Math.sign(pixels),
    changed: Math.abs(target - from) > 1e-9
  });
}

export function calculatePlanetHubCosmicWheelZoom(options = {}) {
  const result = calculatePlanetHubWheelZoom({
    ...options,
    sensitivity: finitePositive(options?.sensitivity, PLANET_HUB_COSMIC_ZOOM_DEFAULTS.wheelSensitivity),
    maximumStep: finitePositive(options?.maximumStep, PLANET_HUB_COSMIC_ZOOM_DEFAULTS.wheelMaximumStep)
  });
  return Object.freeze({
    ...result,
    segment: "cosmic",
    tier: classifyPlanetHubCosmicViewTier({ progress: result.progress })
  });
}

export function calculatePlanetHubPinchZoom({
  startProgress = 0,
  startSpan = 0,
  currentSpan = 0,
  bounds = calculatePlanetHubZoomBounds(),
  sensitivity = 1
} = {}) {
  const from = clampPlanetHubZoomProgress(startProgress);
  const initial = finitePositive(startSpan, 0);
  const current = finitePositive(currentSpan, 0);
  const logRange = finitePositive(bounds?.distanceLogRange, PLANET_HUB_DISTANCE_LOG_RANGE);
  if (!(initial > 0) || !(current > 0)) {
    return Object.freeze({ progress: from, previousProgress: from, step: 0, changed: false });
  }
  // Spreading two fingers zooms inward; pinching them together zooms outward.
  const step = -Math.log(current / initial) / logRange * finitePositive(sensitivity, 1);
  const target = clampPlanetHubZoomProgress(from + step);
  return Object.freeze({
    progress: target,
    previousProgress: from,
    step: target - from,
    changed: Math.abs(target - from) > 1e-9
  });
}

export function stepPlanetHubZoomSpring({
  progress = 0,
  targetProgress = progress,
  velocity = 0,
  deltaSeconds = 0,
  response = PLANET_HUB_ZOOM_DEFAULTS.springResponse,
  maximumSpeed = 0.42,
  reducedMotion = false,
  positionEpsilon = 0.0001,
  velocityEpsilon = 0.0005
} = {}) {
  const current = clampPlanetHubZoomProgress(progress);
  const target = clampPlanetHubZoomProgress(targetProgress);
  if (reducedMotion) {
    return Object.freeze({ progress: target, velocity: 0, moving: false, settled: true });
  }
  // A delayed RAF must not turn elapsed wall time into a visible astronomical
  // distance jump. Cap each presented integration step at one display frame;
  // subsequent frames keep converging toward the unchanged physical target.
  const dt = clamp(deltaSeconds, 0, 1 / 60);
  const omega = finitePositive(response, PLANET_HUB_ZOOM_DEFAULTS.springResponse);
  let currentVelocity = Number.isFinite(Number(velocity)) ? Number(velocity) : 0;
  if ((target - current) * currentVelocity < 0) currentVelocity = 0;
  if (dt <= 0) {
    const settled = Math.abs(target - current) <= positionEpsilon
      && Math.abs(currentVelocity) <= velocityEpsilon;
    return Object.freeze({ progress: settled ? target : current, velocity: settled ? 0 : currentVelocity, moving: !settled, settled });
  }
  let displacement = current - target;
  // Critical damping alone reaches a far target in almost the same perceived
  // time as a short correction. Limit the displacement owned by one damping
  // horizon (the same approach as a cinematic SmoothDamp camera) so named
  // rail jumps visibly traverse every intermediate distance while small
  // wheel/trackpad corrections remain immediate and precise.
  const maxSpeed = finitePositive(maximumSpeed, 0.42);
  const dampingHorizon = 2 / omega;
  const maxDisplacement = maxSpeed * dampingHorizon;
  displacement = Math.max(-maxDisplacement, Math.min(maxDisplacement, displacement));
  const adjustedTarget = current - displacement;
  const exponential = Math.exp(-omega * dt);
  const helper = currentVelocity + omega * displacement;
  let nextDisplacement = (displacement + helper * dt) * exponential;
  let nextVelocity = (currentVelocity - omega * helper * dt) * exponential;
  let nextProgress = adjustedTarget + nextDisplacement;
  // Critical damping is monotonic from rest, but input can retarget while a
  // previous spring velocity is active. Do not allow that inherited velocity
  // to carry the camera through the new target.
  if ((target - current) * (target - nextProgress) < 0) {
    nextProgress = target;
    nextVelocity = 0;
    nextDisplacement = 0;
  }
  const clampedProgress = clampPlanetHubZoomProgress(nextProgress);
  if (clampedProgress !== nextProgress) nextVelocity = 0;
  const settled = Math.abs(target - clampedProgress) <= Math.max(0, Number(positionEpsilon) || 0)
    && Math.abs(nextVelocity) <= Math.max(0, Number(velocityEpsilon) || 0);
  return Object.freeze({
    progress: settled ? target : clampedProgress,
    velocity: settled ? 0 : nextVelocity,
    moving: !settled,
    settled
  });
}

export function isPlanetHubZoomBlockedTarget(target, stage = null) {
  if (!target || target === stage || String(target.tagName || "").toUpperCase() === "CANVAS") return false;
  const selector = [
    "button",
    "a",
    "input",
    "select",
    "textarea",
    "summary",
    "[role='button']",
    "[contenteditable='true']",
    "[data-planet-hub-ignore-gesture]",
    "[data-planet-hub-ignore-zoom]"
  ].join(",");
  try {
    if (target.closest?.(selector)) return true;
  } catch { /* A non-DOM test double can still use the size checks below. */ }
  let element = target;
  while (element && element !== stage) {
    const horizontalOverflow = Number(element.scrollWidth) > Number(element.clientWidth) + 1;
    const verticalOverflow = Number(element.scrollHeight) > Number(element.clientHeight) + 1;
    if (horizontalOverflow || verticalOverflow) return true;
    element = element.parentElement || null;
  }
  return false;
}

export function resolvePlanetHubZoomOwnership({
  renderer = "webgl",
  mode = "overview",
  phase = "ready",
  cameraOwner = "home-orbit",
  input = "wheel",
  direction = 0,
  interactiveTarget = false,
  scrollableTarget = false,
  atMinimum = false,
  atMaximum = false
} = {}) {
  const blocked = (reason) => Object.freeze({ accepted: false, consume: false, action: "none", reason });
  const normalizedInput = ["wheel", "pinch", "api"].includes(input) ? input : "api";
  const zoomDirection = Math.sign(Number(direction) || 0);
  if (renderer !== "webgl") return blocked("renderer-unavailable");
  if (interactiveTarget || scrollableTarget) return blocked("interactive-target");
  if (!zoomDirection && normalizedInput !== "api") return blocked("no-delta");
  if (["journey-flight", "journey-flight-held"].includes(cameraOwner)) {
    return blocked("camera-owned");
  }
  const bodyInspection = ["moon-focus", "celestial-body-focus"].includes(cameraOwner)
    && mode === "overview";
  if (mode === "focused") {
    if (zoomDirection > 0) {
      return Object.freeze({ accepted: true, consume: true, action: "exit-focus", reason: "focus-exit" });
    }
    return blocked("focused-minimum");
  }
  if (!bodyInspection && (mode !== "overview" || cameraOwner !== "home-orbit")) return blocked("presentation-owned");
  if (!["ready", "preview", "transitioning"].includes(phase)) return blocked("phase-unavailable");
  if ((zoomDirection < 0 && atMinimum) || (zoomDirection > 0 && atMaximum)) return blocked("zoom-boundary");
  return Object.freeze({
    accepted: true,
    consume: true,
    action: phase === "transitioning" ? "retarget" : "zoom",
    reason: normalizedInput
  });
}

export function resolvePlanetHubZoomInteractionRules({
  renderer = "webgl",
  mode = "overview",
  phase = "ready",
  cameraOwner = "home-orbit",
  band = "planet"
} = {}) {
  const normalizedBand = PLANET_HUB_VIEW_BANDS.includes(band) ? band : "planet";
  const overviewOwned = renderer === "webgl" && mode === "overview" && cameraOwner === "home-orbit";
  const bodyOwned = renderer === "webgl" && mode === "overview"
    && ["moon-focus", "celestial-body-focus"].includes(cameraOwner);
  const cameraInteractive = overviewOwned || bodyOwned;
  const directlyInteractive = cameraInteractive && ["ready", "preview"].includes(phase);
  return Object.freeze({
    zoomEnabled: cameraInteractive && ["ready", "preview", "transitioning"].includes(phase),
    directDragOrbit: directlyInteractive,
    passiveHoverOrbit: false,
    landmarkPicking: directlyInteractive && normalizedBand === "planet",
    landmarkFocus: directlyInteractive && normalizedBand === "planet",
    autoCenterDestination: directlyInteractive && normalizedBand === "planet",
    satellitePicking: directlyInteractive && ["planet", "orbit"].includes(normalizedBand),
    celestialBodyPicking: directlyInteractive
  });
}
