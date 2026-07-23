import test from "node:test";
import assert from "node:assert/strict";
import { MARKET_CATALOG } from "../game-services.mjs";
import { EXPANDED_LOGICAL_SPOT_CHECKS, EXPANDED_RECIPES } from "../content/expanded-recipes.mjs";
import { analyzeWorldGraph } from "../content/world-graph-3.mjs";
import { REVIEWED_OBVIOUS_ATTEMPTS } from "../content/reviewed-intents-3.mjs";
import { authoredCombination, buildGameForMode, contextualCombination, curatedCombination, isSensibleResult, isSensibleWish, officialTargetCatalog, reachableFromStarters, registerWishConcept, semanticCategoryFor, solutionRoute } from "../server.mjs";

test("curated recipes are order independent", () => {
  assert.equal(curatedCombination("Earth", "Water").word, "Mud");
  assert.equal(curatedCombination("water", "earth").word, "Mud");
});

test("the hand-reviewed expansion is installed in the authoritative world", () => {
  assert.ok(EXPANDED_RECIPES.length >= 400);
  for (const { a, b, word } of EXPANDED_LOGICAL_SPOT_CHECKS) {
    assert.equal(authoredCombination(a, b)?.word, word, `${a} + ${b} should create ${word}`);
  }
});

test("each featured target has a recipe", () => {
  assert.equal(curatedCombination("Light", "Rain").word, "Rainbow");
  assert.equal(curatedCombination("Tree", "Tree").word, "Forest");
  assert.equal(curatedCombination("Bird", "Fire").word, "Phoenix");
  assert.equal(curatedCombination("Glass", "Sky").word, "Telescope");
  assert.equal(curatedCombination("Village", "Village").word, "City");
  assert.equal(curatedCombination("Energy", "Storm").word, "Lightning");
});

test("at least 30 official targets span five reachable difficulty bands", () => {
  const targets = officialTargetCatalog();
  assert.ok(targets.length >= 30);
  assert.deepEqual([...new Set(targets.map((entry) => entry.tier))].sort(), [1, 2, 3, 4, 5]);
  const known = reachableFromStarters();
  for (const { target } of targets) assert.ok(known.has(target.toLowerCase()), `${target} should be reachable`);
});

test("solution routes are dependency ordered and end at the requested target", () => {
  assert.deepEqual(solutionRoute("Earth"), [], "starter targets should use a valid zero-step route");
  const targets = ["Rainbow", "Forest", "Phoenix", "Telescope", "City", "Lightning", "Rocket", "Space Station"];
  for (const target of targets) {
    const available = new Set(["earth", "water", "fire", "air"]);
    const route = solutionRoute(target);
    assert.ok(route?.length, `${target} should have a solution route`);
    for (const step of route) {
      assert.ok(available.has(step.a.toLowerCase()), `${step.a} must be available before ${step.word}`);
      assert.ok(available.has(step.b.toLowerCase()), `${step.b} must be available before ${step.word}`);
      assert.equal(authoredCombination(step.a, step.b).word, step.word);
      available.add(step.word.toLowerCase());
    }
    assert.equal(route.at(-1).word, target);
  }
  assert.ok(solutionRoute("Space Station").length <= 11, "alternate routes should keep the longest featured goal compact");
  assert.deepEqual(solutionRoute("Space Station"), solutionRoute("Space Station"), "minimum routes must be deterministic");
});

test("generated nonsense is rejected", () => {
  assert.equal(isSensibleResult({ word: "Mudcraftcraftcraftcraft", emoji: "✨", note: "No." }, "Mud", "Fire"), false);
  assert.equal(isSensibleResult({ word: "Water Water Water", emoji: "💧", note: "No." }, "Water", "Air"), false);
  assert.equal(isSensibleResult({ word: "Rainbow", emoji: "🌈", note: "Rain splits light." }, "Rain", "Light"), true);
});

