import assert from "node:assert/strict";
import test from "node:test";

import {
  CIRCUIT_BOOSTS,
  COSMOS_CIRCUIT_ARCHETYPES,
  COSMOS_CIRCUIT_ECONOMY,
  CRAZY_PATH_DAILY_DAYS,
  CRAZY_PATH_DAILY_POWERS,
  CRAZY_PATH_ENTRY_PASSES,
  CRAZY_PATH_INSTANT_POWERS,
  CRAZY_PATH_MIN_ROUTE_RANK,
  DAILY_LAUNCH_PASSES,
  MAX_LAUNCH_PASSES,
  advanceCircuitRun,
  circuitPassEarningStatus,
  circuitRewardPreview,
  claimCircuitReward,
  claimPendingLaunchPasses,
  cosmosCircuitArchetype,
  cosmosCircuitArchetypes,
  cosmosCircuitCrazyCourse,
  cosmosCircuitCourse,
  cosmosCircuitRewardLadder,
  crazyPathEligibility,
  crazyPathRankEligibility,
  crazyPathRewardOptions,
  createCircuitSnapshot,
  finishCircuitRun,
  effectiveCircuitRewardTier,
  grantCrazyPathDailyPowers,
  grantDailyLaunchPasses,
  grantRankLaunchPass,
  recordEligiblePureWin,
  resumeCircuitRun,
  sanitizeCircuitSnapshot,
  sanitizeCircuitWallet,
  startCircuitRun
} from "../public/cosmos-circuit.mjs";

function advanceSegments(run, course, count = course.segments.length, outcome = "perfect") {
  let current = run;
  for (const segment of course.segments.slice(current.cursor, count)) {
    const segmentOutcome = typeof outcome === "function" ? outcome(segment) : outcome;
    const advanced = advanceCircuitRun(current, {
      segmentId: segment.id,
      outcome: segmentOutcome,
      stardust: segment.stardust,
      ability: segment.kind === "ability-gate" ? "shield" : "",
      elapsedMs: (segment.index + 1) * 5_000
    });
    assert.equal(advanced.advanced, true);
    current = advanced.run;
  }
  return current;
}

test("daily courses are deterministic, week-themed, and expose bounded flight objects", () => {
  const first = cosmosCircuitCourse("2026-07-27");
  const repeated = cosmosCircuitCourse("2026-07-27T23:59:59Z");
  const tomorrow = cosmosCircuitCourse("2026-07-28");
  assert.deepEqual(repeated, first);
  assert.notEqual(tomorrow.seed, first.seed);
  assert.equal(first.id, "cosmos-2026-07-27");
  assert.match(first.weekKey, /^\d{4}-W\d{2}$/);
  assert.ok(first.name.endsWith("Circuit"));
  assert.equal(first.archetypeId, first.archetype.id);
  assert.equal(cosmosCircuitArchetype("2026-07-27").id, first.archetype.id);
  assert.equal(cosmosCircuitArchetype("2026-07-27").index, first.archetype.index);
  assert.notEqual(tomorrow.archetypeId, first.archetypeId);
  assert.deepEqual(tomorrow.segments.map((segment) => segment.kind), first.segments.map((segment) => segment.kind));
  assert.notDeepEqual(
    tomorrow.checkpoints.slice(0, 6).map(({ x, y }) => [x, y]),
    first.checkpoints.slice(0, 6).map(({ x, y }) => [x, y])
  );
  assert.deepEqual(cosmosCircuitArchetypes(), COSMOS_CIRCUIT_ARCHETYPES);
  assert.ok(first.durationMs >= 72_000 && first.durationMs <= 93_000);
  assert.equal(first.checkpoints.filter((item) => item.type === "gate").length, 8);
  assert.equal(first.checkpoints.filter((item) => item.type === "blackHole").length, 2);
  assert.equal(first.checkpoints.filter((item) => item.type === "beacon").length, 2);
  assert.equal(first.checkpoints.filter((item) => item.type === "stardust").length, 24);
  assert.ok(first.checkpoints.every((item) => (
    /^[a-zA-Z]+-\d{2}$/.test(item.id)
    && ["gate", "blackHole", "beacon", "stardust"].includes(item.type)
    && item.at >= 0
    && item.at <= first.durationMs
    && item.x >= 0
    && item.x <= 1
    && item.y >= 0
    && item.y <= 1
    && item.radius > 0
  )));
  assert.deepEqual(first.segments.filter((item) => item.kind === "ability-gate")
    .map((item) => item.abilityOptions), [CIRCUIT_BOOSTS, CIRCUIT_BOOSTS]);
});

