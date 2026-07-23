import test from "node:test";
import assert from "node:assert/strict";
import { buildCommunityResults } from "../public/community-results.mjs";
import { createRouteSignature } from "../public/signature-routes.mjs";

const history = [
  { a: "Earth", b: "Water", word: "Mud", category: "nature", source: "world", newDiscovery: true },
  { a: "Mud", b: "Fire", word: "Brick", category: "structure", source: "world", newDiscovery: true }
];

function signature(overrides = {}) {
  return createRouteSignature({ history, target: "Brick", completed: true, optimalMoves: 2, mode: "daily", challengeId: "daily:test", ...overrides });
}

test("community results aggregate asynchronous completions and locate one player privately", () => {
  const entries = [
    { playerId: "p-one", rank: 1, callsign: "Bright Nova 00000001", moves: 2, elapsedMs: 20_000, score: 120_000, signature: signature() },
    { playerId: "p-two", rank: 2, callsign: "Quiet Wisp 00000002", moves: 3, elapsedMs: 30_000, score: 110_000, signature: signature({ history: [history[0], { a: "Earth", b: "Fire", word: "Lava", category: "nature", contextual: true }, history[1]] }) },
    { playerId: "p-three", rank: 3, callsign: "Solar Raven 00000003", moves: 4, elapsedMs: 40_000, score: 100_000, signature: signature() }
  ];
  const result = buildCommunityResults(entries, { playerId: "p-two" });
  assert.equal(result.completedRoutes, 3);
  assert.equal(result.averageMoves, 3);
  assert.equal(result.averageSeconds, 30);
  assert.equal(result.player.rank, 2);
  assert.equal(result.player.topPercent, 67);
  assert.equal(result.nearby.rank, 1);
  assert.ok(result.mostOriginal);
  assert.doesNotMatch(JSON.stringify(result), /p-one|p-two|p-three/);
});

test("community results are bounded, deterministic, and hostile entries fail closed", () => {
  const hostile = Array.from({ length: 900 }, (_, index) => index % 3 === 0 ? null : {
    playerId: `<script>${index}`,
    rank: index + 1,
    callsign: index === 1 ? "<img src=x>" : `Stargazer ${index}`,
    moves: Infinity,
    elapsedMs: -500,
    score: 1e99,
    signature: { kind: "forged", playerId: "secret" }
  });
  const first = buildCommunityResults(hostile, { playerId: "<script>1" });
  assert.deepEqual(buildCommunityResults(hostile, { playerId: "<script>1" }), first);
  assert.ok(first.completedRoutes <= 500);
  assert.equal(first.player, null);
  assert.equal(first.distinctSignatures, 0);
  assert.doesNotMatch(JSON.stringify(first), /script|img|secret/);
  assert.ok(Number.isFinite(first.averageMoves));
  assert.ok(Number.isFinite(first.averageSeconds));
});

test("empty community skies remain honest instead of inventing player data", () => {
  assert.deepEqual(buildCommunityResults([], { playerId: "someone" }), {
    version: 1,
    privacy: "aggregate-and-public-callsign",
    completedRoutes: 0,
    averageMoves: 0,
    averageSeconds: 0,
    distinctSignatures: 0,
    signatureVarietyPercent: 0,
    player: null,
    mostOriginal: null,
    nearby: null
  });
});
