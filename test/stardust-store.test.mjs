import assert from "node:assert/strict";
import test from "node:test";

import {
  STAR_COMPASS_MAX_RESERVE,
  STAR_COMPASS_STARDUST_COST,
  STARDUST_STORE_CATALOG,
  STARDUST_STORE_VERSION,
  STREAK_SHIELD_MAX_RESERVE,
  STREAK_SHIELD_STARDUST_COST,
  applyStardustPurchase,
  sanitizeStardustStoreState,
  stardustStoreCatalog,
  quoteStardustPurchase
} from "../public/stardust-store.mjs";

test("the earn-only catalog discloses two exact, non-random, non-competitive sinks", () => {
  assert.deepEqual(STARDUST_STORE_CATALOG.map((item) => ({
    id: item.id,
    cost: item.cost,
    maxReserve: item.maxReserve,
    inventoryKey: item.inventoryKey
  })), [
    {
      id: "star-compass",
      cost: STAR_COMPASS_STARDUST_COST,
      maxReserve: STAR_COMPASS_MAX_RESERVE,
      inventoryKey: "sense"
    },
    {
      id: "streak-shield",
      cost: STREAK_SHIELD_STARDUST_COST,
      maxReserve: STREAK_SHIELD_MAX_RESERVE,
      inventoryKey: "streakShields"
    }
  ]);
  assert.equal(STAR_COMPASS_STARDUST_COST, 90);
  assert.equal(STAR_COMPASS_MAX_RESERVE, 9);
  assert.equal(STREAK_SHIELD_STARDUST_COST, 240);
  assert.equal(STREAK_SHIELD_MAX_RESERVE, 3);
  assert.ok(STARDUST_STORE_CATALOG.every((item) => (
    item.currency === "earned-stardust"
    && item.exact
    && !item.randomized
    && !item.paid
    && !item.competitiveAdvantage
  )));
});

test("catalog and state sanitation return defensive bounded shapes", () => {
  const first = stardustStoreCatalog();
  first[0].cost = 1;
  assert.equal(stardustStoreCatalog()[0].cost, 90);
  assert.equal(Object.isFrozen(STARDUST_STORE_CATALOG), true);
  assert.ok(STARDUST_STORE_CATALOG.every(Object.isFrozen));
  assert.deepEqual(sanitizeStardustStoreState({
    stardust: 999.9,
    powerups: { sense: 99 },
    streakShields: 99,
    paidBalance: 500,
    email: "do-not-keep@example.com"
  }), {
    version: STARDUST_STORE_VERSION,
    stardust: 999,
    inventory: {
      sense: STAR_COMPASS_MAX_RESERVE,
      streakShields: STREAK_SHIELD_MAX_RESERVE
    }
  });
  assert.deepEqual(sanitizeStardustStoreState({
    balance: -50,
    inventory: { sense: -2, streakShields: Number.POSITIVE_INFINITY }
  }), {
    version: STARDUST_STORE_VERSION,
    stardust: 0,
    inventory: { sense: 0, streakShields: 0 }
  });
});

test("quotes disclose exact balance and inventory deltas without mutating input", () => {
  const input = {
    stardust: 500,
    inventory: { sense: 2, streakShields: 1 }
  };
  const original = structuredClone(input);
  const quote = quoteStardustPurchase(input, "star-compass", 2);
  assert.deepEqual(input, original);
  assert.equal(quote.quoted, true);
  assert.equal(quote.reason, "quoted");
  assert.deepEqual(quote.cost, { unit: 90, total: 180 });
  assert.deepEqual(quote.balance, { before: 500, after: 320, delta: -180 });
  assert.deepEqual(quote.inventory, {
    key: "sense",
    before: 2,
    after: 4,
    delta: 2,
    maxReserve: 9
  });
  assert.equal("state" in quote, false);
});

test("apply is immutable, exact, deterministic, and never produces negative Stardust", () => {
  const input = {
    stardust: 500,
    powerups: { sense: 1 },
    streakShields: 0
  };
  const original = structuredClone(input);
  const first = applyStardustPurchase(input, "streak-shield", 2);
  const repeated = applyStardustPurchase(input, "streak-shield", 2);
  assert.deepEqual(input, original);
  assert.deepEqual(repeated, first);
  assert.equal(first.applied, true);
  assert.equal(first.reason, "applied");
  assert.deepEqual(first.balance, { before: 500, after: 20, delta: -480 });
  assert.deepEqual(first.inventory, {
    key: "streakShields",
    before: 0,
    after: 2,
    delta: 2,
    maxReserve: 3
  });
  assert.deepEqual(first.state, {
    version: STARDUST_STORE_VERSION,
    stardust: 20,
    inventory: { sense: 1, streakShields: 2 }
  });
  assert.ok(first.state.stardust >= 0);
});

test("invalid, unaffordable, and over-cap purchases fail atomically with exact reasons", () => {
  const cases = [
    [quoteStardustPurchase({ stardust: 999 }, "mystery-box"), "unknown_item"],
    [quoteStardustPurchase({ stardust: 999 }, "star-compass", 0), "invalid_quantity"],
    [quoteStardustPurchase({ stardust: 999 }, "star-compass", 1.5), "invalid_quantity"],
    [quoteStardustPurchase({ stardust: 999, inventory: { sense: 9 } }, "star-compass"), "reserve_full"],
    [quoteStardustPurchase({ stardust: 999, inventory: { sense: 8 } }, "star-compass", 2), "reserve_limit"],
    [quoteStardustPurchase({ stardust: 89 }, "star-compass"), "insufficient_stardust"]
  ];
  for (const [quote, reason] of cases) {
    assert.equal(quote.quoted, false);
    assert.equal(quote.reason, reason);
    assert.equal(quote.cost.total, 0);
    assert.equal(quote.balance.delta, 0);
    assert.equal(quote.inventory.delta, 0);
  }

  const failed = applyStardustPurchase(
    { stardust: 239, inventory: { sense: 4, streakShields: 1 } },
    "streak-shield"
  );
  assert.equal(failed.applied, false);
  assert.equal(failed.reason, "insufficient_stardust");
  assert.deepEqual(failed.state, {
    version: STARDUST_STORE_VERSION,
    stardust: 239,
    inventory: { sense: 4, streakShields: 1 }
  });
});
