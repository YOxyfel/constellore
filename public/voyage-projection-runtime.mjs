import {
  VOYAGE_DURATION_SECONDS,
  VOYAGE_FINAL_TEXT,
  VOYAGE_NARRATION,
  VOYAGE_REDUCED_MOTION_NARRATION,
  createVoyageTimeline,
  narrationAtTime,
  normalizeVoyageVariant,
  reducedMotionNarrationAtTime,
  resolveVoyageSkipOutcome,
  shotAtTime
} from "./voyage-projection-domain.mjs?v=5.0.0-beta.4";

/**
 * The reduced-motion projection is a sequence of still, narrated mission
 * plates. It deliberately keeps enough time for every approved line while
 * removing camera travel, orbit loops, and spatial acceleration.
 */
export const VOYAGE_REDUCED_MOTION_DURATION_SECONDS = 24;

const PHASES = Object.freeze([
  "idle",
  "running",
  "paused",
  "suspended",
  "completed",
  "fallback",
  "destroyed"
]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value, minimum)));
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function defaultNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function defaultRequestFrame(callback) {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame(callback);
  }
  return globalThis.setTimeout(() => callback(defaultNow()), 16);
}

function defaultCancelFrame(handle) {
  if (typeof globalThis.cancelAnimationFrame === "function") {
    globalThis.cancelAnimationFrame(handle);
    return;
  }
  globalThis.clearTimeout(handle);
}

function isVisibilityHidden(target) {
  return Boolean(target?.hidden || target?.visibilityState === "hidden");
}

function terminalOutcome(variant, reason) {
  const terminal = shotAtTime(VOYAGE_DURATION_SECONDS, { variant });
  return freeze({
    variant,
    skipped: false,
    skippedAtSeconds: null,
    terminalShotId: terminal.id,
    outcome: terminal.outcome,
    finalText: variant === "completion" ? [] : [...VOYAGE_FINAL_TEXT],
    cinematicAcknowledgement: true,
    progressionEffect: null,
    completionReason: reason
  });
}

/**
 * Create a presentation-only Voyage Projection clock.
 *
 * The controller never writes profile/gameplay state. Consumers receive
 * explicit intents and decide whether/how to commit them in the authoritative
 * gameplay layer.
 */
