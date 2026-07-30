const CARD_VERSION = 2;
const MAX_POINTS = 18;

const REALMS = Object.freeze({
  cosmic: {
    label: "CELESTIAL",
    line: "A path written between the stars.",
    dark: "#050817",
    deep: "#101b46",
    color: "#7668ff",
    light: "#79e7ff",
    warm: "#ffd77b"
  },
  water: {
    label: "TIDAL",
    line: "A current of ideas found its shore.",
    dark: "#03141d",
    deep: "#073a50",
    color: "#18a9cb",
    light: "#84f4ef",
    warm: "#ffe28a"
  },
  fire: {
    label: "EMBER",
    line: "A bright idea became a new flame.",
    dark: "#190809",
    deep: "#4a1517",
    color: "#ff6647",
    light: "#ffb75e",
    warm: "#fff09b"
  },
  nature: {
    label: "VERDANT",
    line: "Small discoveries grew into one path.",
    dark: "#06130f",
    deep: "#123d2e",
    color: "#43c98b",
    light: "#a8f3b5",
    warm: "#f4dc83"
  },
  life: {
    label: "LIVING",
    line: "One living idea led to another.",
    dark: "#10091a",
    deep: "#392044",
    color: "#df6cc6",
    light: "#9cf1d2",
    warm: "#ffd791"
  },
  structure: {
    label: "FORGED",
    line: "Every piece found its place.",
    dark: "#101014",
    deep: "#34303b",
    color: "#c77b55",
    light: "#f0c58f",
    warm: "#ffe49a"
  },
  technology: {
    label: "ELECTRIC",
    line: "A chain of ideas switched on.",
    dark: "#030f18",
    deep: "#0e3049",
    color: "#39a9ff",
    light: "#65f1dd",
    warm: "#fff18a"
  },
  mind: {
    label: "DREAMING",
    line: "A thought became its own constellation.",
    dark: "#0c0717",
    deep: "#302052",
    color: "#a77bff",
    light: "#ee9ce6",
    warm: "#ffe49c"
  }
});

const REALM_HINTS = Object.freeze({
  cosmic: ["astronaut", "comet", "constellation", "cosmos", "eclipse", "galaxy", "gravity", "moon", "orbit", "planet", "rocket", "satellite", "sky", "space", "star", "sun", "telescope", "universe"],
  water: ["beach", "cloud", "coral", "current", "fish", "fog", "ice", "island", "lake", "mist", "ocean", "rain", "river", "sea", "snow", "steam", "storm", "water", "wave"],
  fire: ["ash", "ember", "fire", "flame", "heat", "inferno", "lava", "lightning", "magma", "smoke", "volcano"],
  technology: ["battery", "computer", "electric", "engine", "internet", "laser", "machine", "power", "radio", "robot", "technology", "train"],
  structure: ["brick", "bridge", "castle", "city", "factory", "glass", "house", "metal", "road", "stone", "tower", "village", "wall", "windmill"],
  life: ["animal", "bird", "blood", "cell", "fish", "human", "life", "person", "species"],
  nature: ["desert", "earth", "field", "flower", "forest", "garden", "grass", "mountain", "mud", "plant", "sand", "seed", "soil", "tree"],
  mind: ["art", "book", "dream", "idea", "knowledge", "language", "love", "magic", "memory", "music", "story", "time"]
});

const DEFAULT_CARD_STYLE = "celestial-atlas";
const CARD_STYLE_ALIASES = Object.freeze({
  "": DEFAULT_CARD_STYLE,
  atlas: DEFAULT_CARD_STYLE,
  celestial: DEFAULT_CARD_STYLE,
  "celestial-atlas": DEFAULT_CARD_STYLE,
  "constellore-collection-celestial-atlas": DEFAULT_CARD_STYLE,
  default: DEFAULT_CARD_STYLE,
  aurora: "aurora-archive",
  "aurora-archive": "aurora-archive",
  "constellore-collection-aurora-archive": "aurora-archive",
  solar: "solar-foundry",
  foundry: "solar-foundry",
  "solar-foundry": "solar-foundry",
  "constellore-collection-solar-foundry": "solar-foundry",
  lunar: "lunar-garden",
  garden: "lunar-garden",
  "lunar-garden": "lunar-garden",
  "constellore-collection-lunar-garden": "lunar-garden",
  eclipse: "eclipse-sovereign",
  sovereign: "eclipse-sovereign",
  "eclipse-sovereign": "eclipse-sovereign",
  "constellore-collection-eclipse-sovereign": "eclipse-sovereign",
  pixel: "pixel-frontier",
  retro: "pixel-frontier",
  "pixel-frontier": "pixel-frontier",
  "constellore-collection-pixel-frontier": "pixel-frontier",
  bubble: "bubble-reef",
  reef: "bubble-reef",
  "bubble-reef": "bubble-reef",
  "constellore-collection-bubble-reef": "bubble-reef",
  stellar: "stellar-vanguard",
  vanguard: "stellar-vanguard",
  "stellar-vanguard": "stellar-vanguard",
  "constellore-collection-stellar-vanguard": "stellar-vanguard",
  custom: "custom"
});

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function cleanText(value, maximum = 80) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

export function normalizeConstellationCardStyle(value) {
  let candidate = value;
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    candidate = candidate.cardStyle
      ?? candidate.cosmeticCollection
      ?? candidate.collectionId
      ?? candidate.slug
      ?? candidate.id
      ?? "";
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      candidate = candidate.slug ?? candidate.id ?? "";
    }
  }
  const token = cleanText(candidate, 80)
    .toLocaleLowerCase("en-US")
    .replace(/[\s_.:/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return CARD_STYLE_ALIASES[token] || DEFAULT_CARD_STYLE;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol) ? url.toString().slice(0, 500) : "";
  } catch {
    return "";
  }
}

