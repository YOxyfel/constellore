import assert from "node:assert/strict";
import test from "node:test";

import {
  STAR_PATH_MAX_CREDITED_EVENTS,
  STAR_PATH_MAX_XP,
  STAR_PATH_SEASON_DAYS,
  STAR_PATH_TIER_COUNT,
  STAR_PATH_VERSION,
  STAR_PATH_XP_RULES,
  claimAllStarPathRewards,
  claimStarPathReward,
  recordStarPathProgress,
  sanitizeStarPathState,
  starPathCatalog,
  starPathCircuitXpEvent,
  starPathProgress,
  starPathRewardById,
  starPathSeason,
  starPathWordWinXpEvent
} from "../public/star-path.mjs";

const SEASON_START = "2026-01-05T00:00:00.000Z";
const MID_SEASON = "2026-01-20T12:00:00.000Z";
const NEXT_SEASON = "2026-03-02T00:00:00.000Z";

test("Star Path seasons are deterministic eight-week UTC intervals", () => {
  const start = starPathSeason(SEASON_START);
  const middle = starPathSeason(MID_SEASON);
  const justBeforeEnd = starPathSeason("2026-03-01T23:59:59.999Z");
  const next = starPathSeason(NEXT_SEASON);

  assert.equal(STAR_PATH_SEASON_DAYS, 56);
  assert.equal(start.id, "star-path-s0001");
  assert.equal(start.startsAt, SEASON_START);
  assert.equal(start.endsAt, NEXT_SEASON);
  assert.equal(middle.id, start.id);
  assert.equal(justBeforeEnd.id, start.id);
  assert.equal(next.id, "star-path-s0002");
  assert.notEqual(next.phaseId, start.phaseId);
  assert.deepEqual(starPathSeason(MID_SEASON), middle);

  const invalid = starPathSeason("not a date");
  assert.equal(invalid.id, start.id, "invalid dates use the fixed epoch, not local time");
});

test("both tracks disclose twelve exact cosmetic-only rewards", () => {
  const catalog = starPathCatalog(MID_SEASON);
  assert.equal(catalog.version, STAR_PATH_VERSION);
  assert.equal(catalog.tiers.length, STAR_PATH_TIER_COUNT);
  assert.deepEqual(Object.keys(catalog.tracks), ["free", "supporter"]);
  assert.equal(catalog.tracks.free.access, "everyone");
  assert.equal(catalog.tracks.supporter.access, "supporter");
  assert.deepEqual(catalog.season.fairness, {
    cosmeticOnly: true,
    randomizedRewards: false,
    grantsTickets: false,
    grantsPowerups: false,
    grantsCurrency: false,
    grantsXpBoosts: false,
    gameplayAdvantage: false
  });

  const rewardIds = new Set();
  const forbidden = /ticket|power.?up|boost|currency|credit|multiplier|loot|random/i;
  for (const [index, tier] of catalog.tiers.entries()) {
    assert.equal(tier.tier, index + 1);
    assert.ok(tier.xpRequired > (catalog.tiers[index - 1]?.xpRequired || 0));
    for (const track of ["free", "supporter"]) {
      const reward = tier.rewards[track];
      assert.equal(reward.track, track);
      assert.equal(reward.tier, tier.tier);
      assert.equal(reward.quantity, 1);
      assert.equal(reward.exact, true);
      assert.equal(reward.randomized, false);
      assert.equal(reward.cosmeticOnly, true);
      assert.equal(reward.gameplayEffect, "none");
      assert.equal(reward.placeholder, false);
      assert.equal(reward.presentation, "season-locker");
      assert.equal(forbidden.test(`${reward.id} ${reward.label} ${reward.kind}`), false);
      assert.equal(rewardIds.has(reward.id), false);
      rewardIds.add(reward.id);
    }
  }
  assert.equal(catalog.tiers.at(-1).xpRequired, STAR_PATH_MAX_XP);
  assert.equal(rewardIds.size, STAR_PATH_TIER_COUNT * 2);
});

