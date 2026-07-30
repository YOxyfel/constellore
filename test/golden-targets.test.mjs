import test from "node:test";
import assert from "node:assert/strict";
import {
  GOLDEN_TARGET_COUNT,
  GOLDEN_TARGET_EARLY_COMPLETION_LIMIT,
  GOLDEN_TARGET_MAX_ROUTE_LENGTH,
  GOLDEN_TARGET_MIN_FINAL_RECIPES,
  GOLDEN_TARGET_MIN_ROUTE_LENGTH,
  GOLDEN_TARGETS,
  goldenTargetCatalog,
  goldenTargetOrder,
  isGoldenTarget,
  preferGoldenTargetCandidates
} from "../public/golden-targets.mjs";
import {
  authoredCombination,
  buildGameForMode,
  coreOfficialTargetCatalog,
  goldenOfficialTargetCatalog,
  officialTargetCatalog,
  solutionRoute
} from "../server.mjs";

const key = (value) => String(value || "").trim().toLocaleLowerCase("en-US");

test("the Golden 50 is a stable, unique catalog with plain contextual clues", () => {
  assert.equal(GOLDEN_TARGETS.length, GOLDEN_TARGET_COUNT);
  assert.equal(new Set(GOLDEN_TARGETS.map((entry) => key(entry.target))).size, GOLDEN_TARGET_COUNT);
  assert.deepEqual(GOLDEN_TARGETS.map((entry) => entry.order), Array.from({ length: GOLDEN_TARGET_COUNT }, (_, index) => index));

  for (const entry of GOLDEN_TARGETS) {
    assert.ok(entry.target.length >= 3 && entry.target.length <= 24, `${entry.target} needs a readable name`);
    assert.ok(entry.clue.length >= 24 && entry.clue.length <= 90, `${entry.target} needs a concise, useful clue`);
    assert.doesNotMatch(entry.clue, /logical fusions|follow a .* trail|route length/i);
    assert.ok(entry.routeLength >= GOLDEN_TARGET_MIN_ROUTE_LENGTH);
    assert.ok(entry.routeLength <= GOLDEN_TARGET_MAX_ROUTE_LENGTH);
    assert.equal(entry.minimumFinalRecipes, GOLDEN_TARGET_MIN_FINAL_RECIPES);
    assert.equal(goldenTargetOrder(entry.target), entry.order);
    assert.equal(isGoldenTarget(entry.target.toLocaleUpperCase("en-US")), true);
  }

  const copy = goldenTargetCatalog();
  copy[0].clue = "changed";
  assert.notEqual(GOLDEN_TARGETS[0].clue, "changed", "callers receive mutable copies, not the frozen source");
});

test("every Golden target has a deterministic 3–7 step authored route and alternate endings", () => {
  const pool = new Map(officialTargetCatalog().map((entry) => [key(entry.target), entry]));
  const core = new Map(coreOfficialTargetCatalog().map((entry) => [key(entry.target), entry]));
  const officialGolden = goldenOfficialTargetCatalog();
  assert.equal(officialGolden.length, GOLDEN_TARGET_COUNT);
  assert.deepEqual(officialGolden.map((entry) => entry.target), GOLDEN_TARGETS.map((entry) => entry.target));

  for (const definition of GOLDEN_TARGETS) {
    const selected = pool.get(key(definition.target));
    const firstRoute = solutionRoute(definition.target);
    const secondRoute = solutionRoute(definition.target);
    const establishedCore = core.get(key(definition.target));
    assert.ok(selected, `${definition.target} must ship in the 500-target universe`);
    assert.equal(selected.source, "official");
    assert.equal(
      selected.clue,
      establishedCore?.clue || definition.clue,
      `${definition.target} must preserve core metadata or use its Golden clue`
    );
    assert.equal(selected.finalRecipeCount >= definition.minimumFinalRecipes, true, `${definition.target} needs alternate final recipes`);
    assert.equal(firstRoute.length, definition.routeLength, `${definition.target} route length changed`);
    assert.deepEqual(secondRoute, firstRoute, `${definition.target} route must be deterministic`);
    assert.equal(key(firstRoute.at(-1)?.word), key(definition.target));

    const available = new Set(["earth", "water", "fire", "air"]);
    for (const step of firstRoute) {
      assert.equal(available.has(key(step.a)), true, `${definition.target} is missing ${step.a}`);
      assert.equal(available.has(key(step.b)), true, `${definition.target} is missing ${step.b}`);
      assert.equal(key(authoredCombination(step.a, step.b)?.word), key(step.word), `${step.a} + ${step.b} must remain authored`);
      available.add(key(step.word));
    }
  }
});

test("opening personal challenges prefer only Golden targets and remain deterministic", () => {
  const sample = [
    { target: "Unknown Late Target", routeLength: 3 },
    { target: "Galaxy", routeLength: 5 },
    { target: "Rain", routeLength: 3 },
    { target: "Rocket", routeLength: 6 }
  ];
  assert.deepEqual(
    preferGoldenTargetCandidates(sample, { completedChallenges: 0 }).map((entry) => entry.target),
    ["Rain", "Galaxy", "Rocket"]
  );
  assert.deepEqual(
    preferGoldenTargetCandidates(sample, { completedChallenges: GOLDEN_TARGET_EARLY_COMPLETION_LIMIT }).map((entry) => entry.target),
    sample.map((entry) => entry.target)
  );

  for (const completedChallenges of [0, 3, 9, 18, GOLDEN_TARGET_EARLY_COMPLETION_LIMIT - 1]) {
    const level = Math.min(10, 1 + Math.floor(completedChallenges / 3));
    for (const seed of [0, 1, 17, 91, 4_321]) {
      const state = {
        version: 2,
        level,
        completedChallenges,
        failureStreak: 0,
        recentTargets: []
      };
      const first = buildGameForMode("reach", seed, "", 0, state);
      const second = buildGameForMode("reach", seed, "", 0, state);
      assert.equal(isGoldenTarget(first.target), true, `${first.target} escaped the early catalog`);
      assert.equal(first.target, second.target, "the same seed and progression state must pick the same target");
    }
  }
});
