import assert from "node:assert/strict";
import test from "node:test";

import {
  ADAPTIVE_COMPLETIONS_PER_LEVEL,
  ADAPTIVE_DIFFICULTY_VERSION,
  ADAPTIVE_LEVEL_MAX,
  ADAPTIVE_LEVEL_MIN,
  ADAPTIVE_LEVEL_START,
  ADAPTIVE_MAJOR_CHALLENGE_BONUS,
  ADAPTIVE_MAJOR_CHALLENGE_INTERVAL,
  ADAPTIVE_RECENT_TARGET_LIMIT,
  adaptiveChallengeLevel,
  adaptiveChallengeProfile,
  adaptiveDifficultyTag,
  adaptiveModePolicy,
  adaptiveRewardMultiplier,
  adaptiveRunEntryPolicy,
  applyAdaptiveChallengeOutcome,
  createAdaptiveDifficultyState,
  estimateAdaptiveChallengeLevel,
  parseAdaptiveAvoidTarget,
  rememberAdaptiveTarget,
  sanitizeAdaptiveDifficultyState,
  selectAdaptiveChallenge
} from "../public/adaptive-difficulty.mjs";

function finish(state, outcome, mode = "reach") {
  return applyAdaptiveChallengeOutcome(state, { mode, outcome });
}

test("only genuinely hard realized challenges receive a public tag", () => {
  assert.equal(adaptiveDifficultyTag(null), "");
  assert.equal(adaptiveDifficultyTag(7), "");
  assert.equal(adaptiveDifficultyTag(8), "Difficult");
  assert.equal(adaptiveDifficultyTag(10), "Difficult");
});

test("new v2 players start at the gentlest level without changing persisted levels", () => {
  assert.equal(ADAPTIVE_DIFFICULTY_VERSION, 2);
  assert.equal(ADAPTIVE_LEVEL_START, 1);
  assert.equal(ADAPTIVE_COMPLETIONS_PER_LEVEL, 3);
  assert.equal(ADAPTIVE_MAJOR_CHALLENGE_INTERVAL, 10);
  assert.equal(ADAPTIVE_MAJOR_CHALLENGE_BONUS, 3);
  assert.deepEqual(createAdaptiveDifficultyState(), {
    version: 2,
    level: 1,
    failureStreak: 0,
    completedChallenges: 0,
    majorChallengePending: false,
    majorChallengeBaseLevel: null,
    recoveryLevel: null,
    recoveryStrict: false,
    recentTargets: []
  });
  assert.deepEqual(adaptiveChallengeProfile(createAdaptiveDifficultyState()), {
    baseLevel: 1,
    requestedLevel: 1,
    effectiveLevel: 1,
    majorChallenge: false,
    surge: false,
    surgePending: false,
    majorChallengeBonus: 0,
    completedChallenges: 0,
    completionsTowardNextLevel: 0,
    completionsUntilNextLevel: 3
  });
  assert.equal(sanitizeAdaptiveDifficultyState({
    version: 2,
    level: 4,
    completedChallenges: 2
  }).level, 4);
});

test("v1 persistence migrates safely without inventing completion history", () => {
  assert.deepEqual(sanitizeAdaptiveDifficultyState({
    version: 1,
    level: 7,
    failureStreak: 3,
    completedChallenges: 999,
    majorChallengePending: true,
    majorChallengeBaseLevel: 9,
    recentTargets: ["  Moon  ", "Forest", "moon", "\u0000 Star \n"],
    playerId: "do-not-keep",
    score: 9000
  }), {
    version: 2,
    level: 7,
    failureStreak: 3,
    completedChallenges: 0,
    majorChallengePending: false,
    majorChallengeBaseLevel: null,
    recoveryLevel: null,
    recoveryStrict: false,
    recentTargets: ["Forest", "moon", "Star"]
  });
  assert.deepEqual(sanitizeAdaptiveDifficultyState(null), createAdaptiveDifficultyState());
});

