import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { emptyRecipeFeedback, normalizeRecipeFeedback, recipeFeedbackSummary, recordRecipeFeedback } from "./public/recipe-feedback.mjs";

export const MARKET_CATALOG = Object.freeze([
  { id: "moon", word: "Moon", emoji: "🌙", category: "nature", usefulness: 5, basePrice: 180, reason: "Strong links to tides, night, eclipses, and space." },
  { id: "magic", word: "Magic", emoji: "✨", category: "force", usefulness: 5, basePrice: 195, reason: "A versatile force with many legendary outcomes." },
  { id: "time", word: "Time", emoji: "⌛", category: "force", usefulness: 5, basePrice: 205, reason: "Connects natural change, history, and the future." },
  { id: "human", word: "Human", emoji: "🧑", category: "life", usefulness: 5, basePrice: 190, reason: "Bridges life into culture, work, and civilization." },
  { id: "computer", word: "Computer", emoji: "💻", category: "structure", usefulness: 4, basePrice: 155, reason: "Unlocks technology, networks, hardware, and AI." },
  { id: "love", word: "Love", emoji: "❤️", category: "force", usefulness: 4, basePrice: 145, reason: "Creates emotional, social, and poetic concepts." },
  { id: "music", word: "Music", emoji: "🎵", category: "force", usefulness: 4, basePrice: 140, reason: "Links air, rhythm, culture, and performance." },
  { id: "robot", word: "Robot", emoji: "🤖", category: "structure", usefulness: 4, basePrice: 150, reason: "A direct bridge to machines and automation." },
  { id: "sword", word: "Sword", emoji: "⚔️", category: "structure", usefulness: 3, basePrice: 115, reason: "Useful for metal, legends, tools, and conflict." },
  { id: "dream", word: "Dream", emoji: "💭", category: "force", usefulness: 3, basePrice: 110, reason: "Connects sleep, imagination, and ambition." },
  { id: "gravity", word: "Gravity", emoji: "🪐", category: "force", usefulness: 4, basePrice: 160, reason: "Pulls together space, motion, weight, and orbit." },
  { id: "ocean", word: "Ocean", emoji: "🌊", category: "nature", usefulness: 3, basePrice: 105, reason: "A shortcut into weather, life, and geography." },
  { id: "sun", word: "Sun", emoji: "☀️", category: "force", usefulness: 5, basePrice: 185, reason: "Radiates into daylight, seasons, warmth, and space." },
  { id: "space", word: "Space", emoji: "🌌", category: "nature", usefulness: 5, basePrice: 180, reason: "Opens cosmic routes through planets, stars, and exploration." },
  { id: "planet", word: "Planet", emoji: "🪐", category: "nature", usefulness: 4, basePrice: 155, reason: "Connects worlds, atmospheres, oceans, and solar systems." },
  { id: "storm", word: "Storm", emoji: "⛈️", category: "force", usefulness: 4, basePrice: 145, reason: "A powerful weather bridge to wind, rain, and lightning." },
  { id: "metal", word: "Metal", emoji: "🔩", category: "structure", usefulness: 5, basePrice: 175, reason: "Builds tools, machines, alloys, and modern infrastructure." },
  { id: "electricity", word: "Electricity", emoji: "⚡", category: "force", usefulness: 5, basePrice: 190, reason: "Energizes technology, weather, light, and machines." },
  { id: "animal", word: "Animal", emoji: "🐾", category: "life", usefulness: 5, basePrice: 180, reason: "Branches naturally into habitats, species, and mythology." },
  { id: "dragon", word: "Dragon", emoji: "🐉", category: "life", usefulness: 4, basePrice: 155, reason: "A legendary creature with elemental and story-rich links." },
  { id: "flower", word: "Flower", emoji: "🌸", category: "life", usefulness: 3, basePrice: 105, reason: "Connects gardens, seasons, color, and living ecosystems." },
  { id: "cat", word: "Cat", emoji: "🐈", category: "life", usefulness: 4, basePrice: 135, reason: "A familiar animal with wild, domestic, and playful routes." },
  { id: "dog", word: "Dog", emoji: "🐕", category: "life", usefulness: 4, basePrice: 135, reason: "Links companionship, packs, work, and wordplay." },
  { id: "insect", word: "Insect", emoji: "🐞", category: "life", usefulness: 3, basePrice: 100, reason: "Unlocks pollination, swarms, metamorphosis, and tiny life." },
  { id: "book", word: "Book", emoji: "📘", category: "structure", usefulness: 4, basePrice: 145, reason: "Leads into knowledge, stories, maps, and libraries." },
  { id: "art", word: "Art", emoji: "🎨", category: "structure", usefulness: 4, basePrice: 140, reason: "Combines materials and ideas into creative forms." },
  { id: "science", word: "Science", emoji: "🔬", category: "structure", usefulness: 5, basePrice: 185, reason: "A broad path into nature, research, and discovery." },
  { id: "technology", word: "Technology", emoji: "🖥️", category: "structure", usefulness: 5, basePrice: 200, reason: "Connects invention, transport, power, and communication." },
  { id: "money", word: "Money", emoji: "🪙", category: "structure", usefulness: 4, basePrice: 150, reason: "Creates economic, social, and playful combinations." },
  { id: "food", word: "Food", emoji: "🍲", category: "structure", usefulness: 5, basePrice: 170, reason: "A flexible route through nature, cooking, and culture." },
  { id: "vehicle", word: "Vehicle", emoji: "🚗", category: "structure", usefulness: 4, basePrice: 145, reason: "Adapts naturally to land, sea, air, and engines." },
  { id: "ship", word: "Ship", emoji: "🚢", category: "structure", usefulness: 3, basePrice: 120, reason: "Travels through water, air, trade, and exploration." },
  { id: "castle", word: "Castle", emoji: "🏰", category: "structure", usefulness: 3, basePrice: 115, reason: "Builds toward defenses, kingdoms, ruins, and legends." },
  { id: "phone", word: "Phone", emoji: "📱", category: "structure", usefulness: 4, basePrice: 150, reason: "Connects signals, networks, communication, and devices." },
  { id: "night", word: "Night", emoji: "🌙", category: "nature", usefulness: 4, basePrice: 140, reason: "Links darkness, stars, dreams, and nocturnal life." },
  { id: "river", word: "River", emoji: "🏞️", category: "nature", usefulness: 4, basePrice: 130, reason: "Flows into terrain, weather, travel, and ecosystems." }
]);

// Every real-money item is deliberately creative rather than competitive.
// Verified provider adapters may fulfill these products, but none can enter the
// Pure division or alter a ranked score.
export const CREATIVE_COMMERCE_CATALOG = Object.freeze([
  Object.freeze({ id: "constellore_founders_pass", kind: "creative_pass", competitive: false, useDivision: "open" })
]);

const commerceProductById = new Map(CREATIVE_COMMERCE_CATALOG.map((product) => [product.id, product]));
const COMMERCE_PROVIDERS = new Set(["apple", "google", "xsolla", "steam", "epic", "web", "test"]);
const CLOUD_PROFILE_FIELDS = new Set(["cosmetics", "discovered", "feedbackPreferences", "firstOrbit", "masteryCelebrated", "progression", "recipeMastery", "rivalGhostEnabled", "theme", "weekly"]);
const CLOUD_THEMES = new Set(["void", "aurora", "solar", "dark", "light", "system"]);
const CLOUD_COSMETICS = new Map([
  ["void", { kind: "theme", founder: false }], ["aurora", { kind: "theme", founder: true }], ["solar", { kind: "theme", founder: true }],
  ["starlit", { kind: "board", founder: false }], ["nebula", { kind: "board", founder: true }], ["blueprint", { kind: "board", founder: true }],
  ["classic", { kind: "trail", founder: false }], ["comet", { kind: "trail", founder: true }], ["prism", { kind: "trail", founder: true }],
  ["cosmic", { kind: "sound", founder: false }], ["glass", { kind: "sound", founder: true }], ["analog", { kind: "sound", founder: true }]
]);
const RECOVERY_CODE_PATTERN = /^CF(?:-[0-9A-F]{4}){8}$/;
const SAFE_BACKUP_PATTERN = /^constellore-safe-\d{8}T\d{9}Z\.json$/;
const COMPLETED_RANKED_RUN_RETENTION_MS = 8 * 86400000;

