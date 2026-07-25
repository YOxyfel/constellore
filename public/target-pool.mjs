const DEFAULT_STARTERS = Object.freeze(["Earth", "Water", "Fire", "Air"]);

export const TARGET_POOL_SIZE = 500;
export const TARGET_POOL_VERSION = 1;

const SYSTEMATIC_PREFIXES = new Set([
  "aerial",
  "aeronautical",
  "climate",
  "coastal",
  "farming",
  "fluvial",
  "hydrology",
  "industrial",
  "insular",
  "lunar",
  "marine",
  "maritime",
  "oceanic",
  "planetary",
  "polar",
  "railway",
  "rural",
  "solar",
  "terrestrial",
  "tropical",
  "urban",
  "volcanic",
  "wetland"
]);

const SYSTEMATIC_SUFFIXES = new Set([
  "architecture",
  "automation",
  "biology",
  "class",
  "climate",
  "community",
  "conservation",
  "culture",
  "design",
  "ecology",
  "education",
  "electricity",
  "emissions",
  "energy",
  "geology",
  "habitat",
  "health",
  "hydrology",
  "industry",
  "infrastructure",
  "navigation",
  "pollution",
  "physics",
  "power",
  "research",
  "science",
  "society",
  "survival",
  "tourism",
  "trade",
  "transport",
  "weather",
  "wildlife",
  "zoology"
]);

const LOW_SIGNAL_WORDS = new Set([
  "concept",
  "element",
  "item",
  "object",
  "output",
  "placeholder",
  "result",
  "stuff",
  "thing",
  "unknown"
]);

const TOPIC_RULES = Object.freeze([
  ["space", /space|star|planet|moon|galax|cosmos|comet|meteor|asteroid|orbit|telescope|astronom|rocket|solar|lunar|nebula|aurora/i],
  ["life", /life|animal|species|bird|fish|plant|tree|forest|flower|seed|eco|bio|insect|cat|dog|wild|coral|organ/i],
  ["water", /water|ocean|river|rain|sea|ice|snow|cloud|mist|fog|flood|wave|tide|hydro|aquarium|marsh|swamp/i],
  ["fire", /fire|flame|lava|volcan|heat|ember|ash|smoke|inferno|spark|combust/i],
  ["weather", /air|wind|sky|cloud|storm|hurricane|tornado|weather|thunder|lightning|rainbow/i],
  ["land", /earth|stone|mountain|sand|desert|field|road|clay|mud|valley|cave|island|land/i],
  ["technology", /computer|network|internet|electric|machine|engine|robot|phone|circuit|technology|generator|vehicle|train|aircraft/i],
  ["building", /house|wall|brick|city|tower|bridge|room|road|castle|building|village|fortress|station/i],
  ["knowledge", /book|school|science|study|research|library|history|atlas|education|knowledge|idea/i],
  ["art", /art|music|gallery|concert|festival|illustration|dance|song|dream|wonder|magic/i],
  ["food", /food|bread|dinner|tea|fruit|kitchen|cook|honey|meat|farm|garden/i],
  ["society", /human|family|community|society|culture|money|trade|kingdom|travel|tourism/i]
]);

const cleanWord = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
export const targetKey = (value) => cleanWord(value?.target ?? value?.word ?? value).toLocaleLowerCase("en-US");

const unorderedPairKey = (a, b) => [targetKey(a), targetKey(b)].sort().join("\0");
const stepKey = (step) => `${targetKey(step?.a)}\0${targetKey(step?.b)}\0${targetKey(step?.word)}`;

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizedRoute(route) {
  if (!Array.isArray(route)) return null;
  const clean = [];
  for (const step of route) {
    const a = cleanWord(step?.a);
    const b = cleanWord(step?.b);
    const word = cleanWord(step?.word);
    if (!a || !b || !word) return null;
    clean.push({ a, b, word });
  }
  return clean;
}

function normalizedRecipes(recipes) {
  if (!Array.isArray(recipes)) return [];
  return recipes
    .map((recipe) => ({
      a: cleanWord(recipe?.a),
      b: cleanWord(recipe?.b),
      word: cleanWord(recipe?.word)
    }))
    .filter((recipe) => recipe.a && recipe.b && recipe.word)
    .sort((left, right) => (
      unorderedPairKey(left.a, left.b).localeCompare(unorderedPairKey(right.a, right.b))
      || targetKey(left.word).localeCompare(targetKey(right.word))
    ));
}