export function createVoyageProjectionRuntime({
  variant = "promise",
  reducedMotion = false,
  reducedMotionDurationSeconds = VOYAGE_REDUCED_MOTION_DURATION_SECONDS,
  arrivalWorldId = null,
  now = defaultNow,
  requestFrame = defaultRequestFrame,
  cancelFrame = defaultCancelFrame,
  visibilityTarget = null,
  onShotChange = null,
  onNarrationCue = null,
  onCaptionCue = null,
  onCue = null,
  onProgress = null,
  onCompletion = null,
  onComplete = null,
  onIntent = null,
  onArrivalIntent = null,
  onCompletionIntent = null,
  onFallback = null,
  onError = null
} = {}) {
  const callbacks = {
    shot: onShotChange,
    narration: onNarrationCue,
    caption: onCaptionCue,
    cue: onCue,
    progress: onProgress,
    completion: onCompletion || onComplete,
    intent: onIntent,
    arrivalIntent: onArrivalIntent,
    completionIntent: onCompletionIntent,
    fallback: onFallback,
    error: onError
  };

  const state = {
    phase: "idle",
    variant: normalizeVoyageVariant(variant),
    reducedMotion: Boolean(reducedMotion),
    playbackDurationSeconds: 0,
    playbackSeconds: 0,
    timelineSeconds: 0,
    runId: 1,
    visible: !isVisibilityHidden(visibilityTarget),
    pauseReason: null,
    resumeAfterVisibility: false,
    currentShotId: null,
    currentCueId: null,
    currentCue: null,
    skipped: false,
    completionEmitted: false,
    completionOutcome: null,
    arrivalIntent: null,
    completionIntent: null,
    lastError: null,
    fallbackReason: null,
    frameHandle: null,
    lastClockMs: null
  };

  function resolvePlaybackDuration() {
    return state.reducedMotion
      ? Math.max(8, finite(reducedMotionDurationSeconds, VOYAGE_REDUCED_MOTION_DURATION_SECONDS))
      : VOYAGE_DURATION_SECONDS;
  }

  state.playbackDurationSeconds = resolvePlaybackDuration();

  function snapshot() {
    const shot = shotAtTime(state.timelineSeconds, { variant: state.variant });
    return freeze({
      phase: state.phase,
      variant: state.variant,
      reducedMotion: state.reducedMotion,
      motionEnabled: !state.reducedMotion,
      playbackDurationSeconds: state.playbackDurationSeconds,
      playbackSeconds: state.playbackSeconds,
      timelineDurationSeconds: VOYAGE_DURATION_SECONDS,
      timelineSeconds: state.timelineSeconds,
      progress: clamp(state.timelineSeconds / VOYAGE_DURATION_SECONDS, 0, 1),
      runId: state.runId,
      visible: state.visible,
      pauseReason: state.pauseReason,
      shot,
      narrationCue: state.currentCue,
      skipped: state.skipped,
      ended: state.phase === "completed",
      completionOutcome: state.completionOutcome,
      arrivalIntent: state.arrivalIntent,
      completionIntent: state.completionIntent,
      fallbackReason: state.fallbackReason,
      lastError: state.lastError
    });
  }

  function reportCallbackError(error, source) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    state.lastError = freeze({
      name: normalized.name || "Error",
      message: normalized.message || String(normalized),
      source
    });
    try {
      callbacks.error?.(normalized, freeze({ source, snapshot: snapshot() }));
    } catch {
      // An error reporter must never destabilize the presentation clock.
    }
  }

  function invoke(callback, args, source) {
    if (typeof callback !== "function") return;
    try {
      callback(...args);
    } catch (error) {
      reportCallbackError(error, source);
    }
  }

  function cueMeta(kind) {
    return freeze({
      kind,
      runId: state.runId,
      variant: state.variant,
      reducedMotion: state.reducedMotion,
      timelineSeconds: state.timelineSeconds
    });
  }

  function setCue(cue, kind = cue ? "start" : "clear") {
    const cueId = cue?.id || null;
    if (cueId === state.currentCueId) return;
    state.currentCueId = cueId;
    state.currentCue = cue || null;
    const meta = cueMeta(kind);
    const snap = snapshot();
    invoke(callbacks.narration, [state.currentCue, meta, snap], "narration-cue");
    invoke(callbacks.caption, [state.currentCue, meta, snap], "caption-cue");
    invoke(callbacks.cue, [state.currentCue, meta, snap], "cue");
  }

  function emitShot(shot, kind = "change") {
    if (!shot || shot.id === state.currentShotId) return;
    state.currentShotId = shot.id;
    invoke(callbacks.shot, [shot, freeze({
      kind,
      runId: state.runId,
      timelineSeconds: state.timelineSeconds,
      snapshot: snapshot()
    })], "shot-change");
  }

  function emitCurrent({ initial = false } = {}) {
    emitShot(shotAtTime(state.timelineSeconds, { variant: state.variant }), initial ? "initial" : "change");
    setCue(currentNarrationCue(), initial ? "initial" : undefined);
  }

  function currentNarrationCue() {
    return state.reducedMotion
      ? reducedMotionNarrationAtTime(state.playbackSeconds, { variant: state.variant })
      : narrationAtTime(state.timelineSeconds, { variant: state.variant });
  }

  function eligibleNarration() {
    const schedule = state.reducedMotion ? VOYAGE_REDUCED_MOTION_NARRATION : VOYAGE_NARRATION;
    return schedule.filter((cue) => cue.variants.includes(state.variant));
  }

  function emitForwardTransitions(previousTimelineSeconds, nextTimelineSeconds, previousPlaybackSeconds, nextPlaybackSeconds) {
    const timeline = createVoyageTimeline(state.variant);
    for (const shot of timeline) {
      if (shot.startSeconds > previousTimelineSeconds && shot.startSeconds <= nextTimelineSeconds) {
        emitShot(shot);
      }
    }

    const previousNarrationSeconds = state.reducedMotion ? previousPlaybackSeconds : previousTimelineSeconds;
    const nextNarrationSeconds = state.reducedMotion ? nextPlaybackSeconds : nextTimelineSeconds;
    for (const cue of eligibleNarration()) {
      if (cue.startSeconds > previousNarrationSeconds && cue.startSeconds <= nextNarrationSeconds) {
        setCue(cue, "start");
      }
      if (cue.endSeconds > previousNarrationSeconds && cue.endSeconds <= nextNarrationSeconds
        && state.currentCueId === cue.id) {
        setCue(null, "clear");
      }
    }
    const activeCue = state.reducedMotion
      ? reducedMotionNarrationAtTime(nextNarrationSeconds, { variant: state.variant })
      : narrationAtTime(nextNarrationSeconds, { variant: state.variant });
    if ((activeCue?.id || null) !== state.currentCueId) {
      setCue(activeCue, activeCue ? "start" : "clear");
    }
  }

  function emitProgress() {
    invoke(callbacks.progress, [snapshot()], "progress");
  }

  function cancelScheduledFrame() {
    if (state.frameHandle === null) return;
    const handle = state.frameHandle;
    state.frameHandle = null;
    try {
      cancelFrame(handle);
    } catch (error) {
      reportCallbackError(error, "cancel-frame");
    }
  }

  function enterFallback(reason = "runtime-unavailable", error = null) {
    if (state.phase === "destroyed" || state.phase === "completed") return false;
    cancelScheduledFrame();
    state.phase = "fallback";
    state.pauseReason = null;
    state.resumeAfterVisibility = false;
    state.fallbackReason = String(reason || "runtime-unavailable");
    if (error) reportCallbackError(error, "fallback");
    invoke(callbacks.fallback, [freeze({
      reason: state.fallbackReason,
      error: state.lastError,
      snapshot: snapshot()
    })], "fallback-callback");
    return true;
  }

  function scheduleFrame() {
    if (state.phase !== "running" || state.frameHandle !== null) return;
    try {
      state.frameHandle = requestFrame(tick);
    } catch (error) {
      enterFallback("frame-scheduler-failed", error);
    }
  }

  function emitIntents(reason) {
    const common = {
      runId: state.runId,
      variant: state.variant,
      reason,
      skipped: state.skipped,
      progressionEffect: null
    };
    state.arrivalIntent = arrivalWorldId
      ? freeze({
          type: "record-expedition-arrival",
          worldId: String(arrivalWorldId),
          ...common
        })
      : null;
    state.completionIntent = freeze({
      type: "voyage-projection-completed",
      ...common
    });

    const snap = snapshot();
    if (state.arrivalIntent) {
      invoke(callbacks.arrivalIntent, [state.arrivalIntent, snap], "arrival-intent");
      invoke(callbacks.intent, [state.arrivalIntent, snap], "intent");
    }
    invoke(callbacks.completionIntent, [state.completionIntent, snap], "completion-intent");
    invoke(callbacks.intent, [state.completionIntent, snap], "intent");
  }

  function complete(reason, outcome = null) {
    if (state.completionEmitted || state.phase === "destroyed") return state.completionOutcome;
    cancelScheduledFrame();
    state.timelineSeconds = VOYAGE_DURATION_SECONDS;
    state.playbackSeconds = state.playbackDurationSeconds;
    state.phase = "completed";
    state.pauseReason = null;
    state.resumeAfterVisibility = false;
    state.completionEmitted = true;
    state.completionOutcome = outcome || terminalOutcome(state.variant, reason);
    setCue(null, "clear");
    emitProgress();
    emitIntents(reason);
    invoke(callbacks.completion, [state.completionOutcome, snapshot()], "completion");
    return state.completionOutcome;
  }

  function tick() {
    state.frameHandle = null;
    if (state.phase !== "running") return;
    let clockMs;
    try {
      clockMs = finite(now(), state.lastClockMs ?? 0);
    } catch (error) {
      enterFallback("clock-failed", error);
      return;
    }
    const deltaSeconds = Math.max(0, (clockMs - (state.lastClockMs ?? clockMs)) / 1000);
    state.lastClockMs = clockMs;
    const previousTimelineSeconds = state.timelineSeconds;
    const previousPlaybackSeconds = state.playbackSeconds;
    state.playbackSeconds = clamp(
      state.playbackSeconds + deltaSeconds,
      0,
      state.playbackDurationSeconds
    );
    state.timelineSeconds = clamp(
      (state.playbackSeconds / state.playbackDurationSeconds) * VOYAGE_DURATION_SECONDS,
      0,
      VOYAGE_DURATION_SECONDS
    );
    emitForwardTransitions(
      previousTimelineSeconds,
      state.timelineSeconds,
      previousPlaybackSeconds,
      state.playbackSeconds
    );
    emitProgress();
    if (state.timelineSeconds >= VOYAGE_DURATION_SECONDS) {
      complete("natural");
      return;
    }
    scheduleFrame();
  }

  function resetRun({
    nextVariant = state.variant,
    nextReducedMotion = state.reducedMotion,
    fromSeconds = 0,
    incrementRun = false
  } = {}) {
    cancelScheduledFrame();
    if (incrementRun) state.runId += 1;
    state.variant = normalizeVoyageVariant(nextVariant);
    state.reducedMotion = Boolean(nextReducedMotion);
    state.playbackDurationSeconds = state.reducedMotion
      ? Math.max(8, finite(reducedMotionDurationSeconds, VOYAGE_REDUCED_MOTION_DURATION_SECONDS))
      : VOYAGE_DURATION_SECONDS;
    state.timelineSeconds = clamp(fromSeconds, 0, VOYAGE_DURATION_SECONDS);
    state.playbackSeconds = (state.timelineSeconds / VOYAGE_DURATION_SECONDS) * state.playbackDurationSeconds;
    state.phase = "idle";
    state.pauseReason = null;
    state.resumeAfterVisibility = false;
    state.currentShotId = null;
    state.currentCueId = null;
    state.currentCue = null;
    state.skipped = false;
    state.completionEmitted = false;
    state.completionOutcome = null;
    state.arrivalIntent = null;
    state.completionIntent = null;
    state.lastError = null;
    state.fallbackReason = null;
    state.lastClockMs = null;
  }

  function start({
    variant: nextVariant = state.variant,
    reducedMotion: nextReducedMotion = state.reducedMotion,
    fromSeconds = state.timelineSeconds
  } = {}) {
    if (state.phase === "destroyed" || state.phase === "completed" || state.phase === "fallback") return false;
    if (state.phase === "running") return snapshot();
    if (state.phase === "paused" || state.phase === "suspended") return resume();
    resetRun({ nextVariant, nextReducedMotion, fromSeconds, incrementRun: false });
    state.phase = state.visible ? "running" : "suspended";
    state.pauseReason = state.visible ? null : "visibility";
    state.resumeAfterVisibility = !state.visible;
    emitCurrent({ initial: true });
    emitProgress();
    if (!state.visible) {
      return snapshot();
    }
    try {
      state.lastClockMs = finite(now(), 0);
    } catch (error) {
      enterFallback("clock-failed", error);
      return snapshot();
    }
    scheduleFrame();
    return snapshot();
  }

  function pause(reason = "manual") {
    if (state.phase !== "running" && state.phase !== "suspended") return false;
    cancelScheduledFrame();
    state.phase = "paused";
    state.pauseReason = String(reason || "manual");
    state.resumeAfterVisibility = false;
    state.lastClockMs = null;
    return snapshot();
  }

  function resume() {
    if (state.phase !== "paused" && state.phase !== "suspended") return false;
    if (!state.visible) {
      state.phase = "suspended";
      state.pauseReason = "visibility";
      state.resumeAfterVisibility = true;
      return snapshot();
    }
    state.phase = "running";
    state.pauseReason = null;
    state.resumeAfterVisibility = false;
    try {
      state.lastClockMs = finite(now(), 0);
    } catch (error) {
      enterFallback("clock-failed", error);
      return snapshot();
    }
    scheduleFrame();
    return snapshot();
  }

  function setVisibility(visible) {
    const nextVisible = Boolean(visible);
    if (state.phase === "destroyed" || state.visible === nextVisible) return snapshot();
    state.visible = nextVisible;
    if (!nextVisible && state.phase === "running") {
      cancelScheduledFrame();
      state.phase = "suspended";
      state.pauseReason = "visibility";
      state.resumeAfterVisibility = true;
      state.lastClockMs = null;
    } else if (nextVisible && state.phase === "suspended" && state.resumeAfterVisibility) {
      resume();
    }
    return snapshot();
  }

  function skip() {
    if (state.phase === "destroyed") return null;
    if (state.completionEmitted) return state.completionOutcome;
    const skippedAtSeconds = state.timelineSeconds;
    cancelScheduledFrame();
    state.skipped = true;
    state.timelineSeconds = VOYAGE_DURATION_SECONDS;
    state.playbackSeconds = state.playbackDurationSeconds;
    emitShot(shotAtTime(VOYAGE_DURATION_SECONDS, { variant: state.variant }), "skip");
    setCue(null, "clear");
    const outcome = freeze({
      ...resolveVoyageSkipOutcome({
        variant: state.variant,
        timeSeconds: skippedAtSeconds
      }),
      completionReason: "skip"
    });
    return complete("skip", outcome);
  }

  function replay({
    variant: nextVariant = state.variant,
    reducedMotion: nextReducedMotion = state.reducedMotion,
    fromSeconds = 0,
    autoStart = true
  } = {}) {
    if (state.phase === "destroyed") return false;
    resetRun({
      nextVariant,
      nextReducedMotion,
      fromSeconds,
      incrementRun: true
    });
    return autoStart ? start() : snapshot();
  }

  function destroy() {
    if (state.phase === "destroyed") return false;
    cancelScheduledFrame();
    visibilityTarget?.removeEventListener?.("visibilitychange", visibilityHandler);
    state.phase = "destroyed";
    state.pauseReason = null;
    state.resumeAfterVisibility = false;
    state.lastClockMs = null;
    return true;
  }

  function visibilityHandler() {
    setVisibility(!isVisibilityHidden(visibilityTarget));
  }

  if (visibilityTarget?.addEventListener) {
    visibilityTarget.addEventListener("visibilitychange", visibilityHandler);
  }

  return Object.freeze({
    start,
    pause,
    resume,
    skip,
    replay,
    setVisibility,
    fallback: enterFallback,
    destroy,
    snapshot,
    phases: PHASES
  });
}
