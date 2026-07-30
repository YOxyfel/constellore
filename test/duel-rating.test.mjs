import test from "node:test";
import assert from "node:assert/strict";
import {
  DUEL_SEASON_ID,
  sanitizeDuelEligibility,
  sanitizeDuelRating
} from "../game-services.mjs";
import {
  DUEL_DISCONNECT_AFTER_MS,
  DUEL_RECONNECT_GRACE_MS
} from "../duel-services.mjs";
import {
  createDuelHarness,
  createStartedInvite,
  successfulAction
} from "./fixtures/duel-harness.mjs";

async function createStartedPublicDuel(harness, suffix = "0001") {
  const [first, second] = harness.players;
  const duel = await harness.service.createDuel("public", [first.id, second.id], {
    rated: true
  });
  await harness.service.ready(duel.id, first.id, {
    actionId: `ready_a${suffix}`,
    ready: true
  });
  const countdown = await harness.service.ready(duel.id, second.id, {
    actionId: `ready_b${suffix}`,
    ready: true
  });
  harness.setNow(Date.parse(countdown.duel.startsAt));
  await harness.service.tick();
  return duel.id;
}

test("public Duel Elo starts at 1000, uses K40 provisionally, and settles idempotently", async () => {
  const harness = await createDuelHarness({ target: "Mud" });
  const [winner, loser] = harness.players;
  const duelId = await createStartedPublicDuel(harness);
  const result = await successfulAction(harness.service, duelId, winner.id, {
    actionId: "finish_rate1",
    a: "Earth",
    b: "Water"
  });

  assert.equal(result.duel.status, "finished");
  assert.equal(result.duel.rating.delta, 20);
  assert.deepEqual(
    sanitizeDuelRating(harness.store.data.players[winner.id].duelRating),
    {
      seasonId: DUEL_SEASON_ID,
      rating: 1020,
      games: 1,
      wins: 1,
      losses: 0,
      draws: 0,
      streak: 1,
      provisional: true,
      updatedAt: new Date(harness.now()).toISOString()
    }
  );
  assert.equal(harness.store.data.players[loser.id].duelRating.rating, 980);
  assert.equal(harness.store.data.players[loser.id].duelRating.losses, 1);
  assert.equal(harness.store.data.duelRatingLedger.length, 1);
  assert.equal(harness.store.data.duelResults.length, 1);

  const beforeRatings = harness.store.data.duelRatingLedger[0].participants.map((entry) => entry.after);
  await harness.service.finishDuel(
    harness.store.data.duels[duelId],
    loser.id,
    "duplicate_finish"
  );
  assert.equal(harness.store.data.duelRatingLedger.length, 1);
  assert.equal(harness.store.data.duelResults.length, 1);
  assert.deepEqual(
    harness.store.data.duelRatingLedger[0].participants.map((entry) => entry.after),
    beforeRatings
  );
});