function safeDayKey(value) {
  const key = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

function dailyKeyFromGame(game = {}, fallback = "") {
  const challengeMatch = cleanText(game.challengeId, 160).match(/^daily:(\d{4}-\d{2}-\d{2})$/);
  return safeDayKey(challengeMatch?.[1] || game.dailyKey || fallback);
}

function divisionFor({ training, scoringDisabled, assist, wished }) {
  if (training) return "TRAINING";
  if (scoringDisabled) return "STUDY";
  return assist && assist !== "none" || wished ? "OPEN" : "PURE";
}

function realmFor(input = {}) {
  const explicit = cleanText(input.realm || input.category, 32).toLocaleLowerCase("en-US");
  if (Object.hasOwn(REALMS, explicit)) return explicit;
  const history = Array.isArray(input.history) ? input.history : [];
  const words = history.flatMap((step) => [step?.a, step?.b, step?.word]).filter(Boolean).join(" ");
  const target = cleanText(input.target, 64).toLocaleLowerCase("en-US");
  const clue = cleanText(input.clue, 110).toLocaleLowerCase("en-US");
  const route = words.toLocaleLowerCase("en-US");
  let bestRealm = "mind";
  let bestScore = 0;
  for (const [realm, hints] of Object.entries(REALM_HINTS)) {
    const score = hints.reduce((total, hint) => {
      const pattern = new RegExp(`\\b${hint}\\b`, "i");
      return total
        + (pattern.test(target) ? 5 : 0)
        + (pattern.test(clue) ? 2 : 0)
        + (pattern.test(route) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestRealm = realm;
      bestScore = score;
    }
  }
  return bestRealm;
}

function constellationPoints(count, seedValue) {
  const random = seeded(seedValue);
  const safeCount = clampInteger(count, 4, MAX_POINTS, 7);
  const points = [];
  for (let index = 0; index < safeCount; index += 1) {
    const progress = safeCount === 1 ? 0 : index / (safeCount - 1);
    const x = 138 + progress * 795 + Math.sin(progress * Math.PI * 3.2) * 84 + (random() - .5) * 45;
    const y = 715 - progress * 245 + Math.cos(progress * Math.PI * 4.1) * 150 + (random() - .5) * 62;
    points.push({
      x: Math.round(Math.min(970, Math.max(110, x))),
      y: Math.round(Math.min(850, Math.max(360, y))),
      radius: Number((4.5 + random() * 5.5).toFixed(1)),
      glow: Number((.45 + random() * .5).toFixed(2))
    });
  }
  return points;
}

function skyDust(seedValue) {
  const random = seeded(seedValue ^ 0xa341316c);
  return Array.from({ length: 58 }, (_, index) => ({
    x: Math.round(35 + random() * 1010),
    y: Math.round(42 + random() * 1195),
    radius: Number((index % 9 === 0 ? 1.8 + random() * 1.8 : .5 + random() * 1.25).toFixed(1)),
    opacity: Number((.16 + random() * .58).toFixed(2))
  }));
}

export function buildConstelloreChallengeUrl(game = {}, baseUrl, options = {}) {
  const target = cleanText(game.target, 64);
  if (!target) return "";
  let url;
  try {
    url = new URL(String(baseUrl || ""));
  } catch {
    return "";
  }
  if (!["https:", "http:"].includes(url.protocol)) return "";
  url.search = "";
  url.hash = "";
  const seed = clampInteger(game.seed, 0, Number.MAX_SAFE_INTEGER, stableHash(target));
  const mode = cleanText(game.mode, 24).toLocaleLowerCase("en-US");
  const dailyKey = dailyKeyFromGame(game, options.dailyKey);
  url.searchParams.set("challenge", "1");
  url.searchParams.set("target", target);
  url.searchParams.set("seed", String(seed));
  url.searchParams.set("from", mode === "daily" ? "daily" : "friend");
  if (mode === "daily" && dailyKey) url.searchParams.set("day", dailyKey);
  return url.toString();
}

export function parseConstelloreChallengeUrl(value, currentDay = "") {
  let params;
  try {
    if (value instanceof URLSearchParams) params = value;
    else if (value instanceof URL) params = value.searchParams;
    else {
      const text = String(value || "");
      params = text.startsWith("?") || !text.includes("://")
        ? new URLSearchParams(text.startsWith("?") ? text.slice(1) : text)
        : new URL(text).searchParams;
    }
  } catch {
    return null;
  }
  if (params.get("challenge") !== "1") return null;
  const target = cleanText(params.get("target"), 64);
  if (!target) return null;
  const rawSeed = Number(params.get("seed"));
  const seed = Number.isFinite(rawSeed)
    ? clampInteger(rawSeed, 0, Number.MAX_SAFE_INTEGER, stableHash(target))
    : stableHash(target);
  const source = params.get("from") === "daily" ? "daily" : "friend";
  const dailyKey = source === "daily" ? safeDayKey(params.get("day")) : "";
  const today = safeDayKey(currentDay);
  return {
    target,
    seed,
    source,
    dailyKey,
    currentDaily: Boolean(dailyKey && today && dailyKey === today),
    mode: dailyKey && today && dailyKey === today ? "daily" : "challenge"
  };
}

export function buildConstellationCard(input = {}) {
  const history = Array.isArray(input.history) ? input.history.slice(-MAX_POINTS) : [];
  const target = cleanText(input.target, 64) || "Unknown Star";
  const universeName = cleanText(input.universe?.name || input.law?.name || "Deep Void", 48);
  const seedIdentity = cleanText(input.universe?.id || input.seedIdentity || input.seed || "origin", 48);
  const seedValue = stableHash(`${target}|${seedIdentity}|${history.map((step) => step?.word).join("|")}`);
  const milestones = [];
  for (const step of history) {
    const word = cleanText(step?.word, 38);
    if (!word || word.toLocaleLowerCase("en-US") === target.toLocaleLowerCase("en-US") || milestones.includes(word)) continue;
    milestones.push(word);
  }
  const realm = realmFor(input);
  const clue = cleanText(input.clue, 110) || REALMS[realm].line;
  const mode = cleanText(input.mode, 24).toLocaleLowerCase("en-US");
  const dailyKey = safeDayKey(input.dailyKey);
  const cardStyle = normalizeConstellationCardStyle(input.cardStyle ?? input.cosmeticCollection);
  return {
    version: CARD_VERSION,
    target,
    emoji: cleanText(input.emoji || "✦", 12),
    clue,
    realm,
    moves: clampInteger(input.moves, 0, 999, history.length),
    seconds: clampInteger(input.seconds, 0, 86_399, 0),
    stars: clampInteger(input.stars ?? history.length, 0, 999, history.length),
    discoveries: clampInteger(input.discoveries, 0, 9999, 0),
    division: divisionFor(input),
    completed: input.completed == null
      ? history.some((step) => cleanText(step?.word, 64).toLocaleLowerCase("en-US") === target.toLocaleLowerCase("en-US"))
      : input.completed === true,
    mode: mode === "daily" ? "daily" : "challenge",
    dailyKey: mode === "daily" ? dailyKey : "",
    law: cleanText(input.law?.name || input.universe?.law?.name, 48),
    universe: { name: universeName, id: seedIdentity },
    milestones: milestones.slice(0, 4),
    ...(cardStyle === DEFAULT_CARD_STYLE ? {} : { cardStyle }),
    challengeUrl: safeUrl(input.challengeUrl),
    points: constellationPoints(Math.max(4, history.length + 2), seedValue),
    dust: skyDust(seedValue),
    signature: seedValue.toString(36).toUpperCase().padStart(7, "0")
  };
}

function xml(value) {
  return cleanText(value, 500)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatTime(seconds) {
  const safe = clampInteger(seconds, 0, 86_399, 0);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function formatDay(dayKey) {
  if (!safeDayKey(dayKey)) return "";
  const date = new Date(`${dayKey}T12:00:00Z`);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(date).toLocaleUpperCase("en-US");
}

function curveBetween(from, to) {
  const midpointX = Math.round((from.x + to.x) / 2);
  const bend = Math.round((to.y - from.y) * .12);
  return `M ${from.x} ${from.y} Q ${midpointX} ${Math.round((from.y + to.y) / 2) + bend} ${to.x} ${to.y}`;
}

function realmMotif(realm) {
  if (realm === "water") return `<g class="motif" fill="none"><path d="M-80 890 Q180 780 420 890 T920 890 T1420 890"/><path d="M-100 950 Q170 840 430 950 T950 950 T1450 950"/></g>`;
  if (realm === "fire") return `<g class="motif" fill="none"><path d="M80 1010 C260 820 180 620 380 470 C300 720 520 750 470 1010"/><path d="M610 1010 C850 760 710 620 930 390 C820 720 1080 760 1010 1010"/></g>`;
  if (realm === "nature" || realm === "life") return `<g class="motif" fill="none"><path d="M70 1040 C240 900 245 690 420 535 C330 775 470 850 610 920 C720 975 820 1010 1030 1015"/><path d="M283 735 Q190 690 150 600 M344 640 Q450 600 510 515 M600 915 Q695 805 785 785"/></g>`;
  if (realm === "structure") return `<g class="motif" fill="none"><path d="M40 1040 L260 820 L430 930 L660 610 L1035 980"/><path d="M115 980 L115 850 L260 850 M710 980 L710 760 L900 760 L900 980"/></g>`;
  if (realm === "technology") return `<g class="motif" fill="none"><path d="M45 1000 H270 V880 H470 V960 H690 V790 H1035"/><circle cx="270" cy="880" r="16"/><circle cx="690" cy="790" r="16"/></g>`;
  if (realm === "mind") return `<g class="motif" fill="none"><path d="M120 920 C120 670 420 670 420 875 C420 1050 690 1050 690 820 C690 630 980 650 980 900"/><circle cx="420" cy="875" r="90"/><circle cx="690" cy="820" r="122"/></g>`;
  return `<g class="motif" fill="none"><circle cx="830" cy="650" r="250"/><circle cx="830" cy="650" r="330"/><path d="M400 1040 Q700 690 1050 460"/><path d="M500 1140 Q800 800 1150 570"/></g>`;
}

function cardMaterial(style, palette) {
  if (style === "aurora-archive") {
    return {
      rootAttribute: ` data-card-style="aurora-archive"`,
      definitions: `<linearGradient id="auroraWash" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#6fffe1"/><stop offset=".48" stop-color="#78ddea"/><stop offset="1" stop-color="#a894ff"/></linearGradient>
    <linearGradient id="auroraFrame" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d8fff8" stop-opacity=".9"/><stop offset=".4" stop-color="#6fffe1" stop-opacity=".4"/><stop offset="1" stop-color="#a894ff" stop-opacity=".72"/></linearGradient>
    <linearGradient id="auroraPanel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d8fff8" stop-opacity=".11"/><stop offset=".5" stop-color="#6fffe1" stop-opacity=".035"/><stop offset="1" stop-color="#a894ff" stop-opacity=".09"/></linearGradient>
    <pattern id="frostLattice" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M0 36 L36 0 L72 36 L36 72 Z" fill="none" stroke="#d8fff8" stroke-opacity=".075"/><circle cx="36" cy="36" r="3" fill="#6fffe1" fill-opacity=".12"/></pattern>
    <filter id="auroraBlur" x="-20%" y="-80%" width="140%" height="260%"><feGaussianBlur stdDeviation="22"/></filter>`,
      backdrop: `<path d="M-140 510 C130 180 350 650 650 310 S1080 180 1240 440" fill="none" stroke="url(#auroraWash)" stroke-width="96" stroke-opacity=".12" filter="url(#auroraBlur)"/>
    <path d="M-100 575 C180 245 410 660 700 330 S1070 240 1190 485" fill="none" stroke="url(#auroraWash)" stroke-width="8" stroke-opacity=".24"/>
    <rect width="1080" height="1350" fill="url(#frostLattice)"/>`,
      foreground: `<g class="material-etch" fill="none" stroke="url(#auroraFrame)"><path d="M30 174 H52 M30 174 V250 M1050 174 H1028 M1050 174 V250"/><path d="M30 1176 H52 M30 1176 V1100 M1050 1176 H1028 M1050 1176 V1100"/></g>`,
      frame: "url(#auroraFrame)",
      panelFill: "url(#auroraPanel)",
      panelOpacity: "1",
      label: "AURORA ARCHIVE",
      labelColor: "#9fffea"
    };
  }
  if (style === "solar-foundry") {
    return {
      rootAttribute: ` data-card-style="solar-foundry"`,
      definitions: `<linearGradient id="solarBrass" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#70451f"/><stop offset=".28" stop-color="#e2a74f"/><stop offset=".58" stop-color="#ffe1a0"/><stop offset="1" stop-color="#9a5f29"/></linearGradient>
    <linearGradient id="solarPanel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffe1a0" stop-opacity=".1"/><stop offset=".44" stop-color="#e2a74f" stop-opacity=".025"/><stop offset="1" stop-color="#70451f" stop-opacity=".14"/></linearGradient>
    <pattern id="engravedGrid" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M0 0 H54 V54" fill="none" stroke="#e2a74f" stroke-opacity=".07"/><path d="M27 0 V54 M0 27 H54" stroke="#ffe1a0" stroke-opacity=".025"/></pattern>
    <filter id="emberBlur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="26"/></filter>`,
      backdrop: `<rect width="1080" height="1350" fill="url(#engravedGrid)"/>
    <circle cx="1020" cy="390" r="318" fill="none" stroke="#e2a74f" stroke-opacity=".12" stroke-width="2"/>
    <circle cx="1020" cy="390" r="250" fill="none" stroke="#ffe1a0" stroke-opacity=".08" stroke-width="18" stroke-dasharray="2 28"/>
    <path d="M-90 870 Q350 700 690 930 T1190 820" fill="none" stroke="#e2a74f" stroke-opacity=".12" stroke-width="72" filter="url(#emberBlur)"/>`,
      foreground: `<g class="material-etch" fill="none" stroke="url(#solarBrass)"><path d="M30 240 V108 M30 108 Q30 30 108 30 H240"/><path d="M840 30 H972 Q1050 30 1050 108 V240"/><path d="M30 1110 V1242 Q30 1320 108 1320 H240"/><path d="M840 1320 H972 Q1050 1320 1050 1242 V1110"/><circle cx="990" cy="1150" r="42"/><path d="M990 1097 V1111 M990 1189 V1203 M937 1150 H951 M1029 1150 H1043"/></g>`,
      frame: "url(#solarBrass)",
      panelFill: "url(#solarPanel)",
      panelOpacity: "1",
      label: "SOLAR FOUNDRY",
      labelColor: "#f5c875"
    };
  }
  if (style === "lunar-garden") {
    return {
      rootAttribute: ` data-card-style="lunar-garden"`,
      definitions: `<linearGradient id="lunarSilverleaf" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#486f67"/><stop offset=".34" stop-color="#78e6bd"/><stop offset=".68" stop-color="#dfffd0"/><stop offset="1" stop-color="#b8a6ff"/></linearGradient>
    <linearGradient id="lunarPanel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#dfffd0" stop-opacity=".1"/><stop offset=".5" stop-color="#78e6bd" stop-opacity=".025"/><stop offset="1" stop-color="#b8a6ff" stop-opacity=".12"/></linearGradient>
    <pattern id="moonpetalLattice" width="92" height="92" patternUnits="userSpaceOnUse"><path d="M46 8 C57 24 67 35 84 46 C67 57 57 68 46 84 C35 68 24 57 8 46 C24 35 35 24 46 8 Z" fill="none" stroke="#dfffd0" stroke-opacity=".055"/><circle cx="46" cy="46" r="4" fill="#78e6bd" fill-opacity=".12"/></pattern>
    <filter id="jadeBloom" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="24"/></filter>`,
      backdrop: `<rect width="1080" height="1350" fill="url(#moonpetalLattice)"/>
    <path d="M-70 1100 C90 850 65 590 240 360 C305 275 380 225 460 190" fill="none" stroke="#78e6bd" stroke-opacity=".12" stroke-width="72" filter="url(#jadeBloom)"/>
    <path d="M1150 1090 C975 865 1005 600 830 370 C765 285 700 235 620 195" fill="none" stroke="#b8a6ff" stroke-opacity=".1" stroke-width="72" filter="url(#jadeBloom)"/>
    <path d="M74 1090 C180 870 145 610 350 420 M1006 1090 C900 870 935 610 730 420" fill="none" stroke="#dfffd0" stroke-opacity=".14" stroke-width="3"/>`,
      foreground: `<g class="material-etch" fill="none" stroke="url(#lunarSilverleaf)"><path d="M30 260 Q112 190 118 78 Q190 115 260 30"/><path d="M1050 260 Q968 190 962 78 Q890 115 820 30"/><path d="M30 1090 Q112 1160 118 1272 Q190 1235 260 1320"/><path d="M1050 1090 Q968 1160 962 1272 Q890 1235 820 1320"/><circle cx="118" cy="78" r="10"/><circle cx="962" cy="1272" r="10"/></g>`,
      frame: "url(#lunarSilverleaf)",
      panelFill: "url(#lunarPanel)",
      panelOpacity: "1",
      label: "LUNAR GARDEN",
      labelColor: "#dfffd0"
    };
  }
  if (style === "eclipse-sovereign") {
    return {
      rootAttribute: ` data-card-style="eclipse-sovereign"`,
      definitions: `<linearGradient id="sovereignCorona" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#5c3fa7"/><stop offset=".25" stop-color="#8a69ff"/><stop offset=".54" stop-color="#f8e7b0"/><stop offset=".78" stop-color="#d9b45e"/><stop offset="1" stop-color="#6d4719"/></linearGradient>
    <linearGradient id="sovereignPanel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8e7b0" stop-opacity=".11"/><stop offset=".42" stop-color="#d9b45e" stop-opacity=".025"/><stop offset="1" stop-color="#8a69ff" stop-opacity=".13"/></linearGradient>
    <pattern id="blackOpalFacet" width="104" height="104" patternUnits="userSpaceOnUse"><path d="M52 0 L104 52 L52 104 L0 52 Z M52 18 L86 52 L52 86 L18 52 Z" fill="none" stroke="#f5d58a" stroke-opacity=".045"/><path d="M0 0 L104 104 M104 0 L0 104" stroke="#8a69ff" stroke-opacity=".03"/></pattern>
    <radialGradient id="eventHorizon"><stop offset=".44" stop-color="#02030a"/><stop offset=".58" stop-color="#171027"/><stop offset=".7" stop-color="#8a69ff" stop-opacity=".32"/><stop offset=".77" stop-color="#f5d58a" stop-opacity=".52"/><stop offset="1" stop-color="#d9b45e" stop-opacity="0"/></radialGradient>
    <filter id="coronaBloom" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="22"/></filter>`,
      backdrop: `<rect width="1080" height="1350" fill="url(#blackOpalFacet)"/>
    <ellipse cx="540" cy="590" rx="455" ry="310" fill="url(#eventHorizon)" opacity=".6"/>
    <ellipse cx="540" cy="590" rx="390" ry="258" fill="none" stroke="url(#sovereignCorona)" stroke-width="58" stroke-opacity=".11" filter="url(#coronaBloom)"/>
    <ellipse cx="540" cy="590" rx="395" ry="262" fill="none" stroke="url(#sovereignCorona)" stroke-width="3" stroke-opacity=".34"/>
    <path d="M-120 825 Q540 530 1200 825" fill="none" stroke="#8a69ff" stroke-width="7" stroke-opacity=".16"/>`,
      foreground: `<g class="material-etch" fill="none" stroke="url(#sovereignCorona)"><path d="M30 285 V108 Q30 30 108 30 H285 M1050 285 V108 Q1050 30 972 30 H795"/><path d="M30 1065 V1242 Q30 1320 108 1320 H285 M1050 1065 V1242 Q1050 1320 972 1320 H795"/><path d="M430 30 L540 78 L650 30 M430 1320 L540 1272 L650 1320"/><circle cx="540" cy="78" r="13"/><circle cx="540" cy="1272" r="13"/></g>`,
      frame: "url(#sovereignCorona)",
      panelFill: "url(#sovereignPanel)",
      panelOpacity: "1",
      label: "ECLIPSE SOVEREIGN",
      labelColor: "#f5d58a"
    };
  }
  if (style === "pixel-frontier") {
    return {
      rootAttribute: ` data-card-style="pixel-frontier"`,
      definitions: `<linearGradient id="pixelFrame" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#3151a8"/><stop offset=".34" stop-color="#49e6ff"/><stop offset=".66" stop-color="#fff27a"/><stop offset="1" stop-color="#ff5fc8"/></linearGradient>
    <linearGradient id="pixelPanel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#49e6ff" stop-opacity=".1"/><stop offset=".5" stop-color="#3151a8" stop-opacity=".025"/><stop offset="1" stop-color="#ff5fc8" stop-opacity=".12"/></linearGradient>
    <pattern id="pixelGrid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M0 0 H32 V32" fill="none" stroke="#49e6ff" stroke-opacity=".055"/><rect x="14" y="14" width="4" height="4" fill="#fff27a" fill-opacity=".11"/></pattern>`,
      backdrop: `<rect width="1080" height="1350" fill="url(#pixelGrid)"/>
    <path d="M0 870 H128 V806 H256 V742 H384 V678 H512 V614 H640" fill="none" stroke="#49e6ff" stroke-width="18" stroke-opacity=".09"/>
    <path d="M1080 430 H952 V494 H824 V558 H696 V622 H568" fill="none" stroke="#ff5fc8" stroke-width="18" stroke-opacity=".08"/>`,
      foreground: `<g class="material-etch" fill="none" stroke="url(#pixelFrame)" shape-rendering="crispEdges"><path d="M30 222 V94 H94 V30 H222 M858 30 H986 V94 H1050 V222"/><path d="M30 1128 V1256 H94 V1320 H222 M858 1320 H986 V1256 H1050 V1128"/><rect x="74" y="74" width="18" height="18"/><rect x="988" y="1258" width="18" height="18"/></g>`,
      frame: "url(#pixelFrame)",
      panelFill: "url(#pixelPanel)",
      panelOpacity: "1",
      label: "PIXEL FRONTIER",
      labelColor: "#fff27a"
    };
  }
  if (style === "bubble-reef") {
    return {
      rootAttribute: ` data-card-style="bubble-reef"`,
      definitions: `<linearGradient id="reefFrame" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#087d9c"/><stop offset=".3" stop-color="#5ff4e6"/><stop offset=".64" stop-color="#ffe071"/><stop offset="1" stop-color="#ff799f"/></linearGradient>
    <linearGradient id="reefPanel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5ff4e6" stop-opacity=".11"/><stop offset=".48" stop-color="#087d9c" stop-opacity=".025"/><stop offset="1" stop-color="#ff799f" stop-opacity=".11"/></linearGradient>
    <pattern id="bubblePattern" width="96" height="96" patternUnits="userSpaceOnUse"><circle cx="22" cy="26" r="9" fill="none" stroke="#bafff8" stroke-opacity=".09"/><circle cx="70" cy="70" r="4" fill="#ffe071" fill-opacity=".1"/></pattern>
    <filter id="reefBloom" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="28"/></filter>`,
      backdrop: `<rect width="1080" height="1350" fill="url(#bubblePattern)"/>
    <circle cx="160" cy="980" r="150" fill="#5ff4e6" fill-opacity=".08" filter="url(#reefBloom)"/>
    <circle cx="930" cy="430" r="170" fill="#ff799f" fill-opacity=".07" filter="url(#reefBloom)"/>
    <path d="M-80 1050 Q120 900 280 1035 T620 1035 T1160 980" fill="none" stroke="#5ff4e6" stroke-width="7" stroke-opacity=".14"/>`,
      foreground: `<g class="material-etch" fill="none" stroke="url(#reefFrame)"><path d="M30 255 Q100 188 105 74 Q188 122 255 30"/><path d="M1050 255 Q980 188 975 74 Q892 122 825 30"/><path d="M30 1095 Q100 1162 105 1276 Q188 1228 255 1320"/><path d="M1050 1095 Q980 1162 975 1276 Q892 1228 825 1320"/><circle cx="105" cy="74" r="13"/><circle cx="975" cy="1276" r="13"/></g>`,
      frame: "url(#reefFrame)",
      panelFill: "url(#reefPanel)",
      panelOpacity: "1",
      label: "BUBBLE REEF",
      labelColor: "#bafff8"
    };
  }
  if (style === "stellar-vanguard") {
    return {
      rootAttribute: ` data-card-style="stellar-vanguard"`,
      definitions: `<linearGradient id="vanguardFrame" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#344563"/><stop offset=".28" stop-color="#87b8db"/><stop offset=".58" stop-color="#f5e4b1"/><stop offset="1" stop-color="#c06748"/></linearGradient>
    <linearGradient id="vanguardPanel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#87b8db" stop-opacity=".1"/><stop offset=".5" stop-color="#344563" stop-opacity=".03"/><stop offset="1" stop-color="#c06748" stop-opacity=".11"/></linearGradient>
    <pattern id="vanguardGrid" width="120" height="120" patternUnits="userSpaceOnUse"><path d="M0 60 H120 M60 0 V120" stroke="#87b8db" stroke-opacity=".04"/><circle cx="60" cy="60" r="34" fill="none" stroke="#f5e4b1" stroke-opacity=".035"/></pattern>
    <radialGradient id="vanguardStar"><stop stop-color="#f5e4b1" stop-opacity=".32"/><stop offset=".22" stop-color="#c06748" stop-opacity=".12"/><stop offset="1" stop-color="#c06748" stop-opacity="0"/></radialGradient>`,
      backdrop: `<rect width="1080" height="1350" fill="url(#vanguardGrid)"/>
    <ellipse cx="850" cy="360" rx="310" ry="230" fill="url(#vanguardStar)"/>
    <path d="M-100 1010 Q430 650 1180 520" fill="none" stroke="#87b8db" stroke-width="5" stroke-opacity=".13"/>
    <path d="M-80 1070 Q460 710 1160 590" fill="none" stroke="#c06748" stroke-width="2" stroke-opacity=".12"/>`,
      foreground: `<g class="material-etch" fill="none" stroke="url(#vanguardFrame)"><path d="M30 270 V112 Q30 30 112 30 H270 M1050 270 V112 Q1050 30 968 30 H810"/><path d="M30 1080 V1238 Q30 1320 112 1320 H270 M1050 1080 V1238 Q1050 1320 968 1320 H810"/><path d="M450 30 L540 66 L630 30 M450 1320 L540 1284 L630 1320"/><circle cx="540" cy="66" r="10"/></g>`,
      frame: "url(#vanguardFrame)",
      panelFill: "url(#vanguardPanel)",
      panelOpacity: "1",
      label: "STELLAR VANGUARD",
      labelColor: "#f5e4b1"
    };
  }
  if (style === "custom") {
    return {
      rootAttribute: ` data-card-style="custom"`,
      definitions: `<pattern id="customWeave" width="84" height="84" patternUnits="userSpaceOnUse"><path d="M0 42 H84 M42 0 V84" stroke="${palette.light}" stroke-opacity=".035"/><path d="M0 0 L84 84 M84 0 L0 84" stroke="${palette.warm}" stroke-opacity=".025"/></pattern>`,
      backdrop: `<rect width="1080" height="1350" fill="url(#customWeave)"/>`,
      foreground: `<g class="material-etch" fill="none" stroke="${palette.light}" stroke-dasharray="5 13"><path d="M30 250 V120 Q30 30 120 30 H250"/><path d="M830 1320 H960 Q1050 1320 1050 1230 V1100"/></g>`,
      frame: "url(#frame)",
      panelFill: "#ffffff",
      panelOpacity: ".045",
      label: "CUSTOM CONSTELLATION",
      labelColor: palette.light
    };
  }
  return {
    rootAttribute: "",
    definitions: "",
    backdrop: "",
    foreground: "",
    frame: "url(#frame)",
    panelFill: "#ffffff",
    panelOpacity: ".045",
    label: "",
    labelColor: palette.light
  };
}

function normalizedCard(rawModel) {
  if (rawModel?.version !== CARD_VERSION || !Array.isArray(rawModel.points)) return buildConstellationCard(rawModel);
  const realm = Object.hasOwn(REALMS, rawModel.realm) ? rawModel.realm : realmFor(rawModel);
  const cardStyle = normalizeConstellationCardStyle(rawModel.cardStyle ?? rawModel.cosmeticCollection);
  const normalized = {
    ...rawModel,
    target: cleanText(rawModel.target, 64) || "Unknown Star",
    emoji: cleanText(rawModel.emoji || "✦", 12),
    clue: cleanText(rawModel.clue, 110) || REALMS[realm].line,
    realm,
    division: ["PURE", "OPEN", "STUDY", "TRAINING"].includes(rawModel.division) ? rawModel.division : "PURE",
    completed: rawModel.completed === true,
    mode: rawModel.mode === "daily" ? "daily" : "challenge",
    dailyKey: safeDayKey(rawModel.dailyKey),
    law: cleanText(rawModel.law, 48),
    universe: {
      name: cleanText(rawModel.universe?.name || "Deep Void", 48),
      id: cleanText(rawModel.universe?.id || "origin", 48)
    },
    milestones: (Array.isArray(rawModel.milestones) ? rawModel.milestones : []).map((word) => cleanText(word, 38)).filter(Boolean).slice(0, 4),
    points: rawModel.points.slice(0, MAX_POINTS).map((point) => ({
      x: clampInteger(point?.x, 40, 1040, 540),
      y: clampInteger(point?.y, 300, 900, 620),
      radius: Math.min(12, Math.max(2, Number(point?.radius) || 5)),
      glow: Math.min(1, Math.max(0, Number(point?.glow) || .5))
    })),
    dust: (Array.isArray(rawModel.dust) ? rawModel.dust : skyDust(stableHash(rawModel.signature))).slice(0, 72).map((point) => ({
      x: clampInteger(point?.x, 0, 1080, 540),
      y: clampInteger(point?.y, 0, 1350, 675),
      radius: Math.min(4, Math.max(.4, Number(point?.radius) || 1)),
      opacity: Math.min(.85, Math.max(.08, Number(point?.opacity) || .3))
    }))
  };
  delete normalized.cosmeticCollection;
  if (cardStyle === DEFAULT_CARD_STYLE) delete normalized.cardStyle;
  else normalized.cardStyle = cardStyle;
  return normalized;
}

export function renderConstellationCardSvg(rawModel) {
  const model = normalizedCard(rawModel);
  const palette = REALMS[model.realm];
  const cardStyle = normalizeConstellationCardStyle(model.cardStyle);
  const material = cardMaterial(cardStyle, palette);
  const paths = model.points.slice(1).map((point, index) => curveBetween(model.points[index], point));
  const connections = paths.map((path) => `<path d="${path}"/>`).join("");
  const points = model.points.map((point, index) => {
    const final = index === model.points.length - 1;
    return `<g class="${final ? "final-point" : ""}"><circle class="halo" cx="${point.x}" cy="${point.y}" r="${Math.round(point.radius * (final ? 7 : 4))}" opacity="${point.glow}"/><circle class="star" cx="${point.x}" cy="${point.y}" r="${final ? point.radius + 5 : point.radius}"/><circle class="orbit" cx="${point.x}" cy="${point.y}" r="${final ? point.radius + 16 : point.radius + 7}"/><text class="star-index" x="${point.x}" y="${point.y + (final ? 43 : 30)}">${final ? "DESTINATION" : String(index + 1).padStart(2, "0")}</text></g>`;
  }).join("");
  const dust = model.dust.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="${point.radius}" fill="${palette.light}" opacity="${point.opacity}"/>`).join("");
  const milestones = model.challengeUrl
    ? `<g><circle cx="83" cy="1076" r="5" fill="${palette.light}"/><text class="milestone" x="100" y="1082">${model.stars}-STAR ROUTE SILHOUETTE · RECIPE WORDS HIDDEN</text></g>`
    : model.milestones.length
    ? model.milestones.map((word, index) => `<g transform="translate(${78 + (index % 2) * 470} ${1060 + Math.floor(index / 2) * 54})"><circle r="5" fill="${palette.light}"/><text class="milestone" x="17" y="6">${xml(word)}</text></g>`).join("")
    : `<text class="milestone muted" x="78" y="1080">A NEW CONSTELLATION IS WAITING TO BE TRACED</text>`;
  const daily = model.mode === "daily";
  const occasion = daily ? "TODAY'S SHARED WORD" : model.completed ? "CONSTELLATION COMPLETE" : "FRIEND CHALLENGE";
  const resultLine = model.completed
    ? `${model.moves} MOVES  ·  ${model.stars} STARS  ·  ${formatTime(model.seconds)}`
    : "THE SAME WORD · YOUR OWN PATH";
  const callToAction = model.challengeUrl ? `CAN YOU TRACE ${model.target.toLocaleUpperCase("en-US")}?` : "A UNIVERSE MADE OF WORDS";
  const dayLabel = daily && model.dailyKey ? formatDay(model.dailyKey) : "";
  const lawLabel = model.law ? ` · ${model.law.toLocaleUpperCase("en-US")}` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-labelledby="title description"${material.rootAttribute}>
  <title id="title">Constellore constellation card for ${xml(model.target)}</title>
  <desc id="description">A ${xml(model.division.toLowerCase())} ${daily ? "daily " : ""}path with ${model.moves} moves and ${model.stars} stars.</desc>
  <defs>
    <radialGradient id="void" cx="74%" cy="18%" r="98%"><stop offset="0" stop-color="${palette.deep}"/><stop offset=".48" stop-color="${palette.dark}"/><stop offset="1" stop-color="#02040b"/></radialGradient>
    <radialGradient id="destination"><stop offset="0" stop-color="${palette.warm}" stop-opacity=".48"/><stop offset=".45" stop-color="${palette.color}" stop-opacity=".16"/><stop offset="1" stop-color="${palette.color}" stop-opacity="0"/></radialGradient>
    <linearGradient id="line" x1="0" y1="1" x2="1" y2="0"><stop stop-color="${palette.color}"/><stop offset=".55" stop-color="${palette.light}"/><stop offset="1" stop-color="${palette.warm}"/></linearGradient>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.light}" stop-opacity=".55"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".08"/><stop offset="1" stop-color="${palette.warm}" stop-opacity=".52"/></linearGradient>
    <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="lineGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
    <clipPath id="cardClip"><rect width="1080" height="1350" rx="48"/></clipPath>
    ${material.definitions}
  </defs>
  <g clip-path="url(#cardClip)">
    <rect width="1080" height="1350" fill="url(#void)"/>
    <circle cx="850" cy="420" r="430" fill="url(#destination)"/>
    ${material.backdrop}
    <g>${dust}</g>
    ${realmMotif(model.realm)}
    <path d="M-120 250 Q340 50 1120 240" fill="none" stroke="${palette.light}" stroke-opacity=".05" stroke-width="90"/>
  </g>
  <rect x="30" y="30" width="1020" height="1290" rx="34" fill="none" stroke="${material.frame}" stroke-width="2"/>
  ${material.foreground}
  <path d="M64 142 H1016" stroke="#ffffff" stroke-opacity=".11"/>
  <text x="66" y="102" class="brand">CONSTELLORE</text>
  <text x="1014" y="102" text-anchor="end" class="universe">${xml(palette.label)} SKY${xml(lawLabel)}</text>
  ${material.label ? `<text x="1014" y="128" text-anchor="end" class="edition">${material.label}</text>` : ""}
  <rect x="66" y="174" width="${daily ? 278 : 318}" height="43" rx="21" fill="${daily ? palette.warm : palette.color}" fill-opacity=".12" stroke="${daily ? palette.warm : palette.light}" stroke-opacity=".48"/>
  <text x="${daily ? 205 : 225}" y="202" text-anchor="middle" class="kicker">${occasion}${dayLabel ? ` · ${xml(dayLabel)}` : ""}</text>
  <text x="66" y="306" class="emoji">${xml(model.emoji)}</text>
  <text x="162" y="286" class="target">${xml(model.target)}</text>
  <text x="164" y="326" class="clue">${xml(model.clue)}</text>
  <g class="connection-glow">${connections}</g><g class="connections">${connections}</g><g>${points}</g>
  <g><rect x="66" y="908" width="948" height="105" rx="21" fill="${material.panelFill}" fill-opacity="${material.panelOpacity}" stroke="${palette.light}" stroke-opacity=".18"/>
    <text class="result-line" x="96" y="950">${xml(resultLine)}</text>
    <text class="stat-label" x="96" y="986">${xml(model.division)} PATH</text>
    <text class="stat-label" x="510" y="986" text-anchor="middle">${model.discoveries} NEW DISCOVERIES</text>
    <text class="stat-label" x="984" y="986" text-anchor="end">${xml(model.universe.name.toLocaleUpperCase("en-US"))}</text></g>
  <g>${milestones}</g>
  <line x1="66" y1="1194" x2="1014" y2="1194" stroke="#ffffff" stroke-opacity=".12"/>
  <text class="cta" x="66" y="1254">${xml(callToAction)}</text>
  <text class="footer" x="66" y="1288">${model.challengeUrl ? "PLAY THE SAME WORD · MAKE A DIFFERENT CONSTELLATION" : "A UNIVERSE MADE OF WORDS"}</text>
  <text class="footer" x="1014" y="1288" text-anchor="end">ORBIT ${xml(model.signature)}</text>
  <style>
    text{font-family:Manrope,Arial,sans-serif;fill:#f8f6ef}.brand,.universe,.kicker,.stat-label,.footer,.star-index,.milestone,.edition{font-family:"DM Mono",Consolas,monospace;letter-spacing:1.7px}.brand{font-size:28px;font-weight:750}.universe{font-size:16px;fill:#d6d5dc}.edition{font-size:10px;letter-spacing:2.4px;fill:${material.labelColor}}.emoji{font-size:70px}.kicker{font-size:15px;font-weight:700;fill:${daily ? palette.warm : palette.light}}.target{font-size:57px;font-weight:720;letter-spacing:-1px}.clue{font-size:20px;fill:#c9c8d0}.motif{stroke:${palette.light};stroke-opacity:.07;stroke-width:3}.material-etch{stroke-width:2;stroke-opacity:.42}.connections,.connection-glow{fill:none;stroke:url(#line);stroke-linecap:round}.connections{stroke-width:3.5;stroke-opacity:.82}.connection-glow{stroke-width:14;stroke-opacity:.16;filter:url(#lineGlow)}.halo{fill:${palette.color};filter:url(#softGlow)}.star{fill:#fffdf2;stroke:${palette.light};stroke-width:3}.orbit{fill:none;stroke:${palette.light};stroke-width:1.5;stroke-opacity:.35}.final-point .star{fill:${palette.warm};stroke:#fff6ce}.final-point .orbit{stroke:${palette.warm};stroke-opacity:.7}.star-index{font-size:11px;fill:#aaaab7}.final-point .star-index{font-size:12px;fill:${palette.warm};font-weight:700}.result-line{font-size:23px;font-weight:720}.stat-label{font-size:13px;fill:#aeadba}.milestone{font-size:18px;fill:#dddbe4}.muted{fill:#aeadba}.cta{font-size:27px;font-weight:760;fill:${palette.warm}}.footer{font-size:13px;fill:#aeadba}
  </style>
</svg>`;
}

export function constellationCardFilename(model) {
  const target = cleanText(model?.target || "constellation", 50).toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "constellation";
  const daily = model?.mode === "daily" ? "daily-" : "";
  return `constellore-${daily}${target}-${cleanText(model?.signature || "orbit", 16).toLocaleLowerCase("en-US")}.svg`;
}

export function constellationCardShareText(model) {
  const safe = model?.version === CARD_VERSION ? normalizedCard(model) : buildConstellationCard(model);
  if (safe.mode === "daily") {
    return safe.completed
      ? `Today's shared Constellore word was ${safe.target}. I traced it in ${safe.moves} moves · ${safe.division}. Can you find another path?`
      : `Today's shared Constellore word is ${safe.target}. Can you trace it?`;
  }
  return safe.completed
    ? `I traced ${safe.target} in ${safe.moves} moves · ${safe.division} orbit · Constellore. Can you find another path?`
    : `Can you trace ${safe.target}? Play the same Constellore challenge and make your own path.`;
}

export function constellationSharePresentation(model) {
  const safe = model?.version === CARD_VERSION ? normalizedCard(model) : buildConstellationCard(model);
  const study = safe.division === "STUDY";
  const open = safe.division === "OPEN";
  const daily = safe.mode === "daily";
  return {
    title: study
      ? "Keep this study constellation."
      : open
        ? "Keep this Open constellation."
        : daily
          ? safe.completed ? "Pass today's word onward." : "Invite someone to today's word."
          : safe.completed ? "Can they find another path?" : "Invite them into this universe.",
    description: study
      ? "This Study card never links to a competitive challenge."
      : open
        ? "This card clearly marks the route as Open."
        : daily
          ? "Everyone gets the same destination. Your route stays hidden."
          : "Send the same target without revealing your route.",
    actionLabel: daily ? "Share today's challenge" : "Challenge a friend",
    eyebrow: study
      ? "CONSTELLATION CARD · STUDY"
      : open
        ? "CONSTELLATION CARD · OPEN"
        : daily
          ? "CONSTELLATION CARD · TODAY'S WORD"
          : "CONSTELLATION CARD · FRIEND CHALLENGE"
  };
}
