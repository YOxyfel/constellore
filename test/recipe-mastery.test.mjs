import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_MASTERY_STARS,
  RECIPE_MASTERY_VERSION,
  buildMasteryCollections,
  collectionProgress,
  lifetimeMasteryProgress,
  recipeKey,
  recordRecipeDiscovery,
  sanitizeRecipeMasteryState,
  summarizeMasteryCollections
} from "../public/recipe-mastery.mjs";

const worldRecipes = [
  { a: "Earth", b: "Water", word: "Mud", emoji: "🟤", category: "nature" },
  { a: "Air", b: "Water", word: "Rain", emoji: "🌧️", category: "nature" },
  { a: "Life", b: "Water", word: "Fish", emoji: "🐟", category: "life" },
  { a: "Brick", b: "Brick", word: "Wall", emoji: "🧱", category: "structure" },
  { a: "Air", b: "Fire", word: "Energy", emoji: "⚡", category: "force" },
  { a: "Sky", b: "Star", word: "Galaxy", emoji: "🌌", category: "nature" }
];

test("recipe keys are normalized, collision-safe, and ingredient-order independent", () => {
  assert.equal(recipeKey(" Earth ", "WATER", "Mud"), recipeKey("water", "earth", "mud"));
  assert.notEqual(recipeKey("a+b", "c", "result"), recipeKey("a", "b+c", "result"));
  assert.notEqual(recipeKey("Earth", "Water", "Mud"), recipeKey("Earth", "Water", "Swamp"));
  assert.equal(recipeKey("", "Water", "Mud"), "");
});

test("lifetime mastery counts the full archive and repeats beyond its final named tier", () => {
  const recipes = Array.from({ length: 300 }, (_, index) => ({
    a: `Source ${index}`,
    b: `Catalyst ${index}`,
    word: `Result ${index}`,
    stars: 3,
    discoveries: 3,
    proofs: [`a${index}`, `b${index}`, `c${index}`]
  }));
  const progress = lifetimeMasteryProgress({ version: RECIPE_MASTERY_VERSION, recipes });
  assert.equal(progress.stars, 900);
  assert.equal(progress.recipes, 300);
  assert.equal(progress.masteredRecipes, 300);
  assert.equal(progress.title, "Infinite Alchemist 1");
  assert.equal(progress.nextAt, 1_600);
  assert.equal(progress.remaining, 700);
});

test("independent discoveries award one star each and cap mastery at three", () => {
  let state;
  for (let run = 1; run <= 5; run += 1) {
    const result = recordRecipeDiscovery(state, { a: "Water", b: "Earth", word: "Mud", runId: `run-${run}` });
    state = result.state;
    assert.equal(result.awardedStar, run <= MAX_MASTERY_STARS);
  }
  assert.equal(state.recipes.length, 1);
  assert.equal(state.recipes[0].stars, 3);
  assert.equal(state.recipes[0].discoveries, 3);
  assert.equal(state.recipes[0].proofs.length, 3, "profile storage stays bounded after full mastery");
});

test("a repeated run cannot farm stars and raw run identifiers are not retained", () => {
  const first = recordRecipeDiscovery(null, { a: "Earth", b: "Water", word: "Mud", runId: "secret-server-token" });
  const repeated = recordRecipeDiscovery(first.state, { a: "Water", b: "Earth", word: "Mud", runId: "secret-server-token" });

  assert.equal(first.awardedStar, true);
  assert.equal(repeated.awardedStar, false);
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.recipe.stars, 1);
  assert.doesNotMatch(JSON.stringify(repeated.state), /secret-server-token/);
});

test("revealed, assisted, invalid, and unscoped discoveries earn no mastery", () => {
  for (const discovery of [
    { a: "Earth", b: "Water", word: "Mud", runId: "one", revealed: true },
    { a: "Earth", b: "Water", word: "Mud", runId: "one", assisted: true },
    { a: "Earth", b: "Water", word: "Mud" },
    { a: "Earth", b: "", word: "Mud", runId: "one" }
  ]) {
    const result = recordRecipeDiscovery(null, discovery);
    assert.equal(result.awardedStar, false);
    assert.deepEqual(result.state.recipes, []);
  }
});

test("state sanitization migrates legacy shapes, merges duplicates, and strips unsafe data", () => {
  const raw = {
    version: 0,
    masteredRecipes: [
      { inputA: "Water", inputB: "Earth", result: "Mud", count: 2, accessToken: "do-not-copy" },
      { a: "earth", b: "water", word: "mud", runs: ["third-run"] },
      { a: "Earth", b: "", word: "Broken", stars: 3 },
      { a: "Air\u0000", b: "Fire", word: "Energy", stars: 99, proofs: ["p-secret-run-name"] }
    ],
    arbitraryProfileData: { admin: true }
  };
  const migrated = sanitizeRecipeMasteryState(raw);

  assert.equal(migrated.version, RECIPE_MASTERY_VERSION);
  assert.equal(migrated.recipes.length, 2);
  assert.equal(migrated.recipes.find((entry) => entry.word.toLowerCase() === "mud").stars, 3);
  assert.equal(migrated.recipes.find((entry) => entry.word === "Energy").stars, 3);
  assert.doesNotMatch(JSON.stringify(migrated), /do-not-copy|arbitraryProfileData|third-run|secret-run-name/);
  assert.deepEqual(sanitizeRecipeMasteryState(null), { version: RECIPE_MASTERY_VERSION, recipes: [] });
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(migrated)));
});

