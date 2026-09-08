import assert from "node:assert/strict";
import test from "node:test";

import {
  MOON_SETTLEMENT_DISTRICT_SITE_ORDER,
  MOON_SETTLEMENT_POSITIONS,
  deriveMoonSettlementActiveSite,
  projectMoonSettlementSpatialState,
  resolveMoonSettlementBuildSite
} from "../public/moon-settlement-presentation.mjs";
import {
  MOON_SETTLEMENT_PARCEL_CELL_SIZE,
  MOON_SETTLEMENT_PLOT_STRIDE
} from "../public/moon-settlement-placement.mjs";

const sites = [
  { id: "power", kind: "founding", unlocked: true, occupiedBy: "" },
  { id: "shelter", kind: "hero", unlocked: true, occupiedBy: "" },
  { id: "signal", kind: "founding", unlocked: true, occupiedBy: "" },
  { id: "utility-west", kind: "utility", unlocked: true, occupiedBy: "" },
  { id: "utility-east", kind: "utility", unlocked: true, occupiedBy: "" },
  { id: "archive", kind: "utility", unlocked: true, occupiedBy: "" },
  { id: "greenhouse", kind: "hero", unlocked: true, occupiedBy: "" }
];

const initialStructures = [
  { id: "lander", type: "lander", title: "Lander", siteId: "lander", status: "active", ports: [] },
  { id: "starter-vault", type: "starter-vault", title: "Biological Starter Vault", siteId: "lander", status: "damaged", ports: [] },
  { id: "world-seed-cradle", type: "world-seed-cradle", title: "World Seed Cradle", siteId: "seed-cradle", status: "dormant", ports: [] }
];

function landing(overrides = {}) {
  return {
    stage: "landing",
    founding: { power: "", shelter: "", signal: "" },
    structures: initialStructures,
    modules: [],
    productionTrays: [],
    drift: [],
    nextActions: ["choose-power", "choose-shelter", "choose-signal"],
    ...overrides
  };
}

test("the landing reveals one purposeful foundation instead of every future plot", () => {
  const scene = projectMoonSettlementSpatialState(landing(), { domainState: { sites } });
  assert.deepEqual(scene.structures.map(({ id }) => id), ["lander", "starter-vault"]);
  assert.deepEqual(scene.authoredSites.map(({ id }) => id), ["site-power"]);
  assert.equal(scene.authoredSites[0].previewType, "power");
  assert.equal(scene.authoredSites[0].cue, "objective");
  assert.equal(scene.activeSite.targetId, "site-power");
  assert.equal(scene.structures.some(({ id }) => id === "world-seed-cradle"), false,
    "the dormant World Seed does not masquerade as an early building");
  assert.deepEqual(scene.paths.map(({ id }) => id), [
    "path-arrival-vault",
    "path-settlement-spine",
    "path-site-power"
  ]);
  assert.equal(scene.parcels.length, sites.length);
  assert.equal(scene.parcels.every((parcel) => parcel.interactive === false), true);
  assert.equal(scene.parcels.every((parcel) => ["planned", "occupied"].includes(parcel.status)), true);
});

test("founding choice previews advance Power to Shelter to Signal deterministically", () => {
  const preview = deriveMoonSettlementActiveSite(landing(), {
    pendingFounding: { slot: "power", choiceId: "solar", label: "Solar Power" }
  });
  assert.equal(preview.previewType, "solar-power");
  assert.equal(preview.name, "Solar Power foundation");

  const afterPower = landing({
    founding: { power: "solar", shelter: "", signal: "" },
    modules: [{ id: "module-power", slot: "power", choiceId: "solar", title: "Solar Power", ports: ["Power"] }]
  });
  const shelterScene = projectMoonSettlementSpatialState(afterPower, { domainState: { sites } });
  assert.deepEqual(shelterScene.authoredSites.map(({ id }) => id), ["site-shelter"]);
  assert.equal(shelterScene.activeSite.previewType, "shelter");

  const afterShelter = landing({
    founding: { power: "solar", shelter: "haven", signal: "" },
    modules: [
      { id: "module-power", slot: "power", choiceId: "solar", title: "Solar Power", ports: ["Power"] },
      { id: "module-shelter", slot: "shelter", choiceId: "haven", title: "Haven Shelter", ports: ["Life"] }
    ]
  });
  const signalScene = projectMoonSettlementSpatialState(afterShelter, { domainState: { sites } });
  assert.deepEqual(signalScene.authoredSites.map(({ id }) => id), ["site-signal"]);
});

test("vault repair keeps the damaged starter vault as its physical objective", () => {
  const scene = projectMoonSettlementSpatialState(landing({
    stage: "vault-repair",
    founding: { power: "solar", shelter: "haven", signal: "beacon" },
    nextActions: ["repair-vault"]
  }), { domainState: { sites } });
  assert.deepEqual(scene.authoredSites, []);
  assert.equal(scene.structures.find(({ id }) => id === "starter-vault").cue, "objective");
  assert.equal(scene.objectiveTargetId, "starter-vault");
});

test("ground reading and the first Weave expose the regolith site as their physical objective", () => {
  const founding = { power: "solar", shelter: "haven", signal: "beacon" };
  for (const [stage, nextAction] of [
    ["ground", "sample-regolith"],
    ["first-weave", "separate-regolith"]
  ]) {
    const scene = projectMoonSettlementSpatialState(landing({
      stage,
      founding,
      nextActions: [nextAction]
    }), { domainState: { sites } });
    const target = [...scene.structures, ...scene.authoredSites]
      .find(({ id }) => id === "site-regolith");
    assert.equal(scene.objectiveTargetId, "site-regolith", `${stage} should guide the astronaut to the sample site`);
    assert.ok(target, `${stage} should expose a raycastable site-regolith target`);
    assert.equal(target.cue, "objective", `${stage} should render the regolith target as the current concern`);
  }
});

