import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { QUICK_TIP_LIMIT, assistancePolicy, combineAssistance } from "./public/engagement-features.mjs";
import { buildCommunityResults } from "./public/community-results.mjs";
import { cosmicEventCatalog, cosmicEventCollectionProgress, currentCosmicEvent } from "./public/cosmic-events.mjs";
import { constellationVoyageCatalog, sanitizeVoyageProgress } from "./public/constellation-voyages.mjs";
import { emptyRecipeFeedback, normalizeRecipeFeedback, recipeFeedbackSummary, recordRecipeFeedback } from "./public/recipe-feedback.mjs";
import {
  ROUTE_REMIX_FAMILIES,
  ROUTE_REMIX_VERSION,
  checkRouteRemixBeforeCombination,
  checkRouteRemixCompletion,
  createRouteRemixProgress,
  markRouteRemixAnswerRevealed,
  publicRouteRemixView,
  recordRouteRemixCombination,
  routeRemixProgress,
  sanitizeRouteRemixProgress,
  sanitizeRouteRemixRuntime
} from "./public/route-remixes.mjs";
import {
  createRemixProgressionState,
  getPromotionEligibility,
  getRemixMasteryProgress,
  getRemixRank,
  getRemixRankPresentation,
  recordRemixProgressionOutcome,
  recordRemixPromotionTrialOutcome,
  sanitizeRemixProgressionState,
  startRemixPromotionTrial
} from "./public/remix-progression.mjs";
import {
  createRemixReadinessState,
  getAdaptiveRemixIntensity,
  recordRemixReadinessOutcome,
  sanitizeRemixReadinessState
} from "./public/remix-readiness.mjs";
import {
  applyAdaptiveChallengeOutcome,
  createAdaptiveDifficultyState,
  rememberAdaptiveTarget,
  sanitizeAdaptiveDifficultyState
} from "./public/adaptive-difficulty.mjs";
import { comparePersonalBest, createRouteSignature, sanitizeRouteSignature } from "./public/signature-routes.mjs";
import {
  SCRAMBLE_DEFAULT_MODE_ID,
  publicScrambleArenaSnapshot,
  sanitizeScrambleArena,
  scrambleRatingForMode
} from "./public/scramble-arena.mjs";
import {
  COSMETIC_COLLECTIONS,
  COSMETIC_ITEMS,
  COSMETIC_SCHEMA_VERSION,
  COSMETIC_SLOTS,
  canonicalCosmeticSlot,
  cosmeticById,
  cosmeticCollectionById,
  cosmeticOwnershipSnapshot,
  isCosmeticOwned,
  migrateCosmeticLoadout,
  sanitizeCosmeticLoadout
} from "./public/cosmetic-economy.mjs";
import {
  CIRCUIT_BOOSTS,
  CRAZY_PATH_DAILY_DAYS,
  CRAZY_PATH_REWARD_CHOICES,
  COSMOS_CIRCUIT_ECONOMY,
  COSMOS_CIRCUIT_VERSION,
  advanceCircuitRun,
  claimCircuitReward,
  cosmosCircuitCourse,
  cosmosCircuitCrazyCourse,
  crazyPathEligibility,
  finishCircuitRun,
  grantCrazyPathDailyPowers,
  grantDailyLaunchPasses,
  grantRankLaunchPass,
  recordEligiblePureWin,
  sanitizeCircuitClaims,
  sanitizeCircuitRun,
  sanitizeCircuitWallet,
  sanitizeCrazyPathStipend,
  startCircuitRun
} from "./public/cosmos-circuit.mjs";
import {
  claimStarPathReward,
  recordStarPathProgress,
  sanitizeStarPathState,
  starPathCatalog,
  starPathCircuitXpEvent,
  starPathProgress,
  starPathRewardById,
  starPathWordWinXpEvent
} from "./public/star-path.mjs";

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
const CLOUD_PROFILE_FIELDS = new Set(["cosmetics", "discovered", "feedbackPreferences", "firstOrbit", "journeys", "masteryCelebrated", "progression", "recipeMastery", "rivalGhostEnabled", "signatureBests", "theme", "weekly"]);
const CLOUD_THEMES = new Set(["void", "aurora", "solar", "dark", "light", "system"]);
const CLOUD_COSMETIC_SLOTS = new Set([...COSMETIC_SLOTS, "board", "sound", "theme", "trail"]);
const COSMETIC_ITEM_IDS = new Set(COSMETIC_ITEMS.map((item) => item.id));
const COSMETIC_COLLECTION_IDS = new Set(COSMETIC_COLLECTIONS.map((collection) => collection.id));
const EARNED_COSMETIC_BY_UNLOCK = new Map(
  COSMETIC_ITEMS
    .filter((item) => item.access === "earned" && item.unlock?.key)
    .map((item) => [item.unlock.key, item.id])
);
const CLOUD_VOYAGES = new Map(constellationVoyageCatalog().map((voyage) => [voyage.id, voyage]));
const CLOUD_EVENTS = new Map(cosmicEventCatalog().map((event) => [event.id, event]));
const COSMIC_EVENT_ORIGIN_WORDS = new Set(["earth", "water", "fire", "air"]);
const COSMIC_EVENT_COLLECTION_REWARD = 60;
const MAX_LIFETIME_DISCOVERIES = 10_000;
const MAX_COSMIC_EVENT_REWARDS = 104;
const DISCOVERY_DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const COSMIC_EVENT_REWARD_KEY_PATTERN = /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3]):[a-z0-9][a-z0-9-]{0,47}$/;
const CLOUD_SIGNATURE_FIELDS = new Set([
  "assist", "categories", "contextualSteps", "dimensions", "discoveries", "idealMoves", "kind", "mode", "moves",
  "privacy", "routeFingerprint", "score", "scoreEligible", "scoreMultiplier", "scopeKey", "signatureId",
  "stepFingerprints", "targetKey", "tier", "tierLabel", "version"
]);
const RECOVERY_CODE_PATTERN = /^CF(?:-[0-9A-F]{4}){8}$/;
const SAFE_BACKUP_PATTERN = /^constellore-safe-\d{8}T\d{9}Z\.json$/;
const COMPLETED_RANKED_RUN_RETENTION_MS = 8 * 86400000;
const PLAYER_SESSION_TTL_MS = 30 * 86400000;
const MAX_PLAYER_SESSIONS = 8;
const PLAYER_SESSION_TOKEN_PATTERN = /^cs3\.([A-Za-z0-9_-]{20,2048})\.([A-Za-z0-9_-]{43})$/;
const CHALLENGE_IDENTITY_VERSION = 3;
const RANKED_RULES_VERSION = "ranked-v3";
const MAX_LEDGER_ENTRIES = 50_000;
const MAX_REJECTED_PAIR_REPORTS = 2_000;
const MAX_REJECTED_PAIR_SUGGESTIONS = 20;
const CIRCUIT_ATTEMPT_TTL_MS = 48 * 60 * 60_000;
const MAX_CIRCUIT_RECEIPTS = 64;
const MAX_CIRCUIT_BOOSTS = 9_999;
const CIRCUIT_IDEMPOTENCY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;
const CIRCUIT_ATTEMPT_TOKEN_PATTERN = /^cc1\.[A-Za-z0-9_-]{43}$/;
const CIRCUIT_TELEMETRY_SEED_PATTERN = /^[0-9a-f]{64}$/;
const CIRCUIT_TELEMETRY_CHAIN_PATTERN = /^[0-9a-f]{64}$/;
const CIRCUIT_EVENT_OUTCOMES = new Set(["perfect", "clear", "near-miss", "miss"]);
const CIRCUIT_END_REASONS = new Set(["finish", "extract", "crash", "timeout"]);
const CIRCUIT_MAX_TRAJECTORY_SAMPLES = 64;
const CIRCUIT_MIN_TRAJECTORY_SAMPLES = 8;
const CIRCUIT_MAX_SAMPLE_PROGRESS_GAP_MS = 600;
const CIRCUIT_MAX_SAMPLE_ELAPSED_GAP_MS = 1_200;
const CIRCUIT_WALL_CLOCK_GRACE_MS = 2_000;
const CIRCUIT_SAMPLE_POSITION_EPSILON = 0.08;
const MAX_STAR_PATH_REWARDS = 2_048;
const ANALYTICS_COHORT_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
const COMBINATION_REPORT_MODES = new Set(["reach", "quick", "moves", "daily", "weekly", "challenge", "explore"]);
const COMBINATION_REPORT_REASONS = new Set(["direct", "mixture", "repeat", "culture", "other"]);
export const MARKET_REPRICE_INTERVAL_MS = 6 * 60 * 60_000;
export const STORAGE_CONTRACT_VERSION = 1;
export const DUEL_SEASON_ID = "v5-s1";
export const DUEL_STARTING_RATING = 1_000;

export function sanitizeDuelRating(raw, seasonId = DUEL_SEASON_ID) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const games = Math.max(0, Math.floor(Number(source.games) || 0));
  const wins = Math.min(games, Math.max(0, Math.floor(Number(source.wins) || 0)));
  const losses = Math.min(games - wins, Math.max(0, Math.floor(Number(source.losses) || 0)));
  const draws = Math.min(games - wins - losses, Math.max(0, Math.floor(Number(source.draws) || 0)));
  const rating = Math.max(100, Math.min(10_000, Math.round(Number(source.rating) || DUEL_STARTING_RATING)));
  const updatedAt = Number.isFinite(Date.parse(source.updatedAt || ""))
    ? new Date(source.updatedAt).toISOString()
    : null;
  return {
    seasonId: String(source.seasonId || seasonId).trim().slice(0, 40) || DUEL_SEASON_ID,
    rating,
    games,
    wins,
    losses,
    draws,
    streak: Math.max(0, Math.min(10_000, Math.floor(Number(source.streak) || 0))),
    provisional: games < 5,
    updatedAt
  };
}

export function sanitizeDuelEligibility(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const parsedAttestedAt = Date.parse(String(source.attestedAt || ""));
  const attestedAt = Number.isFinite(parsedAttestedAt)
    ? new Date(parsedAttestedAt).toISOString()
    : null;
  const soloWinAttested = source.soloWinAttested === true && Boolean(attestedAt);
  return {
    soloWinAttested,
    attestedAt: soloWinAttested ? attestedAt : null
  };
}

const catalogById = new Map(MARKET_CATALOG.map((item) => [item.id, item]));
const adjectives = ["Amber", "Astral", "Bright", "Cinder", "Cosmic", "Distant", "Echo", "Frost", "Golden", "Hidden", "Ivory", "Lunar", "Neon", "Quiet", "Solar", "Velvet"];
const nouns = ["Comet", "Drifter", "Ember", "Harbor", "Meteor", "Moon", "Nova", "Orbit", "Pioneer", "Raven", "Signal", "Sparrow", "Star", "Voyager", "Willow", "Wisp"];
const INTEREST_CAMPAIGN = "web-release";
const INTEREST_SOURCES = new Set(["github-pages", "website", "local-practice", "game", "direct"]);
const INTEREST_ACTIONS = new Set(["add", "remove"]);
const INTEREST_RECORD_LIMIT = 25_000;
const INTEREST_INACTIVE_RETENTION_DAYS = 90;
const anonymousInterestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANALYTICS_RETENTION_DAYS = 90;
export const ANALYTICS_EVENT_NAMES = Object.freeze([
  "app_opened", "run_started", "run_restored", "combination_completed", "combination_rejected", "target_reached",
  "run_failed", "wish_opened", "wish_used", "paywall_viewed", "checkout_started", "share_created",
  "challenge_opened", "theme_changed", "pwa_installed", "leaderboard_opened", "score_uploaded",
  "market_opened", "market_searched", "word_purchased", "cosmetic_purchased", "market_word_used", "credit_pack_opened", "answer_revealed",
  "board_tidied", "sense_opened", "sense_used", "sense_earned", "sense_purchase_started", "sense_purchased",
  "powerups_opened", "quick_tip_used", "word_gift_used",
  "ghost_loaded", "ghost_race_started", "ghost_race_completed", "mastery_opened", "mastery_progressed",
  "mastery_completed", "audio_toggled", "music_toggled", "haptic_toggled", "result_details_toggled", "fusion_feedback_played", "cosmetic_changed",
  "recipe_feedback_submitted", "card_shared", "card_downloaded", "cloud_sync", "ownership_restored",
  "recovery_rotated", "account_recovered", "mission_briefing_viewed", "mission_briefing_dismissed",
  "mode_screen_viewed", "first_orbit_started", "first_combination", "first_orbit_completed", "run_retried",
  "supporter_interest", "player_data_exported", "player_data_deleted", "journey_opened", "voyage_started",
  "voyage_completed", "event_started", "event_discovery", "signature_graded", "community_viewed",
  "combination_expected",
  "cosmos_circuit_opened", "cosmos_circuit_started", "cosmos_circuit_completed", "cosmos_circuit_extracted", "cosmos_circuit_abandoned",
  "cosmos_circuit_tutorial_viewed", "cosmos_circuit_tutorial_completed", "cosmos_circuit_challenge_completed",
  "cosmos_circuit_weekly_reward_claimed", "cosmos_circuit_personal_best",
  "star_path_opened", "star_path_tutorial_viewed", "star_path_tutorial_completed", "star_path_reward_claimed", "star_path_rewards_claimed_all"
]);
export const ANALYTICS_FUNNEL_EVENTS = Object.freeze([
  "app_opened", "mode_screen_viewed", "mission_briefing_viewed", "run_started", "first_combination", "target_reached", "run_retried"
]);
const analyticsEventNames = new Set(ANALYTICS_EVENT_NAMES);
const analyticsEnumDimensions = new Map([
  ["mode", new Set(["reach", "quick", "moves", "daily", "weekly", "challenge", "ticketed", "practice"])],
  ["path", new Set(["standard", "crazy"])],
  ["division", new Set(["pure", "open"])],
  ["source", new Set(["world", "ai", "twist", "reveal", "gift", "market", "wish", "earned", "credits", "reward", "free", "daily", "founder", "mastery", "benchmark", "verified", "voyage", "event", "signature", "community"])],
  ["location", new Set(["home", "run", "result", "market", "mastery", "journey", "event"])],
  ["provider", new Set(["native", "web", "sandbox", "rewarded"])],
  ["scope", new Set(["daily", "weekly", "sprint", "all"])],
  ["tier", new Set(["study", "spark", "orbit", "constellation", "nova", "singularity", ...Array.from({ length: 12 }, (_, index) => String(index + 1))])],
  ["milestone", new Set(["none", "drift", "orbit", "nebula", "galaxy", "cosmos", "crazy"])],
  ["track", new Set(["free", "supporter"])],
  ["action", new Set(["race"])],
  ["theme", new Set(["void", "aurora", "solar", "dark", "light", "system"])],
  ["entitlement", new Set(["pass", "reward", "free", "credits", "earned"])],
  ["reason", new Set(["abandoned", "moves", "time", "reveal", "sense", "gift", "completed", "unavailable", "extract", "crash", "timeout", "withdraw"])],
  ["assist", new Set(["none", "ai", "market", "wish", "reveal", "sense", "gift"])],
  ["result", new Set(["won", "lost", "tied", "completed", "dismissed", "accepted", "cancelled"])],
  ["kind", new Set([
    "fusion", "rejection", "discovery", "twist", "target", "ui", "music", "haptic",
    "theme", "board", "trail", "sound", "collection",
    "wordplaque", "trailset", "boardfinish", "homescene", "gatestyle", "uifinish", "soundtheme",
    "profilebadge", "shipdecal", "ostremix",
    "logical", "surprising", "bad", "voyage", "event", "signature", "community"
  ])],
  ["outcome", new Set(["accepted", "cancelled", "completed", "dismissed", "earned", "purchased"])],
  ["enabled", new Set(["true", "false"])],
  ["installed", new Set(["true", "false"])],
  ["completed", new Set(["true", "false"])],
  ["complete", new Set(["true", "false"])],
  ["reward", new Set(["true", "false"])],
  ["assisted", new Set(["true", "false"])],
  ["revealed", new Set(["true", "false"])],
  ["newDiscovery", new Set(["true", "false"])],
  ["twisted", new Set(["true", "false"])],
  ["improved", new Set(["true", "false"])],
  ["eligible", new Set(["true", "false"])],
  ["training", new Set(["true", "false"])],
  ["practiceBoost", new Set(["true", "false"])]
]);
const analyticsSlugDimensions = new Set(["pack", "collection", "voyage", "event", "chapter", "stage"]);
const analyticsMetricNames = new Set([
  "credits", "cost", "reward", "score", "rank", "moves", "seconds", "steps", "words", "length", "stage", "progress", "stars",
  "deltaMs", "chargesBefore", "chargesAfter", "completedRoutes", "signatureScore", "topPercent",
  "xp", "passes", "durationMs", "segments", "stardustPercent"
]);

function emptyInterestData() {
  return { version: 1, records: {}, totals: {}, updatedAt: null };
}

function emptyAnalyticsData() {
  return { version: 1, totals: { events: {} }, days: {}, updatedAt: null };
}

function emptyRejectedPairData() {
  return { version: 2, entries: {}, updatedAt: null };
}

function normalizeRejectedPairData(value) {
  const data = isRecord(value) ? value : {};
  const entries = [];
  for (const [fingerprint, raw] of Object.entries(isRecord(data.entries) ? data.entries : {})) {
    if (!/^[A-Za-z0-9_-]{32,64}$/.test(fingerprint) || !isRecord(raw)) continue;
    const count = clamp(nonnegativeCounter(raw.count), 0, 1_000_000);
    const lastSeenAt = typeof raw.lastSeenAt === "string" && Number.isFinite(Date.parse(raw.lastSeenAt)) ? new Date(raw.lastSeenAt).toISOString() : null;
    if (!count || !lastSeenAt) continue;
    const sample = Array.isArray(raw.sample) && raw.sample.length === 2
      ? raw.sample.map((word) => cleanCloudText(word, 28)).filter(Boolean)
      : [];
    const modes = normalizeAnalyticsCounters(raw.modes, COMBINATION_REPORT_MODES);
    const reporters = Object.fromEntries(Object.entries(isRecord(raw.reporters) ? raw.reporters : {})
      .filter(([digest, seenAt]) => /^[A-Za-z0-9_-]{32,64}$/.test(digest) && typeof seenAt === "string" && Number.isFinite(Date.parse(seenAt)))
      .slice(-256));
    const reasons = normalizeAnalyticsCounters(raw.reasons, COMBINATION_REPORT_REASONS);
    const suggestions = Object.fromEntries(Object.entries(isRecord(raw.suggestions) ? raw.suggestions : {})
      .filter(([digest, suggestion]) => /^[A-Za-z0-9_-]{32,64}$/.test(digest) && isRecord(suggestion))
      .map(([digest, suggestion]) => {
        const word = cleanCloudText(suggestion.word, 28);
        const suggestionCount = clamp(nonnegativeCounter(suggestion.count), 0, 1_000_000);
        const suggestionLastSeenAt = typeof suggestion.lastSeenAt === "string" && Number.isFinite(Date.parse(suggestion.lastSeenAt))
          ? new Date(suggestion.lastSeenAt).toISOString()
          : null;
        return word && suggestionCount && suggestionLastSeenAt
          ? [digest, { word, count: suggestionCount, lastSeenAt: suggestionLastSeenAt }]
          : null;
      })
      .filter(Boolean)
      .sort((left, right) => right[1].count - left[1].count || Date.parse(right[1].lastSeenAt) - Date.parse(left[1].lastSeenAt))
      .slice(0, MAX_REJECTED_PAIR_SUGGESTIONS));
    entries.push([fingerprint, {
      count,
      lastSeenAt,
      sample: sample.length === 2 ? sample : null,
      modes,
      reporters,
      reasons,
      suggestions
    }]);
  }
  entries.sort((left, right) => Date.parse(right[1].lastSeenAt) - Date.parse(left[1].lastSeenAt));
  return { version: 2, entries: Object.fromEntries(entries.slice(0, MAX_REJECTED_PAIR_REPORTS)), updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null };
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
        cohortHashes: entry.cohortHashes && typeof entry.cohortHashes === "object" && !Array.isArray(entry.cohortHashes)
          ? Object.fromEntries(Object.keys(entry.cohortHashes).filter((digest) => /^[A-Za-z0-9_-]{32,64}$/.test(digest)).map((digest) => [digest, true]))
          : {},
        segments: normalizeAnalyticsSegments(entry.segments),
        metrics: normalizeAnalyticsMetrics(entry.metrics)
      };
    }
  }
  return {
    version: 2,
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

export function marketPrice(wordOrId, period = Math.floor(Date.now() / MARKET_REPRICE_INTERVAL_MS), demand = 0) {
  const item = typeof wordOrId === "string" ? catalogById.get(wordOrId) : wordOrId;
  if (!item) return null;
  const phaseA = hashNumber(`${item.id}:a`) % 1000;
  const phaseB = hashNumber(`${item.id}:b`) % 1000;
  const wave = Math.sin((period + phaseA) / 11) * .09 + Math.sin((period + phaseB) / 5) * .035;
  const demandLift = clamp(Number(demand) || 0, 0, 1) * .06;
  const roundedPrice = roundToFive(item.basePrice * clamp(1 + wave + demandLift, .8, 1.2));
  const minimumPrice = Math.ceil(item.basePrice * .8 / 5) * 5;
  const maximumPrice = Math.floor(item.basePrice * 1.2 / 5) * 5;
  return clamp(roundedPrice, minimumPrice, maximumPrice);
}

export function marketTrend(item, period, demand, length = 12) {
  return Array.from({ length }, (_, index) => marketPrice(item, period - (length - index - 1), demand));
}

export function calculateStarscore({ game, moves, elapsedSeconds, errors = 0, assisted = false, assist = "none" }) {
  const tier = clamp(Number(game?.tier) || 1, 1, 5);
  const parMoves = 3 + tier * 3;
  const base = 100_000 + tier * 5_000;
  const movePenalty = Math.max(0, Number(moves) - parMoves) * 5_000;
  const timePenalty = Math.max(0, Number(elapsedSeconds)) * 25;
  const errorPenalty = Math.max(0, Math.floor(Number(errors) || 0)) * 2_500;
  const rawScore = Math.max(1, base - movePenalty - timePenalty - errorPenalty);
  const requestedAssist = String(assist || "none").toLowerCase();
  const scoredAssist = ["wish", "market", "ai", "sense", "gift", "open", "reveal", "training"].includes(requestedAssist)
    ? requestedAssist
    : assisted ? "open" : "none";
  const policy = assistancePolicy(scoredAssist);
  if (!policy.scoreEligible || policy.scoreMultiplier <= 0) return 0;
  return Math.max(1, Math.round(rawScore * policy.scoreMultiplier));
}

export function compareEntries(left, right) {
  if (right.score !== left.score) return right.score - left.score;
  if (left.moves !== right.moves) return left.moves - right.moves;
  return left.elapsedMs - right.elapsedMs;
}

function betterEntry(next, current) {
  return !current || compareEntries(next, current) < 0;
}

function canonicalChallengeText(value, maximum = 80) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US").slice(0, maximum);
}

export function buildChallengeIdentity(game, { assist = "none", graphVersion = "world-v1", buildVersion = "dev" } = {}) {
  const policy = assistancePolicy(assist);
  const descriptor = {
    v: CHALLENGE_IDENTITY_VERSION,
    mode: canonicalChallengeText(game?.mode, 24) || "reach",
    target: canonicalChallengeText(game?.target, 80),
    seed: Number.isFinite(Number(game?.seed)) ? String(Math.abs(Number(game.seed))) : "0",
    modifier: {
      timeLimit: Number.isFinite(Number(game?.timeLimit)) ? Math.max(0, Math.floor(Number(game.timeLimit))) : null,
      moveLimit: Number.isFinite(Number(game?.moveLimit)) ? Math.max(0, Math.floor(Number(game.moveLimit))) : null,
      stage: Number.isFinite(Number(game?.stage)) ? Math.max(0, Math.floor(Number(game.stage))) : null,
      law: canonicalChallengeText(game?.law?.id, 40) || null,
      start: Array.isArray(game?.starters) ? {
        style: game?.startProfile?.style === "shuffled" || game?.startStyle === "shuffled"
          ? "shuffled"
          : "classic",
        profileId: canonicalChallengeText(game?.startProfile?.profileId, 96) || null,
        starterHash: canonicalChallengeText(game?.startProfile?.starterHash, 32) || null,
        routeStartIndex: Number.isFinite(Number(game?.startProfile?.routeStartIndex))
          ? Math.max(0, Math.floor(Number(game.startProfile.routeStartIndex)))
          : 0,
        routeLength: Number.isFinite(Number(game?.startProfile?.routeLength ?? game?.routeLength))
          ? Math.max(0, Math.floor(Number(game?.startProfile?.routeLength ?? game?.routeLength)))
          : null,
        starters: game.starters.slice(0, 6).map((word) => canonicalChallengeText(word, 80)).filter(Boolean)
      } : null,
      remix: game?.remixes ? {
        version: Math.max(1, Math.floor(Number(game.remixes.version) || 1)),
        selectionId: canonicalChallengeText(game.remixes.selectionId, 64) || null,
        rank: canonicalChallengeText(game.remixes.rank?.id, 32) || null,
        rules: (Array.isArray(game.remixes.rules) ? game.remixes.rules : []).slice(0, 8).map((rule) => ({
          family: canonicalChallengeText(rule?.family, 40),
          detail: canonicalChallengeText(rule?.detail, 120)
        }))
      } : null,
      promotion: game?.promotion?.active ? {
        currentRank: canonicalChallengeText(game.promotion.currentRank?.id, 32) || null,
        targetRank: canonicalChallengeText(game.promotion.targetRank?.id, 32) || null,
        attempt: Math.max(1, Math.floor(Number(game.promotion.attempt) || 1)),
        attemptsTotal: Math.max(1, Math.floor(Number(game.promotion.attemptsTotal) || 3)),
        winsRequired: Math.max(1, Math.floor(Number(game.promotion.winsRequired) || 2))
      } : null
    },
    graphVersion: canonicalChallengeText(game?.graphVersion || graphVersion, 64) || "world-v1",
    buildVersion: canonicalChallengeText(game?.buildVersion || buildVersion, 64) || "dev",
    rulesVersion: canonicalChallengeText(game?.rulesVersion || RANKED_RULES_VERSION, 32),
    assistanceClass: policy.study ? "study" : policy.division
  };
  const encoded = JSON.stringify(descriptor);
  return { key: `ch3_${createHash("sha256").update(encoded).digest("base64url").slice(0, 24)}`, descriptor };
}