test("v2 sanitation clamps values and a milestone snapshot is authoritative", () => {
  assert.deepEqual(sanitizeAdaptiveDifficultyState({
    version: 2,
    level: 2,
    failureStreak: -10,
    completedChallenges: 12.4,
    majorChallengePending: true,
    majorChallengeBaseLevel: 6,
    recentTargets: []
  }), {
    version: 2,
    level: 6,
    failureStreak: 0,
    completedChallenges: 12,
    majorChallengePending: true,
    majorChallengeBaseLevel: 6,
    recoveryLevel: null,
    recoveryStrict: false,
    recentTargets: []
  });
  assert.equal(adaptiveChallengeLevel({
    version: 2,
    level: 6,
    completedChallenges: 10,
    majorChallengePending: true,
    majorChallengeBaseLevel: 6
  }), 9);
  assert.equal(adaptiveChallengeLevel({
    version: 2,
    level: 9,
    completedChallenges: 10,
    majorChallengePending: true,
    majorChallengeBaseLevel: 9
  }), 10, "the major challenge still respects the level-ten ceiling");

  assert.equal(sanitizeAdaptiveDifficultyState({
    level: 5,
    completedChallenges: 8,
    majorChallengePending: false
  }).completedChallenges, 8, "projected v2 state may omit its version field");
});

test("only every third completed challenge raises the ordinary level", () => {
  let state = createAdaptiveDifficultyState(4);
  const results = [];
  for (let index = 0; index < 3; index += 1) {
    const result = finish(state, "completed");
    state = result.state;
    results.push(result);
  }

  assert.deepEqual(results.map((result) => result.state.level), [4, 4, 5]);
  assert.deepEqual(results.map((result) => result.adjustment), ["progress", "progress", "harder"]);
  assert.deepEqual(results.map((result) => result.metadata.completionsTowardNextLevel), [1, 2, 0]);
  assert.match(results[0].message, /1 of 3/i);
  assert.match(results[1].message, /2 of 3/i);
  assert.match(results[2].message, /three challenges complete/i);
  assert.equal(results[2].metadata.levelRaised, true);
});

test("each ordinary final failure lowers exactly one level, never progressively", () => {
  let state = {
    ...createAdaptiveDifficultyState(8),
    completedChallenges: 2
  };
  const levels = [];
  for (const outcome of ["failed", "timeout", "forfeit", "reveal", "study"]) {
    const result = finish(state, outcome, "quick");
    state = result.state;
    levels.push(state.level);
    assert.equal(result.metadata.failureStep, 1);
    assert.equal(result.metadata.easingStep, 1);
    assert.match(result.message, /one level gentler/i);
  }
  assert.deepEqual(levels, [7, 6, 5, 4, 3]);
  assert.equal(state.completedChallenges, 2, "a loss does not erase completed-challenge cadence");

  const atFloor = finish(createAdaptiveDifficultyState(ADAPTIVE_LEVEL_MIN), "given_up", "moves");
  assert.equal(atFloor.state.level, ADAPTIVE_LEVEL_MIN);
  assert.match(atFloor.message, /gentlest level/i);
});

test("the tenth completion arms one +3 milestone challenge", () => {
  const beforeTenth = {
    ...createAdaptiveDifficultyState(7),
    completedChallenges: 9
  };
  const tenth = finish(beforeTenth, "completed");
  assert.equal(tenth.state.completedChallenges, 10);
  assert.equal(tenth.state.level, 7);
  assert.equal(tenth.state.majorChallengePending, true);
  assert.equal(tenth.state.majorChallengeBaseLevel, 7);
  assert.equal(adaptiveChallengeLevel(tenth.state), 10);
  assert.equal(tenth.adjustment, "major");
  assert.equal(tenth.metadata.majorChallengeBonus, 3);
  assert.match(tenth.message, /one-game Surge challenge/i);
});

test("failing a milestone consumes it and restores exactly the pre-surge base", () => {
  const milestone = {
    ...createAdaptiveDifficultyState(6),
    completedChallenges: 10,
    majorChallengePending: true,
    majorChallengeBaseLevel: 6
  };
  const result = finish(milestone, "timeout");
  assert.equal(result.metadata.requestedLevelBefore, 9);
  assert.equal(result.state.level, 6);
  assert.equal(result.metadata.requestedLevelAfter, 6);
  assert.equal(result.state.completedChallenges, 10);
  assert.equal(result.state.majorChallengePending, false);
  assert.equal(result.state.majorChallengeBaseLevel, null);
  assert.equal(result.metadata.failureStep, 0);
  assert.equal(result.metadata.restoredAfterMajorFailure, true);
  assert.equal(result.adjustment, "easier");
  assert.match(result.message, /normal challenge level is safe/i);
});

