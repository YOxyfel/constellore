import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const defaultProfile = await readFile(new URL("../public/default-profile.mjs", import.meta.url), "utf8");
const sessionResume = await readFile(new URL("../public/session-resume.mjs", import.meta.url), "utf8");

function betweenSource(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source range ${start} -> ${end}`);
  return source.slice(from, to);
}

function between(start, end) {
  return betweenSource(app, start, end);
}

test("hosted resume sends credentials only and rebuilds presentation from authoritative history", () => {
  const restore = between("async function restoreInterruptedRun", "function startWithGame");
  assert.ok(restore.includes("isStaticBeta"));
  assert.match(restore, /\{\s*runId:\s*snapshot[.]run[.]id,\s*runToken:\s*snapshot[.]run[.]token,\s*deferActivation:\s*pendingActivation\s*\}/);
  assert.match(restore, /\{\s*runId:\s*snapshot[.]run[.]id,\s*runToken:\s*snapshot[.]run[.]token,\s*snapshot,\s*deferActivation:\s*pendingActivation\s*\}/, "local practice may retain its validated visual snapshot path");
  assert.ok(restore.includes("shouldRestoreObjective("), "a pending restored run must remain paused on its objective");

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
  assert.ok(hydrate.includes("state.history = decorateRestoredHistory(progress.history"), "authoritative history must still drive restored presentation");
  assert.ok(hydrate.includes("state.newDiscoveries = state.history.reduce"));
  assert.match(hydrate, /snapshotMatchesHistory[\s\S]*restoredWorldHistoryAnchors\(matchingSnapshot[.]history\[index\]\)/);
  const worldAnchors = between("function restoredWorldHistoryAnchors", "function reconcileRestoredMastery");
  assert.match(worldAnchors, /anchorCoordinateSpace !== "world-v1"/);
  assert.match(worldAnchors, /Number[.]isFinite\(x\)[\s\S]*Number[.]isFinite\(y\)/);
  assert.match(worldAnchors, /clamp\(x, -1_000_000, 1_000_000\)[\s\S]*clamp\(y, -1_000_000, 1_000_000\)/);
});

test("client-only resume accepts only canonical lesson and sandbox reconstructions", () => {
  assert.match(app, /import \{[^}]*CLIENT_ONLY_RESUME_MODES[^}]*activeRunSnapshotIsValid[^}]*clientOnlyRestorePayload[^}]*createClientRunPersistence[^}]*\} from "[.]\/session-resume[.]mjs[?]v=/);
  assert.match(sessionResume, /export const CLIENT_ONLY_RESUME_MODES = new Set\(\["training", "second-orbit", "explore"\]\)/);

  const clientRestore = betweenSource(
    sessionResume,
    "function clientOnlyRestoreGame",
    "export function activeRunSnapshotIsValid"
  );
  assert.match(clientRestore, /mode === "training"[\s\S]*createFirstOrbitGame\(selectUniverse\(101\)\)/);
  assert.match(clientRestore, /mode === "second-orbit"[\s\S]*createSecondOrbitGame\(selectUniverse\(202\)\)/);
  assert.match(clientRestore, /mode === "explore"[\s\S]*exploreGame\(seed\)[\s\S]*selectUniverse\(game[.]seed\)/);
  assert.match(clientRestore, /!Number[.]isSafeInteger\(seed\) \|\| seed < 0 \|\| seed >= 1_000_000/);
  assert.match(clientRestore, /savedTarget !== String\(game[.]target \|\| ""\)[\s\S]*Number\(snapshot[?][.]game[?][.]seed\) !== Number\(game[.]seed\)/);
  assert.doesNotMatch(clientRestore, /structuredClone\(snapshot[.]game\)/, "a local snapshot must not supply executable game rules");

  assert.match(clientRestore, /run[?][.]clientOnly !== true[\s\S]*!CLIENT_ONLY_RESUME_MODES[.]has\(mode\)/);
  assert.match(clientRestore, /run[.]localOnly !== true[\s\S]*run[.]ranked !== false[\s\S]*run[.]scoreEligible !== false/);
  assert.match(clientRestore, /run[.]hasRuntimeRun !== hasRuntimeRun/);
  assert.match(clientRestore, /expectedIdPrefix = hasRuntimeRun \? "training-" : `client-\$\{mode\}-`/);
  assert.match(clientRestore, /expectedToken = hasRuntimeRun \? "local-training" : "client-only"/);
  assert.match(clientRestore, /progress[.]completed === true[\s\S]*progress[.]submitted === true[\s\S]*progress[.]scoringDisabled !== true/);

  const persistence = between("function activeRunPersistence", "function buildActiveRunSnapshot");
  assert.match(persistence, /createClientRunPersistence\(\{\s*game:\s*state[.]game,\s*mode:\s*state[.]mode,\s*startedAt:\s*state[.]startedAt\s*\}\)/);
  const reader = between("function readActiveRunSnapshot", "async function enterPreparedMission");
  assert.match(reader, /if \(!activeRunSnapshotIsValid\(snapshot\)\) \{[\s\S]*clearActiveRunSnapshot\(\)/);

  const restore = between("async function restoreInterruptedRun", "function missionModeLabel");
  assert.match(restore, /if \(snapshot[.]run[.]clientOnly === true\) \{[\s\S]*clientOnlyRestorePayload\(snapshot\)/);
  assert.match(restore, /if \(!payload\) \{\s*clearActiveRunSnapshot\(\);\s*return false/);
  assert.match(restore, /startWithGame\(payload[.]game, payload[.]run, \{[\s\S]*restored:\s*true[\s\S]*persistenceRun:\s*payload[.]persistenceRun/);
  assert.match(restore, /hydrateRestoredRun\(payload, snapshot\)[\s\S]*source:\s*"client"/);

  const snapshot = between("function buildActiveRunSnapshot", "function flushRunSave");
  assert.match(snapshot, /const persistenceRun = activeRunPersistence\(\)/);
  assert.match(snapshot, /clientOnly:\s*CLIENT_ONLY_RESUME_MODES[.]has\(state[.]mode\)/);
  assert.match(snapshot, /hasRuntimeRun:\s*Boolean\(state[.]run[?][.]id && state[.]run[?][.]token\)/);
});

test("client-only and unranked snapshots can never enter pending-score recovery", () => {
  const completed = between("function saveCompletedRunSnapshot", "function scheduleRunSave");
  assert.match(completed, /snapshot[.]run[.]clientOnly === true \|\| snapshot[.]run[.]ranked !== true/);
  assert.ok(
    completed.indexOf("snapshot.run.clientOnly === true")
      < completed.indexOf("rememberPendingScore(snapshot)"),
    "the eligibility guard must run before pending-score persistence"
  );

  const pending = between("function rememberPendingScore", "function markPendingScoreUploaded");
  assert.match(pending, /snapshot[?][.]run[?][.]clientOnly === true/);
  assert.match(pending, /snapshot[?][.]run[?][.]ranked !== true/);
  assert.ok(
    pending.indexOf("snapshot?.run?.ranked !== true")
      < pending.indexOf("savePendingScoreRecord("),
    "unranked local play must return before score credentials are written"
  );
});

test("completed-run progression receipts prevent reward replay across resume and cloud sync", () => {
  assert.match(defaultProfile, /version:\s*10,[\s\S]*?rewardedRunIds:\s*\[\]/);
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
  assert.match(recovery, /const sameAccount = Boolean\(profile[.]playerId && profile[.]playerId === result[.]player[.]id\)/,
    "preservation must follow the authenticated recovered identity, not the submitted ID alone");
  assert.match(recovery, /if \(sameAccount\) profile[.]playerToken = result[.]playerToken;\s*else resetProfileForAccount\(\{ playerId: result[.]player[.]id, playerToken: result[.]playerToken \}\);/,
    "recovering the current identity must rotate its token while only a different identity resets local progress");
  assert.equal((recovery.match(/resetProfileForAccount\(/g) || []).length, 1,
    "same-account recovery must not reach an additional unconditional profile reset");
  const cloudRestore = recovery.indexOf("await syncCloudProfile({ replaceRemote: !sameAccount })");
  const eventRefresh = recovery.indexOf("await refreshCosmicEventState()", cloudRestore);
  assert.ok(cloudRestore >= 0 && eventRefresh > cloudRestore,
    "recovery must merge cloud for the current identity or replace it for a different identity, then reapply server event truth");
  assert.ok(recovery.includes("if (config.cloudProfileEnabled === true && state.cloudDirty)"));
});

test("client mastery obeys the server's per-combination progression eligibility", () => {
  const mastery = between("function recordMasteryStep", "function founderCosmeticsOwned");
  assert.ok(mastery.includes('step.progressionEligible === false || state.scoringDisabled || state.assist !== "none"'));

  const combine = between("async function combineNodes", "function scheduleRecipeFeedbackExpiry");
  assert.ok(combine.includes("progressionEligible: result.progressionEligible === true"));
  assert.ok(combine.includes("eventEligible: result.eventEligible === true"));
  assert.ok(combine.includes('typeof result.newDiscovery === "boolean" ? result.newDiscovery'));
});
