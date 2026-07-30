export const REMIX_PROGRESSION_VERSION = 2;
export const REMIX_RANK_COUNT = 12;

const MAX_COMPLETED_CHALLENGES = 1_000_000;
const MAX_FAILED_CHALLENGES = 1_000_000;
const MAX_STREAK = 100_000;
const MAX_MASTERY_POINTS = 100_000_000;

export const PROMOTION_TRIAL_LENGTH = 3;
export const PROMOTION_WINS_REQUIRED = 2;

export const REMIX_MASTERY_THRESHOLDS = Object.freeze([
  0,
  50,
  200,
  550,
  1_100,
  1_900,
  3_000,
  4_200,
  5_600,
  7_100,
  8_800,
  10_600
]);

const LEGACY_COMPLETION_THRESHOLDS = Object.freeze([
  0,
  3,
  8,
  15,
  25,
  40,
  60,
  85,
  115,
  150,
  190,
  240
]);

const TERMINAL_FAILURES = new Set([
  "abandoned",
  "failed",
  "failure",
  "forfeit",
  "given_up",
  "reveal",
  "study",
  "timeout"
]);

const IGNORED_OUTCOMES = new Set([
  "combination_missing",
  "hint",
  "incorrect_pair",
  "invalid_pair",
  "missed_pair",
  "rejected_pair"
]);

const FAMILY_DEFINITIONS = [
  {
    id: "required_waypoint",
    name: "Waypoint",
    shortName: "Waypoint",
    capability: "requiredWaypoint",
    instruction: "Make one required word on the way."
  },
  {
    id: "forbidden_shortcut",
    name: "Blocked Shortcut",
    shortName: "Blocked Shortcut",
    capability: "forbiddenShortcut",
    instruction: "Reach the target without one shortcut pair."
  },
  {
    id: "master_route",
    name: "Master Route",
    shortName: "Master Route",
    capability: "masterRoute",
    instruction: "Use a different route to the target."
  },
  {
    id: "graph_safe_rule",
    name: "Special Rule",
    shortName: "Special Rule",
    capability: "graphSafeRule",
    instruction: "Follow one route-safe combination rule."
  },
  {
    id: "orbit_chain",
    name: "Orbit Chain",
    shortName: "Orbit Chain",
    capability: "orbitChain",
    instruction: "Build the target from a small moving word chain."
  }
];

export const REMIX_FAMILIES = Object.freeze(
  FAMILY_DEFINITIONS.map((family) => Object.freeze({ ...family }))
);

