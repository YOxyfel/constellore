import test from "node:test";
import assert from "node:assert/strict";
import {
  CLASSIC_STARTERS,
  SHUFFLED_START_VERSION,
  buildShuffledStart,
  createChallengeStartProfile,
  selectStartStyle
} from "../public/shuffled-start.mjs";

const route = [
  { a: "Earth", b: "Water", word: "Mud" },
  { a: "Fire", b: "Air", word: "Energy" },
  { a: "Mud", b: "Energy", word: "Life" },
  { a: "Life", b: "Water", word: "Plant" },
  { a: "Plant", b: "Plant", word: "Forest" }
];

const recipes = [
  ...route,
  { a: "Mud", b: "Fire", word: "Brick" },
  { a: "Brick", b: "Brick", word: "Wall" },
  { a: "Water", b: "Energy", word: "Steam" }
];

const itemWords = [
  ...CLASSIC_STARTERS,
  "Mud",
  "Energy",
  "Life",
  "Plant",
  "Forest",
  "Brick",
  "Wall",
  "Steam"
];

function itemsWith(overrides = {}) {
  return itemWords.map((word) => ({
    word,
    emoji: overrides[word]?.emoji ?? "✦",
    category: overrides[word]?.category ?? "test",
    ...overrides[word]
  }));
}

function assertDependencyOrdered(profile) {
  const available = new Set(profile.starters.map((word) => word.toLowerCase()));
  for (const step of profile.challengeRoute) {
    assert.equal(available.has(step.a.toLowerCase()), true, `${step.a} should be available`);
    assert.equal(available.has(step.b.toLowerCase()), true, `${step.b} should be available`);
    assert.equal(available.has(step.word.toLowerCase()), false, `${step.word} should be new`);
    available.add(step.word.toLowerCase());
  }
  assert.equal(available.has(profile.target.toLowerCase()), true);
}

test("Auto cadence protects onboarding, recovers from failure, and increasingly favors Shuffled", () => {
  assert.equal(selectStartStyle({ rank: "Bronze", startStyle: "auto", challengeIndex: 99 }).style, "classic");
  assert.equal(selectStartStyle({ rank: "Bronze", startStyle: "shuffled" }).style, "classic");

  assert.deepEqual(
    [0, 1, 2].map((challengeIndex) => selectStartStyle({
      rank: "Silver",
      startStyle: "auto",
      challengeIndex
    }).style),
    ["classic", "classic", "shuffled"]
  );
  assert.deepEqual(
    [0, 1, 2].map((challengeIndex) => selectStartStyle({
      rank: "Gold",
      startStyle: "auto",
      challengeIndex
    }).style),
    ["shuffled", "shuffled", "classic"]
  );
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((challengeIndex) => selectStartStyle({
      rank: "Emerald",
      startStyle: "auto",
      challengeIndex
    }).style),
    ["shuffled", "shuffled", "shuffled", "shuffled", "classic"]
  );

  const recovery = selectStartStyle({
    rank: "Cosmic",
    startStyle: "auto",
    challengeIndex: 2,
    lastOutcome: "forfeit"
  });
  assert.equal(recovery.style, "classic");
  assert.equal(recovery.reason, "failure_recovery");
});

test("promotion cadence starts with calibration and then uses two Shuffled trials", () => {
  assert.deepEqual(
    [0, 1, 2].map((promotionAttempt) => selectStartStyle({
      rank: "Diamond",
      startStyle: "auto",
      promotion: true,
      promotionAttempt
    }).style),
    ["classic", "shuffled", "shuffled"]
  );
});

test("a Shuffled profile is deterministic, bounded, recognizable, and dependency ordered", () => {
  const options = {
    target: "Forest",
    canonicalRoute: route,
    recipes,
    items: itemsWith({ Mud: { emoji: "🟤" }, Energy: { emoji: "⚡" } }),
    seed: "forest-42",
    startStyle: "shuffled",
    rank: "Gold"
  };
  const first = createChallengeStartProfile(options);
  const second = createChallengeStartProfile(options);

  assert.deepEqual(second, first);
  assert.equal(first.version, SHUFFLED_START_VERSION);
  assert.equal(first.style, "shuffled");
  assert.equal(first.fallback, false);
  assert.ok(first.starters.length <= 6);
  assert.equal(first.starters.includes("Forest"), false);
  assert.ok(first.starters.filter((word) => !CLASSIC_STARTERS.includes(word)).length >= 2);
  assert.equal(first.hasValidOpening, true);
  assert.ok(first.routeStartIndex > 0);
  assert.deepEqual(first.route, first.challengeRoute);
  assert.deepEqual(first.challengeRoute, route.slice(first.routeStartIndex));
  assert.ok(first.starterItems.every((item) => item.word && item.emoji && item.category));
  assert.match(first.starterHash, /^[0-9a-f]{8}$/u);
  assert.match(first.profileId, /^start-v1-shuffled-[0-9a-f]{8}$/u);
  assertDependencyOrdered(first);
});

