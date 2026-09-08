import test from "node:test";
import assert from "node:assert/strict";
import {
  DUEL_MINIMUM_ROUTE_RANK,
  DUEL_DISCONNECT_AFTER_MS,
  DUEL_DURATION_MS,
  DUEL_INTERCEPT_MS,
  DUEL_RECONNECT_GRACE_MS
} from "../duel-services.mjs";
import { createRemixProgressionState, getRemixRank } from "../public/remix-progression.mjs";
import {
  createDuelHarness,
  createStartedInvite,
  successfulAction
} from "./fixtures/duel-harness.mjs";

function assertNoPrivateIdentifiers(payload, harness, extraSecrets = []) {
  const serialized = JSON.stringify(payload);
  for (const player of harness.players) {
    assert.equal(serialized.includes(player.id), false, "public payload leaked a player ID");
  }
  for (const run of harness.runs.runs.values()) {
    assert.equal(serialized.includes(run.runId), false, "public payload leaked a run ID");
  }
  for (const secret of extraSecrets) {
    assert.equal(serialized.includes(secret), false, `public payload leaked ${secret}`);
  }
}

function setRouteRank(harness, playerId, rankId) {
  const rank = getRemixRank(rankId);
  harness.store.data.players[playerId].routeProgression = createRemixProgressionState({
    rankId: rank.id,
    masteryPoints: rank.masteryPoints,
    completedChallenges: rank.completedChallenges
  });
}

test("the authoritative Arena gate rejects Bronze invitations, joins, and matchmaking", async () => {
  const harness = await createDuelHarness();
  const [bronze, host] = harness.players;
  setRouteRank(harness, bronze.id, "bronze");

  await assert.rejects(
    harness.service.createInvite(bronze.id, { actionId: "bronze_invite_lock" }),
    (error) => error.statusCode === 403
      && error.serviceCode === "duel_route_rank_locked"
      && error.details.minimumRouteRank === DUEL_MINIMUM_ROUTE_RANK
  );
  const invite = await harness.service.createInvite(host.id, { actionId: "silver_invite_ok" });
  await assert.rejects(
    harness.service.joinInvite(bronze.id, {
      actionId: "bronze_join_lock",
      inviteCode: invite.inviteCode
    }),
    (error) => error.statusCode === 403 && error.serviceCode === "duel_route_rank_locked"
  );
  await assert.rejects(
    harness.service.joinPublicQueue(bronze.id, {
      actionId: "bronze_queue_lock",
      soloWins: 99
    }),
    (error) => error.statusCode === 403 && error.serviceCode === "duel_route_rank_locked"
  );
  await assert.rejects(
    harness.service.createDuel("rematch", [host.id, bronze.id]),
    (error) => error.statusCode === 403 && error.serviceCode === "duel_route_rank_locked"
  );
  assert.equal(harness.service.hasArenaAccess(bronze.id), false);
  assert.equal(harness.service.hasArenaAccess(host.id), true);
  assert.equal(harness.store.data.players[bronze.id].duelEligibility.soloWinAttested, false);

  const finished = await harness.service.createDuel("invite", [host.id, harness.players[2].id]);
  await harness.service.finishDuel(finished, host.id, "test_finish");
  setRouteRank(harness, harness.players[2].id, "bronze");
  await assert.rejects(
    harness.service.requestRematch(finished.id, harness.players[2].id, { actionId: "bronze_rematch_lock" }),
    (error) => error.statusCode === 403 && error.serviceCode === "duel_route_rank_locked"
  );
  assert.equal(finished.rematchVotes.length, 0);
  assert.equal(finished.rematchDuelId, "");
});

test("invite Duels create isolated boards and one immutable shared countdown", async () => {
  const harness = await createDuelHarness();
  const [host, rival] = harness.players;
  const invited = await harness.service.createInvite(host.id, {
    actionId: "invite_1001",
    frameSlug: "berry-burrow"
  });
  const joined = await harness.service.joinInvite(rival.id, {
    actionId: "join_100001",
    inviteCode: invited.inviteCode,
    frameSlug: "lunar-reverie"
  });
  const stored = harness.store.data.duels[joined.duel.id];

  assert.equal(stored.participants.length, 2);
  assert.notEqual(stored.participants[0].runId, stored.participants[1].runId);
  assert.deepEqual(
    harness.runs.getOwned(stored.participants[0].runId, host.id).game,
    harness.runs.getOwned(stored.participants[1].runId, rival.id).game
  );
  assert.equal(joined.duel.kind, "invite");
  assert.equal(joined.duel.rated, false);
  assert.deepEqual(
    joined.duel.players.map(({ side, frameSlug }) => ({ side, frameSlug })),
    [
      { side: "rival", frameSlug: "berry-burrow" },
      { side: "self", frameSlug: "lunar-reverie" }
    ]
  );

  const firstReady = await harness.service.ready(joined.duel.id, host.id, {
    actionId: "ready_10001",
    ready: true
  });
  assert.equal(firstReady.duel.status, "waiting");
  assert.equal(firstReady.duel.startsAt, null);

  const countdown = await harness.service.ready(joined.duel.id, rival.id, {
    actionId: "ready_10002",
    ready: true
  });
  const startsAt = Date.parse(countdown.duel.startsAt);
  const deadlineAt = Date.parse(countdown.duel.deadlineAt);
  assert.equal(countdown.duel.status, "countdown");
  assert.equal(startsAt - harness.now(), 3_000);
  assert.equal(deadlineAt - startsAt, DUEL_DURATION_MS);

  const replayedReady = await harness.service.ready(joined.duel.id, host.id, {
    actionId: "ready_10003",
    ready: true
  });
  assert.equal(replayedReady.duel.startsAt, countdown.duel.startsAt);
  assert.equal(replayedReady.duel.deadlineAt, countdown.duel.deadlineAt);
  await assert.rejects(
    harness.service.ready(joined.duel.id, host.id, {
      actionId: "ready_10004",
      ready: false
    }),
    (error) => error.serviceCode === "duel_countdown_locked"
  );

  const rivalView = await harness.service.snapshot(joined.duel.id, rival.id);
  assert.equal(countdown.duel.selfSlot, "slot-b");
  assert.equal(rivalView.duel.selfSlot, "slot-b");
  assert.deepEqual(countdown.duel.starters, rivalView.duel.starters);
  assertNoPrivateIdentifiers(countdown, harness, [
    invited.inviteCode,
    "private-challenge-key",
    "private-signature"
  ]);
  assertNoPrivateIdentifiers(rivalView, harness, [invited.inviteCode]);
});

