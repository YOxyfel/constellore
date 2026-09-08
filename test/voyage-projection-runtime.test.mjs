import test from "node:test";
import assert from "node:assert/strict";
import {
  VOYAGE_REDUCED_MOTION_DURATION_SECONDS,
  createVoyageProjectionRuntime
} from "../public/voyage-projection-runtime.mjs";

function clockFixture(options = {}) {
  let time = 0;
  let nextHandle = 1;
  const frames = new Map();
  const events = [];
  const runtime = createVoyageProjectionRuntime({
    now: () => time,
    requestFrame(callback) {
      const handle = nextHandle++;
      frames.set(handle, callback);
      return handle;
    },
    cancelFrame(handle) {
      frames.delete(handle);
    },
    onShotChange: (shot) => events.push(["shot", shot.id]),
    onNarrationCue: (cue) => events.push(["cue", cue?.id || null]),
    onProgress: (snapshot) => events.push(["progress", snapshot.timelineSeconds]),
    onCompletion: (outcome) => events.push(["complete", outcome.completionReason]),
    onIntent: (intent) => events.push(["intent", intent.type]),
    onFallback: (fallback) => events.push(["fallback", fallback.reason]),
    onError: (error, meta) => events.push(["error", meta.source, error.message]),
    ...options
  });

  function advance(milliseconds) {
    time += milliseconds;
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(time);
  }

  return {
    runtime,
    events,
    advance,
    pendingFrames: () => frames.size,
    setTime(value) { time = value; }
  };
}

test("deterministic clock crosses authored shot and narration boundaries", () => {
  const fixture = clockFixture();
  const initial = fixture.runtime.start();
  assert.equal(initial.phase, "running");
  assert.equal(initial.shot.id, "earth");
  assert.equal(fixture.pendingFrames(), 1);

  fixture.advance(999);
  assert.equal(fixture.runtime.snapshot().narrationCue, null);
  fixture.advance(1);
  assert.equal(fixture.runtime.snapshot().narrationCue.id, "understanding-makes-reachable");
  fixture.advance(6000);
  assert.equal(fixture.runtime.snapshot().shot.id, "solar");
  assert.equal(fixture.runtime.snapshot().narrationCue, null);
  fixture.advance(1400);
  assert.equal(fixture.runtime.snapshot().narrationCue.id, "discovery-makes-coordinate");

  assert.deepEqual(
    fixture.events.filter(([kind]) => kind === "shot").slice(0, 2),
    [["shot", "earth"], ["shot", "solar"]]
  );
  assert.ok(Object.isFrozen(fixture.runtime.snapshot()));
  assert.ok(Object.isFrozen(fixture.runtime.snapshot().shot));
});

test("pause and resume discard wall-clock time spent paused", () => {
  const fixture = clockFixture();
  fixture.runtime.start();
  fixture.advance(3000);
  fixture.runtime.pause();
  const pausedAt = fixture.runtime.snapshot().timelineSeconds;
  fixture.setTime(23_000);
  assert.equal(fixture.runtime.snapshot().phase, "paused");
  assert.equal(fixture.runtime.snapshot().timelineSeconds, pausedAt);
  fixture.runtime.resume();
  fixture.advance(1000);
  assert.equal(fixture.runtime.snapshot().timelineSeconds, pausedAt + 1);
});

test("visibility suspension automatically resumes without adding hidden time", () => {
  const fixture = clockFixture();
  fixture.runtime.start();
  fixture.advance(2000);
  fixture.runtime.setVisibility(false);
  assert.equal(fixture.runtime.snapshot().phase, "suspended");
  fixture.setTime(12_000);
  fixture.runtime.setVisibility(true);
  assert.equal(fixture.runtime.snapshot().phase, "running");
  fixture.advance(1000);
  assert.equal(fixture.runtime.snapshot().timelineSeconds, 3);
});

test("skip emits completion and presentation intents exactly once", () => {
  const fixture = clockFixture({ arrivalWorldId: "moon" });
  fixture.runtime.start();
  fixture.advance(2500);
  const first = fixture.runtime.skip();
  const second = fixture.runtime.skip();
  assert.strictEqual(second, first);
  assert.equal(first.skipped, true);
  assert.equal(first.skippedAtSeconds, 2.5);
  assert.equal(fixture.runtime.snapshot().phase, "completed");
  assert.equal(fixture.runtime.snapshot().arrivalIntent.type, "record-expedition-arrival");
  assert.equal(fixture.runtime.snapshot().arrivalIntent.worldId, "moon");
  assert.equal(fixture.events.filter(([kind]) => kind === "complete").length, 1);
  assert.deepEqual(fixture.events.filter(([kind]) => kind === "intent"), [
    ["intent", "record-expedition-arrival"],
    ["intent", "voyage-projection-completed"]
  ]);
});

