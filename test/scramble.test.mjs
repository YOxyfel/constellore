import assert from "node:assert/strict";
import test from "node:test";

import {
  SCRAMBLE_COUNTDOWN_SECONDS,
  SCRAMBLE_MATCH_SECONDS,
  buildScrambleInviteUrl,
  clearScrambleInviteFromUrl,
  createScrambleState,
  formatScrambleClock,
  parseScrambleInvite,
  reduceScrambleSnapshot,
  scrambleClockSeconds,
  scrambleEventSentence,
  scrambleFinishReasonText,
  scrambleResultPresentation,
  scrambleShareText,
  sanitizeScrambleBoard,
  sanitizeScrambleEvent,
  sanitizeScrambleFormatResult,
  sanitizeScrambleFormatState,
  sanitizeScrambleFrameSlug,
  sanitizeScramblePlayer,
  sanitizeScrambleRules,
  sanitizeScrambleSaga,
  sanitizeScrambleToken
} from "../public/scramble.mjs";

test("Arena frame slugs stay allowlisted on normalized player cards", () => {
  assert.equal(sanitizeScrambleFrameSlug("berry-burrow"), "berry-burrow");
  assert.equal(sanitizeScrambleFrameSlug("not-in-the-catalog"), "");
  assert.equal(sanitizeScramblePlayer({
    slot: "slot-a",
    frameSlug: "ember-sovereign"
  }).frameSlug, "ember-sovereign");
  assert.equal(sanitizeScramblePlayer({
    slot: "slot-b",
    frameSlug: "<script>"
  }).frameSlug, "");
});

test("Scramble uses a three-second countdown and five-minute match clock", () => {
  assert.equal(SCRAMBLE_COUNTDOWN_SECONDS, 3);
  assert.equal(SCRAMBLE_MATCH_SECONDS, 300);
  assert.equal(createScrambleState().durationSeconds, 300);
  assert.equal(formatScrambleClock(300), "05:00");
  assert.equal(formatScrambleClock(8), "00:08");
});

test("invite capabilities prefer the fragment and reject malformed values", () => {
  const invite = parseScrambleInvite("https://example.com/play/?duel=query-token-123#scramble=fragment-token-456");
  assert.deepEqual(invite, { token: "fragment-token-456", source: "fragment" });
  assert.equal(parseScrambleInvite("https://example.com/play/#scramble=%3Cscript%3E"), null);
  assert.equal(sanitizeScrambleToken("tiny"), "");
  assert.equal(buildScrambleInviteUrl("<unsafe>", "https://example.com/play/"), "");
  assert.equal(
    buildScrambleInviteUrl("safe-token-123", "https://example.com/play/?duel=old#section"),
    "https://example.com/play/#scramble=safe-token-123"
  );
  assert.equal(
    clearScrambleInviteFromUrl("https://example.com/play/?duel=old-token-123#scramble=new-token-456"),
    "https://example.com/play/"
  );
});

test("events are sanitized and common server names normalize to visible attempts", () => {
  assert.deepEqual(
    sanitizeScrambleEvent({
      id: "evt-1",
      type: "fusion_attempted",
      sequence: 1,
      player: { slot: "slot-b", callsign: "NOVA" },
      a: "Earth",
      b: "Water"
    }),
    {
      id: "evt-1",
      sequence: 1,
      revision: 1,
      type: "attempt",
      actorId: "slot-b",
      callsign: "NOVA",
      a: "Earth",
      b: "Water",
      result: null,
      reason: "",
      createdAt: "",
      winnerId: "",
      ratingDelta: 0,
      ready: false,
      nextDuelId: ""
    }
  );
  assert.match(scrambleEventSentence({
    type: "pair_rejected",
    sequence: 2,
    actorSlot: "slot-b",
    callsign: "NOVA",
    a: "Fire",
    b: "Water"
  }), /NOVA tried Fire \+ Water[.] No match[.]/);
});

