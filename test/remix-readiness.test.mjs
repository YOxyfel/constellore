import assert from "node:assert/strict";
import test from "node:test";

import {
  CLEAN_WINS_FOR_FAMILY_MASTERY,
  CLEAN_WINS_PER_INTENSITY_STEP,
  REMIX_READINESS_HISTORY_LIMIT,
  REMIX_READINESS_VERSION,
  createRemixReadinessState,
  getAdaptiveRemixIntensity,
  getRemixFamilyMastery,
  recordRemixReadinessOutcome,
  sanitizeRemixReadinessState,
  selectAdaptiveRemixPlan
} from "../public/remix-readiness.mjs";

const WAYPOINT = "required_waypoint";
const SHORTCUT = "forbidden_shortcut";
const MASTER = "master_route";
const GRAPH = "graph_safe_rule";
const ORBIT = "orbit_chain";

function record(state, index, overrides = {}) {
  return recordRemixReadinessOutcome(state, {
    outcomeId: `run-${index}`,
    rankId: "diamond",
    outcome: "completed",
    clean: true,
    mistakes: 0,
    families: [WAYPOINT],
    ...overrides
  }).state;
}

function masterFamilies(state, ids, rankId = "cosmic") {
  let next = state;
  let index = next.totalRankedOutcomes;
  for (const id of ids) {
    for (let win = 0; win < CLEAN_WINS_FOR_FAMILY_MASTERY; win += 1) {
      next = record(next, `master-${id}-${index++}`, {
        rankId,
        families: [id]
      });
    }
  }
  return next;
}

test("readiness state is compact, serializable, and starts with no assumed mastery", () => {
  const state = createRemixReadinessState();
  assert.equal(state.version, REMIX_READINESS_VERSION);
  assert.equal(state.totalRankedOutcomes, 0);
  assert.deepEqual(state.recentOutcomes, []);
  assert.deepEqual(Object.keys(state.familyMastery), [
    WAYPOINT,
    SHORTCUT,
    MASTER,
    GRAPH,
    ORBIT
  ]);
  assert.ok(Object.values(state.familyMastery).every((value) =>
    value.attempts === 0
    && value.completions === 0
    && value.cleanCompletions === 0
    && value.mastered === false
  ));
  assert.deepEqual(
    JSON.parse(JSON.stringify(state)),
    state
  );
});

test("sanitization is allowlist-only and derives mastery from valid evidence", () => {
  const state = sanitizeRemixReadinessState({
    version: 999,
    totalRankedOutcomes: 12.9,
    email: "not-persisted@example.com",
    familyMastery: {
      [WAYPOINT]: {
        attempts: 2,
        completions: 99,
        cleanCompletions: 99,
        mastered: true,
        secret: "discard"
      },
      [SHORTCUT]: {
        attempts: 4,
        completions: 4,
        cleanCompletions: 3,
        mastered: false
      },
      invented_rule: {
        attempts: 999,
        completions: 999,
        cleanCompletions: 999,
        mastered: true
      }
    },
    recentOutcomes: [{
      idHash: "12345678",
      rankId: "diamond",
      outcome: "completed",
      clean: true,
      families: [WAYPOINT, "invented_rule", WAYPOINT],
      rawPrompt: "discard"
    }]
  });
  assert.equal(state.version, 1);
  assert.equal(state.totalRankedOutcomes, 12);
  assert.deepEqual(state.familyMastery[WAYPOINT], {
    attempts: 2,
    completions: 2,
    cleanCompletions: 2,
    mastered: false
  });
  assert.equal(state.familyMastery[SHORTCUT].mastered, true);
  assert.equal("invented_rule" in state.familyMastery, false);
  assert.deepEqual(state.recentOutcomes[0], {
    idHash: "12345678",
    rankId: "diamond",
    outcome: "completed",
    clean: true,
    activeCount: 1,
    families: [WAYPOINT]
  });
  assert.equal("email" in state, false);
});

test("three clean wins prove each intensity step while lesser evidence does not", () => {
  assert.equal(CLEAN_WINS_PER_INTENSITY_STEP, 3);
  let state = createRemixReadinessState();
  assert.equal(getAdaptiveRemixIntensity(state, "diamond").activeCount, 1);

  state = record(state, 1);
  state = record(state, 2);
  let intensity = getAdaptiveRemixIntensity(state, "diamond");
  assert.equal(intensity.activeCount, 1);
  assert.equal(intensity.cleanWinsTowardNextStep, 2);
  assert.equal(intensity.cleanWinsNeededForNextStep, 1);

  state = record(state, 3);
  intensity = getAdaptiveRemixIntensity(state, "diamond");
  assert.equal(intensity.activeCount, 2);
  assert.equal(intensity.atMaximum, true);
  assert.equal(intensity.cleanWinsNeededForNextStep, 0);
});