function communityForEntries(entries, playerId = "") {
  const community = buildCommunityResults(
    entries.map((entry, index) => ({ ...entry, rank: index + 1 })),
    { playerId }
  );
  return {
    ...community,
    eligibleRoutes: entries.length,
    sampledRoutes: community.completedRoutes
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactRecordKeys(value, keys) {
  return isRecord(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function assertAllowedKeys(value, allowed, code = "invalid_cloud_profile") {
  if (!isRecord(value) || Object.keys(value).some((key) => !allowed.has(key))) {
    throw serviceError(400, "That cloud profile contains unsupported fields.", code);
  }
}

function normalizeCosmeticEntitlementSet(raw, allowed) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((value) => String(value || "").trim()).filter((id) => allowed.has(id)))].sort();
}

function normalizePlayerCosmeticEntitlements(raw) {
  const source = isRecord(raw) ? raw : {};
  return {
    version: COSMETIC_SCHEMA_VERSION,
    items: normalizeCosmeticEntitlementSet(source.items, COSMETIC_ITEM_IDS),
    collections: normalizeCosmeticEntitlementSet(source.collections, COSMETIC_COLLECTION_IDS)
  };
}

function recordEarnedCosmeticUnlock(player, unlockKey) {
  const itemId = EARNED_COSMETIC_BY_UNLOCK.get(unlockKey);
  if (!player || !itemId) return false;
  const entitlements = normalizePlayerCosmeticEntitlements(player.cosmeticEntitlements);
  if (entitlements.items.includes(itemId)) return false;
  entitlements.items.push(itemId);
  entitlements.items.sort();
  player.cosmeticEntitlements = entitlements;
  return true;
}

function authoritativeCosmeticProgress(player, runLedger = []) {
  const verifiedWins = runLedger.filter((entry) =>
    entry?.playerId === player?.id
    && entry?.type === "ranked_run_completed"
    && entry?.status === "verified"
  ).length;
  const weeklyComplete = Object.keys(player?.rewardedChallenges || {}).some((key) => key.startsWith("weekly:"));
  const routeRank = getRemixRank(player?.routeProgression?.rankId);
  return {
    wins: verifiedWins,
    discoveries: Object.keys(isRecord(player?.lifetimeDiscoveries) ? player.lifetimeDiscoveries : {}).length,
    weeklyComplete,
    routeRank: {
      id: routeRank.id,
      number: routeRank.number
    }
  };
}

function cleanCloudText(value, maximum = 80) {
  const text = String(value ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text && text.length <= maximum ? text : null;
}

function circuitCourseForRun(run) {
  return run?.path === "crazy"
    ? cosmosCircuitCrazyCourse(run.courseDayKey)
    : cosmosCircuitCourse(run?.courseDayKey);
}

function circuitSegmentStart(course, index) {
  let elapsedMs = 0;
  for (let cursor = 0; cursor < index; cursor += 1) elapsedMs += course.segments[cursor].durationMs;
  return elapsedMs;
}

function circuitCheckpointFor(course, segment, startMs) {
  const endMs = startMs + segment.durationMs;
  const type = segment.kind === "planet-gate"
    ? "gate"
    : segment.kind === "black-hole"
      ? "blackHole"
      : segment.kind === "ability-gate"
        ? "beacon"
        : "";
  const checkpoint = type
    ? course.checkpoints.find((candidate) =>
        candidate.type === type && candidate.at >= startMs && candidate.at < endMs
      )
    : null;
  if (checkpoint) return checkpoint;
  const angle = ((course.seed + segment.index * 7919) % 628) / 100;
  return {
    id: `field-${segment.index}`,
    type: "asteroid",
    at: startMs + Math.floor(segment.durationMs / 2),
    x: clamp(0.5 + Math.sin(angle) * 0.28, 0.18, 0.82),
    y: clamp(0.5 + Math.cos(angle * 1.7) * 0.28, 0.18, 0.82),
    radius: 0.12
  };
}

function circuitAbilityOptions(course, segment) {
  const offset = (course.seed + segment.index) % CIRCUIT_BOOSTS.length;
  return new Set([
    CIRCUIT_BOOSTS[offset],
    CIRCUIT_BOOSTS[(offset + 2) % CIRCUIT_BOOSTS.length]
  ]);
}

function circuitPositionAt(samples, progressMs) {
  if (progressMs <= samples[0].progressMs) return samples[0];
  const last = samples.at(-1);
  if (progressMs >= last.progressMs) return last;
  for (let index = 1; index < samples.length; index += 1) {
    const right = samples[index];
    if (right.progressMs < progressMs) continue;
    const left = samples[index - 1];
    const span = right.progressMs - left.progressMs;
    const ratio = span > 0 ? (progressMs - left.progressMs) / span : 0;
    return {
      x: left.x + (right.x - left.x) * ratio,
      y: left.y + (right.y - left.y) * ratio
    };
  }
  return last;
}

function deriveCircuitCheckpoint(course, segment, samples, useAbility) {
  const startMs = circuitSegmentStart(course, segment.index);
  const target = circuitCheckpointFor(course, segment, startMs);
  const endpoint = samples.at(-1);
  const radius = target.radius * (useAbility === "phase" ? 1.55 : 1);
  const distance = Math.hypot(endpoint.x - target.x, endpoint.y - target.y);
  let outcome = distance <= radius * 0.48
    ? "perfect"
    : distance <= radius
      ? "clear"
      : distance <= radius * 1.38
        ? "near-miss"
        : "miss";
  if (useAbility === "shield"
    && outcome === "miss"
    && ["black-hole", "asteroid-field"].includes(segment.kind)) {
    outcome = "near-miss";
  }

  const dustThreshold = useAbility === "magnet" ? 0.2 : 0.075;
  const dust = course.checkpoints.filter((checkpoint) =>
    checkpoint.type === "stardust"
    && checkpoint.at >= startMs
    && checkpoint.at < startMs + segment.durationMs
  );
  const collected = dust.filter((checkpoint) => {
    const position = circuitPositionAt(samples, checkpoint.at - startMs);
    return Math.hypot(position.x - checkpoint.x, position.y - checkpoint.y) <= dustThreshold + 0.012;
  }).length;
  const stardust = dust.length
    ? Math.round((collected / dust.length) * segment.stardust)
    : 0;
  return { outcome, stardust };
}

function sanitizeCircuitBoosts(raw) {
  const source = isRecord(raw) ? raw : {};
  return Object.fromEntries(CIRCUIT_BOOSTS.map((boost) => [
    boost,
    clamp(Math.floor(Number(source[boost]) || 0), 0, MAX_CIRCUIT_BOOSTS)
  ]));
}

function canonicalCircuitTelemetryEvent(event, sequence) {
  return JSON.stringify([
    sequence,
    String(event?.segmentId || ""),
    String(event?.outcome || ""),
    Number(event?.stardust) || 0,
    String(event?.ability || ""),
    String(event?.useAbility || ""),
    Number(event?.elapsedMs) || 0,
    (Array.isArray(event?.samples) ? event.samples : []).map((sample) => [
      Number(sample?.elapsedMs) || 0,
      Number(sample?.progressMs) || 0,
      Number(sample?.x) || 0,
      Number(sample?.y) || 0
    ])
  ]);
}

export function chainCircuitTelemetry(events, seed) {
  if (!CIRCUIT_TELEMETRY_SEED_PATTERN.test(String(seed || ""))) {
    throw new TypeError("A signed Circuit telemetry seed is required.");
  }
  let previous = String(seed);
  return (Array.isArray(events) ? events : []).map((event, sequence) => {
    const chain = createHash("sha256")
      .update(`${previous}\0${canonicalCircuitTelemetryEvent(event, sequence)}`)
      .digest("hex");
    previous = chain;
    return { ...structuredClone(event), sequence, chain };
  });
}

function sanitizeCircuitGrant(raw) {
  if (!isRecord(raw)) return null;
  const tiers = ["drift", "orbit", "nebula", "galaxy", "cosmos", "crazy"];
  const tier = tiers.includes(raw.tier) ? raw.tier : "";
  const milestone = tiers.includes(raw.milestone) ? raw.milestone : tier;
  const runId = cleanCloudText(raw.runId, 80);
  if (!tier || !milestone || !runId) return null;
  const crazyRewardChoice = tier === "crazy" && CRAZY_PATH_REWARD_CHOICES.includes(raw.crazyRewardChoice)
    ? raw.crazyRewardChoice
    : "";
  return {
    runId,
    milestone,
    firstCosmosOfWeek: raw.firstCosmosOfWeek === true,
    tier,
    crazyRewardChoice,
    totalPerBoost: clamp(Math.floor(Number(raw.totalPerBoost) || 0), 0, MAX_CIRCUIT_BOOSTS),
    grantedDays: crazyRewardChoice === "daily"
      ? clamp(Math.floor(Number(raw.grantedDays) || 0), 0, CRAZY_PATH_DAILY_DAYS)
      : 0,
    stipend: crazyRewardChoice === "daily" ? sanitizeCrazyPathStipend(raw.stipend) : sanitizeCrazyPathStipend(null),
    boosts: sanitizeCircuitBoosts(raw.boosts),
    starPathXp: clamp(Math.floor(Number(raw.starPathXp) || 0), 0, 10_000),
    starPathBaseXp: clamp(Math.floor(Number(raw.starPathBaseXp) || 0), 0, 10_000),
    starPathWeeklyBonusXp: clamp(Math.floor(Number(raw.starPathWeeklyBonusXp) || 0), 0, 10_000),
    cosmeticMasteryXp: clamp(Math.floor(Number(raw.cosmeticMasteryXp) || 0), 0, 10_000)
  };
}

function sanitizeCircuitResult(raw) {
  if (!isRecord(raw)) return null;
  const runId = cleanCloudText(raw.runId, 80);
  const courseId = cleanCloudText(raw.courseId, 80);
  const weekKey = /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(String(raw.weekKey || "")) ? String(raw.weekKey) : "";
  const path = raw.path === "crazy" ? "crazy" : "standard";
  const milestone = ["none", "drift", "orbit", "nebula", "galaxy", "cosmos", "crazy"].includes(raw.milestone)
    ? raw.milestone
    : "none";
  if (!runId || !courseId || !weekKey) return null;
  return {
    runId,
    courseId,
    weekKey,
    path,
    milestone,
    tier: milestone,
    stars: clamp(Math.floor(Number(raw.stars) || 0), 0, 3),
    score: clamp(Math.floor(Number(raw.score) || 0), 0, 100_000_000),
    rewardEligible: raw.rewardEligible === true,
    verificationRequired: raw.verificationRequired === true
  };
}

function sanitizeCircuitReceipt(raw) {
  if (!isRecord(raw)) return null;
  const attemptId = cleanCloudText(raw.attemptId, 80);
  const idempotencyKey = cleanCloudText(raw.idempotencyKey, 100);
  const candidateStartKey = cleanCloudText(raw.startIdempotencyKey, 100);
  const startMode = ["ticketed", "practice"].includes(raw.startMode) ? raw.startMode : "";
  const startPath = startMode === "ticketed" && raw.startPath === "crazy" ? "crazy" : "standard";
  const startIdempotencyKey = startMode && CIRCUIT_IDEMPOTENCY_PATTERN.test(candidateStartKey || "")
    ? candidateStartKey
    : "";
  const startPracticeBoost = startMode === "practice" && CIRCUIT_BOOSTS.includes(raw.startPracticeBoost)
    ? raw.startPracticeBoost
    : "";
  const attemptToken = String(raw.attemptToken || "");
  const submittedAt = Number.isFinite(Date.parse(raw.submittedAt || "")) ? new Date(raw.submittedAt).toISOString() : "";
  const result = sanitizeCircuitResult(raw.result);
  if (!attemptId || !CIRCUIT_IDEMPOTENCY_PATTERN.test(idempotencyKey || "") || !CIRCUIT_ATTEMPT_TOKEN_PATTERN.test(attemptToken) || !submittedAt || !result) return null;
  return {
    attemptId,
    idempotencyKey,
    startIdempotencyKey,
    startMode,
    startPath,
    startPracticeBoost,
    attemptToken,
    submittedAt,
    abandoned: raw.abandoned === true,
    result,
    grant: sanitizeCircuitGrant(raw.grant)
  };
}

function sanitizeCircuitAttempt(raw) {
  if (!isRecord(raw)) return null;
  const run = sanitizeCircuitRun(raw.run);
  const idempotencyKey = cleanCloudText(raw.idempotencyKey, 100);
  const expiresAt = Number.isFinite(Date.parse(raw.expiresAt || "")) ? new Date(raw.expiresAt).toISOString() : "";
  if (!run || run.status !== "active" || !CIRCUIT_IDEMPOTENCY_PATTERN.test(idempotencyKey || "") || !expiresAt) return null;
  return {
    idempotencyKey,
    expiresAt,
    telemetrySeed: CIRCUIT_TELEMETRY_SEED_PATTERN.test(String(raw.telemetrySeed || ""))
      ? String(raw.telemetrySeed)
      : randomBytes(32).toString("hex"),
    run
  };
}

function createPlayerCircuitState(raw = {}) {
  const source = isRecord(raw) ? raw : {};
  const receipts = (Array.isArray(source.receipts) ? source.receipts : [])
    .map(sanitizeCircuitReceipt)
    .filter(Boolean)
    .slice(-MAX_CIRCUIT_RECEIPTS);
  return {
    version: COSMOS_CIRCUIT_VERSION,
    wallet: sanitizeCircuitWallet(source.wallet),
    claims: sanitizeCircuitClaims(source.claims),
    boosts: sanitizeCircuitBoosts(source.boosts),
    crazyStipend: sanitizeCrazyPathStipend(source.crazyStipend),
    activeAttempt: sanitizeCircuitAttempt(source.activeAttempt),
    receipts
  };
}

function sanitizeStarPathRewards(raw) {
  const rewards = [];
  const seen = new Set();
  for (const value of Array.isArray(raw) ? raw.slice(-MAX_STAR_PATH_REWARDS * 2) : []) {
    const id = cleanCloudText(value, 180);
    if (!id || !starPathRewardById(id) || seen.has(id)) continue;
    seen.add(id);
    rewards.push(id);
  }
  return rewards.slice(-MAX_STAR_PATH_REWARDS);
}

function cleanCombinationReportConcept(value, { optional = false } = {}) {
  if (typeof value !== "string") {
    if (optional && (value === null || value === undefined)) return "";
    throw serviceError(400, "Combination reports use short word fields only.", "invalid_combination_report_text");
  }
  if (/[\u0000-\u001f\u007f\u2028\u2029]/u.test(value)) {
    throw serviceError(400, "Combination reports cannot contain line breaks or control characters.", "unsafe_combination_report_text");
  }
  if (/(?:https?:\/\/|www\.|mailto:)|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|\b[\p{L}\p{N}-]+\.(?:app|bg|co|com|dev|eu|gg|io|me|net|org)\b/iu.test(value)) {
    throw serviceError(400, "Do not include links, email addresses, or private contact details.", "unsafe_combination_report_text");
  }
  const clean = value.normalize("NFKC").replace(/ +/g, " ").trim();
  if (!clean && optional) return "";
  if (!clean || clean.length > 28 || clean.split(/\s+/u).length > 4 || !/^[\p{L}\p{N}][\p{L}\p{N} '&-]*$/u.test(clean)) {
    throw serviceError(400, "Use a short word or phrase of up to 28 characters.", "invalid_combination_report_text");
  }
  return clean;
}

function normalizeDynamicRecipeRecord(value, key = "") {
  if (!isRecord(value)) return null;
  const a = cleanCloudText(value.a, 28);
  const b = cleanCloudText(value.b, 28);
  const word = cleanCloudText(value.word, 28);
  const emoji = cleanCloudText(value.emoji, 12);
  const note = cleanCloudText(value.note, 100);
  if (!a || !b || !word || !emoji || !note) return null;
  const status = ["quarantined", "promoted", "rejected", "rolled_back"].includes(value.status) ? value.status : "quarantined";
  return {
    proposalId: /^[A-Za-z0-9_-]{16,64}$/.test(String(value.proposalId || "")) ? String(value.proposalId) : createHash("sha256").update(`${key}:${a}:${b}:${word}`).digest("base64url").slice(0, 24),
    a,
    b,
    word,
    emoji,
    note,
    source: value.source === "ai-route" ? "ai-route" : "ai",
    status,
    promptVersion: cleanCloudText(value.promptVersion, 64) || "legacy-unversioned",
    model: cleanCloudText(value.model, 80) || "unknown",
    provenance: cleanCloudText(value.provenance, 80) || "ai-generated",
    revision: Math.max(1, Math.floor(Number(value.revision) || 1)),
    createdAt: typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt)) ? new Date(value.createdAt).toISOString() : new Date(0).toISOString(),
    generatedAt: typeof value.generatedAt === "string" && Number.isFinite(Date.parse(value.generatedAt)) ? new Date(value.generatedAt).toISOString() : null,
    lastUsedAt: typeof value.lastUsedAt === "string" && Number.isFinite(Date.parse(value.lastUsedAt)) ? new Date(value.lastUsedAt).toISOString() : null,
    reviewedAt: typeof value.reviewedAt === "string" && Number.isFinite(Date.parse(value.reviewedAt)) ? new Date(value.reviewedAt).toISOString() : null,
    reviewedBy: cleanCloudText(value.reviewedBy, 80),
    reviewReason: cleanCloudText(value.reviewReason, 160)
  };
}

function normalizeDynamicRecipeCatalog(raw) {
  const entries = [];
  for (const [key, value] of Object.entries(isRecord(raw) ? raw : {})) {
    const record = normalizeDynamicRecipeRecord(value, key);
    if (record) entries.push([key, record]);
  }
  entries.sort((left, right) => Date.parse(right[1].lastUsedAt || right[1].createdAt) - Date.parse(left[1].lastUsedAt || left[1].createdAt));
  return Object.fromEntries(entries.slice(0, 1_000));
}

function sanitizeCloudJourneys(raw, { currentEvent = null, authoritativeEventProgress = null } = {}) {
  assertAllowedKeys(raw, new Set(["eventProgress", "selectedVoyageId", "voyageProgress"]));
  const journeys = {};

  if ("selectedVoyageId" in raw) {
    const selectedVoyageId = String(raw.selectedVoyageId || "").trim().toLowerCase();
    if (!CLOUD_VOYAGES.has(selectedVoyageId)) throw serviceError(400, "That Constellation Voyage is not available.", "invalid_cloud_profile");
    journeys.selectedVoyageId = selectedVoyageId;
  }

  if ("voyageProgress" in raw) {
    assertAllowedKeys(raw.voyageProgress, new Set(["version", "voyages"]));
    if (raw.voyageProgress.version !== 1 || !isRecord(raw.voyageProgress.voyages)) {
      throw serviceError(400, "Constellation Voyage progress is not valid.", "invalid_cloud_profile");
    }
    for (const [voyageId, progress] of Object.entries(raw.voyageProgress.voyages)) {
      const voyage = CLOUD_VOYAGES.get(voyageId);
      if (!voyage) throw serviceError(400, "Constellation Voyage progress contains an unknown voyage.", "invalid_cloud_profile");
      assertAllowedKeys(progress, new Set(["completed"]));
      if (!Number.isInteger(progress.completed) || progress.completed < 0 || progress.completed > voyage.chapters.length) {
        throw serviceError(400, "Constellation Voyage chapter progress is not valid.", "invalid_cloud_profile");
      }
    }
    journeys.voyageProgress = sanitizeVoyageProgress(raw.voyageProgress);
  }

  if ("eventProgress" in raw) {
    assertAllowedKeys(raw.eventProgress, new Set(["eventId", "rewarded", "weekKey", "words"]));
    const eventId = String(raw.eventProgress.eventId || "").trim().toLowerCase();
    const weekKey = String(raw.eventProgress.weekKey || "").trim();
    const rewarded = raw.eventProgress.rewarded;
    if (typeof rewarded !== "boolean" || !Array.isArray(raw.eventProgress.words) || raw.eventProgress.words.length > 12) {
      throw serviceError(400, "Cosmic Event progress is not valid.", "invalid_cloud_profile");
    }
    if (!eventId) {
      if (weekKey || raw.eventProgress.words.length || rewarded) throw serviceError(400, "Empty Cosmic Event progress cannot contain discoveries.", "invalid_cloud_profile");
      journeys.eventProgress = authoritativeEventProgress
        ? structuredClone(authoritativeEventProgress)
        : { weekKey: "", eventId: "", words: [], rewarded: false };
    } else {
      const event = CLOUD_EVENTS.get(eventId);
      if (!event || !/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(weekKey)) throw serviceError(400, "Cosmic Event identity is not valid.", "invalid_cloud_profile");
      if (currentEvent && (eventId !== currentEvent.id || weekKey !== currentEvent.weekKey)) {
        throw serviceError(409, "That Cosmic Event has ended. Refresh the current event before syncing.", "cosmic_event_stale", {
          current: { eventId: currentEvent.id, weekKey: currentEvent.weekKey, endsAt: currentEvent.endsAt }
        });
      }
      const allowedWords = new Map(event.collection.words.map((word) => [word.toLocaleLowerCase("en-US"), word]));
      const words = [];
      const seen = new Set();
      for (const rawWord of raw.eventProgress.words) {
        const word = cleanCloudText(rawWord);
        const key = word?.toLocaleLowerCase("en-US") || "";
        const canonical = allowedWords.get(key);
        if (!canonical) throw serviceError(400, "Cosmic Event progress contains an unrelated word.", "invalid_cloud_profile");
        if (!seen.has(key)) {
          seen.add(key);
          words.push(canonical);
        }
      }
      const collection = cosmicEventCollectionProgress(event, words);
      if (!authoritativeEventProgress && rewarded && !collection.complete) throw serviceError(400, "A Cosmic Event reward requires the complete collection.", "invalid_cloud_profile");
      // Collection discoveries and reward claims are derived from server-observed
      // play. Client values are validated above for compatibility, but can never
      // mint progress or a reward receipt.
      journeys.eventProgress = authoritativeEventProgress
        ? structuredClone(authoritativeEventProgress)
        : { weekKey, eventId, words, rewarded };
    }
  }

  return journeys;
}

function sanitizeCloudSignatureBests(raw) {
  if (!Array.isArray(raw) || raw.length > 120) throw serviceError(400, "Signature Route history is too large.", "invalid_cloud_profile");
  const byScope = new Map();
  for (const candidate of raw) {
    assertAllowedKeys(candidate, CLOUD_SIGNATURE_FIELDS);
    assertAllowedKeys(candidate.dimensions, new Set(["efficiency", "novelty", "purity", "variety"]));
    const signature = sanitizeRouteSignature(candidate);
    if (!signature || !signature.scoreEligible) throw serviceError(400, "A Signature Route personal best is not valid.", "invalid_cloud_profile");
    const previous = byScope.get(signature.scopeKey);
    byScope.set(signature.scopeKey, previous ? comparePersonalBest(signature, previous).best : signature);
  }
  return [...byScope.values()];
}

function sanitizeCloudProfile(raw, {
  founder = false,
  cosmeticOwnership = null,
  currentEvent = null,
  authoritativeEventProgress = null
} = {}) {
  assertAllowedKeys(raw, CLOUD_PROFILE_FIELDS);
  const profile = {};
  const ownership = {
    ...(isRecord(cosmeticOwnership) ? cosmeticOwnership : {}),
    founder: Boolean(founder || cosmeticOwnership?.supporter)
  };

  if ("theme" in raw) {
    if (!CLOUD_THEMES.has(raw.theme)) throw serviceError(400, "That cloud theme is not available.", "invalid_cloud_profile");
    const cosmeticTheme = cosmeticById(raw.theme, "uiFinish");
    if (cosmeticTheme && !isCosmeticOwned(cosmeticTheme, ownership)) {
      throw serviceError(403, "That theme is not owned by this account.", "cosmetic_entitlement_required");
    }
    profile.theme = raw.theme;
  }
  if ("cosmetics" in raw) {
    assertAllowedKeys(raw.cosmetics, CLOUD_COSMETIC_SLOTS);
    for (const [slot, value] of Object.entries(raw.cosmetics)) {
      const canonicalSlot = canonicalCosmeticSlot(slot);
      const item = cosmeticById(value, canonicalSlot);
      if (!canonicalSlot || !item) {
        throw serviceError(400, "That cloud cosmetic is not available for this slot.", "invalid_cloud_profile");
      }
      if (!isCosmeticOwned(item, ownership)) {
        throw serviceError(403, "That cosmetic is not owned by this account.", "cosmetic_entitlement_required");
      }
    }
    profile.cosmetics = sanitizeCosmeticLoadout(migrateCosmeticLoadout(raw.cosmetics), ownership);
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
    const allowed = new Set(["haptics", "music", "musicVolume", "muted", "resultDetails", "sfxVolume", "sound", "volume"]);
    assertAllowedKeys(raw.feedbackPreferences, allowed);
    const preferences = raw.feedbackPreferences;
    for (const field of ["sound", "music", "haptics", "resultDetails", "muted"]) {
      if (field in preferences && typeof preferences[field] !== "boolean") throw serviceError(400, "Feedback preferences must use true or false.", "invalid_cloud_profile");
    }
    for (const field of ["volume", "musicVolume", "sfxVolume"]) {
      if (field in preferences && (!Number.isFinite(preferences[field]) || preferences[field] < 0 || preferences[field] > 1)) {
        throw serviceError(400, "Feedback volumes must be between zero and one.", "invalid_cloud_profile");
      }
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
    const fields = new Set(["dailyCompleted", "dailyStreak", "lastDailyDate", "rewardedRunIds", "stardust", "streakShields", "wins"]);
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
    if ("rewardedRunIds" in progression) {
      if (!Array.isArray(progression.rewardedRunIds) || progression.rewardedRunIds.length > 512) {
        throw serviceError(400, "Cloud rewarded-run history is too large.", "invalid_cloud_profile");
      }
      const ids = [];
      const seen = new Set();
      for (const value of progression.rewardedRunIds) {
        const id = String(value || "").trim().toLowerCase();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
          throw serviceError(400, "Cloud rewarded-run IDs are not valid.", "invalid_cloud_profile");
        }
        if (!seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
      profile.progression.rewardedRunIds = ids;
    }
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
  if ("journeys" in raw) profile.journeys = sanitizeCloudJourneys(raw.journeys, { currentEvent, authoritativeEventProgress });
  if ("signatureBests" in raw) profile.signatureBests = sanitizeCloudSignatureBests(raw.signatureBests);

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

function normalizeLifetimeDiscoveryLedger(raw) {
  const entries = [];
  for (const [digest, seenAt] of Object.entries(isRecord(raw) ? raw : {})) {
    if (!DISCOVERY_DIGEST_PATTERN.test(digest)) continue;
    const timestamp = typeof seenAt === "string" && Number.isFinite(Date.parse(seenAt)) ? new Date(seenAt).toISOString() : null;
    if (timestamp) entries.push([digest, timestamp]);
  }
  entries.sort((left, right) => Date.parse(left[1]) - Date.parse(right[1]));
  return Object.fromEntries(entries.slice(-MAX_LIFETIME_DISCOVERIES));
}

function normalizeCosmicEventRewardLedger(raw) {
  const entries = [];
  for (const [key, value] of Object.entries(isRecord(raw) ? raw : {})) {
    if (!validCosmicEventLedgerKey(key) || !isRecord(value)) continue;
    const eventId = key.slice(key.indexOf(":") + 1);
    const claimedAt = typeof value.claimedAt === "string" && Number.isFinite(Date.parse(value.claimedAt))
      ? new Date(value.claimedAt).toISOString()
      : null;
    if (!CLOUD_EVENTS.has(eventId) || !claimedAt) continue;
    const cloudCreditedAt = typeof value.cloudCreditedAt === "string" && Number.isFinite(Date.parse(value.cloudCreditedAt))
      ? new Date(value.cloudCreditedAt).toISOString()
      : null;
    entries.push([key, {
      claimedAt,
      kind: "stardust",
      amount: COSMIC_EVENT_COLLECTION_REWARD,
      ...(cloudCreditedAt ? { cloudCreditedAt } : {})
    }]);
  }
  entries.sort((left, right) => Date.parse(right[1].claimedAt) - Date.parse(left[1].claimedAt));
  return Object.fromEntries(entries.slice(0, MAX_COSMIC_EVENT_REWARDS));
}

function isoWeekStartDate(weekKey) {
  const match = /^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/.exec(String(weekKey || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthDay = januaryFourth.getUTCDay() || 7;
  const monday = new Date(Date.UTC(year, 0, 4 - januaryFourthDay + 1 + (week - 1) * 7));
  return currentCosmicEvent(monday).weekKey === weekKey ? monday : null;
}

function validCosmicEventLedgerKey(key) {
  if (!COSMIC_EVENT_REWARD_KEY_PATTERN.test(key)) return false;
  const separator = key.indexOf(":");
  const weekKey = key.slice(0, separator);
  const eventId = key.slice(separator + 1);
  const weekStart = isoWeekStartDate(weekKey);
  return Boolean(weekStart && currentCosmicEvent(weekStart).id === eventId);
}

function normalizeCosmicEventDiscoveryLedger(raw) {
  const entries = [];
  for (const [key, value] of Object.entries(isRecord(raw) ? raw : {})) {
    if (!validCosmicEventLedgerKey(key) || !isRecord(value)) continue;
    const eventId = key.slice(key.indexOf(":") + 1);
    const event = CLOUD_EVENTS.get(eventId);
    const allowed = new Map(event.collection.words.map((word) => [word.toLocaleLowerCase("en-US"), word]));
    const words = [];
    const seen = new Set();
    for (const candidate of Array.isArray(value.words) ? value.words.slice(0, 12) : []) {
      const canonical = allowed.get(cleanCloudText(candidate, 80)?.toLocaleLowerCase("en-US") || "");
      if (canonical && !seen.has(canonical)) {
        seen.add(canonical);
        words.push(canonical);
      }
    }
    const updatedAt = typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt))
      ? new Date(value.updatedAt).toISOString()
      : isoWeekStartDate(key.slice(0, key.indexOf(":")))?.toISOString();
    if (updatedAt) entries.push([key, { words, updatedAt }]);
  }
  entries.sort((left, right) => Date.parse(right[1].updatedAt) - Date.parse(left[1].updatedAt));
  return Object.fromEntries(entries.slice(0, MAX_COSMIC_EVENT_REWARDS));
}

// Runtime persistence is deliberately behind this small contract. The JSON
// adapter remains the zero-configuration beta default; a transactional adapter
// can implement load(), save(), health(), and kind without changing game rules.
export class JsonGameStorage {
  constructor(path = ":memory:") {
    this.path = path;
    this.kind = path === ":memory:" ? "memory" : "json";
    this.commerceSafe = false;
    this.ready = true;
    this.lastError = null;
  }

  async load() {
    if (this.path === ":memory:") return null;
    try {
      return JSON.parse(await readFile(this.path, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      this.ready = false;
      this.lastError = error.code || "read_failed";
      throw error;
    }
  }

  async save(data) {
    if (this.path === ":memory:") return;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(data, null, 2), "utf8");
      await rename(temporary, this.path);
      this.ready = true;
      this.lastError = null;
    } catch (error) {
      this.ready = false;
      this.lastError = error.code || "write_failed";
      throw error;
    }
  }

  health() {
    return {
      kind: this.kind,
      ready: this.ready,
      commerceSafe: this.commerceSafe === true,
      contractVersion: STORAGE_CONTRACT_VERSION,
      lastError: this.lastError
    };
  }
}

export class GameStore {
  constructor(path = ":memory:", { clock = () => new Date(), storage = null } = {}) {
    this.path = path;
    this.clock = typeof clock === "function" ? clock : () => new Date();
    this.storage = storage || new JsonGameStorage(path);
    if (!this.storage || typeof this.storage.load !== "function" || typeof this.storage.save !== "function") {
      throw new TypeError("Storage adapters must implement load() and save().");
    }
    this.data = {
      version: 12,
      secret: "",
      players: {},
      scores: [],
      demand: {},
      interest: emptyInterestData(),
      analytics: emptyAnalyticsData(),
      rejectedPairs: emptyRejectedPairData(),
      recipeFeedback: emptyRecipeFeedback(),
      runs: {},
      runLedger: [],
      progressionLedger: [],
      economyLedger: [],
      entitlementLedger: [],
      duels: {},
      duelResults: [],
      duelRatingLedger: [],
      commerceTransactions: {},
      dynamicRecipes: {},
      dynamicRecipeRevisions: []
    };
    this.writeQueue = Promise.resolve();
  }

  async init() {
    {
      const parsed = await this.storage.load();
      if (parsed && typeof parsed === "object") this.data = {
          ...this.data,
          ...parsed,
          version: 12,
          players: parsed.players || {},
          scores: parsed.scores || [],
          demand: parsed.demand || {},
          interest: normalizeInterestData(parsed.interest),
          analytics: normalizeAnalyticsData(parsed.analytics),
          rejectedPairs: normalizeRejectedPairData(parsed.rejectedPairs),
          recipeFeedback: normalizeRecipeFeedback(parsed.recipeFeedback),
          runs: parsed.runs && typeof parsed.runs === "object" && !Array.isArray(parsed.runs) ? parsed.runs : {},
          runLedger: Array.isArray(parsed.runLedger) ? parsed.runLedger.slice(-MAX_LEDGER_ENTRIES) : [],
          progressionLedger: Array.isArray(parsed.progressionLedger) ? parsed.progressionLedger.slice(-MAX_LEDGER_ENTRIES) : [],
          economyLedger: Array.isArray(parsed.economyLedger) ? parsed.economyLedger.slice(-MAX_LEDGER_ENTRIES) : [],
          entitlementLedger: Array.isArray(parsed.entitlementLedger) ? parsed.entitlementLedger.slice(-MAX_LEDGER_ENTRIES) : [],
          duels: parsed.duels && typeof parsed.duels === "object" && !Array.isArray(parsed.duels) ? parsed.duels : {},
          duelResults: Array.isArray(parsed.duelResults) ? parsed.duelResults.slice(-5_000) : [],
          duelRatingLedger: Array.isArray(parsed.duelRatingLedger) ? parsed.duelRatingLedger.slice(-MAX_LEDGER_ENTRIES) : [],
          commerceTransactions: parsed.commerceTransactions && typeof parsed.commerceTransactions === "object" && !Array.isArray(parsed.commerceTransactions) ? parsed.commerceTransactions : {},
          dynamicRecipes: normalizeDynamicRecipeCatalog(parsed.dynamicRecipes),
          dynamicRecipeRevisions: Array.isArray(parsed.dynamicRecipeRevisions) ? parsed.dynamicRecipeRevisions.slice(-MAX_LEDGER_ENTRIES) : []
        };
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
      const lifetimeDiscoveries = normalizeLifetimeDiscoveryLedger(player.lifetimeDiscoveries);
      if (JSON.stringify(player.lifetimeDiscoveries || {}) !== JSON.stringify(lifetimeDiscoveries)) {
        player.lifetimeDiscoveries = lifetimeDiscoveries;
        playersMigrated = true;
      }
      const cosmicEventRewards = normalizeCosmicEventRewardLedger(player.cosmicEventRewards);
      if (JSON.stringify(player.cosmicEventRewards || {}) !== JSON.stringify(cosmicEventRewards)) {
        player.cosmicEventRewards = cosmicEventRewards;
        playersMigrated = true;
      }
      const cosmicEventDiscoveries = normalizeCosmicEventDiscoveryLedger(player.cosmicEventDiscoveries);
      if (JSON.stringify(player.cosmicEventDiscoveries || {}) !== JSON.stringify(cosmicEventDiscoveries)) {
        player.cosmicEventDiscoveries = cosmicEventDiscoveries;
        playersMigrated = true;
      }
      const routeProgression = sanitizeRemixProgressionState(
        player.routeProgression ?? createRemixProgressionState()
      );
      if (JSON.stringify(player.routeProgression || {}) !== JSON.stringify(routeProgression)) {
        player.routeProgression = routeProgression;
        playersMigrated = true;
      }
      const remixReadiness = sanitizeRemixReadinessState(
        player.remixReadiness ?? createRemixReadinessState()
      );
      if (JSON.stringify(player.remixReadiness || {}) !== JSON.stringify(remixReadiness)) {
        player.remixReadiness = remixReadiness;
        playersMigrated = true;
      }
      const adaptiveDifficulty = sanitizeAdaptiveDifficultyState(
        player.adaptiveDifficulty ?? createAdaptiveDifficultyState()
      );
      if (JSON.stringify(player.adaptiveDifficulty || {}) !== JSON.stringify(adaptiveDifficulty)) {
        player.adaptiveDifficulty = adaptiveDifficulty;
        playersMigrated = true;
      }
      const duelRating = sanitizeDuelRating(player.duelRating);
      if (JSON.stringify(player.duelRating || {}) !== JSON.stringify(duelRating)) {
        player.duelRating = duelRating;
        playersMigrated = true;
      }
      const scrambleArena = sanitizeScrambleArena(player.scrambleArena, {
        legacyDuelRating: duelRating,
        seasonId: DUEL_SEASON_ID
      });
      if (JSON.stringify(player.scrambleArena || {}) !== JSON.stringify(scrambleArena)) {
        player.scrambleArena = structuredClone(scrambleArena);
        playersMigrated = true;
      }
      const targetRaceRating = sanitizeDuelRating(
        scrambleRatingForMode(scrambleArena, SCRAMBLE_DEFAULT_MODE_ID),
        DUEL_SEASON_ID
      );
      if (JSON.stringify(player.duelRating || {}) !== JSON.stringify(targetRaceRating)) {
        player.duelRating = targetRaceRating;
        playersMigrated = true;
      }
      const duelEligibility = sanitizeDuelEligibility(player.duelEligibility);
      if (JSON.stringify(player.duelEligibility || {}) !== JSON.stringify(duelEligibility)) {
        player.duelEligibility = duelEligibility;
        playersMigrated = true;
      }
      const circuit = createPlayerCircuitState(player.circuit);
      circuit.wallet = grantDailyLaunchPasses(circuit.wallet, this.now()).wallet;
      if (JSON.stringify(player.circuit || {}) !== JSON.stringify(circuit)) {
        player.circuit = circuit;
        playersMigrated = true;
      }
      const starPath = sanitizeStarPathState(player.starPath, this.now());
      if (JSON.stringify(player.starPath || {}) !== JSON.stringify(starPath)) {
        player.starPath = starPath;
        playersMigrated = true;
      }
      const starPathRewards = sanitizeStarPathRewards(player.starPathRewards);
      if (JSON.stringify(player.starPathRewards || []) !== JSON.stringify(starPathRewards)) {
        player.starPathRewards = starPathRewards;
        playersMigrated = true;
      }
      if (!player.entitlements || typeof player.entitlements !== "object" || Array.isArray(player.entitlements)) {
        player.entitlements = {};
        playersMigrated = true;
      }
      const cosmeticEntitlements = normalizePlayerCosmeticEntitlements(player.cosmeticEntitlements);
      if (JSON.stringify(player.cosmeticEntitlements || {}) !== JSON.stringify(cosmeticEntitlements)) {
        player.cosmeticEntitlements = cosmeticEntitlements;
        playersMigrated = true;
      }
      const cosmeticProgress = authoritativeCosmeticProgress(player, this.data.runLedger);
      if (cosmeticProgress.discoveries >= 25) playersMigrated = recordEarnedCosmeticUnlock(player, "discoveries") || playersMigrated;
      if (cosmeticProgress.wins >= 1) playersMigrated = recordEarnedCosmeticUnlock(player, "wins") || playersMigrated;
      if (cosmeticProgress.weeklyComplete) playersMigrated = recordEarnedCosmeticUnlock(player, "weeklyComplete") || playersMigrated;
      if (!Number.isInteger(player.authVersion) || player.authVersion < 0) {
        // Version zero preserves bearer compatibility for stores created before
        // recoverable accounts were introduced.
        player.authVersion = 0;
        playersMigrated = true;
      }
      if (!isRecord(player.sessions)) {
        player.sessions = {};
        playersMigrated = true;
      } else {
        const now = this.now().getTime();
        const sessions = Object.entries(player.sessions)
          .filter(([sessionId, record]) => /^[0-9a-f-]{36}$/i.test(sessionId) && isRecord(record) && Number.isFinite(Date.parse(record.expiresAt || "")))
          .filter(([, record]) => Date.parse(record.expiresAt) > now - 86400000)
          .sort((left, right) => Date.parse(right[1].issuedAt || 0) - Date.parse(left[1].issuedAt || 0))
          .slice(0, MAX_PLAYER_SESSIONS);
        const normalizedSessions = Object.fromEntries(sessions);
        if (JSON.stringify(player.sessions) !== JSON.stringify(normalizedSessions)) {
          player.sessions = normalizedSessions;
          playersMigrated = true;
        }
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
      if (isRecord(player.cloudProfile?.data?.cosmetics)) {
        const migratedCosmetics = sanitizeCosmeticLoadout(player.cloudProfile.data.cosmetics, {
          founder: Boolean(player.founderPass),
          itemIds: player.cosmeticEntitlements.items,
          collectionIds: player.cosmeticEntitlements.collections,
          progress: authoritativeCosmeticProgress(player, this.data.runLedger)
        });
        if (JSON.stringify(player.cloudProfile.data.cosmetics) !== JSON.stringify(migratedCosmetics)) {
          player.cloudProfile.data.cosmetics = migratedCosmetics;
          playersMigrated = true;
        }
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

  purposeKey(purpose) {
    return createHmac("sha256", this.data.secret).update(`constellore-purpose-key:v1:${String(purpose)}`).digest();
  }

  signFor(purpose, value) {
    return createHmac("sha256", this.purposeKey(purpose)).update(String(value)).digest("base64url");
  }

  verifyFor(purpose, value, signature) {
    if (typeof signature !== "string") return false;
    return safeDigestEqual(this.signFor(purpose, value), signature);
  }

  now() {
    const value = this.clock();
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isFinite(date.getTime()) ? date : new Date();
  }

  lifetimeDiscoveryDigest(word) {
    const canonical = cleanCloudText(word, 80)?.toLocaleLowerCase("en-US") || "";
    return canonical ? this.sign(`discovery:v1:${canonical}`) : "";
  }

  hasLifetimeDiscovery(playerId, word) {
    const player = this.data.players[playerId];
    const digest = this.lifetimeDiscoveryDigest(word);
    return Boolean(player && digest && isRecord(player.lifetimeDiscoveries) && player.lifetimeDiscoveries[digest]);
  }

  recordCosmicEventDiscovery(playerId, word, date = this.now()) {
    const player = this.data.players[playerId];
    if (!player) return { matched: false, recorded: false };
    const eventDate = date instanceof Date && Number.isFinite(date.getTime()) ? new Date(date.getTime()) : this.now();
    const event = currentCosmicEvent(eventDate);
    const canonical = event.collection.words.find((candidate) => candidate.toLocaleLowerCase("en-US") === cleanCloudText(word, 80)?.toLocaleLowerCase("en-US"));
    if (!canonical) return { matched: false, recorded: false, eventId: event.id, weekKey: event.weekKey };
    const key = `${event.weekKey}:${event.id}`;
    player.cosmicEventDiscoveries = normalizeCosmicEventDiscoveryLedger(player.cosmicEventDiscoveries);
    const record = player.cosmicEventDiscoveries[key] || { words: [], updatedAt: eventDate.toISOString() };
    const alreadyRecorded = record.words.some((candidate) => candidate.toLocaleLowerCase("en-US") === canonical.toLocaleLowerCase("en-US"));
    if (!alreadyRecorded) record.words.push(canonical);
    record.updatedAt = eventDate.toISOString();
    player.cosmicEventDiscoveries[key] = record;
    player.cosmicEventDiscoveries = normalizeCosmicEventDiscoveryLedger(player.cosmicEventDiscoveries);
    return { matched: true, recorded: !alreadyRecorded, eventId: event.id, weekKey: event.weekKey };
  }

  recordLifetimeDiscovery(playerId, word, date = this.now(), { eventEligible = false } = {}) {
    const player = this.data.players[playerId];
    const canonical = cleanCloudText(word, 80)?.toLocaleLowerCase("en-US") || "";
    const digest = this.lifetimeDiscoveryDigest(word);
    if (!player || !digest) return { newDiscovery: false, recorded: false };
    const eventDiscovery = eventEligible ? this.recordCosmicEventDiscovery(playerId, word, date) : { matched: false, recorded: false };
    if (COSMIC_EVENT_ORIGIN_WORDS.has(canonical)) return { newDiscovery: false, recorded: false, eventDiscovery, origin: true };
    player.lifetimeDiscoveries = normalizeLifetimeDiscoveryLedger(player.lifetimeDiscoveries);
    if (player.lifetimeDiscoveries[digest]) return { newDiscovery: false, recorded: false, eventDiscovery };
    if (Object.keys(player.lifetimeDiscoveries).length >= MAX_LIFETIME_DISCOVERIES) {
      // Fail closed at the safety cap so replaying an unrecorded result cannot
      // inflate Signature Route novelty.
      return { newDiscovery: false, recorded: false, capacityReached: true, eventDiscovery };
    }
    const seenAt = date instanceof Date && Number.isFinite(date.getTime()) ? date : this.now();
    player.lifetimeDiscoveries[digest] = seenAt.toISOString();
    if (Object.keys(player.lifetimeDiscoveries).length >= 25) {
      recordEarnedCosmeticUnlock(player, "discoveries");
    }
    return { newDiscovery: true, recorded: true, eventDiscovery };
  }

  cosmicEventState(playerId, date = this.now()) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const serverDate = date instanceof Date && Number.isFinite(date.getTime()) ? new Date(date.getTime()) : this.now();
    const event = currentCosmicEvent(serverDate);
    const eventKey = `${event.weekKey}:${event.id}`;
    player.cosmicEventDiscoveries = normalizeCosmicEventDiscoveryLedger(player.cosmicEventDiscoveries);
    const activeDiscoveries = new Set((player.cosmicEventDiscoveries[eventKey]?.words || []).map((word) => word.toLocaleLowerCase("en-US")));
    const found = event.collection.words.filter((word) => COSMIC_EVENT_ORIGIN_WORDS.has(word.toLocaleLowerCase("en-US")) || activeDiscoveries.has(word.toLocaleLowerCase("en-US")));
    const collection = cosmicEventCollectionProgress(event, found);
    const rewardKey = `${event.weekKey}:${event.id}`;
    player.cosmicEventRewards = normalizeCosmicEventRewardLedger(player.cosmicEventRewards);
    const receipt = player.cosmicEventRewards[rewardKey] || null;
    const rewarded = Boolean(receipt);
    return {
      serverTime: serverDate.toISOString(),
      event,
      progress: {
        weekKey: event.weekKey,
        eventId: event.id,
        words: collection.found,
        rewarded,
        collection
      },
      reward: {
        kind: "stardust",
        amount: COSMIC_EVENT_COLLECTION_REWARD,
        claimable: collection.complete && !rewarded,
        claimed: rewarded,
        claimedAt: receipt?.claimedAt || null
      }
    };
  }

  creditCosmicEventRewardInCloudProfile(playerId, amount, date = this.now()) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const reward = Math.max(0, Math.floor(Number(amount) || 0));
    if (!reward) return this.cloudProfile(playerId);
    const stored = this.cloudProfile(playerId);
    const data = isRecord(stored.profile) ? structuredClone(stored.profile) : {};
    const previous = isRecord(data.progression) ? data.progression : {};
    data.progression = {
      stardust: Math.min(1_000_000_000, Math.max(0, Math.floor(Number(previous.stardust) || 0)) + reward),
      wins: Math.min(1_000_000, Math.max(0, Math.floor(Number(previous.wins) || 0))),
      dailyStreak: Math.min(100_000, Math.max(0, Math.floor(Number(previous.dailyStreak) || 0))),
      lastDailyDate: /^\d{4}-\d{2}-\d{2}$/.test(String(previous.lastDailyDate || "")) ? previous.lastDailyDate : "",
      dailyCompleted: /^\d{4}-\d{2}-\d{2}$/.test(String(previous.dailyCompleted || "")) ? previous.dailyCompleted : "",
      streakShields: Math.min(1_000, Math.max(0, Math.floor(Number(previous.streakShields) || 0))),
      ...(Array.isArray(previous.rewardedRunIds) ? { rewardedRunIds: [...previous.rewardedRunIds] } : {})
    };
    const creditedAt = date instanceof Date && Number.isFinite(date.getTime()) ? date : this.now();
    player.cloudProfile = {
      version: stored.version + 1,
      data,
      updatedAt: creditedAt.toISOString()
    };
    return this.cloudProfile(playerId);
  }

  async claimCosmicEventReward(playerId, { weekKey, eventId } = {}, date = this.now()) {
    const safeWeekKey = String(weekKey || "").trim();
    const safeEventId = String(eventId || "").trim().toLowerCase();
    if (!/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(safeWeekKey) || !CLOUD_EVENTS.has(safeEventId)) {
      throw serviceError(400, "A valid Cosmic Event identity is required.", "invalid_cosmic_event_claim");
    }
    const now = date instanceof Date && Number.isFinite(date.getTime()) ? new Date(date.getTime()) : this.now();
    const activeEvent = currentCosmicEvent(now);
    const requestedWeekStart = isoWeekStartDate(safeWeekKey);
    const requestedEvent = requestedWeekStart ? currentCosmicEvent(requestedWeekStart) : null;
    if (!requestedEvent || safeEventId !== requestedEvent.id || Date.parse(requestedEvent.startsAt) > now.getTime()) {
      throw serviceError(409, "That Cosmic Event has ended. Refresh the current event before claiming.", "cosmic_event_stale", {
        current: { eventId: activeEvent.id, weekKey: activeEvent.weekKey, endsAt: activeEvent.endsAt }
      });
    }
    const eventDate = safeWeekKey === activeEvent.weekKey && safeEventId === activeEvent.id ? now : requestedWeekStart;
    let state = this.cosmicEventState(playerId, eventDate);
    const responseState = (value) => ({
      ...value,
      serverTime: now.toISOString(),
      eventServerTime: value.serverTime
    });
    if (!state.progress.collection.complete) {
      throw serviceError(422, "Complete the current Cosmic Event collection before claiming its reward.", "cosmic_event_incomplete", {
        progress: { discovered: state.progress.collection.discovered, total: state.progress.collection.total }
      });
    }

    const player = this.data.players[playerId];
    const rewardKey = `${safeWeekKey}:${safeEventId}`;
    player.cosmicEventRewards = normalizeCosmicEventRewardLedger(player.cosmicEventRewards);
    const existing = player.cosmicEventRewards[rewardKey];
    if (existing) {
      return {
        ...responseState(state),
        reward: { ...state.reward, granted: false, alreadyClaimed: true }
      };
    }

    player.cosmicEventRewards[rewardKey] = {
      claimedAt: now.toISOString(),
      kind: "stardust",
      amount: COSMIC_EVENT_COLLECTION_REWARD,
      cloudCreditedAt: now.toISOString()
    };
    player.cosmicEventRewards = normalizeCosmicEventRewardLedger(player.cosmicEventRewards);
    this.creditCosmicEventRewardInCloudProfile(playerId, COSMIC_EVENT_COLLECTION_REWARD, now);
    await this.persist();
    state = this.cosmicEventState(playerId, eventDate);
    return {
      ...responseState(state),
      reward: { ...state.reward, granted: true, alreadyClaimed: false }
    };
  }

  async registerPlayer({ withRecoveryCode = false } = {}) {
    const id = randomUUID();
    const issuedRecoveryCode = recoveryCode();
    const circuit = createPlayerCircuitState();
    circuit.wallet = grantDailyLaunchPasses(circuit.wallet, this.now()).wallet;
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
      lifetimeDiscoveries: {},
      cosmicEventRewards: {},
      cosmicEventDiscoveries: {},
      routeProgression: createRemixProgressionState(),
      remixReadiness: createRemixReadinessState(),
      adaptiveDifficulty: createAdaptiveDifficultyState(),
      duelRating: sanitizeDuelRating(),
      scrambleArena: structuredClone(sanitizeScrambleArena(null, { seasonId: DUEL_SEASON_ID })),
      duelEligibility: sanitizeDuelEligibility(),
      circuit,
      starPath: sanitizeStarPathState({}, this.now()),
      starPathRewards: [],
      cloudProfile: { version: 0, data: {}, updatedAt: null },
      entitlements: {},
      cosmeticEntitlements: normalizePlayerCosmeticEntitlements({}),
      authVersion: 1,
      sessions: {},
      sessionsEnabledAt: null,
      recovery: {
        digest: this.signFor("account-recovery", `${id}:${issuedRecoveryCode}`),
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
    if (!player) return null;
    const parsed = this.readPlayerSessionToken(playerToken);
    if (parsed) {
      const record = player.sessions?.[parsed.sessionId];
      if (parsed.playerId !== playerId || parsed.authVersion !== player.authVersion || !record || record.revokedAt) return null;
      const now = this.now().getTime();
      if (parsed.expiresAt <= now || Date.parse(record.expiresAt) <= now) return null;
      return player;
    }
    // Accounts that predate expiring device sessions keep their existing
    // bearer until their next recovery or explicit session issuance.
    if (player.sessionsEnabledAt) return null;
    return this.verify(player.authVersion ? `player:${playerId}:v${player.authVersion}` : `player:${playerId}`, playerToken) ? player : null;
  }

  tokenForPlayer(playerId) {
    const player = this.data.players[playerId];
    return player ? this.sign(player.authVersion ? `player:${playerId}:v${player.authVersion}` : `player:${playerId}`) : "";
  }

  readPlayerSessionToken(token) {
    const match = PLAYER_SESSION_TOKEN_PATTERN.exec(String(token || ""));
    if (!match || !this.verifyFor("player-session", match[1], match[2])) return null;
    try {
      const payload = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
      if (!hasExactRecordKeys(payload, ["authVersion", "expiresAt", "issuedAt", "playerId", "sessionId", "v"])) return null;
      if (payload.v !== 3 || !/^[0-9a-f-]{36}$/i.test(payload.playerId) || !/^[0-9a-f-]{36}$/i.test(payload.sessionId)) return null;
      if (!Number.isInteger(payload.authVersion) || !Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= payload.issuedAt) return null;
      return payload;
    } catch {
      return null;
    }
  }

  createPlayerSession(playerId, { deviceLabel = "device", ttlMs = PLAYER_SESSION_TTL_MS } = {}) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const issuedAt = this.now().getTime();
    const expiresAt = issuedAt + clamp(Math.floor(Number(ttlMs) || PLAYER_SESSION_TTL_MS), 60_000, PLAYER_SESSION_TTL_MS);
    const sessionId = randomUUID();
    const payload = { v: 3, playerId, sessionId, authVersion: player.authVersion, issuedAt, expiresAt };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const token = `cs3.${encoded}.${this.signFor("player-session", encoded)}`;
    player.sessions ||= {};
    player.sessions[sessionId] = {
      issuedAt: new Date(issuedAt).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      deviceLabel: cleanCloudText(deviceLabel, 40) || "device",
      tokenDigest: this.signFor("session-record", token)
    };
    player.sessionsEnabledAt ||= new Date(issuedAt).toISOString();
    const retained = Object.entries(player.sessions)
      .sort((left, right) => Date.parse(right[1].issuedAt || 0) - Date.parse(left[1].issuedAt || 0))
      .slice(0, MAX_PLAYER_SESSIONS);
    player.sessions = Object.fromEntries(retained);
    return { playerToken: token, sessionId, issuedAt: new Date(issuedAt).toISOString(), expiresAt: new Date(expiresAt).toISOString() };
  }

  async issuePlayerSession(playerId, options = {}) {
    const session = this.createPlayerSession(playerId, options);
    await this.persist();
    return session;
  }

  async revokePlayerSession(playerId, token) {
    const player = this.data.players[playerId];
    const parsed = this.readPlayerSessionToken(token);
    if (!player || !parsed || parsed.playerId !== playerId || !player.sessions?.[parsed.sessionId]) {
      throw serviceError(401, "That device session is not valid.", "invalid_player_session");
    }
    player.sessions[parsed.sessionId].revokedAt = this.now().toISOString();
    await this.persist();
    return { revoked: true, sessionId: parsed.sessionId };
  }

  routeChallengeState(playerId) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    player.routeProgression = sanitizeRemixProgressionState(player.routeProgression);
    player.remixReadiness = sanitizeRemixReadinessState(player.remixReadiness);
    player.adaptiveDifficulty = sanitizeAdaptiveDifficultyState(player.adaptiveDifficulty);
    const promotion = getPromotionEligibility(player.routeProgression);
    const currentRank = getRemixRank(player.routeProgression.rankId);
    const challengeRank = promotion.active && promotion.nextRank
      ? getRemixRank(promotion.nextRank.id)
      : currentRank;
    return {
      progression: structuredClone(player.routeProgression),
      readiness: structuredClone(player.remixReadiness),
      adaptiveDifficulty: structuredClone(player.adaptiveDifficulty),
      currentRank: getRemixRankPresentation(currentRank),
      challengeRank: getRemixRankPresentation(challengeRank),
      promotion: {
        active: promotion.active,
        eligible: promotion.eligible,
        status: promotion.status,
        currentRank: promotion.rank,
        targetRank: promotion.nextRank,
        attempt: promotion.trial ? promotion.trial.attempts + 1 : 0,
        attemptsCompleted: promotion.trial?.attempts || 0,
        attemptsTotal: promotion.trialLength,
        wins: promotion.trial?.wins || 0,
        winsRequired: promotion.winsRequired,
        flawlessWins: promotion.trial?.flawlessWins || 0
      }
    };
  }

  ensureRoutePromotion(playerId) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    player.routeProgression = sanitizeRemixProgressionState(player.routeProgression);
    const started = startRemixPromotionTrial(player.routeProgression);
    if (started.started) player.routeProgression = started.state;
    return {
      changed: started.started,
      ...this.routeChallengeState(playerId)
    };
  }

  rememberRouteChallengeTarget(playerId, target) {
    const player = this.data.players[playerId];
    if (!player) return null;
    player.adaptiveDifficulty = rememberAdaptiveTarget(
      player.adaptiveDifficulty,
      target
    );
    return structuredClone(player.adaptiveDifficulty);
  }

  publicRouteRank(playerId) {
    const state = this.routeChallengeState(playerId);
    const mastery = getRemixMasteryProgress(state.progression);
    return {
      version: state.progression.version,
      rank: state.currentRank,
      challengeRank: state.challengeRank,
      mastery: {
        points: mastery.masteryPoints,
        rankFloor: mastery.rankFloor,
        nextThreshold: mastery.nextThreshold,
        pointsIntoRank: mastery.pointsIntoRank,
        pointsRequired: mastery.pointsRequired,
        pointsRemaining: mastery.pointsRemaining,
        fraction: mastery.fraction
      },
      promotion: state.promotion,
      familyMastery: structuredClone(state.readiness.familyMastery)
    };
  }

  /**
   * Applies exactly one server-authored terminal Route Rank outcome. The
   * run-scoped idempotency key makes retries and crash recovery safe.
   */
  routeRankOutcomeReceipt(playerId, outcomeId) {
    const safeOutcomeId = cleanCloudText(outcomeId, 160);
    if (!safeOutcomeId) return null;
    const existing = (this.data.progressionLedger || []).find(
      (entry) =>
        entry.idempotencyKey === `route-rank:${playerId}:run:${safeOutcomeId}`
        && entry.playerId === playerId
    );
    if (!existing) return null;
    const routeRank = this.publicRouteRank(playerId);
    const storedReceipt = structuredClone(existing.receipt) || {};
    delete storedReceipt.adaptive;
    if (storedReceipt.readiness) delete storedReceipt.readiness.intensity;
    return {
      ...storedReceipt,
      changed: false,
      duplicate: true,
      routeRank,
      readiness: {
        ...(structuredClone(storedReceipt.readiness) || {})
      }
    };
  }

  recordRouteRankOutcome(playerId, event = {}) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const outcomeId = cleanCloudText(event.outcomeId ?? event.runId, 160);
    if (!outcomeId) throw new TypeError("Route Rank outcomes require a runId.");
    const idempotencyKey = `route-rank:${playerId}:run:${outcomeId}`;
    const existing = this.routeRankOutcomeReceipt(playerId, outcomeId);
    if (existing) return existing;

    const outcome = ["completed", "failed", "forfeit", "reveal"].includes(
      String(event.outcome || "").trim().toLowerCase()
    )
      ? String(event.outcome).trim().toLowerCase()
      : "failed";
    const assisted = event.assisted === true
      || event.paid === true
      || event.usedMajorPowerup === true
      || event.usedReveal === true;
    const competitiveCompletion = outcome === "completed" && !assisted;
    const rankId = getRemixRank(event.rankId).id;
    const familyIds = Array.isArray(event.familyIds)
      ? [...new Set(event.familyIds.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, 5)
      : [];
    const progressionEvent = {
      outcome,
      assisted,
      usedMajorPowerup: assisted,
      // This additionally fails closed against older mastery engines that
      // granted a token award for assisted completions.
      revealed: assisted || outcome === "reveal",
      usedReveal: assisted || outcome === "reveal",
      source: outcome === "reveal" ? "reveal" : "server",
      clean: competitiveCompletion && event.clean === true,
      flawless: competitiveCompletion && event.flawless === true,
      activeRemixes: familyIds.length
    };

    player.routeProgression = sanitizeRemixProgressionState(player.routeProgression);
    const promotionWasActive = Boolean(player.routeProgression.promotionTrial);
    const progressionResult = promotionWasActive
      ? recordRemixPromotionTrialOutcome(player.routeProgression, progressionEvent)
      : recordRemixProgressionOutcome(player.routeProgression, progressionEvent);
    player.routeProgression = progressionResult.state;

    player.remixReadiness = sanitizeRemixReadinessState(player.remixReadiness);
    const readinessOutcome = outcome === "reveal"
      ? "reveal"
      : competitiveCompletion
        ? "completed"
        : "failed";
    const readinessResult = recordRemixReadinessOutcome(player.remixReadiness, {
      outcomeId,
      outcome: readinessOutcome,
      rankId,
      families: familyIds,
      clean: competitiveCompletion && event.clean === true,
      assisted
    });
    player.remixReadiness = readinessResult.state;

    player.adaptiveDifficulty = sanitizeAdaptiveDifficultyState(player.adaptiveDifficulty);
    const adaptiveResult = applyAdaptiveChallengeOutcome(player.adaptiveDifficulty, {
      mode: event.mode,
      custom: false,
      outcome: competitiveCompletion ? "completed" : readinessOutcome,
      flawless: competitiveCompletion && event.flawless === true,
      surge: event.surge === true,
      surgeBaseLevel: event.surgeBaseLevel,
      challengeLevel: event.challengeLevel
    });
    player.adaptiveDifficulty = rememberAdaptiveTarget(
      adaptiveResult.state,
      event.target,
      { preserveRecovery: true }
    );

    const routeRank = this.publicRouteRank(playerId);
    let launchPassGrant = { granted: 0, reason: "not_promoted" };
    if (progressionResult.promoted) {
      const circuit = this.normalizePlayerCircuit(player);
      launchPassGrant = grantRankLaunchPass(circuit.wallet, {
        rankId: routeRank.rank.id,
        verified: true
      });
      circuit.wallet = launchPassGrant.wallet;
      player.circuit = circuit;
    }
    const receipt = {
      changed: true,
      duplicate: false,
      runId: outcomeId,
      outcome,
      competitive: competitiveCompletion,
      masteryAward: promotionWasActive
        ? 0
        : Math.max(0, Number(progressionResult.masteryAward) || 0),
      promotion: {
        wasActive: promotionWasActive,
        active: Boolean(routeRank.promotion.active),
        passed: Boolean(progressionResult.passed),
        failed: Boolean(progressionResult.failed),
        promoted: Boolean(progressionResult.promoted),
        bonusMastery: Math.max(0, Number(progressionResult.bonusMastery) || 0),
        message: String(progressionResult.message || "")
      },
      launchPassGrant: {
        granted: launchPassGrant.granted,
        reason: launchPassGrant.reason
      },
      readiness: {
        duplicate: Boolean(readinessResult.duplicate),
        masteryGained: readinessResult.masteryGained || []
      },
      routeRank
    };
    this.appendLedger("progressionLedger", {
      idempotencyKey,
      type: "route_rank_outcome",
      runId: outcomeId,
      playerId,
      outcome,
      competitive: competitiveCompletion,
      rankId,
      familyIds,
      masteryAward: receipt.masteryAward,
      adaptive: {
        adjustment: adaptiveResult.adjustment,
        message: adaptiveResult.message,
        metadata: adaptiveResult.metadata
      },
      receipt,
      createdAt: this.now().toISOString()
    });
    return structuredClone(receipt);
  }

  recordRouteRankRunOutcome(run, outcome = "completed") {
    if (!run?.game?.adaptive) return null;
    const assisted = Boolean(
      run.scoringDisabled
      || run.forfeited
      || run.assist !== "none"
      || run.usedBend
      || run.giftUsed
    );
    const clean = outcome === "completed"
      && !assisted
      && run.rejectedAttempts === 0;
    const routeLength = Math.max(
      1,
      Math.floor(Number(run.game.routeLength || run.game.parMoves) || 1)
    );
    const flawless = clean && run.moves <= routeLength;
    return this.recordRouteRankOutcome(run.playerId, {
      outcomeId: run.runId,
      outcome,
      mode: run.game.mode,
      target: run.game.target,
      rankId: run.game.remixes?.rank?.id || "bronze",
      familyIds: (run.game.remixes?.rules || []).map((rule) => rule.family),
      assisted,
      paid: run.usedBend && ["market", "wish"].includes(run.assist),
      usedMajorPowerup: run.giftUsed || ["sense", "gift", "market", "wish"].includes(run.assist),
      usedReveal: outcome === "reveal",
      clean,
      flawless,
      surge: Boolean(run.game.adaptiveSurge || run.game.surge),
      surgeBaseLevel: run.game.adaptiveSurgeBaseLevel ?? run.game.surgeBaseLevel,
      challengeLevel: run.game.challengeLevel
    });
  }

  circuitAttemptToken(playerId, attempt) {
    const run = attempt?.run;
    if (!run) return "";
    const payload = [playerId, run.id, run.courseId, run.path, run.startedAt, attempt.idempotencyKey].join(":");
    return `cc1.${this.signFor("cosmos-circuit-attempt", payload)}`;
  }

  verifyCircuitAttemptToken(playerId, attempt, token) {
    const expected = this.circuitAttemptToken(playerId, attempt);
    return CIRCUIT_ATTEMPT_TOKEN_PATTERN.test(String(token || "")) && safeDigestEqual(expected, token);
  }

  normalizePlayerCircuit(player) {
    const circuit = createPlayerCircuitState(player?.circuit);
    if (player) player.circuit = circuit;
    return circuit;
  }

  publicCircuitState(playerId, { includeAttempt = false } = {}) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const circuit = this.normalizePlayerCircuit(player);
    const active = circuit.activeAttempt;
    const crazyPath = crazyPathEligibility(
      circuit.wallet,
      circuit.claims,
      circuit.crazyStipend,
      this.now(),
      { routeRank: this.publicRouteRank(playerId).rank }
    );
    return {
      version: COSMOS_CIRCUIT_VERSION,
      economy: { ...COSMOS_CIRCUIT_ECONOMY },
      launchPasses: circuit.wallet.passes,
      wallet: {
        version: circuit.wallet.version,
        earnedOnly: true,
        passes: circuit.wallet.passes,
        dailyGrantDay: circuit.wallet.dailyGrantDay,
        dailyPure: { ...circuit.wallet.dailyPure }
      },
      boosts: { ...circuit.boosts },
      crazyPath: {
        eligible: crazyPath.eligible,
        reason: crazyPath.reason,
        qualified: crazyPath.qualified,
        attempted: crazyPath.attempted,
        coolingDown: crazyPath.coolingDown,
        cooldownUntilDay: crazyPath.cooldownUntilDay,
        entryPasses: crazyPath.entryPasses,
        passesNeeded: crazyPath.passesNeeded,
        resetsAt: crazyPath.resetsAt,
        rank: crazyPath.rank,
        stipend: sanitizeCrazyPathStipend(circuit.crazyStipend)
      },
      weeklyCosmosClaims: circuit.claims.cosmosWeekKeys.length,
      activeAttempt: active
        ? includeAttempt
          ? {
              run: structuredClone(active.run),
              expiresAt: active.expiresAt,
              attemptToken: this.circuitAttemptToken(playerId, active),
              telemetrySeed: active.telemetrySeed,
              course: circuitCourseForRun(active.run)
            }
          : {
              id: active.run.id,
              courseId: active.run.courseId,
              mode: active.run.mode,
              path: active.run.path,
              cursor: active.run.cursor,
              startedAt: active.run.startedAt,
              expiresAt: active.expiresAt
            }
        : null
    };
  }

  prepareCircuitState(playerId, date = this.now()) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const circuit = this.normalizePlayerCircuit(player);
    const before = JSON.stringify(circuit);
    const daily = grantDailyLaunchPasses(circuit.wallet, date);
    circuit.wallet = daily.wallet;
    const crazyDaily = grantCrazyPathDailyPowers(circuit.crazyStipend, date);
    circuit.crazyStipend = crazyDaily.stipend;
    if (crazyDaily.each) {
      for (const boost of CIRCUIT_BOOSTS) {
        circuit.boosts[boost] = clamp(circuit.boosts[boost] + crazyDaily.boosts[boost], 0, MAX_CIRCUIT_BOOSTS);
      }
    }
    if (circuit.activeAttempt && Date.parse(circuit.activeAttempt.expiresAt) <= date.getTime()) {
      circuit.activeAttempt = null;
    }
    player.circuit = circuit;
    return { circuit, daily, crazyDaily, changed: before !== JSON.stringify(circuit) };
  }

  async circuitStatus(playerId, date = this.now()) {
    const prepared = this.prepareCircuitState(playerId, date);
    if (prepared.changed) await this.persist();
    return {
      serverTime: date.toISOString(),
      circuit: this.publicCircuitState(playerId, { includeAttempt: true }),
      course: cosmosCircuitCourse(date),
      starPath: this.publicStarPathState(playerId, date),
      dailyGrant: {
        granted: prepared.daily.granted,
        reason: prepared.daily.reason
      },
      crazyDailyGrant: {
        grantedDays: prepared.crazyDaily.grantedDays,
        each: prepared.crazyDaily.each,
        reason: prepared.crazyDaily.reason
      }
    };
  }

  async startCircuitAttempt(playerId, {
    mode,
    path = "standard",
    idempotencyKey,
    practiceBoost = ""
  } = {}, date = this.now()) {
    const safeMode = mode === "ticketed" ? "ticketed" : mode === "practice" ? "practice" : "";
    if (!["standard", "crazy"].includes(path)) {
      throw serviceError(400, "Choose the standard Circuit or Crazy Path exactly.", "invalid_circuit_path");
    }
    const safePath = safeMode === "ticketed" && path === "crazy" ? "crazy" : "standard";
    const safeKey = String(idempotencyKey || "");
    if (!safeMode || !CIRCUIT_IDEMPOTENCY_PATTERN.test(safeKey)) {
      throw serviceError(400, "A valid Circuit mode and idempotency key are required.", "invalid_circuit_start");
    }
    if (safeMode === "ticketed" && practiceBoost) {
      throw serviceError(400, "Stored boosts are Practice-only and cannot enter a rewarded flight.", "ticketed_boost_forbidden");
    }
    if (practiceBoost && !CIRCUIT_BOOSTS.includes(practiceBoost)) {
      throw serviceError(400, "That Circuit boost is not available.", "invalid_circuit_boost");
    }
    const player = this.data.players[playerId];
    if (safeMode === "practice" && path !== "standard") {
      throw serviceError(400, "Practice uses the standard Circuit path.", "invalid_circuit_path");
    }
    const { circuit, daily: preStartDaily, crazyDaily: preStartCrazyDaily } = this.prepareCircuitState(playerId, date);
    const active = circuit.activeAttempt;
    if (active) {
      if (active.idempotencyKey === safeKey
        && active.run.mode === safeMode
        && active.run.path === safePath
        && active.run.practiceBoost === practiceBoost) {
        await this.persist();
        return {
          started: true,
          resumed: true,
          consumed: 0,
          circuit: this.publicCircuitState(playerId, { includeAttempt: true })
        };
      }
      if (active.idempotencyKey === safeKey) {
        throw serviceError(409, "That Circuit launch key was already used with different options.", "circuit_idempotency_conflict");
      }
      throw serviceError(409, "Finish or abandon the active Circuit flight first.", "circuit_attempt_active", {
        activeAttempt: this.publicCircuitState(playerId).activeAttempt
      });
    }
    const terminal = circuit.receipts.find((receipt) => receipt.startIdempotencyKey === safeKey);
    if (terminal) {
      if (terminal.startMode !== safeMode
        || terminal.startPath !== safePath
        || terminal.startPracticeBoost !== practiceBoost) {
        throw serviceError(409, "That Circuit launch key was already used with different options.", "circuit_idempotency_conflict");
      }
      await this.persist();
      return {
        started: true,
        resumed: true,
        duplicate: true,
        terminal: true,
        consumed: 0,
        receipt: {
          attemptId: terminal.attemptId,
          abandoned: terminal.abandoned,
          result: structuredClone(terminal.result),
          grant: structuredClone(terminal.grant)
        },
        circuit: this.publicCircuitState(playerId, { includeAttempt: true })
      };
    }
    if (practiceBoost && circuit.boosts[practiceBoost] < 1) {
      throw serviceError(409, "That Practice boost is not in your inventory.", "circuit_boost_empty");
    }
    const start = startCircuitRun({
      course: safePath === "crazy" ? cosmosCircuitCrazyCourse(date) : cosmosCircuitCourse(date),
      mode: safeMode,
      path: safePath,
      wallet: circuit.wallet,
      claims: circuit.claims,
      crazyStipend: circuit.crazyStipend,
      routeRank: this.publicRouteRank(playerId).rank,
      runId: `circuit-${randomUUID()}`,
      practiceBoost,
      at: date
    });
    if (!start.started) {
      const messages = {
        no_launch_pass: safePath === "crazy"
          ? "Crazy Path requires three earned Launch Passes."
          : "Earn a Launch Pass or choose an unlimited Practice Flight.",
        cosmos_qualification_required: "Complete a Cosmos-tier Reward Flight during this UTC week first.",
        route_rank_required: "Reach Gold Route Rank before entering Crazy Path.",
        weekly_attempt_used: "This UTC week's Crazy Path attempt has already been used.",
        victory_cooldown: "Crazy Path is resting during the 30-day victory cooldown.",
        launch_passes_required: "Crazy Path requires three earned Launch Passes."
      };
      const code = start.reason === "no_launch_pass" || start.reason === "launch_passes_required"
        ? "launch_pass_required"
        : `crazy_path_${start.reason}`;
      throw serviceError(409, messages[start.reason] || "The Circuit flight could not start.", code);
    }
    const postStartDaily = grantDailyLaunchPasses(start.wallet, date);
    circuit.wallet = postStartDaily.wallet;
    circuit.claims = start.claims;
    if (practiceBoost) circuit.boosts[practiceBoost] -= 1;
    circuit.activeAttempt = {
      idempotencyKey: safeKey,
      expiresAt: new Date(date.getTime() + CIRCUIT_ATTEMPT_TTL_MS).toISOString(),
      telemetrySeed: randomBytes(32).toString("hex"),
      run: start.run
    };
    player.circuit = circuit;
    await this.persist();
    return {
      started: true,
      resumed: false,
      consumed: start.consumed,
      redeemedPending: start.redeemedPending,
      dailyGrant: {
        granted: preStartDaily.granted + postStartDaily.granted,
        reason: postStartDaily.granted ? postStartDaily.reason : preStartDaily.reason
      },
      crazyDailyGrant: {
        grantedDays: preStartCrazyDaily.grantedDays,
        each: preStartCrazyDaily.each,
        reason: preStartCrazyDaily.reason
      },
      circuit: this.publicCircuitState(playerId, { includeAttempt: true })
    };
  }

  validateCircuitTrajectory(rawSamples, {
    segment,
    path,
    previousElapsedMs,
    eventElapsedMs,
    previousEndpoint,
    useAbility
  }) {
    const minimumSamples = Math.max(
      CIRCUIT_MIN_TRAJECTORY_SAMPLES,
      Math.ceil(segment.durationMs / CIRCUIT_MAX_SAMPLE_PROGRESS_GAP_MS) + 1
    );
    if (!Array.isArray(rawSamples)
      || rawSamples.length < minimumSamples
      || rawSamples.length > CIRCUIT_MAX_TRAJECTORY_SAMPLES) {
      throw serviceError(422, "Circuit trajectory coverage is incomplete.", "implausible_circuit_trajectory");
    }

    const samples = [];
    for (const [index, rawSample] of rawSamples.entries()) {
      if (!hasExactRecordKeys(rawSample, ["elapsedMs", "progressMs", "x", "y"])
        || !Number.isInteger(rawSample.progressMs)
        || !Number.isInteger(rawSample.elapsedMs)
        || !Number.isFinite(rawSample.x)
        || !Number.isFinite(rawSample.y)
        || rawSample.progressMs < 0
        || rawSample.progressMs > segment.durationMs
        || rawSample.elapsedMs < previousElapsedMs
        || rawSample.elapsedMs > eventElapsedMs
        || rawSample.x < 0
        || rawSample.x > 1
        || rawSample.y < 0
        || rawSample.y > 1) {
        throw serviceError(400, "Circuit trajectory samples are malformed.", "invalid_circuit_trajectory");
      }
      const sample = {
        progressMs: rawSample.progressMs,
        elapsedMs: rawSample.elapsedMs,
        x: Math.round(rawSample.x * 10_000) / 10_000,
        y: Math.round(rawSample.y * 10_000) / 10_000
      };
      if (index === 0) {
        if (sample.progressMs !== 0 || sample.elapsedMs !== previousElapsedMs) {
          throw serviceError(422, "Circuit trajectory does not begin at the signed checkpoint.", "implausible_circuit_trajectory");
        }
        const resetDistance = Math.hypot(sample.x - 0.5, sample.y - 0.5);
        const continuityDistance = previousEndpoint
          ? Math.hypot(sample.x - previousEndpoint.x, sample.y - previousEndpoint.y)
          : Number.POSITIVE_INFINITY;
        if (resetDistance > CIRCUIT_SAMPLE_POSITION_EPSILON
          && continuityDistance > CIRCUIT_SAMPLE_POSITION_EPSILON) {
          throw serviceError(422, "Circuit trajectory breaks ship-position continuity.", "implausible_circuit_trajectory");
        }
      } else {
        const prior = samples.at(-1);
        const progressGap = sample.progressMs - prior.progressMs;
        const elapsedGap = sample.elapsedMs - prior.elapsedMs;
        if (progressGap <= 0
          || elapsedGap <= 0
          || progressGap > CIRCUIT_MAX_SAMPLE_PROGRESS_GAP_MS
          || elapsedGap > CIRCUIT_MAX_SAMPLE_ELAPSED_GAP_MS) {
          throw serviceError(422, "Circuit trajectory timing is not physically plausible.", "implausible_circuit_trajectory");
        }
        const travel = Math.hypot(sample.x - prior.x, sample.y - prior.y);
        const maximumTravel = path === "crazy"
          ? Math.min(0.48, elapsedGap * 0.00075 + 0.03)
          : Math.min(1.5, elapsedGap * 0.015 + 0.03);
        if (travel > maximumTravel) {
          throw serviceError(422, "Circuit trajectory movement is not physically plausible.", "implausible_circuit_trajectory");
        }
      }
      samples.push(sample);
    }

    const last = samples.at(-1);
    if (last.progressMs !== segment.durationMs || last.elapsedMs !== eventElapsedMs) {
      throw serviceError(422, "Circuit trajectory does not cover the completed checkpoint.", "implausible_circuit_trajectory");
    }
    const elapsedDelta = eventElapsedMs - previousElapsedMs;
    const minimumElapsedMs = Math.max(1, segment.durationMs - 350);
    const maximumElapsedMs = useAbility === "timeWarp"
      ? Math.ceil(segment.durationMs / 0.58) + 600
      : segment.durationMs + 500;
    if (elapsedDelta < minimumElapsedMs || elapsedDelta > maximumElapsedMs) {
      throw serviceError(422, "Circuit checkpoint timing is not physically plausible.", "implausible_circuit_timing");
    }
    return samples;
  }

  validateCircuitTelemetry(active, rawEvents, reason, date = this.now()) {
    const run = active.run;
    const course = circuitCourseForRun(run);
    if (!Array.isArray(rawEvents) || rawEvents.length > course.segments.length) {
      throw serviceError(400, "Circuit telemetry has an invalid checkpoint count.", "invalid_circuit_telemetry");
    }
    if (!CIRCUIT_END_REASONS.has(reason)) {
      throw serviceError(400, "Circuit telemetry has an invalid finish reason.", "invalid_circuit_finish");
    }
    if ((rawEvents.length === course.segments.length) !== (reason === "finish")) {
      throw serviceError(422, "Only a complete ordered course can report a finish.", "circuit_course_incomplete");
    }
    const startedAt = Date.parse(run.startedAt);
    const wallElapsedMs = Math.max(0, date.getTime() - startedAt);
    const heldAbilities = Object.fromEntries(CIRCUIT_BOOSTS.map((boost) => [boost, 0]));
    if (run.mode === "practice" && CIRCUIT_BOOSTS.includes(run.practiceBoost)) {
      heldAbilities[run.practiceBoost] = 1;
    }
    let previousElapsedMs = 0;
    let previousEndpoint = null;
    let previousTelemetryChain = active.telemetrySeed;
    let nextRun = run;
    rawEvents.forEach((rawEvent, index) => {
      const segment = course.segments[index];
      if (!hasExactRecordKeys(rawEvent, ["ability", "chain", "elapsedMs", "outcome", "samples", "segmentId", "sequence", "stardust", "useAbility"])) {
        throw serviceError(400, "Each Circuit checkpoint must use the exact telemetry fields.", "invalid_circuit_telemetry");
      }
      if (rawEvent.sequence !== index || !CIRCUIT_TELEMETRY_CHAIN_PATTERN.test(String(rawEvent.chain || ""))) {
        throw serviceError(422, "Circuit telemetry sequence is incomplete.", "invalid_circuit_telemetry_chain");
      }
      const expectedChain = createHash("sha256")
        .update(`${previousTelemetryChain}\0${canonicalCircuitTelemetryEvent(rawEvent, index)}`)
        .digest("hex");
      if (!safeDigestEqual(expectedChain, rawEvent.chain)) {
        throw serviceError(422, "Circuit telemetry chain validation failed.", "invalid_circuit_telemetry_chain");
      }
      previousTelemetryChain = rawEvent.chain;
      if (rawEvent.segmentId !== segment.id) {
        throw serviceError(422, "Circuit checkpoints must be submitted in course order.", "circuit_checkpoint_order");
      }
      if (!CIRCUIT_EVENT_OUTCOMES.has(rawEvent.outcome)) {
        throw serviceError(400, "Circuit checkpoint outcomes are invalid.", "invalid_circuit_telemetry");
      }
      if (!Number.isInteger(rawEvent.elapsedMs) || !Number.isInteger(rawEvent.stardust)
        || rawEvent.stardust < 0 || rawEvent.stardust > segment.stardust) {
        throw serviceError(400, "Circuit timing and Stardust telemetry must use bounded integers.", "invalid_circuit_telemetry");
      }
      if (rawEvent.elapsedMs > wallElapsedMs + CIRCUIT_WALL_CLOCK_GRACE_MS) {
        throw serviceError(422, "Circuit telemetry is ahead of the signed attempt clock.", "implausible_circuit_timing");
      }
      if (typeof rawEvent.ability !== "string" || typeof rawEvent.useAbility !== "string") {
        throw serviceError(400, "Circuit abilities must use exact identifiers.", "invalid_circuit_telemetry");
      }
      const ability = rawEvent.ability;
      const useAbility = rawEvent.useAbility;
      if (ability && !CIRCUIT_BOOSTS.includes(ability)) {
        throw serviceError(400, "Circuit ability telemetry must use a known identifier or an empty string.", "invalid_circuit_telemetry");
      }
      if (useAbility) {
        if (!CIRCUIT_BOOSTS.includes(useAbility) || heldAbilities[useAbility] < 1) {
          throw serviceError(422, "Circuit telemetry tried to use an ability that was not collected.", "invalid_circuit_ability");
        }
        heldAbilities[useAbility] -= 1;
      } else if (rawEvent.useAbility !== "") {
        throw serviceError(400, "Circuit ability-use telemetry must use a known identifier or an empty string.", "invalid_circuit_telemetry");
      }
      const samples = this.validateCircuitTrajectory(rawEvent.samples, {
        segment,
        path: run.path,
        previousElapsedMs,
        eventElapsedMs: rawEvent.elapsedMs,
        previousEndpoint,
        useAbility
      });
      const derived = deriveCircuitCheckpoint(course, segment, samples, useAbility);
      if (segment.kind === "ability-gate" && derived.outcome !== "miss") {
        if (!ability || !circuitAbilityOptions(course, segment).has(ability)) {
          throw serviceError(422, "Choose one of the powers offered by the cleared ability gate.", "invalid_circuit_ability");
        }
        heldAbilities[ability] += 1;
      } else if (ability) {
        throw serviceError(422, "Circuit abilities can only be collected from a cleared ability gate.", "invalid_circuit_ability");
      }
      const authoritativeEvent = {
        segmentId: segment.id,
        outcome: derived.outcome,
        stardust: derived.stardust,
        ability,
        useAbility,
        samples,
        elapsedMs: rawEvent.elapsedMs
      };
      const advanced = advanceCircuitRun(nextRun, authoritativeEvent);
      if (!advanced.advanced) {
        throw serviceError(422, "Circuit telemetry could not advance the signed course.", "invalid_circuit_telemetry");
      }
      nextRun = advanced.run;
      previousElapsedMs = rawEvent.elapsedMs;
      previousEndpoint = samples.at(-1);
    });
    if (reason === "finish") {
      if (previousElapsedMs < Math.floor(course.expectedDurationMs * 0.85)
        || previousElapsedMs > course.expectedDurationMs * 2) {
        throw serviceError(422, "The completed Circuit time is not physically plausible.", "implausible_circuit_timing");
      }
      return nextRun;
    }
    const finished = finishCircuitRun(nextRun, { reason, elapsedMs: previousElapsedMs });
    if (!finished.finished) throw serviceError(422, "The Circuit flight could not finish.", "invalid_circuit_finish");
    return finished.run;
  }

  circuitDuplicateReceipt(circuit, attemptId, idempotencyKey, attemptToken) {
    const receipt = circuit.receipts.find((candidate) =>
      candidate.attemptId === attemptId && candidate.idempotencyKey === idempotencyKey
    );
    if (!receipt) return null;
    if (!safeDigestEqual(receipt.attemptToken, attemptToken)) {
      throw serviceError(401, "That Circuit attempt token is not valid.", "invalid_circuit_attempt");
    }
    return receipt;
  }

  circuitReceiptResponse(playerId, receipt, duplicate) {
    return {
      submitted: !receipt.abandoned,
      abandoned: receipt.abandoned,
      duplicate,
      result: structuredClone(receipt.result),
      grant: structuredClone(receipt.grant),
      circuit: this.publicCircuitState(playerId, { includeAttempt: true }),
      starPath: this.publicStarPathState(playerId)
    };
  }

  async submitCircuitAttempt(playerId, {
    attemptId,
    attemptToken,
    idempotencyKey,
    events,
    reason,
    chosenBoost = "",
    crazyRewardChoice = ""
  } = {}, date = this.now()) {
    const safeAttemptId = String(attemptId || "");
    const safeKey = String(idempotencyKey || "");
    if (!safeAttemptId || !CIRCUIT_ATTEMPT_TOKEN_PATTERN.test(String(attemptToken || ""))
      || !CIRCUIT_IDEMPOTENCY_PATTERN.test(safeKey)) {
      throw serviceError(400, "Circuit submission credentials are invalid.", "invalid_circuit_submission");
    }
    if (chosenBoost && !CIRCUIT_BOOSTS.includes(chosenBoost)) {
      throw serviceError(400, "Choose a valid Circuit boost.", "invalid_circuit_boost");
    }
    if (crazyRewardChoice && !CRAZY_PATH_REWARD_CHOICES.includes(crazyRewardChoice)) {
      throw serviceError(400, "Choose a valid Crazy Path reward.", "invalid_crazy_path_reward");
    }
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const circuit = this.normalizePlayerCircuit(player);
    const duplicate = this.circuitDuplicateReceipt(circuit, safeAttemptId, safeKey, attemptToken);
    if (duplicate) {
      const storedCrazyChoice = duplicate.grant?.crazyRewardChoice || "";
      if (duplicate.result?.path === "crazy" && storedCrazyChoice !== crazyRewardChoice) {
        throw serviceError(409, "That Crazy Path submission key already settled a different reward choice.", "circuit_idempotency_conflict");
      }
      await this.persist();
      return this.circuitReceiptResponse(playerId, duplicate, true);
    }
    const active = circuit.activeAttempt;
    if (!active || active.run.id !== safeAttemptId || !this.verifyCircuitAttemptToken(playerId, active, attemptToken)) {
      throw serviceError(401, "That signed Circuit attempt is not active.", "invalid_circuit_attempt");
    }
    if (Date.parse(active.expiresAt) <= date.getTime()) {
      circuit.activeAttempt = null;
      await this.persist();
      throw serviceError(410, "That Circuit attempt expired.", "circuit_attempt_expired");
    }
    if (active.run.path === "crazy" && chosenBoost) {
      throw serviceError(400, "Crazy Path does not grant a standard Circuit boost choice.", "crazy_path_standard_reward_forbidden");
    }
    if (active.run.path !== "crazy" && crazyRewardChoice) {
      throw serviceError(400, "A Crazy Path reward can only settle a signed Crazy Path.", "crazy_path_reward_forbidden");
    }
    const run = this.validateCircuitTelemetry(active, events, reason, date);
    let grant = null;
    if (run.result?.rewardEligible) {
      const claim = claimCircuitReward(circuit.claims, run, {
        chosenBoost,
        crazyRewardChoice,
        verified: true,
        at: date
      });
      if (!claim.claimed) {
        const choiceRequired = ["choose_powerup", "choose_crazy_reward"].includes(claim.reason);
        const status = choiceRequired ? 400 : 409;
        throw serviceError(status, claim.reason === "choose_powerup"
          ? "Choose which Circuit boost to receive."
          : claim.reason === "choose_crazy_reward"
            ? "Choose the Immediate Cache or Thirty-Day Supply."
            : "That Circuit reward could not be claimed.", `circuit_${claim.reason}`);
      }
      circuit.claims = claim.claims;
      grant = claim.grant;
      if (run.path === "crazy" && grant.crazyRewardChoice === "daily") {
        const daily = grantCrazyPathDailyPowers(grant.stipend, date);
        circuit.crazyStipend = daily.stipend;
        grant = {
          ...grant,
          stipend: daily.stipend,
          boosts: daily.boosts,
          grantedDays: daily.grantedDays
        };
      }
      for (const boost of CIRCUIT_BOOSTS) {
        circuit.boosts[boost] = clamp(circuit.boosts[boost] + grant.boosts[boost], 0, MAX_CIRCUIT_BOOSTS);
      }
    }
    const starPathProgressResult = run.result?.rewardEligible && run.path !== "crazy"
      ? this.recordStarPathCircuitMilestone(playerId, {
          ...run.result,
          verified: true,
          rewardEligible: true,
          milestone: grant?.tier || run.result?.milestone
        }, date)
      : { xpAwarded: 0, baseXpAwarded: 0, weeklyBonusXpAwarded: 0 };
    if (grant) {
      grant = {
        ...grant,
        starPathXp: starPathProgressResult.xpAwarded,
        starPathBaseXp: starPathProgressResult.baseXpAwarded,
        starPathWeeklyBonusXp: starPathProgressResult.weeklyBonusXpAwarded
      };
    }
    circuit.activeAttempt = null;
    const receipt = sanitizeCircuitReceipt({
      attemptId: safeAttemptId,
      attemptToken,
      idempotencyKey: safeKey,
      startIdempotencyKey: active.idempotencyKey,
      startMode: active.run.mode,
      startPath: active.run.path,
      startPracticeBoost: active.run.practiceBoost,
      submittedAt: date.toISOString(),
      abandoned: false,
      result: run.result,
      grant
    });
    circuit.receipts = [...circuit.receipts, receipt].filter(Boolean).slice(-MAX_CIRCUIT_RECEIPTS);
    player.circuit = circuit;
    await this.persist();
    return this.circuitReceiptResponse(playerId, receipt, false);
  }

  async abandonCircuitAttempt(playerId, {
    attemptId,
    attemptToken,
    idempotencyKey
  } = {}, date = this.now()) {
    const safeAttemptId = String(attemptId || "");
    const safeKey = String(idempotencyKey || "");
    if (!safeAttemptId || !CIRCUIT_ATTEMPT_TOKEN_PATTERN.test(String(attemptToken || ""))
      || !CIRCUIT_IDEMPOTENCY_PATTERN.test(safeKey)) {
      throw serviceError(400, "Circuit abandonment credentials are invalid.", "invalid_circuit_abandon");
    }
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const circuit = this.normalizePlayerCircuit(player);
    const duplicate = this.circuitDuplicateReceipt(circuit, safeAttemptId, safeKey, attemptToken);
    if (duplicate) {
      await this.persist();
      return this.circuitReceiptResponse(playerId, duplicate, true);
    }
    const active = circuit.activeAttempt;
    if (!active || active.run.id !== safeAttemptId || !this.verifyCircuitAttemptToken(playerId, active, attemptToken)) {
      throw serviceError(401, "That signed Circuit attempt is not active.", "invalid_circuit_attempt");
    }
    const finished = finishCircuitRun(active.run, {
      reason: "withdraw",
      elapsedMs: active.run.events.at(-1)?.elapsedMs || 0
    });
    circuit.activeAttempt = null;
    const receipt = sanitizeCircuitReceipt({
      attemptId: safeAttemptId,
      attemptToken,
      idempotencyKey: safeKey,
      startIdempotencyKey: active.idempotencyKey,
      startMode: active.run.mode,
      startPath: active.run.path,
      startPracticeBoost: active.run.practiceBoost,
      submittedAt: date.toISOString(),
      abandoned: true,
      result: finished.result,
      grant: null
    });
    circuit.receipts = [...circuit.receipts, receipt].filter(Boolean).slice(-MAX_CIRCUIT_RECEIPTS);
    player.circuit = circuit;
    await this.persist();
    return this.circuitReceiptResponse(playerId, receipt, false);
  }

  recordCircuitPureWin(playerId, runId) {
    const player = this.data.players[playerId];
    if (!player) return { granted: 0, stamped: false, reason: "player_missing" };
    const circuit = this.normalizePlayerCircuit(player);
    const result = recordEligiblePureWin(circuit.wallet, {
      winId: runId,
      mode: "pure",
      won: true,
      assisted: false,
      verified: true,
      at: this.now()
    });
    circuit.wallet = result.wallet;
    player.circuit = circuit;
    return result;
  }

  normalizePlayerStarPath(player, date = this.now()) {
    const state = sanitizeStarPathState(player?.starPath, date);
    if (player) {
      player.starPath = state;
      player.starPathRewards = sanitizeStarPathRewards(player.starPathRewards);
    }
    return state;
  }

  publicStarPathState(playerId, date = this.now()) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const state = this.normalizePlayerStarPath(player, date);
    const catalog = starPathCatalog(date);
    return {
      ...starPathProgress(state, date),
      supporterAccess: this.cosmeticOwnership(playerId).supporter,
      catalog: {
        tracks: structuredClone(catalog.tracks),
        tiers: structuredClone(catalog.tiers)
      },
      rewards: [...player.starPathRewards]
    };
  }

  async starPathStatus(playerId, date = this.now()) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const beforeState = JSON.stringify(player.starPath || {});
    const beforeRewards = JSON.stringify(player.starPathRewards || []);
    const starPath = this.publicStarPathState(playerId, date);
    if (beforeState !== JSON.stringify(player.starPath)
      || beforeRewards !== JSON.stringify(player.starPathRewards)) {
      await this.persist();
    }
    return { serverTime: date.toISOString(), starPath };
  }

  recordStarPathWordWin(playerId, result, date = this.now()) {
    const player = this.data.players[playerId];
    if (!player) return { awarded: false, xpAwarded: 0, reason: "player_missing" };
    const progress = recordStarPathProgress(
      this.normalizePlayerStarPath(player, date),
      starPathWordWinXpEvent(result),
      date
    );
    player.starPath = progress.state;
    return progress;
  }

  recordStarPathCircuitMilestone(playerId, result, date = this.now()) {
    const player = this.data.players[playerId];
    if (!player) return { awarded: false, xpAwarded: 0, reason: "player_missing" };
    const progress = recordStarPathProgress(
      this.normalizePlayerStarPath(player, date),
      starPathCircuitXpEvent(result),
      date
    );
    player.starPath = progress.state;
    return progress;
  }

  async claimStarPathReward(playerId, { track, tier } = {}, date = this.now()) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    if (!["free", "supporter"].includes(track)
      || !Number.isInteger(tier)
      || tier < 1
      || tier > starPathCatalog(date).tiers.length) {
      throw serviceError(400, "Choose an exact Star Path track and tier.", "invalid_star_path_claim");
    }
    const supporterAccess = this.cosmeticOwnership(playerId).supporter;
    const claim = claimStarPathReward(
      this.normalizePlayerStarPath(player, date),
      { track, tier, supporterAccess },
      date
    );
    const exactReward = starPathCatalog(date).tiers[tier - 1]?.rewards?.[track] || null;
    if (!claim.claimed) {
      if (claim.reason === "already_claimed") {
        await this.persist();
        return {
          claimed: false,
          duplicate: true,
          reward: structuredClone(exactReward),
          starPath: this.publicStarPathState(playerId, date)
        };
      }
      const status = claim.reason === "supporter_required" ? 403
        : claim.reason === "tier_locked" ? 409
          : 400;
      throw serviceError(
        status,
        claim.reason === "supporter_required"
          ? "The supporter track requires an active Supporter Pack."
          : claim.reason === "tier_locked"
            ? "Earn the required Star Path XP before claiming this tier."
            : "That Star Path reward is not available.",
        `star_path_${claim.reason}`
      );
    }
    if (!exactReward
      || claim.reward?.id !== exactReward.id
      || claim.reward.cosmeticOnly !== true
      || claim.reward.gameplayEffect !== "none") {
      throw serviceError(500, "The Star Path reward catalog could not be verified.", "star_path_catalog_mismatch");
    }
    player.starPath = claim.state;
    player.starPathRewards = sanitizeStarPathRewards([
      ...player.starPathRewards,
      exactReward.id
    ]);
    if (COSMETIC_ITEM_IDS.has(exactReward.id)) {
      const entitlements = normalizePlayerCosmeticEntitlements(player.cosmeticEntitlements);
      if (!entitlements.items.includes(exactReward.id)) {
        entitlements.items.push(exactReward.id);
        entitlements.items.sort();
      }
      player.cosmeticEntitlements = entitlements;
    }
    this.appendLedger("entitlementLedger", {
      idempotencyKey: `star-path:${playerId}:${exactReward.id}`,
      type: "star_path_cosmetic_claimed",
      playerId,
      seasonId: player.starPath.seasonId,
      track,
      tier,
      rewardId: exactReward.id,
      competitive: false,
      gameplayEffect: "none",
      createdAt: date.toISOString()
    });
    await this.persist();
    return {
      claimed: true,
      duplicate: false,
      reward: structuredClone(exactReward),
      starPath: this.publicStarPathState(playerId, date)
    };
  }

  publicPlayer(playerId) {
    const player = this.data.players[playerId];
    if (!player) return null;
    const cosmeticOwnership = this.cosmeticOwnership(playerId);
    return {
      id: player.id,
      callsign: player.callsign,
      credits: player.credits,
      founderPass: Boolean(player.founderPass),
      supporter: cosmeticOwnership.supporter,
      cosmeticOwnership,
      freeWishUsed: Boolean(player.freeWishUsed),
      wishAvailable: this.canUseWish(playerId),
      dailyWishUsedDate: player.dailyWishUsedDate || "",
      cloudProfileVersion: Math.max(0, Math.floor(Number(player.cloudProfile?.version) || 0)),
      competitiveProgression: this.competitiveProgression(playerId),
      routeRank: this.publicRouteRank(playerId),
      duelRating: sanitizeDuelRating(player.duelRating),
      scrambleArena: publicScrambleArenaSnapshot(player.scrambleArena, { seasonId: DUEL_SEASON_ID }),
      duelEligibility: sanitizeDuelEligibility(player.duelEligibility),
      circuit: this.publicCircuitState(playerId),
      starPath: this.publicStarPathState(playerId),
      vault: MARKET_CATALOG.filter((item) => player.licenses[item.id]).map((item) => ({ ...item, owned: true }))
    };
  }

  cosmeticOwnership(playerId) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const explicit = normalizePlayerCosmeticEntitlements(player.cosmeticEntitlements);
    const activeSupporterEntitlement = Object.values(player.entitlements || {}).some((entitlement) =>
      entitlement?.active && entitlement?.productId === "constellore_founders_pass"
    );
    const ownership = cosmeticOwnershipSnapshot({
      supporter: Boolean(player.founderPass || activeSupporterEntitlement),
      itemIds: explicit.items,
      collectionIds: explicit.collections,
      progress: authoritativeCosmeticProgress(player, this.data.runLedger)
    });
    return {
      ...ownership,
      seasonal: sanitizeStarPathRewards(player.starPathRewards)
    };
  }

  appendLedger(name, entry) {
    if (!["runLedger", "progressionLedger", "economyLedger", "entitlementLedger", "duelRatingLedger"].includes(name)) throw new TypeError("Unknown ledger.");
    const ledger = this.data[name] ||= [];
    const idempotencyKey = cleanCloudText(entry?.idempotencyKey, 180);
    if (!idempotencyKey) throw new TypeError("Ledger entries require an idempotency key.");
    const existing = ledger.find((record) => record.idempotencyKey === idempotencyKey);
    if (existing) return { appended: false, entry: existing };
    const record = {
      id: randomUUID(),
      ...structuredClone(entry),
      idempotencyKey,
      createdAt: entry.createdAt || this.now().toISOString()
    };
    ledger.push(record);
    if (ledger.length > MAX_LEDGER_ENTRIES) ledger.splice(0, ledger.length - MAX_LEDGER_ENTRIES);
    return { appended: true, entry: record };
  }

  competitiveProgression(playerId) {
    const records = (this.data.progressionLedger || []).filter((entry) => entry.playerId === playerId && entry.type === "verified_run_completed");
    const dailyKeys = [...new Set(records.map((entry) => entry.dailyKey).filter(Boolean))].sort();
    let currentStreak = 0;
    if (dailyKeys.length) {
      currentStreak = 1;
      for (let index = dailyKeys.length - 1; index > 0; index -= 1) {
        const difference = (Date.parse(`${dailyKeys[index]}T00:00:00Z`) - Date.parse(`${dailyKeys[index - 1]}T00:00:00Z`)) / 86400000;
        if (difference !== 1) break;
        currentStreak += 1;
      }
    }
    return {
      source: "server_verified_ledger",
      verifiedWins: records.length,
      atlasXp: records.reduce((sum, entry) => sum + nonnegativeCounter(entry.atlasXp), 0),
      dailyStreak: currentStreak,
      lastDailyDate: dailyKeys.at(-1) || ""
    };
  }

  recoveryDigest(playerId, code) {
    const normalized = normalizeRecoveryCode(code);
    return normalized && RECOVERY_CODE_PATTERN.test(normalized) ? this.signFor("account-recovery", `${playerId}:${normalized}`) : "";
  }

  async recoverPlayer(playerId, code) {
    const id = String(playerId || "").trim();
    const player = this.data.players[id];
    const receivedDigest = this.recoveryDigest(id, code);
    const normalizedCode = normalizeRecoveryCode(code);
    const legacyDigest = normalizedCode && RECOVERY_CODE_PATTERN.test(normalizedCode) ? this.sign(`recovery:v1:${id}:${normalizedCode}`) : "";
    if (!player?.recovery?.digest || (!safeDigestEqual(player.recovery.digest, receivedDigest) && !safeDigestEqual(player.recovery.digest, legacyDigest))) {
      throw serviceError(401, "That recovery kit is invalid or has already been used.", "invalid_recovery_code");
    }
    const nextCode = recoveryCode();
    player.recovery = {
      digest: this.signFor("account-recovery", `${id}:${nextCode}`),
      version: Math.max(1, Number(player.recovery.version) || 1) + 1,
      issuedAt: new Date().toISOString(),
      rotatedAt: new Date().toISOString()
    };
    player.authVersion = Math.max(0, Number(player.authVersion) || 0) + 1;
    player.sessions = {};
    player.sessionsEnabledAt = this.now().toISOString();
    const session = this.createPlayerSession(id, { deviceLabel: "recovered device" });
    await this.persist();
    return {
      player: this.publicPlayer(id),
      playerToken: session.playerToken,
      sessionId: session.sessionId,
      sessionExpiresAt: session.expiresAt,
      recoveryCode: nextCode,
      recoveryVersion: player.recovery.version
    };
  }

  async rotateRecovery(playerId) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const nextCode = recoveryCode();
    player.recovery = {
      digest: this.signFor("account-recovery", `${playerId}:${nextCode}`),
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
    const eventState = this.cosmicEventState(playerId);
    const cosmeticOwnership = this.cosmeticOwnership(playerId);
    const data = sanitizeCloudProfile(profile, {
      founder: Boolean(player.founderPass),
      cosmeticOwnership: {
        supporter: cosmeticOwnership.supporter,
        itemIds: cosmeticOwnership.items,
        collectionIds: cosmeticOwnership.collections,
        earnedIds: cosmeticOwnership.earned
      },
      currentEvent: eventState.event,
      authoritativeEventProgress: {
        weekKey: eventState.progress.weekKey,
        eventId: eventState.progress.eventId,
        words: eventState.progress.words,
        rewarded: eventState.progress.rewarded
      }
    });
    if (data.feedbackPreferences && isRecord(current.profile.feedbackPreferences)) {
      for (const field of ["musicVolume", "sfxVolume"]) {
        const storedValue = current.profile.feedbackPreferences[field];
        if (!(field in data.feedbackPreferences) && Number.isFinite(storedValue) && storedValue >= 0 && storedValue <= 1) {
          data.feedbackPreferences[field] = storedValue;
        }
      }
    }
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
      cosmetics: this.cosmeticOwnership(playerId),
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
    this.appendLedger("entitlementLedger", {
      idempotencyKey: `entitlement:${safeProvider}:${transactionDigest}`,
      type: "verified_entitlement_granted",
      playerId,
      productId: product.id,
      provider: safeProvider,
      transactionDigest,
      createdAt: grantedAt
    });
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
      const inactiveCutoff = new Date(date.getTime() - INTEREST_INACTIVE_RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
      for (const [key, record] of Object.entries(records)) {
        if (!record?.active && String(record?.lastChangedDate || "") < inactiveCutoff) delete records[key];
      }
      if (Object.keys(records).length >= INTEREST_RECORD_LIMIT) {
        throw serviceError(503, "The public interest ledger is temporarily full.", "interest_capacity");
      }
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

  recordRejectedPairExpectation({
    a,
    b,
    expected = "",
    reason = "",
    mode = "reach",
    reporterId = "",
    sessionId = "",
    cohortId = ""
  }, date = new Date(), { allowPlaintext = false } = {}) {
    const words = [cleanCloudText(a, 28), cleanCloudText(b, 28)].filter(Boolean);
    if (words.length !== 2) throw serviceError(400, "Two valid concepts are required.", "invalid_rejected_pair");
    const canonical = words.map((word) => canonicalChallengeText(word, 28)).sort();
    const fingerprint = this.signFor("rejected-pair", canonical.join("+"));
    const reporterSource = String(reporterId || cohortId || sessionId || "").trim();
    const reporter = reporterSource ? this.signFor("rejected-pair-reporter", reporterSource) : "";
    const data = this.data.rejectedPairs = normalizeRejectedPairData(this.data.rejectedPairs);
    const existing = data.entries[fingerprint] || {
      count: 0,
      lastSeenAt: date.toISOString(),
      sample: null,
      modes: {},
      reporters: {},
      reasons: {},
      suggestions: {}
    };
    const duplicate = Boolean(reporter && existing.reporters[reporter]);
    if (!duplicate) existing.count += 1;
    existing.lastSeenAt = date.toISOString();
    if (allowPlaintext) existing.sample = canonical;
    const safeMode = COMBINATION_REPORT_MODES.has(String(mode)) ? String(mode) : "reach";
    if (!duplicate) existing.modes[safeMode] = (existing.modes[safeMode] || 0) + 1;
    const safeReason = COMBINATION_REPORT_REASONS.has(String(reason)) ? String(reason) : "";
    if (!duplicate && safeReason) existing.reasons[safeReason] = (existing.reasons[safeReason] || 0) + 1;
    const safeExpected = allowPlaintext && expected ? canonicalChallengeText(expected, 28) : "";
    if (!duplicate && safeExpected) {
      const suggestionFingerprint = this.signFor("rejected-pair-suggestion", `${fingerprint}:${safeExpected}`);
      const suggestion = existing.suggestions[suggestionFingerprint] || { word: safeExpected, count: 0, lastSeenAt: date.toISOString() };
      suggestion.count += 1;
      suggestion.lastSeenAt = date.toISOString();
      existing.suggestions[suggestionFingerprint] = suggestion;
      existing.suggestions = Object.fromEntries(Object.entries(existing.suggestions)
        .sort((left, right) => right[1].count - left[1].count || Date.parse(right[1].lastSeenAt) - Date.parse(left[1].lastSeenAt))
        .slice(0, MAX_REJECTED_PAIR_SUGGESTIONS));
    }
    if (reporter) existing.reporters[reporter] = date.toISOString();
    data.entries[fingerprint] = existing;
    data.entries = Object.fromEntries(Object.entries(data.entries)
      .sort((left, right) => Date.parse(right[1].lastSeenAt) - Date.parse(left[1].lastSeenAt))
      .slice(0, MAX_REJECTED_PAIR_REPORTS));
    data.updatedAt = date.toISOString();
    return { accepted: true, fingerprint, duplicate, reviewable: Boolean(existing.sample) };
  }

  async recordCombinationReport({ a, b, expected = "", reason = "", mode, reporterId }, date = new Date()) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw serviceError(400, "A valid report date is required.", "invalid_combination_report_date");
    }
    const safeA = cleanCombinationReportConcept(a);
    const safeB = cleanCombinationReportConcept(b);
    const safeExpected = cleanCombinationReportConcept(expected, { optional: true });
    if (reason !== null && reason !== undefined && typeof reason !== "string") {
      throw serviceError(400, "Choose one of the available report reasons.", "invalid_combination_report_reason");
    }
    const safeReason = reason || "";
    if (safeReason && !COMBINATION_REPORT_REASONS.has(safeReason)) {
      throw serviceError(400, "Choose one of the available report reasons.", "invalid_combination_report_reason");
    }
    const safeMode = String(mode || "");
    if (!COMBINATION_REPORT_MODES.has(safeMode)) {
      throw serviceError(400, "That game mode cannot be reported.", "invalid_combination_report_mode");
    }
    if (typeof reporterId !== "string" || !ANALYTICS_COHORT_PATTERN.test(reporterId)) {
      throw serviceError(400, "A privacy-safe reporter ID is required.", "invalid_combination_report_reporter");
    }
    const result = this.recordRejectedPairExpectation({
      a: safeA,
      b: safeB,
      expected: safeExpected,
      reason: safeReason,
      mode: safeMode,
      reporterId
    }, date, { allowPlaintext: true });
    await this.persist();
    return result;
  }

  rejectedPairSummary({ minimumReports = 1, limit = 100 } = {}) {
    const threshold = clamp(Math.floor(Number(minimumReports) || 1), 1, 100_000);
    const cappedLimit = clamp(Math.floor(Number(limit) || 100), 1, 500);
    const data = normalizeRejectedPairData(this.data.rejectedPairs);
    return {
      privacy: "reporter IDs are one-way keyed digests; reports contain only bounded word suggestions",
      reports: Object.entries(data.entries)
        .map(([fingerprint, entry]) => ({
          fingerprint,
          count: entry.count,
          pair: entry.sample,
          suggestions: Object.values(entry.suggestions)
            .map((suggestion) => ({ word: suggestion.word, count: suggestion.count, lastSeenAt: suggestion.lastSeenAt }))
            .sort((left, right) => right.count - left.count || Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt)),
          reasons: entry.reasons,
          modes: entry.modes,
          lastSeenAt: entry.lastSeenAt,
          reviewable: Boolean(entry.sample)
        }))
        .filter((entry) => entry.count >= threshold)
        .sort((left, right) => right.count - left.count || Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt))
        .slice(0, cappedLimit),
      updatedAt: data.updatedAt
    };
  }

  async recordAnalyticsEvent({ name, sessionId, cohortId = "", properties = {} }, date = new Date(), { allowRejectedPairPlaintext = false } = {}) {
    if (!analyticsEventNames.has(name)) throw serviceError(400, "That analytics event is not available.", "invalid_analytics_event");
    if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 64) throw serviceError(400, "A valid analytics session is required.", "invalid_analytics_session");
    if (cohortId && !ANALYTICS_COHORT_PATTERN.test(String(cohortId))) throw serviceError(400, "A valid privacy-safe cohort ID is required.", "invalid_analytics_cohort");
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw serviceError(400, "A valid analytics date is required.", "invalid_analytics_date");

    const analytics = this.data.analytics = normalizeAnalyticsData(this.data.analytics);
    const dayKey = date.toISOString().slice(0, 10);
    const day = analytics.days[dayKey] ||= { events: {}, sessionHashes: {}, cohortHashes: {}, segments: {}, metrics: {} };
    day.events[name] = (day.events[name] || 0) + 1;
    analytics.totals.events[name] = (analytics.totals.events[name] || 0) + 1;
    day.sessionHashes[this.signFor("analytics-session", `${dayKey}:${sessionId}`)] = true;
    if (cohortId) day.cohortHashes[this.signFor("analytics-cohort", String(cohortId))] = true;

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

    let rejectedPair = null;
    if (name === "combination_expected") {
      rejectedPair = this.recordRejectedPairExpectation({ a: safeProperties.a, b: safeProperties.b, mode: safeProperties.mode, sessionId, cohortId }, date, {
        allowPlaintext: allowRejectedPairPlaintext
      });
    }

    const oldestDay = new Date(date.getTime() - (ANALYTICS_RETENTION_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
    for (const storedDay of Object.keys(analytics.days)) if (storedDay < oldestDay || storedDay > dayKey) delete analytics.days[storedDay];
    analytics.updatedAt = date.toISOString();
    await this.persist();
    return { accepted: true, day: dayKey, cohortTracked: Boolean(cohortId), ...(rejectedPair ? { rejectedPair } : {}) };
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
    const uniqueCohorts = new Set();

    for (const [dayKey, day] of Object.entries(analytics.days).sort(([left], [right]) => left.localeCompare(right))) {
      if (dayKey < from || dayKey > through) continue;
      const sessions = Object.keys(day.sessionHashes).length;
      const cohortDigests = Object.keys(day.cohortHashes || {});
      for (const digest of cohortDigests) uniqueCohorts.add(digest);
      const eventCount = Object.values(day.events).reduce((sum, count) => sum + count, 0);
      dailyUniqueSessions += sessions;
      daily.push({ date: dayKey, sessions, cohorts: cohortDigests.length, events: eventCount });
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
      onboarding: {
        modeViews: eventCount("mode_screen_viewed"),
        started: eventCount("first_orbit_started"),
        firstCombination: eventCount("first_combination"),
        completed: eventCount("first_orbit_completed")
      },
      wish: { opened: eventCount("wish_opened"), used: eventCount("wish_used"), conversionPercent: conversionPercent(eventCount("wish_used"), eventCount("wish_opened")) },
      market: { opened: eventCount("market_opened"), purchased: eventCount("word_purchased"), conversionPercent: conversionPercent(eventCount("word_purchased"), eventCount("market_opened")) },
      guidance: {
        opened: Math.max(eventCount("sense_opened"), eventCount("powerups_opened")),
        used: eventCount("sense_used") + eventCount("quick_tip_used") + eventCount("word_gift_used"),
        revealed: eventCount("answer_revealed")
      },
      ghost: { started: eventCount("ghost_race_started"), completed: eventCount("ghost_race_completed"), completionPercent: conversionPercent(eventCount("ghost_race_completed"), eventCount("ghost_race_started")) },
      mastery: { opened: eventCount("mastery_opened"), progressed: eventCount("mastery_progressed"), completed: eventCount("mastery_completed") },
      constellation: {
        journeyViews: eventCount("journey_opened"),
        voyagesStarted: eventCount("voyage_started"),
        voyagesCompleted: eventCount("voyage_completed"),
        eventsStarted: eventCount("event_started"),
        eventDiscoveries: eventCount("event_discovery"),
        signaturesGraded: eventCount("signature_graded"),
        communityViews: eventCount("community_viewed")
      },
      cosmosCircuit: {
        opened: eventCount("cosmos_circuit_opened"),
        started: eventCount("cosmos_circuit_started"),
        completed: eventCount("cosmos_circuit_completed"),
        extracted: eventCount("cosmos_circuit_extracted"),
        abandoned: eventCount("cosmos_circuit_abandoned"),
        tutorialViewed: eventCount("cosmos_circuit_tutorial_viewed"),
        tutorialCompleted: eventCount("cosmos_circuit_tutorial_completed"),
        challengesCompleted: eventCount("cosmos_circuit_challenge_completed"),
        weeklyRewardsClaimed: eventCount("cosmos_circuit_weekly_reward_claimed"),
        personalBests: eventCount("cosmos_circuit_personal_best"),
        rewarded: segments.cosmos_circuit_completed?.reward?.true || 0
      },
      starPath: {
        opened: eventCount("star_path_opened"),
        tutorialViewed: eventCount("star_path_tutorial_viewed"),
        tutorialCompleted: eventCount("star_path_tutorial_completed"),
        rewardsClaimed: eventCount("star_path_reward_claimed")
      }
    };
    funnels.play.startRatePercent = conversionPercent(funnels.play.started, funnels.play.opened);
    funnels.play.completionPercent = conversionPercent(funnels.play.completed, funnels.play.started);
    funnels.onboarding.startRatePercent = conversionPercent(funnels.onboarding.started, funnels.onboarding.modeViews || funnels.play.opened);
    funnels.onboarding.firstCombinationRatePercent = conversionPercent(funnels.onboarding.firstCombination, funnels.onboarding.started);
    funnels.onboarding.completionPercent = conversionPercent(funnels.onboarding.completed, funnels.onboarding.started);
    funnels.constellation.voyageCompletionPercent = conversionPercent(funnels.constellation.voyagesCompleted, funnels.constellation.voyagesStarted);
    funnels.guidance.useRatePercent = conversionPercent(funnels.guidance.used, funnels.guidance.opened);
    funnels.cosmosCircuit.startRatePercent = conversionPercent(funnels.cosmosCircuit.started, funnels.cosmosCircuit.opened);
    funnels.cosmosCircuit.completionPercent = conversionPercent(funnels.cosmosCircuit.completed, funnels.cosmosCircuit.started);
    funnels.cosmosCircuit.rewardPercent = conversionPercent(funnels.cosmosCircuit.rewarded, funnels.cosmosCircuit.completed);
    funnels.starPath.claimRatePercent = conversionPercent(funnels.starPath.rewardsClaimed, funnels.starPath.opened);
    funnels.sense = { ...funnels.guidance, purchased: eventCount("sense_purchased") };
    funnels.reengagement = {
      retries: eventCount("run_retried"),
      shares: eventCount("card_shared") + eventCount("share_created"),
      supporterInterest: eventCount("supporter_interest")
    };
    const economy = {
      checkoutStarts: eventCount("checkout_started"),
      wordPurchases: eventCount("word_purchased"),
      wordCreditsSpent: metricSum("word_purchased", "credits", "cost"),
      cosmeticPurchases: eventCount("cosmetic_purchased"),
      cosmeticCreditsSpent: metricSum("cosmetic_purchased", "credits", "cost"),
      sensePurchases: eventCount("sense_purchased"),
      senseStardustSpent: metricSum("sense_purchased", "cost"),
      circuitRewardedFlights: segments.cosmos_circuit_completed?.reward?.true || 0,
      starPathRewardsClaimed: eventCount("star_path_reward_claimed")
    };

    const allDays = Object.entries(analytics.days).sort(([left], [right]) => left.localeCompare(right));
    const cohortsByDay = new Map(allDays.map(([dayKey, day]) => [dayKey, new Set(Object.keys(day.cohortHashes || {}))]));
    const firstSeen = new Map();
    for (const [dayKey, cohortSet] of cohortsByDay) for (const digest of cohortSet) if (!firstSeen.has(digest)) firstSeen.set(digest, dayKey);
    const cohortRows = [];
    for (const [cohortDay, cohortSet] of cohortsByDay) {
      if (cohortDay < from || cohortDay > through) continue;
      const starters = [...cohortSet].filter((digest) => firstSeen.get(digest) === cohortDay);
      if (!starters.length) continue;
      const dayAt = (offset) => new Date(Date.parse(`${cohortDay}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
      const retained = (offset) => {
        const compareDay = dayAt(offset);
        if (compareDay > through) return null;
        const active = cohortsByDay.get(compareDay) || new Set();
        return starters.filter((digest) => active.has(digest)).length;
      };
      cohortRows.push({ date: cohortDay, size: starters.length, d1Returned: retained(1), d7Returned: retained(7) });
    }
    const retentionMetric = (field) => {
      const eligibleRows = cohortRows.filter((row) => row[field] !== null);
      const eligible = eligibleRows.reduce((sum, row) => sum + row.size, 0);
      const returned = eligibleRows.reduce((sum, row) => sum + row[field], 0);
      return { eligible, returned, percent: conversionPercent(returned, eligible) };
    };
    const retention = { d1: retentionMetric("d1Returned"), d7: retentionMetric("d7Returned"), cohorts: cohortRows };

    return {
      privacy: "aggregate-only",
      cohortPrivacy: "pseudonymous keyed cohorts; no raw cohort identifiers",
      period: { days, from, through },
      dailyUniqueSessions,
      uniqueCohorts: uniqueCohorts.size,
      retention,
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

  demandForPeriod(wordId, period) {
    const stored = this.data.demand[wordId] || {};
    const migratedPeriod = Number.isInteger(stored.activePeriod)
      ? stored.activePeriod
      : Number.isInteger(stored.activeMinute) ? Math.floor(stored.activeMinute / (MARKET_REPRICE_INTERVAL_MS / 60_000)) : period;
    const demand = {
      ema: stored.ema,
      purchases: stored.purchases,
      activePeriod: migratedPeriod,
      purchasesThisPeriod: stored.purchasesThisPeriod ?? stored.purchasesThisMinute
    };
    demand.ema = clamp(Number(demand.ema) || 0, 0, 1);
    demand.purchases = Math.max(0, Number(demand.purchases) || 0);
    if (!Number.isInteger(demand.activePeriod)) demand.activePeriod = period;
    demand.purchasesThisPeriod = Math.max(0, Number(demand.purchasesThisPeriod) || 0);

    if (period > demand.activePeriod) {
      const completedPeriodPurchases = Math.min(20, Math.floor(demand.purchasesThisPeriod));
      for (let index = 0; index < completedPeriodPurchases; index += 1) demand.ema = demand.ema * .82 + .18;
      const idlePeriods = Math.max(0, period - demand.activePeriod - 1);
      if (idlePeriods) demand.ema *= .82 ** idlePeriods;
      demand.ema = clamp(demand.ema, 0, 1);
      demand.activePeriod = period;
      demand.purchasesThisPeriod = 0;
    }

    this.data.demand[wordId] = demand;
    return demand;
  }

  marketSnapshot(playerId, now = Date.now()) {
    const player = this.data.players[playerId];
    const period = Math.floor(now / MARKET_REPRICE_INTERVAL_MS);
    const nextRepriceAt = (period + 1) * MARKET_REPRICE_INTERVAL_MS;
    const items = MARKET_CATALOG.map((item) => {
      const demand = this.demandForPeriod(item.id, period).ema;
      const trend = marketTrend(item, period, demand);
      const price = trend.at(-1);
      const previous = trend.at(-2) || price;
      const quotePayload = `v2:${item.id}:${period}:${price}`;
      return {
        ...item,
        price,
        owned: Boolean(player?.licenses[item.id]),
        competitive: false,
        useDivision: "open",
        changePercent: previous ? Number((((price - previous) / previous) * 100).toFixed(1)) : 0,
        trend,
        quoteId: `${quotePayload}.${this.signFor("market-quote", quotePayload)}`,
        quoteExpiresAt: new Date(nextRepriceAt).toISOString()
      };
    });
    return { cadence: "six_hours", cadenceMs: MARKET_REPRICE_INTERVAL_MS, serverTime: new Date(now).toISOString(), nextRepriceAt: new Date(nextRepriceAt).toISOString(), balance: player?.credits || 0, items };
  }

  verifyQuote(quoteId, now = Date.now()) {
    if (typeof quoteId !== "string") return null;
    const split = quoteId.lastIndexOf(".");
    if (split < 1) return null;
    const payload = quoteId.slice(0, split);
    const signature = quoteId.slice(split + 1);
    if (!this.verifyFor("market-quote", payload, signature)) return null;
    const [version, wordId, periodText, priceText] = payload.split(":");
    if (version !== "v2") return null;
    const period = Number(periodText);
    const price = Number(priceText);
    if (!catalogById.has(wordId) || !Number.isInteger(period) || !Number.isFinite(price) || period !== Math.floor(now / MARKET_REPRICE_INTERVAL_MS)) return null;
    const demand = this.demandForPeriod(wordId, period).ema;
    if (marketPrice(wordId, period, demand) !== price) return null;
    return { item: catalogById.get(wordId), period, price };
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
    this.appendLedger("economyLedger", {
      idempotencyKey: `word-license:${playerId}:${idempotencyKey}`,
      type: "word_license_purchased",
      playerId,
      wordId: quote.item.id,
      currency: "star_credits",
      amount: -quote.price,
      createdAt: this.now().toISOString()
    });
    const demand = this.demandForPeriod(quote.item.id, quote.period);
    demand.purchasesThisPeriod += 1;
    demand.purchases += 1;
    const result = { item: { ...quote.item, owned: true, competitive: false, useDivision: "open" }, balance: player.credits, price: quote.price, competitive: false, useDivision: "open" };
    player.purchaseKeys[idempotencyKey] = { quoteId, result };
    await this.persist();
    return result;
  }

  async buyCosmeticCollection(playerId, collectionId, idempotencyKey) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const purchaseKey = String(idempotencyKey || "");
    if (!/^[\w-]{8,80}$/.test(purchaseKey)) {
      throw serviceError(400, "A valid purchase key is required.", "invalid_idempotency_key");
    }
    const collection = cosmeticCollectionById(collectionId);
    if (!collection) {
      throw serviceError(404, "That cosmetic collection does not exist.", "cosmetic_collection_missing");
    }
    const price = Number(collection.creditPrice);
    if (!Number.isSafeInteger(price) || price <= 0) {
      throw serviceError(409, "That cosmetic collection is not available for Star Credits.", "cosmetic_collection_not_for_sale");
    }

    player.purchaseKeys ||= {};
    const previous = player.purchaseKeys[purchaseKey];
    if (previous) {
      if (previous.collectionId !== collection.id || previous.quoteId) {
        throw serviceError(409, "That purchase key was already used for another item.", "idempotency_conflict");
      }
      return previous.result || previous;
    }
    if (this.cosmeticOwnership(playerId).collections.includes(collection.id)) {
      throw serviceError(409, "You already own this cosmetic collection.", "cosmetic_collection_already_owned");
    }
    if (player.credits < price) {
      throw serviceError(402, "Not enough Star Credits.", "insufficient_credits", {
        balance: player.credits,
        price
      });
    }

    const purchasedAt = this.now();
    player.credits -= price;
    const entitlements = normalizePlayerCosmeticEntitlements(player.cosmeticEntitlements);
    entitlements.collections.push(collection.id);
    entitlements.collections.sort();
    player.cosmeticEntitlements = entitlements;
    this.appendLedger("economyLedger", {
      idempotencyKey: `cosmetic-purchase:${playerId}:${purchaseKey}`,
      type: "cosmetic_collection_purchased",
      playerId,
      collectionId: collection.id,
      currency: "star_credits",
      amount: -price,
      createdAt: purchasedAt.toISOString()
    });
    this.appendLedger("entitlementLedger", {
      idempotencyKey: `cosmetic-purchase:${playerId}:${purchaseKey}`,
      type: "cosmetic_entitlement_granted",
      playerId,
      itemId: null,
      collectionId: collection.id,
      source: "credits",
      createdAt: purchasedAt.toISOString()
    });
    const result = {
      collection: {
        id: collection.id,
        slug: collection.slug,
        label: collection.label,
        owned: true
      },
      balance: player.credits,
      price,
      currency: "star_credits",
      ownership: this.cosmeticOwnership(playerId),
      competitive: false
    };
    player.purchaseKeys[purchaseKey] = { collectionId: collection.id, result };
    await this.recordAnalyticsEvent({
      name: "cosmetic_purchased",
      sessionId: `cosmetic-purchase:${playerId}`,
      properties: {
        collection: collection.slug,
        source: "credits",
        kind: "collection",
        outcome: "purchased",
        credits: price
      }
    }, purchasedAt);
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

  async grantCosmeticEntitlement(playerId, { itemId = "", collectionId = "", source = "test" } = {}) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    const canonicalItemId = String(itemId || "").trim();
    const canonicalCollectionId = String(collectionId || "").trim();
    if (Boolean(canonicalItemId) === Boolean(canonicalCollectionId)) {
      throw serviceError(400, "Grant exactly one cosmetic item or collection.", "invalid_cosmetic_entitlement");
    }
    if (canonicalItemId && !COSMETIC_ITEM_IDS.has(canonicalItemId)) {
      throw serviceError(400, "That cosmetic item does not exist.", "invalid_cosmetic_entitlement");
    }
    if (canonicalCollectionId && !COSMETIC_COLLECTION_IDS.has(canonicalCollectionId)) {
      throw serviceError(400, "That cosmetic collection does not exist.", "invalid_cosmetic_entitlement");
    }
    const normalized = normalizePlayerCosmeticEntitlements(player.cosmeticEntitlements);
    const field = canonicalItemId ? "items" : "collections";
    const grantId = canonicalItemId || canonicalCollectionId;
    if (!normalized[field].includes(grantId)) normalized[field].push(grantId);
    normalized[field].sort();
    player.cosmeticEntitlements = normalized;
    const safeSource = cleanCloudText(source, 32) || "test";
    this.appendLedger("entitlementLedger", {
      idempotencyKey: `cosmetic:${playerId}:${grantId}`,
      type: "cosmetic_entitlement_granted",
      playerId,
      itemId: canonicalItemId || null,
      collectionId: canonicalCollectionId || null,
      source: safeSource,
      createdAt: this.now().toISOString()
    });
    await this.persist();
    return this.cosmeticOwnership(playerId);
  }

  canUseWish(playerId, date = new Date()) {
    const player = this.data.players[playerId];
    if (!player) return false;
    // The Supporter Pack is cosmetic-only. Keep the date argument for API
    // compatibility with older callers, but never turn a paid entitlement into
    // additional gameplay assistance.
    void date;
    return !player.freeWishUsed;
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
    const challengeIdentity = entry.challengeKey && entry.challenge
      ? { key: entry.challengeKey, descriptor: entry.challenge }
      : buildChallengeIdentity({ ...entry, mode: entry.mode, target: entry.target }, { assist: entry.assist });
    const normalized = {
      ...structuredClone(entry),
      challengeKey: challengeIdentity.key,
      challenge: structuredClone(challengeIdentity.descriptor),
      attempts: Math.max(nonnegativeCounter(entry.attempts), nonnegativeCounter(entry.moves)),
      rejectedAttempts: nonnegativeCounter(entry.rejectedAttempts),
      errorless: nonnegativeCounter(entry.rejectedAttempts) === 0,
      status: entry.status === "provisional" ? "provisional" : "verified",
      anomalyFlags: Array.isArray(entry.anomalyFlags) ? [...new Set(entry.anomalyFlags.map((flag) => cleanCloudText(flag, 64)).filter(Boolean))].slice(0, 8) : []
    };
    const index = this.data.scores.findIndex((score) => score.playerId === normalized.playerId && (score.challengeKey || score.challengeId) === normalized.challengeKey && score.division === normalized.division);
    const current = index >= 0 ? this.data.scores[index] : null;
    // A suspicious replay must never displace a previously verified result.
    // Conversely, a later verified run should always replace the provisional
    // placeholder before the usual score comparison is applied.
    const shouldReplace = !current
      || (current.status === "provisional" && normalized.status === "verified")
      || (current.status !== "provisional" && normalized.status !== "provisional" && betterEntry(normalized, current))
      || (current.status === "provisional" && normalized.status === "provisional" && betterEntry(normalized, current));
    if (shouldReplace) {
      if (index >= 0) this.data.scores[index] = normalized;
      else this.data.scores.push(normalized);
    }
    this.appendLedger("runLedger", {
      idempotencyKey: `run:${normalized.runId}:completed`,
      type: "ranked_run_completed",
      runId: normalized.runId,
      playerId: normalized.playerId,
      challengeKey: normalized.challengeKey,
      division: normalized.division,
      score: normalized.score,
      moves: normalized.moves,
      rejectedAttempts: normalized.rejectedAttempts,
      status: normalized.status,
      createdAt: normalized.createdAt
    });
    if (normalized.status === "verified") {
      recordEarnedCosmeticUnlock(this.data.players[normalized.playerId], "wins");
      const progressionWrite = this.appendLedger("progressionLedger", {
        idempotencyKey: `progression:run:${normalized.runId}`,
        type: "verified_run_completed",
        runId: normalized.runId,
        playerId: normalized.playerId,
        challengeKey: normalized.challengeKey,
        dailyKey: normalized.mode === "daily" ? normalized.dailyKey : "",
        atlasXp: Math.max(10, Math.floor(nonnegativeCounter(normalized.score) / 2_000)),
        createdAt: normalized.createdAt
      });
      if (progressionWrite.appended && normalized.division === "pure") {
        this.recordCircuitPureWin(normalized.playerId, normalized.runId);
        this.recordStarPathWordWin(normalized.playerId, {
          runId: normalized.runId,
          verified: true,
          completed: true,
          mode: normalized.mode,
          division: normalized.division,
          challengeId: normalized.challengeId,
          practice: String(normalized.challengeId || "").startsWith("practice:")
        });
      }
    }
    if (this.data.scores.length > 5000) this.data.scores = this.data.scores.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5000);
    await this.persist();
    return this.rankFor(normalized.challengeKey, normalized.division, normalized.playerId);
  }

  leaderboard(scope, division = "pure", limit = 50, playerId = "", { challengeId = "", challengeKey = "", mode = "", includeProvisional = false } = {}) {
    const currentDaily = new Date().toISOString().slice(0, 10);
    const currentWeekly = isoWeekKey();
    const exactChallengeId = String(challengeId || "").trim().slice(0, 160);
    const exactChallengeKey = /^ch3_[A-Za-z0-9_-]{24}$/.test(String(challengeKey || "")) ? String(challengeKey) : "";
    const exactMode = ["reach", "quick", "moves", "daily", "weekly", "challenge"].includes(mode) ? mode : "";
    const filtered = this.data.scores.filter((entry) => {
      if (entry.division !== division) return false;
      if (!includeProvisional && entry.status === "provisional") return false;
      if (exactChallengeKey) return entry.challengeKey === exactChallengeKey;
      if (exactChallengeId) return entry.challengeId === exactChallengeId;
      if (exactMode && entry.mode !== exactMode) return false;
      if (scope === "daily") return entry.mode === "daily" && entry.dailyKey === currentDaily;
      if (scope === "weekly") return entry.mode === "weekly" && entry.weeklyKey === currentWeekly;
      if (scope === "sprint") return ["quick", "moves"].includes(entry.mode) && Date.now() - Date.parse(entry.createdAt) < 7 * 86400000;
      return true;
    }).sort(compareEntries);
    const top = filtered.slice(0, clamp(Number(limit) || 25, 1, 100)).map((entry, index) => publicEntry(entry, index + 1));
    const playerIndex = playerId ? filtered.findIndex((entry) => entry.playerId === playerId) : -1;
    return {
      scope,
      division,
      challengeId: exactChallengeId,
      challengeKey: exactChallengeKey,
      mode: exactMode,
      comparable: Boolean(exactChallengeKey || exactChallengeId || scope === "daily"),
      entries: top,
      playerEntry: playerIndex >= 0 ? publicEntry(filtered[playerIndex], playerIndex + 1) : null,
      community: communityForEntries(filtered, playerId),
      updatedAt: new Date().toISOString()
    };
  }

  rankFor(challengeId, division, playerId) {
    const entries = this.data.scores.filter((entry) => (entry.challengeKey === challengeId || entry.challengeId === challengeId) && entry.division === division && entry.status !== "provisional").sort(compareEntries);
    const index = entries.findIndex((entry) => entry.playerId === playerId);
    if (index >= 0) return {
      rank: index + 1,
      entry: publicEntry(entries[index], index + 1),
      community: communityForEntries(entries, playerId)
    };
    const provisional = this.data.scores.find((entry) => (entry.challengeKey === challengeId || entry.challengeId === challengeId) && entry.division === division && entry.playerId === playerId && entry.status === "provisional");
    return provisional ? { rank: null, provisional: true, entry: publicEntry(provisional, null), community: communityForEntries(entries, playerId) } : null;
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
    this.appendLedger("economyLedger", {
      idempotencyKey: `earned-credit:${playerId}:${date}:${player.earned.amount}`,
      type: "earned_credit_granted",
      playerId,
      currency: "star_credits",
      amount: grant,
      createdAt: this.now().toISOString()
    });
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
    if (rewardKey.startsWith("weekly:")) recordEarnedCosmeticUnlock(player, "weeklyComplete");
    if (creditReward) this.appendLedger("economyLedger", {
      idempotencyKey: `challenge-credit:${playerId}:${rewardKey}`,
      type: "challenge_credit_granted",
      playerId,
      challengeKey: rewardKey,
      currency: "star_credits",
      amount: creditReward,
      createdAt: date.toISOString()
    });

    const week = isoWeekKey(date);
    if (player.weeklyActivity?.week !== week) player.weeklyActivity = { week, days: [], bonusClaimed: false };
    if (!player.weeklyActivity.days.includes(day)) player.weeklyActivity.days.push(day);
    let weeklyBonus = 0;
    if (player.weeklyActivity.days.length >= 4 && !player.weeklyActivity.bonusClaimed) {
      weeklyBonus = 40;
      player.credits += weeklyBonus;
      player.weeklyActivity.bonusClaimed = true;
      this.appendLedger("economyLedger", {
        idempotencyKey: `weekly-bonus:${playerId}:${week}`,
        type: "weekly_credit_bonus",
        playerId,
        challengeKey: week,
        currency: "star_credits",
        amount: weeklyBonus,
        createdAt: date.toISOString()
      });
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
      delete player.sessions;
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
        rejectedPairs: normalizeRejectedPairData(this.data.rejectedPairs),
        recipeFeedback: normalizeRecipeFeedback(this.data.recipeFeedback),
        runLedger: structuredClone(this.data.runLedger || []),
        progressionLedger: structuredClone(this.data.progressionLedger || []),
        economyLedger: structuredClone(this.data.economyLedger || []),
        entitlementLedger: structuredClone(this.data.entitlementLedger || []),
        duelResults: structuredClone(this.data.duelResults || []),
        duelRatingLedger: structuredClone(this.data.duelRatingLedger || []),
        commerceTransactions: structuredClone(this.data.commerceTransactions || {}),
        dynamicRecipes: structuredClone(this.data.dynamicRecipes || {}),
        dynamicRecipeRevisions: structuredClone(this.data.dynamicRecipeRevisions || [])
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

  playerDataExport(playerId) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(404, "Player not found.", "player_missing");
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      player: this.publicPlayer(playerId),
      cloudProfile: this.cloudProfile(playerId),
      entitlements: this.entitlementSnapshot(playerId),
      duels: (this.data.duelResults || [])
        .filter((result) => Array.isArray(result?.participants) && result.participants.some((participant) => participant?.playerId === playerId))
        .map((result) => ({
          id: String(result.id || ""),
          kind: ["public", "rematch"].includes(result.kind) ? result.kind : "invite",
          format: ["target-race", "wordstorm", "forge-clash", "claim-war"].includes(result.format)
            ? result.format
            : "target-race",
          rated: result.rated === true,
          target: String(result.target || ""),
          startedAt: result.startedAt || null,
          settledAt: result.settledAt || null,
          finishReason: String(result.finishReason || ""),
          outcome: result.winnerPlayerId
            ? result.winnerPlayerId === playerId ? "won" : "lost"
            : "draw",
          participants: result.participants.map((participant) => ({
            callsign: String(participant?.callsign || ""),
            slot: participant?.slot === "slot-b" || Number(participant?.slot) === 1 ? "slot-b" : "slot-a",
            you: participant?.playerId === playerId,
            moves: Math.max(0, Math.floor(Number(participant?.moves) || 0)),
            attempts: Math.max(0, Math.floor(Number(participant?.attempts) || 0)),
            remaining: Math.max(0, Math.floor(Number(participant?.remaining) || 0))
          })),
          ratingReceipt: result.rated === true
            ? {
                seasonId: String(result.ratingReceipt?.seasonId || DUEL_SEASON_ID),
                format: ["target-race", "wordstorm", "forge-clash", "claim-war"].includes(result.ratingReceipt?.format)
                  ? result.ratingReceipt.format
                  : "target-race",
                rated: result.ratingReceipt?.rated === true,
                participants: (result.ratingReceipt?.participants || []).map((participant) => ({
                  slot: participant?.slot === "slot-b" || Number(participant?.slot) === 1 ? "slot-b" : "slot-a",
                  you: participant?.playerId === playerId,
                  before: Math.max(100, Math.round(Number(participant?.before) || DUEL_STARTING_RATING)),
                  after: Math.max(100, Math.round(Number(participant?.after) || DUEL_STARTING_RATING)),
                  delta: Math.round(Number(participant?.delta) || 0),
                  outcome: ["win", "loss", "draw"].includes(participant?.outcome) ? participant.outcome : "draw"
                }))
              }
            : null
        })),
      scores: this.data.scores
        .filter((entry) => entry.playerId === playerId)
        .map((entry) => ({
          challengeId: entry.challengeId,
          challengeKey: entry.challengeKey,
          challenge: structuredClone(entry.challenge || null),
          division: entry.division,
          assist: entry.assist,
          mode: entry.mode,
          target: entry.target,
          score: entry.score,
          moves: entry.moves,
          attempts: entry.attempts,
          rejectedAttempts: entry.rejectedAttempts,
          errorless: entry.errorless,
          status: entry.status || "verified",
          elapsedMs: entry.elapsedMs,
          signature: sanitizeRouteSignature(entry.signature),
          createdAt: entry.createdAt
        }))
    };
  }

  async deleteFreePlayerData(playerId) {
    const player = this.data.players[playerId];
    if (!player) return { deleted: true };
    const hasPaidOwnership = Boolean(player.founderPass)
      || Object.values(player.entitlements || {}).some((entitlement) => entitlement?.active && entitlement?.source !== "test")
      || Object.values(this.data.commerceTransactions || {}).some((transaction) => transaction?.playerId === playerId);
    if (hasPaidOwnership) {
      throw serviceError(409, "Paid ownership requires support-assisted deletion so receipts and refunds remain correct.", "paid_deletion_requires_support");
    }
    delete this.data.players[playerId];
    this.data.scores = this.data.scores.filter((entry) => entry.playerId !== playerId);
    for (const ledger of ["runLedger", "progressionLedger", "economyLedger", "entitlementLedger", "duelRatingLedger"]) {
      this.data[ledger] = (this.data[ledger] || []).filter((entry) =>
        entry?.playerId !== playerId
        && (
          ledger !== "duelRatingLedger"
          || !Array.isArray(entry?.participants)
          || !entry.participants.some((participant) => participant?.playerId === playerId)
        )
      );
    }
    for (const [duelId, duel] of Object.entries(this.data.duels || {})) {
      if (Array.isArray(duel?.participants) && duel.participants.some((participant) => participant?.playerId === playerId)) {
        delete this.data.duels[duelId];
      }
    }
    this.data.duelResults = (this.data.duelResults || []).filter((result) =>
      !Array.isArray(result?.participants)
      || !result.participants.some((participant) => participant?.playerId === playerId)
    );
    for (const [runId, run] of Object.entries(this.data.runs || {})) if (run?.playerId === playerId) delete this.data.runs[runId];
    for (const [transactionId, transaction] of Object.entries(this.data.commerceTransactions || {})) {
      if (transaction?.playerId === playerId) delete this.data.commerceTransactions[transactionId];
    }
    await this.persist();
    return { deleted: true };
  }

  dynamicRecipeCatalog({ statuses = ["promoted"] } = {}) {
    const allowed = new Set(Array.isArray(statuses) ? statuses : [statuses]);
    return Object.values(normalizeDynamicRecipeCatalog(this.data.dynamicRecipes))
      .filter((recipe) => allowed.has(recipe.status))
      .map((recipe) => structuredClone(recipe));
  }

  async rememberDynamicRecipes(recipes, date = new Date(), metadata = {}) {
    if (!Array.isArray(recipes) || !recipes.length) return { stored: 0 };
    this.data.dynamicRecipes ||= {};
    let stored = 0;
    for (const value of recipes.slice(0, 16)) {
      const a = cleanCloudText(value?.a, 28);
      const b = cleanCloudText(value?.b, 28);
      const word = cleanCloudText(value?.word, 28);
      const emoji = cleanCloudText(value?.emoji, 12);
      const note = cleanCloudText(value?.note, 100);
      if (!a || !b || !word || !emoji || !note) continue;
      const key = [a, b].map((item) => item.toLocaleLowerCase("en-US")).sort().join("+");
      const existing = this.data.dynamicRecipes[key];
      const proposed = normalizeDynamicRecipeRecord({
        a,
        b,
        word,
        emoji,
        note,
        source: value?.source === "ai-route" ? "ai-route" : "ai",
        status: existing?.status || "quarantined",
        proposalId: existing?.proposalId || this.signFor("ai-recipe-proposal", `${key}:${word}:${date.toISOString()}`).slice(0, 24),
        promptVersion: value?.promptVersion || metadata.promptVersion || "combine-v1",
        model: value?.model || metadata.model || "unknown",
        provenance: value?.provenance || metadata.provenance || "live-unranked-ai",
        revision: Math.max(1, Number(existing?.revision) || 1),
        createdAt: existing?.createdAt || date.toISOString(),
        generatedAt: existing?.generatedAt || date.toISOString(),
        lastUsedAt: date.toISOString()
      }, key);
      if (!proposed) continue;
      this.data.dynamicRecipes[key] = proposed;
      stored += 1;
    }
    const entries = Object.entries(this.data.dynamicRecipes);
    if (entries.length > 1_000) {
      entries.sort((left, right) => Date.parse(right[1].lastUsedAt || right[1].createdAt || 0) - Date.parse(left[1].lastUsedAt || left[1].createdAt || 0));
      this.data.dynamicRecipes = Object.fromEntries(entries.slice(0, 1_000));
    }
    if (stored) await this.persist();
    return { stored };
  }

  dynamicRecipeReviewQueue({ status = "quarantined", limit = 100 } = {}) {
    const allowedStatus = ["quarantined", "promoted", "rejected", "rolled_back"].includes(status) ? status : "quarantined";
    return Object.values(normalizeDynamicRecipeCatalog(this.data.dynamicRecipes))
      .filter((recipe) => recipe.status === allowedStatus)
      .sort((left, right) => Date.parse(right.lastUsedAt || right.createdAt) - Date.parse(left.lastUsedAt || left.createdAt))
      .slice(0, clamp(Math.floor(Number(limit) || 100), 1, 500))
      .map((recipe) => structuredClone(recipe));
  }

  async reviewDynamicRecipe(proposalId, action, { reviewer = "operator", reason = "" } = {}, date = this.now()) {
    const safeProposalId = String(proposalId || "").trim();
    const nextStatus = { promote: "promoted", reject: "rejected", rollback: "rolled_back" }[action];
    if (!nextStatus) throw serviceError(400, "That recipe review action is not available.", "invalid_recipe_review_action");
    const pair = Object.entries(this.data.dynamicRecipes || {}).find(([, recipe]) => recipe?.proposalId === safeProposalId);
    if (!pair) throw serviceError(404, "That AI recipe proposal was not found.", "dynamic_recipe_missing");
    const [key, existing] = pair;
    const before = existing.status || "quarantined";
    const updated = {
      ...existing,
      status: nextStatus,
      revision: Math.max(1, Number(existing.revision) || 1) + 1,
      reviewedAt: date.toISOString(),
      reviewedBy: cleanCloudText(reviewer, 80) || "operator",
      reviewReason: cleanCloudText(reason, 160)
    };
    this.data.dynamicRecipes[key] = updated;
    this.data.dynamicRecipeRevisions ||= [];
    this.data.dynamicRecipeRevisions.push({
      id: randomUUID(),
      proposalId: safeProposalId,
      pairKey: this.signFor("ai-pair-key", key),
      from: before,
      to: nextStatus,
      reviewer: updated.reviewedBy,
      reason: updated.reviewReason,
      createdAt: date.toISOString()
    });
    this.data.dynamicRecipeRevisions = this.data.dynamicRecipeRevisions.slice(-MAX_LEDGER_ENTRIES);
    await this.persist();
    return structuredClone(updated);
  }

  storageHealth() {
    const health = typeof this.storage.health === "function" ? this.storage.health() : { kind: this.storage.kind || "custom", ready: true, contractVersion: STORAGE_CONTRACT_VERSION };
    return {
      ...health,
      commerceSafe: health.commerceSafe === true,
      schemaVersion: this.data.version,
      pendingWrites: false
    };
  }

  persist() {
    const write = async () => {
      if (this.storage instanceof JsonGameStorage && this.storage.path !== this.path) {
        this.storage.path = this.path;
        this.storage.kind = this.path === ":memory:" ? "memory" : "json";
      }
      return this.storage.save(this.data);
    };
    // A failed write must reject its own caller without permanently poisoning
    // the serialization queue. The next persistence attempt still runs after
    // either outcome of the prior promise.
    this.writeQueue = this.writeQueue.then(write, write);
    return this.writeQueue;
  }
}

const RUN_SNAPSHOT_VERSION = 5;
const ORIGIN_STARTER_WORDS = new Set(["earth", "water", "fire", "air"]);
const RUN_ENTRY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{15,79}$/;
const RUN_ENTRY_CHALLENGE_KEY_PATTERN = /^re1_[A-Za-z0-9_-]{24}$/;

export function normalizeRunEntryId(value) {
  if (value === undefined) return null;
  if (typeof value !== "string" || !RUN_ENTRY_ID_PATTERN.test(value)) {
    throw serviceError(
      400,
      "Run entry IDs must be 16 to 80 letters, numbers, or hyphens.",
      "invalid_run_entry_id"
    );
  }
  return value;
}

function runEntryChallengeKey(game, {
  ranked = false,
  challengeId = "",
  scoringDisabled = false,
  forfeitReason = ""
} = {}) {
  const descriptor = {
    challengeKey: buildChallengeIdentity(game, { assist: "none" }).key,
    ranked: Boolean(ranked),
    challengeId: String(challengeId || "").slice(0, 160),
    scoringDisabled: Boolean(scoringDisabled),
    forfeitReason: scoringDisabled ? studyAssistFor(forfeitReason) : null
  };
  return `re1_${createHash("sha256").update(JSON.stringify(descriptor)).digest("base64url").slice(0, 24)}`;
}

function runStarterItem(game, word) {
  const clean = String(word || "").normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 80);
  const item = [
    ...(Array.isArray(game?.starterItems) ? game.starterItems : []),
    ...(Array.isArray(game?.startProfile?.starterItems) ? game.startProfile.starterItems : [])
  ].find((candidate) => String(candidate?.word || "").trim().toLowerCase() === clean.toLowerCase());
  const loaned = !ORIGIN_STARTER_WORDS.has(clean.toLowerCase());
  return {
    word: clean,
    emoji: String(item?.emoji || "").trim().slice(0, 24),
    category: item?.category == null ? null : String(item.category).trim().toLowerCase().slice(0, 40) || null,
    source: loaned ? "loaned-start" : "origin",
    note: loaned ? "Loaned for this challenge." : "One of the four original elements.",
    loaned,
    premium: false,
    paid: false,
    access: loaned ? "loaned" : "origin",
    feedbackEligible: true
  };
}

function sanitizeRunTipRecords(raw) {
  const records = [];
  const ids = new Set();
  for (const value of Array.isArray(raw) ? raw.slice(0, QUICK_TIP_LIMIT) : []) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const text = String(value.text || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
    let id = String(value.id || "").trim().toLowerCase().slice(0, 80);
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) || ids.has(id)) id = `restored-${records.length + 1}`;
    if (!text) continue;
    ids.add(id);
    records.push({ id, text });
  }

  return records;
}

function publicTipResponse(record, used, available = Boolean(record)) {
  const count = Math.min(QUICK_TIP_LIMIT, Math.max(0, Number(used) || 0));
  return {
    available: Boolean(available),
    text: String(record?.text || "All three Route Signals have been used for this orbit.").slice(0, 240),
    used: count,
    remaining: Math.max(0, QUICK_TIP_LIMIT - count),
    scoreSafe: true
  };
}

function studyAssistFor(reason, fallback = "reveal") {
  const value = String(reason || "").trim().toLowerCase();
  return ["reveal", "sense", "gift"].includes(value) ? value : fallback;
}

export function effectiveRunStartedAt(run) {
  const activatedAt = Number(run?.activatedAt);
  return Number.isFinite(activatedAt) && activatedAt > 0
    ? activatedAt
    : Number(run?.startedAt) || 0;
}

function serializeRun(run) {
  return {
    version: RUN_SNAPSHOT_VERSION,
    runId: run.runId,
    playerId: run.playerId,
    game: structuredClone(run.game),
    ranked: Boolean(run.ranked),
    challengeId: run.challengeId,
    entryId: run.entryId,
    entryChallengeKey: run.entryChallengeKey,
    startedAt: run.startedAt,
    activatedAt: run.activatedAt,
    expiresAt: run.expiresAt,
    discovered: [...run.discovered.values()].map((item) => structuredClone(item)),
    moves: run.moves,
    attempts: run.attempts,
    rejectedAttempts: run.rejectedAttempts,
    actionTimes: Array.isArray(run.actionTimes) ? run.actionTimes.slice(-64) : [],
    challengeBaseIdentity: run.challengeBaseIdentity ? structuredClone(run.challengeBaseIdentity) : null,
    finalChallengeKey: typeof run.finalChallengeKey === "string" ? run.finalChallengeKey : null,
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
    remixRuntime: run.remixRuntime ? structuredClone(run.remixRuntime) : null,
    remixProgress: run.remixProgress ? structuredClone(run.remixProgress) : null,
    giftUsed: Boolean(run.giftUsed),
    giftItem: run.giftItem ? structuredClone(run.giftItem) : null,
    tipRecords: sanitizeRunTipRecords(run.tipRecords),
    twistUsed: Boolean(run.twistUsed),
    twistedPairKey: run.twistedPairKey,
    usedBend: Boolean(run.usedBend),
    bendItem: run.bendItem ? structuredClone(run.bendItem) : null,
    history: run.history.map((step) => structuredClone(step)),
    recipeFeedbackMoves: run.recipeFeedbackMoves instanceof Set ? [...run.recipeFeedbackMoves] : [],
    recipeFeedbackRecipes: run.recipeFeedbackRecipes instanceof Set ? [...run.recipeFeedbackRecipes] : [],
    completedAt: run.completedAt,
    submitted: Boolean(run.submitted),
    verifiedSignature: sanitizeRouteSignature(run.verifiedSignature)
  };
}

const ROUTE_REMIX_FAMILY_SET = new Set(ROUTE_REMIX_FAMILIES);

function storedRemixFamily(value) {
  const family = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ROUTE_REMIX_FAMILY_SET.has(family) ? family : "";
}

function validatedSnapshotRemixRuntime(game, candidate) {
  const envelope = game?.remixes;
  if (!envelope) return candidate == null
    ? { valid: true, runtime: null }
    : { valid: false, runtime: null };
  if (
    !envelope
    || typeof envelope !== "object"
    || Array.isArray(envelope)
    || !Array.isArray(envelope.rules)
    || envelope.rules.length > ROUTE_REMIX_FAMILIES.length
    || !candidate
    || typeof candidate !== "object"
    || Array.isArray(candidate)
  ) return { valid: false, runtime: null };

  const expectedFamilies = [];
  const expectedDetails = [];
  const seen = new Set();
  for (const rule of envelope.rules) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return { valid: false, runtime: null };
    const family = storedRemixFamily(rule.family);
    if (!family || seen.has(family)) return { valid: false, runtime: null };
    seen.add(family);
    expectedFamilies.push(family);
    expectedDetails.push(String(rule.detail || ""));
  }
  const activeCount = Number(envelope.activeCount);
  const version = Number(envelope.version);
  if (
    !Number.isInteger(activeCount)
    || activeCount !== expectedFamilies.length
    || version !== ROUTE_REMIX_VERSION
    || !/^rmx1_[a-z0-9]+$/.test(String(envelope.selectionId || ""))
  ) return { valid: false, runtime: null };

  const runtime = sanitizeRouteRemixRuntime(candidate);
  if (
    runtime.version !== version
    || runtime.target.toLowerCase() !== String(game.target || "").trim().toLowerCase()
    || runtime.activeFamilies.length !== expectedFamilies.length
    || runtime.activeFamilies.some((family, index) => family !== expectedFamilies[index])
  ) return { valid: false, runtime: null };

  const publicRules = publicRouteRemixView(runtime).remixes;
  if (
    publicRules.length !== expectedDetails.length
    || publicRules.some((rule, index) => (
      rule.family !== expectedFamilies[index]
      || rule.detail !== expectedDetails[index]
    ))
  ) return { valid: false, runtime: null };
  return { valid: true, runtime };
}

function rebuildSnapshotRemixProgress(runtime, history) {
  let progress = createRouteRemixProgress();
  let completed = false;
  for (const step of history) {
    if (step.revealed === true || String(step.source || "").toLowerCase() === "reveal") continue;
    if (
      completed
      || typeof step.a !== "string"
      || typeof step.b !== "string"
      || typeof step.word !== "string"
      || !step.a.trim()
      || !step.b.trim()
      || !step.word.trim()
    ) return null;
    const recorded = recordRouteRemixCombination(runtime, progress, {
      a: step.a,
      b: step.b,
      word: step.word,
      successful: true
    });
    if (!recorded.accepted) return null;
    progress = recorded.progress;
    if (step.word.trim().toLowerCase() === runtime.target.toLowerCase()) {
      completed = checkRouteRemixCompletion(runtime, progress, step.word).complete;
    }
  }
  return { progress, completed };
}

function sameRemixProgress(left, right) {
  return JSON.stringify(sanitizeRouteRemixProgress(left))
    === JSON.stringify(sanitizeRouteRemixProgress(right));
}

function hydrateRun(snapshot, players) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const runId = String(snapshot.runId || "");
  const playerId = String(snapshot.playerId || "");
  const startedAt = Number(snapshot.startedAt);
  const expiresAt = Number(snapshot.expiresAt);
  const ranked = Boolean(snapshot.ranked);
  const snapshotVersion = Math.max(1, Math.floor(Number(snapshot.version) || 1));
  const completedAt = snapshot.completedAt == null ? null : Number.isFinite(Number(snapshot.completedAt)) ? Number(snapshot.completedAt) : null;
  const game = snapshot.game;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(runId) || !players[playerId]) return null;
  if (!Number.isFinite(startedAt) || !Number.isFinite(expiresAt) || expiresAt <= startedAt) return null;
  if (!game || typeof game !== "object" || Array.isArray(game) || typeof game.target !== "string" || !Array.isArray(game.starters)) return null;
  const storedEntryId = RUN_ENTRY_ID_PATTERN.test(String(snapshot.entryId || ""))
    ? String(snapshot.entryId)
    : null;
  const storedEntryChallengeKey = RUN_ENTRY_CHALLENGE_KEY_PATTERN.test(String(snapshot.entryChallengeKey || ""))
    ? String(snapshot.entryChallengeKey)
    : null;
  const entryId = storedEntryId && storedEntryChallengeKey ? storedEntryId : null;
  const entryChallengeKey = entryId ? storedEntryChallengeKey : null;
  const pendingTimedActivation = Boolean(
    game.timeLimit
    && snapshot.activatedAt === null
    && nonnegativeCounter(snapshot.moves) === 0
    && nonnegativeCounter(snapshot.attempts) === 0
    && !completedAt
  );
  const storedActivatedAt = Number(snapshot.activatedAt);
  const activatedAt = pendingTimedActivation
    ? null
    : Number.isFinite(storedActivatedAt) && storedActivatedAt > 0
      ? storedActivatedAt
      : startedAt;

  const discovered = new Map();
  for (const item of Array.isArray(snapshot.discovered) ? snapshot.discovered.slice(0, 2_000) : []) {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.word !== "string" || !item.word.trim()) continue;
    discovered.set(item.word.trim().toLowerCase(), structuredClone(item));
  }
  for (const word of game.starters.slice(0, 32)) {
    if (typeof word === "string" && word.trim() && !discovered.has(word.trim().toLowerCase())) {
      discovered.set(word.trim().toLowerCase(), runStarterItem(game, word));
    }
  }

  const solutionRecipes = new Map();
  for (const entry of Array.isArray(snapshot.solutionRecipes) ? snapshot.solutionRecipes.slice(0, 1_000) : []) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || !entry[1] || typeof entry[1] !== "object") continue;
    solutionRecipes.set(entry[0], structuredClone(entry[1]));
  }
  const rawGiftItem = snapshot.giftItem && typeof snapshot.giftItem === "object" && !Array.isArray(snapshot.giftItem)
    ? snapshot.giftItem
    : null;
  const giftWord = String(rawGiftItem?.word || "").trim().slice(0, 80);
  const giftItem = giftWord && giftWord.toLowerCase() !== String(game.target).trim().toLowerCase()
    ? {
        word: giftWord,
        emoji: String(rawGiftItem?.emoji || "").trim().slice(0, 24),
        category: rawGiftItem?.category == null ? null : String(rawGiftItem.category).trim().slice(0, 40) || null,
        source: "gift",
        note: String(rawGiftItem?.note || "A crucial bridge gifted by the cosmos.").trim().slice(0, 180),
        feedbackEligible: false
      }
    : null;
  if (giftItem) discovered.set(giftItem.word.toLowerCase(), structuredClone(giftItem));
  const giftUsed = Boolean(snapshot.giftUsed && giftItem);
  const storedAssist = assistancePolicy(typeof snapshot.assist === "string" ? snapshot.assist.slice(0, 32) : "none").id;
  const legacyGiftForfeit = Number(snapshot.version || 1) < 2 && giftUsed;
  const scoringDisabled = Boolean(snapshot.scoringDisabled || legacyGiftForfeit || assistancePolicy(storedAssist).study);
  const forfeited = Boolean(snapshot.forfeited || legacyGiftForfeit || assistancePolicy(storedAssist).study);
  const assist = scoringDisabled
    ? studyAssistFor(storedAssist || snapshot.forfeitReason, giftUsed ? "gift" : "reveal")
    : giftUsed ? combineAssistance(storedAssist, "gift").id : storedAssist;
  const forfeitReason = forfeited
    ? studyAssistFor(snapshot.forfeitReason || assist, giftUsed ? "gift" : "reveal")
    : null;
  const clearlyPureLegacy = snapshotVersion < 3 && !scoringDisabled && !forfeited && assist === "none";
  const history = (Array.isArray(snapshot.history) ? snapshot.history.slice(0, 2_000) : [])
    .filter((step) => step && typeof step === "object" && !Array.isArray(step))
    .map((step) => {
      const legacyEligible = clearlyPureLegacy
        && !step.revealed
        && ["world", "expanded", "twist"].includes(String(step.source || "world"));
      return {
        ...structuredClone(step),
        eventEligible: snapshotVersion >= 3 ? step.eventEligible === true : legacyEligible,
        progressionEligible: snapshotVersion >= 3 ? step.progressionEligible === true : legacyEligible
      };
    });

  const remixValidation = validatedSnapshotRemixRuntime(game, snapshot.remixRuntime);
  if (!remixValidation.valid || (!game.remixes && snapshot.remixProgress != null)) return null;
  let remixProgress = null;
  if (remixValidation.runtime) {
    const rebuilt = rebuildSnapshotRemixProgress(remixValidation.runtime, history);
    if (!rebuilt) return null;
    const revealStudy = Array.isArray(snapshot.revealRoute) && snapshot.revealRoute.length > 0;
    if (revealStudy && !(completedAt && scoringDisabled && forfeited && assist === "reveal")) return null;
    remixProgress = revealStudy
      ? markRouteRemixAnswerRevealed(rebuilt.progress)
      : rebuilt.progress;
    if (snapshotVersion >= RUN_SNAPSHOT_VERSION) {
      if (
        !snapshot.remixProgress
        || typeof snapshot.remixProgress !== "object"
        || Array.isArray(snapshot.remixProgress)
        || !sameRemixProgress(snapshot.remixProgress, remixProgress)
      ) return null;
    }
    if (!revealStudy && Boolean(completedAt) !== rebuilt.completed) return null;
  }

  return {
    runId,
    playerId,
    game: structuredClone(game),
    ranked,
    challengeId: String(snapshot.challengeId || `practice:${runId}`).slice(0, 160),
    entryId,
    entryChallengeKey,
    startedAt,
    activatedAt,
    expiresAt: ranked && completedAt ? Math.max(expiresAt, completedAt + COMPLETED_RANKED_RUN_RETENTION_MS) : expiresAt,
    discovered,
    moves: nonnegativeCounter(snapshot.moves),
    attempts: Math.max(nonnegativeCounter(snapshot.attempts), nonnegativeCounter(snapshot.moves) + nonnegativeCounter(snapshot.rejectedAttempts)),
    rejectedAttempts: nonnegativeCounter(snapshot.rejectedAttempts),
    actionTimes: (Array.isArray(snapshot.actionTimes) ? snapshot.actionTimes : [])
      .map((value) => Number(value))
      .filter(Number.isFinite)
      .slice(-64),
    challengeBaseIdentity: snapshot.challengeBaseIdentity && typeof snapshot.challengeBaseIdentity === "object"
      ? structuredClone(snapshot.challengeBaseIdentity)
      : buildChallengeIdentity(game, { assist: "none" }),
    finalChallengeKey: /^ch3_[A-Za-z0-9_-]{24}$/.test(String(snapshot.finalChallengeKey || ""))
      ? String(snapshot.finalChallengeKey)
      : null,
    assist,
    scoringDisabled,
    forfeited,
    forfeitReason,
    forfeitedAt: snapshot.forfeitedAt == null ? null : Number.isFinite(Number(snapshot.forfeitedAt)) ? Number(snapshot.forfeitedAt) : null,
    revealRoute: Array.isArray(snapshot.revealRoute) ? structuredClone(snapshot.revealRoute.slice(0, 1_000)) : null,
    solutionRoute: Array.isArray(snapshot.solutionRoute) ? structuredClone(snapshot.solutionRoute.slice(0, 1_000)) : null,
    solutionRecipes,
    remixRuntime: remixValidation.runtime,
    remixProgress,
    giftUsed,
    giftItem,
    tipRecords: sanitizeRunTipRecords(snapshot.tipRecords),
    twistUsed: Boolean(snapshot.twistUsed),
    twistedPairKey: typeof snapshot.twistedPairKey === "string" ? snapshot.twistedPairKey.slice(0, 160) : null,
    usedBend: Boolean(snapshot.usedBend),
    bendItem: snapshot.bendItem && typeof snapshot.bendItem === "object" && !Array.isArray(snapshot.bendItem) ? structuredClone(snapshot.bendItem) : null,
    history,
    recipeFeedbackMoves: new Set((Array.isArray(snapshot.recipeFeedbackMoves) ? snapshot.recipeFeedbackMoves : [])
      .map((move) => Math.floor(Number(move)))
      .filter((move) => Number.isInteger(move) && move > 0 && move <= 2_000)),
    recipeFeedbackRecipes: new Set((Array.isArray(snapshot.recipeFeedbackRecipes) ? snapshot.recipeFeedbackRecipes : [])
      .map((fingerprint) => String(fingerprint))
      .filter((fingerprint) => /^[a-z0-9]{7,16}$/.test(fingerprint))
      .slice(0, 2_000)),
    completedAt,
    submitted: Boolean(snapshot.submitted),
    verifiedSignature: sanitizeRouteSignature(snapshot.verifiedSignature)
  };
}

export class RunRegistry {
  constructor(store) {
    this.store = store;
    this.runs = new Map();
    this.store.data.runs ||= {};
    for (const [runId, snapshot] of Object.entries(this.store.data.runs)) {
      const run = hydrateRun(snapshot, this.store.data.players);
      if (run && run.runId === runId) {
        this.runs.set(runId, run);
        for (const step of run.history) {
          if (step.eventEligible && step.progressionEligible) {
            this.store.recordCosmicEventDiscovery(run.playerId, step.word, new Date(effectiveRunStartedAt(run)));
          }
        }
      }
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

  start(playerId, game, {
    ranked = false,
    challengeId = "",
    scoringDisabled = false,
    forfeitReason = "",
    remixRuntime = null,
    deferActivation = false,
    entryId = undefined
  } = {}) {
    this.cleanup();
    const normalizedEntryId = normalizeRunEntryId(entryId);
    const challengeBaseIdentity = buildChallengeIdentity(game, { assist: "none" });
    const entryChallengeKey = normalizedEntryId
      ? runEntryChallengeKey(game, { ranked, challengeId, scoringDisabled, forfeitReason })
      : null;
    if (normalizedEntryId) {
      const existingEntry = [...this.runs.values()].find((candidate) =>
        candidate.playerId === playerId
        && candidate.entryId === normalizedEntryId
      );
      if (existingEntry) {
        if (existingEntry.entryChallengeKey !== entryChallengeKey) {
          throw serviceError(
            409,
            "That run entry ID already belongs to a different challenge.",
            "run_entry_conflict",
            { runId: existingEntry.runId }
          );
        }
        return {
          run: existingEntry,
          token: this.tokenFor(existingEntry),
          recovered: true
        };
      }
    }
    if (game?.adaptive) {
      const activeAdaptive = [...this.runs.values()].find((candidate) =>
        candidate.playerId === playerId
        && candidate.game?.adaptive
        && !candidate.completedAt
        && this.store.now().getTime() <= candidate.expiresAt
      );
      if (activeAdaptive) {
        throw serviceError(
          409,
          game?.promotion?.active || activeAdaptive.game?.promotion?.active
            ? "A promotion challenge is already active. Resume it before starting another."
            : "A Route Rank challenge is already active. Resume or give it up before starting another.",
          game?.promotion?.active || activeAdaptive.game?.promotion?.active
            ? "promotion_attempt_active"
            : "adaptive_attempt_active",
          { runId: activeAdaptive.runId }
        );
      }
    }
    if (ranked) {
      const active = [...this.runs.values()].find((candidate) => candidate.playerId === playerId
        && candidate.ranked
        && candidate.challengeId === challengeId
        && !candidate.submitted
        && this.store.now().getTime() <= candidate.expiresAt);
      if (active) throw serviceError(409, "This ranked challenge already has an active attempt. Resume or finish it before starting another.", "ranked_attempt_active", { runId: active.runId });
    }
    const runId = randomUUID();
    const startedAt = this.store.now().getTime();
    const run = {
      runId,
      playerId,
      game,
      ranked,
      challengeId: challengeId || `practice:${runId}`,
      entryId: normalizedEntryId,
      entryChallengeKey,
      startedAt,
      activatedAt: deferActivation ? null : startedAt,
      expiresAt: startedAt + Math.max((game.timeLimit || 0) * 1000 + 10_000, 30 * 60_000),
      discovered: new Map(game.starters.map((word) => [word.toLowerCase(), runStarterItem(game, word)])),
      moves: 0,
      attempts: 0,
      rejectedAttempts: 0,
      actionTimes: [],
      challengeBaseIdentity,
      finalChallengeKey: null,
      assist: scoringDisabled ? studyAssistFor(forfeitReason) : "none",
      scoringDisabled: Boolean(scoringDisabled),
      forfeited: Boolean(scoringDisabled),
      forfeitReason: scoringDisabled ? studyAssistFor(forfeitReason) : null,
      forfeitedAt: scoringDisabled ? startedAt : null,
      remixRuntime: remixRuntime ? sanitizeRouteRemixRuntime(remixRuntime) : null,
      remixProgress: remixRuntime ? createRouteRemixProgress() : null,
      revealRoute: null,
      giftUsed: false,
      giftItem: null,
      tipRecords: [],
      twistUsed: false,
      twistedPairKey: null,
      usedBend: false,
      bendItem: null,
      history: [],
      recipeFeedbackMoves: new Set(),
      recipeFeedbackRecipes: new Set(),
      completedAt: null,
      submitted: false,
      verifiedSignature: null
    };
    this.runs.set(runId, run);
    this.checkpoint(run);
    return { run, token: this.tokenFor(run), recovered: false };
  }

  tokenFor(run) {
    const payload = `run:${run.runId}:${run.playerId}:${run.startedAt}`;
    return `cr3.${this.store.signFor("run-session", payload)}`;
  }

  activate(run) {
    if (!run || (run.activatedAt != null && Number.isFinite(Number(run.activatedAt)))) return run;
    if (run.completedAt || run.moves || run.attempts || run.rejectedAttempts) {
      throw serviceError(409, "This orbit can no longer be activated.", "run_activation_invalid");
    }
    const activatedAt = this.store.now().getTime();
    run.activatedAt = activatedAt;
    run.expiresAt = Math.max(
      run.expiresAt,
      activatedAt + Math.max((run.game.timeLimit || 0) * 1000 + 10_000, 30 * 60_000)
    );
    this.checkpoint(run);
    return run;
  }

  activateAt(run, timestamp) {
    if (!run || (run.activatedAt != null && Number.isFinite(Number(run.activatedAt)))) return run;
    if (run.completedAt || run.moves || run.attempts || run.rejectedAttempts) {
      throw serviceError(409, "This orbit can no longer be activated.", "run_activation_invalid");
    }
    const requested = Number(timestamp);
    const activatedAt = Number.isFinite(requested) && requested > 0
      ? Math.floor(requested)
      : this.store.now().getTime();
    run.activatedAt = activatedAt;
    run.expiresAt = Math.max(
      run.expiresAt,
      activatedAt + Math.max((run.game.timeLimit || 0) * 1000 + 10_000, 30 * 60_000)
    );
    this.checkpoint(run);
    return run;
  }

  getOwned(runId, playerId) {
    const run = this.runs.get(String(runId || ""));
    if (!run || run.playerId !== playerId) {
      throw serviceError(401, "This run is not valid anymore.", "invalid_run");
    }
    return run;
  }

  discard(runId) {
    const id = String(runId || "");
    const existed = this.runs.delete(id);
    delete this.store.data.runs[id];
    return existed;
  }

  get(runId, playerId, token) {
    const run = this.runs.get(runId);
    const payload = `run:${runId}:${playerId}:${run?.startedAt}`;
    const validV3 = typeof token === "string" && token.startsWith("cr3.") && this.store.verifyFor("run-session", payload, token.slice(4));
    const validLegacy = typeof token === "string" && this.store.verify(payload, token);
    if (!run || run.playerId !== playerId || (!validV3 && !validLegacy)) throw serviceError(401, "This run is not valid anymore.", "invalid_run");
    if (this.store.now().getTime() > run.expiresAt) throw serviceError(410, "This run has expired.", "run_expired");
    return run;
  }

  canCombine(run, a, b) {
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
    if (run.activatedAt == null || !Number.isFinite(Number(run.activatedAt))) {
      throw serviceError(409, "This orbit is still opening.", "run_not_active");
    }
    if (!run.discovered.has(String(a).toLowerCase()) || !run.discovered.has(String(b).toLowerCase())) throw serviceError(422, "That combination contains an undiscovered word.", "impossible_combination");
    // A move is a successful fusion. Rejected guesses are tracked separately
    // for scoring, but must not silently spend the limited-moves budget.
    if (run.game.moveLimit && run.moves >= run.game.moveLimit) {
      const masterRoute = run.game.remixes?.rules?.some((rule) => rule.family === "master_route");
      throw serviceError(
        409,
        masterRoute ? "The Master Route fusion limit is reached." : "No moves remain in this orbit.",
        masterRoute ? "master_route_limit" : "move_limit"
      );
    }
    if (run.game.timeLimit && this.store.now().getTime() - effectiveRunStartedAt(run) > run.game.timeLimit * 1000 + 3000) throw serviceError(409, "Time has expired for this orbit.", "time_limit");
    if (run.remixRuntime) {
      const remixCheck = checkRouteRemixBeforeCombination(run.remixRuntime, run.remixProgress, { a, b });
      if (!remixCheck.allowed) {
        throw serviceError(409, remixCheck.reason, "remix_pair_blocked", {
          remixCode: remixCheck.code,
          terminal: remixCheck.terminal
        });
      }
    }
  }

  recordCombination(run, result, { a = "", b = "", recordProgression = true } = {}) {
    if (result.twisted) {
      if (run.twistUsed) throw serviceError(409, "This orbit already found its Cosmic Twist.", "twist_used");
      run.twistUsed = true;
      run.twistedPairKey = [a, b].map((word) => String(word).trim().toLowerCase()).sort().join("+");
    }
    const ingredientA = run.discovered.get(String(a).trim().toLowerCase());
    const ingredientB = run.discovered.get(String(b).trim().toLowerCase());
    const safeIngredientSources = new Set(["origin", "loaned-start", "world", "twist", "ai", "semantic"]);
    const safeResultSources = new Set(["world", "twist", "ai", "semantic"]);
    const ingredientFeedbackSafe = (item) => Boolean(item && item.feedbackEligible !== false && safeIngredientSources.has(String(item.source || "")));
    const feedbackEligible = ingredientFeedbackSafe(ingredientA)
      && ingredientFeedbackSafe(ingredientB)
      && safeResultSources.has(String(result.source || "world"));
    const canonicalWord = (word) => run.discovered.get(String(word).trim().toLowerCase())?.word || String(word).trim();
    const resultSource = String(result.source || "world");
    const anticipatedAssist = ["ai", "ai-route"].includes(resultSource)
      ? combineAssistance(run.assist, "ai").id
      : run.assist;
    const progressionEligible = recordProgression !== false
      && !run.scoringDisabled
      && !run.forfeited
      && anticipatedAssist === "none"
      && !result.revealed
      && ["world", "expanded", "twist", "semantic"].includes(resultSource);
    // Signature novelty is lifetime novelty, not merely novelty within this
    // one route. The server stores only a keyed digest of each discovered word.
    const newDiscovery = recordProgression === false
      ? false
      : this.store.recordLifetimeDiscovery(run.playerId, result.word, new Date(effectiveRunStartedAt(run)), {
          eventEligible: progressionEligible
        }).newDiscovery;
    run.moves += 1;
    run.attempts += 1;
    run.actionTimes.push(this.store.now().getTime());
    run.actionTimes = run.actionTimes.slice(-64);
    const historyEntry = {
      move: run.moves,
      a: canonicalWord(a),
      b: canonicalWord(b),
      word: result.word,
      emoji: result.emoji || "",
      category: result.category || null,
      note: result.note || "",
      source: resultSource,
      newDiscovery,
      progressionEligible,
      eventEligible: progressionEligible,
      twisted: Boolean(result.twisted),
      canonicalWord: result.twist?.canonicalWord || "",
      revealed: false,
      feedbackEligible
    };
    run.history.push(historyEntry);
    run.discovered.set(result.word.toLowerCase(), { ...result, feedbackEligible });
    if (run.remixRuntime) {
      const remixRecord = recordRouteRemixCombination(run.remixRuntime, run.remixProgress, {
        a,
        b,
        word: result.word,
        successful: true
      });
      if (remixRecord.accepted) run.remixProgress = remixRecord.progress;
      historyEntry.remixProgress = routeRemixProgress(run.remixRuntime, run.remixProgress);
    }
    if (["ai", "ai-route"].includes(result.source)) run.assist = combineAssistance(run.assist, "ai").id;
    if (
      run.game.completionPolicy !== "external"
      && result.word.toLowerCase() === run.game.target.toLowerCase()
    ) {
      const remixCompletion = run.remixRuntime
        ? checkRouteRemixCompletion(run.remixRuntime, run.remixProgress, result.word)
        : { complete: true, failed: false, code: "complete", reason: "" };
      historyEntry.targetMade = true;
      historyEntry.completionBlocked = !remixCompletion.complete;
      historyEntry.remixCompletion = remixCompletion;
      if (remixCompletion.complete) {
        run.completedAt = this.store.now().getTime();
        if (run.ranked) run.expiresAt = Math.max(run.expiresAt, run.completedAt + COMPLETED_RANKED_RUN_RETENTION_MS);
        this.store.recordRouteRankRunOutcome(run, "completed");
      }
    }
    this.checkpoint(run);
    return historyEntry;
  }

  recordRejectedAttempt(run, { a = "", b = "" } = {}) {
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
    run.rejectedAttempts += 1;
    run.attempts += 1;
    run.actionTimes.push(this.store.now().getTime());
    run.actionTimes = run.actionTimes.slice(-64);
    const record = {
      attempt: run.attempts,
      pairFingerprint: this.store.signFor("run-rejected-pair", [a, b].map((word) => canonicalChallengeText(word, 28)).sort().join("+")),
      at: this.store.now().toISOString()
    };
    this.checkpoint(run);
    return record;
  }

  reveal(run, route) {
    if (run.revealRoute) {
      if (run.remixRuntime && !run.remixProgress?.answerRevealed) {
        run.remixProgress = markRouteRemixAnswerRevealed(run.remixProgress);
        this.checkpoint(run);
      }
      return run.revealRoute;
    }
    if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
    if (!Array.isArray(route)) throw serviceError(422, "No verified answer path is available.", "route_unavailable");

    run.assist = "reveal";
    run.scoringDisabled = true;
    run.forfeited = true;
    run.forfeitReason = "reveal";
    run.forfeitedAt ||= this.store.now().getTime();
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
        progressionEligible: false,
        eventEligible: false,
        twisted: false,
        canonicalWord: "",
        revealed: true
      });
      run.discovered.set(step.word.toLowerCase(), { ...step, source: "reveal" });
      run.moves += 1;
    }
    if (run.remixRuntime) {
      // Reveal is a zero-score Study outcome. Mark it visually complete so
      // resume/progress agree with `completedAt`, while scored completion
      // validation continues to return `answer_revealed`.
      run.remixProgress = markRouteRemixAnswerRevealed(run.remixProgress);
    }
    run.completedAt = this.store.now().getTime();
    this.store.recordRouteRankRunOutcome(run, "reveal");
    this.checkpoint(run);
    return run.revealRoute;
  }

  forfeit(run, reason = "forfeit") {
    if (
      run.completedAt
      && run.forfeited
      && String(run.forfeitReason || "").toLowerCase() === "forfeit"
    ) {
      this.store.recordRouteRankRunOutcome(run, "forfeit");
      return run;
    }
    if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
    run.assist = "reveal";
    run.scoringDisabled = true;
    run.forfeited = true;
    run.forfeitReason = String(reason || "forfeit").trim().slice(0, 32) || "forfeit";
    run.forfeitedAt = this.store.now().getTime();
    run.completedAt = run.forfeitedAt;
    this.store.recordRouteRankRunOutcome(run, "forfeit");
    this.checkpoint(run);
    return run;
  }

  sense(run) {
    if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");

    if (!run.scoringDisabled && !run.forfeited) {
      run.assist = combineAssistance(run.assist, "sense").id;
      run.game = { ...run.game, division: "open", pureEligible: false };
    }
    this.checkpoint(run);
    return run;
  }

  gift(run, item) {
    if (run.giftUsed && run.giftItem) return structuredClone(run.giftItem);
    if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");

    const word = String(item?.word || "").trim().slice(0, 80);
    if (!word || word.toLowerCase() === String(run.game.target || "").trim().toLowerCase() || run.discovered.has(word.toLowerCase())) {
      throw serviceError(422, "No undiscovered bridge word is available for this orbit.", "gift_unavailable");
    }
    const giftItem = {
      word,
      emoji: String(item?.emoji || "").trim().slice(0, 24),
      category: item?.category == null ? null : String(item.category).trim().slice(0, 40) || null,
      source: "gift",
      note: String(item?.note || "A crucial bridge gifted by the cosmos.").trim().slice(0, 180),
      feedbackEligible: false
    };
    run.giftUsed = true;
    run.giftItem = giftItem;
    if (!run.scoringDisabled && !run.forfeited) {
      run.assist = combineAssistance(run.assist, "gift").id;
      run.game = { ...run.game, division: "open", pureEligible: false };
    }
    run.discovered.set(giftItem.word.toLowerCase(), structuredClone(giftItem));
    this.checkpoint(run);
    return structuredClone(giftItem);
  }

  tip(run, tipIndex, selectTip) {
    if (!Number.isInteger(tipIndex) || tipIndex < 0 || tipIndex > QUICK_TIP_LIMIT) {
      throw serviceError(400, "Route Signal requires a valid current signal index.", "invalid_tip_index");
    }
    run.tipRecords = sanitizeRunTipRecords(run.tipRecords);
    if (tipIndex < run.tipRecords.length) {
      return publicTipResponse(run.tipRecords[tipIndex], run.tipRecords.length);
    }
    if (tipIndex > run.tipRecords.length) {
      throw serviceError(409, "Route Signal state changed. Refresh this orbit and try again.", "tip_state_mismatch");
    }
    if (run.tipRecords.length >= QUICK_TIP_LIMIT) return publicTipResponse(null, run.tipRecords.length, false);
    if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");

    const selected = typeof selectTip === "function"
      ? selectTip({ used: run.tipRecords.length, seen: run.tipRecords.map((record) => record.id) })
      : null;
    const text = String(selected?.text || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
    let id = String(selected?.id || "").trim().toLowerCase().slice(0, 80);
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) || run.tipRecords.some((record) => record.id === id)) id = `tip-${run.tipRecords.length + 1}`;
    if (selected?.available === false || !text) {
      return publicTipResponse({ text: text || "No spoiler-safe direction is available yet." }, run.tipRecords.length, false);
    }
    const record = { id, text };
    run.tipRecords.push(record);
    this.checkpoint(run);
    return publicTipResponse(record, run.tipRecords.length);
  }

  addBend(run, item, assist) {
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
    if (run.usedBend) throw serviceError(409, "Only one Reality Bend may be used in a run.", "bend_used");
    if (!["market", "wish"].includes(assist)) throw serviceError(400, "That Reality Bend is not available.", "invalid_bend_assist");
    run.usedBend = true;
    run.bendItem = structuredClone(item);
    run.assist = combineAssistance(run.assist, assist).id;
    run.game = { ...run.game, division: "open", pureEligible: false };
    run.discovered.set(item.word.toLowerCase(), item);
    this.checkpoint(run);
  }

  progress(run) {
    return {
      moves: run.moves,
      attempts: run.attempts,
      rejectedAttempts: run.rejectedAttempts,
      errorless: run.rejectedAttempts === 0,
      completed: Boolean(run.completedAt),
      completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
      submitted: Boolean(run.submitted),
      discovered: [...run.discovered.values()].map((item) => structuredClone(item)),
      history: run.history.map((step) => structuredClone(step)),
      usedBend: Boolean(run.usedBend),
      bendItem: run.bendItem ? structuredClone(run.bendItem) : null,
      giftUsed: Boolean(run.giftUsed),
      giftItem: run.giftItem ? structuredClone(run.giftItem) : null,
      tipsUsed: sanitizeRunTipRecords(run.tipRecords).length,
      remixProgress: run.remixRuntime
        ? routeRemixProgress(run.remixRuntime, run.remixProgress)
        : null
    };
  }

  finalize(run, callsign) {
    if (run.scoringDisabled || run.forfeited) throw serviceError(409, "Assisted orbits cannot submit a score.", "assisted_run");
    if (!run.completedAt) throw serviceError(422, "The target has not been reached.", "target_missing");
    if (run.remixRuntime && !checkRouteRemixCompletion(
      run.remixRuntime,
      run.remixProgress,
      run.game.target
    ).complete) {
      throw serviceError(422, "The route rules are not complete.", "remix_incomplete");
    }
    if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
    run.submitted = true;
    const runStartedAt = effectiveRunStartedAt(run);
    const elapsedMs = Math.max(1, run.completedAt - runStartedAt);
    const assisted = run.assist !== "none";
    const routePar = Array.isArray(run.solutionRoute) && run.solutionRoute.length
      ? run.solutionRoute.length
      : Math.max(1, Math.floor(Number(run.game.parMoves) || 3 + (Number(run.game.tier) || 1) * 3));
    const signature = sanitizeRouteSignature(createRouteSignature({
      history: run.history,
      target: run.game.target,
      completed: true,
      moves: run.moves,
      attempts: run.attempts,
      rejectedAttempts: run.rejectedAttempts,
      errorless: run.rejectedAttempts === 0,
      parMoves: routePar,
      game: run.game,
      mode: run.game.mode,
      challengeId: run.challengeId,
      assist: run.assist,
      scoringDisabled: false,
      revealed: false
    }));
    run.verifiedSignature = signature;
    const elapsedSeconds = Math.round(elapsedMs / 1000);
    const challengeIdentity = buildChallengeIdentity(run.game, { assist: run.assist });
    run.finalChallengeKey = challengeIdentity.key;
    const anomalyFlags = [];
    // Keep this deliberately conservative: short verified routes can be
    // replayed very quickly, while a burst of a dozen server actions inside a
    // quarter-second is a much stronger automation signal.
    if (run.attempts >= 12 && elapsedMs < 250) anomalyFlags.push("implausible_total_cadence");
    const rapidIntervals = run.actionTimes.slice(1).filter((time, index) => time - run.actionTimes[index] < 20).length;
    if (run.actionTimes.length >= 12 && rapidIntervals >= 8) anomalyFlags.push("automation_cadence");
    const entry = {
      id: randomUUID(),
      runId: run.runId,
      playerId: run.playerId,
      callsign,
      challengeId: run.challengeId,
      challengeKey: challengeIdentity.key,
      challengeBaseKey: run.challengeBaseIdentity.key,
      challenge: challengeIdentity.descriptor,
      division: assisted ? "open" : "pure",
      assist: run.assist,
      mode: run.game.mode,
      target: run.game.target,
      score: calculateStarscore({ game: run.game, moves: run.moves, elapsedSeconds, errors: run.rejectedAttempts, assisted, assist: run.assist }),
      moves: run.moves,
      attempts: run.attempts,
      rejectedAttempts: run.rejectedAttempts,
      errorless: run.rejectedAttempts === 0,
      elapsedMs,
      status: anomalyFlags.length ? "provisional" : "verified",
      anomalyFlags,
      signature,
      dailyKey: new Date(runStartedAt).toISOString().slice(0, 10),
      weeklyKey: isoWeekKey(new Date(runStartedAt)),
      createdAt: new Date().toISOString()
    };
    this.checkpoint(run);
    return entry;
  }

  cleanup() {
    const now = this.store.now().getTime();
    for (const [id, run] of this.runs) {
      if (now <= run.expiresAt + 60_000) continue;
      if (!run.completedAt) this.store.recordRouteRankRunOutcome(run, "failed");
      this.runs.delete(id);
      delete this.store.data.runs[id];
    }
  }

  revokePlayer(playerId) {
    let removed = 0;
    for (const [runId, run] of this.runs) {
      if (run.playerId !== playerId) continue;
      this.runs.delete(runId);
      delete this.store.data.runs[runId];
      removed += 1;
    }
    return removed;
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
  return {
    rank,
    callsign: entry.callsign,
    score: entry.score,
    moves: entry.moves,
    elapsedMs: entry.elapsedMs,
    mode: entry.mode,
    target: entry.target,
    challengeId: entry.challengeId,
    challengeKey: entry.challengeKey || null,
    challengeBaseKey: entry.challengeBaseKey || entry.challengeKey || null,
    challenge: entry.challenge ? structuredClone(entry.challenge) : null,
    assist: entry.assist,
    division: entry.division,
    attempts: Math.max(nonnegativeCounter(entry.attempts), nonnegativeCounter(entry.moves)),
    rejectedAttempts: nonnegativeCounter(entry.rejectedAttempts),
    errorless: entry.errorless !== false && !nonnegativeCounter(entry.rejectedAttempts),
    status: entry.status === "provisional" ? "provisional" : "verified",
    anomalyFlags: entry.status === "provisional" ? [...(entry.anomalyFlags || [])] : [],
    ghost: {
      kind: "player",
      label: entry.status === "provisional" ? "Provisional player route" : "Verified player route",
      verified: entry.status !== "provisional",
      synthetic: false
    },
    signature: sanitizeRouteSignature(entry.signature)
  };
}
