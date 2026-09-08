import {
  conceptMatterCapabilities,
  createConceptMatterOperation,
  findConceptMatterReassembly,
  normalizeConceptMatterRepresentation,
  sanitizeConceptMatterState,
  settleConceptMatterOperation
} from "./concept-matter.mjs?v=5.0.0-beta.4";
import { createConceptMatterRuntime } from "./concept-matter-runtime.mjs?v=5.0.0-beta.4";
import { MASTERY_CATALOG } from "./mastery-catalog.mjs?v=5.0.0-beta.4";

export const CONCEPT_MATTER_VIEW_KEY = "constellore-concept-matter-view-v1";
const STARTER_EMOJI = { Earth: "🌌", Water: "💧", Fire: "🔥", Air: "💨" };
const STARTER_CATEGORY = { Earth: "nature", Water: "force", Fire: "force", Air: "force" };

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function conceptMatterContext(state, getBoardMode, learningOrbitActive) {
  const boardMode = getBoardMode();
  const projectRules = asRecord(state.journeyContext?.conceptMatterRules);
  return {
    mode: boardMode,
    gameplayMode: state.mode || boardMode,
    tutorial: learningOrbitActive(),
    scriptedTutorialEdit: Boolean(state.game?.conceptMatterLesson?.allowPeel),
    sandbox: state.mode === "explore",
    project: boardMode === "project",
    projectRules,
    ranked: Boolean(state.run?.ranked),
    leaderboardEligible: Boolean(state.game?.leaderboardEligible || state.run?.ranked),
    scoreEligible: state.mode === "explore"
      ? false
      : !state.scoringDisabled && state.run?.scoreEligible !== false && state.game?.scoreEligible !== false,
    rewardEligible: state.mode === "explore" ? false : state.game?.rewardEligible !== false,
    multiplayer: state.mode === "scramble",
    matchFinished: state.mode === "scramble" && state.finished,
    reveal: Boolean(state.reveal?.active || state.reveal?.pending),
    finished: Boolean(state.finished && state.mode !== "scramble"),
    allowSoloPeel: true
  };
}

function fragmentPosition(sourceNode, sourceSize, fragmentSize, index, count) {
  const centerX = Number(sourceNode.x) + Number(sourceSize.width) / 2;
  const centerY = Number(sourceNode.y) + Number(sourceSize.height) / 2;
  if (count === 2) {
    const direction = index === 0 ? -1 : 1;
    return {
      x: centerX + direction * 58 - fragmentSize.width / 2,
      y: centerY + direction * 12 - fragmentSize.height / 2
    };
  }
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, count);
  const radius = Math.min(96, 54 + count * 9);
  return {
    x: centerX + Math.cos(angle) * radius - fragmentSize.width / 2,
    y: centerY + Math.sin(angle) * radius - fragmentSize.height / 2
  };
}