const RANK_DEFINITIONS = [
  {
    id: "bronze",
    name: "Bronze",
    masteryPoints: REMIX_MASTERY_THRESHOLDS[0],
    completedChallenges: 0,
    milestone: "Begin with classic challenges.",
    milestoneType: "foundation",
    minimumRemixes: 0,
    maximumRemixes: 0,
    unlockedFamilies: []
  },
  {
    id: "silver",
    name: "Silver",
    masteryPoints: REMIX_MASTERY_THRESHOLDS[1],
    completedChallenges: 3,
    milestone: "Establish a permanent route rank.",
    milestoneType: "rank",
    minimumRemixes: 0,
    maximumRemixes: 0,
    unlockedFamilies: []
  },
  {
    id: "gold",
    name: "Gold",
    masteryPoints: REMIX_MASTERY_THRESHOLDS[2],
    completedChallenges: 8,
    milestone: "Unlock Waypoint challenges.",
    milestoneType: "family-unlock",
    minimumRemixes: 1,
    maximumRemixes: 1,
    unlockedFamilies: ["required_waypoint"]
  },
  {
    id: "diamond",
    name: "Diamond",
    masteryPoints: REMIX_MASTERY_THRESHOLDS[3],
    completedChallenges: 15,
    milestone: "Unlock Blocked Shortcut and variable remix counts.",
    milestoneType: "family-unlock",
    minimumRemixes: 1,
    maximumRemixes: 2,
    unlockedFamilies: ["required_waypoint", "forbidden_shortcut"]
  },
  {
    id: "emerald",
    name: "Emerald",
    masteryPoints: REMIX_MASTERY_THRESHOLDS[4],
    completedChallenges: 25,
    milestone: "Unlock Master Route challenges.",
    milestoneType: "family-unlock",
    minimumRemixes: 2,
    maximumRemixes: 2,
    unlockedFamilies: [
      "required_waypoint",
      "forbidden_shortcut",
      "master_route"
    ]
  },
  {
    id: "sapphire",
    name: "Sapphire",
    masteryPoints: REMIX_MASTERY_THRESHOLDS[5],
    completedChallenges: 40,
    milestone: "Unlock Special Rule and three-remix routes.",
    milestoneType: "family-unlock",
    minimumRemixes: 2,
    maximumRemixes: 3,
    unlockedFamilies: [
      "required_waypoint",
      "forbidden_shortcut",
      "master_route",
      "graph_safe_rule"
    ]
  },
  {
    id: "ruby",
    name: "Ruby",
    masteryPoints: REMIX_MASTERY_THRESHOLDS[6],
    completedChallenges: 60,
    milestone: "Guarantee three simultaneous remix laws.",
    milestoneType: "difficulty",
    minimumRemixes: 3,
    maximumRemixes: 3,
    unlockedFamilies: [
      "required_waypoint",
      "forbidden_shortcut",
      "master_route",
      "graph_safe_rule"
    ]
  },
  {
    id: "master",
    name: "Master",
    masteryPoints: REMIX_MASTERY_THRESHOLDS[7],
    completedChallenges: 85,
    milestone: "Unlock Orbit Chain and the complete five-family pool.",
    milestoneType: "family-unlock",
    minimumRemixes: 3,
    maximumRemixes: 4,
    unlockedFamilies: REMIX_FAMILIES.map((family) => family.id)
  },
  {
    id: "grandmaster",
    name: "Grandmaster",
    masteryPoints: REMIX_MASTERY_THRESHOLDS[8],
    completedChallenges: 115,
    milestone: "Guarantee four simultaneous remix laws.",
    milestoneType: "difficulty",
    minimumRemixes: 4,
    maximumRemixes: 4,
    unlockedFamilies: REMIX_FAMILIES.map((family) => family.id)
  },
  {
    id: "mythic",
    name: "Mythic",
    masteryPoints: REMIX_MASTERY_THRESHOLDS[9],
    completedChallenges: 150,
    milestone: "Open the first five-remix routes.",
    milestoneType: "difficulty",
    minimumRemixes: 4,
    maximumRemixes: 5,
    unlockedFamilies: REMIX_FAMILIES.map((family) => family.id)
  },
  {
    id: "legend",
    name: "Legend",
    masteryPoints: REMIX_MASTERY_THRESHOLDS[10],
    completedChallenges: 190,
    milestone: "Guarantee the full five-remix challenge.",
    milestoneType: "mastery",
    minimumRemixes: 5,
    maximumRemixes: 5,
    unlockedFamilies: REMIX_FAMILIES.map((family) => family.id)
  },
  {
    id: "cosmic",
    name: "Cosmic",
    masteryPoints: REMIX_MASTERY_THRESHOLDS[11],
    completedChallenges: 240,
    milestone: "Complete the Cosmic capstone across every remix family.",
    milestoneType: "capstone",
    minimumRemixes: 5,
    maximumRemixes: 5,
    unlockedFamilies: REMIX_FAMILIES.map((family) => family.id)
  }
];

export const REMIX_RANKS = Object.freeze(
  RANK_DEFINITIONS.map((rank, index) => Object.freeze({
    ...rank,
    index,
    number: index + 1,
    unlockedFamilies: Object.freeze([...rank.unlockedFamilies])
  }))
);

export const REMIX_LATE_RANK_MILESTONES = Object.freeze(
  REMIX_RANKS
    .filter((rank) => rank.number >= 8)
    .map((rank) => Object.freeze({
      id: rank.id,
      name: rank.name,
      number: rank.number,
      masteryPoints: rank.masteryPoints,
      milestone: rank.milestone,
      milestoneType: rank.milestoneType
    }))
);

