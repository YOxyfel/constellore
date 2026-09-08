import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  VOYAGE_PLATE_CROSSFADE_MS,
  buildVoyageProjectionDom,
  createVoyagePlateTransitionController,
  createVoyageProjectionExperience,
  resolveVoyagePosterComposition,
  resolveVoyageProjectionDelivery
} from "../public/cinematic/voyage-projection-experience.mjs";
import {
  FIRST_OPEN_CINEMATIC_BYPASS_KEY,
  FIRST_OPEN_CINEMATIC_SESSION_KEY
} from "../public/cinematic/first-open-cinematic.mjs";

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }

  getItem(key) {
    return this.values.has(String(key)) ? this.values.get(String(key)) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

function fakeClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name)
  };
}

function connectTree(element, connected) {
  element.isConnected = connected;
  for (const child of element.children || []) connectTree(child, connected);
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.children = [];
    this.dataset = {};
    this.classList = fakeClassList();
    this.className = "";
    this.listeners = new Map();
    this.parentNode = null;
    this.isConnected = false;
    this.inert = false;
    this.hidden = false;
    this.textContent = "";
    this.style = {
      setProperty(name, value) { this[name] = String(value); }
    };
    this._innerHTML = "";
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
    const bold = this._innerHTML.match(/<b>(.*?)<\/b>/i);
    if (bold) {
      const child = new FakeElement("b", this.ownerDocument);
      child.textContent = bold[1];
      this.append(child);
    }
  }

  get innerHTML() { return this._innerHTML; }

  setAttribute(name, value) {
    const key = String(name);
    const stringValue = String(value);
    this.attributes.set(key, stringValue);
    if (key === "hidden") this.hidden = true;
    if (key.startsWith("data-")) {
      const datasetKey = key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[datasetKey] = stringValue;
    }
  }

  getAttribute(name) {
    return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null;
  }

  hasAttribute(name) { return this.attributes.has(String(name)); }

  removeAttribute(name) {
    const key = String(name);
    this.attributes.delete(key);
    if (key === "hidden") this.hidden = false;
  }

  toggleAttribute(name, force) {
    const enabled = force === undefined ? !this.hasAttribute(name) : Boolean(force);
    if (enabled) this.setAttribute(name, "");
    else this.removeAttribute(name);
    return enabled;
  }

  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      connectTree(child, this.isConnected);
      this.children.push(child);
      this.ownerDocument?._didAppend?.(this, child);
    }
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    }
    this.parentNode = null;
    connectTree(this, false);
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }

  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }

  dispatch(type, event = {}) {
    for (const callback of [...(this.listeners.get(type) || [])]) {
      callback({ type, target: this, preventDefault() {}, ...event });
    }
  }

  focus() { this.ownerDocument.activeElement = this; }

  querySelector(selector) {
    const attribute = String(selector).match(/^\[([^\]]+)\]$/)?.[1];
    for (const child of this.children) {
      if (String(selector).toUpperCase() === child.tagName || (attribute && child.hasAttribute(attribute))) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  getBoundingClientRect() { return { width: 1280, height: 720 }; }

  getContext(kind) {
    if (this.tagName !== "CANVAS") return null;
    if (kind === "webgl2" && this.ownerDocument.webgl2) return {};
    if (kind === "2d") {
      if (!this._context2d) {
        this._context2d = {
          drawCalls: [],
          clearRect() {},
          drawImage: (...args) => { this._context2d.drawCalls.push(args); }
        };
      }
      return this._context2d;
    }
    return null;
  }
}