const catalogById = new Map(MARKET_CATALOG.map((item) => [item.id, item]));
const adjectives = ["Amber", "Astral", "Bright", "Cinder", "Cosmic", "Distant", "Echo", "Frost", "Golden", "Hidden", "Ivory", "Lunar", "Neon", "Quiet", "Solar", "Velvet"];
const nouns = ["Comet", "Drifter", "Ember", "Harbor", "Meteor", "Moon", "Nova", "Orbit", "Pioneer", "Raven", "Signal", "Sparrow", "Star", "Voyager", "Willow", "Wisp"];
const INTEREST_CAMPAIGN = "web-release";
const INTEREST_SOURCES = new Set(["github-pages", "website", "local-practice", "game", "direct"]);
const INTEREST_ACTIONS = new Set(["add", "remove"]);
const anonymousInterestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANALYTICS_RETENTION_DAYS = 90;
export const ANALYTICS_EVENT_NAMES = Object.freeze([
  "app_opened", "run_started", "run_restored", "combination_completed", "combination_rejected", "target_reached",
  "run_failed", "wish_opened", "wish_used", "paywall_viewed", "checkout_started", "share_created",
  "challenge_opened", "theme_changed", "pwa_installed", "leaderboard_opened", "score_uploaded",
  "market_opened", "market_searched", "word_purchased", "market_word_used", "credit_pack_opened", "answer_revealed",
  "board_tidied", "sense_opened", "sense_used", "sense_earned", "sense_purchase_started", "sense_purchased",
  "ghost_loaded", "ghost_race_started", "ghost_race_completed", "mastery_opened", "mastery_progressed",
  "mastery_completed", "audio_toggled", "haptic_toggled", "fusion_feedback_played", "cosmetic_changed",
  "recipe_feedback_submitted", "card_shared", "card_downloaded", "cloud_sync", "ownership_restored",
  "recovery_rotated", "account_recovered", "mission_briefing_viewed", "mission_briefing_dismissed"
]);
const analyticsEventNames = new Set(ANALYTICS_EVENT_NAMES);
const analyticsEnumDimensions = new Map([
  ["mode", new Set(["reach", "quick", "moves", "daily", "weekly", "challenge"])],
  ["division", new Set(["pure", "open"])],
  ["source", new Set(["world", "ai", "twist", "reveal", "market", "wish", "earned", "credits", "reward", "free", "daily", "founder", "mastery", "benchmark", "verified"])],
  ["location", new Set(["home", "run", "result", "market", "mastery"])],
  ["provider", new Set(["native", "web", "sandbox", "rewarded"])],
  ["scope", new Set(["daily", "weekly", "sprint", "all"])],
  ["theme", new Set(["void", "aurora", "solar", "dark", "light", "system"])],
  ["entitlement", new Set(["pass", "reward", "free", "credits", "earned"])],
  ["reason", new Set(["abandoned", "moves", "time", "reveal", "completed", "unavailable"])],
  ["assist", new Set(["none", "ai", "market", "wish", "reveal", "sense"])],
  ["result", new Set(["won", "lost", "tied", "completed", "dismissed", "accepted", "cancelled"])],
  ["kind", new Set(["fusion", "rejection", "discovery", "twist", "target", "ui", "music", "haptic", "theme", "board", "trail", "sound", "logical", "surprising", "bad"])],
  ["outcome", new Set(["accepted", "cancelled", "completed", "dismissed", "earned", "purchased"])],
  ["enabled", new Set(["true", "false"])],
  ["installed", new Set(["true", "false"])],
  ["completed", new Set(["true", "false"])],
  ["assisted", new Set(["true", "false"])],
  ["revealed", new Set(["true", "false"])],
  ["newDiscovery", new Set(["true", "false"])],
  ["twisted", new Set(["true", "false"])]
]);
const analyticsSlugDimensions = new Set(["pack", "collection"]);
const analyticsMetricNames = new Set(["credits", "cost", "reward", "score", "rank", "moves", "seconds", "steps", "words", "length", "stage", "progress", "stars", "deltaMs", "chargesBefore", "chargesAfter"]);

function emptyInterestData() {
  return { version: 1, records: {}, totals: {}, updatedAt: null };
}

function emptyAnalyticsData() {
  return { version: 1, totals: { events: {} }, days: {}, updatedAt: null };
}

function nonnegativeCounter(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function normalizeAnalyticsCounters(value, allowedKeys = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !allowedKeys || allowedKeys.has(key))
    .map(([key, count]) => [String(key).slice(0, 64), nonnegativeCounter(count)])
    .filter(([, count]) => count > 0));
}

function normalizeAnalyticsSegments(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const segments = {};
  for (const [eventName, dimensions] of Object.entries(value)) {
    if (!analyticsEventNames.has(eventName) || !dimensions || typeof dimensions !== "object" || Array.isArray(dimensions)) continue;
    for (const [dimension, values] of Object.entries(dimensions)) {
      if (!analyticsEnumDimensions.has(dimension) && !analyticsSlugDimensions.has(dimension)) continue;
      const counters = Object.fromEntries(Object.entries(normalizeAnalyticsCounters(values))
        .filter(([value]) => analyticsDimensionValue(dimension, value) === value));
      if (Object.keys(counters).length) ((segments[eventName] ||= {})[dimension] ||= Object.assign({}, counters));
    }
  }
  return segments;
}

function normalizeAnalyticsMetrics(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const metrics = {};
  for (const [eventName, eventMetrics] of Object.entries(value)) {
    if (!analyticsEventNames.has(eventName) || !eventMetrics || typeof eventMetrics !== "object" || Array.isArray(eventMetrics)) continue;
    for (const [metric, aggregate] of Object.entries(eventMetrics)) {
      if (!analyticsMetricNames.has(metric) || !aggregate || typeof aggregate !== "object" || Array.isArray(aggregate)) continue;
      const count = nonnegativeCounter(aggregate.count);
      const sum = Number(aggregate.sum);
      const minimum = Number(aggregate.min);
      const maximum = Number(aggregate.max);
      if (!count || !Number.isFinite(sum) || !Number.isFinite(minimum) || !Number.isFinite(maximum)) continue;
      ((metrics[eventName] ||= {})[metric] ||= { count, sum, min: minimum, max: maximum });
    }
  }
  return metrics;
}

function normalizeAnalyticsData(value) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const days = {};
  if (data.days && typeof data.days === "object" && !Array.isArray(data.days)) {
    for (const [day, entry] of Object.entries(data.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      days[day] = {
        events: normalizeAnalyticsCounters(entry.events, analyticsEventNames),
        sessionHashes: entry.sessionHashes && typeof entry.sessionHashes === "object" && !Array.isArray(entry.sessionHashes)
          ? Object.fromEntries(Object.keys(entry.sessionHashes).filter((digest) => /^[A-Za-z0-9_-]{32,64}$/.test(digest)).map((digest) => [digest, true]))
          : {},
        segments: normalizeAnalyticsSegments(entry.segments),
        metrics: normalizeAnalyticsMetrics(entry.metrics)
      };
    }
  }
  return {
    version: 1,
    totals: { events: normalizeAnalyticsCounters(data.totals?.events, analyticsEventNames) },
    days,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null
  };
}

function analyticsDimensionValue(name, value) {
  if (analyticsEnumDimensions.has(name)) {
    const normalized = typeof value === "boolean" ? String(value) : String(value || "").trim().toLowerCase();
    return analyticsEnumDimensions.get(name).has(normalized) ? normalized : null;
  }
  if (analyticsSlugDimensions.has(name)) {
    const normalized = String(value || "").trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{0,31}$/.test(normalized) ? normalized : null;
  }
  return null;
}

function mergeAnalyticsSegments(target, source) {
  for (const [eventName, dimensions] of Object.entries(source || {})) {
    for (const [dimension, values] of Object.entries(dimensions || {})) {
      for (const [value, count] of Object.entries(values || {})) {
        const counters = (((target[eventName] ||= {})[dimension] ||= {}));
        counters[value] = (counters[value] || 0) + nonnegativeCounter(count);
      }
    }
  }
}

function mergeAnalyticsMetrics(target, source) {
  for (const [eventName, eventMetrics] of Object.entries(source || {})) {
    for (const [metric, aggregate] of Object.entries(eventMetrics || {})) {
      const current = ((target[eventName] ||= {})[metric] ||= { count: 0, sum: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY });
      current.count += nonnegativeCounter(aggregate.count);
      current.sum += Number(aggregate.sum) || 0;
      current.min = Math.min(current.min, Number(aggregate.min));
      current.max = Math.max(current.max, Number(aggregate.max));
    }
  }
}

function normalizeInterestData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyInterestData();
  return {
    version: 1,
    records: value.records && typeof value.records === "object" && !Array.isArray(value.records) ? value.records : {},
    totals: value.totals && typeof value.totals === "object" && !Array.isArray(value.totals) ? value.totals : {},
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null
  };
}

function emptyInterestTotals() {
  return { active: 0, total: 0, additions: 0, removals: 0, reactivations: 0, sources: {} };
}

function normalizeInterestTotals(value) {
  const totals = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sources = totals.sources && typeof totals.sources === "object" && !Array.isArray(totals.sources) ? totals.sources : {};
  return {
    active: Math.max(0, Number(totals.active) || 0),
    total: Math.max(0, Number(totals.total) || 0),
    additions: Math.max(0, Number(totals.additions) || 0),
    removals: Math.max(0, Number(totals.removals) || 0),
    reactivations: Math.max(0, Number(totals.reactivations) || 0),
    sources: Object.fromEntries(Object.entries(sources)
      .filter(([source]) => INTEREST_SOURCES.has(source))
      .map(([source, count]) => [source, Math.max(0, Number(count) || 0)]))
  };
}