const FAMILY_BY_ID = new Map(REMIX_FAMILIES.map((family) => [family.id, family]));
const RANK_BY_ID = new Map(REMIX_RANKS.flatMap((rank) => [
  [rank.id, rank],
  [rank.name.toLocaleLowerCase("en-US"), rank]
]));

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function wholeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function canonicalFamilyId(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s-]+/g, "_");
}

function familyIds(candidate) {
  if (!Array.isArray(candidate)) return null;
  const allowed = new Set();
  for (const value of candidate) {
    const id = canonicalFamilyId(value?.id ?? value);
    if (FAMILY_BY_ID.has(id)) allowed.add(id);
  }
  return allowed;
}

function normalizedPair(value) {
  const entries = Array.isArray(value)
    ? value
    : String(value || "").split(/[|,+/]/);
  if (entries.length < 2) return null;
  const first = canonicalFamilyId(entries[0]?.id ?? entries[0]);
  const second = canonicalFamilyId(entries[1]?.id ?? entries[1]);
  if (!FAMILY_BY_ID.has(first) || !FAMILY_BY_ID.has(second) || first === second) {
    return null;
  }
  return [first, second].sort().join("|");
}

function incompatiblePairSet(candidate) {
  const pairs = new Set();
  if (!Array.isArray(candidate)) return pairs;
  for (const value of candidate) {
    const pair = normalizedPair(value);
    if (pair) pairs.add(pair);
  }
  return pairs;
}

function capabilityAllows(family, capabilities = {}) {
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) {
    return true;
  }
  const value = capabilities[family.capability] ?? capabilities[family.id];
  if (value === false || value === 0 || value === null) return false;
  if (typeof value === "object" && value && value.available === false) return false;
  return true;
}

/**
 * The five families are compatible in principle. Route generation performs the
 * real safety check by disabling a missing capability or supplying a pair in
 * `incompatiblePairs` (for example, a no-repeat rule that invalidates a
 * particular authored Master Route).
 */
export function remixFamiliesAreCompatible(first, second, context = {}) {
  const firstId = canonicalFamilyId(first?.id ?? first);
  const secondId = canonicalFamilyId(second?.id ?? second);
  if (!FAMILY_BY_ID.has(firstId) || !FAMILY_BY_ID.has(secondId)) return false;
  if (firstId === secondId) return false;
  const incompatible = incompatiblePairSet(context?.incompatiblePairs);
  return !incompatible.has([firstId, secondId].sort().join("|"));
}

function canonicalRankId(value) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US");
  return RANK_BY_ID.get(normalized)?.id || null;
}

function sanitizedRankId(candidate, masteryPoints, legacyRankId = null) {
  const masteryCeiling = remixRankFromMasteryPoints(masteryPoints);
  if (legacyRankId) return legacyRankId;
  const claimedId = canonicalRankId(
    candidate?.rankId ?? candidate?.currentRankId ?? candidate?.unlockedRankId
  );
  if (!claimedId) return REMIX_RANKS[0].id;
  const claimed = RANK_BY_ID.get(claimedId);
  return claimed.index <= masteryCeiling.index
    ? claimed.id
    : masteryCeiling.id;
}

function sanitizePromotionTrial(candidate, currentRank, masteryPoints) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const nextRank = REMIX_RANKS[currentRank.index + 1] || null;
  const targetRankId = canonicalRankId(candidate.targetRankId);
  if (
    !nextRank
    || targetRankId !== nextRank.id
    || masteryPoints < nextRank.masteryPoints
  ) {
    return null;
  }
  const attempts = clamp(
    wholeNumber(candidate.attempts),
    0,
    PROMOTION_TRIAL_LENGTH
  );
  const wins = clamp(
    wholeNumber(candidate.wins),
    0,
    attempts
  );
  const flawlessWins = clamp(
    wholeNumber(candidate.flawlessWins),
    0,
    wins
  );
  // A three-attempt record must have been resolved by the authoritative
  // outcome handler. Never revive a finished or forged active trial.
  if (attempts >= PROMOTION_TRIAL_LENGTH) return null;
  return {
    targetRankId: nextRank.id,
    attempts,
    wins,
    flawlessWins
  };
}

/**
 * Creates v2 mastery progression. A numeric value is accepted as the legacy
 * completed-challenge count and preserves the rank that count had unlocked.
 */
