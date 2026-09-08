/**
 * Pure spatial presentation for the isolated Moon Settlement Lab.
 *
 * The domain owns what exists. This module owns where it appears and which
 * single construction concern should be visible next.
 */

import {
  MOON_SETTLEMENT_PARCEL_CELL_SIZE,
  MOON_SETTLEMENT_PARCEL_FOOTPRINT,
  MOON_SETTLEMENT_PARCEL_GRID_SIZE,
  MOON_SETTLEMENT_PLOT_STRIDE,
  normalizeMoonSettlementPlacement,
  offsetMoonSettlementParcelPosition,
  resolveMoonSettlementPlotPosition
} from "./moon-settlement-placement.mjs?v=5.0.0-beta.4";

const freezePosition = (position) => Object.freeze(position.map((value) => Number(value) || 0));

const plotPosition = (siteId) => freezePosition(resolveMoonSettlementPlotPosition(siteId) || [0, 0, 0]);
const landingPosition = plotPosition("lander");

export const MOON_SETTLEMENT_POSITIONS = Object.freeze({
  lander: freezePosition([
    landingPosition[0] - MOON_SETTLEMENT_PARCEL_CELL_SIZE,
    0,
    landingPosition[2] - MOON_SETTLEMENT_PARCEL_CELL_SIZE
  ]),
  // The starter vault is cargo within the authored landing plot, not another
  // free-floating construction site.
  "starter-vault": freezePosition([
    landingPosition[0] + MOON_SETTLEMENT_PARCEL_CELL_SIZE,
    0,
    landingPosition[2] + MOON_SETTLEMENT_PARCEL_CELL_SIZE
  ]),
  "site-regolith": freezePosition([
    landingPosition[0] + MOON_SETTLEMENT_PARCEL_CELL_SIZE * 3.1,
    0,
    landingPosition[2] + MOON_SETTLEMENT_PARCEL_CELL_SIZE * 1.15
  ]),
  "world-seed-cradle": plotPosition("seed-cradle"),
  power: plotPosition("power"),
  shelter: plotPosition("shelter"),
  signal: plotPosition("signal"),
  processor: plotPosition("utility-west"),
  storage: plotPosition("utility-east"),
  reservoir: plotPosition("archive"),
  greenhouse: plotPosition("greenhouse"),
  "utility-west": plotPosition("utility-west"),
  "utility-east": plotPosition("utility-east"),
  archive: plotPosition("archive"),
  "seed-cradle": plotPosition("seed-cradle"),
  hub: freezePosition([0, 0, MOON_SETTLEMENT_PLOT_STRIDE * 1.5])
});

export const MOON_SETTLEMENT_SITE_PRESENTATION = Object.freeze({
  power: Object.freeze({ name: "Power foundation", previewType: "power", role: "founding" }),
  shelter: Object.freeze({ name: "Shelter foundation", previewType: "shelter", role: "hero" }),
  signal: Object.freeze({ name: "Signal foundation", previewType: "signal", role: "founding" }),
  "utility-west": Object.freeze({ name: "Processor foundation", previewType: "processor", previewAsset: "processor", role: "utility" }),
  "utility-east": Object.freeze({ name: "Storage foundation", previewType: "storage", role: "utility" }),
  archive: Object.freeze({ name: "Matter reservoir foundation", previewType: "reservoir", role: "utility" }),
  greenhouse: Object.freeze({ name: "Greenhouse foundation", previewType: "greenhouse", role: "hero" })
});

export const MOON_SETTLEMENT_DISTRICT_SITE_ORDER = Object.freeze([
  "power",
  "shelter",
  "signal",
  "utility-west",
  "utility-east",
  "archive",
  "greenhouse",
  "seed-cradle"
]);

const FOUNDING_ORDER = Object.freeze(["power", "shelter", "signal"]);
const CONSTRUCTION_ORDER = Object.freeze(["processor", "storage", "reservoir", "shelter", "greenhouse"]);
const BUILD_SITE = Object.freeze({
  processor: "utility-west",
  storage: "utility-east",
  reservoir: "archive",
  shelter: "shelter",
  greenhouse: "greenhouse"
});

