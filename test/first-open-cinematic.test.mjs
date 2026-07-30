import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import {
  FIRST_OPEN_CINEMATIC_BRAND_RATE_CUE_SECONDS,
  FIRST_OPEN_CINEMATIC_HANDOFF_LEAD_SECONDS,
  FIRST_OPEN_CINEMATIC_PHONE_BRAND_RATE_CUE_SECONDS,
  FIRST_OPEN_CINEMATIC_PHONE_VIDEO_PATH,
  FIRST_OPEN_CINEMATIC_REPEAT_RATE,
  FIRST_OPEN_CINEMATIC_SESSION_KEY,
  FIRST_OPEN_CINEMATIC_STORAGE_KEY,
  FIRST_OPEN_CINEMATIC_VIDEO_PATH,
  buildFirstOpenCinematicDom,
  clearFirstOpenCinematicCompletion,
  clearFirstOpenCinematicSession,
  createFirstOpenCinematic,
  firstOpenCinematicBrandRateCueSeconds,
  firstOpenCinematicVideoSelection,
  hasCompletedFirstOpenCinematic,
  hasPlayedFirstOpenCinematicThisSession,
  launchCinematicPlan,
  launchCinematicPlaybackRateAt,
  launchStudioIdentTiming,
  markFirstOpenCinematicComplete,
  markFirstOpenCinematicSessionPlayed,
  prefersPhoneFirstOpenCinematic
} from "../public/cinematic/first-open-cinematic.mjs";

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