export function createRemixProgressionState(initial = 0) {
  const objectInput = initial && typeof initial === "object" && !Array.isArray(initial);
  const candidate = objectInput
    ? initial
    : { completedChallenges: initial };
  const completedChallenges = clamp(
    wholeNumber(candidate.completedChallenges),
    0,
    MAX_COMPLETED_CHALLENGES
  );
  const shouldMigrateLegacy = !objectInput || (
    candidate.masteryPoints == null
    && candidate.rankId == null
    && candidate.currentRankId == null
  );
  const legacyRank = shouldMigrateLegacy
    ? remixRankFromCompletedChallenges(completedChallenges)
    : null;
  const masteryPoints = clamp(
    wholeNumber(
      candidate.masteryPoints,
      legacyRank?.masteryPoints ?? completedChallenges
    ),
    0,
    MAX_MASTERY_POINTS
  );
  const rankId = sanitizedRankId(candidate, masteryPoints, legacyRank?.id);
  return {
    version: REMIX_PROGRESSION_VERSION,
    masteryPoints,
    completedChallenges,
    failedChallenges: 0,
    currentWinStreak: 0,
    rankId,
    promotionTrial: null
  };
}

/**
 * Allowlist-only persistence with cross-field validation. Rank claims are
 * capped by earned mastery, and active promotion trials must target exactly
 * the next eligible rank.
 */
export function sanitizeRemixProgressionState(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return createRemixProgressionState();
  }
  const completedChallenges = clamp(
    wholeNumber(candidate.completedChallenges),
    0,
    MAX_COMPLETED_CHALLENGES
  );
  const legacy = wholeNumber(candidate.version, 1) < REMIX_PROGRESSION_VERSION;
  const legacyRank = legacy && candidate.masteryPoints == null
    ? remixRankFromCompletedChallenges(completedChallenges)
    : null;
  const masteryPoints = clamp(
    wholeNumber(
      candidate.masteryPoints,
      legacyRank?.masteryPoints ?? completedChallenges
    ),
    0,
    MAX_MASTERY_POINTS
  );
  const rankId = sanitizedRankId(
    candidate,
    masteryPoints,
    legacyRank?.id
  );
  const currentRank = RANK_BY_ID.get(rankId);
  return {
    version: REMIX_PROGRESSION_VERSION,
    masteryPoints,
    completedChallenges,
    failedChallenges: clamp(
      wholeNumber(candidate.failedChallenges),
      0,
      MAX_FAILED_CHALLENGES
    ),
    currentWinStreak: clamp(
      wholeNumber(candidate.currentWinStreak),
      0,
      MAX_STREAK
    ),
    rankId,
    promotionTrial: sanitizePromotionTrial(
      candidate.promotionTrial ?? candidate.promotion,
      currentRank,
      masteryPoints
    )
  };
}

export function remixRankFromMasteryPoints(masteryPoints) {
  const mastery = clamp(
    wholeNumber(masteryPoints),
    0,
    MAX_MASTERY_POINTS
  );
  for (let index = REMIX_RANKS.length - 1; index >= 0; index -= 1) {
    if (mastery >= REMIX_RANKS[index].masteryPoints) {
      return REMIX_RANKS[index];
    }
  }
  return REMIX_RANKS[0];
}

export function remixRankFromCompletedChallenges(completedChallenges) {
  const completed = clamp(
    wholeNumber(completedChallenges),
    0,
    MAX_COMPLETED_CHALLENGES
  );
  for (let index = REMIX_RANKS.length - 1; index >= 0; index -= 1) {
    if (completed >= LEGACY_COMPLETION_THRESHOLDS[index]) {
      return REMIX_RANKS[index];
    }
  }
  return REMIX_RANKS[0];
}

