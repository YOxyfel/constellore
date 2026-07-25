export const RUN_IQ_VERSION = 2;
export const RUN_IQ_MIN = 0;
export const RUN_IQ_MAX = 200;
export const RUN_IQ_START = 0;
export const RUN_IQ_DISCOVERY_GAIN = 1;
export const RUN_IQ_EXPLORATION_LIMIT = 10;
export const RUN_IQ_MISS_LOSS = 2;
export const RUN_IQ_STREAK_STEP = 0.2;
export const RUN_IQ_MAX_MULTIPLIER = 2;

const MAX_TRACKED_PAIRS = 1000;
const DEFAULT_ROUTE_TOTAL = 6;
const MAX_ROUTE_TOTAL = 100;
const EXCLUDED_MODES = new Set(["training", "second-orbit", "explore"]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function wholeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function finiteProgressValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : null;
}

function cleanPairList(candidate) {
  return Array.isArray(candidate)
    ? [...new Set(candidate
      .map((key) => String(key || "").trim().slice(0, 180))
      .filter(Boolean))]
      .slice(-MAX_TRACKED_PAIRS)
    : [];
}

function appendPair(pairs, pairKey) {
  if (!pairKey || pairs.includes(pairKey)) return pairs;
  return [...pairs, pairKey].slice(-MAX_TRACKED_PAIRS);
}

function normalizedRouteTotal(value, fallback = DEFAULT_ROUTE_TOTAL) {
  return clamp(wholeNumber(value, fallback), 1, MAX_ROUTE_TOTAL);
}

function perfectRouteWeight(total) {
  let weight = 0;
  for (let step = 1; step <= total; step += 1) weight += streakMultiplier(step);
  return weight;
}

function scoreValue({ routeValue, explorationValue, penalty, misses }) {
  // A run containing a rejected pair can still recover to an excellent score,
  // but 200 remains the satisfying signature of a clean route.
  const ceiling = misses > 0 ? RUN_IQ_MAX - 1 : RUN_IQ_MAX;
  return clamp(Math.round(routeValue + explorationValue - penalty), RUN_IQ_MIN, ceiling);
}

function resolveRewardContext(context) {
  const source = context && typeof context === "object" ? context : {};
  const completed = source.completed === true || source.won === true;
  const hasProgressEvidence = source.before
    || source.after
    || Number.isFinite(Number(source.remainingBefore))
    || Number.isFinite(Number(source.remainingAfter));
  if (!hasProgressEvidence) {
    return {
      ...source,
      routeTotal: source.routeTotal ?? source.total
    };
  }
  const before = source.before || {
    total: source.routeTotal ?? source.total,
    remaining: source.remainingBefore
  };
  const after = source.after || {
    total: source.routeTotal ?? source.total,
    remaining: source.remainingAfter,
    complete: completed
  };
  return {
    ...runIqRouteContext(before, after, {
      completed,
      newDiscovery: source.newDiscovery !== false
    }),
    ...source,
    completed,
    routeTotal: source.routeTotal ?? source.total ?? after.total ?? before.total
  };
}

export function runIqApplies(mode, target = "", options = {}) {
  const normalizedMode = String(mode || "").trim().toLowerCase();
  return Boolean(
    normalizedMode
    && !EXCLUDED_MODES.has(normalizedMode)
    && String(target || "").trim()
    && options.training !== true
    && options.study !== true
    && options.reveal !== true
    && options.revealed !== true
    && options.scoreEligible !== false
  );
}

export function streakMultiplier(streak = 0) {
  const successes = Math.max(0, wholeNumber(streak));
  if (!successes) return 1;
  return Math.min(
    RUN_IQ_MAX_MULTIPLIER,
    1 + Math.max(0, successes - 1) * RUN_IQ_STREAK_STEP
  );
}

export function runIqPairKey(a, b) {
  return [a, b]
    .map((word) => String(word || "").trim().toLowerCase())
    .sort()
    .join("+")
    .slice(0, 180);
}

/**
 * Turns the authored-route snapshots already returned by the server into the
 * metadata rewardRunIq needs. The caller should capture `before` prior to
 * accepting the new route progress.
 */
