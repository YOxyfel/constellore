export const PLANET_HUB_DESTINATIONS = Object.freeze(["forge", "journey", "arena"]);
export const PLANET_HUB_WORLDS = Object.freeze(["earth", "moon"]);
export const PLANET_HUB_QUALITY = Object.freeze(["low", "standard", "static"]);
export const PLANET_HUB_SPACE_LAYER_IDS = Object.freeze([
  "cosmic-horizon",
  "deep-stars",
  "deep-sky",
  "nebula-filaments",
  "near-stars"
]);
export const PLANET_HUB_PHASES = Object.freeze([
  "loading",
  "ready",
  "preview",
  "transitioning",
  "lost",
  "fallback"
]);

export const PLANET_HUB_RING_TILT_DEGREES = 23.5;
export const PLANET_HUB_ROAD_RADIUS = 1.006;
export const PLANET_HUB_MANIFEST_SCHEMA_VERSION = 1;
export const PLANET_HUB_MIN_DESTINATION_SEPARATION_DEGREES = 45;

// Earth-only continental coordinates, intentionally kept away from poles and
// coastlines so landmark footprints stay legible on both globe tiers. The Moon
// keeps its authored ring until named lunar regions are designed.
// Longitude follows the conventional east-positive geographic system.
export const PLANET_HUB_DESTINATION_COORDINATES = Object.freeze({
  forge: Object.freeze({ region: "Europe", latitudeDegrees: 50, longitudeDegrees: 10 }),
  journey: Object.freeze({ region: "Antarctica", latitudeDegrees: -80, longitudeDegrees: 0 }),
  arena: Object.freeze({ region: "North America", latitudeDegrees: 40, longitudeDegrees: -100 })
});

const DESTINATION_PHASES = Object.freeze({ forge: 0, journey: 120, arena: 240 });
const EPSILON = 1e-8;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function freezeVector(vector) {
  return Object.freeze(vector.map((value) => Math.abs(value) < EPSILON ? 0 : value));
}

export function normalizePlanetHubDestination(value, fallback = "forge") {
  const destination = String(value || "").trim().toLowerCase();
  return PLANET_HUB_DESTINATIONS.includes(destination) ? destination : fallback;
}

export function normalizePlanetHubWorld(value, fallback = "earth") {
  const world = String(value || "").trim().toLowerCase();
  return PLANET_HUB_WORLDS.includes(world) ? world : fallback;
}

export function dot3(left, right) {
  return finite(left?.[0]) * finite(right?.[0])
    + finite(left?.[1]) * finite(right?.[1])
    + finite(left?.[2]) * finite(right?.[2]);
}

export function cross3(left, right) {
  return freezeVector([
    finite(left?.[1]) * finite(right?.[2]) - finite(left?.[2]) * finite(right?.[1]),
    finite(left?.[2]) * finite(right?.[0]) - finite(left?.[0]) * finite(right?.[2]),
    finite(left?.[0]) * finite(right?.[1]) - finite(left?.[1]) * finite(right?.[0])
  ]);
}

export function normalize3(vector, fallback = [0, 1, 0]) {
  const length = Math.hypot(finite(vector?.[0]), finite(vector?.[1]), finite(vector?.[2]));
  if (length < EPSILON) return freezeVector([...fallback]);
  return freezeVector([
    finite(vector?.[0]) / length,
    finite(vector?.[1]) / length,
    finite(vector?.[2]) / length
  ]);
}

export function anchorAtPhase(phaseDegrees, {
  tiltDegrees = PLANET_HUB_RING_TILT_DEGREES,
  radius = 1
} = {}) {
  const phase = finite(phaseDegrees) * Math.PI / 180;
  const tilt = finite(tiltDegrees, PLANET_HUB_RING_TILT_DEGREES) * Math.PI / 180;
  const cosPhase = Math.cos(phase);
  const sinPhase = Math.sin(phase);
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);
  // Start with the Y-up equator (XZ), then tilt its plane around X.
  const normal = normalize3([cosPhase, -sinPhase * sinTilt, sinPhase * cosTilt]);
  const tangent = normalize3([-sinPhase, -cosPhase * sinTilt, cosPhase * cosTilt]);
  const outward = normalize3(cross3(normal, tangent));
  return Object.freeze({
    phaseDegrees: finite(phaseDegrees),
    position: freezeVector(normal.map((value) => value * finite(radius, 1))),
    normal,
    tangent,
    outward
  });
}