test("wallet sanitation enforces earned-only passes and the six-pass cap", () => {
  const wallet = sanitizeCircuitWallet({
    passes: 999,
    purchased: 999,
    paidBalance: 50,
    recentPureWinIds: ["valid-win", "<script>", "valid-win"],
    rankGrantIds: Array.from({ length: 100 }, (_, index) => `rank-${index}`)
  });
  assert.equal(wallet.passes, MAX_LAUNCH_PASSES);
  assert.equal(wallet.earnedOnly, true);
  assert.equal("purchased" in wallet, false);
  assert.equal("paidBalance" in wallet, false);
  assert.deepEqual(wallet.recentPureWinIds, ["valid-win"]);
  assert.equal(wallet.rankGrantIds.length, 64);
  assert.deepEqual(COSMOS_CIRCUIT_ECONOMY, {
    launchPasses: "earned-only",
    paidEntries: false,
    randomRewards: false,
    practiceFlights: "unlimited",
    crazyPath: {
      entryPasses: 3,
      minimumRouteRank: 3,
      qualification: "same-week-cosmos",
      attempts: "one-per-utc-week",
      rewards: "all-or-nothing",
      victoryCooldownDays: 30
    },
    rankedWordGameAdvantage: false
  });
});

test("the disclosed Circuit ladder matches the Star Path milestone XP schedule", () => {
  const ladder = cosmosCircuitRewardLadder();
  assert.deepEqual(
    Object.fromEntries(Object.entries(ladder).map(([tier, reward]) => [tier, reward.starPathXp])),
    { drift: 20, orbit: 35, nebula: 55, galaxy: 85, cosmos: 125 }
  );
});

test("daily Launch Passes grant three once per UTC day and bank at six", () => {
  const first = grantDailyLaunchPasses({}, "2026-07-27T00:01:00Z");
  assert.equal(first.granted, DAILY_LAUNCH_PASSES);
  assert.equal(first.wallet.passes, 3);
  const duplicate = grantDailyLaunchPasses(first.wallet, "2026-07-27T23:59:59Z");
  assert.equal(duplicate.granted, 0);
  assert.equal(duplicate.reason, "already_granted");
  const nextDay = grantDailyLaunchPasses(duplicate.wallet, "2026-07-28T00:00:00Z");
  assert.equal(nextDay.granted, 3);
  assert.equal(nextDay.wallet.passes, 6);
  const capped = grantDailyLaunchPasses(nextDay.wallet, "2026-07-29T00:00:00Z");
  assert.equal(capped.granted, 0);
  assert.equal(capped.wallet.passes, 6);
  assert.equal(capped.reason, "wallet_full");
  assert.notEqual(capped.wallet.dailyGrantDay, "2026-07-29");

  const spent = startCircuitRun({
    course: cosmosCircuitCourse("2026-07-29"),
    mode: "ticketed",
    wallet: capped.wallet,
    runId: "deferred-daily-refill"
  });
  assert.equal(spent.started, true);
  assert.equal(spent.wallet.passes, 5);
  const deferred = grantDailyLaunchPasses(spent.wallet, "2026-07-29T12:00:00Z");
  assert.equal(deferred.granted, 1);
  assert.equal(deferred.wallet.passes, 6);
  assert.equal(deferred.wallet.dailyGrantDay, "2026-07-29");

  const clockRollback = grantDailyLaunchPasses(
    { ...deferred.wallet, dailyGrantDay: "2026-07-31", passes: 0 },
    "2026-07-30T12:00:00Z"
  );
  assert.equal(clockRollback.granted, 0);
  assert.equal(clockRollback.reason, "clock_before_last_grant");
  assert.equal(clockRollback.wallet.passes, 0);
});