class FakeDocument {
  constructor({ reducedMotion = false, saveData = false, webgl2 = false, styleOutcome = "load" } = {}) {
    this.listeners = new Map();
    this.activeElement = null;
    this.hidden = false;
    this.visibilityState = "visible";
    this.webgl2 = webgl2;
    this.styleOutcome = styleOutcome;
    this.speech = {
      spoken: [],
      cancelCalls: 0,
      getVoices: () => [{ name: "Aria Natural", lang: "en-GB" }],
      cancel: () => { this.speech.cancelCalls += 1; },
      speak: (utterance) => { this.speech.spoken.push(utterance.text); }
    };
    const documentRef = this;
    this.defaultView = {
      innerWidth: 1280,
      innerHeight: 720,
      navigator: {
        connection: { saveData },
        deviceMemory: 8,
        hardwareConcurrency: 8
      },
      performance: { now: () => Date.now() },
      speechSynthesis: this.speech,
      SpeechSynthesisUtterance: class {
        constructor(text) { this.text = text; }
      },
      matchMedia(query) {
        return {
          matches: String(query).includes("prefers-reduced-motion") ? reducedMotion : false
        };
      },
      setTimeout,
      clearTimeout,
      get document() { return documentRef; }
    };
    this.head = new FakeElement("head", this);
    this.body = new FakeElement("body", this);
    connectTree(this.head, true);
    connectTree(this.body, true);
  }

  createElement(tagName) { return new FakeElement(tagName, this); }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }

  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }

  dispatch(type, event = {}) {
    for (const callback of [...(this.listeners.get(type) || [])]) callback({ type, ...event });
  }

  querySelector(selector) {
    return this.head.querySelector(selector) || this.body.querySelector(selector);
  }

  setVisibility(hidden) {
    this.hidden = Boolean(hidden);
    this.visibilityState = hidden ? "hidden" : "visible";
    this.dispatch("visibilitychange");
  }

  _didAppend(parent, child) {
    if (parent !== this.head || child.tagName !== "LINK" || this.styleOutcome === "none") return;
    queueMicrotask(() => child.dispatch(this.styleOutcome));
  }
}

class ControlledTimers {
  constructor() {
    this.clock = 0;
    this.nextId = 1;
    this.long = new Map();
  }

  setTimeout(callback, milliseconds) {
    const id = this.nextId++;
    const duration = Number(milliseconds) || 0;
    if (duration < 5_000) {
      queueMicrotask(() => {
        this.clock += duration;
        callback();
      });
    } else {
      this.long.set(id, { callback, duration });
    }
    return id;
  }

  clearTimeout(id) { this.long.delete(id); }

  now = () => this.clock;

  fireLong() {
    const entry = [...this.long.entries()].sort((left, right) => right[1].duration - left[1].duration)[0];
    if (!entry) return false;
    this.long.delete(entry[0]);
    this.clock += entry[1].duration;
    entry[1].callback();
    return true;
  }
}

function runtimeHarness({ completion = "natural" } = {}) {
  let resolveStarted;
  const capture = {
    options: null,
    skipCalls: 0,
    pauseReasons: [],
    destroyed: false,
    cue: null,
    started: new Promise((resolve) => { resolveStarted = resolve; })
  };
  const factory = (options) => {
    capture.options = options;
    const natural = {
      skipped: false,
      completionReason: "natural",
      progressionEffect: null
    };
    const skipped = {
      skipped: true,
      completionReason: "skip",
      progressionEffect: null
    };
    return {
      start() {
        resolveStarted();
        if (completion === "natural") options.onCompletion(natural);
        if (completion === "fallback") options.onFallback({ reason: "scheduler-failed" });
        return { phase: completion === "hang" ? "running" : "completed" };
      },
      skip() {
        capture.skipCalls += 1;
        options.onCompletion(skipped);
        return skipped;
      },
      pause(reason) { capture.pauseReasons.push(reason); return true; },
      snapshot() { return { narrationCue: capture.cue, progressionEffect: null }; },
      destroy() { capture.destroyed = true; }
    };
  };
  return { capture, factory };
}

function appendFocusableApp(documentRef, { ariaHidden = null, inert = false } = {}) {
  const app = documentRef.createElement("main");
  app.inert = inert;
  if (inert) app.setAttribute("inert", "");
  if (ariaHidden !== null) app.setAttribute("aria-hidden", ariaHidden);
  documentRef.body.append(app);
  app.focus();
  return app;
}

