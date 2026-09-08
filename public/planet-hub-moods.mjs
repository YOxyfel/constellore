const DESTINATIONS = Object.freeze(["forge", "journey", "arena"]);
const WORLDS = Object.freeze(["earth", "moon"]);
const EFFECT_LEVELS = Object.freeze(["full", "reduced", "off"]);

const clamp = (value, minimum = 0, maximum = 1) => (
  Math.max(minimum, Math.min(maximum, Number(value) || 0))
);

const smoothstep = (minimum, maximum, value) => {
  if (maximum <= minimum) return value >= maximum ? 1 : 0;
  const amount = clamp((value - minimum) / (maximum - minimum));
  return amount * amount * (3 - 2 * amount);
};

const smootherstep = (minimum, maximum, value) => {
  if (maximum <= minimum) return value >= maximum ? 1 : 0;
  const amount = clamp((value - minimum) / (maximum - minimum));
  return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
};

const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

const colorChannels = (value) => [
  (Number(value) >> 16) & 255,
  (Number(value) >> 8) & 255,
  Number(value) & 255
];

export function mixPlanetHubMoodColor(left, right, amount = 0) {
  const progress = clamp(amount);
  const from = colorChannels(left);
  const to = colorChannels(right);
  return from.reduce((value, channel, index) => (
    value | Math.round(channel + (to[index] - channel) * progress) << (16 - index * 8)
  ), 0);
}

function normalizedVector3(value, fallback = [0, 0, 1]) {
  const vector = Array.isArray(value) ? value.slice(0, 3).map((entry) => Number(entry) || 0) : [...fallback];
  while (vector.length < 3) vector.push(0);
  const length = Math.hypot(...vector);
  return length > 1e-7 ? vector.map((entry) => entry / length) : [...fallback];
}

export function calculatePlanetHubSunLightingRig({
  sunPosition = [-4.1, 1.7, -7.8],
  planetPosition = [0, 0, 0],
  keyDistance = 8
} = {}) {
  const sun = Array.isArray(sunPosition) ? sunPosition.slice(0, 3).map((entry) => Number(entry) || 0) : [-4.1, 1.7, -7.8];
  const planet = Array.isArray(planetPosition) ? planetPosition.slice(0, 3).map((entry) => Number(entry) || 0) : [0, 0, 0];
  const direction = normalizedVector3(sun.map((entry, index) => entry - planet[index]), [-0.45, 0.18, -0.87]);
  const distance = Math.max(0.1, Number(keyDistance) || 8);
  return deepFreeze({
    direction,
    keyPosition: direction.map((entry, index) => planet[index] + entry * distance),
    targetPosition: planet,
    physicalDistance: Math.hypot(...sun.map((entry, index) => entry - planet[index]))
  });
}

export function calculatePlanetHubSunDiscVisibility({
  cameraPosition = [0, 0.08, 4.5],
  planetPosition = [0, 0, 0],
  planetRadius = 1,
  sunPosition = [-4.1, 1.7, -7.8],
  sunRadius = 0.36
} = {}) {
  const camera = cameraPosition.slice(0, 3).map((entry) => Number(entry) || 0);
  const planetVector = planetPosition.slice(0, 3).map((entry, index) => (Number(entry) || 0) - camera[index]);
  const sunVector = sunPosition.slice(0, 3).map((entry, index) => (Number(entry) || 0) - camera[index]);
  const planetDistance = Math.max(1e-6, Math.hypot(...planetVector));
  const sunDistance = Math.max(1e-6, Math.hypot(...sunVector));
  if (planetDistance >= sunDistance) return deepFreeze({ visibility: 1, occlusion: 0, separation: Math.PI });
  const planetDirection = normalizedVector3(planetVector);
  const sunDirection = normalizedVector3(sunVector);
  const separation = Math.acos(Math.max(-1, Math.min(1,
    planetDirection.reduce((sum, value, index) => sum + value * sunDirection[index], 0)
  )));
  const planetAngularRadius = Math.asin(Math.min(0.999, Math.max(0, Number(planetRadius) || 0) / planetDistance));
  const sunAngularRadius = Math.asin(Math.min(0.999, Math.max(0, Number(sunRadius) || 0) / sunDistance));
  const fullyCoveredAt = Math.max(0, planetAngularRadius - sunAngularRadius);
  const separatedAt = planetAngularRadius + sunAngularRadius;
  const visibility = smoothstep(fullyCoveredAt, Math.max(fullyCoveredAt + 1e-6, separatedAt), separation);
  return deepFreeze({
    visibility,
    occlusion: 1 - visibility,
    separation,
    planetAngularRadius,
    sunAngularRadius
  });
}

