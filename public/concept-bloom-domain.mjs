const clamp = (value, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const round = (value) => Math.round(value);
const normalize = (value) => String(value || "").trim().toLowerCase();

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function commandOk(state, event) {
  return deepFreeze({ ok: true, state: deepFreeze(state), event });
}

function commandError(state, code, message) {
  return deepFreeze({ ok: false, state, code, message });
}

const ASPECT_FEATURES = Object.freeze({
  bastion: Object.freeze({ barrier: 3, seal: 1, thermal: 1, habitation: 1, social: 0, energy: 0, redundancy: 0 }),
  hive: Object.freeze({ barrier: 1, seal: 2, thermal: 1, habitation: 3, social: 2, energy: 0, redundancy: 0 }),
  haven: Object.freeze({ barrier: 2, seal: 2, thermal: 3, habitation: 2, social: 1, energy: 0, redundancy: 0 })
});

export const WORD_CATALOG = deepFreeze([
  { id: "wall", word: "Wall", glyph: "▥", facet: "Structure", use: "Dense boundaries and impact resistance." },
  { id: "room", word: "Room", glyph: "□", facet: "Space", use: "Habitable volume and shared interior space." },
  { id: "adobe", word: "Adobe", glyph: "▰", facet: "Matter", use: "Thermal mass shaped from local material." },
  { id: "construction", word: "Construction", glyph: "⌁", facet: "Process", use: "A method that turns matter into shelter." },
  { id: "energy", word: "Energy", glyph: "ϟ", facet: "Force", use: "Can flow into a system or living component." },
  { id: "life", word: "Life", glyph: "✦", facet: "Living", use: "Makes habitation meaningful, but needs support." },
  { id: "community", word: "Community", glyph: "◌", facet: "Social", use: "Creates shared purpose through bridges." },
  { id: "atmosphere", word: "Atmosphere", glyph: "◍", facet: "Environment", use: "Must be contained and made useful to life." },
  { id: "water", word: "Water", glyph: "≈", facet: "Resource", use: "Can sustain life when its direction is coherent." },
  { id: "glass", word: "Glass", glyph: "◇", facet: "Matter", use: "A speculative material for light and enclosure." }
]);

const WORD_BY_NAME = new Map(WORD_CATALOG.map((entry) => [normalize(entry.word), entry]));

export const FUSION_RECIPES = deepFreeze([
  {
    id: "bastion-house",
    inputs: ["Wall", "Wall"],
    output: "House",
    aspectId: "bastion",
    aspect: "Bastion",
    thesis: "Protection through repeated boundary."
  },
  {
    id: "hive-house",
    inputs: ["Room", "Room"],
    output: "House",
    aspectId: "hive",
    aspect: "Hive",
    thesis: "Shelter as a network of inhabitable spaces."
  },
  {
    id: "haven-house",
    inputs: ["Adobe", "Construction"],
    output: "House",
    aspectId: "haven",
    aspect: "Haven",
    thesis: "Local matter shaped into a liveable refuge."
  }
]);

export const BOND_TYPES = deepFreeze([
  {
    id: "flow",
    label: "Flow",
    symbol: "→",
    directed: true,
    help: "The first node feeds, powers, or grows the second. Direction matters."
  },
  {
    id: "shell",
    label: "Shell",
    symbol: "⊃",
    directed: true,
    help: "The first node contains or protects the second. Direction matters."
  },
  {
    id: "bridge",
    label: "Bridge",
    symbol: "↔",
    directed: false,
    help: "Two meanings support one another. Endpoint order does not matter."
  }
]);

const BOND_TYPE_BY_ID = new Map(BOND_TYPES.map((entry) => [entry.id, entry]));

export const PURPOSES = deepFreeze([
  { id: "shelter", label: "Shelter", cost: 1, help: "Protect something vulnerable from the Moon." },
  { id: "habitat", label: "Habitat", cost: 2, help: "Sustain life rather than merely enclosing it." },
  { id: "community", label: "Community", cost: 2, help: "Create a place whose parts enable people together." }
]);

const PURPOSE_BY_ID = new Map(PURPOSES.map((entry) => [entry.id, entry]));

export const MOON_STRESSES = deepFreeze([
  {
    id: "vacuum",
    label: "Vacuum breach",
    summary: "Tests whether the bloom can hold atmosphere, energy, and life together.",
    weights: { seal: [4, 0.35], energy: [2, 0.2], habitation: [3, 0.3], thermal: [2, 0.15] }
  },
  {
    id: "dust",
    label: "Regolith storm",
    summary: "Tests seals, power continuity, barriers, and redundant routes.",
    weights: { seal: [3, 0.3], energy: [2, 0.25], barrier: [2, 0.25], redundancy: [2, 0.2] }
  },
  {
    id: "meteor",
    label: "Meteor strike",
    summary: "Tests hard protection and whether another route can carry the system.",
    weights: { barrier: [4, 0.55], redundancy: [2, 0.3], habitation: [2, 0.15] }
  },
  {
    id: "isolation",
    label: "Long isolation",
    summary: "Tests whether the shelter is a living social system, not only a bunker.",
    weights: { social: [3, 0.45], habitation: [3, 0.3], energy: [2, 0.15], redundancy: [2, 0.1] }
  }
]);

const STRESS_BY_ID = new Map(MOON_STRESSES.map((entry) => [entry.id, entry]));

export function createBloomState() {
  return deepFreeze({
    version: 1,
    scenarioId: "moon-shelter",
    coreNodeId: null,
    nodes: [],
    bonds: [],
    declaredPurposeIds: [],
    stressResults: [],
    nextNodeId: 1,
    nextBondId: 1
  });
}

function recipeFor(left, right) {
  const pair = [normalize(left), normalize(right)].sort();
  return FUSION_RECIPES.find((recipe) => {
    const inputs = recipe.inputs.map(normalize).sort();
    return inputs[0] === pair[0] && inputs[1] === pair[1];
  }) || null;
}

function cloneState(state, changes = {}) {
  return {
    ...state,
    nodes: state.nodes.map((node) => ({ ...node, ingredients: node.ingredients ? [...node.ingredients] : undefined })),
    bonds: state.bonds.map((bond) => ({ ...bond })),
    declaredPurposeIds: [...state.declaredPurposeIds],
    stressResults: state.stressResults.map((result) => ({ ...result, strengths: [...result.strengths], gaps: [...result.gaps] })),
    ...changes
  };
}

export function fuseWords(state, { left, right } = {}) {
  const recipe = recipeFor(left, right);
  if (!recipe) {
    return commandError(
      state,
      "no_stable_reaction",
      `${String(left || "?")} + ${String(right || "?")} has no stable House reaction in this test chamber.`
    );
  }

  const id = `node-${state.nextNodeId}`;
  const isCore = !state.coreNodeId;
  const node = {
    id,
    word: recipe.output,
    kind: isCore ? "core" : "proof",
    aspectId: recipe.aspectId,
    aspect: recipe.aspect,
    routeId: recipe.id,
    ingredients: [String(left).trim(), String(right).trim()],
    glyph: "⌂",
    facet: "Structure"
  };
  const next = cloneState(state, {
    coreNodeId: state.coreNodeId || id,
    nodes: [...state.nodes.map((item) => ({ ...item })), node],
    stressResults: [],
    nextNodeId: state.nextNodeId + 1
  });
  return commandOk(next, {
    type: "fusion",
    nodeId: id,
    message: isCore
      ? `${left} + ${right} became House · ${recipe.aspect}. The recipe is now part of its meaning.`
      : `A second House proof formed as ${recipe.aspect}. Bridge it to the core to create redundancy.`
  });
}

export function addWord(state, { word } = {}) {
  const catalogEntry = WORD_BY_NAME.get(normalize(word));
  if (!catalogEntry) return commandError(state, "unknown_word", `${String(word || "That word")} is not available in this lab.`);
  if (state.nodes.some((node) => node.kind === "component" && normalize(node.word) === normalize(catalogEntry.word))) {
    return commandError(state, "duplicate_component", `${catalogEntry.word} is already inside this bloom.`);
  }

  const id = `node-${state.nextNodeId}`;
  const node = {
    id,
    word: catalogEntry.word,
    kind: "component",
    glyph: catalogEntry.glyph,
    facet: catalogEntry.facet
  };
  const next = cloneState(state, {
    nodes: [...state.nodes.map((item) => ({ ...item })), node],
    stressResults: [],
    nextNodeId: state.nextNodeId + 1
  });
  return commandOk(next, {
    type: "component",
    nodeId: id,
    message: `${catalogEntry.word} entered the bloom. It has no effect until its relationship is expressed.`
  });
}

function nodePairWords(state, from, to) {
  const fromNode = state.nodes.find((node) => node.id === from);
  const toNode = state.nodes.find((node) => node.id === to);
  return { fromNode, toNode, fromWord: normalize(fromNode?.word), toWord: normalize(toNode?.word) };
}

function bridgePair(fromWord, toWord) {
  return [fromWord, toWord].sort().join("|");
}

export function classifyBond(state, { from, to, type } = {}) {
  const normalizedType = normalize(type);
  const { fromNode, toNode, fromWord, toWord } = nodePairWords(state, from, to);
  if (!fromNode || !toNode || !BOND_TYPE_BY_ID.has(normalizedType)) return null;

  let tier = "asserted";
  if (normalizedType === "flow") {
    const supported = new Set(["energy|house", "energy|life", "atmosphere|life", "life|community", "water|life"]);
    const strained = new Set(["energy|community", "water|house", "life|house", "atmosphere|house"]);
    const pair = `${fromWord}|${toWord}`;
    if (supported.has(pair)) tier = "supported";
    else if (strained.has(pair)) tier = "strained";
  } else if (normalizedType === "shell") {
    const supported = new Set(["house|atmosphere", "house|life", "house|community"]);
    const strained = new Set(["atmosphere|life", "wall|life", "glass|atmosphere"]);
    const pair = `${fromWord}|${toWord}`;
    if (supported.has(pair)) tier = "supported";
    else if (strained.has(pair)) tier = "strained";
  } else if (normalizedType === "bridge") {
    const pair = bridgePair(fromWord, toWord);
    if (["community|house", "community|life"].includes(pair)) tier = "supported";
    else if (["energy|house", "house|life", "atmosphere|house", "house|water"].includes(pair)) tier = "strained";
    else if (fromWord === "house" && toWord === "house") {
      tier = fromNode.routeId !== toNode.routeId ? "supported" : "strained";
    }
  }

  const fit = tier === "supported" ? 1 : tier === "strained" ? 0.6 : 0.2;
  const explanation = tier === "supported"
    ? "The relationship makes a clear contribution to this shelter."
    : tier === "strained"
      ? "The relationship is plausible, but needs a stronger semantic route."
      : "The relationship is asserted rather than demonstrated. It remains playable, but weakens the design.";
  return deepFreeze({ tier, fit, explanation });
}

function canonicalEndpoints(from, to, type) {
  if (type !== "bridge" || from.localeCompare(to) <= 0) return { from, to };
  return { from: to, to: from };
}

function validateBond(state, { from, to, type }, ignoredBondId = "") {
  const normalizedType = normalize(type);
  if (!BOND_TYPE_BY_ID.has(normalizedType)) return { code: "unknown_bond_type", message: "Choose Flow, Shell, or Bridge." };
  if (!state.nodes.some((node) => node.id === from) || !state.nodes.some((node) => node.id === to)) {
    return { code: "unknown_node", message: "Both endpoints must still exist in the bloom." };
  }
  if (from === to) return { code: "self_bond", message: "A concept cannot prove itself. Choose two different nodes." };
  const endpoints = canonicalEndpoints(from, to, normalizedType);
  const duplicate = state.bonds.some((bond) => (
    bond.id !== ignoredBondId
    && bond.type === normalizedType
    && bond.from === endpoints.from
    && bond.to === endpoints.to
  ));
  if (duplicate) return { code: "duplicate_bond", message: "That exact relationship is already present." };
  return { normalizedType, ...endpoints };
}

export function connectNodes(state, { from, to, type } = {}) {
  const validation = validateBond(state, { from, to, type });
  if (validation.code) return commandError(state, validation.code, validation.message);
  const quality = classifyBond(state, { from: validation.from, to: validation.to, type: validation.normalizedType });
  const id = `bond-${state.nextBondId}`;
  const bond = { id, from: validation.from, to: validation.to, type: validation.normalizedType, quality: quality.tier, fit: quality.fit };
  const next = cloneState(state, {
    bonds: [...state.bonds.map((item) => ({ ...item })), bond],
    stressResults: [],
    nextBondId: state.nextBondId + 1
  });
  return commandOk(next, {
    type: "bond",
    bondId: id,
    quality: quality.tier,
    message: `${describeBond(next, bond)} — ${quality.explanation}`
  });
}

export function rewireBond(state, { bondId, from, to, type } = {}) {
  const existing = state.bonds.find((bond) => bond.id === bondId);
  if (!existing) return commandError(state, "unknown_bond", "That bond no longer exists.");
  const validation = validateBond(state, { from, to, type }, bondId);
  if (validation.code) return commandError(state, validation.code, validation.message);
  const quality = classifyBond(state, { from: validation.from, to: validation.to, type: validation.normalizedType });
  const replacement = {
    id: existing.id,
    from: validation.from,
    to: validation.to,
    type: validation.normalizedType,
    quality: quality.tier,
    fit: quality.fit
  };
  const next = cloneState(state, {
    bonds: state.bonds.map((bond) => bond.id === bondId ? replacement : { ...bond }),
    stressResults: []
  });
  return commandOk(next, {
    type: "rewire",
    bondId,
    quality: quality.tier,
    message: `Bond rewired: ${describeBond(next, replacement)} — ${quality.explanation}`
  });
}

export function removeBond(state, bondId) {
  if (!state.bonds.some((bond) => bond.id === bondId)) return commandError(state, "unknown_bond", "That bond no longer exists.");
  return commandOk(cloneState(state, {
    bonds: state.bonds.filter((bond) => bond.id !== bondId).map((bond) => ({ ...bond })),
    stressResults: []
  }), { type: "bond_removed", bondId, message: "Bond removed. Choose a more defensible relationship." });
}

export function removeNode(state, nodeId) {
  const removed = state.nodes.find((node) => node.id === nodeId);
  if (!removed) return commandError(state, "unknown_node", "That concept no longer exists.");
  const remainingNodes = state.nodes.filter((node) => node.id !== nodeId).map((node) => ({ ...node }));
  let coreNodeId = state.coreNodeId;
  if (nodeId === coreNodeId) coreNodeId = remainingNodes.find((node) => node.word === "House")?.id || null;
  const normalizedNodes = remainingNodes.map((node) => ({
    ...node,
    kind: node.word === "House" ? (node.id === coreNodeId ? "core" : "proof") : node.kind
  }));
  const next = cloneState(state, {
    coreNodeId,
    nodes: normalizedNodes,
    bonds: state.bonds.filter((bond) => bond.from !== nodeId && bond.to !== nodeId).map((bond) => ({ ...bond })),
    stressResults: []
  });
  return commandOk(next, { type: "node_removed", nodeId, message: `${removed.word} left the bloom with its attached bonds.` });
}

export function declarePurposes(state, purposeIds = []) {
  const normalizedIds = [...new Set(purposeIds.map(normalize).filter((id) => PURPOSE_BY_ID.has(id)))];
  const next = cloneState(state, { declaredPurposeIds: normalizedIds, stressResults: [] });
  const label = normalizedIds.length
    ? normalizedIds.map((id) => PURPOSE_BY_ID.get(id).label).join(" + ")
    : "none";
  return commandOk(next, { type: "purpose", message: `Declared purpose: ${label}. Purpose consumes capacity and must be supported by the weave.` });
}

function coreNode(state) {
  return state.nodes.find((node) => node.id === state.coreNodeId) || null;
}

function supportedBond(state, predicate) {
  return state.bonds.some((bond) => bond.quality === "supported" && predicate(bond, nodePairWords(state, bond.from, bond.to)));
}

export function purposeCoverage(state) {
  const hasCore = Boolean(coreNode(state));
  const hasLife = state.nodes.some((node) => normalize(node.word) === "life");
  const hasCommunity = state.nodes.some((node) => normalize(node.word) === "community");
  const shelterShell = supportedBond(state, (bond, words) => (
    bond.type === "shell" && words.fromWord === "house" && ["atmosphere", "life", "community"].includes(words.toWord)
  ));
  const lifeShell = supportedBond(state, (bond, words) => bond.type === "shell" && ["atmosphere", "life"].includes(words.toWord));
  const lifeFlow = supportedBond(state, (bond, words) => bond.type === "flow" && words.toWord === "life");
  const energyFlow = supportedBond(state, (bond, words) => bond.type === "flow" && words.fromWord === "energy");
  const communityBridge = supportedBond(state, (bond, words) => (
    bond.type === "bridge" && [words.fromWord, words.toWord].includes("community")
  ));
  const features = featureVector(state);

  return deepFreeze({
    shelter: clamp((hasCore ? 0.6 : 0) + (shelterShell ? 0.2 : 0) + (features.barrier >= 2 ? 0.2 : 0), 0, 1),
    habitat: clamp(
      (hasCore ? 0.25 : 0)
      + (hasLife ? 0.2 : 0)
      + (lifeShell ? 0.2 : 0)
      + (lifeFlow ? 0.2 : 0)
      + (energyFlow ? 0.15 : 0),
      0,
      1
    ),
    community: clamp(
      (hasCore ? 0.2 : 0)
      + (hasLife ? 0.2 : 0)
      + (hasCommunity ? 0.2 : 0)
      + (communityBridge ? 0.4 : 0),
      0,
      1
    )
  });
}

export function inferPurposes(state) {
  const coverage = purposeCoverage(state);
  return deepFreeze(PURPOSES
    .filter((purpose) => coverage[purpose.id] >= 0.55)
    .map((purpose) => ({ ...purpose, coverage: coverage[purpose.id] })));
}

function addFeature(features, name, amount) {
  features[name] = (features[name] || 0) + amount;
}

function bondContribution(state, bond, features) {
  const { fromNode, toNode, fromWord, toWord } = nodePairWords(state, bond.from, bond.to);
  const scale = bond.fit;
  if (bond.type === "flow") {
    if (fromWord === "energy" && toWord === "house") addFeature(features, "energy", 2 * scale);
    if (fromWord === "energy" && toWord === "life") {
      addFeature(features, "energy", 1 * scale);
      addFeature(features, "habitation", 1 * scale);
    }
    if (fromWord === "atmosphere" && toWord === "life") addFeature(features, "habitation", 2 * scale);
    if (fromWord === "water" && toWord === "life") addFeature(features, "habitation", 1 * scale);
    if (fromWord === "life" && toWord === "community") addFeature(features, "social", 1 * scale);
  }
  if (bond.type === "shell") {
    if (fromWord === "house" && toWord === "atmosphere") addFeature(features, "seal", 2 * scale);
    if (fromWord === "house" && toWord === "life") {
      addFeature(features, "seal", 1 * scale);
      addFeature(features, "habitation", 1 * scale);
    }
    if (fromWord === "house" && toWord === "community") {
      addFeature(features, "seal", 0.5 * scale);
      addFeature(features, "social", 0.5 * scale);
    }
  }
  if (bond.type === "bridge") {
    const pair = bridgePair(fromWord, toWord);
    if (["community|house", "community|life"].includes(pair)) addFeature(features, "social", 2 * scale);
    if (fromWord === "house" && toWord === "house" && fromNode.routeId !== toNode.routeId) {
      addFeature(features, "redundancy", 2 * scale);
      addFeature(features, "barrier", 1 * scale);
    }
  }
}

export function featureVector(state) {
  const core = coreNode(state);
  const features = { barrier: 0, seal: 0, thermal: 0, habitation: 0, social: 0, energy: 0, redundancy: 0 };
  if (core) Object.assign(features, ASPECT_FEATURES[core.aspectId]);
  for (const bond of state.bonds) bondContribution(state, bond, features);
  return deepFreeze(Object.fromEntries(Object.entries(features).map(([key, value]) => [key, Math.round(value * 100) / 100])));
}

function capacityEvaluation(state) {
  const core = coreNode(state);
  const aspectBonus = core?.aspectId === "hive" ? 2 : core?.aspectId === "haven" ? 1 : 0;
  const routeBridgeCount = state.bonds.filter((bond) => {
    if (bond.type !== "bridge" || bond.quality !== "supported") return false;
    const { fromNode, toNode } = nodePairWords(state, bond.from, bond.to);
    return fromNode?.word === "House" && toNode?.word === "House" && fromNode.routeId !== toNode.routeId;
  }).length;
  const attachmentCount = state.nodes.filter((node) => node.id !== state.coreNodeId).length;
  const extraHouseCount = state.nodes.filter((node) => node.word === "House" && node.id !== state.coreNodeId).length;
  const strainedCount = state.bonds.filter((bond) => bond.quality === "strained").length;
  const assertedCount = state.bonds.filter((bond) => bond.quality === "asserted").length;
  const purposeCost = state.declaredPurposeIds.reduce((total, id) => total + (PURPOSE_BY_ID.get(id)?.cost || 0), 0);
  // A single core can carry one ambitious weave. A distinct bridged proof
  // pays for its own complexity while expanding the system's design space.
  const limit = 8 + aspectBonus + Math.min(4, routeBridgeCount * 2);
  const used = Math.round((
    attachmentCount * 0.5
    + state.bonds.length * 0.5
    + purposeCost
    + extraHouseCount
    + strainedCount * 0.5
    + assertedCount
  ) * 10) / 10;
  const ratio = limit ? used / limit : 0;
  return {
    used,
    limit,
    remaining: Math.round((limit - used) * 10) / 10,
    ratio,
    score: used <= limit ? 100 : round(100 * limit / used),
    status: ratio <= 0.8 ? "stable" : ratio <= 1 ? "strained" : "overloaded"
  };
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function relevantPurposeIds(state, coverage) {
  if (state.declaredPurposeIds.length) return state.declaredPurposeIds;
  const inferred = PURPOSES.filter((purpose) => coverage[purpose.id] >= 0.55).map((purpose) => purpose.id);
  if (inferred.length) return inferred;
  return [Object.entries(coverage).sort((a, b) => b[1] - a[1])[0]?.[0] || "shelter"];
}

function integrityScore(state, features, coverage, capacity) {
  if (!coreNode(state)) return 0;
  const componentScores = {
    shelter: 0.6 * Math.min(features.barrier / 3, 1) + 0.4 * Math.min(features.seal / 3, 1),
    habitat: 0.35 * Math.min(features.seal / 3, 1)
      + 0.25 * Math.min(features.energy / 2, 1)
      + 0.25 * Math.min(features.habitation / 3, 1)
      + 0.15 * Math.min(features.thermal / 2, 1),
    community: 0.25 * Math.min(features.habitation / 3, 1)
      + 0.55 * Math.min(features.social / 3, 1)
      + 0.2 * Math.min(features.redundancy / 2, 1)
  };
  const ids = relevantPurposeIds(state, coverage);
  const weakPenalty = state.bonds.filter((bond) => bond.quality === "strained").length * 6
    + state.bonds.filter((bond) => bond.quality === "asserted").length * 12;
  const overloadPenalty = Math.max(0, capacity.used - capacity.limit) * 10;
  return clamp(round(average(ids.map((id) => componentScores[id] || 0)) * 100 - weakPenalty - overloadPenalty));
}

export function evaluateBloom(state) {
  const coverage = purposeCoverage(state);
  const inferredPurposes = inferPurposes(state);
  const features = featureVector(state);
  const capacity = capacityEvaluation(state);
  const attachments = state.nodes.filter((node) => node.id !== state.coreNodeId);
  const connectedIds = new Set(state.bonds.flatMap((bond) => [bond.from, bond.to]));
  const attachmentRatio = attachments.length
    ? attachments.filter((node) => connectedIds.has(node.id)).length / attachments.length
    : 1;
  const averageBondFit = state.bonds.length ? average(state.bonds.map((bond) => bond.fit)) : 0.5;
  const ids = relevantPurposeIds(state, coverage);
  const averagePurposeCoverage = average(ids.map((id) => coverage[id] || 0));
  const coherence = clamp(round(100 * (0.5 * averageBondFit + 0.2 * attachmentRatio + 0.3 * averagePurposeCoverage)));
  const integrity = integrityScore(state, features, coverage, capacity);

  const issues = [];
  if (!coreNode(state)) issues.push({ severity: "critical", text: "No core concept. Fuse a House before this can become a shelter." });
  if (!state.declaredPurposeIds.length && coreNode(state)) {
    issues.push({ severity: "notice", text: "Purpose is still inferred. Declare what this bloom is meant to do." });
  }
  for (const purposeId of state.declaredPurposeIds) {
    if ((coverage[purposeId] || 0) < 0.55) {
      issues.push({ severity: "warning", text: `${PURPOSE_BY_ID.get(purposeId).label} is declared, but the current bonds do not demonstrate it.` });
    }
  }
  const disconnected = attachments.filter((node) => !connectedIds.has(node.id));
  if (disconnected.length) {
    issues.push({ severity: "warning", text: `${disconnected.map((node) => node.word).join(", ")} ${disconnected.length === 1 ? "is" : "are"} present but unconnected.` });
  }
  for (const bond of state.bonds.filter((item) => item.quality !== "supported")) {
    issues.push({
      severity: bond.quality === "asserted" ? "critical" : "warning",
      text: `${describeBond(state, bond)} is ${bond.quality}; rewire it if you cannot defend that claim.`
    });
  }
  if (capacity.status === "overloaded") {
    issues.push({ severity: "critical", text: `The bloom uses ${capacity.used} of ${capacity.limit} capacity. It can still run, but overload weakens every stress result.` });
  } else if (capacity.status === "strained") {
    issues.push({ severity: "warning", text: `Only ${Math.max(0, capacity.remaining)} capacity remains. Another purpose or weak bond may overload the bloom.` });
  }

  const overall = !coreNode(state)
    ? "unformed"
    : integrity >= 75 && coherence >= 75 && capacity.status !== "overloaded"
      ? "resilient"
      : integrity >= 50 && coherence >= 55 && capacity.status !== "overloaded"
        ? "coherent"
        : "fragile";
  return deepFreeze({
    overall,
    coherence,
    integrity,
    capacity,
    coverage,
    inferredPurposes,
    features,
    issues
  });
}

export function runMoonStress(state, stressId) {
  const stress = STRESS_BY_ID.get(normalize(stressId));
  if (!stress) return commandError(state, "unknown_stress", "Choose a Moon stress test.");
  const evaluation = evaluateBloom(state);
  if (!coreNode(state)) return commandError(state, "no_core", "Fuse a House before running environmental stress.");
  const strengths = [];
  const gaps = [];
  let raw = 0;
  for (const [feature, [requirement, weight]] of Object.entries(stress.weights)) {
    const actual = evaluation.features[feature] || 0;
    const ratio = Math.min(actual / requirement, 1);
    raw += ratio * weight * 100;
    const label = feature[0].toUpperCase() + feature.slice(1);
    if (ratio >= 0.85) strengths.push(`${label} ${actual}/${requirement}`);
    else gaps.push(`${label} ${actual}/${requirement}`);
  }
  const weakPenalty = state.bonds.filter((bond) => bond.quality === "strained").length * 4
    + state.bonds.filter((bond) => bond.quality === "asserted").length * 9;
  const overloadPenalty = Math.max(0, evaluation.capacity.used - evaluation.capacity.limit) * 8;
  const score = clamp(round(raw - weakPenalty - overloadPenalty));
  const outcome = score >= 80 ? "endures" : score >= 55 ? "strains" : "fails";
  const result = deepFreeze({
    stressId: stress.id,
    label: stress.label,
    score,
    outcome,
    strengths,
    gaps,
    summary: outcome === "endures"
      ? `The ${coreNode(state).aspect} design endures ${stress.label.toLowerCase()}.`
      : outcome === "strains"
        ? `The design holds under ${stress.label.toLowerCase()}, but the weak links are visible.`
        : `${stress.label} breaks the argument. Rewire the bloom and test it again.`
  });
  const next = cloneState(state, {
    stressResults: [...state.stressResults.filter((item) => item.stressId !== stress.id), result]
  });
  return commandOk(next, { type: "stress", result, message: `${result.summary} Score: ${score}.` });
}

export function describeBond(state, bond) {
  const from = state.nodes.find((node) => node.id === bond.from);
  const to = state.nodes.find((node) => node.id === bond.to);
  if (!from || !to) return "Incomplete bond";
  const fromLabel = from.aspect ? `${from.word} · ${from.aspect}` : from.word;
  const toLabel = to.aspect ? `${to.word} · ${to.aspect}` : to.word;
  if (bond.type === "flow") return `${fromLabel} flows into ${toLabel}`;
  if (bond.type === "shell") return `${fromLabel} shells ${toLabel}`;
  return `${fromLabel} bridges ${toLabel}`;
}

export function createBloomSnapshot(state) {
  const evaluation = evaluateBloom(state);
  const core = coreNode(state);
  if (!core) return deepFreeze({ ready: false, reason: "Fuse a House to preview a world consequence." });
  const declared = state.declaredPurposeIds.map((id) => PURPOSE_BY_ID.get(id)).filter(Boolean);
  const purposes = declared.length ? declared : evaluation.inferredPurposes;
  const signaturePurpose = purposes.map((purpose) => purpose.label).join(" + ") || "Unresolved";
  const strongestStress = [...state.stressResults].sort((a, b) => b.score - a.score)[0] || null;
  const weakestStress = [...state.stressResults].sort((a, b) => a.score - b.score)[0] || null;
  return deepFreeze({
    ready: true,
    title: `${signaturePurpose} ${core.aspect}`,
    aspect: core.aspect,
    purposes: purposes.map((purpose) => purpose.label),
    state: evaluation.overall,
    coherence: evaluation.coherence,
    integrity: evaluation.integrity,
    nodeCount: state.nodes.length,
    bondCount: state.bonds.length,
    strongestStress,
    weakestStress,
    note: "Lab preview only — this snapshot is not written to profile or Moonhaven state."
  });
}