test("Voyage Projection delivery honors explicit video and poster choices", () => {
  assert.equal(resolveVoyageProjectionDelivery({ choice: "video" }).delivery, "video");
  assert.equal(resolveVoyageProjectionDelivery({ choice: "master" }).delivery, "video");
  assert.equal(resolveVoyageProjectionDelivery({ choice: "poster" }).delivery, "poster");
  assert.equal(resolveVoyageProjectionDelivery({ choice: "static" }).delivery, "poster");
});

test("an approved mastered video plays inside the projection shell and completes through the same handoff", async () => {
  const documentRef = new FakeDocument({ webgl2: true });
  const timers = new ControlledTimers();
  const storage = new MemoryStorage();
  let handoffs = 0;
  const media = Object.freeze({
    variant: "promise",
    mp4: "./opening.mp4",
    webm: "./opening.webm",
    captions: "./opening.en.vtt",
    poster: "./opening.webp",
    masterSha256: "a".repeat(64),
    mp4Sha256: "b".repeat(64),
    webmSha256: "c".repeat(64),
    posterSha256: "d".repeat(64),
    captionsSha256: "e".repeat(64),
    approval: Object.freeze({
      manifest: Object.freeze({
        reviewer: "Release Reviewer",
        approvedAt: "2026-08-06T12:00:00Z",
        evidencePath: "production/voyage-projection/approvals/release.json"
      }),
      variant: Object.freeze({
        reviewer: "Promise Reviewer",
        approvedAt: "2026-08-06T12:00:00Z",
        evidencePath: "production/voyage-projection/approvals/promise.json"
      })
    }),
    durationSeconds: 57,
    frameCount: 1368,
    fps: 24
  });
  const experience = createVoyageProjectionExperience({
    documentRef,
    storage,
    sessionStorage: new MemoryStorage(),
    choice: "video",
    mediaLoader: async () => media,
    timers,
    now: timers.now,
    onHandoff: () => { handoffs += 1; }
  });
  const playback = experience.playLaunch();
  await new Promise((resolve) => setImmediate(resolve));
  const shell = documentRef.body.children.find((child) => child.dataset?.voyageProjection !== undefined);
  const video = shell?.querySelector("video");
  assert.ok(video);
  assert.equal(shell.dataset.delivery, "video");
  assert.equal(video.dataset.approvedMaster, "true");
  assert.equal(video.children.filter((child) => child.tagName === "TRACK").length, 1);
  video.dispatch("ended");
  const outcome = await playback;
  assert.equal(outcome.completed, true);
  assert.equal(outcome.delivery, "video");
  assert.equal(handoffs, 1);
});

test("realtime remains available under reduced motion as narrated still plates", () => {
  assert.deepEqual(resolveVoyageProjectionDelivery({
    choice: "realtime",
    reducedMotion: true,
    webgl2: true
  }), {
    requested: "realtime",
    delivery: "realtime",
    reason: "reduced-motion-plates"
  });
});

test("save-data and missing WebGL2 select the accessible poster fallback", () => {
  assert.equal(resolveVoyageProjectionDelivery({ choice: "realtime", saveData: true }).reason, "save-data");
  assert.equal(resolveVoyageProjectionDelivery({ choice: "realtime", webgl2: false }).reason, "webgl2-unavailable");
});

test("projection DOM exposes a modal, live progress, captions, and independent narration control", () => {
  const documentRef = new FakeDocument();
  const dom = buildVoyageProjectionDom(documentRef);
  assert.equal(dom.root.getAttribute("role"), "dialog");
  assert.equal(dom.root.getAttribute("aria-modal"), "true");
  assert.equal(dom.progress.getAttribute("role"), "progressbar");
  assert.equal(dom.caption.getAttribute("aria-live"), "polite");
  assert.equal(dom.sound.getAttribute("aria-pressed"), "true");
  assert.equal(dom.skip.getAttribute("aria-label"), "Skip voyage projection");
  assert.equal(dom.poster.dataset.shot, "earth");
  assert.equal(dom.posterEcho.dataset.active, "false");
  assert.equal(dom.plateSnapshot.dataset.active, "false");
});