test("snapshot reduction deduplicates events, ignores stale snapshots, and counts outcomes", () => {
  const initial = reduceScrambleSnapshot(createScrambleState(), {
    revision: 4,
    match: {
      id: "match-12345678",
      status: "playing",
      ranked: true,
      target: "Telescope",
      selfSlot: "slot-a",
      startsAt: "2026-07-29T12:00:00.000Z",
      deadlineAt: "2026-07-29T12:05:00.000Z",
      players: [
        { slot: "slot-a", callsign: "YOU" },
        { slot: "slot-b", callsign: "NOVA" }
      ],
      starters: ["Earth", "Water", "Fire", "Air"]
    },
    events: [
      { id: "1", sequence: 1, type: "fusion_attempted", actorSlot: "slot-b", a: "Earth", b: "Water" },
      { id: "2", sequence: 2, type: "fusion_succeeded", actorSlot: "slot-b", a: "Earth", b: "Water", result: { word: "Mud" } },
      { id: "3", sequence: 3, type: "fusion_rejected", actorSlot: "slot-a", a: "Fire", b: "Mud" }
    ]
  });
  assert.equal(initial.events.length, 3);
  assert.deepEqual(initial.metrics["slot-b"], {
    attempts: 1,
    successes: 1,
    failures: 0,
    firstLights: 0,
    echoSteals: 0,
    intercepts: 0
  });
  assert.equal(initial.metrics["slot-a"].failures, 1);
  const updated = reduceScrambleSnapshot(initial, {
    revision: 5,
    events: [
      { id: "3", sequence: 3, type: "fusion_rejected", actorSlot: "slot-a", a: "Fire", b: "Mud" },
      { id: "4", sequence: 4, type: "echo_steal", actorSlot: "slot-a" }
    ]
  });
  assert.equal(updated.events.length, 4);
  assert.equal(updated.metrics["slot-a"].echoSteals, 1);
  assert.equal(reduceScrambleSnapshot(updated, { revision: 2, status: "waiting" }), updated);
  const finished = reduceScrambleSnapshot(updated, {
    revision: 6,
    events: [{ id: "5", sequence: 5, revision: 6, type: "match_finished", winnerSlot: "slot-a" }]
  });
  assert.equal(finished.status, "finished");
  assert.equal(finished.winnerId, "slot-a");
});

test("canonical duel envelopes and control events preserve the SSE cursor and rematch destination", () => {
  const wrapped = reduceScrambleSnapshot(createScrambleState(), {
    duel: {
      id: "duel-12345678",
      status: "waiting",
      revision: 0,
      eventSequence: 2,
      selfSlot: "slot-a",
      players: [
        { slot: "slot-a", callsign: "YOU", ready: true },
        { slot: "slot-b", callsign: "NOVA", ready: false }
      ],
      events: [
        { sequence: 1, type: "player_joined", actorSlot: "slot-b" },
        { sequence: 2, type: "ready", actorSlot: "slot-a", ready: true }
      ]
    }
  });
  assert.equal(wrapped.id, "duel-12345678");
  assert.equal(wrapped.selfId, "slot-a");
  assert.equal(wrapped.events.length, 2);
  assert.equal(wrapped.lastSequence, 2);
  assert.equal(wrapped.players[0].ready, true);

  const rematch = reduceScrambleSnapshot(wrapped, {
    events: [{
      sequence: 3,
      type: "rematch_ready",
      nextDuelId: "duel-next-12345678",
      serverAt: "2026-07-29T12:06:00.000Z"
    }]
  });
  assert.equal(rematch.lastSequence, 3);
  assert.equal(rematch.events.at(-1).type, "rematch_ready");
  assert.equal(rematch.events.at(-1).createdAt, "2026-07-29T12:06:00.000Z");
  assert.equal(rematch.nextDuelId, "duel-next-12345678");

  const actionEnvelope = reduceScrambleSnapshot(createScrambleState(), {
    duel: {
      id: "duel-action-12345678",
      revision: 1,
      events: [
        { sequence: 1, type: "fusion_attempted", actorSlot: "slot-a", a: "Earth", b: "Water" },
        { sequence: 2, type: "fusion_succeeded", actorSlot: "slot-a", a: "Earth", b: "Water", result: { word: "Mud" } }
      ]
    },
    event: {
      sequence: 2,
      type: "fusion_succeeded",
      actorSlot: "slot-a",
      a: "Earth",
      b: "Water",
      result: { word: "Mud" }
    }
  });
  assert.deepEqual(actionEnvelope.events.map((event) => event.type), ["attempt", "success"]);
  assert.equal(actionEnvelope.metrics["slot-a"].attempts, 1);
  assert.equal(sanitizeScrambleEvent({
    sequence: 12,
    revision: 0,
    type: "fusion_attempted",
    actorSlot: "slot-a"
  }).revision, 0, "event sequence must never inflate the participant board revision");
});

