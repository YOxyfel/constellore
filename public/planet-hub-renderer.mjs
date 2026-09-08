import {
  PLANET_HUB_DESTINATIONS,
  assetUrl,
  capPlanetHubPixelRatio,
  createDestinationAnchors,
  createGreatCircleRoads,
  destinationFacingQuaternion,
  destinationQuaternion,
  normalizePlanetHubDestination,
  resolvePlanetHubAsset
} from "./planet-hub-domain.mjs?v=5.0.0-beta.4";
import {
  PLANET_HUB_DISTANCE_METERS,
  PLANET_HUB_DISTANCE_STOPS,
  PLANET_HUB_ZOOM_ANCHOR_PROGRESS,
  calculatePlanetHubCelestialExtent,
  calculatePlanetHubSemanticCameraTarget,
  calculatePlanetHubZoomBounds,
  classifyPlanetHubViewBand,
  classifyPlanetHubCosmicViewTier,
  clampPlanetHubCosmicZoomProgress,
  clampPlanetHubZoomProgress,
  planetHubCosmicZoomDistanceToProgress,
  planetHubZoomDistanceToProgress,
  resolvePlanetHubCosmicRepresentedDistance,
  resolvePlanetHubRepresentedDistance,
  resolvePlanetHubZoomInteractionRules,
  stepPlanetHubZoomSpring
} from "./planet-hub-zoom.mjs?v=5.0.0-beta.4";
import {
  calculatePlanetHubRoadMood,
  calculatePlanetHubSunDiscVisibility,
  calculatePlanetHubSunLightingRig,
  createPlanetHubRoadMaterial,
  resolvePlanetHubDestinationMood,
  resolvePlanetHubHeroFraming,
  resolvePlanetHubMoodEffects,
  resolvePlanetHubSurfaceHooks,
  retargetPlanetHubMoodTransition,
  samplePlanetHubMoodTransition,
  updatePlanetHubRoadMaterial
} from "./planet-hub-moods.mjs?v=5.0.0-beta.4";

// Resolve Three through the document import map. A relative dynamic-import
// specifier is resolved against this module, while the import-map target is
// resolved against the document. Those bases differ on the local `/play/`
// fallback route and would instantiate two copies of Three under distinct
// absolute URLs. The bare key keeps one module identity locally and in the
// directory-relative Pages/itch builds.
export const DEFAULT_PLANET_HUB_THREE_SPECIFIER = "three";
export const DEFAULT_PLANET_HUB_GLTF_LOADER_URL = "./vendor/three/GLTFLoader.js?v=5.0.0-beta.4";
export const PLANET_HUB_IDLE_YAW_SPEED = 0.04;
export const PLANET_HUB_IDLE_RESUME_DELAY_MS = 480;
export const PLANET_HUB_IDLE_SETTLED_SPEED = 0.012;
export const PLANET_HUB_COAST_MIN_MS = 1200;
export const PLANET_HUB_COAST_MAX_MS = 6000;
export const PLANET_HUB_THROW_MAX_MULTIPLIER = 5;
export const PLANET_HUB_THROW_MAX_ANGULAR_SPEED = 17;
export const PLANET_HUB_AMBIENT_FRAME_RATE = 30;
export const PLANET_HUB_AMBIENT_FRAME_INTERVAL_MS = 1000 / PLANET_HUB_AMBIENT_FRAME_RATE;
// Journey travel is authored as a readable sequence rather than one elastic
// curve. The first two seconds belong to the launch pad, the middle of the shot
// contains one restrained hero arc and a calm transfer, and the final two
// seconds are a locked landing composition.
export const PLANET_HUB_JOURNEY_BASE_DURATION_MS = 3600;
export const PLANET_HUB_JOURNEY_IGNITION_MS = 450;
export const PLANET_HUB_JOURNEY_DURATION_MS = 8600;
export const PLANET_HUB_JOURNEY_LAUNCH_LIFT_MS = 2000;
export const PLANET_HUB_JOURNEY_LAUNCH_LIFT_HEIGHT = 0.42;
export const PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS = 2600;
export const PLANET_HUB_JOURNEY_OUTBOUND_ORBIT_END_MS = 3900;
export const PLANET_HUB_JOURNEY_RETURN_TRANSFER_END_MS = 4700;
export const PLANET_HUB_JOURNEY_APPROACH_START_MS = 5600;
export const PLANET_HUB_JOURNEY_LANDING_START_MS = 6600;
export const PLANET_HUB_JOURNEY_ROUTE_STRETCH = 1.18;
export const PLANET_HUB_JOURNEY_HERO_ARC_RADIANS = Math.PI * (100 / 180);
export const PLANET_HUB_JOURNEY_VEHICLE_RADIUS_RATIO = 0.16;
export const PLANET_HUB_JOURNEY_BODY_CLEARANCE = 0.004;
export const PLANET_HUB_JOURNEY_PRE_ORBIT_SHARE = (
  PLANET_HUB_JOURNEY_OUTBOUND_ORBIT_END_MS - PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS
) / PLANET_HUB_JOURNEY_DURATION_MS;
export const PLANET_HUB_JOURNEY_PRE_ORBIT_RADIANS = PLANET_HUB_JOURNEY_HERO_ARC_RADIANS;
export const PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS = 2000;
export const PLANET_HUB_JOURNEY_RETURN_CRANE_END_MS = 2650;
export const PLANET_HUB_JOURNEY_RETURN_HANDOFF_END_MS = 4400;
export const PLANET_HUB_JOURNEY_LANDING_CAMERA_START_MS = PLANET_HUB_JOURNEY_APPROACH_START_MS;
export const PLANET_HUB_JOURNEY_LANDING_CAMERA_BLEND_MS = (
  PLANET_HUB_JOURNEY_LANDING_START_MS - PLANET_HUB_JOURNEY_APPROACH_START_MS
);
export const PLANET_HUB_JOURNEY_LANDING_STATIC_MS = 2000;
// Preserve the Moon's recognizable physical size while compressing the real
// 60.3-Earth-radius distance into a readable Home-screen orbit. Six minutes is
// slow enough to feel celestial instead of mechanical, but still moves during
// a normal hub visit.
export const PLANET_HUB_MOON_RADIUS_RATIO = 0.273;
export const PLANET_HUB_MOON_ORBIT_RADIUS = 2.7;
export const PLANET_HUB_MOON_ORBIT_PERIOD_MS = 360000;
export const PLANET_HUB_SUN_PLACEMENT = Object.freeze({
  // Earth-relative atlas position at the shipped epoch. Keeping the fallback
  // on this exact ray prevents the optional atlas handoff from flipping the
  // terminator or throwing the glare across the screen.
  position: Object.freeze([-2.002874, 0, 11.41766]),
  scale: 0.72
});

export const PLANET_HUB_SUN_HANDOFF_PIXELS = Object.freeze({
  particleOnly: 0.55,
  modelOnly: 1.75
});

const smoothUnit = (value) => {
  const amount = Math.max(0, Math.min(1, Number(value) || 0));
  return amount * amount * (3 - 2 * amount);
};

export function calculatePlanetHubProxyHandoff({
  blend = 0,
  authoredRadius = 1,
  proxyRadius = 1
} = {}) {
  const amount = Math.max(0, Math.min(1, Number(blend) || 0));
  const closeRadius = Math.max(1e-9, Number(authoredRadius) || 1);
  const physicalRadius = Math.max(1e-9, Number(proxyRadius) || 1);
  return Object.freeze({
    authoredOpacity: 1 - amount,
    proxyOpacity: amount,
    radius: closeRadius + (physicalRadius - closeRadius) * amount
  });
}

/**
 * Return the physical projected diameter of a spherical body without a
 * readability floor.  The perspective expression is exact for the apparent
 * tangent of a sphere and tends to the familiar inverse-distance relation in
 * the astronomical far field.
 */
export function calculatePlanetHubProjectedBodyDiameterPixels({
  physicalWorldRadius = 0,
  cameraDistance = 1,
  verticalFovDegrees = 42,
  viewportHeight = 720
} = {}) {
  const radius = Math.max(0, Number(physicalWorldRadius) || 0);
  const distance = Math.max(0, Number(cameraDistance) || 0);
  if (!(radius > 0) || !(distance > 0)) return 0;
  const fovRadians = Math.max(1e-4, Math.min(Math.PI - 1e-4,
    (Number(verticalFovDegrees) || 42) * Math.PI / 180));
  const focalLengthPixels = Math.max(1, Number(viewportHeight) || 1)
    / (2 * Math.tan(fovRadians * 0.5));
  if (distance <= radius) return focalLengthPixels * 2;
  return 2 * radius * focalLengthPixels
    / Math.sqrt(Math.max(Number.EPSILON, distance * distance - radius * radius));
}

/**
 * Physical solar LOD.  The depth-tested sphere owns large angular sizes, a
 * short sub-pixel crossfade hands ownership to an additive point, and the
 * solid model is completely absent after that handoff.  The result depends
 * only on the current projection, so outward and inward travel are symmetric.
 */
export function resolvePlanetHubSunLod({
  physicalWorldRadius = 0,
  cameraDistance = 1,
  verticalFovDegrees = 42,
  viewportHeight = 720,
  progress = 0
} = {}) {
  const projectedDiameterPixels = calculatePlanetHubProjectedBodyDiameterPixels({
    physicalWorldRadius,
    cameraDistance,
    verticalFovDegrees,
    viewportHeight
  });
  const { particleOnly, modelOnly } = PLANET_HUB_SUN_HANDOFF_PIXELS;
  const modelOpacity = smoothUnit((projectedDiameterPixels - particleOnly)
    / Math.max(Number.EPSILON, modelOnly - particleOnly));
  const particleOpacity = 1 - modelOpacity;
  const optics = resolvePlanetHubSunOptics(progress);
  const glareGate = smoothUnit(projectedDiameterPixels / modelOnly);
  const glareScale = optics.scale;
  const glareOpacity = optics.opacity * glareGate;
  const mode = modelOpacity >= 1 - 1e-9 ? "model"
    : modelOpacity <= 1e-9 ? "particle" : "model-particle";
  return Object.freeze({
    mode,
    projectedDiameterPixels,
    modelOpacity,
    particleOpacity,
    glareScale,
    glareOpacity,
    glareDiameterPixels: projectedDiameterPixels * glareScale
  });
}

export function calculatePlanetHubSunPresentation({
  progress = 0,
  atlasPosition = PLANET_HUB_SUN_PLACEMENT.position,
  chartRadius = 2.6
} = {}) {
  const target = [0, 1, 2].map((axis) => Number(atlasPosition?.[axis]) || 0);
  void progress;
  // Position and physical radius never animate at a semantic boundary.  The
  // camera projection and the explicit model/particle LOD are the only owners
  // of apparent size; this prevents a chart reveal from growing the Sun while
  // the rest of the solar system contracts.
  return {
    position: target,
    radius: Math.max(0, Number(chartRadius) || 0),
    chartBlend: 1
  };
}

/**
 * Compatibility seam for callers that previously requested chart-body pixel
 * enlargement. Solid models now remain at physical scale in every band.
 */
export function calculatePlanetHubChartBodyDisplayScale({
  bodyId = "earth",
  physicalWorldRadius = 0,
  cameraDistance = 1,
  verticalFovDegrees = 42,
  viewportWidth = 1280,
  viewportHeight = 720,
  progress = PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system,
  solarDetailOpacity = 1,
  lockedScale = null,
  reducedMotion = false
} = {}) {
  // Solid celestial models never receive a screen-pixel rescue.  Labels,
  // selection geometry, and explicit additive particles carry interaction and
  // distant readability without falsifying physical radius ratios.
  void bodyId;
  void physicalWorldRadius;
  void cameraDistance;
  void verticalFovDegrees;
  void viewportWidth;
  void viewportHeight;
  void progress;
  void solarDetailOpacity;
  void lockedScale;
  void reducedMotion;
  return 1;
}

export function resolvePlanetHubCinematicLighting({ quality = "low" } = {}) {
  const standard = quality === "standard";
  return Object.freeze({
    exposure: standard ? 0.9 : 0.94,
    hemisphere: standard ? 0.34 : 0.42,
    ambient: standard ? 0.025 : 0.04,
    key: standard ? 2.55 : 2.35,
    fill: standard ? 0.26 : 0.3,
    rim: standard ? 0.5 : 0.46,
    engine: standard ? 2.8 : 2.05
  });
}

const PLANET_HUB_ANGULAR_SCALES = Object.freeze({ planet: 1, orbit: 0.72, system: 0.38, galaxy: 0.2, universe: 0.12 });
const PLANET_HUB_SUN_OPTICS_STOPS = [[0, 1, 1], [PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit, 0.9, 0.86], [PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system, 0.72, 0.68], [PLANET_HUB_ZOOM_ANCHOR_PROGRESS.galaxy, 0.12, 0.18], [1, 0, 0]];

export function resolvePlanetHubSunOptics(progress = 0) {
  const value = Math.max(0, Math.min(1, Number(progress) || 0));
  let index = 1;
  while (index < 4 && value > PLANET_HUB_SUN_OPTICS_STOPS[index][0]) index += 1;
  const from = PLANET_HUB_SUN_OPTICS_STOPS[index - 1];
  const to = PLANET_HUB_SUN_OPTICS_STOPS[index];
  const raw = (value - from[0]) / (to[0] - from[0]);
  const blend = raw * raw * (3 - 2 * raw);
  return {
    scale: from[1] + (to[1] - from[1]) * blend,
    opacity: from[2] + (to[2] - from[2]) * blend
  };
}

export function resolvePlanetHubAngularScale(viewBand = "planet") {
  return PLANET_HUB_ANGULAR_SCALES[viewBand] || 1;
}

export const PLANET_HUB_ANGULAR_SPEED_CAPS = Object.freeze({
  planet: PLANET_HUB_THROW_MAX_ANGULAR_SPEED,
  orbit: 5.2,
  system: 1.6,
  galaxy: 0.8,
  universe: 0.55
});

/** Preserve the apparent direction of a throw while changing scale. */
export function rescalePlanetHubAngularVelocity({
  velocity = null,
  fromBand = "planet",
  toBand = fromBand
} = {}) {
  const yaw = Number(velocity?.yaw) || 0;
  const pitch = Number(velocity?.pitch) || 0;
  const speed = Math.hypot(yaw, pitch);
  if (!(speed > 1e-9)) return Object.freeze({ yaw: 0, pitch: 0 });
  const ratio = resolvePlanetHubAngularScale(toBand) / Math.max(1e-9, resolvePlanetHubAngularScale(fromBand));
  const maximum = PLANET_HUB_ANGULAR_SPEED_CAPS[toBand] || PLANET_HUB_THROW_MAX_ANGULAR_SPEED;
  const nextSpeed = Math.min(maximum, speed * ratio);
  return Object.freeze({
    yaw: yaw / speed * nextSpeed,
    pitch: pitch / speed * nextSpeed
  });
}

export function shouldRenderPlanetHubFrame({
  nowMs = 0,
  lastRenderedAt = 0,
  interactive = false,
  ambientFrameIntervalMs = PLANET_HUB_AMBIENT_FRAME_INTERVAL_MS
} = {}) {
  if (interactive) return true;
  const now = Number(nowMs) || 0;
  const previous = Number(lastRenderedAt) || 0;
  const interval = Math.max(1, Number(ambientFrameIntervalMs) || PLANET_HUB_AMBIENT_FRAME_INTERVAL_MS);
  return previous <= 0 || now - previous >= interval;
}

export function createPlanetHubDiagnostics(canvas, { enabled = false } = {}) {
  const active = enabled === true;
  return Object.freeze({
    enabled: active,
    set(name, value) {
      if (!active || !canvas?.dataset || !name) return false;
      canvas.dataset[name] = String(value);
      return true;
    },
    remove(name) {
      if (!active || !canvas?.dataset || !name) return false;
      delete canvas.dataset[name];
      return true;
    }
  });
}

export function disposePlanetHubWebGLRenderer(renderer) {
  if (!renderer) return false;
  renderer.dispose?.();
  // Explicitly release the GPU context after Three.js has disposed its owned
  // resources. This matters when Home swaps worlds or is repeatedly rebuilt.
  renderer.forceContextLoss?.();
  return true;
}

export function resolvePlanetHubJourneyPresentation({
  direction = "outbound",
  reducedMotion = false
} = {}) {
  const normalizedDirection = direction === "return" ? "return" : "outbound";
  const crossfade = Boolean(reducedMotion);
  return Object.freeze({
    direction: normalizedDirection,
    mode: crossfade ? "crossfade" : "spatial",
    durationMs: crossfade ? 0 : PLANET_HUB_JOURNEY_DURATION_MS,
    ignitionMs: crossfade ? 0 : PLANET_HUB_JOURNEY_IGNITION_MS,
    // A spatial outbound flight deliberately holds its final camera for the
    // black project handoff. Reverse travel and the reduced-motion fallback
    // both finish on the canonical Earth Home camera instead.
    holdCameraForHandoff: normalizedDirection === "outbound" && !crossfade,
    holdRocketForHandoff: normalizedDirection === "outbound"
  });
}

export function calculatePlanetHubCelestialLayout({ aspect = 1 } = {}) {
  const safeAspect = Math.max(0.01, Number(aspect) || 1);
  // Responsive screen-space placement keeps the distant Sun visible without
  // allowing it to crowd the world on narrow phones.
  const compact = Math.max(0, Math.min(1, (0.78 - safeAspect) / 0.28));
  const mix = (wide, narrow) => wide + (narrow - wide) * compact;
  return Object.freeze({
    // Keep the reduced-motion Moon visibly separated from Earth on both wide
    // and narrow stages. The live orbit may still pass behind/offscreen in the
    // ordinary physically continuous loop.
    // Favor the near upper-right quadrant without letting perspective push the
    // Moon beyond the stage edge. The previous .36 wide-screen phase placed
    // the closer satellite outside a 1280x720 viewport even though its orbit
    // radius and physical Earth ratio were correct.
    satellitePhaseOffset: mix(Math.PI * 0.44, Math.PI * 0.48),
    // Unlike the Moon's responsive presentation phase, the Sun is a physical
    // scene object. Keeping one immutable world coordinate makes orbiting and
    // body-centred camera moves reveal genuine parallax instead of a HUD-like
    // light that follows the viewport.
    sunPosition: PLANET_HUB_SUN_PLACEMENT.position,
    sunScale: PLANET_HUB_SUN_PLACEMENT.scale
  });
}

export function calculatePlanetHubCameraDistance({
  baseDistance = 4.5,
  aspect = 1,
  referenceAspect = 1
} = {}) {
  const safeDistance = Math.max(0.01, Number(baseDistance) || 4.5);
  const safeAspect = Math.max(0.01, Number(aspect) || 1);
  const safeReference = Math.max(0.01, Number(referenceAspect) || 1);
  // The authored poster camera is square. Preserve that exact framing at and
  // above its reference aspect, then move the camera back just enough for the
  // same horizontal composition on narrow phones instead of cropping the globe.
  return safeDistance * Math.max(1, safeReference / safeAspect);
}

export function resolvePlanetHubPrecisionFrustum({ localDollyFactor = 1, near = 0.05, far = 448 } = {}) {
  const scale = Math.max(1e-9, Number(localDollyFactor) || 1);
  const nearPlane = Math.max(1e-9, (Number(near) || 0.05) * scale);
  return Object.freeze({ near: nearPlane, far: Math.max(nearPlane * 2, (Number(far) || 448) * scale) });
}

function wrapPlanetHubAngle(value = 0) {
  const angle = Number(value) || 0;
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function normalizePlanetHubOrbitVector(value, fallback = [0, 0, 0]) {
  return [0, 1, 2].map((index) => {
    const coordinate = Number(value?.[index]);
    return Number.isFinite(coordinate) ? coordinate : Number(fallback[index]) || 0;
  });
}

/**
 * A serializable camera-orbit state. Navigation owns this state while the
 * planet and every geographic landmark remain in one stable world frame.
 */
export function createPlanetHubCameraOrbitState({
  position = [0, 0.08, 4.5],
  target = [0, 0, 0],
  up = [0, 1, 0],
  velocity = null,
  minimumRadius = 0.05
} = {}) {
  const lookTarget = normalizePlanetHubOrbitVector(target);
  const cameraPosition = normalizePlanetHubOrbitVector(position, [0, 0.08, 4.5]);
  const offset = cameraPosition.map((coordinate, index) => coordinate - lookTarget[index]);
  const radius = Math.max(Number(minimumRadius) || 0.05, Math.hypot(...offset));
  const polar = Math.acos(Math.max(-1, Math.min(1, offset[1] / radius)));
  const azimuth = Math.atan2(offset[0], offset[2]);
  const outward = offset.map((coordinate) => coordinate / radius);
  const normalizedUp = orthonormalPlanetHubUp(up, outward);
  return Object.freeze({
    target: Object.freeze(lookTarget),
    azimuth,
    polar,
    radius,
    up: Object.freeze(normalizedUp),
    velocity: Object.freeze({
      yaw: Number(velocity?.yaw) || 0,
      pitch: Number(velocity?.pitch) || 0
    })
  });
}

export function calculatePlanetHubCameraOrbitPose(state = {}) {
  const target = normalizePlanetHubOrbitVector(state.target);
  const azimuth = Number(state.azimuth) || 0;
  const polar = Math.max(0.001, Math.min(Math.PI - 0.001,
    Number.isFinite(Number(state.polar)) ? Number(state.polar) : Math.PI * 0.5));
  const radius = Math.max(0.05, Number(state.radius) || 4.5);
  const sinPolar = Math.sin(polar);
  const outward = [
    sinPolar * Math.sin(azimuth),
    Math.cos(polar),
    sinPolar * Math.cos(azimuth)
  ];
  return Object.freeze({
    position: Object.freeze([
      target[0] + radius * outward[0],
      target[1] + radius * outward[1],
      target[2] + radius * outward[2]
    ]),
    target: Object.freeze(target),
    up: Object.freeze(orthonormalPlanetHubUp(state.up, outward)),
    azimuth,
    polar,
    radius
  });
}

export function interpolatePlanetHubCameraOrbitState({
  from = {},
  to = {},
  progress = 0
} = {}) {
  const amount = Math.max(0, Math.min(1, Number(progress) || 0));
  const start = createPlanetHubCameraOrbitState(calculatePlanetHubCameraOrbitPose(from));
  const end = createPlanetHubCameraOrbitState(calculatePlanetHubCameraOrbitPose(to));
  const mix = (left, right) => left + (right - left) * amount;
  const target = start.target.map((coordinate, index) => mix(coordinate, end.target[index]));
  const startPose = calculatePlanetHubCameraOrbitPose(start);
  const endPose = calculatePlanetHubCameraOrbitPose(end);
  const startOutward = normalizedVector3(startPose.position.map((coordinate, index) => (
    coordinate - startPose.target[index]
  )), [0, 0, 1]);
  const endOutward = normalizedVector3(endPose.position.map((coordinate, index) => (
    coordinate - endPose.target[index]
  )), startOutward);
  const outward = slerpPlanetHubUnitVectors(startOutward, endOutward, amount);
  const transportedStartUp = transportPlanetHubTangent(start.up, startOutward, outward);
  const blendedUp = orthonormalPlanetHubUp(
    transportedStartUp.map((coordinate, index) => mix(coordinate, end.up[index])),
    outward
  );
  // Refocusing across astronomical scales must feel like a continuous dolly,
  // not a fast linear lunge followed by a long crawl. Radius is therefore
  // interpolated in logarithmic space while target/orientation remain smooth.
  const radius = Math.exp(mix(Math.log(start.radius), Math.log(end.radius)));
  return createPlanetHubCameraOrbitState({
    position: target.map((coordinate, index) => coordinate + outward[index] * radius),
    target,
    up: blendedUp,
    velocity: {
      yaw: mix(Number(from?.velocity?.yaw) || 0, Number(to?.velocity?.yaw) || 0),
      pitch: mix(Number(from?.velocity?.pitch) || 0, Number(to?.velocity?.pitch) || 0)
    }
  });
}

export function applyPlanetHubVisualRotationToCameraOrbit(state = {}, {
  yaw = 0,
  pitch = 0,
  velocity = state?.velocity
} = {}) {
  const source = createPlanetHubCameraOrbitState(calculatePlanetHubCameraOrbitPose(state));
  const requestedYaw = Number(yaw) || 0;
  const requestedPitch = Number(pitch) || 0;
  const sinPolar = Math.sin(source.polar);
  const outward = [
    sinPolar * Math.sin(source.azimuth),
    Math.cos(source.polar),
    sinPolar * Math.cos(source.azimuth)
  ];
  const forward = outward.map((coordinate) => -coordinate);
  const cameraRight = normalizedVector3(crossPlanetHubVectors(forward, source.up), [1, 0, 0]);
  const screenUp = normalizedVector3(crossPlanetHubVectors(cameraRight, forward), source.up);
  const tangent = [0, 1, 2].map((index) => (
    cameraRight[index] * -requestedYaw
    + screenUp[index] * requestedPitch
  ));
  const tangentLength = Math.hypot(...tangent);
  let nextOutward = outward;
  if (tangentLength > 1e-10) {
    const tangentDirection = tangent.map((coordinate) => coordinate / tangentLength);
    const angle = Math.min(Math.PI - 1e-4, tangentLength);
    nextOutward = normalizedVector3(outward.map((coordinate, index) => (
      coordinate * Math.cos(angle) + tangentDirection[index] * Math.sin(angle)
    )), outward);
  }
  const transportedUp = transportPlanetHubTangent(source.up, outward, nextOutward);
  const nextState = createPlanetHubCameraOrbitState({
    position: source.target.map((coordinate, index) => coordinate + nextOutward[index] * source.radius),
    target: source.target,
    up: transportedUp,
    velocity: {
      yaw: Number(velocity?.yaw) || 0,
      pitch: Number(velocity?.pitch) || 0
    }
  });
  return Object.freeze({ ...nextState, radius: source.radius });
}

/**
 * Keeps the astronomical chart readable without imposing a pole clamp on the
 * close globe. Before the first Orbit grid line becomes visible, the camera
 * acquires the ecliptic normal as its stable up axis. From Orbit outward the
 * user therefore rotates around the chart instead of rolling the chart with
 * a free arcball gesture.
 */
export function constrainPlanetHubCameraOrbitForView(state = {}, {
  progress = 0,
  worldUp = [0, 1, 0]
} = {}) {
  const amount = Math.max(0, Math.min(1, Number(progress) || 0));
  const source = createPlanetHubCameraOrbitState({
    ...calculatePlanetHubCameraOrbitPose(state),
    velocity: state?.velocity
  });
  const start = PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit * 0.2;
  if (amount <= start) return source;
  // Finish leveling at the Planet/Orbit midpoint, before the grid appears.
  const input = Math.max(0, Math.min(1,
    (amount - start) / (PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit * 0.5 - start)));
  const comfort = input * input * (3 - 2 * input);
  const pose = calculatePlanetHubCameraOrbitPose(source);
  const outward = normalizedVector3(pose.position.map((coordinate, index) => (
    coordinate - pose.target[index]
  )), [0, 0, 1]);
  // Keep the ecliptic horizon level, but do not imprison the chart above its
  // plane. The native reference permits a complete spherical orbit and lets
  // the ground grid fade out on the underside. Only the singular poles remain
  // bounded so yaw and transported-up calculations stay finite.
  const minimumY = -0.999;
  const maximumY = 0.999;
  const nextY = Math.max(minimumY, Math.min(maximumY, outward[1]));
  const horizontalLength = Math.hypot(outward[0], outward[2]);
  const horizontal = horizontalLength > 1e-8
    ? [outward[0] / horizontalLength, outward[2] / horizontalLength]
    : [Math.sin(source.azimuth), Math.cos(source.azimuth)];
  const nextHorizontalLength = Math.sqrt(Math.max(0, 1 - nextY * nextY));
  const nextOutward = normalizedVector3([
    horizontal[0] * nextHorizontalLength,
    nextY,
    horizontal[1] * nextHorizontalLength
  ], outward);
  const levelUp = orthonormalPlanetHubUp(worldUp, nextOutward);
  const transportedUp = transportPlanetHubTangent(source.up, outward, nextOutward);
  const nextUp = orthonormalPlanetHubUp(transportedUp.map((coordinate, index) => (
    coordinate + (levelUp[index] - coordinate) * comfort
  )), nextOutward);
  const pitch = Number(source.velocity?.pitch) || 0;
  const pitchBlocked = (outward[1] < minimumY && pitch < 0)
    || (outward[1] > maximumY && pitch > 0);
  return createPlanetHubCameraOrbitState({
    position: pose.target.map((coordinate, index) => coordinate + nextOutward[index] * source.radius),
    target: pose.target,
    up: nextUp,
    velocity: { yaw: source.velocity.yaw, pitch: pitchBlocked ? 0 : pitch }
  });
}

export function calculatePlanetHubFocusedNormal({ aspect = 1 } = {}) {
  Number(aspect); // Retain the stable public signature for layout callers.
  // A shallow horizon angle presents the landmark facade instead of looking
  // down through its roof. destinationFacingQuaternion() still twists local
  // +Z toward the camera, so every authored front reads upright in this shot.
  return Object.freeze([0, 0.9, 0.43589]);
}

export function calculatePlanetHubFocusFraming({
  destination = "forge",
  worldId = "earth",
  width = 1,
  height = 1,
  aspect = Number(width) / Math.max(1, Number(height) || 1)
} = {}) {
  const framing = resolvePlanetHubHeroFraming(destination, {
    worldId,
    width,
    height,
    aspect
  });
  return Object.freeze({
    key: framing.key,
    normal: Object.freeze([...framing.normal]),
    position: Object.freeze([...framing.position])
  });
}

export function calculatePlanetHubDragRotation({
  deltaX = 0,
  deltaY = 0,
  deltaMs = 16,
  width = 1,
  height = 1,
  velocity = null
} = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  // The globe follows the hand directly: left turns left, right turns right,
  // and vertical movement follows the same convention. A drag across the
  // shorter viewport dimension is roughly a half-turn.
  const basis = Math.max(240, Math.min(safeWidth, safeHeight));
  const radiansPerPixel = Math.PI / basis;
  const rawYaw = (Number(deltaX) || 0) * radiansPerPixel;
  const rawPitch = (Number(deltaY) || 0) * radiansPerPixel;
  const yaw = rawYaw === 0 ? 0 : rawYaw;
  const pitch = rawPitch === 0 ? 0 : rawPitch;
  const seconds = Math.max(0.012, Math.min(0.08, (Number(deltaMs) || 16) / 1000));
  const previousYaw = Number.isFinite(Number(velocity?.yaw)) ? Number(velocity.yaw) : 0;
  const previousPitch = Number.isFinite(Number(velocity?.pitch)) ? Number(velocity.pitch) : 0;
  const clampVelocity = (value) => Math.max(-2.4, Math.min(2.4, value));
  const momentumBlend = 0.68;
  return Object.freeze({
    delta: Object.freeze({ yaw, pitch }),
    velocity: Object.freeze({
      yaw: clampVelocity(previousYaw * (1 - momentumBlend) + (yaw / seconds) * momentumBlend),
      pitch: clampVelocity(previousPitch * (1 - momentumBlend) + (pitch / seconds) * momentumBlend)
    })
  });
}

export function calculatePlanetHubReleaseDirection({
  displacementX = 0,
  displacementY = 0,
  recentVelocityX = 0,
  recentVelocityY = 0,
  fallbackVelocity = null
} = {}) {
  const stable = [Number(displacementX) || 0, Number(displacementY) || 0];
  const recent = [Number(recentVelocityX) || 0, Number(recentVelocityY) || 0];
  const stableLength = Math.hypot(...stable);
  const recentLength = Math.hypot(...recent);
  const fallback = [Number(fallbackVelocity?.yaw) || 0, Number(fallbackVelocity?.pitch) || 0];
  if (stableLength < 1e-7 && recentLength < 1e-7) {
    return Object.freeze(normalizedVector2(fallback, [1, 0]));
  }
  if (stableLength < 1e-7) return Object.freeze(recent.map((value) => value / recentLength));
  if (recentLength < 1e-7) return Object.freeze(stable.map((value) => value / stableLength));

  const stableDirection = stable.map((value) => value / stableLength);
  const recentDirection = recent.map((value) => value / recentLength);
  const alignment = stableDirection[0] * recentDirection[0]
    + stableDirection[1] * recentDirection[1];
  // A filtered recent sample should refine the stable whole-gesture direction,
  // not let a one-pixel terminal wobble reverse a deliberate throw. An actual
  // reversal still wins once its recent speed is unmistakably intentional.
  const confidenceInput = alignment < -0.15
    ? (recentLength - 0.35) / 0.65
    : (recentLength - 0.06) / 0.42;
  const confidence = Math.max(0, Math.min(1, confidenceInput));
  const easedConfidence = confidence * confidence * (3 - 2 * confidence);
  const recentWeight = alignment < -0.15
    ? easedConfidence
    : 0.22 + easedConfidence * 0.68;
  return Object.freeze(normalizedVector2([
    stableDirection[0] * (1 - recentWeight) + recentDirection[0] * recentWeight,
    stableDirection[1] * (1 - recentWeight) + recentDirection[1] * recentWeight
  ], stableDirection));
}

export function calculatePlanetHubDragRelease({
  velocity = null,
  displacementX = 0,
  displacementY = 0,
  distancePx = null,
  recentVelocityX = 0,
  recentVelocityY = 0,
  recentSpeedPxPerMs = null,
  heldStillMs = 0,
  width = 1,
  height = 1,
  maxAngularSpeed = 3.4
} = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const basis = Math.max(240, Math.min(safeWidth, safeHeight));
  const dx = Number(displacementX) || 0;
  const dy = Number(displacementY) || 0;
  const measuredDistance = distancePx != null && Number.isFinite(Number(distancePx))
    ? Math.max(0, Number(distancePx))
    : Math.hypot(dx, dy);
  const recentX = Number(recentVelocityX) || 0;
  const recentY = Number(recentVelocityY) || 0;
  const vectorSpeed = Math.hypot(recentX, recentY);
  const measuredSpeed = recentSpeedPxPerMs != null && Number.isFinite(Number(recentSpeedPxPerMs))
    ? Math.max(0, Number(recentSpeedPxPerMs))
    : vectorSpeed;
  // A normal hand often pauses very briefly while releasing the mouse. Treat
  // that as part of the flick, not as an emergency brake. A deliberate hold
  // still weakens momentum, but only after a generous release window.
  const stillness = Math.exp(-Math.max(0, (Number(heldStillMs) || 0) - 220) / 700);
  const distance = measuredDistance <= 7
    ? 0
    : Math.max(0, Math.min(1, (measuredDistance - 7) / Math.max(1, basis * 0.55 - 7)));
  const speed = Math.max(0, Math.min(1, (measuredSpeed * 1000) / (basis * 1.5)));
  const intent = Math.max(0, Math.min(1, speed * 0.68 + distance * 0.32));
  // Distance pushes a deliberate sweep into the steep part of the curve while
  // recent speed remains the stronger signal. expm1 keeps the zero and maximum
  // exact, and the final cap prevents event spikes from producing a wild spin.
  const curve = measuredDistance > 7
    ? Math.expm1(2.3 * intent) / Math.expm1(2.3)
    : 0;
  // Distance supplies a small dependable floor while velocity remains the
  // dominant, exponential signal. Ordinary 100-200px drags therefore read as
  // physical throws instead of disappearing into two or three degrees.
  const force = Math.max(0, Math.min(1, (curve * 0.92 + distance * 0.08) * stillness));
  const maximum = Math.max(0.08, Math.min(5.2, Number(maxAngularSpeed) || 3.4));
  const minimum = 0.16 * stillness;
  const baseAngularSpeed = measuredDistance > 7
    ? Math.min(maximum, minimum + (maximum - minimum) * force)
    : 0;
  // A true throw requires both velocity and travel. This keeps taps and short
  // corrections precise, then rapidly opens the top end for a fast sweep
  // across the globe. Smoothstep reaches the requested exact 5x multiplier
  // without a discontinuity the player can feel.
  const throwIntent = Math.max(0, Math.min(1, speed * Math.sqrt(distance)));
  const throwProgress = Math.max(0, Math.min(1, (throwIntent - 0.35) / 0.43));
  const throwCurve = throwProgress * throwProgress * (3 - 2 * throwProgress);
  const throwMultiplier = 1 + (PLANET_HUB_THROW_MAX_MULTIPLIER - 1) * throwCurve;
  const angularSpeed = Math.min(
    maximum * PLANET_HUB_THROW_MAX_MULTIPLIER,
    baseAngularSpeed * throwMultiplier
  );

  const direction = calculatePlanetHubReleaseDirection({
    displacementX: dx,
    displacementY: dy,
    recentVelocityX: recentX,
    recentVelocityY: recentY,
    fallbackVelocity: velocity
  });
  const yaw = direction[0] * angularSpeed;
  const pitch = direction[1] * angularSpeed;

  return Object.freeze({
    force,
    // Even a moderate throw should coast long enough to read as physical
    // momentum. Strong flicks retain energy for longer, while the hard cap on
    // angular speed keeps the planet controllable.
    response: 1.55 - force * 0.55 - throwCurve * 0.70,
    angularSpeed,
    throwMultiplier,
    velocity: Object.freeze({ yaw, pitch }),
    normalized: Object.freeze({ distance, speed, intent, throwIntent }),
    stillness
  });
}

export function calculatePlanetHubCoastDuration({
  force = 0,
  angularSpeed = 0,
  throwMultiplier = 1
} = {}) {
  const normalizedForce = Math.max(0, Math.min(1, Number(force) || 0));
  const normalizedSpeed = Math.max(0, Math.min(1,
    (Number(angularSpeed) || 0) / PLANET_HUB_THROW_MAX_ANGULAR_SPEED));
  const energy = Math.max(normalizedForce, normalizedSpeed * 0.75);
  const normalizedThrow = Math.max(0, Math.min(1,
    ((Number(throwMultiplier) || 1) - 1) / (PLANET_HUB_THROW_MAX_MULTIPLIER - 1)));
  // Ordinary gestures retain their compact grace period. Only an intentional
  // high-energy throw owns the globe long enough to complete several turns.
  return Math.round(Math.min(PLANET_HUB_COAST_MAX_MS,
    PLANET_HUB_COAST_MIN_MS + 300 * energy + 4500 * normalizedThrow * normalizedThrow));
}

export function shouldPlanetHubCoastOwnInput({
  nowMs = 0,
  coastUntil = 0,
  velocity = null,
  minimumSpeed = 0.055
} = {}) {
  const speed = Math.hypot(Number(velocity?.yaw) || 0, Number(velocity?.pitch) || 0);
  return Number(coastUntil) > Number(nowMs) && speed > Math.max(0, Number(minimumSpeed) || 0);
}

export function stepPlanetHubIdleState({
  state = null,
  nowMs = 0,
  velocity = null,
  interacting = false,
  coasting = false,
  suppressed = false,
  reducedMotion = false,
  idleYaw = PLANET_HUB_IDLE_YAW_SPEED,
  delayMs = PLANET_HUB_IDLE_RESUME_DELAY_MS,
  settledSpeed = PLANET_HUB_IDLE_SETTLED_SPEED
} = {}) {
  const now = Math.max(0, Number(nowMs) || 0);
  const speed = Math.hypot(Number(velocity?.yaw) || 0, Number(velocity?.pitch) || 0);
  const blocked = Boolean(interacting || coasting || suppressed || reducedMotion);
  if (blocked || speed > Math.max(0, Number(settledSpeed) || 0)) {
    return Object.freeze({
      state: Object.freeze({ active: false, settledSince: null }),
      idleYaw: 0,
      waiting: false,
      resetVelocity: false
    });
  }
  if (state?.active) {
    return Object.freeze({
      state: Object.freeze({ active: true, settledSince: state?.settledSince ?? now }),
      idleYaw: Number(idleYaw) || 0,
      waiting: false,
      resetVelocity: false
    });
  }
  const settledSince = state?.settledSince != null && Number.isFinite(Number(state.settledSince))
    ? Number(state.settledSince)
    : now;
  const ready = now - settledSince >= Math.max(0, Number(delayMs) || 0);
  return Object.freeze({
    state: Object.freeze({ active: ready, settledSince }),
    idleYaw: ready ? Number(idleYaw) || 0 : 0,
    waiting: !ready,
    // Remove the last sub-perceptual remnant before idle starts so a throw in
    // the opposite direction never visibly crosses through zero into idle.
    resetVelocity: ready
  });
}

export function stepPlanetHubRotation({
  velocity = null,
  deltaSeconds = 1 / 60,
  idleYaw = PLANET_HUB_IDLE_YAW_SPEED,
  releaseResponse = 8.5,
  enabled = true
} = {}) {
  const previousYaw = Number.isFinite(Number(velocity?.yaw)) ? Number(velocity.yaw) : 0;
  const previousPitch = Number.isFinite(Number(velocity?.pitch)) ? Number(velocity.pitch) : 0;
  if (!enabled) {
    return Object.freeze({
      velocity: Object.freeze({ yaw: 0, pitch: 0 }),
      delta: Object.freeze({ yaw: 0, pitch: 0 }),
      moving: false
    });
  }

  const dt = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
  const targetYaw = Number(idleYaw) || 0;
  const targetPitch = 0;
  const response = Math.max(0, Number(releaseResponse) || 0);
  const alpha = 1 - Math.exp(-response * dt);
  const yaw = previousYaw + (targetYaw - previousYaw) * alpha;
  const pitch = previousPitch + (targetPitch - previousPitch) * alpha;

  return Object.freeze({
    velocity: Object.freeze({ yaw, pitch }),
    delta: Object.freeze({ yaw: yaw * dt, pitch: pitch * dt }),
    // Overview's subtle idle yaw intentionally keeps the renderer alive. It is
    // disabled entirely for reduced-motion and focused/cinematic states.
    moving: dt > 0 && (Math.abs(yaw) > 1e-5 || Math.abs(pitch) > 1e-5 || Math.abs(targetYaw) > 1e-5)
  });
}

export function stepPlanetHubFrontActivation({
  state = null,
  scores = null,
  nowMs = 0,
  enterThreshold = 0.94,
  exitThreshold = 0.9,
  dwellMs = 180,
  cooldownMs = 320
} = {}) {
  const entries = Object.entries(scores || {})
    .filter(([, score]) => Number.isFinite(Number(score)))
    .map(([destination, score]) => [destination, Number(score)])
    .sort((left, right) => right[1] - left[1]);
  const previousActive = state?.active || null;
  const active = entries.some(([destination]) => destination === previousActive) ? previousActive : null;
  const winner = entries[0]?.[0] || null;
  const winnerScore = entries[0]?.[1] ?? -Infinity;
  const activeScore = entries.find(([destination]) => destination === active)?.[1] ?? -Infinity;
  const safeEnter = Math.max(-1, Math.min(1, Number(enterThreshold) || 0.95));
  const safeExit = Math.min(safeEnter, Math.max(-1, Math.min(1, Number(exitThreshold) || 0.88)));
  const safeNow = Math.max(0, Number(nowMs) || 0);
  const safeDwell = Math.max(0, Number(dwellMs) || 0);
  const safeCooldown = Math.max(0, Number(cooldownMs) || 0);
  const lastChangedAt = state?.lastChangedAt != null && Number.isFinite(Number(state.lastChangedAt))
    ? Number(state.lastChangedAt)
    : null;
  const coolingDown = lastChangedAt != null && safeNow - lastChangedAt < safeCooldown;

  // Hysteresis keeps the currently activated destination authoritative until
  // it clearly leaves the central cone. A replacement then has to remain in
  // the tighter enter cone for the full dwell interval.
  if (active && activeScore >= safeExit) {
    return Object.freeze({
      state: Object.freeze({ active, candidate: null, candidateSince: null, lastChangedAt }),
      destination: active,
      winner,
      score: winnerScore,
      changed: false
    });
  }
  if (coolingDown || !winner || winnerScore < safeEnter || winner === active) {
    return Object.freeze({
      state: Object.freeze({ active, candidate: null, candidateSince: null, lastChangedAt }),
      destination: active,
      winner,
      score: winnerScore,
      changed: false
    });
  }

  const sameCandidate = state?.candidate === winner
    && state?.candidateSince != null
    && Number.isFinite(Number(state.candidateSince));
  const candidateSince = sameCandidate ? Number(state.candidateSince) : safeNow;
  const ready = safeNow - candidateSince >= safeDwell;
  const nextActive = ready ? winner : active;
  return Object.freeze({
    state: Object.freeze({
      active: nextActive,
      candidate: ready ? null : winner,
      candidateSince: ready ? null : candidateSince,
      lastChangedAt: ready ? safeNow : lastChangedAt
    }),
    destination: nextActive,
    previousDestination: ready ? active : null,
    winner,
    score: winnerScore,
    changed: ready && winner !== active
  });
}

export function calculatePlanetHubSatellitePose({
  elapsedMs = 0,
  reducedMotion = false,
  orbitRadius = PLANET_HUB_MOON_ORBIT_RADIUS,
  // A shallow lunar plane keeps the satellite naturally separate from Earth
  // without parking its usable face behind the persistent Home navigation.
  inclinationDegrees = 8,
  phaseOffset = Math.PI * 0.18,
  periodMs = PLANET_HUB_MOON_ORBIT_PERIOD_MS
} = {}) {
  const radius = Math.max(1.1, Number(orbitRadius) || PLANET_HUB_MOON_ORBIT_RADIUS);
  const inclination = (Number(inclinationDegrees) || 0) * Math.PI / 180;
  const safePeriod = Math.max(1000, Number(periodMs) || PLANET_HUB_MOON_ORBIT_PERIOD_MS);
  const phase = Number(phaseOffset) + (reducedMotion ? 0 : Math.max(0, Number(elapsedMs) || 0) / safePeriod * Math.PI * 2);
  return Object.freeze({
    phase,
    position: Object.freeze([
      Math.cos(phase) * radius,
      Math.sin(phase) * Math.sin(inclination) * radius,
      Math.sin(phase) * Math.cos(inclination) * radius
    ]),
    axialRotation: reducedMotion ? 0.28 : phase * 0.36
  });
}

/**
 * Compose the motion-safe Moon in camera space instead of freezing it at an
 * arbitrary inertial phase. Camera-owned navigation can otherwise leave that
 * phase behind the globe or outside the viewport for every canonical Home
 * destination. The negative camera-outward component keeps the Moon behind
 * Earth in depth while the right/up components place its centre beyond the
 * visible limb, preserving a calm, clickable upper-right composition.
 */
export function calculatePlanetHubReducedMotionSatellitePosition({
  outwardToCamera = [0, 0, 1],
  screenRight = [1, 0, 0],
  screenUp = [0, 1, 0],
  orbitRadius = PLANET_HUB_MOON_ORBIT_RADIUS
} = {}) {
  const outward = normalizedVector3(outwardToCamera, [0, 0, 1]);
  const right = normalizedVector3(screenRight, [1, 0, 0]);
  const up = normalizedVector3(screenUp, [0, 1, 0]);
  const direction = normalizedVector3([0, 1, 2].map((index) => (
    right[index] * 0.62
    + up[index] * 0.32
    - outward[index] * 0.716
  )), [0.62, 0.32, -0.716]);
  const radius = Math.max(1.1, Number(orbitRadius) || PLANET_HUB_MOON_ORBIT_RADIUS);
  return Object.freeze(direction.map((coordinate) => coordinate * radius));
}

export function calculatePlanetHubSatellitePerspectiveScale({
  baseScale = PLANET_HUB_MOON_RADIUS_RATIO,
  earthScale = 1,
  earthCameraDistance = 4.5,
  satelliteCameraDistance = 4.5
} = {}) {
  const base = Math.max(0.01, Number(baseScale) || PLANET_HUB_MOON_RADIUS_RATIO);
  const worldScale = Math.max(1e-9, Number(earthScale) || 1);
  const earthDistance = Math.max(1e-9, Number(earthCameraDistance) || 4.5);
  const satelliteDistance = Math.max(1e-9, Number(satelliteCameraDistance) || earthDistance);
  // Perspective otherwise makes the Moon balloon on the near arc and shrink
  // on the far arc. Compensate its world scale so its projected radius stays
  // at the physical 0.273 Earth ratio throughout the cinematic orbit.
  const perspectiveCompensation = Math.max(0.35, Math.min(2.5, satelliteDistance / earthDistance));
  return base * worldScale * perspectiveCompensation;
}

export function resolvePlanetHubRaycastDetail(object, boundary = null) {
  let current = object || null;
  let destination = null;
  let action = null;
  let satellite = null;
  let body = null;
  while (current && current !== boundary) {
    satellite ||= current.userData?.planetHubSatellite || null;
    body ||= current.userData?.planetHubBody || null;
    destination ||= current.userData?.planetHubDestination || null;
    action ||= current.userData?.planetHubAction || null;
    current = current.parent || null;
  }
  const target = satellite || destination || body || null;
  return target ? Object.freeze({ target, destination, action, satellite, body }) : null;
}

export function resolvePlanetHubRaycastTarget(object, boundary = null) {
  return resolvePlanetHubRaycastDetail(object, boundary)?.target || null;
}

export function calculatePlanetHubRocketDock({
  platformBounds = null,
  rocketBounds = null,
  fallback = [0, 0.16, 0],
  clearance = 0.004
} = {}) {
  const safeFallback = Array.isArray(fallback) ? fallback : [0, 0.16, 0];
  const platformTop = Number(platformBounds?.max?.[1]);
  const rocketBottom = Number(rocketBounds?.min?.[1]);
  const y = Number.isFinite(platformTop) && Number.isFinite(rocketBottom)
    ? platformTop - rocketBottom + Math.max(0, Number(clearance) || 0)
    : Number(safeFallback[1]) || 0.16;
  return Object.freeze([
    Number(safeFallback[0]) || 0,
    y,
    Number(safeFallback[2]) || 0
  ]);
}

export function calculatePlanetHubSunRotation({ elapsedMs = 0, reducedMotion = false } = {}) {
  return reducedMotion ? 0.18 : 0.18 + Math.max(0, Number(elapsedMs) || 0) * 0.000035;
}

export function calculatePlanetHubPresentationScale(mode = "overview") {
  // Focus is a camera-like move of the complete physical world, never an
  // independent landmark zoom. Keeping this as one uniform scalar preserves
  // the authored landmark/planet ratio and prevents plinths from turning into
  // clipped, screen-filling geometry.
  return mode === "focused" ? 2.2 : 1;
}

export function calculatePlanetHubPresentationDuration({
  kind = "destination",
  width = 1280,
  reducedMotion = false
} = {}) {
  if (reducedMotion) return 200;
  const compact = Math.max(1, Number(width) || 1280) <= 1024;
  if (String(kind).startsWith("focus")) return compact ? 960 : 1120;
  return compact ? 860 : 1040;
}

export function easePlanetHubPresentationProgress(progress, kind = "destination") {
  const value = Math.max(0, Math.min(1, Number(progress) || 0));
  if (String(kind).startsWith("focus")) {
    // Quintic smootherstep starts and ends with zero velocity. A landmark
    // focus should read as the whole world being carefully centered, not as a
    // fast zoom that spends half its distance in the first few frames.
    return value * value * value * (value * (value * 6 - 15) + 10);
  }
  // Destination turns share the zero-velocity arrival of focus motion. This
  // prevents a tab click from looking like a carousel snap while its celestial
  // light and atmosphere are still settling around the newly centered site.
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function normalizedVector3(value, fallback = [0, 1, 0]) {
  const vector = [0, 1, 2].map((index) => Number(value?.[index]) || 0);
  const length = Math.hypot(...vector);
  if (length > 1e-8) return vector.map((coordinate) => coordinate / length);
  const safeFallback = [0, 1, 2].map((index) => Number(fallback?.[index]) || 0);
  const fallbackLength = Math.hypot(...safeFallback) || 1;
  return safeFallback.map((coordinate) => coordinate / fallbackLength);
}

function normalizedVector2(value, fallback = [1, 0]) {
  const vector = [Number(value?.[0]) || 0, Number(value?.[1]) || 0];
  const length = Math.hypot(...vector);
  if (length > 1e-8) return vector.map((coordinate) => coordinate / length);
  const safeFallback = [Number(fallback?.[0]) || 0, Number(fallback?.[1]) || 0];
  const fallbackLength = Math.hypot(...safeFallback) || 1;
  return safeFallback.map((coordinate) => coordinate / fallbackLength);
}

function crossPlanetHubVectors(left = [0, 0, 0], right = [0, 0, 0]) {
  return [
    (Number(left?.[1]) || 0) * (Number(right?.[2]) || 0)
      - (Number(left?.[2]) || 0) * (Number(right?.[1]) || 0),
    (Number(left?.[2]) || 0) * (Number(right?.[0]) || 0)
      - (Number(left?.[0]) || 0) * (Number(right?.[2]) || 0),
    (Number(left?.[0]) || 0) * (Number(right?.[1]) || 0)
      - (Number(left?.[1]) || 0) * (Number(right?.[0]) || 0)
  ];
}

function dotPlanetHubVectors(left = [0, 0, 0], right = [0, 0, 0]) {
  return [0, 1, 2].reduce((sum, index) => (
    sum + (Number(left?.[index]) || 0) * (Number(right?.[index]) || 0)
  ), 0);
}

function orthonormalPlanetHubUp(up = [0, 1, 0], outward = [0, 0, 1]) {
  const normal = normalizedVector3(outward, [0, 0, 1]);
  let candidate = normalizedVector3(up, [0, 1, 0]);
  candidate = candidate.map((coordinate, index) => (
    coordinate - normal[index] * dotPlanetHubVectors(candidate, normal)
  ));
  if (Math.hypot(...candidate) < 1e-7) {
    const fallback = Math.abs(normal[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0];
    candidate = fallback.map((coordinate, index) => (
      coordinate - normal[index] * dotPlanetHubVectors(fallback, normal)
    ));
  }
  return normalizedVector3(candidate, [0, 1, 0]);
}

function rotatePlanetHubVectorAroundAxis(vector, axis, angle) {
  const source = normalizedVector3(vector, [0, 1, 0]);
  const normal = normalizedVector3(axis, [1, 0, 0]);
  const cosine = Math.cos(Number(angle) || 0);
  const sine = Math.sin(Number(angle) || 0);
  const cross = crossPlanetHubVectors(normal, source);
  const projection = dotPlanetHubVectors(normal, source) * (1 - cosine);
  return normalizedVector3(source.map((coordinate, index) => (
    coordinate * cosine + cross[index] * sine + normal[index] * projection
  )), source);
}

function transportPlanetHubTangent(vector, fromOutward, toOutward) {
  const from = normalizedVector3(fromOutward, [0, 0, 1]);
  const to = normalizedVector3(toOutward, from);
  const dot = Math.max(-1, Math.min(1, dotPlanetHubVectors(from, to)));
  const axis = crossPlanetHubVectors(from, to);
  const axisLength = Math.hypot(...axis);
  if (axisLength < 1e-8) return orthonormalPlanetHubUp(vector, to);
  return orthonormalPlanetHubUp(
    rotatePlanetHubVectorAroundAxis(vector, axis, Math.acos(dot)),
    to
  );
}

function slerpPlanetHubUnitVectors(from, to, amount = 0) {
  const start = normalizedVector3(from, [0, 0, 1]);
  const end = normalizedVector3(to, start);
  const progress = Math.max(0, Math.min(1, Number(amount) || 0));
  const dot = Math.max(-1, Math.min(1, dotPlanetHubVectors(start, end)));
  if (dot > 0.9995) {
    return normalizedVector3(start.map((coordinate, index) => (
      coordinate + (end[index] - coordinate) * progress
    )), start);
  }
  if (dot < -0.9995) {
    const reference = Math.abs(start[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0];
    const axis = normalizedVector3(crossPlanetHubVectors(start, reference), [1, 0, 0]);
    return rotatePlanetHubVectorAroundAxis(start, axis, Math.PI * progress);
  }
  const angle = Math.acos(dot);
  const sine = Math.sin(angle);
  const startWeight = Math.sin((1 - progress) * angle) / sine;
  const endWeight = Math.sin(progress * angle) / sine;
  return normalizedVector3(start.map((coordinate, index) => (
    coordinate * startWeight + end[index] * endWeight
  )), start);
}

export function calculatePlanetHubCameraFacingSphereSamples({
  center = [0, 0, 0],
  radius = 1,
  cameraPosition = [0, 0, 4.5],
  cameraUp = [0, 1, 0]
} = {}) {
  const origin = [0, 1, 2].map((index) => Number(center?.[index]) || 0);
  const camera = [0, 1, 2].map((index) => Number(cameraPosition?.[index]) || 0);
  const forward = normalizedVector3(origin.map((coordinate, index) => coordinate - camera[index]), [0, 0, -1]);
  let right = normalizedVector3(crossPlanetHubVectors(forward, cameraUp), [1, 0, 0]);
  if (Math.abs(right[0] * forward[0] + right[1] * forward[1] + right[2] * forward[2]) > 1e-5) {
    right = normalizedVector3(crossPlanetHubVectors(forward, [0, 1, 0]), [1, 0, 0]);
  }
  const up = normalizedVector3(crossPlanetHubVectors(right, forward), cameraUp);
  const extent = Math.max(0.001, Number(radius) || 1);
  const offset = (direction, scale) => origin.map((coordinate, index) => (
    coordinate + direction[index] * extent * scale
  ));
  return Object.freeze({
    center: Object.freeze(origin),
    left: Object.freeze(offset(right, -1)),
    right: Object.freeze(offset(right, 1)),
    top: Object.freeze(offset(up, 1)),
    bottom: Object.freeze(offset(up, -1)),
    cameraRight: Object.freeze(right),
    cameraUp: Object.freeze(up)
  });
}

export function calculatePlanetHubSurfaceLandingGeometry({
  destinationCenter = [0, 0, 0],
  destinationRadius = PLANET_HUB_MOON_RADIUS_RATIO,
  approachFrom = [0, 0, 1],
  tailClearance = 0
} = {}) {
  const center = [0, 1, 2].map((index) => Number(destinationCenter?.[index]) || 0);
  const approach = [0, 1, 2].map((index) => Number(approachFrom?.[index]) || 0);
  const nearSideNormal = normalizedVector3(
    approach.map((coordinate, index) => coordinate - center[index]),
    [0, 0, 1]
  );
  const surfaceRadius = Math.max(0.01, Number(destinationRadius) || PLANET_HUB_MOON_RADIUS_RATIO);
  const clearance = Math.max(0, Number(tailClearance) || 0);
  const surfacePosition = center.map((coordinate, index) => coordinate + nearSideNormal[index] * surfaceRadius);
  const landingPosition = center.map((coordinate, index) => coordinate
    + nearSideNormal[index] * (surfaceRadius + clearance));
  return Object.freeze({
    center: Object.freeze(center),
    normal: Object.freeze(nearSideNormal),
    surfacePosition: Object.freeze(surfacePosition),
    landingPosition: Object.freeze(landingPosition),
    surfaceRadius,
    tailClearance: clearance
  });
}

export function calculatePlanetHubMoonLandingGeometry({
  moonCenter = [0, 0, 0],
  moonRadius = PLANET_HUB_MOON_RADIUS_RATIO,
  ...options
} = {}) {
  return calculatePlanetHubSurfaceLandingGeometry({
    ...options,
    destinationCenter: moonCenter,
    destinationRadius: moonRadius
  });
}

export function calculatePlanetHubVehicleSphereClearance({
  position = [0, 0, 0],
  orientation = [0, 1, 0],
  vehicleHeight = 0.32,
  vehicleRadius = null,
  center = [0, 0, 0],
  sphereRadius = 1
} = {}) {
  const tail = [0, 1, 2].map((index) => Number(position?.[index]) || 0);
  const origin = [0, 1, 2].map((index) => Number(center?.[index]) || 0);
  const forward = normalizedVector3(orientation, [0, 1, 0]);
  const height = Math.max(1e-5, Number(vehicleHeight) || 0.32);
  const radius = Math.max(0, Math.min(height * 0.49,
    vehicleRadius != null && Number.isFinite(Number(vehicleRadius))
      ? Number(vehicleRadius)
      : height * PLANET_HUB_JOURNEY_VEHICLE_RADIUS_RATIO));
  const bodyRadius = Math.max(0.01, Number(sphereRadius) || 1);
  const nose = tail.map((value, index) => value + forward[index] * height);
  // The optimized rocket's pivot is its tail plane. Model the solid as a
  // capsule whose first/last sphere centers are inset by its radius so the
  // physical tail and nose remain the actual endpoints instead of oversized
  // pivot spheres that would falsely intersect a valid launch pad.
  const axisStart = tail.map((value, index) => value + forward[index] * radius);
  const axisEnd = nose.map((value, index) => value - forward[index] * radius);
  const axis = axisEnd.map((value, index) => value - axisStart[index]);
  const axisLengthSquared = axis.reduce((sum, value) => sum + value * value, 0);
  const centerOffset = origin.map((value, index) => value - axisStart[index]);
  const closestAmount = axisLengthSquared > 1e-12
    ? Math.max(0, Math.min(1, centerOffset.reduce((sum, value, index) => sum + value * axis[index], 0)
      / axisLengthSquared))
    : 0;
  const closestPoint = axisStart.map((value, index) => value + axis[index] * closestAmount);
  const distanceFrom = (point) => Math.hypot(...point.map((value, index) => value - origin[index]));
  const tailClearance = distanceFrom(tail) - bodyRadius;
  const noseClearance = distanceFrom(nose) - bodyRadius;
  const capsuleClearance = distanceFrom(closestPoint) - bodyRadius - radius;
  return Object.freeze({
    clearance: Math.min(tailClearance, noseClearance, capsuleClearance),
    tailClearance,
    noseClearance,
    capsuleClearance,
    closestAmount,
    closestPoint: Object.freeze(closestPoint),
    tail: Object.freeze(tail),
    nose: Object.freeze(nose),
    vehicleHeight: height,
    vehicleRadius: radius
  });
}

export function constrainPlanetHubVehicleOutsideSphere({
  position = [0, 0, 0],
  orientation = [0, 1, 0],
  vehicleHeight = 0.32,
  vehicleRadius = null,
  center = [0, 0, 0],
  sphereRadius = 1,
  minimumClearance = PLANET_HUB_JOURNEY_BODY_CLEARANCE,
  maxIterations = 8
} = {}) {
  const origin = [0, 1, 2].map((index) => Number(center?.[index]) || 0);
  let safePosition = [0, 1, 2].map((index) => Number(position?.[index]) || 0);
  const required = Math.max(0, Number(minimumClearance) || 0);
  const passes = Math.max(1, Math.min(16, Math.round(Number(maxIterations) || 8)));
  let measurement;
  for (let iteration = 0; iteration < passes; iteration += 1) {
    measurement = calculatePlanetHubVehicleSphereClearance({
      position: safePosition,
      orientation,
      vehicleHeight,
      vehicleRadius,
      center: origin,
      sphereRadius
    });
    if (measurement.clearance >= required - 1e-9) break;
    const radial = normalizedVector3(
      measurement.closestPoint.map((value, index) => value - origin[index]),
      safePosition.map((value, index) => value - origin[index])
    );
    const correction = required - measurement.clearance + 1e-7;
    safePosition = safePosition.map((value, index) => value + radial[index] * correction);
  }
  measurement = calculatePlanetHubVehicleSphereClearance({
    position: safePosition,
    orientation,
    vehicleHeight,
    vehicleRadius,
    center: origin,
    sphereRadius
  });
  return Object.freeze({
    position: Object.freeze(safePosition),
    ...measurement
  });
}

export function calculatePlanetHubFlightPhase({
  elapsedMs = 0,
  durationMs = PLANET_HUB_JOURNEY_DURATION_MS,
  launchViewHoldMs = PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS,
  landingCameraStartMs = PLANET_HUB_JOURNEY_LANDING_CAMERA_START_MS,
  landingCameraBlendMs = PLANET_HUB_JOURNEY_LANDING_CAMERA_BLEND_MS,
  landingStaticMs = PLANET_HUB_JOURNEY_LANDING_STATIC_MS
} = {}) {
  const duration = Math.max(1, Number(durationMs) || PLANET_HUB_JOURNEY_DURATION_MS);
  const elapsed = Math.max(0, Math.min(duration, Number(elapsedMs) || 0));
  const holdEnd = Math.max(0, Math.min(duration, Number(launchViewHoldMs) || 0));
  const landingStart = Math.max(holdEnd, Math.min(duration, Number(landingCameraStartMs) || duration));
  const staticDuration = Math.max(0, Math.min(duration, Number(landingStaticMs) || 0));
  const staticStart = Math.max(landingStart, duration - staticDuration);
  const landingBlendDuration = Math.max(1, Number(landingCameraBlendMs) || 1);
  const smoothstep = (value) => {
    const input = Math.max(0, Math.min(1, value));
    return input * input * (3 - 2 * input);
  };
  const landingInput = Math.max(0, Math.min(1, (elapsed - landingStart) / landingBlendDuration));
  return Object.freeze({
    name: elapsed <= holdEnd ? "launch" : (elapsed < landingStart ? "chase" : "landing"),
    elapsedMs: elapsed,
    progress: elapsed / duration,
    launchHeld: elapsed <= holdEnd,
    chaseProgress: landingStart <= holdEnd
      ? 1
      : Math.max(0, Math.min(1, (elapsed - holdEnd) / (landingStart - holdEnd))),
    landingProgress: landingStart >= duration
      ? 0
      : Math.max(0, Math.min(1, (elapsed - landingStart) / (duration - landingStart))),
    landingBlend: smoothstep(landingInput),
    landingLocked: elapsed >= staticStart,
    landingStatic: staticStart >= duration
      ? 0
      : Math.max(0, Math.min(1, (elapsed - staticStart) / (duration - staticStart)))
  });
}

export function calculatePlanetHubTransportedFrame({
  forward = [0, 1, 0],
  previousFrame = null,
  preferredFacade = [1, 0, 0]
} = {}) {
  const nextForward = normalizedVector3(forward, [0, 1, 0]);
  const dot = (left, right) => left.reduce((total, value, index) => total + value * right[index], 0);
  const cross = (left, right) => [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
  const projectFacade = (value, fallback = [1, 0, 0]) => {
    const candidate = [0, 1, 2].map((index) => Number(value?.[index]) || 0);
    const projected = candidate.map((coordinate, index) => coordinate - nextForward[index] * dot(candidate, nextForward));
    if (Math.hypot(...projected) > 1e-8) return normalizedVector3(projected, fallback);
    const axis = Math.abs(nextForward[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    return normalizedVector3(cross(nextForward, axis), fallback);
  };

  const previousForward = previousFrame?.forward
    ? normalizedVector3(previousFrame.forward, nextForward)
    : null;
  const previousFacade = previousFrame?.facade
    ? normalizedVector3(previousFrame.facade, preferredFacade)
    : null;
  let facade;
  if (!previousForward || !previousFacade) facade = projectFacade(preferredFacade);
  else {
    const cosine = Math.max(-1, Math.min(1, dot(previousForward, nextForward)));
    const axisVector = cross(previousForward, nextForward);
    const sine = Math.hypot(...axisVector);
    let transported;
    if (sine > 1e-7) {
      const axis = axisVector.map((coordinate) => coordinate / sine);
      const axisDot = dot(axis, previousFacade);
      const axisCrossFacade = cross(axis, previousFacade);
      transported = previousFacade.map((coordinate, index) => (
        coordinate * cosine
        + axisCrossFacade[index] * sine
        + axis[index] * axisDot * (1 - cosine)
      ));
    } else if (cosine < 0) {
      // A 180-degree path reversal has infinitely many rotation axes. Keep the
      // carried facade as that axis, which reverses forward without rolling.
      const axis = projectFacade(previousFacade);
      const axisDot = dot(axis, previousFacade);
      transported = previousFacade.map((coordinate, index) => -coordinate + 2 * axis[index] * axisDot);
    } else transported = previousFacade;
    facade = projectFacade(transported, previousFacade);
  }
  const side = normalizedVector3(cross(facade, nextForward), [0, 0, 1]);
  facade = normalizedVector3(cross(nextForward, side), facade);
  return Object.freeze({
    facade: Object.freeze(facade),
    forward: Object.freeze(nextForward),
    side: Object.freeze(side)
  });
}

export function constrainPlanetHubCameraOutsideSphere({
  position = [0, 0, 1],
  center = [0, 0, 0],
  radius = PLANET_HUB_MOON_RADIUS_RATIO,
  surfaceNormal = [0, 0, 1],
  clearance = 0.12,
  minimumHemisphere = 0.12
} = {}) {
  const origin = [0, 1, 2].map((index) => Number(center?.[index]) || 0);
  const normal = normalizedVector3(surfaceNormal, [0, 0, 1]);
  const minimumRadius = Math.max(0.01, Number(radius) || PLANET_HUB_MOON_RADIUS_RATIO)
    + Math.max(0, Number(clearance) || 0);
  const minimumNormalDistance = minimumRadius * Math.max(0, Math.min(1, Number(minimumHemisphere) || 0));
  let offset = [0, 1, 2].map((index) => (Number(position?.[index]) || 0) - origin[index]);
  const normalDistance = offset.reduce((total, value, index) => total + value * normal[index], 0);
  if (normalDistance < minimumNormalDistance) {
    offset = offset.map((value, index) => value + normal[index] * (minimumNormalDistance - normalDistance));
  }
  const distance = Math.hypot(...offset);
  if (distance < minimumRadius) {
    offset = normalizedVector3(offset, normal).map((value) => value * minimumRadius);
  }
  return Object.freeze(origin.map((value, index) => value + offset[index]));
}

export function smoothPlanetHubCameraPose({
  currentPosition = [0, 0, 0],
  currentTarget = [0, 0, 0],
  desiredPosition = currentPosition,
  desiredTarget = currentTarget,
  deltaSeconds = 1 / 60,
  positionResponse = 8.5,
  targetResponse = 10
} = {}) {
  const vector = (value, fallback) => [0, 1, 2].map((index) => {
    const coordinate = Number(value?.[index]);
    return Number.isFinite(coordinate) ? coordinate : fallback[index];
  });
  const current = vector(currentPosition, [0, 0, 0]);
  const target = vector(currentTarget, [0, 0, 0]);
  const desired = vector(desiredPosition, current);
  const desiredLook = vector(desiredTarget, target);
  const seconds = Math.max(0, Math.min(0.1, Number(deltaSeconds) || 0));
  const positionAlpha = 1 - Math.exp(-Math.max(0.1, Number(positionResponse) || 8.5) * seconds);
  const targetAlpha = 1 - Math.exp(-Math.max(0.1, Number(targetResponse) || 10) * seconds);
  return Object.freeze({
    position: Object.freeze(current.map((coordinate, index) => (
      coordinate + (desired[index] - coordinate) * positionAlpha
    ))),
    target: Object.freeze(target.map((coordinate, index) => (
      coordinate + (desiredLook[index] - coordinate) * targetAlpha
    ))),
    positionAlpha,
    targetAlpha
  });
}

export function calculatePlanetHubJourneyRocketUp({
  tangent = [0, 1, 0],
  landingNormal = [0, 1, 0],
  travel = 0,
  landingBlendStart = 0.7,
  landingBlendEnd = 0.86
} = {}) {
  const direction = normalizedVector3(tangent, [0, 1, 0]);
  const outward = normalizedVector3(landingNormal, direction);
  const start = Math.max(0, Math.min(0.98, Number(landingBlendStart) || 0));
  const end = Math.max(start + 0.01, Math.min(1, Number(landingBlendEnd) || 1));
  const input = Math.max(0, Math.min(1, (Math.max(0, Math.min(1, Number(travel) || 0)) - start) / (end - start)));
  const blend = input * input * (3 - 2 * input);
  if (blend <= 0) return Object.freeze(direction);
  if (blend >= 1) return Object.freeze(outward);

  const dot = Math.max(-1, Math.min(1,
    direction.reduce((total, coordinate, index) => total + coordinate * outward[index], 0)));
  let orientation;
  if (dot > 0.9995) {
    orientation = direction.map((coordinate, index) => coordinate + (outward[index] - coordinate) * blend);
  } else if (dot < -0.9995) {
    const axisSeed = Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const orthogonal = normalizedVector3([
      direction[1] * axisSeed[2] - direction[2] * axisSeed[1],
      direction[2] * axisSeed[0] - direction[0] * axisSeed[2],
      direction[0] * axisSeed[1] - direction[1] * axisSeed[0]
    ], [1, 0, 0]);
    orientation = direction.map((coordinate, index) => (
      coordinate * Math.cos(Math.PI * blend) + orthogonal[index] * Math.sin(Math.PI * blend)
    ));
  } else {
    const angle = Math.acos(dot);
    const denominator = Math.sin(angle);
    const fromWeight = Math.sin((1 - blend) * angle) / denominator;
    const toWeight = Math.sin(blend * angle) / denominator;
    orientation = direction.map((coordinate, index) => coordinate * fromWeight + outward[index] * toWeight);
  }
  return Object.freeze(normalizedVector3(orientation, outward));
}

export function calculatePlanetHubJourneyDeparturePose({
  from = [0, 0, 0],
  to = [0, 0, 0],
  departureCenter = [0, 0, 0],
  departureRadius = null,
  destinationCenter = null,
  destinationRadius = PLANET_HUB_MOON_RADIUS_RATIO,
  direction = "outbound",
  progress = 0,
  elapsedMs = null,
  durationMs = PLANET_HUB_JOURNEY_DURATION_MS,
  reducedMotion = false,
  launchNormal = [0, 1, 0],
  arrivalNormal = [0, 1, 0],
  ignitionShare = PLANET_HUB_JOURNEY_IGNITION_MS / PLANET_HUB_JOURNEY_DURATION_MS,
  routeStretch = 1,
  launchLiftShare = PLANET_HUB_JOURNEY_LAUNCH_LIFT_MS / PLANET_HUB_JOURNEY_DURATION_MS,
  launchLiftHeight = 0.35,
  launchVehicleHeight = null,
  arrivalVehicleHeight = null,
  vehicleRadiusRatio = PLANET_HUB_JOURNEY_VEHICLE_RADIUS_RATIO,
  minimumBodyClearance = PLANET_HUB_JOURNEY_BODY_CLEARANCE,
  preOrbitShare = PLANET_HUB_JOURNEY_PRE_ORBIT_SHARE,
  preOrbitRadians = PLANET_HUB_JOURNEY_PRE_ORBIT_RADIANS
} = {}) {
  const duration = Math.max(1, Number(durationMs) || PLANET_HUB_JOURNEY_DURATION_MS);
  const suppliedProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  const elapsed = elapsedMs != null && Number.isFinite(Number(elapsedMs))
    ? Math.max(0, Math.min(duration, Number(elapsedMs)))
    : suppliedProgress * duration;
  const value = elapsed / duration;
  const returning = direction === "return";
  const canonicalValue = returning ? 1 - value : value;
  const ignitionPortion = Math.max(0, Math.min(0.25, Number(ignitionShare) || 0));
  const liftEnd = Math.max(0.04, Math.min(0.32, Number(launchLiftShare) || 0.2));
  const craneEnd = Math.max(liftEnd + 0.02,
    Math.min(0.42, PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS / duration));
  const authoredOrbitEnd = PLANET_HUB_JOURNEY_OUTBOUND_ORBIT_END_MS / duration;
  const orbitDuration = Math.max(0.08, Math.min(0.38, Number(preOrbitShare) || (authoredOrbitEnd - craneEnd)));
  const orbitEnd = Math.max(craneEnd + 0.04, Math.min(0.68, craneEnd + orbitDuration));
  const transferEnd = Math.max(orbitEnd + 0.08,
    Math.min(0.84, PLANET_HUB_JOURNEY_APPROACH_START_MS / duration));
  const approachEnd = Math.max(transferEnd + 0.04,
    Math.min(0.94, PLANET_HUB_JOURNEY_LANDING_START_MS / duration));
  const smoothstep = (input) => {
    const bounded = Math.max(0, Math.min(1, input));
    return bounded * bounded * (3 - 2 * bounded);
  };
  const smootherstep = (input) => {
    const bounded = Math.max(0, Math.min(1, input));
    return bounded ** 3 * (bounded * (bounded * 6 - 15) + 10);
  };
  const segmentProgress = (input, startAt, endAt) => Math.max(0, Math.min(1,
    (input - startAt) / Math.max(1e-8, endAt - startAt)
  ));
  const add = (left, right) => left.map((coordinate, index) => coordinate + right[index]);
  const subtract = (left, right) => left.map((coordinate, index) => coordinate - right[index]);
  const multiply = (vector, scalar) => vector.map((coordinate) => coordinate * scalar);
  const mix = (left, right, amount) => left.map((coordinate, index) => (
    coordinate + (right[index] - coordinate) * amount
  ));
  const cross = (left, right) => [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
  const cubic = (p0, p1, p2, p3, amount) => {
    const inverse = 1 - amount;
    const position = [0, 1, 2].map((index) => (
      inverse ** 3 * p0[index]
      + 3 * inverse ** 2 * amount * p1[index]
      + 3 * inverse * amount ** 2 * p2[index]
      + amount ** 3 * p3[index]
    ));
    const tangent = normalizedVector3([0, 1, 2].map((index) => (
      3 * inverse ** 2 * (p1[index] - p0[index])
      + 6 * inverse * amount * (p2[index] - p1[index])
      + 3 * amount ** 2 * (p3[index] - p2[index])
    )), subtract(p3, p0));
    return { position, tangent };
  };
  const rotateAroundAxis = (vector, axis, radians) => {
    const local = normalizedVector3(vector, [0, 1, 0]);
    const normalizedAxis = normalizedVector3(axis, [0, 0, 1]);
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const dot = local.reduce((total, coordinate, index) => (
      total + coordinate * normalizedAxis[index]
    ), 0);
    const axisCrossVector = cross(normalizedAxis, local);
    return normalizedVector3(local.map((coordinate, index) => (
      coordinate * cosine
      + axisCrossVector[index] * sine
      + normalizedAxis[index] * dot * (1 - cosine)
    )), local);
  };

  const start = [0, 1, 2].map((index) => Number(from?.[index]) || 0);
  const target = [0, 1, 2].map((index) => Number(to?.[index]) || 0);
  const suppliedDepartureCenter = [0, 1, 2].map((index) => Number(departureCenter?.[index]) || 0);
  const suppliedLaunchNormal = normalizedVector3(
    [0, 1, 2].map((index) => Number(launchNormal?.[index]) || 0),
    [0, 1, 0]
  );
  const suppliedArrivalNormal = normalizedVector3(
    [0, 1, 2].map((index) => Number(arrivalNormal?.[index]) || 0),
    [0, 1, 0]
  );
  const inferredDestinationCenter = target.map((coordinate, index) => (
    coordinate - suppliedArrivalNormal[index] * Math.max(0.01, Number(destinationRadius) || PLANET_HUB_MOON_RADIUS_RATIO)
  ));
  const suppliedTargetCenter = Array.isArray(destinationCenter)
    ? [0, 1, 2].map((index) => Number(destinationCenter[index]) || 0)
    : inferredDestinationCenter;
  const collisionBodiesExplicit = Array.isArray(destinationCenter)
    && Number.isFinite(Number(departureRadius))
    && Number(departureRadius) > 0;

  // One canonical Earth-to-Moon route is sampled in reverse for the return.
  // This guarantees identical geometry, exact endpoints and an Earth capture
  // orbit on the way home instead of accidentally orbiting the Moon twice.
  const earthStart = returning ? target : start;
  const moonTarget = returning ? start : target;
  const earthCenter = returning ? suppliedTargetCenter : suppliedDepartureCenter;
  const moonCenter = returning ? suppliedDepartureCenter : suppliedTargetCenter;
  const earthNormal = returning ? suppliedArrivalNormal : suppliedLaunchNormal;
  const moonNormal = returning ? suppliedLaunchNormal : suppliedArrivalNormal;
  const suppliedDepartureRadius = Number(departureRadius);
  const physicalDepartureRadius = Number.isFinite(suppliedDepartureRadius) && suppliedDepartureRadius > 0
    ? suppliedDepartureRadius
    : Math.max(0.08, Math.hypot(...subtract(start, suppliedDepartureCenter)));
  const physicalDestinationRadius = Math.max(0.08,
    Number(destinationRadius) || PLANET_HUB_MOON_RADIUS_RATIO);
  const earthRadius = returning ? physicalDestinationRadius : physicalDepartureRadius;
  const moonRadius = returning ? physicalDepartureRadius : physicalDestinationRadius;
  const suppliedLaunchVehicleHeight = Number(launchVehicleHeight);
  const suppliedArrivalVehicleHeight = Number(arrivalVehicleHeight);
  const startVehicleHeight = Number.isFinite(suppliedLaunchVehicleHeight) && suppliedLaunchVehicleHeight > 0
    ? suppliedLaunchVehicleHeight
    : (Number.isFinite(suppliedArrivalVehicleHeight) && suppliedArrivalVehicleHeight > 0
      ? suppliedArrivalVehicleHeight
      : 0.32);
  const endVehicleHeight = Number.isFinite(suppliedArrivalVehicleHeight) && suppliedArrivalVehicleHeight > 0
    ? suppliedArrivalVehicleHeight
    : startVehicleHeight;
  const radiusRatio = Math.max(0.02, Math.min(0.42,
    Number(vehicleRadiusRatio) || PLANET_HUB_JOURNEY_VEHICLE_RADIUS_RATIO));
  const requiredBodyClearance = Math.max(0, Number(minimumBodyClearance) || 0);
  const liftDistance = Math.max(0.12, earthRadius * Math.max(0.18, Number(launchLiftHeight) || 0.35));
  const liftTop = add(earthStart, multiply(earthNormal, liftDistance));
  const orbitRadius = Math.max(earthRadius + liftDistance,
    Math.hypot(...subtract(liftTop, earthCenter)),
    earthRadius + Math.max(startVehicleHeight, endVehicleHeight) * radiusRatio + requiredBodyClearance);
  const systemDirection = normalizedVector3(subtract(moonCenter, earthCenter), [1, 0, 0]);
  let orbitAxis = cross(earthNormal, systemDirection);
  if (Math.hypot(...orbitAxis) <= 1e-6) {
    orbitAxis = cross(earthNormal, Math.abs(earthNormal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  }
  orbitAxis = normalizedVector3(orbitAxis, [0, 0, 1]);
  const orbitSweep = Math.max(Math.PI * (80 / 180),
    Math.min(Math.PI * (110 / 180), Number(preOrbitRadians) || PLANET_HUB_JOURNEY_HERO_ARC_RADIANS));
  const orbitEntryAngle = 0.22;
  const orbitEntryDirection = rotateAroundAxis(earthNormal, orbitAxis, orbitEntryAngle);
  const orbitEntry = add(earthCenter, multiply(orbitEntryDirection, orbitRadius));
  const orbitEntryTangent = normalizedVector3(cross(orbitAxis, orbitEntryDirection), systemDirection);
  const craneDistance = Math.max(0.08, earthRadius * 0.16);
  const crane = cubic(
    liftTop,
    add(liftTop, multiply(earthNormal, craneDistance)),
    subtract(orbitEntry, multiply(orbitEntryTangent, craneDistance)),
    orbitEntry,
    segmentProgress(canonicalValue, liftEnd, craneEnd)
  );
  const orbitAmount = segmentProgress(canonicalValue, craneEnd, orbitEnd);
  const orbitDirection = rotateAroundAxis(orbitEntryDirection, orbitAxis, orbitSweep * orbitAmount);
  const orbitPosition = add(earthCenter, multiply(orbitDirection, orbitRadius));
  const orbitTangent = normalizedVector3(cross(orbitAxis, orbitDirection), orbitEntryTangent);
  const orbitExit = add(earthCenter, multiply(
    rotateAroundAxis(orbitEntryDirection, orbitAxis, orbitSweep),
    orbitRadius
  ));
  const orbitExitTangent = normalizedVector3(cross(
    orbitAxis,
    rotateAroundAxis(orbitEntryDirection, orbitAxis, orbitSweep)
  ), orbitEntryTangent);
  const approachFarHeight = Math.max(0.34, moonRadius * 1.35);
  const canonicalMoonVehicleHeight = returning ? startVehicleHeight : endVehicleHeight;
  const descentHeight = Number.isFinite(canonicalMoonVehicleHeight) && canonicalMoonVehicleHeight > 0
    ? Math.max(0.045, Math.min(moonRadius * 0.72, canonicalMoonVehicleHeight * 1.18))
    : Math.max(0.18, moonRadius * 0.72);
  const approachFar = add(moonTarget, multiply(moonNormal, approachFarHeight));
  const descentStart = add(moonTarget, multiply(moonNormal, descentHeight));
  const transferDistance = Math.max(0.4, Math.hypot(...subtract(approachFar, orbitExit)));
  const routeScale = Math.max(1, Math.min(1.35, Number(routeStretch) || 1));
  const transferLaunchReach = Math.max(0.22, Math.min(1.25, transferDistance * 0.24 * routeScale));
  const transferArrivalReach = Math.max(0.16, Math.min(0.9, transferDistance * 0.18));
  const transfer = cubic(
    orbitExit,
    add(orbitExit, multiply(orbitExitTangent, transferLaunchReach)),
    add(approachFar, multiply(moonNormal, transferArrivalReach)),
    approachFar,
    segmentProgress(canonicalValue, orbitEnd, transferEnd)
  );
  const approachAmount = smootherstep(segmentProgress(canonicalValue, transferEnd, approachEnd));
  const landingAmount = smootherstep(segmentProgress(canonicalValue, approachEnd, 1));

  let canonicalPosition = earthStart;
  let canonicalTangent = earthNormal;
  let canonicalPhase = "lift";
  if (canonicalValue <= liftEnd) {
    canonicalPosition = mix(earthStart, liftTop, smootherstep(segmentProgress(canonicalValue, 0, liftEnd)));
  } else if (canonicalValue <= craneEnd) {
    canonicalPosition = crane.position;
    canonicalTangent = crane.tangent;
    canonicalPhase = "crane";
  } else if (canonicalValue <= orbitEnd) {
    canonicalPosition = orbitPosition;
    canonicalTangent = orbitTangent;
    canonicalPhase = "orbit";
  } else if (canonicalValue <= transferEnd) {
    canonicalPosition = transfer.position;
    canonicalTangent = transfer.tangent;
    canonicalPhase = "transfer";
  } else if (canonicalValue <= approachEnd) {
    canonicalPosition = mix(approachFar, descentStart, approachAmount);
    canonicalTangent = multiply(moonNormal, -1);
    canonicalPhase = "approach";
  } else {
    canonicalPosition = mix(descentStart, moonTarget, landingAmount);
    canonicalTangent = multiply(moonNormal, -1);
    canonicalPhase = "landing";
  }

  const tangent = Object.freeze(returning
    ? canonicalTangent.map((coordinate) => -coordinate)
    : canonicalTangent);
  const travel = value;
  const launchOutward = returning ? moonNormal : earthNormal;
  const arrivalOutward = returning ? earthNormal : moonNormal;
  const landingBlendInput = segmentProgress(value, transferEnd, approachEnd);
  let orientation = tangent;
  if (value <= liftEnd) orientation = Object.freeze(launchOutward);
  else if (value >= approachEnd) orientation = Object.freeze(arrivalOutward);
  else if (value >= transferEnd) {
    orientation = calculatePlanetHubJourneyRocketUp({
      tangent,
      landingNormal: arrivalOutward,
      travel: landingBlendInput,
      landingBlendStart: 0,
      landingBlendEnd: 1
    });
  }
  const canonicalScaleInput = smoothstep(segmentProgress(canonicalValue, orbitEnd, transferEnd));
  const scaleProgress = returning ? 1 - canonicalScaleInput : canonicalScaleInput;
  const currentVehicleHeight = startVehicleHeight
    + (endVehicleHeight - startVehicleHeight) * scaleProgress;
  const currentVehicleRadius = currentVehicleHeight * radiusRatio;
  let safePosition = [...canonicalPosition];
  // Resolve against both celestial bodies twice. The worlds are well separated,
  // so the second pass is normally a no-op; it makes the guarantee explicit if
  // future authored distances or vehicle scales bring the envelopes closer.
  for (let pass = 0; collisionBodiesExplicit && pass < 2; pass += 1) {
    safePosition = [...constrainPlanetHubVehicleOutsideSphere({
      position: safePosition,
      orientation,
      vehicleHeight: currentVehicleHeight,
      vehicleRadius: currentVehicleRadius,
      center: earthCenter,
      sphereRadius: earthRadius,
      minimumClearance: requiredBodyClearance
    }).position];
    safePosition = [...constrainPlanetHubVehicleOutsideSphere({
      position: safePosition,
      orientation,
      vehicleHeight: currentVehicleHeight,
      vehicleRadius: currentVehicleRadius,
      center: moonCenter,
      sphereRadius: moonRadius,
      minimumClearance: requiredBodyClearance
    }).position];
  }
  const earthClearance = calculatePlanetHubVehicleSphereClearance({
    position: safePosition,
    orientation,
    vehicleHeight: currentVehicleHeight,
    vehicleRadius: currentVehicleRadius,
    center: earthCenter,
    sphereRadius: earthRadius
  });
  const moonClearance = calculatePlanetHubVehicleSphereClearance({
    position: safePosition,
    orientation,
    vehicleHeight: currentVehicleHeight,
    vehicleRadius: currentVehicleRadius,
    center: moonCenter,
    sphereRadius: moonRadius
  });
  const phase = value < ignitionPortion
    ? "ignition"
    : value <= liftEnd ? "lift"
      : value >= approachEnd ? "landing"
        : value >= transferEnd ? "approach"
          : canonicalPhase;
  return Object.freeze({
    position: Object.freeze(safePosition),
    tangent,
    orientation,
    arrivalNormal: Object.freeze(arrivalOutward),
    travel,
    phase,
    ignition: value < ignitionPortion,
    scaleProgress,
    scale: 1 - scaleProgress * 0.82,
    vehicleHeight: currentVehicleHeight,
    vehicleRadius: currentVehicleRadius,
    clearance: Object.freeze({
      earth: earthClearance.clearance,
      moon: moonClearance.clearance,
      minimum: Math.min(earthClearance.clearance, moonClearance.clearance),
      required: requiredBodyClearance
    })
  });
}

export function calculatePlanetHubJourneyCameraPose({
  rocketPosition = [0, 0, 0],
  tangent = [0, 1, 0],
  moonPosition = [0, 0, 0],
  destinationCenter = moonPosition,
  destinationRadius = PLANET_HUB_MOON_RADIUS_RATIO,
  earthCenter = null,
  earthRadius = 1,
  landingNormal = null,
  landingPosition = null,
  launchNormal = null,
  flightPhase = null,
  transportedFrame = null,
  landingCameraFrame = null,
  landingCameraStartPose = null,
  landingFacade = null,
  stableUp = [0, 1, 0],
  routePhase = null,
  orbitCenter = null,
  vehicleScaleRatio = 1,
  vehicleHeight = null,
  arrivalVehicleHeight = null,
  verticalFovDegrees = 28,
  aspect = 16 / 9,
  elapsedMs = null,
  durationMs = PLANET_HUB_JOURNEY_DURATION_MS,
  journeyDirection = "outbound",
  progress = 0,
  cameraStartPosition = [0, 0.08, 4.5],
  cameraStartTarget = [0, 0, 0],
  cameraStartUp = [0, 1, 0],
  ignitionShare = 0.2,
  launchViewHoldShare = PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS / PLANET_HUB_JOURNEY_DURATION_MS,
  followBlendShare = 0.24,
  chaseDistance = 2.6,
  chaseLift = 0.12,
  chaseSide = 0.24,
  reducedMotion = false
} = {}) {
  const vector = (value, fallback) => [0, 1, 2]
    .map((index) => Number(value?.[index]))
    .map((coordinate, index) => Number.isFinite(coordinate) ? coordinate : fallback[index]);
  const normalize = (value, fallback = [0, 1, 0]) => {
    const length = Math.hypot(...value);
    if (length > 1e-8) return value.map((coordinate) => coordinate / length);
    const fallbackLength = Math.hypot(...fallback) || 1;
    return fallback.map((coordinate) => coordinate / fallbackLength);
  };
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  const dot = (a, b) => a.reduce((total, coordinate, index) => total + coordinate * b[index], 0);
  const add = (a, b) => a.map((coordinate, index) => coordinate + b[index]);
  const subtract = (a, b) => a.map((coordinate, index) => coordinate - b[index]);
  const multiply = (value, scalar) => value.map((coordinate) => coordinate * scalar);
  const mix = (from, to, amount) => from.map((coordinate, index) => coordinate + (to[index] - coordinate) * amount);
  const smootherstep = (input) => {
    const bounded = Math.max(0, Math.min(1, input));
    return bounded ** 3 * (bounded * (bounded * 6 - 15) + 10);
  };
  const smoothstep = (input) => {
    const bounded = Math.max(0, Math.min(1, input));
    return bounded * bounded * (3 - 2 * bounded);
  };
  const segment = (value, start, end) => Math.max(0, Math.min(1,
    (value - start) / Math.max(1e-8, end - start)
  ));
  const projectUp = (up, view, fallback) => {
    const projected = subtract(up, multiply(view, dot(up, view)));
    return normalize(projected, fallback);
  };
  const mixPose = (from, to, amount) => ({
    position: mix(from.position, to.position, amount),
    target: mix(from.target, to.target, amount),
    up: normalize(mix(from.up, to.up, amount), to.up)
  });
  const rocket = vector(rocketPosition, [0, 0, 0]);
  const moon = vector(destinationCenter, vector(moonPosition, rocket));
  const direction = normalize(vector(tangent, [0, 1, 0]));
  const towardMoon = normalize(subtract(moon, rocket), direction);
  const startPosition = vector(cameraStartPosition, [0, 0.08, 4.5]);
  const startTarget = vector(cameraStartTarget, [0, 0, 0]);
  const startUp = normalize(vector(cameraStartUp, [0, 1, 0]), [0, 1, 0]);
  const worldUp = normalize(vector(stableUp, startUp), startUp);
  const activeTransportFrame = flightPhase?.name === "landing" && landingCameraFrame
    ? landingCameraFrame
    : transportedFrame;
  const preferredFacade = activeTransportFrame?.facade || [0, 1, 0];
  const chaseFrame = calculatePlanetHubTransportedFrame({
    forward: direction,
    previousFrame: activeTransportFrame,
    preferredFacade
  });
  const fallbackFacade = chaseFrame.facade;
  let stableSide = normalize(cross(direction, worldUp), chaseFrame.side);
  if (dot(stableSide, chaseFrame.side) < 0) stableSide = stableSide.map((coordinate) => -coordinate);
  const value = Math.max(0, Math.min(1, Number(progress) || 0));
  const duration = Math.max(1, Number(durationMs) || PLANET_HUB_JOURNEY_DURATION_MS);
  const elapsed = elapsedMs == null
    ? value * duration
    : Math.max(0, Math.min(duration, Number(elapsedMs) || 0));
  const returning = String(journeyDirection).toLowerCase() === "return";
  const fovRadians = Math.max(8, Math.min(100, Number(verticalFovDegrees) || 28)) * Math.PI / 180;
  const safeAspect = Math.max(0.35, Number(aspect) || 1);
  const horizontalFov = 2 * Math.atan(Math.tan(fovRadians / 2) * safeAspect);
  const minimumFov = Math.min(fovRadians, horizontalFov);
  const fallbackHeight = Math.max(0.08, Math.min(2.4,
    (Number(vehicleScaleRatio) || 1) * 0.32));
  const rocketHeight = Math.max(0.035, Number(vehicleHeight) || fallbackHeight);
  const landingRocketHeight = Math.max(0.035, Number(arrivalVehicleHeight) || rocketHeight);
  const fitDistance = (height, viewportFraction) => (
    Math.max(0.035, height)
      / Math.max(0.04, 2 * Math.tan(fovRadians / 2) * Math.max(0.1, viewportFraction))
  );

  // Camera motion owns an independent two-second grounded composition. Its
  // position is genuinely planted; only the gaze eases upward with the ship.
  const ignitionPortion = Math.max(0, Math.min(0.8, Number(ignitionShare) || 0));
  const holdPortion = Math.max(ignitionPortion, Math.min(0.9,
    Number(launchViewHoldShare) || ignitionPortion));
  const holdMs = Math.max(1, Math.min(duration, holdPortion * duration));
  const launchOutward = normalize(
    launchNormal ? vector(launchNormal, startUp) : startUp,
    startUp
  );
  const launchTrack = smootherstep(elapsed / holdMs);
  const launchAim = add(rocket, multiply(launchOutward, rocketHeight * 0.45));
  const launchPose = {
    position: startPosition,
    // Keep the pad and horizon in the grounded composition. A small gaze rise
    // follows liftoff, but the camera does not abandon the launch site before
    // the authored chase shot takes over.
    // Pan far enough to retain the complete rocket as it clears the tower,
    // while leaving the departure pad and planetary horizon in frame. The
    // previous shallow gaze rise preserved the pad but let the nose clip the top
    // edge on a 16:9 stage before the chase camera took ownership.
    target: mix(startTarget, launchAim, launchTrack * 0.90),
    up: startUp
  };

  const orbitOrigin = vector(earthCenter || orbitCenter, [0, 0, 0]);
  const radialOffset = subtract(rocket, orbitOrigin);
  const radialDistance = Math.max(0.01, Math.hypot(...radialOffset));
  const orbitRadial = normalize(radialOffset, launchOutward);
  // radial x tangent is the route's fixed orbit-plane normal. Do not reorient
  // it against a launch-time up vector: that dot product passes through zero
  // on the far hemisphere and used to flip the complete screen basis.
  const orbitAxis = normalize(cross(orbitRadial, direction), chaseFrame.side);
  const orbitView = normalize(add(add(
    multiply(orbitRadial, 0.84),
    multiply(direction, -0.30)
  ), multiply(orbitAxis, 0.10)), orbitRadial);
  const bodyDistance = Math.max(0,
    Math.max(0.01, Number(earthRadius) || 1)
      / Math.max(0.06, Math.sin(minimumFov * 0.42))
      - radialDistance);
  const orbitDistance = Math.max(0.8, fitDistance(rocketHeight, 0.22), bodyDistance);
  const orbitPosition = add(rocket, multiply(orbitView, orbitDistance));
  const safeOrbitPosition = constrainPlanetHubCameraOutsideSphere({
    position: orbitPosition,
    center: orbitOrigin,
    radius: Math.max(0.01, Number(earthRadius) || 1),
    surfaceNormal: orbitRadial,
    clearance: Math.max(0.08, rocketHeight * 0.2),
    minimumHemisphere: 0
  });
  const orbitPose = {
    position: safeOrbitPosition,
    target: add(add(rocket, multiply(direction, rocketHeight * 0.42)),
      multiply(orbitRadial, -rocketHeight * 0.08)),
    up: projectUp(orbitAxis, orbitView, worldUp)
  };

  const transportedFacade = normalize(vector(chaseFrame.facade, fallbackFacade), fallbackFacade);
  const transportedSide = normalize(vector(chaseFrame.side, stableSide), stableSide);
  let transferFacade;
  let transferUp;
  let transferView;
  if (returning) {
    // At lunar departure the route tangent begins exactly parallel to the
    // launch normal. Re-projecting the facade against Earth's radial vector
    // and conditionally flipping cross(tangent, facade) crosses a zero sign as
    // the transfer curve starts; that produced a near-180-degree camera roll
    // and a visible position snap around the three-second boundary. The
    // transported frame already carries the only continuous orientation we
    // need. Keep its facade, and keep the rocket's nose projected upright in
    // the view, so Moon-to-Earth departure has no frame-dependent sign choice.
    transferFacade = transportedFacade;
    transferView = normalize(add(add(
      multiply(transferFacade, 0.82),
      multiply(direction, -0.28)
    ), multiply(transportedSide, 0.08)), transferFacade);
    // Keep lunar launch "up" as the return camera's roll reference. The route
    // tangent bends sharply as it leaves the radial ascent; using that tangent
    // as camera-up transferred the bend directly into a 300deg/s screen roll.
    // Projecting the stable launch normal into the view plane retains a level
    // horizon while the transported facade still owns the chase direction.
    const returnUpSeed = normalize(add(
      multiply(worldUp, 0.96),
      multiply(transportedSide, -0.04)
    ), worldUp);
    transferUp = projectUp(returnUpSeed, transferView, transportedSide);
  } else {
    const tangentFacade = subtract(
      transportedFacade,
      multiply(orbitRadial, dot(transportedFacade, orbitRadial))
    );
    transferFacade = normalize(tangentFacade, chaseFrame.side);
    transferUp = normalize(cross(direction, transferFacade), chaseFrame.side);
    if (dot(transferUp, worldUp) < 0) transferUp = multiply(transferUp, -1);
    transferView = normalize(add(add(
      multiply(transferFacade, 0.70),
      multiply(orbitRadial, 0.46)
    ), add(multiply(direction, -0.30), multiply(transferUp, 0.12))), transferFacade);
  }
  const transferDistance = Math.max(0.72, fitDistance(rocketHeight, 0.29));
  let transferCameraPosition = add(rocket, multiply(transferView, transferDistance));
  transferCameraPosition = constrainPlanetHubCameraOutsideSphere({
    position: transferCameraPosition,
    center: orbitOrigin,
    radius: Math.max(0.01, Number(earthRadius) || 1),
    surfaceNormal: orbitRadial,
    clearance: Math.max(0.1, rocketHeight * 0.24),
    minimumHemisphere: 0
  });
  const transferPose = {
    position: transferCameraPosition,
    target: add(add(rocket, multiply(direction, rocketHeight * 0.55)),
      multiply(transferUp, rocketHeight * 0.12)),
    up: projectUp(transferUp, transferView, worldUp)
  };
  // The return starts from a close lunar ground composition whose view axis is
  // intentionally very different from the transported transfer rig. Spread
  // that move across the complete lunar escape: the camera cranes first, then
  // its private tangent catches the physical route before Earth capture.
  const returnHandoff = smoothstep(segment(
    elapsed,
    holdMs,
    PLANET_HUB_JOURNEY_RETURN_HANDOFF_END_MS
  ));
  const returnCaptureStartMs = PLANET_HUB_JOURNEY_RETURN_TRANSFER_END_MS;
  const returnCaptureEndMs = Math.min(
    PLANET_HUB_JOURNEY_DURATION_MS - PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS,
    returnCaptureStartMs + 400
  );
  const returnLandingStartMs = PLANET_HUB_JOURNEY_DURATION_MS
    - PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS;

  const surfaceNormal = normalize(
    landingNormal
      ? vector(landingNormal, towardMoon)
      : subtract(vector(landingPosition, moon), moon),
    towardMoon.map((coordinate) => -coordinate)
  );
  const radius = Math.max(0.01, Number(destinationRadius) || PLANET_HUB_MOON_RADIUS_RATIO);
  const touchdown = landingPosition
    ? vector(landingPosition, rocket)
    : add(moon, multiply(surfaceNormal, radius));
  const landingFrame = landingCameraFrame || chaseFrame;
  const landingFacadeSeed = normalize(
    landingFacade ? vector(landingFacade, fallbackFacade) : vector(landingFrame?.facade, fallbackFacade),
    fallbackFacade
  );
  const facadeNormalDot = dot(landingFacadeSeed, surfaceNormal);
  const landingFacadeVector = normalize(subtract(
    landingFacadeSeed,
    multiply(surfaceNormal, facadeNormalDot)
  ), fallbackFacade);
  const landingSide = normalize(cross(surfaceNormal, landingFacadeVector), stableSide);
  // The locked landing shot is a close, elevated three-quarter view of the
  // vehicle and pad. The old grazing-angle body-wide shot hid the platform
  // behind the destination horizon and made the rocket read as a tiny marker.
  const landingSpan = landingRocketHeight * 2.4;
  const landingAim = add(touchdown, multiply(surfaceNormal, landingRocketHeight * 1.08));
  const landingView = normalize(add(add(
    multiply(landingFacadeVector, 0.78),
    multiply(landingSide, 0.12)
  ), multiply(surfaceNormal, 0.60)), landingFacadeVector);
  const landingDistance = Math.max(
    fitDistance(landingSpan, 0.66),
    landingRocketHeight * 2.8,
    radius * 0.42,
    0.28
  );
  const landingDesiredPosition = add(landingAim, multiply(landingView, landingDistance));
  const safeLandingPosition = constrainPlanetHubCameraOutsideSphere({
    position: landingDesiredPosition,
    center: moon,
    radius,
    surfaceNormal,
    clearance: Math.max(0.06, landingRocketHeight * 0.28),
    minimumHemisphere: 0.08
  });
  const landingPose = {
    position: safeLandingPosition,
    target: landingAim,
    up: projectUp(surfaceNormal, landingView, landingSide)
  };

  let desiredPose;
  let cameraStage;
  if (elapsed <= holdMs) {
    desiredPose = launchPose;
    cameraStage = "ground-launch";
  } else if (!returning && elapsed < PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS) {
    desiredPose = mixPose(launchPose, orbitPose, smootherstep(segment(
      elapsed,
      holdMs,
      PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS
    )));
    cameraStage = "crane";
  } else if (!returning && elapsed <= PLANET_HUB_JOURNEY_OUTBOUND_ORBIT_END_MS) {
    desiredPose = orbitPose;
    cameraStage = "earth-orbit";
  } else if (!returning && elapsed < PLANET_HUB_JOURNEY_APPROACH_START_MS) {
    const handoff = smootherstep(segment(
      elapsed,
      PLANET_HUB_JOURNEY_OUTBOUND_ORBIT_END_MS,
      PLANET_HUB_JOURNEY_OUTBOUND_ORBIT_END_MS + 520
    ));
    desiredPose = mixPose(orbitPose, transferPose, handoff);
    cameraStage = "transfer";
  } else if (returning && elapsed < PLANET_HUB_JOURNEY_RETURN_HANDOFF_END_MS) {
    desiredPose = mixPose(launchPose, transferPose, returnHandoff);
    cameraStage = "lunar-departure";
  } else if (returning && elapsed < returnCaptureStartMs) {
    desiredPose = transferPose;
    cameraStage = "transfer";
  } else if (returning && elapsed < returnCaptureEndMs) {
    desiredPose = mixPose(transferPose, orbitPose, smootherstep(segment(
      elapsed,
      returnCaptureStartMs,
      returnCaptureEndMs
    )));
    cameraStage = "earth-capture";
  } else if (returning && elapsed < returnLandingStartMs) {
    desiredPose = orbitPose;
    cameraStage = "earth-orbit";
  } else {
    const landingStartMs = returning ? returnLandingStartMs : PLANET_HUB_JOURNEY_APPROACH_START_MS;
    const landingEndMs = PLANET_HUB_JOURNEY_LANDING_START_MS;
    const landingBlend = reducedMotion
      ? 1
      : smootherstep(segment(elapsed, landingStartMs, landingEndMs));
    const landingStartPosition = landingCameraStartPose?.position
      ? vector(landingCameraStartPose.position, transferPose.position)
      : transferPose.position;
    const landingStartTarget = landingCameraStartPose?.target
      ? vector(landingCameraStartPose.target, transferPose.target)
      : transferPose.target;
    const landingStartUp = landingCameraStartPose?.up
      ? normalize(vector(landingCameraStartPose.up, transferPose.up), transferPose.up)
      : transferPose.up;
    desiredPose = mixPose({
      position: landingStartPosition,
      target: landingStartTarget,
      up: landingStartUp
    }, landingPose, landingBlend);
    cameraStage = elapsed >= landingEndMs ? "landing-locked" : "landing-settle";
    desiredPose.landingBlend = landingBlend;
  }

  const follow = elapsed <= holdMs
    ? 0
    : smootherstep(segment(elapsed, holdMs, returning
      ? PLANET_HUB_JOURNEY_RETURN_HANDOFF_END_MS
      : PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS));
  const phaseLandingBlend = Number(desiredPose.landingBlend || 0);
  return Object.freeze({
    position: Object.freeze([...desiredPose.position]),
    target: Object.freeze([...desiredPose.target]),
    up: Object.freeze(normalize(desiredPose.up, worldUp)),
    follow,
    landingBlend: phaseLandingBlend,
    stage: cameraStage,
    frame: chaseFrame
  });
}

export function calculatePlanetHubHoverFocus({
  level = 0,
  selected = false,
  focused = false,
  elapsedMs = 0,
  reducedMotion = false
} = {}) {
  const amount = Math.max(0, Math.min(1, Number(level) || 0));
  const pulse = reducedMotion
    ? 0.5
    : 0.5 + Math.sin(Math.max(0, Number(elapsedMs) || 0) * 0.0062) * 0.5;
  const channelLevel = (value) => typeof value === "boolean"
    ? (value ? 1 : 0)
    : Math.max(0, Math.min(1, Number(value) || 0));
  const selectedLevel = channelLevel(selected);
  const focusedLevel = channelLevel(focused);
  return Object.freeze({
    ringOpacity: amount * (0.5 + pulse * 0.16),
    haloOpacity: amount * (0.08 + pulse * 0.07),
    beaconOpacity: amount * (0.58 + pulse * 0.32),
    // Hover affordances remain hover-only. Selection and committed focus own
    // a stable three-point studio rig so the complete authored facade stays
    // readable without washing the whole planet in flat ambient light.
    // The overview selection must identify a destination even when its site
    // sits on the world's terminator. Put most of the studio key in the
    // selected channel, then add only the extra focus needed for the close-up;
    // this keeps focused shots near the previous ceiling without leaving the
    // Home landmark as a dark silhouette.
    lightIntensity: selectedLevel * 1.05
      + focusedLevel * 0.56
      + amount * (0.2 + pulse * 0.07),
    fillIntensity: selectedLevel * 0.28
      + focusedLevel * 0.12
      + amount * (0.08 + pulse * 0.03),
    rimIntensity: selectedLevel * 0.38
      + focusedLevel * 0.18
      + amount * (0.1 + pulse * 0.035),
    scale: 0.98 + amount * (0.02 + pulse * 0.055)
  });
}

export function createPlanetHubPlanetMaterial(THREE, source = {}, { role = "planet" } = {}) {
  if (!THREE?.MeshStandardMaterial) throw new TypeError("THREE.MeshStandardMaterial is required.");
  const profiles = {
    planet: { roughness: [0.72, 1, 0.86], metalness: [0, 0.08, 0.02], emissive: 0 },
    landmark: { roughness: [0.42, 0.9, 0.68], metalness: [0, 0.35, 0.08], emissive: 0.08 },
    vehicle: { roughness: [0.3, 0.72, 0.46], metalness: [0.08, 0.5, 0.24], emissive: 0.06 },
    luminous: { roughness: [0.68, 1, 0.9], metalness: [0, 0.04, 0], emissive: 0.9 }
  };
  const profile = profiles[role] || profiles.planet;
  const bounded = (value, [minimum, maximum, fallback]) => Number.isFinite(Number(value))
    ? Math.max(minimum, Math.min(maximum, Number(value)))
    : fallback;
  const roughness = bounded(source.roughness, profile.roughness);
  const metalness = bounded(source.metalness, profile.metalness);
  const preserveEmissive = role !== "planet" && profile.emissive > 0;
  const sourceEmissive = preserveEmissive
    ? (source.emissive?.clone?.() || source.emissive || 0xffffff)
    : 0x000000;
  const sourceEmissiveIntensity = preserveEmissive
    ? Math.max(0, Math.min(profile.emissive, Number(source.emissiveIntensity) || 0))
    : 0;
  const material = new THREE.MeshStandardMaterial({
    name: source.name ? `${source.name}-planet-hub` : "planet-hub-surface",
    color: source.color?.clone?.() || source.color || 0xffffff,
    map: source.map || null,
    normalMap: source.normalMap || null,
    normalScale: source.normalScale?.clone?.() || source.normalScale,
    aoMap: source.aoMap || null,
    aoMapIntensity: Number.isFinite(Number(source.aoMapIntensity)) ? Number(source.aoMapIntensity) : 1,
    roughnessMap: source.roughnessMap || null,
    metalnessMap: source.metalnessMap || null,
    roughness,
    metalness,
    emissive: sourceEmissive,
    emissiveMap: preserveEmissive ? (source.emissiveMap || null) : null,
    emissiveIntensity: sourceEmissiveIntensity,
    transparent: role === "planet" ? false : Boolean(source.transparent),
    opacity: role === "planet" ? 1 : (Number.isFinite(Number(source.opacity)) ? Number(source.opacity) : 1),
    alphaTest: Number.isFinite(Number(source.alphaTest)) ? Number(source.alphaTest) : 0,
    depthTest: source.depthTest !== false,
    depthWrite: role === "planet" ? true : source.depthWrite !== false,
    side: source.side,
    vertexColors: Boolean(source.vertexColors),
    flatShading: Boolean(source.flatShading)
  });
  material.emissiveMap = preserveEmissive ? (source.emissiveMap || null) : null;
  material.toneMapped = true;
  material.userData ||= {};
  material.userData.planetHubNormalized = true;
  material.userData.planetHubMaterialRole = profiles[role] ? role : "planet";
  return material;
}

export function normalizePlanetHubMaterials(THREE, object, options = {}) {
  const replacements = new Map();
  const replace = (source) => {
    if (!source) return source;
    if (!replacements.has(source)) replacements.set(source, createPlanetHubPlanetMaterial(THREE, source, options));
    return replacements.get(source);
  };
  object?.traverse?.((child) => {
    if (!child?.isMesh || !child.material) return;
    child.material = Array.isArray(child.material)
      ? child.material.map(replace)
      : replace(child.material);
  });
  for (const source of replacements.keys()) source?.dispose?.();
  return object;
}

export function createPlanetHubNightLightsMaterial(THREE, texture, { opacity = 0 } = {}) {
  if (!THREE?.ShaderMaterial) throw new TypeError("THREE.ShaderMaterial is required.");
  return new THREE.ShaderMaterial({
    uniforms: {
      nightMap: { value: texture || null },
      sunDirection: { value: new THREE.Vector3(-0.45, 0.18, -0.87).normalize() },
      glowColor: { value: new THREE.Color(0xffc77d) },
      opacity: { value: Math.max(0, Math.min(1, Number(opacity) || 0)) }
    },
    vertexShader: `varying vec2 vUv;varying vec3 vWorldNormal;void main(){vUv=uv;vWorldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D nightMap;uniform vec3 sunDirection;uniform vec3 glowColor;uniform float opacity;varying vec2 vUv;varying vec3 vWorldNormal;void main(){vec3 signal=texture2D(nightMap,vUv).rgb;float energy=dot(signal,vec3(.2126,.7152,.0722));float solar=dot(normalize(vWorldNormal),normalize(sunDirection));float nightMask=1.-smoothstep(-.22,.24,solar);float alpha=smoothstep(.035,.36,energy)*nightMask*opacity;vec3 color=signal*glowColor*(1.15+energy*.85);gl_FragColor=vec4(color,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: true
  });
}

export function configurePlanetHubSurfaceTexture(THREE, texture, contract = {}, { color = false } = {}) {
  if (!texture) return texture;
  if (typeof contract.flipY === "boolean") texture.flipY = contract.flipY;
  const uvChannel = Number(contract.uvChannel);
  if (Number.isInteger(uvChannel) && uvChannel >= 0) texture.channel = uvChannel;
  if (THREE?.RepeatWrapping !== undefined) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createPlanetHubSunSurfaceMaterial(THREE, texture = null, { reducedMotion = false } = {}) {
  if (!THREE?.ShaderMaterial) throw new TypeError("THREE.ShaderMaterial is required.");
  return new THREE.ShaderMaterial({
    uniforms: {
      surfaceMap: { value: texture },
      hasSurfaceMap: { value: texture ? 1 : 0 },
      time: { value: 0 },
      motion: { value: reducedMotion ? 0 : 1 },
      modelOpacity: { value: 1 }
    },
    vertexShader: `varying vec2 vUv;varying vec3 vWorldNormal;varying vec3 vView;void main(){vUv=uv;vec4 worldPosition=modelMatrix*vec4(position,1.);vWorldNormal=normalize(mat3(modelMatrix)*normal);vView=normalize(cameraPosition-worldPosition.xyz);gl_Position=projectionMatrix*viewMatrix*worldPosition;}`,
      fragmentShader: `uniform sampler2D surfaceMap;uniform float hasSurfaceMap;uniform float time;uniform float motion;uniform float modelOpacity;varying vec2 vUv;varying vec3 vWorldNormal;varying vec3 vView;void main(){vec3 sampled=texture2D(surfaceMap,vUv).rgb;vec3 procedural=vec3(1.,.42,.05);vec3 surface=mix(procedural,sampled,hasSurfaceMap);float limb=pow(max(dot(normalize(vWorldNormal),normalize(vView)),0.),.24);float granule=sin(vUv.x*235.+time*.055)*sin(vUv.y*151.-time*.037);float convection=sin((vUv.x+vUv.y)*83.-time*.021);surface*=1.+(granule*.045+convection*.025)*motion;surface=mix(surface*1.02,vec3(1.05,.58,.1),clamp((1.-limb)*.18,0.,.22));surface=mix(surface,vec3(1.1,.72,.18),.06+limb*.08);gl_FragColor=vec4(surface,modelOpacity);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    toneMapped: true
  });
}

export const PACKED_PORTAL_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const PACKED_PORTAL_FRAGMENT_SHADER = `
  uniform sampler2D packedMap;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    vec2 colorUv = vec2(vUv.x * 0.5, vUv.y);
    vec2 matteUv = vec2(0.5 + vUv.x * 0.5, vUv.y);
    vec4 colorSample = texture2D(packedMap, colorUv);
    float alpha = texture2D(packedMap, matteUv).r * opacity;
    gl_FragColor = vec4(colorSample.rgb * alpha, alpha);
  }
`;

export const PLANET_HUB_ENGINE_PLUME_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;
  void main() {
    vUv = uv;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

export const PLANET_HUB_ENGINE_PLUME_FRAGMENT_SHADER = `
  uniform vec3 plumeColor;
  uniform vec3 plumeHotColor;
  uniform float plumeOpacity;
  uniform float plumeTime;
  uniform float plumeFlicker;
  uniform float plumeCore;
  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;
  void main() {
    // ConeGeometry maps the nozzle to vUv.y=1 and the open tail to vUv.y=0.
    // Fade the open end completely so exhaust reads as light and gas, not as
    // a flat translucent polygon attached to the rocket.
    float axial = pow(clamp(vUv.y, 0.0, 1.0), mix(0.58, 0.38, plumeCore));
    float tailFade = smoothstep(mix(0.12, 0.07, plumeCore), mix(0.43, 0.31, plumeCore), vUv.y);
    float phase = plumeTime * mix(8.5, 10.5, plumeCore);
    float broadWave = sin(vUv.y * 15.0 - phase + sin(vUv.x * 6.2831853) * 1.3);
    float fineWave = sin(vUv.y * 34.0 - phase * 1.37 + vUv.x * 12.5663706);
    float flickerEnvelope = 1.0 - smoothstep(0.72, 1.0, vUv.y);
    float turbulence = 1.0 + plumeFlicker * flickerEnvelope * (broadWave * 0.7 + fineWave * 0.3);
    // A view-facing falloff feathers the silhouette without another mesh,
    // texture, render pass, or overdraw-heavy particle system.
    float facing = abs(dot(normalize(vViewNormal), normalize(vViewDirection)));
    float edgeFeather = mix(0.06, 1.0, smoothstep(0.015, 0.52, facing));
    float alpha = plumeOpacity * axial * tailFade * edgeFeather * clamp(turbulence, 0.68, 1.22);
    vec3 color = mix(plumeColor, plumeHotColor, smoothstep(0.34, 0.94, vUv.y));
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export function createPlanetHubEnginePlumeMaterial(THREE, {
  color = 0x54dfff,
  hotColor = 0xfff3c4,
  opacity = 0,
  quality = "low",
  core = false,
  phase = 0
} = {}) {
  if (!THREE?.ShaderMaterial || !THREE?.Color) {
    throw new TypeError("THREE.ShaderMaterial and THREE.Color are required.");
  }
  const initialOpacity = Math.max(0, Math.min(1, Number(opacity) || 0));
  const flicker = quality === "standard"
    ? (core ? 0.1 : 0.16)
    : (core ? 0.055 : 0.08);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      plumeColor: { value: new THREE.Color(color) },
      plumeHotColor: { value: new THREE.Color(hotColor) },
      plumeOpacity: { value: initialOpacity },
      plumeTime: { value: Number(phase) || 0 },
      plumeFlicker: { value: flicker },
      plumeCore: { value: core ? 1 : 0 }
    },
    vertexShader: PLANET_HUB_ENGINE_PLUME_VERTEX_SHADER,
    fragmentShader: PLANET_HUB_ENGINE_PLUME_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false
  });
  material.opacity = initialOpacity;
  material.userData ||= {};
  material.userData.planetHubEnginePlume = true;
  material.userData.planetHubPlumePhase = Number(phase) || 0;
  return material;
}

export function updatePlanetHubEnginePlumeMaterial(material, {
  opacity = 0,
  timeMs = 0,
  reducedMotion = false
} = {}) {
  const uniforms = material?.uniforms;
  if (!uniforms?.plumeOpacity || !uniforms?.plumeTime) return false;
  const nextOpacity = Math.max(0, Math.min(1, Number(opacity) || 0));
  const phase = Number(material.userData?.planetHubPlumePhase) || 0;
  material.opacity = nextOpacity;
  uniforms.plumeOpacity.value = nextOpacity;
  uniforms.plumeTime.value = phase + (reducedMotion ? 0 : Math.max(0, Number(timeMs) || 0) * 0.001);
  return true;
}

export async function loadPlanetHubThree({
  importer = (specifier) => import(specifier),
  threeSpecifier = DEFAULT_PLANET_HUB_THREE_SPECIFIER,
  loaderUrl = DEFAULT_PLANET_HUB_GLTF_LOADER_URL
} = {}) {
  // The generated vendor module deliberately includes GLTFLoader in the same
  // graph as Three. Prefer that single canonical URL so route-specific base
  // paths (for example `/play/` locally versus a packaged directory) cannot
  // instantiate a second copy of Three under a different absolute URL. Keep
  // the tiny loader entry point as a compatibility fallback for injected or
  // independently hosted Three modules.
  const threeModule = await importer(threeSpecifier);
  const THREE = threeModule?.default || threeModule;
  let GLTFLoader = threeModule?.GLTFLoader || THREE?.GLTFLoader;
  if (typeof GLTFLoader !== "function") {
    const loaderModule = await importer(loaderUrl);
    GLTFLoader = loaderModule?.GLTFLoader || loaderModule?.default;
  }
  if (!THREE?.WebGLRenderer || typeof GLTFLoader !== "function") {
    throw new TypeError("The local Three.js vendor pack did not expose WebGLRenderer and GLTFLoader.");
  }
  return Object.freeze({ THREE, GLTFLoader });
}

function loadGltf(loader, url) {
  if (!url) return Promise.reject(new TypeError("A planet hub GLB URL is required."));
  if (typeof loader.loadAsync === "function") return loader.loadAsync(url);
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

function resolveUrl(value, baseUrl) {
  if (!value) return "";
  try { return new URL(value, baseUrl).href; } catch { return value; }
}

function applyTransform(THREE, object, asset) {
  const transform = typeof asset === "object" ? asset?.transform : null;
  const position = transform?.position;
  const rotation = transform?.rotation;
  const scale = transform?.scale;
  if (Array.isArray(position)) object.position.set(...position.slice(0, 3));
  if (Array.isArray(rotation)) object.rotation.set(...rotation.slice(0, 3));
  if (Array.isArray(scale)) object.scale.set(...scale.slice(0, 3));
  else if (Number.isFinite(Number(scale))) object.scale.setScalar(Number(scale));
  object.updateMatrix?.();
  return object;
}

function socketList(asset, name) {
  if (!asset || typeof asset !== "object") return [];
  const sockets = asset.sockets || {};
  const direct = sockets[name] ?? sockets[`${name}s`];
  if (Array.isArray(direct) && Array.isArray(direct[0])) return direct;
  if (Array.isArray(direct) && direct[0] && typeof direct[0] === "object") {
    return direct.map((socket) => socket?.position).filter(Array.isArray);
  }
  if (Array.isArray(direct)) return [direct];
  if (direct && Array.isArray(direct.position)) return [direct.position];
  if (Array.isArray(sockets) && name === "engine") {
    return sockets.filter((socket) => socket?.name?.toLowerCase?.().includes("engine"))
      .map((socket) => socket.position).filter(Array.isArray);
  }
  return [];
}

function setDestinationMetadata(object, destination) {
  object.userData ||= {};
  object.userData.planetHubDestination = destination;
  object.traverse?.((child) => {
    child.userData ||= {};
    child.userData.planetHubDestination = destination;
  });
}

function disposeObject(object) {
  object?.traverse?.((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose?.();
      }
      material.dispose?.();
    }
  });
}

export function createPackedPortalMaterial(THREE, texture, { opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      packedMap: { value: texture },
      opacity: { value: opacity }
    },
    vertexShader: PACKED_PORTAL_VERTEX_SHADER,
    fragmentShader: PACKED_PORTAL_FRAGMENT_SHADER,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending
  });
}

export async function createThreePlanetHubRenderer({
  canvas,
  manifest,
  worldId,
  quality,
  modules,
  availableDestinations = PLANET_HUB_DESTINATIONS,
  activeDestination = "forge",
  assetBaseUrl = globalThis.location?.href || "http://localhost/",
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  reducedMotion = false,
  effectsLevel = "full",
  onPhase = () => {},
  onSpaceState = () => {},
  onCenterDestination = () => {},
  onInteractionFrame = () => {},
  onViewChange = () => {},
  onAutoplayFailure = () => {}
} = {}) {
  const { THREE, GLTFLoader } = modules || {};
  if (!canvas || !THREE?.WebGLRenderer || typeof GLTFLoader !== "function") {
    throw new TypeError("Canvas and loaded Three.js modules are required.");
  }

  // Keep the wider solar atlas in its own lazy module so the close Earth Home
  // pays for it only after Three.js is already active. The computed URL keeps
  // release bundlers from folding this optional chart into the initial hub JS.
  const loadOptionalModule = (parts) => {
    const base = new URL(import.meta.url);
    const url = new URL(`./${parts.join("-")}.mjs`, base);
    // Service-worker lazy entries are versioned exact URLs. Carry the renderer
    // query to optional imports so a warmed atlas and Sun rig remain available
    // offline instead of silently bypassing the runtime cache.
    url.search = base.search;
    return import(url.href).catch(() => null);
  };
  const celestialAtlasModulePromise = loadOptionalModule(["celestial", "atlas", "runtime"]);
  const spaceEnvironmentModulePromise = loadOptionalModule(["planet", "hub", "space"]);
  // Cinematic lens optics are progressive like the wider atlas. Keeping the
  // shader in a separate cached module protects the direct-manipulation core
  // budget while both requests begin in parallel with scene construction.
  const sunEffectsModulePromise = loadOptionalModule(["planet", "hub", "sun", "effects"]);
  let celestialCosmologyModulePromise = null;
  const loadCelestialCosmologyModule = () => {
    if (celestialCosmologyModulePromise) return celestialCosmologyModulePromise;
    celestialCosmologyModulePromise = loadOptionalModule(["celestial", "cosmology", "runtime"])
      .then((module) => {
        if (!module) celestialCosmologyModulePromise = null;
        return module;
      });
    return celestialCosmologyModulePromise;
  };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    // Home owns the entire viewport. An opaque framebuffer avoids dark alpha
    // islands when additive nebula/Sun passes are composited over the old DOM
    // backdrop, and is cheaper for the browser to present while the globe is
    // being dragged. CSS still crossfades the complete canvas to the poster on
    // loading or context loss.
    alpha: false,
    antialias: quality === "standard",
    powerPreference: quality === "standard" ? "high-performance" : "low-power"
  });
  renderer.setPixelRatio(capPlanetHubPixelRatio(windowRef?.devicePixelRatio || 1, quality));
  renderer.setClearColor?.(0x01060f, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const cinematicLighting = resolvePlanetHubCinematicLighting({ quality });
  renderer.toneMappingExposure = cinematicLighting.exposure;
  renderer.shadowMap.enabled = false;
  const homeOrbitRoot = canvas.closest?.("[data-home-orbit]") || null;
  const homeScreenRoot = canvas.closest?.("#startScreen") || null;

  const scene = new THREE.Scene();
  const cameraContract = manifest.posterCamera || {};
  const camera = new THREE.PerspectiveCamera(Number(cameraContract.perspectiveDegrees) || 28, 1, 0.05, 20);
  for (let layer = 3; layer < 3 + PLANET_HUB_DESTINATIONS.length; layer += 1) {
    camera.layers?.enable?.(layer);
  }
  const cameraPosition = new THREE.Vector3(...(Array.isArray(cameraContract.position) ? cameraContract.position.slice(0, 3) : [0, 0.08, 4.5]));
  const cameraTarget = new THREE.Vector3(...(Array.isArray(cameraContract.target) ? cameraContract.target.slice(0, 3) : [0, 0, 0]));
  const cameraDirection = cameraPosition.clone().sub(cameraTarget).normalize();
  const cameraFacing = cameraDirection.clone().normalize();
  const overviewPosition = new THREE.Vector3(0, 0, 0);
  const cameraBaseDistance = cameraPosition.distanceTo(cameraTarget);
  const cameraReferenceAspect = Math.max(0.01,
    (Number(cameraContract.width) || 1) / (Number(cameraContract.height) || 1));
  camera.position.copy(cameraPosition);
  camera.lookAt(cameraTarget);
  const celestialSystem = new THREE.Group();
  celestialSystem.name = `planet-hub-celestial-system-${worldId}`;
  scene.add(celestialSystem);
  // Close authored planets live in ordinary scene units. The physical atlas
  // is rebased by many orders of magnitude; parenting the close globe under
  // that scale-space root put the camera on/inside Earth at the Planet stop.
  const authoredCloseSystem = new THREE.Group();
  authoredCloseSystem.name = `planet-hub-authored-close-system-${worldId}`;
  scene.add(authoredCloseSystem);
  const world = new THREE.Group();
  world.name = `planet-hub-${worldId}`;
  authoredCloseSystem.add(world);

  // The distant Sun is the motivated key. Very restrained ambient and cool
  // fill preserve readable silhouettes without lifting every surface into the
  // same ACES-compressed midtone.
  const hemisphereLight = new THREE.HemisphereLight(0x8fbad0, 0x090713, cinematicLighting.hemisphere);
  hemisphereLight.name = "planet-hub-cinematic-hemisphere";
  scene.add(hemisphereLight);
  const ambientLight = new THREE.AmbientLight(0x6e8499, cinematicLighting.ambient);
  ambientLight.name = "planet-hub-cinematic-ambient";
  scene.add(ambientLight);
  const keyLight = new THREE.DirectionalLight(0xffe2b3, cinematicLighting.key);
  keyLight.position.set(-3, 4, 5);
  scene.add(keyLight);
  scene.add(keyLight.target);
  const fillLight = new THREE.DirectionalLight(0x6eb7d1, cinematicLighting.fill);
  fillLight.position.set(4, 1.5, 4);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0x7568c7, cinematicLighting.rim);
  rimLight.position.set(4, -1, -3);
  scene.add(rimLight);

  const loader = new GLTFLoader();
  const tier = manifest.worlds[worldId].tiers[quality];
  const anchors = createDestinationAnchors({ worldId });
  const interactiveRoots = [];
  const siteRoots = new Map();
  const landmarkModels = new Map();
  const landmarkMaterials = new Map();
  const hoverEffects = new Map();
  const roadRoots = [];
  const flameMeshes = [];
  const flameLights = [];
  const flameGlows = [];
  let portal = null;
  let portalVisible = false;
  let portalRequestedVisible = false;
  let suspended = false;
  let disposed = false;
  let viewportWidth = 1;
  let viewportHeight = 1;
  let frameRequest = 0;
  let transition = null;
  let pointerDragActive = false;
  let pointerDragLastAt = 0;
  let cameraOwner = "home-orbit";
  let cameraOrbitState = createPlanetHubCameraOrbitState({
    position: camera.position.toArray(),
    target: cameraTarget.toArray(),
    up: camera.up.toArray()
  });
  let orbitVelocity = { yaw: 0, pitch: 0 };
  let orbitRestYaw = reducedMotion ? 0 : PLANET_HUB_IDLE_YAW_SPEED;
  let orbitIdleState = { active: !reducedMotion, settledSince: null };
  let orbitIdleSuppressed = false;
  let orbitReleaseResponse = 8.5;
  let orbitCoastUntil = 0;
  let lastFrameAt = 0;
  let committedDestination = normalizePlanetHubDestination(activeDestination);
  let hubMode = "overview";
  let focusedDestination = null;
  let hoveredDestination = null;
  let hoveredAction = null;
  let frontDestination = committedDestination;
  let stableFrontDestination = committedDestination;
  let frontActivationState = { active: committedDestination, candidate: null, candidateSince: null, lastChangedAt: null };
  let availableSet = new Set(availableDestinations || []);
  let satelliteRoot = null;
  let satelliteModel = null;
  let moonJourneyPad = null;
  let moonJourneyDock = null;
  let moonJourneyPadMaterials = [];
  let moonJourneyPadLights = [];
  let satellitePickProxy = null;
  let satelliteHoverRing = null;
  let satelliteHoverHalo = null;
  let satelliteHoverLight = null;
  let satelliteHovered = false;
  let satelliteHoverLevel = 0;
  let orbitBodyId = worldId;
  let selectedBodyId = worldId;
  let satelliteOrbitStartedAt = windowRef?.performance?.now?.() || 0;
  const satelliteBaseScale = PLANET_HUB_MOON_RADIUS_RATIO;
  let sunRoot = null;
  let sunModel = null;
  let sunVisualRoot = null;
  let sunParticle = null;
  let sunParticleMaterial = null;
  let sunPickProxy = null;
  let sunEffects = null;
  let sunSystemLight = null;
  let sunSurfaceMaterial = null;
  let celestialAtlas = null;
  let celestialAtlasModule = null;
  let celestialRegistry = null;
  let celestialSemanticPresentation = null;
  let celestialCosmology = null;
  let celestialCosmologyModule = null;
  let celestialCosmologyPresentation = null;
  let celestialCosmologyLoadPromise = null;
  let sunPresentation = null;
  let sunLod = resolvePlanetHubSunLod();
  let sunEffectiveLod = Object.freeze({
    ...sunLod,
    particleOwner: "local"
  });
  let bodyFocusId = null;
  let bodyFocusCloseRadius = null;
  let bodyFocusDisplayScale = 1;
  let bodyFocusTransition = null;
  let bodySavedCameraOrbit = null;
  let bodySavedViewZoom = null;
  let placeFocusId = null;
  let placeFocusCloseRadius = null;
  let placeFocusDistanceRatio = 2.7;
  let selectedPlaceId = worldId;
  let placeSavedNavigationState = null;
  let pendingPlaceVisit = null;
  let pendingNavigationRestore = null;
  let pendingSegmentZoom = null;
  let navigationSelectBody = () => false;
  let navigationFocusBody = () => false;
  let navigationSetOrbitBody = () => false;
  let navigationSetViewZoom = () => false;
  let navigationSetCosmicZoom = () => false;
  let requestRenderAcrossConstruction = () => false;
  let bodyProjectionSnapshot = [];
  const bodyLabelElements = new Map();
  const bodyLabelLayer = canvas.parentElement?.querySelector?.("[data-planet-hub-label-layer]") || null;
  const sunStartedAt = windowRef?.performance?.now?.() || 0;
  let celestialLayout = calculatePlanetHubCelestialLayout({ aspect: 1 });
  let zoomBounds = calculatePlanetHubZoomBounds({
    baseRadius: cameraBaseDistance,
    verticalFovDegrees: camera.fov,
    aspect: 1,
    celestialExtent: calculatePlanetHubCelestialExtent({
      moonOrbitRadius: PLANET_HUB_MOON_ORBIT_RADIUS,
      moonRadius: PLANET_HUB_MOON_RADIUS_RATIO,
      sunPosition: celestialLayout.sunPosition,
      sunScale: celestialLayout.sunScale
    })
  });
  let canonicalFar = 448;
  let viewZoom = {
    progress: 0,
    targetProgress: 0,
    velocity: 0,
    band: "planet",
    source: "initial"
  };
  let cosmicZoom = {
    progress: 0,
    targetProgress: 0,
    velocity: 0,
    tier: "local-group",
    source: "initial"
  };
  let representedDistance = resolvePlanetHubRepresentedDistance(0);
  const chartBodyWorldPosition = new THREE.Vector3();
  const chartBodyWorldScale = new THREE.Vector3();
  const authoredHandoffPosition = new THREE.Vector3();
  const authoredHandoffScale = new THREE.Vector3();
  const authoredMaterialPresentationState = new Map();
  let authoredWorldHandoffMultiplier = 1;
  let zoomFocusPending = false;
  let ignitionUntil = 0;
  let ignitionBurstLevel = 0;
  let ignitionLevel = 0;
  let rocketHoverLevel = 0;
  let journeyRocket = null;
  let journeyRocketBoundsHeight = 1;
  let journeyDeparture = null;
  let journeyCrossfadePromise = null;
  let journeyRocketHeldForHandoff = false;
  let journeyCameraHeldForHandoff = false;
  let spaceEnvironment = null;
  let coreSceneReady = false;
  let spaceLayersScheduled = false;
  let surfaceCloudLayer = null;
  let planetSurfaceMaterial = null;
  let surfaceNightLayer = null;
  let surfaceSunEmissiveMap = null;
  // Space-environment setup can invalidate the renderer while the async GLTF
  // pipeline below is still yielding. Keep the atmosphere outside its temporal
  // dead zone so an early animation frame can safely render the loading scene.
  let atmosphereMaterial = null;
  const surfaceHookTextures = [];
  // Optional detail textures are streamed after the topology-safe base globe
  // is available. A generation token prevents a late image decode from
  // attaching GPU resources after Home has changed worlds or been destroyed.
  let surfaceHookLoadGeneration = 0;
  let currentEffectsLevel = ["full", "reduced", "off"].includes(effectsLevel) ? effectsLevel : "full";
  let moodState = resolvePlanetHubDestinationMood(committedDestination, {
    worldId,
    quality,
    effectsLevel: currentEffectsLevel,
    reducedMotion
  });
  let moodTransition = null;
  let moodTransitionPhases = null;

  function setJourneyFlightChrome(active) {
    for (const root of [homeOrbitRoot, homeScreenRoot]) {
      if (!root?.dataset) continue;
      if (active) root.dataset.planetHubJourneyFlight = "true";
      else delete root.dataset.planetHubJourneyFlight;
    }
  }

  function cloneCameraOrbitState(state = cameraOrbitState) {
    return createPlanetHubCameraOrbitState({
      ...calculatePlanetHubCameraOrbitPose(state),
      velocity: state?.velocity || orbitVelocity
    });
  }

  function setCameraOwner(owner = "home-orbit") {
    cameraOwner = ["home-orbit", "landmark-focus", "journey-flight", "journey-flight-held", "celestial-body-focus"]
      .includes(owner)
      ? owner
      : "home-orbit";
    canvas.dataset.planetHubCameraOwner = cameraOwner;
    return cameraOwner;
  }

  function resetOrbitIdle({ active = false, suppressed = orbitIdleSuppressed } = {}) {
    orbitIdleState = { active: Boolean(active && !reducedMotion), settledSince: null };
    orbitIdleSuppressed = Boolean(suppressed);
    orbitRestYaw = orbitIdleState.active ? PLANET_HUB_IDLE_YAW_SPEED : 0;
    return orbitIdleState;
  }

  function calculateHomeBaseCameraPose() {
    const distance = calculatePlanetHubCameraDistance({
      baseDistance: cameraBaseDistance,
      aspect: camera.aspect,
      referenceAspect: cameraReferenceAspect
    });
    return {
      position: cameraTarget.clone().addScaledVector(cameraDirection, distance),
      target: cameraTarget.clone(),
      up: new THREE.Vector3(0, 1, 0),
      distance
    };
  }

  function isCosmicZoomActive() {
    return cosmicZoom.progress > 1e-9 || cosmicZoom.targetProgress > 1e-9;
  }

  function syncScaleSpace(progress = viewZoom.progress, cosmicProgress = cosmicZoom.progress) {
    representedDistance = isCosmicZoomActive()
      ? resolvePlanetHubCosmicRepresentedDistance(cosmicProgress)
      : resolvePlanetHubRepresentedDistance(progress, zoomBounds);
    // The authored Earth/Moon are deliberately outside the AU/ly atlas root,
    // but they still share its precision rebase.  Without this reciprocal
    // scale, every eighth wheel pulse reset the camera dolly from ~3.58 to 1
    // while the close bodies stayed full size, producing the repeated
    // shrink/grow cycle between 12,742 km and the physical chart handoff.
    authoredCloseSystem.scale.setScalar(
      PLANET_HUB_DISTANCE_STOPS.planet / representedDistance.metersPerUnit
    );
    celestialSystem.scale.setScalar(
      PLANET_HUB_DISTANCE_STOPS.planet * zoomBounds.minRadius
        / representedDistance.metersPerUnit
    );
    authoredCloseSystem.updateMatrixWorld?.(true);
    celestialSystem.updateMatrixWorld?.(true);
    if (!activeNavigationFocusId()) {
      const frustum = resolvePlanetHubPrecisionFrustum({
        localDollyFactor: representedDistance.localDollyFactor,
        far: canonicalFar
      });
      camera.near = frustum.near;
      camera.far = frustum.far;
      camera.updateProjectionMatrix();
    }
    return representedDistance;
  }

  function renderCameraRadius(progress = viewZoom.progress, cosmicProgress = cosmicZoom.progress) {
    return zoomBounds.minRadius * syncScaleSpace(progress, cosmicProgress).localDollyFactor;
  }

  function isCelestialBodyVisibleInBand(id, band = viewZoom.band) {
    // The physical Sun is one continuous motivated light. Orbit remains
    // Earth/Moon-local by culling remote bodies, heliocentric orbit paths and
    // particulate belts below; hiding the Sun itself created a conspicuous
    // Planet -> Orbit disappearance and a second pop when System began.
    if (id === "sun") return true;
    if (band === "planet") return false;
    if (band !== "orbit") return true;
    const localFocusId = bodyFocusId || selectedBodyId || worldId;
    return id === localFocusId
      || celestialRegistry?.[id]?.parentId === localFocusId;
  }

  function isSolarAtlasDetailInteractive() {
    return (celestialSemanticPresentation?.solarDetailOpacity ?? 1) > 0.015;
  }

  function usesPhysicalSolarChart(progress = viewZoom.progress) {
    return physicalSolarChartBlend(progress) >= 1 - 1e-6;
  }

  function physicalSolarChartBlend(progress = viewZoom.progress) {
    const end = (PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit
      + PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system) * 0.5;
    // Five ordinary 1.2x wheel pulses let the physical proxy resolve beneath
    // the already-subpixel authored body.  The same distance window is used
    // inward and outward, so reversing the wheel cannot reveal a binary swap.
    const start = Math.max(PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit, end - 0.035);
    return smoothUnit((clampPlanetHubZoomProgress(progress) - start)
      / Math.max(1e-9, end - start));
  }

  function restoreAuthoredHandoffPresentation() {
    if (authoredWorldHandoffMultiplier !== 1) {
      world.scale.multiplyScalar(1 / authoredWorldHandoffMultiplier);
      authoredWorldHandoffMultiplier = 1;
    }
    for (const [material, state] of authoredMaterialPresentationState) {
      material.opacity = state.opacity;
      if (material.uniforms?.opacity) material.uniforms.opacity.value = state.uniformOpacity;
      if (material.transparent !== state.transparent) material.needsUpdate = true;
      material.transparent = state.transparent;
      material.depthWrite = state.depthWrite;
    }
  }

  function setAuthoredObjectOpacity(root, opacity) {
    const amount = Math.max(0, Math.min(1, Number(opacity) || 0));
    root?.traverse?.((child) => {
      for (const material of (Array.isArray(child.material) ? child.material : [child.material])) {
        if (!material) continue;
        const prior = authoredMaterialPresentationState.get(material);
        if (amount >= 0.999) {
          if (prior) authoredMaterialPresentationState.delete(material);
          continue;
        }
        const state = prior || {
          opacity: Number.isFinite(material.opacity) ? material.opacity : prior?.opacity ?? 1,
          uniformOpacity: Number.isFinite(material.uniforms?.opacity?.value)
            ? material.uniforms.opacity.value : prior?.uniformOpacity ?? 1,
          transparent: Boolean(material.transparent),
          depthWrite: material.depthWrite !== false
        };
        if (!prior) authoredMaterialPresentationState.set(material, state);
        material.opacity = state.opacity * amount;
        if (material.uniforms?.opacity) material.uniforms.opacity.value = state.uniformOpacity * amount;
        const transparent = state.transparent || amount < 0.999;
        if (material.transparent !== transparent) material.needsUpdate = true;
        material.transparent = transparent;
        material.depthWrite = state.depthWrite && amount >= 0.999;
      }
    });
  }

  function syncAuthoredProxyOpacity() {
    const solarOpacity = celestialSemanticPresentation?.solarDetailOpacity ?? 1;
    const handoff = calculatePlanetHubProxyHandoff({ blend: physicalSolarChartBlend() });
    setAuthoredObjectOpacity(world, solarOpacity * handoff.authoredOpacity);
    if (satelliteRoot && !journeyDeparture) {
      setAuthoredObjectOpacity(satelliteRoot, solarOpacity * handoff.authoredOpacity);
    }
    for (const id of new Set([worldId, satelliteRoot ? "moon" : null])) {
      if (id) celestialAtlas?.setBodyPresentationOpacity?.(id, solarOpacity * handoff.proxyOpacity);
    }
  }

  function syncSunPresentation(progress = viewZoom.progress) {
    sunPresentation = calculatePlanetHubSunPresentation({
      progress,
      atlasPosition: celestialAtlas?.layout?.positions?.sun || celestialLayout.sunPosition,
      chartRadius: celestialRegistry?.sun?.radius || 2.6
    });
    if (sunRoot) {
      sunRoot.position.fromArray(sunPresentation.position);
      sunRoot.scale.setScalar(sunPresentation.radius);
    }
    return sunPresentation;
  }

  function syncCelestialAtlasPresentation(band = viewZoom.band, progress = viewZoom.progress) {
    if (!celestialAtlas) return false;
    celestialSemanticPresentation = celestialAtlas.setSemanticTier?.({
      band,
      progress,
      distanceMeters: representedDistance.distanceMeters,
      metersPerUnit: representedDistance.metersPerUnit
    }) || celestialSemanticPresentation;
    if (celestialSemanticPresentation?.prewarmRoots?.milkyWay
      || celestialSemanticPresentation?.galaxyOpacity > 0) void ensureCelestialCosmology();
    // One native-style logarithmic plane owns every astronomical scale. The
    // atlas retains its legacy carrier only as an internal compatibility
    // object; allowing it to render would reintroduce the finite second grid
    // precisely when the stellar and Milky-Way layers arrive.
    if (celestialAtlas.galaxy?.gridRoot) celestialAtlas.galaxy.gridRoot.visible = false;
    if (celestialAtlas.galaxy?.grid) {
      celestialAtlas.galaxy.grid.visible = false;
      if (celestialAtlas.galaxy.grid.material) celestialAtlas.galaxy.grid.material.opacity = 0;
    }
    const solarDetailOpacity = celestialSemanticPresentation?.solarDetailOpacity ?? 1;
    const physicalChartBlend = physicalSolarChartBlend(progress);
    const authoredLocalVisible = solarDetailOpacity > 0.001 && physicalChartBlend < 1 - 1e-6;
    // The authored close globe carries landmarks and cinematic surface detail;
    // the physical atlas owns AU-scale navigation. Swapping only after the
    // bodies are chart-sized avoids keeping a double-scale Earth/Moon inside
    // the same coordinate system.
    world.visible = authoredLocalVisible;
    if (satelliteRoot && !journeyDeparture) satelliteRoot.visible = authoredLocalVisible;
    const chartVisible = band !== "planet";
    const localFocusId = bodyFocusId || selectedBodyId || worldId;
    const orbitOpacity = band === "orbit" ? 0.08
      : band === "system" || band === "galaxy" ? 0.24
        : band === "universe" ? 0.38 : 0;
    celestialAtlas.orbitRoot.visible = chartVisible;
    // Journey owns physical-Sun visibility while its authored flight is in
    // progress. Ordinary semantic zoom must never make the Sun disappear.
    if (sunRoot && !journeyDeparture) {
      sunRoot.visible = isCelestialBodyVisibleInBand("sun", band)
        && solarDetailOpacity > 0.015;
    }
    if (celestialAtlas.particulateField) {
      celestialAtlas.particulateField.visible = band !== "planet" && band !== "orbit";
    }
    for (const [id, orbit] of celestialAtlas.orbits) {
      const availableLift = celestialRegistry?.[id]?.available ? 1 : 0.72;
      orbit.material.opacity = orbitOpacity
        * (id === "moon" ? 1.35 : availableLift)
        * (celestialSemanticPresentation?.solarDetailOpacity ?? 1);
      const localOrbit = celestialRegistry?.[id]?.parentId === localFocusId;
      orbit.visible = orbit.material.opacity > 0.004 && (band !== "orbit" || localOrbit);
    }
    for (const [id, record] of celestialAtlas.bodies) {
      const authoredProxy = record.anchor.userData.planetHubAuthoredProxy;
      const physicalProxy = authoredProxy && id !== "sun" && physicalChartBlend > 0.001;
      const physicalVisible = solarDetailOpacity > 0.001
        && (physicalProxy || !authoredProxy)
        && (isCelestialBodyVisibleInBand(id, band)
          || id === bodyFocusId
          || id === selectedBodyId);
      record.visual.visible = physicalVisible;
      if (authoredProxy && id !== "sun") {
        celestialAtlas.setBodyPresentationOpacity?.(
          id,
          physicalVisible ? solarDetailOpacity * physicalChartBlend : 0
        );
      }
    }
    return true;
  }

  function syncCelestialCosmologyPresentation(progress = cosmicZoom.progress) {
    if (!celestialCosmology) return false;
    const active = isCosmicZoomActive();
    const cosmicOpacity = celestialCosmologyModule?.resolveCelestialCosmologyEntryOpacity?.({
      distanceMeters: representedDistance.distanceMeters
    }) ?? 0;
    const cosmicFade = 1 - cosmicOpacity;
    const prewarm = cosmicOpacity <= 0.001 && (active
      || Boolean(celestialSemanticPresentation?.prewarmRoots?.milkyWay
        || celestialSemanticPresentation?.galaxyOpacity > 0));
    celestialCosmology.root.visible = active || prewarm;
    // The Milky Way and Local Group interpenetrate over 204 kly-2.5 Mly.
    spaceEnvironment?.setWorldGridTransitionOpacity?.(cosmicFade);
    celestialAtlas?.setCosmicTransitionOpacity?.(cosmicFade);
    celestialCosmology.setTransitionOpacity?.(cosmicOpacity, { prewarm });
    if (celestialAtlas?.galaxy?.galaxyRoot) {
      celestialAtlas.galaxy.galaxyRoot.visible = cosmicFade > 0.001;
    }
    if (!active) return false;
    const observer = semanticCameraTarget(1);
    celestialCosmology.root.position.fromArray(observer);
    // Cosmology tier roots convert native Mly/Gly coordinates by metersPerUnit.
    // The outer factor mirrors the camera's authored minimum radius, preserving
    // the same physical-angle invariant used by the rebased solar/stellar atlas.
    celestialCosmology.root.scale.setScalar(zoomBounds.minRadius);
    if (celestialAtlas?.galaxy?.solarMarkerLabel) {
      celestialAtlas.galaxy.solarMarkerLabel.visible = false;
    }
    if (celestialAtlas?.galaxy?.solarMarker) celestialAtlas.galaxy.solarMarker.visible = false;
    celestialCosmologyPresentation = celestialCosmology.setSemanticTier({
      tierId: cosmicZoom.tier,
      distanceMeters: representedDistance.distanceMeters,
      metersPerUnit: representedDistance.metersPerUnit,
      reducedMotion
    }) || celestialCosmologyPresentation;
    celestialCosmology.root.updateMatrixWorld?.(true);
    return celestialCosmologyPresentation;
  }

  async function ensureCelestialCosmology() {
    if (celestialCosmology) return celestialCosmology;
    if (celestialCosmologyLoadPromise) return celestialCosmologyLoadPromise;
    celestialCosmologyLoadPromise = (async () => {
      const module = await loadCelestialCosmologyModule();
      if (disposed || !module?.createCelestialCosmology) return null;
      celestialCosmologyModule = module;
      const instance = module.createCelestialCosmology(THREE, {
        quality,
        reducedMotion,
        effectsLevel: currentEffectsLevel,
        devicePixelRatio: renderer.getPixelRatio?.() || 1,
        onInvalidate: requestRenderAcrossConstruction
      });
      if (disposed) {
        instance?.dispose?.();
        return null;
      }
      celestialCosmology = instance;
      scene.add(instance.root);
      syncCelestialCosmologyPresentation();
      canvas.dataset.planetHubCosmology = "ready";
      publishViewZoom({ force: true });
      requestRenderAcrossConstruction();
      return instance;
    })().finally(() => {
      celestialCosmologyLoadPromise = null;
    });
    return celestialCosmologyLoadPromise;
  }

  function publishPhysicalDiagnostics() {
    if (!(windowRef?.__CONSTELLORE_PLANET_HUB_DIAGNOSTICS__
      || windowRef?.location?.search?.includes("physicalDiagnostics=1")) || !canvas?.dataset) return false;
    return celestialAtlasModule?.publishPlanetHubPhysicalDiagnostics?.({
      THREE, canvas, camera, representedDistance, viewZoom, cosmicZoom,
      celestialSemanticPresentation, celestialCosmologyPresentation, spaceEnvironment,
      physicalSolarChart: usesPhysicalSolarChart(viewZoom.progress),
      cosmicActive: isCosmicZoomActive(), cameraOrbitState, sunEffectiveLod,
      targetSubject: activeNavigationFocusId() || orbitBodyId || worldId,
      target: activeNavigationFocusId()
        ? activeNavigationFocusPosition() : semanticCameraTarget(viewZoom.progress),
      viewportWidth, viewportHeight
    });
  }

  function publishViewZoom({ force = false } = {}) {
    const cosmicActive = isCosmicZoomActive();
    const radius = renderCameraRadius(viewZoom.progress, cosmicZoom.progress);
    const band = cosmicActive
      ? "universe"
      : classifyPlanetHubViewBand({ progress: viewZoom.progress, bounds: zoomBounds });
    cosmicZoom.tier = classifyPlanetHubCosmicViewTier({
      progress: cosmicZoom.progress,
      distanceMeters: cosmicActive ? representedDistance.distanceMeters : null
    });
    const previousBand = viewZoom.band;
    const changed = band !== previousBand;
    viewZoom.band = band;
    syncSunPresentation(viewZoom.progress);
    if (changed && (cameraOwner === "home-orbit" || cameraOwner === "celestial-body-focus")) {
      orbitVelocity = { ...rescalePlanetHubAngularVelocity({
        velocity: orbitVelocity,
        fromBand: previousBand,
        toBand: band
      }) };
      cameraOrbitState = cloneCameraOrbitState({
        ...cameraOrbitState,
        velocity: orbitVelocity
      });
    }
    if (canvas?.dataset) {
      canvas.dataset.planetHubView = band;
      canvas.dataset.planetHubZoom = viewZoom.progress.toFixed(3);
      canvas.dataset.planetHubCosmicZoom = cosmicZoom.progress.toFixed(3);
      canvas.dataset.planetHubCosmicTier = cosmicActive ? cosmicZoom.tier : "milky-way";
      canvas.dataset.planetHubZoomSegment = cosmicActive ? "cosmic" : "legacy";
      canvas.dataset.planetHubZooming = String(
        Math.abs(viewZoom.targetProgress - viewZoom.progress) > 0.0001
        || Math.abs(cosmicZoom.targetProgress - cosmicZoom.progress) > 0.0001
      );
      canvas.dataset.planetHubCameraRadius = radius.toFixed(4);
      canvas.dataset.planetHubDistanceMeters = representedDistance.distanceMeters.toExponential(6);
      canvas.dataset.planetHubMetersPerUnit = representedDistance.metersPerUnit.toExponential(6);
      canvas.dataset.planetHubRebaseIndex = String(representedDistance.rebaseIndex);
      canvas.dataset.planetHubCameraNear = camera.near.toExponential(6);
      canvas.dataset.planetHubCameraFar = camera.far.toExponential(6);
      canvas.dataset.planetHubLiveAngularSpeed = Math.hypot(
        orbitVelocity.yaw,
        orbitVelocity.pitch
      ).toFixed(6);
    }
    syncCelestialAtlasPresentation(band);
    syncCelestialCosmologyPresentation?.();
    spaceEnvironment?.setViewDepth?.({
      progress: viewZoom.progress,
      band,
      // The atlas may own stellar content, but never a second coordinate
      // plane. Physical units and decade LOD stay inside the native grid.
      gridOwner: null,
      distanceMeters: representedDistance.distanceMeters,
      metersPerUnit: representedDistance.metersPerUnit
    });
    if (spaceEnvironment && hubMode === "overview" && !activeNavigationFocusId()) {
      const gridTarget = semanticCameraTarget(viewZoom.progress);
      const gridSubject = getCelestialBodyRecord(usesPhysicalSolarChart() ? "sun" : worldId);
      const gridScale = gridSubject?.root?.getWorldScale?.(new THREE.Vector3())?.x || 1;
      spaceEnvironment.setWorldGridAnchor?.({
        scope: usesPhysicalSolarChart() ? "system" : "local",
        position: gridTarget,
        bodyRadius: Math.max(0.05, Math.abs(gridScale))
      });
    }
    if (force || changed) {
      onViewChange(Object.freeze({
        progress: viewZoom.progress,
        targetProgress: viewZoom.targetProgress,
        radius,
        distanceMeters: representedDistance.distanceMeters,
        metersPerUnit: representedDistance.metersPerUnit,
        localDollyFactor: representedDistance.localDollyFactor,
        band,
        source: viewZoom.source,
        segment: cosmicActive ? "cosmic" : "legacy",
        cosmicProgress: cosmicZoom.progress,
        cosmicTargetProgress: cosmicZoom.targetProgress,
        cosmicTier: cosmicActive ? cosmicZoom.tier : null
      }));
    }
    return band;
  }

  function recalculateZoomBounds({ apply = false } = {}) {
    const base = calculateHomeBaseCameraPose();
    const authoredExtent = calculatePlanetHubCelestialExtent({
      moonOrbitRadius: PLANET_HUB_MOON_ORBIT_RADIUS,
      moonRadius: PLANET_HUB_MOON_RADIUS_RATIO,
      sunPosition: celestialLayout.sunPosition,
      sunScale: celestialLayout.sunScale
    });
    const atlasExtent = Math.max(0, Number(celestialAtlas?.layout?.extent) || 0);
    const chartEntryProgress = (PLANET_HUB_ZOOM_ANCHOR_PROGRESS.orbit
      + PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system) * 0.5;
    const chartEntryScale = PLANET_HUB_DISTANCE_STOPS.planet
      / resolvePlanetHubRepresentedDistance(chartEntryProgress, zoomBounds).metersPerUnit;
    const visibleAtlasExtent = atlasExtent * chartEntryScale;
    zoomBounds = calculatePlanetHubZoomBounds({
      baseRadius: base.distance,
      verticalFovDegrees: camera.fov,
      aspect: camera.aspect,
      celestialExtent: Math.max(authoredExtent, visibleAtlasExtent),
      fitExtent: visibleAtlasExtent || null
    });
    // The projection matrix originally retained the close-up 20-unit far
    // plane while semantic zoom moved the camera beyond it. That clipped the
    // complete celestial system as soon as the System band was reached. Size
    // the frustum once from the responsive maximum instead of rebuilding it
    // on every spring frame.
    canonicalFar = Math.max(
      20,
      448,
      zoomBounds.maxRadius + zoomBounds.celestialExtent * 2 + 16
    );
    camera.far = canonicalFar;
    camera.updateProjectionMatrix();
    if (apply && hubMode === "overview" && cameraOwner === "home-orbit" && !transition) {
      applyCameraOrbitState(overviewOrbitWithViewZoom(cameraOrbitState));
    }
    publishViewZoom({ force: true });
    return zoomBounds;
  }

  // Semantic zoom is evaluated from the first overview frame, before the
  // celestial-focus controls below are ever used. Keep these lookups in the
  // same lexical section as the zoom resolver: block-scoped function
  // declarations are not reliably visible across every transformed/browser
  // module build, even though Node's test loader happens to accept them.
  function getCelestialBodyRecord(target = worldId, progress = viewZoom.progress) {
    const id = String(target || worldId).trim().toLowerCase();
    const body = celestialRegistry?.[id] || null;
    if (!body) return null;
    let root = null;
    if (usesPhysicalSolarChart(progress) && id !== "sun") root = celestialAtlas?.getBody?.(id)?.anchor || null;
    else if (id === worldId) root = world;
    else if (id === "moon" && satelliteRoot) root = satelliteRoot;
    else if (id === "sun" && sunRoot) root = sunRoot;
    else root = celestialAtlas?.getBody?.(id)?.anchor || null;
    return root ? Object.freeze({ id, body, root }) : null;
  }

  function getCelestialBodyWorldPosition(target = worldId, progress = viewZoom.progress) {
    const record = getCelestialBodyRecord(target, progress);
    if (!record) return null;
    record.root.updateMatrixWorld?.(true);
    return record.root.getWorldPosition?.(new THREE.Vector3()) || record.root.position?.clone?.() || null;
  }

  function getCelestialBodyWorldRadius(record) {
    if (!record?.root) return 0;
    record.root.getWorldScale?.(chartBodyWorldScale);
    const scale = Math.max(
      Math.abs(chartBodyWorldScale.x || 1),
      Math.abs(chartBodyWorldScale.y || 1),
      Math.abs(chartBodyWorldScale.z || 1)
    );
    const authoredUnitSphere = record.root === world
      || record.root === satelliteRoot
      || record.root === sunRoot;
    const atlasRecord = celestialAtlas?.bodies?.get?.(record.id);
    const chartDisplayScale = record.root === atlasRecord?.anchor
      ? Math.max(1, Number(record.root.userData?.planetHubChartDisplayScale) || 1)
      : 1;
    return Math.max(1e-8,
      scale * (authoredUnitSphere ? 1 : record.body.radius * chartDisplayScale));
  }

  function syncCelestialChartBodyDisplayScales() {
    if (!celestialAtlas || !celestialRegistry) return false;
    const physicalChartBlend = physicalSolarChartBlend();
    celestialSystem.updateMatrixWorld?.(true);
    authoredCloseSystem.updateMatrixWorld?.(true);
    camera.updateMatrixWorld?.(true);

    for (const [id, record] of celestialAtlas.bodies) {
      record.visual?.scale?.setScalar?.(1);
      if ((id === worldId || id === "moon") && record.visual?.position) {
        record.visual.position.set(0, 0, 0);
      }
      record.anchor.userData.planetHubChartDisplayScale = 1;
    }

    const localRecord = celestialAtlas.bodies.get(worldId);
    if (localRecord?.visual) {
      const authoredRadius = getCelestialBodyWorldRadius({
        id: worldId, body: celestialRegistry[worldId], root: world
      });
      const proxyRadius = getCelestialBodyWorldRadius({
        id: worldId, body: localRecord.body, root: localRecord.anchor
      });
      const handoff = calculatePlanetHubProxyHandoff({
        blend: physicalChartBlend, authoredRadius, proxyRadius
      });
      authoredWorldHandoffMultiplier = handoff.radius / authoredRadius;
      world.scale.multiplyScalar(authoredWorldHandoffMultiplier);
      localRecord.visual.scale.setScalar(handoff.radius / proxyRadius);
      authoredCloseSystem.updateMatrixWorld?.(true);
    }

    const moonRecord = satelliteRoot && !journeyDeparture
      ? celestialAtlas.bodies.get("moon") : null;
    if (moonRecord?.visual) {
      const authoredRadius = getCelestialBodyWorldRadius({
        id: "moon", body: moonRecord.body, root: satelliteRoot
      });
      const proxyRadius = getCelestialBodyWorldRadius({
        id: "moon", body: moonRecord.body, root: moonRecord.anchor
      });
      const handoff = calculatePlanetHubProxyHandoff({
        blend: physicalChartBlend, authoredRadius, proxyRadius
      });
      satelliteRoot.scale.multiplyScalar(handoff.radius / authoredRadius);
      moonRecord.visual.scale.setScalar(handoff.radius / proxyRadius);
      authoredCloseSystem.updateMatrixWorld?.(true);
      moonRecord.anchor.updateMatrixWorld?.(true);
      satelliteRoot.getWorldPosition(authoredHandoffPosition);
      moonRecord.visual.position.copy(moonRecord.anchor.worldToLocal(authoredHandoffPosition));
    }

    if (sunRoot && sunPresentation) {
      sunRoot.scale.setScalar(sunPresentation.radius);
      sunRoot.userData.planetHubChartDisplayScale = 1;
    }

    const selectedRecord = celestialAtlas.bodies.get(selectedBodyId);
    if (selectedRecord?.body?.selectable && celestialAtlas.selection) {
      const displayScale = Math.max(1,
        Number(selectedRecord.anchor.userData.planetHubChartDisplayScale) || 1);
      celestialAtlas.selection.scale.setScalar(selectedRecord.body.radius * 1.1 * displayScale);
    }
    return true;
  }

  function getBodyLabel(target = worldId) {
    const id = String(target || worldId).trim().toLowerCase();
    return celestialRegistry?.[id]?.label || null;
  }

  const NAVIGATION_PLACE_ALIASES = Object.freeze({
    "solar-system": "sun",
    "galactic-centre": "galactic-center",
    "eps-eri": "eps-eridani",
    "rigil-kentaurus": "rigil-kent"
  });

  function canonicalNavigationPlaceId(target = "") {
    const id = String(target || "").trim().toLowerCase();
    return NAVIGATION_PLACE_ALIASES[id] || id;
  }

  function navigationTargetWorldPosition(target) {
    if (!target) return null;
    const object = target.anchor || target.object;
    if (object?.getWorldPosition) return object.getWorldPosition(new THREE.Vector3());
    const root = target.root;
    const local = target.positionInRoot || target.localPosition || target.position;
    if (root?.localToWorld && Array.isArray(local)) {
      root.updateWorldMatrix?.(true, false);
      return root.localToWorld(new THREE.Vector3(...local.slice(0, 3)));
    }
    return Array.isArray(local) ? celestialSystem.localToWorld(new THREE.Vector3(...local.slice(0, 3))) : null;
  }

  function navigationTargetWorldRadius(target) {
    if (!target) return 0;
    if (target.bodyId || celestialRegistry?.[target.canonicalId || target.id]) {
      const record = getCelestialBodyRecord(target.bodyId || target.canonicalId || target.id);
      if (record) return getCelestialBodyWorldRadius(record);
    }
    const root = target.anchor || target.object || target.root;
    const scale = root?.getWorldScale?.(new THREE.Vector3());
    const localExtent = Math.max(1e-8, Number(
      target.extent ?? target.focusExtent ?? target.nativeExtent ?? 0.35
    ) || 0.35);
    return localExtent * Math.max(1e-9,
      Math.abs(scale?.x || 1), Math.abs(scale?.y || 1), Math.abs(scale?.z || 1));
  }

  function resolveNavigationTarget(target) {
    const requestedId = String(target || "").trim().toLowerCase();
    const id = canonicalNavigationPlaceId(requestedId);
    const body = getCelestialBodyRecord(id);
    if (body) return Object.freeze({
      id,
      canonicalId: id,
      requestedId,
      label: body.body.label,
      kind: id === "sun" ? "star" : id === "moon" ? "moon" : "planet",
      tier: "solar",
      bodyId: id,
      anchor: body.root,
      extent: getCelestialBodyWorldRadius(body),
      extentIsWorld: true,
      recommendedDistanceMeters: id === worldId
        ? PLANET_HUB_DISTANCE_STOPS.planet
        : PLANET_HUB_DISTANCE_STOPS.system
    });
    const atlasTarget = celestialAtlas?.getNavigationTarget?.(requestedId);
    const cosmicTarget = celestialCosmology?.getNavigationTarget?.(requestedId);
    return (isCosmicZoomActive() ? cosmicTarget || atlasTarget : atlasTarget || cosmicTarget) || null;
  }

  function solarNavigationPlaces() {
    return Object.freeze(Object.values(celestialRegistry || {}).map((body) => Object.freeze({
      id: body.id,
      label: body.label,
      kind: body.id === "sun" ? "star" : body.id === "moon" ? "moon" : "planet",
      tier: "solar",
      bodyId: body.id,
      available: true,
      gameplayAvailable: body.available !== false,
      selectable: body.selectable !== false,
      visitable: body.selectable !== false,
      status: body.available === false ? "astronomy-only" : "available",
      recommendedDistanceMeters: body.id === worldId
        ? PLANET_HUB_DISTANCE_STOPS.planet
        : PLANET_HUB_DISTANCE_STOPS.system
    })));
  }

  function getNavigationContext({ all = false } = {}) {
    const cosmicActive = isCosmicZoomActive();
    const owner = cosmicActive
      ? cosmicZoom.tier
      : celestialSemanticPresentation?.owner || viewZoom.band;
    const atlasPlaces = cosmicActive ? [] : celestialAtlas?.getNavigationPlaces?.({
      all: false,
      owner,
      band: viewZoom.band,
      progress: viewZoom.progress,
      distanceMeters: representedDistance.distanceMeters
    }) || [];
    const cosmicPlaces = cosmicActive ? celestialCosmology?.getNavigationPlaces?.({
      all,
      tierId: cosmicZoom.tier,
      activeOnly: true,
      progress: cosmicZoom.progress,
      distanceMeters: representedDistance.distanceMeters
    }) || [] : [];
    const includeSolar = !cosmicActive && ["planet", "orbit", "system", "solar", "solar-marker"].includes(owner);
    const places = [];
    const seen = new Set();
    for (const place of [
      ...(includeSolar ? solarNavigationPlaces() : []),
      ...atlasPlaces,
      ...cosmicPlaces
    ]) {
      const id = canonicalNavigationPlaceId(place?.id || place?.canonicalId);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      places.push(Object.freeze({
        available: true,
        selectable: true,
        visitable: true,
        ...place,
        id,
        selected: id === canonicalNavigationPlaceId(selectedPlaceId),
        visited: id === canonicalNavigationPlaceId(placeFocusId || bodyFocusId || orbitBodyId)
      }));
    }
    return Object.freeze({
      id: cosmicActive ? `cosmic-${cosmicZoom.tier}` : `astronomy-${owner}`,
      label: cosmicActive
        ? String(cosmicZoom.tier).replaceAll("-", " ")
        : String(owner).replaceAll("-", " "),
      owner,
      band: viewZoom.band,
      progress: cosmicActive ? cosmicZoom.progress : viewZoom.progress,
      distanceMeters: representedDistance.distanceMeters,
      selectedPlaceId,
      visitedPlaceId: placeFocusId || bodyFocusId || orbitBodyId,
      focusedPlaceId: placeFocusId || bodyFocusId || null,
      places: Object.freeze(places)
    });
  }

  function selectPlace(target, { source = "places-select" } = {}) {
    const requestedId = String(target || "").trim().toLowerCase();
    const resolved = resolveNavigationTarget(requestedId) || celestialRegistry?.[requestedId];
    if (!resolved) return false;
    const id = canonicalNavigationPlaceId(resolved.canonicalId || resolved.id || requestedId);
    const body = getCelestialBodyRecord(id);
    const bodyMetadata = celestialRegistry?.[id];
    let accepted = false;
    if (bodyMetadata) {
      accepted = Boolean(body && navigationSelectBody(id)) || bodyMetadata.selectable !== false;
      celestialCosmology?.setSelectedPlace?.(null);
    }
    else {
      const atlasTarget = celestialAtlas?.getNavigationTarget?.(id);
      const cosmicTarget = celestialCosmology?.getNavigationTarget?.(id);
      const cosmicOwner = Boolean(cosmicTarget && (isCosmicZoomActive() || !atlasTarget));
      if (cosmicOwner) {
        celestialAtlas?.setSelectedPlace?.(null);
        accepted = Boolean(celestialCosmology?.setSelectedPlace?.(id));
      } else {
        celestialCosmology?.setSelectedPlace?.(null);
        accepted = Boolean(celestialAtlas?.setSelectedPlace?.(id));
      }
    }
    if (!accepted) return false;
    selectedPlaceId = id;
    viewZoom.source = String(source || "places-select");
    canvas.dataset.planetHubSelectedPlace = id;
    requestRenderAcrossConstruction();
    return Object.freeze({ accepted: true, id });
  }

  function activeNavigationFocusId() {
    return placeFocusId || bodyFocusId || null;
  }

  function activeNavigationFocusTarget() {
    const id = activeNavigationFocusId();
    return id ? resolveNavigationTarget(id) : null;
  }

  function activeNavigationFocusPosition() {
    const id = activeNavigationFocusId();
    if (!id) return null;
    if (bodyFocusId) return getCelestialBodyWorldPosition(bodyFocusId);
    return navigationTargetWorldPosition(activeNavigationFocusTarget());
  }

  function resolveBodyFocusFraming(record = getCelestialBodyRecord(bodyFocusId)) {
    if (!record) return null;
    const worldRadius = getCelestialBodyWorldRadius(record);
    const fit = celestialAtlas?.focusFit?.(record.id, {
      radius: worldRadius,
      focusRadius: worldRadius * 2.7,
      aspect: camera.aspect,
      verticalFovDegrees: camera.fov,
      fill: 0.6
    }) || { distance: worldRadius * 2.7 };
    return {
      worldRadius,
      closeRadius: Math.max(worldRadius * 2.25, Number(fit.distance) || worldRadius * 2.7)
    };
  }

  function activeNavigationFocusRadius() {
    if (bodyFocusId) {
      const framing = resolveBodyFocusFraming();
      if (framing) bodyFocusCloseRadius = framing.closeRadius;
      return bodyFocusCloseRadius;
    }
    const target = activeNavigationFocusTarget();
    const worldRadius = navigationTargetWorldRadius(target);
    return Math.max(1e-8, worldRadius * placeFocusDistanceRatio);
  }

  function navigationDistanceTargets(target) {
    const distanceMeters = Math.max(PLANET_HUB_DISTANCE_STOPS.planet,
      Number(target?.recommendedDistanceMeters) || PLANET_HUB_DISTANCE_STOPS.system);
    if (distanceMeters > PLANET_HUB_DISTANCE_STOPS.universe) {
      return Object.freeze({
        segment: "cosmic",
        legacyProgress: 1,
        cosmicProgress: planetHubCosmicZoomDistanceToProgress(distanceMeters)
      });
    }
    return Object.freeze({
      segment: "legacy",
      legacyProgress: planetHubZoomDistanceToProgress(distanceMeters),
      cosmicProgress: 0
    });
  }

  function captureNavigationState() {
    return Object.freeze({
      version: 1,
      cameraOrbit: Object.freeze({
        ...calculatePlanetHubCameraOrbitPose(cameraOrbitState),
        velocity: Object.freeze({ ...orbitVelocity })
      }),
      viewZoom: Object.freeze({
        progress: viewZoom.progress,
        targetProgress: viewZoom.targetProgress
      }),
      cosmicZoom: Object.freeze({
        progress: cosmicZoom.progress,
        targetProgress: cosmicZoom.targetProgress
      }),
      cameraOwner,
      orbitBodyId,
      selectedBodyId,
      selectedPlaceId,
      bodyFocusId,
      bodyFocusCloseRadius,
      placeFocusId,
      placeFocusDistanceRatio
    });
  }

  function beginPlaceFocus(target, { animate = true } = {}) {
    const id = canonicalNavigationPlaceId(target?.canonicalId || target?.id);
    const position = navigationTargetWorldPosition(target);
    const worldRadius = navigationTargetWorldRadius(target);
    if (!id || !position || !(worldRadius > 0)) return false;
    const direction = camera.position.clone().sub(position);
    if (direction.lengthSq() < 1e-8) direction.copy(cameraDirection);
    direction.normalize();
    const verticalFov = Math.max(0.1, camera.fov * Math.PI / 180);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov * 0.5) * Math.max(0.1, camera.aspect));
    const limitingFov = Math.min(verticalFov, horizontalFov);
    const fitDistance = worldRadius / Math.max(0.08, Math.tan(limitingFov * 0.31));
    placeFocusDistanceRatio = Math.max(2.4, fitDistance / worldRadius);
    placeFocusCloseRadius = Math.max(worldRadius * 2.4, fitDistance);
    const focusOrbit = orbitStateFromCameraPose({
      position: position.clone().addScaledVector(direction, placeFocusCloseRadius),
      target: position,
      up: camera.up.clone(),
      velocity: { yaw: 0, pitch: 0 }
    });
    if (!activeNavigationFocusId()) placeSavedNavigationState = captureNavigationState();
    pointerDragActive = false;
    pointerDragLastAt = 0;
    orbitVelocity = { yaw: 0, pitch: 0 };
    orbitCoastUntil = 0;
    resetOrbitIdle({ active: false, suppressed: false });
    bodyFocusId = null;
    bodyFocusCloseRadius = null;
    placeFocusId = id;
    selectedPlaceId = id;
    orbitBodyId = id;
    const now = windowRef?.performance?.now?.() || 0;
    const distanceRatio = Math.max(1, cameraOrbitState.radius / Math.max(1e-8, placeFocusCloseRadius));
    bodyFocusTransition = {
      focused: true,
      bodyId: id,
      orbitFrom: cloneCameraOrbitState(),
      orbitTo: focusOrbit,
      startedAt: now,
      duration: reducedMotion ? 140 : Math.min(1350, 760 + Math.log(distanceRatio) * 145),
      gridAnchor: position.toArray(),
      gridRadius: worldRadius,
      gridAnchorChanged: false
    };
    setCameraOwner("celestial-body-focus");
    canvas.dataset.planetHubOrbitBody = id;
    canvas.dataset.planetHubSelectedPlace = id;
    camera.near = Math.max(1e-9, Math.min(0.05, worldRadius * 0.025));
    camera.updateProjectionMatrix();
    if (!animate) {
      applyCameraOrbitState(focusOrbit);
      spaceEnvironment?.setWorldGridAnchor?.({ position: position.toArray(), bodyRadius: worldRadius });
      spaceEnvironment?.setWorldGridTransitionOpacity?.(1);
      bodyFocusTransition = null;
      onPhase("ready");
    } else onPhase("transitioning");
    requestRenderAcrossConstruction();
    return true;
  }

  function queuePlaceVisitFocus(pending) {
    const target = resolveNavigationTarget(pending.id);
    if (!target) return false;
    const body = getCelestialBodyRecord(target.bodyId || target.canonicalId || target.id);
    if (body && target.canonicalId !== worldId) {
      return navigationFocusBody(target.canonicalId, { animate: pending.animate });
    }
    if (body && target.canonicalId === worldId) {
      // A deliberate Home visit owns its destination. Do not let the generic
      // focus-return snapshot pull the camera back to the place we are leaving.
      placeSavedNavigationState = null;
      bodySavedViewZoom = {
        progress: viewZoom.progress,
        targetProgress: viewZoom.targetProgress
      };
      bodySavedCameraOrbit = overviewOrbitWithViewZoom(cameraOrbitState);
      navigationSetOrbitBody(worldId, { animate: pending.animate, source: pending.source });
      return true;
    }
    return beginPlaceFocus(target, { animate: pending.animate });
  }

  function visitPlace(target, { source = "places-visit", animate = true } = {}) {
    if (disposed || pendingPlaceVisit || pendingNavigationRestore) return Promise.resolve(false);
    const requestedId = String(target || "").trim().toLowerCase();
    const resolved = resolveNavigationTarget(requestedId);
    if (!resolved || resolved.selectable === false
      || (resolved.kind !== "solar-body" && resolved.available === false)) return Promise.resolve(false);
    const id = canonicalNavigationPlaceId(resolved.canonicalId || resolved.id || requestedId);
    const zoomTarget = navigationDistanceTargets(resolved);
    selectPlace(id, { source });
    return new Promise((resolve) => {
      pendingPlaceVisit = {
        id,
        source,
        animate: Boolean(animate),
        zoomTarget,
        focusStarted: false,
        resolve
      };
      if (!animate || reducedMotion) {
        viewZoom.progress = viewZoom.targetProgress = zoomTarget.legacyProgress;
        viewZoom.velocity = 0;
        cosmicZoom.progress = cosmicZoom.targetProgress = zoomTarget.cosmicProgress;
        cosmicZoom.velocity = 0;
        if (zoomTarget.cosmicProgress > 0) void ensureCelestialCosmology();
        applyCameraOrbitState(overviewOrbitWithViewZoom(cameraOrbitState));
        publishViewZoom({ force: true });
      } else if (zoomTarget.segment === "cosmic") {
        navigationSetCosmicZoom(zoomTarget.cosmicProgress, { immediate: false, source });
      } else {
        navigationSetViewZoom(zoomTarget.legacyProgress, { immediate: false, source });
      }
      onPhase("transitioning");
      requestRenderAcrossConstruction();
    });
  }

  function restoreNavigationState(snapshot, {
    source = "places-back",
    animate = true
  } = {}) {
    if (disposed || pendingPlaceVisit || pendingNavigationRestore
      || !snapshot || snapshot.version !== 1 || !snapshot.cameraOrbit) {
      return Promise.resolve(false);
    }
    const restoredView = clampPlanetHubZoomProgress(snapshot.viewZoom?.progress ?? 0);
    const restoredViewTarget = clampPlanetHubZoomProgress(
      snapshot.viewZoom?.targetProgress ?? restoredView
    );
    const restoredCosmic = clampPlanetHubCosmicZoomProgress(snapshot.cosmicZoom?.progress ?? 0);
    const restoredCosmicTarget = clampPlanetHubCosmicZoomProgress(
      snapshot.cosmicZoom?.targetProgress ?? restoredCosmic
    );
    const restoredBodyFocus = canonicalNavigationPlaceId(snapshot.bodyFocusId || "") || null;
    const restoredPlaceFocus = canonicalNavigationPlaceId(snapshot.placeFocusId || "") || null;
    const restoredFocus = restoredPlaceFocus || restoredBodyFocus;
    const orbitTo = createPlanetHubCameraOrbitState(snapshot.cameraOrbit);
    const complete = (resolve) => {
      viewZoom.source = String(source || "places-back");
      viewZoom.progress = restoredView;
      viewZoom.targetProgress = restoredViewTarget;
      viewZoom.velocity = 0;
      cosmicZoom.source = viewZoom.source;
      cosmicZoom.progress = restoredCosmic;
      cosmicZoom.targetProgress = restoredCosmicTarget;
      cosmicZoom.velocity = 0;
      pendingSegmentZoom = null;
      bodyFocusId = restoredBodyFocus;
      bodyFocusCloseRadius = snapshot.bodyFocusCloseRadius ?? null;
      placeFocusId = restoredPlaceFocus;
      placeFocusDistanceRatio = Math.max(2.4,
        Number(snapshot.placeFocusDistanceRatio) || placeFocusDistanceRatio);
      placeFocusCloseRadius = restoredPlaceFocus
        ? Math.max(1e-8, Number(snapshot.cameraOrbit.radius) || 1)
        : null;
      orbitBodyId = canonicalNavigationPlaceId(snapshot.orbitBodyId || worldId) || worldId;
      selectedBodyId = canonicalNavigationPlaceId(snapshot.selectedBodyId || worldId) || worldId;
      selectedPlaceId = canonicalNavigationPlaceId(snapshot.selectedPlaceId || selectedBodyId) || worldId;
      canvas.dataset.planetHubOrbitBody = orbitBodyId;
      canvas.dataset.planetHubSelectedPlace = selectedPlaceId;
      if (restoredCosmic > 1e-9) void ensureCelestialCosmology();
      syncScaleSpace(restoredView, restoredCosmic);
      publishViewZoom({ force: true });
      if (celestialRegistry?.[selectedBodyId] && isSolarAtlasDetailInteractive()) {
        navigationSelectBody(selectedBodyId);
      } else {
        celestialAtlas?.setSelectedPlace?.(selectedPlaceId);
        celestialCosmology?.setSelectedPlace?.(selectedPlaceId);
      }
      const focusPosition = restoredFocus ? activeNavigationFocusPosition() : null;
      const gridPosition = focusPosition?.toArray?.() || semanticCameraTarget(restoredView);
      const focusRadius = restoredFocus
        ? Math.max(1e-8, activeNavigationFocusRadius())
        : Math.max(0.05, Math.abs(getCelestialBodyRecord(
          usesPhysicalSolarChart(restoredView) ? "sun" : worldId,
          restoredView
        )?.root?.getWorldScale?.(new THREE.Vector3())?.x || 1));
      if (restoredFocus) camera.near = Math.max(1e-9, Math.min(0.05, focusRadius * 0.025));
      else ({ near: camera.near, far: camera.far } = resolvePlanetHubPrecisionFrustum({
        localDollyFactor: representedDistance.localDollyFactor,
        far: canonicalFar
      }));
      camera.updateProjectionMatrix();
      const owner = restoredFocus ? "celestial-body-focus" : "home-orbit";
      setCameraOwner(owner);
      if (!animate || reducedMotion) {
        applyCameraOrbitState(orbitTo);
        spaceEnvironment?.setWorldGridAnchor?.({ position: gridPosition, bodyRadius: focusRadius });
        spaceEnvironment?.setWorldGridTransitionOpacity?.(1);
        bodyFocusTransition = null;
        onPhase("ready");
        requestRenderAcrossConstruction();
        resolve(Object.freeze({ accepted: true, id: restoredFocus || orbitBodyId }));
        return;
      }
      bodyFocusTransition = {
        focused: Boolean(restoredFocus),
        restoring: true,
        bodyId: restoredFocus || orbitBodyId,
        orbitFrom: cloneCameraOrbitState(),
        orbitTo,
        startedAt: windowRef?.performance?.now?.() || 0,
        duration: 760,
        gridAnchor: gridPosition,
        gridRadius: focusRadius,
        gridAnchorChanged: false
      };
      pendingNavigationRestore = { resolve, id: restoredFocus || orbitBodyId };
      onPhase("transitioning");
      requestRenderAcrossConstruction();
    };
    return new Promise(complete);
  }

  function semanticCameraTarget(progress = viewZoom.progress) {
    const vector = (target, fallback) => getCelestialBodyWorldPosition(target, progress)?.toArray?.() || fallback;
    const worldPosition = vector(worldId, [0, 0, 0]);
    const earthPosition = vector("earth", worldPosition);
    const immutableSunPosition = vector("sun", earthPosition);
    const galacticLocal = celestialSemanticPresentation?.galacticCenterPosition;
    const galacticCenterPosition = galacticLocal
      ? celestialSystem.localToWorld(new THREE.Vector3(...galacticLocal)).toArray()
      : immutableSunPosition;
    // Selection is navigation ownership, not merely a highlight.  Earth is
    // selected on reset, so it must remain the exact dolly/orbit pivot until
    // the player explicitly chooses another body.  Previously only a
    // double-click bodyFocusId counted, causing the default Earth view to run
    // the automatic Earth->Sun arc around 0.07 AU and orbit an empty point.
    const semanticSubjectId = bodyFocusId || selectedBodyId || orbitBodyId || worldId;
    const selectedBodyPosition = semanticSubjectId
      ? vector(semanticSubjectId, earthPosition)
      : null;
    return calculatePlanetHubSemanticCameraTarget({
      progress,
      worldPosition,
      earthPosition,
      sunPosition: immutableSunPosition,
      galacticCenterPosition,
      selectedBodyPosition
    });
  }

  function overviewOrbitWithViewZoom(
    state,
    progress = viewZoom.progress,
    cosmicProgress = cosmicZoom.progress
  ) {
    const safeProgress = clampPlanetHubZoomProgress(progress);
    const safeCosmicProgress = clampPlanetHubCosmicZoomProgress(cosmicProgress);
    const radius = renderCameraRadius(safeProgress, safeCosmicProgress);
    syncSunPresentation(safeProgress);
    syncCelestialAtlasPresentation(
      isCosmicZoomActive() ? "universe" : classifyPlanetHubViewBand({ progress: safeProgress, bounds: zoomBounds }),
      safeProgress
    );
    syncCelestialCosmologyPresentation?.(safeCosmicProgress);
    celestialSystem.updateMatrixWorld?.(true);
    const target = semanticCameraTarget(safeProgress);
    const orbit = cloneCameraOrbitState({
      ...state,
      target,
      radius
    });
    return constrainPlanetHubCameraOrbitForView(orbit,
      { progress: isCosmicZoomActive() ? 1 : safeProgress });
  }

  function orbitWithViewZoom(state, progress = viewZoom.progress) {
    if (activeNavigationFocusId()) {
      const safeProgress = clampPlanetHubZoomProgress(progress);
      const focusedPosition = activeNavigationFocusPosition();
      const focusedRadius = activeNavigationFocusRadius();
      if (!focusedPosition || !(focusedRadius > 0)) return overviewOrbitWithViewZoom(state, progress);
      if (placeFocusId) {
        placeFocusCloseRadius = focusedRadius;
      }
      return constrainPlanetHubCameraOrbitForView(cloneCameraOrbitState({
        ...state,
        target: focusedPosition.toArray(),
        radius: focusedRadius
      }), { progress: isCosmicZoomActive() ? 1 : safeProgress });
    }
    return overviewOrbitWithViewZoom(state, progress);
  }

  function orbitStateFromCameraPose({ position, target, up, velocity = orbitVelocity } = {}) {
    return createPlanetHubCameraOrbitState({
      position: position?.toArray?.() || position,
      target: target?.toArray?.() || target,
      up: up?.toArray?.() || up,
      velocity
    });
  }

  function applyCameraOrbitState(state = cameraOrbitState, { updateProjection = false } = {}) {
    cameraOrbitState = cloneCameraOrbitState(state);
    const pose = calculatePlanetHubCameraOrbitPose(cameraOrbitState);
    camera.position.set(...pose.position);
    camera.up.set(...pose.up).normalize();
    camera.lookAt(new THREE.Vector3(...pose.target));
    cameraFacing.set(...pose.position).sub(new THREE.Vector3(...pose.target)).normalize();
    if (updateProjection) camera.updateProjectionMatrix();
    if (spaceEnvironment?.root) spaceEnvironment.root.position.copy(camera.position);
    return pose;
  }

  function equivalentCameraOrbitForPresentation({ quaternion, position, scale = 1 } = {}) {
    const base = calculateHomeBaseCameraPose();
    const inverse = quaternion.clone().invert();
    const safeScale = Math.max(0.01, Number(scale) || 1);
    const authoredPosition = position || overviewPosition;
    const transformedPosition = base.position.clone()
      .sub(authoredPosition)
      .multiplyScalar(1 / safeScale)
      .applyQuaternion(inverse);
    const transformedTarget = base.target.clone()
      .sub(authoredPosition)
      .multiplyScalar(1 / safeScale)
      .applyQuaternion(inverse);
    const transformedUp = base.up.clone().applyQuaternion(inverse).normalize();
    return orbitStateFromCameraPose({
      position: transformedPosition,
      target: transformedTarget,
      up: transformedUp,
      velocity: { yaw: 0, pitch: 0 }
    });
  }

  function setMoonJourneyPadFlightVisible(visible) {
    const active = Boolean(visible && moonJourneyPad);
    if (moonJourneyPad) moonJourneyPad.visible = active;
    if (canvas?.dataset) {
      canvas.dataset.planetHubMoonPad = !moonJourneyPad
        ? "missing"
        : active ? "visible" : "ready";
    }
    for (const material of moonJourneyPadMaterials) {
      if (material?.map && material.emissiveMap !== material.map) {
        material.emissiveMap = material.map;
        material.emissive?.setHex?.(0xffffff);
        material.needsUpdate = true;
      }
      if (material) material.emissiveIntensity = active ? 0.05 : 0;
    }
    for (const light of moonJourneyPadLights) {
      light.intensity = active
        ? Math.max(0, Number(light.userData?.planetHubFlightIntensity) || 0)
        : 0;
    }
    return active;
  }

  function publishSpaceState() {
    const snapshot = spaceEnvironment?.snapshot?.();
    const value = !snapshot?.enabled
      ? "static"
      : snapshot.effectiveEffects === "reduced" ? "reduced" : "dynamic";
    onSpaceState(value);
    return value;
  }

  function satelliteOverviewScale(position = satelliteRoot?.position) {
    if (!position) return satelliteBaseScale;
    const satellitePosition = Array.isArray(position)
      ? new THREE.Vector3(...position)
      : authoredHandoffPosition.copy(position);
    authoredCloseSystem.updateMatrixWorld?.(true);
    world.getWorldPosition(chartBodyWorldPosition);
    world.getWorldScale(authoredHandoffScale);
    authoredCloseSystem.getWorldScale(chartBodyWorldScale);
    const parentScale = Math.max(1e-9, Math.abs(chartBodyWorldScale.x),
      Math.abs(chartBodyWorldScale.y), Math.abs(chartBodyWorldScale.z));
    if (satellitePosition !== authoredHandoffPosition) authoredHandoffPosition.copy(satellitePosition);
    authoredHandoffPosition.applyMatrix4(authoredCloseSystem.matrixWorld);
    return calculatePlanetHubSatellitePerspectiveScale({
      baseScale: satelliteBaseScale,
      earthScale: Math.max(Math.abs(authoredHandoffScale.x),
        Math.abs(authoredHandoffScale.y), Math.abs(authoredHandoffScale.z)),
      earthCameraDistance: camera.position.distanceTo(chartBodyWorldPosition),
      satelliteCameraDistance: camera.position.distanceTo(authoredHandoffPosition)
    }) / parentScale;
  }

  try {
  try {
    const spaceEnvironmentModule = await spaceEnvironmentModulePromise;
    if (!spaceEnvironmentModule?.createPlanetHubSpaceEnvironment) throw new Error("Space environment unavailable");
    spaceEnvironment = spaceEnvironmentModule.createPlanetHubSpaceEnvironment(THREE, {
      quality,
      worldId,
      destination: activeDestination,
      effectsLevel,
      reducedMotion,
      camera,
      spaceLayers: manifest.spaceLayers?.tiers?.[quality]?.layers || [],
      assetBaseUrl,
      pixelRatio: renderer.getPixelRatio?.() || 1,
      onInvalidate: requestRender
    });
    scene.add(spaceEnvironment.root);
    if (spaceEnvironment.worldRoot) scene.add(spaceEnvironment.worldRoot);
    spaceEnvironment.setWorldGridAnchor?.({ position: [0, 0, 0], bodyRadius: 1 });
    publishSpaceState();
  } catch {
    spaceEnvironment = null;
    onSpaceState("failed");
  }
  const planetAsset = resolvePlanetHubAsset(manifest, worldId, quality);
  const planetGltf = await loadGltf(loader, resolveUrl(assetUrl(planetAsset), assetBaseUrl));
  const authoredPlanet = applyTransform(THREE, planetGltf.scene || planetGltf.scenes?.[0], planetAsset);
  normalizePlanetHubMaterials(THREE, authoredPlanet, { role: "planet" });
  let planet = authoredPlanet;
  planetSurfaceMaterial = null;
  authoredPlanet.traverse?.((child) => {
    if (planetSurfaceMaterial || !child?.isMesh) return;
    planetSurfaceMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
  });
  if (worldId === "earth") {
    // The supplied Earth contains two overlapping partial sphere meshes. They
    // look acceptable in its source viewer, but either mesh alone is incomplete
    // and geometry optimization tears their shared UV seam into giant wedges.
    // Reuse the authored CC-BY texture on deterministic WebGL sphere geometry:
    // the visual asset remains the uploaded Earth, while rotation, lighting,
    // picking and silhouettes become topology-safe on every GPU.
    if (planetSurfaceMaterial) {
      planet = new THREE.Mesh(
        new THREE.SphereGeometry(
          1,
          quality === "standard" ? 112 : 64,
          quality === "standard" ? 72 : 40
        ),
        planetSurfaceMaterial
      );
      planet.rotation.y = Math.PI;
      authoredPlanet.traverse?.((child) => child?.geometry?.dispose?.());
    }
  }
  planet.name = `${worldId}-planet`;
  planet.userData.planetHubBody = worldId;
  world.add(planet);

  // Optional authoring hooks are deliberately additive: a missing cloud,
  // night, roughness or normal derivative never blocks the base planet. The
  // manifest remains the only source of release assets, so raw source art is
  // never discovered or loaded by pathname at runtime.
  const surfaceHooks = resolvePlanetHubSurfaceHooks(manifest, worldId, quality);
  const surfaceAlbedo = manifest.optionalDetails?.tiers?.[quality]?.[worldId]?.albedo;
  const surfaceAnisotropy = Math.min(8, renderer.capabilities?.getMaxAnisotropy?.() || 1);
  if (planetSurfaceMaterial?.map) planetSurfaceMaterial.map.anisotropy = surfaceAnisotropy;
  const surfaceTextureContract = manifest.optionalDetails?.textureContract || {};
  const surfaceTextureLoader = new THREE.TextureLoader();
  async function loadSurfaceHook(url, { color = false, generation = surfaceHookLoadGeneration } = {}) {
    if (!url) return null;
    const texture = await surfaceTextureLoader.loadAsync(resolveUrl(url, assetBaseUrl));
    configurePlanetHubSurfaceTexture(THREE, texture, surfaceTextureContract, { color });
    texture.anisotropy = surfaceAnisotropy;
    if (disposed || generation !== surfaceHookLoadGeneration) {
      texture.dispose?.();
      return null;
    }
    surfaceHookTextures.push(texture);
    return texture;
  }
  function attachSurfaceHook(kind, texture, generation) {
    if (!texture || disposed || generation !== surfaceHookLoadGeneration) {
      texture?.dispose?.();
      return false;
    }
    if (kind === "albedo" && planetSurfaceMaterial) {
      const previousAlbedo = planetSurfaceMaterial.map;
      planetSurfaceMaterial.map = texture;
      if (previousAlbedo && previousAlbedo !== texture) previousAlbedo.dispose?.();
      planetSurfaceMaterial.needsUpdate = true;
      if (canvas?.dataset) canvas.dataset.planetHubSurfaceDetail = `${texture.image?.width || 0}px`;
    } else if (kind === "roughness" && planetSurfaceMaterial && "roughnessMap" in planetSurfaceMaterial) {
      planetSurfaceMaterial.roughnessMap = texture;
      planetSurfaceMaterial.roughness = Math.max(0.48, Number(planetSurfaceMaterial.roughness) || 0.7);
      planetSurfaceMaterial.needsUpdate = true;
    } else if (kind === "normal" && planetSurfaceMaterial && "normalMap" in planetSurfaceMaterial) {
      planetSurfaceMaterial.normalMap = texture;
      planetSurfaceMaterial.normalScale?.set?.(0.26, 0.26);
      planetSurfaceMaterial.needsUpdate = true;
    } else if (kind === "clouds" && worldId === "earth") {
      surfaceCloudLayer = new THREE.Mesh(
        new THREE.SphereGeometry(1.009, quality === "standard" ? 72 : 40, quality === "standard" ? 48 : 26),
        new THREE.MeshStandardMaterial({
          // One non-color coverage map preserves the authored cloud alpha.
          // Multiplying a gray color map and its coverage darkened clouds.
          alphaMap: texture,
          color: 0xffffff,
          roughness: 1,
          metalness: 0,
          transparent: true,
          opacity: 0,
          depthTest: true,
          depthWrite: false,
          blending: THREE.NormalBlending,
          toneMapped: true
        })
      );
      surfaceCloudLayer.name = "manifest-cloud-shell";
      surfaceCloudLayer.rotation.y = Math.PI;
      world.add(surfaceCloudLayer);
    } else if (kind === "night" && worldId === "earth") {
      surfaceNightLayer = new THREE.Mesh(
        new THREE.SphereGeometry(1.0045, quality === "standard" ? 72 : 40, quality === "standard" ? 48 : 26),
        createPlanetHubNightLightsMaterial(THREE, texture)
      );
      surfaceNightLayer.name = "manifest-night-shell";
      surfaceNightLayer.rotation.y = Math.PI;
      world.add(surfaceNightLayer);
    } else if (kind === "sunEmissive") {
      surfaceSunEmissiveMap = texture;
      if (sunSurfaceMaterial?.uniforms?.surfaceMap) {
        sunSurfaceMaterial.uniforms.surfaceMap.value = texture;
        sunSurfaceMaterial.uniforms.hasSurfaceMap.value = 1;
        if (canvas?.dataset) canvas.dataset.planetHubSunSurface = "manifest-emissive";
      }
    }
    requestRenderAcrossConstruction();
    return true;
  }
  const surfaceHookGeneration = ++surfaceHookLoadGeneration;
  const progressiveSurfaceHooks = [
    ["albedo", assetUrl(surfaceAlbedo), true],
    ["roughness", surfaceHooks.roughness, false],
    ["normal", surfaceHooks.normal, false],
    ["clouds", surfaceHooks.clouds, false],
    ["night", surfaceHooks.night, true],
    ["sunEmissive", surfaceHooks.sunEmissive, true]
  ];
  // Do not await optional image transfer or decode here. In particular, the
  // standard Earth cloud shell is ~2 MB and used to hold the complete renderer
  // in `loading` even though the base glTF globe was already usable.
  void Promise.all(progressiveSurfaceHooks.map(([kind, url, color]) => (
    loadSurfaceHook(url, { color, generation: surfaceHookGeneration })
      .then((texture) => attachSurfaceHook(kind, texture, surfaceHookGeneration))
      .catch(() => false)
  )));

  if (worldId === "earth" && manifest.worlds?.moon?.tiers?.[quality]) {
    try {
      const moonAsset = resolvePlanetHubAsset(manifest, "moon", quality);
      const moonGltf = await loadGltf(loader, resolveUrl(assetUrl(moonAsset), assetBaseUrl));
      satelliteModel = applyTransform(THREE, moonGltf.scene || moonGltf.scenes?.[0], moonAsset);
      normalizePlanetHubMaterials(THREE, satelliteModel, { role: "planet" });
      satelliteModel.name = "earth-orbiting-moon-model";
      satelliteRoot = new THREE.Group();
      satelliteRoot.name = "earth-orbiting-moon";
      satelliteRoot.userData.planetHubSatellite = "moon";
      satelliteRoot.userData.planetHubBody = "moon";
      satelliteRoot.scale.setScalar(satelliteBaseScale);
      satelliteRoot.add(satelliteModel);

      // Some optimized Moon meshes have sparse/quantized triangles that are
      // visually correct but unreliable under recursive raycasting. This
      // colorless sphere follows the exact Moon transform and supplies one
      // deterministic, comfortably sized hit surface without rendering.
      satellitePickProxy = new THREE.Mesh(
        new THREE.SphereGeometry(1.16, 20, 14),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          colorWrite: false,
          depthWrite: false
        })
      );
      satellitePickProxy.name = "moon-pick-proxy";
      satellitePickProxy.userData.planetHubSatellite = "moon";
      satellitePickProxy.userData.planetHubBody = "moon";
      satelliteRoot.add(satellitePickProxy);

      satelliteHoverRing = new THREE.Mesh(
        new THREE.RingGeometry(1.08, 1.18, quality === "standard" ? 64 : 40),
        new THREE.MeshBasicMaterial({
          color: 0x9ff6ff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      satelliteHoverRing.name = "moon-hover-ring";
      satelliteHoverRing.position.z = 0.03;
      satelliteHoverRing.renderOrder = 20;
      satelliteRoot.add(satelliteHoverRing);

      satelliteHoverHalo = new THREE.Mesh(
        new THREE.SphereGeometry(1.12, quality === "standard" ? 40 : 24, quality === "standard" ? 28 : 16),
        new THREE.MeshBasicMaterial({
          color: 0x72dfff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.BackSide
        })
      );
      satelliteHoverHalo.name = "moon-hover-halo";
      satelliteRoot.add(satelliteHoverHalo);

      satelliteHoverLight = new THREE.PointLight(0xb7edff, 0.24, 4.2, 1.7);
      satelliteHoverLight.name = "moon-hover-light";
      satelliteHoverLight.position.set(0.35, 0.55, 1.35);
      satelliteRoot.add(satelliteHoverLight);

      try {
        const moonJourneyAsset = resolvePlanetHubAsset(manifest, "moon", quality, "journey");
        const moonJourneyGltf = await loadGltf(loader,
          resolveUrl(assetUrl(moonJourneyAsset), assetBaseUrl));
        const moonJourneyModel = applyTransform(
          THREE,
          moonJourneyGltf.scene || moonJourneyGltf.scenes?.[0],
          moonJourneyAsset
        );
        normalizePlanetHubMaterials(THREE, moonJourneyModel, { role: "landmark" });
        moonJourneyModel.name = "moon-journey-landing-model";
        moonJourneyPad = new THREE.Group();
        moonJourneyPad.name = "moon-journey-landing-pad";
        moonJourneyPad.visible = false;
        moonJourneyPad.add(moonJourneyModel);
        const authoredMoonDock = socketList(moonJourneyAsset, "rocketDock")[0] || [0, 0.16, 0];
        const moonRocketAsset = manifest.shared?.tiers?.[quality]?.rocket || null;
        const fittedMoonDock = calculatePlanetHubRocketDock({
          platformBounds: moonJourneyAsset.bounds,
          rocketBounds: moonRocketAsset?.bounds,
          fallback: authoredMoonDock,
          clearance: 0.004
        });
        // The pinned lightweight vendor bundle exposes Group but intentionally
        // omits the bare Object3D constructor. A Group is the same transform
        // node contract here and keeps the authored dock available at runtime.
        moonJourneyDock = new THREE.Group();
        moonJourneyDock.name = "moon-journey-rocket-dock";
        moonJourneyDock.position.copy(new THREE.Vector3(...fittedMoonDock)
          .applyMatrix4(moonJourneyModel.matrix));
        moonJourneyPad.add(moonJourneyDock);

        const materials = new Set();
        moonJourneyModel.traverse?.((child) => {
          if (!child?.isMesh || !child.material) return;
          for (const material of (Array.isArray(child.material) ? child.material : [child.material])) {
            if (material) materials.add(material);
          }
        });
        moonJourneyPadMaterials = [...materials];

        const moonPadKey = new THREE.PointLight(0xffe7c2, 0, 3.2, 1.25);
        moonPadKey.name = "moon-journey-pad-key-light";
        moonPadKey.position.set(0.34, 0.46, 0.58);
        moonPadKey.userData.planetHubFlightIntensity = 0.68;
        const moonPadFill = new THREE.PointLight(0x91e9ff, 0, 2.8, 1.35);
        moonPadFill.name = "moon-journey-pad-fill-light";
        moonPadFill.position.set(-0.4, 0.28, 0.4);
        moonPadFill.userData.planetHubFlightIntensity = 0.26;
        const moonPadRim = new THREE.PointLight(0xb9a6ff, 0, 2.8, 1.4);
        moonPadRim.name = "moon-journey-pad-rim-light";
        moonPadRim.position.set(0, 0.58, -0.3);
        moonPadRim.userData.planetHubFlightIntensity = 0.18;
        moonJourneyPadLights = [moonPadKey, moonPadFill, moonPadRim];
        moonJourneyPad.add(...moonJourneyPadLights);
        satelliteRoot.add(moonJourneyPad);
        if (canvas?.dataset) canvas.dataset.planetHubMoonPad = "ready";
      } catch (error) {
        // The flight still has a safe mathematical surface target if the
        // optional landing-platform derivative fails independently.
        moonJourneyPad = null;
        moonJourneyDock = null;
        moonJourneyPadMaterials = [];
        moonJourneyPadLights = [];
        if (canvas?.dataset) {
          canvas.dataset.planetHubMoonPad = "missing";
          canvas.dataset.planetHubMoonPadError = String(error?.message || error || "unknown").slice(0, 180);
        }
      }

      const initialMoonPose = calculatePlanetHubSatellitePose({
        elapsedMs: 0,
        reducedMotion,
        phaseOffset: celestialLayout.satellitePhaseOffset
      });
      satelliteRoot.position.set(...initialMoonPose.position);
      satelliteRoot.scale.setScalar(satelliteOverviewScale(initialMoonPose.position));
      satelliteModel.rotation.y = initialMoonPose.axialRotation;
      authoredCloseSystem.add(satelliteRoot);
    } catch {
      // The Moon is progressive Home scenery. Earth must remain fully usable if
      // the optional satellite derivative is missing or rejected by WebGL.
      satelliteRoot = null;
      satelliteModel = null;
    }
  }

  const attachPhysicalSunHandoff = () => {
    if (!sunRoot || !sunModel || !THREE?.Points || !THREE?.BufferGeometry
      || !THREE?.Float32BufferAttribute || !THREE?.ShaderMaterial) return false;
    // Native Solar System Scope uses separate view groups for immense scales.
    // Keep the physical root authoritative for lighting, picking, and atlas
    // coordinates, while an angularly equivalent near-camera proxy prevents
    // the visible sphere from being clipped by the precision-safe far plane.
    sunVisualRoot = new THREE.Group();
    sunVisualRoot.name = "planet-hub-physical-sun-model-view";
    sunVisualRoot.position.copy?.(sunRoot.position);
    sunVisualRoot.scale.copy?.(sunRoot.scale);
    sunRoot.remove?.(sunModel);
    sunVisualRoot.add(sunModel);
    sunModel.userData ||= {};
    sunModel.userData.planetHubBody = "sun";
    scene.add(sunVisualRoot);

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    sunParticleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xffdfa1) },
        opacity: { value: 0 },
        pointSize: { value: quality === "standard" ? 4.2 : 3.6 }
      },
      vertexShader: `uniform float pointSize;void main(){vec4 viewPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*viewPosition;gl_PointSize=pointSize;}`,
      fragmentShader: `uniform vec3 color;uniform float opacity;void main(){float radius=length(gl_PointCoord-vec2(.5));float core=1.-smoothstep(.05,.24,radius);float halo=1.-smoothstep(.12,.5,radius);float alpha=(core+halo*.42)*opacity;if(alpha<.001)discard;gl_FragColor=vec4(color,alpha);}`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    sunParticle = new THREE.Points(particleGeometry, sunParticleMaterial);
    sunParticle.name = "planet-hub-distant-sun-particle";
    sunParticle.frustumCulled = false;
    sunParticle.visible = false;
    sunParticle.userData.planetHubBody = "sun";

    // This zero-output sphere preserves raycast/focus access after the visible
    // surface hands off to a point.  It never writes colour or depth and is not
    // a second visual Sun.
    if (THREE?.MeshBasicMaterial && THREE?.SphereGeometry) {
      sunPickProxy = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          colorWrite: false
        })
      );
      sunPickProxy.name = "planet-hub-sun-pick-proxy";
      sunPickProxy.userData.planetHubBody = "sun";
      sunPickProxy.userData.planetHubInvisiblePickProxy = true;
      sunRoot.add(sunPickProxy);
    }
    sunRoot.add(sunParticle);
    return true;
  };

  const sunAsset = manifest.shared?.tiers?.[quality]?.sun || null;
  if (sunAsset) {
    try {
      const sunGltf = await loadGltf(loader, resolveUrl(assetUrl(sunAsset), assetBaseUrl));
      const authoredSun = applyTransform(THREE, sunGltf.scene || sunGltf.scenes?.[0], sunAsset);
      normalizePlanetHubMaterials(THREE, authoredSun, { role: "luminous" });
      let sunMaterial = null;
      authoredSun.traverse?.((child) => {
        if (!sunMaterial && child?.isMesh) {
          sunMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
        }
      });
      // The optimized source intentionally uses very little geometry. Keep its
      // authored texture/material, but project it on a deterministic sphere so
      // a large desktop Sun never exposes a faceted silhouette.
      const sunTexture = surfaceSunEmissiveMap || sunMaterial?.emissiveMap || sunMaterial?.map || null;
      if (sunTexture) sunTexture.colorSpace = THREE.SRGBColorSpace;
      sunSurfaceMaterial = createPlanetHubSunSurfaceMaterial(THREE, sunTexture, { reducedMotion });
      sunModel = new THREE.Mesh(
        new THREE.SphereGeometry(1, quality === "standard" ? 48 : 32, quality === "standard" ? 32 : 20),
        sunSurfaceMaterial
      );
      if (sunModel !== authoredSun) authoredSun.traverse?.((child) => child?.geometry?.dispose?.());
      sunModel.name = "decorative-distant-sun-model";
      sunRoot = new THREE.Group();
      sunRoot.name = "decorative-distant-sun";
      sunRoot.position.set(...PLANET_HUB_SUN_PLACEMENT.position);
      sunRoot.scale.setScalar(PLANET_HUB_SUN_PLACEMENT.scale);
      sunRoot.add(sunModel);
      scene.add(sunRoot);
      if (canvas?.dataset) {
        canvas.dataset.planetHubSun = "authored";
        canvas.dataset.planetHubSunSurface = surfaceSunEmissiveMap
          ? "manifest-emissive"
          : "model-map";
      }
    } catch {
      // Keep the celestial composition readable when the optional authored
      // derivative fails: the Sun is functional scene lighting, not a blank
      // decorative slot.
      sunSurfaceMaterial = createPlanetHubSunSurfaceMaterial(THREE, null, { reducedMotion });
      sunModel = new THREE.Mesh(
        new THREE.SphereGeometry(1, quality === "standard" ? 40 : 24, quality === "standard" ? 28 : 16),
        sunSurfaceMaterial
      );
      sunRoot = new THREE.Group();
      sunRoot.name = "procedural-distant-sun";
      sunRoot.position.set(...PLANET_HUB_SUN_PLACEMENT.position);
      sunRoot.scale.setScalar(PLANET_HUB_SUN_PLACEMENT.scale);
      sunRoot.add(sunModel);
      scene.add(sunRoot);
      if (canvas?.dataset) {
        canvas.dataset.planetHubSun = "procedural";
        canvas.dataset.planetHubSunSurface = "procedural-color";
      }
    }
  } else if (canvas?.dataset) {
    canvas.dataset.planetHubSun = "unavailable";
    delete canvas.dataset.planetHubSunSurface;
  }
  if (sunRoot) {
    attachPhysicalSunHandoff();
    const sunEffectsModule = await sunEffectsModulePromise;
    if (sunEffectsModule?.createPlanetHubSunEffectsRig) {
      sunEffects = sunEffectsModule.createPlanetHubSunEffectsRig(THREE, {
        quality,
        effectsLevel: currentEffectsLevel,
        reducedMotion
      });
      scene.add(sunEffects.root);
      if (canvas?.dataset) canvas.dataset.planetHubSunRays = "procedural-angular";
    } else if (canvas?.dataset) canvas.dataset.planetHubSunRays = "unavailable";
  }

  try {
    celestialAtlasModule = await celestialAtlasModulePromise;
    if (celestialAtlasModule?.createCelestialAtlas) {
      const orbitalScale = celestialAtlasModule.CELESTIAL_ATLAS_UNIT_SCALES?.solarUnitScale
        || PLANET_HUB_DISTANCE_METERS.au / PLANET_HUB_DISTANCE_STOPS.planet;
      celestialRegistry = celestialAtlasModule.createCelestialBodyRegistry();
      celestialAtlas = celestialAtlasModule.createCelestialAtlas(THREE, {
        registry: celestialRegistry,
        quality,
        epochDays: 73,
        originBodyId: worldId === "moon" ? "moon" : "earth",
        orbitalScale,
        galaxyTextureUrl: resolveUrl(manifest.galaxyTexture?.tiers?.[quality]?.url, assetBaseUrl),
        onInvalidate: requestRender
      });
      // Earth, Moon, and Sun retain their authored runtime art. Their atlas
      // anchors still supply deterministic chart positions and selection rings.
      for (const id of (worldId === "earth" ? ["earth", "moon", "sun"] : ["moon", "sun"])) {
        const record = celestialAtlas.getBody(id);
        if (record?.visual) {
          record.visual.visible = false;
          record.anchor.userData.planetHubAuthoredProxy = true;
        }
      }
      for (const [id, record] of celestialAtlas.bodies) {
        record.anchor.userData.planetHubBody = id;
        record.visual?.traverse?.((child) => {
          child.userData ||= {};
          child.userData.planetHubBody = id;
        });
      }
      celestialSystem.add(celestialAtlas.root);
      const atlasSun = celestialAtlas.layout.positions.sun;
      if (sunRoot && atlasSun) {
        syncSunPresentation(viewZoom.progress);
        sunRoot.userData.planetHubBody = "sun";
        sunRoot.traverse?.((child) => {
          child.userData ||= {};
          child.userData.planetHubBody = "sun";
        });
        // The authored procedural Sun is the physical atlas Sun visual. Keep
        // it inside the solar LOD root so its position, radius, orbits and
        // planets contract as one system instead of drifting apart.
        celestialAtlas.solarRoot.add(sunRoot);
        sunSystemLight = new THREE.PointLight(0xffd6a3, 0, 0, 0);
        sunSystemLight.name = "planet-hub-physical-sun-light";
        sunSystemLight.castShadow = false;
        sunRoot.add(sunSystemLight);
      }
      celestialAtlas.setSelectedBody(worldId);
      spaceEnvironment?.setWorldGridAnchor?.({
        scope: "system",
        position: atlasSun || [0, 0, 0],
        bodyRadius: celestialRegistry.sun.radius
      });
      if (canvas?.dataset) {
        canvas.dataset.planetHubCelestialAtlas = "ready";
        canvas.dataset.planetHubCelestialBodies = String(celestialAtlas.bodies.size);
      }
    }
  } catch (error) {
    celestialAtlas?.dispose?.();
    celestialAtlas = null;
    celestialRegistry = null;
    celestialSemanticPresentation = null;
    if (canvas?.dataset) {
      canvas.dataset.planetHubCelestialAtlas = "fallback";
      canvas.dataset.planetHubCelestialAtlasError = String(error?.message || error || "unknown").slice(0, 160);
    }
  }

  for (const road of createGreatCircleRoads({
    worldId,
    anchors,
    pointsPerSegment: quality === "standard" ? 33 : 21
  })) {
    const curve = new THREE.CatmullRomCurve3(road.points.map((point) => new THREE.Vector3(...point)));
    const geometry = new THREE.TubeGeometry(curve, road.points.length - 1, quality === "standard" ? 0.004 : 0.005, 4, false);
    const material = createPlanetHubRoadMaterial(THREE);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `road-${road.from}-${road.to}`;
    mesh.userData.planetHubRoad = {
      from: road.from,
      to: road.to,
      midpoint: [...road.points[Math.floor(road.points.length / 2)]]
    };
    mesh.visible = availableDestinations.includes(road.from) && availableDestinations.includes(road.to);
    world.add(mesh);
    roadRoots.push(mesh);
  }

  atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(worldId === "moon" ? 0x9fb9de : 0x55bfff) },
      hazeColor: { value: new THREE.Color(worldId === "moon" ? 0x9fb9de : 0xffa86e) },
      sunDirection: { value: new THREE.Vector3(...PLANET_HUB_SUN_PLACEMENT.position).normalize() },
      atmosphereStrength: { value: worldId === "moon" ? 0.035 : 0.22 },
      horizonHaze: { value: worldId === "moon" ? 0 : 0.3 }
    },
    vertexShader: `varying vec3 vWorldNormal; varying vec3 vView; void main(){ vec4 worldPosition=modelMatrix*vec4(position,1.0); vWorldNormal=normalize(mat3(modelMatrix)*normal); vView=normalize(cameraPosition-worldPosition.xyz); gl_Position=projectionMatrix*viewMatrix*worldPosition; }`,
    // Front-facing by default: density fades to zero at the outer silhouette.
    fragmentShader: `uniform vec3 glowColor; uniform vec3 hazeColor; uniform vec3 sunDirection;uniform float atmosphereStrength; uniform float horizonHaze;varying vec3 vWorldNormal; varying vec3 vView;void main(){vec3 normal=normalize(vWorldNormal);float facing=max(dot(normal,normalize(vView)),0.0);float solar=dot(normal,normalize(sunDirection));float daylight=smoothstep(-0.24,0.5,solar);float twilight=1.0-smoothstep(0.0,0.32,abs(solar));float density=pow(1.0-facing,3.2)*smoothstep(0.0,0.28,facing);vec3 scattering=mix(glowColor,hazeColor,twilight*horizonHaze*0.24);float alpha=density*atmosphereStrength*(0.12+daylight*0.88)*1.8;gl_FragColor=vec4(scattering,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: true
  });
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(worldId === "earth" ? 1.028 : 1.006, quality === "standard" ? 96 : 48, quality === "standard" ? 64 : 32),
    atmosphereMaterial
  );
  atmosphere.name = "procedural-atmosphere";
  world.add(atmosphere);

  function orientSite(root, destination) {
    const anchor = anchors[destination];
    root.position.set(...anchor.position);
    const tangent = new THREE.Vector3(...anchor.tangent);
    const normal = new THREE.Vector3(...anchor.normal);
    const bitangent = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    const basis = new THREE.Matrix4().makeBasis(tangent, normal, bitangent);
    root.quaternion.setFromRotationMatrix(basis);
  }

  function addLandmarkHoverEffect(root, destination) {
    const focus = new THREE.Group();
    focus.name = `landmark-studio-light-${destination}`;
    focus.userData.planetHubHoverEffect = true;

    // Local +Z is the authored facade and is rotated toward the camera by the
    // presentation quaternion. A warm key reveals the albedo, a cyan fill
    // opens the shadow side, and a violet rim separates the silhouette. The
    // lights are deliberately short-range and layer-isolated: no visible beam,
    // halo, ring, or billboard is allowed to intersect authored geometry.
    const destinationLayer = 3 + PLANET_HUB_DESTINATIONS.indexOf(destination);
    const localLight = new THREE.PointLight(0xffe5bf, 0, 1.28, 1.65);
    localLight.name = "landmark-focus-key-light";
    localLight.position.set(0.34, 0.42, 0.62);
    localLight.layers.set(destinationLayer);
    focus.add(localLight);

    const localFillLight = new THREE.PointLight(0x8feaff, 0, 1.08, 1.8);
    localFillLight.name = "landmark-focus-fill-light";
    localFillLight.position.set(-0.36, 0.22, 0.42);
    localFillLight.layers.set(destinationLayer);
    focus.add(localFillLight);

    const localRimLight = new THREE.PointLight(0xbda5ff, 0, 1.18, 1.75);
    localRimLight.name = "landmark-focus-rim-light";
    localRimLight.position.set(0, 0.56, -0.28);
    localRimLight.layers.set(destinationLayer);
    focus.add(localRimLight);

    // The affordance must not enlarge the landmark's clickable silhouette;
    // otherwise the transparent rings can recursively pick themselves.
    focus.traverse?.((child) => {
      child.userData ||= {};
      child.userData.planetHubHoverEffect = true;
    });

    root.add(focus);
    hoverEffects.set(destination, {
      root: focus,
      light: localLight,
      fillLight: localFillLight,
      rimLight: localRimLight,
      lights: [localLight, localFillLight, localRimLight],
      level: 0,
      selectionLevel: 0,
      focusLevel: 0,
      startedAt: 0
    });
  }

  async function addLandmark(destination) {
    const asset = resolvePlanetHubAsset(manifest, worldId, quality, destination);
    const gltf = await loadGltf(loader, resolveUrl(assetUrl(asset), assetBaseUrl));
    const model = applyTransform(THREE, gltf.scene || gltf.scenes?.[0], asset);
    normalizePlanetHubMaterials(THREE, model, { role: "landmark" });
    const destinationLayer = 3 + PLANET_HUB_DESTINATIONS.indexOf(destination);
    model.traverse?.((child) => child.layers?.enable?.(destinationLayer));
    const root = new THREE.Group();
    root.name = `site-${destination}`;
    orientSite(root, destination);
    root.add(model);
    const contactRadius = destination === "journey" ? 0.31 : destination === "arena" ? 0.28 : 0.24;
    const contactShadow = new THREE.Mesh(
      new THREE.RingGeometry(0.001, contactRadius, quality === "standard" ? 48 : 28),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec2 vUv; void main(){ float distanceFromCenter=length((vUv-.5)*2.); float alpha=(1.-smoothstep(.08,1.,distanceFromCenter))*.38; gl_FragColor=vec4(.001,.006,.015,alpha); }`,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        toneMapped: false
      })
    );
    contactShadow.name = `landmark-contact-shadow-${destination}`;
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.0025;
    contactShadow.scale.y = 0.68;
    contactShadow.renderOrder = 1;
    contactShadow.userData.planetHubHoverEffect = true;
    root.add(contactShadow);
    landmarkModels.set(destination, model);
    // Landmarks are intentionally larger than their physically literal scale:
    // they are destinations in a game UI, not miniature satellite photography.
    root.scale.setScalar(quality === "standard" ? 1.16 : 1.22);
    root.visible = availableSet.has(destination);
    setDestinationMetadata(root, destination);
    world.add(root);
    interactiveRoots.push(root);
    siteRoots.set(destination, root);

    if (destination === "journey") {
      const rocketAsset = manifest.shared?.tiers?.[quality]?.rocket || null;
      let rocket = model;
      if (rocketAsset) {
        const rocketGltf = await loadGltf(loader, resolveUrl(assetUrl(rocketAsset), assetBaseUrl));
        rocket = applyTransform(THREE, rocketGltf.scene || rocketGltf.scenes?.[0], rocketAsset);
        const authoredRocketHeight = Number(rocketAsset?.bounds?.max?.[1])
          - Number(rocketAsset?.bounds?.min?.[1]);
        if (Number.isFinite(authoredRocketHeight) && authoredRocketHeight > 0) {
          journeyRocketBoundsHeight = authoredRocketHeight;
        }
        normalizePlanetHubMaterials(THREE, rocket, { role: "vehicle" });
        rocket.name = "journey-rocket";
        const authoredDock = socketList(asset, "rocketDock")[0] || [0, 0.16, 0];
        // Socket coordinates are authored in the landing model's unscaled
        // local space. Transform that socket through the platform model matrix
        // before assigning it to the sibling rocket. Mixing a world-space Box3
        // with this root-local position is what previously left the rocket
        // floating visibly above its pad.
        const dock = new THREE.Vector3(...authoredDock).applyMatrix4(model.matrix);
        rocket.position.copy(dock);
        // Keep the rocket as a sibling of the landing platform. Nesting it in
        // the already-scaled platform multiplied both scales and reduced the
        // hero vehicle to an almost invisible miniature in Journey views.
        root.add(rocket);
        setDestinationMetadata(rocket, destination);
        rocket.userData.planetHubAction = "journey-launch";
        const rocketPickProxy = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 1.06, 12),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            colorWrite: false,
            depthWrite: false
          })
        );
        rocketPickProxy.name = "journey-rocket-pick-proxy";
        rocketPickProxy.position.y = 0.5;
        rocketPickProxy.userData.planetHubDestination = destination;
        rocketPickProxy.userData.planetHubAction = "journey-launch";
        rocket.add(rocketPickProxy);
      }
      journeyRocket = rocket;
      const sockets = socketList(rocketAsset || asset, "engine");
      for (const socket of sockets.length ? sockets : [[0, -0.04, 0]]) {
        const plume = new THREE.Group();
        plume.name = "procedural-engine-plume";
        plume.position.set(...socket.slice(0, 3));
        plume.userData.planetHubHoverEffect = true;
        const outer = new THREE.Mesh(
          new THREE.ConeGeometry(0.068, 0.5, 16, 1, true),
          createPlanetHubEnginePlumeMaterial(THREE, {
            color: 0x42ccff,
            hotColor: 0xe9fbff,
            quality,
            phase: flameMeshes.length * 0.71
          })
        );
        outer.name = "procedural-engine-flame";
        outer.position.y = -0.25;
        outer.userData.planetHubHoverEffect = true;
        plume.add(outer);
        const core = new THREE.Mesh(
          new THREE.ConeGeometry(0.035, 0.3, 12, 1, true),
          createPlanetHubEnginePlumeMaterial(THREE, {
            color: 0xffca72,
            hotColor: 0xffffff,
            quality,
            core: true,
            phase: flameMeshes.length * 0.71 + 0.23
          })
        );
        core.name = "procedural-engine-core";
        core.position.y = -0.15;
        core.userData.planetHubHoverEffect = true;
        plume.add(core);
        const light = new THREE.PointLight(0xffc27a, 0, quality === "standard" ? 1.45 : 1.15, 1.6);
        light.name = "procedural-engine-light";
        light.position.y = -0.06;
        plume.add(light);
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, quality === "standard" ? 16 : 10, quality === "standard" ? 10 : 7),
          new THREE.MeshBasicMaterial({
            color: 0xffd69b,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false
          })
        );
        glow.name = "procedural-engine-nozzle-glow";
        glow.position.y = -0.045;
        glow.userData.planetHubHoverEffect = true;
        plume.add(glow);
        rocket.add(plume);
        flameMeshes.push(outer, core);
        flameLights.push(light);
        flameGlows.push(glow);
      }
    }
    const materials = new Set();
    root.traverse?.((child) => {
      if (!child?.isMesh || child.userData?.planetHubHoverEffect) return;
      const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of childMaterials) {
        if (material?.userData?.planetHubNormalized) materials.add(material);
      }
    });
    landmarkMaterials.set(destination, [...materials]);
    addLandmarkHoverEffect(root, destination);
    return root;
  }

  await Promise.all(PLANET_HUB_DESTINATIONS.map(addLandmark));
  async function addPortalSurface() {
    const arena = siteRoots.get("arena");
    const arenaModel = landmarkModels.get("arena");
    if (!arena || !arenaModel || !manifest.portal) return;
    const posterUrl = resolveUrl(manifest.portal.poster, assetBaseUrl);
    const posterTexture = await new THREE.TextureLoader().loadAsync(posterUrl);
    posterTexture.colorSpace = THREE.SRGBColorSpace;
    const material = createPackedPortalMaterial(THREE, posterTexture);
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), material);
    surface.name = "packed-portal-surface";
    const arenaAsset = resolvePlanetHubAsset(manifest, worldId, quality, "arena");
    const socket = socketList(arenaAsset, "portal")[0] || socketList(arenaAsset, "vfx")[0] || [0, 0.09, 0.01];
    // Manifest sockets are authored in the portal model's pre-transform local
    // coordinates. The portal itself is scaled beneath the oriented site root,
    // so a raw site-space position put the video above the visible aperture.
    const aperturePosition = new THREE.Vector3(...socket.slice(0, 3)).applyMatrix4(arenaModel.matrix);
    surface.position.copy(aperturePosition);
    surface.quaternion.copy(arenaModel.quaternion);
    surface.scale.copy(arenaModel.scale);
    // The supplied portal transform has no local rotation, so site-local +Z is
    // the authored facade direction. A tiny offset prevents coplanar flicker
    // without lifting the media out of the physical ring.
    surface.position.z += 0.018;
    surface.renderOrder = 4;
    surface.frustumCulled = false;
    arena.add(surface);

    const video = documentRef?.createElement?.("video");
    if (video) {
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";
      for (const [type, url] of [["video/webm", manifest.portal.webm], ["video/mp4", manifest.portal.mp4]]) {
        const source = documentRef.createElement("source");
        source.type = type;
        source.src = resolveUrl(url, assetBaseUrl);
        video.append(source);
      }
    }
    portal = { video, surface, material, posterTexture, videoTexture: null, videoFrameHandle: 0 };
  }

  await addPortalSurface();

  function retargetCinematicMood(destination = committedDestination, { animate = true } = {}) {
    const normalized = normalizePlanetHubDestination(destination);
    const target = resolvePlanetHubDestinationMood(normalized, {
      worldId,
      quality,
      effectsLevel: currentEffectsLevel,
      reducedMotion
    });
    const now = windowRef?.performance?.now?.() || 0;
    if (!animate) {
      moodState = target;
      moodTransition = null;
      moodTransitionPhases = null;
    } else {
      moodTransition = retargetPlanetHubMoodTransition({
        transition: moodTransition,
        current: moodState,
        to: target,
        nowMs: now,
        reducedMotion
      });
    }
    if (canvas?.dataset) {
      canvas.dataset.planetHubMood = `${target.region}:${target.scene}`;
      canvas.dataset.planetHubMoodDestination = normalized;
    }
    requestRender();
    return target;
  }

  function applyCinematicMood(state = moodState, now = 0) {
    if (!state) return false;
    const celestial = state.celestial;
    const chartBlend = viewZoom.progress * viewZoom.progress * (3 - 2 * viewZoom.progress);
    renderer.toneMappingExposure = celestial.exposure;
    hemisphereLight.color.setHex?.(celestial.hemisphereSkyColor);
    hemisphereLight.groundColor.setHex?.(celestial.hemisphereGroundColor);
    const chartLighting = Math.max(0.42, 1 - viewZoom.progress * 0.58);
    hemisphereLight.intensity = celestial.hemisphere * chartLighting;
    ambientLight.color.setHex?.(celestial.ambientColor);
    ambientLight.intensity = celestial.ambient * Math.max(0.36, chartLighting);
    if (worldId === "earth" && planetSurfaceMaterial) {
      // Terrain reflects sunlight; an albedo-emission floor flattened the
      // night side and muddied oceans. Site-local lights own building accents.
      planetSurfaceMaterial.emissiveIntensity = 0;
    }
    keyLight.color.setHex?.(worldId === "earth" ? 0xfff7eb : celestial.keyColor);
    keyLight.intensity = celestial.key * Math.max(0.28, 1 - chartBlend * 0.72);
    if (sunSystemLight) sunSystemLight.intensity = chartBlend * (quality === "standard" ? 4.2 : 3.6);
    fillLight.color.setHex?.(celestial.fillColor);
    fillLight.position.set(...celestial.fillDirection).multiplyScalar(7);
    fillLight.intensity = celestial.fill * Math.max(0.28, 1 - viewZoom.progress * 0.72);
    rimLight.color.setHex?.(celestial.rimColor);
    rimLight.position.set(...celestial.rimDirection).multiplyScalar(7);
    rimLight.intensity = celestial.rim * Math.max(0.4, 1 - viewZoom.progress * 0.52);

    // Landmark visibility is now supplied by the isolated studio lights. A
    // second global Arena lightning flash used to wash the planet and stack on
    // top of the structure-local storm planes, so it is intentionally absent.

    if (atmosphereMaterial?.uniforms) {
      atmosphereMaterial.uniforms.glowColor.value.setHex(state.atmosphere.color);
      atmosphereMaterial.uniforms.hazeColor.value.setHex(state.atmosphere.hazeColor);
      atmosphereMaterial.uniforms.atmosphereStrength.value = state.atmosphere.strength;
      atmosphereMaterial.uniforms.horizonHaze.value = state.atmosphere.horizonHaze;
    }

    if (surfaceCloudLayer) {
      // Cloud coverage is authored in the texture alpha. Destination ambience
      // may tint a building, but should not make Earth's weather disappear.
      surfaceCloudLayer.material.opacity = worldId === "earth" ? 0.86 : state.atmosphere.cloudOpacity;
      if (!reducedMotion && state.effects.animated) surfaceCloudLayer.rotation.y += 0.000045;
    }
    if (surfaceNightLayer) {
      surfaceNightLayer.material.uniforms.opacity.value = state.atmosphere.nightOpacity;
    }

    updateSunLightingRig(now);

    for (const [destination, effect] of hoverEffects) {
      const destinationMood = resolvePlanetHubDestinationMood(destination, {
        worldId,
        quality,
        effectsLevel: currentEffectsLevel,
        reducedMotion
      });
      effect.light.color.setHex?.(destinationMood.local.keyColor);
      effect.fillLight.color.setHex?.(destinationMood.local.fillColor);
      effect.rimLight.color.setHex?.(destinationMood.local.rimColor);
    }

    for (const road of roadRoots) {
      const metadata = road.userData.planetHubRoad;
      const midpoint = new THREE.Vector3(...metadata.midpoint)
        .normalize();
      const roadState = calculatePlanetHubRoadMood({
        roadFrom: metadata.from,
        roadTo: metadata.to,
        activeDestination: committedDestination,
        frontFacing: midpoint.dot(cameraFacing),
        elapsedMs: now,
        mood: state,
        reducedMotion,
        effectsLevel: currentEffectsLevel
      });
      updatePlanetHubRoadMaterial(road.material, roadState, {
        elapsedMs: now,
        reducedMotion
      });
    }
    return false;
  }

  function updateCinematicMood(now) {
    let transitioning = false;
    if (moodTransition) {
      const sample = samplePlanetHubMoodTransition(moodTransition, now);
      moodState = sample.state;
      moodTransitionPhases = sample.phases;
      if (sample.complete) {
        moodState = moodTransition.to;
        moodTransition = null;
      } else transitioning = true;
    }
    const flashActive = applyCinematicMood(moodState, now);
    return transitioning || flashActive;
  }

  applyCinematicMood(moodState, windowRef?.performance?.now?.() || 0);

  function restoreHomeCamera({ updateProjection = true, preserveOrientation = false } = {}) {
    let nextOrbit;
    if (preserveOrientation) {
      const base = calculateHomeBaseCameraPose();
      const retained = cloneCameraOrbitState();
      nextOrbit = {
        ...retained,
        target: hubMode === "overview"
          ? overviewOrbitWithViewZoom(retained).target
          : retained.target,
        radius: hubMode === "overview"
          ? renderCameraRadius(viewZoom.progress)
          : retained.radius,
        velocity: { yaw: 0, pitch: 0 }
      };
    } else {
      nextOrbit = presentationTarget(
        focusedDestination || committedDestination,
        hubMode
      ).cameraOrbit;
    }
    setCameraOwner(hubMode === "focused" ? "landmark-focus" : "home-orbit");
    if (hubMode === "overview" && !activeNavigationFocusId()) {
      ({ near: camera.near, far: camera.far } = resolvePlanetHubPrecisionFrustum({
        localDollyFactor: representedDistance.localDollyFactor,
        far: canonicalFar
      }));
    } else camera.far = canonicalFar;
    const pose = applyCameraOrbitState(nextOrbit, { updateProjection });
    return pose.radius;
  }

  function resize() {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect?.() || { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 };
    const width = Math.max(1, Math.floor(rect.width || 1));
    const height = Math.max(1, Math.floor(rect.height || 1));
    const viewportChanged = width !== viewportWidth || height !== viewportHeight;
    renderer.setSize(width, height, false);
    viewportWidth = width;
    viewportHeight = height;
    camera.aspect = width / height;
    celestialLayout = calculatePlanetHubCelestialLayout({ aspect: camera.aspect });
    recalculateZoomBounds({ apply: false });
    applyCinematicMood(moodState, windowRef?.performance?.now?.() || 0);
    // A visual-viewport change may happen in the middle of the flight. Keep
    // the live chase pose (or the Moon arrival handoff pose) and only update
    // its projection; normal Home framing is recalculated once the shot ends.
    if (!journeyDeparture && !journeyCameraHeldForHandoff) {
      if (activeNavigationFocusId() || bodyFocusTransition) {
        reframeCelestialBodyFocus();
      } else if (transition) {
        const target = presentationTarget(focusedDestination || committedDestination, hubMode);
        transition.orbitTo = cloneCameraOrbitState(target.cameraOrbit);
      } else if (hubMode === "overview") {
        restoreHomeCamera({ updateProjection: false, preserveOrientation: true });
      }
    }
    camera.updateProjectionMatrix();
    spaceEnvironment?.resize?.({
      width,
      height,
      pixelRatio: renderer.getPixelRatio?.() || 1,
      camera
    });
    celestialCosmology?.setRenderContext?.({
      viewportWidth: width,
      viewportHeight: height,
      devicePixelRatio: renderer.getPixelRatio?.() || 1,
      moving: Boolean(transition || bodyFocusTransition || journeyDeparture)
    });
    if (hubMode === "focused" && viewportChanged) {
      if (!transition) {
        startPresentationTransition(focusedDestination || committedDestination, {
          animate: true,
          mode: "focused",
          kind: "focus-reframe"
        });
      }
    }
    requestRender();
  }

  function updateFlames(now) {
    const active = now < ignitionUntil;
    const target = Math.max(active ? ignitionBurstLevel : 0, ignitionLevel, rocketHoverLevel);
    for (const flame of flameMeshes) {
      const pulse = reducedMotion ? 1 : 0.86 + Math.sin(now * 0.028) * 0.14;
      const isCore = flame.name === "procedural-engine-core";
      updatePlanetHubEnginePlumeMaterial(flame.material, {
        opacity: target * (isCore ? 0.58 : 0.28),
        timeMs: now,
        reducedMotion
      });
      flame.scale.set(
        0.62 + target * (isCore ? 0.18 : 0.3),
        Math.max(0.04, target * pulse * (isCore ? 0.86 : 1.42)),
        0.62 + target * (isCore ? 0.18 : 0.3)
      );
      flame.visible = target > 0.001;
    }
    for (const light of flameLights) {
      light.intensity = target * (cinematicLighting.engine
        + (reducedMotion ? 0 : Math.sin(now * 0.031) * 0.18));
      light.visible = target > 0.001;
    }
    for (const glow of flameGlows) {
      glow.material.opacity = target * (reducedMotion ? 0.28 : 0.24 + Math.sin(now * 0.026) * 0.045);
      glow.scale.setScalar(0.72 + target * (reducedMotion ? 0.28 : 0.34));
      glow.visible = target > 0.001;
    }
    return active || (!reducedMotion && target > 0);
  }

  function updateLandmarkHoverEffects(now, deltaSeconds) {
    let keepRendering = false;
    for (const [destination, effect] of hoverEffects) {
      const hoverTarget = hoveredDestination === destination ? 1 : 0;
      const selectionTarget = committedDestination === destination ? 1 : 0;
      const focusTarget = hubMode === "focused" && focusedDestination === destination ? 1 : 0;
      if (reducedMotion) {
        effect.level = hoverTarget;
        effect.selectionLevel = selectionTarget;
        effect.focusLevel = focusTarget;
      }
      else {
        const seconds = Math.max(0, deltaSeconds);
        const easeChannel = (current, target, rate) => {
          const next = current + (target - current) * (1 - Math.exp(-rate * seconds));
          return Math.abs(target - next) < 0.002 ? target : next;
        };
        // Hover responds first, while selected and focused studio lighting
        // blooms over roughly half a second instead of snapping on a tab click.
        effect.level = easeChannel(effect.level, hoverTarget, 6.5);
        effect.selectionLevel = easeChannel(effect.selectionLevel, selectionTarget, 5.4);
        effect.focusLevel = easeChannel(effect.focusLevel, focusTarget, 4.8);
      }
      const values = calculatePlanetHubHoverFocus({
        level: effect.level,
        selected: effect.selectionLevel,
        focused: effect.focusLevel,
        elapsedMs: Math.max(0, now - effect.startedAt),
        reducedMotion
      });
      const lightIntensities = [values.lightIntensity, values.fillIntensity, values.rimIntensity];
      effect.lights.forEach((light, index) => {
        light.intensity = lightIntensities[index] || 0;
      });
      // A small albedo-preserving emissive floor keeps black and bronze assets
      // readable when the world is enlarged. It uses each authored texture as
      // its own fill, so selection reveals the real colors instead of tinting
      // or flattening the model like a screen-space glow would.
      const materialLift = effect.selectionLevel * 0.012
        + effect.focusLevel * 0.014
        + effect.level * 0.006;
      for (const material of landmarkMaterials.get(destination) || []) {
        if (material.map && material.emissiveMap !== material.map) {
          material.emissiveMap = material.map;
          material.emissive?.setHex?.(0xffffff);
          material.needsUpdate = true;
        }
        material.emissiveIntensity = materialLift;
      }
      effect.root.visible = effect.level > 0.001 || effect.lights.some((light) => light.intensity > 0);
      keepRendering ||= !reducedMotion && (
        hoverTarget > 0
        || Math.abs(hoverTarget - effect.level) > 0.002
        || Math.abs(selectionTarget - effect.selectionLevel) > 0.002
        || Math.abs(focusTarget - effect.focusLevel) > 0.002
      );
    }
    return keepRendering;
  }

  function updateSatellite(now, deltaSeconds) {
    if (!satelliteRoot || !satelliteModel) return false;
    // The ring is a hover/click affordance, not a permanent frame. Once the
    // Moon becomes the hero, retain only a faint focus trace around the body.
    const hoverTarget = bodyFocusId === "moon"
      ? 0.16
      : selectedBodyId === "moon" ? 0.72 : (satelliteHovered ? 1 : 0);
    if (reducedMotion) satelliteHoverLevel = hoverTarget;
    else {
      const alpha = 1 - Math.exp(-10 * Math.max(0, deltaSeconds));
      satelliteHoverLevel += (hoverTarget - satelliteHoverLevel) * alpha;
      if (Math.abs(hoverTarget - satelliteHoverLevel) < 0.002) satelliteHoverLevel = hoverTarget;
    }
    const pulse = reducedMotion ? 0.5 : 0.5 + Math.sin(now * 0.0055) * 0.5;
    satelliteHoverRing.material.opacity = satelliteHoverLevel * (0.62 + pulse * 0.22);
    satelliteHoverHalo.material.opacity = satelliteHoverLevel * (0.08 + pulse * 0.09);
    satelliteHoverLight.intensity = 0.24 + satelliteHoverLevel * (0.72 + pulse * 0.34);

    if (!journeyDeparture) {
      const elapsedMs = Math.max(0, now - satelliteOrbitStartedAt);
      const pose = calculatePlanetHubSatellitePose({
        elapsedMs,
        reducedMotion,
        phaseOffset: celestialLayout.satellitePhaseOffset
      });
      let satellitePosition = pose.position;
      if (reducedMotion && hubMode === "overview") {
        const outwardToCamera = camera.position.clone()
          .sub(new THREE.Vector3(...cameraOrbitState.target))
          .normalize();
        const screenRight = new THREE.Vector3(1, 0, 0)
          .applyQuaternion(camera.quaternion)
          .normalize();
        const screenUp = new THREE.Vector3(0, 1, 0)
          .applyQuaternion(camera.quaternion)
          .normalize();
        satellitePosition = calculatePlanetHubReducedMotionSatellitePosition({
          outwardToCamera: outwardToCamera.toArray(),
          screenRight: screenRight.toArray(),
          screenUp: screenUp.toArray()
        });
      }
      const satelliteLocalPosition = Array.isArray(satellitePosition)
        ? new THREE.Vector3(...satellitePosition) : satellitePosition.clone();
      const moonAnchor = celestialAtlas?.bodies?.get?.("moon")?.anchor;
      const physicalChartBlend = physicalSolarChartBlend();
      if (moonAnchor && physicalChartBlend > 0) {
        authoredCloseSystem.updateMatrixWorld?.(true);
        celestialSystem.updateMatrixWorld?.(true);
        moonAnchor.getWorldPosition(authoredHandoffPosition);
        authoredCloseSystem.worldToLocal(authoredHandoffPosition);
        satelliteLocalPosition.lerp(authoredHandoffPosition, physicalChartBlend);
      }
      satelliteRoot.position.copy(satelliteLocalPosition);
      satelliteRoot.scale.setScalar(satelliteOverviewScale(satelliteLocalPosition));
      satelliteModel.rotation.y = pose.axialRotation;
      if (bodyFocusId === "moon" && !bodyFocusTransition) {
        satelliteRoot.updateMatrixWorld?.(true);
        const moonWorldPosition = satelliteRoot.getWorldPosition(new THREE.Vector3());
        const previousTarget = new THREE.Vector3(...cameraOrbitState.target);
        if (moonWorldPosition.distanceToSquared(previousTarget) > 1e-12) {
          applyCameraOrbitState({
            ...cameraOrbitState,
            target: moonWorldPosition.toArray()
          });
        }
        spaceEnvironment?.setWorldGridAnchor?.({
          position: moonWorldPosition.toArray(),
          bodyRadius: satelliteRoot.scale.x
        });
      }
    }
    return !reducedMotion;
  }

  function updateSunLightingRig(now = 0) {
    const planetWorldPosition = world.getWorldPosition(new THREE.Vector3());
    const planetWorldScale = world.getWorldScale(new THREE.Vector3());
    const visibleSunPosition = sunRoot
      ? sunRoot.getWorldPosition(new THREE.Vector3())
      : new THREE.Vector3(...celestialLayout.sunPosition);
    const lighting = calculatePlanetHubSunLightingRig({
      sunPosition: visibleSunPosition.toArray(),
      planetPosition: planetWorldPosition.toArray(),
      keyDistance: 8
    });
    keyLight.position.set(...lighting.keyPosition);
    keyLight.target.position.set(...lighting.targetPosition);
    keyLight.target.updateMatrixWorld?.();
    atmosphereMaterial?.uniforms?.sunDirection?.value?.set?.(...lighting.direction);
    surfaceNightLayer?.material?.uniforms?.sunDirection?.value?.set?.(...lighting.direction);
    // Journey cinematics temporarily hide the physical Sun. Keep its optical
    // pass in lockstep so a detached corona cannot remain over the flight.
    if (sunRoot?.visible === false && journeyDeparture) {
      if (sunEffects?.root) sunEffects.root.visible = false;
      if (sunModel) sunModel.visible = false;
      if (sunVisualRoot) sunVisualRoot.visible = false;
      if (sunParticle) sunParticle.visible = false;
      sunEffectiveLod = Object.freeze({
        ...sunLod,
        modelOpacity: 0,
        particleOpacity: 0,
        glareOpacity: 0,
        particleOwner: "none"
      });
      return { ...lighting, effectsAnimated: false };
    }
    let effectsAnimated = false;
    if (sunRoot) {
      let visibility = 1;
      const sunRadius = Math.max(0,
        Math.abs(sunRoot.getWorldScale?.(new THREE.Vector3())?.x
          || sunRoot.scale?.x || PLANET_HUB_SUN_PLACEMENT.scale));
      const cameraDistance = camera.position.distanceTo(visibleSunPosition);
      sunLod = resolvePlanetHubSunLod({
        physicalWorldRadius: sunRadius,
        cameraDistance,
        verticalFovDegrees: camera.fov,
        viewportHeight,
        progress: viewZoom.progress
      });
      const solarDetailOpacity = Math.max(0, Math.min(1,
        Number(celestialSemanticPresentation?.solarDetailOpacity ?? 1)));
      const modelOpacity = sunLod.modelOpacity * solarDetailOpacity;
      const particleOpacity = sunLod.particleOpacity * solarDetailOpacity;
      const atlasParticleOpacity = Math.max(0, Math.min(1,
        Number(celestialSemanticPresentation?.solarMarkerOpacity) || 0));
      const effectiveParticleOpacity = Math.max(0, Math.min(1,
        particleOpacity + atlasParticleOpacity));
      const particleOwner = particleOpacity > 0.001 && atlasParticleOpacity > 0.001
        ? "crossfade" : atlasParticleOpacity > 0.001 ? "atlas"
          : particleOpacity > 0.001 ? "local" : "none";
      const effectiveMode = modelOpacity > 0.001 && effectiveParticleOpacity > 0.001
        ? "model-particle" : modelOpacity > 0.001 ? "model" : "particle";
      sunEffectiveLod = Object.freeze({
        ...sunLod,
        mode: effectiveMode,
        modelOpacity,
        particleOpacity: effectiveParticleOpacity,
        glareOpacity: sunLod.glareOpacity * solarDetailOpacity,
        particleOwner
      });
      if (sunSurfaceMaterial?.uniforms?.modelOpacity) {
        sunSurfaceMaterial.uniforms.modelOpacity.value = modelOpacity;
      }
      if (sunModel) sunModel.visible = modelOpacity > 0.001;
      if (sunVisualRoot) {
        const proxyDistance = Math.min(cameraDistance,
          Math.max(camera.near * 8, camera.far * 0.72));
        chartBodyWorldPosition.copy(visibleSunPosition).sub(camera.position);
        if (chartBodyWorldPosition.lengthSq() > 1e-16) chartBodyWorldPosition.normalize();
        sunVisualRoot.position.copy(camera.position)
          .addScaledVector(chartBodyWorldPosition, proxyDistance);
        sunVisualRoot.scale.setScalar(sunRadius * proxyDistance
          / Math.max(Number.EPSILON, cameraDistance));
        sunVisualRoot.visible = modelOpacity > 0.001;
      }
      if (sunParticleMaterial?.uniforms?.opacity) {
        sunParticleMaterial.uniforms.opacity.value = particleOpacity;
      }
      if (sunParticle) sunParticle.visible = particleOpacity > 0.001;
      // The glare is one spatial light, so every rendered celestial body can
      // eclipse it. The previous Earth-only check let rays shine through the
      // Moon and generated planets, breaking the shared-world illusion.
      for (const body of Object.values(celestialRegistry || { [worldId]: { id: worldId, radius: 1 } })) {
        if (body.id === "sun") continue;
        const atlasRecord = celestialAtlas?.getBody?.(body.id);
        if (body.id !== worldId
          && body.id !== "moon"
          && atlasRecord?.visual?.visible === false) continue;
        const record = getCelestialBodyRecord(body.id);
        if (!record?.root) continue;
        const position = getCelestialBodyWorldPosition(body.id);
        if (!position) continue;
        const radius = getCelestialBodyWorldRadius(record);
        const result = calculatePlanetHubSunDiscVisibility({
          cameraPosition: camera.position.toArray(),
          planetPosition: position.toArray(),
          planetRadius: Math.max(0.001, radius),
          sunPosition: visibleSunPosition.toArray(),
          sunRadius
        });
        if (result.visibility < visibility) visibility = result.visibility;
      }
      effectsAnimated = sunEffects?.update?.({
        camera,
        sunPosition: visibleSunPosition.toArray(),
        physicalRadius: sunRadius,
        discVisibility: visibility,
        elapsedSeconds: Math.max(0, now - sunStartedAt) / 1000,
        opacity: sunLod.glareOpacity * solarDetailOpacity,
        // This only shapes the corona around the current physical angular
        // radius. It never substitutes a fixed screen-space Sun diameter.
        scale: sunLod.glareScale
      }) || false;
    }
    return { ...lighting, effectsAnimated };
  }

  function updateSun(now) {
    const lighting = updateSunLightingRig(now);
    if (!sunModel) return false;
    sunModel.rotation.y = calculatePlanetHubSunRotation({
      elapsedMs: Math.max(0, now - sunStartedAt),
      reducedMotion
    });
    if (sunSurfaceMaterial?.uniforms?.time) {
      sunSurfaceMaterial.uniforms.time.value = Math.max(0, now - sunStartedAt) / 1000;
    }
    return lighting.effectsAnimated || (!reducedMotion && currentEffectsLevel !== "off");
  }

  function updateCelestialBodyLabels() {
    bodyProjectionSnapshot = [];
    if (isCosmicZoomActive()) {
      if (celestialAtlas?.galaxy?.solarMarkerLabel) celestialAtlas.galaxy.solarMarkerLabel.visible = false;
    } else celestialAtlas?.updateSelectionFacingCamera?.(camera);
    if (!bodyLabelLayer || !celestialAtlas || !celestialAtlasModule?.projectCelestialLabels) return false;
    if (hubMode !== "overview"
      || journeyDeparture
      || journeyCameraHeldForHandoff
      || !isSolarAtlasDetailInteractive()) {
      for (const element of bodyLabelElements.values()) element.dataset.visible = "false";
      return false;
    }
    const rect = { width: viewportWidth, height: viewportHeight };
    if (!(viewportWidth > 0) || !(viewportHeight > 0)) return false;
    scene.updateMatrixWorld?.(true);
    camera.updateMatrixWorld?.(true);
    const positions = {};
    const labelRegistry = {};
    for (const body of Object.values(celestialRegistry || {})) {
      // The close Home Sun is cinematic lighting, not a chart destination.
      // Projected body labels begin with the first authored chart band.
      if (viewZoom.band === "planet") continue;
      if (!isCelestialBodyVisibleInBand(body.id)) continue;
      const position = getCelestialBodyWorldPosition(body.id);
      if (position) {
        positions[body.id] = position.toArray();
        const record = getCelestialBodyRecord(body.id);
        // Label lift and occlusion must follow the readable chart silhouette,
        // not the subpixel physical mesh hidden inside it. Positions remain the
        // untouched world-space anchors.
        labelRegistry[body.id] = {
          ...body,
          radius: record ? getCelestialBodyWorldRadius(record) : body.radius
        };
      }
    }
    const viewProjection = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    const maxLabels = viewZoom.band === "planet" ? 0
      : viewZoom.band === "orbit" ? 5 : 10;
    const projections = celestialAtlasModule.projectCelestialLabels({
      layout: { positions },
      registry: labelRegistry,
      viewProjectionMatrix: viewProjection,
      viewport: { width: rect.width, height: rect.height },
      cameraPosition: camera.position.toArray(),
      selectedBodyId,
      focusedBodyId: orbitBodyId,
      maxLabels,
      gap: 8,
      labelLift: 1.22
    });
    const visibleIds = new Set();
    for (const projection of projections) {
      visibleIds.add(projection.id);
      let element = bodyLabelElements.get(projection.id);
      if (!element) {
        element = documentRef.createElement("button");
        element.type = "button";
        element.className = "planet-hub__label";
        element.dataset.body = projection.id;
        element.dataset.planetHubBodyLabel = "";
        element.tabIndex = 0;
        const name = documentRef.createElement("b");
        name.textContent = projection.label;
        const state = documentRef.createElement("small");
        state.textContent = celestialRegistry[projection.id]?.available ? "" : "Future";
        element.append(name, state);
        bodyLabelLayer.append(element);
        bodyLabelElements.set(projection.id, element);
      }
      element.dataset.visible = "true";
      element.tabIndex = 0;
      element.dataset.selected = String(projection.id === selectedBodyId);
      element.dataset.focused = String(projection.id === orbitBodyId);
      element.setAttribute?.("aria-pressed", String(projection.id === selectedBodyId));
      element.setAttribute?.("aria-label", projection.id === selectedBodyId
        ? `${projection.label}, selected. Press Enter to center.`
        : `${projection.label}. Press Enter to select.`);
      element.style.setProperty("--planet-hub-label-x", `${projection.x.toFixed(2)}px`);
      element.style.setProperty("--planet-hub-label-y", `${projection.y.toFixed(2)}px`);
    }
    for (const [id, element] of bodyLabelElements) {
      if (!visibleIds.has(id)) {
        element.dataset.visible = "false";
        element.tabIndex = -1;
      }
    }
    // Keep picking layout-free while the globe is moving. These generous
    // 44px semantic rectangles mirror each projected label closely enough for
    // touch and pen input without forcing getBoundingClientRect() reflows on
    // every animation frame.
    bodyProjectionSnapshot = projections.map((projection) => {
      const future = celestialRegistry[projection.id]?.available ? 0 : 32;
      const width = Math.max(44, Math.min(180, 28 + projection.label.length * 7 + future));
      return Object.freeze({
        ...projection,
        hitRect: Object.freeze({
          left: projection.x - width * 0.5,
          right: projection.x + width * 0.5,
          top: projection.y - 51,
          bottom: projection.y - 3
        })
      });
    });
    return true;
  }

  // Focus enlarges the complete world. Lower it enough that tall authored
  // rockets and portals retain a clean silhouette beneath the Home header;
  // the lower planet edge is intentionally allowed to continue off-screen.
  // Landmark scale never changes between overview and focus. Stage 2 enlarges
  // the complete world group (planet, roads, atmosphere and landmark) so their
  // proportions remain physically coherent.
  function updateFrontLandmark(now = windowRef?.performance?.now?.() || 0) {
    let winner = null;
    let winnerFacing = -Infinity;
    const centerScores = {};
    const viewIntoScene = camera.getWorldDirection?.(new THREE.Vector3())
      || cameraFacing.clone().multiplyScalar(-1);
    const outwardToCamera = viewIntoScene.clone().multiplyScalar(-1).normalize();
    const screenUp = camera.up.clone()
      .addScaledVector(outwardToCamera, -camera.up.dot(outwardToCamera));
    if (screenUp.lengthSq() < 1e-8) {
      screenUp.copy(Math.abs(outwardToCamera.y) < 0.94
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0));
      screenUp.addScaledVector(outwardToCamera, -screenUp.dot(outwardToCamera));
    }
    screenUp.normalize();
    const visualCenterNormal = outwardToCamera.clone().multiplyScalar(0.866025)
      .addScaledVector(screenUp, 0.5)
      .normalize();
    const candidateDestinations = hubMode === "focused"
      ? [focusedDestination || committedDestination]
      : [...availableSet];
    const landmarkPresentationVisible = orbitBodyId === worldId
      && !activeNavigationFocusId()
      && !bodyFocusTransition
      && (hubMode === "focused"
        || viewZoom.band === "planet"
        || viewZoom.band === "orbit");
    for (const destination of candidateDestinations) {
      if (!availableSet.has(destination)) continue;
      const normal = new THREE.Vector3(...anchors[destination].normal).normalize();
      const facing = normal.dot(outwardToCamera);
      centerScores[destination] = normal.dot(visualCenterNormal);
      if (facing > winnerFacing) {
        winnerFacing = facing;
        winner = destination;
      }
    }
    for (const [destination, root] of siteRoots) {
      // Exactly one destination is exposed. The other authored landmarks still
      // orbit with the world but remain behind the globe and out of hit testing.
      root.visible = landmarkPresentationVisible
        && availableSet.has(destination)
        && destination === winner
        && winnerFacing > 0.08;
    }
    frontDestination = winner;
    if (hubMode === "overview"
      && viewZoom.band === "planet"
      && !transition
      && orbitBodyId === worldId
      && !activeNavigationFocusId()
      && !bodyFocusTransition) {
      const activation = stepPlanetHubFrontActivation({
        state: frontActivationState,
        scores: centerScores,
        nowMs: now
      });
      frontActivationState = activation.state;
      stableFrontDestination = activation.destination || stableFrontDestination;
      if (activation.changed && activation.destination) {
        onCenterDestination(activation.destination);
      }
    }
    return winner;
  }

  function presentationTarget(destination = committedDestination, mode = hubMode) {
    const normalized = normalizePlanetHubDestination(destination);
    const focusFraming = calculatePlanetHubFocusFraming({
      destination: normalized,
      worldId,
      width: viewportWidth,
      height: viewportHeight,
      aspect: camera.aspect
    });
    const selectedNormal = mode === "focused"
      ? focusFraming.normal
      // Keep the current landmark in the upper-middle of the visible globe,
      // but leave enough headroom for the full rocket and portal silhouettes.
      // The former 0.68 Y target put tall authored models against the nav edge.
      : [0, 0.5, 0.866025];
    const value = mode === "focused"
      ? destinationFacingQuaternion(normalized, anchors, selectedNormal, cameraDirection.toArray())
      : destinationQuaternion(normalized, anchors, selectedNormal);
    const scale = calculatePlanetHubPresentationScale(mode);
    const quaternion = new THREE.Quaternion(...value);
    const position = mode === "focused"
      ? new THREE.Vector3(...focusFraming.position)
      : overviewPosition.clone();
    const authoredOrbit = equivalentCameraOrbitForPresentation({ quaternion, position, scale });
    return {
      destination: normalized,
      quaternion,
      // Compose the complete world as a horizon shot. The landmark rises into
      // the upper safe frame while Earth continues naturally below the screen.
      position,
      scale,
      // This is the exact inverse-camera equivalent of the former
      // world-quaternion/scale/translation composition. It preserves every
      // authored shot while leaving Earth, roads, and landmarks in one stable
      // geographic coordinate frame.
      cameraOrbit: mode === "overview"
        ? overviewOrbitWithViewZoom(authoredOrbit)
        : authoredOrbit
    };
  }

  function startPresentationTransition(destination, {
    animate = true,
    mode = hubMode,
    kind = "destination"
  } = {}) {
    const target = presentationTarget(destination, mode);
    const duration = calculatePlanetHubPresentationDuration({
      kind,
      width: windowRef?.innerWidth || 1280,
      reducedMotion
    });
    const orbitFrom = cloneCameraOrbitState();
    pointerDragActive = false;
    pointerDragLastAt = 0;
    orbitVelocity = { yaw: 0, pitch: 0 };
    resetOrbitIdle({ active: false, suppressed: mode !== "overview" });
    orbitReleaseResponse = 8.5;
    orbitCoastUntil = 0;
    if (canvas?.dataset) {
      delete canvas.dataset.planetHubCoasting;
      canvas.dataset.planetHubCoastStopReason = `presentation:${kind}`;
    }
    stableFrontDestination = target.destination;
    frontActivationState = {
      active: target.destination,
      candidate: null,
      candidateSince: null,
      lastChangedAt: windowRef?.performance?.now?.() || 0
    };
    if (!animate) {
      transition = null;
      world.quaternion.identity();
      celestialSystem.position.set(0, 0, 0);
      syncScaleSpace(viewZoom.progress);
      setCameraOwner(mode === "focused" ? "landmark-focus" : "home-orbit");
      applyCameraOrbitState(target.cameraOrbit);
      publishPresentationState();
      updateFrontLandmark();
      requestRender();
      return target.destination;
    }
    transition = {
      orbitFrom,
      orbitTo: cloneCameraOrbitState(target.cameraOrbit),
      presentationPosition: target.position.clone(),
      presentationScale: target.scale,
      startedAt: windowRef?.performance?.now?.() || 0,
      duration,
      kind,
      owner: mode === "focused" ? "landmark-focus" : "home-orbit"
    };
    setCameraOwner(transition.owner);
    onPhase("transitioning");
    requestRender();
    return target.destination;
  }

  function reframeCelestialBodyFocus() {
    if (bodyFocusTransition && bodyFocusTransition.focused === false) {
      bodyFocusTransition.orbitFrom = cloneCameraOrbitState();
      bodyFocusTransition.orbitTo = cloneCameraOrbitState(
        bodySavedCameraOrbit || presentationTarget(committedDestination, "overview").cameraOrbit
      );
      bodyFocusTransition.startedAt = windowRef?.performance?.now?.() || 0;
      setCameraOwner("celestial-body-focus");
      return true;
    }
    const id = activeNavigationFocusId() || bodyFocusTransition?.bodyId;
    const record = getCelestialBodyRecord(id);
    const navigationTarget = record ? null : resolveNavigationTarget(id);
    const bodyPosition = record
      ? getCelestialBodyWorldPosition(id)
      : navigationTargetWorldPosition(navigationTarget);
    if (!bodyPosition) return false;
    const bodyFraming = record ? resolveBodyFocusFraming(record) : null;
    const worldRadius = bodyFraming?.worldRadius ?? navigationTargetWorldRadius(navigationTarget);
    const closeRadius = bodyFraming?.closeRadius ?? worldRadius * placeFocusDistanceRatio;
    if (record) bodyFocusCloseRadius = closeRadius;
    else placeFocusCloseRadius = closeRadius;
    const direction = camera.position.clone().sub(bodyPosition);
    if (direction.lengthSq() < 1e-8) direction.copy(cameraDirection);
    direction.normalize();
    const closeOrbit = orbitStateFromCameraPose({
      position: bodyPosition.clone().addScaledVector(direction, closeRadius),
      target: bodyPosition,
      up: camera.up.clone(),
      velocity: { yaw: 0, pitch: 0 }
    });
    const targetOrbit = orbitWithViewZoom(closeOrbit, viewZoom.progress);
    if (bodyFocusTransition) {
      bodyFocusTransition.orbitFrom = cloneCameraOrbitState();
      bodyFocusTransition.orbitTo = cloneCameraOrbitState(targetOrbit);
      bodyFocusTransition.startedAt = windowRef?.performance?.now?.() || 0;
    } else {
      applyCameraOrbitState(targetOrbit);
    }
    setCameraOwner("celestial-body-focus");
    spaceEnvironment?.setWorldGridAnchor?.({
      position: bodyPosition.toArray(),
      bodyRadius: worldRadius
    });
    return true;
  }

  function setSelectedBody(target = orbitBodyId) {
    const record = getCelestialBodyRecord(target);
    if (!record?.body?.selectable || !isSolarAtlasDetailInteractive()) return false;
    selectedBodyId = record.id;
    selectedPlaceId = record.id;
    celestialCosmology?.setSelectedPlace?.(null);
    if (record.id === "moon" && satelliteRoot && worldId === "earth" && !usesPhysicalSolarChart()) {
      celestialAtlas?.setSelectedBody?.(null);
      satelliteHovered = true;
    } else {
      celestialAtlas?.setSelectedBody?.(record.id);
    }
    syncCelestialAtlasPresentation(viewZoom.band);
    if (canvas?.dataset) {
      canvas.dataset.planetHubSelectedBody = selectedBodyId;
      canvas.dataset.planetHubSelectedPlace = selectedPlaceId;
    }
    requestRender();
    return true;
  }

  function setCelestialBodyFocus(target, { animate = true } = {}) {
    const record = getCelestialBodyRecord(target);
    if (!record
      || record.id === worldId
      || !record.body.selectable
      || !isSolarAtlasDetailInteractive()
      || !getViewInteractionRules().celestialBodyPicking
      || hubMode !== "overview"
      || transition
      || bodyFocusTransition
      || journeyDeparture) return false;
    const bodyPosition = getCelestialBodyWorldPosition(record.id);
    if (!bodyPosition) return false;
    bodyFocusDisplayScale = Math.max(1,
      Number(record.root.userData?.planetHubChartDisplayScale) || 1);
    const focusFraming = resolveBodyFocusFraming(record);
    const worldRadius = focusFraming.worldRadius;
    const now = windowRef?.performance?.now?.() || 0;
    const bodyToCamera = camera.position.clone().sub(bodyPosition);
    if (bodyToCamera.lengthSq() < 1e-8) bodyToCamera.copy(cameraDirection);
    bodyToCamera.normalize();
    const focusDistance = focusFraming.closeRadius;
    const focusOrbit = orbitStateFromCameraPose({
      position: bodyPosition.clone().addScaledVector(bodyToCamera, focusDistance),
      target: bodyPosition,
      up: camera.up.clone(),
      velocity: { yaw: 0, pitch: 0 }
    });
    if (orbitBodyId === worldId && !bodyFocusId) {
      bodySavedCameraOrbit = cloneCameraOrbitState();
      bodySavedViewZoom = {
        progress: viewZoom.progress,
        targetProgress: viewZoom.targetProgress
      };
    }
    pointerDragActive = false;
    pointerDragLastAt = 0;
    orbitVelocity = { yaw: 0, pitch: 0 };
    orbitCoastUntil = 0;
    resetOrbitIdle({ active: false, suppressed: false });
    bodyFocusId = record.id;
    bodyFocusCloseRadius = focusDistance;
    placeFocusId = null;
    placeFocusCloseRadius = null;
    orbitBodyId = record.id;
    setSelectedBody(record.id);
    const distanceRatio = Math.max(1, cameraOrbitState.radius / Math.max(0.01, focusDistance));
    bodyFocusTransition = {
      focused: true,
      bodyId: record.id,
      orbitFrom: cloneCameraOrbitState(),
      orbitTo: focusOrbit,
      startedAt: now,
      duration: reducedMotion ? 140 : Math.min(1200, 720 + Math.log(distanceRatio) * 150),
      gridAnchor: bodyPosition.toArray(),
      gridRadius: worldRadius,
      gridAnchorChanged: false
    };
    setCameraOwner("celestial-body-focus");
    canvas.dataset.planetHubOrbitBody = orbitBodyId;
    camera.near = Math.max(1e-6, Math.min(0.05, worldRadius * 0.025));
    camera.updateProjectionMatrix();
    publishViewZoom({ force: true });
    if (!animate) {
      applyCameraOrbitState(bodyFocusTransition.orbitTo);
      spaceEnvironment?.setWorldGridAnchor?.({ position: bodyPosition.toArray(), bodyRadius: worldRadius });
      spaceEnvironment?.setWorldGridTransitionOpacity?.(1);
      bodyFocusTransition = null;
      onPhase("ready");
    } else onPhase("transitioning");
    requestRender();
    return true;
  }

  function clearCelestialBodyFocus({ animate = true } = {}) {
    if (!activeNavigationFocusId() && !bodyFocusTransition?.focused) return false;
    const now = windowRef?.performance?.now?.() || 0;
    const exitingBodyId = activeNavigationFocusId() || bodyFocusTransition?.bodyId;
    const placeSaved = placeFocusId ? placeSavedNavigationState : null;
    const returnProgress = clampPlanetHubZoomProgress(
      placeSaved?.viewZoom?.progress ?? bodySavedViewZoom?.progress ?? 0
    );
    const returnTargetProgress = clampPlanetHubZoomProgress(
      placeSaved?.viewZoom?.targetProgress ?? bodySavedViewZoom?.targetProgress ?? returnProgress
    );
    const returnCosmicProgress = clampPlanetHubCosmicZoomProgress(placeSaved?.cosmicZoom?.progress ?? 0);
    const returnCosmicTargetProgress = clampPlanetHubCosmicZoomProgress(
      placeSaved?.cosmicZoom?.targetProgress ?? returnCosmicProgress
    );
    bodyFocusId = null;
    bodyFocusCloseRadius = null;
    placeFocusId = null;
    placeFocusCloseRadius = null;
    camera.near = 0.05;
    camera.updateProjectionMatrix();
    cosmicZoom.progress = returnCosmicProgress;
    cosmicZoom.targetProgress = returnCosmicTargetProgress;
    cosmicZoom.velocity = 0;
    const returnOrbit = placeSaved?.cameraOrbit
      ? createPlanetHubCameraOrbitState(placeSaved.cameraOrbit)
      : overviewOrbitWithViewZoom(
        bodySavedCameraOrbit || presentationTarget(committedDestination, "overview").cameraOrbit,
        returnProgress,
        returnCosmicProgress
      );
    orbitBodyId = placeSaved?.orbitBodyId || worldId;
    viewZoom.progress = returnProgress;
    viewZoom.targetProgress = returnTargetProgress;
    viewZoom.velocity = 0;
    canvas.dataset.planetHubOrbitBody = orbitBodyId;
    selectedPlaceId = placeSaved?.selectedPlaceId || orbitBodyId;
    if (celestialRegistry?.[selectedPlaceId]) setSelectedBody(selectedPlaceId);
    else selectPlace(selectedPlaceId, { source: "focus-return" });
    publishViewZoom({ force: true });
    const returnGridAnchor = semanticCameraTarget(returnProgress);
    const returnGridSubject = getCelestialBodyRecord(
      usesPhysicalSolarChart(returnProgress) ? "sun" : worldId,
      returnProgress
    );
    const returnGridScale = returnGridSubject?.root?.getWorldScale?.(new THREE.Vector3())?.x || 1;
    bodyFocusTransition = {
      focused: false,
      bodyId: exitingBodyId,
      orbitFrom: cloneCameraOrbitState(),
      orbitTo: cloneCameraOrbitState(returnOrbit),
      startedAt: now,
      duration: reducedMotion ? 140 : 760,
      gridAnchor: returnGridAnchor,
      gridRadius: Math.max(0.05, Math.abs(returnGridScale)),
      gridAnchorChanged: false
    };
    if (!animate) {
      applyCameraOrbitState(bodyFocusTransition.orbitTo);
      spaceEnvironment?.setWorldGridAnchor?.({
        position: returnGridAnchor,
        bodyRadius: Math.max(0.05, Math.abs(returnGridScale))
      });
      spaceEnvironment?.setWorldGridTransitionOpacity?.(1);
      bodyFocusTransition = null;
      bodyFocusDisplayScale = 1;
      bodySavedCameraOrbit = null;
       bodySavedViewZoom = null;
       placeSavedNavigationState = null;
      orbitVelocity = { yaw: 0, pitch: 0 };
      setCameraOwner("home-orbit");
      onPhase("ready");
    } else onPhase("transitioning");
    requestRender();
    return true;
  }

  function setOrbitBody(target = worldId, { animate = true, source = "body-double-click" } = {}) {
    const body = String(target || worldId).toLowerCase();
    if (body !== worldId) return setCelestialBodyFocus(body, { animate });
    viewZoom.source = source;
    if (activeNavigationFocusId() || bodyFocusTransition?.focused) {
      return clearCelestialBodyFocus({ animate });
    }
    orbitBodyId = worldId;
    setSelectedBody(worldId);
    spaceEnvironment?.setWorldGridAnchor?.({ position: [0, 0, 0], bodyRadius: 1 });
    if (!animate || reducedMotion) {
      viewZoom.progress = 0;
      viewZoom.targetProgress = 0;
      viewZoom.velocity = 0;
      zoomFocusPending = false;
      applyCameraOrbitState(overviewOrbitWithViewZoom(cameraOrbitState, 0));
      publishViewZoom({ force: true });
      onPhase("ready");
    } else {
      zoomFocusPending = setViewZoom(0, { immediate: false, source });
      onPhase(zoomFocusPending ? "transitioning" : "ready");
    }
    requestRender();
    return true;
  }

  function renderFrame(now = 0) {
    frameRequest = 0;
    if (disposed || suspended) return;
    const legacyZoomPending = Math.abs(viewZoom.targetProgress - viewZoom.progress) > 0.0001
      || Math.abs(viewZoom.velocity) > 0.0005
      || pendingSegmentZoom?.segment === "cosmic";
    const cosmicZoomPending = Math.abs(cosmicZoom.targetProgress - cosmicZoom.progress) > 0.0001
      || Math.abs(cosmicZoom.velocity) > 0.0005
      || pendingSegmentZoom?.segment === "legacy";
    const zoomPending = legacyZoomPending || cosmicZoomPending;
    const interactiveFrame = Boolean(
      transition
      || bodyFocusTransition
      || pendingPlaceVisit
      || pendingNavigationRestore
      || journeyDeparture
      || pointerDragActive
      || zoomPending
      || shouldPlanetHubCoastOwnInput({
        nowMs: now,
        coastUntil: orbitCoastUntil,
        velocity: orbitVelocity
      })
    );
    let interactionMotionFrame = interactiveFrame;
    if (typeof windowRef?.requestAnimationFrame === "function"
      && !shouldRenderPlanetHubFrame({
        nowMs: now,
        lastRenderedAt: lastFrameAt,
        interactive: interactiveFrame
      })) {
      requestRender();
      return;
    }
    let keepRendering = false;
    restoreAuthoredHandoffPresentation();
    const deltaSeconds = lastFrameAt > 0 ? Math.min(0.05, Math.max(0, (now - lastFrameAt) / 1000)) : 1 / 60;
    lastFrameAt = now;
    if (orbitCoastUntil > 0 && !shouldPlanetHubCoastOwnInput({
      nowMs: now,
      coastUntil: orbitCoastUntil,
      velocity: orbitVelocity
    })) {
      orbitCoastUntil = 0;
      // A high-energy throw owns its full authored coast, then transitions to
      // a controlled settle. Retaining its low launch damping indefinitely
      // would leave a saturated flick spinning for tens of seconds.
      orbitReleaseResponse = Math.max(orbitReleaseResponse, 2.4);
    }
    if (bodyFocusTransition) {
      const progress = Math.min(1, (now - bodyFocusTransition.startedAt) / bodyFocusTransition.duration);
      const eased = progress * progress * (3 - 2 * progress);
      // Match the reference plane handoff: hide the old ruler/grid, retarget
      // while invisible, then reveal it only after the camera has nearly
      // completed its spherical focus move.
      const gridOpacity = progress < 0.25 ? 1 - smoothUnit(progress / 0.25)
        : progress > 0.82 ? smoothUnit((progress - 0.82) / 0.18) : 0;
      spaceEnvironment?.setWorldGridTransitionOpacity?.(gridOpacity);
      if (!bodyFocusTransition.gridAnchorChanged && progress >= 0.5) {
        spaceEnvironment?.setWorldGridAnchor?.({
          position: bodyFocusTransition.gridAnchor,
          bodyRadius: bodyFocusTransition.gridRadius
        });
        bodyFocusTransition.gridAnchorChanged = true;
      }
      const interpolatedOrbit = interpolatePlanetHubCameraOrbitState({
        from: bodyFocusTransition.orbitFrom,
        to: bodyFocusTransition.orbitTo,
        progress: eased
      });
      const transitionOrbit = bodyFocusTransition.focused
        ? interpolatedOrbit
        : constrainPlanetHubCameraOrbitForView(interpolatedOrbit, { progress: viewZoom.progress });
      applyCameraOrbitState(transitionOrbit);
      if (progress >= 1) {
        const completedFocus = bodyFocusTransition.focused;
        applyCameraOrbitState(bodyFocusTransition.orbitTo);
        if (!bodyFocusTransition.gridAnchorChanged) {
          spaceEnvironment?.setWorldGridAnchor?.({
            position: bodyFocusTransition.gridAnchor,
            bodyRadius: bodyFocusTransition.gridRadius
          });
        }
        spaceEnvironment?.setWorldGridTransitionOpacity?.(1);
        bodyFocusTransition = null;
        if (!completedFocus) {
          bodyFocusId = null;
          bodyFocusCloseRadius = null;
          placeFocusId = null;
          placeFocusCloseRadius = null;
          bodyFocusDisplayScale = 1;
          bodySavedCameraOrbit = null;
          bodySavedViewZoom = null;
          placeSavedNavigationState = null;
          orbitVelocity = { yaw: 0, pitch: 0 };
          resetOrbitIdle({ active: false, suppressed: false });
          setCameraOwner("home-orbit");
          syncCelestialAtlasPresentation(viewZoom.band);
        }
        onPhase("ready");
        if (pendingNavigationRestore) {
          const restored = pendingNavigationRestore;
          pendingNavigationRestore = null;
          restored.resolve(Object.freeze({ accepted: true, id: restored.id }));
        }
      } else keepRendering = true;
    }
    if (transition) {
      const progress = Math.min(1, (now - transition.startedAt) / transition.duration);
      const eased = easePlanetHubPresentationProgress(progress, transition.kind);
      const interpolatedOrbit = interpolatePlanetHubCameraOrbitState({
        from: transition.orbitFrom,
        to: transition.orbitTo,
        progress: eased
      });
      const transitionOrbit = transition.owner === "home-orbit"
        ? constrainPlanetHubCameraOrbitForView(interpolatedOrbit, { progress: viewZoom.progress })
        : interpolatedOrbit;
      applyCameraOrbitState(transitionOrbit);
      if (progress >= 1) {
        // Finalize from the authored endpoint, rather than trusting the last
        // interpolated frame. This keeps overview position/scale canonical even
        // after a long frame, resize, or a focus transition that was reversed.
        applyCameraOrbitState(transition.orbitTo);
        setCameraOwner(transition.owner);
        publishPresentationState();
        transition = null;
        onPhase("ready");
      }
      else keepRendering = true;
    }
    if (zoomPending
      && hubMode === "overview"
      && (cameraOwner === "home-orbit"
        || (cameraOwner === "celestial-body-focus" && Boolean(orbitBodyId)))
      && !transition
      && !bodyFocusTransition
      && !journeyDeparture
      && !journeyCameraHeldForHandoff) {
      const zoomState = cosmicZoomPending ? cosmicZoom : viewZoom;
      const zoomStep = stepPlanetHubZoomSpring({
        progress: zoomState.progress,
        targetProgress: zoomState.targetProgress,
        velocity: zoomState.velocity,
        deltaSeconds,
        reducedMotion
      });
      zoomState.progress = zoomStep.progress;
      zoomState.velocity = zoomStep.velocity;
      applyCameraOrbitState(orbitWithViewZoom(cameraOrbitState));
      publishViewZoom({ force: true });
      interactionMotionFrame = true;
      keepRendering = zoomStep.moving || keepRendering;
      if (zoomStep.settled) {
        if (pendingSegmentZoom) {
          const pending = pendingSegmentZoom;
          pendingSegmentZoom = null;
          if (pending.segment === "cosmic") {
            cosmicZoom.targetProgress = clampPlanetHubCosmicZoomProgress(pending.progress);
            cosmicZoom.source = String(pending.source || "api");
            if (cosmicZoom.targetProgress > 1e-9) void ensureCelestialCosmology();
          } else {
            viewZoom.targetProgress = clampPlanetHubZoomProgress(pending.progress);
            viewZoom.source = String(pending.source || "api");
          }
          keepRendering = true;
        }
        resetOrbitIdle({ active: !reducedMotion, suppressed: false });
        if (zoomFocusPending) {
          zoomFocusPending = false;
          onPhase("ready");
        }
      }
    }
    if (pendingPlaceVisit) {
      const legacySettled = Math.abs(viewZoom.targetProgress - viewZoom.progress) <= 0.0001
        && Math.abs(viewZoom.velocity) <= 0.0005;
      const cosmicSettled = Math.abs(cosmicZoom.targetProgress - cosmicZoom.progress) <= 0.0001
        && Math.abs(cosmicZoom.velocity) <= 0.0005;
      if (!pendingPlaceVisit.focusStarted && legacySettled && cosmicSettled && !pendingSegmentZoom) {
        if (pendingPlaceVisit.zoomTarget.cosmicProgress > 0 && !celestialCosmology) {
          void ensureCelestialCosmology();
          keepRendering = true;
        } else {
          const started = queuePlaceVisitFocus(pendingPlaceVisit);
          if (started) {
            pendingPlaceVisit.focusStarted = true;
            keepRendering = true;
          } else {
            const failed = pendingPlaceVisit;
            pendingPlaceVisit = null;
            failed.resolve(false);
            onPhase("ready");
          }
        }
      } else if (pendingPlaceVisit.focusStarted && !bodyFocusTransition) {
        const completed = pendingPlaceVisit;
        pendingPlaceVisit = null;
        completed.resolve(Object.freeze({ accepted: true, id: completed.id }));
        onPhase("ready");
      } else keepRendering = true;
    }
    if (journeyDeparture) {
      const activeDeparture = journeyDeparture;
      // Freeze the Moon's cinematic pose and displayed radius for this one
      // continuous shot. Perspective compensation is an overview concern; if
      // it sampled the moving chase camera, the lunar surface would shrink and
      // move underneath an otherwise correct landing target.
      const landingPosition = activeDeparture.toPosition.clone();
    const flightPhase = calculatePlanetHubFlightPhase({
        elapsedMs: now - activeDeparture.startedAt,
        durationMs: activeDeparture.duration,
        launchViewHoldMs: activeDeparture.launchViewHoldMs,
        landingCameraStartMs: activeDeparture.landingCameraStartMs,
        landingCameraBlendMs: activeDeparture.landingCameraBlendMs,
        landingStaticMs: activeDeparture.landingStaticMs
      });
      const progress = Math.min(1, Math.max(0,
        (now - activeDeparture.startedAt) / Math.max(1, activeDeparture.duration)
      ));
      const pose = calculatePlanetHubJourneyDeparturePose({
        from: activeDeparture.fromPosition.toArray(),
        to: activeDeparture.toPosition.toArray(),
        departureCenter: activeDeparture.fromCenter.toArray(),
        departureRadius: activeDeparture.departureRadius,
        destinationCenter: activeDeparture.destinationCenter.toArray(),
        destinationRadius: activeDeparture.destinationRadius,
        direction: activeDeparture.direction,
        progress,
        elapsedMs: now - activeDeparture.startedAt,
        durationMs: activeDeparture.duration,
        reducedMotion: activeDeparture.reducedMotion,
        launchNormal: activeDeparture.launchNormal.toArray(),
        arrivalNormal: activeDeparture.arrivalNormal.toArray(),
        ignitionShare: activeDeparture.ignitionShare,
        routeStretch: activeDeparture.routeStretch,
        launchLiftShare: activeDeparture.launchLiftShare,
        launchLiftHeight: activeDeparture.launchLiftHeight,
        launchVehicleHeight: activeDeparture.fromVehicleHeight,
        arrivalVehicleHeight: activeDeparture.targetVehicleHeight,
        vehicleRadiusRatio: PLANET_HUB_JOURNEY_VEHICLE_RADIUS_RATIO,
        minimumBodyClearance: PLANET_HUB_JOURNEY_BODY_CLEARANCE,
        preOrbitShare: activeDeparture.preOrbitShare,
        preOrbitRadians: activeDeparture.preOrbitRadians
      });
      journeyRocket.position.set(...pose.position);
      journeyRocket.scale.lerpVectors(
        activeDeparture.fromScale,
        activeDeparture.targetScale,
        pose.scaleProgress
      );

      // Position is authored in celestial-system local space. Convert the
      // live vehicle, path tangent, and orbiting Moon into world space before
      // solving the chase camera so focus scale/translation cannot distort
      // the shot.
      const tangentLocal = new THREE.Vector3(...pose.tangent).normalize();
      const orientationLocal = new THREE.Vector3(...pose.orientation).normalize();
      celestialSystem.updateMatrixWorld?.(true);
      journeyRocket.updateMatrixWorld?.(true);
      satelliteRoot?.updateMatrixWorld?.(true);
      const rocketWorldPosition = new THREE.Vector3().setFromMatrixPosition(journeyRocket.matrixWorld);
      const moonWorldPosition = satelliteRoot
        ? new THREE.Vector3().setFromMatrixPosition(satelliteRoot.matrixWorld)
        : rocketWorldPosition.clone();
      const landingWorldPosition = landingPosition.clone().applyMatrix4(celestialSystem.matrixWorld);
      const destinationWorldPosition = activeDeparture.destinationCenter.clone()
        .applyMatrix4(celestialSystem.matrixWorld);
      const earthWorldPosition = activeDeparture.earthCenter.clone()
        .applyMatrix4(celestialSystem.matrixWorld);
      const tangentWorld = tangentLocal.clone().transformDirection(celestialSystem.matrixWorld).normalize();
      const landingNormalWorld = activeDeparture.arrivalNormal.clone()
        .transformDirection(celestialSystem.matrixWorld)
        .normalize();
      const celestialWorldScale = new THREE.Vector3(1, 1, 1);
      celestialSystem.getWorldScale?.(celestialWorldScale);
      const celestialScaleMax = Math.max(
        Math.abs(celestialWorldScale.x),
        Math.abs(celestialWorldScale.y),
        Math.abs(celestialWorldScale.z)
      );
      const destinationRadiusWorld = activeDeparture.destinationRadius * Math.max(
        Math.abs(celestialWorldScale.x),
        Math.abs(celestialWorldScale.y),
        Math.abs(celestialWorldScale.z)
      );
      const rocketWorldScale = new THREE.Vector3(1, 1, 1);
      journeyRocket.getWorldScale?.(rocketWorldScale);
      const vehicleHeightWorld = journeyRocketBoundsHeight * Math.max(
        Math.abs(rocketWorldScale.x),
        Math.abs(rocketWorldScale.y),
        Math.abs(rocketWorldScale.z)
      );
      const arrivalVehicleHeightWorld = journeyRocketBoundsHeight * celestialScaleMax * Math.max(
        Math.abs(activeDeparture.targetScale.x),
        Math.abs(activeDeparture.targetScale.y),
        Math.abs(activeDeparture.targetScale.z)
      );
      const earthScaleReference = Math.max(
        1e-6,
        Math.abs(activeDeparture.earthDockScale.x),
        Math.abs(activeDeparture.earthDockScale.y),
        Math.abs(activeDeparture.earthDockScale.z)
      );
      const vehicleScaleRatio = Math.max(
        Math.abs(journeyRocket.scale.x),
        Math.abs(journeyRocket.scale.y),
        Math.abs(journeyRocket.scale.z)
      ) / earthScaleReference;
      let cameraFrame = calculatePlanetHubTransportedFrame({
        forward: tangentWorld.toArray(),
        previousFrame: activeDeparture.cameraFrame,
        preferredFacade: activeDeparture.lastFacadeDirection.clone()
          .transformDirection(celestialSystem.matrixWorld)
          .normalize()
          .toArray()
      });
      if (flightPhase.name === "landing" && !activeDeparture.landingCameraStartPose) {
        activeDeparture.landingCameraStartPose = {
          position: [...activeDeparture.smoothedCameraPosition],
          target: [...activeDeparture.smoothedCameraTarget],
          up: [...activeDeparture.smoothedCameraUp]
        };
      }
      activeDeparture.cameraFrame = cameraFrame;
      const compactFlight = camera.aspect < 0.72;
      let desiredCameraPose = calculatePlanetHubJourneyCameraPose({
        rocketPosition: rocketWorldPosition.toArray(),
        tangent: tangentWorld.toArray(),
        moonPosition: landingWorldPosition.toArray(),
        destinationCenter: destinationWorldPosition.toArray(),
        destinationRadius: destinationRadiusWorld,
        earthCenter: earthWorldPosition.toArray(),
        earthRadius: celestialScaleMax,
        landingNormal: landingNormalWorld.toArray(),
        landingPosition: landingWorldPosition.toArray(),
        launchNormal: activeDeparture.launchNormal.clone()
          .transformDirection(celestialSystem.matrixWorld)
          .normalize()
          .toArray(),
        flightPhase,
        transportedFrame: cameraFrame,
        landingCameraStartPose: activeDeparture.landingCameraStartPose,
        landingFacade: activeDeparture.arrivalFacade.clone()
          .transformDirection(celestialSystem.matrixWorld)
          .normalize()
          .toArray(),
        stableUp: activeDeparture.stableCameraUp.toArray(),
        routePhase: pose.phase,
        orbitCenter: earthWorldPosition.toArray(),
        vehicleScaleRatio,
        vehicleHeight: vehicleHeightWorld,
        arrivalVehicleHeight: arrivalVehicleHeightWorld,
        verticalFovDegrees: camera.fov,
        aspect: camera.aspect,
        elapsedMs: now - activeDeparture.startedAt,
        durationMs: activeDeparture.duration,
        journeyDirection: activeDeparture.direction,
        progress,
        cameraStartPosition: activeDeparture.cameraStartPosition.toArray(),
        cameraStartTarget: activeDeparture.cameraStartTarget.toArray(),
        cameraStartUp: activeDeparture.cameraStartUp.toArray(),
        ignitionShare: activeDeparture.ignitionShare,
        launchViewHoldShare: activeDeparture.launchViewHoldShare,
        followBlendShare: activeDeparture.followBlendShare,
        chaseDistance: compactFlight ? 3.05 : 2.6,
        chaseLift: compactFlight ? 0.1 : 0.12,
        chaseSide: compactFlight ? 0.18 : 0.24,
        reducedMotion: activeDeparture.reducedMotion
      });
      // Each phase now supplies a fully composed deterministic rig. Applying a
      // second frame-rate-dependent chase filter here caused the camera to lag
      // behind the orbit and then whip into the landing pose on slower frames.
      const appliedCameraPose = desiredCameraPose;
      activeDeparture.smoothedCameraPosition = [...appliedCameraPose.position];
      activeDeparture.smoothedCameraTarget = [...appliedCameraPose.target];
      activeDeparture.smoothedCameraUp = [...appliedCameraPose.up];
      camera.position.set(...appliedCameraPose.position);
      camera.up.set(...appliedCameraPose.up).normalize();
      camera.lookAt(new THREE.Vector3(...appliedCameraPose.target));
      cameraFacing.copy(camera.position)
        .sub(new THREE.Vector3(...appliedCameraPose.target))
        .normalize();
      const requiredFar = Math.max(
        canonicalFar,
        camera.position.distanceTo(rocketWorldPosition) + 6,
        camera.position.distanceTo(moonWorldPosition) + 6,
        camera.position.distanceTo(destinationWorldPosition) + destinationRadiusWorld + 4
      );
      if (Math.abs(requiredFar - camera.far) > 0.05) {
        camera.far = requiredFar;
        camera.updateProjectionMatrix();
      }

      // The authored vehicle's +Y axis is its nose and +X is its facade. It
      // follows the flight tangent through cruise, then rotates nose-out along
      // the lunar surface normal while its position continues inward: a true
      // upright, tail-first descent instead of nose-diving through the Moon.
      const attitudeFrame = calculatePlanetHubTransportedFrame({
        forward: orientationLocal.toArray(),
        previousFrame: activeDeparture.attitudeFrame,
        preferredFacade: activeDeparture.lastFacadeDirection.toArray()
      });
      activeDeparture.attitudeFrame = attitudeFrame;
      const facadeLocal = new THREE.Vector3(...attitudeFrame.facade);
      const sideLocal = new THREE.Vector3(...attitudeFrame.side);
      const flightBasis = new THREE.Matrix4().makeBasis(facadeLocal, orientationLocal, sideLocal);
      const flightQuaternion = new THREE.Quaternion().setFromRotationMatrix(flightBasis);
      const authoredFlightQuaternion = flightQuaternion.clone().slerp(
        activeDeparture.targetQuaternion,
        flightPhase.landingBlend
      );
      const orientationInput = Math.max(0, Math.min(1, pose.travel / 0.16));
      const orientationProgress = orientationInput * orientationInput * (3 - 2 * orientationInput);
      journeyRocket.quaternion.slerpQuaternions(
        activeDeparture.fromQuaternion,
        authoredFlightQuaternion,
        orientationProgress
      );
      if (flightPhase.landingBlend >= 1) {
        journeyRocket.quaternion.copy(activeDeparture.targetQuaternion);
      }
      activeDeparture.lastFacadeDirection.copy(facadeLocal);
      journeyRocket.updateMatrixWorld?.(true);
      if (progress >= 1) {
        journeyRocket.position.copy(activeDeparture.toPosition);
        journeyRocket.quaternion.copy(activeDeparture.targetQuaternion);
        journeyRocket.scale.copy(activeDeparture.targetScale);
        settleJourneyDeparture(true);
        onPhase("ready");
      } else keepRendering = true;
    }
    if (hubMode === "overview"
      && !transition
      && !pointerDragActive
      && !journeyDeparture
      && !bodyFocusTransition) {
      const coastOwnsMotion = shouldPlanetHubCoastOwnInput({
        nowMs: now,
        coastUntil: orbitCoastUntil,
        velocity: orbitVelocity
      });
      const idleStep = stepPlanetHubIdleState({
        state: orbitIdleState,
        nowMs: now,
        velocity: orbitVelocity,
        interacting: pointerDragActive,
        coasting: coastOwnsMotion,
        suppressed: orbitIdleSuppressed,
        // At chart scale the camera belongs entirely to the player. Celestial
        // bodies and orbit paths provide ambient life without a drifting
        // horizon that makes the system hard to read.
        reducedMotion: reducedMotion || viewZoom.band !== "planet"
      });
      orbitIdleState = idleStep.state;
      orbitRestYaw = idleStep.idleYaw;
      if (idleStep.resetVelocity) orbitVelocity = { yaw: 0, pitch: 0 };
      const rotationStep = stepPlanetHubRotation({
        velocity: orbitVelocity,
        deltaSeconds,
        idleYaw: orbitRestYaw,
        releaseResponse: orbitReleaseResponse,
        enabled: !reducedMotion
      });
      orbitVelocity = rotationStep.velocity;
      // Drag inertia orbits the camera opposite the requested visible globe
      // motion. Earth, roads, and every landmark remain geographically
      // stable; releasing still preserves the same bounded physical inertia.
      if (rotationStep.moving) {
        const orbitMotion = applyPlanetHubVisualRotationToCameraOrbit(cameraOrbitState, {
          ...rotationStep.delta,
          velocity: orbitVelocity
        });
        orbitVelocity = { ...orbitMotion.velocity };
        applyCameraOrbitState(orbitWithViewZoom(orbitMotion));
      }
      interactionMotionFrame ||= rotationStep.moving;
      keepRendering = rotationStep.moving || idleStep.waiting || keepRendering;
    }
    updateFrontLandmark(now);
    keepRendering = updateSatellite(now, deltaSeconds) || keepRendering;
    // The full-screen optical pass projects the physical Sun. Refresh the
    // camera before that projection so rapid orbiting cannot leave the glare
    // one frame behind the depth-tested sphere.
    camera.updateMatrixWorld?.(true);
    syncCelestialChartBodyDisplayScales();
    keepRendering = updateSun(now) || keepRendering;
    keepRendering = updateLandmarkHoverEffects(now, deltaSeconds) || keepRendering;
    keepRendering = updateFlames(now) || keepRendering;
    keepRendering = updateCinematicMood(now) || keepRendering;
    // The procedural backdrop is a camera-centered dome. A chase camera must
    // carry it along or the vehicle can visibly approach/clip the sky sphere.
    if (spaceEnvironment?.root) spaceEnvironment.root.position.copy(camera.position);
    keepRendering = spaceEnvironment?.update?.(now, deltaSeconds) || keepRendering;
    celestialCosmology?.setRenderContext?.({
      cameraPosition: camera.position,
      viewportWidth,
      viewportHeight,
      devicePixelRatio: renderer.getPixelRatio?.() || 1,
      elapsedSeconds: now / 1000,
      moving: interactionMotionFrame
    });
    const lineReveal = celestialAtlas?.updateLineReveal?.({
      deltaSeconds,
      elapsedSeconds: now / 1000,
      reducedMotion
    });
    keepRendering = Boolean(lineReveal?.active && !reducedMotion) || keepRendering;
    syncAuthoredProxyOpacity();
    updateCelestialBodyLabels();
    publishPhysicalDiagnostics();
    if (interactionMotionFrame) {
      scene.updateMatrixWorld?.(true);
      onInteractionFrame(Object.freeze({
        nowMs: now,
        cameraOwner,
        mode: hubMode,
        moving: Boolean(pointerDragActive || Math.hypot(orbitVelocity.yaw, orbitVelocity.pitch) > 1e-5)
      }));
    }
    renderer.render(scene, camera);
    // The authored sky is deliberately progressive: the planet, landmarks,
    // and procedural safety dome reach the first usable frame before any of
    // the five larger panorama requests begin.
    if (coreSceneReady && !spaceLayersScheduled && spaceEnvironment?.loadLayers) {
      spaceLayersScheduled = true;
      spaceEnvironment.loadLayers();
    }
    if (keepRendering) requestRender();
  }

  function requestRender() {
    if (disposed || suspended || frameRequest) return;
    frameRequest = windowRef?.requestAnimationFrame?.(renderFrame) || 0;
    if (!frameRequest) renderFrame(windowRef?.performance?.now?.() || 0);
  }

  function setDestination(destination, { animate = true } = {}) {
    const normalized = normalizePlanetHubDestination(destination);
    if (activeNavigationFocusId() || bodyFocusTransition) clearCelestialBodyFocus({ animate: false });
    setHoveredDestination(null);
    committedDestination = normalized;
    retargetCinematicMood(normalized, { animate });
    spaceEnvironment?.setMood?.({ worldId, destination: normalized, mode: hubMode, animate });
    startPresentationTransition(normalized, { animate, mode: hubMode });
    setPortalVisible(normalized === "arena");
    return normalized;
  }

  function getViewZoom() {
    const queuedCosmic = pendingSegmentZoom?.segment === "cosmic"
      ? pendingSegmentZoom.progress : cosmicZoom.targetProgress;
    const queuedLegacy = pendingSegmentZoom?.segment === "legacy"
      ? pendingSegmentZoom.progress : viewZoom.targetProgress;
    return Object.freeze({
      progress: viewZoom.progress,
      targetProgress: queuedLegacy,
      velocity: viewZoom.velocity,
      cosmicProgress: cosmicZoom.progress,
      cosmicTargetProgress: queuedCosmic,
      cosmicVelocity: cosmicZoom.velocity,
      segment: isCosmicZoomActive() || pendingSegmentZoom?.segment === "cosmic" ? "cosmic" : "legacy",
      cosmicTier: isCosmicZoomActive() ? cosmicZoom.tier : null,
      radius: orbitWithViewZoom(cameraOrbitState, viewZoom.progress).radius,
      distanceMeters: representedDistance.distanceMeters,
      band: viewZoom.band,
      bounds: zoomBounds
    });
  }

  function getViewInteractionRules() {
    return resolvePlanetHubZoomInteractionRules({
      renderer: "webgl",
      mode: hubMode,
      phase: transition || bodyFocusTransition ? "transitioning" : "ready",
      cameraOwner,
      band: viewZoom.band
    });
  }

  function setViewZoom(progress, {
    immediate = reducedMotion,
    source = "api"
  } = {}) {
    const zoomOwner = cameraOwner === "home-orbit"
      || (cameraOwner === "celestial-body-focus" && Boolean(orbitBodyId));
    if (disposed
      || hubMode !== "overview"
      || !zoomOwner
      || transition
      || bodyFocusTransition
      || journeyDeparture
      || journeyCameraHeldForHandoff) return false;
    pendingSegmentZoom = null;
    const targetProgress = clampPlanetHubZoomProgress(progress);
    if (targetProgress < 1 - 1e-9 && isCosmicZoomActive()) {
      if (immediate) {
        cosmicZoom.progress = 0;
        cosmicZoom.targetProgress = 0;
        cosmicZoom.velocity = 0;
      } else {
        cosmicZoom.targetProgress = 0;
        cosmicZoom.source = String(source || "api");
        pendingSegmentZoom = Object.freeze({ segment: "legacy", progress: targetProgress, source });
        resetOrbitIdle({ active: false, suppressed: true });
        requestRender();
        return true;
      }
    }
    if (Math.abs(targetProgress - viewZoom.targetProgress) < 1e-7
      && Math.abs(targetProgress - viewZoom.progress) < 1e-7) return false;
    viewZoom.targetProgress = targetProgress;
    viewZoom.source = String(source || "api");
    // Wheel/pinch changes radial motion only. Preserve angular coast and the
    // camera's orientation so zooming never makes a spinning system snap.
    resetOrbitIdle({ active: false, suppressed: true });
    if (immediate) {
      viewZoom.progress = targetProgress;
      viewZoom.velocity = 0;
      applyCameraOrbitState(orbitWithViewZoom(cameraOrbitState));
      publishViewZoom({ force: true });
    }
    requestRender();
    return true;
  }

  function setCosmicZoom(progress, {
    immediate = reducedMotion,
    source = "api"
  } = {}) {
    const zoomOwner = cameraOwner === "home-orbit"
      || (cameraOwner === "celestial-body-focus" && Boolean(orbitBodyId || placeFocusId));
    if (disposed
      || hubMode !== "overview"
      || !zoomOwner
      || transition
      || bodyFocusTransition
      || journeyDeparture
      || journeyCameraHeldForHandoff) return false;
    pendingSegmentZoom = null;
    const targetProgress = clampPlanetHubCosmicZoomProgress(progress);
    if (targetProgress > 1e-9 && (
      viewZoom.progress < 1 - 1e-7 || viewZoom.targetProgress < 1 - 1e-7
    )) {
      if (immediate) {
        viewZoom.progress = 1;
        viewZoom.targetProgress = 1;
        viewZoom.velocity = 0;
      } else {
        viewZoom.targetProgress = 1;
        viewZoom.source = String(source || "api");
        pendingSegmentZoom = Object.freeze({ segment: "cosmic", progress: targetProgress, source });
        resetOrbitIdle({ active: false, suppressed: true });
        requestRender();
        return true;
      }
    }
    if (Math.abs(targetProgress - cosmicZoom.targetProgress) < 1e-7
      && Math.abs(targetProgress - cosmicZoom.progress) < 1e-7) return false;
    cosmicZoom.targetProgress = targetProgress;
    cosmicZoom.source = String(source || "api");
    if (targetProgress > 1e-9) void ensureCelestialCosmology();
    resetOrbitIdle({ active: false, suppressed: true });
    if (immediate) {
      cosmicZoom.progress = targetProgress;
      cosmicZoom.velocity = 0;
      applyCameraOrbitState(orbitWithViewZoom(cameraOrbitState));
      publishViewZoom({ force: true });
    }
    requestRender();
    return true;
  }

  function adoptDestination(destination) {
    const normalized = normalizePlanetHubDestination(destination);
    if (!availableSet.has(normalized)) return committedDestination;
    // The Home controller has accepted a physically centered destination.
    // Adopt its semantic/portal state without reapplying an authored
    // quaternionР Р†Р вЂљРІР‚Сњthe globe must stay exactly where the player's force input
    // carried it.
    committedDestination = normalized;
    stableFrontDestination = normalized;
    retargetCinematicMood(normalized, { animate: true });
    spaceEnvironment?.setMood?.({ worldId, destination: normalized, mode: hubMode, animate: true });
    frontActivationState = {
      active: normalized,
      candidate: null,
      candidateSince: null,
      lastChangedAt: windowRef?.performance?.now?.() || 0
    };
    setPortalVisible(normalized === "arena");
    return normalized;
  }

  function setPointerDrag({ deltaX = 0, deltaY = 0, deltaMs = 16 } = {}) {
    if (hubMode !== "overview" || bodyFocusTransition || transition) return false;
    const angularScale = resolvePlanetHubAngularScale(viewZoom.band);
    const step = calculatePlanetHubDragRotation({
      deltaX: (Number(deltaX) || 0) * angularScale,
      deltaY: (Number(deltaY) || 0) * angularScale,
      deltaMs,
      width: viewportWidth,
      height: viewportHeight,
      velocity: orbitVelocity
    });
    if (Math.abs(step.delta.yaw) < 1e-7 && Math.abs(step.delta.pitch) < 1e-7) return false;
    pointerDragActive = true;
    pointerDragLastAt = windowRef?.performance?.now?.() || 0;
    orbitCoastUntil = 0;
    if (canvas?.dataset) {
      delete canvas.dataset.planetHubCoasting;
      canvas.dataset.planetHubCoastStopReason = "new-drag";
    }
    orbitVelocity = step.velocity;
    resetOrbitIdle({ active: false, suppressed: false });
    orbitReleaseResponse = 3.4;

    const orbitMotion = applyPlanetHubVisualRotationToCameraOrbit(cameraOrbitState, {
      ...step.delta,
      velocity: orbitVelocity
    });
    orbitVelocity = { ...orbitMotion.velocity };
    applyCameraOrbitState(orbitWithViewZoom(orbitMotion));
    if (canvas?.dataset) {
      canvas.dataset.planetHubLastDragYaw = step.delta.yaw.toFixed(6);
      canvas.dataset.planetHubLastDragPitch = step.delta.pitch.toFixed(6);
      canvas.dataset.planetHubDragVelocityYaw = orbitVelocity.yaw.toFixed(6);
      canvas.dataset.planetHubDragVelocityPitch = orbitVelocity.pitch.toFixed(6);
    }
    onPhase("preview");
    requestRender();
    return true;
  }

  function releasePointerDrag({
    cancelled = false,
    displacementX = 0,
    displacementY = 0,
    distancePx = null,
    recentVelocityX = 0,
    recentVelocityY = 0,
    recentSpeedPxPerMs = null,
    heldStillMs = null,
    viewportWidth: releaseViewportWidth = null,
    viewportHeight: releaseViewportHeight = null
  } = {}) {
    if (!pointerDragActive) return false;
    pointerDragActive = false;
    const now = windowRef?.performance?.now?.() || 0;
    const measuredHeldStillMs = heldStillMs != null && Number.isFinite(Number(heldStillMs))
      ? Math.max(0, Number(heldStillMs))
      : Math.max(0, now - pointerDragLastAt);
    pointerDragLastAt = 0;
    if (cancelled || reducedMotion) {
      orbitVelocity = { yaw: 0, pitch: 0 };
      orbitReleaseResponse = 18;
      orbitCoastUntil = 0;
      if (canvas?.dataset) {
        delete canvas.dataset.planetHubCoasting;
        canvas.dataset.planetHubCoastStopReason = "release-cancelled";
      }
    } else {
      const measuredDistance = distancePx != null && Number.isFinite(Number(distancePx))
        ? Math.max(0, Number(distancePx))
        : Math.hypot(Number(displacementX) || 0, Number(displacementY) || 0);
      if (measuredDistance > 0) {
        const release = calculatePlanetHubDragRelease({
          velocity: orbitVelocity,
          displacementX,
          displacementY,
          distancePx: measuredDistance,
          recentVelocityX,
          recentVelocityY,
          recentSpeedPxPerMs,
          heldStillMs: measuredHeldStillMs,
          width: releaseViewportWidth || viewportWidth,
          height: releaseViewportHeight || viewportHeight
        });
        const angularScale = resolvePlanetHubAngularScale(viewZoom.band);
        orbitVelocity = {
          yaw: release.velocity.yaw * angularScale,
          pitch: release.velocity.pitch * angularScale
        };
        orbitReleaseResponse = release.response;
        const scaledRelease = {
          ...release,
          velocity: orbitVelocity,
          angularSpeed: release.angularSpeed * angularScale,
          force: release.force * angularScale
        };
        const coastDuration = calculatePlanetHubCoastDuration(scaledRelease);
        orbitCoastUntil = now + coastDuration;
        if (canvas?.dataset) {
          canvas.dataset.planetHubDragReleaseForce = scaledRelease.force.toFixed(4);
          canvas.dataset.planetHubDragReleaseSpeed = scaledRelease.angularSpeed.toFixed(4);
          canvas.dataset.planetHubCoastDuration = String(coastDuration);
          canvas.dataset.planetHubCoasting = "true";
          delete canvas.dataset.planetHubCoastStopReason;
        }
      } else if (measuredHeldStillMs > 80) {
        const damping = Math.exp(-(measuredHeldStillMs - 80) / 90);
        orbitVelocity = {
          yaw: orbitVelocity.yaw * damping,
          pitch: orbitVelocity.pitch * damping
        };
        orbitReleaseResponse = 3.4;
      } else {
        // Preserve compatibility with callers that predate release metrics.
        orbitReleaseResponse = 3.4;
      }
    }
    resetOrbitIdle({ active: false, suppressed: false });
    if (canvas?.dataset) {
      canvas.dataset.planetHubDragVelocityYaw = orbitVelocity.yaw.toFixed(6);
      canvas.dataset.planetHubDragVelocityPitch = orbitVelocity.pitch.toFixed(6);
      // Release diagnostics are consumed synchronously by accessibility and QA
      // clients. Publish the same speed that the next rendered frame will use
      // so a deliberate flick never appears stationary for one animation tick.
      canvas.dataset.planetHubLiveAngularSpeed = Math.hypot(
        orbitVelocity.yaw,
        orbitVelocity.pitch
      ).toFixed(6);
    }
    onPhase("ready");
    requestRender();
    return true;
  }

  function setHoveredDestination(destination = null, { action = null } = {}) {
    const normalized = destination == null ? null : normalizePlanetHubDestination(destination);
    const next = viewZoom.band === "planet" && normalized && availableSet.has(normalized) ? normalized : null;
    const rocketHovered = next === "journey" && action === "journey-launch";
    const nextAction = next ? action : null;
    if (hoveredDestination === next && hoveredAction === nextAction) return false;
    hoveredDestination = next;
    hoveredAction = nextAction;
    rocketHoverLevel = rocketHovered ? 0.72 : 0;
    const now = windowRef?.performance?.now?.() || 0;
    if (next && hoverEffects.has(next)) hoverEffects.get(next).startedAt = now;
    requestRender();
    return true;
  }

  function clearPointerOrbit({ source = "api" } = {}) {
    // A pointer-down, dead-zone hover, or pointer-leave may arrive while the
    // world is returning from structure focus. The presentation transition is
    // the sole phase owner during that window; do not publish an early `ready`
    // pulse or modify its target motion.
    if (transition) return false;
    const hadOrbit = pointerDragActive
      || Math.abs(orbitVelocity.yaw) > 1e-5
      || Math.abs(orbitVelocity.pitch) > 1e-5
      || Math.abs(orbitRestYaw) > 1e-5;
    pointerDragActive = false;
    pointerDragLastAt = 0;
    if (source === "pointer-leave") {
      if (shouldPlanetHubCoastOwnInput({
        nowMs: windowRef?.performance?.now?.() || 0,
        coastUntil: orbitCoastUntil,
        velocity: orbitVelocity
      })) {
        requestRender();
        return false;
      }
      resetOrbitIdle({ active: false, suppressed: false });
      orbitReleaseResponse = 8.5;
      if (hadOrbit) {
        onPhase("ready");
        requestRender();
      }
      return hadOrbit;
    }
    orbitVelocity = { yaw: 0, pitch: 0 };
    resetOrbitIdle({ active: false, suppressed: true });
    orbitReleaseResponse = 18;
    orbitCoastUntil = 0;
    if (canvas?.dataset) {
      delete canvas.dataset.planetHubCoasting;
      canvas.dataset.planetHubCoastStopReason = `hard-stop:${source}`;
    }
    if (hadOrbit) {
      onPhase("ready");
      requestRender();
    }
    return hadOrbit;
  }

  function setHubMode(mode, destination = committedDestination, { animate = true } = {}) {
    if (mode === "focused" && viewZoom.band !== "planet") return hubMode;
    if (activeNavigationFocusId() || bodyFocusTransition) clearCelestialBodyFocus({ animate: false });
    const previousMode = hubMode;
    hubMode = mode === "focused" ? "focused" : "overview";
    focusedDestination = hubMode === "focused" ? normalizePlanetHubDestination(destination) : null;
    committedDestination = normalizePlanetHubDestination(destination);
    setHoveredDestination(null);
    const kind = previousMode === hubMode
      ? "destination"
      : hubMode === "focused" ? "focus-in" : "focus-out";
    startPresentationTransition(committedDestination, { animate, mode: hubMode, kind });
    retargetCinematicMood(committedDestination, { animate });
    spaceEnvironment?.setMood?.({ worldId, destination: committedDestination, mode: hubMode, animate });
    setPortalVisible(committedDestination === "arena");
    return hubMode;
  }

  function schedulePortalFrame() {
    if (!portalVisible || suspended || !portal?.video || disposed) return;
    if (typeof portal.video.requestVideoFrameCallback === "function") {
      portal.videoFrameHandle = portal.video.requestVideoFrameCallback(() => {
        requestRender();
        schedulePortalFrame();
      });
    }
  }

  async function setPortalVisible(visible) {
    portalRequestedVisible = Boolean(visible);
    portalVisible = portalRequestedVisible && !reducedMotion;
    if (!portal?.video) return false;
    if (!portalVisible || suspended) {
      portal.video.pause?.();
      if (portal.videoFrameHandle && typeof portal.video.cancelVideoFrameCallback === "function") {
        portal.video.cancelVideoFrameCallback(portal.videoFrameHandle);
      }
      portal.videoFrameHandle = 0;
      return false;
    }
    portal.video.preload = "auto";
    portal.video.load?.();
    try {
      await portal.video.play();
      if (!portal.videoTexture) {
        portal.videoTexture = new THREE.VideoTexture(portal.video);
        portal.videoTexture.colorSpace = THREE.SRGBColorSpace;
        portal.material.uniforms.packedMap.value = portal.videoTexture;
      }
      schedulePortalFrame();
      return true;
    } catch (error) {
      portalVisible = false;
      portal.material.uniforms.packedMap.value = portal.posterTexture;
      onAutoplayFailure(error);
      requestRender();
      return false;
    }
  }

  function setAvailable(destinations) {
    const available = new Set(destinations || []);
    availableSet = available;
    if (hoveredDestination && !available.has(hoveredDestination)) setHoveredDestination(null);
    for (const road of roadRoots) {
      const endpoints = road.userData.planetHubRoad;
      road.visible = available.has(endpoints.from) && available.has(endpoints.to);
    }
    updateFrontLandmark();
    requestRender();
  }

  function setEffectsLevel(value, options = {}) {
    currentEffectsLevel = ["full", "reduced", "off"].includes(value) ? value : "full";
    const nextReducedMotion = Boolean(options.reducedMotion ?? reducedMotion);
    const motionPreferenceChanged = nextReducedMotion !== reducedMotion;
    reducedMotion = nextReducedMotion;
    celestialCosmology?.setEffectsLevel?.(currentEffectsLevel, {
      reducedMotion,
      devicePixelRatio: renderer.getPixelRatio?.() || 1
    });
    if (motionPreferenceChanged) {
      resetOrbitIdle({ active: false, suppressed: hubMode !== "overview" || reducedMotion });
      if (sunSurfaceMaterial?.uniforms?.motion) {
        sunSurfaceMaterial.uniforms.motion.value = reducedMotion ? 0 : 1;
      }
      sunEffects?.setEffects?.({ effectsLevel: currentEffectsLevel, reducedMotion });
      if (reducedMotion) {
        pointerDragActive = false;
        orbitVelocity = { yaw: 0, pitch: 0 };
        orbitCoastUntil = 0;
        ignitionUntil = 0;
        ignitionBurstLevel = 0;
        // A live OS preference change must stop the spatial route immediately.
        // Its caller can then continue through the semantic black-fade path;
        // retaining the old in-flight record would keep animating despite the
        // newly requested reduced-motion setting.
        settleJourneyDeparture(false);
      }
      // Preserve Arena's requested state while pausing/resuming the actual
      // portal media as the OS preference changes at runtime.
      void setPortalVisible(portalRequestedVisible);
    }
    const profile = spaceEnvironment?.setEffects?.(value, {
      reducedMotion
    });
    if (celestialCosmology && isCosmicZoomActive()) syncCelestialCosmologyPresentation();
    sunEffects?.setEffects?.({ effectsLevel: currentEffectsLevel, reducedMotion });
    retargetCinematicMood(committedDestination, { animate: true });
    publishSpaceState();
    requestRender();
    return profile || null;
  }

  function setRocketIgnition(level = 1, durationMs = 0) {
    const normalized = Math.max(0, Math.min(1, Number(level) || 0));
    const duration = Math.max(0, Number(durationMs) || 0);
    if (duration > 0) {
      const now = windowRef?.performance?.now?.() || 0;
      ignitionBurstLevel = now < ignitionUntil
        ? Math.max(ignitionBurstLevel, normalized)
        : normalized;
      ignitionUntil = Math.max(ignitionUntil, now + duration);
    } else {
      ignitionLevel = normalized;
    }
    requestRender();
  }

  function completeReducedMotionJourneyHandoff({ direction = "outbound" } = {}) {
    if (journeyCrossfadePromise) return journeyCrossfadePromise;
    const returning = direction === "return";
    // Reduced motion is a semantic crossfade, not the same spatial Bezier
    // compressed into an uncomfortable fraction of a second. Leave every
    // celestial transform and the camera at their canonical Home values; the
    // existing app handoff owns the visual crossfade after this result.
    journeyCameraHeldForHandoff = false;
    restoreHomeCamera();
    if (journeyRocket) {
      journeyRocketHeldForHandoff = !returning;
      // Keep the docked silhouette stable until the semantic black crossfade
      // paints. The hold flag still lets a failed handoff use the ordinary
      // restore contract without introducing a one-frame disappearance.
      journeyRocket.visible = true;
    }
    setHoveredDestination(null);
    void setPortalVisible(false);
    setRocketIgnition(0);
    if (canvas?.dataset) {
      canvas.dataset.planetHubJourneyDeparture = "crossfade";
      canvas.dataset.planetHubJourneyDirection = returning ? "moon-to-earth" : "earth-to-moon";
      canvas.dataset.planetHubJourneyPresentation = "crossfade";
      canvas.dataset.planetHubJourneyCameraPhase = "crossfade";
      canvas.dataset.planetHubJourneyCameraFollow = "0.000";
    }
    onPhase("transitioning");
    requestRender();
    let pending;
    pending = Promise.resolve().then(() => {
      if (disposed) return false;
      if (canvas?.dataset) {
        canvas.dataset.planetHubJourneyDeparture = "arrival";
        canvas.dataset.planetHubJourneyDepartureProgress = "1.000";
      }
      onPhase("ready");
      requestRender();
      return true;
    }).finally(() => {
      if (journeyCrossfadePromise === pending) journeyCrossfadePromise = null;
    });
    journeyCrossfadePromise = pending;
    return pending;
  }

  function beginJourneyFlight({
    direction = "outbound",
    reducedMotion: motion = reducedMotion
  } = {}) {
    if (disposed || journeyDeparture || journeyCrossfadePromise) {
      return journeyDeparture?.promise || journeyCrossfadePromise || Promise.resolve(false);
    }
    if (worldId !== "earth" || !journeyRocket || !satelliteRoot) return Promise.resolve(false);
    const returning = direction === "return";
    if (!returning && (hubMode !== "focused" || focusedDestination !== "journey" || transition)) {
      return Promise.resolve(false);
    }

    const presentation = resolvePlanetHubJourneyPresentation({ direction, reducedMotion: motion });
    if (presentation.mode === "crossfade") {
      return completeReducedMotionJourneyHandoff({ direction: presentation.direction });
    }

    setCameraOwner("journey-flight");

    const now = windowRef?.performance?.now?.() || 0;
    const duration = presentation.durationMs;
    const ignitionMs = presentation.ignitionMs;
    let resolveDeparture;
    const promise = new Promise((resolve) => { resolveDeparture = resolve; });

    // Detach the vehicle from the rotating site while preserving its exact
    // rendered transform. The focused Earth remains where the player placed
    // it; the camera, not the whole planet, follows the departing vehicle.
    celestialSystem.updateMatrixWorld?.(true);
    journeyRocket.updateMatrixWorld?.(true);
    const originalParent = journeyRocket.parent;
    const dockPosition = journeyRocket.position.clone();
    const dockQuaternion = journeyRocket.quaternion.clone();
    const dockScale = journeyRocket.scale.clone();
    celestialSystem.attach?.(journeyRocket);
    const earthDockPosition = journeyRocket.position.clone();
    const earthDockQuaternion = journeyRocket.quaternion.clone();
    const earthDockScale = journeyRocket.scale.clone();
    const earthVehicleHeight = journeyRocketBoundsHeight * Math.max(
      Math.abs(earthDockScale.x),
      Math.abs(earthDockScale.y),
      Math.abs(earthDockScale.z)
    );
    const earthCenter = world.position.clone();
    const earthNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(earthDockQuaternion).normalize();
    const earthFacade = new THREE.Vector3(1, 0, 0).applyQuaternion(earthDockQuaternion).normalize();
    const earthLandingFacade = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(earthDockQuaternion)
      .normalize();
    const moonCenter = satelliteRoot.position.clone();
    const moonRadius = Math.max(0.01,
      Math.abs(satelliteRoot.scale.x),
      Math.abs(satelliteRoot.scale.y),
      Math.abs(satelliteRoot.scale.z));
    const lunarScale = earthDockScale.clone().multiplyScalar(0.18);
    const moonVehicleHeight = journeyRocketBoundsHeight * Math.max(
      Math.abs(lunarScale.x),
      Math.abs(lunarScale.y),
      Math.abs(lunarScale.z)
    );
    // The optimized rocket uses a tail pivot (manifest bounds minY = 0). Keep
    // the active plume plus an anti-z-fighting gap above the lunar mesh.
    const lunarTailClearance = Math.max(0.008, Math.abs(lunarScale.y) * 0.58);
    const moonLanding = calculatePlanetHubMoonLandingGeometry({
      moonCenter: moonCenter.toArray(),
      moonRadius,
      approachFrom: world.position.toArray(),
      tailClearance: lunarTailClearance
    });

    const fallbackMoonFrame = calculatePlanetHubTransportedFrame({
      forward: moonLanding.normal,
      preferredFacade: earthFacade.toArray()
    });
    const fallbackMoonBasis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...fallbackMoonFrame.facade),
      new THREE.Vector3(...fallbackMoonFrame.forward),
      new THREE.Vector3(...fallbackMoonFrame.side)
    );
    let moonDockPosition = new THREE.Vector3(...moonLanding.landingPosition);
    let moonDockNormal = new THREE.Vector3(...moonLanding.normal);
    // Landmark assets author their visible front along local +Z. Keep that
    // presentation axis separate from the rocket's +X flight-basis axis so the
    // landing camera sees the platform head-on instead of from its side.
    let moonDockFacade = new THREE.Vector3(...fallbackMoonFrame.side);
    let moonDockQuaternion = new THREE.Quaternion().setFromRotationMatrix(fallbackMoonBasis);
    if (moonJourneyPad && moonJourneyDock) {
      const lunarFrame = calculatePlanetHubTransportedFrame({
        forward: moonLanding.normal,
        preferredFacade: earthFacade.toArray()
      });
      const lunarBasis = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...lunarFrame.facade),
        new THREE.Vector3(...lunarFrame.forward),
        new THREE.Vector3(...lunarFrame.side)
      );
      moonJourneyPad.position.copy(new THREE.Vector3(...moonLanding.normal).multiplyScalar(1.006));
      moonJourneyPad.quaternion.setFromRotationMatrix(lunarBasis);
      setMoonJourneyPadFlightVisible(true);
      satelliteRoot.updateMatrixWorld?.(true);
      moonJourneyDock.updateMatrixWorld?.(true);
      const moonDockWorldPosition = moonJourneyDock.getWorldPosition(new THREE.Vector3());
      moonDockPosition = celestialSystem.worldToLocal(moonDockWorldPosition.clone());
      const celestialWorldQuaternion = celestialSystem.getWorldQuaternion(new THREE.Quaternion());
      const moonDockWorldQuaternion = moonJourneyDock.getWorldQuaternion(new THREE.Quaternion());
      moonDockQuaternion = celestialWorldQuaternion.invert().multiply(moonDockWorldQuaternion).normalize();
      moonDockNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(moonDockQuaternion).normalize();
      moonDockFacade = new THREE.Vector3(0, 0, 1).applyQuaternion(moonDockQuaternion).normalize();
    }

    let fromPosition = earthDockPosition.clone();
    let fromQuaternion = earthDockQuaternion.clone();
    let fromScale = earthDockScale.clone();
    let fromCenter = world.position.clone();
    let targetScale = lunarScale.clone();
    let toPosition = moonDockPosition.clone();
    let targetQuaternion = moonDockQuaternion.clone();
    let launchNormal = earthNormal.clone();
    let arrivalNormal = moonDockNormal.clone();
    let lastFacadeDirection = earthFacade.clone();
    let arrivalFacade = moonDockFacade.clone();
    let destinationCenter = moonCenter.clone();
    let destinationRadius = moonRadius;
    let departureRadius = 1;
    let fromVehicleHeight = earthVehicleHeight;
    let targetVehicleHeight = moonVehicleHeight;
    let cameraStartPosition = camera.position.clone();
    let cameraStartTarget = cameraTarget.clone();
    let cameraStartUp = camera.up.clone().normalize();

    if (returning) {
      const lunarFrame = calculatePlanetHubTransportedFrame({
        forward: moonDockNormal.toArray(),
        preferredFacade: moonDockFacade.toArray()
      });
      fromPosition = moonDockPosition.clone();
      fromQuaternion = moonDockQuaternion.clone();
      fromScale = lunarScale.clone();
      targetScale = earthDockScale.clone();
      toPosition = earthDockPosition.clone();
      targetQuaternion = earthDockQuaternion.clone();
      fromCenter = moonCenter.clone();
      launchNormal = moonDockNormal.clone();
      arrivalNormal = earthNormal.clone();
      lastFacadeDirection = moonDockFacade.clone();
      arrivalFacade = earthLandingFacade.clone();
      destinationCenter = world.position.clone();
      destinationRadius = 1;
      departureRadius = moonRadius;
      fromVehicleHeight = moonVehicleHeight;
      targetVehicleHeight = earthVehicleHeight;
      journeyRocket.position.copy(fromPosition);
      journeyRocket.quaternion.copy(fromQuaternion);
      journeyRocket.scale.copy(fromScale);
      journeyRocket.visible = true;
      journeyRocket.updateMatrixWorld?.(true);

      // Establish a readable lunar launch shot before the same transported
      // chase system takes over. All values originate in celestial-local
      // space, then move through the one scene transform into camera space.
      const lunarCameraDistance = Math.max(0.34, moonVehicleHeight * 5.2);
      const lunarCameraLocal = fromPosition.clone()
        .addScaledVector(moonDockFacade, lunarCameraDistance)
        .addScaledVector(launchNormal, moonVehicleHeight * 0.72)
        .addScaledVector(new THREE.Vector3(...lunarFrame.side), moonVehicleHeight * 0.58);
      const lunarTargetLocal = fromPosition.clone()
        .addScaledVector(launchNormal, moonVehicleHeight * 0.5);
      celestialSystem.updateMatrixWorld?.(true);
      cameraStartPosition = lunarCameraLocal.applyMatrix4(celestialSystem.matrixWorld);
      cameraStartTarget = lunarTargetLocal.applyMatrix4(celestialSystem.matrixWorld);
      cameraStartUp = launchNormal.clone().transformDirection(celestialSystem.matrixWorld).normalize();
      camera.position.copy(cameraStartPosition);
      camera.up.copy(cameraStartUp);
      camera.lookAt(cameraStartTarget);
    }
    if (!returning) {
      camera.up.copy(cameraStartUp);
      camera.lookAt(cameraStartTarget);
    }
    journeyDeparture = {
      promise,
      resolve: resolveDeparture,
      originalParent,
      dockPosition,
      dockQuaternion,
      dockScale,
      earthCenter,
      earthDockScale,
      fromCenter,
      fromPosition,
      fromQuaternion,
      fromScale,
      targetScale,
      toPosition,
      targetQuaternion,
      arrivalNormal,
      arrivalFacade,
      destinationCenter,
      destinationRadius,
      departureRadius,
      fromVehicleHeight,
      targetVehicleHeight,
      moonCenter,
      moonRadius,
      moonVehicleHeight,
      earthVehicleHeight,
      moonOrbitElapsed: Math.max(0, now - satelliteOrbitStartedAt),
      launchNormal,
      lastFacadeDirection,
      launchLiftShare: PLANET_HUB_JOURNEY_LAUNCH_LIFT_MS / duration,
      launchLiftHeight: PLANET_HUB_JOURNEY_LAUNCH_LIFT_HEIGHT,
      cameraStartPosition,
      cameraStartTarget,
      cameraStartUp,
      stableCameraUp: cameraStartUp.clone(),
      cameraFrame: null,
      landingCameraStartPose: null,
      attitudeFrame: null,
      smoothedCameraPosition: cameraStartPosition.toArray(),
      smoothedCameraTarget: cameraStartTarget.toArray(),
      smoothedCameraUp: cameraStartUp.toArray(),
      startedAt: now,
      duration,
      ignitionShare: ignitionMs / duration,
      launchViewHoldMs: PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS,
      launchViewHoldShare: PLANET_HUB_JOURNEY_LAUNCH_VIEW_HOLD_MS / duration,
      landingCameraStartMs: returning
        ? PLANET_HUB_JOURNEY_DURATION_MS - PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS
        : PLANET_HUB_JOURNEY_LANDING_CAMERA_START_MS,
      landingCameraBlendMs: returning
        ? PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS - PLANET_HUB_JOURNEY_LAUNCH_LIFT_MS
        : PLANET_HUB_JOURNEY_LANDING_CAMERA_BLEND_MS,
      landingStaticMs: PLANET_HUB_JOURNEY_LANDING_STATIC_MS,
      // Preserve the original ~860ms blend into the chase rig even though the
      // physical cruise leg is now much longer.
      followBlendShare: 860 / duration,
      routeStretch: PLANET_HUB_JOURNEY_ROUTE_STRETCH,
      preOrbitShare: PLANET_HUB_JOURNEY_PRE_ORBIT_SHARE,
      preOrbitRadians: PLANET_HUB_JOURNEY_PRE_ORBIT_RADIANS,
      direction,
      holdRocketForHandoff: presentation.holdRocketForHandoff,
      holdCameraForHandoff: presentation.holdCameraForHandoff,
      sunWasVisible: sunRoot?.visible !== false,
      reducedMotion: false
    };
    journeyCameraHeldForHandoff = false;

    setJourneyFlightChrome(true);
    if (sunRoot) sunRoot.visible = false;
    setHoveredDestination(null);
    setPortalVisible(false);
    setRocketIgnition(1, duration + 120);
    if (canvas?.dataset) {
      canvas.dataset.planetHubJourneyDeparture = "ignition";
      canvas.dataset.planetHubJourneyDirection = returning ? "moon-to-earth" : "earth-to-moon";
      canvas.dataset.planetHubJourneyPresentation = "spatial";
    }
    onPhase("transitioning");
    requestRender();
    return promise;
  }

  function playJourneyDeparture({ reducedMotion: motion = reducedMotion } = {}) {
    return beginJourneyFlight({ direction: "outbound", reducedMotion: motion });
  }

  function playJourneyReturn({
    fromWorld = "moon",
    toWorld = "earth",
    reducedMotion: motion = reducedMotion
  } = {}) {
    if (String(fromWorld).toLowerCase() !== "moon" || String(toWorld).toLowerCase() !== "earth") {
      return Promise.resolve(false);
    }
    return beginJourneyFlight({ direction: "return", reducedMotion: motion });
  }

  function settleJourneyDeparture(completed = false) {
    const activeDeparture = journeyDeparture;
    if (!activeDeparture) return false;
    journeyDeparture = null;
    setJourneyFlightChrome(false);
    if (sunRoot) sunRoot.visible = activeDeparture.sunWasVisible !== false;
    // The Moon was deliberately held for the uninterrupted departure shot.
    // Resume its slow physical orbit from that same phase without a completion
    // frame jump (especially important when a departure is cancelled).
    satelliteOrbitStartedAt = (windowRef?.performance?.now?.() || 0)
      - Math.max(0, Number(activeDeparture.moonOrbitElapsed) || 0);
    if (journeyRocket && activeDeparture.originalParent) {
      activeDeparture.originalParent.add?.(journeyRocket);
      journeyRocket.position.copy(activeDeparture.dockPosition);
      journeyRocket.quaternion.copy(activeDeparture.dockQuaternion);
      journeyRocket.scale.copy(activeDeparture.dockScale);
      // On successful arrival the semantic cinematic is about to cover Home.
      // Hold the restored docked rocket invisible so this completion frame
      // cannot flash it back on Earth; resume reveals it on a later Home visit.
      const holdRocket = Boolean(completed && activeDeparture.holdRocketForHandoff);
      journeyRocket.visible = !holdRocket;
      journeyRocketHeldForHandoff = holdRocket;
    }
    setMoonJourneyPadFlightVisible(false);
    const holdCamera = Boolean(completed && activeDeparture.holdCameraForHandoff);
    journeyCameraHeldForHandoff = holdCamera;
    // Outbound may retain the arrival camera behind the black handoff. A
    // completed Moon-to-Earth return is ordinary Home navigation, so restore
    // the exact overview camera immediately after the dock transform settles.
    if (!completed || !holdCamera) restoreHomeCamera();
    else setCameraOwner("journey-flight-held");
    if (canvas?.dataset) {
      canvas.dataset.planetHubJourneyDeparture = completed ? "arrival" : "cancelled";
      if (completed) canvas.dataset.planetHubJourneyDepartureProgress = "1.000";
      else {
        delete canvas.dataset.planetHubJourneyDepartureProgress;
        delete canvas.dataset.planetHubJourneyCameraFollow;
        delete canvas.dataset.planetHubJourneyRocketTangent;
        delete canvas.dataset.planetHubJourneyRocketUp;
        delete canvas.dataset.planetHubJourneyLanding;
        delete canvas.dataset.planetHubJourneyCameraPhase;
        delete canvas.dataset.planetHubJourneyCameraLandingBlend;
        delete canvas.dataset.planetHubJourneyDirection;
        delete canvas.dataset.planetHubJourneyPresentation;
      }
    }
    activeDeparture.resolve?.(Boolean(completed));
    return true;
  }

  function cancelJourneyDeparture() {
    return settleJourneyDeparture(false);
  }

  function restoreJourneyRocket() {
    let restored = false;
    if (journeyRocketHeldForHandoff && journeyRocket) {
      journeyRocket.visible = true;
      journeyRocketHeldForHandoff = false;
      restored = true;
    }
    if (journeyCameraHeldForHandoff) {
      journeyCameraHeldForHandoff = false;
      restoreHomeCamera();
      restored = true;
    }
    if (canvas?.dataset && restored) {
      canvas.dataset.planetHubJourneyDeparture = "docked";
      delete canvas.dataset.planetHubJourneyDepartureProgress;
      delete canvas.dataset.planetHubJourneyCameraFollow;
      delete canvas.dataset.planetHubJourneyRocketTangent;
      delete canvas.dataset.planetHubJourneyRocketUp;
      delete canvas.dataset.planetHubJourneyLanding;
      delete canvas.dataset.planetHubJourneyCameraPhase;
      delete canvas.dataset.planetHubJourneyCameraLandingBlend;
      delete canvas.dataset.planetHubJourneyDirection;
      delete canvas.dataset.planetHubJourneyPresentation;
    }
    if (restored) requestRender();
    return restored;
  }

  function pickDetail(clientX, clientY) {
    const rect = canvas.getBoundingClientRect?.();
    if (!rect?.width || !rect?.height) return null;
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    // Raycast the globe alongside the sites so a landmark on the far side
    // cannot be selected through the planet. Three's recursive raycaster does
    // not consistently discard children of a hidden parent, so verify the
    // complete visibility chain as well.
    const hierarchyIsVisible = (object) => {
      let current = object;
      while (current && current !== scene) {
        if (current.visible === false) return false;
        current = current.parent || null;
      }
      return true;
    };
    const rules = getViewInteractionRules();
    const solarDetailInteractive = isSolarAtlasDetailInteractive();
    const pickRoots = solarDetailInteractive ? [planet] : [];
    if (rules.celestialBodyPicking && solarDetailInteractive) {
      if (satelliteRoot) pickRoots.push(satelliteRoot);
      if (sunRoot) pickRoots.push(sunRoot);
      for (const record of celestialAtlas?.bodies?.values?.() || []) {
        if (record.visual?.visible === false) continue;
        if (record.visual && !pickRoots.includes(record.visual)) pickRoots.push(record.visual);
      }
    }
    if (rules.landmarkPicking) pickRoots.push(...interactiveRoots);
    const hit = raycaster.intersectObjects(pickRoots, true)
      .find((entry) => hierarchyIsVisible(entry.object) && !entry.object?.userData?.planetHubHoverEffect);
    const detail = resolvePlanetHubRaycastDetail(hit?.object, scene);
    if (detail || !rules.celestialBodyPicking) return detail;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const body = bodyProjectionSnapshot.find((entry) => {
      const labelHit = entry.hitRect
        && x >= entry.hitRect.left
        && x <= entry.hitRect.right
        && y >= entry.hitRect.top
        && y <= entry.hitRect.bottom;
      return labelHit || (entry.x - x) ** 2 + (entry.y - y) ** 2 <= 784;
    })?.id;
    return body ? Object.freeze({ target: body, destination: null, action: null, satellite: body === "moon" ? body : null, body }) : null;
  }

  function satellitePointerMove(event) {
    if (!satelliteRoot) return;
    const hovered = event.pointerType !== "touch" && pickDetail(event.clientX, event.clientY)?.target === "moon";
    if (satelliteHovered === hovered) return;
    satelliteHovered = hovered;
    requestRender();
  }

  function satellitePointerLeave() {
    if (!satelliteHovered || bodyFocusId === "moon") return;
    satelliteHovered = false;
    requestRender();
  }

  const satelliteCanvasListeners = [
    ["pointermove", satellitePointerMove],
    ["pointerleave", satellitePointerLeave]
  ];
  const satelliteEventHost = canvas.parentElement || canvas;
  if (satelliteRoot) {
    for (const [type, listener] of satelliteCanvasListeners) satelliteEventHost.addEventListener?.(type, listener);
  }

  function publishPresentationState() {
    if (!canvas?.dataset) return;
    const format = (value) => (Math.abs(value) < 0.00005 ? 0 : value).toFixed(4);
    canvas.dataset.planetHubCameraOwner = cameraOwner;
    canvas.dataset.planetHubOrbitBody = orbitBodyId;
    canvas.dataset.planetHubSelectedBody = selectedBodyId;
    canvas.dataset.planetHubCameraRadius = format(cameraOrbitState.radius);
  }

  function suspend() {
    // Backgrounding or covering Home cannot leave an activation promise (or
    // the physical rocket) stranded halfway between Earth and the Moon.
    settleJourneyDeparture(false);
    suspended = true;
    spaceEnvironment?.suspend?.();
    if (frameRequest) windowRef?.cancelAnimationFrame?.(frameRequest);
    frameRequest = 0;
    portal?.video?.pause?.();
  }

  function resume() {
    if (!suspended || disposed) return;
    suspended = false;
    restoreJourneyRocket();
    spaceEnvironment?.resume?.();
    if (portalRequestedVisible) void setPortalVisible(true);
    requestRender();
  }

  function disposeRenderer() {
    if (disposed) return;
    disposed = true;
    surfaceHookLoadGeneration += 1;
    settleJourneyDeparture(false);
    suspend();
    if (portal?.video) {
      portal.video.pause?.();
      portal.video.removeAttribute?.("src");
      while (portal.video.firstChild) portal.video.removeChild(portal.video.firstChild);
      portal.video.load?.();
    }
    portal?.videoTexture?.dispose?.();
    portal?.posterTexture?.dispose?.();
    for (const [type, listener] of satelliteCanvasListeners) satelliteEventHost.removeEventListener?.(type, listener);
    sunEffects?.root?.removeFromParent?.();
    sunEffects?.dispose?.();
    sunEffects = null;
    celestialAtlas?.dispose?.();
    celestialAtlas = null;
    celestialSemanticPresentation = null;
    celestialCosmology?.dispose?.();
    celestialCosmology = null;
    celestialCosmologyPresentation = null;
    if (pendingPlaceVisit) pendingPlaceVisit.resolve(false);
    if (pendingNavigationRestore) pendingNavigationRestore.resolve(false);
    pendingPlaceVisit = null;
    pendingNavigationRestore = null;
    for (const element of bodyLabelElements.values()) element.remove?.();
    bodyLabelElements.clear();
    disposeObject(satelliteRoot);
    disposeObject(sunVisualRoot);
    disposeObject(sunRoot);
    disposeObject(world);
    for (const texture of surfaceHookTextures) texture.dispose?.();
    surfaceHookTextures.length = 0;
    spaceEnvironment?.dispose?.();
    spaceEnvironment = null;
    disposePlanetHubWebGLRenderer(renderer);
  }

  navigationSelectBody = setSelectedBody;
  navigationFocusBody = setCelestialBodyFocus;
  navigationSetOrbitBody = setOrbitBody;
  navigationSetViewZoom = setViewZoom;
  navigationSetCosmicZoom = setCosmicZoom;
  requestRenderAcrossConstruction = requestRender;
  resize();
  setDestination(activeDestination, { animate: false });
  coreSceneReady = true;
  requestRender();
  const warmCosmology = () => {
    if (!disposed) void ensureCelestialCosmology();
  };
  if (typeof windowRef?.requestIdleCallback === "function") {
    windowRef.requestIdleCallback(warmCosmology, { timeout: 4000 });
  } else windowRef?.setTimeout?.(warmCosmology, 4000);
  const resizeObserver = typeof windowRef?.ResizeObserver === "function" ? new windowRef.ResizeObserver(resize) : null;
  resizeObserver?.observe?.(canvas);

  return Object.freeze({
    setDestination,
    adoptDestination,
    setViewZoom,
    setCosmicZoom,
    setOrbitBody,
    setSelectedBody,
    getBodyLabel,
    getNavigationContext,
    getNavigationPlaces: (options) => getNavigationContext(options).places,
    selectPlace,
    visitPlace,
    captureNavigationState,
    restoreNavigationState,
    getNavigationPhase: () => (
      transition || bodyFocusTransition || zoomFocusPending
        || pendingPlaceVisit || pendingNavigationRestore || pendingSegmentZoom
        ? "transitioning"
        : "ready"
    ),
    getViewZoom,
    setPointerDrag,
    releasePointerDrag,
    clearPointerOrbit,
    setHoveredDestination,
    setHubMode,
    setAvailable,
    setEffectsLevel,
    setRocketIgnition,
    playJourneyDeparture,
    playJourneyReturn,
    cancelJourneyDeparture,
    restoreJourneyRocket,
    pickDetail,
    getCameraOwner: () => cameraOwner,
    suspend,
    resume,
    destroy() {
      resizeObserver?.disconnect?.();
      disposeRenderer();
    }
  });
  } catch (error) {
    surfaceHookLoadGeneration += 1;
    disposed = true;
    portal?.video?.pause?.();
    portal?.videoTexture?.dispose?.();
    portal?.posterTexture?.dispose?.();
      celestialAtlas?.dispose?.();
      celestialAtlas = null;
      celestialSemanticPresentation = null;
      celestialCosmology?.dispose?.();
      celestialCosmology = null;
      celestialCosmologyPresentation = null;
    for (const element of bodyLabelElements.values()) element.remove?.();
    bodyLabelElements.clear();
    disposeObject(satelliteRoot);
    disposeObject(sunVisualRoot);
    disposeObject(sunRoot);
    disposeObject(world);
    for (const texture of surfaceHookTextures) texture.dispose?.();
    surfaceHookTextures.length = 0;
    spaceEnvironment?.dispose?.();
    disposePlanetHubWebGLRenderer(renderer);
    throw error;
  }
}
