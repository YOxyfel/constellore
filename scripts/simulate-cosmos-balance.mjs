#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  CIRCUIT_BOOSTS,
  CRAZY_PATH_DAILY_DAYS,
  CRAZY_PATH_DAILY_POWERS,
  CRAZY_PATH_ENTRY_PASSES,
  CRAZY_PATH_INSTANT_POWERS,
  MAX_LAUNCH_PASSES,
  claimCircuitReward,
  cosmosCircuitCrazyCourse,
  cosmosCircuitCourse,
  crazyPathEligibility,
  finishCircuitRun,
  grantCrazyPathDailyPowers,
  grantDailyLaunchPasses,
  grantRankLaunchPass,
  recordEligiblePureWin,
  sanitizeCircuitClaims,
  sanitizeCircuitRun,
  sanitizeCrazyPathStipend,
  sanitizeCircuitWallet,
  startCircuitRun
} from "../public/cosmos-circuit.mjs";
import {
  STAR_PATH_MAX_XP,
  STAR_PATH_TIER_COUNT,
  STAR_PATH_XP_RULES,
  recordStarPathProgress,
  sanitizeStarPathState,
  starPathProgress
} from "../public/star-path.mjs";

const DAY_MS = 86_400_000;
const MILESTONES = Object.freeze(["none", "drift", "orbit", "nebula", "galaxy", "cosmos"]);
const CHALLENGES = Object.freeze([
  "planetSequence",
  "blackHoleTunnels",
  "perfectSlingshots",
  "stardustTrail",
  "shieldIntact",
  "allGoals"
]);

export const DEFAULT_BALANCE_OPTIONS = Object.freeze({
  seed: "cosmos-launch-v1",
  startDay: "2026-01-05",
  days: 56,
  players: 180
});

export const DEFAULT_BALANCE_GUARDRAILS = Object.freeze({
  minimumTicketedRuns: 5_000,
  minimumRewardRatePercent: 60,
  maximumRewardRatePercent: 99,
  minimumCosmosRatePercent: 0.5,
  maximumCosmosRatePercent: 25,
  minimumNoviceRewardRatePercent: 55,
  maximumExpertCosmosRatePercent: 45,
  minimumPassUtilizationPercent: 80,
  maximumPassUtilizationPercent: 100,
  minimumPathCompletionPercent: 50,
  maximumPathCompletionPercent: 65,
  minimumLightPathCompletionPercent: 0,
  maximumLightPathCompletionPercent: 10,
  minimumLightAverageProgressPercent: 55,
  maximumLightAverageProgressPercent: 70,
  minimumLightMedianTier: 8,
  maximumLightMedianTier: 10,
  minimumRegularPathCompletionPercent: 75,
  maximumRegularPathCompletionPercent: 90,
  minimumDedicatedPathCompletionPercent: 98,
  maximumDedicatedPathCompletionPercent: 100,
  earliestAcceptableMedianCompletionDay: 45,
  latestAcceptableMedianCompletionDay: 52,
  earliestAcceptableP90CompletionDay: 52,
  latestAcceptableP90CompletionDay: 56,
  maximumCrazyEntryCostDelta: 0,
  maximumCrazyEligibilityViolations: 0,
  maximumCrazyFailureRewards: 0,
  maximumCrazyRewardIssuanceDelta: 0,
  maximumCrazyCooldownViolations: 0
});

const SKILL_BANDS = Object.freeze([
  Object.freeze({
    id: "novice",
    share: 0.4,
    completionRate: 0.62,
    successRate: 0.76,
    perfectRate: 0.12,
    stardustRate: 0.67,
    abilityUseRate: 0.52,
    crazySuccessRate: 0.01,
    rankRate: 0.35
  }),
  Object.freeze({
    id: "regular",
    share: 0.4,
    completionRate: 0.82,
    successRate: 0.89,
    perfectRate: 0.28,
    stardustRate: 0.83,
    abilityUseRate: 0.72,
    crazySuccessRate: 0.055,
    rankRate: 0.58
  }),
  Object.freeze({
    id: "expert",
    share: 0.2,
    completionRate: 0.95,
    successRate: 0.97,
    perfectRate: 0.58,
    stardustRate: 0.95,
    abilityUseRate: 0.9,
    crazySuccessRate: 0.16
  })
]);

const ENGAGEMENT_BANDS = Object.freeze([
  Object.freeze({
    id: "light",
    share: 0.35,
    activeRate: 0.36,
    wordWinMean: 1.2,
    baseRuns: 1,
    extraRunRate: 0.05,
    rankRate: 0.25
  }),
  Object.freeze({
    id: "regular",
    share: 0.45,
    activeRate: 0.65,
    wordWinMean: 2,
    baseRuns: 2,
    extraRunRate: 0.1,
    rankRate: 0.55
  }),
  Object.freeze({
    id: "dedicated",
    share: 0.2,
    activeRate: 0.88,
    wordWinMean: 3.3,
    baseRuns: 3,
    extraRunRate: 0.25,
    rankRate: 0.8
  })
]);

function clampInteger(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function validDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : "";
}

function hash32(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = hash32(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function drawPoisson(random, mean, cap = 8) {
  const stop = Math.exp(-mean);
  let product = 1;
  let count = 0;
  while (count < cap && product > stop) {
    product *= random();
    if (product > stop) count += 1;
  }
  return count;
}

function increment(counter, key, amount = 1) {
  counter[key] = (counter[key] || 0) + amount;
}

function boostTotal(boosts) {
  return CIRCUIT_BOOSTS.reduce((sum, boost) => sum + Math.max(0, Number(boosts?.[boost]) || 0), 0);
}

function recordCrazyDailyGrant(crazy, grant) {
  if (!grant?.grantedDays) return;
  crazy.rewards.dailyCreditedDays += grant.grantedDays;
  crazy.rewards.dailyEachIssued += grant.each;
  crazy.rewards.dailyTotalPowers += boostTotal(grant.boosts);
  crazy.stipends.grantEvents += 1;
  if (grant.grantedDays > 1) crazy.stipends.accruedGrantEvents += 1;
  crazy.stipends.maxDaysInOneGrant = Math.max(
    crazy.stipends.maxDaysInOneGrant,
    grant.grantedDays
  );
  crazy.stipends.maxCreditedDaysPerPlan = Math.max(
    crazy.stipends.maxCreditedDaysPerPlan,
    Math.max(0, Number(grant.stipend?.creditedDays) || 0)
  );
}

function percentage(numerator, denominator) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;
}

function average(total, count) {
  return count ? Number((total / count).toFixed(2)) : 0;
}

function percentile(sortedValues, quantile) {
  if (!sortedValues.length) return null;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * quantile) - 1));
  return sortedValues[index];
}

