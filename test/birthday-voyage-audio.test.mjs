import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BIRTHDAY_AUDIO_ACTS,
  BIRTHDAY_AUDIO_CUES,
  BIRTHDAY_AUDIO_MUTED_STORAGE_KEY,
  birthdayAudioToggleLabel,
  createBirthdayVoyageAudioDirector,
  requestBirthdayMediaCache
} from "../public/birthday-voyage-audio.mjs";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    value: (key) => values.get(key)
  };
}

function audioParam(value = 0) {
  return {
    value,
    cancelScheduledValues() {},
    exponentialRampToValueAtTime(next) { this.value = next; },
    linearRampToValueAtTime(next) { this.value = next; },
    setValueAtTime(next) { this.value = next; }
  };
}

function audioNode(extra = {}) {
  return {
    addEventListener() {},
    connect() { return this; },
    disconnect() {},
    start() {},
    stop() {},
    ...extra
  };
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 2;
    this.destination = audioNode();
    this.sampleRate = 8_000;
    this.state = "running";
  }

  close() { return Promise.resolve(); }
  resume() { this.state = "running"; return Promise.resolve(); }
  createGain() { return audioNode({ gain: audioParam(1) }); }
  createOscillator() { return audioNode({ frequency: audioParam(440), type: "sine" }); }
  createStereoPanner() { return audioNode({ pan: audioParam(0) }); }
  createBiquadFilter() { return audioNode({ frequency: audioParam(900), type: "highpass" }); }
  createBuffer(_channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() { return audioNode({ buffer: null }); }
}

const inertTimers = {
  setInterval: () => 1,
  clearInterval() {},
  setTimeout(callback) { callback(); return 2; },
  clearTimeout() {}
};

test("birthday audio exposes the complete original cue and act vocabulary", () => {
  assert.deepEqual(BIRTHDAY_AUDIO_CUES, [
    "sabotage", "water", "fate", "ribbon", "flip", "engine", "indicator",
    "parking", "rocket", "boost", "docking", "glint", "finale"
  ]);
  assert.deepEqual(BIRTHDAY_AUDIO_ACTS, ["varna", "europe", "tokyo", "space", "cosmos", "finale"]);
});

test("voyage lifecycle ducks once and restores the game soundtrack on every exit path", () => {
  let ducks = 0;
  let restores = 0;
  const director = createBirthdayVoyageAudioDirector({
    AudioContextCtor: FakeAudioContext,
    timers: inertTimers,
    hostAudio: {
      duck: () => { ducks += 1; },
      restore: () => { restores += 1; }
    }
  });

  assert.equal(director.enter(), true);
  assert.equal(director.enter(), true, "re-entering should only refresh lifecycle binding");
  assert.equal(ducks, 1);
  assert.equal(director.exit(), true);
  assert.equal(director.exit(), false);
  assert.equal(restores, 1);

  director.enter();
  director.dispose();
  assert.equal(ducks, 2);
  assert.equal(restores, 2, "dispose is the error/teardown restoration path");
});

test("the persistent voyage mute is independent, observable, and immediately silences cues", async () => {
  const storage = memoryStorage({ [BIRTHDAY_AUDIO_MUTED_STORAGE_KEY]: "muted" });
  const states = [];
  const director = createBirthdayVoyageAudioDirector({
    AudioContextCtor: FakeAudioContext,
    storage,
    timers: inertTimers
  });
  const unsubscribe = director.subscribe((state) => states.push(state));

  assert.equal(director.isMuted(), true);
  assert.equal(director.play("glint"), false);
  assert.equal(director.setMuted(false), false);
  assert.equal(storage.value(BIRTHDAY_AUDIO_MUTED_STORAGE_KEY), "sound");
  assert.equal(await director.prime({ music: false }), true);
  assert.equal(director.play("glint"), true);
  assert.equal(director.toggleMuted(), true);
  assert.equal(storage.value(BIRTHDAY_AUDIO_MUTED_STORAGE_KEY), "muted");
  assert.ok(states.length >= 4);
  assert.equal(states.at(-1).muted, true);
  unsubscribe();
  director.dispose();
});

