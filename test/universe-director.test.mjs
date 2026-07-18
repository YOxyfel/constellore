import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_UNIVERSE_CACHE_ENTRIES,
  MAX_UNIVERSE_ROUTE_STEPS,
  UNIVERSE_DIRECTOR_VERSION,
  annotateUniverseResult,
  buildUniverseManifest,
  constrainUniverseResults,
  sanitizeUniverseCache,
  selectUniverse,
  universeCatalog,
  universeSeedIdentity,
  validateUniverseRoute
} from "../public/universe-director.mjs";

const recipes = [
  { a: "Earth", b: "Water", word: "Mud", emoji: "M", category: "nature", note: "Earth and water settle into mud." },
  { a: "Air", b: "Fire", word: "Energy", emoji: "E", category: "force", note: "Fire moving through air becomes energy." },
  { a: "Mud", b: "Energy", word: "Life", emoji: "L", category: "life", note: "Energy wakes the fertile mud." },
  { a: "Life", b: "Earth", word: "Plant", emoji: "P", category: "life", note: "Life rooted in earth becomes a plant." }
];

const route = [
  { a: "Water", b: "Earth", word: "Mud", emoji: "untrusted" },
  { a: "Fire", b: "Air", word: "Energy", category: "untrusted" },
  { a: "Energy", b: "Mud", word: "Life", note: "untrusted" }
];

function validatedRoute() {
  return validateUniverseRoute({ starters: ["Earth", "Water", "Fire", "Air"], target: "Life", route, recipes });
}

test("seed identities are opaque, canonical, and reproduce the same authored universe", () => {
  const raw = "friend-secret-seed";
  const identity = universeSeedIdentity(raw);
  assert.match(identity, /^cx1-[a-z0-9]{14}$/);
  assert.doesNotMatch(identity, /friend|secret|seed/);
  assert.equal(universeSeedIdentity(identity), identity);
  assert.deepEqual(selectUniverse(identity), selectUniverse(raw));
  assert.deepEqual(selectUniverse(raw), selectUniverse(raw));
});

test("empty and hostile seeds become bounded deterministic identities", () => {
  assert.equal(universeSeedIdentity(), universeSeedIdentity(""));
  assert.match(universeSeedIdentity("x\u0000\n".repeat(500)), /^cx1-[a-z0-9]{14}$/);
  assert.equal(JSON.stringify(selectUniverse("same")), JSON.stringify(selectUniverse("same")));
});

test("the finite catalog is defensively copied and contains presentation laws only", () => {
  const first = universeCatalog();
  const second = universeCatalog();
  assert.ok(first.length >= 4 && first.length <= 8);
  assert.deepEqual(first, second);
  assert.ok(first.every((universe) => universe.season?.id && universe.law?.id && universe.affinities.length === 2));
  const catalogKeys = new Set(first.flatMap((universe) => [
    ...Object.keys(universe),
    ...Object.keys(universe.season),
    ...Object.keys(universe.law)
  ]));
  for (const mechanicalKey of ["score", "reward", "ranked", "multiplier", "recipes", "results"]) {
    assert.equal(catalogKeys.has(mechanicalKey), false);
  }
  first[0].name = "Mutated";
  first[0].affinities.push("cheat");
  assert.notEqual(universeCatalog()[0].name, "Mutated");
  assert.ok(!universeCatalog()[0].affinities.includes("cheat"));
});

test("a dependency-ordered route is rebuilt exclusively from canonical recipes", () => {
  const validation = validatedRoute();
  assert.equal(validation.valid, true);
  assert.equal(validation.reason, "validated");
  assert.equal(validation.target, "Life");
  assert.equal(validation.routeSteps, 3);
  assert.deepEqual(validation.route, [
    { a: "Water", b: "Earth", word: "Mud", emoji: "M", category: "nature", note: "Earth and water settle into mud." },
    { a: "Fire", b: "Air", word: "Energy", emoji: "E", category: "force", note: "Fire moving through air becomes energy." },
    { a: "Energy", b: "Mud", word: "Life", emoji: "L", category: "life", note: "Energy wakes the fertile mud." }
  ]);
  assert.equal(route[0].emoji, "untrusted", "input route is not mutated");
});

test("ingredient order and flexible serializable recipe shapes behave identically", () => {
  const flexible = recipes.map((recipe) => ({
    ingredients: [recipe.b, recipe.a],
    result: { word: recipe.word, emoji: recipe.emoji, category: recipe.category, note: recipe.note }
  }));
  const validation = validateUniverseRoute({
    starters: [{ word: "Earth" }, { word: "Water" }, { word: "Fire" }, { word: "Air" }],
    target: "life",
    route: route.map((step) => ({ inputs: [step.b, step.a], result: step.word })),
    recipes: flexible
  });
  assert.equal(validation.valid, true);
  assert.equal(validation.route.at(-1).word, "Life");
});