function emptyMilestones() {
  return Object.fromEntries(MILESTONES.map((milestone) => [milestone, 0]));
}

function emptyChallenges() {
  return Object.fromEntries(CHALLENGES.map((challenge) => [challenge, { met: 0, eligible: 0 }]));
}

function emptyBand(skill) {
  return {
    id: skill.id,
    players: 0,
    activeDays: 0,
    wordWins: 0,
    runs: 0,
    completedRuns: 0,
    rewardedRuns: 0,
    score: 0,
    xp: 0,
    potentialXp: 0,
    pathCompletions: 0,
    reachedTiers: Object.fromEntries(
      Array.from({ length: STAR_PATH_TIER_COUNT + 1 }, (_, index) => [index, 0])
    ),
    milestones: emptyMilestones(),
    challenges: emptyChallenges()
  };
}

function skillForPlayer(index, playerCount) {
  const position = (index + 0.5) / playerCount;
  let accumulated = 0;
  for (const band of SKILL_BANDS) {
    accumulated += band.share;
    if (position <= accumulated) return band;
  }
  return SKILL_BANDS.at(-1);
}

function greatestCommonDivisor(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a;
}

function engagementForPlayer(index, playerCount) {
  // The coprime permutation spreads every engagement band across each
  // contiguous skill band instead of treating play frequency as player skill.
  let step = Math.max(1, Math.floor(playerCount * 0.61803398875));
  while (greatestCommonDivisor(step, playerCount) !== 1) step += 1;
  const position = (((index * step) % playerCount) + 0.5) / playerCount;
  let accumulated = 0;
  for (const band of ENGAGEMENT_BANDS) {
    accumulated += band.share;
    if (position <= accumulated) return band;
  }
  return ENGAGEMENT_BANDS.at(-1);
}

function dateAt(startMs, dayIndex) {
  return new Date(startMs + dayIndex * DAY_MS);
}

function runSegmentCount(random, skill, course) {
  if (random() < skill.completionRate) return course.segments.length;
  const minimum = random() < 0.12 ? 0 : 2;
  return Math.min(course.segments.length - 1, minimum + Math.floor(random() * (course.segments.length - minimum)));
}

function simulateTicketedRun({ course, run, random, skill }) {
  const targetSegments = runSegmentCount(random, skill, course);
  const abilities = Object.fromEntries(CIRCUIT_BOOSTS.map((boost) => [boost, 0]));
  let elapsedMs = 0;
  const events = [];

  for (let index = 0; index < targetSegments; index += 1) {
    const segment = course.segments[index];
    const successful = random() < skill.successRate;
    const perfect = successful && random() < skill.perfectRate;
    let outcome = perfect ? "perfect" : successful ? (random() < 0.28 ? "near-miss" : "clear") : "miss";
    let ability = "";
    let useAbility = "";
    if (segment.kind === "ability-gate") {
      const options = Array.isArray(segment.abilityOptions) && segment.abilityOptions.length
        ? segment.abilityOptions
        : CIRCUIT_BOOSTS;
      ability = options[Math.floor(random() * options.length)];
      abilities[ability] += 1;
    }
    const hazardous = segment.kind === "black-hole" || segment.kind === "asteroid-field";
    if (outcome === "miss" && hazardous && random() < skill.abilityUseRate) {
      if (abilities.phase > 0) {
        useAbility = "phase";
        abilities.phase -= 1;
      } else if (abilities.shield > 0) {
        useAbility = "shield";
        abilities.shield -= 1;
      }
    }
    let stardust = 0;
    for (let dust = 0; dust < segment.stardust; dust += 1) if (random() < skill.stardustRate) stardust += 1;
    if (stardust < segment.stardust - 1 && abilities.magnet > 0 && random() < skill.abilityUseRate) {
      useAbility = useAbility || "magnet";
      if (useAbility === "magnet") abilities.magnet -= 1;
    } else if (!useAbility && abilities.timeWarp > 0 && random() < skill.abilityUseRate * 0.18) {
      useAbility = "timeWarp";
      abilities.timeWarp -= 1;
    }
    elapsedMs += Math.max(1, Math.round(segment.durationMs * (0.86 + random() * 0.3)));
    events.push({
      segmentId: segment.id,
      outcome,
      stardust,
      ability,
      useAbility,
      samples: [],
      elapsedMs
    });
  }

  let activeRun = sanitizeCircuitRun({ ...run, events });
  if (!activeRun) throw new Error("Simulator produced an invalid Circuit run.");
  if (activeRun.status !== "finished") {
    const extraction = finishCircuitRun(activeRun, { reason: "extract", elapsedMs });
    const finished = extraction.result?.rewardEligible
      ? extraction
      : finishCircuitRun(activeRun, { reason: "withdraw", elapsedMs });
    if (!finished.finished) throw new Error(`Simulator could not finish a Circuit run: ${finished.reason}`);
    activeRun = finished.run;
  }
  return activeRun;
}

function simulateCrazyRun({ course, run, random, succeeded }) {
  const targetSegments = succeeded
    ? course.segments.length
    : Math.max(1, Math.min(
        course.segments.length - 1,
        1 + Math.floor(random() * (course.segments.length - 1))
      ));
  let elapsedMs = 0;
  const events = course.segments.slice(0, targetSegments).map((segment, index) => {
    elapsedMs += segment.durationMs;
    return {
      segmentId: segment.id,
      outcome: !succeeded && index === targetSegments - 1 && segment.required ? "miss" : "perfect",
      stardust: segment.stardust,
      ability: segment.kind === "ability-gate" ? CIRCUIT_BOOSTS[0] : "",
      useAbility: "",
      samples: [],
      elapsedMs
    };
  });
  let completed = sanitizeCircuitRun({ ...run, events });
  if (!completed) throw new Error("Simulator produced an invalid Crazy Path run.");
  if (completed.status !== "finished") {
    const failed = finishCircuitRun(completed, { reason: "crash", elapsedMs });
    if (!failed.finished) throw new Error(`Simulator could not settle a failed Crazy Path: ${failed.reason}`);
    completed = failed.run;
  }
  if (Boolean(completed.result?.rewardEligible) !== succeeded) {
    throw new Error("Crazy Path success simulation diverged from the shipped all-or-nothing rules.");
  }
  return completed;
}

function recordChallenges(target, metrics) {
  const results = {
    planetSequence: metrics.planetGatesPassed === 8,
    blackHoleTunnels: metrics.blackHolesCleared >= 2,
    perfectSlingshots: metrics.perfectSlingshots >= 2,
    stardustTrail: metrics.stardustPercent >= 80,
    shieldIntact: metrics.shieldIntact,
    allGoals: metrics.cosmosComplete
  };
  for (const [name, met] of Object.entries(results)) {
    target[name].eligible += 1;
    if (met) target[name].met += 1;
  }
}

