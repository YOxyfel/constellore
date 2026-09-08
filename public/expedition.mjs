import {
  createMoonOutpostState,
  sanitizeMoonOutpostState,
  synchronizeMoonOutpostState
} from "./moon-outpost.mjs?v=5.0.0-beta.4";
import { mergeMoonProjectsState } from "./moon-heart-project.mjs?v=5.0.0-beta.4";
import { moonHomeWorldAccess } from "./worldweaving.mjs?v=5.0.0-beta.4";
import {
  createSalvageCacheState,
  sanitizeSalvageCacheState
} from "./salvage-cache.mjs?v=5.0.0-beta.4";
import { sanitizeSalvageOwnedCosmeticIds } from "./salvage-cosmetics.mjs?v=5.0.0-beta.4";

export const EXPEDITION_VERSION = 1;
export const EXPEDITION_LEDGER_LIMIT = 128;

const MAX_REVISION = 1_000_000_000;
const MAX_LAUNCHES = 1_000_000;
const STRUCTURE_IDS = new Set(["power", "shelter", "signal"]);
const WORLD_SEQUENCE = Object.freeze(["earth", "moon"]);
const WORLD_INDEX = new Map(WORLD_SEQUENCE.map((worldId, index) => [worldId, index]));

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function integer(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, Math.floor(number)))
    : fallback;
}

function timestamp(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== "string" || value.length > 40 || !Number.isFinite(Date.parse(value))) return "";
  return new Date(value).toISOString();
}

function moonEnvelope(outpost, raw = {}) {
  const source = record(raw);
  return {
    outpost,
    launches: integer(source.launches, 0, MAX_LAUNCHES, 0),
    lastLaunchAt: timestamp(source.lastLaunchAt)
  };
}

function moonOutpostHasProgress(raw) {
  const outpost = record(raw);
  const structures = record(outpost.structures);
  if ([...STRUCTURE_IDS].some((structureId) => structures[structureId] != null)) return true;
  if (Array.isArray(outpost.recipeRepeats) && outpost.recipeRepeats.length) return true;
  const projects = record(outpost.projects);
  return Array.isArray(projects.entries) && projects.entries.some((entry) => {
    const project = record(entry);
    return Boolean(
      project.completedAt
      || (Array.isArray(project.evidence) && project.evidence.length)
      || (Array.isArray(project.decisions) && project.decisions.length)
      || (Array.isArray(project.rewards) && project.rewards.length)
    );
  });
}

function salvageHasProgress(raw) {
  const salvage = record(raw);
  const opensByTier = record(salvage.opensByTier);
  const pityMissesByTier = record(salvage.pityMissesByTier);
  return Boolean(
    Object.values(opensByTier).some((value) => integer(value, 0, MAX_REVISION, 0) > 0)
    || Object.values(pityMissesByTier).some((value) => integer(value, 0, MAX_REVISION, 0) > 0)
    || integer(salvage.selectionShards, 0, MAX_REVISION, 0) > 0
    || (Array.isArray(salvage.receiptFingerprints) && salvage.receiptFingerprints.length)
  );
}

function moonArrivalProven({ moon, salvage, salvageCosmeticIds, creditedCollectionIds } = {}) {
  const envelope = record(moon);
  return Boolean(
    integer(envelope.launches, 0, MAX_LAUNCHES, 0) > 0
    || timestamp(envelope.lastLaunchAt)
    || moonOutpostHasProgress(envelope.outpost)
    || salvageHasProgress(salvage)
    || (Array.isArray(salvageCosmeticIds) && salvageCosmeticIds.length)
    || (Array.isArray(creditedCollectionIds) && creditedCollectionIds.length)
  );
}

function activeWorldId(value, progress = {}) {
  const candidate = String(value || "").trim().toLowerCase();
  // A canonical saved location is explicit arrival state and must win over
  // project/economy progress. Progress is only a migration hint for legacy
  // profiles that predate `activeWorldId`; otherwise an Earth save could be
  // silently promoted to the Moon before its departure cinematic completes.
  if (WORLD_INDEX.has(candidate)) return candidate;
  return moonArrivalProven(progress) ? "moon" : "earth";
}

