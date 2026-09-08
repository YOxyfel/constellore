import assert from "node:assert/strict";
import test from "node:test";
import {
  MOON_SETTLEMENT_GOODS,
  MOON_SETTLEMENT_SCHEMA,
  MOON_SETTLEMENT_VERSION,
  applySettlementOperation,
  applyStructureDraft,
  cancelStructureDraft,
  createMoonSettlement,
  createStructureDraft,
  deriveProofState,
  migrateOutpostV2ToSettlementV3,
  previewStructureDraft,
  projectMoonSettlement,
  quoteSettlementOperation,
  resolveHazard,
  resolveProductionBatch,
  sanitizeMoonSettlement
} from "../public/moon-settlement-domain.mjs";

const AT = "2026-08-20T12:00:00.000Z";

function apply(state, type, payload = {}, suffix = type) {
  const result = applySettlementOperation(state, {
    type,
    operationId: `test:${suffix}`,
    ...payload
  }, { at: AT });
  assert.equal(result.applied, true, `${type}: ${result.reason}`);
  return result.state;
}

function reachFirstWeave() {
  let state = createMoonSettlement({ at: AT });
  state = apply(state, "choose-founding", { slot: "power", choiceId: "solar" }, "power");
  state = apply(state, "choose-founding", { slot: "shelter", choiceId: "haven" }, "shelter");
  state = apply(state, "choose-founding", { slot: "signal", choiceId: "stars" }, "signal");
  state = apply(state, "repair-vault", {}, "vault");
  state = apply(state, "sample-regolith", {}, "sample");
  return state;
}

function reachCultivation() {
  let state = reachFirstWeave();
  state = apply(state, "separate-regolith", {}, "weave-regolith");
  for (const type of ["processor", "storage", "reservoir", "shelter", "greenhouse"]) {
    state = apply(state, "build-structure", { structureType: type }, `build-${type}`);
  }
  return state;
}

function reachActiveBatch(prefix = "batch") {
  let state = reachCultivation();
  for (let number = 1; number <= 6; number += 1) {
    state = apply(state, "craft-bean-pod", {}, `${prefix}-pod-${number}`);
  }
  return apply(state, "start-production", {}, `${prefix}-start`);
}

function reachProofReady(prefix = "proof-ready") {
  let state = reachActiveBatch(prefix);
  const harvest = resolveProductionBatch(state, {
    at: "2026-08-20T12:02:00.000Z",
    operationId: `test:${prefix}-harvest`
  });
  assert.equal(harvest.resolved, true);
  const maintenance = resolveHazard(harvest.state, {
    hazardId: "drift-regolith-dust",
    method: "separate",
    operationId: `test:${prefix}-maintenance`,
    at: "2026-08-20T12:02:10.000Z"
  });
  assert.equal(maintenance.resolved, true);
  assert.equal(deriveProofState(maintenance.state).eligible, true);
  return maintenance.state;
}

test("SettlementStateV1 starts deterministic, immutable, bounded, and separate from production Moon state", () => {
  const state = createMoonSettlement({ at: AT });
  assert.equal(state.version, MOON_SETTLEMENT_VERSION);
  assert.equal(state.schema, MOON_SETTLEMENT_SCHEMA);
  assert.equal(state.worldId, "moon");
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.structures[0]), true);
  assert.deepEqual(Object.keys(state.goods), MOON_SETTLEMENT_GOODS);
  assert.deepEqual(state.founding, { power: "", shelter: "", signal: "" });
  assert.equal(state.structures.find(({ id }) => id === "starter-vault").status, "damaged");
  assert.equal(projectMoonSettlement(state).stage, "landing");

  const sanitized = sanitizeMoonSettlement({
    ...state,
    unknown: "removed",
    revision: Infinity,
    matter: 999_999,
    goods: { ...state.goods, Food: -50, Parts: 999_999, Counterfeit: 10 },
    receipts: Array.from({ length: 600 }, (_, index) => ({ id: `receipt-${index}`, type: "test", revision: index }))
  });
  assert.equal("unknown" in sanitized, false);
  assert.equal("Counterfeit" in sanitized.goods, false);
  assert.equal(sanitized.goods.Food, 0);
  assert.equal(sanitized.goods.Parts, sanitized.capacities.Parts);
  assert.equal(sanitized.matter, sanitized.matterCapacity);
  assert.equal(sanitized.receipts.length, 256);
});