export function anchorAtCoordinates(latitudeDegrees, longitudeDegrees, { radius = 1 } = {}) {
  const latitude = Math.max(-90, Math.min(90, finite(latitudeDegrees))) * Math.PI / 180;
  const longitude = finite(longitudeDegrees) * Math.PI / 180;
  const cosLatitude = Math.cos(latitude);
  const normal = normalize3([
    -cosLatitude * Math.cos(longitude),
    Math.sin(latitude),
    cosLatitude * Math.sin(longitude)
  ]);
  // Runtime replaces the authored Earth mesh with THREE.SphereGeometry, whose
  // longitudinal UV handedness differs from the source GLB, then rotates that
  // textured mesh by PI around Y while landmarks remain siblings. The verified
  // live world frame is therefore 0E=-X and 90E=+Z. A westward tangent keeps
  // orientSite's authored local +Z pointed toward geographic north.
  const tangent = normalize3([-Math.sin(longitude), 0, -Math.cos(longitude)], [0, 0, -1]);
  const outward = normalize3(cross3(normal, tangent));
  return Object.freeze({
    latitudeDegrees: finite(latitudeDegrees),
    longitudeDegrees: finite(longitudeDegrees),
    position: freezeVector(normal.map((value) => value * finite(radius, 1))),
    normal,
    tangent,
    outward
  });
}

export function createDestinationAnchors({
  radius = 1,
  worldId = "earth",
  coordinates = PLANET_HUB_DESTINATION_COORDINATES
} = {}) {
  const world = normalizePlanetHubWorld(worldId);
  return Object.freeze(Object.fromEntries(PLANET_HUB_DESTINATIONS.map((destination) => {
    if (world === "moon") {
      return [destination, Object.freeze({
        destination,
        worldId: world,
        layout: "authored-ring",
        ...anchorAtPhase(DESTINATION_PHASES[destination], { radius })
      })];
    }
    const coordinate = coordinates?.[destination] || PLANET_HUB_DESTINATION_COORDINATES[destination];
    return [destination, Object.freeze({
      destination,
      worldId: world,
      layout: "geographic",
      region: coordinate.region || PLANET_HUB_DESTINATION_COORDINATES[destination].region,
      ...anchorAtCoordinates(
        coordinate.latitudeDegrees,
        coordinate.longitudeDegrees,
        { radius }
      )
    })];
  })));
}

export function assertDestinationAnchorSpacing(anchors = createDestinationAnchors(), options = {}) {
  const configuration = typeof options === "number" ? { tolerance: options } : options;
  const tolerance = Math.max(0, finite(configuration?.tolerance, 1e-6));
  const minimumDegrees = Math.max(1, Math.min(89,
    finite(configuration?.minimumDegrees, PLANET_HUB_MIN_DESTINATION_SEPARATION_DEGREES)));
  const maximumDot = Math.cos(minimumDegrees * Math.PI / 180);
  const pairs = [["forge", "journey"], ["journey", "arena"], ["arena", "forge"]];
  for (const [left, right] of pairs) {
    const value = dot3(anchors?.[left]?.normal, anchors?.[right]?.normal);
    if (!Number.isFinite(value) || value > maximumDot + tolerance || value < -1 + tolerance) {
      throw new Error(
        `Planet hub anchors ${left}/${right} have dot ${value}; expected distinct, non-antipodal sites at least ${minimumDegrees} degrees apart.`
      );
    }
  }
  return true;
}

export function interpolateGreatCircle(from, to, progress = 0, { radius = 1 } = {}) {
  const start = normalize3(from);
  const end = normalize3(to);
  const amount = Math.max(0, Math.min(1, finite(progress)));
  const cosine = Math.max(-1, Math.min(1, dot3(start, end)));
  const angle = Math.acos(cosine);
  const sine = Math.sin(angle);
  if (Math.abs(sine) < EPSILON) {
    return freezeVector(normalize3(start.map((value, index) => (
      value + (end[index] - value) * amount
    ))).map((value) => value * finite(radius, 1)));
  }
  const startWeight = Math.sin((1 - amount) * angle) / sine;
  const endWeight = Math.sin(amount * angle) / sine;
  return freezeVector(start.map((value, index) => (
    (value * startWeight + end[index] * endWeight) * finite(radius, 1)
  )));
}

