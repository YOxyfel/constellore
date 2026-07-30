import {
  buildLocalGame,
  canonicalLocalTarget,
  canonicalLocalWord,
  localAdaptiveCandidates,
  localGoldenEarlyCompletionLimit,
  localItemFor,
  localRemixRecipesFor,
  localRouteTo,
  localSuggestions,
  lookupLocalCombination
} from "./local-world.mjs?v=5.0.0-beta.1";
import {
  adaptiveChallengeProfile,
  adaptiveDifficultyTag,
  adaptiveModePolicy,
  adaptiveRewardMultiplier,
  adaptiveRunEntryPolicy,
  estimateAdaptiveChallengeLevel,
  parseAdaptiveAvoidTarget,
  rememberAdaptiveTarget,
  sanitizeAdaptiveDifficultyState,
  selectAdaptiveChallenge
} from "./adaptive-difficulty.mjs?v=5.0.0-beta.1";
import {
  createRemixProgressionState,
  getPromotionEligibility,
  getRemixRankPresentation,
  sanitizeRemixProgressionState,
  selectChallengeRemixes
} from "./remix-progression.mjs?v=5.0.0-beta.1";
import {
  sanitizeRemixReadinessState,
  selectAdaptiveRemixPlan
} from "./remix-readiness.mjs?v=5.0.0-beta.1";
import {
  CLASSIC_STARTERS,
  createChallengeStartProfile
} from "./shuffled-start.mjs?v=5.0.0-beta.1";
import {
  checkRouteRemixBeforeCombination,
  checkRouteRemixCompletion,
  createRouteRemixPlan,
  createRouteRemixProgress,
  detectRouteRemixCapabilities,
  markRouteRemixAnswerRevealed,
  recordRouteRemixCombination,
  routeRemixProgress
} from "./route-remixes.mjs?v=5.0.0-beta.1";
import { cosmicTwistOptions, cosmicTwistSeedFor, selectCosmicTwist } from "./cosmic-twists.mjs?v=5.0.0-beta.1";
import { QUICK_TIP_LIMIT, assistancePolicy, combineAssistance, rankSenseCandidates, selectRouteNavigationTip, selectWordGift } from "./engagement-features.mjs?v=5.0.0-beta.1";
import { annotateUniverseResult, selectUniverse, validateUniverseRoute } from "./universe-director.mjs?v=5.0.0-beta.1";
import { sanitizeRecipeRating } from "./recipe-feedback.mjs?v=5.0.0-beta.1";
import { PATH_GUARD_VERSION, createPathGuardEvidence, evaluatePathGuard, pathGuardEligibility } from "./path-guard.mjs?v=5.0.0-beta.1";

const runs = new Map();
const missionPreviews = new Map();
const PRIVATE_TIP_LEDGER_STORAGE_KEY = "constellore-local-route-signals-v1";
const privateTipLedgerSymbol = Symbol.for("constellore.local.route-signals.v1");
const privateTipLedger = globalThis[privateTipLedgerSymbol] instanceof Map
  ? globalThis[privateTipLedgerSymbol]
  : new Map();
globalThis[privateTipLedgerSymbol] = privateTipLedger;
const LOCAL_MISSION_PREVIEW_TTL_MS = 15 * 60_000;
const MAX_RESUME_DISCOVERIES = 1000;
const MAX_RESUME_HISTORY = 500;
const player = {
  id: "local-stargazer",
  callsign: "Local Stargazer",
  credits: 0,
  vault: [],
  founderPass: false,
  freeWishUsed: false,
  wishAvailable: true,
  dailyWishUsedDate: ""
};

function localId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fail(message, code = "local_beta_error", status = 422) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  throw error;
}

function parseBody(options) {
  if (!options?.body) return {};
  try { return JSON.parse(options.body); }
  catch { return fail("That local request could not be read.", "invalid_json", 400); }
}

function validatedLocalAvoidTarget(value) {
  const parsed = parseAdaptiveAvoidTarget(value);
  if (!parsed.valid) {
    fail(
      "The previous target must be 80 characters or fewer.",
      "invalid_avoid_target",
      400
    );
  }
  return parsed.target;
}

function publicPlayer() {
  return { ...player, vault: [] };
}

function cloneMissionGame(game) {
  return structuredClone(game);
}

function pruneMissionPreviews() {
  const now = Date.now();
  for (const [token, preview] of missionPreviews) {
    if (preview.expiresAt <= now) missionPreviews.delete(token);
  }
  while (missionPreviews.size >= 24) missionPreviews.delete(missionPreviews.keys().next().value);
}

function adaptiveChallengeMessage(profile) {
  if (profile.surge) {
    return "Surge challenge: one much harder game. If it is not completed, your normal level stays safe.";
  }
  const progress = profile.completionsTowardNextLevel;
  return progress
    ? `${progress} of 3 challenges complete toward the next difficulty level.`
    : "Complete 3 challenges to raise the difficulty.";
}

function localAdaptiveRemixSeed(game, completedChallenges) {
  return [
    "local-world",
    game.mode,
    Math.abs(Number(game.seed) || 0),
    game.target,
    Math.max(0, Math.trunc(Number(completedChallenges) || 0)),
    game.startStyle === "shuffled" ? game.startProfile?.profileId || "shuffled" : "classic"
  ].join("|");
}

function localRemixContext(game, suppliedRoute = null) {
  const route = Array.isArray(suppliedRoute) ? suppliedRoute : localRouteTo(game?.target);
  if (!game || !Array.isArray(route) || !route.length) return null;
  const recipes = localRemixRecipesFor(game.target);
  return {
    route,
    recipes,
    capabilities: detectRouteRemixCapabilities({
      route,
      recipes,
      target: game.target
    })
  };
}

function localChallengeContext(request, legacyCompletedChallenges = 0) {
  const saved = isRecord(request?.localChallengeContext)
    ? request.localChallengeContext
    : null;
  const progressionCandidate = saved?.progression ?? request?.routeProgression;
  const progression = isRecord(progressionCandidate)
    ? sanitizeRemixProgressionState(progressionCandidate)
    : createRemixProgressionState(legacyCompletedChallenges);
  const readinessProvided = saved?.readinessProvided === true
    || isRecord(request?.remixReadiness);
  const readiness = sanitizeRemixReadinessState(
    saved?.readiness ?? request?.remixReadiness
  );
  const eligibility = getPromotionEligibility(progression);
  const currentRank = getRemixRankPresentation(progression.rankId);
  const challengeRank = eligibility.active && eligibility.nextRank
    ? getRemixRankPresentation(eligibility.nextRank.id)
    : currentRank;
  const lastOutcome = String(
    saved?.lastOutcome
    ?? request?.lastRouteOutcome
    ?? readiness.recentOutcomes.at(-1)?.outcome
    ?? ""
  ).trim().toLowerCase();
  const promotion = {
    active: eligibility.active,
    currentRank: eligibility.rank,
    targetRank: eligibility.nextRank,
    attempt: eligibility.trial ? eligibility.trial.attempts + 1 : 0,
    attemptsCompleted: eligibility.trial?.attempts || 0,
    attemptsTotal: eligibility.trialLength,
    wins: eligibility.trial?.wins || 0,
    winsRequired: eligibility.winsRequired,
    flawlessWins: eligibility.trial?.flawlessWins || 0
  };
  return {
    version: 1,
    progression,
    readiness,
    readinessProvided,
    currentRank,
    challengeRank,
    promotion,
    lastOutcome
  };
}

