const CATEGORY_SET = new Set(["force", "nature", "life", "structure", "celestial", "unknown"]);
const MAX_HISTORY = 160;
const MAX_NODES = 84;

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function safeText(value, maximum = 64) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function keyFor(value) {
  return safeText(value, 64).toLocaleLowerCase("en-US");
}

function safeCategory(value) {
  const category = safeText(value, 24).toLowerCase();
  return CATEGORY_SET.has(category) ? category : "unknown";
}

export function sanitizeAtlasHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const history = [];
  for (const source of raw.slice(0, MAX_HISTORY)) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    const a = safeText(source.a, 48);
    const b = safeText(source.b, 48);
    const word = safeText(source.word, 48);
    if (!a || !b || !word) continue;
    history.push({
      a,
      b,
      word,
      emoji: safeText(source.emoji, 12),
      category: safeCategory(source.category),
      newDiscovery: Boolean(source.newDiscovery),
      twisted: Boolean(source.twisted),
      revealed: Boolean(source.revealed),
      insight: safeText(source.insight, 180)
    });
  }
  return history;
}

/** A compact, non-spoiling trail for the always-visible HUD and result card. */
export function buildRouteProgress({ history: rawHistory = [], target = "", limit = 6 } = {}) {
  const history = sanitizeAtlasHistory(rawHistory);
  const safeTarget = safeText(target, 48);
  const visibleLimit = clampInteger(limit, 3, 10, 6);
  const omitted = Math.max(0, history.length - visibleLimit);
  const steps = history.slice(-visibleLimit).map((step, index) => ({
    id: `route-step-${omitted + index + 1}`,
    number: omitted + index + 1,
    word: step.word,
    emoji: step.emoji || "✦",
    twisted: step.twisted,
    revealed: step.revealed
  }));
  const targetReached = Boolean(safeTarget && history.some((step) => keyFor(step.word) === keyFor(safeTarget)));
  return Object.freeze({
    combinations: history.length,
    discoveries: history.filter((step) => step.newDiscovery).length,
    omitted,
    steps,
    target: safeTarget,
    targetReached,
    lineFill: history.length ? Math.min(92, 18 + history.length * 9) : 0
  });
}

function addNode(nodes, value, options = {}) {
  const label = safeText(value, 48);
  const key = keyFor(label);
  if (!key || nodes.has(key) || nodes.size >= MAX_NODES) return nodes.get(key) || null;
  const node = {
    id: `word-${nodes.size + 1}`,
    key,
    label,
    emoji: safeText(options.emoji, 12),
    category: safeCategory(options.category),
    depth: clampInteger(options.depth, 0, 24, 0),
    target: Boolean(options.target),
    starter: Boolean(options.starter),
    locked: false,
    x: 0,
    y: 0
  };
  nodes.set(key, node);
  return node;
}

function updateNode(node, options = {}) {
  if (!node) return;
  if (options.emoji && !node.emoji) node.emoji = safeText(options.emoji, 12);
  if (options.category && node.category === "unknown") node.category = safeCategory(options.category);
  if (options.target) node.target = true;
  if (options.starter) node.starter = true;
  if (Number.isFinite(Number(options.depth))) node.depth = Math.max(node.depth, clampInteger(options.depth, 0, 24, node.depth));
}

function layoutColumns(nodes, width, height) {
  const visible = [...nodes.values()].filter((node) => !node.locked);
  const maximumDepth = Math.max(1, ...visible.map((node) => node.depth));
  const columns = new Map();
  for (const node of visible) {
    const depth = Math.min(maximumDepth, node.depth);
    if (!columns.has(depth)) columns.set(depth, []);
    columns.get(depth).push(node);
  }
  for (const [depth, column] of columns) {
    column.sort((left, right) => Number(right.target) - Number(left.target) || left.label.localeCompare(right.label));
    const x = 54 + (width - 108) * (depth / maximumDepth);
    column.forEach((node, index) => {
      node.x = Math.round(x);
      node.y = Math.round(48 + (height - 96) * ((index + 1) / (column.length + 1)));
    });
  }
}

/**
 * Builds a deterministic, non-spoiling graph from recipes the player already
 * performed. The named target is only a destination beacon; no hidden edge or
 * missing ingredient is inferred or exposed.
 */
export function buildLivingAtlas({ history: rawHistory = [], target = "", lockedCount = 0, width = 760, height = 420 } = {}) {
  const history = sanitizeAtlasHistory(rawHistory);
  const safeWidth = clampInteger(width, 480, 1_200, 760);
  const safeHeight = clampInteger(height, 300, 720, 420);
  const nodes = new Map();
  const edges = [];
  const produced = new Set(history.map((step) => keyFor(step.word)));

  history.forEach((step, index) => {
    const aDepth = nodes.get(keyFor(step.a))?.depth || 0;
    const bDepth = nodes.get(keyFor(step.b))?.depth || 0;
    const resultDepth = Math.min(24, Math.max(aDepth, bDepth) + 1);
    const aNode = addNode(nodes, step.a, { starter: !produced.has(keyFor(step.a)), depth: aDepth });
    const bNode = addNode(nodes, step.b, { starter: !produced.has(keyFor(step.b)), depth: bDepth });
    const resultNode = addNode(nodes, step.word, { emoji: step.emoji, category: step.category, depth: resultDepth });
    updateNode(resultNode, { emoji: step.emoji, category: step.category, depth: resultDepth });
    if (!aNode || !bNode || !resultNode) return;
    for (const ingredient of [aNode, bNode]) {
      if (edges.length >= MAX_HISTORY * 2) break;
      edges.push({
        id: `edge-${edges.length + 1}`,
        from: ingredient.id,
        to: resultNode.id,
        step: index + 1,
        twisted: step.twisted,
        revealed: step.revealed
      });
    }
  });

  const safeTarget = safeText(target, 48);
  if (safeTarget) {
    const targetNode = nodes.get(keyFor(safeTarget)) || addNode(nodes, safeTarget, { target: true, depth: Math.max(1, ...nodes.values().map((node) => node.depth)) + 1 });
    updateNode(targetNode, { target: true });
  }

  layoutColumns(nodes, safeWidth, safeHeight);
  const silhouettes = clampInteger(lockedCount, 0, 8, 0);
  const lockedNodes = Array.from({ length: silhouettes }, (_, index) => ({
    id: `locked-${index + 1}`,
    key: `locked-${index + 1}`,
    label: "Undiscovered star",
    emoji: "",
    category: "unknown",
    depth: 0,
    target: false,
    starter: false,
    locked: true,
    x: Math.round(70 + (safeWidth - 140) * ((index + 1) / (silhouettes + 1))),
    y: index % 2 ? safeHeight - 24 : 24
  }));

  const list = [...nodes.values(), ...lockedNodes];
  return {
    version: 1,
    width: safeWidth,
    height: safeHeight,
    nodes: list,
    edges: edges.filter((edge) => list.some((node) => node.id === edge.from) && list.some((node) => node.id === edge.to)),
    summary: {
      combinations: history.length,
      words: nodes.size,
      newDiscoveries: history.filter((step) => step.newDiscovery).length,
      targetReached: Boolean(safeTarget && nodes.get(keyFor(safeTarget)) && history.some((step) => keyFor(step.word) === keyFor(safeTarget))),
      lockedStars: silhouettes
    }
  };
}