test("four distinct verified unassisted Pure wins grant at most one daily pass", () => {
  let wallet = sanitizeCircuitWallet({ passes: 0 });
  for (let index = 1; index <= 4; index += 1) {
    const result = recordEligiblePureWin(wallet, {
      winId: `pure-win-${index}`,
      mode: "pure",
      won: true,
      assisted: false,
      verified: true,
      at: "2026-07-27T12:00:00Z"
    });
    wallet = result.wallet;
    assert.equal(result.granted, index === 4 ? 1 : 0);
  }
  const duplicate = recordEligiblePureWin(wallet, {
    winId: "pure-win-4",
    mode: "pure",
    won: true,
    assisted: false,
    verified: true,
    at: "2026-07-27T13:00:00Z"
  });
  assert.equal(duplicate.reason, "duplicate_win");
  const fifth = recordEligiblePureWin(wallet, {
    winId: "pure-win-5",
    mode: "pure",
    won: true,
    assisted: false,
    verified: true,
    at: "2026-07-27T14:00:00Z"
  });
  assert.equal(fifth.granted, 0);
  assert.equal(fifth.reason, "daily_bonus_complete");
  assert.equal(fifth.wallet.passes, 1);
});

test("verified rank grants are one-time and never overflow the wallet", () => {
  const invalid = grantRankLaunchPass({}, { rankId: "rank-2", verified: false });
  assert.equal(invalid.granted, 0);
  const first = grantRankLaunchPass(invalid.wallet, { rankId: "rank-2", verified: true });
  assert.equal(first.granted, 1);
  const duplicate = grantRankLaunchPass(first.wallet, { rankId: "rank-2", verified: true });
  assert.equal(duplicate.reason, "already_granted");
  const full = grantRankLaunchPass({ ...duplicate.wallet, passes: 6 }, { rankId: "rank-3", verified: true });
  assert.equal(full.granted, 0);
  assert.equal(full.pending, 1);
  assert.equal(full.reason, "rank_grant_pending");
  assert.equal(full.wallet.rankGrantIds.includes("rank-3"), false);
  assert.deepEqual(full.wallet.pendingRankGrantIds, ["rank-3"]);

  const pendingDuplicate = grantRankLaunchPass(full.wallet, { rankId: "rank-3", verified: true });
  assert.equal(pendingDuplicate.reason, "already_pending");

  const released = claimPendingLaunchPasses({ ...full.wallet, passes: 5 });
  assert.equal(released.granted, 1);
  assert.equal(released.rankGranted, 1);
  assert.deepEqual(released.rankIds, ["rank-3"]);
  assert.equal(released.wallet.passes, 6);
  assert.equal(released.wallet.rankGrantIds.includes("rank-3"), true);
  assert.deepEqual(released.wallet.pendingRankGrantIds, []);
});

test("pending grants release after a Reward Flight spends space and pass progress is explicit", () => {
  const course = cosmosCircuitCourse("2026-07-27");
  const started = startCircuitRun({
    course,
    mode: "ticketed",
    wallet: {
      passes: MAX_LAUNCH_PASSES,
      pendingRankGrantIds: ["rank-gold"]
    },
    runId: "pending-rank-release"
  });
  assert.equal(started.started, true);
  assert.equal(started.consumed, 1);
  assert.equal(started.redeemedPending, 1);
  assert.deepEqual(started.pendingRelease, {
    granted: 1,
    rankGranted: 1,
    rankIds: ["rank-gold"],
    pureGranted: 0
  });
  assert.equal(started.wallet.passes, MAX_LAUNCH_PASSES);
  const status = circuitPassEarningStatus({
    passes: 4,
    dailyGrantDay: "2026-07-26",
    dailyPure: { dayKey: "2026-07-27", wins: 2, awarded: false },
    pendingRankGrantIds: ["rank-diamond"]
  }, "2026-07-27T12:00:00Z");
  assert.equal(status.daily.available, true);
  assert.equal(status.pureWins.remaining, 2);
  assert.equal(status.pendingRankGrants, 1);
  assert.equal(status.resetAt, "2026-07-28T00:00:00.000Z");
});

