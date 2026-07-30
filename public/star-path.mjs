export const STAR_PATH_VERSION = 2;
export const STAR_PATH_SEASON_DAYS = 56;
export const STAR_PATH_TIER_COUNT = 12;
export const STAR_PATH_MAX_CREDITED_EVENTS = 1_024;

const DAY_MS = 86_400_000;
const SEASON_MS = STAR_PATH_SEASON_DAYS * DAY_MS;
const SEASON_EPOCH_MS = Date.UTC(2026, 0, 5); // Monday, 00:00 UTC.
const MAX_EVENT_ID_LENGTH = 96;

const PHASES = Object.freeze([
  Object.freeze({
    id: "celestial-wayfinder",
    title: "Celestial Wayfinder",
    accent: "Atlas",
    description: "Chart a bright path from the observatory into the open cosmos."
  }),
  Object.freeze({
    id: "lunar-bloom",
    title: "Lunar Bloom",
    accent: "Moonpetal",
    description: "Follow quiet silver gardens between the stars."
  }),
  Object.freeze({
    id: "solar-odyssey",
    title: "Solar Odyssey",
    accent: "Sunforged",
    description: "Ride the warm clockwork currents of a turning sky."
  }),
  Object.freeze({
    id: "eclipse-horizon",
    title: "Eclipse Horizon",
    accent: "Corona",
    description: "Cross the last golden light at the edge of shadow."
  })
]);

const LEGACY_TIER_THRESHOLDS = Object.freeze([
  80, 180, 320, 500, 720, 980, 1_280, 1_620, 2_000, 2_420, 2_880, 3_400
]);

const TIER_THRESHOLDS = Object.freeze([
  125, 300, 550, 850, 1_225, 1_650, 2_150, 2_750, 3_400, 4_100, 4_850, 5_600
]);

export const STAR_PATH_MAX_XP = TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];

const FREE_REWARDS = Object.freeze([
  Object.freeze({ kind: "profileBadge", slug: "first-light", label: "First Light Badge" }),
  Object.freeze({ kind: "shipTrail", slug: "stardust-wake", label: "Stardust Wake" }),
  Object.freeze({ kind: "playerTitle", slug: "orbital-scout", label: "Orbital Scout Title" }),
  Object.freeze({ kind: "raceGateSkin", slug: "atlas-rings", label: "Atlas Rings" }),
  Object.freeze({ kind: "emojiStamp", slug: "comet-hello", label: "Comet Hello Stamp" }),
  Object.freeze({ kind: "cockpitAccent", slug: "dawn-instruments", label: "Dawn Instruments" }),
  Object.freeze({ kind: "ostRemix", slug: "wayfinder-reprise", label: "Wayfinder Reprise" }),
  Object.freeze({ kind: "victoryFlyby", slug: "lunar-salute", label: "Lunar Salute" }),
  Object.freeze({ kind: "profileFrame", slug: "charted-horizon", label: "Charted Horizon Frame" }),
  Object.freeze({ kind: "shipDecal", slug: "twelve-stars", label: "Twelve Stars Decal" }),
  Object.freeze({ kind: "wordTrail", slug: "constellation-thread", label: "Constellation Thread" }),
  Object.freeze({ kind: "shipHull", slug: "wayfinder-skiff", label: "Wayfinder Skiff" })
]);

