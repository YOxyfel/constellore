import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  GameStore,
  RunRegistry,
  buildChallengeIdentity
} from "../game-services.mjs";
import {
  createRemixProgressionState
} from "../public/remix-progression.mjs";
import {
  createRemixReadinessState,
  recordRemixReadinessOutcome
} from "../public/remix-readiness.mjs";
import { buildGameForMode } from "../server.mjs";

async function registeredStore() {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  return { store, playerId: player.id };
}

function routeOutcome(overrides = {}) {
  return {
    outcome: "completed",
    mode: "reach",
    target: "City",
    rankId: "bronze",
    familyIds: [],
    clean: true,
    flawless: true,
    ...overrides
  };
}

test("online Route Rank outcomes are server-owned and runId-idempotent", async () => {
  const { store, playerId } = await registeredStore();

  const first = store.recordRouteRankOutcome(playerId, routeOutcome({
    outcomeId: "run-clean-1"
  }));
  assert.equal(first.duplicate, false);
  assert.equal(first.masteryAward, 20);
  assert.equal(first.routeRank.mastery.points, 20);

  const replay = store.recordRouteRankOutcome(playerId, routeOutcome({
    outcomeId: "run-clean-1"
  }));
  assert.equal(replay.duplicate, true);
  assert.equal(replay.routeRank.mastery.points, 20);
  assert.equal(
    store.data.progressionLedger.filter(
      (entry) => entry.type === "route_rank_outcome"
    ).length,
    1
  );

  for (const [id, flags] of [
    ["run-assisted", { assisted: true }],
    ["run-paid", { assisted: true, paid: true }],
    ["run-major-help", { usedMajorPowerup: true }],
    ["run-reveal", { outcome: "reveal", usedReveal: true }],
    ["run-forfeit", { outcome: "forfeit" }]
  ]) {
    const result = store.recordRouteRankOutcome(playerId, routeOutcome({
      outcomeId: id,
      ...flags
    }));
    assert.equal(result.masteryAward, 0, id);
  }
  assert.equal(store.publicRouteRank(playerId).mastery.points, 20);
});

test("promotion trials resolve only after all three authoritative outcomes", async () => {
  const { store, playerId } = await registeredStore();
  store.data.players[playerId].routeProgression = {
    ...createRemixProgressionState(),
    masteryPoints: 50,
    rankId: "bronze"
  };

  const prepared = store.ensureRoutePromotion(playerId);
  assert.equal(prepared.changed, true);
  assert.equal(prepared.promotion.active, true);
  assert.equal(prepared.promotion.targetRank.id, "silver");
  assert.equal(prepared.promotion.attempt, 1);

  const outcomes = [
    routeOutcome({ outcomeId: "promotion-1" }),
    routeOutcome({ outcomeId: "promotion-2", outcome: "failed", clean: false, flawless: false }),
    routeOutcome({ outcomeId: "promotion-3" })
  ];
  const first = store.recordRouteRankOutcome(playerId, outcomes[0]);
  const second = store.recordRouteRankOutcome(playerId, outcomes[1]);
  assert.equal(first.promotion.active, true);
  assert.equal(second.promotion.active, true);
  assert.equal(store.publicRouteRank(playerId).rank.id, "bronze");

  const third = store.recordRouteRankOutcome(playerId, outcomes[2]);
  assert.equal(third.promotion.active, false);
  assert.equal(third.promotion.promoted, true);
  assert.equal(store.publicRouteRank(playerId).rank.id, "silver");
});