function finalRecipeCountIndex(recipes, suppliedCounts) {
  const counts = new Map();
  const addCount = (word, count) => {
    const key = targetKey(word);
    const value = Math.max(0, Math.trunc(Number(count) || 0));
    if (key) counts.set(key, Math.max(counts.get(key) || 0, value));
  };

  if (suppliedCounts instanceof Map) {
    for (const [word, count] of suppliedCounts) addCount(word, count);
  } else if (Array.isArray(suppliedCounts)) {
    for (const entry of suppliedCounts) {
      if (Array.isArray(entry)) addCount(entry[0], entry[1]);
      else addCount(entry?.target ?? entry?.word, entry?.count ?? entry?.finalRecipeCount);
    }
  } else if (suppliedCounts && typeof suppliedCounts === "object") {
    for (const [word, count] of Object.entries(suppliedCounts)) addCount(word, count);
  }

  const producerPairs = new Map();
  for (const recipe of normalizedRecipes(recipes)) {
    const resultKey = targetKey(recipe.word);
    if (!producerPairs.has(resultKey)) producerPairs.set(resultKey, new Set());
    producerPairs.get(resultKey).add(unorderedPairKey(recipe.a, recipe.b));
  }
  for (const [word, pairs] of producerPairs) {
    counts.set(word, Math.max(counts.get(word) || 0, pairs.size));
  }
  return counts;
}

/**
 * Build deterministic, dependency-ordered shortest routes using only the
 * supplied recipes. The function is intentionally browser-safe: callers can
 * use the same selector in the server build and in the static Pages build.
 */
export function buildShortestTargetRoutes({
  recipes = [],
  starters = DEFAULT_STARTERS
} = {}) {
  const cleanStarters = [...new Set(starters.map(cleanWord).filter(Boolean))];
  const plans = new Map(cleanStarters.map((word) => [
    targetKey(word),
    { target: word, route: [], signature: "" }
  ]));
  const candidates = normalizedRecipes(recipes);

  let changed = true;
  for (let round = 0; changed && round <= candidates.length + cleanStarters.length; round += 1) {
    changed = false;
    for (const recipe of candidates) {
      const left = plans.get(targetKey(recipe.a));
      const right = plans.get(targetKey(recipe.b));
      if (!left || !right) continue;

      const resultKey = targetKey(recipe.word);
      const steps = new Map();
      for (const step of left.route) steps.set(targetKey(step.word), step);
      for (const step of right.route) steps.set(targetKey(step.word), step);
      if (steps.has(resultKey)) continue;
      steps.set(resultKey, recipe);

      const route = [...steps.values()].map((step) => ({ ...step }));
      const signature = route.map(stepKey).join("|");
      const existing = plans.get(resultKey);
      if (
        !existing
        || route.length < existing.route.length
        || (route.length === existing.route.length && signature.localeCompare(existing.signature) < 0)
      ) {
        plans.set(resultKey, { target: recipe.word, route, signature });
        changed = true;
      }
    }
  }

  return new Map([...plans.entries()].map(([key, plan]) => [key, plan.route.map((step) => ({ ...step }))]));
}

function routeEntries(routes) {
  if (routes instanceof Map) return [...routes.entries()];
  if (Array.isArray(routes)) {
    return routes.map((entry) => (
      Array.isArray(entry)
        ? [entry[0], entry[1]]
        : [entry?.target ?? entry?.word, entry?.route]
    ));
  }
  if (routes && typeof routes === "object") return Object.entries(routes);
  return [];
}

function normalizeRouteIndex({ routes, recipes, starters }) {
  const calculated = routeEntries(routes).length
    ? new Map(routeEntries(routes).map(([target, route]) => [targetKey(target), normalizedRoute(route)]))
    : buildShortestTargetRoutes({ recipes, starters });
  return new Map([...calculated.entries()].filter(([key, route]) => key && Array.isArray(route)));
}

