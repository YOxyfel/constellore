import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SIGNATURE_PAYLOAD_BYTES,
  MAX_SIGNATURE_ROUTE_STEPS,
  MAX_SIGNATURE_STEP_FINGERPRINTS,
  SIGNATURE_ROUTE_VERSION,
  comparePersonalBest,
  createRouteSignature,
  gradeSignatureRoute,
  sanitizeRouteHistory,
  sanitizeRouteSignature,
  signatureTierForScore
} from "../public/signature-routes.mjs";

const route = [
  { a: "Earth", b: "Water", word: "Mud", category: "nature", source: "world", newDiscovery: true, rarity: "common" },
  { a: "Mud", b: "Fire", word: "Brick", category: "structure", source: "world", newDiscovery: true, rarity: "uncommon" },
  { a: "Brick", b: "Brick", word: "Wall", category: "structure", source: "world", newDiscovery: false, rarity: "common" },
  { a: "Wall", b: "Life", word: "City", category: "life", source: "world", newDiscovery: true, rarity: "rare", contextual: true, contextId: "civic" }
];

function completedRoute(overrides = {}) {
  return {
    history: route,
    target: "City",
    completed: true,
    optimalMoves: 4,
    mode: "reach",
    ...overrides
  };
}

test("route history sanitization is bounded, fixed-shape, and strips private metadata", () => {
  const history = Array.from({ length: 90 }, (_, index) => ({
    b: index ? `Catalyst ${index}` : " Water\u0000 ",
    a: index ? `Source ${index}` : " earth ",
    result: { word: index ? `Result ${index}` : `A${"b".repeat(100)}`, category: "Nature<script>", rarity: 10_000 },
    source: index ? "world" : "UNKNOWN ATTACK SOURCE",
    newDiscovery: index ? true : "true",
    contextual: index % 2 === 0,
    contextId: `context-${index}`,
    playerId: "private-player-id",
    runToken: "private-run-token",
    note: "private free-form note"
  }));
  const original = structuredClone(history);
  const sanitized = sanitizeRouteHistory({ history, profile: { callsign: "Private Pilot" } });

  assert.equal(sanitized.length, MAX_SIGNATURE_ROUTE_STEPS);
  assert.deepEqual(Object.keys(sanitized[0]).sort(), [
    "a", "b", "category", "context", "contextual", "newDiscovery", "rarity", "source", "twisted", "word"
  ]);
  assert.equal(sanitized[0].a, "earth");
  assert.equal(sanitized[0].b, "Water");
  assert.equal(sanitized[0].word.length, 80);
  assert.equal(sanitized[0].source, "unknown");
  assert.equal(sanitized[0].newDiscovery, null, "string booleans cannot claim novelty");
  assert.equal(sanitized[0].rarity, 100);
  assert.doesNotMatch(JSON.stringify(sanitized), /private-player-id|private-run-token|private free-form note/i);
  assert.deepEqual(history, original, "sanitization must not mutate route history");
  assert.equal(sanitizeRouteHistory(history, { limit: 3 }).length, 3);
  assert.deepEqual(sanitizeRouteHistory({ history: "not-an-array" }), []);
});

test("completed route grading is deterministic and exposes all four dimensions", () => {
  const input = completedRoute();
  const original = structuredClone(input);
  const first = gradeSignatureRoute(input);
  const second = gradeSignatureRoute(structuredClone(input));

  assert.deepEqual(second, first);
  assert.deepEqual(input, original);
  assert.equal(first.version, SIGNATURE_ROUTE_VERSION);
  assert.equal(first.completed, true);
  assert.equal(first.gradable, true);
  assert.equal(first.scoreEligible, true);
  assert.equal(first.total, 84);
  assert.deepEqual(first.tier, { id: "nova", label: "Nova Route", at: 80 });
  assert.deepEqual(first.dimensions, { efficiency: 100, novelty: 82, variety: 66, purity: 100 });
  assert.equal(first.metrics.moves, 4);
  assert.equal(first.metrics.newDiscoveries, 3);
  assert.equal(first.metrics.categories, 3);
  assert.equal(first.metrics.contextualSteps, 1);
});

test("incomplete and empty histories fail closed instead of earning a signature grade", () => {
  const incomplete = gradeSignatureRoute({ history: route, target: "Galaxy", completed: "true", moves: -99 });
  assert.equal(incomplete.completed, false);
  assert.equal(incomplete.gradable, false);
  assert.equal(incomplete.total, 0);
  assert.equal(incomplete.tier.id, "unfinished");
  assert.equal(createRouteSignature({ completed: true, history: [] }), null);

  const inferred = gradeSignatureRoute({ history: route, target: " city ", optimalMoves: 4 });
  assert.equal(inferred.completed, true, "the final result can prove completion without a redundant flag");
  assert.equal(inferred.total, 84);
});

