export const STARDUST_STORE_VERSION = 1;
export const STARDUST_MAX_BALANCE = 1_000_000_000;
export const STAR_COMPASS_STARDUST_COST = 90;
export const STAR_COMPASS_MAX_RESERVE = 9;
export const STREAK_SHIELD_STARDUST_COST = 240;
export const STREAK_SHIELD_MAX_RESERVE = 3;

const ITEMS = [
  {
    id: "star-compass",
    label: "Star Compass",
    inventoryKey: "sense",
    cost: STAR_COMPASS_STARDUST_COST,
    maxReserve: STAR_COMPASS_MAX_RESERVE,
    use: "declared-open-guidance",
    scoringEffect: "open-division-75-percent",
    description: "Reveals one route direction in the declared Open division."
  },
  {
    id: "streak-shield",
    label: "Streak Shield",
    inventoryKey: "streakShields",
    cost: STREAK_SHIELD_STARDUST_COST,
    maxReserve: STREAK_SHIELD_MAX_RESERVE,
    use: "daily-streak-protection",
    scoringEffect: "none",
    description: "Automatically protects one missed UTC Daily Word day."
  }
];

export const STARDUST_STORE_CATALOG = Object.freeze(ITEMS.map((item) => Object.freeze({
  ...item,
  currency: "earned-stardust",
  exact: true,
  randomized: false,
  paid: false,
  competitiveAdvantage: false
})));

const ITEM_BY_ID = new Map(STARDUST_STORE_CATALOG.map((item) => [item.id, item]));

function integer(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, Math.floor(number)))
    : fallback;
}

function itemId(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLowerCase() : "";
}

export function stardustStoreCatalog() {
  return STARDUST_STORE_CATALOG.map((item) => ({ ...item }));
}

export function sanitizeStardustStoreState(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const inventory = source.inventory && typeof source.inventory === "object" && !Array.isArray(source.inventory)
    ? source.inventory
    : {};
  const powerups = source.powerups && typeof source.powerups === "object" && !Array.isArray(source.powerups)
    ? source.powerups
    : {};
  return {
    version: STARDUST_STORE_VERSION,
    stardust: integer(source.stardust ?? source.balance, 0, STARDUST_MAX_BALANCE, 0),
    inventory: {
      sense: integer(inventory.sense ?? powerups.sense ?? source.sense, 0, STAR_COMPASS_MAX_RESERVE, 0),
      streakShields: integer(
        inventory.streakShields ?? source.streakShields,
        0,
        STREAK_SHIELD_MAX_RESERVE,
        0
      )
    }
  };
}

function quoteResult(state, item, quantity, reason, quoted) {
  const before = item ? state.inventory[item.inventoryKey] : 0;
  const total = item && quoted ? item.cost * quantity : 0;
  const inventoryDelta = item && quoted ? quantity : 0;
  return {
    version: STARDUST_STORE_VERSION,
    quoted,
    reason,
    item: item ? { ...item } : null,
    itemId: item?.id || "",
    quantity,
    currency: "stardust",
    cost: {
      unit: item?.cost || 0,
      total
    },
    balance: {
      before: state.stardust,
      after: state.stardust - total,
      delta: total ? -total : 0
    },
    inventory: {
      key: item?.inventoryKey || "",
      before,
      after: before + inventoryDelta,
      delta: inventoryDelta,
      maxReserve: item?.maxReserve || 0
    }
  };
}

export function quoteStardustPurchase(rawState, rawItemId, rawQuantity = 1) {
  const state = sanitizeStardustStoreState(rawState);
  const item = ITEM_BY_ID.get(itemId(rawItemId)) || null;
  if (!item) return quoteResult(state, null, 0, "unknown_item", false);
  const quantity = Number(rawQuantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    return quoteResult(state, item, 0, "invalid_quantity", false);
  }
  const reserve = state.inventory[item.inventoryKey];
  if (reserve >= item.maxReserve) return quoteResult(state, item, quantity, "reserve_full", false);
  if (quantity > item.maxReserve - reserve) {
    return quoteResult(state, item, quantity, "reserve_limit", false);
  }
  if (state.stardust < item.cost * quantity) {
    return quoteResult(state, item, quantity, "insufficient_stardust", false);
  }
  return quoteResult(state, item, quantity, "quoted", true);
}

export function applyStardustPurchase(rawState, rawItemId, rawQuantity = 1) {
  const state = sanitizeStardustStoreState(rawState);
  const quote = quoteStardustPurchase(state, rawItemId, rawQuantity);
  if (!quote.quoted) return { ...quote, applied: false, state };
  const next = {
    version: STARDUST_STORE_VERSION,
    stardust: quote.balance.after,
    inventory: { ...state.inventory }
  };
  next.inventory[quote.inventory.key] = quote.inventory.after;
  return {
    ...quote,
    applied: true,
    reason: "applied",
    state: next
  };
}
