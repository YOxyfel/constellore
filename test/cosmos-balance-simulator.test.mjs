import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  evaluateBalanceGuardrails,
  runBalanceSimulation
} from "../scripts/simulate-cosmos-balance.mjs";
import {
  CRAZY_PATH_DAILY_POWERS
} from "../public/cosmos-circuit.mjs";
import { STAR_PATH_XP_RULES } from "../public/star-path.mjs";

const scriptPath = fileURLToPath(new URL("../scripts/simulate-cosmos-balance.mjs", import.meta.url));

test("Cosmos balance simulation is byte-stable for a seed and diverges for another seed", () => {
  const options = { seed: "repeatable-fixture", players: 30, days: 21 };
  const first = runBalanceSimulation(options);
  const second = runBalanceSimulation(options);
  const changed = runBalanceSimulation({ ...options, seed: "different-fixture" });

  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(second), JSON.stringify(first));
  assert.notEqual(JSON.stringify(changed.runs), JSON.stringify(first.runs));
});

test("the simulator conserves passes and XP across the full production reward ladder", () => {
  const report = runBalanceSimulation({
    seed: "season-fixture",
    players: 36,
    days: 56
  });

  assert.equal(report.deterministic, true);
  assert.equal(report.privacy, "aggregate-only simulation; no per-player records or raw trajectories");
  assert.equal(report.courses.uniqueDailyCourses, 56);
  assert.equal(report.passes.conservationDelta, 0);
  assert.equal(report.passes.totalGranted, report.passes.spent + report.passes.endingTotal);
  assert.equal(
    report.passes.spent,
    report.passes.spentByMode.standard + report.passes.spentByMode.crazy
  );
  assert.ok(report.passes.endingAveragePerPlayer >= 0);
  assert.ok(report.passes.endingAveragePerPlayer <= 6);
  assert.equal(report.runs.ticketed.claimed, report.runs.ticketed.rewarded);
  assert.equal(
    Object.values(report.runs.payoutTierDistribution).reduce((sum, count) => sum + count, 0),
    report.runs.ticketed.claimed
  );
  const expectedCircuitXp = Object.entries(STAR_PATH_XP_RULES.cosmosCircuit.milestones)
    .reduce((sum, [tier, amount]) => sum + report.runs.payoutTierDistribution[tier] * amount, 0);
  assert.equal(report.starPath.potentialXp.cosmosCircuit, expectedCircuitXp);
  assert.equal(
    report.runs.repeatCosmosPayoutDowngrades,
    report.runs.milestoneDistribution.cosmos - report.runs.payoutTierDistribution.cosmos
  );
  assert.deepEqual(report.crazyPath.contract, {
    entryPasses: 3,
    qualification: "same-week-cosmos",
    attemptCadence: "one-per-utc-week",
    successCooldownDays: 30,
    instantEach: 20,
    dailyEach: CRAZY_PATH_DAILY_POWERS,
    dailyDays: 30,
    failureReward: 0,
    maximumSuccessesPerPlayer: 2
  });
  assert.equal(
    report.crazyPath.accounting.entryPassesSpent,
    report.crazyPath.attempts.started * report.crazyPath.contract.entryPasses
  );
  assert.equal(report.crazyPath.accounting.entryCostDelta, 0);
  assert.equal(report.crazyPath.eligibility.sameWeekQualificationViolations, 0);
  assert.equal(report.crazyPath.eligibility.weeklyAttemptViolations, 0);
  assert.equal(report.crazyPath.eligibility.cooldownViolations, 0);
  assert.equal(report.crazyPath.eligibility.ineligibleStarts, 0);
  assert.equal(report.crazyPath.rewards.failedRunsRewarded, 0);
  assert.equal(report.crazyPath.rewards.failedStarPathXp, 0);
  assert.equal(report.crazyPath.rewards.starPathXpIssued, 0);
  assert.equal(
    report.crazyPath.rewards.instantEachIssued,
    report.crazyPath.rewards.choices.instant * report.crazyPath.contract.instantEach
  );
  assert.equal(
    report.crazyPath.rewards.dailyEachIssued,
    report.crazyPath.rewards.dailyCreditedDays * report.crazyPath.contract.dailyEach
  );
  assert.equal(
    report.crazyPath.rewards.totalPowersIssued,
    (report.crazyPath.rewards.instantEachIssued + report.crazyPath.rewards.dailyEachIssued) * 4
  );
  assert.equal(report.crazyPath.rewards.issuanceDelta, 0);
  assert.ok(
    report.crazyPath.stipends.maxCreditedDaysPerPlan <= report.crazyPath.contract.dailyDays
  );
  assert.equal(report.crazyPath.stipends.dayConservationDelta, 0);
  assert.equal(
    report.crazyPath.stipends.committedDays,
    report.crazyPath.rewards.dailyCreditedDays
      + report.crazyPath.stipends.outstandingDaysAtEnd
  );
  assert.ok(
    report.crazyPath.attempts.maxSuccessesPerPlayer
      <= report.crazyPath.contract.maximumSuccessesPerPlayer
  );

  assert.ok(report.runs.milestoneDistribution.drift > 0);
  assert.ok(report.runs.milestoneDistribution.orbit > 0);
  assert.ok(report.runs.milestoneDistribution.nebula > 0);
  assert.ok(report.runs.milestoneDistribution.galaxy > 0);
  assert.deepEqual(report.reachability.shippingRuntime, {
    drift: true,
    orbit: true,
    nebula: true,
    galaxy: true,
    cosmos: true
  });
  assert.equal(report.guardrails.failed.includes("reward_tier_reachability"), false);

  assert.ok(report.starPath.creditedXp.total <= report.population.players * report.starPath.maxXp);
  assert.ok(report.starPath.potentialXp.total >= report.starPath.creditedXp.total);
  assert.equal(
    report.starPath.cappedXp,
    report.starPath.potentialXp.total - report.starPath.creditedXp.total
  );
  assert.equal(
    Object.values(report.starPath.reachedTierDistribution).reduce((sum, count) => sum + count, 0),
    report.population.players
  );
  assert.equal(
    Object.values(report.population.skillBandPlayers).reduce((sum, count) => sum + count, 0),
    report.population.players
  );
  assert.equal(
    Object.values(report.population.engagementBandPlayers).reduce((sum, count) => sum + count, 0),
    report.population.players
  );
  const pacing = runBalanceSimulation();
  assert.ok(pacing.engagementBands.light.averageProgressPercent >= 55);
  assert.ok(pacing.engagementBands.light.averageProgressPercent <= 70);
  assert.ok(pacing.engagementBands.light.pathCompletionRatePercent <= 10);
  assert.ok(pacing.engagementBands.light.medianReachedTier >= 8);
  assert.ok(pacing.engagementBands.light.medianReachedTier <= 10);
  assert.ok(pacing.engagementBands.regular.pathCompletionRatePercent >= 75);
  assert.ok(pacing.engagementBands.regular.pathCompletionRatePercent <= 90);
  assert.ok(pacing.engagementBands.dedicated.pathCompletionRatePercent >= 98);
  assert.ok(pacing.starPath.completionDayP50 >= 45 && pacing.starPath.completionDayP50 <= 52);
  assert.ok(pacing.starPath.completionDayP90 >= 52 && pacing.starPath.completionDayP90 <= 56);
  assert.ok(pacing.crazyPath.attempts.started > 0);
  assert.ok(pacing.crazyPath.attempts.succeeded > 0);
  assert.ok(pacing.crazyPath.attempts.failed > 0);
  assert.ok(pacing.crazyPath.rewards.choices.instant > 0);
  assert.ok(pacing.crazyPath.rewards.choices.daily > 0);
  assert.ok(pacing.crazyPath.stipends.accruedGrantEvents > 0);
  for (const id of [
    "crazy_path_entry_cost",
    "crazy_path_eligibility",
    "crazy_path_failure_zero_reward",
    "crazy_path_reward_conservation",
    "crazy_path_stipend_bounds",
    "crazy_path_victory_cooldown"
  ]) assert.equal(pacing.guardrails.failed.includes(id), false, id);
  assert.equal(JSON.stringify(report).includes("\"trajectory\""), false);
  assert.equal(JSON.stringify(report).includes("\"playerRecords\""), false);
});

