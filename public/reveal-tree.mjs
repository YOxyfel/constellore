const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 640;

export function revealWordKey(value) {
  return String(value || "").trim().toLowerCase();
}

function finiteSize(value, fallback, minimum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, number) : fallback;
}

function cleanStep(step, index) {
  const a = String(step?.a || "").trim();
  const b = String(step?.b || "").trim();
  const word = String(step?.word || "").trim();
  if (!a || !b || !word) return null;
  return {
    ...step,
    a,
    b,
    word,
    index,
    aKey: revealWordKey(a),
    bKey: revealWordKey(b),
    resultKey: revealWordKey(word)
  };
}

function layerRows(count, columns) {
  return Math.max(1, Math.ceil(Math.max(1, count) / Math.max(1, columns)));
}

/**
 * Build a deterministic bottom-to-top dependency tree for a verified reveal
 * route. Steps with the same result depth form one parallel animation wave.
 */
export function buildRevealTree(route, options = {}) {
  const width = finiteSize(options.width, DEFAULT_WIDTH, 240);
  const height = finiteSize(options.height, DEFAULT_HEIGHT, 220);
  const compact = options.compact ?? width < 760;
  const shortCompactStage = compact && height < 400;
  const nodeWidth = finiteSize(
    options.nodeWidth,
    compact ? (width < 350 ? 74 : width < 430 ? 88 : 112) : 132,
    76
  );
  const nodeHeight = finiteSize(options.nodeHeight, compact ? 46 : 42, 34);
  const horizontalPadding = finiteSize(options.horizontalPadding, compact ? (width < 350 ? 6 : 10) : 20, 4);
  /*
   * The narrow board uses compact equation and playback cards. Reserve their
   * real rendered height, including a small breathing gap, instead of the
   * older desktop-sized footer reserve. On short phones that old reserve left
   * less than one node of usable space, so camera centering necessarily put a
   * word underneath one of the cards.
   */
  const top = finiteSize(options.top, compact ? (shortCompactStage ? 84 : 92) : 222, 12);
  const bottom = finiteSize(options.bottom, compact ? 146 : 164, 12);
  const gap = compact ? (width < 350 ? 3 : 4) : 12;
  const verticalGap = compact ? 8 : 12;
  const steps = (Array.isArray(route) ? route : [])
    .map(cleanStep)
    .filter(Boolean);
  const nodes = new Map();
  const producers = new Map();

  const ensureNode = (word, metadata = {}) => {
    const key = revealWordKey(word);
    if (!key) return null;
    const existing = nodes.get(key);
    if (existing) {
      if ((!existing.emoji || existing.emoji === "✦") && metadata.emoji) existing.emoji = metadata.emoji;
      if (!existing.category && metadata.category) existing.category = metadata.category;
      return existing;
    }
    const node = {
      key,
      word: String(word).trim(),
      emoji: metadata.emoji || "✦",
      category: metadata.category || "",
      depth: 0,
      producerIndex: null,
      order: nodes.size,
      x: 0,
      y: 0,
      centerX: 0,
      centerY: 0,
      width: nodeWidth,
      height: nodeHeight
    };
    nodes.set(key, node);
    return node;
  };

  for (const step of steps) {
    ensureNode(step.a);
    ensureNode(step.b);
    const result = ensureNode(step.word, step);
    if (!producers.has(step.resultKey)) {
      producers.set(step.resultKey, step);
      result.producerIndex = step.index;
    }
  }

  const depthMemo = new Map();
  const depthFor = (key, visiting = new Set()) => {
    if (depthMemo.has(key)) return depthMemo.get(key);
    const producer = producers.get(key);
    if (!producer || visiting.has(key)) {
      depthMemo.set(key, 0);
      return 0;
    }
    const nextVisiting = new Set(visiting);
    nextVisiting.add(key);
    const depth = 1 + Math.max(
      depthFor(producer.aKey, nextVisiting),
      depthFor(producer.bKey, nextVisiting)
    );
    depthMemo.set(key, depth);
    return depth;
  };

  for (const node of nodes.values()) node.depth = depthFor(node.key);
  for (const step of steps) step.depth = Math.max(1, nodes.get(step.resultKey)?.depth || 1);

  const depthGroups = new Map();
  for (const node of nodes.values()) {
    if (!depthGroups.has(node.depth)) depthGroups.set(node.depth, []);
    depthGroups.get(node.depth).push(node);
  }
  const maxDepth = Math.max(0, ...depthGroups.keys());
  const availableWidth = Math.max(nodeWidth, width - horizontalPadding * 2);
  const columns = Math.max(1, Math.floor((availableWidth + gap) / (nodeWidth + gap)));
  /*
   * Order from the roots upward first, while producer positions are already
   * known. This makes the barycenter sort real rather than falling back to
   * insertion order for every layer.
   */
  const orderPosition = new Map();
  const orderedLayers = [...depthGroups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([depth, layerNodes]) => {
      layerNodes.sort((left, right) => {
        const barycenter = (node) => {
          const producer = producers.get(node.key);
          if (!producer) return Number.POSITIVE_INFINITY;
          const values = [producer.aKey, producer.bKey]
            .map((key) => orderPosition.get(key))
            .filter(Number.isFinite);
          return values.length
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : Number.POSITIVE_INFINITY;
        };
        return barycenter(left) - barycenter(right)
          || left.order - right.order
          || left.word.localeCompare(right.word, "en");
      });
      for (let index = 0; index < layerNodes.length; index += 1) {
        const rowStart = Math.floor(index / columns) * columns;
        const rowCount = Math.min(columns, layerNodes.length - rowStart);
        const column = index - rowStart;
        const rowWidth = rowCount * nodeWidth + Math.max(0, rowCount - 1) * gap;
        orderPosition.set(
          layerNodes[index].key,
          Math.max(horizontalPadding, (width - rowWidth) / 2)
            + column * (nodeWidth + gap)
            + nodeWidth / 2
        );
      }
      return {
        depth,
        nodes: layerNodes,
        rows: layerRows(layerNodes.length, columns)
      };
    });
  const layerPlan = orderedLayers.slice().sort((left, right) => right.depth - left.depth);
  const totalRows = layerPlan.reduce((sum, layer) => sum + layer.rows, 0);
  const requiredHeight = top
    + bottom
    + totalRows * nodeHeight
    + Math.max(0, totalRows - 1) * verticalGap;
  const contentHeight = Math.max(height, requiredHeight);
  const verticalRange = Math.max(nodeHeight, contentHeight - top - bottom - nodeHeight);
  const rowStep = totalRows > 1 ? verticalRange / (totalRows - 1) : 0;
  let rowCursor = 0;

  for (const layer of layerPlan) {
    for (let index = 0; index < layer.nodes.length; index += 1) {
      const row = Math.floor(index / columns);
      const rowStart = row * columns;
      const rowCount = Math.min(columns, layer.nodes.length - rowStart);
      const column = index - rowStart;
      const rowWidth = rowCount * nodeWidth + Math.max(0, rowCount - 1) * gap;
      const startX = Math.max(horizontalPadding, (width - rowWidth) / 2);
      const node = layer.nodes[index];
      node.x = Math.round(startX + column * (nodeWidth + gap));
      node.y = Math.round(top + (rowCursor + row) * rowStep);
      node.centerX = node.x + nodeWidth / 2;
      node.centerY = node.y + nodeHeight / 2;
    }
    rowCursor += layer.rows;
  }

  const nodeList = [...nodes.values()];
  const nodeByKey = Object.fromEntries(nodeList.map((node) => [node.key, node]));
  const edges = [];
  for (const step of steps) {
    const target = nodeByKey[step.resultKey];
    for (const [slot, sourceKey] of [["a", step.aKey], ["b", step.bKey]]) {
      const source = nodeByKey[sourceKey];
      if (!source || !target) continue;
      const repeatedSource = step.aKey === step.bKey;
      const laneOffset = repeatedSource
        ? (slot === "a" ? -1 : 1) * Math.min(11, nodeWidth * .09)
        : 0;
      edges.push({
        id: `${step.index}:${slot}`,
        stepIndex: step.index,
        slot,
        laneOffset,
        fromKey: sourceKey,
        toKey: step.resultKey,
        from: { x: source.centerX + laneOffset, y: source.centerY },
        to: { x: target.centerX + laneOffset * .28, y: target.centerY }
      });
    }
  }

  const batches = [...new Set(steps.map((step) => step.depth))]
    .sort((left, right) => left - right)
    .map((depth, index) => ({
      index,
      depth,
      steps: steps.filter((step) => step.depth === depth),
      stepIndices: steps.filter((step) => step.depth === depth).map((step) => step.index)
    }));

  return {
    nodes: nodeList,
    nodeByKey,
    edges,
    steps,
    batches,
    maxDepth,
    targetKey: steps.at(-1)?.resultKey || "",
    nodeWidth,
    nodeHeight,
    bounds: {
      width,
      height,
      contentHeight,
      maxCameraY: Math.max(0, contentHeight - height),
      top,
      bottom,
      left: horizontalPadding,
      right: horizontalPadding,
      compact
    }
  };
}
