/**
 * Molecular Memory
 *
 * A presentation-only projection of performed combination history. The module
 * never decides whether a recipe is valid, predicts a route, or writes game
 * state. It turns caller-owned provenance into:
 *
 * - an immutable recipe ledger;
 * - a compact chemistry-like SVG glyph; and
 * - an accessible, non-modal recipe inspector.
 *
 * Board words are buttons, so `attach()` mounts only an inert SVG inside the
 * host. The interactive inspector is mounted beside the host (or in a supplied
 * portal) to avoid nested interactive controls.
 */

export const MOLECULAR_MEMORY_VERSION = 1;
export const MOLECULAR_MEMORY_HOVER_PREVIEW_MS = 600;
export const MOLECULAR_MEMORY_HOVER_EXPAND_MS = 1_100;
export const MOLECULAR_MEMORY_MAX_REACTIONS = 2_048;
export const MOLECULAR_MEMORY_STYLESHEET = "/molecular-memory.css?v=5.0.0-beta.4";

const SVG_NS = "http://www.w3.org/2000/svg";
const DEFAULT_VIEWBOX = Object.freeze({ width: 184, height: 72 });
let memoryInstanceSequence = 0;

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanText(value, fallback = "", maximum = 96) {
  try {
    const normalized = String(value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
    return (normalized || fallback).slice(0, maximum);
  } catch {
    return fallback;
  }
}

export function molecularMemoryWordKey(value) {
  const source = record(value);
  return cleanText(source.word ?? source.label ?? source.name ?? value, "", 96).toLocaleLowerCase("en");
}

function safeId(value, fallback = "") {
  const normalized = cleanText(value, fallback, 120)
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9:_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return normalized || fallback;
}

function stableHash(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value) || Object.isFrozen(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, Math.floor(parsed)))
    : fallback;
}

function resultWord(value) {
  if (typeof value === "string" || typeof value === "number") return cleanText(value);
  const source = record(value);
  return cleanText(source.word ?? source.label ?? source.name ?? source.value);
}

function wordReference(value, fallbackId = "") {
  const source = record(value);
  const word = resultWord(value);
  if (!word) return null;
  return {
    id: safeId(source.instanceId ?? source.nodeId ?? source.outputId ?? source.id, fallbackId),
    word,
    key: molecularMemoryWordKey(word),
    sourceReactionId: safeId(
      source.sourceReactionId
        ?? source.createdByReactionId
        ?? source.reactionId
        ?? source.provenance?.reactionId,
      ""
    )
  };
}

function rawInputs(source) {
  const nested = record(source.recipe);
  const values = source.inputs
    ?? source.ingredients
    ?? source.parents
    ?? nested.inputs
    ?? nested.ingredients
    ?? nested.parents;
  if (Array.isArray(values)) return values.slice(0, 8);
  return [
    source.a ?? source.left ?? source.inputA ?? nested.a ?? nested.left ?? nested.inputA,
    source.b ?? source.right ?? source.inputB ?? nested.b ?? nested.right ?? nested.inputB
  ];
}

function rawOutput(source) {
  const nested = record(source.recipe);
  return source.output
    ?? source.result
    ?? source.word
    ?? nested.output
    ?? nested.result
    ?? nested.word;
}

function eventRole(value) {
  const role = safeId(value, "reaction");
  return ["backbone", "reagent", "branch", "origin", "free", "reaction"].includes(role) ? role : "reaction";
}

function normalizeEvent(sourceValue, index, usedIds) {
  const source = record(sourceValue);
  if (!Object.keys(source).length) return null;
  if (
    source.preview === true
    || source.predicted === true
    || source.future === true
    || source.locked === true
    || source.performed === false
    || source.resolved === false
    || source.success === false
    || source.accepted === false
  ) return null;

  const inputs = rawInputs(source)
    .map((value) => wordReference(value, ""))
    .filter(Boolean);
  const output = wordReference(rawOutput(source), "output");
  if (!inputs.length || !output) return null;

  const identity = JSON.stringify([
    inputs.map(({ key }) => key),
    output.key,
    cleanText(source.recipeId ?? source.recipe?.id, "", 120)
  ]);
  const candidate = safeId(
    source.id ?? source.eventId ?? source.reactionId,
    `reaction-${index + 1}-${stableHash(identity)}`
  );
  let id = candidate;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${candidate}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  const outputId = safeId(
    record(rawOutput(source)).instanceId
      ?? record(rawOutput(source)).nodeId
      ?? record(rawOutput(source)).outputId
      ?? record(rawOutput(source)).id,
    `${id}:output`
  );
  const recipeId = safeId(
    source.recipeId ?? source.recipe?.id,
    `recipe-${stableHash(JSON.stringify([[...inputs.map(({ key }) => key)].sort(), output.key]))}`
  );

  return {
    id,
    historyIndex: index,
    recipeId,
    role: eventRole(source.role ?? source.reactionRole),
    createdAt: cleanText(source.createdAt ?? source.timestamp, "", 64),
    inputs: inputs.map((input, inputIndex) => ({ ...input, inputIndex })),
    output: { ...output, id: outputId },
    metadata: {
      routeForward: source.routeForward === true || source.routeDerived === true || Number(source.routeStepsAdvanced) > 0,
      authored: source.authored === true || source.provenance?.reviewed === true
    }
  };
}

function resolveEventLinks(events) {
  const byEventId = new Map(events.map((event) => [event.id, event]));
  const byOutputId = new Map(events.map((event) => [event.output.id, event]));
  const priorByWord = new Map();
  return events.map((event) => {
    const inputs = event.inputs.map((input) => {
      let sourceReaction = input.sourceReactionId ? byEventId.get(input.sourceReactionId) : null;
      if (!sourceReaction && input.id) sourceReaction = byOutputId.get(input.id);
      if (!sourceReaction) sourceReaction = priorByWord.get(input.key) || null;
      if (sourceReaction?.id === event.id) sourceReaction = null;
      return {
        ...input,
        sourceReactionId: sourceReaction?.id || "",
        sourceOutputId: sourceReaction?.output.id || ""
      };
    });
    priorByWord.set(event.output.key, event);
    return { ...event, inputs };
  });
}