test("Practice is unlimited and reward-free while ticketed runs consume one earned pass", () => {
  const course = cosmosCircuitCourse("2026-07-27");
  const practice = startCircuitRun({
    course,
    mode: "practice",
    wallet: { passes: 0 },
    runId: "practice-one",
    practiceBoost: "timeWarp",
    at: course.startsAt
  });
  assert.equal(practice.started, true);
  assert.equal(practice.consumed, 0);
  assert.equal(practice.run.practiceBoost, "timeWarp");
  const finishedPractice = advanceSegments(practice.run, course);
  assert.equal(finishedPractice.result.milestone, "cosmos");
  assert.equal(finishedPractice.result.rewardEligible, false);
  assert.equal(claimCircuitReward({}, finishedPractice, { verified: true }).reason, "reward_ineligible");

  const blocked = startCircuitRun({ course, mode: "ticketed", wallet: { passes: 0 }, runId: "ticket-zero" });
  assert.equal(blocked.reason, "no_launch_pass");
  const ticketed = startCircuitRun({
    course,
    mode: "ticketed",
    wallet: { passes: 2 },
    runId: "ticket-one",
    practiceBoost: "shield"
  });
  assert.equal(ticketed.started, true);
  assert.equal(ticketed.consumed, 1);
  assert.equal(ticketed.wallet.passes, 1);
  assert.equal(ticketed.run.practiceBoost, "");
  const repeatedStart = startCircuitRun({ course, mode: "ticketed", wallet: ticketed.wallet, runId: "ticket-one" });
  assert.equal(repeatedStart.reason, "already_started");
});

test("sequential replay and voluntary extraction derive fixed reward milestones", () => {
  const course = cosmosCircuitCourse("2026-07-27");
  const started = startCircuitRun({ course, mode: "ticketed", wallet: { passes: 1 }, runId: "drift-run" });
  const wrong = advanceCircuitRun(started.run, { segmentId: course.segments[1].id, outcome: "perfect" });
  assert.equal(wrong.reason, "unexpected_segment");
  const partial = advanceSegments(started.run, course, 5);
  const ended = finishCircuitRun(partial, { reason: "extract", elapsedMs: 28_000 });
  assert.equal(ended.finished, true);
  assert.equal(ended.run.end.reason, "extract");
  assert.equal(ended.result.milestone, "drift");
  assert.equal(ended.result.rewardEligible, true);
  assert.ok(ended.result.score > 0);
  const claimed = claimCircuitReward({}, ended.run, { chosenBoost: "magnet", verified: true });
  assert.equal(claimed.claimed, true);
  assert.deepEqual(claimed.grant.boosts, { shield: 0, phase: 0, magnet: 1, timeWarp: 0 });
  const retry = claimCircuitReward(claimed.claims, ended.run, { chosenBoost: "magnet", verified: true });
  assert.equal(retry.reason, "already_claimed");

  const tooEarly = advanceSegments(
    startCircuitRun({ course, mode: "ticketed", wallet: { passes: 1 }, runId: "early-extract" }).run,
    course,
    4
  );
  const noReward = finishCircuitRun(tooEarly, { reason: "extract", elapsedMs: 20_000 });
  assert.equal(noReward.finished, true);
  assert.equal(noReward.result.milestone, "none");
  assert.equal(noReward.result.rewardEligible, false);
});

test("the first weekly Cosmos grants four of each boost and repeats downgrade to Galaxy", () => {
  const course = cosmosCircuitCourse("2026-07-27");
  const firstStart = startCircuitRun({ course, mode: "ticketed", wallet: { passes: 2 }, runId: "cosmos-one" });
  const firstRun = advanceSegments(firstStart.run, course);
  assert.equal(firstRun.result.milestone, "cosmos");
  const firstClaim = claimCircuitReward({}, firstRun, { verified: true });
  assert.equal(firstClaim.claimed, true);
  assert.equal(firstClaim.grant.tier, "cosmos");
  assert.deepEqual(firstClaim.grant.boosts, { shield: 4, phase: 4, magnet: 4, timeWarp: 4 });
  assert.equal(firstClaim.grant.disclosureKey, "circuit.reward.cosmos.first");

  const secondStart = startCircuitRun({
    course,
    mode: "ticketed",
    wallet: firstStart.wallet,
    runId: "cosmos-two"
  });
  const secondRun = advanceSegments(secondStart.run, course);
  const repeatClaim = claimCircuitReward(firstClaim.claims, secondRun, { verified: true });
  assert.equal(repeatClaim.claimed, true);
  assert.equal(repeatClaim.grant.milestone, "cosmos");
  assert.equal(repeatClaim.grant.tier, "galaxy");
  assert.equal(repeatClaim.grant.repeatAdjusted, true);
  assert.equal(repeatClaim.grant.disclosureKey, "circuit.reward.cosmos.repeat");
  assert.deepEqual(repeatClaim.grant.boosts, { shield: 2, phase: 2, magnet: 2, timeWarp: 2 });

  const firstPreview = circuitRewardPreview("cosmos", {}, { weekKey: course.weekKey });
  const repeatPreview = circuitRewardPreview("cosmos", firstClaim.claims, { weekKey: course.weekKey });
  assert.equal(firstPreview.tier, "cosmos");
  assert.equal(circuitRewardPreview("cosmos", {}, { at: course.startsAt }).tier, "cosmos");
  assert.equal(repeatPreview.tier, "galaxy");
  assert.equal(effectiveCircuitRewardTier("cosmos", firstClaim.claims, { weekKey: course.weekKey }), "galaxy");
  assert.deepEqual(repeatPreview.reward, cosmosCircuitRewardLadder().galaxy);
});

