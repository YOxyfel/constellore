import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MOON_SETTLEMENT_SNAPSHOT_COUNT } from "../public/moon-settlement-persistence.mjs";

const [html, css, runtime, persistence] = await Promise.all([
  readFile(new URL("../public/moon-settlement-lab.html", import.meta.url), "utf8"),
  readFile(new URL("../public/moon-settlement-lab.css", import.meta.url), "utf8"),
  readFile(new URL("../public/moon-settlement-lab.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/moon-settlement-persistence.mjs", import.meta.url), "utf8")
]);

function hasId(source, id) {
  return new RegExp(`\\bid=["']${id}["']`).test(source);
}

test("the Gate 1 page is an isolated lab route with an explicit module boundary", () => {
  assert.match(html, /<link[^>]+href=["']\/moon-settlement-lab[.]css["']/);
  assert.match(html, /<script[^>]+type=["']module["'][^>]+src=["']\/moon-settlement-lab[.]mjs["']/);
  assert.match(html, /<title>Moon Settlement Lab · Constellore<\/title>/);

  const importSpecifiers = [...runtime.matchAll(/\bfrom\s+["']([^"']+)["']/g)]
    .map((match) => match[1].split("?", 1)[0])
    .sort();
  assert.deepEqual(importSpecifiers, [
    "./moon-settlement-domain.mjs",
    "./moon-settlement-persistence.mjs",
    "./moon-settlement-placement.mjs",
    "./moon-settlement-presentation.mjs",
    "./moon-settlement-renderer.mjs",
    "./moon-settlement-timeline.mjs"
  ]);
  assert.doesNotMatch(runtime, /\bfrom\s+["'][^"']*(?:worldweav|outpost|planet-hub|world-travel)[^"']*["']/i,
    "the disposable lab must not import production Moon or Worldweaving state");
  assert.match(runtime, /const LAB_SAVE_KEY = ["']constellore:moon-settlement-lab:living-ground:v\d+["'];/,
    "the lab save remains separately versioned");
});

test("the shell exposes one accessible visor action plus exact-review controls", () => {
  for (const id of [
    "settlementApp",
    "settlementCanvasHost",
    "settlementHotspots",
    "settlementAnnouncer",
    "visorFrame",
    "primaryAction",
    "primaryActionStatus",
    "primaryActionProgress",
    "objectiveActions",
    "foundingChoiceSheet",
    "parcelPlacementBar",
    "parcelPlacementConfirm",
    "parcelPlacementCancel",
    "inspectPanel",
    "weaveLayer",
    "weaveCanvasHost",
    "weaveAccessibleGraph",
    "weaveConsequences",
    "weaveApply",
    "weaveCancel",
    "settingsPanel",
    "developerToolkit"
  ]) {
    assert.equal(hasId(html, id), true, `missing required #${id} contract`);
  }

  assert.match(html, /href=["']#settlementCanvasHost["'][^>]*>Skip to the Moon<\/a>/);
  assert.match(html, /id=["']settlementCanvasHost["'][^>]+tabindex=["']0["'][^>]+role=["']application["'][^>]+aria-label=/);
  assert.match(html, /id=["']settlementHotspots["'][^>]+role=["']group["'][^>]+aria-label=/);
  assert.match(html, /id=["']weaveCanvasHost["'][^>]+tabindex=["']0["'][^>]+role=["']application["'][^>]+aria-label=/);
  assert.match(html, /id=["']settlementAnnouncer["'][^>]+aria-live=["']polite["'][^>]+aria-atomic=["']true["']/);
  assert.match(html, /<button(?=[^>]*\bid=["']primaryAction["'])(?=[^>]*\btype=["']button["'])(?=[^>]*\baria-describedby=["'][^"']*\bprimaryActionStatus\b[^"']*["'])[^>]*>/,
    "the one visible action is a native button with its current consequence described");
  assert.match(html, /id=["']primaryActionStatus["'][^>]+role=["']status["']/,
    "the current action description remains available to assistive technology");
  assert.match(html, /<progress(?=[^>]*\bid=["']primaryActionProgress["'])(?=[^>]*\bmax=["']100["'])(?=[^>]*\bvalue=["'](?:0|[1-9]\d?|100)["'])[^>]*>/,
    "hold progress is exposed as a native, bounded 0 to 100 progressbar");
  assert.match(html, /<[^>]+(?=[^>]*\bid=["']visorFrame["'])(?=[^>]*\baria-hidden=["']true["'])[^>]*>/,
    "the suit visor is decorative rather than extra screen-reader noise");
  assert.match(html, /<header(?=[^>]*\bclass=["'][^"']*\bsettlement-hud\b[^"']*["'])(?=[^>]*\bhidden(?:\s|=|>))[^>]*>/,
    "the legacy resource header is not a persistent play HUD");
  assert.match(html, /<nav(?=[^>]*\bclass=["'][^"']*\bmode-dock\b[^"']*["'])(?=[^>]*\bhidden(?:\s|=|>))[^>]*>/,
    "Walk, Inspect, and Weave are no longer a persistent mode dock");
  assert.match(html, /<nav class=["']weave-tools["'] aria-label=["']Weave tools["']>[\s\S]*>Scan<[\s\S]*>Separate<[\s\S]*>Join<[\s\S]*>Connect<[\s\S]*>Test</);
  assert.match(html, /id=["']weaveCancel["'][^>]+aria-label=["']Cancel structure draft["']/);
});

test("pointer and keyboard input share the same derived hold-to-activate action", () => {
  assert.match(runtime, /function derivePrimaryAction\([^)]*\)\s*\{/);
  assert.match(runtime, /(?:async\s+)?function activatePrimaryAction\([^)]*\)\s*\{/);
  assert.match(runtime, /function startPrimaryActionHold\([^)]*\)\s*\{/);
  assert.match(runtime, /function cancelPrimaryActionHold\([^)]*\)\s*\{/);
  assert.match(runtime, /function completePrimaryActionHold\([^)]*\)\s*\{[\s\S]{0,800}?activatePrimaryAction\(/,
    "a completed pointer, keyboard, or controller hold reaches one activation function");
  assert.match(runtime, /elements[.]primaryAction[?]?[.]addEventListener\(["']pointerdown["'][\s\S]{0,300}?startPrimaryActionHold\(/,
    "pressing the visible action begins the shared hold path");
  assert.match(runtime, /event[.]key[.]toLowerCase\(\) === ["']e["'][\s\S]{0,500}?startPrimaryActionHold\(/,
    "E begins the same hold path as the native action button");
  assert.match(runtime, /elements[.]primaryAction[?]?[.]addEventListener\(["'](?:pointerup|pointercancel|pointerleave)["'][\s\S]{0,300}?cancelPrimaryActionHold\(/,
    "releasing or leaving the action cancels an incomplete hold");
  assert.match(runtime, /derivePrimaryAction\([\s\S]{0,800}?activatePrimaryAction\(/,
    "rendered action intent and committed action share the same resolver");
  assert.doesNotMatch(runtime, /event[.]key[.]toLowerCase\(\) === ["']e["'][\s\S]{0,500}?availableActions\(\)\[0\]/,
    "E must not bypass the focused visor action by taking the first globally available action");
});

test("the physical world and semantic Weave use separate renderer hosts", () => {
  assert.match(runtime, /host:\s*elements[.]canvasHost[\s\S]*?const weaveRenderer = createMoonSettlementRenderer\(\{[\s\S]*?host:\s*elements[.]weaveHost/);
  assert.match(runtime, /assets:\s*\{\s*low:\s*\{\},\s*standard:\s*\{\}\s*\}/,
    "the focused Weave renderer does not duplicate world GLB assets");
  assert.match(runtime, /worldRenderer[.]sync\(spatialProjection\(projection\)\)/);
  assert.match(runtime, /weaveRenderer[.]sync\(\{\s*revision:\s*state[.]revision,\s*structures:\s*\[\],\s*weave:\s*null\s*\}\)/);
});

test("the opening composition and reset keep an authored settlement focus", () => {
  assert.match(runtime, /projection[.]stage === ["']landing["'] \? ["']starter-vault["'] : openingScene[.]objectiveTargetId \|\| ["']lander["']/);
  assert.match(runtime, /distance: projection[.]stage === ["']landing["'] \? 15[.]5 : 17[.]5/,
    "metre-scale structures open at a readable settlement distance");
  assert.match(runtime, /worldRenderer[.]focus\(["']lander["'], \{ distance: 30, yaw: Math[.]PI, pitch: 0[.]68, resetWorld: true \}\)/,
    "reset frames the aligned district from the arrival side");
  assert.match(css, /data-settlement-cue=["']objective["']/);
});

test("construction placement exposes snapped pointer and keyboard controls before commit", () => {
  assert.match(html, /id=["']parcelPlacementBar["'][^>]+aria-labelledby=["']parcelPlacementTitle["'][^>]+aria-describedby=["']parcelPlacementStatus["']/);
  assert.match(html, /data-placement-rotate=["']-1["'][\s\S]*data-placement-rotate=["']1["']/);
  assert.equal(hasId(html, "parcelPlacementConfirm"), true);
  assert.equal(hasId(html, "parcelPlacementCancel"), true);
  assert.match(runtime, /let placementDraft = null;/);
  assert.match(runtime, /target[?][.]kind === ["']parcel-cell["'][\s\S]*setPlacementCell/);
  assert.match(runtime, /ArrowLeft:[\s]*\[-1, 0\][\s\S]*ArrowDown:[\s]*\[0, 1\]/);
  assert.match(runtime, /\[["']q["'], ["']r["']\][.]includes[\s\S]*rotatePlacement/);
  assert.match(runtime, /event[.]key === ["']Enter["'] \|\| event[.]key[.]toLowerCase\(\) === ["']e["'][\s\S]*confirmPlacement/);
  assert.match(runtime, /event[.]key === ["']Escape["'][\s\S]*cancelPlacement/);
  assert.match(runtime, /placementConfirm[.]disabled = !valid/);
  assert.match(css, /[.]parcel-placement[\s\S]*data-valid=["']false["']/);
  assert.match(css, /moon-settlement-fallback__hotspot--parcel-cell/,
    "2.5D fallback retains exact parcel cell controls");
});

test("Apply is unavailable until an explicit successful Test", () => {
  assert.match(html, /id=["']weaveApply["'][^>]*\sdisabled(?:\s|>)/,
    "Apply starts disabled in markup");
  assert.match(runtime, /let activeDraftTested = false;/);
  assert.match(runtime, /if \(tool === ["']test["']\) \{\s*activeDraftTested = true;/);
  assert.match(runtime, /elements[.]weaveApply[.]disabled = !activeDraftTested \|\| !quoteAllowed\(preview\);/);
  assert.match(runtime, /if \(!activeDraft \|\| !activeDraftOperation \|\| !activeDraftTested \|\| busy\) \{[\s\S]*?Test the draft before Apply[.]/);
  assert.match(runtime, /elements[.]weaveCancel[?][.]addEventListener\(["']click["'], cancelDraft\)/);
});

test("persistence rotates exactly three validated snapshots under the lab key", () => {
  assert.equal(MOON_SETTLEMENT_SNAPSHOT_COUNT, 3);
  assert.match(runtime, /createMoonSettlementStorage\(\{\s*storage:\s*localStorage,\s*sanitize:\s*sanitizeMoonSettlement,\s*key:\s*LAB_SAVE_KEY\s*\}\)/);
  assert.match(persistence, /for \(let slot = 0; slot < MOON_SETTLEMENT_SNAPSHOT_COUNT; slot \+= 1\)/);
  assert.match(persistence, /const slot = snapshot[.]revision % MOON_SETTLEMENT_SNAPSHOT_COUNT;/);
  assert.match(persistence, /readMoonSettlementSnapshot\(JSON[.]parse\(value\), options\)/,
    "stored revisions are validated while recovering snapshots");
});

test("developer, fallback, reduced-motion, and noncolor behavior remain explicit opt-in hooks", () => {
  assert.match(html, /<details id=["']developerToolkit["'][^>]+hidden>/);
  assert.match(runtime, /new URLSearchParams\(location[.]search\)[.]get\(["']toolkit["']\) === ["']1["'][\s\S]*?elements[.]developerToolkit[.]hidden = false;/,
    "developer controls are revealed only by the explicit ?toolkit=1 flag");

  assert.match(html, /<option value=["']fallback["']>2[.]5D fallback<\/option>/);
  assert.match(html, /id=["']settingReducedMotion["'][^>]+type=["']checkbox["']/);
  assert.match(html, /id=["']settingNonColor["'][^>]+type=["']checkbox["']/);
  assert.match(runtime, /quality:\s*\[["']low["'], ["']fallback["']\][.]includes\(savedSettings[.]quality\)/);
  assert.match(runtime, /document[.]body[.]dataset[.]motion = settings[.]reducedMotion \? ["']reduced["'] : ["']full["'];/);
  assert.match(runtime, /document[.]body[.]dataset[.]noncolor = String\(settings[.]nonColor\);/);
  assert.match(css, /[.]moon-settlement-renderer--fallback/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /body\[data-motion=["']reduced["']\]/);
  assert.match(css, /body\[data-noncolor=["']true["']\]/);
});

test("live production, Weave focus, and scientific readouts stay truthful", () => {
  assert.match(runtime, /function scheduleProductionReadiness\(\)/);
  assert.match(runtime, /setTimeout\(\(\) => \{[\s\S]*?The first greenhouse batch is ready to collect[.]/,
    "a running batch refreshes without a reload when readyAt passes");
  assert.match(html, /id=["']weaveLayer["'][^>]+role=["']dialog["'][^>]+aria-modal=["']true["'][^>]+tabindex=["']-1["']/);
  assert.match(runtime, /setWeaveBackgroundInert\(mode === ["']weave["']\)/);
  assert.match(runtime, /mode === ["']weave["'] && event[.]key === ["']Tab["']/);
  assert.match(runtime, /elements[.]weaveCohesion[.]textContent = `Cohesion \$\{numeric\(preview[?][.]cohesion[?][.]spent\)\} \/ \$\{numeric\(preview[?][.]cohesion[?][.]available\)\}`/);
  assert.match(runtime, /elements[.]weaveBondTier[.]textContent = selectedBond/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*[.]consequence-tray dl[\s\S]*overflow-x:\s*auto/,
    "compact layouts retain the exact consequence values");
});