export function normalizeMolecularMemoryHistory(source, { maxReactions = MOLECULAR_MEMORY_MAX_REACTIONS } = {}) {
  const limit = boundedInteger(maxReactions, MOLECULAR_MEMORY_MAX_REACTIONS, 1, MOLECULAR_MEMORY_MAX_REACTIONS);
  const values = Array.isArray(source)
    ? source.slice(-limit)
    : Array.isArray(source?.events)
      ? source.events.slice(-limit)
      : [];
  const usedIds = new Set();
  const normalized = values
    .map((event, index) => normalizeEvent(event, index, usedIds))
    .filter(Boolean);
  return deepFreeze(resolveEventLinks(normalized));
}

function reactionSignature(event, byId, visiting = new Set()) {
  if (!event || visiting.has(event.id)) return "cycle";
  const nextVisiting = new Set(visiting).add(event.id);
  const inputs = event.inputs.map((input) => {
    const source = byId.get(input.sourceReactionId);
    return source
      ? `${input.key}<${reactionSignature(source, byId, nextVisiting)}>`
      : `${input.key}<origin>`;
  }).sort((left, right) => left.localeCompare(right, "en"));
  return `${inputs.join("+")}=>${event.output.key}`;
}

function tracedReactionIds(target, byId) {
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];
  function visit(event) {
    if (!event || visited.has(event.id) || visiting.has(event.id)) return;
    visiting.add(event.id);
    for (const input of event.inputs) visit(byId.get(input.sourceReactionId));
    visiting.delete(event.id);
    visited.add(event.id);
    ordered.push(event.id);
  }
  visit(target);
  return ordered;
}

function derivationSources(options) {
  const direct = options.derivations ?? options.isomers ?? options.alternates;
  return Array.isArray(direct) ? direct : [];
}

function historyFromDerivation(value) {
  if (Array.isArray(value)) return value;
  const source = record(value);
  for (const candidate of [source.history, source.reactions, source.events, source.steps]) {
    if (Array.isArray(candidate)) return candidate;
  }
  if (rawInputs(source).some((entry) => resultWord(entry)) && resultWord(rawOutput(source))) return [source];
  return [];
}

function isomerLabel(index, count, target, targetReaction) {
  if (count <= 1) return `${target} structure`;
  const ingredients = targetReaction.inputs.map(({ word }) => word).join(" + ");
  return `Isomer ${index + 1}: ${ingredients}`;
}

function makeIsomersFromEvents(events, targetWord, explicit = {}, selectedInstanceId = "") {
  const byId = new Map(events.map((event) => [event.id, event]));
  const targetKey = molecularMemoryWordKey(targetWord) || events.at(-1)?.output.key || "";
  const targets = events.filter((event) => event.output.key === targetKey);
  const candidates = targets.length ? targets : events.length ? [events.at(-1)] : [];
  const grouped = new Map();
  for (const candidate of candidates) {
    const signature = reactionSignature(candidate, byId);
    const group = grouped.get(signature) || [];
    group.push(candidate);
    grouped.set(signature, group);
  }
  const isomers = [];
  for (const [signature, matchingTargets] of grouped) {
    const targetReaction = matchingTargets.find(({ output }) => output.id === selectedInstanceId)
      || matchingTargets.at(-1);
    const reactionIds = tracedReactionIds(targetReaction, byId);
    const reactions = reactionIds.map((id) => byId.get(id)).filter(Boolean);
    const explicitId = cleanText(explicit.id ?? explicit.isomerId, "", 100);
    const id = safeId(explicitId, `isomer-${stableHash(signature)}`);
    isomers.push({
      id,
      signature,
      targetWord: targetReaction.output.word,
      targetReactionId: targetReaction.id,
      targetRecipeId: targetReaction.recipeId,
      targetInstanceId: targetReaction.output.id,
      instanceIds: matchingTargets.map(({ output }) => output.id),
      label: cleanText(explicit.label ?? explicit.name, "", 120),
      discoveredAt: targetReaction.createdAt,
      reactionIds,
      reactions,
      equation: `${targetReaction.inputs.map(({ word }) => word).join(" + ")} \u2192 ${targetReaction.output.word}`
    });
  }
  return isomers;
}

function uniqueIsomerIds(isomers) {
  const used = new Set();
  return isomers.map((isomer) => {
    const base = isomer.id;
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return id === isomer.id ? isomer : { ...isomer, id };
  });
}

function originIsomer(word) {
  const target = cleanText(word, "Unknown concept", 96);
  return {
    id: `origin-${stableHash(molecularMemoryWordKey(target))}`,
    signature: `${molecularMemoryWordKey(target)}<origin>`,
    targetWord: target,
    targetReactionId: "",
    targetRecipeId: "",
    label: `${target} origin`,
    discoveredAt: "",
    reactionIds: [],
    reactions: [],
    equation: `${target} \u00b7 origin concept`
  };
}

/**
 * Normalizes performed history into immutable isomers and exact recipe ledgers.
 * Alternate derivations may be supplied explicitly, or are inferred whenever
 * the flat history contains different transitive recipes for the same target.
 */
