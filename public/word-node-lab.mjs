import { createWordChemistryGraph, lineageFromComponents } from "./word-node-chemistry.mjs?v=5.0.0-beta.4";
import {
  addEditableBond,
  adjustBondIntegrity,
  bondGraphEffects,
  bondStability,
  canonicalBreakGoals,
  connectedBondFragments,
  createEditableBondGraph,
  deriveWordFragments,
  evaluateBreakGoal,
  removeEditableBond,
  weakenEditableBond
} from "./word-node-bond-editor.mjs?v=5.0.0-beta.4";

const HOVER_PREVIEW_DELAY_MS = 3000;
const FOCUSED_ATOM_ZOOM = 3.25;
const HOVER_STRUCTURE_SCALE = 2;

const DEFAULT_NODE = Object.freeze({
  word: "Earth",
  components: Object.freeze(["Earth"]),
  intermediates: Object.freeze([]),
  accent: "#70e7df",
  scale: 100,
  opacity: 26,
  duration: 18,
  motion: true
});

const elements = Object.freeze({
  word: document.querySelector("#nodeWord"),
  components: document.querySelector("#nodeComponents"),
  accent: document.querySelector("#accentColor"),
  scale: document.querySelector("#nodeScale"),
  opacity: document.querySelector("#structureOpacity"),
  duration: document.querySelector("#motionSpeed"),
  motion: document.querySelector("#nodeMotion"),
  scaleOutput: document.querySelector("#nodeScaleOutput"),
  opacityOutput: document.querySelector("#structureOpacityOutput"),
  durationOutput: document.querySelector("#motionSpeedOutput"),
  controlTitle: document.querySelector("#controlTitle"),
  activeNode: document.querySelector("#activeNode"),
  stage: document.querySelector(".lab-stage"),
  sampleRack: document.querySelector("#sampleRack"),
  variantRack: document.querySelector("#variantRack"),
  variantEmpty: document.querySelector("#variantEmpty"),
  hoverPreview: document.querySelector("#hoverPreview"),
  hoverApply: document.querySelector("#hoverApply"),
  hoverCancel: document.querySelector("#hoverCancel"),
  hoverStructure3d: document.querySelector("#hoverStructure3d"),
  hoverStructureLabels: document.querySelector("#hoverStructureLabels"),
  bondEditor: document.querySelector("#bondEditor"),
  bondEditorEyebrow: document.querySelector("#bondEditorEyebrow"),
  bondEditorTitle: document.querySelector("#bondEditorTitle"),
  bondEditorStatus: document.querySelector("#bondEditorStatus"),
  bondQuality: document.querySelector("#bondQuality"),
  bondIntegrityWrap: document.querySelector("#bondIntegrityWrap"),
  bondIntegrity: document.querySelector("#bondIntegrity"),
  bondIntegrityBar: document.querySelector("#bondIntegrityBar"),
  bondWeaken: document.querySelector("#bondWeaken"),
  bondStrengthen: document.querySelector("#bondStrengthen"),
  bondBreak: document.querySelector("#bondBreak"),
  bondConnect: document.querySelector("#bondConnect"),
  bondUndo: document.querySelector("#bondUndo"),
  lineageFormula: document.querySelector("#lineageFormula"),
  readoutComponents: document.querySelector("#readoutComponents"),
  readoutCombinations: document.querySelector("#readoutCombinations"),
  readoutBonds: document.querySelector("#readoutBonds"),
  readoutFragments: document.querySelector("#readoutFragments"),
  readoutWords: document.querySelector("#readoutWords"),
  readoutCohesion: document.querySelector("#readoutCohesion"),
  readoutReactivity: document.querySelector("#readoutReactivity"),
  readoutState: document.querySelector("#readoutState"),
  wordSplit: document.querySelector("#wordSplit"),
  wordSplitFormula: document.querySelector("#wordSplitFormula"),
  wordSplitTokens: document.querySelector("#wordSplitTokens"),
  breakGoalTitle: document.querySelector("#breakGoalTitle"),
  breakGoalSelect: document.querySelector("#breakGoalSelect"),
  breakGoalRule: document.querySelector("#breakGoalRule"),
  breakGoalStart: document.querySelector("#breakGoalStart"),
  breakGoalStatus: document.querySelector("#breakGoalStatus"),
  save: document.querySelector("#saveVariant"),
  reset: document.querySelector("#resetNode")
});

let activeSource = null;
let activeIntermediates = [];
let variantCount = 0;
let hoverPreviewTimer = 0;
let hoverPreviewOpen = false;
let moleculeView = { x: 0, y: 0, zoom: 1, rotationX: -15, rotationY: -18 };
let moleculeGesture = null;
let suppressAtomClickUntil = 0;
let moleculeLabelSyncFrame = 0;
let moleculeLabelSyncUntil = 0;
let editableGraph = null;
let editableAccent = DEFAULT_NODE.accent;
let selectedBondId = null;
let selectedAtomId = null;
let connectSourceNodeId = null;
let editorHistory = [];
let editorFragments = [];
let editorBaselineGraph = null;
let editorDirty = false;
let activeStructureGraph = null;
let activeStructureSignature = "";
let breakGoalCatalogSignature = "";
let breakGoals = [];
let activeBreakGoal = null;
const structureEditsBySource = new WeakMap();

function cleanWord(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 18) || "Word";
}

function parseList(value, separator = /[,|]/) {
  return String(value || "")
    .split(separator)
    .map((word) => String(word || "").replace(/\s+/g, " ").trim().slice(0, 18))
    .filter(Boolean)
    .slice(0, 8);
}

function currentSettings() {
  return {
    word: cleanWord(elements.word.value),
    components: parseList(elements.components.value),
    intermediates: [...activeIntermediates],
    accent: elements.accent.value,
    scale: Number(elements.scale.value),
    opacity: Number(elements.opacity.value),
    duration: Number(elements.duration.value),
    motion: elements.motion.checked
  };
}

