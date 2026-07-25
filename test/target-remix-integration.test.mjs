import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGameForMode,
  coreOfficialTargetCatalog,
  officialTargetCatalog,
  solutionRoute
} from "../server.mjs";
import {
  REMIX_FAMILIES,
  REMIX_RANKS
} from "../public/remix-progression.mjs";

const modes = Object.freeze([
  { id: "reach", maximumRouteLength: Infinity },
  { id: "quick", maximumRouteLength: 8 },
  { id: "moves", maximumRouteLength: 12 }
]);

function adaptiveStateAt(rank) {
  return {
    version: 2,
    level: Math.min(10, Math.max(1, rank.number)),
    failureStreak: 0,
    completedChallenges: rank.completedChallenges,
    majorChallengePending: false,
    majorChallengeBaseLevel: null,
    recentTargets: []
  };
}

function assertValidRules(game, rank) {
  assert.ok(game.remixes, `${game.mode} ${rank.name} must expose its remix schedule`);
  assert.equal(game.remixes.rank.id, rank.id);
  assert.equal(game.remixes.rank.number, rank.number);
  assert.equal(game.remixes.completedChallenges, rank.completedChallenges);
  assert.equal(game.remixes.rank.minimumRemixes, rank.minimumRemixes);
  assert.equal(game.remixes.rank.maximumRemixes, rank.maximumRemixes);
  assert.ok(
    game.remixes.activeCount >= rank.minimumRemixes,
    `${game.mode} ${rank.name} must realize at least ${rank.minimumRemixes} rules`
  );
  assert.ok(
    game.remixes.activeCount <= rank.maximumRemixes,
    `${game.mode} ${rank.name} must realize at most ${rank.maximumRemixes} rules`
  );
  assert.equal(game.remixes.rules.length, game.remixes.activeCount);
  assert.equal(game.remixes.requestedCount, game.remixes.activeCount);

  const validFamilies = new Set(REMIX_FAMILIES.map((family) => family.id));
  const unlockedFamilies = new Set(rank.unlockedFamilies);
  const usedFamilies = new Set();
  for (const rule of game.remixes.rules) {
    assert.ok(validFamilies.has(rule.family), `${rule.family} must be a real remix family`);
    assert.ok(unlockedFamilies.has(rule.family), `${rule.family} must be unlocked at ${rank.name}`);
    assert.equal(usedFamilies.has(rule.family), false, `${rule.family} must not be duplicated`);
    usedFamilies.add(rule.family);
    for (const field of ["id", "title", "instruction", "detail"]) {
      assert.equal(typeof rule[field], "string");
      assert.ok(rule[field].trim().length > 0, `${rule.family} needs a readable ${field}`);
    }
  }
}

test("the public destination catalog is exactly 500 unique targets and retains the core 40", () => {
  const catalog = officialTargetCatalog();
  const core = coreOfficialTargetCatalog();
  assert.equal(catalog.length, 500);
  assert.equal(core.length, 40);
  assert.equal(
    new Set(catalog.map((entry) => entry.target.toLowerCase())).size,
    500,
    "the public pool must not repeat a destination"
  );

  const byTarget = new Map(catalog.map((entry) => [entry.target.toLowerCase(), entry]));
  for (const original of core) {
    const retained = byTarget.get(original.target.toLowerCase());
    assert.ok(retained, `${original.target} must remain in the 500-target pool`);
    for (const field of ["target", "emoji", "clue", "tier"]) {
      assert.equal(retained[field], original[field], `${original.target} must retain ${field}`);
    }
  }

  for (const target of catalog) {
    const route = solutionRoute(target.target);
    assert.ok(Array.isArray(route) && route.length > 0, `${target.target} must remain starter-reachable`);
    assert.equal(route.at(-1).word, target.target);
    assert.equal(target.routeLength, route.length);
  }
});

test("Reach, Quick, and Moves honor every one of the twelve remix-rank schedules", () => {
  assert.equal(REMIX_RANKS.length, 12);

  for (const [modeIndex, mode] of modes.entries()) {
    for (const rank of REMIX_RANKS) {
      const game = buildGameForMode(
        mode.id,
        8_000 + modeIndex * 1_000 + rank.number * 37,
        "",
        0,
        adaptiveStateAt(rank)
      );
      assert.ok(game, `${mode.id} must construct a ${rank.name} challenge`);
      assert.equal(game.mode, mode.id);
      assert.equal(game.adaptive, true);
      assert.equal(game.adaptiveCompletedChallenges, rank.completedChallenges);

      const route = solutionRoute(game.target);
      assert.ok(Array.isArray(route) && route.length > 0, `${game.target} needs a verified route`);
      assert.ok(
        route.length <= mode.maximumRouteLength,
        `${mode.id} selected ${game.target} outside its route-length limit`
      );
      assertValidRules(game, rank);
    }
  }
});

test("every top-rank generated mode realizes all five valid route rules", () => {
  const topRank = REMIX_RANKS.at(-1);
  const expectedFamilies = REMIX_FAMILIES.map((family) => family.id).sort();
  assert.equal(topRank.maximumRemixes, 5);

  for (const [modeIndex, mode] of modes.entries()) {
    const game = buildGameForMode(
      mode.id,
      20_000 + modeIndex * 911,
      "",
      0,
      adaptiveStateAt(topRank)
    );
    assertValidRules(game, topRank);
    assert.equal(game.remixes.activeCount, 5);
    assert.deepEqual(
      game.remixes.rules.map((rule) => rule.family).sort(),
      expectedFamilies,
      `${mode.id} Cosmic play must realize each route-remix family once`
    );
  }
});