const SUPPORTER_REWARDS = Object.freeze([
  Object.freeze({ kind: "shipDecal", slug: "gilded-compass", label: "Gilded Compass Decal" }),
  Object.freeze({ kind: "cockpitTheme", slug: "glass-observatory", label: "Glass Observatory Cockpit" }),
  Object.freeze({ kind: "profileBadge", slug: "deep-cartographer", label: "Deep Cartographer Badge" }),
  Object.freeze({ kind: "shipTrail", slug: "prismatic-wake", label: "Prismatic Wake" }),
  Object.freeze({ kind: "raceGateSkin", slug: "orrery-arches", label: "Orrery Arches" }),
  Object.freeze({ kind: "victoryFlyby", slug: "comet-crown", label: "Comet Crown Flyby" }),
  Object.freeze({ kind: "ostRemix", slug: "midnight-navigation", label: "Midnight Navigation Remix" }),
  Object.freeze({ kind: "profileFrame", slug: "aurora-sextant", label: "Aurora Sextant Frame" }),
  Object.freeze({ kind: "wordPlaque", slug: "star-chart-foil", label: "Star-Chart Foil Plaque" }),
  Object.freeze({ kind: "shipHull", slug: "nebula-courier", label: "Nebula Courier" }),
  Object.freeze({ kind: "homeAccent", slug: "wayfinder-beacon", label: "Wayfinder Beacon" }),
  Object.freeze({ kind: "shipHull", slug: "sovereign-voyager", label: "Sovereign Voyager" })
]);

export const STAR_PATH_XP_RULES = Object.freeze({
  dailyBaseXpCap: 125,
  weeklyParticipationBonus: Object.freeze({
    xp: 200,
    availableWeeks: 8,
    requiresEligibleEvent: true
  }),
  wordWin: Object.freeze({
    xp: 30,
    requiresVerifiedResult: true,
    excludedModes: Object.freeze(["explore", "practice", "tutorial"])
  }),
  cosmosCircuit: Object.freeze({
    requiresVerifiedOrRewardEligibleResult: true,
    milestones: Object.freeze({
      drift: 20,
      orbit: 35,
      nebula: 55,
      galaxy: 85,
      cosmos: 125
    })
  })
});

