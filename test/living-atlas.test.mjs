import test from "node:test";
import assert from "node:assert/strict";
import { buildLivingAtlas, sanitizeAtlasHistory } from "../public/living-atlas.mjs";

const route = [
  { a: "Earth", b: "Water", word: "Mud", emoji: "🟤", category: "nature", newDiscovery: true, insight: "Earth and Water combine into wet soil." },
  { a: "Mud", b: "Fire", word: "Brick", emoji: "🧱", category: "structure", newDiscovery: true },
  { a: "Brick", b: "Brick", word: "Wall", emoji: "🧱", category: "structure", newDiscovery: true }
];

test("Living Atlas builds a deterministic visible recipe graph and destination beacon", () => {
  const first = buildLivingAtlas({ history: route, target: "Wall", lockedCount: 4 });
  const repeated = buildLivingAtlas({ history: route, target: "Wall", lockedCount: 4 });
  assert.deepEqual(first, repeated);
  assert.equal(first.summary.combinations, 3);
  assert.equal(first.summary.targetReached, true);
  assert.equal(first.nodes.find((node) => node.label === "Wall").target, true);
  assert.equal(first.nodes.filter((node) => node.locked).length, 4);
  assert.equal(first.edges.length, 6);
  assert.ok(first.nodes.every((node) => node.x >= 0 && node.x <= first.width && node.y >= 0 && node.y <= first.height));
});

test("an unreached target is present only as a disconnected non-spoiling beacon", () => {
  const graph = buildLivingAtlas({ history: route.slice(0, 1), target: "City" });
  const target = graph.nodes.find((node) => node.target);
  assert.equal(target.label, "City");
  assert.equal(graph.summary.targetReached, false);
  assert.equal(graph.edges.some((edge) => edge.from === target.id || edge.to === target.id), false);
});

test("Atlas sanitization bounds hostile content and rejects malformed steps", () => {
  const hostile = Array.from({ length: 300 }, (_, index) => index % 2
    ? null
    : { a: `\u0000 Earth ${"x".repeat(200)}`, b: "Water", word: `Mud ${index}`, emoji: "✨".repeat(20), category: "script", insight: "i".repeat(900) });
  const history = sanitizeAtlasHistory(hostile);
  assert.ok(history.length <= 160);
  assert.ok(history.every((step) => step.a.length <= 48 && step.emoji.length <= 12 && step.insight.length <= 180));
  assert.ok(history.every((step) => step.category === "unknown"));
  const graph = buildLivingAtlas({ history: hostile, target: "\u0000 City", lockedCount: Infinity, width: -50, height: 99_999 });
  assert.ok(graph.nodes.length <= 92);
  assert.equal(graph.width, 480);
  assert.equal(graph.height, 720);
  assert.equal(graph.summary.lockedStars, 0);
});

