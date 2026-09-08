import assert from "node:assert/strict";
import test from "node:test";

import { createPlanetHubAudioDirector } from "../public/planet-hub-audio.mjs";
import { createPlanetHubAppBridge } from "../public/planet-hub-app.mjs";

class FakeParam {
  constructor(value = 0) { this.value = value; this.events = []; }
  cancelScheduledValues(at) { this.events.push(["cancel", at]); }
  setValueAtTime(value, at) { this.value = value; this.events.push(["set", value, at]); }
  linearRampToValueAtTime(value, at) { this.value = value; this.events.push(["linear", value, at]); }
  exponentialRampToValueAtTime(value, at) { this.value = value; this.events.push(["exponential", value, at]); }
}

class FakeNode {
  constructor() {
    this.connections = [];
    this.listeners = new Map();
    this.dataset = {};
    this.hidden = false;
  }
  connect(target) { this.connections.push(target); return target; }
  disconnect() { this.disconnected = true; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, event = {}) { for (const listener of this.listeners.get(type) || []) listener({ type, target: this, ...event }); }
  getAttribute() { return null; }
  setAttribute() {}
}

class FakeSource extends FakeNode {
  constructor() {
    super();
    this.frequency = new FakeParam();
    this.detune = new FakeParam();
    this.started = [];
    this.stopped = [];
  }
  start(...args) { this.started.push(args); }
  stop(...args) { this.stopped.push(args); }
}

class FakeContext {
  constructor() { this.currentTime = 2; this.sources = []; this.gains = []; }
  createGain() { const node = new FakeNode(); node.gain = new FakeParam(1); this.gains.push(node); return node; }
  createOscillator() { const source = new FakeSource(); this.sources.push(source); return source; }
  createBiquadFilter() {
    const node = new FakeNode();
    node.frequency = new FakeParam();
    node.Q = new FakeParam();
    return node;
  }
  createStereoPanner() { const node = new FakeNode(); node.pan = new FakeParam(); return node; }
}

function createHarness({ cuePlayers = {} } = {}) {
  const context = new FakeContext();
  const documentRef = new FakeNode();
  const root = new FakeNode();
  root.ownerDocument = documentRef;
  documentRef.hidden = false;
  documentRef.defaultView = { CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } } };
  documentRef.querySelector = () => root;
  const channels = [];
  const audioRuntime = {
    primeCalls: 0,
    prime() { this.primeCalls += 1; return context; },
    createAuxiliaryChannel({ kind, level }) {
      const input = context.createGain();
      const channel = {
        context,
        input,
        kind,
        level,
        closed: false,
        levels: [level],
        setLevel(value) { this.level = value; this.levels.push(value); return value; },
        sync() { return this.level; },
        close() { if (this.closed) return false; this.closed = true; return true; }
      };
      channels.push(channel);
      return channel;
    }
  };
  const timers = [];
  const setTimeoutRef = (callback, delay) => {
    const token = { callback, delay, cleared: false };
    timers.push(token);
    return token;
  };
  const clearTimeoutRef = (token) => { if (token) token.cleared = true; };
  const flushTimers = () => {
    for (const timer of [...timers].sort((left, right) => left.delay - right.delay)) {
      if (!timer.cleared) {
        timer.cleared = true;
        timer.callback();
      }
    }
  };
  const director = createPlanetHubAudioDirector({
    documentRef,
    root,
    audioRuntime,
    cuePlayers,
    setTimeoutRef,
    clearTimeoutRef
  });
  return { audioRuntime, channels, context, director, documentRef, flushTimers, root, timers };
}

test("the hub audio graph stays lazy until a gesture and crossfades semantic destination stems", () => {
  const harness = createHarness();
  harness.director.sync({ activeDestination: "journey" });
  assert.equal(harness.audioRuntime.primeCalls, 0);
  assert.equal(harness.context.sources.length, 0);

  harness.documentRef.dispatch("pointerdown");
  assert.equal(harness.audioRuntime.primeCalls, 1);
  assert.equal(harness.channels.length, 2);
  assert.equal(harness.context.sources.length, 8, "two bed oscillators plus two tones per destination remain sample-free");
  assert.equal(harness.director.snapshot().destination, "journey");
  assert.equal(harness.director.snapshot().primed, true);
  assert.ok(harness.context.gains.some((gain) => gain.gain.value === 1), "the Journey stem becomes the only raised destination group");

  harness.director.sync({ activeDestination: "arena" });
  harness.flushTimers();
  assert.ok(harness.context.sources.length > 8, "settle, portal and thunder cues are synthesized after the visual transition");
  harness.director.destroy();
  assert.ok(harness.channels.every((channel) => channel.closed));
  assert.ok(harness.context.sources.slice(0, 8).every((source) => source.stopped.length > 0));
});

