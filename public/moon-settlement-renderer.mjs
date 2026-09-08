/**
 * Moon Settlement renderer
 *
 * The settlement lab owns story, controls, and persistence. This module owns
 * only spatial presentation: a genuine Three.js diorama when WebGL is
 * available and an authored-image 2.5D surface when it is not.
 */

import {
  MOON_SETTLEMENT_PARCEL_CELL_SIZE,
  MOON_SETTLEMENT_PLOT_STRIDE,
  createMoonSettlementParcelCells,
  normalizeMoonSettlementPlacement
} from "./moon-settlement-placement.mjs?v=5.0.0-beta.4";

export const DEFAULT_MOON_SETTLEMENT_THREE_SPECIFIER = "three";
export const DEFAULT_MOON_SETTLEMENT_VENDOR_SPECIFIER = "./vendor/three/planet-hub-three.mjs?v=5.0.0-beta.4";
export const DEFAULT_MOON_SETTLEMENT_GLTF_LOADER_URL = "./vendor/three/GLTFLoader.js?v=5.0.0-beta.4";
export const DEFAULT_MOON_SETTLEMENT_POSTER_URL = "./art/planet-hub/posters/moon-journey.webp";
export const MOON_SETTLEMENT_LUNAR_RADIUS_METERS = 1_737_400;
// A literal million-metre sphere loses near-camera precision in WebGL. This
// local walking representation keeps metre-sized people and buildings while
// expanding the old 18 m toy globe by 100x. Its curvature is intentionally
// compressed; the canonical physical radius remains available above.
export const MOON_SETTLEMENT_SURFACE_RADIUS = 1_800;
export const MOON_SETTLEMENT_ASTRONAUT_HEIGHT_METERS = 1.78;
export const MOON_SETTLEMENT_WALK_CLEARANCE = 0.04;
export const MOON_SETTLEMENT_WALK_BOUNDARY = 36;
export const MOON_SETTLEMENT_GRAVITY = 1.62;
export const MOON_SETTLEMENT_LOCAL_TERRAIN_SIZE = 96;
export const MOON_SETTLEMENT_LOCAL_TERRAIN_SEGMENTS = 64;

export const MOON_SETTLEMENT_MODES = Object.freeze(["walk", "inspect", "weave"]);
export const MOON_SETTLEMENT_QUALITY = Object.freeze({
  low: Object.freeze({ pixelRatio: 1.15, radialSegments: 16, shadowMap: false }),
  standard: Object.freeze({ pixelRatio: 1.75, radialSegments: 28, shadowMap: true })
});

export const MOON_SETTLEMENT_ASSETS = Object.freeze({
  low: Object.freeze({
    moon: "./art/planet-hub/models/moon-low.glb",
    terrain: "./art/planet-hub/models/moon-landing-low.glb",
    lander: "./art/planet-hub/models/rocket-low.glb",
    portal: "./art/planet-hub/models/portal-low.glb",
    "solar-power": "./art/moon-settlement/models/solar-power-low.glb",
    "lunar-power": "./art/moon-settlement/models/lunar-power-low.glb",
    "bastion-shelter": "./art/moon-settlement/models/bastion-shelter-low.glb",
    "hive-shelter": "./art/moon-settlement/models/hive-shelter-low.glb",
    "haven-shelter": "./art/moon-settlement/models/haven-shelter-low.glb",
    "beacon-signal": "./art/moon-settlement/models/beacon-signal-low.glb",
    "stars-signal": "./art/moon-settlement/models/stars-signal-low.glb",
    "starter-vault": "./art/moon-settlement/models/starter-vault-low.glb",
    processor: "./art/moon-settlement/models/processor-low.glb",
    storage: "./art/moon-settlement/models/storage-low.glb",
    reservoir: "./art/moon-settlement/models/reservoir-low.glb",
    greenhouse: "./art/moon-settlement/models/greenhouse-low.glb"
  }),
  standard: Object.freeze({
    moon: "./art/planet-hub/models/moon-standard.glb",
    terrain: "./art/planet-hub/models/moon-landing-standard.glb",
    lander: "./art/planet-hub/models/rocket-standard.glb",
    portal: "./art/planet-hub/models/portal-standard.glb",
    "solar-power": "./art/moon-settlement/models/solar-power-standard.glb",
    "lunar-power": "./art/moon-settlement/models/lunar-power-standard.glb",
    "bastion-shelter": "./art/moon-settlement/models/bastion-shelter-standard.glb",
    "hive-shelter": "./art/moon-settlement/models/hive-shelter-standard.glb",
    "haven-shelter": "./art/moon-settlement/models/haven-shelter-standard.glb",
    "beacon-signal": "./art/moon-settlement/models/beacon-signal-standard.glb",
    "stars-signal": "./art/moon-settlement/models/stars-signal-standard.glb",
    "starter-vault": "./art/moon-settlement/models/starter-vault-standard.glb",
    processor: "./art/moon-settlement/models/processor-standard.glb",
    storage: "./art/moon-settlement/models/storage-standard.glb",
    reservoir: "./art/moon-settlement/models/reservoir-standard.glb",
    greenhouse: "./art/moon-settlement/models/greenhouse-standard.glb"
  })
});

export const MOON_SETTLEMENT_PBR_ASSETS = Object.freeze({
  low: Object.freeze({
    baseColor: "./art/moon-settlement/materials/fieldkit-basecolor-low.png",
    orm: "./art/moon-settlement/materials/fieldkit-orm-low.png",
    normal: "./art/moon-settlement/materials/fieldkit-normal-low.png"
  }),
  standard: Object.freeze({
    baseColor: "./art/moon-settlement/materials/fieldkit-basecolor-standard.png",
    orm: "./art/moon-settlement/materials/fieldkit-orm-standard.png",
    normal: "./art/moon-settlement/materials/fieldkit-normal-standard.png"
  })
});

const MOON_SETTLEMENT_NORMAL_SCALE = Object.freeze({
  hull: 0.34,
  graphite: 0.28,
  regolith: 0.62,
  power: 0.24,
  material: 0.26,
  life: 0.24,
  signal: 0.22,
  matter: 0.20,
  damage: 0.38,
  solar: 0.22,
  glass: 0.08,
  soil: 0.54,
  window: 0.10,
  ceramic: 0.30,
  warm: 0.24,
  trim: 0.25
});

export const MOON_SETTLEMENT_AUTHORED_ENVELOPES = Object.freeze({
  portal: Object.freeze({ height: 4.2, radius: 1.75, hitHeight: 4.4 }),
  "solar-power": Object.freeze({ height: 2.2, radius: 1.75, hitHeight: 2.35 }),
  "lunar-power": Object.freeze({ height: 2.8, radius: 1.65, hitHeight: 3.0 }),
  "bastion-shelter": Object.freeze({ height: 3.2, radius: 1.8, hitHeight: 3.45 }),
  "hive-shelter": Object.freeze({ height: 3.8, radius: 1.8, hitHeight: 4.0 }),
  "haven-shelter": Object.freeze({ height: 3.4, radius: 1.8, hitHeight: 3.65 }),
  "beacon-signal": Object.freeze({ height: 4.8, radius: 1.5, hitHeight: 5.0 }),
  "stars-signal": Object.freeze({ height: 3.8, radius: 1.7, hitHeight: 4.0 }),
  "starter-vault": Object.freeze({ height: 2.4, radius: 1.6, hitHeight: 2.65 }),
  processor: Object.freeze({ height: 3.3, radius: 1.8, hitHeight: 3.55 }),
  storage: Object.freeze({ height: 2.7, radius: 1.8, hitHeight: 2.95 }),
  reservoir: Object.freeze({ height: 3.4, radius: 1.7, hitHeight: 3.65 }),
  greenhouse: Object.freeze({ height: 3.8, radius: 1.8, hitHeight: 4.0 })
});

const MOON_SETTLEMENT_STRUCTURE_ASSET_KEYS = Object.freeze(new Set(Object.keys(MOON_SETTLEMENT_AUTHORED_ENVELOPES)));

const DEFAULT_RENDER_STATE = Object.freeze({
  structures: Object.freeze([
    Object.freeze({
      id: "lander",
      name: "Lander",
      type: "lander",
      position: Object.freeze([-MOON_SETTLEMENT_PARCEL_CELL_SIZE, 0, -MOON_SETTLEMENT_PARCEL_CELL_SIZE]),
      status: "damaged",
      concern: "Controlled landing complete"
    })
  ]),
  weave: null
});

const TYPE_COLORS = Object.freeze({
  lander: 0xd8d2c5,
  shelter: 0xc9d8dc,
  greenhouse: 0x85b9a0,
  power: 0xd9b75f,
  signal: 0x91b7d6,
  processor: 0xc09b75,
  storage: 0xaeb5bd,
  archive: 0x9a8ec2,
  vault: 0xa5c8bb,
  plot: 0x776e66,
  unknown: 0xaeb6be
});

