export const PATH_GUARD_VERSION = 1;
export const PATH_GUARD_RANKS = Object.freeze(["bronze", "silver"]);
export const PATH_GUARD_TARGET_MODES = Object.freeze(["reach"]);

const MAX_WORD_LENGTH = 80;
const MAX_ROUTE_STEPS = 256;
const MAX_PAIR_EVIDENCE = 512;
const MAX_AVAILABLE_WORDS = 1_500;
const MAX_ROUTE_DEPTH = 80;
const EVIDENCE_KIND = "constellore-path-guard-evidence";
const createdEvidence = new WeakSet();
const guardedRanks = new Set(PATH_GUARD_RANKS);
const guardedModes = new Set(PATH_GUARD_TARGET_MODES);

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

function ownArrayValue(value, index) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    return descriptor && Object.hasOwn(descriptor, "value")
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function safeList(value, maximum, mapMode = "values") {
  try {
    if (Array.isArray(value)) {
      const length = Math.min(maximum, Math.max(0, Number(value.length) || 0));
      const result = [];
      for (let index = 0; index < length; index += 1) {
        result.push(ownArrayValue(value, index));
      }
      return result;
    }
    if (value instanceof Set) {
      const result = [];
      const iterator = Set.prototype.values.call(value);
      for (let next = iterator.next(); !next.done && result.length < maximum; next = iterator.next()) {
        result.push(next.value);
      }
      return result;
    }
    if (value instanceof Map) {
      const result = [];
      const iterator = mapMode === "keys"
        ? Map.prototype.keys.call(value)
        : Map.prototype.values.call(value);
      for (let next = iterator.next(); !next.done && result.length < maximum; next = iterator.next()) {
        result.push(next.value);
      }
      return result;
    }
  } catch {
    return [];
  }
  return [];
}

function cleanWord(value) {
  let source = value;
  if (typeof source !== "string") source = ownDataValue(source, "word");
  if (typeof source !== "string") return "";
  try {
    return source
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, MAX_WORD_LENGTH);
  } catch {
    return "";
  }
}

function wordKey(value) {
  try {
    return cleanWord(value).toLocaleLowerCase("en-US");
  } catch {
    return "";
  }
}

function normalizedIdentifier(value, maximum = 40) {
  const source = typeof value === "string"
    ? value
    : ownDataValue(value, "id") ?? ownDataValue(value, "rankId");
  if (typeof source !== "string") return "";
  try {
    return source
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("en-US")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, maximum);
  } catch {
    return "";
  }
}

/**
 * Produces an opaque, order-independent key for an exact pair of words.
 */
export function pathGuardPairKey(a, b) {
  const left = wordKey(a);
  const right = wordKey(b);
  if (!left || !right) return "";
  return JSON.stringify([left, right].sort());
}

function pairFromKey(value, source = "provided", result = "") {
  if (typeof value !== "string" || value.length > (MAX_WORD_LENGTH * 2) + 16) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const key = pathGuardPairKey(parsed[0], parsed[1]);
    if (!key || key !== value) return null;
    const names = JSON.parse(key);
    return Object.freeze({
      a: names[0],
      b: names[1],
      key,
      result: cleanWord(result),
      source
    });
  } catch {
    return null;
  }
}

function pairRecord(value, source = "provided", result = "") {
  if (typeof value === "string") return pairFromKey(value, source, result);
  let a;
  let b;
  try {
    if (Array.isArray(value)) {
      a = ownArrayValue(value, 0);
      b = ownArrayValue(value, 1);
    } else {
      a = ownDataValue(value, "a");
      b = ownDataValue(value, "b");
    }
  } catch {
    return null;
  }
  const cleanA = cleanWord(a);
  const cleanB = cleanWord(b);
  const key = pathGuardPairKey(cleanA, cleanB);
  if (!key) return null;
  return Object.freeze({
    a: cleanA,
    b: cleanB,
    key,
    result: cleanWord(result || ownDataValue(value, "word") || ownDataValue(value, "result")),
    source
  });
}