export function createGreatCircleRoads({
  radius = PLANET_HUB_ROAD_RADIUS,
  pointsPerSegment = 25,
  worldId = "earth",
  anchors = null
} = {}) {
  const resolvedAnchors = anchors || createDestinationAnchors({ worldId });
  const count = Math.max(2, Math.floor(finite(pointsPerSegment, 25)));
  return Object.freeze(PLANET_HUB_DESTINATIONS.map((from, index) => {
    const to = PLANET_HUB_DESTINATIONS[(index + 1) % PLANET_HUB_DESTINATIONS.length];
    const points = [];
    for (let pointIndex = 0; pointIndex < count; pointIndex += 1) {
      const progress = pointIndex / (count - 1);
      points.push(interpolateGreatCircle(
        resolvedAnchors[from].normal,
        resolvedAnchors[to].normal,
        progress,
        { radius }
      ));
    }
    return Object.freeze({ from, to, points: Object.freeze(points) });
  }));
}

export function quaternionFromUnitVectors(fromValue, toValue) {
  const from = normalize3(fromValue);
  const to = normalize3(toValue);
  let scalar = dot3(from, to) + 1;
  let xyz;
  if (scalar < EPSILON) {
    scalar = 0;
    xyz = Math.abs(from[0]) > Math.abs(from[2])
      ? [-from[1], from[0], 0]
      : [0, -from[2], from[1]];
  } else {
    xyz = cross3(from, to);
  }
  const length = Math.hypot(xyz[0], xyz[1], xyz[2], scalar) || 1;
  return freezeVector([xyz[0] / length, xyz[1] / length, xyz[2] / length, scalar / length]);
}

function multiplyQuaternion(left, right) {
  const [ax, ay, az, aw] = left;
  const [bx, by, bz, bw] = right;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}

function rotate3ByQuaternion(vector, quaternion) {
  const [x, y, z] = vector;
  const [qx, qy, qz, qw] = quaternion;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + qy * tz - qz * ty,
    y + qw * ty + qz * tx - qx * tz,
    z + qw * tz + qx * ty - qy * tx
  ];
}

function tangentToNormal(vector, normal) {
  const projected = [
    finite(vector?.[0]) - normal[0] * dot3(vector, normal),
    finite(vector?.[1]) - normal[1] * dot3(vector, normal),
    finite(vector?.[2]) - normal[2] * dot3(vector, normal)
  ];
  if (Math.hypot(...projected) >= EPSILON) return normalize3(projected);
  const fallbackAxis = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return normalize3(cross3(fallbackAxis, normal));
}

/**
 * Rotate a destination onto a target surface normal while also resolving the
 * otherwise-free twist around that normal. Landmark assets author their front
 * along local +Z. `orientSite()` maps that axis to `tangent x normal`, which
 * is the negative of the anchor's outward vector, so every focused structure can face
 * the camera consistently instead of inheriting a different diagonal roll.
 */
export function destinationFacingQuaternion(
  destination,
  anchors = createDestinationAnchors(),
  targetNormal = [0, 0, 1],
  targetFront = [0, -1, 0]
) {
  const normalized = normalizePlanetHubDestination(destination);
  const normal = normalize3(targetNormal);
  const align = quaternionFromUnitVectors(anchors[normalized].normal, normal);
  const alignedFront = tangentToNormal(
    rotate3ByQuaternion(anchors[normalized].outward.map((value) => -value), align),
    normal
  );
  const desiredFront = tangentToNormal(targetFront, normal);
  const angle = Math.atan2(
    dot3(normal, cross3(alignedFront, desiredFront)),
    Math.max(-1, Math.min(1, dot3(alignedFront, desiredFront)))
  );
  const half = angle * 0.5;
  const twist = [
    normal[0] * Math.sin(half),
    normal[1] * Math.sin(half),
    normal[2] * Math.sin(half),
    Math.cos(half)
  ];
  const value = multiplyQuaternion(twist, align);
  const length = Math.hypot(...value) || 1;
  return freezeVector(value.map((component) => component / length));
}

export function destinationQuaternion(destination, anchors = createDestinationAnchors(), targetNormal = [0, 0, 1]) {
  const normalized = normalizePlanetHubDestination(destination);
  return quaternionFromUnitVectors(anchors[normalized].normal, targetNormal);
}

export function nextPlanetHubDestination(current, direction = 1, available = PLANET_HUB_DESTINATIONS) {
  const normalized = normalizePlanetHubDestination(current);
  const enabled = PLANET_HUB_DESTINATIONS.filter((destination) => {
    if (Array.isArray(available)) return available.includes(destination);
    return available?.[destination] !== false;
  });
  if (!enabled.length) return "forge";
  const currentIndex = enabled.indexOf(normalized);
  const start = currentIndex < 0 ? 0 : currentIndex;
  const step = finite(direction, 1) < 0 ? -1 : 1;
  return enabled[(start + step + enabled.length) % enabled.length];
}