function mixValue(left, right, amount) {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.map((value, index) => mixValue(value, right[index] ?? value, amount));
  }
  if (typeof left === "number" && typeof right === "number") {
    return left + (right - left) * amount;
  }
  return amount < 0.5 ? left : right;
}

function mixState(left, right, amount, path = "") {
  if (Array.isArray(left) && Array.isArray(right)) return mixValue(left, right, amount);
  if (left && right && typeof left === "object" && typeof right === "object") {
    return Object.fromEntries(Object.keys({ ...left, ...right }).map((key) => [
      key,
      mixState(left[key], right[key], amount, path ? `${path}.${key}` : key)
    ]));
  }
  if (typeof left === "number" && typeof right === "number") {
    return path.toLowerCase().includes("color")
      ? mixPlanetHubMoodColor(left, right, amount)
      : mixValue(left, right, amount);
  }
  return amount < 0.5 ? left : right;
}

const EARTH_MOODS = deepFreeze({
  forge: {
    id: "forge",
    region: "Europe",
    scene: "dawn",
    space: {
      voidColor: 0x01050d,
      colorA: 0x163e58,
      colorB: 0x5b354c,
      accentColor: 0xffc875,
      focus: 0.72
    },
    hero: {
      normal: [-0.045, 0.91, 0.412],
      widePosition: [-0.38, -1.9, 0],
      narrowPosition: [0, -1.62, 0]
    },
    celestial: {
      exposure: 0.92,
      hemisphereSkyColor: 0x90bdd6,
      hemisphereGroundColor: 0x160913,
      hemisphere: 0.34,
      ambientColor: 0x6e8499,
      ambient: 0.026,
      keyColor: 0xffc27a,
      key: 2.62,
      keyDirection: [-0.74, 0.22, -0.64],
      fillColor: 0x78aeca,
      fill: 0.25,
      fillDirection: [0.7, 0.18, 0.56],
      rimColor: 0xffa961,
      rim: 0.42,
      rimDirection: [0.42, -0.12, -0.9]
    },
    atmosphere: {
      color: 0x66c7ff,
      hazeColor: 0xffa86e,
      strength: 0.235,
      horizonHaze: 0.58,
      cloudOpacity: 0.22,
      nightOpacity: 0.2
    },
    road: { color: 0xffc66d, idleOpacity: 0.105, activeOpacity: 0.58 },
    local: {
      keyColor: 0xffd39b,
      fillColor: 0x8ecce5,
      rimColor: 0xffb36b
    },
    // Landmark visibility is owned by the renderer's light-only facade rig.
    // Destination-local planes, rings, clouds, and flashes were removed
    // because they intersected authored geometry when the globe rotated.
    vfx: { shafts: 0, recipe: 0, aurora: 0, iceHaze: 0, storm: 0, lightning: 0, portalWash: 0 }
  },
  journey: {
    id: "journey",
    region: "Antarctica",
    scene: "polar-twilight",
    space: {
      voidColor: 0x010711,
      colorA: 0x07566a,
      colorB: 0x282457,
      accentColor: 0x82e9ff,
      focus: 0.68
    },
    hero: {
      normal: [-0.02, 0.9, 0.43543],
      widePosition: [-0.42, -2.15, 0],
      narrowPosition: [0, -1.62, 0]
    },
    celestial: {
      exposure: 0.9,
      hemisphereSkyColor: 0x79b7ce,
      hemisphereGroundColor: 0x080a1b,
      hemisphere: 0.31,
      ambientColor: 0x55718f,
      ambient: 0.024,
      keyColor: 0xc7efff,
      key: 2.22,
      keyDirection: [-0.28, 0.08, -0.956],
      fillColor: 0x6179b1,
      fill: 0.23,
      fillDirection: [0.76, 0.2, 0.58],
      rimColor: 0x9ceeff,
      rim: 0.52,
      rimDirection: [0.35, -0.18, -0.92]
    },
    atmosphere: {
      color: 0x73dfff,
      hazeColor: 0x8d9fff,
      strength: 0.255,
      horizonHaze: 0.34,
      cloudOpacity: 0.16,
      nightOpacity: 0.28
    },
    road: { color: 0x72eaff, idleOpacity: 0.095, activeOpacity: 0.62 },
    local: {
      keyColor: 0xe0f8ff,
      fillColor: 0x82dfff,
      rimColor: 0xa890ff
    },
    vfx: { shafts: 0, recipe: 0, aurora: 0, iceHaze: 0, storm: 0, lightning: 0, portalWash: 0 }
  },
  arena: {
    id: "arena",
    region: "North America",
    scene: "night-storm",
    space: {
      voidColor: 0x01030a,
      colorA: 0x121a3e,
      colorB: 0x312149,
      accentColor: 0xb887ff,
      focus: 0.64
    },
    hero: {
      normal: [0.055, 0.905, 0.4218],
      widePosition: [-0.4, -1.94, 0],
      narrowPosition: [0, -1.64, 0]
    },
    celestial: {
      exposure: 0.88,
      hemisphereSkyColor: 0x596e9c,
      hemisphereGroundColor: 0x07050f,
      hemisphere: 0.25,
      ambientColor: 0x56627e,
      ambient: 0.02,
      keyColor: 0x9db5d8,
      key: 1.82,
      keyDirection: [-0.52, 0.16, -0.84],
      fillColor: 0x4a5d91,
      fill: 0.19,
      fillDirection: [0.68, 0.14, 0.7],
      rimColor: 0xbf8aff,
      rim: 0.48,
      rimDirection: [0.44, -0.14, -0.88]
    },
    atmosphere: {
      color: 0x536fc6,
      hazeColor: 0x8b5bd2,
      strength: 0.18,
      horizonHaze: 0.18,
      cloudOpacity: 0.08,
      nightOpacity: 0.58
    },
    road: { color: 0xbd7dff, idleOpacity: 0.08, activeOpacity: 0.64 },
    local: {
      keyColor: 0xc4d5ee,
      fillColor: 0x6e8fc8,
      rimColor: 0xc08aff
    },
    vfx: { shafts: 0, recipe: 0, aurora: 0, iceHaze: 0, storm: 0, lightning: 0, portalWash: 0 }
  }
});

