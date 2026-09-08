import {
  BOND_TYPES,
  FUSION_RECIPES,
  MOON_STRESSES,
  PURPOSES,
  WORD_CATALOG,
  addWord,
  classifyBond,
  connectNodes,
  createBloomSnapshot,
  createBloomState,
  declarePurposes,
  describeBond,
  evaluateBloom,
  fuseWords,
  removeBond,
  removeNode,
  rewireBond,
  runMoonStress
} from "./concept-bloom-domain.mjs?v=5.0.0-beta.4";

const byId = (id) => document.getElementById(id);
const elements = {
  resetLab: byId("resetLab"),
  reactantWell: byId("reactantWell"),
  wordPalette: byId("wordPalette"),
  clearReactants: byId("clearReactants"),
  fuseReactants: byId("fuseReactants"),
  plantReactant: byId("plantReactant"),
  bondStatement: byId("bondStatement"),
  bondTypePicker: byId("bondTypePicker"),
  bondHelp: byId("bondHelp"),
  qualityPreview: byId("qualityPreview"),
  swapEndpoints: byId("swapEndpoints"),
  applyBond: byId("applyBond"),
  removeSelectedNode: byId("removeSelectedNode"),
  cancelBondEdit: byId("cancelBondEdit"),
  bloomStage: byId("bloomStage"),
  bondMap: byId("bondMap"),
  bloomNodes: byId("bloomNodes"),
  emptyBloom: byId("emptyBloom"),
  reactionFlash: byId("reactionFlash"),
  overallState: byId("overallState"),
  aspectName: byId("aspectName"),
  purposePicker: byId("purposePicker"),
  inferredPurpose: byId("inferredPurpose"),
  coherenceValue: byId("coherenceValue"),
  coherenceMeter: byId("coherenceMeter"),
  integrityValue: byId("integrityValue"),
  integrityMeter: byId("integrityMeter"),
  capacityValue: byId("capacityValue"),
  capacityMeter: byId("capacityMeter"),
  capacityNote: byId("capacityNote"),
  findingCount: byId("findingCount"),
  findingList: byId("findingList"),
  bondCount: byId("bondCount"),
  bondLedger: byId("bondLedger"),
  stressSelect: byId("stressSelect"),
  runStress: byId("runStress"),
  runAllStress: byId("runAllStress"),
  stressResults: byId("stressResults"),
  commitPreview: byId("commitPreview"),
  commitDialog: byId("commitDialog"),
  commitScene: byId("commitScene"),
  sceneNetwork: byId("sceneNetwork"),
  commitTitle: byId("commitTitle"),
  commitSummary: byId("commitSummary"),
  commitAspect: byId("commitAspect"),
  commitState: byId("commitState"),
  commitCoherence: byId("commitCoherence"),
  commitIntegrity: byId("commitIntegrity"),
  commitStress: byId("commitStress"),
  returnToBloom: byId("returnToBloom"),
  freshFromDialog: byId("freshFromDialog"),
  liveRegion: byId("liveRegion")
};

let state = createBloomState();
let reactants = [];
let selectedNodeIds = [];
let selectedBondId = null;
let selectedBondType = "flow";
let flashTimer = 0;
let toastTimer = 0;

const toast = document.createElement("div");
toast.className = "lab-toast";
toast.id = "labToast";
toast.hidden = true;
document.body.append(toast);

function nodeById(nodeId) {
  return state.nodes.find((node) => node.id === nodeId) || null;
}

function nodeLabel(node) {
  if (!node) return "Missing concept";
  return node.aspect ? `${node.word} · ${node.aspect}` : node.word;
}

function announce(message, tone = "notice") {
  const text = String(message || "").trim();
  if (!text) return;
  elements.liveRegion.textContent = "";
  requestAnimationFrame(() => { elements.liveRegion.textContent = text; });
  toast.textContent = text;
  toast.dataset.tone = tone;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4200);
}

function triggerReactionFlash() {
  window.clearTimeout(flashTimer);
  elements.reactionFlash.removeAttribute("data-active");
  void elements.reactionFlash.offsetWidth;
  elements.reactionFlash.dataset.active = "true";
  flashTimer = window.setTimeout(() => elements.reactionFlash.removeAttribute("data-active"), 650);
}

