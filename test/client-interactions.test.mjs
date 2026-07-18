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

test("tap chains are discoverable, cancellable, and work from the inventory", () => {
  assert.match(page, /id="tapChainStatus"[^>]+aria-live="polite"/);
  assert.match(page, /id="cancelTapChain"/);
  assert.match(app, /async function selectNodeForTap\(/);
  assert.match(app, /async function activateTrayItem\(item\)/);
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
  assert.match(app, /const pendingRankedSubmit = Boolean\(won && !assisted && !skipSubmit && state[.]run[?][.]ranked\)/);
  assert.match(app, /if \(pendingRankedSubmit\) saveCompletedRunSnapshot\(\)/);
  const submitSuccess = app.indexOf('if (!result.ranked) throw new Error');
  const clearAfterSuccess = app.indexOf('clearActiveRunSnapshot();', submitSuccess);
  assert.ok(submitSuccess >= 0 && clearAfterSuccess > submitSuccess, "the pending snapshot is cleared only after a verified response");
});

test("Sense fails closed on an ambiguous network response", () => {
  const senseStart = app.indexOf("async function useConstellationSense()");
  const localCommit = app.indexOf("profile.senseWallet = preview.wallet", senseStart);
  const request = app.indexOf('await fetchJson("/api/run/sense"', senseStart);
  assert.ok(localCommit > senseStart && localCommit < request, "the charge and fair-play forfeit commit before the request");
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /confirmedBeforeForfeit/);
  assert.match(app.slice(senseStart, app.indexOf("function buySenseCharge", senseStart)), /this orbit remains assisted and the Sense charge stays spent/);
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
