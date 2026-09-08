import {
  STAR_COMPASS_MAX_RESERVE,
  STARDUST_MAX_BALANCE,
  STREAK_SHIELD_MAX_RESERVE
} from "./stardust-store.mjs?v=5.0.0-beta.4";

export const SALVAGE_CACHE_VERSION = 1;
export const SALVAGE_SELECTION_SHARD_GOAL = 4;
export const SALVAGE_RECEIPT_LIMIT = 96;

const MAX_COUNTER = 1_000_000_000;
const MAX_SELECTION_SHARDS = 9_999;
const RECEIPT_PATTERN = /^sc1-[0-9a-f]{16}$/;

export const SALVAGE_REWARD_POLICY = Object.freeze({
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

const TIER_DEFINITIONS = [
  {
    id: "common",
    label: "Common Salvage Cache",
    description: "A small sealed find from the Moon Outpost perimeter.",
    cost: 100,
    pityEvery: 8,
    requiredCapability: "",
    moonReachable: true,
    duplicateConversion: { stardust: 50, selectionShards: 1 },
    odds: [
      { id: "star-compass", label: "Star Compass", chanceBasisPoints: 4_800, quantity: 1 },
      { id: "streak-shield", label: "Streak Shield", chanceBasisPoints: 1_500, quantity: 1 },
      { id: "salvage-stardust", label: "Stardust salvage", chanceBasisPoints: 2_500, quantity: 45 },
      { id: "cosmetic", label: "Moon-cache cosmetic", chanceBasisPoints: 1_200, quantity: 1 }
    ]
  },
  {
    id: "rare",
    label: "Rare Salvage Cache",
    description: "A recovered cache from the inhabited lunar routes.",
    cost: 350,
    pityEvery: 5,
    requiredCapability: "",
    moonReachable: true,
    duplicateConversion: { stardust: 175, selectionShards: 1 },
    odds: [
      { id: "star-compass", label: "Star Compass pair", chanceBasisPoints: 3_500, quantity: 2 },
      { id: "streak-shield", label: "Streak Shield", chanceBasisPoints: 1_800, quantity: 1 },
      { id: "salvage-stardust", label: "Stardust salvage", chanceBasisPoints: 1_700, quantity: 140 },
      { id: "cosmetic", label: "Moon-cache cosmetic", chanceBasisPoints: 3_000, quantity: 1 }
    ]
  },
  {
    id: "epic",
    label: "Epic Salvage Cache",
    description: "A rare recovery from the Moon's far horizon.",
    cost: 900,
    pityEvery: 3,
    requiredCapability: "salvage-cache.epic",
    moonReachable: false,
    duplicateConversion: { stardust: 450, selectionShards: 1 },
    odds: [
      { id: "star-compass", label: "Star Compass bundle", chanceBasisPoints: 1_800, quantity: 3 },
      { id: "streak-shield", label: "Streak Shield", chanceBasisPoints: 900, quantity: 1 },
      { id: "salvage-stardust", label: "Stardust salvage", chanceBasisPoints: 800, quantity: 375 },
      { id: "cosmetic", label: "Moon-cache cosmetic", chanceBasisPoints: 6_500, quantity: 1 }
    ]
  },
  {
    id: "mythic",
    label: "Mythic Salvage Cache",
    description: "A singular sealed recovery from beyond the mapped lunar routes.",
    cost: 2_400,
    pityEvery: 1,
    requiredCapability: "salvage-cache.mythic",
    moonReachable: false,
    guaranteedUnownedUntilComplete: true,
    duplicateConversion: { stardust: 1_200, selectionShards: 1 },
    odds: [
      { id: "cosmetic", label: "Guaranteed Moon-cache cosmetic", chanceBasisPoints: 10_000, quantity: 1 }
    ]
  }
];

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

export const SALVAGE_CACHE_TIERS = deepFreeze(TIER_DEFINITIONS.map((tier) => ({
  ...tier,
  payment: {
    currency: "earned-stardust",
    amount: tier.cost,
    purchasable: false,
    cashPurchase: false
  },
  odds: tier.odds.map((outcome) => ({
    ...outcome,
    chancePercent: outcome.chanceBasisPoints / 100
  })),
  guarantee: {
    kind: "new-cosmetic-pity",
    maximumMisses: tier.pityEvery - 1,
    guaranteedByOpen: tier.pityEvery,
    requiresUnownedEligibleCosmetic: true
  },
  noEmptyOutcomes: true,
  activeRunEligible: false,
  scoreDelta: 0,
  rankDelta: 0,
  masteryDelta: 0,
  competitiveAdvantage: false
})));

const TIER_BY_ID = new Map(SALVAGE_CACHE_TIERS.map((tier) => [tier.id, tier]));

for (const tier of SALVAGE_CACHE_TIERS) {
  const total = tier.odds.reduce((sum, outcome) => sum + outcome.chanceBasisPoints, 0);
  if (total !== 10_000 || tier.odds.some((outcome) => outcome.chanceBasisPoints <= 0)) {
    throw new Error(`Invalid visible odds for salvage cache tier: ${tier.id}`);
  }
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function integer(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, Math.floor(number)))
    : fallback;
}

function normalizedText(value, maximum = 256) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").trim().slice(0, maximum);
}