export function buildMolecularMemoryModel(options = {}) {
  const source = record(options);
  const explicitDerivations = derivationSources(source);
  const requestedWord = resultWord(source.word ?? source.target ?? source.output);
  const requestedInstanceId = safeId(
    source.instanceId
      ?? source.selectedInstanceId
      ?? record(source.word).instanceId
      ?? record(source.word).id,
    ""
  );
  let isomers = [];
  let history = Object.freeze([]);

  if (explicitDerivations.length) {
    for (const derivation of explicitDerivations) {
      const derivationRecord = record(derivation);
      const events = normalizeMolecularMemoryHistory(historyFromDerivation(derivation), source);
      const target = resultWord(derivationRecord.word ?? derivationRecord.target ?? requestedWord)
        || events.at(-1)?.output.word
        || requestedWord;
      const built = makeIsomersFromEvents(events, target, derivationRecord, requestedInstanceId);
      if (built.length) {
        const selected = built.at(-1);
        isomers.push(selected);
      }
    }
    history = deepFreeze(isomers.flatMap(({ reactions }) => reactions));
  } else {
    history = normalizeMolecularMemoryHistory(source.history ?? source.reactions ?? source.events ?? source.steps, source);
    const target = requestedWord || history.at(-1)?.output.word || "Unknown concept";
    isomers = makeIsomersFromEvents(history, target, {}, requestedInstanceId);
  }

  const word = requestedWord || isomers.at(-1)?.targetWord || history.at(-1)?.output.word || "Unknown concept";
  if (!isomers.length) isomers = [originIsomer(word)];
  isomers = uniqueIsomerIds(isomers);
  isomers = isomers.map((isomer, index) => ({
    ...isomer,
    index,
    label: isomer.label || isomerLabel(index, isomers.length, word, isomer.reactions.at(-1)),
    accessibleLabel: `${isomer.label || isomerLabel(index, isomers.length, word, isomer.reactions.at(-1))}. ${isomer.reactions.length} ${isomer.reactions.length === 1 ? "reaction" : "reactions"}. ${isomer.equation}.`
  }));

  const requestedActive = safeId(source.activeIsomerId ?? source.activeDerivationId, "");
  const active = isomers.find(({ id }) => id === requestedActive)
    || isomers.find(({ instanceIds }) => instanceIds?.includes(requestedInstanceId))
    || isomers.at(-1);
  const recipeLedger = isomers.map((isomer) => ({
    isomerId: isomer.id,
    signature: isomer.signature,
    steps: isomer.reactions.map((reaction, stepIndex) => ({
      step: stepIndex + 1,
      reactionId: reaction.id,
      recipeId: reaction.recipeId,
      role: reaction.role,
      inputs: reaction.inputs.map(({ id, word, sourceReactionId, sourceOutputId, inputIndex }) => ({
        id,
        word,
        sourceReactionId,
        sourceOutputId,
        inputIndex
      })),
      output: { id: reaction.output.id, word: reaction.output.word },
      equation: `${reaction.inputs.map(({ word: inputWord }) => inputWord).join(" + ")} \u2192 ${reaction.output.word}`
    }))
  }));

  return deepFreeze({
    version: MOLECULAR_MEMORY_VERSION,
    word,
    key: molecularMemoryWordKey(word),
    selectedInstanceId: requestedInstanceId || active.targetInstanceId || "",
    activeIsomerId: active.id,
    isomerCount: isomers.length,
    alternateCount: Math.max(0, isomers.length - 1),
    reactionCount: active.reactions.length,
    isomers,
    recipeLedger,
    history
  });
}

export function molecularMemorySymbol(value) {
  const word = cleanText(resultWord(value), "?", 96);
  const tokens = word.match(/[\p{L}\p{N}]+/gu) || [];
  if (tokens.length > 1) {
    return tokens.slice(0, 2).map((token) => token[0]?.toLocaleUpperCase("en") || "").join("") || "?";
  }
  const letters = [...(tokens[0] || word)].filter((character) => /[\p{L}\p{N}]/u.test(character));
  if (!letters.length) return "?";
  return `${letters[0].toLocaleUpperCase("en")}${(letters[1] || "").toLocaleLowerCase("en")}`;
}

function reactionDepth(event, byId, memo = new Map(), visiting = new Set()) {
  if (!event) return 0;
  if (memo.has(event.id)) return memo.get(event.id);
  if (visiting.has(event.id)) return 0;
  const next = new Set(visiting).add(event.id);
  const derived = event.inputs.map((input) => reactionDepth(byId.get(input.sourceReactionId), byId, memo, next));
  const depth = 1 + Math.max(0, ...derived);
  memo.set(event.id, depth);
  return depth;
}

function backboneFor(isomer) {
  const byId = new Map(isomer.reactions.map((event) => [event.id, event]));
  const depthMemo = new Map();
  const reverse = [];
  const selectedInput = new Map();
  let current = byId.get(isomer.targetReactionId) || isomer.reactions.at(-1) || null;
  const visited = new Set();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    reverse.push(current);
    const candidates = current.inputs
      .map((input, inputIndex) => ({ input, inputIndex, event: byId.get(input.sourceReactionId) }))
      .filter(({ event }) => event)
      .sort((left, right) => (
        reactionDepth(right.event, byId, depthMemo) - reactionDepth(left.event, byId, depthMemo)
        || left.inputIndex - right.inputIndex
        || left.event.id.localeCompare(right.event.id, "en")
      ));
    const next = candidates[0] || null;
    if (!next) break;
    selectedInput.set(current.id, next.inputIndex);
    current = next.event;
  }
  return { chain: reverse.reverse(), selectedInput, byId };
}

function collectBranch(rootId, byId, blocked) {
  const ids = [];
  const visited = new Set();
  function visit(id) {
    if (!id || visited.has(id) || blocked.has(id)) return;
    const event = byId.get(id);
    if (!event) return;
    visited.add(id);
    for (const input of event.inputs) visit(input.sourceReactionId);
    ids.push(id);
  }
  visit(rootId);
  return ids;
}

function polygonPoints(centerX, centerY, radius, sides = 6, rotation = Math.PI / 6) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (Math.PI * 2 * index) / sides;
    return {
      x: Number((centerX + Math.cos(angle) * radius).toFixed(2)),
      y: Number((centerY + Math.sin(angle) * radius).toFixed(2))
    };
  });
}

function visibleSideGroups({ visibleChain, selectedInput, byId, blocked, maxVisibleGroups }) {
  const groups = [];
  const seenBranchRoots = new Set();
  visibleChain.forEach((event, chainIndex) => {
    const continuationIndex = selectedInput.get(event.id);
    event.inputs.forEach((input, inputIndex) => {
      if (inputIndex === continuationIndex) return;
      const sourceId = input.sourceReactionId;
      if (sourceId && seenBranchRoots.has(sourceId)) return;
      if (sourceId) seenBranchRoots.add(sourceId);
      const reactionIds = collectBranch(sourceId, byId, blocked);
      groups.push({
        id: `functional-group-${event.id}-${inputIndex + 1}`,
        word: input.word,
        symbol: molecularMemorySymbol(input.word),
        sourceReactionId: sourceId,
        attachesToReactionId: event.id,
        inputIndex,
        chainIndex,
        reactionIds,
        recipeIds: reactionIds.map((id) => byId.get(id)?.recipeId).filter(Boolean),
        steps: reactionIds.map((id) => byId.get(id)).filter(Boolean),
        collapsed: reactionIds.length > 0,
        count: Math.max(1, reactionIds.length)
      });
    });
  });
  if (groups.length <= maxVisibleGroups) return groups;
  const visible = groups.slice(0, Math.max(1, maxVisibleGroups - 1));
  const overflow = groups.slice(visible.length);
  visible.push({
    id: "functional-group-overflow",
    word: `${overflow.length} reagent groups`,
    symbol: `+${overflow.length}`,
    sourceReactionId: "",
    attachesToReactionId: overflow.at(-1)?.attachesToReactionId || visibleChain.at(-1)?.id || "",
    inputIndex: -1,
    chainIndex: Math.max(0, visibleChain.length - 1),
    reactionIds: [...new Set(overflow.flatMap(({ reactionIds }) => reactionIds))],
    recipeIds: [...new Set(overflow.flatMap(({ recipeIds }) => recipeIds))],
    steps: overflow.flatMap(({ steps }) => steps),
    collapsed: true,
    count: overflow.length,
    members: overflow
  });
  return visible;
}

