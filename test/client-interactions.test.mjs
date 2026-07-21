import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("dragged board words update without a trailing transform transition", () => {
  const draggingRule = styles.match(/[.]board-word[.]dragging\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(draggingRule, /transition:/);
  assert.doesNotMatch(draggingRule.match(/transition:\s*([^;]+)/)?.[1] || "", /transform/);
  assert.match(draggingRule, /will-change:\s*transform/);
  assert.match(app, /element[.]classList[.]remove\("appear"\)/);
  assert.match(app, /updatePosition\(upEvent, false\)/, "pointer-up must flush the final position before collision detection");
});

test("tray drops share an immediate-combine path on mouse and touch", () => {
  assert.match(app, /function resolveDropCandidate\(/);
  assert.match(app, /pickMagneticTarget\(candidates, anchor/);
  assert.match(app, /function dropTrayItem\(item, point, pointerType/);
  assert.match(app, /void combineTrayWithTarget\(item, resolution[.]selected\)/);
  assert.match(app, /function startTrayPointerDrag\(/);
  assert.match(app, /button[.]draggable = false/);
  assert.match(app, /dropTrayItem\(item, lastPoint, pointerType\)/);
  assert.match(app, /moveEvent[.]pointerId !== pointerId/);
  assert.match(styles, /touch-action:\s*pan-x/);
  assert.match(styles, /[.]tray-drag-ghost\s*\{/);
});

test("mobile training reserves playable board space in portrait and short landscape", () => {
  assert.match(app, /const safeTop = guideRect/);
  assert.match(app, /top: safeTop/);
  assert.match(app, /els[.]board[.]scrollTop = 0/);
  assert.match(styles, /[.]cosmos-board\s*\{[^}]*overflow:\s*clip/);
  assert.match(styles, /@media \(max-width: 700px\) and \(max-height: 500px\) and \(min-width: 520px\)/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0,1fr\) minmax\(176px,28vw\)/);
  assert.match(styles, /[.]nav-icon\s*\{\s*width:\s*44px;\s*height:\s*44px/);
});

test("tap chains are discoverable, cancellable, and work from the inventory", () => {
  assert.match(page, /id="tapChainStatus"[^>]+aria-live="polite"/);
  assert.match(page, /id="cancelTapChain"/);
  assert.match(app, /async function selectNodeForTap\(/);
  assert.match(app, /async function activateTrayItem\(item\)/);
  assert.match(app, /const placed = placeFromTray\(item\)[\s\S]*state[.]selectedNodeId = placed[.]id/);
  assert.match(app, /combineTrayWithTarget\(item, selected\)/);
  assert.match(app, /cancelTapChain\(\{ announce: true \}\)/);
});

test("board clearing is undoable and orbit tidying is score-neutral", () => {
  assert.match(page, /id="tidyBoard"/);
  assert.match(page, /id="undoBoardClear"/);
  assert.match(app, /clearUndoTimer = setTimeout\(dismissClearUndo, 6000\)/);
  assert.match(app, /function undoBoardClear\(/);
  assert.match(app, /const packed = packOrbit\(/);
  assert.match(app, /Orbit tidied · score unchanged/);
});

test("inventory search and interrupted-run restore are wired into lifecycle persistence", () => {
  assert.match(page, /id="inventorySearch"[^>]+type="search"/);
  assert.match(app, /orderInventory\(state[.]words/);
  assert.match(app, /function buildActiveRunSnapshot\(/);
  assert.match(app, /fetchJson\("\/api\/run\/resume"/);
  assert.match(app, /window[.]addEventListener\("pagehide", flushRunSave\)/);
  assert.match(app, /clearActiveRunSnapshot\(\)/);
});

test("completed ranked runs remain resumable until the verified upload succeeds", () => {
  assert.match(app, /function saveCompletedRunSnapshot\(\)/);
  assert.match(app, /rememberPendingScore\(snapshot\)/);
  assert.match(app, /from "[.]\/pending-scores[.]mjs/);
  assert.match(app, /function retryPendingScoreUploads\(\)/);
  assert.match(app, /handleOnline\(\)[\s\S]*retryPendingScoreUploads\(\)[.]then\(announcePendingScoreRecovery\)/);
  assert.match(app, /account_recovered[\s\S]*retryPendingScoreUploads|retryPendingScoreUploads\(\)[\s\S]*account_recovered/);
  assert.match(app, /const pendingRankedSubmit = Boolean\(won && !assisted && !skipSubmit && state[.]run[?][.]ranked\)/);
  assert.match(app, /if \(pendingRankedSubmit\) \{[\s\S]*saveCompletedRunSnapshot\(\)/);
  assert.match(app, /if \(state[.]scoreSubmission[.]pendingSaved\)/);
  assert.match(app, /function pendingScoreBlocksExit\(\)[\s\S]*!state[.]scoreSubmission[.]pendingSaved/);
  assert.match(app, /returnHome\(\)[\s\S]*pendingScoreBlocksExit\(\)/);
  assert.match(app, /This browser could not save the result[.]/);
  assert.match(app, /Retry score upload/);
  const submitSuccess = app.indexOf('if (!result.ranked) throw new Error');
  const clearAfterSuccess = app.indexOf('markPendingScoreUploaded(submission.playerId, submission.runId);', submitSuccess);
  assert.ok(submitSuccess >= 0 && clearAfterSuccess > submitSuccess, "the pending score is cleared only after a verified response");
  assert.match(app, /runId: submission[.]runId, runToken: submission[.]runToken/);
});

test("Sense fails closed on an ambiguous network response", () => {
  const senseStart = app.indexOf("async function useConstellationSense()");
  const localCommit = app.indexOf("profile.senseWallet = preview.wallet", senseStart);
  const request = app.indexOf('await fetchJson("/api/run/sense"', senseStart);
  assert.ok(localCommit > senseStart && localCommit < request, "the charge and fair-play forfeit commit before the request");
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /confirmedBeforeForfeit/);
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /this orbit remains assisted and the Sense charge stays spent/);
});

test("cloud sync preserves only genuinely pending local fields", () => {
  assert.match(app, /cloudPendingFields/);
  assert.match(app, /saveProfile\(\{ cloud: founderActivated, fields: \["progression"\] \}\)/);
  assert.match(app, /preferLocalSettings: localSettingsPending/);
  assert.match(app, /preferLocalProgression: localProgressionPending/);
  assert.match(app, /state[.]cloudRevision === revision/);
  assert.match(app, /scheduleCloudProfileSync\(\{ changed: false, delay: 250 \}\)/);
});

test("recipe feedback appears only for server-approved recipes and never in local-only Pages practice", () => {
  assert.match(app, /feedbackEligible: result[.]feedbackEligible === true/);
  assert.match(app, /historyStep[.]feedbackEligible\) offerRecipeFeedback/);
  assert.match(app, /if \(isStaticBeta \|\| !step[?][.]feedbackEligible/);
  assert.match(page, /id="recipeFeedbackAnnouncement"[^>]+aria-live="polite"/);
  assert.match(page, /id="dismissRecipeFeedback"/);
  assert.match(app, /contains\(document[.]activeElement\).*scheduleRecipeFeedbackExpiry/);
});

test("new cloud and onboarding status controls are announced and touch accessible", () => {
  assert.match(page, /id="cloudSyncStatus"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(styles, /[.]first-orbit-modal [.]modal-close\s*\{\s*width:\s*44px;\s*height:\s*44px/);
});

test("mode selection opens an accessible mission briefing before creating a run", () => {
  assert.match(page, /id="missionBriefingDialog"[^>]+aria-labelledby="missionBriefingTitle"/);
  for (const id of [
    "missionBriefingTarget", "missionBriefingRule", "missionBriefingReward", "missionBriefingScore",
    "missionBriefingLaw", "missionBriefingStatus", "beginMission", "cancelMission"
  ]) assert.match(page, new RegExp(`id="${id}"`));
  assert.match(app, /pendingMission:\s*null/);
  assert.match(app, /function openMissionBriefing\(/);
  assert.match(app, /function presentMissionBriefing\(\)[\s\S]*state[.]recoveryKit[?][.]code[\s\S]*showModal\(\)/);
  assert.match(app, /async function confirmMissionBriefing\(/);
  assert.match(app, /fetchJson\("\/api\/run\/preview"/);
  assert.match(app, /request: \{ [.]\.\.request, previewToken: preview[.]previewToken \}/);
  assert.match(app, /error[.]code === "mission_stale"[\s\S]*refreshMissionPreview\(pending\)/);
  assert.match(app, /confirmMissionBriefing\(\)[\s\S]*createRun\(pending[.]request\)[\s\S]*startWithGame\(started[.]game, started[.]run\)/);
  assert.match(app, /beginCustomTarget[\s\S]*requestMissionPreview\(request\)[\s\S]*openMissionBriefing\(preview[.]game, preview[.]request/);
  assert.match(app, /skipBriefing:\s*true/);
  assert.match(app, /acknowledgeRecoveryKit\(\)[\s\S]*state[.]pendingMission[\s\S]*presentMissionBriefing/);
  assert.match(page, /class="training-mission-line"[\s\S]*<strong>Wall<\/strong>[\s\S]*3 guided fusions/);
  assert.match(styles, /[.]mission-briefing-modal\[open\]\s*\{[^}]*display:\s*flex[^}]*overflow:\s*hidden/);
  assert.match(styles, /[.]mission-scroll\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(styles, /[.]mission-target-lockup h2\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(styles, /[.]mission-status:empty\s*\{[^}]*display:\s*none/);
  assert.match(app, /missionBriefingDialog[.]scrollTop = 0/);
});

test("Rival Ghost requests are cancelled and stale responses cannot start races", () => {
  assert.match(app, /requestController = new AbortController\(\)/);
  assert.match(app, /state[.]ghost[.]requestController[?][.]abort\(\)/);
  assert.match(app, /requestGeneration !== state[.]ghost[.]requestGeneration/);
  assert.match(app, /!profile[.]rivalGhostEnabled/);
});

test("all haptics pass through the feedback preference policy", () => {
  assert.equal((app.match(/navigator[.]vibrate/g) || []).length, 2, "one capability check and one centralized vibration call should remain");
  assert.doesNotMatch(app, /navigator[.]vibrate\(\[10, 18, 10\]\)/);
});

test("Ctrl hover fusion is wired to board words and lifecycle cleanup", () => {
  assert.match(app, /createCtrlHoverController/);
  assert.match(app, /addEventListener\("pointerenter", \(event\) => handleCtrlHoverEnter/);
  assert.match(app, /window[.]addEventListener\("keydown", activateCtrlHover\)/);
  assert.match(app, /window[.]addEventListener\("keyup", releaseCtrlHover\)/);
  assert.match(app, /window[.]addEventListener\("blur", releaseCtrlHover\)/);
  assert.match(app, /return \{ node: resultNode, completed: won \}/);
  assert.match(app, /ctrlHover[.]reset\(\{ abandonPending: true \}\)/);
  assert.match(styles, /[.]board-word[.]ctrl-hover-source\s*\{/);
  assert.match(styles, /[.]board-word[.]ctrl-hover-queued\s*\{/);
  assert.match(styles, /[.]board-word[.]combining\s*\{/);
});
