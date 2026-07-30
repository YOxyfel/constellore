import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PERSONAL_CIRCUIT_RECORDS,
  MAX_WEEKLY_CREDITED_RUNS,
  WEEKLY_CIRCUIT_OBJECTIVES,
  circuitDailyRotation,
  circuitWeeklyRewardById,
  circuitWeeklyChallenges,
  claimCircuitWeeklyReward,
  personalCircuitRecordBoard,
  recordCircuitWeeklyProgress,
  recordPersonalCircuitResult,
  sanitizeCircuitWeeklyState,
  sanitizePersonalCircuitBoard
} from "../public/circuit-live-ops.mjs";
import {
  advanceCircuitRun,
  cosmosCircuitCourse,
  cosmosCircuitCrazyCourse,
  finishCircuitRun,
  startCircuitRun
} from "../public/cosmos-circuit.mjs";

const TEST_DAY = "2026-07-27";
const TEST_AT = "2026-07-27T12:00:00.000Z";

function buildRun({
  dayKey = TEST_DAY,
  id = "flight-one",
  mode = "practice",
  outcome = "perfect",
  stepMs = 5_000,
  segments
} = {}) {
  const course = cosmosCircuitCourse(dayKey);
  const started = startCircuitRun({
    course,
    mode,
    wallet: { passes: 1 },
    runId: id,
    at: course.startsAt
  });
  assert.equal(started.started, true);
  let run = started.run;
  const count = segments ?? course.segments.length;
  for (const segment of course.segments.slice(0, count)) {
    const advanced = advanceCircuitRun(run, {
      segmentId: segment.id,
      outcome,
      stardust: segment.stardust,
      ability: "",
      elapsedMs: (segment.index + 1) * stepMs
    });
    assert.equal(advanced.advanced, true);
    run = advanced.run;
  }
  if (run.status !== "finished") {
    const finished = finishCircuitRun(run, {
      reason: "crash",
      elapsedMs: count * stepMs
    });
    assert.equal(finished.finished, true);
    run = finished.run;
  }
  return run;
}

function buildCrazyRun(id = "crazy-flight-one") {
  const course = cosmosCircuitCrazyCourse(TEST_DAY);
  const started = startCircuitRun({
    course,
    mode: "ticketed",
    path: "crazy",
    wallet: { passes: 3 },
    claims: { cosmosWeekKeys: [course.weekKey] },
    runId: id,
    at: TEST_AT
  });
  assert.equal(started.started, true);
  let run = started.run;
  for (const segment of course.segments) {
    const advanced = advanceCircuitRun(run, {
      segmentId: segment.id,
      outcome: "perfect",
      stardust: segment.stardust,
      ability: "",
      elapsedMs: (segment.index + 1) * 4_500
    });
    assert.equal(advanced.advanced, true);
    run = advanced.run;
  }
  return run;
}

test("daily rotation metadata and countdown follow exact UTC boundaries", () => {
  const late = circuitDailyRotation("2026-07-27T23:59:30.000Z");
  const equivalentOffset = circuitDailyRotation("2026-07-28T02:59:30.000+03:00");
  assert.deepEqual(equivalentOffset, late);
  assert.equal(late.courseId, "cosmos-2026-07-27");
  assert.equal(late.dayKey, "2026-07-27");
  assert.equal(late.endsAt, "2026-07-28T00:00:00.000Z");
  assert.equal(late.nextCourseId, "cosmos-2026-07-28");
  assert.deepEqual(late.countdown, {
    remainingMs: 30_000,
    remainingSeconds: 30,
    label: "00:00:30"
  });

  const midnight = circuitDailyRotation("2026-07-28T00:00:00.000Z");
  assert.equal(midnight.courseId, "cosmos-2026-07-28");
  assert.equal(midnight.countdown.remainingMs, 86_400_000);
  assert.equal(midnight.countdown.label, "24:00:00");
  assert.deepEqual(circuitDailyRotation(TEST_AT), circuitDailyRotation(TEST_AT));
});

