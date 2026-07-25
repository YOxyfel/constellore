import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/simple-ui.css", import.meta.url), "utf8");

test("the answer reveal presents one explicit, accessible equation", () => {
  const equation = page.slice(page.indexOf('id="revealEquation"'), page.indexOf('id="revealController"'));
  assert.match(page, /class="reveal-equation"[^>]+id="revealEquation"[^>]+data-phase="summon"[^>]+aria-label="Current answer step"/);
  assert.match(equation, /class="reveal-term reveal-a"/);
  assert.match(equation, /class="reveal-term reveal-b"/);
  assert.match(equation, /class="reveal-term reveal-answer"/);
  assert.match(equation, /class="reveal-equation-operator">\+<\/span>/);
  assert.match(equation, /class="reveal-equation-equals">=<\/span>/);
  assert.match(page, /id="revealAnnouncement"[^>]+aria-live="polite"/);
});

test("each reveal step clears stale DOM and advances through four readable phases", () => {
  const presentation = app.slice(app.indexOf("function clearRevealStage"), app.indexOf("function wakeRevealPlayback"));
  assert.match(presentation, /function clearRevealStage\(\)\s*\{\s*state[.]nodes = \[\];\s*renderBoard\(\);/);
  assert.match(presentation, /els[.]revealEquation[.]dataset[.]phase = phase/);
  assert.match(presentation, /Answer not shown yet/);
  assert.match(presentation, /plus [$]\{step[.]b\} equals [$]\{step[.]word\}/);

  const playback = app.slice(app.indexOf("async function playRevealPath"), app.indexOf("async function replayRevealPathOnce"));
  assert.match(playback, /clearRevealStage\(\);[\s\S]*setRevealPresentation\(step, index, "summon"/);
  assert.match(playback, /setRevealPresentation\(step, index, "merge"/);
  assert.match(playback, /clearRevealStage\(\);[\s\S]*revealRole: index === route[.]length - 1 [^}]+[\s\S]*setRevealPresentation\(step, index, "result"/);
  assert.match(playback, /setRevealPresentation\(finalStep, route[.]length - 1, "complete"/);
});

test("normal motion has visible fusion VFX while reduced motion keeps every answer state", () => {
  for (const phase of ["summon", "merge", "result", "complete"]) {
    assert.match(styles, new RegExp(`[.]reveal-equation\\[data-phase="${phase}"\\]`));
  }
  for (const animation of [
    "atlas-reveal-term-summon",
    "atlas-reveal-term-merge-left",
    "atlas-reveal-term-merge-right",
    "atlas-reveal-answer-arrive",
    "atlas-reveal-answer-ring",
    "atlas-reveal-particles"
  ]) {
    assert.match(styles, new RegExp(`@keyframes ${animation}`));
  }
  const reduced = styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)", styles.indexOf(".reveal-equation")));
  assert.match(reduced, /[.]reveal-equation[\s\S]*animation:\s*none !important/);
  assert.doesNotMatch(reduced, /[.]reveal-equation\s*\{\s*display:\s*none/);
});

test("skip and the one allowed replay both clean the stage and finish at mode selection", () => {
  const immediate = app.slice(app.indexOf("function completeRevealRouteImmediately"), app.indexOf("function wakeRevealPlayback"));
  assert.match(immediate, /clearRevealStage\(\);[\s\S]*revealRole: "target"/);
  assert.match(immediate, /setRevealPresentation\(finalStep, route[.]length - 1, "complete"/);

  const replay = app.slice(app.indexOf("async function replayRevealPathOnce"), app.indexOf("function toggleRevealPause"));
  assert.match(replay, /!revealState[.]replayAvailable \|\| revealState[.]replayUsed/);
  assert.match(replay, /revealState[.]replayAvailable = false/);
  assert.match(replay, /revealState[.]replayUsed = true/);

  const playback = app.slice(app.indexOf("async function playRevealPath"), app.indexOf("async function replayRevealPathOnce"));
  assert.match(playback, /if \(replay\)[\s\S]*state[.]reveal[.]phase = "exiting"[\s\S]*returnHome\(\)/);

  const reset = app.slice(app.indexOf("function resetRevealPlayback"), app.indexOf("function openRevealPath"));
  assert.match(reset, /state[.]nodes = state[.]nodes[.]filter\(\(node\) => !node[.]revealRole\)/);
  assert.match(reset, /renderBoard\(\)/);
});