function acceptCommand(result, { focusNodeId = "", flash = false } = {}) {
  if (!result.ok) {
    announce(result.message, "error");
    return false;
  }
  state = result.state;
  announce(result.event.message, result.event.quality === "asserted" ? "error" : "notice");
  if (flash) triggerReactionFlash();
  renderAll({ focusNodeId });
  return true;
}

function clearReactantSelection() {
  reactants = [];
  renderReactionControls();
}

function chooseReactant(word) {
  if (reactants.length >= 2) reactants = [];
  reactants.push(word);
  renderReactionControls();
}

function removeReactantAt(index) {
  if (index < reactants.length) reactants.splice(index, 1);
  renderReactionControls();
}

function renderReactionControls() {
  const slots = elements.reactantWell.querySelectorAll("[data-reactant-slot]");
  slots.forEach((slot, index) => {
    const value = reactants[index] || "";
    slot.dataset.filled = String(Boolean(value));
    slot.querySelector("strong").textContent = value || "Choose";
    slot.setAttribute("aria-label", value
      ? `${index === 0 ? "First" : "Second"} reactant, ${value}. Remove from the reaction well.`
      : `${index === 0 ? "First" : "Second"} reactant, empty`);
    slot.disabled = !value;
  });

  elements.wordPalette.replaceChildren(...WORD_CATALOG.map((entry) => {
    const button = document.createElement("button");
    const count = reactants.filter((word) => word === entry.word).length;
    button.type = "button";
    button.className = "word-chip";
    button.dataset.word = entry.word;
    button.setAttribute("aria-pressed", String(count > 0));
    button.setAttribute("aria-label", `${entry.word}, ${entry.facet}. ${entry.use}${count ? ` Selected ${count} ${count === 1 ? "time" : "times"}.` : ""}`);
    button.title = entry.use;
    const glyph = document.createElement("span");
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = entry.glyph;
    button.append(glyph, document.createTextNode(entry.word));
    button.addEventListener("click", () => chooseReactant(entry.word));
    return button;
  }));
  elements.clearReactants.disabled = reactants.length === 0;
  elements.fuseReactants.disabled = reactants.length !== 2;
  elements.plantReactant.disabled = reactants.length !== 1;
}

function fuseSelectedReactants() {
  if (reactants.length !== 2) return;
  const result = fuseWords(state, { left: reactants[0], right: reactants[1] });
  if (result.ok) {
    const nodeId = result.event.nodeId;
    reactants = [];
    selectedNodeIds = [nodeId];
    selectedBondId = null;
    acceptCommand(result, { focusNodeId: nodeId, flash: true });
  } else {
    announce(result.message, "error");
  }
}

function plantSelectedReactant() {
  if (reactants.length !== 1) return;
  const result = addWord(state, { word: reactants[0] });
  if (result.ok) {
    const nodeId = result.event.nodeId;
    reactants = [];
    selectedNodeIds = [nodeId];
    selectedBondId = null;
    acceptCommand(result, { focusNodeId: nodeId, flash: true });
  } else {
    announce(result.message, "error");
  }
}

function positionNodes() {
  const positions = new Map();
  const core = state.nodes.find((node) => node.id === state.coreNodeId);
  if (core) positions.set(core.id, { x: 50, y: 50 });
  const attachments = state.nodes.filter((node) => node.id !== core?.id);
  if (!core && attachments.length === 1) {
    positions.set(attachments[0].id, { x: 50, y: 50 });
    return positions;
  }
  const count = attachments.length;
  const radiusX = count <= 4 ? 32 : 38;
  const radiusY = count <= 4 ? 31 : 37;
  attachments.forEach((node, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, count);
    positions.set(node.id, {
      x: 50 + Math.cos(angle) * radiusX,
      y: 50 + Math.sin(angle) * radiusY
    });
  });
  return positions;
}

