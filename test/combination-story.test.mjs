import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCombinationStory,
  COMBINATION_STORY_CATEGORIES,
  COMBINATION_STORY_MAX_CHAPTERS,
  COMBINATION_STORY_SCENE_VARIANTS,
  COMBINATION_STORY_VERSION
} from "../public/story/combination-story.mjs";

const foundationStep = {
  a: "Earth",
  b: "Water",
  word: "Mud",
  emoji: "🟤",
  category: "nature"
};

const storyRoute = [
  foundationStep,
  { a: "Mud", b: "Fire", word: "Brick", emoji: "🧱", category: "structure" },
  { a: "Air", b: "Fire", word: "Energy", emoji: "⚡", category: "force" },
  { a: "Mud", b: "Energy", word: "Life", emoji: "🌱", category: "life" },
  { a: "Life", b: "Sky", word: "Angel", emoji: "😇", category: "celestial" }
];

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

function collectUnsafeMarkup(value, path = "root", found = []) {
  if (typeof value === "string" && /[<>]/u.test(value)) found.push(path);
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    collectUnsafeMarkup(child, `${path}.${key}`, found);
  }
  return found;
}

function collectKeys(value, keys = new Set()) {
  if (!value || typeof value !== "object") return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }
  return keys;
}

test("the first successful result becomes a deterministic immutable foundation", () => {
  const options = { target: "Island", history: [foundationStep] };
  const first = buildCombinationStory(options);
  const repeated = buildCombinationStory(options);

  assert.deepEqual(first, repeated);
  assert.equal(first.version, COMBINATION_STORY_VERSION);
  assert.equal(first.status, "building");
  assert.equal(first.complete, false);
  assert.equal(first.chapterCount, 1);
  assert.equal(first.chapters[0].title, "Foundation: Mud");
  assert.equal(first.chapters[0].kind, "foundation");
  assert.equal(first.chapters[0].relation, "foundation");
  assert.deepEqual(first.chapters[0].ingredients, ["Earth", "Water"]);
  assert.equal(first.chapters[0].layer.role, "foundation");
  assert.equal(first.chapters[0].layer.categoryRole, "landscape");
  assert.equal(first.chapters[0].layer.slot, 0);
  assert.equal(first.chapters[0].layer.motif, "terrain");
  assert.match(first.chapters[0].narration, /Mud becomes the foundation/u);
  assert.match(first.chapters[0].narration, /natural landscape/u);
  assert.equal(first.scene.layers[0], first.chapters[0].layer);
  assert.equal(first.scene.foundationLayerId, "story-layer-1");
  assert.ok(COMBINATION_STORY_SCENE_VARIANTS.includes(first.scene.variant));
  assertDeepFrozen(first);
});

test("later results add dependency-aware chapters and category-driven scene roles", () => {
  const model = buildCombinationStory({
    target: "Galaxy",
    history: storyRoute.slice(0, 4)
  });

  assert.deepEqual(
    model.chapters.map((chapter) => chapter.relation),
    ["foundation", "continuation", "parallel", "convergence"]
  );
  assert.deepEqual(
    model.chapters.map((chapter) => chapter.layer.categoryRole),
    ["landscape", "architecture", "energy", "inhabitants"]
  );
  assert.deepEqual(model.chapters[1].parentChapterIds, ["story-chapter-1"]);
  assert.deepEqual(model.chapters[2].parentChapterIds, []);
  assert.deepEqual(
    model.chapters[3].parentChapterIds,
    ["story-chapter-1", "story-chapter-3"]
  );
  assert.deepEqual(
    model.chapters[3].layer.parentLayerIds,
    ["story-layer-1", "story-layer-3"]
  );
  assert.match(model.chapters[1].narration, /built layer rises/u);
  assert.match(model.chapters[2].narration, /motion and energy/u);
  assert.match(model.chapters[3].narration, /chapter 1 and chapter 3/u);
  assert.match(model.chapters[3].narration, /living presence/u);
  assert.equal(new Set(model.scene.layers.map((layer) => layer.slot)).size, model.scene.layers.length);
  assert.ok(model.scene.layers.every((layer) => layer.variation >= 1 && layer.variation <= 4));
});

test("target and category signatures deterministically vary the visual scene", () => {
  const galaxy = buildCombinationStory({ target: "Galaxy", history: storyRoute.slice(0, 4) });
  const factory = buildCombinationStory({ target: "Factory", history: storyRoute.slice(0, 4) });
  const factoryFoundation = buildCombinationStory({ target: "Factory", history: storyRoute.slice(0, 1) });
  const repeated = buildCombinationStory({ target: "Factory", history: storyRoute.slice(0, 4) });
  assert.deepEqual(repeated.scene, factory.scene);
  assert.equal(factoryFoundation.scene.variant, factory.scene.variant);
  assert.equal(factoryFoundation.scene.palette, factory.scene.palette);
  assert.equal(factoryFoundation.scene.layers[0].slot, factory.scene.layers[0].slot);
  assert.equal(factoryFoundation.scene.layers[0].variation, factory.scene.layers[0].variation);
  assert.notDeepEqual(
    [factory.scene.variant, factory.scene.palette, factory.scene.layers.map((layer) => layer.slot)],
    [galaxy.scene.variant, galaxy.scene.palette, galaxy.scene.layers.map((layer) => layer.slot)]
  );
  assert.deepEqual(
    factory.scene.layers.map((layer) => layer.motif),
    ["terrain", "skyline", "current", "pulse"]
  );
});

