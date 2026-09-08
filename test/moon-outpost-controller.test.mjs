import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultProfile } from "../public/default-profile.mjs";
import { selectExpeditionHomeWorld } from "../public/expedition.mjs";
import {
  moonHeartProjectCatalog,
  moonHeartProjectContext
} from "../public/moon-heart-project.mjs";
import {
  createMoonHeartProjectModel,
  moonHeartChoiceFailureMessage
} from "../public/moon-heart-project-presentation.mjs";
import { createMoonHeartActions } from "../public/moon-heart-actions.mjs";
import {
  createMoonResultPresentation,
  createMoonWorldweavingActions
} from "../public/moon-result-presentation.mjs";
import { createMoonOutpostActions } from "../public/moon-outpost-actions.mjs";
import {
  createMoonOutpostCacheReceipt,
  createMoonOutpostModel,
  moonOutpostCacheFailureMessage,
  moonOutpostLaunchMessage,
  moonOutpostSelectionMessage,
  moonOutpostStructureSuccessMessage,
  moonOutpostStructureFailureMessage
} from "../public/moon-outpost-presentation.mjs";
import { createMoonWorldweavingController } from "../public/moon-worldweaving-controller.mjs";
import {
  createWorldweavingState,
  moonWorldweavingContext,
  recordWorldweavingCompletion
} from "../public/worldweaving.mjs";

function completedMoon() {
  const routes = [
    ["power", "solar", { a: "Sun", b: "Power", word: "Solar Power" }],
    ["shelter", "haven", { a: "Adobe", b: "Construction", word: "House" }],
    ["signal", "beacon", { a: "Light", b: "Light", word: "Laser" }]
  ];
  let state = createWorldweavingState();
  for (const [slotId, choiceId, step] of routes) {
    state = recordWorldweavingCompletion(state, {
      context: moonWorldweavingContext(slotId, choiceId),
      history: [{ ...step, routeCompleted: true, progressionEligible: true }],
      completedAt: "2026-08-01T12:00:00.000Z"
    }).state;
  }
  return state;
}

function harness({
  activeRun = false,
  worldweaving = completedMoon(),
  documentElements = {},
  wins = 1,
  onboardingComplete = false,
  journeyReturn = false
} = {}) {
  const profile = createDefaultProfile({
    cosmeticLoadout: {},
    voyageProgress: {},
    routeProgression: {},
    remixReadiness: {},
    worldweaving
  });
  profile.wins = wins;
  if (onboardingComplete) {
    profile.firstOrbit = { seen: true, completed: true };
    profile.secondOrbit = { seen: true, completed: true };
  }
  profile.stardust = 500;
  let outpostOptions;
  let heartOptions;
  let worldweavingOptions;
  const saves = [];
  const toasts = [];
  const beginModeCalls = [];
  const returnHomeCalls = [];
  const journeyReturnCalls = [];
  const state = {
    startingRun: false,
    journeyContext: null,
    history: [],
    reveal: { revealed: false },
    scoringDisabled: false,
    assist: "none",
    run: { id: "heart-run-1", scoreEligible: true }
  };
  const runtime = {
    openCalls: 0,
    closeCalls: 0,
    renderCalls: 0,
    showOverviewCalls: 0,
    open(options) { this.openCalls += 1; this.lastOpenOptions = options; return true; },
    close() { this.closeCalls += 1; return true; },
    render() { this.renderCalls += 1; return true; },
    showOverview() { this.showOverviewCalls += 1; return true; },
    cacheReceipt: createMoonOutpostCacheReceipt,
    cacheFailureMessage: moonOutpostCacheFailureMessage,
    launchMessage: moonOutpostLaunchMessage,
    selectionMessage: moonOutpostSelectionMessage,
    structureSuccessMessage: moonOutpostStructureSuccessMessage,
    structureFailureMessage: moonOutpostStructureFailureMessage
  };
  const heartRuntime = {
    openCalls: [],
    closeCalls: 0,
    renderCalls: 0,
    open(options) { this.openCalls.push(options); return true; },
    close() { this.closeCalls += 1; return true; },
    render() { this.renderCalls += 1; return true; },
    choiceFailureMessage: moonHeartChoiceFailureMessage
  };
  const worldweavingRuntime = {
    openCalls: [],
    closeCalls: 0,
    renderCalls: 0,
    open(options) { this.openCalls.push(options); return true; },
    close() { this.closeCalls += 1; return true; },
    render() { this.renderCalls += 1; return true; }
  };
  const loader = {
    createMoonResultPresentation,
    createMoonWorldweavingActions,
    createMoonOutpostActions,
    createMoonHeartActions,
    createLazyMoonOutpost(options) {
      outpostOptions = options;
      return runtime;
    },
    createLazyMoonHeartProject(options) {
      heartOptions = options;
      return heartRuntime;
    },
    createLazyMoonWorldweaving(options) {
      worldweavingOptions = options;
      return worldweavingRuntime;
    }
  };
  const host = {
    documentRef: { activeElement: null, getElementById: (id) => documentElements[id] || null },
    requestFrame: (callback) => callback(),
    getProfile: () => profile,
    getState: () => state,
    getElements: () => ({ resultDialog: { open: false, close() { this.open = false; } } }),
    loadSecondarySurfaceModule: async () => loader,
    mergeExploreInventory: (items, item) => [...items, item],
    inventoryKey: (value) => String(value).toLowerCase(),
    cosmeticOwnershipOptions: () => ({
      itemIds: profile.expedition.salvageCosmeticIds,
      progress: { routeRank: { number: 1 }, wins: 1, discoveries: [] }
    }),
    isRunActive: () => activeRun,
    saveProfile: (options) => saves.push(options),
    returnHome: (options) => returnHomeCalls.push(options),
    closeHubMenu: () => {},
    resumeTimerIfNeeded: () => {},
    showToast: (message) => toasts.push(message),
    showSecondarySurfaceFailure: (error) => { throw error; },
    track: () => {},
    primaryTrigger: () => null,
    beginMode: async (...args) => { beginModeCalls.push(args); }
  };
  if (journeyReturn) {
    host.returnJourneyHome = async (options) => {
      journeyReturnCalls.push(options);
      return true;
    };
  }
  const controller = createMoonWorldweavingController(host);
  return {
    beginModeCalls,
    controller,
    heartRuntime,
    profile,
    runtime,
    worldweavingRuntime,
    journeyReturnCalls,
    returnHomeCalls,
    saves,
    state,
    toasts,
    get heartOptions() { return heartOptions; },
    get options() { return outpostOptions; },
    get worldweavingOptions() { return worldweavingOptions; }
  };
}