function svgNode(tag, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

function graphForSettings(settings) {
  return createWordChemistryGraph(lineageFromComponents({
    word: settings.word,
    components: settings.components,
    intermediates: settings.intermediates
  }));
}

function structureSignature(settings) {
  return JSON.stringify({
    word: settings.word,
    components: settings.components,
    intermediates: settings.intermediates
  });
}

function buildStructure(target, graph) {
  if (!target) return;
  const svg = svgNode("svg", { viewBox: "0 0 110 100", focusable: "false" });
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const bonds = svgNode("g");
  const atoms = svgNode("g");

  graph.edges.forEach((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const offsetX = (-dy / length) * 1.45;
    const offsetY = (dx / length) * 1.45;
    const qualityClass = Number.isFinite(edge.integrity) ? ` lab-word-node__bond--${bondStability(edge.integrity).key}` : "";
    bonds.append(svgNode("line", {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      class: `lab-word-node__bond${edge.kind === "reaction" ? " lab-word-node__bond--reaction" : ""}${edge.bondType === "support" ? " lab-word-node__bond--support" : ""}${edge.order === 2 ? " lab-word-node__bond--double" : ""}${qualityClass}`
    }));
    if (edge.order === 2) {
      bonds.append(svgNode("line", {
        x1: from.x + offsetX,
        y1: from.y + offsetY,
        x2: to.x + offsetX,
        y2: to.y + offsetY,
        class: "lab-word-node__bond-shadow"
      }));
    }
  });

  graph.nodes.forEach((node) => {
    const group = svgNode("g", { transform: `translate(${node.x} ${node.y})` });
    const radius = node.role === "product" ? (graph.nodes.length === 1 ? 11 : 7.5) : node.role === "reaction" ? 6 : 4.7;
    if (node.role === "product") {
      group.append(svgNode("ellipse", { cx: 0, cy: 0, rx: radius + 5, ry: radius + 1.5, class: "lab-word-node__orbit" }));
    }
    group.append(svgNode("circle", {
      cx: 0,
      cy: 0,
      r: radius,
      class: `lab-word-node__atom${node.role === "product" ? " lab-word-node__atom--core" : ""}${node.role === "reaction" ? " lab-word-node__atom--reaction" : ""}`
    }));
    if (node.role !== "product" || graph.nodes.length === 1) {
      const label = svgNode("text", { x: 0, y: .4, class: "lab-word-node__atom-label" });
      label.textContent = node.label;
      group.append(label);
    }
    atoms.append(group);
  });

  svg.append(bonds, atoms);
  target.replaceChildren(svg);
}

function describeGraph(graph) {
  if (!graph.reactions.length) return `Base element · ${graph.word}`;
  return graph.reactions
    .map((reaction) => `${reaction.inputs.join(" + ")} → ${reaction.output}`)
    .join("  ·  ");
}

function setStyleProperties(element, properties) {
  for (const [name, value] of Object.entries(properties)) element.style.setProperty(name, value);
}

function threeDimensionalPoint(node) {
  const scale = 1.85 * HOVER_STRUCTURE_SCALE;
  return {
    x: (node.x - 55) * scale,
    y: (node.y - 50) * scale,
    z: Number(node.z || 0) * 1.65 * HOVER_STRUCTURE_SCALE
  };
}

function atomVisualMetrics(node) {
  const roleScale = node.role === "product" ? 1.12 : node.role === "reaction" ? 1.04 : .96;
  const baseDiameter = node.role === "product" ? 28 : node.role === "reaction" ? 23 : 20;
  const diameter = baseDiameter * roleScale * HOVER_STRUCTURE_SCALE;
  return {
    diameter,
    labelSize: Math.max(11 * HOVER_STRUCTURE_SCALE, diameter * .46)
  };
}

function syncMoleculeScreenLabels() {
  const host = elements.hoverStructure3d;
  const labels = elements.hoverStructureLabels;
  if (!host || !labels || elements.hoverPreview.hidden) return;
  const labelsRect = labels.getBoundingClientRect();
  labels.querySelectorAll(".lab-molecule-3d__screen-label").forEach((label) => {
    const atom = host.querySelector(`.lab-molecule-3d__atom[data-node-id="${CSS.escape(label.dataset.nodeId)}"]`);
    if (!atom) return;
    const atomRect = atom.getBoundingClientRect();
    const baseLabelSize = Number(label.dataset.baseLabelSize) || 11 * HOVER_STRUCTURE_SCALE;
    const renderedLabelSize = Math.min(40, Math.max(baseLabelSize, atomRect.width * .34));
    label.style.left = `${atomRect.left + atomRect.width / 2 - labelsRect.left}px`;
    label.style.top = `${atomRect.top + atomRect.height / 2 - labelsRect.top}px`;
    label.style.setProperty("--atom-label-size", `${renderedLabelSize}px`);
  });
}

function scheduleMoleculeLabelSync(duration = 300) {
  moleculeLabelSyncUntil = Math.max(moleculeLabelSyncUntil, performance.now() + duration);
  if (moleculeLabelSyncFrame) return;
  const tick = () => {
    moleculeLabelSyncFrame = 0;
    syncMoleculeScreenLabels();
    if (!elements.hoverPreview.hidden && performance.now() < moleculeLabelSyncUntil) {
      moleculeLabelSyncFrame = requestAnimationFrame(tick);
    }
  };
  moleculeLabelSyncFrame = requestAnimationFrame(tick);
}

function buildThreeDimensionalStructure(target, graph, accent) {
  const scene = document.createElement("span");
  scene.className = "lab-molecule-3d__scene";
  const labels = elements.hoverStructureLabels;
  labels.replaceChildren();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const fragmentByNode = new Map();
  editorFragments.forEach((fragment, fragmentIndex) => {
    fragment.forEach((nodeId) => fragmentByNode.set(nodeId, fragmentIndex));
  });
  const fragmentOffsetByNode = new Map();
  if (editorFragments.length > 1) {
    const allPoints = graph.nodes.map(threeDimensionalPoint);
    const center = {
      x: allPoints.reduce((sum, point) => sum + point.x, 0) / Math.max(1, allPoints.length),
      y: allPoints.reduce((sum, point) => sum + point.y, 0) / Math.max(1, allPoints.length)
    };
    editorFragments.forEach((fragment, fragmentIndex) => {
      const points = fragment.map((nodeId) => nodeById.get(nodeId)).filter(Boolean).map(threeDimensionalPoint);
      const fragmentCenter = {
        x: points.reduce((sum, point) => sum + point.x, 0) / Math.max(1, points.length),
        y: points.reduce((sum, point) => sum + point.y, 0) / Math.max(1, points.length)
      };
      const dx = fragmentCenter.x - center.x;
      const dy = fragmentCenter.y - center.y;
      const length = Math.hypot(dx, dy);
      const fallbackAngle = Math.PI * 2 * fragmentIndex / editorFragments.length;
      const unitX = length > 1 ? dx / length : Math.cos(fallbackAngle);
      const unitY = length > 1 ? dy / length : Math.sin(fallbackAngle);
      fragment.forEach((nodeId) => fragmentOffsetByNode.set(nodeId, { x: unitX * 30, y: unitY * 30 }));
    });
  }
  const visualPoint = (node) => {
    const point = threeDimensionalPoint(node);
    const offset = fragmentOffsetByNode.get(node.id);
    return offset ? { ...point, x: point.x + offset.x, y: point.y + offset.y } : point;
  };

  graph.edges.forEach((edge) => {
    const source = nodeById.get(edge.from);
    const destination = nodeById.get(edge.to);
    if (!source || !destination) return;
    const sourceCenter = visualPoint(source);
    const destinationCenter = visualPoint(destination);
    const centerDx = destinationCenter.x - sourceCenter.x;
    const centerDy = destinationCenter.y - sourceCenter.y;
    const centerDz = destinationCenter.z - sourceCenter.z;
    const centerLength = Math.max(1, Math.hypot(centerDx, centerDy, centerDz));
    const unit = { x: centerDx / centerLength, y: centerDy / centerLength, z: centerDz / centerLength };
    const sourceClearance = atomVisualMetrics(source).diameter * .5;
    const destinationClearance = atomVisualMetrics(destination).diameter * .5;
    const from = {
      x: sourceCenter.x + unit.x * sourceClearance,
      y: sourceCenter.y + unit.y * sourceClearance,
      z: sourceCenter.z + unit.z * sourceClearance
    };
    const to = {
      x: destinationCenter.x - unit.x * destinationClearance,
      y: destinationCenter.y - unit.y * destinationClearance,
      z: destinationCenter.z - unit.z * destinationClearance
    };
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const flatLength = Math.max(1, Math.hypot(dx, dy));
    const length = Math.max(1, Math.hypot(dx, dy, dz));
    const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 };
    const angleZ = Math.atan2(dy, dx) * 180 / Math.PI;
    const angleY = -Math.atan2(dz, flatLength) * 180 / Math.PI;
    const quality = bondStability(edge.integrity);
    const copies = edge.order === 2
      ? [-2.6 * HOVER_STRUCTURE_SCALE, 2.6 * HOVER_STRUCTURE_SCALE]
      : [0];
    copies.forEach((parallelOffset, index) => {
      const bond = document.createElement("span");
      bond.className = `lab-molecule-3d__bond${index ? " lab-molecule-3d__bond--parallel" : ""}`;
      bond.dataset.bondId = edge.id;
      bond.dataset.quality = quality.key;
      bond.dataset.bondType = edge.bondType || "synthetic";
      bond.dataset.ruleId = edge.ruleId || "";
      bond.classList.toggle("is-selected", edge.id === selectedBondId);
      setStyleProperties(bond, {
        "--bond-x": `${midpoint.x}px`,
        "--bond-y": `${midpoint.y + parallelOffset}px`,
        "--bond-z": `${midpoint.z}px`,
        "--bond-length": `${length}px`,
        "--bond-angle-z": `${angleZ}deg`,
        "--bond-angle-y": `${angleY}deg`,
        "--bond-depth": String(Math.round(midpoint.z)),
        "--bond-color": accent
      });
      scene.append(bond);
    });
    const bondHit = document.createElement("button");
    bondHit.type = "button";
    bondHit.className = "lab-molecule-3d__bond-hit";
    bondHit.dataset.bondId = edge.id;
    bondHit.dataset.quality = quality.key;
    bondHit.dataset.bondType = edge.bondType || "synthetic";
    bondHit.dataset.ruleId = edge.ruleId || "";
    bondHit.classList.toggle("is-selected", edge.id === selectedBondId);
    const ruleLabel = edge.bondType === "recipe" ? `recipe bond for ${edge.reactionOutput}` : `${edge.bondType || "synthetic"} bond`;
    bondHit.setAttribute("aria-label", `${quality.label} ${ruleLabel} between ${source.word} and ${destination.word}, ${quality.integrity}% integrity`);
    setStyleProperties(bondHit, {
      "--bond-x": `${midpoint.x}px`,
      "--bond-y": `${midpoint.y}px`,
      "--bond-z": `${midpoint.z}px`,
      "--bond-length": `${length}px`,
      "--bond-angle-z": `${angleZ}deg`,
      "--bond-angle-y": `${angleY}deg`,
      "--bond-depth": String(Math.round(midpoint.z)),
      "--bond-color": accent
    });
    scene.append(bondHit);
  });

  graph.nodes.forEach((node) => {
    const point = visualPoint(node);
    const metrics = atomVisualMetrics(node);
    const atom = document.createElement("button");
    atom.type = "button";
    atom.className = `lab-molecule-3d__atom lab-molecule-3d__atom--${node.role}`;
    atom.dataset.material = String(node.word || "unknown").trim().toLocaleLowerCase("en-US");
    atom.dataset.nodeId = node.id;
    atom.dataset.fragment = String(fragmentByNode.get(node.id) ?? 0);
    atom.setAttribute("aria-label", `${node.word} atom, ${node.label}`);
    atom.setAttribute("aria-pressed", node.id === selectedAtomId ? "true" : "false");
    atom.classList.toggle("is-selected", node.id === selectedAtomId);
    atom.classList.toggle("is-connect-source", node.id === connectSourceNodeId);
    setStyleProperties(atom, {
      "--atom-x": `${point.x}px`,
      "--atom-y": `${point.y}px`,
      "--atom-z": `${point.z}px`,
      "--atom-depth": String(Math.round(point.z)),
      "--atom-color": accent,
      "--atom-rim": accent,
      "--atom-size": `${metrics.diameter}px`
    });
    const atomLabel = document.createElement("span");
    atomLabel.className = "lab-molecule-3d__screen-label";
    atomLabel.dataset.nodeId = node.id;
    atomLabel.dataset.baseLabelSize = String(metrics.labelSize);
    atomLabel.textContent = node.label;
    setStyleProperties(atomLabel, {
      "--atom-color": accent,
      "--atom-label-size": `${metrics.labelSize}px`
    });
    scene.append(atom);
    labels.append(atomLabel);
  });

  target.replaceChildren(scene);
}

