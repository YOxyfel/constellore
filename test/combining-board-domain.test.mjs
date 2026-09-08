import assert from "node:assert/strict";
import test from "node:test";
import {
  COMBINING_BOARD_FUSION_TIERS,
  COMBINING_BOARD_MEMORY_LIMIT,
  COMBINING_BOARD_MODES,
  COMBINING_BOARD_MODE_RULES,
  assignPrimarySemanticFacets,
  buildSemanticBeacons,
  classifyFusionTier,
  deterministicBoardAnchor,
  getCombiningBoardModeRules,
  normalizeBoardAnchor,
  normalizeCombiningBoardMode,
  projectCombinationMemory
} from "../public/combining-board-domain.mjs";

test("primary semantic assignment creates one canonical playable node per word", () => {
  const words = [
    { id: "water-first", word: "Water", category: "force" },
    { id: "water-copy", word: " water ", semanticTags: ["liquid"] },
    { id: "ocean", word: "Ocean" },
    { id: "house", word: "House" },
    { id: "ghost", word: "Rain", ghost: true },
    { id: "disabled", word: "Wall", disabled: true },
    null
  ];

  const assignments = assignPrimarySemanticFacets({ words });
  assert.deepEqual(assignments.map(({ word }) => word), ["Water", "Ocean", "House"]);
  assert.deepEqual(assignments.map(({ id }) => id), ["word:water", "word:ocean", "word:house"]);
  assert.equal(assignments[0].primaryFacetId, "forces", "authored facet priority resolves overlapping matches");
  assert.deepEqual(assignments[0].facetIds, ["forces", "liquids"]);
  assert.equal(assignments[1].primaryFacetId, "liquids");
  assert.equal(assignments[2].primaryFacetId, "architecture");
  assert.equal(new Set(assignments.map(({ key }) => key)).size, assignments.length);
  assert.ok(Object.isFrozen(assignments));
  assert.ok(assignments.every(Object.isFrozen));
  assert.ok(assignments.every(({ facetIds }) => Object.isFrozen(facetIds)));
});

test("primary facet choice is stable when inventory order changes", () => {
  const words = [
    { word: "Water", category: "force" },
    { word: "Ocean" },
    { word: "Electricity" },
    { word: "Wall" }
  ];
  const forward = new Map(assignPrimarySemanticFacets({ words }).map((node) => [node.key, node.primaryFacetId]));
  const reverse = new Map(assignPrimarySemanticFacets({ words: [...words].reverse() }).map((node) => [node.key, node.primaryFacetId]));
  assert.deepEqual(reverse, forward);
});

test("semantic beacons appear only when useful, rank deterministically, and stay bounded", () => {
  const words = [
    { word: "Water", category: "force" },
    { word: "Electricity" },
    { word: "Air", category: "force" },
    { word: "Ocean" },
    { word: "Rain" },
    { word: "Fire" },
    { word: "Lava" },
    { word: "House" },
    { word: "Wall" }
  ];

  const beacons = buildSemanticBeacons({ words, max: 3 });
  assert.deepEqual(beacons.map(({ id }) => id), ["forces", "liquids", "fire-heat"]);
  assert.deepEqual(beacons.map(({ count }) => count), [3, 3, 2]);
  assert.ok(beacons.every(({ count }) => count >= 2));
  assert.ok(beacons.every(({ wordKeys }) => new Set(wordKeys).size === wordKeys.length));
  assert.equal(buildSemanticBeacons({ words: [{ word: "House" }] }).some(({ id }) => id === "architecture"), false);
  assert.equal(buildSemanticBeacons({ words, max: 0 }).length, 0);

  const reversed = buildSemanticBeacons({ words: [...words].reverse(), max: 3 });
  assert.deepEqual(reversed.map(({ id, count, primaryCount }) => ({ id, count, primaryCount })),
    beacons.map(({ id, count, primaryCount }) => ({ id, count, primaryCount })));
  assert.ok(Object.isFrozen(beacons));
  assert.ok(beacons.every(({ wordKeys, primaryWordKeys }) => Object.isFrozen(wordKeys) && Object.isFrozen(primaryWordKeys)));
});

test("board anchors normalize, clamp, reject invalid coordinates, and fall back deterministically", () => {
  assert.deepEqual(normalizeBoardAnchor({ x: 1.25, y: -0.4 }), { x: 1, y: 0 });
  assert.deepEqual(
    normalizeBoardAnchor({ x: 1.25, y: -0.4, unclamped: true }),
    { x: 1.25, y: -0.4, unclamped: true }
  );
  assert.deepEqual(normalizeBoardAnchor(["0.25", 0.75]), { x: 0.25, y: 0.75 });
  assert.equal(normalizeBoardAnchor({ x: "not-a-number", y: 0.5 }), null);
  assert.equal(normalizeBoardAnchor(null), null);

  const first = deterministicBoardAnchor("memory:42:result");
  const second = deterministicBoardAnchor("memory:42:result");
  assert.deepEqual(first, second);
  assert.ok(first.x >= 0.08 && first.x <= 0.92);
  assert.ok(first.y >= 0.1 && first.y <= 0.88);
  assert.ok(Object.isFrozen(first));
});

