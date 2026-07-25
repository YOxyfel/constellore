import assert from "node:assert/strict";
import test from "node:test";
import {
  RUN_IQ_DISCOVERY_GAIN,
  RUN_IQ_EXPLORATION_LIMIT,
  RUN_IQ_MAX,
  RUN_IQ_MAX_MULTIPLIER,
  RUN_IQ_MISS_LOSS,
  RUN_IQ_START,
  createRunIqState,
  rewardRunIq,
  runIqApplies,
  runIqPairKey,
  runIqRouteContext,
  sanitizeRunIqState,
  softenRunIq,
  streakMultiplier
} from "../public/run-iq.mjs";

function rewardRoute(state, index, total, options = {}) {
  return rewardRunIq(state, `route-pair-${index}`, {
    relevance: options.completed ? "target" : "route",
    routeAdvanced: true,
    completed: Boolean(options.completed),
    routeTotal: total,
    stepsAdvanced: 1,
    newDiscovery: true
  });
}

test("Run IQ starts at zero, caps at 200, and applies only to eligible target runs", () => {
  assert.equal(createRunIqState().value, RUN_IQ_START);
  assert.equal(RUN_IQ_START, 0);

  for (const mode of ["reach", "quick", "moves", "daily", "weekly", "challenge"]) {
    assert.equal(runIqApplies(mode, "Telescope"), true, mode);
  }
  for (const mode of ["training", "second-orbit", "explore", ""]) {
    assert.equal(runIqApplies(mode, "Telescope"), false, mode);
  }
  assert.equal(runIqApplies("reach", ""), false);
  assert.equal(runIqApplies("reach", "Telescope", { study: true }), false);
  assert.equal(runIqApplies("reach", "Telescope", { revealed: true }), false);
  assert.equal(runIqApplies("reach", "Telescope", { scoreEligible: false }), false);
});

test("route progress snapshots classify a useful step, target step, and detour", () => {
  assert.deepEqual(
    runIqRouteContext(
      { total: 5, remaining: 5, complete: false },
      { total: 5, remaining: 4, complete: false }
    ),
    {
      relevance: "route",
      routeAdvanced: true,
      routeTotal: 5,
      stepsAdvanced: 1,
      completed: false,
      newDiscovery: true
    }
  );
  assert.deepEqual(
    runIqRouteContext(
      { total: 5, remaining: 1, complete: false },
      { total: 5, remaining: 0, complete: true },
      { completed: true }
    ),
    {
      relevance: "target",
      routeAdvanced: true,
      routeTotal: 5,
      stepsAdvanced: 1,
      completed: true,
      newDiscovery: true
    }
  );
  assert.equal(
    runIqRouteContext(
      { total: 5, remaining: 4 },
      { total: 5, remaining: 4 },
      { newDiscovery: true }
    ).relevance,
    "discovery"
  );
  assert.equal(
    runIqRouteContext(
      { total: 5, remaining: 4 },
      { total: 5, remaining: 4 },
      { newDiscovery: false }
    ).relevance,
    "known"
  );
});

test("zero distance without an explicit winning fusion remains route-neutral", () => {
  assert.deepEqual(
    runIqRouteContext(
      { total: 5, remaining: 1, complete: false },
      { total: 5, remaining: 0, complete: true },
      { completed: false, newDiscovery: true }
    ),
    {
      relevance: "discovery",
      routeAdvanced: false,
      routeTotal: 5,
      stepsAdvanced: 0,
      completed: false,
      newDiscovery: true
    }
  );
  assert.equal(
    runIqRouteContext(
      { total: 5, remaining: 0, complete: true },
      { total: 5, remaining: 0, complete: true },
      { newDiscovery: false }
    ).relevance,
    "known"
  );
});

test("route-relevant connections give most IQ and build a capped multiplier", () => {
  let score = createRunIqState();
  score = rewardRoute(score, 1, 5);
  assert.ok(score.delta >= 20, `expected a material route gain, received ${score.delta}`);
  assert.equal(score.relevance, "route");
  assert.equal(score.streak, 1);
  assert.equal(score.multiplier, 1);

  const second = rewardRoute(score, 2, 5);
  assert.ok(second.delta > score.delta, "the route streak should make the next useful step feel stronger");
  assert.equal(second.streak, 2);
  assert.equal(second.multiplier, 1.2);
  assert.equal(streakMultiplier(1000), 2);
});