function editableNode(nodeId) {
  return editableGraph?.nodes.find((node) => node.id === nodeId) || null;
}

function editableBond(bondId) {
  return editableGraph?.edges.find((edge) => edge.id === bondId) || null;
}

function pushEditorHistory(action) {
  if (!editableGraph) return;
  editorHistory.push({
    action,
    graph: createEditableBondGraph(editableGraph),
    selectedBondId,
    selectedAtomId
  });
  if (editorHistory.length > 30) editorHistory.shift();
  elements.bondUndo.disabled = false;
}

function editableGraphState(graph) {
  return JSON.stringify((graph?.edges || [])
    .map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      order: edge.order,
      bondType: edge.bondType,
      integrity: edge.integrity
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id), "en-US")));
}

function syncEditorDraftState() {
  editorDirty = Boolean(editableGraph && editorBaselineGraph && editableGraphState(editableGraph) !== editableGraphState(editorBaselineGraph));
  elements.hoverPreview.dataset.draftState = editorDirty ? "changed" : "clean";
  elements.hoverApply.disabled = !editorDirty;
}

function positionBondEditor() {
  if (elements.bondEditor.hidden || elements.hoverPreview.hidden) return;
  const bubbleRect = elements.hoverPreview.getBoundingClientRect();
  const editorRect = elements.bondEditor.getBoundingClientRect();
  const gap = 14;
  let left = bubbleRect.right + gap;
  let top = bubbleRect.top + Math.max(24, (bubbleRect.height - editorRect.height) / 2);
  if (left + editorRect.width > window.innerWidth - 12) left = bubbleRect.left - editorRect.width - gap;
  if (left < 12) {
    left = Math.max(12, Math.min(window.innerWidth - editorRect.width - 12, bubbleRect.left + (bubbleRect.width - editorRect.width) / 2));
    top = Math.min(window.innerHeight - editorRect.height - 12, bubbleRect.bottom + gap);
  }
  top = Math.max(12, Math.min(window.innerHeight - editorRect.height - 12, top));
  elements.bondEditor.style.left = `${left}px`;
  elements.bondEditor.style.top = `${top}px`;
}

function showBondEditor() {
  elements.bondEditor.hidden = false;
  elements.bondUndo.disabled = editorHistory.length === 0;
  requestAnimationFrame(positionBondEditor);
}

function hideBondEditor() {
  elements.bondEditor.hidden = true;
  elements.bondEditor.removeAttribute("data-mode");
  elements.bondEditor.removeAttribute("data-bond-type");
}

function setBondActionsVisible(visible) {
  elements.bondWeaken.hidden = !visible;
  elements.bondStrengthen.hidden = !visible;
  elements.bondBreak.hidden = !visible;
}

function presentBondEditor(bondId, status = "") {
  const bond = editableBond(bondId);
  if (!bond) return;
  const from = editableNode(bond.from);
  const to = editableNode(bond.to);
  const quality = bondStability(bond.integrity);
  elements.bondEditor.dataset.mode = "bond";
  elements.bondEditor.dataset.bondType = bond.bondType || "synthetic";
  elements.bondEditorEyebrow.textContent = bond.bondType === "recipe"
    ? "RECIPE BOND"
    : bond.bondType === "support"
      ? "SUPPORT BOND"
      : "SYNTHETIC BOND";
  elements.bondEditorTitle.textContent = `${from?.word || "Atom"} — ${to?.word || "Atom"}`;
  elements.bondQuality.hidden = false;
  elements.bondQuality.dataset.quality = quality.key;
  elements.bondQuality.textContent = quality.label;
  elements.bondIntegrityWrap.hidden = false;
  elements.bondIntegrity.textContent = `${quality.integrity}%`;
  elements.bondIntegrityBar.style.width = `${quality.integrity}%`;
  elements.bondIntegrityBar.dataset.quality = quality.key;
  const meter = elements.bondIntegrityWrap.querySelector("[role='meter']");
  meter?.setAttribute("aria-valuenow", String(quality.integrity));
  elements.bondEditorStatus.textContent = status || (bond.bondType === "recipe"
    ? `Identity rule: breaking this bond decomposes ${bond.reactionOutput} into its recipe inputs.`
    : "Structural rule: this bond changes cohesion, but never changes the resulting words.");
  setBondActionsVisible(true);
  elements.bondConnect.hidden = true;
  showBondEditor();
}

