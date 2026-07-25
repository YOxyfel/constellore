export const SHUFFLED_START_VERSION = 1;
export const CLASSIC_STARTERS = Object.freeze([
  "Earth",
  "Water",
  "Fire",
  "Air"
]);

export const START_STYLES = Object.freeze({
  AUTO: "auto",
  CLASSIC: "classic",
  SHUFFLED: "shuffled"
});

const FAILURE_OUTCOMES = new Set([
  "abandoned",
  "failed",
  "failure",
  "forfeit",
  "forfeited",
  "give_up",
  "given_up",
  "reveal",
  "study",
  "timeout"
]);

const RANK_IDS = Object.freeze([
  "bronze",
  "silver",
  "gold",
  "diamond",
  "emerald",
  "sapphire",
  "ruby",
  "master",
  "grandmaster",
  "mythic",
  "legend",
  "cosmic"
]);

const RANK_DIFFICULTY = Object.freeze([
  { desiredRouteLength: 3, minimumRouteLength: 2, maximumRouteLength: 5, desiredStarters: 4, maximumStarters: 5, maximumSidePaths: 1 },
  { desiredRouteLength: 3, minimumRouteLength: 2, maximumRouteLength: 5, desiredStarters: 5, maximumStarters: 5, maximumSidePaths: 1 },
  { desiredRouteLength: 4, minimumRouteLength: 2, maximumRouteLength: 6, desiredStarters: 5, maximumStarters: 5, maximumSidePaths: 1 },
  { desiredRouteLength: 5, minimumRouteLength: 3, maximumRouteLength: 7, desiredStarters: 5, maximumStarters: 5, maximumSidePaths: 1 },
  { desiredRouteLength: 5, minimumRouteLength: 3, maximumRouteLength: 8, desiredStarters: 5, maximumStarters: 5, maximumSidePaths: 1 },
  { desiredRouteLength: 6, minimumRouteLength: 3, maximumRouteLength: 9, desiredStarters: 5, maximumStarters: 6, maximumSidePaths: 2 },
  { desiredRouteLength: 6, minimumRouteLength: 4, maximumRouteLength: 9, desiredStarters: 6, maximumStarters: 6, maximumSidePaths: 2 },
  { desiredRouteLength: 7, minimumRouteLength: 4, maximumRouteLength: 10, desiredStarters: 6, maximumStarters: 6, maximumSidePaths: 2 },
  { desiredRouteLength: 7, minimumRouteLength: 4, maximumRouteLength: 10, desiredStarters: 6, maximumStarters: 6, maximumSidePaths: 2 },
  { desiredRouteLength: 8, minimumRouteLength: 5, maximumRouteLength: 11, desiredStarters: 6, maximumStarters: 6, maximumSidePaths: 2 },
  { desiredRouteLength: 8, minimumRouteLength: 5, maximumRouteLength: 12, desiredStarters: 6, maximumStarters: 6, maximumSidePaths: 2 },
  { desiredRouteLength: 9, minimumRouteLength: 5, maximumRouteLength: 12, desiredStarters: 6, maximumStarters: 6, maximumSidePaths: 2 }
]);

const recipeResolverCache = new WeakMap();
const itemResolverCache = new WeakMap();

const cleanWord = (value) => String(value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ");
const wordKey = (value) => cleanWord(value?.word ?? value?.target ?? value).toLocaleLowerCase("en-US");
const pairKey = (a, b) => [wordKey(a), wordKey(b)].sort().join("\0");

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  return Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(number) ? Math.round(number) : fallback)
  );
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashText(value) {
  return stableHash(value).toString(16).padStart(8, "0");
}

function normalizeStyle(value) {
  const style = String(value || START_STYLES.AUTO)
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US");
  if (["base", "classic", "elements", "original"].includes(style)) {
    return START_STYLES.CLASSIC;
  }
  if (["random", "shuffle", "shuffled"].includes(style)) {
    return START_STYLES.SHUFFLED;
  }
  return START_STYLES.AUTO;
}