function finalizeChallenges(challenges) {
  return Object.fromEntries(Object.entries(challenges).map(([name, result]) => [name, {
    met: result.met,
    eligible: result.eligible,
    ratePercent: percentage(result.met, result.eligible)
  }]));
}

function finalizeBand(band) {
  const tierValues = Object.entries(band.reachedTiers)
    .flatMap(([tier, count]) => Array.from({ length: count }, () => Number(tier)))
    .sort((left, right) => left - right);
  return {
    players: band.players,
    activeDays: band.activeDays,
    wordWins: band.wordWins,
    ticketedRuns: band.runs,
    completedRuns: band.completedRuns,
    completionRatePercent: percentage(band.completedRuns, band.runs),
    rewardedRuns: band.rewardedRuns,
    rewardRatePercent: percentage(band.rewardedRuns, band.runs),
    cosmosRatePercent: percentage(band.milestones.cosmos, band.runs),
    averageScore: average(band.score, band.runs),
    creditedXp: band.xp,
    potentialXp: band.potentialXp,
    cappedXp: Math.max(0, band.potentialXp - band.xp),
    averageXpPerPlayer: average(band.xp, band.players),
    averageProgressPercent: percentage(band.xp, band.players * STAR_PATH_MAX_XP),
    pathCompletions: band.pathCompletions,
    pathCompletionRatePercent: percentage(band.pathCompletions, band.players),
    medianReachedTier: percentile(tierValues, 0.5),
    reachedTierDistribution: { ...band.reachedTiers },
    milestoneDistribution: { ...band.milestones },
    challengeDistribution: finalizeChallenges(band.challenges)
  };
}

function guardrailCheck(id, passed, actual, expectation) {
  return { id, passed: Boolean(passed), actual, expectation };
}

