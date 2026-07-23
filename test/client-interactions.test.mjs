import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const releaseVersion = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;

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
  assert.match(app, /dropTrayItem\(item, lastPoint, pointerType, placement\)/);
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
  assert.match(page, /id="tapChainStatus"/);
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

test("Star Compass preserves its visible Open penalty on an ambiguous network response", () => {
  const senseStart = app.indexOf("async function useConstellationSense()");
  const localCommit = app.indexOf("profile.senseWallet = preview.wallet", senseStart);
  const request = app.indexOf('await fetchJson("/api/run/sense"', senseStart);
  assert.ok(localCommit > senseStart && localCommit < request, "the charge and Open score penalty commit before the request");
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /confirmedBeforeForfeit/);
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /visible Open penalty remains and the Compass charge stays spent/);
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /state[.]orbitGeneration !== orbitGeneration/);
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /const refund = grantSenseCharges\(profile[.]senseWallet, 1\)/);
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /if \(!els[.]senseDialog[.]open\) showToast/);
  assert.match(app, /[$]\("#buySense"\)[.]disabled = state[.]powerups[.]busy/);
});

test("Cosmic Powerups clearly present the graded assistance ladder", () => {
  const dialog = page.match(/<dialog\b(?=[^>]*\bid="senseDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
  assert.match(dialog, /id="powerupsIntro"/);
  for (const id of ["useQuickTip", "quickTipMessage", "useWordGift", "wordGiftMessage", "useSense", "senseMessage"]) {
    assert.match(dialog, new RegExp(`id="${id}"`));
  }
  assert.match(dialog, /ROUTE SIGNAL[\s\S]*SCORE SAFE/);
  assert.match(dialog, /WORD GIFT[\s\S]*OPEN · 50% SCORE/);
  assert.match(dialog, /STAR COMPASS[\s\S]*OPEN · 75% SCORE/);
  assert.equal((dialog.match(/<h3>/g) || []).length, 3, "each powerup is a navigable dialog heading");
  assert.match(dialog, /Automatic Reveal is the only full Study option at 0 score/);
  assert.match(app, /async function useQuickTip\([\s\S]*fetchJson\("\/api\/run\/tip"[\s\S]*tipIndex/);
  assert.match(app, /state[.]powerups[.]tipsUsed = clamp\(Number\(tip[.]used\)/);
  assert.match(app, /tipsUsed: clamp\(Number\(state[.]powerups[.]tipsUsed\)/, "Quick Tip use survives interrupted-run restore");
  assert.match(styles, /[.]powerup-action, [.]powerup-buy\s*\{[^}]*min-height:\s*48px/);
  assert.match(styles, /[.]powerup-message\s*\{[^}]*font-size:\s*15px/);
  assert.match(styles, /[.]powerups-modal\s*\{[^}]*height:\s*100dvh/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*[.]powerup-grid\s*\{\s*grid-template-columns:\s*1fr/);
});

test("board powerup shortcuts stay synchronized, safe, and touch accessible", () => {
  const tools = page.match(/<div\b(?=[^>]*\bclass="board-tools")[^>]*>[\s\S]*?<\/div>\s*<button class="rival-ghost"/i)?.[0] || "";
  assert.match(tools, /class="powerup-shortcuts"[^>]*role="group"/);
  for (const id of ["senseButton", "quickTipShortcut", "wordGiftShortcut", "senseShortcut", "powerupShopShortcut"]) {
    assert.match(tools, new RegExp(`id="${id}"`));
  }
  assert.match(tools, /id="powerupShopShortcut"[\s\S]*Buy more Star Compass charges/);
  assert.match(app, /quickTipShortcutCount[.]textContent = String\(tipsRemaining\)/);
  assert.match(app, /wordGiftShortcutCount[.]textContent = armedKind === "gift"/);
  assert.match(app, /senseShortcutCount[.]textContent = armedKind === "sense"/);
  assert.match(app, /function activateOpenPowerupShortcut\(kind, action\)[\s\S]*activeArmedPowerup\(\) === kind[\s\S]*keeps [^`]+ score in Open/);
  assert.match(app, /if \(!els[.]senseDialog[.]open\) showAlchemy\(`ROUTE SIGNAL/);
  assert.match(app, /function openPowerupShop\(\)[\s\S]*scrollIntoView[\s\S]*focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /function buySenseCharge\(\)[\s\S]*saveProfile\(\{ fields: \["progression"\] \}\);[\s\S]*renderProfile\(\)/);
  assert.match(app, /wordGiftShortcut[.]addEventListener\("click", useWordGiftShortcut\)/);
  assert.match(app, /senseShortcut[.]addEventListener\("click", useSenseShortcut\)/);
  assert.match(styles, /[.]sense-tool em\s*\{[^}]*min-width:\s*max-content[^}]*white-space:\s*nowrap/);
  assert.match(styles, /[.]board-tools [.]quick-power-button, [.]board-tools [.]powerup-shop-shortcut\s*\{[^}]*width:\s*44px[^}]*min-height:\s*44px/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*[.]run-milestone\s*\{\s*display:\s*none/);
  assert.match(styles, /@media \(max-width: 359px\)[\s\S]*grid-template-rows:\s*44px 44px/);
  assert.match(styles, /@media \(max-width: 700px\) and \(max-height: 500px\) and \(min-width: 520px\)[\s\S]*[.]board-tools\s*\{[^}]*width:\s*244px[^}]*grid-template-rows:\s*44px 44px/);
  assert.match(styles, /@media \(max-width: 700px\)\s*\{\s*[.]game-screen[.]first-ranked-orbit [.]board-tools [.]sense-tool\s*\{[^}]*width:\s*112px[^}]*min-width:\s*112px/, "the first ranked orbit's Powers KIT pill stays inside a mobile board");
});

test("Word Gift is one-use, server-selected, durable, and commits its Open penalty before its request", () => {
  const giftStart = app.indexOf("async function useWordGift()");
  const giftEnd = app.indexOf("async function useConstellationSense()", giftStart);
  const giftSource = app.slice(giftStart, giftEnd);
  const localPenalty = giftSource.indexOf('combineAssistance(priorAssist, "gift")');
  const request = giftSource.indexOf('fetchJson("/api/run/gift"');
  assert.ok(localPenalty >= 0 && localPenalty < request, "Open status commits before the Gift request");
  assert.match(giftSource, /body: JSON[.]stringify\(\{ runId, runToken: priorRun[.]token \}\)/);
  assert.match(giftSource, /state[.]powerups[.]giftUsed = true/);
  assert.match(giftSource, /retry to recover the same bridge/);
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

test("graded assistance remains visibly and accessibly marked for the whole orbit", () => {
  assert.match(app, /function updateStudyHud\(\)/);
  assert.match(app, /els[.]lawPill[.]textContent = "◇ STUDY · 0 SCORE"/);
  assert.match(app, /updateHud\(\)[\s\S]*updateStudyHud\(\)/);
  assert.match(app, /els[.]lawPill[.]textContent = `◇ OPEN · \$\{Math[.]round\(state[.]scoreMultiplier \* 100\)\}% SCORE`/);
  assert.match(styles, /[.]game-target #lawPill[.]study-status:not\(\[hidden\]\)\s*\{[^}]*display:\s*block[^}]*font-size:\s*15px/);
  assert.match(styles, /[.]game-target #lawPill[.]partial-status:not\(\[hidden\]\)\s*\{[^}]*display:\s*block[^}]*font-size:\s*15px/);
  assert.match(page, /id="partialAssistResultCard"[\s\S]*id="partialAssistScore"/);
});

test("no response or assistance composition can upgrade a committed score penalty", () => {
  assert.match(app, /function cappedScoreMultiplier\(assist, [.][.][.]values\)[\s\S]*assistancePolicy\(assist\)[.]scoreMultiplier[\s\S]*Math[.]min\(multiplier, clamp\(number, 0, 1\)\)/);
  const gift = app.slice(app.indexOf("async function useWordGift()"), app.indexOf("async function useConstellationSense()"));
  assert.match(gift, /combineAssistance\(priorAssist, "gift"\)/);
  assert.match(gift, /combineAssistance\(pendingPolicy[.]id, result[.]assist \|\| "gift"\)/);
  assert.match(gift, /state[.]scoringDisabled = Boolean\(state[.]scoringDisabled \|\| confirmedPolicy[.]study \|\| result[.]scoringDisabled === true \|\| result[.]scoreEligible === false\)/);
  assert.match(gift, /cappedScoreMultiplier\(state[.]assist, state[.]scoreMultiplier, confirmedPolicy[.]scoreMultiplier, result[.]scoreMultiplier\)/);
  const sense = app.slice(app.indexOf("async function useConstellationSense()"), app.indexOf("function buySenseCharge"));
  assert.match(sense, /combineAssistance\(priorAssist, "sense"\)/);
  assert.match(sense, /state[.]scoringDisabled = Boolean\(state[.]scoringDisabled \|\| confirmedPolicy[.]study \|\| result[.]scoringDisabled === true \|\| result[.]scoreEligible === false\)/);
  assert.match(sense, /cappedScoreMultiplier\(state[.]assist, state[.]scoreMultiplier, confirmedPolicy[.]scoreMultiplier, result[.]scoreMultiplier\)/);
  assert.match(app, /combineAssistance\(state[.]assist, "wish"\)[\s\S]*cappedScoreMultiplier\(state[.]assist, state[.]scoreMultiplier, declaredPolicy[.]scoreMultiplier/);
  assert.match(app, /combineAssistance\(state[.]assist, "market"\)[\s\S]*cappedScoreMultiplier\(state[.]assist, state[.]scoreMultiplier, declaredPolicy[.]scoreMultiplier/);
});

test("cloud sync preserves only genuinely pending local fields", () => {
  assert.match(app, /cloudPendingFields/);
  assert.match(app, /saveProfile\(\{ cloud: founderActivated, fields: \["progression"\] \}\)/);
  assert.match(app, /preferLocalSettings: localSettingsPending/);
  assert.match(app, /preferLocalProgression: localProgressionPending/);
  assert.match(app, /state[.]cloudRevision === revision/);
  assert.match(app, /scheduleCloudProfileSync\(\{ changed: false, delay: 250 \}\)/);
});

test("recipe feedback accepts authored local recipes with privacy-safe aggregate storage", () => {
  assert.match(app, /feedbackEligible: result[.]feedbackEligible === true/);
  assert.match(app, /historyStep[.]feedbackEligible\) offerRecipeFeedback/);
  assert.match(app, /if \(!step[?][.]feedbackEligible \|\| step[.]twisted \|\| step[.]revealed/);
  assert.match(app, /function recordLocalRecipeVote\(step, rating\)/);
  assert.match(app, /recipeFingerprint\(step\)/);
  assert.match(app, /LOCAL_RECIPE_FEEDBACK_KEY/);
  assert.doesNotMatch(app.slice(app.indexOf("function recordLocalRecipeVote"), app.indexOf("async function submitRecipeFeedback")), /localStorage[.]setItem\([^\n]+step[.]|\ba:\s*step[.]a|\bword:\s*step[.]word/);
  assert.match(page, /id="boardAnnouncement"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.doesNotMatch(page, /id="recipeFeedbackAnnouncement"/, "board prompts must share one announcement channel");
  assert.match(page, /id="dismissRecipeFeedback"/);
  assert.match(app, /contains\(document[.]activeElement\).*scheduleRecipeFeedbackExpiry/);
  assert.match(app, /if \(boardNoticeBusy\(\)\)[\s\S]*setTimeout\(revealFeedback, 280\)/);
});

test("new cloud and onboarding status controls are announced and touch accessible", () => {
  assert.match(page, /id="cloudSyncStatus"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(styles, /[.]first-orbit-modal [.]modal-close\s*\{\s*width:\s*44px;\s*height:\s*44px/);
});

test("an unacknowledged Recovery Kit survives refresh without interrupting the first orbit", () => {
  assert.match(app, /const PENDING_RECOVERY_KIT_KEY = "constellore-pending-recovery-kit-v1"/);
  assert.match(app, /function rememberPendingRecoveryKit\(value\)[\s\S]*localStorage[.]setItem\(PENDING_RECOVERY_KIT_KEY, JSON[.]stringify\(kit\)\)/);
  assert.match(app, /function restorePendingRecoveryKit\(playerId\)[\s\S]*kit[?][.]playerId === playerId/);
  assert.match(app, /async function ensurePlayer\(\)[\s\S]*restorePendingRecoveryKit\(profile[.]playerId\)/);
  assert.match(app, /function showRecoveryKit\(\{ force = false \} = \{\}\)[\s\S]*if \(!force && profile[.]wins < 1\) return/);
  assert.match(app, /function acknowledgeRecoveryKit\(\)[\s\S]*rememberPendingRecoveryKit\(null\)[\s\S]*renderProfile\(\)/);
  assert.match(app, /async function rotateRecoveryKit\(\)[\s\S]*if \(state[.]recoveryKit[?][.]code\)[\s\S]*showRecoveryKit\(\{ force: true \}\)/);
});

test("every modal has an explicit accessible name and a full-size close target", () => {
  const dialogs = [...page.matchAll(/<dialog\b[^>]*>/gi)].map((match) => match[0]);
  assert.ok(dialogs.length >= 15);
  for (const dialog of dialogs) {
    const id = dialog.match(/\bid="([^"]+)"/i)?.[1] || "unnamed dialog";
    const labelId = dialog.match(/\baria-labelledby="([^"]+)"/i)?.[1];
    assert.ok(labelId, `${id} needs aria-labelledby`);
    assert.match(page, new RegExp(`\\bid="${labelId}"`), `${id} must reference an existing label`);
  }
  assert.match(styles, /[.]modal-close\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/);
});

test("the home screen explains the loop, presents one next action, and groups every deeper choice", () => {
  assert.match(page, /<button\b(?=[^>]*id="primaryOrbitButton")(?=[^>]*class="[^"]*primary-orbit-button)/);
  assert.equal((page.match(/\bid="primaryOrbitButton"/g) || []).length, 1);
  assert.match(page, /id="primaryOrbitSecondary"/);
  assert.match(page, /Combine two words to make a new one[.] Keep discovering until you create the target word[.]/);
  assert.match(page, /aria-label="Example: Earth plus Water makes Mud"/);
  assert.match(page, /<details\b(?=[^>]*id="modePicker")(?=[^>]*data-progressive="secondary")/);
  assert.match(page, /<details\b(?=[^>]*id="adventuresHub")(?=[^>]*data-progressive="adventure")/);
  assert.match(page, /id="hubMenuButton"[^>]+aria-controls="hubMenuDialog"/);
  assert.match(page, /id="hubMenuDialog"[^>]+aria-labelledby="hubMenuTitle"/);
  assert.match(page, /data-progressive="progress"/);
  assert.match(app, /createHomeMenuState/);
  assert.match(app, /function homeMenuState\(\)/);
  assert.match(app, /function syncProgressiveDisclosure\(\)/);
  assert.match(app, /classList[.]toggle\("first-session", !menu[.]onboardingComplete\)/);
  assert.match(app, /classList[.]toggle\("progress-ready", menu[.]progressReady\)/);
  assert.match(app, /classList[.]toggle\("adventures-ready", menu[.]adventuresReady\)/);
  assert.match(app, /classList[.]toggle\("training-needed", !training[.]completed\)/);
  assert.match(app, /primaryOrbitButton["']\)[.]addEventListener\("click", beginPrimaryOrbit\)/);
  assert.match(app, /primaryOrbitSecondary["']\)[.]addEventListener\("click", beginPrimarySecondary\)/);
  assert.match(styles, /body[.]first-session \[data-progressive="secondary"\]/);
  assert.match(styles, /body:not\([.]adventures-ready\) \[data-progressive="adventure"\]/);
  assert.match(styles, /[.]primary-orbit-button\s*\{[^}]*min-height:\s*60px/);
});

test("seeing or skipping training never unlocks the full home shell by itself", () => {
  assert.match(app, /function firstSessionUnlocked\(\)\s*\{\s*return homeMenuState\(\)[.]onboardingComplete/);
  assert.doesNotMatch(app, /function firstSessionUnlocked\(\)[\s\S]{0,180}training[.]seen/);
  assert.match(app, /function beginPrimarySecondary\(\)[\s\S]*action === "reach"[\s\S]*rememberFirstOrbitSeen\(\)[\s\S]*beginMode\("reach"/);
  assert.match(app, /function skipFirstOrbit\(\)[\s\S]*rememberFirstOrbitSeen\(\)[\s\S]*returnHome\(\)/, "in-board Skip must return to a real choice");
  assert.doesNotMatch(page, /id="firstOrbitDialog"/, "first use should not be blocked by a redundant welcome dialog");
});

test("opening alternative modes never hijacks the viewport or keyboard focus", () => {
  const source = app.slice(app.indexOf("function openModePicker()"), app.indexOf("async function beginPrimarySecondary()"));
  assert.match(source, /picker[.]open = true/);
  assert.doesNotMatch(source, /scrollIntoView|scrollTo|[.]focus\(/);
});

test("relaxed Reach suppresses the race ghost and leaderboards retain exact challenge identity", () => {
  const ghostEligibility = app.slice(app.indexOf("function competitiveGhostEligible"), app.indexOf("function renderGhostPreview"));
  assert.match(ghostEligibility, /!\["training", "second-orbit", "explore", "reach"\][.]includes\(state[.]mode\)/);
  assert.match(app, /const challengeId = state[.]game[?][.]challengeId \|\| state[.]run[?][.]challengeId/);
  assert.match(app, /params[.]set\("challengeId", String\(challengeId\)\)/);
});

test("local diagnostics are bounded aggregates and players can export or reset their data", () => {
  const tracking = app.slice(app.indexOf("function track("), app.indexOf("let feedbackAudioContext"));
  const localTracking = tracking.slice(0, tracking.indexOf("const body"));
  const staticTracking = localTracking.slice(localTracking.indexOf("if (isStaticBeta)"));
  assert.match(tracking, /if \(isStaticBeta\)/);
  assert.match(tracking, /JSON[.]stringify\(\{ version: 1, counts: bounded \}\)/);
  assert.doesNotMatch(staticTracking, /sessionId|properties|updatedAt/, "static storage must contain aggregate counts only");
  for (const id of ["exportLocalPractice", "resetLocalPractice", "exportLocalDiagnostics", "resetLocalDiagnostics", "exportPlayerData", "deletePlayerData"]) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  assert.match(app, /fetchJson\("\/api\/player\/profile", \{[\s\S]*method: "DELETE"[\s\S]*confirm: "DELETE"/);
});

test("returning home preserves the post-win recovery decision without leaking it into pointer cleanup", () => {
  const returnHome = app.slice(app.indexOf("function returnHome()"), app.indexOf("async function beginPrimaryOrbit"));
  const pointerCleanup = app.slice(app.indexOf("function cancelActivePointerGestures()"), app.indexOf("function pointInsideBoard"));
  assert.match(returnHome, /const showRecoveryAfterExit = Boolean\(state[.]finished && state[.]recoveryKit[?][.]code && profile[.]wins > 0\)/);
  assert.match(returnHome, /if \(showRecoveryAfterExit\) showRecoveryKit\(\)/);
  assert.doesNotMatch(pointerCleanup, /showRecoveryAfterExit/);
});

test("Dev Logs exposes the complete accessible, readable, responsive update history", () => {
  const button = page.match(/<button\b(?=[^>]*\bid="updatesButton")[^>]*>/i)?.[0] || "";
  assert.ok(button, "the updates trigger is present");
  assert.match(button, /\baria-haspopup="dialog"/i);
  assert.match(button, /\baria-controls="updatesDialog"/i);

  const dialog = page.match(/<dialog\b(?=[^>]*\bid="updatesDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
  assert.ok(dialog, "the updates dialog is present");
  assert.match(dialog.match(/<dialog\b[^>]*>/i)?.[0] || "", /\baria-labelledby="updatesTitle"/i);
  assert.match(dialog, /id="updatesTitle"/i);
  assert.match(dialog, /data-close="updatesDialog"/i);
  assert.equal((dialog.match(/\bdata-update-entry(?:=|\s|>)/gi) || []).length, 7, "the 3.0 log has exactly seven updates");
  for (const label of ["Release", "Ctrl", "Shift", "Route Signals", "Living Atlas", "Signature Constellations", "Path Becomes the Game"]) assert.match(dialog, new RegExp(`\\b${label}\\b`, "i"));
  assert.match(dialog, /7 ENTRIES/i);
  assert.equal((dialog.match(/\bis-latest\b/gi) || []).length, 1, "the log has exactly one latest entry");
  assert.equal((dialog.match(/>LATEST</gi) || []).length, 1, "the log has exactly one latest badge");
  const latest = dialog.match(/<li\b(?=[^>]*\bis-latest\b)[^>]*>[\s\S]*?<\/li>/i)?.[0] || "";
  assert.ok(latest, "the log identifies its latest entry");
  assert.ok(latest.toUpperCase().includes(`VERSION ${releaseVersion.toUpperCase()}`));
  assert.match(latest, /Pages and itch are deterministic local practice without live rankings, accounts, or AI/i);
  assert.match(latest, /Beta progress may reset/i);

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
  assert.match(app, /function presentMissionBriefing\(\)[\s\S]*[$]\("#recoveryDialog"\)[.]open[\s\S]*showModal\(\)/);
  assert.match(app, /async function confirmMissionBriefing\(/);
  assert.match(app, /fetchJson\("\/api\/run\/preview"/);
  assert.match(app, /request: \{ [.]\.\.request, previewToken: preview[.]previewToken \}/);
  assert.match(app, /error[.]code === "mission_stale"[\s\S]*refreshMissionPreview\(pending\)/);
  assert.match(app, /confirmMissionBriefing\(\)[\s\S]*createRun\(pending[.]request\)[\s\S]*startWithGame\(started[.]game, started[.]run, \{ context: pending[.]context \}\)/);
  assert.match(app, /beginCustomTarget[\s\S]*requestMissionPreview\(request\)[\s\S]*openMissionBriefing\(preview[.]game, preview[.]request/);
  assert.match(app, /skipBriefing:\s*true/);
  assert.match(app, /acknowledgeRecoveryKit\(\)[\s\S]*state[.]pendingMission[\s\S]*presentMissionBriefing/);
  assert.match(page, /id="primaryOrbitDescription"[^>]*>Your target is Wall[.][\s\S]*id="primaryOrbitMeta">TARGET: WALL · GUIDED · NO SCORE/);
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
  assert.match(page, /id="ghostPreviewProgress"[^>]+role="progressbar"[^>]+aria-valuemax="100"/);
  assert.match(page, /id="ghostPreviewPercent">0%/);
  const previewStart = app.indexOf("function renderGhostPreview(");
  const previewEnd = app.indexOf("async function startRivalGhost()", previewStart);
  const previewSource = app.slice(previewStart, previewEnd);
  assert.match(previewSource, /const continuousProgress = clamp\(Number\(projectedProgress\)/);
  assert.match(previewSource, /ghostTrailPreviewState\(\{ current: completedSteps, total: estimated, windowSize: 3, seed: state[.]game[.]seed \}\)/);
  assert.match(previewSource, /const percent = preview[.]complete \? 100 : Math[.]min\(99, Math[.]floor\(continuousProgress \* 100\)\)/);
  assert.match(previewSource, /ghostPreviewPercent[.]textContent = `[$]\{percent\}%`/);
  assert.match(previewSource, /--ghost-step-progress/);
  assert.match(previewSource, /const sameWindow = existingSteps[.]length === preview[.]steps[.]length/);
  assert.match(previewSource, /if \(!sameWindow\) els[.]ghostPreviewSteps[.]replaceChildren/);
  assert.match(previewSource, /document[.]createElement\("span"\)/);
  assert.doesNotMatch(previewSource, /recipe|ingredients|route[.]map|preview[.]word|step[.]word|state[.]game[.]route/);
  assert.match(styles, /[.]ghost-preview-step::before, [.]ghost-preview-step::after\s*\{[^}]*filter:\s*blur/);
  assert.match(styles, /[.]ghost-preview-step-fill\s*\{[^}]*width:\s*var\(--ghost-step-progress\)[^}]*transition:\s*width [.]5s linear/);
  assert.match(styles, /[.]ghost-preview-progress i::after\s*\{[^}]*animation:\s*ghost-tracer/);
  assert.match(styles, /[.]ghost-preview\s*\{[^}]*pointer-events:\s*none/);
  assert.match(styles, /[.]cosmos-board:has\([.]ghost-preview:not\(\[hidden\]\)\) [.]board-guide\s*\{[^}]*bottom:\s*22px/);
  assert.match(styles, /@media \(max-width: 390px\) and \(max-height: 620px\)[\s\S]*[.]ghost-preview-steps\s*\{\s*display:\s*none/);
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

test("Shift hover removal and distance-spaced drag copies work from board and inventory", () => {
  assert.match(app, /createShiftBoardController/);
  assert.match(app, /function handleShiftBoardEnter\(/);
  assert.match(app, /window[.]addEventListener\("keydown", activateShiftBoard\)/);
  assert.match(app, /window[.]addEventListener\("keyup", releaseShiftBoard\)/);
  assert.match(app, /window[.]addEventListener\("blur", releaseShiftBoard\)/);
  assert.match(app, /window[.]addEventListener\("blur", cancelActivePointerGestures\)/);
  assert.match(app, /function boardModifierBlocked\([\s\S]*input, textarea, select[\s\S]*dialog\[open\]/);
  const activationStart = app.indexOf("function activateShiftBoard");
  const activationEnd = app.indexOf("function releaseShiftBoard", activationStart);
  const activationSource = app.slice(activationStart, activationEnd);
  assert.doesNotMatch(activationSource, /boardModifierBlocked\(event\) \|\| activeTrayDragCleanup/, "inventory drags must not block Shift activation");
  assert.match(activationSource, /shiftBoard[.]setHeld\(true\)[\s\S]*if \(activeTrayDragCleanup\)/);
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
  const trayStart = app.indexOf("function startTrayPointerDrag");
  const trayEnd = app.indexOf("function addNode", trayStart);
  const traySource = app.slice(trayStart, trayEnd);
  assert.doesNotMatch(traySource, /if \(shiftBoard[.]snapshot\(\)[.]held\) shiftBoard[.]setHeld\(false\)/, "picking up an inventory word must preserve held Shift");
  assert.match(app, /function getShiftBoardNode\([\s\S]*activeTrayShiftSource/);
  assert.match(traySource, /activeTrayShiftSource = \{[\s\S]*traySource: true/);
  assert.match(traySource, /shiftBoard[.]beginDrag\(activeTrayShiftSource[.]id, origin, dragSize\)/);
  assert.match(app, /function measureBoardWord\(item\)[\s\S]*className = "board-word board-word-measure"[\s\S]*getBoundingClientRect\(\)/);
  assert.match(traySource, /dragSize = measureBoardWord\(item\)/, "Shift spacing must use the real board-chip size");
  assert.match(traySource, /const inside = pointInsideBoard\(point\)[\s\S]*shiftBoard[.]reanchorDrag\(boardPoint\)[\s\S]*shiftBoard[.]moveDrag\(boardPoint\)/);
  assert.match(traySource, /if \(dragging\) updateShiftTrail\(lastPoint\)[\s\S]*cleanup\(\)[\s\S]*dropTrayItem/, "pointer-up must flush the final Shift segment before drop resolution");
  assert.match(traySource, /shiftBoard[.]endDrag\(\)[\s\S]*activeTrayShiftSource = null/);
  assert.match(traySource, /const placement = shouldDrop && dragSize \? \{ boardPoint: trayShiftBoardPoint\(lastPoint, dragSize\), size: dragSize \} : \{\}/);
  assert.match(traySource, /if \(shouldDrop\) dropTrayItem\(item, lastPoint, pointerType, placement\)/);
  assert.match(app, /function placeFromTray\(item, point, placement = \{\}\)[\s\S]*boardPoint[\s\S]*measuredSize[\s\S]*addNode\(item, x, y, measuredSize \? \{ size: measuredSize, inset: 5 \} : \{\}\)/);
  assert.match(app, /const \{ size, inset: requestedInset, [.][.][.]nodeOptions \} = options[\s\S]*bounds[.]width - width - inset/);
  assert.match(app, /resolveDropCandidate\([\s\S]*sourceElement: element[\s\S]*if \(resolution[?][.]selected\) void combineNodes\(node, resolution[.]selected\)/);
  assert.match(styles, /[.]cosmos-board[.]shift-remove-active/);
  assert.match(styles, /[.]cosmos-board[.]shift-stamp-active/);
  assert.match(styles, /[.]board-word[.]shift-stamped/);
});

test("board notices and interactive prompts share one collision-free bottom lane", () => {
  const hud = page.match(/<div class="board-bottom-hud"[\s\S]*?<\/div>\s*<section class="reveal-controller"/)?.[0] || "";
  for (const id of ["tapChainStatus", "boardUndo", "recipeFeedback", "alchemyNote"]) assert.match(hud, new RegExp(`id="${id}"`));
  assert.match(hud, /id="alchemyNote"[^>]+aria-hidden="true"/);
  assert.match(page, /id="boardAnnouncement"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(styles, /[.]board-bottom-hud\s*\{[^}]*position:\s*absolute[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
  for (const selector of [".tap-chain-status, .board-undo", ".alchemy-note", ".recipe-feedback"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rule = styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || "";
    assert.doesNotMatch(rule, /\bbottom\s*:/, `${selector} must be positioned by the shared lane`);
  }
  const masteryStart = app.indexOf("function recordMasteryStep");
  const masteryEnd = app.indexOf("const cosmeticClassNames", masteryStart);
  assert.doesNotMatch(app.slice(masteryStart, masteryEnd), /showToast\(/, "mastery should return a follow-up notice instead of opening a second toast");
  assert.match(app, /showAlchemy\(result[.]twisted[\s\S]*queueAlchemyNotice\(mastery[.]notice/);
  assert.match(app, /queueAlchemyNotice\(mastery[.]notice, false, false, \{ key: `mastery:[^`]+`, retain: true/);
  assert.match(app, /if \(els[.]recipeFeedback && !els[.]recipeFeedback[.]hidden\) resetRecipeFeedback\(\)/, "a queued mastery must not cancel hidden pending feedback");
  assert.match(app, /activeBoardNotice[?][.]retain[\s\S]*enqueueBoardNotice\(activeBoardNotice\)/);
  assert.match(app, /resultMasteryCard[.]hidden = !won \|\| !state[.]resultMasteryNotice/);
  assert.match(styles, /[.]alchemy-note\s*\{[^}]*display:\s*none/);
  assert.match(styles, /[.]alchemy-note[.]show\s*\{[^}]*display:\s*block/);
  assert.match(styles, /[.]cosmos-board:has\([.]board-undo:not\(\[hidden\]\)\) [.]board-guide/);
  assert.doesNotMatch(app, /document[.]querySelector\("[.]board-bottom-hud"\)/, "collision avoidance must use visible HUD children, not the full-width wrapper");
  assert.match(app, /function showToast\([\s\S]*boardCanOwnNotice[\s\S]*showAlchemy\(message\)/);
});