test("flawless promotion grants its head start while a failed trial retains 80%", async () => {
  const flawless = await registeredStore();
  flawless.store.data.players[flawless.playerId].routeProgression = {
    ...createRemixProgressionState(),
    masteryPoints: 50,
    rankId: "bronze"
  };
  flawless.store.ensureRoutePromotion(flawless.playerId);
  for (let index = 1; index <= 3; index += 1) {
    flawless.store.recordRouteRankOutcome(
      flawless.playerId,
      routeOutcome({ outcomeId: `flawless-${index}` })
    );
  }
  const flawlessRank = flawless.store.publicRouteRank(flawless.playerId);
  assert.equal(flawlessRank.rank.id, "silver");
  assert.equal(flawlessRank.mastery.points, 87);

  const failed = await registeredStore();
  failed.store.data.players[failed.playerId].routeProgression = {
    ...createRemixProgressionState(),
    masteryPoints: 50,
    rankId: "bronze"
  };
  failed.store.ensureRoutePromotion(failed.playerId);
  for (let index = 1; index <= 3; index += 1) {
    failed.store.recordRouteRankOutcome(
      failed.playerId,
      routeOutcome({
        outcomeId: `failed-${index}`,
        outcome: index === 1 ? "completed" : "failed",
        clean: index === 1,
        flawless: index === 1
      })
    );
  }
  const failedRank = failed.store.publicRouteRank(failed.playerId);
  assert.equal(failedRank.rank.id, "bronze");
  assert.equal(failedRank.mastery.points, 40);
  assert.equal(failedRank.promotion.active, false);
});

test("authoritative readiness raises intensity and introduces at most one family", async () => {
  const { store, playerId } = await registeredStore();
  const player = store.data.players[playerId];
  player.routeProgression = {
    ...createRemixProgressionState(),
    masteryPoints: 550,
    rankId: "diamond"
  };
  let readiness = createRemixReadinessState();
  for (let index = 0; index < 3; index += 1) {
    readiness = recordRemixReadinessOutcome(readiness, {
      outcomeId: `waypoint-proof-${index}`,
      outcome: "completed",
      rankId: "diamond",
      families: ["required_waypoint"],
      clean: true
    }).state;
  }
  player.remixReadiness = readiness;

  const context = store.routeChallengeState(playerId);
  const game = buildGameForMode(
    "reach",
    4,
    "City",
    0,
    context.adaptiveDifficulty,
    context
  );
  assert.equal(game.remixes.rank.id, "diamond");
  assert.equal(game.remixes.requestedCount, 2);
  assert.equal(game.remixes.activeCount, 2);
  assert.equal(game.remixes.introducesFamily, "forbidden_shortcut");
  assert.deepEqual(
    game.remixes.rules.map((rule) => rule.family).sort(),
    ["forbidden_shortcut", "required_waypoint"]
  );
});

test("promotion challenge metadata is public and part of signed challenge identity", async () => {
  const { store, playerId } = await registeredStore();
  store.data.players[playerId].routeProgression = {
    ...createRemixProgressionState(),
    masteryPoints: 200,
    rankId: "silver"
  };
  store.ensureRoutePromotion(playerId);
  const context = store.routeChallengeState(playerId);
  const game = buildGameForMode(
    "reach",
    9,
    "City",
    0,
    context.adaptiveDifficulty,
    context
  );

  assert.equal(game.promotion.active, true);
  assert.equal(game.promotion.currentRank.id, "silver");
  assert.equal(game.promotion.targetRank.id, "gold");
  assert.equal(game.promotion.attempt, 1);
  assert.equal(game.promotion.attemptsTotal, 3);
  assert.equal(game.promotion.winsRequired, 2);
  assert.equal(game.remixes.rank.id, "gold");
  assert.equal(game.remixes.activeCount, 1);

  const signedIdentity = buildChallengeIdentity(game);
  assert.deepEqual(signedIdentity.descriptor.modifier.promotion, {
    currentRank: "silver",
    targetRank: "gold",
    attempt: 1,
    attemptsTotal: 3,
    winsRequired: 2
  });
  assert.notEqual(
    signedIdentity.key,
    buildChallengeIdentity({ ...game, promotion: null }).key
  );
});

