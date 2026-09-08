import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const simpleUi = [
  readFileSync(new URL("../public/simple-ui.css", import.meta.url), "utf8"),
  readFileSync(new URL("../public/mobile-play-shell.css", import.meta.url), "utf8")
].join("\n");
const cosmeticPreview = readFileSync(new URL("../public/cosmetic-world-preview.css", import.meta.url), "utf8");
const frictionless = readFileSync(new URL("../public/frictionless.mjs", import.meta.url), "utf8");

test("the cumulative in-play story presentation is retired on every layout", () => {
  assert.doesNotMatch(html, /id="combinationStory"|data-combination-story/);
  assert.doesNotMatch(html, /<link[^>]+combination-story[.]css/);
  assert.doesNotMatch(app, /combinationStory|combination-story-runtime|targetRouteStoryHistory/);
  assert.doesNotMatch(simpleUi, /#combinationStory/);
  assert.doesNotMatch(cosmeticPreview, /[.]combination-story/);
});

test("route evidence and restore integrity remain after retiring the presentation", () => {
  const historyPushIndex = app.indexOf("state.history.push(historyStep);");
  const routeStoryIndex = app.indexOf("const routeStoryStep = !scrambleActive && isTargetRouteStoryStep(historyStep);");
  assert.ok(historyPushIndex >= 0 && routeStoryIndex > historyPushIndex);
  assert.match(app, /state[.]history = restoreTargetRouteStoryEvidence\(state[.]history, matchingSnapshot[.]history\)/);
  assert.match(app, /routeDerived:\s*Boolean\(savedNode[.]routeDerived\)/);
  assert.match(app, /routeDerived:\s*Boolean\(node[.]routeDerived\)/);
});

test("route results stay as real draggable midpoint nodes without a duplicate story scene", () => {
  assert.match(frictionless, /x: \(a[.]x \+ b[.]x - size[.]width\) \/ 2/);
  assert.match(frictionless, /y: \(a[.]y \+ b[.]y - size[.]height\) \/ 2/);
  assert.match(app, /const routeStoryStep = !scrambleActive && isTargetRouteStoryStep\(historyStep\)/);
  const placementIndex = app.indexOf("const derivationPlacement = fusionResultPlacement(aAnchor, bAnchor, measureBoardWord(known));");
  const removalIndex = app.indexOf("state.nodes = state.nodes.filter((node) => node.id !== a.id && node.id !== b.id);", placementIndex);
  const resultIndex = app.indexOf("const resultNode = addNode(", removalIndex);
  assert.ok(placementIndex >= 0 && removalIndex > placementIndex && resultIndex > removalIndex);
  assert.match(app, /routeDerived: routeStoryStep/);
  assert.match(app, /if \(fusionEffectsEnabled\) resultElement[?][.]classList[.]add\("fusion-materializing"\)/);
  assert.match(app, /resultElement[?][.]classList[.]remove\("fusion-materializing"\)/);
  assert.match(simpleUi, /[.]board-word[.]route-derived/);
});