function classList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name)
  };
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.children = [];
    this.dataset = {};
    this.classList = classList();
    this.className = "";
    this.listeners = new Map();
    this.hidden = false;
    this.inert = false;
    this.isConnected = false;
    this.parentNode = null;
    this.textContent = "";
    this.paused = true;
    this.muted = false;
    this.duration = 10;
    this.currentTime = 0;
    this.playbackRate = 1;
    this.defaultPlaybackRate = 1;
    this.playCalls = 0;
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(String(name), stringValue);
    if (String(name).startsWith("data-")) {
      const key = String(name)
        .slice(5)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = stringValue;
    }
  }

  getAttribute(name) {
    return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(String(name));
  }

  removeAttribute(name) {
    this.attributes.delete(String(name));
  }

  append(...children) {
    children.forEach((child) => {
      child.parentNode = this;
      child.isConnected = this.isConnected;
      this.children.push(child);
    });
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
    this.isConnected = false;
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }

  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }

  dispatch(type, event = {}) {
    for (const callback of this.listeners.get(type) || []) {
      callback({ type, target: this, ...event });
    }
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  play() {
    this.playCalls += 1;
    if (
      this.tagName === "VIDEO"
      && this.ownerDocument.blockFirstUnmutedPlay
      && !this.ownerDocument.blockedUnmutedPlay
      && !this.muted
    ) {
      this.ownerDocument.blockedUnmutedPlay = true;
      return Promise.reject({ name: "NotAllowedError" });
    }
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

class FakeDocument {
  constructor({
    reducedMotion = false,
    blockFirstUnmutedPlay = false,
    phone = false,
    width = phone ? 390 : 1280,
    height = phone ? 844 : 720
  } = {}) {
    this.listeners = new Map();
    this.created = [];
    this.activeElement = null;
    this.blockFirstUnmutedPlay = blockFirstUnmutedPlay;
    this.blockedUnmutedPlay = false;
    this.defaultView = {
      innerWidth: width,
      innerHeight: height,
      matchMedia: (query) => ({
        matches: String(query).includes("prefers-reduced-motion")
          ? reducedMotion
          : (
            String(query).includes("orientation: portrait")
            && height > width
          )
      }),
      requestAnimationFrame: (callback) => callback()
    };
    this.head = new FakeElement("head", this);
    this.body = new FakeElement("body", this);
    this.body.isConnected = true;
  }

  createElement(tagName) {
    const element = new FakeElement(tagName, this);
    this.created.push(element);
    return element;
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }

  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }
}

const immediatePaint = () => Promise.resolve();
const acceleratedPhaseTimers = {
  setTimeout(callback, milliseconds) {
    if (Number(milliseconds) < 1_000) queueMicrotask(callback);
    return callback;
  },
  clearTimeout() {}
};

test("launch planning keeps every play at 1x and bypasses reduced motion", () => {
  assert.equal(FIRST_OPEN_CINEMATIC_HANDOFF_LEAD_SECONDS, 0.55);
  assert.deepEqual(launchStudioIdentTiming(), {
    blackout: 800
  });
  assert.deepEqual(launchStudioIdentTiming({ repeat: true }), {
    blackout: 650
  });
  assert.deepEqual(launchCinematicPlan(), {
    shouldPlay: true,
    repeat: false,
    playbackRate: 1,
    handoffDuration: 820
  });
  assert.deepEqual(launchCinematicPlan({ completed: true }), {
    shouldPlay: true,
    repeat: true,
    playbackRate: FIRST_OPEN_CINEMATIC_REPEAT_RATE,
    handoffDuration: 820
  });
  assert.deepEqual(launchCinematicPlan({ completed: true, repeatRate: 9 }), {
    shouldPlay: true,
    repeat: true,
    playbackRate: 1,
    handoffDuration: 820
  });
  assert.deepEqual(launchCinematicPlan({ reducedMotion: true }), {
    shouldPlay: false,
    repeat: false,
    playbackRate: 0,
    handoffDuration: 90
  });
  assert.equal(launchCinematicPlaybackRateAt({
    currentTime: FIRST_OPEN_CINEMATIC_BRAND_RATE_CUE_SECONDS - 0.01,
    playbackRate: 2
  }), 1);
  assert.equal(launchCinematicPlaybackRateAt({
    currentTime: FIRST_OPEN_CINEMATIC_BRAND_RATE_CUE_SECONDS,
    playbackRate: 2
  }), 1);
  assert.equal(launchCinematicPlaybackRateAt({
    currentTime: FIRST_OPEN_CINEMATIC_BRAND_RATE_CUE_SECONDS + 1,
    playbackRate: 1
  }), 1);
  assert.equal(firstOpenCinematicBrandRateCueSeconds("landscape"), 15);
  assert.equal(
    firstOpenCinematicBrandRateCueSeconds("phone"),
    FIRST_OPEN_CINEMATIC_PHONE_BRAND_RATE_CUE_SECONDS
  );
  assert.equal(launchCinematicPlaybackRateAt({
    currentTime: FIRST_OPEN_CINEMATIC_PHONE_BRAND_RATE_CUE_SECONDS - 0.01,
    playbackRate: 2,
    videoLayout: "phone"
  }), 1);
  assert.equal(launchCinematicPlaybackRateAt({
    currentTime: FIRST_OPEN_CINEMATIC_PHONE_BRAND_RATE_CUE_SECONDS,
    playbackRate: 2,
    videoLayout: "phone"
  }), 1);
});

test("the completion marker remains local, versioned, recoverable, and resilient", () => {
  const storage = new MemoryStorage();
  assert.equal(hasCompletedFirstOpenCinematic(storage), false);
  assert.equal(markFirstOpenCinematicComplete(storage, {
    now: () => Date.parse("2026-07-28T12:00:00.000Z")
  }), true);
  assert.equal(hasCompletedFirstOpenCinematic(storage), true);
  assert.deepEqual(JSON.parse(storage.getItem(FIRST_OPEN_CINEMATIC_STORAGE_KEY)), {
    schemaVersion: 1,
    completed: true,
    completedAt: "2026-07-28T12:00:00.000Z"
  });
  assert.equal(clearFirstOpenCinematicCompletion(storage), true);
  assert.equal(hasCompletedFirstOpenCinematic(storage), false);

  const blockedStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); }
  };
  assert.equal(hasCompletedFirstOpenCinematic(blockedStorage), false);
  assert.equal(markFirstOpenCinematicComplete(blockedStorage), false);
  assert.equal(clearFirstOpenCinematicCompletion(blockedStorage), false);
});