test("founding choices validate authored IDs and every operation receipt is idempotent", () => {
  const start = createMoonSettlement();
  const invalid = applySettlementOperation(start, { type: "choose-founding", operationId: "invalid", slot: "power", choiceId: "fusion" });
  assert.equal(invalid.applied, false);
  assert.equal(invalid.reason, "invalid_founding_choice");
  assert.equal(invalid.state.revision, 0);

  const first = applySettlementOperation(start, { type: "choose-founding", operationId: "founding-power", slot: "power", choiceId: "lunar" }, { at: AT });
  assert.equal(first.applied, true);
  assert.equal(first.state.revision, 1);
  assert.equal(first.state.founding.power, "lunar");
  assert.equal(first.state.modules[0].ports.includes("Power"), true);

  const duplicate = applySettlementOperation(first.state, { type: "choose-founding", operationId: "founding-power", slot: "power", choiceId: "lunar" }, { at: AT });
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.reason, "duplicate_operation");
  assert.deepEqual(duplicate.state, first.state);
});

test("parcel placement is validated, persisted, and restored by exact rollback", () => {
  const start = createMoonSettlement({ at: AT });
  const invalid = applySettlementOperation(start, {
    type: "choose-founding",
    operationId: "placement:invalid",
    slot: "power",
    choiceId: "solar",
    placement: { parcelId: "power", cellX: 2, cellZ: 0, rotationQuarter: 0 }
  }, { at: AT });
  assert.equal(invalid.applied, false);
  assert.equal(invalid.reason, "outside_parcel");
  assert.equal(invalid.state.revision, start.revision);
  assert.deepEqual(invalid.state.goods, start.goods);

  const founding = applySettlementOperation(start, {
    type: "choose-founding",
    operationId: "placement:power",
    slot: "power",
    choiceId: "solar",
    placement: { parcelId: "power", cellX: 1, cellZ: -1, rotationQuarter: 3 }
  }, { at: AT });
  assert.equal(founding.applied, true);
  assert.deepEqual(founding.state.modules[0].placement, {
    parcelId: "power",
    cellX: 1,
    cellZ: -1,
    rotationQuarter: 3,
    footprint: [3, 3]
  });

  let buildable = reachFirstWeave();
  buildable = apply(buildable, "separate-regolith", {}, "placement-earth");
  const built = applySettlementOperation(buildable, {
    type: "build-structure",
    operationId: "placement:processor",
    structureType: "processor",
    placement: { parcelId: "utility-west", cellX: -1, cellZ: 1, rotationQuarter: 1 }
  }, { at: AT });
  assert.equal(built.applied, true);
  assert.equal(built.state.structures.find(({ type }) => type === "processor").placement.cellX, -1);
  const rolledBack = applySettlementOperation(built.state, { type: "rollback", operationId: "placement:rollback" }, { at: AT });
  assert.equal(rolledBack.applied, true);
  assert.equal(rolledBack.state.structures.some(({ type }) => type === "processor"), false);
});

test("the complete Living Ground route is deterministic from landing through Proof and open play", () => {
  let state = reachCultivation();
  const constructionView = projectMoonSettlement(state);
  assert.equal(constructionView.stage, "cultivation");
  assert.equal(constructionView.structures.some(({ type }) => type === "greenhouse"), true);
  assert.equal(state.matter, 1, "the first split funds exactly one random bubble");
  assert.equal(state.goods.Regolith, 3);
  assert.equal(state.goods.Parts, 4);
  assert.equal(state.goods.Soil, 6);

  for (let number = 1; number <= 6; number += 1) {
    state = apply(state, "craft-bean-pod", { quality: number === 6 ? "resonant" : "stable" }, `pod-${number}`);
  }
  assert.equal(state.concepts.filter(({ kind }) => kind === "bean-pod").length, 6);
  assert.equal(state.goods.Soil, 0);
  assert.equal(state.goods.Biomass, 0);

  state = applySettlementOperation(state, {
    type: "start-production", operationId: "test:start-crop"
  }, { at: AT }).state;
  assert.equal(state.productionTrays[0].readyAt, "2026-08-20T12:02:00.000Z");
  assert.equal(state.drift[0].kind, "Dust");
  assert.equal(state.rollbackReceipt, null, "starting production closes the rollback window");

  const early = resolveProductionBatch(state, { at: "2026-08-20T12:01:59.999Z", operationId: "test:harvest" });
  assert.equal(early.resolved, false);
  assert.equal(early.reason, "batch_not_ready");
  assert.equal(early.state.revision, state.revision);

  const harvest = resolveProductionBatch(state, { at: "2026-08-20T12:02:00.000Z", operationId: "test:harvest" });
  assert.equal(harvest.resolved, true);
  state = harvest.state;
  assert.equal(state.goods.Food, 6);
  assert.equal(state.goods.Biomass, 2);
  assert.equal(deriveProofState(state).eligible, false, "Dust maintenance remains a real requirement");

  const maintenance = resolveHazard(state, {
    hazardId: "drift-regolith-dust", method: "separate", operationId: "test:clear-dust", at: "2026-08-20T12:02:10.000Z"
  });
  assert.equal(maintenance.resolved, true);
  state = maintenance.state;
  assert.equal(deriveProofState(state).eligible, true);

  state = apply(state, "claim-proof", { proofId: "living-ground" }, "proof");
  assert.equal(projectMoonSettlement(state).stage, "open-play");
  assert.equal(state.proofs[0].title, "Living Ground — Matter can host Life");
  assert.equal(state.structures.find(({ id }) => id === "world-seed-cradle").status, "active");
  assert.deepEqual(state.structures.find(({ type }) => type === "greenhouse").modules, ["landmark-living-ground", "score-layer-life"]);
});