test("the generator adds only contextual, immediately playable side paths", () => {
  const chainRoute = [
    { a: "Earth", b: "Water", word: "Mud" },
    { a: "Mud", b: "Fire", word: "Brick" },
    { a: "Brick", b: "Brick", word: "Wall" },
    { a: "Wall", b: "Wall", word: "House" }
  ];
  const chainItems = [...CLASSIC_STARTERS, "Mud", "Brick", "Wall", "House"]
    .map((word) => ({ word, emoji: "✦", category: "test" }));
  const profile = buildShuffledStart({
    target: "House",
    route: chainRoute,
    recipes: chainRoute,
    items: chainItems,
    seed: "house-side",
    startStyle: "shuffled",
    rank: "Silver",
    difficulty: {
      desiredRouteLength: 2,
      maximumSidePaths: 1,
      maximumStarters: 5
    }
  });

  assert.equal(profile.style, "shuffled");
  assert.ok(profile.sidePaths.length <= 1);
  assert.ok(profile.starters.filter((word) => !CLASSIC_STARTERS.includes(word)).length >= 2);
  for (const sidePath of profile.sidePaths) {
    assert.ok(profile.starters.includes(sidePath.a));
    assert.ok(profile.starters.includes(sidePath.b));
    assert.notEqual(sidePath.word, "House");
  }
  assertDependencyOrdered(profile);
});

test("premium or unrecognized starter frontiers are rejected and safely fall back to Classic", () => {
  const premium = Object.fromEntries(["Mud", "Energy", "Life", "Plant"].map((word) => [
    word,
    { premium: true }
  ]));
  const profile = createChallengeStartProfile({
    target: "Forest",
    canonicalRoute: route,
    recipes,
    items: itemsWith(premium),
    seed: 7,
    startStyle: "shuffled",
    rank: "Cosmic"
  });

  assert.equal(profile.style, "classic");
  assert.equal(profile.fallback, true);
  assert.equal(profile.fallbackReason, "no_fair_shuffled_kit");
  assert.deepEqual(profile.starters, CLASSIC_STARTERS);
  assert.equal(profile.starterItems.some((item) => item.premium), false);
  assertDependencyOrdered(profile);
});

test("missing optional Shuffled metadata falls back rather than emitting an opaque kit", () => {
  const baseOnlyItems = CLASSIC_STARTERS.map((word) => ({
    word,
    emoji: "✦",
    category: "origin"
  }));
  const profile = createChallengeStartProfile({
    target: "Forest",
    canonicalRoute: route,
    recipes,
    items: baseOnlyItems,
    startStyle: "shuffled",
    rank: "Gold"
  });
  assert.equal(profile.style, "classic");
  assert.equal(profile.fallback, true);
  assert.deepEqual(profile.starterItems.map((item) => item.word), CLASSIC_STARTERS);
});

test("Classic profiles retain the exact full canonical route and supplied metadata", () => {
  const profile = createChallengeStartProfile({
    target: "Forest",
    canonicalRoute: route,
    recipes,
    itemLookup: new Map(itemsWith().map((item) => [item.word.toLowerCase(), item])),
    startStyle: "classic",
    rank: "Diamond"
  });
  assert.equal(profile.style, "classic");
  assert.equal(profile.fallback, false);
  assert.equal(profile.routeStartIndex, 0);
  assert.deepEqual(profile.route, route);
  assert.deepEqual(profile.starters, CLASSIC_STARTERS);
  assertDependencyOrdered(profile);
});

test("function lookups are supported without enumerating or recursively solving the graph", () => {
  const profile = createChallengeStartProfile({
    target: "Forest",
    canonicalRoute: route,
    recipeLookup(a, b) {
      const pair = [a.toLowerCase(), b.toLowerCase()].sort().join("|");
      return recipes.find((recipe) => (
        [recipe.a.toLowerCase(), recipe.b.toLowerCase()].sort().join("|") === pair
      ));
    },
    itemLookup(word) {
      return { word, emoji: "✦", category: "lookup" };
    },
    seed: "lookup-only",
    startStyle: "shuffled",
    rank: "Gold"
  });
  assert.equal(profile.style, "shuffled");
  assert.ok(profile.sidePathCount <= 1, "only the trusted canonical prefix may supply a side path");
  assert.ok(profile.starters.length <= 6);
  assertDependencyOrdered(profile);
});

test("canonical recipe mismatches and unsafe dependency order are rejected", () => {
  assert.throws(() => createChallengeStartProfile({
    target: "Forest",
    canonicalRoute: route,
    recipes: recipes.map((recipe) => (
      recipe.word === "Life" ? { ...recipe, word: "Creature" } : recipe
    )),
    items: itemsWith(),
    startStyle: "shuffled",
    rank: "Gold"
  }), /missing or ambiguous/u);

  assert.throws(() => createChallengeStartProfile({
    target: "Forest",
    canonicalRoute: [route[2], route[0], route[1], route[3], route[4]],
    recipes,
    items: itemsWith(),
    startStyle: "shuffled",
    rank: "Gold"
  }), /dependency is unavailable/u);

  assert.throws(() => createChallengeStartProfile({
    target: "Forest",
    canonicalRoute: route,
    recipes: [...recipes, { a: "Water", b: "Earth", word: "Clay" }],
    items: itemsWith(),
    startStyle: "shuffled",
    rank: "Gold"
  }), /missing or ambiguous/u);
});
