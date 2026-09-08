import {
  WORD_BLOOM_SEMANTIC_FACETS,
  availableWordBloomFacets,
  wordMatchesSemanticFacet
} from "./word-semantic-facets.mjs?v=5.0.0-beta.4";

export const COMBINING_BOARD_MEMORY_LIMIT = 84;

export const COMBINING_BOARD_MODES = Object.freeze([
  "ranked",
  "daily",
  "project",
  "explore",
  "tutorial",
  "scramble",
  "reveal"
]);

export const COMBINING_BOARD_FUSION_TIERS = Object.freeze([
  "micro",
  "discovery",
  "hero",
  "instant"
]);

const MODE_SET = new Set(COMBINING_BOARD_MODES);

const freezeArray = (source) => Object.freeze(source);

function normalizedText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

function wordKey(value) {
  return normalizedText(value).toLocaleLowerCase("en");
}

function playableWord(item) {
  return Boolean(
    item
    && typeof item === "object"
    && !Array.isArray(item)
    && !item.ghost
    && !item.unavailable
    && !item.disabled
    && wordKey(item.word)
  );
}

function uniquePlayableWords(source) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(source) ? source : []) {
    const key = wordKey(item?.word);
    if (!playableWord(item) || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function matchingFacetIds(item) {
  return WORD_BLOOM_SEMANTIC_FACETS
    .filter((facet) => wordMatchesSemanticFacet(item, facet.id))
    .map((facet) => facet.id);
}

function primaryFacetId(item) {
  return matchingFacetIds(item)[0] || "other";
}

/**
 * Assigns every playable word to exactly one layout facet while preserving all
 * reviewed multi-facet memberships for browsing. Duplicate spellings never
 * create duplicate playable nodes.
 */
export function assignPrimarySemanticFacets({ words: source } = {}) {
  return freezeArray(uniquePlayableWords(source).map((item) => {
    const key = wordKey(item.word);
    const facetIds = matchingFacetIds(item);
    return Object.freeze({
      id: `word:${key}`,
      key,
      word: normalizedText(item.word),
      sourceId: item.id == null ? null : String(item.id),
      primaryFacetId: facetIds[0] || "other",
      facetIds: freezeArray(facetIds)
    });
  }));
}

function boundedInteger(value, fallback, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(numeric)));
}

/**
 * Builds the small, relevant set of semantic beacons rendered at rest. A
 * beacon stores references to canonical word keys; it never clones a playable
 * node even when a word belongs to more than one browsing facet.
 */
export function buildSemanticBeacons({ words: source, minimum = 2, max = 6 } = {}) {
  const limit = boundedInteger(max, 6, 0, WORD_BLOOM_SEMANTIC_FACETS.length);
  if (limit === 0) return freezeArray([]);

  const inventory = uniquePlayableWords(source);
  const assignments = assignPrimarySemanticFacets({ words: inventory });
  const primaryByKey = new Map(assignments.map((node) => [node.key, node.primaryFacetId]));
  const available = availableWordBloomFacets({ words: inventory, minimum });

  const beacons = available.map((facet) => {
    const wordKeys = inventory
      .filter((item) => wordMatchesSemanticFacet(item, facet.id))
      .map((item) => wordKey(item.word));
    const primaryWordKeys = wordKeys.filter((key) => primaryByKey.get(key) === facet.id);
    return {
      id: facet.id,
      label: facet.label,
      shortLabel: facet.shortLabel,
      icon: facet.icon,
      priority: facet.priority,
      count: wordKeys.length,
      primaryCount: primaryWordKeys.length,
      wordKeys,
      primaryWordKeys
    };
  });

  beacons.sort((left, right) => (
    right.primaryCount - left.primaryCount
    || right.count - left.count
    || left.priority - right.priority
    || left.id.localeCompare(right.id, "en")
  ));

  return freezeArray(beacons.slice(0, limit).map((beacon) => Object.freeze({
    ...beacon,
    wordKeys: freezeArray(beacon.wordKeys),
    primaryWordKeys: freezeArray(beacon.primaryWordKeys)
  })));
}

function finiteCoordinate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/** Normalizes a persisted/live position into board-relative [0, 1] space. */
export function normalizeBoardAnchor(value) {
  if (!value || (typeof value !== "object" && !Array.isArray(value))) return null;
  const x = finiteCoordinate(Array.isArray(value) ? value[0] : value.x);
  const y = finiteCoordinate(Array.isArray(value) ? value[1] : value.y);
  if (x === null || y === null) return null;
  if (!Array.isArray(value) && value.unclamped === true && (x < 0 || x > 1 || y < 0 || y > 1)) {
    return Object.freeze({ x, y, unclamped: true });
  }
  return Object.freeze({ x: clamp01(x), y: clamp01(y) });
}