test("an explicit surge game flag protects its base even if pending state was lost", () => {
  const result = applyAdaptiveChallengeOutcome(
    {
      ...createAdaptiveDifficultyState(6),
      completedChallenges: 10,
      majorChallengePending: false
    },
    {
      mode: "reach",
      outcome: "failed",
      surge: true,
      surgeBaseLevel: 6
    }
  );
  assert.equal(result.metadata.requestedLevelBefore, 9);
  assert.equal(result.state.level, 6);
  assert.equal(result.metadata.failureStep, 0);
  assert.equal(result.metadata.surgeWasActive, true);
  assert.equal(result.metadata.restoredAfterMajorFailure, true);
});

test("winning a milestone consumes it and counts toward the three-win cadence", () => {
  let state = {
    ...createAdaptiveDifficultyState(7),
    completedChallenges: 10,
    majorChallengePending: true,
    majorChallengeBaseLevel: 7
  };
  const milestoneWin = finish(state, "completed");
  state = milestoneWin.state;
  assert.equal(state.completedChallenges, 11);
  assert.equal(state.level, 7);
  assert.equal(state.majorChallengePending, false);
  assert.equal(milestoneWin.metadata.completionsTowardNextLevel, 2);
  assert.match(milestoneWin.message, /Surge cleared/i);

  const nextWin = finish(state, "completed");
  assert.equal(nextWin.state.completedChallenges, 12);
  assert.equal(nextWin.state.level, 8);
  assert.equal(nextWin.metadata.levelRaised, true);
});

test("a flawless Surge permanently promotes its effective level to the ordinary base", () => {
  const surge = {
    ...createAdaptiveDifficultyState(4),
    completedChallenges: 10,
    majorChallengePending: true,
    majorChallengeBaseLevel: 4
  };
  const mastered = applyAdaptiveChallengeOutcome(surge, {
    mode: "reach",
    outcome: "completed",
    flawless: true
  });
  assert.equal(mastered.state.level, 7);
  assert.equal(mastered.state.completedChallenges, 11);
  assert.equal(mastered.state.majorChallengePending, false);
  assert.equal(mastered.metadata.flawless, true);
  assert.equal(mastered.metadata.surgePerfected, true);
  assert.equal(mastered.metadata.promoted, true);
  assert.equal(mastered.metadata.promotedLevels, 3);
  assert.equal(mastered.metadata.levelRaised, true);
  assert.match(mastered.message, /Flawless Surge.*level 7.*normal difficulty/i);

  const laterFailure = finish(mastered.state, "failed");
  assert.equal(laterFailure.state.level, 6);
  assert.equal(laterFailure.metadata.failureStep, 1);
  assert.equal(laterFailure.metadata.surgeWasActive, false);
});

test("a flawless Surge suppresses a same-outcome three-win raise above the mastered level", () => {
  const result = applyAdaptiveChallengeOutcome({
    ...createAdaptiveDifficultyState(4),
    completedChallenges: 20,
    majorChallengePending: true,
    majorChallengeBaseLevel: 4
  }, {
    mode: "quick",
    outcome: "completed",
    flawless: true
  });
  assert.equal(result.state.completedChallenges, 21);
  assert.equal(result.metadata.completionsTowardNextLevel, 0);
  assert.equal(result.state.level, 7, "the cadence must not add an eighth level");
  assert.equal(result.metadata.promotedLevels, 3);
  assert.equal(result.metadata.cadenceLevelRaiseSuppressed, true);
});

test("an imperfect Surge completion keeps the ordinary cadence behavior", () => {
  const result = applyAdaptiveChallengeOutcome({
    ...createAdaptiveDifficultyState(4),
    completedChallenges: 20,
    majorChallengePending: true,
    majorChallengeBaseLevel: 4
  }, {
    mode: "moves",
    outcome: "completed",
    flawless: false
  });
  assert.equal(result.state.completedChallenges, 21);
  assert.equal(result.state.level, 5, "the ordinary third-win increase still applies");
  assert.equal(result.metadata.flawless, false);
  assert.equal(result.metadata.surgePerfected, false);
  assert.equal(result.metadata.promoted, false);
  assert.equal(result.metadata.promotedLevels, 0);
  assert.equal(result.metadata.cadenceLevelRaiseSuppressed, false);
  assert.match(result.message, /Surge cleared.*third win.*raised/i);
});