function isomerFromModel(model, requestedId) {
  const id = safeId(requestedId, "");
  return model.isomers.find((isomer) => isomer.id === id)
    || model.isomers.find((isomer) => isomer.id === model.activeIsomerId)
    || model.isomers[0];
}

/**
 * Projects one isomer into a bounded skeletal formula. The main derivation is
 * a backbone; independent syntheses are collapsed as functional groups. Every
 * reaction ID remains represented by either a visible bond or a group ledger.
 */
export function projectMolecularMemoryGlyph(modelValue, options = {}) {
  const model = modelValue?.version === MOLECULAR_MEMORY_VERSION
    ? modelValue
    : buildMolecularMemoryModel(modelValue);
  const source = record(options);
  const isomer = isomerFromModel(model, source.isomerId ?? source.activeIsomerId);
  const maxBackbone = boundedInteger(source.maxBackbone, 4, 2, 8);
  const maxVisibleGroups = boundedInteger(source.maxVisibleGroups, 4, 1, 8);
  const { chain, selectedInput, byId } = backboneFor(isomer);
  const prefixCount = Math.max(0, chain.length - maxBackbone);
  const hiddenPrefix = chain.slice(0, prefixCount);
  const visibleChain = chain.slice(prefixCount);
  const blocked = new Set(chain.map(({ id }) => id));
  const firstEvent = visibleChain[0] || null;
  const selectedFirstIndex = firstEvent ? selectedInput.get(firstEvent.id) : undefined;
  const firstInputIndex = selectedFirstIndex ?? 0;
  const firstInput = firstEvent?.inputs[firstInputIndex] || null;
  const projectedInput = new Map(selectedInput);
  if (firstEvent && !projectedInput.has(firstEvent.id)) projectedInput.set(firstEvent.id, firstInputIndex);
  const backboneNodes = [];
  const bonds = [];
  const nodeCount = Math.max(1, visibleChain.length + 1);
  const xStart = 18;
  const xEnd = 166;
  const stepX = nodeCount > 1 ? (xEnd - xStart) / (nodeCount - 1) : 0;
  const position = (index) => ({
    x: Number((xStart + index * stepX).toFixed(2)),
    y: Number((36 + (index > 0 && index < nodeCount - 1 ? (index % 2 ? -5 : 5) : 0)).toFixed(2))
  });
  const firstPosition = position(0);
  const prefixIds = hiddenPrefix.map(({ id }) => id);
  backboneNodes.push({
    id: prefixIds.length ? "backbone-prefix" : "backbone-origin",
    kind: prefixIds.length ? "functional-group" : "atom",
    word: prefixIds.length ? hiddenPrefix.at(-1).output.word : firstInput?.word || isomer.targetWord,
    symbol: prefixIds.length ? `R${prefixIds.length}` : molecularMemorySymbol(firstInput?.word || isomer.targetWord),
    reactionIds: prefixIds,
    recipeIds: hiddenPrefix.map(({ recipeId }) => recipeId),
    steps: hiddenPrefix,
    collapsed: prefixIds.length > 0,
    final: visibleChain.length === 0,
    ...firstPosition
  });

  visibleChain.forEach((event, index) => {
    const prior = position(index);
    const next = position(index + 1);
    const node = {
      id: `backbone-${event.id}`,
      kind: "atom",
      word: event.output.word,
      symbol: molecularMemorySymbol(event.output.word),
      reactionIds: [event.id],
      recipeIds: [event.recipeId],
      steps: [event],
      collapsed: false,
      final: event.id === isomer.targetReactionId,
      ...next
    };
    backboneNodes.push(node);
    bonds.push({
      id: `bond-${event.id}`,
      kind: event.metadata.routeForward ? "route" : "backbone",
      reactionId: event.id,
      recipeId: event.recipeId,
      from: prior,
      to: next,
      order: 1 + (Number.parseInt(stableHash(event.recipeId).slice(-1), 36) % 2),
      equation: `${event.inputs.map(({ word }) => word).join(" + ")} \u2192 ${event.output.word}`
    });
  });

  const groups = visibleSideGroups({
    visibleChain,
    selectedInput: projectedInput,
    byId,
    blocked,
    maxVisibleGroups
  }).map((group, index) => {
    const anchorIndex = Math.min(group.chainIndex + 1, Math.max(0, backboneNodes.length - 1));
    const anchor = backboneNodes[anchorIndex] || backboneNodes.at(-1) || firstPosition;
    const above = index % 2 === 0;
    const x = Number(Math.min(176, Math.max(8, anchor.x + (index % 3 - 1) * 7)).toFixed(2));
    const y = above ? 12 : 61;
    return {
      ...group,
      x,
      y,
      anchor: { x: anchor.x, y: anchor.y },
      ring: polygonPoints(x, y, group.collapsed ? 8.5 : 6.5, group.collapsed ? 6 : 5)
    };
  });

  const sideBonds = groups.map((group) => ({
    id: `side-bond-${group.id}`,
    kind: "side-chain",
    reactionId: group.attachesToReactionId,
    recipeId: byId.get(group.attachesToReactionId)?.recipeId || "",
    from: group.anchor,
    to: { x: group.x, y: group.y },
    order: 1
  }));
  const represented = new Set([
    ...prefixIds,
    ...bonds.map(({ reactionId }) => reactionId),
    ...groups.flatMap(({ reactionIds }) => reactionIds)
  ]);
  const allReactionIds = isomer.reactions.map(({ id }) => id);
  const missing = allReactionIds.filter((id) => !represented.has(id));
  const recipeLedger = isomer.reactions.map((reaction, index) => ({
    step: index + 1,
    reactionId: reaction.id,
    recipeId: reaction.recipeId,
    role: reaction.role,
    inputs: reaction.inputs.map(({ word, id, sourceReactionId, inputIndex }) => ({ word, id, sourceReactionId, inputIndex })),
    output: { word: reaction.output.word, id: reaction.output.id },
    equation: `${reaction.inputs.map(({ word }) => word).join(" + ")} \u2192 ${reaction.output.word}`
  }));

  return deepFreeze({
    version: MOLECULAR_MEMORY_VERSION,
    word: model.word,
    isomerId: isomer.id,
    isomerIndex: isomer.index,
    isomerCount: model.isomerCount,
    alternateCount: model.alternateCount,
    signature: isomer.signature,
    equation: isomer.equation,
    viewBox: DEFAULT_VIEWBOX,
    backboneNodes,
    bonds: [...bonds, ...sideBonds],
    functionalGroups: groups,
    recipeLedger,
    coverage: {
      represented: [...represented].sort((left, right) => left.localeCompare(right, "en")),
      missing
    },
    accessibleLabel: `${model.word} molecular memory. ${isomer.label}. ${recipeLedger.length} ${recipeLedger.length === 1 ? "reaction" : "reactions"} preserved. ${isomer.equation}.`
  });
}