test("each week has three deterministic fair objectives and exact cosmetic rewards", () => {
  const weekly = circuitWeeklyChallenges(TEST_AT);
  assert.deepEqual(circuitWeeklyChallenges(TEST_AT), weekly);
  assert.equal(weekly.objectives.length, WEEKLY_CIRCUIT_OBJECTIVES);
  assert.deepEqual(weekly.fairness, {
    deterministic: true,
    practiceCounts: true,
    cosmeticOnlyRewards: true,
    randomRewards: false,
    grantsPasses: false,
    grantsBoosts: false,
    grantsCurrency: false,
    gameplayAdvantage: false
  });

  const ids = new Set();
  const rewardKinds = new Set();
  const forbidden = /pass|ticket|boost|power.?up|currency|credit|multiplier|random|loot/i;
  for (const objective of weekly.objectives) {
    assert.equal(objective.practiceCounts, true);
    assert.equal(objective.authoritativeMetricsOnly, true);
    assert.ok(objective.label && objective.description);
    assert.ok(objective.target > 0);
    assert.ok(["sum", "max"].includes(objective.aggregation));
    assert.equal(ids.has(objective.id), false);
    ids.add(objective.id);
    const reward = objective.reward;
    rewardKinds.add(reward.kind);
    assert.equal(reward.quantity, 1);
    assert.equal(reward.access, "everyone");
    assert.equal(reward.exact, true);
    assert.equal(reward.randomized, false);
    assert.equal(reward.cosmeticOnly, true);
    assert.equal(reward.gameplayEffect, "none");
    assert.equal(forbidden.test(`${reward.id} ${reward.label} ${reward.kind}`), false);
  }
  assert.deepEqual([...rewardKinds], ["profileBadge", "shipDecal", "ostRemix"]);

  weekly.objectives[0].target = 1;
  weekly.objectives[0].reward.kind = "powerup";
  const clean = circuitWeeklyChallenges(TEST_AT);
  assert.notEqual(clean.objectives[0].target, 1);
  assert.equal(clean.objectives[0].reward.kind, "profileBadge");
});

test("all authored weekly objectives are cumulative and avoid expert-only gates", () => {
  const start = Date.parse("2026-07-06T12:00:00.000Z");
  for (let week = 0; week < 5; week += 1) {
    const weekly = circuitWeeklyChallenges(new Date(start + week * 7 * 86_400_000));
    for (const objective of weekly.objectives) {
      assert.equal(objective.aggregation, "sum");
      assert.notEqual(objective.metric, "cosmosComplete");
      if (objective.metric === "stardustPercent") {
        assert.ok(objective.target <= 120);
        assert.equal(objective.unit, "points");
      }
    }
  }
});

test("Crazy Path never advances weekly objectives or personal records", () => {
  const run = buildCrazyRun();
  const weekly = recordCircuitWeeklyProgress({}, run, {
    verified: true,
    at: TEST_AT
  });
  assert.equal(weekly.recorded, false);
  assert.equal(weekly.advanced, false);
  assert.equal(weekly.reason, "crazy_path_excluded");
  assert.deepEqual(weekly.state.creditedRunIds, []);
  assert.ok(Object.values(weekly.state.progress).every((value) => value === 0));

  const personal = recordPersonalCircuitResult({}, run, { verified: true });
  assert.equal(personal.recorded, false);
  assert.equal(personal.reason, "crazy_path_excluded");
  assert.deepEqual(personal.board.records, []);
});

test("weekly reward resolver round-trips only exact authored ISO-week rewards", () => {
  const reward = circuitWeeklyChallenges(TEST_AT).objectives[0].reward;
  assert.deepEqual(circuitWeeklyRewardById(reward.id), reward);
  assert.equal(circuitWeeklyRewardById(reward.id.replace("weekly-navigator", "invented")), null);
  assert.equal(circuitWeeklyRewardById(reward.id.replace("2026-w31", "2026-w99")), null);
});

