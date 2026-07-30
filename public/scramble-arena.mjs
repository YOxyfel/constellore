export const SCRAMBLE_ARENA_VERSION = 1;
export const SCRAMBLE_ARENA_SEASON_ID = "v5-s1";
export const SCRAMBLE_STARTING_RATING = 1_000;
export const SCRAMBLE_DEFAULT_MODE_ID = "target-race";

const MODE_DEFINITIONS = [
  {
    id: "target-race",
    label: "Target Race",
    description: "Two open boards. One shared target. Every discovery is visible.",
    objective: "Create the shared target before your rival.",
    enabled: true,
    preview: false,
    supportsRanked: true,
    rulesVersion: 1,
    config: {
      durationSeconds: 300
    }
  },
  {
    id: "wordstorm",
    label: "Wordstorm",
    description: "Build quickly and turn a stream of discoveries into a winning score.",
    objective: "Reach 12 unique discoveries first, or lead when time expires.",
    enabled: true,
    preview: false,
    supportsRanked: true,
    rulesVersion: 1,
    config: {
      durationSeconds: 120,
      discoveryQuota: 12
    }
  },
  {
    id: "forge-clash",
    label: "Forge Clash",
    description: "Forge a contender, then send it into a deterministic word battle.",
    objective: "Build your strongest contender in six turns and win the clash.",
    enabled: true,
    preview: false,
    supportsRanked: true,
    rulesVersion: 1,
    config: {
      durationSeconds: 150,
      turnLimit: 6
    }
  },
  {
    id: "riddle-saga",
    label: "Riddle Saga",
    description: "Race through five linked riddles and carry the story to its finale.",
    objective: "Win the most chapter points. The final riddle is worth two.",
    enabled: true,
    preview: false,
    supportsRanked: true,
    rulesVersion: 1,
    config: {
      durationSeconds: 300,
      chapterCount: 5,
      chapterPoints: [1, 1, 1, 1, 2],
      chapterDurationSeconds: 45,
      finaleDurationSeconds: 60,
      intermissionSeconds: 3
    }
  },
  {
    id: "claim-war",
    label: "Claim War",
    description: "Race across a shared knowledge map and seize unseen pairings.",
    objective: "Claim 10 unique pairings before your rival.",
    enabled: false,
    preview: true,
    supportsRanked: true,
    rulesVersion: 1,
    config: {
      durationSeconds: 120,
      claimQuota: 10
    }
  }
];

function freezeMode(definition) {
  const config = { ...definition.config };
  if (Array.isArray(config.chapterPoints)) {
    config.chapterPoints = Object.freeze([...config.chapterPoints]);
  }
  return Object.freeze({
    ...definition,
    config: Object.freeze(config)
  });
}

export const SCRAMBLE_MODES = Object.freeze(MODE_DEFINITIONS.map(freezeMode));
export const SCRAMBLE_MODE_IDS = Object.freeze(SCRAMBLE_MODES.map((mode) => mode.id));

const MODE_BY_ID = new Map(SCRAMBLE_MODES.map((mode) => [mode.id, mode]));
const ENABLED_MODES = Object.freeze(SCRAMBLE_MODES.filter((mode) => mode.enabled));
const NON_PREVIEW_MODES = Object.freeze(SCRAMBLE_MODES.filter((mode) => !mode.preview));
const ENABLED_NON_PREVIEW_MODES = Object.freeze(
  SCRAMBLE_MODES.filter((mode) => mode.enabled && !mode.preview)
);

const MODE_ALIASES = new Map([
  ["target-race", "target-race"],
  ["targetrace", "target-race"],
  ["target", "target-race"],
  ["race", "target-race"],
  ["classic", "target-race"],
  ["duel", "target-race"],
  ["wordstorm", "wordstorm"],
  ["word-storm", "wordstorm"],
  ["storm", "wordstorm"],
  ["quota", "wordstorm"],
  ["forge-clash", "forge-clash"],
  ["forgeclash", "forge-clash"],
  ["forge", "forge-clash"],
  ["clash", "forge-clash"],
  ["riddle-saga", "riddle-saga"],
  ["riddlesaga", "riddle-saga"],
  ["saga", "riddle-saga"],
  ["story", "riddle-saga"],
  ["story-rush", "riddle-saga"],
  ["claim-war", "claim-war"],
  ["claimwar", "claim-war"],
  ["claim", "claim-war"],
  ["claims", "claim-war"]
]);

const RATING_KEYS = Object.freeze({
  "target-race": Object.freeze(["target-race", "targetRace", "target_race", "target"]),
  wordstorm: Object.freeze(["wordstorm", "wordStorm", "word_storm"]),
  "forge-clash": Object.freeze(["forge-clash", "forgeClash", "forge_clash", "forge"]),
  "riddle-saga": Object.freeze(["riddle-saga", "riddleSaga", "riddle_saga", "saga"]),
  "claim-war": Object.freeze(["claim-war", "claimWar", "claim_war", "claim"])
});