test("a storage-full production tray remains active and resolves after capacity is freed", () => {
  const active = reachActiveBatch("storage-retry");
  const crowded = sanitizeMoonSettlement({
    ...active,
    goods: { ...active.goods, Food: active.capacities.Food - 2, Biomass: active.capacities.Biomass - 1 }
  });
  const blocked = resolveProductionBatch(crowded, {
    at: "2026-08-20T12:02:00.000Z",
    operationId: "test:storage-blocked"
  });
  assert.equal(blocked.applied, true);
  assert.equal(blocked.resolved, false);
  assert.equal(blocked.reason, "storage_full");
  assert.equal(blocked.state.productionTrays[0].status, "paused");
  assert.equal(blocked.state.productionTrays[0].pauseReason, "storage-full");
  assert.equal(
    quoteSettlementOperation(blocked.state, { type: "start-production", operationId: "test:second-batch" }).reason,
    "batch_already_active",
    "a recoverable paused tray cannot be bypassed by starting another batch"
  );

  const freed = sanitizeMoonSettlement({
    ...blocked.state,
    goods: { ...blocked.state.goods, Food: 0, Biomass: 0 }
  });
  const recovered = resolveProductionBatch(freed, {
    at: "2026-08-20T12:02:05.000Z",
    operationId: "test:storage-retry"
  });
  assert.equal(recovered.resolved, true);
  assert.equal(recovered.reason, "harvest_ready");
  assert.equal(recovered.state.productionTrays[0].status, "complete");
  assert.equal(recovered.state.productionTrays[0].pauseReason, "");
  assert.equal(recovered.state.goods.Food, 6);
  assert.equal(recovered.state.goods.Biomass, 2);
});

test("awarding Living Ground is permanent and closes every rollback path", () => {
  const eligible = reachProofReady("permanent-proof");
  assert.ok(eligible.rollbackReceipt, "maintenance is ordinarily rollback-capable before the Proof claim");
  const claimed = applySettlementOperation(eligible, {
    type: "claim-proof",
    proofId: "living-ground",
    operationId: "test:permanent-proof-claim"
  }, { at: "2026-08-20T12:02:20.000Z" });
  assert.equal(claimed.applied, true);
  assert.equal(claimed.state.rollbackReceipt, null);
  assert.equal(deriveProofState(claimed.state).awarded, true);

  const rollback = applySettlementOperation(claimed.state, { type: "rollback" }, { at: "2026-08-20T12:02:21.000Z" });
  assert.equal(rollback.applied, false);
  assert.equal(rollback.reason, "rollback_unavailable");
  assert.equal(deriveProofState(rollback.state).awarded, true);
  assert.equal(rollback.state.projects[0].status, "complete");

  const tamperedReload = sanitizeMoonSettlement({
    ...claimed.state,
    rollbackReceipt: eligible.rollbackReceipt
  });
  assert.equal(tamperedReload.rollbackReceipt, null, "sanitation rejects rollback snapshots that drop a permanent Proof");
  assert.equal(deriveProofState(tamperedReload).awarded, true);
});