test("server deadlines control the display clock", () => {
  const state = reduceScrambleSnapshot(createScrambleState(), {
    revision: 1,
    match: {
      deadlineAt: "2026-07-29T12:05:00.000Z",
      startsAt: "2026-07-29T12:00:00.000Z"
    }
  });
  assert.equal(scrambleClockSeconds(state, Date.parse("2026-07-29T12:01:01.000Z")), 239);
});

test("result presentation keeps Duel Rating separate from private matches", () => {
  const ranked = reduceScrambleSnapshot(createScrambleState(), {
    revision: 9,
    match: {
      status: "finished",
      ranked: true,
      selfSlot: "slot-a",
      winnerSlot: "slot-a",
      rating: { delta: 18 },
      players: [
        { slot: "slot-a", callsign: "YOU" },
        { slot: "slot-b", callsign: "NOVA" }
      ]
    }
  });
  assert.equal(scrambleResultPresentation(ranked).title, "You reached it first");
  assert.equal(scrambleResultPresentation(ranked).ratingLabel, "1v1 Rating +18");
  const privateMatch = { ...ranked, ranked: false };
  assert.equal(scrambleResultPresentation(privateMatch).ratingLabel, "Private match \u00b7 no rating");
  for (const finishReason of ["forfeit", "player_forfeit", "disconnect_forfeit"]) {
    assert.equal(scrambleResultPresentation({ ...privateMatch, finishReason }).title, "You won by forfeit");
    assert.equal(scrambleResultPresentation({ ...privateMatch, winnerId: "slot-b", finishReason }).title, "NOVA won by forfeit");
  }
});

test("legacy snapshots default to Target Race while every mode carries bounded rules and objective copy", () => {
  const legacy = createScrambleState();
  assert.equal(legacy.format, "target-race");
  assert.equal(legacy.formatVersion, 1);
  assert.equal(legacy.rulesVersion, 1);
  assert.equal(legacy.rules.durationSeconds, 300);
  assert.match(legacy.objective, /shared target/i);

  const wordstorm = createScrambleState({
    format: "word_storm",
    formatVersion: 3,
    rulesVersion: "scramble-wordstorm-v3",
    objective: { label: "Make discoveries fast.\u0000" },
    rules: {
      durationSeconds: 2_000,
      discoveryQuota: 50_000,
      scoring: { discovery: 5, firstLight: 2, injected: 99 },
      counterCycle: Array.from({ length: 20 }, (_, index) => `type-${index}`),
      injected: "<script>"
    }
  });
  assert.equal(wordstorm.format, "wordstorm");
  assert.equal(wordstorm.durationSeconds, 2_000);
  assert.equal(wordstorm.rules.discoveryQuota, 999);
  assert.deepEqual(wordstorm.rules.scoring, { discovery: 5, firstLight: 2 });
  assert.equal(wordstorm.rules.counterCycle.length, 12);
  assert.equal("injected" in wordstorm.rules, false);
  assert.equal(wordstorm.objective, "Make discoveries fast.");
  assert.equal(wordstorm.rulesVersion, "scramble-wordstorm-v3");

  assert.equal(createScrambleState({ format: "unknown-mode" }).format, "target-race");
  assert.deepEqual(
    sanitizeScrambleRules(null, "forge-clash"),
    { durationSeconds: 150, turnLimit: 6 }
  );
});