test("forward references and unreachable dependencies are rejected at the exact step", () => {
  const validation = validateUniverseRoute({
    starters: ["Earth", "Water", "Fire", "Air"],
    target: "Life",
    route: [route[2], route[0], route[1]],
    recipes
  });
  assert.deepEqual({ valid: validation.valid, reason: validation.reason, step: validation.step }, {
    valid: false,
    reason: "dependency_unavailable",
    step: 0
  });
});

test("unknown and invented recipe results never pass validation", () => {
  const unknown = validateUniverseRoute({
    starters: ["Earth", "Water"],
    target: "Ocean",
    route: [{ a: "Earth", b: "Water", word: "Ocean" }],
    recipes: []
  });
  assert.equal(unknown.reason, "unknown_recipe");

  const invented = validateUniverseRoute({
    starters: ["Earth", "Water"],
    target: "Gold",
    route: [{ a: "Earth", b: "Water", word: "Gold" }],
    recipes
  });
  assert.equal(invented.reason, "recipe_mismatch");
});

test("conflicting definitions make a pair ambiguous instead of choosing one", () => {
  const validation = validateUniverseRoute({
    starters: ["Earth", "Water"],
    target: "Mud",
    route: [{ a: "Earth", b: "Water", word: "Mud" }],
    recipes: [...recipes, { a: "Water", b: "Earth", word: "Swamp" }]
  });
  assert.equal(validation.reason, "ambiguous_recipe");
});

test("the target must be the final newly produced result", () => {
  const afterTarget = validateUniverseRoute({
    starters: ["Earth", "Water", "Fire", "Air"],
    target: "Mud",
    route: [route[0], route[1]],
    recipes
  });
  assert.equal(afterTarget.reason, "target_not_final");

  const wrongTarget = validateUniverseRoute({
    starters: ["Earth", "Water"],
    target: "Life",
    route: [route[0]],
    recipes
  });
  assert.equal(wrongTarget.reason, "wrong_target");
});

test("a target that is already a starter needs an empty route", () => {
  assert.deepEqual(validateUniverseRoute({ starters: ["Earth"], target: "earth", route: [], recipes }), {
    valid: true,
    reason: "validated",
    step: null,
    target: "earth",
    starters: ["Earth"],
    route: [],
    routeSteps: 0
  });
  assert.equal(validateUniverseRoute({
    starters: ["Earth", "Water"],
    target: "Earth",
    route: [{ a: "Earth", b: "Water", word: "Mud" }],
    recipes
  }).reason, "target_already_available");
});

test("route size, starter count, redundant results, and malformed input stay bounded", () => {
  assert.equal(validateUniverseRoute({ starters: [], target: "Mud", route, recipes }).reason, "missing_starters");
  assert.equal(validateUniverseRoute({ starters: "Earth", target: "Mud", route, recipes }).reason, "invalid_input");
  assert.equal(validateUniverseRoute({
    starters: Array.from({ length: 33 }, (_, index) => `Starter ${index}`),
    target: "Mud",
    route: [],
    recipes
  }).reason, "starter_limit");
  assert.equal(validateUniverseRoute({
    starters: ["Earth", "Water", "Fire", "Air"],
    target: "Life",
    route,
    recipes,
    maxSteps: 2
  }).reason, "route_limit");
  assert.equal(validateUniverseRoute({
    starters: ["Earth", "Water", "Fire", "Air"],
    target: "Life",
    route: [route[0], route[0], route[1], route[2]],
    recipes
  }).reason, "redundant_result");
  assert.equal(MAX_UNIVERSE_ROUTE_STEPS, 48);
});

test("result annotations require an exact recipe and cannot alter ranked semantics", () => {
  const universe = selectUniverse("shared-orbit");
  const result = Object.freeze({
    word: "Mud",
    emoji: "M",
    category: "nature",
    source: "world",
    ranked: true,
    scoreEligible: true,
    leaderboardEligible: true,
    score: 900
  });
  const annotated = annotateUniverseResult({ universe, a: "Earth", b: "Water", result, recipes });
  assert.equal(annotated.result, result, "the gameplay result is returned untouched by reference");
  assert.deepEqual(annotated.result, result);
  assert.deepEqual(Object.keys(annotated.context).sort(), ["label", "lawId", "resonance", "seasonId", "seedId", "universeId"]);
  assert.doesNotMatch(JSON.stringify(annotated.context), /score|ranked|reward|leaderboard/i);

  assert.equal(annotateUniverseResult({ universe, a: "Earth", b: "Water", result: { word: "Gold" }, recipes }), null);
  assert.equal(annotateUniverseResult({ universe, a: "Earth", b: "Moon", result, recipes }), null);
});

