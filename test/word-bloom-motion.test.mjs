import assert from "node:assert/strict";
import test from "node:test";

import {
  bloomBoardTapAllowed,
  bloomPaletteMetrics,
  bloomPointFromPointer,
  createBloomTransitions,
  positionConstellationBloom
} from "../public/word-bloom-view.mjs";

const deferred = () => {
  let resolve;
  const promise = new Promise((settle) => { resolve = settle; });
  return { promise, resolve };
};

const flush = async (turns = 6) => {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
};

function transitionFixture({ reduced = false } = {}) {
  const outgoing = deferred();
  const incoming = deferred();
  const root = {
    dataset: {},
    ownerDocument: { body: { dataset: {} } }
  };
  const animated = {
    getAnimations() {
      return [{ finished: root.dataset.transitionPhase === "out" ? outgoing.promise : incoming.promise }];
    }
  };
  const layer = (selector) => selector.includes("shell") ? [animated] : [];
  const bloom = {
    root,
    trigger: animated,
    categories: { querySelectorAll: layer },
    words: { querySelectorAll: layer },
    ghost: { hidden: true, classList: { add() {}, remove() {} } }
  };
  const viewWindow = {
    matchMedia: () => ({ matches: reduced }),
    requestAnimationFrame: (callback) => queueMicrotask(callback),
    setTimeout,
    clearTimeout
  };
  return { bloom, incoming, outgoing, root, setReduced(value) { reduced = value; }, viewWindow };
}

test("Bloom waits for outgoing petals before swapping and incoming petals before settling", async () => {
  const fixture = transitionFixture();
  const events = [];
  const transitions = createBloomTransitions({
    bloom: fixture.bloom,
    viewWindow: fixture.viewWindow,
    onSwap: ({ phase }) => events.push(`swap:${phase}`),
    onSettle: ({ phase }) => events.push(`settle:${phase}`)
  });

  const finished = transitions.begin("categories", "words", { kind: "category-commit", duration: 20 });
  assert.equal(fixture.root.dataset.transitionPhase, "out");
  await flush();
  assert.deepEqual(events, []);

  fixture.outgoing.resolve();
  await flush();
  assert.equal(fixture.root.dataset.transitionPhase, "in");
  assert.deepEqual(events, ["swap:in"]);

  fixture.incoming.resolve();
  await finished;
  assert.deepEqual(events, ["swap:in", "settle:settled"]);
  assert.equal("transition" in fixture.root.dataset, false);
  assert.equal("transitionPhase" in fixture.root.dataset, false);
});

test("switching effects off completes an interrupted Bloom without leaving transition state", async () => {
  const fixture = transitionFixture();
  const events = [];
  const transitions = createBloomTransitions({
    bloom: fixture.bloom,
    viewWindow: fixture.viewWindow,
    onSwap: () => events.push("swap"),
    onSettle: () => events.push("settle")
  });

  const finished = transitions.begin("search", "search", { kind: "search-refresh", force: true });
  fixture.setReduced(true);
  assert.equal(transitions.finishIfReduced(), true);
  await finished;
  assert.deepEqual(events, ["swap", "settle"]);
  assert.equal(transitions.current, null);
  assert.equal("transition" in fixture.root.dataset, false);
  assert.equal("transitionPhase" in fixture.root.dataset, false);
});

test("Bloom relocation folds the old nucleus before moving and grows the new Bloom after the swap", async () => {
  const fixture = transitionFixture();
  const events = [];
  const transitions = createBloomTransitions({
    bloom: fixture.bloom,
    viewWindow: fixture.viewWindow,
    onSwap: () => events.push("swap"),
    onSettle: () => events.push("settle")
  });

  const finished = transitions.begin("closed", "categories", {
    kind: "bloom-relocate",
    force: true,
    swap: () => events.push("move-endpoint")
  });
  assert.equal(fixture.root.dataset.transitionPhase, "out");
  assert.deepEqual(events, []);

  fixture.outgoing.resolve();
  await flush();
  assert.equal(fixture.root.dataset.transitionPhase, "in");
  assert.deepEqual(events, ["move-endpoint", "swap"]);

  fixture.incoming.resolve();
  await finished;
  assert.deepEqual(events, ["move-endpoint", "swap", "settle"]);
  assert.equal(transitions.current, null);
});