function setAttributes(node, attributes) {
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === "") continue;
    node.setAttribute(name, String(value));
  }
  return node;
}

function htmlElement(documentRef, tagName, className = "", attributes = {}) {
  const node = documentRef.createElement(tagName);
  node.className = className;
  return setAttributes(node, attributes);
}

function svgElement(documentRef, tagName, className = "", attributes = {}) {
  const node = documentRef.createElementNS(SVG_NS, tagName);
  node.setAttribute("class", className);
  return setAttributes(node, attributes);
}

function pointsAttribute(points) {
  return points.map(({ x, y }) => `${x},${y}`).join(" ");
}

function renderBond(documentRef, bond) {
  const group = svgElement(documentRef, "g", `molecular-memory__bond molecular-memory__bond--${bond.kind}`, {
    "data-mm-reaction-id": bond.reactionId,
    "data-mm-recipe-id": bond.recipeId
  });
  const dx = bond.to.x - bond.from.x;
  const dy = bond.to.y - bond.from.y;
  const length = Math.hypot(dx, dy) || 1;
  const offsetX = (-dy / length) * 1.45;
  const offsetY = (dx / length) * 1.45;
  const line = (offset = 0) => svgElement(documentRef, "line", "molecular-memory__bond-line", {
    x1: Number((bond.from.x + offsetX * offset).toFixed(2)),
    y1: Number((bond.from.y + offsetY * offset).toFixed(2)),
    x2: Number((bond.to.x + offsetX * offset).toFixed(2)),
    y2: Number((bond.to.y + offsetY * offset).toFixed(2))
  });
  group.append(line(bond.order === 2 ? -1 : 0));
  if (bond.order === 2) group.append(line(1));
  return group;
}

function renderBackboneNode(documentRef, node) {
  const group = svgElement(documentRef, "g", `molecular-memory__atom${node.final ? " molecular-memory__atom--final" : ""}${node.collapsed ? " molecular-memory__atom--collapsed" : ""}`, {
    transform: `translate(${node.x} ${node.y})`,
    "data-mm-reaction-ids": node.reactionIds.join(" "),
    "data-mm-word": node.word
  });
  if (node.collapsed) {
    group.append(svgElement(documentRef, "polygon", "molecular-memory__atom-shape", {
      points: pointsAttribute(polygonPoints(0, 0, 9, 6))
    }));
  } else {
    group.append(svgElement(documentRef, "circle", "molecular-memory__atom-shape", { cx: 0, cy: 0, r: node.final ? 8 : 6.6 }));
  }
  const label = svgElement(documentRef, "text", "molecular-memory__atom-label", { x: 0, y: ".35em", "text-anchor": "middle" });
  label.textContent = node.symbol;
  group.append(label);
  return group;
}

function renderFunctionalGroup(documentRef, groupModel) {
  const group = svgElement(documentRef, "g", `molecular-memory__functional-group${groupModel.collapsed ? " molecular-memory__functional-group--collapsed" : ""}`, {
    transform: `translate(${groupModel.x} ${groupModel.y})`,
    "data-mm-group-id": groupModel.id,
    "data-mm-reaction-ids": groupModel.reactionIds.join(" "),
    "data-mm-word": groupModel.word
  });
  group.append(svgElement(documentRef, "polygon", "molecular-memory__functional-group-shape", {
    points: pointsAttribute(groupModel.ring.map(({ x, y }) => ({ x: x - groupModel.x, y: y - groupModel.y })))
  }));
  const label = svgElement(documentRef, "text", "molecular-memory__functional-group-label", { x: 0, y: ".34em", "text-anchor": "middle" });
  label.textContent = groupModel.symbol;
  group.append(label);
  if (groupModel.reactionIds.length > 1) {
    const count = svgElement(documentRef, "text", "molecular-memory__functional-group-count", { x: 7, y: -6, "text-anchor": "middle" });
    count.textContent = String(groupModel.reactionIds.length);
    group.append(count);
  }
  return group;
}

export function renderMolecularMemoryGlyph(documentRef, glyphValue) {
  const glyph = glyphValue?.viewBox ? glyphValue : projectMolecularMemoryGlyph(glyphValue);
  const svg = svgElement(documentRef, "svg", "molecular-memory__glyph", {
    viewBox: `0 0 ${glyph.viewBox.width} ${glyph.viewBox.height}`,
    preserveAspectRatio: "xMidYMid meet",
    "aria-hidden": "true",
    focusable: "false",
    "data-mm-isomer-id": glyph.isomerId,
    "data-mm-signature": glyph.signature
  });
  const bonds = svgElement(documentRef, "g", "molecular-memory__bonds");
  bonds.append(...glyph.bonds.map((bond) => renderBond(documentRef, bond)));
  const groups = svgElement(documentRef, "g", "molecular-memory__groups");
  groups.append(...glyph.functionalGroups.map((group) => renderFunctionalGroup(documentRef, group)));
  const atoms = svgElement(documentRef, "g", "molecular-memory__atoms");
  atoms.append(...glyph.backboneNodes.map((node) => renderBackboneNode(documentRef, node)));
  const isomerMarkers = svgElement(documentRef, "g", "molecular-memory__isomer-markers", {
    transform: "translate(174 7)",
    "data-mm-isomer-count": glyph.isomerCount
  });
  Array.from({ length: Math.min(4, glyph.isomerCount) }, (_, index) => {
    isomerMarkers.append(svgElement(documentRef, "circle", `molecular-memory__isomer-marker${index === glyph.isomerIndex ? " is-active" : ""}`, {
      cx: -index * 5,
      cy: 0,
      r: index === glyph.isomerIndex ? 1.9 : 1.25
    }));
  });
  svg.append(bonds, groups, atoms, isomerMarkers);
  return svg;
}