const MOON_MOOD = deepFreeze({
  id: "moon",
  region: "Moon",
  scene: "airless-night",
  space: {
    voidColor: 0x02050e,
    colorA: 0x263961,
    colorB: 0x36265c,
    accentColor: 0x9fc8ff,
    focus: 0.7
  },
  hero: {
    normal: [0, 0.9, 0.43589],
    widePosition: [-0.32, -1.92, 0],
    narrowPosition: [0, -1.62, 0]
  },
  celestial: {
    exposure: 0.9,
    hemisphereSkyColor: 0x536887,
    hemisphereGroundColor: 0x05050a,
    hemisphere: 0.2,
    ambientColor: 0x52627c,
    ambient: 0.016,
    keyColor: 0xffe4bd,
    key: 2.5,
    keyDirection: [-0.58, 0.36, -0.73],
    fillColor: 0x6d86a8,
    fill: 0.14,
    fillDirection: [0.72, 0.2, 0.58],
    rimColor: 0x829ddd,
    rim: 0.3,
    rimDirection: [0.42, -0.1, -0.9]
  },
  atmosphere: {
    color: 0x9fb9de,
    hazeColor: 0x9fb9de,
    strength: 0.028,
    horizonHaze: 0,
    cloudOpacity: 0,
    nightOpacity: 0
  },
  road: { color: 0x8ebcff, idleOpacity: 0.075, activeOpacity: 0.5 },
  local: {
    keyColor: 0xffe4bd,
    fillColor: 0x879fbe,
    rimColor: 0x90a8dd
  },
  vfx: { shafts: 0, recipe: 0, aurora: 0, iceHaze: 0, storm: 0, lightning: 0, portalWash: 0 }
});

export const PLANET_HUB_DESTINATION_MOODS = EARTH_MOODS;
export const PLANET_HUB_MOOD_TRANSITION_MS = 1120;
export const PLANET_HUB_REDUCED_MOOD_TRANSITION_MS = 200;
const MOOD_CACHE = new Map();

function normalizeDestination(value) {
  const destination = String(value || "").trim().toLowerCase();
  return DESTINATIONS.includes(destination) ? destination : "forge";
}

function normalizeWorld(value) {
  const world = String(value || "").trim().toLowerCase();
  return WORLDS.includes(world) ? world : "earth";
}

