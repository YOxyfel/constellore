import {
  availableWordBloomFacets,
  filterWordsBySemanticFacet,
  normalizeWordBloomFacet,
  WORD_BLOOM_SEMANTIC_FACETS
} from "./word-semantic-facets.mjs?v=5.0.0-beta.4";

const WORD_LENS_FILTERS = Object.freeze(["all", "recent", "new", "starters", "az"]);
const WORD_LENS_FILTER_SET = new Set(WORD_LENS_FILTERS);

export const WORD_BLOOM_CATEGORIES = Object.freeze([
  Object.freeze({ id: "discoveries", label: "Recent discoveries", shortLabel: "New", x: -1, y: -1 }),
  Object.freeze({ id: "used", label: "Last used", shortLabel: "Recent", x: 1, y: -1 }),
  Object.freeze({ id: "search", label: "Browse and search", shortLabel: "Browse", x: -1, y: 1 }),
  Object.freeze({ id: "basics", label: "Basic words", shortLabel: "Basics", x: 1, y: 1 })
]);

const WORD_BLOOM_CATEGORY_SET = new Set(WORD_BLOOM_CATEGORIES.map(({ id }) => id));

function normalizedText(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en");
}

function itemKeys(item) {
  if (!item || typeof item !== "object") return [];
  const keys = [normalizedText(item.word), normalizedText(item.id)].filter(Boolean);
  return [...new Set(keys)];
}

function identityKey(item) {
  return normalizedText(item?.word);
}