test("snapshots resume the identical course and recover only bounded replay state", () => {
  const course = cosmosCircuitCourse("2026-07-27");
  const started = startCircuitRun({ course, mode: "practice", runId: "resume-run", at: course.startsAt });
  const partial = advanceSegments(started.run, course, 4);
  const snapshot = createCircuitSnapshot(partial, "2026-07-27T12:00:00Z");
  const serialized = JSON.parse(JSON.stringify(snapshot));
  const resumed = resumeCircuitRun(serialized);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.run.courseId, course.id);
  assert.deepEqual(resumed.run.events, partial.events);

  serialized.run.events[0].outcome = "miss";
  serialized.run.metrics = { score: 999_999_999 };
  const recovered = sanitizeCircuitSnapshot(serialized);
  assert.equal(recovered.recovered, true);
  assert.notEqual(recovered.run.metrics.score, 999_999_999);
  assert.equal(recovered.run.events[0].outcome, "miss");

  const mismatched = sanitizeCircuitSnapshot({ ...snapshot, courseDayKey: "2026-07-28" });
  assert.equal(mismatched.run, null);
  assert.equal(mismatched.resumable, false);
});

test("Crazy Path is a deterministic, distinct, tighter daily course", () => {
  const standard = cosmosCircuitCourse("2026-07-27");
  const crazy = cosmosCircuitCrazyCourse("2026-07-27");
  const repeated = cosmosCircuitCrazyCourse("2026-07-27T23:59:59.999Z");
  const tomorrow = cosmosCircuitCrazyCourse("2026-07-28");

  assert.deepEqual(repeated, crazy);
  assert.equal(crazy.variant, "crazy");
  assert.equal(crazy.id, "crazy-2026-07-27");
  assert.equal(crazy.weekKey, standard.weekKey);
  assert.notEqual(crazy.seed, standard.seed);
  assert.notEqual(crazy.id, standard.id);
  assert.notEqual(tomorrow.seed, crazy.seed);
  assert.ok(crazy.segments.length > standard.segments.length);
  assert.ok(crazy.checkpoints.filter((item) => item.type === "gate").length
    > standard.checkpoints.filter((item) => item.type === "gate").length);
  assert.ok(crazy.checkpoints.filter((item) => item.type === "blackHole").length
    > standard.checkpoints.filter((item) => item.type === "blackHole").length);
  for (const type of ["gate", "blackHole", "beacon"]) {
    const crazyRadius = Math.max(...crazy.checkpoints
      .filter((item) => item.type === type)
      .map((item) => item.radius));
    const standardRadius = Math.min(...standard.checkpoints
      .filter((item) => item.type === type)
      .map((item) => item.radius));
    assert.ok(crazyRadius < standardRadius, `${type} targets should be tighter`);
  }
  assert.ok(crazy.goals.some((goal) => goal.id === "all-or-nothing"));
  assert.ok(crazy.goals.some((goal) => goal.id === "no-extraction"));
});

