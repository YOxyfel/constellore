import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app, controller, html, runtime, css, packageSource] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/concept-matter-app.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/concept-matter-runtime.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/concept-matter.css", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8")
]);
const releaseVersion = JSON.parse(packageSource).version;

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing ${start}`);
  assert.ok(to > from, `missing ${end} after ${start}`);
  return source.slice(from, to);
}

test("Concept Matter has HTML controls and a live accessibility contract", () => {
  assert.ok(html.includes(`href="/concept-matter.css?v=${releaseVersion}"`));
  assert.match(html, /id="conceptMatterViewToggle"[^>]*type="button"[^>]*aria-label="Use compact word representation"[^>]*aria-pressed="true"/);
  assert.match(html, /id="conceptMatterStatus"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);

  assert.match(runtime, /role:\s*"dialog"[\s\S]*"aria-modal":\s*"false"[\s\S]*"aria-labelledby":\s*"conceptMatterInspectorTitle"/);
  assert.match(runtime, /"aria-describedby":\s*"conceptMatterInspectorInstruction conceptMatterInspectorIntegrity"/);
  assert.match(runtime, /id:\s*"conceptMatterInspectorInstruction"/);
  assert.match(runtime, /id:\s*"conceptMatterInspectorIntegrity"/);
  assert.doesNotMatch(runtime, /button[.]disabled\s*=/, "locked bonds must remain focusable so their reason can be read");
  assert.match(runtime, /button[.]getAttribute\("aria-disabled"\) === "true"/);
  assert.match(runtime, /capabilities[?][.]inspect !== true\) close\(\{ restoreFocus: false, reason: "inspection-disabled" \}\)/);
  assert.match(css, /concept-matter-cut:not\(\[aria-disabled="true"\]\):is\(:hover, :focus-visible\)/);
});

test("tear gestures commit once and short tears cannot fall through into click activation", () => {
  const click = between(runtime, 'button.addEventListener("click"', "return button;");
  assert.match(click, /event[.]detail !== 0 && suppressedPointerClicks[.]has\(button\)/);
  assert.match(click, /preventDefault\(\)[\s\S]*stopPropagation\(\)[\s\S]*return/);

  const finish = between(runtime, "function endCutGesture", "function cancelCutGesture");
  assert.match(finish, /if \(moved\) suppressNextPointerClick\(gesture[.]button\)/);
  assert.match(finish, /if \(armed\)[\s\S]*commitCut\(cut, \{ source: "tear" \}\)/);
  assert.match(finish, /else if \(moved\)[\s\S]*preventDefault\(\)[\s\S]*Pull farther to commit/);

  const destroy = between(runtime, "function destroy()", "return Object.freeze");
  for (const eventName of ["pointermove", "pointerup", "pointercancel", "resize"]) {
    assert.ok(destroy.includes(`view?.removeEventListener?.("${eventName}"`), `${eventName} listener must be released`);
  }
  assert.match(runtime, /lostpointercapture", cancelCutGesture/);
});

test("Compound Orbs resize responsively without recursive custom properties", () => {
  assert.match(css, /--concept-matter-size:\s*var\(--concept-matter-base-size,\s*68px\)/);
  assert.doesNotMatch(css, /--concept-matter-size:\s*min\(var\(--concept-matter-size\)/,
    "a custom property cannot resolve through itself");
  assert.match(css, /concept-matter-node--derived\s*\{\s*--concept-matter-size:\s*min\(var\(--concept-matter-base-size,\s*104px\),\s*98px\)/);
  assert.match(runtime, /function mobileOrbLayout\([\s\S]*width <= 700[\s\S]*width <= 900 && height >= width/);
  assert.match(runtime, /const size = orbSizeFor\(compound, view\)/,
    "placement geometry must use the same responsive size as CSS");
  assert.match(runtime, /![\s\S]*host[.]classList[.]contains\("concept-matter-node"\)/,
    "a normal board rerender must restore the runtime class before skipping decoration");

  assert.match(runtime, /body[.]append\(membrane, interior\)[\s\S]*orb[.]append\(body, nameplate\)/);
  assert.match(css, /[.]concept-matter-orb__body\s*\{[\s\S]*animation:\s*concept-matter-breathe/);
  assert.match(css, /concept-matter-node:is\(:hover, :focus-visible, [.]keyboard-selected\) [.]concept-matter-orb\s*\{[\s\S]*transform:\s*scale\(1[.]09\)/);
  assert.match(css, /[.]concept-matter-inspector__close\s*\{[\s\S]*width:\s*44px[\s\S]*height:\s*44px/);
  assert.match(css, /env\(safe-area-inset-left\)[\s\S]*env\(safe-area-inset-right\)[\s\S]*env\(safe-area-inset-bottom\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
});

test("the app coordinates representation, inspection, geometry, undo, and persistence", () => {
  assert.ok(app.includes(`import("./concept-matter-app.mjs?v=${releaseVersion}")`));
  assert.ok(controller.includes(`from "./concept-matter.mjs?v=${releaseVersion}"`));
  assert.ok(controller.includes(`import { createConceptMatterRuntime } from "./concept-matter-runtime.mjs?v=${releaseVersion}"`));
  assert.match(controller, /storage[?][.]getItem[?][.]\(CONCEPT_MATTER_VIEW_KEY\)/);
  assert.match(controller, /viewToggle[?][.]addEventListener[?][.]\("click", toggleRepresentation\)/);
  assert.match(controller, /storage[?][.]setItem[?][.]\(CONCEPT_MATTER_VIEW_KEY, nextRepresentation\)/);

  const sync = between(controller, "function sync()", "function itemForFragment");
  for (const contract of ["nodes: state.nodes", "history: state.history", "capabilities: currentCapabilities", "routeGuide: getRouteGuide()", "representation: currentRepresentation"] ) {
    assert.ok(sync.includes(contract), `missing Concept Matter sync contract: ${contract}`);
  }

  const initialization = between(controller, "runtime = createConceptMatterRuntime", "viewToggle?.addEventListener");
  assert.match(initialization, /onInspect:[\s\S]*closeMolecularMemoryPanels\(\)[\s\S]*closeWordOrbit\(\)/);
  assert.match(initialization, /onCommit:\s*\(\{ nodeId, plan, source \}\) => commitCut\(nodeId, plan, \{ source \}\)/);
  assert.match(initialization, /onAnnounce:\s*announce/);
  assert.match(controller, /function commitCut\(/);
  assert.match(controller, /Hold or press I to inspect its molecular bonds/);
  assert.match(app, /conceptMatterApp = createConceptMatterAppController\([\s\S]*onBoardGeometryChange/);
  assert.match(app, /async function startWithGame[\s\S]*await ensureConceptMatterApp\(\)/);

  const measure = between(app, "function measureBoardWord", "function dragThreshold");
  assert.match(measure, /conceptMatterApp[?][.]estimateSize\([\s\S]*representation: conceptMatterRepresentation\(\)/);
  const drag = between(app, "function startNodeDrag", "async function combineNodes");
  assert.match(drag, /holdTimer = window[.]setTimeout\([\s\S]*cleanup\(\)[\s\S]*conceptMatterApp[?][.]inspect/);
  assert.match(drag, /if \(holdTimer\) window[.]clearTimeout\(holdTimer\)/);

  const fingerprint = between(app, "function boardHistoryFingerprint", "function boardHistoryMatchesRun");
  assert.match(fingerprint, /molecularMemoryInstanceId/,
    "undo fingerprints must distinguish two isomers of the same displayed word");
  assert.match(app, /molecularMemoryInstanceId:\s*String\(node[.]molecularMemoryInstanceId/);
});
