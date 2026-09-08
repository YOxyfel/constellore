const MAX_LINEAGE_DEPTH = 8;
const MAX_COMPONENTS = 8;

function cleanWord(value, fallback = "Element") {
  const word = String(value || "").replace(/\s+/g, " ").trim().slice(0, 24);
  return word || fallback;
}

function atomLabel(word) {
  const parts = cleanWord(word).split(" ").filter(Boolean);
  if (parts.length > 1) return parts.slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("en-US");
  if (parts[0].length <= 2) return parts[0].toLocaleUpperCase("en-US");
  return `${parts[0][0].toLocaleUpperCase("en-US")}${parts[0][1].toLocaleLowerCase("en-US")}`;
}

function normalizeLineage(value, depth = 0) {
  const word = cleanWord(value?.word);
  if (depth >= MAX_LINEAGE_DEPTH || !Array.isArray(value?.inputs) || value.inputs.length < 2) {
    return { word, inputs: [] };
  }
  return {
    word,
    inputs: value.inputs.slice(0, 2).map((input) => normalizeLineage(input, depth + 1))
  };
}

function lineageDepth(node) {
  if (!node.inputs.length) return 0;
  return 1 + Math.max(...node.inputs.map(lineageDepth));
}

function ringPositions(count, { cx = 55, cy = 50, radiusX = 31, radiusY = 30 } = {}) {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    return {
      x: Number((cx + Math.cos(angle) * radiusX).toFixed(3)),
      y: Number((cy + Math.sin(angle) * radiusY).toFixed(3)),
      z: 0
    };
  });
}

function chemicalScaffold(count) {
  if (count <= 1) return { positions: [{ x: 55, y: 50, z: 0 }], bonds: [] };
  if (count === 2) {
    return {
      positions: [{ x: 37, y: 50, z: -5 }, { x: 73, y: 50, z: 5 }],
      bonds: [[0, 1, 2]]
    };
  }
  if (count === 3) {
    return {
      positions: [{ x: 55, y: 37, z: 10 }, { x: 30, y: 68, z: -7 }, { x: 80, y: 68, z: 5 }],
      bonds: [[0, 1, 1], [0, 2, 1]]
    };
  }
  if (count === 4) {
    return {
      positions: [{ x: 55, y: 50, z: 9 }, { x: 55, y: 19, z: -7 }, { x: 84, y: 69, z: 7 }, { x: 26, y: 69, z: -9 }],
      bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 2]]
    };
  }
  if (count === 5) {
    const positions = ringPositions(5, { radiusX: 31, radiusY: 31 });
    return {
      positions,
      bonds: positions.map((_, index) => [index, (index + 1) % positions.length, index % 2 === 0 ? 2 : 1])
    };
  }

  const positions = ringPositions(6, { cx: count > 6 ? 42 : 55, radiusX: 25, radiusY: 29 });
  const bonds = positions.map((_, index) => [index, (index + 1) % 6, index % 2 === 0 ? 2 : 1]);
  const fusedPositions = [
    { x: 85.3, y: 21, z: 7 },
    { x: 106.5, y: 35.5, z: 12 },
    { x: 106.5, y: 64.5, z: 5 },
    { x: 85.3, y: 79, z: -4 }
  ];
  const fusedBonds = [[1, 6, 1], [6, 7, 2], [7, 8, 1], [8, 9, 2], [9, 2, 1]];

  for (let index = 6; index < Math.min(count, 10); index += 1) positions.push(fusedPositions[index - 6]);
  for (const bond of fusedBonds) {
    if (bond[0] < positions.length && bond[1] < positions.length) bonds.push(bond);
  }

  const substituents = [
    { point: { x: 42, y: 5, z: 12 }, attach: 0 },
    { point: { x: 12, y: 12, z: -9 }, attach: 5 },
    { point: { x: 4, y: 50, z: 10 }, attach: 5 },
    { point: { x: 12, y: 88, z: -8 }, attach: 4 },
    { point: { x: 42, y: 95, z: 9 }, attach: 3 }
  ];
  for (let index = 10; index < count; index += 1) {
    const branch = substituents[index - 10] || substituents[substituents.length - 1];
    positions.push(branch.point);
    bonds.push([branch.attach, index, index % 2 === 0 ? 1 : 2]);
  }
  return { positions, bonds };
}

function flattenLineage(node, nodes, depth = 0, path = "root", parentId = null, inputIndex = -1) {
  const id = `chem-${path}`;
  nodes.push({
    id,
    word: node.word,
    label: atomLabel(node.word),
    role: depth === 0 ? "product" : node.inputs.length ? "reaction" : "component",
    depth,
    parentId,
    inputIndex
  });
  node.inputs.forEach((child, index) => flattenLineage(child, nodes, depth + 1, `${path}-${index}`, id, index));
}

