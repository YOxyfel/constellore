import assert from "node:assert/strict";
import test from "node:test";

import {
  SALVAGE_CACHE_TIERS,
  SALVAGE_CACHE_VERSION,
  SALVAGE_RECEIPT_LIMIT,
  SALVAGE_REWARD_POLICY,
  SALVAGE_SELECTION_SHARD_GOAL,
  createSalvageCacheState,
  openSalvageCache,
  quoteSalvageCacheOpen,
  redeemSalvageSelection,
  salvageCacheCatalog,
  salvageReceiptFingerprint,
  sanitizeSalvageCacheState,
  sanitizeSalvageCosmeticPool
} from "../public/salvage-cache.mjs";
import {
  STAR_COMPASS_MAX_RESERVE,
  STREAK_SHIELD_MAX_RESERVE
} from "../public/stardust-store.mjs";

const COSMETICS = [
  {
    id: "salvage.moon.word-plaque.regolith",
    label: "Regolith Plaque",
    slot: "wordPlaque",
    access: "earned",
    salvageEligible: true,
    cosmeticOnly: true,
    gameplayEffect: "none",
    paid: false
  },
  {
    id: "salvage.moon.trail.lunar-dust",
    label: "Lunar Dust Trail",
    slot: "trailSet",
    access: "salvage",
    salvageEligible: true,
    cosmeticOnly: true,
    gameplayEffect: "none",
    paid: false
  },
  {
    id: "salvage.moon.ui.outpost-glass",
    label: "Outpost Glass",
    slot: "uiFinish",
    access: "everyone",
    salvageEligible: true,
    cosmeticOnly: true,
    gameplayEffect: "none",
    paid: false
  }
];

function baseOptions(overrides = {}) {
  return {
    tierId: "rare",
    receiptId: "cache-open-001",
    entropy: "server-entropy-001",
    capabilities: ["salvage-cache.epic", "salvage-cache.mythic"],
    eligibleCosmetics: COSMETICS,
    resources: {
      stardust: 5_000,
      inventory: { sense: 0, streakShields: 0 },
      ownedCosmeticIds: []
    },
    ...overrides
  };
}

function findOpening(predicate, overrides = {}) {
  for (let index = 0; index < 2_000; index += 1) {
    const result = openSalvageCache(createSalvageCacheState(), baseOptions({
      receiptId: `search-receipt-${index}`,
      entropy: `search-entropy-${index}`,
      ...overrides
    }));
    if (result.opened && predicate(result)) return result;
  }
  assert.fail("A deterministic fixture outcome could not be found.");
}

test("four earn-only tiers disclose exact visible odds, pity, conversions, and no-empty policy", () => {
  assert.deepEqual(SALVAGE_CACHE_TIERS.map((tier) => tier.id), ["common", "rare", "epic", "mythic"]);
  assert.deepEqual(SALVAGE_CACHE_TIERS.map((tier) => tier.cost), [100, 350, 900, 2_400]);
  assert.deepEqual(SALVAGE_CACHE_TIERS.map((tier) => tier.pityEvery), [8, 5, 3, 1]);
  assert.deepEqual(SALVAGE_CACHE_TIERS.map((tier) => (
    tier.odds.find((outcome) => outcome.id === "cosmetic")?.chancePercent
  )), [12, 30, 65, 100]);
  assert.deepEqual(SALVAGE_CACHE_TIERS.map((tier) => tier.moonReachable), [true, true, false, false]);
  assert.deepEqual(SALVAGE_CACHE_TIERS.map((tier) => tier.requiredCapability), [
    "",
    "",
    "salvage-cache.epic",
    "salvage-cache.mythic"
  ]);

  for (const tier of SALVAGE_CACHE_TIERS) {
    assert.equal(tier.payment.currency, "earned-stardust");
    assert.equal(tier.payment.purchasable, false);
    assert.equal(tier.payment.cashPurchase, false);
    assert.equal(tier.odds.reduce((sum, outcome) => sum + outcome.chanceBasisPoints, 0), 10_000);
    assert.ok(tier.odds.every((outcome) => (
      outcome.chanceBasisPoints > 0
      && outcome.chancePercent === outcome.chanceBasisPoints / 100
    )));
    assert.equal(tier.guarantee.guaranteedByOpen, tier.pityEvery);
    assert.ok(tier.duplicateConversion.stardust > 0);
    assert.equal(tier.duplicateConversion.selectionShards, 1);
    assert.equal(tier.noEmptyOutcomes, true);
    assert.equal(tier.activeRunEligible, false);
    assert.equal(tier.scoreDelta, 0);
    assert.equal(tier.rankDelta, 0);
    assert.equal(tier.masteryDelta, 0);
    assert.equal(tier.competitiveAdvantage, false);
  }

  assert.deepEqual(SALVAGE_REWARD_POLICY, {
    currency: "earned-stardust",
    currencyPurchasable: false,
    cashPurchase: false,
    openingDuringActiveRun: false,
    randomized: true,
    visibleOdds: true,
    emptyOutcomes: false,
    scoreDelta: 0,
    rankDelta: 0,
    masteryDelta: 0,
    competitiveAdvantage: false,
    powerupActivation: "existing-rules-only",
    cosmetics: "cosmetic-only-no-gameplay-effect"
  });
});

