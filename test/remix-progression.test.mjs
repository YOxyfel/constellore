import assert from "node:assert/strict";
import test from "node:test";

import {
  REMIX_FAMILIES,
  REMIX_MASTERY_THRESHOLDS,
  REMIX_PROGRESSION_VERSION,
  REMIX_RANK_COUNT,
  REMIX_RANKS,
  PROMOTION_TRIAL_LENGTH,
  PROMOTION_WINS_REQUIRED,
  createRemixProgressionState,
  getRemixRank,
  getRemixMasteryProgress,
  getRemixRankPresentation,
  getPromotionEligibility,
  masteryAwardForOutcome,
  masteryRequiredForRank,
  recordRemixProgressionOutcome,
  recordRemixPromotionTrialOutcome,
  remixFamiliesAreCompatible,
  remixRankFromCompletedChallenges,
  remixRankFromMasteryPoints,
  sanitizeRemixProgressionState,
  selectChallengeRemixes,
  startRemixPromotionTrial
} from "../public/remix-progression.mjs";

test("the progression has twelve permanent ranks with the requested early curve", () => {
  assert.equal(REMIX_PROGRESSION_VERSION, 2);
  assert.equal(REMIX_RANK_COUNT, 12);
  assert.equal(REMIX_RANKS.length, 12);
  assert.deepEqual(
    REMIX_RANKS.map((rank) => rank.name),
    [
      "Bronze",
      "Silver",
      "Gold",
      "Diamond",
      "Emerald",
      "Sapphire",
      "Ruby",
      "Master",
      "Grandmaster",
      "Mythic",
      "Legend",
      "Cosmic"
    ]
  );
  assert.deepEqual(
    REMIX_RANKS.map((rank) => rank.masteryPoints),
    [0, 50, 200, 550, 1_100, 1_900, 3_000, 4_500, 6_500, 9_000, 12_500, 17_000]
  );
  assert.deepEqual(
    REMIX_MASTERY_THRESHOLDS,
    REMIX_RANKS.map((rank) => rank.masteryPoints)
  );
  assert.equal(PROMOTION_TRIAL_LENGTH, 3);
  assert.equal(PROMOTION_WINS_REQUIRED, 2);
  assert.deepEqual(
    REMIX_RANKS.map((rank) => [
      rank.minimumRemixes,
      rank.maximumRemixes
    ]),
    [
      [0, 0],
      [0, 0],
      [1, 1],
      [1, 2],
      [2, 2],
      [2, 3],
      [3, 3],
      [3, 4],
      [4, 4],
      [4, 5],
      [5, 5],
      [5, 5]
    ]
  );
});

test("rank milestones use completed challenges and clamp untrusted values", () => {
  assert.equal(remixRankFromCompletedChallenges(-50).id, "bronze");
  assert.equal(remixRankFromCompletedChallenges(0).id, "bronze");
  assert.equal(remixRankFromCompletedChallenges(2).id, "bronze");
  assert.equal(remixRankFromCompletedChallenges(3).id, "silver");
  assert.equal(remixRankFromCompletedChallenges(7).id, "silver");
  assert.equal(remixRankFromCompletedChallenges(8).id, "gold");
  assert.equal(remixRankFromCompletedChallenges(24).id, "diamond");
  assert.equal(remixRankFromCompletedChallenges(25).id, "emerald");
  assert.equal(remixRankFromCompletedChallenges(239).id, "legend");
  assert.equal(remixRankFromCompletedChallenges(240).id, "cosmic");
  assert.equal(remixRankFromCompletedChallenges(999_999).id, "cosmic");
});

test("mastery thresholds are deliberately long and clamp untrusted values", () => {
  assert.equal(remixRankFromMasteryPoints(-500).id, "bronze");
  assert.equal(remixRankFromMasteryPoints(49).id, "bronze");
  assert.equal(remixRankFromMasteryPoints(50).id, "silver");
  assert.equal(remixRankFromMasteryPoints(199).id, "silver");
  assert.equal(remixRankFromMasteryPoints(200).id, "gold");
  assert.equal(remixRankFromMasteryPoints(16_999).id, "legend");
  assert.equal(remixRankFromMasteryPoints(17_000).id, "cosmic");
  assert.equal(remixRankFromMasteryPoints(Number.POSITIVE_INFINITY).id, "bronze");
  assert.equal(masteryRequiredForRank("master"), 4_500);
});