test("failed, revealed, and forfeited challenges immediately return to rank minimum", () => {
  for (const outcome of ["failed", "reveal", "forfeit"]) {
    let state = createRemixReadinessState();
    state = record(state, `${outcome}-1`);
    state = record(state, `${outcome}-2`);
    state = record(state, `${outcome}-3`);
    assert.equal(getAdaptiveRemixIntensity(state, "diamond").activeCount, 2);

    state = record(state, `${outcome}-4`, {
      outcome,
      clean: true
    });
    const intensity = getAdaptiveRemixIntensity(state, "diamond");
    assert.equal(intensity.activeCount, 1, outcome);
    assert.equal(intensity.lastOutcome, outcome);
    assert.equal(intensity.cleanWinsTowardNextStep, 0);
  }
});

test("assisted, mistaken, and ordinary completions never count as clean proof", () => {
  let state = createRemixReadinessState();
  state = record(state, 1, { assisted: true });
  state = record(state, 2, { usedHint: true });
  state = record(state, 3, { mistakes: 1 });
  state = record(state, 4, { clean: false });
  const intensity = getAdaptiveRemixIntensity(state, "diamond");
  assert.equal(intensity.activeCount, 1);
  assert.equal(intensity.cleanWinsTowardNextStep, 0);
  assert.ok(state.recentOutcomes.every((entry) => entry.clean === false));
});

test("proof is rank-specific and a new rank starts at its own minimum", () => {
  let state = createRemixReadinessState();
  for (let index = 0; index < 9; index += 1) {
    state = record(state, index, {
      rankId: "diamond"
    });
  }
  assert.equal(getAdaptiveRemixIntensity(state, "diamond").activeCount, 2);
  assert.equal(getAdaptiveRemixIntensity(state, "sapphire").activeCount, 2);
  assert.equal(
    getAdaptiveRemixIntensity(state, "sapphire").cleanWinsTowardNextStep,
    0
  );
});

test("family mastery takes three clean completions and cannot be claimed by a flag", () => {
  assert.equal(CLEAN_WINS_FOR_FAMILY_MASTERY, 3);
  let state = createRemixReadinessState();
  state = record(state, 1, { families: [WAYPOINT] });
  state = record(state, 2, { families: [WAYPOINT] });
  assert.deepEqual(getRemixFamilyMastery(state, WAYPOINT), {
    id: WAYPOINT,
    attempts: 2,
    completions: 2,
    cleanCompletions: 2,
    mastered: false,
    cleanWinsRequired: 3,
    cleanWinsRemaining: 1
  });

  const result = recordRemixReadinessOutcome(state, {
    outcomeId: "mastery-win",
    rankId: "gold",
    outcome: "completed",
    clean: true,
    families: [WAYPOINT]
  });
  assert.deepEqual(result.masteryGained, [WAYPOINT]);
  assert.equal(getRemixFamilyMastery(result.state, WAYPOINT).mastered, true);

  const forged = sanitizeRemixReadinessState({
    familyMastery: {
      [ORBIT]: {
        attempts: 0,
        completions: 0,
        cleanCompletions: 0,
        mastered: true
      }
    }
  });
  assert.equal(forged.familyMastery[ORBIT].mastered, false);
});

test("stable outcome IDs make recording idempotent without storing the raw ID", () => {
  const initial = createRemixReadinessState();
  const first = recordRemixReadinessOutcome(initial, {
    outcomeId: "private-run-id-123",
    rankId: "gold",
    outcome: "completed",
    clean: true,
    families: [WAYPOINT]
  });
  const duplicate = recordRemixReadinessOutcome(first.state, {
    outcomeId: "private-run-id-123",
    rankId: "gold",
    outcome: "completed",
    clean: true,
    families: [WAYPOINT]
  });
  assert.equal(first.changed, true);
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.state, first.state);
  assert.equal(
    JSON.stringify(first.state).includes("private-run-id-123"),
    false
  );
});

