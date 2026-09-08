import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCombiningBoardSceneModel,
  createCombiningBoardFarField,
  createCombiningBoardRuntime,
  describeCombiningBoardFusion,
  readCombiningBoardPalette,
  normalizeLiveNodeAnchors
} from "../public/combining-board-runtime.mjs";

function makeSceneSpy() {
  const calls = {
    options: [],
    sync: [],
    resize: [],
    beginFusion: [],
    commitFusion: [],
    cancelFusion: 0,
    suspend: 0,
    resume: 0,
    destroy: 0
  };
  const controller = {
    sync(value) { calls.sync.push(value); },
    resize(value) { calls.resize.push(value); },
    beginFusion(value) { calls.beginFusion.push(value); },
    commitFusion(value) { calls.commitFusion.push(value); },
    cancelFusion() { calls.cancelFusion += 1; },
    suspend() { calls.suspend += 1; },
    resume() { calls.resume += 1; },
    destroy() { calls.destroy += 1; },
    snapshot() { return Object.freeze({ spy: true }); }
  };
  return {
    calls,
    factory(options) {
      calls.options.push(options);
      return controller;
    }
  };
}

class FakeResizeObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    this.disconnected = false;
    FakeResizeObserver.instances.push(this);
  }

  observe(target) {
    this.observed.push(target);
  }

  disconnect() {
    this.disconnected = true;
  }

  emit(contentRect, target = this.observed[0]) {
    this.callback([{ target, contentRect }]);
  }
}

function sourceSnapshot(overrides = {}) {
  return {
    mode: "ranked",
    quality: "standard",
    words: [
      { word: "Fire", category: "force" },
      { word: "Air", category: "force" },
      { word: "Water", category: "force" },
      { word: "Ocean" },
      { word: "House" },
      { word: "Wall" }
    ],
    history: [
      { a: "Fire", b: "Water", word: "Steam" },
      { a: "Earth", b: "Water", word: "Mud", routeStepsAdvanced: 1 }
    ],
    nodes: [
      { id: 1, item: { word: "Fire" }, x: 100, y: 100 },
      { id: 2, item: { word: "Water" }, x: 200, y: 150 },
      { id: 3, item: { word: "Steam" }, x: 300, y: 200 }
    ],
    target: "Horizon",
    earnedRouteProgress: { progress: 40, stepsAdvanced: 2, stepsRemaining: 3 },
    ...overrides
  };
}

test("client fusion facts and cosmetic palette are projected by the lazy board pack", () => {
  const fusion = describeCombiningBoardFusion(
    { x: 100, y: 80 }, { x: 300, y: 180 },
    { word: "Fire", emoji: "🔥" }, { word: "Water", emoji: "💧" },
    { word: "Steam", emoji: "☁" }, true, 1, false, false, true, "faster"
  );
  assert.deepEqual(fusion.at, { x: 200, y: 130 });
  assert.equal(fusion.foundationalPair, true);
  assert.equal(fusion.finalTarget, true);
  assert.deepEqual(fusion.sources.map(({ label, emoji }) => ({ label, emoji })), [
    { label: "Fire", emoji: "🔥" },
    { label: "Water", emoji: "💧" }
  ]);

  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ getPropertyValue: (name) => name === "--board-c" ? " #123456 " : "" });
  try {
    const palette = readCombiningBoardPalette({});
    assert.equal(palette.space, "#123456");
    assert.equal(palette.route, "#f1c86e");
  } finally {
    if (previous) globalThis.getComputedStyle = previous;
    else delete globalThis.getComputedStyle;
  }
});

test("live gameplay nodes normalize against measured board bounds without duplicating words", () => {
  const anchors = normalizeLiveNodeAnchors({
    bounds: { left: 50, top: 25, width: 1_000, height: 500 },
    nodes: [
      { item: { word: "Fire" }, x: 100, y: 50 },
      { item: { word: " FIRE " }, x: 900, y: 450 },
      { item: { word: "Water" }, x: 550, y: 275, coordinateSpace: "viewport" },
      { item: { word: "Air" }, x: 0.4, y: 0.6, normalized: true },
      { item: { word: "Invalid" }, x: "nope", y: 20 }
    ]
  });

  assert.deepEqual(anchors, [
    { word: "Fire", x: 0.1, y: 0.1 },
    { word: "Water", x: 0.5, y: 0.5 },
    { word: "Air", x: 0.4, y: 0.6 }
  ]);
  assert.ok(Object.isFrozen(anchors));
  assert.ok(anchors.every(Object.isFrozen));
});

