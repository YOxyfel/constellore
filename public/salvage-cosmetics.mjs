import {
  COSMETIC_COLLECTIONS,
  COSMETIC_ITEMS
} from "./cosmetic-catalog.mjs?v=5.0.0-beta.4";

/**
 * Salvage Caches may surface individual pieces from rank-reachable original
 * collections. Included cosmetics and purchase-only Theme Worlds are never
 * randomized. The IDs are authored here so both the client and cloud profile
 * sanitizer can apply the same bounded allowlist.
 */
const eligibleCollectionIds = new Set(COSMETIC_COLLECTIONS
  .filter((collection) => Boolean(collection.rankUnlock) && collection.purchaseOnly !== true)
  .map((collection) => collection.id));

const eligibleItems = COSMETIC_ITEMS
  .filter((item) => item.collectionId && eligibleCollectionIds.has(item.collectionId))
  .map((item) => Object.freeze({
    id: item.id,
    label: item.label,
    slot: item.slot,
    access: "salvage",
    salvageEligible: true,
    cosmeticOnly: true,
    gameplayEffect: "none",
    paid: false,
    competitiveAdvantage: false
  }));

export const SALVAGE_COSMETIC_POOL = Object.freeze(eligibleItems);
export const SALVAGE_COSMETIC_IDS = Object.freeze(eligibleItems.map((item) => item.id));

const eligibleIds = new Set(SALVAGE_COSMETIC_IDS);

export function salvageCosmeticPool() {
  return SALVAGE_COSMETIC_POOL.map((item) => ({ ...item }));
}

export function sanitizeSalvageOwnedCosmeticIds(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw
    .map((value) => String(value || "").normalize("NFKC").trim())
    .filter((id) => eligibleIds.has(id)))]
    .sort((left, right) => left.localeCompare(right, "en"));
}

export function isSalvageCosmeticId(raw) {
  return eligibleIds.has(String(raw || "").normalize("NFKC").trim());
}
