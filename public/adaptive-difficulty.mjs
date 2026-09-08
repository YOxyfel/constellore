export const ADAPTIVE_DIFFICULTY_VERSION = 2;
export const ADAPTIVE_LEVEL_MIN = 1;
export const ADAPTIVE_LEVEL_MAX = 10;
export const ADAPTIVE_LEVEL_START = 1;
export const ADAPTIVE_RECENT_TARGET_LIMIT = 8;
export const ADAPTIVE_COMPLETIONS_PER_LEVEL = 3;
export const ADAPTIVE_MAJOR_CHALLENGE_INTERVAL = 10;
export const ADAPTIVE_MAJOR_CHALLENGE_BONUS = 3;
export const ADAPTIVE_DIFFICULT_TAG_LEVEL = 8;
export const ADAPTIVE_AVOID_TARGET_MAX_LENGTH = 80;
export const ADAPTIVE_PRESSURE_UNLOCK_RANK_NUMBER = 3;

const MAX_FAILURE_STREAK = 100;
const MAX_COMPLETED_CHALLENGES = 1_000_000;
const MAX_TARGET_LENGTH = ADAPTIVE_AVOID_TARGET_MAX_LENGTH;

const EXCLUDED_MODES = new Set([
  "challenge",
  "custom",
  "daily",
  "explore",
  "fixed",
  "second-orbit",
  "shared",
  "training",
  "weekly"
]);

const FAILURE_OUTCOMES = new Set([
  "abandoned",
  "failed",
  "failure",
  "forfeit",
  "given_up",
  "reveal",
  "study",
  "timeout"
]);

