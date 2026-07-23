import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

function between(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source range ${start} -> ${end}`);
  return app.slice(from, to);
}

test("hosted resume sends credentials only and rebuilds presentation from authoritative history", () => {
  const restore = between("async function restoreInterruptedRun", "function startWithGame");
  assert.ok(restore.includes("isStaticBeta"));
  assert.ok(restore.includes("{ runId: snapshot.run.id, runToken: snapshot.run.token }"));
  assert.ok(restore.includes("{ runId: snapshot.run.id, runToken: snapshot.run.token, snapshot }"), "local practice may retain its validated visual snapshot path");

  const decorate = between("function decorateRestoredHistory", "function reconcileRestoredMastery");
  for (const marker of [
    "explainSuccessfulRecipe({",
    "annotateCosmicEventResult({ event",
    "step.newDiscovery === true",
    "step.eventEligible === true",
    "insight: insight?.text || \"\"",
    "contextual: Boolean(journeyMatch || eventAnnotation.context?.collectionMatch)"
  ]) assert.ok(decorate.includes(marker), `missing restored-history safeguard: ${marker}`);
  assert.ok(!decorate.includes("...step"), "untrusted presentation fields must not be spread back into restored history");

  const hydrate = between("function hydrateRestoredRun", "async function restoreInterruptedRun");
  assert.ok(hydrate.includes("state.history = decorateRestoredHistory(progress.history)"));
  assert.ok(hydrate.includes("state.newDiscoveries = state.history.reduce"));
});

test("completed-run progression receipts prevent reward replay across resume and cloud sync", () => {
  assert.match(app, /version:\s*7,[\s\S]*?rewardedRunIds:\s*\[\]/);
  const sanitizer = between("function sanitizeRewardedRunIds", "function sanitizeEventProgress");
  assert.ok(sanitizer.includes("ids.length >= 256"));
  assert.ok(sanitizer.includes("seen.has(id)"));

  const cloud = between("function cloudProfileSnapshot", "function resetProfileForAccount");
  assert.ok(cloud.includes("rewardedRunIds: sanitizeRewardedRunIds(profile.rewardedRunIds)"));
  const merge = between("function mergeCloudProfile", "function setCloudStatus");
  assert.ok(merge.includes("...localRewardedRunIds, ...remoteRewardedRunIds"));

  const finish = between("function finishGame", "async function submitRankedScore");
  assert.ok(finish.includes("progressionAlreadyGranted"));
  assert.ok(finish.includes("won && !assisted && !progressionAlreadyGranted"));
  assert.ok(finish.includes("profile.rewardedRunIds = sanitizeRewardedRunIds([rewardRunId, ...profile.rewardedRunIds])"));
  assert.ok(finish.indexOf("profile.rewardedRunIds =") < finish.indexOf('saveProfile({ fields: ["progression"'), "receipt and progression must share one profile write");
  assert.ok(finish.includes("Progression already granted for this completed orbit."));
});

test("event claims survive response loss and account recovery preserves server event truth", () => {
  const claim = between("async function claimCurrentCosmicEventReward", "async function refreshCosmicEventState");
  assert.ok(claim.includes("scheduleCloudProfileSync({ changed: false, delay: 250 })"), "a lost claim response must still trigger a durable cloud balance refresh");

  const merge = between("function mergeCloudProfile", "function setCloudStatus");
  assert.ok(merge.includes("!isStaticBeta && state.cosmicEvent"));
  assert.ok(merge.includes("sanitizeEventProgressForEvent(localEvent, state.cosmicEvent)"), "lagging cloud event data cannot replace endpoint truth");

  const recovery = between("async function recoverAccount", "async function loadConfig");
  const cloudRestore = recovery.indexOf("await syncCloudProfile({ replaceRemote: true })");
  const eventRefresh = recovery.indexOf("await refreshCosmicEventState()", cloudRestore);
  assert.ok(cloudRestore >= 0 && eventRefresh > cloudRestore, "recovery must restore cloud first, then reapply server event truth");
  assert.ok(recovery.includes("if (state.cloudDirty) scheduleCloudProfileSync"));
});

test("client mastery obeys the server's per-combination progression eligibility", () => {
  const mastery = between("function recordMasteryStep", "const cosmeticClassNames");
  assert.ok(mastery.includes('step.progressionEligible === false || state.scoringDisabled || state.assist !== "none"'));

  const combine = between("async function combineNodes", "function scheduleRecipeFeedbackExpiry");
  assert.ok(combine.includes("progressionEligible: result.progressionEligible === true"));
  assert.ok(combine.includes("eventEligible: result.eventEligible === true"));
  assert.ok(combine.includes('typeof result.newDiscovery === "boolean" ? result.newDiscovery'));
});