test("flawless Surge promotion respects the level-ten ceiling", () => {
  const nearCeiling = applyAdaptiveChallengeOutcome({
    ...createAdaptiveDifficultyState(9),
    completedChallenges: 10,
    majorChallengePending: true,
    majorChallengeBaseLevel: 9
  }, {
    mode: "reach",
    outcome: "completed",
    flawless: true
  });
  assert.equal(nearCeiling.state.level, 10);
  assert.equal(nearCeiling.metadata.surgePerfected, true);
  assert.equal(nearCeiling.metadata.promoted, true);
  assert.equal(nearCeiling.metadata.promotedLevels, 1);

  const atCeiling = applyAdaptiveChallengeOutcome({
    ...createAdaptiveDifficultyState(10),
    completedChallenges: 10,
    majorChallengePending: true,
    majorChallengeBaseLevel: 10
  }, {
    mode: "reach",
    outcome: "completed",
    flawless: true
  });
  assert.equal(atCeiling.state.level, 10);
  assert.equal(atCeiling.metadata.surgePerfected, true);
  assert.equal(atCeiling.metadata.promoted, false);
  assert.equal(atCeiling.metadata.promotedLevels, 0);
  assert.match(atCeiling.message, /level 10 stays/i);
});

test("a flawless flag cannot promote a non-Surge challenge", () => {
  const result = applyAdaptiveChallengeOutcome(createAdaptiveDifficultyState(4), {
    mode: "reach",
    outcome: "completed",
    flawless: true
  });
  assert.equal(result.state.level, 4);
  assert.equal(result.state.completedChallenges, 1);
  assert.equal(result.metadata.flawless, true);
  assert.equal(result.metadata.surgeWasActive, false);
  assert.equal(result.metadata.surgePerfected, false);
  assert.equal(result.metadata.promoted, false);
  assert.equal(result.metadata.promotedLevels, 0);
  assert.match(result.message, /1 of 3 wins/i);
});

test("a thirtieth completion can raise the base and arm the milestone together", () => {
  const result = finish({
    ...createAdaptiveDifficultyState(5),
    completedChallenges: 29
  }, "completed");
  assert.equal(result.state.completedChallenges, 30);
  assert.equal(result.state.level, 6);
  assert.equal(result.state.majorChallengeBaseLevel, 6);
  assert.equal(adaptiveChallengeLevel(result.state), 9);
  assert.equal(result.adjustment, "major");
  assert.equal(result.metadata.levelRaised, true);
  assert.match(result.message, /three wins raised.*Surge/i);
});

test("ordinary pair misses and optional hints never change progression", () => {
  const start = {
    ...createAdaptiveDifficultyState(7),
    failureStreak: 2,
    completedChallenges: 8,
    recentTargets: ["Ocean"]
  };
  for (const outcome of [
    "invalid_pair",
    "incorrect_pair",
    "combination_missing",
    "rejected_pair",
    "missed_pair",
    "hint"
  ]) {
    const result = finish(start, outcome);
    assert.deepEqual(result.state, sanitizeAdaptiveDifficultyState(start), outcome);
    assert.equal(result.outcome, "ignored");
    assert.equal(result.message, "");
  }
});

test("fixed, shared, daily, custom, and training challenges remain excluded", () => {
  for (const context of [
    { mode: "daily" },
    { mode: "weekly" },
    { mode: "challenge" },
    { mode: "training" },
    { mode: "second-orbit" },
    { mode: "reach", custom: true },
    { mode: "quick", shared: true },
    { mode: "moves", fixed: true },
    { mode: "reach", userChosen: true }
  ]) {
    const policy = adaptiveModePolicy(context);
    assert.equal(policy.eligible, false, JSON.stringify(context));
    assert.equal(policy.fairness.adaptiveTargeting, false);
    assert.equal(policy.fairness.rankedEligible, "unchanged");
    const outcome = applyAdaptiveChallengeOutcome(
      createAdaptiveDifficultyState(7),
      { ...context, outcome: "failed" }
    );
    assert.equal(outcome.state.level, 7);
  }
  for (const mode of ["reach", "quick", "moves"]) {
    assert.equal(adaptiveModePolicy({ mode }).eligible, true, mode);
  }
});

