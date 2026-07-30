import {
  COSMETIC_COLLECTIONS,
  COSMETIC_ITEMS,
  COSMETIC_MANIFEST,
  COSMETIC_SCHEMA_VERSION,
  COSMETIC_SLOTS,
  DEFAULT_COSMETIC_LOADOUT,
  LEGACY_COSMETIC_IDS,
  LEGACY_COSMETIC_SLOTS
} from "./cosmetic-catalog.mjs?v=5.0.0-beta.1";

export {
  COSMETIC_COLLECTIONS,
  COSMETIC_ITEMS,
  COSMETIC_MANIFEST,
  COSMETIC_SCHEMA_VERSION,
  COSMETIC_SLOTS,
  DEFAULT_COSMETIC_LOADOUT,
  LEGACY_COSMETIC_IDS,
  LEGACY_COSMETIC_SLOTS
};

/** Backward-compatible catalog export used by existing client integrations. */
export const COSMETIC_CATALOG = COSMETIC_ITEMS;

export const SUPPORTER_COLLECTION_IDS = Object.freeze(
  COSMETIC_COLLECTIONS
    .filter((entry) => entry.access === "supporter")
    .map((entry) => entry.id)
);

export const EARNED_COSMETIC_IDS = Object.freeze(
  COSMETIC_ITEMS
    .filter((entry) => entry.access === "earned")
    .map((entry) => entry.id)
);

export const REAL_MONEY_CATALOG = Object.freeze([
  Object.freeze({
    id: "constellore_founders_pass",
    kind: "entitlement",
    label: "Supporter Pack",
    grants: Object.freeze(["founder_cosmetics"]),
    cosmeticCollections: SUPPORTER_COLLECTION_IDS,
    competitive: false
  })
]);

export const EARNABLE_BADGES = Object.freeze([
  Object.freeze({ id: "first-orbit", icon: "✦", label: "First Orbit", description: "Complete First Orbit training." }),
  Object.freeze({ id: "routefinder", icon: "◇", label: "Routefinder", description: "Reach your first real target." }),
  Object.freeze({ id: "wordsmith", icon: "✋", label: "Wordsmith", description: "Discover 25 unique words." }),
  Object.freeze({ id: "recipe-keeper", icon: "★", label: "Recipe Keeper", description: "Earn 25 recipe-mastery stars." }),
  Object.freeze({ id: "seven-suns", icon: "☼", label: "Seven Suns", description: "Hold a seven-day daily streak." }),
  Object.freeze({ id: "riftwalker", icon: "↯", label: "Riftwalker", description: "Complete a weekly expedition." }),
  Object.freeze({ id: "cosmic-archive", icon: "◉", label: "Cosmic Archive", description: "Discover 100 unique words." })
]);

const itemById = new Map(COSMETIC_ITEMS.map((entry) => [entry.id, entry]));
const collectionById = new Map(COSMETIC_COLLECTIONS.map((entry) => [entry.id, entry]));
const itemByLegacyId = new Map(
  Object.entries(LEGACY_COSMETIC_IDS)
    .map(([legacyId, canonicalId]) => [legacyId, itemById.get(canonicalId)])
    .filter(([, entry]) => entry)
);
const collectionBySlug = new Map(COSMETIC_COLLECTIONS.map((entry) => [entry.slug, entry]));

const legacySlotForCanonical = Object.freeze(
  Object.fromEntries(Object.entries(LEGACY_COSMETIC_SLOTS).map(([legacy, canonical]) => [canonical, legacy]))
);

const legacyIdForCanonical = new Map(
  Object.entries(LEGACY_COSMETIC_IDS).map(([legacy, canonical]) => [canonical, legacy])
);

