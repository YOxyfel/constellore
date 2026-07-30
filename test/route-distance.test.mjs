import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  authoredMovesRemaining,
  buildAuthoredRouteProgress,
  sanitizeAuthoredRouteProgress
} from "../public/route-distance.mjs";

const starters = ["Earth", "Water", "Fire", "Air"];
const recipes = [
  { a: "Earth", b: "Water", word: "Mud" },
  { a: "Mud", b: "Fire", word: "Brick" },
  { a: "Mud", b: "Air", word: "Mortar" },
  { a: "Brick", b: "Mortar", word: "Wall" },
  { a: "Earth", b: "Fire", word: "Clay" },
  { a: "Clay", b: "Water", word: "House" }
];

test("authored distance counts a dependency once even when two branches reuse it", () => {
  assert.equal(authoredMovesRemaining({ recipes, available: starters, target: "Wall" }), 4);
  assert.equal(authoredMovesRemaining({ recipes, available: [...starters, "Mud"], target: "Wall" }), 3);
  assert.equal(authoredMovesRemaining({ recipes, available: [...starters, "Mud", "Brick"], target: "Wall" }), 2);
});

test("unrelated discoveries do not create fake route progress", () => {
  const baseline = buildAuthoredRouteProgress({ recipes, available: starters, target: "Wall", total: 4 });
  const unrelated = buildAuthoredRouteProgress({ recipes, available: [...starters, "Clay"], target: "Wall", total: 4 });
  assert.deepEqual(unrelated, baseline);
  assert.deepEqual(Object.keys(baseline).sort(), ["complete", "percent", "remaining", "total"]);
  assert.equal(JSON.stringify(baseline).includes("Mud"), false);
});

test("alternate authored routes can become the new closest route without exposing them", () => {
  const extended = [...recipes, { a: "House", b: "House", word: "Wall" }];
  const initial = buildAuthoredRouteProgress({ recipes: extended, available: starters, target: "Wall", total: 3 });
  const closer = buildAuthoredRouteProgress({ recipes: extended, available: [...starters, "Clay"], target: "Wall", total: 3 });
  assert.equal(initial.remaining, 3);
  assert.equal(closer.remaining, 2);
  assert.ok(closer.percent > initial.percent);
});

test("cyclic alternatives cannot poison a later valid dependency plan", async () => {
  const cyclicAlternatives = [
    { a: "Alpha", b: "Xray", word: "Goal" },
    { a: "Aardvark", b: "Xray", word: "Alpha" },
    { a: "Seed", b: "Seed", word: "Alpha" },
    { a: "Alpha", b: "Seed", word: "Xray" }
  ];
  assert.equal(authoredMovesRemaining({
    recipes: cyclicAlternatives,
    available: ["Aardvark", "Seed"],
    target: "Goal"
  }), 3);

  const { authoredRecipeCatalog, solutionRoute } = await import("../server.mjs");
  const factoryRoute = solutionRoute("Factory");
  assert.equal(factoryRoute.length, 3);
  assert.equal(authoredMovesRemaining({
    recipes: authoredRecipeCatalog(),
    available: starters,
    target: "Factory"
  }), factoryRoute.length);
});

test("already owning the target completes the meter and malformed values stay bounded", () => {
  assert.deepEqual(sanitizeAuthoredRouteProgress(null), {
    total: 0,
    remaining: 0,
    complete: false,
    percent: 0
  });
  assert.equal(authoredMovesRemaining({ recipes, available: [...starters, "Wall"], target: "Wall" }), 0);
  assert.deepEqual(buildAuthoredRouteProgress({ recipes, available: [...starters, "Wall"], target: "Wall", total: 4 }), {
    total: 4,
    remaining: 0,
    complete: true,
    percent: 100
  });
  assert.deepEqual(sanitizeAuthoredRouteProgress({ total: 4, remaining: 99 }), {
    total: 4,
    remaining: 4,
    complete: false,
    percent: 0
  });
});

test("the client uses authoritative route distance instead of history length for target progress", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8");
  const start = app.indexOf("function updateMilestone(");
  const end = app.indexOf("function renderResultRoute(", start);
  const milestone = app.slice(start, end);
  assert.match(app, /acceptRouteProgress\(result[.]routeProgress\)/);
  assert.match(milestone, /progress[.]remaining/);
  assert.match(milestone, /progress[.]percent/);
  assert.doesNotMatch(milestone, /model[.]lineFill/);
  assert.match(milestone, /Closest route to/);
  assert.match(page, /id="runMilestone"[^>]+aria-label="Closest known route"/);
  assert.match(styles, /[.]simple-ui [.]run-milestone > div:first-child span,[\s\S]*font-size:\s*15px/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*[.]run-milestone/);
});

test("server progress keeps one stable total as the authored distance falls", async () => {
  const { authoredRouteProgress, solutionRoute } = await import("../server.mjs");
  const route = solutionRoute("Telescope");
  const total = route.length;
  const initial = authoredRouteProgress("Telescope", starters);
  const closer = authoredRouteProgress("Telescope", [...starters, route[0].word]);
  assert.equal(initial.total, total);
  assert.equal(initial.remaining, total);
  assert.equal(initial.percent, 0);
  assert.equal(closer.total, total);
  assert.ok(closer.remaining < initial.remaining);
  assert.ok(closer.percent > initial.percent);
});

test("the online and generated offline runtimes return the same spoiler-safe shape", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const local = await readFile(new URL("../public/local-beta.mjs", import.meta.url), "utf8");
  const build = await readFile(new URL("../scripts/build-local-world.mjs", import.meta.url), "utf8");
  assert.match(server, /routeProgress:\s*routeProgressForRun\(run\)/);
  assert.match(local, /routeProgress:\s*localRouteProgressForRun\(run\)/);
  assert.match(local, /function localRouteProgressForRun\(run\)[\s\S]{0,260}localRouteProgressFor\([\s\S]{0,160}run[.]solutionRoute[\s\S]{0,120}run[.]available/);
  assert.match(build, /export function localRouteProgress\(value, available\)/);
  for (const source of [server, local, build]) {
    assert.doesNotMatch(source, /routeProgress\s*:\s*\{[^}]*\b(?:a|b|word|recipe|route)\b/s);
  }
});
