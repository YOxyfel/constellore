export const RECIPE_MASTERY_VERSION = 1;
export const MAX_MASTERY_STARS = 3;

const LIFETIME_MASTERY_TIERS = Object.freeze([
  Object.freeze({ name: "Recipe Observer", at: 0 }),
  Object.freeze({ name: "Fusion Apprentice", at: 10 }),
  Object.freeze({ name: "Recipe Cartographer", at: 25 }),
  Object.freeze({ name: "Constellation Scholar", at: 50 }),
  Object.freeze({ name: "Cosmic Archivist", at: 100 }),
  Object.freeze({ name: "Lorekeeper", at: 200 }),
  Object.freeze({ name: "Master of Orbits", at: 400 }),
  Object.freeze({ name: "Infinite Alchemist", at: 800 })
]);

const MAX_MASTERY_RECIPES = 1_000;
const MAX_WORD_LENGTH = 80;
const MAX_INDEPENDENCE_LENGTH = 160;
const DEFAULT_COLLECTION_LIMIT = 12;

const THEMES = Object.freeze([
  Object.freeze({
    id: "celestial",
    title: "Celestial Cartography",
    description: "Chart discoveries that reach beyond the atmosphere.",
    icon: "✦"
  }),
  Object.freeze({
    id: "life",
    title: "Living Worlds",
    description: "Trace the recipes that make ecosystems and creatures thrive.",
    icon: "❋"
  }),
  Object.freeze({
    id: "structure",
    title: "Crafted Realms",
    description: "Master inventions, settlements, tools, and monuments.",
    icon: "◇"
  }),
  Object.freeze({
    id: "force",
    title: "Untamed Energies",
    description: "Harness motion, weather, heat, light, and stranger forces.",
    icon: "ϟ"
  }),
  Object.freeze({
    id: "nature",
    title: "Elemental Wilds",
    description: "Explore land, water, sky, and the transformations between them.",
    icon: "◌"
  })
]);

const CELESTIAL_WORDS = /(?:^|\s)(?:astronaut|atmosphere|aurora|binary star|comet|constellation|cosmos|eclipse|galaxy|gravity|meteor|moon|nebula|orbit|planet|rocket|satellite|sky|solar|space|star|sun|telescope|universe)(?:\s|$)/i;

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function cleanText(value, maximum = MAX_WORD_LENGTH) {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function normalizedWord(value) {
  return cleanText(value).toLocaleLowerCase("en-US");
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function normalizedPair(a, b) {
  const words = [cleanText(a), cleanText(b)];
  if (!words[0] || !words[1]) return null;
  words.sort((left, right) => normalizedWord(left).localeCompare(normalizedWord(right)) || left.localeCompare(right));
  return words;
}

/** A collision-safe recipe identifier whose ingredient order is irrelevant. */
export function recipeKey(a, b, word) {
  const pair = normalizedPair(a, b);
  const result = cleanText(word);
  if (!pair || !result) return "";
  return JSON.stringify([normalizedWord(pair[0]), normalizedWord(pair[1]), normalizedWord(result)]);
}

function emptyState() {
  return { version: RECIPE_MASTERY_VERSION, recipes: [] };
}

function recipeParts(source) {
  if (!source || typeof source !== "object") return null;
  const recipe = source.recipe && typeof source.recipe === "object" ? source.recipe : null;
  const ingredients = source.ingredients
    || source.inputs
    || source.parents
    || (Array.isArray(source.recipe) ? source.recipe : null)
    || recipe?.ingredients
    || recipe?.inputs
    || recipe?.parents;
  const resultObject = source.result && typeof source.result === "object" ? source.result : null;
  const a = source.a ?? source.left ?? source.inputA ?? recipe?.a ?? recipe?.left ?? ingredients?.[0];
  const b = source.b ?? source.right ?? source.inputB ?? recipe?.b ?? recipe?.right ?? ingredients?.[1];
  const word = source.word
    ?? (typeof source.result === "string" ? source.result : null)
    ?? source.output
    ?? resultObject?.word
    ?? recipe?.word
    ?? recipe?.result;
  const pair = normalizedPair(a, b);
  const result = cleanText(word);
  if (!pair || !result) return null;
  return {
    key: recipeKey(pair[0], pair[1], result),
    a: pair[0],
    b: pair[1],
    word: result,
    emoji: cleanText(source.emoji ?? resultObject?.emoji ?? recipe?.emoji, 16),
    category: normalizedWord(source.category ?? resultObject?.category ?? recipe?.category).slice(0, 32)
  };
}

function rawRecipeEntries(raw) {
  if (!raw || typeof raw !== "object") return [];
  for (const candidate of [raw.recipes, raw.masteredRecipes, raw.entries, raw.mastery]) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      return Object.entries(candidate).map(([key, value]) => (
        value && typeof value === "object" ? { legacyKey: key, ...value } : { legacyKey: key, discoveries: value }
      ));
    }
  }
  return [];
}

