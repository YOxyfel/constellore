import test from "node:test";
import assert from "node:assert/strict";

import { DuelService } from "../duel-services.mjs";
import { RunRegistry } from "../game-services.mjs";
import {
  RIDDLE_SAGA_CHAPTER_POINTS,
  RIDDLE_SAGA_INTERMISSION_SECONDS
} from "../riddle-saga.mjs";
import { createDuelHarness } from "./fixtures/duel-harness.mjs";

function targetResolver(a, b, { game }) {
  const key = [a, b].map((word) => String(word).toLowerCase()).sort().join("+");
  if (key !== "earth+water") return null;
  return {
    word: game.target,
    emoji: "\u2726",
    category: "story",
    source: "world"
  };
}

async function startSaga(harness, {
  kind = "invite",
  rated = kind === "public",
  seed = 0
} = {}) {
  const [host, rival] = harness.players;
  const duel = await harness.service.createDuel(kind, [host.id, rival.id], {
    format: "riddle-saga",
    rated,
    seed
  });
  await harness.service.ready(duel.id, host.id, {
    actionId: `saga_ready_a_${String(seed).padStart(2, "0")}`,
    ready: true
  });
  const countdown = await harness.service.ready(duel.id, rival.id, {
    actionId: `saga_ready_b_${String(seed).padStart(2, "0")}`,
    ready: true
  });
  harness.setNow(Date.parse(countdown.duel.startsAt));
  await harness.service.tick();
  return { duelId: duel.id, host, rival };
}

function storedParticipant(harness, duelId, playerId) {
  return harness.store.data.duels[duelId].participants.find((participant) =>
    participant.playerId === playerId
  );
}

function publicBoard(snapshot, slot) {
  return snapshot.boards.find((board) => board.slot === slot);
}

async function solveCurrent(harness, duelId, player, actionId) {
  const participant = storedParticipant(harness, duelId, player.id);
  return harness.service.act(duelId, player.id, {
    actionId,
    expectedRevision: participant.revision,
    a: "Earth",
    b: "Water"
  });
}

async function enterNextChapter(harness, duelId, viewer) {
  harness.advance(RIDDLE_SAGA_INTERMISSION_SECONDS * 1_000);
  await harness.service.tick();
  return (await harness.service.snapshot(duelId, viewer.id)).duel;
}

function assertNoFutureChapterLeak(publicDuel, storedDuel) {
  const serialized = JSON.stringify(publicDuel);
  for (const chapter of storedDuel.saga.chapters.slice(storedDuel.saga.chapterIndex + 1)) {
    assert.equal(serialized.includes(chapter.story), false, "future story leaked");
    assert.equal(serialized.includes(`\"${chapter.target}\"`), false, "future target leaked");
    assert.equal(
      serialized.includes(String(chapter.challengeIdentity?.challengeKey || "never")),
      false,
      "future challenge identity leaked"
    );
  }
  assert.equal(serialized.includes("private-signature"), false);
  assert.equal(serialized.includes("private-challenge-key"), false);
  assert.equal(serialized.includes("solutionRoute"), false);
  assert.equal(serialized.includes("runIds"), false);
}