function escapedId(value) {
  const text = String(value);
  return globalThis.CSS?.escape ? globalThis.CSS.escape(text) : text.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

export function createConceptMatterAppController({
  documentRef = globalThis.document,
  viewWindow = globalThis.window,
  storage = globalThis.localStorage,
  state,
  elements = {},
  getBoardMode,
  learningOrbitActive,
  getRouteGuide,
  closeMolecularMemoryPanels,
  closeWordOrbit,
  inventoryKey,
  masteryCatalog = MASTERY_CATALOG,
  starterEmoji = STARTER_EMOJI,
  starterCategory = STARTER_CATEGORY,
  maxBoardNodes = 180,
  boardHistorySnapshot,
  measureBoardWord,
  getNodeInstance,
  destroyMolecularMemory,
  addNode,
  renderInventory,
  renderBoard,
  commitBoardEdit,
  scheduleRunSave,
  cancelTapChain,
  constrainBoardNodes,
  showAlchemy,
  playFeedback,
  track,
  onBoardGeometryChange = () => {}
} = {}) {
  if (!state || typeof getBoardMode !== "function" || typeof learningOrbitActive !== "function") {
    throw new TypeError("Concept Matter app controller requires state and play-mode adapters.");
  }

  const boardItems = elements.boardItems;
  const gameScreen = elements.gameScreen;
  const status = elements.status || elements.conceptMatterStatus;
  const viewToggle = elements.viewToggle || elements.conceptMatterViewToggle;
  let storedRepresentation = null;
  try { storedRepresentation = storage?.getItem?.(CONCEPT_MATTER_VIEW_KEY); } catch {}
  state.conceptMatter = sanitizeConceptMatterState({
    ...state.conceptMatter,
    ...(storedRepresentation ? { representation: storedRepresentation } : {})
  });

  const capabilities = () => conceptMatterCapabilities(conceptMatterContext(state, getBoardMode, learningOrbitActive));
  const representation = () => normalizeConceptMatterRepresentation(state.conceptMatter?.representation);
  const announce = (message) => {
    if (status) status.textContent = message;
  };

  function syncControls() {
    if (!viewToggle) return;
    const compound = representation() === "compound";
    viewToggle.setAttribute("aria-pressed", String(compound));
    viewToggle.setAttribute("aria-label", compound ? "Use compact word representation" : "Use Compound Orb representation");
    const label = viewToggle.querySelector("b");
    if (label) label.textContent = compound ? "Orbs" : "Compact";
    const icon = viewToggle.querySelector("span");
    if (icon) icon.textContent = compound ? "◉" : "Aa";
  }

  let runtime = null;

  function sync() {
    const currentCapabilities = capabilities();
    const currentRepresentation = representation();
    runtime?.sync({
      nodes: state.nodes,
      history: state.history,
      capabilities: currentCapabilities,
      routeGuide: getRouteGuide(),
      representation: currentRepresentation,
      active: Boolean(state.game && !state.reveal.active && !state.reveal.pending)
    });
    if (gameScreen) {
      gameScreen.dataset.conceptMatter = currentRepresentation;
      gameScreen.dataset.conceptMatterProfile = currentCapabilities.profile;
    }
    syncControls();
  }

  function itemForFragment(fragment) {
    const word = String(fragment?.word || "").trim().slice(0, 96);
    if (!word) return { item: null, added: false };
    const existing = state.words.find((item) => inventoryKey(item) === inventoryKey(word));
    if (existing) return { item: existing, added: false };
    const authored = asRecord(fragment?.item);
    const recipe = masteryCatalog.find((entry) => inventoryKey(entry.word) === inventoryKey(word));
    const item = {
      word,
      emoji: String(authored.emoji || recipe?.emoji || starterEmoji[word] || "✦").slice(0, 24),
      category: authored.category || recipe?.category || starterCategory[word] || null,
      source: fragment?.origin === "authored-twist" ? "fracture-twist" : authored.source || recipe?.source || "molecular-memory",
      note: String(authored.note || "Recovered from this compound's recorded reaction memory.").slice(0, 180)
    };
    state.words.push(item);
    return { item, added: true };
  }

  function operationId(plan) {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    return `matter:${state.orbitGeneration}:${inventoryKey(plan?.selectedWord) || "compound"}:${random}`;
  }

  function removeNode(node) {
    if (!node) return;
    state.nodes = state.nodes.filter((candidate) => candidate.id !== node.id);
    destroyMolecularMemory(node.id);
    boardItems?.querySelector?.(`[data-id="${escapedId(node.id)}"]`)?.remove?.();
    onBoardGeometryChange();
  }

  function commitCut(nodeId, plan, { source = "molecular-view" } = {}) {
    const node = state.nodes.find((candidate) => String(candidate.id) === String(nodeId));
    const currentCapabilities = capabilities();
    if (!node || !plan?.allowed || currentCapabilities[plan.kind] !== true) {
      const message = plan?.message || "That bond is stabilized in the current mode.";
      announce(message);
      showAlchemy(message, true);
      return null;
    }
    if (state.finished || state.pause.active || state.reveal.active || state.reveal.pending || state.busyPairs.size) return null;
    if (state.nodes.length - 1 + plan.fragments.length > maxBoardNodes) {
      showAlchemy("The board needs more open matter before this compound can separate.", true);
      return null;
    }

    const before = boardHistorySnapshot();
    const sourceSize = measureBoardWord(node.item, { instanceId: getNodeInstance(node) });
    const operation = createConceptMatterOperation({ plan, sourceNode: node, operationId: operationId(plan) });
    runtime?.close({ restoreFocus: false, reason: "matter-commit" });
    closeMolecularMemoryPanels();
    cancelTapChain();
    removeNode(node);
    state.conceptMatter = sanitizeConceptMatterState({
      ...state.conceptMatter,
      operations: [...state.conceptMatter.operations, operation]
    });

    let inventoryChanged = false;
    const fragmentNodes = [];
    plan.fragments.forEach((fragment, index) => {
      const resolved = itemForFragment(fragment);
      if (!resolved.item) return;
      inventoryChanged ||= resolved.added;
      const fragmentSize = measureBoardWord(resolved.item, { instanceId: fragment.instanceId });
      const position = fragmentPosition(node, sourceSize, fragmentSize, index, plan.fragments.length);
      fragmentNodes.push(addNode(resolved.item, position.x, position.y, {
        size: fragmentSize,
        molecularMemoryInstanceId: fragment.instanceId,
        conceptMatterFragmentToken: operation.fragmentTokens[index],
        conceptMatterOperationId: operation.id,
        conceptMatterMatterId: `${operation.id}:matter:${index}`,
        conceptMatterOrigin: fragment.origin
      }));
    });
    if (inventoryChanged) renderInventory();
    renderBoard(fragmentNodes.at(-1)?.id || null);
    commitBoardEdit(before, `${plan.kind} ${node.item.word}`);
    scheduleRunSave();
    showAlchemy(`${plan.summary} Reaction memory, discoveries, and score are unchanged.`, false, plan.kind === "twist");
    announce(`${plan.summary} No score or progress changed.`);
    playFeedback("uiSelect");
    track("concept_matter_opened", { mode: state.mode, kind: plan.kind, source });
    return { operation, nodes: fragmentNodes };
  }

  function tryReassembly(leftNode, rightNode) {
    const operation = findConceptMatterReassembly({ operations: state.conceptMatter?.operations, leftNode, rightNode });
    if (!operation) return null;
    const before = boardHistorySnapshot();
    const center = {
      x: (Number(leftNode.x) + Number(rightNode.x)) / 2,
      y: (Number(leftNode.y) + Number(rightNode.y)) / 2
    };
    const resolved = itemForFragment({
      word: operation.sourceWord,
      instanceId: operation.sourceInstanceId,
      origin: "reassembled"
    });
    if (!resolved.item) return null;
    runtime?.close({ restoreFocus: false, reason: "matter-reassembly" });
    closeMolecularMemoryPanels();
    cancelTapChain();
    removeNode(leftNode);
    removeNode(rightNode);
    state.conceptMatter = sanitizeConceptMatterState({
      ...state.conceptMatter,
      operations: settleConceptMatterOperation(state.conceptMatter.operations, operation.id, "reassembled")
    });
    const restored = addNode(resolved.item, center.x, center.y, {
      molecularMemoryInstanceId: operation.sourceInstanceId,
      conceptMatterMatterId: operation.sourceMatterId || `matter:${state.orbitGeneration}:rejoined:${operation.id}`
    });
    if (resolved.added) renderInventory();
    renderBoard(restored.id);
    commitBoardEdit(before, `rejoin ${operation.sourceWord}`);
    scheduleRunSave();
    showAlchemy(`${operation.sourceWord} rejoined as the same compound · score, moves, and discoveries unchanged.`);
    announce(`${operation.sourceWord} reassembled without changing score or progress.`);
    playFeedback("uiSelect");
    track("concept_matter_reassembled", { mode: state.mode, kind: operation.type, source: "board" });
    return { node: restored, reassembled: true, zeroReward: true };
  }

  function supersedeOperations(...nodes) {
    const tokens = new Set(nodes.map((node) => String(node?.conceptMatterFragmentToken || "")).filter(Boolean));
    if (!tokens.size) return false;
    let operations = state.conceptMatter.operations;
    let changed = false;
    for (const operation of operations) {
      if (operation.status !== "open" || !operation.fragmentTokens?.some((token) => tokens.has(token))) continue;
      operations = settleConceptMatterOperation(operations, operation.id, "superseded");
      changed = true;
    }
    if (changed) state.conceptMatter = sanitizeConceptMatterState({ ...state.conceptMatter, operations });
    return changed;
  }

  function toggleRepresentation() {
    const nextRepresentation = representation() === "compound" ? "compact" : "compound";
    runtime?.close({ restoreFocus: false, reason: "representation" });
    state.conceptMatter = sanitizeConceptMatterState({ ...state.conceptMatter, representation: nextRepresentation });
    try { storage?.setItem?.(CONCEPT_MATTER_VIEW_KEY, nextRepresentation); } catch {}
    if (state.game) {
      renderBoard();
      viewWindow?.requestAnimationFrame?.(() => constrainBoardNodes());
    } else {
      sync();
    }
    showAlchemy(nextRepresentation === "compound"
      ? "COMPOUND ORBS · recipes are visible inside each word."
      : "COMPACT MATTER · words use the classic board shape.");
    track("concept_matter_view_changed", { mode: state.mode || "home", source: nextRepresentation });
  }

  function describeNode(node, { revealed = false, mobile = false, selected = false } = {}) {
    const inspectable = capabilities().inspect === true;
    const unavailable = (state.finished && !inspectable)
      || state.pause.active
      || state.reveal.active
      || state.reveal.pending
      || revealed;
    const inspection = inspectable ? " Hold or press I to inspect its molecular bonds." : "";
    const special = node.item.source === "gift"
      ? ", Word Gift bridge"
      : node.item.source === "twist" || node.cosmicTwist ? ", Cosmic Twist discovery" : "";
    const mobileInstruction = `${node.item.word}${special}. Press to arm, then press another word to combine. You can also drag it onto another word.${inspection}`;
    const desktopInstruction = `${mobileInstruction} Hold Shift while hovering to remove; grab it first and then hold Shift while dragging to copy.`;
    return Object.freeze({
      unavailable,
      pressed: selected,
      keyShortcuts: !revealed && inspectable ? "I" : "",
      label: revealed
        ? `${node.item.word}, revealed constellation word. Not playable.`
        : unavailable
          ? `${node.item.word}. Unavailable while this orbit is locked.`
          : mobile ? mobileInstruction : desktopInstruction
    });
  }

  function handleInspectionKey(event, nodeId) {
    if (event?.key?.toLocaleLowerCase?.() !== "i" || capabilities().inspect !== true) return false;
    event.preventDefault();
    event.stopPropagation();
    runtime?.inspect(nodeId, { pinned: true, focus: true, source: "keyboard" });
    return true;
  }

  runtime = createConceptMatterRuntime({
    document: documentRef,
    boardItems,
    onInspect: () => {
      closeMolecularMemoryPanels();
      closeWordOrbit();
    },
    onCommit: ({ nodeId, plan, source }) => commitCut(nodeId, plan, { source }),
    onAnnounce: announce
  });
  viewToggle?.addEventListener?.("click", toggleRepresentation);

  const controller = {
    capabilities,
    representation,
    sync,
    sanitize: sanitizeConceptMatterState,
    commitCut,
    tryReassembly,
    supersedeOperations,
    describeNode,
    handleInspectionKey,
    close: (options) => runtime.close(options),
    estimateSize: (options) => runtime.estimateSize(options),
    inspect: (nodeId, options) => runtime.inspect(nodeId, options),
    has: (nodeId) => runtime.has(nodeId),
    get holdMs() { return runtime.holdMs; },
    destroy() {
      viewToggle?.removeEventListener?.("click", toggleRepresentation);
      runtime.destroy();
    }
  };
  sync();
  return Object.freeze(controller);
}
