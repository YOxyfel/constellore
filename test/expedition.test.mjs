import assert from "node:assert/strict";
import test from "node:test";

import {
  createExpeditionState,
  expeditionVoyageProjectionFacts,
  expeditionView,
  mergeExpeditionStates,
  recordExpeditionArrival,
  recordMoonExpeditionLaunch,
  replaceMoonOutpostState,
  replaceSalvageState,
  sanitizeExpeditionState,
  selectableExpeditionHomeWorldIds,
  selectExpeditionHomeWorld,
  settleMoonCollection
} from "../public/expedition.mjs";
import {
  calibrateMoonOutpostStructure,
  collectMoonOutpostStardust,
  MOON_OUTPOST_VERSION
} from "../public/moon-outpost.mjs";
import {
  createMoonProjectsState,
  moonHeartProjectCatalog,
  sanitizeMoonProjectsState
} from "../public/moon-heart-project.mjs";
import { recipeKey } from "../public/recipe-mastery.mjs";
import { createSalvageCacheState } from "../public/salvage-cache.mjs";
import {
  createWorldweavingState,
  moonWorldweavingContext,
  recordWorldweavingCompletion
} from "../public/worldweaving.mjs";

function completedMoon() {
  let state = createWorldweavingState();
  for (const [slotId, choiceId, a, b, word, at] of [
    ["power", "solar", "Sun", "Power", "Solar Power", "2026-08-01T08:00:00Z"],
    ["shelter", "hive", "Room", "Room", "House", "2026-08-01T09:00:00Z"],
    ["signal", "stars", "Sky", "Star", "Constellation", "2026-08-01T10:00:00Z"]
  ]) {
    state = recordWorldweavingCompletion(state, {
      context: moonWorldweavingContext(slotId, choiceId),
      history: [{ a, b, word, routeCompleted: true, scoreEligible: true }],
      completedAt: at
    }).state;
  }
  return state;
}

function awakenedMoon() {
  return recordWorldweavingCompletion(createWorldweavingState(), {
    context: moonWorldweavingContext("power", "solar"),
    history: [{ a: "Sun", b: "Power", word: "Solar Power", routeCompleted: true, scoreEligible: true }],
    completedAt: "2026-08-01T10:00:00Z"
  }).state;
}

function completedHeartProject({ reward = false } = {}) {
  const catalog = moonHeartProjectCatalog();
  const findings = [...catalog.chapters.flatMap((chapter) => chapter.findings), catalog.finale];
  return sanitizeMoonProjectsState({
    version: 1,
    entries: [{
      id: "heart",
      contentVersion: 1,
      evidence: findings.map((finding, index) => ({
        milestoneId: `finding:${finding.id}`,
        recipeKey: recipeKey(`Heart seed ${index}`, `Heart spark ${index}`, finding.target),
        routeKey: `route:${index.toString(36).padStart(7, "0")}`,
        completedAt: `2026-08-01T${String(index).padStart(2, "0")}:00:00.000Z`
      })),
      decisions: [{
        decisionId: "settlement-character",
        choiceId: "garden",
        decidedAt: "2026-08-01T16:00:00.000Z"
      }],
      rewards: reward ? [{
        rewardId: catalog.reward.id,
        claimedAt: "2026-08-01T18:00:00.000Z"
      }] : [],
      completedAt: "2026-08-01T17:00:00.000Z"
    }]
  });
}

test("an expedition keeps explicit Earth arrival while synchronizing Moon project data", () => {
  const worldweaving = completedMoon();
  const state = createExpeditionState(worldweaving);
  assert.equal(state.version, 1);
  assert.equal(state.worlds.moon.outpost.version, MOON_OUTPOST_VERSION);
  assert.equal(state.revision, 0);
  assert.deepEqual(
    Object.values(state.worlds.moon.outpost.structures).map((structure) => structure.choiceId),
    ["solar", "hive", "stars"]
  );
  assert.deepEqual(state.worlds.moon.outpost.projects, createMoonProjectsState({
    shelterStage: 1,
    shelterChoiceId: "hive"
  }));
  assert.deepEqual(state.salvage, createSalvageCacheState());
  assert.equal(state.activeWorldId, "earth", "project data cannot skip the explicit Earth-to-Moon arrival");
  assert.equal(state.homeWorldId, "earth");
});

