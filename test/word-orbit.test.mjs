import assert from "node:assert/strict";
import test from "node:test";
import {
  WORD_LENS_FILTERS,
  WORD_BLOOM_CATEGORIES,
  WORD_BLOOM_SEMANTIC_FACETS,
  availableWordBloomFacets,
  boundedWordBloomFacetWindow,
  boundedWordBloomWindow,
  boundedWordLensWindow,
  classifyWordBloomDirection,
  chooseOrbitPartners,
  filterWordLensItems,
  filterWordsBySemanticFacet,
  normalizeWordBloomFacet,
  normalizeWordBloomCategory,
  previewWordBloomSwipe,
  wordBloomCategoryItems,
  wordBloomFacetLayout,
  wordBloomOrbitLayout,
  normalizeWordLensFilter
} from "../public/word-orbit.mjs";

const words = [
  { id: "earth", word: "Earth", emoji: "🌍", category: "nature", source: "origin" },
  { id: "water", word: "Water", emoji: "💧", category: "nature", source: "origin" },
  { id: "fire", word: "Fire", emoji: "🔥", category: "force", source: "origin" },
  { id: "air", word: "Air", emoji: "💨", category: "force", source: "origin" },
  { id: "mud", word: "Mud", emoji: "🟤", category: "nature", discoveredAt: "2026-07-28T10:00:00Z" },
  { id: "steam", word: "Steam", emoji: "☁️", category: "force", discoveredAt: "2026-07-29T10:00:00Z" },
  { id: "metal", word: "Metal", emoji: "⚙️", category: "matter", discoveredAt: "2026-07-30T10:00:00Z" },
  { id: "stair", word: "Stair", emoji: "🪜", category: "structure" }
];

test("Word Orbit puts the anchor first, then recent, origins, same-category, and remaining words", () => {
  const partners = chooseOrbitPartners({
    words,
    anchor: words[4],
    starters: ["Earth", "Water", "Fire", "Air"],
    recent: ["Metal", "Steam"],
    limit: 8
  });

  assert.deepEqual(
    partners.map((item) => item.word),
    ["Mud", "Metal", "Steam", "Earth", "Water", "Fire", "Air", "Stair"]
  );
  assert.equal(partners[0], words[4], "the original item reference is retained for self-fusion");
});

test("Word Orbit removes duplicate and ghost suggestions", () => {
  const duplicateEarth = { id: "earth-copy", word: " earth ", category: "nature" };
  const ghost = { id: "ghost-horizon", word: "Horizon", ghost: true };
  const partners = chooseOrbitPartners({
    words: [null, {}, words[0], duplicateEarth, ghost, words[1], "Fire", words[2]],
    anchor: words[0],
    starters: ["Earth", "Water", "Fire"],
    limit: 10
  });

  assert.deepEqual(partners.map((item) => item.word), ["Earth", "Water", "Fire"]);
  assert.equal(partners[0], words[0]);
});

test("Word Orbit partner selection is target-independent", () => {
  const input = {
    words,
    anchor: words[4],
    starters: ["Earth", "Water", "Fire", "Air"],
    recent: ["Steam"],
    limit: 5
  };
  const horizon = chooseOrbitPartners({ ...input, target: "Horizon", route: ["Sky", "Horizon"] });
  const factory = chooseOrbitPartners({ ...input, target: "Factory", route: ["Metal", "Factory"] });

  assert.deepEqual(horizon, factory);
  assert.equal(chooseOrbitPartners.length, 0, "the public signature accepts one optional model object only");
});

test("Word Lens normalizes filter aliases and unknown values safely", () => {
  assert.deepEqual(WORD_LENS_FILTERS, ["all", "recent", "new", "starters", "az"]);
  assert.equal(normalizeWordLensFilter(" A-Z "), "az");
  assert.equal(normalizeWordLensFilter("Origins"), "starters");
  assert.equal(normalizeWordLensFilter("newest"), "new");
  assert.equal(normalizeWordLensFilter("not-a-filter"), "all");
});