test("rewardRunIq can infer relevance directly from authoritative before/after distances", () => {
  const route = rewardRunIq(createRunIqState(), "earth+water", {
    total: 4,
    remainingBefore: 4,
    remainingAfter: 3,
    newDiscovery: true
  });
  assert.equal(route.outcome, "route");
  assert.equal(route.relevance, "route");
  assert.ok(route.delta > RUN_IQ_DISCOVERY_GAIN);

  const explore = rewardRunIq(route, "air+stone", {
    total: 4,
    remainingBefore: 3,
    remainingAfter: 3,
    newDiscovery: true
  });
  assert.equal(explore.outcome, "explore");
  assert.equal(explore.relevance, "discovery");
  assert.equal(explore.delta, RUN_IQ_DISCOVERY_GAIN);

  const target = rewardRunIq(explore, "glass+sky", {
    total: 4,
    remainingBefore: 1,
    remainingAfter: 0,
    completed: true
  });
  assert.equal(target.outcome, "target");
  assert.equal(target.relevance, "target");
  assert.equal(target.value, RUN_IQ_MAX);
  assert.equal(target.maxed, true);
});

test("a Reality Bend cannot turn the next unrelated recipe into a 200-point target", () => {
  const bendTransition = rewardRunIq(createRunIqState(), "wish+telescope", {
    total: 5,
    remainingBefore: 1,
    remainingAfter: 0,
    completed: false,
    newDiscovery: true
  });
  assert.equal(bendTransition.outcome, "explore");
  assert.equal(bendTransition.relevance, "discovery");
  assert.equal(bendTransition.value, RUN_IQ_DISCOVERY_GAIN);
  assert.equal(bendTransition.maxed, false);

  const unrelatedAfterBend = rewardRunIq(bendTransition, "mud+fire", {
    total: 5,
    remainingBefore: 0,
    remainingAfter: 0,
    completed: false,
    newDiscovery: true
  });
  assert.equal(unrelatedAfterBend.outcome, "explore");
  assert.equal(unrelatedAfterBend.value, RUN_IQ_DISCOVERY_GAIN * 2);
  assert.notEqual(unrelatedAfterBend.value, RUN_IQ_MAX);

  const untrustedTargetLabel = rewardRunIq(createRunIqState(), "air+glass", {
    relevance: "target",
    completed: false,
    newDiscovery: true,
    routeTotal: 5
  });
  assert.equal(untrustedTargetLabel.outcome, "explore");
  assert.equal(untrustedTargetLabel.value, RUN_IQ_DISCOVERY_GAIN);

  const authoritativeWin = rewardRunIq(createRunIqState(), "air+glass", {
    relevance: "target",
    won: true,
    routeTotal: 5
  });
  assert.equal(authoritativeWin.outcome, "target");
  assert.equal(authoritativeWin.value, RUN_IQ_MAX);
});

test("a flawless authored route lands exactly on the satisfying 200 maximum", () => {
  for (const total of [1, 3, 6, 12]) {
    let score = createRunIqState();
    for (let step = 1; step <= total; step += 1) {
      score = rewardRoute(score, step, total, { completed: step === total });
    }
    assert.equal(score.value, RUN_IQ_MAX, `route length ${total}`);
    assert.equal(score.routeValue, RUN_IQ_MAX, `route length ${total}`);
    assert.equal(score.outcome, "target");
    assert.equal(score.maxed, true);
    assert.equal(score.misses, 0);
  }
});

test("new but irrelevant discoveries earn one point and cannot replace route play", () => {
  let score = createRunIqState();
  score = rewardRunIq(score, "cloud+stone", {
    relevance: "discovery",
    newDiscovery: true,
    routeTotal: 6
  });
  assert.equal(score.delta, RUN_IQ_DISCOVERY_GAIN);
  assert.equal(score.value, 1);
  assert.equal(score.streak, 0, "detours neither build nor destroy the route streak");

  for (let index = 0; index < 50; index += 1) {
    score = rewardRunIq(score, `detour-${index}`, {
      relevance: "discovery",
      newDiscovery: true,
      routeTotal: 6
    });
  }
  assert.equal(score.explorationValue, RUN_IQ_EXPLORATION_LIMIT);
  assert.equal(score.value, RUN_IQ_EXPLORATION_LIMIT);
  assert.equal(score.outcome, "explore");
  assert.equal(score.explorationCapped, true);
});

test("known discoveries and missing relevance evidence do not receive route-sized gains", () => {
  const known = rewardRunIq(createRunIqState(), "earth+water", {
    relevance: "known",
    newDiscovery: false
  });
  assert.equal(known.value, 0);
  assert.equal(known.delta, 0);
  assert.equal(known.outcome, "known");

  const conservative = rewardRunIq(createRunIqState(), "air+water");
  assert.equal(conservative.value, RUN_IQ_DISCOVERY_GAIN);
  assert.equal(conservative.relevance, "discovery");

  const missingPair = rewardRunIq(createRunIqState(), "", {
    relevance: "route",
    routeTotal: 4
  });
  assert.equal(missingPair.value, 0);
  assert.equal(missingPair.outcome, "ignored");
});