test("sound-toggle labels describe the resulting action", () => {
  assert.equal(birthdayAudioToggleLabel(false), "Mute voyage sound");
  assert.equal(birthdayAudioToggleLabel(true), "Turn voyage sound on");
});

test("runtime warming asks the worker for only the current and adjacent birthday media", () => {
  const messages = [];
  const navigatorRef = {
    serviceWorker: {
      controller: { postMessage: (message) => messages.push(message) }
    }
  };
  assert.equal(requestBirthdayMediaCache([
    "/art/birthday-voyage/varna-thumb.webp",
    "/art/birthday-voyage/varna-poster.webp",
    "/art/birthday-voyage/vienna-thumb.webp",
    "/art/birthday-voyage/too-far-ahead.webp"
  ], { navigatorRef, requestId: "route-1" }), true);
  assert.deepEqual(messages, [{
    type: "CONSTELLORE_CACHE_BIRTHDAY_MEDIA",
    requestId: "route-1",
    urls: [
      "/art/birthday-voyage/varna-thumb.webp",
      "/art/birthday-voyage/varna-poster.webp",
      "/art/birthday-voyage/vienna-thumb.webp"
    ]
  }]);
});

test("app handoff owns host ducking and restores audio after a skipped or failed voyage", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const start = app.indexOf("function handoffBirthdayVoyage() {");
  const end = app.indexOf("function startupScrambleInvite", start);
  const handoff = app.slice(start, end);

  assert.match(handoff, /import\("[.]\/birthday-voyage-audio[.]mjs[?]v=/);
  assert.match(handoff, /launchBirthdayVoyage\(\{ audioDirector: voyageAudio \}\)/);
  assert.match(handoff, /gameAudio[.]setScene\("silent"\)/);
  assert.match(handoff, /restore\(\)[\s\S]*gameAudio[.]setScene\(returnScene\)/);
  assert.match(handoff, /result[?][.]outcome[?][.]started[\s\S]*voyageAudio[.]enter/);
  assert.match(handoff, /else \{[\s\S]*voyageAudio[.]dispose\(\)/);
  assert.match(handoff, /[.]catch\(\(\) => \{[\s\S]*voyageAudio[?][.]dispose[?][.]\(\)/);
  assert.match(handoff, /startupBirthdayForceReplay[\s\S]*birthday memories need one online opening/);
});

test("birthday modules use the release version namespace for cache identity", async () => {
  const [app, voyage] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/birthday-voyage.mjs", import.meta.url), "utf8")
  ]);
  assert.match(app, /import\("[.]\/birthday-voyage[.]mjs[?]v=/);
  assert.match(app, /import\("[.]\/birthday-voyage-audio[.]mjs[?]v=/);
  assert.match(voyage, /from "[.]\/birthday-voyage-config[.]mjs[?]v=/);
  assert.match(voyage, /from "[.]\/birthday-voyage-personal-media[.]mjs[?]v=/);
  assert.doesNotMatch(`${app}\n${voyage}`, /[.]mjs[?]birthday=/);
});

test("the generated release keeps the whole voyage out of atomic shell installation", async () => {
  const worker = await readFile(new URL("../public/service-worker.js", import.meta.url), "utf8");
  const shell = worker.match(/const SHELL = ([^;]+);/)?.[1] || "";

  assert.match(shell, /app[.]js/);
  assert.doesNotMatch(shell, /birthday-voyage|lion-intro-birthday/);
  assert.match(worker, /const BIRTHDAY_PREFIXES = \["\/art\/birthday-voyage\/","\/cinematic\/birthday-voyage\/"\]/);
  assert.match(worker, /birthday-voyage-audio[.]mjs[?]v=/);
  assert.match(worker, /cinematic\/lion-intro-birthday[.]mp4/);
});
