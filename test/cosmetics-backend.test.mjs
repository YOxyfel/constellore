import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { GameStore } from "../game-services.mjs";
import {
  COSMETIC_COLLECTIONS,
  COSMETIC_SLOTS,
  DEFAULT_COSMETIC_LOADOUT
} from "../public/cosmetic-economy.mjs";
import {
  createRemixProgressionState,
  getRemixRank
} from "../public/remix-progression.mjs";

const aurora = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "aurora-archive");
const solar = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "solar-foundry");
const lunar = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "lunar-garden");
const eclipse = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "eclipse-sovereign");
const pixel = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "pixel-frontier");
const bubble = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "bubble-reef");
const vanguard = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "stellar-vanguard");

function setAuthoritativeRouteRank(store, playerId, rankId) {
  const rank = getRemixRank(rankId);
  store.data.players[playerId].routeProgression = createRemixProgressionState({
    rankId: rank.id,
    masteryPoints: rank.masteryPoints,
    completedChallenges: rank.completedChallenges
  });
  assert.equal(store.publicRouteRank(playerId).rank.id, rank.id);
}

test("cloud cosmetics validate all seven canonical slots and keep founder compatibility", async () => {
  const store = await new GameStore(":memory:").init();
  const freePlayer = await store.registerPlayer();

  const freeUpdate = await store.updateCloudProfile(freePlayer.id, 0, {
    cosmetics: DEFAULT_COSMETIC_LOADOUT
  });
  assert.deepEqual(freeUpdate.profile.cosmetics, DEFAULT_COSMETIC_LOADOUT);
  assert.deepEqual(Object.keys(freeUpdate.profile.cosmetics), COSMETIC_SLOTS);

  await assert.rejects(
    store.updateCloudProfile(freePlayer.id, 1, { cosmetics: aurora.preset }),
    (error) => error.serviceCode === "cosmetic_entitlement_required" && error.statusCode === 403
  );
  await assert.rejects(
    store.updateCloudProfile(freePlayer.id, 1, {
      cosmetics: { wordPlaque: aurora.preset.boardFinish }
    }),
    (error) => error.serviceCode === "invalid_cloud_profile" && error.statusCode === 400
  );

  const supporter = await store.registerPlayer();
  await store.setFounderPass(supporter.id, true);
  const legacyUpdate = await store.updateCloudProfile(supporter.id, 0, {
    theme: "aurora",
    cosmetics: { theme: "aurora", board: "nebula", trail: "prism", sound: "glass" }
  });
  assert.deepEqual(legacyUpdate.profile.cosmetics, aurora.preset);
  assert.equal(store.publicPlayer(supporter.id).founderPass, true);
  assert.equal(store.publicPlayer(supporter.id).supporter, true);
  assert.ok(store.publicPlayer(supporter.id).cosmeticOwnership.collections.includes(solar.id));
});

test("explicit item and collection grants scale beyond the legacy all-or-nothing pass", async () => {
  const store = await new GameStore(":memory:").init();
  const itemPlayer = await store.registerPlayer();
  const collectionPlayer = await store.registerPlayer();

  const itemOwnership = await store.grantCosmeticEntitlement(itemPlayer.id, {
    itemId: aurora.preset.wordPlaque,
    source: "event"
  });
  assert.ok(itemOwnership.items.includes(aurora.preset.wordPlaque));
  assert.equal(itemOwnership.supporter, false);
  const itemCloud = await store.updateCloudProfile(itemPlayer.id, 0, {
    cosmetics: {
      ...DEFAULT_COSMETIC_LOADOUT,
      wordPlaque: aurora.preset.wordPlaque
    }
  });
  assert.equal(itemCloud.profile.cosmetics.wordPlaque, aurora.preset.wordPlaque);
  assert.equal(itemCloud.profile.cosmetics.boardFinish, DEFAULT_COSMETIC_LOADOUT.boardFinish);

  const collectionOwnership = await store.grantCosmeticEntitlement(collectionPlayer.id, {
    collectionId: solar.id,
    source: "support"
  });
  assert.ok(collectionOwnership.collections.includes(solar.id));
  const collectionCloud = await store.updateCloudProfile(collectionPlayer.id, 0, {
    cosmetics: solar.preset
  });
  assert.deepEqual(collectionCloud.profile.cosmetics, solar.preset);
  assert.deepEqual(store.entitlementSnapshot(collectionPlayer.id).cosmetics, collectionOwnership);
});