test("Saga reveals only the active riddle, awards once, and swaps to a fresh bounded board after intermission", async () => {
  const harness = await createDuelHarness({ resolveCombination: targetResolver });
  const { duelId, host } = await startSaga(harness, { seed: 0 });
  const stored = harness.store.data.duels[duelId];
  const firstRunIds = stored.participants.map((participant) => participant.runId);
  let snapshot = (await harness.service.snapshot(duelId, host.id)).duel;

  assert.equal(snapshot.format, "riddle-saga");
  assert.equal(snapshot.durationSeconds, 45);
  assert.equal(Date.parse(snapshot.deadlineAt) - Date.parse(snapshot.startsAt), 45_000);
  assert.equal(snapshot.target, stored.saga.chapters[0].target);
  assert.equal(snapshot.saga.status, "playing");
  assert.equal(snapshot.saga.chapterIndex, 0);
  assert.equal(snapshot.saga.currentChapter.target, snapshot.target);
  assert.equal(snapshot.saga.chapters.length, 1);
  assert.equal(snapshot.saga.settledChapters.length, 0);
  assert.deepEqual(
    snapshot.saga.scores.map(({ slot, score, chaptersWon }) => ({
      slot,
      score,
      chaptersWon
    })),
    [
      { slot: "slot-a", score: 0, chaptersWon: 0 },
      { slot: "slot-b", score: 0, chaptersWon: 0 }
    ]
  );
  assert.equal(harness.runs.runs.size, 2, "only the live chapter owns participant runs");
  assertNoFutureChapterLeak(snapshot, stored);

  const won = await solveCurrent(harness, duelId, host, "saga_win_chapter_01");
  assert.equal(won.duel.status, "active", "a chapter win must not end the five-riddle match");
  assert.equal(won.duel.saga.status, "intermission");
  assert.equal(won.duel.saga.currentChapter, null);
  assert.equal(won.duel.target, "");
  assert.deepEqual(won.duel.starters, []);
  assert.equal(won.duel.saga.settledChapters[0].status, "won");
  assert.equal(won.duel.saga.scores[0].score, 1);
  assert.equal(won.duel.events.filter((event) => event.type === "chapter_won").length, 1);
  assert.ok(Date.parse(won.duel.saga.nextChapterAt) > harness.now());

  const replay = await harness.service.act(duelId, host.id, {
    actionId: "saga_win_chapter_01",
    expectedRevision: 0,
    a: "Earth",
    b: "Water"
  });
  assert.equal(replay.duel.saga.scores[0].score, 1);
  assert.equal(replay.duel.events.filter((event) => event.type === "chapter_won").length, 1);

  harness.advance(RIDDLE_SAGA_INTERMISSION_SECONDS * 1_000 - 1);
  await harness.service.tick();
  snapshot = (await harness.service.snapshot(duelId, host.id)).duel;
  assert.equal(snapshot.saga.status, "intermission");
  assert.equal(harness.runs.runs.size, 2);

  harness.advance(1);
  await Promise.all([
    harness.service.tick(),
    harness.service.snapshot(duelId, host.id),
    harness.service.snapshot(duelId, host.id)
  ]);
  snapshot = (await harness.service.snapshot(duelId, host.id)).duel;
  const nextStored = harness.store.data.duels[duelId];
  const secondRunIds = nextStored.participants.map((participant) => participant.runId);
  assert.equal(snapshot.saga.status, "playing");
  assert.equal(snapshot.saga.chapterIndex, 1);
  assert.equal(snapshot.saga.currentChapter.number, 2);
  assert.equal(snapshot.target, nextStored.saga.chapters[1].target);
  assert.equal(snapshot.durationSeconds, 45);
  assert.equal(Date.parse(snapshot.deadlineAt) - Date.parse(snapshot.saga.chapterStartsAt), 45_000);
  assert.ok(secondRunIds.every((runId) => !firstRunIds.includes(runId)));
  assert.equal(harness.runs.runs.size, 2, "settled chapter runs are discarded after the fresh swap");
  assert.equal(publicBoard(snapshot, "slot-a").history.length, 0);
  assert.equal(publicBoard(snapshot, "slot-b").history.length, 0);
  assert.equal(publicBoard(snapshot, "slot-a").revision, 2);
  assert.equal(publicBoard(snapshot, "slot-b").revision, 1);
  assert.equal(
    snapshot.events.filter((event) => event.type === "chapter_started").length,
    2,
    "concurrent boundary polls must activate the incoming chapter exactly once"
  );
  assertNoFutureChapterLeak(snapshot, nextStored);
});