function presentAtomEditor(nodeId, status = "Create a bond, or Shift-click to focus this atom.") {
  const node = editableNode(nodeId);
  if (!node) return;
  elements.bondEditor.dataset.mode = "atom";
  elements.bondEditorEyebrow.textContent = connectSourceNodeId ? "BOND SOURCE" : "ATOM SELECTED";
  elements.bondEditorTitle.textContent = node.word;
  elements.bondQuality.hidden = true;
  elements.bondIntegrityWrap.hidden = true;
  elements.bondEditorStatus.textContent = status;
  setBondActionsVisible(false);
  elements.bondConnect.hidden = false;
  elements.bondConnect.textContent = connectSourceNodeId ? "Cancel bond" : "Connect atom";
  showBondEditor();
}

function presentEditorNotice(title, status) {
  elements.bondEditor.dataset.mode = "notice";
  elements.bondEditorEyebrow.textContent = "STRUCTURE UPDATED";
  elements.bondEditorTitle.textContent = title;
  elements.bondQuality.hidden = true;
  elements.bondIntegrityWrap.hidden = true;
  elements.bondEditorStatus.textContent = status;
  setBondActionsVisible(false);
  elements.bondConnect.hidden = true;
  showBondEditor();
}

function renderEditableStructure() {
  if (!editableGraph) return;
  editorFragments = connectedBondFragments(editableGraph);
  elements.hoverPreview.classList.toggle("is-fragmented", editorFragments.length > 1);
  elements.hoverPreview.classList.toggle("is-connecting", Boolean(connectSourceNodeId));
  buildThreeDimensionalStructure(elements.hoverStructure3d, editableGraph, editableAccent);
  syncGoalBondHighlights();
  syncEditorDraftState();
  scheduleMoleculeLabelSync();
}

function completeBondConnection(targetNodeId) {
  if (!connectSourceNodeId || !editableGraph) return false;
  const sourceNodeId = connectSourceNodeId;
  if (sourceNodeId === targetNodeId) {
    presentAtomEditor(sourceNodeId, "Choose a different atom to complete the bond.");
    return true;
  }
  const previousFragmentCount = connectedBondFragments(editableGraph).length;
  const result = addEditableBond(editableGraph, sourceNodeId, targetNodeId);
  if (!result.changed) {
    presentAtomEditor(sourceNodeId, result.reason);
    return true;
  }
  pushEditorHistory("Form bond");
  editableGraph = result.graph;
  connectSourceNodeId = null;
  selectedAtomId = null;
  selectedBondId = result.bond.id;
  const nextFragmentCount = connectedBondFragments(editableGraph).length;
  renderEditableStructure();
  presentBondEditor(result.bond.id, nextFragmentCount < previousFragmentCount ? "Bond formed. The fragments are joined again." : result.reason);
  return true;
}

function adjustSelectedBond(delta, verb) {
  if (!selectedBondId || !editableGraph) return;
  pushEditorHistory(verb);
  const result = adjustBondIntegrity(editableGraph, selectedBondId, delta);
  if (!result.changed) return;
  editableGraph = result.graph;
  renderEditableStructure();
  const quality = bondStability(result.bond.integrity);
  presentBondEditor(result.bond.id, `${verb}. The bond is now ${quality.label.toLocaleLowerCase("en-US")}.`);
}

function wordFractureDescription(graph, originalWord = currentSettings().word) {
  const words = deriveWordFragments(graph).map((fragment) => fragment.word);
  if (words.length === 1 && words[0] === originalWord) return `${originalWord} still holds together.`;
  if (!words.length) return `${originalWord} has no stable word structure left.`;
  return `${originalWord} split into ${words.join(" + ")}.`;
}

function weakenSelectedBond() {
  if (!selectedBondId || !editableGraph) return;
  const bondId = selectedBondId;
  pushEditorHistory("Weaken bond");
  const result = weakenEditableBond(editableGraph, bondId, 20);
  if (!result.changed) return;
  editableGraph = result.graph;
  if (!result.snapped) {
    renderEditableStructure();
    const quality = bondStability(result.bond.integrity);
    presentBondEditor(result.bond.id, `Bond weakened. It is now ${quality.label.toLocaleLowerCase("en-US")}. At 15% it will snap.`);
    return;
  }
  selectedBondId = null;
  selectedAtomId = null;
  connectSourceNodeId = null;
  renderEditableStructure();
  const words = deriveWordFragments(editableGraph);
  const wordSplit = words.length !== 1 || words[0]?.word !== currentSettings().word;
  if (wordSplit) {
    presentEditorNotice(`${words.length} resulting word${words.length === 1 ? "" : "s"}`, `The bond failed at ${result.bond.integrity}%. ${wordFractureDescription(editableGraph)}`);
  } else if (result.didSplit) {
    presentEditorNotice("Physical split", `The bond failed at ${result.bond.integrity}%, but the canonical word rule is unchanged.`);
  } else {
    presentEditorNotice("Bond snapped", `The bond failed at ${result.bond.integrity}%. ${wordFractureDescription(editableGraph)}`);
  }
}

function breakSelectedBond() {
  if (!selectedBondId || !editableGraph) return;
  const bondId = selectedBondId;
  pushEditorHistory("Break bond");
  const result = removeEditableBond(editableGraph, bondId);
  if (!result.changed) return;
  editableGraph = result.graph;
  selectedBondId = null;
  selectedAtomId = null;
  connectSourceNodeId = null;
  renderEditableStructure();
  const words = deriveWordFragments(editableGraph);
  const wordSplit = words.length !== 1 || words[0]?.word !== currentSettings().word;
  if (wordSplit) {
    presentEditorNotice(`${words.length} resulting word${words.length === 1 ? "" : "s"}`, wordFractureDescription(editableGraph));
  } else if (result.didSplit) {
    presentEditorNotice("Physical split", "The structure separated, but no recipe rule changed the word identity.");
  } else {
    presentEditorNotice("Ring opened", `The bond broke, but another path still holds the structure together. ${wordFractureDescription(editableGraph)}`);
  }
}

function undoBondEdit() {
  const snapshot = editorHistory.pop();
  if (!snapshot) return;
  editableGraph = createEditableBondGraph(snapshot.graph);
  selectedBondId = snapshot.selectedBondId;
  selectedAtomId = snapshot.selectedAtomId;
  connectSourceNodeId = null;
  renderEditableStructure();
  if (selectedBondId && editableBond(selectedBondId)) {
    presentBondEditor(selectedBondId, `Undid: ${snapshot.action}.`);
  } else if (selectedAtomId && editableNode(selectedAtomId)) {
    presentAtomEditor(selectedAtomId, `Undid: ${snapshot.action}.`);
  } else {
    presentEditorNotice("Change undone", snapshot.action);
  }
  elements.bondUndo.disabled = editorHistory.length === 0;
}

function positionHoverPreview(node = elements.activeNode) {
  if (!node) return;
  const rect = node.getBoundingClientRect();
  const bubbleHalfWidth = Math.min(504, window.innerWidth - 24, window.innerHeight - 24) / 2;
  const left = Math.max(bubbleHalfWidth + 10, Math.min(window.innerWidth - bubbleHalfWidth - 10, rect.left + rect.width / 2));
  elements.hoverPreview.style.left = `${left}px`;
  elements.hoverPreview.style.top = `${rect.top + rect.height / 2}px`;
  positionBondEditor();
}