function heartRoute(game, milestoneId, variant = 0) {
  const context = moonHeartProjectContext(milestoneId);
  assert.ok(context, `expected authored Heart context for ${milestoneId}`);
  const history = [{
    a: `Project source ${milestoneId} ${variant}`,
    b: `Project proof ${milestoneId} ${variant}`,
    word: context.target,
    source: "world",
    routeCompleted: true,
    progressionEligible: true
  }];
  game.state.journeyContext = context;
  game.state.history = history;
  game.state.reveal = { revealed: false };
  game.state.scoringDisabled = false;
  game.state.assist = "none";
  game.state.run = { id: `heart-run-${milestoneId}-${variant}`, scoreEligible: true };
  return game.controller.recordRoute(history);
}

function completeHeartChapters(game, chapterCount) {
  const chapters = moonHeartProjectCatalog().chapters.slice(0, chapterCount);
  for (const finding of chapters.flatMap((chapter) => chapter.findings)) {
    const outcome = heartRoute(game, finding.id);
    assert.equal(outcome.project?.recorded, true, `${finding.id} should record`);
  }
}

const settleAsync = () => new Promise((resolve) => setImmediate(resolve));

function journeyImage(decode = () => Promise.resolve()) {
  const attributes = new Map();
  return {
    complete: false,
    decode,
    getAttribute: (name) => attributes.get(name) || "",
    setAttribute: (name, value) => attributes.set(name, String(value))
  };
}

test("a completed Moon enters the live Outpost model with four disclosed cache tiers", async () => {
  const game = harness();
  assert.equal(await game.controller.open(), true);
  assert.equal(game.runtime.openCalls, 1);
  const model = createMoonOutpostModel(game.options.getWorldweavingView(), game.options.getOutpostState());
  assert.equal(model.slots.length, 3);
  assert.equal(model.slots[0].simulator.name.includes("Lunar Dynamo"), true);
  assert.deepEqual(model.cache.tiers.map(({ id }) => id), ["common", "rare", "epic", "mythic"]);
  assert.equal(model.cache.tiers[0].capabilityLocked, false);
  assert.equal(model.cache.tiers[2].capabilityLocked, true);
  assert.equal(model.rocket.layers.hull, "./art/moon-outpost/rocket-core-v1.png");
});

