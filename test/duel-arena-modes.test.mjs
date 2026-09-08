import test from "node:test";
import assert from "node:assert/strict";
import {
  createDuelHarness,
  successfulAction
} from "./fixtures/duel-harness.mjs";

async function createStartedDuel(harness, {
  format,
  kind = "invite",
  rated = kind === "public"
} = {}) {
  const [host, rival] = harness.players;
  const duel = await harness.service.createDuel(kind, [host.id, rival.id], {
    ...(format === undefined ? {} : { format }),
    rated
  });
  await harness.service.ready(duel.id, host.id, {
    actionId: `ready_a_${duel.id.slice(0, 8)}`,
    ready: true
  });
  const countdown = await harness.service.ready(duel.id, rival.id, {
    actionId: `ready_b_${duel.id.slice(0, 8)}`,
    ready: true
  });
  harness.setNow(Date.parse(countdown.duel.startsAt));
  await harness.service.tick();
  return { duelId: duel.id, host, rival };
}

function participantFor(harness, duelId, playerId) {
  return harness.store.data.duels[duelId].participants.find((entry) =>
    entry.playerId === playerId
  );
}

function boardFor(snapshot, slot) {
  return snapshot.duel.boards.find((entry) => entry.slot === slot);
}

async function actAtCurrentRevision(harness, duelId, playerId, {
  actionId,
  a,
  b
}) {
  return successfulAction(harness.service, duelId, playerId, {
    actionId,
    a,
    b,
    expectedRevision: participantFor(harness, duelId, playerId).revision
  });
}

test("missing Scramble format remains the five-minute Target Race while unsupported modes fail closed", async () => {
  const harness = await createDuelHarness();
  const [host, rival] = harness.players;
  const duel = await harness.service.createDuel("invite", [host.id, rival.id]);
  const snapshot = (await harness.service.snapshot(duel.id, host.id)).duel;

  assert.equal(duel.format, "target-race");
  assert.equal(duel.game.scrambleFormat, "target-race");
  assert.equal(duel.game.timeLimit, 300);
  assert.equal(snapshot.format, "target-race");
  assert.equal(snapshot.durationSeconds, 300);
  assert.deepEqual(snapshot.rules, { durationSeconds: 300 });

  for (const format of ["unknown-format", "claim-war"]) {
    await assert.rejects(
      harness.service.createDuel("invite", [host.id, rival.id], { format }),
      (error) => {
        assert.equal(error.serviceCode, "scramble_mode_unavailable");
        assert.equal(error.statusCode, 422);
        return true;
      }
    );
  }
});

test("public matchmaking isolates queues by format and matches compatible tickets", async () => {
  const harness = await createDuelHarness();
  const [targetPlayer, firstStormPlayer, secondStormPlayer] = harness.players;
  for (const player of harness.players) {
    harness.store.data.players[player.id].duelEligibility = {
      soloWinAttested: true,
      attestedAt: new Date(harness.now()).toISOString()
    };
  }

  const targetTicket = await harness.service.joinPublicQueue(targetPlayer.id, {
    actionId: "queue_target_01",
    format: "target-race"
  });
  const firstStormTicket = await harness.service.joinPublicQueue(firstStormPlayer.id, {
    actionId: "queue_storm_01",
    format: "wordstorm",
    frameSlug: "verdant-reliquary"
  });

  assert.deepEqual(targetTicket.queue, {
    status: "waiting",
    position: 1,
    format: "target-race"
  });
  assert.deepEqual(firstStormTicket.queue, {
    status: "waiting",
    position: 1,
    format: "wordstorm"
  });
  assert.equal(harness.service.queue.size, 2, "different formats must not cross-match");

  const matched = await harness.service.joinPublicQueue(secondStormPlayer.id, {
    actionId: "queue_storm_02",
    format: "wordstorm",
    frameSlug: "gravebound-king"
  });
  assert.equal(matched.queue.status, "matched");
  assert.equal(matched.duel.format, "wordstorm");
  assert.equal(matched.duel.durationSeconds, 120);
  assert.equal(harness.store.data.duels[matched.duel.id].participants.length, 2);
  assert.deepEqual(
    matched.duel.players.map(({ side, frameSlug }) => ({ side, frameSlug })),
    [
      { side: "rival", frameSlug: "verdant-reliquary" },
      { side: "self", frameSlug: "gravebound-king" }
    ]
  );
  assert.deepEqual(
    harness.store.data.duels[matched.duel.id].participants.map((entry) => entry.playerId).sort(),
    [firstStormPlayer.id, secondStormPlayer.id].sort()
  );

  const targetStillWaiting = await harness.service.queueStatus(targetPlayer.id);
  assert.deepEqual(targetStillWaiting.queue, {
    status: "waiting",
    position: 1,
    format: "target-race"
  });
  assert.equal(harness.service.queue.size, 1);
});