function withLocalAdaptiveRemixes(game, completedChallenges, routeContext = null, suppliedRoute = null) {
  const context = localRemixContext(game, suppliedRoute);
  if (!context) return game;
  const remixSeed = localAdaptiveRemixSeed(game, completedChallenges);
  const adaptivePlan = routeContext?.readinessProvided
    ? selectAdaptiveRemixPlan({
        state: routeContext.readiness,
        rank: routeContext.challengeRank.id,
        seed: remixSeed,
        availableFamilies: context.capabilities.availableFamilies
      })
    : null;
  const selection = adaptivePlan
    ? {
        rank: adaptivePlan.rank,
        requestedCount: adaptivePlan.requestedCount,
        modifierIds: adaptivePlan.familyIds,
        introducesFamily: adaptivePlan.introducesFamily,
        reducedForAvailability: adaptivePlan.reducedForAvailability,
        reducedForCompatibility: adaptivePlan.reducedForCompatibility,
        reducedForOnboarding: adaptivePlan.reducedForOnboarding,
        intensity: adaptivePlan.intensity
      }
    : selectChallengeRemixes({
        completedChallenges,
        seed: remixSeed,
        availableFamilies: context.capabilities.availableFamilies,
        capabilities: context.capabilities.capability
      });
  const plan = createRouteRemixPlan({
    route: context.route,
    recipes: context.recipes,
    target: game.target,
    families: selection.modifierIds,
    seed: remixSeed
  });
  if (plan.runtime.activeFamilies.length < selection.modifierIds.length) return null;
  const masterCap = plan.runtime.constraints.master_route?.moveCap || null;
  const rules = plan.public.remixes.map((rule, index) => ({
    id: `${rule.family}:${index + 1}`,
    family: rule.family,
    title: rule.label,
    instruction: rule.instruction,
    detail: rule.detail
  }));
  return {
    ...game,
    moveLimit: masterCap
      ? Math.min(Number.isFinite(Number(game.moveLimit)) ? Number(game.moveLimit) : masterCap, masterCap)
      : game.moveLimit,
    remixes: {
      version: plan.version,
      selectionId: `rmx1_${stableHash(remixSeed).toString(36)}`,
      rank: selection.rank,
      masteryPoints: Math.max(
        0,
        Math.trunc(Number(routeContext?.progression?.masteryPoints) || 0)
      ),
      completedChallenges: Math.max(0, Math.trunc(Number(completedChallenges) || 0)),
      requestedCount: selection.requestedCount,
      activeCount: rules.length,
      introducesFamily: selection.introducesFamily || null,
      adaptiveIntensity: selection.intensity
        ? {
            activeCount: selection.intensity.activeCount,
            minimumCount: selection.intensity.minimumCount,
            maximumCount: selection.intensity.maximumCount,
            cleanWinsTowardNextStep: selection.intensity.cleanWinsTowardNextStep,
            cleanWinsNeededForNextStep: selection.intensity.cleanWinsNeededForNextStep
          }
        : null,
      reducedForAvailability: Boolean(selection.reducedForAvailability),
      reducedForCompatibility: Boolean(selection.reducedForCompatibility),
      reducedForOnboarding: Boolean(selection.reducedForOnboarding),
      summary: plan.public.summary,
      rules
    },
    promotion: routeContext?.promotion?.active
      ? {
          active: true,
          currentRank: routeContext.promotion.currentRank,
          targetRank: routeContext.promotion.targetRank,
          attempt: routeContext.promotion.attempt,
          attemptsCompleted: routeContext.promotion.attemptsCompleted,
          attemptsTotal: routeContext.promotion.attemptsTotal,
          wins: routeContext.promotion.wins,
          winsRequired: routeContext.promotion.winsRequired,
          flawlessWins: routeContext.promotion.flawlessWins,
          instruction: `Win ${routeContext.promotion.winsRequired} of ${routeContext.promotion.attemptsTotal} challenges to reach ${routeContext.promotion.targetRank?.name || "the next rank"}.`
        }
      : null
  };
}

function localRemixRuntimeForGame(game, route) {
  if (!game?.remixes || !Array.isArray(game.remixes.rules) || !Array.isArray(route)) return null;
  return createRouteRemixPlan({
    route,
    recipes: localRemixRecipesFor(game.target),
    target: game.target,
    families: game.remixes.rules.map((rule) => rule.family),
    seed: localAdaptiveRemixSeed(game, game.remixes.completedChallenges)
  }).runtime;
}

function adaptiveLocalGame(mode, seed, stage, request) {
  const policy = adaptiveModePolicy({
    mode,
    custom: Boolean(request?.custom),
    shared: Boolean(request?.shared),
    fixed: Boolean(request?.fixed)
  });
  if (!policy.eligible) return null;
  const adaptiveState = sanitizeAdaptiveDifficultyState({
    version: request.adaptiveVersion,
    level: request.adaptiveLevel,
    failureStreak: request.failureStreak,
    completedChallenges: request.adaptiveCompletedChallenges ?? request.completedChallenges,
    majorChallengePending: request.adaptiveMajorChallengePending ?? request.majorChallengePending,
    majorChallengeBaseLevel: request.adaptiveMajorChallengeBaseLevel ?? request.majorChallengeBaseLevel,
    recentTargets: request.recentTargets
  });
  const profile = adaptiveChallengeProfile(adaptiveState);
  const routeContext = localChallengeContext(request, profile.completedChallenges);
  const entryPolicy = adaptiveRunEntryPolicy({
    mode,
    custom: Boolean(request?.custom),
    shared: Boolean(request?.shared),
    fixed: Boolean(request?.fixed),
    adaptive: request?.adaptive === true,
    rank: routeContext.currentRank
  });
  if (!entryPolicy.personal) return null;
  const effectiveMode = entryPolicy.mode;
  const remixRank = routeContext.challengeRank;
  const allCandidates = localAdaptiveCandidates(effectiveMode).filter((candidate) => {
    const context = localRemixContext(candidate);
    if (!context) return false;
    const realizedUnlocked = remixRank.unlockedFamilies.filter(
      (family) => context.capabilities.availableFamilies.includes(family)
    );
    return realizedUnlocked.length >= remixRank.minimumRemixes;
  });
  const requestedTarget = canonicalLocalTarget(request.adaptiveTarget);
  const preferredCandidates = profile.completedChallenges < localGoldenEarlyCompletionLimit
    ? allCandidates
        .filter((candidate) => Number.isInteger(candidate.goldenOrder) && candidate.goldenOrder >= 0)
        .sort((left, right) => left.goldenOrder - right.goldenOrder)
    : allCandidates;
  const candidates = requestedTarget
    ? allCandidates
    : preferredCandidates.length
      ? preferredCandidates
      : allCandidates;
  const avoidTarget = validatedLocalAvoidTarget(request.avoidTarget);
  const avoidedKey = avoidTarget.toLocaleLowerCase("en-US");
  const selection = requestedTarget
    && requestedTarget.toLocaleLowerCase("en-US") !== avoidedKey
    ? {
        selected: candidates.find((candidate) => candidate.target.toLowerCase() === requestedTarget.toLowerCase()),
        metadata: {
          baseLevel: profile.baseLevel,
          requestedLevel: profile.effectiveLevel,
          effectiveLevel: profile.effectiveLevel,
          surge: profile.surge,
          surgePending: profile.surgePending,
          majorChallengeBonus: profile.majorChallengeBonus,
          reason: "personal_restart_target"
        }
      }
    : selectAdaptiveChallenge({
        state: adaptiveState,
        candidates,
        context: { mode: effectiveMode, seed, avoidTarget }
      });
  const selected = selection.selected;
  if (!selected) return null;
  const allocatedState = selection.state
    ? sanitizeAdaptiveDifficultyState(selection.state)
    : rememberAdaptiveTarget(adaptiveState, selected.target);
  const game = buildLocalGame(effectiveMode, seed, selected.target, stage);
  if (!game) return null;
  const challengeLevel = estimateAdaptiveChallengeLevel(selected);
  const rewardMultiplier = adaptiveRewardMultiplier(challengeLevel);
  return {
    ...game,
    reward: Math.max(1, Math.round(Number(game.reward || 0) * rewardMultiplier)),
    adaptive: true,
    adaptiveVersion: adaptiveState.version,
    adaptiveLevel: adaptiveState.level,
    adaptiveBaseLevel: profile.baseLevel,
    adaptiveEffectiveLevel: profile.effectiveLevel,
    adaptiveCompletedChallenges: profile.completedChallenges,
    adaptiveCompletionsTowardNextLevel: profile.completionsTowardNextLevel,
    adaptiveCompletionsUntilNextLevel: profile.completionsUntilNextLevel,
    adaptiveMajorChallengePending: adaptiveState.majorChallengePending,
    adaptiveMajorChallengeBaseLevel: adaptiveState.majorChallengeBaseLevel,
    adaptiveRecentTargets: allocatedState.recentTargets,
    adaptiveSurge: profile.surge,
    adaptiveSurgeBonus: profile.majorChallengeBonus,
    adaptiveSurgeBaseLevel: adaptiveState.majorChallengeBaseLevel,
    surge: profile.surge,
    surgeBaseLevel: profile.baseLevel,
    challengeLevel,
    difficultyTag: adaptiveDifficultyTag(challengeLevel),
    adaptiveRewardMultiplier: rewardMultiplier,
    adaptiveMessage: adaptiveChallengeMessage(profile),
    ranked: false,
    scoreEligible: true,
    rewardEligible: true,
    leaderboardEligible: false,
    localChallengeContext: routeContext
  };
}

function localStartSeed(game, routeContext) {
  return [
    "local-start-v1",
    game.mode,
    Math.abs(Number(game.seed) || 0),
    game.target,
    routeContext?.challengeRank?.id || "bronze",
    routeContext?.progression?.completedChallenges || 0,
    routeContext?.promotion?.attemptsCompleted || 0
  ].join("|");
}