test("collections are deterministic, themed, and derived from flexible world data", () => {
  const concepts = [
    { word: "Mud", emoji: "🟤", category: "nature", recipe: ["Earth", "Water"] },
    { word: "Fish", emoji: "🐟", category: "life", parents: ["Life", "Water"] }
  ];
  const input = { concepts, recipes: worldRecipes.slice(2), history: [worldRecipes[0]], discovered: ["Mud"] };
  const first = buildMasteryCollections(input);
  const second = buildMasteryCollections(input);

  assert.deepEqual(second, first);
  assert.ok(first.some((collection) => collection.id === "celestial"));
  assert.ok(first.some((collection) => collection.id === "life"));
  assert.ok(first.some((collection) => collection.id === "structure"));
  assert.ok(first.some((collection) => collection.id === "force"));
  assert.ok(first.some((collection) => collection.id === "nature"));
  assert.equal(first.flatMap((collection) => collection.entries).filter((entry) => !entry.locked && entry.word === "Mud").length, 1, "duplicate catalog/history recipes are merged");
});

test("discoveries outside a limited collection cannot swap its roster or complete it", () => {
  const recipes = [
    { a: "Earth", b: "Water", word: "Mud", category: "nature" },
    { a: "Air", b: "Water", word: "Mist", category: "nature" },
    { a: "Earth", b: "Fire", word: "Lava", category: "nature" },
    { a: "Water", b: "Water", word: "Ocean", category: "nature" },
    { a: "Stone", b: "Stone", word: "Mountain", category: "nature" },
    { a: "Sand", b: "Sand", word: "Desert", category: "nature" }
  ];
  const rosterId = (entry) => entry.id.replace(/^(?:locked|recipe)-/, "");
  const fullCollection = buildMasteryCollections({
    recipes,
    discovered: recipes.map((recipe) => recipe.word),
    limitPerCollection: 50
  }).find((collection) => collection.id === "nature");
  const idByWord = new Map(fullCollection.entries.map((entry) => [entry.word, rosterId(entry)]));
  const initial = buildMasteryCollections({ recipes, limitPerCollection: 3 })
    .find((collection) => collection.id === "nature");
  const initialRoster = initial.entries.map(rosterId);
  const initialRosterSet = new Set(initialRoster);
  const outsideWords = recipes
    .filter((recipe) => !initialRosterSet.has(idByWord.get(recipe.word)))
    .map((recipe) => recipe.word);

  assert.equal(outsideWords.length, 3, "the fixture must have three recipes outside the fixed roster");
  const afterOutsideDiscoveries = buildMasteryCollections({
    recipes,
    discovered: outsideWords,
    limitPerCollection: 3
  }).find((collection) => collection.id === "nature");

  assert.deepEqual(afterOutsideDiscoveries.entries.map(rosterId), initialRoster, "discovery must not replace a displayed silhouette");
  assert.equal(afterOutsideDiscoveries.progress.unlocked, 0);
  assert.equal(afterOutsideDiscoveries.progress.completed, false, "off-roster discoveries cannot complete the collection");
});

test("locked render entries never expose exact undiscovered answers or reversible keys", () => {
  const collections = buildMasteryCollections({ recipes: worldRecipes, discovered: ["Mud"] });
  const serialized = JSON.stringify(collections);
  for (const answer of ["Rain", "Fish", "Wall", "Energy", "Galaxy"]) {
    assert.doesNotMatch(serialized, new RegExp(answer, "i"), `${answer} must remain hidden`);
  }

  const locked = collections.flatMap((collection) => collection.entries).filter((entry) => entry.locked);
  assert.ok(locked.length > 0);
  for (const entry of locked) {
    assert.deepEqual(Object.keys(entry).sort(), ["clue", "id", "locked", "mastered", "maxStars", "silhouette", "stars"]);
    assert.match(entry.id, /^locked-[a-z0-9]+$/);
  }
});

test("known recipes render answer and star data without mutating source state", () => {
  const awarded = recordRecipeDiscovery(null, { ...worldRecipes[0], runId: "run-a" });
  const originalState = structuredClone(awarded.state);
  const collections = buildMasteryCollections({ recipes: worldRecipes, history: [worldRecipes[0]], state: awarded.state });
  const mud = collections.flatMap((collection) => collection.entries).find((entry) => entry.word === "Mud");

  assert.deepEqual(mud, {
    id: mud.id,
    locked: false,
    a: "Earth",
    b: "Water",
    word: "Mud",
    emoji: "🟤",
    category: "nature",
    stars: 1,
    maxStars: 3,
    mastered: false
  });
  assert.deepEqual(awarded.state, originalState);
});

test("collection and aggregate progress distinguish discovery from full mastery", () => {
  const collection = {
    entries: [
      { locked: false, stars: 3 },
      { locked: false, stars: 1 },
      { locked: true, stars: 0 }
    ]
  };
  assert.deepEqual(collectionProgress(collection), {
    total: 3,
    unlocked: 2,
    mastered: 1,
    stars: 4,
    maxStars: 9,
    completionPercent: 67,
    masteryPercent: 44,
    completed: false,
    fullyMastered: false
  });

  const summary = summarizeMasteryCollections([collection, { entries: [{ locked: false, stars: 3 }] }]);
  assert.deepEqual(summary, {
    total: 4,
    unlocked: 3,
    mastered: 2,
    stars: 7,
    maxStars: 12,
    completedCollections: 1,
    masteredCollections: 1,
    collections: 2,
    completionPercent: 75,
    masteryPercent: 58
  });
});