function hashNumber(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundToFive(value) {
  return Math.max(5, Math.round(value / 5) * 5);
}

export function callsignFor(playerId) {
  const hash = hashNumber(playerId);
  const compactId = String(playerId).replace(/[^a-z0-9]/gi, "");
  const discriminator = (compactId || hash.toString(36)).slice(-8).toUpperCase().padStart(8, "0");
  return `${adjectives[hash % adjectives.length]} ${nouns[(hash >>> 8) % nouns.length]} ${discriminator}`;
}

export function marketPrice(wordOrId, minute = Math.floor(Date.now() / 60_000), demand = 0) {
  const item = typeof wordOrId === "string" ? catalogById.get(wordOrId) : wordOrId;
  if (!item) return null;
  const phaseA = hashNumber(`${item.id}:a`) % 1000;
  const phaseB = hashNumber(`${item.id}:b`) % 1000;
  const wave = Math.sin((minute + phaseA) / 11) * .09 + Math.sin((minute + phaseB) / 5) * .035;
  const demandLift = clamp(Number(demand) || 0, 0, 1) * .06;
  const roundedPrice = roundToFive(item.basePrice * clamp(1 + wave + demandLift, .8, 1.2));
  const minimumPrice = Math.ceil(item.basePrice * .8 / 5) * 5;
  const maximumPrice = Math.floor(item.basePrice * 1.2 / 5) * 5;
  return clamp(roundedPrice, minimumPrice, maximumPrice);
}

export function marketTrend(item, minute, demand, length = 12) {
  return Array.from({ length }, (_, index) => marketPrice(item, minute - (length - index - 1), demand));
}

export function calculateStarscore({ game, moves, elapsedSeconds, assisted = false }) {
  const tier = clamp(Number(game?.tier) || 1, 1, 5);
  const parMoves = 3 + tier * 3;
  const base = 100_000 + tier * 5_000;
  const movePenalty = Math.max(0, Number(moves) - parMoves) * 5_000;
  const timePenalty = Math.max(0, Number(elapsedSeconds)) * 25;
  const assistPenalty = assisted ? 7_500 : 0;
  return Math.max(1, Math.round(base - movePenalty - timePenalty - assistPenalty));
}

export function compareEntries(left, right) {
  if (right.score !== left.score) return right.score - left.score;
  if (left.moves !== right.moves) return left.moves - right.moves;
  return left.elapsedMs - right.elapsedMs;
}

function betterEntry(next, current) {
  return !current || compareEntries(next, current) < 0;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertAllowedKeys(value, allowed, code = "invalid_cloud_profile") {
  if (!isRecord(value) || Object.keys(value).some((key) => !allowed.has(key))) {
    throw serviceError(400, "That cloud profile contains unsupported fields.", code);
  }
}

function cleanCloudText(value, maximum = 80) {
  const text = String(value ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text && text.length <= maximum ? text : null;
}

function sanitizeCloudProfile(raw, { founder = false } = {}) {
  assertAllowedKeys(raw, CLOUD_PROFILE_FIELDS);
  const profile = {};

  if ("theme" in raw) {
    if (!CLOUD_THEMES.has(raw.theme)) throw serviceError(400, "That cloud theme is not available.", "invalid_cloud_profile");
    if (["aurora", "solar"].includes(raw.theme) && !founder) throw serviceError(403, "That theme requires the Founder's Pass.", "cosmetic_entitlement_required");
    profile.theme = raw.theme;
  }
  if ("cosmetics" in raw) {
    assertAllowedKeys(raw.cosmetics, new Set(["board", "sound", "theme", "trail"]));
    const cosmetics = {};
    for (const [slot, value] of Object.entries(raw.cosmetics)) {
      const itemId = String(value || "").trim().toLowerCase();
      const item = CLOUD_COSMETICS.get(itemId);
      if (!item || item.kind !== slot || (item.founder && !founder)) throw serviceError(403, "That cosmetic is not owned by this account.", "cosmetic_entitlement_required");
      cosmetics[slot] = itemId;
    }
    profile.cosmetics = cosmetics;
  }
  if ("firstOrbit" in raw) {
    assertAllowedKeys(raw.firstOrbit, new Set(["completed", "seen"]));
    if (typeof raw.firstOrbit.seen !== "boolean" || typeof raw.firstOrbit.completed !== "boolean" || (raw.firstOrbit.completed && !raw.firstOrbit.seen)) {
      throw serviceError(400, "First Orbit progress is not valid.", "invalid_cloud_profile");
    }
    profile.firstOrbit = { seen: raw.firstOrbit.seen, completed: raw.firstOrbit.completed };
  }
  if ("rivalGhostEnabled" in raw) {
    if (typeof raw.rivalGhostEnabled !== "boolean") throw serviceError(400, "Rival Ghost preference must be true or false.", "invalid_cloud_profile");
    profile.rivalGhostEnabled = raw.rivalGhostEnabled;
  }
  if ("feedbackPreferences" in raw) {
    const allowed = new Set(["haptics", "muted", "sound", "volume"]);
    assertAllowedKeys(raw.feedbackPreferences, allowed);
    const preferences = raw.feedbackPreferences;
    for (const field of ["sound", "haptics", "muted"]) {
      if (field in preferences && typeof preferences[field] !== "boolean") throw serviceError(400, "Feedback preferences must use true or false.", "invalid_cloud_profile");
    }
    if ("volume" in preferences && (!Number.isFinite(preferences.volume) || preferences.volume < 0 || preferences.volume > 1)) {
      throw serviceError(400, "Feedback volume must be between zero and one.", "invalid_cloud_profile");
    }
    profile.feedbackPreferences = structuredClone(preferences);
  }
  if ("discovered" in raw) {
    if (!Array.isArray(raw.discovered) || raw.discovered.length > 1_000) throw serviceError(400, "Cloud discoveries are too large.", "invalid_cloud_profile");
    const unique = new Map();
    for (const value of raw.discovered) {
      const word = cleanCloudText(value);
      if (!word) throw serviceError(400, "Cloud discoveries must be short words.", "invalid_cloud_profile");
      const key = word.toLocaleLowerCase("en-US");
      if (!unique.has(key)) unique.set(key, word);
    }
    profile.discovered = [...unique.values()];
  }
  if ("masteryCelebrated" in raw) {
    if (!Array.isArray(raw.masteryCelebrated) || raw.masteryCelebrated.length > 64) throw serviceError(400, "Cloud mastery celebrations are too large.", "invalid_cloud_profile");
    profile.masteryCelebrated = [...new Set(raw.masteryCelebrated.map((value) => {
      const slug = String(value || "").trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(slug)) throw serviceError(400, "Cloud mastery collections must use safe identifiers.", "invalid_cloud_profile");
      return slug;
    }))];
  }
  if ("progression" in raw) {
    const fields = new Set(["dailyCompleted", "dailyStreak", "lastDailyDate", "stardust", "streakShields", "wins"]);
    assertAllowedKeys(raw.progression, fields);
    const progression = raw.progression;
    const integerBounds = { stardust: 1_000_000_000, wins: 1_000_000, dailyStreak: 100_000, streakShields: 1_000 };
    for (const [field, maximum] of Object.entries(integerBounds)) {
      if (!Number.isInteger(progression[field]) || progression[field] < 0 || progression[field] > maximum) {
        throw serviceError(400, "Cloud progression counters are not valid.", "invalid_cloud_profile");
      }
    }
    const safeDate = (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (typeof progression.lastDailyDate !== "string" || typeof progression.dailyCompleted !== "string" || !safeDate(progression.lastDailyDate) || !safeDate(progression.dailyCompleted)) {
      throw serviceError(400, "Cloud progression dates are not valid.", "invalid_cloud_profile");
    }
    profile.progression = {
      stardust: progression.stardust,
      wins: progression.wins,
      dailyStreak: progression.dailyStreak,
      lastDailyDate: progression.lastDailyDate,
      dailyCompleted: progression.dailyCompleted,
      streakShields: progression.streakShields
    };
  }
  if ("weekly" in raw) {
    assertAllowedKeys(raw.weekly, new Set(["complete", "key", "stage"]));
    const { complete, key, stage } = raw.weekly;
    if (typeof complete !== "boolean" || !Number.isInteger(stage) || stage < 0 || stage > 3 || (key && !/^\d{4}-W\d{2}$/.test(key))) {
      throw serviceError(400, "Cloud weekly progress is not valid.", "invalid_cloud_profile");
    }
    profile.weekly = { key: String(key || ""), stage, complete };
  }
  if ("recipeMastery" in raw) {
    assertAllowedKeys(raw.recipeMastery, new Set(["recipes", "version"]));
    if (raw.recipeMastery.version !== 1 || !Array.isArray(raw.recipeMastery.recipes) || raw.recipeMastery.recipes.length > 1_000) {
      throw serviceError(400, "Cloud recipe mastery is not valid.", "invalid_cloud_profile");
    }
    const recipeFields = new Set(["a", "b", "discoveries", "key", "proofs", "stars", "word"]);
    const recipes = raw.recipeMastery.recipes.map((recipe) => {
      assertAllowedKeys(recipe, recipeFields);
      const a = cleanCloudText(recipe.a);
      const b = cleanCloudText(recipe.b);
      const word = cleanCloudText(recipe.word);
      const key = cleanCloudText(recipe.key, 320);
      if (!a || !b || !word || !key || !Array.isArray(recipe.proofs) || recipe.proofs.length > 3) throw serviceError(400, "A cloud mastery recipe is not valid.", "invalid_cloud_profile");
      const proofs = recipe.proofs.map((proof) => String(proof || "").trim());
      if (proofs.some((proof) => !/^p-[a-z0-9]{7}$/.test(proof)) || new Set(proofs).size !== proofs.length) throw serviceError(400, "Cloud mastery proofs are not valid.", "invalid_cloud_profile");
      if (!Number.isInteger(recipe.stars) || recipe.stars !== proofs.length || !Number.isInteger(recipe.discoveries) || recipe.discoveries !== proofs.length) {
        throw serviceError(400, "Cloud mastery star counts do not match their proofs.", "invalid_cloud_profile");
      }
      return { key, a, b, word, discoveries: proofs.length, stars: proofs.length, proofs };
    });
    profile.recipeMastery = { version: 1, recipes };
  }

  return profile;
}

function recoveryCode() {
  return `CF-${randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g).join("-")}`;
}

function normalizeRecoveryCode(value) {
  const compact = String(value || "").trim().toUpperCase().replace(/[^0-9A-F]/g, "").replace(/^CF/, "");
  if (!/^[0-9A-F]{32}$/.test(compact)) return "";
  return `CF-${compact.match(/.{4}/g).join("-")}`;
}

function safeDigestEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const expected = Buffer.from(left);
  const received = Buffer.from(right);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export class GameStore {
  constructor(path = ":memory:") {
    this.path = path;
    this.data = { version: 6, secret: "", players: {}, scores: [], demand: {}, interest: emptyInterestData(), analytics: emptyAnalyticsData(), recipeFeedback: emptyRecipeFeedback(), runs: {}, commerceTransactions: {} };
    this.writeQueue = Promise.resolve();
  }

  async init() {
    if (this.path !== ":memory:") {
      try {
        const parsed = JSON.parse(await readFile(this.path, "utf8"));
        if (parsed && typeof parsed === "object") this.data = {
          ...this.data,
          ...parsed,
          version: 6,
          players: parsed.players || {},
          scores: parsed.scores || [],
          demand: parsed.demand || {},
          interest: normalizeInterestData(parsed.interest),
          analytics: normalizeAnalyticsData(parsed.analytics),
          recipeFeedback: normalizeRecipeFeedback(parsed.recipeFeedback),
          runs: parsed.runs && typeof parsed.runs === "object" && !Array.isArray(parsed.runs) ? parsed.runs : {},
          commerceTransactions: parsed.commerceTransactions && typeof parsed.commerceTransactions === "object" && !Array.isArray(parsed.commerceTransactions) ? parsed.commerceTransactions : {}
        };
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    if (!this.data.secret) {
      this.data.secret = randomBytes(32).toString("base64url");
      await this.persist();
    }
    let playersMigrated = false;
    for (const player of Object.values(this.data.players)) {
      if (!player.callsign || /^[A-Za-z]+ [A-Za-z]+ \d{2}$/.test(player.callsign)) {
        player.callsign = callsignFor(player.id);
        playersMigrated = true;
      }
      if (!player.forfeitedChallenges || typeof player.forfeitedChallenges !== "object") {
        player.forfeitedChallenges = {};
        playersMigrated = true;
      }
      if (!player.licenses || typeof player.licenses !== "object" || Array.isArray(player.licenses)) {
        player.licenses = {};
        playersMigrated = true;
      }
      const credits = Math.max(0, Math.floor(Number(player.credits) || 0));
      if (player.credits !== credits) {
        player.credits = credits;
        playersMigrated = true;
      }
      if (!player.cloudProfile || typeof player.cloudProfile !== "object" || Array.isArray(player.cloudProfile)) {
        player.cloudProfile = { version: 0, data: {}, updatedAt: null };
        playersMigrated = true;
      }
      if (!player.entitlements || typeof player.entitlements !== "object" || Array.isArray(player.entitlements)) {
        player.entitlements = {};
        playersMigrated = true;
      }
      if (!Number.isInteger(player.authVersion) || player.authVersion < 0) {
        // Version zero preserves bearer compatibility for stores created before
        // recoverable accounts were introduced.
        player.authVersion = 0;
        playersMigrated = true;
      }
      if (player.entitlements.founder_pass && !player.entitlements.constellore_founders_pass) {
        player.entitlements.constellore_founders_pass = { ...player.entitlements.founder_pass, productId: "constellore_founders_pass" };
        delete player.entitlements.founder_pass;
        playersMigrated = true;
      }
      if (player.founderPass && !player.entitlements.constellore_founders_pass) {
        player.entitlements.constellore_founders_pass = { productId: "constellore_founders_pass", kind: "creative_pass", active: true, source: "legacy", grantedAt: player.createdAt || new Date().toISOString() };
        playersMigrated = true;
      }
      if (player.recovery && (!/^[A-Za-z0-9_-]{32,64}$/.test(player.recovery.digest || "") || !Number.isInteger(player.recovery.version))) {
        delete player.recovery;
        playersMigrated = true;
      }
    }
    if (playersMigrated) await this.persist();
    return this;
  }

  sign(value) {
    return createHmac("sha256", this.data.secret).update(String(value)).digest("base64url");
  }

  verify(value, signature) {
    if (typeof signature !== "string") return false;
    const expected = Buffer.from(this.sign(value));
    const received = Buffer.from(signature);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  async registerPlayer({ withRecoveryCode = false } = {}) {
    const id = randomUUID();
    const issuedRecoveryCode = recoveryCode();
    this.data.players[id] = {
      id,
      callsign: callsignFor(id),
      credits: 300,
      licenses: {},
      founderPass: false,
      freeWishUsed: false,
      dailyWishUsedDate: "",
      earned: { date: "", amount: 0 },
      rewardedChallenges: {},
      forfeitedChallenges: {},
      weeklyActivity: { week: "", days: [], bonusClaimed: false },
      cloudProfile: { version: 0, data: {}, updatedAt: null },
      entitlements: {},
      authVersion: 1,
      recovery: {
        digest: this.sign(`recovery:v1:${id}:${issuedRecoveryCode}`),
        version: 1,
        issuedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    };
    await this.persist();
    const player = this.publicPlayer(id);
    return withRecoveryCode ? { player, recoveryCode: issuedRecoveryCode } : player;
  }

  authenticate(playerId, playerToken) {
    const player = this.data.players[playerId];
    if (!player || !this.verify(player.authVersion ? `player:${playerId}:v${player.authVersion}` : `player:${playerId}`, playerToken)) return null;
    return player;
  }

  tokenForPlayer(playerId) {
    const player = this.data.players[playerId];
    return player ? this.sign(player.authVersion ? `player:${playerId}:v${player.authVersion}` : `player:${playerId}`) : "";
  }

  publicPlayer(playerId) {
    const player = this.data.players[playerId];
    if (!player) return null;
    return {
      id: player.id,
      callsign: player.callsign,
      credits: player.credits,
      founderPass: Boolean(player.founderPass),
      freeWishUsed: Boolean(player.freeWishUsed),
      wishAvailable: this.canUseWish(playerId),
      dailyWishUsedDate: player.dailyWishUsedDate || "",
      cloudProfileVersion: Math.max(0, Math.floor(Number(player.cloudProfile?.version) || 0)),
      vault: MARKET_CATALOG.filter((item) => player.licenses[item.id]).map((item) => ({ ...item, owned: true }))
    };
  }

  recoveryDigest(playerId, code) {
    const normalized = normalizeRecoveryCode(code);
    return normalized && RECOVERY_CODE_PATTERN.test(normalized) ? this.sign(`recovery:v1:${playerId}:${normalized}`) : "";
  }

  async recoverPlayer(playerId, code) {
    const id = String(playerId || "").trim();
    const player = this.data.players[id];
    const receivedDigest = this.recoveryDigest(id, code);
    if (!player?.recovery?.digest || !safeDigestEqual(player.recovery.digest, receivedDigest)) {
      throw serviceError(401, "That recovery kit is invalid or has already been used.", "invalid_recovery_code");
    }
    const nextCode = recoveryCode();
    player.recovery = {
      digest: this.sign(`recovery:v1:${id}:${nextCode}`),
      version: Math.max(1, Number(player.recovery.version) || 1) + 1,
      issuedAt: new Date().toISOString(),
      rotatedAt: new Date().toISOString()
    };
    player.authVersion = Math.max(0, Number(player.authVersion) || 0) + 1;
    await this.persist();
    return {
      player: this.publicPlayer(id),
      playerToken: this.tokenForPlayer(id),
      recoveryCode: nextCode,
      recoveryVersion: player.recovery.version
    };
  }

  async rotateRecovery(playerId) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const nextCode = recoveryCode();
    player.recovery = {
      digest: this.sign(`recovery:v1:${playerId}:${nextCode}`),
      version: Math.max(0, Number(player.recovery?.version) || 0) + 1,
      issuedAt: new Date().toISOString(),
      rotatedAt: new Date().toISOString()
    };
    await this.persist();
    return { recoveryCode: nextCode, recoveryVersion: player.recovery.version };
  }

  async revokeRecovery(playerId) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const nextVersion = Math.max(0, Number(player.recovery?.version) || 0) + 1;
    player.recovery = { digest: "", version: nextVersion, revokedAt: new Date().toISOString() };
    await this.persist();
    return { revoked: true, recoveryVersion: nextVersion };
  }

  cloudProfile(playerId) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const stored = player.cloudProfile && typeof player.cloudProfile === "object" ? player.cloudProfile : { version: 0, data: {}, updatedAt: null };
    return { version: Math.max(0, Math.floor(Number(stored.version) || 0)), profile: structuredClone(stored.data || {}), updatedAt: stored.updatedAt || null };
  }

  async updateCloudProfile(playerId, expectedVersion, profile) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw serviceError(400, "A valid cloud profile version is required.", "invalid_profile_version");
    const current = this.cloudProfile(playerId);
    if (expectedVersion !== current.version) {
      throw serviceError(409, "The cloud profile changed on another device.", "cloud_profile_conflict", { current });
    }
    const data = sanitizeCloudProfile(profile, { founder: Boolean(player.founderPass) });
    player.cloudProfile = { version: current.version + 1, data, updatedAt: new Date().toISOString() };
    await this.persist();
    return this.cloudProfile(playerId);
  }

  entitlementSnapshot(playerId) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const products = Object.values(player.entitlements || {})
      .filter((entitlement) => entitlement?.active && commerceProductById.has(entitlement.productId))
      .map((entitlement) => {
        const product = commerceProductById.get(entitlement.productId);
        return { productId: product.id, kind: product.kind, active: true, competitive: false, useDivision: product.useDivision, grantedAt: entitlement.grantedAt || null };
      });
    const vault = MARKET_CATALOG.filter((item) => player.licenses[item.id]).map((item) => ({ id: item.id, word: item.word, owned: true, competitive: false, useDivision: "open" }));
    return {
      version: 1,
      restoredAt: new Date().toISOString(),
      balance: { starCredits: Math.max(0, Math.floor(Number(player.credits) || 0)) },
      products,
      vault,
      policy: { rankedAdvantages: false, creativeAssistsUseDivision: "open" }
    };
  }

  async fulfillVerifiedPurchase(playerId, { productId, provider, transactionId }, date = new Date()) {
    const player = this.data.players[playerId];
    const product = commerceProductById.get(String(productId || ""));
    const safeProvider = String(provider || "").trim().toLowerCase();
    const safeTransactionId = String(transactionId || "").trim();
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    if (!product || product.competitive !== false) throw serviceError(400, "That commerce product is not available.", "invalid_commerce_product");
    if (!COMMERCE_PROVIDERS.has(safeProvider) || safeTransactionId.length < 8 || safeTransactionId.length > 200) throw serviceError(400, "A verified provider transaction is required.", "invalid_commerce_transaction");
    const transactionDigest = this.sign(`commerce:v1:${safeProvider}:${safeTransactionId}`);
    const previous = this.data.commerceTransactions[transactionDigest];
    if (previous) {
      if (previous.playerId !== playerId || previous.productId !== product.id) throw serviceError(409, "That provider transaction was already fulfilled.", "commerce_transaction_conflict");
      return { restored: true, entitlements: this.entitlementSnapshot(playerId) };
    }

    const grantedAt = date.toISOString();
    if (product.id === "constellore_founders_pass") {
      player.founderPass = true;
      player.entitlements.constellore_founders_pass = { productId: product.id, kind: product.kind, active: true, source: safeProvider, grantedAt };
    }
    this.data.commerceTransactions[transactionDigest] = { playerId, productId: product.id, provider: safeProvider, fulfilledAt: grantedAt };
    await this.persist();
    return { restored: false, entitlements: this.entitlementSnapshot(playerId) };
  }

  interestAggregate(campaign = INTEREST_CAMPAIGN) {
    if (campaign !== INTEREST_CAMPAIGN) throw serviceError(400, "That interest campaign is not available.", "invalid_interest_campaign");
    const totals = normalizeInterestTotals(this.data.interest.totals[campaign]);
    return {
      campaign,
      ...totals,
      sources: { ...totals.sources },
      updatedAt: this.data.interest.updatedAt || null
    };
  }

  async recordInterest({ anonymousId, campaign, source, action }, date = new Date()) {
    if (!anonymousInterestIdPattern.test(String(anonymousId || ""))) throw serviceError(400, "A valid anonymous interest ID is required.", "invalid_interest_id");
    if (campaign !== INTEREST_CAMPAIGN) throw serviceError(400, "That interest campaign is not available.", "invalid_interest_campaign");
    if (!INTEREST_SOURCES.has(source)) throw serviceError(400, "That interest source is not available.", "invalid_interest_source");
    if (!INTEREST_ACTIONS.has(action)) throw serviceError(400, "That interest action is not available.", "invalid_interest_action");
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw serviceError(400, "A valid interest date is required.", "invalid_interest_date");

    const day = date.toISOString().slice(0, 10);
    const digest = this.sign(`interest:v1:${campaign}:${anonymousId}`);
    const recordKey = `${campaign}:${digest}`;
    const records = this.data.interest.records;
    const existing = records[recordKey];
    const totals = normalizeInterestTotals(this.data.interest.totals[campaign]);
    this.data.interest.totals[campaign] = totals;
    let changed = false;
    let interested = Boolean(existing?.active);

    if (action === "add" && !existing) {
      records[recordKey] = { campaign, active: true, firstDate: day, lastChangedDate: day, firstSource: source };
      totals.active += 1;
      totals.total += 1;
      totals.additions += 1;
      totals.sources[source] = (totals.sources[source] || 0) + 1;
      changed = true;
      interested = true;
    } else if (action === "add" && !existing.active) {
      existing.active = true;
      existing.lastChangedDate = day;
      totals.active += 1;
      totals.additions += 1;
      totals.reactivations += 1;
      changed = true;
      interested = true;
    } else if (action === "remove" && existing?.active) {
      existing.active = false;
      existing.lastChangedDate = day;
      totals.active = Math.max(0, totals.active - 1);
      totals.removals += 1;
      changed = true;
      interested = false;
    }

    if (changed) {
      this.data.interest.updatedAt = day;
      await this.persist();
    }
    return { campaign, interested, changed };
  }

  async recordAnalyticsEvent({ name, sessionId, properties = {} }, date = new Date()) {
    if (!analyticsEventNames.has(name)) throw serviceError(400, "That analytics event is not available.", "invalid_analytics_event");
    if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 64) throw serviceError(400, "A valid analytics session is required.", "invalid_analytics_session");
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw serviceError(400, "A valid analytics date is required.", "invalid_analytics_date");

    const analytics = this.data.analytics = normalizeAnalyticsData(this.data.analytics);
    const dayKey = date.toISOString().slice(0, 10);
    const day = analytics.days[dayKey] ||= { events: {}, sessionHashes: {}, segments: {}, metrics: {} };
    day.events[name] = (day.events[name] || 0) + 1;
    analytics.totals.events[name] = (analytics.totals.events[name] || 0) + 1;
    day.sessionHashes[this.sign(`analytics:v1:${dayKey}:${sessionId}`)] = true;

    const safeProperties = properties && typeof properties === "object" && !Array.isArray(properties) ? properties : {};
    for (const [property, value] of Object.entries(safeProperties).slice(0, 32)) {
      const dimensionValue = analyticsDimensionValue(property, value);
      if (dimensionValue !== null) {
        const counters = (((day.segments[name] ||= {})[property] ||= {}));
        counters[dimensionValue] = (counters[dimensionValue] || 0) + 1;
      }
      if (analyticsMetricNames.has(property)) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) continue;
        const bounded = clamp(numeric, -1_000_000_000, 1_000_000_000);
        const aggregate = ((day.metrics[name] ||= {})[property] ||= { count: 0, sum: 0, min: bounded, max: bounded });
        aggregate.count += 1;
        aggregate.sum += bounded;
        aggregate.min = Math.min(aggregate.min, bounded);
        aggregate.max = Math.max(aggregate.max, bounded);
      }
    }

    const oldestDay = new Date(date.getTime() - (ANALYTICS_RETENTION_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
    for (const storedDay of Object.keys(analytics.days)) if (storedDay < oldestDay || storedDay > dayKey) delete analytics.days[storedDay];
    analytics.updatedAt = date.toISOString();
    await this.persist();
    return { accepted: true, day: dayKey };
  }

  analyticsSummary(requestedDays = 30, date = new Date()) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw serviceError(400, "A valid analytics date is required.", "invalid_analytics_date");
    const days = clamp(Math.floor(Number(requestedDays) || 30), 1, ANALYTICS_RETENTION_DAYS);
    const through = date.toISOString().slice(0, 10);
    const from = new Date(date.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
    const analytics = normalizeAnalyticsData(this.data.analytics);
    const events = {};
    const segments = {};
    const metrics = {};
    const daily = [];
    let dailyUniqueSessions = 0;

    for (const [dayKey, day] of Object.entries(analytics.days).sort(([left], [right]) => left.localeCompare(right))) {
      if (dayKey < from || dayKey > through) continue;
      const sessions = Object.keys(day.sessionHashes).length;
      const eventCount = Object.values(day.events).reduce((sum, count) => sum + count, 0);
      dailyUniqueSessions += sessions;
      daily.push({ date: dayKey, sessions, events: eventCount });
      for (const [name, count] of Object.entries(day.events)) events[name] = (events[name] || 0) + count;
      mergeAnalyticsSegments(segments, day.segments);
      mergeAnalyticsMetrics(metrics, day.metrics);
    }

    for (const eventMetrics of Object.values(metrics)) {
      for (const aggregate of Object.values(eventMetrics)) aggregate.average = aggregate.count ? Number((aggregate.sum / aggregate.count).toFixed(2)) : 0;
    }
    const eventCount = (name) => events[name] || 0;
    const conversionPercent = (completed, opened) => opened ? Number(((completed / opened) * 100).toFixed(1)) : 0;
    const metricSum = (eventName, ...names) => names.reduce((sum, name) => sum + (metrics[eventName]?.[name]?.sum || 0), 0);
    const funnels = {
      play: { opened: eventCount("app_opened"), started: eventCount("run_started"), completed: eventCount("target_reached") },
      wish: { opened: eventCount("wish_opened"), used: eventCount("wish_used"), conversionPercent: conversionPercent(eventCount("wish_used"), eventCount("wish_opened")) },
      market: { opened: eventCount("market_opened"), purchased: eventCount("word_purchased"), conversionPercent: conversionPercent(eventCount("word_purchased"), eventCount("market_opened")) },
      sense: { opened: eventCount("sense_opened"), used: eventCount("sense_used"), purchased: eventCount("sense_purchased"), useRatePercent: conversionPercent(eventCount("sense_used"), eventCount("sense_opened")) },
      ghost: { started: eventCount("ghost_race_started"), completed: eventCount("ghost_race_completed"), completionPercent: conversionPercent(eventCount("ghost_race_completed"), eventCount("ghost_race_started")) },
      mastery: { opened: eventCount("mastery_opened"), progressed: eventCount("mastery_progressed"), completed: eventCount("mastery_completed") }
    };
    funnels.play.startRatePercent = conversionPercent(funnels.play.started, funnels.play.opened);
    funnels.play.completionPercent = conversionPercent(funnels.play.completed, funnels.play.started);
    const economy = {
      checkoutStarts: eventCount("checkout_started"),
      wordPurchases: eventCount("word_purchased"),
      wordCreditsSpent: metricSum("word_purchased", "credits", "cost"),
      sensePurchases: eventCount("sense_purchased"),
      senseStardustSpent: metricSum("sense_purchased", "cost")
    };

    return {
      privacy: "aggregate-only",
      period: { days, from, through },
      dailyUniqueSessions,
      events,
      segments,
      metrics,
      funnels,
      economy,
      daily,
      allTimeEvents: { ...analytics.totals.events },
      updatedAt: analytics.updatedAt
    };
  }

  async recordRecipeRating(step, rating, date = new Date()) {
    const recorded = recordRecipeFeedback(this.data.recipeFeedback, { step, rating, date });
    if (!recorded.accepted) {
      if (recorded.reason === "capacity") throw serviceError(503, "Recipe feedback is temporarily full.", "recipe_feedback_capacity");
      throw serviceError(400, "That recipe rating is not valid.", "invalid_recipe_feedback");
    }
    this.data.recipeFeedback = recorded.state;
    await this.persist();
    return { accepted: true, fingerprint: recorded.fingerprint };
  }

  recipeRatingSummary({ minimumVotes = 3, limit = 50 } = {}) {
    const feedback = normalizeRecipeFeedback(this.data.recipeFeedback);
    return {
      privacy: "aggregate-only",
      totalVotes: feedback.totalVotes,
      recipes: recipeFeedbackSummary(feedback, { minimumVotes, limit }),
      updatedAt: feedback.updatedAt
    };
  }

  demandForMinute(wordId, minute) {
    const demand = this.data.demand[wordId] || { ema: 0, purchases: 0, activeMinute: minute, purchasesThisMinute: 0 };
    demand.ema = clamp(Number(demand.ema) || 0, 0, 1);
    demand.purchases = Math.max(0, Number(demand.purchases) || 0);
    if (!Number.isInteger(demand.activeMinute)) demand.activeMinute = minute;
    demand.purchasesThisMinute = Math.max(0, Number(demand.purchasesThisMinute) || 0);

    if (minute > demand.activeMinute) {
      const completedMinutePurchases = Math.min(20, Math.floor(demand.purchasesThisMinute));
      for (let index = 0; index < completedMinutePurchases; index += 1) demand.ema = demand.ema * .82 + .18;
      const idleMinutes = Math.max(0, minute - demand.activeMinute - 1);
      if (idleMinutes) demand.ema *= .82 ** idleMinutes;
      demand.ema = clamp(demand.ema, 0, 1);
      demand.activeMinute = minute;
      demand.purchasesThisMinute = 0;
    }

    this.data.demand[wordId] = demand;
    return demand;
  }

  marketSnapshot(playerId, now = Date.now()) {
    const player = this.data.players[playerId];
    const minute = Math.floor(now / 60_000);
    const nextRepriceAt = (minute + 1) * 60_000;
    const items = MARKET_CATALOG.map((item) => {
      const demand = this.demandForMinute(item.id, minute).ema;
      const trend = marketTrend(item, minute, demand);
      const price = trend.at(-1);
      const previous = trend.at(-2) || price;
      const quotePayload = `${item.id}:${minute}:${price}`;
      return {
        ...item,
        price,
        owned: Boolean(player?.licenses[item.id]),
        competitive: false,
        useDivision: "open",
        changePercent: previous ? Number((((price - previous) / previous) * 100).toFixed(1)) : 0,
        trend,
        quoteId: `${quotePayload}.${this.sign(`quote:${quotePayload}`)}`,
        quoteExpiresAt: new Date(nextRepriceAt).toISOString()
      };
    });
    return { serverTime: new Date(now).toISOString(), nextRepriceAt: new Date(nextRepriceAt).toISOString(), balance: player?.credits || 0, items };
  }

  verifyQuote(quoteId, now = Date.now()) {
    if (typeof quoteId !== "string") return null;
    const split = quoteId.lastIndexOf(".");
    if (split < 1) return null;
    const payload = quoteId.slice(0, split);
    const signature = quoteId.slice(split + 1);
    if (!this.verify(`quote:${payload}`, signature)) return null;
    const [wordId, minuteText, priceText] = payload.split(":");
    const minute = Number(minuteText);
    const price = Number(priceText);
    if (!catalogById.has(wordId) || !Number.isInteger(minute) || !Number.isFinite(price) || minute !== Math.floor(now / 60_000)) return null;
    const demand = this.demandForMinute(wordId, minute).ema;
    if (marketPrice(wordId, minute, demand) !== price) return null;
    return { item: catalogById.get(wordId), minute, price };
  }

  async buyLicense(playerId, quoteId, idempotencyKey) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    if (!/^[\w-]{8,80}$/.test(String(idempotencyKey || ""))) throw serviceError(400, "A valid purchase key is required.", "invalid_idempotency_key");
    player.purchaseKeys ||= {};
    if (player.purchaseKeys[idempotencyKey]) {
      const previous = player.purchaseKeys[idempotencyKey];
      if (previous.quoteId && previous.quoteId !== quoteId) throw serviceError(409, "That purchase key was already used for another quote.", "idempotency_conflict");
      return previous.result || previous;
    }
    const quote = this.verifyQuote(quoteId);
    if (!quote) throw serviceError(409, "That quote expired. The current price is now shown.", "quote_expired");
    if (player.licenses[quote.item.id]) throw serviceError(409, "You already own this word.", "already_owned");
    if (player.credits < quote.price) throw serviceError(402, "Not enough Star Credits.", "insufficient_credits");
    player.credits -= quote.price;
    player.licenses[quote.item.id] = { purchasedAt: new Date().toISOString(), price: quote.price };
    const demand = this.demandForMinute(quote.item.id, quote.minute);
    demand.purchasesThisMinute += 1;
    demand.purchases += 1;
    const result = { item: { ...quote.item, owned: true, competitive: false, useDivision: "open" }, balance: player.credits, price: quote.price, competitive: false, useDivision: "open" };
    player.purchaseKeys[idempotencyKey] = { quoteId, result };
    await this.persist();
    return result;
  }

  ownsLicense(playerId, wordId) {
    return Boolean(this.data.players[playerId]?.licenses?.[wordId]);
  }

  async setFounderPass(playerId, enabled = true) {
    const player = this.data.players[playerId];
    if (!player) return null;
    player.founderPass = Boolean(enabled);
    player.entitlements ||= {};
    if (enabled) {
      player.entitlements.constellore_founders_pass ||= { productId: "constellore_founders_pass", kind: "creative_pass", active: true, source: "test", grantedAt: new Date().toISOString() };
      player.entitlements.constellore_founders_pass.active = true;
    } else if (player.entitlements.constellore_founders_pass) {
      player.entitlements.constellore_founders_pass.active = false;
      player.entitlements.constellore_founders_pass.revokedAt = new Date().toISOString();
    }
    await this.persist();
    return this.publicPlayer(playerId);
  }

  canUseWish(playerId, date = new Date()) {
    const player = this.data.players[playerId];
    if (!player) return false;
    const day = date.toISOString().slice(0, 10);
    return Boolean(!player.freeWishUsed || (player.founderPass && player.dailyWishUsedDate !== day));
  }

  async consumeWish(playerId, date = new Date()) {
    const player = this.data.players[playerId];
    if (!player) return;
    player.freeWishUsed = true;
    player.dailyWishUsedDate = date.toISOString().slice(0, 10);
    await this.persist();
  }

  hasScore(playerId, challengeId) {
    return this.data.scores.some((entry) => entry.playerId === playerId && entry.challengeId === challengeId);
  }

  forfeitedChallenge(playerId, challengeId) {
    const player = this.data.players[playerId];
    const key = String(challengeId || "").trim();
    return player && key ? player.forfeitedChallenges?.[key] || null : null;
  }

  hasForfeitedChallenge(playerId, challengeId) {
    return Boolean(this.forfeitedChallenge(playerId, challengeId));
  }

  async forfeitChallenge(playerId, challengeId, { reason = "reveal", runId = "" } = {}, date = new Date()) {
    const player = this.data.players[playerId];
    const key = String(challengeId || "").trim();
    if (!player || !key) throw serviceError(400, "A player and challenge are required.", "invalid_challenge_forfeit");
    player.forfeitedChallenges ||= {};
    if (player.forfeitedChallenges[key]) {
      await this.writeQueue;
      return player.forfeitedChallenges[key];
    }

    const record = {
      reason: String(reason || "reveal").slice(0, 32),
      runId: String(runId || "").slice(0, 64),
      at: date.toISOString()
    };
    player.forfeitedChallenges[key] = record;

    const history = Object.entries(player.forfeitedChallenges);
    if (history.length > 180) {
      history.sort((left, right) => Date.parse(right[1].at) - Date.parse(left[1].at));
      player.forfeitedChallenges = Object.fromEntries(history.slice(0, 180));
    }
    await this.persist();
    return record;
  }

  async addScore(entry) {
    const index = this.data.scores.findIndex((score) => score.playerId === entry.playerId && score.challengeId === entry.challengeId && score.division === entry.division);
    const current = index >= 0 ? this.data.scores[index] : null;
    if (betterEntry(entry, current)) {
      if (index >= 0) this.data.scores[index] = entry;
      else this.data.scores.push(entry);
    }
    if (this.data.scores.length > 5000) this.data.scores = this.data.scores.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5000);
    await this.persist();
    return this.rankFor(entry.challengeId, entry.division, entry.playerId);
  }

  leaderboard(scope, division = "pure", limit = 50, playerId = "") {
    const currentDaily = new Date().toISOString().slice(0, 10);
    const currentWeekly = isoWeekKey();
    const filtered = this.data.scores.filter((entry) => {
      if (entry.division !== division) return false;
      if (scope === "daily") return entry.mode === "daily" && entry.dailyKey === currentDaily;
      if (scope === "weekly") return entry.mode === "weekly" && entry.weeklyKey === currentWeekly;
      if (scope === "sprint") return ["quick", "moves"].includes(entry.mode) && Date.now() - Date.parse(entry.createdAt) < 7 * 86400000;
      return true;
    }).sort(compareEntries);
    const top = filtered.slice(0, clamp(Number(limit) || 25, 1, 100)).map((entry, index) => publicEntry(entry, index + 1));
    const playerIndex = playerId ? filtered.findIndex((entry) => entry.playerId === playerId) : -1;
    return { scope, division, entries: top, playerEntry: playerIndex >= 0 ? publicEntry(filtered[playerIndex], playerIndex + 1) : null, updatedAt: new Date().toISOString() };
  }

  rankFor(challengeId, division, playerId) {
    const entries = this.data.scores.filter((entry) => entry.challengeId === challengeId && entry.division === division).sort(compareEntries);
    const index = entries.findIndex((entry) => entry.playerId === playerId);
    return index >= 0 ? { rank: index + 1, entry: publicEntry(entries[index], index + 1) } : null;
  }

  async grantEarnedCredits(playerId, requested) {
    const player = this.data.players[playerId];
    if (!player) return 0;
    const date = new Date().toISOString().slice(0, 10);
    if (player.earned.date !== date) player.earned = { date, amount: 0 };
    const grant = Math.max(0, Math.min(Number(requested) || 0, 25 - player.earned.amount));
    if (!grant) return 0;
    player.credits += grant;
    player.earned.amount += grant;
    await this.persist();
    return grant;
  }

  async grantChallengeCredits(playerId, challengeId, requested, date = new Date()) {
    const player = this.data.players[playerId];
    const rewardKey = String(challengeId || "").trim();
    if (!player || !rewardKey) return { creditReward: 0, weeklyBonus: 0, alreadyRewarded: false };

    player.rewardedChallenges ||= {};
    if (player.rewardedChallenges[rewardKey]) return { creditReward: 0, weeklyBonus: 0, alreadyRewarded: true };

    const day = date.toISOString().slice(0, 10);
    if (player.earned?.date !== day) player.earned = { date: day, amount: 0 };
    const creditReward = Math.max(0, Math.min(Number(requested) || 0, 25 - player.earned.amount));
    player.credits += creditReward;
    player.earned.amount += creditReward;
    player.rewardedChallenges[rewardKey] = date.toISOString();

    const week = isoWeekKey(date);
    if (player.weeklyActivity?.week !== week) player.weeklyActivity = { week, days: [], bonusClaimed: false };
    if (!player.weeklyActivity.days.includes(day)) player.weeklyActivity.days.push(day);
    let weeklyBonus = 0;
    if (player.weeklyActivity.days.length >= 4 && !player.weeklyActivity.bonusClaimed) {
      weeklyBonus = 40;
      player.credits += weeklyBonus;
      player.weeklyActivity.bonusClaimed = true;
    }

    const rewardHistory = Object.entries(player.rewardedChallenges);
    if (rewardHistory.length > 180) {
      rewardHistory.sort((left, right) => Date.parse(right[1]) - Date.parse(left[1]));
      player.rewardedChallenges = Object.fromEntries(rewardHistory.slice(0, 180));
    }
    await this.persist();
    return { creditReward, weeklyBonus, alreadyRewarded: false };
  }

  safeBackupSnapshot(date = new Date()) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw serviceError(400, "A valid backup date is required.", "invalid_backup_date");
    const players = Object.fromEntries(Object.entries(this.data.players).map(([id, stored]) => {
      const player = structuredClone(stored);
      delete player.recovery;
      delete player.purchaseKeys;
      return [id, player];
    }));
    const analytics = normalizeAnalyticsData(this.data.analytics);
    for (const day of Object.values(analytics.days)) day.sessionHashes = {};
    const interest = normalizeInterestData(this.data.interest);
    interest.records = {};
    return {
      format: "constellore-safe-backup",
      version: 1,
      generatedAt: date.toISOString(),
      authenticationResetRequired: true,
      data: {
        version: this.data.version,
        players,
        scores: structuredClone(this.data.scores),
        demand: structuredClone(this.data.demand),
        interest,
        analytics,
        recipeFeedback: normalizeRecipeFeedback(this.data.recipeFeedback),
        commerceTransactions: structuredClone(this.data.commerceTransactions || {})
      }
    };
  }

  async exportSafeBackup(directory, { keep = 7, date = new Date() } = {}) {
    if (this.path === ":memory:") throw serviceError(409, "Backups require a durable store.", "backup_unavailable");
    const safeDirectory = String(directory || "").trim();
    if (!safeDirectory) throw serviceError(503, "A backup directory is not configured.", "backup_unavailable");
    const retention = clamp(Math.floor(Number(keep) || 7), 1, 30);
    await this.writeQueue;
    await mkdir(safeDirectory, { recursive: true });
    const stamp = date.toISOString().replace(/[-:.]/g, "");
    const filename = `constellore-safe-${stamp}.json`;
    const path = join(safeDirectory, filename);
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(this.safeBackupSnapshot(date), null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);

    const backups = (await readdir(safeDirectory))
      .filter((entry) => SAFE_BACKUP_PATTERN.test(entry))
      .sort()
      .reverse();
    await Promise.all(backups.slice(retention).map((entry) => unlink(join(safeDirectory, entry))));
    return { filename, retained: Math.min(backups.length, retention), generatedAt: date.toISOString(), recoverySecretsIncluded: false, bearerTokensIncluded: false };
  }

  persist() {
    if (this.path === ":memory:") return Promise.resolve();
    const write = async () => {
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(this.data, null, 2), "utf8");
      await rename(temporary, this.path);
    };
    // A failed write must reject its own caller without permanently poisoning
    // the serialization queue. The next persistence attempt still runs after
    // either outcome of the prior promise.
    this.writeQueue = this.writeQueue.then(write, write);
    return this.writeQueue;
  }
}