test("weekly state is bounded, allowlisted, and resets at the next UTC week", () => {
  const weekly = circuitWeeklyChallenges(TEST_AT);
  const hostileProgress = Object.fromEntries(weekly.objectives.map((objective) => [objective.id, 999_999]));
  hostileProgress.injected = 999;
  const clean = sanitizeCircuitWeeklyState({
    weekKey: weekly.weekKey,
    progress: hostileProgress,
    creditedRunIds: [
      "repeat",
      "REPEAT",
      "<script>",
      ...Array.from({ length: MAX_WEEKLY_CREDITED_RUNS + 20 }, (_, index) => `flight-${index}`)
    ],
    claimed: [...weekly.objectives.map((objective) => objective.id), "injected"],
    playerName: "Do not retain",
    passes: 999
  }, TEST_AT);

  assert.deepEqual(Object.keys(clean), [
    "version",
    "weekKey",
    "creditedRunIds",
    "progress",
    "claimedObjectiveIds"
  ]);
  assert.equal(clean.creditedRunIds.length <= MAX_WEEKLY_CREDITED_RUNS, true);
  assert.equal(new Set(clean.creditedRunIds).size, clean.creditedRunIds.length);
  assert.deepEqual(Object.keys(clean.progress), weekly.objectives.map((objective) => objective.id));
  for (const objective of weekly.objectives) assert.equal(clean.progress[objective.id], objective.target);
  assert.deepEqual(clean.claimedObjectiveIds, weekly.objectives.map((objective) => objective.id));
  assert.equal("playerName" in clean, false);
  assert.equal("passes" in clean, false);

  const next = sanitizeCircuitWeeklyState(clean, "2026-08-03T00:00:00.000Z");
  assert.notEqual(next.weekKey, clean.weekKey);
  assert.deepEqual(next.creditedRunIds, []);
  assert.deepEqual(next.claimedObjectiveIds, []);
  assert.ok(Object.values(next.progress).every((value) => value === 0));
});

test("verified canonical run metrics advance weekly progress once and ignore forged metrics", () => {
  const partial = buildRun({ id: "partial-five", segments: 5 });
  const forged = {
    ...partial,
    metrics: {
      completedCourse: true,
      planetGatesPassed: 999,
      perfectSlingshots: 999,
      sectorsCleared: 999,
      stardustPercent: 999,
      maxFlow: 999,
      blackHolesCleared: 999,
      shieldIntact: true,
      cosmosComplete: true
    }
  };
  const unverified = recordCircuitWeeklyProgress({}, forged, { verified: false, at: TEST_AT });
  assert.equal(unverified.reason, "verification_required");
  assert.ok(Object.values(unverified.state.progress).every((value) => value === 0));

  const first = recordCircuitWeeklyProgress({}, forged, { verified: true, at: TEST_AT });
  assert.equal(first.recorded, true);
  assert.equal(first.mode, "practice");
  assert.ok(first.updates.every((update) => update.after <= circuitWeeklyChallenges(TEST_AT)
    .objectives.find((objective) => objective.id === update.objectiveId).target));

  const duplicate = recordCircuitWeeklyProgress(first.state, forged, { verified: true, at: TEST_AT });
  assert.equal(duplicate.recorded, false);
  assert.equal(duplicate.reason, "already_credited");
  assert.deepEqual(duplicate.state.progress, first.state.progress);

  const oldRun = buildRun({ dayKey: "2026-07-20", id: "old-week" });
  const wrongWeek = recordCircuitWeeklyProgress(first.state, oldRun, { verified: true, at: TEST_AT });
  assert.equal(wrongWeek.reason, "wrong_week");
});

test("three perfect Practice Flights complete and claim all cosmetic objectives exactly once", () => {
  let state = sanitizeCircuitWeeklyState({}, TEST_AT);
  for (let index = 1; index <= 3; index += 1) {
    const run = buildRun({ id: `perfect-practice-${index}` });
    const result = recordCircuitWeeklyProgress(state, run, { verified: true, at: TEST_AT });
    assert.equal(result.recorded, true);
    state = result.state;
  }

  const weekly = circuitWeeklyChallenges(TEST_AT);
  for (const objective of weekly.objectives) {
    assert.equal(state.progress[objective.id], objective.target);
    const claimed = claimCircuitWeeklyReward(state, objective.id, TEST_AT);
    assert.equal(claimed.claimed, true);
    assert.equal(claimed.reward.id, objective.reward.id);
    assert.equal(claimed.reward.cosmeticOnly, true);
    state = claimed.state;

    const repeated = claimCircuitWeeklyReward(state, objective.id, TEST_AT);
    assert.equal(repeated.claimed, false);
    assert.equal(repeated.reason, "already_claimed");
    assert.equal(repeated.reward, null);
  }
  assert.equal(state.claimedObjectiveIds.length, WEEKLY_CIRCUIT_OBJECTIVES);
});

