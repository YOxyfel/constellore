import assert from "node:assert/strict";
import test from "node:test";

import {
  PATH_GUARD_RANKS,
  PATH_GUARD_TARGET_MODES,
  createPathGuardEvidence,
  evaluatePathGuard,
  pathGuardEligibility,
  pathGuardPairKey,
  shouldPathGuardReject
} from "../public/path-guard.mjs";

const solutionRoute = [
  { a: "Earth", b: "Water", word: "Mud" },
  { a: "Fire", b: "Air", word: "Energy" },
  { a: "Mud", b: "Energy", word: "Life" },
  { a: "Water", b: "Air", word: "Rain" }
];

function eligibleContext(overrides = {}) {
  return {
    rankId: "bronze",
    mode: "reach",
    target: "Life",
    assist: "none",
    scoringDisabled: false,
    finished: false,
    ...overrides
  };
}

function evidence(overrides = {}) {
  return createPathGuardEvidence({
    authoritative: true,
    target: "Life",
    solutionRoute,
    available: ["Earth", "Water", "Fire", "Air"],
    ...overrides
  });
}

test("pair keys are normalized, order independent, and reject malformed words", () => {
  assert.equal(
    pathGuardPairKey(" Earth ", "WATER"),
    pathGuardPairKey("water", "earth")
  );
  assert.equal(
    pathGuardPairKey("Mud", "Mud"),
    JSON.stringify(["mud", "mud"])
  );
  assert.equal(pathGuardPairKey("", "Water"), "");
  assert.equal(pathGuardPairKey(Symbol("Earth"), "Water"), "");
});

test("route evidence follows only the target dependency closure", () => {
  const initial = evidence();
  assert.equal(initial.route.provided, true);
  assert.equal(initial.route.valid, true);
  assert.equal(initial.route.complete, false);
  assert.deepEqual(
    initial.route.expectedPairs.map((pair) => pair.key).sort(),
    [
      pathGuardPairKey("Earth", "Water"),
      pathGuardPairKey("Fire", "Air")
    ].sort()
  );
  assert.equal(
    initial.route.expectedPairs.some((pair) => pair.result === "Rain"),
    false
  );
  assert.deepEqual(initial.route.completedPairs, []);

  const afterMud = evidence({
    available: ["Earth", "Water", "Fire", "Air", "Mud"]
  });
  assert.deepEqual(
    afterMud.route.expectedPairs.map((pair) => pair.key),
    [pathGuardPairKey("Fire", "Air")]
  );
  assert.deepEqual(
    afterMud.route.completedPairs.map((pair) => pair.key),
    [pathGuardPairKey("Earth", "Water")]
  );
});

test("malformed, cyclic, ambiguous, and incomplete routes do not become evidence", () => {
  const variants = [
    [...solutionRoute, { a: "", b: "Air", word: "Broken" }],
    [
      { a: "Loop", b: "Earth", word: "Loop" },
      { a: "Loop", b: "Water", word: "Life" }
    ],
    [
      { a: "Earth", b: "Water", word: "Mud" },
      { a: "Fire", b: "Air", word: "Mud" },
      { a: "Mud", b: "Mud", word: "Life" }
    ],
    [{ a: "Unknown", b: "Earth", word: "Life" }]
  ];
  for (const route of variants) {
    const model = evidence({ solutionRoute: route });
    assert.equal(model.route.valid, false);
    assert.deepEqual(model.route.expectedPairs, []);
    assert.deepEqual(model.route.completedPairs, []);
  }
});

test("only explicit Bronze and Silver unassisted solo target runs are eligible", () => {
  assert.deepEqual(PATH_GUARD_RANKS, ["bronze", "silver"]);
  assert.deepEqual(PATH_GUARD_TARGET_MODES, ["reach"]);
  assert.equal(pathGuardEligibility(eligibleContext()).active, true);
  assert.equal(pathGuardEligibility(eligibleContext({ rankId: "SILVER" })).active, true);

  for (const rankId of ["gold", "platinum", "diamond", "master"]) {
    const result = pathGuardEligibility(eligibleContext({ rankId }));
    assert.equal(result.active, false);
    assert.equal(result.reason, "rank-unrestricted");
  }
  for (const mode of [
    "explore",
    "training",
    "tutorial",
    "first-orbit",
    "second-orbit",
    "scramble",
    "moves",
    "quick",
    "daily",
    "weekly",
    "challenge",
    "sandbox",
    "unknown"
  ]) {
    const result = pathGuardEligibility(eligibleContext({ mode }));
    assert.equal(result.active, false);
    assert.equal(result.reason, "mode-unrestricted");
  }
});

