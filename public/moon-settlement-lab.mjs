import {
  applySettlementOperation,
  applyStructureDraft,
  cancelStructureDraft,
  createMoonSettlement,
  createStructureDraft,
  previewStructureDraft,
  projectMoonSettlement,
  quoteSettlementOperation,
  resolveProductionBatch,
  sanitizeMoonSettlement
} from "./moon-settlement-domain.mjs?v=5.0.0-beta.4";
import { createMoonSettlementStorage } from "./moon-settlement-persistence.mjs?v=5.0.0-beta.4";
import {
  appendMoonSettlementTimeline,
  exportMoonSettlementTimeline,
  sanitizeMoonSettlementTimeline
} from "./moon-settlement-timeline.mjs?v=5.0.0-beta.4";
import { createMoonSettlementRenderer } from "./moon-settlement-renderer.mjs?v=5.0.0-beta.4";
import {
  projectMoonSettlementSpatialState,
  resolveMoonSettlementBuildSite
} from "./moon-settlement-presentation.mjs?v=5.0.0-beta.4";
import {
  MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT,
  labelMoonSettlementParcelCell,
  normalizeMoonSettlementPlacement
} from "./moon-settlement-placement.mjs?v=5.0.0-beta.4";

const LAB_SAVE_KEY = "constellore:moon-settlement-lab:living-ground:v2";
const TIMELINE_KEY = `${LAB_SAVE_KEY}:timeline`;
const SETTINGS_KEY = `${LAB_SAVE_KEY}:settings`;
const MODES = new Set(["walk", "inspect", "weave"]);
const SEMANTIC_OPERATIONS = new Set(["separate-regolith", "craft-bean-pod", "clear-drift"]);

const elements = Object.freeze({
  app: document.querySelector("#settlementApp"),
  canvasHost: document.querySelector("#settlementCanvasHost"),
  labelLayer: document.querySelector("#settlementHotspots"),
  announcer: document.querySelector("#settlementAnnouncer"),
  objectiveTitle: document.querySelector("#objectiveTitle"),
  objectiveCopy: document.querySelector("#objectiveCopy"),
  objectiveProgress: document.querySelector("#objectiveProgress"),
  objectiveActions: document.querySelector("#objectiveActions"),
  expeditionPhase: document.querySelector("#expeditionPhase"),
  worldStateText: document.querySelector("#worldStateText"),
  contextPrompt: document.querySelector("#contextPrompt"),
  primaryAction: document.querySelector("#primaryAction"),
  primaryActionStatus: document.querySelector("#primaryActionStatus"),
  primaryActionKey: document.querySelector("#primaryActionKey"),
  primaryActionLabel: document.querySelector("#contextPromptText"),
  primaryActionValue: document.querySelector("#primaryActionValue"),
  primaryActionProgress: document.querySelector("#primaryActionProgress"),
  primaryActionDetail: document.querySelector("#primaryActionDetail"),
  matter: document.querySelector("#resourceMatter"),
  storage: document.querySelector("#resourceStorage"),
  storageCapacity: document.querySelector("#resourceStorageCapacity"),
  foundingSheet: document.querySelector("#foundingChoiceSheet"),
  foundingStep: document.querySelector("#foundingChoiceStep"),
  foundingConsequence: document.querySelector("#foundingChoiceConsequence"),
  foundingConfirm: document.querySelector("#foundingChoiceConfirm"),
  foundingBack: document.querySelector("#foundingChoiceBack"),
  placementBar: document.querySelector("#parcelPlacementBar"),
  placementTitle: document.querySelector("#parcelPlacementTitle"),
  placementStatus: document.querySelector("#parcelPlacementStatus"),
  placementConfirm: document.querySelector("#parcelPlacementConfirm"),
  placementCancel: document.querySelector("#parcelPlacementCancel"),
  inspectPanel: document.querySelector("#inspectPanel"),
  inspectTitle: document.querySelector("#inspectTitle"),
  inspectConcern: document.querySelector("#inspectConcern"),
  inspectProduction: document.querySelector("#inspectProduction"),
  inspectQuality: document.querySelector("#inspectQuality"),
  inspectDrift: document.querySelector("#inspectDrift"),
  inspectPorts: document.querySelector("#inspectPorts"),
  inspectStructureButton: document.querySelector("#inspectStructureButton"),
  weaveLayer: document.querySelector("#weaveLayer"),
  weaveHost: document.querySelector("#weaveCanvasHost"),
  weaveLabels: document.querySelector("#weaveLabels"),
  weaveGraph: document.querySelector("#weaveAccessibleGraph"),
  weaveTitle: document.querySelector("#weaveTitle"),
  weaveSelectionTitle: document.querySelector("#weaveSelectionTitle"),
  weaveSummary: document.querySelector("#weaveDraftSummary"),
  weaveConsequences: document.querySelector("#weaveConsequences"),
  weaveCohesion: document.querySelector("#weaveCohesion"),
  weaveQuality: document.querySelector("#weaveQuality"),
  weaveSelectionCopy: document.querySelector("#weaveSelectionCopy"),
  weaveBondTier: document.querySelector("#weaveBondTier"),
  weaveStressTier: document.querySelector("#weaveStressTier"),
  weaveSelectionCost: document.querySelector("#weaveSelectionCost"),
  weaveApply: document.querySelector("#weaveApply"),
  weaveCancel: document.querySelector("#weaveCancel"),
  rollbackBar: document.querySelector("#rollbackBar"),
  rollbackButton: document.querySelector("#rollbackButton"),
  proofRibbon: document.querySelector("#proofRibbon"),
  settingsPanel: document.querySelector("#settingsPanel"),
  settingsClose: document.querySelector("#settingsClose"),
  settingsRollback: document.querySelector("#settingsRollback"),
  developerToolkit: document.querySelector("#developerToolkit")
});

if (!elements.app || !elements.canvasHost) {
  throw new Error("The Moon Settlement Lab shell is incomplete.");
}

function safeJsonParse(source, fallback) {
  try {
    return JSON.parse(String(source || ""));
  } catch {
    return fallback;
  }
}

function bool(value, fallback = false) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
}

const mediaReducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
const savedSettings = safeJsonParse(localStorage.getItem(SETTINGS_KEY), {});
const settings = {
  quality: ["low", "fallback"].includes(savedSettings.quality) ? savedSettings.quality : "standard",
  reducedMotion: bool(savedSettings.reducedMotion, mediaReducedMotion),
  motorAssist: bool(savedSettings.motorAssist, true),
  nonColor: bool(savedSettings.nonColor, false),
  subtitles: bool(savedSettings.subtitles, true),
  holdMode: savedSettings.holdMode === "toggle" ? "toggle" : "hold"
};

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  elements.app.dataset.quality = settings.quality;
  elements.app.dataset.reducedMotion = String(settings.reducedMotion);
  elements.app.dataset.motorAssist = String(settings.motorAssist);
  elements.app.dataset.nonColor = String(settings.nonColor);
  elements.app.dataset.holdMode = settings.holdMode;
  document.body.dataset.noncolor = String(settings.nonColor);
  document.body.dataset.motion = settings.reducedMotion ? "reduced" : "full";
}

const storage = createMoonSettlementStorage({
  storage: localStorage,
  sanitize: sanitizeMoonSettlement,
  key: LAB_SAVE_KEY
});

let state = storage.load(createMoonSettlement({ at: new Date() }));
let projection = projectMoonSettlement(state);
let mode = "walk";
let selectedTarget = null;
let pendingOperation = null;
let pendingFounding = null;
let placementDraft = null;
let placementReturnFocus = null;
let foundingGroupOverride = null;
let activeDraft = null;
let activeDraftOperation = null;
let selectedDraftTargetId = null;
let activeDraftTested = false;
let operationSequence = 0;
let busy = false;
let productionReadyTimer = 0;
let weaveReturnFocus = null;
let timeline = sanitizeMoonSettlementTimeline(safeJsonParse(localStorage.getItem(TIMELINE_KEY), {}));
let lastActivityAt = Date.now();
let primaryActionDescriptor = null;
let primaryActionHoldFrame = 0;
let primaryActionHoldStartedAt = 0;
let primaryActionHoldKey = "";
let primaryActionHolding = false;
let suppressPrimaryActionClick = false;
let worldRendererReady = false;
let openingFocusApplied = false;

const PRIMARY_ACTION_HOLD_MS = 1_200;

function recordTimeline(type, key, extra = {}) {
  timeline = appendMoonSettlementTimeline(timeline, {
    type,
    key,
    step: Number(projection?.progress?.completed || projection?.progress || 0),
    ...extra
  });
  localStorage.setItem(TIMELINE_KEY, JSON.stringify(timeline));
}