export function resolvePlanetHubMoodEffects({
  quality = "low",
  effectsLevel = "full",
  reducedMotion = false
} = {}) {
  const requested = EFFECT_LEVELS.includes(effectsLevel) ? effectsLevel : "full";
  const effective = requested === "off"
    ? "off"
    : requested === "reduced" || reducedMotion ? "reduced" : "full";
  const qualityScale = quality === "standard" ? 1 : 0.72;
  const effectScale = effective === "off" ? 0 : effective === "reduced" ? 0.32 : qualityScale;
  return deepFreeze({
    requested,
    effective,
    // Preserve the established runtime snapshot contract while exposing the
    // shorter internal name used by the mood resolver.
    effectiveEffects: effective,
    enabled: effective !== "off",
    animated: effective === "full",
    quality: quality === "standard" ? "standard" : "low",
    effectScale
  });
}

export function resolvePlanetHubDestinationMood(destination = "forge", {
  worldId = "earth",
  quality = "low",
  effectsLevel = "full",
  reducedMotion = false
} = {}) {
  const normalizedWorld = normalizeWorld(worldId);
  const normalizedDestination = normalizeDestination(destination);
  const cacheKey = [
    normalizedWorld,
    normalizedDestination,
    quality === "standard" ? "standard" : "low",
    EFFECT_LEVELS.includes(effectsLevel) ? effectsLevel : "full",
    reducedMotion ? "reduced-motion" : "motion"
  ].join(":");
  if (MOOD_CACHE.has(cacheKey)) return MOOD_CACHE.get(cacheKey);
  const base = normalizedWorld === "earth" ? EARTH_MOODS[normalizedDestination] : MOON_MOOD;
  const effects = resolvePlanetHubMoodEffects({ quality, effectsLevel, reducedMotion });
  const qualityLighting = quality === "standard" ? 1 : 0.94;
  const resolved = structuredClone(base);
  resolved.destination = normalizedDestination;
  resolved.worldId = normalizedWorld;
  resolved.effects = effects;
  resolved.celestial.key *= qualityLighting;
  resolved.celestial.rim *= qualityLighting;
  for (const key of Object.keys(resolved.vfx)) resolved.vfx[key] *= effects.effectScale;
  if (!effects.enabled) {
    resolved.atmosphere.horizonHaze = 0;
    resolved.atmosphere.cloudOpacity = 0;
    // Night lights are surface readability, not animated VFX. Keep a quiet
    // baseline under the Effects: Off preference so Earth does not collapse
    // into an unreadable black disc while preserving the shader's terminator.
    resolved.atmosphere.nightOpacity = normalizedWorld === "earth" ? 0.14 : 0;
  }
  const frozen = deepFreeze(resolved);
  MOOD_CACHE.set(cacheKey, frozen);
  return frozen;
}

export function resolvePlanetHubHeroFraming(destination = "forge", {
  worldId = "earth",
  width = 1280,
  height = 720,
  aspect = Number(width) / Math.max(1, Number(height) || 1)
} = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const normalizedDestination = normalizeDestination(destination);
  const mood = normalizeWorld(worldId) === "earth" ? EARTH_MOODS[normalizedDestination] : MOON_MOOD;
  const compactPortrait = safeWidth <= 600 && safeHeight <= 700;
  const shortLandscape = safeWidth > safeHeight && safeWidth <= 900 && safeHeight <= 500;
  const wide = Math.max(0.01, Number(aspect) || 1) >= 1.55;
  if (normalizedDestination === "journey" && shortLandscape) {
    return deepFreeze({
      key: "journey-short-landscape",
      normal: [0, 0.9, 0.43589],
      position: [-0.5, -2.04, 0]
    });
  }
  if (normalizedDestination === "journey" && compactPortrait) {
    return deepFreeze({
      key: "journey-compact-portrait",
      normal: [0, 0.94, 0.341174],
      position: mood.hero.narrowPosition
    });
  }
  return deepFreeze({
    key: `${normalizedDestination}-${wide ? "wide" : "narrow"}`,
    normal: mood.hero.normal,
    position: wide ? mood.hero.widePosition : mood.hero.narrowPosition
  });
}

export function calculatePlanetHubMoodTransitionPhases(progress = 0, { reducedMotion = false } = {}) {
  const value = clamp(progress);
  if (reducedMotion) {
    return deepFreeze({
      progress: value,
      release: 1 - value,
      rotation: value,
      celestial: value,
      settle: value,
      reveal: value
    });
  }
  return deepFreeze({
    progress: value,
    release: 1 - smoothstep(0, 0.16, value),
    rotation: smootherstep(0.08, 0.7, value),
    celestial: smootherstep(0.15, 0.8, value),
    settle: smootherstep(0.52, 0.92, value),
    reveal: smootherstep(0.7, 1, value)
  });
}

