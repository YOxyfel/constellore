import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appCore = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const inventoryRuntime = await readFile(new URL("../public/inventory-view-runtime.mjs", import.meta.url), "utf8");
const powerupRuntime = await readFile(new URL("../public/powerup-view-runtime.mjs", import.meta.url), "utf8");
const conceptMatterApp = await readFile(new URL("../public/concept-matter-app.mjs", import.meta.url), "utf8");
const app = `${appCore}\n${inventoryRuntime}\n${powerupRuntime}\n${conceptMatterApp}`;
const audioRuntime = await readFile(new URL("../public/audio-runtime.mjs", import.meta.url), "utf8");
const homeMenuView = await readFile(new URL("../public/home-menu-view.mjs", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const simpleStyles = [
  await readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8"),
  await readFile(new URL("../public/mobile-play-shell.css", import.meta.url), "utf8")
].join("\n");
const mobileShellRuntime = await readFile(new URL("../public/mobile-play-shell-runtime.mjs", import.meta.url), "utf8");
const cosmeticStyles = await readFile(new URL("../public/cosmetics.css", import.meta.url), "utf8");
const stardustStoreRuntime = await readFile(new URL("../public/stardust-store-runtime.mjs", import.meta.url), "utf8");
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

test("word surfaces expose bounded category and source hooks for atlas styling", () => {
  const visualStart = app.indexOf("function visualWordToken");
  const visualEnd = app.indexOf("function recentInventoryWords", visualStart);
  const visual = app.slice(visualStart, visualEnd);
  assert.ok(visual.includes('return /^[a-z][a-z0-9-]{0,31}$/.test(token) ? token : "unknown";'));
  assert.ok(visual.includes('["force", "nature", "life", "structure", "celestial"].includes(category) ? category : "unknown"'));
  const inventoryStart = app.indexOf("function renderInventory");
  const inventoryEnd = app.indexOf("function renderBoard", inventoryStart);
  const inventory = app.slice(inventoryStart, inventoryEnd);
  assert.match(inventory, /button[.]dataset[.]category = visualWordCategory\(item[.]category\)/);
  assert.match(inventory, /button[.]dataset[.]source = visualWordToken\(item[.]source\)/);
  const boardStart = app.indexOf("function syncBoardNodeElement");
  const boardEnd = app.indexOf("function createBoardNode", boardStart);
  const board = app.slice(boardStart, boardEnd);
  assert.match(board, /button[.]dataset[.]category = visualWordCategory\(node[.]item[.]category\)/);
  assert.match(board, /button[.]dataset[.]source = visualWordToken\(node[.]item[.]source\)/);
  const trayStart = app.indexOf("function startTrayPointerDrag");
  const trayEnd = app.indexOf("function addNode", trayStart);
  const tray = app.slice(trayStart, trayEnd);
  assert.match(tray, /ghost[.]dataset[.]category = visualWordCategory\(item[.]category\)/);
  assert.match(tray, /ghost[.]dataset[.]source = visualWordToken\(item[.]source\)/);
});

test("the extracted desktop inventory renderer receives the shared word-key normalizer", () => {
  assert.match(inventoryRuntime, /createInventoryRenderer\(\{[\s\S]*?\binventoryKey,/);
  const wiring = appCore.slice(
    appCore.indexOf("renderInventory = createInventoryRenderer({"),
    appCore.indexOf("const cosmicGate", appCore.indexOf("renderInventory = createInventoryRenderer({"))
  );
  assert.match(wiring, /\binventoryKey,/);
});

test("mobile training reserves playable board space in portrait and short landscape", () => {
  const measuredStart = app.indexOf("function measuredPlayableBoardLayout");
  const measuredEnd = app.indexOf("function schedulePlayableBoardRefresh", measuredStart);
  const measured = app.slice(measuredStart, measuredEnd);
  assert.match(app, /import \{ calculatePlayableBounds \} from "[.]\/mobile-play-chrome[.]mjs/);
  assert.match(app, /import \{ bindMobilePlayShell \} from "[.]\/mobile-play-shell-runtime[.]mjs/);
  assert.match(mobileShellRuntime, /createMobilePlayChrome\(\{/);
  assert.match(measured, /learningOrbitActive\(\) \? els[.]firstOrbitGuide : null/);
  assert.match(measured, /const top = shortLandscape[\s\S]*topChrome[.]reduce/);
  assert.match(measured, /calculatePlayableBounds\(\{[\s\S]*persistentInsets: \{ top, right: 8, bottom: 8, left: 8 \}[\s\S]*blockers[\s\S]*minimum: extreme \? \{ width: 240, height: 140 \} : \{ width: 280, height: 220 \}/);
  assert.match(measured, /data-playable-minimum/);
  assert.match(app, /els[.]board[.]scrollTop = 0/);
  assert.match(simpleStyles, /#gameScreen\[data-play-layout="stacked"\] [.]game-layout\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
  assert.match(simpleStyles, /#gameScreen\[data-play-layout="short-landscape"\] [.]game-layout\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0, 1fr\) var\(--play-shell-side-peek\)/);
});

test("inventory placement cannot fall into a bottom vertical-list seam", () => {
  assert.match(simpleStyles, /#gameScreen\[data-play-layout="stacked"\] [.]inventory\s*\{[^}]*height:\s*var\(--play-shell-inventory-peek\)[^}]*overflow:\s*hidden/);
  assert.match(simpleStyles, /#gameScreen\[data-play-layout="stacked"\]\[data-inventory-expanded="true"\] [.]inventory\s*\{[^}]*height:\s*var\(--play-shell-inventory-open\)[^}]*flex-basis:\s*var\(--play-shell-inventory-open\)/);
  assert.match(simpleStyles, /#gameScreen\[data-play-layout="stacked"\] [.]word-list\s*\{[^}]*display:\s*flex[^}]*overflow-x:\s*auto[^}]*overflow-y:\s*hidden[^}]*touch-action:\s*pan-x/);
  assert.match(simpleStyles, /#gameScreen\[data-play-layout="stacked"\] [.]inventory-word\s*\{[^}]*width:\s*auto[^}]*flex:\s*0 0 auto[^}]*touch-action:\s*pan-x/);

  assert.match(simpleStyles, /#gameScreen\[data-play-layout="short-landscape"\] [.]game-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) var\(--play-shell-side-peek\)/);
  assert.match(simpleStyles, /#gameScreen\[data-play-layout="short-landscape"\]\[data-inventory-expanded="true"\] [.]game-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) var\(--play-shell-side-open\)/);
  assert.match(simpleStyles, /#gameScreen\[data-play-layout="short-landscape"\] [.]inventory\s*\{[^}]*max-height:\s*none[^}]*overflow:\s*hidden/);
  assert.match(simpleStyles, /#gameScreen\[data-play-layout="short-landscape"\] [.]word-list\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto[^}]*touch-action:\s*pan-y/);

  const trayDrag = app.slice(app.indexOf("function startTrayPointerDrag"), app.indexOf("function addNode", app.indexOf("function startTrayPointerDrag")));
  assert.match(trayDrag, /const stackedTray = els[.]gameScreen[?][.]dataset[.]playLayout === "stacked"/);
  assert.match(trayDrag, /stackedTray\s*[?]\s*dy < -10 && Math[.]abs\(dy\) > Math[.]abs\(dx\) \* 1[.]15\s*:\s*dx < -10 && Math[.]abs\(dx\) > Math[.]abs\(dy\) \* 1[.]15/);
});

test("first-game inventory guidance has a paint gutter, staggered motion, and unclipped contained light", () => {
  const tutorialRule = simpleStyles.match(/[.]simple-ui [.]inventory-word[.]tutorial-hot\s*\{([^}]+)\}/)?.[1] || "";
  const cosmeticTutorialRule = cosmeticStyles.match(/body[.]simple-ui [.]inventory-word[.]tutorial-hot\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(tutorialRule, /opacity:\s*1/);
  assert.match(tutorialRule, /overflow:\s*visible/);
  assert.match(tutorialRule, /border:\s*1px solid/);
  assert.match(tutorialRule, /border-left:\s*3px solid/);
  assert.match(tutorialRule, /border-radius:\s*12px/);
  assert.match(tutorialRule, /background:\s*[\s\S]*radial-gradient[\s\S]*linear-gradient/);
  assert.match(tutorialRule, /box-shadow:\s*[\s\S]*inset/);
  assert.doesNotMatch(tutorialRule, /\n\s*0 8px 18px/);
  assert.match(tutorialRule, /animation:\s*inventory-tutorial-arrive/);
  assert.match(styles, /[.]word-list\s*\{[^}]*padding:\s*12px 10px 15px 8px/);
  assert.match(styles, /[.]word-list > [.]inventory-word \+ [.]inventory-word\s*\{[^}]*margin-top:\s*6px/);
  assert.match(simpleStyles, /[.]inventory-word[.]tutorial-hot ~ [.]inventory-word[.]tutorial-hot\s*\{[^}]*--tutorial-delay:\s*120ms/);
  const arrivalFrames = simpleStyles.match(/@keyframes inventory-tutorial-arrive\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(arrivalFrames, /translate3d\(0,\s*4px,\s*0\)/);
  assert.match(arrivalFrames, /translate3d\(0,\s*-1px,\s*0\)/);
  assert.doesNotMatch(arrivalFrames, /(?:blur|translate3d\((?!0,))/);
  const highlightRule = simpleStyles.match(/[.]simple-ui [.]inventory-word[.]tutorial-hot::before\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(highlightRule, /inset:\s*1px/);
  assert.match(highlightRule, /opacity:\s*[.]2/);
  assert.doesNotMatch(highlightRule, /(?:translateX|animation:)/);
  assert.match(simpleStyles, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*[.]inventory-word[.]tutorial-hot\s*\{[^}]*animation:\s*none !important/);
  assert.match(simpleStyles, /[.]simple-ui [.]inventory-word:focus-visible\s*\{[^}]*outline-offset:\s*3px/);
  assert.match(cosmeticTutorialRule, /box-shadow:\s*[\s\S]*inset/);
  assert.doesNotMatch(cosmeticTutorialRule, /var\(--cosmetic-word-shadow\)/);
  assert.doesNotMatch(cosmeticTutorialRule, /0 0 38px/);
  assert.match(cosmeticStyles, /body[.]simple-ui [.]inventory-word[.]tutorial-hot:focus-visible\s*\{[^}]*outline:\s*2px solid[^}]*outline-offset:\s*3px/);
  assert.doesNotMatch(styles, /[.]board-word[.]tutorial-hot,\s*[.]inventory-word[.]tutorial-hot\s*\{/, "inventory guidance must not inherit the legacy external-glow animation");
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

test("Undo, Redo, Tidy, and Clear stay in a visible quick board toolbar", () => {
  const topHud = page.match(/<div class="board-top-hud"[\s\S]*?<\/div>\s*<div class="board-guide"/)?.[0] || "";
  const tools = page.match(/<nav\b(?=[^>]*\bid="boardQuickTools")[^>]*>[\s\S]*?<\/nav>/i)?.[0] || "";
  assert.match(topHud, /id="boardQuickTools"/);
  assert.match(topHud, /id="runMilestone"/);
  assert.match(tools, /class="board-quick-tools"/);
  assert.doesNotMatch(tools.match(/<nav\b[^>]*>/i)?.[0] || "", /\bhidden\b/i);
  for (const [id, label] of [["undoBoardAction", "Undo"], ["redoBoardAction", "Redo"], ["tidyBoard", "Tidy"], ["resetBoard", "Clear"]]) {
    assert.match(tools, new RegExp(`id="${id}"[\\s\\S]*?<b>${label}<\\/b>`), `${label} must be in the quick toolbar`);
  }
  const pause = page.match(/<dialog\b(?=[^>]*\bid="pauseDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
  for (const id of ["undoBoardAction", "redoBoardAction", "tidyBoard", "resetBoard"]) {
    assert.doesNotMatch(pause, new RegExp(`id="${id}"`), `${id} must not be buried in the pause menu`);
  }
  assert.match(app, /const MAX_BOARD_HISTORY = 30/);
  assert.match(app, /function undoBoardEdit\([\s\S]*boardHistory[.]past[.]pop\(\)[\s\S]*boardHistory[.]future[.]push/);
  assert.match(app, /function redoBoardEdit\([\s\S]*boardHistory[.]future[.]pop\(\)[\s\S]*boardHistory[.]past[.]push/);
  assert.match(app, /els[.]undoBoardAction[.]disabled = boardLocked \|\| !boardHistory[.]past[.]length/);
  assert.match(app, /els[.]redoBoardAction[.]disabled = boardLocked \|\| !boardHistory[.]future[.]length/);
  assert.match(page, /id="undoBoardClear"/);
  assert.match(app, /boardUndoTimer = setTimeout\(dismissClearUndo, 6000\)/);
  assert.match(app, /function undoBoardClear\([\s\S]*undoBoardEdit\(\)/);
  assert.match(app, /const packed = packOrbit\(/);
  assert.match(app, /commitBoardEdit\(before, "tidy words"\)/);
  assert.match(app, /Orbit tidied · score unchanged/);
  assert.match(styles, /[.]board-top-hud\s*\{[^}]*position:\s*absolute[^}]*display:\s*grid[^}]*justify-items:\s*center/);
  assert.match(simpleStyles, /[.]simple-ui [.]board-quick-tools\s*\{[^}]*position:\s*relative[^}]*width:\s*min\(356px, 100%\)/);
  assert.match(simpleStyles, /[.]simple-ui [.]run-milestone\s*\{[^}]*width:\s*min\(580px, 100%\)[^}]*min-width:\s*0/);
  assert.doesNotMatch(simpleStyles, /calc\(100% - 400px\)/, "the board HUD must not depend on a guessed inventory-width offset");
});

test("inventory search and interrupted-run restore are wired into lifecycle persistence", () => {
  assert.match(page, /id="inventorySearch"[^>]+type="search"/);
  assert.match(app, /orderInventory\(state[.]words/);
  assert.match(app, /function buildActiveRunSnapshot\(/);
  assert.match(app, /fetchJson\("\/api\/run\/resume"/);
  assert.match(app, /window[.]addEventListener\("pagehide", (?:flushRunSave|\(\) => \{\s*flushRunSave\(\);)/);
  assert.match(app, /window[.]addEventListener\("pageshow", \(\) => gameAudio[.]setSuspended\(document[.]hidden\)\)/);
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
  const senseFlow = app.slice(senseStart, app.indexOf("function buyStardustSupply", senseStart));
  assert.match(senseFlow, /confirmedBeforeForfeit/);
  assert.match(senseFlow, /visible Open penalty remains and the Compass charge stays spent/);
  assert.match(senseFlow, /state[.]orbitGeneration !== orbitGeneration/);
  assert.match(senseFlow, /const refund = grantSenseCharges\(profile[.]senseWallet, 1\)/);
  assert.match(senseFlow, /if \(!els[.]senseDialog[.]open\) showToast/);
  assert.match(stardustStoreRuntime, /legacyCompassButton[.]disabled = busy \|\| !compassQuote[.]quoted/);
});

test("Help presents a numbered assistance ladder with exact scoring effects", () => {
  const dialog = page.match(/<dialog\b(?=[^>]*\bid="senseDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
  assert.match(dialog, /id="powerupsIntro"/);
  for (const id of ["useQuickTip", "quickTipMessage", "useSense", "useSenseStock", "senseMessage", "useWordGift", "wordGiftMessage"]) {
    assert.match(dialog, new RegExp(`id="${id}"`));
  }
  assert.match(dialog, /Need help[?]/);
  assert.match(dialog, />01<[\s\S]*ROUTE SIGNAL[\s\S]*Next signal keeps 90% of max score and Stardust; Star Credits are reduced too[.]/);
  assert.match(dialog, />02<[\s\S]*STAR COMPASS[\s\S]*OPEN &middot; 75% SCORE[\s\S]*No Route Rank mastery/);
  assert.match(dialog, />03<[\s\S]*WORD GIFT[\s\S]*OPEN &middot; 50% SCORE[\s\S]*No Route Rank mastery/);
  assert.match(dialog, /Show the complete route[\s\S]*Study run with no score/);
  assert.ok(dialog.indexOf('id="useQuickTip"') < dialog.indexOf('id="useSense"'));
  assert.ok(dialog.indexOf('id="useSense"') < dialog.indexOf('id="useWordGift"'));
  assert.ok(dialog.indexOf('id="useWordGift"') < dialog.indexOf('id="revealPathButton"'));
  assert.doesNotMatch(dialog, /class="simple-hidden"[^>]*aria-hidden="true"[\s\S]*id="useSense"/, "Star Compass stays directly usable in the primary ladder");
  assert.match(app, /\$\("#useSense"\)[.]addEventListener\("click", useSenseShortcut\)/);
  assert.match(app, /expiresAt: Date[.]now\(\) \+ 4_000/);
  assert.match(app, /async function useQuickTip\([\s\S]*fetchJson\("\/api\/run\/tip"[\s\S]*tipIndex/);
  assert.match(app, /const confirmedTipsUsed = clamp\(Number\(tip[.]used\)[\s\S]*state[.]powerups[.]tipsUsed = confirmedTipsUsed/);
  assert.match(app, /tipsUsed: clamp\(Number\(state[.]powerups[.]tipsUsed\)/, "Quick Tip use survives interrupted-run restore");
  assert.match(simpleStyles, /[.]powerup-action,[\s\S]*?[.]powerup-buy,[\s\S]*?\)\s*\{[^}]*min-height:\s*52px/);
  assert.match(simpleStyles, /[.]powerup-message\s*\{[^}]*font-size:\s*16px/);
  assert.match(simpleStyles, /@media \(max-width:\s*520px\)[\s\S]*[.]sense-modal/);
});

test("the latest hint remains visible as a compact active-level objective", () => {
  const topHud = page.match(/<div class="board-top-hud"[\s\S]*?<\/div>\s*<div class="board-guide"/)?.[0] || "";
  assert.match(topHud, /id="hintObjective"[^>]+aria-labelledby="hintObjectiveLabel"[^>]+hidden/);
  assert.match(topHud, /id="hintObjectiveLabel">CURRENT HINT</);
  assert.match(topHud, /id="hintObjectiveText"/);
  assert.match(app, /function sanitizeHintObjective\([\s\S]*slice\(0, 240\)/);
  assert.match(app, /function renderHintObjective\([\s\S]*state[.]powerups[?][.]currentTip[\s\S]*!state[.]finished[\s\S]*els[.]hintObjective[.]hidden = !active/);
  assert.match(app, /if \(tip[.]available\)[\s\S]*state[.]powerups[.]currentTip = sanitizeHintObjective\(tip[.]text\)/);
  assert.match(app, /currentTip: sanitizeHintObjective\(state[.]powerups[.]currentTip\)/, "the current hint must survive interrupted-run restore");
  assert.match(app, /state[.]powerups[.]currentTip = sanitizeHintObjective\(progress[.]currentTip \?\? matchingSnapshot[.]currentTip\)/);
  assert.match(app, /state[.]powerups = \{ tipsUsed: 0, tipIds: \[\], currentTip: ""/, "a new challenge clears the old objective");
  assert.match(app, /state[.]finished = true;[\s\S]{0,200}syncPlayPhase\("result"\);[\s\S]{0,120}renderHintObjective\(\)/, "result phase rendering hides the active objective after completion");
  const measured = app.slice(app.indexOf("function measuredPlayableBoardLayout"), app.indexOf("function schedulePlayableBoardRefresh"));
  assert.match(measured, /const topChrome = \[els[.]boardTopHud\]/, "measured placement reserves the complete objective HUD row");
  assert.match(measured, /blockerElements = \[[\s\S]*learningOrbitActive\(\) \? els[.]firstOrbitGuide : null/, "tutorial guidance remains an independent measured blocker");
  assert.match(styles, /[.]hint-objective\s*\{[^}]*width:\s*min\(580px, 100%\)[^}]*max-height:[^}]*overflow:\s*auto/);
  assert.match(simpleStyles, /#gameScreen:is\(\[data-play-layout="stacked"\], \[data-play-layout="short-landscape"\]\) [.]hint-objective\s*\{[^}]*position:\s*relative[^}]*grid-column:\s*1 \/ -1[^}]*grid-row:\s*2[^}]*width:\s*100%/);
  assert.match(simpleStyles, /#gameScreen:is\(\[data-play-phase="reveal"\], \[data-play-phase="cinematic"\]\):is\(\[data-play-layout="stacked"\], \[data-play-layout="short-landscape"\]\) :is\([.]board-guide, #helpNudge, [.]board-bottom-hud\)/);
});

test("the board exposes the four numbered assistance actions and a separate Help handoff", () => {
  const workspaceStart = page.indexOf('<div class="board-workspace-bar"');
  const rail = page.slice(workspaceStart, page.indexOf('<section class="cosmos-board" id="board"', workspaceStart));
  assert.match(rail, /class="board-assistance-rail" id="boardAssistanceRail"[^>]*aria-label="Help tools"/);
  for (const [id, key] of [["quickTipShortcut", 1], ["senseShortcut", 2], ["wordGiftShortcut", 3], ["revealShortcut", 4]]) {
    assert.match(rail, new RegExp(`id="${id}"[^>]*aria-keyshortcuts="${key}"`));
    assert.match(rail, new RegExp(`<kbd[^>]*>${key}<\\/kbd>`));
  }
  assert.match(rail, /id="senseButton"[^>]*aria-controls="senseDialog"[^>]*aria-label="Open Need help information"[\s\S]*<b class="assist-rail-label">Need help[?]<\/b>/);
  const assistanceRailTag = rail.match(/<nav class="board-assistance-rail"[^>]*>/)?.[0] || "";
  assert.match(assistanceRailTag, /\shidden(?:\s|>)/, "the Help disclosure starts collapsed to preserve canvas space");
  assert.match(rail, /id="mobileAssistToggle"[^>]*aria-expanded="false"[^>]*aria-controls="boardAssistanceRail"/);
  assert.match(app, /quickTipShortcutCount[.]textContent = tipsRemaining > 0 [^;]* : "[+]"/);
  assert.match(app, /wordGiftShortcutCount[.]textContent = state[.]powerups[.]giftUsed [^;]* : "[+]"/);
  assert.match(app, /senseShortcutCount[.]textContent = senseCount > 0 [^;]* : "[+]"/);
  assert.match(app, /revealShortcutCount[.]textContent = state[.]reveal[.]revealed [^;]* : "∞"/);
  assert.match(app, /function activateOpenPowerupShortcut\(kind, action\)[\s\S]*activeArmedPowerup\(\) === kind[\s\S]*keeps [^`]+ score in Open/);
  assert.match(app, /if \(!els[.]senseDialog[.]open\) showAlchemy\(`HINT/);
  assert.match(app, /async function openPowerupShop\(\{ focusItem = "", trigger = null \} = \{\}\)[\s\S]*els[.]senseDialog[.]close\(\)[\s\S]*els[.]stardustDialog[.]showModal\(\)[\s\S]*focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /onProfileChange: \(\) => \{[\s\S]*saveProfile\(\{ fields: \["progression"\] \}\);[\s\S]*renderProfile\(\)/);
  assert.match(stardustStoreRuntime, /async function purchase\(itemId\)[\s\S]*applyStardustPurchase\(before, itemId, 1\)[\s\S]*await onProfileChange/);
  assert.match(app, /wordGiftShortcut[.]addEventListener\("click", useWordGiftRailShortcut\)/);
  assert.match(app, /senseShortcut[.]addEventListener\("click", useSenseRailShortcut\)/);
  assert.match(app, /revealShortcut[.]addEventListener\("click", useRevealRailShortcut\)/);
  assert.match(simpleStyles, /[.]simple-ui [.]board-assistance-rail\s*\{[^}]*position:\s*absolute[^}]*flex-direction:\s*column/);
  assert.match(simpleStyles, /[.]simple-ui :is\([.]assist-rail-action, [.]assist-rail-info\)\s*\{[^}]*min-height:\s*var\(--assist-rail-size\)/);
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
  assert.match(giftSource, /Try again to add the same word/);
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
  assert.match(app, /els[.]lawPill[.]textContent = `[^`]*\$\{scoreMultiplierPercent\(state[.]scoreMultiplier\)\}% SCORE`/);
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

test("the home screen explains the loop, presents one next action, and reveals rank-gated game catalogs", () => {
  assert.match(page, /<button\b(?=[^>]*id="primaryOrbitButton")(?=[^>]*class="[^"]*primary-orbit-button)/);
  assert.equal((page.match(/\bid="primaryOrbitButton"/g) || []).length, 1);
  assert.match(page, /id="primaryOrbitSecondary"/);
  assert.match(page, /Combine two ideas to discover something new[.] Keep going until you create the target word[.]/);
  assert.match(page, /aria-label="Example: Earth plus Water makes Mud"/);
  assert.match(page, /class="home-vfx" aria-hidden="true"/);
  assert.match(page, /id="startTitle"[\s\S]*Make worlds[\s\S]*out of words[.]/);
  assert.match(page, /hero-recipes[.]mjs[?]v=/);
  assert.match(page, /<section\b(?=[^>]*id="modePicker")(?=[^>]*class="[^"]*home-catalog)(?=[^>]*data-progressive="secondary")/);
  assert.match(page, /<section\b(?=[^>]*id="adventuresHub")(?=[^>]*class="[^"]*home-catalog)(?=[^>]*data-progressive="adventure")/);
  assert.doesNotMatch(page, /<details\b[^>]*id="(?:modePicker|exploreHub|adventuresHub)"/);
  assert.match(page, /id="hubMenuButton"[^>]+aria-controls="hubMenuDialog"/);
  assert.match(page, /id="hubMenuDialog"[^>]+aria-labelledby="hubMenuTitle"/);
  assert.match(page, /data-progressive="progress"/);
  assert.match(app, /createHomeMenuState/);
  assert.match(app, /function homeMenuState\(\)/);
  assert.match(app, /function syncProgressiveDisclosure\(\)/);
  assert.match(homeMenuView, /classList[.]toggle\("first-session", !menu[.]onboardingComplete\)/);
  assert.match(homeMenuView, /classList[.]toggle\(`\$\{state\}-ready`, menu\[`\$\{state\}Ready`\]\)/);
  assert.match(homeMenuView, /classList[.]toggle\("training-needed", !trainingCompleted\)/);
  assert.match(app, /primaryOrbitButton["']\)[.]addEventListener\("click", beginPrimaryOrbit\)/);
  assert.match(app, /primaryOrbitSecondary["']\)[.]addEventListener\("click", beginPrimarySecondary\)/);
  assert.match(styles, /body[.]first-session \[data-progressive="secondary"\]/);
  assert.match(styles, /body:not\([.]adventures-ready\) \[data-progressive="adventure"\]/);
  assert.match(styles, /body[.]simple-ui:is\([.]choices-ready, [.]explore-ready, [.]adventures-ready\) #startScreen [.]start-content\s*\{\s*justify-content:\s*flex-start/);
  assert.match(styles, /[.]home-catalog\s*\{[^}]*width:\s*100%[^}]*margin-top:\s*16px[^}]*overflow:\s*hidden/);
  assert.match(styles, /@media \(min-width:\s*901px\)[\s\S]*body[.]simple-ui #startScreen [.]explore-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,1fr\)\)/);
  assert.match(styles, /[.]primary-orbit-button\s*\{[^}]*min-height:\s*60px/);
});

test("menus keep readable cards and separate next, replay, and main-menu actions", () => {
  const hubDialog = page.match(/<dialog\b(?=[^>]*id="hubMenuDialog")[\s\S]*?<\/dialog>/)?.[0] || "";
  const resultDialog = page.match(/<dialog\b(?=[^>]*id="resultDialog")[\s\S]*?<\/dialog>/)?.[0] || "";
  assert.match(hubDialog, /id="hubMenuTitle">Menu</);
  assert.match(hubDialog, /id="hubMenuSettingsTitle">Settings and data[\s\S]*id="openObservatory"/);
  assert.match(hubDialog, /profile-preferences[\s\S]*profile-data/);
  assert.match(simpleStyles, /[.]simple-ui [.]hub-menu-grid > [.]hub-menu-action\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*42px minmax\(0,\s*1fr\) 18px/);
  assert.match(simpleStyles, /@media \(max-width:\s*760px\)[\s\S]*[.]simple-ui [.]hub-menu-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
  for (const id of ["resultRetry", "resultReplay", "resultPrimary"]) assert.match(resultDialog, new RegExp(`id="${id}"`));
  assert.doesNotMatch(resultDialog, /resultNextOptions|Next challenge starts with|data-start-style|Same 4|New mix/);
  assert.match(app, /function nextStartStyleDecision\([\s\S]*preference:\s*"auto"/);
  assert.match(app, /startStyle:\s*"auto"/);
  assert.doesNotMatch(app, /startStylePreference|chooseStartStyle|syncStartStyleControls|data-start-style/);
  assert.doesNotMatch(simpleStyles, /start-style-control|start-style-options/);
  assert.match(app, /async function replayFinishedChallenge\([\s\S]*const sourceRun = state[.]run[\s\S]*fetchJson\("\/api\/run\/replay"[\s\S]*runId:\s*sourceRun[.]id[\s\S]*isReplayResponseCurrent\([\s\S]*startWithGame\(payload[.]game, payload[.]run,\s*\{\s*enterThroughGate:\s*true\s*\}\)/);
  assert.match(app, /resultReplay["']\)[.]addEventListener\("click", replayFinishedChallenge\)/);
  assert.match(app, /async function submitRankedScore\([\s\S]*resultCanReplayTarget = adaptiveSeriesEligible\(\)[\s\S]*els[.]resultReplay[.]hidden = !resultCanReplayTarget/);
  assert.match(simpleStyles, /@media \(max-height:\s*520px\) and \(min-width:\s*521px\)[\s\S]*[.]result-actions\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(170px,\s*1fr\)\)/);
});

test("seeing or skipping training never unlocks the full home shell by itself", () => {
  assert.match(app, /function firstSessionUnlocked\(\)\s*\{\s*return homeMenuState\(\)[.]onboardingComplete/);
  assert.doesNotMatch(app, /function firstSessionUnlocked\(\)[\s\S]{0,180}training[.]seen/);
  assert.match(app, /function beginPrimarySecondary\(\)[\s\S]*action === "reach"[\s\S]*rememberFirstOrbitSeen\(\)[\s\S]*beginMode\("reach"/);
  assert.match(app, /function skipFirstOrbit\(\)[\s\S]*rememberFirstOrbitSeen\(\)[\s\S]*returnHome\(\)/, "in-board Skip must return to a real choice");
  assert.doesNotMatch(page, /id="firstOrbitDialog"/, "first use should not be blocked by a redundant welcome dialog");
});

test("opening the Gold game catalog uses the contained Forge sheet and restores focus", () => {
  const source = app.slice(app.indexOf("function openModePicker()"), app.indexOf("async function beginPrimarySecondary()"));
  assert.match(source, /homeMenuState\(\)[.]choicesReady/);
  assert.match(source, /getHomeOrbitController\(document\)[?][.]openCatalog/);
  assert.match(source, /trigger:\s*\$\("#primaryOrbitSecondary"\)/);
  assert.match(source, /focus:\s*true/);
  assert.doesNotMatch(source, /scrollIntoView/);
  assert.match(homeMenuView, /function closeCatalog\([^]+restoreFocus[^]+focusAfterPaint\(catalogOpener\)/);
});

test("relaxed Reach suppresses the race ghost and leaderboards retain exact challenge identity", () => {
  const ghostEligibility = app.slice(app.indexOf("function competitiveGhostEligible"), app.indexOf("function renderGhostPreview"));
  assert.match(ghostEligibility, /!\["training", "second-orbit", "explore", "reach"\][.]includes\(state[.]mode\)/);
  assert.match(app, /const challengeId = state[.]game[?][.]challengeId \|\| state[.]run[?][.]challengeId/);
  assert.match(app, /params[.]set\("challengeId", String\(challengeId\)\)/);
});

test("local diagnostics are bounded aggregates and players can export or reset their data", () => {
  const tracking = app.slice(app.indexOf("function track("), app.indexOf("function primeFeedbackAudio"));
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
  const returnHome = app.slice(app.indexOf("function returnHome("), app.indexOf("async function beginPrimaryOrbit"));
  const pointerCleanup = app.slice(app.indexOf("function cancelActivePointerGestures()"), app.indexOf("function pointInsideBoard"));
  assert.match(returnHome, /const showRecoveryAfterExit = Boolean\(state[.]finished && state[.]recoveryKit[?][.]code && profile[.]wins > 0\)/);
  assert.match(returnHome, /if \(showRecoveryAfterExit\) showRecoveryKit\(\)/);
  assert.doesNotMatch(pointerCleanup, /showRecoveryAfterExit/);
});

test("Dev Logs exposes the complete accessible, readable, responsive update history", () => {
  const button = page.match(/<button\b(?=[^>]*\bid="updatesButton")[^>]*>[\s\S]*?<\/button>/i)?.[0] || "";
  assert.ok(button, "the updates trigger is present");
  assert.match(button, /\baria-haspopup="dialog"/i);
  assert.match(button, /\baria-controls="updatesDialog"/i);
  assert.ok(
    button.includes(`What's new in ${releaseVersion.split(".").slice(0, 2).join(".")}`),
    "the updates trigger names the current major/minor release"
  );

  const dialog = page.match(/<dialog\b(?=[^>]*\bid="updatesDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
  assert.ok(dialog, "the updates dialog is present");
  assert.match(dialog.match(/<dialog\b[^>]*>/i)?.[0] || "", /\baria-labelledby="updatesTitle"/i);
  assert.match(dialog, /id="updatesTitle"/i);
  assert.match(dialog, /data-close="updatesDialog"/i);
  assert.equal((dialog.match(/\bdata-update-entry(?:=|\s|>)/gi) || []).length, 24, "the update log retains all twenty-four updates");
  for (const label of ["Release", "Ctrl", "Shift", "Route Signals", "Living Atlas", "Signature Constellations", "Path Becomes the Game", "Clearer Play, Better Answers", "A Journey That Learns How You Play", "One Play, a Growing Universe", "The Cosmic Gate Opens", "Results Stay With You", "The Cosmos Comes Into Focus", "A New Sky Between Worlds", "Little Games Between Worlds", "A Thought Between Worlds", "One Tap to the Stars", "A Gentle First Light", "A Clearer Finish", "First Paths, Shared Skies", "Your Ideas Can Reach Us", "Shape Your Constellation", "Scramble Arena", "Continuous Deep Space"]) assert.match(dialog, new RegExp(`\\b${label}\\b`, "i"));
  assert.match(dialog, /24 UPDATES/i);
  assert.equal((dialog.match(/\bis-latest\b/gi) || []).length, 1, "the log has exactly one latest entry");
  assert.equal((dialog.match(/>LATEST</gi) || []).length, 1, "the log has exactly one latest badge");
  const latest = dialog.match(/<li\b(?=[^>]*\bis-latest\b)[^>]*>[\s\S]*?<\/li>/i)?.[0] || "";
  assert.ok(latest, "the log identifies its latest entry");
  assert.ok(latest.toUpperCase().includes(`VERSION ${releaseVersion.toUpperCase()}`));
  assert.match(latest, /Continuous Deep Space[\s\S]*Earth and Moon[\s\S]*stable physical pivot[\s\S]*precision rebase/i);
  assert.match(latest, /Solar, nearby-star, deep-sky, Milky Way, Local Group[\s\S]*logarithmic crossfades[\s\S]*Constellation paths and cosmic filaments/i);
  assert.match(latest, /collision-aware stellar labels[\s\S]*distance-faded world grid[\s\S]*physical projection/i);
  assert.match(latest, /Milky Way continues outward[\s\S]*cosmic web[\s\S]*observable universe[\s\S]*outside the interaction-critical bundle/i);
  assert.match(dialog, /Scramble Arena[\s\S]*Live 1v1 has arrived[\s\S]*three-second countdown/i);
  assert.match(dialog, /private matches never affect rating[\s\S]*separate seasonal 1v1 Rating/i);
  assert.match(dialog, /Phones keep your own board primary[\s\S]*rival ticker[\s\S]*full rival-board toggle/i);
  assert.match(dialog, /Pages and itch remain fully local and offline for solo play[\s\S]*Only Scramble uses the live service/i);
  assert.match(dialog, /Shape Your Constellation[\s\S]*eight complete collections[\s\S]*Pixel Frontier[\s\S]*Bubble Reef[\s\S]*Stellar Vanguard[\s\S]*Eclipse Sovereign/i);
  assert.match(dialog, /Locked looks can be previewed[\s\S]*responsive collection art now loads on demand/i);
  assert.match(dialog, /Your Ideas Can Reach Us[\s\S]*free, anonymous feedback receiver/i);
  assert.match(dialog, /saved locally first[\s\S]*offline retry queue/i);
  assert.match(dialog, /Golden 50[\s\S]*three-to-seven-combination routes/i);
  assert.match(dialog, /contextual, spoiler-safe constellation card[\s\S]*target and seed/i);
  assert.match(dialog, /first ten completed games[\s\S]*advanced ranks, competition, mastery, and economy/i);
  assert.match(dialog, /One Tap to the Stars/i, "the 3.4.6 title remains in history");
  assert.match(dialog, /Pages and itch are deterministic local practice without live rankings, accounts, or AI/i);
  assert.match(dialog, /Beta progress may reset/i);

  assert.match(app, /[$]\(["']#updatesButton["']\)[.]addEventListener\(["']click["']/);
  assert.match(app, /(?:[$]\(["']#updatesDialog["']\)|els[.]updatesDialog)[\s\S]{0,160}?[.]showModal\(\)/);

  const metadataRule = styles.match(/[.]updates-meta\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(metadataRule, /font-size:\s*15px/, "update metadata stays at the 15px readability floor");
  const closeRule = styles.match(/[.]updates-modal\s+[.]modal-close\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(closeRule, /width:\s*44px/);
  assert.match(closeRule, /height:\s*44px/);
  assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*[.]updates-(?:button|modal|trigger)/, "updates UI has a mobile-specific layout rule");
});

test("the in-game objective prompt has one plain instruction and one action", () => {
  const dialog = page.match(/<dialog\b(?=[^>]*id="missionBriefingDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
  assert.ok(dialog, "the objective prompt exists");
  assert.match(dialog, /aria-labelledby="missionBriefingTitle"/);
  assert.match(dialog, /aria-describedby="missionBriefingRule"/);
  assert.doesNotMatch(dialog.match(/<dialog\b[^>]*>/i)?.[0] || "", /missionBriefingScoreDetail/);

  const dataStart = dialog.indexOf('<div class="mission-briefing-data"');
  const actionsStart = dialog.indexOf('<div class="mission-actions">');
  assert.ok(dataStart > 0 && actionsStart > dataStart, "legacy data is kept outside the visible prompt");
  const visiblePrompt = dialog.slice(0, dataStart);
  const hiddenData = dialog.slice(dataStart, actionsStart);
  const actions = dialog.slice(actionsStart);

  assert.match(visiblePrompt, /<h2 id="missionBriefingTitle"><span id="missionBriefingVerb">Make<\/span> <strong id="missionBriefingTarget">/);
  assert.match(visiblePrompt, /<p class="mission-win-rule" id="missionBriefingRule">/);
  assert.match(visiblePrompt, /<p class="mission-constraint" id="missionBriefingConstraint" hidden>/);
  assert.match(app, /missionConstraint[.]hidden = !game[.]timeLimit && !game[.]moveLimit/);
  assert.match(app, /missionConstraint[.]textContent = missionConstraint[.]hidden \? "" : `\$\{briefing[.]limitValue\} \$\{briefing[.]limitDetail\}`/);
  assert.match(app, /Pairs that leave the route are blocked[.] Your words stay on the board and no move is used[.]/);
  const guardNote = simpleStyles.match(/[.]simple-ui #missionBriefingDialog [.]mission-adaptive-note[.]path-guard-note\s*\{[^}]*\}/)?.[0] || "";
  assert.match(guardNote, /width:\s*auto/);
  assert.match(guardNote, /max-width:\s*100%/);
  assert.match(guardNote, /min-width:\s*0/);
  assert.match(guardNote, /white-space:\s*normal/);
  assert.match(visiblePrompt, /id="missionAdaptiveNote" hidden>Difficult/);
  assert.doesNotMatch(visiblePrompt, /missionBriefing(?:Clue|Start|Starters|Reward|Score|Law|Limit)|missionRemix|mission-details/);

  assert.match(hiddenData, /class="mission-briefing-data" hidden aria-hidden="true"/);
  for (const id of [
    "missionBriefingClue", "missionBriefingStart", "missionBriefingStarters",
    "missionBriefingReward", "missionBriefingScore", "missionBriefingLaw",
    "missionBriefingLimit", "missionRemixSummary"
  ]) assert.match(hiddenData, new RegExp(`id="${id}"`));
  assert.doesNotMatch(dialog, /<details\b/i);

  assert.match(actions, /id="missionBriefingStatus"[^>]+aria-live="polite"/);
  assert.match(actions, /<button class="primary-action" id="beginMission" type="button"><span>Start<\/span>/);
  assert.match(actions, /<button id="cancelMission" type="button" hidden tabindex="-1">Back<\/button>/);
  assert.equal((actions.match(/<button\b/g) || []).length, 2, "only Start and its hidden compatibility exit exist");

  assert.match(page, /id="primaryOrbitDescription"[^>]*>Combine Earth and Water to discover your first word[.][\s\S]*id="primaryOrbitMeta">Mud · 1 combination/);
  const missionLayout = simpleStyles.match(/[.]simple-ui [.]mission-briefing-modal\s*\{[^}]*\}/)?.[0] || "";
  assert.match(missionLayout, /position:\s*fixed/);
  assert.match(missionLayout, /inset:\s*auto/);
  assert.match(missionLayout, /top:\s*50%/);
  assert.match(missionLayout, /left:\s*50%/);
  assert.match(missionLayout, /height:\s*fit-content/);
  assert.match(missionLayout, /margin:\s*0/);
  assert.match(missionLayout, /transform:\s*translate\(-50%,\s*-50%\)/);
  assert.doesNotMatch(missionLayout, /inset:\s*0/);
  assert.match(missionLayout, /width:\s*min\(470px,[^}]*max-height:[^}]*border-radius:\s*16px/);
  assert.match(simpleStyles, /[.]mission-briefing-modal\[open\]\s*\{[^}]*display:\s*flex[^}]*overflow:\s*hidden/);
  assert.match(simpleStyles, /[.]mission-scroll\s*\{[^}]*flex:\s*0 1 auto[^}]*overflow-y:\s*auto/);
  assert.match(simpleStyles, /[.]mission-target-lockup h2\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(simpleStyles, /[.]mission-briefing-data\[hidden\],[\s\S]*#cancelMission\[hidden\]\s*\{[^}]*display:\s*none !important/);
  assert.match(simpleStyles, /[.]mission-status:empty\s*\{[^}]*display:\s*none/);
});

test("Rival Ghost requests are cancelled and stale responses cannot start races", () => {
  assert.match(app, /requestController = new AbortController\(\)/);
  assert.match(app, /state[.]ghost[.]requestController[?][.]abort\(\)/);
  assert.match(app, /requestGeneration !== state[.]ghost[.]requestGeneration/);
  assert.match(app, /!profile[.]rivalGhostEnabled/);
});

test("all haptics pass through the feedback preference policy", () => {
  assert.equal((app.match(/navigator[.]vibrate/g) || []).length, 0, "app interactions must delegate vibration to the audio runtime");
  assert.equal((audioRuntime.match(/navigator[?][.]vibrate|navigator[.]vibrate/g) || []).length, 2, "one capability check and one centralized vibration call should remain");
  assert.doesNotMatch(`${app}\n${audioRuntime}`, /navigator[.]vibrate\(\[10, 18, 10\]\)/);
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
  assert.match(app, /els[.]rivalGhost, els[.]ghostPreview, els[.]boardAssistanceRail, document[.]querySelector\("[.]board-quick-tools"\)/);
  const tidySource = app.slice(app.indexOf("function tidyOrbit"), app.indexOf("function boardNodesOverlap"));
  assert.match(tidySource, /const playable = measuredPlayableBoardLayout\(boardRect\)/);
  assert.match(tidySource, /mobilePlayShellActive\(\)\s*[?]\s*\{ left: playable[.]left, top: playable[.]top, width: Math[.]max\(1, playable[.]width\), height: Math[.]max\(1, playable[.]height\), gap: 10 \}/);
  assert.match(tidySource, /packOrbitAroundOverlays\(measured, packBounds, mobilePlayShellActive\(\) \? playable[.]blockers : visibleBoardOverlayRectangles\(boardRect\)\)/);
  const placementSource = app.slice(app.indexOf("function placeFromTray"), app.indexOf("function traySourceFor"));
  assert.match(placementSource, /const playable = measuredPlayableBoardLayout\(rect\)/);
  assert.match(placementSource, /const worldLayout = boardWorldLayout\(rect, playable\)/);
  assert.match(placementSource, /concat\(worldLayout[.]blockers\)/);
  assert.match(placementSource, /findOpenSpawn\([\s\S]*left: worldLayout[.]left, top: worldLayout[.]top, width: Math[.]max\(1, worldLayout[.]width\), height: Math[.]max\(1, worldLayout[.]height\)/);
  const nudgeSource = app.slice(app.indexOf("function moveBoardNodeOutsideOverlays"), app.indexOf("function packOrbitAroundOverlays"));
  assert.match(nudgeSource, /layout = measuredPlayableBoardLayout\(boardRect\)/);
  assert.match(nudgeSource, /const worldLayout = boardWorldLayout\(boardRect, layout\)/);
  assert.match(nudgeSource, /const overlays = worldLayout[.]blockers/);
  assert.match(nudgeSource, /findOpenSpawn\([\s\S]*\[...occupied, ...overlays\][\s\S]*\{ left: worldLayout[.]left, top: worldLayout[.]top, width: Math[.]max\(1, worldLayout[.]width\), height: Math[.]max\(1, worldLayout[.]height\) \}/);
  assert.match(app, /if \(moved && !resolution[?][.]selected\) moveBoardNodeOutsideOverlays\(node, element, boardRect, \{ width: nodeWidth, height: nodeHeight \}, playable\)/, "manual drops must also stay inside the measured playable board");
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
  const duplicateStart = app.indexOf("function duplicateShiftBoardNode");
  const duplicateEnd = app.indexOf("function handleShiftBoardEnter", duplicateStart);
  const duplicateSource = app.slice(duplicateStart, duplicateEnd);
  assert.match(duplicateSource, /const playable = measuredPlayableBoardLayout\(boardRect\)/);
  assert.match(duplicateSource, /const worldLayout = boardWorldLayout\(boardRect, playable\)/);
  assert.match(duplicateSource, /x: clamp\([^\n]+worldLayout[.]left[^\n]+worldLayout[.]right - width\)/);
  assert.match(duplicateSource, /y: clamp\([^\n]+worldLayout[.]top[^\n]+worldLayout[.]bottom - height\)/);
  assert.match(duplicateSource, /const copyElement = createBoardNode\(copy, true\);\s*els[.]boardItems[.]append\(copyElement\)/);
  assert.match(duplicateSource, /moveBoardNodeOutsideOverlays\(copy, copyElement, boardRect, copyBounds, playable\)/);
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
  assert.match(app, /function measureBoardWord\(item\)[\s\S]*className = "board-word board-word-measure"[\s\S]*probe[.]offsetWidth[\s\S]*probe[.]offsetHeight/);
  assert.match(traySource, /dragSize = measureBoardWord\(item\)/, "Shift spacing must use the real board-chip size");
  assert.match(app, /function captureDropGeometry\([^)]*\)\s*\{[\s\S]*version: boardGeometryVersion[\s\S]*boardRect[\s\S]*playable: measuredPlayableBoardLayout\(boardRect\)[\s\S]*candidates: eligibleDropCandidates/);
  assert.match(app, /function refreshDropGeometry\(geometry, excludeId = null\)[\s\S]*geometry[?][.]version === boardGeometryVersion \? geometry : captureDropGeometry\(excludeId\)/);
  assert.match(app, /function pointInsideBoard\(point, cachedRect = null, cachedPlayable = null\)[\s\S]*const playable = cachedPlayable \|\| measuredPlayableBoardLayout\(rect\)/);
  assert.match(app, /function trayShiftBoardPoint\(point, size, cachedRect = null, cachedPlayable = null\)[\s\S]*const playable = cachedPlayable \|\| measuredPlayableBoardLayout\(rect\)/);
  assert.match(traySource, /dropGeometry = refreshDropGeometry\(dropGeometry\)[\s\S]*trayShiftBoardPoint\(point, dragSize, dropGeometry[.]boardRect, dropGeometry[.]playable\)[\s\S]*shiftBoard[.]reanchorDrag\(boardPoint\)[\s\S]*shiftBoard[.]moveDrag\(boardPoint\)/);
  assert.match(traySource, /if \(dragging\) updateShiftTrail\(lastPoint\)[\s\S]*cleanup\(\)[\s\S]*dropTrayItem/, "pointer-up must flush the final Shift segment before drop resolution");
  assert.match(traySource, /shiftBoard[.]endDrag\(\)[\s\S]*activeTrayShiftSource = null/);
  assert.match(traySource, /pointInsideBoard\(lastPoint, dropGeometry[?][.]boardRect, dropGeometry[?][.]playable\)/);
  assert.match(traySource, /const placement = shouldDrop && dragSize \? \{ boardPoint: trayShiftBoardPoint\(lastPoint, dragSize, dropGeometry[?][.]boardRect, dropGeometry[?][.]playable\), size: dragSize \} : \{\}/);
  assert.match(traySource, /if \(shouldDrop\) placement[.]geometry = dropGeometry/);
  assert.match(traySource, /if \(shouldDrop\) dropTrayItem\(item, lastPoint, pointerType, placement\)/);
  assert.match(app, /function dropTrayItem\(item, point, pointerType = "mouse", placement = \{\}\)[\s\S]*refreshDropGeometry\(placement[.]geometry\)[\s\S]*pointInsideBoard\(point, geometry[.]boardRect, geometry[.]playable\)/);
  assert.match(app, /function placeFromTray\(item, point, placement = \{\}\)[\s\S]*const playable = measuredPlayableBoardLayout\(rect\)[\s\S]*boardPoint[\s\S]*measuredSize[\s\S]*addNode\(item, x, y, measuredSize \? \{ size: measuredSize, inset: 5 \} : \{\}\)/);
  assert.match(app, /function addNode\(item, x, y, options = \{\}\)[\s\S]*const playable = measuredPlayableBoardLayout\(boardRect\)[\s\S]*const \{ size, inset: requestedInset, [.][.][.]nodeOptions \} = options[\s\S]*const safeX[\s\S]*const safeY[\s\S]*-1_000_000 \+ inset[\s\S]*1_000_000 - width - inset/);
  assert.match(app, /resolveDropCandidate\([\s\S]*sourceElement: element[\s\S]*if \(resolution[?][.]selected\) void combineNodes\(node, resolution[.]selected\)/);
  assert.match(styles, /[.]cosmos-board[.]shift-remove-active/);
  assert.match(styles, /[.]cosmos-board[.]shift-stamp-active/);
  assert.match(styles, /[.]board-word[.]shift-stamped/);
});

test("board notices and interactive prompts share one collision-free bottom lane", () => {
  const hud = page.match(/<div class="board-bottom-hud"[\s\S]*?<\/div>\s*<section class="reveal-controller"/)?.[0] || "";
  for (const id of ["tapChainStatus", "boardUndo", "recipeFeedback", "expectedPairFeedback", "alchemyNote"]) assert.match(hud, new RegExp(`id="${id}"`));
  assert.match(hud, /id="alchemyNote"[^>]+aria-hidden="true"/);
  assert.match(page, /id="boardAnnouncement"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(styles, /[.]board-bottom-hud\s*\{[^}]*position:\s*absolute[^}]*inset:\s*auto 18px max\(18px, env\(safe-area-inset-bottom\)\)[^}]*max-height:\s*calc\(100% - 132px\)[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*overflow:\s*auto/);
  for (const selector of [".tap-chain-status, .board-undo", ".alchemy-note", ".recipe-feedback"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rule = styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || "";
    assert.doesNotMatch(rule, /\bbottom\s*:/, `${selector} must be positioned by the shared lane`);
  }
  const masteryStart = app.indexOf("function recordMasteryStep");
  const masteryEnd = app.indexOf("function founderCosmeticsOwned", masteryStart);
  assert.doesNotMatch(app.slice(masteryStart, masteryEnd), /showToast\(/, "mastery should return a follow-up notice instead of opening a second toast");
  assert.match(app, /showAlchemy\(result[.]twisted[\s\S]*queueAlchemyNotice\(mastery[.]notice/);
  assert.match(app, /queueAlchemyNotice\(mastery[.]notice, false, false, \{ key: `mastery:[^`]+`, retain: true/);
  assert.match(app, /if \(els[.]recipeFeedback && !els[.]recipeFeedback[.]hidden\) resetRecipeFeedback\(\)/, "a queued mastery must not cancel hidden pending feedback");
  assert.match(app, /activeBoardNotice[?][.]retain[\s\S]*enqueueBoardNotice\(activeBoardNotice\)/);
  assert.match(app, /resultMasteryCard[.]hidden = !won \|\| !state[.]resultMasteryNotice/);
  assert.match(styles, /[.]alchemy-note\s*\{[^}]*display:\s*none/);
  assert.match(styles, /[.]alchemy-note\s*\{[^}]*width:\s*max-content[^}]*overflow-wrap:\s*anywhere[^}]*text-align:\s*center/);
  assert.match(styles, /[.]alchemy-note[.]show\s*\{[^}]*display:\s*block/);
  assert.match(styles, /[.]cosmos-board:has\([.]board-undo:not\(\[hidden\]\)\) [.]board-guide/);
  assert.doesNotMatch(app, /document[.]querySelector\("[.]board-bottom-hud"\)/, "collision avoidance must use visible HUD children, not the full-width wrapper");
  assert.match(app, /function showToast\([\s\S]*boardCanOwnNotice[\s\S]*showAlchemy\(message\)/);
  const clearSource = app.slice(app.indexOf("function clearBoardWithUndo"), app.indexOf("function undoBoardClear"));
  assert.doesNotMatch(clearSource, /showAlchemy\(/, "the clear Undo control must not be duplicated by a second visible notice");
  assert.match(clearSource, /announceBoardMessage\("Board cleared[.] Use Undo/);
  const tapSource = app.slice(app.indexOf("async function selectNodeForTap"), app.indexOf("function placeFromTray"));
  assert.doesNotMatch(tapSource, /showAlchemy\(`[$]\{[^}]+[}] (?:armed|remains armed)/, "the tap-chain control must own its visible status");
  const expectedPairSource = app.slice(app.indexOf("function offerExpectedPairFeedback"), app.indexOf("async function submitExpectedPairFeedback"));
  assert.match(expectedPairSource, /clearBoardNotices\(\)/, "the expected-pair form must replace the transient error instead of stacking over it");
});