test("the public catalog is defensive and keeps policy next to the odds", () => {
  const first = salvageCacheCatalog();
  first.tiers[0].odds[0].chanceBasisPoints = 1;
  first.policy.visibleOdds = false;
  assert.equal(salvageCacheCatalog().tiers[0].odds[0].chanceBasisPoints, 4_800);
  assert.equal(salvageCacheCatalog().policy.visibleOdds, true);
  assert.equal(salvageCacheCatalog().selectionShardGoal, SALVAGE_SELECTION_SHARD_GOAL);
  assert.equal(Object.isFrozen(SALVAGE_CACHE_TIERS), true);
  assert.ok(SALVAGE_CACHE_TIERS.every(Object.isFrozen));
});

test("only explicitly curated earn-only, non-gameplay cosmetics enter the randomized pool", () => {
  const pool = sanitizeSalvageCosmeticPool([
    COSMETICS[1],
    COSMETICS[0],
    { ...COSMETICS[0], label: "Stable duplicate" },
    { ...COSMETICS[0], id: "supporter.item", access: "supporter" },
    { ...COSMETICS[0], id: "paid.item", paid: true },
    { ...COSMETICS[0], id: "gameplay.item", gameplayEffect: "score-boost" },
    { ...COSMETICS[0], id: "uncurated.item", salvageEligible: false },
    null
  ]);
  assert.deepEqual(pool.map((item) => item.id), [
    "salvage.moon.trail.lunar-dust",
    "salvage.moon.word-plaque.regolith"
  ]);
  assert.equal(pool[1].label, "Stable duplicate");
  assert.ok(pool.every((item) => (
    item.cosmeticOnly
    && item.gameplayEffect === "none"
    && !item.paid
    && !item.competitiveAdvantage
  )));
});

test("state sanitation is bounded, versioned, and retains only receipt fingerprints", () => {
  const valid = salvageReceiptFingerprint("private-server-receipt");
  const many = Array.from({ length: SALVAGE_RECEIPT_LIMIT + 5 }, (_, index) => (
    salvageReceiptFingerprint(`receipt-${index}`)
  ));
  const state = sanitizeSalvageCacheState({
    version: 999,
    opens: { common: 9.9, rare: -2, epic: Number.POSITIVE_INFINITY, mythic: 7, injected: 44 },
    pity: { common: 2.8, rare: 4, mythic: 1 },
    selectionShards: 99_999,
    receiptFingerprints: ["private-server-receipt", valid, ...many],
    email: "discard@example.com"
  });
  assert.equal(state.version, SALVAGE_CACHE_VERSION);
  assert.deepEqual(state.opensByTier, { common: 9, rare: 0, epic: 0, mythic: 7 });
  assert.deepEqual(state.pityMissesByTier, { common: 2, rare: 4, epic: 0, mythic: 0 });
  assert.equal(state.selectionShards, 9_999);
  assert.equal(state.receiptFingerprints.length, SALVAGE_RECEIPT_LIMIT);
  assert.ok(state.receiptFingerprints.every((fingerprint) => /^sc1-[0-9a-f]{16}$/.test(fingerprint)));
  assert.equal(state.receiptFingerprints.includes("private-server-receipt"), false);
  assert.equal("email" in state, false);
});

