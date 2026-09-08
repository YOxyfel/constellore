import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GOLDEN_PAIR_MIN_ACTIVE_MS,
  GOLDEN_PAIR_MAX_ACTIVE_MS,
  GOLDEN_PAIR_FASTER_DURATION_SCALE,
  GOLDEN_PAIR_FASTER_MIN_ACTIVE_MS,
  GOLDEN_PAIR_MOTIONS,
  GOLDEN_PAIR_VIEW_SELECTORS,
  createGoldenPairView
} from "../public/story/golden-fusions/golden-pair-view.mjs";
import { createGoldenPairRuntime } from "../public/story/golden-fusions/golden-pair-runtime.mjs";

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.attributes = new Map();
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this._textContent = "";
    this._listeners = new Map();
    this.style = {
      values: new Map(),
      setProperty: (name, value) => this.style.values.set(String(name), String(value)),
      getPropertyValue: (name) => this.style.values.get(String(name)) || ""
    };
  }

  set innerHTML(_value) {
    throw new Error("Golden Pair renderer must never use innerHTML.");
  }

  get innerHTML() {
    throw new Error("Golden Pair renderer must never read innerHTML.");
  }

  get offsetWidth() {
    this.ownerDocument.layoutReads += 1;
    return 640;
  }

  set textContent(value) {
    this._textContent = String(value ?? "");
    for (const child of this.children) child.parentNode = null;
    this.children = [];
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join("");
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
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

  addEventListener(type, callback) {
    const key = String(type);
    if (!this._listeners.has(key)) this._listeners.set(key, []);
    this._listeners.get(key).push(callback);
  }

  dispatchEvent(type) {
    for (const callback of this._listeners.get(String(type)) || []) callback();
  }

  append(...children) {
    this._textContent = "";
    for (const child of children) {
      if (child.parentNode) child.remove();
      child.parentNode = this;
      this.children.push(child);
      if (child.tagName === "LINK") child.dispatchEvent("load");
    }
  }

  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this._textContent = "";
    this.append(...children);
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index < 0) throw new Error("Not a child.");
    this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  querySelectorAll(selector) {
    const match = /^\[([a-z0-9-]+)\]$/iu.exec(selector);
    if (!match) throw new Error(`Unsupported fake selector: ${selector}`);
    const attribute = match[1];
    const found = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.hasAttribute(attribute)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

class FakeDocument {
  constructor() {
    this.createdTags = [];
    this.layoutReads = 0;
    this.head = new FakeElement("head", this);
    this.body = new FakeElement("body", this);
    this.defaultView = {
      matchMedia: () => ({ matches: false })
    };
  }

  createElement(tagName) {
    this.createdTags.push(String(tagName).toLowerCase());
    return new FakeElement(tagName, this);
  }

  querySelector(selector) {
    if (this.head.hasAttribute(selector.slice(1, -1))) return this.head;
    if (this.body.hasAttribute(selector.slice(1, -1))) return this.body;
    return this.head.querySelector(selector) || this.body.querySelector(selector);
  }
}

class FakeTimers {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.jobs = new Map();
    this.clearedJobs = [];
  }

  setTimeout = (callback, delay = 0) => {
    const id = this.nextId;
    this.nextId += 1;
    this.jobs.set(id, {
      callback,
      due: this.now + Math.max(0, Number(delay) || 0)
    });
    return id;
  };

  clearTimeout = (id) => {
    const job = this.jobs.get(id);
    if (job) this.clearedJobs.push(job);
    this.jobs.delete(id);
  };

  advance(milliseconds) {
    const target = this.now + milliseconds;
    while (true) {
      const next = [...this.jobs.entries()]
        .filter(([, job]) => job.due <= target)
        .sort((left, right) => left[1].due - right[1].due || left[0] - right[0])[0];
      if (!next) break;
      const [id, job] = next;
      this.jobs.delete(id);
      this.now = job.due;
      job.callback();
    }
    this.now = target;
  }

  get pendingCount() {
    return this.jobs.size;
  }
}

function fakeDom() {
  const documentRef = new FakeDocument();
  const root = documentRef.createElement("section");
  return { documentRef, root };
}