test("Wordstorm lasts 120 seconds, counts unique discoveries, and ends at the twelve-word quota", async () => {
  let resolveCalls = 0;
  const harness = await createDuelHarness({
    resolveCombination: async (a, b) => {
      if (![a, b].sort().every((word, index) =>
        word === ["Earth", "Water"][index]
      )) return null;
      resolveCalls += 1;
      const discoveryNumber = Math.max(1, resolveCalls - 1);
      return {
        word: `Discovery ${discoveryNumber}`,
        emoji: "\u2726",
        category: "matter",
        source: "world"
      };
    }
  });
  const { duelId, host } = await createStartedDuel(harness, {
    format: "wordstorm"
  });
  let snapshot = (await harness.service.snapshot(duelId, host.id)).duel;

  assert.equal(snapshot.durationSeconds, 120);
  assert.equal(
    Date.parse(snapshot.deadlineAt) - Date.parse(snapshot.startsAt),
    120_000
  );
  assert.equal(boardFor({ duel: snapshot }, snapshot.selfSlot).formatState.quota, 12);

  let response = await actAtCurrentRevision(harness, duelId, host.id, {
    actionId: "storm_unique_01",
    a: "Earth",
    b: "Water"
  });
  harness.advance(61);
  response = await actAtCurrentRevision(harness, duelId, host.id, {
    actionId: "storm_repeat_02",
    a: "Earth",
    b: "Water"
  });
  let state = boardFor(response, response.duel.selfSlot).formatState;
  assert.equal(state.discoveries, 1);
  assert.equal(state.score, 1);
  assert.equal(state.remaining, 11);
  assert.equal(
    boardFor(response, response.duel.selfSlot).attempts,
    2,
    "the repeated recipe is still an attempt, but cannot farm score"
  );
  assert.equal(response.duel.status, "active");

  for (let action = 3; action <= 13; action += 1) {
    harness.advance(61);
    response = await actAtCurrentRevision(harness, duelId, host.id, {
      actionId: `storm_unique_${String(action).padStart(2, "0")}`,
      a: "Earth",
      b: "Water"
    });
  }
  state = boardFor(response, response.duel.selfSlot).formatState;
  assert.equal(state.discoveries, 12);
  assert.equal(state.score, 12);
  assert.equal(state.remaining, 0);
  assert.equal(state.complete, true);
  assert.equal(response.duel.status, "finished");
  assert.equal(response.duel.winnerId, "slot-a");
  assert.equal(response.duel.finishReason, "discovery_quota");
});