test("Crazy Path snapshots preserve the exact path and resume its deterministic course", () => {
  const course = cosmosCircuitCrazyCourse("2026-07-27");
  const started = startCircuitRun({
    course,
    mode: "ticketed",
    path: "crazy",
    wallet: { passes: MAX_LAUNCH_PASSES },
    claims: { cosmosWeekKeys: [course.weekKey] },
    runId: "crazy-snapshot",
    at: course.startsAt
  });
  assert.equal(started.started, true);
  const partial = advanceSegments(started.run, course, 6);
  const snapshot = createCircuitSnapshot(partial, "2026-07-27T12:00:00Z");
  const resumed = resumeCircuitRun(JSON.parse(JSON.stringify(snapshot)));

  assert.equal(snapshot.run.path, "crazy");
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.run.path, "crazy");
  assert.equal(resumed.run.courseVariant, "crazy");
  assert.equal(resumed.run.courseId, course.id);
  assert.deepEqual(resumed.run.events, partial.events);
  assert.equal(cosmosCircuitCrazyCourse(resumed.run.courseDayKey).seed, course.seed);
});

test("Crazy Path eligibility requires a same-week Cosmos, three passes, one weekly attempt, and observes the cooldown boundary", () => {
  const standard = cosmosCircuitCourse("2026-07-27");
  const standardStart = startCircuitRun({
    course: standard,
    mode: "ticketed",
    wallet: { passes: MAX_LAUNCH_PASSES },
    runId: "crazy-qualifying-cosmos"
  });
  const cosmosRun = advanceSegments(standardStart.run, standard);
  const cosmosClaim = claimCircuitReward(standardStart.claims, cosmosRun, {
    verified: true,
    at: "2026-07-27T12:00:00Z"
  });
  assert.equal(cosmosClaim.claimed, true);
  assert.ok(cosmosClaim.claims.cosmosWeekKeys.includes(standard.weekKey));

  const unqualified = crazyPathEligibility(
    { passes: MAX_LAUNCH_PASSES },
    {},
    {},
    "2026-07-27T12:00:00Z"
  );
  assert.equal(unqualified.eligible, false);
  assert.equal(unqualified.reason, "cosmos_qualification_required");

  const underfunded = crazyPathEligibility(
    { passes: CRAZY_PATH_ENTRY_PASSES - 1 },
    cosmosClaim.claims,
    {},
    "2026-07-27T12:00:00Z"
  );
  assert.equal(underfunded.eligible, false);
  assert.equal(underfunded.reason, "launch_passes_required");
  assert.equal(underfunded.passesNeeded, 1);

  const ready = crazyPathEligibility(
    { passes: CRAZY_PATH_ENTRY_PASSES },
    cosmosClaim.claims,
    {},
    "2026-07-27T12:00:00Z"
  );
  assert.equal(ready.eligible, true);
  assert.equal(ready.qualified, true);
  assert.equal(ready.entryPasses, CRAZY_PATH_ENTRY_PASSES);

  const rankBlocked = crazyPathEligibility(
    { passes: CRAZY_PATH_ENTRY_PASSES },
    cosmosClaim.claims,
    {},
    "2026-07-27T12:00:00Z",
    { routeRank: "silver" }
  );
  assert.equal(rankBlocked.eligible, false);
  assert.equal(rankBlocked.reason, "route_rank_required");
  assert.equal(rankBlocked.rank.minimumNumber, CRAZY_PATH_MIN_ROUTE_RANK);
  assert.equal(crazyPathRankEligibility("gold").qualified, true);
  assert.equal(crazyPathRankEligibility({ rankId: "silver" }).qualified, false);
  assert.equal(crazyPathRankEligibility({ rank: { id: "gold", number: 3 } }).qualified, true);
  assert.equal(crazyPathRankEligibility(99).qualified, false);

  const crazyCourse = cosmosCircuitCrazyCourse("2026-07-27");
  const started = startCircuitRun({
    course: crazyCourse,
    mode: "ticketed",
    path: "crazy",
    wallet: { passes: CRAZY_PATH_ENTRY_PASSES },
    claims: cosmosClaim.claims,
    runId: "crazy-weekly-attempt"
  });
  assert.equal(started.started, true);
  assert.equal(started.consumed, CRAZY_PATH_ENTRY_PASSES);
  assert.equal(started.wallet.passes, 0);
  assert.ok(started.claims.crazyAttemptWeekKeys.includes(crazyCourse.weekKey));

  const weeklyRetry = crazyPathEligibility(
    { passes: MAX_LAUNCH_PASSES },
    started.claims,
    {},
    "2026-07-27T18:00:00Z"
  );
  assert.equal(weeklyRetry.eligible, false);
  assert.equal(weeklyRetry.reason, "weekly_attempt_used");

  const boundaryDay = "2026-08-26";
  const boundaryWeek = cosmosCircuitCourse(boundaryDay).weekKey;
  const boundaryClaims = {
    cosmosWeekKeys: [boundaryWeek],
    crazyCooldownUntilDay: boundaryDay
  };
  const beforeBoundary = crazyPathEligibility(
    { passes: MAX_LAUNCH_PASSES },
    boundaryClaims,
    {},
    "2026-08-25T23:59:59.999Z"
  );
  assert.equal(beforeBoundary.eligible, false);
  assert.equal(beforeBoundary.reason, "victory_cooldown");
  const atBoundary = crazyPathEligibility(
    { passes: MAX_LAUNCH_PASSES },
    boundaryClaims,
    {},
    "2026-08-26T00:00:00.000Z"
  );
  assert.equal(atBoundary.eligible, true);
  assert.equal(atBoundary.coolingDown, false);
});