test("Word Lens supports all, recent, new, starters, and alphabetical collection views", () => {
  const common = {
    words,
    starters: ["Earth", "Water", "Fire", "Air"],
    recent: ["Metal", "Mud"],
    newWords: ["Steam", "Metal"]
  };

  assert.deepEqual(filterWordLensItems({ ...common, filter: "recent" }).map((item) => item.word), ["Metal", "Mud"]);
  assert.deepEqual(filterWordLensItems({ ...common, filter: "new" }).map((item) => item.word), ["Steam", "Metal"]);
  assert.deepEqual(filterWordLensItems({ ...common, filter: "starters" }).map((item) => item.word), ["Earth", "Water", "Fire", "Air"]);
  assert.deepEqual(filterWordLensItems({ ...common, filter: "az" }).map((item) => item.word), ["Air", "Earth", "Fire", "Metal", "Mud", "Stair", "Steam", "Water"]);
  assert.deepEqual(filterWordLensItems({ ...common, filter: "all" }).map((item) => item.word), ["Earth", "Water", "Fire", "Air", "Metal", "Mud", "Steam", "Stair"]);
});

test("Word Lens search ranks exact, prefix, then substring while preserving useful order", () => {
  const results = filterWordLensItems({
    words,
    filter: "all",
    starters: ["Air"],
    recent: ["Stair"],
    query: " air "
  });
  assert.deepEqual(results.map((item) => item.word), ["Air", "Stair"]);

  const noGhosts = filterWordLensItems({
    words: [null, {}, words[0], { word: "EARTH" }, words[1]],
    query: "earth"
  });
  assert.deepEqual(noGhosts, [words[0]]);
});

test("Word Lens render window never exceeds its ceiling with 1,000 discoveries", () => {
  const thousand = Array.from({ length: 1_000 }, (_, index) => ({
    id: `word-${index}`,
    word: `Word ${String(index).padStart(4, "0")}`
  }));

  const first = boundedWordLensWindow({ items: thousand, limit: 32 });
  assert.equal(first.items.length, 32);
  assert.equal(first.hasMore, true);
  assert.equal(first.nextLimit, 64);

  const capped = boundedWordLensWindow({ items: thousand, limit: 10_000 });
  assert.equal(capped.items.length, 80);
  assert.equal(capped.total, 1_000);
  assert.equal(capped.hasMore, false);
  assert.equal(capped.nextLimit, 80);
  assert.deepEqual(Object.keys(capped), ["items", "total", "hasMore", "nextLimit"]);
});

test("Constellation Bloom has four stable thumb directions and a neutral dead zone", () => {
  assert.deepEqual(WORD_BLOOM_CATEGORIES.map(({ id }) => id), ["discoveries", "used", "search", "basics"]);
  assert.equal(classifyWordBloomDirection(8, 8), null);
  assert.equal(classifyWordBloomDirection(-50, -40), "discoveries");
  assert.equal(classifyWordBloomDirection(50, -40), "used");
  assert.equal(classifyWordBloomDirection(-50, 40), "search");
  assert.equal(classifyWordBloomDirection(50, 40), "basics");
  assert.equal(normalizeWordBloomCategory("recent discoveries"), "discoveries");
  assert.equal(normalizeWordBloomCategory("last used"), "used");
  assert.equal(normalizeWordBloomCategory("origins"), "basics");
});

test("a Bloom word swipe remains a preview when it lands on the already-focused word", () => {
  const layout = wordBloomOrbitLayout({ count: 4, width: 667, height: 327, focusIndex: 0, compact: true });
  const target = layout[0];
  const distance = 90;
  const preview = previewWordBloomSwipe(
    Math.cos(target.angle) * distance,
    Math.sin(target.angle) * distance,
    { layout, focusIndex: 0 }
  );
  assert.deepEqual(preview, { moved: true, changed: false, focusIndex: 0 });
  assert.equal(previewWordBloomSwipe(4, 5, { layout, focusIndex: 0 }).moved, false);
});

test("Bloom categories derive small useful collections without target knowledge", () => {
  const common = {
    words,
    starters: ["Earth", "Water", "Fire", "Air"],
    recent: ["Metal", "Mud"],
    newWords: ["Steam", "Metal"]
  };
  assert.deepEqual(wordBloomCategoryItems({ ...common, category: "discoveries" }).map(({ word }) => word), ["Steam", "Metal", "Mud"]);
  assert.deepEqual(wordBloomCategoryItems({ ...common, category: "used" }).map(({ word }) => word), ["Metal", "Mud"]);
  assert.deepEqual(wordBloomCategoryItems({ ...common, category: "basics" }).map(({ word }) => word), ["Earth", "Water", "Fire", "Air"]);
  assert.deepEqual(wordBloomCategoryItems({ ...common, category: "search", query: "air" }).map(({ word }) => word), ["Air", "Stair"]);
});