test("the completed Moon Home rocket opens the active Great Project instead of the Outpost", async () => {
  const game = harness();
  const destination = game.controller.homeProject();
  assert.equal(destination.surface, "heart");
  assert.equal(destination.title, "The Heart");
  assert.match(destination.status, /^0 of 16 experiments/);

  const trigger = { id: "home-rocket" };
  assert.equal(await game.controller.openCurrentProject({ trigger }), true);
  assert.equal(game.runtime.openCalls, 0);
  assert.deepEqual(game.heartRuntime.openCalls, [{
    opener: trigger,
    focusChapterId: "",
    navigation: { origin: "home" }
  }]);
});

test("the planetary Home scene launches once, then continues from the arrived world", async () => {
  const weaving = harness({ worldweaving: createWorldweavingState() });
  const first = weaving.controller.homeProject();
  assert.equal(first.surface, "worldweaving");
  assert.equal(first.journey.origin.id, "earth");
  assert.equal(first.journey.destination.id, "moon");
  assert.equal(first.journey.launchReady, true);
  assert.equal(first.journey.actionKind, "launch");

  weaving.controller.recordArrival("moon", { at: new Date("2026-08-01T12:00:00.000Z") });
  const continued = weaving.controller.homeProject();
  assert.equal(continued.journey.origin.id, "moon");
  assert.equal(continued.journey.destination.id, "moon");
  assert.equal(continued.journey.launchReady, false);
  assert.equal(continued.journey.actionKind, "continue");
  assert.equal(continued.journey.action, "Continue Shape the Moon");

  weaving.profile.expedition = selectExpeditionHomeWorld(
    weaving.profile.expedition,
    "earth",
    { worldweaving: weaving.profile.worldweaving }
  );
  const returnedToEarth = weaving.controller.homeProject();
  assert.equal(returnedToEarth.journey.origin.id, "earth");
  assert.equal(returnedToEarth.journey.destination.id, "moon");
  assert.equal(returnedToEarth.journey.actionKind, "continue",
    "confirmed Moon progress remains continuation authority after returning Home to Earth");
  assert.equal(returnedToEarth.journey.launchReady, true);
  assert.equal(returnedToEarth.journey.action, "Return to Moon");

  const game = harness();
  const groundedHeart = game.controller.homeProject();
  assert.equal(groundedHeart.surface, "heart");
  assert.equal(groundedHeart.journey.origin.id, "earth");
  assert.equal(groundedHeart.journey.destination.id, "moon");
  assert.equal(groundedHeart.journey.actionKind, "launch", "Moon project data cannot bypass a saved Earth arrival");

  const legacy = harness();
  delete legacy.profile.expedition.activeWorldId;
  delete legacy.profile.expedition.homeWorldId;
  const inferredLegacyHeart = legacy.controller.homeProject();
  assert.equal(inferredLegacyHeart.journey.origin.id, "earth");
  assert.equal(inferredLegacyHeart.journey.actionKind, "continue", "legacy progress still proves Moon arrival when location is absent");
  assert.equal(inferredLegacyHeart.journey.action, "Return to Moon",
    "legacy saves deliberately begin at the safe Earth presentation while retaining Moon progress");

  game.controller.recordArrival("moon", { at: new Date("2026-08-01T12:00:00.000Z") });
  const heart = game.controller.homeProject();
  assert.equal(heart.surface, "heart");
  assert.equal(heart.journey.origin.id, "moon");
  assert.equal(heart.journey.destination.id, "moon");
  assert.equal(heart.journey.actionKind, "continue");
  assert.equal(heart.journey.action, "Continue The Heart");

  completeHeartChapters(game, 3);
  await game.controller.openHeartProject();
  assert.equal((await game.heartOptions.onChooseSettlement({ choiceId: "commons" })).ok, true);
  for (const finding of moonHeartProjectCatalog().chapters[3].findings) heartRoute(game, finding.id);
  heartRoute(game, moonHeartProjectCatalog().finale.id);
  game.controller.commitResult();

  const next = game.controller.homeProject();
  assert.equal(next.surface, "outpost");
  assert.equal(next.journey.origin.id, "moon");
  assert.equal(next.journey.destination.id, "mars");
  assert.equal(next.journey.state, "preparing");
  assert.equal(next.journey.launchReady, false);
  assert.equal(next.journey.actionKind, "preparing");
  assert.equal(next.journey.action, "Mars voyage preparing");
});