test("poster composition follows authored shot, variant, and confirmed world facts", () => {
  assert.deepEqual(resolveVoyagePosterComposition({
    shotId: "RETURN",
    variant: "progress",
    currentWorldId: "Moon"
  }), {
    shotId: "return",
    variant: "progress",
    currentWorldId: "moon"
  });
  assert.deepEqual(resolveVoyagePosterComposition({
    shotId: "invented-shot",
    variant: "invented-variant",
    currentWorldId: ""
  }), {
    shotId: "earth",
    variant: "promise",
    currentWorldId: "earth"
  });
});

test("reduced-motion shot changes crossfade a captured plate within the 180ms cap", () => {
  const documentRef = new FakeDocument();
  const dom = buildVoyageProjectionDom(documentRef);
  dom.canvas.width = 1280;
  dom.canvas.height = 720;
  const frames = new Map();
  const timeouts = new Map();
  let nextHandle = 1;
  const timers = {
    setTimeout(callback, milliseconds) {
      const handle = nextHandle++;
      timeouts.set(handle, { callback, milliseconds });
      return handle;
    },
    clearTimeout(handle) { timeouts.delete(handle); }
  };
  const controller = createVoyagePlateTransitionController({
    root: dom.root,
    canvas: dom.canvas,
    poster: dom.poster,
    posterEcho: dom.posterEcho,
    plateSnapshot: dom.plateSnapshot,
    reducedMotion: true,
    timers,
    requestFrame(callback) {
      const handle = nextHandle++;
      frames.set(handle, callback);
      return handle;
    },
    cancelFrame(handle) { frames.delete(handle); }
  });

  controller.setInitial({ shotId: "earth", variant: "progress", currentWorldId: "moon" });
  controller.transitionTo({ shotId: "solar", variant: "progress", currentWorldId: "moon" });
  assert.equal(dom.root.dataset.shot, "solar");
  assert.equal(dom.poster.dataset.shot, "solar");
  assert.equal(dom.posterEcho.dataset.shot, "earth");
  assert.equal(dom.posterEcho.dataset.currentWorld, "moon");
  assert.equal(dom.posterEcho.dataset.active, "true");
  assert.equal(dom.plateSnapshot.dataset.active, "true");
  assert.equal(dom.root.dataset.plateTransition, "primed");
  assert.equal(dom.plateSnapshot._context2d.drawCalls.length, 1);

  [...frames.values()][0]();
  frames.clear();
  assert.equal(dom.root.dataset.plateTransition, "fading");
  const finish = [...timeouts.values()][0];
  assert.equal(finish.milliseconds, VOYAGE_PLATE_CROSSFADE_MS);
  assert.ok(VOYAGE_PLATE_CROSSFADE_MS <= 180);
  finish.callback();
  assert.equal(dom.root.dataset.plateTransition, "idle");
  assert.equal(dom.posterEcho.dataset.active, "false");
  assert.equal(dom.plateSnapshot.dataset.active, "false");
});