test("multi-mode snapshots retain authoritative boards and per-player format progress", () => {
  const state = reduceScrambleSnapshot(createScrambleState(), {
    revision: 12,
    duel: {
      id: "wordstorm-12345678",
      format: "wordstorm",
      formatVersion: 1,
      rulesVersion: 1,
      objective: "Reach 12 discoveries first.",
      rules: { durationSeconds: 120, discoveryQuota: 12 },
      status: "active",
      selfSlot: "slot-a",
      players: [
        {
          slot: "slot-a",
          callsign: "YOU",
          formatState: {
            score: 8,
            quota: 12,
            discoveries: 8,
            attempts: 9,
            remaining: 4,
            rank: 1
          }
        },
        {
          slot: "slot-b",
          callsign: "NOVA",
          formatState: { score: 6, quota: 12, discoveries: 6, remaining: 6, rank: 2 }
        }
      ],
      boards: [
        {
          slot: "slot-a",
          revision: 9,
          words: [{ word: "Mud", emoji: "\ud83e\uddf1" }],
          history: [{ move: 1, a: "Earth", b: "Water", result: { word: "Mud" } }],
          progress: { remaining: 4, total: 12, injected: true },
          moves: 8,
          attempts: 9,
          formatState: { score: 8, quota: 12, discoveries: 8, remaining: 4 }
        },
        {
          slot: "slot-b",
          revision: 7,
          words: [{ word: "Steam" }],
          formatState: { score: 6, quota: 12, discoveries: 6, remaining: 6 }
        }
      ]
    }
  });
  assert.equal(state.format, "wordstorm");
  assert.equal(state.rules.discoveryQuota, 12);
  assert.equal(state.players[0].formatState.score, 8);
  assert.equal(state.players[0].formatState.remaining, 4);
  assert.equal(state.boards[0].revision, 9);
  assert.equal(state.boards[0].words[0].word, "Mud");
  assert.equal(state.boards[0].history[0].result.word, "Mud");
  assert.deepEqual(state.boards[0].progress, { remaining: 4, total: 12 });

  const eventOnly = reduceScrambleSnapshot(state, {
    revision: 13,
    event: {
      sequence: 1,
      revision: 10,
      type: "fusion_succeeded",
      actorSlot: "slot-a",
      a: "Mud",
      b: "Fire",
      result: { word: "Brick" }
    }
  });
  assert.equal(eventOnly.format, "wordstorm", "event envelopes cannot reset a selected format");
  assert.equal(eventOnly.players[0].formatState.score, 8, "bounded events do not replace authoritative score state");
  assert.equal(eventOnly.boards[0].revision, 9);
});

test("board and format-state sanitizers bound hostile multiplayer payloads", () => {
  const board = sanitizeScrambleBoard({
    slot: "slot-a",
    revision: Number.MAX_SAFE_INTEGER,
    words: Array.from({ length: 600 }, (_, index) => ({ word: `Word ${index}` })),
    history: Array.from({ length: 300 }, (_, index) => ({
      move: index + 1,
      a: "Earth",
      b: "Water",
      result: { word: `Result ${index}` }
    })),
    formatState: {
      score: Infinity,
      quota: 50_000,
      turnsLeft: -20,
      champion: {
        word: "A".repeat(100),
        emoji: "\u2726".repeat(20),
        archetype: "force",
        power: 2_000,
        depth: 2_000
      }
    }
  }, "forge-clash");
  assert.equal(board.revision, 1_000_000_000);
  assert.equal(board.words.length, 512);
  assert.equal(board.history.length, 256);
  assert.equal(board.formatState.score, 0);
  assert.equal(board.formatState.quota, 999);
  assert.equal(board.formatState.turnsLeft, 0);
  assert.equal(board.formatState.champion.word.length, 48);
  assert.equal(board.formatState.champion.power, 999);
  assert.equal(board.formatState.format, "forge-clash");

  const formatState = sanitizeScrambleFormatState({
    points: 14,
    remainingTurns: 2,
    buildDepth: 4,
    completed: true,
    outcome: "won\u0000"
  }, "forge-clash");
  assert.equal(formatState.score, 14);
  assert.equal(formatState.turnsLeft, 2);
  assert.equal(formatState.depth, 4);
  assert.equal(formatState.complete, true);
  assert.equal(formatState.outcome, "won");
});