test("missing policy state and every assisted flow fail open", () => {
  const omissions = [
    "rankId",
    "mode",
    "target",
    "assist",
    "scoringDisabled",
    "finished"
  ];
  for (const key of omissions) {
    const context = eligibleContext();
    delete context[key];
    assert.equal(pathGuardEligibility(context).active, false, key);
  }

  const assisted = [
    { assist: "sense" },
    { assist: "gift" },
    { assist: "wish" },
    { assist: "reveal" },
    { scoringDisabled: true },
    { assisted: true },
    { scoreEligible: false },
    { wished: true },
    { tutorial: true },
    { training: true },
    { multiplayer: true },
    { scramble: true },
    { finished: true },
    { reveal: { active: true } },
    { reveal: { pending: true } },
    { reveal: { revealed: true } },
    { powerups: { tipsUsed: 1 } },
    { powerups: { giftUsed: true } },
    { powerups: { currentTip: "Mud" } },
    { sense: { active: true } },
    { ranked: true },
    { practiceReplay: true },
    { remixes: { activeCount: 1, rules: [] } },
    { remixes: { activeCount: 0, rules: [{ family: "fog" }] } },
    { promotion: { active: true } }
  ];
  for (const override of assisted) {
    assert.equal(pathGuardEligibility(eligibleContext(override)).active, false);
  }
});

test("eligibility accepts the real nested state and profile shape", () => {
  const context = {
    state: {
      mode: "reach",
      game: { target: "Life" },
      run: { assist: "none", scoringDisabled: false },
      assist: "none",
      scoringDisabled: false,
      finished: false,
      reveal: {
        active: false,
        pending: false,
        revealed: false,
        replaying: false,
        replayUsed: false
      },
      powerups: {
        tipsUsed: 0,
        tipIds: [],
        currentTip: "",
        giftUsed: false,
        giftItem: null
      }
    },
    profile: {
      routeProgression: { rankId: "silver" }
    }
  };
  const result = pathGuardEligibility(context);
  assert.equal(result.active, true);
  assert.equal(result.rankId, "silver");
  assert.equal(result.mode, "reach");
  assert.equal(result.target, "Life");
});

test("a canonical route permits exact next steps but does not guess about alternatives", () => {
  const model = evidence();
  const expected = evaluatePathGuard(
    eligibleContext(),
    { a: "Water", b: "Earth" },
    model
  );
  assert.equal(expected.blocked, false);
  assert.equal(expected.reason, "expected-pair");
  assert.equal(expected.confidence, "authoritative");

  const alternate = evaluatePathGuard(
    eligibleContext(),
    { a: "Earth", b: "Fire" },
    model
  );
  assert.equal(alternate.blocked, false);
  assert.equal(alternate.reason, "insufficient-evidence");
});

test("only exact authoritative negative evidence blocks a non-exhaustive route", () => {
  const model = evidence({
    deadEndPairs: [{ a: "Earth", b: "Fire" }]
  });
  const blocked = evaluatePathGuard(
    eligibleContext(),
    { a: "Fire", b: "Earth" },
    model
  );
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.action, "reject");
  assert.equal(blocked.reason, "authoritative-dead-end");
  assert.equal(blocked.confidence, "authoritative");
  assert.match(blocked.message, /cannot advance/i);
  assert.equal(
    shouldPathGuardReject(
      eligibleContext(),
      { a: "Earth", b: "Fire" },
      model
    ),
    true
  );

  const other = evaluatePathGuard(
    eligibleContext(),
    { a: "Water", b: "Fire" },
    model
  );
  assert.equal(other.blocked, false);
});

test("authoritative exhaustive expected pairs reject only pairs outside a nonempty set", () => {
  const model = createPathGuardEvidence({
    authoritative: true,
    exhaustive: true,
    target: "Life",
    expectedPairs: [
      { a: "Earth", b: "Water" },
      { a: "Fire", b: "Air" }
    ]
  });
  assert.equal(
    evaluatePathGuard(
      eligibleContext(),
      { a: "Fire", b: "Air" },
      model
    ).blocked,
    false
  );
  const rejected = evaluatePathGuard(
    eligibleContext(),
    { a: "Earth", b: "Fire" },
    model
  );
  assert.equal(rejected.blocked, true);
  assert.equal(rejected.reason, "outside-exhaustive-route");

  const empty = createPathGuardEvidence({
    authoritative: true,
    exhaustive: true,
    target: "Life",
    expectedPairs: []
  });
  assert.equal(
    evaluatePathGuard(
      eligibleContext(),
      { a: "Earth", b: "Fire" },
      empty
    ).blocked,
    false
  );
});