export function evaluateBalanceGuardrails(report, rules = DEFAULT_BALANCE_GUARDRAILS) {
  rules = { ...DEFAULT_BALANCE_GUARDRAILS, ...(rules || {}) };
  const bands = report.skillBands;
  const checks = [
    guardrailCheck(
      "sample_size",
      report.runs.ticketed.started >= rules.minimumTicketedRuns,
      report.runs.ticketed.started,
      `at least ${rules.minimumTicketedRuns} ticketed runs`
    ),
    guardrailCheck(
      "reward_tier_reachability",
      report.reachability.shippingRuntime.drift
        && report.reachability.shippingRuntime.orbit
        && report.reachability.shippingRuntime.nebula
        && report.reachability.shippingRuntime.galaxy
        && report.reachability.shippingRuntime.cosmos,
      report.reachability.shippingRuntime,
      "every advertised Circuit reward tier has a shipped terminal path"
    ),
    guardrailCheck(
      "reward_access",
      report.runs.ticketed.rewardRatePercent >= rules.minimumRewardRatePercent
        && report.runs.ticketed.rewardRatePercent <= rules.maximumRewardRatePercent,
      report.runs.ticketed.rewardRatePercent,
      `${rules.minimumRewardRatePercent}-${rules.maximumRewardRatePercent}% of ticketed runs earn a disclosed reward tier`
    ),
    guardrailCheck(
      "cosmos_rarity",
      report.runs.ticketed.cosmosRatePercent >= rules.minimumCosmosRatePercent
        && report.runs.ticketed.cosmosRatePercent <= rules.maximumCosmosRatePercent,
      report.runs.ticketed.cosmosRatePercent,
      `${rules.minimumCosmosRatePercent}-${rules.maximumCosmosRatePercent}% Cosmos outcomes`
    ),
    guardrailCheck(
      "novice_viability",
      bands.novice.rewardRatePercent >= rules.minimumNoviceRewardRatePercent,
      bands.novice.rewardRatePercent,
      `at least ${rules.minimumNoviceRewardRatePercent}% novice reward access`
    ),
    guardrailCheck(
      "skill_ordering",
      bands.novice.averageScore < bands.regular.averageScore
        && bands.regular.averageScore < bands.expert.averageScore
        && bands.novice.cosmosRatePercent < bands.regular.cosmosRatePercent
        && bands.regular.cosmosRatePercent < bands.expert.cosmosRatePercent,
      {
        averageScore: [bands.novice.averageScore, bands.regular.averageScore, bands.expert.averageScore],
        cosmosRatePercent: [bands.novice.cosmosRatePercent, bands.regular.cosmosRatePercent, bands.expert.cosmosRatePercent]
      },
      "novice < regular < expert for average score and Cosmos rate"
    ),
    guardrailCheck(
      "expert_not_guaranteed",
      bands.expert.cosmosRatePercent <= rules.maximumExpertCosmosRatePercent,
      bands.expert.cosmosRatePercent,
      `no more than ${rules.maximumExpertCosmosRatePercent}% expert Cosmos outcomes`
    ),
    guardrailCheck(
      "pass_utilization",
      report.passes.utilizationRatePercent >= rules.minimumPassUtilizationPercent
        && report.passes.utilizationRatePercent <= rules.maximumPassUtilizationPercent,
      report.passes.utilizationRatePercent,
      `${rules.minimumPassUtilizationPercent}-${rules.maximumPassUtilizationPercent}% of actually granted passes spent`
    ),
    guardrailCheck(
      "pass_conservation",
      report.passes.conservationDelta === 0,
      report.passes.conservationDelta,
      "granted passes equal spent plus ending passes"
    ),
    guardrailCheck(
      "star_path_pacing",
      report.starPath.completionRatePercent >= rules.minimumPathCompletionPercent
        && report.starPath.completionRatePercent <= rules.maximumPathCompletionPercent,
      report.starPath.completionRatePercent,
      `${rules.minimumPathCompletionPercent}-${rules.maximumPathCompletionPercent}% season completion`
    ),
    guardrailCheck(
      "star_path_engagement_pacing",
      report.engagementBands.light.pathCompletionRatePercent >= rules.minimumLightPathCompletionPercent
        && report.engagementBands.light.pathCompletionRatePercent <= rules.maximumLightPathCompletionPercent
        && report.engagementBands.light.averageProgressPercent >= rules.minimumLightAverageProgressPercent
        && report.engagementBands.light.averageProgressPercent <= rules.maximumLightAverageProgressPercent
        && report.engagementBands.light.medianReachedTier >= rules.minimumLightMedianTier
        && report.engagementBands.light.medianReachedTier <= rules.maximumLightMedianTier
        && report.engagementBands.regular.pathCompletionRatePercent >= rules.minimumRegularPathCompletionPercent
        && report.engagementBands.regular.pathCompletionRatePercent <= rules.maximumRegularPathCompletionPercent
        && report.engagementBands.dedicated.pathCompletionRatePercent >= rules.minimumDedicatedPathCompletionPercent
        && report.engagementBands.dedicated.pathCompletionRatePercent <= rules.maximumDedicatedPathCompletionPercent,
      {
        lightCompletion: report.engagementBands.light.pathCompletionRatePercent,
        lightAverageProgress: report.engagementBands.light.averageProgressPercent,
        lightMedianTier: report.engagementBands.light.medianReachedTier,
        regular: report.engagementBands.regular.pathCompletionRatePercent,
        dedicated: report.engagementBands.dedicated.pathCompletionRatePercent
      },
      `light completion ${rules.minimumLightPathCompletionPercent}-${rules.maximumLightPathCompletionPercent}% with ${rules.minimumLightAverageProgressPercent}-${rules.maximumLightAverageProgressPercent}% average progress and median tier ${rules.minimumLightMedianTier}-${rules.maximumLightMedianTier}; regular ${rules.minimumRegularPathCompletionPercent}-${rules.maximumRegularPathCompletionPercent}%; dedicated ${rules.minimumDedicatedPathCompletionPercent}-${rules.maximumDedicatedPathCompletionPercent}%`
    ),
    guardrailCheck(
      "star_path_completion_timing",
      report.starPath.completionDayP50 !== null
        && report.starPath.completionDayP50 >= rules.earliestAcceptableMedianCompletionDay
        && report.starPath.completionDayP50 <= rules.latestAcceptableMedianCompletionDay
        && report.starPath.completionDayP90 !== null
        && report.starPath.completionDayP90 >= rules.earliestAcceptableP90CompletionDay
        && report.starPath.completionDayP90 <= rules.latestAcceptableP90CompletionDay,
      {
        p50: report.starPath.completionDayP50,
        p90: report.starPath.completionDayP90
      },
      `completion day P50 ${rules.earliestAcceptableMedianCompletionDay}-${rules.latestAcceptableMedianCompletionDay} and P90 ${rules.earliestAcceptableP90CompletionDay}-${rules.latestAcceptableP90CompletionDay}`
    ),
    guardrailCheck(
      "crazy_path_entry_cost",
      report.crazyPath.accounting.entryCostDelta === rules.maximumCrazyEntryCostDelta,
      report.crazyPath.accounting,
      `every Crazy Path start consumes exactly ${CRAZY_PATH_ENTRY_PASSES} earned passes`
    ),
    guardrailCheck(
      "crazy_path_eligibility",
      report.crazyPath.eligibility.sameWeekQualificationViolations
          + report.crazyPath.eligibility.weeklyAttemptViolations
          + report.crazyPath.eligibility.ineligibleStarts
        <= rules.maximumCrazyEligibilityViolations,
      report.crazyPath.eligibility,
      "starts require a same-week Cosmos and no prior attempt in that UTC week"
    ),
    guardrailCheck(
      "crazy_path_failure_zero_reward",
      report.crazyPath.rewards.failedRunsRewarded <= rules.maximumCrazyFailureRewards
        && report.crazyPath.rewards.failedStarPathXp === 0,
      {
        failedRunsRewarded: report.crazyPath.rewards.failedRunsRewarded,
        failedStarPathXp: report.crazyPath.rewards.failedStarPathXp
      },
      "failed Crazy Path runs issue no powers or Star Path XP"
    ),
    guardrailCheck(
      "crazy_path_reward_conservation",
      report.crazyPath.rewards.issuanceDelta === rules.maximumCrazyRewardIssuanceDelta
        && report.crazyPath.rewards.successfulClaims === report.crazyPath.attempts.succeeded,
      report.crazyPath.rewards,
      "instant and accrued daily powers equal the exact disclosed grants"
    ),
    guardrailCheck(
      "crazy_path_stipend_bounds",
      report.crazyPath.stipends.maxCreditedDaysPerPlan <= CRAZY_PATH_DAILY_DAYS
        && report.crazyPath.rewards.dailyEachIssued
          === report.crazyPath.rewards.dailyCreditedDays * CRAZY_PATH_DAILY_POWERS
        && report.crazyPath.stipends.dayConservationDelta === 0,
      {
        maxCreditedDaysPerPlan: report.crazyPath.stipends.maxCreditedDaysPerPlan,
        dailyCreditedDays: report.crazyPath.rewards.dailyCreditedDays,
        dailyEachIssued: report.crazyPath.rewards.dailyEachIssued,
        outstandingDaysAtEnd: report.crazyPath.stipends.outstandingDaysAtEnd,
        dayConservationDelta: report.crazyPath.stipends.dayConservationDelta
      },
      `daily plans accrue ${CRAZY_PATH_DAILY_POWERS} of each power for at most ${CRAZY_PATH_DAILY_DAYS} UTC days`
    ),
    guardrailCheck(
      "crazy_path_victory_cooldown",
      report.crazyPath.eligibility.cooldownViolations <= rules.maximumCrazyCooldownViolations
        && report.crazyPath.attempts.maxSuccessesPerPlayer
          <= report.crazyPath.contract.maximumSuccessesPerPlayer,
      {
        cooldownViolations: report.crazyPath.eligibility.cooldownViolations,
        maxSuccessesPerPlayer: report.crazyPath.attempts.maxSuccessesPerPlayer
      },
      `${CRAZY_PATH_DAILY_DAYS}-day victory cooldown remains intact`
    )
  ];
  return {
    passed: checks.every((check) => check.passed),
    failed: checks.filter((check) => !check.passed).map((check) => check.id),
    checks
  };
}