test("Bronze and Silver pressure requests become personal Reach runs until Gold", () => {
  for (const rank of [{ id: "bronze", number: 1 }, { id: "silver", number: 2 }]) {
    for (const mode of ["quick", "moves"]) {
      const policy = adaptiveRunEntryPolicy({ mode, rank, adaptive: false });
      assert.equal(policy.personal, true);
      assert.equal(policy.relaxedForRank, true);
      assert.equal(policy.mode, "reach");
      assert.equal(policy.pressureUnlocked, false);
    }
  }
  const gold = adaptiveRunEntryPolicy({
    mode: "quick",
    rank: { id: "gold", number: 3 },
    adaptive: false
  });
  assert.equal(gold.personal, false);
  assert.equal(gold.mode, "quick");
  assert.equal(gold.pressureUnlocked, true);

  const customBronze = adaptiveRunEntryPolicy({
    mode: "moves",
    custom: true,
    rank: { id: "bronze", number: 1 }
  });
  assert.equal(customBronze.relaxedForRank, true, "a custom flag cannot bypass the early-rank relaxation");
  assert.equal(customBronze.mode, "reach");

  for (const mode of ["daily", "weekly"]) {
    const fixed = adaptiveRunEntryPolicy({
      mode,
      rank: { id: "bronze", number: 1 },
      adaptive: true
    });
    assert.equal(fixed.personal, false);
    assert.equal(fixed.mode, mode);
  }
});

test("avoidTarget parsing is bounded and canonical without accepting non-strings", () => {
  assert.deepEqual(parseAdaptiveAvoidTarget(undefined), { valid: true, target: "" });
  assert.deepEqual(parseAdaptiveAvoidTarget("  Forest\nPath  "), {
    valid: true,
    target: "Forest Path"
  });
  assert.equal(parseAdaptiveAvoidTarget(42).valid, false);
  assert.equal(parseAdaptiveAvoidTarget("x".repeat(81)).valid, false);
  assert.equal(parseAdaptiveAvoidTarget("x".repeat(80)).valid, true);
});

test("adaptive rewards still scale monotonically with selected challenge level", () => {
  const multipliers = Array.from({ length: ADAPTIVE_LEVEL_MAX }, (_, index) =>
    adaptiveRewardMultiplier(index + ADAPTIVE_LEVEL_MIN)
  );
  assert.deepEqual(multipliers, [0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.25]);
  assert.ok(multipliers.every((value, index) => index === 0 || value > multipliers[index - 1]));
  assert.equal(adaptiveRewardMultiplier(-100), 0.8);
  assert.equal(adaptiveRewardMultiplier(100), 1.25);
});

test("recent targets are bounded, deduplicated, and ordered oldest to newest", () => {
  let state = createAdaptiveDifficultyState();
  for (let index = 0; index < ADAPTIVE_RECENT_TARGET_LIMIT + 4; index += 1) {
    state = rememberAdaptiveTarget(state, `Target ${index}`);
  }
  assert.equal(state.recentTargets.length, ADAPTIVE_RECENT_TARGET_LIMIT);
  assert.equal(state.recentTargets[0], "Target 4");
  assert.equal(state.recentTargets.at(-1), "Target 11");

  state = rememberAdaptiveTarget(state, " target 6 ");
  assert.equal(state.recentTargets.at(-1), "target 6");
  assert.equal(state.recentTargets.filter((target) => target.toLowerCase() === "target 6").length, 1);
});

test("difficulty estimates use authored levels first and route flexibility second", () => {
  assert.equal(estimateAdaptiveChallengeLevel({ difficultyLevel: 8, routeLength: 2 }), 8);
  assert.equal(estimateAdaptiveChallengeLevel({ difficultyScore: 0 }), 1);
  assert.equal(estimateAdaptiveChallengeLevel({ difficultyScore: 1 }), 10);
  assert.equal(estimateAdaptiveChallengeLevel({ routeLength: 7, pathCount: 1 }), 7);
  assert.equal(estimateAdaptiveChallengeLevel({ routeLength: 7, pathCount: 6 }), 6);
});