test("events preserve bounded server classification, counters, board revision, and actor mode state", () => {
  const event = sanitizeScrambleEvent({
    id: "event-mode-1",
    sequence: 44,
    revision: 8,
    type: "fusion_succeeded",
    actorSlot: "slot-b",
    callsign: "NOVA",
    a: "Earth",
    b: "Water",
    result: { word: "Mud" },
    classification: "FIRST_LIGHT".repeat(10),
    move: -5,
    attempt: 999_999,
    boardRevision: 99_999_999_999,
    actorFormatState: { score: 9, quota: 12, discoveries: 9, remaining: 3 }
  });
  assert.equal(event.classification.length, 40);
  assert.equal(event.move, 0);
  assert.equal(event.attempt, 10_000);
  assert.equal(event.boardRevision, 1_000_000_000);
  assert.equal(event.actorFormatState.score, 9);
  assert.equal(event.actorFormatState.remaining, 3);
  assert.match(
    scrambleEventSentence(event, { selfId: "slot-a", format: "wordstorm" }),
    /Score: 9/
  );
});

test("Riddle Saga keeps only authoritative current and settled chapters and never reveals future targets", () => {
  const saga = sanitizeScrambleSaga({
    version: 1,
    revision: 8,
    arcId: "roots-to-stars",
    arcTitle: "Roots to Stars",
    status: "playing",
    chapterCount: 5,
    chapterIndex: 1,
    chapterNumber: 2,
    chapterPoints: 1,
    chapterStartsAt: "2026-07-30T12:00:00.000Z",
    chapterDeadlineAt: "2026-07-30T12:00:45.000Z",
    currentChapter: {
      number: 2,
      title: "First Hearths",
      story: "Give the wanderers a home.",
      target: "Village",
      chapterPoints: 1,
      status: "playing"
    },
    settledChapters: [{
      number: 1,
      title: "The Sleeping Green",
      story: "Wake the canopy.",
      target: "Forest",
      chapterPoints: 1,
      status: "won",
      winnerSlot: "slot-a"
    }],
    chapters: [{
      number: 5,
      title: "LEAKED FINALE",
      target: "Cosmos",
      status: "playing"
    }],
    scores: [
      { id: "slot-a", slot: "slot-a", points: 1, score: 1, chaptersWon: 1 },
      { id: "slot-b", slot: "slot-b", points: 0, score: 0, chaptersWon: 0 }
    ]
  });
  assert.equal(saga.currentChapter.target, "Village");
  assert.deepEqual(saga.settledChapters.map((chapter) => chapter.target), ["Forest"]);
  assert.deepEqual(saga.chapters.map((chapter) => chapter.number), [1, 2]);
  assert.doesNotMatch(JSON.stringify(saga), /LEAKED FINALE|Cosmos/);
  assert.deepEqual(saga.scores[0], {
    id: "slot-a",
    slot: "slot-a",
    points: 1,
    score: 1,
    chaptersWon: 1
  });
  const intermission = sanitizeScrambleSaga({
    ...saga,
    revision: 9,
    status: "intermission",
    currentChapter: null,
    settledChapters: [
      ...saga.settledChapters,
      { ...saga.currentChapter, status: "timeout", winnerSlot: "" }
    ],
    nextChapterAt: "2026-07-30T12:00:48.000Z"
  }, saga);
  assert.equal(intermission.currentChapter, null);
  assert.equal(intermission.status, "intermission");
  assert.deepEqual(intermission.chapters.map((chapter) => chapter.number), [1, 2]);
});