const ATOM_COLORS = Object.freeze({
  earth: 0x9b8c78,
  regolith: 0xa99b8d,
  dust: 0xd1bd91,
  water: 0x6eaed0,
  ice: 0xaed7e3,
  soil: 0x846650,
  life: 0x6eb58b,
  seed: 0x9eb16f,
  biomass: 0x668d68,
  food: 0xd3a65d,
  power: 0xe3c966,
  signal: 0x7bb1d3,
  air: 0x9ac8cc,
  matter: 0xad8fd1,
  support: 0xb8c1c9,
  unknown: 0xa7b0b8
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

/** Mount a local settlement coordinate onto the authored Moon's upper surface. */
export function projectMoonSettlementSurfacePosition(position = [0, 0, 0], radius = MOON_SETTLEMENT_SURFACE_RADIUS) {
  const [x, localY, z] = finitePosition(position);
  const safeRadius = Math.max(1, Number(radius) || MOON_SETTLEMENT_SURFACE_RADIUS);
  const radialSquared = Math.min(safeRadius * safeRadius, x * x + z * z);
  const radialHeight = Math.sqrt(Math.max(0, safeRadius * safeRadius - radialSquared));
  const surfaceY = radialSquared === 0 ? 0 : -radialSquared / Math.max(1e-9, radialHeight + safeRadius);
  return Object.freeze([x, localY + surfaceY, z]);
}

/** Radial up vector for a settlement-local point on the Moon. */
export function calculateMoonSettlementSurfaceNormal(position = [0, 0, 0], radius = MOON_SETTLEMENT_SURFACE_RADIUS) {
  const [x, , z] = finitePosition(position);
  const safeRadius = Math.max(1, Number(radius) || MOON_SETTLEMENT_SURFACE_RADIUS);
  const mounted = projectMoonSettlementSurfacePosition([x, 0, z], safeRadius);
  const normal = [mounted[0], mounted[1] + safeRadius, mounted[2]];
  const length = Math.hypot(...normal) || 1;
  return Object.freeze(normal.map((value) => value / length));
}

/** Deterministic tangent frame used to roll the Moon beneath the astronaut. */
export function calculateMoonSettlementSurfaceFrame(position = [0, 0, 0], radius = MOON_SETTLEMENT_SURFACE_RADIUS) {
  const point = projectMoonSettlementSurfacePosition([position?.[0], 0, position?.[2]], radius);
  const normal = calculateMoonSettlementSurfaceNormal(point, radius);
  const referenceForward = [0, 0, 1];
  const forwardDot = normal[2];
  let forward = referenceForward.map((value, axis) => value - normal[axis] * forwardDot);
  let forwardLength = Math.hypot(...forward);
  if (forwardLength <= 1e-8) {
    forward = [1, 0, 0];
    forwardLength = 1;
  }
  forward = forward.map((value) => value / forwardLength);
  const right = [
    normal[1] * forward[2] - normal[2] * forward[1],
    normal[2] * forward[0] - normal[0] * forward[2],
    normal[0] * forward[1] - normal[1] * forward[0]
  ];
  const rightLength = Math.hypot(...right) || 1;
  const unitRight = right.map((value) => value / rightLength);
  const correctedForward = [
    unitRight[1] * normal[2] - unitRight[2] * normal[1],
    unitRight[2] * normal[0] - unitRight[0] * normal[2],
    unitRight[0] * normal[1] - unitRight[1] * normal[0]
  ];
  return Object.freeze({
    point,
    right: Object.freeze(unitRight),
    normal,
    forward: Object.freeze(correctedForward)
  });
}

export function normalizeMoonSettlementQuality(value = "standard") {
  return String(value).toLowerCase() === "low" ? "low" : "standard";
}

export function normalizeMoonSettlementMode(value = "walk") {
  const mode = String(value).toLowerCase();
  return MOON_SETTLEMENT_MODES.includes(mode) ? mode : "walk";
}

export function capMoonSettlementPixelRatio(devicePixelRatio = 1, quality = "standard") {
  const profile = MOON_SETTLEMENT_QUALITY[normalizeMoonSettlementQuality(quality)];
  return Math.max(1, Math.min(profile.pixelRatio, Number(devicePixelRatio) || 1));
}

function finitePosition(value, fallback = [0, 0, 0]) {
  return [0, 1, 2].map((axis) => {
    const number = Number(value?.[axis]);
    return Number.isFinite(number) ? number : Number(fallback[axis]) || 0;
  });
}

function fallbackPosition(_id, index = 0) {
  const column = index % 3 - 1;
  const overflowRow = 4 + Math.floor(index / 3);
  return [column * MOON_SETTLEMENT_PLOT_STRIDE, 0, overflowRow * MOON_SETTLEMENT_PLOT_STRIDE];
}

function entries(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function normalizeRenderRecord(record, index = 0, kind = "structure") {
  const id = String(record?.id || record?.siteId || record?.instanceId || `${kind}-${index + 1}`);
  const type = String(record?.type || record?.kind || record?.blueprintId || kind || "unknown").toLowerCase();
  const name = String(record?.name || record?.label || record?.title || type.replaceAll("-", " "));
  return Object.freeze({
    id,
    name,
    type,
    kind,
    position: Object.freeze(finitePosition(record?.position || record?.worldPosition, fallbackPosition(id, index))),
    rotation: Number(record?.rotation) || 0,
    status: String(record?.status || (record?.active === false ? "paused" : "ready")),
    concern: String(record?.concern || record?.drift?.type || ""),
    production: String(record?.production?.label || record?.production || ""),
    siteId: String(record?.siteId || record?.slot || ""),
    siteRole: String(record?.siteRole || ""),
    cue: String(record?.cue || ""),
    labelVisibility: String(record?.labelVisibility || "context"),
    previewType: String(record?.previewType || "").toLowerCase(),
    previewAsset: String(record?.previewAsset || "").toLowerCase(),
    ports: Object.freeze(entries(record?.ports).map((port, portIndex) => Object.freeze({
      id: String(port?.id || `${id}-port-${portIndex + 1}`),
      type: String(port?.type || port?.kind || "material").toLowerCase(),
      connected: Boolean(port?.connected || port?.connectionId)
    })))
  });
}

function normalizePath(path, index = 0) {
  const sourcePoints = entries(path?.points);
  const points = (sourcePoints.length >= 2 ? sourcePoints : [path?.from, path?.to])
    .filter(Boolean)
    .map((point) => Object.freeze(finitePosition(point)));
  return Object.freeze({
    id: String(path?.id || `path-${index + 1}`),
    kind: String(path?.kind || path?.status || "active").toLowerCase(),
    points: Object.freeze(points)
  });
}

function normalizeParcel(parcel, index = 0) {
  const siteId = String(parcel?.siteId || parcel?.parcelId || `parcel-${index + 1}`);
  const status = String(parcel?.status || "placing").toLowerCase();
  return Object.freeze({
    id: String(parcel?.id || `parcel-${siteId}`),
    siteId,
    name: String(parcel?.name || `${siteId} placement parcel`),
    position: Object.freeze(finitePosition(parcel?.position)),
    cellSize: clamp(parcel?.cellSize || MOON_SETTLEMENT_PARCEL_CELL_SIZE, 0.5, 2.5),
    selected: normalizeMoonSettlementPlacement(parcel?.selected, { siteId }),
    status,
    interactive: parcel?.interactive == null ? status === "placing" : Boolean(parcel.interactive)
  });
}

function normalizeAtom(atom, index = 0) {
  const id = String(atom?.id || atom?.instanceId || `atom-${index + 1}`);
  const name = String(atom?.name || atom?.word || atom?.concept || atom?.label || "Unknown");
  const sigilSource = String(atom?.sigil || atom?.symbol || name).replace(/[^a-z0-9]/gi, "");
  const sigil = (sigilSource.slice(0, 3) || "?").replace(/^./, (letter) => letter.toUpperCase());
  const arranged = [
    Math.cos(index * Math.PI * 2 / 7) * (1.2 + (index % 2) * 0.24),
    ((index % 3) - 1) * 0.42,
    Math.sin(index * Math.PI * 2 / 7) * (1.2 + (index % 2) * 0.24)
  ];
  return Object.freeze({
    id,
    name,
    sigil,
    material: String(atom?.material || atom?.concept || atom?.word || name).toLowerCase(),
    radius: clamp(atom?.radius || 0.25, 0.16, 0.42),
    position: Object.freeze(finitePosition(atom?.position, arranged)),
    quality: String(atom?.quality || "stable").toLowerCase()
  });
}

function normalizeBond(bond, index = 0) {
  return Object.freeze({
    id: String(bond?.id || `bond-${index + 1}`),
    from: String(bond?.from || bond?.source || bond?.a || ""),
    to: String(bond?.to || bond?.target || bond?.b || ""),
    tier: ["weak", "stable", "reinforced"].includes(String(bond?.tier).toLowerCase())
      ? String(bond.tier).toLowerCase() : "stable",
    quality: String(bond?.quality || "stable").toLowerCase(),
    removed: Boolean(bond?.removed || bond?.severed || bond?.deleted || bond?.active === false)
  });
}

/** A severed draft bond must not retain either visible or picking geometry. */
export function shouldRenderMoonSettlementBond(bond = {}) {
  return !Boolean(bond?.removed || bond?.severed || bond?.deleted || bond?.active === false);
}

export function createMoonSettlementGlassMaterialOptions({ physical = true } = {}) {
  return Object.freeze({
    color: 0x8bc7ba,
    transparent: true,
    opacity: 0.42,
    roughness: 0.16,
    depthWrite: false,
    ...(physical ? { transmission: 0.16 } : {})
  });
}

export function createMoonSettlementAtomMaterialOptions({ physical = true } = {}) {
  return Object.freeze({
    roughness: 0.27,
    metalness: 0.18,
    ...(physical ? { clearcoat: 0.7, clearcoatRoughness: 0.2 } : {})
  });
}

/** Normalize presentation input without retaining mutable domain objects. */
export function normalizeMoonSettlementRenderState(state = DEFAULT_RENDER_STATE) {
  const structureSources = [
    ...entries(state?.structures),
    ...entries(state?.structureInstances),
    ...entries(state?.authoredSites).filter((site) => !site?.structureId && !site?.occupiedBy)
  ];
  const seen = new Set();
  const structures = structureSources
    .map((record, index) => normalizeRenderRecord(record, index, record?.kind || "structure"))
    .filter((record) => !seen.has(record.id) && seen.add(record.id));
  if (!structures.length) structures.push(...DEFAULT_RENDER_STATE.structures);

  const weaveSource = state?.weave || state?.weaveGraph || state?.structureDraft?.graph || state?.draft?.graph || null;
  const atoms = entries(weaveSource?.atoms || weaveSource?.nodes).slice(0, 8).map(normalizeAtom);
  const bonds = entries(weaveSource?.bonds || weaveSource?.edges).map(normalizeBond);
  const paths = entries(state?.paths).map(normalizePath).filter((path) => path.points.length >= 2);
  const parcels = entries(state?.parcels).slice(0, 12).map(normalizeParcel);
  return Object.freeze({
    revision: Math.max(0, Number(state?.revision) || 0),
    selectedId: state?.selectedId ? String(state.selectedId) : null,
    structures: Object.freeze(structures),
    paths: Object.freeze(paths),
    parcels: Object.freeze(parcels),
    weave: atoms.length ? Object.freeze({ atoms: Object.freeze(atoms), bonds: Object.freeze(bonds) }) : null
  });
}

/**
 * Low-gravity locomotion is pure so keyboard, controller, and motor assist use
 * the same bounded movement contract.
 */
export function stepMoonSettlementMovement(previous = {}, input = {}, deltaSeconds = 0) {
  const dt = clamp(deltaSeconds, 0, 0.05);
  const position = finitePosition(previous.position);
  let verticalVelocity = Number(previous.verticalVelocity) || 0;
  let grounded = previous.grounded !== false && position[1] <= 0.0001;
  const x = clamp(input.x, -1, 1);
  const z = clamp(input.z, -1, 1);
  const magnitude = Math.hypot(x, z);
  const speed = clamp(input.speed || 2.55, 0.2, 7);
  if (magnitude > 0.0001) {
    position[0] += x / Math.max(1, magnitude) * speed * dt;
    position[2] += z / Math.max(1, magnitude) * speed * dt;
  }
  if (Boolean(input.jump) && grounded) {
    verticalVelocity = 1.85;
    grounded = false;
  }
  if (!grounded) {
    verticalVelocity -= MOON_SETTLEMENT_GRAVITY * dt;
    position[1] += verticalVelocity * dt;
    if (position[1] <= 0) {
      position[1] = 0;
      verticalVelocity = 0;
      grounded = true;
    }
  }
  const boundary = clamp(input.boundary || MOON_SETTLEMENT_WALK_BOUNDARY, 1, 80);
  const groundRadius = Math.hypot(position[0], position[2]);
  if (groundRadius > boundary) {
    position[0] = position[0] / groundRadius * boundary;
    position[2] = position[2] / groundRadius * boundary;
  }
  return Object.freeze({
    position: Object.freeze(position),
    verticalVelocity,
    grounded
  });
}

/** Surface-to-surface bond geometry prevents connections obscuring atom labels. */
export function calculateMoonSettlementBondSpan(from, to, fromRadius = 0.25, toRadius = 0.25) {
  const a = finitePosition(from);
  const b = finitePosition(to);
  const delta = b.map((value, axis) => value - a[axis]);
  const distance = Math.hypot(...delta);
  if (distance <= 1e-8) return Object.freeze({ start: Object.freeze(a), end: Object.freeze(a), length: 0 });
  const direction = delta.map((value) => value / distance);
  const startInset = Math.min(distance * 0.45, Math.max(0, Number(fromRadius) || 0));
  const endInset = Math.min(distance * 0.45, Math.max(0, Number(toRadius) || 0));
  const start = a.map((value, axis) => value + direction[axis] * startInset);
  const end = b.map((value, axis) => value - direction[axis] * endInset);
  return Object.freeze({
    start: Object.freeze(start),
    end: Object.freeze(end),
    midpoint: Object.freeze(start.map((value, axis) => (value + end[axis]) * 0.5)),
    length: Math.max(0, distance - startInset - endInset)
  });
}

function targetFromObject(object) {
  let current = object || null;
  while (current) {
    if (current.userData?.moonSettlementTarget) return current.userData.moonSettlementTarget;
    current = current.parent || null;
  }
  return null;
}

/** Closest surface wins; intent priority breaks only near-equal generous hits. */
export function rankMoonSettlementRaycastHits(hits = []) {
  const priority = { atom: 0, bond: 0.012, "parcel-cell": 0.018, structure: 0.024, site: 0.03 };
  return hits
    .map((hit, index) => {
      const target = hit?.target || targetFromObject(hit?.object);
      if (!target) return null;
      const distance = Math.max(0, Number(hit?.distance) || 0);
      return { hit, target, score: distance + (priority[target.kind] ?? 0.04), index };
    })
    .filter(Boolean)
    .sort((left, right) => left.score - right.score || left.index - right.index)[0]?.target || null;
}

export async function loadMoonSettlementThree({
  importer = (specifier) => import(specifier),
  threeSpecifier = DEFAULT_MOON_SETTLEMENT_THREE_SPECIFIER,
  vendorSpecifier = DEFAULT_MOON_SETTLEMENT_VENDOR_SPECIFIER,
  loaderUrl = DEFAULT_MOON_SETTLEMENT_GLTF_LOADER_URL
} = {}) {
  let threeModule;
  try {
    threeModule = await importer(threeSpecifier);
  } catch (primaryError) {
    if (threeSpecifier === vendorSpecifier) throw primaryError;
    threeModule = await importer(vendorSpecifier);
  }
  const THREE = threeModule?.default || threeModule;
  let GLTFLoader = threeModule?.GLTFLoader || THREE?.GLTFLoader;
  if (typeof GLTFLoader !== "function") {
    const loaderModule = await importer(loaderUrl);
    GLTFLoader = loaderModule?.GLTFLoader || loaderModule?.default;
  }
  if (!THREE?.WebGLRenderer || typeof GLTFLoader !== "function") {
    throw new TypeError("The local Three.js settlement pack is unavailable.");
  }
  return Object.freeze({ THREE, GLTFLoader });
}

function resolveAssetUrl(value, baseUrl) {
  try { return new URL(value, baseUrl).href; } catch { return value; }
}

function loadGltf(loader, url) {
  if (typeof loader?.loadAsync === "function") return loader.loadAsync(url);
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

function loadTexture(loader, url) {
  if (typeof loader?.loadAsync === "function") return loader.loadAsync(url);
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

function resolveMoonSettlementMaterialRole(material) {
  const name = String(material?.name || "").toLowerCase();
  return Object.keys(MOON_SETTLEMENT_NORMAL_SCALE).find((role) => name.endsWith(`_${role}`)) || null;
}

function disposeObject(root) {
  root?.traverse?.((object) => {
    object.geometry?.dispose?.();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose?.();
      material.dispose?.();
    }
  });
}

function setTargetMetadata(root, target) {
  root.userData ||= {};
  root.userData.moonSettlementTarget = target;
  root.traverse?.((object) => {
    object.userData ||= {};
    object.userData.moonSettlementTarget = target;
  });
}

function fitModelToHeight(THREE, model, height) {
  if (typeof THREE.Box3 !== "function") {
    model.scale?.multiplyScalar?.(height);
    return model;
  }
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = height / Math.max(0.001, size.y);
  model.scale.multiplyScalar(scale);
  const scaledBounds = new THREE.Box3().setFromObject(model);
  const center = scaledBounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= scaledBounds.min.y;
  return model;
}

function materialColor(type) {
  const key = Object.keys(TYPE_COLORS).find((candidate) => String(type).includes(candidate));
  return TYPE_COLORS[key || "unknown"];
}

function atomColor(material) {
  const key = Object.keys(ATOM_COLORS).find((candidate) => String(material).includes(candidate));
  return ATOM_COLORS[key || "unknown"];
}

function boxGeometry(THREE, width, height, depth) {
  if (typeof THREE.BoxGeometry === "function") return new THREE.BoxGeometry(width, height, depth);
  const geometry = new THREE.CylinderGeometry(Math.max(width, depth) * 0.5, Math.max(width, depth) * 0.5, height, 4);
  geometry.rotateY?.(Math.PI / 4);
  return geometry;
}

function mountMoonSettlementSurfaceObject(THREE, object, position, yaw = 0, clearance = 0) {
  const mounted = projectMoonSettlementSurfacePosition(position);
  const normal = calculateMoonSettlementSurfaceNormal(mounted);
  object.position.set(
    mounted[0] + normal[0] * clearance,
    mounted[1] + normal[1] * clearance,
    mounted[2] + normal[2] * clearance
  );
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...normal));
  object.rotateY?.(Number(yaw) || 0);
  return object;
}

export function resolveMoonSettlementVisualKind(record = {}) {
  const type = String(record?.type || "unknown").toLowerCase();
  if (type === "plot") return "construction-pad";
  if (type.includes("regolith") || type.includes("sample")) return "sample";
  if (type.includes("greenhouse")) return "greenhouse";
  if (type.includes("power") || type.includes("solar")) return "power";
  if (type.includes("signal") || type.includes("beacon") || type.includes("map")) return "signal";
  if (type.includes("shelter") || type.includes("haven") || type.includes("hive") || type.includes("bastion")) return "shelter";
  if (type.includes("processor")) return "processor";
  if (type.includes("storage")) return "storage";
  if (type.includes("archive") || type.includes("reservoir")) return "reservoir";
  if (type.includes("seed-cradle") || type.includes("world-seed")) return "seed-cradle";
  if (type.includes("vault")) return "vault";
  return "generic";
}

export function resolveMoonSettlementAssetKey(record = {}) {
  const explicit = String(record?.assetVariant || record?.previewAsset || "").toLowerCase();
  if (MOON_SETTLEMENT_STRUCTURE_ASSET_KEYS.has(explicit)) return explicit;
  const type = String(record?.type === "plot" ? record?.previewType : record?.type || "").toLowerCase();
  if (MOON_SETTLEMENT_STRUCTURE_ASSET_KEYS.has(type)) return type;
  if (type.includes("processor")) return "processor";
  if (type === "storage") return "storage";
  if (type.includes("reservoir") || type === "archive") return "reservoir";
  if (type.includes("greenhouse")) return "greenhouse";
  if (type.includes("vault")) return "starter-vault";
  if (type.includes("seed-cradle") || type.includes("world-seed") || type.includes("portal")) return "portal";
  return null;
}

function createStructureVisual(THREE, record, radialSegments) {
  const root = new THREE.Group();
  const color = materialColor(record.type);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.12 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x8ac3be, roughness: 0.4, metalness: 0.35 });
  const add = (geometry, usedMaterial = material, position = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, usedMaterial);
    mesh.position.set(...position);
    root.add(mesh);
    return mesh;
  };
  const box = (width, height, depth) => {
    return boxGeometry(THREE, width, height, depth);
  };
  const visualKind = resolveMoonSettlementVisualKind(record);
  root.userData.moonSettlementVisualKind = visualKind;
  if (visualKind === "construction-pad") {
    const padMaterial = new THREE.MeshStandardMaterial({ color: 0x425659, roughness: 0.78, metalness: 0.22 });
    const guideMaterial = new THREE.MeshStandardMaterial({
      color: 0x7de6de,
      emissive: 0x173d3b,
      roughness: 0.34,
      metalness: 0.42,
      transparent: true,
      opacity: 0.82,
      depthWrite: false
    });
    add(new THREE.CylinderGeometry(0.78, 0.86, 0.055, radialSegments), padMaterial, [0, 0.028, 0]);
    const ring = add(new THREE.TorusGeometry(0.63, 0.035, 8, radialSegments), guideMaterial, [0, 0.066, 0]);
    ring.rotation.x = Math.PI / 2;
    for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
      add(new THREE.CylinderGeometry(0.055, 0.07, 0.08, 10), guideMaterial, [Math.cos(angle) * 0.54, 0.08, Math.sin(angle) * 0.54]);
    }
    if (record.previewType && !resolveMoonSettlementAssetKey(record) && record.previewType !== "plot") {
      const preview = createStructureVisual(THREE, {
        ...record,
        type: record.previewType,
        previewType: "",
        position: [0, 0, 0],
        rotation: 0
      }, radialSegments);
      preview.scale.setScalar?.(0.68);
      preview.position.y = 0.08;
      preview.traverse?.((object) => {
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        for (const previewMaterial of materials) {
          previewMaterial.transparent = true;
          previewMaterial.opacity = 0.24;
          previewMaterial.depthWrite = false;
          if (previewMaterial.emissive?.setHex) previewMaterial.emissive.setHex(0x1d6a64);
          previewMaterial.needsUpdate = true;
        }
      });
      root.add(preview);
    }
  } else if (visualKind === "sample") {
    const rockMaterial = new THREE.MeshBasicMaterial({ color: 0x8f8a81, toneMapped: false });
    const rock = add(new THREE.SphereGeometry(0.3, 8, 5), rockMaterial, [0, 0.24, 0]);
    root.userData.moonSettlementLabelAnchor = rock;
    rock.scale.set(1.14, 0.8, 0.96);
    rock.rotation.set(0.18, 0.42, -0.12);
    const facets = add(new THREE.SphereGeometry(0.304, 8, 5), new THREE.MeshBasicMaterial({
      color: 0x4f4b45,
      transparent: true,
      opacity: 0.34,
      wireframe: true,
      toneMapped: false
    }), [0, 0.24, 0]);
    facets.scale.copy(rock.scale);
    facets.rotation.copy(rock.rotation);
    const sampleAccent = new THREE.MeshStandardMaterial({
      color: 0xc7a76a,
      emissive: 0x4f3412,
      emissiveIntensity: 0.38,
      roughness: 0.72,
      metalness: 0.04
    });
    const seam = add(new THREE.TorusGeometry(0.115, 0.011, 6, 16, Math.PI * 1.18), sampleAccent, [0.085, 0.28, 0.24]);
    seam.rotation.set(Math.PI / 2.3, 0, -0.36);
  } else if (visualKind === "greenhouse") {
    add(new THREE.CylinderGeometry(0.62, 0.72, 0.22, radialSegments), material, [0, 0.11, 0]);
    const hasPhysicalMaterial = typeof THREE.MeshPhysicalMaterial === "function";
    const GlassMaterial = hasPhysicalMaterial ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const glass = new GlassMaterial(createMoonSettlementGlassMaterialOptions({ physical: hasPhysicalMaterial }));
    add(new THREE.SphereGeometry(0.61, radialSegments, Math.max(10, radialSegments / 2), 0, Math.PI * 2, 0, Math.PI / 2), glass, [0, 0.2, 0]);
  } else if (visualKind === "power") {
    const mast = add(new THREE.CylinderGeometry(0.08, 0.12, 0.7, 10), accent, [0, 0.35, 0]);
    mast.rotation.z = 0.08;
    for (const offset of [-0.43, 0.43]) {
      const panel = add(box(0.72, 0.05, 0.74), new THREE.MeshStandardMaterial({ color: 0x294963, roughness: 0.34, metalness: 0.5 }), [offset, 0.64, 0]);
      panel.rotation.z = offset < 0 ? -0.1 : 0.1;
    }
  } else if (visualKind === "signal") {
    add(new THREE.CylinderGeometry(0.12, 0.2, 1.2, 12), material, [0, 0.6, 0]);
    add(new THREE.TorusGeometry(0.36, 0.045, 8, radialSegments), accent, [0, 1.05, 0]).rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.13, 12, 8), accent, [0, 1.22, 0]);
  } else if (visualKind === "shelter") {
    add(new THREE.CylinderGeometry(0.72, 0.84, 0.45, radialSegments), material, [0, 0.225, 0]);
    add(new THREE.SphereGeometry(0.72, radialSegments, Math.max(10, radialSegments / 2), 0, Math.PI * 2, 0, Math.PI / 2), material, [0, 0.44, 0]);
    add(box(0.42, 0.5, 0.12), accent, [0, 0.28, 0.72]);
  } else if (visualKind === "processor") {
    add(new THREE.CylinderGeometry(0.48, 0.58, 0.9, radialSegments), material, [0, 0.45, 0]);
    add(new THREE.TorusGeometry(0.5, 0.055, 8, radialSegments), accent, [0, 0.58, 0]).rotation.x = Math.PI / 2;
  } else if (visualKind === "storage") {
    add(new THREE.CylinderGeometry(0.66, 0.72, 0.16, radialSegments), material, [0, 0.08, 0]);
    for (const offset of [-0.34, 0, 0.34]) {
      add(new THREE.CylinderGeometry(0.16, 0.2, 0.72, 12), offset === 0 ? accent : material, [offset, 0.43, 0]);
      const collar = add(new THREE.TorusGeometry(0.17, 0.025, 7, 14), accent, [offset, 0.55, 0]);
      collar.rotation.x = Math.PI / 2;
    }
  } else if (visualKind === "reservoir") {
    const CoreGeometry = THREE.OctahedronGeometry || THREE.SphereGeometry;
    add(new CoreGeometry(0.55, radialSegments, Math.max(10, radialSegments / 2)), material, [0, 0.62, 0]);
    add(new THREE.TorusGeometry(0.62, 0.035, 8, radialSegments), accent, [0, 0.62, 0]).rotation.x = Math.PI / 2;
  } else if (visualKind === "seed-cradle") {
    const arch = add(new THREE.TorusGeometry(0.54, 0.075, 10, radialSegments, Math.PI * 1.65), material, [0, 0.62, 0]);
    arch.rotation.z = Math.PI * 0.18;
    add(new THREE.SphereGeometry(0.2, radialSegments, Math.max(10, radialSegments / 2)), accent, [0, 0.62, 0]);
    add(new THREE.CylinderGeometry(0.48, 0.58, 0.12, radialSegments), material, [0, 0.06, 0]);
  } else if (visualKind === "vault") {
    add(new THREE.CylinderGeometry(0.48, 0.58, 0.22, radialSegments), material, [0, 0.11, 0]);
    const capsule = add(new THREE.SphereGeometry(0.43, radialSegments, Math.max(10, radialSegments / 2)), material, [0, 0.47, 0]);
    capsule.scale.y = 0.72;
    const seal = add(new THREE.TorusGeometry(0.28, 0.045, 8, radialSegments), accent, [0, 0.48, 0.29]);
    seal.rotation.x = Math.PI / 2;
  } else {
    add(box(0.82, 0.58, 0.82), material, [0, 0.29, 0]);
    add(box(0.48, 0.18, 0.48), accent, [0, 0.67, 0]);
  }
  root.position.set(...record.position);
  root.rotation.y = record.rotation;
  root.name = `moon-settlement-${record.id}`;
  return root;
}

