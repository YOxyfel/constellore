import {
  PLANET_HUB_MOOD_TRANSITION_MS,
  resolvePlanetHubDestinationMood,
  resolvePlanetHubMoodEffects
} from "./planet-hub-moods.mjs?v=5.0.0-beta.4";
import {
  PLANET_HUB_VIEW_BANDS,
  PLANET_HUB_ZOOM_ANCHOR_PROGRESS,
  resolvePlanetHubRepresentedDistance
} from "./planet-hub-zoom.mjs?v=5.0.0-beta.4";

const DESTINATIONS = ["forge", "journey", "arena"];
const WORLDS = ["earth", "moon"];
const MOOD_SECONDS = PLANET_HUB_MOOD_TRANSITION_MS / 1000;
const TIERS = {
  low: { noise: 128, segments: [32, 20], stars: 1500, constellations: 18 },
  standard: { noise: 256, segments: [48, 28], stars: 3200, constellations: 28 }
};
// The camera-centred sky must remain behind every body in the compressed solar
// atlas even at maximum zoom. A small 30-unit dome allowed star points to sit
// in front of distant planets once true system-scale navigation was enabled.
export const PLANET_HUB_SPACE_SKY_RADIUS = 440;
export const PLANET_HUB_GRID_EDGE_FADE_START = 0.72;
export const PLANET_HUB_GRID_CARRIER_COUNT = 3;
const PLANET_HUB_GRID_EDGE_ON_START = 0.025;
const PLANET_HUB_GRID_EDGE_ON_END = 0.14;
const PLANET_HUB_GRID_TARGET_CELL_PX = 26;
const PLANET_HUB_AU_METERS = 149_597_870_700;
const PLANET_HUB_LIGHT_YEAR_METERS = 9_460_730_472_580_800;
const PLANET_HUB_PARSEC_METERS = 30_856_775_814_913_672;
const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

const smoothstep01 = (value) => {
  const amount = clamp(value);
  return amount * amount * (3 - 2 * amount);
};