test("a new expedition begins on Earth and records Moon arrival once", () => {
  const worldweaving = createWorldweavingState();
  const initial = createExpeditionState(worldweaving);
  assert.equal(initial.activeWorldId, "earth");
  assert.equal(initial.homeWorldId, "earth");

  const arrived = recordExpeditionArrival(initial, "moon", {
    worldweaving,
    at: "2026-08-01T11:00:00Z"
  });
  assert.equal(arrived.activeWorldId, "moon");
  assert.equal(arrived.homeWorldId, "moon");
  assert.equal(arrived.revision, 1);
  assert.equal(arrived.updatedAt, "2026-08-01T11:00:00.000Z");

  const repeated = recordExpeditionArrival(arrived, "moon", {
    worldweaving,
    at: "2026-08-01T12:00:00Z"
  });
  assert.equal(repeated.activeWorldId, "moon");
  assert.equal(repeated.revision, 1, "revisiting an arrived world is not a new mutation");
  assert.equal(repeated.updatedAt, arrived.updatedAt);

  const unknown = recordExpeditionArrival(initial, "admin", { worldweaving });
  assert.equal(unknown.activeWorldId, "earth");
  assert.equal(unknown.revision, 0);
});

test("Home can return to Earth without rolling back Moon arrival or projects", () => {
  const worldweaving = completedMoon();
  const arrived = recordExpeditionArrival(createExpeditionState(createWorldweavingState()), "moon", {
    worldweaving: createWorldweavingState(),
    at: "2026-08-01T11:00:00Z"
  });
  const returned = selectExpeditionHomeWorld(arrived, "earth", {
    worldweaving,
    at: "2026-08-01T12:00:00Z"
  });
  assert.equal(returned.activeWorldId, "moon", "confirmed arrival remains monotonic");
  assert.equal(returned.homeWorldId, "earth", "only the Home presentation returns to Earth");
  assert.deepEqual(returned.worlds.moon.outpost.projects, createMoonProjectsState({
    shelterStage: 1,
    shelterChoiceId: "hive"
  }));
});

test("Moon becomes independently selectable only after arrival and its first Power memory", () => {
  const emptyWorldweaving = createWorldweavingState();
  const arrived = recordExpeditionArrival(createExpeditionState(emptyWorldweaving), "moon", {
    worldweaving: emptyWorldweaving,
    at: "2026-08-01T09:00:00Z"
  });
  assert.deepEqual(selectableExpeditionHomeWorldIds(arrived, { worldweaving: emptyWorldweaving }), ["earth"]);

  const returned = selectExpeditionHomeWorld(arrived, "earth", {
    worldweaving: emptyWorldweaving,
    at: "2026-08-01T09:30:00Z"
  });
  const prematureMoon = selectExpeditionHomeWorld(returned, "moon", {
    worldweaving: emptyWorldweaving,
    at: "2026-08-01T09:45:00Z"
  });
  assert.equal(prematureMoon.homeWorldId, "earth");
  assert.equal(prematureMoon.activeWorldId, "moon", "the Home gate never rolls arrival back");
  assert.equal(prematureMoon.revision, returned.revision, "a blocked selection is not persisted");

  const worldweaving = awakenedMoon();
  assert.deepEqual(selectableExpeditionHomeWorldIds(returned, { worldweaving }), ["earth", "moon"]);
  assert.deepEqual(expeditionView(returned, { worldweaving }).moonHomeWorldAccess, {
    worldId: "moon",
    unlocked: true,
    milestoneId: "power",
    completedAt: "2026-08-01T10:00:00.000Z"
  });
  assert.deepEqual(expeditionView(returned, { worldweaving }).selectableHomeWorldIds, ["earth", "moon"]);
  const revisited = selectExpeditionHomeWorld(returned, "moon", {
    worldweaving,
    at: "2026-08-01T11:00:00Z"
  });
  assert.equal(revisited.homeWorldId, "moon");
  assert.equal(revisited.activeWorldId, "moon");
});

