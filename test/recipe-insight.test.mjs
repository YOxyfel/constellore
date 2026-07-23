import test from "node:test";
import assert from "node:assert/strict";
import {
  RECIPE_INSIGHT_MAX_RECIPES,
  RECIPE_INSIGHT_MAX_TEXT,
  RECIPE_INSIGHT_MAX_WORD,
  explainRecipeNearMiss,
  explainSuccessfulRecipe,
  sanitizeInsightCategory,
  sanitizeInsightWord
} from "../public/recipe-insight.mjs";

const authored = (a, b, word, categoryA, categoryB, category = "") => ({
  a, b, word, categoryA, categoryB, category, source: "world"
});

test("foundational successful recipes have deterministic human explanations", () => {
  const recipe = authored("Earth", "Water", "Mud", "nature", "force", "nature");
  const insight = explainSuccessfulRecipe(recipe);
  const reversed = explainSuccessfulRecipe(authored("Water", "Earth", "Mud", "force", "nature", "nature"));

  assert.deepEqual(insight, reversed, "ingredient order must not change an authored explanation");
  assert.deepEqual(insight, explainSuccessfulRecipe(recipe));
  assert.deepEqual(Object.keys(insight).sort(), ["a", "authored", "b", "category", "kind", "override", "result", "text"]);
  assert.equal(insight.kind, "success");
  assert.equal(insight.authored, true);
  assert.equal(insight.override, true);
  assert.equal(insight.result, "Mud");
  assert.equal(insight.text, "Water softens loose earth; together they become mud.");
  assert.ok(insight.text.length <= RECIPE_INSIGHT_MAX_TEXT);
  assert.equal(Object.isFrozen(insight), true);
});

test("important routes and same-word recipes use authored or category-aware explanations", () => {
  const speciesBird = explainSuccessfulRecipe(authored("Species", "Air", "Bird", "life", "force", "life"));
  assert.equal(speciesBird.override, true);
  assert.match(speciesBird.text, /adapted to the air/i);

  const generic = explainSuccessfulRecipe(authored("River", "Machine", "Dam", "nature", "structure", "structure"));
  assert.equal(generic.override, false);
  assert.match(generic.text, /natural material|something built/i);
  assert.match(generic.text, /River|Machine/);
  assert.match(generic.text, /Dam/);

  const repeated = explainSuccessfulRecipe(authored("Robot", "Robot", "Factory", "structure", "structure", "structure"));
  assert.equal(repeated.override, false);
  assert.equal(repeated.text, "Repeating Robot scales one idea into Factory.");
});

test("successful explanations fail closed for dynamic, malformed, or nonsense recipes", () => {
  assert.equal(explainSuccessfulRecipe({ a: "Earth", b: "Water", word: "Mud", source: "ai" }), null);
  assert.equal(explainSuccessfulRecipe({ a: "Earth", b: "Water", word: "Mud", source: "semantic" }), null);
  assert.equal(explainSuccessfulRecipe({ a: "<img src=x>", b: "Water", word: "Mud", source: "world" }), null);
  assert.equal(explainSuccessfulRecipe({ a: "craftcraftcraft", b: "Water", word: "Mud", source: "world" }), null);
  assert.equal(explainSuccessfulRecipe({ a: "Earth", b: "Water", word: "Mud", categoryA: "malware", source: "world" }), null);
  assert.equal(explainSuccessfulRecipe({ a: Symbol("Earth"), b: "Water", word: "Mud", source: "world" }), null);
  assert.equal(explainSuccessfulRecipe(new Proxy({}, { get() { throw new Error("hostile getter"); } })), null);
});

test("word and category sanitizers are strict, normalized, and bounded", () => {
  assert.equal(sanitizeInsightWord("  Cloud\tComputing  "), "Cloud Computing");
  assert.equal(sanitizeInsightWord("Ｆｉｒｅ"), "Fire");
  assert.equal(sanitizeInsightWord("T-Rex"), "T-Rex");
  assert.equal(sanitizeInsightWord("word<script>"), "");
  assert.equal(sanitizeInsightWord("https://example.com"), "");
  assert.equal(sanitizeInsightWord("zzzzzz"), "");
  assert.equal(sanitizeInsightWord("mudmudmud"), "");
  assert.equal(sanitizeInsightWord("x".repeat(RECIPE_INSIGHT_MAX_WORD + 1)), "");
  assert.equal(sanitizeInsightWord({ toString: () => "Earth" }), "");
  assert.equal(sanitizeInsightCategory(" LIFE "), "life");
  assert.equal(sanitizeInsightCategory("celestial"), "");
  assert.equal(sanitizeInsightCategory(Symbol("life")), "");
});