test("memory projection includes performed recipes only and trusts only approved route evidence", () => {
  const history = [
    { a: "Fire", b: "Water", word: "Steam", runIqRelevance: "route" },
    { a: "Earth", b: "Water", word: "Mud", routeStepsAdvanced: "2" },
    { a: "Air", b: "Fire", word: "Energy", routeDerived: true },
    { a: "Space", b: "Time", word: "Horizon", routeCompleted: true },
    { a: "Known", b: "Unknown", word: "Future", future: true, routeCompleted: true },
    { a: "Rejected", b: "Pair", word: "Nope", success: false },
    { a: "Incomplete", word: "Missing ingredient" }
  ];

  const projection = projectCombinationMemory({ history });
  assert.equal(projection.totalPerformed, 4);
  assert.equal(projection.detailedCount, 4);
  assert.equal(projection.aggregatedCount, 0);
  assert.deepEqual(projection.detailed.map(({ result }) => result), ["Steam", "Mud", "Energy", "Horizon"]);
  assert.deepEqual(projection.detailed.map(({ routeForward }) => routeForward), [false, true, true, true]);
  assert.equal(projection.stars.some(({ word }) => word === "Future" || word === "Nope"), false);
  assert.equal(projection.edges.length, 8);
  assert.deepEqual(projection.edges.slice(0, 2).map(({ routeForward }) => routeForward), [false, false]);
  assert.ok(Object.isFrozen(projection));
  assert.ok(Object.isFrozen(projection.detailed));
  assert.ok(Object.isFrozen(projection.stars));
  assert.ok(Object.isFrozen(projection.edges));
});

test("memory projection applies specific and normalized-word live anchors without mutating them", () => {
  const liveAnchors = {
    "memory:0:ingredient-a": { x: 1.4, y: -0.2 },
    WATER: [0.25, 0.75]
  };
  const projection = projectCombinationMemory({
    history: [{ a: "Fire", b: "Water", word: "Steam" }],
    liveAnchors
  });
  const [fire, water, steam] = projection.stars;
  assert.deepEqual(fire.anchor, { x: 1, y: 0, source: "live" });
  assert.deepEqual(water.anchor, { x: 0.25, y: 0.75, source: "live" });
  assert.equal(steam.anchor.source, "deterministic");
  assert.deepEqual(liveAnchors, {
    "memory:0:ingredient-a": { x: 1.4, y: -0.2 },
    WATER: [0.25, 0.75]
  });

  const restored = projectCombinationMemory({
    history: [{ a: "Fire", b: "Water", word: "Steam" }],
    liveAnchors: [{ id: "memory:0:result", x: 0.4, y: 0.6 }]
  });
  assert.deepEqual(restored.stars[2].anchor, { x: 0.4, y: 0.6, source: "live" });
});

test("performed recipes retain their own historical coordinates even when words repeat or move", () => {
  const projection = projectCombinationMemory({
    history: [
      {
        a: "Fire", b: "Water", word: "Steam",
        anchors: { ingredientA: { x: 0.12, y: 0.24 }, ingredientB: { x: 0.3, y: 0.44 }, result: { x: 0.22, y: 0.31 } }
      },
      {
        a: "Steam", b: "Earth", word: "Geyser",
        anchors: { a: { x: 0.76, y: 0.62 }, b: { x: 0.84, y: 0.7 }, output: { x: 0.8, y: 0.54 } }
      }
    ],
    liveAnchors: { Steam: { x: 0.5, y: 0.5 } }
  });

  assert.deepEqual(projection.detailed[0].stars.map(({ anchor }) => anchor), [
    { x: 0.12, y: 0.24, source: "history" },
    { x: 0.3, y: 0.44, source: "history" },
    { x: 0.22, y: 0.31, source: "history" }
  ]);
  assert.deepEqual(projection.detailed[1].stars.map(({ anchor }) => anchor), [
    { x: 0.76, y: 0.62, source: "history" },
    { x: 0.84, y: 0.7, source: "history" },
    { x: 0.8, y: 0.54, source: "history" }
  ]);
});

