import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app, css, orbit, runtime, semanticFacets, view, camera] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  Promise.all([
    readFile(new URL("../public/word-orbit.css", import.meta.url), "utf8"),
    readFile(new URL("../public/word-orbit-motion.css", import.meta.url), "utf8")
  ]).then((parts) => parts.join("\n")),
  readFile(new URL("../public/word-orbit.mjs", import.meta.url), "utf8"),
  Promise.all([
    readFile(new URL("../public/word-orbit-runtime.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/word-bloom-input-runtime.mjs", import.meta.url), "utf8")
  ]).then((parts) => parts.join("\n")),
  readFile(new URL("../public/word-semantic-facets.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/word-bloom-view.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/board-camera-runtime.mjs", import.meta.url), "utf8")
]);

test("mobile play creates one touch-native Constellation Bloom", () => {
  for (const id of [
    "constellationBloom",
    "constellationBloomTrigger",
    "constellationBloomCancel",
    "constellationBloomPanel",
    "constellationBloomCategories",
    "constellationBloomWords",
    "constellationBloomSearch",
    "constellationBloomTransitionGhost",
    "constellationBloomStatus"
  ]) assert.match(view, new RegExp(`id=["']${id}`));
  assert.match(runtime, /from "[.]\/word-bloom-view[.]mjs/);
  assert.match(runtime, /WORD_BLOOM_CATEGORIES\.map/);
  assert.match(runtime, /pageSize:\s*currentPalette[.]pageSize/);
  assert.match(runtime, /source:\s*"bloom"/);
  assert.match(runtime, /Promise\.resolve\(onChoose\?\.\(item/);
  assert.match(runtime, /commitAnimating = true[\s\S]*render\(\);[\s\S]*onChoose/);
  assert.doesNotMatch(runtime, /startTrayPointerDrag/);
});

test("successful Bloom fusion continues from its result and failures keep the anchor", () => {
  assert.match(app, /state\.selectedNodeId = resultNode\.id;[\s\S]*created and anchored\. Choose another word/);
  assert.match(app, /async function activateTrayItem\(item\)/);
  assert.match(app, /const outcome = await activateTrayItem\(item\)/);
  assert.match(app, /\(!outcome \|\| outcome\.wrongPath\) && \(mobilePlayShellActive\(\) \|\| getCtrlHoverNode\(selected\.id\)\)/);
  assert.match(camera, /"[.]board-word",[\s\S]*"[.]constellation-bloom"/);
  assert.match(runtime, /view\.anchor && key\(view\.anchor\) === key\(item\)/);
});

test("Bloom gives the board the whole phone and bounds every temporary control", () => {
  assert.match(css, /data-play-layout="stacked"[\s\S]*\.game-layout[\s\S]*grid-template:\s*minmax\(0, 1fr\) \/ minmax\(0, 1fr\)/);
  assert.match(css, /data-play-layout="short-landscape"[\s\S]*\.inventory\s*\{\s*display:\s*none !important/);
  assert.match(css, /\.constellation-bloom__start\s*\{[\s\S]*min-width:\s*142px[\s\S]*min-height:\s*52px[\s\S]*touch-action:\s*none/);
  assert.match(css, /data-palette-layout="horizontal"[\s\S]*min-height:\s*44px/);
  assert.match(css, /\.constellation-bloom__search input\s*\{[^}]*height:\s*44px/);
  assert.match(runtime, /const focusedScale = boardHeight <= 154 \? 1[.]08 : 1[.]11/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
});

test("Bloom has safe cancellation, keyboard fallback, and dialog handoff", () => {
  assert.match(runtime, /classifyWordBloomDirection\(dx, dy, \{ deadZone: 28 \}\)/);
  assert.match(runtime, /"pointercancel"/);
  assert.match(runtime, /"lostpointercapture"/);
  assert.match(runtime, /event\.key !== "Escape"/);
  assert.match(runtime, /onCancelAnchor\?\.\(/);
  assert.match(runtime, /beforeDialog\(\) \{ transitions[.]clear\(\); stage = "closed"/);
  assert.match(view, /aria-live="polite"/);
  assert.match(app, /onBeforeDialog:\s*\(\) =>\s*\{[\s\S]*wordOrbitRuntime\?\.beforeDialog\(\);[\s\S]*closeMolecularMemoryPanels\(\);/);
});

test("blank board clicks clear selection while double clicks relocate the one Bloom", () => {
  assert.match(camera, /listen\(viewport, "pointerdown", begin\)/);
  assert.match(camera, /Math[.]hypot\(dx, dy\) < threshold/);
  assert.match(camera, /const DOUBLE_ACTIVATION_MS = 500/);
  assert.match(camera, /activationMatches\(pendingActivation, completed\)/);
  assert.match(camera, /onSingleActivation[?][.]\(\{ [.]\.[.]pending/);
  assert.match(camera, /onDoubleActivation[?][.]\(\{ [.]\.[.]completed/);
  assert.doesNotMatch(camera, /stopImmediatePropagation/);
  assert.match(runtime, /function dismissFromBoard\(\)[\s\S]*hubVisible = true[\s\S]*onCancelAnchor[?][.]\(\{ source: "board", anchor: view[.]anchor \}\)/);
  assert.match(app, /onSingleActivation:\s*\(\) => \{[\s\S]*wordOrbitRuntime[?][.]dismissFromBoard\(\)/);
  assert.match(app, /onDoubleActivation:\s*\(\{ origin, pointerType \}\) => \{[\s\S]*relocateFromBoard\(origin, \{ pointerType \}\)/);
  assert.doesNotMatch(app, /els[.]board[.]addEventListener\("pointerdown"[\s\S]*cancelTapChain\(\)/);
  assert.match(runtime, /kind: "bloom-relocate"[\s\S]*swap: \(\) => setOrigin\(\{ x: origin[.]x, y: origin[.]y \}\)/);
  assert.match(runtime, /const nextStage = getStage\(\) === "closed" \? getOpeningStage\(\) : getStage\(\)/);
  assert.match(view, /BLOOM_BOARD_PROTECTED_SELECTOR[\s\S]*[.]board-word[\s\S]*button/);
  assert.match(view, /transition[?][.]kind === "bloom-relocate"/);
  assert.match(css, /data-transition="bloom-relocate"[\s\S]*bloom-presence-out/);
  assert.match(css, /@keyframes bloom-presence-out[\s\S]*scale:\s*[.]96/);
  assert.match(css, /@keyframes bloom-presence-in[\s\S]*from \{ opacity:\s*0; scale:\s*[.]96/);
  assert.match(css, /[.]constellation-bloom \[hidden\][^{]*\{[^}]*display:\s*none !important/);
});

test("Bloom treats directional displacement as movement even when focus is already on the target", () => {
  assert.match(runtime, /const preview = previewWordBloomSwipe\(dx, dy/);
  assert.match(runtime, /if \(!preview[.]moved\) return;\s*active[.]moved = true;\s*if \(preview[.]changed\)/);
});

test("Bloom handoffs keep category nodes stable and respect motion preferences", () => {
  assert.match(runtime, /new Map\(WORD_BLOOM_CATEGORIES\.map/);
  assert.doesNotMatch(runtime, /bloom\.categories\.replaceChildren/);
  assert.match(runtime, /syncBloomCategoryHighlight\(categoryButtons, next\)/);
  assert.match(view, /dataset\.transition = kind/);
  assert.match(view, /prefers-reduced-motion: reduce/);
  assert.match(view, /\["reduced", "off"\][.]includes/);
  assert.match(css, /data-transition="word-commit"/);
  assert.match(css, /data-transition-phase="out"[\s\S]*bloom-palette-out/);
  assert.match(css, /data-transition-phase="in"[\s\S]*bloom-palette-in/);
  assert.match(css, /grid-template-columns:\s*repeat\(var\(--bloom-columns,2\),minmax\(0,1fr\)\)/);
  assert.match(css, /overflow:\s*auto; overscroll-behavior:\s*contain/);
  assert.match(css, /data-word-input="bloom"[\s\S]*#tapChainStatus\s*\{\s*display:\s*none !important/);
  assert.match(css, /constellation-bloom__cancel\s*\{[\s\S]*min-width:\s*44px[\s\S]*min-height:\s*44px/);
  assert.match(css, /data-cosmetic-effects="reduced"[\s\S]*data-cosmetic-effects="off"[\s\S]*animation:\s*none !important/);
  assert.match(view, /getAnimations/);
  assert.match(view, /finishIfReduced/);
  assert.match(runtime, /const wordButtons = new Map/);
  assert.doesNotMatch(runtime, /bloom[.]words[.]replaceChildren/);
});

test("Browse keeps four thumb directions while deriving only populated semantic facets", () => {
  assert.match(orbit, /id:\s*"search",\s*label:\s*"Browse and search",\s*shortLabel:\s*"Browse"/);
  assert.match(orbit, /from "[.]\/word-semantic-facets[.]mjs/);
  assert.match(semanticFacets, /availableWordBloomFacets\(\{ words: source, minimum = 2 \}/);
  assert.match(semanticFacets, /if \(matches[.]length < threshold\) continue/);
  assert.match(semanticFacets, /seenMembership[.]has\(membership\)/);
  assert.match(runtime, /availableWordBloomFacets\(\{ words: view[.]words \}\)/);
  assert.match(runtime, /boundedWordBloomFacetWindow\(\{/);
  assert.match(runtime, /wordBloomFacetLayout\(\{/);
  assert.match(runtime, /stage = \["closed", "categories", "browse", "words", "search"\][.]includes\(next\)/);
  assert.match(runtime, /displayStage === "browse"\s*\? "Available word categories"/);
  assert.match(view, /entry[.]count === 1 \? "word" : "words"/);
});

test("tutorial Bloom exposes instructed discoveries as well as starter words", () => {
  assert.match(runtime, /category: view[.]tutorial \? "all" : category \|\| "basics"/);
  assert.match(runtime, /view[.]tutorial && view[.]spotlightWords[?][.]length[\s\S]*items[.]filter\(\(item\) => listHas\(view[.]spotlightWords, item\)\)/);
  assert.match(runtime, /view[.]tutorial[\s\S]*WORD_BLOOM_CATEGORIES[.]filter\(\(\{ id \}\) => id === "basics"\)/);
});

test("Search does not autofocus, filters immediately, and restores the previous group", () => {
  assert.doesNotMatch(view, /id="constellationBloomSearch"[^>]*\sautofocus(?:\s|=|>)/);
  assert.match(runtime, /focus:\s*query \? "first-word" : "category"/);
  assert.match(runtime, /query && stage !== "search"[\s\S]*stage = "search"/);
  assert.match(runtime, /!query && stage === "search"[\s\S]*stage = previous[.]stage/);
  assert.match(runtime, /stage === "words" && categoryParent === "browse"[\s\S]*setStage\("browse"/);
  assert.match(runtime, /stage === "browse"[\s\S]*setStage\("categories"/);
  assert.match(runtime, /event[.]key !== "Escape"[\s\S]*returnToParent\(\{ announceChange: true, focus: true \}\)/);
  assert.match(orbit, /id:\s*"all"[\s\S]*label:\s*"All discovered words"/);
});


test("Bloom opens to words, retains the group, and keeps the second ingredient available", () => {
  assert.match(runtime, /next === "categories" && stage === "closed"[\s\S]*lastWordCategory \|\| "all"[\s\S]*next = "words"/);
  assert.match(runtime, /!outcome[?][.]error && !view[.]anchor && nextView[.]anchor[\s\S]*stage = "words"/);
  assert.match(runtime, /bloom[.]trigger[.]hidden = false/);
  assert.match(runtime, /bloom[.]searchWrap[.]hidden = displayStage === "closed"/);
  assert.match(runtime, /Typing is immediate[\s\S]*transitions[.]clear\(\)/);
  assert.match(css, /input::-webkit-search-cancel-button[^{]*\{[^}]*display: none/);
  assert.match(view, /--bloom-panel-height/);
});