test("Riddle Saga events never manufacture scores and timeout chapters remain scoreless", () => {
  const playing = reduceScrambleSnapshot(createScrambleState(), {
    revision: 4,
    duel: {
      id: "saga-12345678",
      format: "riddle-saga",
      status: "active",
      selfSlot: "slot-a",
      players: [{ slot: "slot-a" }, { slot: "slot-b" }],
      saga: {
        revision: 1,
        status: "playing",
        chapterCount: 5,
        chapterNumber: 1,
        currentChapter: { number: 1, target: "Forest", chapterPoints: 1, status: "playing" },
        settledChapters: [],
        scores: [
          { slot: "slot-a", score: 0, points: 0, chaptersWon: 0 },
          { slot: "slot-b", score: 0, points: 0, chaptersWon: 0 }
        ]
      }
    }
  });
  const eventOnly = reduceScrambleSnapshot(playing, {
    revision: 5,
    event: {
      sequence: 1,
      type: "chapter_won",
      actorSlot: "slot-a",
      chapterNumber: 1,
      chapterPoints: 99
    }
  });
  assert.equal(eventOnly.saga.scores[0].score, 0);
  assert.equal(eventOnly.saga.settledChapters.length, 0);
  const timeout = sanitizeScrambleEvent({
    sequence: 2,
    type: "chapter_timed_out",
    chapterNumber: 2,
    chapterPoints: 1
  });
  assert.equal(timeout.type, "chapter_timeout");
  assert.equal(scrambleEventSentence(timeout), "Chapter 2 ended without an answer.");
});

test("Riddle Saga result and share copy use the final authoritative ledger", () => {
  const state = reduceScrambleSnapshot(createScrambleState(), {
    revision: 20,
    duel: {
      id: "saga-finished-12345678",
      format: "riddle-saga",
      status: "finished",
      selfSlot: "slot-a",
      winnerId: "slot-a",
      finishReason: "saga_complete",
      players: [{ slot: "slot-a", callsign: "YOU" }, { slot: "slot-b", callsign: "NOVA" }],
      saga: {
        revision: 10,
        status: "complete",
        chapterCount: 5,
        chapterNumber: 5,
        finale: true,
        currentChapter: { number: 5, target: "Cosmos", chapterPoints: 2, status: "won", winnerSlot: "slot-a" },
        settledChapters: [
          { number: 1, target: "Forest", chapterPoints: 1, status: "won", winnerSlot: "slot-b" },
          { number: 2, target: "Village", chapterPoints: 1, status: "won", winnerSlot: "slot-a" },
          { number: 3, target: "City", chapterPoints: 1, status: "timeout" },
          { number: 4, target: "Rocket", chapterPoints: 1, status: "won", winnerSlot: "slot-b" },
          { number: 5, target: "Cosmos", chapterPoints: 2, status: "won", winnerSlot: "slot-a" }
        ],
        scores: [
          { slot: "slot-a", points: 3, score: 3, chaptersWon: 2 },
          { slot: "slot-b", points: 2, score: 2, chaptersWon: 2 }
        ]
      }
    }
  });
  const result = scrambleResultPresentation(state);
  assert.equal(result.title, "You wrote the winning ending");
  assert.equal(result.saga.scores[0].score, 3);
  assert.match(scrambleShareText(state), /Riddle score: 3\u20132/);
  assert.match(scrambleShareText(state), /finale was worth two/i);
});

test("Wordstorm results and share copy use score state and player-facing finish reasons", () => {
  const state = reduceScrambleSnapshot(createScrambleState(), {
    revision: 20,
    duel: {
      format: "wordstorm",
      status: "finished",
      ranked: true,
      selfSlot: "slot-a",
      winnerId: "slot-a",
      finishReason: "time_limit_accuracy",
      rating: { delta: 22 },
      players: [
        { slot: "slot-a", callsign: "YOU", formatState: { score: 11, quota: 12 } },
        { slot: "slot-b", callsign: "NOVA", formatState: { score: 11, quota: 12 } }
      ],
      formatResult: {
        format: "wordstorm",
        standings: [
          { slot: "slot-a", score: 11, quota: 12, rejectedAttempts: 1 },
          { slot: "slot-b", score: 11, quota: 12, rejectedAttempts: 3 }
        ]
      }
    }
  });
  const result = scrambleResultPresentation(state);
  assert.equal(result.format, "wordstorm");
  assert.equal(result.modeLabel, "Wordstorm");
  assert.equal(result.title, "You won the Wordstorm");
  assert.equal(result.ratingLabel, "Wordstorm Rating +22");
  assert.equal(result.finishReasonLabel, "Time expired; accuracy broke the tied score.");
  assert.equal(result.formatResult.standings[0].rejectedAttempts, 1);
  assert.match(scrambleShareText(state, "https://example.com/play"), /Score: 11\u201311/);
  assert.match(scrambleShareText(state, "https://example.com/play"), /Wordstorm/);
  assert.doesNotMatch(scrambleShareText(state), /time_limit_accuracy/);
});