test("semantic mixing is explicitly experimental and separate from authored recipes", () => {
  const pairs = [["Mud", "Machine"], ["Tree", "Metal"], ["Cloud", "Bird"], ["Rain", "House"], ["Lava", "Wall"], ["Snow", "Rocket"]];
  const results = pairs.map(([a, b]) => contextualCombination(a, b)?.word);
  assert.ok(results.every(Boolean));
  assert.ok(new Set(results).size >= 4, "different pairs should not collapse to one generic answer");
  assert.ok(contextualCombination("Mist", "Rain"), "same-category concepts should also combine");
  assert.equal(contextualCombination("Unknown", "Unknown"), null, "unclassified concepts can still fail");
  assert.equal(authoredCombination("Dragon", "Telescope"), null, "category roulette must not enter the ranked/static recipe tier");
});

test("authored semantic overrides keep contextual categories coherent", () => {
  const expected = {
    structure: ["Concrete", "Dinner", "Farm", "Generator", "Wind Farm"],
    nature: ["Binary Star", "Comet", "Meteor Shower"],
    force: ["Combustion", "Hydro Energy", "Hydropower", "Sunlight", "Tidal Power"],
    life: [
      "Anemone", "Arctic Char", "Blossom", "Cactus", "Camel", "Cell", "Community", "Crop", "Dune Grass",
      "Goat", "Heron", "Lichen", "Livestock", "Lotus", "Mangrove", "Marram Grass", "Moonflower",
      "Moss", "Mountain Lion", "Night Bloom", "Organ", "Organism", "Pet", "Pigeon", "Plankton",
      "Polar Bear", "Population", "Seabird", "Seaweed", "Seedling", "Tissue", "Trout", "Tuna",
      "Urban Wildlife", "Whale"
    ]
  };
  for (const [category, words] of Object.entries(expected)) {
    for (const word of words) assert.equal(semanticCategoryFor(word), category, `${word} should remain ${category}`);
  }

  for (const [word, category] of [["Concrete", "structure"], ["Community", "life"], ["Comet", "nature"], ["Camel", "life"], ["Sunlight", "force"]]) {
    const result = contextualCombination(word, word);
    assert.ok(result, `${word} should have a contextual same-category result`);
    assert.equal(semanticCategoryFor(result.word), category, `${word} + ${word} should use the ${category} pool`);
  }
});

test("doubling foundational elements creates stronger concepts", () => {
  assert.equal(curatedCombination("Water", "Water").word, "Ocean");
  assert.equal(curatedCombination("Fire", "Fire").word, "Inferno");
  assert.equal(curatedCombination("Air", "Air").word, "Wind");
  assert.equal(curatedCombination("Earth", "Earth").word, "Land");
});

test("species connects logically to foundational environments", () => {
  assert.equal(curatedCombination("Species", "Air").word, "Bird");
  assert.equal(curatedCombination("Species", "Water").word, "Fish");
  assert.equal(curatedCombination("Species", "Earth").word, "Animal");
  assert.equal(curatedCombination("Species", "Fire").word, "Extinction");
});

test("every expanded Exchange word has an authored foundation neighborhood", () => {
  const foundations = ["Earth", "Water", "Fire", "Air"];
  const additions = MARKET_CATALOG.slice(12);
  assert.equal(additions.length, 24);

  for (const item of additions) {
    assert.equal(semanticCategoryFor(item.word), item.category, `${item.word} should keep its catalog category`);
    for (const foundation of foundations) {
      assert.ok(curatedCombination(item.word, foundation), `${item.word} + ${foundation} should have an authored result`);
    }
    assert.ok(curatedCombination(item.word, item.word), `${item.word} + ${item.word} should have an authored result`);
  }
});

test("every authored reachable concept is classified", () => {
  for (const word of reachableFromStarters().values()) {
    assert.ok(semanticCategoryFor(word), `${word} should have a semantic category`);
  }
});