test("catalog and progress presentations are defensive copies", () => {
  const first = starPathCatalog(MID_SEASON);
  first.season.title = "Mutated";
  first.season.fairness.grantsTickets = true;
  first.tiers[0].xpRequired = 1;
  first.tiers[0].rewards.supporter.kind = "powerup";

  const second = starPathCatalog(MID_SEASON);
  assert.notEqual(second.season.title, "Mutated");
  assert.equal(second.season.fairness.grantsTickets, false);
  assert.equal(second.tiers[0].xpRequired, 125);
  assert.notEqual(second.tiers[0].rewards.supporter.kind, "powerup");
});

test("reward resolver accepts only exact authored season IDs", () => {
  const reward = starPathCatalog(MID_SEASON).tiers[0].rewards.free;
  assert.deepEqual(starPathRewardById(reward.id), reward);
  assert.equal(starPathRewardById(reward.id.replace(".s0001.", ".s0000.")), null);
  assert.equal(starPathRewardById(reward.id.replace(".s0001.", ".p0001.")), null);
  assert.equal(starPathRewardById(reward.id.replace("first-light", "invented")), null);
});

test("sanitizer bounds hostile state, migrates old aliases, and drops stale seasons", () => {
  const clean = sanitizeStarPathState({
    version: 999,
    seasonXp: 1e99,
    creditedEvents: [
      "word:RUN_ONE",
      "word:run_one",
      "<script>",
      ...Array.from({ length: STAR_PATH_MAX_CREDITED_EVENTS + 20 }, (_, index) => `word:run-${index}`)
    ],
    freeClaims: [12, 1, 1, -4, 999, "2.9"],
    supporterClaims: [3, 3, "__proto__"],
    inventory: ["injected"],
    tickets: 999
  }, MID_SEASON);

  assert.deepEqual(Object.keys(clean), [
    "version",
    "seasonId",
    "xp",
    "creditedEventIds",
    "daily",
    "weeklyBonusKeys",
    "claimed"
  ]);
  assert.equal(clean.version, STAR_PATH_VERSION);
  assert.equal(clean.seasonId, "star-path-s0001");
  assert.equal(clean.xp, STAR_PATH_MAX_XP);
  assert.ok(clean.creditedEventIds.length <= STAR_PATH_MAX_CREDITED_EVENTS);
  assert.equal(new Set(clean.creditedEventIds).size, clean.creditedEventIds.length);
  assert.deepEqual(clean.claimed.free, [1, 2, 12]);
  assert.deepEqual(clean.claimed.supporter, [3]);
  assert.equal("tickets" in clean, false);
  assert.equal("inventory" in clean, false);
  assert.deepEqual(clean.daily, { dayKey: "2026-01-20", baseXp: 0 });
  assert.deepEqual(clean.weeklyBonusKeys, []);

  const stale = sanitizeStarPathState({
    seasonId: "star-path-s0001",
    xp: STAR_PATH_MAX_XP,
    creditedEventIds: ["word:old"],
    claimed: { free: [1], supporter: [1] }
  }, NEXT_SEASON);
  assert.deepEqual(stale, {
    version: STAR_PATH_VERSION,
    seasonId: "star-path-s0002",
    xp: 0,
    creditedEventIds: [],
    daily: { dayKey: "2026-03-02", baseXp: 0 },
    weeklyBonusKeys: [],
    claimed: { free: [], supporter: [] }
  });

  const migrated = sanitizeStarPathState({
    version: 1,
    seasonId: "star-path-s0001",
    xp: 3_400,
    claimed: { free: [12], supporter: [12] }
  }, MID_SEASON);
  assert.equal(migrated.xp, STAR_PATH_MAX_XP);
  assert.deepEqual(migrated.claimed, { free: [12], supporter: [12] });
});

