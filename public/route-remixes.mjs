export const ROUTE_REMIX_VERSION = 1;

export const ROUTE_REMIX_FAMILIES = Object.freeze([
  "required_waypoint",
  "forbidden_shortcut",
  "master_route",
  "graph_safe_rule",
  "orbit_chain"
]);

const FAMILY_SET = new Set(ROUTE_REMIX_FAMILIES);
const MAX_WORD_LENGTH = 80;
const MAX_ROUTE_STEPS = 96;
const MAX_RECIPES = 12_000;
const MAX_SEEN_ITEMS = 256;

const FAMILY_COPY = Object.freeze({
  required_waypoint: {
    label: "Waypoint",
    fallback: "Pass through one marked word before the target."
  },
  forbidden_shortcut: {
    label: "No shortcut",
    fallback: "One tempting shortcut is closed for this challenge."
  },
  master_route: {
    label: "Master route",
    fallback: "Reach the target within the shown fusion limit."
  },
  graph_safe_rule: {
    label: "Clean route",
    fallback: "Do not repeat a successful fusion."
  },
  orbit_chain: {
    label: "Orbit chain",
    fallback: "Finish with consecutive linked fusions."
  }
});

function cleanWord(value) {
  const source = value && typeof value === "object" ? value.word : value;
  return String(source || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_WORD_LENGTH);
}

function wordKey(value) {
  return cleanWord(value).toLocaleLowerCase("en-US");
}

function pairKey(a, b) {
  return [wordKey(a), wordKey(b)].sort().join("\u0000");
}

function pairLabel(a, b) {
  return `${cleanWord(a)} + ${cleanWord(b)}`;
}

function normalizedPairKey(value) {
  const source = String(value || "").slice(0, MAX_WORD_LENGTH * 2 + 1);
  const parts = source.split("\u0000");
  if (parts.length !== 2 || parts.some((part) => !part)) return "";
  return pairKey(parts[0], parts[1]) === source ? source : "";
}

function wholeNumber(value, fallback = 0, minimum = 0, maximum = 999) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicPick(values, seed, salt) {
  if (!values.length) return null;
  return values[stableHash(`${seed}\u0000${salt}`) % values.length];
}

function recipeValues(source) {
  if (source instanceof Map) return [...source.values()];
  if (Array.isArray(source)) return source;
  return source && typeof source[Symbol.iterator] === "function" ? [...source] : [];
}

function cleanRoute(source) {
  if (!Array.isArray(source)) return [];
  const route = [];
  for (const candidate of source.slice(0, MAX_ROUTE_STEPS)) {
    const a = cleanWord(candidate?.a);
    const b = cleanWord(candidate?.b);
    const word = cleanWord(candidate?.word);
    if (!a || !b || !word) return [];
    route.push(Object.freeze({
      a,
      b,
      word,
      pairKey: pairKey(a, b),
      resultKey: wordKey(word)
    }));
  }
  return route;
}