test("Power progress alone cannot bypass the first Earth-to-Moon arrival", () => {
  const worldweaving = awakenedMoon();
  const earth = createExpeditionState(worldweaving);
  assert.deepEqual(selectableExpeditionHomeWorldIds(earth, { worldweaving }), ["earth"]);
  const blocked = selectExpeditionHomeWorld(earth, "moon", { worldweaving });
  assert.equal(blocked.activeWorldId, "earth");
  assert.equal(blocked.homeWorldId, "earth");
});

test("legacy Moon Outpost snapshots gain canonical project state without losing structures", () => {
  const worldweaving = completedMoon();
  const current = createExpeditionState(worldweaving);
  const legacy = structuredClone(current);
  legacy.worlds.moon.outpost.version = 1;
  delete legacy.worlds.moon.outpost.projects;
  const migrated = sanitizeExpeditionState(legacy, { worldweaving });
  assert.equal(migrated.worlds.moon.outpost.version, MOON_OUTPOST_VERSION);
  assert.deepEqual(migrated.worlds.moon.outpost.structures, current.worlds.moon.outpost.structures);
  assert.deepEqual(migrated.worlds.moon.outpost.projects, current.worlds.moon.outpost.projects);
});

test("sanitization drops unknown cosmetics, ledgers, worlds, and forged outpost anchors", () => {
  const worldweaving = completedMoon();
  const state = sanitizeExpeditionState({
    version: 99,
    revision: 4,
    activeWorldId: "admin",
    worlds: {
      moon: { outpost: { structures: { power: { choiceId: "lunar", anchorKey: "forged" } } } },
      secret: { balance: 1_000_000 }
    },
    salvageCosmeticIds: ["forged.cosmetic"],
    creditedCollectionIds: ["admin-receipt"],
    admin: true
  }, { worldweaving });
  assert.equal(state.activeWorldId, "moon");
  assert.equal(state.worlds.moon.outpost.structures.power.choiceId, "solar");
  assert.deepEqual(state.salvageCosmeticIds, []);
  assert.deepEqual(state.creditedCollectionIds, []);
  assert.doesNotMatch(JSON.stringify(state), /secret|admin|forged/);
});

test("sanitization accepts only Earth or Moon and infers legacy Moon progress", () => {
  const emptyWorld = createWorldweavingState();
  const empty = createExpeditionState(emptyWorld);
  assert.equal(sanitizeExpeditionState({ ...empty, activeWorldId: "earth" }, { worldweaving: emptyWorld }).activeWorldId, "earth");
  assert.equal(sanitizeExpeditionState({ ...empty, activeWorldId: "moon" }, { worldweaving: emptyWorld }).activeWorldId, "moon");
  assert.equal(sanitizeExpeditionState({ ...empty, activeWorldId: "venus" }, { worldweaving: emptyWorld }).activeWorldId, "earth");

  const progressedWorld = completedMoon();
  const explicitEarth = createExpeditionState(progressedWorld);
  assert.equal(
    sanitizeExpeditionState(explicitEarth, { worldweaving: progressedWorld }).activeWorldId,
    "earth",
    "an explicit canonical Earth location wins over independent Moon project progress"
  );
  const legacy = structuredClone(explicitEarth);
  delete legacy.activeWorldId;
  assert.equal(
    sanitizeExpeditionState(legacy, { worldweaving: progressedWorld }).activeWorldId,
    "moon",
    "old saves with durable Moon progress must not replay first arrival"
  );
});