function announce(message) {
  if (!message) return;
  if (elements.announcer) {
    elements.announcer.textContent = "";
    requestAnimationFrame(() => { elements.announcer.textContent = String(message); });
  }
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function numeric(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function spatialProjection(source = projection) {
  return projectMoonSettlementSpatialState(source, { domainState: state, pendingFounding, placementDraft });
}

function list(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function operationId(type) {
  operationSequence += 1;
  return `living-ground:${state.revision + 1}:${type}:${operationSequence}`;
}

function normalizeAction(action) {
  if (typeof action === "string") {
    if (action.startsWith("choose-")) return null;
    if (action.startsWith("build-")) {
      const structureType = action.slice("build-".length);
      return { type: "build-structure", label: `Build ${titleCase(structureType)}`, payload: { structureType } };
    }
    if (action === "claim-living-ground") {
      return { type: "claim-proof", label: "Claim Living Ground", payload: { proofId: "living-ground" } };
    }
    if (action === "buy-random-bubble") {
      return { type: "buy-bubble", label: "Condense a random concept", payload: { bubbleType: "random" } };
    }
    if (action === "clear-drift") {
      return { type: action, label: "Separate Regolith Dust", payload: { hazardId: projection?.drift?.[0]?.id, method: "separate" } };
    }
    const labels = {
      "repair-vault": "Repair starter vault",
      "sample-regolith": "Sample nearby Regolith",
      "separate-regolith": "Separate Earth from Dust",
      "craft-bean-pod": "Craft a bean crop pod",
      "start-production": "Start the first bean batch",
      "resolve-production": "Collect the finished batch"
    };
    return { type: action, label: labels[action] || titleCase(action) };
  }
  if (!action || typeof action !== "object") return null;
  const type = String(action.type || action.id || action.action || "");
  if (!type) return null;
  return {
    ...action,
    type,
    label: String(action.label || action.title || titleCase(type)),
    payload: action.payload && typeof action.payload === "object" ? action.payload : {}
  };
}

function inferredNextActions() {
  const actions = list(projection?.nextActions).map(normalizeAction).filter(Boolean);
  if (actions.length) return actions;
  const stage = String(projection?.stage || state.stage || "founding");
  const fallback = {
    founding: [],
    "vault-repair": [{ type: "repair-vault", label: "Repair starter vault" }],
    sampling: [{ type: "sample-regolith", label: "Sample nearby Regolith" }],
    separating: [{ type: "separate-regolith", label: "Separate Earth from Dust" }],
    building: [{ type: "build-structure", label: "Build next settlement structure" }],
    planting: [{ type: "craft-bean-pod", label: "Craft a bean crop pod", payload: { quality: "stable" } }],
    growing: [{ type: "start-production", label: "Start the greenhouse batch" }],
    maintenance: [{ type: "clear-drift", label: "Clear Regolith Dust" }],
    proof: [{ type: "claim-proof", label: "Claim Living Ground", payload: { proofId: "living-ground" } }],
    complete: [{ type: "buy-bubble", label: "Condense an optional concept", payload: { bubbleType: "random" } }]
  };
  return fallback[stage] || [];
}

function availableActions() {
  return inferredNextActions().filter((action) => {
    const quote = quoteSettlementOperation(state, {
      type: action.type,
      ...(action.payload || {}),
      id: `availability:${state.revision}:${action.type}:${action.payload?.structureType || ""}`
    }, { at: new Date() });
    return quoteAllowed(quote);
  });
}

function operationFromAction(action) {
  const normalized = normalizeAction(action);
  if (!normalized) return null;
  const operation = {
    type: normalized.type,
    ...normalized.payload,
    id: operationId(normalized.type),
    operationId: undefined
  };
  if (normalized.structureType) operation.structureType = normalized.structureType;
  if (normalized.quality) operation.quality = normalized.quality;
  if (normalized.proofId) operation.proofId = normalized.proofId;
  return { normalized, operation };
}

function primaryActionCopy(action) {
  const copy = {
    "repair-vault": {
      label: "Repair vault",
      status: "Starter vault seal compromised",
      detail: "Repair the damaged biological starter vault."
    },
    "sample-regolith": {
      label: "Scan sample",
      status: "Unknown ground signature",
      activeStatus: "Reading material structure…",
      detail: "Hold E to scan the highlighted Regolith sample.",
      behavior: "hold"
    },
    "separate-regolith": {
      label: "Separate",
      status: "Earth and Dust identified",
      detail: "Open the Regolith structure and separate useful Earth from Dust."
    },
    "craft-bean-pod": {
      label: "Craft crop pod",
      status: "Living Soil and seed are ready",
      detail: "Open the crop structure to seat, tune, and test one bean pod."
    },
    "start-production": {
      label: "Start batch",
      status: "Six crop seats are ready",
      detail: "Start the first visible Greenhouse production batch."
    },
    "resolve-production": {
      label: "Collect harvest",
      status: "The Greenhouse batch is ready",
      detail: "Collect the finished crop batch into settlement storage."
    },
    "clear-drift": {
      label: "Clear Dust",
      status: "Regolith Dust is stressing the system",
      detail: "Open the affected structure and separate the Dust drift."
    },
    "claim-proof": {
      label: "Claim Proof",
      status: "Living Ground is ready to prove",
      detail: "Commit the Living Ground proof and awaken the World Seed cradle."
    },
    "buy-bubble": {
      label: "Condense concept",
      status: "Recovered Matter is available",
      detail: "Spend one Matter on a no-repeat random concept bubble."
    }
  };
  return copy[action?.type] || {
    label: action?.label || titleCase(action?.type),
    status: projection?.stage === "open-play" ? "Settlement systems are steady" : "A settlement response is ready",
    detail: action?.label || titleCase(action?.type)
  };
}

function derivePrimaryAction(sceneState) {
  sceneState ||= spatialProjection(projection);
  if (mode === "weave" || pendingFounding || elements.proofRibbon?.hidden === false) return null;

  if (placementDraft) {
    const quote = pendingFounding?.quote || pendingOperation?.quote;
    const cell = labelMoonSettlementParcelCell(placementDraft.cellX, placementDraft.cellZ);
    return Object.freeze({
      key: `place:${state.revision}:${placementDraft.siteId}:${cell}:${placementDraft.rotationQuarter}`,
      command: "place",
      label: `Place at ${cell}`,
      status: quoteAllowed(quote) ? `${placementOwnerLabel()} aligned to parcel ${cell}` : titleCase(quote?.reason || "Placement invalid"),
      detail: quoteAllowed(quote) ? "Commit this exact snapped parcel placement." : "Choose a valid parcel cell before placing.",
      behavior: "press",
      tone: quoteAllowed(quote) ? "ready" : "blocked",
      disabled: !quoteAllowed(quote)
    });
  }

  if (mode === "inspect" && pendingOperation) {
    const allowed = quoteAllowed(pendingOperation.quote);
    return Object.freeze({
      key: `apply:${state.revision}:${pendingOperation.operation.id}`,
      command: "apply-pending",
      label: `Apply ${pendingOperation.label}`,
      status: pendingOperation.quote?.summary || quoteLines(pendingOperation.quote)[0] || "Exact change ready",
      detail: quoteLines(pendingOperation.quote).join(". ") || "Apply the quoted change as one expedition revision.",
      behavior: "press",
      tone: allowed ? "ready" : "blocked",
      disabled: !allowed
    });
  }

  if (mode === "inspect" && selectedTarget) {
    return Object.freeze({
      key: `inspect:${state.revision}:${selectedTarget.id}`,
      command: "close-inspect",
      label: "Return",
      status: selectedTarget.concern || `${selectedTarget.name || titleCase(selectedTarget.id)} inspected`,
      detail: "Return to the Moon surface.",
      behavior: "press",
      tone: "quiet",
      disabled: false
    });
  }

  const action = availableActions()[0];
  if (!action) return null;
  const copy = primaryActionCopy(action);
  const quote = quoteSettlementOperation(state, {
    type: action.type,
    ...(action.payload || {}),
    id: `primary:${state.revision}:${action.type}:${action.payload?.structureType || ""}`
  }, { at: new Date() });
  return Object.freeze({
    key: `action:${state.revision}:${action.type}:${sceneState?.objectiveTargetId || "world"}`,
    command: "action",
    action,
    targetId: sceneState?.objectiveTargetId || "",
    label: copy.label,
    status: copy.status,
    activeStatus: copy.activeStatus || copy.status,
    detail: quoteLines(quote).join(". ") || copy.detail,
    behavior: copy.behavior || "press",
    tone: action.type === "separate-regolith" ? "complete" : "ready",
    disabled: !quoteAllowed(quote)
  });
}

function quoteLines(quote) {
  const consequences = quote?.consequences || quote?.effects || quote?.preview || quote?.changes;
  if (Array.isArray(consequences)) {
    return consequences.map((entry) => typeof entry === "string" ? entry : entry?.label || entry?.text).filter(Boolean);
  }
  if (consequences && typeof consequences === "object") {
    return Object.entries(consequences).map(([key, value]) => `${titleCase(key)}: ${Array.isArray(value) ? value.join(", ") : value}`);
  }
  const lines = [];
  if (quote?.resultingWords?.length) lines.push(`Result: ${quote.resultingWords.join(" + ")}`);
  if (quote?.quality) lines.push(`Quality: ${titleCase(quote.quality)}`);
  const resourceChanges = quote?.resourceChanges && typeof quote.resourceChanges === "object" ? quote.resourceChanges : {};
  const resourceLine = Object.entries(resourceChanges)
    .filter(([, value]) => numeric(value) !== 0)
    .map(([key, value]) => `${value > 0 ? "+" : ""}${value} ${key}`)
    .join(", ");
  if (resourceLine) lines.push(`Resources: ${resourceLine}`);
  if (numeric(quote?.matterChange) !== 0) lines.push(`Matter: ${quote.matterChange > 0 ? "+" : ""}${quote.matterChange}`);
  if (quote?.driftRisk?.length) lines.push(`Drift: ${quote.driftRisk.map((entry) => `${entry.kind || entry} · ${entry.stressTier || "declared"}`).join(", ")}`);
  if (quote?.worldChanges?.length) lines.push(...quote.worldChanges.map((entry) => `World: ${entry}`));
  if (!lines.length) lines.push(...[quote?.summary, quote?.result, quote?.reason].filter((value) => typeof value === "string" && value));
  return lines;
}

function quoteAllowed(quote) {
  if (!quote || typeof quote !== "object") return false;
  if (Object.hasOwn(quote, "accepted")) return quote.accepted === true;
  return quote.allowed !== false && quote.valid !== false && quote.canApply !== false;
}

function placementPayload(draft = placementDraft) {
  if (!draft) return null;
  const normalized = normalizeMoonSettlementPlacement(draft, { siteId: draft.siteId });
  return {
    parcelId: normalized.parcelId,
    cellX: normalized.cellX,
    cellZ: normalized.cellZ,
    rotationQuarter: normalized.rotationQuarter
  };
}

function placementOwnerLabel() {
  return pendingFounding?.label || pendingOperation?.label || "Structure";
}

function refreshPlacementQuote({ rerender = true } = {}) {
  const placement = placementPayload();
  if (!placement) return null;
  if (pendingFounding) {
    const operation = { ...pendingFounding.operation, placement };
    pendingFounding = {
      ...pendingFounding,
      placement,
      operation,
      quote: quoteSettlementOperation(state, operation, { at: new Date() })
    };
  }
  if (pendingOperation?.operation?.type === "build-structure") {
    const operation = { ...pendingOperation.operation, placement };
    pendingOperation = {
      ...pendingOperation,
      operation,
      quote: quoteSettlementOperation(state, operation, { at: new Date() })
    };
  }
  if (rerender) render();
  return pendingFounding?.quote || pendingOperation?.quote || null;
}

function beginPlacement(siteId, seed = {}, returnFocus = document.activeElement) {
  const normalized = normalizeMoonSettlementPlacement(seed, { siteId });
  placementReturnFocus = returnFocus?.isConnected ? returnFocus : elements.canvasHost;
  placementDraft = { siteId, structureType: String(seed?.structureType || ""), ...normalized };
  elements.app.dataset.placing = "true";
  refreshPlacementQuote({ rerender: false });
}

function setPlacementCell(cellX, cellZ, { announceChange = true } = {}) {
  if (!placementDraft) return false;
  if (!Number.isInteger(Number(cellX)) || !Number.isInteger(Number(cellZ))
    || Math.abs(Number(cellX)) > MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT
    || Math.abs(Number(cellZ)) > MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT) {
    announce("That edge cell cannot hold the full building footprint.");
    return false;
  }
  placementDraft = {
    ...placementDraft,
    cellX: Number(cellX),
    cellZ: Number(cellZ)
  };
  const quote = refreshPlacementQuote();
  if (announceChange) {
    const label = labelMoonSettlementParcelCell(placementDraft.cellX, placementDraft.cellZ);
    announce(`${placementOwnerLabel()}, cell ${label}, ${placementDraft.rotationQuarter * 90} degrees, ${quoteAllowed(quote) ? "valid" : titleCase(quote?.reason)}.`);
  }
  return true;
}

function movePlacement(deltaX, deltaZ) {
  if (!placementDraft) return false;
  return setPlacementCell(
    Math.max(-MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT, Math.min(MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT, placementDraft.cellX + deltaX)),
    Math.max(-MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT, Math.min(MOON_SETTLEMENT_PARCEL_ANCHOR_LIMIT, placementDraft.cellZ + deltaZ))
  );
}

function rotatePlacement(direction = 1) {
  if (!placementDraft) return false;
  placementDraft = {
    ...placementDraft,
    rotationQuarter: ((placementDraft.rotationQuarter + Math.sign(direction || 1)) % 4 + 4) % 4
  };
  const quote = refreshPlacementQuote();
  announce(`${placementOwnerLabel()} rotated to ${placementDraft.rotationQuarter * 90} degrees, ${quoteAllowed(quote) ? "valid" : titleCase(quote?.reason)}.`);
  return true;
}

function cancelPlacement({ announceCancel = true } = {}) {
  if (!placementDraft) return false;
  const restoreTarget = placementReturnFocus;
  placementDraft = null;
  placementReturnFocus = null;
  pendingFounding = null;
  if (pendingOperation?.operation?.type === "build-structure") pendingOperation = null;
  delete elements.app.dataset.placing;
  render();
  queueMicrotask(() => (restoreTarget?.isConnected ? restoreTarget : elements.canvasHost)?.focus?.());
  if (announceCancel) announce("Placement cancelled. Nothing changed.");
  return true;
}

function confirmPlacement() {
  if (!placementDraft || busy) return false;
  const founding = pendingFounding;
  const construction = pendingOperation?.operation?.type === "build-structure" ? pendingOperation : null;
  const pending = founding || construction;
  const ownerLabel = pending?.label || "Structure";
  if (!pending || !quoteAllowed(pending.quote)) {
    announce(`Placement cannot be applied: ${titleCase(pending?.quote?.reason || "invalid placement")}.`);
    return false;
  }
  placementDraft = null;
  placementReturnFocus = null;
  pendingFounding = null;
  if (construction) pendingOperation = null;
  delete elements.app.dataset.placing;
  const applied = applyOperationNow(pending.operation);
  if (!applied) {
    const placement = pending.operation.placement;
    placementDraft = {
      siteId: placement.parcelId,
      structureType: construction?.operation?.structureType || "",
      ...normalizeMoonSettlementPlacement(placement, { siteId: placement.parcelId })
    };
    if (founding) pendingFounding = founding;
    if (construction) pendingOperation = construction;
    elements.app.dataset.placing = "true";
    render();
    return false;
  }
  foundingGroupOverride = null;
  setMode("walk", { announceMode: false });
  announce(`${ownerLabel} placed on the Moon parcel.`);
  return true;
}

function scheduleProductionReadiness() {
  if (productionReadyTimer) {
    clearTimeout(productionReadyTimer);
    productionReadyTimer = 0;
  }
  const now = Date.now();
  const readyAt = list(state?.productionTrays)
    .filter((tray) => tray?.status === "running")
    .map((tray) => Date.parse(tray.readyAt))
    .filter((value) => Number.isFinite(value) && value > now)
    .sort((left, right) => left - right)[0];
  if (!readyAt) return;
  productionReadyTimer = setTimeout(() => {
    productionReadyTimer = 0;
    projection = projectMoonSettlement(state);
    render();
    if (availableActions().some((action) => action.type === "resolve-production")) {
      announce("The first greenhouse batch is ready to collect.");
    }
  }, Math.min(2_147_000_000, Math.max(50, readyAt - now + 25)));
}

function renderConsequences(target, quote) {
  if (!target) return;
  const lines = quoteLines(quote);
  const listTarget = target.matches?.("ul, ol") ? target : target.querySelector("[data-consequence-list]") || (() => {
    const created = document.createElement("ul");
    created.dataset.consequenceList = "";
    created.className = "settlement-consequences";
    target.append(created);
    return created;
  })();
  listTarget.replaceChildren();
  if (!lines.length) {
    const item = document.createElement("li");
    item.textContent = "No resources change until Apply.";
    listTarget.append(item);
    return;
  }
  lines.forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    listTarget.append(item);
  });
}

function renderWeaveConsequences(preview) {
  const words = list(preview?.resultingWords).join(" + ") || "No named result";
  const resources = Object.entries(preview?.resourceChanges || {})
    .filter(([, value]) => numeric(value) !== 0)
    .map(([key, value]) => `${value > 0 ? "+" : ""}${value} ${key}`)
    .join(", ") || "No material change";
  const drift = list(preview?.driftRisk).map((entry) => `${entry.kind || entry} · ${entry.stressTier || "declared"}`).join(", ") || "None";
  const world = list(preview?.worldChanges).join(" · ") || "No physical change";
  const values = {
    consequenceWords: words,
    consequenceQuality: titleCase(preview?.quality || "stable"),
    consequenceResources: resources,
    consequenceDrift: drift,
    consequenceWorld: world
  };
  Object.entries(values).forEach(([id, value]) => {
    const node = document.querySelector(`#${id}`);
    if (node) node.textContent = value;
  });
  const summary = document.querySelector("#consequenceSummary");
  if (summary) summary.textContent = quoteAllowed(preview)
    ? "The result is deterministic. Apply commits it as one expedition revision."
    : `Draft incomplete: ${titleCase(preview?.reason || "test required")}.`;
}

function saveState(nextState, { eventKey = "operation" } = {}) {
  state = storage.save(nextState);
  projection = projectMoonSettlement(state);
  recordTimeline("operation", eventKey);
  render();
}

function applyOperationNow(operation) {
  if (busy) return false;
  busy = true;
  try {
    const result = applySettlementOperation(state, operation, { at: new Date() });
    if (!result?.applied) {
      announce(result?.reason || "That change is not available yet.");
      recordTimeline("retry", operation.type);
      return false;
    }
    saveState(result.state, { eventKey: operation.type });
    announce(result.quote?.result || result.quote?.summary || `${titleCase(operation.type)} applied.`);
    if (operation.type === "claim-proof") recordTimeline("milestone", "proof-living-ground");
    return true;
  } finally {
    busy = false;
  }
}

function prepareOperation(action, { source = "objective" } = {}) {
  if (placementDraft) {
    announce("Place or cancel the current parcel preview first.");
    return;
  }
  const prepared = operationFromAction(action);
  if (!prepared) return;
  const { normalized, operation } = prepared;
  if (SEMANTIC_OPERATIONS.has(operation.type)) {
    openWeave(operation, normalized);
    return;
  }
  const constructionScene = operation.type === "build-structure" ? spatialProjection(projection) : null;
  const constructionSite = operation.type === "build-structure"
    ? resolveMoonSettlementBuildSite(operation.structureType)
    : "";
  if (constructionSite) {
    selectedTarget = null;
    const existing = list(constructionScene.structures).find((record) => record.siteId === constructionSite || record.slot === constructionSite);
    operation.placement = placementPayload({
      siteId: constructionSite,
      ...normalizeMoonSettlementPlacement(existing?.placement, { siteId: constructionSite })
    });
  }
  const quote = quoteSettlementOperation(state, operation, { at: new Date() });
  pendingOperation = { operation, quote, label: normalized.label, source };
  setMode("inspect", { announceMode: false });
  if (constructionSite) {
    beginPlacement(constructionSite, { ...operation.placement, structureType: operation.structureType });
    render();
    elements.canvasHost?.focus?.({ preventScroll: true });
    const activeSite = spatialProjection(projection).activeSite;
    worldRenderer.focus(activeSite?.targetId || `site-${constructionSite}`, { distance: 12.5 });
    announce(`${normalized.label} ready. Choose a highlighted parcel cell, rotate if needed, then Place.`);
  } else {
    renderInspect();
    announce(`${normalized.label} preview ready. Review the exact consequences, then Apply.`);
  }
}

function activatePrimaryAction({ source = "button", bypassHold = false, expectedKey = "" } = {}) {
  const descriptor = derivePrimaryAction(spatialProjection(projection));
  if (!descriptor || descriptor.disabled) {
    announce(descriptor?.status || "No settlement action is available here.");
    return false;
  }
  if (expectedKey && descriptor.key !== expectedKey) {
    announce("The settlement changed before that action completed. Try again.");
    render();
    return false;
  }
  if (descriptor.behavior === "hold" && !bypassHold) {
    startPrimaryActionHold(source);
    return true;
  }
  if (descriptor.command === "place") return confirmPlacement();
  if (descriptor.command === "apply-pending") {
    const operation = pendingOperation?.operation;
    if (!operation) return false;
    const applied = applyOperationNow(operation);
    if (applied) {
      pendingOperation = null;
      selectedTarget = null;
      setMode("walk", { announceMode: false });
    }
    return applied;
  }
  if (descriptor.command === "close-inspect") {
    pendingOperation = null;
    selectedTarget = null;
    setMode("walk");
    return true;
  }
  if (descriptor.command !== "action" || !descriptor.action) return false;

  const prepared = operationFromAction(descriptor.action);
  if (!prepared) return false;
  if (prepared.operation.type === "sample-regolith") {
    return applyOperationNow(prepared.operation);
  }
  if (SEMANTIC_OPERATIONS.has(prepared.operation.type) || prepared.operation.type === "build-structure") {
    prepareOperation(descriptor.action, { source });
    return true;
  }
  return applyOperationNow(prepared.operation);
}

function updatePrimaryActionHold(progress) {
  const bounded = Math.max(0, Math.min(100, Math.round(progress)));
  if (elements.primaryActionProgress) elements.primaryActionProgress.value = bounded;
  if (elements.primaryActionValue) elements.primaryActionValue.textContent = `${bounded}%`;
  if (elements.primaryAction) elements.primaryAction.setAttribute("aria-valuetext", `${bounded} percent complete`);
}

function cancelPrimaryActionHold({ restore = true } = {}) {
  if (primaryActionHoldFrame) cancelAnimationFrame(primaryActionHoldFrame);
  const wasHolding = primaryActionHolding;
  primaryActionHoldFrame = 0;
  primaryActionHoldStartedAt = 0;
  primaryActionHoldKey = "";
  primaryActionHolding = false;
  delete elements.app.dataset.actionState;
  if (restore) renderPrimaryAction(spatialProjection(projection));
  return wasHolding;
}

function completePrimaryActionHold() {
  if (!primaryActionHolding) return false;
  const expectedKey = primaryActionHoldKey;
  if (primaryActionHoldFrame) cancelAnimationFrame(primaryActionHoldFrame);
  primaryActionHoldFrame = 0;
  primaryActionHolding = false;
  primaryActionHoldStartedAt = 0;
  primaryActionHoldKey = "";
  delete elements.app.dataset.actionState;
  updatePrimaryActionHold(100);
  return activatePrimaryAction({ source: "hold", bypassHold: true, expectedKey });
}

function startPrimaryActionHold(source = "keyboard") {
  const descriptor = derivePrimaryAction(spatialProjection(projection));
  if (!descriptor || descriptor.disabled) return false;
  if (descriptor.behavior !== "hold") return activatePrimaryAction({ source, bypassHold: true });
  if (settings.holdMode === "toggle" && primaryActionHolding) {
    cancelPrimaryActionHold();
    announce("Scan cancelled.");
    return false;
  }
  if (primaryActionHolding) return true;
  primaryActionDescriptor = descriptor;
  primaryActionHolding = true;
  primaryActionHoldStartedAt = performance.now();
  primaryActionHoldKey = descriptor.key;
  elements.app.dataset.actionState = "holding";
  if (elements.primaryActionStatus) elements.primaryActionStatus.textContent = descriptor.activeStatus;
  if (elements.primaryActionKey) elements.primaryActionKey.textContent = settings.holdMode === "toggle" ? "E" : "Hold E";
  if (elements.primaryActionLabel) elements.primaryActionLabel.textContent = "·";
  updatePrimaryActionHold(0);

  const tick = (now) => {
    if (!primaryActionHolding) return;
    const progress = ((now - primaryActionHoldStartedAt) / PRIMARY_ACTION_HOLD_MS) * 100;
    updatePrimaryActionHold(progress);
    if (progress >= 100) {
      completePrimaryActionHold();
      return;
    }
    primaryActionHoldFrame = requestAnimationFrame(tick);
  };
  primaryActionHoldFrame = requestAnimationFrame(tick);
  return true;
}

function defaultWeaveGraph(type) {
  if (type === "separate-regolith") {
    return {
      atoms: [
        { id: "regolith", word: "Regolith", material: "regolith", sigil: "Rg", position: [0, .15, 0], radius: .34 },
        { id: "earth", word: "Earth", material: "earth", sigil: "Ea", position: [-1.05, -.12, .18], radius: .3 },
        { id: "dust", word: "Dust", material: "dust", sigil: "Du", position: [1.05, -.18, -.12], radius: .26 }
      ],
      bonds: [
        { id: "regolith-earth", from: "regolith", to: "earth", tier: "reinforced" },
        { id: "regolith-dust", from: "regolith", to: "dust", tier: "weak" }
      ]
    };
  }
  if (type === "craft-bean-pod") {
    return {
      atoms: [
        { id: "soil", word: "Living Soil", material: "soil", sigil: "So", position: [-.95, -.15, .08], radius: .31 },
        { id: "seed", word: "Bean Seed", material: "seed", sigil: "Se", position: [.95, .05, -.08], radius: .28 },
        { id: "life", word: "Life", material: "life", sigil: "Li", position: [0, .65, .1], radius: .26 }
      ],
      bonds: [
        { id: "soil-life", from: "soil", to: "life", tier: "stable" },
        { id: "seed-life", from: "seed", to: "life", tier: "stable" }
      ]
    };
  }
  return {
    atoms: [
      { id: "greenhouse", word: "Greenhouse", material: "life", sigil: "Gh", position: [0, .15, 0], radius: .36 },
      { id: "dust", word: "Dust", material: "dust", sigil: "Du", position: [1.05, -.2, 0], radius: .25 },
      { id: "air", word: "Air", material: "air", sigil: "Ai", position: [-1.05, -.1, .05], radius: .25 }
    ],
    bonds: [
      { id: "greenhouse-dust", from: "greenhouse", to: "dust", tier: "weak" },
      { id: "greenhouse-air", from: "greenhouse", to: "air", tier: "reinforced" }
    ]
  };
}

function normalizeDraftGraph(draft, operation) {
  const graph = draft?.graph || draft?.weave || draft?.structure || null;
  if (graph && list(graph.atoms || graph.nodes).length) return graph;
  if (list(draft?.atoms).length) {
    const atoms = draft.atoms.map((atom, index) => ({
      ...atom,
      word: atom.component || atom.word || atom.name,
      position: atom.position || [
        Math.cos(index * Math.PI * 2 / Math.max(2, draft.atoms.length)) * 1.05,
        index % 2 ? .18 : -.18,
        Math.sin(index * Math.PI * 2 / Math.max(2, draft.atoms.length)) * 1.05
      ]
    }));
    const bonds = list(draft.bonds).map((bond) => ({
      ...bond,
      from: bond.from || bond.a,
      to: bond.to || bond.b
    }));
    return { atoms, bonds };
  }
  return defaultWeaveGraph(operation.type);
}

function openWeave(operation, action = {}) {
  let draft;
  try {
    const target = operation.type === "craft-bean-pod"
      ? { kind: "recipe", recipeId: "bean-pod" }
      : operation.type === "clear-drift"
        ? { kind: "hazard", targetId: operation.hazardId || projection?.drift?.[0]?.id }
        : { kind: "concept", targetId: "concept-regolith-sample" };
    draft = createStructureDraft(state, target);
  } catch {
    draft = null;
  }
  activeDraftOperation = operation;
  activeDraft = draft && typeof draft === "object"
    ? { ...draft, graph: normalizeDraftGraph(draft, operation) }
    : { kind: operation.type, graph: defaultWeaveGraph(operation.type) };
  selectedDraftTargetId = null;
  activeDraftTested = false;
  if (elements.developerToolkit) elements.developerToolkit.open = false;
  weaveReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  setMode("weave", { announceMode: false });
  updateDraftPreview();
  weaveRenderer.sync({ ...projection, weaveGraph: activeDraft.graph, structureDraft: activeDraft, draft: activeDraft, selectedId: null });
  elements.weaveLayer?.focus();
  announce("Weave paused the settlement. Select an atom or bond, then tune and Test the exact result.");
}

function draftCollections() {
  const graph = activeDraft?.graph || {};
  const atoms = list(graph.atoms || graph.nodes || activeDraft?.atoms);
  const bonds = list(graph.bonds || graph.edges || activeDraft?.bonds);
  return { graph, atoms, bonds };
}

function mutateDraftTarget(tool) {
  if (!activeDraft) return;
  const { graph, bonds } = draftCollections();
  if (!selectedDraftTargetId) {
    announce("Select a bond or atom first.");
    return;
  }
  const domainBonds = list(activeDraft.bonds);
  const bond = domainBonds.find((entry) => String(entry.id) === selectedDraftTargetId)
    || bonds.find((entry) => String(entry.id) === selectedDraftTargetId);
  if (!bond) {
    announce("That atom is focused. Choose a connection to change its tier.");
    weaveRenderer.focus(selectedDraftTargetId, { distance: 1.7 });
    return;
  }
  const tiers = ["weak", "stable", "reinforced"];
  let tier = tiers.includes(String(bond.tier).toLowerCase()) ? String(bond.tier).toLowerCase() : "stable";
  if (tool === "weaken") tier = tiers[Math.max(0, tiers.indexOf(tier) - 1)];
  if (tool === "strengthen") tier = tiers[Math.min(tiers.length - 1, tiers.indexOf(tier) + 1)];
  const separate = tool === "separate";
  const join = tool === "join" || tool === "connect";
  const nextDomainBonds = domainBonds.map((entry) => String(entry.id) === selectedDraftTargetId
    ? { ...entry, tier, removed: separate ? true : join ? false : entry.removed === true }
    : entry);
  const nextDraft = { ...activeDraft, bonds: nextDomainBonds };
  activeDraft = { ...nextDraft, graph: normalizeDraftGraph({ ...nextDraft, graph: null }, activeDraftOperation) };
  activeDraftTested = false;
  updateDraftPreview();
  weaveRenderer.sync({ ...projection, weaveGraph: activeDraft.graph, structureDraft: activeDraft, selectedId: selectedDraftTargetId });
  announce(`${titleCase(tool)}: ${titleCase(tier)} bond. Test to preview the result.`);
}

function draftPreviewResult() {
  try {
    const preview = previewStructureDraft(state, activeDraft);
    if (preview && typeof preview === "object") return preview;
  } catch {
    // Domain preview can reject an intentionally incomplete visual draft.
  }
  return quoteSettlementOperation(state, activeDraftOperation, { draft: activeDraft, at: new Date() });
}

function updateDraftPreview() {
  if (!activeDraft) return;
  const preview = draftPreviewResult();
  activeDraft.preview = preview;
  const { atoms, bonds } = draftCollections();
  const selectedBond = bonds.find((entry) => String(entry.id) === selectedDraftTargetId);
  const selectedAtom = atoms.find((entry) => String(entry.id) === selectedDraftTargetId);
  const bondValue = { weak: 1, stable: 2, reinforced: 3 }[String(selectedBond?.tier || "").toLowerCase()] || 0;
  const selectedName = selectedBond
    ? `${titleCase(selectedBond.from || selectedBond.a)}–${titleCase(selectedBond.to || selectedBond.b)} bond`
    : selectedAtom?.word || selectedAtom?.component || selectedAtom?.name || "No bond selected";
  if (elements.weaveTitle) elements.weaveTitle.textContent = titleCase(activeDraftOperation?.type || "Structure Weave");
  if (elements.weaveSelectionTitle) {
    elements.weaveSelectionTitle.textContent = selectedName;
  }
  if (elements.weaveCohesion) elements.weaveCohesion.textContent = `Cohesion ${numeric(preview?.cohesion?.spent)} / ${numeric(preview?.cohesion?.available)}`;
  if (elements.weaveQuality) elements.weaveQuality.textContent = titleCase(preview?.quality || "stable");
  if (elements.weaveBondTier) elements.weaveBondTier.textContent = selectedBond ? (selectedBond.removed ? "Separated" : titleCase(selectedBond.tier || "stable")) : "—";
  if (elements.weaveStressTier) elements.weaveStressTier.textContent = selectedBond
    ? `${titleCase(selectedBond.tier || "weak")} threshold`
    : "Select a bond";
  if (elements.weaveSelectionCost) elements.weaveSelectionCost.textContent = selectedBond
    ? selectedBond.removed ? `${bondValue} cohesion released` : `${bondValue} cohesion committed`
    : "0 cohesion";
  if (elements.weaveSelectionCopy) elements.weaveSelectionCopy.textContent = selectedBond
    ? selectedBond.removed
      ? "This seam is absent from the Tested structure and cannot carry stress."
      : "This seam carries exactly the displayed tier and cohesion cost."
    : selectedAtom
      ? "Shift-click or Focus approaches this atom without changing the draft."
      : "Select a highlighted atom or bond. Generous hit regions prefer the nearest visible candidate.";
  if (elements.weaveSummary) {
    elements.weaveSummary.textContent = preview?.summary || preview?.result || "Tune the visible bonds, then Test the deterministic outcome.";
  }
  renderWeaveConsequences(preview);
  if (elements.weaveApply) {
    elements.weaveApply.disabled = !activeDraftTested || !quoteAllowed(preview);
    elements.weaveApply.textContent = activeDraftOperation?.type === "craft-bean-pod" ? "Apply crop pod" : "Apply Weave";
  }
  renderAccessibleGraph();
}

function renderAccessibleGraph() {
  if (!elements.weaveGraph || !activeDraft) return;
  const { atoms, bonds } = draftCollections();
  elements.weaveGraph.replaceChildren();
  const atomList = document.createElement("ul");
  atomList.setAttribute("aria-label", "Atoms and stable macro-nodes");
  atoms.forEach((atom) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.draftTarget = atom.id;
    button.textContent = `${atom.word || atom.name || atom.label || titleCase(atom.id)} atom`;
    button.setAttribute("aria-pressed", String(selectedDraftTargetId === String(atom.id)));
    item.append(button);
    atomList.append(item);
  });
  const bondList = document.createElement("ul");
  bondList.setAttribute("aria-label", "Bonds");
  bonds.forEach((bond) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.draftTarget = bond.id;
    button.textContent = `${titleCase(bond.tier || "stable")} bond from ${bond.from} to ${bond.to}`;
    button.setAttribute("aria-pressed", String(selectedDraftTargetId === String(bond.id)));
    item.append(button);
    bondList.append(item);
  });
  elements.weaveGraph.append(atomList, bondList);
  document.querySelectorAll("[data-weave-edit]").forEach((button) => {
    button.disabled = button.dataset.weaveEdit !== "cycle" && !selectedDraftTargetId;
  });
}