function createLabelElement(documentRef, target, onSelect, onInspect = onSelect) {
  const label = documentRef.createElement("button");
  label.type = "button";
  label.className = `moon-settlement-label moon-settlement-label--${target.kind}`;
  label.dataset.settlementTarget = target.id;
  label.dataset.settlementKind = target.kind;
  label.dataset.settlementCue = target.cue || "";
  label.dataset.settlementLabel = target.name;
  label.dataset.settlementLabelVisibility = target.labelVisibility || "context";
  // Structure names are expanded by the crisp DOM ::after label. Keeping the
  // button itself text-free prevents the accessible name and visual label from
  // being painted twice when a structure is focused or is the objective.
  label.textContent = target.kind === "atom" ? target.sigil : "";
  label.setAttribute("aria-label", target.kind === "atom" ? `${target.name}, atom` : target.name);
  if (target.cue === "objective") label.setAttribute("aria-current", "step");
  label.addEventListener?.("pointerdown", (event) => event.stopPropagation?.());
  label.addEventListener?.("click", (event) => onSelect(target, { source: "label", originalEvent: event }));
  label.addEventListener?.("dblclick", (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    onInspect(target, { source: "label", originalEvent: event });
  });
  return label;
}

function createFallbackBackend({
  host,
  labelLayer,
  documentRef,
  posterUrl,
  assetBaseUrl,
  onSelect,
  onInspect
}) {
  host.classList?.add?.("moon-settlement-renderer--fallback");
  const root = documentRef.createElement("div");
  root.className = "moon-settlement-fallback";
  root.dataset.settlementBackend = "2.5d";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Moon settlement 2.5D view");
  const image = documentRef.createElement("img");
  image.className = "moon-settlement-fallback__image";
  image.src = resolveAssetUrl(posterUrl, assetBaseUrl);
  image.alt = "Moon landing ground with the expedition lander";
  const hotspots = documentRef.createElement("div");
  hotspots.className = "moon-settlement-fallback__hotspots";
  root.append?.(image, hotspots);
  host.append?.(root);
  if (!root.parentElement && host.appendChild) host.appendChild(root);
  let state = normalizeMoonSettlementRenderState();
  let mode = "walk";
  let focusedId = null;
  const listeners = [];

  function addHotspot(record, index, kind = "structure") {
    const button = documentRef.createElement("button");
    const x = clamp(50 + record.position[0] * 2.6, 12, 88);
    const y = clamp(28 + record.position[2] * 1.9 - record.position[1] * 4, 14, 86);
    button.type = "button";
    button.className = `moon-settlement-fallback__hotspot moon-settlement-fallback__hotspot--${kind}`;
    button.dataset.settlementTarget = record.id;
    button.dataset.settlementKind = kind;
    button.dataset.settlementStatus = record.status || record.quality || "stable";
    button.dataset.settlementCue = record.cue || "";
    button.dataset.settlementLabel = record.name;
    button.dataset.settlementLabelVisibility = record.labelVisibility || "context";
    button.style?.setProperty?.("--settlement-x", `${x.toFixed(2)}%`);
    button.style?.setProperty?.("--settlement-y", `${y.toFixed(2)}%`);
    button.textContent = kind === "atom" ? record.sigil : kind === "parcel-cell" ? record.label : kind === "structure" ? "" : record.name;
    button.setAttribute("aria-label", kind === "atom" ? `${record.name}, atom` : record.name);
    if (kind === "parcel-cell") {
      button.dataset.placementValid = String(record.valid);
      button.setAttribute("aria-pressed", String(record.selected));
      if (!record.valid) button.setAttribute("aria-disabled", "true");
    }
    if (record.cue === "objective") button.setAttribute("aria-current", "step");
    const target = Object.freeze({ ...record, kind });
    const select = () => onSelect(target, { source: "fallback" });
    const inspect = () => onInspect(target, { source: "fallback" });
    button.addEventListener?.("click", select);
    button.addEventListener?.("dblclick", inspect);
    listeners.push([button, "click", select], [button, "dblclick", inspect]);
    hotspots.append?.(button);
    if (!button.parentElement && hotspots.appendChild) hotspots.appendChild(button);
  }

  function sync(nextState) {
    state = normalizeMoonSettlementRenderState(nextState);
    for (const [element, type, listener] of listeners.splice(0)) {
      element.removeEventListener?.(type, listener);
    }
    if (typeof hotspots.replaceChildren === "function") hotspots.replaceChildren();
    else {
      while (hotspots.firstChild) hotspots.removeChild?.(hotspots.firstChild);
      if (Array.isArray(hotspots.children)) hotspots.children.length = 0;
    }
    const records = mode === "weave" && state.weave ? state.weave.atoms : state.structures;
    records.forEach((record, index) => addHotspot(record, index, mode === "weave" ? "atom" : "structure"));
    if (mode !== "weave") {
      for (const parcel of state.parcels.filter((entry) => entry.interactive)) {
        createMoonSettlementParcelCells(parcel).forEach((cell, index) => {
          const position = [
            parcel.position[0] + cell.localPosition[0],
            parcel.position[1],
            parcel.position[2] + cell.localPosition[2]
          ];
          addHotspot({
            ...cell,
            name: `${parcel.name}, cell ${cell.label}${cell.valid ? "" : ", outside buildable footprint"}`,
            parcelId: parcel.siteId,
            position,
            rotationQuarter: parcel.selected.rotationQuarter
          }, index, "parcel-cell");
        });
      }
    }
    root.dataset.settlementRevision = String(state.revision);
    return state;
  }

  sync(state);
  if (labelLayer?.dataset) labelLayer.dataset.settlementLabels = "fallback-hotspots";
  return Object.freeze({
    backend: "2.5d",
    sync,
    render: () => true,
    resize: () => true,
    setMode(nextMode) {
      mode = normalizeMoonSettlementMode(nextMode);
      root.dataset.settlementMode = mode;
      sync(state);
      return mode;
    },
    focus(target) {
      focusedId = typeof target === "string" ? target : target?.id || null;
      root.dataset.settlementFocus = focusedId || "";
      for (const button of hotspots.children || []) {
        button.classList?.toggle?.("is-focused", button.dataset?.settlementTarget === focusedId);
      }
      return Boolean(focusedId);
    },
    quality(value) {
      root.dataset.settlementQuality = normalizeMoonSettlementQuality(value);
      return root.dataset.settlementQuality;
    },
    reducedMotion(value) {
      root.dataset.settlementReducedMotion = String(Boolean(value));
      return Boolean(value);
    },
    dispose() {
      for (const [element, type, listener] of listeners) element.removeEventListener?.(type, listener);
      root.remove?.();
      host.classList?.remove?.("moon-settlement-renderer--fallback");
      delete labelLayer?.dataset?.settlementLabels;
    }
  });
}