export function getRemixRank(candidate) {
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    if (candidate.rank != null) return getRemixRank(candidate.rank);
    if (candidate.rankId != null) return getRemixRank(candidate.rankId);
    if (candidate.currentRankId != null) return getRemixRank(candidate.currentRankId);
    if (candidate.masteryPoints != null) {
      return remixRankFromMasteryPoints(candidate.masteryPoints);
    }
    if (candidate.completedChallenges != null) {
      return remixRankFromCompletedChallenges(candidate.completedChallenges);
    }
  }
  if (typeof candidate === "string") {
    const normalized = candidate
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("en-US");
    if (RANK_BY_ID.has(normalized)) return RANK_BY_ID.get(normalized);
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) return getRemixRank(numeric);
  }
  if (Number.isFinite(Number(candidate))) {
    // Explicit numeric ranks are player-facing and therefore one-based.
    const number = clamp(Math.round(Number(candidate)), 1, REMIX_RANK_COUNT);
    return REMIX_RANKS[number - 1];
  }
  return REMIX_RANKS[0];
}

function rankFromSelectionInput({
  rank,
  masteryPoints,
  completedChallenges,
  state
} = {}) {
  if (rank != null) return getRemixRank(rank);
  if (state != null) {
    return getRemixRank(sanitizeRemixProgressionState(state).rankId);
  }
  if (masteryPoints != null) {
    return remixRankFromMasteryPoints(masteryPoints);
  }
  if (completedChallenges != null) {
    return remixRankFromCompletedChallenges(completedChallenges);
  }
  return REMIX_RANKS[0];
}

function countLabel(minimum, maximum) {
  if (maximum <= 0) return "No remixes";
  if (minimum === maximum) {
    return `${minimum} remix${minimum === 1 ? "" : "es"}`;
  }
  return `${minimum}\u2013${maximum} remixes`;
}

export function getRemixRankPresentation(candidate) {
  const rank = candidate && typeof candidate === "object" && candidate.rank == null
    && candidate.rankId == null && candidate.completedChallenges != null
    ? remixRankFromCompletedChallenges(candidate.completedChallenges)
    : getRemixRank(candidate);
  const families = rank.unlockedFamilies
    .map((id) => FAMILY_BY_ID.get(id))
    .filter(Boolean);
  const nextRank = REMIX_RANKS[rank.index + 1] || null;
  return {
    id: rank.id,
    name: rank.name,
    number: rank.number,
    masteryPoints: rank.masteryPoints,
    completedChallenges: rank.completedChallenges,
    minimumRemixes: rank.minimumRemixes,
    maximumRemixes: rank.maximumRemixes,
    milestone: rank.milestone,
    milestoneType: rank.milestoneType,
    remixRange: countLabel(rank.minimumRemixes, rank.maximumRemixes),
    unlockedFamilies: families.map((family) => family.id),
    unlockedNames: families.map((family) => family.name),
    summary: rank.maximumRemixes === 0
      ? `${rank.name}: classic challenges`
      : `${rank.name}: ${countLabel(rank.minimumRemixes, rank.maximumRemixes)} per challenge`,
    nextRank: nextRank
      ? {
          id: nextRank.id,
          name: nextRank.name,
          masteryPoints: nextRank.masteryPoints,
          completedChallenges: nextRank.completedChallenges,
          milestone: nextRank.milestone,
          milestoneType: nextRank.milestoneType
        }
      : null
  };
}

function combinations(values, size, start = 0, prefix = [], output = []) {
  if (prefix.length === size) {
    output.push(prefix);
    return output;
  }
  for (
    let index = start;
    index <= values.length - (size - prefix.length);
    index += 1
  ) {
    combinations(values, size, index + 1, [...prefix, values[index]], output);
  }
  return output;
}

function combinationIsCompatible(ids, context) {
  for (let first = 0; first < ids.length; first += 1) {
    for (let second = first + 1; second < ids.length; second += 1) {
      if (!remixFamiliesAreCompatible(ids[first], ids[second], context)) {
        return false;
      }
    }
  }
  return true;
}

function deterministicCount(rank, availableCount, seed) {
  const maximum = Math.min(rank.maximumRemixes, availableCount);
  const minimum = Math.min(rank.minimumRemixes, maximum);
  if (maximum <= minimum) return maximum;
  return minimum + (
    stableHash(`${String(seed)}|${rank.id}|count`) % (maximum - minimum + 1)
  );
}

/**
 * Chooses a reproducible set of Remix families. The caller supplies which
 * graph-validated capabilities exist for this target. If a requested-sized
 * compatible set is impossible, selection gracefully steps down rather than
 * emitting an unwinnable challenge.
 */
