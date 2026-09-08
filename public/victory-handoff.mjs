/**
 * Pure timing policy for the protected board-celebration window before result
 * gates or dialogs are allowed to take over.
 *
 * The returned value is the total hold measured from the start of the board
 * celebration. A caller that has already spent part of that window should wait
 * only for `Math.max(0, holdMs - elapsedMs)`.
 */

export const VICTORY_HANDOFF_VERSION = 1;

export const VICTORY_HANDOFF_TIMING = Object.freeze({
  lossMs: 0,
  revealedAnswerMs: 520,
  standardWinMs: 980,
  goldenPairReducedMotionMs: 850,
  goldenPairFullMotionMs: 3_650,
  goldenPairLingerMs: 250,
  minimumMs: 0,
  maximumMs: 4_000
});

function strictFlag(source, property) {
  try {
    return source[property] === true;
  } catch {
    return false;
  }
}

/**
 * Returns a deterministic, bounded total celebration hold.
 *
 * Inputs are deliberately strict booleans. In particular, only a caller that
 * has positively identified an authored Golden Pair may request its protected
 * cinematic window; truthy strings and numbers cannot extend presentation.
 */
export function victoryHandoffHoldMs(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return VICTORY_HANDOFF_TIMING.lossMs;
  }

  if (!strictFlag(options, "won")) return VICTORY_HANDOFF_TIMING.lossMs;
  if (strictFlag(options, "revealed")) return VICTORY_HANDOFF_TIMING.revealedAnswerMs;
  if (!strictFlag(options, "authoredGoldenPair")) return VICTORY_HANDOFF_TIMING.standardWinMs;
  if (strictFlag(options, "reducedMotion")) return VICTORY_HANDOFF_TIMING.goldenPairReducedMotionMs;
  let duration = 0;
  try {
    if (typeof options.goldenPairDurationMs === "number" && Number.isFinite(options.goldenPairDurationMs)) {
      duration = Math.max(0, Math.round(options.goldenPairDurationMs));
    }
  } catch {
    duration = 0;
  }
  if (!duration) return VICTORY_HANDOFF_TIMING.goldenPairFullMotionMs;
  return Math.min(
    VICTORY_HANDOFF_TIMING.maximumMs,
    Math.max(
      VICTORY_HANDOFF_TIMING.standardWinMs,
      duration + VICTORY_HANDOFF_TIMING.goldenPairLingerMs
    )
  );
}
