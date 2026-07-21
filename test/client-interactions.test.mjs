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

test("Star Compass fails closed on an ambiguous network response", () => {
  const senseStart = app.indexOf("async function useConstellationSense()");
  const localCommit = app.indexOf("profile.senseWallet = preview.wallet", senseStart);
  const request = app.indexOf('await fetchJson("/api/run/sense"', senseStart);
  assert.ok(localCommit > senseStart && localCommit < request, "the charge and fair-play forfeit commit before the request");
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /confirmedBeforeForfeit/);
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /this orbit remains assisted and the Compass charge stays spent/);
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /state[.]orbitGeneration !== orbitGeneration/);
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /const refund = grantSenseCharges\(profile[.]senseWallet, 1\)/);
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /if \(!els[.]senseDialog[.]open\) showToast/);
  assert.match(app, /[$]\("#buySense"\)[.]disabled = state[.]powerups[.]busy/);
});

test("Cosmic Powerups clearly separate score-safe Tips from assisted tools", () => {
  const dialog = page.match(/<dialog\b(?=[^>]*\bid="senseDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
  assert.match(dialog, /id="powerupsIntro"/);
  for (const id of ["useQuickTip", "quickTipMessage", "useWordGift", "wordGiftMessage", "useSense", "senseMessage"]) {
    assert.match(dialog, new RegExp(`id="${id}"`));
  }
  assert.match(dialog, /QUICK TIP[\s\S]*SCORE SAFE/);
  assert.match(dialog, /WORD GIFT[\s\S]*STUDY · 0 SCORE/);
  assert.match(dialog, /STAR COMPASS[\s\S]*STUDY · 0 SCORE/);
  assert.equal((dialog.match(/<h3>/g) || []).length, 3, "each powerup is a navigable dialog heading");
  assert.match(dialog, /remove score, rewards, streak credit, and leaderboard eligibility/);
  assert.match(app, /function useQuickTip\([\s\S]*selectQuickTip\(\{[\s\S]*boardWords: state[.]nodes[.]length/);
  assert.match(app, /tipsUsed: clamp\(Number\(state[.]powerups[.]tipsUsed\)/, "Quick Tip use survives interrupted-run restore");
  assert.match(styles, /[.]powerup-action, [.]powerup-buy\s*\{[^}]*min-height:\s*48px/);
  assert.match(styles, /[.]powerup-message\s*\{[^}]*font-size:\s*15px/);
  assert.match(styles, /[.]powerups-modal\s*\{[^}]*height:\s*100dvh/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*[.]powerup-grid\s*\{\s*grid-template-columns:\s*1fr/);
});

test("Word Gift is one-use, server-selected, durable, and fails closed before its request", () => {
  const giftStart = app.indexOf("async function useWordGift()");
  const giftEnd = app.indexOf("async function useConstellationSense()", giftStart);
  const giftSource = app.slice(giftStart, giftEnd);
  const localForfeit = giftSource.indexOf("state.scoringDisabled = true");
  const request = giftSource.indexOf('fetchJson("/api/run/gift"');
  assert.ok(localForfeit >= 0 && localForfeit < request, "Study status commits before the Gift request");
  assert.match(giftSource, /body: JSON[.]stringify\(\{ runId, runToken: priorRun[.]token \}\)/);
  assert.match(giftSource, /state[.]powerups[.]giftUsed = true/);
  assert.match(giftSource, /retry Word Gift to recover the same bridge/);
  assert.match(giftSource, /if \(!els[.]senseDialog[.]open\) showToast/);
  assert.match(giftSource, /error[.]code === "gift_unavailable"[)] state[.]powerups[.]giftUnavailable = true/);
  assert.match(app, /giftUsed: Boolean\(state[.]powerups[.]giftUsed\)/);
  assert.match(app, /state[.]powerups[.]giftUsed = Boolean\(progress[.]giftUsed/);
  assert.match(app, /state[.]assist === "gift"/);
  assert.match(app, /item[.]source === "gift" \? "GIFT"/);
  assert.match(app, /Word Gift bridge/);
  assert.match(styles, /[.]board-word[.]gift\s*\{/);
  assert.match(styles, /[.]inventory-word[.]gift [.]source-tag\s*\{/);
});

test("Study assistance remains visibly and accessibly marked for the whole orbit", () => {
  assert.match(app, /function updateStudyHud\(\)/);
  assert.match(app, /els[.]lawPill[.]textContent = "◇ STUDY · 0 SCORE"/);
  assert.match(app, /updateHud\(\)[\s\S]*updateStudyHud\(\)/);
  assert.match(app, /\["reveal", "sense", "gift"\][.]includes\(state[.]assist\)/);
  assert.match(styles, /[.]game-target #lawPill[.]study-status:not\(\[hidden\]\)\s*\{[^}]*display:\s*block[^}]*font-size:\s*15px/);
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

test("Dev Logs exposes three accessible, readable, responsive update entries", () => {
  const button = page.match(/<button\b(?=[^>]*\bid="updatesButton")[^>]*>/i)?.[0] || "";
  assert.ok(button, "the updates trigger is present");
  assert.match(button, /\baria-haspopup="dialog"/i);
  assert.match(button, /\baria-controls="updatesDialog"/i);

  const dialog = page.match(/<dialog\b(?=[^>]*\bid="updatesDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
  assert.ok(dialog, "the updates dialog is present");
  assert.match(dialog.match(/<dialog\b[^>]*>/i)?.[0] || "", /\baria-labelledby="updatesTitle"/i);
  assert.match(dialog, /id="updatesTitle"/i);
  assert.match(dialog, /data-close="updatesDialog"/i);
  assert.equal((dialog.match(/\bdata-update-entry(?:=|\s|>)/gi) || []).length, 3, "the log has exactly three updates");
  for (const label of ["Release", "Ctrl", "Shift"]) assert.match(dialog, new RegExp(`\\b${label}\\b`, "i"));

  assert.match(app, /[$]\(["']#updatesButton["']\)[.]addEventListener\(["']click["']/);
  assert.match(app, /(?:[$]\(["']#updatesDialog["']\)|els[.]updatesDialog)[\s\S]{0,160}?[.]showModal\(\)/);

  const metadataRule = styles.match(/[.]updates-meta\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(metadataRule, /font-size:\s*15px/, "update metadata stays at the 15px readability floor");
  const closeRule = styles.match(/[.]updates-modal\s+[.]modal-close\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(closeRule, /width:\s*44px/);
  assert.match(closeRule, /height:\s*44px/);
  assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*[.]updates-(?:button|modal|trigger)/, "updates UI has a mobile-specific layout rule");
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
  assert.match(app, /addEventListener\("pointerenter", \(event\) => \{[\s\S]*handleCtrlHoverEnter\(node, event\)/);
  assert.match(app, /window[.]addEventListener\("keydown", activateCtrlHover\)/);
  assert.match(app, /window[.]addEventListener\("keyup", releaseCtrlHover\)/);
  assert.match(app, /window[.]addEventListener\("blur", releaseCtrlHover\)/);
  assert.match(app, /return \{ node: resultNode, completed: won \}/);
  assert.match(app, /ctrlHover[.]reset\(\{ abandonPending: true \}\)/);
  assert.match(styles, /[.]board-word[.]ctrl-hover-source\s*\{/);
  assert.match(styles, /[.]board-word[.]ctrl-hover-queued\s*\{/);
  assert.match(styles, /[.]board-word[.]combining\s*\{/);
});

test("Cosmos Scout renders a spoiler-safe encrypted progress window", () => {
  assert.match(page, /id="ghostPreview"[^>]+all words are hidden to prevent spoilers/);
  assert.match(page, /id="ghostPreviewProgress"[^>]+role="progressbar"/);
  const previewStart = app.indexOf("function renderGhostPreview(");
  const previewEnd = app.indexOf("async function startRivalGhost()", previewStart);
  const previewSource = app.slice(previewStart, previewEnd);
  assert.match(previewSource, /ghostTrailPreviewState\(\{ current: rivalStars, total: estimated, windowSize: 3, seed: state[.]game[.]seed \}\)/);
  assert.match(previewSource, /document[.]createElement\("span"\)/);
  assert.doesNotMatch(previewSource, /recipe|ingredients|route[.]map|preview[.]word|step[.]word|state[.]game[.]route/);
  assert.match(styles, /[.]ghost-preview-step::before, [.]ghost-preview-step::after\s*\{[^}]*filter:\s*blur/);
  assert.match(styles, /[.]ghost-preview\s*\{[^}]*pointer-events:\s*none/);
  assert.match(styles, /@media \(max-width: 700px\) and \(max-height: 500px\)[\s\S]*[.]ghost-preview\s*\{\s*display:\s*none !important/);
  assert.match(app, /if \(!profile[.]rivalGhostEnabled\) \{\s*hideGhostPreview\(\)/);
  assert.doesNotMatch(previewSource, /setAttribute\("aria-label"/);
});

test("automatic placement and Tidy avoid visible board HUD overlays", () => {
  assert.match(app, /function visibleBoardOverlayRectangles\(/);
  assert.match(app, /rectangle[?][.]left \?\? rectangle[?][.]x/);
  assert.match(app, /els[.]rivalGhost, els[.]ghostPreview, document[.]querySelector\("[.]board-tools"\)/);
  assert.match(app, /packOrbitAroundOverlays\(measured, packBounds, visibleBoardOverlayRectangles\(boardRect\)\)/);
  assert.match(app, /concat\(visibleBoardOverlayRectangles\(rect\)\)/);
  assert.match(app, /findOpenSpawn\(preferred, item, \[[.][.][.]blockers, [.][.][.]placed\]/);
});

test("Shift hover removal and distance-spaced drag copies preserve the live drag element", () => {
  assert.match(app, /createShiftBoardController/);
  assert.match(app, /function handleShiftBoardEnter\(/);
  assert.match(app, /window[.]addEventListener\("keydown", activateShiftBoard\)/);
  assert.match(app, /window[.]addEventListener\("keyup", releaseShiftBoard\)/);
  assert.match(app, /window[.]addEventListener\("blur", releaseShiftBoard\)/);
  assert.match(app, /window[.]addEventListener\("blur", cancelActivePointerGestures\)/);
  assert.match(app, /function boardModifierBlocked\([\s\S]*input, textarea, select[\s\S]*dialog\[open\]/);
  assert.match(app, /activateShiftBoard\(event\)[\s\S]*boardModifierBlocked\(event\)[\s\S]*activeTrayDragCleanup[\s\S]*shiftBoard[.]setHeld\(true\)/);
  assert.match(app, /function rememberPointerPosition\([\s\S]*shiftBoard[.]pointerMove\(lastPointerPosition\)/);
  assert.match(app, /shiftBoard[.]beginDrag\(node[.]id/);
  assert.match(app, /moveEvent[.]shiftKey && !shiftBoard[.]snapshot\(\)[.]held[\s\S]*shiftArmedByPointer = true/);
  assert.match(app, /shiftBoard[.]moveDrag\(\{ x: node[.]x, y: node[.]y \}\)/);
  assert.match(app, /shiftBoard[.]endDrag\(\)[\s\S]*if \(shiftArmedByPointer\) shiftBoard[.]setHeld\(false\)/);
  assert.match(app, /els[.]boardItems[.]append\(createBoardNode\(copy, true\)\)/);
  const duplicateStart = app.indexOf("function duplicateShiftBoardNode");
  const duplicateEnd = app.indexOf("function handleShiftBoardEnter", duplicateStart);
  const duplicateSource = app.slice(duplicateStart, duplicateEnd);
  assert.doesNotMatch(duplicateSource, /addNode\(|renderBoard\(/, "copy stamps must not replace the pointer-captured board DOM");
  const removeStart = app.indexOf("function removeShiftBoardNode");
  const removeSource = app.slice(removeStart, duplicateStart);
  assert.doesNotMatch(`${removeSource}\n${duplicateSource}`, /state[.](?:moves|history|words)\s*[=+.-]/, "board-only gestures must not change scoring or discoveries");
  assert.match(app, /startTrayPointerDrag\([\s\S]*if \(shiftBoard[.]snapshot\(\)[.]held\) shiftBoard[.]setHeld\(false\)/);
  assert.match(app, /resolveDropCandidate\([\s\S]*sourceElement: element[\s\S]*if \(resolution[?][.]selected\) void combineNodes\(node, resolution[.]selected\)/);
  assert.match(styles, /[.]cosmos-board[.]shift-remove-active/);
  assert.match(styles, /[.]cosmos-board[.]shift-stamp-active/);
  assert.match(styles, /[.]board-word[.]shift-stamped/);
});