test("both tutorial Orbits unlock the Earth-to-Moon rocket without requiring an extra scored win", async () => {
  const homeButton = {
    hidden: true,
    disabled: true,
    dataset: {},
    querySelector: () => null,
    setAttribute() {}
  };
  const game = harness({
    wins: 0,
    onboardingComplete: true,
    worldweaving: createWorldweavingState(),
    documentElements: { moonHomeRocket: homeButton }
  });

  game.controller.syncEntryState();
  assert.equal(homeButton.hidden, false);
  assert.equal(homeButton.disabled, false);
  assert.equal(homeButton.dataset.journeyAction, "launch");
  assert.equal(await game.controller.openCurrentProject({ trigger: homeButton }), true);
  assert.equal(game.worldweavingRuntime.openCalls.length, 1);
});

test("Home Journey art is decoded before the launch blackout handoff settles", async () => {
  let releasePlatform;
  const platformDecoded = new Promise((resolve) => { releasePlatform = resolve; });
  const rocket = journeyImage();
  const platform = journeyImage(() => platformDecoded);
  const destination = journeyImage(() => Promise.reject(new Error("optional decode failed")));
  const homeButton = {
    hidden: true,
    disabled: false,
    dataset: {},
    querySelector: () => null,
    setAttribute() {}
  };
  const visitButton = { hidden: true, disabled: false };
  const game = harness({
    documentElements: {
      moonHomeRocket: homeButton,
      moonHomeProjectVisit: visitButton,
      moonHomeRocketArt: rocket,
      moonHomePlatformArt: platform,
      moonHomeDestinationArt: destination
    }
  });
  completeHeartChapters(game, 3);
  await game.controller.openHeartProject();
  assert.equal((await game.heartOptions.onChooseSettlement({ choiceId: "commons" })).ok, true);
  for (const finding of moonHeartProjectCatalog().chapters[3].findings) heartRoute(game, finding.id);
  heartRoute(game, moonHeartProjectCatalog().finale.id);
  game.controller.commitResult();

  let settled = false;
  const prepared = game.controller.prepareHomeJourneyArt({ timeoutMs: 1_000 })
    .then(() => { settled = true; });
  await settleAsync();
  assert.equal(settled, false, "handoff remains covered while visible platform art decodes");
  releasePlatform();
  await prepared;
  assert.equal(settled, true);
  assert.match(platform.getAttribute("src"), /moon-master[.]webp$/);
  assert.match(destination.getAttribute("src"), /mars-thumb[.]webp$/);
  assert.match(rocket.getAttribute("src"), /rocket-core-v1[.]png$/);
  assert.equal(homeButton.disabled, true, "preparing Mars remains an informative, noninteractive scene");
  assert.equal(visitButton.hidden, false, "Moonhaven remains available through its separate control");
});

test("Moonhaven shelter exposes The Heart CTA and cannot use the old upgrade ladder", async () => {
  const game = harness();
  await game.controller.open();
  const shelter = createMoonOutpostModel(game.options.getWorldweavingView(), game.options.getOutpostState()).slots.find(({ id }) => id === "shelter").simulator;
  assert.ok(shelter?.project);
  assert.equal(shelter.project.id, "heart");
  assert.equal(shelter.project.enabled, true);
  assert.equal(shelter.project.progressLabel, "0 / 16 experiments");
  assert.equal(shelter.actions.upgrade.enabled, false);
  assert.equal(shelter.actions.upgrade.label, "Advanced through The Heart");

  const stageBefore = game.profile.expedition.worlds.moon.outpost.structures.shelter.stage;
  const upgrade = await game.options.onStructureAction({ action: "upgrade", structureId: "shelter" });
  assert.deepEqual(upgrade, {
    ok: false,
    message: "Moonhaven now grows through The Heart project."
  });
  assert.equal(game.profile.expedition.worlds.moon.outpost.structures.shelter.stage, stageBefore);
});

