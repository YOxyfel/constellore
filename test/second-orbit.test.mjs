import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  SECOND_ORBIT_ROUTE,
  sanitizeSecondOrbitState,
  secondOrbitProgress
} from "../public/second-orbit.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("Second Orbit is a curated three-fusion route to Mountain", () => {
  assert.deepEqual(SECOND_ORBIT_ROUTE.map(({ a, b, word }) => ({ a, b, word })), [
    { a: "Earth", b: "Fire", word: "Lava" },
    { a: "Lava", b: "Water", word: "Stone" },
    { a: "Stone", b: "Stone", word: "Mountain" }
  ]);
});

test("unrelated experimentation does not break the next route signal", () => {
  const history = [
    { a: "Water", b: "Water", word: "Ocean" },
    { a: "Fire", b: "Earth", word: "Lava" },
    { a: "Air", b: "Air", word: "Wind" }
  ];
  const progress = secondOrbitProgress(history);
  assert.equal(progress.index, 1);
  assert.equal(progress.step.word, "Stone");
  assert.deepEqual(progress.spotlightWords, ["Lava"]);
});

test("Second Orbit state is strictly reduced to booleans", () => {
  assert.deepEqual(sanitizeSecondOrbitState(null), { seen: false, completed: false });
  assert.deepEqual(sanitizeSecondOrbitState({ seen: 1, completed: "yes", route: ["spoiler"] }), { seen: true, completed: true });
});

test("Second Orbit is client-side and never sends an unsupported server mode", () => {
  const beginBranch = app.slice(app.indexOf("async function beginMode"), app.indexOf("async function beginCustomTarget"));
  assert.match(beginBranch, /mode === "second-orbit"[\s\S]+openSecondOrbitBriefing/);
  assert.match(app, /startWithGame\(secondOrbitGame\(\), null\)/);
  assert.doesNotMatch(app.slice(app.indexOf("function startSecondOrbit"), app.indexOf("function openFirstOrbitBriefing")), /createRun|requestMissionPreview/);
  assert.match(page, /id="replaySecondOrbit"/);
});