function conceptEntries(concepts) {
  if (concepts instanceof Map) return [...concepts.entries()];
  if (Array.isArray(concepts)) return concepts.map((concept) => [concept?.word ?? concept?.target, concept]);
  if (concepts && typeof concepts === "object") return Object.entries(concepts);
  return [];
}

function conceptIndex(concepts) {
  return new Map(conceptEntries(concepts)
    .map(([word, concept]) => [targetKey(word), concept])
    .filter(([key]) => key));
}

export function validateTargetRoute(route, target, { starters = DEFAULT_STARTERS } = {}) {
  const clean = normalizedRoute(route);
  const requested = targetKey(target);
  if (!clean || !requested) return { valid: false, reason: "invalid_input", routeLength: 0 };

  const available = new Set(starters.map(targetKey).filter(Boolean));
  const produced = new Set();
  for (let index = 0; index < clean.length; index += 1) {
    const step = clean[index];
    if (!available.has(targetKey(step.a)) || !available.has(targetKey(step.b))) {
      return { valid: false, reason: "missing_dependency", step: index, routeLength: clean.length };
    }
    const resultKey = targetKey(step.word);
    if (produced.has(resultKey)) {
      return { valid: false, reason: "duplicate_result", step: index, routeLength: clean.length };
    }
    produced.add(resultKey);
    available.add(resultKey);
  }
  if (!clean.length || targetKey(clean.at(-1)?.word) !== requested) {
    return { valid: false, reason: "wrong_destination", step: clean.length - 1, routeLength: clean.length };
  }
  return { valid: true, reason: "verified", step: null, routeLength: clean.length };
}

function wordTokens(word) {
  return cleanWord(word).toLocaleLowerCase("en-US").split(/[\s-]+/u).filter(Boolean);
}