test("chapter timeout consumes no score, advances once, and survives service reconstruction", async () => {
  const harness = await createDuelHarness({ resolveCombination: targetResolver });
  const { duelId, host } = await startSaga(harness, { seed: 1 });
  let snapshot = (await harness.service.snapshot(duelId, host.id)).duel;
  harness.setNow(Date.parse(snapshot.saga.chapterDeadlineAt));
  await Promise.all([harness.service.tick(), harness.service.tick()]);
  snapshot = (await harness.service.snapshot(duelId, host.id)).duel;

  assert.equal(snapshot.saga.status, "intermission");
  assert.equal(snapshot.saga.settledChapters[0].status, "timeout");
  assert.ok(snapshot.saga.scores.every((entry) => entry.score === 0));
  assert.equal(snapshot.events.filter((event) => event.type === "chapter_timeout").length, 1);
  assert.equal(publicBoard(snapshot, "slot-a").attempts, 0);
  assert.equal(publicBoard(snapshot, "slot-b").attempts, 0);

  const restored = new DuelService(harness.store, new RunRegistry(harness.store), {
    clock: harness.now,
    buildGame: harness.service.buildGame,
    resolveCombination: harness.service.resolveCombination,
    routeProgress: harness.service.routeProgress
  });
  const restoredSnapshot = (await restored.snapshot(duelId, host.id)).duel;
  assert.equal(restoredSnapshot.saga.status, "intermission");
  assert.equal(restoredSnapshot.saga.revision, snapshot.saga.revision);
  assert.equal(restoredSnapshot.saga.nextChapterAt, snapshot.saga.nextChapterAt);

  harness.setNow(Date.parse(restoredSnapshot.saga.nextChapterAt));
  await restored.tick();
  const advanced = (await restored.snapshot(duelId, host.id)).duel;
  assert.equal(advanced.saga.chapterNumber, 2);
  assert.equal(advanced.saga.status, "playing");
  assert.ok(advanced.saga.scores.every((entry) => entry.score === 0));
  assert.equal(advanced.events.filter((event) => event.type === "chapter_started").length, 2);
});

test("a captured chapter epoch rejects the simultaneous stale solve without applying it", async () => {
  const pending = [];
  const harness = await createDuelHarness({
    resolveCombination: (a, b, { game }) => new Promise((resolve) => {
      pending.push({
        target: game.target,
        resolve: () => resolve({
          word: game.target,
          emoji: "\u2726",
          category: "story",
          source: "world"
        })
      });
    })
  });
  const { duelId, host, rival } = await startSaga(harness, { seed: 2 });
  const hostAction = solveCurrent(harness, duelId, host, "saga_epoch_host");
  const rivalAction = solveCurrent(harness, duelId, rival, "saga_epoch_rival");
  while (pending.length < 2) await new Promise((resolve) => setImmediate(resolve));

  pending[0].resolve();
  const winner = await hostAction;
  assert.equal(winner.duel.saga.status, "intermission");
  pending[1].resolve();
  await assert.rejects(rivalAction, (error) => {
    assert.equal(error.serviceCode, "saga_chapter_advanced");
    return true;
  });

  const final = (await harness.service.snapshot(duelId, host.id)).duel;
  assert.equal(final.saga.scores.find((entry) => entry.slot === "slot-a").score, 1);
  assert.equal(final.saga.scores.find((entry) => entry.slot === "slot-b").score, 0);
  assert.equal(final.events.filter((event) => event.type === "chapter_won").length, 1);
  assert.equal(publicBoard(final, "slot-a").moves, 1);
  assert.equal(publicBoard(final, "slot-b").moves, 0);
  assert.equal(publicBoard(final, "slot-b").attempts, 0);
});