test("the launch marker is scoped to the current browser session", () => {
  const storage = new MemoryStorage();
  assert.equal(FIRST_OPEN_CINEMATIC_SESSION_KEY, "constellore-launch-cinematic-session-v1");
  assert.equal(hasPlayedFirstOpenCinematicThisSession(storage), false);
  assert.equal(markFirstOpenCinematicSessionPlayed(storage), true);
  assert.equal(storage.getItem(FIRST_OPEN_CINEMATIC_SESSION_KEY), "played");
  assert.equal(hasPlayedFirstOpenCinematicThisSession(storage), true);
  assert.equal(clearFirstOpenCinematicSession(storage), true);
  assert.equal(hasPlayedFirstOpenCinematicThisSession(storage), false);
});

test("the responsive film selector uses the portrait composite on portrait displays", () => {
  const desktopDocument = new FakeDocument();
  const desktopSelection = firstOpenCinematicVideoSelection(desktopDocument);
  assert.equal(prefersPhoneFirstOpenCinematic(desktopDocument), false);
  assert.equal(desktopSelection.layout, "landscape");
  assert.equal(desktopSelection.path, FIRST_OPEN_CINEMATIC_VIDEO_PATH);
  assert.match(new URL(desktopSelection.url).pathname, /intro-video[.]mp4$/);

  const phoneDocument = new FakeDocument({ phone: true });
  const phoneSelection = firstOpenCinematicVideoSelection(phoneDocument);
  assert.equal(prefersPhoneFirstOpenCinematic(phoneDocument), true);
  assert.equal(phoneSelection.layout, "phone");
  assert.equal(phoneSelection.path, FIRST_OPEN_CINEMATIC_PHONE_VIDEO_PATH);
  assert.match(new URL(phoneSelection.url).pathname, /intro-video-phone[.]mp4$/);

  const portraitTablet = firstOpenCinematicVideoSelection(
    new FakeDocument({ width: 820, height: 1180 })
  );
  assert.equal(portraitTablet.layout, "phone");
  assert.equal(portraitTablet.path, FIRST_OPEN_CINEMATIC_PHONE_VIDEO_PATH);
});

test("the DOM builder creates a native inline video with accessible controls", () => {
  const documentRef = new FakeDocument();
  const dom = buildFirstOpenCinematicDom(documentRef, {
    videoUrl: "./cinematic-test.mp4"
  });
  assert.equal(dom.root.getAttribute("role"), "dialog");
  assert.equal(dom.root.getAttribute("aria-modal"), "true");
  assert.equal(dom.root.getAttribute("data-video-layout"), "custom");
  assert.equal(dom.video.tagName, "VIDEO");
  assert.equal(dom.video.getAttribute("src"), "./cinematic-test.mp4");
  assert.equal(dom.video.getAttribute("preload"), "auto");
  assert.equal(dom.video.getAttribute("playsinline"), "");
  assert.equal(dom.video.defaultMuted, false);
  assert.equal(dom.video.muted, false);
  assert.equal(dom.studio.getAttribute("aria-hidden"), "true");
  assert.equal(dom.credit.textContent, "A PRODUCTION BY");
  assert.deepEqual(dom.brand.children.map(({ textContent }) => textContent), ["OXYFEL", "GAMES"]);
  assert.equal(dom.signature.textContent, "FORGED AMONG THE STARS");
  assert.equal(dom.starfield.children.length, 12);
  assert.equal(dom.skip.getAttribute("aria-label"), "Skip introduction");
  assert.equal(dom.sound.getAttribute("aria-label"), "Mute introduction");
  assert.equal(dom.sound.textContent, "Sound on");
  assert.equal(
    documentRef.created.some(({ className }) => String(className).includes("sound-gate")),
    false
  );
  assert.equal(documentRef.created.some(({ tagName }) => tagName === "CANVAS"), false);
  assert.equal(documentRef.created.some(({ tagName }) => tagName === "SCRIPT"), false);
});