// Pair misses and optional, bounded help are run events, not challenge
// outcomes. Experimenting with words must never secretly change the next game.
const IGNORED_OUTCOMES = new Set([
  "combination_missing",
  "hint",
  "incorrect_pair",
  "invalid_pair",
  "missed_pair",
  "rejected_pair"
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function wholeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

export function adaptiveDifficultyTag(challengeLevel) {
  const level = Number(challengeLevel);
  return Number.isFinite(level) && level >= ADAPTIVE_DIFFICULT_TAG_LEVEL
    ? "Difficult"
    : "";
}

function cleanTarget(value) {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TARGET_LENGTH);
}

function targetKey(value) {
  return cleanTarget(value).toLocaleLowerCase("en-US");
}

/**
 * Parses the one client-authored target-selection exclusion. Keeping this
 * boundary tiny and explicit lets preview/start requests bind the same
 * canonical value without allowing arbitrary strings into run identity.
 */
export function parseAdaptiveAvoidTarget(value) {
  if (value == null || value === "") return { valid: true, target: "" };
  if (typeof value !== "string" || value.length > MAX_TARGET_LENGTH * 4) {
    return { valid: false, target: "" };
  }
  const target = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (target.length > MAX_TARGET_LENGTH) return { valid: false, target: "" };
  return { valid: true, target };
}

function rankNumber(candidate) {
  const direct = Number(candidate?.number);
  if (Number.isFinite(direct)) return Math.max(1, Math.trunc(direct));
  const id = String(candidate?.id ?? candidate ?? "").trim().toLowerCase();
  if (id === "silver") return 2;
  if (id === "gold") return 3;
  return id === "bronze" || !id ? 1 : ADAPTIVE_PRESSURE_UNLOCK_RANK_NUMBER;
}

/**
 * Bronze and Silver introduce the word graph without timers or move limits.
 * A manual Quick/Moves request therefore becomes a personal Reach run until
 * the authoritative Route Rank reaches Gold. Fixed/shared modes never enter
 * this policy.
 */
export function adaptiveRunEntryPolicy(context = {}) {
  const mode = String(context?.mode || "").trim().toLowerCase() || "reach";
  const modePolicy = adaptiveModePolicy(context);
  const requestedPressure = mode === "quick" || mode === "moves";
  const pressureUnlocked = rankNumber(context?.rank) >= ADAPTIVE_PRESSURE_UNLOCK_RANK_NUMBER;
  const sharedOrFixed = contextValue(context, "shared") || contextValue(context, "fixed");
  const relaxedForRank = requestedPressure && !pressureUnlocked && !sharedOrFixed;
  const personal = modePolicy.eligible && (context?.adaptive === true || relaxedForRank);
  return {
    personal,
    relaxedForRank,
    pressureUnlocked,
    requestedMode: mode,
    mode: relaxedForRank ? "reach" : mode,
    policy: modePolicy
  };
}

function sanitizedRecentTargets(candidate) {
  const sources = Array.isArray(candidate) ? candidate : [];
  const reversed = [];
  const seen = new Set();
  // The last occurrence is the most recent one, so deduplicate backwards.
  for (let index = sources.length - 1; index >= 0; index -= 1) {
    const target = cleanTarget(sources[index]);
    const key = targetKey(target);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    reversed.push(target);
    if (reversed.length >= ADAPTIVE_RECENT_TARGET_LIMIT) break;
  }
  return reversed.reverse();
}

export function createAdaptiveDifficultyState(level = ADAPTIVE_LEVEL_START) {
  return {
    version: ADAPTIVE_DIFFICULTY_VERSION,
    level: clamp(wholeNumber(level, ADAPTIVE_LEVEL_START), ADAPTIVE_LEVEL_MIN, ADAPTIVE_LEVEL_MAX),
    failureStreak: 0,
    completedChallenges: 0,
    majorChallengePending: false,
    majorChallengeBaseLevel: null,
    recoveryLevel: null,
    recoveryStrict: false,
    recentTargets: []
  };
}

/**
 * Allowlist-only persistence boundary. There are deliberately no timestamps,
 * device identifiers, raw attempts, scores, or leaderboard fields in state.
 */
export function sanitizeAdaptiveDifficultyState(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return createAdaptiveDifficultyState();
  }
  const inferredVersion = candidate.completedChallenges != null
    || candidate.majorChallengePending != null
    || candidate.majorChallengeBaseLevel != null
    ? 2
    : 1;
  const candidateVersion = wholeNumber(candidate.version, inferredVersion);
  let level = clamp(
    wholeNumber(candidate.level, ADAPTIVE_LEVEL_START),
    ADAPTIVE_LEVEL_MIN,
    ADAPTIVE_LEVEL_MAX
  );
  // Version 1 did not persist completed challenges or milestone state. Its
  // current level and recent-target history remain valid, while the new
  // cadence begins cleanly from that point.
  const completedChallenges = candidateVersion >= 2
    ? clamp(wholeNumber(candidate.completedChallenges), 0, MAX_COMPLETED_CHALLENGES)
    : 0;
  const majorChallengePending = candidateVersion >= 2 && candidate.majorChallengePending === true;
  const majorChallengeBaseLevel = majorChallengePending
    ? clamp(
        wholeNumber(candidate.majorChallengeBaseLevel, level),
        ADAPTIVE_LEVEL_MIN,
        ADAPTIVE_LEVEL_MAX
      )
    : null;
  const recoveryLevel = candidateVersion >= 2
    && candidate.recoveryLevel != null
    && candidate.recoveryLevel !== ""
    && Number.isFinite(Number(candidate.recoveryLevel))
    ? clamp(
        wholeNumber(candidate.recoveryLevel, level),
        ADAPTIVE_LEVEL_MIN,
        ADAPTIVE_LEVEL_MAX
      )
    : null;
  // A pending milestone always keeps an immutable copy of the ordinary level.
  // This makes a failed surge recover exactly, even after a torn local write.
  if (majorChallengePending) level = majorChallengeBaseLevel;
  return {
    version: ADAPTIVE_DIFFICULTY_VERSION,
    level,
    failureStreak: clamp(wholeNumber(candidate.failureStreak), 0, MAX_FAILURE_STREAK),
    completedChallenges,
    majorChallengePending,
    majorChallengeBaseLevel,
    recoveryLevel,
    recoveryStrict: recoveryLevel != null && candidate.recoveryStrict !== false,
    recentTargets: sanitizedRecentTargets(candidate.recentTargets)
  };
}