test("quotes are immutable and fail atomically for unsafe or invalid openings", () => {
  const state = createSalvageCacheState();
  const snapshot = structuredClone(state);
  const quoted = quoteSalvageCacheOpen(state, baseOptions());
  assert.deepEqual(state, snapshot);
  assert.equal(quoted.quoted, true);
  assert.equal(quoted.reason, "quoted");
  assert.deepEqual(quoted.payment, {
    currency: "earned-stardust",
    source: "earned-only",
    purchasable: false,
    cashPurchase: false,
    listed: 350,
    charged: 350
  });
  assert.deepEqual(quoted.balance, { before: 5_000, after: 4_650, delta: -350 });

  const failures = [
    [quoteSalvageCacheOpen(state, baseOptions({ tierId: "unknown" })), "unknown_tier"],
    [quoteSalvageCacheOpen(state, baseOptions({ activeRun: true })), "active_run_blocked"],
    [quoteSalvageCacheOpen(state, baseOptions({ rankedRun: true })), "active_run_blocked"],
    [quoteSalvageCacheOpen(state, baseOptions({ eligibleCosmetics: [] })), "missing_eligible_cosmetics"],
    [quoteSalvageCacheOpen(state, baseOptions({ resources: { stardust: 349 } })), "insufficient_stardust"],
    [quoteSalvageCacheOpen(state, baseOptions({ tierId: "epic", capabilities: [] })), "capability_locked"],
    [quoteSalvageCacheOpen(state, baseOptions({ tierId: "mythic", capabilities: {} })), "capability_locked"]
  ];
  for (const [failure, reason] of failures) {
    assert.equal(failure.quoted, false);
    assert.equal(failure.reason, reason);
    assert.equal(failure.payment.charged, 0);
    assert.equal(failure.balance.delta, 0);
  }
});

test("an opening is deterministic, immutable, non-empty, and produces only ranked-safe settlement deltas", () => {
  const state = createSalvageCacheState();
  const options = baseOptions();
  const stateBefore = structuredClone(state);
  const optionsBefore = structuredClone(options);
  const first = openSalvageCache(state, options);
  const repeated = openSalvageCache(state, options);
  assert.deepEqual(repeated, first);
  assert.deepEqual(state, stateBefore);
  assert.deepEqual(options, optionsBefore);
  assert.equal(first.opened, true);
  assert.equal(first.reason, "opened");
  assert.equal(first.debit.amount, 350);
  assert.ok(first.grant);
  assert.equal(first.grant.empty, false);
  assert.ok(
    first.grant.stardust > 0
    || first.grant.inventory.sense > 0
    || first.grant.inventory.streakShields > 0
    || first.grant.cosmeticId
    || first.grant.selectionShards > 0
  );
  assert.deepEqual(first.settlement, {
    stardustDelta: first.resources.stardust - 5_000,
    scoreDelta: 0,
    rankDelta: 0,
    masteryDelta: 0,
    competitiveAdvantage: false,
    appliesToActiveRun: false
  });
  assert.equal("credits" in first.grant, false);
  assert.equal("xp" in first.grant, false);
  assert.equal(first.state.opensByTier.rare, 1);
  assert.equal(first.state.receiptFingerprints.length, 1);
  assert.notEqual(first.state.receiptFingerprints[0], options.receiptId);
});

