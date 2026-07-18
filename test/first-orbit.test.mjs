import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FIRST_ORBIT_ROUTE,
  firstOrbitProgress,
  firstOrbitWrongPairMessage,
  resolveFirstOrbitCombination,
  sanitizeFirstOrbitState
} from "../public/first-orbit.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

test("the First Orbit is a fixed three-combination logical route", () => {
  assert.deepEqual(FIRST_ORBIT_ROUTE.map(({ a, b, word }) => ({ a, b, word })), [
    { a: "Earth", b: "Water", word: "Mud" },
    { a: "Mud", b: "Fire", word: "Brick" },
    { a: "Brick", b: "Brick", word: "Wall" }
  ]);
});

test("progress advances only from confirmed combination history", () => {
  const unrelated = [{ a: "Fire", b: "Fire", word: "Inferno" }];
  assert.equal(firstOrbitProgress(unrelated).index, 0);

  const spoofed = [{ a: "Earth", b: "Water", word: "Ocean" }];
  assert.equal(firstOrbitProgress(spoofed).index, 0);

  const first = [{ a: "Water", b: "Earth", word: "Mud" }];
  assert.equal(firstOrbitProgress(first).index, 1);
  assert.deepEqual(firstOrbitProgress(first).spotlightWords, ["Mud", "Fire"]);

  const complete = [
    ...first,
    { a: "Mud", b: "Fire", word: "Brick" },
    { a: "Brick", b: "Brick", word: "Wall" }
  ];
  assert.deepEqual(firstOrbitProgress(complete), {
    index: 3,
    total: 3,
    complete: true,
    step: null,
    spotlightWords: [],
    percent: 100
  });
});

test("training resolver accepts either pair order and only the current recipe", () => {
  const mud = resolveFirstOrbitCombination("water", "EARTH", []);
  assert.equal(mud.word, "Mud");
  assert.equal(mud.completed, false);
  assert.equal(mud.ranked, false);

  assert.equal(resolveFirstOrbitCombination("Earth", "Fire", []), null);

  const history = [{ a: "Earth", b: "Water", word: "Mud" }];
  assert.equal(resolveFirstOrbitCombination("Fire", "Mud", history).word, "Brick");
  assert.match(firstOrbitWrongPairMessage(history), /Mud with Fire/);
});

test("revealed routes cannot complete tutorial progress", () => {
  const history = FIRST_ORBIT_ROUTE.map((step) => ({ ...step, revealed: true }));
  assert.equal(firstOrbitProgress(history).index, 0);
});

test("profile tutorial state is reduced to safe booleans", () => {
  assert.deepEqual(sanitizeFirstOrbitState(null), { seen: false, completed: false });
  assert.deepEqual(sanitizeFirstOrbitState({ seen: 1, completed: "yes", ignored: true }), { seen: true, completed: true });
});

test("training UI is accessible, skippable, and replayable from Profile", () => {
  assert.match(page, /id="firstOrbitGuide"[^>]+aria-labelledby="firstOrbitGuideTitle"/);
  assert.match(page, /id="firstOrbitInstruction" aria-live="polite"/);
  assert.match(page, /id="skipFirstOrbit"/);
  assert.match(page, /id="replayFirstOrbit"/);
  assert.match(page, /TRAINING ORBIT &middot; 0 SCORE/);
  assert.match(styles, /[.]first-orbit-guide p[^}]+font-size:\s*15px/);
});

test("training combinations remain local, deterministic, and reward-ineligible", () => {
  const trainingBranch = app.slice(app.indexOf("if (firstOrbitActive())", app.indexOf("async function combineNodes")), app.indexOf("} else {", app.indexOf("if (firstOrbitActive())", app.indexOf("async function combineNodes"))));
  assert.match(trainingBranch, /resolveFirstOrbitCombination/);
  assert.doesNotMatch(trainingBranch, /fetchJson/);
  assert.match(app, /mode:\s*"training"[\s\S]+scoreEligible:\s*false[\s\S]+rewardEligible:\s*false[\s\S]+leaderboardEligible:\s*false/);
  assert.match(app, /state[.]mode === "training"/);
  assert.match(app, /profile[.]firstOrbit = \{ seen: true, completed: true \}/);
});
