import assert from "node:assert/strict";
import test from "node:test";

import {
  ROUTE_REMIX_FAMILIES,
  checkRouteRemixBeforeCombination,
  checkRouteRemixCompletion,
  createRouteRemixPlan,
  createRouteRemixProgress,
  detectRouteRemixCapabilities,
  markRouteRemixAnswerRevealed,
  publicRouteRemixView,
  recordRouteRemixCombination,
  routeRemixProgress,
  sanitizeRouteRemixProgress,
  sanitizeRouteRemixRuntime
} from "../public/route-remixes.mjs";

const route = [
  { a: "Earth", b: "Water", word: "Mud" },
  { a: "Mud", b: "Fire", word: "Brick" },
  { a: "Brick", b: "Brick", word: "Wall" },
  { a: "Wall", b: "Air", word: "Castle" }
];

const recipes = [
  ...route,
  { a: "Stone", b: "Stone", word: "Wall" },
  { a: "King", b: "Wall", word: "Castle" },
  { a: "Mud", b: "Earth", word: "Clay" }
];

function play(runtime, combinations) {
  let progress = createRouteRemixProgress();
  for (const combination of combinations) {
    const recorded = recordRouteRemixCombination(runtime, progress, combination);
    assert.equal(recorded.accepted, true, recorded.check.reason);
    progress = recorded.progress;
  }
  return progress;
}

test("capability detector only offers constraints the canonical route can satisfy", () => {
  const capabilities = detectRouteRemixCapabilities({
    route,
    recipes,
    target: "Castle"
  });
  assert.equal(capabilities.validRoute, true);
  assert.deepEqual(capabilities.availableFamilies, ROUTE_REMIX_FAMILIES);
  assert.equal(capabilities.routeLength, 4);

  const oneStep = detectRouteRemixCapabilities({
    route: [{ a: "Fire", b: "Water", word: "Steam" }],
    target: "Steam"
  });
  assert.equal(oneStep.capability.required_waypoint.available, false);
  assert.equal(oneStep.capability.forbidden_shortcut.available, false);
  assert.equal(oneStep.capability.orbit_chain.available, false);
  assert.equal(oneStep.capability.master_route.available, true);
  assert.equal(oneStep.capability.graph_safe_rule.available, true);
});

test("plan generation is deterministic, compatible, and omits unavailable families", () => {
  const input = {
    route,
    recipes,
    target: "Castle",
    families: ROUTE_REMIX_FAMILIES,
    seed: "player-42"
  };
  const first = createRouteRemixPlan(input);
  const second = createRouteRemixPlan(input);
  assert.deepEqual(first, second);
  assert.deepEqual(first.runtime.activeFamilies, ROUTE_REMIX_FAMILIES);
  assert.deepEqual(first.omittedFamilies, []);
  assert.equal(first.runtime.constraints.master_route.moveCap, route.length);
  assert.equal(first.runtime.constraints.graph_safe_rule.requireTwin, true);
  assert.equal(first.runtime.constraints.orbit_chain.length, 4);
  assert.notEqual(
    first.runtime.constraints.forbidden_shortcut.pairKey,
    "air\u0000wall"
  );

  const unavailable = createRouteRemixPlan({
    route: [{ a: "Fire", b: "Water", word: "Steam" }],
    target: "Steam",
    families: ["waypoint", "orbit", "master"]
  });
  assert.deepEqual(unavailable.runtime.activeFamilies, ["master_route"]);
  assert.deepEqual(unavailable.omittedFamilies, ["required_waypoint", "orbit_chain"]);
});

test("public view is concise and never exposes Orbit Chain answer signatures", () => {
  const plan = createRouteRemixPlan({
    route,
    recipes,
    target: "Castle",
    families: ROUTE_REMIX_FAMILIES,
    seed: "safe-payload"
  });
  assert.equal(plan.public.count, 5);
  assert.match(plan.public.summary, /Waypoint/);
  const serialized = JSON.stringify(plan.public);
  assert.doesNotMatch(serialized, /pairKey|resultKey|sequence|earth\\u0000water/i);
  assert.match(serialized, /Finish with 4 linked fusions/);
  assert.deepEqual(publicRouteRemixView(plan.runtime), plan.public);
});

test("sanitizers are allowlist-only and normalize hostile persistence", () => {
  const runtime = sanitizeRouteRemixRuntime({
    version: 99,
    target: "  Castle\u0000 ",
    activeFamilies: ["MASTER-ROUTE", "master_route", "unknown"],
    constraints: {
      master_route: { moveCap: 9999, admin: true },
      unknown: { enabled: true }
    },
    playerId: "remove-me"
  });
  assert.deepEqual(runtime, {
    version: 1,
    target: "Castle",
    activeFamilies: ["master_route"],
    constraints: { master_route: { moveCap: 96 } }
  });

  const progress = sanitizeRouteRemixProgress({
    moves: -20,
    seenPairs: ["bad", "air\u0000wall", "air\u0000wall"],
    discoveredWords: [" Mud ", "mud", "\u0000Brick"],
    twinPairUsed: "yes",
    orbitPosition: 9_999,
    orbitComplete: 1,
    lastResult: " Castle ",
    score: 9999
  });
  assert.deepEqual(progress, {
    version: 1,
    moves: 0,
    seenPairs: ["air\u0000wall"],
    discoveredWords: ["mud", "brick"],
    twinPairUsed: false,
    orbitPosition: 96,
    orbitComplete: false,
    lastResult: "castle",
    targetPending: false,
    pendingTargetPair: "",
    answerRevealed: false
  });
});