function selectNode(nodeId) {
  if (selectedNodeIds.includes(nodeId)) {
    selectedNodeIds = selectedNodeIds.filter((id) => id !== nodeId);
  } else if (selectedNodeIds.length < 2) {
    selectedNodeIds.push(nodeId);
  } else {
    selectedNodeIds = [nodeId];
    selectedBondId = null;
  }
  renderBloom();
  renderBondControls();
}

function renderBloom({ focusNodeId = "" } = {}) {
  selectedNodeIds = selectedNodeIds.filter((nodeId) => state.nodes.some((node) => node.id === nodeId));
  const positions = positionNodes();
  elements.emptyBloom.hidden = state.nodes.length > 0;
  elements.bloomNodes.replaceChildren(...state.nodes.map((node) => {
    const position = positions.get(node.id) || { x: 50, y: 50 };
    const button = document.createElement("button");
    button.type = "button";
    button.className = "concept-node";
    button.dataset.nodeId = node.id;
    button.dataset.kind = node.kind;
    button.dataset.word = node.word;
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    button.setAttribute("aria-pressed", String(selectedNodeIds.includes(node.id)));
    const endpointHint = selectedNodeIds.length === 0 ? "Select as the source node."
      : selectedNodeIds.length === 1 ? "Select as the destination node."
        : "Start a new endpoint selection.";
    const recipeHint = node.ingredients ? ` Created from ${node.ingredients.join(" plus ")}.` : "";
    button.setAttribute("aria-label", `${nodeLabel(node)}, ${node.kind} concept.${recipeHint} ${endpointHint}`);
    const glyph = document.createElement("span");
    glyph.className = "node-glyph";
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = node.glyph;
    const word = document.createElement("span");
    word.className = "node-word";
    word.textContent = node.word;
    button.append(glyph, word);
    if (node.aspect) {
      const aspect = document.createElement("span");
      aspect.className = "node-aspect";
      aspect.textContent = node.kind === "core" ? `${node.aspect} core` : `${node.aspect} proof`;
      button.append(aspect);
    }
    button.addEventListener("click", () => selectNode(node.id));
    return button;
  }));
  renderBondMap(positions);
  if (focusNodeId) requestAnimationFrame(() => elements.bloomNodes.querySelector(`[data-node-id="${focusNodeId}"]`)?.focus());
}