function normalizeRank(rank) {
  if (rank && typeof rank === "object" && !Array.isArray(rank)) {
    if (rank.id != null) return normalizeRank(rank.id);
    if (rank.rankId != null) return normalizeRank(rank.rankId);
    if (rank.name != null) return normalizeRank(rank.name);
    if (rank.index != null) {
      const index = clampInteger(rank.index, 0, RANK_IDS.length - 1, 0);
      return { id: RANK_IDS[index], index, number: index + 1 };
    }
    if (rank.number != null) return normalizeRank(rank.number);
  }
  if (Number.isFinite(Number(rank)) && String(rank ?? "").trim() !== "") {
    const number = clampInteger(rank, 1, RANK_IDS.length, 1);
    return { id: RANK_IDS[number - 1], index: number - 1, number };
  }
  const requested = String(rank || "bronze")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s_-]+/gu, "");
  const index = Math.max(0, RANK_IDS.findIndex((id) => id.replace(/_/gu, "") === requested));
  return { id: RANK_IDS[index], index, number: index + 1 };
}

function failedLastChallenge(options) {
  if (options.failureRecovery === true || options.recovery === true) return true;
  if (options.lastChallengeSucceeded === false) return true;
  const outcome = String(options.lastOutcome ?? options.previousOutcome ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s-]+/gu, "_");
  return FAILURE_OUTCOMES.has(outcome);
}

/**
 * Selects a starting style without touching progression state.
 *
 * Auto cadence:
 * - Bronze: Classic only.
 * - Silver: Classic, Classic, Shuffled.
 * - Gold and Diamond: Shuffled, Shuffled, Classic.
 * - Emerald and above: four Shuffled, then one Classic.
 * - Failure recovery: one Classic challenge.
 * - Promotion: Classic, Shuffled, Shuffled.
 */
export function selectStartStyle(options = {}) {
  const requestedStyle = normalizeStyle(
    options.preference ?? options.startStyle ?? options.style
  );
  const rank = normalizeRank(options.rank);
  const challengeIndex = Math.max(
    0,
    Math.trunc(Number(options.challengeIndex ?? options.completedChallenges) || 0)
  );
  const promotion = options.promotion === true
    || options.isPromotion === true
    || options.promotionTrial != null;
  const promotionAttempt = Math.max(
    0,
    Math.trunc(Number(
      options.promotionAttempt
      ?? options.promotionTrial?.attempts
      ?? options.trialAttempt
    ) || 0)
  );

  if (rank.index === 0) {
    return {
      style: START_STYLES.CLASSIC,
      requestedStyle,
      rank,
      reason: "bronze_onboarding",
      cadencePosition: 0,
      cadenceLength: 1,
      locked: requestedStyle === START_STYLES.SHUFFLED
    };
  }

  if (requestedStyle !== START_STYLES.AUTO) {
    return {
      style: requestedStyle,
      requestedStyle,
      rank,
      reason: "player_choice",
      cadencePosition: null,
      cadenceLength: null,
      locked: false
    };
  }

  if (failedLastChallenge(options)) {
    return {
      style: START_STYLES.CLASSIC,
      requestedStyle,
      rank,
      reason: "failure_recovery",
      cadencePosition: 0,
      cadenceLength: 1,
      locked: false
    };
  }

  if (promotion) {
    const cadence = [
      START_STYLES.CLASSIC,
      START_STYLES.SHUFFLED,
      START_STYLES.SHUFFLED
    ];
    const position = promotionAttempt % cadence.length;
    return {
      style: cadence[position],
      requestedStyle,
      rank,
      reason: "promotion_cadence",
      cadencePosition: position,
      cadenceLength: cadence.length,
      locked: false
    };
  }

  const cadence = rank.index === 1
    ? [START_STYLES.CLASSIC, START_STYLES.CLASSIC, START_STYLES.SHUFFLED]
    : rank.index <= 3
      ? [START_STYLES.SHUFFLED, START_STYLES.SHUFFLED, START_STYLES.CLASSIC]
      : [
          START_STYLES.SHUFFLED,
          START_STYLES.SHUFFLED,
          START_STYLES.SHUFFLED,
          START_STYLES.SHUFFLED,
          START_STYLES.CLASSIC
        ];
  const position = challengeIndex % cadence.length;
  return {
    style: cadence[position],
    requestedStyle,
    rank,
    reason: "auto_cadence",
    cadencePosition: position,
    cadenceLength: cadence.length,
    locked: false
  };
}

