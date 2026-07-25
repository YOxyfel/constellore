import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { cosmicTwistWords } from "../public/cosmic-twists.mjs";
import {
  INTENTIONAL_ENDPOINTS,
  WORLD_GRAPH_BETA_MAX_PROBLEMATIC_DEAD_ENDS,
  WORLD_GRAPH_VERSION,
  analyzeWorldGraph,
  buildConceptCatalog
} from "../content/world-graph-3.mjs";
import { REVIEWED_OBVIOUS_ATTEMPTS, reviewedIntentCorpusSummary } from "../content/reviewed-intents-3.mjs";

const STARTERS = [
  { word: "Earth", emoji: "🌍", category: "nature" },
  { word: "Water", emoji: "💧", category: "force" },
  { word: "Fire", emoji: "🔥", category: "force" },
  { word: "Air", emoji: "💨", category: "force" }
];
const MISSING_RESULT = 0xffff;
const DAILY_VARIANTS = Object.freeze([
  Object.freeze({ id: "classic", name: "Classic Route", moveBuffer: null, rewardBonus: 0 }),
  Object.freeze({ id: "charted", name: "Charted Route", moveBuffer: 2, rewardBonus: 20 }),
  Object.freeze({ id: "precision", name: "Precision Route", moveBuffer: 1, rewardBonus: 35 })
]);

function pairOffset(left, right, size) {
  const a = Math.min(left, right);
  const b = Math.max(left, right);
  return a * size - (a * (a - 1)) / 2 + (b - a);
}

function gameSignature(game) {
  const clean = structuredClone(game);
  delete clean.seed;
  delete clean.challengeId;
  delete clean.aiEnabled;
  delete clean.worldSize;
  return JSON.stringify(clean);
}

function modeCycle(buildGameForMode, mode, stage = 0) {
  // The public destination pool contains 500 entries. Probe far enough to
  // detect that full period while still keeping this build deterministic.
  const games = Array.from({ length: 2048 }, (_, seed) => buildGameForMode(mode, seed, "", stage));
  const signatures = games.map(gameSignature);
  for (let period = 1; period <= 1024; period += 1) {
    if (signatures.every((signature, index) => index < period || signature === signatures[index % period])) {
      return games.slice(0, period).map((game) => JSON.parse(gameSignature(game)));
    }
  }
  throw new Error(`Could not determine a deterministic cycle for ${mode}.`);
}

function dailySchedule(buildGameForMode, targetRoutes, length = 90) {
  return Array.from({ length }, (_, dayIndex) => {
    const game = buildGameForMode("daily", dayIndex);
    const variant = DAILY_VARIANTS[Math.floor(dayIndex / 30) % DAILY_VARIANTS.length];
    const routeLength = targetRoutes[game.target.toLowerCase()]?.length;
    if (!Number.isInteger(routeLength)) throw new Error(`Daily target ${game.target} has no route for its schedule.`);
    return {
      ...JSON.parse(gameSignature(game)),
      modeName: variant.id === "classic" ? "Word of the Day" : `Word of the Day · ${variant.name}`,
      moveLimit: variant.moveBuffer === null ? null : routeLength + variant.moveBuffer,
      reward: game.reward + variant.rewardBonus,
      dailyContentId: `wg3-day-${String(dayIndex + 1).padStart(3, "0")}`,
      graphVersion: WORLD_GRAPH_VERSION,
      routeModifier: { id: variant.id, name: variant.name }
    };
  });
}