test("explicit rank lookup accepts plain names, IDs, and one-based numbers", () => {
  assert.equal(getRemixRank("Gold").id, "gold");
  assert.equal(getRemixRank("grandmaster").number, 9);
  assert.equal(getRemixRank(4).id, "diamond");
  assert.equal(getRemixRank("12").id, "cosmic");
  assert.equal(getRemixRank({ rankId: "ruby" }).id, "ruby");
  assert.equal(getRemixRank({ masteryPoints: 3_000 }).id, "ruby");
  assert.equal(getRemixRank({ completedChallenges: 60 }).id, "ruby");
  assert.equal(getRemixRank("not-a-rank").id, "bronze");
});

test("state sanitation is allowlist-only and cross-field rank claims are bounded", () => {
  assert.deepEqual(createRemixProgressionState(), {
    version: 2,
    masteryPoints: 0,
    completedChallenges: 0,
    failedChallenges: 0,
    currentWinStreak: 0,
    rankId: "bronze",
    promotionTrial: null
  });
  assert.deepEqual(sanitizeRemixProgressionState({
    version: 2,
    masteryPoints: 199.6,
    completedChallenges: 24.6,
    failedChallenges: -3,
    currentWinStreak: 4.4,
    rankId: "cosmic",
    promotionTrial: {
      targetRankId: "cosmic",
      attempts: 99,
      wins: 99
    },
    email: "do-not-store@example.com",
    rawAttempts: ["secret"]
  }), {
    version: 2,
    masteryPoints: 200,
    completedChallenges: 25,
    failedChallenges: 0,
    currentWinStreak: 4,
    rankId: "gold",
    promotionTrial: null
  });
  assert.deepEqual(sanitizeRemixProgressionState(null), createRemixProgressionState());
});

test("legacy completion progress preserves its old permanent rank on migration", () => {
  const migrated = sanitizeRemixProgressionState({
    version: 1,
    completedChallenges: 85,
    failedChallenges: 4,
    currentWinStreak: 2
  });
  assert.equal(migrated.rankId, "master");
  assert.equal(migrated.masteryPoints, 4_500);
  assert.equal(migrated.completedChallenges, 85);
  assert.equal(migrated.failedChallenges, 4);

  const constructed = createRemixProgressionState(7);
  assert.equal(constructed.rankId, "silver");
  assert.equal(constructed.masteryPoints, 50);
  assert.equal(constructed.completedChallenges, 7);
});

test("families unlock progressively and future mechanics stay hidden", () => {
  assert.deepEqual(getRemixRankPresentation("bronze").unlockedFamilies, []);
  assert.deepEqual(getRemixRankPresentation("silver").unlockedFamilies, []);
  assert.deepEqual(getRemixRankPresentation("gold").unlockedFamilies, [
    "required_waypoint"
  ]);
  assert.deepEqual(getRemixRankPresentation("diamond").unlockedFamilies, [
    "required_waypoint",
    "forbidden_shortcut"
  ]);
  assert.deepEqual(getRemixRankPresentation("emerald").unlockedFamilies, [
    "required_waypoint",
    "forbidden_shortcut",
    "master_route"
  ]);
  assert.equal(
    getRemixRankPresentation("sapphire").unlockedFamilies.includes("graph_safe_rule"),
    true
  );
  assert.equal(
    getRemixRankPresentation("ruby").unlockedFamilies.includes("orbit_chain"),
    false
  );
  assert.equal(
    getRemixRankPresentation("master").unlockedFamilies.includes("orbit_chain"),
    true
  );
  assert.equal(REMIX_FAMILIES.length, 5);
});

test("rank presentation stays short and gives the next milestone", () => {
  const diamond = getRemixRankPresentation({ completedChallenges: 15 });
  assert.equal(diamond.summary, "Diamond: 1\u20132 remixes per challenge");
  assert.equal(diamond.remixRange, "1\u20132 remixes");
  assert.deepEqual(diamond.nextRank, {
    id: "emerald",
    name: "Emerald",
    masteryPoints: 1_100,
    completedChallenges: 25
  });
  assert.equal(getRemixRankPresentation("cosmic").nextRank, null);
  assert.ok(diamond.summary.length < 60);
});