function normalizeRecipe(candidate) {
  if (typeof candidate === "string") return { a: "", b: "", word: cleanWord(candidate) };
  const a = cleanWord(candidate?.a ?? candidate?.left ?? candidate?.first);
  const b = cleanWord(candidate?.b ?? candidate?.right ?? candidate?.second);
  const word = cleanWord(candidate?.word ?? candidate?.result?.word ?? candidate?.result);
  if (!word) return null;
  return {
    ...(candidate && typeof candidate === "object" ? candidate : {}),
    a,
    b,
    word
  };
}

function normalizeRoute(route) {
  if (!Array.isArray(route)) return null;
  const normalized = [];
  for (const candidate of route) {
    const recipe = normalizeRecipe(candidate);
    if (!recipe?.a || !recipe?.b || !recipe?.word) return null;
    normalized.push(recipe);
  }
  return normalized;
}

function enumerableRecipes(source) {
  if (Array.isArray(source)) return source;
  if (source instanceof Map) return [...source.values()].flatMap((value) => (
    Array.isArray(value) ? value : [value]
  ));
  if (source && typeof source === "object" && typeof source !== "function") {
    return Object.values(source).flatMap((value) => (
      Array.isArray(value) ? value : [value]
    ));
  }
  return [];
}

function buildRecipeResolver(recipes, recipeLookup) {
  const cacheKey = recipeLookup == null
    && recipes != null
    && (typeof recipes === "object" || typeof recipes === "function")
    ? recipes
    : recipes == null
      && recipeLookup != null
      && (typeof recipeLookup === "object" || typeof recipeLookup === "function")
      ? recipeLookup
      : null;
  if (cacheKey && recipeResolverCache.has(cacheKey)) {
    return recipeResolverCache.get(cacheKey);
  }
  const catalog = [
    ...enumerableRecipes(recipes),
    ...enumerableRecipes(recipeLookup)
  ].map(normalizeRecipe).filter((recipe) => recipe?.a && recipe?.b && recipe?.word);
  const byPair = new Map();
  const byConcept = new Map();
  for (const recipe of catalog) {
    const key = pairKey(recipe.a, recipe.b);
    if (!byPair.has(key)) byPair.set(key, []);
    const candidates = byPair.get(key);
    if (!candidates.some((candidate) => wordKey(candidate.word) === wordKey(recipe.word))) {
      candidates.push(recipe);
    }
    for (const concept of new Set([recipe.a, recipe.b, recipe.word].map(wordKey))) {
      if (!byConcept.has(concept)) byConcept.set(concept, []);
      byConcept.get(concept).push(recipe);
    }
  }

  const externalLookup = typeof recipeLookup === "function"
    ? recipeLookup
    : (a, b) => {
        if (!(recipeLookup instanceof Map) && (!recipeLookup || typeof recipeLookup !== "object")) {
          return null;
        }
        const key = pairKey(a, b);
        const keys = [
          key,
          `${wordKey(a)}|${wordKey(b)}`,
          `${wordKey(b)}|${wordKey(a)}`,
          `${cleanWord(a)} + ${cleanWord(b)}`,
          `${cleanWord(b)} + ${cleanWord(a)}`
        ];
        for (const candidateKey of keys) {
          const found = recipeLookup instanceof Map
            ? recipeLookup.get(candidateKey)
            : recipeLookup[candidateKey];
          if (found != null) return found;
        }
        return null;
      };

  const resolve = (a, b) => {
    const candidates = [...(byPair.get(pairKey(a, b)) || [])];
    const external = externalLookup(a, b);
    for (const value of Array.isArray(external) ? external : [external]) {
      const recipe = normalizeRecipe(value);
      if (!recipe?.word) continue;
      recipe.a ||= cleanWord(a);
      recipe.b ||= cleanWord(b);
      if (!candidates.some((candidate) => wordKey(candidate.word) === wordKey(recipe.word))) {
        candidates.push(recipe);
      }
    }
    return candidates;
  };

  const resolver = {
    catalog,
    resolve,
    relatedTo(words) {
      const related = new Map();
      for (const word of words) {
        for (const recipe of byConcept.get(wordKey(word)) || []) {
          related.set(recipeSignature(recipe), recipe);
        }
      }
      return [...related.values()];
    },
    available: catalog.length > 0 || typeof recipeLookup === "function"
  };
  if (cacheKey) recipeResolverCache.set(cacheKey, resolver);
  return resolver;
}

