import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const cosmeticCanvas = readFileSync(new URL("../public/cosmetic-canvas.mjs", import.meta.url), "utf8");
const revealPresentation = readFileSync(new URL("../public/reveal-presentation.mjs", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/simple-ui.css", import.meta.url), "utf8");

test("the answer reveal presents an explicit, accessible wave summary", () => {
  const equation = page.slice(page.indexOf('id="revealEquation"'), page.indexOf('id="revealController"'));
  assert.match(page, /class="reveal-equation"[^>]+id="revealEquation"[^>]+data-phase="summon"[^>]+aria-label="Current answer step"/);
  assert.match(equation, /class="reveal-term reveal-a"/);
  assert.match(equation, /class="reveal-term reveal-b"/);
  assert.match(equation, /class="reveal-term reveal-answer"/);
  assert.match(equation, /class="reveal-equation-operator">\+<\/span>/);
  assert.match(equation, /class="reveal-equation-equals">=<\/span>/);
  assert.match(page, /id="revealAnnouncement"[^>]+aria-live="polite"/);
  assert.match(page, /class="reveal-label-wide">SHOWING THE ANSWER &middot; NO POINTS/);
  assert.match(page, /class="reveal-label-compact">ANSWER &middot; NO POINTS/);
  assert.match(styles, /@media \(max-width: 390px\)[\s\S]*[.]reveal-label-wide[\s\S]*display:\s*none[\s\S]*[.]reveal-label-compact[\s\S]*display:\s*inline/);
});

test("dependency waves keep prior words while advancing through four readable phases", () => {
  const presentation = `${app.slice(app.indexOf("function revealTreeNode"), app.indexOf("function wakeRevealPlayback"))}\n${revealPresentation}`;
  assert.match(presentation, /function stageRevealBatch\(batch, phase\)/);
  assert.match(presentation, /setRevealNodeRole\(node, "past"\)/);
  assert.match(presentation, /function materializeRevealTree/);
  assert.match(presentation, /revealEquation[.]dataset[.]phase = phase/);
  assert.match(presentation, /paths growing together/);
  assert.match(presentation, /Answers not shown yet/);
  assert.match(app, /function announceRevealBatchResult/);
  assert.match(revealPresentation, /plus \$\{step[.]b\} makes \$\{step[.]word\}/);
  assert.match(app, /els[.]revealAnnouncement[.]textContent/);
  assert.match(presentation, /function applyRevealCamera/);
  assert.match(presentation, /function refreshRevealLayoutForViewport/);

  const playback = app.slice(app.indexOf("async function playRevealPath"), app.indexOf("async function replayRevealPathOnce"));
  assert.match(playback, /for \(const batch of layout[.]batches\)/);
  assert.match(playback, /stageRevealBatch\(batch, "summon"\)/);
  assert.match(playback, /setRevealPresentation\(batch, batch[.]index, "merge"\)/);
  assert.match(playback, /stageRevealBatch\(batch, "result"\)/);
  assert.match(playback, /announceRevealBatchResult\(batch\)/);
  assert.match(playback, /materializeRevealTree\(\)/);
  assert.doesNotMatch(playback, /clearRevealStage\(\)/);
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
  assert.match(styles, /data-reveal-compact="true"[\s\S]*-webkit-line-clamp:\s*2/);

  const pause = app.slice(app.indexOf("function toggleRevealPause"), app.indexOf("function cycleRevealSpeed"));
  assert.match(pause, /state[.]reveal[.]pausedAt = now/);
  assert.match(pause, /state[.]reveal[.]visual[.]startedAt = state[.]reveal[.]visual[.]startedAt[\s\S]*now - state[.]reveal[.]pausedAt/);
  const cosmos = cosmeticCanvas.slice(cosmeticCanvas.indexOf("export function startCosmosCanvas"));
  assert.match(cosmos, /paused: state[.]reveal[.]paused/);
  assert.match(cosmos, /drawRevealGraph/);
  assert.match(revealPresentation, /renderedEdge/);
});

test("skip materializes the full tree and the one replay still exits to mode selection", () => {
  const immediate = app.slice(app.indexOf("function completeRevealRouteImmediately"), app.indexOf("function wakeRevealPlayback"));
  assert.match(immediate, /state[.]reveal[.]completedSteps = route[.]map/);
  assert.match(immediate, /materializeRevealTree\(\)/);
  assert.match(immediate, /setRevealPresentation\(finalBatch, finalBatch[.]index, "complete"\)/);

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