test("reduced-motion poster fallback still dissolves when WebGL capture is unavailable", () => {
  const documentRef = new FakeDocument();
  const dom = buildVoyageProjectionDom(documentRef);
  dom.canvas.width = 1280;
  dom.canvas.height = 720;
  dom.plateSnapshot.getContext = () => null;
  const frames = [];
  const controller = createVoyagePlateTransitionController({
    root: dom.root,
    canvas: dom.canvas,
    poster: dom.poster,
    posterEcho: dom.posterEcho,
    plateSnapshot: dom.plateSnapshot,
    reducedMotion: true,
    timers: { setTimeout: () => 1, clearTimeout() {} },
    requestFrame(callback) { frames.push(callback); return frames.length; },
    cancelFrame() {}
  });
  controller.setInitial({ shotId: "black-hole", variant: "promise", currentWorldId: "earth" });
  controller.transitionTo({ shotId: "singularity", variant: "promise", currentWorldId: "earth" });
  assert.equal(dom.posterEcho.dataset.shot, "black-hole");
  assert.equal(dom.posterEcho.dataset.active, "true");
  assert.equal(dom.plateSnapshot.dataset.active, "false");
  assert.equal(controller.snapshot().phase, "primed");
});

test("normal-motion shot changes remain direct and do not add an overlay transition", () => {
  const documentRef = new FakeDocument();
  const dom = buildVoyageProjectionDom(documentRef);
  let frameCalls = 0;
  const controller = createVoyagePlateTransitionController({
    root: dom.root,
    canvas: dom.canvas,
    poster: dom.poster,
    posterEcho: dom.posterEcho,
    plateSnapshot: dom.plateSnapshot,
    reducedMotion: false,
    requestFrame() { frameCalls += 1; return 1; }
  });
  controller.setInitial({ shotId: "earth" });
  controller.transitionTo({ shotId: "warp" });
  assert.equal(dom.root.dataset.shot, "warp");
  assert.equal(dom.root.dataset.plateTransition, "idle");
  assert.equal(dom.posterEcho.dataset.active, "false");
  assert.equal(frameCalls, 0);
});

