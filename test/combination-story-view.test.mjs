import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCombinationStory } from "../public/story/combination-story.mjs";
import {
  COMBINATION_STORY_VIEW_MAX_LAYERS,
  COMBINATION_STORY_VIEW_SELECTORS,
  createCombinationStoryView
} from "../public/story/combination-story-view.mjs";

const route = [
  { a: "Earth", b: "Water", word: "Mud", emoji: "🟤", category: "nature" },
  { a: "Mud", b: "Fire", word: "Brick", emoji: "🧱", category: "structure" },
  { a: "Air", b: "Fire", word: "Energy", emoji: "⚡", category: "force" },
  { a: "Mud", b: "Energy", word: "Life", emoji: "🌱", category: "life" },
  { a: "Life", b: "Sky", word: "Angel", emoji: "😇", category: "celestial" }
];

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.children = [];
    this.hidden = false;
    this._textContent = "";
    this.style = {
      values: new Map(),
      setProperty: (name, value) => this.style.values.set(String(name), String(value)),
      getPropertyValue: (name) => this.style.values.get(String(name)) || ""
    };
  }

  set textContent(value) {
    this._textContent = String(value ?? "");
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

  append(...children) {
    this._textContent = "";
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this._textContent = "";
    this.children = [...children];
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
  }

  createElement(tagName) {
    this.createdTags.push(String(tagName).toLowerCase());
    return new FakeElement(tagName, this);
  }
}

class FakeTimers {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.jobs = new Map();
    this.cleared = [];
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
    this.cleared.push(id);
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

  runAll(limit = 1_000) {
    let executions = 0;
    while (this.jobs.size) {
      if (executions >= limit) throw new Error("Fake timer execution limit exceeded.");
      const nextDue = Math.min(...[...this.jobs.values()].map((job) => job.due));
      this.advance(nextDue - this.now);
      executions += 1;
    }
  }

  get pendingCount() {
    return this.jobs.size;
  }
}

function fakeHost() {
  const documentRef = new FakeDocument();
  const root = new FakeElement("section", documentRef);
  return { documentRef, root };
}

function createHarness(options = {}) {
  const dom = fakeHost();
  const timers = new FakeTimers();
  const view = createCombinationStoryView({
    root: dom.root,
    timers,
    reducedMotion: options.reducedMotion || (() => false),
    maxVisualLayers: options.maxVisualLayers,
    timings: {
      crumbleMs: 10,
      rebuildStepMs: 4
    }
  });
  return { ...dom, timers, view };
}

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

test("the dedicated root contract preserves the foundation beside latest layers and every bounded chapter", () => {
  const harness = createHarness({ maxVisualLayers: 3 });
  const model = buildCombinationStory({ target: "Galaxy", history: route });
  harness.view.render(model);

  assert.equal(harness.root.hasAttribute("data-combination-story"), true);
  assert.equal(harness.root.getAttribute("role"), "region");
  assert.equal(harness.root.getAttribute("data-story-status"), "building");
  assert.equal(harness.root.getAttribute("data-story-phase"), "stable");
  assert.equal(harness.root.getAttribute("data-story-total-layers"), "5");
  assert.equal(harness.root.getAttribute("data-story-visible-layers"), "3");
  assert.deepEqual(
    harness.root.querySelectorAll(COMBINATION_STORY_VIEW_SELECTORS.layer)
      .map((node) => node.getAttribute("data-layer-id")),
    ["story-layer-1", "story-layer-4", "story-layer-5"]
  );
  const visibleLayers = harness.root.querySelectorAll(COMBINATION_STORY_VIEW_SELECTORS.layer);
  assert.equal(new Set(visibleLayers.map((node) => node.getAttribute("data-layer-slot"))).size, 3);
  assert.equal(new Set(visibleLayers.map((node) => (
    `${node.style.getPropertyValue("left")}:${node.style.getPropertyValue("top")}`
  ))).size, 3);
  assert.ok(visibleLayers.every((node) => /^[1-4]$/.test(node.getAttribute("data-layer-variation"))));
  const scene = harness.root.querySelector(COMBINATION_STORY_VIEW_SELECTORS.scene);
  assert.equal(scene.getAttribute("data-story-scene-variant"), model.scene.variant);
  assert.equal(scene.getAttribute("data-story-scene-palette"), model.scene.palette);
  assert.equal(
    harness.root.querySelectorAll(COMBINATION_STORY_VIEW_SELECTORS.chapter).length,
    5
  );
  assert.equal(
    harness.root.querySelector(COMBINATION_STORY_VIEW_SELECTORS.chapters)
      .getAttribute("aria-label"),
    "Combination story chapters"
  );
  assert.equal(
    harness.root.querySelector(COMBINATION_STORY_VIEW_SELECTORS.narration)
      .getAttribute("role"),
    "status"
  );
  assert.equal(Object.isFrozen(model), true);
  assert.equal(COMBINATION_STORY_VIEW_MAX_LAYERS, 12);
});

