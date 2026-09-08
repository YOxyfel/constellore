import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  COSMETIC_COLLECTIONS,
  COSMETIC_ITEMS
} from "../public/cosmetic-catalog.mjs";
import {
  SALVAGE_COSMETIC_IDS,
  isSalvageCosmeticId,
  salvageCosmeticPool,
  sanitizeSalvageOwnedCosmeticIds
} from "../public/salvage-cosmetics.mjs";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("salvage cosmetics are bounded to rank-reachable, non-purchase-only pieces", () => {
  const collections = new Map(COSMETIC_COLLECTIONS.map((entry) => [entry.id, entry]));
  const items = new Map(COSMETIC_ITEMS.map((entry) => [entry.id, entry]));
  assert.ok(SALVAGE_COSMETIC_IDS.length >= 20, "the Moon cache needs a useful cosmetic pool");
  for (const id of SALVAGE_COSMETIC_IDS) {
    const item = items.get(id);
    const collection = collections.get(item?.collectionId);
    assert.ok(item, `missing authored cosmetic ${id}`);
    assert.ok(collection?.rankUnlock, `${id} must remain reachable through play`);
    assert.equal(collection.purchaseOnly, false, `${id} must not come from a purchase-only collection`);
  }
});

test("salvage descriptors have no gameplay or paid entitlement effect", () => {
  for (const item of salvageCosmeticPool()) {
    assert.equal(item.access, "salvage");
    assert.equal(item.salvageEligible, true);
    assert.equal(item.cosmeticOnly, true);
    assert.equal(item.gameplayEffect, "none");
    assert.equal(item.paid, false);
    assert.equal(item.competitiveAdvantage, false);
  }
});

test("saved salvage ownership drops unknown and purchase-only IDs", () => {
  const eligible = SALVAGE_COSMETIC_IDS[0];
  const purchaseOnly = COSMETIC_ITEMS.find((item) => (
    COSMETIC_COLLECTIONS.find((collection) => collection.id === item.collectionId)?.purchaseOnly
  ))?.id;
  assert.deepEqual(
    sanitizeSalvageOwnedCosmeticIds([eligible, eligible, purchaseOnly, "forged.cosmetic"]),
    [eligible]
  );
  assert.equal(isSalvageCosmeticId(eligible), true);
  assert.equal(isSalvageCosmeticId(purchaseOnly), false);
});

test("local profile migration validates equipped cosmetics with cache-earned ownership", () => {
  assert.match(appSource, /const expedition = sanitizeExpeditionState\(stored[.]expedition, \{ worldweaving \}\)/);
  assert.match(appSource, /itemIds: \[[.][.][.]new Set\(\[[.][.][.]cosmeticOwnership[.]items, [.][.][.]expedition[.]salvageCosmeticIds\]\)\]/);
  assert.match(appSource, /cosmetics: sanitizeCosmeticLoadout\(stored[.]cosmetics[^\n]+cosmeticAccess\)/);
});