const RUN_SNAPSHOT_VERSION = 1;

function serializeRun(run) {
  return {
    version: RUN_SNAPSHOT_VERSION,
    runId: run.runId,
    playerId: run.playerId,
    game: structuredClone(run.game),
    ranked: Boolean(run.ranked),
    challengeId: run.challengeId,
    startedAt: run.startedAt,
    expiresAt: run.expiresAt,
    discovered: [...run.discovered.values()].map((item) => structuredClone(item)),
    moves: run.moves,
    assist: run.assist,
    scoringDisabled: Boolean(run.scoringDisabled),
    forfeited: Boolean(run.forfeited),
    forfeitReason: run.forfeitReason,
    forfeitedAt: run.forfeitedAt,
    revealRoute: run.revealRoute ? structuredClone(run.revealRoute) : null,
    solutionRoute: run.solutionRoute ? structuredClone(run.solutionRoute) : null,
    solutionRecipes: run.solutionRecipes instanceof Map
      ? [...run.solutionRecipes.entries()].map(([key, result]) => [key, structuredClone(result)])
      : [],
    twistUsed: Boolean(run.twistUsed),
    twistedPairKey: run.twistedPairKey,
    usedBend: Boolean(run.usedBend),
    bendItem: run.bendItem ? structuredClone(run.bendItem) : null,
    history: run.history.map((step) => structuredClone(step)),
    recipeFeedbackMoves: run.recipeFeedbackMoves instanceof Set ? [...run.recipeFeedbackMoves] : [],
    recipeFeedbackRecipes: run.recipeFeedbackRecipes instanceof Set ? [...run.recipeFeedbackRecipes] : [],
    completedAt: run.completedAt,
    submitted: Boolean(run.submitted)
  };
}