function normalizedId(value) {
  return normalizedText(value, 240).toLowerCase();
}

function uniqueIds(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(normalizedId).filter(Boolean))].sort();
}

function hash32(text, basis) {
  let hash = basis >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash >>> 0;
}

function hexadecimal(value) {
  return (value >>> 0).toString(16).padStart(8, "0");
}

/**
 * A privacy-preserving local idempotency fingerprint, not a cryptographic proof.
 * Production settlement should still use a server-authored receipt and entropy.
 */
export function salvageReceiptFingerprint(rawReceiptId) {
  const receiptId = normalizedText(rawReceiptId, 256);
  if (!receiptId) return "";
  return `sc1-${hexadecimal(hash32(`a:${receiptId}`, 2_166_136_261))}${hexadecimal(hash32(`b:${receiptId}`, 2_824_369_621))}`;
}

function draw(seed, purpose, range) {
  if (!Number.isInteger(range) || range < 1) return 0;
  return hash32(`${purpose}\u001f${seed}`, 2_166_136_261) % range;
}

function tierCounters(raw, fallback = 0) {
  const source = record(raw);
  return Object.fromEntries(SALVAGE_CACHE_TIERS.map((tier) => [
    tier.id,
    integer(source[tier.id], 0, MAX_COUNTER, fallback)
  ]));
}

function pityCounters(raw) {
  const source = record(raw);
  return Object.fromEntries(SALVAGE_CACHE_TIERS.map((tier) => [
    tier.id,
    integer(source[tier.id], 0, Math.max(0, tier.pityEvery - 1), 0)
  ]));
}

export function createSalvageCacheState() {
  return {
    version: SALVAGE_CACHE_VERSION,
    opensByTier: tierCounters({}),
    pityMissesByTier: pityCounters({}),
    selectionShards: 0,
    receiptFingerprints: []
  };
}

export function sanitizeSalvageCacheState(raw) {
  const source = record(raw);
  const rawReceipts = Array.isArray(source.receiptFingerprints) ? source.receiptFingerprints : [];
  const receiptFingerprints = [...new Set(rawReceipts
    .map((value) => normalizedText(value, 32).toLowerCase())
    .filter((value) => RECEIPT_PATTERN.test(value)))]
    .slice(-SALVAGE_RECEIPT_LIMIT);
  return {
    version: SALVAGE_CACHE_VERSION,
    opensByTier: tierCounters(source.opensByTier ?? source.opens),
    pityMissesByTier: pityCounters(source.pityMissesByTier ?? source.pity),
    selectionShards: integer(source.selectionShards, 0, MAX_SELECTION_SHARDS, 0),
    receiptFingerprints
  };
}

export function salvageCacheCatalog() {
  return {
    version: SALVAGE_CACHE_VERSION,
    policy: clone(SALVAGE_REWARD_POLICY),
    selectionShardGoal: SALVAGE_SELECTION_SHARD_GOAL,
    tiers: clone(SALVAGE_CACHE_TIERS)
  };
}