test("Star Credit collection purchases use catalog prices and grant one durable entitlement idempotently", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-cosmetics-"));
  const storePath = join(directory, "store.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = await new GameStore(storePath).init();
  const player = await store.registerPlayer();
  assert.ok(lunar && eclipse);
  store.data.players[player.id].credits = 10_000;
  const initialBalance = store.publicPlayer(player.id).credits;
  const purchaseKey = "cosmetic-lunar-purchase-001";

  const purchase = await store.buyCosmeticCollection(player.id, lunar.id, purchaseKey);
  const repeated = await store.buyCosmeticCollection(player.id, lunar.id, purchaseKey);
  assert.deepEqual(repeated, purchase);
  assert.equal(purchase.price, lunar.creditPrice);
  assert.equal(purchase.currency, "star_credits");
  assert.equal(purchase.balance, initialBalance - lunar.creditPrice);
  assert.equal(purchase.collection.id, lunar.id);
  assert.equal(purchase.collection.owned, true);
  assert.equal(purchase.competitive, false);
  assert.ok(purchase.ownership.collections.includes(lunar.id));
  assert.equal(store.publicPlayer(player.id).credits, purchase.balance);

  const economyEntries = store.data.economyLedger.filter((entry) =>
    entry.type === "cosmetic_collection_purchased" && entry.collectionId === lunar.id
  );
  const entitlementEntries = store.data.entitlementLedger.filter((entry) =>
    entry.type === "cosmetic_entitlement_granted" && entry.collectionId === lunar.id && entry.source === "credits"
  );
  assert.equal(economyEntries.length, 1);
  assert.equal(economyEntries[0].amount, -lunar.creditPrice);
  assert.equal(economyEntries[0].currency, "star_credits");
  assert.equal(entitlementEntries.length, 1);
  assert.equal(store.analyticsSummary().events.cosmetic_purchased, 1);
  assert.equal(store.analyticsSummary().economy.cosmeticCreditsSpent, lunar.creditPrice);

  const cloud = await store.updateCloudProfile(player.id, 0, { cosmetics: lunar.preset });
  assert.deepEqual(cloud.profile.cosmetics, lunar.preset);
  await assert.rejects(
    store.buyCosmeticCollection(player.id, eclipse.id, purchaseKey),
    (error) => error.serviceCode === "idempotency_conflict" && error.statusCode === 409
  );

  const restored = await new GameStore(storePath).init();
  assert.equal(restored.publicPlayer(player.id).credits, purchase.balance);
  assert.ok(restored.cosmeticOwnership(player.id).collections.includes(lunar.id));
  assert.deepEqual(await restored.buyCosmeticCollection(player.id, lunar.id, purchaseKey), purchase);
});

test("Star Credit collection purchases reject unowned balances, non-sale kits, and already-owned access", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const pieceOwner = await store.registerPlayer();
  const freeCollection = COSMETIC_COLLECTIONS.find((entry) => entry.access === "free");

  await assert.rejects(
    store.buyCosmeticCollection(player.id, aurora.id, "cosmetic-insufficient-001"),
    (error) => error.serviceCode === "insufficient_credits"
      && error.statusCode === 402
      && error.details?.price === aurora.creditPrice
      && error.details?.balance === 300
  );
  await assert.rejects(
    store.buyCosmeticCollection(player.id, freeCollection.id, "cosmetic-free-kit-001"),
    (error) => error.serviceCode === "cosmetic_collection_not_for_sale" && error.statusCode === 409
  );
  await assert.rejects(
    store.buyCosmeticCollection(player.id, "constellore.collection.missing", "cosmetic-missing-kit-001"),
    (error) => error.serviceCode === "cosmetic_collection_missing" && error.statusCode === 404
  );

  store.data.players[player.id].credits = 10_000;
  await store.setFounderPass(player.id, true);
  await assert.rejects(
    store.buyCosmeticCollection(player.id, lunar.id, "cosmetic-owned-kit-001"),
    (error) => error.serviceCode === "cosmetic_collection_already_owned" && error.statusCode === 409
  );
  assert.equal(store.publicPlayer(player.id).credits, 10_000);

  store.data.players[pieceOwner.id].credits = 10_000;
  for (const itemId of Object.values(aurora.preset)) {
    await store.grantCosmeticEntitlement(pieceOwner.id, { itemId, source: "event" });
  }
  assert.ok(store.cosmeticOwnership(pieceOwner.id).collections.includes(aurora.id));
  await assert.rejects(
    store.buyCosmeticCollection(pieceOwner.id, aurora.id, "cosmetic-complete-set-001"),
    (error) => error.serviceCode === "cosmetic_collection_already_owned" && error.statusCode === 409
  );
  assert.equal(store.publicPlayer(pieceOwner.id).credits, 10_000);
  assert.equal(store.data.economyLedger.some((entry) =>
    entry.type === "cosmetic_collection_purchased" && entry.playerId === pieceOwner.id
  ), false);
});

