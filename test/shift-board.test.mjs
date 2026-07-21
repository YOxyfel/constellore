import assert from "node:assert/strict";
import test from "node:test";

import { createShiftBoardController, spacedTrailPoints } from "../public/shift-board.mjs";

test("Shift trail spacing ignores jitter and interpolates large pointer jumps", () => {
  assert.deepEqual(spacedTrailPoints({ x: 0, y: 0 }, { x: 1, y: 1 }, { width: 100, height: 40 }), {
    points: [],
    anchor: { x: 0, y: 0 }
  });

  const horizontal = spacedTrailPoints({ x: 0, y: 0 }, { x: 400, y: 0 }, { width: 100, height: 40 });
  assert.deepEqual(horizontal.points, [{ x: 0, y: 0 }, { x: 152, y: 0 }]);
  assert.deepEqual(horizontal.anchor, { x: 304, y: 0 });

  const vertical = spacedTrailPoints({ x: 10, y: 20 }, { x: 10, y: 230 }, { width: 100, height: 40 });
  assert.deepEqual(vertical.points, [{ x: 10, y: 20 }, { x: 10, y: 112 }]);
  assert.deepEqual(vertical.anchor, { x: 10, y: 204 });
});

function setup() {
  const nodes = new Map([["a", { id: "a", item: { word: "Air" } }], ["b", { id: "b", item: { word: "Fire" } }]]);
  const removed = [];
  const copies = [];
  const controller = createShiftBoardController({
    getNode: (id) => nodes.get(String(id)) || null,
    removeNode: (node) => { removed.push(node.id); nodes.delete(String(node.id)); return true; },
    duplicateNode: (node, point) => { copies.push({ id: node.id, ...point }); return true; }
  });
  return { controller, nodes, removed, copies };
}

test("Shift removes hovered idle words but never erases while a word is held", () => {
  const { controller, removed } = setup();
  assert.equal(controller.enter("a", { point: { x: 20, y: 20 } }).type, "ignored");
  controller.setHeld(true);
  assert.equal(controller.enter("a", { buttons: 1, point: { x: 20, y: 20 } }).type, "ignored");
  assert.equal(controller.enter("a", { point: { x: 20, y: 20 } }).type, "removed");
  assert.deepEqual(removed, ["a"]);

  assert.equal(controller.beginDrag("b", { x: 0, y: 0 }, { width: 80, height: 40 }), true);
  assert.equal(controller.enter("b", { point: { x: 80, y: 20 } }).type, "ignored");
  assert.deepEqual(removed, ["a"]);
});

test("Shift drag stamps by traveled distance rather than pointer event count", () => {
  const { controller, copies } = setup();
  controller.beginDrag("a", { x: 0, y: 0 }, { width: 80, height: 40 });
  controller.setHeld(true);
  for (let x = 1; x < 132; x += 1) controller.moveDrag({ x, y: 0 });
  assert.equal(copies.length, 0, "sub-threshold one-pixel events cannot flood the board");
  controller.moveDrag({ x: 132, y: 0 });
  assert.deepEqual(copies, [{ id: "a", x: 0, y: 0 }]);
  controller.moveDrag({ x: 396, y: 0 });
  assert.deepEqual(copies.map(({ x }) => x), [0, 132, 264]);
});

test("reversing or looping a Shift drag never piles copies onto its earlier trail", () => {
  const { controller, copies } = setup();
  controller.beginDrag("a", { x: 0, y: 0 }, { width: 80, height: 40 });
  controller.setHeld(true);
  controller.moveDrag({ x: 396, y: 0 });
  controller.moveDrag({ x: 0, y: 0 });
  assert.deepEqual(copies.map(({ x, y }) => ({ x, y })), [
    { x: 0, y: 0 },
    { x: 132, y: 0 },
    { x: 264, y: 0 },
    { x: 396, y: 0 }
  ]);
  assert.equal(new Set(copies.map(({ x, y }) => `${x}:${y}`)).size, copies.length);
});

test("releasing and repressing Shift starts a fresh copy trail without backlog", () => {
  const { controller, copies } = setup();
  controller.beginDrag("a", { x: 0, y: 0 }, { width: 80, height: 40 });
  controller.setHeld(true);
  controller.moveDrag({ x: 132, y: 0 });
  controller.setHeld(false);
  controller.moveDrag({ x: 500, y: 0 });
  controller.setHeld(true);
  controller.moveDrag({ x: 510, y: 0 });
  assert.equal(copies.length, 1);
  controller.moveDrag({ x: 632, y: 0 });
  assert.deepEqual(copies.map(({ x }) => x), [0, 500]);
  controller.endDrag();
  assert.equal(controller.snapshot().dragging, false);
});

test("a held Shift cannot erase the word revealed beneath a finished copy drag", () => {
  const { controller, nodes, removed } = setup();
  controller.beginDrag("a", { x: 0, y: 0 }, { width: 80, height: 40 });
  controller.setHeld(true);
  controller.moveDrag({ x: 132, y: 0 });
  controller.endDrag();
  assert.equal(controller.enter("b", { point: { x: 132, y: 0 } }).type, "ignored");
  assert.deepEqual(removed, []);
  controller.setHeld(false);
  controller.setHeld(true);
  nodes.set("b", { id: "b", item: { word: "Fire" } });
  assert.equal(controller.enter("b", { point: { x: 150, y: 0 } }).type, "removed");
});

test("Shift removal debounces stationary rerender entries", () => {
  const { controller, nodes, removed } = setup();
  controller.setHeld(true);
  controller.enter("a", { point: { x: 40, y: 40 } });
  nodes.set("c", { id: "c", item: { word: "Water" } });
  assert.equal(controller.enter("c", { point: { x: 44, y: 43 } }).type, "ignored");
  assert.equal(controller.enter("c", { point: { x: 60, y: 40 } }).type, "removed");
  assert.deepEqual(removed, ["a", "c"]);
});

test("keyboard removal cannot cascade through an overlapping stack before real pointer movement", () => {
  const { controller, removed } = setup();
  controller.setHeld(true);
  assert.equal(controller.enter("a", { point: null }).type, "removed");
  assert.equal(controller.enter("b", { point: { x: 40, y: 40 } }).type, "ignored");
  controller.pointerMove({ x: 40, y: 40 });
  assert.equal(controller.enter("b", { point: { x: 44, y: 43 } }).type, "ignored");
  assert.equal(controller.enter("b", { point: { x: 58, y: 40 } }).type, "removed");
  assert.deepEqual(removed, ["a", "b"]);
});

test("copy count stays bounded and reset clears every active gesture state", () => {
  const nodes = new Map([["a", { id: "a", item: { word: "Air" } }]]);
  const copies = [];
  const controller = createShiftBoardController({
    getNode: (id) => nodes.get(String(id)) || null,
    removeNode: () => true,
    duplicateNode: (_node, point) => { copies.push(point); return true; },
    maxCopies: 3
  });
  controller.beginDrag("a", { x: 0, y: 0 }, { width: 80, height: 40 });
  controller.setHeld(true);
  controller.moveDrag({ x: 2_000, y: 0 });
  assert.equal(copies.length, 3);
  controller.reset();
  assert.deepEqual(controller.snapshot(), { held: false, dragging: false, dragNodeId: null, copies: 0 });
});
