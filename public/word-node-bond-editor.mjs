const MIN_BOND_INTEGRITY = 0;
const MAX_BOND_INTEGRITY = 100;
export const BOND_FRACTURE_THRESHOLD = 15;

function clampIntegrity(value) {
  return Math.max(MIN_BOND_INTEGRITY, Math.min(MAX_BOND_INTEGRITY, Math.round(Number(value) || 0)));
}

function normalizedPair(from, to) {
  return [String(from), String(to)].sort().join("::");
}

function nextBondId(edges) {
  const occupied = new Set(edges.map((edge) => edge.id));
  let index = edges.length + 1;
  while (occupied.has(`bond-${index}`)) index += 1;
  return `bond-${index}`;
}

function withBondCount(graph, edges) {
  return { ...graph, edges, bondCount: edges.length };
}

function defaultBondIntegrity(edge, index) {
  const orderStrength = Number(edge.order) >= 2 ? 76 : 58;
  const componentBonus = edge.kind === "component" ? 8 : 0;
  const variation = (index % 3 - 1) * 4;
  return clampIntegrity(orderStrength + componentBonus + variation);
}

export function bondStability(integrity) {
  const value = clampIntegrity(integrity);
  if (value >= 70) return { key: "stable", label: "Stable", integrity: value };
  if (value >= 40) return { key: "strained", label: "Strained", integrity: value };
  return { key: "unstable", label: "Unstable", integrity: value };
}

export function createEditableBondGraph(graph) {
  const nodes = (graph?.nodes || []).map((node) => ({ ...node }));
  const edges = (graph?.edges || []).map((edge, index) => ({
    ...edge,
    id: edge.id || `bond-${index + 1}`,
    integrity: Number.isFinite(edge.integrity) ? clampIntegrity(edge.integrity) : defaultBondIntegrity(edge, index)
  }));
  const bondBlueprints = (graph?.bondBlueprints || graph?.edges || []).map((edge) => ({ ...edge }));
  const reactionRules = (graph?.reactionRules || []).map((rule) => ({ ...rule, inputs: [...rule.inputs], inputNodeIds: [...rule.inputNodeIds], bondIds: [...rule.bondIds] }));
  return { ...graph, nodes, edges, bondBlueprints, reactionRules, bondCount: edges.length };
}

