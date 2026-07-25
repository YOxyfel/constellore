import assert from "node:assert/strict";
import test from "node:test";
import {
  authoredCombination,
  logicalPairExpansionCatalog,
  logicalPairExpansionQualityReport,
  reachableFromStarters
} from "../server.mjs";
import {
  logicalPairKey,
  validateLogicalPairExpansion
} from "../content/logical-pair-expansion-3-1.mjs";
import { generateLocalWorldData } from "../scripts/build-local-world.mjs";

const logicalRecipes = logicalPairExpansionCatalog();

test("v3.1 selects the smallest complete semantic-family set above three-times coverage", () => {
  const report = logicalPairExpansionQualityReport();
  assert.equal(report.acceptedFields, 711);
  assert.equal(report.acceptedRecipes, 2_133);
  assert.equal(report.canonicalPairsAfterSelection, 3_199);
  assert.equal(report.minimumCanonicalPairs, 3_198);
  assert.equal(logicalRecipes.length, report.acceptedRecipes);
  assert.equal(new Set(logicalRecipes.map((recipe) => logicalPairKey(recipe.a, recipe.b))).size, logicalRecipes.length);
  assert.equal(report.distinctResults, 711);
});

test("every logical field is playable, bounded, and has four related-field onward connections", () => {
  const fieldWords = new Set(logicalRecipes.map((recipe) => recipe.word.toLowerCase()));
  const continuations = new Map([...fieldWords].map((word) => [word, 0]));
  const foundationalReachable = reachableFromStarters();

  for (let index = 0; index < logicalRecipes.length; index += 1) {
    const recipe = logicalRecipes[index];
    for (const value of [recipe.a, recipe.b, recipe.word]) {
      assert.ok(value.length <= 28, `${value} must fit the gameplay word limit`);
      assert.match(value, /^[\p{L}\p{N}][\p{L}\p{N} '&-]*$/u);
    }
    assert.equal(authoredCombination(recipe.a, recipe.b)?.word, recipe.word);
    for (const ingredient of [recipe.a, recipe.b]) {
      const key = ingredient.toLowerCase();
      if (continuations.has(key)) continuations.set(key, continuations.get(key) + 1);
    }

    if (index % 3 === 0) {
      assert.ok(foundationalReachable.has(recipe.a.toLowerCase()), `${recipe.a} must be starter-reachable`);
      assert.ok(foundationalReachable.has(recipe.b.toLowerCase()), `${recipe.b} must be starter-reachable`);
    }
  }

  assert.ok(
    [...continuations.entries()].every(([, count]) => count >= 4),
    "every new field must remain useful in at least four related-field combinations"
  );
});

test("semantic rings use specific related fields and exclude audited tautologies", () => {
  const fieldWords = new Set(logicalRecipes.map((recipe) => recipe.word.toLowerCase()));
  const combinations = new Map(logicalRecipes.map((recipe) => [
    logicalPairKey(recipe.a, recipe.b),
    recipe.word
  ]));
  assert.equal(
    combinations.get(logicalPairKey("Marine Biology", "Marine Ecology")),
    "Marine Wildlife"
  );
  assert.equal(
    combinations.get(logicalPairKey("Marine Biology", "Marine Wildlife")),
    "Marine Ecology"
  );

  const forbiddenResults = new Set([
    "Botanical Botany",
    "Culinary Cooking",
    "Fishery Biology",
    "Aerial Art",
    "Nocturnal History",
    "Domestic Tourism",
    "Culinary Pollution",
    "Culinary Emissions",
    "Culinary Energy",
    "Culinary Engineering",
    "Culinary Automation",
    "Culinary Research",
    "Horticultural Cuisine",
    "Horticultural Cooking",
    "Zoological Tourism"
  ].map((word) => word.toLowerCase()));
  assert.ok(logicalRecipes.every((recipe) => !forbiddenResults.has(recipe.word.toLowerCase())));
  assert.equal(combinations.has(logicalPairKey("Marine Trade", "History")), false);
  assert.equal(combinations.has(logicalPairKey("Marine Weather", "Engineering")), false);

  const curatedExamples = new Map([
    [["Farm", "Food"], "Farm-to-Table"],
    [["Farm", "Cooking"], "Farmhouse Cooking"],
    [["Sky", "Biology"], "Aerobiology"],
    [["Water", "Geology"], "Hydrogeology"],
    [["Stone", "Energy"], "Geothermal Energy"],
    [["Fish", "Survival"], "Fish Adaptation"],
    [["Road", "Society"], "Car Culture"],
    [["Telescope", "Climate"], "Climate Observation"],
    [["Animal", "Civilization"], "Animal Culture"],
    [["Animal", "Tourism"], "Safari"]
  ]);
  for (const [[a, b], word] of curatedExamples) {
    assert.equal(combinations.get(logicalPairKey(a, b)), word);
  }

  for (let index = 0; index < logicalRecipes.length; index += 3) {
    const field = logicalRecipes[index].word.toLowerCase();
    for (const transition of logicalRecipes.slice(index + 1, index + 3)) {
      assert.ok(fieldWords.has(transition.a.toLowerCase()));
      assert.ok(fieldWords.has(transition.b.toLowerCase()));
      assert.ok(fieldWords.has(transition.word.toLowerCase()));
    }
  }
});

test("the logical-pair validator rejects duplicates, malformed words, raw concatenation, and nonsense", () => {
  const valid = {
    a: "Ocean",
    b: "Biology",
    word: "Marine Biology",
    emoji: "🌊",
    note: "Ocean gives biology a clear marine focus.",
    source: "expanded"
  };
  const duplicate = validateLogicalPairExpansion([
    valid,
    { ...valid, a: "Biology", b: "Ocean", word: "Marine Ecology" }
  ]);
  assert.ok(duplicate.issues.some((issue) => /duplicates unordered pair/i.test(issue)));

  const malformed = validateLogicalPairExpansion([
    { ...valid, word: "<script>" }
  ]);
  assert.ok(malformed.issues.some((issue) => /malformed result/i.test(issue)));

  const tooLong = validateLogicalPairExpansion([
    { ...valid, word: "A".repeat(29) }
  ]);
  assert.ok(tooLong.issues.some((issue) => /malformed result/i.test(issue)));

  const concatenated = validateLogicalPairExpansion([
    { ...valid, word: "OceanBiology" }
  ]);
  assert.ok(concatenated.issues.some((issue) => /raw ingredient concatenation/i.test(issue)));

  const nonsense = validateLogicalPairExpansion([
    { ...valid, word: "Craft Thing" }
  ]);
  assert.ok(nonsense.issues.some((issue) => /placeholder or nonsense/i.test(issue)));
});

test("the generated world keeps release topology and concentration gates after tripling", async () => {
  const data = await generateLocalWorldData();
  assert.equal(data.contentQuality.authoredCoverage.authoredPairs, 3_199);
  assert.equal(data.payload.recipes.length, 3_199);
  assert.ok(data.contentQuality.worldGraph.topology.problematicDeadEndCount <= 140);
  assert.ok(data.contentQuality.worldGraph.topology.thinConceptCount <= 220);
  assert.ok(data.contentQuality.outputConcentration.maximumPairsPerOutput <= 5);
  assert.equal(data.contentQuality.worldGraph.targets.reachable, data.contentQuality.worldGraph.targets.count);
  assert.ok(
    data.contentQuality.worldGraph.targets.withMultipleFinalRecipes >= 250,
    "high-rank remixes need a deep alternate-final target pool"
  );
});