test("Wordstorm deadline compares score before rejected attempts, then uses accuracy as the tie-break", async () => {
  const scoreHarness = await createDuelHarness();
  const scoreMatch = await createStartedDuel(scoreHarness, { format: "wordstorm" });

  await actAtCurrentRevision(scoreHarness, scoreMatch.duelId, scoreMatch.host.id, {
    actionId: "storm_score_reject_1",
    a: "Earth",
    b: "Air"
  });
  scoreHarness.advance(61);
  await actAtCurrentRevision(scoreHarness, scoreMatch.duelId, scoreMatch.host.id, {
    actionId: "storm_score_reject_2",
    a: "Earth",
    b: "Air"
  });
  scoreHarness.advance(61);
  await actAtCurrentRevision(scoreHarness, scoreMatch.duelId, scoreMatch.host.id, {
    actionId: "storm_score_success",
    a: "Earth",
    b: "Water"
  });
  const scoreDeadline = Date.parse(
    (await scoreHarness.service.snapshot(scoreMatch.duelId, scoreMatch.host.id)).duel.deadlineAt
  );
  scoreHarness.setNow(scoreDeadline);
  await scoreHarness.service.tick();
  const scoreResult = (await scoreHarness.service.snapshot(
    scoreMatch.duelId,
    scoreMatch.host.id
  )).duel;

  assert.equal(scoreResult.status, "finished");
  assert.equal(scoreResult.winnerId, "slot-a");
  assert.equal(scoreResult.finishReason, "time_limit_score");
  assert.deepEqual(
    scoreResult.formatResult.standings.map(({ slot, score, rejectedAttempts }) => ({
      slot,
      score,
      rejectedAttempts
    })),
    [
      { slot: "slot-a", score: 1, rejectedAttempts: 2 },
      { slot: "slot-b", score: 0, rejectedAttempts: 0 }
    ]
  );

  const accuracyHarness = await createDuelHarness();
  const accuracyMatch = await createStartedDuel(accuracyHarness, {
    format: "wordstorm"
  });
  await actAtCurrentRevision(
    accuracyHarness,
    accuracyMatch.duelId,
    accuracyMatch.host.id,
    {
      actionId: "storm_accuracy_reject",
      a: "Earth",
      b: "Air"
    }
  );
  const accuracyDeadline = Date.parse(
    (await accuracyHarness.service.snapshot(
      accuracyMatch.duelId,
      accuracyMatch.host.id
    )).duel.deadlineAt
  );
  accuracyHarness.setNow(accuracyDeadline);
  await accuracyHarness.service.tick();
  const accuracyResult = (await accuracyHarness.service.snapshot(
    accuracyMatch.duelId,
    accuracyMatch.host.id
  )).duel;

  assert.equal(accuracyResult.status, "finished");
  assert.equal(accuracyResult.winnerId, "slot-b");
  assert.equal(accuracyResult.finishReason, "time_limit_accuracy");
  assert.deepEqual(
    accuracyResult.formatResult.standings.map(({ score, rejectedAttempts }) => ({
      score,
      rejectedAttempts
    })),
    [
      { score: 0, rejectedAttempts: 1 },
      { score: 0, rejectedAttempts: 0 }
    ]
  );
});