function applyDraft() {
  if (!activeDraft || !activeDraftOperation || !activeDraftTested || busy) {
    if (activeDraft && !activeDraftTested) announce("Test the draft before Apply.");
    return;
  }
  busy = true;
  try {
    let result;
    try {
      result = applyStructureDraft(state, activeDraft, {
        operationId: activeDraftOperation.id,
        at: new Date()
      });
    } catch {
      result = null;
    }
    if (!result?.applied) {
      result = applySettlementOperation(state, activeDraftOperation, { draft: activeDraft, at: new Date() });
    }
    if (!result?.applied) {
      announce(result?.reason || "The structure is not ready to Apply.");
      recordTimeline("retry", activeDraftOperation.type);
      return;
    }
    const operationType = activeDraftOperation.type;
    activeDraft = null;
    activeDraftOperation = null;
    selectedDraftTargetId = null;
    activeDraftTested = false;
    saveState(result.state, { eventKey: operationType });
    setMode("walk", { announceMode: false });
    announce(result.quote?.result || `${titleCase(operationType)} transformed the settlement.`);
  } finally {
    busy = false;
  }
}

function cancelDraft() {
  if (activeDraft) {
    try { cancelStructureDraft(state, activeDraft); } catch { /* draft is ephemeral */ }
  }
  activeDraft = null;
  activeDraftOperation = null;
  selectedDraftTargetId = null;
  activeDraftTested = false;
  weaveRenderer.sync({ revision: state.revision, structures: [], weave: null });
  setMode("walk");
  announce("Draft cancelled. The settlement is unchanged.");
}