function validUniqueWords(words) {
  if (!Array.isArray(words)) return [];
  const seen = new Set();
  const unique = [];

  for (const item of words) {
    if (!item || typeof item !== "object" || item.ghost) continue;
    const key = identityKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function listValues(values) {
  if (Array.isArray(values)) return values;
  if (values instanceof Set) return [...values];
  return [];
}

function listKeys(value) {
  if (value && typeof value === "object") return itemKeys(value);
  const key = normalizedText(value);
  return key ? [key] : [];
}

function rankList(values) {
  const ranks = new Map();
  listValues(values).forEach((value, index) => {
    for (const key of listKeys(value)) {
      if (!ranks.has(key)) ranks.set(key, index);
    }
  });
  return ranks;
}

function listRank(item, ranks) {
  let best = Infinity;
  for (const key of itemKeys(item)) best = Math.min(best, ranks.get(key) ?? Infinity);
  return best;
}

function sharesIdentity(left, right) {
  const rightKeys = new Set(itemKeys(right));
  return rightKeys.size > 0 && itemKeys(left).some((key) => rightKeys.has(key));
}

function isOrigin(item, starterRank) {
  if (Number.isFinite(starterRank)) return true;
  return normalizedText(item?.source) === "origin";
}

function sourceTimestamp(item) {
  for (const value of [item?.discoveredAt, item?.createdAt, item?.updatedAt]) {
    const timestamp = typeof value === "number" ? value : Date.parse(value);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

function numericLimit(value, fallback, maximum = Infinity) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? Math.floor(numeric) : fallback;
  return Math.min(Math.max(0, safe), maximum);
}

export function normalizeWordBloomCategory(value) {
  const normalized = normalizedText(value).replace(/[\s_]+/g, "-");
  if (["new", "newest", "discovery", "recent-discoveries"].includes(normalized)) return "discoveries";
  if (["recent", "last", "last-used"].includes(normalized)) return "used";
  if (["basic", "origin", "origins", "starter", "starters"].includes(normalized)) return "basics";
  return WORD_BLOOM_CATEGORY_SET.has(normalized) ? normalized : "basics";
}

export function classifyWordBloomDirection(dx, dy, { deadZone = 30 } = {}) {
  const x = Number(dx) || 0;
  const y = Number(dy) || 0;
  const threshold = Math.max(8, Number(deadZone) || 30);
  if (Math.hypot(x, y) < threshold) return null;
  if (x < 0 && y < 0) return "discoveries";
  if (x >= 0 && y < 0) return "used";
  if (x < 0) return "search";
  return "basics";
}

export function previewWordBloomSwipe(dx, dy, { layout = [], focusIndex = -1, deadZone = 26 } = {}) {
  const x = Number(dx) || 0;
  const y = Number(dy) || 0;
  const threshold = Math.max(8, Number(deadZone) || 26);
  if (Math.hypot(x, y) < threshold || !Array.isArray(layout) || layout.length === 0) {
    return { moved: false, changed: false, focusIndex: Number(focusIndex) };
  }

  const angle = Math.atan2(y, x);
  let best = 0;
  let distance = Infinity;
  layout.forEach((position, index) => {
    const candidateAngle = Number(position?.angle);
    if (!Number.isFinite(candidateAngle)) return;
    const delta = Math.abs(Math.atan2(Math.sin(angle - candidateAngle), Math.cos(angle - candidateAngle)));
    if (delta < distance) {
      distance = delta;
      best = index;
    }
  });
  const previous = Number(focusIndex);
  return { moved: true, changed: best !== previous, focusIndex: best };
}

function mergeRankedWordLists(words, ...lists) {
  const candidates = validUniqueWords(words);
  const byKey = new Map(candidates.map((item) => [identityKey(item), item]));
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const value of listValues(list)) {
      const item = value && typeof value === "object" ? byKey.get(identityKey(value)) : byKey.get(normalizedText(value));
      const itemKey = identityKey(item);
      if (!item || !itemKey || seen.has(itemKey)) continue;
      seen.add(itemKey);
      merged.push(item);
    }
  }
  return { candidates, merged, seen };
}

export function wordBloomCategoryItems({
  words,
  category = "basics",
  starters = [],
  recent = [],
  newWords = [],
  query = ""
} = {}) {
  const semanticFacet = normalizeWordBloomFacet(category);
  if (semanticFacet) {
    return filterWordLensItems({
      words: filterWordsBySemanticFacet({ words, facet: semanticFacet }),
      filter: "az",
      starters,
      recent,
      newWords,
      query
    });
  }
  const normalizedCategory = normalizeWordBloomCategory(category);
  if (normalizedCategory === "search") {
    return filterWordLensItems({ words, filter: "az", starters, recent, newWords, query });
  }

  const { candidates, merged, seen } = normalizedCategory === "discoveries"
    ? mergeRankedWordLists(words, newWords, recent)
    : normalizedCategory === "used"
      ? mergeRankedWordLists(words, recent)
      : mergeRankedWordLists(words, starters);

  if (merged.length) return merged;
  const starterRanks = rankList(starters);
  const fallback = usefulAllOrder(candidates, starterRanks, rankList(recent));
  return fallback.filter((item) => !seen.has(identityKey(item)));
}

export function boundedWordBloomWindow({ items, page = 0, pageSize = 7, ceiling = Infinity } = {}) {
  const source = Array.isArray(items) ? items : [];
  const safeSize = Math.max(1, Math.min(8, numericLimit(pageSize, 7, 8)));
  const numericCeiling = Number(ceiling);
  const safeCeiling = Number.isFinite(numericCeiling)
    ? Math.max(safeSize, numericLimit(numericCeiling, source.length))
    : source.length;
  const available = source.slice(0, safeCeiling);
  const pageCount = Math.max(1, Math.ceil(available.length / safeSize));
  const safePage = Math.min(pageCount - 1, Math.max(0, numericLimit(page, 0)));
  const start = safePage * safeSize;
  return {
    items: available.slice(start, start + safeSize),
    total: source.length,
    available: available.length,
    page: safePage,
    pageCount,
    hasPrevious: safePage > 0,
    hasNext: safePage < pageCount - 1
  };
}

export function boundedWordBloomFacetWindow({ facets, wordCount = 0, page = 0, pageSize = 5 } = {}) {
  const source = Array.isArray(facets) ? facets : [];
  const safeSize = Math.max(2, Math.min(6, numericLimit(pageSize, 5, 6)));
  const semanticPageSize = safeSize - 1;
  const pageCount = Math.max(1, Math.ceil(source.length / semanticPageSize));
  const safePage = Math.min(pageCount - 1, Math.max(0, numericLimit(page, 0)));
  const start = safePage * semanticPageSize;
  const all = Object.freeze({
    id: "all",
    label: "All discovered words",
    shortLabel: "All",
    icon: "✦",
    count: Math.max(0, numericLimit(wordCount, 0)),
    priority: -1
  });
  return {
    items: [all, ...source.slice(start, start + semanticPageSize)],
    total: source.length + 1,
    page: safePage,
    pageCount,
    hasPrevious: safePage > 0,
    hasNext: safePage < pageCount - 1
  };
}

export function wordBloomFacetLayout({ count = 0, width = 320, height = 360, compact = false } = {}) {
  const safeCount = Math.min(6, Math.max(0, numericLimit(count, 0, 6)));
  if (!safeCount) return [];
  const safeWidth = Math.max(220, Number(width) || 320);
  const safeHeight = Math.max(132, Number(height) || 360);
  const compactLayout = Boolean(compact) || safeHeight <= 210;
  const radiusX = Math.max(72, Math.min(compactLayout ? 90 : 118, safeWidth / 2 - 42));
  const radiusY = compactLayout
    ? Math.max(42, Math.min(50, safeHeight / 2 - 22))
    : Math.max(76, Math.min(106, safeHeight / 2 - 48));
  const start = compactLayout && safeCount <= 4 ? -Math.PI * .75 : -Math.PI / 2;
  return Array.from({ length: safeCount }, (_, index) => {
    const angle = start + (Math.PI * 2 * index) / safeCount;
    return {
      index,
      angle,
      x: Math.round(Math.cos(angle) * radiusX),
      y: Math.round(Math.sin(angle) * radiusY),
      scale: 1
    };
  });
}

export function wordBloomOrbitLayout({ count = 0, width = 320, height = 360, focusIndex = -1, compact = false } = {}) {
  const safeCount = Math.min(8, Math.max(0, numericLimit(count, 0, 8)));
  if (!safeCount) return [];
  const safeWidth = Math.max(220, Number(width) || 320);
  const safeHeight = Math.max(132, Number(height) || 360);
  const compactLayout = Boolean(compact) || safeHeight <= 210;
  const extremeCompact = compactLayout && safeHeight <= 154;
  const radiusX = Math.max(66, Math.min(compactLayout ? 104 : 126, safeWidth / 2 - 34));
  const radiusY = compactLayout
    ? extremeCompact
      ? Math.max(40, Math.min(48, safeHeight / 2 - 26))
      : Math.max(44, Math.min(54, safeHeight / 2 - 22))
    : Math.max(72, Math.min(118, safeHeight / 2 - 38));
  const start = -Math.PI / 2;
  return Array.from({ length: safeCount }, (_, index) => {
    const angle = start + (Math.PI * 2 * index) / safeCount;
    const focused = index === Number(focusIndex);
    const push = focused ? (extremeCompact ? 1 : compactLayout ? 1.06 : 1.08) : 1;
    return {
      index,
      angle,
      x: Math.round(Math.cos(angle) * radiusX * push),
      y: Math.round(Math.sin(angle) * radiusY * push),
      scale: focused ? (extremeCompact ? 1 : compactLayout ? 1.12 : 1.24) : 1
    };
  });
}

export function normalizeWordLensFilter(filter) {
  const normalized = normalizedText(filter).replace(/[\s_]+/g, "-");
  if (normalized === "a-z" || normalized === "alphabetical" || normalized === "alphabetic") return "az";
  if (normalized === "starter" || normalized === "origins" || normalized === "origin") return "starters";
  if (normalized === "newest" || normalized === "discoveries") return "new";
  return WORD_LENS_FILTER_SET.has(normalized) ? normalized : "all";
}

export function chooseOrbitPartners({
  words,
  anchor = null,
  starters = [],
  recent = [],
  limit = 5
} = {}) {
  const candidates = validUniqueWords(words);
  const safeLimit = numericLimit(limit, 5);
  if (safeLimit === 0 || candidates.length === 0) return [];

  const starterRanks = rankList(starters);
  const recentRanks = rankList(recent);
  const anchorCategory = normalizedText(anchor?.category);

  return candidates.map((item, index) => {
    const starter = listRank(item, starterRanks);
    const recentItem = listRank(item, recentRanks);
    const anchorMatch = anchor ? sharesIdentity(item, anchor) : false;
    const origin = isOrigin(item, starter);
    const sameCategory = Boolean(anchorCategory) && normalizedText(item?.category) === anchorCategory;
    const bucket = anchorMatch ? 0 : Number.isFinite(recentItem) ? 1 : origin ? 2 : sameCategory ? 3 : 4;
    const rank = bucket === 1
      ? recentItem
      : bucket === 2 && Number.isFinite(starter)
        ? starter
        : index;
    return { item, index, bucket, rank };
  }).sort((left, right) => (
    left.bucket - right.bucket
    || left.rank - right.rank
    || left.index - right.index
  )).slice(0, safeLimit).map((entry) => entry.item);
}

function usefulAllOrder(items, starterRanks, recentRanks) {
  return items.map((item, index) => {
    const starter = listRank(item, starterRanks);
    const recent = listRank(item, recentRanks);
    const origin = isOrigin(item, starter);
    const bucket = origin ? 0 : Number.isFinite(recent) ? 1 : 2;
    const rank = bucket === 0 && Number.isFinite(starter)
      ? starter
      : bucket === 1
        ? recent
        : index;
    return { item, index, bucket, rank, newest: sourceTimestamp(item) };
  }).sort((left, right) => {
    if (left.bucket !== right.bucket) return left.bucket - right.bucket;
    if (left.rank !== right.rank) return left.rank - right.rank;
    if (left.bucket === 2 && (left.newest != null || right.newest != null)) {
      if (left.newest == null) return 1;
      if (right.newest == null) return -1;
      if (left.newest !== right.newest) return right.newest - left.newest;
    }
    return left.index - right.index;
  }).map((entry) => entry.item);
}

function onlyRanked(items, ranks, { includeOrigins = false } = {}) {
  return items.map((item, index) => ({
    item,
    index,
    rank: listRank(item, ranks),
    origin: includeOrigins && isOrigin(item, listRank(item, ranks))
  })).filter((entry) => Number.isFinite(entry.rank) || entry.origin).sort((left, right) => {
    const leftRank = Number.isFinite(left.rank) ? left.rank : Infinity;
    const rightRank = Number.isFinite(right.rank) ? right.rank : Infinity;
    return leftRank - rightRank || left.index - right.index;
  }).map((entry) => entry.item);
}

function searchMatch(word, needle) {
  if (!needle) return 0;
  if (word === needle) return 0;
  if (word.startsWith(needle)) return 1;
  if (word.includes(needle)) return 2;
  return Infinity;
}

export function filterWordLensItems({
  words,
  filter = "all",
  starters = [],
  recent = [],
  newWords = [],
  query = ""
} = {}) {
  const items = validUniqueWords(words);
  const normalizedFilter = normalizeWordLensFilter(filter);
  const starterRanks = rankList(starters);
  const recentRanks = rankList(recent);
  const newRanks = rankList(newWords);
  let ordered;

  if (normalizedFilter === "recent") {
    ordered = onlyRanked(items, recentRanks);
  } else if (normalizedFilter === "new") {
    ordered = onlyRanked(items, newRanks);
  } else if (normalizedFilter === "starters") {
    ordered = onlyRanked(items, starterRanks, { includeOrigins: true });
  } else if (normalizedFilter === "az") {
    ordered = [...items].sort((left, right) => (
      String(left.word).localeCompare(String(right.word), "en", { sensitivity: "base" })
    ));
  } else {
    ordered = usefulAllOrder(items, starterRanks, recentRanks);
  }

  const needle = normalizedText(query);
  if (!needle) return ordered;

  return ordered.map((item, index) => ({
    item,
    index,
    match: searchMatch(normalizedText(item.word), needle)
  })).filter((entry) => Number.isFinite(entry.match)).sort((left, right) => (
    left.match - right.match || left.index - right.index
  )).map((entry) => entry.item);
}

export function boundedWordLensWindow({ items, limit, ceiling = 80 } = {}) {
  const source = Array.isArray(items) ? items : [];
  const safeCeiling = numericLimit(ceiling, 80);
  const requested = numericLimit(limit, safeCeiling, safeCeiling);
  const visible = source.slice(0, requested);
  const expandableTotal = Math.min(source.length, safeCeiling);
  const hasMore = visible.length < expandableTotal;

  return {
    items: visible,
    total: source.length,
    hasMore,
    nextLimit: hasMore ? Math.min(safeCeiling, Math.max(visible.length + 1, visible.length * 2 || 1)) : visible.length
  };
}

export {
  availableWordBloomFacets,
  filterWordsBySemanticFacet,
  normalizeWordBloomFacet,
  WORD_BLOOM_SEMANTIC_FACETS,
  WORD_LENS_FILTERS
};
