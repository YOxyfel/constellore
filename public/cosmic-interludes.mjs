export const COSMIC_INTERLUDES_VERSION = 2;
export const COSMIC_INTERLUDE_TYPES = Object.freeze([
  "constellation-links",
  "star-trail"
]);
export const COSMIC_INTERLUDE_FIRST_OFFER = 3;
export const COSMIC_INTERLUDE_MIN_GAP = 4;
export const COSMIC_INTERLUDE_MAX_GAP = 6;
export const COSMIC_INTERLUDE_MEMORY_PREVIEW_MS = 5_000;
export const COSMIC_INTERLUDE_TRAIL_MIN_STARS = 3;
export const COSMIC_INTERLUDE_TRAIL_MAX_STARS = 5;

export const COSMIC_INTERLUDE_POLICY = Object.freeze({
  ranked: false,
  scoreEligible: false,
  leaderboardEligible: false,
  rewardEligible: false,
  affectsRank: false,
  affectsDifficulty: false,
  canSkip: true
});

const MAX_SEED_LENGTH = 96;
const MAX_ID_LENGTH = 64;
const MAX_PATH_POINTS = 96;
const MAX_CHALLENGE_COUNT = 10_000_000;
const POINTER_HIT_RADIUS = 0.1;
const NODE_CLEARANCE = 0.0375;
const POINT_SPACING = 0.006;
const EPSILON = 1e-9;
const FEEDBACK = new Set([
  "",
  "choose-a-star",
  "choose-its-twin",
  "connected",
  "wrong-pair",
  "crossed-path",
  "path-blocked",
  "try-again",
  "not-yet",
  "star-found",
  "memory-ready",
  "complete",
  "skipped",
  "cancelled",
  "undone"
]);

const PAIR_STYLES = Object.freeze([
  Object.freeze({ color: "#67e8f9", symbol: "diamond", label: "Cyan diamond stars" }),
  Object.freeze({ color: "#fbbf24", symbol: "circle", label: "Golden circle stars" }),
  Object.freeze({ color: "#c4b5fd", symbol: "triangle", label: "Violet triangle stars" }),
  Object.freeze({ color: "#fb7185", symbol: "square", label: "Rose square stars" })
]);

const TRAIL_STYLES = Object.freeze([
  Object.freeze({ color: "#67e8f9", symbol: "diamond", label: "Cyan star" }),
  Object.freeze({ color: "#fbbf24", symbol: "circle", label: "Golden star" }),
  Object.freeze({ color: "#c4b5fd", symbol: "triangle", label: "Violet star" }),
  Object.freeze({ color: "#fb7185", symbol: "square", label: "Rose star" }),
  Object.freeze({ color: "#86efac", symbol: "hexagon", label: "Green star" })
]);

const TRAIL_TEMPLATES = Object.freeze([
  Object.freeze([
    Object.freeze({ x: 0.19, y: 0.31 }),
    Object.freeze({ x: 0.43, y: 0.16 }),
    Object.freeze({ x: 0.78, y: 0.28 }),
    Object.freeze({ x: 0.67, y: 0.66 }),
    Object.freeze({ x: 0.34, y: 0.81 })
  ]),
  Object.freeze([
    Object.freeze({ x: 0.18, y: 0.69 }),
    Object.freeze({ x: 0.31, y: 0.25 }),
    Object.freeze({ x: 0.57, y: 0.42 }),
    Object.freeze({ x: 0.81, y: 0.2 }),
    Object.freeze({ x: 0.74, y: 0.76 })
  ]),
  Object.freeze([
    Object.freeze({ x: 0.2, y: 0.22 }),
    Object.freeze({ x: 0.49, y: 0.34 }),
    Object.freeze({ x: 0.79, y: 0.19 }),
    Object.freeze({ x: 0.69, y: 0.71 }),
    Object.freeze({ x: 0.3, y: 0.77 })
  ])
]);

function cleanText(value, maximum = MAX_ID_LENGTH) {
  try {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maximum);
  } catch {
    return "";
  }
}

function cleanSeed(value) {
  return cleanText(value, MAX_SEED_LENGTH) || "constellore";
}

function cleanId(value) {
  return cleanText(value, MAX_ID_LENGTH)
    .toLocaleLowerCase("en-US")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = stableHash(seed);
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 0x1_0000_0000;
  };
}