function contextValue(context, key) {
  return Boolean(context?.[key] ?? context?.flags?.[key] ?? context?.metadata?.[key]);
}

/**
 * Adaptive targets are personal and therefore explicitly outside ranked and
 * leaderboard comparisons. Fixed challenges stay untouched and keep their
 * caller-owned competitive policy.
 */
export function adaptiveModePolicy(context = {}) {
  const mode = String(context?.mode || "").trim().toLowerCase();
  const excludedFlag = [
    "custom",
    "daily",
    "fixed",
    "shared",
    "training",
    "userChosen"
  ].find((key) => contextValue(context, key));
  const reason = !mode
    ? "missing_mode"
    : EXCLUDED_MODES.has(mode)
      ? `${mode}_is_fixed`
      : excludedFlag
        ? `${excludedFlag.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_is_fixed`
        : "personal_adaptive";
  const eligible = reason === "personal_adaptive";
  return {
    eligible,
    reason,
    fairness: eligible
      ? {
          adaptiveTargeting: true,
          personal: true,
          rankedEligible: false,
          leaderboardEligible: false,
          decision: "personal_adaptive_runs_are_unranked"
        }
      : {
          adaptiveTargeting: false,
          personal: false,
          rankedEligible: "unchanged",
          leaderboardEligible: "unchanged",
          decision: "fixed_challenge_rules_are_unchanged"
        }
  };
}

function completionsTowardNextLevel(completedChallenges) {
  return completedChallenges % ADAPTIVE_COMPLETIONS_PER_LEVEL;
}

/**
 * Returns the target difficulty for the next adaptive game. `state.level` is
 * always the ordinary/base difficulty; a milestone temporarily adds its bonus
 * for exactly one challenge without mutating that base.
 */
export function adaptiveChallengeLevel(candidate) {
  const state = sanitizeAdaptiveDifficultyState(candidate);
  return clamp(
    state.level + (state.majorChallengePending ? ADAPTIVE_MAJOR_CHALLENGE_BONUS : 0),
    ADAPTIVE_LEVEL_MIN,
    ADAPTIVE_LEVEL_MAX
  );
}

export function adaptiveChallengeProfile(candidate) {
  const state = sanitizeAdaptiveDifficultyState(candidate);
  const progress = completionsTowardNextLevel(state.completedChallenges);
  const requestedLevel = adaptiveChallengeLevel(state);
  return {
    baseLevel: state.level,
    requestedLevel,
    effectiveLevel: requestedLevel,
    majorChallenge: state.majorChallengePending,
    surge: state.majorChallengePending,
    surgePending: state.majorChallengePending,
    majorChallengeBonus: state.majorChallengePending ? requestedLevel - state.level : 0,
    completedChallenges: state.completedChallenges,
    completionsTowardNextLevel: progress,
    completionsUntilNextLevel: ADAPTIVE_COMPLETIONS_PER_LEVEL - progress
  };
}

function completedMessage({
  levelRaised,
  majorChallengeWasActive,
  majorChallengePending,
  progress
}) {
  if (majorChallengePending) {
    return levelRaised
      ? "Three wins raised your level. A one-game Surge challenge is next."
      : "Ten challenges complete — a one-game Surge challenge is next.";
  }
  if (majorChallengeWasActive) {
    return levelRaised
      ? "Surge cleared — your third win also raised the next level."
      : `Surge cleared — ${progress} of 3 wins toward the next level.`;
  }
  if (levelRaised) return "Three challenges complete — the next level is ready.";
  return `Challenge complete — ${progress} of 3 wins toward the next level.`;
}

export function adaptiveRewardMultiplier(level) {
  const safeLevel = clamp(
    wholeNumber(level, ADAPTIVE_LEVEL_START),
    ADAPTIVE_LEVEL_MIN,
    ADAPTIVE_LEVEL_MAX
  );
  return Number(clamp(0.75 + safeLevel * 0.05, 0.8, 1.25).toFixed(2));
}