test("Forge Clash presentation exposes sanitized champions and translates battle reason codes", () => {
  const state = reduceScrambleSnapshot(createScrambleState(), {
    revision: 21,
    duel: {
      format: "forge-clash",
      status: "finished",
      ranked: false,
      selfSlot: "slot-a",
      winnerId: "slot-b",
      finishReason: "turn_limit_category_counter",
      players: [
        {
          slot: "slot-a",
          callsign: "YOU",
          formatState: {
            turnsLeft: 0,
            turnLimit: 6,
            champion: { word: "Storm", category: "force", power: 4 }
          }
        },
        {
          slot: "slot-b",
          callsign: "NOVA",
          formatState: {
            turnsLeft: 0,
            turnLimit: 6,
            champion: { word: "Castle", category: "structure", power: 3 }
          }
        }
      ],
      formatResult: {
        format: "forge-clash",
        battle: {
          winnerSlot: "slot-b",
          reason: "category_counter",
          left: { word: "Storm", category: "force", power: 4 },
          right: { word: "Castle", category: "structure", power: 3 }
        }
      }
    }
  });
  const result = scrambleResultPresentation(state);
  assert.equal(result.title, "NOVA forged the winner");
  assert.equal(result.selfFormatState.champion.word, "Storm");
  assert.equal(result.formatResult.battle.winnerSlot, "slot-b");
  assert.equal(result.finishReasonLabel, "The category counter decided the clash.");
  assert.match(scrambleShareText(state), /My champion was Storm/);
  assert.equal(
    scrambleFinishReasonText("turn_limit_equal_force", { format: "forge-clash", tied: true }),
    "The champions met with equal force."
  );
});

test("hostile records, accessors, and unknown finish codes fail closed without leaking raw codes", () => {
  const accessor = {};
  Object.defineProperty(accessor, "format", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    }
  });
  Object.defineProperty(accessor, "rules", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    }
  });
  assert.doesNotThrow(() => createScrambleState(accessor));
  assert.equal(createScrambleState(accessor).format, "target-race");

  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  assert.doesNotThrow(() => reduceScrambleSnapshot(createScrambleState({ format: "wordstorm" }), revoked.proxy));
  assert.equal(
    reduceScrambleSnapshot(createScrambleState({ format: "wordstorm" }), revoked.proxy).format,
    "wordstorm"
  );

  const unknown = scrambleFinishReasonText("server_side_custom_finish", { format: "wordstorm" });
  assert.equal(unknown, "Server side custom finish.");
  assert.doesNotMatch(unknown, /_/);
  assert.deepEqual(
    sanitizeScrambleFormatResult({
      format: "forge-clash",
      battle: {
        winnerSlot: "slot-a",
        reason: "category_counter",
        left: { word: "Storm", power: 3 },
        right: { word: "Wall", power: 2 },
        injected: "<script>"
      }
    }, "forge-clash"),
    {
      format: "forge-clash",
      battle: {
        winnerSlot: "slot-a",
        reason: "category_counter",
        left: {
          word: "Storm",
          emoji: "\u2726",
          category: "",
          source: "",
          power: 3,
          depth: 3,
          craftedAt: 0
        },
        right: {
          word: "Wall",
          emoji: "\u2726",
          category: "",
          source: "",
          power: 2,
          depth: 2,
          craftedAt: 0
        }
      }
    }
  );
});