function setWeaveBackgroundInert(inert) {
  for (const child of elements.app.children) {
    if (child === elements.weaveLayer) continue;
    child.toggleAttribute("inert", inert);
    child.setAttribute("aria-hidden", String(inert));
  }
  for (const external of [document.querySelector(".skip-link"), elements.developerToolkit]) {
    external?.toggleAttribute("inert", inert);
    external?.setAttribute("aria-hidden", String(inert));
  }
}

function setMode(nextMode, { announceMode = true } = {}) {
  const normalized = MODES.has(nextMode) ? nextMode : "walk";
  if (normalized === "weave" && !activeDraft) return mode;
  const wasWeave = mode === "weave";
  mode = normalized;
  elements.app.dataset.mode = mode;
  document.querySelectorAll("[data-mode-action]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.modeAction === mode));
  });
  if (elements.inspectPanel) elements.inspectPanel.hidden = mode !== "inspect";
  if (elements.weaveLayer) {
    elements.weaveLayer.hidden = mode !== "weave";
    elements.weaveLayer.setAttribute("aria-hidden", String(mode !== "weave"));
  }
  setWeaveBackgroundInert(mode === "weave");
  if (wasWeave && mode !== "weave") {
    const restoreTarget = weaveReturnFocus;
    weaveReturnFocus = null;
    queueMicrotask(() => {
      if (restoreTarget?.isConnected) restoreTarget.focus();
      else elements.canvasHost?.focus();
    });
  }
  worldRenderer.setMode(mode === "weave" ? "inspect" : mode);
  if (mode === "weave") weaveRenderer.setMode("weave");
  renderRollback();
  recordTimeline("mode", mode);
  if (announceMode) announce(`${titleCase(mode)} mode.`);
  return mode;
}