function recipeStepElement(documentRef, step) {
  const item = htmlElement(documentRef, "li", "molecular-memory__recipe-step", {
    "data-mm-reaction-id": step.reactionId,
    "data-mm-recipe-id": step.recipeId
  });
  const number = htmlElement(documentRef, "span", "molecular-memory__step-number", { "aria-hidden": "true" });
  number.textContent = String(step.step).padStart(2, "0");
  const copy = htmlElement(documentRef, "span", "molecular-memory__step-copy");
  const equation = htmlElement(documentRef, "strong", "molecular-memory__equation");
  equation.textContent = step.equation;
  const metadata = htmlElement(documentRef, "small", "molecular-memory__recipe-id");
  metadata.textContent = `Recipe ${step.recipeId}${step.role !== "reaction" ? ` \u00b7 ${step.role}` : ""}`;
  copy.append(equation, metadata);
  item.append(number, copy);
  return item;
}

function appendTokenList(existing, token) {
  const values = new Set(cleanText(existing, "", 500).split(/\s+/u).filter(Boolean));
  if (token) values.add(token);
  return [...values].join(" ");
}

function classToggle(node, name, force) {
  if (node.classList?.toggle) node.classList.toggle(name, force);
  else {
    const values = new Set(String(node.className || "").split(/\s+/u).filter(Boolean));
    if (force) values.add(name);
    else values.delete(name);
    node.className = [...values].join(" ");
  }
}

function containsOrEquals(root, candidate) {
  return Boolean(root && candidate && (root === candidate || root.contains?.(candidate)));
}

function defaultViewFor(documentRef) {
  return documentRef.defaultView || globalThis;
}

function panelPosition(host, panel, view) {
  const rect = host?.getBoundingClientRect?.();
  if (!rect) return null;
  const viewportWidth = Number(view.innerWidth) || 1024;
  const viewportHeight = Number(view.innerHeight) || 768;
  const width = Math.min(360, Math.max(248, Number(panel.offsetWidth) || 320));
  const height = Math.min(480, Math.max(180, Number(panel.offsetHeight) || 320));
  const margin = 12;
  const center = Math.min(viewportWidth - width / 2 - margin, Math.max(width / 2 + margin, rect.left + rect.width / 2));
  const below = rect.bottom + 12;
  const fitsBelow = below + height <= viewportHeight - margin;
  const top = fitsBelow ? below : Math.max(margin, rect.top - height - 12);
  panel.style.setProperty("--molecular-memory-panel-x", `${Math.round(center)}px`);
  panel.style.setProperty("--molecular-memory-panel-y", `${Math.round(top)}px`);
  panel.dataset.placement = fitsBelow ? "below" : "above";
  return { x: center, y: top, placement: panel.dataset.placement };
}

function eventListener(target, type, listener, options, removers) {
  target?.addEventListener?.(type, listener, options);
  removers.push(() => target?.removeEventListener?.(type, listener, options));
}

/**
 * Creates a reusable DOM controller. Call `attach(boardWord)` after creation;
 * callers may safely re-use the controller with `update()` and `detach()`.
 */