test("a restarted Duel with pruned run state is cancelled without breaking the service tick", async () => {
  const harness = await createDuelHarness();
  const { duelId } = await createStartedInvite(harness);
  const duel = harness.store.data.duels[duelId];
  const [missing, remaining] = duel.participants;

  assert.equal(duel.status, "active");
  assert.equal(harness.runs.discard(missing.runId), true);

  await assert.doesNotReject(harness.service.tick());
  assert.equal(duel.status, "cancelled");
  assert.equal(duel.rated, false);
  assert.equal(duel.finishReason, "run_unavailable");
  assert.equal(duel.winnerPlayerId, "");
  assert.equal(harness.runs.runs.has(remaining.runId), false);
  assert.equal(harness.store.data.duelResults.some((entry) => entry.id === duelId), false);
});

test("Arena frame slugs are allowlisted and invalid player art becomes unframed", async () => {
  const harness = await createDuelHarness();
  const [host, rival] = harness.players;
  const invited = await harness.service.createInvite(host.id, {
    actionId: "invite_frame_invalid",
    frameSlug: "../../not-an-arena-frame"
  });
  const joined = await harness.service.joinInvite(rival.id, {
    actionId: "join_frame_valid",
    inviteCode: invited.inviteCode,
    frameSlug: "ember-sovereign"
  });

  assert.deepEqual(
    joined.duel.players.map((player) => player.frameSlug),
    ["", "ember-sovereign"]
  );
  assert.deepEqual(
    harness.store.data.duels[joined.duel.id].participants.map((participant) => participant.frameSlug),
    ["", "ember-sovereign"]
  );
});

test("visible boards broadcast First Light, Intercept, and Echo Steal without solo progression", async () => {
  const harness = await createDuelHarness();
  const { duelId, host, rival } = await createStartedInvite(harness);
  const before = structuredClone({
    lifetime: harness.store.data.players[host.id].lifetimeDiscoveries,
    events: harness.store.data.players[host.id].cosmicEventDiscoveries,
    progressionLedger: harness.store.data.progressionLedger,
    scores: harness.store.data.scores
  });
  const delivered = [];
  const unsubscribe = harness.service.subscribe(duelId, host.id, (events) => {
    delivered.push(...events);
  });

  const first = await successfulAction(harness.service, duelId, host.id, {
    actionId: "action_10001",
    a: "Earth",
    b: "Water"
  });
  assert.equal(first.result.word, "Mud");
  assert.equal(first.event.type, "fusion_succeeded");
  assert.equal(first.duel.selfSlot, "slot-a");

  harness.advance(Math.min(500, DUEL_INTERCEPT_MS));
  await successfulAction(harness.service, duelId, rival.id, {
    actionId: "action_10002",
    a: "Earth",
    b: "Water"
  });

  harness.advance(DUEL_INTERCEPT_MS + 100);
  await successfulAction(harness.service, duelId, host.id, {
    actionId: "action_10003",
    a: "Fire",
    b: "Water",
    expectedRevision: 1
  });
  harness.advance(DUEL_INTERCEPT_MS + 100);
  await successfulAction(harness.service, duelId, rival.id, {
    actionId: "action_10004",
    a: "Fire",
    b: "Water",
    expectedRevision: 1
  });
  unsubscribe();

  const snapshot = (await harness.service.snapshot(duelId, host.id)).duel;
  const eventTypes = snapshot.events.map((event) => event.type);
  assert.ok(eventTypes.includes("first_light"));
  assert.ok(snapshot.events.some((event) =>
    event.type === "intercept" && event.classification === "INTERCEPTED"
  ));
  assert.ok(snapshot.events.some((event) =>
    event.type === "echo_steal" && event.classification === "ECHO_STEAL"
  ));
  const rivalBoard = snapshot.boards.find((board) => board.slot === "slot-b");
  assert.ok(rivalBoard.words.some((entry) => entry.word === "Mud"));
  assert.ok(rivalBoard.words.some((entry) => entry.word === "Steam"));
  assert.deepEqual(
    snapshot.events.map((event) => event.sequence),
    [...snapshot.events.map((event) => event.sequence)].sort((a, b) => a - b)
  );
  assert.equal(new Set(snapshot.events.map((event) => event.sequence)).size, snapshot.events.length);
  assertNoPrivateIdentifiers({ snapshot, delivered }, harness);
  assert.deepEqual(harness.store.data.players[host.id].lifetimeDiscoveries, before.lifetime);
  assert.deepEqual(harness.store.data.players[host.id].cosmicEventDiscoveries, before.events);
  assert.deepEqual(harness.store.data.progressionLedger, before.progressionLedger);
  assert.deepEqual(harness.store.data.scores, before.scores);
});

