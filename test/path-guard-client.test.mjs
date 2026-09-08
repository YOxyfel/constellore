import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createInitialAppState } from "../public/initial-app-state.mjs";
import { pathGuardPairKey } from "../public/path-guard.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const guidedPlay = await readFile(new URL("../public/guided-play-app.mjs", import.meta.url), "utf8");
const conceptMatterApp = await readFile(new URL("../public/concept-matter-app.mjs", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

function sourceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing source marker: ${start}`);
  assert.ok(to > from, `missing source marker after ${start}: ${end}`);
  return source.slice(from, to);
}

function cssBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || "";
}

test("wrong_path uses the non-punitive client branch and remembered pairs bypass a second request", () => {
  const combine = sourceBetween(app, "async function combineNodes", "function expectedPairKey");
  const preflightAt = combine.indexOf("pathGuardPairWasRemembered(a.item.word, b.item.word)");
  const busyAt = combine.indexOf("state.busyPairs.add(a.id)");
  const requestAt = combine.indexOf('fetchJson("/api/combine"');

  assert.ok(preflightAt >= 0, "remembered pairs need a client preflight");
  assert.ok(preflightAt < busyAt, "preflight must run before words become busy");
  assert.ok(preflightAt < requestAt, "preflight must run before /api/combine");

  const preflight = combine.slice(
    combine.indexOf("if (!scrambleActive && chemistryDecision.classification === \"free\" && pathGuardPairWasRemembered"),
    busyAt
  );
  assert.match(preflight, /showPathGuardFeedback\([\s\S]*remembered:\s*true/);
  assert.match(preflight, /track\("path_guard_remembered"/);
  assert.match(
    preflight,
    /return\s*\{[\s\S]*rejected:\s*true[\s\S]*code:\s*"wrong_path"[\s\S]*wrongPath:\s*true[\s\S]*remembered:\s*true[\s\S]*message/
  );
  assert.doesNotMatch(preflight, /fetchJson|combineStart|busyPairs[.]add/);

  const rejected = sourceBetween(combine, "} catch (error) {", "} finally {");
  assert.match(rejected, /error[.]code === "wrong_path"/);
  assert.match(rejected, /rememberPathGuardPair\(a[.]item[.]word, b[.]item[.]word\)/);
  assert.match(rejected, /const pathGuardMessage = wrongPath[\s\S]*showPathGuardFeedback/);
  assert.match(rejected, /if \(!wrongPath\) showAlchemy/);
  assert.match(rejected, /if \(wrongPath\) \{[\s\S]*track\("path_guard_blocked"/);
  assert.match(
    rejected,
    /if \(wrongPath\) \{[\s\S]*return\s*\{[\s\S]*code:\s*"wrong_path"[\s\S]*wrongPath:\s*true[\s\S]*message:\s*pathGuardMessage/
  );
  assert.doesNotMatch(rejected, /state[.]moves\s*[+]=|state[.]moves[+][+]|state[.]nodes\s*=/);

  const feedback = sourceBetween(guidedPlay, "function showPathGuardFeedback", "function showConceptChemistryFeedback");
  assert.match(feedback, /WRONG PATH/);
  assert.match(feedback, /Words kept; move unchanged[.]/);
  assert.match(feedback, /You already checked this connection/);
  assert.match(feedback, /tone:\s*"wrong-path"/);
  assert.match(feedback, /playFeedback\("uiSelect"\)/);
  assert.doesNotMatch(feedback, /playFeedback\("reject"\)|classList[.]add\("rejected"\)/);
});

test("Path Guard memory is independent, canonical, bounded, snapshotted, and restored only for the same active run", () => {
  const first = createInitialAppState();
  const second = createInitialAppState();
  const pair = pathGuardPairKey(" Water ", "EARTH");
  first.pathGuard.blockedPairs.add(pair);

  assert.equal(pair, pathGuardPairKey("earth", "water"));
  assert.deepEqual([...first.pathGuard.blockedPairs], [pair]);
  assert.equal(second.pathGuard.blockedPairs.size, 0);

  const maximum = Number(app.match(/const MAX_PATH_GUARD_PAIRS = (\d+);/)?.[1]);
  assert.equal(maximum, 128);

  const sanitizer = sourceBetween(
    guidedPlay,
    "export function sanitizeRememberedPathGuardPairs",
    "export function createGuidedPlayController"
  );
  assert.match(sanitizer, /value[.]slice\(-maximum\)/);
  assert.match(sanitizer, /candidate[.]length > 180/);
  assert.match(sanitizer, /JSON[.]parse\(candidate\)/);
  assert.match(sanitizer, /pathGuardPairKey\(parsed\[0\], parsed\[1\]\)/);
  assert.match(sanitizer, /normalized === candidate/);

  const remember = sourceBetween(
    guidedPlay,
    "function rememberPathGuardPair",
    "function pathGuardPairWasRemembered"
  );
  assert.match(remember, /blockedPairs[.]has\(pairKey\)/);
  assert.match(remember, /blockedPairs[.]add\(pairKey\)/);
  assert.match(remember, /while \(state[.]pathGuard[.]blockedPairs[.]size > maximumRememberedPairs\)/);
  assert.match(
    remember,
    /blockedPairs[.]delete\(state[.]pathGuard[.]blockedPairs[.]values\(\)[.]next\(\)[.]value\)/
  );

  const snapshot = sourceBetween(app, "function buildActiveRunSnapshot", "function flushRunSave");
  assert.match(
    snapshot,
    /pathGuardBlockedPairs:\s*\[\.\.\.state[.]pathGuard[.]blockedPairs\][.]slice\(-MAX_PATH_GUARD_PAIRS\)/
  );

  const hydrate = sourceBetween(app, "function hydrateRestoredRun", "async function restoreInterruptedRun");
  assert.match(hydrate, /snapshot[.]run[.]id === persistenceRun[.]id/);
  assert.match(hydrate, /const matchingSnapshot = snapshotMatchesRun \? snapshot[.]progress \|\| \{\} : \{\}/);
  assert.match(
    hydrate,
    /state[.]pathGuard[.]active\s*\?\s*sanitizeRememberedPathGuardPairs\(matchingSnapshot[.]pathGuardBlockedPairs\)\s*:\s*new Set\(\)/
  );
});

test("wrong-path notice tone is visual-only, announced once, and fully cleaned up", () => {
  assert.match(
    page,
    /<div class="alchemy-note" id="alchemyNote" aria-hidden="true"><\/div>/
  );
  assert.match(
    page,
    /id="boardAnnouncement" role="status" aria-live="polite" aria-atomic="true"/
  );

  const descriptor = sourceBetween(app, "function boardNoticeDescriptor", "function boardNoticeExpired");
  assert.match(descriptor, /tone:\s*options[.]tone === "wrong-path" \? "wrong-path" : ""/);

  const display = sourceBetween(app, "function displayBoardNotice", "function showAlchemy");
  assert.match(
    display,
    /els[.]alchemyNote[.]classList[.]toggle\("wrong-path", notice[.]tone === "wrong-path"\)/
  );
  assert.match(display, /announceBoardMessage\(notice[.]text, "board-notice"\)/);

  const clear = sourceBetween(app, "function clearBoardNotices", "function updateConnection");
  assert.match(
    clear,
    /classList[.]remove\("show", "error", "twist", "wrong-path"\)/
  );

  const boardNode = sourceBetween(app, "function syncBoardNodeElement", "function createBoardNode");
  assert.match(conceptMatterApp, /Press to arm, then press another word to combine[.]/);
  assert.match(conceptMatterApp, /Hold or press I to inspect its molecular bonds[.]/);
  assert.match(boardNode, /setAttribute\("aria-pressed"/);
});

test("wrong-path feedback has mobile-safe, reduced-motion, and forced-color contracts", () => {
  const note = cssBlock(".alchemy-note.wrong-path");
  const word = cssBlock(".board-word.wrong-path");
  const bottomHud = cssBlock(".board-bottom-hud");
  const tapChain = cssBlock(".tap-chain-status, .board-undo");
  const tapButtons = cssBlock(".tap-chain-status button, .board-undo button");

  assert.match(note, /border-color:/);
  assert.match(note, /background:/);
  assert.doesNotMatch(note, /var\(--danger\)|#ff(?:6b8a|7c89|6f7e)/i);
  assert.match(word, /wrong-path-lock/);
  assert.doesNotMatch(word, /reject/);

  assert.match(bottomHud, /env\(safe-area-inset-bottom\)/);
  assert.match(bottomHud, /max-height:/);
  assert.match(tapChain, /max-width:\s*100%/);
  assert.match(tapButtons, /min-height:\s*44px/);

  assert.match(
    styles,
    /@media \(max-width: 700px\), \(max-width: 900px\) and \(orientation: portrait\)[\s\S]*?[.]alchemy-note[.]wrong-path\s*\{[^}]*width:\s*100%[^}]*max-width:\s*100%/
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?[.]board-word[.]wrong-path[\s\S]*?animation:\s*none\s*!important/
  );
  assert.match(
    styles,
    /@media \(forced-colors: active\)[\s\S]*?[.]alchemy-note[.]wrong-path[\s\S]*?border-color:\s*Highlight/
  );
});