export function createPlanetHubMoodTransition({
  from,
  to,
  startedAt = 0,
  durationMs = null,
  reducedMotion = false
} = {}) {
  if (!from || !to) throw new TypeError("A mood transition requires from and to states.");
  const duration = durationMs == null
    ? reducedMotion ? PLANET_HUB_REDUCED_MOOD_TRANSITION_MS : PLANET_HUB_MOOD_TRANSITION_MS
    : Math.max(1, Number(durationMs) || 1);
  return deepFreeze({
    from,
    to,
    startedAt: Number(startedAt) || 0,
    durationMs: duration,
    reducedMotion: Boolean(reducedMotion)
  });
}

export function samplePlanetHubMoodTransition(transition, nowMs = 0) {
  if (!transition) return null;
  const progress = clamp(((Number(nowMs) || 0) - transition.startedAt) / transition.durationMs);
  const phases = calculatePlanetHubMoodTransitionPhases(progress, {
    reducedMotion: transition.reducedMotion
  });
  return deepFreeze({
    state: mixState(transition.from, transition.to, phases.celestial),
    phases,
    progress,
    complete: progress >= 1
  });
}

export function retargetPlanetHubMoodTransition({
  transition = null,
  current = null,
  to,
  nowMs = 0,
  durationMs = null,
  reducedMotion = false
} = {}) {
  const sampled = transition ? samplePlanetHubMoodTransition(transition, nowMs) : null;
  return createPlanetHubMoodTransition({
    from: sampled?.state || current || to,
    to,
    startedAt: nowMs,
    durationMs,
    reducedMotion
  });
}

export function calculatePlanetHubRoadMood({
  roadFrom = "forge",
  roadTo = "journey",
  activeDestination = "forge",
  frontFacing = 1,
  elapsedMs = 0,
  mood = null,
  reducedMotion = false,
  effectsLevel = "full"
} = {}) {
  const active = roadFrom === activeDestination || roadTo === activeDestination;
  const profile = mood || resolvePlanetHubDestinationMood(activeDestination, {
    effectsLevel,
    reducedMotion
  });
  const facing = smoothstep(-0.25, 0.38, frontFacing);
  const pulse = reducedMotion || profile.effects.effective !== "full"
    ? 0.58
    : 0.5 + Math.sin(Math.max(0, Number(elapsedMs) || 0) * 0.0034) * 0.5;
  const opacity = facing * (active
    ? profile.road.idleOpacity + (profile.road.activeOpacity - profile.road.idleOpacity) * (0.42 + pulse * 0.58)
    : profile.road.idleOpacity * 0.58);
  const baseOpacity = active
    ? profile.road.idleOpacity + (profile.road.activeOpacity - profile.road.idleOpacity) * 0.42
    : profile.road.idleOpacity * 0.58;
  return deepFreeze({
    active,
    color: profile.road.color,
    opacity: profile.effects.enabled ? opacity : 0,
    baseOpacity: profile.effects.enabled ? baseOpacity : 0,
    pulse,
    frontFacing: facing
  });
}

export function createPlanetHubRoadMaterial(THREE, { color = 0x73dcff } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.1 },
      uActive: { value: 0 },
      uTime: { value: 0 },
      uMotion: { value: 1 }
    },
    vertexShader: `varying vec2 vRoadUv; varying float vFacing; void main(){ vRoadUv=uv; vec3 worldOrigin=(modelMatrix*vec4(0.,0.,0.,1.)).xyz; vec3 radial=normalize((modelMatrix*vec4(normalize(position),0.)).xyz); vec3 viewDirection=normalize(cameraPosition-worldOrigin); vFacing=dot(radial,viewDirection); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity,uActive,uTime,uMotion; varying vec2 vRoadUv; varying float vFacing; void main(){ float visibleSide=smoothstep(-.18,.24,vFacing); float coordinate=fract(vRoadUv.x-uTime*.075*uMotion); float travelling=pow(max(0.,1.-abs(coordinate-.5)*2.),14.); float pulse=mix(1.,.62+travelling*2.1,uActive); float edge=smoothstep(0.,.12,vRoadUv.y)*smoothstep(0.,.12,1.-vRoadUv.y); float alpha=uOpacity*visibleSide*pulse*edge; if(alpha<.002) discard; gl_FragColor=vec4(uColor,alpha); }`,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}

