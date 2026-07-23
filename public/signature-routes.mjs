export const SIGNATURE_ROUTE_VERSION = 1;
export const MAX_SIGNATURE_ROUTE_STEPS = 64;
export const MAX_SIGNATURE_STEP_FINGERPRINTS = 32;
export const MAX_SIGNATURE_WORD_LENGTH = 80;
export const MAX_SIGNATURE_PAYLOAD_BYTES = 2_048;

export const SIGNATURE_ROUTE_TIERS = Object.freeze([
  Object.freeze({ id: "spark", label: "Stellar Spark", at: 0 }),
  Object.freeze({ id: "orbit", label: "Orbit Route", at: 45 }),
  Object.freeze({ id: "constellation", label: "Constellation Route", at: 65 }),
  Object.freeze({ id: "nova", label: "Nova Route", at: 80 }),
  Object.freeze({ id: "singularity", label: "Singularity Route", at: 92 })
]);

const UNFINISHED_TIER = Object.freeze({ id: "unfinished", label: "Unfinished Route", at: 0 });
const STUDY_TIER = Object.freeze({ id: "study", label: "Study Route", at: 0 });
const MAX_RECORDED_MOVES = 1_000;
const MAX_CONTEXT_LENGTH = 40;
const MAX_CHALLENGE_LENGTH = 160;
const SIGNATURE_KIND = "constellore-route-signature";

const ASSISTANCE = Object.freeze({
  none: Object.freeze({ id: "none", multiplier: 1, eligible: true }),
  tip: Object.freeze({ id: "tip", multiplier: 1, eligible: true }),
  open: Object.freeze({ id: "open", multiplier: .85, eligible: true }),
  wish: Object.freeze({ id: "wish", multiplier: .8, eligible: true }),
  market: Object.freeze({ id: "market", multiplier: .8, eligible: true }),
  ai: Object.freeze({ id: "ai", multiplier: .8, eligible: true }),
  sense: Object.freeze({ id: "sense", multiplier: .75, eligible: true }),
  gift: Object.freeze({ id: "gift", multiplier: .5, eligible: true }),
  reveal: Object.freeze({ id: "reveal", multiplier: 0, eligible: false }),
  training: Object.freeze({ id: "training", multiplier: 0, eligible: false })
});

const KNOWN_SOURCES = new Set([
  "origin", "world", "expanded", "twist", "semantic", "ai", "ai-route",
  "wish", "market", "gift", "reveal", "training", "unknown"
]);

const MODES = new Set(["reach", "quick", "moves", "daily", "weekly", "challenge", "custom", "practice"]);
const RARITY_SCORES = Object.freeze({ common: 10, uncommon: 35, rare: 65, epic: 85, legendary: 100, mythic: 100 });