const slotCssNames = Object.freeze({
  wordPlaque: "word-plaque",
  trailSet: "trail-set",
  boardFinish: "board-finish",
  homeScene: "home-scene",
  gateStyle: "gate-style",
  uiFinish: "ui-finish",
  soundTheme: "sound-theme"
});

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function idSet(...values) {
  const result = new Set();
  for (const value of values) {
    if (typeof value === "string") {
      if (value.trim()) result.add(value.trim());
      continue;
    }
    if (value instanceof Set || Array.isArray(value)) {
      for (const entry of value) {
        const id = String(entry || "").trim();
        if (id) result.add(id);
      }
    }
  }
  return result;
}

function progressValue(progress, key) {
  const source = isRecord(progress) ? progress : {};
  if (key === "discoveries") {
    if (Array.isArray(source.discovered)) return source.discovered.length;
    if (Array.isArray(source.discoveries)) return source.discoveries.length;
    return Math.max(0, Math.floor(Number(source.discoveries) || 0));
  }
  if (key === "wins") {
    return Math.max(0, Math.floor(Number(source.wins ?? source.progression?.wins) || 0));
  }
  if (key === "weeklyComplete") {
    return Boolean(source.weeklyComplete ?? source.weekly?.complete);
  }
  return source[key];
}

function routeRankNumber(progress) {
  const source = isRecord(progress) ? progress : {};
  const routeRank = isRecord(source.routeRank) ? source.routeRank : {};
  const nestedRank = isRecord(routeRank.rank) ? routeRank.rank : {};
  const rank = isRecord(source.rank) ? source.rank : {};
  for (const candidate of [
    source.routeRankNumber,
    source.rankNumber,
    routeRank.number,
    nestedRank.number,
    rank.number
  ]) {
    const value = Math.floor(Number(candidate));
    if (Number.isSafeInteger(value) && value > 0) return value;
  }
  return 0;
}

function entitlementOptions(raw = {}) {
  const source = isRecord(raw) ? raw : {};
  const nested = isRecord(source.entitlements) ? source.entitlements : {};
  return {
    supporter: Boolean(source.supporter || source.founder || source.founderPass || nested.supporter || nested.founder),
    itemIds: idSet(
      source.itemIds,
      source.ownedIds,
      source.explicitItemIds,
      source.cosmeticItemIds,
      nested.items,
      nested.itemIds
    ),
    collectionIds: idSet(
      source.collectionIds,
      source.ownedCollectionIds,
      source.cosmeticCollectionIds,
      nested.collections,
      nested.collectionIds
    ),
    earnedIds: idSet(
      source.earnedIds,
      source.earnedCosmeticIds,
      nested.earned,
      nested.earnedIds
    ),
    progress: source.progress || source.progression || nested.progress || {}
  };
}

export function cosmeticById(rawId, expectedSlot = "") {
  const id = String(rawId || "").trim();
  const entry = itemById.get(id) || itemByLegacyId.get(id.toLowerCase()) || null;
  return entry && (!expectedSlot || entry.slot === canonicalCosmeticSlot(expectedSlot)) ? entry : null;
}

export function cosmeticCollectionById(rawId) {
  const id = String(rawId || "").trim();
  return collectionById.get(id) || collectionBySlug.get(id.toLowerCase()) || null;
}

/**
 * Resolves manifest-rooted /art paths relative to the deployed game module.
 * This keeps the same manifest valid at / locally and under /play/ on Pages.
 */
export function resolveCosmeticAssetUrl(rawPath, moduleUrl = import.meta.url) {
  const assetPath = String(rawPath || "").trim();
  if (!/^\/art\/[A-Za-z0-9._/-]+$/.test(assetPath)) return "";
  return new URL(`.${assetPath}`, moduleUrl).href;
}

export function canonicalCosmeticSlot(rawSlot) {
  const slot = String(rawSlot || "").trim();
  return COSMETIC_SLOTS.includes(slot) ? slot : LEGACY_COSMETIC_SLOTS[slot] || "";
}

export function canonicalCosmeticId(rawId, expectedSlot = "") {
  return cosmeticById(rawId, expectedSlot)?.id || "";
}

