import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

function sourceBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Missing source marker: ${start}`);
  assert.notEqual(to, -1, `Missing source marker: ${end}`);
  return app.slice(from, to);
}

test("the main Play path enters the gate instead of opening a pre-level preview", () => {
  const beginMode = sourceBetween("async function beginMode", "async function beginCustomTarget");
  const prepared = sourceBetween("async function enterPreparedMission", "function decorateRestoredHistory");

  assert.match(beginMode, /enterPreparedMission\(\(\)\s*=>/);
  assert.doesNotMatch(beginMode, /requestMissionPreview|openMissionBriefing/);
  assert.match(prepared, /enterPreparedRun\(\{/);
  assert.match(prepared, /commit:[\s\S]*startWithGameNow\([\s\S]*deferTimer:\s*true/);
  assert.match(prepared, /ready:[\s\S]*openMissionBriefing/);
});

test("the first lesson starts directly while other missions retain their objective gate", () => {
  const primary = sourceBetween("async function beginPrimaryOrbit", "function openModePicker");
  const start = sourceBetween("function startWithGame(game", "function startWithGameNow");

  assert.match(primary, /action === "training"[\s\S]*startFirstOrbit\(\{\s*enterThroughGate:\s*false\s*\}\)/);
  assert.match(start, /cosmicGate[.]enterBoard\(/);
  assert.match(start, /startWithGameNow\([\s\S]*deferTimer:\s*true/);
  assert.match(start, /const presentBriefing = \(\) =>[\s\S]*openMissionBriefing/);
  assert.match(start, /afterOpen:\s*presentBriefing/);
  assert.match(start, /if \(!entered && committed\) presentBriefing\(\)/);
});

test("the required first game bypasses both launch gates and restores actionable focus", () => {
  const boot = sourceBetween("async function boot", "boot().catch");
  const firstOrbit = sourceBetween("async function startFirstOrbit", "async function startSecondOrbit");

  assert.match(boot, /firstGameRequired\(profile\)[\s\S]*startFirstOrbit\(\{\s*enterThroughGate:\s*false\s*\}\)/);
  assert.match(firstOrbit, /if \(!enterThroughGate\)[\s\S]*[.]inventory-word[.]tutorial-hot[\s\S]*focus\(\{\s*preventScroll:\s*true\s*\}\)/);
});

test("the loaded objective activates the run before closing and starting its clock", () => {
  const confirm = sourceBetween("async function confirmMissionBriefing", "async function enterPreparedMission");
  const activateAt = confirm.indexOf("activateTimedRun(state.run)");
  const closeAt = confirm.indexOf('missionBriefingDialog.close("start")');
  const timerAt = confirm.indexOf("startTimer()");

  assert.ok(activateAt >= 0 && closeAt > activateAt && timerAt > closeAt);
  assert.match(confirm, /activatedRunClock\(state[.]run,\s*state[.]game\)/);
  assert.match(confirm, /competitiveGhostEligible\(\)[\s\S]*startRivalGhost/);
  assert.match(confirm, /track\("run_started"/);
});

test("retries and exact practice replays use deferred cinematic entry", () => {
  const retry = sourceBetween("async function retryGame", "async function replayFinishedChallenge");
  const replay = sourceBetween("async function replayFinishedChallenge", "function startTimer");

  assert.match(retry, /await beginMode\(mode,\s*options\)/);
  assert.doesNotMatch(retry, /skipBriefing/);
  assert.match(replay, /\/api\/run\/replay/);
  assert.match(replay, /deferActivation:\s*true/);
  assert.match(replay, /state[.]startingRun = true/);
  assert.match(replay, /const sourceGeneration = state[.]orbitGeneration/);
  assert.match(replay, /isReplayResponseCurrent\(\{/);
  assert.match(replay, /currentGeneration:\s*state[.]orbitGeneration/);
  assert.match(replay, /currentRunId:\s*state[.]run[?][.]id/);
  assert.match(replay, /submitRunForfeit\(payload[.]run,\s*payload[.]game\)/);
  assert.match(replay, /startWithGame\(payload[.]game,\s*payload[.]run,\s*\{\s*enterThroughGate:\s*true\s*\}\)/);
});

test("Star Break entry is claimed only when it can safely own the gate", () => {
  const enter = sourceBetween("async function enterCosmicInterlude", "async function retryGame");
  const safetyAt = enter.indexOf("state.startingRun || pendingScoreBlocksExit()");
  const claimAt = enter.indexOf("event.preventDefault()");
  const closeAt = enter.indexOf("els.resultDialog.close()");
  const startAt = enter.indexOf("afterOpen: begin");

  assert.ok(safetyAt >= 0 && claimAt > safetyAt, "a rejected entry must fail open instead of stranding the runtime");
  assert.match(enter, /cosmicGate[.]enterBoard/);
  assert.ok(closeAt > claimAt && startAt > closeAt, "the result closes behind the doors before the activity opens");
  assert.match(app, /document[.]addEventListener\("constellore:interlude-enter",\s*enterCosmicInterlude\)/);
});

test("interrupted pending runs restore the same objective without starting the clock", () => {
  const restore = sourceBetween("async function restoreInterruptedRun", "function missionModeLabel");
  const start = sourceBetween("function startWithGame(game", "function startWithGameNow");

  assert.match(restore, /const pendingActivation = snapshot[.]run[.]activationPending === true/);
  assert.match(restore, /deferActivation:\s*pendingActivation/);
  assert.doesNotMatch(restore, /activateTimedRun/);
  assert.match(restore, /restoreObjective = shouldRestoreObjective\(snapshot,\s*payload[.]run\)/);
  assert.match(restore, /deferTimer:\s*restoreObjective/);
  assert.match(restore, /if\s*\(restoreObjective\)[\s\S]*openMissionBriefing/);
  assert.match(start, /deferTimer = false/);
  assert.match(start, /persistenceRun = null/);
  assert.match(start, /startWithGameNow\(game,\s*run,\s*\{\s*restored,\s*context,\s*deferTimer,\s*persistenceRun\s*\}\)/);
  assert.match(start, /startWithGameNow\(game,\s*run,\s*\{[\s\S]*deferTimer:\s*true,[\s\S]*persistenceRun[\s\S]*\}\)/);
});

test("terminal activation failures leave the stale board through the existing one-action surface", () => {
  const confirm = sourceBetween("async function confirmMissionBriefing", "async function beginMode");
  assert.match(confirm, /isPermanentActivationFailure\(error\)/);
  assert.match(confirm, /clearActiveRunSnapshot\(\)/);
  assert.match(confirm, /returnHome\(\{\s*skipForfeit:\s*true\s*\}\)/);
  assert.match(confirm, /Choose Play to start a fresh one/);
});

test("native Play and Start buttons use click activation for mouse, touch, and keyboard", () => {
  assert.match(page, /<button\b(?=[^>]*id="primaryOrbitButton")(?=[^>]*type="button")[^>]*>/);
  assert.match(page, /<button\b(?=[^>]*id="beginMission")(?=[^>]*type="button")[^>]*>/);
  assert.match(app, /primaryOrbitButton["']\)[.]addEventListener\("click", beginPrimaryOrbit\)/);
  assert.match(app, /beginMission["']\)[.]addEventListener\("click", confirmMissionBriefing\)/);
});