test("the first launch persists completion and later launches stay at 1x", async () => {
  const storage = new MemoryStorage();
  const firstSession = new MemoryStorage();
  const firstDocument = new FakeDocument();
  const firstHandoffs = [];
  const first = createFirstOpenCinematic({
    documentRef: firstDocument,
    storage,
    sessionStorage: firstSession,
    loadStyles: false,
    nextPaint: immediatePaint,
    onHandoff: () => firstHandoffs.push("menu")
  });

  const firstPending = first.playLaunch();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(firstDocument.created.find(({ tagName }) => tagName === "VIDEO")?.playbackRate, 1);
  assert.equal(first.skip(), true);
  const firstOutcome = await firstPending;
  assert.equal(firstOutcome.reason, "skipped");
  assert.equal(firstOutcome.playbackRate, 1);
  assert.equal(firstOutcome.menuHandoff, true);
  assert.equal(firstOutcome.persisted, true);
  assert.deepEqual(firstHandoffs, ["menu"]);

  const sameSessionDocument = new FakeDocument();
  let sameSessionHandoffs = 0;
  const sameSession = createFirstOpenCinematic({
    documentRef: sameSessionDocument,
    storage,
    sessionStorage: firstSession,
    loadStyles: false,
    onHandoff: () => { sameSessionHandoffs += 1; }
  });
  const sameSessionOutcome = await sameSession.playLaunch();
  assert.equal(sameSessionOutcome.reason, "session-played");
  assert.equal(sameSessionOutcome.played, false);
  assert.equal(sameSessionOutcome.menuHandoff, true);
  assert.equal(sameSessionDocument.created.some(({ tagName }) => tagName === "VIDEO"), false);
  assert.equal(sameSessionHandoffs, 1);

  const repeatDocument = new FakeDocument();
  const repeat = createFirstOpenCinematic({
    documentRef: repeatDocument,
    storage,
    sessionStorage: new MemoryStorage(),
    loadStyles: false,
    nextPaint: immediatePaint
  });
  const repeatPending = repeat.playLaunch();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(repeatDocument.created.find(({ tagName }) => tagName === "VIDEO")?.playbackRate, 1);
  assert.equal(repeat.skip(), true);
  const repeatOutcome = await repeatPending;
  assert.equal(repeatOutcome.repeat, true);
  assert.equal(repeatOutcome.playbackRate, 1);
  assert.equal(repeatOutcome.persisted, false);
});

test("blocked sound autoplay immediately retries muted without waiting for a click", async () => {
  const documentRef = new FakeDocument({ blockFirstUnmutedPlay: true });
  const cues = [];
  const cinematic = createFirstOpenCinematic({
    documentRef,
    storage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    loadStyles: false,
    nextPaint: immediatePaint,
    timers: acceleratedPhaseTimers,
    onCue: (cue) => cues.push(cue)
  });

  const pending = cinematic.playLaunch();
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();

  const video = documentRef.created.find(({ tagName }) => tagName === "VIDEO");
  const root = documentRef.created.find(({ className }) => className === "first-open-cinematic");
  assert.equal(video.playCalls, 2);
  assert.equal(video.muted, true);
  assert.equal(video.defaultMuted, true);
  assert.equal(video.paused, false);
  assert.equal(root.dataset.phase, "playing");
  assert.notEqual(root.dataset.phase, "audio-wait");
  assert.ok(cues.includes("autoplay-muted"));

  assert.equal(cinematic.skip(), true);
  const outcome = await pending;
  assert.equal(outcome.reason, "skipped");
  assert.equal(outcome.played, true);
  assert.equal(outcome.muted, true);
});