function safeRecord(value) {
  try {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

function ownDataValue(value, key) {
  const source = safeRecord(value);
  if (!source) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    return descriptor && Object.hasOwn(descriptor, "value")
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function hasOwnDataValue(value, key) {
  const source = safeRecord(value);
  if (!source) return false;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    return Boolean(descriptor && Object.hasOwn(descriptor, "value"));
  } catch {
    return false;
  }
}

function primitiveText(value, maximum = 80) {
  if (typeof value !== "string") return "";
  try {
    return value
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, maximum);
  } catch {
    return "";
  }
}

function finiteNumber(value, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  if (!text || text.length > 40) return fallback;
  const number = Number(text);
  return Number.isFinite(number) ? number : fallback;
}

function boundedInteger(value, minimum, maximum, fallback = minimum) {
  const number = Math.floor(finiteNumber(value, fallback));
  return Math.max(minimum, Math.min(maximum, number));
}

function safeSeasonId(value, fallback = SCRAMBLE_ARENA_SEASON_ID) {
  const season = primitiveText(value, 40);
  return season || primitiveText(fallback, 40) || SCRAMBLE_ARENA_SEASON_ID;
}

function safeTimestamp(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  } catch {
    return null;
  }
}

function ratingCandidate(container, modeId) {
  const ratings = safeRecord(container);
  if (!ratings) return undefined;
  for (const key of RATING_KEYS[modeId]) {
    if (hasOwnDataValue(ratings, key)) return ownDataValue(ratings, key);
  }
  return undefined;
}

function looksLikeLegacyRating(value) {
  return hasOwnDataValue(value, "rating")
    || hasOwnDataValue(value, "games")
    || hasOwnDataValue(value, "wins")
    || hasOwnDataValue(value, "losses")
    || hasOwnDataValue(value, "draws");
}

function recordSeasonId(value) {
  return primitiveText(ownDataValue(safeRecord(value), "seasonId"), 40);
}

function candidateForSeason(value, seasonId, requireExplicitSeason = false) {
  const source = safeRecord(value);
  if (!source) return undefined;
  const candidateSeason = recordSeasonId(source);
  if (requireExplicitSeason && !candidateSeason) return undefined;
  return candidateSeason && candidateSeason !== seasonId ? undefined : source;
}

function sanitizeProgression(raw, seasonId, fallbackSource) {
  const source = safeRecord(raw);
  const fallback = safeRecord(fallbackSource);
  const xpValue = hasOwnDataValue(source, "xp")
    ? ownDataValue(source, "xp")
    : ownDataValue(fallback, "seasonXp");
  const levelValue = hasOwnDataValue(source, "level")
    ? ownDataValue(source, "level")
    : ownDataValue(fallback, "seasonLevel");
  const updatedAtValue = hasOwnDataValue(source, "updatedAt")
    ? ownDataValue(source, "updatedAt")
    : ownDataValue(fallback, "progressionUpdatedAt");
  return Object.freeze({
    seasonId,
    xp: boundedInteger(xpValue, 0, 1_000_000_000, 0),
    level: boundedInteger(levelValue, 1, 10_000, 1),
    updatedAt: safeTimestamp(updatedAtValue)
  });
}

function frozenArena({ seasonId, progression, ratings }) {
  return Object.freeze({
    version: SCRAMBLE_ARENA_VERSION,
    seasonId,
    progression,
    ratings: Object.freeze(ratings)
  });
}

/**
 * Normalizes persisted and player-facing mode aliases. A missing mode is the
 * legacy Target Race; an explicitly unknown value stays invalid.
 */
export function normalizeScrambleModeId(value) {
  if (value == null || (typeof value === "string" && !value.trim())) {
    return SCRAMBLE_DEFAULT_MODE_ID;
  }
  const text = primitiveText(value, 40)
    .toLocaleLowerCase("en-US")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
  return MODE_ALIASES.get(text) || "";
}

export function getScrambleModeDefinition(value) {
  const modeId = normalizeScrambleModeId(value);
  return modeId ? MODE_BY_ID.get(modeId) || null : null;
}

export function listScrambleModeDefinitions(options) {
  const enabledOnly = ownDataValue(options, "enabledOnly") === true;
  const includePreview = ownDataValue(options, "includePreview") !== false;
  if (enabledOnly && !includePreview) return ENABLED_NON_PREVIEW_MODES;
  if (enabledOnly) return ENABLED_MODES;
  if (!includePreview) return NON_PREVIEW_MODES;
  return SCRAMBLE_MODES;
}

/**
 * Mirrors the existing Duel rating bounds and record fields, adding a derived
 * placement label for mode-specific UI. The returned value is immutable.
 */
