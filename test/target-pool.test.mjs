import test from "node:test";
import assert from "node:assert/strict";
import { generateLocalWorldData } from "../scripts/build-local-world.mjs";
import { coreOfficialTargetCatalog } from "../server.mjs";
import {
  TARGET_POOL_SIZE,
  buildShortestTargetRoutes,
  createTargetPool,
  summarizeTargetPool,
  targetKey,
  targetNameQuality,
  validateTargetRoute
} from "../public/target-pool.mjs";

const starters = ["Earth", "Water", "Fire", "Air"];
const localWorld = await generateLocalWorldData();
const officialTargets = coreOfficialTargetCatalog();

function unpackAuthoredRecipes(data) {
  const byOffset = new Map(data.sparseRecipes);
  const recipes = [];
  const size = data.words.length;
  for (let left = 0; left < size; left += 1) {
    for (let right = left; right < size; right += 1) {
      const offset = left * size - (left * (left - 1)) / 2 + (right - left);
      const result = byOffset.get(offset);
      if (result === undefined) continue;
      recipes.push({
        a: data.words[left].word,
        b: data.words[right].word,
        word: data.words[result].word
      });
    }
  }
  return recipes;
}

const authoredRecipes = unpackAuthoredRecipes(localWorld);

const selectionOptions = {
  routes: localWorld.payload.targetRoutes,
  recipes: authoredRecipes,
  targetDetails: localWorld.payload.targetDetails,
  concepts: localWorld.words,
  officialTargets,
  starters
};

test("the expanded pool contains exactly 500 unique, verified destinations", () => {
  const pool = createTargetPool(selectionOptions);
  assert.equal(pool.length, TARGET_POOL_SIZE);
  assert.equal(new Set(pool.map(targetKey)).size, TARGET_POOL_SIZE);

  const starterKeys = new Set(starters.map(targetKey));
  for (const entry of pool) {
    assert.equal(starterKeys.has(targetKey(entry)), false, `${entry.target} must not be a starter`);
    assert.equal(validateTargetRoute(entry.route, entry.target, { starters }).valid, true, `${entry.target} needs a valid route`);
    assert.equal(entry.route.at(-1).word.toLowerCase(), entry.target.toLowerCase());
    assert.equal(entry.routeLength, entry.route.length);
  }
});

test("all 40 authored official targets are preserved first with their metadata", () => {
  const pool = createTargetPool(selectionOptions);
  assert.equal(officialTargets.length, 40);
  assert.deepEqual(pool.slice(0, officialTargets.length).map((entry) => entry.target), officialTargets.map((entry) => entry.target));

  const byTarget = new Map(pool.map((entry) => [targetKey(entry), entry]));
  for (const official of officialTargets) {
    const selected = byTarget.get(targetKey(official));
    assert.ok(selected, `${official.target} must remain in the catalog`);
    for (const field of ["target", "emoji", "clue", "tier"]) {
      assert.equal(selected[field], official[field], `${official.target} must preserve ${field}`);
    }
    assert.equal(selected.source, "official");
  }
});

test("selection is deterministic, varied, and keeps generated targets in quality bands", () => {
  const first = createTargetPool(selectionOptions);
  const second = createTargetPool(selectionOptions);
  assert.deepEqual(second, first);

  const expanded = first.filter((entry) => entry.source === "expanded");
  assert.ok(expanded.every((entry) => entry.routeLength >= 2 && entry.routeLength <= 24));
  assert.ok(expanded.every((entry) => entry.finalRecipeCount >= 2), "expanded targets need at least two authored final recipes");
  assert.ok(expanded.every((entry) => targetNameQuality(entry.target).eligible), "generated targets must pass name review");

  const summary = summarizeTargetPool(first);
  assert.equal(summary.total, 500);
  assert.equal(summary.unique, 500);
  assert.equal(summary.official, 40);
  assert.equal(Object.keys(summary.tiers).length, 5, "all five route difficulty tiers should be represented");
  assert.ok(Object.keys(summary.routeBands).length >= 4, "short and deep routes should both be represented");
  assert.ok(Object.keys(summary.topics).length >= 8, "the pool should span many recognizable themes");
  assert.ok(Math.max(...Object.values(summary.topics)) < 150, "no single theme should dominate the pool");
});

test("technical template compounds and nonsense stay out of the quality pool", () => {
  for (const word of [
    "Maritime Physics",
    "Aeronautical Emissions",
    "Railway Research",
    "Mudcraftcraftcraft",
    "Unknown"
  ]) {
    assert.equal(targetNameQuality(word).eligible, false, `${word} should be rejected`);
  }
  for (const word of ["Forest", "Hot Air Balloon", "Black Hole", "Space Station"]) {
    assert.equal(targetNameQuality(word).eligible, true, `${word} should remain eligible`);
  }
});

test("the browser-safe fallback derives deterministic dependency-ordered routes from recipes", () => {
  const recipes = [
    { a: "Mud", b: "Fire", word: "Brick" },
    { a: "Earth", b: "Water", word: "Mud" },
    { a: "Brick", b: "Brick", word: "Wall" },
    { a: "Wall", b: "Wall", word: "House" }
  ];
  const routes = buildShortestTargetRoutes({ recipes, starters });
  assert.deepEqual(routes.get("house"), [
    { a: "Earth", b: "Water", word: "Mud" },
    { a: "Mud", b: "Fire", word: "Brick" },
    { a: "Brick", b: "Brick", word: "Wall" },
    { a: "Wall", b: "Wall", word: "House" }
  ]);
  assert.equal(validateTargetRoute(routes.get("house"), "House", { starters }).valid, true);
});
