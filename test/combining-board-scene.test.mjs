import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBINING_BOARD_DPR_CAPS,
  COMBINING_BOARD_FUSION_DURATIONS_MS,
  capCombiningBoardDpr,
  createCombiningBoardScene
} from "../public/combining-board-scene.mjs";

class FakeGradient {
  constructor(calls) {
    this.calls = calls;
  }

  addColorStop(offset, value) {
    this.calls.push(["addColorStop", offset, value]);
  }
}

class FakeContext {
  constructor() {
    this.calls = [];
  }

  record(name, ...args) {
    this.calls.push([name, ...args]);
  }

  save() { this.record("save"); }
  restore() { this.record("restore"); }
  beginPath() { this.record("beginPath"); }
  fill() { this.record("fill"); }
  stroke() { this.record("stroke"); }
  moveTo(...args) { this.record("moveTo", ...args); }
  lineTo(...args) { this.record("lineTo", ...args); }
  arc(...args) { this.record("arc", ...args); }
  fillRect(...args) { this.record("fillRect", ...args); }
  clearRect(...args) { this.record("clearRect", ...args); }
  setTransform(...args) { this.record("setTransform", ...args); }
  setLineDash(...args) { this.record("setLineDash", ...args); }
  fillText(...args) { this.record("fillText", ...args); }

  createRadialGradient(...args) {
    this.record("createRadialGradient", ...args);
    return new FakeGradient(this.calls);
  }
}