export function selectPlanetHubQuality({
  webgl2 = true,
  saveData = false,
  contextLosses = 0,
  width = 1280,
  height = 720,
  deviceMemory = null,
  hardwareConcurrency = null,
  coarsePointer = false,
  mobile = false,
  qualityOverride = null
} = {}) {
  if (!webgl2 || saveData || finite(contextLosses) >= 2) return "static";
  const requestedQuality = String(qualityOverride || "").trim().toLowerCase();
  if (requestedQuality === "static") return "static";
  if (requestedQuality === "low") return "low";
  const viewportWidth = Math.max(1, finite(width, 1280));
  const viewportHeight = Math.max(1, finite(height, 720));
  const portraitTablet = viewportHeight > viewportWidth && viewportWidth <= 1024;
  const phone = mobile || (coarsePointer && Math.min(viewportWidth, viewportHeight) <= 600);
  const knownDeviceMemory = deviceMemory !== null
    && deviceMemory !== undefined
    && deviceMemory !== ""
    && Number.isFinite(Number(deviceMemory))
    && Number(deviceMemory) > 0;
  const knownHardwareConcurrency = hardwareConcurrency !== null
    && hardwareConcurrency !== undefined
    && hardwareConcurrency !== ""
    && Number.isFinite(Number(hardwareConcurrency))
    && Number(hardwareConcurrency) > 0;
  // Safari and privacy-hardened desktop browsers often omit one or both
  // hardware hints. A missing hint is not evidence that a large fine-pointer
  // device is constrained; WebGL probing has already rejected major software
  // fallbacks before this policy runs. Known low-end hardware still receives
  // Low, while phones and portrait tablets remain conservative by default.
  const constrained = (knownDeviceMemory && Number(deviceMemory) <= 4)
    || (knownHardwareConcurrency && Number(hardwareConcurrency) <= 4);
  return phone || portraitTablet || constrained ? "low" : "standard";
}

export function capPlanetHubPixelRatio(value, quality) {
  const limit = quality === "standard" ? 1.75 : 1.25;
  return Math.max(1, Math.min(finite(value, 1), limit));
}