function pairRecords(value, source) {
  const result = [];
  const seen = new Set();
  for (const candidate of safeList(value, MAX_PAIR_EVIDENCE)) {
    const pair = pairRecord(candidate, source);
    if (!pair || seen.has(pair.key)) continue;
    seen.add(pair.key);
    result.push(pair);
  }
  return result;
}

function routeStep(value) {
  const source = safeRecord(value);
  if (!source) return null;
  const a = cleanWord(ownDataValue(source, "a"));
  const b = cleanWord(ownDataValue(source, "b"));
  const word = cleanWord(ownDataValue(source, "word"));
  const pairKey = pathGuardPairKey(a, b);
  const resultKey = wordKey(word);
  if (!a || !b || !word || !pairKey || !resultKey) return null;
  return Object.freeze({ a, b, word, pairKey, resultKey });
}

function routeEvidence(rawRoute, rawAvailable, target) {
  const rawSteps = safeList(rawRoute, MAX_ROUTE_STEPS);
  const routeProvided = rawSteps.length > 0;
  const steps = [];
  const byResult = new Map();
  let malformed = false;
  let ambiguous = false;

  for (const candidate of rawSteps) {
    const step = routeStep(candidate);
    if (!step) {
      malformed = true;
      continue;
    }
    const prior = byResult.get(step.resultKey);
    if (prior) {
      if (prior.pairKey !== step.pairKey) ambiguous = true;
      continue;
    }
    byResult.set(step.resultKey, step);
    steps.push(step);
  }

  const available = new Set();
  for (const candidate of safeList(rawAvailable, MAX_AVAILABLE_WORDS, "keys")) {
    const key = wordKey(candidate);
    if (key) available.add(key);
  }

  const targetKey = wordKey(target);
  const routeComplete = Boolean(targetKey && available.has(targetKey));
  const required = [];
  const completed = [];
  const visiting = new Set();
  const solved = new Set();
  let cyclic = false;
  let missingDependency = false;
  let tooDeep = false;

  const solve = (resultKey, depth = 0) => {
    if (solved.has(resultKey)) return true;
    if (depth >= MAX_ROUTE_DEPTH) {
      tooDeep = true;
      return false;
    }
    if (visiting.has(resultKey)) {
      cyclic = true;
      return false;
    }
    const step = byResult.get(resultKey);
    if (available.has(resultKey)) {
      if (step) completed.push(step);
      solved.add(resultKey);
      return true;
    }
    if (!step) {
      missingDependency = true;
      return false;
    }
    visiting.add(resultKey);
    const left = solve(wordKey(step.a), depth + 1);
    const right = left && (wordKey(step.a) === wordKey(step.b)
      ? true
      : solve(wordKey(step.b), depth + 1));
    visiting.delete(resultKey);
    if (!left || !right) return false;
    required.push(step);
    solved.add(resultKey);
    return true;
  };

  const resolved = Boolean(
    routeProvided
    && targetKey
    && !malformed
    && !ambiguous
    && solve(targetKey)
    && !cyclic
    && !missingDependency
    && !tooDeep
  );

  const expectedPairs = [];
  const completedPairs = [];
  if (resolved && !routeComplete) {
    const expectedSeen = new Set();
    for (const step of required) {
      if (
        !available.has(step.resultKey)
        && available.has(wordKey(step.a))
        && available.has(wordKey(step.b))
        && !expectedSeen.has(step.pairKey)
      ) {
        expectedSeen.add(step.pairKey);
        expectedPairs.push(pairRecord(
          { a: step.a, b: step.b },
          "route",
          step.word
        ));
      }
    }
    const completedSeen = new Set();
    for (const step of completed) {
      if (step.resultKey === targetKey || completedSeen.has(step.pairKey)) continue;
      completedSeen.add(step.pairKey);
      completedPairs.push(pairRecord(
        { a: step.a, b: step.b },
        "route-completed",
        step.word
      ));
    }
  }

  return Object.freeze({
    provided: routeProvided,
    valid: resolved,
    complete: routeComplete,
    expectedPairs: Object.freeze(expectedPairs.filter(Boolean)),
    completedPairs: Object.freeze(completedPairs.filter(Boolean))
  });
}