test("server-authoritative Route Ranks unlock hybrid kits and reject redundant purchases without spending", async () => {
  const store = await new GameStore(":memory:").init();
  const rankUnlocks = [
    [aurora, "silver"],
    [solar, "gold"],
    [lunar, "emerald"],
    [eclipse, "master"]
  ];

  for (const [collection, rankId] of rankUnlocks) {
    assert.ok(collection, `${rankId} must have a configured cosmetic collection`);
    const player = await store.registerPlayer();
    store.data.players[player.id].credits = 10_000;
    setAuthoritativeRouteRank(store, player.id, rankId);

    const ownership = store.cosmeticOwnership(player.id);
    assert.ok(
      ownership.collections.includes(collection.id),
      `${rankId} must unlock ${collection.label}`
    );
    assert.ok(
      Object.values(collection.preset).every((itemId) => ownership.items.includes(itemId)),
      `${rankId} must unlock every piece in ${collection.label}`
    );

    const initialBalance = store.publicPlayer(player.id).credits;
    await assert.rejects(
      store.buyCosmeticCollection(
        player.id,
        collection.id,
        `rank-owned-${rankId}-collection`
      ),
      (error) => error.serviceCode === "cosmetic_collection_already_owned"
        && error.statusCode === 409
    );
    assert.equal(store.publicPlayer(player.id).credits, initialBalance);
    assert.equal(store.data.economyLedger.some((entry) =>
      entry.type === "cosmetic_collection_purchased"
      && entry.playerId === player.id
      && entry.collectionId === collection.id
    ), false);

    const cloud = await store.updateCloudProfile(player.id, 0, {
      cosmetics: collection.preset
    });
    assert.deepEqual(cloud.profile.cosmetics, collection.preset);
  }
});

test("Cosmic rank leaves Pixel Frontier, Bubble Reef, and Stellar Vanguard purchase-only", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const purchaseOnly = [pixel, bubble, vanguard];
  assert.ok(purchaseOnly.every(Boolean));

  store.data.players[player.id].credits = 10_000;
  setAuthoritativeRouteRank(store, player.id, "cosmic");

  const rankOwnership = store.cosmeticOwnership(player.id);
  for (const collection of purchaseOnly) {
    assert.equal(rankOwnership.collections.includes(collection.id), false);
    assert.equal(
      Object.values(collection.preset).some((itemId) => rankOwnership.items.includes(itemId)),
      false,
      `Cosmic rank must not unlock any ${collection.label} piece`
    );
  }

  const initialBalance = store.publicPlayer(player.id).credits;
  const purchase = await store.buyCosmeticCollection(
    player.id,
    pixel.id,
    "cosmic-pixel-purchase-001"
  );
  assert.equal(purchase.collection.id, pixel.id);
  assert.equal(purchase.price, pixel.creditPrice);
  assert.equal(purchase.balance, initialBalance - pixel.creditPrice);
  assert.ok(purchase.ownership.collections.includes(pixel.id));
  assert.equal(purchase.ownership.collections.includes(bubble.id), false);
  assert.equal(purchase.ownership.collections.includes(vanguard.id), false);
});

test("earned pieces use server-observed progression, not client-claimed cloud counters", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const cartographer = "constellore.earned.cartographer.word-plaque";
  const firstLight = "constellore.earned.first-light.trail-set";
  const weeklySigil = "constellore.earned.weekly-sigil.gate-style";

  await assert.rejects(
    store.updateCloudProfile(player.id, 0, {
      progression: { wins: 99, stardust: 0, dailyStreak: 0, streakShields: 0 },
      weekly: { key: "2026-W30", stage: 3, complete: true },
      cosmetics: {
        ...DEFAULT_COSMETIC_LOADOUT,
        wordPlaque: cartographer,
        trailSet: firstLight,
        gateStyle: weeklySigil
      }
    }),
    (error) => error.serviceCode === "cosmetic_entitlement_required"
  );

  for (let index = 0; index < 25; index += 1) {
    store.recordLifetimeDiscovery(player.id, `Catalog Word ${index}`);
  }
  store.appendLedger("runLedger", {
    idempotencyKey: `test:cosmetic-win:${player.id}`,
    type: "ranked_run_completed",
    playerId: player.id,
    status: "verified",
    createdAt: new Date().toISOString()
  });
  await store.grantChallengeCredits(player.id, "weekly:2026-W30", 0);

  const ownership = store.cosmeticOwnership(player.id);
  assert.ok([cartographer, firstLight, weeklySigil].every((id) => ownership.earned.includes(id)));
  const updated = await store.updateCloudProfile(player.id, 0, {
    cosmetics: {
      ...DEFAULT_COSMETIC_LOADOUT,
      wordPlaque: cartographer,
      trailSet: firstLight,
      gateStyle: weeklySigil
    }
  });
  assert.equal(updated.profile.cosmetics.wordPlaque, cartographer);
  assert.equal(updated.profile.cosmetics.trailSet, firstLight);
  assert.equal(updated.profile.cosmetics.gateStyle, weeklySigil);

  store.data.players[player.id].lifetimeDiscoveries = {};
  store.data.players[player.id].rewardedChallenges = {};
  const durableOwnership = store.cosmeticOwnership(player.id);
  assert.ok(durableOwnership.earned.includes(cartographer));
  assert.ok(durableOwnership.earned.includes(weeklySigil));
});
