import assert from "node:assert/strict";
import test from "node:test";

import { createAudioRuntime } from "../public/audio-runtime.mjs";

class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }

  cancelScheduledValues(time) { this.events.push(["cancel", time]); }
  setValueAtTime(value, time) {
    this.value = value;
    this.events.push(["set", value, time]);
  }
  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push(["linear", value, time]);
  }
  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push(["exponential", value, time]);
  }
}

class FakeNode {
  constructor() {
    this.connections = [];
    this.disconnected = false;
  }

  connect(target) {
    this.connections.push(target);
    return target;
  }

  disconnect() {
    this.disconnected = true;
  }
}

class FakeSource extends FakeNode {
  constructor() {
    super();
    this.playbackRate = new FakeParam(1);
    this.startCalls = [];
    this.stopCalls = [];
    this.onended = null;
  }

  start(...args) {
    this.startCalls.push(args);
  }

  stop(...args) {
    this.stopCalls.push(args);
    queueMicrotask(() => this.onended?.());
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 1;
    this.state = "running";
    this.destination = new FakeNode();
    this.sources = [];
    this.gains = [];
    FakeAudioContext.instances.push(this);
  }

  createDynamicsCompressor() {
    const node = new FakeNode();
    for (const field of ["threshold", "knee", "ratio", "attack", "release"]) node[field] = new FakeParam();
    return node;
  }

  createGain() {
    const node = new FakeNode();
    node.gain = new FakeParam(1);
    this.gains.push(node);
    return node;
  }

  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  createOscillator() {
    const source = new FakeSource();
    source.frequency = new FakeParam();
    this.sources.push(source);
    return source;
  }

  createBiquadFilter() {
    const node = new FakeNode();
    node.frequency = new FakeParam();
    node.Q = new FakeParam();
    return node;
  }

  createStereoPanner() {
    const node = new FakeNode();
    node.pan = new FakeParam();
    return node;
  }

  decodeAudioData() {
    return Promise.resolve({ duration: 64 });
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }

  close() {
    this.state = "closed";
    return Promise.resolve();
  }
}