function applyMoleculeView() {
  elements.hoverPreview.style.setProperty("--inspect-pan-x", `${moleculeView.x}px`);
  elements.hoverPreview.style.setProperty("--inspect-pan-y", `${moleculeView.y}px`);
  elements.hoverPreview.style.setProperty("--inspect-zoom", String(moleculeView.zoom));
  elements.hoverPreview.style.setProperty("--inspect-rotate-x", `${moleculeView.rotationX}deg`);
  elements.hoverPreview.style.setProperty("--inspect-rotate-y", `${moleculeView.rotationY}deg`);
  scheduleMoleculeLabelSync();
}

function showHoverPreview(node) {
  if (!node) return;
  const settings = settingsFromNode(node);
  const signature = structureSignature(settings);
  const graph = activeStructureGraph && activeStructureSignature === signature
    ? activeStructureGraph
    : createEditableBondGraph(graphForSettings(settings));
  positionHoverPreview(node);
  elements.hoverPreview.style.setProperty("--node-accent", settings.accent);
  elements.hoverPreview.style.setProperty("--node-motion-duration", `${settings.duration}s`);
  elements.hoverPreview.dataset.motion = settings.motion ? "running" : "paused";
  elements.hoverPreview.dataset.placement = "center";
  editableGraph = createEditableBondGraph(graph);
  editorBaselineGraph = createEditableBondGraph(graph);
  editorDirty = false;
  editableAccent = settings.accent;
  selectedBondId = null;
  selectedAtomId = null;
  connectSourceNodeId = null;
  editorHistory = [];
  editorFragments = connectedBondFragments(editableGraph);
  hideBondEditor();
  moleculeView = { x: 0, y: 0, zoom: 1, rotationX: -15, rotationY: -18 };
  applyMoleculeView();
  renderEditableStructure();
  hoverPreviewOpen = true;
  elements.hoverPreview.hidden = false;
  elements.hoverPreview.setAttribute("aria-hidden", "false");
  scheduleMoleculeLabelSync();
}

function hideHoverPreview() {
  hoverPreviewOpen = false;
  moleculeGesture = null;
  if (moleculeLabelSyncFrame) cancelAnimationFrame(moleculeLabelSyncFrame);
  moleculeLabelSyncFrame = 0;
  moleculeLabelSyncUntil = 0;
  elements.hoverPreview.classList.remove("is-dragging", "is-panning", "is-rotating", "is-atom-focused", "is-fragmented", "is-connecting");
  elements.hoverPreview.hidden = true;
  elements.hoverPreview.setAttribute("aria-hidden", "true");
  hideBondEditor();
  editableGraph = null;
  editorBaselineGraph = null;
  editorDirty = false;
  elements.hoverPreview.dataset.draftState = "clean";
  elements.hoverApply.disabled = true;
  selectedBondId = null;
  selectedAtomId = null;
  connectSourceNodeId = null;
  editorFragments = [];
}

function cancelLongHoverArming() {
  if (hoverPreviewTimer) window.clearTimeout(hoverPreviewTimer);
  hoverPreviewTimer = 0;
  elements.activeNode.classList.remove("is-hover-arming");
}

function closeHoverPreview() {
  cancelLongHoverArming();
  elements.activeNode.classList.remove("is-inspecting");
  elements.stage.classList.remove("is-structure-inspecting");
  elements.activeNode.setAttribute("aria-expanded", "false");
  hideHoverPreview();
}

function cancelStructureDraft() {
  closeHoverPreview();
}

function applyStructureDraft() {
  if (!editableGraph || !editorDirty) return;
  const committedGraph = createEditableBondGraph(editableGraph);
  applyActiveStructureGraph(committedGraph, currentSettings());
  editorBaselineGraph = createEditableBondGraph(committedGraph);
  editorDirty = false;
  closeHoverPreview();
}

function enterStructurePreview() {
  if (hoverPreviewOpen) return;
  cancelLongHoverArming();
  elements.activeNode.classList.add("is-inspecting");
  elements.stage.classList.add("is-structure-inspecting");
  elements.activeNode.setAttribute("aria-expanded", "true");
  showHoverPreview(elements.activeNode);
}

function startLongHoverPreview() {
  if (hoverPreviewOpen || hoverPreviewTimer) return;
  cancelLongHoverArming();
  elements.activeNode.classList.add("is-hover-arming");
  hoverPreviewTimer = window.setTimeout(() => {
    hoverPreviewTimer = 0;
    enterStructurePreview();
  }, HOVER_PREVIEW_DELAY_MS);
}

function handleActiveNodeStructureEntry(event) {
  if (!event.shiftKey) return;
  event.preventDefault();
  enterStructurePreview();
}

function leaveLongHoverTarget() {
  if (!hoverPreviewOpen) cancelLongHoverArming();
}

function clampRotationX(value) {
  return Math.max(-78, Math.min(78, value));
}

function beginMoleculeGesture(event) {
  if (!hoverPreviewOpen) return;
  if (event.shiftKey) return;
  if (event.target.closest?.(".lab-molecule-3d__atom, .lab-molecule-3d__bond-hit, .lab-hover-bubble__cancel, .lab-hover-bubble__apply")) return;
  const isMouse = event.pointerType === "mouse";
  if (isMouse && event.button !== 0 && event.button !== 1) return;
  event.preventDefault();
  const mode = isMouse && event.button === 1 ? "rotate" : "pan";
  moleculeGesture = {
    pointerId: event.pointerId,
    mode,
    startX: event.clientX,
    startY: event.clientY,
    panX: moleculeView.x,
    panY: moleculeView.y,
    rotationX: moleculeView.rotationX,
    rotationY: moleculeView.rotationY,
    moved: false
  };
  elements.hoverPreview.classList.add("is-dragging", mode === "rotate" ? "is-rotating" : "is-panning");
  elements.hoverPreview.setPointerCapture?.(event.pointerId);
}