export function cosmeticUnlockSatisfied(itemOrId, progress = {}) {
  const entry = typeof itemOrId === "string" ? cosmeticById(itemOrId) : itemOrId;
  if (!entry || entry.access !== "earned" || !entry.unlock) return false;
  const actual = progressValue(progress, entry.unlock.key);
  if ("minimum" in entry.unlock) return Number(actual) >= entry.unlock.minimum;
  return actual === entry.unlock.value;
}

export function cosmeticCollectionRankUnlockSatisfied(collectionOrId, progress = {}) {
  const collection = typeof collectionOrId === "string"
    ? cosmeticCollectionById(collectionOrId)
    : collectionOrId;
  const requiredRank = Math.floor(Number(collection?.rankUnlock?.number));
  return Number.isSafeInteger(requiredRank)
    && requiredRank > 0
    && routeRankNumber(progress) >= requiredRank;
}

export function isCosmeticOwned(itemOrId, options = {}) {
  const entry = typeof itemOrId === "string" ? cosmeticById(itemOrId) : itemOrId;
  if (!entry) return false;
  if (entry.access === "free") return true;
  const ownership = entitlementOptions(options);
  if (ownership.itemIds.has(entry.id)) return true;
  if (entry.collectionId && ownership.collectionIds.has(entry.collectionId)) return true;
  const parentCollection = entry.collectionId ? cosmeticCollectionById(entry.collectionId) : null;
  if (parentCollection && cosmeticCollectionRankUnlockSatisfied(parentCollection, ownership.progress)) return true;
  if (entry.access === "supporter") return ownership.supporter;
  if (entry.access === "earned") {
    return ownership.earnedIds.has(entry.id) || cosmeticUnlockSatisfied(entry, ownership.progress);
  }
  return false;
}

export function ownedCosmeticIds(options = {}) {
  return COSMETIC_ITEMS
    .filter((entry) => isCosmeticOwned(entry, options))
    .map((entry) => entry.id);
}

export function cosmeticOwnershipSnapshot(options = {}) {
  const ownership = entitlementOptions(options);
  const itemIds = ownedCosmeticIds(options);
  const ownedItemIds = new Set(itemIds);
  const collectionIds = COSMETIC_COLLECTIONS
    .filter((entry) => entry.access === "free"
      || ownership.collectionIds.has(entry.id)
      || (entry.access === "supporter" && ownership.supporter)
      || Object.values(entry.preset).every((id) => ownedItemIds.has(id)))
    .map((entry) => entry.id);
  return {
    schemaVersion: COSMETIC_SCHEMA_VERSION,
    supporter: ownership.supporter,
    collections: collectionIds,
    items: itemIds,
    earned: itemIds.filter((id) => itemById.get(id)?.access === "earned")
  };
}

export function cosmeticOptions(rawSlot, options = {}) {
  const slot = canonicalCosmeticSlot(rawSlot);
  if (!slot) return [];
  return COSMETIC_ITEMS
    .filter((entry) => entry.slot === slot)
    .map((entry) => ({ ...entry, owned: isCosmeticOwned(entry, options) }));
}

function collectionHintForLegacyLoadout(source) {
  const requested = cosmeticCollectionById(source.collectionId || source.collection);
  if (requested) return requested;
  const themeItem = cosmeticById(source.uiFinish || source.theme, "uiFinish");
  return themeItem?.collectionId
    ? collectionById.get(themeItem.collectionId)
    : COSMETIC_COLLECTIONS[0];
}

/**
 * Converts schema 7 (theme/board/trail/sound) and mixed transitional profiles
 * to one complete schema 8 loadout. This function does not apply ownership so
 * it can also power locked previews.
 */
export function migrateCosmeticLoadout(raw) {
  const unwrapped = isRecord(raw?.loadout) ? raw.loadout : raw;
  const source = isRecord(unwrapped) ? unwrapped : {};
  const hint = collectionHintForLegacyLoadout(source);
  const result = {};

  for (const slot of COSMETIC_SLOTS) {
    const legacySlot = legacySlotForCanonical[slot];
    const requested = source[slot] ?? (legacySlot ? source[legacySlot] : undefined);
    const selected = cosmeticById(requested, slot);
    result[slot] = selected?.id || hint.preset[slot] || DEFAULT_COSMETIC_LOADOUT[slot];
  }

  return result;
}