test("personal board keeps one stable best verified result per course and mode", () => {
  const slowPractice = buildRun({ id: "slow-practice", outcome: "clear", stepMs: 6_000 });
  const fastPractice = buildRun({ id: "fast-practice", outcome: "perfect", stepMs: 5_000 });
  const unverified = recordPersonalCircuitResult({}, fastPractice, { verified: false });
  assert.equal(unverified.reason, "verification_required");
  assert.deepEqual(unverified.board.records, []);

  const first = recordPersonalCircuitResult({}, slowPractice, { verified: true });
  assert.equal(first.recorded, true);
  assert.equal(first.replaced, false);
  const improved = recordPersonalCircuitResult(first.board, fastPractice, { verified: true });
  assert.equal(improved.recorded, true);
  assert.equal(improved.replaced, true);
  assert.equal(improved.board.records.length, 1);
  assert.equal(improved.board.records[0].runId, "fast-practice");

  const zLaunch = buildRun({ id: "z-launch", mode: "ticketed", outcome: "perfect", stepMs: 5_000 });
  const aLaunch = buildRun({ id: "a-launch", mode: "ticketed", outcome: "perfect", stepMs: 5_000 });
  const withLaunch = recordPersonalCircuitResult(improved.board, zLaunch, { verified: true });
  assert.equal(withLaunch.board.records.length, 2, "Launch and Practice records remain separate");
  const tied = recordPersonalCircuitResult(withLaunch.board, aLaunch, { verified: true });
  assert.equal(tied.recorded, true, "lexically smaller run ID wins an otherwise exact tie");
  assert.equal(tied.record.runId, "a-launch");

  const board = personalCircuitRecordBoard(tied.board);
  assert.equal(board.scope, "personal-local");
  assert.deepEqual(board.privacy, {
    otherPlayers: false,
    fakePlayers: false,
    piiStored: false
  });
  assert.equal(board.launch.records.length, 1);
  assert.equal(board.launch.records[0].runId, "a-launch");
  assert.equal(board.practice.rewardEligible, false);
  assert.equal(board.practice.records.length, 1);
  assert.equal(board.practice.records[0].runId, "fast-practice");
});

test("personal record sanitizer drops PII, fake entries, invalid courses, and excess history", () => {
  const records = [];
  for (let index = 0; index < MAX_PERSONAL_CIRCUIT_RECORDS + 25; index += 1) {
    const day = new Date(Date.UTC(2026, 6, 27) - index * 86_400_000).toISOString().slice(0, 10);
    records.push({
      courseId: `cosmos-${day}`,
      dayKey: day,
      mode: index % 2 ? "practice" : "ticketed",
      runId: `flight-${index}`,
      score: 10_000 - index,
      elapsedMs: 80_000,
      milestone: "galaxy",
      verified: true,
      playerId: "secret",
      callsign: "Secret Name",
      avatar: "fake-player"
    });
  }
  records.push({
    courseId: "cosmos-2099-01-01",
    dayKey: TEST_DAY,
    mode: "ticketed",
    runId: "fake-course",
    score: 9_999_999,
    elapsedMs: 1,
    milestone: "cosmos",
    verified: true
  });
  records.push({
    courseId: `cosmos-${TEST_DAY}`,
    dayKey: TEST_DAY,
    mode: "ticketed",
    runId: "not-verified",
    verified: false
  });

  const clean = sanitizePersonalCircuitBoard({
    records,
    players: [{ name: "Fake rival" }],
    ownerEmail: "private@example.com"
  });
  assert.ok(clean.records.length <= MAX_PERSONAL_CIRCUIT_RECORDS);
  assert.deepEqual(Object.keys(clean), ["version", "scope", "records"]);
  assert.equal(clean.scope, "personal-local");
  assert.equal(clean.records.some((record) => record.runId === "fake-course"), false);
  assert.equal(clean.records.some((record) => record.runId === "not-verified"), false);
  for (const record of clean.records) {
    assert.deepEqual(Object.keys(record), [
      "courseId",
      "dayKey",
      "weekKey",
      "mode",
      "runId",
      "score",
      "elapsedMs",
      "milestone",
      "stars",
      "verified"
    ]);
    assert.equal("playerId" in record, false);
    assert.equal("callsign" in record, false);
    assert.equal("avatar" in record, false);
  }
});
