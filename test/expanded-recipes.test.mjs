import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPANDED_LOGICAL_SPOT_CHECKS,
  EXPANDED_RECIPE_BASE_CONCEPTS,
  EXPANDED_RECIPES,
  expandedRecipeKey,
  expandedRecipeReport,
  validateExpandedRecipes
} from "../content/expanded-recipes.mjs";
import { authoredCombination, reachableFromStarters } from "../server.mjs";

test("the hand-reviewed expansion is large, unique, reachable, and low-concentration", () => {
  const validation = validateExpandedRecipes();
  assert.deepEqual(validation.issues, []);
  assert.equal(validation.valid, true);
  assert.ok(validation.report.recipeCount >= 350);
  assert.equal(validation.report.uniquePairCount, validation.report.recipeCount);
  assert.equal(validation.report.reachableRecipeCount, validation.report.recipeCount);
  assert.ok(validation.report.distinctResultCount >= 400);
  assert.ok(validation.report.maximumResultConcentration <= 4);

  const base = reachableFromStarters();
  for (const concept of EXPANDED_RECIPE_BASE_CONCEPTS) {
    assert.ok(base.has(concept.toLowerCase()), `${concept} must exist in the authored base universe`);
  }

  const available = new Set(EXPANDED_RECIPE_BASE_CONCEPTS.map((word) => word.toLowerCase()));
  const keys = new Set();
  let identicalPairCount = 0;
  for (const recipe of EXPANDED_RECIPES) {
    const key = expandedRecipeKey(recipe.a, recipe.b);
    assert.ok(!keys.has(key), `${recipe.a} + ${recipe.b} must be unique`);
    keys.add(key);
    assert.ok(available.has(recipe.a.toLowerCase()), `${recipe.a} must be reachable before ${recipe.word}`);
    assert.ok(available.has(recipe.b.toLowerCase()), `${recipe.b} must be reachable before ${recipe.word}`);
    assert.notEqual(recipe.word.toLowerCase(), recipe.a.toLowerCase());
    assert.notEqual(recipe.word.toLowerCase(), recipe.b.toLowerCase());
    assert.match(recipe.word, /^[\p{L}\p{N}][\p{L}\p{N} '&-]*$/u);
    assert.ok(recipe.note.length >= 12 && recipe.note.length <= 120);
    assert.equal(recipe.source, "expanded");

    // Compatible both before and after the parent integrates this standalone
    // pack: an existing definition may be absent or must agree exactly.
    const existing = authoredCombination(recipe.a, recipe.b);
    if (existing) assert.equal(existing.word, recipe.word, `${recipe.a} + ${recipe.b} conflicts with the base universe`);
    if (recipe.a.toLowerCase() === recipe.b.toLowerCase()) identicalPairCount += 1;
    available.add(recipe.word.toLowerCase());
  }
  assert.ok(identicalPairCount >= 40, "the expansion should make repeated-word play rewarding");
});

test("more than forty explicit spot checks lock the intuitive connections", () => {
  assert.ok(EXPANDED_LOGICAL_SPOT_CHECKS.length >= 40);
  const recipes = new Map(EXPANDED_RECIPES.map((recipe) => [expandedRecipeKey(recipe.a, recipe.b), recipe]));
  for (const check of EXPANDED_LOGICAL_SPOT_CHECKS) {
    const recipe = recipes.get(expandedRecipeKey(check.a, check.b));
    assert.ok(recipe, `${check.a} + ${check.b} must remain in the expansion`);
    assert.equal(recipe.word, check.word, `${check.a} + ${check.b} should produce ${check.word}`);
  }

  const expectedDomains = [
    "Sunshower", "Estuary", "Waterfall", "Mangrove", "Photosynthesis", "Tractor", "Honey", "Bread",
    "Adobe", "Bridge", "Railway", "Robot", "Circuit", "Light Bulb", "Satellite", "Exoplanet",
    "Biology", "Microscope", "Highway", "Archipelago", "Computer", "Internet"
  ];
  const outputs = new Set(EXPANDED_RECIPES.map((recipe) => recipe.word));
  for (const word of expectedDomains) assert.ok(outputs.has(word), `${word} should represent its everyday domain`);
});

test("the report is pure, deterministic, and machine readable", () => {
  const first = expandedRecipeReport();
  const second = expandedRecipeReport();
  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  first.recipeCount = -1;
  assert.equal(expandedRecipeReport().recipeCount, EXPANDED_RECIPES.length);
});

test("the standalone validator fails closed on duplicate, circular, unchanged, and concentrated content", () => {
  const template = EXPANDED_RECIPES[0];
  const duplicate = validateExpandedRecipes([template, { ...template }]);
  assert.equal(duplicate.valid, false);
  assert.ok(duplicate.issues.some((issue) => /duplicates unordered pair/i.test(issue)));

  const unchanged = validateExpandedRecipes([
    { a: "Earth", b: "Water", word: "Earth", emoji: "🌍", note: "This deliberately returns an ingredient unchanged." }
  ]);
  assert.equal(unchanged.valid, false);
  assert.ok(unchanged.issues.some((issue) => /unchanged/i.test(issue)));

  const unreachable = validateExpandedRecipes([
    { a: "Not Introduced", b: "Water", word: "Test Result", emoji: "✨", note: "This deliberately uses an unavailable ingredient." }
  ]);
  assert.equal(unreachable.valid, false);
  assert.ok(unreachable.issues.some((issue) => /before it is reachable/i.test(issue)));

  const concentrated = validateExpandedRecipes([
    ["Earth", "Water"], ["Earth", "Fire"], ["Earth", "Air"], ["Water", "Fire"], ["Water", "Air"]
  ].map(([a, b], index) => ({
    a, b, word: "Same Result", emoji: "✨", note: `Deliberate concentration fixture number ${index + 1}.`
  })));
  assert.equal(concentrated.valid, false);
  assert.ok(concentrated.issues.some((issue) => /concentration exceeds four/i.test(issue)));
});