export function runBalanceSimulation(options = {}) {
  const seed = String(options.seed ?? DEFAULT_BALANCE_OPTIONS.seed).slice(0, 128) || DEFAULT_BALANCE_OPTIONS.seed;
  const startDay = validDay(options.startDay) || DEFAULT_BALANCE_OPTIONS.startDay;
  const days = clampInteger(options.days, 1, 366, DEFAULT_BALANCE_OPTIONS.days);
  const players = clampInteger(options.players, 1, 10_000, DEFAULT_BALANCE_OPTIONS.players);
  const startMs = Date.parse(`${startDay}T00:00:00.000Z`);
  const milestones = emptyMilestones();
  const challenges = emptyChallenges();
  const skillBands = Object.fromEntries(SKILL_BANDS.map((skill) => [skill.id, emptyBand(skill)]));
  const engagementBands = Object.fromEntries(ENGAGEMENT_BANDS.map((engagement) => [engagement.id, emptyBand(engagement)]));
  const cohortMatrix = Object.fromEntries(SKILL_BANDS.map((skill) => [
    skill.id,
    Object.fromEntries(ENGAGEMENT_BANDS.map((engagement) => [engagement.id, 0]))
  ]));
  const weeklyCircuits = {};
  const endingPasses = Object.fromEntries(Array.from({ length: MAX_LAUNCH_PASSES + 1 }, (_, index) => [index, 0]));
  const pathTiers = Object.fromEntries(Array.from({ length: STAR_PATH_TIER_COUNT + 1 }, (_, index) => [index, 0]));
  const passes = {
    granted: { daily: 0, pureWins: 0, rankUps: 0 },
    blockedByCap: { daily: 0, pureWins: 0, rankUps: 0 },
    spent: 0,
    unmetDemand: 0,
    ending: 0,
    pendingPureWinBonuses: 0
  };
  const runs = {
    started: 0,
    completed: 0,
    rewarded: 0,
    claimed: 0,
    score: 0,
    durationMs: 0
  };
  const crazy = {
    eligibility: {
      checks: 0,
      qualifiedChecks: 0,
      eligibleChecks: 0,
      blockedReasons: {},
      sameWeekQualificationViolations: 0,
      weeklyAttemptViolations: 0,
      cooldownViolations: 0,
      ineligibleStarts: 0
    },
    attempts: {
      started: 0,
      succeeded: 0,
      failed: 0,
      passesSpent: 0,
      bySkill: Object.fromEntries(SKILL_BANDS.map((skill) => [
        skill.id,
        { started: 0, succeeded: 0, failed: 0 }
      ])),
      maxSuccessesPerPlayer: 0
    },
    rewards: {
      choices: { instant: 0, daily: 0 },
      successfulClaims: 0,
      failedClaims: 0,
      failedRunsRewarded: 0,
      failedStarPathXp: 0,
      starPathXpIssued: 0,
      instantEachIssued: 0,
      instantTotalPowers: 0,
      dailyCreditedDays: 0,
      dailyEachIssued: 0,
      dailyTotalPowers: 0
    },
    stipends: {
      plansStarted: 0,
      grantEvents: 0,
      accruedGrantEvents: 0,
      maxDaysInOneGrant: 0,
      maxCreditedDaysPerPlan: 0,
      outstandingDaysAtEnd: 0,
      activePlansAtEnd: 0
    }
  };
  const payoutTiers = emptyMilestones();
  const xp = {
    credited: { wordWins: 0, circuit: 0, weeklyCatchUp: 0 },
    potential: { wordWins: 0, circuit: 0, weeklyCatchUp: 0 }
  };
  const completionDays = [];
  let repeatCosmosDowngrades = 0;
  let activePlayerDays = 0;

  for (let playerIndex = 0; playerIndex < players; playerIndex += 1) {
    const skill = skillForPlayer(playerIndex, players);
    const engagement = engagementForPlayer(playerIndex, players);
    const band = skillBands[skill.id];
    const engagementBand = engagementBands[engagement.id];
    const cohorts = [band, engagementBand];
    const random = createRandom(`${seed}:player:${playerIndex}`);
    const crazyRandom = createRandom(`${seed}:crazy:player:${playerIndex}`);
    let wallet = sanitizeCircuitWallet();
    let claims = sanitizeCircuitClaims();
    let crazyStipend = sanitizeCrazyPathStipend();
    let starPath = sanitizeStarPathState({}, new Date(startMs));
    let completionDay = null;
    let crazySuccesses = 0;
    const crazyAttemptWeeks = new Set();
    for (const cohort of cohorts) cohort.players += 1;
    cohortMatrix[skill.id][engagement.id] += 1;

    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
      const at = dateAt(startMs, dayIndex);
      const dayKey = at.toISOString().slice(0, 10);
      if (random() >= engagement.activeRate) continue;
      activePlayerDays += 1;
      for (const cohort of cohorts) cohort.activeDays += 1;
      const course = cosmosCircuitCourse(dayKey);
      increment(weeklyCircuits, course.weekKey);

      const accruedCrazyGrant = grantCrazyPathDailyPowers(crazyStipend, at);
      crazyStipend = accruedCrazyGrant.stipend;
      recordCrazyDailyGrant(crazy, accruedCrazyGrant);

      const dailyGrant = grantDailyLaunchPasses(wallet, at);
      wallet = dailyGrant.wallet;
      passes.granted.daily += dailyGrant.granted;
      passes.blockedByCap.daily += 3 - dailyGrant.granted;

      const wordWins = drawPoisson(random, engagement.wordWinMean, 7);
      for (let winIndex = 0; winIndex < wordWins; winIndex += 1) {
        const winId = `p${playerIndex}-d${dayIndex}-w${winIndex}`;
        const winGrant = recordEligiblePureWin(wallet, {
          winId,
          mode: "pure",
          won: true,
          assisted: false,
          verified: true,
          at
        });
        wallet = winGrant.wallet;
        if (winGrant.granted) passes.granted.pureWins += winGrant.granted;
        if (winGrant.reason === "bonus_pending") passes.blockedByCap.pureWins += 1;
        const progress = recordStarPathProgress(starPath, {
          type: "word_win",
          resultId: winId,
          verified: true,
          won: true,
          mode: "quick",
          division: "pure"
        }, at);
        starPath = progress.state;
        xp.potential.wordWins += progress.baseXpPotential;
        xp.potential.weeklyCatchUp += progress.weeklyBonusXpPotential;
        xp.credited.wordWins += progress.baseXpAwarded;
        xp.credited.weeklyCatchUp += progress.weeklyBonusXpAwarded;
        for (const cohort of cohorts) {
          cohort.xp += progress.xpAwarded;
          cohort.potentialXp += progress.baseXpPotential + progress.weeklyBonusXpPotential;
          cohort.wordWins += 1;
        }
        if (completionDay === null && starPath.xp >= STAR_PATH_MAX_XP) completionDay = dayIndex + 1;
      }

      if ((dayIndex + 1) % 14 === 0 && random() < engagement.rankRate) {
        const rankGrant = grantRankLaunchPass(wallet, {
          rankId: `p${playerIndex}-rank-${Math.floor((dayIndex + 1) / 14)}`,
          verified: true
        });
        wallet = rankGrant.wallet;
        passes.granted.rankUps += rankGrant.granted;
        if (rankGrant.reason === "wallet_full") passes.blockedByCap.rankUps += 1;
      }

      const desiredRuns = engagement.baseRuns + (random() < engagement.extraRunRate ? 1 : 0);
      for (let runIndex = 0; runIndex < desiredRuns; runIndex += 1) {
        const runId = `p${playerIndex}-d${dayIndex}-r${runIndex}`;
        const started = startCircuitRun({
          course,
          mode: "ticketed",
          wallet,
          runId,
          at
        });
        wallet = started.wallet;
        if (!started.started) {
          passes.unmetDemand += 1;
          continue;
        }
        if (started.redeemedPending) {
          passes.granted.pureWins += started.redeemedPending;
        }
        const postStartDailyGrant = grantDailyLaunchPasses(wallet, at);
        wallet = postStartDailyGrant.wallet;
        if (postStartDailyGrant.granted) {
          passes.granted.daily += postStartDailyGrant.granted;
          passes.blockedByCap.daily = Math.max(
            0,
            passes.blockedByCap.daily - postStartDailyGrant.granted
          );
        }
        passes.spent += started.consumed;
        runs.started += 1;
        for (const cohort of cohorts) cohort.runs += 1;

        const finishedRun = simulateTicketedRun({ course, run: started.run, random, skill });
        const result = finishedRun.result;
        const metrics = finishedRun.metrics;
        increment(milestones, result.milestone);
        for (const cohort of cohorts) increment(cohort.milestones, result.milestone);
        runs.score += metrics.score;
        runs.durationMs += finishedRun.end?.elapsedMs || 0;
        for (const cohort of cohorts) cohort.score += metrics.score;
        recordChallenges(challenges, metrics);
        for (const cohort of cohorts) recordChallenges(cohort.challenges, metrics);
        if (metrics.completedCourse) {
          runs.completed += 1;
          for (const cohort of cohorts) cohort.completedRuns += 1;
        }
        if (!result.rewardEligible) continue;
        runs.rewarded += 1;
        for (const cohort of cohorts) cohort.rewardedRuns += 1;

        const claim = claimCircuitReward(claims, finishedRun, {
          chosenBoost: "shield",
          verified: true
        });
        claims = claim.claims;
        if (!claim.claimed) throw new Error(`Simulator could not claim a disclosed Circuit reward: ${claim.reason}`);
        runs.claimed += 1;
        increment(payoutTiers, claim.grant.tier);
        if (result.milestone === "cosmos" && claim.grant.tier === "galaxy") repeatCosmosDowngrades += 1;
        const potentialCircuitXp = STAR_PATH_XP_RULES.cosmosCircuit.milestones[claim.grant.tier] || 0;
        const pathProgress = recordStarPathProgress(starPath, {
          type: "cosmos_circuit",
          runId,
          verified: true,
          rewardEligible: true,
          milestone: claim.grant.tier
        }, at);
        starPath = pathProgress.state;
        xp.potential.circuit += pathProgress.baseXpPotential;
        xp.potential.weeklyCatchUp += pathProgress.weeklyBonusXpPotential;
        xp.credited.circuit += pathProgress.baseXpAwarded;
        xp.credited.weeklyCatchUp += pathProgress.weeklyBonusXpAwarded;
        for (const cohort of cohorts) {
          cohort.xp += pathProgress.xpAwarded;
          cohort.potentialXp += pathProgress.baseXpPotential + pathProgress.weeklyBonusXpPotential;
        }
        if (completionDay === null && starPath.xp >= STAR_PATH_MAX_XP) completionDay = dayIndex + 1;
      }

      const crazyEligibility = crazyPathEligibility(wallet, claims, crazyStipend, at);
      crazy.eligibility.checks += 1;
      if (crazyEligibility.qualified) crazy.eligibility.qualifiedChecks += 1;
      if (crazyEligibility.eligible) {
        crazy.eligibility.eligibleChecks += 1;
        const crazyCourse = cosmosCircuitCrazyCourse(dayKey);
        const qualifiedBeforeStart = claims.cosmosWeekKeys.includes(crazyCourse.weekKey);
        const attemptedBeforeStart = crazyAttemptWeeks.has(crazyCourse.weekKey);
        const coolingDownBeforeStart = Boolean(
          claims.crazyCooldownUntilDay && dayKey < claims.crazyCooldownUntilDay
        );
        const crazyRunId = `p${playerIndex}-d${dayIndex}-crazy`;
        const startedCrazy = startCircuitRun({
          course: crazyCourse,
          mode: "ticketed",
          path: "crazy",
          wallet,
          claims,
          crazyStipend,
          runId: crazyRunId,
          at
        });
        if (!startedCrazy.started) {
          crazy.eligibility.ineligibleStarts += 1;
        } else {
          if (!qualifiedBeforeStart) crazy.eligibility.sameWeekQualificationViolations += 1;
          if (attemptedBeforeStart) crazy.eligibility.weeklyAttemptViolations += 1;
          if (coolingDownBeforeStart) crazy.eligibility.cooldownViolations += 1;
          crazyAttemptWeeks.add(crazyCourse.weekKey);
          wallet = startedCrazy.wallet;
          claims = startedCrazy.claims;
          if (startedCrazy.redeemedPending) {
            passes.granted.pureWins += startedCrazy.redeemedPending;
          }
          const postCrazyDailyGrant = grantDailyLaunchPasses(wallet, at);
          wallet = postCrazyDailyGrant.wallet;
          if (postCrazyDailyGrant.granted) {
            passes.granted.daily += postCrazyDailyGrant.granted;
            passes.blockedByCap.daily = Math.max(
              0,
              passes.blockedByCap.daily - postCrazyDailyGrant.granted
            );
          }
          passes.spent += startedCrazy.consumed;
          crazy.attempts.started += 1;
          crazy.attempts.passesSpent += startedCrazy.consumed;
          crazy.attempts.bySkill[skill.id].started += 1;

          const succeeded = crazyRandom() < skill.crazySuccessRate;
          const finishedCrazy = simulateCrazyRun({
            course: crazyCourse,
            run: startedCrazy.run,
            random: crazyRandom,
            succeeded
          });
          const rewardChoice = crazyRandom() < 0.5 ? "instant" : "daily";
          const crazyClaim = claimCircuitReward(claims, finishedCrazy, {
            crazyRewardChoice: rewardChoice,
            verified: true,
            at
          });
          claims = crazyClaim.claims;
          if (!succeeded) {
            crazy.attempts.failed += 1;
            crazy.attempts.bySkill[skill.id].failed += 1;
            crazy.rewards.failedClaims += 1;
            crazy.rewards.failedStarPathXp += Math.max(0, Number(crazyClaim.grant?.starPathXp) || 0);
            if (crazyClaim.claimed || crazyClaim.grant || boostTotal(crazyClaim.grant?.boosts)) {
              crazy.rewards.failedRunsRewarded += 1;
            }
          } else {
            if (!crazyClaim.claimed || !crazyClaim.grant) {
              throw new Error(`Simulator could not claim a successful Crazy Path: ${crazyClaim.reason}`);
            }
            crazy.attempts.succeeded += 1;
            crazy.attempts.bySkill[skill.id].succeeded += 1;
            crazy.rewards.successfulClaims += 1;
            crazy.rewards.choices[rewardChoice] += 1;
            crazy.rewards.starPathXpIssued += Math.max(0, Number(crazyClaim.grant.starPathXp) || 0);
            crazySuccesses += 1;
            crazyStipend = crazyClaim.grant.stipend;
            if (rewardChoice === "instant") {
              crazy.rewards.instantEachIssued += CRAZY_PATH_INSTANT_POWERS;
              crazy.rewards.instantTotalPowers += boostTotal(crazyClaim.grant.boosts);
            } else {
              crazy.stipends.plansStarted += 1;
              const firstCrazyDailyGrant = grantCrazyPathDailyPowers(crazyStipend, at);
              crazyStipend = firstCrazyDailyGrant.stipend;
              recordCrazyDailyGrant(crazy, firstCrazyDailyGrant);
            }
          }
        }
      } else {
        increment(crazy.eligibility.blockedReasons, crazyEligibility.reason);
      }
    }

    const finalProgress = starPathProgress(starPath, dateAt(startMs, Math.max(0, days - 1)));
    increment(pathTiers, finalProgress.reachedTier);
    for (const cohort of cohorts) increment(cohort.reachedTiers, finalProgress.reachedTier);
    if (finalProgress.complete) {
      for (const cohort of cohorts) cohort.pathCompletions += 1;
      if (completionDay !== null) completionDays.push(completionDay);
    }
    endingPasses[wallet.passes] += 1;
    passes.ending += wallet.passes;
    if (wallet.dailyPure.pending) passes.pendingPureWinBonuses += 1;
    crazy.attempts.maxSuccessesPerPlayer = Math.max(
      crazy.attempts.maxSuccessesPerPlayer,
      crazySuccesses
    );
    if (crazyStipend.runId) {
      crazy.stipends.maxCreditedDaysPerPlan = Math.max(
        crazy.stipends.maxCreditedDaysPerPlan,
        crazyStipend.creditedDays
      );
      const outstanding = Math.max(0, CRAZY_PATH_DAILY_DAYS - crazyStipend.creditedDays);
      crazy.stipends.outstandingDaysAtEnd += outstanding;
      if (outstanding) crazy.stipends.activePlansAtEnd += 1;
    }
  }

  const totalGranted = Object.values(passes.granted).reduce((sum, count) => sum + count, 0);
  const completedPaths = pathTiers[STAR_PATH_TIER_COUNT] || 0;
  completionDays.sort((left, right) => left - right);
  const endDay = dateAt(startMs, days - 1).toISOString().slice(0, 10);
  const crazyExpectedEntryPasses = crazy.attempts.started * CRAZY_PATH_ENTRY_PASSES;
  const crazyExpectedTotalPowers = (
    crazy.rewards.choices.instant * CRAZY_PATH_INSTANT_POWERS
    + crazy.rewards.dailyCreditedDays * CRAZY_PATH_DAILY_POWERS
  ) * CIRCUIT_BOOSTS.length;
  const crazyTotalPowersIssued = crazy.rewards.instantTotalPowers + crazy.rewards.dailyTotalPowers;
  const crazyCommittedStipendDays = crazy.stipends.plansStarted * CRAZY_PATH_DAILY_DAYS;
  const crazyStipends = {
    ...crazy.stipends,
    committedDays: crazyCommittedStipendDays,
    dayConservationDelta: crazyCommittedStipendDays
      - crazy.rewards.dailyCreditedDays
      - crazy.stipends.outstandingDaysAtEnd,
    outstandingPowersAtEnd: crazy.stipends.outstandingDaysAtEnd
      * CRAZY_PATH_DAILY_POWERS
      * CIRCUIT_BOOSTS.length
  };
  const crazyBySkill = Object.fromEntries(Object.entries(crazy.attempts.bySkill)
    .map(([id, band]) => [id, {
      ...band,
      successRatePercent: percentage(band.succeeded, band.started)
    }]));
  const crazyPath = {
    contract: {
      entryPasses: CRAZY_PATH_ENTRY_PASSES,
      qualification: "same-week-cosmos",
      attemptCadence: "one-per-utc-week",
      successCooldownDays: CRAZY_PATH_DAILY_DAYS,
      instantEach: CRAZY_PATH_INSTANT_POWERS,
      dailyEach: CRAZY_PATH_DAILY_POWERS,
      dailyDays: CRAZY_PATH_DAILY_DAYS,
      failureReward: 0,
      maximumSuccessesPerPlayer: Math.ceil(days / CRAZY_PATH_DAILY_DAYS)
    },
    eligibility: { ...crazy.eligibility },
    attempts: {
      ...crazy.attempts,
      bySkill: crazyBySkill,
      successRatePercent: percentage(crazy.attempts.succeeded, crazy.attempts.started)
    },
    accounting: {
      entryPassesSpent: crazy.attempts.passesSpent,
      expectedEntryPassesSpent: crazyExpectedEntryPasses,
      entryCostDelta: crazy.attempts.passesSpent - crazyExpectedEntryPasses
    },
    rewards: {
      ...crazy.rewards,
      totalPowersIssued: crazyTotalPowersIssued,
      expectedTotalPowers: crazyExpectedTotalPowers,
      issuanceDelta: crazyTotalPowersIssued - crazyExpectedTotalPowers
    },
    stipends: crazyStipends
  };
  const report = {
    schemaVersion: 1,
    deterministic: true,
    privacy: "aggregate-only simulation; no per-player records or raw trajectories",
    parameters: { seed, startDay, endDay, days, players },
    population: {
      players,
      activePlayerDays,
      activeRatePercent: percentage(activePlayerDays, players * days),
      skillBandPlayers: Object.fromEntries(Object.entries(skillBands).map(([id, band]) => [id, band.players])),
      engagementBandPlayers: Object.fromEntries(Object.entries(engagementBands).map(([id, band]) => [id, band.players])),
      skillByEngagement: cohortMatrix
    },
    productionSnapshot: {
      dailyLaunchPasses: 3,
      maximumLaunchPasses: MAX_LAUNCH_PASSES,
      starPathMaxXp: STAR_PATH_MAX_XP,
      starPathDailyBaseXpCap: STAR_PATH_XP_RULES.dailyBaseXpCap,
      starPathWeeklyParticipationBonus: STAR_PATH_XP_RULES.weeklyParticipationBonus.xp,
      crazyPath: { ...crazyPath.contract },
      eventsToCompleteStarPath: {
        wordWins: Math.ceil(STAR_PATH_MAX_XP / STAR_PATH_XP_RULES.wordWin.xp),
        galaxyFlights: Math.ceil(STAR_PATH_MAX_XP / STAR_PATH_XP_RULES.cosmosCircuit.milestones.galaxy),
        cosmosFlights: Math.ceil(STAR_PATH_MAX_XP / STAR_PATH_XP_RULES.cosmosCircuit.milestones.cosmos)
      }
    },
    reachability: {
      domain: { drift: true, orbit: true, nebula: true, galaxy: true, cosmos: true },
      shippingRuntime: { drift: true, orbit: true, nebula: true, galaxy: true, cosmos: true },
      crazyPath: true,
      shippingTerminalReasons: ["finish", "extract", "withdraw"],
      note: "Ticketed flights may bank an exact disclosed milestone after checkpoint 5; withdrawal remains reward-free."
    },
    courses: {
      uniqueDailyCourses: days,
      sampledActiveCourseDays: Object.values(weeklyCircuits).reduce((sum, count) => sum + count, 0),
      weeklyCircuitDistribution: weeklyCircuits
    },
    runs: {
      ticketed: {
        started: runs.started,
        completed: runs.completed,
        completionRatePercent: percentage(runs.completed, runs.started),
        rewarded: runs.rewarded,
        rewardRatePercent: percentage(runs.rewarded, runs.started),
        claimed: runs.claimed,
        cosmosRatePercent: percentage(milestones.cosmos, runs.started),
        averageScore: average(runs.score, runs.started),
        averageDurationMs: average(runs.durationMs, runs.started)
      },
      milestoneDistribution: milestones,
      payoutTierDistribution: payoutTiers,
      repeatCosmosPayoutDowngrades: repeatCosmosDowngrades
    },
    passes: {
      granted: passes.granted,
      totalGranted,
      blockedByCap: passes.blockedByCap,
      spent: passes.spent,
      spentByMode: {
        standard: runs.started,
        crazy: crazy.attempts.passesSpent
      },
      utilizationRatePercent: percentage(passes.spent, totalGranted),
      unmetRunDemand: passes.unmetDemand,
      endingTotal: passes.ending,
      endingAveragePerPlayer: average(passes.ending, players),
      endingDistribution: endingPasses,
      pendingPureWinBonuses: passes.pendingPureWinBonuses,
      conservationDelta: totalGranted - passes.spent - passes.ending
    },
    starPath: {
      maxXp: STAR_PATH_MAX_XP,
      creditedXp: {
        wordWins: xp.credited.wordWins,
        cosmosCircuit: xp.credited.circuit,
        weeklyCatchUp: xp.credited.weeklyCatchUp,
        total: xp.credited.wordWins + xp.credited.circuit + xp.credited.weeklyCatchUp
      },
      potentialXp: {
        wordWins: xp.potential.wordWins,
        cosmosCircuit: xp.potential.circuit,
        weeklyCatchUp: xp.potential.weeklyCatchUp,
        total: xp.potential.wordWins + xp.potential.circuit + xp.potential.weeklyCatchUp
      },
      cappedXp: (xp.potential.wordWins + xp.potential.circuit + xp.potential.weeklyCatchUp)
        - (xp.credited.wordWins + xp.credited.circuit + xp.credited.weeklyCatchUp),
      averageXpPerPlayer: average(
        xp.credited.wordWins + xp.credited.circuit + xp.credited.weeklyCatchUp,
        players
      ),
      reachedTierDistribution: pathTiers,
      completedPlayers: completedPaths,
      completionRatePercent: percentage(completedPaths, players),
      completionDayP10: percentile(completionDays, 0.1),
      completionDayP50: percentile(completionDays, 0.5),
      completionDayP90: percentile(completionDays, 0.9)
    },
    crazyPath,
    challenges: finalizeChallenges(challenges),
    skillBands: Object.fromEntries(Object.entries(skillBands).map(([id, band]) => [id, finalizeBand(band)])),
    engagementBands: Object.fromEntries(Object.entries(engagementBands).map(([id, band]) => [id, finalizeBand(band)]))
  };
  report.guardrails = evaluateBalanceGuardrails(report, options.guardrails || DEFAULT_BALANCE_GUARDRAILS);
  return report;
}