test("near-miss guidance names only an attempted anchor and an anonymous safe category", () => {
  const recipes = [
    authored("Air", "Life", "Bird", "force", "life", "life"),
    authored("Air", "Species", "Bird", "force", "life", "life"),
    authored("Water", "Life", "Fish", "force", "life", "life")
  ];
  const input = {
    a: "Air",
    b: "Stone",
    categoryA: "force",
    categoryB: "nature",
    recipes,
    discovered: [
      { word: "Air", category: "force" },
      { word: "Stone", category: "nature" },
      { word: "Plant", category: "life" },
      { word: "Animal", category: "life" },
      { word: "Water", category: "force" }
    ]
  };
  const insight = explainRecipeNearMiss(input);

  assert.deepEqual(insight, explainRecipeNearMiss({ ...input, recipes: [...recipes].reverse() }));
  assert.deepEqual(Object.keys(insight).sort(), ["direction", "kind", "spoilerSafe", "text"]);
  assert.equal(insight.kind, "near-miss");
  assert.equal(insight.direction, "anchor-category");
  assert.equal(insight.spoilerSafe, true);
  assert.match(insight.text, /Air/);
  assert.match(insight.text, /living concept/);
  assert.doesNotMatch(JSON.stringify(insight), /\bLife\b|\bSpecies\b|\bBird\b|\bFish\b/);
  assert.ok(insight.text.length > 0 && insight.text.length <= RECIPE_INSIGHT_MAX_TEXT);
  assert.equal(Object.isFrozen(insight), true);
});

test("a narrow candidate remains directional without leaking its category or partner", () => {
  const insight = explainRecipeNearMiss({
    a: "Air",
    b: "Stone",
    categoryA: "force",
    categoryB: "nature",
    recipes: [authored("Air", "Life", "Bird", "force", "life", "life")],
    discovered: [{ word: "Plant", category: "life" }]
  });
  assert.equal(insight.direction, "anchor");
  assert.match(insight.text, /Air is a promising anchor/);
  assert.doesNotMatch(JSON.stringify(insight), /\bLife\b|\bBird\b|living/);
});

test("category-family, repetition, and generic misses remain bounded and spoiler-safe", () => {
  const categoryFamily = explainRecipeNearMiss({
    a: "Cloud",
    b: "Machine",
    categoryA: "nature",
    categoryB: "structure",
    recipes: [authored("Earth", "Wall", "Foundation", "nature", "structure", "structure")]
  });
  assert.equal(categoryFamily.direction, "category-family");
  assert.doesNotMatch(JSON.stringify(categoryFamily), /Earth|Wall|Foundation/);

  const repeated = explainRecipeNearMiss({ a: "Stone", b: "Stone", categoryA: "nature", categoryB: "nature" });
  assert.equal(repeated.direction, "repetition");
  assert.doesNotMatch(repeated.text, /Mountain/);

  const generic = explainRecipeNearMiss({ a: "Fog", b: "Robot", categoryA: "nature", categoryB: "structure" });
  assert.equal(generic.direction, "explore");
  assert.equal(generic.spoilerSafe, true);
  for (const result of [categoryFamily, repeated, generic]) assert.ok(result.text.length <= RECIPE_INSIGHT_MAX_TEXT);
});

test("near-miss processing is capped and hostile catalog entries cannot poison guidance", () => {
  const hostileRecipe = new Proxy({}, { get() { throw new Error("do not inspect me"); } });
  const oversized = Array.from({ length: RECIPE_INSIGHT_MAX_RECIPES + 100 }, (_, index) => index === 0
    ? hostileRecipe
    : { a: "bad<script>", b: "Water", word: "Secret", source: "world" });
  const insight = explainRecipeNearMiss({
    a: "Earth",
    b: "Air",
    categoryA: "nature",
    categoryB: "force",
    recipes: oversized,
    discovered: new Array(500).fill({ word: "craftcraftcraft", category: "life" })
  });
  assert.equal(insight.direction, "explore");
  assert.doesNotMatch(JSON.stringify(insight), /Secret|script|craftcraftcraft/);

  assert.equal(explainRecipeNearMiss({ a: "Earth", b: "Water", categoryA: "unknown" }), null);
  assert.equal(explainRecipeNearMiss({ a: "<svg onload=x>", b: "Water" }), null);
  assert.equal(explainRecipeNearMiss(new Proxy({}, { get() { throw new Error("hostile request"); } })), null);
  assert.doesNotThrow(() => explainRecipeNearMiss({ a: Symbol("Earth"), b: "Water", recipes: Symbol("recipes") }));
});