function hydrateRun(snapshot, players) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const runId = String(snapshot.runId || "");
  const playerId = String(snapshot.playerId || "");
  const startedAt = Number(snapshot.startedAt);
  const expiresAt = Number(snapshot.expiresAt);
  const ranked = Boolean(snapshot.ranked);
  const completedAt = snapshot.completedAt == null ? null : Number.isFinite(Number(snapshot.completedAt)) ? Number(snapshot.completedAt) : null;
  const game = snapshot.game;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(runId) || !players[playerId]) return null;
  if (!Number.isFinite(startedAt) || !Number.isFinite(expiresAt) || expiresAt <= startedAt) return null;
  if (!game || typeof game !== "object" || Array.isArray(game) || typeof game.target !== "string" || !Array.isArray(game.starters)) return null;

  const discovered = new Map();
  for (const item of Array.isArray(snapshot.discovered) ? snapshot.discovered.slice(0, 2_000) : []) {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.word !== "string" || !item.word.trim()) continue;
    discovered.set(item.word.trim().toLowerCase(), structuredClone(item));
  }
  for (const word of game.starters.slice(0, 32)) {
    if (typeof word === "string" && word.trim() && !discovered.has(word.trim().toLowerCase())) discovered.set(word.trim().toLowerCase(), { word: word.trim(), source: "origin", feedbackEligible: true });
  }

  const solutionRecipes = new Map();
  for (const entry of Array.isArray(snapshot.solutionRecipes) ? snapshot.solutionRecipes.slice(0, 1_000) : []) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || !entry[1] || typeof entry[1] !== "object") continue;
    solutionRecipes.set(entry[0], structuredClone(entry[1]));
  }

  return {
    runId,
    playerId,
    game: structuredClone(game),
    ranked,
    challengeId: String(snapshot.challengeId || `practice:${runId}`).slice(0, 160),
    startedAt,
    expiresAt: ranked && completedAt ? Math.max(expiresAt, completedAt + COMPLETED_RANKED_RUN_RETENTION_MS) : expiresAt,
    discovered,
    moves: nonnegativeCounter(snapshot.moves),
    assist: typeof snapshot.assist === "string" ? snapshot.assist.slice(0, 32) : "none",
    scoringDisabled: Boolean(snapshot.scoringDisabled),
    forfeited: Boolean(snapshot.forfeited),
    forfeitReason: typeof snapshot.forfeitReason === "string" ? snapshot.forfeitReason.slice(0, 32) : null,
    forfeitedAt: snapshot.forfeitedAt == null ? null : Number.isFinite(Number(snapshot.forfeitedAt)) ? Number(snapshot.forfeitedAt) : null,
    revealRoute: Array.isArray(snapshot.revealRoute) ? structuredClone(snapshot.revealRoute.slice(0, 1_000)) : null,
    solutionRoute: Array.isArray(snapshot.solutionRoute) ? structuredClone(snapshot.solutionRoute.slice(0, 1_000)) : null,
    solutionRecipes,
    twistUsed: Boolean(snapshot.twistUsed),
    twistedPairKey: typeof snapshot.twistedPairKey === "string" ? snapshot.twistedPairKey.slice(0, 160) : null,
    usedBend: Boolean(snapshot.usedBend),
    bendItem: snapshot.bendItem && typeof snapshot.bendItem === "object" && !Array.isArray(snapshot.bendItem) ? structuredClone(snapshot.bendItem) : null,
    history: Array.isArray(snapshot.history) ? structuredClone(snapshot.history.slice(0, 2_000)) : [],
    recipeFeedbackMoves: new Set((Array.isArray(snapshot.recipeFeedbackMoves) ? snapshot.recipeFeedbackMoves : [])
      .map((move) => Math.floor(Number(move)))
      .filter((move) => Number.isInteger(move) && move > 0 && move <= 2_000)),
    recipeFeedbackRecipes: new Set((Array.isArray(snapshot.recipeFeedbackRecipes) ? snapshot.recipeFeedbackRecipes : [])
      .map((fingerprint) => String(fingerprint))
      .filter((fingerprint) => /^[a-z0-9]{7,16}$/.test(fingerprint))
      .slice(0, 2_000)),
    completedAt,
    submitted: Boolean(snapshot.submitted)
  };
}

