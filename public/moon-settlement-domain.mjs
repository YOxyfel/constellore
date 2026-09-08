/**
 * Isolated Moon Settlement domain for the disposable Living Ground lab.
 *
 * This module deliberately has no DOM, storage, timer, or Word Node Lab
 * dependencies. Callers own persistence and pass time explicitly whenever a
 * production result is resolved.
 */

import {
  normalizeMoonSettlementPlacement,
  validateMoonSettlementPlacement
} from "./moon-settlement-placement.mjs?v=5.0.0-beta.4";

export const MOON_SETTLEMENT_VERSION = 1;
export const MOON_SETTLEMENT_SCHEMA = "SettlementStateV1";
export const MOON_SETTLEMENT_GOODS = Object.freeze([
  "Regolith", "Ice", "Water", "Soil", "Biomass", "Food", "Parts", "Fuel"
]);
export const MOON_SETTLEMENT_PORT_TYPES = Object.freeze(["Power", "Material", "Life", "Signal"]);
export const MOON_SETTLEMENT_BOND_TIERS = Object.freeze(["weak", "stable", "reinforced"]);
export const MOON_SETTLEMENT_QUALITIES = Object.freeze(["rough", "stable", "resonant"]);

const MAX_RESOURCE = 10_000;
const MAX_MATTER = 1_000;
const MAX_RECEIPTS = 256;
const MAX_STRUCTURES = 32;
const MAX_CONCEPTS = 96;
const MAX_DRIFT = 32;
const MAX_TRAYS = 16;
const MAX_HISTORY_MARKS = 64;
const MAX_ID = 80;
const BOND_VALUE = Object.freeze({ weak: 1, stable: 2, reinforced: 3 });

const FOUNDING_CHOICES = Object.freeze({
  power: Object.freeze({
    solar: { title: "Solar Power", ports: ["Power", "Signal"], bottleneck: "shade" },
    lunar: { title: "Lunar Power", ports: ["Power", "Material"], bottleneck: "regolith-feed" }
  }),
  shelter: Object.freeze({
    bastion: { title: "Bastion Shelter", ports: ["Power", "Material"], bottleneck: "parts" },
    hive: { title: "Hive Shelter", ports: ["Power", "Life"], bottleneck: "space" },
    haven: { title: "Haven Shelter", ports: ["Life", "Signal"], bottleneck: "water" }
  }),
  signal: Object.freeze({
    beacon: { title: "Beacon Signal", ports: ["Power", "Signal"], bottleneck: "line-of-sight" },
    stars: { title: "Star Map Signal", ports: ["Signal", "Life"], bottleneck: "calibration" }
  })
});

const BUILDINGS = Object.freeze({
  processor: {
    title: "Regolith Processor", siteId: "utility-west", ports: ["Power", "Material"],
    cost: { Regolith: 4, Parts: 2 }
  },
  storage: {
    title: "Visible Storage", siteId: "utility-east", ports: ["Material", "Signal"],
    cost: { Regolith: 3, Parts: 1 }
  },
  reservoir: {
    title: "Matter Reservoir", siteId: "archive", ports: ["Material", "Signal"],
    cost: { Regolith: 2, Parts: 2 }
  },
  shelter: {
    title: "Living Shelter", siteId: "shelter", ports: ["Power", "Life"],
    cost: { Regolith: 5, Parts: 3 }
  },
  greenhouse: {
    title: "Walkable Greenhouse", siteId: "greenhouse", ports: ["Power", "Life", "Material"],
    cost: { Regolith: 4, Parts: 3 }
  },
  "power-array": {
    title: "Legacy Power Array", siteId: "power", ports: ["Power", "Signal"], cost: {}
  },
  "signal-array": {
    title: "Legacy Signal Array", siteId: "signal", ports: ["Power", "Signal"], cost: {}
  }
});

const REQUIRED_BUILDINGS = Object.freeze(["processor", "storage", "reservoir", "shelter", "greenhouse"]);
const BUBBLE_BAG = Object.freeze(["Water", "Stone", "Air", "Light", "Clay", "Fiber"]);
const KNOWN_TYPED_COMBOS = Object.freeze({
  'earth+life': "Living Soil",
  'earth+water': "Mud",
  'air+water': "Mist",
  'light+water': "Growth Light"
});

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function cleanText(value, maximum = MAX_ID) {
  if (value == null) return "";
  try {
    return String(value).normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, maximum);
  } catch {
    return "";
  }
}

function cleanId(value, maximum = MAX_ID) {
  return cleanText(value, maximum).toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9:_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.floor(number))) : fallback;
}

function cleanTimestamp(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const candidate = cleanText(value, 40);
  return candidate && Number.isFinite(Date.parse(candidate)) ? new Date(candidate).toISOString() : "";
}

