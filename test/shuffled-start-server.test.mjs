import assert from "node:assert/strict";
import test from "node:test";

import {
  GameStore,
  RunRegistry,
  buildChallengeIdentity
} from "../game-services.mjs";
import {
  createAdaptiveDifficultyState
} from "../public/adaptive-difficulty.mjs";
import {
  createRemixProgressionState,
  getRemixRankPresentation
} from "../public/remix-progression.mjs";
import {
  createRemixReadinessState
} from "../public/remix-readiness.mjs";
import {
  buildGameForMode,
  solutionRoute
} from "../server.mjs";

const CLASSIC = new Set(["earth", "water", "fire", "air"]);

function masteredReadiness() {
  const readiness = createRemixReadinessState();
  for (const family of Object.keys(readiness.familyMastery)) {
    readiness.familyMastery[family] = {
      attempts: 3,
      completions: 3,
      cleanCompletions: 3,
      mastered: true
    };
  }
  return readiness;
}

function routeContext({
  rank = "gold",
  completedChallenges = 0,
  startStylePreference = "auto",
  readiness = masteredReadiness(),
  failureStreak = 0
} = {}) {
  return {
    progression: {
      ...createRemixProgressionState(),
      rankId: rank,
      masteryPoints: 500,
      completedChallenges
    },
    readiness,
    adaptiveDifficulty: {
      ...createAdaptiveDifficultyState(),
      level: 6,
      completedChallenges,
      failureStreak
    },
    currentRank: getRemixRankPresentation(rank),
    challengeRank: getRemixRankPresentation(rank),
    promotion: {
      active: false,
      attemptsCompleted: 0
    },
    startStylePreference
  };
}

function adaptiveGame(context, seed = 7) {
  return buildGameForMode(
    "reach",
    seed,
    "City",
    0,
    context.adaptiveDifficulty,
    context
  );
}

test("authoritative Shuffled games sign one executable canonical suffix and temporary starter kit", () => {
  const game = adaptiveGame(routeContext());
  const canonicalRoute = solutionRoute(game.target);
  const suffix = canonicalRoute.slice(game.startProfile.routeStartIndex);

  assert.equal(game.startStyle, "shuffled");
  assert.ok(game.startProfile.routeStartIndex > 0);
  assert.equal(game.routeLength, suffix.length);
  assert.equal(game.startProfile.routeLength, suffix.length);
  assert.equal(game.startProfile.canonicalRouteLength, canonicalRoute.length);
  assert.deepEqual(
    game.startProfile.starterItems.map((item) => item.word),
    game.starters
  );
  assert.equal("route" in game.startProfile, false);
  assert.equal("challengeRoute" in game.startProfile, false);
  assert.equal("openings" in game.startProfile, false);
  assert.equal("sidePaths" in game.startProfile, false);

  const available = new Set(game.starters.map((word) => word.toLowerCase()));
  for (const step of suffix) {
    assert.ok(available.has(step.a.toLowerCase()), `${step.a} should be available`);
    assert.ok(available.has(step.b.toLowerCase()), `${step.b} should be available`);
    available.add(step.word.toLowerCase());
  }
  assert.ok(available.has(game.target.toLowerCase()));

  const advanced = game.starterItems.filter((item) => !CLASSIC.has(item.word.toLowerCase()));
  assert.ok(advanced.length >= 2);
  assert.ok(advanced.every((item) =>
    item.source === "loaned-start"
    && item.loaned === true
    && item.premium === false
    && item.paid === false
    && item.access === "loaned"
  ));

  const signed = buildChallengeIdentity(game);
  assert.equal(signed.descriptor.modifier.start.style, "shuffled");
  assert.equal(signed.descriptor.modifier.start.profileId, game.startProfile.profileId.toLowerCase());
  assert.deepEqual(signed.descriptor.modifier.start.starters, game.starters.map((word) => word.toLowerCase()));
  assert.notEqual(
    signed.key,
    buildChallengeIdentity({
      ...game,
      starters: [...game.starters].reverse()
    }).key
  );
});

test("Classic is enforced for onboarding, recovery, and a newly introduced remix family", () => {
  const bronze = adaptiveGame(routeContext({
    rank: "bronze",
    startStylePreference: "shuffled"
  }));
  assert.equal(bronze.startStyle, "classic");
  assert.equal(bronze.startProfile.selection.locked, true);
  assert.deepEqual(bronze.starters, ["Earth", "Water", "Fire", "Air"]);

  const recovery = adaptiveGame(routeContext({ failureStreak: 1 }));
  assert.equal(recovery.startStyle, "classic");
  assert.equal(recovery.startProfile.selection.reason, "failure_recovery");

  const introduction = adaptiveGame(routeContext({
    readiness: createRemixReadinessState()
  }));
  assert.equal(introduction.startStyle, "classic");
  assert.equal(introduction.startProfile.fallback, true);
  assert.equal(introduction.startProfile.fallbackReason, "new_remix_family");
  assert.ok(introduction.remixes.introducesFamily);
  assert.deepEqual(introduction.starters, ["Earth", "Water", "Fire", "Air"]);
});

test("loaned Shuffled starters survive run resume without becoming permanent origins", async () => {
  const source = adaptiveGame(routeContext());
  const game = {
    adaptive: false,
    mode: "reach",
    modeName: "Reach",
    target: source.target,
    seed: source.seed,
    tier: source.tier,
    reward: source.reward,
    timeLimit: null,
    moveLimit: null,
    routeLength: source.routeLength,
    startStyle: source.startStyle,
    startProfile: source.startProfile,
    starters: source.starters,
    starterItems: source.starterItems
  };
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const registry = new RunRegistry(store);
  const started = registry.start(player.id, game);
  const advanced = [...started.run.discovered.values()]
    .filter((item) => !CLASSIC.has(item.word.toLowerCase()));

  assert.ok(advanced.length >= 2);
  assert.ok(advanced.every((item) =>
    item.source === "loaned-start"
    && item.loaned === true
    && item.premium === false
  ));
  await registry.persist(started.run);

  const restoredRegistry = new RunRegistry(store);
  const restored = restoredRegistry.runs.get(started.run.runId);
  const restoredAdvanced = [...restored.discovered.values()]
    .filter((item) => !CLASSIC.has(item.word.toLowerCase()));
  assert.deepEqual(
    restoredAdvanced.map((item) => [item.word, item.source, item.loaned, item.premium]),
    advanced.map((item) => [item.word, item.source, item.loaned, item.premium])
  );
});