test("Crazy Path extraction and every terminal failure grant zero", () => {
  const course = cosmosCircuitCrazyCourse("2026-07-27");
  const started = startCircuitRun({
    course,
    mode: "ticketed",
    path: "crazy",
    wallet: { passes: MAX_LAUNCH_PASSES },
    claims: { cosmosWeekKeys: [course.weekKey] },
    runId: "crazy-terminal-losses"
  });
  assert.equal(started.started, true);
  const partial = advanceSegments(started.run, course, 5);

  for (const reason of ["extract", "crash", "timeout", "withdraw"]) {
    const ended = finishCircuitRun(partial, { reason, elapsedMs: 25_000 });
    assert.equal(ended.finished, true, reason);
    assert.equal(ended.result.milestone, "none", reason);
    assert.equal(ended.result.rewardEligible, false, reason);
    const claim = claimCircuitReward(started.claims, ended.run, {
      verified: true,
      crazyRewardChoice: "instant"
    });
    assert.equal(claim.claimed, false, reason);
    assert.equal(claim.reason, "reward_ineligible", reason);
    assert.equal(claim.grant, null, reason);
  }

  const missedRequired = advanceSegments(
    started.run,
    course,
    course.segments.length,
    (segment) => segment.required && segment.index === 0 ? "miss" : "perfect"
  );
  assert.equal(missedRequired.status, "finished");
  assert.equal(missedRequired.metrics.requiredCheckpointsFailed, 1);
  assert.equal(missedRequired.metrics.crazyComplete, false);
  assert.equal(missedRequired.result.milestone, "none");
  assert.equal(missedRequired.result.rewardEligible, false);
  assert.equal(claimCircuitReward(started.claims, missedRequired, {
    verified: true,
    crazyRewardChoice: "daily"
  }).reason, "reward_ineligible");
});

test("a verified Crazy Path victory grants exactly twenty of every power for the instant choice", () => {
  const course = cosmosCircuitCrazyCourse("2026-07-27");
  const started = startCircuitRun({
    course,
    mode: "ticketed",
    path: "crazy",
    wallet: { passes: MAX_LAUNCH_PASSES },
    claims: { cosmosWeekKeys: [course.weekKey] },
    runId: "crazy-instant-win"
  });
  const completed = advanceSegments(started.run, course);
  assert.equal(completed.result.milestone, "crazy");
  assert.equal(completed.result.rewardEligible, true);

  const claimed = claimCircuitReward(started.claims, completed, {
    verified: true,
    crazyRewardChoice: "instant",
    at: "2026-07-27T12:00:00Z"
  });
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.grant.crazyRewardChoice, "instant");
  assert.equal(claimed.grant.totalPerBoost, CRAZY_PATH_INSTANT_POWERS);
  assert.deepEqual(claimed.grant.boosts, {
    shield: 20,
    phase: 20,
    magnet: 20,
    timeWarp: 20
  });
  assert.equal(claimed.grant.starPathXp, 0);
  assert.equal(claimed.grant.stipend.runId, "");
  assert.equal(claimed.claims.crazyCooldownUntilDay, "2026-08-26");
  assert.deepEqual(crazyPathRewardOptions().map((choice) => [
    choice.id,
    choice.totalPerBoost,
    choice.totalPowers
  ]), [
    ["instant", 20, 80],
    ["daily", 90, 360]
  ]);

  const duplicate = claimCircuitReward(claimed.claims, completed, {
    verified: true,
    crazyRewardChoice: "daily",
    at: "2026-07-27T12:01:00Z"
  });
  assert.equal(duplicate.claimed, false);
  assert.equal(duplicate.reason, "already_claimed");
});