const unitVector = (value, fallback = [0, 0, 1]) => {
  const length = Math.hypot(...value);
  return (length > 1e-8 ? value : fallback).map((coordinate) => coordinate / (length || 1));
};
const dotVector = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);
const slerpVector = (from, to, amount) => {
  const progress = clamp(amount);
  const dot = clamp(dotVector(from, to), -1, 1);
  if (dot > 0.9995) return unitVector(from.map((value, index) => value + (to[index] - value) * progress), from);
  if (dot < -0.9995) {
    const reference = Math.abs(from[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0];
    const tangent = unitVector([
      from[1] * reference[2] - from[2] * reference[1],
      from[2] * reference[0] - from[0] * reference[2],
      from[0] * reference[1] - from[1] * reference[0]
    ]);
    return from.map((value, index) => value * Math.cos(Math.PI * progress)
      + tangent[index] * Math.sin(Math.PI * progress));
  }
  const angle = Math.acos(dot);
  const sine = Math.sin(angle);
  return from.map((value, index) => (
    value * Math.sin((1 - progress) * angle) / sine
      + to[index] * Math.sin(progress * angle) / sine
  ));
};

/**
 * Move between astronomical pivots without approaching the destination. The
 * inputs share one arbitrary rebase scale, so the projected path is invariant.
 */
export function calculatePlanetHubPivotHandoffOrbit(
  state,
  fromPivot,
  toPivot,
  radius,
  fromRadius,
  handoffRadius,
  toRadius
) {
  const sine = Math.sin(state.polar);
  const outward = [sine * Math.sin(state.azimuth), Math.cos(state.polar), sine * Math.cos(state.azimuth)];
  const axis = toPivot.map((value, index) => value - fromPivot[index]);
  const axisLength = Math.max(1e-8, Math.hypot(...axis));
  const axisDirection = axis.map((value) => value / axisLength);
  const projection = dotVector(outward, axisDirection);
  let perpendicular = outward.map((value, index) => value - axisDirection[index] * projection);
  if (Math.hypot(...perpendicular) < 1e-8) perpendicular = [
    axisDirection[1] * state.up[2] - axisDirection[2] * state.up[1],
    axisDirection[2] * state.up[0] - axisDirection[0] * state.up[2],
    axisDirection[0] * state.up[1] - axisDirection[1] * state.up[0]
  ];
  perpendicular = unitVector(perpendicular);
  const releaseRadius = Math.hypot(...outward.map((value, index) => value * fromRadius - axis[index]));
  const releaseCosine = -(releaseRadius - handoffRadius) / axisLength;
  const releaseDirection = axisDirection.map((value, index) => value * releaseCosine
    + perpendicular[index] * Math.sqrt(Math.max(0, 1 - releaseCosine ** 2)));
  let target = toPivot, direction;
  if (radius >= releaseRadius) {
    const release = Math.log(radius / releaseRadius) / Math.log(toRadius / releaseRadius);
    direction = slerpVector(releaseDirection, outward, smoothstep01(release));
  } else {
    const x = Math.max(0, (radius - handoffRadius) / (releaseRadius - handoffRadius));
    const targetMix = x * x * (2 - x);
    target = fromPivot.map((value, index) => value + axis[index] * targetMix);
    const targetDistance = axisLength * (1 - targetMix);
    const desiredDistance = Math.max(releaseRadius, radius);
    const cosine = clamp((radius ** 2 + targetDistance ** 2 - desiredDistance ** 2)
      / (2 * radius * targetDistance), -1, 1);
    direction = axisDirection.map((value, index) => value * cosine
      + perpendicular[index] * Math.sqrt(Math.max(0, 1 - cosine ** 2)));
  }
  return {
    azimuth: Math.atan2(direction[0], direction[2]),
    polar: Math.acos(clamp(direction[1], -1, 1)),
    radius,
    target,
    up: state.up,
    velocity: state.velocity
  };
}

export function resolvePlanetHubGridEdgeOpacity({
  normalizedRadius = 0,
  fadeStart = PLANET_HUB_GRID_EDGE_FADE_START
} = {}) {
  const radius = Math.max(0, Number(normalizedRadius) || 0);
  const start = clamp(fadeStart, 0, 0.999);
  if (radius <= start) return 1;
  if (radius >= 1) return 0;
  return 1 - smoothstep01((radius - start) / (1 - start));
}

/**
 * Three adjacent powers of ten form one continuously crossfaded grid family.
 * Quadratic B-spline weights keep the same physical decades at identical
 * opacity on either side of an integer log boundary, so rebasing a carrier is
 * invisible instead of producing a density pop.
 */
export function resolvePlanetHubGridLod(worldCellSize = 1) {
  const cellSize = Math.max(1e-12, Number(worldCellSize) || 1);
  const logCellSize = Math.log10(cellSize);
  const baseDecade = Math.floor(logCellSize + 1e-12);
  const fraction = clamp(logCellSize - baseDecade);
  const weights = [
    0.5 * (1 - fraction) ** 2,
    0.5 + fraction - fraction ** 2,
    0.5 * fraction ** 2
  ];
  return Object.freeze({
    logCellSize,
    baseDecade,
    fraction,
    layers: Object.freeze(weights.map((weight, index) => Object.freeze({
      decade: baseDecade + index - 1,
      cellSize: 10 ** (baseDecade + index - 1),
      weight
    })))
  });
}

/**
 * The native chart is a one-sided world plane. Looking almost parallel to it
 * fades it before perspective stretches the texture; crossing underneath
 * retires it completely.
 */
export function resolvePlanetHubGridPlaneOpacity({
  cameraSide = 1,
  viewNormalDot = -1,
  edgeOnStart = PLANET_HUB_GRID_EDGE_ON_START,
  edgeOnEnd = PLANET_HUB_GRID_EDGE_ON_END
} = {}) {
  if (!(Number(cameraSide) > 0)) return 0;
  const towardPlane = Math.max(0, -(Number(viewNormalDot) || 0));
  const start = Math.max(0, Number(edgeOnStart) || 0);
  const end = Math.max(start + 1e-6, Number(edgeOnEnd) || PLANET_HUB_GRID_EDGE_ON_END);
  return smoothstep01((towardPlane - start) / (end - start));
}

function resolvePlanetHubMeterUnit(radiusMeters) {
  const meters = Math.max(1e-12, Number(radiusMeters) || 1);
  const candidates = meters >= PLANET_HUB_PARSEC_METERS * 1000
    ? [PLANET_HUB_PARSEC_METERS * 1000, "kpc"]
    : meters >= PLANET_HUB_PARSEC_METERS
      ? [PLANET_HUB_PARSEC_METERS, "pc"]
      : meters >= PLANET_HUB_LIGHT_YEAR_METERS
        ? [PLANET_HUB_LIGHT_YEAR_METERS, "ly"]
        : meters >= PLANET_HUB_AU_METERS
          ? [PLANET_HUB_AU_METERS, "AU"]
          : meters >= 1000 ? [1000, "km"] : [1, "m"];
  const value = meters / candidates[0];
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return Object.freeze({
    unitMeters: candidates[0],
    unit: candidates[1],
    value,
    label: `${value.toFixed(decimals).replace(/[.]?0+$/, "")} ${candidates[1]}`
  });
}

/**
 * Meter rings are deliberately independent from grid LOD. Two adjacent
 * physical decades crossfade with triangular log-space weights and retain
 * explicit unit metadata for labels and diagnostics.
 */
export function resolvePlanetHubPlaneMeters({ targetRadiusMeters = 1, metersPerUnit = 1 } = {}) {
  const target = Math.max(1e-12, Number(targetRadiusMeters) || 1);
  const scale = Math.max(1e-12, Number(metersPerUnit) || 1);
  const preferredUnit = resolvePlanetHubMeterUnit(target);
  const logUnitRadius = Math.log10(target / preferredUnit.unitMeters);
  const unitDecade = Math.floor(logUnitRadius + 1e-12);
  const baseDecade = Math.log10(preferredUnit.unitMeters) + unitDecade;
  const fraction = clamp(logUnitRadius - unitDecade);
  const weights = [1 - fraction, fraction];
  return Object.freeze({
    logRadiusMeters: Math.log10(target),
    baseDecade,
    fraction,
    meters: Object.freeze(weights.map((weight, index) => {
      const value = 10 ** (unitDecade + index);
      const decade = baseDecade + index;
      const radiusMeters = preferredUnit.unitMeters * value;
      return Object.freeze({
        decade,
        radiusMeters,
        radiusWorld: radiusMeters / scale,
        weight,
        unitMeters: preferredUnit.unitMeters,
        unit: preferredUnit.unit,
        value,
        label: `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ${preferredUnit.unit}`
      });
    }))
  });
}

// The release Three.js build intentionally omits CanvasTexture and Sprite.
// Rasterize the small meter vocabulary into ordinary RGBA DataTextures so the
// labels use the same trimmed-vendor path as the celestial atlas.
const PLANET_HUB_METER_GLYPHS = Object.freeze({
  A:"01110100011000111111100011000110001",C:"01111100001000010000100001000001111",
  K:"10001100101010011000101001001010001",L:"10000100001000010000100001000011111",
  M:"10001110111010110101100011000110001",P:"11110100011000111110100001000010000",
  U:"10001100011000110001100011000101110",Y:"10001100010101000100001000010000100",
  0:"01110100011001110101110011000101110",1:"00100011000010000100001000010001110",
  2:"01110100010000100010001000100011111",3:"11110000010000101110000010000111110",
  4:"00010001100101010010111110001000010",5:"11111100001000011110000010000111110",
  6:"01110100001000011110100011000101110",7:"11111000010001000100010000100001000",
  8:"01110100011000101110100011000101110",9:"01110100011000101111000010000101110",
  ".":"00000000000000000000000000000000100"
});

function createPlanetHubMeterLabelBitmap(text = "") {
  const value = String(text).toUpperCase();
  try {
    const canvas = globalThis.document?.createElement?.("canvas"), context = canvas?.getContext?.("2d");
    if (context) {
      const font = '600 20px "Segoe UI",Arial,sans-serif', spacing = 1.25, padding = 6;
      context.font = font;
      const widths = [...value].map((character) => context.measureText(character).width);
      canvas.width = Math.ceil(widths.reduce((sum, characterWidth) => sum + characterWidth, 0)
        + Math.max(0, widths.length - 1) * spacing + padding * 2);
      canvas.height = 34;
      const drawing = canvas.getContext("2d");
      drawing.font = font;
      drawing.textAlign = "left";
      drawing.textBaseline = "middle";
      drawing.fillStyle = "#fff";
      let x = padding;
      for (let index = 0; index < value.length; index += 1) {
        drawing.fillText(value[index], x, canvas.height * 0.52);
        x += widths[index] + spacing;
      }
      const source = drawing.getImageData(0, 0, canvas.width, canvas.height).data;
      const data = new Uint8Array(source.length), stride = canvas.width * 4;
      for (let y = 0; y < canvas.height; y += 1) {
        data.set(source.subarray(y * stride, (y + 1) * stride), (canvas.height - 1 - y) * stride);
      }
      for (let offset = 0; offset < data.length; offset += 4) {
        data[offset] = data[offset + 1] = data[offset + 2] = 255;
      }
      return Object.freeze({ data, width: canvas.width, height: canvas.height, source: "canvas" });
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
    const glyph = PLANET_HUB_METER_GLYPHS[character];
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

export function resolvePlanetHubSpaceViewDepth({ progress = 0, band = null, gridOwner = null } = {}) {
  const amount = clamp(progress);
  const cosmic = clamp((amount - 0.38) / 0.62);
  let resolvedBand = PLANET_HUB_VIEW_BANDS.includes(band) ? band : "universe";
  if (!PLANET_HUB_VIEW_BANDS.includes(band)) {
    for (let index = 1; index < PLANET_HUB_VIEW_BANDS.length; index += 1) {
      const boundary = (PLANET_HUB_ZOOM_ANCHOR_PROGRESS[PLANET_HUB_VIEW_BANDS[index - 1]]
        + PLANET_HUB_ZOOM_ANCHOR_PROGRESS[PLANET_HUB_VIEW_BANDS[index]]) * 0.5;
      if (amount < boundary) { resolvedBand = PLANET_HUB_VIEW_BANDS[index - 1]; break; }
    }
  }
  return Object.freeze({
    progress: amount,
    band: resolvedBand,
    gridOwner: gridOwner || null,
    // The local Home can retain a faint cinematic dust wash; astronomical
    // navigation resolves toward a clean black chart like a real planetarium,
    // rather than magnifying the old painted panorama into pixel blocks.
    domeIntensity: 1 - amount * 0.48,
    starOpacity: 1 + amount * 0.72,
    constellationOpacity: resolvedBand === "planet" ? 0.5
      : resolvedBand === "orbit" ? 0.72
        : resolvedBand === "system" ? 0.78
          : resolvedBand === "galaxy" ? 0.66 : 0.58,
    chartOpacity: resolvedBand === "planet" ? 0
      : resolvedBand === "orbit" ? 0.3 + cosmic * 0.04
        : resolvedBand === "system" ? 0.34
          : resolvedBand === "galaxy" ? 0.24 : 0.18,
    authoredOpacity: 1 - clamp((amount - 0.2) / 0.38)
  });
}

// These are ordered from the edge of observable space toward the camera. The
// small centre offsets and deliberately different angular rates are what make
// the five generated panoramas read as separate distances instead of one busy
// wallpaper. The entire group still follows the camera, so the flight sequence
// can never reach or clip through the sky geometry.
export const PLANET_HUB_SPACE_LAYER_CONFIG = Object.freeze([
  // The authored plates now contribute only broad colour and dust. Point-like
  // detail is rendered as true GPU stars below, so camera zoom can never turn
  // source pixels into the large square artefacts seen in the previous sky.
  Object.freeze({ id: "cosmic-horizon", radius: 8.62, opacity: 0.045, drift: 0.000018, offset: Object.freeze([0.008, 0, -0.004]), rotationY: 0.18, threshold: 0.028, softness: 0.085 }),
  Object.freeze({ id: "deep-stars", radius: 8.38, opacity: 0.008, drift: 0.000025, offset: Object.freeze([-0.018, 0.004, 0.011]), rotationY: 1.41, threshold: 0.060, softness: 0.120 }),
  Object.freeze({ id: "deep-sky", radius: 8.14, opacity: 0.052, drift: -0.000035, offset: Object.freeze([0.035, -0.008, -0.016]), rotationY: 2.72, threshold: 0.028, softness: 0.095 }),
  Object.freeze({ id: "nebula-filaments", radius: 7.90, opacity: 0.035, drift: 0.000045, offset: Object.freeze([-0.064, 0.012, 0.028]), rotationY: 4.08, threshold: 0.045, softness: 0.105 }),
  Object.freeze({ id: "near-stars", radius: 7.66, opacity: 0.006, drift: -0.000055, offset: Object.freeze([0.105, -0.018, -0.046]), rotationY: 5.37, threshold: 0.070, softness: 0.135 })
]);

export function resolvePlanetHubSpaceLayerUrl(record, baseUrl = globalThis.location?.href || "http://localhost/") {
  const value = typeof record === "string" ? record : record?.url;
  if (!value) return "";
  try { return new URL(value, baseUrl).href; } catch { return String(value); }
}

function random(seed) {
  let state = seed >>> 0;
  return () => ((state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 4294967296);
}

export function createPlanetHubStarFieldData({ count = 720, radius = 8.34, seed = 0x51a7c05 } = {}) {
  const total = Math.max(32, Math.floor(Number(count) || 720));
  const next = random(seed);
  const positions = new Float32Array(total * 3);
  const brightness = new Float32Array(total);
  const temperature = new Float32Array(total);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const phase = next() * Math.PI * 2;
  for (let index = 0; index < total; index += 1) {
    const y = 1 - ((index + 0.5) / total) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = phase + index * goldenAngle + (next() - 0.5) * 0.11;
    const distance = radius * (0.985 + next() * 0.03);
    positions[index * 3] = Math.cos(angle) * ring * distance;
    positions[index * 3 + 1] = y * distance;
    positions[index * 3 + 2] = Math.sin(angle) * ring * distance;
    const rare = next();
    brightness[index] = rare > 0.975 ? 1 : 0.34 + Math.pow(next(), 3) * 0.5;
    temperature[index] = next();
  }
  return Object.freeze({ positions, brightness, temperature, count: total, radius });
}

export function createPlanetHubConstellationData({ groups = 7, radius = 8.18, seed = 0xc057e11 } = {}) {
  const totalGroups = Math.max(3, Math.floor(Number(groups) || 7));
  const next = random(seed);
  const positions = [];
  for (let group = 0; group < totalGroups; group += 1) {
    const longitude = ((group + 0.34) / totalGroups) * Math.PI * 2 + (next() - 0.5) * 0.18;
    const latitude = -0.66 + (group % 4) * 0.42 + (next() - 0.5) * 0.12;
    const center = [
      Math.cos(latitude) * Math.cos(longitude),
      Math.sin(latitude),
      Math.cos(latitude) * Math.sin(longitude)
    ];
    const east = [-Math.sin(longitude), 0, Math.cos(longitude)];
    const north = [
      -Math.sin(latitude) * Math.cos(longitude),
      Math.cos(latitude),
      -Math.sin(latitude) * Math.sin(longitude)
    ];
    const points = [];
    const pointCount = 4 + (group % 4);
    for (let point = 0; point < pointCount; point += 1) {
      const u = (point - (pointCount - 1) / 2) * 0.055;
      const v = Math.sin(point * 1.67 + group * 0.71) * 0.045 + (next() - 0.5) * 0.018;
      const vector = [
        center[0] + east[0] * u + north[0] * v,
        center[1] + east[1] * u + north[1] * v,
        center[2] + east[2] * u + north[2] * v
      ];
      const length = Math.hypot(...vector) || 1;
      points.push(vector.map((value) => value / length * radius));
    }
    for (let point = 1; point < points.length; point += 1) positions.push(...points[point - 1], ...points[point]);
  }
  return Object.freeze({ positions: new Float32Array(positions), segments: positions.length / 6, groups: totalGroups, radius });
}

function noiseData(size, seed) {
  const data = new Uint8Array(size * size * 4), next = random(seed);
  for (let index = 0; index < data.length; index += 1) data[index] = index % 4 === 3 ? 255 : next() * 255;
  return data;
}

function mixHex(left, right, amount = 0.42) {
  const channel = (shift) => Math.round(((left >> shift) & 255) * (1 - amount) + ((right >> shift) & 255) * amount);
  return channel(16) << 16 | channel(8) << 8 | channel(0);
}

function palette(worldId, destination, options = {}) {
  const mood = resolvePlanetHubDestinationMood(destination, {
    worldId,
    quality: options.quality,
    effectsLevel: options.effectsLevel,
    reducedMotion: options.reducedMotion
  });
  return [
    mood.space.voidColor,
    mood.space.colorA,
    mood.space.colorB,
    mood.space.accentColor
  ];
}

const DOME_VERTEX = `varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const ART_VERTEX = DOME_VERTEX;
const STAR_VERTEX = `attribute float aBrightness;attribute float aTemperature;uniform float uPointScale;uniform float uTime;uniform float uMotion;varying float vBrightness;varying float vTemperature;void main(){vBrightness=aBrightness;vTemperature=aTemperature;vec4 mvPosition=modelViewMatrix*vec4(position,1.);float shimmer=1.+sin(uTime*.52+aTemperature*23.7)*.08*uMotion;gl_PointSize=uPointScale*mix(.72,1.58,aBrightness)*shimmer;gl_Position=projectionMatrix*mvPosition;}`;
const STAR_FRAGMENT = `uniform vec3 uCool;uniform vec3 uWarm;uniform float uOpacity;varying float vBrightness;varying float vTemperature;void main(){vec2 point=gl_PointCoord-vec2(.5);float distanceToCenter=length(point);if(distanceToCenter>.5)discard;float core=smoothstep(.5,.035,distanceToCenter);float halo=smoothstep(.5,.18,distanceToCenter)*.32;vec3 color=mix(uWarm,uCool,vTemperature);float alpha=(core+halo)*uOpacity*mix(.5,1.,vBrightness);gl_FragColor=vec4(color*mix(.78,1.35,vBrightness),alpha);}`;

// The five authored panoramas are deliberately composited in one fragment
// pass. Besides removing four full-screen draws while the planet is moving,
// the luminance gate removes the dim 8x8/16x16 WebP residue that otherwise
// becomes visible as grey squares after additive blending.
function authoredFragment() {
  return `uniform sampler2D uLayer0,uLayer1,uLayer2,uLayer3,uLayer4;uniform vec2 uShift0,uShift1,uShift2,uShift3,uShift4;uniform float uOpacity0,uOpacity1,uOpacity2,uOpacity3,uOpacity4,uDeepStarRepeat;varying vec3 vDir;const float TAU=6.28318530718;vec2 skyUv(vec3 direction,vec2 shift){vec3 d=normalize(direction);return vec2(fract(atan(d.z,d.x)/TAU+.5+shift.x),clamp(asin(clamp(d.y,-1.,1.))/3.14159265359+.5+shift.y,.001,.999));}vec3 cleanPlate(sampler2D plate,vec2 uv,float threshold,float softness){vec3 sampleColor=texture2D(plate,uv).rgb;float luminance=dot(sampleColor,vec3(.2126,.7152,.0722));float signal=smoothstep(threshold,threshold+softness,luminance);vec3 blackFloor=max(sampleColor-vec3(threshold*.42),vec3(0.));return blackFloor*signal;}void main(){vec3 d=normalize(vDir);vec2 deepStarUv=fract(skyUv(d,uShift1)*uDeepStarRepeat);vec3 color=cleanPlate(uLayer0,skyUv(d,uShift0),.018,.045)*uOpacity0+cleanPlate(uLayer1,deepStarUv,.032,.075)*uOpacity1+cleanPlate(uLayer2,skyUv(d,uShift2),.014,.055)*uOpacity2+cleanPlate(uLayer3,skyUv(d,uShift3),.024,.065)*uOpacity3+cleanPlate(uLayer4,skyUv(d,uShift4),.022,.070)*uOpacity4;if(dot(color,vec3(.2126,.7152,.0722))<.00003)discard;gl_FragColor=vec4(color,1.);}`;
}

function domeFragment() {
  // Sample the 2D noise and analytic stars through three direction-space
  // planes. The former equirectangular lookup collapsed longitude near the
  // sphere poles, turning an otherwise subtle cloud field into conspicuous
  // radial fan streaks whenever the flight camera looked along that axis.
  return `uniform sampler2D uNoise;uniform vec3 uVoid,uA,uB,uAccent;uniform float uTime,uMotion,uIntensity,uFocus,uArtMix;varying vec3 vDir;vec4 directionalNoise(vec3 p,vec3 weight,float scale,vec2 drift){vec4 nx=texture2D(uNoise,p.yz*scale+drift+vec2(.17,.31));vec4 ny=texture2D(uNoise,p.xz*scale-drift*.71+vec2(.43,.11));vec4 nz=texture2D(uNoise,p.xy*scale+drift*.47+vec2(.07,.59));return nx*weight.x+ny*weight.y+nz*weight.z;}void main(){vec3 d=normalize(vDir),weight=pow(abs(d),vec3(4.));weight/=max(dot(weight,vec3(1.)),.0001);vec2 drift=vec2(uTime*.0014,sin(uTime*.009)*.004)*uMotion;vec4 n1=directionalNoise(d,weight,3.2,drift),n2=directionalNoise(d,weight,7.5,-drift*.62);float cloud=smoothstep(.42,.79,n1.r*.68+n2.g*.32),ribbon=pow(max(n2.r-n1.g*.24,0.),2.),galaxy=pow(max(1.-abs(dot(d,normalize(vec3(.21,.81,.55)))),0.),4.);vec3 color=mix(mix(uVoid,uA,cloud*.54),uB,clamp(ribbon*.94+galaxy*.12,0.,.52))+uAccent*(ribbon*.035+galaxy*.012);float authoredUnderlay=mix(1.,.26,clamp(uArtMix,0.,1.));float alpha=(.075+cloud*.105+ribbon*.052+galaxy*.038)*uIntensity*uFocus*authoredUnderlay;gl_FragColor=vec4(color,min(alpha,.68));}`;
}

export function createPlanetHubSpaceEnvironment(THREE, {
  quality = "low",
  worldId = "earth",
  destination = "forge",
  mode = "overview",
  effectsLevel = "full",
  reducedMotion = false,
  camera = null,
  width = 1280,
  height = 720,
  seed = 0x51a7c05,
  spaceLayers = [],
  assetBaseUrl = globalThis.location?.href || "http://localhost/",
  textureLoader = null,
  onInvalidate = () => {}
} = {}) {
  if (!THREE?.Group || !THREE?.ShaderMaterial || !THREE?.DataTexture) throw new TypeError("Three.js is required.");
  const tier = TIERS[quality === "standard" ? "standard" : "low"];
  let currentProfile = resolvePlanetHubMoodEffects({ quality, effectsLevel, reducedMotion });
  let currentWorld = WORLDS.includes(worldId) ? worldId : "earth";
  let currentDestination = DESTINATIONS.includes(destination) ? destination : "forge";
  let currentMode = mode === "focused" ? "focused" : "overview";
  let requestedEffects = ["full", "reduced", "off"].includes(effectsLevel) ? effectsLevel : "full";
  let motionReduced = Boolean(reducedMotion);
  let viewDepth = resolvePlanetHubSpaceViewDepth();
  let elapsed = 0;
  let moodElapsed = MOOD_SECONDS;
  let currentColors = palette(currentWorld, currentDestination, { quality, effectsLevel, reducedMotion });
  let fromColors = currentColors;
  let targetColors = currentColors;
  let suspended = false;
  let disposed = false;
  let layersRequested = false;
  let layersStarted = false;
  let layerFailures = 0;
  const releasedTextures = new WeakSet();

  function releaseTexture(value) {
    if (!value || (typeof value !== "object" && typeof value !== "function") || releasedTextures.has(value)) return;
    releasedTextures.add(value);
    value.dispose?.();
  }

  const root = new THREE.Group();
  root.name = "planet-hub-space-environment";
  root.renderOrder = -1000;
  if (camera?.position) root.position.copy(camera.position);
  const worldRoot = new THREE.Group();
  worldRoot.name = "planet-hub-world-space-environment";
  const gridTextureSize = quality === "standard" ? 64 : 32;
  const gridTextureData = new Uint8Array(gridTextureSize * gridTextureSize * 4);
  for (let y = 0; y < gridTextureSize; y += 1) {
    for (let x = 0; x < gridTextureSize; x += 1) {
      const index = (y * gridTextureSize + x) * 4;
      const edgeDistance = Math.min(x, y, gridTextureSize - x, gridTextureSize - y);
      const alpha = edgeDistance <= 0 ? 255 : edgeDistance === 1 ? 112 : 0;
      gridTextureData[index] = gridTextureData[index + 1] = gridTextureData[index + 2] = 255;
      gridTextureData[index + 3] = alpha;
    }
  }
  const gridTexture = new THREE.DataTexture(
    gridTextureData,
    gridTextureSize,
    gridTextureSize,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  gridTexture.name = "planet-hub-procedural-grid-cell";
  gridTexture.wrapS = gridTexture.wrapT = THREE.RepeatWrapping;
  gridTexture.minFilter = gridTexture.magFilter = THREE.LinearFilter;
  gridTexture.generateMipmaps = false;
  gridTexture.needsUpdate = true;

  const gridGeometry = new THREE.PlaneGeometry(2, 2);
  const createGridMaterial = (color) => new THREE.ShaderMaterial({
    uniforms: {
      uGridTexture: { value: gridTexture },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0 },
      uCellSize: { value: 1 },
      uGridOrigin: { value: new THREE.Vector2() },
      uEdgeFadeStart: { value: PLANET_HUB_GRID_EDGE_FADE_START }
    },
    vertexShader: `
      varying vec2 vGridWorld;
      varying vec2 vCarrierPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vGridWorld = worldPosition.xz;
        vCarrierPosition = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uGridTexture;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uCellSize;
      uniform vec2 uGridOrigin;
      uniform float uEdgeFadeStart;
      varying vec2 vGridWorld;
      varying vec2 vCarrierPosition;
      void main() {
        vec2 gridUv = (vGridWorld - uGridOrigin) / max(uCellSize, 0.000000000001);
        float line = texture2D(uGridTexture, gridUv).a;
        float radialDistance = length(vCarrierPosition);
        float carrierFade = 1.0 - smoothstep(uEdgeFadeStart, 1.0, radialDistance);
        float alpha = uOpacity * line * carrierFade;
        if (alpha <= 0.001) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
    // All power-of-ten lines share an origin, so coarse lines are exact
    // subsets of finer ones. Additive B-spline weights therefore sum to one
    // at every shared line and cannot "breathe" as carrier decades rebase.
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const gridFamily = new THREE.Group();
  gridFamily.name = "planet-hub-logarithmic-grid-family";
  gridFamily.userData.planetHubGridFamily = true;
  const gridCarriers = Array.from({ length: PLANET_HUB_GRID_CARRIER_COUNT }, (_, index) => {
    const carrier = new THREE.Mesh(gridGeometry, createGridMaterial(0x8da0ad));
    carrier.name = `planet-hub-grid-carrier-${index}`;
    carrier.rotation.x = -Math.PI / 2;
    carrier.renderOrder = -20 + index;
    carrier.frustumCulled = false;
    carrier.userData.gridCarrierIndex = index;
    gridFamily.add(carrier);
    return carrier;
  });
  // The middle B-spline carrier never drops below 0.5 weight, preserving the
  // historic diagnostic handle while all three meshes remain one grid family.
  const worldGrid = gridCarriers[1];

  const planeMeter = new THREE.Group();
  planeMeter.name = "planet-hub-plane-meter";
  planeMeter.userData.planetHubPlaneMeter = true;
  const meterSegments = quality === "standard" ? 128 : 72;
  const meterPositions = new Float32Array(meterSegments * 6);
  for (let index = 0; index < meterSegments; index += 1) {
    const angle = index / meterSegments * Math.PI * 2;
    const nextAngle = (index + 1) / meterSegments * Math.PI * 2;
    meterPositions[index * 6] = Math.cos(angle);
    meterPositions[index * 6 + 2] = Math.sin(angle);
    meterPositions[index * 6 + 3] = Math.cos(nextAngle);
    meterPositions[index * 6 + 5] = Math.sin(nextAngle);
  }
  const meterGeometry = new THREE.BufferGeometry();
  meterGeometry.setAttribute("position", new THREE.Float32BufferAttribute(meterPositions, 3));
  const meterLabelGeometry = new THREE.PlaneGeometry(1, 1);
  const createMeterLabelTexture = (label) => {
    const bitmap = createPlanetHubMeterLabelBitmap(label);
    const value = new THREE.DataTexture(
      bitmap.data, bitmap.width, bitmap.height, THREE.RGBAFormat, THREE.UnsignedByteType
    );
    value.name = `planet-hub-plane-meter-${String(label).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-texture`;
    value.minFilter = value.magFilter = THREE.LinearFilter;
    value.generateMipmaps = false;
    value.needsUpdate = true;
    return Object.freeze({
      texture: value,
      aspect: bitmap.width / bitmap.height,
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap.source
    });
  };
  const planeMeters = Array.from({ length: 2 }, (_, index) => {
    const ringMaterial = new THREE.LineBasicMaterial({
      color: index ? 0x2e8da8 : 0x3bc6de,
      transparent: true,
      opacity: 0,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    });
    const ring = new THREE.LineSegments(meterGeometry, ringMaterial);
    ring.name = `planet-hub-plane-meter-ring-${index}`;
    ring.renderOrder = -16 + index;
    ring.frustumCulled = false;
    const labelRaster = createMeterLabelTexture("1 m");
    const labelMaterial = new THREE.MeshBasicMaterial({
      color: 0x91eaff,
      map: labelRaster.texture,
      transparent: true,
      opacity: 0,
      alphaTest: 0.025,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const label = new THREE.Mesh(meterLabelGeometry, labelMaterial);
    label.name = `planet-hub-plane-meter-label-${index}`;
    label.renderOrder = -14 + index;
    label.userData.labelAspect = labelRaster.aspect;
    label.userData.labelRaster = Object.freeze({
      width: labelRaster.width,
      height: labelRaster.height,
      source: labelRaster.source
    });
    planeMeter.add(ring, label);
    return { ring, label, decade: null, labelText: "1 m", radiusMeters: 1, unit: "m", weight: 0 };
  });
  const gridAnchor = new THREE.Vector3();
  const gridCarrierCenter = new THREE.Vector3();
  const gridCameraDirection = new THREE.Vector3(0, -1, 0);
  const gridNdcPoint = new THREE.Vector3();
  const gridRayDirection = new THREE.Vector3();
  const gridIntersection = new THREE.Vector3();
  let gridRadius = 1;
  let viewportWidth = Math.max(1, Number(width) || (Number(camera?.aspect) || 16 / 9) * 720);
  let viewportHeight = Math.max(1, Number(height) || 720);
  let gridPlaneViewOverride = null;
  let gridLod = resolvePlanetHubGridLod(1);
  let meterLod = resolvePlanetHubPlaneMeters();
  let gridPlaneOpacity = 0;
  let gridCameraSide = 0;
  let gridViewNormalDot = -1;
  let gridCarrierExtent = 1;
  let gridTransitionOpacity = 1;
  worldRoot.add(gridFamily, planeMeter);
  const data = noiseData(tier.noise, seed);
  const texture = new THREE.DataTexture(data, tier.noise, tier.noise, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const domeMaterial = new THREE.ShaderMaterial({
    uniforms: { uNoise: { value: texture }, uVoid: { value: new THREE.Color() }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uAccent: { value: new THREE.Color() }, uTime: { value: 0 }, uMotion: { value: 1 }, uIntensity: { value: 1 }, uFocus: { value: currentMode === "focused" ? 0.74 : 1 }, uArtMix: { value: 0 } },
    vertexShader: DOME_VERTEX,
    fragmentShader: domeFragment(),
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.BackSide,
    toneMapped: false
  });
  const sphereGeometry = new THREE.SphereGeometry(1, ...tier.segments);
  const dome = new THREE.Mesh(sphereGeometry, domeMaterial);
  dome.name = "planet-hub-space-dome";
  dome.scale.setScalar(PLANET_HUB_SPACE_SKY_RADIUS + 1.2);
  dome.renderOrder = -1000;
  dome.frustumCulled = false;
  root.add(dome);

  const starData = createPlanetHubStarFieldData({ count: tier.stars, radius: PLANET_HUB_SPACE_SKY_RADIUS, seed: seed ^ 0x7f4a7c15 });
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starData.positions, 3));
  starGeometry.setAttribute("aBrightness", new THREE.Float32BufferAttribute(starData.brightness, 1));
  starGeometry.setAttribute("aTemperature", new THREE.Float32BufferAttribute(starData.temperature, 1));
  const starMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uCool: { value: new THREE.Color(0xcde9ff) },
      uWarm: { value: new THREE.Color(0xffe4b8) },
      uOpacity: { value: 0.9 },
      uPointScale: { value: quality === "standard" ? 2.05 : 1.65 },
      uTime: { value: 0 },
      uMotion: { value: reducedMotion ? 0 : 1 }
    },
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const starField = new THREE.Points(starGeometry, starMaterial);
  starField.name = "planet-hub-gpu-star-field";
  starField.renderOrder = -990;
  starField.frustumCulled = false;
  root.add(starField);

  const constellationData = createPlanetHubConstellationData({ groups: tier.constellations, radius: PLANET_HUB_SPACE_SKY_RADIUS - 0.4, seed: seed ^ 0x3c6ef372 });
  const constellationGeometry = new THREE.BufferGeometry();
  constellationGeometry.setAttribute("position", new THREE.Float32BufferAttribute(constellationData.positions, 3));
  const constellationMaterial = new THREE.LineBasicMaterial({
    color: 0x4ec9ff,
    transparent: true,
    opacity: currentMode === "focused" ? 0.06 : 0.105,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const constellations = new THREE.LineSegments(constellationGeometry, constellationMaterial);
  constellations.name = "planet-hub-constellation-lines";
  constellations.renderOrder = -989;
  constellations.frustumCulled = false;
  root.add(constellations);
  const constellationPointMapSize = 32;
  const constellationPointMapData = new Uint8Array(
    constellationPointMapSize * constellationPointMapSize * 4
  );
  for (let y = 0; y < constellationPointMapSize; y += 1) {
    for (let x = 0; x < constellationPointMapSize; x += 1) {
      const radius = Math.hypot(
        (x + 0.5) / constellationPointMapSize * 2 - 1,
        (y + 0.5) / constellationPointMapSize * 2 - 1
      );
      const value = Math.round(255 * Math.pow(Math.max(0, 1 - radius), 1.5));
      const offset = (y * constellationPointMapSize + x) * 4;
      constellationPointMapData[offset] = constellationPointMapData[offset + 1]
        = constellationPointMapData[offset + 2] = value;
      constellationPointMapData[offset + 3] = 255;
    }
  }
  const constellationPointMap = new THREE.DataTexture(
    constellationPointMapData,
    constellationPointMapSize,
    constellationPointMapSize,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  constellationPointMap.name = "planet-hub-constellation-point-mask";
  constellationPointMap.minFilter = constellationPointMap.magFilter = THREE.LinearFilter;
  constellationPointMap.generateMipmaps = false;
  constellationPointMap.needsUpdate = true;
  const constellationNodeMaterial = new THREE.PointsMaterial({
    color: 0xbdeeff,
    size: quality === "standard" ? 3.4 : 2.8,
    sizeAttenuation: false,
    alphaMap: constellationPointMap,
    alphaTest: 0.008,
    opacity: 0.38,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const constellationNodes = new THREE.Points(constellationGeometry, constellationNodeMaterial);
  constellationNodes.name = "planet-hub-constellation-nodes";
  constellationNodes.renderOrder = -988;
  constellationNodes.frustumCulled = false;
  root.add(constellationNodes);

  const layerRecords = new Map((Array.isArray(spaceLayers) ? spaceLayers : [])
    .map((record) => [String(record?.id || "").trim(), record])
    .filter(([id, record]) => id && record?.url));
  const blackPixel = new Uint8Array([0, 0, 0, 255]);
  const blackTexture = new THREE.DataTexture(blackPixel, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  blackTexture.colorSpace = THREE.SRGBColorSpace;
  blackTexture.needsUpdate = true;
  const artUniforms = {};
  for (let index = 0; index < PLANET_HUB_SPACE_LAYER_CONFIG.length; index += 1) {
    artUniforms[`uLayer${index}`] = { value: blackTexture };
    artUniforms[`uShift${index}`] = { value: new THREE.Vector2() };
    artUniforms[`uOpacity${index}`] = { value: 0 };
  }
  artUniforms.uDeepStarRepeat = { value: quality === "standard" ? 4 : 6 };
  const artMaterial = new THREE.ShaderMaterial({
    uniforms: artUniforms,
    vertexShader: ART_VERTEX,
    fragmentShader: authoredFragment(),
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const artComposite = new THREE.Mesh(sphereGeometry, artMaterial);
  artComposite.name = "planet-hub-space-authored-composite";
  artComposite.scale.setScalar(PLANET_HUB_SPACE_SKY_RADIUS + 0.6);
  artComposite.renderOrder = -995;
  artComposite.frustumCulled = false;
  artComposite.visible = false;
  root.add(artComposite);

  const artLayers = PLANET_HUB_SPACE_LAYER_CONFIG.map((config, index) => {
    return {
      config,
      index,
      record: layerRecords.get(config.id) || null,
      texture: null,
      pendingTexture: null,
      ready: false,
      failed: false,
      fade: 0
    };
  });

  let activeTextureLoader = textureLoader;
  function applyArtVisuals() {
    const focus = currentMode === "focused" ? 0.78 : 1;
    const effects = currentProfile.effectiveEffects === "reduced" ? 0.76 : 1;
    let authoredMix = 0;
    for (const layer of artLayers) {
      artMaterial.uniforms[`uOpacity${layer.index}`].value = layer.ready
        ? layer.config.opacity * layer.fade * focus * effects * viewDepth.authoredOpacity
          * gridTransitionOpacity
        : 0;
      if (layer.ready) authoredMix += layer.fade;
    }
    artComposite.visible = currentProfile.enabled && gridTransitionOpacity > 0.001
      && artLayers.some((layer) => layer.ready);
    domeMaterial.uniforms.uArtMix.value = authoredMix / PLANET_HUB_SPACE_LAYER_CONFIG.length;
    // A complete authored sky owns the entire pass once its crossfade ends.
    // Partial failures keep the procedural dome as an inexpensive, seamless
    // safety net behind the one composite authored draw.
    dome.visible = currentProfile.enabled && gridTransitionOpacity > 0.001
      && (artLayers.some((layer) => !layer.ready) || authoredMix < artLayers.length);
  }
  function configuredTextureLoader() {
    if (activeTextureLoader) return activeTextureLoader;
    // Three's browser TextureLoader needs DOM image support. Node unit tests
    // intentionally retain the procedural underlay unless they inject a fake
    // loader, which keeps the constructor synchronous and deterministic.
    if (!globalThis.document?.createElementNS || !THREE.TextureLoader) return null;
    activeTextureLoader = new THREE.TextureLoader();
    return activeTextureLoader;
  }
  function attachLayerTexture(layer, loadedTexture) {
    if (!loadedTexture) return;
    if (disposed) {
      releaseTexture(loadedTexture);
      return;
    }
    if (layer.pendingTexture && layer.pendingTexture !== loadedTexture) releaseTexture(layer.pendingTexture);
    layer.pendingTexture = null;
    loadedTexture.colorSpace = THREE.SRGBColorSpace;
    loadedTexture.wrapS = THREE.RepeatWrapping;
    loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
    // Keep the pinned tree-shaken Three.js surface small. The shader's
    // luminance knee removes WebP macroblocks; linear filtering then keeps
    // surviving stars stable without adding a mipmap dependency or upload.
    loadedTexture.minFilter = loadedTexture.magFilter = THREE.LinearFilter;
    loadedTexture.generateMipmaps = false;
    loadedTexture.needsUpdate = true;
    layer.texture = loadedTexture;
    artMaterial.uniforms[`uLayer${layer.index}`].value = loadedTexture;
    layer.ready = true;
    layer.failed = false;
    layer.fade = motionReduced || !currentProfile.animated ? 1 : 0;
    applyArtVisuals();
    onInvalidate();
  }
  function failLayer(layer) {
    if (disposed || layer.failed || layer.ready) return;
    releaseTexture(layer.pendingTexture);
    layer.pendingTexture = null;
    layer.failed = true;
    layerFailures += 1;
    onInvalidate();
  }
  function startLayerLoads() {
    if (disposed || layersStarted || !layersRequested || !currentProfile.enabled) return false;
    const loader = configuredTextureLoader();
    if (!loader) return false;
    layersStarted = true;
    for (const layer of artLayers) {
      if (!layer.record?.url) {
        failLayer(layer);
        continue;
      }
      const url = resolvePlanetHubSpaceLayerUrl(layer.record, assetBaseUrl);
      try {
        if (typeof loader.load === "function") {
          const pending = loader.load(url, (loaded) => attachLayerTexture(layer, loaded), undefined, () => failLayer(layer));
          if (!layer.ready && !layer.failed) layer.pendingTexture = pending || null;
        } else if (typeof loader.loadAsync === "function") {
          Promise.resolve(loader.loadAsync(url)).then(
            (loaded) => attachLayerTexture(layer, loaded),
            () => failLayer(layer)
          );
        } else {
          failLayer(layer);
        }
      } catch {
        failLayer(layer);
      }
    }
    return true;
  }
  function loadLayers() {
    if (disposed) return false;
    layersRequested = true;
    return startLayerLoads();
  }

  const applyColors = (colors) => {
    [domeMaterial.uniforms.uVoid, domeMaterial.uniforms.uA, domeMaterial.uniforms.uB, domeMaterial.uniforms.uAccent].forEach((uniform, index) => uniform.value.setHex(colors[index]));
    constellationMaterial.color.setHex(mixHex(colors[3], 0x25b8f2, 0.82));
    constellationNodeMaterial.color.setHex(mixHex(colors[3], 0xe3f8ff, 0.88));
  };
  const syncWorldGrid = () => {
    const profileGridOpacity = currentProfile.enabled
      ? Math.min(0.38, viewDepth.chartOpacity * 1.3) * (currentMode === "focused" ? 0.42 : 1)
        * (currentProfile.effectiveEffects === "reduced" ? 0.58 : 1)
      : 0;
    const baseOpacity = profileGridOpacity * gridTransitionOpacity;
    // One native-style measurement plane persists continuously from Orbit
    // through stellar, galactic, and universe distances. Semantic owners may
    // replace bodies and labels, never this coordinate family; otherwise the
    // user sees a hard grid swap exactly where logarithmic space should feel
    // continuous. Planet remains intentionally clean at arm's-length scale.
    const solarGridVisible = viewDepth.band !== "planet" && viewDepth.chartOpacity > 0;
    const planeY = gridAnchor.y;
    gridCarrierCenter.set(gridAnchor.x, planeY, gridAnchor.z);
    let autoCameraSide = 1;
    let autoViewNormalDot = -1;
    let viewDistance = Math.max(gridRadius, 1);
    let visibleRadius = 0;
    if (camera?.position) {
      camera.updateProjectionMatrix?.();
      camera.updateMatrixWorld?.(true);
      camera.getWorldDirection?.(gridCameraDirection);
      autoCameraSide = camera.position.y - planeY;
      autoViewNormalDot = gridCameraDirection.y;
      const forwardDistance = -autoCameraSide / autoViewNormalDot;
      if (Number.isFinite(forwardDistance) && forwardDistance > 0) {
        gridCarrierCenter.copy(camera.position).addScaledVector(gridCameraDirection, forwardDistance);
        gridCarrierCenter.y = planeY;
      }
      viewDistance = Math.max(1e-6, camera.position.distanceTo(gridCarrierCenter));
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]]) {
        gridNdcPoint.set(x, y, 0.5).unproject(camera);
        gridRayDirection.copy(gridNdcPoint).sub(camera.position).normalize();
        const distance = (planeY - camera.position.y) / gridRayDirection.y;
        if (!(Number.isFinite(distance) && distance > 0)) continue;
        gridIntersection.copy(camera.position).addScaledVector(gridRayDirection, distance);
        visibleRadius = Math.max(visibleRadius, Math.hypot(
          gridIntersection.x - gridCarrierCenter.x,
          gridIntersection.z - gridCarrierCenter.z
        ));
      }
    }
    gridCameraSide = Number(gridPlaneViewOverride?.cameraSide ?? autoCameraSide);
    gridViewNormalDot = Number(gridPlaneViewOverride?.viewNormalDot ?? autoViewNormalDot);
    gridPlaneOpacity = solarGridVisible
      ? resolvePlanetHubGridPlaneOpacity({ cameraSide: gridCameraSide, viewNormalDot: gridViewNormalDot })
      : 0;

    const verticalFov = Math.max(1, Number(camera?.fov) || 28) * Math.PI / 180;
    const aspect = Math.max(0.1, Number(camera?.aspect) || viewportWidth / viewportHeight || 1);
    const verticalSpan = Math.max(1e-9, 2 * viewDistance * Math.tan(verticalFov * 0.5));
    const viewHalfDiagonal = verticalSpan * 0.5 * Math.hypot(aspect, 1);
    visibleRadius = Math.max(visibleRadius, viewHalfDiagonal);
    gridCarrierExtent = Math.max(
      gridRadius * 4,
      visibleRadius * 1.08 / PLANET_HUB_GRID_EDGE_FADE_START
    );
    const desiredCellSize = Math.max(
      1e-12,
      verticalSpan / Math.max(1, viewportHeight) * PLANET_HUB_GRID_TARGET_CELL_PX
    );
    gridLod = resolvePlanetHubGridLod(desiredCellSize);
    gridFamily.position.copy(gridCarrierCenter);
    gridFamily.visible = baseOpacity * gridPlaneOpacity > 0.003;
    gridCarriers.forEach((carrier, index) => {
      const layer = gridLod.layers[index];
      carrier.scale.set(gridCarrierExtent, gridCarrierExtent, 1);
      carrier.material.opacity = baseOpacity * gridPlaneOpacity * layer.weight;
      carrier.material.uniforms.uOpacity.value = carrier.material.opacity;
      carrier.material.uniforms.uCellSize.value = layer.cellSize;
      carrier.material.uniforms.uGridOrigin.value.set(gridAnchor.x, gridAnchor.z);
      carrier.visible = gridFamily.visible && carrier.material.opacity > 0.0005;
      carrier.userData.decade = layer.decade;
      carrier.userData.cellSize = layer.cellSize;
      carrier.userData.weight = layer.weight;
    });
    gridFamily.userData.cameraSide = gridCameraSide;
    gridFamily.userData.viewNormalDot = gridViewNormalDot;
    gridFamily.userData.planeOpacity = gridPlaneOpacity;
    gridFamily.userData.carrierExtent = gridCarrierExtent;

    const represented = resolvePlanetHubRepresentedDistance(viewDepth.progress);
    const targetRadiusWorld = Math.max(desiredCellSize * 6, verticalSpan * 0.36);
    meterLod = resolvePlanetHubPlaneMeters({
      targetRadiusMeters: targetRadiusWorld * represented.metersPerUnit,
      metersPerUnit: represented.metersPerUnit
    });
    planeMeter.position.set(gridAnchor.x, planeY + Math.max(gridRadius * 0.0004, 1e-5), gridAnchor.z);
    planeMeter.visible = gridFamily.visible;
    const worldPerPixel = verticalSpan / Math.max(1, viewportHeight);
    planeMeters.forEach((meter, index) => {
      const resolved = meterLod.meters[index];
      if (meter.decade !== resolved.decade || meter.labelText !== resolved.label) {
        const previousTexture = meter.label.material.map;
        const labelRaster = createMeterLabelTexture(resolved.label);
        meter.label.material.map = labelRaster.texture;
        meter.label.material.needsUpdate = true;
        meter.label.userData.labelAspect = labelRaster.aspect;
        meter.label.userData.labelRaster = Object.freeze({
          width: labelRaster.width,
          height: labelRaster.height,
          source: labelRaster.source
        });
        previousTexture?.dispose?.();
      }
      meter.decade = resolved.decade;
      meter.labelText = resolved.label;
      meter.radiusMeters = resolved.radiusMeters;
      meter.unit = resolved.unit;
      meter.weight = resolved.weight;
      meter.ring.scale.setScalar(resolved.radiusWorld);
      meter.ring.material.opacity = baseOpacity * gridPlaneOpacity * resolved.weight * 0.92;
      meter.ring.visible = planeMeter.visible && meter.ring.material.opacity > 0.002;
      const labelHeight = Math.max(worldPerPixel * 18, resolved.radiusWorld * 0.025);
      meter.label.position.set(resolved.radiusWorld, labelHeight * 0.72, 0);
      meter.label.scale.set(labelHeight * meter.label.userData.labelAspect, labelHeight, 1);
      if (camera?.quaternion) meter.label.quaternion.copy(camera.quaternion);
      meter.label.material.opacity = Math.min(0.9,
        baseOpacity * gridPlaneOpacity * resolved.weight * 3.4);
      meter.label.visible = planeMeter.visible && meter.label.material.opacity > 0.01;
      meter.ring.userData.meter = { ...resolved };
      meter.label.userData.meter = { ...resolved };
    });
  };
  const applyProfile = () => {
    root.visible = currentProfile.enabled;
    worldRoot.visible = currentProfile.enabled;
    const animated = currentProfile.animated ? 1 : 0;
    domeMaterial.uniforms.uMotion.value = animated;
    domeMaterial.uniforms.uIntensity.value = (currentProfile.effectiveEffects === "reduced" ? 0.72 : 1)
      * viewDepth.domeIntensity * gridTransitionOpacity;
    starMaterial.uniforms.uMotion.value = animated;
    starMaterial.uniforms.uOpacity.value = currentProfile.enabled
      ? (currentProfile.effectiveEffects === "reduced" ? 0.72 : 0.9) * viewDepth.starOpacity
        * gridTransitionOpacity
      : 0;
    constellationMaterial.opacity = currentProfile.enabled
      ? Math.min(0.56, (currentMode === "focused" ? 0.052 : currentProfile.effectiveEffects === "reduced" ? 0.09 : 0.152)
        * viewDepth.constellationOpacity)
        * gridTransitionOpacity
      : 0;
    constellationNodeMaterial.opacity = currentProfile.enabled
      ? (currentMode === "focused" ? 0.2 : currentProfile.effectiveEffects === "reduced" ? 0.32 : 0.52)
        * Math.min(1.55, viewDepth.constellationOpacity)
        * gridTransitionOpacity
      : 0;
    syncWorldGrid();
    if (!currentProfile.animated) {
      for (const layer of artLayers) if (layer.ready) layer.fade = 1;
    }
    applyArtVisuals();
  };
  function resize(options = {}) {
    if (options.camera?.position) root.position.copy(options.camera.position);
    viewportWidth = Math.max(1, Number(options.width) || viewportWidth);
    viewportHeight = Math.max(1, Number(options.height) || viewportHeight);
    syncWorldGrid();
    onInvalidate();
  }
  function setWorldGridAnchor(options = {}) {
    const position = options.position ?? options.center;
    if (position?.isVector3) gridAnchor.copy(position);
    else if (Array.isArray(position)) gridAnchor.fromArray(position);
    gridRadius = Math.max(0.05, Number(options.bodyRadius) || gridRadius);
    syncWorldGrid();
    onInvalidate();
    return { position: gridAnchor.toArray(), bodyRadius: gridRadius };
  }
  function setWorldGridPlaneView(options = {}) {
    if (options == null || options.auto === true
      || options.cameraSide == null && options.viewNormalDot == null) {
      gridPlaneViewOverride = null;
    } else {
      gridPlaneViewOverride = {
        cameraSide: Number.isFinite(Number(options.cameraSide)) ? Number(options.cameraSide) : null,
        viewNormalDot: Number.isFinite(Number(options.viewNormalDot)) ? Number(options.viewNormalDot) : null
      };
    }
    syncWorldGrid();
    onInvalidate();
    return Object.freeze({
      cameraSide: gridCameraSide,
      viewNormalDot: gridViewNormalDot,
      opacity: gridPlaneOpacity,
      automatic: !gridPlaneViewOverride
    });
  }
  function setWorldGridTransitionOpacity(value = 1) {
    gridTransitionOpacity = clamp(value);
    applyProfile();
    onInvalidate();
    return gridTransitionOpacity;
  }
  function setMood(options = {}) {
    currentWorld = WORLDS.includes(options.worldId) ? options.worldId : currentWorld;
    currentDestination = DESTINATIONS.includes(options.destination) ? options.destination : currentDestination;
    currentMode = options.mode === "focused" ? "focused" : "overview";
    fromColors = currentColors;
    targetColors = palette(currentWorld, currentDestination, {
      quality,
      effectsLevel: requestedEffects,
      reducedMotion: motionReduced
    });
    moodElapsed = options.animate === false || !currentProfile.animated ? MOOD_SECONDS : 0;
    domeMaterial.uniforms.uFocus.value = currentMode === "focused" ? 0.74 : 1;
    applyProfile();
    if (moodElapsed === MOOD_SECONDS) applyColors(currentColors = targetColors);
    applyArtVisuals();
    onInvalidate();
    return targetColors;
  }
  function setEffects(next = requestedEffects, options = {}) {
    requestedEffects = ["full", "reduced", "off"].includes(next) ? next : "full";
    motionReduced = Boolean(options.reducedMotion ?? motionReduced);
    currentProfile = resolvePlanetHubMoodEffects({
      quality,
      effectsLevel: requestedEffects,
      reducedMotion: motionReduced
    });
    if (!currentProfile.animated) applyColors(currentColors = targetColors);
    applyProfile();
    if (currentProfile.enabled && layersRequested) startLayerLoads();
    onInvalidate();
    return currentProfile;
  }
  function setViewDepth(options = {}) {
    viewDepth = resolvePlanetHubSpaceViewDepth(options);
    applyProfile();
    onInvalidate();
    return viewDepth;
  }
  function update(_now = 0, deltaSeconds = 1 / 60) {
    if (disposed || suspended || !currentProfile.enabled) return false;
    syncWorldGrid();
    const dt = clamp(deltaSeconds, 0, 0.1);
    if (currentProfile.animated) elapsed += dt;
    domeMaterial.uniforms.uTime.value = elapsed;
    starMaterial.uniforms.uTime.value = elapsed;
    let layerAnimating = false;
    for (const layer of artLayers) {
      if (!layer.ready) continue;
      if (layer.fade < 1) {
        layer.fade = Math.min(1, layer.fade + dt / 1.15);
        layerAnimating = layerAnimating || layer.fade < 1;
      }
      const longitude = layer.config.rotationY / (Math.PI * 2)
        + layer.config.offset[0] * 0.12
        + elapsed * layer.config.drift;
      artMaterial.uniforms[`uShift${layer.index}`].value.set(
        longitude,
        layer.config.offset[1] * 0.08
      );
    }
    applyArtVisuals();
    if (moodElapsed < MOOD_SECONDS) {
      moodElapsed = Math.min(MOOD_SECONDS, moodElapsed + dt);
      const amount = moodElapsed / MOOD_SECONDS;
      currentColors = fromColors.map((color, index) => mixHex(color, targetColors[index], amount * amount * (3 - 2 * amount)));
      applyColors(currentColors);
    }
    return currentProfile.animated || moodElapsed < MOOD_SECONDS || layerAnimating;
  }
  function suspend() { if (disposed || suspended) return false; suspended = true; return true; }
  function resume() { if (disposed || !suspended) return false; suspended = false; onInvalidate(); return true; }
  function snapshot() {
    const readyCount = artLayers.filter((layer) => layer.ready).length;
    const authoredComplete = readyCount === artLayers.length && artLayers.every((layer) => layer.fade >= 1);
    return Object.freeze({
      ...currentProfile,
      artLayersReady: readyCount,
      artLayersFailed: layerFailures,
      artLayersTotal: artLayers.length,
      artLayersRequested: layersRequested,
      authoredCompositeReady: authoredComplete,
      gpuStarCount: starData.count,
      constellationSegments: constellationData.segments,
      chartOpacity: gridCarriers.reduce((sum, carrier) => sum + carrier.material.opacity, 0),
      gridFamilyCount: 1,
      gridCarrierCount: gridCarriers.length,
      gridDecades: gridLod.layers.map((layer) => layer.decade),
      gridCellSizes: gridLod.layers.map((layer) => layer.cellSize),
      gridWeights: gridLod.layers.map((layer) => layer.weight),
      gridWeightSum: gridLod.layers.reduce((sum, layer) => sum + layer.weight, 0),
      gridPlaneOpacity,
      gridCameraSide,
      gridViewNormalDot,
      gridTransitionOpacity,
      gridCarrierExtent,
      gridEdgeFadeStart: PLANET_HUB_GRID_EDGE_FADE_START,
      planeMeterCount: planeMeters.length,
      planeMeterLabels: planeMeters.map((meter) => meter.labelText),
      planeMeterUnits: planeMeters.map((meter) => meter.unit),
      planeMeterWeights: planeMeters.map((meter) => meter.weight),
      planeMeterRadiiMeters: planeMeters.map((meter) => meter.radiusMeters),
      viewBand: viewDepth.band,
      viewProgress: viewDepth.progress,
      // Structural cost contract: one full-screen pass at steady state, two
      // only while crossfading or retaining the partial-failure fallback.
      spaceDrawPasses: Number(artComposite.visible) + Number(dome.visible)
    });
  }
  function dispose() {
    if (disposed) return false;
    disposed = suspended = true;
    root.removeFromParent?.();
    worldRoot.removeFromParent?.();
    dome.geometry.dispose();
    domeMaterial.dispose();
    starGeometry.dispose();
    starMaterial.dispose();
    constellationGeometry.dispose();
    constellationMaterial.dispose();
    constellationNodeMaterial.dispose();
    constellationPointMap.dispose();
    gridGeometry.dispose();
    gridTexture.dispose();
    for (const carrier of gridCarriers) carrier.material.dispose();
    meterGeometry.dispose();
    meterLabelGeometry.dispose();
    for (const meter of planeMeters) {
      meter.ring.material.dispose();
      meter.label.material.map?.dispose?.();
      meter.label.material.dispose();
    }
    texture.dispose();
    for (const layer of artLayers) {
      releaseTexture(layer.texture);
      if (layer.pendingTexture !== layer.texture) releaseTexture(layer.pendingTexture);
      layer.texture = null;
      layer.pendingTexture = null;
      artMaterial.uniforms[`uLayer${layer.index}`].value = blackTexture;
    }
    artMaterial.dispose();
    blackTexture.dispose();
    root.clear?.();
    worldRoot.clear?.();
    return true;
  }

  applyColors(currentColors);
  applyProfile();
  resize({ camera, width, height });
  return Object.freeze({
    root,
    worldRoot,
    dome,
    starField,
    constellations,
    constellationNodes,
    worldGrid,
    gridFamily,
    gridCarriers,
    gridTexture,
    planeMeter,
    planeMeters,
    noiseTexture: texture,
    artComposite,
    artLayers,
    loadLayers,
    resize,
    setMood,
    setEffects,
    setViewDepth,
    setWorldGridAnchor,
    setWorldGridPlaneView,
    setWorldGridTransitionOpacity,
    update,
    suspend,
    resume,
    snapshot,
    dispose,
    destroy: dispose
  });
}
