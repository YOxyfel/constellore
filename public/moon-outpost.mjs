import { recipeKey } from "./recipe-mastery.mjs?v=5.0.0-beta.4";
import { MOON_WORLDWEAVING, sanitizeWorldweavingState } from "./worldweaving.mjs?v=5.0.0-beta.4";
import {
  createMoonProjectsState,
  sanitizeMoonProjectsState
} from "./moon-heart-project.mjs?v=5.0.0-beta.4";

export const MOON_OUTPOST_VERSION = 2;
export const MOON_OUTPOST_MAX_STAGE = 5;
export const MOON_OUTPOST_PASSIVE_CAP_HOURS = 8;
export const MOON_OUTPOST_MEANING_BASE_CHARGE = 100;
export const MOON_OUTPOST_REPEAT_DECAY = 0.70;
export const MOON_OUTPOST_REPEAT_FLOOR = 0.10;
export const MOON_OUTPOST_ROUTE_MULTIPLIER_STEP = 0.5;
export const MOON_OUTPOST_ROUTE_MULTIPLIER_MAX = 3;

const HOUR_MS = 60 * 60 * 1_000;
const PASSIVE_CAP_MS = MOON_OUTPOST_PASSIVE_CAP_HOURS * HOUR_MS;
const MAX_MEANING_CHARGE = 1_000_000;
const MAX_TOTAL_COLLECTED = 1_000_000_000;
const MAX_RECIPE_REPEATS = 512;
const MAX_REPEAT_USES = 10_000;
const MAX_ROUTE_STEPS = 64;
const MAX_TIMESTAMP_LENGTH = 40;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const UPGRADE_COSTS = [600, 1_000, 1_600, 2_400, 0];
const CALIBRATION_COSTS = [40, 55, 75, 100, 130];

function stages(labels, rates) {
  return labels.map((label, index) => ({
    stage: index + 1,
    label,
    stardustPerHour: rates[index],
    calibrationCost: CALIBRATION_COSTS[index],
    upgradeMeaningCost: UPGRADE_COSTS[index]
  }));
}

const STRUCTURES = deepFreeze([
  {
    id: "power",
    title: "Lunar Dynamo",
    description: "Turns the Moon's chosen source of power into a patient Stardust current.",
    meaningWords: ["power", "energy", "electricity", "solar power", "lunar energy", "sun", "battery", "lightning"],
    stages: stages(
      ["Starter Cells", "Linked Array", "Crater Grid", "Helios Ring", "Fusion Crown"],
      [3, 5, 8, 12, 18]
    )
  },
  {
    id: "shelter",
    title: "Moonhaven",
    description: "Grows one remembered shelter into a living settlement beneath the stars.",
    meaningWords: ["shelter", "house", "home", "room", "wall", "adobe", "construction", "brick", "building", "city", "village"],
    stages: stages(
      ["Landing Pod", "Sealed Habitat", "Growing Quarter", "Crater Haven", "Living Citadel"],
      [2, 4, 7, 11, 16]
    )
  },
  {
    id: "signal",
    title: "Farstar Relay",
    description: "Carries the outpost's chosen signal from the crater rim into deep space.",
    meaningWords: ["signal", "beacon", "laser", "constellation", "star", "sky", "radio", "satellite", "telescope", "map"],
    stages: stages(
      ["Whisper Mast", "Relay Dish", "Deep-Sky Array", "Beacon Ring", "Horizon Choir"],
      [2, 4, 6, 10, 15]
    )
  }
]);

export const MOON_OUTPOST_STRUCTURE_IDS = Object.freeze(STRUCTURES.map((structure) => structure.id));

const STRUCTURE_BY_ID = new Map(STRUCTURES.map((structure) => [structure.id, structure]));
const WORLD_SLOT_BY_ID = new Map(MOON_WORLDWEAVING.slots.map((slot) => [slot.id, slot]));

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, Math.floor(number)))
    : fallback;
}