function rawProofs(source) {
  for (const candidate of [source.proofs, source.independentKeys, source.runIds, source.runs, source.sessions]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function normalizeStoredRecipe(source) {
  const recipe = recipeParts(source);
  if (!recipe) return null;
  const proofs = [];
  for (const value of rawProofs(source)) {
    const token = cleanText(value, MAX_INDEPENDENCE_LENGTH);
    if (!token) continue;
    const fingerprint = /^p-[a-z0-9]{7}$/.test(token) ? token : `p-${stableHash(`${recipe.key}|${token}`)}`;
    if (!proofs.includes(fingerprint)) proofs.push(fingerprint);
    if (proofs.length === MAX_MASTERY_STARS) break;
  }
  const legacyCount = clampInteger(source.stars ?? source.discoveries ?? source.count ?? source.mastery, 0, MAX_MASTERY_STARS, 0);
  while (proofs.length < legacyCount) proofs.push(`p-${stableHash(`${recipe.key}|legacy|${proofs.length}`)}`);
  if (!proofs.length) return null;
  return {
    key: recipe.key,
    a: recipe.a,
    b: recipe.b,
    word: recipe.word,
    discoveries: proofs.length,
    stars: proofs.length,
    proofs
  };
}

/**
 * Migrates legacy mastery shapes and returns a small JSON-safe profile value.
 * Invalid recipes, raw run identifiers, unknown fields, and excess entries are
 * discarded. Inputs are never mutated.
 */
export function sanitizeRecipeMasteryState(raw) {
  if (!raw || typeof raw !== "object") return emptyState();
  const merged = new Map();
  for (const source of rawRecipeEntries(raw)) {
    const entry = normalizeStoredRecipe(source);
    if (!entry) continue;
    const existing = merged.get(entry.key);
    if (!existing) {
      merged.set(entry.key, entry);
      continue;
    }
    for (const proof of entry.proofs) {
      if (!existing.proofs.includes(proof) && existing.proofs.length < MAX_MASTERY_STARS) existing.proofs.push(proof);
    }
    existing.discoveries = existing.proofs.length;
    existing.stars = existing.proofs.length;
  }
  const recipes = [...merged.values()]
    .sort((left, right) => left.key.localeCompare(right.key))
    .slice(0, MAX_MASTERY_RECIPES)
    .map((entry) => ({ ...entry, proofs: [...entry.proofs] }));
  return { version: RECIPE_MASTERY_VERSION, recipes };
}

function unchangedRecordResult(state, reason, extras = {}) {
  return { state, recipe: null, awardedStar: false, duplicate: false, capped: false, reason, ...extras };
}

/**
 * Awards at most one star for a recipe in each independent run/session. Three
 * stars is full mastery. Study and revealed combinations deliberately earn
 * no mastery progress.
 */
export function recordRecipeDiscovery(rawState, discovery = {}) {
  const state = sanitizeRecipeMasteryState(rawState);
  const recipe = recipeParts(discovery);
  if (!recipe) return unchangedRecordResult(state, "invalid_recipe");
  if (discovery.assisted || discovery.revealed || discovery.independent === false) return unchangedRecordResult(state, "assisted");

  const independence = cleanText(
    discovery.independentId ?? discovery.runId ?? discovery.sessionId ?? discovery.gameId,
    MAX_INDEPENDENCE_LENGTH
  );
  if (!independence) return unchangedRecordResult(state, "missing_independence_key");
  const fingerprint = `p-${stableHash(`${recipe.key}|${independence}`)}`;
  const index = state.recipes.findIndex((entry) => entry.key === recipe.key);
  const previous = index >= 0 ? state.recipes[index] : null;
  if (previous?.proofs.includes(fingerprint)) {
    return { state, recipe: { ...previous, proofs: [...previous.proofs] }, awardedStar: false, duplicate: true, capped: previous.stars >= MAX_MASTERY_STARS, reason: "duplicate" };
  }
  if (previous?.stars >= MAX_MASTERY_STARS) {
    return { state, recipe: { ...previous, proofs: [...previous.proofs] }, awardedStar: false, duplicate: false, capped: true, reason: "mastered" };
  }
  if (!previous && state.recipes.length >= MAX_MASTERY_RECIPES) return unchangedRecordResult(state, "limit");

  const nextRecipe = previous ? { ...previous, proofs: [...previous.proofs, fingerprint] } : {
    key: recipe.key,
    a: recipe.a,
    b: recipe.b,
    word: recipe.word,
    discoveries: 0,
    stars: 0,
    proofs: [fingerprint]
  };
  nextRecipe.discoveries = nextRecipe.proofs.length;
  nextRecipe.stars = nextRecipe.proofs.length;
  const recipes = state.recipes.map((entry) => ({ ...entry, proofs: [...entry.proofs] }));
  if (index >= 0) recipes[index] = nextRecipe;
  else recipes.push(nextRecipe);
  recipes.sort((left, right) => left.key.localeCompare(right.key));
  const nextState = { version: RECIPE_MASTERY_VERSION, recipes };
  return { state: nextState, recipe: { ...nextRecipe, proofs: [...nextRecipe.proofs] }, awardedStar: true, duplicate: false, capped: nextRecipe.stars >= MAX_MASTERY_STARS, reason: "awarded" };
}

function collectionTheme(recipe) {
  if (CELESTIAL_WORDS.test(recipe.word)) return "celestial";
  if (["life", "structure", "force", "nature"].includes(recipe.category)) return recipe.category;
  return "nature";
}

function candidateRecipes({ concepts = [], recipes = [], history = [] } = {}) {
  const metadata = new Map();
  for (const concept of Array.isArray(concepts) ? concepts : []) {
    const word = normalizedWord(concept?.word);
    if (word) metadata.set(word, {
      emoji: cleanText(concept?.emoji, 16),
      category: normalizedWord(concept?.category).slice(0, 32)
    });
  }
  const merged = new Map();
  const sources = [
    ...(Array.isArray(recipes) ? recipes : []),
    ...(Array.isArray(concepts) ? concepts : []),
    ...(Array.isArray(history) ? history : [])
  ];
  for (const source of sources) {
    const candidate = recipeParts(source);
    if (!candidate) continue;
    const fallback = metadata.get(normalizedWord(candidate.word));
    if (!candidate.emoji) candidate.emoji = fallback?.emoji || "✦";
    if (!candidate.category) candidate.category = fallback?.category || "nature";
    if (!merged.has(candidate.key)) merged.set(candidate.key, candidate);
  }
  return [...merged.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function knownRecipeKeys(history, mastery) {
  const keys = new Set(mastery.recipes.map((entry) => entry.key));
  for (const step of Array.isArray(history) ? history : []) {
    const recipe = recipeParts(step);
    if (recipe) keys.add(recipe.key);
  }
  return keys;
}

function knownWords(discovered) {
  const words = new Set();
  for (const value of Array.isArray(discovered) ? discovered : []) {
    const word = normalizedWord(typeof value === "string" ? value : value?.word);
    if (word) words.add(word);
  }
  return words;
}

function masteryEntryMap(state) {
  return new Map(state.recipes.map((entry) => [entry.key, entry]));
}

function unlockedEntry(recipe, mastery) {
  return {
    id: `recipe-${stableHash(recipe.key)}`,
    locked: false,
    a: recipe.a,
    b: recipe.b,
    word: recipe.word,
    emoji: recipe.emoji || "✦",
    category: recipe.category,
    stars: mastery?.stars || 0,
    maxStars: MAX_MASTERY_STARS,
    mastered: (mastery?.stars || 0) >= MAX_MASTERY_STARS
  };
}

function lockedEntry(recipe, theme) {
  return {
    id: `locked-${stableHash(recipe.key)}`,
    locked: true,
    silhouette: "✦  ·  ✦",
    clue: `An undiscovered recipe awaits in ${theme.title}.`,
    stars: 0,
    maxStars: MAX_MASTERY_STARS,
    mastered: false
  };
}

/** Calculates unlock and star completion for any render-compatible collection. */
export function collectionProgress(collection) {
  const entries = Array.isArray(collection?.entries) ? collection.entries : [];
  const total = entries.length;
  const unlocked = entries.filter((entry) => !entry?.locked).length;
  const mastered = entries.filter((entry) => !entry?.locked && Number(entry?.stars) >= MAX_MASTERY_STARS).length;
  const stars = entries.reduce((sum, entry) => sum + clampInteger(entry?.stars, 0, MAX_MASTERY_STARS, 0), 0);
  const maxStars = total * MAX_MASTERY_STARS;
  return {
    total,
    unlocked,
    mastered,
    stars,
    maxStars,
    completionPercent: total ? Math.round((unlocked / total) * 100) : 0,
    masteryPercent: maxStars ? Math.round((stars / maxStars) * 100) : 0,
    completed: total > 0 && unlocked === total,
    fullyMastered: total > 0 && mastered === total
  };
}

/**
 * Builds stable themed collections from the recipes already present in a world
 * catalog and run history. Locked render entries contain neither their result
 * word nor a reversible recipe key.
 */
export function buildMasteryCollections({
  concepts = [],
  recipes = [],
  history = [],
  discovered = [],
  state: rawState,
  limitPerCollection = DEFAULT_COLLECTION_LIMIT
} = {}) {
  const state = sanitizeRecipeMasteryState(rawState);
  const candidates = candidateRecipes({ concepts, recipes, history });
  const exactKnown = knownRecipeKeys(history, state);
  const wordsKnown = knownWords(discovered);
  const masteryByKey = masteryEntryMap(state);
  const limit = clampInteger(limitPerCollection, 1, 50, DEFAULT_COLLECTION_LIMIT);

  return THEMES.map((theme) => {
    const selected = candidates
      .filter((recipe) => collectionTheme(recipe) === theme.id)
      .sort((left, right) => stableHash(`${theme.id}|${left.key}`).localeCompare(stableHash(`${theme.id}|${right.key}`))
        || left.key.localeCompare(right.key))
      .slice(0, limit);
    const entries = selected.map((recipe) => {
      const known = exactKnown.has(recipe.key) || wordsKnown.has(normalizedWord(recipe.word));
      return known ? unlockedEntry(recipe, masteryByKey.get(recipe.key)) : lockedEntry(recipe, theme);
    });
    const collection = { ...theme, entries };
    return { ...collection, progress: collectionProgress(collection) };
  }).filter((collection) => collection.entries.length > 0);
}

/** Produces one compact aggregate suitable for a profile or collection header. */
export function summarizeMasteryCollections(collections) {
  const list = Array.isArray(collections) ? collections : [];
  const totals = list.reduce((summary, collection) => {
    const progress = collectionProgress(collection);
    summary.total += progress.total;
    summary.unlocked += progress.unlocked;
    summary.mastered += progress.mastered;
    summary.stars += progress.stars;
    summary.maxStars += progress.maxStars;
    if (progress.completed) summary.completedCollections += 1;
    if (progress.fullyMastered) summary.masteredCollections += 1;
    return summary;
  }, { total: 0, unlocked: 0, mastered: 0, stars: 0, maxStars: 0, completedCollections: 0, masteredCollections: 0 });
  return {
    ...totals,
    collections: list.length,
    completionPercent: totals.total ? Math.round((totals.unlocked / totals.total) * 100) : 0,
    masteryPercent: totals.maxStars ? Math.round((totals.stars / totals.maxStars) * 100) : 0
  };
}

/**
 * Summarizes every stored recipe, not only the small rotating Atlas sample.
 * The final title repeats in 800-star constellations, so mastery never caps.
 */
export function lifetimeMasteryProgress(rawState) {
  const state = sanitizeRecipeMasteryState(rawState);
  const stars = state.recipes.reduce((sum, recipe) => sum + clampInteger(recipe.stars, 0, MAX_MASTERY_STARS, 0), 0);
  const masteredRecipes = state.recipes.filter((recipe) => recipe.stars >= MAX_MASTERY_STARS).length;
  let tierIndex = LIFETIME_MASTERY_TIERS.findLastIndex((tier) => stars >= tier.at);
  tierIndex = Math.max(0, tierIndex);
  const finalTier = LIFETIME_MASTERY_TIERS.at(-1);
  let title = LIFETIME_MASTERY_TIERS[tierIndex].name;
  let currentAt = LIFETIME_MASTERY_TIERS[tierIndex].at;
  let nextAt = LIFETIME_MASTERY_TIERS[tierIndex + 1]?.at ?? null;
  if (stars >= finalTier.at) {
    const constellation = Math.floor((stars - finalTier.at) / finalTier.at) + 1;
    title = `Infinite Alchemist ${constellation}`;
    currentAt = finalTier.at * constellation;
    nextAt = finalTier.at * (constellation + 1);
  }
  const span = Math.max(1, (nextAt ?? currentAt + 1) - currentAt);
  return {
    stars,
    recipes: state.recipes.length,
    masteredRecipes,
    title,
    tier: tierIndex + 1,
    currentAt,
    nextAt,
    remaining: nextAt == null ? 0 : Math.max(0, nextAt - stars),
    progress: nextAt == null ? 100 : Math.min(100, Math.round(((stars - currentAt) / span) * 100))
  };
}