test("natural completion fires once even when time leaps past the endpoint", () => {
  const fixture = clockFixture();
  fixture.runtime.start();
  fixture.advance(60_000);
  assert.equal(fixture.runtime.snapshot().phase, "completed");
  assert.equal(fixture.runtime.snapshot().timelineSeconds, 57);
  assert.equal(fixture.events.filter(([kind]) => kind === "complete").length, 1);
  fixture.advance(10_000);
  assert.equal(fixture.events.filter(([kind]) => kind === "complete").length, 1);
  assert.equal(fixture.pendingFrames(), 0);
});

test("replay resets terminal state, cues, progress, and the one-shot completion guard", () => {
  const fixture = clockFixture();
  fixture.runtime.start();
  fixture.runtime.skip();
  const firstRun = fixture.runtime.snapshot().runId;
  const replayed = fixture.runtime.replay({ autoStart: false });
  assert.equal(replayed.phase, "idle");
  assert.equal(replayed.runId, firstRun + 1);
  assert.equal(replayed.timelineSeconds, 0);
  assert.equal(replayed.skipped, false);
  assert.equal(replayed.completionOutcome, null);
  fixture.runtime.start();
  fixture.runtime.skip();
  assert.equal(fixture.events.filter(([kind]) => kind === "complete").length, 2);
});

test("reduced motion finishes sooner while preserving every approved narration cue", () => {
  const fixture = clockFixture({ reducedMotion: true });
  fixture.runtime.start();
  assert.equal(fixture.runtime.snapshot().motionEnabled, false);
  assert.equal(fixture.runtime.snapshot().playbackDurationSeconds, VOYAGE_REDUCED_MOTION_DURATION_SECONDS);
  fixture.advance(VOYAGE_REDUCED_MOTION_DURATION_SECONDS * 1000);
  assert.equal(fixture.runtime.snapshot().phase, "completed");
  assert.deepEqual(
    fixture.events
      .filter(([kind, cue]) => kind === "cue" && cue)
      .map(([, cue]) => cue),
    [
      "understanding-makes-reachable",
      "discovery-makes-coordinate",
      "map-has-no-word",
      "make-one"
    ]
  );
});

test("reduced-motion narration windows never cancel a line at the 105 WPM floor", () => {
  const fixture = clockFixture({ reducedMotion: true });
  fixture.runtime.start();
  fixture.advance(400);
  assert.equal(fixture.runtime.snapshot().narrationCue.id, "understanding-makes-reachable");
  fixture.advance(5_000);
  assert.equal(fixture.runtime.snapshot().narrationCue.id, "understanding-makes-reachable");
  fixture.advance(300);
  assert.equal(fixture.runtime.snapshot().narrationCue, null);
  fixture.advance(300);
  assert.equal(fixture.runtime.snapshot().narrationCue.id, "discovery-makes-coordinate");
  fixture.advance(5_700);
  assert.equal(fixture.runtime.snapshot().narrationCue.id, "discovery-makes-coordinate");
  fixture.advance(451);
  assert.equal(fixture.runtime.snapshot().narrationCue.id, "map-has-no-word");
  fixture.advance(7_500);
  assert.equal(fixture.runtime.snapshot().narrationCue, null);
  fixture.advance(600);
  assert.equal(fixture.runtime.snapshot().narrationCue.id, "make-one");
});

test("destroy cancels scheduling and makes lifecycle operations inert", () => {
  const fixture = clockFixture();
  fixture.runtime.start();
  fixture.advance(1500);
  const before = fixture.runtime.snapshot().timelineSeconds;
  assert.equal(fixture.runtime.destroy(), true);
  assert.equal(fixture.runtime.snapshot().phase, "destroyed");
  assert.equal(fixture.pendingFrames(), 0);
  fixture.advance(10_000);
  assert.equal(fixture.runtime.snapshot().timelineSeconds, before);
  assert.equal(fixture.runtime.resume(), false);
  assert.equal(fixture.runtime.replay(), false);
  assert.equal(fixture.runtime.skip(), null);
  assert.equal(fixture.runtime.destroy(), false);
});

test("scheduler failures enter fallback and report an immutable error snapshot", () => {
  const errors = [];
  const runtime = createVoyageProjectionRuntime({
    now: () => 0,
    requestFrame() { throw new Error("raf unavailable"); },
    onError: (error) => errors.push(error.message)
  });
  const started = runtime.start();
  assert.equal(started.phase, "fallback");
  assert.equal(started.fallbackReason, "frame-scheduler-failed");
  assert.deepEqual(errors, ["raf unavailable"]);
  assert.ok(Object.isFrozen(started.lastError));
});