test("non-authoritative, conflicting, and target-mismatched evidence always passes", () => {
  const nonAuthoritative = createPathGuardEvidence({
    exhaustive: true,
    target: "Life",
    expectedPairs: [{ a: "Earth", b: "Water" }],
    deadEndPairs: [{ a: "Earth", b: "Fire" }]
  });
  assert.equal(
    evaluatePathGuard(
      eligibleContext(),
      { a: "Earth", b: "Fire" },
      nonAuthoritative
    ).reason,
    "evidence-not-authoritative"
  );

  const conflict = createPathGuardEvidence({
    authoritative: true,
    target: "Life",
    expectedPairs: [{ a: "Earth", b: "Fire" }],
    deadEndPairs: [{ a: "Fire", b: "Earth" }]
  });
  const conflictResult = evaluatePathGuard(
    eligibleContext(),
    { a: "Earth", b: "Fire" },
    conflict
  );
  assert.equal(conflictResult.blocked, false);
  assert.equal(conflictResult.reason, "expected-pair");

  const mismatch = createPathGuardEvidence({
    authoritative: true,
    target: "Wall",
    deadEndPairs: [{ a: "Earth", b: "Fire" }]
  });
  assert.equal(
    evaluatePathGuard(
      eligibleContext(),
      { a: "Earth", b: "Fire" },
      mismatch
    ).reason,
    "evidence-target-mismatch"
  );
});

test("a completed canonical step can be rejected as confidently redundant", () => {
  const model = evidence({
    available: ["Earth", "Water", "Fire", "Air", "Mud"]
  });
  const result = evaluatePathGuard(
    eligibleContext(),
    { a: "Earth", b: "Water" },
    model
  );
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "completed-route-pair");
});

test("Gold+, Explore, training, reveal, assisted, and Scramble never reject", () => {
  const definitelyBlocked = evidence({
    deadEndPairs: [{ a: "Earth", b: "Fire" }]
  });
  const contexts = [
    eligibleContext({ rankId: "gold" }),
    eligibleContext({ mode: "explore" }),
    eligibleContext({ mode: "training" }),
    eligibleContext({ reveal: { revealed: true } }),
    eligibleContext({ assist: "gift" }),
    eligibleContext({ scoringDisabled: true }),
    eligibleContext({ mode: "scramble", multiplayer: true })
  ];
  for (const context of contexts) {
    const result = evaluatePathGuard(
      context,
      { a: "Earth", b: "Fire" },
      definitelyBlocked
    );
    assert.equal(result.active, false);
    assert.equal(result.blocked, false);
    assert.equal(result.action, "pass");
  }
});

test("hostile getters and revoked proxies cannot throw or cause rejection", () => {
  const throwing = {};
  Object.defineProperty(throwing, "rankId", {
    enumerable: true,
    get() {
      throw new Error("do not invoke");
    }
  });
  assert.doesNotThrow(() => pathGuardEligibility(throwing));
  assert.equal(pathGuardEligibility(throwing).active, false);

  const hostileRoute = [];
  Object.defineProperty(hostileRoute, "0", {
    enumerable: true,
    get() {
      throw new Error("do not invoke");
    }
  });
  hostileRoute.length = 1;
  assert.doesNotThrow(() => createPathGuardEvidence({
    authoritative: true,
    target: "Life",
    solutionRoute: hostileRoute,
    available: ["Earth"]
  }));

  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  assert.doesNotThrow(() => pathGuardEligibility(proxy));
  assert.doesNotThrow(() => createPathGuardEvidence(proxy));
  assert.doesNotThrow(() => evaluatePathGuard(proxy, proxy, proxy));
  assert.equal(evaluatePathGuard(proxy, proxy, proxy).blocked, false);
});

test("evidence and decisions are deeply frozen, bounded, and do not mutate inputs", () => {
  const deadEndPairs = Array.from({ length: 600 }, (_, index) => ({
    a: `Left ${index}`,
    b: `Right ${index}`
  }));
  const input = {
    authoritative: true,
    target: "Life",
    deadEndPairs
  };
  const model = createPathGuardEvidence(input);
  assert.equal(model.deadEndPairs.length, 512);
  assert.equal(deadEndPairs.length, 600);
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(model.route));
  assert.ok(Object.isFrozen(model.expectedPairs));
  assert.ok(Object.isFrozen(model.deadEndPairs));
  assert.ok(model.deadEndPairs.every(Object.isFrozen));

  const result = evaluatePathGuard(
    eligibleContext(),
    { a: "Left 0", b: "Right 0" },
    model
  );
  assert.ok(Object.isFrozen(result));
  assert.equal(result.blocked, true);
});
