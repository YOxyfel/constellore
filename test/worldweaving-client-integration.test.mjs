import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createDefaultProfile } from "../public/default-profile.mjs";
import { mergeExploreInventory } from "../public/explore-sandbox.mjs";
import { SECONDARY_SURFACE_FILES } from "../public/secondary-surface-loader.mjs";
import {
  createWorldweavingState,
  moonWorldweavingContext,
  moonWorldweavingView,
  recordWorldweavingCompletion,
  worldwordInventoryItem
} from "../public/worldweaving.mjs";
import { moonWorldweavingNavigation } from "../public/moon-worldweaving-runtime.mjs";

const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const defaults = await readFile(new URL("../public/default-profile.mjs", import.meta.url), "utf8");
const loader = await readFile(new URL("../public/secondary-surface-loader.mjs", import.meta.url), "utf8");
const moonController = await readFile(new URL("../public/moon-worldweaving-controller.mjs", import.meta.url), "utf8");
const moonRuntime = await readFile(new URL("../public/moon-worldweaving-runtime.mjs", import.meta.url), "utf8");
const moonResult = await readFile(new URL("../public/moon-result-presentation.mjs", import.meta.url), "utf8");
const moonStyles = await readFile(new URL("../public/moon-worldweaving.css", import.meta.url), "utf8");

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing source contract: ${start}`);
  assert.ok(to > from, `missing source boundary: ${end}`);
  return source.slice(from, to);
}

function profileFixture() {
  return createDefaultProfile({
    cosmeticLoadout: {},
    voyageProgress: {},
    routeProgression: {},
    remixReadiness: {}
  });
}

function terminal(a, b, word, extras = {}) {
  return { a, b, word, progressionEligible: true, routeCompleted: true, ...extras };
}

function install(state, slotId, choiceId, step, completedAt) {
  return recordWorldweavingCompletion(state, {
    context: moonWorldweavingContext(slotId, choiceId),
    history: [terminal("Earlier", "Route", "Memory"), step],
    completedAt
  });
}

function completedMoon() {
  let state = createWorldweavingState();
  state = install(state, "power", "solar", terminal("Power", "Sun", "Solar Power"), "2026-08-01T10:00:00Z").state;
  state = install(state, "shelter", "hive", terminal("Room", "Room", "House"), "2026-08-01T11:00:00Z").state;
  return install(state, "signal", "stars", terminal("Star", "Sky", "Constellation"), "2026-08-01T12:00:00Z").state;
}

test("Worldweaving navigation exposes a visible parent and a separate Home route", () => {
  assert.deepEqual(moonWorldweavingNavigation(), {
    origin: "home",
    backLabel: "Home",
    backAriaLabel: "Return flight to Home"
  });
  assert.deepEqual(moonWorldweavingNavigation({ origin: "outpost" }), {
    origin: "outpost",
    backLabel: "Moon Outpost",
    backAriaLabel: "Back to Moon Outpost"
  });
  assert.match(moonRuntime, /id="moonWorldBackKicker">RETURN FLIGHT/);
  assert.match(moonRuntime, /id="moonWorldBackLabel">Home/);
  assert.match(moonRuntime, /class="moon-worldweaving__close moon-worldweaving__back is-return-flight"/);
  assert.match(moonStyles, /[.]moon-worldweaving__back-emblem/);
  assert.match(moonStyles, /[.]moon-worldweaving__back-copy small/);
  assert.match(moonRuntime, /data-moon-action="main-menu"/);
  assert.match(moonRuntime, /data-moon-action="pane" data-moon-pane="scene">Scene/);
  assert.match(moonRuntime, /data-moon-action="pane" data-moon-pane="detail">Weave/);
  assert.match(moonRuntime, /data-moon-pane-content="scene"/);
  assert.match(moonRuntime, /data-moon-pane-content="detail"/);
  assert.match(moonRuntime, /elements[.]overflow[.]hidden = redundantMainMenu/);
  assert.match(moonRuntime, /if \(!actionBusy\) void navigateBack\(elements[.]close\)/);
});

test("profile version 10 creates an independent canonical Moon save and the client migrates it", () => {
  const first = profileFixture();
  const second = profileFixture();
  assert.equal(first.version, 10);
  assert.deepEqual(first.worldweaving, createWorldweavingState());
  first.worldweaving.worlds.moon.anchors.power = { forged: true };
  assert.equal(second.worldweaving.worlds.moon.anchors.power, null);

  assert.match(defaults, /version:\s*10/);
  assert.match(defaults, /worldweaving:\s*structuredClone\(worldweaving\)/);
  assert.match(app, /const worldweaving\s*=\s*sanitizeWorldweavingState\(stored[.]worldweaving\)/);
  assert.match(app, /worldweaving:\s*sanitizeWorldweavingState\(profile[.]worldweaving\)/);
  assert.match(app, /mergeWorldweavingStates\(localWorldweaving, incomingWorldweaving\)/);
  assert.match(app, /cloudPendingFields[\s\S]{0,260}"journeys"/);
});

test("the planetary journey keeps the normal Home orbit CTA and owns its own entry", () => {
  const homeState = section(app, "function homeMenuState()", "function primaryOrbitState()");
  assert.match(homeState, /moonWorldweaving\(\)[.]decorateHomeMenu\(menu\)/);
  const decoration = section(moonController, "function decorateHomeMenu(menu)", "function syncEntryState()");
  assert.match(decoration, /return menu/);
  assert.doesNotMatch(decoration, /menu[.]primary\s*=/);

  const eligibility = section(moonController, "function journeyEligible()", "async function open(");
  assert.match(eligibility, /Number\(current[.]wins\)\s*>\s*0/);
  assert.match(eligibility, /current[.]firstOrbit[?][.]completed\s*===\s*true/);
  assert.match(eligibility, /current[.]secondOrbit[?][.]completed\s*===\s*true/);
  const entryState = section(moonController, "function syncEntryState()", "function commitResult()");
  assert.match(entryState, /const eligible\s*=\s*journeyEligible\(\)/);
  assert.match(entryState, /homeButton[.]hidden\s*=\s*!eligible/);
  assert.match(entryState, /dataset[.]originWorld/);
  assert.match(entryState, /dataset[.]destinationWorld/);
  assert.match(app, /else if \(action === "worldweaving"\) await moonWorldweaving\(\)[.]open/);

  const menuButton = page.match(/<button\b(?=[^>]*id="moonWorldweavingMenuButton")[^>]*>/)?.[0] || "";
  assert.match(menuButton, /aria-haspopup="dialog"/);
  assert.match(menuButton, /\bhidden\b/);
});

test("host and lazy runtime consume the domain's exact Moon view fields", () => {
  const view = moonWorldweavingView(createWorldweavingState());
  assert.deepEqual(Object.keys(view).sort(), [
    "completed", "completedAnchors", "completion", "currentSlotId", "id",
    "outcomeKey", "progress", "slots", "title", "totalAnchors", "worldword"
  ]);
  assert.deepEqual(Object.keys(view.slots[0]).sort(), [
    "choiceId", "choices", "completedAt", "id", "memory", "status", "title"
  ]);
  assert.deepEqual(Object.keys(view.slots[0].choices[0]).sort(), ["id", "recipe", "target", "title"]);
  assert.deepEqual(Object.keys(view.slots[0].choices[0].recipe).sort(), ["a", "b", "key", "word"]);

  assert.match(moonRuntime, /view[?][.]currentSlotId/);
  assert.match(moonRuntime, /view[?][.]completedAnchors/);
  assert.match(moonRuntime, /view[?][.]totalAnchors/);
  assert.match(moonRuntime, /view[?][.]completed/);
  assert.match(moonRuntime, /presentedSlot[?][.]memory/);
  assert.match(moonRuntime, /presentedSlot[.]choiceId/);
  assert.match(moonResult, /moon[.]slots[.]find\(\(candidate\) => candidate[.]id === game[.]journeyContext[?][.]slotId\)/);
});

test("winning result flow records the exact final pair and renders persisted memory fields", () => {
  let state = install(
    createWorldweavingState(),
    "power",
    "solar",
    terminal("Sun", "Power", "Solar Power"),
    "2026-08-01T10:00:00Z"
  ).state;
  const wrongHouse = install(
    state,
    "shelter",
    "hive",
    terminal("Wall", "Wall", "House"),
    "2026-08-01T11:00:00Z"
  );
  assert.equal(wrongHouse.advanced, false);
  assert.equal(wrongHouse.reason, "wrong_recipe");
  const exactHouse = install(
    state,
    "shelter",
    "hive",
    terminal("Room", "Room", "House"),
    "2026-08-01T11:00:00Z"
  );
  assert.equal(exactHouse.advanced, true);

  const commit = section(moonController, "function commitResult()", "function continueFromResult(");
  assert.match(commit, /state[.]journeyContext[?][.]kind !== "worldweaving"/);
  assert.match(commit, /state[.]reveal[.]revealed/);
  assert.match(commit, /recordWorldweavingCompletion\(current[.]worldweaving/);
  assert.match(commit, /context:\s*state[.]journeyContext/);
  assert.match(commit, /history:\s*state[.]history/);
  assert.match(commit, /current[.]worldweaving\s*=\s*outcome[.]state/);
  assert.match(commit, /if \(!outcome[.]advanced\) return outcome/);

  assert.match(moonResult, /const recipe = outcome[.]anchor[?][.]memory \|\| game[.]history/);
  assert.match(moonResult, /slot[?][.]choices[.]find\(\(candidate\) => candidate[.]id === outcome[.]anchor[?][.]choiceId\)/);
  assert.doesNotMatch(moonResult, /anchor[?][.](?:recipe|slotLabel|choiceLabel|consequence)/);
  assert.match(app, /const worldweavingOutcome = won \? commitWorldweavingResult\(\) : null/);
  assert.match(app, /renderWorldweavingResult\(worldweavingOutcome\)/);
});

test("the result dialog contains one bounded Worldweaving card and the awakening handoff", () => {
  const ids = [
    "worldweavingResultCard",
    "worldweavingResultKicker",
    "worldweavingResultTitle",
    "worldweavingResultRecipe",
    "worldweavingResultConsequence"
  ];
  for (const id of ids) {
    assert.equal((page.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `#${id} must exist exactly once`);
  }
  const card = page.match(/<section class="worldweaving-result-card"[\s\S]*?<\/section>/)?.[0] || "";
  assert.match(card, /id="worldweavingResultCard"[^>]*hidden/);
  assert.match(card, /aria-labelledby="worldweavingResultTitle"/);
  assert.match(card, /id="worldweavingResultRecipe"/);

  const result = section(moonController, "function renderResult(outcome)", "return Object.freeze(");
  assert.match(result, /card[.]hidden = !presentation[?][.]visible/);
  assert.match(moonResult, /outcome[.]worldwordUnlocked \? "WORLDWORD AWAKENING"/);
  assert.match(moonResult, /Rocket \+ Moon has awakened Lander/);
  assert.match(result, /continueFromResult\(\{ awakening: presentation[.]awakening \}\)/);
});