test("the Outpost Heart CTA closes the Outpost and opens the project workspace", async () => {
  const game = harness();
  await game.controller.open();
  const trigger = { id: "heart-project-trigger" };
  assert.equal(game.options.onOpenProject({ projectId: "heart" }, trigger), true);
  await settleAsync();

  assert.equal(game.runtime.closeCalls, 1);
  assert.ok(game.heartOptions);
  assert.deepEqual(game.heartRuntime.openCalls, [{
    opener: trigger,
    focusChapterId: "",
    navigation: { origin: "outpost" }
  }]);
  assert.equal(createMoonHeartProjectModel(game.heartOptions.getProjectState()).chapters[0].action.id, "living-spark");
});

test("The Heart Back route returns to the surface that opened it", async () => {
  const game = harness();
  await game.controller.open();
  game.options.onOpenProject({ projectId: "heart" }, { id: "heart-project-trigger" });
  await settleAsync();

  assert.equal(game.heartOptions.onBack({ origin: "outpost" }, { id: "heart-back" }), true);
  await settleAsync();
  assert.equal(game.heartRuntime.closeCalls, 1);
  assert.equal(game.runtime.openCalls, 2);
  assert.deepEqual(game.returnHomeCalls, []);
});

test("Heart Back unwinds through Outpost to Home without reopening Heart", async () => {
  const game = harness();
  await game.controller.open();
  game.options.onOpenProject({ projectId: "heart" }, { id: "heart-project-trigger" });
  await settleAsync();

  const heartNavigation = game.heartRuntime.openCalls.at(-1).navigation;
  assert.equal(game.heartOptions.onBack(heartNavigation, { id: "heart-back" }), true);
  await settleAsync();
  assert.deepEqual(game.runtime.lastOpenOptions.navigation, { origin: "home" });

  assert.equal(game.options.onBack(game.runtime.lastOpenOptions.navigation, { id: "outpost-back" }), true);
  assert.deepEqual(game.returnHomeCalls, [{ skipForfeit: true, destination: "journey" }]);
  assert.equal(game.heartRuntime.openCalls.length, 1, "Back must not cycle into The Heart again");
});

test("Worldweaving Back unwinds through Outpost to Home without cycling", async () => {
  const game = harness();
  await game.controller.open();
  assert.equal(game.options.onReturnToWorldweaving({}, { id: "worldweaving-trigger" }), true);
  await settleAsync();

  const worldNavigation = game.worldweavingRuntime.openCalls.at(-1).navigation;
  assert.deepEqual(worldNavigation, { origin: "outpost" });
  assert.equal(game.worldweavingOptions.onBack(worldNavigation, { id: "worldweaving-back" }), true);
  await settleAsync();
  assert.deepEqual(game.runtime.lastOpenOptions.navigation, { origin: "home" });

  assert.equal(game.options.onBack(game.runtime.lastOpenOptions.navigation, { id: "outpost-back" }), true);
  assert.deepEqual(game.returnHomeCalls, [{ skipForfeit: true, destination: "journey" }]);
  assert.equal(game.worldweavingRuntime.openCalls.length, 1, "Back must not reopen Worldweaving");
});

test("The Heart exposes an explicit Main menu action that closes project surfaces", async () => {
  const game = harness();
  await game.controller.open();
  game.options.onOpenProject({ projectId: "heart" }, { id: "heart-project-trigger" });
  await settleAsync();

  assert.equal(game.heartOptions.onMainMenu(), true);
  assert.equal(game.heartRuntime.closeCalls, 1);
  assert.equal(game.runtime.closeCalls, 2);
  assert.deepEqual(game.returnHomeCalls, [{ skipForfeit: true, destination: "journey" }]);
});

test("a Moon Home route delegates one reverse flight and never invokes ordinary forward Home navigation", async () => {
  const game = harness({ journeyReturn: true });
  game.controller.recordArrival("moon", { at: new Date("2026-08-01T12:00:00.000Z") });
  await game.controller.open();
  const trigger = { id: "moon-home-return" };

  assert.equal(await game.options.onBack({ origin: "home" }, trigger), true);
  assert.deepEqual(game.journeyReturnCalls, [{
    trigger,
    fromWorld: "moon",
    toWorld: "earth",
    destination: "journey"
  }]);
  assert.deepEqual(game.returnHomeCalls, [], "reverse travel must not fall through into a second Home handoff");
  assert.equal(game.runtime.closeCalls, 1);
});