function hash32(source) {
  let hash = 0x811c9dc5;
  for (const character of String(source)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Stable fallback used when a run has no saved live anchor. */
export function deterministicBoardAnchor(seed) {
  const key = normalizedText(seed) || "constellore";
  const xUnit = hash32(`x:${key}`) / 0xffffffff;
  const yUnit = hash32(`y:${key}`) / 0xffffffff;
  return Object.freeze({
    x: Number((0.08 + (xUnit * 0.84)).toFixed(6)),
    y: Number((0.10 + (yUnit * 0.78)).toFixed(6))
  });
}

function anchorLookupKey(value) {
  return wordKey(value);
}

function liveAnchorIndex(source) {
  const anchors = new Map();
  const add = (key, value) => {
    const normalizedKey = anchorLookupKey(key);
    const anchor = normalizeBoardAnchor(value?.anchor || value);
    if (normalizedKey && anchor) anchors.set(normalizedKey, anchor);
  };

  if (source instanceof Map) {
    for (const [key, value] of source.entries()) add(key, value);
  } else if (Array.isArray(source)) {
    for (const entry of source) {
      if (!entry || typeof entry !== "object") continue;
      add(entry.id || entry.key || entry.word, entry);
    }
  } else if (source && typeof source === "object") {
    for (const [key, value] of Object.entries(source)) add(key, value);
  }
  return anchors;
}

function resolvedAnchor(index, id, key) {
  const anchor = index.get(anchorLookupKey(id)) || index.get(anchorLookupKey(key));
  return Object.freeze({
    ...(anchor || deterministicBoardAnchor(id)),
    source: anchor ? "live" : "deterministic"
  });
}

function performedStep(step, historyIndex) {
  if (!step || typeof step !== "object" || Array.isArray(step)) return null;
  if (
    step.preview === true
    || step.predicted === true
    || step.future === true
    || step.futureRecipe === true
    || step.locked === true
    || step.performed === false
    || step.resolved === false
    || step.success === false
    || step.accepted === false
  ) return null;

  const a = normalizedText(step.a ?? step.left ?? step.ingredients?.[0]);
  const b = normalizedText(step.b ?? step.right ?? step.ingredients?.[1]);
  const resultValue = step.word ?? step.result?.word ?? step.result;
  const result = typeof resultValue === "string" ? normalizedText(resultValue) : "";
  if (!a || !b || !result) return null;

  const stepsAdvanced = Number(step.routeStepsAdvanced);
  const routeForward = (
    (Number.isFinite(stepsAdvanced) && stepsAdvanced > 0)
    || step.routeDerived === true
    || step.routeCompleted === true
  );

  const resultItem = (
    step.result && typeof step.result === "object" && !Array.isArray(step.result)
      ? { ...step.result, word: result }
      : step.item && typeof step.item === "object" && !Array.isArray(step.item)
        ? { ...step.item, word: result }
        : { word: result, category: step.category, tags: step.tags, semanticTags: step.semanticTags }
  );

  const sourceAnchors = step.anchors && typeof step.anchors === "object"
    ? step.anchors
    : step.derivationAnchors && typeof step.derivationAnchors === "object"
      ? step.derivationAnchors
      : {};
  const historicalAnchors = Object.freeze({
    ingredientA: normalizeBoardAnchor(sourceAnchors.ingredientA ?? sourceAnchors.a ?? sourceAnchors.left),
    ingredientB: normalizeBoardAnchor(sourceAnchors.ingredientB ?? sourceAnchors.b ?? sourceAnchors.right),
    result: normalizeBoardAnchor(sourceAnchors.result ?? sourceAnchors.word ?? sourceAnchors.output)
  });

  return {
    historyIndex,
    a,
    b,
    result,
    resultItem,
    historicalAnchors,
    routeForward,
    routeStepsAdvanced: Number.isFinite(stepsAdvanced) && stepsAdvanced > 0 ? stepsAdvanced : 0,
    routeCompleted: step.routeCompleted === true
  };
}

function memoryStar({ id, stepId, role, word, routeForward, anchors, historicalAnchor = null }) {
  const key = wordKey(word);
  const anchor = normalizeBoardAnchor(historicalAnchor);
  return Object.freeze({
    id,
    stepId,
    role,
    word,
    key,
    routeForward,
    anchor: anchor
      ? Object.freeze({ ...anchor, source: "history" })
      : resolvedAnchor(anchors, id, key)
  });
}

function detailedMemory(step, anchors) {
  const stepId = `memory:${step.historyIndex}`;
  const inputA = memoryStar({
    id: `${stepId}:ingredient-a`,
    stepId,
    role: "ingredient",
    word: step.a,
    routeForward: step.routeForward,
    anchors,
    historicalAnchor: step.historicalAnchors.ingredientA
  });
  const inputB = memoryStar({
    id: `${stepId}:ingredient-b`,
    stepId,
    role: "ingredient",
    word: step.b,
    routeForward: step.routeForward,
    anchors,
    historicalAnchor: step.historicalAnchors.ingredientB
  });
  const result = memoryStar({
    id: `${stepId}:result`,
    stepId,
    role: "result",
    word: step.result,
    routeForward: step.routeForward,
    anchors,
    historicalAnchor: step.historicalAnchors.result
  });
  const edges = freezeArray([
    Object.freeze({ id: `${stepId}:edge-a`, stepId, from: inputA.id, to: result.id, routeForward: step.routeForward }),
    Object.freeze({ id: `${stepId}:edge-b`, stepId, from: inputB.id, to: result.id, routeForward: step.routeForward })
  ]);
  return Object.freeze({
    id: stepId,
    historyIndex: step.historyIndex,
    a: step.a,
    b: step.b,
    result: step.result,
    routeForward: step.routeForward,
    routeStepsAdvanced: step.routeStepsAdvanced,
    routeCompleted: step.routeCompleted,
    stars: freezeArray([inputA, inputB, result]),
    edges
  });
}

function aggregateMemories(steps, anchors) {
  const groups = new Map();
  for (const step of steps) {
    const facetId = primaryFacetId(step.resultItem);
    const existing = groups.get(facetId) || {
      facetId,
      count: 0,
      routeCount: 0,
      firstHistoryIndex: step.historyIndex,
      lastHistoryIndex: step.historyIndex,
      resultWords: new Set()
    };
    existing.count += 1;
    existing.routeCount += step.routeForward ? 1 : 0;
    existing.lastHistoryIndex = step.historyIndex;
    existing.resultWords.add(step.result);
    groups.set(facetId, existing);
  }

  const facetById = new Map(WORD_BLOOM_SEMANTIC_FACETS.map((facet) => [facet.id, facet]));
  return freezeArray([...groups.values()]
    .sort((left, right) => (
      left.firstHistoryIndex - right.firstHistoryIndex
      || left.facetId.localeCompare(right.facetId, "en")
    ))
    .map((group) => {
      const facet = facetById.get(group.facetId);
      const id = `memory-aggregate:${group.facetId}`;
      return Object.freeze({
        id,
        facetId: group.facetId,
        label: facet?.label || "Other discoveries",
        count: group.count,
        routeCount: group.routeCount,
        routeForward: group.routeCount > 0,
        firstHistoryIndex: group.firstHistoryIndex,
        lastHistoryIndex: group.lastHistoryIndex,
        resultWords: freezeArray([...group.resultWords].sort((left, right) => left.localeCompare(right, "en"))),
        anchor: resolvedAnchor(anchors, id, `aggregate:${group.facetId}`)
      });
    }));
}

/**
 * Projects performed history only. No recipe graph, target route, hint, or
 * prediction input is accepted, so future combinations cannot enter the
 * presentation model accidentally.
 */
export function projectCombinationMemory({
  history: source,
  liveAnchors,
  maxDetailed = COMBINING_BOARD_MEMORY_LIMIT
} = {}) {
  const limit = boundedInteger(maxDetailed, COMBINING_BOARD_MEMORY_LIMIT, 0, 256);
  const anchors = liveAnchorIndex(liveAnchors);
  const performed = (Array.isArray(source) ? source : [])
    .map((step, historyIndex) => performedStep(step, historyIndex))
    .filter(Boolean);
  const splitAt = Math.max(0, performed.length - limit);
  const older = performed.slice(0, splitAt);
  const detailed = freezeArray(performed.slice(splitAt).map((step) => detailedMemory(step, anchors)));
  const stars = freezeArray(detailed.flatMap((memory) => memory.stars));
  const edges = freezeArray(detailed.flatMap((memory) => memory.edges));
  const aggregates = aggregateMemories(older, anchors);

  return Object.freeze({
    totalPerformed: performed.length,
    detailedCount: detailed.length,
    aggregatedCount: older.length,
    detailed,
    stars,
    edges,
    aggregates
  });
}

export function normalizeCombiningBoardMode(value) {
  const mode = wordKey(value);
  return MODE_SET.has(mode) ? mode : "ranked";
}

function effectsAreOff(value) {
  if (value === false || value === 0) return true;
  return ["off", "none", "disabled", "instant"].includes(wordKey(value));
}

function eventFlag(event, ...names) {
  return names.some((name) => event?.[name] === true || event?.result?.[name] === true);
}

/** Classifies presentation intensity without making a gameplay decision. */
export function classifyFusionTier(event = {}, options = {}) {
  if (effectsAreOff(options.effects ?? event.effects ?? event.cinematicSpeed)) return "instant";

  const mode = normalizeCombiningBoardMode(options.mode ?? event.mode);
  if (mode === "scramble") return "micro";

  const source = wordKey(event.source ?? event.result?.source);
  const hero = (
    eventFlag(
      event,
      "hero",
      "goldenPair",
      "isGoldenPair",
      "foundationalPair",
      "isFoundationalPair",
      "cosmicTwist",
      "isCosmicTwist",
      "finalTarget",
      "targetCompleted",
      "routeCompleted"
    )
    || source === "twist"
    || source === "cosmic-twist"
  );
  if (hero) return "hero";

  const stepsAdvanced = Number(event.routeStepsAdvanced ?? event.result?.routeStepsAdvanced);
  const discovery = (
    eventFlag(
      event,
      "newDiscovery",
      "isNewDiscovery",
      "firstDiscovery",
      "runIqNewToRun",
      "routeAdvanced",
      "routeDerived"
    )
    || (Number.isFinite(stepsAdvanced) && stepsAdvanced > 0)
  );
  return discovery ? "discovery" : "micro";
}

const MODE_PRESENTATION_RULES = Object.freeze({
  ranked: Object.freeze({
    mode: "ranked", observatory: "full", semanticBrowser: "full", semanticBeacons: true,
    memoryConstellation: true, routeChart: true, targetBeacon: true, fusion: true,
    maxFusionTier: "hero", instructedWordsOnly: false, competitive: false, suspended: false
  }),
  daily: Object.freeze({
    mode: "daily", observatory: "full", semanticBrowser: "full", semanticBeacons: true,
    memoryConstellation: true, routeChart: true, targetBeacon: true, fusion: true,
    maxFusionTier: "hero", instructedWordsOnly: false, competitive: false, suspended: false
  }),
  project: Object.freeze({
    mode: "project", observatory: "full", semanticBrowser: "full", semanticBeacons: true,
    memoryConstellation: true, routeChart: true, targetBeacon: true, fusion: true,
    maxFusionTier: "hero", instructedWordsOnly: false, competitive: false, suspended: false
  }),
  explore: Object.freeze({
    mode: "explore", observatory: "full", semanticBrowser: "full", semanticBeacons: true,
    memoryConstellation: true, routeChart: false, targetBeacon: false, fusion: true,
    maxFusionTier: "hero", instructedWordsOnly: false, competitive: false, suspended: false
  }),
  tutorial: Object.freeze({
    mode: "tutorial", observatory: "simplified", semanticBrowser: "instructed-only", semanticBeacons: false,
    memoryConstellation: false, routeChart: false, targetBeacon: true, fusion: true,
    maxFusionTier: "discovery", instructedWordsOnly: true, competitive: false, suspended: false
  }),
  scramble: Object.freeze({
    mode: "scramble", observatory: "competitive", semanticBrowser: "existing", semanticBeacons: false,
    memoryConstellation: false, routeChart: false, targetBeacon: false, fusion: true,
    maxFusionTier: "micro", instructedWordsOnly: false, competitive: true, suspended: false
  }),
  reveal: Object.freeze({
    mode: "reveal", observatory: "suspended", semanticBrowser: "hidden", semanticBeacons: false,
    memoryConstellation: false, routeChart: false, targetBeacon: false, fusion: false,
    maxFusionTier: "instant", instructedWordsOnly: false, competitive: false, suspended: true
  })
});

/** Returns the immutable presentation contract for a gameplay mode. */
export function getCombiningBoardModeRules(mode) {
  return MODE_PRESENTATION_RULES[normalizeCombiningBoardMode(mode)];
}

export const COMBINING_BOARD_MODE_RULES = MODE_PRESENTATION_RULES;