const SVG_NS = "http://www.w3.org/2000/svg";
const svgNode = (name, attributes = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

function curveForBond(bond, positions) {
  const source = positions.get(bond.from);
  const target = positions.get(bond.to);
  if (!source || !target) return "";
  const sx = source.x * 10;
  const sy = source.y * 7;
  const tx = target.x * 10;
  const ty = target.y * 7;
  const dx = tx - sx;
  const dy = ty - sy;
  const length = Math.max(1, Math.hypot(dx, dy));
  const direction = [...bond.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 2 ? 1 : -1;
  const bend = Math.min(82, length * .2) * direction;
  const cx = (sx + tx) / 2 - (dy / length) * bend;
  const cy = (sy + ty) / 2 + (dx / length) * bend;
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
}

function addMarker(defs, id, color) {
  const marker = svgNode("marker", {
    id,
    viewBox: "0 0 10 10",
    refX: "8",
    refY: "5",
    markerWidth: "7",
    markerHeight: "7",
    orient: "auto-start-reverse"
  });
  marker.append(svgNode("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }));
  defs.append(marker);
}

function renderBondMap(positions) {
  const defs = svgNode("defs");
  addMarker(defs, "bloom-flow-arrow", "#77eee7");
  addMarker(defs, "bloom-shell-arrow", "#bca9ff");
  elements.bondMap.replaceChildren(defs);
  for (const bond of state.bonds) {
    const pathData = curveForBond(bond, positions);
    if (!pathData) continue;
    const group = svgNode("g");
    const halo = svgNode("path", { class: "bond-halo", d: pathData });
    const lineId = `bloom-${bond.id}`;
    const line = svgNode("path", {
      id: lineId,
      class: "bond-line",
      d: pathData,
      "data-type": bond.type,
      "data-quality": bond.quality
    });
    if (bond.type === "flow") line.setAttribute("marker-end", "url(#bloom-flow-arrow)");
    if (bond.type === "shell") line.setAttribute("marker-end", "url(#bloom-shell-arrow)");
    const text = svgNode("text", { class: "bond-label", dy: "-5" });
    const textPath = svgNode("textPath", { href: `#${lineId}`, startOffset: "50%", "text-anchor": "middle" });
    textPath.textContent = `${bond.type} · ${bond.quality}`;
    text.append(textPath);
    group.append(halo, line, text);
    elements.bondMap.append(group);
  }
}

function bondStatementForSelection() {
  const from = nodeById(selectedNodeIds[0]);
  const to = nodeById(selectedNodeIds[1]);
  if (!from) return "Select a source node, then a destination node.";
  if (!to) return `${nodeLabel(from)} — choose a destination node.`;
  if (selectedBondType === "flow") return `${nodeLabel(from)} —FLOW→ ${nodeLabel(to)}`;
  if (selectedBondType === "shell") return `${nodeLabel(from)} —SHELL→ ${nodeLabel(to)}`;
  return `${nodeLabel(from)} ←BRIDGE→ ${nodeLabel(to)}`;
}

function renderBondControls() {
  const bondType = BOND_TYPES.find((type) => type.id === selectedBondType) || BOND_TYPES[0];
  elements.bondStatement.textContent = bondStatementForSelection();
  elements.bondTypePicker.replaceChildren(...BOND_TYPES.map((type) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(type.id === selectedBondType));
    button.dataset.bondType = type.id;
    button.textContent = `${type.symbol} ${type.label}`;
    button.addEventListener("click", () => {
      selectedBondType = type.id;
      renderBondControls();
    });
    return button;
  }));
  elements.bondHelp.textContent = bondType.help;
  elements.swapEndpoints.disabled = selectedNodeIds.length !== 2 || !bondType.directed;
  elements.applyBond.disabled = selectedNodeIds.length !== 2;
  elements.applyBond.textContent = selectedBondId ? "Update bond" : "Create bond";
  elements.cancelBondEdit.hidden = !selectedBondId;
  elements.removeSelectedNode.disabled = selectedNodeIds.length !== 1;
  const selected = nodeById(selectedNodeIds[0]);
  elements.removeSelectedNode.textContent = selectedNodeIds.length === 1 ? `Remove ${nodeLabel(selected)}` : "Remove selected node";

  if (selectedNodeIds.length === 2) {
    const quality = classifyBond(state, {
      from: selectedNodeIds[0],
      to: selectedNodeIds[1],
      type: selectedBondType
    });
    elements.qualityPreview.dataset.quality = quality?.tier || "none";
    elements.qualityPreview.textContent = quality
      ? `${quality.tier} fit · ${quality.explanation}`
      : "Unable to evaluate this relationship";
  } else {
    elements.qualityPreview.dataset.quality = "none";
    elements.qualityPreview.textContent = "Waiting for two endpoints";
  }
}

function swapEndpoints() {
  if (selectedNodeIds.length !== 2) return;
  selectedNodeIds = [selectedNodeIds[1], selectedNodeIds[0]];
  renderBloom();
  renderBondControls();
}

function applyBond() {
  if (selectedNodeIds.length !== 2) return;
  const input = { from: selectedNodeIds[0], to: selectedNodeIds[1], type: selectedBondType };
  const result = selectedBondId
    ? rewireBond(state, { bondId: selectedBondId, ...input })
    : connectNodes(state, input);
  if (result.ok) {
    selectedNodeIds = [];
    selectedBondId = null;
  }
  acceptCommand(result, { flash: result.ok });
}

function cancelBondEdit() {
  selectedBondId = null;
  selectedNodeIds = [];
  renderBloom();
  renderBondControls();
  renderBondLedger();
  announce("Bond edit cancelled.");
}

function removeSelectedConcept() {
  if (selectedNodeIds.length !== 1) return;
  const nodeId = selectedNodeIds[0];
  const result = removeNode(state, nodeId);
  if (result.ok) {
    selectedNodeIds = [];
    selectedBondId = null;
  }
  acceptCommand(result);
}

function renderPurposePicker(evaluation) {
  const legend = elements.purposePicker.querySelector("legend");
  elements.purposePicker.replaceChildren(legend, ...PURPOSES.map((purpose) => {
    const label = document.createElement("label");
    label.className = "purpose-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "purpose";
    input.value = purpose.id;
    input.checked = state.declaredPurposeIds.includes(purpose.id);
    input.addEventListener("change", () => {
      const checked = [...elements.purposePicker.querySelectorAll("input:checked")].map((item) => item.value);
      acceptCommand(declarePurposes(state, checked));
    });
    const copy = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = purpose.label;
    const small = document.createElement("small");
    small.textContent = `${purpose.help} Cost ${purpose.cost}.`;
    copy.append(strong, small);
    const coverage = document.createElement("output");
    coverage.value = String(Math.round(evaluation.coverage[purpose.id] * 100));
    coverage.textContent = `${coverage.value}% proof`;
    label.append(input, copy, coverage);
    return label;
  }));
  const inferred = evaluation.inferredPurposes;
  elements.inferredPurpose.textContent = inferred.length
    ? `Inferred now: ${inferred.map((purpose) => `${purpose.label} ${Math.round(purpose.coverage * 100)}%`).join(" · ")}`
    : "No purpose has enough evidence to be inferred yet.";
}

function renderMetrics(evaluation) {
  const core = state.nodes.find((node) => node.id === state.coreNodeId);
  elements.aspectName.textContent = core ? core.aspect : "No Aspect";
  elements.overallState.dataset.state = evaluation.overall;
  elements.overallState.textContent = evaluation.overall;
  elements.bloomStage.dataset.state = evaluation.overall;
  elements.coherenceValue.textContent = String(evaluation.coherence);
  elements.coherenceMeter.value = evaluation.coherence;
  elements.coherenceMeter.textContent = String(evaluation.coherence);
  elements.integrityValue.textContent = String(evaluation.integrity);
  elements.integrityMeter.value = evaluation.integrity;
  elements.integrityMeter.textContent = String(evaluation.integrity);
  elements.capacityValue.textContent = `${evaluation.capacity.used} / ${evaluation.capacity.limit}`;
  elements.capacityMeter.max = evaluation.capacity.limit;
  elements.capacityMeter.value = Math.min(evaluation.capacity.used, evaluation.capacity.limit);
  elements.capacityMeter.textContent = `${evaluation.capacity.used} of ${evaluation.capacity.limit}`;
  elements.capacityNote.textContent = evaluation.capacity.status === "overloaded"
    ? `Overloaded by ${Math.abs(evaluation.capacity.remaining)}. Actions remain available, but every stress test is penalized.`
    : `${evaluation.capacity.remaining} capacity remains · ${evaluation.capacity.status}. Purpose and weak claims consume it.`;
}

function renderFindings(evaluation) {
  elements.findingCount.textContent = String(evaluation.issues.length);
  elements.findingList.replaceChildren(...evaluation.issues.map((issue) => {
    const item = document.createElement("li");
    item.dataset.severity = issue.severity;
    item.textContent = issue.text;
    return item;
  }));
}

function editBond(bondId) {
  const bond = state.bonds.find((item) => item.id === bondId);
  if (!bond) return;
  selectedBondId = bond.id;
  selectedNodeIds = [bond.from, bond.to];
  selectedBondType = bond.type;
  document.body.dataset.mobilePanel = "build";
  syncMobileTabs();
  renderBloom();
  renderBondControls();
  renderBondLedger();
  byId("bondTitle").scrollIntoView({ behavior: "smooth", block: "center" });
  requestAnimationFrame(() => elements.applyBond.focus());
  announce(`Editing ${describeBond(state, bond)}. Change endpoints, direction, or bond type, then update.`);
}

function deleteBond(bondId) {
  const result = removeBond(state, bondId);
  if (result.ok && selectedBondId === bondId) {
    selectedBondId = null;
    selectedNodeIds = [];
  }
  acceptCommand(result);
}

function renderBondLedger() {
  elements.bondCount.textContent = String(state.bonds.length);
  elements.bondLedger.replaceChildren(...state.bonds.map((bond) => {
    const entry = document.createElement("article");
    entry.className = "bond-entry";
    entry.dataset.editing = String(bond.id === selectedBondId);
    const top = document.createElement("div");
    top.className = "bond-entry__top";
    const statement = document.createElement("p");
    statement.textContent = describeBond(state, bond);
    const quality = document.createElement("span");
    quality.className = "quality-badge";
    quality.dataset.quality = bond.quality;
    quality.textContent = bond.quality;
    top.append(statement, quality);
    const actions = document.createElement("div");
    actions.className = "bond-entry__actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Rewire";
    edit.setAttribute("aria-label", `Rewire ${describeBond(state, bond)}`);
    edit.addEventListener("click", () => editBond(bond.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${describeBond(state, bond)}`);
    remove.addEventListener("click", () => deleteBond(bond.id));
    actions.append(edit, remove);
    entry.append(top, actions);
    return entry;
  }));
}

function renderStressResults() {
  const results = [...state.stressResults].sort((left, right) => {
    const leftIndex = MOON_STRESSES.findIndex((stress) => stress.id === left.stressId);
    const rightIndex = MOON_STRESSES.findIndex((stress) => stress.id === right.stressId);
    return leftIndex - rightIndex;
  });
  elements.stressResults.replaceChildren(...results.map((result) => {
    const card = document.createElement("article");
    card.className = "stress-result";
    card.dataset.outcome = result.outcome;
    const head = document.createElement("div");
    head.className = "stress-result__head";
    const title = document.createElement("strong");
    title.textContent = result.label;
    const outcome = document.createElement("output");
    outcome.value = String(result.score);
    outcome.textContent = `${result.outcome} · ${result.score}`;
    head.append(title, outcome);
    const summary = document.createElement("p");
    summary.textContent = result.gaps.length
      ? `Gaps: ${result.gaps.join(" · ")}`
      : `Strengths: ${result.strengths.join(" · ") || "Balanced response"}`;
    card.append(head, summary);
    return card;
  }));
}

function runSelectedStress() {
  acceptCommand(runMoonStress(state, elements.stressSelect.value), { flash: true });
}

function runEveryStress() {
  let nextState = state;
  const messages = [];
  for (const stress of MOON_STRESSES) {
    const result = runMoonStress(nextState, stress.id);
    if (!result.ok) {
      announce(result.message, "error");
      return;
    }
    nextState = result.state;
    messages.push(`${result.event.result.label}: ${result.event.result.score}`);
  }
  state = nextState;
  triggerReactionFlash();
  renderAll();
  announce(`All Moon stresses complete. ${messages.join("; ")}.`);
}

function renderReadout() {
  const evaluation = evaluateBloom(state);
  renderPurposePicker(evaluation);
  renderMetrics(evaluation);
  renderFindings(evaluation);
  renderBondLedger();
  renderStressResults();
  elements.runStress.disabled = !state.coreNodeId;
  elements.runAllStress.disabled = !state.coreNodeId;
  elements.commitPreview.disabled = !state.coreNodeId;
}

function openCommitPreview() {
  const snapshot = createBloomSnapshot(state);
  if (!snapshot.ready) {
    announce(snapshot.reason, "error");
    return;
  }
  elements.commitTitle.textContent = snapshot.title;
  elements.commitSummary.textContent = `${snapshot.nodeCount} concepts and ${snapshot.bondCount} bonds have become one ${snapshot.state} argument. Its construction route remains visible as the ${snapshot.aspect} Aspect.`;
  elements.commitAspect.textContent = snapshot.aspect;
  elements.commitState.textContent = snapshot.state;
  elements.commitCoherence.textContent = `${snapshot.coherence} / 100`;
  elements.commitIntegrity.textContent = `${snapshot.integrity} / 100`;
  elements.commitScene.dataset.aspect = snapshot.aspect.toLowerCase();
  if (snapshot.weakestStress) {
    elements.commitStress.textContent = `Weakest tested pressure: ${snapshot.weakestStress.label} — ${snapshot.weakestStress.outcome} at ${snapshot.weakestStress.score}.`;
  } else {
    elements.commitStress.textContent = "No environmental proof has been run. This is a compelling image, but still an untested claim.";
  }
  elements.sceneNetwork.replaceChildren(...state.nodes.slice(0, 8).map((node, index) => {
    const dot = document.createElement("i");
    dot.title = nodeLabel(node);
    dot.style.left = `${18 + ((index * 31) % 65)}%`;
    dot.style.top = `${13 + ((index * 23) % 62)}%`;
    return dot;
  }));
  elements.commitDialog.showModal();
  requestAnimationFrame(() => elements.returnToBloom.focus());
}

function closeCommitPreview() {
  elements.commitDialog.close();
  requestAnimationFrame(() => elements.commitPreview.focus());
}

function resetLab({ fromDialog = false } = {}) {
  state = createBloomState();
  reactants = [];
  selectedNodeIds = [];
  selectedBondId = null;
  selectedBondType = "flow";
  if (fromDialog && elements.commitDialog.open) elements.commitDialog.close();
  renderAll();
  announce("The standalone challenge was reset. No profile or project state was changed.");
}

function syncMobileTabs() {
  document.querySelectorAll("[data-mobile-tab]").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.mobileTab === document.body.dataset.mobilePanel));
  });
}

function renderAll({ focusNodeId = "" } = {}) {
  renderReactionControls();
  renderBloom({ focusNodeId });
  renderBondControls();
  renderReadout();
}

elements.reactantWell.querySelectorAll("[data-reactant-slot]").forEach((slot) => {
  slot.addEventListener("click", () => removeReactantAt(Number(slot.dataset.reactantSlot)));
});
document.querySelectorAll("[data-recipe]").forEach((button) => {
  button.addEventListener("click", () => {
    const [left, right] = button.dataset.recipe.split("|");
    reactants = [left, right];
    renderReactionControls();
    announce(`${left} and ${right} loaded into the reaction well.`);
  });
});
document.querySelectorAll("[data-mobile-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.body.dataset.mobilePanel = tab.dataset.mobileTab;
    syncMobileTabs();
    const target = tab.dataset.mobileTab === "build" ? byId("buildPanel") : byId("inspectPanel");
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

elements.clearReactants.addEventListener("click", clearReactantSelection);
elements.fuseReactants.addEventListener("click", fuseSelectedReactants);
elements.plantReactant.addEventListener("click", plantSelectedReactant);
elements.swapEndpoints.addEventListener("click", swapEndpoints);
elements.applyBond.addEventListener("click", applyBond);
elements.removeSelectedNode.addEventListener("click", removeSelectedConcept);
elements.cancelBondEdit.addEventListener("click", cancelBondEdit);
elements.runStress.addEventListener("click", runSelectedStress);
elements.runAllStress.addEventListener("click", runEveryStress);
elements.commitPreview.addEventListener("click", openCommitPreview);
elements.returnToBloom.addEventListener("click", closeCommitPreview);
elements.freshFromDialog.addEventListener("click", () => resetLab({ fromDialog: true }));
elements.resetLab.addEventListener("click", () => resetLab());
elements.commitDialog.addEventListener("click", (event) => {
  if (event.target === elements.commitDialog) closeCommitPreview();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || elements.commitDialog.open) return;
  if (selectedBondId || selectedNodeIds.length) {
    selectedBondId = null;
    selectedNodeIds = [];
    renderBloom();
    renderBondControls();
    renderBondLedger();
    announce("Concept selection cleared.");
  }
});

elements.stressSelect.replaceChildren(...MOON_STRESSES.map((stress) => {
  const option = document.createElement("option");
  option.value = stress.id;
  option.textContent = stress.label;
  option.title = stress.summary;
  return option;
}));

window.__conceptBloomLab = Object.freeze({
  getState: () => state,
  reset: () => resetLab(),
  recipes: FUSION_RECIPES
});

syncMobileTabs();
renderAll();
