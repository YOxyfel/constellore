import {
  BIRTHDAY_FINALE_SIGNATURE,
  BIRTHDAY_FINAL_MESSAGE,
  BIRTHDAY_GIVER_NAME,
  BIRTHDAY_HONOREE_NAMES,
  BIRTHDAY_HONOREE_DISPLAY_NAME,
  BIRTHDAY_INTERFACE_PAIR,
  BIRTHDAY_VOYAGE_ENABLED,
  BIRTHDAY_VOYAGE_VERSION
} from "./birthday-voyage-config.mjs?v=5.0.0-beta.4";
import { BIRTHDAY_PERSONAL_MEDIA } from "./birthday-voyage-personal-media.mjs?v=5.0.0-beta.4";

const STYLE_MARKER = "data-birthday-voyage-style";
const SESSION_PROMPT_KEY = `constellore-birthday-voyage-prompt-v${BIRTHDAY_VOYAGE_VERSION}`;
const SESSION_GUEST_KEY = `constellore-birthday-voyage-guest-v${BIRTHDAY_VOYAGE_VERSION}`;
const COMPLETION_KEY = `constellore-birthday-voyage-complete-v${BIRTHDAY_VOYAGE_VERSION}`;
const CHECKPOINT_KEY = `constellore-birthday-voyage-checkpoint-v${BIRTHDAY_VOYAGE_VERSION}`;
const ASSET_ROOT = "./art/birthday-voyage";
const LION_INTRO_VIDEO = "./cinematic/lion-intro-birthday.mp4?birthday=7";

export const BIRTHDAY_CAR_OPTIONS = Object.freeze([
  Object.freeze({ id: "rav4", label: "Toyota RAV4" }),
  Object.freeze({ id: "mini", label: "Mini Cooper" }),
  Object.freeze({ id: "porsche", label: "Porsche 911" }),
  Object.freeze({ id: "fiat", label: "Fiat 500" }),
  Object.freeze({ id: "volvo", label: "Volvo 240" })
]);

export const BIRTHDAY_FATED_ANSWERS = Object.freeze({
  car: "Toyota RAV4",
  animal: "Lion",
  city: "Vienna",
  drink: "Water"
});

const BIRTHDAY_SEDAN_FALLBACK = Object.freeze({
  id: "sedan",
  label: "Sedan"
});

export const BIRTHDAY_CITY_OPTIONS = Object.freeze([
  Object.freeze({
    id: "vienna",
    label: "Vienna",
    image: `${ASSET_ROOT}/thumbs/vienna-thumb.webp`
  }),
  Object.freeze({
    id: "brussels",
    label: "Brussels",
    image: `${ASSET_ROOT}/thumbs/brussels-thumb.webp`
  }),
  Object.freeze({
    id: "sofia",
    label: "Sofia",
    image: `${ASSET_ROOT}/thumbs/sofia-thumb.webp`
  }),
  Object.freeze({
    id: "tokyo",
    label: "Tokyo",
    image: `${ASSET_ROOT}/thumbs/tokyo-thumb.webp`
  }),
  Object.freeze({
    id: "shibuya",
    label: "Shibuya",
    image: `${ASSET_ROOT}/thumbs/shibuya-thumb.webp`
  })
]);

const PERSONAL_MEDIA_PATH = /^\/cinematic\/birthday-voyage\/v2\/[a-z0-9._-]+$/i;

function selectedPersonalMediaByDestination(entries = BIRTHDAY_PERSONAL_MEDIA) {
  const mediaByDestination = new Map();
  for (const candidate of Array.from(entries || [])) {
    const destination = String(candidate?.destination || "").trim().toLowerCase();
    if (!/^(?:varna|vienna|brussels|sofia|tokyo|shibuya|earth|moon|mars|kepler|cosmos)$/.test(destination)) continue;
    const trustedPath = (value) => {
      const path = String(value || "").trim();
      return PERSONAL_MEDIA_PATH.test(path) ? path : "";
    };
    const videoSources = Array.from(candidate?.videoSources || [])
      .map((source) => ({
        src: trustedPath(typeof source === "string" ? source : source?.src),
        type: String(typeof source === "object" ? source?.type || "video/mp4" : "video/mp4")
      }))
      .filter(({ src, type }) => src && /^video\/(?:mp4|webm)$/i.test(type));
    const current = mediaByDestination.get(destination) || {};
    const next = { ...current };
    const poster = trustedPath(candidate?.poster);
    const thumb = trustedPath(candidate?.thumb);
    const audioSource = trustedPath(candidate?.audioSource);
    const candidateHasVisual = Boolean(poster || thumb || videoSources.length);
    const currentHasVideo = Boolean(current.videoSources?.length);
    if (candidateHasVisual && (videoSources.length || !currentHasVideo)) {
      if (poster) next.poster = poster;
      if (thumb) next.thumb = thumb;
      if (videoSources.length) next.videoSources = videoSources;
      if (String(candidate?.alt || "").trim()) next.alt = String(candidate.alt).trim().slice(0, 240);
      if (String(candidate?.story || "").trim()) next.story = String(candidate.story).trim().slice(0, 520);
      const durationMs = Number(candidate?.durationMs);
      if (videoSources.length && Number.isFinite(durationMs)) {
        next.durationMs = Math.max(4_000, Math.min(6_000, durationMs));
      }
    }
    if (audioSource && !next.audioSource) next.audioSource = audioSource;
    mediaByDestination.set(destination, Object.freeze(next));
  }
  return mediaByDestination;
}

const PERSONAL_MEDIA_BY_DESTINATION = selectedPersonalMediaByDestination();

const routeDestination = (entry) => {
  const personalMedia = PERSONAL_MEDIA_BY_DESTINATION.get(entry.id) || {};
  const videoSources = personalMedia.videoSources?.length
    ? personalMedia.videoSources
    : Array.from(entry.videoSources || []);
  return Object.freeze({
    thumb: entry.image,
    poster: entry.previewImage || entry.image,
    videoSources: Object.freeze([]),
    alt: `${entry.label} destination artwork`,
    durationMs: 5_000,
    story: entry.caption,
    scenePreset: entry.kind === "city" ? "magical-road" : "celestial-starlight",
    soundPreset: entry.kind === "city" ? "road-memory" : "space-memory",
    act: entry.kind === "city" ? "world" : "space",
    ...entry,
    ...personalMedia,
    durationMs: entry.durationMs,
    videoSources: Object.freeze(Array.from(videoSources, (source) => (
      typeof source === "string" ? source : Object.freeze({ ...source })
    )))
  });
};

export const BIRTHDAY_ROUTE = Object.freeze([
  routeDestination({
    id: "varna",
    label: "Varna",
    kind: "city",
    image: `${ASSET_ROOT}/14-varna-buildings.webp`,
    previewImage: `${ASSET_ROOT}/14-varna-buildings.webp`,
    thumb: `${ASSET_ROOT}/thumbs/varna-thumb.webp`,
    poster: `${ASSET_ROOT}/masters/varna-master.webp`,
    chapter: "Chapter 01 \u00b7 Where our journey begins",
    caption: "Where we are now, and where every physical and inner journey begins.",
    story: "Varna is our here and now: the first page of every physical world and every inner world we will discover together.",
    alt: "Varna at the Black Sea, the beginning of Sophia and Yane's journey",
    durationMs: 5_000,
    scenePreset: "varna-dawn",
    soundPreset: "varna-ceremony",
    act: "varna",
    x: 130,
    y: 92,
    mobileX: 500,
    mobileY: 150
  }),
  routeDestination({
    id: "vienna",
    label: "Vienna",
    kind: "city",
    image: `${ASSET_ROOT}/02-vienna-buildings.webp`,
    previewImage: `${ASSET_ROOT}/02-vienna-buildings.webp`,
    thumb: `${ASSET_ROOT}/thumbs/vienna-thumb.webp`,
    poster: `${ASSET_ROOT}/masters/vienna-master.webp`,
    chapter: "Chapter 02 \u00b7 The road opens",
    caption: "The road keeps unfolding with you beside me.",
    durationMs: 5_000,
    act: "europe",
    scenePreset: "europe-gold",
    soundPreset: "city-waltz",
    x: 335,
    y: 108,
    mobileX: 250,
    mobileY: 310
  }),
  routeDestination({
    id: "brussels",
    label: "Brussels",
    kind: "city",
    image: `${ASSET_ROOT}/03-belgium-brussels-buildings.webp`,
    previewImage: `${ASSET_ROOT}/03-belgium-brussels-buildings.webp`,
    thumb: `${ASSET_ROOT}/thumbs/brussels-thumb.webp`,
    poster: `${ASSET_ROOT}/masters/brussels-master.webp`,
    chapter: "Chapter 03 \u00b7 A little farther",
    caption: "Another road, still the same two seats.",
    durationMs: 5_000,
    act: "europe",
    scenePreset: "europe-rain",
    soundPreset: "city-cobbles",
    x: 555,
    y: 78,
    mobileX: 750,
    mobileY: 470
  }),
  routeDestination({
    id: "sofia",
    label: "Sofia",
    kind: "city",
    image: `${ASSET_ROOT}/04-bulgaria-sofia-buildings.webp`,
    previewImage: `${ASSET_ROOT}/04-bulgaria-sofia-buildings.webp`,
    thumb: `${ASSET_ROOT}/thumbs/sofia-thumb.webp`,
    poster: `${ASSET_ROOT}/masters/sofia-master.webp`,
    chapter: "Chapter 04 \u00b7 The beautiful detour",
    caption: "Even the wrong turns become our stories.",
    durationMs: 5_000,
    act: "europe",
    scenePreset: "europe-sun",
    soundPreset: "city-bells",
    x: 780,
    y: 106,
    mobileX: 270,
    mobileY: 630
  }),
  routeDestination({
    id: "tokyo",
    label: "Tokyo",
    kind: "city",
    image: `${ASSET_ROOT}/05-tokyo-buildings.webp`,
    previewImage: `${ASSET_ROOT}/05-tokyo-buildings.webp`,
    thumb: `${ASSET_ROOT}/thumbs/tokyo-thumb.webp`,
    poster: `${ASSET_ROOT}/masters/tokyo-master.webp`,
    chapter: "Chapter 05 \u00b7 New lights",
    caption: "A new horizon, together.",
    durationMs: 5_000,
    act: "tokyo",
    scenePreset: "tokyo-neon",
    soundPreset: "neon-arrival",
    x: 900,
    y: 276,
    mobileX: 720,
    mobileY: 790
  }),
  routeDestination({
    id: "shibuya",
    label: "Shibuya",
    kind: "city",
    image: `${ASSET_ROOT}/06-shibuya-buildings.webp`,
    previewImage: `${ASSET_ROOT}/06-shibuya-buildings.webp`,
    thumb: `${ASSET_ROOT}/thumbs/shibuya-thumb.webp`,
    poster: `${ASSET_ROOT}/masters/shibuya-master.webp`,
    chapter: "Chapter 06 \u00b7 In the crowd",
    caption: "In the busiest crossing, I would still choose your hand.",
    durationMs: 5_000,
    act: "tokyo",
    scenePreset: "shibuya-pulse",
    soundPreset: "neon-crossing",
    x: 705,
    y: 360,
    mobileX: 300,
    mobileY: 950
  }),
  routeDestination({
    id: "earth",
    label: "Earth",
    kind: "planet",
    image: `${ASSET_ROOT}/07-earth.webp`,
    previewImage: `${ASSET_ROOT}/07-earth.webp`,
    thumb: `${ASSET_ROOT}/thumbs/earth-thumb.webp`,
    poster: `${ASSET_ROOT}/masters/earth-master.webp`,
    chapter: "Chapter 07 \u00b7 Home becomes a launchpad",
    caption: "Home is wherever we leave from together.",
    story: "At Earth, the road becomes a launch trail and our RAV4 becomes the ship that carries both of us farther.",
    durationMs: 5_000,
    scenePreset: "earth-launch",
    soundPreset: "rocket-conversion",
    x: 485,
    y: 270,
    mobileX: 700,
    mobileY: 1110
  }),
  routeDestination({
    id: "moon",
    label: "Moon",
    kind: "planet",
    image: `${ASSET_ROOT}/08-moon.webp`,
    previewImage: `${ASSET_ROOT}/08-moon.webp`,
    thumb: `${ASSET_ROOT}/thumbs/moon-thumb.webp`,
    poster: `${ASSET_ROOT}/masters/moon-master.webp`,
    chapter: "Chapter 08 \u00b7 Our first impossible stop",
    caption: "The sky was never the limit.",
    durationMs: 5_000,
    scenePreset: "lunar-silver",
    soundPreset: "lunar-dock",
    x: 260,
    y: 365,
    mobileX: 280,
    mobileY: 1270
  }),
  routeDestination({
    id: "mars",
    label: "Mars",
    kind: "planet",
    image: `${ASSET_ROOT}/09-mars.webp`,
    previewImage: `${ASSET_ROOT}/09-mars.webp`,
    thumb: `${ASSET_ROOT}/thumbs/mars-thumb.webp`,
    poster: `${ASSET_ROOT}/masters/mars-master.webp`,
    chapter: "Chapter 09 \u00b7 Beyond every map",
    caption: "No road is too far with you beside me.",
    durationMs: 5_000,
    scenePreset: "mars-ember",
    soundPreset: "mars-dock",
    x: 120,
    y: 500,
    mobileX: 700,
    mobileY: 1430
  }),
  routeDestination({
    id: "kepler",
    label: "Kepler-452b",
    kind: "planet",
    image: `${ASSET_ROOT}/10-kepler-452b.webp`,
    previewImage: `${ASSET_ROOT}/10-kepler-452b.webp`,
    thumb: `${ASSET_ROOT}/thumbs/kepler-452b-thumb.webp`,
    poster: `${ASSET_ROOT}/masters/kepler-452b-master.webp`,
    chapter: "Chapter 10 \u00b7 Another world",
    caption: "Another world, still the same two seats.",
    durationMs: 5_000,
    scenePreset: "kepler-aurora",
    soundPreset: "deep-space-dock",
    x: 450,
    y: 492,
    mobileX: 300,
    mobileY: 1590
  }),
  routeDestination({
    id: "cosmos",
    label: "Our Cosmos",
    kind: "cosmos",
    image: `${ASSET_ROOT}/12-our-cosmos-together.webp`,
    previewImage: `${ASSET_ROOT}/12-our-cosmos-together.webp`,
    thumb: `${ASSET_ROOT}/thumbs/our-cosmos-thumb.webp`,
    poster: `${ASSET_ROOT}/masters/our-cosmos-master.webp`,
    chapter: "Chapter 11 \u00b7 Our cosmos",
    caption: "No final destination. Just us.",
    story: "The destination is not an ending. It is Sophia and Yane, still choosing the next world together.",
    durationMs: 5_000,
    act: "cosmos",
    scenePreset: "our-cosmos",
    soundPreset: "cosmos-quiet",
    x: 880,
    y: 470,
    mobileX: 650,
    mobileY: 1750
  })
]);

export const BIRTHDAY_ROUTE_PREVIEW_MS = 5_000;
export const BIRTHDAY_CHAPTER_INTRO_MS = 2_200;
export const BIRTHDAY_CHAPTER_RAIL_SETTLE_MS = 1_050;
export const BIRTHDAY_CAR_TRAVEL_MS = 2_400;
export const BIRTHDAY_ROCKET_TRAVEL_MS = 1_300;
export const BIRTHDAY_PARKING_APPROACH_MS = 360;
export const BIRTHDAY_PARKING_REVERSE_MS = 620;
export const BIRTHDAY_PARKING_STRAIGHTEN_MS = 360;
export const BIRTHDAY_PARKING_SETTLE_MS = 220;
export const BIRTHDAY_HOVER_DWELL_MS = 320;
export const BIRTHDAY_RAGEBAIT_HOLD_MS = 1_400;
export const BIRTHDAY_CAR_RESELECT_MS = 360;

const ANIMAL_RAGEBAIT = Object.freeze([
  "Capybara",
  "Axolotl",
  "Pangolin",
  "Quokka",
  "Red panda",
  "Wombat",
  "Alpaca",
  "Sea otter"
]);

const DRINK_OPTIONS = Object.freeze([
  Object.freeze({ id: "water", label: "Water" }),
  Object.freeze({ id: "coffee", label: "Coffee" }),
  Object.freeze({ id: "tea", label: "Tea" }),
  Object.freeze({ id: "wine", label: "Wine" }),
  Object.freeze({ id: "mojito", label: "Mojito" })
]);

export function normalizeBirthdayName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}

export function isBirthdayHonoree(
  value,
  honoreeNames = BIRTHDAY_HONOREE_NAMES
) {
  const normalized = normalizeBirthdayName(value);
  if (!normalized) return false;
  return Array.from(honoreeNames || [])
    .map(normalizeBirthdayName)
    .filter((name) => name && name !== "your girlfriend name")
    .includes(normalized);
}

function boundedRandomIndex(length, random = Math.random) {
  if (!Number.isInteger(length) || length <= 0) return -1;
  const sample = Number(random());
  const normalized = Number.isFinite(sample) ? Math.max(0, Math.min(0.999999, sample)) : 0;
  return Math.floor(normalized * length);
}

export function ragebaitAnimal(value, random = Math.random) {
  const submitted = String(value || "").trim();
  if (normalizeBirthdayName(submitted) !== "lion") return submitted;
  const choices = ANIMAL_RAGEBAIT.filter((animal) => {
    const normalized = normalizeBirthdayName(animal);
    return normalized !== "lion";
  });
  return choices[boundedRandomIndex(choices.length, random)] || "Capybara";
}

export function ragebaitCity(value) {
  const selected = BIRTHDAY_CITY_OPTIONS.find((city) => city.id === value);
  const sofia = BIRTHDAY_CITY_OPTIONS.find((city) => city.id === "sofia");
  if (selected?.id === "sofia") {
    return Object.freeze({ sabotaged: false, city: sofia });
  }
  return Object.freeze({
    sabotaged: true,
    city: sofia
  });
}

export function ragebaitDrink(value) {
  const selected = DRINK_OPTIONS.find((drink) => drink.id === value) || DRINK_OPTIONS[0];
  return selected.id === "water"
    ? Object.freeze({ sabotaged: true, id: "melted-ice", label: "Melted ice" })
    : Object.freeze({ sabotaged: false, id: selected.id, label: selected.label });
}

export function eliminateBirthdayCar(eliminatedIds = [], selectedId = "") {
  const validIds = new Set(BIRTHDAY_CAR_OPTIONS.map((car) => car.id));
  const eliminated = new Set(
    Array.from(eliminatedIds || []).filter((id) => validIds.has(id))
  );
  const remainingBefore = BIRTHDAY_CAR_OPTIONS.filter((car) => !eliminated.has(car.id));
  if (
    remainingBefore.length <= 1
    || !remainingBefore.some((car) => car.id === selectedId)
  ) {
    const survivor = remainingBefore.length === 1
      ? (remainingBefore[0].id === "rav4" ? BIRTHDAY_SEDAN_FALLBACK : remainingBefore[0])
      : null;
    return Object.freeze({
      eliminatedIds: Object.freeze([...eliminated]),
      remainingIds: Object.freeze(remainingBefore.map((car) => car.id)),
      complete: Boolean(survivor),
      morphed: survivor?.id === "sedan",
      survivor
    });
  }

  eliminated.add(selectedId);
  const remaining = BIRTHDAY_CAR_OPTIONS.filter((car) => !eliminated.has(car.id));
  const survivor = remaining.length === 1
    ? (remaining[0].id === "rav4" ? BIRTHDAY_SEDAN_FALLBACK : remaining[0])
    : null;
  return Object.freeze({
    eliminatedIds: Object.freeze([...eliminated]),
    remainingIds: Object.freeze(remaining.map((car) => car.id)),
    complete: Boolean(survivor),
    morphed: survivor?.id === "sedan",
    survivor
  });
}

export function birthdayRouteProgress(points = BIRTHDAY_ROUTE) {
  const cumulative = [0];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y
    );
    cumulative.push(total);
  }
  return Object.freeze(cumulative.map((distance) => total > 0 ? distance / total : 0));
}