export function sanitizeCosmeticLoadout(raw, options = {}) {
  const migrated = migrateCosmeticLoadout(raw);
  return Object.fromEntries(COSMETIC_SLOTS.map((slot) => {
    const entry = cosmeticById(migrated[slot], slot);
    return [slot, entry && isCosmeticOwned(entry, options)
      ? entry.id
      : DEFAULT_COSMETIC_LOADOUT[slot]];
  }));
}

export function resolveCosmeticCollectionLoadout(collectionId) {
  const collection = cosmeticCollectionById(collectionId);
  return collection ? { ...collection.preset } : null;
}

export function equipCosmeticCollection(raw, collectionId, options = {}) {
  const preset = resolveCosmeticCollectionLoadout(collectionId);
  return preset ? sanitizeCosmeticLoadout(preset, options) : sanitizeCosmeticLoadout(raw, options);
}

export function collectionForCosmeticLoadout(raw) {
  const loadout = migrateCosmeticLoadout(raw);
  return COSMETIC_COLLECTIONS.find((collection) =>
    COSMETIC_SLOTS.every((slot) => collection.preset[slot] === loadout[slot])
  ) || null;
}

export function legacyThemeForCosmeticLoadout(raw) {
  const uiFinish = migrateCosmeticLoadout(raw).uiFinish;
  const legacyId = legacyIdForCanonical.get(uiFinish);
  return ["void", "aurora", "solar"].includes(legacyId) ? legacyId : "void";
}

export function cosmeticBodyClasses(raw, options = {}) {
  const loadout = sanitizeCosmeticLoadout(raw, options);
  const exactCollection = collectionForCosmeticLoadout(loadout);
  const classes = [
    `cosmetic-collection--${exactCollection?.slug || "custom"}`
  ];
  for (const slot of COSMETIC_SLOTS) {
    const entry = cosmeticById(loadout[slot], slot);
    if (entry) classes.push(`cosmetic-${slotCssNames[slot]}--${entry.recipe.cssToken}`);
  }
  return classes;
}

/** Existing client name retained while the application migrates to schema 8. */
export function cosmeticClasses(raw, options = {}) {
  const loadout = sanitizeCosmeticLoadout(raw, options);
  const canonical = cosmeticBodyClasses(loadout, options);
  const legacy = [];
  for (const slot of ["uiFinish", "boardFinish", "trailSet", "soundTheme"]) {
    const id = loadout[slot];
    const legacyId = legacyIdForCanonical.get(id);
    const legacySlot = legacySlotForCanonical[slot];
    if (legacyId && legacySlot) legacy.push(`${legacySlot}-${legacyId}`);
  }
  return [...canonical, ...legacy];
}

export const ALL_COSMETIC_BODY_CLASSES = Object.freeze([
  "cosmetic-collection--custom",
  ...COSMETIC_COLLECTIONS.map((entry) => `cosmetic-collection--${entry.slug}`),
  ...COSMETIC_ITEMS.map((entry) => `cosmetic-${slotCssNames[entry.slot]}--${entry.recipe.cssToken}`),
  ...Object.entries(LEGACY_COSMETIC_IDS).map(([legacyId, canonicalId]) => {
    const entry = itemById.get(canonicalId);
    return entry ? `${legacySlotForCanonical[entry.slot]}-${legacyId}` : "";
  }).filter(Boolean)
]);

export function cosmeticTrailStyle(raw = DEFAULT_COSMETIC_LOADOUT.trailSet) {
  const requested = isRecord(raw) ? migrateCosmeticLoadout(raw).trailSet : raw;
  const entry = cosmeticById(requested, "trailSet")
    || cosmeticById(DEFAULT_COSMETIC_LOADOUT.trailSet, "trailSet");
  return {
    id: entry.id,
    ...entry.recipe
  };
}