function pairKey(from, to) {
  return [String(from), String(to)].sort().join("::");
}

function collectReactions(node, reactions) {
  for (const child of node.inputs) collectReactions(child, reactions);
  if (node.inputs.length) {
    reactions.push({
      inputs: node.inputs.map((input) => input.word),
      output: node.word
    });
  }
}

export function lineageFromComponents({ word, components, intermediates = [] } = {}) {
  const names = (Array.isArray(components) ? components : [])
    .map((component) => cleanWord(component, ""))
    .filter(Boolean)
    .slice(0, MAX_COMPONENTS);
  const leaves = (names.length ? names : [cleanWord(word)]).map((component) => ({ word: component, inputs: [] }));
  const queue = [...leaves];
  let intermediateIndex = 0;

  while (queue.length > 2) {
    const left = queue.shift();
    const right = queue.shift();
    queue.push({
      word: cleanWord(intermediates[intermediateIndex], `Bond ${intermediateIndex + 1}`),
      inputs: [left, right]
    });
    intermediateIndex += 1;
  }

  if (queue.length === 1) return { word: cleanWord(word, queue[0].word), inputs: [] };
  return { word: cleanWord(word), inputs: queue };
}

export function createWordChemistryGraph(lineage) {
  const root = normalizeLineage(lineage);
  const maxDepth = lineageDepth(root);
  const nodes = [];
  flattenLineage(root, nodes);
  const scaffold = chemicalScaffold(nodes.length);
  nodes.forEach((node, index) => Object.assign(node, scaffold.positions[index]));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const scaffoldOrderByPair = new Map(scaffold.bonds.map(([fromIndex, toIndex, order]) => [
    pairKey(nodes[fromIndex].id, nodes[toIndex].id),
    order
  ]));
  const childNodesByParent = new Map();
  nodes.filter((node) => node.parentId).forEach((node) => {
    if (!childNodesByParent.has(node.parentId)) childNodesByParent.set(node.parentId, []);
    childNodesByParent.get(node.parentId).push(node);
  });
  const reactionRules = [...childNodesByParent.entries()].map(([outputNodeId, children]) => {
    const outputNode = nodeById.get(outputNodeId);
    const sortedChildren = [...children].sort((left, right) => left.inputIndex - right.inputIndex);
    const ruleId = `rule-${outputNodeId}`;
    return {
      id: ruleId,
      output: outputNode.word,
      outputNodeId,
      inputs: sortedChildren.map((child) => child.word),
      inputNodeIds: sortedChildren.map((child) => child.id),
      bondIds: sortedChildren.map((child) => `recipe-${outputNodeId}-${child.inputIndex + 1}`)
    };
  });
  const recipeEdges = reactionRules.flatMap((rule) => rule.inputNodeIds.map((inputNodeId, index) => {
    const inputNode = nodeById.get(inputNodeId);
    const id = rule.bondIds[index];
    return {
      id,
      from: rule.outputNodeId,
      to: inputNodeId,
      order: scaffoldOrderByPair.get(pairKey(rule.outputNodeId, inputNodeId)) || ((index + inputNode.depth) % 3 === 0 ? 2 : 1),
      kind: inputNode.role === "component" ? "component" : "reaction",
      bondType: "recipe",
      ruleId: rule.id,
      reactionOutput: rule.output,
      reactionInput: inputNode.word
    };
  }));
  const recipePairs = new Set(recipeEdges.map((edge) => pairKey(edge.from, edge.to)));
  const supportLimit = nodes.length >= 5 ? Math.max(1, Math.floor((nodes.length - 2) / 5)) : 0;
  const supportCandidates = scaffold.bonds
    .map(([fromIndex, toIndex, order], index) => ({
      from: nodes[fromIndex].id,
      to: nodes[toIndex].id,
      order,
      index
    }))
    .filter((edge) => !recipePairs.has(pairKey(edge.from, edge.to)))
    .sort((left, right) => Number(right.from === nodes[0].id || right.to === nodes[0].id) - Number(left.from === nodes[0].id || left.to === nodes[0].id) || left.index - right.index)
    .slice(0, supportLimit)
    .map((edge, index) => ({
      id: `support-${index + 1}`,
      from: edge.from,
      to: edge.to,
      order: edge.order,
      kind: "support",
      bondType: "support"
    }));
  const edges = [...recipeEdges, ...supportCandidates];
  const reactions = [];
  collectReactions(root, reactions);
  const componentCount = nodes.filter((node) => node.role === "component" || (nodes.length === 1 && node.role === "product")).length;

  return {
    word: root.word,
    nodes,
    edges,
    bondBlueprints: edges.map((edge) => ({ ...edge })),
    reactions,
    reactionRules,
    componentCount,
    combinationCount: reactions.length,
    bondCount: edges.length,
    depth: maxDepth
  };
}