function model(overrides = {}) {
  return {
    id: "golden-test",
    a: { word: "Cloud", emoji: "☁️" },
    b: { word: "Water", emoji: "💧" },
    result: { word: "Rain", emoji: "🌧️" },
    family: "weather",
    motion: "fall",
    palette: "tidal-cyan",
    presentation: "authored",
    authored: true,
    beats: ["Condense", "Release", "Ripple"],
    glyphs: ["◇", "↓", "✦"],
    duration: 3_300,
    announcement: "Cloud and Water combine to create Rain.",
    ...overrides
  };
}

function harness(options = {}) {
  const dom = fakeDom();
  const timers = new FakeTimers();
  const view = createGoldenPairView({
    root: dom.root,
    timers,
    reducedMotion: options.reducedMotion ?? (() => false)
  });
  return { ...dom, timers, view };
}

test("the overlay is pointer-free, aria-hidden, bounded, and built without active media", () => {
  const state = harness();
  const result = state.view.play(model({
    id: " GOLDEN<script> ",
    family: "weather onmouseover=alert(1)",
    motion: "not-a-motion",
    a: { word: "<img src=x onerror=alert(1)>", emoji: "<svg>" },
    beats: ["<b>Condense</b>", "Release", "Ripple"],
    duration: 50_000
  }));

  assert.equal(result.played, true);
  assert.equal(result.motion, "pulse");
  assert.equal(result.presentation, "authored");
  assert.equal(result.authored, true);
  assert.equal(result.duration, GOLDEN_PAIR_MAX_ACTIVE_MS);
  assert.equal(state.root.getAttribute("aria-hidden"), "true");
  assert.equal(state.root.style.getPropertyValue("pointer-events"), "none");
  assert.equal(state.root.getAttribute("data-golden-phase"), "active");
  assert.equal(state.root.getAttribute("data-golden-id"), "goldenscript");
  assert.equal(state.root.getAttribute("data-golden-presentation"), "authored");
  assert.equal(state.root.getAttribute("data-golden-authored"), "true");
  assert.equal(state.root.querySelectorAll(GOLDEN_PAIR_VIEW_SELECTORS.source).length, 2);
  assert.equal(state.root.querySelectorAll(GOLDEN_PAIR_VIEW_SELECTORS.meteorTrail).length, 2);
  for (const trail of state.root.querySelectorAll(GOLDEN_PAIR_VIEW_SELECTORS.meteorTrail)) {
    assert.equal(trail.getAttribute("aria-hidden"), "true");
  }
  assert.equal(state.root.querySelectorAll(GOLDEN_PAIR_VIEW_SELECTORS.glyph).length, 3);
  assert.equal(state.root.querySelectorAll(GOLDEN_PAIR_VIEW_SELECTORS.beat).length, 3);
  assert.equal(state.root.querySelectorAll(GOLDEN_PAIR_VIEW_SELECTORS.core).length, 1);
  assert.equal(state.root.querySelectorAll(GOLDEN_PAIR_VIEW_SELECTORS.result).length, 1);
  assert.equal(
    state.root.querySelectorAll(GOLDEN_PAIR_VIEW_SELECTORS.sourceWord)[0].textContent,
    "<img src=x onerror=alert(1)>"
  );
  assert.equal(
    state.root.querySelectorAll(GOLDEN_PAIR_VIEW_SELECTORS.beat)[0].textContent,
    "<b>Condense</b>"
  );
  assert.equal(state.documentRef.createdTags.includes("canvas"), false);
  assert.equal(state.documentRef.createdTags.includes("video"), false);
  assert.equal(state.documentRef.createdTags.includes("img"), false);
  assert.equal(state.timers.pendingCount, 1);
});