function cleanRecipes(source) {
  const recipes = [];
  const seen = new Set();
  for (const candidate of recipeValues(source).slice(0, MAX_RECIPES)) {
    const a = cleanWord(candidate?.a);
    const b = cleanWord(candidate?.b);
    const word = cleanWord(candidate?.word);
    if (!a || !b || !word) continue;
    const pair = pairKey(a, b);
    const id = `${wordKey(word)}=${pair}`;
    if (seen.has(id)) continue;
    seen.add(id);
    recipes.push(Object.freeze({
      a,
      b,
      word,
      pairKey: pair,
      resultKey: wordKey(word),
      id
    }));
  }
  return recipes.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeFamily(value) {
  const raw = typeof value === "object" && value
    ? value.family ?? value.id
    : value;
  const normalized = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases = {
    waypoint: "required_waypoint",
    forbidden: "forbidden_shortcut",
    no_shortcut: "forbidden_shortcut",
    master: "master_route",
    graph_rule: "graph_safe_rule",
    graph_safe: "graph_safe_rule",
    chain: "orbit_chain",
    orbit: "orbit_chain"
  };
  const family = aliases[normalized] || normalized;
  return FAMILY_SET.has(family) ? family : "";
}

function normalizeFamilies(values) {
  const source = Array.isArray(values) ? values : values == null ? [] : [values];
  const result = [];
  const seen = new Set();
  for (const value of source) {
    const family = normalizeFamily(value);
    if (!family || seen.has(family)) continue;
    seen.add(family);
    result.push(family);
  }
  return result;
}

function targetFor(route, suppliedTarget) {
  return cleanWord(suppliedTarget) || cleanWord(route.at(-1)?.word);
}

function canonicalPairCounts(route) {
  const counts = new Map();
  for (const step of route) counts.set(step.pairKey, (counts.get(step.pairKey) || 0) + 1);
  return counts;
}

function waypointCandidates(route, targetKey) {
  return route
    .slice(0, -1)
    .filter((step) => step.resultKey !== targetKey)
    .map((step, index) => ({ ...step, depth: index + 1 }));
}

function alternateShortcutCandidates(route, recipes) {
  const canonicalPairs = new Set(route.map((step) => step.pairKey));
  const resultDepth = new Map(route.map((step, index) => [step.resultKey, index + 1]));
  return recipes
    .filter((recipe) => resultDepth.has(recipe.resultKey) && !canonicalPairs.has(recipe.pairKey))
    .map((recipe) => ({ ...recipe, depth: resultDepth.get(recipe.resultKey) }))
    .sort((left, right) => (
      right.depth - left.depth
      || left.resultKey.localeCompare(right.resultKey)
      || left.pairKey.localeCompare(right.pairKey)
    ));
}

function verifiedOrbitSuffix(route, targetKey) {
  if (route.length < 2 || route.at(-1)?.resultKey !== targetKey) return [];
  let start = route.length - 1;
  while (start > 0) {
    const previous = route[start - 1];
    const current = route[start];
    const feedsCurrent = previous.resultKey === wordKey(current.a)
      || previous.resultKey === wordKey(current.b);
    if (!feedsCurrent) break;
    start -= 1;
  }
  const suffix = route.slice(start);
  return suffix.length >= 2 ? suffix : [];
}

/**
 * Reports only modifiers that the supplied canonical route can satisfy.
 * Callers should select from `availableFamilies`; unavailable families include
 * a stable reason so progression can substitute another unlocked modifier.
 */
export function detectRouteRemixCapabilities({
  route: rawRoute = [],
  recipes: rawRecipes = [],
  target: rawTarget = ""
} = {}) {
  const route = cleanRoute(rawRoute);
  const target = targetFor(route, rawTarget);
  const targetKey = wordKey(target);
  const validRoute = route.length > 0 && route.at(-1)?.resultKey === targetKey;
  const pairCounts = canonicalPairCounts(route);
  const uniqueCanonicalPairs = [...pairCounts.values()].every((count) => count === 1);
  const waypoints = validRoute ? waypointCandidates(route, targetKey) : [];
  const shortcuts = validRoute ? alternateShortcutCandidates(route, cleanRecipes(rawRecipes)) : [];
  const orbitSuffix = validRoute ? verifiedOrbitSuffix(route, targetKey) : [];
  const capability = {
    required_waypoint: {
      available: validRoute && waypoints.length > 0,
      reason: validRoute
        ? (waypoints.length ? "canonical_waypoint_available" : "route_has_no_intermediate")
        : "invalid_canonical_route"
    },
    forbidden_shortcut: {
      available: validRoute && shortcuts.length > 0,
      reason: validRoute
        ? (shortcuts.length ? "alternate_pair_available" : "no_safe_alternate_pair")
        : "invalid_canonical_route"
    },
    master_route: {
      available: validRoute,
      reason: validRoute ? "canonical_route_sets_par" : "invalid_canonical_route"
    },
    graph_safe_rule: {
      available: validRoute && uniqueCanonicalPairs,
      reason: !validRoute
        ? "invalid_canonical_route"
        : uniqueCanonicalPairs
          ? "canonical_route_never_repeats_a_pair"
          : "canonical_route_repeats_a_pair"
    },
    orbit_chain: {
      available: validRoute && orbitSuffix.length >= 2,
      reason: !validRoute
        ? "invalid_canonical_route"
        : orbitSuffix.length >= 2
          ? "verified_consecutive_target_suffix"
          : "no_consecutive_target_suffix"
    }
  };
  return Object.freeze({
    validRoute,
    target,
    routeLength: route.length,
    availableFamilies: Object.freeze(
      ROUTE_REMIX_FAMILIES.filter((family) => capability[family].available)
    ),
    capability: Object.freeze(capability)
  });
}

function familyPresentation(family, constraint) {
  if (family === "required_waypoint") {
    return {
      family,
      label: FAMILY_COPY[family].label,
      instruction: `Make ${constraint.word} before the target.`,
      detail: constraint.word
    };
  }
  if (family === "forbidden_shortcut") {
    return {
      family,
      label: FAMILY_COPY[family].label,
      instruction: `Do not use ${pairLabel(constraint.a, constraint.b)}.`,
      detail: pairLabel(constraint.a, constraint.b)
    };
  }
  if (family === "master_route") {
    return {
      family,
      label: FAMILY_COPY[family].label,
      instruction: `Finish in ${constraint.moveCap} fusions or fewer.`,
      detail: `${constraint.moveCap} max`
    };
  }
  if (family === "graph_safe_rule") {
    return {
      family,
      label: constraint.requireTwin ? "Twin route" : FAMILY_COPY[family].label,
      instruction: constraint.requireTwin
        ? "Use one matching pair, and never repeat a fusion."
        : "Never repeat a successful fusion.",
      detail: constraint.requireTwin ? "1 matching pair" : "No repeats"
    };
  }
  if (family === "orbit_chain") {
    return {
      family,
      label: FAMILY_COPY[family].label,
      instruction: `Finish with ${constraint.length} linked fusions in a row.`,
      detail: `${constraint.length} in a row`
    };
  }
  return {
    family,
    label: FAMILY_COPY[family]?.label || "Route rule",
    instruction: FAMILY_COPY[family]?.fallback || "Follow the route rule.",
    detail: ""
  };
}

function createRuntimeConstraint(family, context) {
  const { route, recipes, seed, targetKey } = context;
  if (family === "required_waypoint") {
    const candidates = waypointCandidates(route, targetKey);
    const chosen = deterministicPick(candidates, seed, family);
    return chosen ? { word: chosen.word, wordKey: chosen.resultKey } : null;
  }
  if (family === "forbidden_shortcut") {
    const candidates = alternateShortcutCandidates(route, recipes);
    // Prefer an alternate recipe for the final target, then deterministic
    // choice among equally deep candidates.
    const maximumDepth = candidates[0]?.depth;
    const deepest = candidates.filter((candidate) => candidate.depth === maximumDepth);
    const chosen = deterministicPick(deepest, seed, family);
    return chosen ? {
      a: chosen.a,
      b: chosen.b,
      result: chosen.word,
      pairKey: chosen.pairKey
    } : null;
  }
  if (family === "master_route") {
    return { moveCap: route.length };
  }
  if (family === "graph_safe_rule") {
    if (![...canonicalPairCounts(route).values()].every((count) => count === 1)) return null;
    const twin = route.find((step) => wordKey(step.a) === wordKey(step.b));
    return {
      rule: twin ? "twin_pair" : "no_repeat_pair",
      noRepeatPair: true,
      requireTwin: Boolean(twin)
    };
  }
  if (family === "orbit_chain") {
    const suffix = verifiedOrbitSuffix(route, targetKey);
    if (suffix.length < 2) return null;
    return {
      length: suffix.length,
      sequence: suffix.map((step) => ({
        pairKey: step.pairKey,
        resultKey: step.resultKey
      }))
    };
  }
  return null;
}

/**
 * Builds a deterministic, mutually compatible remix plan. `runtime` contains
 * server-only validation data. Attach only `public` to a game response: it
 * deliberately omits the Orbit Chain answer sequence and normalized keys.
 */
export function createRouteRemixPlan({
  route: rawRoute = [],
  recipes: rawRecipes = [],
  target: rawTarget = "",
  families: rawFamilies = [],
  seed = ""
} = {}) {
  const route = cleanRoute(rawRoute);
  const recipes = cleanRecipes(rawRecipes);
  const target = targetFor(route, rawTarget);
  const targetKey = wordKey(target);
  const requestedFamilies = normalizeFamilies(rawFamilies);
  const capabilities = detectRouteRemixCapabilities({ route, recipes, target });
  const constraints = {};
  const activeFamilies = [];
  const omittedFamilies = [];
  const context = { route, recipes, seed: String(seed), targetKey };

  for (const family of requestedFamilies) {
    if (!capabilities.capability[family]?.available) {
      omittedFamilies.push(family);
      continue;
    }
    const constraint = createRuntimeConstraint(family, context);
    if (!constraint) {
      omittedFamilies.push(family);
      continue;
    }
    constraints[family] = constraint;
    activeFamilies.push(family);
  }

  const runtime = sanitizeRouteRemixRuntime({
    version: ROUTE_REMIX_VERSION,
    target,
    activeFamilies,
    constraints
  });
  const publicView = publicRouteRemixView(runtime);
  return Object.freeze({
    version: ROUTE_REMIX_VERSION,
    requestedFamilies: Object.freeze(requestedFamilies),
    omittedFamilies: Object.freeze(omittedFamilies),
    runtime,
    public: publicView,
    capabilities
  });
}

function sanitizeConstraint(family, candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  if (family === "required_waypoint") {
    const word = cleanWord(candidate.word);
    return word ? { word, wordKey: wordKey(word) } : null;
  }
  if (family === "forbidden_shortcut") {
    const a = cleanWord(candidate.a);
    const b = cleanWord(candidate.b);
    const result = cleanWord(candidate.result);
    return a && b ? { a, b, result, pairKey: pairKey(a, b) } : null;
  }
  if (family === "master_route") {
    const moveCap = wholeNumber(candidate.moveCap, 0, 1, MAX_ROUTE_STEPS);
    return moveCap ? { moveCap } : null;
  }
  if (family === "graph_safe_rule") {
    const rule = candidate.requireTwin === true || candidate.rule === "twin_pair"
      ? "twin_pair"
      : "no_repeat_pair";
    return { rule, noRepeatPair: true, requireTwin: rule === "twin_pair" };
  }
  if (family === "orbit_chain") {
    if (!Array.isArray(candidate.sequence)) return null;
    const sequence = [];
    for (const step of candidate.sequence.slice(0, MAX_ROUTE_STEPS)) {
      const normalizedPair = normalizedPairKey(step?.pairKey);
      const resultKey = wordKey(step?.resultKey);
      if (!normalizedPair || !resultKey) return null;
      sequence.push({ pairKey: normalizedPair, resultKey });
    }
    if (sequence.length < 2) return null;
    return { length: sequence.length, sequence };
  }
  return null;
}

/**
 * Allowlist-only boundary for server-persisted runtime constraints.
 */
export function sanitizeRouteRemixRuntime(candidate) {
  const target = cleanWord(candidate?.target);
  const requested = normalizeFamilies(candidate?.activeFamilies);
  const constraints = {};
  const activeFamilies = [];
  for (const family of requested) {
    const constraint = sanitizeConstraint(family, candidate?.constraints?.[family]);
    if (!constraint) continue;
    if (family === "orbit_chain") {
      const sequence = constraint.sequence;
      const linked = sequence.every((step, index) => (
        index === 0
        || step.pairKey.split("\u0000").includes(sequence[index - 1].resultKey)
      ));
      if (!linked || sequence.at(-1)?.resultKey !== wordKey(target)) continue;
    }
    constraints[family] = Object.freeze(constraint);
    activeFamilies.push(family);
  }
  return Object.freeze({
    version: ROUTE_REMIX_VERSION,
    target,
    activeFamilies: Object.freeze(activeFamilies),
    constraints: Object.freeze(constraints)
  });
}

/**
 * Produces the only remix object intended for the browser/game payload. Secret
 * Orbit sequence signatures and normalized validation keys are stripped.
 */
export function publicRouteRemixView(candidate) {
  const runtime = sanitizeRouteRemixRuntime(candidate);
  const remixes = runtime.activeFamilies.map((family) => {
    const constraint = runtime.constraints[family];
    const presentation = familyPresentation(family, constraint);
    return Object.freeze({
      family: presentation.family,
      label: presentation.label,
      instruction: presentation.instruction,
      detail: presentation.detail
    });
  });
  return Object.freeze({
    version: ROUTE_REMIX_VERSION,
    count: remixes.length,
    remixes: Object.freeze(remixes),
    summary: remixes.length
      ? remixes.map((remix) => remix.label).join(" · ")
      : "Classic route"
  });
}

function cleanStringList(source, normalizer) {
  const values = Array.isArray(source) ? source : [];
  const output = [];
  const seen = new Set();
  for (const value of values.slice(0, MAX_SEEN_ITEMS)) {
    const normalized = normalizer(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

export function createRouteRemixProgress(candidate = {}) {
  return sanitizeRouteRemixProgress(candidate);
}

export function sanitizeRouteRemixProgress(candidate) {
  const seenPairs = cleanStringList(candidate?.seenPairs, (value) => {
    return normalizedPairKey(value);
  });
  const discoveredWords = cleanStringList(candidate?.discoveredWords, wordKey);
  const pendingTargetPair = normalizedPairKey(candidate?.pendingTargetPair);
  const targetPending = candidate?.targetPending === true
    && Boolean(pendingTargetPair);
  return Object.freeze({
    version: ROUTE_REMIX_VERSION,
    moves: wholeNumber(candidate?.moves, 0, 0, 999),
    seenPairs: Object.freeze(seenPairs),
    discoveredWords: Object.freeze(discoveredWords),
    twinPairUsed: candidate?.twinPairUsed === true,
    orbitPosition: wholeNumber(candidate?.orbitPosition, 0, 0, MAX_ROUTE_STEPS),
    orbitComplete: candidate?.orbitComplete === true,
    lastResult: wordKey(candidate?.lastResult),
    targetPending,
    pendingTargetPair: targetPending ? pendingTargetPair : "",
    answerRevealed: candidate?.answerRevealed === true
  });
}

function blockedResult(code, reason, terminal = false) {
  return Object.freeze({ allowed: false, code, reason, terminal });
}

function pendingTargetRetryReady(runtime, progress, currentPair, a, b) {
  if (!progress.targetPending || progress.pendingTargetPair !== currentPair) return false;
  const waypoint = runtime.constraints.required_waypoint;
  if (waypoint && !progress.discoveredWords.includes(waypoint.wordKey)) return false;
  const graphRule = runtime.constraints.graph_safe_rule;
  const retryIsTwin = wordKey(a) === wordKey(b);
  if (graphRule?.requireTwin && !progress.twinPairUsed && !retryIsTwin) return false;
  const master = runtime.constraints.master_route;
  if (master && progress.moves >= master.moveCap) return false;
  const orbit = runtime.constraints.orbit_chain;
  if (orbit) {
    const expected = orbit.sequence[progress.orbitPosition];
    if (
      !expected
      || expected.pairKey !== currentPair
      || expected.resultKey !== wordKey(runtime.target)
      || progress.orbitPosition !== orbit.length - 1
    ) return false;
  }
  return true;
}

/**
 * Run before resolving a recipe. Unknown/failed pairs do not enter progress.
 */
export function checkRouteRemixBeforeCombination(runtimeCandidate, progressCandidate, combination = {}) {
  const runtime = sanitizeRouteRemixRuntime(runtimeCandidate);
  const progress = sanitizeRouteRemixProgress(progressCandidate);
  const a = cleanWord(combination.a);
  const b = cleanWord(combination.b);
  if (!a || !b) return blockedResult("invalid_pair", "Choose two words.", false);
  const currentPair = pairKey(a, b);
  const forbidden = runtime.constraints.forbidden_shortcut;
  if (forbidden && currentPair === forbidden.pairKey) {
    return blockedResult(
      "forbidden_shortcut",
      `${pairLabel(forbidden.a, forbidden.b)} is closed in this challenge.`,
      false
    );
  }
  const graphRule = runtime.constraints.graph_safe_rule;
  const recoverableTargetRetry = graphRule?.noRepeatPair
    && progress.seenPairs.includes(currentPair)
    && pendingTargetRetryReady(runtime, progress, currentPair, a, b);
  if (graphRule?.noRepeatPair && progress.seenPairs.includes(currentPair) && !recoverableTargetRetry) {
    return blockedResult("repeated_pair", "That fusion was already used.", false);
  }
  const master = runtime.constraints.master_route;
  if (master && progress.moves >= master.moveCap) {
    return blockedResult("master_route_limit", "The Master Route fusion limit is reached.", true);
  }
  return Object.freeze({ allowed: true, code: "allowed", reason: "", terminal: false });
}

function orbitProgressFor(constraint, previous, currentPair, currentResult) {
  if (!constraint) return { orbitPosition: 0, orbitComplete: false };
  const sequence = constraint.sequence;
  const position = Math.min(previous.orbitPosition, sequence.length);
  const matches = (index) => (
    sequence[index]?.pairKey === currentPair
    && sequence[index]?.resultKey === currentResult
  );
  let orbitPosition = matches(position)
    ? position + 1
    : matches(0)
      ? 1
      : 0;
  if (orbitPosition >= sequence.length) orbitPosition = sequence.length;
  return {
    orbitPosition,
    orbitComplete: orbitPosition === sequence.length
  };
}

/**
 * Records one resolved, successful fusion. Call the pre-check first; this
 * helper defensively refuses blocked combinations if it is called directly.
 */
export function recordRouteRemixCombination(
  runtimeCandidate,
  progressCandidate,
  combination = {}
) {
  const runtime = sanitizeRouteRemixRuntime(runtimeCandidate);
  const previous = sanitizeRouteRemixProgress(progressCandidate);
  const before = checkRouteRemixBeforeCombination(runtime, previous, combination);
  if (!before.allowed) return Object.freeze({ accepted: false, check: before, progress: previous });
  const a = cleanWord(combination.a);
  const b = cleanWord(combination.b);
  const result = cleanWord(combination.word ?? combination.result);
  if (!result || combination.successful === false) {
    return Object.freeze({
      accepted: false,
      check: Object.freeze({ allowed: true, code: "unresolved_pair", reason: "", terminal: false }),
      progress: previous
    });
  }
  const currentPair = pairKey(a, b);
  const currentResult = wordKey(result);
  const orbit = orbitProgressFor(
    runtime.constraints.orbit_chain,
    previous,
    currentPair,
    currentResult
  );
  const provisionalProgress = sanitizeRouteRemixProgress({
    moves: previous.moves + 1,
    seenPairs: [...previous.seenPairs, currentPair],
    discoveredWords: [...previous.discoveredWords, currentResult],
    twinPairUsed: previous.twinPairUsed || wordKey(a) === wordKey(b),
    orbitPosition: orbit.orbitPosition,
    orbitComplete: orbit.orbitComplete,
    lastResult: currentResult,
    targetPending: previous.targetPending,
    pendingTargetPair: previous.pendingTargetPair,
    answerRevealed: previous.answerRevealed
  });
  const targetWasMade = currentResult === wordKey(runtime.target);
  const targetBlocked = targetWasMade
    && completionBlockers(runtime, provisionalProgress).length > 0;
  const progress = sanitizeRouteRemixProgress({
    ...provisionalProgress,
    targetPending: targetWasMade ? targetBlocked : provisionalProgress.targetPending,
    pendingTargetPair: targetWasMade && targetBlocked
      ? currentPair
      : targetWasMade
        ? ""
        : provisionalProgress.pendingTargetPair
  });
  return Object.freeze({
    accepted: true,
    check: Object.freeze({ allowed: true, code: "recorded", reason: "", terminal: false }),
    progress,
    status: routeRemixProgress(runtime, progress)
  });
}

function completionBlockers(runtime, progress) {
  const blockers = [];
  const waypoint = runtime.constraints.required_waypoint;
  if (waypoint && !progress.discoveredWords.includes(waypoint.wordKey)) {
    blockers.push({
      code: "waypoint_missing",
      reason: `Make ${waypoint.word} first.`,
      terminal: false
    });
  }
  const master = runtime.constraints.master_route;
  if (master && progress.moves > master.moveCap) {
    blockers.push({
      code: "master_route_limit",
      reason: `The ${master.moveCap}-fusion limit was passed.`,
      terminal: true
    });
  }
  const graphRule = runtime.constraints.graph_safe_rule;
  if (graphRule?.requireTwin && !progress.twinPairUsed) {
    blockers.push({
      code: "twin_pair_missing",
      reason: "Use one matching pair first.",
      terminal: false
    });
  }
  const orbit = runtime.constraints.orbit_chain;
  if (orbit && (!progress.orbitComplete || progress.lastResult !== wordKey(runtime.target))) {
    blockers.push({
      code: "orbit_chain_incomplete",
      reason: `Finish with ${orbit.length} linked fusions in a row.`,
      terminal: false
    });
  }
  return blockers;
}

/**
 * Decides whether making the target actually completes the remixed challenge.
 * Non-terminal blockers let the player satisfy the rule and make the target
 * again; an exceeded Master Route cap is a short, explicit challenge failure.
 */
export function checkRouteRemixCompletion(
  runtimeCandidate,
  progressCandidate,
  result = ""
) {
  const runtime = sanitizeRouteRemixRuntime(runtimeCandidate);
  const progress = sanitizeRouteRemixProgress(progressCandidate);
  if (progress.answerRevealed) {
    return Object.freeze({
      complete: false,
      failed: false,
      status: "study",
      code: "answer_revealed",
      reason: "The answer was shown, so scoring is off.",
      blockers: Object.freeze([])
    });
  }
  const reachedTarget = wordKey(result || progress.lastResult) === wordKey(runtime.target);
  if (!reachedTarget) {
    return Object.freeze({
      complete: false,
      failed: false,
      status: "continue",
      code: "target_not_reached",
      reason: "",
      blockers: Object.freeze([])
    });
  }
  const blockers = completionBlockers(runtime, progress);
  if (!blockers.length) {
    return Object.freeze({
      complete: true,
      failed: false,
      status: "complete",
      code: "complete",
      reason: "Route complete.",
      blockers: Object.freeze([])
    });
  }
  const terminal = blockers.some((blocker) => blocker.terminal);
  return Object.freeze({
    complete: false,
    failed: terminal,
    status: terminal ? "failed" : "continue",
    code: blockers[0].code,
    reason: blockers[0].reason,
    blockers: Object.freeze(blockers.map((blocker) => Object.freeze({ ...blocker })))
  });
}

/**
 * Marks a zero-score Reveal as visually finished without claiming that the
 * player satisfied the scored route constraints. Completion validation
 * deliberately returns `answer_revealed` for this state.
 */
export function markRouteRemixAnswerRevealed(progressCandidate) {
  const progress = sanitizeRouteRemixProgress(progressCandidate);
  return sanitizeRouteRemixProgress({
    ...progress,
    targetPending: false,
    pendingTargetPair: "",
    answerRevealed: true
  });
}

export function routeRemixProgress(runtimeCandidate, progressCandidate) {
  const runtime = sanitizeRouteRemixRuntime(runtimeCandidate);
  const progress = sanitizeRouteRemixProgress(progressCandidate);
  const items = [];
  const waypoint = runtime.constraints.required_waypoint;
  if (waypoint) {
    const complete = progress.discoveredWords.includes(waypoint.wordKey);
    items.push({
      family: "required_waypoint",
      complete,
      text: complete ? `${waypoint.word} reached` : `Make ${waypoint.word}`
    });
  }
  const forbidden = runtime.constraints.forbidden_shortcut;
  if (forbidden) {
    items.push({
      family: "forbidden_shortcut",
      complete: true,
      text: `${pairLabel(forbidden.a, forbidden.b)} closed`
    });
  }
  const master = runtime.constraints.master_route;
  if (master) {
    items.push({
      family: "master_route",
      complete: progress.moves <= master.moveCap,
      text: `${progress.moves}/${master.moveCap} fusions`
    });
  }
  const graphRule = runtime.constraints.graph_safe_rule;
  if (graphRule) {
    items.push({
      family: "graph_safe_rule",
      complete: !graphRule.requireTwin || progress.twinPairUsed,
      text: graphRule.requireTwin
        ? (progress.twinPairUsed ? "Matching pair used" : "Use a matching pair")
        : "No repeated fusions"
    });
  }
  const orbit = runtime.constraints.orbit_chain;
  if (orbit) {
    items.push({
      family: "orbit_chain",
      complete: progress.orbitComplete,
      text: `${Math.min(progress.orbitPosition, orbit.length)}/${orbit.length} chain`
    });
  }
  const required = items.filter((item) => item.family !== "forbidden_shortcut");
  const completeCount = required.filter((item) => item.complete).length;
  const requirementsReady = required.length === completeCount;
  const rulesComplete = requirementsReady && !progress.targetPending;
  return Object.freeze({
    complete: progress.answerRevealed || rulesComplete,
    rulesComplete,
    studyComplete: progress.answerRevealed,
    targetRetryRequired: progress.targetPending,
    completeCount,
    total: required.length,
    items: Object.freeze(items.map((item) => Object.freeze(item))),
    summary: progress.answerRevealed
      ? "Answer shown · score off"
      : progress.targetPending && requirementsReady
        ? `Make ${runtime.target} again`
      : required.length
        ? `${completeCount}/${required.length} route rules`
        : "Classic route"
  });
}