export function transformFeedbackAudio(audio, soundTheme = DEFAULT_COSMETIC_LOADOUT.soundTheme) {
  if (!audio) return null;
  const requested = isRecord(soundTheme) ? migrateCosmeticLoadout(soundTheme).soundTheme : soundTheme;
  const entry = cosmeticById(requested, "soundTheme")
    || cosmeticById(DEFAULT_COSMETIC_LOADOUT.soundTheme, "soundTheme");
  const recipe = entry.recipe;
  const safe = {
    ...audio,
    tones: Array.isArray(audio.tones) ? audio.tones.map(Number).filter(Number.isFinite).slice(0, 8) : []
  };
  if (recipe.wave !== "default") safe.wave = recipe.wave;
  safe.tones = safe.tones.map((tone) =>
    Math.min(1400, Math.max(80, Math.round(tone * Number(recipe.pitch || 1))))
  );
  if (Number.isFinite(Number(safe.gain))) {
    safe.gain = Math.min(0.08, Math.max(0, Number(safe.gain) * Number(recipe.gain || 1)));
  }
  return safe;
}

export function cosmeticAnalyticsPayload(raw) {
  const loadout = migrateCosmeticLoadout(raw);
  const collection = collectionForCosmeticLoadout(loadout);
  return {
    cosmeticSchema: String(COSMETIC_SCHEMA_VERSION),
    collection: collection?.slug || "custom",
    ...Object.fromEntries(COSMETIC_SLOTS.map((slot) => [
      slot,
      cosmeticById(loadout[slot], slot)?.slug || "unknown"
    ]))
  };
}

export function earnedBadges(raw = {}) {
  const source = isRecord(raw) ? raw : {};
  const firstOrbitCompleted = Boolean(source.firstOrbitCompleted ?? source.firstOrbit?.completed);
  const wins = Math.max(0, Math.floor(Number(source.wins ?? source.progression?.wins) || 0));
  const discoveries = Array.isArray(source.discovered)
    ? source.discovered.length
    : Math.max(0, Math.floor(Number(source.discoveries) || 0));
  const masteryStars = Math.max(0, Math.floor(Number(source.masteryStars) || 0));
  const dailyStreak = Math.max(0, Math.floor(Number(source.dailyStreak ?? source.progression?.dailyStreak) || 0));
  const weeklyComplete = Boolean(source.weeklyComplete ?? source.weekly?.complete);
  const unlocked = new Set([
    ...(firstOrbitCompleted ? ["first-orbit"] : []),
    ...(wins >= 1 ? ["routefinder"] : []),
    ...(discoveries >= 25 ? ["wordsmith"] : []),
    ...(masteryStars >= 25 ? ["recipe-keeper"] : []),
    ...(dailyStreak >= 7 ? ["seven-suns"] : []),
    ...(weeklyComplete ? ["riftwalker"] : []),
    ...(discoveries >= 100 ? ["cosmic-archive"] : [])
  ]);
  return EARNABLE_BADGES.map((badge) => ({ ...badge, earned: unlocked.has(badge.id) }));
}

/** Automatically earned profile aura; it never affects game mechanics. */
export function progressionAuraClass(raw = {}) {
  const count = earnedBadges(raw).filter((badge) => badge.earned).length;
  if (count >= 6) return "aura-prism";
  if (count >= 3) return "aura-nebula";
  if (count >= 1) return "aura-first-light";
  return "aura-none";
}

export function economyIntegrityPolicy() {
  return {
    realMoneyProductKinds: [...new Set(REAL_MONEY_CATALOG.map((entry) => entry.kind))],
    soldForCash: REAL_MONEY_CATALOG.map((entry) => entry.id),
    forbiddenCashProducts: ["star_credits", "word_license", "sense_charge", "score_boost", "extra_moves", "extra_time"],
    cosmeticSchemaVersion: COSMETIC_SCHEMA_VERSION,
    competitiveWordDivision: "open",
    fluctuatingPricesCurrency: "star_credits",
    personalizedPricing: false,
    randomPaidContents: false
  };
}