async function createThreeBackend({
  host,
  labelLayer,
  documentRef,
  windowRef,
  modules,
  quality,
  reducedMotion,
  assetBaseUrl,
  assets,
  onSelect,
  onMove,
  onInspect,
  onModeChange
}) {
  const { THREE, GLTFLoader } = modules;
  const canvas = documentRef.createElement("canvas");
  canvas.className = "moon-settlement-renderer__canvas";
  canvas.dataset.settlementBackend = "three";
  canvas.setAttribute("aria-hidden", "true");
  host.prepend?.(canvas);
  if (!canvas.parentElement && host.appendChild) host.appendChild(canvas);
  host.classList?.add?.("moon-settlement-renderer--three");
  if (!host.hasAttribute?.("tabindex")) host.setAttribute?.("tabindex", "0");

  let activeQuality = normalizeMoonSettlementQuality(quality);
  let motionReduced = Boolean(reducedMotion);
  let mode = "walk";
  let renderState = normalizeMoonSettlementRenderState();
  let selectedId = null;
  let focusedId = null;
  let hoveredId = null;
  let disposed = false;
  let frameRequest = 0;
  let lastFrameAt = 0;
  let orbitYaw = 0.74;
  let orbitPitch = 0.67;
  let orbitDistance = 16.5;
  let pointerGesture = null;
  let jumpQueued = false;
  let movement = { position: Object.freeze([0, 0, 0]), verticalVelocity: 0, grounded: true };
  const keys = new Set();
  const listeners = [];
  const targetRoots = new Map();
  const labelRecords = new Map();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: activeQuality === "standard",
      powerPreference: activeQuality === "standard" ? "high-performance" : "low-power"
    });
  } catch (error) {
    canvas.remove?.();
    host.classList?.remove?.("moon-settlement-renderer--three");
    throw error;
  }
  renderer.setClearColor?.(0x03080c, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = activeQuality === "standard" ? 1.02 : 1.08;
  renderer.shadowMap.enabled = MOON_SETTLEMENT_QUALITY[activeQuality].shadowMap;
  if (renderer.shadowMap && THREE.PCFShadowMap != null) renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  // The Moon is airless: distance comes from scale, shadows, and surface
  // detail rather than atmospheric fog.
  const camera = new THREE.PerspectiveCamera(38, 1, 0.06, 320);
  camera.up.set(0, 1, 0);
  const physicalRoot = new THREE.Group();
  physicalRoot.name = "moon-settlement-physical";
  const globePivot = new THREE.Group();
  globePivot.name = "moon-settlement-globe-pivot";
  globePivot.position.set(0, -MOON_SETTLEMENT_SURFACE_RADIUS, 0);
  const globeSurfaceRoot = new THREE.Group();
  globeSurfaceRoot.name = "moon-settlement-globe-surface";
  globeSurfaceRoot.position.set(0, MOON_SETTLEMENT_SURFACE_RADIUS, 0);
  const structureRoot = new THREE.Group();
  structureRoot.name = "moon-settlement-structures";
  const pathRoot = new THREE.Group();
  pathRoot.name = "moon-settlement-paths";
  const parcelRoot = new THREE.Group();
  parcelRoot.name = "moon-settlement-parcels";
  const weaveRoot = new THREE.Group();
  weaveRoot.name = "moon-settlement-weave";
  weaveRoot.visible = false;
  scene.add(physicalRoot, weaveRoot);
  physicalRoot.add(globePivot);
  globePivot.add(globeSurfaceRoot);
  globeSurfaceRoot.add(pathRoot, parcelRoot, structureRoot);

  scene.add(new THREE.HemisphereLight(0x9bb6c2, 0x151216, 0.42));
  const sunlight = new THREE.DirectionalLight(0xfff5e8, 2.75);
  sunlight.position.set(-18, 28, 20);
  sunlight.castShadow = activeQuality === "standard";
  sunlight.shadow?.mapSize?.set?.(2048, 2048);
  if (sunlight.shadow) {
    sunlight.shadow.bias = -0.00025;
    sunlight.shadow.normalBias = 0.018;
    sunlight.shadow.radius = 2;
    const shadowCamera = sunlight.shadow.camera;
    if (shadowCamera) {
      shadowCamera.left = -24;
      shadowCamera.right = 24;
      shadowCamera.top = 24;
      shadowCamera.bottom = -24;
      shadowCamera.near = 0.2;
      shadowCamera.far = 90;
      shadowCamera.updateProjectionMatrix?.();
    }
  }
  scene.add(sunlight, sunlight.target);
  const fill = new THREE.DirectionalLight(0x5f8ba6, 0.28);
  fill.position.set(7, 3, -5);
  scene.add(fill);

  const avatar = new THREE.Group();
  avatar.name = "moon-settlement-astronaut";
  const suitMaterial = new THREE.MeshStandardMaterial({ color: 0xe6e2d7, roughness: 0.48, metalness: 0.08 });
  const suit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.3, 1.12, 14),
    suitMaterial
  );
  suit.position.y = 0.73;
  suit.castShadow = activeQuality === "standard";
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 18, 12),
    suitMaterial
  );
  helmet.position.y = 1.49;
  helmet.castShadow = activeQuality === "standard";
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.245, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ color: 0x243640, roughness: 0.16, metalness: 0.64 })
  );
  visor.position.set(0, 1.5, 0.11);
  visor.castShadow = activeQuality === "standard";
  const backpack = new THREE.Mesh(boxGeometry(THREE, 0.42, 0.68, 0.24), suitMaterial);
  backpack.position.set(0, 0.94, -0.24);
  backpack.castShadow = activeQuality === "standard";
  const bootMaterial = new THREE.MeshStandardMaterial({ color: 0x343b3e, roughness: 0.72, metalness: 0.12 });
  const boots = [-0.14, 0.14].map((offset) => {
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.24, 10), bootMaterial);
    boot.position.set(offset, 0.12, 0.025);
    boot.castShadow = activeQuality === "standard";
    return boot;
  });
  avatar.add(suit, helmet, visor, backpack, ...boots);
  avatar.position.y = MOON_SETTLEMENT_WALK_CLEARANCE;
  physicalRoot.add(avatar);

  const loader = new GLTFLoader();
  let authoredLander = null;
  const authoredModels = new Map();
  const selectedAssets = assets?.[activeQuality] || assets || MOON_SETTLEMENT_ASSETS[activeQuality];
  const usesSettlementKit = Object.keys(selectedAssets || {}).some((key) => MOON_SETTLEMENT_STRUCTURE_ASSET_KEYS.has(key));
  const embeddedTextureFallbacks = new Set();
  let sharedPbr = null;
  if (usesSettlementKit && typeof THREE.TextureLoader === "function") {
    const pbrProfile = MOON_SETTLEMENT_PBR_ASSETS[activeQuality];
    const textureLoader = new THREE.TextureLoader();
    try {
      const [baseColor, orm, normal] = await Promise.all([
        loadTexture(textureLoader, resolveAssetUrl(pbrProfile.baseColor, assetBaseUrl)),
        loadTexture(textureLoader, resolveAssetUrl(pbrProfile.orm, assetBaseUrl)),
        loadTexture(textureLoader, resolveAssetUrl(pbrProfile.normal, assetBaseUrl))
      ]);
      const maximumAnisotropy = Math.max(1, Number(renderer.capabilities?.getMaxAnisotropy?.()) || 1);
      for (const texture of [baseColor, orm, normal]) {
        texture.flipY = false;
        texture.anisotropy = Math.min(4, maximumAnisotropy);
        texture.needsUpdate = true;
      }
      baseColor.colorSpace = THREE.SRGBColorSpace;
      sharedPbr = Object.freeze({ baseColor, orm, normal });
    } catch {
      sharedPbr = null;
    }
  }
  const applySharedPbr = (model) => {
    if (!model || !sharedPbr) return false;
    let applied = false;
    model.traverse?.((object) => {
      if (!object.isMesh) return;
      const usedMaterials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const material of usedMaterials) {
        const role = resolveMoonSettlementMaterialRole(material);
        if (!role || !material?.isMeshStandardMaterial) continue;
        for (const oldTexture of [material.map, material.roughnessMap, material.metalnessMap, material.normalMap]) {
          if (oldTexture && !Object.values(sharedPbr).includes(oldTexture)) embeddedTextureFallbacks.add(oldTexture);
        }
        material.map = sharedPbr.baseColor;
        material.roughnessMap = sharedPbr.orm;
        material.metalnessMap = sharedPbr.orm;
        material.normalMap = sharedPbr.normal;
        material.color?.set?.(0xffffff);
        material.roughness = 1;
        material.metalness = 1;
        const normalScale = MOON_SETTLEMENT_NORMAL_SCALE[role];
        const normalY = object.geometry?.attributes?.tangent ? normalScale : -normalScale;
        material.normalScale = new THREE.Vector2(normalScale, normalY);
        material.needsUpdate = true;
        applied = true;
      }
    });
    return applied;
  };
  const loadAsset = async (key) => {
    const url = resolveAssetUrl(selectedAssets?.[key], assetBaseUrl);
    if (!url) return null;
    try { return (await loadGltf(loader, url))?.scene || null; } catch { return null; }
  };
  const loadedAssets = new Map(await Promise.all(Object.keys(selectedAssets || {}).map(async (key) => (
    [key, await loadAsset(key)]
  ))));
  const moonModel = loadedAssets.get("moon");
  const terrainModel = loadedAssets.get("terrain");
  const landerModel = loadedAssets.get("lander");
  if (moonModel) {
    fitModelToHeight(THREE, moonModel, MOON_SETTLEMENT_SURFACE_RADIUS * 2);
    const moonAnchor = new THREE.Group();
    moonAnchor.name = "moon-settlement-authored-moon";
    moonAnchor.add(moonModel);
    moonAnchor.position.set(0, -MOON_SETTLEMENT_SURFACE_RADIUS * 2, 0);
    moonModel.traverse?.((object) => {
      if (object.isMesh) {
        object.receiveShadow = activeQuality === "standard";
        object.castShadow = false;
      }
    });
    globeSurfaceRoot.add(moonAnchor);
  } else {
    const fallbackMoon = new THREE.Mesh(
      new THREE.SphereGeometry(
        MOON_SETTLEMENT_SURFACE_RADIUS,
        activeQuality === "standard" ? 96 : 56,
        activeQuality === "standard" ? 64 : 36
      ),
      new THREE.MeshStandardMaterial({ color: 0x5c5a58, roughness: 0.97, metalness: 0.02 })
    );
    fallbackMoon.position.y = -MOON_SETTLEMENT_SURFACE_RADIUS;
    fallbackMoon.receiveShadow = activeQuality === "standard";
    fallbackMoon.name = "moon-settlement-fallback-moon";
    globeSurfaceRoot.add(fallbackMoon);
  }
  // Planet-scale meshes cannot provide centimetre-accurate footing around a
  // human-scale settlement. This surveyed regolith patch follows the same
  // spherical chart as movement and plots, then hands back to the full Moon
  // well beyond the playable boundary.
  const localTerrainGeometry = new THREE.PlaneGeometry(
    MOON_SETTLEMENT_LOCAL_TERRAIN_SIZE,
    MOON_SETTLEMENT_LOCAL_TERRAIN_SIZE,
    MOON_SETTLEMENT_LOCAL_TERRAIN_SEGMENTS,
    MOON_SETTLEMENT_LOCAL_TERRAIN_SEGMENTS
  );
  localTerrainGeometry.rotateX(-Math.PI / 2);
  const localTerrainPositions = localTerrainGeometry.attributes?.position;
  if (localTerrainPositions) {
    for (let index = 0; index < localTerrainPositions.count; index += 1) {
      const x = localTerrainPositions.getX(index);
      const z = localTerrainPositions.getZ(index);
      const [, surfaceY] = projectMoonSettlementSurfacePosition([x, 0, z]);
      const microRelief = Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.008;
      localTerrainPositions.setY(index, surfaceY + microRelief + 0.006);
    }
    localTerrainPositions.needsUpdate = true;
    localTerrainGeometry.computeVertexNormals?.();
  }
  const localTerrain = new THREE.Mesh(
    localTerrainGeometry,
    new THREE.MeshStandardMaterial({ color: 0x4d5052, roughness: 0.99, metalness: 0.01 })
  );
  localTerrain.name = "moon-settlement-surveyed-regolith";
  localTerrain.receiveShadow = activeQuality === "standard";
  globeSurfaceRoot.add(localTerrain);
  if (terrainModel) {
    // The shipped Moon landing model is a detailed authored pad, not a whole
    // terrain tile. Keep its physical proportions beside the lander while the
    // authored Moon supplies the walkable world beneath it.
    fitModelToHeight(THREE, terrainModel, 0.82);
    const terrainAnchor = new THREE.Group();
    terrainAnchor.name = "moon-settlement-landing-pad";
    terrainAnchor.add(terrainModel);
    mountMoonSettlementSurfaceObject(THREE, terrainAnchor, [-MOON_SETTLEMENT_PARCEL_CELL_SIZE, -0.02, -MOON_SETTLEMENT_PARCEL_CELL_SIZE], 0, 0.01);
    terrainModel.traverse?.((object) => {
      if (object.isMesh) {
        object.receiveShadow = activeQuality === "standard";
        object.castShadow = false;
      }
    });
    globeSurfaceRoot.add(terrainAnchor);
  }
  if (landerModel) {
    fitModelToHeight(THREE, landerModel, 5.2);
    const landerAnchor = new THREE.Group();
    landerAnchor.name = "moon-settlement-authored-lander";
    landerAnchor.add(landerModel);
    mountMoonSettlementSurfaceObject(THREE, landerAnchor, [-MOON_SETTLEMENT_PARCEL_CELL_SIZE, 0, -MOON_SETTLEMENT_PARCEL_CELL_SIZE]);
    landerModel.traverse?.((object) => {
      if (object.isMesh) object.castShadow = activeQuality === "standard";
    });
    globeSurfaceRoot.add(landerAnchor);
    authoredLander = landerAnchor;
  }
  const prepareAuthoredStructure = (key, model, envelope) => {
    if (!model) return;
    applySharedPbr(model);
    fitModelToHeight(THREE, model, envelope.height);
    const anchor = new THREE.Group();
    anchor.name = `moon-settlement-authored-${key}`;
    anchor.add(model);
    const seenMaterials = new Set();
    const materials = [];
    model.traverse?.((object) => {
      const usedMaterials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      if (object.isMesh) {
        const opaque = usedMaterials.every((usedMaterial) => (
          !usedMaterial?.transparent && Number(usedMaterial?.opacity ?? 1) >= 0.999
        ));
        object.castShadow = activeQuality === "standard" && opaque;
        object.receiveShadow = activeQuality === "standard" && opaque;
      }
      for (const usedMaterial of usedMaterials) {
        if (seenMaterials.has(usedMaterial)) continue;
        seenMaterials.add(usedMaterial);
        materials.push({
          material: usedMaterial,
          opacity: usedMaterial.opacity,
          transparent: usedMaterial.transparent,
          depthWrite: usedMaterial.depthWrite
        });
      }
    });
    anchor.visible = false;
    globeSurfaceRoot.add(anchor);
    authoredModels.set(key, {
      model: anchor,
      materials,
      envelope,
      labelAnchor: model.getObjectByName?.("LABEL_ANCHOR") || anchor
    });
  };
  for (const [key, envelope] of Object.entries(MOON_SETTLEMENT_AUTHORED_ENVELOPES)) {
    prepareAuthoredStructure(key, loadedAssets.get(key), envelope);
  }
  for (const texture of embeddedTextureFallbacks) texture.dispose?.();

  const selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.48, 0.58, 40),
    new THREE.MeshBasicMaterial({ color: 0x8bd8cb, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
  );
  selectionRing.position.y = 0.025;
  selectionRing.visible = false;
  scene.add(selectionRing);

  const currentCameraTarget = new THREE.Vector3(0, 0.35, 0);
  const desiredCameraTarget = new THREE.Vector3(0, 0.35, 0);
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.12;

  function addListener(element, type, listener, options) {
    element?.addEventListener?.(type, listener, options);
    listeners.push([element, type, listener, options]);
  }

  function clearLabels() {
    for (const { element } of labelRecords.values()) element.remove?.();
    labelRecords.clear();
  }

  function registerTarget(root, target, labelAnchor = root) {
    setTargetMetadata(root, target);
    targetRoots.set(target.id, { root, target, labelAnchor });
    const element = createLabelElement(documentRef, target, selectTarget, inspectTarget);
    labelLayer?.append?.(element);
    if (!element.parentElement && labelLayer?.appendChild) labelLayer.appendChild(element);
    labelRecords.set(target.id, { element, anchor: labelAnchor, root, target });
  }

  function clearGroup(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      disposeObject(child);
    }
  }

  function resetAuthoredModels() {
    for (const { model, materials } of authoredModels.values()) {
      model.visible = false;
      for (const snapshot of materials) {
        snapshot.material.opacity = snapshot.opacity;
        snapshot.material.transparent = snapshot.transparent;
        snapshot.material.depthWrite = snapshot.depthWrite;
        snapshot.material.needsUpdate = true;
      }
    }
  }

  function useAuthoredModel(key, record, { preview = false } = {}) {
    const entry = authoredModels.get(key);
    if (!entry) return null;
    entry.model.visible = true;
    mountMoonSettlementSurfaceObject(THREE, entry.model, record.position, record.rotation);
    entry.model.userData.moonSettlementEnvelope = entry.envelope;
    entry.model.userData.moonSettlementLabelAnchor = entry.labelAnchor;
    for (const snapshot of entry.materials) {
      snapshot.material.opacity = preview ? 0.3 : snapshot.opacity;
      snapshot.material.transparent = preview || snapshot.transparent;
      snapshot.material.depthWrite = preview ? false : snapshot.depthWrite;
      snapshot.material.needsUpdate = true;
    }
    return entry.model;
  }

  function addHitProxy(record, target, { radius = 0.84, height = 1.45, hitHeight = null } = {}) {
    const resolvedHeight = Number(hitHeight) || height;
    const hitProxy = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, resolvedHeight, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    mountMoonSettlementSurfaceObject(THREE, hitProxy, record.position, record.rotation, resolvedHeight * 0.5);
    setTargetMetadata(hitProxy, target);
    structureRoot.add(hitProxy);
  }

  function rebuildPaths() {
    clearGroup(pathRoot);
    for (const path of renderState.paths) {
      const material = new THREE.MeshStandardMaterial({
        color: path.kind === "objective" ? 0x78eadf : 0x658f91,
        emissive: path.kind === "objective" ? 0x174944 : 0x0b2022,
        roughness: 0.58,
        metalness: 0.3,
        transparent: true,
        opacity: path.kind === "objective" ? 0.86 : 0.52,
        depthWrite: false
      });
      for (let index = 1; index < path.points.length; index += 1) {
        const localFrom = path.points[index - 1];
        const localTo = path.points[index];
        const horizontalLength = Math.hypot(localTo[0] - localFrom[0], localTo[2] - localFrom[2]);
        const steps = Math.max(1, Math.ceil(horizontalLength / MOON_SETTLEMENT_PARCEL_CELL_SIZE));
        for (let step = 1; step <= steps; step += 1) {
          const startRatio = (step - 1) / steps;
          const endRatio = step / steps;
          const localPoint = (ratio) => [
            localFrom[0] + (localTo[0] - localFrom[0]) * ratio,
            localFrom[1] + (localTo[1] - localFrom[1]) * ratio,
            localFrom[2] + (localTo[2] - localFrom[2]) * ratio
          ];
          const from = projectMoonSettlementSurfacePosition(localPoint(startRatio));
          const to = projectMoonSettlementSurfacePosition(localPoint(endRatio));
          const dx = to[0] - from[0];
          const dy = to[1] - from[1];
          const dz = to[2] - from[2];
          const length = Math.hypot(dx, dy, dz);
          if (length < 0.02) continue;
          const segment = new THREE.Mesh(boxGeometry(THREE, path.kind === "objective" ? 0.11 : 0.075, 0.025, length), material);
          const midpoint = new THREE.Vector3(
            (from[0] + to[0]) * 0.5,
            (from[1] + to[1]) * 0.5,
            (from[2] + to[2]) * 0.5
          );
          const up = new THREE.Vector3(...calculateMoonSettlementSurfaceNormal(midpoint));
          const forward = new THREE.Vector3(dx, dy, dz).normalize();
          const right = new THREE.Vector3().crossVectors(up, forward).normalize();
          const correctedUp = new THREE.Vector3().crossVectors(forward, right).normalize();
          segment.position.copy(midpoint).addScaledVector(correctedUp, 0.035);
          segment.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, correctedUp, forward));
          segment.receiveShadow = false;
          pathRoot.add(segment);
        }
      }
    }
  }

  function rebuildParcels() {
    clearGroup(parcelRoot);
    for (const parcel of renderState.parcels) {
      const plotWidth = parcel.cellSize * 5;
      const plotRoot = new THREE.Group();
      plotRoot.name = `moon-settlement-${parcel.id}-surface`;
      mountMoonSettlementSurfaceObject(THREE, plotRoot, parcel.position, 0, 0.018);
      const plotPalette = {
        planned: { base: 0x303936, grid: 0x75827f, edge: 0x9aa6a3 },
        occupied: { base: 0x38534c, grid: 0x9cb4ae, edge: 0xbdd0cb },
        reserved: { base: 0x24262c, grid: 0x5e626b, edge: 0x747984 },
        placing: { base: 0x225b53, grid: 0x87e6dc, edge: 0xb4fff6 }
      };
      const palette = plotPalette[parcel.status] || plotPalette.planned;
      let plotMaterial;
      if (typeof THREE.DataTexture === "function") {
        const textureSize = 160;
        const pixels = new Uint8Array(textureSize * textureSize * 4);
        const channels = (color) => [(color >> 16) & 255, (color >> 8) & 255, color & 255];
        const baseChannels = channels(palette.base);
        const gridChannels = channels(palette.grid);
        const edgeChannels = channels(palette.edge);
        const gridThickness = parcel.interactive ? 3 : 2;
        for (let y = 0; y < textureSize; y += 1) {
          for (let x = 0; x < textureSize; x += 1) {
            const edge = x < 4 || y < 4 || x >= textureSize - 4 || y >= textureSize - 4;
            const grid = x % 32 < gridThickness || y % 32 < gridThickness;
            const color = edge ? edgeChannels : grid ? gridChannels : baseChannels;
            const offset = (y * textureSize + x) * 4;
            pixels[offset] = color[0];
            pixels[offset + 1] = color[1];
            pixels[offset + 2] = color[2];
            pixels[offset + 3] = 255;
          }
        }
        const tileTexture = new THREE.DataTexture(
          pixels,
          textureSize,
          textureSize,
          THREE.RGBAFormat,
          THREE.UnsignedByteType
        );
        tileTexture.colorSpace = THREE.SRGBColorSpace;
        tileTexture.minFilter = tileTexture.magFilter = THREE.LinearFilter;
        tileTexture.generateMipmaps = false;
        tileTexture.anisotropy = Math.min(4, Number(renderer.capabilities?.getMaxAnisotropy?.()) || 1);
        tileTexture.needsUpdate = true;
        plotMaterial = new THREE.MeshBasicMaterial({ map: tileTexture, toneMapped: false });
      } else {
        plotMaterial = new THREE.MeshBasicMaterial({ color: palette.base, toneMapped: false });
      }
      const base = new THREE.Mesh(
        boxGeometry(THREE, plotWidth * 0.985, 0.055, plotWidth * 0.985),
        plotMaterial
      );
      base.receiveShadow = activeQuality === "standard";
      plotRoot.add(base);
      parcelRoot.add(plotRoot);

      if (!parcel.interactive) continue;
      const cells = createMoonSettlementParcelCells(parcel);
      for (const cell of cells) {
        const chartPosition = [
          parcel.position[0] + cell.localPosition[0],
          parcel.position[1],
          parcel.position[2] + cell.localPosition[2]
        ];
        const target = Object.freeze({
          ...cell,
          name: `${parcel.name}, cell ${cell.label}${cell.valid ? "" : ", outside buildable footprint"}`,
          kind: "parcel-cell",
          parcelId: parcel.siteId,
          position: Object.freeze(chartPosition),
          rotationQuarter: parcel.selected.rotationQuarter
        });
        const root = new THREE.Group();
        root.name = `moon-settlement-${cell.id}`;
        mountMoonSettlementSurfaceObject(THREE, root, chartPosition, 0, 0.025);
        const tile = new THREE.Mesh(
          boxGeometry(THREE, parcel.cellSize * 0.91, 0.028, parcel.cellSize * 0.91),
          new THREE.MeshStandardMaterial({
            color: cell.selected ? 0x83f0df : cell.valid ? 0x4e9891 : 0x6e5f5a,
            emissive: cell.selected ? 0x194d47 : cell.valid ? 0x0b2927 : 0x1f1816,
            roughness: 0.64,
            metalness: 0.2,
            transparent: true,
            opacity: cell.selected ? 0.9 : cell.valid ? 0.56 : 0.28,
            depthWrite: false
          })
        );
        root.add(tile);
        setTargetMetadata(root, target);
        targetRoots.set(target.id, { root, target, labelAnchor: root });
        parcelRoot.add(root);
      }

      const selectedPosition = [
        parcel.position[0] + parcel.selected.cellX * parcel.cellSize,
        parcel.position[1],
        parcel.position[2] + parcel.selected.cellZ * parcel.cellSize
      ];
      const footprint = new THREE.Mesh(
        boxGeometry(THREE, parcel.cellSize * 2.82, 0.035, parcel.cellSize * 2.82),
        new THREE.MeshBasicMaterial({
          color: 0x8df3e5,
          transparent: true,
          opacity: 0.2,
          wireframe: true,
          depthWrite: false
        })
      );
      mountMoonSettlementSurfaceObject(
        THREE,
        footprint,
        selectedPosition,
        parcel.selected.rotationQuarter * Math.PI / 2,
        0.055
      );
      footprint.name = `moon-settlement-${parcel.id}-footprint`;
      parcelRoot.add(footprint);
    }
    parcelRoot.visible = mode !== "weave" && renderState.parcels.length > 0;
  }

  function addStructure(record) {
    const target = Object.freeze({ ...record, kind: "structure" });
    if (record.type === "lander" && authoredLander) {
      mountMoonSettlementSurfaceObject(THREE, authoredLander, record.position, record.rotation);
      registerTarget(authoredLander, target, authoredLander);
      const proxy = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.35, 5.4, 14),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      mountMoonSettlementSurfaceObject(THREE, proxy, record.position, record.rotation, 2.7);
      setTargetMetadata(proxy, target);
      structureRoot.add(proxy);
      return;
    }
    const authoredKey = resolveMoonSettlementAssetKey(record);
    if (record.type === "plot") {
      const visual = createStructureVisual(THREE, record, MOON_SETTLEMENT_QUALITY[activeQuality].radialSegments);
      visual.scale.setScalar?.(2.4);
      mountMoonSettlementSurfaceObject(THREE, visual, record.position, record.rotation);
      visual.traverse?.((object) => {
        if (object.isMesh) object.receiveShadow = activeQuality === "standard";
      });
      structureRoot.add(visual);
      const authoredPreview = authoredKey ? useAuthoredModel(authoredKey, record, { preview: true }) : null;
      if (authoredPreview) setTargetMetadata(authoredPreview, target);
      const authoredEnvelope = authoredPreview?.userData?.moonSettlementEnvelope;
      registerTarget(visual, target, authoredPreview?.userData?.moonSettlementLabelAnchor || authoredPreview || visual);
      addHitProxy(record, target, authoredEnvelope || { radius: 1.9, height: 3.4 });
      return;
    }
    if (authoredKey) {
      const authoredModel = useAuthoredModel(authoredKey, record);
      if (authoredModel) {
        registerTarget(authoredModel, target, authoredModel.userData?.moonSettlementLabelAnchor || authoredModel);
        addHitProxy(record, target, authoredModel.userData?.moonSettlementEnvelope || { radius: 1.9, height: 3.6 });
        return;
      }
    }
    const visual = createStructureVisual(THREE, record, MOON_SETTLEMENT_QUALITY[activeQuality].radialSegments);
    visual.scale.setScalar?.(2.4);
    mountMoonSettlementSurfaceObject(THREE, visual, record.position, record.rotation);
    visual.traverse?.((object) => {
      if (object.isMesh) {
        object.castShadow = activeQuality === "standard";
        object.receiveShadow = activeQuality === "standard";
      }
    });
    structureRoot.add(visual);
    registerTarget(visual, target, visual.userData?.moonSettlementLabelAnchor || visual);
    addHitProxy(record, target, { radius: 1.9, height: 3.6, hitHeight: 3.8 });
  }

  function createBondMesh(atomMap, bond) {
    if (!shouldRenderMoonSettlementBond(bond)) return;
    const from = atomMap.get(bond.from);
    const to = atomMap.get(bond.to);
    if (!from || !to) return;
    const span = calculateMoonSettlementBondSpan(from.position, to.position, from.radius, to.radius);
    if (!(span.length > 0.001)) return;
    const tierColor = bond.tier === "weak" ? 0xc8a76f : bond.tier === "reinforced" ? 0xa4d8d1 : 0xa7bdc2;
    const radius = bond.tier === "reinforced" ? 0.075 : bond.tier === "weak" ? 0.035 : 0.055;
    const geometry = new THREE.CylinderGeometry(radius, radius, span.length, 10);
    const material = new THREE.MeshStandardMaterial({
      color: tierColor,
      roughness: 0.38,
      metalness: bond.tier === "reinforced" ? 0.45 : 0.22,
      transparent: bond.tier === "weak",
      opacity: bond.tier === "weak" ? 0.68 : 1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...span.midpoint);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...span.end).sub(new THREE.Vector3(...span.start)).normalize());
    const target = Object.freeze({ ...bond, name: `${from.name} to ${to.name}, ${bond.tier} bond`, kind: "bond" });
    setTargetMetadata(mesh, target);
    weaveRoot.add(mesh);
    targetRoots.set(target.id, { root: mesh, target, labelAnchor: mesh });
    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.max(0.12, radius * 2.2), Math.max(0.12, radius * 2.2), span.length, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.position.copy(mesh.position);
    proxy.quaternion.copy(mesh.quaternion);
    setTargetMetadata(proxy, target);
    weaveRoot.add(proxy);
  }

  function rebuildWeave() {
    clearGroup(weaveRoot);
    if (!renderState.weave) return;
    const atomMap = new Map(renderState.weave.atoms.map((atom) => [atom.id, atom]));
    for (const bond of renderState.weave.bonds) createBondMesh(atomMap, bond);
    for (const atom of renderState.weave.atoms) {
      const target = Object.freeze({ ...atom, kind: "atom" });
      const root = new THREE.Group();
      root.position.set(...atom.position);
      const hasPhysicalMaterial = typeof THREE.MeshPhysicalMaterial === "function";
      const AtomMaterial = hasPhysicalMaterial ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
      const material = new AtomMaterial({
        color: atomColor(atom.material),
        ...createMoonSettlementAtomMaterialOptions({ physical: hasPhysicalMaterial })
      });
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(atom.radius, MOON_SETTLEMENT_QUALITY[activeQuality].radialSegments, Math.max(10, MOON_SETTLEMENT_QUALITY[activeQuality].radialSegments / 2)),
        material
      );
      root.add(sphere);
      const proxy = new THREE.Mesh(
        new THREE.SphereGeometry(atom.radius * 1.38, 12, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      root.add(proxy);
      weaveRoot.add(root);
      registerTarget(root, target, root);
    }
  }

  function sync(nextState) {
    renderState = normalizeMoonSettlementRenderState(nextState);
    clearLabels();
    targetRoots.clear();
    clearGroup(structureRoot);
    clearGroup(parcelRoot);
    resetAuthoredModels();
    rebuildPaths();
    rebuildParcels();
    for (const record of renderState.structures) addStructure(record);
    rebuildWeave();
    selectedId = renderState.selectedId || selectedId;
    updateSelection();
    canvas.dataset.settlementRevision = String(renderState.revision);
    requestRender();
    return renderState;
  }

  function targetPosition(id) {
    const record = targetRoots.get(id);
    if (!record) return null;
    return record.root.getWorldPosition(new THREE.Vector3());
  }

  function updateSelection() {
    const selectedRecord = targetRoots.get(selectedId || focusedId);
    const position = selectedRecord ? targetPosition(selectedId || focusedId) : null;
    const belongsToWorld = ["structure", "parcel-cell"].includes(selectedRecord?.target?.kind);
    selectionRing.visible = Boolean(position && belongsToWorld && mode !== "weave");
    if (position && belongsToWorld) {
      const localNormal = new THREE.Vector3(...calculateMoonSettlementSurfaceNormal(selectedRecord.target.position));
      const worldNormal = localNormal.applyQuaternion(globePivot.quaternion).normalize();
      selectionRing.position.copy(position).addScaledVector(worldNormal, 0.025);
      selectionRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
    }
    for (const [id, record] of labelRecords) {
      record.element.classList?.toggle?.("is-selected", id === selectedId);
      record.element.classList?.toggle?.("is-focused", id === focusedId);
      record.element.classList?.toggle?.("is-hovered", id === hoveredId);
    }
  }

  function setHoveredTarget(target) {
    const nextId = target?.id ? String(target.id) : null;
    if (nextId === hoveredId) return false;
    hoveredId = nextId;
    updateSelection();
    requestRender();
    return true;
  }

  function selectTarget(target, detail = {}) {
    if (!target) return false;
    selectedId = target.id;
    updateSelection();
    onSelect(target, detail);
    requestRender();
    return true;
  }

  function inspectTarget(target, detail = {}) {
    if (!target) return false;
    selectTarget(target, detail);
    focusedId = target.id;
    mode = "inspect";
    canvas.dataset.settlementMode = mode;
    onModeChange(mode);
    onInspect(target, detail);
    updateSelection();
    requestRender();
    return true;
  }

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect?.();
    if (!rect?.width || !rect?.height) return null;
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    scene.updateMatrixWorld?.(true);
    raycaster.setFromCamera(pointer, camera);
    const hierarchyIsVisible = (object) => {
      let current = object;
      while (current && current !== scene) {
        if (current.visible === false) return false;
        current = current.parent || null;
      }
      return true;
    };
    const pickingRoots = mode !== "weave" && renderState.parcels.some((parcel) => parcel.interactive)
      ? [parcelRoot]
      : [structureRoot, weaveRoot];
    const hits = raycaster.intersectObjects(pickingRoots, true)
      .filter((hit) => hierarchyIsVisible(hit.object));
    return rankMoonSettlementRaycastHits(hits);
  }

  function desiredMovementInput() {
    const strafe = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
    const forward = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
    const cameraForward = [-Math.sin(orbitYaw), -Math.cos(orbitYaw)];
    const cameraRight = [Math.cos(orbitYaw), -Math.sin(orbitYaw)];
    const worldX = cameraRight[0] * strafe + cameraForward[0] * forward;
    const worldZ = cameraRight[1] * strafe + cameraForward[1] * forward;
    const localDirection = new THREE.Vector3(worldX, 0, worldZ)
      .applyQuaternion(globePivot.quaternion.clone().invert());
    return {
      x: localDirection.x,
      z: localDirection.z,
      worldX,
      worldZ,
      jump: jumpQueued,
      speed: keys.has("ShiftLeft") || keys.has("ShiftRight") ? 3.65 : 2.55,
      boundary: MOON_SETTLEMENT_WALK_BOUNDARY
    };
  }

  function updateMovement(deltaSeconds) {
    if (mode !== "walk") return false;
    const input = desiredMovementInput();
    jumpQueued = false;
    const moving = Math.abs(input.x) > 0.001 || Math.abs(input.z) > 0.001 || input.jump || !movement.grounded;
    if (!moving) return false;
    if (focusedId) {
      focusedId = null;
      updateSelection();
    }
    movement = stepMoonSettlementMovement(movement, input, deltaSeconds);
    const frame = calculateMoonSettlementSurfaceFrame(movement.position);
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...frame.right),
      new THREE.Vector3(...frame.normal),
      new THREE.Vector3(...frame.forward)
    );
    globePivot.quaternion.setFromRotationMatrix(basis).invert();
    avatar.position.set(0, MOON_SETTLEMENT_WALK_CLEARANCE + movement.position[1], 0);
    avatar.rotation.y = Math.atan2(input.worldX, input.worldZ || 0.00001);
    updateSelection();
    onMove(Object.freeze({ position: movement.position, grounded: movement.grounded, mode }));
    return true;
  }

  function updateCamera(deltaSeconds) {
    const focusedRecord = focusedId ? targetRoots.get(focusedId) : null;
    const focusMatchesMode = mode === "weave"
      ? ["atom", "bond"].includes(focusedRecord?.target?.kind)
      : focusedRecord?.target?.kind === "structure";
    const focusPosition = focusMatchesMode ? targetPosition(focusedId) : null;
    const base = focusPosition || (mode === "weave" ? weaveRoot.position : avatar.position);
    desiredCameraTarget.set(base.x, base.y + (focusPosition ? 1.35 : 0.92), base.z);
    if (motionReduced) currentCameraTarget.copy(desiredCameraTarget);
    else currentCameraTarget.lerp(desiredCameraTarget, 1 - Math.exp(-Math.max(0, deltaSeconds) * 7.5));
    const horizontal = Math.cos(orbitPitch) * orbitDistance;
    camera.position.set(
      currentCameraTarget.x + Math.sin(orbitYaw) * horizontal,
      currentCameraTarget.y + Math.sin(orbitPitch) * orbitDistance,
      currentCameraTarget.z + Math.cos(orbitYaw) * horizontal
    );
    camera.lookAt(currentCameraTarget);
  }

  function updateLabels() {
    const rect = canvas.getBoundingClientRect?.();
    if (!rect?.width || !rect?.height) return;
    for (const { element, anchor, root, target } of labelRecords.values()) {
      const visibleForMode = (mode === "weave") === (target.kind === "atom");
      if (!visibleForMode) {
        element.hidden = true;
        continue;
      }
      const materialSample = target.type === "regolith-sample";
      const position = materialSample
        ? new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3())
        : anchor.getWorldPosition(new THREE.Vector3());
      const hasAuthoredLabelAnchor = target.kind !== "atom" && /LABEL_ANCHOR/i.test(String(anchor.name || ""));
      const authoredEnvelope = MOON_SETTLEMENT_AUTHORED_ENVELOPES[resolveMoonSettlementAssetKey(target)];
      const authoredLabelHeight = Number(target.labelHeight);
      const fallbackLabelHeight = target.type === "lander"
        ? 5.45
        : Number.isFinite(authoredLabelHeight)
          ? authoredLabelHeight
          : authoredEnvelope?.height || 3.7;
      if (!materialSample) {
        const offset = new THREE.Vector3(
          0,
          target.kind === "atom" ? target.radius + 0.14 : hasAuthoredLabelAnchor ? 0.18 : fallbackLabelHeight + 0.25,
          0
        );
        offset.applyQuaternion(anchor.getWorldQuaternion(new THREE.Quaternion()));
        position.add(offset);
      }
      position.project(camera);
      const visible = position.z > -1 && position.z < 1 && Math.abs(position.x) < 1.12 && Math.abs(position.y) < 1.12;
      element.hidden = !visible;
      if (!visible) continue;
      const x = Math.round((position.x * 0.5 + 0.5) * rect.width);
      const y = Math.round((-position.y * 0.5 + 0.5) * rect.height);
      const labelAlignment = target.type === "regolith-sample" ? "translate(-50%, -50%)" : "translate(-50%, -100%)";
      element.style.transform = `translate3d(${x}px, ${y}px, 0) ${labelAlignment}`;
      element.style.zIndex = String(Math.max(1, 1000 - Math.round(position.z * 100)));
    }
  }

  function resize() {
    const rect = host.getBoundingClientRect?.() || canvas.getBoundingClientRect?.();
    const width = Math.max(1, Math.round(rect?.width || host.clientWidth || 1));
    const height = Math.max(1, Math.round(rect?.height || host.clientHeight || 1));
    renderer.setPixelRatio(capMoonSettlementPixelRatio(windowRef?.devicePixelRatio || 1, activeQuality));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
    return Object.freeze({ width, height });
  }

  function renderFrame(now = 0) {
    if (disposed) return false;
    const deltaSeconds = lastFrameAt ? clamp((now - lastFrameAt) / 1000, 0, 0.05) : 1 / 60;
    lastFrameAt = now;
    updateMovement(deltaSeconds);
    updateCamera(deltaSeconds);
    if (mode === "weave" && !motionReduced) weaveRoot.rotation.y += deltaSeconds * 0.09;
    updateSelection();
    updateLabels();
    renderer.render(scene, camera);
    return true;
  }

  function loop(now) {
    if (disposed) return;
    renderFrame(now);
    frameRequest = windowRef?.requestAnimationFrame?.(loop) || 0;
  }

  function requestRender() {
    if (!frameRequest) renderFrame(windowRef?.performance?.now?.() || 0);
  }

  function setMode(nextMode) {
    mode = normalizeMoonSettlementMode(nextMode);
    physicalRoot.visible = mode !== "weave";
    weaveRoot.visible = mode === "weave";
    parcelRoot.visible = mode !== "weave" && renderState.parcels.length > 0;
    if (mode === "walk") focusedId = null;
    canvas.dataset.settlementMode = mode;
    host.dataset.settlementMode = mode;
    updateSelection();
    onModeChange(mode);
    requestRender();
    return mode;
  }

  function focus(target, options = {}) {
    const id = typeof target === "string" ? target : target?.id;
    if (!id || !targetRoots.has(id)) return false;
    if (options.resetWorld) {
      movement = { position: Object.freeze([0, 0, 0]), verticalVelocity: 0, grounded: true };
      globePivot.quaternion.identity();
      avatar.position.set(0, MOON_SETTLEMENT_WALK_CLEARANCE, 0);
    }
    focusedId = String(id);
    orbitDistance = mode === "weave"
      ? clamp(options.distance || 4.2, 2.2, 13.5)
      : clamp(options.distance || 9.5, 5.5, 38);
    if (Number.isFinite(Number(options.yaw))) orbitYaw = Number(options.yaw);
    if (Number.isFinite(Number(options.pitch))) orbitPitch = clamp(options.pitch, 0.28, 1.22);
    updateSelection();
    requestRender();
    return true;
  }

  function onKeyDown(event) {
    if (event.defaultPrevented) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      keys.add(event.code);
      event.preventDefault?.();
    }
    if (["ShiftLeft", "ShiftRight"].includes(event.code)) keys.add(event.code);
    if (event.code === "Space" && mode === "walk" && !event.repeat) {
      jumpQueued = true;
      event.preventDefault?.();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onPointerDown(event) {
    if (event.button !== 0 && event.button !== 1) return;
    host.focus?.({ preventScroll: true });
    pointerGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: 0 };
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!pointerGesture) {
      if (event.pointerType !== "touch") setHoveredTarget(pick(event.clientX, event.clientY));
      return;
    }
    if (pointerGesture.id !== event.pointerId) return;
    const dx = event.clientX - pointerGesture.lastX;
    const dy = event.clientY - pointerGesture.lastY;
    pointerGesture.lastX = event.clientX;
    pointerGesture.lastY = event.clientY;
    pointerGesture.moved += Math.hypot(dx, dy);
    if (pointerGesture.moved < 3) return;
    orbitYaw -= dx * 0.006;
    orbitPitch = clamp(orbitPitch + dy * 0.004, 0.28, 1.22);
    requestRender();
  }

  function onPointerUp(event) {
    if (!pointerGesture || pointerGesture.id !== event.pointerId) return;
    const gesture = pointerGesture;
    pointerGesture = null;
    canvas.releasePointerCapture?.(event.pointerId);
    if (gesture.moved < 6) selectTarget(pick(event.clientX, event.clientY), { source: "raycast", originalEvent: event });
  }

  function onDoubleClick(event) {
    inspectTarget(pick(event.clientX, event.clientY), { source: "raycast", originalEvent: event });
  }

  function onWheel(event) {
    orbitDistance = clamp(
      orbitDistance * Math.exp((Number(event.deltaY) || 0) * 0.001),
      mode === "weave" ? 2.2 : 5.5,
      mode === "weave" ? 13.5 : 38
    );
    event.preventDefault?.();
    requestRender();
  }

  addListener(host, "keydown", onKeyDown);
  addListener(host, "keyup", onKeyUp);
  addListener(canvas, "pointerdown", onPointerDown);
  addListener(canvas, "pointermove", onPointerMove);
  addListener(canvas, "pointerup", onPointerUp);
  addListener(canvas, "pointercancel", onPointerUp);
  addListener(canvas, "pointerleave", () => setHoveredTarget(null));
  addListener(canvas, "dblclick", onDoubleClick);
  addListener(canvas, "wheel", onWheel, { passive: false });
  addListener(windowRef, "blur", () => keys.clear());
  const resizeObserver = typeof windowRef?.ResizeObserver === "function" ? new windowRef.ResizeObserver(resize) : null;
  resizeObserver?.observe?.(host);

  sync(renderState);
  resize();
  if (typeof windowRef?.requestAnimationFrame === "function") frameRequest = windowRef.requestAnimationFrame(loop);
  else renderFrame(0);

  return Object.freeze({
    backend: "three",
    sync,
    render: () => renderFrame(windowRef?.performance?.now?.() || 0),
    resize,
    setMode,
    focus,
    pick,
    quality(value) {
      activeQuality = normalizeMoonSettlementQuality(value);
      canvas.dataset.settlementQuality = activeQuality;
      renderer.shadowMap.enabled = MOON_SETTLEMENT_QUALITY[activeQuality].shadowMap;
      resize();
      return activeQuality;
    },
    reducedMotion(value) {
      motionReduced = Boolean(value);
      canvas.dataset.settlementReducedMotion = String(motionReduced);
      requestRender();
      return motionReduced;
    },
    dispose() {
      if (disposed) return false;
      disposed = true;
      resizeObserver?.disconnect?.();
      if (frameRequest) windowRef?.cancelAnimationFrame?.(frameRequest);
      for (const [element, type, listener, options] of listeners) element?.removeEventListener?.(type, listener, options);
      clearLabels();
      disposeObject(scene);
      renderer.dispose?.();
      renderer.forceContextLoss?.();
      canvas.remove?.();
      host.classList?.remove?.("moon-settlement-renderer--three");
      return true;
    }
  });
}