export function sanitizeScrambleModeRating(raw, seasonId = SCRAMBLE_ARENA_SEASON_ID) {
  const source = safeRecord(raw);
  const games = boundedInteger(ownDataValue(source, "games"), 0, Number.MAX_SAFE_INTEGER, 0);
  const wins = boundedInteger(ownDataValue(source, "wins"), 0, games, 0);
  const losses = boundedInteger(ownDataValue(source, "losses"), 0, games - wins, 0);
  const draws = boundedInteger(ownDataValue(source, "draws"), 0, games - wins - losses, 0);
  const suppliedRating = finiteNumber(ownDataValue(source, "rating"), 0);
  const rating = Math.max(
    100,
    Math.min(10_000, Math.round(suppliedRating || SCRAMBLE_STARTING_RATING))
  );
  const ratingSeason = safeSeasonId(ownDataValue(source, "seasonId"), seasonId);
  const placement = games === 0
    ? "unplaced"
    : games < 5 ? "provisional" : "established";
  return Object.freeze({
    seasonId: ratingSeason,
    rating,
    games,
    wins,
    losses,
    draws,
    streak: boundedInteger(ownDataValue(source, "streak"), 0, 10_000, 0),
    provisional: games < 5,
    placement,
    updatedAt: safeTimestamp(ownDataValue(source, "updatedAt"))
  });
}

/**
 * Produces the canonical per-mode arena model. The optional legacy rating is
 * copied into Target Race only; every new mode starts independently unplaced.
 */
export function sanitizeScrambleArena(raw, options) {
  const outer = safeRecord(raw);
  const nestedArena = safeRecord(ownDataValue(outer, "scrambleArena"));
  const source = nestedArena || outer;
  const optionSource = safeRecord(options);

  const explicitLegacy = ownDataValue(optionSource, "legacyDuelRating");
  const wrapperLegacy = ownDataValue(outer, "duelRating");
  const arenaLegacy = ownDataValue(source, "duelRating");
  const legacyRating = explicitLegacy !== undefined
    ? explicitLegacy
    : wrapperLegacy !== undefined
      ? wrapperLegacy
      : arenaLegacy !== undefined
        ? arenaLegacy
        : looksLikeLegacyRating(source) ? source : undefined;

  const requestedSeason = primitiveText(ownDataValue(optionSource, "seasonId"), 40);
  const arenaSeason = recordSeasonId(source);
  const legacySeason = recordSeasonId(legacyRating);
  const seasonId = requestedSeason
    || arenaSeason
    || legacySeason
    || SCRAMBLE_ARENA_SEASON_ID;
  const arenaRolledOver = Boolean(
    requestedSeason
    && arenaSeason
    && arenaSeason !== requestedSeason
  );
  const sourceForSeason = arenaRolledOver ? null : source;
  const eligibleLegacy = arenaRolledOver
    ? undefined
    : requestedSeason
      ? candidateForSeason(legacyRating, seasonId, true)
      : legacyRating;

  const ratingsContainer = safeRecord(ownDataValue(sourceForSeason, "ratings"))
    || safeRecord(ownDataValue(sourceForSeason, "modeRatings"))
    || safeRecord(ownDataValue(sourceForSeason, "ratingByMode"));

  const ratings = {};
  for (const modeId of SCRAMBLE_MODE_IDS) {
    let candidate = ratingCandidate(ratingsContainer, modeId);
    if (candidate === undefined && modeId === SCRAMBLE_DEFAULT_MODE_ID) {
      candidate = eligibleLegacy;
    }
    candidate = candidateForSeason(candidate, seasonId);
    ratings[modeId] = sanitizeScrambleModeRating(candidate, seasonId);
  }

  let progressionSource = ownDataValue(sourceForSeason, "progression")
    ?? ownDataValue(sourceForSeason, "seasonProgression");
  progressionSource = candidateForSeason(progressionSource, seasonId);
  return frozenArena({
    seasonId,
    progression: sanitizeProgression(progressionSource, seasonId, sourceForSeason),
    ratings
  });
}

export function scrambleRatingForMode(rawArena, modeValue, options) {
  const modeId = normalizeScrambleModeId(modeValue);
  if (!modeId) return null;
  return sanitizeScrambleArena(rawArena, options).ratings[modeId];
}

/**
 * Replaces one mode rating without mutating the arena or touching shared
 * progression. Reward and XP settlement remain the caller's responsibility.
 */
export function applyScrambleModeRating(rawArena, modeValue, rawRating, options) {
  const arena = sanitizeScrambleArena(rawArena, options);
  const modeId = normalizeScrambleModeId(modeValue);
  if (!modeId) return arena;
  const ratings = {};
  for (const id of SCRAMBLE_MODE_IDS) {
    ratings[id] = id === modeId
      ? sanitizeScrambleModeRating(
          candidateForSeason(rawRating, arena.seasonId),
          arena.seasonId
        )
      : arena.ratings[id];
  }
  return frozenArena({
    seasonId: arena.seasonId,
    progression: arena.progression,
    ratings
  });
}

/**
 * Returns an allowlist-only immutable snapshot suitable for API responses.
 */
export function publicScrambleArenaSnapshot(rawArena, options) {
  const arena = sanitizeScrambleArena(rawArena, options);
  const ratings = {};
  for (const modeId of SCRAMBLE_MODE_IDS) {
    ratings[modeId] = sanitizeScrambleModeRating(
      arena.ratings[modeId],
      arena.seasonId
    );
  }
  return frozenArena({
    seasonId: arena.seasonId,
    progression: sanitizeProgression(arena.progression, arena.seasonId),
    ratings
  });
}