test("adaptive plans are deterministic and stay inside a proven rank range", () => {
  let state = createRemixReadinessState();
  state = masterFamilies(state, [WAYPOINT, SHORTCUT, MASTER, GRAPH, ORBIT]);
  for (let index = 0; index < 3; index += 1) {
    state = record(state, `mythic-proof-${index}`, {
      rankId: "mythic",
      families: [WAYPOINT, SHORTCUT, MASTER, GRAPH]
    });
  }
  const first = selectAdaptiveRemixPlan({
    state,
    rank: "mythic",
    seed: "player-42"
  });
  const repeat = selectAdaptiveRemixPlan({
    state: JSON.parse(JSON.stringify(state)),
    rank: "mythic",
    seed: "player-42"
  });
  assert.deepEqual(repeat, first);
  assert.equal(first.requestedCount, 5);
  assert.equal(first.activeCount, 5);
  assert.equal(first.belowRankMinimum, false);
  assert.ok(first.activeCount >= first.rank.minimumRemixes);
  assert.ok(first.activeCount <= first.rank.maximumRemixes);
});

test("a plan introduces at most one unmastered family and focuses it until mastery", () => {
  let state = createRemixReadinessState();
  state = masterFamilies(state, [WAYPOINT, SHORTCUT], "emerald");
  state = record(state, "master-route-first-clean", {
    rankId: "emerald",
    families: [MASTER]
  });
  const plan = selectAdaptiveRemixPlan({
    state,
    rank: "emerald",
    seed: 77
  });
  assert.equal(plan.activeCount, 2);
  assert.deepEqual(plan.unmasteredFamilyIds, [MASTER]);
  assert.equal(plan.introducesFamily, MASTER);
  assert.equal(plan.masteredFamilyIds.length, 1);

  for (let seed = 0; seed < 100; seed += 1) {
    const candidate = selectAdaptiveRemixPlan({
      state,
      rank: "cosmic",
      seed
    });
    assert.ok(candidate.unmasteredFamilyIds.length <= 1);
  }
});

test("onboarding safety overrides an impossible migrated rank instead of stacking unknown rules", () => {
  const plan = selectAdaptiveRemixPlan({
    state: createRemixReadinessState(),
    rank: "cosmic",
    seed: 5
  });
  assert.equal(plan.requestedCount, 5);
  assert.equal(plan.activeCount, 1);
  assert.equal(plan.unmasteredFamilyIds.length, 1);
  assert.equal(plan.reducedForOnboarding, true);
  assert.equal(plan.belowRankMinimum, true);
});

test("availability and pair compatibility are honored without breaking onboarding", () => {
  let state = createRemixReadinessState();
  state = masterFamilies(state, [WAYPOINT, SHORTCUT, MASTER], "emerald");
  const plan = selectAdaptiveRemixPlan({
    state,
    rank: "emerald",
    seed: 10,
    availableFamilies: [WAYPOINT, SHORTCUT, MASTER],
    incompatiblePairs: [
      [WAYPOINT, SHORTCUT],
      [WAYPOINT, MASTER]
    ]
  });
  assert.equal(plan.requestedCount, 2);
  assert.equal(plan.activeCount, 2);
  assert.deepEqual([...plan.familyIds].sort(), [MASTER, SHORTCUT].sort());
  assert.equal(plan.reducedForCompatibility, false);
});

test("history is bounded and malformed outcomes cannot alter readiness", () => {
  let state = createRemixReadinessState();
  for (let index = 0; index < REMIX_READINESS_HISTORY_LIMIT + 20; index += 1) {
    state = record(state, `bounded-${index}`);
  }
  assert.equal(state.recentOutcomes.length, REMIX_READINESS_HISTORY_LIMIT);
  assert.equal(
    state.totalRankedOutcomes,
    REMIX_READINESS_HISTORY_LIMIT + 20
  );

  for (const outcome of [
    "incorrect_pair",
    "hint",
    "unknown",
    "",
    null
  ]) {
    const result = recordRemixReadinessOutcome(state, {
      outcomeId: `bad-${String(outcome)}`,
      outcome,
      rankId: "cosmic",
      clean: true,
      families: [ORBIT]
    });
    assert.equal(result.changed, false);
    assert.deepEqual(result.state, state);
  }
});

test("fuzzed plans preserve count, family, and onboarding invariants", () => {
  let state = createRemixReadinessState();
  state = masterFamilies(state, [WAYPOINT, SHORTCUT, MASTER], "cosmic");
  const valid = new Set([WAYPOINT, SHORTCUT, MASTER, GRAPH, ORBIT]);
  for (let seed = 0; seed < 500; seed += 1) {
    const rank = 1 + (seed % 12);
    const plan = selectAdaptiveRemixPlan({ state, rank, seed });
    assert.ok(plan.activeCount <= plan.requestedCount);
    assert.ok(plan.activeCount <= plan.rank.maximumRemixes);
    assert.equal(new Set(plan.familyIds).size, plan.familyIds.length);
    assert.ok(plan.familyIds.every((id) => valid.has(id)));
    assert.ok(plan.unmasteredFamilyIds.length <= 1);
  }
});