test("selection uses the milestone level while preserving reachable and recent-target rules", () => {
  const candidates = [
    { target: "Recent", difficultyLevel: 9, reachable: true, pathCount: 5 },
    { target: "Ordinary", difficultyLevel: 6, reachable: true, pathCount: 5 },
    { target: "Milestone", difficultyLevel: 9, reachable: true, pathCount: 3 },
    { target: "Unreachable", difficultyLevel: 9, reachable: false }
  ];
  const state = rememberAdaptiveTarget({
    ...createAdaptiveDifficultyState(6),
    completedChallenges: 10,
    majorChallengePending: true,
    majorChallengeBaseLevel: 6
  }, "Recent");
  const result = selectAdaptiveChallenge({
    state,
    candidates,
    context: { mode: "reach", seed: 42 }
  });
  assert.equal(result.selected, candidates[2]);
  assert.equal(result.metadata.baseLevel, 6);
  assert.equal(result.metadata.requestedLevel, 9);
  assert.equal(result.metadata.candidateLevel, 9);
  assert.equal(result.metadata.majorChallenge, true);
  assert.equal(result.metadata.majorChallengeBonus, 3);
  assert.equal(result.metadata.avoidedRecent, true);
  assert.match(result.message, /Surge challenge/i);
  assert.equal(result.state.recentTargets.at(-1), "Milestone");
});

test("normal selection prefers flexible ties and stays deterministic by seed", () => {
  const flexibleCandidates = [
    { target: "Brittle", difficultyLevel: 5, reachable: true, pathCount: 1 },
    { target: "Flexible", difficultyLevel: 5, reachable: true, pathCount: 4 }
  ];
  const flexible = selectAdaptiveChallenge({
    state: createAdaptiveDifficultyState(5),
    candidates: flexibleCandidates,
    context: { mode: "reach" }
  });
  assert.equal(flexible.selected, flexibleCandidates[1]);

  const tied = ["Moon", "Forest", "Ocean", "Phoenix"].map((target) => ({
    target,
    difficultyLevel: 5,
    reachable: true,
    pathCount: 3
  }));
  const targetFor = (seed) => selectAdaptiveChallenge({
    state: createAdaptiveDifficultyState(5),
    candidates: tied,
    context: { mode: "reach", seed }
  }).selected.target;
  assert.equal(targetFor(2718), targetFor(2718));
  assert.ok(new Set(Array.from({ length: 32 }, (_, seed) => targetFor(seed))).size > 1);
});

test("failure recovery excludes the failed target and chooses a strictly lower level first", () => {
  const failed = { target: "Forest", difficultyLevel: 5, reachable: true, pathCount: 4 };
  const same = { target: "Ocean", difficultyLevel: 5, reachable: true, pathCount: 8 };
  const easier = { target: "Moon", difficultyLevel: 4, reachable: true, pathCount: 2 };
  const result = selectAdaptiveChallenge({
    state: {
      ...createAdaptiveDifficultyState(5),
      failureStreak: 1,
      recentTargets: ["Forest"]
    },
    candidates: [failed, same, easier],
    context: { mode: "reach", seed: 17, avoidTarget: "  fOrEsT " }
  });

  assert.equal(result.selected, easier);
  assert.equal(result.metadata.candidateLevel, 4);
  assert.equal(result.metadata.avoidedTarget, true);
  assert.equal(result.metadata.easedAfterFailure, true);
  assert.equal(result.metadata.reason, "gentler_recovery_target");
  assert.equal(result.state.recentTargets.at(-1), "Moon");

  const unavailable = selectAdaptiveChallenge({
    state: createAdaptiveDifficultyState(5),
    candidates: [failed],
    context: { mode: "reach", avoidTarget: "FOREST" }
  });
  assert.equal(unavailable.selected, null);
  assert.equal(unavailable.metadata.reason, "no_alternative_reachable_target");
});