function buildItemResolver(items, itemLookup) {
  const source = itemLookup ?? items;
  const cacheable = source != null
    && (typeof source === "object" || typeof source === "function");
  if (cacheable && itemResolverCache.has(source)) return itemResolverCache.get(source);
  const index = new Map();
  for (const item of enumerableRecipes(source)) {
    const word = cleanWord(item?.word ?? item?.target);
    if (word) index.set(wordKey(word), { ...item, word });
  }
  if (Array.isArray(source)) {
    for (const item of source) {
      const word = cleanWord(item?.word ?? item?.target);
      if (word) index.set(wordKey(word), { ...item, word });
    }
  }

  const resolver = (word) => {
    const clean = cleanWord(word);
    let candidate = index.get(wordKey(clean));
    if (!candidate && typeof source === "function") candidate = source(clean);
    if (!candidate && source instanceof Map) {
      candidate = source.get(clean) ?? source.get(wordKey(clean));
    }
    if (!candidate && source && typeof source === "object" && !Array.isArray(source)) {
      candidate = source[clean] ?? source[wordKey(clean)];
    }
    if (typeof candidate === "string") candidate = { word: candidate };
    if (!candidate || typeof candidate !== "object") return null;
    return { ...candidate, word: cleanWord(candidate.word ?? clean) };
  };
  if (cacheable) itemResolverCache.set(source, resolver);
  return resolver;
}

function isRecognizableItem(item) {
  return Boolean(
    item
    && cleanWord(item.word)
    && item.recognizable !== false
    && item.valid !== false
    && item.nonsense !== true
    && item.blocked !== true
  );
}

function itemIsPremium(item, word, predicate) {
  if (typeof predicate === "function" && predicate(item, word) === true) return true;
  const access = String(item?.access ?? item?.entitlement ?? item?.availability ?? "")
    .trim()
    .toLocaleLowerCase("en-US");
  return Boolean(
    item?.premium === true
    || item?.isPremium === true
    || item?.paid === true
    || access === "premium"
    || access === "paid"
  );
}

function safeItem(word, itemFor, premiumPredicate) {
  const item = itemFor(word);
  if (!isRecognizableItem(item) || itemIsPremium(item, word, premiumPredicate)) return null;
  return { ...item, word: cleanWord(word) };
}

function validateCanonicalRoute({
  route,
  target,
  classicStarters,
  recipeResolver
}) {
  const targetId = wordKey(target);
  if (!route || !route.length || !targetId) {
    throw new TypeError("A non-empty canonical route and target are required.");
  }
  if (!recipeResolver.available) {
    throw new TypeError("A canonical recipe lookup or recipe catalog is required.");
  }
  const available = new Set(classicStarters.map(wordKey));
  const produced = new Set();
  const validated = [];

  for (let index = 0; index < route.length; index += 1) {
    const proposed = route[index];
    if (!available.has(wordKey(proposed.a)) || !available.has(wordKey(proposed.b))) {
      throw new Error(`Canonical route dependency is unavailable at step ${index}.`);
    }
    const resultId = wordKey(proposed.word);
    if (produced.has(resultId) || available.has(resultId)) {
      throw new Error(`Canonical route repeats a result at step ${index}.`);
    }
    const candidates = recipeResolver.resolve(proposed.a, proposed.b);
    if (candidates.length !== 1 || wordKey(candidates[0].word) !== resultId) {
      throw new Error(`Canonical recipe is missing or ambiguous at step ${index}.`);
    }
    const canonical = candidates[0];
    const step = {
      ...proposed,
      ...canonical,
      a: cleanWord(proposed.a),
      b: cleanWord(proposed.b),
      word: cleanWord(canonical.word)
    };
    validated.push(step);
    produced.add(resultId);
    available.add(resultId);
  }

  if (wordKey(validated.at(-1)?.word) !== targetId) {
    throw new Error("Canonical route does not end at the requested target.");
  }
  if (classicStarters.some((word) => wordKey(word) === targetId)) {
    throw new Error("The target cannot already be a starter.");
  }
  return validated;
}