test("memory detail is capped at 84 while older performed history aggregates deterministically", () => {
  const history = Array.from({ length: 90 }, (_, index) => ({
    a: `Base ${index}`,
    b: `Seed ${index}`,
    word: "Stone",
    routeStepsAdvanced: index === 2 ? 1 : 0
  }));

  const projection = projectCombinationMemory({ history });
  assert.equal(COMBINING_BOARD_MEMORY_LIMIT, 84);
  assert.equal(projection.totalPerformed, 90);
  assert.equal(projection.detailedCount, 84);
  assert.equal(projection.aggregatedCount, 6);
  assert.equal(projection.detailed[0].historyIndex, 6);
  assert.equal(projection.detailed.at(-1).historyIndex, 89);
  assert.equal(projection.aggregates.length, 1);
  assert.deepEqual(projection.aggregates[0], {
    id: "memory-aggregate:materials",
    facetId: "materials",
    label: "Materials",
    count: 6,
    routeCount: 1,
    routeForward: true,
    firstHistoryIndex: 0,
    lastHistoryIndex: 5,
    resultWords: ["Stone"],
    anchor: projection.aggregates[0].anchor
  });
  assert.deepEqual(projectCombinationMemory({ history }), projection);

  const fullyAggregated = projectCombinationMemory({ history: history.slice(0, 3), maxDetailed: 0 });
  assert.equal(fullyAggregated.detailedCount, 0);
  assert.equal(fullyAggregated.aggregatedCount, 3);
  assert.equal(fullyAggregated.stars.length, 0);
  assert.equal(fullyAggregated.edges.length, 0);
});

test("fusion tiers follow approved precedence and Scramble remains micro-only", () => {
  assert.deepEqual(COMBINING_BOARD_FUSION_TIERS, ["micro", "discovery", "hero", "instant"]);
  assert.equal(classifyFusionTier({ repeated: true }), "micro");
  assert.equal(classifyFusionTier({ newDiscovery: true }), "discovery");
  assert.equal(classifyFusionTier({ routeStepsAdvanced: 1 }), "discovery");
  assert.equal(classifyFusionTier({ routeDerived: true }), "discovery");
  assert.equal(classifyFusionTier({ runIqRelevance: "route" }), "micro", "descriptive labels are not route authority");
  assert.equal(classifyFusionTier({ goldenPair: true }), "hero");
  assert.equal(classifyFusionTier({ foundationalPair: true }), "hero");
  assert.equal(classifyFusionTier({ source: "cosmic-twist" }), "hero");
  assert.equal(classifyFusionTier({ routeCompleted: true }), "hero");
  assert.equal(classifyFusionTier({ goldenPair: true }, { mode: "scramble" }), "micro");
  assert.equal(classifyFusionTier({ routeCompleted: true, mode: "scramble" }), "micro");
  assert.equal(classifyFusionTier({ goldenPair: true }, { mode: "scramble", effects: "off" }), "instant");
  assert.equal(classifyFusionTier({ newDiscovery: true }, { effects: false }), "instant");
});

test("every gameplay mode exposes an explicit immutable presentation contract", () => {
  assert.deepEqual(COMBINING_BOARD_MODES, ["ranked", "daily", "project", "explore", "tutorial", "scramble", "reveal"]);
  assert.deepEqual(Object.keys(COMBINING_BOARD_MODE_RULES), COMBINING_BOARD_MODES);
  assert.equal(getCombiningBoardModeRules("ranked").routeChart, true);
  assert.equal(getCombiningBoardModeRules("daily").memoryConstellation, true);
  assert.equal(getCombiningBoardModeRules("project").maxFusionTier, "hero");
  assert.equal(getCombiningBoardModeRules("explore").targetBeacon, false);
  assert.equal(getCombiningBoardModeRules("explore").memoryConstellation, true);
  assert.equal(getCombiningBoardModeRules("tutorial").semanticBrowser, "instructed-only");
  assert.equal(getCombiningBoardModeRules("tutorial").instructedWordsOnly, true);
  assert.equal(getCombiningBoardModeRules("scramble").competitive, true);
  assert.equal(getCombiningBoardModeRules("scramble").memoryConstellation, false);
  assert.equal(getCombiningBoardModeRules("scramble").maxFusionTier, "micro");
  assert.equal(getCombiningBoardModeRules("reveal").suspended, true);
  assert.equal(getCombiningBoardModeRules("reveal").fusion, false);
  assert.ok(COMBINING_BOARD_MODES.every((mode) => Object.isFrozen(getCombiningBoardModeRules(mode))));
  assert.ok(Object.isFrozen(COMBINING_BOARD_MODE_RULES));
});

test("mode normalization is safe and defaults unknown values to ranked", () => {
  assert.equal(normalizeCombiningBoardMode(" SCRAMBLE "), "scramble");
  assert.equal(normalizeCombiningBoardMode("not-a-mode"), "ranked");
  assert.equal(normalizeCombiningBoardMode(null), "ranked");
  assert.equal(getCombiningBoardModeRules("not-a-mode"), getCombiningBoardModeRules("ranked"));
});