test("efficiency, novelty, rarity, and contextual variety materially change the grade", () => {
  const expressive = gradeSignatureRoute(completedRoute());
  const repetitiveHistory = [
    ...route.slice(0, 2),
    ...Array.from({ length: 8 }, () => ({ a: "Earth", b: "Water", word: "Mud", newDiscovery: false })),
    route[2],
    route[3]
  ];
  const repetitive = gradeSignatureRoute(completedRoute({ history: repetitiveHistory, moves: 12 }));
  const plain = gradeSignatureRoute(completedRoute({
    history: route.map((step) => ({ a: step.a, b: step.b, word: step.word, newDiscovery: step.newDiscovery }))
  }));

  assert.ok(expressive.dimensions.efficiency > repetitive.dimensions.efficiency);
  assert.ok(expressive.dimensions.novelty > repetitive.dimensions.novelty);
  assert.ok(expressive.dimensions.variety > plain.dimensions.variety);
  assert.ok(expressive.total > repetitive.total);
});

test("assistance applies a monotonic whole-route penalty and Study always scores zero", () => {
  const pure = gradeSignatureRoute(completedRoute());
  const market = gradeSignatureRoute(completedRoute({ assist: "market" }));
  const giftThenAi = gradeSignatureRoute(completedRoute({ assist: "gift", history: [{ ...route[0], source: "ai" }, ...route.slice(1)] }));
  const inferredAi = gradeSignatureRoute(completedRoute({ history: [{ ...route[0], source: "ai-route" }, ...route.slice(1)] }));
  const revealed = gradeSignatureRoute(completedRoute({ scoringDisabled: true, assist: "reveal" }));

  assert.equal(pure.dimensions.purity, 100);
  assert.equal(market.dimensions.purity, 80);
  assert.equal(inferredAi.dimensions.purity, 80);
  assert.equal(giftThenAi.dimensions.purity, 50, "later AI use cannot upgrade a stronger Gift penalty");
  assert.ok(pure.total > market.total);
  assert.ok(market.total > giftThenAi.total);
  assert.equal(revealed.total, 0);
  assert.equal(revealed.scoreEligible, false);
  assert.equal(revealed.tier.id, "study");

  const hostileAssist = gradeSignatureRoute(completedRoute({ assist: "toString", scoreMultiplier: 9 }));
  assert.equal(hostileAssist.metrics.assist, "open");
  assert.equal(hostileAssist.metrics.scoreMultiplier, .85);
});

test("shareable signatures are deterministic, bounded, anonymous, and hide route answers", () => {
  const privateInput = completedRoute({
    target: "Alice Secret Destination",
    challengeId: "private-challenge-token",
    playerId: "player-raw-123",
    callsign: "AliceRawName",
    runId: "run-secret-456",
    runToken: "authorization-secret",
    history: route.map((step, index) => ({
      ...step,
      a: `${step.a} Private ${index}`,
      b: `${step.b} Private ${index}`,
      word: index === route.length - 1 ? "Alice Secret Destination" : `${step.word} Private ${index}`,
      note: "do not share this note"
    }))
  });
  const first = createRouteSignature(privateInput);
  const second = createRouteSignature(structuredClone(privateInput));
  const serialized = JSON.stringify(first);

  assert.deepEqual(second, first);
  assert.match(first.signatureId, /^rs-[a-z0-9]{14}$/);
  assert.match(first.scopeKey, /^scope-[a-z0-9]{14}$/);
  assert.match(first.routeFingerprint, /^route-[a-z0-9]{14}$/);
  assert.equal(first.privacy, "anonymous");
  assert.ok(Buffer.byteLength(serialized, "utf8") <= MAX_SIGNATURE_PAYLOAD_BYTES);
  assert.doesNotMatch(serialized, /Alice|Private|player-raw|run-secret|authorization-secret|challenge-token|do not share/i);

  const swapped = createRouteSignature({
    ...privateInput,
    history: privateInput.history.map((step) => ({ ...step, a: step.b, b: step.a }))
  });
  assert.equal(swapped.routeFingerprint, first.routeFingerprint, "ingredient display order is not a different route");
  assert.equal(swapped.signatureId, first.signatureId);
});

test("large routes retain only bounded anonymous step fingerprints", () => {
  const history = Array.from({ length: MAX_SIGNATURE_ROUTE_STEPS + 50 }, (_, index) => ({
    a: `Source ${index}`,
    b: `Catalyst ${index}`,
    word: `Result ${index}`,
    category: `Category ${index % 4}`,
    newDiscovery: true,
    contextual: index % 7 === 0,
    rarity: index % 5 === 0 ? "rare" : "common"
  }));
  const signature = createRouteSignature({
    history,
    target: history[MAX_SIGNATURE_ROUTE_STEPS - 1].word,
    completed: true,
    moves: history.length,
    optimalMoves: 20,
    mode: "challenge",
    playerId: "must-not-survive"
  });
  const serialized = JSON.stringify(signature);

  assert.equal(signature.stepFingerprints.length, MAX_SIGNATURE_STEP_FINGERPRINTS);
  assert.ok(Buffer.byteLength(serialized, "utf8") <= MAX_SIGNATURE_PAYLOAD_BYTES);
  assert.doesNotMatch(serialized, /Source|Catalyst|Result|must-not-survive/);
});