const ALLOWED_WORD_MODES = new Set(["reach", "quick", "moves", "daily", "weekly", "challenge"]);
const TRACKS = new Set(["free", "supporter"]);

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function cleanText(value, maximum = 96) {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanId(value, maximum = 64) {
  return cleanText(value, maximum)
    .toLocaleLowerCase("en-US")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9:._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanEventId(value) {
  return cleanId(value, MAX_EVENT_ID_LENGTH);
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function migrateLegacyXp(value) {
  const legacyMax = LEGACY_TIER_THRESHOLDS.at(-1);
  const legacyXp = clampInteger(value, 0, legacyMax, 0);
  if (!legacyXp) return 0;
  if (legacyXp >= legacyMax) return STAR_PATH_MAX_XP;
  const upperIndex = LEGACY_TIER_THRESHOLDS.findIndex((threshold) => legacyXp < threshold);
  const lowerLegacy = upperIndex > 0 ? LEGACY_TIER_THRESHOLDS[upperIndex - 1] : 0;
  const upperLegacy = LEGACY_TIER_THRESHOLDS[upperIndex];
  const lowerCurrent = upperIndex > 0 ? TIER_THRESHOLDS[upperIndex - 1] : 0;
  const upperCurrent = TIER_THRESHOLDS[upperIndex];
  const ratio = (legacyXp - lowerLegacy) / Math.max(1, upperLegacy - lowerLegacy);
  return Math.round(lowerCurrent + (upperCurrent - lowerCurrent) * ratio);
}

function safeDateMs(value) {
  if (value === undefined) return Date.now();
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date.getTime();
  }
  if (typeof value === "string") {
    const date = new Date(cleanText(value, 64));
    if (Number.isFinite(date.getTime())) return date.getTime();
  }
  return SEASON_EPOCH_MS;
}

function seasonToken(index) {
  const prefix = index >= 0 ? "s" : "p";
  return `${prefix}${String(Math.abs(index) + 1).padStart(4, "0")}`;
}

function cloneSeason(season) {
  return {
    ...season,
    fairness: { ...season.fairness }
  };
}

/**
 * Resolves one globally reproducible eight-week season. Boundaries are always
 * Monday 00:00 UTC; locale and daylight-saving changes cannot move a season.
 */
export function starPathSeason(value = new Date()) {
  const timestamp = safeDateMs(value);
  const index = Math.floor((timestamp - SEASON_EPOCH_MS) / SEASON_MS);
  const startsAtMs = SEASON_EPOCH_MS + (index * SEASON_MS);
  const phase = PHASES[positiveModulo(index, PHASES.length)];
  const token = seasonToken(index);
  return {
    id: `star-path-${token}`,
    token,
    index,
    number: index + 1,
    phaseId: phase.id,
    title: `Star Path: ${phase.title}`,
    description: phase.description,
    accent: phase.accent,
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt: new Date(startsAtMs + SEASON_MS).toISOString(),
    durationDays: STAR_PATH_SEASON_DAYS,
    fairness: {
      cosmeticOnly: true,
      randomizedRewards: false,
      grantsTickets: false,
      grantsPowerups: false,
      grantsCurrency: false,
      grantsXpBoosts: false,
      gameplayAdvantage: false
    }
  };
}

function makeReward(season, track, tier, spec) {
  return {
    id: `constellore.star-path.${season.token}.${track}.${spec.kind}.${spec.slug}`,
    label: `${season.accent} ${spec.label}`,
    kind: spec.kind,
    track,
    tier,
    quantity: 1,
    exact: true,
    randomized: false,
    cosmeticOnly: true,
    gameplayEffect: "none",
    placeholder: false,
    presentation: "season-locker"
  };
}

function makeTier(season, index) {
  const tier = index + 1;
  return {
    tier,
    xpRequired: TIER_THRESHOLDS[index],
    rewards: {
      free: makeReward(season, "free", tier, FREE_REWARDS[index]),
      supporter: makeReward(season, "supporter", tier, SUPPORTER_REWARDS[index])
    }
  };
}

function cloneReward(reward) {
  return reward ? { ...reward } : null;
}

function cloneTier(tier) {
  return {
    tier: tier.tier,
    xpRequired: tier.xpRequired,
    rewards: {
      free: cloneReward(tier.rewards.free),
      supporter: cloneReward(tier.rewards.supporter)
    }
  };
}

/**
 * Public, exact reward disclosure for the selected season. There are no rolls,
 * mystery containers, gameplay items, race entries, or progression multipliers.
 */
export function starPathCatalog(value = new Date()) {
  const season = starPathSeason(value);
  return {
    version: STAR_PATH_VERSION,
    season: cloneSeason(season),
    tracks: {
      free: { id: "free", access: "everyone", cosmeticOnly: true },
      supporter: { id: "supporter", access: "supporter", cosmeticOnly: true }
    },
    tiers: TIER_THRESHOLDS.map((_, index) => makeTier(season, index))
  };
}

/**
 * Resolves only an authored Star Path reward ID, including prior or future
 * deterministic seasons. Invalid tokens such as s0000 and p0001 fail closed.
 */
export function starPathRewardById(value) {
  const id = cleanText(value, 180);
  const match = /^constellore[.]star-path[.]([sp])(\d{4})[.]/.exec(id);
  if (!match) return null;
  const ordinal = Number(match[2]);
  const index = match[1] === "s" ? ordinal - 1 : 1 - ordinal;
  if (ordinal < 1 || (match[1] === "p" && ordinal < 2)) return null;
  const at = new Date(SEASON_EPOCH_MS + index * SEASON_MS + 1);
  if (!Number.isFinite(at.getTime())) return null;
  const catalog = starPathCatalog(at);
  if (catalog.season.token !== `${match[1]}${match[2]}`) return null;
  const reward = catalog.tiers
    .flatMap((tier) => [tier.rewards.free, tier.rewards.supporter])
    .find((candidate) => candidate.id === id);
  return reward ? cloneReward(reward) : null;
}

function rawClaimList(source, track) {
  const nested = source.claimed && typeof source.claimed === "object" && !Array.isArray(source.claimed)
    ? source.claimed[track]
    : null;
  const legacy = track === "free"
    ? source.claimedFree ?? source.freeClaims
    : source.claimedSupporter ?? source.supporterClaims;
  return Array.isArray(nested) ? nested : Array.isArray(legacy) ? legacy : [];
}

function sanitizeClaimList(values, xp) {
  const tiers = new Set();
  for (const value of Array.isArray(values) ? values.slice(0, STAR_PATH_TIER_COUNT * 2) : []) {
    const tier = clampInteger(value, 0, STAR_PATH_TIER_COUNT, 0);
    if (tier >= 1 && xp >= TIER_THRESHOLDS[tier - 1]) tiers.add(tier);
  }
  return [...tiers].sort((a, b) => a - b);
}

function sanitizeEventLedger(values) {
  const ledger = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values.slice(0, STAR_PATH_MAX_CREDITED_EVENTS) : []) {
    const id = cleanEventId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ledger.push(id);
  }
  return ledger;
}

function utcDayKey(value) {
  return new Date(safeDateMs(value)).toISOString().slice(0, 10);
}

function seasonWeekKey(value) {
  const at = safeDateMs(value);
  const season = starPathSeason(value);
  const week = clampInteger(
    Math.floor((at - Date.parse(season.startsAt)) / (DAY_MS * 7)) + 1,
    1,
    STAR_PATH_XP_RULES.weeklyParticipationBonus.availableWeeks,
    1
  );
  return `${season.id}:w${String(week).padStart(2, "0")}`;
}

function sanitizeWeeklyBonusKeys(values, seasonId) {
  const result = [];
  const seen = new Set();
  const pattern = new RegExp(`^${seasonId}:w(?:0[1-8])$`);
  for (const value of Array.isArray(values) ? values.slice(0, 16) : []) {
    const key = cleanId(value, 80);
    if (!pattern.test(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result.sort();
}

/**
 * Fixed-shape state for local or cloud persistence. Old field aliases migrate
 * into the active season; stale-season progress cannot leak across a rollover.
 */
export function sanitizeStarPathState(raw, value = new Date()) {
  const season = starPathSeason(value);
  const dayKey = utcDayKey(value);
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const rawSeasonId = cleanId(source.seasonId ?? source.season?.id, 64);
  const belongsToSeason = !rawSeasonId || rawSeasonId === season.id;
  const legacyState = source.version == null || clampInteger(source.version, 0, 10_000, 0) < STAR_PATH_VERSION;
  const xp = belongsToSeason
    ? legacyState
      ? migrateLegacyXp(source.xp ?? source.seasonXp ?? source.experience)
      : clampInteger(source.xp ?? source.seasonXp ?? source.experience, 0, STAR_PATH_MAX_XP, 0)
    : 0;
  const rawEvents = source.creditedEventIds ?? source.creditedEvents ?? source.events;
  return {
    version: STAR_PATH_VERSION,
    seasonId: season.id,
    xp,
    creditedEventIds: belongsToSeason ? sanitizeEventLedger(rawEvents) : [],
    daily: {
      dayKey,
      baseXp: belongsToSeason && cleanText(source.daily?.dayKey, 10) === dayKey
        ? clampInteger(source.daily?.baseXp, 0, STAR_PATH_XP_RULES.dailyBaseXpCap, 0)
        : 0
    },
    weeklyBonusKeys: belongsToSeason
      ? sanitizeWeeklyBonusKeys(source.weeklyBonusKeys, season.id)
      : [],
    claimed: {
      free: belongsToSeason ? sanitizeClaimList(rawClaimList(source, "free"), xp) : [],
      supporter: belongsToSeason ? sanitizeClaimList(rawClaimList(source, "supporter"), xp) : []
    }
  };
}

function eventType(value) {
  const compact = cleanId(value, 48).replace(/[-_.:]/g, "");
  if (["wordwin", "win", "wordgamewin"].includes(compact)) return "wordWin";
  if (["cosmoscircuit", "circuit", "cosmosrace", "race"].includes(compact)) return "cosmosCircuit";
  return "";
}

function circuitMilestone(source) {
  const nested = source.reward && typeof source.reward === "object" && !Array.isArray(source.reward)
    ? source.reward
    : {};
  return cleanId(
    source.milestone ?? source.tier ?? source.rewardTier ?? nested.milestone ?? nested.tier,
    24
  );
}

/**
 * Builds the fixed XP event accepted by recordStarPathProgress from a completed
 * server result. Pure is explicit: Open, Study, and Practice results stay out.
 */
export function starPathWordWinXpEvent(rawResult = {}) {
  const source = rawResult && typeof rawResult === "object" && !Array.isArray(rawResult) ? rawResult : {};
  const placement = source.placement && typeof source.placement === "object" ? source.placement : {};
  const entry = placement.entry && typeof placement.entry === "object" ? placement.entry : {};
  return {
    type: "word_win",
    resultId: cleanEventId(source.resultId ?? source.runId ?? entry.runId ?? source.id),
    verified: source.verified === true,
    won: source.won === true || source.completed === true,
    mode: cleanId(source.mode ?? entry.mode, 24),
    division: cleanId(source.division ?? entry.division, 16),
    challengeId: cleanEventId(source.challengeId ?? entry.challengeId),
    practice: source.practice === true
  };
}

/** Builds the fixed XP event accepted from a completed Cosmos Circuit result. */
export function starPathCircuitXpEvent(rawResult = {}) {
  const source = rawResult && typeof rawResult === "object" && !Array.isArray(rawResult) ? rawResult : {};
  return {
    type: "cosmos_circuit",
    runId: cleanEventId(source.runId ?? source.eventId ?? source.resultId ?? source.id),
    verified: source.verified === true,
    rewardEligible: source.rewardEligible === true,
    path: cleanId(source.path, 16),
    milestone: circuitMilestone(source)
  };
}

function resolveXpEvent(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const type = eventType(source.type ?? source.kind ?? source.source);
  if (type === "wordWin") {
    const id = cleanEventId(source.eventId ?? source.resultId ?? source.runId ?? source.id);
    if (!id) return { eligible: false, reason: "missing_event_id" };
    const mode = cleanId(source.mode ?? source.gameMode, 24);
    if (source.verified !== true) return { eligible: false, reason: "unverified_result" };
    if (source.won !== true) return { eligible: false, reason: "not_a_win" };
    if (!ALLOWED_WORD_MODES.has(mode)) return { eligible: false, reason: "ineligible_mode" };
    if (cleanId(source.division, 16) !== "pure") {
      return { eligible: false, reason: "pure_result_required" };
    }
    const challengeId = cleanEventId(source.challengeId);
    if (source.practice === true || challengeId.startsWith("practice:")) {
      return { eligible: false, reason: "practice_result" };
    }
    return {
      eligible: true,
      source: "wordWin",
      eventKey: `word:${id}`,
      xp: STAR_PATH_XP_RULES.wordWin.xp
    };
  }
  if (type === "cosmosCircuit") {
    const id = cleanEventId(source.runId ?? source.eventId ?? source.resultId ?? source.id);
    if (!id) return { eligible: false, reason: "missing_event_id" };
    if (cleanId(source.path, 16) === "crazy") {
      return { eligible: false, reason: "crazy_path_excluded" };
    }
    if (source.verified !== true && source.rewardEligible !== true) {
      return { eligible: false, reason: "unverified_result" };
    }
    const milestone = circuitMilestone(source);
    const xp = STAR_PATH_XP_RULES.cosmosCircuit.milestones[milestone];
    if (!xp) return { eligible: false, reason: "unknown_milestone" };
    return {
      eligible: true,
      source: "cosmosCircuit",
      milestone,
      eventKey: `circuit:${id}`,
      xp
    };
  }
  return { eligible: false, reason: "unknown_source" };
}

/**
 * Applies one allowlisted, uniquely identified XP event. Raw XP amounts are
 * ignored, so callers cannot mint season progress by choosing a number.
 */
export function recordStarPathProgress(rawState, rawEvent, value = new Date()) {
  const state = sanitizeStarPathState(rawState, value);
  const event = resolveXpEvent(rawEvent);
  if (!event.eligible) {
    return {
      state,
      awarded: false,
      xpAwarded: 0,
      baseXpAwarded: 0,
      weeklyBonusXpAwarded: 0,
      baseXpPotential: 0,
      weeklyBonusXpPotential: 0,
      source: "",
      reason: event.reason
    };
  }
  if (state.xp >= STAR_PATH_MAX_XP) {
    return {
      state,
      awarded: false,
      xpAwarded: 0,
      baseXpAwarded: 0,
      weeklyBonusXpAwarded: 0,
      baseXpPotential: event.xp,
      weeklyBonusXpPotential: 0,
      source: event.source,
      reason: "path_complete"
    };
  }
  if (state.creditedEventIds.includes(event.eventKey)) {
    return {
      state,
      awarded: false,
      xpAwarded: 0,
      baseXpAwarded: 0,
      weeklyBonusXpAwarded: 0,
      baseXpPotential: 0,
      weeklyBonusXpPotential: 0,
      source: event.source,
      reason: "already_credited"
    };
  }
  if (state.creditedEventIds.length >= STAR_PATH_MAX_CREDITED_EVENTS) {
    return {
      state,
      awarded: false,
      xpAwarded: 0,
      baseXpAwarded: 0,
      weeklyBonusXpAwarded: 0,
      baseXpPotential: 0,
      weeklyBonusXpPotential: 0,
      source: event.source,
      reason: "event_ledger_full"
    };
  }
  const baseRoom = Math.max(0, STAR_PATH_XP_RULES.dailyBaseXpCap - state.daily.baseXp);
  const baseXpAvailable = Math.min(event.xp, baseRoom);
  const weeklyKey = seasonWeekKey(value);
  const weeklyBonusAvailable = state.weeklyBonusKeys.includes(weeklyKey)
    ? 0
    : STAR_PATH_XP_RULES.weeklyParticipationBonus.xp;
  const pathRoom = Math.max(0, STAR_PATH_MAX_XP - state.xp);
  const baseXpAwarded = Math.min(baseXpAvailable, pathRoom);
  const weeklyBonusXpAwarded = Math.min(
    weeklyBonusAvailable,
    Math.max(0, pathRoom - baseXpAwarded)
  );
  const xpAwarded = baseXpAwarded + weeklyBonusXpAwarded;
  const xp = state.xp + xpAwarded;
  const nextState = {
    ...state,
    xp,
    creditedEventIds: [...state.creditedEventIds, event.eventKey],
    daily: {
      dayKey: state.daily.dayKey,
      baseXp: Math.min(
        STAR_PATH_XP_RULES.dailyBaseXpCap,
        state.daily.baseXp + baseXpAvailable
      )
    },
    weeklyBonusKeys: weeklyBonusAvailable
      ? [...state.weeklyBonusKeys, weeklyKey].sort()
      : [...state.weeklyBonusKeys],
    claimed: {
      free: [...state.claimed.free],
      supporter: [...state.claimed.supporter]
    }
  };
  return {
    state: nextState,
    awarded: xpAwarded > 0,
    xpAwarded,
    baseXpAwarded,
    weeklyBonusXpAwarded,
    baseXpPotential: event.xp,
    weeklyBonusXpPotential: weeklyBonusAvailable,
    source: event.source,
    milestone: event.milestone || "",
    reason: xpAwarded > 0 ? "xp_awarded" : "daily_cap"
  };
}

export function starPathProgress(rawState, value = new Date()) {
  const state = sanitizeStarPathState(rawState, value);
  const catalog = starPathCatalog(value);
  let reachedTier = 0;
  for (const tier of catalog.tiers) {
    if (state.xp < tier.xpRequired) break;
    reachedTier = tier.tier;
  }
  const next = catalog.tiers[reachedTier] || null;
  const priorThreshold = reachedTier ? catalog.tiers[reachedTier - 1].xpRequired : 0;
  const span = next ? next.xpRequired - priorThreshold : 0;
  const towardNext = next ? state.xp - priorThreshold : 0;
  return {
    version: STAR_PATH_VERSION,
    season: catalog.season,
    xp: state.xp,
    maxXp: STAR_PATH_MAX_XP,
    reachedTier,
    totalTiers: STAR_PATH_TIER_COUNT,
    complete: reachedTier === STAR_PATH_TIER_COUNT,
    nextTier: next ? cloneTier(next) : null,
    percentToNext: next && span ? Math.round((towardNext / span) * 100) : 100,
    claimable: {
      free: catalog.tiers
        .filter((tier) => tier.xpRequired <= state.xp && !state.claimed.free.includes(tier.tier))
        .map((tier) => tier.tier),
      supporter: catalog.tiers
        .filter((tier) => tier.xpRequired <= state.xp && !state.claimed.supporter.includes(tier.tier))
        .map((tier) => tier.tier)
    },
    claimed: {
      free: [...state.claimed.free],
      supporter: [...state.claimed.supporter]
    }
  };
}

/**
 * Claims exactly one disclosed reward. Supporter access is checked at claim
 * time and changes availability only; it never changes XP or gameplay rules.
 */
export function claimStarPathReward(rawState, options = {}, value = new Date()) {
  const state = sanitizeStarPathState(rawState, value);
  const track = cleanId(options.track, 24);
  const tier = clampInteger(options.tier, 0, STAR_PATH_TIER_COUNT, 0);
  if (!TRACKS.has(track)) {
    return { state, claimed: false, reward: null, reason: "unknown_track" };
  }
  if (!tier) {
    return { state, claimed: false, reward: null, reason: "unknown_tier" };
  }
  if (track === "supporter" && options.supporterAccess !== true && options.supporter !== true) {
    return { state, claimed: false, reward: null, reason: "supporter_required" };
  }
  const catalog = starPathCatalog(value);
  const tierEntry = catalog.tiers[tier - 1];
  if (state.xp < tierEntry.xpRequired) {
    return { state, claimed: false, reward: null, reason: "tier_locked" };
  }
  if (state.claimed[track].includes(tier)) {
    return { state, claimed: false, reward: null, reason: "already_claimed" };
  }
  const nextState = {
    ...state,
    creditedEventIds: [...state.creditedEventIds],
    claimed: {
      free: [...state.claimed.free],
      supporter: [...state.claimed.supporter]
    }
  };
  nextState.claimed[track].push(tier);
  nextState.claimed[track].sort((a, b) => a - b);
  return {
    state: nextState,
    claimed: true,
    reward: cloneReward(tierEntry.rewards[track]),
    reason: "reward_claimed"
  };
}

/**
 * Claims every currently reached, unclaimed reward in deterministic tier order.
 * The Free lane is always included. Supporter rewards are included only when
 * active access is supplied; a missing entitlement never blocks Free claims.
 */
export function claimAllStarPathRewards(rawState, options = {}, value = new Date()) {
  const state = sanitizeStarPathState(rawState, value);
  const catalog = starPathCatalog(value);
  const supporterAccess = options.supporterAccess === true || options.supporter === true;
  const nextState = {
    ...state,
    creditedEventIds: [...state.creditedEventIds],
    daily: { ...state.daily },
    weeklyBonusKeys: [...state.weeklyBonusKeys],
    claimed: {
      free: [...state.claimed.free],
      supporter: [...state.claimed.supporter]
    }
  };
  const rewards = { free: [], supporter: [] };
  for (const tier of catalog.tiers) {
    if (tier.xpRequired > state.xp) break;
    if (!nextState.claimed.free.includes(tier.tier)) {
      nextState.claimed.free.push(tier.tier);
      rewards.free.push(cloneReward(tier.rewards.free));
    }
    if (supporterAccess && !nextState.claimed.supporter.includes(tier.tier)) {
      nextState.claimed.supporter.push(tier.tier);
      rewards.supporter.push(cloneReward(tier.rewards.supporter));
    }
  }
  nextState.claimed.free.sort((left, right) => left - right);
  nextState.claimed.supporter.sort((left, right) => left - right);
  const count = rewards.free.length + rewards.supporter.length;
  return {
    state: nextState,
    claimed: count > 0,
    count,
    claimedTiers: {
      free: rewards.free.map((reward) => reward.tier),
      supporter: rewards.supporter.map((reward) => reward.tier)
    },
    rewards,
    supporterAccess,
    reason: count > 0 ? "rewards_claimed" : "nothing_claimable"
  };
}