test("receipt replay never debits or grants twice", () => {
  const options = baseOptions();
  const first = openSalvageCache(createSalvageCacheState(), options);
  assert.equal(first.opened, true);
  const replay = openSalvageCache(first.state, {
    ...options,
    resources: first.resources,
    entropy: "even-a-different-entropy-cannot-replay"
  });
  assert.equal(replay.opened, false);
  assert.equal(replay.reason, "duplicate_receipt");
  assert.equal(replay.debit.amount, 0);
  assert.equal(replay.grant, null);
  assert.deepEqual(replay.state, first.state);
  assert.deepEqual(replay.resources, first.resources);
});

test("pity guarantees a new eligible cosmetic and resets only that tier's miss counter", () => {
  const state = sanitizeSalvageCacheState({
    pityMissesByTier: { common: 6, rare: 4, epic: 2, mythic: 0 }
  });
  const result = openSalvageCache(state, baseOptions({
    tierId: "epic",
    receiptId: "pity-open",
    entropy: "pity-entropy"
  }));
  assert.equal(result.opened, true);
  assert.equal(result.outcome.forcedByPity, true);
  assert.equal(result.outcome.resolved, "cosmetic");
  assert.equal(result.grant.category, "cosmetic");
  assert.ok(COSMETICS.some((item) => item.id === result.grant.cosmeticId));
  assert.equal(result.grant.cosmeticOnly, true);
  assert.equal(result.grant.gameplayEffect, "none");
  assert.equal(result.pity.before, 2);
  assert.equal(result.pity.after, 0);
  assert.equal(result.state.pityMissesByTier.epic, 0);
  assert.equal(result.state.pityMissesByTier.rare, 4);
  assert.equal(result.state.pityMissesByTier.common, 6);
});

test("Mythic is 100% cosmetic and selects an unowned item until the curated pool is complete", () => {
  const result = openSalvageCache(createSalvageCacheState(), baseOptions({
    tierId: "mythic",
    receiptId: "mythic-unowned",
    entropy: "mythic-unowned-entropy",
    resources: {
      stardust: 5_000,
      inventory: { sense: 0, streakShields: 0 },
      ownedCosmeticIds: [COSMETICS[0].id]
    }
  }));
  assert.equal(result.opened, true);
  assert.equal(result.outcome.natural, "cosmetic");
  assert.equal(result.outcome.forcedByPity, true);
  assert.equal(result.grant.category, "cosmetic");
  assert.notEqual(result.grant.cosmeticId, COSMETICS[0].id);

  const complete = openSalvageCache(createSalvageCacheState(), baseOptions({
    tierId: "mythic",
    receiptId: "mythic-complete",
    entropy: "mythic-complete-entropy",
    resources: {
      stardust: 5_000,
      inventory: { sense: 0, streakShields: 0 },
      ownedCosmeticIds: COSMETICS.map((item) => item.id)
    }
  }));
  assert.equal(complete.opened, true);
  assert.equal(complete.outcome.natural, "cosmetic");
  assert.equal(complete.outcome.forcedByPity, false);
  assert.equal(complete.grant.id, "duplicate-conversion");
  assert.equal(complete.grant.stardust, 1_200);
  assert.equal(complete.grant.selectionShards, 1);
  assert.equal(complete.resources.stardust, 3_800);
});

test("a duplicate cosmetic becomes Stardust plus one selection shard", () => {
  const onlyCosmetic = [COSMETICS[0]];
  const result = findOpening(
    (opening) => opening.outcome.natural === "cosmetic",
    {
      tierId: "epic",
      eligibleCosmetics: onlyCosmetic,
      resources: {
        stardust: 5_000,
        inventory: { sense: 0, streakShields: 0 },
        ownedCosmeticIds: [onlyCosmetic[0].id]
      }
    }
  );
  assert.equal(result.grant.id, "duplicate-conversion");
  assert.equal(result.grant.category, "conversion");
  assert.equal(result.grant.stardust, 450);
  assert.equal(result.grant.selectionShards, 1);
  assert.equal(result.state.selectionShards, 1);
  assert.equal(result.resources.stardust, 4_550);
  assert.deepEqual(result.resources.ownedCosmeticIds, [onlyCosmetic[0].id]);
});

