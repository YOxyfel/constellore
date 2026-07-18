export const RECIPE_RATINGS = Object.freeze(["logical", "surprising", "bad"]);
export const MAX_RECIPE_FEEDBACK_ENTRIES = 5000;
const MAX_RATING_COUNT = 1_000_000_000;
const ratingSet = new Set(RECIPE_RATINGS);

function cleanWord(value) {
  return String(value ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function wordKey(value) {
  return cleanWord(value).toLocaleLowerCase("en-US");
}

function stableHash(value, seed) {
  let hash = seed >>> 0;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function sanitizeRecipeRating(value) {
  const rating = String(value || "").trim().toLocaleLowerCase("en-US");
  return ratingSet.has(rating) ? rating : null;
}

export function recipeFingerprint(step) {
  const ingredients = [wordKey(step?.a), wordKey(step?.b)].filter(Boolean).sort();
  const result = wordKey(step?.word);
  if (ingredients.length !== 2 || !result) return "";
  const recipe = `${ingredients.join("+")}=>${result}`;
  return `${stableHash(recipe, 2166136261).toString(36).padStart(7, "0")}${stableHash(recipe, 2654435769).toString(36).padStart(7, "0")}`;
}

export function createRecipeFeedbackRequest({ runId, runToken, move, rating } = {}) {
  const safeRating = sanitizeRecipeRating(rating);
  const safeMove = Math.floor(Number(move));
  if (!cleanWord(runId) || !cleanWord(runToken) || !Number.isInteger(safeMove) || safeMove < 1 || !safeRating) return null;
  return { runId: cleanWord(runId), runToken: cleanWord(runToken), move: safeMove, rating: safeRating };
}

export function emptyRecipeFeedback() {
  return { version: 1, recipes: {}, totalVotes: 0, updatedAt: null };
}

export function normalizeRecipeFeedback(raw) {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const recipes = {};
  for (const [fingerprint, entry] of Object.entries(value.recipes || {}).slice(0, MAX_RECIPE_FEEDBACK_ENTRIES)) {
    if (!/^[a-z0-9]{7,16}$/.test(fingerprint) || !entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const ratings = Object.fromEntries(RECIPE_RATINGS.map((rating) => {
      const count = Number(entry.ratings?.[rating]);
      return [rating, Number.isFinite(count) ? Math.min(MAX_RATING_COUNT, Math.max(0, Math.floor(count))) : 0];
    }));
    const votes = RECIPE_RATINGS.reduce((sum, rating) => sum + ratings[rating], 0);
    if (!votes) continue;
    recipes[fingerprint] = {
      a: cleanWord(entry.a), b: cleanWord(entry.b), word: cleanWord(entry.word), source: cleanWord(entry.source || "world").slice(0, 32), ratings, votes
    };
  }
  return {
    version: 1,
    recipes,
    totalVotes: Object.values(recipes).reduce((sum, entry) => sum + entry.votes, 0),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null
  };
}

export function recordRecipeFeedback(raw, { step, rating, date = new Date() } = {}) {
  const state = normalizeRecipeFeedback(raw);
  const safeRating = sanitizeRecipeRating(rating);
  const fingerprint = recipeFingerprint(step);
  if (!safeRating || !fingerprint || !(date instanceof Date) || Number.isNaN(date.getTime())) return { state, accepted: false, fingerprint: "", reason: "invalid" };
  if (!state.recipes[fingerprint] && Object.keys(state.recipes).length >= MAX_RECIPE_FEEDBACK_ENTRIES) return { state, accepted: false, fingerprint, reason: "capacity" };
  const entry = state.recipes[fingerprint] ||= {
    a: cleanWord(step.a), b: cleanWord(step.b), word: cleanWord(step.word), source: cleanWord(step.source || "world").slice(0, 32),
    ratings: { logical: 0, surprising: 0, bad: 0 }, votes: 0
  };
  if (entry.ratings[safeRating] >= MAX_RATING_COUNT) return { state, accepted: false, fingerprint, reason: "capacity" };
  entry.ratings[safeRating] += 1;
  entry.votes += 1;
  state.totalVotes += 1;
  state.updatedAt = date.toISOString();
  return { state, accepted: true, fingerprint, reason: null, entry: structuredClone(entry) };
}

export function recipeFeedbackSummary(raw, { minimumVotes = 3, limit = 50 } = {}) {
  const state = normalizeRecipeFeedback(raw);
  const minimum = Math.max(1, Math.floor(Number(minimumVotes) || 3));
  const maximum = Math.min(200, Math.max(1, Math.floor(Number(limit) || 50)));
  return Object.entries(state.recipes)
    .filter(([, entry]) => entry.votes >= minimum)
    .map(([fingerprint, entry]) => ({
      fingerprint, ...structuredClone(entry),
      badPercent: Number((entry.ratings.bad / entry.votes * 100).toFixed(1)),
      surprisingPercent: Number((entry.ratings.surprising / entry.votes * 100).toFixed(1))
    }))
    .sort((left, right) => right.badPercent - left.badPercent || right.votes - left.votes || left.fingerprint.localeCompare(right.fingerprint))
    .slice(0, maximum);
}