test("only verified, won, non-practice word results award fixed XP once", () => {
  const base = sanitizeStarPathState({}, MID_SEASON);
  const validEvent = {
    type: "word_win",
    resultId: "Result-101",
    verified: true,
    won: true,
    mode: "daily",
    division: "pure",
    xp: 999_999
  };
  const first = recordStarPathProgress(base, validEvent, MID_SEASON);
  assert.equal(first.awarded, true);
  assert.equal(first.baseXpAwarded, STAR_PATH_XP_RULES.wordWin.xp);
  assert.equal(first.weeklyBonusXpAwarded, STAR_PATH_XP_RULES.weeklyParticipationBonus.xp);
  assert.equal(first.xpAwarded, 230);
  assert.equal(first.state.xp, 230);
  assert.deepEqual(first.state.creditedEventIds, ["word:result-101"]);
  assert.equal(base.xp, 0, "input state remains immutable");

  const duplicate = recordStarPathProgress(first.state, validEvent, MID_SEASON);
  assert.equal(duplicate.awarded, false);
  assert.equal(duplicate.reason, "already_credited");
  assert.equal(duplicate.state.xp, 230);

  const rejected = [
    { ...validEvent, resultId: "unverified", verified: false },
    { ...validEvent, resultId: "loss", won: false },
    { ...validEvent, resultId: "explore", mode: "explore" },
    { ...validEvent, resultId: "open", division: "open" },
    { ...validEvent, resultId: "practice", practice: true },
    { ...validEvent, resultId: "practice-id", challengeId: "practice:replay:old" },
    { ...validEvent, resultId: "" }
  ];
  for (const event of rejected) {
    const result = recordStarPathProgress(base, event, MID_SEASON);
    assert.equal(result.awarded, false);
    assert.equal(result.state.xp, 0);
  }
});

test("XP event helpers expose only the fixed Pure-word and Circuit event shapes", () => {
  assert.deepEqual(starPathWordWinXpEvent({
    runId: "WORD-22",
    verified: true,
    completed: true,
    mode: "daily",
    placement: { entry: { division: "pure" } },
    score: 999_999,
    creditReward: 10
  }), {
    type: "word_win",
    resultId: "word-22",
    verified: true,
    won: true,
    mode: "daily",
    division: "pure",
    challengeId: "",
    practice: false
  });

  assert.deepEqual(starPathCircuitXpEvent({
    runId: "RACE-22",
    rewardEligible: true,
    reward: { tier: "cosmos", powerups: 999 },
    tickets: 999
  }), {
    type: "cosmos_circuit",
    runId: "race-22",
    verified: false,
    rewardEligible: true,
    path: "",
    milestone: "cosmos"
  });
});

test("Crazy Path victories and failures cannot grant Star Path XP", () => {
  const state = sanitizeStarPathState({}, MID_SEASON);
  for (const milestone of ["crazy", "cosmos", "none"]) {
    const event = starPathCircuitXpEvent({
      runId: `crazy-${milestone}`,
      path: "crazy",
      verified: true,
      rewardEligible: true,
      milestone
    });
    assert.equal(event.path, "crazy");
    const result = recordStarPathProgress(state, event, MID_SEASON);
    assert.equal(result.awarded, false);
    assert.equal(result.xpAwarded, 0);
    assert.equal(result.reason, "crazy_path_excluded");
    assert.deepEqual(result.state, state);
  }
});