function foundingComplete() {
  const founding = projection?.founding || state?.founding || state?.foundingChoices || {};
  const chosen = ["power", "shelter", "signal"].filter((slot) => founding?.[slot] || founding?.[`${slot}ChoiceId`]);
  return chosen.length === 3;
}

function renderFounding() {
  if (!elements.foundingSheet) return;
  const founding = projection?.founding || state?.founding || state?.foundingChoices || {};
  const groups = ["power", "shelter", "signal"];
  const chosenValue = (slot) => {
    const value = founding?.[slot] ?? founding?.[`${slot}ChoiceId`];
    return typeof value === "string" ? value : value?.choiceId || value?.id || "";
  };
  const complete = foundingComplete();
  const currentGroup = pendingFounding?.slot || foundingGroupOverride || groups.find((slot) => !chosenValue(slot)) || "signal";
  elements.foundingSheet.hidden = complete || Boolean(placementDraft);
  document.querySelectorAll("[data-founding-group]").forEach((group) => {
    group.hidden = group.dataset.foundingGroup !== currentGroup;
  });
  if (elements.foundingStep) elements.foundingStep.textContent = `${titleCase(currentGroup)} · ${groups.indexOf(currentGroup) + 1} of 3`;
  if (elements.foundingConfirm) {
    elements.foundingConfirm.disabled = !pendingFounding || pendingFounding.slot !== currentGroup;
    elements.foundingConfirm.textContent = pendingFounding ? `Place ${pendingFounding.label}` : "Place module";
  }
  if (elements.foundingBack) elements.foundingBack.disabled = groups.indexOf(currentGroup) === 0;
  document.querySelectorAll("[data-founding-choice]").forEach((button) => {
    const group = button.dataset.foundingGroup || button.closest("[data-founding-group]")?.dataset.foundingGroup || "";
    const choice = button.dataset.foundingChoice;
    const selected = (pendingFounding?.slot === group && pendingFounding?.choiceId === choice) || chosenValue(group) === choice;
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderResources() {
  const goods = projection?.goods || state?.goods || {};
  document.querySelectorAll("[data-good]").forEach((element) => {
    const key = element.dataset.good;
    const value = numeric(goods[key] ?? goods[titleCase(key)] ?? goods[key?.toLowerCase()], 0);
    const output = element.matches("output") ? element : element.querySelector("output, [data-good-value], b");
    if (output) output.textContent = String(value);
    else element.textContent = `${titleCase(key)} ${value}`;
  });
  const matter = numeric(projection?.matter ?? projection?.Matter?.current ?? state?.matter ?? state?.Matter, 0);
  if (elements.matter) elements.matter.textContent = String(matter);
  const storageValue = projection?.storage || state?.storage || {};
  const used = numeric(storageValue.used ?? projection?.storageUsed, Object.values(goods).reduce((sum, value) => sum + numeric(value), 0));
  const capacity = numeric(storageValue.capacity ?? projection?.storageCapacity,
    Object.values(projection?.capacities || state?.capacities || {}).reduce((sum, value) => sum + numeric(value), 0) || 24);
  if (elements.storage) elements.storage.textContent = String(used);
  if (elements.storageCapacity) elements.storageCapacity.textContent = String(capacity);
}

function renderObjective() {
  const objective = projection?.objective || {};
  const stage = String(projection?.stage || state?.stage || "founding");
  const authoredObjectives = {
    landing: ["Choose how this home begins", "Preview Power, Shelter, and Signal. Every founding route reaches Living Ground with a different port pattern."],
    "vault-repair": ["Recover the living starter", "Repair the damaged biological vault without losing its preserved Life."],
    ground: ["Read the ground", "Sample nearby Regolith so its useful and harmful meanings can be seen."],
    "first-weave": ["Separate Earth from Dust", "Enter Weave, loosen only the Dust seam, and preserve usable Earth."],
    construction: ["Build the living home", "Use the separated Earth and salvage to place the Processor, Storage, Reservoir, Shelter, and Greenhouse."],
    cultivation: ["Seat six living crop pods", "Join Living Soil and bean seed one pod at a time. Each Tested pod remains a physical instance."],
    "cultivation-ready": ["Begin the first harvest", "Start one visible greenhouse batch. Storage will safely pause it if full."],
    growth: ["Harvest, then clear the Drift", "Collect the finished beans and Separate predictable Regolith Dust from the Processor."],
    "proof-ready": ["Prove Living Ground", "The home is stable, fed, and clean. Commit the Proof that Matter can host Life."],
    "open-play": ["Living Ground endures", "Inspect, improve, or spend the recovered Matter. The landmark and all authored choices remain." ]
  };
  const [authoredTitle, authoredCopy] = authoredObjectives[stage] || [titleCase(stage), "Build a living foothold from the matter already here."];
  if (elements.objectiveTitle) elements.objectiveTitle.textContent = objective.title || projection?.stageTitle || authoredTitle;
  if (elements.objectiveCopy) elements.objectiveCopy.textContent = objective.copy || objective.description || projection?.guidance || authoredCopy;
  if (elements.objectiveProgress) {
    const total = Math.max(1, numeric(objective.total ?? projection?.progress?.total, 7));
    const completed = numeric(objective.completed ?? projection?.progress?.completed,
      Math.round(numeric(projection?.proof?.completion, 0) * total));
    elements.objectiveProgress.textContent = `${completed} / ${total}`;
    const progressTrack = document.querySelector("#objectiveProgressBar")?.parentElement;
    progressTrack?.setAttribute("aria-valuenow", String(completed));
    progressTrack?.setAttribute("aria-valuemax", String(total));
    document.querySelector("#objectiveProgressBar")?.style.setProperty("--progress", `${Math.min(100, completed / total * 100)}%`);
  }
  const host = elements.objectiveActions || document.querySelector("#objectiveActions") || (() => {
    const created = document.createElement("div");
    created.id = "objectiveActions";
    created.className = "settlement-objective__actions";
    elements.objectiveCopy?.after(created);
    return created;
  })();
  host.replaceChildren();
  availableActions().slice(0, 5).forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "settlement-action";
    button.dataset.settlementAction = action.type;
    button.textContent = action.label;
    button.disabled = Boolean(placementDraft);
    button.addEventListener("click", () => prepareOperation(action));
    host.append(button);
  });
  const weaveAction = availableActions().some((action) => SEMANTIC_OPERATIONS.has(action.type));
  const weaveModeButton = document.querySelector("[data-mode-action='weave']");
  if (weaveModeButton) weaveModeButton.disabled = !weaveAction && !activeDraft;
}

function renderWorldState(sceneState) {
  const stage = String(projection?.stage || "landing");
  const stagePresentation = {
    landing: ["Landing Site", "Founding the first power route"],
    "vault-repair": ["Home Seed", "Biological vault needs repair"],
    ground: ["Ground Survey", "Regolith sample available"],
    "first-weave": ["Semantic Survey", "Earth and Dust identified"],
    construction: ["Settlement Build", "Growing one structure at a time"],
    cultivation: ["Living Systems", "Greenhouse calibration underway"],
    "cultivation-ready": ["Living Systems", "First crop batch is ready to begin"],
    growth: ["Living Systems", "Greenhouse and processor are active"],
    "proof-ready": ["Living Ground", "Proof conditions are stable"],
    "open-play": ["Living Ground", "World Seed cradle awakened"]
  };
  const [phase, status] = stagePresentation[stage] || [titleCase(stage), "Settlement systems active"];
  if (elements.expeditionPhase) elements.expeditionPhase.textContent = phase;
  if (elements.worldStateText) {
    elements.worldStateText.textContent = sceneState?.activeSite
      ? `${sceneState.activeSite.name} marked`
      : status;
  }
}

function selectedStructure() {
  const operationTargetId = pendingOperation?.operation?.type === "repair-vault" ? "starter-vault"
    : pendingOperation?.operation?.type === "start-production" ? "structure-greenhouse"
      : pendingOperation?.operation?.type === "clear-drift" ? projection?.drift?.[0]?.structureId
        : null;
  const targetId = selectedTarget?.id || operationTargetId;
  if (!targetId) return null;
  const structures = list(projection?.structures || projection?.structureInstances || state?.structures);
  return structures.find((structure) => String(structure.id || structure.instanceId) === String(targetId)) || selectedTarget;
}

function renderInspect() {
  if (!elements.inspectPanel) return;
  const structure = selectedStructure();
  const quote = pendingOperation?.quote;
  if (elements.inspectTitle) elements.inspectTitle.textContent = pendingOperation?.label || structure?.name || structure?.title || "Settlement change";
  if (elements.inspectConcern) elements.inspectConcern.textContent = quote?.summary || quote?.worldChanges?.[0] || structure?.concern || "No urgent concern.";
  if (elements.inspectProduction) elements.inspectProduction.textContent = structure?.production?.label || structure?.production || quote?.result || "Ready for inspection.";
  if (elements.inspectQuality) elements.inspectQuality.textContent = titleCase(quote?.quality || structure?.quality || "stable");
  if (elements.inspectDrift) {
    const drift = list(projection?.drift).find((entry) => entry.structureId === structure?.id);
    elements.inspectDrift.textContent = drift ? `${drift.kind} · ${titleCase(drift.stressTier)} stress` : "None";
  }
  if (elements.inspectPorts) {
    elements.inspectPorts.replaceChildren();
    const ports = list(structure?.ports);
    if (!ports.length) {
      const value = document.createElement("span");
      value.textContent = "No external ports";
      elements.inspectPorts.append(value);
    } else {
      ports.forEach((port) => {
        const value = document.createElement("span");
        value.className = "settlement-port";
        value.dataset.portType = String(port.type || port.kind || "material").toLowerCase();
        value.textContent = `${titleCase(port.type || port.kind)} · ${port.connected ? "connected" : "open"}`;
        elements.inspectPorts.append(value);
      });
    }
  }
  if (elements.inspectStructureButton) {
    elements.inspectStructureButton.hidden = !pendingOperation;
    elements.inspectStructureButton.disabled = !pendingOperation || !quoteAllowed(quote);
    elements.inspectStructureButton.textContent = pendingOperation ? `Apply ${pendingOperation.label}` : "Open structure";
  }
  const consequenceHost = elements.inspectPanel.querySelector("[data-inspect-consequences]") || (() => {
    const listNode = document.createElement("ul");
    listNode.dataset.inspectConsequences = "";
    listNode.className = "settlement-consequences";
    elements.inspectStructureButton?.before(listNode);
    return listNode;
  })();
  renderConsequences(consequenceHost, quote || { summary: "Inspection does not change the settlement." });
}

function renderProof() {
  if (!elements.proofRibbon) return;
  const proofs = list(projection?.proofs || state?.proofs);
  const proof = proofs.find((entry) => String(entry.id || entry.proofId) === "living-ground")
    || projection?.proof
    || state?.proofs?.["living-ground"];
  const earned = Boolean(proof?.earned || proof?.awarded || proof?.completed || proof?.awardedAt || projection?.livingGroundComplete);
  elements.proofRibbon.hidden = !earned;
  elements.proofRibbon.dataset.earned = String(earned);
  if (earned) elements.proofRibbon.querySelector("[data-proof-copy]")?.replaceChildren(document.createTextNode("Matter can host Life"));
}

function renderRollback() {
  const rollback = state?.rollbackReceipt || state?.rollback || projection?.rollback || (projection?.canRollback ? { available: true } : null);
  const available = mode !== "weave" && !placementDraft && Boolean(rollback?.available ?? rollback?.operationId ?? rollback?.receiptId ?? rollback);
  if (elements.rollbackBar) elements.rollbackBar.hidden = elements.app.dataset.ui === "visor" || !available;
  if (elements.rollbackButton) elements.rollbackButton.disabled = !available;
  if (elements.settingsRollback) {
    elements.settingsRollback.hidden = !available;
    elements.settingsRollback.disabled = !available;
  }
  const lastReceipt = list(state?.receipts).at(-1);
  const title = document.querySelector("#rollbackTitle");
  const copy = document.querySelector("#rollbackCopy");
  if (title && lastReceipt) title.textContent = `${titleCase(lastReceipt.type)} applied`;
  if (copy && available) copy.textContent = "The exact previous expedition revision remains recoverable until the next dependent action.";
}

function renderPlacement() {
  if (!elements.placementBar) return;
  const active = Boolean(placementDraft);
  elements.placementBar.hidden = !active;
  elements.placementBar.setAttribute("aria-hidden", String(!active));
  if (!active) {
    const prompt = document.querySelector("#contextPromptText");
    if (prompt) prompt.textContent = selectedTarget ? `Inspect ${selectedTarget.name || titleCase(selectedTarget.id)}` : "Inspect highlighted site";
    return;
  }
  const quote = pendingFounding?.quote || pendingOperation?.quote;
  const cell = labelMoonSettlementParcelCell(placementDraft.cellX, placementDraft.cellZ);
  const valid = quoteAllowed(quote);
  elements.placementBar.dataset.valid = String(valid);
  if (elements.placementTitle) elements.placementTitle.textContent = placementOwnerLabel();
  if (elements.placementStatus) {
    elements.placementStatus.textContent = valid
      ? `Cell ${cell} · ${placementDraft.rotationQuarter * 90}° · 3 × 3 footprint · Valid`
      : `Cell ${cell} · ${placementDraft.rotationQuarter * 90}° · ${titleCase(quote?.reason || "Invalid")}`;
  }
  if (elements.placementConfirm) {
    elements.placementConfirm.disabled = !valid;
    elements.placementConfirm.textContent = `Place at ${cell}`;
  }
  if (elements.inspectStructureButton && pendingOperation?.operation?.type === "build-structure") {
    elements.inspectStructureButton.textContent = `Place at ${cell}`;
    elements.inspectStructureButton.disabled = !valid;
  }
  const prompt = document.querySelector("#contextPromptText");
  if (prompt) prompt.textContent = `Choose cell ${cell} · Q/R rotate · E place`;
  if (elements.worldStateText) elements.worldStateText.textContent = `${placementOwnerLabel()} footprint snapped to ${cell}`;
}

function renderPrimaryAction(sceneState = spatialProjection(projection)) {
  if (!elements.contextPrompt || !elements.primaryAction) return;
  const descriptor = derivePrimaryAction(sceneState);
  primaryActionDescriptor = descriptor;
  const visible = Boolean(descriptor);
  elements.contextPrompt.hidden = !visible;
  if (!visible) {
    delete elements.app.dataset.actionTone;
    if (!primaryActionHolding) delete elements.app.dataset.actionState;
    return;
  }
  elements.primaryAction.disabled = Boolean(descriptor.disabled);
  elements.primaryAction.dataset.command = descriptor.command;
  elements.primaryAction.dataset.behavior = descriptor.behavior;
  elements.app.dataset.actionTone = descriptor.tone || "ready";
  if (!primaryActionHolding) {
    delete elements.app.dataset.actionState;
    if (elements.primaryActionStatus) elements.primaryActionStatus.textContent = descriptor.status;
    if (elements.primaryActionKey) elements.primaryActionKey.textContent = "E";
    if (elements.primaryActionLabel) elements.primaryActionLabel.textContent = descriptor.label;
    if (elements.primaryActionValue) elements.primaryActionValue.textContent = "";
    if (elements.primaryActionProgress) elements.primaryActionProgress.value = 0;
    elements.primaryAction.removeAttribute("aria-valuetext");
  }
  if (elements.primaryActionDetail) elements.primaryActionDetail.textContent = descriptor.detail;
  elements.primaryAction.setAttribute("aria-label", descriptor.behavior === "hold"
    ? `${descriptor.label}. Hold to activate, or press Enter.`
    : descriptor.label);
}

function renderRendererState() {
  const rendererState = {
    ...projection,
    revision: state.revision,
    selectedId: selectedTarget?.id || null
  };
  if (activeDraft) rendererState.structureDraft = activeDraft;
  const sceneState = spatialProjection(rendererState);
  worldRenderer.sync(sceneState);
  if (worldRendererReady && !openingFocusApplied) requestAnimationFrame(() => focusOpeningSettlementView());
  renderWorldState(sceneState);
  elements.app.dataset.stage = String(projection?.stage || state?.stage || "founding");
  elements.app.dataset.activeSite = sceneState.activeSite?.siteId || "";
  return sceneState;
}

function render() {
  renderFounding();
  renderResources();
  renderObjective();
  renderInspect();
  renderProof();
  renderRollback();
  const sceneState = renderRendererState();
  renderPlacement();
  renderPrimaryAction(sceneState);
  scheduleProductionReadiness();
  document.title = `Moon Settlement Lab · ${elements.objectiveTitle?.textContent || "Living Ground"}`;
}

function handleTargetSelection(target, detail = {}) {
  if (target?.kind === "parcel-cell") {
    if (!placementDraft) {
      announce("Choose a structure before selecting a parcel cell.");
      return;
    }
    if (!target.valid) {
      announce(`Cell ${target.label} is an edge guide. The full 3 by 3 footprint would leave the parcel.`);
      return;
    }
    setPlacementCell(Number(target.cellX), Number(target.cellZ));
    return;
  }
  if (placementDraft) {
    announce("Choose a highlighted parcel cell, or use Cancel to leave placement.");
    return;
  }
  selectedTarget = target;
  selectedDraftTargetId = String(target?.id || "");
  if (mode === "weave") {
    updateDraftPreview();
    weaveRenderer.sync({ ...projection, weaveGraph: activeDraft?.graph, structureDraft: activeDraft, selectedId: selectedDraftTargetId });
    if (detail?.originalEvent?.shiftKey) weaveRenderer.focus(target, { distance: 1.45 });
    announce(`${target?.name || target?.sigil || titleCase(target?.id)} selected.`);
    return;
  }
  pendingOperation = null;
  if (mode === "inspect") setMode("walk", { announceMode: false });
  render();
  announce(`${target?.name || titleCase(target?.id)} selected. Double-click to inspect.`);
}

function handleTargetInspect(target, detail = {}) {
  if (mode === "weave") {
    handleTargetSelection(target, detail);
    weaveRenderer.focus(target, { distance: 1.45 });
    return;
  }
  if (placementDraft || target?.kind === "parcel-cell") {
    handleTargetSelection(target, detail);
    return;
  }
  selectedTarget = target;
  selectedDraftTargetId = String(target?.id || "");
  pendingOperation = null;
  setMode("inspect", { announceMode: false });
  worldRenderer.focus(target, { distance: 9.5 });
  renderInspect();
  renderPrimaryAction(spatialProjection(projection));
  announce(`${target?.name || titleCase(target?.id)} inspected.`);
}

function focusOpeningSettlementView() {
  const openingScene = spatialProjection(projection);
  const focused = worldRenderer.focus(
    projection.stage === "landing" ? "starter-vault" : openingScene.objectiveTargetId || "lander",
    {
      distance: projection.stage === "landing" ? 15.5 : 17.5,
      yaw: 0.78,
      pitch: ["ground", "first-weave"].includes(projection.stage) ? 0.38 : 0.66
    }
  );
  if (worldRendererReady) openingFocusApplied ||= focused;
  return focused;
}

const worldRenderer = createMoonSettlementRenderer({
  host: elements.canvasHost,
  labelLayer: elements.labelLayer || elements.canvasHost,
  quality: settings.quality,
  reducedMotion: settings.reducedMotion,
  onSelect: handleTargetSelection,
  onInspect: handleTargetInspect,
  onMove: () => { lastActivityAt = Date.now(); },
  onModeChange: (nextMode) => {
    if (activeDraft) return;
    if (MODES.has(nextMode) && nextMode !== mode) setMode(nextMode, { announceMode: false });
  },
  onReady: ({ backend }) => {
    elements.app.dataset.renderMode = backend;
    worldRendererReady = true;
    requestAnimationFrame(() => focusOpeningSettlementView());
    setTimeout(() => {
      if (!openingFocusApplied) focusOpeningSettlementView();
    }, 240);
    announce(backend === "three" ? "Moon settlement 3D view ready." : "Moon settlement 2.5D view ready.");
  },
  onError: (error) => {
    console.warn("Moon settlement renderer used its 2.5D fallback.", error);
  }
});

const weaveRenderer = createMoonSettlementRenderer({
  host: elements.weaveHost || elements.canvasHost,
  labelLayer: elements.weaveLabels || elements.weaveHost || elements.canvasHost,
  quality: settings.quality,
  reducedMotion: settings.reducedMotion,
  assets: { low: {}, standard: {} },
  onSelect: handleTargetSelection,
  onInspect: handleTargetInspect,
  onReady: ({ backend }) => {
    if (elements.weaveLayer) elements.weaveLayer.dataset.renderMode = backend;
  },
  onError: (error) => {
    console.warn("Moon Weave renderer used its 2.5D fallback.", error);
  }
});

function bindShell() {
  document.querySelectorAll("[data-mode-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.modeAction;
      if (placementDraft && nextMode !== "inspect") {
        announce("Place or cancel the current parcel preview first.");
        return;
      }
      if (nextMode === "weave" && !activeDraft) {
        const semantic = availableActions().find((action) => SEMANTIC_OPERATIONS.has(action.type));
        if (semantic) prepareOperation(semantic, { source: "mode" });
        else announce("Scan a concern before entering Weave.");
        return;
      }
      setMode(nextMode);
    });
  });

  document.querySelectorAll("[data-founding-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = button.dataset.foundingGroup || button.closest("[data-founding-group]")?.dataset.foundingGroup;
      const choiceId = button.dataset.foundingChoice;
      const placement = placementPayload({
        siteId: slot,
        ...normalizeMoonSettlementPlacement({}, { siteId: slot })
      });
      const operation = { type: "choose-founding", slot, choiceId, placement, id: operationId("choose-founding") };
      const quote = quoteSettlementOperation(state, operation, { at: new Date() });
      if (!quoteAllowed(quote)) {
        announce(quote?.reason || "That founding choice is unavailable.");
        return;
      }
      pendingFounding = {
        slot,
        choiceId,
        operation,
        quote,
        placement,
        label: button.querySelector("strong")?.textContent || titleCase(choiceId)
      };
      selectedTarget = null;
      foundingGroupOverride = slot;
      beginPlacement(slot, placement, button);
      setMode("inspect", { announceMode: false });
      if (elements.foundingConsequence) {
        elements.foundingConsequence.textContent = quote?.summary || quote?.result || `Preview ${pendingFounding.label} and its authored ports.`;
      }
      render();
      elements.canvasHost?.focus?.({ preventScroll: true });
      const activeSite = spatialProjection(projection).activeSite;
      worldRenderer.focus(activeSite?.targetId || `site-${slot}`, { distance: 12.5 });
      announce(`${pendingFounding.label} previewed. Choose a highlighted parcel cell, rotate if needed, then Place.`);
    });
  });

  elements.foundingConfirm?.addEventListener("click", () => {
    if (placementDraft) confirmPlacement();
  });

  elements.foundingBack?.addEventListener("click", () => {
    const groups = ["power", "shelter", "signal"];
    const current = pendingFounding?.slot || groups.find((slot) => {
      const founding = projection?.founding || state?.founding || state?.foundingChoices || {};
      return !(founding?.[slot] || founding?.[`${slot}ChoiceId`]);
    }) || "signal";
    const previous = groups[Math.max(0, groups.indexOf(current) - 1)];
    pendingFounding = null;
    foundingGroupOverride = previous;
    renderFounding();
  });

  elements.inspectStructureButton?.addEventListener("click", () => {
    if (placementDraft && pendingOperation?.operation?.type === "build-structure") {
      confirmPlacement();
      return;
    }
    if (!pendingOperation) return;
    const applied = applyOperationNow(pendingOperation.operation);
    if (applied) {
      pendingOperation = null;
      setMode("walk", { announceMode: false });
    }
  });

  document.querySelector("#inspectClose")?.addEventListener("click", () => {
    if (placementDraft) {
      cancelPlacement();
      return;
    }
    pendingOperation = null;
    selectedTarget = null;
    setMode("walk");
  });

  elements.weaveApply?.addEventListener("click", applyDraft);
  elements.weaveCancel?.addEventListener("click", cancelDraft);
  elements.placementConfirm?.addEventListener("click", confirmPlacement);
  elements.placementCancel?.addEventListener("click", () => cancelPlacement());
  document.querySelectorAll("[data-placement-rotate]").forEach((button) => {
    button.addEventListener("click", () => rotatePlacement(Number(button.dataset.placementRotate) || 1));
  });

  document.querySelectorAll("[data-weave-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      const tool = button.dataset.weaveTool;
      if (tool === "test") {
        activeDraftTested = true;
        updateDraftPreview();
        announce("Test complete. The exact result is ready for review.");
      } else if (tool === "scan") {
        updateDraftPreview();
        announce("Structure scanned. Select a bond to see its deterministic role.");
      } else {
        mutateDraftTarget(tool);
      }
    });
  });

  document.querySelectorAll("[data-weave-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const edit = button.dataset.weaveEdit;
      if (edit === "cycle") {
        const bonds = draftCollections().bonds;
        if (!bonds.length) return;
        const index = bonds.findIndex((bond) => String(bond.id) === selectedDraftTargetId);
        selectedDraftTargetId = String(bonds[(index + 1) % bonds.length].id);
        weaveRenderer.focus(selectedDraftTargetId, { distance: 2 });
        renderAccessibleGraph();
        updateDraftPreview();
        return;
      }
      mutateDraftTarget(edit === "reinforce" ? "strengthen" : edit);
    });
  });

  elements.weaveGraph?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-draft-target]");
    if (!button) return;
    selectedDraftTargetId = button.dataset.draftTarget;
    weaveRenderer.focus(selectedDraftTargetId, { distance: event.shiftKey ? 1.4 : 2.2 });
    updateDraftPreview();
    announce(`${button.textContent} selected.`);
  });

  elements.rollbackButton?.addEventListener("click", () => {
    applyOperationNow({ type: "rollback", id: operationId("rollback") });
  });
  elements.settingsRollback?.addEventListener("click", () => {
    const applied = applyOperationNow({ type: "rollback", id: operationId("rollback") });
    if (applied && elements.settingsPanel) elements.settingsPanel.hidden = true;
  });

  document.querySelectorAll("[data-action='camera-reset']").forEach((button) => {
    button.addEventListener("click", () => {
      worldRenderer.focus("lander", { distance: 30, yaw: Math.PI, pitch: 0.68, resetWorld: true });
      announce("Settlement view reset to the Lander.");
    });
  });

  document.querySelectorAll("[data-open-settings], [data-action='settings-open']").forEach((button) => {
    button.addEventListener("click", () => {
      if (elements.settingsPanel) elements.settingsPanel.hidden = false;
      elements.settingsPanel?.querySelector("button, select, input")?.focus();
    });
  });
  elements.settingsClose?.addEventListener("click", () => { elements.settingsPanel.hidden = true; });
  document.querySelector("#settingsSave")?.addEventListener("click", () => {
    persistSettings();
    if (elements.settingsPanel) elements.settingsPanel.hidden = true;
    announce("Settings saved for this lab.");
  });

  document.querySelector("#proofContinue")?.addEventListener("click", () => {
    if (elements.proofRibbon) elements.proofRibbon.hidden = true;
    setMode("walk", { announceMode: false });
    announce("Living Ground remains as a working landmark. Open home play continues.");
  });

  const settingControls = new Map([
    ["quality", document.querySelector("#settingQuality")],
    ["reducedMotion", document.querySelector("#settingReducedMotion")],
    ["motorAssist", document.querySelector("#settingMotorAssist")],
    ["nonColor", document.querySelector("#settingNonColor")],
    ["subtitles", document.querySelector("#settingSubtitles")],
    ["holdMode", document.querySelector("#settingHoldMode")]
  ]);
  settingControls.forEach((control, key) => {
    if (!control) return;
    if (!(key in settings)) return;
    if (control.type === "checkbox") control.checked = Boolean(settings[key]);
    else control.value = String(settings[key]);
    control.addEventListener("change", () => {
      settings[key] = control.type === "checkbox" ? control.checked : control.value;
      persistSettings();
      if (key === "quality") {
        worldRenderer.quality(settings.quality);
        weaveRenderer.quality(settings.quality);
      }
      if (key === "reducedMotion") {
        worldRenderer.reducedMotion(settings.reducedMotion);
        weaveRenderer.reducedMotion(settings.reducedMotion);
      }
      announce(`${titleCase(key)} updated.`);
    });
  });

  elements.primaryAction?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || primaryActionDescriptor?.behavior !== "hold") return;
    event.preventDefault();
    suppressPrimaryActionClick = true;
    startPrimaryActionHold("pointer");
  });
  elements.primaryAction?.addEventListener("pointerup", () => {
    if (primaryActionHolding && settings.holdMode === "hold") cancelPrimaryActionHold();
    setTimeout(() => { suppressPrimaryActionClick = false; }, 350);
  });
  elements.primaryAction?.addEventListener("pointercancel", () => {
    if (primaryActionHolding) cancelPrimaryActionHold();
    setTimeout(() => { suppressPrimaryActionClick = false; }, 350);
  });
  elements.primaryAction?.addEventListener("pointerleave", () => {
    if (primaryActionHolding && settings.holdMode === "hold") cancelPrimaryActionHold();
  });
  elements.primaryAction?.addEventListener("click", (event) => {
    if (suppressPrimaryActionClick) {
      event.preventDefault();
      suppressPrimaryActionClick = false;
      return;
    }
    activatePrimaryAction({ source: event.detail === 0 ? "keyboard-button" : "button", bypassHold: true });
  });

  document.querySelectorAll("[data-dev-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.devAction;
      if (action === "reset" || action === "safe-reset") {
        storage.reset();
        state = storage.save(createMoonSettlement({ at: new Date() }));
        projection = projectMoonSettlement(state);
        pendingOperation = null;
        pendingFounding = null;
        placementDraft = null;
        delete elements.app.dataset.placing;
        cancelDraft();
        render();
        announce("Disposable settlement save reset safely.");
      }
      if (action === "export-state") {
        await navigator.clipboard?.writeText(storage.exportJson(state));
        announce("Validated settlement state copied.");
      }
      if (action === "export-timeline") {
        await navigator.clipboard?.writeText(exportMoonSettlementTimeline(timeline));
        announce("Privacy-safe playtest timeline copied.");
      }
      if (action === "resolve-batch" || action === "next-milestone") {
        const result = resolveProductionBatch(state, { at: new Date(Date.now() + 10 * 60_000), operationId: operationId("resolve-production") });
        if (result?.applied) saveState(result.state, { eventKey: "resolve-production" });
        else announce(result?.reason || "No production batch is ready.");
      }
      if (action === "add-matter" || action === "add-resources") {
        const edited = structuredClone(state);
        const grants = { Regolith: 20, Soil: 6, Biomass: 6, Parts: 20 };
        for (const [good, amount] of Object.entries(grants)) {
          edited.goods[good] = Math.min(numeric(edited.capacities?.[good], 40), numeric(edited.goods?.[good]) + amount);
        }
        edited.matter = Math.min(numeric(edited.matterCapacity, 12), numeric(edited.matter) + 3);
        edited.revision = numeric(edited.revision) + 1;
        saveState(sanitizeMoonSettlement(edited), { eventKey: "developer-resources" });
        announce("Bounded lab resources added.");
      }
      if (action === "founding-presets") {
        let preset = state;
        for (const [slot, choiceId] of [["power", "solar"], ["shelter", "haven"], ["signal", "stars"]]) {
          if (preset.founding?.[slot]) continue;
          const result = applySettlementOperation(preset, { type: "choose-founding", slot, choiceId, id: operationId(`preset-${slot}`) }, { at: new Date() });
          if (result?.applied) preset = result.state;
        }
        saveState(preset, { eventKey: "developer-founding-preset" });
        announce("Solar, Haven, and Star Map founding preset applied.");
      }
      if (action === "trigger-drift") {
        const edited = structuredClone(state);
        if (!edited.drift.some((entry) => entry.status === "active" && entry.kind === "Dust")) {
          edited.drift.push({ id: `dev-dust-${edited.revision + 1}`, kind: "Dust", structureId: "structure-processor", severity: 1, stressTier: "weak", status: "active", sourceReceiptId: "developer" });
          edited.revision += 1;
          saveState(sanitizeMoonSettlement(edited), { eventKey: "developer-drift" });
        }
        announce("Predictable Weak Dust Drift triggered.");
      }
      if (action === "inspect-transactions") {
        await navigator.clipboard?.writeText(JSON.stringify(state.receipts, null, 2));
        announce(`${state.receipts.length} validated transaction receipts copied.`);
      }
      if (action === "import-state") {
        const source = globalThis.prompt?.("Paste a validated Moon Settlement Lab snapshot:");
        if (!source) return;
        try {
          state = storage.importJson(source);
          projection = projectMoonSettlement(state);
          pendingOperation = null;
          pendingFounding = null;
          placementDraft = null;
          delete elements.app.dataset.placing;
          cancelDraft();
          render();
          announce("Validated settlement snapshot imported.");
        } catch (error) {
          announce(error?.message || "Settlement import failed validation.");
        }
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    lastActivityAt = Date.now();
    const editable = event.target?.closest?.("input, select, textarea, button, [contenteditable='true']");
    if (editable && event.target !== elements.canvasHost) return;
    if (placementDraft && mode !== "weave") {
      const movementByKey = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1]
      };
      if (movementByKey[event.key]) {
        event.preventDefault();
        movePlacement(...movementByKey[event.key]);
        return;
      }
      if (["q", "r"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        rotatePlacement(event.key.toLowerCase() === "q" ? -1 : 1);
        return;
      }
      if (event.key === "Enter" || event.key.toLowerCase() === "e") {
        event.preventDefault();
        confirmPlacement();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelPlacement();
        return;
      }
    }
    if (mode === "weave" && event.key === "Tab" && elements.weaveLayer) {
      const focusable = [...elements.weaveLayer.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")]
        .filter((node) => !node.hidden && node.getClientRects().length);
      if (focusable.length) {
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === elements.weaveLayer || !elements.weaveLayer.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    if (event.key === "Escape") {
      if (mode === "weave") cancelDraft();
      else if (mode === "inspect") {
        pendingOperation = null;
        selectedTarget = null;
        setMode("walk");
      }
    }
    if (event.key.toLowerCase() === "i" && !event.ctrlKey && !event.metaKey && mode !== "weave") setMode("inspect");
    if (event.key.toLowerCase() === "e" && !event.ctrlKey && !event.metaKey && mode !== "weave") {
      event.preventDefault();
      if (event.repeat) return;
      const descriptor = derivePrimaryAction(spatialProjection(projection));
      if (descriptor?.behavior === "hold") startPrimaryActionHold("keyboard");
      else activatePrimaryAction({ source: "keyboard", bypassHold: true });
    }
    if (event.key.toLowerCase() === "v" && !event.ctrlKey && !event.metaKey) {
      const semantic = availableActions().find((action) => SEMANTIC_OPERATIONS.has(action.type));
      if (semantic) prepareOperation(semantic, { source: "keyboard" });
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.key.toLowerCase() === "e" && primaryActionHolding && settings.holdMode === "hold") {
      cancelPrimaryActionHold();
    }
  });

  document.addEventListener("pointerdown", () => { lastActivityAt = Date.now(); }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (primaryActionHolding) cancelPrimaryActionHold({ restore: false });
      const idle = Date.now() - lastActivityAt;
      if (idle > 30_000) recordTimeline("idle-gap", "settlement", { durationMs: idle });
      recordTimeline("exit", "backgrounded");
    } else {
      lastActivityAt = Date.now();
    }
  });
  addEventListener("blur", () => {
    if (primaryActionHolding) cancelPrimaryActionHold();
  });
  addEventListener("beforeunload", () => recordTimeline("exit", "page-leave"));
}

persistSettings();
if (new URLSearchParams(location.search).get("toolkit") === "1" && elements.developerToolkit) {
  elements.developerToolkit.hidden = false;
}
bindShell();
worldRenderer.sync(spatialProjection(projection));
worldRenderer.init();
weaveRenderer.sync({ revision: state.revision, structures: [], weave: null });
weaveRenderer.init();

const offlineResult = resolveProductionBatch(state, {
  at: new Date(),
  operationId: `offline:${state.revision}`
});
if (offlineResult?.applied) {
  state = storage.save(offlineResult.state);
  projection = projectMoonSettlement(state);
  recordTimeline("milestone", "offline-batch-complete");
}

setMode("walk", { announceMode: false });
render();
focusOpeningSettlementView();

globalThis.__moonSettlementLab = Object.freeze({
  getState: () => structuredClone(state),
  getProjection: () => structuredClone(projection),
  getMode: () => mode,
  getRendererBackend: () => ({ world: worldRenderer.getBackend(), weave: weaveRenderer.getBackend() }),
  prepareOperation,
  exportState: () => storage.exportJson(state),
  exportTimeline: () => exportMoonSettlementTimeline(timeline)
});