function frontierForSuffix(route, startIndex) {
  const suffix = route.slice(startIndex);
  const produced = new Set();
  const frontier = new Map();
  for (const step of suffix) {
    for (const word of [step.a, step.b]) {
      const key = wordKey(word);
      if (!produced.has(key) && !frontier.has(key)) frontier.set(key, cleanWord(word));
    }
    produced.add(wordKey(step.word));
  }
  return {
    suffix,
    frontier: [...frontier.values()]
  };
}

function validateSuffix(suffix, starters, target) {
  if (!suffix.length || wordKey(suffix.at(-1)?.word) !== wordKey(target)) return false;
  const available = new Set(starters.map(wordKey));
  const targetId = wordKey(target);
  if (available.has(targetId)) return false;
  for (let index = 0; index < suffix.length; index += 1) {
    const step = suffix[index];
    if (!available.has(wordKey(step.a)) || !available.has(wordKey(step.b))) return false;
    const result = wordKey(step.word);
    if (available.has(result)) return false;
    if (result === targetId && index !== suffix.length - 1) return false;
    available.add(result);
  }
  return available.has(targetId);
}

function difficultyFor(rank, difficulty = {}) {
  const defaults = RANK_DIFFICULTY[rank.index];
  const object = difficulty && typeof difficulty === "object" && !Array.isArray(difficulty)
    ? difficulty
    : { level: difficulty };
  const level = clampInteger(object.level, 1, 5, Math.min(5, Math.floor(rank.index / 2) + 1));
  const desiredRouteLength = clampInteger(
    object.desiredRouteLength ?? object.routeLength,
    2,
    16,
    defaults.desiredRouteLength
  );
  const minimumRouteLength = clampInteger(
    object.minimumRouteLength ?? object.minRouteLength,
    2,
    desiredRouteLength,
    defaults.minimumRouteLength
  );
  const maximumRouteLength = clampInteger(
    object.maximumRouteLength ?? object.maxRouteLength,
    desiredRouteLength,
    20,
    defaults.maximumRouteLength
  );
  const maximumStarters = clampInteger(
    object.maximumStarters ?? object.maxStarters,
    2,
    6,
    defaults.maximumStarters
  );
  const desiredStarters = clampInteger(
    object.desiredStarters ?? object.starterCount,
    2,
    maximumStarters,
    defaults.desiredStarters
  );
  const maximumSidePaths = clampInteger(
    object.maximumSidePaths ?? object.sidePaths,
    0,
    2,
    defaults.maximumSidePaths
  );
  return {
    level,
    desiredRouteLength,
    minimumRouteLength,
    maximumRouteLength,
    desiredStarters,
    maximumStarters,
    maximumSidePaths
  };
}

function recipeSignature(recipe) {
  return `${pairKey(recipe.a, recipe.b)}\0${wordKey(recipe.word)}`;
}

function sideRecipeCandidates({
  route,
  prefix,
  suffix,
  catalog,
  target,
  seed
}) {
  const targetId = wordKey(target);
  const suffixResultIds = new Set(suffix.map((step) => wordKey(step.word)));
  const frontierIds = new Set(frontierForSuffix(route, route.length - suffix.length).frontier.map(wordKey));
  const routeIds = new Set(route.flatMap((step) => [step.a, step.b, step.word]).map(wordKey));
  const candidates = new Map();
  for (const source of [...prefix].reverse().concat(catalog)) {
    const recipe = normalizeRecipe(source);
    if (!recipe?.a || !recipe?.b || !recipe?.word) continue;
    const resultId = wordKey(recipe.word);
    if (
      resultId === targetId
      || wordKey(recipe.a) === targetId
      || wordKey(recipe.b) === targetId
    ) {
      continue;
    }
    const contextual = [recipe.a, recipe.b, recipe.word].some((word) => routeIds.has(wordKey(word)));
    if (!contextual) continue;
    if (suffixResultIds.has(resultId) && !frontierIds.has(resultId)) continue;
    const signature = recipeSignature(recipe);
    if (!candidates.has(signature)) candidates.set(signature, recipe);
  }
  return [...candidates.values()].sort((left, right) => {
    const leftReinforces = frontierIds.has(wordKey(left.word)) ? 0 : 1;
    const rightReinforces = frontierIds.has(wordKey(right.word)) ? 0 : 1;
    if (leftReinforces !== rightReinforces) return leftReinforces - rightReinforces;
    const leftHash = stableHash(`${seed}|side|${recipeSignature(left)}`);
    const rightHash = stableHash(`${seed}|side|${recipeSignature(right)}`);
    return leftHash - rightHash || recipeSignature(left).localeCompare(recipeSignature(right));
  });
}