function parseCliArguments(argv) {
  const options = {};
  let json = false;
  const takeValue = (argument, index) => {
    const equals = argument.indexOf("=");
    if (equals >= 0) return { value: argument.slice(equals + 1), nextIndex: index };
    if (index + 1 >= argv.length) throw new Error(`Missing value for ${argument}`);
    return { value: argv[index + 1], nextIndex: index + 1 };
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      json = true;
      continue;
    }
    const name = argument.split("=")[0];
    if (!["--seed", "--start-day", "--days", "--players"].includes(name)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const parsed = takeValue(argument, index);
    index = parsed.nextIndex;
    if (name === "--seed") options.seed = parsed.value;
    if (name === "--start-day") options.startDay = parsed.value;
    if (name === "--days") options.days = parsed.value;
    if (name === "--players") options.players = parsed.value;
  }
  return { options, json };
}

function formatHumanReport(report) {
  const lines = [
    `Cosmos balance simulation: ${report.parameters.players} players × ${report.parameters.days} days (seed ${report.parameters.seed})`,
    `Ticketed runs: ${report.runs.ticketed.started}; rewards ${report.runs.ticketed.rewardRatePercent}%; Cosmos ${report.runs.ticketed.cosmosRatePercent}%`,
    `Crazy Path: ${report.crazyPath.attempts.succeeded}/${report.crazyPath.attempts.started} clears; ${report.crazyPath.rewards.totalPowersIssued} Practice powers issued`,
    `Passes: ${report.passes.spent}/${report.passes.totalGranted} spent (${report.passes.utilizationRatePercent}%); ${report.passes.unmetRunDemand} unmet run requests`,
    `Star Path: ${report.starPath.completedPlayers}/${report.population.players} completed (${report.starPath.completionRatePercent}%); average XP ${report.starPath.averageXpPerPlayer}`,
    `Guardrails: ${report.guardrails.passed ? "PASS" : `FAIL (${report.guardrails.failed.join(", ")})`}`
  ];
  for (const check of report.guardrails.checks) {
    lines.push(`  ${check.passed ? "PASS" : "FAIL"} ${check.id}: ${JSON.stringify(check.actual)} — ${check.expectation}`);
  }
  return lines.join("\n");
}

export function runBalanceCli(argv = process.argv.slice(2), io = console) {
  try {
    const { options, json } = parseCliArguments(argv);
    const report = runBalanceSimulation(options);
    io.log(json ? JSON.stringify(report, null, 2) : formatHumanReport(report));
    return report.guardrails.passed ? 0 : 1;
  } catch (error) {
    io.error(`Cosmos balance simulator: ${error.message}`);
    return 2;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) process.exitCode = runBalanceCli();
