import test from "node:test";
import assert from "node:assert/strict";
import {
  VICTORY_HANDOFF_TIMING,
  VICTORY_HANDOFF_VERSION,
  victoryHandoffHoldMs
} from "../public/victory-handoff.mjs";

test("public victory handoff timing is frozen and intentionally bounded", () => {
  assert.equal(VICTORY_HANDOFF_VERSION, 1);
  assert.equal(Object.isFrozen(VICTORY_HANDOFF_TIMING), true);
  assert.deepEqual(VICTORY_HANDOFF_TIMING, {
    lossMs: 0,
    revealedAnswerMs: 520,
    standardWinMs: 980,
    goldenPairReducedMotionMs: 850,
    goldenPairFullMotionMs: 2_900,
    minimumMs: 0,
    maximumMs: 3_200
  });

  for (const [name, value] of Object.entries(VICTORY_HANDOFF_TIMING)) {
    assert.equal(Number.isSafeInteger(value), true, `${name} must be an integer`);
    assert.ok(value >= 0 && value <= 3_200, `${name} must remain inside the public bound`);
  }
  assert.ok(VICTORY_HANDOFF_TIMING.standardWinMs >= 900);
  assert.ok(VICTORY_HANDOFF_TIMING.standardWinMs <= 1_050);
  assert.ok(VICTORY_HANDOFF_TIMING.goldenPairFullMotionMs >= 2_600);
  assert.ok(VICTORY_HANDOFF_TIMING.goldenPairFullMotionMs <= 3_200);
  assert.ok(VICTORY_HANDOFF_TIMING.goldenPairFullMotionMs - 850 >= 1_700);
  assert.ok(VICTORY_HANDOFF_TIMING.goldenPairReducedMotionMs >= 700);
  assert.ok(VICTORY_HANDOFF_TIMING.goldenPairReducedMotionMs <= 1_000);

  assert.throws(() => {
    VICTORY_HANDOFF_TIMING.standardWinMs = 1;
  }, TypeError);
});

test("normal wins preserve the existing handoff while losses remain immediate", () => {
  assert.equal(victoryHandoffHoldMs({ won: true }), 980);
  assert.equal(victoryHandoffHoldMs({
    won: true,
    authoredGoldenPair: false,
    reducedMotion: false
  }), 980);
  assert.equal(victoryHandoffHoldMs({
    won: true,
    authoredGoldenPair: false,
    reducedMotion: true
  }), 980);

  assert.equal(victoryHandoffHoldMs({ won: false }), 0);
  assert.equal(victoryHandoffHoldMs({
    won: false,
    authoredGoldenPair: true,
    reducedMotion: true
  }), 0);
});

test("authored Golden Pair wins receive full and reduced-motion protected holds", () => {
  const full = victoryHandoffHoldMs({
    won: true,
    authoredGoldenPair: true,
    reducedMotion: false
  });
  const reduced = victoryHandoffHoldMs({
    won: true,
    authoredGoldenPair: true,
    reducedMotion: true
  });

  assert.equal(full, 2_900);
  assert.ok(full >= 2_600 && full <= 3_200);
  assert.ok(full > 850, "the full hold must include the complete scene and result linger");
  assert.equal(reduced, 850);
  assert.ok(reduced >= 700 && reduced <= 1_000);
  assert.ok(reduced < full);
});

test("revealed answers never receive the Golden Pair hold", () => {
  assert.equal(victoryHandoffHoldMs({
    won: true,
    revealed: true,
    authoredGoldenPair: true,
    reducedMotion: false
  }), VICTORY_HANDOFF_TIMING.revealedAnswerMs);
  assert.equal(victoryHandoffHoldMs({
    won: true,
    revealed: true,
    authoredGoldenPair: true,
    reducedMotion: true
  }), VICTORY_HANDOFF_TIMING.revealedAnswerMs);
  assert.equal(victoryHandoffHoldMs({
    won: true,
    revealed: true,
    authoredGoldenPair: false
  }), VICTORY_HANDOFF_TIMING.revealedAnswerMs);
  assert.notEqual(
    VICTORY_HANDOFF_TIMING.revealedAnswerMs,
    VICTORY_HANDOFF_TIMING.goldenPairFullMotionMs
  );
});

test("hostile and malformed values cannot coerce a longer result delay", () => {
  for (const value of [
    undefined,
    null,
    true,
    1,
    "win",
    [],
    () => true,
    Symbol("win")
  ]) {
    assert.equal(victoryHandoffHoldMs(value), 0);
  }

  assert.equal(victoryHandoffHoldMs({ won: "true", authoredGoldenPair: true }), 0);
  assert.equal(victoryHandoffHoldMs({ won: 1, authoredGoldenPair: true }), 0);
  assert.equal(victoryHandoffHoldMs({
    won: true,
    authoredGoldenPair: "true",
    reducedMotion: false
  }), 980);
  assert.equal(victoryHandoffHoldMs({
    won: true,
    authoredGoldenPair: 1,
    reducedMotion: true
  }), 980);
  assert.equal(victoryHandoffHoldMs({
    won: true,
    authoredGoldenPair: true,
    revealed: "false",
    reducedMotion: "true"
  }), 2_900);

  const throwingProxy = new Proxy({}, {
    get() {
      throw new Error("hostile getter");
    }
  });
  assert.doesNotThrow(() => victoryHandoffHoldMs(throwingProxy));
  assert.equal(victoryHandoffHoldMs(throwingProxy), 0);

  const wonOnly = {
    won: true,
    get authoredGoldenPair() {
      throw new Error("hostile Golden flag");
    }
  };
  assert.equal(victoryHandoffHoldMs(wonOnly), 980);
});

test("the policy is deterministic and can return only configured holds", () => {
  const allowed = new Set([
    VICTORY_HANDOFF_TIMING.lossMs,
    VICTORY_HANDOFF_TIMING.revealedAnswerMs,
    VICTORY_HANDOFF_TIMING.standardWinMs,
    VICTORY_HANDOFF_TIMING.goldenPairReducedMotionMs,
    VICTORY_HANDOFF_TIMING.goldenPairFullMotionMs
  ]);

  for (const won of [false, true]) {
    for (const revealed of [false, true]) {
      for (const authoredGoldenPair of [false, true]) {
        for (const reducedMotion of [false, true]) {
          const input = { won, revealed, authoredGoldenPair, reducedMotion };
          const first = victoryHandoffHoldMs(input);
          const second = victoryHandoffHoldMs({ ...input });
          assert.equal(second, first);
          assert.equal(allowed.has(first), true);
          assert.ok(
            first >= VICTORY_HANDOFF_TIMING.minimumMs
            && first <= VICTORY_HANDOFF_TIMING.maximumMs
          );
        }
      }
    }
  }
});