test("an uncatchable leader still plays the two-point finale and Saga rating stays mode-specific", async () => {
  const harness = await createDuelHarness({ resolveCombination: targetResolver });
  const { duelId, host, rival } = await startSaga(harness, {
    kind: "public",
    rated: true,
    seed: 0
  });

  for (let chapter = 0; chapter < 4; chapter += 1) {
    const response = await solveCurrent(
      harness,
      duelId,
      host,
      `saga_story_host_${String(chapter).padStart(2, "0")}`
    );
    assert.equal(response.duel.status, "active");
    assert.equal(
      response.duel.saga.scores.find((entry) => entry.slot === "slot-a").score,
      chapter + 1
    );
    await enterNextChapter(harness, duelId, host);
  }

  let finale = (await harness.service.snapshot(duelId, host.id)).duel;
  assert.equal(finale.status, "active", "the finale plays even after the outcome is mathematically decided");
  assert.equal(finale.saga.chapterNumber, 5);
  assert.equal(finale.saga.finale, true);
  assert.equal(finale.saga.chapterPoints, 2);
  assert.equal(finale.durationSeconds, 60);
  assert.equal(Date.parse(finale.saga.chapterDeadlineAt) - Date.parse(finale.saga.chapterStartsAt), 60_000);

  const finished = await solveCurrent(harness, duelId, rival, "saga_story_finale");
  finale = finished.duel;
  assert.equal(finale.status, "finished");
  assert.equal(finale.finishReason, "saga_points");
  assert.equal(finale.winnerId, "slot-a");
  assert.equal(finale.saga.status, "complete");
  assert.deepEqual(
    finale.saga.scores.map(({ slot, score, chaptersWon }) => ({
      slot,
      score,
      chaptersWon
    })),
    [
      { slot: "slot-a", score: 4, chaptersWon: 4 },
      { slot: "slot-b", score: 2, chaptersWon: 1 }
    ]
  );
  assert.deepEqual(RIDDLE_SAGA_CHAPTER_POINTS, [1, 1, 1, 1, 2]);
  assert.equal(finale.events.filter((event) => event.type === "chapter_started").length, 5);
  assert.equal(finale.events.filter((event) => event.type === "chapter_won").length, 5);
  assert.equal(finale.events.filter((event) => event.type === "match_finished").length, 1);
  assert.equal(harness.service.arena(host.id).ratings["riddle-saga"].rating, 1_020);
  assert.equal(harness.service.arena(rival.id).ratings["riddle-saga"].rating, 980);
  assert.equal(harness.service.arena(host.id).ratings["target-race"].games, 0);
  assert.equal(harness.service.arena(host.id).ratings.wordstorm.games, 0);
  assert.equal(harness.service.arena(host.id).ratings["forge-clash"].games, 0);

  await harness.service.requestRematch(duelId, host.id, {
    actionId: "saga_rematch_host"
  });
  const rematch = await harness.service.requestRematch(duelId, rival.id, {
    actionId: "saga_rematch_rival"
  });
  assert.equal(rematch.duel.format, "riddle-saga");
  assert.equal(rematch.duel.rated, false);
  assert.equal(rematch.duel.saga.chapterNumber, 1);
  assert.equal(rematch.duel.saga.scores.every((entry) => entry.score === 0), true);
  assert.equal(harness.runs.runs.size, 4, "finished finale plus rematch keep only their current run pairs");
});

test("equal weighted scores finish as a draw rather than using chapter count or speed", async () => {
  const harness = await createDuelHarness({ resolveCombination: targetResolver });
  const { duelId, host, rival } = await startSaga(harness, { seed: 1 });
  const winners = [host, host, host, rival, rival];
  for (let chapter = 0; chapter < winners.length; chapter += 1) {
    const response = await solveCurrent(
      harness,
      duelId,
      winners[chapter],
      `saga_draw_${String(chapter).padStart(4, "0")}`
    );
    if (chapter < winners.length - 1) await enterNextChapter(harness, duelId, host);
    else {
      assert.equal(response.duel.status, "finished");
      assert.equal(response.duel.winnerId, "");
      assert.equal(response.duel.finishReason, "saga_points_draw");
      assert.deepEqual(response.duel.saga.scores.map((entry) => entry.score), [3, 3]);
      assert.equal(response.duel.formatResult.draw, true);
    }
  }
});

test("finished Saga retention and pruning clean up the complete live run set", async () => {
  const harness = await createDuelHarness({ resolveCombination: targetResolver });
  const [host, rival] = harness.players;
  const duel = await harness.service.createDuel("invite", [host.id, rival.id], {
    format: "riddle-saga",
    seed: 0
  });
  const runIds = duel.participants.map((participant) => participant.runId);
  await harness.service.finishDuel(duel, host.id, "test_cleanup");
  for (const runId of runIds) {
    const run = harness.runs.runs.get(runId);
    assert.ok(run);
    assert.ok(run.expiresAt >= duel.settledAt + 24 * 60 * 60_000 + 60_000);
  }

  harness.advance(24 * 60 * 60_000 + 1);
  await harness.service.tick();
  assert.equal(harness.store.data.duels[duel.id], undefined);
  for (const runId of runIds) assert.equal(harness.runs.runs.has(runId), false);
});