test("mastery progress fills a meter without changing permanent rank", () => {
  const state = createRemixProgressionState({
    masteryPoints: 400,
    completedChallenges: 12,
    rankId: "gold"
  });
  const progress = getRemixMasteryProgress(state);
  assert.equal(progress.rank.id, "gold");
  assert.equal(progress.nextRank.id, "diamond");
  assert.equal(progress.rankFloor, 200);
  assert.equal(progress.nextThreshold, 550);
  assert.equal(progress.pointsIntoRank, 200);
  assert.equal(progress.pointsRequired, 350);
  assert.equal(progress.pointsRemaining, 150);
  assert.equal(progress.thresholdReached, false);
  assert.equal(progress.fraction, 200 / 350);

  const waiting = getRemixMasteryProgress({
    ...state,
    masteryPoints: 800
  });
  assert.equal(waiting.rank.id, "gold");
  assert.equal(waiting.fraction, 1);
  assert.equal(waiting.thresholdReached, true);
});

test("Bronze and Silver always select classic play while Gold selects one waypoint", () => {
  for (const rank of ["bronze", "silver"]) {
    const selection = selectChallengeRemixes({ rank, seed: 44 });
    assert.equal(selection.activeCount, 0);
    assert.deepEqual(selection.modifierIds, []);
    assert.equal(selection.summary, "Classic challenge");
    assert.equal(selection.instruction, "Reach the target.");
  }

  const gold = selectChallengeRemixes({ rank: "gold", seed: 44 });
  assert.equal(gold.requestedCount, 1);
  assert.equal(gold.activeCount, 1);
  assert.deepEqual(gold.modifierIds, ["required_waypoint"]);
  assert.match(gold.instruction, /required word/i);
});

test("Diamond deterministically chooses one or two already-unlocked families", () => {
  const first = selectChallengeRemixes({ rank: "diamond", seed: "player-42" });
  const repeat = selectChallengeRemixes({ rank: "diamond", seed: "player-42" });
  assert.deepEqual(repeat, first);
  assert.ok(first.activeCount >= 1 && first.activeCount <= 2);
  assert.ok(first.modifierIds.every((id) => [
    "required_waypoint",
    "forbidden_shortcut",
    "master_route"
  ].includes(id)));

  const counts = new Set(
    Array.from({ length: 100 }, (_, seed) =>
      selectChallengeRemixes({ rank: "diamond", seed }).activeCount
    )
  );
  assert.deepEqual([...counts].sort(), [1, 2]);
});

test("selection can derive rank from state or completed challenges", () => {
  const fromState = selectChallengeRemixes({
    state: { completedChallenges: 8 },
    seed: 7
  });
  const fromCount = selectChallengeRemixes({
    completedChallenges: 8,
    seed: 7
  });
  assert.equal(fromState.rank.id, "gold");
  assert.deepEqual(fromState, fromCount);

  const explicitWins = selectChallengeRemixes({
    rank: "silver",
    completedChallenges: 999,
    seed: 7
  });
  assert.equal(explicitWins.rank.id, "silver");
  assert.equal(explicitWins.activeCount, 0);

  const waitingForPromotion = selectChallengeRemixes({
    state: {
      version: 2,
      masteryPoints: 17_000,
      completedChallenges: 500,
      rankId: "silver",
      failedChallenges: 0,
      currentWinStreak: 8,
      promotionTrial: null
    },
    seed: 7
  });
  assert.equal(waitingForPromotion.rank.id, "silver");
  assert.equal(waitingForPromotion.activeCount, 0);
});

test("target capabilities remove unsupported families without requesting locked content", () => {
  const selection = selectChallengeRemixes({
    rank: "cosmic",
    seed: 15,
    availableFamilies: [
      "required_waypoint",
      "forbidden_shortcut",
      "orbit_chain",
      "not_real"
    ],
    capabilities: {
      requiredWaypoint: true,
      forbiddenShortcut: false,
      orbitChain: { available: false }
    }
  });
  assert.equal(selection.requestedCount, 1);
  assert.equal(selection.activeCount, 1);
  assert.deepEqual(selection.modifierIds, ["required_waypoint"]);
  assert.equal(selection.reducedForCompatibility, false);
});