test("received signatures are regraded, bounded, and stripped before comparison", () => {
  const signature = createRouteSignature(completedRoute());
  const hostile = {
    ...signature,
    score: 9_999,
    scoreEligible: true,
    tier: "root",
    tierLabel: "Administrator",
    dimensions: { efficiency: 9_999, novelty: -50, variety: Infinity, purity: 9_999 },
    assist: "market",
    scoreMultiplier: 9,
    moves: -1,
    discoveries: 9_999,
    categories: 9_999,
    contextualSteps: 9_999,
    stepFingerprints: ["invalid", ...Array(100).fill(signature.stepFingerprints[0])],
    playerId: "raw-player",
    prototypePayload: { admin: true }
  };
  const sanitized = sanitizeRouteSignature(hostile);
  const serialized = JSON.stringify(sanitized);

  assert.equal(sanitized.scoreMultiplier, .8, "a payload cannot upgrade its declared assistance rate");
  assert.deepEqual(sanitized.dimensions, { efficiency: 100, novelty: 0, variety: 0, purity: 80 });
  assert.equal(sanitized.score, 30, "the score is recomputed from sanitized dimensions and assistance");
  assert.equal(sanitized.tier, "spark");
  assert.equal(sanitized.moves, 1);
  assert.equal(sanitized.discoveries, MAX_SIGNATURE_ROUTE_STEPS);
  assert.equal(sanitized.stepFingerprints.length, MAX_SIGNATURE_STEP_FINGERPRINTS);
  assert.doesNotMatch(serialized, /raw-player|prototypePayload|Administrator|root/);
  assert.equal(sanitizeRouteSignature({ ...hostile, signatureId: "not-valid" }), null);
});

test("personal-best comparison is stable, scoped, and uses deterministic tie breakers", () => {
  const previous = createRouteSignature(completedRoute({ assist: "gift" }));
  const candidate = createRouteSignature(completedRoute());
  const improvement = comparePersonalBest(candidate, previous);
  assert.equal(improvement.comparable, true);
  assert.equal(improvement.improved, true);
  assert.equal(improvement.reason, "score");
  assert.equal(improvement.best.signatureId, candidate.signatureId);
  assert.equal(improvement.delta, candidate.score - previous.score);

  const regression = comparePersonalBest(previous, candidate);
  assert.equal(regression.improved, false);
  assert.equal(regression.best.signatureId, candidate.signatureId);

  const first = comparePersonalBest(candidate, null);
  assert.deepEqual({ comparable: first.comparable, improved: first.improved, reason: first.reason }, {
    comparable: true, improved: true, reason: "first"
  });

  const differentScope = createRouteSignature(completedRoute({ target: "Metropolis", challengeId: "other" }));
  assert.equal(comparePersonalBest(differentScope, candidate).reason, "different_scope");

  const slowerTie = { ...candidate, moves: candidate.moves + 2 };
  const fasterTie = comparePersonalBest(candidate, slowerTie);
  assert.equal(fasterTie.improved, true);
  assert.equal(fasterTie.reason, "moves");
  assert.equal(comparePersonalBest({ malformed: true }, candidate).reason, "invalid_candidate");
});

test("tier boundaries and hostile numeric values stay deterministic and finite", () => {
  assert.equal(signatureTierForScore(-Infinity).id, "spark");
  assert.equal(signatureTierForScore(44.4).id, "spark");
  assert.equal(signatureTierForScore(45).id, "orbit");
  assert.equal(signatureTierForScore(65).id, "constellation");
  assert.equal(signatureTierForScore(80).id, "nova");
  assert.equal(signatureTierForScore(92).id, "singularity");
  assert.equal(signatureTierForScore(Infinity).id, "spark");

  assert.doesNotThrow(() => gradeSignatureRoute({
    history: [{ a: Symbol("a"), b: 1n, word: "Result", rarity: Symbol("rare") }],
    completed: true,
    moves: Symbol("moves"),
    optimalMoves: Infinity,
    scoreMultiplier: Symbol("multiplier"),
    assist: "__proto__",
    playerId: { deeply: { nested: "private" } }
  }));
  const hostile = gradeSignatureRoute({ history: route, completed: true, moves: Infinity, scoreMultiplier: -100 });
  assert.equal(hostile.total, 0);
  assert.equal(hostile.scoreEligible, false);
  assert.ok(Object.values(hostile.dimensions).every(Number.isFinite));
});