export function targetNameQuality(word) {
  const clean = cleanWord(word);
  const tokens = wordTokens(clean);
  const lower = clean.toLocaleLowerCase("en-US");
  const technicalCompound = tokens.length >= 2
    && SYSTEMATIC_PREFIXES.has(tokens[0])
    && SYSTEMATIC_SUFFIXES.has(tokens.at(-1));
  const lowSignal = tokens.some((token) => LOW_SIGNAL_WORDS.has(token));
  const repeatedFiller = /(?:craft){2,}|(.{2,})\1\1/iu.test(lower);
  const naturalCharacters = /^[\p{L}\p{M}][\p{L}\p{M}'’ -]*$/u.test(clean);

  let score = 0;
  if (naturalCharacters) score += 20;
  if (tokens.length === 1) score += 18;
  else if (tokens.length === 2) score += 12;
  else if (tokens.length === 3) score += 4;
  else score -= 18;
  if (clean.length <= 18) score += 10;
  else if (clean.length <= 28) score += 3;
  else score -= 12;
  if (SYSTEMATIC_PREFIXES.has(tokens[0])) score -= 8;
  if (SYSTEMATIC_SUFFIXES.has(tokens.at(-1))) score -= 5;
  if (technicalCompound) score -= 55;
  if (lowSignal) score -= 40;
  if (repeatedFiller) score -= 80;

  return {
    eligible: Boolean(
      naturalCharacters
      && clean.length <= 36
      && tokens.length >= 1
      && tokens.length <= 4
      && !technicalCompound
      && !lowSignal
      && !repeatedFiller
    ),
    score,
    technicalCompound,
    tokens
  };
}

export function targetRouteBand(routeLength) {
  const moves = Math.max(0, Math.trunc(Number(routeLength) || 0));
  if (moves <= 4) return "spark";
  if (moves <= 7) return "path";
  if (moves <= 11) return "journey";
  if (moves <= 16) return "expedition";
  return "odyssey";
}

export function targetTierForRoute(routeLength) {
  const moves = Math.max(0, Math.trunc(Number(routeLength) || 0));
  if (moves <= 3) return 1;
  if (moves <= 6) return 2;
  if (moves <= 10) return 3;
  if (moves <= 15) return 4;
  return 5;
}

function targetTopics(word, route, concept = {}) {
  const supplied = [
    concept?.category,
    ...(Array.isArray(concept?.semanticTags) ? concept.semanticTags : [])
  ].map(targetKey).filter((tag) => tag && tag !== "crafted" && tag !== "starter");
  const searchText = [
    cleanWord(word),
    ...route.slice(-3).flatMap((step) => [step.a, step.b, step.word])
  ].join(" ");
  const inferred = TOPIC_RULES.filter(([, pattern]) => pattern.test(searchText)).map(([topic]) => topic);
  return [...new Set([...inferred, ...supplied, "discovery"])].slice(0, 4);
}

function generatedClue(topics, routeLength) {
  const topic = topics.find((item) => item !== "discovery") || "idea";
  const labels = {
    art: "imagination",
    building: "building",
    fire: "heat",
    food: "food and craft",
    knowledge: "knowledge",
    land: "earth and stone",
    life: "living things",
    society: "people and places",
    space: "the sky and space",
    technology: "machines and ideas",
    water: "water and weather",
    weather: "air and weather"
  };
  return `Follow a ${labels[topic] || topic} trail across ${routeLength} logical fusions.`;
}

function routeQuality(route) {
  const uniqueWords = new Set(route.flatMap((step) => [targetKey(step.a), targetKey(step.b), targetKey(step.word)]));
  const sameWordSteps = route.filter((step) => targetKey(step.a) === targetKey(step.b)).length;
  const uniqueRatio = uniqueWords.size / Math.max(1, route.length * 3);
  return Math.round(uniqueRatio * 18 + Math.min(2, sameWordSteps) * 2 - Math.abs(route.length - 9) * 0.7);
}

function familyFor(word) {
  const tokens = wordTokens(word);
  if (tokens.length < 2) return targetKey(word);
  if (SYSTEMATIC_PREFIXES.has(tokens[0])) return `prefix:${tokens[0]}`;
  if (SYSTEMATIC_SUFFIXES.has(tokens.at(-1))) return `suffix:${tokens.at(-1)}`;
  return `phrase:${tokens.join("-")}`;
}

function deterministicJitter(seed, word) {
  return (stableHash(`${seed}\0${targetKey(word)}`) % 1000) / 1000;
}

function candidateFor({
  word,
  route,
  detail,
  concept,
  official,
  minRouteLength,
  maxRouteLength,
  minimumFinalRecipes,
  finalRecipeCountsAvailable,
  finalRecipeCount,
  seed
}) {
  const routeCheck = validateTargetRoute(route, word);
  if (!routeCheck.valid) return null;
  const nameQuality = targetNameQuality(word);
  if (!official && (!nameQuality.eligible || route.length < minRouteLength || route.length > maxRouteLength)) return null;
  if (!official && (concept?.rankedEligible === false || targetKey(concept?.status) === "provisional")) return null;
  if (!official && finalRecipeCountsAvailable && finalRecipeCount < minimumFinalRecipes) return null;

  const topics = targetTopics(word, route, concept);
  const tier = official
    ? Math.min(5, Math.max(1, Math.trunc(Number(detail?.tier) || targetTierForRoute(route.length))))
    : targetTierForRoute(route.length);
  const qualityScore = (
    nameQuality.score
    + routeQuality(route)
    + (topics[0] === "discovery" ? -4 : 5)
    + deterministicJitter(seed, word)
  );
  const emoji = cleanWord(detail?.emoji || concept?.emoji) || "✦";
  const clue = cleanWord(detail?.clue) || generatedClue(topics, route.length);
  const routeWords = [...new Set(route.flatMap((step) => [
    targetKey(step.a),
    targetKey(step.b),
    targetKey(step.word)
  ]))];
  const routePairs = [...new Set(route.map((step) => unorderedPairKey(step.a, step.b)))];

  return {
    target: cleanWord(detail?.target || concept?.word || word),
    emoji,
    clue,
    tier,
    route: route.map((step) => ({ ...step })),
    routeLength: route.length,
    finalRecipeCount: finalRecipeCountsAvailable ? finalRecipeCount : null,
    routeBand: targetRouteBand(route.length),
    topics,
    primaryTopic: topics[0],
    source: official ? "official" : "expanded",
    poolVersion: TARGET_POOL_VERSION,
    qualityScore: Number(qualityScore.toFixed(3)),
    routeSignature: route.map(stepKey).join("|"),
    routeWords,
    routePairs,
    family: familyFor(word)
  };
}

function officialIndex(officialTargets) {
  const entries = [];
  const seen = new Set();
  for (const detail of Array.isArray(officialTargets) ? officialTargets : []) {
    const key = targetKey(detail);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    entries.push([key, { ...detail, target: cleanWord(detail.target) }]);
  }
  return entries;
}

function nextBalancedCandidate(candidates, counts, { maximumEnergyTargets = Infinity } = {}) {
  let winner = null;
  let winnerScore = -Infinity;
  for (const candidate of candidates) {
    if (
      candidate.routeWords.includes("energy")
      && (counts.routeWords.get("energy") || 0) >= maximumEnergyTargets
    ) continue;
    const topicCount = counts.topics.get(candidate.primaryTopic) || 0;
    const bandCount = counts.bands.get(candidate.routeBand) || 0;
    const tierCount = counts.tiers.get(candidate.tier) || 0;
    const familyCount = counts.families.get(candidate.family) || 0;
    const repeatedRoutePressure = candidate.routePairs.reduce(
      (sum, pair) => sum + (counts.routePairs.get(pair) || 0),
      0
    ) / Math.max(1, candidate.routePairs.length);
    const balanceScore = (
      candidate.qualityScore
      - topicCount * 1.35
      - bandCount * 0.24
      - tierCount * 0.1
      - familyCount * 7
      - repeatedRoutePressure * 0.22
    );
    if (
      balanceScore > winnerScore
      || (
        balanceScore === winnerScore
        && targetKey(candidate.target).localeCompare(targetKey(winner?.target)) < 0
      )
    ) {
      winner = candidate;
      winnerScore = balanceScore;
    }
  }
  return winner;
}

function countCandidate(counts, candidate) {
  counts.topics.set(candidate.primaryTopic, (counts.topics.get(candidate.primaryTopic) || 0) + 1);
  counts.bands.set(candidate.routeBand, (counts.bands.get(candidate.routeBand) || 0) + 1);
  counts.tiers.set(candidate.tier, (counts.tiers.get(candidate.tier) || 0) + 1);
  counts.families.set(candidate.family, (counts.families.get(candidate.family) || 0) + 1);
  for (const word of candidate.routeWords) {
    counts.routeWords.set(word, (counts.routeWords.get(word) || 0) + 1);
  }
  for (const pair of candidate.routePairs) {
    counts.routePairs.set(pair, (counts.routePairs.get(pair) || 0) + 1);
  }
}

/**
 * Select a stable 500-target catalog from a supplied authored universe.
 *
 * `routes` accepts an object, Map, `[target, route]` entries, or
 * `{ target, route }` records. When routes are omitted, the function derives
 * canonical routes from `recipes`. Existing official metadata is retained and
 * enriched with route metadata; official targets always occupy the front of
 * the returned catalog in their authored order.
 */
export function createTargetPool({
  routes,
  recipes = [],
  concepts = [],
  targetDetails = {},
  officialTargets = [],
  starters = DEFAULT_STARTERS,
  size = TARGET_POOL_SIZE,
  minRouteLength = 2,
  maxRouteLength = 24,
  minimumFinalRecipes = 2,
  finalRecipeCounts,
  maximumEnergyShare = 0.2,
  seed = "constellore-target-pool-v1"
} = {}) {
  const requestedSize = Math.max(1, Math.trunc(Number(size) || TARGET_POOL_SIZE));
  const cleanStarters = [...new Set(starters.map(cleanWord).filter(Boolean))];
  const starterKeys = new Set(cleanStarters.map(targetKey));
  const routeIndex = normalizeRouteIndex({ routes, recipes, starters: cleanStarters });
  const finalCounts = finalRecipeCountIndex(recipes, finalRecipeCounts);
  const finalRecipeCountsAvailable = normalizedRecipes(recipes).length > 0 || finalCounts.size > 0;
  const requiredFinalRecipes = Math.max(1, Math.trunc(Number(minimumFinalRecipes) || 2));
  const conceptsByKey = conceptIndex(concepts);
  const detailsByKey = new Map(conceptEntries(targetDetails).map(([word, detail]) => [targetKey(word), detail]));
  const officialEntries = officialIndex(officialTargets);

  if (officialEntries.length > requestedSize) {
    throw new RangeError(`Target pool size ${requestedSize} cannot preserve ${officialEntries.length} official targets.`);
  }

  const selected = [];
  const selectedKeys = new Set();
  for (const [key, detail] of officialEntries) {
    if (starterKeys.has(key)) throw new Error(`Official target ${detail.target} is a starter, not a playable destination.`);
    const route = routeIndex.get(key);
    const candidate = candidateFor({
      word: detail.target,
      route,
      detail,
      concept: conceptsByKey.get(key),
      official: true,
      minRouteLength,
      maxRouteLength,
      minimumFinalRecipes: requiredFinalRecipes,
      finalRecipeCountsAvailable,
      finalRecipeCount: finalCounts.get(key) || 0,
      seed
    });
    if (!candidate) throw new Error(`Official target ${detail.target} has no verified starter-reachable route.`);
    selected.push(candidate);
    selectedKeys.add(key);
  }

  const candidates = [];
  for (const [key, route] of routeIndex) {
    if (starterKeys.has(key) || selectedKeys.has(key)) continue;
    const detail = detailsByKey.get(key);
    const concept = conceptsByKey.get(key);
    const word = cleanWord(detail?.target || concept?.word || route.at(-1)?.word || key);
    const candidate = candidateFor({
      word,
      route,
      detail,
      concept,
      official: false,
      minRouteLength,
      maxRouteLength,
      minimumFinalRecipes: requiredFinalRecipes,
      finalRecipeCountsAvailable,
      finalRecipeCount: finalCounts.get(key) || 0,
      seed
    });
    if (candidate) candidates.push(candidate);
  }

  candidates.sort((left, right) => (
    right.qualityScore - left.qualityScore
    || targetKey(left.target).localeCompare(targetKey(right.target))
  ));

  if (selected.length + candidates.length < requestedSize) {
    throw new RangeError(
      `Only ${selected.length + candidates.length} verified quality targets are available; ${requestedSize} were requested.`
    );
  }

  const counts = {
    topics: new Map(),
    bands: new Map(),
    tiers: new Map(),
    families: new Map(),
    routeWords: new Map(),
    routePairs: new Map()
  };
  selected.forEach((candidate) => countCandidate(counts, candidate));
  const remaining = [...candidates];
  const maximumEnergyTargets = Math.max(
    counts.routeWords.get("energy") || 0,
    Math.floor(requestedSize * Math.max(0, Math.min(1, Number(maximumEnergyShare) || 0)))
  );
  while (selected.length < requestedSize) {
    const winner = nextBalancedCandidate(remaining, counts, { maximumEnergyTargets })
      || nextBalancedCandidate(remaining, counts);
    if (!winner) break;
    selected.push(winner);
    selectedKeys.add(targetKey(winner.target));
    countCandidate(counts, winner);
    remaining.splice(remaining.indexOf(winner), 1);
  }

  if (selected.length !== requestedSize || selectedKeys.size !== requestedSize) {
    throw new Error(`Target pool selection stopped at ${selected.length} unique targets instead of ${requestedSize}.`);
  }

  return selected.map(({ family, routeWords, routePairs, ...entry }) => ({
    ...entry,
    route: entry.route.map((step) => ({ ...step })),
    topics: [...entry.topics]
  }));
}

export const selectTargetPool = createTargetPool;

export function summarizeTargetPool(pool) {
  const entries = Array.isArray(pool) ? pool : [];
  const countBy = (field) => Object.fromEntries([...entries.reduce((counts, entry) => {
    const value = String(entry?.[field] ?? "unknown");
    counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
  }, new Map())].sort(([left], [right]) => left.localeCompare(right)));
  return {
    version: TARGET_POOL_VERSION,
    total: entries.length,
    unique: new Set(entries.map(targetKey)).size,
    official: entries.filter((entry) => entry?.source === "official").length,
    tiers: countBy("tier"),
    routeBands: countBy("routeBand"),
    topics: countBy("primaryTopic"),
    minimumRouteLength: entries.length ? Math.min(...entries.map((entry) => entry.routeLength)) : 0,
    maximumRouteLength: entries.length ? Math.max(...entries.map((entry) => entry.routeLength)) : 0
  };
}