test("outpost, salvage, and launch mutations advance one envelope revision", () => {
  const worldweaving = completedMoon();
  let state = createExpeditionState(worldweaving);
  const outpost = structuredClone(state.worlds.moon.outpost);
  outpost.structures.power.meaningCharge = 700;
  state = replaceMoonOutpostState(state, outpost, { worldweaving, at: "2026-08-01T11:00:00Z" });
  assert.equal(state.revision, 1);
  const salvage = structuredClone(state.salvage);
  salvage.opensByTier.common = 1;
  state = replaceSalvageState(state, salvage, { worldweaving, at: "2026-08-01T12:00:00Z" });
  assert.equal(state.revision, 2);
  state = recordMoonExpeditionLaunch(state, { worldweaving, at: "2026-08-01T13:00:00Z" });
  assert.equal(state.revision, 3);
  assert.equal(state.worlds.moon.launches, 1);
});

test("a passive collection is settled once with the updated outpost snapshot", () => {
  const worldweaving = completedMoon();
  let expedition = createExpeditionState(worldweaving);
  const charged = structuredClone(expedition.worlds.moon.outpost);
  charged.structures.power.meaningCharge = 100;
  const calibrated = calibrateMoonOutpostStructure(charged, "power", { at: "2026-08-01T10:00:00Z" });
  assert.equal(calibrated.calibrated, true);
  const collection = collectMoonOutpostStardust(calibrated.state, { at: "2026-08-01T12:00:00Z" });
  assert.equal(collection.collected, true);
  assert.ok(collection.stardustGranted > 0);
  expedition = settleMoonCollection(expedition, {
    outpost: collection.state,
    collectionIds: collection.entries.map((entry) => entry.collectionId)
  }, { worldweaving, at: "2026-08-01T12:00:00Z" }).state;
  const repeated = settleMoonCollection(expedition, {
    outpost: collection.state,
    collectionIds: collection.entries.map((entry) => entry.collectionId)
  }, { worldweaving, at: "2026-08-01T12:05:00Z" });
  assert.deepEqual(repeated.credited, []);
  assert.equal(repeated.state.revision, expedition.revision);
});

test("cloud merge chooses one consumptive revision and unions only monotonic receipts", () => {
  const worldweaving = completedMoon();
  const base = createExpeditionState(worldweaving);
  const local = recordMoonExpeditionLaunch(base, { worldweaving, at: "2026-08-01T11:00:00Z" });
  const remoteSalvage = structuredClone(base.salvage);
  remoteSalvage.receiptFingerprints = ["sc1-0011223344556677"];
  const remote = replaceSalvageState(base, remoteSalvage, { worldweaving, at: "2026-08-01T10:00:00Z" });
  const merged = mergeExpeditionStates(local, remote, { worldweaving });
  assert.equal(merged.worlds.moon.launches, 1, "later equal revision wins the economic snapshot");
  assert.deepEqual(merged.salvage.receiptFingerprints, ["sc1-0011223344556677"]);
});

test("cloud merge never rolls a recorded world arrival back", () => {
  const worldweaving = createWorldweavingState();
  const earth = createExpeditionState(worldweaving);
  const moon = recordExpeditionArrival(earth, "moon", {
    worldweaving,
    at: "2026-08-01T11:00:00Z"
  });
  const newerEarth = structuredClone(earth);
  newerEarth.revision = moon.revision + 1;
  newerEarth.updatedAt = "2026-08-01T12:00:00.000Z";

  const merged = mergeExpeditionStates(newerEarth, moon, { worldweaving });
  assert.equal(merged.activeWorldId, "moon");
});