export function birthdayVehiclePose(angle, { rocket = false } = {}) {
  const finiteAngle = Number.isFinite(Number(angle)) ? Number(angle) : 0;
  const normalized = ((finiteAngle + 180) % 360 + 360) % 360 - 180;
  const facingLeft = normalized > 90 || normalized < -90;
  const uprightAngle = facingLeft
    ? normalized + (normalized > 0 ? -180 : 180)
    : normalized;
  const bankLimit = rocket ? 25 : 10;
  return Object.freeze({
    angle: Math.max(-bankLimit, Math.min(bankLimit, uprightAngle)),
    facing: facingLeft ? "left" : "right",
    scaleX: facingLeft ? -1 : 1
  });
}

function safeStorage(candidate, fallbackName) {
  if (candidate) return candidate;
  try {
    return globalThis[fallbackName] || null;
  } catch {
    return null;
  }
}

function safeGet(storage, key) {
  try {
    return storage?.getItem?.(key) || "";
  } catch {
    return "";
  }
}

function safeSet(storage, key, value) {
  try {
    storage?.setItem?.(key, String(value));
    return true;
  } catch {
    return false;
  }
}

function safeRemove(storage, key) {
  try {
    storage?.removeItem?.(key);
    return true;
  } catch {
    return false;
  }
}

export function isBirthdayVoyageLocalhost(locationRef = globalThis.location) {
  try {
    const hostname = new URL(locationRef?.href || "http://invalid.invalid/").hostname
      .replace(/^\[|\]$/g, "")
      .toLocaleLowerCase("en");
    return hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname === "::1"
      || hostname.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function readBirthdayVoyageCheckpoint(
  storage = safeStorage(null, "localStorage")
) {
  const raw = safeGet(storage, CHECKPOINT_KEY);
  if (!raw) return null;
  try {
    const checkpoint = JSON.parse(raw);
    if (
      !checkpoint
      || checkpoint.version !== BIRTHDAY_VOYAGE_VERSION
      || !["questions", "lion-intro", "route", "finale"].includes(checkpoint.stage)
      || !Array.isArray(checkpoint.completedChapters)
    ) return null;
    return Object.freeze({
      ...checkpoint,
      completedChapters: Object.freeze([...checkpoint.completedChapters]),
      responses: Object.freeze({ ...(checkpoint.responses || {}) })
    });
  } catch {
    return null;
  }
}

export function clearBirthdayVoyageCheckpoint(
  storage = safeStorage(null, "localStorage")
) {
  return safeRemove(storage, CHECKPOINT_KEY);
}

function createElement(documentRef, tag, className = "", attributes = {}) {
  const element = documentRef.createElement(tag);
  if (className) element.className = className;
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) continue;
    element.setAttribute(name, String(value));
  }
  return element;
}

function createSvgElement(documentRef, tag, className = "", attributes = {}) {
  const element = documentRef.createElementNS("http://www.w3.org/2000/svg", tag);
  if (className) element.setAttribute("class", className);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) continue;
    element.setAttribute(name, String(value));
  }
  return element;
}

const styleLoads = new WeakMap();

function ensureStyles(documentRef) {
  if (!documentRef?.head) return Promise.resolve(false);
  if (documentRef.querySelector?.(`[${STYLE_MARKER}]`)) return Promise.resolve(true);
  if (styleLoads.has(documentRef)) return styleLoads.get(documentRef);
  const link = createElement(documentRef, "link", "", {
    rel: "stylesheet",
    href: new URL("./birthday-voyage.css?v=5.0.0-beta.4", import.meta.url).href,
    [STYLE_MARKER]: ""
  });
  const promise = new Promise((resolve) => {
    link.addEventListener("load", () => resolve(true), { once: true });
    link.addEventListener("error", () => resolve(false), { once: true });
    documentRef.head.append(link);
  });
  styleLoads.set(documentRef, promise);
  return promise;
}

function pathThroughPoints(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const controlOne = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6
    };
    const controlTwo = {
      x: next.x - (after.x - current.x) / 6,
      y: next.y - (after.y - current.y) / 6
    };
    path += ` C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${next.x} ${next.y}`;
  }
  return path;
}

function installGuestBadge(documentRef, name) {
  const actions = documentRef.querySelector?.(".start-actions");
  if (!actions) return;
  let badge = documentRef.getElementById("birthdayVoyageGuestBadge");
  if (!badge) {
    badge = createElement(documentRef, "span", "birthday-voyage-guest-badge", {
      id: "birthdayVoyageGuestBadge",
      title: "Name for this play session"
    });
    actions.prepend(badge);
  }
  badge.textContent = `\u2726 ${name}`;
}

function sanitizeGuestName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
}

function birthdayMode(locationRef) {
  try {
    return String(
      new URL(locationRef?.href || "http://localhost/").searchParams.get("birthday") || ""
    ).trim().toLocaleLowerCase("en");
  } catch {
    return "";
  }
}

export function resolveBirthdayVoyageAccess(value, {
  locationRef = globalThis.location,
  honoreeNames = BIRTHDAY_HONOREE_NAMES
} = {}) {
  const mode = birthdayMode(locationRef);
  const localSpecial = mode === "special" && isBirthdayVoyageLocalhost(locationRef);
  const special = localSpecial
    || (mode !== "guest" && isBirthdayHonoree(value, honoreeNames));
  return Object.freeze({
    mode,
    special,
    forceReplay: mode === "replay" || mode === "guest" || localSpecial,
    localSpecial
  });
}

export function currentBirthdayGuestName(
  storage = safeStorage(null, "sessionStorage")
) {
  return sanitizeGuestName(safeGet(storage, SESSION_GUEST_KEY));
}