function moveMoleculeGesture(event) {
  if (!moleculeGesture || moleculeGesture.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - moleculeGesture.startX;
  const deltaY = event.clientY - moleculeGesture.startY;
  if (Math.hypot(deltaX, deltaY) > 3) moleculeGesture.moved = true;
  if (moleculeGesture.mode === "rotate") {
    moleculeView.rotationX = clampRotationX(moleculeGesture.rotationX - deltaY * .52);
    moleculeView.rotationY = moleculeGesture.rotationY + deltaX * .68;
  } else {
    moleculeView.x = moleculeGesture.panX + deltaX;
    moleculeView.y = moleculeGesture.panY + deltaY;
  }
  applyMoleculeView();
}

function endMoleculeGesture(event) {
  if (!moleculeGesture || moleculeGesture.pointerId !== event.pointerId) return;
  const wasMoved = moleculeGesture.moved;
  if (elements.hoverPreview.hasPointerCapture?.(event.pointerId)) {
    elements.hoverPreview.releasePointerCapture(event.pointerId);
  }
  moleculeGesture = null;
  elements.hoverPreview.classList.remove("is-dragging", "is-panning", "is-rotating");
  if (wasMoved) suppressAtomClickUntil = performance.now() + 120;
}

function clampMoleculeZoom(value) {
  return Math.max(.35, Math.min(4.5, value));
}

function zoomMolecule(event) {
  if (!hoverPreviewOpen) return;
  event.preventDefault();
  event.stopPropagation();
  const deltaModeScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? elements.hoverPreview.clientHeight : 1;
  const nextZoom = clampMoleculeZoom(moleculeView.zoom * Math.exp(-event.deltaY * deltaModeScale * .0016));
  if (Math.abs(nextZoom - moleculeView.zoom) < .001) return;
  const rect = elements.hoverPreview.getBoundingClientRect();
  const pointerX = event.clientX - (rect.left + rect.width / 2);
  const pointerY = event.clientY - (rect.top + rect.height / 2);
  const localX = (pointerX - moleculeView.x) / moleculeView.zoom;
  const localY = (pointerY - moleculeView.y) / moleculeView.zoom;
  moleculeView.x = pointerX - localX * nextZoom;
  moleculeView.y = pointerY - localY * nextZoom;
  moleculeView.zoom = nextZoom;
  applyMoleculeView();
}

function selectMoleculeAtom(atom, { allowConnection = true } = {}) {
  if (!atom) return;
  const nodeId = atom.dataset.nodeId;
  if (allowConnection && connectSourceNodeId && completeBondConnection(nodeId)) return;
  selectedAtomId = nodeId;
  selectedBondId = null;
  elements.hoverStructure3d.querySelectorAll(".lab-molecule-3d__atom").forEach((candidate) => {
    const selected = candidate === atom;
    candidate.classList.toggle("is-selected", selected);
    candidate.setAttribute("aria-pressed", selected ? "true" : "false");
    if (!selected) candidate.classList.remove("is-focused");
  });
  elements.hoverStructure3d.querySelectorAll(".lab-molecule-3d__bond, .lab-molecule-3d__bond-hit").forEach((candidate) => {
    candidate.classList.remove("is-selected");
  });
  presentAtomEditor(nodeId, connectSourceNodeId ? "Choose a different atom to complete the bond." : undefined);
}

function selectMoleculeBond(bondHit) {
  const bondId = bondHit?.dataset.bondId;
  if (!bondId || !editableBond(bondId)) return;
  selectedBondId = bondId;
  selectedAtomId = null;
  connectSourceNodeId = null;
  elements.hoverPreview.classList.remove("is-connecting", "is-atom-focused");
  elements.hoverStructure3d.querySelectorAll(".lab-molecule-3d__atom").forEach((atom) => {
    atom.classList.remove("is-selected", "is-focused", "is-connect-source");
    atom.setAttribute("aria-pressed", "false");
  });
  elements.hoverStructure3d.querySelectorAll(".lab-molecule-3d__bond, .lab-molecule-3d__bond-hit").forEach((candidate) => {
    candidate.classList.toggle("is-selected", candidate.dataset.bondId === bondId);
  });
  presentBondEditor(bondId);
}

function moleculeAtomFromEvent(event) {
  const directAtom = event.target.closest?.(".lab-molecule-3d__atom");
  if (directAtom) return directAtom;
  let nearestAtom = null;
  let nearestDistance = Infinity;
  elements.hoverStructure3d.querySelectorAll(".lab-molecule-3d__atom").forEach((atom) => {
    const rect = atom.getBoundingClientRect();
    const distance = Math.hypot(
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2)
    );
    const hitRadius = Math.max(16, Math.max(rect.width, rect.height) * .58);
    if (distance <= hitRadius && distance < nearestDistance) {
      nearestAtom = atom;
      nearestDistance = distance;
    }
  });
  return nearestAtom;
}

function handleMoleculeStructureClick(event) {
  const atom = moleculeAtomFromEvent(event);
  if (atom && performance.now() >= suppressAtomClickUntil) {
    if (event.shiftKey) {
      event.preventDefault();
      focusMoleculeAtom(atom);
      return;
    }
    selectMoleculeAtom(atom);
    elements.hoverPreview.classList.remove("is-atom-focused");
    atom.classList.remove("is-focused");
    return;
  }
  const bondHit = event.target.closest?.(".lab-molecule-3d__bond-hit");
  if (bondHit && performance.now() >= suppressAtomClickUntil) selectMoleculeBond(bondHit);
}

function focusMoleculeAtom(atom) {
  if (!atom) return;
  selectMoleculeAtom(atom, { allowConnection: false });
  const bubbleRect = elements.hoverPreview.getBoundingClientRect();
  const atomRect = atom.getBoundingClientRect();
  const offsetX = atomRect.left + atomRect.width / 2 - (bubbleRect.left + bubbleRect.width / 2);
  const offsetY = atomRect.top + atomRect.height / 2 - (bubbleRect.top + bubbleRect.height / 2);
  const nextZoom = Math.max(FOCUSED_ATOM_ZOOM, moleculeView.zoom);
  const ratio = nextZoom / moleculeView.zoom;
  moleculeView.x = -ratio * (offsetX - moleculeView.x);
  moleculeView.y = -ratio * (offsetY - moleculeView.y);
  moleculeView.zoom = nextZoom;
  applyMoleculeView();
  atom.classList.add("is-focused");
  elements.hoverPreview.classList.add("is-atom-focused");
}

function toggleBondConnectionMode() {
  if (!selectedAtomId || !editableNode(selectedAtomId)) return;
  if (connectSourceNodeId) {
    connectSourceNodeId = null;
    elements.hoverPreview.classList.remove("is-connecting");
    elements.hoverStructure3d.querySelectorAll(".lab-molecule-3d__atom").forEach((atom) => atom.classList.remove("is-connect-source"));
    presentAtomEditor(selectedAtomId, "Bond creation cancelled.");
    return;
  }
  connectSourceNodeId = selectedAtomId;
  elements.hoverPreview.classList.add("is-connecting");
  elements.hoverStructure3d.querySelector(`.lab-molecule-3d__atom[data-node-id="${CSS.escape(selectedAtomId)}"]`)?.classList.add("is-connect-source");
  presentAtomEditor(selectedAtomId, "Select another atom to form a new strained bond.");
}

function applyGraphPresentation(node, settings, graph, { hero = false } = {}) {
  if (!node) return bondGraphEffects(graph);
  const label = node.querySelector(".lab-word-node__label");
  const structure = node.querySelector(".lab-word-node__structure");
  const effects = bondGraphEffects(graph);
  const fragmentWords = deriveWordFragments(graph);
  if (label) label.textContent = settings.word;
  node.dataset.word = settings.word;
  node.dataset.components = settings.components.join("|");
  node.dataset.intermediates = settings.intermediates.join("|");
  node.dataset.combinations = String(graph.combinationCount);
  node.dataset.bonds = String(graph.bondCount);
  node.dataset.fragments = String(effects.fragmentCount);
  node.dataset.words = String(fragmentWords.length);
  node.dataset.splitWords = fragmentWords.map((fragment) => fragment.word).join("|");
  node.dataset.cohesion = String(effects.cohesion);
  node.dataset.reactivity = String(effects.reactivity);
  node.dataset.structureState = effects.state.key;
  node.dataset.motion = settings.motion ? "running" : "paused";
  node.style.setProperty("--node-accent", settings.accent);
  node.style.setProperty("--node-structure-opacity", String(settings.opacity / 100));
  node.style.setProperty("--node-motion-duration", `${settings.duration}s`);
  node.style.setProperty("--node-effective-motion-duration", `${Math.max(3, settings.duration * (1 - effects.reactivity * .0045)).toFixed(2)}s`);
  node.style.setProperty("--node-reactivity", String(effects.reactivity / 100));
  node.style.setProperty("--node-scale", String(settings.scale / 100));
  const componentLabel = `${graph.componentCount} component${graph.componentCount === 1 ? "" : "s"}`;
  const combinationLabel = `${graph.combinationCount} combination${graph.combinationCount === 1 ? "" : "s"}`;
  const splitLabel = effects.fragmentCount > 1 && fragmentWords.length
    ? `; split into ${fragmentWords.map((fragment) => fragment.word).join(", ")}`
    : "";
  node.setAttribute("aria-label", `${settings.word} word node${hero ? " preview" : ""}; ${componentLabel}, ${combinationLabel}, ${effects.state.label.toLocaleLowerCase("en-US")}, ${effects.cohesion}% cohesion${splitLabel}`);
  buildStructure(structure, graph);
  return effects;
}