export function resolveMoonSettlementBuildSite(structureType = "") {
  return BUILD_SITE[String(structureType)] || "";
}

function list(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function positionFor(record = {}) {
  const anchor = MOON_SETTLEMENT_POSITIONS[record.type]
    || MOON_SETTLEMENT_POSITIONS[record.siteId]
    || MOON_SETTLEMENT_POSITIONS[record.slot]
    || freezePosition([0, 0, 0]);
  const siteId = record.siteId || record.slot || record.type;
  return record.placement
    ? offsetMoonSettlementParcelPosition(anchor, normalizeMoonSettlementPlacement(record.placement, { siteId }))
    : anchor;
}

function rotationFor(record = {}) {
  if (Number.isFinite(Number(record.rotation))) return Number(record.rotation);
  const siteId = record.siteId || record.slot || record.type;
  return record.placement
    ? normalizeMoonSettlementPlacement(record.placement, { siteId }).rotationQuarter * Math.PI / 2
    : 0;
}

function foundingChoice(source, slot) {
  const value = source?.founding?.[slot] ?? source?.founding?.[`${slot}ChoiceId`];
  return typeof value === "string" ? value : value?.choiceId || value?.id || "";
}

export function deriveMoonSettlementActiveSite(source = {}, { pendingFounding = null, pendingPlacement = null } = {}) {
  const stage = String(source?.stage || "landing");
  if (stage === "landing") {
    const slot = FOUNDING_ORDER.find((candidate) => !foundingChoice(source, candidate));
    if (!slot) return null;
    const presentation = MOON_SETTLEMENT_SITE_PRESENTATION[slot];
    const pending = pendingFounding?.slot === slot ? pendingFounding : null;
    const choiceId = pending?.choiceId || "";
    const previewType = choiceId ? `${choiceId}-${slot}` : presentation.previewType;
    return Object.freeze({
      siteId: slot,
      name: pending?.label ? `${pending.label} foundation` : presentation.name,
      previewType,
      previewAsset: presentation.previewAsset || "",
      role: presentation.role,
      phase: "founding"
    });
  }

  if (stage === "construction") {
    const actions = new Set(list(source?.nextActions).map(String));
    const requestedType = String(pendingPlacement?.structureType || "");
    const structureType = actions.has(`build-${requestedType}`)
      ? requestedType
      : CONSTRUCTION_ORDER.find((candidate) => actions.has(`build-${candidate}`));
    if (!structureType) return null;
    const siteId = BUILD_SITE[structureType];
    const presentation = MOON_SETTLEMENT_SITE_PRESENTATION[siteId];
    const shelterChoice = structureType === "shelter" ? foundingChoice(source, "shelter") : "";
    return Object.freeze({
      siteId,
      name: presentation.name,
      previewType: structureType,
      previewAsset: shelterChoice ? `${shelterChoice}-shelter` : presentation.previewAsset || "",
      role: presentation.role,
      phase: "construction"
    });
  }

  return null;
}

function objectiveTargetId(source, activeSite, modules) {
  if (activeSite) {
    const occupyingModule = modules.find((module) => module.slot === activeSite.siteId);
    return occupyingModule?.id || `site-${activeSite.siteId}`;
  }
  const stage = String(source?.stage || "landing");
  if (stage === "vault-repair") return "starter-vault";
  if (["ground", "first-weave"].includes(stage)) return "site-regolith";
  if (["cultivation", "cultivation-ready", "growth"].includes(stage)) return "structure-greenhouse";
  if (stage === "proof-ready") return "structure-greenhouse";
  if (stage === "open-play") return "world-seed-cradle";
  return "lander";
}

function buildPaths(records, objectiveId) {
  const recordById = new Map(records.map((record) => [record.id, record]));
  const lander = recordById.get("lander");
  const vault = recordById.get("starter-vault");
  if (!lander || !vault) return Object.freeze([]);

  const paths = [{
    id: "path-arrival-vault",
    kind: objectiveId === "starter-vault" ? "objective" : "active",
    points: [lander.position, [vault.position[0], 0, lander.position[2]], vault.position]
  }];
  const branches = records.filter((record) => !["lander", "starter-vault"].includes(record.id));
  if (branches.length) {
    paths.push({
      id: "path-settlement-spine",
      kind: "active",
      points: [vault.position, [MOON_SETTLEMENT_POSITIONS.hub[0], 0, vault.position[2]], MOON_SETTLEMENT_POSITIONS.hub]
    });
    for (const record of branches) {
      const elbow = [record.position[0], 0, MOON_SETTLEMENT_POSITIONS.hub[2]];
      paths.push({
        id: `path-${record.id}`,
        kind: record.id === objectiveId ? "objective" : "active",
        points: [MOON_SETTLEMENT_POSITIONS.hub, elbow, record.position]
      });
    }
  }
  return Object.freeze(paths.map((path) => Object.freeze({
    ...path,
    points: Object.freeze(path.points.map((point) => freezePosition(point)))
  })));
}

/**
 * Convert the canonical read model into a deterministic, progressively
 * revealed scene. No domain object is retained or mutated.
 */
export function projectMoonSettlementSpatialState(source = {}, {
  domainState = {},
  pendingFounding = null,
  placementDraft = null
} = {}) {
  const activeSite = deriveMoonSettlementActiveSite(source, { pendingFounding, pendingPlacement: placementDraft });
  const driftByStructure = new Map(list(source?.drift).map((entry) => [entry.structureId, entry]));
  const trayByStructure = new Map(list(source?.productionTrays).map((entry) => [entry.structureId, entry]));
  const revealWorldSeed = String(source?.stage) === "open-play";
  const sourceStructures = list(source?.structures).filter((structure) => (
    structure.id !== "world-seed-cradle" || revealWorldSeed
  ));
  const hasLivingShelter = sourceStructures.some((structure) => structure.type === "shelter");
  const stage = String(source?.stage || "landing");

  const structures = sourceStructures.map((structure) => {
    const type = String(structure.type || "unknown");
    const drift = driftByStructure.get(structure.id);
    const tray = trayByStructure.get(structure.id);
    const assetVariant = type === "shelter" && foundingChoice(source, "shelter")
      ? `${foundingChoice(source, "shelter")}-shelter`
      : "";
    return {
      ...structure,
      assetVariant,
      name: structure.title || titleCase(type),
      position: positionFor(structure),
      rotation: rotationFor(structure),
      concern: drift ? `${drift.kind} · ${titleCase(drift.stressTier)} stress` : structure.status === "damaged" ? "Damaged, but recoverable" : "No urgent concern",
      production: tray ? `${titleCase(tray.status)} bean batch` : "Idle",
      labelVisibility: ["lander", "starter-vault", "world-seed-cradle"].includes(structure.id) ? "landmark" : "context",
      ports: list(structure.ports).map((port, index) => ({ id: `${structure.id}-port-${index}`, type: port, connected: false }))
    };
  });

  const modules = list(source?.modules)
    .filter((module) => !(module.slot === "shelter" && hasLivingShelter))
    .map((module) => ({
      ...module,
      id: module.id || `module-${module.slot}`,
      type: `${module.choiceId || module.slot}-${module.slot}`,
      name: module.title || titleCase(module.choiceId),
      position: positionFor(module),
      rotation: rotationFor(module),
      status: "active",
      concern: activeSite?.siteId === module.slot ? "Ready to expand in place" : "Founding module",
      siteRole: activeSite?.siteId === module.slot ? "upgrade" : "installed",
      labelVisibility: activeSite?.siteId === module.slot ? "active" : "context",
      ports: list(module.ports).map((port, index) => ({ id: `${module.id || `module-${module.slot}`}-port-${index}`, type: port, connected: false }))
    }));

  const regolithSample = ["ground", "first-weave"].includes(stage) ? [{
    id: "site-regolith",
    type: "regolith-sample",
    kind: "structure",
    name: stage === "ground" ? "Unknown ground sample" : "Regolith sample",
    position: MOON_SETTLEMENT_POSITIONS["site-regolith"],
    rotation: 0.28,
    status: stage === "ground" ? "unknown" : "sampled",
    concern: stage === "ground" ? "Unknown ground signature" : "Earth and Dust detected",
    production: "Scientific sample",
    labelVisibility: "active",
    // The renderer anchors the reticle to the rock mesh itself. This cancels
    // the generic external-label lift so the scan cue sits on the material.
    labelHeight: -0.25,
    ports: []
  }] : [];

  const occupiedSites = new Set([
    ...structures.map((entry) => entry.siteId),
    ...modules.map((entry) => entry.slot)
  ]);
  const domainSites = list(domainState?.sites);
  const siteStateById = new Map(domainSites.map((site) => [site.id, site]));
  const knownSites = new Set(domainSites.filter((site) => site.unlocked !== false).map((site) => site.id));
  const siteIsAvailable = activeSite && (knownSites.size === 0 || knownSites.has(activeSite.siteId));
  const effectivePlacement = activeSite && (
    placementDraft?.siteId === activeSite.siteId
      ? placementDraft
      : pendingFounding?.slot === activeSite.siteId
        ? pendingFounding.placement
        : null
  );
  const normalizedPlacement = activeSite
    ? normalizeMoonSettlementPlacement(effectivePlacement || {}, { siteId: activeSite.siteId })
    : null;
  const authoredSites = siteIsAvailable && !occupiedSites.has(activeSite.siteId) ? [{
    id: `site-${activeSite.siteId}`,
    name: activeSite.name,
    type: "plot",
    kind: "site",
    position: offsetMoonSettlementParcelPosition(MOON_SETTLEMENT_POSITIONS[activeSite.siteId], normalizedPlacement),
    rotation: normalizedPlacement.rotationQuarter * Math.PI / 2,
    status: "open",
    cue: "objective",
    labelVisibility: "active",
    previewType: activeSite.previewType,
    previewAsset: activeSite.previewAsset,
    siteRole: activeSite.role
  }] : [];

  const parcels = MOON_SETTLEMENT_DISTRICT_SITE_ORDER
    .filter((siteId) => knownSites.size === 0 || knownSites.has(siteId))
    .map((siteId) => {
      const presentation = MOON_SETTLEMENT_SITE_PRESENTATION[siteId];
      const interactive = activeSite?.siteId === siteId && Boolean(effectivePlacement);
      const selected = interactive
        ? normalizedPlacement
        : normalizeMoonSettlementPlacement({}, { siteId });
      const occupied = occupiedSites.has(siteId) || Boolean(siteStateById.get(siteId)?.occupiedBy);
      const status = interactive
        ? "placing"
        : occupied
          ? "occupied"
          : siteId === "seed-cradle"
            ? "reserved"
            : "planned";
      return {
        id: `parcel-${siteId}`,
        siteId,
        name: `${presentation?.name || "Reserved cradle"} plot`,
        position: MOON_SETTLEMENT_POSITIONS[siteId],
        columns: MOON_SETTLEMENT_PARCEL_GRID_SIZE,
        rows: MOON_SETTLEMENT_PARCEL_GRID_SIZE,
        cellSize: MOON_SETTLEMENT_PARCEL_CELL_SIZE,
        footprint: MOON_SETTLEMENT_PARCEL_FOOTPRINT,
        selected,
        rotationQuarter: selected.rotationQuarter,
        status,
        interactive
      };
    });

  const objectiveId = objectiveTargetId(source, activeSite, modules);
  const sceneStructures = [...structures, ...modules, ...regolithSample, ...authoredSites].map((record) => ({
    ...record,
    cue: record.id === objectiveId ? "objective" : record.cue || ""
  }));
  const renderedStructures = sceneStructures.filter((record) => record.type !== "plot");
  const renderedSites = sceneStructures.filter((record) => record.type === "plot");
  const projectedActiveSite = activeSite ? Object.freeze({ ...activeSite, targetId: objectiveId }) : null;

  return Object.freeze({
    ...source,
    structures: Object.freeze(renderedStructures),
    authoredSites: Object.freeze(renderedSites),
    activeSite: projectedActiveSite,
    parcels: Object.freeze(parcels.map((parcel) => Object.freeze(parcel))),
    objectiveTargetId: objectiveId,
    paths: buildPaths(sceneStructures, objectiveId)
  });
}