export class RunRegistry {
  constructor(store) {
    this.store = store;
    this.runs = new Map();
    this.store.data.runs ||= {};
    for (const [runId, snapshot] of Object.entries(this.store.data.runs)) {
      const run = hydrateRun(snapshot, this.store.data.players);
      if (run && run.runId === runId) this.runs.set(runId, run);
      else delete this.store.data.runs[runId];
    }
    this.cleanup();
  }

  checkpoint(run) {
    this.store.data.runs[run.runId] = serializeRun(run);
  }

  persist(run = null) {
    if (run) this.checkpoint(run);
    return this.store.persist();
  }

  flush() {
    return this.store.persist();
  }

  start(playerId, game, { ranked = false, challengeId = "", scoringDisabled = false, forfeitReason = "" } = {}) {
    this.cleanup();
    const runId = randomUUID();
    const startedAt = Date.now();
    const run = {
      runId,
      playerId,
      game,
      ranked,
      challengeId: challengeId || `practice:${runId}`,
      startedAt,
      expiresAt: startedAt + Math.max((game.timeLimit || 0) * 1000 + 10_000, 30 * 60_000),
      discovered: new Map(game.starters.map((word) => [word.toLowerCase(), { word, source: "origin", feedbackEligible: true }])),
      moves: 0,
      assist: scoringDisabled && String(forfeitReason).toLowerCase() === "sense" ? "sense" : scoringDisabled ? "reveal" : "none",
      scoringDisabled: Boolean(scoringDisabled),
      forfeited: Boolean(scoringDisabled),
      forfeitReason: scoringDisabled ? String(forfeitReason || "reveal") : null,
      forfeitedAt: scoringDisabled ? startedAt : null,
      revealRoute: null,
      twistUsed: false,
      twistedPairKey: null,
      usedBend: false,
      bendItem: null,
      history: [],
      recipeFeedbackMoves: new Set(),
      recipeFeedbackRecipes: new Set(),
      completedAt: null,
      submitted: false
    };
    this.runs.set(runId, run);
    this.checkpoint(run);
    return { run, token: this.store.sign(`run:${runId}:${playerId}:${startedAt}`) };
  }