function applySettings(node, settings, { hero = false } = {}) {
  const graph = createEditableBondGraph(graphForSettings(settings));
  applyGraphPresentation(node, settings, graph, { hero });
  return graph;
}

function selectedBreakGoal() {
  return breakGoals.find((goal) => goal.id === elements.breakGoalSelect.value) || breakGoals[0] || null;
}

function syncGoalBondHighlights() {
  const ruleIds = new Set(activeBreakGoal?.ruleIds || []);
  elements.hoverStructure3d.querySelectorAll(".lab-molecule-3d__bond, .lab-molecule-3d__bond-hit").forEach((bond) => {
    bond.classList.toggle("is-goal-bond", ruleIds.has(bond.dataset.ruleId));
  });
}

function describeGoalRule(goal, graph) {
  if (!goal) return "Recipe bonds decide words. Support bonds only change stability.";
  const ruleById = new Map((graph.reactionRules || []).map((rule) => [rule.id, rule]));
  const outputs = goal.ruleIds.map((ruleId) => ruleById.get(ruleId)?.output).filter(Boolean);
  return `Sever one recipe bond for ${outputs.join(" + ")}. Support bonds never change the resulting words.`;
}

function syncBreakGoalCatalog(graph, settings) {
  const signature = structureSignature(settings);
  if (signature === breakGoalCatalogSignature) return;
  breakGoalCatalogSignature = signature;
  breakGoals = canonicalBreakGoals(graph);
  activeBreakGoal = null;
  elements.breakGoalSelect.replaceChildren();
  elements.stage.dataset.goalState = "idle";

  if (!breakGoals.length) {
    const option = document.createElement("option");
    option.textContent = "Base elements cannot be decomposed";
    elements.breakGoalSelect.append(option);
    elements.breakGoalSelect.disabled = true;
    elements.breakGoalStart.disabled = true;
    elements.breakGoalTitle.textContent = `${settings.word} is elemental`;
    elements.breakGoalRule.textContent = "It has no recipe bonds, so weakening cannot create smaller words.";
    elements.breakGoalStatus.dataset.state = "idle";
    elements.breakGoalStatus.textContent = "No goal";
    return;
  }

  breakGoals.forEach((goal) => {
    const option = document.createElement("option");
    option.value = goal.id;
    option.textContent = goal.label;
    elements.breakGoalSelect.append(option);
  });
  elements.breakGoalSelect.disabled = false;
  elements.breakGoalStart.disabled = false;
  elements.breakGoalStart.textContent = "Start goal";
}

function updateBreakGoalProgress(graph) {
  const goal = activeBreakGoal || selectedBreakGoal();
  if (!goal) return;
  syncGoalBondHighlights();
  elements.breakGoalTitle.textContent = goal.label;
  elements.breakGoalRule.textContent = describeGoalRule(goal, graph);
  const evaluation = evaluateBreakGoal(graph, goal);
  if (!activeBreakGoal) {
    elements.breakGoalStatus.dataset.state = "idle";
    elements.breakGoalStatus.textContent = `Ready · ${goal.ruleIds.length} recipe cut${goal.ruleIds.length === 1 ? "" : "s"}`;
    elements.stage.dataset.goalState = "idle";
    return;
  }
  if (evaluation.achieved) {
    elements.breakGoalStatus.dataset.state = "reached";
    elements.breakGoalStatus.textContent = "Goal reached";
    elements.stage.dataset.goalState = "reached";
    elements.breakGoalStart.textContent = "Restart goal";
    return;
  }
  elements.breakGoalStatus.dataset.state = "active";
  elements.breakGoalStatus.textContent = `${evaluation.completedRules}/${evaluation.totalRules} recipe cuts · ${evaluation.currentWords.join(" + ")}`;
  elements.stage.dataset.goalState = "active";
  elements.breakGoalStart.textContent = "Restart goal";
}

function startSelectedBreakGoal() {
  activeBreakGoal = selectedBreakGoal();
  if (!activeBreakGoal || !activeStructureGraph) return;
  updateBreakGoalProgress(activeStructureGraph);
}

function renderWordSplit(graph, effects, settings) {
  const fragmentWords = deriveWordFragments(graph);
  const isSplit = !(fragmentWords.length === 1 && fragmentWords[0].word === settings.word);
  elements.stage.dataset.wordSplit = String(isSplit);
  elements.wordSplit.hidden = !isSplit;
  elements.wordSplitTokens.replaceChildren();
  if (!isSplit) return fragmentWords;

  const names = fragmentWords.map((fragment) => fragment.word);
  elements.wordSplitFormula.textContent = `${settings.word} → ${names.length ? names.join(" + ") : "no stable word"}`;
  fragmentWords.forEach((fragment, index) => {
    const token = document.createElement("span");
    token.className = "lab-word-split__token";
    token.textContent = fragment.word;
    token.dataset.word = fragment.word;
    token.dataset.fragment = String(fragment.fragmentIndex);
    token.style.setProperty("--word-index", String(index));
    token.style.setProperty("--fragment-index", String(fragment.fragmentIndex));
    token.title = `Survives from ${fragment.sourceWords.join(" + ")}`;
    elements.wordSplitTokens.append(token);
  });
  return fragmentWords;
}

function updateStructureReadouts(graph, effects, settings) {
  syncBreakGoalCatalog(graph, settings);
  const fragmentWords = renderWordSplit(graph, effects, settings);
  elements.lineageFormula.textContent = `${describeGraph(graph)}  ·  ${effects.state.label} structure`;
  elements.readoutComponents.textContent = String(graph.componentCount);
  elements.readoutCombinations.textContent = String(graph.combinationCount);
  elements.readoutBonds.textContent = String(graph.bondCount);
  elements.readoutFragments.textContent = String(effects.fragmentCount);
  elements.readoutWords.textContent = String(fragmentWords.length);
  elements.readoutCohesion.textContent = `${effects.cohesion}%`;
  elements.readoutReactivity.textContent = `${effects.reactivity}%`;
  elements.readoutState.textContent = effects.state.label;
  elements.stage.dataset.structureState = effects.state.key;
  elements.stage.style.setProperty("--stage-reactivity", String(effects.reactivity / 100));
  elements.stage.style.setProperty("--stage-accent", settings.accent);
  updateBreakGoalProgress(graph);
}

function applyActiveStructureGraph(graph, settings = currentSettings(), { persist = true } = {}) {
  const signature = structureSignature(settings);
  activeStructureGraph = createEditableBondGraph(graph);
  activeStructureSignature = signature;
  const effects = applyGraphPresentation(elements.activeNode, settings, activeStructureGraph, { hero: true });
  if (activeSource) {
    applyGraphPresentation(activeSource, settings, activeStructureGraph);
    if (persist) {
      structureEditsBySource.set(activeSource, {
        signature,
        graph: createEditableBondGraph(activeStructureGraph)
      });
    }
  }
  updateStructureReadouts(activeStructureGraph, effects, settings);
  return effects;
}