/**
 * Records one finished challenge. Invalid word pairs and ordinary hints are
 * intentionally ignored; only a final run outcome may adjust difficulty.
 */
export function applyAdaptiveChallengeOutcome(candidate, event = {}) {
  const state = sanitizeAdaptiveDifficultyState(candidate);
  const policy = adaptiveModePolicy(event);
  const outcome = String(event?.outcome || "").trim().toLowerCase();
  if (!policy.eligible || IGNORED_OUTCOMES.has(outcome) || (!FAILURE_OUTCOMES.has(outcome) && outcome !== "completed")) {
    return {
      state,
      changed: false,
      adjustment: "none",
      outcome: "ignored",
      message: "",
      metadata: {
        policy,
        levelBefore: state.level,
        levelAfter: state.level,
        requestedLevelBefore: adaptiveChallengeLevel(state),
        requestedLevelAfter: adaptiveChallengeLevel(state),
        failureStreak: state.failureStreak,
        completedChallenges: state.completedChallenges,
        completionsTowardNextLevel: completionsTowardNextLevel(state.completedChallenges),
        flawless: event?.flawless === true,
        surgePerfected: false,
        promoted: false,
        promotedLevels: 0,
        majorChallengeWasActive: state.majorChallengePending,
        majorChallengePending: state.majorChallengePending
      }
    };
  }

  const levelBefore = state.level;
  const majorChallengeWasActive = state.majorChallengePending
    || event?.surge === true
    || event?.majorChallenge === true;
  const activeMajorBaseLevel = state.majorChallengePending
    ? state.majorChallengeBaseLevel
    : clamp(
        wholeNumber(event?.surgeBaseLevel ?? event?.baseLevel, state.level),
        ADAPTIVE_LEVEL_MIN,
        ADAPTIVE_LEVEL_MAX
      );
  const requestedLevelBefore = majorChallengeWasActive
    ? clamp(
        activeMajorBaseLevel + ADAPTIVE_MAJOR_CHALLENGE_BONUS,
        ADAPTIVE_LEVEL_MIN,
        ADAPTIVE_LEVEL_MAX
      )
    : adaptiveChallengeLevel(state);
  let level = majorChallengeWasActive
    ? activeMajorBaseLevel
    : state.level;
  let failureStreak = state.failureStreak;
  let completedChallenges = state.completedChallenges;
  let majorChallengePending = false;
  let majorChallengeBaseLevel = null;
  let recoveryLevel = null;
  let recoveryStrict = false;
  let adjustment = "progress";
  let levelRaised = false;
  let restoredAfterMajorFailure = false;
  const flawless = event?.flawless === true;
  let surgePerfected = false;
  let promoted = false;
  let promotedLevels = 0;
  let cadenceLevelRaiseSuppressed = false;
  let message = "";

  if (outcome === "completed") {
    completedChallenges = clamp(
      completedChallenges + 1,
      0,
      MAX_COMPLETED_CHALLENGES
    );
    failureStreak = 0;
    surgePerfected = majorChallengeWasActive && flawless;
    if (surgePerfected) {
      const masteredSurgeLevel = requestedLevelBefore;
      promotedLevels = Math.max(0, masteredSurgeLevel - level);
      promoted = promotedLevels > 0;
      level = masteredSurgeLevel;
      levelRaised = promoted;
      adjustment = promoted ? "harder" : "progress";
      cadenceLevelRaiseSuppressed =
        completedChallenges % ADAPTIVE_COMPLETIONS_PER_LEVEL === 0;
    } else if (completedChallenges % ADAPTIVE_COMPLETIONS_PER_LEVEL === 0) {
      const raisedLevel = clamp(level + 1, ADAPTIVE_LEVEL_MIN, ADAPTIVE_LEVEL_MAX);
      levelRaised = raisedLevel !== level;
      level = raisedLevel;
      adjustment = levelRaised ? "harder" : "progress";
    }
    if (completedChallenges % ADAPTIVE_MAJOR_CHALLENGE_INTERVAL === 0) {
      majorChallengePending = true;
      majorChallengeBaseLevel = level;
      adjustment = "major";
    }
    message = surgePerfected
      ? promoted
        ? `Flawless Surge — level ${level} is now your normal difficulty.`
        : `Flawless Surge — level ${level} stays your normal difficulty.`
      : completedMessage({
          levelRaised,
          majorChallengeWasActive,
          majorChallengePending,
          progress: completionsTowardNextLevel(completedChallenges)
        });
  } else {
    failureStreak = clamp(failureStreak + 1, 0, MAX_FAILURE_STREAK);
    adjustment = "easier";
    if (majorChallengeWasActive) {
      // A milestone is a bonus test, not a punishment. Missing it consumes the
      // surge and returns exactly to the snapshotted ordinary level.
      restoredAfterMajorFailure = true;
      recoveryLevel = activeMajorBaseLevel;
      message = "Surge ended — your normal challenge level is safe.";
    } else {
      recoveryLevel = clamp(
        wholeNumber(event?.challengeLevel, requestedLevelBefore),
        ADAPTIVE_LEVEL_MIN,
        ADAPTIVE_LEVEL_MAX
      );
      recoveryStrict = true;
      level = clamp(level - 1, ADAPTIVE_LEVEL_MIN, ADAPTIVE_LEVEL_MAX);
      message = level === levelBefore
        ? "The next challenge stays at the gentlest level."
        : "The next challenge will be one level gentler.";
    }
  }

  const nextState = {
    ...state,
    level,
    failureStreak,
    completedChallenges,
    majorChallengePending,
    majorChallengeBaseLevel,
    recoveryLevel,
    recoveryStrict
  };
  const requestedLevelAfter = adaptiveChallengeLevel(nextState);
  const changed = JSON.stringify(nextState) !== JSON.stringify(state);
  return {
    state: nextState,
    changed,
    adjustment,
    outcome,
    message,
    metadata: {
      policy,
      levelBefore,
      levelAfter: level,
      requestedLevelBefore,
      requestedLevelAfter,
      failureStreak,
      failureStep: adjustment === "easier" && !majorChallengeWasActive ? 1 : 0,
      // Kept as a compatibility alias for existing result rendering.
      easingStep: adjustment === "easier" && !majorChallengeWasActive ? 1 : 0,
      completedChallengesBefore: state.completedChallenges,
      completedChallengesAfter: completedChallenges,
      completedChallenges,
      completionsTowardNextLevel: completionsTowardNextLevel(completedChallenges),
      flawless,
      surgePerfected,
      promoted,
      promotedLevels,
      cadenceLevelRaiseSuppressed,
      levelRaised,
      majorChallengeWasActive,
      surgeWasActive: majorChallengeWasActive,
      majorChallengePending,
      surge: majorChallengePending,
      surgePending: majorChallengePending,
      majorChallengeBonus: majorChallengePending
        ? requestedLevelAfter - level
        : 0,
      restoredAfterMajorFailure
    }
  };
}

