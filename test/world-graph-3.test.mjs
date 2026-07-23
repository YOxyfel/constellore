import assert from "node:assert/strict";
import test from "node:test";
import {
  CONCEPT_STATUS,
  INTENTIONAL_ENDPOINTS,
  RECIPE_PROVENANCE,
  WORLD_GRAPH_BETA_MAX_PROBLEMATIC_DEAD_ENDS,
  WORLD_GRAPH_3_RECIPES,
  WORLD_GRAPH_SCHEMA_VERSION,
  analyzeWorldGraph,
  buildConceptCatalog,
  conceptIdFor,
  normalizeWorldRecipe,
  worldGraphPairKey
} from "../content/world-graph-3.mjs";
import {
  REVIEWED_EXPANSION_INTENT_DIGEST,
  REVIEWED_OBVIOUS_ATTEMPTS,
  reviewedExpansionIntentDigest,
  reviewedIntentCorpusSummary
} from "../content/reviewed-intents-3.mjs";
import { EXPANDED_RECIPES, validateExpandedRecipes } from "../content/expanded-recipes.mjs";
import { authoredCombination, officialTargetCatalog } from "../server.mjs";

test("World Graph 3 records carry stable identity, provenance, lifecycle, and ranked policy", () => {
  assert.equal(WORLD_GRAPH_SCHEMA_VERSION, 3);
  assert.equal(conceptIdFor("  Moon Flower  "), "concept:moon-flower");
  assert.equal(worldGraphPairKey("Water", "Fire"), worldGraphPairKey("fire", " water "));
  assert.ok(WORLD_GRAPH_3_RECIPES.length >= 120, "the 3.0 slice should materially extend obvious authored play");
  for (const recipe of WORLD_GRAPH_3_RECIPES) {
    assert.match(recipe.id, /^recipe:/);
    assert.equal(recipe.ingredients.length, 2);
    assert.equal(recipe.result, conceptIdFor(recipe.word));
    assert.equal(recipe.provenance.kind, RECIPE_PROVENANCE.EDITORIAL);
    assert.equal(recipe.provenance.reviewed, true);
    assert.equal(recipe.status, CONCEPT_STATUS.APPROVED);
    assert.equal(recipe.rankedEligible, true);
    assert.ok(recipe.semanticTags.length >= 2);
    assert.ok(recipe.note.length >= 12);
    assert.equal(authoredCombination(recipe.a, recipe.b)?.word, recipe.word, `${recipe.a} + ${recipe.b} must be live in the deterministic graph`);
  }
});

test("AI proposals fail closed for ranked eligibility", () => {
  const normalized = normalizeWorldRecipe({
    a: "Earth",
    b: "Dream",
    word: "Dreamland",
    emoji: "✨",
    note: "A deliberately provisional result for policy testing.",
    source: "ai"
  });
  assert.equal(normalized.provenance.kind, RECIPE_PROVENANCE.AI_PROPOSAL);
  assert.equal(normalized.provenance.reviewed, false);
  assert.equal(normalized.status, CONCEPT_STATUS.PROVISIONAL);
  assert.equal(normalized.rankedEligible, false);
});

test("the expected-attempt corpus covers repeated words and reported logical pairs", () => {
  assert.ok(REVIEWED_OBVIOUS_ATTEMPTS.length >= 500);
  assert.equal(reviewedExpansionIntentDigest(), REVIEWED_EXPANSION_INTENT_DIGEST, "reviewed recipe intents must not drift silently");
  const summary = reviewedIntentCorpusSummary();
  assert.equal(summary.attempts, REVIEWED_OBVIOUS_ATTEMPTS.length);
  assert.ok(summary.reasons["reviewed-recipe-intent"] >= 400);
  assert.ok(summary.sameWordAttempts >= 80);
  const expected = new Map(REVIEWED_OBVIOUS_ATTEMPTS.map((item) => [worldGraphPairKey(item.a, item.b), item]));
  for (const [a, b, result] of [
    ["Water", "Water", "Ocean"],
    ["Fire", "Fire", "Inferno"],
    ["Species", "Air", "Bird"],
    ["Brick", "Brick", "Wall"],
    ["Water", "Wind", "Wave"],
    ["Road", "Water", "Bridge"]
  ]) {
    const attempt = expected.get(worldGraphPairKey(a, b));
    assert.ok(attempt, `${a} + ${b} should be an explicit expectation`);
    assert.ok(attempt.acceptedOutputs.includes(result));
  }
});