test("live gameplay nodes retain offscreen anchors for a panned camera", () => {
  const anchors = normalizeLiveNodeAnchors({
    nodes: [{ item: { word: "Earth" }, x: -80, y: 720 }],
    bounds: { left: 0, top: 0, width: 400, height: 600 }
  });

  assert.deepEqual(anchors, [
    { word: "Earth", x: -0.2, y: 1.2, unclamped: true }
  ]);
});

test("scene mapping projects semantics, live anchors, performed memory, and earned route only", () => {
  const model = buildCombiningBoardSceneModel({
    bounds: { width: 1_000, height: 500 },
    snapshot: sourceSnapshot({
      history: [
        { a: "Fire", b: "Water", word: "Steam" },
        { a: "Earth", b: "Water", word: "Mud", routeDerived: true },
        { a: "Secret A", b: "Secret B", word: "Future Word", future: true, routeCompleted: true }
      ],
      futureRecipes: [{ a: "Sun", b: "Void", word: "Spoiler Singularity" }],
      earnedRouteEvidence: [
        {
          id: "unearned-claim",
          from: "memory:0:ingredient-a",
          to: "memory:0:result",
          earned: false,
          label: "Spoiler Singularity"
        },
        {
          id: "earned-extra",
          from: "memory:0:ingredient-a",
          to: "memory:0:result",
          earned: true
        },
        {
          id: "invented-endpoint",
          from: "memory:0:result",
          to: "future-route-node",
          earned: true
        }
      ]
    })
  });

  assert.equal(model.mode, "ranked");
  assert.ok(model.semanticBeacons.length > 0 && model.semanticBeacons.length <= 6);
  assert.equal(model.memoryStars.length, 6);
  assert.equal(model.memoryEdges.length, 4);
  assert.equal(model.routeEdges.length, 3, "two derived route threads plus one explicitly earned known-node thread");
  assert.ok(model.routeEdges.every(({ earned }) => earned === true));
  assert.ok(model.routeEdges.every(({ to }) => to !== "current-target"));
  assert.deepEqual(
    model.memoryStars.find(({ id }) => id === "memory:0:ingredient-a"),
    {
      id: "memory:0:ingredient-a",
      x: 0.1,
      y: 0.2,
      source: "live",
      route: false,
      radius: 1.8,
      alpha: 0.42
    }
  );
  assert.equal(model.targetBeacon.disconnected, true);
  assert.equal(model.targetBeacon.label, "Horizon");
  assert.equal(model.routeProgress.progress, 0.4);
  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /Future Word|Spoiler Singularity|future-route-node|Secret A|Secret B/);
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(model.routeEdges));
});

test("mode mapping keeps Explore spoiler-free and strips ordinary chrome during Reveal and Scramble", () => {
  const common = sourceSnapshot();
  const explore = buildCombiningBoardSceneModel({ snapshot: { ...common, mode: "explore" }, bounds: { width: 800, height: 500 } });
  assert.ok(explore.memoryStars.length > 0);
  assert.equal(explore.routeEdges.length, 0);
  assert.equal(explore.targetBeacon, null);

  const scramble = buildCombiningBoardSceneModel({ snapshot: { ...common, mode: "scramble" }, bounds: { width: 800, height: 500 } });
  assert.equal(scramble.memoryStars.length, 0);
  assert.equal(scramble.memoryEdges.length, 0);
  assert.equal(scramble.routeEdges.length, 0);
  assert.equal(scramble.semanticBeacons.length, 0);
  assert.equal(scramble.targetBeacon, null);

  const reveal = buildCombiningBoardSceneModel({ snapshot: { ...common, mode: "reveal" }, bounds: { width: 800, height: 500 } });
  assert.equal(reveal.rules.suspended, true);
  assert.equal(reveal.memoryStars.length, 0);
  assert.equal(reveal.semanticBeacons.length, 0);
  assert.equal(reveal.targetBeacon, null);
});