test("returning Home selects Earth for presentation without rolling Moon arrival backward", () => {
  const game = harness();
  game.controller.recordArrival("moon", { at: new Date("2026-08-01T12:00:00.000Z") });
  assert.equal(game.profile.expedition.activeWorldId, "moon");
  assert.equal(game.profile.expedition.homeWorldId, "moon");

  const returned = game.controller.selectHomeWorld("earth", { at: new Date("2026-08-01T12:05:00.000Z") });
  assert.equal(returned.activeWorldId, "moon", "confirmed expedition progress remains monotonic");
  assert.equal(returned.homeWorldId, "earth", "only the Living Planet presentation returns to Earth");
  assert.deepEqual(game.saves.at(-1), { fields: ["journeys"] });
});

test("an abandoned Heart experiment returns to its project chapter instead of staying Home", async () => {
  const game = harness();
  await game.controller.openHeartProject();
  const context = moonHeartProjectContext("living-spark");

  assert.equal(game.controller.returnToHeartProject(context, { skipForfeit: true }), true);
  await settleAsync();

  assert.deepEqual(game.returnHomeCalls, [{ skipForfeit: true, destination: "journey" }]);
  assert.deepEqual(game.heartRuntime.openCalls.at(-1), {
    opener: null,
    focusChapterId: "vital-systems",
    navigation: { origin: "home" }
  });
});

test("the first Heart experiment launches its authored target as a fixed Reach mission", async () => {
  const game = harness();
  await game.controller.openHeartProject();
  const trigger = { id: "living-spark-trigger" };
  const started = await game.heartOptions.onBeginMission({ taskId: "living-spark" }, trigger);

  assert.deepEqual(started, { ok: true });
  assert.equal(game.heartRuntime.closeCalls, 1);
  assert.equal(game.beginModeCalls.length, 1);
  const [mode, options] = game.beginModeCalls[0];
  assert.equal(mode, "reach");
  assert.equal(options.target, "Life");
  assert.equal(options.fixed, true);
  assert.equal(options.context.kind, "moon-project");
  assert.equal(options.context.projectId, "heart");
  assert.equal(options.context.chapterId, "vital-systems");
  assert.equal(options.context.milestoneId, "living-spark");
  assert.equal(options.trigger, trigger);
});

test("an eligible Heart route persists evidence and advances the project model", async () => {
  const game = harness();
  const outcome = heartRoute(game, "living-spark");

  assert.equal(outcome.project.recorded, true);
  assert.equal(outcome.project.findingDiscovered, true);
  const heart = game.profile.expedition.worlds.moon.outpost.projects.entries.find(({ id }) => id === "heart");
  assert.equal(heart.evidence.length, 1);
  assert.equal(heart.evidence[0].milestoneId, "finding:living-spark");
  assert.equal(game.saves.at(-1).fields.includes("journeys"), true);

  await game.controller.openHeartProject();
  const first = createMoonHeartProjectModel(game.heartOptions.getProjectState()).chapters[0];
  assert.equal(first.progress.completed, 1);
  assert.equal(first.tasks.find(({ id }) => id === "living-spark").state, "complete");
});

test("Heart result commitment never reuses another run's outcome or rewards Study", () => {
  const game = harness();
  heartRoute(game, "living-spark");
  game.state.run = { id: "different-heart-run", scoreEligible: true };
  const differentRun = game.controller.commitResult();
  assert.equal(differentRun.kind, "moon-project");
  assert.equal(differentRun.advanced, false);
  assert.equal(differentRun.recorded, undefined);

  game.state.scoringDisabled = true;
  assert.equal(game.controller.commitResult(), null);
  game.state.scoringDisabled = false;
  game.state.run.scoreEligible = false;
  assert.equal(game.controller.commitResult(), null);
});

test("Moonhaven's founding choice persists once and cannot be changed", async () => {
  const game = harness();
  completeHeartChapters(game, 3);
  await game.controller.openHeartProject();
  const before = createMoonHeartProjectModel(game.heartOptions.getProjectState());
  assert.equal(before.state, "choice");
  assert.equal(before.settlementChoice.options.every(({ enabled }) => enabled), true);

  const chosen = await game.heartOptions.onChooseSettlement({ choiceId: "workshop" });
  assert.equal(chosen.ok, true);
  const decision = game.profile.expedition.worlds.moon.outpost.projects.entries[0].decisions[0];
  assert.equal(decision.choiceId, "workshop");
  assert.equal(createMoonHeartProjectModel(game.heartOptions.getProjectState()).variant, "workshop");

  const changed = await game.heartOptions.onChooseSettlement({ choiceId: "garden" });
  assert.deepEqual(changed, {
    ok: false,
    message: "Moonhaven's founding character is permanent."
  });
  assert.equal(game.profile.expedition.worlds.moon.outpost.projects.entries[0].decisions[0].choiceId, "workshop");
});