/**
 * Create an idempotently initialized settlement surface. The caller may sync
 * state and choose a mode before `init`; those choices are replayed onto the
 * selected Three.js or 2.5D backend.
 */
export function createMoonSettlementRenderer({
  host,
  labelLayer = host,
  documentRef = host?.ownerDocument || globalThis.document,
  windowRef = documentRef?.defaultView || globalThis.window,
  modules = null,
  importer,
  quality = "standard",
  forceFallback = false,
  reducedMotion = false,
  assetBaseUrl = globalThis.location?.href || "http://localhost/",
  assets = MOON_SETTLEMENT_ASSETS,
  posterUrl = DEFAULT_MOON_SETTLEMENT_POSTER_URL,
  onSelect = () => {},
  onMove = () => {},
  onInspect = () => {},
  onModeChange = () => {},
  onReady = () => {},
  onError = () => {}
} = {}) {
  if (!host?.append && !host?.appendChild) throw new TypeError("A settlement renderer host is required.");
  if (!documentRef?.createElement) throw new TypeError("A document is required to create the settlement renderer.");
  let activeQuality = normalizeMoonSettlementQuality(quality);
  let fallbackRequested = Boolean(forceFallback) || String(quality).toLowerCase() === "fallback";
  let motionReduced = Boolean(reducedMotion);
  let mode = "walk";
  let renderState = normalizeMoonSettlementRenderState();
  let pendingFocus = null;
  let backend = null;
  let initPromise = null;
  let disposed = false;

  const controller = Object.freeze({
    async init() {
      if (disposed) throw new Error("The settlement renderer has been disposed.");
      if (backend) return controller;
      if (initPromise) return initPromise;
      host.dataset.settlementRenderer = "loading";
      initPromise = (async () => {
        let candidate = null;
        if (!fallbackRequested) {
          try {
            const loadedModules = modules || await loadMoonSettlementThree({ importer });
            candidate = await createThreeBackend({
              host, labelLayer, documentRef, windowRef, modules: loadedModules,
              quality: activeQuality, reducedMotion: motionReduced, assetBaseUrl,
              assets, onSelect, onMove, onInspect, onModeChange
            });
          } catch (error) {
            onError(error);
          }
        }
        if (fallbackRequested && candidate?.backend === "three") {
          candidate.dispose();
          candidate = null;
        }
        if (!candidate) {
          candidate = createFallbackBackend({
            host, labelLayer, documentRef, posterUrl, assetBaseUrl, onSelect, onInspect
          });
        }
        if (disposed) {
          candidate.dispose?.();
          return controller;
        }
        backend = candidate;
        backend.sync(renderState);
        backend.setMode(mode);
        backend.quality(activeQuality);
        backend.reducedMotion(motionReduced);
        if (pendingFocus) backend.focus(pendingFocus.target, pendingFocus.options);
        host.dataset.settlementRenderer = backend.backend;
        onReady(Object.freeze({ backend: backend.backend, quality: activeQuality, reducedMotion: motionReduced }));
        return controller;
      })();
      return initPromise;
    },
    render() {
      return backend?.render?.() || false;
    },
    sync(nextState) {
      renderState = normalizeMoonSettlementRenderState(nextState);
      backend?.sync?.(renderState);
      return renderState;
    },
    setMode(nextMode) {
      mode = normalizeMoonSettlementMode(nextMode);
      backend?.setMode?.(mode);
      return mode;
    },
    focus(target, options = {}) {
      pendingFocus = { target, options };
      return backend ? backend.focus(target, options) : Boolean(target);
    },
    resize() {
      return backend?.resize?.() || false;
    },
    quality(nextQuality) {
      if (arguments.length === 0) return fallbackRequested ? "fallback" : activeQuality;
      const nextFallback = String(nextQuality).toLowerCase() === "fallback";
      fallbackRequested = nextFallback;
      activeQuality = normalizeMoonSettlementQuality(nextQuality);
      if (nextFallback && backend && backend.backend !== "2.5d") {
        backend?.dispose?.();
        backend = createFallbackBackend({
          host, labelLayer, documentRef, posterUrl, assetBaseUrl, onSelect, onInspect
        });
        backend.sync(renderState);
        backend.setMode(mode);
        backend.reducedMotion(motionReduced);
        if (pendingFocus) backend.focus(pendingFocus.target, pendingFocus.options);
        host.dataset.settlementRenderer = backend.backend;
        onReady(Object.freeze({ backend: backend.backend, quality: "fallback", reducedMotion: motionReduced }));
      } else if (!nextFallback && backend?.backend === "2.5d") {
        backend.dispose();
        backend = null;
        initPromise = null;
        void controller.init();
      } else backend?.quality?.(activeQuality);
      return nextFallback ? "fallback" : activeQuality;
    },
    reducedMotion(nextValue) {
      if (arguments.length === 0) return motionReduced;
      motionReduced = Boolean(nextValue);
      backend?.reducedMotion?.(motionReduced);
      return motionReduced;
    },
    getBackend() {
      return backend?.backend || "pending";
    },
    getMode() {
      return mode;
    },
    dispose() {
      if (disposed) return false;
      disposed = true;
      backend?.dispose?.();
      backend = null;
      host.dataset.settlementRenderer = "disposed";
      return true;
    }
  });
  return controller;
}
