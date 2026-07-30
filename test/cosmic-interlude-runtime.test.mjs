import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  COSMIC_INTERLUDE_ENTER_EVENT,
  COSMIC_INTERLUDE_STORAGE_KEY,
  cosmicInterludeControlState,
  cosmicInterludeMemoryCountdown,
  requestCosmicInterludeEntry,
  sanitizeCosmicInterludeRuntimeRecord
} from "../public/cosmic-interlude-runtime.mjs";

class TestCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.cancelable = options.cancelable === true;
    this.detail = options.detail;
    this.defaultPrevented = false;
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
}

test("the interlude cadence record is bounded, local, and remembers variety", () => {
  assert.equal(COSMIC_INTERLUDE_STORAGE_KEY, "constellore-cosmic-interludes-v1");
  assert.deepEqual(
    sanitizeCosmicInterludeRuntimeRecord({
      seed: 72,
      lastSettledChallenge: 19,
      lastType: "star-trail",
      starTrailRounds: 2
    }),
    {
      version: 2,
      seed: 72,
      lastSettledChallenge: 19,
      lastType: "star-trail",
      starTrailRounds: 2
    }
  );
  assert.deepEqual(
    sanitizeCosmicInterludeRuntimeRecord({
      seed: -2,
      lastSettledChallenge: Number.POSITIVE_INFINITY,
      lastType: "ranked-mode",
      starTrailRounds: Number.POSITIVE_INFINITY
    }),
    {
      version: 2,
      seed: 1,
      lastSettledChallenge: 0,
      lastType: "",
      starTrailRounds: 0
    }
  );
});

