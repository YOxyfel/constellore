import test from "node:test";
import assert from "node:assert/strict";

import {
  RIDDLE_SAGA_CHAPTER_COUNT,
  RIDDLE_SAGA_CHAPTER_DURATION_SECONDS,
  RIDDLE_SAGA_CHAPTER_POINTS,
  RIDDLE_SAGA_FINALE_DURATION_SECONDS,
  RIDDLE_SAGA_INTERMISSION_SECONDS,
  riddleSagaArcCatalog,
  riddleSagaChapterDurationMs,
  riddleSagaScoreWinner,
  selectRiddleSagaArc
} from "../riddle-saga.mjs";

test("Riddle Saga ships coherent five-riddle arcs with a two-point finale", () => {
  const catalog = riddleSagaArcCatalog();
  assert.ok(catalog.length >= 3);
  assert.equal(RIDDLE_SAGA_CHAPTER_COUNT, 5);
  assert.deepEqual(RIDDLE_SAGA_CHAPTER_POINTS, [1, 1, 1, 1, 2]);
  assert.ok(Object.isFrozen(RIDDLE_SAGA_CHAPTER_POINTS));
  assert.equal(RIDDLE_SAGA_CHAPTER_DURATION_SECONDS, 45);
  assert.equal(RIDDLE_SAGA_FINALE_DURATION_SECONDS, 60);
  assert.equal(RIDDLE_SAGA_INTERMISSION_SECONDS, 3);

  for (const arc of catalog) {
    assert.ok(arc.id);
    assert.ok(arc.title);
    assert.equal(arc.chapters.length, 5);
    assert.equal(new Set(arc.chapters.map((chapter) => chapter.target)).size, 5);
    for (const chapter of arc.chapters) {
      assert.ok(chapter.title.length >= 5);
      assert.ok(chapter.story.length >= 24);
      assert.ok(chapter.target);
    }
  }
});

test("arc selection is deterministic, numbered, weighted, and returns defensive copies", () => {
  const first = selectRiddleSagaArc(42);
  const repeated = selectRiddleSagaArc(42);
  assert.deepEqual(first, repeated);
  assert.deepEqual(
    first.chapters.map(({ index, number, chapterPoints }) => ({
      index,
      number,
      chapterPoints
    })),
    [
      { index: 0, number: 1, chapterPoints: 1 },
      { index: 1, number: 2, chapterPoints: 1 },
      { index: 2, number: 3, chapterPoints: 1 },
      { index: 3, number: 4, chapterPoints: 1 },
      { index: 4, number: 5, chapterPoints: 2 }
    ]
  );

  first.chapters[0].target = "Tampered";
  assert.notEqual(selectRiddleSagaArc(42).chapters[0].target, "Tampered");
  assert.equal(riddleSagaChapterDurationMs(0), 45_000);
  assert.equal(riddleSagaChapterDurationMs(3), 45_000);
  assert.equal(riddleSagaChapterDurationMs(4), 60_000);
});

test("weighted score ties are true draws with no hidden tie-break", () => {
  const participants = [
    { playerId: "player-a", slot: "slot-a" },
    { playerId: "player-b", slot: "slot-b" }
  ];
  assert.deepEqual(
    riddleSagaScoreWinner({ "slot-a": 3, "slot-b": 3 }, participants),
    {
      winnerPlayerId: "",
      winnerSlot: "",
      draw: true,
      entries: [
        { playerId: "player-a", slot: "slot-a", score: 3 },
        { playerId: "player-b", slot: "slot-b", score: 3 }
      ]
    }
  );
  assert.equal(
    riddleSagaScoreWinner({ "slot-a": 2, "slot-b": 4 }, participants).winnerSlot,
    "slot-b"
  );
});