function cleanText(value, maximum = 80) {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function normalizedWord(value) {
  return cleanText(value).toLocaleLowerCase("en-US");
}

function cleanId(value) {
  return normalizedWord(value).replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

function timestampMs(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "number") return Number.isFinite(value) && Number.isFinite(new Date(value).getTime()) ? value : null;
  if (typeof value !== "string" || value.length > MAX_TIMESTAMP_LENGTH) return null;
  const parsed = Date.parse(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanTimestamp(value) {
  const parsed = timestampMs(value);
  return parsed == null ? "" : new Date(parsed).toISOString();
}

function choiceFor(slotId, choiceId) {
  const slot = WORLD_SLOT_BY_ID.get(cleanId(slotId));
  const id = cleanId(choiceId);
  return slot?.choices.find((choice) => choice.id === id) || null;
}

function stageFor(structureId, stage) {
  const structure = STRUCTURE_BY_ID.get(structureId);
  return structure?.stages[clampInteger(stage, 1, MOON_OUTPOST_MAX_STAGE, 1) - 1] || null;
}

function emptyState() {
  return {
    version: MOON_OUTPOST_VERSION,
    worldId: "moon",
    structures: { power: null, shelter: null, signal: null },
    recipeRepeats: [],
    projects: createMoonProjectsState({ shelterStage: 0, shelterChoiceId: "" })
  };
}

function canonicalRecipeKey(value) {
  if (typeof value !== "string" || value.length > 260) return "";
  try {
    const parts = JSON.parse(value);
    if (!Array.isArray(parts) || parts.length !== 3 || parts.some((part) => typeof part !== "string")) return "";
    const canonical = recipeKey(parts[0], parts[1], parts[2]);
    return canonical === value ? canonical : "";
  } catch {
    return "";
  }
}

function canonicalStructure(source, structureId) {
  const raw = plainObject(source);
  if (!raw) return null;
  const choice = choiceFor(structureId, raw.choiceId);
  const suppliedAnchorKey = String(raw.anchorKey ?? raw.recipeKey ?? raw.memory?.key ?? "").trim();
  if (!choice || suppliedAnchorKey !== choice.recipe.key) return null;
  return {
    choiceId: choice.id,
    anchorKey: choice.recipe.key,
    stage: clampInteger(raw.stage, 1, MOON_OUTPOST_MAX_STAGE, 1),
    meaningCharge: clampInteger(raw.meaningCharge ?? raw.charge, 0, MAX_MEANING_CHARGE, 0),
    calibratedAt: cleanTimestamp(raw.calibratedAt ?? raw.calibration?.startedAt),
    totalCollected: clampInteger(raw.totalCollected, 0, MAX_TOTAL_COLLECTED, 0)
  };
}

function sanitizeRepeats(raw) {
  const entries = Array.isArray(raw?.recipeRepeats)
    ? raw.recipeRepeats
    : Array.isArray(raw?.repeats) ? raw.repeats : [];
  const merged = new Map();
  for (const source of entries.slice(0, MAX_RECIPE_REPEATS * 2)) {
    const entry = plainObject(source);
    const key = canonicalRecipeKey(entry?.key);
    if (!key) continue;
    const uses = clampInteger(entry.uses ?? entry.count, 0, MAX_REPEAT_USES, 0);
    if (!uses) continue;
    merged.set(key, Math.max(merged.get(key) || 0, uses));
  }
  return [...merged.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .slice(0, MAX_RECIPE_REPEATS)
    .map(([key, uses]) => ({ key, uses }));
}

/** Returns a bounded, JSON-safe Outpost value. Unknown fields never survive. */
export function sanitizeMoonOutpostState(raw) {
  const source = plainObject(raw) || {};
  const structures = plainObject(source.structures) || {};
  const state = emptyState();
  let gapFound = false;
  for (const structureId of MOON_OUTPOST_STRUCTURE_IDS) {
    const structure = gapFound ? null : canonicalStructure(structures[structureId], structureId);
    if (!structure) gapFound = true;
    state.structures[structureId] = structure;
  }
  state.recipeRepeats = sanitizeRepeats(source);
  const shelter = state.structures.shelter;
  state.projects = sanitizeMoonProjectsState(source.projects, {
    shelterStage: shelter?.stage || 0,
    shelterChoiceId: shelter?.choiceId || ""
  });
  return state;
}

function initialStructure(choice) {
  return {
    choiceId: choice.id,
    anchorKey: choice.recipe.key,
    stage: 1,
    meaningCharge: 0,
    calibratedAt: "",
    totalCollected: 0
  };
}

/**
 * Reconciles stored buildings against canonical Worldweaving anchors. A newly
 * anchored slot appears at stage one; a mismatched or missing anchor cannot
 * retain charge, calibration, or upgrades.
 */
export function synchronizeMoonOutpostState(raw, rawWorldweaving) {
  const state = sanitizeMoonOutpostState(raw);
  const moon = sanitizeWorldweavingState(rawWorldweaving).worlds.moon;
  for (const structureId of MOON_OUTPOST_STRUCTURE_IDS) {
    const anchor = moon.anchors[structureId];
    const choice = choiceFor(structureId, anchor?.choiceId);
    const exact = Boolean(choice && anchor?.memory?.key === choice.recipe.key);
    if (!exact) {
      state.structures[structureId] = null;
      continue;
    }
    const stored = state.structures[structureId];
    state.structures[structureId] = stored?.anchorKey === choice.recipe.key
      ? stored
      : initialStructure(choice);
  }
  return sanitizeMoonOutpostState(state);
}

export function createMoonOutpostState(rawWorldweaving) {
  return rawWorldweaving === undefined
    ? emptyState()
    : synchronizeMoonOutpostState(emptyState(), rawWorldweaving);
}

export function moonOutpostCatalog() {
  return STRUCTURES.map((structure) => ({
    id: structure.id,
    title: structure.title,
    description: structure.description,
    stages: structure.stages.map((stage) => ({ ...stage }))
  }));
}

export function moonOutpostRepeatFactor(rawUses) {
  const uses = clampInteger(rawUses, 0, MAX_REPEAT_USES, 0);
  return Math.max(MOON_OUTPOST_REPEAT_FLOOR, MOON_OUTPOST_REPEAT_DECAY ** uses);
}

export function moonOutpostRouteMultiplier(rawDistinctRecipes) {
  const distinctRecipes = clampInteger(rawDistinctRecipes, 0, MAX_ROUTE_STEPS, 0);
  const additionalRecipes = Math.max(0, distinctRecipes - 1);
  return Math.min(
    MOON_OUTPOST_ROUTE_MULTIPLIER_MAX,
    1 + (additionalRecipes * MOON_OUTPOST_ROUTE_MULTIPLIER_STEP)
  );
}

function outputForRecipeKey(key) {
  try {
    const parts = JSON.parse(key);
    return Array.isArray(parts) && parts.length === 3 ? normalizedWord(parts[2]) : "";
  } catch {
    return "";
  }
}

function routeReceipt(source) {
  const step = plainObject(source);
  if (!step) return null;
  const nestedRecipe = plainObject(step.recipe);
  const ingredients = step.ingredients ?? step.inputs ?? nestedRecipe?.ingredients;
  const result = plainObject(step.result);
  const a = cleanText(step.a ?? step.left ?? nestedRecipe?.a ?? ingredients?.[0]);
  const b = cleanText(step.b ?? step.right ?? nestedRecipe?.b ?? ingredients?.[1]);
  const word = cleanText(step.word ?? step.output ?? (typeof step.result === "string" ? step.result : result?.word) ?? nestedRecipe?.word);
  const key = recipeKey(a, b, word);
  if (!key) return null;
  const suppliedKey = String(step.key ?? nestedRecipe?.key ?? "").trim();
  if (suppliedKey && suppliedKey !== key) return null;
  const sourceId = cleanId(step.source);
  const division = cleanId(step.division);
  if (
    step.revealed === true
    || sourceId === "reveal"
    || division === "study"
    || step.scoringDisabled === true
    || step.scoreEligible === false
    || step.worldweavingEligible === false
  ) return null;
  return { key, a, b, word, output: normalizedWord(word) };
}

function routeHistory(rawRoute) {
  const source = Array.isArray(rawRoute) ? rawRoute : rawRoute?.history;
  return (Array.isArray(source) ? source : [])
    .slice(0, MAX_ROUTE_STEPS)
    .map(routeReceipt)
    .filter(Boolean);
}

function relevantStructureIds(state, word) {
  const normalized = normalizedWord(word);
  if (!normalized) return [];
  return MOON_OUTPOST_STRUCTURE_IDS.filter((structureId) => {
    const stored = state.structures[structureId];
    if (!stored) return false;
    const choice = choiceFor(structureId, stored.choiceId);
    const authoredWords = choice ? [choice.recipe.a, choice.recipe.b, choice.recipe.word] : [];
    const vocabulary = [...STRUCTURE_BY_ID.get(structureId).meaningWords, ...authoredWords];
    return vocabulary.some((candidate) => normalizedWord(candidate) === normalized);
  });
}

/**
 * Converts one completed route's meaningful outputs into building charge.
 * Each exact recipe has an independent lifetime repeat count. Diversity is
 * earned only by finding alternate exact recipes for the same relevant output:
 * the first route is x1, each additional route adds x0.5, and the cap is x3.
 */
export function recordMoonOutpostRoute(raw, rawRoute) {
  const state = sanitizeMoonOutpostState(raw);
  const receipts = routeHistory(rawRoute);
  if (!receipts.length) {
    return {
      state,
      charged: false,
      reason: "no_eligible_recipes",
      multiplier: 1,
      distinctRecipes: 0,
      routeDiversity: [],
      totalMeaning: 0,
      structures: [],
      receipts: []
    };
  }

  const repeatCounts = new Map(state.recipeRepeats.map((entry) => [entry.key, entry.uses]));
  const outputRecipes = new Map();
  for (const key of repeatCounts.keys()) {
    const output = outputForRecipeKey(key);
    if (!output) continue;
    if (!outputRecipes.has(output)) outputRecipes.set(output, new Set());
    outputRecipes.get(output).add(key);
  }

  const eligibleReceipts = receipts
    .map((receipt) => ({ ...receipt, structureIds: relevantStructureIds(state, receipt.word) }))
    .filter((receipt) => receipt.structureIds.length > 0);
  for (const receipt of eligibleReceipts) {
    if (!outputRecipes.has(receipt.output)) outputRecipes.set(receipt.output, new Set());
    outputRecipes.get(receipt.output).add(receipt.key);
  }

  const routeDiversity = [...new Set(eligibleReceipts.map((receipt) => receipt.output))]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((output) => {
      const distinctRecipes = outputRecipes.get(output)?.size || 0;
      return {
        output,
        distinctRecipes,
        multiplier: moonOutpostRouteMultiplier(distinctRecipes)
      };
    });
  const diversityByOutput = new Map(routeDiversity.map((entry) => [entry.output, entry]));
  const structureDeltas = new Map();
  const chargedReceipts = [];

  for (const receipt of eligibleReceipts) {
    const { structureIds } = receipt;
    const diversity = diversityByOutput.get(receipt.output);
    const multiplier = diversity?.multiplier || 1;
    const repeatsBefore = repeatCounts.get(receipt.key) || 0;
    const repeatFactor = moonOutpostRepeatFactor(repeatsBefore);
    const decayedBase = Math.max(
      MOON_OUTPOST_MEANING_BASE_CHARGE * MOON_OUTPOST_REPEAT_FLOOR,
      Math.round(MOON_OUTPOST_MEANING_BASE_CHARGE * repeatFactor)
    );
    const meaningEach = Math.round(decayedBase * multiplier);
    for (const structureId of structureIds) {
      structureDeltas.set(structureId, (structureDeltas.get(structureId) || 0) + meaningEach);
    }
    repeatCounts.set(receipt.key, Math.min(MAX_REPEAT_USES, repeatsBefore + 1));
    chargedReceipts.push({
      key: receipt.key,
      word: receipt.word,
      output: receipt.output,
      repeatsBefore,
      repeatFactor,
      decayedBase,
      distinctRecipes: diversity?.distinctRecipes || 1,
      multiplier,
      meaningEach,
      structureIds
    });
  }

  const structures = [];
  for (const [structureId, delta] of structureDeltas) {
    const stored = state.structures[structureId];
    const before = stored.meaningCharge;
    stored.meaningCharge = clampInteger(before + delta, 0, MAX_MEANING_CHARGE, before);
    structures.push({ structureId, before, delta: stored.meaningCharge - before, after: stored.meaningCharge });
  }
  structures.sort((left, right) => MOON_OUTPOST_STRUCTURE_IDS.indexOf(left.structureId) - MOON_OUTPOST_STRUCTURE_IDS.indexOf(right.structureId));
  state.recipeRepeats = [...repeatCounts.entries()]
    .filter(([, uses]) => uses > 0)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .slice(0, MAX_RECIPE_REPEATS)
    .map(([key, uses]) => ({ key, uses }));

  const totalMeaning = structures.reduce((sum, structure) => sum + structure.delta, 0);
  const multiplier = routeDiversity.reduce((maximum, entry) => Math.max(maximum, entry.multiplier), 1);
  const distinctRecipes = routeDiversity.reduce((maximum, entry) => Math.max(maximum, entry.distinctRecipes), 0);
  return {
    state,
    charged: totalMeaning > 0,
    reason: totalMeaning > 0 ? "charged" : "no_relevant_words",
    multiplier,
    distinctRecipes,
    routeDiversity,
    totalMeaning,
    structures,
    receipts: chargedReceipts
  };
}

function structureActionState(raw, rawStructureId) {
  const state = sanitizeMoonOutpostState(raw);
  const structureId = cleanId(rawStructureId);
  return { state, structureId, structure: state.structures[structureId] || null };
}

export function upgradeMoonOutpostStructure(raw, rawStructureId) {
  const { state, structureId, structure } = structureActionState(raw, rawStructureId);
  if (!STRUCTURE_BY_ID.has(structureId)) return { state, upgraded: false, reason: "unknown_structure", structureId: "" };
  if (!structure) return { state, upgraded: false, reason: "structure_locked", structureId };
  if (structureId === "shelter") return { state, upgraded: false, reason: "project_required", structureId };
  if (structure.calibratedAt) return { state, upgraded: false, reason: "collect_before_upgrade", structureId };
  if (structure.stage >= MOON_OUTPOST_MAX_STAGE) return { state, upgraded: false, reason: "maximum_stage", structureId };
  const current = stageFor(structureId, structure.stage);
  const cost = current.upgradeMeaningCost;
  if (structure.meaningCharge < cost) {
    return { state, upgraded: false, reason: "insufficient_meaning", structureId, cost, available: structure.meaningCharge };
  }
  const before = structure.stage;
  structure.meaningCharge -= cost;
  structure.stage += 1;
  return {
    state,
    upgraded: true,
    reason: "upgraded",
    structureId,
    cost,
    before,
    after: structure.stage,
    stage: { ...stageFor(structureId, structure.stage) }
  };
}

export function calibrateMoonOutpostStructure(raw, rawStructureId, { at = new Date() } = {}) {
  const { state, structureId, structure } = structureActionState(raw, rawStructureId);
  if (!STRUCTURE_BY_ID.has(structureId)) return { state, calibrated: false, reason: "unknown_structure", structureId: "" };
  if (!structure) return { state, calibrated: false, reason: "structure_locked", structureId };
  if (structure.calibratedAt) return { state, calibrated: false, reason: "already_calibrated", structureId };
  const atMs = timestampMs(at);
  if (atMs == null) return { state, calibrated: false, reason: "invalid_timestamp", structureId };
  const stage = stageFor(structureId, structure.stage);
  if (structure.meaningCharge < stage.calibrationCost) {
    return {
      state,
      calibrated: false,
      reason: "insufficient_meaning",
      structureId,
      cost: stage.calibrationCost,
      available: structure.meaningCharge
    };
  }
  structure.meaningCharge -= stage.calibrationCost;
  structure.calibratedAt = new Date(atMs).toISOString();
  return {
    state,
    calibrated: true,
    reason: "calibrated",
    structureId,
    cost: stage.calibrationCost,
    calibratedAt: structure.calibratedAt,
    stardustPerHour: stage.stardustPerHour,
    capHours: MOON_OUTPOST_PASSIVE_CAP_HOURS
  };
}

function collectionQuote(structureId, structure, atMs) {
  const stage = stageFor(structureId, structure?.stage);
  if (!structure || !stage) return { structureId, amount: 0, reason: "structure_locked" };
  const startedAtMs = timestampMs(structure.calibratedAt);
  if (startedAtMs == null) return { structureId, amount: 0, reason: "not_calibrated" };
  const collectionId = JSON.stringify(["moon", structureId, structure.anchorKey, structure.calibratedAt]);
  if (atMs < startedAtMs) {
    return {
      structureId,
      amount: 0,
      reason: "clock_before_calibration",
      calibratedAt: structure.calibratedAt,
      collectionId
    };
  }
  const rawElapsedMs = atMs - startedAtMs;
  const elapsedMs = Math.min(PASSIVE_CAP_MS, rawElapsedMs);
  const amount = Math.floor((stage.stardustPerHour * elapsedMs) / HOUR_MS);
  return {
    structureId,
    amount,
    reason: amount > 0 ? "ready" : "not_ready",
    calibratedAt: structure.calibratedAt,
    collectionId,
    elapsedMs,
    elapsedHours: elapsedMs / HOUR_MS,
    capped: rawElapsedMs >= PASSIVE_CAP_MS,
    capHours: MOON_OUTPOST_PASSIVE_CAP_HOURS,
    stardustPerHour: stage.stardustPerHour
  };
}

export function previewMoonOutpostCollection(raw, { at = new Date(), structureId: rawStructureId = "" } = {}) {
  const state = sanitizeMoonOutpostState(raw);
  const atMs = timestampMs(at);
  if (atMs == null) return { state, collectable: false, reason: "invalid_timestamp", total: 0, entries: [] };
  const structureId = cleanId(rawStructureId);
  if (structureId && !STRUCTURE_BY_ID.has(structureId)) {
    return { state, collectable: false, reason: "unknown_structure", total: 0, entries: [] };
  }
  const ids = structureId ? [structureId] : MOON_OUTPOST_STRUCTURE_IDS;
  const entries = ids.map((id) => collectionQuote(id, state.structures[id], atMs));
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  return {
    state,
    collectable: total > 0,
    reason: total > 0 ? "ready" : entries.find((entry) => entry.reason === "clock_before_calibration")?.reason || "not_ready",
    at: new Date(atMs).toISOString(),
    total,
    entries
  };
}

/** Returns a Stardust delta; the profile adapter owns applying it to the wallet. */
export function collectMoonOutpostStardust(raw, options = {}) {
  const preview = previewMoonOutpostCollection(raw, options);
  const state = preview.state;
  if (!preview.collectable) {
    return { ...preview, state, collected: false, stardustGranted: 0 };
  }
  const collected = [];
  for (const entry of preview.entries) {
    if (entry.amount <= 0) continue;
    const structure = state.structures[entry.structureId];
    structure.calibratedAt = "";
    structure.totalCollected = clampInteger(
      structure.totalCollected + entry.amount,
      0,
      MAX_TOTAL_COLLECTED,
      structure.totalCollected
    );
    collected.push({ ...entry });
  }
  return {
    state,
    collected: collected.length > 0,
    reason: collected.length ? "collected" : "not_ready",
    at: preview.at,
    stardustGranted: collected.reduce((sum, entry) => sum + entry.amount, 0),
    entries: collected
  };
}

export function moonOutpostView(raw, { at = new Date() } = {}) {
  const state = sanitizeMoonOutpostState(raw);
  const preview = previewMoonOutpostCollection(state, { at });
  const pendingById = new Map(preview.entries.map((entry) => [entry.structureId, entry]));
  return {
    version: MOON_OUTPOST_VERSION,
    worldId: "moon",
    activeStructures: MOON_OUTPOST_STRUCTURE_IDS.filter((id) => state.structures[id]).length,
    totalPendingStardust: preview.total,
    structures: STRUCTURES.map((definition) => {
      const stored = state.structures[definition.id];
      const choice = stored ? choiceFor(definition.id, stored.choiceId) : null;
      const stage = stored ? stageFor(definition.id, stored.stage) : null;
      return {
        id: definition.id,
        title: definition.title,
        description: definition.description,
        locked: !stored,
        choiceId: stored?.choiceId || "",
        anchorKey: stored?.anchorKey || "",
        anchorTitle: choice?.title || "",
        stage: stored?.stage || 0,
        stageCount: MOON_OUTPOST_MAX_STAGE,
        stagePresentation: stage ? { ...stage } : null,
        meaningCharge: stored?.meaningCharge || 0,
        calibratedAt: stored?.calibratedAt || "",
        pending: pendingById.get(definition.id) || { structureId: definition.id, amount: 0, reason: "structure_locked" },
        totalCollected: stored?.totalCollected || 0,
        stages: definition.stages.map((entry) => ({ ...entry }))
      };
    })
  };
}