function homeWorldId(value, arrivedWorldId = "earth") {
  const arrived = WORLD_INDEX.has(arrivedWorldId) ? arrivedWorldId : "earth";
  const candidate = String(value || "").trim().toLowerCase();
  if (!WORLD_INDEX.has(candidate)) return "earth";
  return WORLD_INDEX.get(candidate) <= WORLD_INDEX.get(arrived) ? candidate : arrived;
}

function furthestWorldId(...values) {
  return values.reduce((furthest, value) => {
    const candidate = WORLD_INDEX.has(value) ? value : "earth";
    return WORLD_INDEX.get(candidate) > WORLD_INDEX.get(furthest) ? candidate : furthest;
  }, "earth");
}

function collectionId(value, outpost) {
  if (typeof value !== "string" || value.length > 360) return "";
  try {
    const parts = JSON.parse(value);
    if (!Array.isArray(parts) || parts.length !== 4 || parts[0] !== "moon") return "";
    const structureId = String(parts[1] || "");
    const anchorKey = String(parts[2] || "");
    const collectedAt = timestamp(parts[3]);
    if (!STRUCTURE_IDS.has(structureId) || !collectedAt) return "";
    if (outpost.structures[structureId]?.anchorKey !== anchorKey) return "";
    return JSON.stringify(["moon", structureId, anchorKey, collectedAt]);
  } catch {
    return "";
  }
}

function ledger(raw, outpost) {
  const values = Array.isArray(raw) ? raw : [];
  return [...new Set(values
    .map((value) => collectionId(value, outpost))
    .filter(Boolean))]
    .slice(-EXPEDITION_LEDGER_LIMIT);
}

export function createExpeditionState(worldweaving) {
  const outpost = createMoonOutpostState(worldweaving);
  const moon = moonEnvelope(outpost);
  const salvage = createSalvageCacheState();
  return {
    version: EXPEDITION_VERSION,
    revision: 0,
    updatedAt: "",
    activeWorldId: activeWorldId("earth", { moon, salvage }),
    homeWorldId: "earth",
    worlds: { moon },
    salvage,
    salvageCosmeticIds: [],
    creditedCollectionIds: []
  };
}

/**
 * One revision envelopes every consumptive Outpost and Salvage value. Cloud
 * merges choose a complete economic snapshot instead of fieldwise maxima,
 * which could otherwise resurrect spent Meaning or mint a cache twice.
 */
export function sanitizeExpeditionState(raw, { worldweaving } = {}) {
  const source = record(raw);
  const worlds = record(source.worlds);
  const moon = record(worlds.moon ?? source.moon);
  const rawOutpost = moon.outpost ?? source.moonOutpost;
  const outpost = worldweaving === undefined
    ? sanitizeMoonOutpostState(rawOutpost)
    : synchronizeMoonOutpostState(rawOutpost, worldweaving);
  const moonEnvelopeState = moonEnvelope(outpost, moon);
  const salvage = sanitizeSalvageCacheState(source.salvage ?? source.salvageCache);
  const salvageCosmeticIds = sanitizeSalvageOwnedCosmeticIds(source.salvageCosmeticIds ?? source.cosmeticIds);
  const creditedCollectionIds = ledger(source.creditedCollectionIds, outpost);
  const arrivedWorldId = activeWorldId(source.activeWorldId, {
    moon: moonEnvelopeState,
    salvage,
    salvageCosmeticIds,
    creditedCollectionIds
  });
  return {
    version: EXPEDITION_VERSION,
    revision: integer(source.revision, 0, MAX_REVISION, 0),
    updatedAt: timestamp(source.updatedAt),
    activeWorldId: arrivedWorldId,
    // The planet shown at Home is presentation state, not arrival proof.
    // Legacy saves intentionally return to Earth while retaining every Moon
    // project, reward, and arrival marker.
    homeWorldId: homeWorldId(source.homeWorldId, arrivedWorldId),
    worlds: { moon: moonEnvelopeState },
    salvage,
    salvageCosmeticIds,
    creditedCollectionIds
  };
}

function canonicalEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mutate(raw, callback, { worldweaving, at = new Date() } = {}) {
  const before = sanitizeExpeditionState(raw, { worldweaving });
  const next = structuredClone(before);
  callback(next);
  const canonical = sanitizeExpeditionState(next, { worldweaving });
  if (canonicalEqual(before, canonical)) return before;
  canonical.revision = Math.min(MAX_REVISION, before.revision + 1);
  canonical.updatedAt = timestamp(at) || before.updatedAt;
  return canonical;
}

export function replaceMoonOutpostState(raw, rawOutpost, options = {}) {
  return mutate(raw, (next) => {
    next.worlds.moon.outpost = options.worldweaving === undefined
      ? sanitizeMoonOutpostState(rawOutpost)
      : synchronizeMoonOutpostState(rawOutpost, options.worldweaving);
  }, options);
}

export function replaceSalvageState(raw, rawSalvage, { cosmeticIds, ...options } = {}) {
  return mutate(raw, (next) => {
    next.salvage = sanitizeSalvageCacheState(rawSalvage);
    if (cosmeticIds !== undefined) {
      next.salvageCosmeticIds = sanitizeSalvageOwnedCosmeticIds(cosmeticIds);
    }
  }, options);
}

export function creditMoonCollections(raw, rawCollectionIds, options = {}) {
  const before = sanitizeExpeditionState(raw, options);
  const existing = new Set(before.creditedCollectionIds);
  const accepted = ledger(rawCollectionIds, before.worlds.moon.outpost);
  const credited = accepted.filter((id) => !existing.has(id));
  if (!credited.length) return { state: before, credited: [] };
  const state = mutate(before, (next) => {
    next.creditedCollectionIds = [...next.creditedCollectionIds, ...credited]
      .slice(-EXPEDITION_LEDGER_LIMIT);
  }, options);
  return { state, credited };
}

export function settleMoonCollection(raw, {
  outpost: rawOutpost,
  collectionIds: rawCollectionIds
} = {}, options = {}) {
  const before = sanitizeExpeditionState(raw, options);
  const outpost = options.worldweaving === undefined
    ? sanitizeMoonOutpostState(rawOutpost)
    : synchronizeMoonOutpostState(rawOutpost, options.worldweaving);
  const existing = new Set(before.creditedCollectionIds);
  const accepted = ledger(rawCollectionIds, outpost);
  const credited = accepted.filter((id) => !existing.has(id));
  const state = mutate(before, (next) => {
    next.worlds.moon.outpost = outpost;
    next.creditedCollectionIds = [...next.creditedCollectionIds, ...credited]
      .slice(-EXPEDITION_LEDGER_LIMIT);
  }, options);
  return { state, credited };
}

export function recordMoonExpeditionLaunch(raw, options = {}) {
  return mutate(raw, (next) => {
    next.worlds.moon.launches = Math.min(MAX_LAUNCHES, next.worlds.moon.launches + 1);
    next.worlds.moon.lastLaunchAt = timestamp(options.at) || new Date().toISOString();
  }, options);
}

export function recordExpeditionArrival(raw, worldId, options = {}) {
  const destination = String(worldId || "").trim().toLowerCase();
  if (!WORLD_INDEX.has(destination)) return sanitizeExpeditionState(raw, options);
  return mutate(raw, (next) => {
    next.activeWorldId = furthestWorldId(next.activeWorldId, destination);
    next.homeWorldId = destination;
  }, options);
}

export function selectableExpeditionHomeWorldIds(raw, { worldweaving } = {}) {
  const state = sanitizeExpeditionState(raw, { worldweaving });
  const moonAccess = moonHomeWorldAccess(worldweaving);
  return [
    "earth",
    ...(state.activeWorldId === "moon" && moonAccess.unlocked ? ["moon"] : [])
  ];
}