  get(runId, playerId, token) {
    const run = this.runs.get(runId);
    if (!run || run.playerId !== playerId || !this.store.verify(`run:${runId}:${playerId}:${run.startedAt}`, token)) throw serviceError(401, "This run is not valid anymore.", "invalid_run");
    if (Date.now() > run.expiresAt) throw serviceError(410, "This run has expired.", "run_expired");
    return run;
  }

  canCombine(run, a, b) {
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
    if (!run.discovered.has(String(a).toLowerCase()) || !run.discovered.has(String(b).toLowerCase())) throw serviceError(422, "That combination contains an undiscovered word.", "impossible_combination");
    if (run.game.moveLimit && run.moves >= run.game.moveLimit) throw serviceError(409, "No moves remain in this orbit.", "move_limit");
    if (run.game.timeLimit && Date.now() - run.startedAt > run.game.timeLimit * 1000 + 3000) throw serviceError(409, "Time has expired for this orbit.", "time_limit");
  }

  recordCombination(run, result, { a = "", b = "" } = {}) {
    if (result.twisted) {
      if (run.twistUsed) throw serviceError(409, "This orbit already found its Cosmic Twist.", "twist_used");
      run.twistUsed = true;
      run.twistedPairKey = [a, b].map((word) => String(word).trim().toLowerCase()).sort().join("+");
    }
    const ingredientA = run.discovered.get(String(a).trim().toLowerCase());
    const ingredientB = run.discovered.get(String(b).trim().toLowerCase());
    const safeIngredientSources = new Set(["origin", "world", "twist", "ai", "semantic"]);
    const safeResultSources = new Set(["world", "twist", "ai", "semantic"]);
    const ingredientFeedbackSafe = (item) => Boolean(item && item.feedbackEligible !== false && safeIngredientSources.has(String(item.source || "")));
    const feedbackEligible = ingredientFeedbackSafe(ingredientA)
      && ingredientFeedbackSafe(ingredientB)
      && safeResultSources.has(String(result.source || "world"));
    const canonicalWord = (word) => run.discovered.get(String(word).trim().toLowerCase())?.word || String(word).trim();
    const newDiscovery = !run.discovered.has(result.word.toLowerCase());
    run.moves += 1;
    const historyEntry = {
      move: run.moves,
      a: canonicalWord(a),
      b: canonicalWord(b),
      word: result.word,
      emoji: result.emoji || "",
      category: result.category || null,
      note: result.note || "",
      source: result.source || "world",
      newDiscovery,
      twisted: Boolean(result.twisted),
      canonicalWord: result.twist?.canonicalWord || "",
      revealed: false,
      feedbackEligible
    };
    run.history.push(historyEntry);
    run.discovered.set(result.word.toLowerCase(), { ...result, feedbackEligible });
    if (result.source === "ai") run.assist = "ai";
    if (result.word.toLowerCase() === run.game.target.toLowerCase()) {
      run.completedAt = Date.now();
      if (run.ranked) run.expiresAt = Math.max(run.expiresAt, run.completedAt + COMPLETED_RANKED_RUN_RETENTION_MS);
    }
    this.checkpoint(run);
    return historyEntry;
  }