export function createBirthdayVoyageExperience({
  documentRef = globalThis.document,
  locationRef = globalThis.location,
  storage = safeStorage(null, "localStorage"),
  sessionStorage = safeStorage(null, "sessionStorage"),
  honoreeNames = BIRTHDAY_HONOREE_NAMES,
  audioDirector = null,
  random = Math.random,
  timers = globalThis,
  now = () => globalThis.performance?.now?.() ?? Date.now()
} = {}) {
  let root = null;
  let panel = null;
  let status = null;
  let progress = null;
  let closeButton = null;
  let activeFrame = 0;
  let previousFocus = null;
  let closed = false;
  let renderCleanup = () => {};
  let backgroundState = [];
  let activeGuestName = "";
  let specialAccess = false;
  let checkpointState = null;
  let panelHeadingSequence = 0;
  let previousDocumentTitle = "";
  let unsubscribeAudio = () => {};
  const mode = birthdayMode(locationRef);
  const accessWithoutName = resolveBirthdayVoyageAccess("", { locationRef, honoreeNames });
  const localSpecial = accessWithoutName.localSpecial;
  const forceReplay = accessWithoutName.forceReplay;
  const initialResponses = () => ({
    carId: "",
    car: "",
    removedCarIds: [],
    toyotaMorphed: false,
    animalTyped: "",
    animalSaved: "",
    citySlot: "",
    cityId: "",
    city: "",
    sofiaSwappedSlots: [],
    drinkId: "",
    drink: "",
    resetCount: 0
  });
  let responses = initialResponses();

  const persistCheckpoint = (patch = {}) => {
    if (!specialAccess || !activeGuestName) return false;
    checkpointState = {
      version: BIRTHDAY_VOYAGE_VERSION,
      guestName: BIRTHDAY_HONOREE_DISPLAY_NAME || activeGuestName,
      stage: "questions",
      question: root?.dataset?.question || "car",
      responses: { ...responses },
      completedChapters: [],
      currentDestination: "varna",
      vehicleMode: "car",
      finaleState: "locked",
      ...(checkpointState || {}),
      ...patch,
      responses: { ...responses, ...(patch.responses || {}) },
      completedChapters: Array.from(
        new Set(patch.completedChapters || checkpointState?.completedChapters || [])
      ),
      updatedAt: new Date().toISOString()
    };
    return safeSet(storage, CHECKPOINT_KEY, JSON.stringify(checkpointState));
  };

  const close = ({ completed = false } = {}) => {
    if (closed) return;
    closed = true;
    renderCleanup();
    renderCleanup = () => {};
    if (activeFrame && typeof globalThis.cancelAnimationFrame === "function") {
      globalThis.cancelAnimationFrame(activeFrame);
    }
    if (completed) safeSet(storage, COMPLETION_KEY, new Date().toISOString());
    audioDirector?.exit?.();
    unsubscribeAudio();
    unsubscribeAudio = () => {};
    root?.remove();
    backgroundState.forEach(({ element, inert, inertAttribute, ariaHidden }) => {
      if (inertAttribute === null) element.removeAttribute("inert");
      else element.setAttribute("inert", inertAttribute);
      if ("inert" in element) element.inert = inert;
      if (ariaHidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", ariaHidden);
    });
    backgroundState = [];
    documentRef.body?.classList?.remove("birthday-voyage-active");
    if (previousDocumentTitle) documentRef.title = previousDocumentTitle;
    if (previousFocus?.focus) previousFocus.focus();
  };

  const announce = (message) => {
    if (status) status.textContent = message;
  };

  const setProgress = (step, label) => {
    if (!progress) return;
    progress.textContent = label;
    progress.style.setProperty("--birthday-progress", `${Math.max(0, Math.min(100, step))}%`);
  };

  const setPanel = ({ eyebrow = "", title = "", copy = "" } = {}) => {
    renderCleanup();
    renderCleanup = () => {};
    if (!panel) return null;
    panel.replaceChildren();
    const shell = root?.querySelector?.(".birthday-voyage__shell");
    if (shell) shell.scrollTop = 0;
    const header = createElement(documentRef, "header", "birthday-voyage__question-header");
    if (eyebrow) {
      const eyebrowNode = createElement(documentRef, "span", "birthday-voyage__eyebrow");
      eyebrowNode.textContent = eyebrow;
      header.append(eyebrowNode);
    }
    const heading = createElement(documentRef, "h2", "", {
      id: `birthdayVoyagePanelTitle${++panelHeadingSequence}`,
      tabindex: "-1"
    });
    heading.textContent = title;
    const paragraph = createElement(documentRef, "p");
    paragraph.textContent = copy;
    header.append(heading, paragraph);
    panel.append(header);
    root?.setAttribute?.("aria-labelledby", heading.id);
    heading.focus?.({ preventScroll: true });
    announce("");
    return panel;
  };

  const schedule = (callback, delay = 450) => {
    timers.setTimeout(() => {
      if (!closed) callback();
    }, delay);
  };

  const appendQuestionNavigation = (target, {
    onBack,
    onReset,
    onNext,
    nextLabel = "Next question",
    nextEnabled = false,
    nextArrow = true
  } = {}) => {
    const navigation = createElement(documentRef, "nav", "birthday-voyage__question-nav", {
      "aria-label": "Question navigation"
    });
    const backButton = createElement(documentRef, "button", "birthday-voyage__secondary", {
      type: "button"
    });
    backButton.textContent = "\u2190 Back";
    backButton.disabled = typeof onBack !== "function";
    if (typeof onBack === "function") {
      backButton.addEventListener("click", onBack);
    }
    let resetButton = null;
    if (typeof onReset === "function") {
      navigation.classList.add("has-reset");
      resetButton = createElement(documentRef, "button", "birthday-voyage__secondary birthday-voyage__reset", {
        type: "button"
      });
      resetButton.textContent = "Reset questionnaire";
      resetButton.addEventListener("click", onReset);
    }
    const nextButton = createElement(documentRef, "button", "birthday-voyage__primary", {
      type: "button"
    });
    nextButton.textContent = nextArrow ? `${nextLabel} \u2192` : nextLabel;
    nextButton.disabled = !nextEnabled;
    if (typeof onNext === "function") {
      nextButton.addEventListener("click", onNext);
    }
    navigation.append(backButton);
    if (resetButton) navigation.append(resetButton);
    navigation.append(nextButton);
    target.append(navigation);
    return Object.freeze({ backButton, resetButton, nextButton });
  };

  const runRouteAnimation = (guestName, resumeState = null) => {
    renderCleanup();
    renderCleanup = () => {};
    root.dataset.stage = "route";
    root.dataset.routeMode = "first-run";
    progress.hidden = true;
    panel.replaceChildren();
    announce("Our route is ready. Varna is waiting at the beginning.");
    audioDirector?.startMusic?.("varna");
    const reducedMotion = documentRef.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    const compactRoute = documentRef.defaultView?.matchMedia?.(
      "(max-width: 580px), ((max-height: 540px) and (pointer: coarse))"
    )?.matches === true;
    const supportsHover = documentRef.defaultView?.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches === true;
    const activationVerb = supportsHover ? "Hover" : "Tap";
    const giftUnwrapDuration = reducedMotion ? 0 : 720;
    const cardFlipDelay = reducedMotion ? 0 : 680;
    const arrivalPause = reducedMotion ? 0 : 260;
    const previewFlipDuration = reducedMotion ? 0 : 780;
    const previewShrinkDuration = reducedMotion ? 0 : 460;
    const routeHeight = compactRoute ? 1_900 : 600;
    const routePoints = Object.freeze(BIRTHDAY_ROUTE.map((destination) => Object.freeze(
      compactRoute
        ? { x: destination.mobileX, y: destination.mobileY }
        : { x: destination.x, y: destination.y }
    )));
    const pointFor = (index) => routePoints[Math.max(0, Math.min(routePoints.length - 1, index))];
    const routeStartPoint = compactRoute
      ? Object.freeze({ x: 500, y: 42 })
      : Object.freeze({ x: 82, y: 245 });
    const recipientName = sanitizeGuestName(BIRTHDAY_HONOREE_DISPLAY_NAME) || guestName;
    const giverName = sanitizeGuestName(BIRTHDAY_GIVER_NAME) || "Yane";
    const finalMessage = String(BIRTHDAY_FINAL_MESSAGE || "").trim()
      || "Wherever the stars take us, I want the seat beside you.";

    const scene = createElement(documentRef, "section", "birthday-voyage__route", {
      "aria-label": "Our journey together from Varna to the cosmos"
    });
    const heading = createElement(documentRef, "header", "birthday-voyage__route-heading");
    const headingCopy = createElement(documentRef, "div", "birthday-voyage__route-heading-copy");
    const eyebrow = createElement(documentRef, "span", "birthday-voyage__eyebrow");
    eyebrow.textContent = "WHEREVER THE STARS TAKE US";
    const title = createElement(documentRef, "h2");
    title.textContent = "Our Journey";
    const subtitle = createElement(documentRef, "p");
    subtitle.textContent = `${BIRTHDAY_INTERFACE_PAIR || `${recipientName} + ${giverName}`} \u00b7 every road, every world, together.`;
    const routePrompt = createElement(documentRef, "strong", "birthday-voyage__route-prompt");
    routePrompt.textContent = `${activationVerb} Varna to begin`;
    headingCopy.append(eyebrow, title, subtitle);
    heading.append(headingCopy, routePrompt);

    const board = createElement(documentRef, "div", "birthday-voyage__route-board", {
      "data-route-phase": "waiting",
      "data-route-index": "0",
      "data-route-mode": "first-run",
      "data-route-scene": "varna",
      "data-parking-phase": "staged",
      "data-layout": compactRoute ? "mobile" : "desktop",
      style: `--route-view-height:${routeHeight}`
    });
    const ambienceLayers = [0, 1].map((index) => createElement(
      documentRef,
      "img",
      `birthday-voyage__route-ambience${index === 0 ? " is-active" : ""}`,
      {
        src: BIRTHDAY_ROUTE[0].poster || BIRTHDAY_ROUTE[0].previewImage || BIRTHDAY_ROUTE[0].image,
        alt: "",
        "aria-hidden": "true"
      }
    ));
    board.append(...ambienceLayers);
    const svg = createSvgElement(documentRef, "svg", "birthday-voyage__route-line", {
      viewBox: `0 0 1000 ${routeHeight}`,
      preserveAspectRatio: "none",
      "aria-hidden": "true"
    });
    const routePath = createSvgElement(documentRef, "path", "birthday-voyage__route-shadow", {
      d: pathThroughPoints(routePoints)
    });
    const stripedPath = createSvgElement(documentRef, "path", "birthday-voyage__route-stripes", {
      d: pathThroughPoints(routePoints)
    });
    svg.append(routePath, stripedPath);
    board.append(svg);

    const parkingSideFor = (destination, index) => {
      const point = pointFor(index);
      if (point.x <= 280) return "right";
      if (point.x >= 720) return "left";
      return index % 2 === 0 ? "right" : "left";
    };

    const cardEntries = BIRTHDAY_ROUTE.map((destination, index) => {
      const routePoint = pointFor(index);
      const vfxHue = destination.kind === "city"
        ? 178 + index * 12
        : 258 + (index - 6) * 18;
      const card = createElement(documentRef, "article", "birthday-voyage__route-card", {
        "data-kind": destination.kind,
        "data-destination": destination.id,
        "data-route-status": "waiting",
        "data-gift-state": "wrapped",
        "data-prompt-state": "waiting",
        "data-scene-preset": destination.scenePreset,
        "data-sound-preset": destination.soundPreset,
        style: [
          `--route-x:${routePoint.x / 10}%`,
          `--route-y:${routePoint.y / routeHeight * 100}%`,
          `--route-delay:${index}`,
          `--vfx-level:${index + 1}`,
          `--vfx-hue:${vfxHue}`
        ].join(";")
      });
      if (index === 0) card.classList.add("is-special");
      const trigger = createElement(documentRef, "button", "birthday-voyage__route-card-trigger", {
        type: "button",
        "aria-label": `${destination.label} is waiting`,
        "aria-haspopup": "dialog",
        "aria-controls": "birthdayRouteCardPreview",
        "aria-expanded": "false",
        title: `${destination.label} is waiting`
      });
      trigger.disabled = true;
      const inner = createElement(documentRef, "span", "birthday-voyage__route-card-inner", {
        "aria-hidden": "true"
      });
      const front = createElement(documentRef, "span", "birthday-voyage__route-card-face birthday-voyage__route-card-front");
      const ordinal = createElement(documentRef, "span");
      ordinal.textContent = String(index + 1).padStart(2, "0");
      const frontLabel = createElement(documentRef, "b");
      frontLabel.textContent = "Waiting...";
      front.append(ordinal, frontLabel);
      const back = createElement(documentRef, "span", "birthday-voyage__route-card-face birthday-voyage__route-card-back");
      const label = createElement(documentRef, "strong");
      label.textContent = destination.label;
      const image = createElement(documentRef, "img", "", {
        src: destination.thumb || destination.image,
        alt: destination.alt,
        loading: compactRoute && index > 1 ? "lazy" : "eager",
        decoding: "async"
      });
      image.addEventListener("error", () => {
        if (image.dataset.fallbackAttempted === "true") {
          card.dataset.mediaError = "true";
          image.hidden = true;
          return;
        }
        image.dataset.fallbackAttempted = "true";
        image.src = destination.poster || destination.image;
      });
      back.append(label, image);
      inner.append(front, back);
      const revisitBadge = createElement(documentRef, "span", "birthday-voyage__route-card-revisit", {
        "aria-hidden": "true"
      });
      revisitBadge.textContent = "Click to revisit";
      const giftWrap = createElement(
        documentRef,
        "span",
        "birthday-voyage__gift-wrap gift-wrap",
        { "aria-hidden": "true" }
      );
      const giftPaper = createElement(documentRef, "span", "birthday-voyage__gift-paper");
      const giftRibbon = createElement(documentRef, "span", "birthday-voyage__gift-ribbon");
      const giftLid = createElement(documentRef, "span", "birthday-voyage__gift-lid");
      const giftBow = createElement(documentRef, "span", "birthday-voyage__gift-bow");
      giftLid.append(giftBow);
      giftWrap.append(giftPaper, giftRibbon, giftLid);
      const giftPrompt = createElement(
        documentRef,
        "span",
        "birthday-voyage__gift-prompt",
        {
          "aria-hidden": "true",
          "data-activation-verb": activationVerb.toLocaleLowerCase("en"),
          "data-prompt-state": "waiting"
        }
      );
      giftPrompt.hidden = true;
      const giftPromptKicker = createElement(
        documentRef,
        "span",
        "birthday-voyage__gift-prompt-kicker",
        { "aria-hidden": "true" }
      );
      giftPromptKicker.textContent = "Next gift";
      const giftPromptLabel = createElement(
        documentRef,
        "b",
        "birthday-voyage__gift-prompt-label"
      );
      giftPromptLabel.textContent = "Waiting...";
      giftPrompt.append(giftPromptKicker, giftPromptLabel);
      const parkingKind = destination.kind === "city" ? "parking" : "dock";
      const parkingSide = parkingSideFor(destination, index);
      const parkingSign = createElement(
        documentRef,
        "span",
        "birthday-voyage__parking-sign",
        {
          "aria-hidden": "true",
          "data-parking-kind": parkingKind,
          "data-side": parkingSide
        }
      );
      const parkingSignGlyph = createElement(documentRef, "b", "birthday-voyage__parking-sign-glyph");
      parkingSignGlyph.textContent = parkingKind === "parking" ? "P" : "\u2726";
      const parkingSignLabel = createElement(documentRef, "small", "birthday-voyage__parking-sign-label");
      parkingSignLabel.textContent = parkingKind === "parking" ? "PARK" : "DOCK";
      parkingSign.append(parkingSignGlyph, parkingSignLabel);
      trigger.append(inner, giftWrap, giftPrompt, revisitBadge);
      card.append(trigger, parkingSign);
      board.append(card);
      return Object.freeze({
        card,
        trigger,
        frontLabel,
        giftPrompt,
        giftPromptLabel,
        revisitBadge,
        parkingSign,
        parkingSide,
        destination,
        index
      });
    });
    const cards = cardEntries.map(({ card }) => card);

    const setCardPrompt = (entry, text, state, visible = false) => {
      entry.frontLabel.textContent = text;
      entry.giftPromptLabel.textContent = text;
      entry.giftPrompt.dataset.promptState = state;
      entry.card.dataset.promptState = state;
      entry.giftPrompt.hidden = !visible;
    };

    const vehicle = createElement(documentRef, "div", "birthday-voyage__vehicle is-staged", {
      "data-position": "before-varna",
      "data-parking-phase": "staged",
      "data-travel-mode": "car"
    });
    const car = createElement(documentRef, "img", "birthday-voyage__vehicle-car", {
      src: `${ASSET_ROOT}/01-toyota-rav4-2002-gray-right-transparent.webp`,
      alt: ""
    });
    const passengers = createElement(documentRef, "span", "birthday-voyage__vehicle-passengers");
    passengers.textContent = "\u2665";
    const rocket = createElement(documentRef, "img", "birthday-voyage__vehicle-rocket", {
      src: `${ASSET_ROOT}/13-rav4-spaceship-right-transparent.webp`,
      alt: "",
      "aria-hidden": "true"
    });
    vehicle.append(car, passengers, rocket);
    board.append(vehicle);

    let routeStopped = false;
    let activeRouteIndex = 0;
    let vehicleRouteIndex = -1;
    let routeMode = "first-run";
    let routeBusy = false;
    let journeyComplete = false;
    const completedChapterIds = new Set(resumeState?.completedChapters || []);
    let birthdayMessageReason = "skip";
    let birthdayMessageCloseAuthorized = false;
    let activeAmbienceIndex = 0;
    let activePreviewEntry = null;
    let previewClosing = false;
    let previewStartTimer = 0;
    let previewHoldTimer = 0;
    let previewChapterTimer = 0;
    let previewChapterToken = 0;
    let previewMediaToken = 0;
    let previewChapterSettleCleanup = () => {};
    let abortPreviewMediaPreparation = () => {};
    let resolvePreviewCardOpen = () => {};
    let rescheduleActivePreviewClose = () => {};
    let finaleRevealTimer = 0;
    let activationMode = "pointer";
    let activeFrameKind = "";
    const routeTimeouts = new Set();
    const hoverIntentTimers = new Map();
    const preloadedMedia = new Map();

    const fatePreview = createElement(documentRef, "dialog", "birthday-voyage__route-preview", {
      id: "birthdayRouteCardPreview",
      "aria-labelledby": "birthdayRoutePreviewTitle",
      "aria-describedby": "birthdayRoutePreviewContext",
      "data-autoclose-ms": String(BIRTHDAY_ROUTE_PREVIEW_MS),
      "data-chapter-intro-ms": String(BIRTHDAY_CHAPTER_INTRO_MS),
      "data-chapter-phase": "idle"
    });
    const fatePreviewHeader = createElement(documentRef, "header", "birthday-voyage__route-preview-header");
    const fatePreviewHeading = createElement(documentRef, "div");
    const fatePreviewEyebrow = createElement(documentRef, "span", "birthday-voyage__eyebrow");
    fatePreviewEyebrow.textContent = "NOW PLAYING IN THE STARS";
    const fatePreviewTitle = createElement(documentRef, "h3", "", {
      id: "birthdayRoutePreviewTitle"
    });
    const fatePreviewClose = createElement(documentRef, "button", "birthday-voyage__route-preview-close", {
      type: "button",
      "aria-label": "Skip destination preview"
    });
    fatePreviewClose.textContent = "\u00d7";
    fatePreviewHeading.append(fatePreviewEyebrow, fatePreviewTitle);
    fatePreviewHeader.append(fatePreviewHeading, fatePreviewClose);

    const fatePreviewCard = createElement(documentRef, "div", "birthday-voyage__route-preview-card", {
      "aria-hidden": "true"
    });
    const fatePreviewInner = createElement(documentRef, "div", "birthday-voyage__route-preview-card-inner");
    const fatePreviewFront = createElement(documentRef, "div", "birthday-voyage__route-preview-card-face birthday-voyage__route-preview-card-front");
    const fatePreviewOrdinal = createElement(documentRef, "span");
    const fatePreviewFrontLabel = createElement(documentRef, "b");
    fatePreviewFrontLabel.textContent = "Opening our next chapter";
    fatePreviewFront.append(fatePreviewOrdinal, fatePreviewFrontLabel);
    const fatePreviewBack = createElement(documentRef, "div", "birthday-voyage__route-preview-card-face birthday-voyage__route-preview-card-back");
    const fatePreviewBackLabel = createElement(documentRef, "strong");
    const fatePreviewImage = createElement(documentRef, "img", "", { alt: "" });
    const fatePreviewVideo = createElement(documentRef, "video", "birthday-voyage__route-preview-video", {
      playsinline: "",
      muted: "",
      preload: "metadata",
      "aria-label": "Destination memory"
    });
    fatePreviewVideo.hidden = true;
    fatePreviewVideo.muted = true;
    fatePreviewBack.append(fatePreviewBackLabel, fatePreviewImage, fatePreviewVideo);
    fatePreviewInner.append(fatePreviewFront, fatePreviewBack);
    fatePreviewCard.append(fatePreviewInner);
    const fatePreviewChapterStage = createElement(
      documentRef,
      "section",
      "birthday-voyage__route-preview-chapter-stage",
      {
        "aria-labelledby": "birthdayRoutePreviewChapterTitle",
        "aria-describedby": "birthdayRoutePreviewContext",
        "data-chapter-phase": "idle"
      }
    );
    const fatePreviewChapterKicker = createElement(
      documentRef,
      "span",
      "birthday-voyage__route-preview-chapter-kicker",
      { "aria-hidden": "true" }
    );
    const fatePreviewChapterTitle = createElement(
      documentRef,
      "h4",
      "birthday-voyage__route-preview-chapter-title",
      { id: "birthdayRoutePreviewChapterTitle", tabindex: "-1" }
    );
    const fatePreviewContext = createElement(
      documentRef,
      "p",
      "birthday-voyage__route-preview-context birthday-voyage__route-preview-chapter-copy",
      { id: "birthdayRoutePreviewContext" }
    );
    fatePreviewChapterStage.append(
      fatePreviewChapterKicker,
      fatePreviewChapterTitle,
      fatePreviewContext
    );
    const fatePreviewProgress = createElement(documentRef, "span", "birthday-voyage__route-preview-progress", {
      "aria-hidden": "true"
    });
    fatePreviewProgress.append(createElement(documentRef, "i"));
    const fatePreviewManual = createElement(
      documentRef,
      "div",
      "birthday-voyage__route-preview-manual"
    );
    fatePreviewManual.hidden = !reducedMotion;
    const fatePreviewReplay = createElement(documentRef, "button", "birthday-voyage__secondary", {
      type: "button",
      disabled: ""
    });
    fatePreviewReplay.textContent = "Replay chapter";
    const fatePreviewContinue = createElement(documentRef, "button", "birthday-voyage__primary", {
      type: "button"
    });
    fatePreviewContinue.textContent = "Continue our journey";
    fatePreviewManual.append(fatePreviewReplay, fatePreviewContinue);
    fatePreview.append(
      fatePreviewHeader,
      fatePreviewCard,
      fatePreviewChapterStage,
      fatePreviewProgress,
      fatePreviewManual
    );

    const birthdayMessageDialog = createElement(
      documentRef,
      "dialog",
      "birthday-voyage__reexplore birthday-voyage__birthday-message",
      {
        id: "birthdayRouteBirthdayMessage",
        "aria-labelledby": "birthdayRouteBirthdayMessageTitle",
        "aria-describedby": "birthdayRouteBirthdayMessageDedication"
      }
    );
    const birthdayMessageGlow = createElement(documentRef, "span", "birthday-voyage__reexplore-glow", {
      "aria-hidden": "true"
    });
    const birthdayMessageEyebrow = createElement(documentRef, "span", "birthday-voyage__eyebrow");
    birthdayMessageEyebrow.textContent = "THE CONSTELLATION WE KEEP CHOOSING";
    const finaleConstellation = createElement(
      documentRef,
      "div",
      "birthday-voyage__finale-constellation",
      { "aria-hidden": "true" }
    );
    for (let starIndex = 0; starIndex < 13; starIndex += 1) {
      finaleConstellation.append(createElement(documentRef, "i", "", {
        style: `--finale-star:${starIndex}`
      }));
    }
    const finaleSignature = createElement(
      documentRef,
      "p",
      "birthday-voyage__finale-signature"
    );
    finaleSignature.textContent = BIRTHDAY_FINALE_SIGNATURE || "София ✦ Яне";
    const birthdayMessageTitle = createElement(documentRef, "h3", "", {
      id: "birthdayRouteBirthdayMessageTitle"
    });
    birthdayMessageTitle.textContent = `Happy birthday, ${recipientName}.`;
    const birthdayMessageDedication = createElement(documentRef, "blockquote", "birthday-voyage__birthday-message-dedication birthday-voyage__finale-dedication", {
      id: "birthdayRouteBirthdayMessageDedication"
    });
    birthdayMessageDedication.textContent = finalMessage;
    const birthdayMessageHint = createElement(documentRef, "p", "birthday-voyage__birthday-message-hint");
    birthdayMessageHint.textContent = "Every destination will stay here for us to revisit.";
    const birthdayMessageActions = createElement(documentRef, "div", "birthday-voyage__reexplore-actions birthday-voyage__finale-actions");
    const birthdayMessageReturn = createElement(documentRef, "button", "birthday-voyage__primary", {
      type: "button"
    });
    birthdayMessageReturn.textContent = "Re-explore any chapter";
    const birthdayMessageReplayAll = createElement(documentRef, "button", "birthday-voyage__secondary", {
      type: "button"
    });
    birthdayMessageReplayAll.textContent = "Watch our whole journey again";
    const birthdayMessageFinish = createElement(documentRef, "button", "birthday-voyage__secondary", {
      type: "button"
    });
    birthdayMessageFinish.classList.add("birthday-voyage__finale-tertiary");
    birthdayMessageFinish.textContent = "Continue to Constellore";
    const finaleReveal = createElement(documentRef, "button", "birthday-voyage__primary birthday-voyage__finale-reveal", {
      type: "button"
    });
    finaleReveal.textContent = "Read the dedication";
    finaleReveal.hidden = true;
    birthdayMessageActions.append(
      birthdayMessageReturn,
      birthdayMessageReplayAll,
      birthdayMessageFinish
    );
    birthdayMessageDialog.append(
      birthdayMessageGlow,
      birthdayMessageEyebrow,
      finaleConstellation,
      finaleSignature,
      birthdayMessageTitle,
      birthdayMessageDedication,
      birthdayMessageHint,
      finaleReveal,
      birthdayMessageActions
    );

    const journeyOptions = createElement(documentRef, "div", "birthday-voyage__journey-options");
    const journeyOptionsToggle = createElement(
      documentRef,
      "button",
      "birthday-voyage__options-toggle",
      {
        type: "button",
        "aria-expanded": "false",
        "aria-controls": "birthdayJourneyOptionsMenu"
      }
    );
    journeyOptionsToggle.textContent = "Journey Options";
    const journeyOptionsMenu = createElement(
      documentRef,
      "div",
      "birthday-voyage__options-menu",
      {
        id: "birthdayJourneyOptionsMenu",
        role: "menu"
      }
    );
    journeyOptionsMenu.hidden = true;
    const skip = createElement(documentRef, "button", "birthday-voyage__options-action birthday-voyage__route-skip", {
      type: "button"
    });
    skip.setAttribute("role", "menuitem");
    skip.textContent = "Go to the final moment";
    journeyOptionsMenu.append(skip);
    journeyOptions.append(journeyOptionsToggle, journeyOptionsMenu);

    const optionsConfirm = createElement(documentRef, "dialog", "birthday-voyage__options-confirm", {
      "aria-labelledby": "birthdayJourneyOptionsConfirmTitle",
      "aria-describedby": "birthdayJourneyOptionsConfirmCopy"
    });
    const optionsConfirmTitle = createElement(documentRef, "h3", "", {
      id: "birthdayJourneyOptionsConfirmTitle"
    });
    optionsConfirmTitle.textContent = "Leave the current chapter?";
    const optionsConfirmCopy = createElement(documentRef, "p", "", {
      id: "birthdayJourneyOptionsConfirmCopy"
    });
    optionsConfirmCopy.textContent = "This will move directly to the final moment. Your place in the journey will still be saved.";
    const optionsConfirmActions = createElement(documentRef, "div", "birthday-voyage__resume-actions");
    const optionsStay = createElement(documentRef, "button", "birthday-voyage__secondary", { type: "button" });
    optionsStay.textContent = "Keep exploring";
    const optionsLeave = createElement(documentRef, "button", "birthday-voyage__primary", { type: "button" });
    optionsLeave.textContent = "Go to the final moment";
    optionsConfirmActions.append(optionsStay, optionsLeave);
    optionsConfirm.append(optionsConfirmTitle, optionsConfirmCopy, optionsConfirmActions);
    const routeTouchHint = createElement(documentRef, "p", "birthday-voyage__route-touch-hint");
    routeTouchHint.textContent = "Tap any chapter to revisit it.";
    scene.append(
      heading,
      board,
      routeTouchHint,
      journeyOptions,
      fatePreview,
      birthdayMessageDialog,
      optionsConfirm
    );
    panel.append(scene);

    const setRoutePhase = (phase, index = activeRouteIndex) => {
      root.dataset.routePhase = phase;
      root.dataset.routeIndex = String(index);
      board.dataset.routePhase = phase;
      board.dataset.routeIndex = String(index);
    };

    const setBoardContext = (entry) => {
      if (!entry) return;
      const { destination, index } = entry;
      const sceneHues = [194, 38, 198, 22, 275, 328, 202, 218, 12, 270, 308];
      root.dataset.routeScene = destination.id;
      board.dataset.routeScene = destination.id;
      board.dataset.routeKind = destination.kind;
      board.dataset.routeAct = destination.act;
      board.dataset.scenePreset = destination.scenePreset;
      root.dataset.routeAct = destination.act;
      root.dataset.scenePreset = destination.scenePreset;
      audioDirector?.setMusicAct?.(destination.act);
      board.style.setProperty("--scene-hue", String(sceneHues[index] ?? 250));
      routePrompt.textContent = routeMode === "reexplore"
        ? `${destination.label} \u00b7 select any chapter to travel`
        : `Next: ${destination.label} \u00b7 ${activationVerb.toLocaleLowerCase("en")} to travel`;
      const nextDestination = BIRTHDAY_ROUTE[index + 1];
      const warmMedia = [
        destination.poster,
        previewVideoSource(destination),
        nextDestination?.thumb
      ].filter(Boolean).slice(0, 3);
      audioDirector?.cacheMedia?.(warmMedia);

      const currentLayer = ambienceLayers[activeAmbienceIndex];
      const ambienceSource = destination.poster || destination.previewImage || destination.image;
      if (currentLayer?.getAttribute("src") !== ambienceSource) {
        const nextAmbienceIndex = activeAmbienceIndex === 0 ? 1 : 0;
        const nextLayer = ambienceLayers[nextAmbienceIndex];
        nextLayer.src = ambienceSource;
        nextLayer.dataset.scene = destination.id;
        nextLayer.classList.add("is-active");
        currentLayer?.classList.remove("is-active");
        activeAmbienceIndex = nextAmbienceIndex;
      }
      if (compactRoute) {
        routeAfter(() => entry.card.scrollIntoView?.({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "center",
          inline: "center"
        }), reducedMotion ? 0 : 90);
      }
    };

    const routeAfter = (callback, delay) => {
      const timer = timers.setTimeout(() => {
        routeTimeouts.delete(timer);
        if (!routeStopped && !closed && root?.isConnected) callback();
      }, Math.max(0, delay));
      routeTimeouts.add(timer);
      return timer;
    };

    const clearRouteTimers = () => {
      previewMediaToken += 1;
      abortPreviewMediaPreparation();
      abortPreviewMediaPreparation = () => {};
      resolvePreviewCardOpen();
      resolvePreviewCardOpen = () => {};
      rescheduleActivePreviewClose = () => {};
      previewChapterSettleCleanup();
      previewChapterSettleCleanup = () => {};
      for (const timer of routeTimeouts) timers.clearTimeout?.(timer);
      routeTimeouts.clear();
      previewStartTimer = 0;
      previewHoldTimer = 0;
      previewChapterTimer = 0;
      finaleRevealTimer = 0;
      previewChapterToken += 1;
      delete fatePreview.dataset.chapterSettled;
      fatePreview.dataset.chapterPhase = "idle";
      fatePreviewChapterStage.dataset.chapterPhase = "idle";
    };

    const cancelRouteTimer = (timer) => {
      if (!timer) return;
      timers.clearTimeout?.(timer);
      routeTimeouts.delete(timer);
    };

    const setPreviewChapterPhase = (phase) => {
      fatePreview.dataset.chapterPhase = phase;
      fatePreviewChapterStage.dataset.chapterPhase = phase;
    };

    const resetPreviewChapterStage = (phase = "idle") => {
      previewChapterSettleCleanup();
      previewChapterSettleCleanup = () => {};
      cancelRouteTimer(previewChapterTimer);
      previewChapterTimer = 0;
      previewChapterToken += 1;
      delete fatePreview.dataset.chapterSettled;
      setPreviewChapterPhase(phase);
    };

    const startPreviewChapterStage = (entry, onSettled = () => {}) => {
      previewChapterSettleCleanup();
      previewChapterSettleCleanup = () => {};
      cancelRouteTimer(previewChapterTimer);
      previewChapterTimer = 0;
      const token = ++previewChapterToken;
      delete fatePreview.dataset.chapterSettled;
      setPreviewChapterPhase("intro");
      const isCurrentChapter = () => (
        token === previewChapterToken
        && fatePreview.open
        && !previewClosing
        && activePreviewEntry === entry
      );
      const finishSettlement = () => {
        if (!isCurrentChapter()) return;
        previewChapterSettleCleanup();
        previewChapterSettleCleanup = () => {};
        cancelRouteTimer(previewChapterTimer);
        previewChapterTimer = 0;
        fatePreview.dataset.chapterSettled = "true";
        onSettled();
      };
      previewChapterTimer = routeAfter(() => {
        previewChapterTimer = 0;
        if (!isCurrentChapter()) return;
        setPreviewChapterPhase("rail");
        if (reducedMotion) {
          finishSettlement();
          return;
        }
        const handleRailAnimationEnd = (event) => {
          if (
            event.target !== fatePreviewChapterStage
            || event.animationName !== "birthday-route-chapter-to-rail"
          ) return;
          finishSettlement();
        };
        fatePreviewChapterStage.addEventListener("animationend", handleRailAnimationEnd);
        previewChapterSettleCleanup = () => {
          fatePreviewChapterStage.removeEventListener("animationend", handleRailAnimationEnd);
        };
        previewChapterTimer = routeAfter(finishSettlement, BIRTHDAY_CHAPTER_RAIL_SETTLE_MS);
      }, reducedMotion ? 0 : BIRTHDAY_CHAPTER_INTRO_MS);
    };

    const setPreviewChapterContent = (destination, index) => {
      const chapterParts = String(destination.chapter || "")
        .split(/\s*\u00b7\s*/)
        .filter(Boolean);
      fatePreviewChapterKicker.textContent = chapterParts.shift()
        || `Chapter ${String(index + 1).padStart(2, "0")}`;
      fatePreviewChapterTitle.textContent = chapterParts.join(" \u00b7 ")
        || destination.label;
      fatePreviewContext.textContent = destination.caption;
    };

    const previewImageSource = (destination) => String(
      destination?.poster || destination?.previewImage || destination?.image || ""
    ).trim();

    const previewDurationFor = (destination) => {
      const duration = Number(destination?.durationMs);
      return Number.isFinite(duration) && duration >= 1_000
        ? duration
        : BIRTHDAY_ROUTE_PREVIEW_MS;
    };

    const previewVideoSource = (destination) => {
      const sources = Array.from(destination?.videoSources || []);
      if (destination?.video) sources.push(destination.video);
      for (const candidate of sources) {
        const value = typeof candidate === "string" ? candidate : candidate?.src;
        if (String(value || "").trim()) return String(value).trim();
      }
      return "";
    };

    const preloadDestination = (destination) => {
      if (!destination || preloadedMedia.has(destination.id)) return;
      const videoSource = previewVideoSource(destination);
      if (videoSource) {
        const video = createElement(documentRef, "video", "", {
          preload: "auto",
          muted: "",
          playsinline: ""
        });
        video.muted = true;
        video.src = videoSource;
        video.load?.();
        preloadedMedia.set(destination.id, video);
        return;
      }
      const source = previewImageSource(destination);
      if (!source) return;
      const image = createElement(documentRef, "img");
      image.src = source;
      preloadedMedia.set(destination.id, image);
    };

    const waitForImageReady = (image) => new Promise((resolve) => {
      let settled = false;
      let timeout = 0;
      let abort = () => {};
      const settle = (ready) => {
        if (settled) return;
        settled = true;
        cancelRouteTimer(timeout);
        image.removeEventListener("load", handleLoad);
        image.removeEventListener("error", handleError);
        if (abortPreviewMediaPreparation === abort) {
          abortPreviewMediaPreparation = () => {};
        }
        resolve(Boolean(ready));
      };
      abort = () => settle(false);
      abortPreviewMediaPreparation();
      abortPreviewMediaPreparation = abort;
      const decodeLoadedImage = () => {
        if (!image.naturalWidth) {
          settle(false);
          return;
        }
        const decoded = image.decode?.();
        if (decoded?.then) {
          decoded.then(() => settle(true)).catch(() => settle(image.naturalWidth > 0));
        } else {
          settle(true);
        }
      };
      const handleLoad = () => decodeLoadedImage();
      const handleError = () => settle(false);
      image.addEventListener("load", handleLoad, { once: true });
      image.addEventListener("error", handleError, { once: true });
      timeout = routeAfter(() => settle(false), 7_000);
      if (image.complete) {
        if (image.naturalWidth > 0) decodeLoadedImage();
        else settle(false);
      }
    });

    const waitForVideoReady = (video) => new Promise((resolve) => {
      let settled = false;
      let timeout = 0;
      let abort = () => {};
      const settle = (ready) => {
        if (settled) return;
        settled = true;
        cancelRouteTimer(timeout);
        video.removeEventListener("canplay", handleReady);
        video.removeEventListener("loadeddata", handleReady);
        video.removeEventListener("error", handleError);
        if (abortPreviewMediaPreparation === abort) {
          abortPreviewMediaPreparation = () => {};
        }
        resolve(Boolean(ready));
      };
      abort = () => settle(false);
      abortPreviewMediaPreparation();
      abortPreviewMediaPreparation = abort;
      const handleReady = () => settle(true);
      const handleError = () => settle(false);
      video.addEventListener("canplay", handleReady, { once: true });
      video.addEventListener("loadeddata", handleReady, { once: true });
      video.addEventListener("error", handleError, { once: true });
      timeout = routeAfter(() => settle(false), 7_000);
      if (video.readyState >= 3) settle(true);
    });

    const preparePreviewImage = async (destination, isCurrentPreview = () => true) => {
      if (!isCurrentPreview()) return Object.freeze({ kind: "stale", source: "" });
      const preferredSource = previewImageSource(destination);
      const fallbackSource = String(destination.poster || destination.image || "").trim();
      const sources = [...new Set([preferredSource, fallbackSource].filter(Boolean))];
      fatePreviewVideo.pause?.();
      fatePreviewVideo.hidden = true;
      fatePreviewImage.hidden = false;
      for (const source of sources) {
        if (!isCurrentPreview()) return Object.freeze({ kind: "stale", source: "" });
        fatePreviewImage.src = source;
        fatePreviewImage.alt = destination.alt || `${destination.label} destination`;
        const ready = await waitForImageReady(fatePreviewImage);
        if (!isCurrentPreview()) return Object.freeze({ kind: "stale", source: "" });
        if (ready) {
          delete fatePreview.dataset.mediaError;
          return Object.freeze({ kind: "image", source });
        }
      }
      if (!isCurrentPreview()) return Object.freeze({ kind: "stale", source: "" });
      fatePreviewImage.hidden = true;
      fatePreview.dataset.mediaError = "true";
      fatePreviewContext.textContent = `${destination.caption} The picture is taking the scenic route.`;
      return Object.freeze({ kind: "fallback", source: "" });
    };

    const preparePreviewMedia = async (destination, isCurrentPreview = () => true) => {
      if (!isCurrentPreview()) return Object.freeze({ kind: "stale", source: "" });
      delete fatePreview.dataset.mediaError;
      const videoSource = previewVideoSource(destination);
      if (!videoSource) return preparePreviewImage(destination, isCurrentPreview);
      fatePreviewImage.hidden = true;
      fatePreviewVideo.hidden = false;
      fatePreviewVideo.src = videoSource;
      fatePreviewVideo.currentTime = 0;
      fatePreviewVideo.load?.();
      const ready = await waitForVideoReady(fatePreviewVideo);
      if (!isCurrentPreview()) return Object.freeze({ kind: "stale", source: "" });
      if (ready) {
        return Object.freeze({ kind: "video", source: videoSource });
      }
      return preparePreviewImage(destination, isCurrentPreview);
    };

    const requestRouteFrame = (callback) => {
      const requestFrame = documentRef.defaultView?.requestAnimationFrame
        || globalThis.requestAnimationFrame;
      if (typeof requestFrame === "function") {
        activeFrameKind = "raf";
        activeFrame = requestFrame.call(documentRef.defaultView || globalThis, callback);
        return;
      }
      activeFrameKind = "timeout";
      activeFrame = timers.setTimeout(callback, 16);
    };

    const cancelRouteFrame = () => {
      if (!activeFrame) return;
      if (activeFrameKind === "raf") {
        const cancelFrame = documentRef.defaultView?.cancelAnimationFrame
          || globalThis.cancelAnimationFrame;
        cancelFrame?.call?.(documentRef.defaultView || globalThis, activeFrame);
      }
      else timers.clearTimeout?.(activeFrame);
      activeFrame = 0;
      activeFrameKind = "";
    };

    const setVehiclePoint = (point, angle = 0) => {
      const pose = birthdayVehiclePose(angle, {
        rocket: vehicle.classList.contains("is-rocket")
      });
      vehicle.style.setProperty("--vehicle-x", `${point.x / 10}%`);
      vehicle.style.setProperty("--vehicle-y", `${point.y / routeHeight * 100}%`);
      vehicle.style.setProperty("--vehicle-angle", `${pose.angle}deg`);
      vehicle.style.setProperty("--vehicle-facing-scale", String(pose.scaleX));
      vehicle.dataset.facing = pose.facing;
    };

    const compactEdgeInset = compactRoute
      ? Math.ceil((
        (Number(vehicle.offsetWidth) || 84) / 2 + 7
      ) * 1000 / (Number(board.clientWidth) || 390))
      : 52;
    const vehicleBounds = Object.freeze({
      minimumX: compactEdgeInset,
      maximumX: 1000 - compactEdgeInset,
      minimumY: 42,
      maximumY: routeHeight - (compactRoute ? 72 : 52)
    });

    const clampVehiclePoint = (point) => Object.freeze({
      x: Math.max(vehicleBounds.minimumX, Math.min(vehicleBounds.maximumX, point.x)),
      y: Math.max(vehicleBounds.minimumY, Math.min(vehicleBounds.maximumY, point.y))
    });

    const measuredWidth = (element, fallback) => {
      const offsetWidth = Number(element?.offsetWidth) || 0;
      if (offsetWidth > 0) return offsetWidth;
      const computedWidth = Number.parseFloat(
        documentRef.defaultView?.getComputedStyle?.(element)?.width || ""
      );
      return Number.isFinite(computedWidth) && computedWidth > 0
        ? computedWidth
        : fallback;
    };

    /*
     * Keep the whole maneuver in a collision-free lane beside the sign.
     * Card and vehicle sizes change substantially on a phone, so these
     * clearances are measured in CSS pixels and converted to the 1000-unit
     * route coordinate system instead of relying on a fixed nudge.
     */
    const vehicleParkingGeometry = (destination, index) => {
      const entry = cardEntries[index];
      const routePoint = pointFor(index);
      const parkingSide = entry?.parkingSide || parkingSideFor(destination, index);
      const boardWidth = measuredWidth(board, 1000);
      const routeUnitsPerPixel = 1000 / boardWidth;
      const fallbackCardWidth = index === 0 ? 112 : 84;
      const cardWidth = measuredWidth(entry?.card, fallbackCardWidth);
      const signWidth = measuredWidth(entry?.parkingSign, compactRoute ? 22 : 32);
      const vehicleWidth = measuredWidth(vehicle, compactRoute ? 84 : 108);
      const signDirection = parkingSide === "left" ? -1 : 1;
      const boardRect = board.getBoundingClientRect?.();
      const signRect = entry?.parkingSign?.getBoundingClientRect?.();
      const hasRenderedSignGeometry = Number(boardRect?.width) > 0
        && Number(signRect?.width) > 0;
      const offsetSignCenter = routePoint.x + (
        (Number(entry?.parkingSign?.offsetLeft) || cardWidth * (signDirection < 0 ? -.5 : 1.5))
        - cardWidth / 2
      ) * routeUnitsPerPixel;
      const signX = hasRenderedSignGeometry
        ? ((signRect.left + signRect.right) / 2 - boardRect.left) * routeUnitsPerPixel
        : offsetSignCenter;
      const hardClearance = (
        vehicleWidth / 2
        + signWidth / 2
        + (compactRoute ? 9 : 12)
      ) * routeUnitsPerPixel;
      const berth = (compactRoute ? 12 : 18) * routeUnitsPerPixel;
      const preferredDirection = -signDirection;
      const availableOn = (direction) => direction < 0
        ? signX - vehicleBounds.minimumX
        : vehicleBounds.maximumX - signX;
      const alternateDirection = -preferredDirection;
      const preferredRoom = availableOn(preferredDirection);
      const alternateRoom = availableOn(alternateDirection);
      const vehicleDirection = preferredRoom >= hardClearance
        ? preferredDirection
        : alternateRoom > preferredRoom
          ? alternateDirection
          : preferredDirection;
      const availableRoom = Math.max(hardClearance, availableOn(vehicleDirection));
      const maneuverReserve = (compactRoute ? 9 : 13) * routeUnitsPerPixel;
      const parkedClearance = hardClearance + Math.min(
        berth,
        Math.max(0, availableRoom - hardClearance - maneuverReserve)
      );
      const parked = clampVehiclePoint({
        x: signX + vehicleDirection * parkedClearance,
        y: routePoint.y + (compactRoute ? 112 : 130)
      });
      const outwardRoom = Math.max(0, availableRoom - parkedClearance);
      const approachRun = Math.min(
        compactRoute ? 108 : 132,
        Math.max(compactRoute ? 30 : 42, outwardRoom)
      );
      const overshootRun = Math.min(
        approachRun * .42,
        berth + (compactRoute ? 8 : 12) * routeUnitsPerPixel
      );
      const reverseRun = Math.min(
        approachRun * .68,
        berth + (compactRoute ? 17 : 24) * routeUnitsPerPixel
      );

      return Object.freeze({
        direction: vehicleDirection,
        signX,
        hardClearance,
        parked,
        approach: clampVehiclePoint({
          x: parked.x + vehicleDirection * approachRun,
          y: parked.y - (compactRoute ? 30 : 38)
        }),
        overshoot: clampVehiclePoint({
          x: parked.x + vehicleDirection * overshootRun,
          y: parked.y - (compactRoute ? 12 : 18)
        }),
        reverse: clampVehiclePoint({
          x: parked.x + vehicleDirection * reverseRun,
          y: parked.y + (compactRoute ? 7 : 10)
        })
      });
    };

    const vehicleParkPoint = (destination, index) => (
      vehicleParkingGeometry(destination, index).parked
    );

    const parkingHistory = ["staged"];
    vehicle.dataset.parkingHistory = "staged";
    board.dataset.parkingHistory = "staged";
    const setParkingPhase = (entry, phase) => {
      if (parkingHistory[parkingHistory.length - 1] !== phase) {
        parkingHistory.push(phase);
        if (parkingHistory.length > 24) parkingHistory.shift();
      }
      const history = parkingHistory.join(",");
      const isParking = phase === "approach" || phase === "reverse" || phase === "straighten";
      const isReversing = phase === "reverse";
      const isParked = phase === "settled";
      vehicle.dataset.parkingPhase = phase;
      vehicle.dataset.parkingHistory = history;
      board.dataset.parkingPhase = phase;
      board.dataset.parkingHistory = history;
      vehicle.classList.toggle("is-parking", isParking);
      vehicle.classList.toggle("is-reversing", isReversing);
      vehicle.classList.toggle("is-parked", isParked);
      board.classList.toggle("is-parking", isParking);
      board.classList.toggle("is-reversing", isReversing);
      board.classList.toggle("is-parked", isParked);
      if (!entry) return;
      entry.card.dataset.parkingPhase = phase;
      entry.parkingSign.dataset.parkingPhase = phase;
      entry.card.classList.toggle("is-parking", isParking);
      entry.card.classList.toggle("is-reversing", isReversing);
      entry.card.classList.toggle("is-parked", isParked);
      entry.parkingSign.classList.toggle("is-active", isParking || isParked);
      entry.parkingSign.classList.toggle("is-reversing", isReversing);
    };

    setVehiclePoint(routeStartPoint, Math.atan2(
      pointFor(0).y - routeStartPoint.y,
      pointFor(0).x - routeStartPoint.x
    ) * 180 / Math.PI);

    const celebrateArrival = (destination, index) => {
      const card = cards[index];
      const routePoint = pointFor(index);
      if (!card) return;
      const energy = (index + 1) / BIRTHDAY_ROUTE.length;
      const hue = destination.kind === "city"
        ? 178 + index * 12
        : 258 + (index - 6) * 18;
      board.style.setProperty("--arrival-x", `${routePoint.x / 10}%`);
      board.style.setProperty("--arrival-y", `${routePoint.y / routeHeight * 100}%`);
      board.style.setProperty("--route-energy", energy.toFixed(3));
      board.style.setProperty("--arrival-hue", String(hue));
      board.classList.toggle("is-at-maximum", index === BIRTHDAY_ROUTE.length - 1);
      if (reducedMotion) {
        card.classList.remove("is-celebrating");
        return;
      }
      card.classList.add("is-celebrating");

      const burst = createElement(documentRef, "div", "birthday-voyage__arrival-vfx", {
        "aria-hidden": "true",
        "data-destination": destination.id,
        style: [
          `--route-x:${routePoint.x / 10}%`,
          `--route-y:${routePoint.y / routeHeight * 100}%`,
          `--burst-hue:${hue}`,
          `--burst-level:${index + 1}`
        ].join(";")
      });
      if (index === 0) burst.classList.add("is-special");
      if (destination.id === "earth") burst.classList.add("is-conversion");
      const fullCount = index === 0 ? 20 : Math.min(22, 6 + index * 2);
      const particleCount = compactRoute ? Math.ceil(fullCount * .62) : fullCount;
      const maximumRadius = index === 0 ? 92 : 42 + index * 7;
      for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
        const angle = (particleIndex * 137.5 + index * 29) * Math.PI / 180;
        const radius = maximumRadius * (.58 + (particleIndex % 5) * .105);
        burst.append(createElement(documentRef, "i", "birthday-voyage__arrival-particle", {
          style: [
            `--burst-x:${Math.cos(angle) * radius}px`,
            `--burst-y:${Math.sin(angle) * radius}px`,
            `--burst-delay:${(particleIndex % 4) * 34}ms`,
            `--burst-size:${3 + (particleIndex + index) % 5}px`
          ].join(";")
        }));
      }
      board.append(burst);
      audioDirector?.play?.("glint", {
        intensity: Math.min(1, 0.35 + energy * 0.55)
      });
      routeAfter(() => {
        burst.remove();
        card.classList.remove("is-celebrating");
      }, 1900);
    };

    const thresholds = birthdayRouteProgress(routePoints);
    const pathLength = stripedPath.getTotalLength?.() || 1;

    const easeInOutCubic = (value) => value < .5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2;

    const interpolatePoint = (from, to, progress) => ({
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress
    });

    const cubicPoint = (from, controlOne, controlTwo, to, progress) => {
      const inverse = 1 - progress;
      return {
        x: inverse ** 3 * from.x
          + 3 * inverse ** 2 * progress * controlOne.x
          + 3 * inverse * progress ** 2 * controlTwo.x
          + progress ** 3 * to.x,
        y: inverse ** 3 * from.y
          + 3 * inverse ** 2 * progress * controlOne.y
          + 3 * inverse * progress ** 2 * controlTwo.y
          + progress ** 3 * to.y
      };
    };

    const animateParkingLeg = ({ duration, pointAt, angleAt }, onComplete) => {
      const startedAt = now();
      const frame = () => {
        if (routeStopped) return;
        const rawProgress = duration <= 0
          ? 1
          : Math.min(1, Math.max(0, now() - startedAt) / duration);
        const progress = easeInOutCubic(rawProgress);
        setVehiclePoint(pointAt(progress), angleAt(progress));
        if (rawProgress < 1) {
          requestRouteFrame(frame);
          return;
        }
        activeFrame = 0;
        activeFrameKind = "";
        onComplete();
      };
      frame();
    };

    const runParkingManeuver = (entry, onParked) => {
      const { destination, index } = entry;
      const geometry = vehicleParkingGeometry(destination, index);
      const { approach, overshoot, reverse, parked } = geometry;
      const vehicleSide = geometry.direction < 0 ? "left" : "right";
      vehicle.dataset.position = `parking-${destination.id}`;
      vehicle.dataset.parkingSide = vehicleSide;
      entry.parkingSign.dataset.vehicleSide = vehicleSide;
      setRoutePhase("parking", index);

      const finishParking = () => {
        setVehiclePoint(parked, 0);
        setParkingPhase(entry, "settled");
        vehicleRouteIndex = index;
        vehicle.dataset.position = destination.id;
        audioDirector?.stopLoop?.("indicator");
        audioDirector?.play?.(destination.kind === "city" ? "parking" : "docking", {
          intensity: destination.kind === "city" ? 0.45 : 0.65
        });
        onParked();
      };

      if (reducedMotion) {
        finishParking();
        return;
      }

      setParkingPhase(entry, "approach");
      audioDirector?.startLoop?.("indicator");
      const approachControlOne = clampVehiclePoint({
        x: approach.x + (overshoot.x - approach.x) * .42,
        y: approach.y - 12
      });
      const approachControlTwo = clampVehiclePoint({
        x: overshoot.x + geometry.direction * (compactRoute ? 18 : 24),
        y: overshoot.y - 8
      });
      animateParkingLeg({
        duration: BIRTHDAY_PARKING_APPROACH_MS,
        pointAt: (progress) => cubicPoint(
          approach,
          approachControlOne,
          approachControlTwo,
          overshoot,
          progress
        ),
        angleAt: (progress) => 6 * geometry.direction * Math.sin(Math.PI * progress)
      }, () => {
        setParkingPhase(entry, "reverse");
        const reverseControlOne = clampVehiclePoint({
          x: overshoot.x + geometry.direction * (compactRoute ? 12 : 16),
          y: overshoot.y + 3
        });
        const reverseControlTwo = clampVehiclePoint({
          x: reverse.x + geometry.direction * (compactRoute ? 10 : 14),
          y: reverse.y + (compactRoute ? 7 : 10)
        });
        animateParkingLeg({
          duration: BIRTHDAY_PARKING_REVERSE_MS,
          pointAt: (progress) => cubicPoint(
            overshoot,
            reverseControlOne,
            reverseControlTwo,
            reverse,
            progress
          ),
          angleAt: (progress) => geometry.direction * (
            13 * Math.sin(Math.PI * progress) - 6 * progress
          )
        }, () => {
          setParkingPhase(entry, "straighten");
          animateParkingLeg({
            duration: BIRTHDAY_PARKING_STRAIGHTEN_MS,
            pointAt: (progress) => interpolatePoint(reverse, parked, progress),
            angleAt: (progress) => -6 * geometry.direction * (1 - progress)
          }, () => {
            setVehiclePoint(parked, 0);
            routeAfter(finishParking, BIRTHDAY_PARKING_SETTLE_MS);
          });
        });
      });
    };

    const animateVehicleTo = (index, onArrival) => {
      const destination = BIRTHDAY_ROUTE[index];
      const destinationPoint = pointFor(index);
      const entry = cardEntries[index];
      const fromIndex = vehicleRouteIndex;
      const startedAt = now();
      const startProgress = fromIndex >= 0 ? thresholds[fromIndex] : 0;
      const rocketLeg = vehicle.classList.contains("is-rocket");
      const segmentDuration = reducedMotion
        ? 0
        : fromIndex === index
          ? (rocketLeg ? 620 : 900)
          : rocketLeg
            ? BIRTHDAY_ROCKET_TRAVEL_MS
            : BIRTHDAY_CAR_TRAVEL_MS;
      const startLength = pathLength * startProgress;
      const endLength = pathLength * thresholds[index];
      const startPark = fromIndex >= 0
        ? vehicleParkPoint(BIRTHDAY_ROUTE[fromIndex], fromIndex)
        : routeStartPoint;
      const endApproach = vehicleParkingGeometry(destination, index).approach;

      cardEntries.forEach((candidate) => {
        candidate.card.classList.remove("is-parking", "is-reversing", "is-parked");
        candidate.parkingSign.classList.remove("is-active", "is-reversing");
      });
      setParkingPhase(entry, "travel");
      vehicle.dataset.travelMode = rocketLeg ? "rocket" : "car";
      board.dataset.travelMode = rocketLeg ? "rocket" : "car";
      if (rocketLeg) audioDirector?.play?.("boost", { intensity: 0.7 });
      audioDirector?.startLoop?.("engine");

      const positionAt = (progress) => {
        if (fromIndex < 0 && index === 0) {
          const routePoint = {
            x: routeStartPoint.x + (destinationPoint.x - routeStartPoint.x) * progress,
            y: routeStartPoint.y + (destinationPoint.y - routeStartPoint.y) * progress
          };
          const parkBlend = Math.max(0, Math.min(1, (progress - .78) / .22));
          return {
            x: routePoint.x + (endApproach.x - routePoint.x) * parkBlend,
            y: routePoint.y + (endApproach.y - routePoint.y) * parkBlend
          };
        }
        if (fromIndex === index) {
          const point = interpolatePoint(startPark, endApproach, progress);
          return {
            x: point.x,
            y: point.y - Math.sin(Math.PI * progress) * (compactRoute ? 24 : 34)
          };
        }
        const length = startLength + (endLength - startLength) * progress;
        const routePoint = stripedPath.getPointAtLength?.(length) || destinationPoint;
        if (progress < .18) {
          const startBlend = progress / .18;
          return {
            x: startPark.x + (routePoint.x - startPark.x) * startBlend,
            y: startPark.y + (routePoint.y - startPark.y) * startBlend
          };
        }
        if (progress > .78) {
          const parkBlend = (progress - .78) / .22;
          return {
            x: routePoint.x + (endApproach.x - routePoint.x) * parkBlend,
            y: routePoint.y + (endApproach.y - routePoint.y) * parkBlend
          };
        }
        return routePoint;
      };

      const frame = () => {
        if (routeStopped) return;
        const rawProgress = segmentDuration <= 0
          ? 1
          : Math.min(1, Math.max(0, now() - startedAt) / segmentDuration);
        const easedProgress = rawProgress < .5
          ? 2 * rawProgress * rawProgress
          : 1 - Math.pow(-2 * rawProgress + 2, 2) / 2;
        const point = positionAt(easedProgress);
        const compareFromBehind = easedProgress >= .982;
        const comparisonProgress = compareFromBehind
          ? Math.max(0, easedProgress - .018)
          : Math.min(1, easedProgress + .018);
        const comparison = positionAt(comparisonProgress);
        const angle = compareFromBehind
          ? Math.atan2(point.y - comparison.y, point.x - comparison.x) * 180 / Math.PI
          : Math.atan2(comparison.y - point.y, comparison.x - point.x) * 180 / Math.PI;
        const parkRotationBlend = Math.max(0, Math.min(1, (easedProgress - .78) / .22));
        const travelAngle = Number.isFinite(angle) ? angle : 0;
        setVehiclePoint(point, travelAngle * (1 - parkRotationBlend));
        if (rawProgress < 1) {
          requestRouteFrame(frame);
          return;
        }
        activeFrame = 0;
        activeFrameKind = "";
        audioDirector?.stopLoop?.("engine");
        setVehiclePoint(endApproach, 0);
        runParkingManeuver(entry, onArrival);
      };

      frame();
    };

    const restoreReplayTriggers = (focusEntry = null) => {
      cardEntries.forEach((entry) => {
        entry.card.classList.remove(
          "is-available",
          "is-current",
          "is-driving",
          "is-previewing",
          "is-committed",
          "is-revisiting",
          "is-unwrapping"
        );
        entry.card.classList.add("is-arrived", "is-complete", "is-replayable", "is-unwrapped");
        entry.card.dataset.giftState = "open";
        entry.card.dataset.routeStatus = "replayable";
        entry.trigger.disabled = false;
        entry.trigger.setAttribute("aria-expanded", "false");
        entry.trigger.setAttribute("aria-label", `Revisit destination: ${entry.destination.label}`);
        entry.trigger.title = `Travel back to ${entry.destination.label}`;
        setCardPrompt(entry, "Revisit", "revisit");
      });
      if (focusEntry && activationMode === "keyboard") {
        focusEntry.trigger.focus({ preventScroll: true });
      }
    };

    const enableReplayMode = (focusEntry = null) => {
      routeMode = "reexplore";
      routeBusy = false;
      root.dataset.routeMode = "reexplore";
      board.dataset.routeMode = "reexplore";
      setRoutePhase("explore", vehicleRouteIndex);
      restoreReplayTriggers(focusEntry);
      setBoardContext(cardEntries[Math.max(0, vehicleRouteIndex)]);
      skip.textContent = "Open the birthday message";
      announce("Every chapter is open. Select any destination whenever you want to return.");
    };

    let openBirthdayMessage = () => {};

    const completeFirstJourney = () => {
      if (routeStopped || routeMode === "reexplore" || journeyComplete) return;
      journeyComplete = true;
      safeSet(storage, COMPLETION_KEY, new Date().toISOString());
      root.dataset.routeMode = "message";
      board.dataset.routeMode = "message";
      setRoutePhase("message", vehicleRouteIndex);
      cardEntries.forEach((entry) => {
        entry.card.classList.remove("is-available", "is-current", "is-driving", "is-previewing");
        entry.card.classList.add("is-arrived", "is-complete");
        entry.card.dataset.routeStatus = "complete";
        entry.trigger.disabled = true;
      });
      setBoardContext(cardEntries[vehicleRouteIndex]);
      skip.textContent = "Open the birthday message";
      persistCheckpoint({
        stage: "finale",
        question: "finale",
        completedChapters: BIRTHDAY_ROUTE.map(({ id }) => id),
        currentDestination: "cosmos",
        vehicleMode: "rocket",
        finaleState: "signature"
      });
      announce("Our cosmos is complete. One message was waiting beyond the final star.");
      openBirthdayMessage("completion");
    };

    const unlockDestination = (index) => {
      if (routeMode !== "first-run") return;
      if (routeStopped || index >= cardEntries.length) {
        if (index >= cardEntries.length) completeFirstJourney();
        return;
      }
      activeRouteIndex = index;
      routeBusy = false;
      setRoutePhase("waiting", index);
      const entry = cardEntries[index];
      entry.card.classList.add("is-available", "is-current");
      entry.card.dataset.routeStatus = "available";
      if (entry.card.dataset.giftState !== "open") {
        entry.card.dataset.giftState = "wrapped";
        entry.card.classList.remove("is-unwrapped", "is-unwrapping");
      }
      entry.trigger.disabled = false;
      entry.trigger.setAttribute("aria-label", `Open fate card: ${entry.destination.label}`);
      entry.trigger.title = `${activationVerb} to visit ${entry.destination.label}`;
      setCardPrompt(entry, `${activationVerb} me`, "ready", true);
      setBoardContext(entry);
      persistCheckpoint({
        stage: "route",
        question: "route",
        completedChapters: [...completedChapterIds],
        currentDestination: entry.destination.id,
        vehicleMode: vehicle.classList.contains("is-rocket") ? "rocket" : "car",
        finaleState: "locked"
      });
      announce(`${activationVerb} ${entry.destination.label} to continue our journey.`);
      if (activationMode === "keyboard" || vehicleRouteIndex < 0) {
        entry.trigger.focus({ preventScroll: true });
      }
    };

    const finishBirthdayMessageClose = () => {
      birthdayMessageDialog.dataset.locked = "false";
      birthdayMessageCloseAuthorized = false;
      if (closeButton) {
        closeButton.disabled = false;
        closeButton.removeAttribute("aria-hidden");
        closeButton.removeAttribute("tabindex");
      }
      if (routeStopped || closed) return;
      cancelRouteTimer(finaleRevealTimer);
      finaleRevealTimer = 0;
      const reason = birthdayMessageReason;
      root.dataset.birthdayMessage = "closed";
      if (journeyComplete || reason === "completion") {
        enableReplayMode();
        cardEntries[Math.max(0, vehicleRouteIndex)]?.trigger?.focus?.({ preventScroll: true });
        return;
      }
      if (routeMode === "reexplore") {
        routeBusy = false;
        setRoutePhase("explore", vehicleRouteIndex);
        restoreReplayTriggers();
        return;
      }
      routeBusy = false;
      unlockDestination(activeRouteIndex);
      cardEntries[activeRouteIndex]?.trigger?.focus?.({ preventScroll: true });
      announce(`The message will stay here. ${activationVerb} ${BIRTHDAY_ROUTE[activeRouteIndex]?.label || "the next card"} when you are ready.`);
    };

    const closeBirthdayMessage = ({ intentional = false } = {}) => {
      if (
        birthdayMessageDialog.open
        && birthdayMessageDialog.dataset.locked === "true"
        && !intentional
      ) {
        announce("Choose one of the three journey actions before leaving this message.");
        return false;
      }
      birthdayMessageCloseAuthorized = true;
      if (typeof birthdayMessageDialog.close === "function") {
        if (birthdayMessageDialog.open) birthdayMessageDialog.close();
      } else {
        birthdayMessageDialog.removeAttribute("open");
        finishBirthdayMessageClose();
      }
      return true;
    };

    openBirthdayMessage = (reason = "revisit") => {
      if (
        routeStopped
        || birthdayMessageDialog.open
        || fatePreview.open
        || (routeBusy && reason !== "completion")
      ) return;
      birthdayMessageReason = reason;
      root.dataset.birthdayMessage = "open";
      birthdayMessageDialog.dataset.locked = "true";
      birthdayMessageCloseAuthorized = false;
      if (closeButton) {
        closeButton.disabled = true;
        closeButton.setAttribute("aria-hidden", "true");
        closeButton.setAttribute("tabindex", "-1");
      }
      birthdayMessageDialog.dataset.finalePhase = "signature";
      finaleSignature.setAttribute("tabindex", "-1");
      birthdayMessageTitle.hidden = true;
      birthdayMessageDedication.hidden = true;
      birthdayMessageHint.hidden = true;
      birthdayMessageActions.hidden = true;
      finaleReveal.hidden = !reducedMotion;
      skip.textContent = "Open the birthday message";
      routeBusy = true;
      setRoutePhase("message", Math.max(0, vehicleRouteIndex));
      cardEntries.forEach(({ trigger }) => {
        trigger.disabled = true;
      });
      if (reason === "completion") {
        birthdayMessageReturn.textContent = "Re-explore any chapter";
        birthdayMessageHint.textContent = "Every destination is now open. We can return to any chapter with one click.";
      } else if (routeMode === "first-run") {
        birthdayMessageReturn.textContent = "Resume our journey";
        birthdayMessageHint.textContent = "This message will stay here. Our unfinished route is waiting exactly where we left it.";
      } else {
        birthdayMessageReturn.textContent = "Back to our journey";
        birthdayMessageHint.textContent = "Every destination is still here whenever we want to revisit it.";
      }
      if (typeof birthdayMessageDialog.showModal === "function") {
        birthdayMessageDialog.showModal();
      } else {
        birthdayMessageDialog.setAttribute("open", "");
      }
      finaleSignature.focus({ preventScroll: true });
      audioDirector?.quietBeat?.(1_600, { resume: false });
      const shouldCheckpointFinale = journeyComplete || reason === "completion";
      if (shouldCheckpointFinale) {
        persistCheckpoint({
          stage: "finale",
          question: "finale",
          currentDestination: BIRTHDAY_ROUTE[Math.max(0, vehicleRouteIndex)]?.id || "cosmos",
          vehicleMode: "rocket",
          finaleState: "signature"
        });
      }
      const revealDedication = () => {
        if (!birthdayMessageDialog.open || routeStopped || closed) return;
        cancelRouteTimer(finaleRevealTimer);
        finaleRevealTimer = 0;
        birthdayMessageDialog.dataset.finalePhase = "dedication";
        birthdayMessageTitle.hidden = false;
        birthdayMessageDedication.hidden = false;
        birthdayMessageHint.hidden = false;
        birthdayMessageActions.hidden = false;
        finaleReveal.hidden = true;
        birthdayMessageTitle.setAttribute("tabindex", "-1");
        birthdayMessageTitle.focus({ preventScroll: true });
        audioDirector?.play?.("finale", { intensity: 0.7 });
        audioDirector?.startMusic?.("finale");
        if (shouldCheckpointFinale) {
          persistCheckpoint({ stage: "finale", finaleState: "dedication" });
        }
        announce(`Happy birthday, ${recipientName}. ${finalMessage}`);
      };
      finaleReveal.onclick = revealDedication;
      if (reducedMotion) {
        finaleReveal.focus({ preventScroll: true });
        announce(`${BIRTHDAY_FINALE_SIGNATURE}. Read the dedication when you are ready.`);
      } else {
        finaleRevealTimer = routeAfter(revealDedication, 1_800);
        announce(`${BIRTHDAY_FINALE_SIGNATURE}. One final message is appearing.`);
      }
    };

    const finishFatePreviewClose = () => {
      const entry = activePreviewEntry;
      previewMediaToken += 1;
      abortPreviewMediaPreparation();
      abortPreviewMediaPreparation = () => {};
      resolvePreviewCardOpen();
      resolvePreviewCardOpen = () => {};
      rescheduleActivePreviewClose = () => {};
      fatePreview.dataset.opened = "false";
      fatePreview.dataset.playing = "false";
      fatePreview.dataset.closing = "false";
      fatePreview.dataset.mediaState = "idle";
      resetPreviewChapterStage();
      delete fatePreview.dataset.playbackStartedAt;
      fatePreview.removeAttribute("aria-busy");
      delete fatePreview.dataset.kind;
      previewStartTimer = 0;
      previewHoldTimer = 0;
      fatePreviewReplay.disabled = true;
      fatePreviewVideo.pause?.();
      fatePreviewVideo.onended = null;
      fatePreviewVideo.onerror = null;
      fatePreviewVideo.removeAttribute("src");
      fatePreviewVideo.load?.();
      delete fatePreview.dataset.mediaError;
      if (!entry) return;
      entry.trigger.setAttribute("aria-expanded", "false");
      entry.card.classList.remove("is-previewing", "is-current");
      entry.card.classList.add("is-complete", "is-unwrapped");
      entry.card.dataset.routeStatus = "complete";
      entry.card.dataset.giftState = "open";
      entry.trigger.disabled = true;
      entry.trigger.setAttribute("aria-label", `${entry.destination.label} visited`);
      entry.trigger.title = `${entry.destination.label} visited`;
      setCardPrompt(entry, "Visited", "visited");
      completedChapterIds.add(entry.destination.id);
      persistCheckpoint({
        stage: "route",
        question: "route",
        completedChapters: [...completedChapterIds],
        currentDestination: BIRTHDAY_ROUTE[entry.index + 1]?.id || entry.destination.id,
        vehicleMode: vehicle.classList.contains("is-rocket") ? "rocket" : "car",
        finaleState: entry.index === BIRTHDAY_ROUTE.length - 1 ? "signature" : "locked"
      });
      activePreviewEntry = null;
      previewClosing = false;
      routeBusy = false;
      if (routeStopped) return;
      if (routeMode === "reexplore") {
        setRoutePhase("explore", entry.index);
        restoreReplayTriggers(entry);
        setBoardContext(entry);
        announce(`${entry.destination.label} is ready whenever we want to return.`);
        return;
      }
      unlockDestination(entry.index + 1);
    };

    const closeFatePreview = () => {
      if (typeof fatePreview.close === "function") {
        fatePreview.close();
      } else {
        fatePreview.removeAttribute("open");
        finishFatePreviewClose();
      }
    };

    const beginFatePreviewClose = () => {
      if (!fatePreview.open || previewClosing) return;
      previewClosing = true;
      previewMediaToken += 1;
      abortPreviewMediaPreparation();
      abortPreviewMediaPreparation = () => {};
      resolvePreviewCardOpen();
      resolvePreviewCardOpen = () => {};
      rescheduleActivePreviewClose = () => {};
      cancelRouteTimer(previewStartTimer);
      cancelRouteTimer(previewHoldTimer);
      previewStartTimer = 0;
      previewHoldTimer = 0;
      resetPreviewChapterStage("closing");
      fatePreview.dataset.playing = "false";
      fatePreview.dataset.closing = "true";
      setRoutePhase("shrinking", activePreviewEntry?.index ?? activeRouteIndex);
      fatePreviewVideo.pause?.();
      routeAfter(closeFatePreview, previewShrinkDuration);
    };

    const openFatePreview = async (entry) => {
      if (routeStopped) return;
      const { trigger, destination, index } = entry;
      activePreviewEntry = entry;
      const mediaToken = ++previewMediaToken;
      const isCurrentPreview = () => (
        mediaToken === previewMediaToken
        && fatePreview.open
        && !previewClosing
        && activePreviewEntry === entry
      );
      previewClosing = false;
      trigger.setAttribute("aria-expanded", "true");
      fatePreview.dataset.opened = "false";
      fatePreview.dataset.playing = "false";
      fatePreview.dataset.closing = "false";
      fatePreview.dataset.kind = destination.kind;
      const previewDuration = previewDurationFor(destination);
      fatePreview.dataset.autocloseMs = String(previewDuration);
      fatePreview.style.setProperty("--preview-duration", `${previewDuration}ms`);
      fatePreview.dataset.mediaState = "loading";
      fatePreviewReplay.disabled = true;
      resetPreviewChapterStage();
      fatePreview.setAttribute("aria-busy", "true");
      fatePreviewTitle.textContent = destination.label;
      fatePreviewOrdinal.textContent = String(index + 1).padStart(2, "0");
      fatePreviewBackLabel.textContent = destination.label;
      setPreviewChapterContent(destination, index);
      fatePreviewChapterStage.dataset.journeyMode = routeMode === "reexplore"
        ? "revisit"
        : "first-run";

      if (typeof fatePreview.showModal === "function") {
        fatePreview.showModal();
      } else {
        fatePreview.setAttribute("open", "");
      }
      setRoutePhase("preview", index);
      const preparedMedia = preparePreviewMedia(destination, isCurrentPreview);
      resolvePreviewCardOpen();
      const cardOpened = new Promise((resolve) => {
        let settled = false;
        const settleCardOpen = () => {
          if (settled) return;
          settled = true;
          if (resolvePreviewCardOpen === settleCardOpen) {
            resolvePreviewCardOpen = () => {};
          }
          resolve();
        };
        resolvePreviewCardOpen = settleCardOpen;
        previewStartTimer = routeAfter(() => {
          previewStartTimer = 0;
          if (!fatePreview.open || activePreviewEntry !== entry) {
            settleCardOpen();
            return;
          }
          fatePreview.dataset.opened = "true";
          routeAfter(settleCardOpen, previewFlipDuration);
        }, reducedMotion ? 0 : 40);
      });
      (reducedMotion ? fatePreviewContinue : fatePreviewChapterTitle).focus({ preventScroll: true });
      announce(`Opening ${destination.label}. Its chapter begins when the picture is ready.`);
      preloadDestination(BIRTHDAY_ROUTE[index + 1]);

      const media = await preparedMedia;
      if (media.kind === "stale" || !isCurrentPreview()) return;
      if (activePreviewEntry === entry && fatePreview.open) {
        fatePreview.dataset.mediaState = media.kind === "fallback" ? "error" : "ready";
        fatePreview.setAttribute("aria-busy", "false");
      }
      await cardOpened;
      if (
        routeStopped
        || previewClosing
        || !fatePreview.open
        || activePreviewEntry !== entry
      ) return;

      const schedulePreviewClose = () => {
        cancelRouteTimer(previewHoldTimer);
        previewHoldTimer = 0;
        if (reducedMotion) return;
        previewHoldTimer = routeAfter(() => {
          previewHoldTimer = 0;
          beginFatePreviewClose();
        }, previewDuration);
      };
      rescheduleActivePreviewClose = schedulePreviewClose;

      const startImageHold = () => {
        if (!fatePreview.open || activePreviewEntry !== entry || previewClosing) return;
        fatePreview.dataset.playing = "true";
        fatePreview.dataset.playbackStartedAt = String(Math.round(now()));
        fatePreviewReplay.disabled = false;
        announce(`${destination.label} is open. ${destination.story || destination.caption}`);
        schedulePreviewClose();
      };

      let fallbackStarted = false;
      const fallBackToImage = async () => {
        if (
          fallbackStarted
          || !fatePreview.open
          || activePreviewEntry !== entry
          || previewClosing
        ) return;
        fallbackStarted = true;
        cancelRouteTimer(previewHoldTimer);
        previewHoldTimer = 0;
        fatePreview.dataset.playing = "false";
        fatePreview.dataset.mediaState = "loading";
        fatePreview.setAttribute("aria-busy", "true");
        const fallback = await preparePreviewImage(destination, isCurrentPreview);
        if (fallback.kind === "stale" || !isCurrentPreview()) return;
        if (!fatePreview.open || activePreviewEntry !== entry || previewClosing) return;
        fatePreview.dataset.mediaState = fallback.kind === "fallback" ? "error" : "ready";
        fatePreview.setAttribute("aria-busy", "false");
        if (fallback.kind === "fallback") {
          announce(`${destination.label} is here, even though its picture missed the journey.`);
        }
        startImageHold();
      };

      const startPreparedMedia = async () => {
        if (!fatePreview.open || activePreviewEntry !== entry || previewClosing) return;
        if (media.kind !== "video") {
          startImageHold();
          return;
        }
        fatePreviewVideo.onended = () => {
          if (fatePreview.open && activePreviewEntry === entry && !previewClosing) {
            announce(`${destination.label} finished. Its final frame will stay until this chapter's five seconds are complete.`);
          }
        };
        fatePreviewVideo.onerror = () => {
          void fallBackToImage();
        };
        const playback = fatePreviewVideo.play?.();
        if (playback?.then) {
          try {
            await playback;
          } catch {
            await fallBackToImage();
            return;
          }
        }
        if (!fatePreview.open || activePreviewEntry !== entry || previewClosing) return;
        fatePreview.dataset.playing = "true";
        fatePreview.dataset.playbackStartedAt = String(Math.round(now()));
        fatePreviewReplay.disabled = false;
        announce(`${destination.label} is playing. ${destination.caption}`);
        schedulePreviewClose();
      };

      startPreviewChapterStage(entry, () => {
        void startPreparedMedia();
      });
    };

    const arriveAtDestination = (entry) => {
      const { card, destination, index } = entry;
      card.classList.remove("is-driving");
      card.classList.add("is-arrived", "is-previewing");
      card.dataset.routeStatus = "previewing";
      celebrateArrival(destination, index);
      announce(`Arriving at ${destination.label}.`);
      if (destination.id === "earth") {
        vehicle.classList.add("is-rocket");
        root.dataset.space = "true";
        audioDirector?.play?.("rocket", { intensity: 0.95 });
        persistCheckpoint({ vehicleMode: "rocket", currentDestination: destination.id });
        announce("Earth reached. Converting the RAV4 into a spaceship.");
      }
      routeAfter(() => openFatePreview(entry), arrivalPause);
    };

    const activateDestination = (entry, mode = "pointer") => {
      const firstRunActivation = routeMode === "first-run"
        && entry.index === activeRouteIndex
        && entry.card.classList.contains("is-available");
      const replayActivation = routeMode === "reexplore"
        && mode !== "hover"
        && entry.card.classList.contains("is-replayable");
      if (
        routeStopped
        || routeBusy
        || (!firstRunActivation && !replayActivation)
      ) return;
      routeBusy = true;
      activationMode = mode;
      activeRouteIndex = entry.index;
      setBoardContext(entry);
      if (replayActivation) {
        cardEntries.forEach(({ trigger }) => {
          trigger.disabled = true;
        });
        const needsRocket = entry.destination.kind !== "city";
        vehicle.classList.toggle("is-rocket", needsRocket);
        if (needsRocket) root.dataset.space = "true";
        else delete root.dataset.space;
      }
      entry.card.classList.remove("is-available", "is-complete");
      entry.card.classList.add(
        "is-driving",
        ...(replayActivation ? ["is-revisiting"] : [])
      );
      if (firstRunActivation) {
        entry.card.classList.add("is-unwrapping");
        entry.card.classList.remove("is-unwrapped", "is-committed");
        entry.card.dataset.giftState = "opening";
      } else {
        entry.card.classList.add("is-unwrapped", "is-committed");
        entry.card.dataset.giftState = "open";
      }
      entry.card.dataset.routeStatus = "driving";
      entry.trigger.disabled = true;
      entry.trigger.setAttribute("aria-label", `Driving to ${entry.destination.label}`);
      setCardPrompt(
        entry,
        firstRunActivation ? "Unwrapping..." : "On our way",
        firstRunActivation ? "opening" : "driving",
        firstRunActivation
      );

      const beginDrive = () => {
        if (routeStopped) return;
        setRoutePhase("driving", entry.index);
        setCardPrompt(entry, "On our way", "driving");
        vehicle.classList.remove("is-staged", "is-parking", "is-reversing", "is-parked");
        animateVehicleTo(entry.index, () => arriveAtDestination(entry));
      };

      const openGiftAndFlip = () => {
        if (routeStopped) return;
        entry.card.classList.remove("is-unwrapping");
        entry.card.classList.add("is-unwrapped", "is-committed");
        entry.card.dataset.giftState = "open";
        audioDirector?.play?.("flip", { intensity: 0.5 });
        setRoutePhase("flipping", entry.index);
        announce(replayActivation
          ? `Traveling back to ${entry.destination.label}, together.`
          : `${entry.destination.label} chose us. The gift is open; turning its card.`);
        routeAfter(
          beginDrive,
          replayActivation && !reducedMotion ? 240 : cardFlipDelay
        );
      };

      if (firstRunActivation) {
        setRoutePhase("unwrapping", entry.index);
        audioDirector?.play?.("ribbon", { intensity: 0.45 });
        announce(`Unwrapping ${entry.destination.label}, our next gift from fate.`);
        routeAfter(openGiftAndFlip, giftUnwrapDuration);
      } else {
        openGiftAndFlip();
      }
    };

    cardEntries.forEach((entry) => {
      if (supportsHover) {
        entry.trigger.addEventListener("pointerenter", () => {
          cancelRouteTimer(hoverIntentTimers.get(entry));
          const timer = routeAfter(() => {
            hoverIntentTimers.delete(entry);
            activateDestination(entry, "hover");
          }, BIRTHDAY_HOVER_DWELL_MS);
          hoverIntentTimers.set(entry, timer);
        });
        entry.trigger.addEventListener("pointerleave", () => {
          cancelRouteTimer(hoverIntentTimers.get(entry));
          hoverIntentTimers.delete(entry);
        });
      }
      entry.trigger.addEventListener("click", (event) => {
        cancelRouteTimer(hoverIntentTimers.get(entry));
        hoverIntentTimers.delete(entry);
        activateDestination(entry, event.detail === 0 ? "keyboard" : "click");
      });
    });

    fatePreviewClose.addEventListener("click", beginFatePreviewClose);
    fatePreviewContinue.addEventListener("click", beginFatePreviewClose);
    fatePreviewReplay.addEventListener("click", () => {
      const entry = activePreviewEntry;
      if (
        !entry
        || previewClosing
        || fatePreviewReplay.disabled
        || fatePreview.dataset.mediaState === "loading"
        || fatePreview.dataset.chapterSettled !== "true"
      ) return;
      cancelRouteTimer(previewHoldTimer);
      previewHoldTimer = 0;
      fatePreview.dataset.playing = "false";
      // Force the media/progress presentation back to its first frame before
      // the next animation begins.
      void fatePreview.offsetWidth;
      if (!fatePreviewVideo.hidden && fatePreviewVideo.getAttribute("src")) {
        fatePreviewVideo.currentTime = 0;
        const playback = fatePreviewVideo.play?.();
        playback?.catch?.(() => announce("The film could not replay, but its poster is still here."));
      }
      setPreviewChapterPhase("rail");
      fatePreview.dataset.chapterSettled = "true";
      fatePreview.dataset.playing = "true";
      fatePreview.dataset.playbackStartedAt = String(Math.round(now()));
      rescheduleActivePreviewClose();
      announce(`Replaying ${entry.destination.label}. ${entry.destination.story || entry.destination.caption}`);
    });
    fatePreview.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      beginFatePreviewClose();
    });
    fatePreview.addEventListener("cancel", (event) => {
      event.preventDefault();
      beginFatePreviewClose();
    });
    fatePreview.addEventListener("click", (event) => {
      if (event.target === fatePreview) beginFatePreviewClose();
    });
    fatePreview.addEventListener("close", finishFatePreviewClose);
    birthdayMessageReturn.addEventListener("click", () => {
      closeBirthdayMessage({ intentional: true });
      const routeShell = root.querySelector(".birthday-voyage__shell");
      if (routeShell) routeShell.scrollTop = 0;
    });
    birthdayMessageReplayAll.addEventListener("click", () => {
      const restartName = activeGuestName || guestName;
      renderCleanup();
      renderCleanup = () => {};
      checkpointState = null;
      clearBirthdayVoyageCheckpoint(storage);
      safeRemove(storage, COMPLETION_KEY);
      responses = initialResponses();
      runRouteAnimation(restartName);
      announce("Our whole journey is ready to begin again in Varna.");
    });
    birthdayMessageFinish.addEventListener("click", () => {
      if (journeyComplete) {
        persistCheckpoint({ stage: "finale", finaleState: "complete" });
      }
      close({ completed: true });
    });
    birthdayMessageDialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeBirthdayMessage();
    });
    birthdayMessageDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeBirthdayMessage();
    });
    birthdayMessageDialog.addEventListener("click", (event) => {
      if (event.target === birthdayMessageDialog) closeBirthdayMessage();
    });
    birthdayMessageDialog.addEventListener("close", () => {
      if (
        birthdayMessageDialog.dataset.locked === "true"
        && !birthdayMessageCloseAuthorized
        && !routeStopped
        && !closed
      ) {
        if (typeof birthdayMessageDialog.showModal === "function") {
          birthdayMessageDialog.showModal();
        } else {
          birthdayMessageDialog.setAttribute("open", "");
        }
        const protectedFocus = birthdayMessageDialog.dataset.finalePhase === "signature"
          ? finaleSignature
          : birthdayMessageTitle;
        protectedFocus.focus({ preventScroll: true });
        announce("The birthday message stays open until a journey action is chosen.");
        return;
      }
      finishBirthdayMessageClose();
    });

    const stopRoute = () => {
      routeStopped = true;
      audioDirector?.stopLoop?.("engine");
      audioDirector?.stopLoop?.("indicator");
      clearRouteTimers();
      cancelRouteFrame();
      if (fatePreview.open) closeFatePreview();
      if (birthdayMessageDialog.open) closeBirthdayMessage({ intentional: true });
      if (optionsConfirm.open) optionsConfirm.close?.();
      preloadedMedia.forEach((media) => {
        if (media.localName === "video") {
          media.pause?.();
          media.removeAttribute("src");
          media.load?.();
        }
      });
      preloadedMedia.clear();
    };

    journeyOptionsToggle.addEventListener("click", () => {
      const opening = journeyOptionsMenu.hidden;
      journeyOptionsMenu.hidden = !opening;
      journeyOptionsToggle.setAttribute("aria-expanded", String(opening));
      if (opening) skip.focus({ preventScroll: true });
    });
    skip.addEventListener("click", () => {
      journeyOptionsMenu.hidden = true;
      journeyOptionsToggle.setAttribute("aria-expanded", "false");
      if (journeyComplete) {
        openBirthdayMessage("revisit");
        return;
      }
      if (typeof optionsConfirm.showModal === "function") optionsConfirm.showModal();
      else optionsConfirm.setAttribute("open", "");
      optionsStay.focus({ preventScroll: true });
    });
    const closeOptionsConfirm = () => {
      if (typeof optionsConfirm.close === "function" && optionsConfirm.open) optionsConfirm.close();
      else optionsConfirm.removeAttribute("open");
      journeyOptionsToggle.focus({ preventScroll: true });
    };
    optionsStay.addEventListener("click", closeOptionsConfirm);
    optionsLeave.addEventListener("click", () => {
      if (typeof optionsConfirm.close === "function" && optionsConfirm.open) optionsConfirm.close();
      else optionsConfirm.removeAttribute("open");
      openBirthdayMessage("skip");
    });
    optionsConfirm.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeOptionsConfirm();
    });

    renderCleanup = stopRoute;
    preloadDestination(BIRTHDAY_ROUTE[0]);
    if (resumeState) {
      cardEntries.forEach((entry) => {
        if (!completedChapterIds.has(entry.destination.id)) return;
        entry.card.classList.add("is-arrived", "is-complete", "is-unwrapped");
        entry.card.dataset.giftState = "open";
        entry.card.dataset.routeStatus = "complete";
        entry.trigger.disabled = true;
        entry.trigger.setAttribute("aria-label", `${entry.destination.label} visited`);
        setCardPrompt(entry, "Visited", "visited");
      });
      const lastCompletedIndex = BIRTHDAY_ROUTE.reduce((last, destination, index) => (
        completedChapterIds.has(destination.id) ? index : last
      ), -1);
      vehicleRouteIndex = lastCompletedIndex;
      if (lastCompletedIndex >= 0) {
        setVehiclePoint(vehicleParkPoint(BIRTHDAY_ROUTE[lastCompletedIndex], lastCompletedIndex), 0);
        vehicle.dataset.position = BIRTHDAY_ROUTE[lastCompletedIndex].id;
        vehicle.classList.remove("is-staged");
      }
      const resumeRocket = resumeState.vehicleMode === "rocket" || lastCompletedIndex >= 6;
      vehicle.classList.toggle("is-rocket", resumeRocket);
      if (resumeRocket) root.dataset.space = "true";
      const savedIndex = BIRTHDAY_ROUTE.findIndex(({ id }) => id === resumeState.currentDestination);
      const nextIncompleteIndex = BIRTHDAY_ROUTE.findIndex(({ id }) => !completedChapterIds.has(id));
      activeRouteIndex = savedIndex >= 0 && !completedChapterIds.has(BIRTHDAY_ROUTE[savedIndex].id)
        ? savedIndex
        : nextIncompleteIndex;
      const resumeFinale = resumeState.stage === "finale"
        || resumeState.finaleState === "signature"
        || resumeState.finaleState === "dedication"
        || nextIncompleteIndex < 0;
      if (resumeFinale) {
        journeyComplete = true;
        vehicleRouteIndex = BIRTHDAY_ROUTE.length - 1;
        setVehiclePoint(vehicleParkPoint(BIRTHDAY_ROUTE.at(-1), vehicleRouteIndex), 0);
        enableReplayMode();
        routeAfter(() => openBirthdayMessage("completion"), 0);
      } else {
        unlockDestination(Math.max(0, activeRouteIndex));
      }
    } else {
      persistCheckpoint({
        stage: "route",
        question: "route",
        completedChapters: [],
        currentDestination: "varna",
        vehicleMode: "car",
        finaleState: "locked"
      });
      unlockDestination(0);
    }
  };

  const renderLionIntro = (guestName) => {
    root.dataset.stage = "lion-intro";
    root.dataset.question = "lion-intro";
    root.dataset.playback = "poster";
    persistCheckpoint({
      stage: "lion-intro",
      question: "lion-intro",
      responses,
      completedChapters: [],
      currentDestination: "varna",
      vehicleMode: "car",
      finaleState: "locked"
    });
    audioDirector?.setMusicAct?.("lion");
    progress.hidden = true;
    panel.replaceChildren();
    const shell = root.querySelector(".birthday-voyage__shell");
    if (shell) shell.scrollTop = 0;
    const reducedMotion = documentRef.defaultView?.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches === true;

    const intro = createElement(documentRef, "section", "birthday-voyage__lion-intro", {
      "aria-labelledby": "birthdayLionIntroTitle"
    });
    const heading = createElement(documentRef, "div", "birthday-voyage__lion-intro-heading");
    const eyebrow = createElement(documentRef, "span", "birthday-voyage__eyebrow");
    eyebrow.textContent = "THE LION OPENS OUR CONSTELLATION";
    const title = createElement(documentRef, "h2", "", {
      id: "birthdayLionIntroTitle"
    });
    title.textContent = "A lion guards our first star.";
    const copy = createElement(documentRef, "p");
    copy.textContent = reducedMotion
      ? "Begin when you are ready. Varna follows."
      : "When the roar fades, our road begins in Varna.";
    heading.append(eyebrow, title, copy);

    const frame = createElement(documentRef, "div", "birthday-voyage__lion-intro-frame");
    const video = createElement(documentRef, "video", "birthday-voyage__lion-intro-video", {
      src: LION_INTRO_VIDEO,
      preload: "auto",
      playsinline: "",
      poster: `${ASSET_ROOT}/masters/lion-intro-poster-master.webp`,
      "aria-label": "Lion birthday intro with sound"
    });
    video.autoplay = false;
    video.defaultMuted = false;
    video.muted = Boolean(audioDirector?.isMuted?.());
    video.volume = video.muted ? 0 : 1;
    const playButton = createElement(documentRef, "button", "birthday-voyage__primary birthday-voyage__lion-intro-play", {
      type: "button"
    });
    playButton.textContent = video.muted
      ? "Start our journey quietly"
      : "Start our journey with sound";
    playButton.hidden = false;
    frame.append(video, playButton);

    const actions = createElement(documentRef, "div", "birthday-voyage__lion-intro-actions");
    const sound = createElement(documentRef, "span", "birthday-voyage__lion-intro-sound", {
      "aria-hidden": "true"
    });
    sound.textContent = video.muted ? "\u266b SOUND OFF" : "\u266b SOUND ON";
    const skip = createElement(documentRef, "button", "birthday-voyage__secondary", {
      type: "button"
    });
    skip.textContent = "Skip intro \u2192 Varna";
    skip.hidden = true;
    actions.append(sound, skip);
    intro.append(heading, frame, actions);
    panel.append(intro);

    let transitioned = false;
    const syncLionSound = (state = {}) => {
      const muted = typeof state.muted === "boolean"
        ? state.muted
        : Boolean(audioDirector?.isMuted?.());
      video.muted = muted;
      video.volume = muted ? 0 : 1;
      sound.textContent = muted ? "\u266b SOUND OFF" : "\u266b SOUND ON";
      if (!video.paused) return;
      playButton.textContent = muted
        ? "Start our journey quietly"
        : "Start our journey with sound";
    };
    const unsubscribeLionSound = audioDirector?.subscribe?.(syncLionSound);
    const beginVarna = () => {
      if (transitioned || closed) return;
      transitioned = true;
      video.pause();
      audioDirector?.play?.("glint", { intensity: 0.45 });
      runRouteAnimation(guestName);
    };
    video.addEventListener("ended", beginVarna, { once: true });
    video.addEventListener("error", () => {
      root.dataset.playback = "error";
      playButton.hidden = false;
      playButton.disabled = true;
      skip.hidden = false;
      announce("The lion film could not start. Skip ahead and Varna will take it from here.");
    }, { once: true });
    skip.addEventListener("click", beginVarna, { once: true });
    playButton.addEventListener("click", () => {
      audioDirector?.prime?.({ music: false, act: "lion" });
      syncLionSound();
      const playback = video.play();
      if (playback?.then) {
        playback.then(() => {
          root.dataset.playback = "playing";
          video.controls = true;
          playButton.hidden = true;
          announce("Lion intro playing with sound. Varna is next.");
        }).catch(() => {
          root.dataset.playback = "error";
          skip.hidden = false;
          announce("The film could not begin. Continue to Varna when you are ready.");
        });
      }
    });
    announce("The lion is ready. Start our journey with sound when you are ready.");
    playButton.focus({ preventScroll: true });
    renderCleanup = () => {
      if (typeof unsubscribeLionSound === "function") unsubscribeLionSound();
      video.pause?.();
    };
  };

  const resetQuestionnaire = (guestName) => {
    const resetCount = responses.resetCount + 1;
    responses = {
      ...initialResponses(),
      resetCount
    };
    root.dataset.revealed = "false";
    persistCheckpoint({
      stage: "questions",
      question: "car",
      responses,
      completedChapters: [],
      currentDestination: "varna",
      vehicleMode: "car",
      finaleState: "locked"
    });
    renderCarQuestion(guestName);
    announce("Questionnaire reset.");
  };

  const renderSummary = (guestName) => {
    root.dataset.stage = "questions";
    root.dataset.question = "summary";
    root.dataset.revealed = "false";
    persistCheckpoint({ stage: "questions", question: "summary", responses });
    setProgress(88, "Review answers");
    const target = setPanel({
      eyebrow: "FINAL REVIEW",
      title: "Review your answers.",
      copy: "Make sure every selection is correct before you confirm."
    });
    const summary = createElement(documentRef, "dl", "birthday-voyage__summary");
    const answerRows = [
      { id: "car", term: "Car", value: responses.car, actual: BIRTHDAY_FATED_ANSWERS.car, entry: "top" },
      { id: "animal", term: "Animal", value: responses.animalSaved, actual: BIRTHDAY_FATED_ANSWERS.animal, entry: "bottom" },
      { id: "city", term: "City", value: responses.city, actual: BIRTHDAY_FATED_ANSWERS.city, entry: "top" },
      { id: "drink", term: "Drink", value: responses.drink, actual: BIRTHDAY_FATED_ANSWERS.drink, entry: "bottom" }
    ];
    const cards = [];
    answerRows.forEach(({ id, term, value, actual, entry }, index) => {
      const row = createElement(documentRef, "div", "birthday-voyage__summary-card", {
        "data-answer": id,
        "data-entry": entry,
        style: `--summary-index:${index}`
      });
      const dt = createElement(documentRef, "dt");
      const dd = createElement(documentRef, "dd");
      const original = createElement(documentRef, "span", "birthday-voyage__answer-original");
      const replacement = createElement(documentRef, "span", "birthday-voyage__fate-replacement", {
        "aria-hidden": "true"
      });
      dt.textContent = term;
      original.textContent = value;
      replacement.textContent = actual;
      dd.append(original, replacement);
      row.append(dt, dd);
      summary.append(row);
      cards.push(Object.freeze({ row, replacement }));
    });
    target.append(summary);
    let reviewPhase = "review";
    const { backButton, resetButton, nextButton } = appendQuestionNavigation(target, {
      onBack: () => renderDrinkQuestion(guestName),
      onReset: () => resetQuestionnaire(guestName),
      onNext: () => {
        if (reviewPhase === "revealed") {
          renderLionIntro(guestName);
          return;
        }
        if (reviewPhase !== "review") return;
        reviewPhase = "revealing";
        root.dataset.revealed = "true";
        setProgress(94, "Fate revealed");
        const header = target.querySelector(".birthday-voyage__question-header");
        const heading = header?.querySelector("h2");
        const copy = header?.querySelector("p");
        if (heading) {
          heading.textContent = "The stars have reviewed your answers.";
        }
        if (copy) {
          copy.textContent = "Fate made four small corrections.";
        }
        summary.classList.add("is-fated");
        cards.forEach(({ row, replacement }) => {
          row.classList.add("is-overruled");
          replacement.setAttribute("aria-hidden", "false");
        });
        if (backButton) backButton.hidden = true;
        if (resetButton) resetButton.hidden = true;
        nextButton.disabled = true;
        nextButton.textContent = "Revealing fate\u2026";
        audioDirector?.play?.("fate", { intensity: 0.75 });
        persistCheckpoint({ stage: "questions", question: "summary", responses });
        announce("The stars have reviewed your answers. Fate made four small corrections.");
        schedule(() => {
          if (!nextButton.isConnected) return;
          reviewPhase = "revealed";
          nextButton.disabled = false;
          nextButton.textContent = "Let fate drive";
          nextButton.focus({ preventScroll: true });
        }, BIRTHDAY_RAGEBAIT_HOLD_MS);
      },
      nextLabel: "Confirm",
      nextEnabled: true,
      nextArrow: false
    });
    nextButton.focus();
  };

  const renderDrinkQuestion = (guestName) => {
    root.dataset.stage = "questions";
    root.dataset.question = "drink";
    persistCheckpoint({ stage: "questions", question: "drink", responses });
    setProgress(72, "Question 4 of 4");
    const target = setPanel({
      eyebrow: "TRAVEL PREFERENCES",
      title: "What is the perfect travel drink?",
      copy: "Choose one drink for the journey."
    });
    const choices = createElement(documentRef, "div", "birthday-voyage__drink-options");
    let nextButton = null;
    let waterButton = null;
    let waterAnchor = null;
    let stopWaterMotion = () => {};
    let waterCaught = responses.drinkId === "water";

    const chooseDrink = (drink, button) => {
      const result = ragebaitDrink(drink.id);
      responses.drinkId = drink.id;
      responses.drink = result.label;
      const buttons = [
        ...choices.querySelectorAll("button[data-value]"),
        ...(waterButton && !choices.contains(waterButton) ? [waterButton] : [])
      ];
      buttons.forEach((candidate) => {
        const selected = candidate === button;
        candidate.classList.toggle("is-selected", selected);
        candidate.setAttribute("aria-pressed", String(selected));
      });
      if (result.sabotaged) {
        audioDirector?.play?.("water", { intensity: 0.8 });
        waterCaught = true;
        stopWaterMotion();
        button.classList.remove("is-viewport-evasive", "is-positioned", "is-teleporting");
        button.classList.add("is-caught");
        button.textContent = result.label;
        button.removeAttribute("style");
        if (waterAnchor?.isConnected) waterAnchor.replaceWith(button);
        else choices.append(button);
      }
      persistCheckpoint({ stage: "questions", question: "drink", responses });
      announce(result.sabotaged
        ? "Water changed into Melted ice. Melted ice is saved."
        : `${result.label} is saved.`);
      if (nextButton) nextButton.disabled = false;
    };

    DRINK_OPTIONS.forEach((drink) => {
      const isWater = drink.id === "water";
      const selected = responses.drinkId === drink.id;
      const button = createElement(
        documentRef,
        "button",
        `birthday-voyage__choice${isWater ? " birthday-voyage__choice--evasive" : ""}`,
        {
        type: "button",
        "data-value": drink.id,
        "aria-pressed": String(selected)
        }
      );
      button.textContent = selected && isWater ? responses.drink : drink.label;
      button.classList.toggle("is-selected", selected);
      button.classList.toggle("is-caught", selected && isWater);
      if (isWater) {
        waterButton = button;
      }
      button.addEventListener("click", (event) => {
        if (
          isWater
          && !waterCaught
          && button.classList.contains("is-viewport-evasive")
          && event.detail > 0
        ) {
          event.preventDefault();
          return;
        }
        chooseDrink(drink, button);
      });
      if (!isWater) choices.append(button);
    });
    if (waterButton) choices.append(waterButton);
    target.append(choices);
    ({ nextButton } = appendQuestionNavigation(target, {
      onBack: () => renderCityQuestion(guestName),
      onReset: () => resetQuestionnaire(guestName),
      onNext: () => renderSummary(guestName),
      nextLabel: "Review answers",
      nextEnabled: Boolean(responses.drinkId)
    }));

    const finePointerQuery = documentRef.defaultView?.matchMedia?.("(hover: hover) and (pointer: fine)");
    const canEvade = !waterCaught && (finePointerQuery ? finePointerQuery.matches : true);
    if (!waterButton || !canEvade) {
      return;
    }

    const rootRectAtRest = root.getBoundingClientRect();
    const waterRectAtRest = waterButton.getBoundingClientRect();
    const initialWaterLeft = waterRectAtRest.left - rootRectAtRest.left;
    const initialWaterTop = waterRectAtRest.top - rootRectAtRest.top;
    waterAnchor = createElement(documentRef, "span", "birthday-voyage__water-anchor", {
      "aria-hidden": "true"
    });
    waterAnchor.style.height = `${waterRectAtRest.height}px`;
    waterButton.replaceWith(waterAnchor);
    waterButton.style.setProperty("--water-width", `${waterRectAtRest.width}px`);
    waterButton.classList.add("is-viewport-evasive");
    root.append(waterButton);
    const view = documentRef.defaultView;
    const inset = 12;
    let waterLeft = initialWaterLeft;
    let waterTop = initialWaterTop;
    let waterVelocityX = 0;
    let waterVelocityY = 0;
    let latestPointer = null;
    let waterFrame = 0;
    let waterFrameKind = "";
    let lastFrameAt = 0;
    let teleportTimer = 0;
    let curveDirection = 1;
    let stopped = false;
    let metrics = null;

    const requestWaterFrame = (callback) => {
      if (typeof view?.requestAnimationFrame === "function") {
        waterFrameKind = "raf";
        return view.requestAnimationFrame(callback);
      }
      waterFrameKind = "timeout";
      return timers.setTimeout(() => callback(now()), 16);
    };
    const cancelWaterFrame = () => {
      if (!waterFrame) return;
      if (waterFrameKind === "raf") view?.cancelAnimationFrame?.(waterFrame);
      else timers.clearTimeout?.(waterFrame);
      waterFrame = 0;
      waterFrameKind = "";
    };
    const refreshWaterMetrics = () => {
      const rootRect = root.getBoundingClientRect();
      const width = Math.max(1, waterRectAtRest.width || waterButton.offsetWidth || 170);
      const height = Math.max(1, waterRectAtRest.height || waterButton.offsetHeight || 58);
      metrics = Object.freeze({
        rootRect,
        width,
        height,
        minLeft: inset,
        minTop: inset,
        maxLeft: Math.max(inset, rootRect.width - width - inset),
        maxTop: Math.max(inset, rootRect.height - height - inset)
      });
      waterLeft = Math.max(metrics.minLeft, Math.min(metrics.maxLeft, waterLeft));
      waterTop = Math.max(metrics.minTop, Math.min(metrics.maxTop, waterTop));
    };
    const markWaterTeleport = () => {
      curveDirection *= -1;
      waterButton.classList.add("is-teleporting");
      if (teleportTimer) timers.clearTimeout?.(teleportTimer);
      teleportTimer = timers.setTimeout(() => {
        teleportTimer = 0;
        waterButton?.classList.remove("is-teleporting");
      }, 120);
    };
    const paintWater = (teleported = false) => {
      if (!(metrics && waterButton?.isConnected)) return;
      waterButton.style.setProperty("--water-x", `${waterLeft.toFixed(2)}px`);
      waterButton.style.setProperty("--water-y", `${waterTop.toFixed(2)}px`);
      waterButton.style.setProperty(
        "--water-tilt",
        `${Math.max(-8, Math.min(8, waterVelocityX * .48)).toFixed(2)}deg`
      );
      waterButton.classList.add("is-positioned");
      if (teleported) markWaterTeleport();
    };

    const animateWater = (timestamp) => {
      waterFrame = 0;
      if (stopped || waterCaught || !waterButton?.isConnected || !metrics) return;
      const elapsed = lastFrameAt ? timestamp - lastFrameAt : 16.67;
      const delta = Math.max(.45, Math.min(2.2, elapsed / 16.67));
      lastFrameAt = timestamp;
      const localPointerX = latestPointer
        ? latestPointer.x - metrics.rootRect.left
        : Number.POSITIVE_INFINITY;
      const localPointerY = latestPointer
        ? latestPointer.y - metrics.rootRect.top
        : Number.POSITIVE_INFINITY;
      const centerX = waterLeft + metrics.width / 2;
      const centerY = waterTop + metrics.height / 2;
      let awayX = centerX - localPointerX;
      let awayY = centerY - localPointerY;
      let distance = Math.hypot(awayX, awayY);
      const cautionRadius = Math.min(
        Math.max(220, metrics.width * 1.55),
        Math.max(150, Math.min(metrics.rootRect.width, metrics.rootRect.height) * .46)
      );
      const dangerRadius = Math.min(122, Math.max(88, metrics.width * .64));
      let teleported = false;

      if (distance < dangerRadius) {
        const sendRight = localPointerX < metrics.rootRect.width / 2;
        waterLeft = sendRight ? metrics.maxLeft : metrics.minLeft;
        const verticalEscape = localPointerY < metrics.rootRect.height / 2
          ? localPointerY + dangerRadius * 1.25
          : localPointerY - metrics.height - dangerRadius * 1.25;
        waterTop = Math.max(metrics.minTop, Math.min(metrics.maxTop, verticalEscape));
        waterVelocityX = sendRight ? -1.8 : 1.8;
        waterVelocityY = curveDirection * 1.8;
        teleported = true;
        awayX = waterLeft + metrics.width / 2 - localPointerX;
        awayY = waterTop + metrics.height / 2 - localPointerY;
        distance = Math.hypot(awayX, awayY);
      } else if (distance < cautionRadius) {
        const safeDistance = Math.max(1, distance);
        const directionX = awayX / safeDistance;
        const directionY = awayY / safeDistance;
        const pressure = 1 - Math.min(1, distance / cautionRadius);
        const acceleration = (.7 + pressure * 2.4) * delta;
        waterVelocityX += directionX * acceleration - directionY * .24 * curveDirection;
        waterVelocityY += directionY * acceleration + directionX * .24 * curveDirection;
      }

      const friction = distance < cautionRadius ? .94 : .82;
      waterVelocityX *= friction ** delta;
      waterVelocityY *= friction ** delta;
      const speed = Math.hypot(waterVelocityX, waterVelocityY);
      const maximumSpeed = 13;
      if (speed > maximumSpeed) {
        waterVelocityX = waterVelocityX / speed * maximumSpeed;
        waterVelocityY = waterVelocityY / speed * maximumSpeed;
      }
      waterLeft += waterVelocityX * delta;
      waterTop += waterVelocityY * delta;

      if (waterLeft < metrics.minLeft) {
        waterLeft = metrics.maxLeft;
        teleported = true;
      } else if (waterLeft > metrics.maxLeft) {
        waterLeft = metrics.minLeft;
        teleported = true;
      }
      if (waterTop < metrics.minTop) {
        waterTop = metrics.minTop;
        waterVelocityY = Math.abs(waterVelocityY) * .68;
      } else if (waterTop > metrics.maxTop) {
        waterTop = metrics.maxTop;
        waterVelocityY = -Math.abs(waterVelocityY) * .68;
      }
      paintWater(teleported);

      const stillMoving = Math.hypot(waterVelocityX, waterVelocityY) > .12;
      if (distance < cautionRadius || stillMoving) {
        waterFrame = requestWaterFrame(animateWater);
      } else {
        lastFrameAt = 0;
      }
    };

    const ensureWaterMotion = () => {
      if (!waterFrame && !stopped && !waterCaught) {
        waterFrame = requestWaterFrame(animateWater);
      }
    };
    const handlePointerMove = (event) => {
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      latestPointer = { x: event.clientX, y: event.clientY };
      ensureWaterMotion();
    };
    const handleResize = () => {
      refreshWaterMetrics();
      paintWater();
      ensureWaterMotion();
    };
    stopWaterMotion = () => {
      if (stopped) return;
      stopped = true;
      cancelWaterFrame();
      if (teleportTimer) timers.clearTimeout?.(teleportTimer);
      teleportTimer = 0;
      root?.removeEventListener?.("pointermove", handlePointerMove, true);
      view?.removeEventListener?.("resize", handleResize);
      view?.visualViewport?.removeEventListener?.("resize", handleResize);
    };
    root.addEventListener("pointermove", handlePointerMove, true);
    view?.addEventListener?.("resize", handleResize);
    view?.visualViewport?.addEventListener?.("resize", handleResize);
    renderCleanup = () => {
      stopWaterMotion();
      waterButton?.remove();
    };
    refreshWaterMetrics();
    paintWater();
  };

  const renderCityQuestion = (guestName) => {
    root.dataset.stage = "questions";
    root.dataset.question = "city";
    persistCheckpoint({ stage: "questions", question: "city", responses });
    setProgress(54, "Question 3 of 4");
    const target = setPanel({
      eyebrow: "TRAVEL PREFERENCES",
      title: "Which city would you choose?",
      copy: "Select one destination from the cards."
    });
    const grid = createElement(documentRef, "div", "birthday-voyage__city-grid");
    let nextButton = null;
    const sofia = BIRTHDAY_CITY_OPTIONS.find((city) => city.id === "sofia");
    BIRTHDAY_CITY_OPTIONS.forEach((city) => {
      const transformed = responses.sofiaSwappedSlots.includes(city.id);
      const renderedCity = transformed ? sofia : city;
      const selected = responses.citySlot === city.id;
      const button = createElement(documentRef, "button", "birthday-voyage__city-card", {
        type: "button",
        "data-city": renderedCity.id,
        "data-slot": city.id,
        "data-sabotaged": transformed ? "true" : "false",
        "aria-pressed": String(selected)
      });
      const label = createElement(documentRef, "strong");
      label.textContent = renderedCity.label;
      const image = createElement(documentRef, "img", "", {
        src: renderedCity.image,
        alt: `${renderedCity.label} city buildings`
      });
      button.classList.toggle("is-selected", selected);
      button.append(label, image);
      button.addEventListener("click", () => {
        const alreadyTransformed = responses.sofiaSwappedSlots.includes(city.id);
        const result = ragebaitCity(alreadyTransformed ? "sofia" : city.id);
        responses.citySlot = city.id;
        responses.cityId = result.city.id;
        responses.city = result.city.label;
        grid.querySelectorAll("button").forEach((candidate) => {
          const isSelected = candidate === button;
          candidate.classList.toggle("is-selected", isSelected);
          candidate.setAttribute("aria-pressed", String(isSelected));
        });
        if (result.sabotaged && !alreadyTransformed) {
          audioDirector?.play?.("sabotage", { intensity: 0.55 });
          responses.sofiaSwappedSlots = [...responses.sofiaSwappedSlots, city.id];
          button.dataset.sabotaged = "true";
          button.dataset.city = "sofia";
          button.classList.add("is-flipping");
          button.disabled = true;
          schedule(() => {
            if (!button.isConnected) return;
            label.textContent = result.city.label;
            image.src = result.city.image;
            image.alt = `${result.city.label} city buildings`;
            button.classList.remove("is-flipping");
            button.disabled = false;
            button.focus({ preventScroll: true });
          }, 220);
        }
        persistCheckpoint({ stage: "questions", question: "city", responses });
        announce(result.sabotaged
          ? `${city.label} changed into Sofia. Sofia is saved.`
          : "Sofia is saved.");
        if (nextButton) nextButton.disabled = false;
      });
      grid.append(button);
    });
    target.append(grid);
    ({ nextButton } = appendQuestionNavigation(target, {
      onBack: () => renderAnimalQuestion(guestName),
      onReset: () => resetQuestionnaire(guestName),
      onNext: () => renderDrinkQuestion(guestName),
      nextEnabled: Boolean(responses.citySlot)
    }));
  };

  const renderAnimalQuestion = (guestName) => {
    root.dataset.stage = "questions";
    root.dataset.question = "animal";
    persistCheckpoint({ stage: "questions", question: "animal", responses });
    setProgress(36, "Question 2 of 4");
    const target = setPanel({
      eyebrow: "TRAVEL PREFERENCES",
      title: "What is your favorite animal?",
      copy: "Type one animal and save your answer."
    });
    const form = createElement(documentRef, "form", "birthday-voyage__form");
    const label = createElement(documentRef, "label");
    label.textContent = "Favorite animal";
    const input = createElement(documentRef, "input", "", {
      type: "text",
      maxlength: "30",
      required: "",
      autocomplete: "off",
      placeholder: "Type an animal"
    });
    input.value = responses.animalTyped;
    const save = createElement(documentRef, "button", "birthday-voyage__primary", {
      type: "submit"
    });
    save.textContent = responses.animalSaved ? "Resave animal" : "Save animal";
    const saved = createElement(documentRef, "p", "birthday-voyage__saved-answer");
    saved.hidden = !responses.animalSaved;
    saved.textContent = responses.animalSaved
      ? `Saved answer: ${responses.animalSaved}`
      : "";
    label.append(input);
    form.append(label, save, saved);
    target.append(form);
    const { nextButton } = appendQuestionNavigation(target, {
      onBack: () => renderCarQuestion(guestName),
      onReset: () => resetQuestionnaire(guestName),
      onNext: () => renderCityQuestion(guestName),
      nextEnabled: Boolean(responses.animalSaved)
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const typed = String(input.value || "").trim();
      if (!typed) return input.focus();
      responses.animalTyped = typed;
      responses.animalSaved = ragebaitAnimal(typed, random);
      if (normalizeBirthdayName(typed) === "lion") {
        audioDirector?.play?.("sabotage", { intensity: 0.5 });
      }
      persistCheckpoint({ stage: "questions", question: "animal", responses });
      save.textContent = "Resave animal";
      saved.hidden = false;
      saved.textContent = `Saved answer: ${responses.animalSaved}`;
      nextButton.disabled = false;
      announce(normalizeBirthdayName(typed) === "lion"
        ? `Lion changed into ${responses.animalSaved}. ${responses.animalSaved} is saved.`
        : `${responses.animalSaved} is approved and saved.`);
    });
  };

  const renderCarQuestion = (guestName) => {
    root.dataset.stage = "questions";
    root.dataset.question = "car";
    persistCheckpoint({ stage: "questions", question: "car", responses });
    setProgress(18, "Question 1 of 4");
    const target = setPanel({
      eyebrow: "TRAVEL PREFERENCES",
      title: "Choose the perfect road-trip car.",
      copy: "Select the car you would most want for the journey."
    });
    const choices = createElement(documentRef, "div", "birthday-voyage__choice-grid birthday-voyage__choice-grid--cars");
    choices.classList.toggle("is-final", Boolean(responses.carId));
    let nextButton = null;
    const removed = new Set(responses.removedCarIds);
    BIRTHDAY_CAR_OPTIONS.forEach((car) => {
      if (removed.has(car.id)) return;
      const renderedCar = car.id === "rav4" && responses.toyotaMorphed
        ? BIRTHDAY_SEDAN_FALLBACK
        : car;
      const selected = responses.carId === renderedCar.id;
      const button = createElement(documentRef, "button", "birthday-voyage__choice", {
        type: "button",
        "data-value": renderedCar.id,
        "data-original-value": car.id,
        "aria-pressed": String(selected)
      });
      button.textContent = renderedCar.label;
      button.classList.toggle("is-selected", selected);
      button.classList.toggle("is-morphed", renderedCar.id === "sedan");
      button.disabled = Boolean(responses.carId);
      button.addEventListener("click", () => {
        const result = eliminateBirthdayCar(responses.removedCarIds, car.id);
        responses.removedCarIds = [...result.eliminatedIds];
        if (result.complete) {
          responses.carId = result.survivor.id;
          responses.car = result.survivor.label;
          responses.toyotaMorphed = result.morphed;
        } else {
          responses.carId = "";
          responses.car = "";
          responses.toyotaMorphed = false;
        }
        choices.querySelectorAll("button").forEach((candidate) => {
          candidate.disabled = true;
        });
        button.classList.add("is-removing");
        audioDirector?.play?.("sabotage", { intensity: 0.58 });
        persistCheckpoint({ stage: "questions", question: "car", responses });
        const resetCountAtElimination = responses.resetCount;
        const remainingCount = result.remainingIds.length;
        announce(result.morphed
          ? "Toyota RAV4 changed into a Sedan. Sedan is selected."
          : result.complete
            ? `${result.survivor.label} is the final available car and has been selected.`
            : `Okay, we removed ${car.label}. Whatever you say! ${remainingCount} option${remainingCount === 1 ? "" : "s"} remain.`);
        schedule(() => {
          renderCarQuestion(guestName);
          if (responses.resetCount !== resetCountAtElimination) return;
          announce(result.morphed
            ? "Toyota RAV4 changed into a Sedan. Sedan is selected."
            : result.complete
              ? `${result.survivor.label} is selected.`
              : `${car.label} was removed. ${remainingCount} option${remainingCount === 1 ? "" : "s"} remain.`);
          const focusTarget = result.complete
            ? panel.querySelector(".birthday-voyage__question-nav .birthday-voyage__primary")
            : panel.querySelector(".birthday-voyage__choice:not(:disabled)");
          focusTarget?.focus?.({ preventScroll: true });
        }, BIRTHDAY_CAR_RESELECT_MS);
      });
      choices.append(button);
    });
    target.append(choices);
    ({ nextButton } = appendQuestionNavigation(target, {
      onReset: () => resetQuestionnaire(guestName),
      onNext: () => renderAnimalQuestion(guestName),
      nextEnabled: Boolean(responses.carId)
    }));
  };

  const renderSpecialUnlock = (guestName) => {
    root.dataset.special = "true";
    setProgress(7, "Secret passenger recognized");
    const target = setPanel({
      eyebrow: "HIDDEN CONSTELLATION FOUND",
      title: `There you are, ${BIRTHDAY_HONOREE_DISPLAY_NAME || "Sophia"}.`,
      copy: "A private birthday voyage has been waiting. First, complete a short travel questionnaire."
    });
    const orbit = createElement(documentRef, "div", "birthday-voyage__unlock-orbit", {
      "aria-hidden": "true"
    });
    orbit.append(
      createElement(documentRef, "i"),
      createElement(documentRef, "i"),
      createElement(documentRef, "b")
    );
    const begin = createElement(documentRef, "button", "birthday-voyage__primary", {
      type: "button"
    });
    begin.textContent = "Begin questionnaire";
    begin.addEventListener("click", () => renderCarQuestion(guestName), { once: true });
    target.append(orbit, begin);
    begin.focus();
  };

  const resumeFromCheckpoint = (guestName, checkpoint) => {
    checkpointState = { ...checkpoint };
    responses = {
      ...initialResponses(),
      ...(checkpoint.responses || {}),
      removedCarIds: Array.from(checkpoint.responses?.removedCarIds || []),
      sofiaSwappedSlots: Array.from(checkpoint.responses?.sofiaSwappedSlots || [])
    };
    if (checkpoint.stage === "lion-intro") {
      renderLionIntro(guestName);
      return;
    }
    if (checkpoint.stage === "route" || checkpoint.stage === "finale") {
      runRouteAnimation(guestName, checkpoint);
      return;
    }
    const renderQuestion = {
      car: renderCarQuestion,
      animal: renderAnimalQuestion,
      city: renderCityQuestion,
      drink: renderDrinkQuestion,
      summary: renderSummary
    }[checkpoint.question] || renderCarQuestion;
    renderQuestion(guestName);
  };

  const renderResumePrompt = (guestName, checkpoint) => {
    root.dataset.stage = "resume";
    root.dataset.question = "resume";
    setProgress(5, "Saved journey found");
    const target = setPanel({
      eyebrow: "YOUR PLACE IS STILL HERE",
      title: "Resume our journey?",
      copy: "This device remembers the exact chapter where the voyage paused."
    });
    const resume = createElement(documentRef, "section", "birthday-voyage__resume");
    const summary = createElement(documentRef, "p", "birthday-voyage__resume-summary");
    const destination = BIRTHDAY_ROUTE.find(({ id }) => id === checkpoint.currentDestination);
    const questionLabels = {
      car: "the first travel question",
      animal: "the animal question",
      city: "the city question",
      drink: "the drink question",
      summary: "the answer review"
    };
    summary.textContent = checkpoint.stage === "route" || checkpoint.stage === "finale"
      ? `Saved near ${destination?.label || "the next chapter"} · ${checkpoint.completedChapters.length} of ${BIRTHDAY_ROUTE.length} chapters explored.`
      : `Saved at ${questionLabels[checkpoint.question] || "the questionnaire"}.`;
    const actions = createElement(documentRef, "div", "birthday-voyage__resume-actions");
    const resumeButton = createElement(documentRef, "button", "birthday-voyage__primary", { type: "button" });
    resumeButton.textContent = "Resume our journey";
    const restartButton = createElement(documentRef, "button", "birthday-voyage__secondary", { type: "button" });
    restartButton.textContent = "Start over";
    resumeButton.addEventListener("click", () => resumeFromCheckpoint(guestName, checkpoint), { once: true });
    restartButton.addEventListener("click", () => {
      clearBirthdayVoyageCheckpoint(storage);
      safeRemove(storage, COMPLETION_KEY);
      checkpointState = null;
      responses = initialResponses();
      renderSpecialUnlock(guestName);
      announce("The saved journey was reset. A fresh voyage is ready.");
    }, { once: true });
    actions.append(resumeButton, restartButton);
    resume.append(summary, actions);
    target.append(resume);
    resumeButton.focus({ preventScroll: true });
  };

  const renderGuestWelcome = (guestName) => {
    setProgress(100, "Guest route ready");
    const target = setPanel({
      eyebrow: "GUEST PASS CREATED",
      title: `Welcome aboard, ${guestName}.`,
      copy: "Your name is only kept for this play session. The main universe is ready."
    });
    const continueButton = createElement(documentRef, "button", "birthday-voyage__primary", {
      type: "button"
    });
    continueButton.textContent = "Continue to Constellore";
    continueButton.addEventListener("click", () => close(), { once: true });
    target.append(continueButton);
    continueButton.focus();
  };

  const submitName = (value) => {
    const guestName = sanitizeGuestName(value);
    if (!guestName) return false;
    const { special } = resolveBirthdayVoyageAccess(guestName, {
      locationRef,
      honoreeNames
    });
    const sessionName = special
      ? (BIRTHDAY_HONOREE_DISPLAY_NAME || "Sophia")
      : guestName;
    activeGuestName = sessionName;
    specialAccess = special;
    safeSet(sessionStorage, SESSION_GUEST_KEY, guestName);
    installGuestBadge(documentRef, sessionName);
    const CustomEventConstructor = documentRef.defaultView?.CustomEvent || globalThis.CustomEvent;
    if (typeof CustomEventConstructor === "function") {
      documentRef.defaultView?.dispatchEvent?.(new CustomEventConstructor("constellore:birthday-name", {
        detail: Object.freeze({ name: sessionName, birthday: special })
      }));
    }
    if (special) {
      const checkpoint = readBirthdayVoyageCheckpoint(storage);
      if (checkpoint) renderResumePrompt(sessionName, checkpoint);
      else renderSpecialUnlock(sessionName);
    } else {
      renderGuestWelcome(guestName);
    }
    return true;
  };

  const renderNamePrompt = () => {
    setProgress(0, "Passenger check");
    const target = setPanel({
      eyebrow: "BEFORE WE CHART THE NEXT STAR",
      title: "Who is joining this voyage?",
      copy: "Enter a name. It stays on this device and becomes your name for this play session."
    });
    const form = createElement(documentRef, "form", "birthday-voyage__form");
    const label = createElement(documentRef, "label");
    label.textContent = "Traveler name";
    const input = createElement(documentRef, "input", "", {
      type: "text",
      maxlength: "40",
      required: "",
      autocomplete: "name",
      placeholder: "Your name"
    });
    const submit = createElement(documentRef, "button", "birthday-voyage__primary", {
      type: "submit"
    });
    submit.textContent = "Join the voyage";
    label.append(input);
    form.append(label, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!submitName(input.value)) input.focus();
    });
    target.append(form);
    input.focus();
  };

  const build = () => {
    previousFocus = documentRef.activeElement;
    previousDocumentTitle = documentRef.title;
    documentRef.title = `A Birthday Voyage for ${BIRTHDAY_HONOREE_DISPLAY_NAME || "Sophia"}`;
    backgroundState = Array.from(documentRef.body?.children || []).map((element) => ({
      element,
      inert: Boolean(element.inert),
      inertAttribute: element.getAttribute("inert"),
      ariaHidden: element.getAttribute("aria-hidden")
    }));
    root = createElement(documentRef, "section", "birthday-voyage", {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "birthdayVoyageTitle",
      "data-stage": "questions",
      "data-voyage-version": String(BIRTHDAY_VOYAGE_VERSION)
    });
    const backdrop = createElement(documentRef, "div", "birthday-voyage__backdrop", {
      "aria-hidden": "true"
    });
    for (let index = 0; index < 24; index += 1) {
      backdrop.append(createElement(documentRef, "i", "", {
        style: [
          `--birthday-x:${(index * 47 + 11) % 97}%`,
          `--birthday-y:${(index * 31 + 7) % 89}%`,
          `--birthday-size:${2 + (index % 3)}px`,
          `--birthday-twinkle:${1.8 + (index % 5) * .5}s`
        ].join(";")
      }));
    }
    const shell = createElement(documentRef, "div", "birthday-voyage__shell");
    const topbar = createElement(documentRef, "div", "birthday-voyage__topbar");
    const brand = createElement(documentRef, "span");
    brand.id = "birthdayVoyageTitle";
    brand.textContent = "CONSTELLORE / BIRTHDAY VOYAGE";
    progress = createElement(documentRef, "span", "birthday-voyage__progress");
    let soundToggle = null;
    if (audioDirector) {
      soundToggle = createElement(documentRef, "button", "birthday-voyage__sound-toggle", {
        type: "button",
        "aria-label": "Toggle birthday voyage sound"
      });
      const updateSoundToggle = (state = {}) => {
        const muted = typeof state.muted === "boolean"
          ? state.muted
          : Boolean(audioDirector.isMuted?.());
        root.dataset.sound = muted ? "muted" : "on";
        soundToggle.setAttribute("aria-pressed", String(!muted));
        soundToggle.setAttribute(
          "aria-label",
          muted ? "Turn voyage sound on" : "Mute voyage sound"
        );
        soundToggle.textContent = muted ? "Sound off" : "Sound on";
      };
      updateSoundToggle();
      soundToggle.addEventListener("click", () => {
        audioDirector.toggleMuted?.();
        updateSoundToggle();
      });
      const subscription = audioDirector.subscribe?.(updateSoundToggle);
      if (typeof subscription === "function") unsubscribeAudio = subscription;
    }
    closeButton = createElement(documentRef, "button", "birthday-voyage__close", {
      type: "button",
      "aria-label": "Close birthday voyage"
    });
    closeButton.textContent = "\u00d7";
    closeButton.addEventListener("click", () => close());
    topbar.append(brand, progress);
    if (soundToggle) topbar.append(soundToggle);
    topbar.append(closeButton);
    panel = createElement(documentRef, "div", "birthday-voyage__panel");
    status = createElement(documentRef, "p", "birthday-voyage__status", {
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true"
    });
    shell.append(topbar, panel, status);
    root.append(backdrop, shell);
    documentRef.body.append(root);
    audioDirector?.enter?.({ root });
    backgroundState.forEach(({ element }) => {
      if (element === root) return;
      if ("inert" in element) element.inert = true;
      else element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        const activeDialog = root.querySelector("dialog[open]");
        const focusScope = activeDialog || root;
        const focusable = Array.from(focusScope.querySelectorAll([
          "a[href]",
          "button:not([disabled])",
          "input:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          "[tabindex]:not([tabindex='-1'])",
          "[contenteditable='true']"
        ].join(","))).filter((element) => (
          element.getAttribute("aria-hidden") !== "true"
          && (element.getClientRects?.().length > 0 || element === documentRef.activeElement)
        ));
        if (!focusable.length) {
          event.preventDefault();
          root.setAttribute("tabindex", "-1");
          root.focus({ preventScroll: true });
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = documentRef.activeElement;
        if (event.shiftKey && (current === first || !focusScope.contains(current))) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        } else if (!event.shiftKey && (current === last || !focusScope.contains(current))) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
        return;
      }
      if (event.key !== "Escape") return;
      if (root.querySelector("dialog[open]")) return;
      event.preventDefault();
      close();
    });
    documentRef.body.classList.add("birthday-voyage-active");
  };

  const start = async () => {
    if (!BIRTHDAY_VOYAGE_ENABLED || !documentRef?.body || mode === "off") {
      return Object.freeze({ started: false, reason: "disabled" });
    }
    const rememberedName = currentBirthdayGuestName(sessionStorage);
    const rememberedSpecial = localSpecial
      || (mode !== "guest" && isBirthdayHonoree(rememberedName, honoreeNames));
    if (rememberedName) installGuestBadge(
      documentRef,
      rememberedSpecial ? (BIRTHDAY_HONOREE_DISPLAY_NAME || "Sophia") : rememberedName
    );
    if (!forceReplay && safeGet(sessionStorage, SESSION_PROMPT_KEY)) {
      return Object.freeze({ started: false, reason: "session-prompted" });
    }
    if (!forceReplay && safeGet(storage, COMPLETION_KEY)) {
      return Object.freeze({ started: false, reason: "completed" });
    }
    safeSet(sessionStorage, SESSION_PROMPT_KEY, "shown");
    await ensureStyles(documentRef);
    build();
    const checkpoint = rememberedSpecial
      ? readBirthdayVoyageCheckpoint(storage)
      : null;
    if (rememberedName && rememberedSpecial && checkpoint) {
      activeGuestName = BIRTHDAY_HONOREE_DISPLAY_NAME || "Sophia";
      specialAccess = true;
      checkpointState = { ...checkpoint };
      renderResumePrompt(activeGuestName, checkpoint);
    } else {
      renderNamePrompt();
    }
    return Object.freeze({ started: true, reason: forceReplay ? "forced" : "first-session" });
  };

  return Object.freeze({
    start,
    close,
    submitName,
    get root() {
      return root;
    }
  });
}

export async function launchBirthdayVoyage(options = {}) {
  const experience = createBirthdayVoyageExperience(options);
  const outcome = await experience.start();
  return Object.freeze({ experience, outcome });
}