export function selectChallengeRemixes({
  seed = 0,
  rank,
  masteryPoints,
  completedChallenges,
  state,
  availableFamilies,
  capabilities = {},
  incompatiblePairs = []
} = {}) {
  const selectedRank = rankFromSelectionInput({
    rank,
    masteryPoints,
    completedChallenges,
    state
  });
  const explicitAvailable = familyIds(availableFamilies);
  const unlocked = selectedRank.unlockedFamilies
    .map((id) => FAMILY_BY_ID.get(id))
    .filter(Boolean)
    .filter((family) => explicitAvailable == null || explicitAvailable.has(family.id))
    .filter((family) => capabilityAllows(family, capabilities));
  const context = { incompatiblePairs };
  const requestedCount = deterministicCount(selectedRank, unlocked.length, seed);
  let chosenIds = [];
  let realizedCount = requestedCount;

  while (realizedCount > 0) {
    const compatibleSets = combinations(
      unlocked.map((family) => family.id),
      realizedCount
    ).filter((ids) => combinationIsCompatible(ids, context));
    if (compatibleSets.length > 0) {
      compatibleSets.sort((first, second) => {
        const firstKey = first.join("|");
        const secondKey = second.join("|");
        const firstHash = stableHash(`${String(seed)}|${selectedRank.id}|${firstKey}`);
        const secondHash = stableHash(`${String(seed)}|${selectedRank.id}|${secondKey}`);
        return firstHash - secondHash || firstKey.localeCompare(secondKey);
      });
      const index = stableHash(
        `${String(seed)}|${selectedRank.id}|choice|${realizedCount}`
      ) % compatibleSets.length;
      chosenIds = compatibleSets[index];
      break;
    }
    realizedCount -= 1;
  }

  const modifiers = chosenIds.map((id) => ({ ...FAMILY_BY_ID.get(id) }));
  const summary = modifiers.length === 0
    ? "Classic challenge"
    : modifiers.map((modifier) => modifier.shortName).join(" + ");
  return {
    rank: getRemixRankPresentation(selectedRank),
    requestedCount,
    activeCount: modifiers.length,
    reducedForCompatibility: modifiers.length < requestedCount,
    modifiers,
    modifierIds: modifiers.map((modifier) => modifier.id),
    summary,
    instruction: modifiers.length === 0
      ? "Reach the target."
      : modifiers.map((modifier) => modifier.instruction).join(" ")
  };
}

export function masteryRequiredForRank(candidate) {
  return getRemixRank(candidate).masteryPoints;
}

export function getRemixMasteryProgress(candidate) {
  const state = sanitizeRemixProgressionState(candidate);
  const rank = getRemixRank(state.rankId);
  const nextRank = REMIX_RANKS[rank.index + 1] || null;
  const floor = rank.masteryPoints;
  const ceiling = nextRank?.masteryPoints ?? floor;
  const span = Math.max(0, ceiling - floor);
  const earned = span === 0
    ? 0
    : clamp(state.masteryPoints - floor, 0, span);
  return {
    rank: getRemixRankPresentation(rank),
    nextRank: nextRank ? getRemixRankPresentation(nextRank) : null,
    masteryPoints: state.masteryPoints,
    rankFloor: floor,
    nextThreshold: nextRank?.masteryPoints ?? null,
    pointsIntoRank: earned,
    pointsRequired: span,
    pointsRemaining: nextRank
      ? Math.max(0, nextRank.masteryPoints - state.masteryPoints)
      : 0,
    fraction: span === 0 ? 1 : earned / span,
    thresholdReached: Boolean(
      nextRank && state.masteryPoints >= nextRank.masteryPoints
    )
  };
}

/**
 * Competitive mastery is intentionally bounded to 5–25 points per completed
 * challenge. Strong play climbs faster, while Reveal/Study and failed runs
 * never grant mastery.
 */