function mergePairs(...groups) {
  const merged = [];
  const seen = new Set();
  for (const group of groups) {
    for (const pair of group) {
      if (!pair || seen.has(pair.key)) continue;
      seen.add(pair.key);
      merged.push(pair);
    }
  }
  return Object.freeze(merged);
}

/**
 * Sanitizes exact route evidence into a deeply immutable allowlist-only model.
 *
 * A solution route is not presumed exhaustive. Callers must explicitly mark
 * evidence both `authoritative` and `exhaustive` before an unlisted pair can be
 * rejected. An exact `deadEndPairs` entry only requires `authoritative`.
 */
export function createPathGuardEvidence(rawEvidence = {}) {
  const source = safeRecord(rawEvidence);
  const target = cleanWord(ownDataValue(source, "target"));
  const rawRoute = ownDataValue(source, "solutionRoute") ?? ownDataValue(source, "route");
  const route = routeEvidence(
    rawRoute,
    ownDataValue(source, "available"),
    target
  );
  const explicitExpected = mergePairs(
    pairRecords(ownDataValue(source, "expectedPairs"), "expected"),
    pairRecords(ownDataValue(source, "allowedPairs"), "expected")
  );
  const deadEndPairs = mergePairs(
    pairRecords(ownDataValue(source, "deadEndPairs"), "dead-end"),
    pairRecords(ownDataValue(source, "irrelevantPairs"), "dead-end")
  );
  const evidence = Object.freeze({
    kind: EVIDENCE_KIND,
    version: PATH_GUARD_VERSION,
    authoritative: ownDataValue(source, "authoritative") === true,
    exhaustive: ownDataValue(source, "exhaustive") === true,
    target,
    targetKey: wordKey(target),
    expectedPairs: mergePairs(route.expectedPairs, explicitExpected),
    deadEndPairs,
    completedPairs: route.completedPairs,
    route
  });
  createdEvidence.add(evidence);
  return evidence;
}

function recordsFromContext(value) {
  const direct = safeRecord(value);
  const state = safeRecord(ownDataValue(direct, "state")) || direct;
  const game = safeRecord(ownDataValue(state, "game"))
    || safeRecord(ownDataValue(direct, "game"));
  const run = safeRecord(ownDataValue(state, "run"))
    || safeRecord(ownDataValue(direct, "run"));
  const profile = safeRecord(ownDataValue(direct, "profile"))
    || safeRecord(ownDataValue(state, "profile"));
  return { direct, state, game, run, profile };
}