/**
 * Only explicitly curated, earn-only cosmetic descriptors can enter a cache.
 * This prevents a caller from accidentally putting supporter or purchase-only
 * catalog items in the randomized pool.
 */
export function sanitizeSalvageCosmeticPool(rawPool) {
  if (!Array.isArray(rawPool)) return [];
  const byId = new Map();
  for (const rawItem of rawPool) {
    const item = record(rawItem);
    const id = normalizedId(item.id);
    const access = normalizedId(item.access);
    if (
      !id
      || item.salvageEligible !== true
      || item.cosmeticOnly !== true
      || normalizedId(item.gameplayEffect) !== "none"
      || item.paid !== false
      || !["earned", "everyone", "salvage"].includes(access)
    ) continue;
    byId.set(id, {
      id,
      label: normalizedText(item.label, 80) || id,
      slot: normalizedId(item.slot ?? item.kind) || "cosmetic",
      access,
      salvageEligible: true,
      cosmeticOnly: true,
      gameplayEffect: "none",
      paid: false,
      competitiveAdvantage: false
    });
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function sanitizeResources(raw) {
  const source = record(raw);
  const inventory = record(source.inventory);
  const powerups = record(source.powerups);
  return {
    stardust: integer(source.stardust ?? source.balance, 0, STARDUST_MAX_BALANCE, 0),
    inventory: {
      sense: integer(
        inventory.sense ?? source.senseCharges ?? source.sense ?? powerups.sense,
        0,
        STAR_COMPASS_MAX_RESERVE,
        0
      ),
      streakShields: integer(
        inventory.streakShields ?? source.streakShields,
        0,
        STREAK_SHIELD_MAX_RESERVE,
        0
      )
    },
    ownedCosmeticIds: uniqueIds(
      source.ownedCosmeticIds
      ?? record(source.cosmeticOwnership).items
    )
  };
}

function isActiveRun(options) {
  return options.activeRun === true || options.rankedRun === true || options.runActive === true;
}

function tierId(value) {
  return normalizedId(value);
}

function hasTierCapability(tier, rawCapabilities) {
  if (!tier?.requiredCapability) return true;
  if (Array.isArray(rawCapabilities)) {
    return rawCapabilities.map(normalizedId).includes(tier.requiredCapability);
  }
  const capabilities = record(rawCapabilities);
  return capabilities[tier.requiredCapability] === true;
}

function quoteResult(state, resources, tier, quoted, reason) {
  const listedCost = tier?.cost || 0;
  const charged = quoted ? listedCost : 0;
  const pityBefore = tier ? state.pityMissesByTier[tier.id] : 0;
  return {
    version: SALVAGE_CACHE_VERSION,
    quoted,
    reason,
    tier: tier ? clone(tier) : null,
    payment: {
      currency: "earned-stardust",
      source: "earned-only",
      purchasable: false,
      cashPurchase: false,
      listed: listedCost,
      charged
    },
    balance: {
      before: resources.stardust,
      after: resources.stardust - charged,
      delta: charged ? -charged : 0
    },
    pity: {
      before: pityBefore,
      threshold: tier?.pityEvery || 0,
      guaranteedNextIfEligible: Boolean(tier && pityBefore >= tier.pityEvery - 1)
    },
    policy: clone(SALVAGE_REWARD_POLICY)
  };
}

export function quoteSalvageCacheOpen(rawState, rawOptions = {}) {
  const state = sanitizeSalvageCacheState(rawState);
  const options = record(rawOptions);
  const resources = sanitizeResources(options.resources ?? options);
  const tier = TIER_BY_ID.get(tierId(options.tierId)) || null;
  if (!tier) return quoteResult(state, resources, null, false, "unknown_tier");
  if (isActiveRun(options)) return quoteResult(state, resources, tier, false, "active_run_blocked");
  if (!hasTierCapability(tier, options.capabilities)) {
    return quoteResult(state, resources, tier, false, "capability_locked");
  }
  if (sanitizeSalvageCosmeticPool(options.eligibleCosmetics).length === 0) {
    return quoteResult(state, resources, tier, false, "missing_eligible_cosmetics");
  }
  if (resources.stardust < tier.cost) {
    return quoteResult(state, resources, tier, false, "insufficient_stardust");
  }
  return quoteResult(state, resources, tier, true, "quoted");
}

function appendReceipt(state, fingerprint) {
  return [...state.receiptFingerprints.filter((value) => value !== fingerprint), fingerprint]
    .slice(-SALVAGE_RECEIPT_LIMIT);
}

function weightedOutcome(tier, roll) {
  let cursor = 0;
  for (const outcome of tier.odds) {
    cursor += outcome.chanceBasisPoints;
    if (roll < cursor) return outcome;
  }
  return tier.odds[tier.odds.length - 1];
}

function baseGrant(id, label, category) {
  return {
    id,
    label,
    category,
    stardust: 0,
    inventory: { sense: 0, streakShields: 0 },
    cosmeticId: "",
    selectionShards: 0,
    empty: false,
    scoreDelta: 0,
    rankDelta: 0,
    masteryDelta: 0,
    competitiveAdvantage: false,
    activationPolicy: "none"
  };
}

function stardustGrant(quantity, label = "Stardust salvage") {
  const grant = baseGrant("salvage-stardust", label, "supply");
  grant.stardust = Math.max(1, integer(quantity, 1, STARDUST_MAX_BALANCE, 1));
  return grant;
}

function resolveSupply(outcome, resources) {
  if (outcome.id === "salvage-stardust") {
    return { grant: stardustGrant(outcome.quantity), substitutedBecause: "" };
  }
  if (outcome.id === "star-compass") {
    const room = STAR_COMPASS_MAX_RESERVE - resources.inventory.sense;
    const quantity = Math.min(room, outcome.quantity);
    if (quantity < 1) {
      return {
        grant: stardustGrant(45 * outcome.quantity, "Reserve-full Stardust conversion"),
        substitutedBecause: "star_compass_reserve_full"
      };
    }
    const grant = baseGrant("star-compass", outcome.label, "powerup");
    grant.inventory.sense = quantity;
    grant.stardust = 45 * Math.max(0, outcome.quantity - quantity);
    grant.activationPolicy = "existing-open-division-75-percent";
    return {
      grant,
      substitutedBecause: quantity < outcome.quantity ? "star_compass_reserve_partially_full" : ""
    };
  }
  if (outcome.id === "streak-shield") {
    const room = STREAK_SHIELD_MAX_RESERVE - resources.inventory.streakShields;
    const quantity = Math.min(room, outcome.quantity);
    if (quantity < 1) {
      return {
        grant: stardustGrant(120 * outcome.quantity, "Reserve-full Stardust conversion"),
        substitutedBecause: "streak_shield_reserve_full"
      };
    }
    const grant = baseGrant("streak-shield", outcome.label, "powerup");
    grant.inventory.streakShields = quantity;
    grant.stardust = 120 * Math.max(0, outcome.quantity - quantity);
    grant.activationPolicy = "existing-daily-streak-protection";
    return {
      grant,
      substitutedBecause: quantity < outcome.quantity ? "streak_shield_reserve_partially_full" : ""
    };
  }
  return { grant: stardustGrant(1, "Safe salvage conversion"), substitutedBecause: "unknown_supply" };
}

function resolveCosmetic(tier, pool, ownedIds, seed, forcedByPity) {
  const owned = new Set(ownedIds);
  const unowned = pool.filter((item) => !owned.has(item.id));
  const candidates = forcedByPity && unowned.length > 0 ? unowned : pool;
  const cosmetic = candidates[draw(seed, "cosmetic", candidates.length)];
  if (!cosmetic || owned.has(cosmetic.id)) {
    const grant = baseGrant("duplicate-conversion", "Duplicate converted", "conversion");
    grant.stardust = tier.duplicateConversion.stardust;
    grant.selectionShards = tier.duplicateConversion.selectionShards;
    return { grant, cosmetic: cosmetic || null, newlyUnlocked: false };
  }
  const grant = baseGrant("cosmetic", cosmetic.label, "cosmetic");
  grant.cosmeticId = cosmetic.id;
  grant.cosmeticOnly = true;
  grant.gameplayEffect = "none";
  return { grant, cosmetic, newlyUnlocked: true };
}

function unchangedOpenResult(state, resources, tier, reason) {
  return {
    version: SALVAGE_CACHE_VERSION,
    opened: false,
    reason,
    tier: tier ? clone(tier) : null,
    debit: { currency: "earned-stardust", amount: 0 },
    grant: null,
    settlement: {
      scoreDelta: 0,
      rankDelta: 0,
      masteryDelta: 0,
      competitiveAdvantage: false
    },
    state,
    resources
  };
}

export function openSalvageCache(rawState, rawOptions = {}) {
  const state = sanitizeSalvageCacheState(rawState);
  const options = record(rawOptions);
  const resources = sanitizeResources(options.resources ?? options);
  const tier = TIER_BY_ID.get(tierId(options.tierId)) || null;
  const receiptId = normalizedText(options.receiptId ?? options.openingId, 256);
  const fingerprint = salvageReceiptFingerprint(receiptId);
  if (!fingerprint) return unchangedOpenResult(state, resources, tier, "invalid_receipt");
  if (state.receiptFingerprints.includes(fingerprint)) {
    return unchangedOpenResult(state, resources, tier, "duplicate_receipt");
  }
  const entropy = normalizedText(options.entropy, 512);
  if (!entropy) return unchangedOpenResult(state, resources, tier, "invalid_entropy");

  const quote = quoteSalvageCacheOpen(state, { ...options, resources });
  if (!quote.quoted) return unchangedOpenResult(state, resources, tier, quote.reason);

  const pool = sanitizeSalvageCosmeticPool(options.eligibleCosmetics);
  const owned = new Set(resources.ownedCosmeticIds);
  const unownedBefore = pool.filter((item) => !owned.has(item.id));
  const pityBefore = state.pityMissesByTier[tier.id];
  const forcedByPity = unownedBefore.length > 0 && pityBefore >= tier.pityEvery - 1;
  const openingNumber = state.opensByTier[tier.id] + 1;
  const seed = `${SALVAGE_CACHE_VERSION}|${tier.id}|${openingNumber}|${receiptId}|${entropy}`;
  const roll = draw(seed, "outcome", 10_000);
  const naturalOutcome = weightedOutcome(tier, roll);
  const resolvedOutcome = forcedByPity
    ? tier.odds.find((outcome) => outcome.id === "cosmetic")
    : naturalOutcome;

  let grant;
  let substitutedBecause = "";
  let cosmetic = null;
  let newlyUnlocked = false;
  if (resolvedOutcome.id === "cosmetic") {
    const resolved = resolveCosmetic(tier, pool, resources.ownedCosmeticIds, seed, forcedByPity);
    ({ grant, cosmetic, newlyUnlocked } = resolved);
  } else {
    ({ grant, substitutedBecause } = resolveSupply(resolvedOutcome, resources));
  }

  const nextOwned = [...resources.ownedCosmeticIds];
  if (grant.cosmeticId && !owned.has(grant.cosmeticId)) nextOwned.push(grant.cosmeticId);
  nextOwned.sort();
  const nextResources = {
    stardust: integer(
      resources.stardust - tier.cost + grant.stardust,
      0,
      STARDUST_MAX_BALANCE,
      0
    ),
    inventory: {
      sense: integer(
        resources.inventory.sense + grant.inventory.sense,
        0,
        STAR_COMPASS_MAX_RESERVE,
        resources.inventory.sense
      ),
      streakShields: integer(
        resources.inventory.streakShields + grant.inventory.streakShields,
        0,
        STREAK_SHIELD_MAX_RESERVE,
        resources.inventory.streakShields
      )
    },
    ownedCosmeticIds: nextOwned
  };

  const nextPity = unownedBefore.length === 0
    ? 0
    : newlyUnlocked
      ? 0
      : Math.min(tier.pityEvery - 1, pityBefore + 1);
  const nextState = {
    ...state,
    opensByTier: {
      ...state.opensByTier,
      [tier.id]: Math.min(MAX_COUNTER, openingNumber)
    },
    pityMissesByTier: {
      ...state.pityMissesByTier,
      [tier.id]: nextPity
    },
    selectionShards: integer(
      state.selectionShards + grant.selectionShards,
      0,
      MAX_SELECTION_SHARDS,
      state.selectionShards
    ),
    receiptFingerprints: appendReceipt(state, fingerprint)
  };
  const unownedAfter = pool.filter((item) => !nextOwned.includes(item.id));

  return {
    version: SALVAGE_CACHE_VERSION,
    opened: true,
    reason: "opened",
    tier: clone(tier),
    debit: { currency: "earned-stardust", amount: tier.cost },
    grant,
    outcome: {
      rollBasisPoints: roll,
      natural: naturalOutcome.id,
      resolved: grant.id,
      forcedByPity,
      substitutedBecause,
      cosmetic: cosmetic ? clone(cosmetic) : null
    },
    pity: {
      before: pityBefore,
      after: nextPity,
      threshold: tier.pityEvery,
      forced: forcedByPity,
      guaranteedNextIfEligible: unownedAfter.length > 0 && nextPity >= tier.pityEvery - 1
    },
    settlement: {
      stardustDelta: nextResources.stardust - resources.stardust,
      scoreDelta: 0,
      rankDelta: 0,
      masteryDelta: 0,
      competitiveAdvantage: false,
      appliesToActiveRun: false
    },
    state: nextState,
    resources: nextResources
  };
}

function unchangedSelectionResult(state, resources, reason) {
  return {
    version: SALVAGE_CACHE_VERSION,
    redeemed: false,
    reason,
    cost: { selectionShards: 0 },
    grant: null,
    state,
    resources
  };
}

export function redeemSalvageSelection(rawState, rawOptions = {}) {
  const state = sanitizeSalvageCacheState(rawState);
  const options = record(rawOptions);
  const resources = sanitizeResources(options.resources ?? options);
  const receiptId = normalizedText(options.receiptId ?? options.selectionId, 256);
  const fingerprint = salvageReceiptFingerprint(receiptId);
  if (!fingerprint) return unchangedSelectionResult(state, resources, "invalid_receipt");
  if (state.receiptFingerprints.includes(fingerprint)) {
    return unchangedSelectionResult(state, resources, "duplicate_receipt");
  }
  if (isActiveRun(options)) {
    return unchangedSelectionResult(state, resources, "active_run_blocked");
  }
  if (state.selectionShards < SALVAGE_SELECTION_SHARD_GOAL) {
    return unchangedSelectionResult(state, resources, "insufficient_selection_shards");
  }
  const pool = sanitizeSalvageCosmeticPool(options.eligibleCosmetics);
  const selectedId = normalizedId(options.cosmeticId);
  const selected = pool.find((item) => item.id === selectedId) || null;
  if (!selected) return unchangedSelectionResult(state, resources, "ineligible_cosmetic");
  if (resources.ownedCosmeticIds.includes(selected.id)) {
    return unchangedSelectionResult(state, resources, "already_owned");
  }

  const grant = baseGrant("selection-cosmetic", selected.label, "cosmetic");
  grant.cosmeticId = selected.id;
  grant.cosmeticOnly = true;
  grant.gameplayEffect = "none";
  const nextState = {
    ...state,
    selectionShards: state.selectionShards - SALVAGE_SELECTION_SHARD_GOAL,
    receiptFingerprints: appendReceipt(state, fingerprint)
  };
  return {
    version: SALVAGE_CACHE_VERSION,
    redeemed: true,
    reason: "redeemed",
    cost: { selectionShards: SALVAGE_SELECTION_SHARD_GOAL },
    grant,
    settlement: {
      scoreDelta: 0,
      rankDelta: 0,
      masteryDelta: 0,
      competitiveAdvantage: false,
      appliesToActiveRun: false
    },
    state: nextState,
    resources: {
      stardust: resources.stardust,
      inventory: { ...resources.inventory },
      ownedCosmeticIds: [...resources.ownedCosmeticIds, selected.id].sort()
    }
  };
}
