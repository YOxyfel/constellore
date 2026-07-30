import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FIRST_ORBIT_COMBINATION_COUNT,
  FIRST_ORBIT_ROUTE,
  FIRST_ORBIT_STARTERS,
  FIRST_ORBIT_TARGET,
  createFirstOrbitGame,
  firstOrbitProgress,
  firstOrbitWrongPairMessage,
  resolveFirstOrbitCombination,
  sanitizeFirstOrbitState
} from "../public/first-orbit.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const simpleStyles = await readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8");

test("the First Orbit is one deliberately easy logical combination", () => {
  assert.deepEqual(FIRST_ORBIT_ROUTE.map(({ a, b, word }) => ({ a, b, word })), [
    { a: "Earth", b: "Water", word: "Mud" }
  ]);
  const reachable = new Set(FIRST_ORBIT_STARTERS);
  for (const step of FIRST_ORBIT_ROUTE) {
    assert.equal(reachable.has(step.a), true, `${step.a} must already be available`);
    assert.equal(reachable.has(step.b), true, `${step.b} must already be available`);
    reachable.add(step.word);
  }
  assert.equal(reachable.has(FIRST_ORBIT_TARGET), true);
  assert.equal(FIRST_ORBIT_COMBINATION_COUNT, 1);
});

test("progress advances only from confirmed combination history", () => {
  const unrelated = [{ a: "Fire", b: "Fire", word: "Inferno" }];
  assert.equal(firstOrbitProgress(unrelated).index, 0);

  const spoofed = [{ a: "Earth", b: "Water", word: "Ocean" }];
  assert.equal(firstOrbitProgress(spoofed).index, 0);

  const first = [{ a: "Water", b: "Earth", word: "Mud" }];
  assert.equal(firstOrbitProgress(first).index, 1);
  assert.deepEqual(firstOrbitProgress(first), {
    index: 1,
    total: 1,
    complete: true,
    step: null,
    spotlightWords: [],
    percent: 100
  });
});

test("training resolver accepts either pair order and only the current recipe", () => {
  const mud = resolveFirstOrbitCombination("water", "EARTH", []);
  assert.equal(mud.word, "Mud");
  assert.equal(mud.completed, true);
  assert.equal(mud.ranked, false);

  assert.equal(resolveFirstOrbitCombination("Earth", "Fire", []), null);

  const history = [{ a: "Earth", b: "Water", word: "Mud" }];
  assert.equal(resolveFirstOrbitCombination("Fire", "Mud", history), null);
  assert.match(firstOrbitWrongPairMessage(history), /complete/);
});

test("revealed routes cannot complete tutorial progress", () => {
  const history = FIRST_ORBIT_ROUTE.map((step) => ({ ...step, revealed: true }));
  assert.equal(firstOrbitProgress(history).index, 0);
});

test("profile tutorial state is reduced to safe booleans", () => {
  assert.deepEqual(sanitizeFirstOrbitState(null), { seen: false, completed: false });
  assert.deepEqual(sanitizeFirstOrbitState({ seen: 1, completed: "yes", ignored: true }), { seen: true, completed: true });
});

test("training UI is accessible, immediately actionable, exitable, and replayable from Menu", () => {
  assert.match(page, /id="firstOrbitGuide"[^>]+aria-labelledby="firstOrbitGuideTitle"/);
  assert.match(page, /id="firstOrbitInstruction" aria-live="polite"/);
  assert.match(page, /id="skipFirstOrbit"/);
  assert.match(page, /id="replayFirstOrbit"/);
  assert.match(page, /LEARN TO PLAY/);
  assert.match(page, /Tap Earth, then tap Water[.]/);
  assert.match(page, /id="firstOrbitStep">1 of 1/);
  assert.match(page, /aria-valuemax="1"/);
  assert.match(simpleStyles, /[.]first-orbit-guide p\s*\{[^}]*font-size:\s*18px/);
});

test("training combinations remain local, deterministic, and reward-ineligible", () => {
  const trainingBranch = app.slice(app.indexOf("if (firstOrbitActive())", app.indexOf("async function combineNodes")), app.indexOf("} else {", app.indexOf("if (firstOrbitActive())", app.indexOf("async function combineNodes"))));
  const firstGame = createFirstOrbitGame({ id: "test-universe" });
  assert.match(trainingBranch, /resolveFirstOrbitCombination/);
  assert.doesNotMatch(trainingBranch, /fetchJson/);
  assert.equal(firstGame.mode, "training");
  assert.equal(firstGame.target, FIRST_ORBIT_TARGET);
  assert.deepEqual(firstGame.starters, FIRST_ORBIT_STARTERS);
  assert.equal(firstGame.timeLimit, null);
  assert.equal(firstGame.moveLimit, null);
  assert.equal(firstGame.scoreEligible, false);
  assert.equal(firstGame.rewardEligible, false);
  assert.equal(firstGame.leaderboardEligible, false);
  assert.deepEqual(firstGame.universe, { id: "test-universe" });
  assert.match(app, /state[.]mode === "training"/);
  assert.match(app, /profile[.]firstOrbit = \{ seen: true, completed: true \}/);
});