test("challenge-specific incompatibilities are symmetric and never make an invalid set", () => {
  const incompatiblePairs = [
    ["required_waypoint", "master_route"],
    "forbidden_shortcut|graph_safe_rule"
  ];
  assert.equal(
    remixFamiliesAreCompatible("required_waypoint", "master_route", {
      incompatiblePairs
    }),
    false
  );
  assert.equal(
    remixFamiliesAreCompatible("master_route", "required_waypoint", {
      incompatiblePairs
    }),
    false
  );
  assert.equal(
    remixFamiliesAreCompatible("required_waypoint", "orbit_chain", {
      incompatiblePairs
    }),
    true
  );
  assert.equal(remixFamiliesAreCompatible("missing", "orbit_chain"), false);
  assert.equal(remixFamiliesAreCompatible("orbit_chain", "orbit_chain"), false);

  for (let seed = 0; seed < 100; seed += 1) {
    const selection = selectChallengeRemixes({
      rank: "cosmic",
      seed,
      incompatiblePairs
    });
    for (let first = 0; first < selection.modifierIds.length; first += 1) {
      for (let second = first + 1; second < selection.modifierIds.length; second += 1) {
        assert.equal(
          remixFamiliesAreCompatible(
            selection.modifierIds[first],
            selection.modifierIds[second],
            { incompatiblePairs }
          ),
          true
        );
      }
    }
  }
});

test("selection steps down when no compatible set can meet the requested count", () => {
  const allPairs = [];
  for (let first = 0; first < REMIX_FAMILIES.length; first += 1) {
    for (let second = first + 1; second < REMIX_FAMILIES.length; second += 1) {
      allPairs.push([REMIX_FAMILIES[first].id, REMIX_FAMILIES[second].id]);
    }
  }

  let selection = null;
  for (let seed = 0; seed < 200; seed += 1) {
    const candidate = selectChallengeRemixes({
      rank: "cosmic",
      seed,
      incompatiblePairs: allPairs
    });
    if (candidate.requestedCount > 1) {
      selection = candidate;
      break;
    }
  }
  assert.ok(selection, "the seed set should include a multi-remix request");
  assert.equal(selection.activeCount, 1);
  assert.equal(selection.reducedForCompatibility, true);
});

test("Cosmic can use all five families when its seeded count reaches five", () => {
  let selection = null;
  for (let seed = 0; seed < 500; seed += 1) {
    const candidate = selectChallengeRemixes({ rank: "cosmic", seed });
    if (candidate.activeCount === 5) {
      selection = candidate;
      break;
    }
  }
  assert.ok(selection, "at least one deterministic seed should choose five");
  assert.deepEqual(
    [...selection.modifierIds].sort(),
    REMIX_FAMILIES.map((family) => family.id).sort()
  );
  assert.equal(selection.reducedForCompatibility, false);
});

test("mastery awards stay within 5–25 and reward clean difficult play", () => {
  assert.equal(masteryAwardForOutcome({ outcome: "failed" }), 0);
  assert.equal(masteryAwardForOutcome({
    outcome: "completed",
    revealed: true,
    flawless: true,
    activeRemixes: 5
  }), 0);
  assert.equal(masteryAwardForOutcome({
    outcome: "completed",
    assisted: true
  }), 0);
  assert.equal(masteryAwardForOutcome({
    outcome: "completed",
    usedMajorPowerup: true
  }), 0);
  assert.equal(masteryAwardForOutcome({
    outcome: "completed",
    usedPaidHelp: true
  }), 0);
  assert.equal(masteryAwardForOutcome({ outcome: "completed" }), 10);
  assert.equal(masteryAwardForOutcome({
    outcome: "completed",
    clean: true,
    activeRemixes: 3
  }), 18);
  assert.equal(masteryAwardForOutcome({
    outcome: "completed",
    flawless: true,
    activeRemixes: 5
  }), 25);
  assert.equal(masteryAwardForOutcome({
    outcome: "completed",
    flawless: true,
    activeRemixes: 999
  }), 25);
});