test("candidate constraints filter rather than manufacture and preserve caller order", () => {
  const valid = { word: "Mud", ranked: true };
  const duplicate = { word: "mud", marker: "second" };
  const invalid = { word: "Palace" };
  const constrained = constrainUniverseResults({
    seed: "one",
    a: "Earth",
    b: "Water",
    results: [invalid, valid, duplicate],
    recipes,
    limit: 2
  });
  assert.equal(constrained.length, 2);
  assert.equal(constrained[0].result, valid);
  assert.equal(constrained[1].result, duplicate);
  assert.equal(constrainUniverseResults({ a: "Earth", b: "Water", results: [invalid], recipes }).length, 0);
  assert.deepEqual(constrainUniverseResults({ a: "Earth", b: "Water", results: [valid], recipes, limit: 0 }), []);
});

test("manifests export only bounded non-spoiler metadata", () => {
  const validation = validatedRoute();
  validation.playerToken = "do-not-export";
  validation.route[0].privatePrompt = "secret-model-prompt";
  const manifest = buildUniverseManifest({ seed: "raw-secret-seed", validation });
  assert.deepEqual(Object.keys(manifest).sort(), [
    "lawId", "routeSteps", "seasonId", "seedId", "starterCount", "targetId", "universeId", "validated", "version"
  ]);
  assert.equal(manifest.version, UNIVERSE_DIRECTOR_VERSION);
  assert.equal(manifest.validated, true);
  assert.equal(manifest.routeSteps, 3);
  assert.equal(manifest.starterCount, 4);
  assert.match(manifest.targetId, /^t-[a-z0-9]{14}$/);
  assert.doesNotMatch(JSON.stringify(manifest), /Life|Mud|Energy|raw-secret|playerToken|prompt|score|ranked/i);
  assert.equal(buildUniverseManifest({ seed: "x", validation: { valid: false } }), null);
});

test("cache sanitization is allowlist-only, deduplicated, and hard-capped", () => {
  const base = buildUniverseManifest({ seed: "base", validation: validatedRoute() });
  const many = Array.from({ length: MAX_UNIVERSE_CACHE_ENTRIES + 20 }, (_, index) => {
    const validation = validatedRoute();
    validation.target = `Target ${index}`;
    return {
      ...buildUniverseManifest({ seed: `seed-${index}`, validation }),
      route: route,
      target: `Target ${index}`,
      playerId: "private-player",
      token: "private-token"
    };
  });
  const forged = { ...base, universeId: "forged-universe" };
  const cache = sanitizeUniverseCache({ entries: [base, base, forged, ...many] });
  assert.equal(cache.version, UNIVERSE_DIRECTOR_VERSION);
  assert.equal(cache.entries.length, MAX_UNIVERSE_CACHE_ENTRIES);
  assert.deepEqual(cache.entries[0], base);
  assert.equal(new Set(cache.entries.map((entry) => `${entry.seedId}:${entry.targetId}`)).size, cache.entries.length);
  assert.doesNotMatch(JSON.stringify(cache), /private|token|Target 0|\"target\":|\"route\"|Mud|Energy/i);
  assert.deepEqual(sanitizeUniverseCache(null), { version: UNIVERSE_DIRECTOR_VERSION, entries: [] });
  assert.deepEqual(sanitizeUniverseCache([base], { limit: 0 }), { version: UNIVERSE_DIRECTOR_VERSION, entries: [] });
});

test("JSON round trips produce byte-identical server and Pages decisions", () => {
  const payload = JSON.parse(JSON.stringify({
    starters: ["Earth", "Water", "Fire", "Air"],
    target: "Life",
    route,
    recipes
  }));
  const serverDecision = {
    universe: selectUniverse("cx-shared-2026"),
    validation: validateUniverseRoute(payload)
  };
  const pagesDecision = JSON.parse(JSON.stringify({
    universe: selectUniverse("cx-shared-2026"),
    validation: validateUniverseRoute(JSON.parse(JSON.stringify(payload)))
  }));
  assert.equal(JSON.stringify(serverDecision), JSON.stringify(pagesDecision));
});