function finiteNumber(value) {
  try {
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
  } catch {
    return NaN;
  }
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = finiteNumber(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function clampScore(value, fallback = 0) {
  const number = finiteNumber(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function cleanText(value, maximum = MAX_SIGNATURE_WORD_LENGTH) {
  if (!["string", "number", "bigint"].includes(typeof value)) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanWord(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) value = value.word ?? value.label ?? "";
  return cleanText(value, MAX_SIGNATURE_WORD_LENGTH);
}

function wordKey(value) {
  return cleanWord(value).toLocaleLowerCase("en-US");
}

function stableWordOrder(left, right) {
  const leftKey = wordKey(left);
  const rightKey = wordKey(right);
  if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}

function cleanLabel(value, maximum = MAX_CONTEXT_LENGTH) {
  return cleanText(value, maximum)
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function booleanFlag(value) {
  return value === true || value === 1 || value === "true";
}

function routeEntries(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  for (const candidate of [raw.history, raw.route, raw.steps, raw.combinations]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function stepParts(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const recipe = source.recipe && typeof source.recipe === "object" && !Array.isArray(source.recipe) ? source.recipe : null;
  const ingredients = source.ingredients
    || source.inputs
    || source.parents
    || recipe?.ingredients
    || recipe?.inputs
    || recipe?.parents;
  const resultObject = source.result && typeof source.result === "object" && !Array.isArray(source.result) ? source.result : null;
  const a = cleanWord(source.a ?? source.left ?? source.inputA ?? recipe?.a ?? recipe?.left ?? ingredients?.[0]);
  const b = cleanWord(source.b ?? source.right ?? source.inputB ?? recipe?.b ?? recipe?.right ?? ingredients?.[1]);
  const word = cleanWord(
    source.word
    ?? (typeof source.result === "string" ? source.result : null)
    ?? source.output
    ?? resultObject?.word
    ?? recipe?.word
    ?? recipe?.result
  );
  if (!a || !b || !word) return null;

  const pair = [a, b].sort(stableWordOrder);
  const sourceName = cleanLabel(source.source ?? resultObject?.source ?? recipe?.source, 24);
  const normalizedSource = KNOWN_SOURCES.has(sourceName) ? sourceName : "unknown";
  const category = cleanLabel(source.category ?? resultObject?.category ?? recipe?.category, 32);
  const contextObject = source.universeContext && typeof source.universeContext === "object" && !Array.isArray(source.universeContext)
    ? source.universeContext
    : null;
  const context = cleanLabel(
    source.contextId
    ?? source.context
    ?? contextObject?.id
    ?? contextObject?.ruleId
    ?? contextObject?.kind,
    MAX_CONTEXT_LENGTH
  );
  const twisted = booleanFlag(source.twisted) || normalizedSource === "twist";
  const contextual = twisted
    || booleanFlag(source.contextual)
    || normalizedSource === "semantic"
    || normalizedSource === "ai-route"
    || Boolean(context);
  const discoveryValue = source.newDiscovery ?? source.novel;
  const newDiscovery = typeof discoveryValue === "boolean" ? discoveryValue : null;

  return {
    a: pair[0],
    b: pair[1],
    word,
    category,
    source: normalizedSource,
    newDiscovery,
    rarity: normalizeRarity(source.rarity ?? resultObject?.rarity ?? recipe?.rarity),
    contextual,
    context,
    twisted
  };
}

function normalizeRarity(value) {
  if (typeof value === "string") {
    const label = cleanLabel(value, 16);
    if (Object.hasOwn(RARITY_SCORES, label)) return RARITY_SCORES[label];
    if (!/^\d+(?:\.\d+)?$/.test(label)) return 0;
  }
  const number = finiteNumber(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return clampScore(number <= 1 ? number * 100 : number);
}

/**
 * Returns a small, fixed-shape copy of playable route history. Notes, tokens,
 * player fields, timestamps, and unknown metadata are deliberately discarded.
 */
export function sanitizeRouteHistory(raw, { limit = MAX_SIGNATURE_ROUTE_STEPS } = {}) {
  const maximum = clampInteger(limit, 1, MAX_SIGNATURE_ROUTE_STEPS, MAX_SIGNATURE_ROUTE_STEPS);
  const sanitized = [];
  const entries = routeEntries(raw);
  for (let index = 0; index < entries.length && sanitized.length < maximum; index += 1) {
    const step = stepParts(entries[index]);
    if (step) sanitized.push(step);
  }
  return sanitized;
}

function hashNumber(value, seed) {
  let hash = seed >>> 0;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fingerprint(prefix, value) {
  const left = hashNumber(value, 2166136261).toString(36).padStart(7, "0");
  const right = hashNumber(value, 3335557771).toString(36).padStart(7, "0");
  return `${prefix}-${left}${right}`;
}

function canonicalStep(step) {
  return [
    wordKey(step.a), wordKey(step.b), wordKey(step.word), step.category, step.source,
    step.newDiscovery, step.rarity, step.contextual, step.context, step.twisted
  ];
}

function policyForMultiplier(value) {
  if (value <= 0) return ASSISTANCE.training;
  if (value <= ASSISTANCE.gift.multiplier) return ASSISTANCE.gift;
  if (value <= ASSISTANCE.sense.multiplier) return ASSISTANCE.sense;
  if (value <= ASSISTANCE.ai.multiplier) return ASSISTANCE.ai;
  if (value <= ASSISTANCE.open.multiplier) return ASSISTANCE.open;
  return ASSISTANCE.none;
}

function assistanceFrom(raw, history) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const run = source.run && typeof source.run === "object" && !Array.isArray(source.run) ? source.run : {};
  const rawAssist = source.assist ?? source.assistance ?? run.assist ?? run.assistance;
  const requested = cleanLabel(rawAssist && typeof rawAssist === "object" ? rawAssist.id : rawAssist, 24);
  let policy = requested ? (Object.hasOwn(ASSISTANCE, requested) ? ASSISTANCE[requested] : ASSISTANCE.open) : ASSISTANCE.none;

  const consider = (next) => {
    if (next.multiplier < policy.multiplier || (!next.eligible && policy.eligible)) policy = next;
  };
  if (booleanFlag(source.assisted ?? run.assisted) && policy.id === "none") consider(ASSISTANCE.open);
  for (const step of history) {
    if (step.source === "ai" || step.source === "ai-route") consider(ASSISTANCE.ai);
    else if (step.source === "wish") consider(ASSISTANCE.wish);
    else if (step.source === "market") consider(ASSISTANCE.market);
    else if (step.source === "gift") consider(ASSISTANCE.gift);
    else if (step.source === "reveal") consider(ASSISTANCE.reveal);
    else if (step.source === "training") consider(ASSISTANCE.training);
  }
  if (booleanFlag(source.revealed ?? run.revealed)) consider(ASSISTANCE.reveal);
  if (booleanFlag(source.scoringDisabled ?? run.scoringDisabled) || booleanFlag(source.forfeited ?? run.forfeited)) {
    consider(ASSISTANCE.training);
  }

  const multiplierValue = source.scoreMultiplier ?? run.scoreMultiplier;
  const parsedMultiplier = finiteNumber(multiplierValue);
  const hasMultiplier = multiplierValue !== "" && multiplierValue != null && Number.isFinite(parsedMultiplier);
  const multiplier = hasMultiplier
    ? Math.min(policy.multiplier, Math.max(0, Math.min(1, parsedMultiplier)))
    : policy.multiplier;
  if (multiplier < policy.multiplier) policy = policyForMultiplier(multiplier);
  return {
    id: policy.id,
    multiplier,
    eligible: policy.eligible && multiplier > 0
  };
}

function explicitIdealMoves(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  const game = raw.game && typeof raw.game === "object" && !Array.isArray(raw.game) ? raw.game : {};
  for (const value of [raw.optimalMoves, raw.idealMoves, raw.parMoves, raw.routeLength, raw.solutionLength, game.optimalMoves, game.parMoves]) {
    const number = finiteNumber(value);
    if (Number.isFinite(number) && number > 0) return clampInteger(number, 1, MAX_RECORDED_MOVES, 1);
  }
  return 0;
}

function targetFrom(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const game = raw.game && typeof raw.game === "object" && !Array.isArray(raw.game) ? raw.game : {};
  return cleanWord(raw.target ?? game.target);
}

function tierCopy(tier) {
  return { id: tier.id, label: tier.label, at: tier.at };
}

export function signatureTierForScore(value) {
  const score = clampScore(value);
  return tierCopy([...SIGNATURE_ROUTE_TIERS].reverse().find((tier) => score >= tier.at) || SIGNATURE_ROUTE_TIERS[0]);
}

/**
 * Grades a completed route. Performance is built from efficiency, novelty,
 * and contextual variety, then the existing assistance rate is applied to the
 * whole result. Study/revealed routes remain descriptive but score zero.
 */
export function gradeSignatureRoute(raw = {}) {
  const entries = routeEntries(raw);
  const history = sanitizeRouteHistory(raw);
  const target = targetFrom(raw);
  const finalWord = history.at(-1)?.word || "";
  const inferredCompletion = Boolean(target && wordKey(target) === wordKey(finalWord));
  const completed = Boolean(raw && typeof raw === "object" && !Array.isArray(raw)
    && (raw.completed === true || raw.won === true || inferredCompletion));
  const gradable = completed && history.length > 0;
  const statedMoves = raw && typeof raw === "object" && !Array.isArray(raw) ? finiteNumber(raw.moves) : NaN;
  const observedMoves = Math.max(history.length, Math.min(entries.length, MAX_RECORDED_MOVES));
  const moves = Number.isFinite(statedMoves)
    ? Math.max(observedMoves, clampInteger(statedMoves, 0, MAX_RECORDED_MOVES, observedMoves))
    : observedMoves;

  const resultKeys = new Set();
  const pairKeys = new Set();
  const categories = new Set();
  const contexts = new Set();
  let newDiscoveries = 0;
  let contextualSteps = 0;
  let rarityTotal = 0;
  for (const step of history) {
    const resultKey = wordKey(step.word);
    const firstResult = !resultKeys.has(resultKey);
    resultKeys.add(resultKey);
    pairKeys.add(JSON.stringify([wordKey(step.a), wordKey(step.b)]));
    if (step.category) categories.add(step.category);
    if (firstResult && step.newDiscovery !== false) newDiscoveries += 1;
    if (step.contextual) {
      contextualSteps += 1;
      contexts.add(step.context || step.source || step.category || "contextual");
    }
    rarityTotal += step.rarity;
  }

  const denominator = Math.max(1, moves);
  const uniqueResults = resultKeys.size;
  const uniquePairs = pairKeys.size;
  const inferredIdeal = Math.max(1, Math.min(denominator, uniqueResults || history.length || 1));
  const idealMoves = explicitIdealMoves(raw) || inferredIdeal;
  const pace = Math.min(1, idealMoves / denominator);
  const productive = Math.min(1, uniqueResults / denominator);
  const pairEfficiency = Math.min(1, uniquePairs / denominator);
  const efficiency = clampScore((pace * .65 + productive * .25 + pairEfficiency * .1) * 100);

  const discoveryRatio = Math.min(1, newDiscoveries / denominator);
  const resultDiversity = Math.min(1, uniqueResults / denominator);
  const pairDiversity = Math.min(1, uniquePairs / denominator);
  const novelty = clampScore((discoveryRatio * .7 + resultDiversity * .2 + pairDiversity * .1) * 100);

  const categoryGoal = Math.max(1, Math.min(4, denominator));
  const categoryVariety = Math.min(1, categories.size / categoryGoal);
  const contextGoal = Math.max(1, Math.min(3, denominator));
  const contextVariety = Math.min(1, Math.max(contextualSteps, contexts.size) / contextGoal);
  const averageRarity = Math.min(1, rarityTotal / denominator / 100);
  const variety = clampScore((resultDiversity * .25 + categoryVariety * .4 + contextVariety * .2 + averageRarity * .15) * 100);

  const assistance = assistanceFrom(raw, history);
  const purity = clampScore(assistance.multiplier * 100);
  const performance = efficiency * .38 + novelty * .32 + variety * .3;
  const total = gradable && assistance.eligible ? clampScore(performance * assistance.multiplier) : 0;
  const tier = !gradable ? UNFINISHED_TIER : !assistance.eligible ? STUDY_TIER : signatureTierForScore(total);

  return {
    version: SIGNATURE_ROUTE_VERSION,
    completed,
    gradable,
    scoreEligible: gradable && assistance.eligible,
    total,
    tier: tierCopy(tier),
    dimensions: { efficiency, novelty, variety, purity },
    metrics: {
      moves,
      idealMoves,
      uniqueResults,
      uniquePairs,
      newDiscoveries,
      categories: categories.size,
      contextualSteps,
      rareSteps: history.filter((step) => step.rarity >= RARITY_SCORES.rare).length,
      assist: assistance.id,
      scoreMultiplier: Math.round(assistance.multiplier * 100) / 100,
      truncated: entries.length > history.length
    }
  };
}

function normalizedMode(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "practice";
  const game = raw.game && typeof raw.game === "object" && !Array.isArray(raw.game) ? raw.game : {};
  const mode = cleanLabel(raw.mode ?? game.mode, 24);
  return MODES.has(mode) ? mode : "practice";
}

function sampledStepFingerprints(history) {
  const marks = history.map((step) => fingerprint("s", JSON.stringify(canonicalStep(step))));
  if (marks.length <= MAX_SIGNATURE_STEP_FINGERPRINTS) return marks;
  const side = Math.floor(MAX_SIGNATURE_STEP_FINGERPRINTS / 2);
  return [...marks.slice(0, side), ...marks.slice(-side)];
}

/**
 * Builds a comparison-safe payload. It contains no route words, target text,
 * player ID, callsign, run token, timestamps, or free-form metadata.
 */
export function createRouteSignature(raw = {}) {
  const history = sanitizeRouteHistory(raw);
  const grade = gradeSignatureRoute(raw);
  if (!grade.gradable) return null;
  const target = targetFrom(raw);
  const mode = normalizedMode(raw);
  const game = raw && typeof raw === "object" && !Array.isArray(raw) && raw.game && typeof raw.game === "object" ? raw.game : {};
  const challenge = cleanText(
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw.challengeId ?? game.challengeId
      : "",
    MAX_CHALLENGE_LENGTH
  );
  const targetKey = fingerprint("target", wordKey(target) || "untargeted");
  const scopeMaterial = challenge
    ? `challenge:${challenge}`
    : JSON.stringify([mode, targetKey, grade.metrics.idealMoves]);
  const scopeKey = fingerprint("scope", scopeMaterial);
  const canonicalRoute = JSON.stringify(history.map(canonicalStep));
  const routeFingerprint = fingerprint("route", canonicalRoute);
  const dimensions = { ...grade.dimensions };
  const payloadCore = {
    version: SIGNATURE_ROUTE_VERSION,
    kind: SIGNATURE_KIND,
    privacy: "anonymous",
    scopeKey,
    targetKey,
    routeFingerprint,
    mode,
    score: grade.total,
    scoreEligible: grade.scoreEligible,
    tier: grade.tier.id,
    tierLabel: grade.tier.label,
    dimensions,
    moves: grade.metrics.moves,
    idealMoves: grade.metrics.idealMoves,
    discoveries: grade.metrics.newDiscoveries,
    categories: grade.metrics.categories,
    contextualSteps: grade.metrics.contextualSteps,
    assist: grade.metrics.assist,
    scoreMultiplier: grade.metrics.scoreMultiplier,
    stepFingerprints: sampledStepFingerprints(history)
  };
  return {
    ...payloadCore,
    signatureId: fingerprint("rs", JSON.stringify(payloadCore))
  };
}

function safeFingerprint(value, prefix) {
  const text = cleanText(value, 40);
  return new RegExp(`^${prefix}-[a-z0-9]{14}$`).test(text) ? text : "";
}

/** Strips unknown fields from a received/local signature before comparison. */
export function sanitizeRouteSignature(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.kind !== SIGNATURE_KIND) return null;
  const signatureId = safeFingerprint(raw.signatureId, "rs");
  const scopeKey = safeFingerprint(raw.scopeKey, "scope");
  const targetKey = safeFingerprint(raw.targetKey, "target");
  const routeFingerprint = safeFingerprint(raw.routeFingerprint, "route");
  if (!signatureId || !scopeKey || !targetKey || !routeFingerprint) return null;
  const assistName = cleanLabel(raw.assist, 24);
  let assist = Object.hasOwn(ASSISTANCE, assistName) ? assistName : "open";
  let assistPolicy = ASSISTANCE[assist];
  const rawMultiplier = finiteNumber(raw.scoreMultiplier);
  const requestedEligibility = raw.scoreEligible === true;
  const scoreMultiplier = requestedEligibility && assistPolicy.eligible && Number.isFinite(rawMultiplier)
    ? Math.round(Math.min(assistPolicy.multiplier, Math.max(0, rawMultiplier)) * 100) / 100
    : 0;
  if (scoreMultiplier < assistPolicy.multiplier) {
    assistPolicy = policyForMultiplier(scoreMultiplier);
    assist = assistPolicy.id;
  }
  const scoreEligible = requestedEligibility && assistPolicy.eligible && scoreMultiplier > 0;
  const efficiency = clampScore(raw.dimensions?.efficiency);
  const novelty = clampScore(raw.dimensions?.novelty);
  const variety = clampScore(raw.dimensions?.variety);
  const purity = clampScore(scoreMultiplier * 100);
  const score = scoreEligible
    ? clampScore((efficiency * .38 + novelty * .32 + variety * .3) * scoreMultiplier)
    : 0;
  const tier = scoreEligible ? signatureTierForScore(score) : tierCopy(STUDY_TIER);
  const stepFingerprints = [];
  for (const value of Array.isArray(raw.stepFingerprints) ? raw.stepFingerprints : []) {
    const mark = safeFingerprint(value, "s");
    if (mark) stepFingerprints.push(mark);
    if (stepFingerprints.length === MAX_SIGNATURE_STEP_FINGERPRINTS) break;
  }
  return {
    version: SIGNATURE_ROUTE_VERSION,
    kind: SIGNATURE_KIND,
    privacy: "anonymous",
    scopeKey,
    targetKey,
    routeFingerprint,
    mode: MODES.has(cleanLabel(raw.mode, 24)) ? cleanLabel(raw.mode, 24) : "practice",
    score,
    scoreEligible,
    tier: tier.id,
    tierLabel: tier.label,
    dimensions: {
      efficiency,
      novelty,
      variety,
      purity
    },
    moves: clampInteger(raw.moves, 1, MAX_RECORDED_MOVES, 1),
    idealMoves: clampInteger(raw.idealMoves, 1, MAX_RECORDED_MOVES, 1),
    discoveries: clampInteger(raw.discoveries, 0, MAX_SIGNATURE_ROUTE_STEPS, 0),
    categories: clampInteger(raw.categories, 0, MAX_SIGNATURE_ROUTE_STEPS, 0),
    contextualSteps: clampInteger(raw.contextualSteps, 0, MAX_SIGNATURE_ROUTE_STEPS, 0),
    assist,
    scoreMultiplier,
    stepFingerprints,
    signatureId
  };
}

function comparisonReason(candidate, previous) {
  const comparisons = [
    ["score", candidate.score, previous.score],
    ["purity", candidate.dimensions.purity, previous.dimensions.purity],
    ["efficiency", candidate.dimensions.efficiency, previous.dimensions.efficiency],
    ["novelty", candidate.dimensions.novelty, previous.dimensions.novelty],
    ["variety", candidate.dimensions.variety, previous.dimensions.variety],
    ["moves", previous.moves, candidate.moves]
  ];
  for (const [reason, left, right] of comparisons) {
    if (left !== right) return { order: left > right ? 1 : -1, reason };
  }
  return { order: 0, reason: "tied" };
}

/**
 * Compares two signatures in one exact scope. The result never promotes a
 * different challenge into the existing personal-best slot.
 */
export function comparePersonalBest(candidateValue, previousValue = null) {
  const candidate = sanitizeRouteSignature(candidateValue) || createRouteSignature(candidateValue);
  const previous = sanitizeRouteSignature(previousValue) || createRouteSignature(previousValue);
  if (!candidate) return { comparable: false, improved: false, reason: "invalid_candidate", delta: 0, best: previous || null };
  if (!previous) return { comparable: true, improved: true, reason: "first", delta: candidate.score, best: candidate };
  if (candidate.scopeKey !== previous.scopeKey) {
    return { comparable: false, improved: false, reason: "different_scope", delta: 0, best: previous };
  }
  const comparison = comparisonReason(candidate, previous);
  const improved = comparison.order > 0;
  return {
    comparable: true,
    improved,
    reason: comparison.reason,
    delta: candidate.score - previous.score,
    best: improved ? candidate : previous
  };
}