test("completed outcomes earn mastery but cannot auto-promote permanent rank", () => {
  const before = createRemixProgressionState({
    masteryPoints: 190,
    completedChallenges: 7,
    failedChallenges: 2,
    currentWinStreak: 3,
    rankId: "silver"
  });
  const completed = recordRemixProgressionOutcome({
    ...before,
    failedChallenges: 2,
    currentWinStreak: 3
  }, {
    outcome: "completed",
    clean: true,
    activeRemixes: 2
  });
  assert.equal(completed.masteryAward, 17);
  assert.equal(completed.state.masteryPoints, 207);
  assert.equal(completed.state.completedChallenges, 8);
  assert.equal(completed.state.failedChallenges, 2);
  assert.equal(completed.state.currentWinStreak, 4);
  assert.equal(completed.rankBefore.id, "silver");
  assert.equal(completed.rankAfter.id, "silver");
  assert.equal(completed.rankUp, false);
  assert.equal(completed.promotionUnlocked, true);
  assert.equal(completed.promotion.nextRank.id, "gold");
  assert.match(completed.message, /promotion ready/i);

  const failed = recordRemixProgressionOutcome(completed.state, {
    outcome: "failed"
  });
  assert.equal(failed.masteryAward, 0);
  assert.equal(failed.state.masteryPoints, 207);
  assert.equal(failed.state.completedChallenges, 8);
  assert.equal(failed.state.failedChallenges, 3);
  assert.equal(failed.state.currentWinStreak, 0);
  assert.equal(failed.rankAfter.id, "silver");
  assert.equal(failed.rankUp, false);
  assert.match(failed.message, /Rank kept/i);
});

test("promotion requires the meter and resolves only after all three trials", () => {
  const waiting = createRemixProgressionState({
    masteryPoints: 199,
    completedChallenges: 20,
    rankId: "silver"
  });
  assert.deepEqual(
    {
      eligible: getPromotionEligibility(waiting).eligible,
      remaining: getPromotionEligibility(waiting).masteryRemaining,
      status: getPromotionEligibility(waiting).status
    },
    { eligible: false, remaining: 1, status: "mastery_needed" }
  );
  const denied = startRemixPromotionTrial(waiting);
  assert.equal(denied.started, false);
  assert.equal(denied.reason, "mastery_needed");

  const ready = { ...waiting, masteryPoints: 200 };
  const started = startRemixPromotionTrial(ready);
  assert.equal(started.started, true);
  assert.equal(started.state.rankId, "silver");
  assert.deepEqual(started.state.promotionTrial, {
    targetRankId: "gold",
    attempts: 0,
    wins: 0,
    flawlessWins: 0
  });
  assert.equal(getPromotionEligibility(started.state).status, "active");

  const first = recordRemixPromotionTrialOutcome(started.state, {
    outcome: "completed"
  });
  assert.equal(first.active, true);
  assert.equal(first.promoted, false);
  assert.equal(first.state.promotionTrial.attempts, 1);
  assert.equal(first.state.promotionTrial.wins, 1);

  const second = recordRemixPromotionTrialOutcome(first.state, {
    outcome: "failed"
  });
  assert.equal(second.active, true);
  assert.equal(second.promoted, false);
  assert.equal(second.state.promotionTrial.attempts, 2);

  const third = recordRemixPromotionTrialOutcome(second.state, {
    outcome: "completed",
    flawless: true
  });
  assert.equal(third.active, false);
  assert.equal(third.passed, true);
  assert.equal(third.promoted, true);
  assert.equal(third.state.rankId, "gold");
  assert.equal(third.state.promotionTrial, null);
  assert.equal(third.bonusMastery, 0);
});

test("flawless promotion gives a 25% head start and failed promotion retains 80%", () => {
  const base = createRemixProgressionState({
    masteryPoints: 200,
    completedChallenges: 20,
    rankId: "silver"
  });
  let flawless = startRemixPromotionTrial(base).state;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    flawless = recordRemixPromotionTrialOutcome(flawless, {
      outcome: "completed",
      flawless: true
    }).state;
  }
  assert.equal(flawless.rankId, "gold");
  assert.equal(flawless.masteryPoints, 287);

  let failed = startRemixPromotionTrial(base).state;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    failed = recordRemixPromotionTrialOutcome(failed, {
      outcome: attempt === 0 ? "completed" : "failed"
    }).state;
  }
  assert.equal(failed.rankId, "silver");
  assert.equal(failed.masteryPoints, 170);
  assert.equal(failed.promotionTrial, null);
  assert.equal(getPromotionEligibility(failed).eligible, false);
});

test("pair misses and hints are not challenge outcomes", () => {
  const state = {
    ...createRemixProgressionState(25),
    failedChallenges: 4,
    currentWinStreak: 2
  };
  for (const outcome of [
    "invalid_pair",
    "incorrect_pair",
    "combination_missing",
    "rejected_pair",
    "missed_pair",
    "hint",
    "unknown"
  ]) {
    const result = recordRemixProgressionOutcome(state, { outcome });
    assert.deepEqual(result.state, state, outcome);
    assert.equal(result.changed, false);
    assert.equal(result.outcome, "ignored");
    assert.equal(result.message, "");
  }
});