export function updatePlanetHubRoadMaterial(material, state, {
  elapsedMs = 0,
  reducedMotion = false
} = {}) {
  const uniforms = material?.uniforms;
  if (!uniforms || !state) return false;
  uniforms.uColor.value.setHex?.(state.color);
  uniforms.uOpacity.value = Math.max(0, Number(state.baseOpacity) || 0);
  uniforms.uActive.value = state.active ? 1 : 0;
  uniforms.uTime.value = Math.max(0, Number(elapsedMs) || 0) * 0.001;
  uniforms.uMotion.value = reducedMotion ? 0 : 1;
  return true;
}

export function calculatePlanetHubLightningEnvelope({
  elapsedMs = 0,
  seed = 73,
  reducedMotion = false,
  effectsLevel = "full"
} = {}) {
  // Compatibility export for callers from earlier hub releases. Structure-
  // local lightning and its global exposure flash are intentionally retired;
  // returning zero makes an older renderer harmless during a rolling update.
  void elapsedMs;
  void seed;
  void reducedMotion;
  void effectsLevel;
  return 0;
}

export function resolvePlanetHubSurfaceHooks(manifest, worldId = "earth", quality = "low") {
  const world = normalizeWorld(worldId);
  const preferredQuality = quality === "standard" ? "standard" : "low";
  const fallbackQuality = preferredQuality === "standard" ? "low" : "standard";
  const qualities = [preferredQuality, fallbackQuality];
  const assetUrl = (candidate) => (
    typeof candidate === "string" ? candidate : candidate?.url || null
  );
  const firstUrl = (sources, aliases) => {
    for (const source of sources) {
      for (const alias of aliases) {
        const url = assetUrl(source?.[alias]);
        if (url) return url;
      }
    }
    return null;
  };
  const worldSources = qualities.flatMap((tierQuality) => {
    const optionalWorld = manifest?.optionalDetails?.tiers?.[tierQuality]?.[world];
    const legacyTier = manifest?.worlds?.[world]?.tiers?.[tierQuality];
    return [
      optionalWorld,
      legacyTier?.surface,
      legacyTier?.planet?.surface,
      legacyTier?.planet
    ];
  });
  const sunSources = qualities.flatMap((tierQuality) => {
    const optionalSun = manifest?.optionalDetails?.tiers?.[tierQuality]?.sun;
    const legacySun = manifest?.shared?.tiers?.[tierQuality]?.sun;
    return [optionalSun, legacySun?.surface, legacySun];
  });
  return deepFreeze({
    clouds: firstUrl(worldSources, ["clouds", "cloudMap"]),
    night: firstUrl(worldSources, ["night", "nightMap"]),
    roughness: firstUrl(worldSources, ["roughness", "roughnessMap"]),
    normal: firstUrl(worldSources, ["normal", "normalMap"]),
    sunEmissive: firstUrl(sunSources, ["emissive", "emissiveMap"])
  });
}

/**
 * Compatibility controller for the retired destination-local VFX layer.
 *
 * Keep the public surface so renderer/runtime bundles from adjacent releases
 * can continue to call `setEffects`, `update`, and `dispose`. No meshes,
 * materials, geometries, lights, or render-loop work are created here. The
 * portal surface, rocket plume, roads, and landmark contact shadows live in
 * their own renderer systems and are deliberately unaffected.
 */
export function createPlanetHubDestinationVfx(THREE, {
  siteRoots,
  worldId = "earth",
  quality = "low",
  effectsLevel = "full",
  reducedMotion = false,
  seed = 73
} = {}) {
  const records = new Map();
  let profile = resolvePlanetHubMoodEffects({ quality, effectsLevel, reducedMotion });
  let disposed = false;
  // Keep currently accepted parameters explicit for API/documentation parity.
  void THREE;
  void siteRoots;
  void worldId;
  void seed;

  function setEffects(next = effectsLevel, options = {}) {
    effectsLevel = EFFECT_LEVELS.includes(next) ? next : "full";
    reducedMotion = Boolean(options.reducedMotion ?? reducedMotion);
    profile = resolvePlanetHubMoodEffects({ quality, effectsLevel, reducedMotion });
    return profile;
  }

  function update() {
    return false;
  }

  function dispose() {
    if (disposed) return false;
    disposed = true;
    records.clear();
    return true;
  }

  return Object.freeze({
    records,
    get profile() {
      return profile;
    },
    setEffects,
    update,
    dispose,
    destroy: dispose
  });
}