test("the Crazy Path daily choice accrues exactly thirty idempotent UTC-day grants", () => {
  assert.equal(CRAZY_PATH_DAILY_POWERS, 3);
  const course = cosmosCircuitCrazyCourse("2026-07-27");
  const started = startCircuitRun({
    course,
    mode: "ticketed",
    path: "crazy",
    wallet: { passes: MAX_LAUNCH_PASSES },
    claims: { cosmosWeekKeys: [course.weekKey] },
    runId: "crazy-daily-win"
  });
  const completed = advanceSegments(started.run, course);
  const claimed = claimCircuitReward(started.claims, completed, {
    verified: true,
    crazyRewardChoice: "daily",
    at: "2026-07-27T12:00:00Z"
  });
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.grant.crazyRewardChoice, "daily");
  assert.equal(claimed.grant.totalPerBoost, CRAZY_PATH_DAILY_POWERS * CRAZY_PATH_DAILY_DAYS);
  assert.deepEqual(claimed.grant.boosts, {
    shield: 0,
    phase: 0,
    magnet: 0,
    timeWarp: 0
  });

  let stipend = claimed.grant.stipend;
  let totalEach = 0;
  const dayOne = grantCrazyPathDailyPowers(stipend, "2026-07-27T12:00:00Z");
  stipend = dayOne.stipend;
  totalEach += dayOne.each;
  assert.equal(dayOne.grantedDays, 1);
  assert.equal(dayOne.each, CRAZY_PATH_DAILY_POWERS);
  assert.deepEqual(dayOne.boosts, {
    shield: CRAZY_PATH_DAILY_POWERS,
    phase: CRAZY_PATH_DAILY_POWERS,
    magnet: CRAZY_PATH_DAILY_POWERS,
    timeWarp: CRAZY_PATH_DAILY_POWERS
  });

  const sameDay = grantCrazyPathDailyPowers(stipend, "2026-07-27T23:59:59Z");
  assert.equal(sameDay.grantedDays, 0);
  assert.equal(sameDay.each, 0);
  assert.deepEqual(sameDay.stipend, stipend);

  const accruedDayTen = grantCrazyPathDailyPowers(stipend, "2026-08-05T12:00:00Z");
  stipend = accruedDayTen.stipend;
  totalEach += accruedDayTen.each;
  assert.equal(accruedDayTen.reason, "accrued_grant");
  assert.equal(accruedDayTen.grantedDays, 9);
  assert.equal(accruedDayTen.each, 9 * CRAZY_PATH_DAILY_POWERS);
  assert.equal(stipend.creditedDays, 10);

  const rollback = grantCrazyPathDailyPowers(stipend, "2026-08-04T12:00:00Z");
  assert.equal(rollback.grantedDays, 0);
  assert.equal(rollback.each, 0);
  assert.equal(rollback.stipend.creditedDays, 10);

  const dayThirty = grantCrazyPathDailyPowers(stipend, "2026-08-25T12:00:00Z");
  stipend = dayThirty.stipend;
  totalEach += dayThirty.each;
  assert.equal(dayThirty.grantedDays, 20);
  assert.equal(dayThirty.each, 20 * CRAZY_PATH_DAILY_POWERS);
  assert.equal(stipend.creditedDays, CRAZY_PATH_DAILY_DAYS);
  assert.equal(stipend.complete, true);
  assert.equal(totalEach, CRAZY_PATH_DAILY_POWERS * CRAZY_PATH_DAILY_DAYS);

  const duplicateDayThirty = grantCrazyPathDailyPowers(stipend, "2026-08-25T23:59:59Z");
  assert.equal(duplicateDayThirty.grantedDays, 0);
  assert.equal(duplicateDayThirty.reason, "complete");
  const dayThirtyOne = grantCrazyPathDailyPowers(stipend, "2026-08-26T00:00:00Z");
  assert.equal(dayThirtyOne.grantedDays, 0);
  assert.equal(dayThirtyOne.each, 0);
  assert.equal(dayThirtyOne.reason, "complete");
  assert.deepEqual(dayThirtyOne.boosts, {
    shield: 0,
    phase: 0,
    magnet: 0,
    timeWarp: 0
  });
});