test("the ranked recipe graph protects player intent and official route diversity", () => {
  const words = [...reachableFromStarters().values()];
  const recipes = [];
  for (let left = 0; left < words.length; left += 1) {
    for (let right = left; right < words.length; right += 1) {
      const a = words[left];
      const b = words[right];
      const recipe = authoredCombination(a, b);
      if (recipe) recipes.push(recipe);
    }
  }
  const report = analyzeWorldGraph({ recipes, targets: officialTargetCatalog(), expectedAttempts: REVIEWED_OBVIOUS_ATTEMPTS });
  assert.ok(report.intentCoverage.attempts >= 500);
  assert.ok(recipes.length >= 840, "the starter-reachable graph should retain substantial authored depth");
  assert.equal(report.intentCoverage.weightedCoverage, 1, "high-intent attempts should have their reviewed result");
  assert.deepEqual(report.intentCoverage.failures, []);
  assert.equal(report.targets.reachable, report.targets.count);
  assert.ok(report.targets.withMultipleFinalRecipes >= 20);
  assert.ok(report.targets.withMultipleOpenings >= 12);
  assert.deepEqual(report.validationIssues, []);
});

test("every mode returns a reachable target with the correct limit", () => {
  const known = reachableFromStarters();
  const quick = buildGameForMode("quick", 2);
  const moves = buildGameForMode("moves", 2);
  const daily = buildGameForMode("daily", 2);
  for (const game of [quick, moves, daily]) assert.ok(known.has(game.target.toLowerCase()));
  assert.equal(quick.timeLimit, 90);
  assert.equal(moves.moveLimit, 12);
  assert.ok(solutionRoute(moves.target).length <= moves.moveLimit);
});

test("daily and weekly runs include deterministic live-event rules", () => {
  const dailyA = buildGameForMode("daily", 1234);
  const dailyB = buildGameForMode("daily", 1234);
  assert.deepEqual(dailyA.law, dailyB.law);
  assert.equal(dailyA.reward, 180);
  assert.notEqual(buildGameForMode("daily", 1234).target, buildGameForMode("daily", 1235).target, "adjacent days must rotate the destination");
  assert.ok(new Set(Array.from({ length: 64 }, (_, seed) => buildGameForMode("daily", seed).target)).size >= 12);

  const stages = [0, 1, 2].map((stage) => buildGameForMode("weekly", 99, "", stage));
  assert.equal(new Set(stages.map((game) => game.target)).size, 3);
  assert.deepEqual(stages.map((game) => game.moveLimit), [10, 12, 14]);
  assert.ok(stages.every((game) => game.stageCount === 3 && game.law));
  for (let seed = 0; seed < 8; seed += 1) {
    for (let stage = 0; stage < 3; stage += 1) {
      const game = buildGameForMode("weekly", seed, "", stage);
      assert.ok(solutionRoute(game.target).length <= game.moveLimit, `${game.target} must fit weekly stage ${stage + 1}`);
    }
  }
});

test("friend challenges preserve the target and deterministic id", () => {
  const first = buildGameForMode("challenge", 451, "Phoenix");
  const second = buildGameForMode("challenge", 451, "Phoenix");
  assert.equal(first.target, "Phoenix");
  assert.equal(first.challengeId, second.challengeId);
  assert.equal(buildGameForMode("challenge", 451, "Definitely Missing"), null);
});

test("wishes reject repeated nonsense while accepting recognizable concepts", () => {
  assert.equal(isSensibleWish("Moon"), true);
  assert.equal(isSensibleWish("Space Station"), true);
  assert.equal(isSensibleWish("craftcraftcraft"), false);
  assert.equal(isSensibleWish("zzzzzz"), false);
  assert.equal(registerWishConcept("Moon"), "nature");
  assert.equal(curatedCombination("Moon", "Water").word, "Tide");
  assert.equal(curatedCombination("Magic", "Fire").word, "Fireball");
  assert.equal(curatedCombination("Love", "Air").word, "Kiss");
  assert.ok(contextualCombination("Moon", "Stone"), "a registered Wish should also participate in the local semantic universe");
});