test("reaching the target creates a finale and excludes post-finale history", () => {
  const model = buildCombinationStory({
    target: "aNgEl",
    history: [
      ...storyRoute,
      { a: "Angel", b: "Time", word: "Myth", emoji: "📜", category: "unknown" }
    ]
  });

  assert.equal(model.complete, true);
  assert.equal(model.status, "finale");
  assert.equal(model.truncated, true);
  assert.equal(model.chapterCount, 5);
  assert.equal(model.chapters.at(-1).kind, "finale");
  assert.equal(model.chapters.at(-1).title, "Finale: Angel");
  assert.equal(model.chapters.at(-1).layer.role, "finale");
  assert.equal(model.chapters.at(-1).layer.categoryRole, "sky");
  assert.match(model.chapters.at(-1).narration, /target aNgEl completes the scene/u);
  assert.equal(model.chapters.some((chapter) => chapter.result.word === "Myth"), false);
  assert.equal(model.scene.focusLayerId, "story-layer-5");
});

test("a wrong pair crumbles and rebuilds every layer without changing valid history", () => {
  const history = storyRoute.slice(0, 4);
  const originalInput = JSON.parse(JSON.stringify(history));
  const baseline = buildCombinationStory({ target: "Angel", history });
  const failedOptions = {
    target: "Angel",
    history,
    failedAttempt: { a: "Brick", b: "Moon" }
  };
  const failed = buildCombinationStory(failedOptions);
  const repeated = buildCombinationStory(failedOptions);
  const forwardLayerIds = baseline.scene.layers.map((layer) => layer.id);

  assert.deepEqual(history, originalInput);
  assert.deepEqual(failed.chapters, baseline.chapters);
  assert.deepEqual(failed.scene, baseline.scene);
  assert.deepEqual(failed.event, repeated.event);
  assert.equal(failed.event.type, "crumble-rebuild");
  assert.equal(failed.event.scope, "all-scene");
  assert.equal(failed.event.cause, "wrong-pair");
  assert.equal(failed.event.historyEffect, "none");
  assert.equal(failed.event.preservesValidStory, true);
  assert.equal(failed.event.restoreChapterCount, baseline.chapterCount);
  assert.deepEqual(failed.event.restoreLayerIds, forwardLayerIds);
  assert.deepEqual(failed.event.phases[0], {
    id: "crumble",
    order: 1,
    action: "crumble",
    layerIds: [...forwardLayerIds].reverse()
  });
  assert.deepEqual(failed.event.phases[1], {
    id: "rebuild",
    order: 2,
    action: "rebuild",
    layerIds: forwardLayerIds,
    focusLayerId: forwardLayerIds.at(-1)
  });
  assert.match(failed.event.narration, /without losing progress/u);
  assert.match(failed.accessibility.announcement, /whole scene crumbles/u);
});

test("a failed first attempt produces an accessible empty-scene rebuild event", () => {
  const model = buildCombinationStory({
    target: "Mud",
    history: [],
    failedAttempt: { a: "Earth", b: "Fire" }
  });

  assert.equal(model.status, "empty");
  assert.equal(model.chapterCount, 0);
  assert.deepEqual(model.event.restoreLayerIds, []);
  assert.deepEqual(model.event.phases[0].layerIds, []);
  assert.deepEqual(model.event.phases[1].layerIds, []);
  assert.equal(model.event.phases[1].focusLayerId, "");
  assert.match(model.event.narration, /empty scene settles/u);
});

test("hostile and oversized inputs are sanitized and bounded", () => {
  const history = Array.from({ length: COMBINATION_STORY_MAX_CHAPTERS + 12 }, (_, index) => ({
    a: `Seed${index}`,
    b: `Wave${index}`,
    word: `Element${index}`,
    emoji: "✨<>&\"'",
    category: "script"
  }));
  history.splice(1, 0, {
    a: "<script>",
    b: "Water",
    word: "Exploit",
    emoji: "<img>",
    category: "nature"
  });
  const model = buildCombinationStory({
    target: "<script>alert(1)</script>",
    history,
    failedAttempt: { a: "Valid", b: "<invalid>" }
  });

  assert.equal(model.target, "");
  assert.equal(model.chapterCount, COMBINATION_STORY_MAX_CHAPTERS);
  assert.equal(model.truncated, true);
  assert.equal(model.event, null);
  assert.ok(model.chapters.every((chapter) => chapter.result.category === "unknown"));
  assert.ok(model.chapters.every((chapter) => chapter.result.emoji === "✨"));
  assert.deepEqual(collectUnsafeMarkup(model), []);
  assert.deepEqual(COMBINATION_STORY_CATEGORIES, [
    "force",
    "nature",
    "life",
    "structure",
    "celestial",
    "unknown"
  ]);
});

test("the presentation model exposes no persistence or progression effects", () => {
  const model = buildCombinationStory({
    target: "Mud",
    history: [foundationStep]
  });
  const expectedTopLevelKeys = [
    "version",
    "target",
    "status",
    "complete",
    "truncated",
    "chapterCount",
    "summary",
    "chapters",
    "scene",
    "event",
    "accessibility"
  ];
  const forbiddenEffectKeys = ["cloud", "credits", "economy", "rank", "reward", "score", "xp"];

  assert.deepEqual(Object.keys(model), expectedTopLevelKeys);
  const keys = collectKeys(model);
  for (const forbidden of forbiddenEffectKeys) assert.equal(keys.has(forbidden), false);

  const source = readFileSync(
    new URL("../public/story/combination-story.mjs", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /\b(?:fetch|localStorage|sessionStorage|document|window)\s*(?:\.|\()/u
  );
});