test("fallback stylesheet authors every Voyage plate and preserves the bounded reduced-motion dissolve", () => {
  const css = readFileSync(new URL("../public/cinematic/voyage-projection-experience.css", import.meta.url), "utf8");
  for (const shotId of ["earth", "solar", "heliopause", "warp", "black-hole", "singularity", "return", "beyond"]) {
    assert.match(css, new RegExp(`data-shot=["']${shotId}["']`));
  }
  assert.match(css, /data-current-world=["']moon["']/);
  assert.match(css, /data-variant=["']completion["']/);
  assert.match(css, /voyage-projection__poster--echo[\s\S]*transition:\s*opacity\s+160ms\s+linear/);
  assert.match(css, /prefers-reduced-motion[\s\S]*voyage-projection__plate-snapshot[\s\S]*160ms\s+linear/);
});

test("bypass and session replay gates hand off without constructing presentation state", async () => {
  for (const initial of [
    { [FIRST_OPEN_CINEMATIC_BYPASS_KEY]: "true" },
    { [FIRST_OPEN_CINEMATIC_SESSION_KEY]: "played" }
  ]) {
    const documentRef = new FakeDocument();
    const session = new MemoryStorage(initial);
    let runtimeCalls = 0;
    let handoffs = 0;
    const experience = createVoyageProjectionExperience({
      documentRef,
      sessionStorage: session,
      storage: new MemoryStorage(),
      runtimeFactory() { runtimeCalls += 1; throw new Error("must not run"); },
      onHandoff() { handoffs += 1; }
    });
    const outcome = await experience.playLaunch();
    assert.equal(outcome.reason, initial[FIRST_OPEN_CINEMATIC_BYPASS_KEY] ? "bypassed" : "session-played");
    assert.equal(outcome.handled, true);
    assert.equal(outcome.played, false);
    assert.equal(handoffs, 1);
    assert.equal(runtimeCalls, 0);
    assert.equal(documentRef.body.children.length, 0);
  }
});

test("natural completion is atomic, restores focus and inert state, and never emits an arrival", async () => {
  const documentRef = new FakeDocument();
  const original = appendFocusableApp(documentRef, { ariaHidden: "menu-state" });
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const timers = new ControlledTimers();
  const { capture, factory } = runtimeHarness();
  let handoffs = 0;
  const experience = createVoyageProjectionExperience({
    documentRef,
    storage: local,
    sessionStorage: session,
    choice: "poster",
    runtimeFactory: factory,
    timers,
    now: timers.now,
    onHandoff() { handoffs += 1; }
  });

  const outcome = await experience.playLaunch();
  assert.equal(outcome.reason, "completed");
  assert.equal(outcome.completed, true);
  assert.equal(outcome.persisted, true);
  assert.equal(outcome.progressionEffect, null);
  assert.equal(experience.hasCompleted(), true);
  assert.equal(session.getItem(FIRST_OPEN_CINEMATIC_SESSION_KEY), "played");
  assert.equal(capture.options.arrivalWorldId, null);
  assert.equal("onArrivalIntent" in capture.options, false);
  assert.equal(capture.destroyed, true);
  assert.equal(handoffs, 1);
  assert.equal(original.inert, false);
  assert.equal(original.hasAttribute("inert"), false);
  assert.equal(original.getAttribute("aria-hidden"), "menu-state");
  assert.equal(documentRef.activeElement, original);
  assert.equal(documentRef.body.classList.contains("voyage-projection-active"), false);
  assert.equal(documentRef.querySelector("[data-voyage-projection]"), null);
});

test("a Settings replay can project confirmed Moon progress while keeping Mars locked", async () => {
  const documentRef = new FakeDocument({ webgl2: true });
  appendFocusableApp(documentRef);
  const timers = new ControlledTimers();
  const { capture, factory } = runtimeHarness({ completion: "hang" });
  const syncCalls = [];
  const scene = {
    async prepare() { return { phase: "ready" }; },
    snapshot() { return { phase: "ready" }; },
    sync(value) { syncCalls.push(value); },
    resize() {},
    suspend() {},
    resume() {},
    destroy() {}
  };
  const experience = createVoyageProjectionExperience({
    documentRef,
    storage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    variant: "progress",
    currentWorldId: "moon",
    completedWorldIds: ["earth"],
    actionableWorldIds: ["moon"],
    runtimeFactory: factory,
    sceneFactory: () => scene,
    loadThree: async () => ({ Scene: class {} }),
    timers,
    now: timers.now,
    onHandoff() {}
  });

  const pending = experience.playLaunch({ force: true, persist: false });
  await capture.started;
  const root = documentRef.querySelector("[data-voyage-projection]");
  assert.equal(root.dataset.variant, "progress");
  assert.equal(root.dataset.currentWorld, "moon");
  assert.equal(capture.options.variant, "progress");

  capture.options.onProgress({ progress: 0.25, timelineSeconds: 14 });
  const presentation = syncCalls.at(-1).worldPresentation;
  assert.equal(presentation.currentWorldId, "moon");
  assert.equal(presentation.worlds.find((world) => world.worldId === "earth").status, "completed");
  const mars = presentation.worlds.find((world) => world.worldId === "mars");
  assert.equal(mars.status, "locked");
  assert.equal(mars.actionable, false);
  assert.equal(mars.action, null);

  experience.skip();
  const outcome = await pending;
  assert.equal(outcome.progressionEffect, null);
});

test("Skip remains externally reachable and cannot be overwritten by the runtime completion callback", async () => {
  const documentRef = new FakeDocument();
  appendFocusableApp(documentRef);
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const timers = new ControlledTimers();
  const { capture, factory } = runtimeHarness({ completion: "hang" });
  const experience = createVoyageProjectionExperience({
    documentRef,
    storage: local,
    sessionStorage: session,
    choice: "poster",
    runtimeFactory: factory,
    timers,
    now: timers.now,
    onHandoff() {}
  });

  const pending = experience.playLaunch();
  await capture.started;
  assert.equal(experience.active, true);
  assert.equal(experience.skip(), true);
  const outcome = await pending;
  assert.equal(outcome.reason, "skipped");
  assert.equal(outcome.skipped, true);
  assert.equal(outcome.persisted, true);
  assert.equal(capture.skipCalls, 1);
  assert.equal(experience.skip(), false);
});

test("watchdog timeout never masquerades as Skip or persists first-open completion", async () => {
  const documentRef = new FakeDocument();
  appendFocusableApp(documentRef);
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const timers = new ControlledTimers();
  const { capture, factory } = runtimeHarness({ completion: "hang" });
  const experience = createVoyageProjectionExperience({
    documentRef,
    storage: local,
    sessionStorage: session,
    choice: "poster",
    runtimeFactory: factory,
    timers,
    now: timers.now,
    onHandoff() {}
  });

  const pending = experience.playLaunch();
  await capture.started;
  assert.equal(timers.fireLong(), true);
  const outcome = await pending;
  assert.equal(outcome.reason, "timeout");
  assert.equal(outcome.completed, false);
  assert.equal(outcome.skipped, false);
  assert.equal(outcome.persisted, false);
  assert.equal(capture.skipCalls, 0);
  assert.equal(capture.pauseReasons.includes("timeout"), true);
  assert.equal(experience.hasCompleted(), false);
  assert.equal(session.getItem(FIRST_OPEN_CINEMATIC_SESSION_KEY), null);
});

test("stylesheet failure keeps a bounded critical presentation and still completes", async () => {
  const documentRef = new FakeDocument({ styleOutcome: "error" });
  const timers = new ControlledTimers();
  const { factory } = runtimeHarness();
  const events = [];
  const experience = createVoyageProjectionExperience({
    documentRef,
    storage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    choice: "poster",
    runtimeFactory: factory,
    timers,
    now: timers.now,
    onHandoff() {},
    onEvent(event) { events.push(event); }
  });
  const outcome = await experience.playLaunch();
  assert.equal(outcome.reason, "completed");
  assert.equal(outcome.styleState, "error");
  assert.equal(events.some((event) => event.type === "style-fallback" && event.reason === "error"), true);
  assert.equal(documentRef.querySelector("[data-voyage-projection]"), null);
});

test("Three failure degrades to poster while no-WebGL delivery never loads Three", async () => {
  {
    const documentRef = new FakeDocument({ webgl2: true });
    const timers = new ControlledTimers();
    const { factory } = runtimeHarness();
    const events = [];
    let loadCalls = 0;
    const experience = createVoyageProjectionExperience({
      documentRef,
      storage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
      runtimeFactory: factory,
      timers,
      now: timers.now,
      loadThree: async () => { loadCalls += 1; throw new Error("missing vendor"); },
      onHandoff() {},
      onEvent(event) { events.push(event); }
    });
    const outcome = await experience.playLaunch();
    assert.equal(loadCalls, 1);
    assert.equal(outcome.delivery, "poster");
    assert.equal(events.some((event) => event.type === "scene-fallback"), true);
  }
  {
    const documentRef = new FakeDocument({ webgl2: false });
    const timers = new ControlledTimers();
    const { factory } = runtimeHarness();
    let loadCalls = 0;
    const experience = createVoyageProjectionExperience({
      documentRef,
      storage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
      runtimeFactory: factory,
      timers,
      now: timers.now,
      loadThree: async () => { loadCalls += 1; return {}; },
      onHandoff() {}
    });
    const outcome = await experience.playLaunch();
    assert.equal(outcome.delivery, "poster");
    assert.equal(loadCalls, 0);
  }
});

test("Skip does not wait for a stalled Three import or scene preparation", async () => {
  const documentRef = new FakeDocument({ webgl2: true });
  appendFocusableApp(documentRef);
  const timers = new ControlledTimers();
  const experience = createVoyageProjectionExperience({
    documentRef,
    storage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    loadThree: () => new Promise(() => {}),
    runtimeFactory() { throw new Error("runtime must not start after early Skip"); },
    timers,
    now: timers.now,
    onHandoff() {}
  });
  const pending = experience.playLaunch();
  while (!documentRef.querySelector("[data-voyage-projection]")) await Promise.resolve();
  assert.equal(experience.skip(), true);
  const outcome = await pending;
  assert.equal(outcome.reason, "skipped");
  assert.equal(outcome.completed, true);
});

test("narration toggle and page visibility suspend optional media without losing completion control", async () => {
  const documentRef = new FakeDocument({ webgl2: true });
  appendFocusableApp(documentRef);
  const timers = new ControlledTimers();
  const { capture, factory } = runtimeHarness({ completion: "hang" });
  const sceneCalls = { suspended: [], resumed: [], destroyed: 0 };
  const scene = {
    async prepare() { return { phase: "ready" }; },
    snapshot() { return { phase: "ready" }; },
    sync() {},
    resize() {},
    suspend(reason) { sceneCalls.suspended.push(reason); },
    resume(reason) { sceneCalls.resumed.push(reason); },
    destroy() { sceneCalls.destroyed += 1; }
  };
  const experience = createVoyageProjectionExperience({
    documentRef,
    storage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    runtimeFactory: factory,
    sceneFactory: () => scene,
    loadThree: async () => ({ Scene: class {} }),
    timers,
    now: timers.now,
    onHandoff() {}
  });

  const pending = experience.playLaunch();
  await capture.started;
  const root = documentRef.querySelector("[data-voyage-projection]");
  const sound = root.querySelector("B").parentNode;
  const firstCue = { id: "one", text: "First coordinate." };
  capture.cue = firstCue;
  capture.options.onNarrationCue(firstCue);
  assert.deepEqual(documentRef.speech.spoken, ["First coordinate."]);

  sound.dispatch("click");
  assert.equal(sound.getAttribute("aria-pressed"), "false");
  capture.options.onNarrationCue({ id: "two", text: "Muted coordinate." });
  assert.deepEqual(documentRef.speech.spoken, ["First coordinate."]);
  sound.dispatch("click");
  capture.cue = { id: "three", text: "Visible coordinate." };
  capture.options.onNarrationCue(capture.cue);
  assert.equal(documentRef.speech.spoken.at(-1), "Visible coordinate.");

  assert.equal(timers.long.size, 1);
  documentRef.setVisibility(true);
  assert.equal(sceneCalls.suspended.includes("visibility"), true);
  assert.equal(timers.long.size, 0);
  documentRef.setVisibility(false);
  assert.equal(sceneCalls.resumed.includes("visibility"), true);
  assert.equal(documentRef.speech.spoken.at(-1), "Visible coordinate.");
  assert.equal(timers.long.size, 1);

  experience.skip();
  await pending;
  assert.equal(sceneCalls.destroyed, 1);
});

test("runtime construction failure restores Home, clears the owned session gate, and never rejects startup", async () => {
  const documentRef = new FakeDocument();
  const original = appendFocusableApp(documentRef, { inert: true, ariaHidden: "before" });
  const session = new MemoryStorage();
  const timers = new ControlledTimers();
  let handoffs = 0;
  const experience = createVoyageProjectionExperience({
    documentRef,
    storage: new MemoryStorage(),
    sessionStorage: session,
    choice: "poster",
    runtimeFactory() { throw new Error("runtime unavailable"); },
    timers,
    now: timers.now,
    onHandoff() { handoffs += 1; }
  });

  const outcome = await experience.playLaunch();
  assert.equal(outcome.reason, "failed");
  assert.equal(outcome.completed, false);
  assert.equal(handoffs, 1);
  assert.equal(session.getItem(FIRST_OPEN_CINEMATIC_SESSION_KEY), null);
  assert.equal(original.inert, true);
  assert.equal(original.hasAttribute("inert"), true);
  assert.equal(original.getAttribute("aria-hidden"), "before");
  assert.equal(documentRef.activeElement, original);
  assert.equal(documentRef.querySelector("[data-voyage-projection]"), null);
});
