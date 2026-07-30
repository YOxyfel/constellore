import assert from "node:assert/strict";
import test from "node:test";

import {
  projectScrambleHostMatch,
  scrambleGameSeed,
  scrambleHostEpoch,
  scrambleObjectivePresentation
} from "../public/scramble-app-bridge.mjs";

function sagaMatch(overrides = {}) {
  return {
    id: "saga-match-1",
    format: "riddle-saga",
    rulesVersion: "scramble-riddle-saga-v1",
    status: "active",
    ranked: true,
    selfId: "slot-a",
    objective: "Solve the story's current riddle before your rival.",
    durationSeconds: 240,
    starters: [
      { word: "Earth", emoji: "\u{1F30D}", category: "nature", source: "origin" },
      { word: "Water", emoji: "\u{1F4A7}", category: "force", source: "origin" }
    ],
    saga: {
      revision: 3,
      chapterNumber: 2,
      chapterCount: 5,
      status: "playing",
      chapterStartsAt: "2026-07-30T10:01:00.000Z",
      chapterDeadlineAt: "2026-07-30T10:01:45.000Z",
      currentChapter: {
        number: 2,
        title: "First Hearths",
        story: "Give the wanderers a place that can become a home.",
        target: "Village"
      },
      // A future chapter may appear as a redacted progress stub. It must never
      // influence the host objective or board.
      chapters: [
        { number: 1, target: "Forest", status: "settled" },
        { number: 2, target: "Village", status: "playing" },
        { number: 3, target: "SECRET FUTURE ANSWER", status: "locked" }
      ]
    },
    boards: [
      {
        slot: "slot-a",
        attempts: 2,
        moves: 2,
        words: [
          { word: "Earth", emoji: "\u{1F30D}", category: "nature" },
          { word: "Water", emoji: "\u{1F4A7}", category: "force" },
          { word: "Mud", emoji: "\u{1F7E4}", category: "nature" },
          { word: "Brick", emoji: "\u{1F9F1}", category: "structure" }
        ],
        history: [
          { a: "Earth", b: "Water", result: { word: "Mud", emoji: "\u{1F7E4}", category: "nature" } },
          { a: "Mud", b: "Fire", result: { word: "Brick", emoji: "\u{1F9F1}", category: "structure" } }
        ],
        formatState: { discoveries: 2 }
      },
      {
        slot: "slot-b",
        words: [{ word: "Rival Secret", emoji: "\u2605" }],
        history: []
      }
    ],
    events: [
      {
        type: "success",
        actorId: "slot-a",
        chapterNumber: 1,
        a: "Old",
        b: "Chapter",
        result: { word: "Forest", emoji: "\u{1F332}" }
      },
      {
        type: "success",
        actorId: "slot-b",
        a: "Rival",
        b: "Pair",
        result: { word: "Rival Secret", emoji: "\u2605" }
      }
    ],
    ...overrides
  };
}

test("Riddle Saga objective and seed are tied to the authoritative current chapter", () => {
  const match = sagaMatch();
  const objective = scrambleObjectivePresentation(match);
  assert.deepEqual(objective, {
    format: "riddle-saga",
    modeName: "RIDDLE SAGA",
    objectiveVerb: "Solve",
    target: "Village",
    emoji: "\u2727",
    chapterNumber: 2,
    chapterTitle: "First Hearths",
    chapterStory: "Give the wanderers a place that can become a home."
  });
  assert.equal(scrambleGameSeed(match), scrambleGameSeed(structuredClone(match)));
  assert.notEqual(
    scrambleGameSeed(match),
    scrambleGameSeed(sagaMatch({
      saga: {
        ...match.saga,
        revision: 4,
        chapterNumber: 3,
        currentChapter: { number: 3, target: "City" }
      }
    }))
  );
});

test("host projection uses only the current authoritative self board and history", () => {
  const projected = projectScrambleHostMatch(sagaMatch());
  assert.ok(projected);
  assert.equal(projected.game.target, "Village");
  assert.equal(projected.game.scrambleTarget, "Village");
  assert.deepEqual(projected.game.starters, ["Earth", "Water"]);
  assert.deepEqual(projected.board.words.map((item) => item.word), ["Earth", "Water", "Mud", "Brick"]);
  assert.deepEqual(projected.board.history.map((step) => step.word), ["Mud", "Brick"]);
  assert.equal(projected.board.moves, 2);
  assert.equal(projected.board.newDiscoveries, 2);
  assert.doesNotMatch(JSON.stringify(projected), /Forest|Rival Secret|SECRET FUTURE ANSWER/);
});

test("same match chapter epochs are stable within a chapter and change exactly at a new chapter", () => {
  const current = sagaMatch();
  const sameChapter = sagaMatch({
    events: [...current.events, { type: "attempt", actorId: "slot-b", a: "Air", b: "Fire" }]
  });
  const nextChapter = sagaMatch({
    saga: {
      ...current.saga,
      revision: 4,
      chapterNumber: 3,
      currentChapter: {
        number: 3,
        title: "A Thousand Lights",
        story: "Let the settlement grow.",
        target: "City"
      }
    }
  });
  assert.equal(scrambleHostEpoch(current), scrambleHostEpoch(sameChapter));
  assert.notEqual(scrambleHostEpoch(current), scrambleHostEpoch(nextChapter));
});

test("incomplete or intermission-redacted Saga chapters fail closed instead of reusing an old answer", () => {
  const match = sagaMatch({
    target: "UNTRUSTED ROOT TARGET",
    saga: {
      revision: 4,
      chapterNumber: 3,
      chapterCount: 5,
      status: "intermission",
      target: "UNTRUSTED FUTURE TARGET",
      currentChapter: { number: 3, title: "", story: "", target: "" }
    }
  });
  assert.equal(scrambleHostEpoch(match), "");
  assert.equal(projectScrambleHostMatch(match), null);
  assert.equal(projectScrambleHostMatch(sagaMatch({ starters: [] })), null);
  assert.equal(projectScrambleHostMatch(sagaMatch({ boards: [] })), null);
  assert.equal(projectScrambleHostMatch(sagaMatch({ selfId: "" })), null);
});

test("legacy Scramble formats retain their bounded objective contracts", () => {
  assert.deepEqual(
    scrambleObjectivePresentation({ format: "wordstorm", rules: { discoveryQuota: 15 } }),
    {
      format: "wordstorm",
      modeName: "WORDSTORM",
      objectiveVerb: "Find",
      target: "15 discoveries",
      emoji: "\u2604"
    }
  );
  assert.equal(
    projectScrambleHostMatch({
      id: "race-1",
      format: "target-race",
      target: "City",
      selfId: "slot-a",
      starters: ["Earth", "Water"],
      boards: [{ slot: "slot-a", words: ["Earth", "Water"], history: [] }]
    })?.game?.target,
    "City"
  );
});