/**
 * Translate confirmed expedition arrival into presentation-only facts for a
 * Settings replay of the Voyage Projection. The supported release route ends
 * at the Moon, so Mars and every later world remain visible but locked.
 *
 * This helper never infers progress from Home presentation state and never
 * writes expedition data. `activeWorldId` remains the sole arrival fact.
 */
export function expeditionVoyageProjectionFacts(raw, { worldweaving } = {}) {
  const state = sanitizeExpeditionState(raw, { worldweaving });
  const atMoon = state.activeWorldId === "moon";
  return Object.freeze({
    variant: "progress",
    currentWorldId: atMoon ? "moon" : "earth",
    completedWorldIds: Object.freeze(atMoon ? ["earth"] : []),
    actionableWorldIds: Object.freeze(atMoon ? ["moon"] : ["earth", "moon"])
  });
}

export function selectExpeditionHomeWorld(raw, worldId, options = {}) {
  const destination = String(worldId || "").trim().toLowerCase();
  const before = sanitizeExpeditionState(raw, options);
  if (!WORLD_INDEX.has(destination)
    || !selectableExpeditionHomeWorldIds(before, options).includes(destination)) return before;
  return mutate(before, (next) => {
    next.homeWorldId = destination;
  }, options);
}

export function mergeExpeditionStates(localRaw, remoteRaw, {
  worldweaving,
  preferLocal = false
} = {}) {
  const local = sanitizeExpeditionState(localRaw, { worldweaving });
  const remote = sanitizeExpeditionState(remoteRaw, { worldweaving });
  let winner;
  if (local.revision !== remote.revision) winner = local.revision > remote.revision ? local : remote;
  else if (local.updatedAt !== remote.updatedAt) winner = local.updatedAt > remote.updatedAt ? local : remote;
  else winner = preferLocal ? local : remote;
  const merged = structuredClone(winner);
  const loser = winner === local ? remote : local;
  merged.activeWorldId = furthestWorldId(local.activeWorldId, remote.activeWorldId);
  const shelter = merged.worlds.moon.outpost.structures.shelter;
  merged.worlds.moon.outpost.projects = mergeMoonProjectsState(
    winner.worlds.moon.outpost.projects,
    loser.worlds.moon.outpost.projects,
    {
      preferLocal: true,
      includeRewards: false,
      shelterStage: shelter?.stage || 0,
      shelterChoiceId: shelter?.choiceId || ""
    }
  );
  merged.salvage.receiptFingerprints = [...new Set([
    ...local.salvage.receiptFingerprints,
    ...remote.salvage.receiptFingerprints
  ])].slice(-96);
  merged.salvageCosmeticIds = sanitizeSalvageOwnedCosmeticIds([
    ...local.salvageCosmeticIds,
    ...remote.salvageCosmeticIds
  ]);
  merged.creditedCollectionIds = ledger([
    ...local.creditedCollectionIds,
    ...remote.creditedCollectionIds
  ], merged.worlds.moon.outpost);
  return sanitizeExpeditionState(merged, { worldweaving });
}

export function expeditionView(raw, { worldweaving } = {}) {
  const state = sanitizeExpeditionState(raw, { worldweaving });
  const moonAccess = moonHomeWorldAccess(worldweaving);
  return {
    version: EXPEDITION_VERSION,
    revision: state.revision,
    activeWorldId: state.activeWorldId,
    homeWorldId: state.homeWorldId,
    selectableHomeWorldIds: selectableExpeditionHomeWorldIds(state, { worldweaving }),
    moonHomeWorldAccess: moonAccess,
    launches: state.worlds.moon.launches,
    lastLaunchAt: state.worlds.moon.lastLaunchAt,
    salvageCosmeticIds: [...state.salvageCosmeticIds],
    creditedCollections: state.creditedCollectionIds.length
  };
}