test("First Dawn's deterministic reward receipt is emitted exactly once", async () => {
  const game = harness();
  completeHeartChapters(game, 3);
  await game.controller.openHeartProject();
  assert.equal((await game.heartOptions.onChooseSettlement({ choiceId: "commons" })).ok, true);
  for (const finding of moonHeartProjectCatalog().chapters[3].findings) heartRoute(game, finding.id);
  const finale = heartRoute(game, moonHeartProjectCatalog().finale.id);
  assert.equal(finale.project.projectCompleted, true);

  const first = game.controller.commitResult();
  assert.equal(first.kind, "moon-project");
  assert.equal(first.project.complete, true);
  assert.equal(first.rewardStardust, 300);
  assert.deepEqual(first.rewardCapability, {
    id: "moonhaven-stewardship",
    name: "Moonhaven Stewardship"
  });
  const rewards = game.profile.expedition.worlds.moon.outpost.projects.entries[0].rewards;
  assert.equal(rewards.length, 1);
  assert.equal(rewards[0].rewardId, "heart-first-dawn");

  const second = game.controller.commitResult();
  assert.equal(second.rewardStardust, 0);
  assert.equal(second.rewardCapability, null);
  assert.equal(game.profile.expedition.worlds.moon.outpost.projects.entries[0].rewards.length, 1);
});

test("completed routes charge Meaning with repeat decay and unlock calibration", async () => {
  const game = harness();
  await game.controller.open();
  const first = game.controller.recordRoute([{ a: "Sun", b: "Power", word: "Solar Power" }]);
  const repeat = game.controller.recordRoute([{ a: "Sun", b: "Power", word: "Solar Power" }]);
  assert.equal(first.totalMeaning, 100);
  assert.equal(repeat.totalMeaning, 70);
  const calibrated = await game.options.onStructureAction({ action: "calibrate", structureId: "power" });
  assert.equal(calibrated.ok, true);
  assert.equal(Boolean(game.profile.expedition.worlds.moon.outpost.structures.power.calibratedAt), true);
  assert.equal(game.profile.expedition.worlds.moon.outpost.structures.power.meaningCharge, 130);
});

test("the first launch funds one Common cache and cache settlement is atomic", async () => {
  const game = harness();
  await game.controller.open();
  const authorization = await game.options.onBeginLaunch();
  assert.equal(await game.options.onLaunchComplete({ authorization }), true);
  assert.equal(game.profile.expedition.worlds.moon.launches, 1);
  assert.equal(game.profile.stardust, 600);
  const receipt = await game.options.onOpenCache({ tierId: "common" });
  assert.equal(receipt.items.length, 1);
  assert.equal(game.profile.expedition.salvage.opensByTier.common, 1);
  assert.equal(game.profile.expedition.salvage.receiptFingerprints.length, 1);
  assert.equal(game.saves.some(({ fields }) => fields.includes("progression") && fields.includes("journeys")), true);
});

test("cache openings are blocked during an active run without spending", async () => {
  const game = harness({ activeRun: true });
  await game.controller.open();
  const before = structuredClone(game.profile);
  await assert.rejects(
    game.options.onOpenCache({ tierId: "common" }),
    /active orbit/
  );
  assert.equal(game.profile.stardust, before.stardust);
  assert.equal(game.profile.expedition.salvage.opensByTier.common, 0);
});

test("four duplicate shards redeem one exact unowned cosmetic through the host", async () => {
  const game = harness();
  game.profile.expedition.salvage.selectionShards = 4;
  await game.controller.open();
  const option = createMoonOutpostModel(game.options.getWorldweavingView(), game.options.getOutpostState()).cache.selectionOptions.find((entry) => !entry.owned);
  assert.ok(option);
  const result = await game.options.onRedeemSelection({ cosmeticId: option.id });
  assert.equal(result.ok, true);
  assert.equal(game.profile.expedition.salvage.selectionShards, 0);
  assert.equal(game.profile.expedition.salvageCosmeticIds.includes(option.id), true);
});