test("the first Power awakening announces that Moon Home is now selectable", async () => {
  const runtime = await readFile(new URL("../public/moon-worldweaving-runtime.mjs", import.meta.url), "utf8");

  assert.match(runtime, /newest[?][.]id === ["']power["']/);
  assert.match(runtime, /Moon Home unlocked/);
  assert.match(runtime, /choose it as a full Home world/);
});

test("Moon presentation assets remain lazy and are declared for release packaging", () => {
  assert.doesNotMatch(page, /<link[^>]+moon-worldweaving[.]css/);
  assert.doesNotMatch(page, /<script[^>]+moon-worldweaving-runtime[.]mjs/);
  assert.match(loader, /export async function createLazyMoonWorldweaving/);
  assert.match(loader, /loadOptionalStylesheet\("moon-worldweaving[.]css[?]v=/);
  assert.match(loader, /import\("[.]\/moon-worldweaving-runtime[.]mjs[?]v=/);
  assert.equal(SECONDARY_SURFACE_FILES.includes("moon-worldweaving.css"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("moon-worldweaving-runtime.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("moon-result-presentation.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("worldweaving.mjs"), false, "the eagerly imported domain module belongs in the core shell");
  assert.match(app, /createMoonWorldweavingController/);
  assert.match(moonController, /host[.]loadSecondarySurfaceModule\(\)[\s\S]*module[.]createLazyMoonWorldweaving/);
});

test("Worldweaving choice hover and focus treatments stay inside their scrollport", () => {
  const rail = section(
    moonStyles,
    ".moon-worldweaving__choices {",
    ".moon-worldweaving__choice {"
  );
  const card = section(
    moonStyles,
    ".moon-worldweaving__choice {",
    ".moon-worldweaving__choice::after {"
  );
  const hover = section(
    moonStyles,
    ".moon-worldweaving__choice:hover:not(:disabled) {",
    ".moon-worldweaving__choice:disabled,"
  );
  const decoration = section(
    moonStyles,
    ".moon-worldweaving__choice::after {",
    ".moon-worldweaving__choice > * {"
  );
  const padding = rail.match(/padding:\s*(\d+)px\s+(\d+)px\s+(\d+)px/);
  const mobileRail = section(
    moonStyles,
    "@media (max-width: 700px), (orientation: portrait) and (max-width: 900px) {",
    "@media (max-width: 360px) {"
  );

  assert.ok(padding, "the choice rail must reserve explicit paint space");
  assert.ok(Number(padding[1]) >= 7, "top paint space must contain the 2px lift and 5px focus treatment");
  assert.ok(Number(padding[2]) >= 5, "inline paint space must contain the offset focus treatment");
  assert.match(rail, /grid-template-columns:\s*repeat\(auto-fit/);
  assert.match(rail, /overflow:\s*visible/, "desktop hover glow must not be clipped by an unnecessary scroller");
  assert.match(mobileRail, /moon-worldweaving__choices\s*\{[\s\S]*?grid-template-columns:\s*none[\s\S]*?overflow-x:\s*auto/);
  assert.match(card, /overflow:\s*hidden/, "card artwork remains clipped to its own rounded shape");
  assert.match(decoration, /top:\s*50%/);
  assert.match(decoration, /right:\s*8px/);
  assert.match(decoration, /repeating-radial-gradient/);
  assert.doesNotMatch(decoration, /top:\s*-/, "the concentric ornament must not begin outside the card");
  assert.match(hover, /transform:\s*translateY\(-2px\)/);
});

test("the unlocked Lander is merged into Explore and retains a visible Worldword identity", () => {
  const state = completedMoon();
  const item = worldwordInventoryItem(state);
  assert.equal(item?.word, "Lander");
  assert.deepEqual(
    [item?.provenance?.recipe?.a, item?.provenance?.recipe?.b, item?.provenance?.recipe?.word],
    ["Rocket", "Moon", "Lander"]
  );
  const inventory = mergeExploreInventory([], item);
  const lander = inventory.find((entry) => entry.word === "Lander");
  assert.ok(lander, "Lander must enter the Explore shelf");
  assert.equal(lander.source, item.source, "Explore sanitization must retain the Worldword source identity");

  const explore = section(moonResult, "async function beginWorldwordExplore(", "return Object.freeze(");
  assert.match(explore, /worldwordInventoryItem\(current[.]worldweaving\)/);
  assert.match(moonController, /current[.]exploreWords = host[.]mergeExploreInventory\(current[.]exploreWords, item\)/);
  assert.match(moonController, /current[.]discovered[.]push\(item[.]word\)/);
  assert.match(explore, /host[.]saveProfile\(\{ fields: \["journeys", "mastery"\] \}\)/);
  assert.match(explore, /await host[.]startExplore\(\{ enterThroughGate: true, trigger \}\)/);

  const escapedSource = item.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    app,
    new RegExp(`item[.]source === "${escapedSource}"`),
    `tray and board rendering must recognize the inventory source emitted for ${item.word}`
  );
});