test("established players use K24 and ratings stay within the 100-10000 bounds", async () => {
  const harness = await createDuelHarness({ target: "Mud" });
  const [winner, loser] = harness.players;
  for (const player of [winner, loser]) {
    harness.store.data.players[player.id].duelRating = sanitizeDuelRating({
      seasonId: DUEL_SEASON_ID,
      rating: 1_000,
      games: 10,
      wins: 5,
      losses: 5,
      draws: 0,
      streak: 0
    });
  }
  const duelId = await createStartedPublicDuel(harness, "0002");
  await successfulAction(harness.service, duelId, winner.id, {
    actionId: "finish_rate2",
    a: "Earth",
    b: "Water"
  });
  assert.equal(harness.store.data.players[winner.id].duelRating.rating, 1_012);
  assert.equal(harness.store.data.players[loser.id].duelRating.rating, 988);

  harness.store.data.players[winner.id].duelRating = sanitizeDuelRating({
    rating: 100,
    games: 20,
    wins: 0,
    losses: 20
  });
  harness.store.data.players[loser.id].duelRating = sanitizeDuelRating({
    rating: 100,
    games: 20,
    wins: 0,
    losses: 20
  });
  harness.advance(1_000);
  const floorDuelId = await createStartedPublicDuel(harness, "0003");
  await harness.service.forfeit(floorDuelId, winner.id, {
    actionId: "forfeit_0003"
  });
  assert.equal(harness.store.data.players[winner.id].duelRating.rating, 100);
  assert.equal(harness.store.data.players[loser.id].duelRating.rating, 100);

  harness.store.data.players[winner.id].duelRating = sanitizeDuelRating({
    rating: 10_000,
    games: 20,
    wins: 10,
    losses: 10
  });
  harness.store.data.players[loser.id].duelRating = sanitizeDuelRating({
    rating: 9_999,
    games: 20,
    wins: 10,
    losses: 10
  });
  harness.advance(1_000);
  const ceilingDuelId = await createStartedPublicDuel(harness, "0004");
  await harness.service.forfeit(ceilingDuelId, winner.id, {
    actionId: "forfeit_0004"
  });
  assert.equal(harness.store.data.players[winner.id].duelRating.rating, 9_999);
  assert.equal(harness.store.data.players[loser.id].duelRating.rating, 10_000);
});

test("only the first three public results per pair in 24 hours change rating", async () => {
  const harness = await createDuelHarness({ target: "Mud" });
  const [winner, loser] = harness.players;
  const receipts = [];
  for (let index = 0; index < 4; index += 1) {
    const suffix = String(index + 10).padStart(4, "0");
    const duelId = await createStartedPublicDuel(harness, suffix);
    const finished = await successfulAction(harness.service, duelId, winner.id, {
      actionId: `finish_${suffix}`,
      a: "Earth",
      b: "Water"
    });
    receipts.push(finished.duel.rating.rated);
    harness.advance(1_000);
  }
  assert.deepEqual(receipts, [true, true, true, false]);
  assert.equal(harness.store.data.players[winner.id].duelRating.games, 3);
  assert.equal(harness.store.data.players[loser.id].duelRating.games, 3);
  assert.equal(harness.store.data.duelRatingLedger.length, 3);
  assert.equal(harness.store.data.duelResults.length, 4);
  assert.equal(harness.store.data.duelResults.at(-1).rated, false);
});

test("private invitations and rematches never affect Duel rating", async () => {
  const harness = await createDuelHarness({ target: "Mud" });
  const { duelId, host, rival } = await createStartedInvite(harness);
  await successfulAction(harness.service, duelId, host.id, {
    actionId: "finish_priv1",
    a: "Earth",
    b: "Water"
  });
  assert.equal(harness.store.data.players[host.id].duelRating.games, 0);
  assert.equal(harness.store.data.players[rival.id].duelRating.games, 0);

  await harness.service.requestRematch(duelId, host.id, {
    actionId: "rematch_0001"
  });
  const accepted = await harness.service.requestRematch(duelId, rival.id, {
    actionId: "rematch_0002"
  });
  assert.equal(accepted.duel.kind, "rematch");
  assert.equal(accepted.duel.rated, false);
  assert.equal(accepted.duel.ranked, false);
});

test("a competitor who vanished before the shared start forfeits without a rating change", async () => {
  const harness = await createDuelHarness({ target: "Mud" });
  const [vanished, connected] = harness.players;
  const duelId = await createStartedPublicDuel(harness, "0005");
  await harness.service.heartbeat(duelId, connected.id);
  const duel = harness.store.data.duels[duelId];
  const vanishedParticipant = duel.participants.find((entry) => entry.playerId === vanished.id);
  harness.setNow(vanishedParticipant.lastSeenAt + DUEL_DISCONNECT_AFTER_MS);
  await harness.service.tick();
  assert.ok(vanishedParticipant.disconnectedAt);

  harness.advance(DUEL_RECONNECT_GRACE_MS - 1_000);
  await harness.service.heartbeat(duelId, connected.id);
  harness.advance(1_000);
  await harness.service.tick();
  const finished = (await harness.service.snapshot(duelId, connected.id)).duel;
  assert.equal(finished.status, "finished");
  assert.equal(finished.finishReason, "disconnect_forfeit");
  assert.equal(finished.winnerId, "slot-b");
  assert.equal(finished.rated, false);
  assert.equal(harness.store.data.players[vanished.id].duelRating.games, 0);
  assert.equal(harness.store.data.players[connected.id].duelRating.games, 0);
});