test("Cosmos Circuit milestones award disclosed base XP once per run and accept result aliases", () => {
  let state = sanitizeStarPathState({}, MID_SEASON);
  const cases = [
    ["drift", 20, { milestone: "drift", verified: true }],
    ["orbit", 35, { tier: "orbit", rewardEligible: true }],
    ["nebula", 55, { rewardTier: "nebula", verified: true }],
    ["galaxy", 85, { reward: { tier: "galaxy" }, rewardEligible: true }],
    ["cosmos", 125, { reward: { milestone: "cosmos" }, verified: true }]
  ];

  for (const [index, [milestone, expectedXp, fields]] of cases.entries()) {
    const at = new Date(Date.parse("2026-01-20T12:00:00.000Z") + index * 86_400_000);
    const result = recordStarPathProgress(state, {
      type: "cosmos_circuit",
      runId: `race-${milestone}`,
      ...fields,
      xp: 1_000_000
    }, at);
    assert.equal(result.awarded, true);
    assert.equal(result.milestone, milestone);
    assert.equal(result.baseXpAwarded, expectedXp);
    assert.equal(result.weeklyBonusXpAwarded, index === 0 ? 200 : 0);
    state = result.state;
  }
  assert.equal(state.xp, 520);

  const duplicateWithHigherClaim = recordStarPathProgress(state, {
    type: "race",
    runId: "race-drift",
    rewardEligible: true,
    tier: "cosmos"
  }, "2026-01-24T18:00:00.000Z");
  assert.equal(duplicateWithHigherClaim.awarded, false);
  assert.equal(duplicateWithHigherClaim.reason, "already_credited");

  const unknown = recordStarPathProgress(state, {
    type: "cosmos_circuit",
    runId: "race-unknown",
    verified: true,
    milestone: "mystery"
  }, "2026-01-24T18:00:00.000Z");
  assert.equal(unknown.reason, "unknown_milestone");

  const unverified = recordStarPathProgress(state, {
    type: "cosmos_circuit",
    runId: "race-unverified",
    milestone: "cosmos"
  }, "2026-01-24T18:00:00.000Z");
  assert.equal(unverified.reason, "unverified_result");
});

test("daily base cap and weekly catch-up bonus smooth progress across UTC boundaries", () => {
  let state = sanitizeStarPathState({}, "2026-01-20T00:00:00.000Z");
  const event = (id) => ({
    type: "word_win",
    resultId: id,
    verified: true,
    won: true,
    mode: "quick",
    division: "pure"
  });

  const first = recordStarPathProgress(state, event("cap-1"), "2026-01-20T00:01:00.000Z");
  state = first.state;
  assert.equal(first.baseXpAwarded, 30);
  assert.equal(first.weeklyBonusXpAwarded, 200);

  const second = recordStarPathProgress(state, event("cap-2"), "2026-01-20T10:00:00.000Z");
  state = second.state;
  assert.equal(second.baseXpAwarded, 30);
  assert.equal(second.weeklyBonusXpAwarded, 0);

  const third = recordStarPathProgress(state, event("cap-3"), "2026-01-20T20:00:00.000Z");
  state = third.state;
  assert.equal(third.baseXpAwarded, 30);

  const fourth = recordStarPathProgress(state, event("cap-4"), "2026-01-20T20:30:00.000Z");
  state = fourth.state;
  assert.equal(fourth.baseXpAwarded, 30);

  const fifth = recordStarPathProgress(state, event("cap-5"), "2026-01-20T20:45:00.000Z");
  state = fifth.state;
  assert.equal(fifth.baseXpAwarded, 5);
  assert.equal(fifth.state.daily.baseXp, STAR_PATH_XP_RULES.dailyBaseXpCap);

  const capped = recordStarPathProgress(state, event("cap-6"), "2026-01-20T21:00:00.000Z");
  state = capped.state;
  assert.equal(capped.awarded, false);
  assert.equal(capped.reason, "daily_cap");
  assert.equal(capped.baseXpPotential, 30);
  assert.equal(capped.xpAwarded, 0);

  const tomorrow = recordStarPathProgress(state, event("cap-7"), "2026-01-21T00:00:00.000Z");
  state = tomorrow.state;
  assert.equal(tomorrow.baseXpAwarded, 30);
  assert.equal(tomorrow.weeklyBonusXpAwarded, 0);

  const nextWeek = recordStarPathProgress(state, event("cap-8"), "2026-01-26T00:00:00.000Z");
  assert.equal(nextWeek.baseXpAwarded, 30);
  assert.equal(nextWeek.weeklyBonusXpAwarded, 200);
  assert.deepEqual(nextWeek.state.weeklyBonusKeys, [
    "star-path-s0001:w03",
    "star-path-s0001:w04"
  ]);
});

