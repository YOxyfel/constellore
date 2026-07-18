import assert from "node:assert/strict";
import test from "node:test";

import {
  FEEDBACK_CUES,
  buildGhost,
  feedbackCuePolicy,
  ghostSnapshot,
  grantSenseCharges,
  rankSenseCandidates,
  reconcileCloudProgression,
  refillSenseWallet,
  sanitizeFeedbackPreferences,
  sanitizeSenseWallet,
  spendSenseCharge
} from "../public/engagement-features.mjs";

test("cloud progression never resurrects spent balances or consumed shields", () => {
  const localAfterSpend = {
    stardust: 10,
    wins: 4,
    dailyStreak: 0,
    lastDailyDate: "2026-07-18",
    dailyCompleted: "2026-07-18",
    streakShields: 0
  };
  const staleRemote = {
    stardust: 100,
    wins: 3,
    dailyStreak: 8,
    lastDailyDate: "2026-07-17",
    dailyCompleted: "2026-07-17",
    streakShields: 2
  };

  assert.deepEqual(reconcileCloudProgression(localAfterSpend, staleRemote, { preferLocal: true }), localAfterSpend);
  assert.deepEqual(reconcileCloudProgression(localAfterSpend, { ...staleRemote, wins: 6 }, { preferLocal: true }), {
    ...localAfterSpend,
    wins: 6
  });
  assert.deepEqual(reconcileCloudProgression(localAfterSpend, staleRemote), staleRemote, "a clean device accepts the authoritative cloud copy");
});

test("Sense wallets sanitize hostile values and retain only bounded counters", () => {
  assert.deepEqual(sanitizeSenseWallet({
    version: 99,
    charges: 100,
    lastRefillDate: "not-a-date",
    earned: -5,
    spent: "12.9",
    injected: "discard me"
  }), {
    version: 1,
    charges: 9,
    lastRefillDate: "",
    earned: 0,
    spent: 12
  });
});

test("Sense daily refill is capped and idempotent for one calendar date", () => {
  const first = refillSenseWallet({ charges: 1 }, { date: "2026-07-18", amount: 2, cap: 3 });
  assert.equal(first.refilled, true);
  assert.equal(first.granted, 2);
  assert.deepEqual(first.wallet, {
    version: 1, charges: 3, lastRefillDate: "2026-07-18", earned: 2, spent: 0
  });

  const repeated = refillSenseWallet(first.wallet, { date: "2026-07-18", amount: 2, cap: 3 });
  assert.equal(repeated.refilled, false);
  assert.equal(repeated.granted, 0);
  assert.deepEqual(repeated.wallet, first.wallet);
});

test("spending a Sense charge marks a score-ineligible assisted run", () => {
  const result = spendSenseCharge({ charges: 2, earned: 4, spent: 1 });
  assert.equal(result.spent, true);
  assert.equal(result.assisted, true);
  assert.equal(result.assist, "sense");
  assert.equal(result.division, "assisted");
  assert.equal(result.scoreEligible, false);
  assert.equal(result.wallet.charges, 1);
  assert.equal(result.wallet.spent, 2);

  const empty = spendSenseCharge({ charges: 0 });
  assert.equal(empty.spent, false);
  assert.equal(empty.reason, "empty");
  assert.equal(empty.division, "pure");

  const granted = grantSenseCharges({ charges: 8, earned: 2 }, 5, { cap: 9 });
  assert.equal(granted.granted, 1);
  assert.equal(granted.wallet.charges, 9);
  assert.equal(granted.wallet.earned, 3);
});

test("Sense ranking is deterministic, route-aware, and never reveals a ready recipe pair", () => {
  const input = {
    words: [
      { word: "Earth", emoji: "🌍" },
      { word: "Water", emoji: "💧" },
      { word: "Fire", emoji: "🔥" },
      { word: "Air", emoji: "💨" },
      { word: "Telescope", emoji: "🔭" }
    ],
    target: "Telescope",
    route: [
      { a: "Fire", b: "Air", word: "Energy", note: "secret first recipe" },
      { a: "Earth", b: "Water", word: "Mud", note: "secret second recipe" }
    ],
    history: [{ a: "Earth", b: "Fire", word: "Lava" }],
    seed: 42,
    limit: 3
  };
  const first = rankSenseCandidates(input);
  const repeated = rankSenseCandidates(input);

  assert.deepEqual(repeated, first);
  assert.equal(first.some((item) => item.word === "Telescope"), false, "the target is never highlighted");
  const words = new Set(first.map((item) => item.word));
  assert.equal(words.has("Fire") && words.has("Air"), false, "one hint cannot expose both sides of a recipe");
  assert.equal(words.has("Earth") && words.has("Water"), false, "pair suppression applies to every ready step");
  assert.ok(first.some((item) => ["Fire", "Air"].includes(item.word)), "the earliest unresolved route contributes a candidate");
  for (const item of first) {
    assert.deepEqual(Object.keys(item).sort(), ["emoji", "id", "rank", "signal", "word"]);
    assert.equal("partner" in item || "result" in item || "route" in item || "score" in item || "reason" in item, false);
  }
});