export function resolvePlanetHubGesture({
  startX = 0,
  startY = 0,
  endX = 0,
  endY = 0,
  durationMs = 0,
  minDistance = 48,
  maxDurationMs = 675,
  horizontalRatio = 1.25
} = {}) {
  const deltaX = finite(endX) - finite(startX);
  const deltaY = finite(endY) - finite(startY);
  const horizontal = Math.abs(deltaX);
  const vertical = Math.abs(deltaY);
  const accepted = horizontal >= minDistance
    && horizontal >= vertical * horizontalRatio
    && finite(durationMs) <= maxDurationMs;
  return Object.freeze({
    accepted,
    deltaX,
    deltaY,
    direction: accepted ? (deltaX < 0 ? 1 : -1) : 0
  });
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateAsset(asset, path, errors, { required = true } = {}) {
  if (!required && asset == null) return;
  if (typeof asset === "string" && asset.trim()) return;
  if (!isObject(asset)) {
    errors.push(`${path} must be an asset object or URL string.`);
    return;
  }
  if (typeof asset.url !== "string" || !asset.url.trim()) errors.push(`${path}.url is required.`);
  if (asset.bytes != null && (!Number.isInteger(asset.bytes) || asset.bytes < 0)) errors.push(`${path}.bytes must be a non-negative integer.`);
  if (asset.triangles != null && (!Number.isInteger(asset.triangles) || asset.triangles < 0)) errors.push(`${path}.triangles must be a non-negative integer.`);
}

export function assetUrl(asset) {
  return typeof asset === "string" ? asset : asset?.url || "";
}

export function validatePlanetHubManifest(manifest, { throwOnError = true } = {}) {
  const errors = [];
  if (!isObject(manifest)) errors.push("manifest must be an object.");
  if (manifest?.schemaVersion !== PLANET_HUB_MANIFEST_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${PLANET_HUB_MANIFEST_SCHEMA_VERSION}.`);
  }
  for (const worldId of PLANET_HUB_WORLDS) {
    const world = manifest?.worlds?.[worldId];
    if (!isObject(world)) {
      errors.push(`worlds.${worldId} is required.`);
      continue;
    }
    for (const destination of PLANET_HUB_DESTINATIONS) {
      if (typeof world.posters?.[destination] !== "string" || !world.posters[destination].trim()) {
        errors.push(`worlds.${worldId}.posters.${destination} is required.`);
      }
    }
    for (const quality of ["low", "standard"]) {
      const tier = world.tiers?.[quality];
      if (!isObject(tier)) {
        errors.push(`worlds.${worldId}.tiers.${quality} is required.`);
        continue;
      }
      validateAsset(tier.planet, `worlds.${worldId}.tiers.${quality}.planet`, errors);
      const planetTriangleLimit = quality === "low"
        ? (worldId === "earth" ? 30_000 : 25_000)
        : (worldId === "earth" ? 90_000 : 60_000);
      if (typeof tier.planet === "object" && tier.planet?.triangles > planetTriangleLimit) {
        errors.push(`worlds.${worldId}.tiers.${quality}.planet exceeds ${planetTriangleLimit} triangles.`);
      }
      for (const destination of PLANET_HUB_DESTINATIONS) {
        const landmark = tier.landmarks?.[destination];
        validateAsset(landmark, `worlds.${worldId}.tiers.${quality}.landmarks.${destination}`, errors);
        if (typeof landmark === "object" && landmark?.triangles > 10_000) {
          errors.push(`worlds.${worldId}.tiers.${quality}.landmarks.${destination} exceeds 10000 triangles.`);
        }
      }
    }
  }
  for (const quality of ["low", "standard"]) {
    const rocket = manifest?.shared?.tiers?.[quality]?.rocket;
    validateAsset(rocket, `shared.tiers.${quality}.rocket`, errors, { required: false });
    if (typeof rocket === "object" && rocket?.triangles > 10_000) {
      errors.push(`shared.tiers.${quality}.rocket exceeds 10000 triangles.`);
    }
  }
  const portal = manifest?.portal;
  if (!isObject(portal)) errors.push("portal is required.");
  else {
    for (const key of ["mp4", "webm", "poster"]) {
      if (typeof portal[key] !== "string" || !portal[key].trim()) errors.push(`portal.${key} is required.`);
    }
    if (portal.width !== 1024 || portal.height !== 512) errors.push("portal dimensions must be 1024x512.");
    if (portal.frameCount !== 200) errors.push("portal.frameCount must be 200.");
    if (Math.abs(finite(portal.durationSeconds) - 6.667) > 0.02) errors.push("portal.durationSeconds must be approximately 6.667.");
  }
  const spaceLayers = manifest?.spaceLayers;
  if (spaceLayers !== undefined) {
    if (!isObject(spaceLayers)) errors.push("spaceLayers must be an object when supplied.");
    else {
      if (spaceLayers.schemaVersion !== 1) errors.push("spaceLayers.schemaVersion must be 1.");
      if (spaceLayers.initialScene !== false) errors.push("spaceLayers.initialScene must be false.");
      if (spaceLayers.loadPolicy !== "progressive-after-ready") {
        errors.push("spaceLayers.loadPolicy must be progressive-after-ready.");
      }
      for (const quality of ["low", "standard"]) {
        const tier = spaceLayers.tiers?.[quality];
        if (!isObject(tier)) {
          errors.push(`spaceLayers.tiers.${quality} is required.`);
          continue;
        }
        const layers = Array.isArray(tier.layers) ? tier.layers : [];
        if (layers.length !== PLANET_HUB_SPACE_LAYER_IDS.length) {
          errors.push(`spaceLayers.tiers.${quality}.layers must contain exactly ${PLANET_HUB_SPACE_LAYER_IDS.length} records.`);
        }
        for (const [index, id] of PLANET_HUB_SPACE_LAYER_IDS.entries()) {
          const layer = layers[index];
          if (layer?.id !== id) errors.push(`spaceLayers.tiers.${quality}.layers.${index}.id must be ${id}.`);
          validateAsset(layer, `spaceLayers.tiers.${quality}.layers.${index}`, errors);
          if (layer && (finite(layer.width) !== (quality === "low" ? 1024 : 2048)
            || finite(layer.height) !== (quality === "low" ? 512 : 1024))) {
            errors.push(`spaceLayers.tiers.${quality}.layers.${index} has invalid dimensions.`);
          }
        }
      }
    }
  }
  const result = Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  if (errors.length && throwOnError) throw new TypeError(`Invalid planet hub manifest: ${errors.join(" ")}`);
  return result;
}

export function resolvePlanetHubAsset(manifest, worldId, quality, destination = null) {
  const world = manifest?.worlds?.[normalizePlanetHubWorld(worldId)];
  const tier = world?.tiers?.[quality === "standard" ? "standard" : "low"];
  return destination == null
    ? tier?.planet || null
    : tier?.landmarks?.[normalizePlanetHubDestination(destination)] || null;
}