export function createMolecularMemory(options = {}) {
  const initial = record(options);
  const documentRef = initial.document || globalThis.document;
  if (!documentRef?.createElement || !documentRef?.createElementNS) {
    throw new TypeError("createMolecularMemory requires a DOM-like document with createElement and createElementNS.");
  }
  const view = initial.view || defaultViewFor(documentRef);
  const suppliedId = safeId(initial.id, "");
  const instanceId = suppliedId || `molecular-memory-${++memoryInstanceSequence}`;
  const descriptorId = `${instanceId}-description`;
  const panelId = `${instanceId}-panel`;
  const headingId = `${instanceId}-heading`;
  let currentOptions = { ...initial };
  let model = buildMolecularMemoryModel(currentOptions);
  let activeIsomerId = safeId(currentOptions.activeIsomerId ?? currentOptions.activeDerivationId, model.activeIsomerId);
  let glyph = projectMolecularMemoryGlyph(model, { isomerId: activeIsomerId });
  let host = null;
  let panelContainer = null;
  let attached = false;
  let expanded = false;
  let pinned = false;
  let previewTimer = 0;
  let expandTimer = 0;
  let closeTimer = 0;
  let hostAttributes = null;
  const removers = [];
  const positionRemovers = [];

  const root = htmlElement(documentRef, "span", "molecular-memory", {
    "data-molecular-memory": "",
    "data-state": "resting",
    "aria-hidden": "true"
  });
  const descriptor = htmlElement(documentRef, "span", "molecular-memory__sr", { id: descriptorId });
  const panel = htmlElement(documentRef, "section", "molecular-memory__panel", {
    id: panelId,
    role: "dialog",
    "aria-modal": "false",
    "aria-labelledby": headingId,
    "aria-describedby": `${instanceId}-summary`,
    tabindex: "-1"
  });
  panel.hidden = true;

  function clearTimers() {
    for (const timer of [previewTimer, expandTimer, closeTimer]) {
      if (timer) view.clearTimeout?.(timer);
    }
    previewTimer = 0;
    expandTimer = 0;
    closeTimer = 0;
  }

  function syncHostDisclosure() {
    if (!host) return;
    host.setAttribute("aria-expanded", String(expanded));
    root.dataset.state = expanded ? "expanded" : root.dataset.state === "preview" ? "preview" : "resting";
    classToggle(root, "is-expanded", expanded);
    classToggle(panel, "is-pinned", pinned);
  }

  function renderPanel() {
    const isomer = isomerFromModel(model, activeIsomerId);
    const currentGlyph = projectMolecularMemoryGlyph(model, { isomerId: isomer.id });
    const header = htmlElement(documentRef, "header", "molecular-memory__panel-header");
    const titleWrap = htmlElement(documentRef, "span", "molecular-memory__title-wrap");
    const kicker = htmlElement(documentRef, "small", "molecular-memory__kicker");
    kicker.textContent = "MOLECULAR MEMORY";
    const title = htmlElement(documentRef, "strong", "molecular-memory__title", { id: headingId });
    title.textContent = model.word;
    titleWrap.append(kicker, title);
    const close = htmlElement(documentRef, "button", "molecular-memory__close", {
      type: "button",
      "aria-label": `Close ${model.word} molecular memory`
    });
    close.textContent = "\u00d7";
    close.addEventListener("click", (event) => {
      event.stopPropagation?.();
      setExpanded(false, { pinned: false, focusHost: true });
    });
    header.append(titleWrap, close);

    const summary = htmlElement(documentRef, "p", "molecular-memory__summary", { id: `${instanceId}-summary` });
    summary.textContent = `${isomer.label}. ${currentGlyph.recipeLedger.length} ${currentGlyph.recipeLedger.length === 1 ? "recorded reaction" : "recorded reactions"}.`;
    const formula = htmlElement(documentRef, "p", "molecular-memory__formula");
    formula.textContent = currentGlyph.equation;

    const tabs = htmlElement(documentRef, "div", "molecular-memory__isomers", {
      role: "tablist",
      "aria-label": `${model.word} derivations`
    });
    if (model.isomerCount <= 1) tabs.hidden = true;
    for (const candidate of model.isomers) {
      const selected = candidate.id === isomer.id;
      const tab = htmlElement(documentRef, "button", "molecular-memory__isomer", {
        type: "button",
        role: "tab",
        "aria-selected": String(selected),
        tabindex: selected ? "0" : "-1",
        "data-mm-isomer-id": candidate.id
      });
      tab.textContent = `Isomer ${candidate.index + 1}`;
      tab.addEventListener("click", (event) => {
        event.stopPropagation?.();
        selectIsomer(candidate.id, { focusTab: true });
      });
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault?.();
        event.stopPropagation?.();
        let index = candidate.index;
        if (event.key === "ArrowLeft") index = (index - 1 + model.isomerCount) % model.isomerCount;
        if (event.key === "ArrowRight") index = (index + 1) % model.isomerCount;
        if (event.key === "Home") index = 0;
        if (event.key === "End") index = model.isomerCount - 1;
        selectIsomer(model.isomers[index].id, { focusTab: true });
      });
      tabs.append(tab);
    }

    const recipeHeading = htmlElement(documentRef, "h3", "molecular-memory__recipe-heading");
    recipeHeading.textContent = "Reaction ledger";
    const ledger = htmlElement(documentRef, "ol", "molecular-memory__recipe-ledger", {
      "aria-label": `${isomer.label} exact reaction history`
    });
    if (currentGlyph.recipeLedger.length) {
      ledger.append(...currentGlyph.recipeLedger.map((step) => recipeStepElement(documentRef, step)));
    } else {
      const origin = htmlElement(documentRef, "li", "molecular-memory__origin-step");
      origin.textContent = `${model.word} is an origin concept; no reaction was required.`;
      ledger.append(origin);
    }
    const integrity = htmlElement(documentRef, "p", "molecular-memory__integrity");
    integrity.textContent = currentGlyph.coverage.missing.length
      ? "Some recorded reactions are unavailable in this projection."
      : currentGlyph.recipeLedger.length === 1
        ? "The recorded reaction is preserved in this structure."
        : `All ${currentGlyph.recipeLedger.length} recorded reactions are preserved in this structure.`;
    panel.replaceChildren(header, summary, formula, tabs, recipeHeading, ledger, integrity);
  }

  function render() {
    glyph = projectMolecularMemoryGlyph(model, { isomerId: activeIsomerId });
    activeIsomerId = glyph.isomerId;
    root.replaceChildren(renderMolecularMemoryGlyph(documentRef, glyph));
    root.dataset.isomerId = glyph.isomerId;
    root.dataset.isomerCount = String(glyph.isomerCount);
    root.dataset.reactionCount = String(glyph.recipeLedger.length);
    descriptor.textContent = `${glyph.accessibleLabel} Hover and pause, or press Alt plus Down Arrow while this word is focused, to inspect the exact recipe.`;
    renderPanel();
    syncHostDisclosure();
    if (expanded) position();
  }

  function position() {
    return panelPosition(host, panel, view);
  }

  function unbindPositionListeners() {
    while (positionRemovers.length) positionRemovers.pop()?.();
  }

  function bindPositionListeners() {
    if (positionRemovers.length) return;
    eventListener(view, "resize", position, { passive: true }, positionRemovers);
    eventListener(view, "scroll", position, { passive: true, capture: true }, positionRemovers);
  }

  function setExpanded(next, behavior = {}) {
    clearTimers();
    const panelOwnedFocus = containsOrEquals(panel, documentRef.activeElement);
    expanded = Boolean(next);
    const restoreHostFocus = !expanded
      && (behavior.focusHost || (panelOwnedFocus && behavior.restoreFocus !== false));
    if (restoreHostFocus) host?.focus?.({ preventScroll: true });
    pinned = expanded && Boolean(behavior.pinned ?? pinned);
    panel.hidden = !expanded;
    root.dataset.state = expanded ? "expanded" : "resting";
    classToggle(root, "is-preview", false);
    if (expanded) {
      bindPositionListeners();
      position();
      if (typeof currentOptions.onExpandedChange === "function") {
        currentOptions.onExpandedChange({ expanded: true, pinned, isomerId: activeIsomerId });
      }
      if (behavior.focusPanel) panel.focus?.({ preventScroll: true });
    } else {
      unbindPositionListeners();
      pinned = false;
      if (typeof currentOptions.onExpandedChange === "function") {
        currentOptions.onExpandedChange({ expanded: false, pinned: false, isomerId: activeIsomerId });
      }
    }
    syncHostDisclosure();
    return expanded;
  }

  function selectIsomer(id, behavior = {}) {
    const next = isomerFromModel(model, id);
    if (!next) return false;
    activeIsomerId = next.id;
    render();
    if (typeof currentOptions.onIsomerChange === "function") {
      currentOptions.onIsomerChange({ isomerId: next.id, model, glyph });
    }
    if (behavior.focusTab) {
      const tab = panel.querySelector?.(`[data-mm-isomer-id="${next.id}"]`);
      tab?.focus?.({ preventScroll: true });
    }
    return true;
  }

  function beginInspection({ autoExpand = true } = {}) {
    clearTimers();
    const previewDelay = boundedInteger(currentOptions.previewDelayMs, MOLECULAR_MEMORY_HOVER_PREVIEW_MS, 0, 10_000);
    const expandDelay = Math.max(
      previewDelay,
      boundedInteger(currentOptions.expandDelayMs, MOLECULAR_MEMORY_HOVER_EXPAND_MS, 0, 20_000)
    );
    previewTimer = view.setTimeout?.(() => {
      previewTimer = 0;
      if (expanded) return;
      root.dataset.state = "preview";
      classToggle(root, "is-preview", true);
    }, previewDelay) || 0;
    if (autoExpand) {
      expandTimer = view.setTimeout?.(() => {
        expandTimer = 0;
        classToggle(root, "is-preview", false);
        setExpanded(true, { pinned: false });
      }, expandDelay) || 0;
    }
  }

  function endInspection(relatedTarget = null) {
    if (containsOrEquals(panel, relatedTarget) || containsOrEquals(host, relatedTarget)) return;
    clearTimers();
    classToggle(root, "is-preview", false);
    root.dataset.state = expanded ? "expanded" : "resting";
    if (!pinned) {
      closeTimer = view.setTimeout?.(() => {
        closeTimer = 0;
        setExpanded(false);
      }, 80) || 0;
    }
  }

  function onHostKeydown(event) {
    if (event.key === "ArrowDown" && event.altKey) {
      event.preventDefault?.();
      event.stopPropagation?.();
      setExpanded(true, { pinned: true, focusPanel: true });
      return;
    }
    if (event.key === "Escape" && expanded) {
      event.preventDefault?.();
      event.stopPropagation?.();
      setExpanded(false, { focusHost: true });
    }
  }

  function onPanelKeydown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault?.();
    event.stopPropagation?.();
    setExpanded(false, { pinned: false, focusHost: true });
  }

  function attach(nextHost, attachOptions = {}) {
    if (!nextHost?.append || !nextHost?.setAttribute) {
      throw new TypeError("Molecular Memory can only attach to a DOM-like host element.");
    }
    detach();
    host = nextHost;
    panelContainer = attachOptions.panelContainer || currentOptions.panelContainer || documentRef.body || host.parentElement;
    if (!panelContainer?.append) throw new TypeError("Molecular Memory needs a panel container or document.body.");
    hostAttributes = {
      describedBy: host.getAttribute?.("aria-describedby"),
      controls: host.getAttribute?.("aria-controls"),
      expanded: host.getAttribute?.("aria-expanded"),
      hasPopup: host.getAttribute?.("aria-haspopup"),
      keyshortcuts: host.getAttribute?.("aria-keyshortcuts"),
      hadHostClass: host.classList?.contains?.("molecular-memory-host") || false
    };
    classToggle(host, "molecular-memory-host", true);
    host.setAttribute("aria-describedby", appendTokenList(hostAttributes.describedBy, descriptorId));
    host.setAttribute("aria-controls", appendTokenList(hostAttributes.controls, panelId));
    host.setAttribute("aria-expanded", "false");
    host.setAttribute("aria-haspopup", "dialog");
    host.setAttribute("aria-keyshortcuts", appendTokenList(hostAttributes.keyshortcuts, "Alt+ArrowDown"));
    host.append(root, descriptor);
    panelContainer.append(panel);
    eventListener(host, "pointerenter", () => beginInspection({ autoExpand: true }), undefined, removers);
    eventListener(host, "pointerleave", (event) => endInspection(event.relatedTarget), undefined, removers);
    eventListener(host, "focusin", () => beginInspection({ autoExpand: false }), undefined, removers);
    eventListener(host, "focusout", (event) => endInspection(event.relatedTarget), undefined, removers);
    eventListener(host, "keydown", onHostKeydown, undefined, removers);
    eventListener(panel, "pointerenter", clearTimers, undefined, removers);
    eventListener(panel, "pointerleave", (event) => endInspection(event.relatedTarget), undefined, removers);
    eventListener(panel, "focusin", clearTimers, undefined, removers);
    eventListener(panel, "focusout", (event) => endInspection(event.relatedTarget), undefined, removers);
    eventListener(panel, "keydown", onPanelKeydown, undefined, removers);
    eventListener(panel, "pointerdown", (event) => event.stopPropagation?.(), undefined, removers);
    eventListener(panel, "click", (event) => event.stopPropagation?.(), undefined, removers);
    attached = true;
    syncHostDisclosure();
    return api;
  }

  function restoreAttribute(name, previous) {
    if (!host) return;
    if (previous === null || previous === undefined) host.removeAttribute?.(name);
    else host.setAttribute(name, previous);
  }

  function detach() {
    clearTimers();
    const panelOwnedFocus = containsOrEquals(panel, documentRef.activeElement);
    if (panelOwnedFocus) host?.focus?.({ preventScroll: true });
    unbindPositionListeners();
    while (removers.length) removers.pop()?.();
    if (host && hostAttributes) {
      restoreAttribute("aria-describedby", hostAttributes.describedBy);
      restoreAttribute("aria-controls", hostAttributes.controls);
      restoreAttribute("aria-expanded", hostAttributes.expanded);
      restoreAttribute("aria-haspopup", hostAttributes.hasPopup);
      restoreAttribute("aria-keyshortcuts", hostAttributes.keyshortcuts);
      if (!hostAttributes.hadHostClass) classToggle(host, "molecular-memory-host", false);
    }
    root.remove?.();
    descriptor.remove?.();
    panel.remove?.();
    host = null;
    panelContainer = null;
    hostAttributes = null;
    attached = false;
    expanded = false;
    pinned = false;
    return api;
  }

  function update(nextOptions = {}) {
    currentOptions = { ...currentOptions, ...record(nextOptions), document: documentRef, view };
    model = buildMolecularMemoryModel(currentOptions);
    const requested = safeId(nextOptions.activeIsomerId ?? nextOptions.activeDerivationId, "");
    const instanceChanged = Object.hasOwn(record(nextOptions), "instanceId")
      || Object.hasOwn(record(nextOptions), "selectedInstanceId");
    activeIsomerId = instanceChanged && !requested
      ? model.activeIsomerId
      : isomerFromModel(model, requested || activeIsomerId)?.id || model.activeIsomerId;
    render();
    return api;
  }

  function togglePinned(next = !pinned) {
    return setExpanded(Boolean(next), { pinned: Boolean(next), focusPanel: Boolean(next) });
  }

  function snapshot() {
    return deepFreeze({
      attached,
      expanded,
      pinned,
      activeIsomerId,
      model,
      glyph
    });
  }

  function destroy() {
    detach();
    return snapshot();
  }

  const api = {
    root,
    panel,
    descriptor,
    attach,
    detach,
    update,
    selectIsomer,
    setExpanded,
    togglePinned,
    position,
    snapshot,
    destroy,
    get model() { return model; },
    get glyph() { return glyph; },
    get activeIsomerId() { return activeIsomerId; }
  };

  render();
  return api;
}

// Explicit alias for integrations that also import the concept-chemistry
// domain's `createMolecularMemory` provenance projector.
export const createMolecularMemoryPresentation = createMolecularMemory;
