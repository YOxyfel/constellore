export const RECIPE_INSIGHT_MAX_TEXT = 240;
export const RECIPE_INSIGHT_MAX_WORD = 48;
export const RECIPE_INSIGHT_MAX_RECIPES = 512;
export const RECIPE_INSIGHT_CATEGORIES = Object.freeze(["force", "nature", "life", "structure"]);

const CATEGORY_SET = new Set(RECIPE_INSIGHT_CATEGORIES);
const CATEGORY_LABELS = Object.freeze({
  force: "force-driven",
  nature: "natural",
  life: "living",
  structure: "built or crafted"
});
const AUTHORED_SOURCES = new Set(["authored", "curated", "local-world", "world"]);
const DYNAMIC_SOURCES = new Set(["ai", "ai-route", "market", "semantic", "user", "wish"]);

function repeatedFragment(value) {
  const compact = value.toLocaleLowerCase("en-US").replace(/[ '\-]/g, "");
  if (compact.length < 6) return false;
  for (let size = 1; size <= Math.min(12, Math.floor(compact.length / 3)); size += 1) {
    const fragment = compact.slice(0, size);
    if (fragment.repeat(compact.length / size) === compact && compact.length / size >= 3) return true;
  }
  return false;
}

/** Accepts a displayable concept only; whitespace is normalized while objects, markup, URLs, and repeated filler fail closed. */
export function sanitizeInsightWord(value) {
  if (typeof value !== "string") return "";
  let clean;
  try {
    clean = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  } catch {
    return "";
  }
  if (!clean || clean.length > RECIPE_INSIGHT_MAX_WORD) return "";
  if (!/^[\p{L}\p{N}]+(?:[ '\-][\p{L}\p{N}]+)*$/u.test(clean)) return "";
  if (clean.split(" ").length > 6 || /(.)\1{5}/iu.test(clean) || repeatedFragment(clean)) return "";
  if (/^(?:null|undefined|nan|infinity)$/iu.test(clean)) return "";
  return clean;
}

export function sanitizeInsightCategory(value) {
  if (typeof value !== "string") return "";
  const clean = value.trim().toLocaleLowerCase("en-US");
  return CATEGORY_SET.has(clean) ? clean : "";
}

function wordKey(value) {
  return value.toLocaleLowerCase("en-US");
}

function pairKey(a, b) {
  return [wordKey(a), wordKey(b)].sort().join("+");
}

function overrideKey(a, b, result) {
  return `${pairKey(a, b)}=>${wordKey(result)}`;
}

const SUCCESS_OVERRIDES = new Map([
  [["Earth", "Water", "Mud"], "Water softens loose earth; together they become mud."],
  [["Fire", "Water", "Steam"], "Fire heats water until it rises as steam."],
  [["Air", "Water", "Mist"], "Tiny drops of water suspended in air form mist."],
  [["Air", "Earth", "Dust"], "Moving air lifts fine pieces of earth into dust."],
  [["Earth", "Fire", "Lava"], "Extreme heat melts earth and stone into lava."],
  [["Air", "Fire", "Energy"], "Air feeds fire, intensifying it into released energy."],
  [["Mud", "Fire", "Brick"], "Fire dries and hardens shaped mud into brick."],
  [["Lava", "Water", "Stone"], "Water cools molten lava until it solidifies as stone."],
  [["Earth", "Energy", "Life"], "In Constellore's world, energy awakening the earth represents life."],
  [["Air", "Life", "Bird"], "Life adapted to move through air becomes a bird."],
  [["Air", "Species", "Bird"], "A species adapted to the air becomes a bird."],
  [["Life", "Water", "Fish"], "Life adapted to water becomes a fish."],
  [["Brick", "Brick", "Wall"], "Bricks joined and repeated create a wall."],
  [["Wall", "Wall", "House"], "Walls enclosing a shared space create a house."],
  [["Water", "Water", "Ocean"], "Water gathered on a vast scale becomes an ocean."],
  [["Fire", "Fire", "Inferno"], "Fire feeding more fire grows into an inferno."],
  [["Air", "Air", "Wind"], "Air moving against more air becomes wind."],
  [["Earth", "Earth", "Land"], "Earth joined across a wider area becomes land."],
  [["Fire", "Sand", "Glass"], "Intense heat melts sand into glass."],
  [["Glass", "Sky", "Telescope"], "Glass shaped to study the sky becomes a telescope."],
  [["Machine", "Sky", "Rocket"], "A machine designed to travel beyond the sky becomes a rocket."],
  [["House", "Rocket", "Space Station"], "A habitat carried into orbit becomes a space station."],
  [["Cloud", "Energy", "Storm"], "Energy charging a cloud builds it into a storm."],
  [["Energy", "Storm", "Lightning"], "A storm releasing stored energy produces lightning."]
].map(([[a, b, result], text]) => [overrideKey(a, b, result), text]));

function optionalCategory(source, key) {
  const value = source[key];
  if (value == null || value === "") return { valid: true, value: "" };
  const category = sanitizeInsightCategory(value);
  return { valid: Boolean(category), value: category };
}

function sanitizeAuthoredRecipe(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  try {
    const a = sanitizeInsightWord(raw.a);
    const b = sanitizeInsightWord(raw.b);
    const result = sanitizeInsightWord(raw.word ?? raw.result);
    if (!a || !b || !result || raw.authored === false) return null;
    const source = typeof raw.source === "string" ? raw.source.trim().toLocaleLowerCase("en-US") : "";
    if (source && (!AUTHORED_SOURCES.has(source) || DYNAMIC_SOURCES.has(source))) return null;
    const categoryA = optionalCategory(raw, "categoryA");
    const categoryB = optionalCategory(raw, "categoryB");
    const category = optionalCategory(raw, "category");
    if (!categoryA.valid || !categoryB.valid || !category.valid) return null;
    const ingredients = [
      { word: a, category: categoryA.value },
      { word: b, category: categoryB.value }
    ].sort((left, right) => wordKey(left.word) < wordKey(right.word) ? -1 : wordKey(left.word) > wordKey(right.word) ? 1 : 0);
    return {
      a: ingredients[0].word,
      b: ingredients[1].word,
      categoryA: ingredients[0].category,
      categoryB: ingredients[1].category,
      result,
      category: category.value
    };
  } catch {
    return null;
  }
}

function boundedText(value) {
  return String(value || "").replace(/\s+/gu, " ").trim().slice(0, RECIPE_INSIGHT_MAX_TEXT);
}

function categoryPairText(categoryA, categoryB, a, b, result) {
  const categories = [categoryA, categoryB].filter(Boolean).sort();
  const pair = categories.join("+");
  const templates = {
    "force+force": `${a} and ${b} interact as forces, producing ${result}.`,
    "force+life": `A force acting on a living idea links ${a} and ${b} into ${result}.`,
    "force+nature": `A force transforms a natural material or environment, linking ${a} and ${b} into ${result}.`,
    "force+structure": `Energy or motion acts on something built, linking ${a} and ${b} into ${result}.`,
    "life+life": `Two living ideas combine through growth, grouping, or adaptation to produce ${result}.`,
    "life+nature": `Life interacting with its environment links ${a} and ${b} into ${result}.`,
    "life+structure": `A living idea using or inhabiting something built links ${a} and ${b} into ${result}.`,
    "nature+nature": `Two natural materials or environments combine and produce ${result}.`,
    "nature+structure": `A natural material or place meets something built, linking ${a} and ${b} into ${result}.`,
    "structure+structure": `Two built or crafted ideas assemble at a larger scale to produce ${result}.`
  };
  if (templates[pair]) return templates[pair];
  const knownCategory = categoryA || categoryB;
  if (knownCategory) return `This authored recipe connects ${a} and ${b} through a ${CATEGORY_LABELS[knownCategory]} relationship, producing ${result}.`;
  return `${a} and ${b} have an authored conceptual relationship that produces ${result}.`;
}

/** Returns a bounded explanation only for a sanitized authored recipe. */
export function explainSuccessfulRecipe(rawRecipe) {
  const recipe = sanitizeAuthoredRecipe(rawRecipe);
  if (!recipe) return null;
  const override = SUCCESS_OVERRIDES.get(overrideKey(recipe.a, recipe.b, recipe.result));
  const text = override || (wordKey(recipe.a) === wordKey(recipe.b)
    ? `Repeating ${recipe.a} scales one idea into ${recipe.result}.`
    : categoryPairText(recipe.categoryA, recipe.categoryB, recipe.a, recipe.b, recipe.result));
  return Object.freeze({
    kind: "success",
    authored: true,
    override: Boolean(override),
    a: recipe.a,
    b: recipe.b,
    result: recipe.result,
    category: recipe.category,
    text: boundedText(text)
  });
}

function sanitizeDiscovered(raw) {
  const items = Array.isArray(raw) ? raw.slice(0, 256) : [];
  const entries = new Map();
  for (const item of items) {
    try {
      const object = item && typeof item === "object" && !Array.isArray(item) ? item : null;
      const word = sanitizeInsightWord(object ? object.word : item);
      if (!word) continue;
      const suppliedCategory = object?.category;
      const category = suppliedCategory == null || suppliedCategory === "" ? "" : sanitizeInsightCategory(suppliedCategory);
      if (suppliedCategory != null && suppliedCategory !== "" && !category) continue;
      entries.set(wordKey(word), { word, category });
    } catch { /* One hostile entry cannot poison otherwise safe guidance. */ }
  }
  return entries;
}

function safeCategoryPopulation(discovered, category, excluded) {
  if (!category) return 0;
  let count = 0;
  for (const [key, item] of discovered) {
    if (!excluded.has(key) && item.category === category) count += 1;
  }
  return count;
}

function nearMissResult(direction, text) {
  return Object.freeze({
    kind: "near-miss",
    direction,
    spoilerSafe: true,
    text: boundedText(text)
  });
}

/**
 * Gives directional feedback for a failed pair. Candidate results and partner
 * words are used only for selection and are never returned or interpolated.
 */
export function explainRecipeNearMiss(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  try {
    const a = sanitizeInsightWord(raw.a);
    const b = sanitizeInsightWord(raw.b);
    if (!a || !b) return null;
    const categoryA = optionalCategory(raw, "categoryA");
    const categoryB = optionalCategory(raw, "categoryB");
    if (!categoryA.valid || !categoryB.valid) return null;

    if (wordKey(a) === wordKey(b)) {
      return nearMissResult("repetition", "This repetition has no authored result. Same-word fusions work when doubling naturally scales an idea; otherwise change one side.");
    }

    const discovered = sanitizeDiscovered(raw.discovered);
    const attempted = new Set([wordKey(a), wordKey(b)]);
    const candidates = [];
    const categoryPairs = new Set();
    const recipes = Array.isArray(raw.recipes) ? raw.recipes.slice(0, RECIPE_INSIGHT_MAX_RECIPES) : [];
    for (const rawRecipe of recipes) {
      const recipe = sanitizeAuthoredRecipe(rawRecipe);
      if (!recipe || pairKey(recipe.a, recipe.b) === pairKey(a, b)) continue;
      if (recipe.categoryA && recipe.categoryB) categoryPairs.add([recipe.categoryA, recipe.categoryB].sort().join("+"));
      for (const anchor of [a, b]) {
        const anchorKey = wordKey(anchor);
        if (wordKey(recipe.a) === anchorKey) candidates.push({ anchor, partnerCategory: recipe.categoryB, sortKey: `${anchorKey}:${pairKey(recipe.a, recipe.b)}` });
        else if (wordKey(recipe.b) === anchorKey) candidates.push({ anchor, partnerCategory: recipe.categoryA, sortKey: `${anchorKey}:${pairKey(recipe.a, recipe.b)}` });
      }
    }

    candidates.sort((left, right) => {
      const leftSpecific = safeCategoryPopulation(discovered, left.partnerCategory, attempted) >= 2 ? 0 : 1;
      const rightSpecific = safeCategoryPopulation(discovered, right.partnerCategory, attempted) >= 2 ? 0 : 1;
      if (leftSpecific !== rightSpecific) return leftSpecific - rightSpecific;
      const leftInput = wordKey(left.anchor) === wordKey(a) ? 0 : 1;
      const rightInput = wordKey(right.anchor) === wordKey(a) ? 0 : 1;
      if (leftInput !== rightInput) return leftInput - rightInput;
      return left.sortKey < right.sortKey ? -1 : left.sortKey > right.sortKey ? 1 : 0;
    });

    const candidate = candidates[0];
    if (candidate) {
      const categoryCount = safeCategoryPopulation(discovered, candidate.partnerCategory, attempted);
      if (categoryCount >= 2) {
        return nearMissResult("anchor-category", `${candidate.anchor} is a promising anchor. Try it with a different discovered ${CATEGORY_LABELS[candidate.partnerCategory]} concept.`);
      }
      return nearMissResult("anchor", `${candidate.anchor} is a promising anchor, but this pairing is off. Keep that idea and change the other side.`);
    }

    const attemptedCategoryPair = [categoryA.value, categoryB.value].filter(Boolean).sort().join("+");
    if (attemptedCategoryPair && categoryPairs.has(attemptedCategoryPair)) {
      return nearMissResult("category-family", "This general relationship can work, but not with this exact pair. Change one side and test another discovered concept in the same families.");
    }
    return nearMissResult("explore", "These two ideas have no authored result. Change one side and look for a clearer material, force, living, or built relationship.");
  } catch {
    return null;
  }
}