test("suspension silences both channels while reduced motion retains audio and authored cues can replace placeholders", () => {
  let replacements = 0;
  const harness = createHarness({
    cuePlayers: {
      "arena-thunder": () => { replacements += 1; return true; }
    }
  });
  harness.documentRef.dispatch("keydown", { key: "Enter" });
  const sourceCount = harness.context.sources.length;
  assert.equal(harness.director.setReducedMotion(true), true);
  assert.equal(harness.director.snapshot().suspended, false, "reduced motion never mutes the soundscape");
  assert.equal(harness.director.cue("arena-thunder"), true);
  assert.equal(replacements, 1);
  assert.equal(harness.context.sources.length, sourceCount, "the authored replacement bypasses the procedural thunder voice");

  harness.director.suspend("dialog");
  assert.equal(harness.director.snapshot().suspended, true);
  assert.ok(harness.channels.every((channel) => channel.level === 0));
  assert.equal(harness.director.cue("forge-chime"), false);
  harness.director.resume("dialog");
  assert.equal(harness.director.snapshot().suspended, false);
  assert.ok(harness.channels.every((channel) => channel.level > 0));

  harness.documentRef.hidden = true;
  harness.documentRef.dispatch("visibilitychange");
  assert.equal(harness.director.snapshot().suspended, true);
  harness.documentRef.hidden = false;
  harness.documentRef.dispatch("visibilitychange");
  assert.equal(harness.director.snapshot().suspended, false);
  harness.director.destroy();
});

test("the app bridge mirrors renderer lifecycle and forwards runtime semantic cues to the audio director", async () => {
  const stage = new FakeNode();
  const home = new FakeNode();
  const poster = new FakeNode();
  const startScreen = new FakeNode();
  const audioCalls = [];
  let runtimeOptions = null;
  class FakeMutationObserver { observe() {} disconnect() {} }
  const audioDirector = {
    sync(value) { audioCalls.push(["sync", value.activeDestination]); },
    suspend(reason) { audioCalls.push(["suspend", reason]); },
    resume(reason) { audioCalls.push(["resume", reason]); },
    setReducedMotion(value) { audioCalls.push(["motion", value]); },
    cue(cue, detail) { audioCalls.push(["cue", cue, detail.direction]); },
    destroy() { audioCalls.push(["destroy"]); }
  };
  const fakeHub = {
    sync() {}, prepare() {}, suspend() {}, resume() {}, setReducedMotion() {}, destroy() {}
  };
  const documentRef = {
    hidden: false,
    body: new FakeNode(),
    documentElement: new FakeNode(),
    defaultView: {
      MutationObserver: FakeMutationObserver,
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
    },
    querySelector(selector) {
      if (selector === "[data-planet-hub]") return stage;
      if (selector === "[data-planet-hub-poster]") return poster;
      return null;
    },
    getElementById(id) {
      if (id === "homePlaySplit") return home;
      if (id === "startScreen") return startScreen;
      return null;
    }
  };
  const bridge = createPlanetHubAppBridge({
    documentRef,
    audioDirector,
    getSnapshot: () => ({ activeDestination: "journey", availableDestinations: ["forge", "journey", "arena"] }),
    runtimeImporter: async () => ({ createPlanetHub: (options) => { runtimeOptions = options; return fakeHub; } })
  });
  await bridge.ensure();
  runtimeOptions.onSemanticEvent({ cue: "journey-transfer", direction: "outbound" });
  assert.ok(audioCalls.some((call) => call[0] === "sync" && call[1] === "journey"));
  assert.deepEqual(audioCalls.find((call) => call[0] === "cue"), ["cue", "journey-transfer", "outbound"]);
  assert.ok(audioCalls.some((call) => call[0] === "resume" && call[1] === "home-hidden"));
  bridge.destroy();
  assert.deepEqual(audioCalls.at(-1), ["destroy"]);
});