test("hybrid matchmaking persists one local-win attestation and accepts authoritative solo records", async () => {
  const harness = await createDuelHarness();
  const [localWinner, ledgerWinner, scoreWinner] = harness.players;

  await assert.rejects(
    harness.service.joinPublicQueue(localWinner.id, {
      actionId: "queue_lock01"
    }),
    (error) => error.serviceCode === "duel_matchmaking_locked"
  );
  for (const soloWins of [-1, 1.5, 100_001]) {
    await assert.rejects(
      harness.service.joinPublicQueue(localWinner.id, {
        actionId: `queue_bad${String(soloWins).replaceAll(/[^0-9]/g, "")}`.padEnd(8, "0"),
        soloWins
      }),
      (error) => error.serviceCode === "invalid_duel_solo_wins"
    );
  }

  const queued = await harness.service.joinPublicQueue(localWinner.id, {
    actionId: "queue_local1",
    soloWins: 1
  });
  assert.equal(queued.queue.status, "waiting");
  const attestation = sanitizeDuelEligibility(
    harness.store.data.players[localWinner.id].duelEligibility
  );
  assert.equal(attestation.soloWinAttested, true);
  assert.equal(attestation.attestedAt, new Date(harness.now()).toISOString());
  await harness.service.leavePublicQueue(localWinner.id);

  harness.advance(60_000);
  await harness.service.joinPublicQueue(localWinner.id, {
    actionId: "queue_local2",
    soloWins: 0
  });
  assert.deepEqual(
    sanitizeDuelEligibility(harness.store.data.players[localWinner.id].duelEligibility),
    attestation,
    "later client values must not rewrite the one-time attestation"
  );
  await harness.service.leavePublicQueue(localWinner.id);

  harness.store.data.progressionLedger.push({
    playerId: ledgerWinner.id,
    type: "verified_run_completed"
  });
  const authoritativeLedger = await harness.service.joinPublicQueue(ledgerWinner.id, {
    actionId: "queue_ledger1"
  });
  assert.equal(authoritativeLedger.queue.status, "waiting");
  assert.equal(
    sanitizeDuelEligibility(harness.store.data.players[ledgerWinner.id].duelEligibility).soloWinAttested,
    false
  );
  await harness.service.leavePublicQueue(ledgerWinner.id);

  harness.store.data.scores.push({
    playerId: scoreWinner.id,
    status: "verified"
  });
  const authoritativeScore = await harness.service.joinPublicQueue(scoreWinner.id, {
    actionId: "queue_score01"
  });
  assert.equal(authoritativeScore.queue.status, "waiting");
});

test("leaderboard hides provisional players until five settled games", async () => {
  const harness = await createDuelHarness();
  const [provisional, established] = harness.players;
  harness.store.data.players[provisional.id].duelRating = sanitizeDuelRating({
    rating: 1_500,
    games: 4,
    wins: 4
  });
  harness.store.data.players[established.id].duelRating = sanitizeDuelRating({
    rating: 1_100,
    games: 5,
    wins: 3,
    losses: 2
  });
  const leaderboard = await harness.service.leaderboard();
  assert.equal(leaderboard.seasonId, DUEL_SEASON_ID);
  assert.equal(leaderboard.entries.length, 1);
  assert.equal(leaderboard.entries[0].callsign, established.callsign);
});