test("generic major presentation exposes safe metadata and dedicated meteor choreography", () => {
  const state = harness();
  const result = state.view.play(model({
    id: "major-meteor",
    presentation: "generic",
    authored: false,
    family: "major",
    palette: "meteor-cyan",
    duration: 3_400,
    a: { word: "Earth", emoji: "🌍" },
    b: { word: "Water", emoji: "💧" },
    result: { word: "Mud", emoji: "🟤" }
  }));

  assert.equal(result.played, true);
  assert.equal(result.presentation, "generic");
  assert.equal(result.authored, false);
  assert.equal(result.duration, 3_400);
  assert.equal(state.root.getAttribute("data-golden-presentation"), "generic");
  assert.equal(state.root.getAttribute("data-golden-authored"), "false");
  assert.equal(state.root.getAttribute("data-golden-phase"), "active");
  assert.equal(state.root.querySelectorAll(GOLDEN_PAIR_VIEW_SELECTORS.meteorTrail).length, 2);

  const css = readFileSync(
    new URL("../public/story/golden-fusions/golden-pair.css", import.meta.url),
    "utf8"
  );
  const genericRule = css.match(/\[data-golden-presentation="generic"\]\s*\{([^}]+)\}/u)?.[1] || "";
  assert.match(genericRule, /--gp-a-x:\s*-26rem/u);
  assert.match(genericRule, /--gp-a-y:\s*0rem/u);
  assert.match(genericRule, /--gp-b-x:\s*26rem/u);
  assert.match(genericRule, /--gp-b-y:\s*0rem/u);
  assert.match(css, /@keyframes\s+golden-meteor-tail/u);
  assert.match(css, /@keyframes\s+golden-meteor-result/u);
  assert.match(
    css,
    /\[data-golden-phase="active"\]\[data-golden-presentation="generic"\]\s+\[data-golden-result\]\s*\{\s*animation-name:\s*golden-meteor-result/u
  );
  assert.match(css, /calc\(-50%\s*-\s*5[.]2rem\)/u);
  assert.match(
    css,
    /\[data-golden-motion-mode="reduced"\]\s+\[data-golden-meteor-trail\]\s*\{\s*display:\s*none/u
  );
  assert.match(css, /body\[data-cosmetic-effects="off"\]\s+\[data-golden-pair\]/u);
  assert.match(
    css,
    /@media\s*\(forced-colors:\s*active\)[\s\S]*\[data-golden-meteor-trail\]\s*\{[\s\S]*background:\s*CanvasText;[\s\S]*filter:\s*none;/u
  );
});

test("all and only the twelve authored motions have distinct CSS choreography", () => {
  const state = harness();
  for (const motion of GOLDEN_PAIR_MOTIONS) {
    const result = state.view.play(model({ id: `golden-${motion}`, motion }));
    assert.equal(result.played, true);
    assert.equal(state.root.getAttribute("data-golden-motion"), motion);
    assert.equal(state.timers.pendingCount, 1);
  }

  assert.equal(new Set(GOLDEN_PAIR_MOTIONS).size, 12);
  const css = readFileSync(
    new URL("../public/story/golden-fusions/golden-pair.css", import.meta.url),
    "utf8"
  );
  const cssMotions = new Set(
    [...css.matchAll(/\[data-golden-motion="([^"]+)"\]/gu)].map((match) => match[1])
  );
  const motionKeyframes = new Set(
    [...css.matchAll(/@keyframes\s+golden-motion-([a-z-]+)/gu)].map((match) => match[1])
  );
  const sceneRule = css.match(/\[data-golden-scene\]\s*\{([^}]+)\}/u)?.[1] || "";
  assert.deepEqual([...cssMotions].sort(), [...GOLDEN_PAIR_MOTIONS].sort());
  assert.deepEqual([...motionKeyframes].sort(), [...GOLDEN_PAIR_MOTIONS].sort());
  assert.match(sceneRule, /width:\s*min\(94%,\s*52rem\)/u);
  assert.match(sceneRule, /height:\s*min\(88%,\s*27rem\)/u);
  assert.doesNotMatch(sceneRule, /\b(?:v[wh]|sv[wh]|lv[wh]|dv[wh])\b/u);
  for (const marker of ["glyphs", "core", "result"]) {
    const centeredRule = [
      ...css.matchAll(new RegExp(`\\[data-golden-${marker}\\]\\s*\\{([^}]+)\\}`, "gu"))
    ].map((match) => match[1]).find((rule) => /left:\s*50%/u.test(rule)) || "";
    assert.match(centeredRule, /left:\s*50%/u, `${marker} must remain centered horizontally.`);
    assert.match(centeredRule, /top:\s*48%/u, `${marker} must remain centered vertically.`);
    assert.doesNotMatch(
      centeredRule,
      /inset:\s*auto/u,
      `${marker} must not reset its explicit center coordinates with the inset shorthand.`
    );
  }
});

test("replay cancels the old generation, flushes layout, and ignores a stale callback", () => {
  const state = harness();
  const first = state.view.play(model());
  assert.equal(first.played, true);
  assert.equal(state.documentRef.layoutReads, 1);
  assert.equal(state.timers.pendingCount, 1);

  const second = state.view.play(model());
  assert.equal(second.played, true);
  assert.equal(state.documentRef.layoutReads, 2);
  assert.equal(state.timers.pendingCount, 1);
  assert.equal(state.timers.clearedJobs.length, 1);

  state.timers.clearedJobs[0].callback();
  assert.equal(state.root.hidden, false);
  assert.equal(state.root.getAttribute("data-golden-phase"), "active");

  state.timers.advance(second.duration);
  assert.equal(state.root.hidden, true);
  assert.equal(state.root.getAttribute("data-golden-stop-reason"), "complete");
  assert.equal(state.timers.pendingCount, 0);
});

test("full motion cannot be compressed below a readable three-second sequence", () => {
  const state = harness();
  const result = state.view.play(model({ duration: 100 }));

  assert.equal(result.played, true);
  assert.equal(result.reducedMotion, false);
  assert.equal(result.duration, GOLDEN_PAIR_MIN_ACTIVE_MS);
  state.timers.advance(GOLDEN_PAIR_MIN_ACTIVE_MS - 1);
  assert.equal(state.root.hidden, false);
  state.timers.advance(1);
  assert.equal(state.root.hidden, true);
});

test("the Faster preference shortens the cinematic while keeping a readable two-second scene", () => {
  const state = harness();
  const result = state.view.play(model({ duration: 3_500 }), { pace: "faster" });

  assert.equal(result.played, true);
  assert.equal(result.pace, "faster");
  assert.equal(result.duration, Math.max(GOLDEN_PAIR_FASTER_MIN_ACTIVE_MS, Math.round(3_500 * GOLDEN_PAIR_FASTER_DURATION_SCALE)));
  assert.equal(state.root.getAttribute("data-golden-pace"), "faster");
  assert.equal(state.root.style.getPropertyValue("--golden-duration"), `${result.duration}ms`);
  state.timers.advance(result.duration - 1);
  assert.equal(state.root.hidden, false);
  state.timers.advance(1);
  assert.equal(state.root.hidden, true);
});

test("reduced motion presents a short static frame without a layout restart", () => {
  const state = harness({ reducedMotion: () => true });
  const result = state.view.play(model({ duration: 850 }));

  assert.equal(result.played, true);
  assert.equal(result.reducedMotion, true);
  assert.equal(result.duration, 320);
  assert.equal(state.root.getAttribute("data-golden-motion-mode"), "reduced");
  assert.equal(state.root.getAttribute("data-golden-phase"), "static");
  assert.equal(state.documentRef.layoutReads, 0);
  state.timers.advance(320);
  assert.equal(state.root.hidden, true);
  assert.equal(state.timers.pendingCount, 0);
});

test("cancel and dispose are idempotent and leave no timer or owned DOM behind", () => {
  const state = harness();
  state.view.play(model());
  assert.equal(state.view.active, true);

  const cancelled = state.view.cancel("game-reset");
  assert.equal(cancelled.cancelled, true);
  assert.equal(state.view.active, false);
  assert.equal(state.timers.pendingCount, 0);
  assert.equal(state.root.hidden, true);

  state.view.dispose();
  state.view.dispose();
  assert.equal(state.root.children.length, 0);
  assert.equal(state.root.getAttribute("data-golden-phase"), "disposed");
  assert.equal(state.timers.pendingCount, 0);
  assert.deepEqual(state.view.play(model()), { played: false, reason: "disposed" });
});

test("runtime owns one board overlay, preserves gameplay children, honors Effects Off, and cleans up", async () => {
  const documentRef = new FakeDocument();
  const board = documentRef.createElement("main");
  const gameplay = documentRef.createElement("div");
  const timers = new FakeTimers();
  gameplay.textContent = "gameplay-sentinel";
  board.append(gameplay);
  documentRef.body.append(board);

  let fusionAnimation = "normal";
  const options = {
    board,
    timers,
    reducedMotion: () => documentRef.body.dataset.cosmeticEffects === "reduced",
    fusionAnimation: () => fusionAnimation
  };
  const [runtime, sameRuntime] = await Promise.all([
    createGoldenPairRuntime(options),
    createGoldenPairRuntime(options)
  ]);

  assert.equal(runtime, sameRuntime);
  assert.equal(runtime.available, true);
  assert.equal(board.children.length, 2);
  assert.equal(board.children[0], gameplay);
  assert.equal(gameplay.textContent, "gameplay-sentinel");
  assert.equal(board.querySelectorAll("[data-golden-pair-runtime-root]").length, 1);
  const overlay = board.querySelector("[data-golden-pair-runtime-root]");
  assert.equal(overlay.parentNode, board);
  assert.equal(overlay.querySelectorAll(GOLDEN_PAIR_VIEW_SELECTORS.scene).length, 1);

  documentRef.body.dataset.cosmeticEffects = "off";
  assert.deepEqual(
    runtime.play({
      a: { word: "Cloud", emoji: "☁️" },
      b: { word: "Water", emoji: "💧" },
      result: { word: "Rain", emoji: "🌧️" }
    }),
    { played: false, reason: "effects-off" }
  );
  assert.equal(timers.pendingCount, 0);

  documentRef.body.dataset.cosmeticEffects = "reduced";
  const played = runtime.play({
    a: { word: "Cloud", emoji: "☁️" },
    b: { word: "Water", emoji: "💧" },
    result: { word: "Rain", emoji: "🌧️" }
  });
  assert.equal(played.played, true);
  assert.equal(played.presentation, "authored");
  assert.equal(played.authored, true);
  assert.equal(played.reducedMotion, true);
  assert.equal(timers.pendingCount, 1);

  documentRef.body.dataset.cosmeticEffects = "full";
  const skipped = runtime.play({
    a: { word: "Earth", emoji: "🌍" },
    b: { word: "Water", emoji: "💧" },
    result: { word: "Mud", emoji: "🟤" }
  });
  assert.deepEqual(skipped, { played: false, reason: "not-authored" });

  const generic = runtime.play({
    a: { word: "Earth", emoji: "🌍" },
    b: { word: "Water", emoji: "💧" },
    result: { word: "Mud", emoji: "🟤" },
    major: true
  });
  assert.equal(generic.played, true);
  assert.equal(generic.presentation, "generic");
  assert.equal(generic.authored, false);
  assert.ok(generic.duration <= GOLDEN_PAIR_MAX_ACTIVE_MS);
  assert.equal(overlay.getAttribute("data-golden-presentation"), "generic");
  assert.equal(overlay.getAttribute("data-golden-authored"), "false");

  documentRef.body.dataset.cosmeticEffects = "full";
  fusionAnimation = "faster";
  const faster = runtime.play({
    a: { word: "Cloud", emoji: "вЃпёЏ" },
    b: { word: "Water", emoji: "рџ’§" },
    result: { word: "Rain", emoji: "рџЊ§пёЏ" }
  });
  assert.equal(faster.played, true);
  assert.equal(faster.pace, "faster");
  assert.ok(faster.duration >= GOLDEN_PAIR_FASTER_MIN_ACTIVE_MS);
  assert.ok(faster.duration < GOLDEN_PAIR_MIN_ACTIVE_MS);

  fusionAnimation = "off";
  assert.deepEqual(runtime.play({
    a: { word: "Cloud" },
    b: { word: "Water" },
    result: { word: "Rain" }
  }), { played: false, reason: "fusion-animation-off" });
  assert.equal(timers.pendingCount, 0);

  runtime.dispose();
  runtime.dispose();
  assert.equal(timers.pendingCount, 0);
  assert.equal(board.children.length, 1);
  assert.equal(board.children[0], gameplay);
  assert.equal(gameplay.textContent, "gameplay-sentinel");
});

test("renderer source has no markup injection or active-media construction path", () => {
  const viewSource = readFileSync(
    new URL("../public/story/golden-fusions/golden-pair-view.mjs", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(viewSource, /\.innerHTML\b/u);
  assert.doesNotMatch(viewSource, /createElement\(\s*["'](?:canvas|video|img|iframe)["']/iu);
});
