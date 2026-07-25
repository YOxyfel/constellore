const MAX_RECIPES = 12_000;
const MAX_AVAILABLE = 1_500;
const MAX_DEPTH = 80;
const graphCache = new WeakMap();

function cleanWord(value) {
  const source = value && typeof value === "object" ? value.word : value;
  return String(source || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function wordKey(value) {
  return cleanWord(value).toLocaleLowerCase("en-US");
}

function recipeValues(source) {
  if (source instanceof Map) return [...source.values()];
  if (Array.isArray(source)) return source;
  return source && typeof source[Symbol.iterator] === "function" ? [...source] : [];
}

function cleanRecipes(source) {
  const values = recipeValues(source);
  const recipes = [];
  const seen = new Set();
  for (const value of values.slice(0, MAX_RECIPES)) {
    const a = cleanWord(value?.a);
    const b = cleanWord(value?.b);
    const word = cleanWord(value?.word);
    if (!a || !b || !word) continue;
    const pair = [wordKey(a), wordKey(b)].sort().join("+");
    const id = `${wordKey(word)}=${pair}`;
    if (seen.has(id)) continue;
    seen.add(id);
    recipes.push({ a, b, word, pair, id });
  }
  return recipes.sort((left, right) => left.id.localeCompare(right.id));
}

export function createAuthoredRouteGraph(source = []) {
  if (source && typeof source === "object" && graphCache.has(source)) return graphCache.get(source);
  const byResult = new Map();
  for (const recipe of cleanRecipes(source)) {
    const key = wordKey(recipe.word);
    if (!byResult.has(key)) byResult.set(key, []);
    byResult.get(key).push(recipe);
  }
  const graph = Object.freeze({ byResult });
  if (source && typeof source === "object") graphCache.set(source, graph);
  return graph;
}

function signatureFor(steps) {
  return [...steps.entries()]
    .map(([result, pair]) => `${result}=${pair}`)
    .sort()
    .join("|");
}

function betterPlan(candidate, existing) {
  return !existing
    || candidate.steps.size < existing.steps.size
    || (candidate.steps.size === existing.steps.size && candidate.signature < existing.signature);
}

/**
 * Finds the shortest plan known by the reviewed recipe graph from everything
 * already in the player's inventory. It returns only a number, never a recipe
 * or bridge word, so callers can show honest progress without giving an answer
 * away.
 */
export function authoredMovesRemaining({
  recipes: rawRecipes = [],
  graph: providedGraph = null,
  extraRecipes = [],
  available: rawAvailable = [],
  target = ""
} = {}) {
  const targetKey = wordKey(target);
  if (!targetKey) return null;
  const available = rawAvailable instanceof Map
    ? [...rawAvailable.keys()]
    : rawAvailable instanceof Set
      ? [...rawAvailable]
      : Array.isArray(rawAvailable)
        ? rawAvailable
        : [];
  const plans = new Map();
  for (const value of available.slice(0, MAX_AVAILABLE)) {
    const key = wordKey(value);
    if (key) plans.set(key, { steps: new Map(), signature: "" });
  }
  if (plans.has(targetKey)) return 0;

  const graph = providedGraph?.byResult instanceof Map ? providedGraph : createAuthoredRouteGraph(rawRecipes);
  const extraByResult = createAuthoredRouteGraph(extraRecipes).byResult;
  const memo = new Map(plans);
  const visiting = new Set();

  const solve = (resultKey, depth = 0) => {
    if (memo.has(resultKey)) return memo.get(resultKey);
    if (depth >= MAX_DEPTH || visiting.has(resultKey)) return null;
    visiting.add(resultKey);
    let best = null;
    const candidates = [
      ...(graph.byResult.get(resultKey) || []),
      ...(extraByResult.get(resultKey) || [])
    ];
    for (const recipe of candidates) {
      const leftKey = wordKey(recipe.a);
      const rightKey = wordKey(recipe.b);
      const left = solve(leftKey, depth + 1);
      if (!left) continue;
      const right = leftKey === rightKey ? left : solve(rightKey, depth + 1);
      if (!right) continue;
      const steps = new Map(left.steps);
      for (const [key, pair] of right.steps) if (!steps.has(key)) steps.set(key, pair);
      if (steps.has(resultKey)) continue;
      steps.set(resultKey, recipe.pair);
      const candidate = { steps, signature: signatureFor(steps) };
      if (betterPlan(candidate, best)) best = candidate;
    }
    visiting.delete(resultKey);
    memo.set(resultKey, best);
    return best;
  };

  return solve(targetKey)?.steps.size ?? null;
}

export function sanitizeAuthoredRouteProgress(value, fallbackTotal = 0) {
  const fallback = Math.max(0, Math.min(999, Math.trunc(Number(fallbackTotal) || 0)));
  const total = Math.max(0, Math.min(999, Math.trunc(Number(value?.total) || fallback)));
  const rawRemaining = Number(value?.remaining);
  const remaining = Number.isFinite(rawRemaining)
    ? Math.max(0, Math.min(total || 999, Math.trunc(rawRemaining)))
    : total;
  const complete = Boolean(value?.complete === true || (total > 0 && remaining === 0));
  const percent = complete
    ? 100
    : total > 0
      ? Math.max(0, Math.min(99, Math.round(((total - remaining) / total) * 100)))
      : 0;
  return Object.freeze({ total, remaining, complete, percent });
}

export function buildAuthoredRouteProgress({ recipes = [], graph = null, extraRecipes = [], available = [], target = "", total = 0 } = {}) {
  const safeTotal = Math.max(0, Math.min(999, Math.trunc(Number(total) || 0)));
  const remaining = authoredMovesRemaining({ recipes, graph, extraRecipes, available, target });
  return sanitizeAuthoredRouteProgress({
    total: safeTotal || (remaining ?? 0),
    remaining: remaining ?? safeTotal,
    complete: remaining === 0
  }, safeTotal);
}