test("ghosts are sanitized asynchronous recordings, never live sessions", () => {
  const ghost = buildGhost([
    { elapsedMs: 0, progress: 0, moves: 0, milestone: 0, word: "secret" },
    { elapsedMs: 10_000, progress: .5, moves: 4, milestone: 2, recipe: ["Fire", "Air"] },
    { elapsedMs: 20_000, progress: 1, moves: 8, milestone: 4 }
  ], { label: "  Rival Nova  " });

  assert.equal(ghost.mode, "asynchronous");
  assert.equal(ghost.live, false);
  assert.equal(ghost.label, "Rival Nova");
  assert.equal(ghost.samples.some((sample) => "word" in sample || "recipe" in sample), false);
});

test("ghost snapshots interpolate pace and expose projected milestone state only", () => {
  const ghost = buildGhost([
    { elapsedMs: 0, progress: 0, moves: 0, milestone: 0 },
    { elapsedMs: 10_000, progress: .5, moves: 4, milestone: 2 },
    { elapsedMs: 20_000, progress: 1, moves: 8, milestone: 4 }
  ]);
  const snapshot = ghostSnapshot(ghost, { elapsedMs: 5_000, playerProgress: .4, playerMoves: 3, tolerance: .05 });

  assert.equal(snapshot.live, false);
  assert.equal(snapshot.mode, "asynchronous");
  assert.equal(snapshot.projectedProgress, .25);
  assert.equal(snapshot.projectedMoves, 2);
  assert.equal(snapshot.relation, "ahead");
  assert.deepEqual(snapshot.milestone, { current: 0, next: 2, etaMs: 5_000 });

  const restored = ghostSnapshot(ghost, { elapsedMs: 8 * 60 * 60 * 1000, playerProgress: 0, playerMoves: 0 });
  assert.equal(restored.complete, true);
  assert.equal(restored.elapsedMs, 20_000, "a completed ghost clock stops at its recorded finish after an offline restore");
});

test("feedback preferences sanitize JSON, booleans, mute, and volume", () => {
  assert.deepEqual(sanitizeFeedbackPreferences('{"sound":"false","haptics":"true","muted":false,"volume":2}'), {
    sound: false,
    haptics: true,
    muted: false,
    volume: 1
  });
  assert.deepEqual(sanitizeFeedbackPreferences({ muted: true, masterVolume: -.5, haptics: 0 }), {
    sound: true,
    haptics: false,
    muted: true,
    volume: 0
  });
  assert.deepEqual(sanitizeFeedbackPreferences("invalid"), { sound: true, haptics: true, muted: false, volume: .75 });
});

test("feedback cue policy is volume-aware and safe for silent, reduced-motion, and hidden contexts", () => {
  const active = feedbackCuePolicy("success", { volume: .5 }, { audioAvailable: true, hapticsAvailable: true });
  assert.deepEqual(active.audio.tones, FEEDBACK_CUES.success.tones);
  assert.equal(active.audio.gain, FEEDBACK_CUES.success.gain * .5);
  assert.deepEqual(active.haptic, FEEDBACK_CUES.success.haptic);
  assert.notEqual(active.audio.tones, FEEDBACK_CUES.success.tones, "policy returns mutable copies, not cue constants");

  const silent = feedbackCuePolicy("success", {}, { silent: true });
  assert.equal(silent.audio, null);
  assert.ok(silent.haptic, "silent mode may retain non-audio feedback");

  const reduced = feedbackCuePolicy("success", {}, { reducedMotion: true });
  assert.ok(reduced.audio);
  assert.equal(reduced.haptic, null);

  assert.deepEqual(feedbackCuePolicy("success", {}, { documentHidden: true }), { cue: "success", audio: null, haptic: null });
  assert.deepEqual(feedbackCuePolicy("unknown", {}, {}), { cue: "unknown", audio: null, haptic: null });
});
