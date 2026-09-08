import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, guidedPlay, html, chemistryCss, memoryCss, memoryRuntime] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/guided-play-app.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/concept-chemistry.css", import.meta.url), "utf8"),
  readFile(new URL("../public/molecular-memory.css", import.meta.url), "utf8"),
  readFile(new URL("../public/molecular-memory-runtime.mjs", import.meta.url), "utf8")
]);

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing ${start}`);
  assert.ok(to > from, `missing ${end} after ${start}`);
  return source.slice(from, to);
}

test("tutorials and early Path Guard share one strict Concept Chemistry preflight", () => {
  assert.match(app, /createGuidedPlayController/);
  const guide = between(guidedPlay, "function conceptChemistryGuideForState", "function rememberPathGuardPair");
  assert.match(guide, /FIRST_ORBIT_ROUTE/);
  assert.match(guide, /SECOND_ORBIT_ROUTE/);
  assert.match(guide, /pathGuardActiveFor\(\)[\s\S]*state[.]conceptChemistry/);
  assert.match(guide, /strict:\s*false/);

  const combine = between(app, "async function combineNodes", "function expectedPairKey");
  const decisionAt = combine.indexOf("evaluateConceptChemistryPair");
  const busyAt = combine.indexOf("state.busyPairs.add(a.id)");
  const requestAt = combine.indexOf('fetchJson("/api/combine"');
  assert.ok(decisionAt >= 0 && decisionAt < busyAt && decisionAt < requestAt);
  assert.match(combine, /chemistryDecision[.]blocked[\s\S]*code:\s*"concept_reaction_locked"/);
  const feedback = between(guidedPlay, "function showConceptChemistryFeedback", "return Object.freeze");
  assert.match(feedback, /Words kept; move unchanged/);
});

test("performed reactions retain Concept Chemistry roles and continue from the result", () => {
  const combine = between(app, "async function combineNodes", "function expectedPairKey");
  assert.match(combine, /role:\s*\["backbone",\s*"reagent"\][.]includes\(chemistryDecision[.]classification\)/);
  assert.match(combine, /routeStepId:\s*chemistryGuide[.]allowedPair\?\.stepId/);
  assert.match(combine, /recipeId:\s*chemistryGuide[.]allowedPair\?\.recipeId/);
  assert.match(combine, /nextChemistryGuide[\s\S]*Concept Bond remains active/);
  assert.match(app, /acceptConceptChemistryGuide\(run\?\.conceptChemistry\)/);
});

test("board words receive Molecular Memory while the chemistry overlay stays noninteractive", () => {
  assert.match(memoryRuntime, /createConceptReactionHistory\(history\)/);
  assert.match(memoryRuntime, /createMolecularMemoryPresentation\([\s\S]*attach\(host, \{ panelContainer: document[.]body \}\)/);
  assert.match(app, /syncMolecularMemories\(\);[\s\S]*const nextChemistryGuide/);
  assert.match(html, /molecular-memory[.]css/);
  assert.match(html, /concept-chemistry[.]css/);
  assert.match(app, /function toggleAriaDescribedByToken\(element, token, enabled\)/);
  assert.match(app, /toggleAriaDescribedByToken\(button, "firstOrbitInstruction", highlighted\)/);
  assert.match(chemistryCss, /pointer-events:\s*none/);
  assert.match(memoryCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(memoryCss, /forced-colors:\s*active/);
});

test("Molecular Memory follows board-node provenance and owns a complete portal lifecycle", () => {
  const sync = between(memoryRuntime, "function sync(", "return Object.freeze");
  assert.match(sync, /instanceId = instanceFor\(node, history\)/);
  assert.match(sync, /createMolecularMemoryPresentation\([\s\S]*instanceId,[\s\S]*history/);
  assert.match(sync, /close\(id\)/, "opening one memory closes the other portals");
  assert.match(sync, /controller[.]update\(\{ word, instanceId, history: reactionHistory \}\)/);
  assert.match(app, /button[.]className = `board-word\$\{molecularMemoryRuntime[?][.]has\(node[.]id\)/,
    "board rerenders must preserve the controller-owned positioning class");

  const combine = between(app, "async function combineNodes", "function expectedPairKey");
  assert.match(combine, /aInstanceId:\s*nodeMolecularMemoryInstance\(a\)/);
  assert.match(combine, /bInstanceId:\s*nodeMolecularMemoryInstance\(b\)/);
  assert.match(combine, /outputInstanceId:\s*`molecule:/);
  assert.match(combine, /molecularMemoryInstanceId:\s*historyStep[.]outputInstanceId/);
  assert.match(app, /molecularMemoryInstanceId:\s*String\(node[.]molecularMemoryInstanceId/);
  assert.match(app, /clearMolecularMemories\(\);[\s\S]*combiningBoardRuntime\?[.]suspend\("home"\)/);
  assert.match(app, /function removeShiftBoardNode[\s\S]*destroyMolecularMemory\(current[.]id\)/);
});