export function masteryAwardForOutcome(event = {}) {
  const outcome = String(event?.outcome || "").trim().toLocaleLowerCase("en-US");
  if (
    outcome !== "completed"
    || event.revealed === true
    || event.usedReveal === true
    || event.assisted === true
    || event.usedMajorPowerup === true
    || event.usedPaidHelp === true
    || event.paidHelp === true
    || String(event.source || "").toLocaleLowerCase("en-US") === "reveal"
  ) {
    return 0;
  }
  const base = event.flawless === true
    ? 20
    : event.clean === true
      ? 15
      : 10;
  const remixBonus = clamp(
    wholeNumber(event.activeRemixes ?? event.remixCount),
    0,
    5
  );
  return clamp(base + remixBonus, 5, 25);
}

export function getPromotionEligibility(candidate) {
  const state = sanitizeRemixProgressionState(candidate);
  const rank = getRemixRank(state.rankId);
  const nextRank = REMIX_RANKS[rank.index + 1] || null;
  const active = Boolean(state.promotionTrial);
  const masteryRemaining = nextRank
    ? Math.max(0, nextRank.masteryPoints - state.masteryPoints)
    : 0;
  const thresholdReached = Boolean(nextRank && masteryRemaining === 0);
  return {
    rank: getRemixRankPresentation(rank),
    nextRank: nextRank ? getRemixRankPresentation(nextRank) : null,
    active,
    eligible: Boolean(nextRank && thresholdReached && !active),
    status: !nextRank
      ? "max_rank"
      : active
        ? "active"
        : thresholdReached
          ? "ready"
          : "mastery_needed",
    masteryPoints: state.masteryPoints,
    requiredMastery: nextRank?.masteryPoints ?? null,
    masteryRemaining,
    trialLength: PROMOTION_TRIAL_LENGTH,
    winsRequired: PROMOTION_WINS_REQUIRED,
    trial: state.promotionTrial ? { ...state.promotionTrial } : null
  };
}

export function startRemixPromotionTrial(candidate) {
  const state = sanitizeRemixProgressionState(candidate);
  const eligibility = getPromotionEligibility(state);
  if (!eligibility.eligible) {
    return {
      state,
      started: false,
      reason: eligibility.status,
      eligibility
    };
  }
  const nextState = {
    ...state,
    promotionTrial: {
      targetRankId: eligibility.nextRank.id,
      attempts: 0,
      wins: 0,
      flawlessWins: 0
    }
  };
  return {
    state: nextState,
    started: true,
    reason: "started",
    eligibility: getPromotionEligibility(nextState)
  };
}

/**
 * Resolves promotion only after all three challenges. A competitive 2/3
 * promotes; a flawless 3/3 starts the new rank at least 25% toward the next
 * one. Failed series retain 80% of the filled rank meter.
 */