function enrichWithSidePaths({
  route,
  startIndex,
  starters,
  target,
  recipeResolver,
  itemFor,
  premiumPredicate,
  difficulty,
  seed,
  sideCatalog,
  baseStarterIds
}) {
  const starterMap = new Map(starters.map((word) => [wordKey(word), cleanWord(word)]));
  const productiveIds = new Set(starterMap.keys());
  const sideStarterIds = new Set();
  const sidePaths = [];
  const firstStepSignature = recipeSignature(route[startIndex]);
  const candidates = sideRecipeCandidates({
    route,
    prefix: route.slice(0, startIndex),
    suffix: route.slice(startIndex),
    catalog: sideCatalog,
    target,
    seed
  });

  for (const recipe of candidates) {
    if (sidePaths.length >= difficulty.maximumSidePaths) break;
    if (recipeSignature(recipe) === firstStepSignature) continue;
    const canonical = recipeResolver.resolve(recipe.a, recipe.b);
    if (canonical.length !== 1 || wordKey(canonical[0].word) !== wordKey(recipe.word)) continue;

    const additions = [recipe.a, recipe.b]
      .filter((word, index, list) => list.findIndex((entry) => wordKey(entry) === wordKey(word)) === index)
      .filter((word) => !starterMap.has(wordKey(word)));
    if (starterMap.size + additions.length > difficulty.maximumStarters) continue;

    const inputItems = [recipe.a, recipe.b].map((word) => safeItem(word, itemFor, premiumPredicate));
    const resultItem = safeItem(recipe.word, itemFor, premiumPredicate);
    if (inputItems.some((item) => !item) || !resultItem) continue;

    for (const word of additions) {
      starterMap.set(wordKey(word), cleanWord(word));
      sideStarterIds.add(wordKey(word));
    }
    sidePaths.push({
      a: cleanWord(recipe.a),
      b: cleanWord(recipe.b),
      word: cleanWord(recipe.word),
      resultItem,
      reinforcesStarter: productiveIds.has(wordKey(recipe.word))
    });

    const nonBase = [...starterMap.values()].filter(
      (word) => !baseStarterIds.has(wordKey(word))
    ).length;
    if (
      starterMap.size >= difficulty.desiredStarters
      && nonBase >= 2
      && sidePaths.length >= difficulty.maximumSidePaths
    ) {
      break;
    }
  }

  return {
    starters: [...starterMap.values()],
    productiveIds,
    sideStarterIds,
    sidePaths
  };
}

function starterHash(starters) {
  return hashText(starters.map(wordKey).sort().join("|"));
}

function routeSignature(route) {
  return route.map(recipeSignature).join("|");
}

function createProfileId({ target, style, starters, route, rank, difficulty }) {
  return `start-v${SHUFFLED_START_VERSION}-${style}-${hashText([
    wordKey(target),
    starterHash(starters),
    routeSignature(route),
    rank.id,
    difficulty.level
  ].join("|"))}`;
}

function starterMetadata(starters, itemFor, premiumPredicate) {
  const items = starters.map((word) => safeItem(word, itemFor, premiumPredicate));
  return items.every(Boolean) ? items : null;
}