test("construction advances through one site and upgrades the founding shelter in place", () => {
  const modules = [
    { id: "module-power", slot: "power", choiceId: "solar", title: "Solar Power", ports: ["Power"] },
    { id: "module-shelter", slot: "shelter", choiceId: "haven", title: "Haven Shelter", ports: ["Life"] },
    { id: "module-signal", slot: "signal", choiceId: "beacon", title: "Beacon Signal", ports: ["Signal"] }
  ];
  const processorScene = projectMoonSettlementSpatialState(landing({
    stage: "construction",
    founding: { power: "solar", shelter: "haven", signal: "beacon" },
    modules,
    nextActions: ["build-processor", "build-storage", "build-reservoir", "build-shelter", "build-greenhouse"]
  }), { domainState: { sites } });
  assert.deepEqual(processorScene.authoredSites.map(({ id }) => id), ["site-utility-west"]);
  assert.equal(processorScene.authoredSites[0].previewAsset, "processor");

  const shelterScene = projectMoonSettlementSpatialState(landing({
    stage: "construction",
    founding: { power: "solar", shelter: "haven", signal: "beacon" },
    modules,
    nextActions: ["build-shelter", "build-greenhouse"]
  }), { domainState: { sites } });
  assert.deepEqual(shelterScene.authoredSites, []);
  const shelter = shelterScene.structures.find(({ id }) => id === "module-shelter");
  assert.equal(shelter.siteRole, "upgrade");
  assert.equal(shelter.type, "haven-shelter");
  assert.equal(shelter.cue, "objective");
  assert.equal(shelterScene.activeSite.targetId, "module-shelter");
});

test("the World Seed appears only after Living Ground is earned", () => {
  const openPlay = projectMoonSettlementSpatialState(landing({
    stage: "open-play",
    founding: { power: "solar", shelter: "haven", signal: "beacon" },
    nextActions: []
  }), { domainState: { sites } });
  const cradle = openPlay.structures.find(({ id }) => id === "world-seed-cradle");
  assert.equal(cradle.cue, "objective");
  assert.deepEqual(cradle.position, [MOON_SETTLEMENT_PLOT_STRIDE, 0, MOON_SETTLEMENT_PLOT_STRIDE * 3]);
});

test("an active placement draft reveals one snapped parcel and moves the exact structure preview", () => {
  assert.equal(resolveMoonSettlementBuildSite("storage"), "utility-east");
  const scene = projectMoonSettlementSpatialState(landing({
    stage: "construction",
    founding: { power: "solar", shelter: "haven", signal: "beacon" },
    nextActions: ["build-processor", "build-storage"]
  }), {
    domainState: { sites },
    placementDraft: {
      siteId: "utility-east",
      structureType: "storage",
      parcelId: "utility-east",
      cellX: 1,
      cellZ: -1,
      rotationQuarter: 1
    }
  });
  assert.equal(scene.activeSite.siteId, "utility-east");
  assert.equal(scene.parcels.length, sites.length);
  const activeParcel = scene.parcels.find((parcel) => parcel.interactive);
  assert.equal(activeParcel.siteId, "utility-east");
  assert.equal(activeParcel.selected.cellX, 1);
  assert.deepEqual(activeParcel.position, [0, 0, MOON_SETTLEMENT_PLOT_STRIDE * 2]);
  assert.deepEqual(scene.authoredSites[0].position, [
    MOON_SETTLEMENT_PARCEL_CELL_SIZE,
    0,
    MOON_SETTLEMENT_PLOT_STRIDE * 2 - MOON_SETTLEMENT_PARCEL_CELL_SIZE
  ]);
  assert.equal(scene.authoredSites[0].rotation, Math.PI / 2);
});

test("district plots and paths remain deterministic, reachable, and orthogonal", () => {
  const scene = projectMoonSettlementSpatialState(landing(), { domainState: { sites } });
  assert.deepEqual(scene.parcels.map((parcel) => parcel.siteId), MOON_SETTLEMENT_DISTRICT_SITE_ORDER.filter((siteId) => sites.some((site) => site.id === siteId)));
  assert.equal(new Set(scene.parcels.map((parcel) => parcel.position.join(":"))).size, scene.parcels.length);
  for (const parcel of scene.parcels) {
    assert.ok(Math.abs(parcel.position[0] % MOON_SETTLEMENT_PLOT_STRIDE) < 1e-12);
    assert.ok(Math.abs(parcel.position[2] % MOON_SETTLEMENT_PLOT_STRIDE) < 1e-12);
    assert.ok(Math.hypot(parcel.position[0], parcel.position[2]) < 36 - 1.78);
  }
  for (const path of scene.paths) {
    for (let index = 1; index < path.points.length; index += 1) {
      const from = path.points[index - 1];
      const to = path.points[index];
      assert.ok(from[0] === to[0] || from[2] === to[2], `${path.id} must follow the surveyed grid`);
    }
  }
  assert.deepEqual(MOON_SETTLEMENT_POSITIONS.lander, [-MOON_SETTLEMENT_PARCEL_CELL_SIZE, 0, -MOON_SETTLEMENT_PARCEL_CELL_SIZE]);
});