export function recordRemixPromotionTrialOutcome(candidate, event = {}) {
  const state = sanitizeRemixProgressionState(candidate);
  const trial = state.promotionTrial;
  if (!trial) {
    return {
      state,
      changed: false,
      outcome: "ignored",
      active: false,
      passed: false,
      failed: false,
      promoted: false,
      bonusMastery: 0,
      message: ""
    };
  }
  const outcome = String(event?.outcome || "").trim().toLocaleLowerCase("en-US");
  if (
    IGNORED_OUTCOMES.has(outcome)
    || (outcome !== "completed" && !TERMINAL_FAILURES.has(outcome))
  ) {
    return {
      state,
      changed: false,
      outcome: "ignored",
      active: true,
      passed: false,
      failed: false,
      promoted: false,
      bonusMastery: 0,
      message: ""
    };
  }

  const competitiveWin = outcome === "completed"
    && event.assisted !== true
    && event.revealed !== true
    && event.usedReveal !== true
    && event.usedMajorPowerup !== true;
  const flawlessWin = competitiveWin && event.flawless === true;
  const nextTrial = {
    ...trial,
    attempts: trial.attempts + 1,
    wins: trial.wins + (competitiveWin ? 1 : 0),
    flawlessWins: trial.flawlessWins + (flawlessWin ? 1 : 0)
  };

  if (nextTrial.attempts < PROMOTION_TRIAL_LENGTH) {
    const nextState = { ...state, promotionTrial: nextTrial };
    return {
      state: nextState,
      changed: true,
      outcome,
      active: true,
      passed: false,
      failed: false,
      promoted: false,
      bonusMastery: 0,
      message: `${nextTrial.wins}/${PROMOTION_WINS_REQUIRED} promotion wins.`
    };
  }

  const currentRank = getRemixRank(state.rankId);
  const targetRank = getRemixRank(trial.targetRankId);
  const passed = nextTrial.wins >= PROMOTION_WINS_REQUIRED;
  if (passed) {
    const followingRank = REMIX_RANKS[targetRank.index + 1] || null;
    const flawlessSeries = nextTrial.flawlessWins === PROMOTION_TRIAL_LENGTH;
    const bonusTarget = flawlessSeries && followingRank
      ? targetRank.masteryPoints + Math.floor(
          (followingRank.masteryPoints - targetRank.masteryPoints) * 0.25
        )
      : state.masteryPoints;
    const masteryPoints = Math.max(state.masteryPoints, bonusTarget);
    const bonusMastery = masteryPoints - state.masteryPoints;
    const nextState = {
      ...state,
      masteryPoints,
      rankId: targetRank.id,
      promotionTrial: null
    };
    return {
      state: nextState,
      changed: true,
      outcome,
      active: false,
      passed: true,
      failed: false,
      promoted: true,
      bonusMastery,
      message: flawlessSeries
        ? `${targetRank.name} reached with a flawless-series bonus.`
        : `${targetRank.name} reached.`
    };
  }

  const retainedMastery = currentRank.index >= REMIX_RANKS.length - 1
    ? state.masteryPoints
    : currentRank.masteryPoints + Math.floor(
        (targetRank.masteryPoints - currentRank.masteryPoints) * 0.8
      );
  const nextState = {
    ...state,
    masteryPoints: Math.min(state.masteryPoints, retainedMastery),
    promotionTrial: null
  };
  return {
    state: nextState,
    changed: true,
    outcome,
    active: false,
    passed: false,
    failed: true,
    promoted: false,
    bonusMastery: 0,
    message: `${currentRank.name} kept. Promotion can be retried after rebuilding the meter.`
  };
}

export function recordRemixProgressionOutcome(candidate, event = {}) {
  const state = sanitizeRemixProgressionState(candidate);
  const outcome = String(event?.outcome || "").trim().toLocaleLowerCase("en-US");
  const rankBefore = getRemixRank(state.rankId);
  if (
    IGNORED_OUTCOMES.has(outcome)
    || (outcome !== "completed" && !TERMINAL_FAILURES.has(outcome))
  ) {
    return {
      state,
      changed: false,
      outcome: "ignored",
      rankBefore: getRemixRankPresentation(rankBefore),
      rankAfter: getRemixRankPresentation(rankBefore),
      rankUp: false,
      message: ""
    };
  }

  const completed = outcome === "completed";
  const masteryAward = masteryAwardForOutcome(event);
  const promotionBefore = getPromotionEligibility(state);
  const nextState = {
    ...state,
    masteryPoints: clamp(
      state.masteryPoints + masteryAward,
      0,
      MAX_MASTERY_POINTS
    ),
    completedChallenges: completed
      ? clamp(state.completedChallenges + 1, 0, MAX_COMPLETED_CHALLENGES)
      : state.completedChallenges,
    failedChallenges: completed
      ? state.failedChallenges
      : clamp(state.failedChallenges + 1, 0, MAX_FAILED_CHALLENGES),
    currentWinStreak: completed
      ? clamp(state.currentWinStreak + 1, 0, MAX_STREAK)
      : 0
  };
  const rankAfter = getRemixRank(nextState.rankId);
  const promotionAfter = getPromotionEligibility(nextState);
  const promotionUnlocked = !promotionBefore.eligible && promotionAfter.eligible;
  return {
    state: nextState,
    changed: true,
    outcome,
    masteryAward,
    rankBefore: getRemixRankPresentation(rankBefore),
    rankAfter: getRemixRankPresentation(rankAfter),
    rankUp: false,
    promotionUnlocked,
    promotion: promotionAfter,
    message: promotionUnlocked
      ? `${promotionAfter.nextRank.name} promotion ready.`
      : completed
        ? masteryAward > 0
          ? `Challenge complete. +${masteryAward} mastery.`
          : "Challenge complete."
        : "Rank kept. Try the next challenge."
  };
}