test("free rewards claim once and supporter rewards require active supporter access", () => {
  const state = sanitizeStarPathState({ xp: 200 }, MID_SEASON);

  const free = claimStarPathReward(state, { track: "free", tier: 1 }, MID_SEASON);
  assert.equal(free.claimed, true);
  assert.equal(free.reason, "reward_claimed");
  assert.equal(free.reward.track, "free");
  assert.equal(free.reward.tier, 1);
  assert.deepEqual(free.state.claimed.free, [1]);

  const repeated = claimStarPathReward(free.state, { track: "free", tier: 1 }, MID_SEASON);
  assert.equal(repeated.claimed, false);
  assert.equal(repeated.reason, "already_claimed");
  assert.equal(repeated.reward, null);

  const noAccess = claimStarPathReward(free.state, { track: "supporter", tier: 1 }, MID_SEASON);
  assert.equal(noAccess.claimed, false);
  assert.equal(noAccess.reason, "supporter_required");

  const supporter = claimStarPathReward(
    free.state,
    { track: "supporter", tier: 1, supporterAccess: true },
    MID_SEASON
  );
  assert.equal(supporter.claimed, true);
  assert.equal(supporter.reward.track, "supporter");
  assert.equal(supporter.reward.cosmeticOnly, true);
  assert.deepEqual(supporter.state.claimed.supporter, [1]);

  const locked = claimStarPathReward(
    supporter.state,
    { track: "supporter", tier: 3, supporterAccess: true },
    MID_SEASON
  );
  assert.equal(locked.claimed, false);
  assert.equal(locked.reason, "tier_locked");
});

test("claim-all returns only newly claimed rewards in tier and track order", () => {
  const initial = sanitizeStarPathState({
    version: STAR_PATH_VERSION,
    xp: 850,
    claimed: { free: [1], supporter: [2] }
  }, MID_SEASON);
  const freeOnly = claimAllStarPathRewards(initial, {}, MID_SEASON);
  assert.equal(freeOnly.claimed, true);
  assert.equal(freeOnly.count, 3);
  assert.deepEqual(freeOnly.claimedTiers, {
    free: [2, 3, 4],
    supporter: []
  });
  assert.deepEqual(freeOnly.state.claimed.free, [1, 2, 3, 4]);
  assert.deepEqual(freeOnly.state.claimed.supporter, [2]);
  assert.ok(freeOnly.rewards.free.every((reward) => reward.track === "free"));

  const withSupporter = claimAllStarPathRewards(
    freeOnly.state,
    { supporterAccess: true },
    MID_SEASON
  );
  assert.equal(withSupporter.count, 3);
  assert.deepEqual(withSupporter.claimedTiers, {
    free: [],
    supporter: [1, 3, 4]
  });
  assert.deepEqual(withSupporter.state.claimed.supporter, [1, 2, 3, 4]);
  assert.ok(withSupporter.rewards.supporter.every((reward) => reward.track === "supporter"));

  const repeated = claimAllStarPathRewards(
    withSupporter.state,
    { supporterAccess: true },
    MID_SEASON
  );
  assert.equal(repeated.claimed, false);
  assert.equal(repeated.count, 0);
  assert.equal(repeated.reason, "nothing_claimable");
  assert.deepEqual(repeated.rewards, { free: [], supporter: [] });
});

test("progress reports reached tiers, exact next target, and outstanding claims", () => {
  const progress = starPathProgress({
    xp: 180,
    claimed: { free: [1], supporter: [] }
  }, MID_SEASON);

  assert.equal(progress.reachedTier, 2);
  assert.equal(progress.totalTiers, STAR_PATH_TIER_COUNT);
  assert.equal(progress.complete, false);
  assert.equal(progress.nextTier.tier, 3);
  assert.equal(progress.nextTier.xpRequired, 550);
  assert.equal(progress.percentToNext, 0);
  assert.deepEqual(progress.claimable.free, [2]);
  assert.deepEqual(progress.claimable.supporter, [1, 2]);

  const complete = starPathProgress({ xp: 999_999 }, MID_SEASON);
  assert.equal(complete.xp, STAR_PATH_MAX_XP);
  assert.equal(complete.reachedTier, STAR_PATH_TIER_COUNT);
  assert.equal(complete.nextTier, null);
  assert.equal(complete.percentToNext, 100);
  assert.equal(complete.complete, true);
});
