const QUALITIES = new Set(["low", "standard"]);
const EFFECT_LEVELS = new Set(["full", "reduced", "off"]);
const MAX_RAY_LOBES = 8;

const clamp = (value, minimum = 0, maximum = 1) => (
  Math.max(minimum, Math.min(maximum, Number(value) || 0))
);

const freezeDeep = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
};

const vector3 = (value, fallback = [0, 0, 0]) => {
  const source = Array.isArray(value) ? value : fallback;
  return [0, 1, 2].map((index) => Number(source[index]) || 0);
};

function seededRandom(seed = 0x51a7c05) {
  let state = (Number(seed) || 0x51a7c05) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export const PLANET_HUB_SUN_EFFECT_PROFILES = freezeDeep({
  low: {
    angularDiameterDegrees: 6.5,
    rayCount: 6,
    rayStrength: 0.72,
    coronaStrength: 1.16,
    streakStrength: 0.74,
    opacity: 0.94,
    eclipseRim: 0.045
  },
  standard: {
    angularDiameterDegrees: 7,
    rayCount: 8,
    rayStrength: 0.86,
    coronaStrength: 1.32,
    streakStrength: 0.9,
    opacity: 0.98,
    eclipseRim: 0.045
  }
});

export function resolvePlanetHubSunEffectsProfile({
  quality = "low",
  effectsLevel = "full",
  reducedMotion = false
} = {}) {
  const normalizedQuality = QUALITIES.has(quality) ? quality : "low";
  const requestedEffects = EFFECT_LEVELS.has(effectsLevel) ? effectsLevel : "full";
  const base = PLANET_HUB_SUN_EFFECT_PROFILES[normalizedQuality];
  if (requestedEffects === "off") {
    return freezeDeep({
      ...base,
      quality: normalizedQuality,
      requestedEffects,
      effectiveEffects: "off",
      enabled: false,
      animated: false,
      motion: 0,
      rayCount: 0,
      opacity: 0
    });
  }
  const reduced = requestedEffects === "reduced" || reducedMotion;
  return freezeDeep({
    ...base,
    quality: normalizedQuality,
    requestedEffects,
    effectiveEffects: reduced ? "reduced" : "full",
    enabled: true,
    animated: !reduced,
    motion: reduced ? 0 : 1,
    rayCount: reduced ? Math.min(4, base.rayCount) : base.rayCount,
    rayStrength: base.rayStrength * (reduced ? 0.48 : 1),
    coronaStrength: base.coronaStrength * (reduced ? 0.7 : 1),
    streakStrength: base.streakStrength * (reduced ? 0.5 : 1),
    opacity: base.opacity * (reduced ? 0.82 : 1)
  });
}

export function createPlanetHubSunRayLobes({
  quality = "low",
  seed = 0x51a7c05,
  count
} = {}) {
  const profile = PLANET_HUB_SUN_EFFECT_PROFILES[QUALITIES.has(quality) ? quality : "low"];
  const requestedCount = count === undefined ? profile.rayCount : Number(count);
  const rayCount = Math.max(0, Math.min(MAX_RAY_LOBES, Math.round(Number.isFinite(requestedCount) ? requestedCount : profile.rayCount)));
  const random = seededRandom(seed);
  const phaseStep = Math.PI / Math.max(1, rayCount);
  const lobes = [];
  for (let index = 0; index < rayCount; index += 1) {
    // Lobes are bidirectional in the shader, so their authored phase occupies
    // half a turn. Low-discrepancy spacing prevents a noisy pinwheel while the
    // seeded offsets keep the corona from looking mechanically symmetrical.
    const angle = index * phaseStep + (random() - 0.5) * phaseStep * 0.58;
    lobes.push(freezeDeep({
      angle,
      sharpness: (quality === "standard" ? 72 : 54) + random() * (quality === "standard" ? 112 : 72),
      reach: (quality === "standard" ? 1.35 : 1.2) + random() * (quality === "standard" ? 1.5 : 1.1),
      intensity: 0.22 + random() * 0.42
    }));
  }
  return Object.freeze(lobes);
}

// This multiplier shapes an already-physical angular radius.  Zero is a valid
// far-distance result; a nonzero minimum would recreate a fixed glare plateau.
export function calculatePlanetHubSunOpticalScale(scale = 1) {
  return clamp(scale, 0, 1);
}

export function calculatePlanetHubSunAngularPlane({
  cameraPosition = [0, 0, 4.5],
  sunPosition = [0, 0, -8],
  physicalRadius = null,
  angularDiameterDegrees = 10,
  minimumDistance = 0.1
} = {}) {
  const camera = vector3(cameraPosition);
  const sun = vector3(sunPosition, [0, 0, -8]);
  const distance = Math.max(Number(minimumDistance) || 0.1, Math.hypot(
    sun[0] - camera[0],
    sun[1] - camera[1],
    sun[2] - camera[2]
  ));
  const suppliedRadius = Number(physicalRadius);
  const radius = Number.isFinite(suppliedRadius) && suppliedRadius > 0 ? suppliedRadius : 0;
  const radians = radius > 0
    ? 2 * Math.asin(Math.min(0.999999999, radius / distance))
    : Math.max(0, Math.min(45, Number(angularDiameterDegrees) || 10)) * Math.PI / 180;
  const degrees = radians * 180 / Math.PI;
  return freezeDeep({
    distance,
    physicalRadius: radius,
    angularDiameterDegrees: degrees,
    angularDiameterRadians: radians,
    worldDiameter: radius > 0 ? radius * 2 : 2 * distance * Math.tan(radians / 2)
  });
}

export function calculatePlanetHubSunOcclusionSplit({
  discVisibility = 1,
  eclipseRim = 0.3
} = {}) {
  const visibility = clamp(discVisibility);
  const rim = clamp(eclipseRim, 0, 0.8);
  return freezeDeep({
    disc: visibility,
    corona: rim + (1 - rim) * visibility,
    rays: visibility * visibility,
    streak: visibility
  });
}

export function calculatePlanetHubSunViewportVisibility({
  sunNdc = [0, 0, 0],
  facing = true,
  allowBeyondFar = false,
  margin = 0.18
} = {}) {
  const source = vector3(sunNdc);
  const fade = Math.max(0.01, Number(margin) || 0.18);
  const limit = 1 + fade;
  // Facing is the authoritative behind-camera test. A physically distant Sun
  // may sit beyond the precision-safe scene far plane while its analytic
  // optical projection is still valid.
  const depthVisible = source[2] >= -1 && (allowBeyondFar || source[2] <= 1);
  const edge = Math.min(limit - Math.abs(source[0]), limit - Math.abs(source[1]));
  const opacity = facing && depthVisible ? clamp(edge / fade) : 0;
  return freezeDeep({
    visible: opacity > 0,
    opacity,
    ndc: source
  });
}

export const PLANET_HUB_SUN_EFFECTS_VERTEX_SHADER = `varying vec2 vScreen;void main(){vScreen=position.xy;gl_Position=vec4(position.xy,0.,1.);}`;

export const PLANET_HUB_SUN_EFFECTS_FRAGMENT_SHADER = `
  #define PLANET_HUB_MAX_SUN_RAYS 8
  uniform vec3 uCoreColor;
  uniform vec3 uCoronaColor;
  uniform vec4 uRayLobes[PLANET_HUB_MAX_SUN_RAYS];
  uniform int uRayCount;
  uniform float uOpacity;
  uniform float uRayStrength;
  uniform float uCoronaStrength;
  uniform float uStreakStrength;
  uniform float uDiscVisibility;
  uniform float uCoronaVisibility;
  uniform float uRayVisibility;
  uniform float uStreakVisibility;
  uniform vec2 uSunNdc;
  uniform float uAspect;
  uniform float uRadius;
  uniform float uViewportVisibility;
  varying vec2 vScreen;

  float polygonAperture(vec2 point, float sides, float rotation) {
    float angle = atan(point.y, point.x) + rotation;
    float sector = 6.2831853 / sides;
    float edge = cos(floor(0.5 + angle / sector) * sector - angle) * length(point);
    float fill = 1.0 - smoothstep(0.76, 1.02, edge);
    float rim = smoothstep(0.58, 0.78, edge) * (1.0 - smoothstep(0.86, 1.04, edge));
    return fill * 0.62 + rim * 0.38;
  }

  void main() {
    vec2 point = vec2((vScreen.x - uSunNdc.x) * uAspect, vScreen.y - uSunNdc.y)
      / max(uRadius, 0.000000001);
    float radius = length(point);
    float angle = atan(point.y, point.x);
    float core = 1.0 - smoothstep(0.015, 0.18, radius);
    float coreTexture = 0.9 + 0.1 * sin(angle * 17.0 + radius * 53.0)
      * sin(angle * 29.0 - radius * 79.0);
    float innerCorona = pow(max(0.0, 1.0 - radius / 1.35), 3.4);
    float outerCorona = pow(max(0.0, 1.0 - radius / 3.1), 2.1);
    float rays = 0.0;
    for (int index = 0; index < PLANET_HUB_MAX_SUN_RAYS; index += 1) {
      if (index >= uRayCount) continue;
      vec4 lobe = uRayLobes[index];
      float alignment = abs(cos(angle - lobe.x));
      float beam = pow(alignment, lobe.y);
      float needle = pow(alignment, lobe.y * 1.65);
      float radial = 1.0 - smoothstep(0.08, lobe.z, radius);
      float needleRadial = 1.0 - smoothstep(0.05, lobe.z * 1.28, radius);
      rays += (beam * radial * 0.56 + needle * needleRadial * 0.74) * lobe.w;
    }
    rays *= smoothstep(0.05, 0.16, radius);
    vec2 screen = vec2(vScreen.x * uAspect, vScreen.y);
    vec2 axis = vec2(uSunNdc.x * uAspect, uSunNdc.y);
    vec2 flareAxis = -axis;
    float ghostScale = clamp(uRadius * 4.1, 0.000001, 1.0);
    vec2 ghostAxis = flareAxis * ghostScale;
    float ghostA = polygonAperture((screen - axis - ghostAxis * 0.22) / (0.145 * ghostScale), 6.0, 0.12);
    float ghostB = polygonAperture((screen - axis - ghostAxis * 0.43) / (0.09 * ghostScale), 5.0, -0.16);
    float ghostC = polygonAperture((screen - axis - ghostAxis * 0.63) / (0.18 * ghostScale), 6.0, 0.32);
    float ghostD = polygonAperture((screen - axis - ghostAxis * 0.84) / (0.045 * ghostScale), 5.0, 0.58);
    float ghostE = polygonAperture((screen - axis - ghostAxis * 1.18) / (0.075 * ghostScale), 6.0, 0.16);
    float ghostF = polygonAperture((screen - axis - ghostAxis * 1.55) / (0.16 * ghostScale), 5.0, -0.1);
    float axisEnergy = smoothstep(0.05, 0.3, length(axis));
    float warmGhosts = ghostA * 0.38 + ghostB * 0.32 + ghostC * 0.26 + ghostD * 0.28;
    float coolGhosts = ghostE * 0.2 + ghostF * 0.15;
    float ghostGate = axisEnergy * uStreakStrength * uStreakVisibility * uStreakVisibility;
    warmGhosts *= ghostGate;
    coolGhosts *= ghostGate;
    float polygonGhosts = warmGhosts + coolGhosts;
    float sourceHaze = pow(max(0.0, 1.0 - length(screen - axis)
      / max(uRadius * 7.0, 0.000001)), 2.25)
      * 0.22 * uDiscVisibility;
    float axialHaze = pow(max(0.0, 1.0 - length(screen - axis * 0.5)
      / max(uRadius * 10.0, 0.000001)), 3.0)
      * 0.055 * axisEnergy * uDiscVisibility;
    float lensHaze = sourceHaze + axialHaze;
    float coronaSignal = innerCorona * 0.78 * uCoronaVisibility
      + outerCorona * 0.26 * uDiscVisibility;
    // The depth-tested sphere owns the solar surface. The optical layer only
    // kisses its center so the authored granulation remains visible.
    float lightSignal = core * coreTexture * uDiscVisibility * 0.28
      + coronaSignal * uCoronaStrength
      + rays * uRayStrength * uRayVisibility + lensHaze;
    float signal = lightSignal + polygonGhosts;
    float alpha = min(signal * uOpacity * uViewportVisibility, 0.96);
    if (alpha < 0.001) discard;
    vec3 lightColor = mix(uCoronaColor, uCoreColor,
      clamp(core * 1.28 + innerCorona * 0.2, 0.0, 1.0));
    vec3 color = (lightColor * lightSignal
      + vec3(1.0, 0.43, 0.12) * warmGhosts
      + vec3(0.38, 0.24, 0.46) * coolGhosts) / max(signal, 0.001);
    gl_FragColor = vec4(color, alpha);
  }
`;

function rayUniforms(THREE, lobes) {
  // The hub's pinned Three.js vendor pack intentionally exports only the
  // constructors used by the runtime. Keep this vec4 array as packed scalar
  // data so the Sun rig does not require the otherwise-unused Vector4 class.
  // Three.js' uniform flattener accepts the same packed representation for a
  // `vec4[]`, and this saves another public vendor symbol on the lazy path.
  const padded = new Float32Array(MAX_RAY_LOBES * 4);
  Array.from({ length: MAX_RAY_LOBES }, (_, index) => {
    const lobe = lobes[index] || { angle: 0, sharpness: 64, reach: 0, intensity: 0 };
    padded[index * 4] = lobe.angle;
    padded[index * 4 + 1] = lobe.sharpness;
    padded[index * 4 + 2] = lobe.reach;
    padded[index * 4 + 3] = lobe.intensity;
  });
  return padded;
}

export function createPlanetHubSunEffectsRig(THREE, {
  quality = "low",
  effectsLevel = "full",
  reducedMotion = false,
  seed = 0x51a7c05,
  coreColor = 0xfff5d6,
  coronaColor = 0xffd39a,
  renderOrder = -18
} = {}) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.ShaderMaterial || !THREE?.PlaneGeometry) {
    throw new TypeError("Three.js Group, Mesh, ShaderMaterial, and PlaneGeometry are required.");
  }

  const normalizedQuality = QUALITIES.has(quality) ? quality : "low";
  const lobes = createPlanetHubSunRayLobes({ quality: normalizedQuality, seed, count: MAX_RAY_LOBES });
  let requestedEffects = EFFECT_LEVELS.has(effectsLevel) ? effectsLevel : "full";
  let motionReduced = Boolean(reducedMotion);
  let profile = resolvePlanetHubSunEffectsProfile({
    quality: normalizedQuality,
    effectsLevel: requestedEffects,
    reducedMotion: motionReduced
  });
  let lastPlane = calculatePlanetHubSunAngularPlane({ angularDiameterDegrees: profile.angularDiameterDegrees });
  let lastOcclusion = calculatePlanetHubSunOcclusionSplit({ eclipseRim: profile.eclipseRim });
  let lastViewport = calculatePlanetHubSunViewportVisibility({ facing: false });
  let lastOpticalScale = 1;
  let lastOpticalRadiusNdc = 0;
  let lastPhysicalRadius = 0;
  let disposed = false;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCoreColor: { value: new THREE.Color(coreColor) },
      uCoronaColor: { value: new THREE.Color(coronaColor) },
      uRayLobes: { value: rayUniforms(THREE, lobes) },
      uRayCount: { value: profile.rayCount },
      uOpacity: { value: profile.opacity },
      uRayStrength: { value: profile.rayStrength },
      uCoronaStrength: { value: profile.coronaStrength },
      uStreakStrength: { value: profile.streakStrength },
      uDiscVisibility: { value: lastOcclusion.disc },
      uCoronaVisibility: { value: lastOcclusion.corona },
      uRayVisibility: { value: lastOcclusion.rays },
      uStreakVisibility: { value: lastOcclusion.streak },
      uSunNdc: { value: new Float32Array(2) },
      uAspect: { value: 1 },
      uRadius: { value: 0.25 },
      uViewportVisibility: { value: 0 }
    },
    vertexShader: PLANET_HUB_SUN_EFFECTS_VERTEX_SHADER,
    fragmentShader: PLANET_HUB_SUN_EFFECTS_FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const plane = new THREE.Mesh(geometry, material);
  plane.name = "planet-hub-procedural-sun-effects";
  plane.renderOrder = Number(renderOrder) || -18;
  plane.frustumCulled = false;
  const root = new THREE.Group();
  root.name = "planet-hub-sun-effects-root";
  root.visible = profile.enabled;
  root.add(plane);
  const projectedSun = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();
  const sunDirection = new THREE.Vector3();

  function applyProfile() {
    root.visible = profile.enabled;
    material.uniforms.uRayCount.value = profile.rayCount;
    material.uniforms.uOpacity.value = profile.opacity;
    material.uniforms.uRayStrength.value = profile.rayStrength;
    material.uniforms.uCoronaStrength.value = profile.coronaStrength;
    material.uniforms.uStreakStrength.value = profile.streakStrength;
  }

  function setEffects(next = {}) {
    if (next.effectsLevel !== undefined) {
      requestedEffects = EFFECT_LEVELS.has(next.effectsLevel) ? next.effectsLevel : "full";
    }
    if (next.reducedMotion !== undefined) motionReduced = Boolean(next.reducedMotion);
    profile = resolvePlanetHubSunEffectsProfile({
      quality: normalizedQuality,
      effectsLevel: requestedEffects,
      reducedMotion: motionReduced
    });
    applyProfile();
    return profile;
  }

  function update({
    camera,
    sunPosition = [0, 0, -8],
    physicalRadius = null,
    discVisibility = 1,
    elapsedSeconds = 0,
    opacity = 1,
    scale = 1
  } = {}) {
    if (disposed || !profile.enabled) return false;
    const position = vector3(sunPosition, [0, 0, -8]);
    if (camera?.getWorldPosition) camera.getWorldPosition(cameraPosition);
    else cameraPosition.fromArray(camera?.position?.toArray?.() || [0, 0, 4.5]);
    const cameraCoordinates = cameraPosition.toArray();
    lastPlane = calculatePlanetHubSunAngularPlane({
      cameraPosition: cameraCoordinates,
      sunPosition: position,
      physicalRadius,
      angularDiameterDegrees: profile.angularDiameterDegrees
    });
    lastPhysicalRadius = lastPlane.physicalRadius;
    projectedSun.set(...position);
    sunDirection.copy(projectedSun).sub(cameraPosition);
    camera?.getWorldDirection?.(cameraForward);
    const facing = cameraForward.lengthSq() > 0 && cameraForward.dot(sunDirection) > 0;
    if (camera?.projectionMatrix) projectedSun.project(camera);
    lastViewport = calculatePlanetHubSunViewportVisibility({
      sunNdc: projectedSun.toArray(),
      facing,
      allowBeyondFar: lastPlane.physicalRadius > 0
    });
    lastOcclusion = calculatePlanetHubSunOcclusionSplit({
      discVisibility,
      eclipseRim: profile.eclipseRim
    });
    void elapsedSeconds;
    const effectiveOpacity = profile.opacity * clamp(opacity);
    material.uniforms.uOpacity.value = effectiveOpacity;
    material.uniforms.uDiscVisibility.value = lastOcclusion.disc;
    material.uniforms.uCoronaVisibility.value = lastOcclusion.corona;
    material.uniforms.uRayVisibility.value = lastOcclusion.rays;
    material.uniforms.uStreakVisibility.value = lastOcclusion.streak;
    material.uniforms.uSunNdc.value[0] = lastViewport.ndc[0];
    material.uniforms.uSunNdc.value[1] = lastViewport.ndc[1];
    material.uniforms.uAspect.value = Math.max(0.01, Number(camera?.aspect) || 1);
    const fov = Math.max(1, Math.min(120, Number(camera?.fov) || 28)) * Math.PI / 180;
    lastOpticalScale = calculatePlanetHubSunOpticalScale(scale);
    lastOpticalRadiusNdc = Math.tan(lastPlane.angularDiameterRadians / 2) / Math.tan(fov / 2)
      * lastOpticalScale;
    material.uniforms.uRadius.value = lastOpticalRadiusNdc;
    material.uniforms.uViewportVisibility.value = lastViewport.opacity;
    root.visible = profile.enabled && lastViewport.visible
      && effectiveOpacity > 0.001 && lastOpticalRadiusNdc > 1e-9;
    return profile.animated && root.visible;
  }

  function snapshot() {
    return freezeDeep({
      enabled: profile.enabled,
      animated: profile.animated,
      quality: profile.quality,
      effectiveEffects: profile.effectiveEffects,
      rayCount: profile.rayCount,
      worldDiameter: lastPlane.worldDiameter,
      physicalRadius: lastPhysicalRadius,
      angularDiameterDegrees: lastPlane.angularDiameterDegrees,
      opticalScale: lastOpticalScale,
      opticalRadiusNdc: lastOpticalRadiusNdc,
      viewport: { ...lastViewport },
      occlusion: { ...lastOcclusion }
    });
  }

  function dispose() {
    if (disposed) return false;
    disposed = true;
    root.remove(plane);
    geometry.dispose();
    material.dispose();
    return true;
  }

  applyProfile();
  return Object.freeze({
    root,
    plane,
    geometry,
    material,
    lobes,
    update,
    setEffects,
    snapshot,
    dispose,
    destroy: dispose
  });
}