  reveal(run, route) {
    if (run.revealRoute) return run.revealRoute;
    if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
    if (!Array.isArray(route)) throw serviceError(422, "No verified answer path is available.", "route_unavailable");

    run.assist = "reveal";
    run.scoringDisabled = true;
    run.forfeited = true;
    run.forfeitReason = "reveal";
    run.forfeitedAt ||= Date.now();
    run.revealRoute = route.map((step) => ({ ...step }));
    for (const step of run.revealRoute) {
      const newDiscovery = !run.discovered.has(step.word.toLowerCase());
      run.history.push({
        move: run.moves + 1,
        a: step.a,
        b: step.b,
        word: step.word,
        emoji: step.emoji || "",
        category: step.category || null,
        note: step.note || "",
        source: "reveal",
        newDiscovery,
        twisted: false,
        canonicalWord: "",
        revealed: true
      });
      run.discovered.set(step.word.toLowerCase(), { ...step, source: "reveal" });
      run.moves += 1;
    }
    run.completedAt = Date.now();
    this.checkpoint(run);
    return run.revealRoute;
  }

  sense(run) {
    if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");

    run.assist = run.forfeitReason === "reveal" ? "reveal" : "sense";
    run.scoringDisabled = true;
    run.forfeited = true;
    run.forfeitReason ||= "sense";
    run.forfeitedAt ||= Date.now();
    this.checkpoint(run);
    return run;
  }

  addBend(run, item, assist) {
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
    if (run.usedBend) throw serviceError(409, "Only one Reality Bend may be used in a run.", "bend_used");
    if (!["market", "wish"].includes(assist)) throw serviceError(400, "That Reality Bend is not available.", "invalid_bend_assist");
    run.usedBend = true;
    run.bendItem = structuredClone(item);
    run.assist = assist;
    run.game = { ...run.game, division: "open", pureEligible: false };
    run.discovered.set(item.word.toLowerCase(), item);
    this.checkpoint(run);
  }

  progress(run) {
    return {
      moves: run.moves,
      completed: Boolean(run.completedAt),
      completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
      submitted: Boolean(run.submitted),
      discovered: [...run.discovered.values()].map((item) => structuredClone(item)),
      history: run.history.map((step) => structuredClone(step)),
      usedBend: Boolean(run.usedBend),
      bendItem: run.bendItem ? structuredClone(run.bendItem) : null
    };
  }

  finalize(run, callsign) {
    if (run.scoringDisabled || run.forfeited) throw serviceError(409, "Assisted orbits cannot submit a score.", "assisted_run");
    if (!run.completedAt) throw serviceError(422, "The target has not been reached.", "target_missing");
    if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
    run.submitted = true;
    const elapsedMs = Math.max(1, run.completedAt - run.startedAt);
    const assisted = run.assist !== "none";
    const entry = {
      id: randomUUID(),
      runId: run.runId,
      playerId: run.playerId,
      callsign,
      challengeId: run.challengeId,
      division: assisted ? "open" : "pure",
      assist: run.assist,
      mode: run.game.mode,
      target: run.game.target,
      score: calculateStarscore({ game: run.game, moves: run.moves, elapsedSeconds: Math.round(elapsedMs / 1000), assisted }),
      moves: run.moves,
      elapsedMs,
      dailyKey: new Date(run.startedAt).toISOString().slice(0, 10),
      weeklyKey: isoWeekKey(new Date(run.startedAt)),
      createdAt: new Date().toISOString()
    };
    this.checkpoint(run);
    return entry;
  }

  cleanup() {
    const now = Date.now();
    for (const [id, run] of this.runs) {
      if (now <= run.expiresAt + 60_000) continue;
      this.runs.delete(id);
      delete this.store.data.runs[id];
    }
  }
}

export function serviceError(statusCode, message, code = "service_error", details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.serviceCode = code;
  if (details && typeof details === "object" && !Array.isArray(details)) error.details = details;
  return error;
}

export function isoWeekKey(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function publicEntry(entry, rank) {
  return { rank, callsign: entry.callsign, score: entry.score, moves: entry.moves, elapsedMs: entry.elapsedMs, mode: entry.mode, target: entry.target, assist: entry.assist, division: entry.division };
}