test("first and second deep Weaves preview exact fragments and Apply/Cancel never alias state", () => {
  const state = reachFirstWeave();
  const draft = deepClone(createStructureDraft(state, { kind: "concept", targetId: "concept-regolith-sample" }));
  draft.bonds[0].removed = true;
  const preview = previewStructureDraft(state, draft);
  assert.equal(preview.accepted, true);
  assert.deepEqual(preview.resultingWords, ["Earth", "Dust"]);
  assert.deepEqual(preview.resourceChanges, { Regolith: -7, Soil: 6 });
  assert.equal(preview.matterChange, 1);
  assert.equal(preview.exact, true);

  const cancelled = cancelStructureDraft(state, draft);
  assert.equal(cancelled.cancelled, true);
  assert.deepEqual(cancelled.state, state);

  const applied = applyStructureDraft(state, draft, { operationId: "test:draft-regolith", at: AT });
  assert.equal(applied.applied, true);
  assert.equal(applied.state.concepts.some(({ word }) => word === "Earth"), true);
  assert.equal(applied.state.concepts.some(({ word }) => word === "Regolith Sample"), false);

  const hazardState = (() => {
    let value = reachCultivation();
    for (let number = 1; number <= 6; number += 1) value = apply(value, "craft-bean-pod", {}, `hazard-pod-${number}`);
    return apply(value, "start-production", {}, "hazard-start");
  })();
  const hazardDraft = deepClone(createStructureDraft(hazardState, { kind: "hazard", targetId: "drift-regolith-dust" }));
  hazardDraft.bonds[0].removed = true;
  const hazardPreview = previewStructureDraft(hazardState, hazardDraft);
  assert.equal(hazardPreview.accepted, true);
  assert.deepEqual(hazardPreview.resultingWords, ["Recovered Dust"]);
  const cleared = applyStructureDraft(hazardState, hazardDraft, { operationId: "test:draft-dust", at: AT });
  assert.equal(cleared.applied, true);
  assert.equal(cleared.state.drift[0].status, "cleared");
});

test("bond strength consumes a conserved cohesion pool and determines untimed craft quality", () => {
  const state = reachCultivation();
  const draft = deepClone(createStructureDraft(state, { kind: "recipe", recipeId: "bean-pod" }));
  draft.bonds[0].tier = "reinforced";
  let preview = previewStructureDraft(state, draft);
  assert.equal(preview.accepted, false);
  assert.equal(preview.reason, "cohesion_exceeded");
  assert.deepEqual(preview.cohesion, { spent: 3, available: 2 });

  draft.cohesion.supportCapacity = 1;
  preview = previewStructureDraft(state, draft);
  assert.equal(preview.accepted, true);
  assert.equal(preview.quality, "resonant");
  const crafted = applyStructureDraft(state, draft, { operationId: "test:supported-pod", at: AT });
  assert.equal(crafted.state.concepts.find(({ kind }) => kind === "bean-pod").quality, "resonant");
});

test("one exact rollback survives sanitation and restores the previous economic topology once", () => {
  const state = reachFirstWeave();
  const applied = applySettlementOperation(state, { type: "separate-regolith", operationId: "test:rollback-weave" }, { at: AT });
  assert.equal(applied.state.rollbackReceipt.operationId, "test:rollback-weave");
  const reloaded = sanitizeMoonSettlement(JSON.parse(JSON.stringify(applied.state)));
  assert.equal(reloaded.rollbackReceipt.operationId, "test:rollback-weave");

  const rollback = applySettlementOperation(reloaded, { type: "rollback" }, { at: "2026-08-20T12:00:05.000Z" });
  assert.equal(rollback.applied, true);
  assert.equal(rollback.state.concepts.some(({ kind }) => kind === "regolith-sample"), true);
  assert.equal(rollback.state.concepts.some(({ word }) => word === "Earth"), false);
  assert.equal(rollback.state.goods.Soil, 0);
  assert.equal(rollback.state.matter, 0);
  assert.equal(rollback.state.rollbackReceipt, null);

  const second = applySettlementOperation(rollback.state, { type: "rollback" });
  assert.equal(second.applied, false);
  assert.equal(second.reason, "rollback_unavailable");
});