function createHarness({
  width = 800,
  height = 450,
  dpr = 2,
  reducedMotion = false,
  forcedColors = false
} = {}) {
  let time = 0;
  let nextFrame = 1;
  const frames = new Map();
  const cancelled = [];
  const attributes = new Map();
  const context = new FakeContext();
  const view = {
    performance: { now: () => time },
    requestAnimationFrame(callback) {
      const id = nextFrame;
      nextFrame += 1;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      cancelled.push(id);
      frames.delete(id);
    }
  };
  const canvas = {
    width: 0,
    height: 0,
    clientWidth: width,
    clientHeight: height,
    style: {},
    ownerDocument: { defaultView: view },
    getContext: (kind) => kind === "2d" ? context : null,
    getBoundingClientRect: () => ({ width, height }),
    setAttribute(name, value) {
      attributes.set(name, String(value));
    }
  };
  const scene = createCombiningBoardScene({
    canvas,
    devicePixelRatio: () => dpr,
    reducedMotion: () => reducedMotion,
    forcedColors: () => forcedColors
  });

  return {
    canvas,
    context,
    scene,
    attributes,
    cancelled,
    pending: () => frames.size,
    setReducedMotion(value) { reducedMotion = Boolean(value); },
    setForcedColors(value) { forcedColors = Boolean(value); },
    flush(delta = 16) {
      time += delta;
      const ready = [...frames.entries()];
      frames.clear();
      for (const [, callback] of ready) callback(time);
      return ready.length;
    }
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

test("the scene is inert, event-driven, and owns a clean lifecycle", () => {
  const harness = createHarness();
  const { canvas, scene } = harness;

  assert.equal(harness.attributes.get("aria-hidden"), "true");
  assert.equal(harness.attributes.get("tabindex"), "-1");
  assert.equal(canvas.tabIndex, -1);
  assert.equal(canvas.style.pointerEvents, "none");
  assert.equal(harness.pending(), 1, "creation schedules exactly one initial paint");

  harness.flush();
  assert.equal(scene.snapshot().renderCount, 1);
  assert.equal(harness.pending(), 0, "a static scene does not maintain an idle loop");

  scene.invalidate();
  scene.invalidate();
  assert.equal(harness.pending(), 1, "repeated invalidations coalesce into one frame");
  harness.flush();
  assert.equal(scene.snapshot().renderCount, 2);

  scene.invalidate();
  assert.equal(harness.pending(), 1);
  scene.suspend();
  assert.equal(harness.pending(), 0);
  assert.equal(scene.snapshot().suspended, true);

  scene.sync({ stars: [{ x: 0.2, y: 0.3 }] });
  assert.equal(harness.pending(), 0, "work remains dirty without painting while suspended");
  scene.resume();
  assert.equal(harness.pending(), 1);
  harness.flush();

  const beforeDestroy = scene.snapshot().renderCount;
  const destroyed = scene.destroy();
  assert.equal(destroyed.destroyed, true);
  assert.equal(harness.pending(), 0);
  assert.equal(scene.invalidate(), false);
  assert.equal(scene.snapshot().renderCount, beforeDestroy);
});

test("DPR is capped independently for low and standard quality", () => {
  assert.equal(capCombiningBoardDpr(4, "low"), COMBINING_BOARD_DPR_CAPS.low);
  assert.equal(capCombiningBoardDpr(4, "standard"), COMBINING_BOARD_DPR_CAPS.standard);
  assert.equal(capCombiningBoardDpr(0.5, "standard"), 1);

  const harness = createHarness({ width: 320, height: 200, dpr: 4 });
  assert.equal(harness.scene.snapshot().metrics.dpr, 1.75);
  assert.equal(harness.canvas.width, 560);
  assert.equal(harness.canvas.height, 350);

  harness.scene.resize({ width: 320, height: 200, quality: "low", devicePixelRatio: 4 });
  assert.equal(harness.scene.snapshot().metrics.dpr, 1.25);
  assert.equal(harness.canvas.width, 400);
  assert.equal(harness.canvas.height, 250);
  harness.flush();
  harness.scene.sync({ stars: [] });
  harness.flush();
  assert.equal(harness.scene.snapshot().metrics.dpr, 1.25, "resize quality persists across later syncs");
});

test("projected scene data is bounded and painted only when dirty", () => {
  const harness = createHarness();
  harness.flush();
  const before = harness.scene.snapshot().renderCount;

  harness.scene.sync({
    farField: {
      stars: [{ x: 0.1, y: 0.2, warm: true }],
      nebulae: [{ x: 0.45, y: 0.5, radius: 0.3 }]
    },
    semanticBeacons: Array.from({ length: 9 }, (_, index) => ({
      id: `facet-${index}`,
      label: `Facet ${index}`,
      x: 0.1 + index * 0.07,
      y: 0.75,
      active: index === 2
    })),
    memory: {
      stars: [
        { id: "earth", x: 0.2, y: 0.5 },
        { id: "water", x: 0.38, y: 0.5 }
      ],
      edges: [{ from: "earth", to: "water" }]
    },
    route: {
      edges: [
        { from: "earth", to: "water", earned: true },
        { from: "water", to: { x: 0.7, y: 0.42 }, earned: false }
      ],
      target: { id: "horizon", label: "HORIZON", x: 0.84, y: 0.3 }
    },
    cosmeticColors: { route: "#ffcc77", beacon: "#55eeff" }
  });

  const pending = harness.scene.snapshot();
  assert.equal(pending.semanticBeaconCount, 6, "only six category beacons enter the scene");
  assert.equal(pending.memoryStarCount, 2);
  assert.equal(pending.memoryEdgeCount, 1);
  assert.equal(pending.routeEdgeCount, 1, "unearned route geometry is rejected");
  assert.equal(pending.hasDisconnectedTarget, true);
  assert.equal(harness.pending(), 1);

  harness.flush();
  assert.equal(harness.scene.snapshot().renderCount, before + 1);
  assert.equal(harness.pending(), 0);
  assert.ok(harness.context.calls.some(([name]) => name === "createRadialGradient"));
  assert.ok(harness.context.calls.some(([name]) => name === "fillText"));
});

test("committed fusion tiers animate to completion and release the frame loop", () => {
  const harness = createHarness();
  harness.flush();

  harness.scene.beginFusion({ tier: "micro", position: { x: 0.45, y: 0.52 } });
  assert.deepEqual(harness.scene.snapshot().fusion, {
    tier: "micro",
    phase: "charging",
    progress: 0,
    durationMs: COMBINING_BOARD_FUSION_DURATIONS_MS.micro,
    speed: 1
  });
  harness.flush(16);
  assert.equal(harness.pending(), 1, "an active charge keeps the loop alive");

  const linesBeforeImpact = harness.context.calls.filter(([name]) => name === "lineTo").length;
  harness.scene.commitFusion({
    result: "Mud",
    sources: [
      { x: 0.2, y: 0.7, emoji: "🌍", label: "Earth" },
      { x: 0.8, y: 0.34, emoji: "💧", label: "Water" }
    ]
  });
  assert.equal(harness.scene.snapshot().fusion.phase, "release");
  harness.flush(360);
  assert.ok(harness.scene.snapshot().fusion.progress > 0);
  harness.flush(16);
  assert.ok(
    harness.context.calls.filter(([name]) => name === "lineTo").length >= linesBeforeImpact + 3,
    "two ingredient meteors converge and the result ascends"
  );
  const fusionLabels = harness.context.calls
    .filter(([name]) => name === "fillText")
    .map(([, label]) => label);
  assert.ok(fusionLabels.some((label) => String(label).includes("Earth")));
  assert.ok(fusionLabels.some((label) => String(label).includes("Water")));
  assert.ok(fusionLabels.includes("Mud"));
  assert.equal(harness.pending(), 1);
  harness.flush(400);
  assert.equal(harness.scene.snapshot().fusion, null);
  assert.equal(harness.pending(), 0, "the loop stops on the first completed frame");

  harness.scene.beginFusion({ tier: "hero" });
  harness.flush();
  assert.equal(harness.scene.snapshot().animating, true);
  harness.scene.cancelFusion();
  harness.flush();
  assert.equal(harness.scene.snapshot().fusion, null);
  assert.equal(harness.pending(), 0);
});

test("drag and explicit ambient motion are the only non-fusion loop owners", () => {
  const harness = createHarness();
  harness.flush();

  harness.scene.sync({
    drag: {
      active: true,
      from: { x: 0.2, y: 0.2 },
      to: { x: 0.6, y: 0.7 }
    }
  });
  harness.flush();
  assert.equal(harness.pending(), 1);
  assert.equal(harness.scene.snapshot().animating, true);

  harness.scene.sync({ drag: null });
  harness.flush();
  assert.equal(harness.pending(), 0);

  harness.scene.sync({ ambientAnimation: true, stars: [{ x: 0.5, y: 0.5 }] });
  harness.flush();
  assert.equal(harness.pending(), 1);
  harness.scene.sync({ ambientAnimation: false });
  harness.flush();
  assert.equal(harness.pending(), 0);
});

test("reduced motion renders static fusion feedback without a continuing loop", () => {
  const harness = createHarness({ reducedMotion: true });
  harness.flush();

  harness.scene.beginFusion({ tier: "hero" });
  assert.equal(harness.scene.snapshot().fusion.durationMs, 0);
  harness.flush();
  assert.equal(harness.pending(), 0);
  assert.equal(harness.scene.snapshot().fusion.phase, "charging");

  harness.scene.commitFusion({ result: "Horizon" });
  harness.flush();
  assert.equal(harness.scene.snapshot().fusion, null);
  assert.equal(harness.pending(), 0);

  harness.scene.sync({ ambientAnimation: true });
  harness.flush();
  assert.equal(harness.pending(), 0, "ambient twinkle is suppressed under reduced motion");
});

test("forced colors avoids decorative nebula gradients and remains on demand", () => {
  const harness = createHarness({ forcedColors: true });
  harness.scene.sync({
    nebulae: [{ x: 0.5, y: 0.5, radius: 0.4 }],
    memoryStars: [{ x: 0.4, y: 0.5 }],
    targetBeacon: { x: 0.75, y: 0.25, label: "TARGET" }
  });
  harness.flush();
  assert.equal(harness.scene.snapshot().forcedColors, true);
  assert.equal(
    harness.context.calls.filter(([name]) => name === "createRadialGradient").length,
    0
  );
  assert.equal(harness.pending(), 0);
});

test("sync, render, fusion, and snapshots never mutate caller-owned data", () => {
  const input = deepFreeze({
    quality: "low",
    farField: {
      animate: false,
      palette: { nebula: "#224466" },
      stars: [{ id: "far", x: 0.1, y: 0.2, radius: 1.4 }],
      nebulae: [{ x: 0.7, y: 0.3, radius: 0.25 }]
    },
    semanticBeacons: [{ id: "liquids", label: "Liquids", x: 0.2, y: 0.8, count: 4 }],
    memory: {
      stars: [
        { id: "water", x: 0.3, y: 0.4 },
        { id: "fire", x: 0.5, y: 0.4 }
      ],
      edges: [{ id: "ancestry", from: "water", to: "fire" }]
    },
    earnedRouteEdges: [{ from: "water", to: "fire", earned: true }],
    targetBeacon: { id: "steam", label: "STEAM", x: 0.8, y: 0.22 },
    cosmetic: { colors: { route: "#f0c36a" } }
  });
  const before = JSON.stringify(input);
  const harness = createHarness();
  harness.scene.sync(input);
  harness.flush();
  harness.scene.beginFusion(deepFreeze({ tier: "discovery", at: { x: 0.4, y: 0.4 } }));
  harness.flush();
  harness.scene.commitFusion(deepFreeze({ result: "Steam" }));
  harness.flush(100);

  assert.equal(JSON.stringify(input), before);
  const first = harness.scene.snapshot();
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.metrics));
  assert.throws(() => {
    first.metrics.width = 99;
  }, TypeError);
  assert.notEqual(harness.scene.snapshot().metrics.width, 99);
});