test("reduced motion relocates the Bloom endpoint immediately without transitional state", async () => {
  const fixture = transitionFixture({ reduced: true });
  const events = [];
  const transitions = createBloomTransitions({
    bloom: fixture.bloom,
    viewWindow: fixture.viewWindow,
    onSwap: () => events.push("swap"),
    onSettle: () => events.push("settle")
  });

  await transitions.begin("closed", "categories", {
    kind: "bloom-relocate",
    force: true,
    swap: () => events.push("move-endpoint")
  });
  assert.deepEqual(events, ["move-endpoint", "swap", "settle"]);
  assert.equal(transitions.current, null);
  assert.equal("transition" in fixture.root.dataset, false);
  assert.equal("transitionPhase" in fixture.root.dataset, false);
});

test("blank-board Bloom taps exclude controls, nodes, overlays, and out-of-board targets", () => {
  const board = { contains: (target) => target?.inside === true };
  const blank = { inside: true, closest: () => null };
  const protectedTarget = { inside: true, closest: () => ({ tagName: "BUTTON" }) };
  const outside = { inside: false, closest: () => null };

  assert.equal(bloomBoardTapAllowed(board, board), true);
  assert.equal(bloomBoardTapAllowed(blank, board), true);
  assert.equal(bloomBoardTapAllowed(protectedTarget, board), false);
  assert.equal(bloomBoardTapAllowed(outside, board), false);
  assert.equal(bloomBoardTapAllowed(null, board), false);
});

test("pointer coordinates become local Bloom origins and remain safely clamped", () => {
  assert.deepEqual(
    bloomPointFromPointer({ clientX: 154, clientY: 263 }, { left: 24, top: 43 }),
    { x: 130, y: 220 }
  );
  assert.equal(bloomPointFromPointer({ clientX: NaN, clientY: 10 }, { left: 0, top: 0 }), null);

  const properties = new Map();
  const bloom = { root: { style: { setProperty: (name, value) => properties.set(name, value) } } };
  const placed = positionConstellationBloom({
    bloom,
    board: { querySelector: () => null },
    view: {},
    boardRect: { left: 0, top: 0, width: 400, height: 500 },
    layout: [],
    radiusX: 92,
    radiusY: 80,
    stage: "closed",
    origin: { x: 130, y: 220 }
  });
  assert.deepEqual(placed, { x: 130, y: 220 });
  assert.equal(properties.get("--bloom-origin-x"), "130px");
  assert.equal(properties.get("--bloom-origin-y"), "220px");
});


test("large Bloom pages fit their real content lane instead of adding an inner scroll page", () => {
  for (const [width, height, expected] of [[320, 458, 6], [390, 734, 8], [844, 280, 6], [1440, 890, 8], [390, 250, 2]]) {
    const metrics = bloomPaletteMetrics({ boardRect: { width, height, left: 0, top: 0 }, count: 144 });
    assert.equal(metrics.pageSize, expected, `${width}x${height} capacity`);
    assert.ok(metrics.rowHeight >= 44);
    const panel = metrics.panelHeight(metrics.pageSize, true);
    assert.ok(panel <= height - 24);
    const rows = Math.ceil(metrics.pageSize / metrics.columns);
    const content = rows * metrics.rowHeight + (rows - 1) * metrics.gap;
    const chrome = metrics.horizontal ? 126 : metrics.dense ? 164 : 190;
    assert.ok(content + chrome <= panel, `${width}x${height} page must fit without scrolling`);
  }
});

test("Bloom metrics use the visible viewport for zoom or an on-screen keyboard", () => {
  const metrics = bloomPaletteMetrics({ boardRect: { width: 390, height: 734, left: 0, top: 110 },
    visualViewport: { offsetLeft: 0, offsetTop: 0, width: 195, height: 422 }, count: 144 });
  assert.equal(metrics.width, 195);
  assert.equal(metrics.height, 312);
  assert.equal(metrics.columns, 1);
  assert.equal(metrics.pageSize, 1, "Narrow viewport reserves a separate row for the group control");
  assert.ok(metrics.panelWidth <= 171);
  assert.ok(metrics.panelHeight(metrics.pageSize, true) <= 288);
  assert.ok(metrics.rowHeight >= 44);
});