test("graph analysis reports intent, dead ends, bottlenecks, duplicates, and target diversity", () => {
  const recipes = EXPANDED_RECIPES.map((recipe) => normalizeWorldRecipe(recipe));
  const concepts = buildConceptCatalog(recipes);
  const presentPairs = new Set(recipes.map((recipe) => worldGraphPairKey(recipe.a, recipe.b)));
  const expansionExpectations = REVIEWED_OBVIOUS_ATTEMPTS.filter((attempt) => presentPairs.has(worldGraphPairKey(attempt.a, attempt.b)));
  const report = analyzeWorldGraph({
    recipes,
    concepts,
    targets: officialTargetCatalog(),
    expectedAttempts: expansionExpectations
  });
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
  assert.equal(report.schemaVersion, 3);
  assert.equal(report.duplicates.length, 0);
  assert.equal(report.validationIssues.length, 0);
  assert.equal(report.intentCoverage.weightedCoverage, 1);
  assert.deepEqual(report.intentCoverage.failures, []);
  assert.ok(Number.isInteger(report.topology.deadEndCount));
  assert.ok(Array.isArray(report.topology.deadEnds), "the report must expose editorial dead-end work instead of hiding it");
  assert.ok(report.topology.thinConceptCount >= report.topology.deadEndCount);
  assert.ok(Array.isArray(report.topology.bottlenecks));
  assert.equal(report.targets.count, officialTargetCatalog().length);
  assert.ok(report.targets.reachable <= report.targets.count);
  assert.ok(report.targets.withMultipleFinalRecipes >= 1);
  assert.ok(report.targets.details.every((target) => Number.isInteger(target.finalRecipeCount)));
});

test("intentional endpoints are separated from the actionable dead-end queue", () => {
  assert.ok(INTENTIONAL_ENDPOINTS.length >= 190);
  assert.equal(WORLD_GRAPH_BETA_MAX_PROBLEMATIC_DEAD_ENDS, 140);
  const recipes = [
    { a: "Earth", b: "Water", word: "Mud", emoji: "🟤", note: "Water softens earth into mud." },
    { a: "Air", b: "Fire", word: "Energy", emoji: "⚡", note: "Fire fed by air releases energy." }
  ];
  const concepts = buildConceptCatalog(recipes, { intentionalTerminals: ["Mud"] });
  const report = analyzeWorldGraph({ recipes, concepts, targets: [], expectedAttempts: [] });
  assert.deepEqual(report.topology.intentionalTerminalDeadEnds, ["Mud"]);
  assert.deepEqual(report.topology.problematicDeadEnds, ["Energy"]);
  assert.equal(report.topology.intentionalTerminalDeadEndCount, 1);
  assert.equal(report.topology.problematicDeadEndCount, 1);
  assert.equal(report.topology.deadEndCount, 1, "legacy deadEndCount should mean the actionable queue");
});

test("duplicate unordered pairs and unsafe ranked metadata are machine-detectable", () => {
  const first = {
    a: "Earth", b: "Water", word: "Mud", emoji: "🟤", note: "Water softens earth into mud."
  };
  const report = analyzeWorldGraph({
    recipes: [
      first,
      { ...first, a: "Water", b: "Earth" },
      {
        a: "Air",
        b: "Dream",
        word: "Unreviewed Result",
        emoji: "✨",
        note: "A provisional result that must never enter ranked play.",
        source: "ai",
        rankedEligible: true
      }
    ],
    targets: ["Mud"],
    expectedAttempts: []
  });
  assert.equal(report.duplicates.length, 1);
  assert.ok(report.validationIssues.some((issue) => /duplicate unordered/i.test(issue)));
  assert.ok(report.validationIssues.some((issue) => /ranked without approved reviewed provenance/i.test(issue)));
});

test("the legacy expansion validator still guarantees progressive reachability", () => {
  const validation = validateExpandedRecipes();
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
  assert.equal(validation.report.reachableRecipeCount, validation.report.recipeCount);
});