export function rememberAdaptiveTarget(candidate, target, { preserveRecovery = false } = {}) {
  const state = sanitizeAdaptiveDifficultyState(candidate);
  const clean = cleanTarget(target);
  const key = targetKey(clean);
  if (!key) return state;
  return {
    ...state,
    ...(!preserveRecovery ? { recoveryLevel: null, recoveryStrict: false } : {}),
    recentTargets: [
      ...state.recentTargets.filter((entry) => targetKey(entry) !== key),
      clean
    ].slice(-ADAPTIVE_RECENT_TARGET_LIMIT)
  };
}

function finiteNumber(...values) {
  for (const value of values) {
    if (value == null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function routeLength(candidate) {
  const explicit = finiteNumber(
    candidate?.routeLength,
    candidate?.routeSteps,
    candidate?.steps,
    candidate?.metadata?.routeLength,
    candidate?.difficulty?.routeLength
  );
  if (explicit != null) return Math.max(0, explicit);
  if (Array.isArray(candidate?.route)) return candidate.route.length;
  return null;
}

function pathCount(candidate) {
  const count = finiteNumber(
    candidate?.pathCount,
    candidate?.routeCount,
    candidate?.solutionCount,
    candidate?.finalRecipeCount,
    candidate?.metadata?.pathCount,
    candidate?.difficulty?.pathCount
  );
  if (count != null) return Math.max(0, wholeNumber(count));
  if (Array.isArray(candidate?.paths)) return candidate.paths.length;
  if (Array.isArray(candidate?.finalRecipes)) return candidate.finalRecipes.length;
  return 1;
}

function candidateTarget(candidate) {
  return cleanTarget(candidate?.target ?? candidate?.word ?? candidate?.game?.target);
}

function candidateIsReachable(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  if (candidate.reachable === false || candidate.routeValid === false || candidate.validation?.valid === false) return false;
  if (candidate.reachable === true || candidate.routeValid === true || candidate.validation?.valid === true) return true;
  return routeLength(candidate) != null;
}

/**
 * Maps authored difficulty metadata to the same 1–10 scale. Multiple paths
 * make a target slightly gentler without pretending that route length alone
 * captures all of its difficulty.
 */
export function estimateAdaptiveChallengeLevel(candidate) {
  const direct = finiteNumber(
    candidate?.difficultyLevel,
    candidate?.level,
    typeof candidate?.difficulty === "number" ? candidate.difficulty : null,
    candidate?.difficulty?.level,
    candidate?.metadata?.difficultyLevel
  );
  if (direct != null) {
    return clamp(wholeNumber(direct, ADAPTIVE_LEVEL_START), ADAPTIVE_LEVEL_MIN, ADAPTIVE_LEVEL_MAX);
  }
  const normalizedScore = finiteNumber(candidate?.difficultyScore, candidate?.difficulty?.score);
  if (normalizedScore != null && normalizedScore >= 0 && normalizedScore <= 1) {
    return clamp(Math.round(1 + normalizedScore * 9), ADAPTIVE_LEVEL_MIN, ADAPTIVE_LEVEL_MAX);
  }
  const steps = routeLength(candidate);
  if (steps == null) return ADAPTIVE_LEVEL_START;
  const flexibility = pathCount(candidate);
  const pathRelief = flexibility >= 5 ? 1 : flexibility >= 2 ? 0.5 : 0;
  return clamp(Math.round(Math.max(1, steps) - pathRelief), ADAPTIVE_LEVEL_MIN, ADAPTIVE_LEVEL_MAX);
}

function compareCandidates(a, b) {
  return a.distance - b.distance
    // One verified alternate path is a meaningful safety advantage; beyond
    // that threshold, use the seed to rotate equally suitable destinations
    // instead of always selecting the single target with the most recipes.
    || Number(b.paths > 1) - Number(a.paths > 1)
    || a.level - b.level
    || a.tieBreak - b.tieBreak
    || b.paths - a.paths
    || a.target.localeCompare(b.target, "en", { sensitivity: "base" })
    || a.index - b.index;
}

/**
 * Chooses only from caller-supplied, reachable games. It never invents a
 * target. Recent targets are skipped whenever at least one fresh candidate is
 * available; deterministic ordering makes server and static builds agree.
 */
export function selectAdaptiveChallenge({
  state: candidateState,
  candidates = [],
  context = {}
} = {}) {
  const state = sanitizeAdaptiveDifficultyState(candidateState);
  const profile = adaptiveChallengeProfile(state);
  const policy = adaptiveModePolicy(context);
  const selectionSeed = Number.isFinite(Number(context?.seed))
    ? Math.abs(Math.trunc(Number(context.seed)))
    : 0;
  const empty = {
    selected: null,
    state,
    message: "",
    metadata: {
      policy,
      baseLevel: profile.baseLevel,
      requestedLevel: profile.requestedLevel,
      effectiveLevel: profile.effectiveLevel,
      candidateLevel: null,
      majorChallenge: profile.majorChallenge,
      surge: profile.surge,
      surgePending: profile.surgePending,
      majorChallengeBonus: profile.majorChallengeBonus,
      avoidedRecent: false,
      reason: policy.eligible ? "no_reachable_candidates" : policy.reason
    }
  };
  if (!policy.eligible || !Array.isArray(candidates)) return empty;

  const recent = new Set(state.recentTargets.map(targetKey));
  const parsedAvoidTarget = parseAdaptiveAvoidTarget(context?.avoidTarget);
  const explicitAvoidKey = parsedAvoidTarget.valid
    ? targetKey(parsedAvoidTarget.target)
    : "";
  const inferredFailedKey = state.failureStreak > 0
    ? targetKey(state.recentTargets.at(-1))
    : "";
  const avoidedTargetKey = explicitAvoidKey || inferredFailedKey;
  const avoidedCandidate = avoidedTargetKey
    ? candidates
        .filter((candidate) => candidateIsReachable(candidate))
        .find((candidate) => targetKey(candidateTarget(candidate)) === avoidedTargetKey)
    : null;
  const recoveryLevel = state.recoveryLevel
    ?? (avoidedCandidate ? estimateAdaptiveChallengeLevel(avoidedCandidate) : profile.requestedLevel);
  const recoveryStrict = state.recoveryLevel != null ? state.recoveryStrict : true;
  const reachable = candidates
    .map((source, index) => {
      const target = candidateTarget(source);
      if (!target || !candidateIsReachable(source)) return null;
      if (avoidedTargetKey && targetKey(target) === avoidedTargetKey) return null;
      const level = estimateAdaptiveChallengeLevel(source);
      return {
        source,
        index,
        target,
        level,
        paths: pathCount(source),
        distance: Math.abs(level - profile.requestedLevel),
        recent: recent.has(targetKey(target)),
        tieBreak: stableHash(`${selectionSeed}:${targetKey(target)}`)
      };
    })
    .filter(Boolean);
  if (!reachable.length) {
    empty.metadata.reason = avoidedTargetKey
      ? "no_alternative_reachable_target"
      : "no_reachable_candidates";
    return empty;
  }

  const recovering = Boolean(avoidedTargetKey || state.failureStreak > 0);
  const strictlyEasier = recovering && recoveryStrict
    ? reachable.filter((candidate) => candidate.level < recoveryLevel)
    : [];
  const sameLevel = recovering && recoveryStrict && !strictlyEasier.length
    ? reachable.filter((candidate) => candidate.level === recoveryLevel)
    : [];
  const difficultyPool = strictlyEasier.length
    ? strictlyEasier
    : sameLevel.length
      ? sameLevel
      : reachable;
  const fresh = difficultyPool.filter((candidate) => !candidate.recent);
  const pool = fresh.length ? fresh : difficultyPool;
  pool.sort(compareCandidates);
  const chosen = pool[0];
  const nextState = rememberAdaptiveTarget(state, chosen.target);
  return {
    selected: chosen.source,
    state: nextState,
    message: profile.majorChallenge
      ? "Surge challenge — one much harder game with your normal level protected."
      : state.failureStreak
        ? "A gentler challenge is ready."
        : "Your next challenge is ready.",
    metadata: {
      policy,
      baseLevel: profile.baseLevel,
      requestedLevel: profile.requestedLevel,
      effectiveLevel: profile.effectiveLevel,
      candidateLevel: chosen.level,
      majorChallenge: profile.majorChallenge,
      surge: profile.surge,
      surgePending: profile.surgePending,
      majorChallengeBonus: profile.majorChallengeBonus,
      target: chosen.target,
      routeLength: routeLength(chosen.source),
      pathCount: chosen.paths,
      avoidedRecent: fresh.length > 0,
      avoidedTarget: Boolean(avoidedTargetKey),
      easedAfterFailure: recovering && strictlyEasier.length > 0,
      reason: recovering && strictlyEasier.length
        ? "gentler_recovery_target"
        : "nearest_reachable_personal_level"
    }
  };
}
