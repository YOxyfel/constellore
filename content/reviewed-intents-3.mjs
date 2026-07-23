import { createHash } from "node:crypto";
import { EXPANDED_RECIPES } from "./expanded-recipes.mjs";
import { EXPECTED_OBVIOUS_ATTEMPTS, worldGraphPairKey } from "./world-graph-3.mjs";

// Updating this digest is an explicit editorial act. It prevents the reviewed
// corpus from silently changing just because a recipe result was edited.
export const REVIEWED_EXPANSION_INTENT_DIGEST = "ccec748412095a2974c9c365c7033b43a972321fc029323d56ec491c9d6165d6";

const normalize = (value) => String(value || "").trim();

function freezeAttempt({ a, b, acceptedOutputs, weight = 1, reason, provenance }) {
  return Object.freeze({
    a: normalize(a),
    b: normalize(b),
    acceptedOutputs: Object.freeze([...new Set(acceptedOutputs.map(normalize).filter(Boolean))]),
    weight: Math.max(1, Number(weight) || 1),
    reason,
    provenance: Object.freeze({ ...provenance })
  });
}

// This corpus is deliberately sourced from two reviewed layers:
// 1. high-signal/player-reported expectations, which carry extra weight; and
// 2. the hand-reviewed expansion, whose uniqueness, explanations, progressive
//    reachability, and result concentration are independently validated.
// It never invents same-word expectations just to raise the count.
export function buildReviewedIntentCorpus({
  priorityAttempts = EXPECTED_OBVIOUS_ATTEMPTS,
  reviewedRecipes = EXPANDED_RECIPES
} = {}) {
  const attempts = new Map();
  for (const attempt of priorityAttempts) {
    attempts.set(worldGraphPairKey(attempt.a, attempt.b), freezeAttempt({
      ...attempt,
      reason: attempt.reason || "priority-intent",
      provenance: {
        kind: attempt.reason === "player-reported" ? "player-report" : "editorial",
        source: "world-graph-3-priority-corpus",
        reviewed: true
      }
    }));
  }
  for (const recipe of reviewedRecipes) {
    const key = worldGraphPairKey(recipe.a, recipe.b);
    if (attempts.has(key)) continue;
    attempts.set(key, freezeAttempt({
      a: recipe.a,
      b: recipe.b,
      acceptedOutputs: [recipe.word],
      weight: recipe.a.toLocaleLowerCase("en-US") === recipe.b.toLocaleLowerCase("en-US") ? 2 : 1,
      reason: "reviewed-recipe-intent",
      provenance: {
        kind: "editorial",
        source: recipe.source || "expanded",
        reviewed: true
      }
    }));
  }
  return Object.freeze([...attempts.values()]);
}

export function reviewedExpansionIntentDigest(recipes = EXPANDED_RECIPES) {
  const snapshot = recipes
    .map((recipe) => `${worldGraphPairKey(recipe.a, recipe.b)}=>${normalize(recipe.word).toLocaleLowerCase("en-US")}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(snapshot).digest("hex");
}

const currentExpansionDigest = reviewedExpansionIntentDigest();
if (currentExpansionDigest !== REVIEWED_EXPANSION_INTENT_DIGEST) {
  throw new Error(`Reviewed expansion intent snapshot changed (${currentExpansionDigest}); review the recipe changes before updating the digest.`);
}

export const REVIEWED_OBVIOUS_ATTEMPTS = buildReviewedIntentCorpus();

export function reviewedIntentCorpusSummary(corpus = REVIEWED_OBVIOUS_ATTEMPTS) {
  const reasons = {};
  let sameWordAttempts = 0;
  let totalWeight = 0;
  for (const attempt of corpus) {
    reasons[attempt.reason] = (reasons[attempt.reason] || 0) + 1;
    if (attempt.a.toLocaleLowerCase("en-US") === attempt.b.toLocaleLowerCase("en-US")) sameWordAttempts += 1;
    totalWeight += attempt.weight;
  }
  return {
    schemaVersion: 3,
    attempts: corpus.length,
    sameWordAttempts,
    totalWeight,
    reasons: Object.fromEntries(Object.entries(reasons).sort(([a], [b]) => a.localeCompare(b)))
  };
}