function updatePreview() {
  closeHoverPreview();
  const settings = currentSettings();
  const baseGraph = applySettings(elements.activeNode, settings, { hero: true });
  const signature = structureSignature(settings);
  const saved = activeSource ? structureEditsBySource.get(activeSource) : null;
  const graph = saved?.signature === signature ? saved.graph : baseGraph;
  elements.controlTitle.textContent = settings.word;
  elements.scaleOutput.value = `${settings.scale}%`;
  elements.opacityOutput.value = `${settings.opacity}%`;
  elements.durationOutput.value = `${settings.duration}s`;
  applyActiveStructureGraph(graph, settings, { persist: false });
}

function populateControls(settings) {
  activeIntermediates = [...(settings.intermediates || [])];
  elements.word.value = cleanWord(settings.word);
  elements.components.value = (settings.components?.length ? settings.components : DEFAULT_NODE.components).join(", ");
  elements.accent.value = settings.accent;
  elements.scale.value = String(settings.scale ?? DEFAULT_NODE.scale);
  elements.opacity.value = String(settings.opacity ?? DEFAULT_NODE.opacity);
  elements.duration.value = String(settings.duration ?? DEFAULT_NODE.duration);
  elements.motion.checked = settings.motion ?? DEFAULT_NODE.motion;
  updatePreview();
}

function settingsFromNode(node) {
  return {
    word: node.dataset.word || node.querySelector(".lab-word-node__label")?.textContent || DEFAULT_NODE.word,
    components: parseList(node.dataset.components),
    intermediates: parseList(node.dataset.intermediates, "|"),
    accent: node.dataset.accent || getComputedStyle(node).getPropertyValue("--node-accent").trim() || DEFAULT_NODE.accent,
    scale: Number(node.dataset.scale || DEFAULT_NODE.scale),
    opacity: Number(node.dataset.opacity || DEFAULT_NODE.opacity),
    duration: Number(node.dataset.duration || DEFAULT_NODE.duration),
    motion: node.dataset.motion !== "paused"
  };
}

function selectSource(node) {
  if (!node) return;
  document.querySelectorAll(".lab-node-rack .lab-word-node").forEach((candidate) => {
    candidate.setAttribute("aria-pressed", candidate === node ? "true" : "false");
  });
  if (activeSource !== node) {
    breakGoalCatalogSignature = "";
    activeBreakGoal = null;
  }
  activeSource = node;
  populateControls(settingsFromNode(node));
}

function prepareNode(node) {
  const settings = settingsFromNode(node);
  node.dataset.accent = settings.accent;
  node.dataset.scale = String(settings.scale);
  node.dataset.opacity = String(settings.opacity);
  node.dataset.duration = String(settings.duration);
  node.dataset.motion = settings.motion ? "running" : "paused";
  applySettings(node, settings);
}

function saveVariant() {
  const settings = currentSettings();
  const signature = structureSignature(settings);
  const node = document.createElement("button");
  node.type = "button";
  node.className = "lab-word-node";
  node.dataset.variantId = String(++variantCount);
  node.dataset.word = settings.word;
  node.dataset.components = settings.components.join("|");
  node.dataset.intermediates = settings.intermediates.join("|");
  node.dataset.accent = settings.accent;
  node.dataset.scale = String(settings.scale);
  node.dataset.opacity = String(settings.opacity);
  node.dataset.duration = String(settings.duration);
  node.dataset.motion = settings.motion ? "running" : "paused";
  node.setAttribute("aria-pressed", "false");
  node.innerHTML = '<span class="lab-word-node__structure" aria-hidden="true"></span><span class="lab-word-node__label"></span>';
  const baseGraph = applySettings(node, settings);
  const graph = activeStructureGraph && activeStructureSignature === signature
    ? createEditableBondGraph(activeStructureGraph)
    : baseGraph;
  applyGraphPresentation(node, settings, graph);
  structureEditsBySource.set(node, { signature, graph: createEditableBondGraph(graph) });
  elements.variantRack.append(node);
  elements.variantEmpty.textContent = `${variantCount} saved variant${variantCount === 1 ? "" : "s"}. Click one to reload it.`;
  selectSource(node);
}

elements.sampleRack.addEventListener("click", (event) => {
  selectSource(event.target.closest(".lab-word-node"));
});

elements.variantRack.addEventListener("click", (event) => {
  selectSource(event.target.closest(".lab-word-node"));
});

elements.activeNode.addEventListener("pointerenter", startLongHoverPreview);
elements.activeNode.addEventListener("pointerleave", leaveLongHoverTarget);
elements.activeNode.addEventListener("focus", startLongHoverPreview);
elements.activeNode.addEventListener("blur", leaveLongHoverTarget);
elements.activeNode.addEventListener("click", handleActiveNodeStructureEntry);
elements.hoverPreview.addEventListener("pointerdown", beginMoleculeGesture);
elements.hoverPreview.addEventListener("pointermove", moveMoleculeGesture);
elements.hoverPreview.addEventListener("pointerup", endMoleculeGesture);
elements.hoverPreview.addEventListener("pointercancel", endMoleculeGesture);
elements.hoverPreview.addEventListener("wheel", zoomMolecule, { passive: false });
elements.hoverStructure3d.addEventListener("click", handleMoleculeStructureClick);
elements.bondWeaken.addEventListener("click", weakenSelectedBond);
elements.bondStrengthen.addEventListener("click", () => adjustSelectedBond(20, "Bond strengthened"));
elements.bondBreak.addEventListener("click", breakSelectedBond);
elements.bondConnect.addEventListener("click", toggleBondConnectionMode);
elements.bondUndo.addEventListener("click", undoBondEdit);
window.addEventListener("scroll", () => {
  if (hoverPreviewOpen) positionHoverPreview();
}, { passive: true });
window.addEventListener("resize", () => {
  if (hoverPreviewOpen) positionHoverPreview();
});
function guardExplicitDraftDecision(event) {
  if (!hoverPreviewOpen || elements.hoverPreview.contains(event.target) || elements.bondEditor.contains(event.target)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  elements.hoverPreview.classList.remove("needs-decision");
  requestAnimationFrame(() => elements.hoverPreview.classList.add("needs-decision"));
  window.setTimeout(() => elements.hoverPreview.classList.remove("needs-decision"), 260);
}

document.addEventListener("pointerdown", guardExplicitDraftDecision, true);
document.addEventListener("click", guardExplicitDraftDecision, true);
document.addEventListener("keydown", (event) => {
  if (hoverPreviewOpen && event.key === "Escape") cancelStructureDraft();
});

[elements.word, elements.accent, elements.scale, elements.opacity, elements.duration].forEach((control) => {
  control.addEventListener("input", updatePreview);
});
elements.components.addEventListener("input", () => {
  activeIntermediates = [];
  updatePreview();
});
elements.motion.addEventListener("change", updatePreview);
elements.hoverApply.addEventListener("click", applyStructureDraft);
elements.hoverCancel.addEventListener("click", cancelStructureDraft);
elements.breakGoalSelect.addEventListener("change", () => {
  activeBreakGoal = null;
  if (activeStructureGraph) updateBreakGoalProgress(activeStructureGraph);
});
elements.breakGoalStart.addEventListener("click", startSelectedBreakGoal);
elements.save.addEventListener("click", saveVariant);
elements.reset.addEventListener("click", () => {
  activeSource = null;
  breakGoalCatalogSignature = "";
  activeBreakGoal = null;
  document.querySelectorAll(".lab-node-rack .lab-word-node").forEach((node) => node.setAttribute("aria-pressed", "false"));
  populateControls(DEFAULT_NODE);
});

document.querySelectorAll(".lab-node-rack .lab-word-node").forEach(prepareNode);
activeSource = elements.sampleRack.querySelector(".lab-word-node");
selectSource(activeSource);
