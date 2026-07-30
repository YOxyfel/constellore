import assert from "node:assert/strict";
import test from "node:test";

import { buildRevealTree } from "../public/reveal-tree.mjs";

const BRANCHING_ROUTE = [
  { a: "Earth", b: "Water", word: "Mud" },
  { a: "Fire", b: "Air", word: "Energy" },
  { a: "Earth", b: "Air", word: "Dust" },
  { a: "Water", b: "Air", word: "Rain" },
  { a: "Mud", b: "Energy", word: "Brick" },
  { a: "Dust", b: "Rain", word: "Atmosphere" },
  { a: "Brick", b: "Atmosphere", word: "Wall" }
];

test("reveal routes become concurrent dependency waves", () => {
  const tree = buildRevealTree(BRANCHING_ROUTE, { width: 960, height: 720 });
  assert.deepEqual(tree.batches.map((batch) => batch.stepIndices), [
    [0, 1, 2, 3],
    [4, 5],
    [6]
  ]);
  assert.equal(tree.nodes.length, 11);
  assert.equal(tree.edges.length, 14);
  assert.equal(tree.targetKey, "wall");
  for (const edge of tree.edges) {
    assert.ok(
      edge.to.y < edge.from.y,
      `${edge.fromKey} must flow upward into ${edge.toKey}`
    );
  }
});

function rectanglesOverlap(left, right) {
  return !(
    left.x + left.width <= right.x
    || right.x + right.width <= left.x
    || left.y + left.height <= right.y
    || right.y + right.height <= left.y
  );
}

test("the compact reveal tree stays bounded and avoids every node overlap", () => {
  const tree = buildRevealTree(BRANCHING_ROUTE, {
    width: 320,
    height: 304
  });
  assert.ok(tree.bounds.contentHeight >= tree.bounds.height);
  assert.ok(tree.nodeWidth >= 74);
  assert.ok(tree.nodeHeight >= 46);
  for (const node of tree.nodes) {
    assert.ok(node.x >= tree.bounds.left);
    assert.ok(node.y >= tree.bounds.top);
    assert.ok(node.x + node.width <= tree.bounds.width - tree.bounds.right + 1);
    assert.ok(node.y + node.height <= tree.bounds.contentHeight - tree.bounds.bottom + 1);
  }
  for (let leftIndex = 0; leftIndex < tree.nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < tree.nodes.length; rightIndex += 1) {
      const left = tree.nodes[leftIndex];
      const right = tree.nodes[rightIndex];
      assert.equal(rectanglesOverlap(left, right), false, `${left.word} and ${right.word} overlap`);
    }
  }
});

test("a repeated ingredient keeps two visible fusion edges", () => {
  const tree = buildRevealTree([
    { a: "Brick", b: "Brick", word: "Wall" }
  ]);
  assert.equal(tree.nodes.length, 2);
  assert.equal(tree.edges.length, 2);
  assert.deepEqual(tree.edges.map((edge) => edge.slot), ["a", "b"]);
  assert.notDeepEqual(tree.edges[0].from, tree.edges[1].from);
  assert.notDeepEqual(tree.edges[0].to, tree.edges[1].to);
});

test("deep routes use a collision-free virtual canvas instead of crushing old words", () => {
  const route = [
    ...BRANCHING_ROUTE.slice(0, 6),
    { a: "Brick", b: "Atmosphere", word: "City" },
    { a: "City", b: "Rain", word: "Harbor" },
    { a: "Harbor", b: "Energy", word: "Engine" },
    { a: "Engine", b: "Dust", word: "Factory" },
    { a: "Factory", b: "Air", word: "Industry" },
    { a: "Industry", b: "Water", word: "Technology" },
    { a: "Technology", b: "Earth", word: "Civilization" },
    { a: "Civilization", b: "Fire", word: "Rocket" },
    { a: "Rocket", b: "Atmosphere", word: "Aeronautics" }
  ];
  for (const size of [
    { width: 320, height: 304 },
    { width: 412, height: 651 },
    { width: 960, height: 640 },
    { width: 1200, height: 700 }
  ]) {
    const tree = buildRevealTree(route, size);
    assert.ok(tree.bounds.contentHeight > 0);
    assert.ok(tree.bounds.maxCameraY >= 0);
    for (let leftIndex = 0; leftIndex < tree.nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < tree.nodes.length; rightIndex += 1) {
        assert.equal(
          rectanglesOverlap(tree.nodes[leftIndex], tree.nodes[rightIndex]),
          false,
          `${tree.nodes[leftIndex].word} and ${tree.nodes[rightIndex].word} overlap at ${size.width}x${size.height}`
        );
      }
    }
    for (const edge of tree.edges) {
      assert.ok(edge.to.y < edge.from.y, `${edge.fromKey} must remain below ${edge.toKey}`);
    }
  }
});