function localStartProfileFor(game, route, request, routeContext, forcedStyle = "") {
  const requestedStyle = forcedStyle
    || request?.startStyle
    || "classic";
  const effectiveLevel = Math.max(
    1,
    Number(game.adaptiveEffectiveLevel || game.challengeLevel || 1)
  );
  return createChallengeStartProfile({
    target: game.target,
    canonicalRoute: route,
    recipeLookup(a, b) {
      const result = lookupLocalCombination(a, b);
      return result ? { a, b, ...result } : null;
    },
    itemLookup: localItemFor,
    seed: localStartSeed(game, routeContext),
    startStyle: requestedStyle,
    rank: routeContext?.challengeRank?.id || "bronze",
    challengeIndex: routeContext?.progression?.completedChallenges || 0,
    lastOutcome: routeContext?.lastOutcome || "",
    failureRecovery: ["failed", "forfeit", "reveal"].includes(routeContext?.lastOutcome),
    promotion: routeContext?.promotion?.active === true,
    promotionAttempt: routeContext?.promotion?.attemptsCompleted || 0,
    difficulty: {
      level: Math.max(1, Math.min(5, Math.ceil(effectiveLevel / 2)))
    }
  });
}

function localStarterItems(profile) {
  const baseWords = new Set(CLASSIC_STARTERS.map((word) => word.toLowerCase()));
  return profile.starterItems.map((item) => {
    const loaned = profile.style === "shuffled" && !baseWords.has(item.word.toLowerCase());
    return {
      ...item,
      premium: false,
      loaned,
      source: loaned ? "loaned-start" : "origin"
    };
  });
}

function publicLocalStartProfile(profile) {
  return {
    version: profile.version,
    profileId: profile.profileId,
    style: profile.style,
    requestedStyle: profile.requestedStyle,
    starterHash: profile.starterHash,
    canonicalRouteLength: profile.canonicalRouteLength,
    routeStartIndex: profile.routeStartIndex,
    routeLength: profile.routeLength,
    starterCount: profile.starters.length,
    productiveStarterCount: profile.productiveStarterCount,
    sidePathCount: profile.sidePathCount,
    hasValidOpening: profile.hasValidOpening,
    fallback: profile.fallback,
    fallbackReason: profile.fallbackReason,
    selection: {
      reason: profile.selection.reason,
      cadencePosition: profile.selection.cadencePosition,
      cadenceLength: profile.selection.cadenceLength,
      locked: profile.selection.locked,
      rank: profile.selection.rank
    },
    difficulty: structuredClone(profile.difficulty),
    starterItems: localStarterItems(profile)
  };
}

function gameWithLocalStart(game, profile) {
  const startProfile = publicLocalStartProfile(profile);
  return {
    ...game,
    startStyle: profile.style,
    startProfile,
    starters: [...profile.starters],
    starterItems: structuredClone(startProfile.starterItems),
    routeLength: profile.routeLength
  };
}

function directedLocalGame(mode, seed, target, stage, adaptiveRequest = null) {
  const request = adaptiveRequest || {};
  const fallbackContext = localChallengeContext(request);
  const fallbackPolicy = adaptiveRunEntryPolicy({
    mode,
    custom: Boolean(request?.custom),
    shared: Boolean(request?.shared),
    fixed: Boolean(request?.fixed),
    adaptive: request?.adaptive === true,
    rank: fallbackContext.currentRank
  });
  const game = adaptiveLocalGame(mode, seed, stage, request)
    || buildLocalGame(fallbackPolicy.mode, seed, target, stage);
  if (!game) return null;
  const route = localRouteTo(game.target);
  if (!Array.isArray(route) || !route.length) return null;
  const routeContext = game.localChallengeContext
    || localChallengeContext(request, game.adaptiveCompletedChallenges || 0);
  const shouldUseStartProfiles = game.adaptive === true
    || request.startStyle != null;
  if (!shouldUseStartProfiles) {
    return {
      ...game,
      routeLength: route.length,
      universe: selectUniverse(game.seed)
    };
  }

  const baseGame = {
    ...game,
    localChallengeContext: routeContext,
    universe: selectUniverse(game.seed)
  };
  let profile = localStartProfileFor(baseGame, route, request, routeContext);
  let prepared = gameWithLocalStart(baseGame, profile);
  let remixed = game.adaptive
    ? withLocalAdaptiveRemixes(
        prepared,
        routeContext.progression.completedChallenges,
        routeContext,
        profile.challengeRoute
      )
    : prepared;
  if (!remixed) return null;

  if (profile.style === "shuffled" && remixed.remixes?.introducesFamily) {
    const requestedStyle = profile.requestedStyle;
    profile = localStartProfileFor(baseGame, route, request, routeContext, "classic");
    profile.requestedStyle = requestedStyle;
    profile.fallback = true;
    profile.fallbackReason = "new_remix_family";
    profile.selection = {
      ...profile.selection,
      reason: "new_remix_family"
    };
    prepared = gameWithLocalStart(baseGame, profile);
    remixed = withLocalAdaptiveRemixes(
      prepared,
      routeContext.progression.completedChallenges,
      routeContext,
      profile.challengeRoute
    );
    if (!remixed) return null;
  }
  return remixed;
}

function canonicalRouteRecipes(route) {
  if (!Array.isArray(route)) return [];
  return route.map((step) => {
    const a = canonicalLocalWord(step?.a);
    const b = canonicalLocalWord(step?.b);
    const result = a && b ? lookupLocalCombination(a, b) : null;
    return result ? { a, b, ...result } : null;
  }).filter(Boolean);
}

function verifiedLocalRoute(game) {
  const canonicalRoute = game ? localRouteTo(game.target) : null;
  if (!Array.isArray(canonicalRoute)) return null;
  const routeStartIndex = game.startProfile == null
    ? 0
    : boundedInteger(game.startProfile.routeStartIndex, -1, canonicalRoute.length);
  if (
    routeStartIndex < 0
    || routeStartIndex >= canonicalRoute.length
    || game.startProfile?.canonicalRouteLength != null
      && Number(game.startProfile.canonicalRouteLength) !== canonicalRoute.length
  ) {
    return null;
  }
  const route = canonicalRoute.slice(routeStartIndex);
  if (
    game.startProfile?.routeLength != null
    && Number(game.startProfile.routeLength) !== route.length
  ) {
    return null;
  }
  const canonicalRecipes = canonicalRouteRecipes(route);
  const validation = validateUniverseRoute({
    starters: game.starters,
    target: game.target,
    route,
    recipes: canonicalRecipes
  });
  return validation.valid ? canonicalRecipes : null;
}

function requireRun(body) {
  const run = runs.get(body.runId);
  if (!run || run.token !== body.runToken) fail("This local orbit expired. Start it again.", "run_missing", 404);
  return run;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

const RUN_ENTRY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{15,79}$/;

function normalizeLocalRunEntryId(value) {
  if (value === undefined) return null;
  if (typeof value !== "string" || !RUN_ENTRY_ID_PATTERN.test(value)) {
    fail(
      "Run entry IDs must be 16 to 80 letters, numbers, or hyphens.",
      "invalid_run_entry_id",
      400
    );
  }
  return value;
}

function stableIdentityValue(value) {
  if (Array.isArray(value)) return value.map((item) => stableIdentityValue(item));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableIdentityValue(value[key])])
  );
}

function localRunEntryChallengeIdentity(game) {
  return JSON.stringify(stableIdentityValue(game));
}

function boundedInteger(value, fallback = 0, maximum = 10_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(0, Math.trunc(parsed)));
}

function restoredItem(value) {
  const requestedWord = typeof value === "string" ? value : value?.word;
  const canonicalWord = canonicalLocalWord(requestedWord);
  return canonicalWord ? localItemFor(canonicalWord) : null;
}

function restoredHistory(value) {
  if (!Array.isArray(value)) return [];
  const history = [];
  for (const entry of value.slice(0, MAX_RESUME_HISTORY)) {
    if (!isRecord(entry)) continue;
    const a = canonicalLocalWord(entry.a);
    const b = canonicalLocalWord(entry.b);
    const item = restoredItem(entry);
    if (!a || !b || !item) continue;
    const canonicalResult = lookupLocalCombination(a, b);
    const twisted = Boolean(entry.twisted || entry.source === "twist");
    if (!twisted && canonicalResult?.word.toLowerCase() !== item.word.toLowerCase()) continue;
    if (twisted && !cosmicTwistOptions(a, b).some((option) => option.word.toLowerCase() === item.word.toLowerCase())) continue;
    history.push({
      a,
      b,
      word: item.word,
      emoji: item.emoji,
      category: item.category,
      source: twisted ? "twist" : String(entry.source || canonicalResult.source || "local-catalog").slice(0, 32),
      ...(twisted ? { twisted: true, canonicalWord: canonicalResult?.word || "" } : {}),
      ...(entry.revealed ? { revealed: true } : {})
    });
  }
  return history;
}

