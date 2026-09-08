import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createFirstOrbitGame } from "../public/first-orbit.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const homeMenuView = await readFile(new URL("../public/home-menu-view.mjs", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

function functionSource(name, nextName) {
  const start = app.indexOf(`${name}(`);
  const end = app.indexOf(`\n${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `${name} must remain inspectable`);
  return app.slice(start, end);
}

test("Bronze and Silver keep the duplicate game chooser hidden while pressure modes stay guarded", () => {
  const begin = functionSource("async function beginMode", "async function beginCustomTarget");
  assert.match(homeMenuView, /const pressureReady = routeRank[.]rank[.]number > 2/);
  assert.match(homeMenuView, /primaryOrbitSecondary[^]+!menu[.]choicesReady/);
  assert.match(homeMenuView, /\["quick", "moves"\][.]includes\(card[.]dataset[.]homeMode\) && !pressureReady/);
  assert.match(homeMenuView, /modeSectionSummary/);
  assert.match(begin, /\["quick", "moves"\][.]includes\(mode\) && currentRouteRank\(\)[.]rank[.]number < 3/);
  assert.match(begin, /unlock at Gold/);
  assert.match(page, /id="modeSectionTitle">Choose a game<\/h2>[\s\S]*id="modeSectionSummary">Relaxed play<\/p>/);
});

test("every personal non-win queues a fresh target and exact replay stays explicit", () => {
  const request = functionSource("function adaptiveRequestFor", "function recordAdaptiveOutcome");
  const forfeit = functionSource("async function submitRunForfeit", "function returnHome");
  const retry = functionSource("async function retryGame", "async function replayFinishedChallenge");
  const replay = functionSource("async function replayFinishedChallenge", "function startTimer");
  const finish = functionSource("function finishGame", "async function submitRankedScore");
  assert.match(request, /avoidTarget:[\s\S]*options[.]avoidTarget \|\| state[.]recoveryTarget/);
  assert.match(forfeit, /adaptiveRunEligible\(game\)[\s\S]*state[.]recoveryTarget = String\(game[.]target/);
  assert.match(retry, /avoidTarget:\s*state[.]recoveryTarget/);
  assert.doesNotMatch(retry, /adaptiveTarget:\s*state[.]game[.]target/);
  assert.match(finish, /const easierNext = adaptiveSeries && \(!won \|\| revealed\)/);
  assert.match(finish, /Try a fresh target/);
  assert.match(replay, /"\/api\/run\/replay"/);
  assert.doesNotMatch(replay, /avoidTarget/);
});

test("a replacement waits for the hosted forfeit receipt before generation", () => {
  const begin = functionSource("async function beginMode", "async function beginCustomTarget");
  const forfeit = functionSource("async function submitRunForfeit", "function returnHome");
  const waitAt = begin.indexOf("await state.forfeitPromise");
  const requestAt = begin.indexOf("await enterPreparedMission");
  assert.ok(waitAt >= 0 && requestAt > waitAt);
  assert.match(forfeit, /function queueRunForfeit[\s\S]*state[.]forfeitPromise = submitRunForfeit/);
  assert.match(app, /!won && !revealed && !isStaticBeta[\s\S]*queueRunForfeit\(state[.]run, state[.]game/);
});

test("the first result celebrates a single untimed Mud discovery", () => {
  const firstGame = createFirstOrbitGame({ id: "test-universe" });
  assert.equal(firstGame.modeName, "First Game");
  assert.equal(firstGame.target, "Mud");
  assert.equal(firstGame.timeLimit, null);
  assert.equal(firstGame.moveLimit, null);
  assert.match(app, /FIRST DISCOVERY · COMPLETE/);
  assert.match(app, /Your first discovery: Mud!/);
  assert.match(app, /One combination ·/);
  assert.match(app, /firstEverCompletion[\s\S]*celebration:\s*firstEverCompletion[\s\S]*kind:\s*"first-orbit"/);
  assert.match(app, /firstTraining[\s\S]*"Next game"/);
});