test("forbidden shortcut and repeated-pair graph law are blocked before resolution", () => {
  const plan = createRouteRemixPlan({
    route,
    recipes,
    target: "Castle",
    families: ["forbidden_shortcut", "graph_safe_rule"],
    seed: "shortcut"
  });
  const forbidden = plan.runtime.constraints.forbidden_shortcut;
  const shortcut = checkRouteRemixBeforeCombination(
    plan.runtime,
    createRouteRemixProgress(),
    forbidden
  );
  assert.equal(shortcut.allowed, false);
  assert.equal(shortcut.code, "forbidden_shortcut");
  assert.equal(shortcut.terminal, false);

  const once = recordRouteRemixCombination(
    plan.runtime,
    createRouteRemixProgress(),
    route[0]
  );
  assert.equal(once.accepted, true);
  const repeated = checkRouteRemixBeforeCombination(plan.runtime, once.progress, route[0]);
  assert.equal(repeated.allowed, false);
  assert.equal(repeated.code, "repeated_pair");
  const defensive = recordRouteRemixCombination(plan.runtime, once.progress, route[0]);
  assert.equal(defensive.accepted, false);
  assert.deepEqual(defensive.progress, once.progress);
});

test("unknown or unsuccessful mixes do not spend a Master Route move", () => {
  const plan = createRouteRemixPlan({
    route,
    target: "Castle",
    families: ["master_route"]
  });
  const empty = createRouteRemixProgress();
  const unresolved = recordRouteRemixCombination(plan.runtime, empty, {
    a: "Air",
    b: "Mud",
    successful: false
  });
  assert.equal(unresolved.accepted, false);
  assert.equal(unresolved.progress.moves, 0);
  const resolved = recordRouteRemixCombination(plan.runtime, empty, route[0]);
  assert.equal(resolved.progress.moves, 1);
});

test("canonical route satisfies every generated modifier together", () => {
  const plan = createRouteRemixPlan({
    route,
    recipes,
    target: "Castle",
    families: ROUTE_REMIX_FAMILIES,
    seed: "all-together"
  });
  const progress = play(plan.runtime, route);
  assert.equal(progress.moves, 4);
  assert.equal(progress.twinPairUsed, true);
  assert.equal(progress.orbitComplete, true);
  assert.equal(progress.orbitPosition, 4);
  const completion = checkRouteRemixCompletion(plan.runtime, progress, "Castle");
  assert.deepEqual(completion, {
    complete: true,
    failed: false,
    status: "complete",
    code: "complete",
    reason: "Route complete.",
    blockers: []
  });
  assert.deepEqual(routeRemixProgress(plan.runtime, progress), {
    complete: true,
    rulesComplete: true,
    studyComplete: false,
    targetRetryRequired: false,
    completeCount: 4,
    total: 4,
    items: [
      {
        family: "required_waypoint",
        complete: true,
        text: `${plan.runtime.constraints.required_waypoint.word} reached`
      },
      { family: "forbidden_shortcut", complete: true, text: "King + Wall closed" },
      { family: "master_route", complete: true, text: "4/4 fusions" },
      { family: "graph_safe_rule", complete: true, text: "Matching pair used" },
      { family: "orbit_chain", complete: true, text: "4/4 chain" }
    ],
    summary: "4/4 route rules"
  });
});

test("Orbit Chain is a real consecutive suffix and resets after a detour", () => {
  const chainRoute = [
    { a: "Earth", b: "Water", word: "Mud" },
    { a: "Fire", b: "Air", word: "Smoke" },
    { a: "Mud", b: "Smoke", word: "Fog" },
    { a: "Fog", b: "Air", word: "Cloud" }
  ];
  const plan = createRouteRemixPlan({
    route: chainRoute,
    target: "Cloud",
    families: ["orbit_chain"]
  });
  assert.equal(plan.runtime.constraints.orbit_chain.length, 3);
  let progress = createRouteRemixProgress();
  progress = recordRouteRemixCombination(plan.runtime, progress, chainRoute[1]).progress;
  assert.equal(progress.orbitPosition, 1);
  progress = recordRouteRemixCombination(
    plan.runtime,
    progress,
    { a: "Earth", b: "Fire", word: "Lava" }
  ).progress;
  assert.equal(progress.orbitPosition, 0);
  progress = play(plan.runtime, chainRoute.slice(1));
  assert.equal(progress.orbitComplete, true);
  assert.equal(checkRouteRemixCompletion(plan.runtime, progress, "Cloud").complete, true);
});