test("quotes reject unaffordable actions without negative goods or revision changes", () => {
  const poor = sanitizeMoonSettlement({
    ...reachFirstWeave(),
    goods: Object.fromEntries(MOON_SETTLEMENT_GOODS.map((key) => [key, 0]))
  });
  const quote = quoteSettlementOperation(poor, { type: "separate-regolith", operationId: "test:poor-weave" });
  assert.equal(quote.accepted, false);
  assert.equal(quote.reason, "insufficient_regolith");
  const result = applySettlementOperation(poor, { type: "separate-regolith", operationId: "test:poor-weave" });
  assert.equal(result.applied, false);
  assert.equal(result.state.revision, poor.revision);
  assert.equal(Object.values(result.state.goods).every((amount) => amount >= 0), true);
});

test("optional bubble economy gives one no-repeat Stable random discovery for Gate-1 Matter", () => {
  let state = reachFirstWeave();
  state = apply(state, "separate-regolith", {}, "bubble-weave");
  assert.equal(state.matter, 1);
  const quote = quoteSettlementOperation(state, { type: "buy-bubble", operationId: "test:bubble", bubbleType: "random" });
  assert.equal(quote.accepted, true);
  assert.equal(quote.matterChange, -1);
  assert.equal(quote.quality, "stable");
  state = apply(state, "buy-bubble", { bubbleType: "random" }, "bubble");
  assert.equal(state.matter, 0);
  assert.equal(state.knowledge.includes("Water"), true);
  assert.equal(state.concepts.find(({ kind }) => kind === "bubble").quality, "stable");

  const typed = quoteSettlementOperation(state, { type: "buy-bubble", operationId: "test:typed", bubbleType: "typed", ingredients: ["Earth", "Life"] });
  assert.equal(typed.accepted, false);
  assert.equal(typed.reason, "insufficient_matter");
});

test("unknown topology cuts produce recoverable unnamed fragments with preserved provenance", () => {
  const base = reachFirstWeave();
  const state = sanitizeMoonSettlement({
    ...base,
    concepts: [...base.concepts, {
      id: "odd-composite", word: "Odd Composite", kind: "composite", quality: "stable", location: "inventory",
      atoms: [
        { id: "a", sigil: "A", material: "unknown", component: "Alpha" },
        { id: "b", sigil: "B", material: "unknown", component: "Beta" },
        { id: "c", sigil: "C", material: "unknown", component: "Gamma" }
      ],
      bonds: [
        { id: "ab", a: "a", b: "b", tier: "stable" },
        { id: "bc", a: "b", b: "c", tier: "stable" }
      ],
      cohesion: { basePool: 4, supportCapacity: 0 }, lineage: { kind: "test", sourceIds: ["origin"] }
    }]
  });
  const draft = deepClone(createStructureDraft(state, { kind: "concept", targetId: "odd-composite" }));
  draft.bonds.find(({ id }) => id === "ab").removed = true;
  const preview = previewStructureDraft(state, draft);
  assert.equal(preview.accepted, true);
  assert.equal(preview.resultingWords.some((word) => word.startsWith("Unnamed fragment")), true);
  const result = applyStructureDraft(state, draft, { operationId: "test:odd-cut", at: AT });
  assert.equal(result.applied, true);
  const fragments = result.state.concepts.filter(({ id }) => id.startsWith("odd-composite:fragment"));
  assert.equal(fragments.length, 2);
  assert.deepEqual(fragments[0].lineage.sourceIds, ["odd-composite"]);
});

test("Outpost v2 migration preserves founding choices, Stable structures, bounded legacy grants, and verification", () => {
  const migrated = migrateOutpostV2ToSettlementV3({
    version: 2,
    structures: {
      power: { choiceId: "solar", stage: 5, meaningCharge: 1_000, pending: 35 },
      shelter: { choiceId: "hive", stage: 4, meaningCharge: 500, pending: 20 },
      signal: { choiceId: "stars", stage: 3, meaningCharge: 200, pending: 15 }
    },
    meaningSpecialization: "garden"
  }, { at: AT });
  assert.deepEqual(migrated.founding, { power: "solar", shelter: "hive", signal: "stars" });
  assert.equal(migrated.modules.length, 3);
  assert.equal(migrated.structures.filter(({ lineage }) => lineage.kind === "outpost-v2").every(({ quality }) => quality === "stable"), true);
  assert.equal(migrated.legacy.sourceVersion, 2);
  assert.equal(migrated.legacy.matterGrant, 6);
  assert.equal(migrated.legacy.pendingStardust, 70);
  assert.equal(migrated.legacy.verificationRequired, true);
  assert.equal(migrated.historyMarks.includes("meaning-garden"), true);
  assert.equal(migrated.receipts.some(({ id }) => id === "migration:outpost-v2:v3"), true);
});

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
