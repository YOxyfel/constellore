export const HERO_RECIPE_INTERVAL_MS = 4_800;

export const HERO_RECIPES = Object.freeze([
  Object.freeze({ a: "Earth", aEmoji: "🌍", b: "Water", bEmoji: "💧", result: "Mud", resultEmoji: "🟤" }),
  Object.freeze({ a: "Fire", aEmoji: "🔥", b: "Water", bEmoji: "💧", result: "Steam", resultEmoji: "♨️" }),
  Object.freeze({ a: "Species", aEmoji: "🧬", b: "Air", bEmoji: "💨", result: "Bird", resultEmoji: "🐦" }),
  Object.freeze({ a: "Brick", aEmoji: "🧱", b: "Brick", bEmoji: "🧱", result: "Wall", resultEmoji: "🧱" }),
  Object.freeze({ a: "Fire", aEmoji: "🔥", b: "Sand", bEmoji: "🏖️", result: "Glass", resultEmoji: "🪟" }),
  Object.freeze({ a: "Light", aEmoji: "✨", b: "Rain", bEmoji: "🌧️", result: "Rainbow", resultEmoji: "🌈" })
]);

export function heroRecipeLabel(recipe) {
  return `Example: ${recipe.a} plus ${recipe.b} makes ${recipe.result}`;
}

export function nextHeroRecipeIndex(index, count = HERO_RECIPES.length) {
  return count > 0 ? (Math.max(0, Number(index) || 0) + 1) % count : 0;
}

export function renderHeroRecipe(root, recipe) {
  if (!root || !recipe) return false;
  const fields = {
    a: recipe.a.toUpperCase(),
    "a-emoji": recipe.aEmoji,
    b: recipe.b.toUpperCase(),
    "b-emoji": recipe.bEmoji,
    result: recipe.result.toUpperCase(),
    "result-emoji": recipe.resultEmoji
  };
  for (const [field, value] of Object.entries(fields)) {
    const node = root.querySelector(`[data-hero-recipe="${field}"]`);
    if (!node) return false;
    node.textContent = value;
  }
  root.setAttribute("aria-label", heroRecipeLabel(recipe));
  return true;
}

export function createHeroRecipeRotator({
  root = globalThis.document?.querySelector("#heroRecipeExample"),
  recipes = HERO_RECIPES,
  intervalMs = HERO_RECIPE_INTERVAL_MS,
  documentRef = globalThis.document,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval
} = {}) {
  if (!root || recipes.length < 2 || typeof setIntervalFn !== "function") {
    return Object.freeze({ stop() {} });
  }

  let index = 0;
  let cycle = 0;
  let timer = null;

  const advance = () => {
    if (documentRef?.hidden) return;
    index = nextHeroRecipeIndex(index, recipes.length);
    cycle += 1;
    renderHeroRecipe(root, recipes[index]);
    root.dataset.cycle = cycle % 2 ? "odd" : "even";
  };
  const start = () => {
    if (timer === null) timer = setIntervalFn(advance, intervalMs);
  };
  const pause = () => {
    if (timer !== null && typeof clearIntervalFn === "function") clearIntervalFn(timer);
    timer = null;
  };
  const onVisibilityChange = () => {
    if (documentRef?.hidden) pause();
    else start();
  };

  documentRef?.addEventListener?.("visibilitychange", onVisibilityChange);
  start();

  return Object.freeze({
    advance,
    stop() {
      pause();
      documentRef?.removeEventListener?.("visibilitychange", onVisibilityChange);
    }
  });
}

if (globalThis.document) createHeroRecipeRotator();