export async function generateLocalWorldData() {
  const {
    authoredCombination,
    buildGameForMode,
    officialTargetCatalog,
    registerSemanticConcept,
    registerWishConcept,
    semanticCategoryFor,
    solutionRoute
  } = await import("../server.mjs");
  const { MARKET_CATALOG } = await import("../game-services.mjs");

  const records = new Map(STARTERS.map((item) => [item.word.toLowerCase(), { ...item }]));
  const expandRecords = () => {
    for (let round = 0; round < 12; round += 1) {
      const words = [...records.values()];
      let added = 0;
      for (let left = 0; left < words.length; left += 1) {
        for (let right = left; right < words.length; right += 1) {
          const result = authoredCombination(words[left].word, words[right].word);
          if (!result || records.has(result.word.toLowerCase())) continue;
          records.set(result.word.toLowerCase(), {
            word: result.word,
            emoji: result.emoji,
            category: semanticCategoryFor(result.word) || "nature"
          });
          added += 1;
        }
      }
      if (!added) return;
    }
    throw new Error("The local word universe did not settle.");
  };

  expandRecords();
  const naturalTargets = new Set(records.keys());
  for (const item of cosmicTwistWords()) {
    registerSemanticConcept(item.word, item.category);
    if (!records.has(item.word.toLowerCase())) records.set(item.word.toLowerCase(), { ...item });
  }
  for (const item of MARKET_CATALOG) {
    if (records.has(item.word.toLowerCase())) continue;
    records.set(item.word.toLowerCase(), {
      word: item.word,
      emoji: item.emoji,
      category: semanticCategoryFor(item.word) || registerWishConcept(item.word) || item.category || "nature"
    });
  }
  expandRecords();

  const words = [...records.values()];
  if (words.length >= MISSING_RESULT) throw new Error("The local universe exceeds the Uint16 recipe format.");
  const indexByWord = new Map(words.map((item, index) => [item.word.toLowerCase(), index]));
  const matrix = new Uint16Array(words.length * (words.length + 1) / 2);
  matrix.fill(MISSING_RESULT);
  const sparseRecipes = [];
  const authoredRecipes = [];
  let sameWordAuthoredPairs = 0;

  for (let left = 0; left < words.length; left += 1) {
    for (let right = left; right < words.length; right += 1) {
      const authored = authoredCombination(words[left].word, words[right].word);
      if (!authored) continue;
      const result = authored;
      const resultIndex = indexByWord.get(result.word.toLowerCase());
      if (resultIndex === undefined) throw new Error(`Local result ${result.word} is outside the generated universe.`);
      const offset = pairOffset(left, right, words.length);
      matrix[offset] = resultIndex;
      if (left === right) sameWordAuthoredPairs += 1;
      // The result index already identifies the canonical word, emoji, and
      // category. Two integers are enough for the offline lookup table; its
      // short note can be reconstructed without shipping thousands of nearly
      // identical explanation strings.
      // Ingredient indexes add little compressed size and let the static
      // runtime reconstruct only the alternate recipes needed for remixes.
      sparseRecipes.push([offset, resultIndex, left, right]);
      authoredRecipes.push({
        a: words[left].word,
        b: words[right].word,
        word: result.word,
        emoji: authored.emoji,
        note: authored.note,
        source: authored.source || "world"
      });
    }
  }

  const targetDetails = Object.fromEntries(words.filter((item) => naturalTargets.has(item.word.toLowerCase())).map((item) => {
    const known = buildGameForMode("reach", 0, item.word);
    return [item.word.toLowerCase(), known
      ? { target: known.target, emoji: known.emoji, clue: known.clue, tier: known.tier }
      : { target: item.word, emoji: item.emoji, clue: "A destination mapped in the local word universe.", tier: 3 }];
  }));

  const targetRoutes = {};
  for (const detail of Object.values(targetDetails)) {
    const route = solutionRoute(detail.target);
    if (!Array.isArray(route)) throw new Error(`No authored guidance route for ${detail.target}.`);
    targetRoutes[detail.target.toLowerCase()] = route.map(({ a, b, word }) => ({ a, b, word }));
  }
  const sparseTargetRoutes = Object.entries(targetRoutes).map(([target, route]) => [
    indexByWord.get(target),
    route.flatMap((step) => [
      indexByWord.get(step.a.toLowerCase()),
      indexByWord.get(step.b.toLowerCase()),
      indexByWord.get(step.word.toLowerCase())
    ])
  ]);
  if (sparseTargetRoutes.some(([target, route]) => target === undefined || route.some((index) => index === undefined))) {
    throw new Error("A compact target route references a word outside the generated universe.");
  }

  const modes = {
    reach: modeCycle(buildGameForMode, "reach"),
    quick: modeCycle(buildGameForMode, "quick"),
    moves: modeCycle(buildGameForMode, "moves"),
    daily: dailySchedule(buildGameForMode, targetRoutes),
    challenge: modeCycle(buildGameForMode, "challenge"),
    weekly: [0, 1, 2].map((stage) => modeCycle(buildGameForMode, "weekly", stage))
  };

  const officialTargets = officialTargetCatalog();
  const concepts = buildConceptCatalog(authoredRecipes, {
    starters: STARTERS.map((item) => item.word),
    hints: words,
    intentionalTerminals: INTENTIONAL_ENDPOINTS
  });
  const worldGraph = analyzeWorldGraph({
    recipes: authoredRecipes,
    starters: STARTERS.map((item) => item.word),
    targets: officialTargets,
    concepts,
    expectedAttempts: REVIEWED_OBVIOUS_ATTEMPTS
  });
  const routeChecks = [];
  const validateGameRoute = (game, modeLabel) => {
    const route = targetRoutes[game.target.toLowerCase()];
    const reachable = Array.isArray(route);
    const withinLimit = !game.moveLimit || (reachable && route.length <= game.moveLimit);
    routeChecks.push({ mode: modeLabel, target: game.target, moves: route?.length ?? null, moveLimit: game.moveLimit ?? null, reachable, withinLimit });
    if (!reachable) throw new Error(`${modeLabel} target ${game.target} has no authored route.`);
    if (!withinLimit) throw new Error(`${modeLabel} guidance for ${game.target} needs ${route.length} moves but allows ${game.moveLimit}.`);
  };
  for (const mode of ["reach", "quick", "moves", "daily", "challenge"]) {
    for (const game of modes[mode]) validateGameRoute(game, mode);
  }
  modes.weekly.forEach((games, stage) => games.forEach((game) => validateGameRoute(game, `weekly-${stage + 1}`)));

  const authoredPairs = sparseRecipes.length;
  const totalPairs = matrix.length;
  const resultCounts = new Map();
  for (const [, resultIndex] of sparseRecipes) {
    const result = words[resultIndex]?.word;
    if (result) resultCounts.set(result, (resultCounts.get(result) || 0) + 1);
  }
  const concentratedOutputs = [...resultCounts.entries()]
    .map(([word, pairCount]) => ({ word, pairCount, share: pairCount / authoredPairs }))
    .sort((left, right) => right.pairCount - left.pairCount || left.word.localeCompare(right.word));
  const logicalSpotChecks = [
    ["Earth", "Water", "Mud"],
    ["Water", "Water", "Ocean"],
    ["Fire", "Fire", "Inferno"],
    ["Air", "Air", "Wind"],
    ["Earth", "Earth", "Land"],
    ["Species", "Air", "Bird"],
    ["Brick", "Brick", "Wall"],
    ["Wall", "Wall", "House"],
    ["Tree", "Tree", "Forest"],
    ["Light", "Rain", "Rainbow"],
    ["Glass", "Sky", "Telescope"],
    ["House", "Rocket", "Space Station"]
  ].map(([a, b, expected]) => {
    const actual = authoredCombination(a, b)?.word || null;
    return { a, b, expected, actual, pass: actual === expected };
  });
  const difficultyBands = Object.fromEntries([1, 2, 3, 4, 5].map((tier) => [tier, officialTargets.filter((entry) => entry.tier === tier).length]));
  const distinctDailyTargets = new Set(modes.daily.map((game) => game.target)).size;
  const distinctDailyChallenges = new Set(modes.daily.map((game) => `${game.target}\0${game.routeModifier.id}\0${game.moveLimit ?? "open"}`)).size;
  const contentQuality = {
    schemaVersion: 3,
    graphVersion: WORLD_GRAPH_VERSION,
    authoredCoverage: { authoredPairs, sameWordPairs: sameWordAuthoredPairs, totalPairs, ratio: authoredPairs / totalPairs },
    intentCoverage: worldGraph.intentCoverage,
    intentCorpus: reviewedIntentCorpusSummary(REVIEWED_OBVIOUS_ATTEMPTS),
    officialTargetCount: officialTargets.length,
    difficultyBands,
    routeValidity: {
      checked: routeChecks.length,
      reachable: routeChecks.filter((check) => check.reachable).length,
      withinLimit: routeChecks.filter((check) => check.withinLimit).length,
      failures: routeChecks.filter((check) => !check.reachable || !check.withinLimit)
    },
    dailyRotation: {
      cycleLength: modes.daily.length,
      distinctChallenges: distinctDailyChallenges,
      distinctTargets: distinctDailyTargets,
      distinctModifiers: new Set(modes.daily.map((game) => game.routeModifier.id)).size
    },
    outputConcentration: {
      distinctOutputs: resultCounts.size,
      maximumPairsPerOutput: concentratedOutputs[0]?.pairCount || 0,
      maximumShare: concentratedOutputs[0]?.share || 0,
      top: concentratedOutputs.slice(0, 10)
    },
    logicalSpotChecks,
    worldGraph: {
      schemaVersion: worldGraph.schemaVersion,
      graphVersion: worldGraph.graphVersion,
      totals: worldGraph.totals,
      topology: {
        intentionalEndpointCount: worldGraph.topology.intentionalEndpointCount,
        intentionalTerminalDeadEndCount: worldGraph.topology.intentionalTerminalDeadEndCount,
        problematicDeadEndCount: worldGraph.topology.problematicDeadEndCount,
        problematicDeadEndLimit: WORLD_GRAPH_BETA_MAX_PROBLEMATIC_DEAD_ENDS,
        deadEndCount: worldGraph.topology.deadEndCount,
        thinConceptCount: worldGraph.topology.thinConceptCount,
        bottlenecks: worldGraph.topology.bottlenecks.slice(0, 10)
      },
      targets: {
        count: worldGraph.targets.count,
        reachable: worldGraph.targets.reachable,
        withMultipleFinalRecipes: worldGraph.targets.withMultipleFinalRecipes,
        withMultipleOpenings: worldGraph.targets.withMultipleOpenings
      },
      validationIssues: worldGraph.validationIssues
    }
  };

  if (officialTargets.length !== 500) throw new Error(`Official target catalog must contain exactly 500 destinations; found ${officialTargets.length}.`);
  if (Object.values(difficultyBands).some((count) => count < 1)) throw new Error("Every official difficulty band must contain at least one target.");
  if (modes.daily.length < 90 || distinctDailyChallenges < 90) throw new Error("Daily schedule must contain ninety distinct challenges.");
  if (distinctDailyTargets < 28) throw new Error(`Daily rotation collapsed to ${distinctDailyTargets} targets; at least four weeks are required.`);
  if (worldGraph.intentCoverage.attempts < 500) throw new Error(`Reviewed intent corpus collapsed to ${worldGraph.intentCoverage.attempts}; at least 500 attempts are required.`);
  if (worldGraph.intentCoverage.weightedCoverage !== 1 || worldGraph.intentCoverage.failures.length) throw new Error("Expected obvious-attempt coverage regressed.");
  if (worldGraph.topology.problematicDeadEndCount > WORLD_GRAPH_BETA_MAX_PROBLEMATIC_DEAD_ENDS) {
    throw new Error(`Problematic dead-end queue grew to ${worldGraph.topology.problematicDeadEndCount}; beta limit is ${WORLD_GRAPH_BETA_MAX_PROBLEMATIC_DEAD_ENDS}.`);
  }
  if (worldGraph.validationIssues.length) throw new Error(`World Graph validation failed: ${worldGraph.validationIssues.join(" ")}`);
  if (worldGraph.targets.reachable !== worldGraph.targets.count) throw new Error("An official World Graph target is unreachable.");
  if (worldGraph.targets.withMultipleFinalRecipes < 250) {
    throw new Error("At least 250 official targets must retain alternate final recipes for high-rank remixes.");
  }
  if (worldGraph.targets.withMultipleOpenings < 12) throw new Error("Official target opening diversity regressed below twelve goals.");
  if (worldGraph.topology.thinConceptCount > 220) {
    throw new Error(`Thin-concept queue grew to ${worldGraph.topology.thinConceptCount}; beta limit is 220.`);
  }
  const energyBottleneck = worldGraph.topology.bottlenecks.find((item) => item.word.toLowerCase() === "energy");
  if ((energyBottleneck?.share || 0) > 0.2) {
    throw new Error(`Energy appears in ${(energyBottleneck.share * 100).toFixed(1)}% of shortest target routes; beta limit is 20%.`);
  }
  if (logicalSpotChecks.some((check) => !check.pass)) throw new Error("A curated logical spot check failed.");
  if (authoredPairs < 700) throw new Error(`Authored recipe coverage collapsed to ${authoredPairs} pairs.`);
  if (sameWordAuthoredPairs < 100) throw new Error(`Same-word recipe coverage collapsed to ${sameWordAuthoredPairs} pairs.`);
  if (resultCounts.size < 650) throw new Error(`Authored output variety collapsed to ${resultCounts.size} distinct results.`);
  if ((concentratedOutputs[0]?.pairCount || 0) > 5) throw new Error(`Too many authored pairs collapse into ${concentratedOutputs[0].word}.`);

  return {
    words,
    matrix,
    sparseRecipes,
    worldGraph,
    contentQuality,
    payload: {
      version: 3,
      words,
      recipes: sparseRecipes,
      targetDetails,
      targetRoutes,
      packedTargetRoutes: sparseTargetRoutes,
      modes,
      contentQuality
    }
  };
}