function classicProfile({
  target,
  route,
  classicStarters,
  itemFor,
  premiumPredicate,
  selection,
  difficulty,
  fallbackReason = null
}) {
  const items = starterMetadata(classicStarters, itemFor, premiumPredicate);
  if (!items) {
    throw new Error("Classic starter metadata is missing, unrecognizable, or premium.");
  }
  if (!validateSuffix(route, classicStarters, target)) {
    throw new Error("The canonical route is not executable from the Classic starters.");
  }
  const productive = frontierForSuffix(route, 0).frontier;
  const hash = starterHash(classicStarters);
  const profile = {
    version: SHUFFLED_START_VERSION,
    style: START_STYLES.CLASSIC,
    requestedStyle: selection.requestedStyle,
    selection,
    target: cleanWord(target),
    starters: [...classicStarters],
    starterItems: items,
    starterHash: hash,
    profileId: "",
    canonicalRouteLength: route.length,
    routeStartIndex: 0,
    challengeRoute: route.map((step) => ({ ...step })),
    route: route.map((step) => ({ ...step })),
    routeLength: route.length,
    productiveStarters: productive,
    productiveStarterCount: productive.length,
    sidePathStarters: [],
    sidePaths: [],
    sidePathCount: 0,
    openings: [{
      a: route[0].a,
      b: route[0].b,
      word: route[0].word,
      kind: "route"
    }],
    hasValidOpening: true,
    fallback: Boolean(fallbackReason),
    fallbackReason,
    difficulty: {
      rankId: selection.rank.id,
      rankNumber: selection.rank.number,
      level: difficulty.level,
      requestedRouteLength: difficulty.desiredRouteLength,
      actualRouteLength: route.length,
      starterCount: classicStarters.length,
      productiveStarterCount: productive.length,
      sidePathCount: 0,
      score: Math.max(1, route.length * 10)
    }
  };
  profile.profileId = createProfileId({
    target,
    style: profile.style,
    starters: profile.starters,
    route,
    rank: selection.rank,
    difficulty
  });
  return profile;
}

function shuffledCandidates({
  target,
  route,
  classicStarters,
  recipeResolver,
  itemFor,
  premiumPredicate,
  difficulty,
  selection,
  seed
}) {
  const baseIds = new Set(classicStarters.map(wordKey));
  const targetId = wordKey(target);
  const candidates = [];
  const sideCatalog = recipeResolver.relatedTo(
    route.flatMap((step) => [step.a, step.b, step.word])
  );

  for (let startIndex = 1; startIndex < route.length; startIndex += 1) {
    const { suffix, frontier } = frontierForSuffix(route, startIndex);
    if (suffix.length < 2 || suffix.length > 20) continue;
    if (frontier.some((word) => wordKey(word) === targetId)) continue;
    if (frontier.length > difficulty.maximumStarters) continue;
    if (!validateSuffix(suffix, frontier, target)) continue;
    if (!starterMetadata(frontier, itemFor, premiumPredicate)) continue;

    const enriched = enrichWithSidePaths({
      route,
      startIndex,
      starters: frontier,
      target,
      recipeResolver,
      itemFor,
      premiumPredicate,
      difficulty,
      seed: `${seed}|${startIndex}`,
      sideCatalog,
      baseStarterIds: baseIds
    });
    if (enriched.starters.length > difficulty.maximumStarters) continue;
    if (enriched.starters.some((word) => wordKey(word) === targetId)) continue;
    if (!validateSuffix(suffix, enriched.starters, target)) continue;
    const items = starterMetadata(enriched.starters, itemFor, premiumPredicate);
    if (!items) continue;

    const nonBaseCount = enriched.starters.filter((word) => !baseIds.has(wordKey(word))).length;
    if (nonBaseCount < 2) continue;
    const first = suffix[0];
    if (
      !enriched.starters.some((word) => wordKey(word) === wordKey(first.a))
      || !enriched.starters.some((word) => wordKey(word) === wordKey(first.b))
    ) {
      continue;
    }

    const routeVariance = Math.abs(suffix.length - difficulty.desiredRouteLength);
    const outsideBand = suffix.length < difficulty.minimumRouteLength
      ? difficulty.minimumRouteLength - suffix.length
      : suffix.length > difficulty.maximumRouteLength
        ? suffix.length - difficulty.maximumRouteLength
        : 0;
    const starterVariance = Math.abs(enriched.starters.length - difficulty.desiredStarters);
    const sideDeficit = Math.max(0, difficulty.maximumSidePaths - enriched.sidePaths.length);
    const rankPressure = selection.rank.index >= 5 && suffix.length < difficulty.desiredRouteLength ? 1 : 0;
    const score = (
      outsideBand * 1_000
      + routeVariance * 100
      + starterVariance * 14
      + sideDeficit * 5
      + rankPressure * 20
    );
    candidates.push({
      startIndex,
      suffix,
      items,
      ...enriched,
      nonBaseCount,
      score,
      tie: stableHash(`${seed}|candidate|${startIndex}|${enriched.starters.map(wordKey).join("|")}`)
    });
  }

  return candidates.sort((left, right) => (
    left.score - right.score
    || left.tie - right.tie
    || left.startIndex - right.startIndex
  ));
}

