import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createWordChemistryGraph, lineageFromComponents } from "../public/word-node-chemistry.mjs";

const [html, css, script] = await Promise.all([
  readFile(new URL("../public/word-node-lab.html", import.meta.url), "utf8"),
  readFile(new URL("../public/word-node-lab.css", import.meta.url), "utf8"),
  readFile(new URL("../public/word-node-lab.mjs", import.meta.url), "utf8")
]);

test("word node lab uses a CSP-compatible isolated runtime", () => {
  assert.match(html, /<script type="module" src="\/word-node-lab[.]mjs[?]v=/);
  assert.doesNotMatch(html, /<script(?:\s[^>]*)?>\s*[(]/);
  assert.match(html, /id="activeNode"/);
  assert.match(html, /id="hoverPreview"[^>]*hidden/);
  assert.match(html, /id="hoverCancel"[^>]*aria-label="Cancel structure changes"/);
  assert.match(html, /id="hoverApply"[^>]*disabled/);
  assert.match(html, /id="nodeWord"/);
  assert.match(html, /id="saveVariant"/);
  for (const id of ["bondEditor", "bondQuality", "bondIntegrity", "bondWeaken", "bondStrengthen", "bondBreak", "bondConnect", "bondUndo"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const id of ["readoutFragments", "readoutWords", "readoutCohesion", "readoutReactivity", "readoutState", "wordSplit", "wordSplitTokens"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const id of ["breakGoalTitle", "breakGoalSelect", "breakGoalRule", "breakGoalStart", "breakGoalStatus"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  const hoverMarkup = html.match(/<aside class="lab-hover-bubble"[\s\S]*?<\/aside>/)?.[0] || "";
  assert.match(hoverMarkup, /id="hoverStructure3d"/);
  assert.match(hoverMarkup, /id="hoverStructureLabels"/);
  assert.match(hoverMarkup, /role="group" aria-label="Interactive molecule"/);
  assert.doesNotMatch(hoverMarkup, /STRUCTURE PREVIEW|hoverWord|hoverStats|hoverFormula|<strong/);
});

test("word node lab exposes live structure and motion controls", () => {
  for (const id of ["nodeComponents", "accentColor", "nodeScale", "structureOpacity", "motionSpeed", "nodeMotion"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(script, /function updatePreview\(\)/);
  assert.match(script, /function saveVariant\(\)/);
  assert.match(script, /function showHoverPreview\(node\)/);
  assert.match(script, /function enterStructurePreview\(\)/);
  assert.match(script, /function handleActiveNodeStructureEntry\(event\)[\s\S]*event[.]shiftKey[\s\S]*enterStructurePreview\(\)/);
  assert.match(script, /activeNode[.]addEventListener\("click", handleActiveNodeStructureEntry\)/);
  assert.match(script, /function buildThreeDimensionalStructure\(target, graph, accent\)/);
  assert.match(script, /function beginMoleculeGesture\(event\)/);
  assert.match(script, /function beginMoleculeGesture\(event\)[\s\S]*if \(event[.]shiftKey\) return;[\s\S]*event[.]button === 1 [?] "rotate" : "pan"/);
  assert.match(script, /function beginMoleculeGesture\(event\)[\s\S]*[.]lab-molecule-3d__atom, [. ]lab-molecule-3d__bond-hit/);
  assert.match(script, /event[.]button === 1 [?] "rotate" : "pan"/);
  assert.match(script, /function moveMoleculeGesture\(event\)/);
  assert.match(script, /function zoomMolecule\(event\)/);
  assert.match(script, /clampMoleculeZoom[\s\S]*[.]35[\s\S]*4[.]5/);
  assert.match(script, /function selectMoleculeAtom\(atom,/);
  assert.match(script, /function selectMoleculeBond\(bondHit\)/);
  assert.match(script, /function completeBondConnection\(targetNodeId\)/);
  assert.match(script, /function breakSelectedBond\(\)/);
  assert.match(script, /function weakenSelectedBond\(\)/);
  assert.match(script, /weakenEditableBond\(editableGraph, bondId, 20\)/);
  assert.match(script, /function renderWordSplit\(graph, effects, settings\)/);
  assert.match(script, /deriveWordFragments/);
  assert.match(script, /canonicalBreakGoals/);
  assert.match(script, /evaluateBreakGoal/);
  assert.match(script, /function syncBreakGoalCatalog\(graph, settings\)/);
  assert.match(script, /function startSelectedBreakGoal\(\)/);
  assert.match(script, /function undoBondEdit\(\)/);
  assert.match(script, /createEditableBondGraph/);
  assert.match(script, /connectedBondFragments/);
  assert.match(script, /bondGraphEffects/);
  assert.match(script, /structureEditsBySource = new WeakMap\(\)/);
  assert.match(script, /function applyActiveStructureGraph\(graph,/);
  assert.match(script, /function applyStructureDraft\(\)[\s\S]*applyActiveStructureGraph\(committedGraph, currentSettings\(\)\)/);
  assert.match(script, /function cancelStructureDraft\(\)[\s\S]*closeHoverPreview\(\)/);
  assert.match(script, /function renderEditableStructure\(\)[\s\S]*syncEditorDraftState\(\)/);
  const draftRenderer = script.match(/function renderEditableStructure\(\)[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(draftRenderer, /applyActiveStructureGraph/);
  assert.match(script, /function moleculeAtomFromEvent\(event\)/);
  assert.match(script, /event[.]shiftKey[\s\S]*focusMoleculeAtom\(atom\)/);
  assert.match(script, /function focusMoleculeAtom\(atom\)/);
  assert.match(script, /FOCUSED_ATOM_ZOOM\s*=\s*3[.]25/);
  assert.match(script, /HOVER_STRUCTURE_SCALE\s*=\s*2/);
  assert.match(script, /atomLabel[.]className = "lab-molecule-3d__screen-label"/);
  assert.match(script, /atomLabel[.]textContent = node[.]label/);
  assert.match(script, /function syncMoleculeScreenLabels\(\)/);
  assert.match(script, /const labels = elements[.]hoverStructureLabels/);
  assert.match(script, /target[.]replaceChildren\(scene\)/);
  assert.match(script, /sourceClearance = atomVisualMetrics\(source\)[.]diameter [*] [.]5/);
  assert.match(script, /addEventListener\("wheel", zoomMolecule, \{ passive: false \}\)/);
  assert.doesNotMatch(script, /addEventListener\("dblclick"/);
  assert.match(script, /function guardExplicitDraftDecision\(event\)/);
  assert.match(script, /document[.]addEventListener\("pointerdown", guardExplicitDraftDecision, true\)/);
  assert.match(script, /hoverApply[.]addEventListener\("click", applyStructureDraft\)/);
  assert.match(script, /hoverCancel[.]addEventListener\("click", cancelStructureDraft\)/);
  assert.match(script, /HOVER_PREVIEW_DELAY_MS\s*=\s*3000/);
  assert.match(script, /elements[.]activeNode[.]addEventListener\("pointerenter", startLongHoverPreview\)/);
  assert.doesNotMatch(script, /bindHoverPreview\(elements[.]sampleRack\)/);
  assert.match(script, /createWordChemistryGraph/);
  assert.match(html, /data-word="Mud" data-components="Earth[|]Water"/);
  assert.match(html, /data-word="Life" data-components="Earth[|]Water[|]Air[|]Fire" data-intermediates="Mud[|]Energy"/);
});

test("word nodes keep the word legible above a faint rotating structure", () => {
  assert.match(css, /[.]lab-word-node__label\s*\{[\s\S]*z-index:\s*2/);
  assert.match(css, /[.]lab-word-node__structure\s*\{[\s\S]*opacity:\s*var\(--node-structure-opacity\)/);
  assert.match(css, /animation:\s*node-chem-spin var\(--node-effective-motion-duration, var\(--node-motion-duration\)\) linear infinite/);
  assert.match(css, /[.]lab-hover-bubble\s*\{/);
  assert.match(css, /[.]lab-readout\s*\{[\s\S]*grid-template-columns:\s*repeat\(8, 1fr\)/);
  assert.match(css, /[.]lab-word-split__token\s*\{/);
  assert.match(css, /[.]lab-break-goal\s*\{/);
  assert.match(css, /[.]lab-molecule-3d__bond[.]is-goal-bond\s*\{/);
  assert.match(css, /width:\s*min\(504px,/);
  assert.match(css, /[.]lab-molecule-3d\s*\{[\s\S]*width:\s*380px[\s\S]*height:\s*380px/);
  assert.match(css, /[.]lab-hover-bubble\s*\{[\s\S]*pointer-events:\s*auto[\s\S]*touch-action:\s*none/);
  assert.match(css, /[.]lab-molecule-3d__scene\s*\{[\s\S]*transform-style:\s*preserve-3d[\s\S]*translate3d\(var\(--inspect-pan-x\), var\(--inspect-pan-y\), 0\)[\s\S]*scale\(var\(--inspect-zoom\)\)[\s\S]*rotateX\(var\(--inspect-rotate-x\)\)[\s\S]*rotateY\(var\(--inspect-rotate-y\)\)/);
  assert.match(css, /[.]lab-molecule-3d__atom\s*\{[\s\S]*radial-gradient/);
  assert.match(css, /[.]lab-molecule-3d__atom[.]is-selected\s*\{/);
  assert.match(css, /[.]lab-molecule-3d__atom[.]is-focused\s*\{/);
  assert.match(css, /[.]lab-molecule-3d__screen-label\s*\{[\s\S]*transform:\s*translate\(-50%, -50%\)[\s\S]*contain:\s*layout paint/);
  assert.match(css, /[.]lab-molecule-3d__bond\s*\{[\s\S]*rotateY\(var\(--bond-angle-y\)\)/);
  assert.match(css, /[.]lab-molecule-3d__bond-hit\s*\{[\s\S]*height:\s*22px[\s\S]*cursor:\s*pointer/);
  assert.match(css, /[.]lab-molecule-3d__atom\s*\{[\s\S]*z-index:\s*calc\(60 [+] var\(--atom-depth\)\)/);
  assert.match(css, /[.]lab-hover-bubble__cancel\s*\{[\s\S]*right:\s*68px[\s\S]*top:\s*68px/);
  assert.match(css, /[.]lab-hover-bubble__apply\s*\{[\s\S]*left:\s*50%[\s\S]*bottom:\s*22px/);
  assert.match(css, /[.]lab-bond-editor\s*\{/);
  assert.match(css, /data-quality="unstable"/);
  assert.match(css, /[.]lab-word-node--hero[.]is-hover-arming::after\s*\{[\s\S]*animation:\s*lab-hover-hold 3s linear forwards/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(script, /"--atom-color": accent/);
  assert.match(script, /"--bond-color": accent/);
  assert.match(css, /[.]lab-molecule-3d__atom--product\s*\{\s*--atom-fill-strength:\s*88%/);
  assert.match(css, /[.]lab-molecule-3d__atom\s*\{[\s\S]*transform-style:\s*flat/);
  assert.match(css, /[.]lab-molecule-3d__screen-label\s*\{[\s\S]*-webkit-text-stroke:[\s\S]*paint-order:\s*stroke fill/);
  assert.doesNotMatch(css, /[.]lab-molecule-3d__atom::before/);
  assert.doesNotMatch(css, /[.]lab-molecule-3d__atom::after/);
});

test("chemical graph complexity follows the recipe lineage", () => {
  const earth = createWordChemistryGraph(lineageFromComponents({ word: "Earth", components: ["Earth"] }));
  assert.deepEqual(
    { components: earth.componentCount, combinations: earth.combinationCount, bonds: earth.bondCount },
    { components: 1, combinations: 0, bonds: 0 }
  );

  const mud = createWordChemistryGraph(lineageFromComponents({ word: "Mud", components: ["Earth", "Water"] }));
  assert.deepEqual(
    { components: mud.componentCount, combinations: mud.combinationCount, bonds: mud.bondCount },
    { components: 2, combinations: 1, bonds: 2 }
  );

  const life = createWordChemistryGraph(lineageFromComponents({
    word: "Life",
    components: ["Earth", "Water", "Air", "Fire"],
    intermediates: ["Mud", "Energy"]
  }));
  assert.deepEqual(
    { components: life.componentCount, combinations: life.combinationCount, bonds: life.bondCount },
    { components: 4, combinations: 3, bonds: 7 }
  );
  assert.equal(life.nodes.length, 7);
  assert.ok(life.nodes.every((node) => Number.isFinite(node.z)), "every atom should carry a 3D depth coordinate");
  assert.ok(life.edges.some((edge) => edge.order === 2), "complex structures should include chemical double bonds");
  assert.ok(life.edges.some((edge) => edge.from === life.nodes[5].id && edge.to === life.nodes[0].id), "the complex scaffold should close into a molecular ring");
  assert.equal(life.edges.filter((edge) => edge.bondType === "recipe").length, 6);
  assert.equal(life.edges.filter((edge) => edge.bondType === "support").length, 1);
  assert.deepEqual(life.reactionRules.map((rule) => rule.output), ["Life", "Mud", "Energy"]);
  assert.deepEqual(life.reactions, [
    { inputs: ["Earth", "Water"], output: "Mud" },
    { inputs: ["Air", "Fire"], output: "Energy" },
    { inputs: ["Mud", "Energy"], output: "Life" }
  ]);
});