export function contentQualityReport(data) {
  return structuredClone(data?.contentQuality || data?.payload?.contentQuality || null);
}

export function lookupGeneratedCombination(data, a, b) {
  const indexByWord = new Map(data.words.map((item, index) => [item.word.toLowerCase(), index]));
  const left = indexByWord.get(String(a).trim().toLowerCase());
  const right = indexByWord.get(String(b).trim().toLowerCase());
  if (left === undefined || right === undefined) return null;
  const resultIndex = data.matrix[pairOffset(left, right, data.words.length)];
  return resultIndex === MISSING_RESULT ? null : data.words[resultIndex];
}

function packLocalModeCycles(payload, targetIndexByWord) {
  const laws = [];
  const lawIndexById = new Map();
  const lawReference = (law) => {
    if (!law?.id || !law?.name || !law?.description) return -1;
    const id = String(law.id);
    const existing = lawIndexById.get(id);
    if (existing !== undefined) {
      const packed = laws[existing];
      if (packed[1] !== law.name || packed[2] !== law.description) {
        throw new Error(`Local law ${id} changed within one generated cycle.`);
      }
      return existing;
    }
    const index = laws.length;
    lawIndexById.set(id, index);
    laws.push([id, law.name, law.description]);
    return index;
  };
  const targetReference = (game) => {
    const index = targetIndexByWord.get(String(game?.target || "").toLowerCase());
    if (index === undefined) throw new Error(`A packed local mode references ${game?.target || "an unknown target"}.`);
    return index;
  };
  const simpleCycle = (mode) => payload.modes[mode].map(targetReference);
  const variantIndexById = new Map(DAILY_VARIANTS.map((variant, index) => [variant.id, index]));
  const daily = payload.modes.daily.flatMap((game) => {
    const lawIndex = lawReference(game.law);
    const modifierIndex = variantIndexById.get(game.routeModifier?.id);
    if (lawIndex < 0 || modifierIndex === undefined) {
      throw new Error(`Daily target ${game.target} has an unrecognized law or route modifier.`);
    }
    return [targetReference(game), lawIndex, modifierIndex];
  });
  const weekly = payload.modes.weekly.map((stage) => stage.flatMap((game) => {
    const lawIndex = lawReference(game.law);
    if (lawIndex < 0) throw new Error(`Weekly target ${game.target} has no recognized law.`);
    return [targetReference(game), lawIndex];
  }));
  return {
    modes: {
      r: simpleCycle("reach"),
      q: simpleCycle("quick"),
      m: simpleCycle("moves"),
      d: daily,
      c: simpleCycle("challenge"),
      w: weekly
    },
    laws
  };
}