export function connectedBondFragments(graph) {
  const nodeIds = (graph?.nodes || []).map((node) => node.id);
  const adjacency = new Map(nodeIds.map((id) => [id, new Set()]));
  for (const edge of graph?.edges || []) {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) continue;
    adjacency.get(edge.from).add(edge.to);
    adjacency.get(edge.to).add(edge.from);
  }

  const visited = new Set();
  const fragments = [];
  for (const nodeId of nodeIds) {
    if (visited.has(nodeId)) continue;
    const fragment = [];
    const queue = [nodeId];
    visited.add(nodeId);
    while (queue.length) {
      const current = queue.shift();
      fragment.push(current);
      for (const neighbor of adjacency.get(current) || []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    fragments.push(fragment);
  }
  return fragments;
}

function reactionLeaves(word, reactionByOutput, trail = new Set()) {
  const key = String(word || "");
  const reaction = reactionByOutput.get(key);
  if (!reaction || trail.has(key)) return [key];
  const nextTrail = new Set(trail).add(key);
  return reaction.inputs.flatMap((input) => reactionLeaves(input, reactionByOutput, nextTrail));
}

export function deriveWordFragments(graph) {
  const reactions = graph?.reactions || [];
  const reactionByOutput = new Map(reactions.map((reaction) => [reaction.output, reaction]));
  const ruleByOutput = new Map((graph?.reactionRules || []).map((rule) => [rule.output, rule]));
  const presentBondIds = new Set((graph?.edges || []).map((edge) => edge.id));
  const rootWord = String(graph?.word || "Word");

  if (!ruleByOutput.size) {
    return [{ word: rootWord, fragmentIndex: 0, sourceWords: [rootWord] }];
  }

  const resolveWord = (word, trail = new Set()) => {
    const rule = ruleByOutput.get(word);
    if (!rule || trail.has(word)) return [word];
    const nextTrail = new Set(trail).add(word);
    const resolvedInputs = rule.inputs.map((input) => resolveWord(input, nextTrail));
    const inputsIntact = resolvedInputs.every((result, index) => result.length === 1 && result[0] === rule.inputs[index]);
    const recipeBondsIntact = rule.bondIds.every((bondId) => presentBondIds.has(bondId));
    return inputsIntact && recipeBondsIntact ? [word] : resolvedInputs.flat();
  };

  return resolveWord(rootWord).map((word, fragmentIndex) => ({
    word,
    fragmentIndex,
    sourceWords: [...new Set(reactionLeaves(word, reactionByOutput))]
  }));
}

function sortedWords(words) {
  return [...words].map(String).sort((left, right) => left.localeCompare(right, "en-US"));
}

function wordsMatch(left, right) {
  const sortedLeft = sortedWords(left);
  const sortedRight = sortedWords(right);
  return sortedLeft.length === sortedRight.length && sortedLeft.every((word, index) => word === sortedRight[index]);
}

export function canonicalBreakGoals(graph) {
  const rules = graph?.reactionRules || [];
  const goals = [];
  const seenTargets = new Set();
  const goalForRuleIds = (ruleIds, suffix) => {
    const cutRuleIds = new Set(ruleIds);
    const cutBondIds = new Set(rules
      .filter((rule) => cutRuleIds.has(rule.id))
      .map((rule) => rule.bondIds[0])
      .filter(Boolean));
    const previewGraph = withBondCount(graph, (graph?.edges || []).filter((edge) => !cutBondIds.has(edge.id)));
    const targetWords = deriveWordFragments(previewGraph).map((fragment) => fragment.word);
    const targetKey = sortedWords(targetWords).join("|");
    if (!targetKey || targetKey === String(graph?.word || "") || seenTargets.has(targetKey)) return;
    seenTargets.add(targetKey);
    goals.push({
      id: `goal-${suffix}`,
      sourceWord: graph.word,
      ruleIds: [...cutRuleIds],
      targetWords,
      label: `${graph.word} → ${targetWords.join(" + ")}`
    });
  };

  rules.forEach((rule) => goalForRuleIds([rule.id], rule.id));
  if (rules.length > 1) goalForRuleIds(rules.map((rule) => rule.id), "complete-decomposition");
  return goals;
}

export function evaluateBreakGoal(graph, goal) {
  const currentWords = deriveWordFragments(graph).map((fragment) => fragment.word);
  const presentBondIds = new Set((graph?.edges || []).map((edge) => edge.id));
  const ruleById = new Map((graph?.reactionRules || []).map((rule) => [rule.id, rule]));
  const completedRuleIds = (goal?.ruleIds || []).filter((ruleId) => {
    const rule = ruleById.get(ruleId);
    return rule && rule.bondIds.some((bondId) => !presentBondIds.has(bondId));
  });
  return {
    currentWords,
    targetWords: [...(goal?.targetWords || [])],
    completedRules: completedRuleIds.length,
    totalRules: goal?.ruleIds?.length || 0,
    achieved: Boolean(goal) && completedRuleIds.length === (goal.ruleIds?.length || 0) && wordsMatch(currentWords, goal.targetWords || [])
  };
}

export function bondGraphEffects(graph) {
  const edges = graph?.edges || [];
  const fragments = connectedBondFragments(graph);
  const wordFragments = deriveWordFragments(graph);
  const wordIsSplit = wordFragments.length !== 1 || wordFragments[0]?.word !== graph?.word;
  const totalWeight = edges.reduce((sum, edge) => sum + Math.max(1, Number(edge.order) || 1), 0);
  const weightedIntegrity = totalWeight
    ? edges.reduce((sum, edge) => sum + clampIntegrity(edge.integrity) * Math.max(1, Number(edge.order) || 1), 0) / totalWeight
    : (graph?.nodes?.length || 0) <= 1 ? 100 : 0;
  const unstableBonds = edges.filter((edge) => bondStability(edge.integrity).key === "unstable").length;
  const strainedBonds = edges.filter((edge) => bondStability(edge.integrity).key === "strained").length;
  const fragmentPenalty = Math.max(0, fragments.length - 1) * 12 + Math.max(0, wordFragments.length - 1) * 18;
  const cohesion = clampIntegrity(weightedIntegrity - fragmentPenalty);
  const reactivity = clampIntegrity(100 - cohesion + unstableBonds * 8 + Math.max(0, wordFragments.length - 1) * 12);
  const state = wordIsSplit || fragments.length > 1
    ? { key: "fragmented", label: "Fragmented" }
    : unstableBonds
      ? { key: "unstable", label: "Unstable" }
      : strainedBonds
        ? { key: "strained", label: "Strained" }
        : { key: "stable", label: "Stable" };
  return {
    cohesion,
    reactivity,
    fragmentCount: fragments.length,
    wordCount: wordFragments.length,
    unstableBonds,
    strainedBonds,
    state
  };
}

export function adjustBondIntegrity(graph, bondId, delta) {
  let adjustedBond = null;
  const edges = (graph?.edges || []).map((edge) => {
    if (edge.id !== bondId) return { ...edge };
    adjustedBond = { ...edge, integrity: clampIntegrity(edge.integrity + delta) };
    return adjustedBond;
  });
  if (!adjustedBond) return { graph, changed: false, bond: null };
  return { graph: withBondCount(graph, edges), changed: true, bond: adjustedBond };
}

export function weakenEditableBond(graph, bondId, amount = 20) {
  const adjusted = adjustBondIntegrity(graph, bondId, -Math.abs(Number(amount) || 0));
  if (!adjusted.changed) {
    return { graph, changed: false, bond: null, snapped: false, didSplit: false, fragments: connectedBondFragments(graph) };
  }
  if (adjusted.bond.integrity > BOND_FRACTURE_THRESHOLD) {
    return {
      ...adjusted,
      snapped: false,
      didSplit: false,
      fragments: connectedBondFragments(adjusted.graph)
    };
  }
  const fracture = removeEditableBond(adjusted.graph, bondId);
  return {
    graph: fracture.graph,
    changed: true,
    bond: adjusted.bond,
    snapped: true,
    didSplit: fracture.didSplit,
    fragments: fracture.fragments
  };
}

export function removeEditableBond(graph, bondId) {
  const beforeFragments = connectedBondFragments(graph);
  const removedBond = (graph?.edges || []).find((edge) => edge.id === bondId) || null;
  if (!removedBond) {
    return { graph, changed: false, removedBond: null, fragments: beforeFragments, didSplit: false };
  }
  const edges = graph.edges.filter((edge) => edge.id !== bondId).map((edge) => ({ ...edge }));
  const nextGraph = withBondCount(graph, edges);
  const fragments = connectedBondFragments(nextGraph);
  return {
    graph: nextGraph,
    changed: true,
    removedBond: { ...removedBond },
    fragments,
    didSplit: fragments.length > beforeFragments.length
  };
}

export function addEditableBond(graph, from, to) {
  const fromId = String(from || "");
  const toId = String(to || "");
  const nodeIds = new Set((graph?.nodes || []).map((node) => node.id));
  if (!fromId || !toId || fromId === toId) {
    return { graph, changed: false, bond: null, reason: "Choose two different atoms." };
  }
  if (!nodeIds.has(fromId) || !nodeIds.has(toId)) {
    return { graph, changed: false, bond: null, reason: "That atom is no longer available." };
  }
  const pair = normalizedPair(fromId, toId);
  if ((graph.edges || []).some((edge) => normalizedPair(edge.from, edge.to) === pair)) {
    return { graph, changed: false, bond: null, reason: "Those atoms are already bonded." };
  }
  const blueprint = (graph?.bondBlueprints || []).find((edge) => normalizedPair(edge.from, edge.to) === pair);
  const bond = blueprint
    ? { ...blueprint, integrity: 48 }
    : {
      id: nextBondId(graph.edges || []),
      from: fromId,
      to: toId,
      order: 1,
      kind: "synthetic",
      bondType: "synthetic",
      integrity: 48
    };
  return {
    graph: withBondCount(graph, [...graph.edges.map((edge) => ({ ...edge })), bond]),
    changed: true,
    bond,
    reason: blueprint?.bondType === "recipe" ? "Recipe bond restored under strain." : "Bond formed under strain."
  };
}