test("model copy is rendered as literal bounded text and never creates data-named elements", () => {
  const harness = createHarness();
  const hostile = JSON.parse(JSON.stringify(
    buildCombinationStory({ target: "Galaxy", history: route.slice(0, 1) })
  ));
  hostile.summary = "<img src=x onerror=alert(1)> story";
  hostile.accessibility.announcement = "<script>alert(1)</script>";
  hostile.chapters[0].title = "<script>chapter</script>";
  hostile.scene.layers[0].word = "<svg onload=alert(1)>";
  freezeDeep(hostile);

  harness.view.render(hostile);

  assert.equal(
    harness.root.querySelector(COMBINATION_STORY_VIEW_SELECTORS.summary).textContent,
    "<img src=x onerror=alert(1)> story"
  );
  assert.equal(
    harness.root.querySelector(COMBINATION_STORY_VIEW_SELECTORS.chapterTitle).textContent,
    "<script>chapter</script>"
  );
  assert.equal(
    harness.root.querySelector(COMBINATION_STORY_VIEW_SELECTORS.layerWord).textContent,
    "<svg onload=alert(1)>"
  );
  assert.equal(harness.documentRef.createdTags.includes("script"), false);
  assert.equal(harness.documentRef.createdTags.includes("img"), false);
  assert.equal(harness.documentRef.createdTags.includes("svg"), false);

  const source = readFileSync(
    new URL("../public/story/combination-story-view.mjs", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /\.innerHTML\b/u);
  assert.match(source, /\.textContent\s*=/u);
  assert.match(source, /\.createElement\(/u);
});

test("empty and finale models expose deterministic visible and accessible states", () => {
  const harness = createHarness();
  const empty = buildCombinationStory({ target: "Mud", history: [] });
  harness.view.render(empty);

  assert.equal(harness.root.getAttribute("data-story-status"), "empty");
  assert.equal(harness.root.querySelector(COMBINATION_STORY_VIEW_SELECTORS.layers).hidden, true);
  assert.equal(harness.root.querySelector(COMBINATION_STORY_VIEW_SELECTORS.empty).hidden, false);
  assert.equal(harness.root.querySelectorAll(COMBINATION_STORY_VIEW_SELECTORS.chapter).length, 0);
  assert.match(
    harness.root.querySelector(COMBINATION_STORY_VIEW_SELECTORS.empty).textContent,
    /No story chapters yet for Mud/u
  );

  const finale = buildCombinationStory({ target: "Angel", history: route });
  harness.view.render(finale);
  const chapters = harness.root.querySelectorAll(COMBINATION_STORY_VIEW_SELECTORS.chapter);
  assert.equal(harness.root.getAttribute("data-story-status"), "finale");
  assert.equal(harness.root.getAttribute("data-story-phase"), "stable");
  assert.equal(chapters.at(-1).getAttribute("data-chapter-kind"), "finale");
  assert.equal(
    harness.root.querySelectorAll(COMBINATION_STORY_VIEW_SELECTORS.layer).at(-1)
      .getAttribute("data-layer-role"),
    "finale"
  );
  assert.match(
    harness.root.querySelector(COMBINATION_STORY_VIEW_SELECTORS.narration).textContent,
    /completes the scene as the finale/u
  );
});

test("failure animation crumbles, queues, and rebuilds layers in cancelable phases", () => {
  const harness = createHarness();
  const model = buildCombinationStory({
    target: "Angel",
    history: route.slice(0, 3),
    failedAttempt: { a: "Mud", b: "Moon" }
  });
  harness.view.render(model);
  const layers = harness.root.querySelectorAll(COMBINATION_STORY_VIEW_SELECTORS.layer);

  assert.equal(harness.root.getAttribute("data-story-phase"), "crumble");
  assert.equal(harness.root.getAttribute("aria-busy"), "true");
  assert.ok(layers.every((layer) => layer.getAttribute("data-layer-state") === "crumbling"));
  assert.equal(harness.timers.pendingCount, 1);

  harness.timers.advance(10);
  assert.equal(harness.root.getAttribute("data-story-phase"), "rebuild");
  assert.ok(layers.every((layer) => layer.hidden));
  assert.ok(layers.every((layer) => layer.getAttribute("data-layer-state") === "queued"));
  assert.equal(harness.timers.pendingCount, 3);

  harness.timers.advance(4);
  assert.equal(layers[0].hidden, false);
  assert.equal(layers[0].getAttribute("data-layer-state"), "rebuilding");
  assert.ok(layers.slice(1).every((layer) => layer.hidden));

  harness.timers.runAll();
  assert.equal(harness.root.getAttribute("data-story-phase"), "stable");
  assert.equal(harness.root.getAttribute("aria-busy"), "false");
  assert.ok(layers.every((layer) => !layer.hidden));
  assert.ok(layers.every((layer) => layer.getAttribute("data-layer-state") === "ready"));
  assert.equal(harness.timers.pendingCount, 0);
});

test("rapid failures cancel stale generations and leave only the newest story", () => {
  const harness = createHarness();
  const first = buildCombinationStory({
    target: "Angel",
    history: route.slice(0, 1),
    failedAttempt: { a: "Earth", b: "Fire" }
  });
  const second = buildCombinationStory({
    target: "Angel",
    history: route.slice(0, 4),
    failedAttempt: { a: "Brick", b: "Moon" }
  });

  harness.view.render(first);
  harness.timers.advance(5);
  harness.view.render(second);
  assert.ok(harness.timers.cleared.length >= 1);
  assert.equal(harness.timers.pendingCount, 1);
  assert.equal(harness.root.getAttribute("data-story-total-layers"), "4");
  assert.match(
    harness.root.querySelector(COMBINATION_STORY_VIEW_SELECTORS.narration).textContent,
    /Brick and Moon do not combine/u
  );

  harness.timers.runAll();
  assert.equal(harness.root.getAttribute("data-story-phase"), "stable");
  assert.deepEqual(
    harness.root.querySelectorAll(COMBINATION_STORY_VIEW_SELECTORS.layer)
      .map((node) => node.getAttribute("data-layer-id")),
    ["story-layer-1", "story-layer-2", "story-layer-3", "story-layer-4"]
  );

  harness.view.render(buildCombinationStory({ target: "Angel", history: route.slice(0, 2) }));
  assert.equal(harness.timers.pendingCount, 0);
  assert.equal(harness.root.getAttribute("data-story-phase"), "stable");
  assert.equal(harness.root.getAttribute("data-story-total-layers"), "2");
});

test("reduced motion settles failures immediately, including an empty scene", () => {
  let reduced = true;
  const harness = createHarness({ reducedMotion: () => reduced });
  const failure = buildCombinationStory({
    target: "Angel",
    history: route.slice(0, 2),
    failedAttempt: { a: "Brick", b: "Moon" }
  });
  harness.view.render(failure);

  assert.equal(harness.root.getAttribute("data-story-motion"), "reduced");
  assert.equal(harness.root.getAttribute("data-story-phase"), "stable");
  assert.equal(harness.root.getAttribute("aria-busy"), "false");
  assert.equal(harness.timers.pendingCount, 0);
  assert.ok(
    harness.root.querySelectorAll(COMBINATION_STORY_VIEW_SELECTORS.layer)
      .every((layer) => !layer.hidden)
  );

  reduced = false;
  const emptyFailure = buildCombinationStory({
    target: "Mud",
    history: [],
    failedAttempt: { a: "Earth", b: "Fire" }
  });
  harness.view.render(emptyFailure);
  assert.equal(harness.root.getAttribute("data-story-phase"), "crumble");
  harness.timers.advance(10);
  assert.equal(harness.root.getAttribute("data-story-phase"), "stable");
  assert.equal(harness.timers.pendingCount, 0);
});

test("reset and dispose cancel work and release the dedicated root", () => {
  const harness = createHarness();
  const failure = buildCombinationStory({
    target: "Angel",
    history: route,
    failedAttempt: { a: "Angel", b: "Mud" }
  });

  harness.view.render(failure);
  assert.equal(harness.timers.pendingCount, 1);
  harness.view.reset();
  assert.equal(harness.timers.pendingCount, 0);
  assert.equal(harness.root.getAttribute("data-story-status"), "empty");
  assert.equal(harness.root.getAttribute("data-story-motion"), "idle");
  assert.equal(harness.root.children.length, 4);
  assert.match(
    harness.root.querySelector(COMBINATION_STORY_VIEW_SELECTORS.empty).textContent,
    /successful combination/u
  );

  harness.view.render(failure);
  harness.view.dispose();
  harness.view.dispose();
  assert.equal(harness.timers.pendingCount, 0);
  assert.equal(harness.root.children.length, 0);
  assert.equal(harness.root.hasAttribute("data-combination-story"), true);
  assert.equal(harness.root.getAttribute("data-story-phase"), null);
  harness.timers.runAll();
  assert.throws(() => harness.view.render(failure), /disposed/u);
  assert.throws(() => harness.view.reset(), /disposed/u);
});

test("invalid DOM and timer dependencies fail closed", () => {
  assert.throws(
    () => createCombinationStoryView({ root: {} }),
    /dedicated DOM Element root/u
  );
  const { root } = fakeHost();
  assert.throws(
    () => createCombinationStoryView({
      root,
      timers: { setTimeout() {} }
    }),
    /setTimeout and clearTimeout/u
  );
  assert.deepEqual(COMBINATION_STORY_VIEW_SELECTORS, {
    root: "[data-combination-story]",
    summary: "[data-story-summary]",
    scene: "[data-story-scene]",
    layers: "[data-story-layers]",
    layer: "[data-story-layer]",
    layerEmoji: "[data-story-layer-emoji]",
    layerWord: "[data-story-layer-word]",
    empty: "[data-story-empty]",
    chapters: "[data-story-chapters]",
    chapter: "[data-story-chapter]",
    chapterTitle: "[data-story-chapter-title]",
    chapterNarration: "[data-story-chapter-narration]",
    narration: "[data-story-narration]"
  });
});