export async function writeLocalWorldModule(destination) {
  const { payload } = await generateLocalWorldData();
  const { targetDetails, targetRoutes, packedTargetRoutes, modes: unpackedModes, ...portablePayload } = payload;
  const targetIndexByWord = new Map(payload.words.map((item, index) => [item.word.toLowerCase(), index]));
  const defaultTargetClue = "A destination chosen by you.";
  const defaultTargetTier = 2;
  const sharedTargetMetadata = new Map(payload.modes.challenge.map((game) => [game.target.toLowerCase(), game]));
  const topicNames = [...new Set(
    [...sharedTargetMetadata.values()].flatMap((game) => Array.isArray(game.topics) ? game.topics : [])
  )].sort();
  const topicIndexByName = new Map(topicNames.map((topic, index) => [topic, index]));
  const packedTargetDetails = Object.entries(targetDetails).flatMap(([key, detail]) => {
    if (detail.clue === defaultTargetClue && detail.tier === defaultTargetTier) return [];
    const index = targetIndexByWord.get(key);
    if (index === undefined) throw new Error(`A compact target detail references ${detail.target} outside the generated universe.`);
    const shared = sharedTargetMetadata.get(key);
    const topics = (Array.isArray(shared?.topics) ? shared.topics : [])
      .map((topic) => topicIndexByName.get(topic))
      .filter((topicIndex) => topicIndex !== undefined);
    return [[
      index,
      detail.clue,
      detail.tier,
      detail.emoji === payload.words[index]?.emoji ? "" : detail.emoji,
      topics,
      shared?.source === "official" ? 1 : 0,
      Math.max(0, Math.trunc(Number(shared?.poolVersion) || 0))
    ]];
  });
  const packedModes = packLocalModeCycles({ ...payload, modes: unpackedModes }, targetIndexByWord);
  const source = `const payload = ${JSON.stringify({
    ...portablePayload,
    modes: packedModes.modes,
    laws: packedModes.laws,
    dailyVariants: DAILY_VARIANTS.map((variant) => [
      variant.id,
      variant.name,
      variant.moveBuffer,
      variant.rewardBonus
    ]),
    topicNames,
    targetDetails: packedTargetDetails,
    targetRoutes: packedTargetRoutes
  })};
const indexByWord = new Map(payload.words.map((item, index) => [item.word.toLowerCase(), index]));
const recipeByOffset = new Map(payload.recipes.map((recipe) => [recipe[0], recipe]));
const routeByTarget = new Map(payload.targetRoutes);
const targetDetailByIndex = new Map(payload.targetDetails.map(([index, clue, tier, emoji, topicIndexes, official, poolVersion]) => [
  index,
  {
    clue,
    tier,
    emoji,
    topics: (topicIndexes || []).map((topicIndex) => payload.topicNames[topicIndex]).filter(Boolean),
    source: official ? "official" : "expanded",
    poolVersion: Math.max(0, Number(poolVersion) || 0)
  }
]));
const finalRecipeCountByIndex = new Map();
for (const [, resultIndex] of payload.recipes) {
  finalRecipeCountByIndex.set(resultIndex, (finalRecipeCountByIndex.get(resultIndex) || 0) + 1);
}
const defaultTargetClue = ${JSON.stringify(defaultTargetClue)};
const defaultTargetTier = ${defaultTargetTier};

function pairOffset(left, right) {
  const a = Math.min(left, right);
  const b = Math.max(left, right);
  return a * payload.words.length - (a * (a - 1)) / 2 + (b - a);
}

export function canonicalLocalWord(value) {
  const index = indexByWord.get(String(value || \"\").trim().toLowerCase());
  return index === undefined ? null : payload.words[index].word;
}

export function canonicalLocalTarget(value) {
  const normalized = String(value || \"\").trim().toLowerCase();
  const index = indexByWord.get(normalized);
  return index !== undefined && routeByTarget.has(index) ? payload.words[index].word : null;
}

export function localItemFor(value) {
  const index = indexByWord.get(String(value || \"\").trim().toLowerCase());
  return index === undefined ? null : { ...payload.words[index], source: \"local-catalog\" };
}

export function lookupLocalCombination(a, b) {
  const left = indexByWord.get(String(a || \"\").trim().toLowerCase());
  const right = indexByWord.get(String(b || \"\").trim().toLowerCase());
  if (left === undefined || right === undefined) return null;
  const offset = pairOffset(left, right);
  const authored = recipeByOffset.get(offset);
  if (!authored) return null;
  const resultIndex = authored[1];
  const result = payload.words[resultIndex];
  return {
    ...result,
    note: payload.words[left].word + \" and \" + payload.words[right].word + \" make \" + result.word + \".\",
    source: \"world\"
  };
}

export function localRouteTo(value) {
  const targetKey = String(value || \"\").trim().toLowerCase();
  const targetIndex = indexByWord.get(targetKey);
  const stored = routeByTarget.get(targetIndex);
  if (!Array.isArray(stored) || stored.length % 3 !== 0) return null;
  const route = [];
  for (let index = 0; index < stored.length; index += 3) {
    const a = payload.words[stored[index]]?.word;
    const b = payload.words[stored[index + 1]]?.word;
    const expected = payload.words[stored[index + 2]]?.word;
    const result = lookupLocalCombination(a, b);
    if (!result || result.word.toLowerCase() !== expected?.toLowerCase()) return null;
    route.push({ a, b, ...result });
  }
  return route;
}

export function localRemixRecipesFor(value) {
  const route = localRouteTo(value);
  if (!Array.isArray(route)) return [];
  const resultIndexes = new Set(route
    .map((step) => indexByWord.get(step.word.toLowerCase()))
    .filter((index) => index !== undefined));
  return payload.recipes
    .filter((recipe) => recipe.length >= 4 && resultIndexes.has(recipe[1]))
    .map((recipe) => ({
      a: payload.words[recipe[2]]?.word,
      b: payload.words[recipe[3]]?.word,
      word: payload.words[recipe[1]]?.word
    }))
    .filter((recipe) => recipe.a && recipe.b && recipe.word);
}

export function localRouteProgress(value, available) {
  const targetKey = String(value || \"\").trim().toLowerCase();
  const targetIndex = indexByWord.get(targetKey);
  const stored = routeByTarget.get(targetIndex);
  const total = Array.isArray(stored) ? stored.length / 3 : 0;
  if (!Array.isArray(stored) || stored.length % 3 !== 0) {
    return { total: 0, remaining: 0, complete: false, percent: 0 };
  }
  const known = new Set((Array.isArray(available) ? available : [...(available || [])])
    .map((item) => String(item?.word || item || \"\").trim().toLowerCase())
    .filter(Boolean));
  if (known.has(targetKey)) return { total, remaining: 0, complete: true, percent: 100 };
  const needed = new Set([targetIndex]);
  let remaining = 0;
  for (let index = stored.length - 3; index >= 0; index -= 3) {
    const leftIndex = stored[index];
    const rightIndex = stored[index + 1];
    const resultIndex = stored[index + 2];
    if (!needed.has(resultIndex)) continue;
    needed.delete(resultIndex);
    const resultKey = payload.words[resultIndex]?.word.toLowerCase();
    if (resultKey && known.has(resultKey)) continue;
    remaining += 1;
    needed.add(leftIndex);
    needed.add(rightIndex);
  }
  return {
    total,
    remaining,
    complete: false,
    percent: total ? Math.max(0, Math.min(99, Math.round(((total - remaining) / total) * 100))) : 0
  };
}

const localModeRules = Object.freeze({
  reach: Object.freeze({ mode: \"reach\", modeName: \"Reach\", timeLimit: null, moveLimit: null, reward: 70 }),
  quick: Object.freeze({ mode: \"quick\", modeName: \"Quick Orbit\", timeLimit: 90, moveLimit: null, reward: 100 }),
  moves: Object.freeze({ mode: \"moves\", modeName: \"Move Limit\", timeLimit: null, moveLimit: 12, reward: 110 }),
  daily: Object.freeze({ mode: \"daily\", modeName: \"Word of the Day\", timeLimit: null, moveLimit: null, reward: 180 }),
  weekly: Object.freeze({ mode: \"weekly\", modeName: \"Weekly Expedition\", timeLimit: null, moveLimit: 10, reward: 130 }),
  challenge: Object.freeze({ mode: \"challenge\", modeName: \"Friend Challenge\", timeLimit: null, moveLimit: null, reward: 90 })
});
const packedModeKey = Object.freeze({ reach: \"r\", quick: \"q\", moves: \"m\", daily: \"d\", challenge: \"c\", weekly: \"w\" });

function localLawAt(index) {
  const packed = payload.laws[index];
  return packed ? { id: packed[0], name: packed[1], description: packed[2] } : null;
}

function localRouteLengthAt(index) {
  const stored = routeByTarget.get(index);
  return Array.isArray(stored) && stored.length % 3 === 0 ? stored.length / 3 : 0;
}

function localRouteBand(routeLength) {
  if (routeLength <= 4) return \"spark\";
  if (routeLength <= 7) return \"path\";
  if (routeLength <= 11) return \"journey\";
  if (routeLength <= 16) return \"expedition\";
  return \"odyssey\";
}

function localTargetFields(index) {
  const item = payload.words[index];
  if (!item || !routeByTarget.has(index)) return null;
  const detail = targetDetailByIndex.get(index);
  const routeLength = localRouteLengthAt(index);
  const topics = detail?.topics?.length ? [...detail.topics] : [item.category || \"discovery\", \"discovery\"];
  return {
    target: item.word,
    emoji: detail?.emoji || item.emoji,
    clue: detail?.clue || defaultTargetClue,
    tier: detail?.tier || defaultTargetTier,
    routeLength,
    finalRecipeCount: Math.max(1, finalRecipeCountByIndex.get(index) || 0),
    routeBand: localRouteBand(routeLength),
    topics,
    primaryTopic: topics[0] || \"discovery\",
    source: detail?.source || \"expanded\",
    poolVersion: detail?.poolVersion || 1
  };
}

function localPackedGame(mode, safeSeed, safeStage) {
  const key = packedModeKey[mode];
  const packed = mode === \"weekly\" ? payload.modes[key][safeStage] : payload.modes[key];
  if (!Array.isArray(packed) || packed.length === 0) return null;
  let targetIndex;
  let extras = {};

  if (mode === \"daily\") {
    const cycleLength = packed.length / 3;
    const cycleIndex = safeSeed % cycleLength;
    const offset = cycleIndex * 3;
    targetIndex = packed[offset];
    const law = localLawAt(packed[offset + 1]);
    const variant = payload.dailyVariants[packed[offset + 2]];
    if (!law || !variant) return null;
    const routeLength = localRouteLengthAt(targetIndex);
    extras = {
      modeName: variant[0] === \"classic\" ? \"Word of the Day\" : \"Word of the Day · \" + variant[1],
      moveLimit: variant[2] === null ? null : routeLength + variant[2],
      reward: localModeRules.daily.reward + variant[3],
      law,
      dailyContentId: \"wg3-day-\" + String(cycleIndex + 1).padStart(3, \"0\"),
      graphVersion: payload.contentQuality.graphVersion,
      routeModifier: { id: variant[0], name: variant[1] }
    };
  } else if (mode === \"weekly\") {
    const cycleLength = packed.length / 2;
    const offset = (safeSeed % cycleLength) * 2;
    targetIndex = packed[offset];
    const law = localLawAt(packed[offset + 1]);
    if (!law) return null;
    extras = {
      stage: safeStage,
      stageCount: 3,
      moveLimit: 10 + safeStage * 2,
      law
    };
  } else {
    targetIndex = packed[safeSeed % packed.length];
  }

  const target = localTargetFields(targetIndex);
  return target ? { ...target, ...localModeRules[mode], ...extras } : null;
}

export function buildLocalGame(mode, seed = 0, target = \"\", stage = 0) {
  const normalizedMode = [\"reach\", \"quick\", \"moves\", \"daily\", \"weekly\", \"challenge\"].includes(mode) ? mode : \"reach\";
  const safeSeed = Math.trunc(Math.abs(Number(seed) || 0));
  const safeStage = Math.trunc(Math.min(2, Math.max(0, Number(stage) || 0)));
  let game = localPackedGame(normalizedMode, safeSeed, safeStage);
  if (!game) return null;
  if (target) {
    const index = indexByWord.get(String(target).trim().toLowerCase());
    if (index === undefined || !routeByTarget.has(index)) return null;
    game = { ...game, ...localTargetFields(index) };
  }
  return {
    ...game,
    seed: safeSeed,
    stage: normalizedMode === \"weekly\" ? safeStage : game.stage,
    starters: [\"Earth\", \"Water\", \"Fire\", \"Air\"],
    aiEnabled: false,
    worldSize: payload.words.length,
    ranked: false,
    localOnly: true
  };
}

export function localAdaptiveCandidates(mode) {
  const normalizedMode = [\"reach\", \"quick\", \"moves\"].includes(mode) ? mode : \"\";
  if (!normalizedMode) return [];
  const rule = localModeRules[normalizedMode];
  if (!rule) return [];
  const candidates = [];
  for (const [index, detail] of targetDetailByIndex) {
    const stored = routeByTarget.get(index);
    if (!Array.isArray(stored) || stored.length % 3 !== 0) continue;
    const routeLength = stored.length / 3;
    if (normalizedMode === \"quick\" && routeLength > 8) continue;
    if (normalizedMode === \"moves\" && routeLength > 12) continue;
    const targetFields = localTargetFields(index);
    if (!targetFields) continue;
    candidates.push({
      ...structuredClone(rule),
      ...targetFields,
      pathCount: Math.max(1, finalRecipeCountByIndex.get(index) || 0),
      difficultyLevel: Math.min(10, Math.max(1, Math.round(routeLength * 0.65 + Number(detail.tier || defaultTargetTier) * 0.9 - 1))),
      reachable: true,
      routeValid: true
    });
  }
  return candidates;
}

export function localSuggestions(limit = 8) {
  const preferred = [\"Telescope\", \"Bird\", \"Forest\", \"Rainbow\", \"City\", \"Rocket\", \"Ocean\", \"Dragon\"];
  return preferred.filter((word) => indexByWord.has(word.toLowerCase())).slice(0, limit);
}

export const localWorldSize = payload.words.length;
export const localRecipeCount = payload.recipes.length;
export const localGraphVersion = payload.contentQuality.graphVersion;
export const localContentQuality = structuredClone(payload.contentQuality);
`;
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, source, "utf8");
  return payload;
}