test("guardrails fail closed when a report violates conservation", () => {
  const report = runBalanceSimulation({ seed: "guardrail-fixture", players: 18, days: 7 });
  const tampered = structuredClone(report);
  tampered.passes.conservationDelta = 1;

  const guardrails = evaluateBalanceGuardrails(tampered);
  assert.equal(guardrails.passed, false);
  assert.ok(guardrails.failed.includes("pass_conservation"));
});

test("Crazy Path guardrails fail closed on consolation rewards or forged issuance", () => {
  const report = runBalanceSimulation({ seed: "crazy-guardrail-fixture", players: 48, days: 56 });
  const tampered = structuredClone(report);
  tampered.crazyPath.rewards.failedRunsRewarded = 1;
  tampered.crazyPath.rewards.totalPowersIssued += 4;
  tampered.crazyPath.rewards.issuanceDelta += 4;

  const guardrails = evaluateBalanceGuardrails(tampered);
  assert.equal(guardrails.passed, false);
  assert.ok(guardrails.failed.includes("crazy_path_failure_zero_reward"));
  assert.ok(guardrails.failed.includes("crazy_path_reward_conservation"));
});

test("the CLI emits deterministic JSON and exits nonzero when fairness guardrails fail", () => {
  const args = [scriptPath, "--json", "--seed=cli-fixture", "--players=12", "--days=3"];
  const first = spawnSync(process.execPath, args, { encoding: "utf8" });
  const second = spawnSync(process.execPath, args, { encoding: "utf8" });

  assert.equal(first.status, 1);
  assert.equal(second.status, 1);
  assert.equal(first.stderr, "");
  assert.equal(second.stdout, first.stdout);
  const report = JSON.parse(first.stdout);
  assert.equal(report.parameters.seed, "cli-fixture");
  assert.equal(report.guardrails.passed, false);
  assert.ok(report.guardrails.failed.includes("sample_size"));
  assert.equal(report.guardrails.failed.includes("reward_tier_reachability"), false);
});