test("Route Rank state, active promotion, and outcome idempotency survive restart", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-route-rank-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "store.json");
  const first = await new GameStore(path).init();
  const registered = await first.registerPlayer();
  first.data.players[registered.id].routeProgression = {
    ...createRemixProgressionState(),
    masteryPoints: 50,
    rankId: "bronze"
  };
  first.ensureRoutePromotion(registered.id);
  first.recordRouteRankOutcome(
    registered.id,
    routeOutcome({ outcomeId: "durable-promotion-1" })
  );
  await first.persist();

  const restored = await new GameStore(path).init();
  const restoredRank = restored.publicRouteRank(registered.id);
  assert.equal(restoredRank.rank.id, "bronze");
  assert.equal(restoredRank.promotion.active, true);
  assert.equal(restoredRank.promotion.attempt, 2);
  assert.equal(restoredRank.promotion.wins, 1);

  const duplicate = restored.recordRouteRankOutcome(
    registered.id,
    routeOutcome({ outcomeId: "durable-promotion-1" })
  );
  assert.equal(duplicate.duplicate, true);
  assert.equal(restored.publicRouteRank(registered.id).promotion.attempt, 2);
});

test("RunRegistry records a completed adaptive run once and restores it safely", async () => {
  const { store, playerId } = await registeredStore();
  const registry = new RunRegistry(store);
  const game = {
    adaptive: true,
    mode: "reach",
    modeName: "Reach",
    target: "Mud",
    starters: ["Earth", "Water", "Fire", "Air"],
    routeLength: 1,
    tier: 1,
    seed: 17,
    timeLimit: null,
    moveLimit: null,
    reward: 70
  };
  const started = registry.start(playerId, game);
  registry.recordCombination(started.run, {
    word: "Mud",
    emoji: "",
    note: "Water softens earth.",
    source: "world"
  }, { a: "Earth", b: "Water" });
  await registry.persist(started.run);

  assert.equal(store.publicRouteRank(playerId).mastery.points, 20);
  assert.equal(
    store.data.progressionLedger.filter(
      (entry) => entry.idempotencyKey === `route-rank:${playerId}:run:${started.run.runId}`
    ).length,
    1
  );

  const restoredRegistry = new RunRegistry(store);
  const restoredRun = restoredRegistry.get(
    started.run.runId,
    playerId,
    started.token
  );
  assert.equal(restoredRegistry.progress(restoredRun).completed, true);
  assert.equal(store.publicRouteRank(playerId).mastery.points, 20);
});

test("repeating an adaptive forfeit is idempotent", async () => {
  const { store, playerId } = await registeredStore();
  const registry = new RunRegistry(store);
  const started = registry.start(playerId, {
    adaptive: true,
    mode: "reach",
    modeName: "Reach",
    target: "Mud",
    starters: ["Earth", "Water", "Fire", "Air"],
    routeLength: 1,
    tier: 1,
    seed: 29,
    timeLimit: null,
    moveLimit: null,
    reward: 70
  });

  registry.forfeit(started.run);
  registry.forfeit(started.run);
  assert.equal(
    store.data.progressionLedger.filter(
      (entry) => entry.idempotencyKey === `route-rank:${playerId}:run:${started.run.runId}`
    ).length,
    1
  );
  assert.equal(store.publicRouteRank(playerId).mastery.points, 0);
  assert.equal(store.routeChallengeState(playerId).adaptiveDifficulty.level, 1);
  assert.equal(Object.hasOwn(store.publicRouteRank(playerId), "adaptiveDifficulty"), false);
});

test("one active adaptive challenge prevents multi-tab mastery farming", async () => {
  const { store, playerId } = await registeredStore();
  const registry = new RunRegistry(store);
  const game = {
    adaptive: true,
    mode: "reach",
    modeName: "Reach",
    target: "Mud",
    starters: ["Earth", "Water", "Fire", "Air"],
    routeLength: 1,
    tier: 1,
    seed: 31,
    timeLimit: null,
    moveLimit: null,
    reward: 70
  };
  const first = registry.start(playerId, game);
  assert.throws(
    () => registry.start(playerId, { ...game, seed: 32 }),
    (error) => error.serviceCode === "adaptive_attempt_active"
  );
  registry.forfeit(first.run);
  assert.doesNotThrow(() => registry.start(playerId, { ...game, seed: 32 }));
});