test("reduced motion hands directly to the menu and records the first visit", async () => {
  const storage = new MemoryStorage();
  const documentRef = new FakeDocument({ reducedMotion: true });
  let handoffs = 0;
  const cinematic = createFirstOpenCinematic({
    documentRef,
    storage,
    loadStyles: false,
    nextPaint: immediatePaint,
    onHandoff: () => { handoffs += 1; }
  });
  const outcome = await cinematic.playLaunch();
  assert.equal(outcome.played, false);
  assert.equal(outcome.handled, true);
  assert.equal(outcome.reason, "reduced-motion");
  assert.equal(outcome.menuHandoff, true);
  assert.equal(outcome.persisted, true);
  assert.equal(handoffs, 1);
  assert.equal(documentRef.created.some(({ tagName }) => tagName === "VIDEO"), false);
});

test("the stylesheet and optimized video preserve launch safety", async () => {
  const moduleSource = await readFile(
    new URL("../public/cinematic/first-open-cinematic.mjs", import.meta.url),
    "utf8"
  );
  const css = await readFile(
    new URL("../public/cinematic/first-open-cinematic.css", import.meta.url),
    "utf8"
  );
  assert.match(css, /\.first-open-cinematic\s*\{[\s\S]*z-index:\s*2147483500/);
  assert.match(css, /\.first-open-cinematic\s*\{[\s\S]*inset:\s*0/);
  assert.match(css, /\.first-open-cinematic\s*\{[\s\S]*width:\s*auto/);
  assert.match(css, /\.first-open-cinematic\s*\{[\s\S]*height:\s*auto/);
  assert.doesNotMatch(css, /100(?:d|s|l)?v[hw]/);
  assert.match(css, /touch-action:\s*none/);
  assert.doesNotMatch(css, /object-fit:\s*contain/);
  assert.match(css, /\.first-open-cinematic__video\s*\{[\s\S]*inset:\s*-2px/);
  assert.match(css, /\.first-open-cinematic__video\s*\{[\s\S]*object-fit:\s*cover/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.first-open-cinematic__skip:focus-visible/);
  assert.match(css, /first-open-video-handoff/);
  assert.match(css, /first-open-menu-arrive/);
  assert.match(css, /first-open-studio-lockup/);
  assert.match(css, /first-open-studio-flare/);
  assert.match(css, /\.first-open-cinematic__studio-brand/);
  assert.doesNotMatch(css, /first-open-cinematic__sound-gate/);
  assert.doesNotMatch(css, /Begin with sound/);
  assert.match(moduleSource, /\(duration - currentTime\) \/ playbackRate/);
  assert.match(moduleSource, /\["playing", "handoff"\][.]includes\(dom[?][.]root[.]dataset[.]phase\)/);
  assert.match(moduleSource, /dom[.]video[.]volume = 0;\s*dom[.]video[.]pause/);
  assert.match(moduleSource, /onPlaybackIntent/);
  assert.match(moduleSource, /emit\("autoplay-muted"/);
  assert.doesNotMatch(moduleSource, /awaitPlaybackGesture|dataset[.]phase = "audio-wait"/);

  const html = await readFile(
    new URL("../public/index.html", import.meta.url),
    "utf8"
  );
  assert.match(html, /<div id="cosmicGate"[^>]*data-phase="idle"[^>]*\shidden[^>]*style="display:none">/);
  assert.match(html, /body[.]cosmic-intro-pending :is\(#startScreen, #gameScreen\)/);
  assert.match(html, /<style data-launch-blackout>/);

  assert.equal(FIRST_OPEN_CINEMATIC_VIDEO_PATH, "./intro-video.mp4");
  assert.equal(FIRST_OPEN_CINEMATIC_PHONE_VIDEO_PATH, "./intro-video-phone.mp4");
  const video = await stat(
    new URL("../public/cinematic/intro-video.mp4", import.meta.url)
  );
  const phoneVideo = await stat(
    new URL("../public/cinematic/intro-video-phone.mp4", import.meta.url)
  );
  assert.ok(video.size > 5_000_000);
  assert.ok(video.size < 7_000_000);
  assert.ok(phoneVideo.size > 3_000_000);
  assert.ok(phoneVideo.size < 5_000_000);
});