test("Forge Clash spends rejected turns exactly once, locks exhausted players, and resolves deterministically", async () => {
  const harness = await createDuelHarness();
  const { duelId, host, rival } = await createStartedDuel(harness, {
    format: "forge-clash"
  });
  let response = await successfulAction(harness.service, duelId, host.id, {
    actionId: "forge_host_01",
    a: "Earth",
    b: "Air",
    expectedRevision: 0
  });
  let hostState = boardFor(response, "slot-a").formatState;

  assert.equal(response.duel.durationSeconds, 150);
  assert.equal(hostState.turnLimit, 6);
  assert.equal(hostState.turnsLeft, 5);
  assert.equal(boardFor(response, "slot-a").attempts, 1);
  assert.equal(boardFor(response, "slot-a").rejectedAttempts, 1);

  const replay = await successfulAction(harness.service, duelId, host.id, {
    actionId: "forge_host_01",
    a: "Earth",
    b: "Air",
    expectedRevision: 0
  });
  assert.equal(replay.event.sequence, response.event.sequence);
  assert.equal(boardFor(replay, "slot-a").attempts, 1);
  assert.equal(boardFor(replay, "slot-a").formatState.turnsLeft, 5);

  await assert.rejects(
    successfulAction(harness.service, duelId, host.id, {
      actionId: "forge_stale_02",
      a: "Earth",
      b: "Air",
      expectedRevision: 0
    }),
    (error) => {
      assert.equal(error.serviceCode, "duel_revision_conflict");
      assert.equal(error.details.revision, 1);
      assert.equal(
        boardFor({ duel: error.details.duel }, "slot-a").formatState.turnsLeft,
        5
      );
      return true;
    }
  );
  assert.equal(participantFor(harness, duelId, host.id).revision, 1);
  assert.equal(harness.service.run(participantFor(harness, duelId, host.id)).attempts, 1);

  for (let turn = 2; turn <= 5; turn += 1) {
    harness.advance(61);
    response = await actAtCurrentRevision(harness, duelId, host.id, {
      actionId: `forge_host_0${turn}`,
      a: "Earth",
      b: "Air"
    });
  }
  harness.advance(61);
  response = await actAtCurrentRevision(harness, duelId, host.id, {
    actionId: "forge_host_06",
    a: "Earth",
    b: "Water"
  });
  hostState = boardFor(response, "slot-a").formatState;
  assert.equal(hostState.turnsLeft, 0);
  assert.equal(hostState.locked, true);
  assert.equal(hostState.complete, true);
  assert.equal(hostState.champion.word, "Mud");
  assert.equal(response.duel.status, "active", "one locked Forge waits for its rival");
  assert.equal(boardFor(response, "slot-b").formatState.turnsLeft, 6);

  harness.advance(61);
  await assert.rejects(
    actAtCurrentRevision(harness, duelId, host.id, {
      actionId: "forge_host_07",
      a: "Earth",
      b: "Air"
    }),
    (error) => error.serviceCode === "forge_turns_exhausted"
  );
  assert.equal(harness.service.run(participantFor(harness, duelId, host.id)).attempts, 6);

  for (let turn = 1; turn <= 6; turn += 1) {
    if (turn > 1) harness.advance(61);
    response = await actAtCurrentRevision(harness, duelId, rival.id, {
      actionId: `forge_rival_0${turn}`,
      a: "Earth",
      b: "Air"
    });
    if (turn === 1) {
      assert.equal(response.duel.status, "active");
      assert.equal(boardFor(response, "slot-b").formatState.turnsLeft, 5);
      assert.equal(boardFor(response, "slot-a").formatState.locked, true);
    }
  }

  assert.equal(response.duel.status, "finished");
  assert.equal(response.duel.winnerId, "slot-a");
  assert.equal(response.duel.finishReason, "turn_limit_only_champion");
  assert.deepEqual(response.duel.formatResult, {
    format: "forge-clash",
    battle: {
      winnerSlot: "slot-a",
      reason: "only_champion",
      left: {
        word: "Mud",
        emoji: "\u{1F7E4}",
        category: "structure",
        power: 1
      },
      right: null
    }
  });
  const repeatedSnapshot = (await harness.service.snapshot(duelId, host.id)).duel;
  assert.deepEqual(repeatedSnapshot.formatResult, response.duel.formatResult);
  assert.equal(
    repeatedSnapshot.events.filter((event) => event.type === "match_finished").length,
    1
  );
});

test("rematches preserve the original Scramble format and its authoritative timing", async () => {
  const harness = await createDuelHarness();
  const [host, rival] = harness.players;
  const duel = await harness.service.createDuel("invite", [host.id, rival.id], {
    format: "wordstorm",
    frameSlugs: ["berry-burrow", "lunar-reverie"]
  });
  await harness.service.finishDuel(duel, host.id, "test_finish");
  await harness.service.requestRematch(duel.id, host.id, {
    actionId: "rematch_mode_01"
  });
  const accepted = await harness.service.requestRematch(duel.id, rival.id, {
    actionId: "rematch_mode_02"
  });

  assert.equal(accepted.rematchOf, duel.id);
  assert.equal(accepted.duel.kind, "rematch");
  assert.equal(accepted.duel.rated, false);
  assert.equal(accepted.duel.format, "wordstorm");
  assert.equal(accepted.duel.durationSeconds, 120);
  assert.deepEqual(
    accepted.duel.players.map((player) => player.frameSlug),
    ["berry-burrow", "lunar-reverie"]
  );
  assert.deepEqual(accepted.duel.rules, {
    durationSeconds: 120,
    discoveryQuota: 12
  });
  assert.equal(
    harness.store.data.duels[accepted.duel.id].game.scrambleFormat,
    "wordstorm"
  );
});