test("semantic Bloom facets appear only when the discovered inventory can make them useful", () => {
  const starterInventory = [
    { word: "Earth", category: "nature" },
    { word: "Water", category: "force" },
    { word: "Fire", category: "force" },
    { word: "Air", category: "force" }
  ];
  assert.deepEqual(availableWordBloomFacets({ words: [] }), []);
  assert.deepEqual(availableWordBloomFacets({ words: starterInventory }).map(({ id }) => id), ["forces"]);

  const growing = [...starterInventory, { word: "Ocean", category: "nature" }];
  assert.deepEqual(availableWordBloomFacets({ words: growing }).map(({ id }) => id), ["forces", "liquids"]);
  assert.equal(availableWordBloomFacets({ words: [{ word: "Wall" }] }).some(({ id }) => id === "architecture"), false);
  assert.equal(availableWordBloomFacets({ words: [{ word: "Wall" }, { word: "House" }] }).some(({ id }) => id === "architecture"), true);
});

test("semantic matching is whole-token, overlapping, deduplicated, and safely normalized", () => {
  const inventory = [
    { word: "Water", category: "force" },
    { word: "Ocean" },
    { word: "WATER" },
    { word: "Firefly" },
    { word: "Research" },
    { word: "Electricity" },
    { word: "Apartment" },
    { word: "Plateau" },
    { word: "Ghost Water", ghost: true }
  ];
  assert.equal(normalizeWordBloomFacet(" liquid "), "liquids");
  assert.equal(normalizeWordBloomFacet("Water & liquids"), "liquids");
  assert.equal(normalizeWordBloomFacet("Machines & technology"), "technology");
  assert.equal(normalizeWordBloomFacet("not-real"), null);
  assert.equal(normalizeWordBloomFacet(""), null);
  assert.deepEqual(filterWordsBySemanticFacet({ words: inventory, facet: "liquids" }).map(({ word }) => word), ["Water", "Ocean"]);
  assert.deepEqual(filterWordsBySemanticFacet({ words: inventory, facet: "forces" }).map(({ word }) => word), ["Water", "Electricity"]);
  assert.equal(filterWordsBySemanticFacet({ words: inventory, facet: "fire-heat" }).some(({ word }) => word === "Firefly"), false);
  assert.equal(filterWordsBySemanticFacet({ words: inventory, facet: "liquids" }).some(({ word }) => word === "Research"), false);
  assert.equal(filterWordsBySemanticFacet({ words: inventory, facet: "architecture" }).some(({ word }) => word === "Electricity"), false);
  assert.equal(filterWordsBySemanticFacet({ words: inventory, facet: "arts-culture" }).some(({ word }) => word === "Apartment"), false);
  assert.equal(filterWordsBySemanticFacet({ words: inventory, facet: "food" }).some(({ word }) => word === "Plateau"), false);
});

test("reviewed semantic tags opt words into facets without reviving substring guesses", () => {
  const inventory = [
    { word: "Canopy", semanticTags: ["plant"] },
    { word: "Aquifer", semanticTags: new Set(["water"]) },
    { word: "Arcology", tags: "building" },
    { word: "Research" },
    { word: "Apartment" },
    { word: "Plateau" }
  ];
  assert.deepEqual(filterWordsBySemanticFacet({ words: inventory, facet: "plants" }).map(({ word }) => word), ["Canopy"]);
  assert.deepEqual(filterWordsBySemanticFacet({ words: inventory, facet: "liquids" }).map(({ word }) => word), ["Aquifer"]);
  assert.deepEqual(filterWordsBySemanticFacet({ words: inventory, facet: "architecture" }).map(({ word }) => word), ["Arcology"]);
  assert.equal(filterWordsBySemanticFacet({ words: inventory, facet: "liquids" }).some(({ word }) => word === "Research"), false);
  assert.equal(filterWordsBySemanticFacet({ words: inventory, facet: "arts-culture" }).some(({ word }) => word === "Apartment"), false);
  assert.equal(filterWordsBySemanticFacet({ words: inventory, facet: "food" }).some(({ word }) => word === "Plateau"), false);
});