test("semantic positions and deterministic far field remain stable across sync order and resize", () => {
  const normal = sourceSnapshot();
  const reversed = { ...normal, words: [...normal.words].reverse() };
  const first = buildCombiningBoardSceneModel({ snapshot: normal, bounds: { width: 1_000, height: 600 } });
  const second = buildCombiningBoardSceneModel({ snapshot: reversed, bounds: { width: 480, height: 320 } });
  const firstBeacons = new Map(first.semanticBeacons.map(({ id, x, y }) => [id, { x, y }]));
  const secondBeacons = new Map(second.semanticBeacons.map(({ id, x, y }) => [id, { x, y }]));
  for (const [id, point] of firstBeacons) assert.deepEqual(secondBeacons.get(id), point);

  assert.equal(createCombiningBoardFarField({ quality: "standard" }), createCombiningBoardFarField({ quality: "standard" }));
  assert.deepEqual(first.farField.stars, second.farField.stars);
  assert.deepEqual(first.farField.nebulae, second.farField.nebulae);
  assert.equal(createCombiningBoardFarField({ quality: "low" }).stars.length, 32);
  assert.equal(createCombiningBoardFarField({ quality: "standard" }).stars.length, 56);
});

test("runtime observes board resize, remaps live anchors, and disconnects cleanly", () => {
  FakeResizeObserver.instances.length = 0;
  const rect = { left: 0, top: 0, width: 500, height: 250 };
  const board = { getBoundingClientRect: () => ({ ...rect }) };
  const canvas = {};
  const scene = makeSceneSpy();
  const source = sourceSnapshot({
    history: [{ a: "Fire", b: "Water", word: "Steam" }],
    nodes: [{ id: 1, item: { word: "Fire" }, x: 100, y: 50 }]
  });
  const runtime = createCombiningBoardRuntime({
    canvas,
    board,
    getSnapshot: () => source,
    ResizeObserver: FakeResizeObserver,
    createScene: scene.factory
  });

  assert.equal(scene.calls.options.length, 1);
  assert.equal(scene.calls.options[0].canvas, canvas);
  assert.equal(scene.calls.options[0].board, board);
  assert.equal(FakeResizeObserver.instances.length, 1);
  assert.deepEqual(FakeResizeObserver.instances[0].observed, [board]);
  assert.deepEqual(
    scene.calls.sync.at(-1).memoryStars.find(({ id }) => id === "memory:0:ingredient-a"),
    { id: "memory:0:ingredient-a", x: 0.2, y: 0.2, source: "live", route: false, radius: 1.8, alpha: 0.42 }
  );

  FakeResizeObserver.instances[0].emit({ left: 0, top: 0, width: 1_000, height: 500 });
  assert.deepEqual(scene.calls.resize.at(-1), { width: 1_000, height: 500, quality: "standard" });
  assert.deepEqual(
    scene.calls.sync.at(-1).memoryStars.find(({ id }) => id === "memory:0:ingredient-a"),
    { id: "memory:0:ingredient-a", x: 0.1, y: 0.1, source: "live", route: false, radius: 1.8, alpha: 0.42 }
  );
  assert.deepEqual(runtime.snapshot().bounds, { left: 0, top: 0, width: 1_000, height: 500 });
  assert.ok(Object.isFrozen(runtime.snapshot()));

  const resizeCalls = scene.calls.resize.length;
  runtime.destroy();
  assert.equal(FakeResizeObserver.instances[0].disconnected, true);
  assert.equal(scene.calls.destroy, 1);
  FakeResizeObserver.instances[0].emit({ width: 300, height: 200 });
  assert.equal(scene.calls.resize.length, resizeCalls);
  assert.equal(runtime.snapshot().destroyed, true);
});