function shuffled(items, random) {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boundedInteger(value, minimum, maximum, fallback = minimum) {
  return Math.min(maximum, Math.max(minimum, Math.trunc(finiteNumber(value, fallback))));
}

function clampCoordinate(value) {
  return Math.min(1, Math.max(0, finiteNumber(value, 0)));
}

function point(value) {
  return {
    x: clampCoordinate(value?.x),
    y: clampCoordinate(value?.y)
  };
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function samePoint(a, b, tolerance = EPSILON) {
  return distanceSquared(a, b) <= tolerance * tolerance;
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function within(value, a, b) {
  return value >= Math.min(a, b) - EPSILON && value <= Math.max(a, b) + EPSILON;
}

function pointOnSegment(a, b, candidate) {
  return Math.abs(orientation(a, b, candidate)) <= EPSILON
    && within(candidate.x, a.x, b.x)
    && within(candidate.y, a.y, b.y);
}

/** Inclusive segment intersection, including endpoint and collinear contact. */
export function cosmicSegmentsIntersect(aValue, bValue, cValue, dValue) {
  const a = point(aValue);
  const b = point(bValue);
  const c = point(cValue);
  const d = point(dValue);
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (((abC > EPSILON && abD < -EPSILON) || (abC < -EPSILON && abD > EPSILON))
    && ((cdA > EPSILON && cdB < -EPSILON) || (cdA < -EPSILON && cdB > EPSILON))) return true;
  return pointOnSegment(a, b, c)
    || pointOnSegment(a, b, d)
    || pointOnSegment(c, d, a)
    || pointOnSegment(c, d, b);
}

function pointToSegmentDistanceSquared(candidate, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return distanceSquared(candidate, a);
  const amount = Math.min(1, Math.max(0, ((candidate.x - a.x) * dx + (candidate.y - a.y) * dy) / lengthSquared));
  return distanceSquared(candidate, {
    x: a.x + amount * dx,
    y: a.y + amount * dy
  });
}

function pathSegments(points) {
  const segments = [];
  for (let index = 1; index < points.length; index += 1) {
    if (!samePoint(points[index - 1], points[index])) {
      segments.push([points[index - 1], points[index]]);
    }
  }
  return segments;
}

function pathsIntersect(first, second) {
  for (const [a, b] of pathSegments(first)) {
    for (const [c, d] of pathSegments(second)) {
      if (cosmicSegmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

function pathCrossesItself(points) {
  const segments = pathSegments(points);
  for (let first = 0; first < segments.length; first += 1) {
    for (let second = first + 2; second < segments.length; second += 1) {
      if (second === first + 1) continue;
      if (cosmicSegmentsIntersect(...segments[first], ...segments[second])) return true;
    }
  }
  return false;
}

function sanitizePoints(values, maximum = MAX_PATH_POINTS) {
  const output = [];
  for (const value of (Array.isArray(values) ? values : []).slice(0, maximum)) {
    const candidate = point(value);
    if (!output.length || distanceSquared(output.at(-1), candidate) >= POINT_SPACING * POINT_SPACING) {
      output.push(candidate);
    }
  }
  return output;
}

function generatedId(seed, type, starCount = 0) {
  const variant = type === "star-trail" ? `|${starCount}` : "";
  return `interlude-${stableHash(`${type}|${seed}${variant}`).toString(16).padStart(8, "0")}`;
}

function linkPuzzle(seed) {
  const random = seededRandom(`links|${seed}`);
  const vertical = random() >= 0.5;
  const reverse = random() >= 0.5;
  const styles = shuffled(PAIR_STYLES, random);
  const lanes = [0.17, 0.39, 0.61, 0.83];
  const nodes = [];
  const pairs = [];

  for (let index = 0; index < lanes.length; index += 1) {
    const lane = lanes[index];
    const style = styles[index];
    const pairId = `pair-${index + 1}`;
    const firstAlong = 0.115 + (random() - 0.5) * 0.02;
    const secondAlong = 0.885 + (random() - 0.5) * 0.02;
    const firstLane = lane + (random() - 0.5) * 0.022;
    const secondLane = lane + (random() - 0.5) * 0.022;
    const a = vertical
      ? { x: firstLane, y: reverse ? secondAlong : firstAlong }
      : { x: reverse ? secondAlong : firstAlong, y: firstLane };
    const b = vertical
      ? { x: secondLane, y: reverse ? firstAlong : secondAlong }
      : { x: reverse ? firstAlong : secondAlong, y: secondLane };
    const nodeA = {
      id: `${pairId}-a`,
      pairId,
      ...point(a),
      ...style
    };
    const nodeB = {
      id: `${pairId}-b`,
      pairId,
      ...point(b),
      ...style
    };
    const bend = (random() - 0.5) * 0.025;
    const route = vertical
      ? [
          { x: a.x, y: a.y },
          { x: lane + bend, y: a.y * 0.67 + b.y * 0.33 },
          { x: lane - bend, y: a.y * 0.33 + b.y * 0.67 },
          { x: b.x, y: b.y }
        ]
      : [
          { x: a.x, y: a.y },
          { x: a.x * 0.67 + b.x * 0.33, y: lane + bend },
          { x: a.x * 0.33 + b.x * 0.67, y: lane - bend },
          { x: b.x, y: b.y }
        ];
    nodes.push(nodeA, nodeB);
    pairs.push({
      id: pairId,
      ...style,
      nodeIds: [nodeA.id, nodeB.id],
      route: route.map(point)
    });
  }

  return {
    bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    nodes: shuffled(nodes, random),
    pairs,
    sequence: []
  };
}

function trailPuzzle(seed, starCountValue) {
  const random = seededRandom(`trail|${seed}`);
  const template = TRAIL_TEMPLATES[Math.floor(random() * TRAIL_TEMPLATES.length)];
  const starCount = boundedInteger(
    starCountValue,
    COSMIC_INTERLUDE_TRAIL_MIN_STARS,
    COSMIC_INTERLUDE_TRAIL_MAX_STARS,
    COSMIC_INTERLUDE_TRAIL_MIN_STARS
  );
  const mirrorX = random() >= 0.5;
  const mirrorY = random() >= 0.5;
  const styles = shuffled(TRAIL_STYLES, random);
  const orderedNodes = template.slice(0, starCount).map((source, index) => {
    const jitterX = (random() - 0.5) * 0.025;
    const jitterY = (random() - 0.5) * 0.025;
    return {
      id: `star-${index + 1}`,
      x: clampCoordinate((mirrorX ? 1 - source.x : source.x) + jitterX),
      y: clampCoordinate((mirrorY ? 1 - source.y : source.y) + jitterY),
      ...styles[index]
    };
  });
  const sequence = orderedNodes.map((node) => node.id);
  return {
    bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    // Visual and keyboard traversal order must not reveal the answer order
    // once the numbered preview disappears.
    nodes: shuffled(orderedNodes, random),
    pairs: [],
    sequence
  };
}

export function cosmicInterludeTrailStarCount(roundValue = 1) {
  const round = boundedInteger(roundValue, 1, MAX_CHALLENGE_COUNT, 1);
  return Math.min(COSMIC_INTERLUDE_TRAIL_MAX_STARS, COSMIC_INTERLUDE_TRAIL_MIN_STARS + round - 1);
}

function normalizeType(value, seed) {
  const type = cleanText(value, 32).toLocaleLowerCase("en-US");
  if (COSMIC_INTERLUDE_TYPES.includes(type)) return type;
  return COSMIC_INTERLUDE_TYPES[stableHash(`type|${seed}`) % COSMIC_INTERLUDE_TYPES.length];
}

function baseState(seedValue, typeValue, starCountValue) {
  const seed = cleanSeed(seedValue);
  const type = normalizeType(typeValue, seed);
  const starCount = type === "star-trail"
    ? boundedInteger(
        starCountValue,
        COSMIC_INTERLUDE_TRAIL_MIN_STARS,
        COSMIC_INTERLUDE_TRAIL_MAX_STARS,
        COSMIC_INTERLUDE_TRAIL_MIN_STARS
      )
    : 0;
  const puzzle = type === "constellation-links" ? linkPuzzle(seed) : trailPuzzle(seed, starCount);
  const total = type === "constellation-links" ? puzzle.pairs.length : puzzle.sequence.length;
  return {
    version: COSMIC_INTERLUDES_VERSION,
    id: generatedId(seed, type, starCount),
    seed,
    type,
    starCount,
    title: type === "constellation-links" ? "Join the Constellations" : "Follow the Starlight",
    instruction: type === "constellation-links"
      ? "Connect the four matching stars. Do not cross the paths."
      : "Memorize the numbered stars, then repeat the order after the numbers disappear.",
    status: "playing",
    policy: { ...COSMIC_INTERLUDE_POLICY },
    progress: { completed: 0, total, percent: 0 },
    puzzle,
    connections: [],
    trail: [],
    memory: {
      phase: type === "star-trail" ? "preview" : "none"
    },
    input: {
      focusIndex: 0,
      selectedNodeId: null,
      activePath: null
    },
    feedback: ""
  };
}

function nodeById(state, value) {
  const id = cleanId(value);
  return state.puzzle.nodes.find((node) => node.id === id) || null;
}

function pairById(state, value) {
  const id = cleanId(value);
  return state.puzzle.pairs.find((pair) => pair.id === id) || null;
}

function pairRouteFrom(pair, fromNodeId) {
  if (!pair) return [];
  const route = pair.route.map(point);
  return fromNodeId === pair.nodeIds[1] ? route.reverse() : route;
}

function connectedPairIds(state) {
  return new Set(state.connections.map((connection) => connection.pairId));
}

function nearestNode(state, candidateValue, availableOnly = true) {
  const candidate = point(candidateValue);
  const connected = connectedPairIds(state);
  let closest = null;
  let closestDistance = POINTER_HIT_RADIUS * POINTER_HIT_RADIUS;
  for (const node of state.puzzle.nodes) {
    if (availableOnly && node.pairId && connected.has(node.pairId)) continue;
    const nodeDistance = distanceSquared(candidate, node);
    if (nodeDistance <= closestDistance) {
      closest = node;
      closestDistance = nodeDistance;
    }
  }
  return closest;
}

function targetNode(state, action, availableOnly = true) {
  const direct = nodeById(state, action?.nodeId);
  if (direct) {
    if (!availableOnly || !direct.pairId || !connectedPairIds(state).has(direct.pairId)) return direct;
    return null;
  }
  if (action && ("x" in action || "y" in action)) return nearestNode(state, action, availableOnly);
  return null;
}

function pathTouchesOtherNode(state, points, allowedNodeIds) {
  const allowed = new Set(allowedNodeIds);
  for (const node of state.puzzle.nodes) {
    if (allowed.has(node.id)) continue;
    for (const [a, b] of pathSegments(points)) {
      if (pointToSegmentDistanceSquared(node, a, b) < NODE_CLEARANCE * NODE_CLEARANCE) return true;
    }
  }
  return false;
}

function validConnectionPath(state, candidate, ignorePairId = "") {
  if (!candidate || candidate.points.length < 2 || pathCrossesItself(candidate.points)) return false;
  if (pathTouchesOtherNode(state, candidate.points, [candidate.fromNodeId, candidate.toNodeId])) return false;
  for (const connection of state.connections) {
    if (connection.pairId !== ignorePairId && pathsIntersect(candidate.points, connection.points)) return false;
  }
  return true;
}

function progressState(state) {
  const completed = state.type === "constellation-links" ? state.connections.length : state.trail.length;
  const total = state.type === "constellation-links" ? state.puzzle.pairs.length : state.puzzle.sequence.length;
  const complete = total > 0 && completed >= total;
  return {
    ...state,
    status: complete ? "complete" : state.status,
    progress: {
      completed,
      total,
      percent: total ? Math.round(completed / total * 100) : 0
    },
    feedback: complete ? "complete" : state.feedback
  };
}

function restoredConnections(base, rawConnections) {
  const state = { ...base, connections: [] };
  const used = new Set();
  for (const raw of (Array.isArray(rawConnections) ? rawConnections : []).slice(0, base.puzzle.pairs.length)) {
    const pair = pairById(base, raw?.pairId);
    if (!pair || used.has(pair.id)) continue;
    const first = nodeById(base, raw?.fromNodeId);
    const second = nodeById(base, raw?.toNodeId);
    const endpointsMatch = first
      && second
      && first.id !== second.id
      && first.pairId === pair.id
      && second.pairId === pair.id;
    const fromNode = endpointsMatch ? first : nodeById(base, pair.nodeIds[0]);
    const toNode = endpointsMatch ? second : nodeById(base, pair.nodeIds[1]);
    let points = sanitizePoints(raw?.points);
    if (points.length < 2) points = pairRouteFrom(pair, fromNode.id);
    points[0] = point(fromNode);
    points[points.length - 1] = point(toNode);
    const connection = {
      pairId: pair.id,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      points
    };
    if (!validConnectionPath(state, connection)) continue;
    state.connections.push(connection);
    used.add(pair.id);
  }
  return state.connections;
}

function restoredTrail(base, rawTrail) {
  const trail = [];
  const values = Array.isArray(rawTrail) ? rawTrail.slice(0, base.puzzle.sequence.length) : [];
  for (let index = 0; index < values.length; index += 1) {
    const id = cleanId(values[index]);
    if (id !== base.puzzle.sequence[index]) break;
    trail.push(id);
  }
  return trail;
}

/** Rebuilds canonical geometry and keeps only bounded, valid local progress. */
export function sanitizeCosmicInterludeState(value) {
  const restoredStarCount = value?.starCount ?? value?.puzzle?.sequence?.length;
  const base = baseState(value?.seed, value?.type, restoredStarCount);
  const restoredTrailValue = base.type === "star-trail" ? restoredTrail(base, value?.trail) : [];
  const memoryPhase = base.type !== "star-trail"
    ? "none"
    : restoredTrailValue.length > 0 || value?.memory?.phase === "recall"
      ? "recall"
      : "preview";
  const state = {
    ...base,
    connections: base.type === "constellation-links" ? restoredConnections(base, value?.connections) : [],
    trail: restoredTrailValue,
    memory: { phase: memoryPhase },
    input: {
      focusIndex: boundedInteger(value?.input?.focusIndex, 0, Math.max(0, base.puzzle.nodes.length - 1), 0),
      selectedNodeId: null,
      activePath: null
    },
    feedback: FEEDBACK.has(value?.feedback) ? value.feedback : ""
  };
  if (base.type === "constellation-links") {
    const selected = nodeById(state, value?.input?.selectedNodeId);
    if (selected && !connectedPairIds(state).has(selected.pairId)) state.input.selectedNodeId = selected.id;
    const activeFrom = nodeById(state, value?.input?.activePath?.fromNodeId);
    if (activeFrom && !connectedPairIds(state).has(activeFrom.pairId)) {
      const activePoints = sanitizePoints(value?.input?.activePath?.points);
      if (!activePoints.length) activePoints.push(point(activeFrom));
      activePoints[0] = point(activeFrom);
      state.input.selectedNodeId = null;
      state.input.activePath = {
        fromNodeId: activeFrom.id,
        points: activePoints
      };
    }
  }
  const progressed = progressState(state);
  if (value?.status === "skipped" && progressed.status !== "complete") {
    return {
      ...progressed,
      status: "skipped",
      feedback: "skipped",
      input: { ...progressed.input, selectedNodeId: null, activePath: null }
    };
  }
  return progressed;
}

export function createCosmicInterlude(options = {}) {
  return baseState(options?.seed, options?.type, options?.starCount);
}

function connectPair(state, first, second, pointsValue) {
  if (!first || !second || first.id === second.id || first.pairId !== second.pairId) {
    return {
      ...state,
      input: { ...state.input, selectedNodeId: second?.id || null, activePath: null },
      feedback: "wrong-pair"
    };
  }
  if (connectedPairIds(state).has(first.pairId)) return state;
  const pair = pairById(state, first.pairId);
  let points = sanitizePoints(pointsValue);
  if (points.length < 2) points = pairRouteFrom(pair, first.id);
  points[0] = point(first);
  points[points.length - 1] = point(second);
  const connection = {
    pairId: pair.id,
    fromNodeId: first.id,
    toNodeId: second.id,
    points
  };
  if (!validConnectionPath(state, connection)) {
    const crosses = state.connections.some((existing) => pathsIntersect(points, existing.points)) || pathCrossesItself(points);
    return {
      ...state,
      input: { ...state.input, selectedNodeId: null, activePath: null },
      feedback: crosses ? "crossed-path" : "path-blocked"
    };
  }
  return progressState({
    ...state,
    connections: [...state.connections, connection],
    input: { ...state.input, selectedNodeId: null, activePath: null },
    feedback: "connected"
  });
}

function activateLinkNode(state, node) {
  if (!node || connectedPairIds(state).has(node.pairId)) return { ...state, feedback: "choose-a-star" };
  const selected = nodeById(state, state.input.selectedNodeId);
  if (!selected) {
    return {
      ...state,
      input: { ...state.input, selectedNodeId: node.id, activePath: null },
      feedback: "choose-its-twin"
    };
  }
  if (selected.id === node.id) {
    return {
      ...state,
      input: { ...state.input, selectedNodeId: null, activePath: null },
      feedback: "cancelled"
    };
  }
  const pair = pairById(state, selected.pairId);
  return connectPair(state, selected, node, pairRouteFrom(pair, selected.id));
}

function activateTrailNode(state, node) {
  const currentId = state.puzzle.sequence[state.trail.length];
  if (!node || node.id !== currentId) return { ...state, feedback: "not-yet" };
  return progressState({
    ...state,
    trail: [...state.trail, node.id],
    feedback: "star-found"
  });
}

function interactiveNodeIds(state) {
  if (state.type === "star-trail") {
    if (state.memory?.phase !== "recall") return [];
    const completed = new Set(state.trail);
    return state.puzzle.nodes.filter((node) => !completed.has(node.id)).map((node) => node.id);
  }
  const connected = connectedPairIds(state);
  return state.puzzle.nodes.filter((node) => !connected.has(node.pairId)).map((node) => node.id);
}

function focusState(state, movement) {
  const ids = interactiveNodeIds(state);
  if (!ids.length) return state;
  const currentId = state.puzzle.nodes[state.input.focusIndex]?.id;
  const currentIndex = Math.max(0, ids.indexOf(currentId));
  const nextId = ids[(currentIndex + movement + ids.length) % ids.length];
  const focusIndex = state.puzzle.nodes.findIndex((node) => node.id === nextId);
  return { ...state, input: { ...state.input, focusIndex } };
}

function pointerStart(state, action) {
  if (state.type !== "constellation-links") {
    const node = targetNode(state, action, false);
    return activateTrailNode(state, node);
  }
  const node = targetNode(state, action);
  if (!node) return { ...state, feedback: "choose-a-star" };
  return {
    ...state,
    input: {
      ...state.input,
      selectedNodeId: null,
      activePath: { fromNodeId: node.id, points: [point(node)] }
    },
    feedback: "choose-its-twin"
  };
}

function pointerMove(state, action) {
  const active = state.input.activePath;
  if (state.type !== "constellation-links" || !active) return state;
  const candidate = point(action);
  const points = [...active.points];
  if (points.length < MAX_PATH_POINTS && distanceSquared(points.at(-1), candidate) >= POINT_SPACING * POINT_SPACING) {
    points.push(candidate);
  } else if (points.length >= MAX_PATH_POINTS) {
    points[points.length - 1] = candidate;
  }
  return {
    ...state,
    input: { ...state.input, activePath: { ...active, points } }
  };
}

function pointerEnd(state, action) {
  const active = state.input.activePath;
  if (state.type !== "constellation-links" || !active) return state;
  const first = nodeById(state, active.fromNodeId);
  const second = targetNode(state, action);
  if (!first || !second) {
    return {
      ...state,
      input: { ...state.input, activePath: null },
      feedback: "try-again"
    };
  }
  return connectPair(state, first, second, [...active.points, point(second)]);
}

/**
 * Pure pointer/touch/keyboard reducer. Invalid actions are harmless and every
 * transition re-sanitizes local state before applying input.
 */
export function cosmicInterludeAction(value, action = {}) {
  const state = sanitizeCosmicInterludeState(value);
  const actionType = cleanText(action?.type, 32).toLocaleLowerCase("en-US");
  if (actionType === "restart") {
    return createCosmicInterlude({ seed: state.seed, type: state.type, starCount: state.starCount });
  }
  if (actionType === "skip") {
    if (state.status === "complete") return state;
    return {
      ...state,
      status: "skipped",
      feedback: "skipped",
      input: { ...state.input, selectedNodeId: null, activePath: null }
    };
  }
  if (actionType === "begin-recall") {
    if (state.type !== "star-trail" || state.status !== "playing" || state.memory?.phase !== "preview") return state;
    return {
      ...state,
      memory: { phase: "recall" },
      feedback: "memory-ready"
    };
  }
  if (actionType === "undo") {
    const hasProgress = state.type === "constellation-links"
      ? state.connections.length > 0
      : state.trail.length > 0;
    if (!hasProgress) return state;
    return progressState({
      ...state,
      status: "playing",
      connections: state.type === "constellation-links" ? state.connections.slice(0, -1) : state.connections,
      trail: state.type === "star-trail" ? state.trail.slice(0, -1) : state.trail,
      input: { ...state.input, selectedNodeId: null, activePath: null },
      feedback: "undone"
    });
  }
  if (state.status !== "playing") return state;
  if (state.type === "star-trail" && state.memory?.phase !== "recall") return state;

  if (actionType === "focus-next") return focusState(state, 1);
  if (actionType === "focus-previous") return focusState(state, -1);
  if (actionType === "activate-focused") {
    const node = state.puzzle.nodes[state.input.focusIndex] || null;
    return state.type === "constellation-links" ? activateLinkNode(state, node) : activateTrailNode(state, node);
  }
  if (actionType === "activate-node") {
    const node = nodeById(state, action?.nodeId);
    return state.type === "constellation-links" ? activateLinkNode(state, node) : activateTrailNode(state, node);
  }
  if (actionType === "pointer-start") return pointerStart(state, action);
  if (actionType === "pointer-move") return pointerMove(state, action);
  if (actionType === "pointer-end") return pointerEnd(state, action);
  if (actionType === "cancel-path") {
    return {
      ...state,
      input: { ...state.input, selectedNodeId: null, activePath: null },
      feedback: "cancelled"
    };
  }
  return state;
}

/** Presentation-ready state with explicit current and keyboard-interactive IDs. */
export function cosmicInterludeView(value) {
  const state = sanitizeCosmicInterludeState(value);
  const interactive = state.status === "playing" ? interactiveNodeIds(state) : [];
  const focusedId = state.puzzle.nodes[state.input.focusIndex]?.id;
  return {
    ...state,
    currentNodeId: state.status !== "playing"
      ? null
      : interactive.includes(focusedId)
          ? focusedId
          : interactive[0] || null,
    interactiveNodeIds: interactive
  };
}

/**
 * First breather appears after three completed challenges. Once the caller
 * records a skipped or completed interlude as `lastSettledChallenge`, future
 * offers arrive after a deterministic four-to-six-win gap.
 */
export function cosmicInterludeOffer({
  seed: seedValue,
  completedChallenges: completedValue = 0,
  lastSettledChallenge: lastValue = 0,
  lastType: lastTypeValue = "",
  completedStarTrails: completedStarTrailsValue = 0
} = {}) {
  const seed = cleanSeed(seedValue);
  const completedChallenges = boundedInteger(completedValue, 0, MAX_CHALLENGE_COUNT, 0);
  const lastSettledChallenge = boundedInteger(lastValue, 0, completedChallenges, 0);
  const firstOffer = lastSettledChallenge === 0;
  const gap = firstOffer
    ? COSMIC_INTERLUDE_FIRST_OFFER
    : COSMIC_INTERLUDE_MIN_GAP
      + stableHash(`gap|${seed}|${lastSettledChallenge}`) % (COSMIC_INTERLUDE_MAX_GAP - COSMIC_INTERLUDE_MIN_GAP + 1);
  const dueChallenge = firstOffer ? COSMIC_INTERLUDE_FIRST_OFFER : lastSettledChallenge + gap;
  if (completedChallenges < dueChallenge) return null;
  const lastType = normalizeType(lastTypeValue, `${seed}|last`);
  const suppliedLastType = COSMIC_INTERLUDE_TYPES.includes(cleanText(lastTypeValue, 32).toLocaleLowerCase("en-US"));
  const selectedBySeed = COSMIC_INTERLUDE_TYPES[stableHash(`offer|${seed}|${dueChallenge}`) % COSMIC_INTERLUDE_TYPES.length];
  const type = suppliedLastType
    ? COSMIC_INTERLUDE_TYPES.find((candidate) => candidate !== lastType)
    : selectedBySeed;
  const completedStarTrails = boundedInteger(completedStarTrailsValue, 0, MAX_CHALLENGE_COUNT, 0);
  const starTrailRound = type === "star-trail" ? completedStarTrails + 1 : 0;
  const starCount = type === "star-trail" ? cosmicInterludeTrailStarCount(starTrailRound) : 0;
  const offerSeed = `${seed}:break:${dueChallenge}`.slice(0, MAX_SEED_LENGTH);
  return {
    id: generatedId(offerSeed, type, starCount),
    seed: offerSeed,
    type,
    starTrailRound,
    starCount,
    atChallenge: completedChallenges,
    dueChallenge,
    gap,
    policy: { ...COSMIC_INTERLUDE_POLICY }
  };
}