/**
 * Builds a deterministic, graph-safe start profile from one already-verified,
 * dependency-ordered canonical route. It never searches the full graph.
 *
 * Required inputs:
 * - target
 * - canonicalRoute (or route)
 * - recipes and/or recipeLookup
 * - items and/or itemLookup
 *
 * The Shuffled profile is a verified suffix of the canonical route. If no
 * fair, recognizable, non-premium kit can be formed, the function returns a
 * complete Classic profile with `fallback: true`.
 */
export function createChallengeStartProfile(options = {}) {
  const target = cleanWord(options.target);
  const normalized = normalizeRoute(options.canonicalRoute ?? options.route);
  const classicStarters = [...new Map(
    (Array.isArray(options.classicStarters) ? options.classicStarters : CLASSIC_STARTERS)
      .map(cleanWord)
      .filter(Boolean)
      .map((word) => [wordKey(word), word])
  ).values()];
  if (!classicStarters.length || classicStarters.length > 6) {
    throw new TypeError("Classic starters must contain between one and six unique words.");
  }

  const recipeResolver = buildRecipeResolver(options.recipes, options.recipeLookup);
  const itemFor = buildItemResolver(options.items, options.itemLookup);
  const route = validateCanonicalRoute({
    route: normalized,
    target,
    classicStarters,
    recipeResolver
  });
  const selection = selectStartStyle({
    ...options,
    startStyle: options.startStyle ?? options.preference ?? options.style
  });
  const difficulty = difficultyFor(selection.rank, options.difficulty);
  const base = {
    target,
    route,
    classicStarters,
    itemFor,
    premiumPredicate: options.isPremium,
    selection,
    difficulty
  };

  if (selection.style === START_STYLES.CLASSIC) return classicProfile(base);

  const candidates = shuffledCandidates({
    ...base,
    recipeResolver,
    seed: String(options.seed ?? 0)
  });
  const chosen = candidates[0];
  if (!chosen) {
    return classicProfile({
      ...base,
      fallbackReason: "no_fair_shuffled_kit"
    });
  }

  const openings = [{
    a: chosen.suffix[0].a,
    b: chosen.suffix[0].b,
    word: chosen.suffix[0].word,
    kind: "route"
  }, ...chosen.sidePaths.map((path) => ({
    a: path.a,
    b: path.b,
    word: path.word,
    kind: "side_path"
  }))];
  const productiveStarters = chosen.starters.filter((word) => chosen.productiveIds.has(wordKey(word)));
  const sidePathStarters = chosen.starters.filter((word) => chosen.sideStarterIds.has(wordKey(word)));
  const hash = starterHash(chosen.starters);
  const profile = {
    version: SHUFFLED_START_VERSION,
    style: START_STYLES.SHUFFLED,
    requestedStyle: selection.requestedStyle,
    selection,
    target,
    starters: chosen.starters,
    starterItems: chosen.items,
    starterHash: hash,
    profileId: "",
    canonicalRouteLength: route.length,
    routeStartIndex: chosen.startIndex,
    challengeRoute: chosen.suffix.map((step) => ({ ...step })),
    route: chosen.suffix.map((step) => ({ ...step })),
    routeLength: chosen.suffix.length,
    productiveStarters,
    productiveStarterCount: productiveStarters.length,
    sidePathStarters,
    sidePaths: chosen.sidePaths.map((path) => ({ ...path })),
    sidePathCount: chosen.sidePaths.length,
    openings,
    hasValidOpening: true,
    fallback: false,
    fallbackReason: null,
    difficulty: {
      rankId: selection.rank.id,
      rankNumber: selection.rank.number,
      level: difficulty.level,
      requestedRouteLength: difficulty.desiredRouteLength,
      actualRouteLength: chosen.suffix.length,
      starterCount: chosen.starters.length,
      productiveStarterCount: productiveStarters.length,
      sidePathCount: chosen.sidePaths.length,
      score: Math.max(
        1,
        chosen.suffix.length * 10
        + chosen.sidePaths.length * 4
        - Math.max(0, chosen.starters.length - 3) * 2
      )
    }
  };
  profile.profileId = createProfileId({
    target,
    style: profile.style,
    starters: profile.starters,
    route: profile.route,
    rank: selection.rank,
    difficulty
  });
  return profile;
}

export const buildShuffledStart = createChallengeStartProfile;