test("repeated successful or invalid pairs cannot farm IQ or penalties", () => {
  const pair = runIqPairKey("Water", "Earth");
  const first = rewardRunIq(createRunIqState(), pair, {
    relevance: "route",
    routeTotal: 4
  });
  const repeated = rewardRunIq(first, runIqPairKey("Earth", "Water"), {
    relevance: "route",
    routeTotal: 4
  });
  assert.equal(repeated.value, first.value);
  assert.equal(repeated.streak, first.streak);
  assert.equal(repeated.delta, 0);
  assert.equal(repeated.outcome, "repeat");

  const invalidPair = runIqPairKey("Fire", "Mud");
  const missed = softenRunIq(first, invalidPair);
  const missedAgain = softenRunIq(missed, invalidPair);
  assert.equal(missedAgain.value, missed.value);
  assert.equal(missedAgain.misses, missed.misses);
  assert.equal(missedAgain.penalty, missed.penalty);
  assert.equal(missedAgain.outcome, "repeat");
});

test("a Cosmic Twist and its canonical retry can use distinct result-aware keys", () => {
  const twisted = rewardRunIq(createRunIqState(), "brick+brick=>concrete", {
    relevance: "discovery",
    newDiscovery: true,
    routeTotal: 4
  });
  assert.equal(twisted.value, RUN_IQ_DISCOVERY_GAIN);

  const canonical = rewardRunIq(twisted, "brick+brick=>wall", {
    relevance: "target",
    completed: true,
    routeAdvanced: true,
    routeTotal: 4,
    stepsAdvanced: 1,
    newDiscovery: true
  });
  assert.equal(canonical.outcome, "target");
  assert.equal(canonical.value, RUN_IQ_MAX);
  assert.equal(canonical.maxed, true);
});

test("a rejected pair removes two points, breaks the route streak, and makes 200 flawless-only", () => {
  let score = rewardRoute(createRunIqState(), 1, 3);
  score = rewardRoute(score, 2, 3);
  const beforeMiss = score.value;
  score = softenRunIq(score, runIqPairKey("Fire", "Mud"));
  assert.equal(score.value, beforeMiss - RUN_IQ_MISS_LOSS);
  assert.equal(score.delta, -RUN_IQ_MISS_LOSS);
  assert.equal(score.streak, 0);
  assert.equal(score.multiplier, 1);
  assert.equal(score.misses, 1);

  score = rewardRoute(score, 3, 3, { completed: true });
  assert.ok(score.value < RUN_IQ_MAX);
  assert.ok(score.value >= 170, `a single mistake should remain recoverable, received ${score.value}`);
});

test("excluded, study, and reveal rewards are ignored without consuming their pair", () => {
  const start = createRunIqState();
  const ignored = rewardRunIq(start, "earth+water", {
    relevance: "route",
    routeTotal: 4,
    revealed: true
  });
  assert.equal(ignored.value, 0);
  assert.equal(ignored.outcome, "ignored");
  assert.deepEqual(ignored.attemptedPairs, []);

  const laterEligible = rewardRunIq(ignored, "earth+water", {
    relevance: "route",
    routeTotal: 4
  });
  assert.ok(laterEligible.value > 0);
});

test("state restoration clamps untrusted data and migrates an active legacy score", () => {
  const restored = sanitizeRunIqState({
    version: 2,
    value: 999,
    routeValue: 999,
    explorationValue: 999,
    penalty: -50,
    misses: -4,
    routeConnections: 999,
    routeTotal: 999,
    streak: 999,
    delta: 80,
    rewardedPairs: ["earth+water", "earth+water"],
    attemptedPairs: ["earth+water", "fire+mud", "fire+mud"]
  });
  assert.equal(restored.value, RUN_IQ_MAX);
  assert.equal(restored.routeValue, RUN_IQ_MAX);
  assert.equal(restored.explorationValue, RUN_IQ_EXPLORATION_LIMIT);
  assert.equal(restored.routeConnections, 100);
  assert.equal(restored.routeTotal, 100);
  assert.equal(restored.multiplier, RUN_IQ_MAX_MULTIPLIER);
  assert.equal(restored.delta, 0);
  assert.equal(restored.outcome, "ready");
  assert.deepEqual(restored.rewardedPairs, ["earth+water"]);
  assert.deepEqual(restored.attemptedPairs, ["earth+water", "fire+mud"]);

  const migrated = sanitizeRunIqState({
    value: 117,
    streak: 3,
    rewardedPairs: ["earth+water"]
  });
  assert.equal(migrated.value, 117);
  assert.equal(migrated.routeValue, 117);
  assert.equal(migrated.version, 2);
});