test("runtime delegates classified fusion tiers, drag state, and mode ceilings", () => {
  const rect = { left: 10, top: 20, width: 200, height: 100 };
  const board = { getBoundingClientRect: () => rect };
  const scene = makeSceneSpy();
  let source = sourceSnapshot();
  const runtime = createCombiningBoardRuntime({
    canvas: {},
    board,
    getSnapshot: () => source,
    ResizeObserver: null,
    createScene: scene.factory
  });

  runtime.beginFusion({ goldenPair: true, position: { x: 110, y: 70, coordinateSpace: "viewport" } });
  assert.deepEqual(scene.calls.beginFusion.at(-1), { tier: "hero", position: { x: 0.5, y: 0.5 }, speed: 1, sources: [], result: "" });
  assert.equal(runtime.snapshot().fusionTier, "hero");
  runtime.commitFusion({ result: "Horizon" });
  assert.equal(scene.calls.commitFusion.at(-1).tier, "hero", "commit does not downgrade an already-authored hero charge");
  runtime.cancelFusion();
  assert.equal(scene.calls.cancelFusion, 1);
  runtime.commitFusion({
    newDiscovery: true,
    result: "Steam",
    sources: [
      { x: 10, y: 20, coordinateSpace: "viewport", label: "Earth", emoji: "🌍" },
      { x: 210, y: 120, coordinateSpace: "viewport", word: "Water", emoji: "💧" }
    ]
  });
  assert.deepEqual(scene.calls.commitFusion.at(-1).sources, [
    { x: 0, y: 0, label: "Earth", emoji: "🌍" },
    { x: 1, y: 1, label: "Water", emoji: "💧" }
  ]);
  runtime.cancelFusion();
  runtime.beginFusion({ newDiscovery: true, effects: "faster" });
  assert.equal(scene.calls.beginFusion.at(-1).speed, 1.7);
  runtime.cancelFusion();

  runtime.setDrag({
    active: true,
    from: { x: 10, y: 20, coordinateSpace: "viewport" },
    to: { x: 210, y: 120, coordinateSpace: "viewport" }
  });
  assert.deepEqual(scene.calls.sync.at(-1), {
    drag: { active: true, from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }
  });
  assert.equal(runtime.snapshot().dragActive, true);
  runtime.setDrag(null);
  assert.deepEqual(scene.calls.sync.at(-1), { drag: null });

  source = { ...source, mode: "tutorial" };
  runtime.sync();
  runtime.beginFusion({ goldenPair: true });
  assert.equal(scene.calls.beginFusion.at(-1).tier, "discovery");

  source = { ...source, mode: "scramble" };
  runtime.sync();
  runtime.beginFusion({ goldenPair: true });
  assert.equal(scene.calls.beginFusion.at(-1).tier, "micro");

  const beginCount = scene.calls.beginFusion.length;
  runtime.beginFusion({ routeCompleted: true, effects: "off" });
  assert.equal(scene.calls.beginFusion.length, beginCount);
  assert.equal(scene.calls.cancelFusion, 4);

  source = { ...source, mode: "reveal" };
  runtime.sync();
  runtime.beginFusion({ goldenPair: true });
  assert.equal(scene.calls.beginFusion.length, beginCount);
  assert.equal(scene.calls.cancelFusion, 5);
});

test("runtime suspension is reason-aware and Reveal suspension restores on mode exit", () => {
  const scene = makeSceneSpy();
  let source = sourceSnapshot();
  const runtime = createCombiningBoardRuntime({
    canvas: {},
    board: { getBoundingClientRect: () => ({ width: 800, height: 500 }) },
    getSnapshot: () => source,
    ResizeObserver: null,
    createScene: scene.factory
  });

  runtime.suspend("dialog");
  runtime.suspend("background");
  assert.equal(scene.calls.suspend, 1);
  assert.deepEqual(runtime.snapshot().suspensionReasons, ["background", "dialog"]);
  runtime.resume("dialog");
  assert.equal(scene.calls.resume, 0);
  runtime.resume("background");
  assert.equal(scene.calls.resume, 1);

  source = { ...source, mode: "reveal" };
  runtime.sync();
  assert.equal(scene.calls.suspend, 2);
  assert.equal(runtime.snapshot().suspended, true);
  source = { ...source, mode: "ranked" };
  runtime.sync();
  assert.equal(scene.calls.resume, 2);
  assert.equal(runtime.snapshot().suspended, false);
});

test("runtime snapshot exposes presentation facts but never retains recipe or route secrets", () => {
  const scene = makeSceneSpy();
  const runtime = createCombiningBoardRuntime({
    canvas: {},
    board: { getBoundingClientRect: () => ({ width: 800, height: 500 }) },
    getSnapshot: () => sourceSnapshot({
      futureRecipes: [{ a: "Hidden", b: "Route", word: "Secret Destination" }],
      route: [{ a: "Hidden", b: "Route", word: "Secret Destination" }]
    }),
    ResizeObserver: null,
    createScene: scene.factory
  });
  const snapshot = runtime.snapshot();
  assert.doesNotMatch(JSON.stringify(snapshot), /Hidden|Secret Destination|futureRecipes/);
  assert.deepEqual(Object.keys(snapshot).sort(), [
    "bounds",
    "destroyed",
    "dragActive",
    "fusionTier",
    "hasDisconnectedTarget",
    "memoryEdgeCount",
    "memoryStarCount",
    "mode",
    "quality",
    "routeEdgeCount",
    "routeProgress",
    "scene",
    "semanticBeaconCount",
    "suspended",
    "suspensionReasons"
  ]);
});