function firstOwn(records, keys) {
  for (const record of records) {
    for (const key of keys) {
      const value = ownDataValue(record, key);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

function allOwn(records, keys) {
  const result = [];
  for (const record of records) {
    for (const key of keys) {
      const value = ownDataValue(record, key);
      if (value !== undefined) result.push(value);
    }
  }
  return result;
}

function nestedRank(records) {
  const direct = firstOwn(records, ["rankId", "rank"]);
  let rankId = normalizedIdentifier(direct);
  if (rankId) return rankId;

  for (const record of records) {
    const progression = safeRecord(ownDataValue(record, "routeProgression"));
    rankId = normalizedIdentifier(
      ownDataValue(progression, "rankId") ?? ownDataValue(progression, "rank")
    );
    if (rankId) return rankId;

    const remixes = safeRecord(ownDataValue(record, "remixes"));
    rankId = normalizedIdentifier(
      ownDataValue(remixes, "rankId") ?? ownDataValue(remixes, "rank")
    );
    if (rankId) return rankId;
  }
  return "";
}

function anyStrictTrue(values) {
  return values.some((value) => value === true);
}

function includesStrictFalse(values) {
  return values.some((value) => value === false);
}

function listHasItems(value) {
  return safeList(value, 1).length > 0;
}

function assistedPowerupActive(state) {
  const powerups = safeRecord(ownDataValue(state, "powerups"));
  const sense = safeRecord(ownDataValue(state, "sense"));
  const tipsUsed = ownDataValue(powerups, "tipsUsed");
  return (
    ownDataValue(state, "wished") === true
    || ownDataValue(powerups, "giftUsed") === true
    || ownDataValue(powerups, "giftItem") != null
    || cleanWord(ownDataValue(powerups, "currentTip")) !== ""
    || (typeof tipsUsed === "number" && Number.isFinite(tipsUsed) && tipsUsed > 0)
    || listHasItems(ownDataValue(powerups, "tipIds"))
    || ownDataValue(sense, "active") === true
  );
}

function revealActive(state, direct) {
  const reveal = safeRecord(ownDataValue(state, "reveal"))
    || safeRecord(ownDataValue(direct, "reveal"));
  return anyStrictTrue(allOwn(
    [reveal],
    ["active", "pending", "revealed", "replaying", "replayUsed"]
  ));
}

function inactiveEligibility(reason, rankId = "", mode = "", target = "") {
  return Object.freeze({
    active: false,
    reason,
    rankId,
    mode,
    target,
    targetKey: wordKey(target)
  });
}

/**
 * Enables guarding only for an explicitly unassisted Bronze/Silver solo target
 * run. Unknown state always fails open.
 */
export function pathGuardEligibility(context = {}) {
  const { direct, state, game, run, profile } = recordsFromContext(context);
  if (!direct || !state) return inactiveEligibility("missing-context");
  const records = [direct, state, game, run, profile].filter(Boolean);

  const rankId = nestedRank(records);
  if (!rankId) return inactiveEligibility("rank-unavailable");
  if (!guardedRanks.has(rankId)) return inactiveEligibility("rank-unrestricted", rankId);

  const mode = normalizedIdentifier(firstOwn([direct, state, game, run], ["mode"]));
  if (!mode) return inactiveEligibility("mode-unavailable", rankId);
  if (!guardedModes.has(mode)) return inactiveEligibility("mode-unrestricted", rankId, mode);

  const target = cleanWord(firstOwn([direct, state, game, run], ["target"]));
  if (!target) return inactiveEligibility("target-unavailable", rankId, mode);

  if (anyStrictTrue(allOwn([direct, state, game, run], ["ranked", "practiceReplay"]))) {
    return inactiveEligibility("competitive-or-replay", rankId, mode, target);
  }
  for (const record of [direct, state, game, run]) {
    const remixes = safeRecord(ownDataValue(record, "remixes"));
    const promotion = safeRecord(ownDataValue(record, "promotion"));
    const activeCount = Number(ownDataValue(remixes, "activeCount"));
    if (
      (Number.isFinite(activeCount) && activeCount > 0)
      || listHasItems(ownDataValue(remixes, "rules"))
      || ownDataValue(promotion, "active") === true
    ) {
      return inactiveEligibility("remix-or-promotion", rankId, mode, target);
    }
  }

  const assists = allOwn([direct, state, run, game], ["assist"]);
  const normalizedAssists = assists.map((value) => normalizedIdentifier(value));
  if (!normalizedAssists.includes("none")) {
    return inactiveEligibility("assist-unavailable", rankId, mode, target);
  }
  if (normalizedAssists.some((assist) => assist && assist !== "none")) {
    return inactiveEligibility("assisted-flow", rankId, mode, target);
  }

  const scoringStates = allOwn([direct, state, run, game], ["scoringDisabled"]);
  if (!includesStrictFalse(scoringStates)) {
    return inactiveEligibility("scoring-state-unavailable", rankId, mode, target);
  }
  if (
    anyStrictTrue(scoringStates)
    || allOwn([direct, state, run, game], ["scoreEligible"]).some((value) => value === false)
    || anyStrictTrue(allOwn([direct, state, run, game], ["assisted"]))
  ) {
    return inactiveEligibility("assisted-flow", rankId, mode, target);
  }

  const finishedStates = allOwn([direct, state], ["finished"]);
  if (!includesStrictFalse(finishedStates)) {
    return inactiveEligibility("finished-state-unavailable", rankId, mode, target);
  }
  if (anyStrictTrue(finishedStates)) {
    return inactiveEligibility("finished", rankId, mode, target);
  }

  if (
    anyStrictTrue(allOwn(
      [direct, state, game, run],
      ["tutorial", "training", "learningOrbit", "firstOrbit", "secondOrbit"]
    ))
  ) {
    return inactiveEligibility("tutorial-or-training", rankId, mode, target);
  }
  if (revealActive(state, direct)) {
    return inactiveEligibility("reveal", rankId, mode, target);
  }
  if (
    anyStrictTrue(allOwn(
      [direct, state, game, run],
      ["multiplayer", "competitive", "duel", "scramble"]
    ))
  ) {
    return inactiveEligibility("multiplayer", rankId, mode, target);
  }
  if (assistedPowerupActive(state)) {
    return inactiveEligibility("assisted-flow", rankId, mode, target);
  }

  return Object.freeze({
    active: true,
    reason: "eligible",
    rankId,
    mode,
    target,
    targetKey: wordKey(target)
  });
}

function isCreatedEvidence(value) {
  try {
    return createdEvidence.has(value);
  } catch {
    return false;
  }
}

function pairKeySet(pairs) {
  return new Set(pairs.map((pair) => pair.key));
}

function decision({
  active,
  blocked = false,
  reason,
  pairKey = "",
  message = "",
  confidence = "none"
}) {
  return Object.freeze({
    active,
    blocked,
    action: blocked ? "reject" : "pass",
    reason,
    confidence,
    pairKey,
    message
  });
}

/**
 * Decides whether a pairing should be rejected before a move is consumed.
 * Every uncertainty, malformed input, policy exclusion, or evidence mismatch
 * passes through unchanged.
 */
export function evaluatePathGuard(context, pairing, rawEvidence = {}) {
  const eligibility = pathGuardEligibility(context);
  if (!eligibility.active) {
    return decision({ active: false, reason: eligibility.reason });
  }

  const pair = pairRecord(pairing, "attempt");
  if (!pair) return decision({ active: true, reason: "invalid-pair" });

  const evidence = isCreatedEvidence(rawEvidence)
    ? rawEvidence
    : createPathGuardEvidence(rawEvidence);
  if (
    !evidence.targetKey
    || evidence.targetKey !== eligibility.targetKey
  ) {
    return decision({
      active: true,
      reason: "evidence-target-mismatch",
      pairKey: pair.key
    });
  }
  if (!evidence.authoritative) {
    return decision({
      active: true,
      reason: "evidence-not-authoritative",
      pairKey: pair.key
    });
  }
  if (evidence.route.complete) {
    return decision({
      active: true,
      reason: "target-already-complete",
      pairKey: pair.key
    });
  }

  const expected = pairKeySet(evidence.expectedPairs);
  const deadEnds = pairKeySet(evidence.deadEndPairs);
  const completed = pairKeySet(evidence.completedPairs);

  // A conflict passes: positive evidence always wins over negative evidence.
  if (expected.has(pair.key)) {
    return decision({
      active: true,
      reason: "expected-pair",
      pairKey: pair.key,
      confidence: "authoritative"
    });
  }
  if (deadEnds.has(pair.key)) {
    return decision({
      active: true,
      blocked: true,
      reason: "authoritative-dead-end",
      pairKey: pair.key,
      confidence: "authoritative",
      message: "That pairing cannot advance this route. Try another connection."
    });
  }
  if (completed.has(pair.key)) {
    return decision({
      active: true,
      blocked: true,
      reason: "completed-route-pair",
      pairKey: pair.key,
      confidence: "authoritative",
      message: "You already forged what that pairing makes. Try a new connection."
    });
  }
  if (evidence.exhaustive && expected.size > 0) {
    return decision({
      active: true,
      blocked: true,
      reason: "outside-exhaustive-route",
      pairKey: pair.key,
      confidence: "authoritative",
      message: "That pairing cannot advance this challenge. Try another connection."
    });
  }
  return decision({
    active: true,
    reason: "insufficient-evidence",
    pairKey: pair.key
  });
}

export function shouldPathGuardReject(context, pairing, evidence) {
  return evaluatePathGuard(context, pairing, evidence).blocked;
}