test("making a target early reports the first short unmet rule instead of completing", () => {
  const plan = createRouteRemixPlan({
    route,
    target: "Castle",
    families: ["required_waypoint", "graph_safe_rule"],
    seed: "missing-rules"
  });
  const progress = recordRouteRemixCombination(
    plan.runtime,
    createRouteRemixProgress(),
    { a: "Wall", b: "Air", word: "Castle" }
  ).progress;
  const completion = checkRouteRemixCompletion(plan.runtime, progress, "Castle");
  assert.equal(completion.complete, false);
  assert.equal(completion.failed, false);
  assert.equal(completion.status, "continue");
  assert.equal(completion.code, "waypoint_missing");
  assert.match(completion.reason, /^Make .+ first\.$/);
  assert.deepEqual(
    completion.blockers.map((blocker) => blocker.code),
    ["waypoint_missing", "twin_pair_missing"]
  );
});

test("a blocked target pair gets one fair retry after every other rule is ready", () => {
  const plan = createRouteRemixPlan({
    route,
    target: "Castle",
    families: ["required_waypoint", "graph_safe_rule"],
    seed: "recoverable-target"
  });
  let progress = createRouteRemixProgress();
  const earlyTarget = recordRouteRemixCombination(
    plan.runtime,
    progress,
    route.at(-1)
  );
  assert.equal(earlyTarget.accepted, true);
  progress = earlyTarget.progress;
  assert.equal(progress.targetPending, true);
  assert.equal(checkRouteRemixCompletion(plan.runtime, progress, "Castle").complete, false);

  const tooEarlyRetry = checkRouteRemixBeforeCombination(
    plan.runtime,
    progress,
    route.at(-1)
  );
  assert.equal(tooEarlyRetry.allowed, false);
  assert.equal(tooEarlyRetry.code, "repeated_pair");

  for (const step of route.slice(0, -1)) {
    const recorded = recordRouteRemixCombination(plan.runtime, progress, step);
    assert.equal(recorded.accepted, true);
    progress = recorded.progress;
  }
  assert.deepEqual(
    {
      complete: routeRemixProgress(plan.runtime, progress).complete,
      targetRetryRequired: routeRemixProgress(plan.runtime, progress).targetRetryRequired,
      summary: routeRemixProgress(plan.runtime, progress).summary
    },
    {
      complete: false,
      targetRetryRequired: true,
      summary: "Make Castle again"
    }
  );
  const readyRetry = checkRouteRemixBeforeCombination(plan.runtime, progress, route.at(-1));
  assert.equal(readyRetry.allowed, true);
  const recovered = recordRouteRemixCombination(plan.runtime, progress, route.at(-1));
  assert.equal(recovered.accepted, true);
  assert.equal(recovered.progress.targetPending, false);
  assert.equal(checkRouteRemixCompletion(plan.runtime, recovered.progress, "Castle").complete, true);
});

test("Reveal finishes display progress but can never satisfy scored completion", () => {
  const plan = createRouteRemixPlan({
    route,
    target: "Castle",
    families: ["required_waypoint", "orbit_chain"]
  });
  const revealed = markRouteRemixAnswerRevealed(createRouteRemixProgress());
  assert.equal(revealed.answerRevealed, true);
  assert.deepEqual(routeRemixProgress(plan.runtime, revealed), {
    complete: true,
    rulesComplete: false,
    studyComplete: true,
    targetRetryRequired: false,
    completeCount: 0,
    total: 2,
    items: [
      {
        family: "required_waypoint",
        complete: false,
        text: `Make ${plan.runtime.constraints.required_waypoint.word}`
      },
      { family: "orbit_chain", complete: false, text: "0/4 chain" }
    ],
    summary: "Answer shown · score off"
  });
  const completion = checkRouteRemixCompletion(plan.runtime, revealed, "Castle");
  assert.equal(completion.complete, false);
  assert.equal(completion.status, "study");
  assert.equal(completion.code, "answer_revealed");
});

test("Master Route cap becomes a terminal short failure", () => {
  const runtime = sanitizeRouteRemixRuntime({
    target: "Castle",
    activeFamilies: ["master_route"],
    constraints: { master_route: { moveCap: 2 } }
  });
  let progress = createRouteRemixProgress();
  progress = recordRouteRemixCombination(
    runtime,
    progress,
    { a: "Earth", b: "Water", word: "Mud" }
  ).progress;
  progress = recordRouteRemixCombination(
    runtime,
    progress,
    { a: "Fire", b: "Water", word: "Steam" }
  ).progress;
  const blocked = checkRouteRemixBeforeCombination(runtime, progress, {
    a: "Wall",
    b: "Air"
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, "master_route_limit");
  assert.equal(blocked.terminal, true);

  const overCapProgress = sanitizeRouteRemixProgress({
    ...progress,
    moves: 3,
    lastResult: "Castle"
  });
  const completion = checkRouteRemixCompletion(runtime, overCapProgress, "Castle");
  assert.equal(completion.complete, false);
  assert.equal(completion.failed, true);
  assert.equal(completion.status, "failed");
  assert.equal(completion.code, "master_route_limit");
});