test("recovery compares against the failed challenge itself, not only the requested level", () => {
  const failedOutcome = applyAdaptiveChallengeOutcome(createAdaptiveDifficultyState(5), {
    mode: "reach",
    outcome: "failed",
    challengeLevel: 3
  });
  assert.equal(failedOutcome.state.level, 4);
  assert.equal(failedOutcome.state.recoveryLevel, 3);
  assert.equal(failedOutcome.state.recoveryStrict, true);
  const recoveryState = rememberAdaptiveTarget(
    failedOutcome.state,
    "Forest",
    { preserveRecovery: true }
  );
  const lower = { target: "Mud", difficultyLevel: 2, reachable: true };
  const equal = { target: "Moon", difficultyLevel: 3, reachable: true };
  const result = selectAdaptiveChallenge({
    state: recoveryState,
    candidates: [
      { target: "Forest", difficultyLevel: 3, reachable: true },
      equal,
      lower
    ],
    context: { mode: "reach", avoidTarget: "Forest" }
  });
  assert.equal(result.selected, lower);
  assert.equal(result.metadata.easedAfterFailure, true);
  assert.equal(result.state.recoveryLevel, null, "allocating the replacement consumes the recovery baseline");
});

test("a failed Surge returns to a different challenge at the protected base level", () => {
  const surgeOutcome = applyAdaptiveChallengeOutcome({
    ...createAdaptiveDifficultyState(6),
    majorChallengePending: true,
    majorChallengeBaseLevel: 6
  }, {
    mode: "reach",
    outcome: "failed",
    surge: true,
    surgeBaseLevel: 6,
    challengeLevel: 9
  });
  assert.equal(surgeOutcome.state.level, 6);
  assert.equal(surgeOutcome.state.recoveryLevel, 6);
  assert.equal(surgeOutcome.state.recoveryStrict, false);
  const recoveryState = rememberAdaptiveTarget(
    surgeOutcome.state,
    "Galaxy",
    { preserveRecovery: true }
  );
  const protectedBase = { target: "Forest", difficultyLevel: 6, reachable: true };
  const tooEasy = { target: "Mud", difficultyLevel: 5, reachable: true };
  const result = selectAdaptiveChallenge({
    state: recoveryState,
    candidates: [
      { target: "Galaxy", difficultyLevel: 9, reachable: true },
      protectedBase,
      tooEasy
    ],
    context: { mode: "reach", avoidTarget: "Galaxy" }
  });
  assert.equal(result.selected, protectedBase);
  assert.equal(result.metadata.easedAfterFailure, false);
});

test("selection falls back to recent candidates only when all are recent", () => {
  const candidates = [
    { target: "Moon", difficultyLevel: 4, reachable: true, pathCount: 3 },
    { target: "Forest", difficultyLevel: 5, reachable: true, pathCount: 2 }
  ];
  let state = rememberAdaptiveTarget(createAdaptiveDifficultyState(4), "Moon");
  const fresh = selectAdaptiveChallenge({ state, candidates, context: { mode: "reach" } });
  assert.equal(fresh.selected, candidates[1]);
  assert.equal(fresh.metadata.avoidedRecent, true);

  state = rememberAdaptiveTarget(state, "Forest");
  const fallback = selectAdaptiveChallenge({ state, candidates, context: { mode: "reach" } });
  assert.equal(fallback.selected, candidates[0]);
  assert.equal(fallback.metadata.avoidedRecent, false);
});

test("excluded modes and catalogs without verified reachable candidates select nothing", () => {
  const candidate = { target: "Moon", difficultyLevel: 4, reachable: true };
  const fixed = selectAdaptiveChallenge({
    state: createAdaptiveDifficultyState(),
    candidates: [candidate],
    context: { mode: "daily" }
  });
  assert.equal(fixed.selected, null);
  assert.equal(fixed.metadata.policy.fairness.decision, "fixed_challenge_rules_are_unchanged");

  const unavailable = selectAdaptiveChallenge({
    state: createAdaptiveDifficultyState(),
    candidates: [{ target: "Invented", difficultyLevel: 4, reachable: false }],
    context: { mode: "reach" }
  });
  assert.equal(unavailable.selected, null);
  assert.equal(unavailable.metadata.reason, "no_reachable_candidates");
});