export function runIqRouteContext(before, after, {
  completed = false,
  won = false,
  newDiscovery = true
} = {}) {
  const beforeRemaining = finiteProgressValue(before?.remaining);
  const afterRemaining = finiteProgressValue(after?.remaining);
  const routeTotal = finiteProgressValue(after?.total)
    ?? finiteProgressValue(before?.total)
    ?? DEFAULT_ROUTE_TOTAL;
  // Distance can reach zero because a Reality Bend injected the target or a
  // crucial word. Only the authoritative winning-fusion flag may award target
  // IQ; a complete progress snapshot alone is not proof of a completed game.
  const targetReached = completed === true || won === true;
  const progressCompleteWithoutWin = !targetReached
    && (after?.complete === true || afterRemaining === 0);
  const stepsAdvanced = beforeRemaining !== null && afterRemaining !== null
    ? Math.max(0, beforeRemaining - afterRemaining)
    : 0;

  if (targetReached) {
    return {
      relevance: "target",
      routeAdvanced: true,
      routeTotal: normalizedRouteTotal(routeTotal),
      stepsAdvanced: Math.max(1, stepsAdvanced),
      completed: true,
      newDiscovery: Boolean(newDiscovery)
    };
  }
  if (progressCompleteWithoutWin) {
    return {
      relevance: newDiscovery ? "discovery" : "known",
      routeAdvanced: false,
      routeTotal: normalizedRouteTotal(routeTotal),
      stepsAdvanced: 0,
      completed: false,
      newDiscovery: Boolean(newDiscovery)
    };
  }
  if (stepsAdvanced > 0) {
    return {
      relevance: "route",
      routeAdvanced: true,
      routeTotal: normalizedRouteTotal(routeTotal),
      stepsAdvanced,
      completed: false,
      newDiscovery: Boolean(newDiscovery)
    };
  }
  return {
    relevance: newDiscovery ? "discovery" : "known",
    routeAdvanced: false,
    routeTotal: normalizedRouteTotal(routeTotal),
    stepsAdvanced: 0,
    completed: false,
    newDiscovery: Boolean(newDiscovery)
  };
}

export function createRunIqState(value = RUN_IQ_START) {
  const startingValue = clamp(wholeNumber(value, RUN_IQ_START), RUN_IQ_MIN, RUN_IQ_MAX);
  return {
    version: RUN_IQ_VERSION,
    value: startingValue,
    routeValue: startingValue,
    explorationValue: 0,
    penalty: 0,
    misses: 0,
    routeConnections: 0,
    routeTotal: 0,
    streak: 0,
    multiplier: 1,
    delta: 0,
    outcome: "ready",
    relevance: "none",
    maxed: startingValue === RUN_IQ_MAX,
    rewardedPairs: [],
    attemptedPairs: []
  };
}

export function sanitizeRunIqState(candidate) {
  if (!candidate || typeof candidate !== "object") return createRunIqState();

  const legacy = Number(candidate.version) !== RUN_IQ_VERSION;
  const legacyValue = clamp(wholeNumber(candidate.value, RUN_IQ_START), RUN_IQ_MIN, RUN_IQ_MAX);
  const routeValue = clamp(
    wholeNumber(candidate.routeValue, legacy ? legacyValue : 0),
    RUN_IQ_MIN,
    RUN_IQ_MAX
  );
  const explorationValue = clamp(
    wholeNumber(candidate.explorationValue),
    0,
    RUN_IQ_EXPLORATION_LIMIT
  );
  const penalty = clamp(wholeNumber(candidate.penalty), 0, 10_000);
  const misses = clamp(wholeNumber(candidate.misses), 0, 10_000);
  const streak = clamp(wholeNumber(candidate.streak), 0, 1000);
  const rewardedPairs = cleanPairList(candidate.rewardedPairs);
  const attemptedPairs = cleanPairList(
    Array.isArray(candidate.attemptedPairs)
      ? candidate.attemptedPairs
      : rewardedPairs
  );
  const normalized = {
    version: RUN_IQ_VERSION,
    value: 0,
    routeValue,
    explorationValue,
    penalty,
    misses,
    routeConnections: clamp(wholeNumber(candidate.routeConnections), 0, MAX_ROUTE_TOTAL),
    routeTotal: clamp(wholeNumber(candidate.routeTotal), 0, MAX_ROUTE_TOTAL),
    streak,
    multiplier: streakMultiplier(streak),
    delta: 0,
    outcome: "ready",
    relevance: "none",
    maxed: false,
    rewardedPairs,
    attemptedPairs
  };
  normalized.value = legacy
    ? legacyValue
    : scoreValue(normalized);
  return normalized;
}

function ignoredAttempt(current, outcome, relevance = "none") {
  return {
    ...current,
    delta: 0,
    outcome,
    relevance,
    maxed: current.value === RUN_IQ_MAX
  };
}

/**
 * Rewards a successful recipe.
 *
 * context.relevance:
 * - "route": materially reduced the authored distance to the target
 * - "target": created the target
 * - "discovery": a new but route-neutral word
 * - "known": a valid result already known in this run
 *
 * Supplying no relevance is deliberately conservative: it earns only the
 * tiny discovery reward until the caller provides authored-route evidence.
 */