test("ratings are isolated per mode while shared Arena XP settles once per rated result", async () => {
  const harness = await createDuelHarness({ target: "Mud" });
  const targetMatch = await createStartedDuel(harness, {
    format: "target-race",
    kind: "public"
  });
  const targetFinish = await actAtCurrentRevision(
    harness,
    targetMatch.duelId,
    targetMatch.host.id,
    {
      actionId: "arena_target_win",
      a: "Earth",
      b: "Water"
    }
  );
  assert.equal(targetFinish.duel.status, "finished");

  let winnerArena = harness.service.arena(targetMatch.host.id);
  let loserArena = harness.service.arena(targetMatch.rival.id);
  assert.equal(winnerArena.ratings["target-race"].rating, 1_020);
  assert.equal(winnerArena.ratings["target-race"].games, 1);
  assert.equal(winnerArena.ratings.wordstorm.rating, 1_000);
  assert.equal(winnerArena.ratings.wordstorm.games, 0);
  assert.equal(winnerArena.ratings["forge-clash"].games, 0);
  assert.equal(winnerArena.progression.xp, 40);
  assert.equal(loserArena.progression.xp, 16);

  await harness.service.finishDuel(
    harness.store.data.duels[targetMatch.duelId],
    targetMatch.rival.id,
    "duplicate_finish"
  );
  winnerArena = harness.service.arena(targetMatch.host.id);
  loserArena = harness.service.arena(targetMatch.rival.id);
  assert.equal(winnerArena.progression.xp, 40);
  assert.equal(loserArena.progression.xp, 16);
  assert.equal(harness.store.data.duelRatingLedger.length, 1);

  harness.advance(1_000);
  const stormMatch = await createStartedDuel(harness, {
    format: "wordstorm",
    kind: "public"
  });
  await actAtCurrentRevision(harness, stormMatch.duelId, stormMatch.host.id, {
    actionId: "arena_storm_word",
    a: "Earth",
    b: "Water"
  });
  const deadline = Date.parse(
    (await harness.service.snapshot(stormMatch.duelId, stormMatch.host.id)).duel.deadlineAt
  );
  harness.setNow(deadline);
  await harness.service.tick();

  const stormResult = (await harness.service.snapshot(
    stormMatch.duelId,
    stormMatch.host.id
  )).duel;
  assert.equal(stormResult.status, "finished");
  assert.equal(stormResult.winnerId, "slot-a");
  assert.equal(stormResult.rating.delta, 20);
  winnerArena = harness.service.arena(stormMatch.host.id);
  loserArena = harness.service.arena(stormMatch.rival.id);
  assert.equal(winnerArena.ratings["target-race"].rating, 1_020);
  assert.equal(winnerArena.ratings["target-race"].games, 1);
  assert.equal(winnerArena.ratings.wordstorm.rating, 1_020);
  assert.equal(winnerArena.ratings.wordstorm.games, 1);
  assert.equal(winnerArena.ratings["forge-clash"].rating, 1_000);
  assert.equal(winnerArena.ratings["forge-clash"].games, 0);
  assert.equal(winnerArena.progression.xp, 80);
  assert.equal(loserArena.ratings["target-race"].rating, 980);
  assert.equal(loserArena.ratings.wordstorm.rating, 980);
  assert.equal(loserArena.progression.xp, 32);

  const ledgersBeforeReplay = structuredClone(harness.store.data.duelRatingLedger);
  await harness.service.finishDuel(
    harness.store.data.duels[stormMatch.duelId],
    stormMatch.rival.id,
    "duplicate_finish"
  );
  assert.deepEqual(harness.store.data.duelRatingLedger, ledgersBeforeReplay);
  assert.equal(harness.service.arena(stormMatch.host.id).progression.xp, 80);
  assert.equal(harness.service.arena(stormMatch.rival.id).progression.xp, 32);
  assert.deepEqual(
    harness.store.data.duelRatingLedger.map((entry) => entry.format),
    ["target-race", "wordstorm"]
  );
});