test("full reserves convert a powerup outcome instead of ever yielding nothing", () => {
  const result = findOpening(
    (opening) => opening.outcome.natural === "star-compass",
    {
      tierId: "epic",
      resources: {
        stardust: 5_000,
        inventory: {
          sense: STAR_COMPASS_MAX_RESERVE,
          streakShields: STREAK_SHIELD_MAX_RESERVE
        },
        ownedCosmeticIds: []
      }
    }
  );
  assert.equal(result.outcome.substitutedBecause, "star_compass_reserve_full");
  assert.equal(result.grant.id, "salvage-stardust");
  assert.equal(result.grant.stardust, 135);
  assert.equal(result.grant.empty, false);
  assert.equal(result.resources.inventory.sense, STAR_COMPASS_MAX_RESERVE);
});

test("four duplicate shards buy an exact unowned cosmetic with idempotent, active-run-safe settlement", () => {
  const state = sanitizeSalvageCacheState({ selectionShards: SALVAGE_SELECTION_SHARD_GOAL });
  const options = {
    receiptId: "selection-001",
    cosmeticId: COSMETICS[1].id,
    eligibleCosmetics: COSMETICS,
    resources: { ownedCosmeticIds: [COSMETICS[0].id] }
  };
  const selected = redeemSalvageSelection(state, options);
  assert.equal(selected.redeemed, true);
  assert.equal(selected.reason, "redeemed");
  assert.deepEqual(selected.cost, { selectionShards: SALVAGE_SELECTION_SHARD_GOAL });
  assert.equal(selected.state.selectionShards, 0);
  assert.equal(selected.grant.cosmeticId, COSMETICS[1].id);
  assert.equal(selected.grant.cosmeticOnly, true);
  assert.equal(selected.grant.gameplayEffect, "none");
  assert.deepEqual(selected.settlement, {
    scoreDelta: 0,
    rankDelta: 0,
    masteryDelta: 0,
    competitiveAdvantage: false,
    appliesToActiveRun: false
  });

  const replay = redeemSalvageSelection(selected.state, {
    ...options,
    resources: selected.resources
  });
  assert.equal(replay.redeemed, false);
  assert.equal(replay.reason, "duplicate_receipt");
  assert.equal(replay.cost.selectionShards, 0);

  const active = redeemSalvageSelection(state, { ...options, receiptId: "selection-active", activeRun: true });
  assert.equal(active.redeemed, false);
  assert.equal(active.reason, "active_run_blocked");
  assert.deepEqual(active.state, state);
});

test("selection cannot unlock an owned, paid, uncurated, or unaffordable cosmetic", () => {
  const ready = sanitizeSalvageCacheState({ selectionShards: SALVAGE_SELECTION_SHARD_GOAL });
  const noShards = redeemSalvageSelection(createSalvageCacheState(), {
    receiptId: "no-shards",
    cosmeticId: COSMETICS[0].id,
    eligibleCosmetics: COSMETICS
  });
  assert.equal(noShards.reason, "insufficient_selection_shards");

  const owned = redeemSalvageSelection(ready, {
    receiptId: "already-owned",
    cosmeticId: COSMETICS[0].id,
    eligibleCosmetics: COSMETICS,
    resources: { ownedCosmeticIds: [COSMETICS[0].id] }
  });
  assert.equal(owned.reason, "already_owned");

  const paid = { ...COSMETICS[0], id: "paid.cosmetic", paid: true };
  const ineligible = redeemSalvageSelection(ready, {
    receiptId: "paid-selection",
    cosmeticId: paid.id,
    eligibleCosmetics: [paid]
  });
  assert.equal(ineligible.reason, "ineligible_cosmetic");
});