test("rejected and duplicated actions are receipt-idempotent and revision-safe", async () => {
  const harness = await createDuelHarness();
  const { duelId, host } = await createStartedInvite(harness);
  const rejected = await successfulAction(harness.service, duelId, host.id, {
    actionId: "reject_10001",
    a: "Earth",
    b: "Air"
  });
  assert.equal(rejected.result, null);
  assert.equal(rejected.event.type, "fusion_rejected");
  assert.equal(rejected.duel.revision, 1);
  const sequenceAfterFirstAttempt = rejected.duel.eventSequence;

  const duplicate = await successfulAction(harness.service, duelId, host.id, {
    actionId: "reject_10001",
    a: "Earth",
    b: "Air"
  });
  assert.equal(duplicate.event.sequence, rejected.event.sequence);
  assert.equal(duplicate.duel.eventSequence, sequenceAfterFirstAttempt);

  await assert.rejects(
    successfulAction(harness.service, duelId, host.id, {
      actionId: "reject_10002",
      a: "Earth",
      b: "Water",
      expectedRevision: 0
    }),
    (error) => {
      assert.equal(error.serviceCode, "duel_revision_conflict");
      assert.equal(error.details.revision, 1);
      assertNoPrivateIdentifiers(error.details, harness);
      return true;
    }
  );
});

test("deadline and reconnect grace settle by lower remaining progress", async () => {
  const progressHarness = await createDuelHarness();
  const progressMatch = await createStartedInvite(progressHarness);
  await successfulAction(progressHarness.service, progressMatch.duelId, progressMatch.host.id, {
    actionId: "action_20001",
    a: "Earth",
    b: "Water"
  });
  const deadline = Date.parse(
    (await progressHarness.service.snapshot(progressMatch.duelId, progressMatch.host.id)).duel.deadlineAt
  );
  progressHarness.setNow(deadline);
  await progressHarness.service.tick();
  const timed = (await progressHarness.service.snapshot(progressMatch.duelId, progressMatch.host.id)).duel;
  assert.equal(timed.status, "finished");
  assert.equal(timed.winnerId, "slot-a");
  assert.equal(timed.finishReason, "time_limit_progress");

  const reconnectHarness = await createDuelHarness();
  const reconnectMatch = await createStartedInvite(reconnectHarness);
  reconnectHarness.advance(DUEL_DISCONNECT_AFTER_MS);
  await reconnectHarness.service.tick();
  let snapshot = (await reconnectHarness.service.eventsSince(
    reconnectMatch.duelId,
    reconnectMatch.host.id,
    0
  ));
  assert.equal(snapshot.filter((event) => event.type === "player_disconnected").length, 2);

  reconnectHarness.advance(DUEL_RECONNECT_GRACE_MS - 1_000);
  await reconnectHarness.service.heartbeat(reconnectMatch.duelId, reconnectMatch.host.id);
  reconnectHarness.advance(1_000);
  await reconnectHarness.service.tick();
  const disconnected = (await reconnectHarness.service.snapshot(
    reconnectMatch.duelId,
    reconnectMatch.host.id
  )).duel;
  assert.equal(disconnected.status, "finished");
  assert.equal(disconnected.winnerId, "slot-a");
  assert.equal(disconnected.finishReason, "disconnect_forfeit");
});

test("simultaneous target actions award only one Final Spark", async () => {
  const harness = await createDuelHarness({ target: "Mud" });
  const { duelId, host, rival } = await createStartedInvite(harness);
  const results = await Promise.allSettled([
    successfulAction(harness.service, duelId, host.id, {
      actionId: "finish_10001",
      a: "Earth",
      b: "Water"
    }),
    successfulAction(harness.service, duelId, rival.id, {
      actionId: "finish_10002",
      a: "Earth",
      b: "Water"
    })
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const final = (await harness.service.snapshot(duelId, host.id)).duel;
  assert.equal(final.status, "finished");
  assert.ok(["slot-a", "slot-b"].includes(final.winnerId));
  assert.equal(final.events.filter((event) => event.type === "match_finished").length, 1);
});