function nowIso(value) {
  return cleanTimestamp(value) || new Date().toISOString();
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function emptyGoods() {
  return Object.fromEntries(MOON_SETTLEMENT_GOODS.map((key) => [key, 0]));
}

function initialStructure(id, type, status, siteId, ports) {
  return {
    id, type, title: type === "lander" ? "Lander" : type === "starter-vault" ? "Biological Starter Vault" : "World Seed Cradle",
    siteId, status, quality: "stable", ports: [...ports], modules: [], driftIds: [],
    placement: normalizeMoonSettlementPlacement({}, { siteId }),
    lineage: { kind: "authored", sourceIds: [], recipeId: `moon:${type}`, operationId: "" }
  };
}

function emptyState() {
  const goods = emptyGoods();
  Object.assign(goods, { Regolith: 18, Biomass: 6, Parts: 18, Fuel: 2 });
  return {
    version: MOON_SETTLEMENT_VERSION,
    schema: MOON_SETTLEMENT_SCHEMA,
    worldId: "moon",
    revision: 0,
    founding: { power: "", shelter: "", signal: "" },
    sites: [
      { id: "lander", kind: "arrival", unlocked: true, occupiedBy: "lander" },
      { id: "power", kind: "founding", unlocked: true, occupiedBy: "" },
      { id: "signal", kind: "founding", unlocked: true, occupiedBy: "" },
      { id: "shelter", kind: "hero", unlocked: true, occupiedBy: "" },
      { id: "utility-west", kind: "utility", unlocked: true, occupiedBy: "" },
      { id: "utility-east", kind: "utility", unlocked: true, occupiedBy: "" },
      { id: "archive", kind: "utility", unlocked: true, occupiedBy: "" },
      { id: "greenhouse", kind: "hero", unlocked: true, occupiedBy: "" },
      { id: "seed-cradle", kind: "landmark", unlocked: true, occupiedBy: "world-seed-cradle" }
    ],
    structures: [
      initialStructure("lander", "lander", "active", "lander", ["Power", "Material", "Signal"]),
      initialStructure("starter-vault", "starter-vault", "damaged", "lander", ["Life", "Material"]),
      initialStructure("world-seed-cradle", "world-seed-cradle", "dormant", "seed-cradle", ["Life", "Signal"])
    ],
    modules: [],
    ports: [],
    connections: [],
    concepts: [],
    knowledge: ["Life", "Regolith", "Seed"],
    goods,
    capacities: Object.fromEntries(MOON_SETTLEMENT_GOODS.map((key) => [key, 40])),
    matter: 0,
    matterCapacity: 12,
    inventory: { capacity: 4, conceptIds: [] },
    productionTrays: [],
    drift: [],
    projects: [{ id: "living-ground", status: "active", startedAt: "", completedAt: "" }],
    proofs: [],
    receipts: [],
    rollbackReceipt: null,
    historyMarks: [],
    legacy: { sourceVersion: 0, matterGrant: 0, pendingStardust: 0, verificationRequired: false }
  };
}

function canonicalFounding(source) {
  const raw = plainObject(source) || {};
  const result = { power: "", shelter: "", signal: "" };
  for (const slot of Object.keys(result)) {
    const choiceId = cleanId(raw[slot], 32);
    result[slot] = FOUNDING_CHOICES[slot][choiceId] ? choiceId : "";
  }
  return result;
}

function canonicalLineage(source) {
  const raw = plainObject(source) || {};
  return {
    kind: cleanId(raw.kind, 32) || "authored",
    sourceIds: [...new Set((Array.isArray(raw.sourceIds) ? raw.sourceIds : []).map((id) => cleanId(id)).filter(Boolean))].slice(0, 16),
    recipeId: cleanId(raw.recipeId, 80),
    operationId: cleanId(raw.operationId, 80)
  };
}

function canonicalStructure(source) {
  const raw = plainObject(source);
  if (!raw) return null;
  const id = cleanId(raw.id);
  const type = cleanId(raw.type, 48);
  if (!id || !type) return null;
  const quality = MOON_SETTLEMENT_QUALITIES.includes(raw.quality) ? raw.quality : "stable";
  const status = ["active", "damaged", "dormant", "paused", "building"].includes(raw.status) ? raw.status : "active";
  return {
    id, type, title: cleanText(raw.title, 80) || BUILDINGS[type]?.title || type,
    siteId: cleanId(raw.siteId), status, quality,
    placement: normalizeMoonSettlementPlacement(raw.placement, { siteId: cleanId(raw.siteId) }),
    ports: [...new Set((Array.isArray(raw.ports) ? raw.ports : []).filter((port) => MOON_SETTLEMENT_PORT_TYPES.includes(port)))].slice(0, 4),
    modules: [...new Set((Array.isArray(raw.modules) ? raw.modules : []).map((id) => cleanId(id)).filter(Boolean))].slice(0, 12),
    driftIds: [...new Set((Array.isArray(raw.driftIds) ? raw.driftIds : []).map((id) => cleanId(id)).filter(Boolean))].slice(0, 12),
    lineage: canonicalLineage(raw.lineage)
  };
}

function canonicalAtom(source, index) {
  const raw = plainObject(source) || {};
  const id = cleanId(raw.id, 48) || `atom-${index + 1}`;
  return {
    id,
    sigil: cleanText(raw.sigil, 3) || "?",
    material: cleanId(raw.material, 32) || "unknown",
    component: cleanText(raw.component, 48) || cleanText(raw.sigil, 3) || "Unknown"
  };
}

function canonicalConcept(source) {
  const raw = plainObject(source);
  if (!raw) return null;
  const id = cleanId(raw.id);
  const word = cleanText(raw.word, 80);
  if (!id || !word) return null;
  const atoms = [];
  const atomIds = new Set();
  for (const [index, value] of (Array.isArray(raw.atoms) ? raw.atoms : []).slice(0, 8).entries()) {
    const atom = canonicalAtom(value, index);
    if (atomIds.has(atom.id)) continue;
    atomIds.add(atom.id);
    atoms.push(atom);
  }
  const bonds = [];
  const bondIds = new Set();
  let spent = 0;
  const basePool = clampInteger(raw.cohesion?.basePool, 0, 48, Math.max(0, atoms.length - 1) * 2);
  const supportCapacity = clampInteger(raw.cohesion?.supportCapacity, 0, 24, 0);
  for (const value of (Array.isArray(raw.bonds) ? raw.bonds : []).slice(0, 16)) {
    const bond = plainObject(value) || {};
    const idValue = cleanId(bond.id, 48);
    const a = cleanId(bond.a, 48);
    const b = cleanId(bond.b, 48);
    const tier = MOON_SETTLEMENT_BOND_TIERS.includes(bond.tier) ? bond.tier : "stable";
    if (!idValue || bondIds.has(idValue) || !atomIds.has(a) || !atomIds.has(b) || a === b) continue;
    if (spent + BOND_VALUE[tier] > basePool + supportCapacity) continue;
    spent += BOND_VALUE[tier];
    bondIds.add(idValue);
    bonds.push({ id: idValue, a, b, tier });
  }
  return {
    id, word, kind: cleanId(raw.kind, 32) || "composite",
    quality: MOON_SETTLEMENT_QUALITIES.includes(raw.quality) ? raw.quality : "stable",
    location: cleanId(raw.location) || "inventory",
    atoms, bonds, cohesion: { basePool, supportCapacity }, lineage: canonicalLineage(raw.lineage)
  };
}

function canonicalReceipt(source) {
  const raw = plainObject(source);
  const id = cleanId(raw?.id);
  const type = cleanId(raw?.type, 48);
  if (!id || !type) return null;
  return { id, type, revision: clampInteger(raw.revision, 0, 1_000_000, 0), at: cleanTimestamp(raw.at) };
}

function sanitizeInternal(raw, { allowRollback = true } = {}) {
  const source = plainObject(raw) || {};
  const base = emptyState();
  base.revision = clampInteger(source.revision, 0, 1_000_000, 0);
  base.founding = canonicalFounding(source.founding);

  const structures = [];
  const structureIds = new Set();
  for (const value of (Array.isArray(source.structures) ? source.structures : base.structures).slice(0, MAX_STRUCTURES * 2)) {
    const structure = canonicalStructure(value);
    if (!structure || structureIds.has(structure.id)) continue;
    structureIds.add(structure.id);
    structures.push(structure);
    if (structures.length >= MAX_STRUCTURES) break;
  }
  for (const required of base.structures) {
    if (!structureIds.has(required.id)) structures.unshift(required);
  }
  base.structures = structures.slice(0, MAX_STRUCTURES);

  const occupied = new Map(base.structures.map((entry) => [entry.siteId, entry.id]));
  base.sites = base.sites.map((site) => ({ ...site, occupiedBy: occupied.get(site.id) || "" }));

  const modules = [];
  const moduleIds = new Set();
  for (const value of (Array.isArray(source.modules) ? source.modules : []).slice(0, 24)) {
    const entry = plainObject(value) || {};
    const id = cleanId(entry.id);
    const slot = cleanId(entry.slot, 32);
    const choiceId = cleanId(entry.choiceId, 32);
    if (!id || moduleIds.has(id) || !FOUNDING_CHOICES[slot]?.[choiceId]) continue;
    moduleIds.add(id);
    modules.push({
      id, slot, choiceId, title: FOUNDING_CHOICES[slot][choiceId].title,
      ports: [...FOUNDING_CHOICES[slot][choiceId].ports],
      placement: normalizeMoonSettlementPlacement(entry.placement, { siteId: slot })
    });
  }
  base.modules = modules;
  base.ports = [
    ...base.structures.flatMap((structure) => structure.ports.map((portType, index) => ({
      id: `port:${structure.id}:${portType.toLocaleLowerCase("en-US")}:${index + 1}`,
      ownerId: structure.id,
      ownerKind: "structure",
      portType
    }))),
    ...base.modules.flatMap((module) => module.ports.map((portType, index) => ({
      id: `port:${module.id}:${portType.toLocaleLowerCase("en-US")}:${index + 1}`,
      ownerId: module.id,
      ownerKind: "module",
      portType
    })))
  ].slice(0, 128);

  const goods = emptyGoods();
  const rawGoods = plainObject(source.goods) || base.goods;
  const rawCapacities = plainObject(source.capacities) || base.capacities;
  const capacities = emptyGoods();
  for (const key of MOON_SETTLEMENT_GOODS) {
    capacities[key] = clampInteger(rawCapacities[key], 1, MAX_RESOURCE, 40);
    goods[key] = clampInteger(rawGoods[key], 0, capacities[key], 0);
  }
  base.goods = goods;
  base.capacities = capacities;
  base.matterCapacity = clampInteger(source.matterCapacity, 1, MAX_MATTER, 12);
  base.matter = clampInteger(source.matter, 0, base.matterCapacity, 0);

  const concepts = [];
  const conceptIds = new Set();
  for (const value of (Array.isArray(source.concepts) ? source.concepts : []).slice(0, MAX_CONCEPTS * 2)) {
    const concept = canonicalConcept(value);
    if (!concept || conceptIds.has(concept.id)) continue;
    conceptIds.add(concept.id);
    concepts.push(concept);
    if (concepts.length >= MAX_CONCEPTS) break;
  }
  base.concepts = concepts;
  base.knowledge = [...new Set((Array.isArray(source.knowledge) ? source.knowledge : base.knowledge).map((word) => cleanText(word, 80)).filter(Boolean))].slice(0, 128);
  base.inventory = {
    capacity: clampInteger(source.inventory?.capacity, 1, 12, 4),
    conceptIds: [...new Set((Array.isArray(source.inventory?.conceptIds) ? source.inventory.conceptIds : []).map((id) => cleanId(id)).filter((id) => conceptIds.has(id)))].slice(0, 12)
  };

  base.connections = (Array.isArray(source.connections) ? source.connections : []).slice(0, 64).map((value) => {
    const entry = plainObject(value) || {};
    const from = cleanId(entry.from);
    const to = cleanId(entry.to);
    const portType = MOON_SETTLEMENT_PORT_TYPES.includes(entry.portType) ? entry.portType : "Material";
    return from && to && from !== to ? { id: cleanId(entry.id) || `link:${from}:${to}:${portType.toLowerCase()}`, from, to, portType } : null;
  }).filter(Boolean);

  base.drift = (Array.isArray(source.drift) ? source.drift : []).slice(0, MAX_DRIFT).map((value) => {
    const entry = plainObject(value) || {};
    const id = cleanId(entry.id);
    const kind = ["Dust", "Heat", "Mold", "Waste", "Strain"].includes(entry.kind) ? entry.kind : "Strain";
    return id ? {
      id, kind, structureId: cleanId(entry.structureId), severity: clampInteger(entry.severity, 1, 3, 1),
      stressTier: MOON_SETTLEMENT_BOND_TIERS.includes(entry.stressTier) ? entry.stressTier : "weak",
      status: entry.status === "cleared" ? "cleared" : "active", sourceReceiptId: cleanId(entry.sourceReceiptId)
    } : null;
  }).filter(Boolean);

  base.productionTrays = (Array.isArray(source.productionTrays) ? source.productionTrays : []).slice(0, MAX_TRAYS).map((value) => {
    const entry = plainObject(value) || {};
    const id = cleanId(entry.id);
    if (!id) return null;
    const status = ["running", "ready", "complete", "paused"].includes(entry.status) ? entry.status : "paused";
    return {
      id, structureId: cleanId(entry.structureId) || "structure-greenhouse", recipeId: cleanId(entry.recipeId) || "bean-crop",
      status, startedAt: cleanTimestamp(entry.startedAt), readyAt: cleanTimestamp(entry.readyAt), completedAt: cleanTimestamp(entry.completedAt),
      batchCount: clampInteger(entry.batchCount, 1, 1, 1), pauseReason: cleanId(entry.pauseReason, 48)
    };
  }).filter(Boolean);

  base.projects = [{
    id: "living-ground",
    status: source.projects?.find?.((entry) => entry?.id === "living-ground")?.status === "complete" ? "complete" : "active",
    startedAt: cleanTimestamp(source.projects?.find?.((entry) => entry?.id === "living-ground")?.startedAt),
    completedAt: cleanTimestamp(source.projects?.find?.((entry) => entry?.id === "living-ground")?.completedAt)
  }];
  base.proofs = (Array.isArray(source.proofs) ? source.proofs : []).slice(0, 16).map((value) => {
    const entry = plainObject(value) || {};
    const id = cleanId(entry.id);
    return id ? { id, title: cleanText(entry.title, 80), awardedAt: cleanTimestamp(entry.awardedAt) } : null;
  }).filter(Boolean);

  const receiptIds = new Set();
  base.receipts = [];
  for (const value of (Array.isArray(source.receipts) ? source.receipts : []).slice(-MAX_RECEIPTS * 2)) {
    const receipt = canonicalReceipt(value);
    if (!receipt || receiptIds.has(receipt.id)) continue;
    receiptIds.add(receipt.id);
    base.receipts.push(receipt);
  }
  base.receipts = base.receipts.slice(-MAX_RECEIPTS);
  base.historyMarks = [...new Set((Array.isArray(source.historyMarks) ? source.historyMarks : []).map((value) => cleanId(value)).filter(Boolean))].slice(0, MAX_HISTORY_MARKS);
  base.legacy = {
    sourceVersion: clampInteger(source.legacy?.sourceVersion, 0, 10, 0),
    matterGrant: clampInteger(source.legacy?.matterGrant, 0, MAX_MATTER, 0),
    pendingStardust: clampInteger(source.legacy?.pendingStardust, 0, 1_000_000, 0),
    verificationRequired: source.legacy?.verificationRequired === true
  };

  if (allowRollback && plainObject(source.rollbackReceipt)?.snapshot) {
    const operationId = cleanId(source.rollbackReceipt.operationId);
    if (operationId) {
      const snapshot = sanitizeInternal(source.rollbackReceipt.snapshot, { allowRollback: false });
      const snapshotProofs = new Set(snapshot.proofs.map((proof) => proof.id));
      const preservesPermanentProofs = base.proofs.every((proof) => snapshotProofs.has(proof.id));
      if (preservesPermanentProofs) {
        base.rollbackReceipt = {
          operationId,
          revisionBefore: clampInteger(source.rollbackReceipt.revisionBefore, 0, base.revision, 0),
          createdAt: cleanTimestamp(source.rollbackReceipt.createdAt),
          snapshot
        };
      }
    }
  }
  return base;
}

/** Creates the disposable, deterministic start of the Living Ground slice. */
export function createMoonSettlement(options = {}) {
  const state = emptyState();
  state.projects[0].startedAt = cleanTimestamp(options.at);
  return deepFreeze(sanitizeInternal(state));
}

/** Returns a bounded, JSON-safe SettlementStateV1 and strips unknown fields. */
export function sanitizeMoonSettlement(raw) {
  return deepFreeze(sanitizeInternal(raw));
}

function structureByType(state, type) {
  return state.structures.find((entry) => entry.type === type) || null;
}

function conceptByWord(state, word) {
  const key = cleanText(word).toLocaleLowerCase("en-US");
  return state.concepts.find((entry) => entry.word.toLocaleLowerCase("en-US") === key) || null;
}

function activeDrift(state, kind = "") {
  return state.drift.filter((entry) => entry.status === "active" && (!kind || entry.kind === kind));
}

function foundingComplete(state) {
  return Object.values(state.founding).every(Boolean);
}

function stageFor(state) {
  if (state.proofs.some((proof) => proof.id === "living-ground")) return "open-play";
  const proof = deriveProofState(state);
  if (proof.eligible) return "proof-ready";
  if (state.productionTrays.some((tray) => tray.status === "running" || tray.status === "ready" || tray.status === "complete")) return "growth";
  if (state.concepts.filter((entry) => entry.kind === "bean-pod").length >= 6) return "cultivation-ready";
  if (REQUIRED_BUILDINGS.every((type) => structureByType(state, type))) return "cultivation";
  if (conceptByWord(state, "Earth")) return "construction";
  if (state.concepts.some((entry) => entry.kind === "regolith-sample")) return "first-weave";
  if (state.structures.find((entry) => entry.id === "starter-vault")?.status === "active") return "ground";
  return foundingComplete(state) ? "vault-repair" : "landing";
}

function nextActionsFor(state) {
  const actions = [];
  for (const slot of ["power", "shelter", "signal"]) if (!state.founding[slot]) actions.push(`choose-${slot}`);
  if (foundingComplete(state) && state.structures.find((entry) => entry.id === "starter-vault")?.status !== "active") actions.push("repair-vault");
  if (!state.concepts.some((entry) => entry.kind === "regolith-sample") && !conceptByWord(state, "Earth")) actions.push("sample-regolith");
  if (state.concepts.some((entry) => entry.kind === "regolith-sample")) actions.push("separate-regolith");
  for (const type of REQUIRED_BUILDINGS) if (!structureByType(state, type)) actions.push(`build-${type}`);
  const pods = state.concepts.filter((entry) => entry.kind === "bean-pod").length;
  if (REQUIRED_BUILDINGS.every((type) => structureByType(state, type)) && pods < 6) actions.push("craft-bean-pod");
  if (pods >= 6 && !state.productionTrays.length) actions.push("start-production");
  if (state.productionTrays.some((tray) => ["running", "ready"].includes(tray.status))) actions.push("resolve-production");
  if (activeDrift(state, "Dust").length) actions.push("clear-drift");
  if (deriveProofState(state).eligible) actions.push("claim-living-ground");
  if (state.matter >= 1) actions.push("buy-random-bubble");
  return actions;
}

/** Small read model for UI; no mutable state references are returned. */
export function projectMoonSettlement(raw, options = {}) {
  const state = sanitizeInternal(raw);
  const proof = deriveProofState(state);
  return deepFreeze({
    version: state.version,
    revision: state.revision,
    worldId: state.worldId,
    stage: stageFor(state),
    founding: deepClone(state.founding),
    structures: deepClone(state.structures),
    modules: deepClone(state.modules),
    ports: deepClone(state.ports),
    connections: deepClone(state.connections),
    concepts: deepClone(state.concepts),
    goods: deepClone(state.goods),
    capacities: Object.fromEntries(MOON_SETTLEMENT_GOODS.map((key) => [key, Math.min(MAX_RESOURCE, state.capacities[key])])),
    Matter: { current: state.matter, capacity: state.matterCapacity },
    inventory: deepClone(state.inventory),
    productionTrays: deepClone(state.productionTrays),
    drift: deepClone(activeDrift(state)),
    proof,
    nextActions: nextActionsFor(state),
    canRollback: Boolean(state.rollbackReceipt),
    simulatedAt: cleanTimestamp(options.at)
  });
}

function hasResources(state, cost) {
  return Object.entries(cost).every(([key, amount]) => state.goods[key] >= amount);
}

function quoteBase(state, operation) {
  return {
    operation: cleanId(operation?.type, 48), accepted: false, reason: "invalid_operation",
    resourceChanges: {}, matterChange: 0, resultingWords: [], fragments: [], quality: "stable",
    driftRisk: [], worldChanges: [], exact: true
  };
}

/** Quotes exact Gate-1 resource, semantic, Drift, and world consequences. */
export function quoteSettlementOperation(raw, operation, options = {}) {
  const state = sanitizeInternal(raw);
  const op = plainObject(operation) || {};
  const quote = quoteBase(state, op);
  const type = cleanId(op.type, 48);
  const operationId = cleanId(op.operationId ?? op.id);
  if (type !== "rollback" && type !== "leave-settlement" && !operationId) return deepFreeze({ ...quote, reason: "missing_operation_id" });
  if (operationId && state.receipts.some((entry) => entry.id === operationId)) return deepFreeze({ ...quote, reason: "duplicate_operation" });

  if (type === "choose-founding") {
    const slot = cleanId(op.slot, 32);
    const choiceId = cleanId(op.choiceId, 32);
    if (!FOUNDING_CHOICES[slot]?.[choiceId]) return deepFreeze({ ...quote, reason: "invalid_founding_choice" });
    if (state.founding[slot]) return deepFreeze({ ...quote, reason: state.founding[slot] === choiceId ? "already_chosen" : "founding_choice_locked" });
    const placement = validateMoonSettlementPlacement(op.placement, { siteId: slot });
    if (!placement.valid) return deepFreeze({ ...quote, reason: placement.reason });
    return deepFreeze({
      ...quote,
      accepted: true,
      reason: "ready",
      worldChanges: [`Install ${FOUNDING_CHOICES[slot][choiceId].title} on the selected parcel cell`]
    });
  }
  if (type === "repair-vault") {
    if (!foundingComplete(state)) return deepFreeze({ ...quote, reason: "founding_incomplete" });
    const vault = state.structures.find((entry) => entry.id === "starter-vault");
    if (vault?.status === "active") return deepFreeze({ ...quote, reason: "already_repaired" });
    const cost = { Parts: -3 };
    if (!hasResources(state, { Parts: 3 })) return deepFreeze({ ...quote, reason: "insufficient_parts", resourceChanges: cost });
    return deepFreeze({ ...quote, accepted: true, reason: "ready", resourceChanges: cost, worldChanges: ["Biological starter vault opens"] });
  }
  if (type === "sample-regolith") {
    if (state.structures.find((entry) => entry.id === "starter-vault")?.status !== "active") return deepFreeze({ ...quote, reason: "vault_not_repaired" });
    if (state.concepts.some((entry) => entry.kind === "regolith-sample") || conceptByWord(state, "Earth")) return deepFreeze({ ...quote, reason: "already_sampled" });
    return deepFreeze({ ...quote, accepted: true, reason: "ready", resourceChanges: { Regolith: 10 }, resultingWords: ["Regolith Sample"], worldChanges: ["Nearby sample site is marked"] });
  }
  if (type === "separate-regolith") {
    if (!state.concepts.some((entry) => entry.kind === "regolith-sample")) return deepFreeze({ ...quote, reason: "sample_missing" });
    if (!hasResources(state, { Regolith: 7 })) return deepFreeze({ ...quote, reason: "insufficient_regolith" });
    return deepFreeze({ ...quote, accepted: true, reason: "ready", resourceChanges: { Regolith: -7, Soil: 6 }, matterChange: 1, resultingWords: ["Earth", "Dust"], fragments: ["Earth", "Dust"], quality: "stable", worldChanges: ["Usable Earth is separated", "Matter reservoir receives recovered Dust potential"] });
  }
  if (type === "build-structure") {
    const structureType = cleanId(op.structureType, 48);
    const definition = BUILDINGS[structureType];
    if (!definition || !REQUIRED_BUILDINGS.includes(structureType)) return deepFreeze({ ...quote, reason: "unknown_structure" });
    if (!conceptByWord(state, "Earth")) return deepFreeze({ ...quote, reason: "earth_not_separated" });
    if (structureByType(state, structureType)) return deepFreeze({ ...quote, reason: "already_built" });
    const placement = validateMoonSettlementPlacement(op.placement, { siteId: definition.siteId });
    if (!placement.valid) return deepFreeze({ ...quote, reason: placement.reason });
    const delta = Object.fromEntries(Object.entries(definition.cost).map(([key, value]) => [key, -value]));
    if (!hasResources(state, definition.cost)) return deepFreeze({ ...quote, reason: "insufficient_goods", resourceChanges: delta });
    return deepFreeze({ ...quote, accepted: true, reason: "ready", resourceChanges: delta, worldChanges: [`Drones assemble ${definition.title}`] });
  }
  if (type === "craft-bean-pod") {
    if (!structureByType(state, "greenhouse")) return deepFreeze({ ...quote, reason: "greenhouse_missing" });
    if (state.concepts.filter((entry) => entry.kind === "bean-pod").length >= 6) return deepFreeze({ ...quote, reason: "pod_limit_reached" });
    if (!hasResources(state, { Soil: 1, Biomass: 1 })) return deepFreeze({ ...quote, reason: "insufficient_crop_inputs", resourceChanges: { Soil: -1, Biomass: -1 } });
    const quality = MOON_SETTLEMENT_QUALITIES.includes(op.quality) ? op.quality : "stable";
    return deepFreeze({ ...quote, accepted: true, reason: "ready", resourceChanges: { Soil: -1, Biomass: -1 }, resultingWords: ["Bean Crop Pod"], quality, worldChanges: ["One crop seat fills in the Greenhouse"] });
  }
  if (type === "start-production") {
    const pods = state.concepts.filter((entry) => entry.kind === "bean-pod");
    if (pods.length < 6) return deepFreeze({ ...quote, reason: "six_pods_required" });
    if (state.productionTrays.some((tray) => ["running", "ready"].includes(tray.status) || (tray.status === "paused" && tray.pauseReason === "storage-full"))) return deepFreeze({ ...quote, reason: "batch_already_active" });
    return deepFreeze({ ...quote, accepted: true, reason: "ready", worldChanges: ["First bean crop begins a visible two-minute batch"], driftRisk: [{ kind: "Dust", stressTier: "weak", deterministic: true }] });
  }
  if (type === "resolve-production") {
    const at = Date.parse(nowIso(options.at ?? op.at));
    const tray = state.productionTrays.find((entry) => ["running", "ready"].includes(entry.status) || (entry.status === "paused" && entry.pauseReason === "storage-full"));
    if (!tray) return deepFreeze({ ...quote, reason: "no_active_batch" });
    if (Date.parse(tray.readyAt) > at) return deepFreeze({ ...quote, reason: "batch_not_ready" });
    return deepFreeze({ ...quote, accepted: true, reason: "ready", resourceChanges: { Food: 6, Biomass: 2 }, resultingWords: ["First Harvest"], worldChanges: ["Bean plants fruit inside the Greenhouse"] });
  }
  if (type === "clear-drift") {
    const hazardId = cleanId(op.hazardId) || activeDrift(state, "Dust")[0]?.id;
    const hazard = state.drift.find((entry) => entry.id === hazardId && entry.status === "active");
    if (!hazard) return deepFreeze({ ...quote, reason: "hazard_missing" });
    if ((cleanId(op.method, 32) || "separate") !== "separate") return deepFreeze({ ...quote, reason: "wrong_hazard_method" });
    return deepFreeze({ ...quote, accepted: true, reason: "ready", resultingWords: [`Recovered ${hazard.kind}`], fragments: [hazard.kind], worldChanges: [`${hazard.kind} clears from ${hazard.structureId}`] });
  }
  if (type === "buy-bubble") {
    const bubbleType = cleanId(op.bubbleType, 16) || "random";
    const cost = bubbleType === "typed" ? 3 : bubbleType === "random" ? 1 : 0;
    if (!cost) return deepFreeze({ ...quote, reason: "invalid_bubble_type" });
    if (state.matter < cost) return deepFreeze({ ...quote, reason: "insufficient_matter", matterChange: -cost });
    if (bubbleType === "random") {
      const word = BUBBLE_BAG.find((candidate) => !state.knowledge.includes(candidate));
      if (!word) return deepFreeze({ ...quote, reason: "discovery_bag_empty" });
      return deepFreeze({ ...quote, accepted: true, reason: "ready", matterChange: -1, resultingWords: [word], quality: "stable", worldChanges: ["A no-repeat concept bubble forms"] });
    }
    const ingredients = [...new Set((Array.isArray(op.ingredients) ? op.ingredients : []).map((word) => cleanText(word, 80)).filter(Boolean))].slice(0, 2);
    if (ingredients.length !== 2 || ingredients.some((word) => !state.knowledge.includes(word))) return deepFreeze({ ...quote, reason: "typed_ingredients_missing", matterChange: -3 });
    const key = ingredients.map((word) => word.toLocaleLowerCase("en-US")).sort().join("+");
    return deepFreeze({ ...quote, accepted: true, reason: "ready", matterChange: -3, resultingWords: [KNOWN_TYPED_COMBOS[key] || `${ingredients[0]}–${ingredients[1]} Composite`], quality: MOON_SETTLEMENT_QUALITIES.includes(op.quality) ? op.quality : "stable", worldChanges: ["A controlled concept bubble forms"] });
  }
  if (type === "claim-proof") {
    const proofId = cleanId(op.proofId) || "living-ground";
    if (proofId !== "living-ground") return deepFreeze({ ...quote, reason: "unknown_proof" });
    if (state.proofs.some((entry) => entry.id === proofId)) return deepFreeze({ ...quote, reason: "proof_already_awarded" });
    if (!deriveProofState(state).eligible) return deepFreeze({ ...quote, reason: "proof_incomplete" });
    return deepFreeze({ ...quote, accepted: true, reason: "ready", resultingWords: ["Proof: Living Ground"], worldChanges: ["Greenhouse becomes a landmark", "World Seed cradle awakens", "Adaptive score gains its Life layer"] });
  }
  if (type === "rollback") return deepFreeze({ ...quote, accepted: Boolean(state.rollbackReceipt), reason: state.rollbackReceipt ? "ready" : "rollback_unavailable", worldChanges: ["Restore the exact previous expedition revision"] });
  if (type === "leave-settlement") return deepFreeze({ ...quote, accepted: true, reason: "ready" });
  return deepFreeze(quote);
}

function appendReceipt(state, operationId, type, at) {
  state.receipts = [...state.receipts, { id: operationId, type, revision: state.revision, at }].slice(-MAX_RECEIPTS);
}

function resourceDelta(state, changes) {
  for (const [key, amount] of Object.entries(changes)) {
    if (!MOON_SETTLEMENT_GOODS.includes(key)) continue;
    const cap = state.capacities[key];
    state.goods[key] = clampInteger(state.goods[key] + amount, 0, cap, 0);
  }
}

function concept(id, word, kind, quality, atoms, bonds, lineage, location = "inventory") {
  return canonicalConcept({
    id, word, kind, quality, location, atoms, bonds,
    cohesion: { basePool: bonds.reduce((sum, bond) => sum + BOND_VALUE[bond.tier], 0), supportCapacity: 0 }, lineage
  });
}

function snapshotForRollback(state) {
  const snapshot = deepClone(state);
  snapshot.rollbackReceipt = null;
  return snapshot;
}

function finalizeMutation(before, state, operationId, type, at, { rollback = true } = {}) {
  state.revision = before.revision + 1;
  appendReceipt(state, operationId, type, at);
  state.rollbackReceipt = rollback ? {
    operationId, revisionBefore: before.revision, createdAt: at, snapshot: snapshotForRollback(before)
  } : null;
  return deepFreeze(sanitizeInternal(state));
}

/** Applies one quoted operation atomically and records its idempotency receipt. */
export function applySettlementOperation(raw, operation, options = {}) {
  const before = sanitizeInternal(raw);
  const op = plainObject(operation) || {};
  const type = cleanId(op.type, 48);
  const operationId = cleanId(op.operationId ?? op.id) || (type === "rollback" ? `rollback:${before.revision}` : type === "leave-settlement" ? `leave:${before.revision}` : "");
  const quote = quoteSettlementOperation(before, { ...op, operationId }, options);
  if (!quote.accepted) return deepFreeze({ state: deepFreeze(before), applied: false, reason: quote.reason, quote });
  const at = nowIso(options.at ?? op.at);

  if (type === "rollback") {
    const restored = sanitizeInternal(before.rollbackReceipt.snapshot);
    restored.revision = before.revision + 1;
    appendReceipt(restored, operationId, "rollback", at);
    restored.rollbackReceipt = null;
    return deepFreeze({ state: deepFreeze(sanitizeInternal(restored)), applied: true, reason: "rolled_back", quote, receipt: { id: operationId, type: "rollback", at } });
  }

  const state = deepClone(before);
  if (type === "choose-founding") {
    const slot = cleanId(op.slot, 32);
    const choiceId = cleanId(op.choiceId, 32);
    const definition = FOUNDING_CHOICES[slot][choiceId];
    state.founding[slot] = choiceId;
    state.modules.push({
      id: `module-${slot}`, slot, choiceId, title: definition.title, ports: [...definition.ports],
      placement: normalizeMoonSettlementPlacement(op.placement, { siteId: slot })
    });
  } else if (type === "repair-vault") {
    state.structures.find((entry) => entry.id === "starter-vault").status = "active";
    resourceDelta(state, quote.resourceChanges);
  } else if (type === "sample-regolith") {
    resourceDelta(state, quote.resourceChanges);
    state.concepts.push(concept(
      "concept-regolith-sample", "Regolith Sample", "regolith-sample", "rough",
      [{ id: "reg-earth", sigil: "Ea", material: "earth", component: "Earth" }, { id: "reg-dust", sigil: "Du", material: "dust", component: "Dust" }],
      [{ id: "reg-bond", a: "reg-earth", b: "reg-dust", tier: "stable" }],
      { kind: "sample", sourceIds: ["site-regolith"], recipeId: "scan:regolith", operationId }
    ));
    state.knowledge.push("Regolith Sample");
  } else if (type === "separate-regolith") {
    resourceDelta(state, quote.resourceChanges);
    state.matter = Math.min(state.matterCapacity, state.matter + quote.matterChange);
    state.concepts = state.concepts.filter((entry) => entry.kind !== "regolith-sample");
    state.concepts.push(
      concept("concept-earth", "Earth", "element", "stable", [{ id: "earth-core", sigil: "Ea", material: "earth", component: "Earth" }], [], { kind: "fragment", sourceIds: ["concept-regolith-sample"], recipeId: "separate:regolith", operationId }),
      concept("concept-dust", "Dust", "fragment", "stable", [{ id: "dust-core", sigil: "Du", material: "dust", component: "Dust" }], [], { kind: "fragment", sourceIds: ["concept-regolith-sample"], recipeId: "separate:regolith", operationId }, "reservoir")
    );
    state.knowledge.push("Earth", "Dust");
  } else if (type === "build-structure") {
    const structureType = cleanId(op.structureType, 48);
    const definition = BUILDINGS[structureType];
    resourceDelta(state, quote.resourceChanges);
    const structureId = `structure-${structureType}`;
    state.structures.push({
      id: structureId, type: structureType, title: definition.title, siteId: definition.siteId,
      status: "active", quality: "stable", ports: [...definition.ports], modules: [], driftIds: [],
      placement: normalizeMoonSettlementPlacement(op.placement, { siteId: definition.siteId }),
      lineage: { kind: "construction", sourceIds: ["concept-earth"], recipeId: `build:${structureType}`, operationId }
    });
    const sharedPort = definition.ports.find((port) => ["Material", "Power", "Signal"].includes(port)) || definition.ports[0];
    state.connections.push({ id: `link:lander:${structureType}`, from: "lander", to: structureId, portType: sharedPort });
    if (structureType === "storage") for (const key of MOON_SETTLEMENT_GOODS) state.capacities[key] += 40;
    if (structureType === "reservoir") state.matterCapacity = 24;
  } else if (type === "craft-bean-pod") {
    resourceDelta(state, quote.resourceChanges);
    const number = state.concepts.filter((entry) => entry.kind === "bean-pod").length + 1;
    const quality = quote.quality;
    const tier = quality === "resonant" ? "reinforced" : quality === "rough" ? "weak" : "stable";
    state.concepts.push(concept(
      `bean-pod-${number}`, "Bean Crop Pod", "bean-pod", quality,
      [{ id: `pod-${number}-soil`, sigil: "So", material: "soil", component: "Living Soil" }, { id: `pod-${number}-seed`, sigil: "Se", material: "life", component: "Bean Seed" }],
      [{ id: `pod-${number}-bond`, a: `pod-${number}-soil`, b: `pod-${number}-seed`, tier }],
      { kind: "weave", sourceIds: ["concept-earth", "starter-vault"], recipeId: "craft:bean-pod", operationId }, "structure-greenhouse"
    ));
    state.knowledge.push("Bean Crop Pod");
  } else if (type === "start-production") {
    const startedAt = at;
    const readyAt = new Date(Date.parse(startedAt) + 2 * 60_000).toISOString();
    state.productionTrays = [{ id: cleanId(op.trayId) || "tray-first-harvest", structureId: "structure-greenhouse", recipeId: "bean-crop", status: "running", startedAt, readyAt, completedAt: "", batchCount: 1, pauseReason: "" }];
    if (!activeDrift(state, "Dust").length) {
      state.drift.push({ id: "drift-regolith-dust", kind: "Dust", structureId: "structure-processor", severity: 1, stressTier: "weak", status: "active", sourceReceiptId: operationId });
      const processor = structureByType(state, "processor");
      if (processor && !processor.driftIds.includes("drift-regolith-dust")) processor.driftIds.push("drift-regolith-dust");
    }
  } else if (type === "resolve-production") {
    return resolveProductionBatch(before, { at, operationId });
  } else if (type === "clear-drift") {
    return resolveHazard(before, { hazardId: cleanId(op.hazardId) || activeDrift(before, "Dust")[0]?.id, method: cleanId(op.method) || "separate", operationId, at });
  } else if (type === "buy-bubble") {
    state.matter += quote.matterChange;
    const word = quote.resultingWords[0];
    const sequence = state.concepts.filter((entry) => entry.kind === "bubble").length + 1;
    state.knowledge.push(word);
    state.concepts.push(concept(
      `bubble-${sequence}-${cleanId(word, 32)}`, word, "bubble", quote.quality,
      [{ id: `bubble-${sequence}-core`, sigil: cleanText(word, 2), material: "concept", component: word }], [],
      { kind: cleanId(op.bubbleType) === "typed" ? "typed-bubble" : "random-bubble", sourceIds: (op.ingredients || []).map((entry) => cleanId(entry)), recipeId: `bubble:${cleanId(op.bubbleType) || "random"}`, operationId }
    ));
  } else if (type === "claim-proof") {
    state.proofs.push({ id: "living-ground", title: "Living Ground — Matter can host Life", awardedAt: at });
    state.projects[0] = { ...state.projects[0], status: "complete", completedAt: at };
    state.structures.find((entry) => entry.id === "world-seed-cradle").status = "active";
    const greenhouse = structureByType(state, "greenhouse");
    if (greenhouse) greenhouse.modules.push("landmark-living-ground", "score-layer-life");
  } else if (type === "leave-settlement") {
    const finalState = finalizeMutation(before, state, operationId, type, at, { rollback: false });
    return deepFreeze({ state: finalState, applied: true, reason: "left_settlement", quote, receipt: { id: operationId, type, at } });
  }

  state.knowledge = [...new Set(state.knowledge)];
  const finalState = finalizeMutation(before, state, operationId, type, at, {
    rollback: type !== "start-production" && type !== "claim-proof"
  });
  return deepFreeze({ state: finalState, applied: true, reason: "applied", quote, receipt: { id: operationId, type, at } });
}

function connectedComponents(atoms, bonds) {
  const adjacency = new Map(atoms.map((atom) => [atom.id, new Set()]));
  for (const bond of bonds) {
    if (bond.removed === true || !adjacency.has(bond.a) || !adjacency.has(bond.b)) continue;
    adjacency.get(bond.a).add(bond.b);
    adjacency.get(bond.b).add(bond.a);
  }
  const result = [];
  const visited = new Set();
  for (const atom of atoms) {
    if (visited.has(atom.id)) continue;
    const stack = [atom.id];
    const componentIds = [];
    visited.add(atom.id);
    while (stack.length) {
      const id = stack.pop();
      componentIds.push(id);
      for (const neighbor of adjacency.get(id) || []) if (!visited.has(neighbor)) { visited.add(neighbor); stack.push(neighbor); }
    }
    result.push(componentIds);
  }
  return result;
}

/** Creates an ephemeral topology draft for a concept, bean-pod recipe, or Drift hazard. */
export function createStructureDraft(raw, target = {}) {
  const state = sanitizeInternal(raw);
  const request = typeof target === "string" ? { targetId: target } : plainObject(target) || {};
  const kind = cleanId(request.kind, 32) || (request.recipeId ? "recipe" : "concept");
  const targetId = cleanId(request.targetId ?? request.recipeId);
  let atoms = [];
  let bonds = [];
  let cohesion = { basePool: 0, supportCapacity: 0 };
  let mode = "unknown";
  if (kind === "recipe" && targetId === "bean-pod") {
    mode = "bean-pod";
    atoms = [{ id: "draft-soil", sigil: "So", material: "soil", component: "Living Soil" }, { id: "draft-seed", sigil: "Se", material: "life", component: "Bean Seed" }];
    bonds = [{ id: "draft-life-bond", a: "draft-soil", b: "draft-seed", tier: "stable" }];
    cohesion = { basePool: 2, supportCapacity: 0 };
  } else if (kind === "hazard") {
    const hazard = state.drift.find((entry) => entry.id === targetId && entry.status === "active");
    if (hazard) {
      mode = "hazard";
      atoms = [{ id: "host", sigil: "Pr", material: "metal", component: "Processor" }, { id: "drift", sigil: "Du", material: "dust", component: hazard.kind }];
      bonds = [{ id: "drift-bond", a: "host", b: "drift", tier: hazard.stressTier }];
      cohesion = { basePool: BOND_VALUE[hazard.stressTier], supportCapacity: 0 };
    }
  } else {
    const conceptEntry = state.concepts.find((entry) => entry.id === targetId) || state.concepts.find((entry) => entry.kind === "regolith-sample" && !targetId);
    if (conceptEntry) {
      mode = conceptEntry.kind === "regolith-sample" ? "regolith" : "concept";
      atoms = deepClone(conceptEntry.atoms);
      bonds = deepClone(conceptEntry.bonds);
      cohesion = deepClone(conceptEntry.cohesion);
    }
  }
  return deepFreeze({
    version: 1, id: `draft:${mode}:${targetId || state.revision}`, baseRevision: state.revision,
    kind, mode, targetId, atoms, bonds, cohesion, createdFromReceiptCount: state.receipts.length
  });
}

function qualityForBonds(bonds) {
  if (!bonds.length) return "stable";
  if (bonds.every((bond) => bond.tier === "reinforced")) return "resonant";
  if (bonds.some((bond) => bond.tier === "weak")) return "rough";
  return "stable";
}

/** Exact preview for a draft; callers may freely clone/edit the draft first. */
export function previewStructureDraft(raw, draft) {
  const state = sanitizeInternal(raw);
  const value = plainObject(draft) || {};
  const atoms = (Array.isArray(value.atoms) ? value.atoms : []).slice(0, 8).map(canonicalAtom);
  const bonds = (Array.isArray(value.bonds) ? value.bonds : []).slice(0, 16).map((entry) => ({
    id: cleanId(entry.id, 48), a: cleanId(entry.a, 48), b: cleanId(entry.b, 48),
    tier: MOON_SETTLEMENT_BOND_TIERS.includes(entry.tier) ? entry.tier : "stable", removed: entry.removed === true
  })).filter((entry) => entry.id && entry.a && entry.b);
  const activeBonds = bonds.filter((entry) => !entry.removed);
  const cohesionSpent = activeBonds.reduce((sum, bond) => sum + BOND_VALUE[bond.tier], 0);
  const cohesionAvailable = clampInteger(value.cohesion?.basePool, 0, 48, 0) + clampInteger(value.cohesion?.supportCapacity, 0, 24, 0);
  const components = connectedComponents(atoms, activeBonds);
  const stale = clampInteger(value.baseRevision, 0, 1_000_000, -1) !== state.revision;
  const mode = cleanId(value.mode, 32);
  let accepted = !stale && atoms.length > 0 && cohesionSpent <= cohesionAvailable;
  let reason = stale ? "stale_draft" : cohesionSpent > cohesionAvailable ? "cohesion_exceeded" : accepted ? "ready" : "empty_draft";
  let resultingWords = components.map((ids) => {
    const words = ids.map((id) => atoms.find((atom) => atom.id === id)?.component).filter(Boolean);
    return words.length === 1 ? words[0] : `Unnamed fragment (${words.join(" + ")})`;
  });
  let resourceChanges = {};
  let matterChange = 0;
  let worldChanges = [];
  if (mode === "regolith") {
    accepted = accepted && components.length === 2 && atoms.some((atom) => atom.component === "Earth") && atoms.some((atom) => atom.component === "Dust") && hasResources(state, { Regolith: 7 });
    reason = accepted ? "ready" : (stale || cohesionSpent > cohesionAvailable) ? reason : "separate_earth_and_dust";
    resultingWords = ["Earth", "Dust"];
    resourceChanges = { Regolith: -7, Soil: 6 };
    matterChange = 1;
    worldChanges = ["Usable Earth becomes available", "Recovered Dust charges one Matter"];
  } else if (mode === "bean-pod") {
    accepted = accepted && components.length === 1 && activeBonds.length >= 1 && hasResources(state, { Soil: 1, Biomass: 1 });
    reason = accepted ? "ready" : (stale || cohesionSpent > cohesionAvailable) ? reason : "connect_soil_and_seed";
    resultingWords = ["Bean Crop Pod"];
    resourceChanges = { Soil: -1, Biomass: -1 };
    worldChanges = ["One crop seat fills in the Greenhouse"];
  } else if (mode === "hazard") {
    accepted = accepted && components.length === 2;
    reason = accepted ? "ready" : (stale || cohesionSpent > cohesionAvailable) ? reason : "separate_drift_from_host";
    resultingWords = ["Recovered Dust"];
    worldChanges = ["Processor returns to a clean stable state"];
  }
  return deepFreeze({
    accepted, reason, exact: true, mode, resultingWords, fragments: resultingWords,
    quality: qualityForBonds(activeBonds), cohesion: { spent: cohesionSpent, available: cohesionAvailable },
    resourceChanges, matterChange, driftRisk: [], worldChanges,
    components: components.map((ids) => [...ids])
  });
}

/** Applies a valid ephemeral draft through the same receipt-safe operations. */
export function applyStructureDraft(raw, draft, options = {}) {
  const preview = previewStructureDraft(raw, draft);
  if (!preview.accepted) return deepFreeze({ state: sanitizeMoonSettlement(raw), applied: false, reason: preview.reason, preview });
  const operationId = cleanId(options.operationId) || cleanId(draft?.id) || `draft:${sanitizeInternal(raw).revision}`;
  const common = { operationId, at: options.at };
  if (preview.mode === "regolith") return applySettlementOperation(raw, { type: "separate-regolith", ...common }, options);
  if (preview.mode === "bean-pod") return applySettlementOperation(raw, { type: "craft-bean-pod", quality: preview.quality, ...common }, options);
  if (preview.mode === "hazard") return applySettlementOperation(raw, { type: "clear-drift", hazardId: draft.targetId, method: "separate", ...common }, options);

  const state = sanitizeInternal(raw);
  const target = state.concepts.find((entry) => entry.id === cleanId(draft?.targetId));
  if (!target) return deepFreeze({ state: deepFreeze(state), applied: false, reason: "target_missing", preview });
  const mutable = deepClone(state);
  mutable.concepts = mutable.concepts.filter((entry) => entry.id !== target.id);
  for (const [index, componentIds] of preview.components.entries()) {
    const atoms = draft.atoms.filter((atom) => componentIds.includes(cleanId(atom.id)));
    const bonds = draft.bonds.filter((bond) => bond.removed !== true && componentIds.includes(cleanId(bond.a)) && componentIds.includes(cleanId(bond.b)));
    const word = preview.resultingWords[index];
    mutable.concepts.push(concept(`${target.id}:fragment-${index + 1}`, word, word.startsWith("Unnamed") ? "unnamed-fragment" : "fragment", preview.quality, atoms, bonds, { kind: "fragment", sourceIds: [target.id], recipeId: "draft:topology", operationId }));
  }
  const at = nowIso(options.at);
  const finalState = finalizeMutation(state, mutable, operationId, "apply-draft", at);
  return deepFreeze({ state: finalState, applied: true, reason: "applied", preview, receipt: { id: operationId, type: "apply-draft", at } });
}

/** Drafts are ephemeral, so Cancel is a guaranteed state no-op. */
export function cancelStructureDraft(raw, draft = null) {
  return deepFreeze({ state: sanitizeMoonSettlement(raw), draft: null, cancelled: Boolean(draft), reason: "cancelled" });
}

/** Resolves at most the one authored visible batch; offline time never queues more. */
export function resolveProductionBatch(raw, options = {}) {
  const before = sanitizeInternal(raw);
  const at = nowIso(options.at);
  const atMs = Date.parse(at);
  const tray = before.productionTrays.find((entry) => ["running", "ready"].includes(entry.status) || (entry.status === "paused" && entry.pauseReason === "storage-full"));
  if (!tray) return deepFreeze({ state: deepFreeze(before), applied: false, resolved: false, reason: "no_active_batch" });
  if (Date.parse(tray.readyAt) > atMs) return deepFreeze({ state: deepFreeze(before), applied: false, resolved: false, reason: "batch_not_ready", readyAt: tray.readyAt });
  const operationId = cleanId(options.operationId) || (tray.status === "paused"
    ? `production:${tray.id}:retry:${before.revision}`
    : `production:${tray.id}`);
  if (before.receipts.some((entry) => entry.id === operationId)) return deepFreeze({ state: deepFreeze(before), applied: false, resolved: false, reason: "duplicate_operation" });
  const projected = projectMoonSettlement(before);
  if (before.goods.Food + 6 > projected.capacities.Food || before.goods.Biomass + 2 > projected.capacities.Biomass) {
    const paused = deepClone(before);
    const target = paused.productionTrays.find((entry) => entry.id === tray.id);
    target.status = "paused";
    target.pauseReason = "storage-full";
    const finalState = finalizeMutation(before, paused, operationId, "resolve-production", at, { rollback: false });
    return deepFreeze({ state: finalState, applied: true, resolved: false, reason: "storage_full", receipt: { id: operationId, type: "resolve-production", at } });
  }
  const state = deepClone(before);
  resourceDelta(state, { Food: 6, Biomass: 2 });
  const target = state.productionTrays.find((entry) => entry.id === tray.id);
  target.status = "complete";
  target.completedAt = at;
  target.pauseReason = "";
  const finalState = finalizeMutation(before, state, operationId, "resolve-production", at, { rollback: false });
  return deepFreeze({ state: finalState, applied: true, resolved: true, reason: "harvest_ready", outputs: { Food: 6, Biomass: 2 }, receipt: { id: operationId, type: "resolve-production", at } });
}

/** Resolves a declared hazard deterministically; severity never rolls damage. */
export function resolveHazard(raw, options = {}) {
  const before = sanitizeInternal(raw);
  const hazardId = cleanId(options.hazardId);
  const hazard = before.drift.find((entry) => entry.id === hazardId && entry.status === "active");
  if (!hazard) return deepFreeze({ state: deepFreeze(before), applied: false, resolved: false, reason: "hazard_missing" });
  if ((cleanId(options.method, 32) || "separate") !== "separate") return deepFreeze({ state: deepFreeze(before), applied: false, resolved: false, reason: "wrong_hazard_method", requiredMethod: "separate" });
  const operationId = cleanId(options.operationId) || `hazard:${hazard.id}`;
  if (before.receipts.some((entry) => entry.id === operationId)) return deepFreeze({ state: deepFreeze(before), applied: false, resolved: false, reason: "duplicate_operation" });
  const at = nowIso(options.at);
  const state = deepClone(before);
  state.drift.find((entry) => entry.id === hazard.id).status = "cleared";
  const structure = state.structures.find((entry) => entry.id === hazard.structureId);
  if (structure) structure.driftIds = structure.driftIds.filter((id) => id !== hazard.id);
  const recoveredId = `recovered-${hazard.kind.toLocaleLowerCase("en-US")}-${state.revision + 1}`;
  state.concepts.push(concept(recoveredId, `Recovered ${hazard.kind}`, "recovered-drift", "stable", [{ id: `${recoveredId}-atom`, sigil: hazard.kind.slice(0, 2), material: hazard.kind.toLocaleLowerCase("en-US"), component: hazard.kind }], [], { kind: "maintenance", sourceIds: [hazard.id], recipeId: `separate:${hazard.kind.toLocaleLowerCase("en-US")}`, operationId }, "storage"));
  const finalState = finalizeMutation(before, state, operationId, "clear-drift", at);
  return deepFreeze({ state: finalState, applied: true, resolved: true, reason: "hazard_cleared", recovered: `Recovered ${hazard.kind}`, receipt: { id: operationId, type: "clear-drift", at } });
}

/** Proof eligibility is wholly derived, deterministic, and permanent once awarded. */
export function deriveProofState(raw) {
  const state = sanitizeInternal(raw, { allowRollback: false });
  const checks = {
    founding: foundingComplete(state),
    vault: state.structures.find((entry) => entry.id === "starter-vault")?.status === "active",
    earth: Boolean(conceptByWord(state, "Earth")),
    settlement: REQUIRED_BUILDINGS.every((type) => Boolean(structureByType(state, type))),
    sixPods: state.concepts.filter((entry) => entry.kind === "bean-pod").length >= 6,
    harvest: state.productionTrays.some((tray) => tray.status === "complete") && state.goods.Food >= 6,
    maintenance: activeDrift(state, "Dust").length === 0 && state.productionTrays.length > 0
  };
  const awarded = state.proofs.some((proof) => proof.id === "living-ground");
  return deepFreeze({
    id: "living-ground", title: "Living Ground — Matter can host Life",
    awarded, eligible: awarded || Object.values(checks).every(Boolean), checks,
    completion: Object.values(checks).filter(Boolean).length / Object.keys(checks).length
  });
}

/**
 * Deterministic compatibility projection for the future Outpost-v2 migration.
 * It does not mutate production data or grant profile Stardust itself.
 */
export function migrateOutpostV2ToSettlementV3(rawOutpost, options = {}) {
  const source = plainObject(rawOutpost) || {};
  const state = deepClone(createMoonSettlement({ at: options.at }));
  const worldMoon = plainObject(options.worldweaving?.worlds?.moon) || plainObject(options.worldweaving?.moon) || {};
  const anchors = plainObject(worldMoon.anchors) || {};
  const oldStructures = plainObject(source.structures) || {};
  for (const slot of ["power", "shelter", "signal"]) {
    const choiceId = cleanId(oldStructures[slot]?.choiceId ?? anchors[slot]?.choiceId, 32);
    if (!FOUNDING_CHOICES[slot]?.[choiceId]) continue;
    state.founding[slot] = choiceId;
    const definition = FOUNDING_CHOICES[slot][choiceId];
    state.modules.push({ id: `module-${slot}`, slot, choiceId, title: definition.title, ports: [...definition.ports] });
    const oldStage = clampInteger(oldStructures[slot]?.stage, 1, 5, 1);
    const type = slot === "power" ? "power-array" : slot === "signal" ? "signal-array" : "shelter";
    const building = BUILDINGS[type];
    state.structures.push({
      id: `structure-${type}`, type, title: building.title, siteId: building.siteId, status: "active", quality: "stable",
      ports: [...building.ports], modules: [`legacy-stage-${oldStage}`], driftIds: [],
      lineage: { kind: "outpost-v2", sourceIds: [`outpost:${slot}`], recipeId: `legacy:${slot}:${choiceId}`, operationId: "migration-v3" }
    });
    state.historyMarks.push(`legacy-${slot}-stage-${oldStage}`);
  }
  const meaningCharge = Object.values(oldStructures).reduce((sum, entry) => sum + clampInteger(entry?.meaningCharge, 0, 1_000_000, 0), 0);
  const matterGrant = Math.min(6, Math.floor(meaningCharge / 100));
  state.matter = matterGrant;
  const pendingStardust = Object.values(oldStructures).reduce((sum, entry) => sum + clampInteger(entry?.pending ?? entry?.pendingStardust, 0, 1_000_000, 0), 0);
  state.legacy = { sourceVersion: clampInteger(source.version, 0, 10, 2), matterGrant, pendingStardust, verificationRequired: state.modules.length > 0 };
  const specialization = cleanId(source.projects?.meaning?.choiceId ?? source.meaningSpecialization, 32);
  if (["garden", "workshop", "commons"].includes(specialization)) state.historyMarks.push(`meaning-${specialization}`);
  state.historyMarks.push("outpost-v2-migrated");
  state.revision = 1;
  state.receipts.push({ id: "migration:outpost-v2:v3", type: "migration", revision: 1, at: cleanTimestamp(options.at) });
  return deepFreeze(sanitizeInternal(state));
}