function localRouteProgressFor(route, target, available) {
  const cleanRoute = Array.isArray(route) ? route : [];
  const total = cleanRoute.length;
  const known = new Set(
    (Array.isArray(available) ? available : [...(available || [])])
      .map((item) => String(item?.word || item || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const targetKey = String(target || "").trim().toLowerCase();
  if (!total || !targetKey) {
    return { total, remaining: 0, complete: false, percent: 0 };
  }
  if (known.has(targetKey)) {
    return { total, remaining: 0, complete: true, percent: 100 };
  }
  const needed = new Set([targetKey]);
  let remaining = 0;
  for (let index = cleanRoute.length - 1; index >= 0; index -= 1) {
    const step = cleanRoute[index];
    const result = String(step?.word || "").trim().toLowerCase();
    if (!needed.has(result)) continue;
    needed.delete(result);
    if (known.has(result)) continue;
    remaining += 1;
    needed.add(String(step.a || "").trim().toLowerCase());
    needed.add(String(step.b || "").trim().toLowerCase());
  }
  return {
    total,
    remaining,
    complete: false,
    percent: total
      ? Math.max(0, Math.min(99, Math.round(((total - remaining) / total) * 100)))
      : 0
  };
}

function localRouteProgressForRun(run) {
  const progress = localRouteProgressFor(
    run.solutionRoute,
    run.game.target,
    run.available
  );
  if (!run.remixRuntime || run.completed) return progress;
  if (!progress.complete) return progress;
  return {
    ...progress,
    remaining: Math.max(1, Number(progress.remaining) || 0),
    complete: false,
    percent: Math.min(99, Number(progress.percent) || 0)
  };
}

function localPathGuardContext(run) {
  const game = run?.game || {};
  const mode = String(game.mode || "").trim().toLowerCase();
  const scoreEligible = Boolean(!run?.scoringDisabled && game.scoreEligible !== false);
  return {
    rankId: game.remixes?.rank?.id || "",
    mode,
    target: game.target || "",
    assist: run?.assist || "",
    scoringDisabled: !scoreEligible,
    scoreEligible,
    finished: Boolean(run?.completed),
    ranked: false,
    practiceReplay: game.practiceReplay === true,
    remixes: game.remixes || null,
    promotion: game.promotion || null,
    tutorial: ["training", "second-orbit"].includes(mode),
    multiplayer: mode === "scramble",
    competitive: ["daily", "weekly", "challenge", "scramble"].includes(mode)
  };
}

function localPathGuardEnabled(run) {
  const game = run?.game;
  if (
    !run
    || !game
    || game.adaptive !== true
    || game.practiceReplay === true
    || String(game.mode || "").trim().toLowerCase() !== "reach"
    || Math.max(
      Array.isArray(game.remixes?.rules) ? game.remixes.rules.length : 0,
      Math.trunc(Number(game.remixes?.activeCount) || 0)
    ) > 0
  ) return false;
  return pathGuardEligibility(localPathGuardContext(run)).active;
}

function localPathGuardDecision(run, { a, b, result } = {}) {
  const context = localPathGuardContext(run);
  if (!localPathGuardEnabled(run) || !result?.word) {
    return evaluatePathGuard(context, { a, b }, {});
  }
  if (!Array.isArray(run.solutionRoute) || !run.solutionRoute.length) {
    return evaluatePathGuard(context, { a, b }, {});
  }
  const resultKey = String(result.word).trim().toLocaleLowerCase("en-US");
  const followsGuidedRoute = Boolean(
    resultKey
    && !run.available.has(resultKey)
    && run.solutionRoute.some(
      (step) => String(step?.word || "").trim().toLocaleLowerCase("en-US") === resultKey
    )
  );
  const pairEvidence = [{ a, b }];
  return evaluatePathGuard(
    context,
    { a, b },
    createPathGuardEvidence({
      authoritative: true,
      target: run.game.target,
      ...(followsGuidedRoute
        ? { expectedPairs: pairEvidence }
        : { deadEndPairs: pairEvidence })
    })
  );
}

function localWrongPathError(run) {
  const error = new Error("WRONG PATH · That pairing does not follow this guided route. Your words stay ready and no move is used.");
  error.code = "wrong_path";
  error.status = 409;
  error.payload = {
    error: error.message,
    code: error.code,
    rejected: true,
    consumed: false,
    nonConsuming: true,
    pathGuard: {
      version: PATH_GUARD_VERSION,
      rankId: String(run?.game?.remixes?.rank?.id || "")
    }
  };
  return error;
}

function publicRun(run) {
  const scoreEligible = !run.scoringDisabled && run.game?.scoreEligible !== false;
  const scoreMultiplier = scoreEligible ? assistancePolicy(run.assist).scoreMultiplier : 0;
  const activationPending = Boolean(run.activatedAt == null);
  const startedAt = run.activatedAt || run.startedAt;
  return {
    id: run.id,
    token: run.token,
    ranked: false,
    localOnly: true,
    startedAt,
    deadlineAt: activationPending ? null : run.deadlineAt,
    activationPending,
    assist: run.assist,
    scoringDisabled: Boolean(run.scoringDisabled),
    scoreEligible,
    scoreMultiplier,
    rewardEligible: scoreEligible && run.game?.rewardEligible !== false,
    leaderboardEligible: false,
    routeProgress: localRouteProgressForRun(run),
    remixProgress: run.remixRuntime
      ? routeRemixProgress(run.remixRuntime, run.remixProgress)
      : null
  };
}

function activateLocalRun(run) {
  if (!run || run.activatedAt != null) return run;
  if (run.completed || run.moves || run.history.length) {
    fail("This orbit can no longer be activated.", "run_activation_invalid", 409);
  }
  const activatedAt = new Date();
  run.activatedAt = activatedAt.toISOString();
  run.deadlineAt = run.game.timeLimit
    ? new Date(activatedAt.getTime() + run.game.timeLimit * 1000).toISOString()
    : null;
  return run;
}

function publicDiscoveredItem(run, word) {
  const key = String(word || "").toLowerCase();
  if (run.giftItem?.word.toLowerCase() === key) return { ...run.giftItem };
  const starter = (run.game.starterItems || []).find(
    (item) => String(item?.word || "").toLowerCase() === key
  );
  if (starter?.loaned === true) {
    return {
      ...starter,
      source: "loaned-start",
      loaned: true,
      premium: false
    };
  }
  return localItemFor(word);
}

function publicProgress(run) {
  return {
    moves: run.moves,
    completed: Boolean(run.completed),
    submitted: Boolean(run.submitted),
    discovered: [...run.available].map((word) => publicDiscoveredItem(run, word)).filter(Boolean),
    history: structuredClone(run.history),
    usedBend: Boolean(run.wished),
    usedWish: Boolean(run.wished),
    wished: Boolean(run.wished),
    bendItem: run.bendItem ? { ...run.bendItem } : null,
    giftUsed: Boolean(run.giftUsed),
    giftItem: run.giftItem ? { ...run.giftItem } : null,
    tipsUsed: Math.min(QUICK_TIP_LIMIT, Array.isArray(run.tipRecords) ? run.tipRecords.length : 0),
    assist: run.assist,
    scoringDisabled: Boolean(run.scoringDisabled),
    scoreMultiplier: run.scoringDisabled ? 0 : assistancePolicy(run.assist).scoreMultiplier,
    remixProgress: run.remixRuntime
      ? routeRemixProgress(run.remixRuntime, run.remixProgress)
      : null
  };
}

function resumeResponse(run) {
  return {
    player: publicPlayer(),
    game: structuredClone(run.game),
    run: publicRun(run),
    progress: publicProgress(run)
  };
}

function cleanPrivateTipRecord(value) {
  const id = String(value?.id || "").trim().toLowerCase().slice(0, 80);
  const text = String(value?.text || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(id) && text ? { id, text } : null;
}

function privateTipLedgerId(run) {
  return `${String(run?.id || "").slice(0, 120)}\u001f${String(run?.token || "").slice(0, 180)}`;
}

function readPrivateTipStorage() {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(PRIVATE_TIP_LEDGER_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cleanPrivateTipEntry(value) {
  const id = String(value?.id || "").trim().slice(0, 120);
  const token = String(value?.token || "").trim().slice(0, 180);
  if (!id || !token) return null;
  const records = (Array.isArray(value?.records) ? value.records : []).slice(0, QUICK_TIP_LIMIT).map(cleanPrivateTipRecord).filter(Boolean);
  const updatedAt = Number.isFinite(Number(value?.updatedAt)) ? Math.max(0, Math.trunc(Number(value.updatedAt))) : 0;
  return { id, token, records, updatedAt };
}

function privateTipRecordsFor(run) {
  const ledgerId = privateTipLedgerId(run);
  const cached = privateTipLedger.get(ledgerId);
  if (Array.isArray(cached)) return cached.map((record) => ({ ...record }));
  const stored = readPrivateTipStorage().map(cleanPrivateTipEntry).filter(Boolean).find((entry) => entry.id === run.id && entry.token === run.token);
  const records = stored?.records || [];
  if (records.length) privateTipLedger.set(ledgerId, records);
  return records.map((record) => ({ ...record }));
}

function persistPrivateTipRecords(run) {
  const records = (Array.isArray(run?.tipRecords) ? run.tipRecords : []).map(cleanPrivateTipRecord).filter(Boolean).slice(0, QUICK_TIP_LIMIT);
  const ledgerId = privateTipLedgerId(run);
  privateTipLedger.delete(ledgerId);
  privateTipLedger.set(ledgerId, records);
  while (privateTipLedger.size > 24) privateTipLedger.delete(privateTipLedger.keys().next().value);
  try {
    const entries = readPrivateTipStorage().map(cleanPrivateTipEntry).filter(Boolean)
      .filter((entry) => entry?.id !== run.id || entry?.token !== run.token)
      .slice(0, 23);
    entries.unshift({ id: run.id, token: run.token, records, updatedAt: Date.now() });
    globalThis.localStorage?.setItem(PRIVATE_TIP_LEDGER_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Local practice still works in storage-restricted browsers for this tab.
  }
}

function localTipResponse(record, used, available = Boolean(record)) {
  const count = Math.min(QUICK_TIP_LIMIT, Math.max(0, Number(used) || 0));
  return {
    available: Boolean(available),
    text: String(record?.text || "All three Route Signals have been used for this orbit.").slice(0, 240),
    used: count,
    remaining: Math.max(0, QUICK_TIP_LIMIT - count),
    scoreSafe: true
  };
}

function useLocalTip(run, tipIndex) {
  if (!Number.isInteger(tipIndex) || tipIndex < 0 || tipIndex > QUICK_TIP_LIMIT) {
    fail("Route Signal requires a valid current signal index.", "invalid_tip_index", 400);
  }
  run.tipRecords ||= [];
  if (tipIndex < run.tipRecords.length) return localTipResponse(run.tipRecords[tipIndex], run.tipRecords.length);
  if (tipIndex > run.tipRecords.length) fail("Route Signal state changed. Refresh this orbit and try again.", "tip_state_mismatch", 409);
  if (run.tipRecords.length >= QUICK_TIP_LIMIT) return localTipResponse(null, run.tipRecords.length, false);
  if (run.submitted) fail("This local orbit was already submitted.", "already_submitted", 409);
  if (run.completed) fail("This local orbit is already complete.", "run_complete", 409);

  const words = [...run.available].map((word) => localItemFor(word)).filter(Boolean);
  const selected = selectRouteNavigationTip({
    words,
    target: run.game.target,
    history: run.history,
    route: run.solutionRoute,
    seed: run.game.seed,
    mode: run.game.mode,
    used: run.tipRecords.length,
    seen: run.tipRecords.map((record) => record.id),
    boardWords: 1
  });
  const text = String(selected?.text || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
  let id = String(selected?.id || "").trim().toLowerCase().slice(0, 80);
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) || run.tipRecords.some((record) => record.id === id)) id = `tip-${run.tipRecords.length + 1}`;
  if (selected?.available === false || !text) return localTipResponse({ text: text || "No spoiler-safe direction is available yet." }, run.tipRecords.length, false);
  const record = { id, text };
  run.tipRecords.push(record);
  persistPrivateTipRecords(run);
  return localTipResponse(record, run.tipRecords.length);
}

function restoreRun(body) {
  const runId = String(body.runId || "").trim();
  const runToken = String(body.runToken || "").trim();
  if (!runId || !runToken || runId.length > 256 || runToken.length > 256) {
    fail("This local orbit could not be restored.", "run_missing", 404);
  }

  const existing = runs.get(runId);
  if (existing) {
    if (existing.token !== runToken) fail("This local orbit could not be restored.", "run_missing", 404);
    return existing;
  }

  const snapshot = body.snapshot;
  const snapshotRun = snapshot?.run;
  const snapshotGame = snapshot?.game;
  const progress = snapshot?.progress;
  if (!isRecord(snapshot) || !isRecord(snapshotRun) || !isRecord(snapshotGame) || !isRecord(progress)) {
    fail("This local orbit expired. Start it again.", "run_missing", 404);
  }

  const snapshotRunId = String(snapshotRun.id || snapshotRun.runId || "").trim();
  const snapshotRunToken = String(snapshotRun.token || snapshotRun.runToken || "").trim();
  if (snapshotRunId !== runId || snapshotRunToken !== runToken) {
    fail("That saved orbit does not match this local run.", "resume_mismatch", 409);
  }

  const mode = String(snapshotGame.mode || "").trim().toLowerCase();
  if (!["reach", "quick", "moves", "daily", "weekly", "challenge"].includes(mode)) {
    fail("That saved local mode is not available.", "resume_invalid", 422);
  }
  const target = canonicalLocalTarget(snapshotGame.target);
  if (!target) fail("That saved destination is not mapped in local practice.", "resume_invalid", 422);
  const restoreRequest = {
    ...(snapshotGame.adaptive === true ? {
      adaptive: true,
      adaptiveVersion: snapshotGame.adaptiveVersion,
      adaptiveLevel: snapshotGame.adaptiveLevel,
      adaptiveCompletedChallenges: snapshotGame.adaptiveCompletedChallenges,
      adaptiveMajorChallengePending: snapshotGame.adaptiveMajorChallengePending ?? snapshotGame.adaptiveSurge,
      adaptiveMajorChallengeBaseLevel: snapshotGame.adaptiveMajorChallengeBaseLevel ?? snapshotGame.adaptiveSurgeBaseLevel,
      recentTargets: snapshotGame.adaptiveRecentTargets,
      adaptiveTarget: target
    } : {}),
    ...(snapshotGame.startProfile ? {
      startStyle: snapshotGame.startProfile.requestedStyle || snapshotGame.startStyle,
      localChallengeContext: snapshotGame.localChallengeContext
    } : {})
  };
  const game = directedLocalGame(
    mode,
    snapshotGame.seed,
    target,
    snapshotGame.stage,
    Object.keys(restoreRequest).length ? restoreRequest : null
  );
  if (!game || game.target.toLowerCase() !== target.toLowerCase()) {
    fail("The local universe could not reconstruct that orbit.", "resume_invalid", 422);
  }
  if (snapshotGame.startProfile) {
    const sameStarters = JSON.stringify(game.starters) === JSON.stringify(snapshotGame.starters);
    const sameProfile = game.startProfile?.profileId === snapshotGame.startProfile.profileId
      && game.startProfile?.starterHash === snapshotGame.startProfile.starterHash
      && game.startProfile?.style === snapshotGame.startProfile.style;
    const sameRemixes = String(game.remixes?.selectionId || "") === String(snapshotGame.remixes?.selectionId || "")
      && JSON.stringify(game.remixes?.rules || []) === JSON.stringify(snapshotGame.remixes?.rules || []);
    if (!sameStarters || !sameProfile || !sameRemixes) {
      fail("That saved orbit's starting constellation changed.", "resume_invalid", 422);
    }
  }
  const solutionRoute = verifiedLocalRoute(game);
  if (!solutionRoute) fail("That saved orbit no longer has a verified local route.", "resume_invalid", 422);
  const remixRuntime = localRemixRuntimeForGame(game, solutionRoute);

  const startedValue = Date.parse(snapshotRun.startedAt);
  const startedAtMs = Number.isFinite(startedValue) && startedValue <= Date.now() + 60_000 ? startedValue : Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const available = new Set(game.starters.map((word) => word.toLowerCase()));
  if (Array.isArray(progress.discovered)) {
    for (const value of progress.discovered.slice(0, MAX_RESUME_DISCOVERIES)) {
      const item = restoredItem(value);
      if (item) available.add(item.word.toLowerCase());
    }
  }

  const bendItem = restoredItem(progress.bendItem);
  const wished = Boolean(progress.usedBend || progress.usedWish || progress.wished);
  if (bendItem) available.add(bendItem.word.toLowerCase());
  const history = restoredHistory(progress.history);
  let remixProgress = remixRuntime ? createRouteRemixProgress() : null;
  if (remixRuntime) {
    for (const entry of history) {
      // Reveal steps are a zero-score demonstration, not proof that the
      // player satisfied competitive route rules. Replaying them through the
      // no-repeat and move-cap gates can also reject an otherwise valid Study
      // snapshot when its canonical answer overlaps earlier play.
      if (entry.revealed || String(entry.source || "").toLowerCase() === "reveal") continue;
      const recorded = recordRouteRemixCombination(remixRuntime, remixProgress, {
        a: entry.a,
        b: entry.b,
        word: entry.word,
        successful: true
      });
      if (!recorded.accepted) {
        fail("That saved orbit breaks its route rules.", "resume_invalid", 422);
      }
      remixProgress = recorded.progress;
    }
  }
  for (const entry of history) available.add(entry.word.toLowerCase());
  const assistValue = String(progress.assist || snapshotRun.assist || "none").toLowerCase();
  if (remixRuntime && assistValue === "reveal" && progress.completed) {
    remixProgress = markRouteRemixAnswerRevealed(remixProgress);
  }
  const rawGiftItem = isRecord(progress.giftItem)
    ? progress.giftItem
    : Array.isArray(progress.discovered)
      ? progress.discovered.find((item) => isRecord(item) && String(item.source || "").toLowerCase() === "gift")
      : null;
  const restoredGift = restoredItem(rawGiftItem);
  const routeBridgeWords = new Set(solutionRoute.slice(0, -1).map((step) => String(step.word || "").toLowerCase()));
  const giftItem = restoredGift && routeBridgeWords.has(restoredGift.word.toLowerCase())
    ? { ...restoredGift, source: "gift", note: "A crucial bridge gifted by the cosmos.", feedbackEligible: false }
    : null;
  const giftClaimed = Boolean(progress.giftUsed || giftItem || assistValue === "gift");
  if (giftItem) available.add(giftItem.word.toLowerCase());
  let assist = ["none", "wish", "reveal", "sense", "gift"].includes(assistValue)
    ? giftClaimed && assistValue === "none" ? "gift" : assistValue
    : giftClaimed ? "gift" : wished ? "wish" : "none";
  if (giftClaimed) assist = combineAssistance(assist, "gift").id;
  const moveMaximum = game.moveLimit ? Math.max(game.moveLimit, history.length) : 10_000;
  const moves = Math.max(history.length, boundedInteger(progress.moves, history.length, moveMaximum));
  const tipsUsed = boundedInteger(progress.tipsUsed, 0, QUICK_TIP_LIMIT);
  const targetFound = available.has(game.target.toLowerCase());
  const remixCompletion = remixRuntime
    ? checkRouteRemixCompletion(remixRuntime, remixProgress, game.target)
    : { complete: true };
  const completed = Boolean(
    progress.completed
    && targetFound
    && (assistValue === "reveal" || remixCompletion.complete)
  );
  const activationPending = Boolean(
    snapshotRun.activationPending
    && moves === 0
    && !completed
  );
  const twistEntry = history.find((entry) => entry.twisted);
  const restoredPrivateTips = privateTipRecordsFor({ id: runId, token: runToken }).slice(0, tipsUsed);
  const tipRecords = Array.from({ length: tipsUsed }, (_, index) => restoredPrivateTips[index] || ({
    id: `restored-${index + 1}`,
    text: "A previous Route Signal was already used in this orbit."
  }));
  const run = {
    id: runId,
    token: runToken,
    ranked: false,
    localOnly: true,
    game,
    startedAt,
    activatedAt: activationPending ? null : startedAt,
    deadlineAt: game.timeLimit && !activationPending ? new Date(startedAtMs + game.timeLimit * 1000).toISOString() : null,
    available,
    history,
    moves,
    completed,
    submitted: Boolean(progress.submitted && completed),
    wished,
    bendItem,
    assist: assist === "none" && wished ? "wish" : assist,
    // Older local snapshots treated Compass and Gift as Study. Migrate them
    // into reduced-score Open assistance; only an automatic Reveal stays 0.
    scoringDisabled: Boolean(assist === "reveal" || (progress.scoringDisabled && !["sense", "gift"].includes(assist))),
    giftUsed: Boolean(giftItem && giftClaimed),
    giftItem,
    tipRecords,
    twistUsed: Boolean(twistEntry),
    twistedPairKey: twistEntry ? [twistEntry.a, twistEntry.b].map((word) => word.toLowerCase()).sort().join("+") : null,
    remixRuntime,
    remixProgress,
    solutionRoute,
    feedbackMoves: new Set(),
    revealRoute: null
  };
  runs.set(run.id, run);
  return run;
}

function revealedRun(run) {
  return {
    route: structuredClone(run.revealRoute),
    target: run.game.target,
    assisted: true,
    assist: "reveal",
    completed: true,
    scoringDisabled: true,
    scoreEligible: false,
    rewardEligible: false,
    leaderboardEligible: false,
    score: 0,
    ranked: false,
    routeProgress: localRouteProgressFor(
      run.solutionRoute,
      run.game.target,
      run.available
    ),
    localOnly: true
  };
}

export async function localRequest(url, options = {}) {
  const requestUrl = new URL(url, "https://local.constellore.invalid");
  const path = requestUrl.pathname;
  const method = String(options.method || "GET").toUpperCase();
  const body = parseBody(options);

  if (method === "GET" && path === "/api/config") return {
    billingEnabled: false,
    checkoutUrl: "",
    testStoreEnabled: false,
    creditPacks: [],
    rewardedAdsEnabled: false,
    founderPrice: "Not sold in local practice",
    aiEnabled: false,
    localOnly: true
  };
  if (method === "POST" && path === "/api/player/register") return { player: publicPlayer(), playerToken: "local-practice" };
  if (method === "GET" && path === "/api/player") return { player: publicPlayer() };
  if (method === "POST" && path === "/api/analytics") return { ok: true, localOnly: true };

  if (method === "GET" && path === "/api/game") {
    const game = directedLocalGame(requestUrl.searchParams.get("mode") || "challenge", requestUrl.searchParams.get("seed") || 0);
    return game;
  }

  if (method === "POST" && path === "/api/custom-target") {
    const target = canonicalLocalTarget(body.target);
    if (!target) {
      const error = new Error("That destination is not mapped in local practice yet. Try one of the suggested targets.");
      error.code = "local_target_unknown";
      error.status = 422;
      error.payload = { suggestions: localSuggestions() };
      throw error;
    }
    return directedLocalGame("reach", 0, target);
  }

  if (method === "POST" && path === "/api/run/preview") {
    body.avoidTarget = validatedLocalAvoidTarget(body.avoidTarget);
    const target = body.target ? canonicalLocalTarget(body.target) : "";
    if (body.target && !target) fail("That target is not mapped in local practice yet.", "local_target_unknown");
    const game = directedLocalGame(body.mode, body.seed, target, body.stage, body);
    if (!game) fail("The local universe could not map that orbit.");
    if (!verifiedLocalRoute(game)) fail("The local universe could not verify a route to that target.", "local_route_invalid", 409);
    const missionGame = {
      ...game,
      ranked: false,
      scoreEligible: true,
      rewardEligible: true,
      leaderboardEligible: false
    };
    pruneMissionPreviews();
    const previewToken = localId("mission-preview");
    missionPreviews.set(previewToken, {
      game: cloneMissionGame(missionGame),
      expiresAt: Date.now() + LOCAL_MISSION_PREVIEW_TTL_MS
    });
    return {
      player: publicPlayer(),
      game: missionGame,
      previewToken
    };
  }

  if (method === "POST" && path === "/api/run/start") {
    const entryId = Object.hasOwn(body, "entryId")
      ? normalizeLocalRunEntryId(body.entryId)
      : undefined;
    let game;
    if (body.previewToken) {
      pruneMissionPreviews();
      const preview = missionPreviews.get(body.previewToken);
      if (!preview) fail("This mission briefing expired or changed. Review the refreshed mission before starting.", "mission_stale", 409);
      game = cloneMissionGame(preview.game);
    } else {
      body.avoidTarget = validatedLocalAvoidTarget(body.avoidTarget);
      const target = body.target ? canonicalLocalTarget(body.target) : "";
      if (body.target && !target) fail("That target is not mapped in local practice yet.", "local_target_unknown");
      game = directedLocalGame(body.mode, body.seed, target, body.stage, body);
    }
    if (!game) fail("The local universe could not map that orbit.");
    const solutionRoute = verifiedLocalRoute(game);
    if (!solutionRoute) fail("The local universe could not verify a route to that target.", "local_route_invalid", 409);
    const remixRuntime = localRemixRuntimeForGame(game, solutionRoute);
    const entryChallengeIdentity = entryId
      ? localRunEntryChallengeIdentity(game)
      : null;
    if (entryId) {
      const existingEntry = [...runs.values()].find((candidate) => candidate.entryId === entryId);
      if (existingEntry) {
        if (existingEntry.entryChallengeIdentity !== entryChallengeIdentity) {
          fail(
            "That run entry ID already belongs to a different challenge.",
            "run_entry_conflict",
            409
          );
        }
        return {
          player: publicPlayer(),
          game: existingEntry.game,
          run: publicRun(existingEntry)
        };
      }
    }
    const startedAt = new Date();
    const deferActivation = body.deferActivation === true;
    const run = {
      id: localId("run"),
      token: localId("token"),
      ranked: false,
      localOnly: true,
      entryId,
      entryChallengeIdentity,
      game,
      startedAt: startedAt.toISOString(),
      activatedAt: deferActivation ? null : startedAt.toISOString(),
      deadlineAt: game.timeLimit && !deferActivation ? new Date(startedAt.getTime() + game.timeLimit * 1000).toISOString() : null,
      available: new Set(game.starters.map((word) => word.toLowerCase())),
      history: [],
      moves: 0,
      completed: false,
      submitted: false,
      wished: false,
      bendItem: null,
      assist: "none",
      scoringDisabled: false,
      giftUsed: false,
      giftItem: null,
      tipRecords: [],
      twistUsed: false,
      twistedPairKey: null,
      remixRuntime,
      remixProgress: remixRuntime ? createRouteRemixProgress() : null,
      solutionRoute,
      feedbackMoves: new Set(),
      revealRoute: null
    };
    runs.set(run.id, run);
    return {
      player: publicPlayer(),
      game,
      run: publicRun(run)
    };
  }

  if (method === "POST" && path === "/api/run/activate") {
    if (!hasExactKeys(body, ["runId", "runToken"])) {
      fail("Run activation requires only runId and runToken.", "invalid_activation_request", 400);
    }
    const run = requireRun(body);
    activateLocalRun(run);
    return {
      player: publicPlayer(),
      run: publicRun(run)
    };
  }

  if (method === "POST" && path === "/api/run/replay") {
    if (!isRecord(body)
      || !["runId", "runToken"].every((key) => Object.hasOwn(body, key))
      || Object.keys(body).some((key) => !["runId", "runToken", "deferActivation"].includes(key))) {
      fail("Restart requires a run ID, token, and optional deferred start.", "invalid_replay_request", 400);
    }
    const source = requireRun(body);
    if (!source.completed) {
      source.completed = true;
      source.scoringDisabled = true;
      source.assist = "reveal";
      source.forfeited = true;
      source.forfeitReason = "forfeit";
      source.forfeitedAt = Date.now();
    }
    const sourceAdaptive = Boolean(source.game?.adaptive || source.game?.replayOf?.adaptive);
    const game = {
      ...structuredClone(source.game),
      adaptive: false,
      ranked: false,
      scoringDisabled: false,
      scoreEligible: false,
      rewardEligible: false,
      leaderboardEligible: false,
      practiceReplay: true,
      replayOf: {
        runId: source.id,
        adaptive: sourceAdaptive,
        challengeId: String(source.game?.challengeId || "").slice(0, 160)
      }
    };
    const solutionRoute = verifiedLocalRoute(game);
    if (!solutionRoute) fail("That exact challenge can no longer be verified.", "replay_unavailable", 422);
    const remixRuntime = localRemixRuntimeForGame(game, solutionRoute);
    const startedAt = new Date();
    const deferActivation = body.deferActivation === true;
    const run = {
      id: localId("run"),
      token: localId("token"),
      ranked: false,
      localOnly: true,
      game,
      startedAt: startedAt.toISOString(),
      activatedAt: deferActivation ? null : startedAt.toISOString(),
      deadlineAt: game.timeLimit && !deferActivation ? new Date(startedAt.getTime() + game.timeLimit * 1000).toISOString() : null,
      available: new Set(game.starters.map((word) => word.toLowerCase())),
      history: [],
      moves: 0,
      completed: false,
      submitted: false,
      wished: false,
      bendItem: null,
      assist: "none",
      scoringDisabled: false,
      giftUsed: false,
      giftItem: null,
      tipRecords: [],
      twistUsed: false,
      twistedPairKey: null,
      remixRuntime,
      remixProgress: remixRuntime ? createRouteRemixProgress() : null,
      solutionRoute,
      feedbackMoves: new Set(),
      revealRoute: null
    };
    runs.set(run.id, run);
    return {
      player: publicPlayer(),
      game,
      run: publicRun(run)
    };
  }

  if (method === "POST" && path === "/api/run/resume") {
    if (
      !isRecord(body)
      || !["runId", "runToken"].every((key) => Object.hasOwn(body, key))
      || Object.keys(body).some((key) => !["runId", "runToken", "snapshot", "deferActivation"].includes(key))
      || (Object.hasOwn(body, "deferActivation") && typeof body.deferActivation !== "boolean")
    ) {
      fail(
        "Run resume requires a run ID, token, optional snapshot, and optional deferred activation.",
        "invalid_resume_request",
        400
      );
    }
    const run = restoreRun(body);
    if (run.activatedAt == null && body.deferActivation !== true) activateLocalRun(run);
    return resumeResponse(run);
  }

  if (method === "POST" && path === "/api/recipe-feedback") {
    const run = requireRun(body);
    const move = Number(body.move);
    const rating = sanitizeRecipeRating(body.rating);
    if (!Number.isInteger(move) || move < 1 || !rating) fail("That recipe rating is not valid.", "invalid_recipe_feedback", 400);
    const step = run.history[move - 1];
    if (!step || step.revealed) fail("That discovery is not available for rating.", "recipe_feedback_missing", 409);
    run.feedbackMoves ||= new Set();
    if (run.feedbackMoves.has(move)) fail("That discovery was already rated.", "recipe_feedback_duplicate", 409);
    run.feedbackMoves.add(move);
    return { accepted: true, move, rating, localOnly: true };
  }

  if (method === "POST" && path === "/api/run/tip") {
    if (!hasExactKeys(body, ["runId", "runToken", "tipIndex"])) {
      fail("Route Signal requires only runId, runToken, and tipIndex.", "invalid_tip_request", 400);
    }
    return useLocalTip(requireRun(body), body.tipIndex);
  }

  if (method === "POST" && path === "/api/run/sense") {
    const run = requireRun(body);
    if (run.completed) fail("This local orbit is already complete.", "run_complete", 409);
    const route = run.solutionRoute;
    if (!Array.isArray(route)) fail("No safe constellation signal is available for this target.", "sense_unavailable", 422);
    const words = [...run.available].map((word) => localItemFor(word)).filter(Boolean);
    const candidates = rankSenseCandidates({
      words,
      target: run.game.target,
      history: run.history,
      route,
      seed: run.game.seed,
      limit: 3
    }).map((candidate) => {
      const discovered = localItemFor(candidate.word);
      return {
        word: discovered?.word || candidate.word,
        emoji: discovered?.emoji || candidate.emoji || "",
        category: discovered?.category || null,
        signal: ["bright", "warm", "resonant"].includes(candidate.signal) ? candidate.signal : "warm"
      };
    }).slice(0, 3);
    if (!candidates.length) fail("No safe constellation signal is available yet.", "sense_unavailable", 422);
    if (!run.scoringDisabled) run.assist = combineAssistance(run.assist, "sense").id;
    const policy = assistancePolicy(run.assist);
    const scoringDisabled = Boolean(run.scoringDisabled || policy.study);
    return {
      candidates,
      division: scoringDisabled ? "study" : policy.division,
      assisted: true,
      assist: run.assist,
      scoringDisabled,
      scoreEligible: !scoringDisabled && policy.scoreEligible,
      scoreMultiplier: scoringDisabled ? 0 : policy.scoreMultiplier,
      rewardEligible: !scoringDisabled,
      leaderboardEligible: false,
      ranked: false,
      localOnly: true
    };
  }

  if (method === "POST" && path === "/api/run/gift") {
    if (!hasExactKeys(body, ["runId", "runToken"])) fail("Word Gift requires only runId and runToken.", "invalid_gift_request", 400);
    const run = requireRun(body);
    let item = run.giftUsed && run.giftItem ? { ...run.giftItem } : null;
    if (!item) {
      if (run.submitted) fail("This local orbit was already submitted.", "already_submitted", 409);
      if (run.completed) fail("This local orbit is already complete.", "run_complete", 409);
      const selected = selectWordGift({
        route: run.solutionRoute,
        discovered: [...run.available],
        target: run.game.target,
        seed: run.game.seed
      });
      const canonical = selected ? localItemFor(selected.word) : null;
      if (!canonical || canonical.word.toLowerCase() === run.game.target.toLowerCase()) {
        fail("No undiscovered bridge word is available for this orbit.", "gift_unavailable", 422);
      }
      item = {
        ...canonical,
        source: "gift",
        note: "A crucial bridge gifted by the cosmos.",
        feedbackEligible: false
      };
      run.giftUsed = true;
      run.giftItem = item;
      if (!run.scoringDisabled) run.assist = combineAssistance(run.assist, "gift").id;
      run.available.add(item.word.toLowerCase());
    }
    const policy = assistancePolicy(run.assist);
    const scoringDisabled = Boolean(run.scoringDisabled || policy.study);
    return {
      item: { word: item.word, emoji: item.emoji || "", category: item.category || null, source: "gift" },
      division: scoringDisabled ? "study" : policy.division,
      assisted: true,
      assist: run.assist,
      scoringDisabled,
      scoreEligible: !scoringDisabled && policy.scoreEligible,
      scoreMultiplier: scoringDisabled ? 0 : policy.scoreMultiplier,
      rewardEligible: !scoringDisabled,
      leaderboardEligible: false,
      ranked: false,
      routeProgress: localRouteProgressForRun(run),
      localOnly: true
    };
  }

  if (method === "POST" && path === "/api/run/reveal") {
    const run = requireRun(body);
    if (run.revealRoute) return revealedRun(run);
    if (run.completed) fail("This local orbit is already complete.", "run_complete", 409);

    const route = run.solutionRoute;
    if (!Array.isArray(route)) fail("The local cosmos could not reconstruct this answer.", "route_unavailable", 409);

    run.revealRoute = structuredClone(route);
    run.assist = "reveal";
    run.scoringDisabled = true;
    run.completed = true;
    if (run.remixRuntime) {
      run.remixProgress = markRouteRemixAnswerRevealed(run.remixProgress);
    }
    for (const step of route) {
      run.available.add(step.word.toLowerCase());
      run.history.push({ ...step, source: "reveal", revealed: true });
    }
    run.moves += route.length;
    return revealedRun(run);
  }

  if (method === "POST" && path === "/api/combine") {
    const hasRunCredentials = Boolean(body.runId || body.runToken);
    const run = hasRunCredentials ? requireRun(body) : null;
    if (run?.completed) fail("This local orbit is already complete.", "run_complete", 409);
    if (run && run.activatedAt == null) fail("This orbit is still opening.", "run_not_active", 409);
    const a = canonicalLocalWord(body.a);
    const b = canonicalLocalWord(body.b);
    const available = run?.available || new Set((Array.isArray(body.discovered) ? body.discovered : [])
      .slice(0, 1000)
      .map((word) => canonicalLocalWord(word)?.toLowerCase())
      .filter(Boolean));
    if (!a || !b || !available.has(a.toLowerCase()) || !available.has(b.toLowerCase())) {
      fail("Use words already discovered in this orbit.", "word_unavailable", 409);
    }
    if (run?.deadlineAt && Date.now() > Date.parse(run.deadlineAt)) fail("This quick orbit has ended.", "time_expired", 409);
    if (run?.game.moveLimit && run.moves >= run.game.moveLimit) {
      const masterRoute = run.game.remixes?.rules?.some((rule) => rule.family === "master_route");
      fail(
        masterRoute ? "The Master Route fusion limit is reached." : "No moves remain in this orbit.",
        masterRoute ? "master_route_limit" : "move_limit",
        409
      );
    }
    const canonicalResult = lookupLocalCombination(a, b);
    if (!canonicalResult) {
      if (run && localPathGuardEnabled(run)) throw localWrongPathError(run);
      fail("Those ideas are outside this local universe.", "combination_missing");
    }
    if (run?.remixRuntime) {
      const remixCheck = checkRouteRemixBeforeCombination(run.remixRuntime, run.remixProgress, { a, b });
      if (!remixCheck.allowed) fail(remixCheck.reason, "remix_pair_blocked", 409);
    }
    const pathGuardDecision = run
      ? localPathGuardDecision(run, { a, b, result: canonicalResult })
      : { active: false, blocked: false };
    if (pathGuardDecision.blocked) throw localWrongPathError(run);
    const twist = run && !run.remixRuntime && !pathGuardDecision.active ? selectCosmicTwist({
      a,
      b,
      canonicalResult,
      target: run.game.target,
      mode: run.game.mode,
      seed: cosmicTwistSeedFor(run.game),
      moveNumber: run.moves + 1,
      twistUsed: run.twistUsed,
      discovered: run.available
    }) : null;
    const result = twist || canonicalResult;
    const annotation = run ? annotateUniverseResult({
      universe: run.game.universe,
      a,
      b,
      result,
      recipes: [{ a, b, ...canonicalResult }]
    }) : null;
    if (run && twist) {
      run.twistUsed = true;
      run.twistedPairKey = [a, b].map((word) => word.toLowerCase()).sort().join("+");
    }
    let remixCompletion = null;
    let publicRemixProgress = null;
    if (run) {
      run.moves += 1;
      run.available.add(result.word.toLowerCase());
      run.history.push({
        a,
        b,
        word: result.word,
        emoji: result.emoji,
        category: result.category,
        source: result.source,
        ...(result.twisted ? { twisted: true, canonicalWord: result.twist?.canonicalWord || canonicalResult.word } : {})
      });
      if (run.remixRuntime) {
        const remixRecord = recordRouteRemixCombination(run.remixRuntime, run.remixProgress, {
          a,
          b,
          word: result.word,
          successful: true
        });
        if (remixRecord.accepted) run.remixProgress = remixRecord.progress;
        publicRemixProgress = routeRemixProgress(run.remixRuntime, run.remixProgress);
      }
      if (result.word.toLowerCase() === run.game.target.toLowerCase()) {
        remixCompletion = run.remixRuntime
          ? checkRouteRemixCompletion(run.remixRuntime, run.remixProgress, result.word)
          : { complete: true, reason: "" };
        run.completed ||= remixCompletion.complete;
      }
    }
    return {
      ...result,
      ...(annotation ? { universeContext: annotation.context } : {}),
      feedbackEligible: !twist,
      completed: Boolean(run?.completed),
      remixProgress: publicRemixProgress,
      targetMade: Boolean(run && result.word.toLowerCase() === run.game.target.toLowerCase()),
      completionBlocked: Boolean(remixCompletion && !remixCompletion.complete),
      remixMessage: remixCompletion && !remixCompletion.complete ? remixCompletion.reason : "",
      ...(run ? { routeProgress: localRouteProgressForRun(run) } : {}),
      ranked: false,
      localOnly: true,
      division: run?.assist && run.assist !== "none" ? "local-assisted" : "local"
    };
  }

  if (method === "POST" && path === "/api/wish") {
    const run = requireRun(body);
    if (run.completed) fail("This local orbit is already complete.", "run_complete", 409);
    if (run.wished) fail("Only one Practice Wish may be used in an orbit.", "wish_used", 409);
    const item = localItemFor(body.word);
    if (!item) fail("Practice Wishes must use a word mapped in the local universe.", "local_wish_unknown");
    run.wished = true;
    run.assist = combineAssistance(run.assist, "wish").id;
    run.bendItem = { ...item };
    run.available.add(item.word.toLowerCase());
    return {
      ...item,
      assist: run.assist,
      scoreMultiplier: assistancePolicy(run.assist).scoreMultiplier,
      player: publicPlayer(),
      routeProgress: localRouteProgressForRun(run),
      localOnly: true
    };
  }

  if (method === "POST" && path === "/api/run/submit") return {
    ranked: false,
    localOnly: true,
    reason: "Local practice results stay on this device and are never presented as verified scores."
  };

  if (path.startsWith("/api/leaderboard")) fail("Verified leaderboards require the online account service.", "online_required", 503);
  if (path.startsWith("/api/market")) fail("The Word Exchange requires the online account service. No purchases are available here.", "online_required", 503);
  if (path === "/api/player/test-entitlement") fail("Purchases are disabled in local practice.", "payments_disabled", 503);
  fail("That feature needs the online game server.", "online_required", 503);
}
