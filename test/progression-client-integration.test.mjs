import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app, page, simpleUi] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8")
]);

function sourceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source range ${start} -> ${end}`);
  return source.slice(from, to);
}

test("the client sends and records the complete adaptive v2 cadence", () => {
  const request = sourceBetween(app, "function adaptiveRequestFor", "function recordAdaptiveOutcome");
  for (const field of [
    "adaptiveVersion: adaptive.version",
    "adaptiveCompletedChallenges: adaptive.completedChallenges",
    "adaptiveMajorChallengePending: adaptive.majorChallengePending",
    "adaptiveMajorChallengeBaseLevel: adaptive.majorChallengeBaseLevel"
  ]) {
    assert.ok(request.includes(field), `missing adaptive request field: ${field}`);
  }

  const outcome = sourceBetween(app, "function recordAdaptiveOutcome", "function loadProfile");
  assert.ok(outcome.includes('flawless: outcome === "completed" && flawless === true'));
  assert.ok(outcome.includes("surge: Boolean(state.game.adaptiveSurge || state.game.surge)"));
  assert.ok(outcome.includes("surgeBaseLevel: state.game.adaptiveSurgeBaseLevel"));
  assert.ok(outcome.includes("baseLevel: state.game.adaptiveLevel"));
});

test("Surge protection is explained before play and after a missed Surge", () => {
  const briefing = sourceBetween(app, "function openMissionBriefing", "function cancelMissionBriefing");
  assert.match(briefing, /Surge: one much harder game/);
  assert.match(briefing, /your normal level stays safe/i);
  assert.match(briefing, /perfect 200 Run IQ win keeps the harder level/);
  assert.ok(briefing.includes('classList.toggle("is-surge"'));
  assert.match(app, /surgeWasActive[\s\S]*?"Back to normal"/);
  assert.match(simpleUi, /\.mission-adaptive-note\.is-surge/);
});

test("only an unassisted, errorless 200-IQ Surge can become the new base", () => {
  const result = sourceBetween(app, "function finishGame", "async function submitRankedScore");
  for (const condition of [
    "won",
    "!assisted",
    "!partialAssist",
    'state.assist === "none"',
    "state.runIq.value === 200",
    "state.runIq.misses === 0"
  ]) {
    assert.ok(result.includes(condition), `missing flawless Surge condition: ${condition}`);
  }
  assert.ok(result.includes("{ flawless: flawlessAdaptiveCompletion }"));
  assert.match(result, /classList[.]toggle\(\s*"is-surge-perfect"/);
  assert.match(simpleUi, /\.result-adaptive-note\.is-surge-perfect/);
});

test("live Run IQ uses authored route progress and begins visibly at zero", () => {
  const combine = sourceBetween(app, "async function combineNodes", "function resetExpectedPairFeedback");
  const before = combine.indexOf("const routeProgressBefore = state.routeProgress");
  const accept = combine.indexOf("acceptRouteProgress(result.routeProgress)");
  const context = combine.indexOf("runIqRouteContext(routeProgressBefore, state.routeProgress");
  const reward = combine.indexOf('changeRunIq("success"');
  assert.ok(before >= 0 && before < accept && accept < context && context < reward);
  assert.ok(combine.includes('changeRunIq("miss", a.item.word, b.item.word)'));
  assert.ok(combine.includes("scheduleRunSave()"), "a rejected pair must persist its IQ penalty");
  assert.ok(combine.includes("runIqSuccessfulPairKey(a.item.word, b.item.word, result.word)"), "Cosmic Twist and canonical outcomes need distinct score keys");
  assert.ok(combine.includes("historyStep.runIqNewToRun = newToRun"), "restored runs must preserve run-local discoveries");
  assert.match(page, /id="runIqHud"[^>]*aria-valuenow="0"/);
  assert.match(page, /id="runIqValue">0</);
  assert.match(page, /Run IQ starts at 0/);
});