FakeAudioContext.instances = [];

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("score and pulse start sample-aligned while starter and priority cues use the expanded bank", async () => {
  const names = ["AudioContext", "webkitAudioContext", "fetch", "navigator", "document", "matchMedia"];
  const descriptors = Object.fromEntries(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const requests = [];
  const preferences = {
    sound: true,
    music: true,
    haptics: false,
    muted: false,
    volume: .75,
    musicVolume: 1,
    sfxVolume: 1
  };
  let runtime;
  try {
    Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: FakeAudioContext });
    Object.defineProperty(globalThis, "webkitAudioContext", { configurable: true, value: undefined });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async (url) => {
        requests.push(String(url));
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(16) };
      }
    });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { connection: { saveData: false } } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { hidden: false } });
    Object.defineProperty(globalThis, "matchMedia", { configurable: true, value: () => ({ matches: false }) });

    runtime = createAudioRuntime({ getPreferences: () => preferences });
    runtime.prime();
    runtime.setScene("run");
    runtime.setIntensity(1);
    await settle();
    await settle();

    const context = FakeAudioContext.instances.at(-1);
    const looping = context.sources.filter((source) => source.loop);
    assert.equal(looping.length, 2, "the bed and synchronized pulse should both remain running");
    assert.deepEqual(looping[0].startCalls[0], looping[1].startCalls[0], "both stems use one context timestamp and offset");
    assert.ok(requests.some((url) => url.endsWith("/charting-the-first-sky.mp3")));
    assert.ok(requests.some((url) => url.endsWith("/gameplay-pulse.mp3")));
    assert.ok(requests.some((url) => url.endsWith("/sfx-bank.mp3")));
    const pulseGain = looping[1].connections[0].gain;
    assert.ok(pulseGain.events.some(([kind, value]) => kind === "linear" && value === .42));

    runtime.playFeedback("place", { word: "Earth", category: "nature", source: "origin" });
    const earth = context.sources.at(-1);
    assert.equal(earth.startCalls[0][1], 20 * 1.4, "Earth replaces the generic placement slot");

    runtime.playFeedback("success", { word: "Steam", category: "force" });
    const success = context.sources.at(-1);
    assert.equal(success.startCalls[0][1], 2 * 1.4);
    runtime.playFeedback("target", { word: "Cloud", category: "nature" });
    assert.ok(success.stopCalls.length > 0, "the target cue preempts the lower-priority success tail");

    runtime.playResult({ reward: true });
    assert.equal(runtime.queueProgression("rankPromotion"), true);
    await settle();
    assert.equal(context.sources.at(-1).startCalls[0][1], 19 * 1.4, "a late rank-up replaces the pending reward cue");
  } finally {
    runtime?.dispose();
    FakeAudioContext.instances.length = 0;
    for (const name of names) {
      const descriptor = descriptors[name];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test("the silent cinematic prepares Home music and kit previews never overlap musical layers", async () => {
  const names = ["AudioContext", "webkitAudioContext", "fetch", "navigator", "document", "matchMedia"];
  const descriptors = Object.fromEntries(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const preferences = {
    sound: true,
    music: true,
    haptics: false,
    muted: false,
    volume: 1,
    musicVolume: 1,
    sfxVolume: 1
  };
  let deferredPath = "";
  let releaseDeferredFetch = null;
  let runtime;
  try {
    Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: FakeAudioContext });
    Object.defineProperty(globalThis, "webkitAudioContext", { configurable: true, value: undefined });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async (url) => {
        const response = { ok: true, arrayBuffer: async () => new ArrayBuffer(16) };
        if (!deferredPath || !String(url).includes(deferredPath)) return response;
        return new Promise((resolve) => {
          releaseDeferredFetch = () => resolve(response);
        });
      }
    });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { connection: { saveData: false } } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { hidden: false } });
    Object.defineProperty(globalThis, "matchMedia", { configurable: true, value: () => ({ matches: false }) });

    runtime = createAudioRuntime({ getPreferences: () => preferences });
    runtime.setScene("silent");
    runtime.prime({ startMusic: false });
    await settle();
    await settle();

    const context = FakeAudioContext.instances.at(-1);
    assert.equal(
      context.sources.filter((source) => source.loop).length,
      0,
      "the menu score is decoded during the film without playing underneath it"
    );

    runtime.setScene("home");
    await settle();
    await settle();
    const canonicalSources = context.sources.filter((source) => source.loop);
    assert.equal(canonicalSources.length, 2, "Home starts the soundtrack and its silent-at-rest gameplay stem");
    const canonicalGain = canonicalSources[0].connections[0].gain;
    assert.ok(canonicalGain.events.some(([kind, value]) => kind === "linear" && value > 0));

    runtime.preview("constellore.stellar-vanguard.sound-theme.void-overture");
    await settle();
    await settle();
    const withPreview = context.sources.filter((source) => source.loop);
    assert.equal(withPreview.length, 3, "a preview adds one soundtrack source and no gameplay pulse");
    const previewSource = withPreview.at(-1);
    assert.equal(previewSource.startCalls[0][1], 20.8);
    const previewGain = previewSource.connections[0].gain;
    const canonicalSilentAt = canonicalGain.events
      .filter(([kind, value]) => kind === "linear" && value === 0)
      .at(-1)?.[2];
    const previewAudibleAt = previewGain.events
      .find(([kind, value]) => kind === "linear" && value > 0)?.[2];
    assert.ok(canonicalSilentAt <= previewAudibleAt, "the Home bed reaches zero before the preview rises");

    assert.equal(runtime.endPreview(), true);
    await settle();
    await settle();
    const restoredSources = context.sources.filter((source) => source.loop);
    assert.equal(restoredSources.length, 5, "restoring Home creates one bed plus one gameplay stem");
    const restoredBed = restoredSources.at(-2);
    const restoredGain = restoredBed.connections[0].gain;
    const previewSilentAt = previewGain.events
      .filter(([kind, value]) => kind === "linear" && value === 0)
      .at(-1)?.[2];
    const restoredAudibleAt = restoredGain.events
      .find(([kind, value]) => kind === "linear" && value > 0)?.[2];
    assert.ok(previewSilentAt <= restoredAudibleAt, "the preview reaches zero before Home music returns");

    deferredPath = "midnight-bloom.mp3";
    runtime.preview("constellore.lunar-garden.sound-theme.moon-bells");
    assert.equal(typeof releaseDeferredFetch, "function");
    runtime.endPreview();
    releaseDeferredFetch();
    await settle();
    await settle();
    assert.equal(
      context.sources.filter((source) => source.loop).length,
      5,
      "closing a still-loading sample prevents it from starting after the menu has been restored"
    );
  } finally {
    runtime?.dispose();
    FakeAudioContext.instances.length = 0;
    for (const name of names) {
      const descriptor = descriptors[name];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
