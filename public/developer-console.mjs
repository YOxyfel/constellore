import {
  ADAPTIVE_LEVEL_MAX,
  ADAPTIVE_LEVEL_MIN,
  ADAPTIVE_LEVEL_START,
  createAdaptiveDifficultyState
} from "./adaptive-difficulty.mjs?v=5.0.0-beta.1";
import {
  HOME_MENU_ADVANCED_WINS,
  HOME_MENU_CHOICES_RANK,
  HOME_MENU_CHOICES_WINS,
  HOME_MENU_EXPLORE_RANK,
  HOME_MENU_EXPLORE_WINS
} from "./home-menu.mjs?v=5.0.0-beta.1";
import {
  REMIX_PROGRESSION_VERSION,
  REMIX_RANKS,
  createRemixProgressionState
} from "./remix-progression.mjs?v=5.0.0-beta.1";

export const DEVELOPER_CONSOLE_VERSION = 1;

const DEVELOPER_USERNAME = "oxyfelcorp";
const DEVELOPER_PASSWORD = "admin";

/**
 * This is deliberately a memory-only UI gate for local testing, not a security
 * boundary. The credentials are compared exactly and are never returned or
 * written to browser storage.
 */
export function verifyDeveloperCredentials(username, password) {
  return typeof username === "string"
    && typeof password === "string"
    && username === DEVELOPER_USERNAME
    && password === DEVELOPER_PASSWORD;
}

export const DEVELOPER_RANK_OPTIONS = Object.freeze(
  REMIX_RANKS.map((rank) => Object.freeze({
    id: rank.id,
    name: rank.name,
    number: rank.number,
    label: `${String(rank.number).padStart(2, "0")} · ${rank.name}`,
    masteryPoints: rank.masteryPoints,
    completedChallenges: rank.completedChallenges
  }))
);

const RANK_BY_ID = new Map(
  DEVELOPER_RANK_OPTIONS.flatMap((rank) => [
    [rank.id, rank],
    [rank.name.toLocaleLowerCase("en-US"), rank]
  ])
);

function developerRank(candidate) {
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    if (candidate.rank != null && candidate.rank !== candidate) {
      return developerRank(candidate.rank);
    }
    if (candidate.rankId != null) return developerRank(candidate.rankId);
    if (candidate.id != null) return developerRank(candidate.id);
    if (candidate.number != null) return developerRank(candidate.number);
  }

  if (typeof candidate === "string") {
    const normalized = candidate
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("en-US");
    if (RANK_BY_ID.has(normalized)) return RANK_BY_ID.get(normalized);
    if (/^\d+$/u.test(normalized)) return developerRank(Number(normalized));
  }

  if (
    typeof candidate === "number"
    && Number.isInteger(candidate)
    && candidate >= 1
    && candidate <= DEVELOPER_RANK_OPTIONS.length
  ) {
    return DEVELOPER_RANK_OPTIONS[candidate - 1];
  }

  throw new RangeError("A valid developer rank from 1 to 12 is required.");
}

function minimumWinsForRank(rank) {
  if (rank.number === 1) return 1;
  if (rank.number === 2) return 3;
  return Math.max(10, rank.completedChallenges);
}

/**
 * Produces a coherent profile fragment for a selected rank. Every preset has
 * completed both onboarding orbits so the requested rank can be tested
 * immediately.
 */
export function createDeveloperRankPreset(candidate) {
  const rank = developerRank(candidate);
  const minimumWins = minimumWinsForRank(rank);
  const routeProgression = createRemixProgressionState({
    version: REMIX_PROGRESSION_VERSION,
    rankId: rank.id,
    masteryPoints: rank.masteryPoints,
    completedChallenges: Math.max(minimumWins, rank.completedChallenges)
  });

  return {
    rank: { ...rank },
    minimumWins,
    onboardingComplete: true,
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true },
    routeProgression
  };
}

export function normalizeDeveloperDifficultyLevel(
  value,
  fallback = ADAPTIVE_LEVEL_START
) {
  const fallbackNumber = Number(fallback);
  const safeFallback = Number.isFinite(fallbackNumber)
    ? Math.min(
        ADAPTIVE_LEVEL_MAX,
        Math.max(ADAPTIVE_LEVEL_MIN, Math.round(fallbackNumber))
      )
    : ADAPTIVE_LEVEL_START;
  const number = Number(value);
  if (!Number.isFinite(number)) return safeFallback;
  return Math.min(
    ADAPTIVE_LEVEL_MAX,
    Math.max(ADAPTIVE_LEVEL_MIN, Math.round(number))
  );
}

