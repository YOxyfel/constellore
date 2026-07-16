import test from "node:test";
import assert from "node:assert/strict";
import { MARKET_CATALOG } from "../game-services.mjs";
import { buildGameForMode, contextualCombination, curatedCombination, isSensibleResult, isSensibleWish, reachableFromStarters, registerWishConcept, semanticCategoryFor } from "../server.mjs";

test("curated recipes are order independent", () => {
  assert.equal(curatedCombination("Earth", "Water").word, "Mud");
  assert.equal(curatedCombination("water", "earth").word, "Mud");
});

test("each featured target has a recipe", () => {
  assert.equal(curatedCombination("Light", "Rain").word, "Rainbow");
  assert.equal(curatedCombination("Tree", "Tree").word, "Forest");
  assert.equal(curatedCombination("Bird", "Fire").word, "Phoenix");
  assert.equal(curatedCombination("Glass", "Sky").word, "Telescope");
  assert.equal(curatedCombination("Village", "Village").word, "City");
  assert.equal(curatedCombination("Energy", "Storm").word, "Lightning");
});

test("featured targets are reachable from the four starting elements", () => {
  const targets = ["Rainbow", "Forest", "Phoenix", "Telescope", "City", "Lightning", "Rocket", "Space Station"];
  const known = reachableFromStarters();
  for (const target of targets) assert.ok(known.has(target.toLowerCase()), `${target} should be reachable`);
});

test("generated nonsense is rejected", () => {
  assert.equal(isSensibleResult({ word: "Mudcraftcraftcraftcraft", emoji: "✨", note: "No." }, "Mud", "Fire"), false);
  assert.equal(isSensibleResult({ word: "Water Water Water", emoji: "💧", note: "No." }, "Water", "Air"), false);
  assert.equal(isSensibleResult({ word: "Rainbow", emoji: "🌈", note: "Rain splits light." }, "Rain", "Light"), true);
});

test("ordinary cross-category experiments get meaningful local results", () => {
  const pairs = [["Mud", "Machine"], ["Tree", "Metal"], ["Cloud", "Bird"], ["Rain", "House"], ["Lava", "Wall"], ["Snow", "Rocket"]];
  const results = pairs.map(([a, b]) => contextualCombination(a, b)?.word);
  assert.ok(results.every(Boolean));
  assert.ok(new Set(results).size >= 4, "different pairs should not collapse to one generic answer");
  assert.ok(contextualCombination("Mist", "Rain"), "same-category concepts should also combine");
  assert.equal(contextualCombination("Unknown", "Unknown"), null, "unclassified concepts can still fail");
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

test("every reachable concept is classified and combines with every foundation", () => {
  const foundations = ["Earth", "Water", "Fire", "Air"];
  for (const word of reachableFromStarters().values()) {
    assert.ok(semanticCategoryFor(word), `${word} should have a semantic category`);
    for (const foundation of foundations) {
      assert.ok(curatedCombination(word, foundation) || contextualCombination(word, foundation), `${word} + ${foundation} should combine`);
    }
  }
});

test("the complete built-in reachable matrix has a result", () => {
  const words = [...reachableFromStarters().values()];
  for (let left = 0; left < words.length; left += 1) {
    for (let right = left; right < words.length; right += 1) {
      const a = words[left];
      const b = words[right];
      assert.ok(curatedCombination(a, b) || contextualCombination(a, b), `${a} + ${b} should combine`);
    }
  }
});

test("every mode returns a reachable target with the correct limit", () => {
  const known = reachableFromStarters();
  const quick = buildGameForMode("quick", 2);
  const moves = buildGameForMode("moves", 2);
  const daily = buildGameForMode("daily", 2);
  for (const game of [quick, moves, daily]) assert.ok(known.has(game.target.toLowerCase()));
  assert.equal(quick.timeLimit, 90);
  assert.equal(moves.moveLimit, 12);
  assert.equal(daily.target, "Space Station");
});

test("daily and weekly runs include deterministic live-event rules", () => {
  const dailyA = buildGameForMode("daily", 1234);
  const dailyB = buildGameForMode("daily", 1234);
  assert.deepEqual(dailyA.law, dailyB.law);
  assert.equal(dailyA.reward, 180);

  const stages = [0, 1, 2].map((stage) => buildGameForMode("weekly", 99, "", stage));
  assert.equal(new Set(stages.map((game) => game.target)).size, 3);
  assert.deepEqual(stages.map((game) => game.moveLimit), [10, 12, 14]);
  assert.ok(stages.every((game) => game.stageCount === 3 && game.law));
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
