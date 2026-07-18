import assert from "node:assert/strict";
import test from "node:test";

import { orderInventory, packOrbit, pickMagneticTarget } from "../public/frictionless.mjs";

const rect = (id, left, top, width = 40, height = 30) => ({ id, rect: { left, top, width, height } });

test("magnetic targeting gives a sole direct hit priority over nearby chips", () => {
  const direct = rect("direct", 10, 10);
  const near = rect("near", 51, 10);
  const result = pickMagneticTarget([near, direct], { x: 49, y: 25 }, { radius: 20, ambiguityGap: 12 });

  assert.deepEqual(result, { selected: direct, ambiguous: false, exact: true, distance: 0 });
});

test("magnetic targeting refuses overlapping direct hits", () => {
  const result = pickMagneticTarget([rect("a", 0, 0), rect("b", 20, 0)], { x: 25, y: 15 });
  assert.deepEqual(result, { selected: null, ambiguous: true, exact: true, distance: 0 });
});

test("magnetic targeting uses Euclidean edge distance, radius, and ambiguity gap", () => {
  const closest = rect("closest", 10, 10, 10, 10);
  const runnerUp = rect("runner", 10, 34, 10, 10);
  const point = { x: 25, y: 25 };

  const ambiguous = pickMagneticTarget([runnerUp, closest], point, { radius: 20, ambiguityGap: 5 });
  assert.equal(ambiguous.selected, null);
  assert.equal(ambiguous.ambiguous, true);
  assert.equal(ambiguous.exact, false);
  assert.equal(ambiguous.distance, Math.hypot(5, 5));

  const selected = pickMagneticTarget([runnerUp, closest], point, { radius: 20, ambiguityGap: 2 });
  assert.equal(selected.selected, closest);
  assert.equal(selected.ambiguous, false);
  assert.equal(selected.exact, false);

  assert.deepEqual(pickMagneticTarget([closest], { x: 100, y: 100 }, { radius: 5 }), {
    selected: null, ambiguous: false, exact: false, distance: null
  });
});

test("magnetic targeting accepts client coordinates and ignores malformed candidates", () => {
  const valid = { id: "valid", x: 10, y: 20, width: 20, height: 20 };
  const result = pickMagneticTarget([{ id: "bad" }, valid], { clientX: 5, clientY: 30 }, { radius: 5 });
  assert.equal(result.selected, valid);
  assert.equal(result.distance, 5);
});

function assertStrictPacking(items, bounds, positions) {
  const left = bounds.left ?? bounds.x ?? 0;
  const top = bounds.top ?? bounds.y ?? 0;
  const right = bounds.right ?? left + bounds.width;
  const bottom = bounds.bottom ?? top + bounds.height;
  const gap = bounds.gap ?? 10;
  assert.equal(positions.length, items.length);
  for (const position of positions) {
    assert.ok(position.x >= left);
    assert.ok(position.y >= top);
    assert.ok(position.x + position.width <= right);
    assert.ok(position.y + position.height <= bottom);
  }
  for (let leftIndex = 0; leftIndex < positions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < positions.length; rightIndex += 1) {
      const a = positions[leftIndex];
      const b = positions[rightIndex];
      const separated = a.x + a.width + gap <= b.x || b.x + b.width + gap <= a.x || a.y + a.height + gap <= b.y || b.y + b.height + gap <= a.y;
      assert.ok(separated, `${a.id} and ${b.id} must not overlap`);
    }
  }
}

test("orbit packing is deterministic, centered, in bounds, and non-overlapping", () => {
  const items = [
    { id: "water", width: 82, height: 40 },
    { id: "a-very-long-word", width: 152, height: 42 },
    { id: "fire", width: 67, height: 38 },
    { id: "earth", width: 76, height: 40 },
    { id: "air", width: 56, height: 36 }
  ];
  const bounds = { left: 12, top: 60, width: 340, height: 260, gap: 10 };
  const first = packOrbit(items, bounds);
  const second = packOrbit(items, bounds);

  assert.deepEqual(second, first);
  assert.deepEqual(first.map((entry) => entry.id), items.map((entry) => entry.id), "results stay in caller order");
  assertStrictPacking(items, bounds, first);
  assert.deepEqual(items[0], { id: "water", width: 82, height: 40 }, "inputs are not mutated");
});

test("orbit packing supports explicit edges and rejects impossible or invalid layouts", () => {
  const fitting = [{ id: 1, width: 90, height: 40 }, { id: 2, width: 90, height: 40 }];
  const bounds = { left: 20, top: 30, right: 220, bottom: 130, gap: 10 };
  assertStrictPacking(fitting, bounds, packOrbit(fitting, bounds));

  assert.equal(packOrbit([{ id: "wide", width: 201, height: 20 }], bounds), null);
  assert.equal(packOrbit([{ id: "a", width: 90, height: 60 }, { id: "b", width: 90, height: 60 }], { width: 100, height: 100, gap: 10 }), null);
  assert.equal(packOrbit([{ id: "same", width: 20, height: 20 }, { id: "same", width: 20, height: 20 }], bounds), null);
  assert.equal(packOrbit([{ id: "bad", width: 0, height: 20 }], bounds), null);
  assert.deepEqual(packOrbit([], bounds), []);
});

const words = [
  { id: "earth", word: "Earth" },
  { id: "water", word: "Water" },
  { id: "fire", word: "Fire" },
  { id: "air", word: "Air" },
  { id: "mud", word: "Mud", discoveredAt: "2026-07-16T10:00:00Z" },
  { id: "steam", word: "Steam", discoveredAt: "2026-07-17T10:00:00Z" },
  { id: "wildfire", word: "Wildfire", discoveredAt: "2026-07-18T10:00:00Z" },
  { id: "stair", word: "Stair" }
];

test("inventory ordering pins starters, then explicit recent and newest discoveries", () => {
  const ordered = orderInventory(words, {
    starters: ["Earth", "Water", "Fire", "Air"],
    recent: ["Mud", { id: "steam" }]
  });

  assert.deepEqual(ordered.map((item) => item.word), ["Earth", "Water", "Fire", "Air", "Mud", "Steam", "Wildfire", "Stair"]);
  assert.equal(ordered[0], words[0], "item references are preserved");
  assert.deepEqual(words.map((item) => item.word), ["Earth", "Water", "Fire", "Air", "Mud", "Steam", "Wildfire", "Stair"], "input order is untouched");
});

test("inventory search ranks exact, prefix, then substring before pinning and recency", () => {
  const ordered = orderInventory(words, {
    starters: ["Earth", "Water", "Fire", "Air"],
    recent: ["Wildfire"],
    query: "air"
  });
  assert.deepEqual(ordered.map((item) => item.word), ["Air", "Stair"]);

  const fireMatches = orderInventory(words, {
    starters: ["Fire"],
    recent: ["Wildfire"],
    query: "fire"
  });
  assert.deepEqual(fireMatches.map((item) => item.word), ["Fire", "Wildfire"]);
});

test("inventory search is trimmed, case-insensitive, and returns no nonmatches", () => {
  assert.deepEqual(orderInventory(words, { query: "  STE  " }).map((item) => item.word), ["Steam"]);
  assert.deepEqual(orderInventory(words, { query: "galaxy" }), []);
  assert.deepEqual(orderInventory(null, { query: "air" }), []);
});