test("Voyage Projection replay facts reflect confirmed Earth and Moon arrival only", () => {
  const worldweaving = createWorldweavingState();
  const earth = createExpeditionState(worldweaving);
  const earthFacts = expeditionVoyageProjectionFacts(earth, { worldweaving });
  assert.deepEqual(earthFacts, {
    variant: "progress",
    currentWorldId: "earth",
    completedWorldIds: [],
    actionableWorldIds: ["earth", "moon"]
  });

  const moon = recordExpeditionArrival(earth, "moon", {
    worldweaving,
    at: "2026-08-01T11:00:00Z"
  });
  moon.homeWorldId = "earth";
  const moonFacts = expeditionVoyageProjectionFacts(moon, { worldweaving });
  assert.deepEqual(moonFacts, {
    variant: "progress",
    currentWorldId: "moon",
    completedWorldIds: ["earth"],
    actionableWorldIds: ["moon"]
  });
  assert.equal(moonFacts.actionableWorldIds.includes("mars"), false, "unfinished Mars content stays locked");
  assert.equal(Object.isFrozen(moonFacts), true);
  assert.equal(Object.isFrozen(moonFacts.completedWorldIds), true);
  assert.equal(Object.isFrozen(moonFacts.actionableWorldIds), true);
});

test("cloud merge unions Heart evidence without importing a losing settlement decision", () => {
  const worldweaving = completedMoon();
  const base = createExpeditionState(worldweaving);
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.revision = 2;
  local.updatedAt = "2026-08-01T12:00:00.000Z";
  remote.revision = 1;
  remote.updatedAt = "2026-08-01T11:00:00.000Z";
  local.worlds.moon.outpost.projects.entries[0].evidence = [{
    milestoneId: "finding:living-spark",
    recipeKey: recipeKey("Energy", "Swamp", "Life"),
    routeKey: "route:aaaaaaa",
    completedAt: "2026-08-01T10:00:00.000Z"
  }];
  local.worlds.moon.outpost.projects.entries[0].decisions = [{
    decisionId: "settlement-character",
    choiceId: "garden",
    decidedAt: "2026-08-01T10:00:00.000Z"
  }];
  remote.worlds.moon.outpost.projects.entries[0].evidence = [{
    milestoneId: "finding:living-spark",
    recipeKey: recipeKey("Energy", "Ocean", "Life"),
    routeKey: "route:bbbbbbb",
    completedAt: "2026-08-01T09:00:00.000Z"
  }];
  remote.worlds.moon.outpost.projects.entries[0].decisions = [{
    decisionId: "settlement-character",
    choiceId: "workshop",
    decidedAt: "2026-08-01T09:00:00.000Z"
  }];

  const merged = mergeExpeditionStates(local, remote, { worldweaving });
  const heart = merged.worlds.moon.outpost.projects.entries[0];
  assert.equal(heart.evidence.length, 2, "monotonic research evidence survives either device branch");
  assert.equal(heart.decisions.length, 1);
  assert.equal(heart.decisions[0].choiceId, "garden", "the winning economic snapshot owns immutable decisions");
  assert.equal(merged.revision, local.revision);
});

test("cloud merge never imports a project reward from the losing economic snapshot", () => {
  const worldweaving = completedMoon();
  const base = createExpeditionState(worldweaving);
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.revision = 2;
  local.updatedAt = "2026-08-02T12:00:00.000Z";
  local.worlds.moon.outpost.projects = completedHeartProject({ reward: false });
  remote.revision = 1;
  remote.updatedAt = "2026-08-02T11:00:00.000Z";
  remote.worlds.moon.outpost.projects = completedHeartProject({ reward: true });

  const withoutLosingReward = mergeExpeditionStates(local, remote, { worldweaving });
  assert.deepEqual(withoutLosingReward.worlds.moon.outpost.projects.entries[0].rewards, []);

  local.worlds.moon.outpost.projects = completedHeartProject({ reward: true });
  remote.worlds.moon.outpost.projects = completedHeartProject({ reward: false });
  const withWinnerReward = mergeExpeditionStates(local, remote, { worldweaving });
  assert.equal(withWinnerReward.worlds.moon.outpost.projects.entries[0].rewards.length, 1);
});