export function rewardRunIq(candidate, pairKey = "", context = {}) {
  const current = sanitizeRunIqState(candidate);
  const resolvedContext = resolveRewardContext(context);
  const normalizedPair = String(pairKey || "").trim().slice(0, 180);
  if (!normalizedPair) return ignoredAttempt(current, "ignored");
  if (current.attemptedPairs.includes(normalizedPair)) {
    return ignoredAttempt(current, "repeat");
  }
  if (resolvedContext.eligible === false || resolvedContext.study === true || resolvedContext.revealed === true) {
    return ignoredAttempt(current, "ignored");
  }

  const completed = resolvedContext.completed === true || resolvedContext.won === true;
  const relevance = completed
    ? "target"
    : resolvedContext.relevance === "target"
      ? resolvedContext.newDiscovery === false ? "known" : "discovery"
      : resolvedContext.relevance === "route" || resolvedContext.routeAdvanced === true
      ? "route"
      : resolvedContext.relevance === "known" || resolvedContext.newDiscovery === false
        ? "known"
        : "discovery";
  const attemptedPairs = appendPair(current.attemptedPairs, normalizedPair);
  const rewardedPairs = relevance === "known"
    ? current.rewardedPairs
    : appendPair(current.rewardedPairs, normalizedPair);

  if (relevance === "known") {
    return {
      ...current,
      attemptedPairs,
      delta: 0,
      outcome: "known",
      relevance,
      maxed: current.value === RUN_IQ_MAX
    };
  }

  if (relevance === "discovery") {
    const explorationValue = Math.min(
      RUN_IQ_EXPLORATION_LIMIT,
      current.explorationValue + RUN_IQ_DISCOVERY_GAIN
    );
    const value = scoreValue({ ...current, explorationValue });
    return {
      ...current,
      value,
      explorationValue,
      delta: value - current.value,
      outcome: "explore",
      relevance,
      maxed: value === RUN_IQ_MAX,
      explorationCapped: explorationValue === RUN_IQ_EXPLORATION_LIMIT,
      rewardedPairs,
      attemptedPairs
    };
  }

  const routeTotal = normalizedRouteTotal(resolvedContext.routeTotal, current.routeTotal || DEFAULT_ROUTE_TOTAL);
  const routeConnections = Math.min(
    routeTotal,
    current.routeConnections + Math.max(1, wholeNumber(resolvedContext.stepsAdvanced, 1))
  );
  const streak = current.streak + 1;
  const multiplier = streakMultiplier(streak);
  const routeUnit = RUN_IQ_MAX / perfectRouteWeight(routeTotal);
  let routeValue = Math.min(
    RUN_IQ_MAX,
    current.routeValue + Math.max(1, Math.round(routeUnit * multiplier))
  );

  // Exact 200 is reserved for completing a route without a rejected pair.
  // Rounding and varying route lengths therefore never make a perfect finish
  // land disappointingly at 198 or 199.
  if (relevance === "target" && current.misses === 0) routeValue = RUN_IQ_MAX;
  else if (current.misses > 0) routeValue = Math.min(RUN_IQ_MAX - 1, routeValue);

  const next = {
    ...current,
    routeValue,
    routeConnections,
    routeTotal,
    streak,
    multiplier,
    relevance,
    rewardedPairs,
    attemptedPairs
  };
  const value = scoreValue(next);
  return {
    ...next,
    value,
    delta: value - current.value,
    outcome: relevance,
    maxed: value === RUN_IQ_MAX
  };
}

/**
 * Applies the small rejected-pair penalty and breaks only the route streak.
 * Passing a pair key prevents the same invalid pair from being penalized more
 * than once.
 */
export function softenRunIq(candidate, pairKey = "") {
  const current = sanitizeRunIqState(candidate);
  const normalizedPair = String(pairKey || "").trim().slice(0, 180);
  if (normalizedPair && current.attemptedPairs.includes(normalizedPair)) {
    return ignoredAttempt(current, "repeat");
  }
  const penalty = current.penalty + RUN_IQ_MISS_LOSS;
  const misses = current.misses + 1;
  const attemptedPairs = normalizedPair
    ? appendPair(current.attemptedPairs, normalizedPair)
    : current.attemptedPairs;
  const value = scoreValue({ ...current, penalty, misses });
  return {
    ...current,
    value,
    penalty,
    misses,
    streak: 0,
    multiplier: 1,
    delta: value - current.value,
    outcome: "miss",
    relevance: "none",
    maxed: false,
    attemptedPairs
  };
}