test("semantic facet order stays authored while filtered words retain exact-prefix-substring search", () => {
  const inventory = [
    { word: "Wall" }, { word: "House" }, { word: "Water", category: "force" }, { word: "Ocean" },
    { word: "Air", category: "force" }, { word: "Stair" }, { word: "Rain" }
  ];
  const forward = availableWordBloomFacets({ words: inventory }).map(({ id }) => id);
  const reversed = availableWordBloomFacets({ words: [...inventory].reverse() }).map(({ id }) => id);
  assert.deepEqual(reversed, forward);
  assert.deepEqual(wordBloomCategoryItems({ words: inventory, category: "architecture", query: "air" }).map(({ word }) => word), ["Stair"]);
  assert.ok(WORD_BLOOM_SEMANTIC_FACETS.length >= 12);
});

test("semantic category paging always preserves All words and remains bounded", () => {
  const facets = WORD_BLOOM_SEMANTIC_FACETS.slice(0, 11).map((facet, index) => ({ ...facet, count: index + 2 }));
  const first = boundedWordBloomFacetWindow({ facets, wordCount: 400, pageSize: 5 });
  const third = boundedWordBloomFacetWindow({ facets, wordCount: 400, page: 2, pageSize: 5 });
  assert.equal(first.items[0].id, "all");
  assert.equal(first.items.length, 5);
  assert.equal(first.pageCount, 3);
  assert.equal(third.items[0].id, "all");
  assert.equal(third.items.length, 4);
  assert.equal(third.hasNext, false);
  const compact = wordBloomFacetLayout({ count: 4, width: 356, height: 144, compact: true });
  assert.equal(compact.length, 4);
  assert.ok(compact.every(({ x }) => Math.abs(x) <= 90));
  assert.ok(compact.every(({ y }) => Math.abs(y) <= 50));
});

test("Bloom virtualizes large inventories into at most eight bubbles", () => {
  const many = Array.from({ length: 1_000 }, (_, index) => ({ word: `Word ${index}` }));
  const first = boundedWordBloomWindow({ items: many, pageSize: 7 });
  assert.equal(first.items.length, 7);
  assert.equal(first.page, 0);
  assert.equal(first.pageCount, 143, "every discovery stays reachable while only one seven-word orbit renders");
  assert.equal(first.hasPrevious, false);
  assert.equal(first.hasNext, true);
  const last = boundedWordBloomWindow({ items: many, page: 999, pageSize: 99 });
  assert.equal(last.items.length, 8);
  assert.equal(last.page, 124);
  assert.equal(last.pageCount, 125);
  assert.equal(last.hasNext, false);
});

test("Bloom orbit stays elliptical on portrait and extreme landscape", () => {
  const portrait = wordBloomOrbitLayout({ count: 7, width: 320, height: 420, focusIndex: 2 });
  const landscape = wordBloomOrbitLayout({ count: 6, width: 449, height: 140 });
  const tinyLandscape = wordBloomOrbitLayout({ count: 4, width: 356, height: 144, focusIndex: 0, compact: true });
  const classifiedLandscape = wordBloomOrbitLayout({ count: 6, width: 667, height: 327, compact: true });
  assert.equal(portrait.length, 7);
  assert.equal(portrait[2].scale, 1.24);
  assert.ok(portrait.every(({ x }) => Math.abs(x) <= 136));
  assert.ok(portrait.every(({ y }) => Math.abs(y) <= 128));
  assert.ok(landscape.every(({ x }) => Math.abs(x) <= 104));
  assert.ok(landscape.every(({ y }) => Math.abs(y) <= 48));
  assert.ok(classifiedLandscape.every(({ y }) => Math.abs(y) <= 54));
  assert.equal(tinyLandscape[0].scale, 1, "extreme landscape uses glow rather than an overlapping scale-up");
  assert.ok(Math.abs(tinyLandscape[0].y) >= 44, "the north word clears the hub while retaining a safe viewport gutter");
  assert.ok(Math.abs(tinyLandscape[0].y) <= 46, "the extreme-landscape orbit leaves room for hover growth");
});