export function createDeveloperDifficultyState(
  level = ADAPTIVE_LEVEL_START
) {
  return createAdaptiveDifficultyState(
    normalizeDeveloperDifficultyLevel(level)
  );
}

export const DEVELOPER_MODE_OPTIONS = Object.freeze([
  Object.freeze({ id: "training", label: "First Orbit training" }),
  Object.freeze({ id: "reach", label: "Relaxed target" }),
  Object.freeze({ id: "daily", label: "Today's word" }),
  Object.freeze({ id: "quick", label: "Quick timer" }),
  Object.freeze({ id: "moves", label: "Move limit" }),
  Object.freeze({ id: "explore", label: "Free play" }),
  Object.freeze({ id: "weekly", label: "Weekly route" })
]);

function nonNegativeWholeNumber(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function modeUnavailableReason(mode, onboardingComplete) {
  if (!onboardingComplete && mode !== "training") {
    return "Complete onboarding first.";
  }
  if (mode === "quick" || mode === "moves") {
    return `Unlocks at Gold with ${HOME_MENU_CHOICES_WINS} wins.`;
  }
  if (mode === "explore") {
    return `Unlocks at Silver with ${HOME_MENU_EXPLORE_WINS} wins.`;
  }
  if (mode === "weekly") {
    return `Unlocks at Gold with ${HOME_MENU_ADVANCED_WINS} wins.`;
  }
  return "";
}

/**
 * Returns the seven launchable developer modes in stable UI order.
 *
 * Passing a rank preset is supported directly. A plain rank id, name, or
 * number uses that rank's minimum coherent wins and completed onboarding.
 */
export function developerModeAvailability(candidate = "bronze") {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : { rank: candidate };
  const preset = createDeveloperRankPreset(
    source.rank ?? source.rankId ?? source.id ?? source.number
  );
  const wins = nonNegativeWholeNumber(
    source.wins ?? source.minimumWins,
    preset.minimumWins
  );
  const onboardingComplete = source.onboardingComplete == null
    ? preset.onboardingComplete
    : source.onboardingComplete === true;
  const rankNumber = preset.rank.number;

  const availability = {
    training: true,
    reach: onboardingComplete,
    daily: onboardingComplete,
    quick: onboardingComplete
      && wins >= HOME_MENU_CHOICES_WINS
      && rankNumber >= HOME_MENU_CHOICES_RANK,
    moves: onboardingComplete
      && wins >= HOME_MENU_CHOICES_WINS
      && rankNumber >= HOME_MENU_CHOICES_RANK,
    explore: onboardingComplete
      && wins >= HOME_MENU_EXPLORE_WINS
      && rankNumber >= HOME_MENU_EXPLORE_RANK,
    weekly: onboardingComplete
      && wins >= HOME_MENU_ADVANCED_WINS
      && rankNumber >= HOME_MENU_CHOICES_RANK
  };

  return Object.freeze(
    DEVELOPER_MODE_OPTIONS.map((mode) => Object.freeze({
      ...mode,
      available: availability[mode.id],
      reason: availability[mode.id]
        ? ""
        : modeUnavailableReason(mode.id, onboardingComplete)
    }))
  );
}

const SHOWCASE_HISTORY = Object.freeze([
  Object.freeze({
    a: "Earth",
    b: "Water",
    word: "Mud",
    emoji: "🟤",
    category: "nature"
  }),
  Object.freeze({
    a: "Mud",
    b: "Fire",
    word: "Brick",
    emoji: "🧱",
    category: "structure"
  }),
  Object.freeze({
    a: "Brick",
    b: "Brick",
    word: "Wall",
    emoji: "🧱",
    category: "structure"
  }),
  Object.freeze({
    a: "Wall",
    b: "Wall",
    word: "House",
    emoji: "🏠",
    category: "structure"
  })
]);

/**
 * A repeatable, completed route suitable for buildConstellationCard().
 * A fresh object graph is returned so preview code may safely decorate it.
 */
export function createDeveloperShowcaseCardInput() {
  return {
    target: "House",
    emoji: "🏠",
    clue: "Every piece found its place among the stars.",
    realm: "structure",
    mode: "challenge",
    moves: SHOWCASE_HISTORY.length,
    seconds: 42,
    stars: 5,
    discoveries: SHOWCASE_HISTORY.length,
    completed: true,
    training: false,
    scoringDisabled: false,
    assist: "none",
    wished: false,
    seedIdentity: "developer-showcase-v1",
    universe: {
      id: "developer-showcase-v1",
      name: "Aurora Foundry"
    },
    law: {
      name: "Echoing Matter"
    },
    history: SHOWCASE_HISTORY.map((step) => ({ ...step }))
  };
}