test("the result hand-off is capture-phase, one-shot, optional, and fail-open", async () => {
  const [source, app, packageSource] = await Promise.all([
    readFile(new URL("../public/cosmic-interlude-runtime.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8")
  ]);
  const releaseVersion = JSON.parse(packageSource).version;
  assert.match(source, /listen\(elements\.retry,\s*"click",\s*onRetryCapture,\s*true\)/);
  assert.match(source, /elements\.retry\.dataset\.interludeWin/);
  assert.match(source, /bypassClick\s*=\s*true[\s\S]*elements\.retry\.click\(\)/);
  assert.match(source, /cosmicInterludeAction\(session\.state,\s*\{\s*type:\s*"skip"\s*\}\)/);
  assert.match(source, /requestCosmicInterludeEntry\(\{[\s\S]*type:\s*offer\.type,[\s\S]*start/);
  assert.match(source, /lastSettledChallenge[\s\S]*lastType/);
  assert.match(source, /completedStarTrails:\s*record[.]starTrailRounds/);
  assert.match(source, /starTrailRounds:\s*record[.]starTrailRounds\s*\+\s*\(session[.]state[?][.]type === "star-trail" \? 1 : 0\)/);
  assert.match(source, /loadOptionalStylesheet\(COSMIC_INTERLUDE_STYLESHEET,\s*document\)/);
  assert.match(source, /const stylesheet = await stylesReady;[\s\S]*if \(!stylesheet\)[\s\S]*failOpenOffer\(offer,\s*completedChallenges\)/);
  assert.ok(app.includes(`import "./cosmic-interlude-runtime.mjs?v=${releaseVersion}";`));
  assert.match(
    app,
    /interludeWin\s*=\s*won\s*&&\s*!assisted\s*&&\s*!partialAssist\s*&&\s*!progressionAlreadyGranted\s*&&\s*adaptiveRunEligible\(\)\s*\?\s*profile\.wins\s*:\s*""/,
    "only a newly rewarded clean personal win may offer a Star Break"
  );
});

test("a cancelled interlude-enter event hands one stable start callback to the gate owner", () => {
  let event = null;
  let starts = 0;
  const target = {
    dispatchEvent(candidate) {
      event = candidate;
      candidate.preventDefault();
      return false;
    }
  };

  const handled = requestCosmicInterludeEntry({
    target,
    EventConstructor: TestCustomEvent,
    type: "constellation-links",
    start: () => { starts += 1; }
  });

  assert.equal(handled, true);
  assert.equal(starts, 0);
  assert.equal(event.type, COSMIC_INTERLUDE_ENTER_EVENT);
  assert.equal(event.cancelable, true);
  assert.equal(event.detail.type, "constellation-links");
  const start = event.detail.start;
  assert.strictEqual(event.detail.start, start);
  assert.equal(start(), true);
  assert.equal(start(), false);
  assert.equal(starts, 1);
});

test("an unclaimed or undispatchable interlude entry starts immediately", () => {
  for (const target of [
    { dispatchEvent: () => true },
    { dispatchEvent: () => { throw new Error("dispatch unavailable"); } },
    null
  ]) {
    let starts = 0;
    const handled = requestCosmicInterludeEntry({
      target,
      EventConstructor: TestCustomEvent,
      type: "star-trail",
      start: () => { starts += 1; }
    });
    assert.equal(handled, false);
    assert.equal(starts, 1);
  }
});

test("the Star Break intro exposes one Start action before normal activity controls", () => {
  assert.deepEqual(cosmicInterludeControlState({
    introPending: true,
    status: "playing",
    completed: 0
  }), {
    intro: true,
    complete: false,
    memoryLocked: false,
    stageHidden: true,
    primaryHidden: false,
    primaryDisabled: false,
    primaryLabel: "Start",
    undoHidden: true,
    undoDisabled: true,
    skipHidden: true,
    skipDisabled: true
  });

  assert.deepEqual(cosmicInterludeControlState({
    status: "playing",
    completed: 1
  }), {
    intro: false,
    complete: false,
    memoryLocked: false,
    stageHidden: false,
    primaryHidden: true,
    primaryDisabled: true,
    primaryLabel: "Continue",
    undoHidden: false,
    undoDisabled: false,
    skipHidden: false,
    skipDisabled: false
  });

  assert.deepEqual(cosmicInterludeControlState({
    status: "complete",
    completed: 4
  }), {
    intro: false,
    complete: true,
    memoryLocked: false,
    stageHidden: false,
    primaryHidden: false,
    primaryDisabled: false,
    primaryLabel: "Continue",
    undoHidden: true,
    undoDisabled: true,
    skipHidden: true,
    skipDisabled: false
  });

  assert.deepEqual(cosmicInterludeControlState({
    memoryPhase: "preview",
    status: "playing",
    completed: 0
  }), {
    intro: false,
    complete: false,
    memoryLocked: true,
    stageHidden: false,
    primaryHidden: true,
    primaryDisabled: true,
    primaryLabel: "Continue",
    undoHidden: true,
    undoDisabled: true,
    skipHidden: false,
    skipDisabled: false
  });
});

test("the runtime keeps the activity inert until Start, then runs a locked five-second memory preview", async () => {
  const source = await readFile(
    new URL("../public/cosmic-interlude-runtime.mjs", import.meta.url),
    "utf8"
  );
  assert.match(source, /introPending:\s*true/);
  assert.match(source, /elements\.stage\.hidden\s*=\s*controls\.stageHidden/);
  assert.match(source, /elements\.stage\.toggleAttribute\?\.\("inert",\s*controls\.stageHidden\)/);
  assert.match(source, /primaryLabel\.textContent\s*=\s*controls\.primaryLabel/);
  assert.match(source, /elements\.skip\.disabled\s*=\s*controls\.skipDisabled/);
  assert.match(source, /const onPrimary\s*=\s*\(\)\s*=>[\s\S]*session\.introPending\s*=\s*false[\s\S]*startMemoryPreview\(\)[\s\S]*focusCurrentNode\(\)/);
  assert.match(source, /session[.]memoryStartedAt\s*=\s*now\(\)/);
  assert.match(source, /type:\s*"begin-recall"/);
  assert.match(source, /state[.]memory[?][.]phase !== "recall"/);
  assert.match(source, /listen\(elements\.primary,\s*"click",\s*onPrimary\)/);
  assert.match(source, /elements\.primary\.focus\?\.\(\)/);
});

test("the memory countdown stays locked until exactly 5000 milliseconds", () => {
  assert.deepEqual(cosmicInterludeMemoryCountdown({ startedAt: 100, now: 100 }), {
    locked: true,
    remainingMs: 5_000,
    seconds: 5
  });
  assert.deepEqual(cosmicInterludeMemoryCountdown({ startedAt: 100, now: 5_099 }), {
    locked: true,
    remainingMs: 1,
    seconds: 1
  });
  assert.deepEqual(cosmicInterludeMemoryCountdown({ startedAt: 100, now: 5_100 }), {
    locked: false,
    remainingMs: 0,
    seconds: 0
  });
  assert.deepEqual(cosmicInterludeMemoryCountdown({ startedAt: 100, now: 6_000 }), {
    locked: false,
    remainingMs: 0,
    seconds: 0
  });
});

test("the runtime provides pointer, keyboard, reduced-motion, and DPR paths", async () => {
  const source = await readFile(
    new URL("../public/cosmic-interlude-runtime.mjs", import.meta.url),
    "utf8"
  );
  assert.match(source, /"pointer-start"/);
  assert.match(source, /"pointer-move"/);
  assert.match(source, /"pointer-end"/);
  assert.match(source, /"activate-focused"/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /devicePixelRatio/);
  assert.match(source, /Math\.min\(2,/);
  assert.match(source, /drawPathSparks/);
});

test("completed interlude steps can be undone with a clear activity-specific label", async () => {
  const source = await readFile(
    new URL("../public/cosmic-interlude-runtime.mjs", import.meta.url),
    "utf8"
  );
  assert.match(source, /"cosmicInterludeUndo"/);
  assert.equal(cosmicInterludeControlState({ status: "playing", completed: 1 }).undoDisabled, false);
  assert.equal(cosmicInterludeControlState({ status: "playing", completed: 0 }).undoDisabled, true);
  assert.equal(cosmicInterludeControlState({ introPending: true, status: "playing", completed: 1 }).undoDisabled, true);
  assert.match(source, /"Undo star"\s*:\s*"Undo line"/);
  assert.match(source, /applyAction\(\{\s*type:\s*"undo"\s*\},\s*\{\s*focusNode:\s*true\s*\}\)/);
});
