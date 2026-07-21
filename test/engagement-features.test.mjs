import assert from "node:assert/strict";
import test from "node:test";

import {
  FEEDBACK_CUES,
  QUICK_TIP_LIMIT,
  buildGhost,
  feedbackCuePolicy,
  ghostSnapshot,
  ghostTrailPreviewState,
  grantSenseCharges,
  rankSenseCandidates,
  reconcileCloudProgression,
  refillSenseWallet,
  sanitizeFeedbackPreferences,
  sanitizeSenseWallet,
  selectQuickTip,
  selectWordGift,
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
    { elapsedMs: 0, progress: 0, moves: 0, milestone: 0, word: "secret", path: ["Earth"] },
    { elapsedMs: 10_000, progress: .5, moves: 4, milestone: 2, recipe: ["Fire", "Air"], result: "Energy" },
    { elapsedMs: 20_000, progress: 1, moves: 8, milestone: 4, ingredients: ["secret", "target"] }
  ], { label: "  Rival Nova  " });

  assert.equal(ghost.mode, "asynchronous");
  assert.equal(ghost.live, false);
  assert.equal(ghost.label, "Rival Nova");
  assert.equal(ghost.samples.some((sample) => ["word", "recipe", "path", "result", "ingredients"].some((key) => key in sample)), false);
});

test("encrypted ghost trail previews are deterministic and expose only numeric placeholders", () => {
  const input = {
    current: 2,
    total: 5,
    windowSize: 3,
    seed: 42,
    word: "Secret bird",
    recipe: ["Species", "Air"],
    path: [{ result: "Bird" }],
    result: "Bird",
    ingredients: ["Species", "Air"]
  };
  const preview = ghostTrailPreviewState(input);

  assert.deepEqual(ghostTrailPreviewState(input), preview);
  assert.deepEqual(preview.steps.map(({ index, status }) => ({ index, status })), [
    { index: 2, status: "completed" },
    { index: 3, status: "current" },
    { index: 4, status: "pending" }
  ]);
  assert.equal(preview.current, 2);
  assert.equal(preview.total, 5);
  assert.equal(preview.progress, .4);
  assert.equal(preview.complete, false);
  assert.equal(preview.hiddenBefore, 1);
  assert.equal(preview.hiddenAfter, 1);
  assert.ok(preview.steps.every((step) => Number.isInteger(step.widthPercent) && step.widthPercent >= 46 && step.widthPercent <= 88));
  assert.deepEqual(Object.keys(preview).sort(), ["complete", "current", "hiddenAfter", "hiddenBefore", "progress", "steps", "total"]);
  assert.ok(preview.steps.every((step) => Object.keys(step).sort().join(",") === "index,status,widthPercent"));
  assert.doesNotMatch(JSON.stringify(preview), /Secret bird|Species|Air|Bird/);
  for (const forbidden of ["word", "recipe", "path", "result", "ingredients"]) assert.equal(forbidden in preview, false);
});

test("encrypted ghost trail previews clamp hostile input and represent empty and completed trails", () => {
  assert.deepEqual(ghostTrailPreviewState({ current: Infinity, total: -900, windowSize: 99, seed: Symbol("hostile") }), {
    current: 0,
    total: 0,
    progress: 0,
    complete: false,
    hiddenBefore: 0,
    hiddenAfter: 0,
    steps: []
  });

  const completed = ghostTrailPreviewState({ current: 999, total: "2.9", windowSize: 0, seed: -5 });
  assert.equal(completed.current, 2);
  assert.equal(completed.total, 2);
  assert.equal(completed.progress, 1);
  assert.equal(completed.complete, true);
  assert.deepEqual(completed.steps.map(({ index, status }) => ({ index, status })), [{ index: 2, status: "completed" }]);
  assert.equal(completed.hiddenBefore, 1);
  assert.equal(completed.hiddenAfter, 0);
});

test("Quick Tips are bounded, deterministic, and never inspect hidden route data", () => {
  const input = {
    mode: "quick",
    used: 0,
    moves: 0,
    discoveries: 4,
    boardWords: 0,
    seed: 42,
    route: [{ a: "Species", b: "Air", word: "Bird" }],
    target: "Bird"
  };
  const first = selectQuickTip(input);
  assert.deepEqual(selectQuickTip(input), first);
  assert.equal(first.available, true);
  assert.equal(first.remaining, QUICK_TIP_LIMIT - 1);
  assert.doesNotMatch(JSON.stringify(first), /Species|Bird/);

  const exhausted = selectQuickTip({ ...input, used: 999 });
  assert.equal(exhausted.available, false);
  assert.equal(exhausted.remaining, 0);

  const seen = [];
  for (let used = 0; used < QUICK_TIP_LIMIT; used += 1) {
    const next = selectQuickTip({ ...input, used, moves: used * 4, discoveries: 4 + used * 5, boardWords: used, seen });
    assert.equal(next.available, true);
    assert.equal(seen.includes(next.id), false, "a changed board state must not repeat an earlier tip");
    seen.push(next.id);
  }
  assert.equal(new Set(seen).size, QUICK_TIP_LIMIT);
});

test("Word Gift selects an undiscovered non-target bridge without leaking its recipe", () => {
  const gift = selectWordGift({
    target: "Lightning",
    discovered: ["Earth", "Water", "Fire", "Air", "Energy"],
    seed: 19,
    route: [
      { a: "Fire", b: "Air", word: "Energy", emoji: "⚡", category: "force" },
      { a: "Fire", b: "Water", word: "Steam", emoji: "♨️", category: "force" },
      { a: "Air", b: "Steam", word: "Cloud", emoji: "☁️", category: "nature" },
      { a: "Cloud", b: "Energy", word: "Storm", emoji: "⛈️", category: "force" },
      { a: "Energy", b: "Storm", word: "Lightning", emoji: "🌩️", category: "force" }
    ]
  });
  assert.deepEqual(gift, {
    word: "Storm",
    emoji: "⛈️",
    category: "force",
    source: "gift",
    note: "A crucial bridge gifted by the cosmos.",
    feedbackEligible: false
  });
  assert.equal("a" in gift || "b" in gift || "route" in gift || "target" in gift, false);
  assert.equal(selectWordGift({ route: [{ a: "Air", b: "Species", word: "Bird" }], target: "Bird" }), null);
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
