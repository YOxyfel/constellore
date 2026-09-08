import {
  COSMIC_INTERLUDE_MEMORY_PREVIEW_MS,
  cosmicInterludeAction,
  cosmicInterludeOffer,
  cosmicInterludeView,
  createCosmicInterlude
} from "./cosmic-interludes.mjs?v=5.0.0-beta.4";
import { loadOptionalStylesheet } from "./secondary-surface-loader.mjs?v=5.0.0-beta.4";

export const COSMIC_INTERLUDE_STORAGE_KEY = "constellore-cosmic-interludes-v1";
export const COSMIC_INTERLUDE_ENTER_EVENT = "constellore:interlude-enter";

const COSMIC_INTERLUDE_STYLESHEET = "cosmic-interlude.css?v=5.0.0-beta.4";
const RUNTIME_MARK = Symbol.for("constellore.cosmic-interlude-runtime");
const MAX_SETTLED_CHALLENGE = 10_000_000;
const ENDPOINT_HIT_RADIUS = 42;
const FEEDBACK_TEXT = Object.freeze({
  ready: "Choose any star to begin.",
  selected: "Now choose its matching star.",
  "path-started": "Draw to the matching star.",
  "choose-a-star": "Choose any star to begin.",
  "choose-its-twin": "Now choose its matching star.",
  connected: "Pair connected!",
  "pair-connected": "Pair connected!",
  crossed: "Those paths cross. Try another route.",
  crossing: "Those paths cross. Try another route.",
  "path-crossed": "Those paths cross. Try another route.",
  "crossed-path": "Those paths cross. Try another route.",
  "path-blocked": "That path touches another star. Try a clearer route.",
  mismatch: "That is a different symbol. Try its match.",
  "wrong-pair": "That is a different symbol. Try its match.",
  "wrong-star": "Follow the glowing stars in order.",
  traced: "Star found!",
  "star-traced": "Star found!",
  "star-found": "Star found!",
  "memory-ready": "Numbers hidden. Repeat the order from memory.",
  "try-again": "Finish your line at a matching star.",
  "not-yet": "That star was out of order. Try again.",
  cancelled: "Choose another star when you are ready.",
  complete: "Constellation complete!",
  skipped: "Interlude skipped."
});

/**
 * Lets the shared level-entry transition claim a prepared activity without
 * coupling this optional runtime to the main game's gate implementation.
 * Unclaimed or undispatchable entries preserve the original immediate start.
 */
export function requestCosmicInterludeEntry({
  target = globalThis.document,
  EventConstructor = globalThis.CustomEvent,
  type = "",
  start
} = {}) {
  if (typeof start !== "function") return false;
  let started = false;
  const stableStart = () => {
    if (started) return false;
    started = true;
    start();
    return true;
  };

  let handled = false;
  try {
    if (typeof target?.dispatchEvent === "function" && typeof EventConstructor === "function") {
      const event = new EventConstructor(COSMIC_INTERLUDE_ENTER_EVENT, {
        cancelable: true,
        detail: Object.freeze({
          type: String(type || ""),
          start: stableStart
        })
      });
      const dispatched = target.dispatchEvent(event);
      handled = event.defaultPrevented === true || dispatched === false;
    }
  } catch {
    handled = false;
  }

  if (!handled) stableStart();
  return handled;
}

export function cosmicInterludeControlState({
  introPending = false,
  status = "playing",
  completed = 0,
  memoryPhase = "none"
} = {}) {
  const intro = introPending === true;
  const complete = status === "complete";
  const memoryLocked = !intro && status === "playing" && memoryPhase === "preview";
  const canUndo = !intro && !memoryLocked && status === "playing" && Number(completed) > 0;
  return {
    intro,
    complete,
    memoryLocked,
    stageHidden: intro,
    primaryHidden: !intro && !complete,
    primaryDisabled: !intro && !complete,
    primaryLabel: intro ? "Start" : "Continue",
    undoHidden: !canUndo,
    undoDisabled: !canUndo,
    skipHidden: intro || complete,
    skipDisabled: intro
  };
}

export function cosmicInterludeMemoryCountdown({
  startedAt = 0,
  now = startedAt
} = {}) {
  const start = Number(startedAt);
  const current = Number(now);
  const elapsed = Number.isFinite(start) && Number.isFinite(current)
    ? Math.max(0, current - start)
    : 0;
  const remainingMs = Math.max(0, COSMIC_INTERLUDE_MEMORY_PREVIEW_MS - elapsed);
  return Object.freeze({
    locked: remainingMs > 0,
    remainingMs,
    seconds: remainingMs > 0 ? Math.ceil(remainingMs / 1_000) : 0
  });
}

function integer(value, fallback = 0, maximum = MAX_SETTLED_CHALLENGE) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(maximum, Math.floor(parsed)));
}

function hashText(value) {
  let hash = 2_166_136_261;
  const text = String(value || "constellore");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function freshSeed(cryptoObject, view) {
  try {
    if (typeof cryptoObject?.getRandomValues === "function") {
      const values = new Uint32Array(1);
      cryptoObject.getRandomValues(values);
      if (values[0]) return values[0];
    }
  } catch {
    // A stable fallback is enough for a local, non-competitive interlude.
  }
  return hashText(`${Date.now()}|${view?.navigator?.userAgent || ""}|${view?.location?.pathname || ""}`);
}

export function sanitizeCosmicInterludeRuntimeRecord(value, { seed = 1 } = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    version: 2,
    seed: integer(source.seed, integer(seed, 1, 0xffff_ffff), 0xffff_ffff) || 1,
    lastSettledChallenge: integer(source.lastSettledChallenge),
    lastType: ["constellation-links", "star-trail"].includes(source.lastType)
      ? source.lastType
      : "",
    starTrailRounds: integer(source.starTrailRounds)
  };
}

function readRecord(storage, seed) {
  try {
    return sanitizeCosmicInterludeRuntimeRecord(
      JSON.parse(storage?.getItem?.(COSMIC_INTERLUDE_STORAGE_KEY) || "null"),
      { seed }
    );
  } catch {
    return sanitizeCosmicInterludeRuntimeRecord(null, { seed });
  }
}

function writeRecord(storage, record) {
  try {
    storage?.setItem?.(COSMIC_INTERLUDE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage is optional. A blocked/private browser should still keep playing.
  }
}

function clampedPoint(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function pointFromEvent(event, stage) {
  const bounds = stage.getBoundingClientRect();
  return {
    x: clampedPoint((event.clientX - bounds.left) / Math.max(1, bounds.width)),
    y: clampedPoint((event.clientY - bounds.top) / Math.max(1, bounds.height))
  };
}

function normalizePoints(points) {
  if (!Array.isArray(points)) return [];
  return points
    .filter((point) => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
    .map((point) => ({ x: clampedPoint(point.x), y: clampedPoint(point.y) }));
}

function feedbackText(feedback, type, progress) {
  if (FEEDBACK_TEXT[feedback]) return FEEDBACK_TEXT[feedback];
  if (feedback === "undone") return type === "star-trail"
    ? "Last star removed."
    : "Last line removed.";
  if (progress?.completed >= progress?.total && progress?.total > 0) return "Constellation complete!";
  if (type === "star-trail") return "Choose the stars in the order you memorized.";
  if (feedback) {
    return String(feedback)
      .replaceAll("-", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return "Choose a star, then choose its match.";
}

function progressText(state) {
  const completed = integer(state?.progress?.completed);
  const total = Math.max(1, integer(state?.progress?.total, 1));
  if (state?.status === "complete") return "Complete";
  return state?.type === "star-trail"
    ? `${completed} of ${total} stars`
    : `${completed} of ${total} pairs`;
}

function nodeMap(state) {
  return new Map((state?.puzzle?.nodes || []).map((node) => [node.id, node]));
}

function pairMap(state) {
  return new Map((state?.puzzle?.pairs || []).map((pair) => [pair.id, pair]));
}

function nodeColor(node, pairs) {
  return node?.color || pairs.get(node?.pairId)?.color || "#81e9f4";
}

function drawSmoothPath(context, points) {
  if (!points.length) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  if (points.length === 2) {
    context.lineTo(points[1].x, points[1].y);
    return;
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
  }
  const last = points.at(-1);
  context.lineTo(last.x, last.y);
}

function canvasPath(points, width, height) {
  return normalizePoints(points).map((point) => ({
    x: point.x * width,
    y: point.y * height
  }));
}

function drawLine(context, points, color, width, height, {
  alpha = 1,
  dashed = false,
  pulse = 0
} = {}) {
  const path = canvasPath(points, width, height);
  if (path.length < 2) return;
  context.save();
  context.globalAlpha = alpha;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.setLineDash(dashed ? [8, 9] : []);

  context.strokeStyle = color;
  context.lineWidth = 8 + pulse * 2;
  context.shadowColor = color;
  context.shadowBlur = 22 + pulse * 9;
  drawSmoothPath(context, path);
  context.stroke();

  context.shadowBlur = 0;
  context.globalAlpha = Math.min(1, alpha + 0.18);
  context.strokeStyle = "#f3feff";
  context.lineWidth = 1.5 + pulse * 0.5;
  drawSmoothPath(context, path);
  context.stroke();
  context.restore();
}

function drawPathSparks(context, points, color, width, height, time, reducedMotion) {
  const path = canvasPath(points, width, height);
  if (path.length < 2) return;
  const sparks = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const count = Math.max(1, Math.floor(distance / 58));
    for (let step = 1; step <= count; step += 1) {
      const ratio = step / (count + 1);
      sparks.push({
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio
      });
    }
  }
  context.save();
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 11;
  for (let index = 0; index < sparks.length; index += 1) {
    const spark = sparks[index];
    const pulse = reducedMotion
      ? 1
      : 0.78 + Math.sin(Number(time || 0) / 420 + index * 1.7) * 0.22;
    const radius = 1.7 + pulse * 0.9;
    context.beginPath();
    context.moveTo(spark.x, spark.y - radius * 1.8);
    context.lineTo(spark.x + radius * 0.52, spark.y - radius * 0.52);
    context.lineTo(spark.x + radius * 1.8, spark.y);
    context.lineTo(spark.x + radius * 0.52, spark.y + radius * 0.52);
    context.lineTo(spark.x, spark.y + radius * 1.8);
    context.lineTo(spark.x - radius * 0.52, spark.y + radius * 0.52);
    context.lineTo(spark.x - radius * 1.8, spark.y);
    context.lineTo(spark.x - radius * 0.52, spark.y - radius * 0.52);
    context.closePath();
    context.fill();
  }
  context.restore();
}

function symbolGlyph(symbol) {
  return {
    diamond: "◆",
    circle: "●",
    triangle: "▲",
    square: "■",
    hexagon: "⬢"
  }[symbol] || "✦";
}

function seededStars(seed, count = 52) {
  let current = (Number(seed) >>> 0) || 1;
  const random = () => {
    current ^= current << 13;
    current ^= current >>> 17;
    current ^= current << 5;
    return (current >>> 0) / 0xffff_ffff;
  };
  return Array.from({ length: count }, (_, index) => ({
    x: random(),
    y: random(),
    radius: 0.45 + random() * 1.35,
    phase: random() * Math.PI * 2,
    warm: index % 7 === 0
  }));
}

function endpointSet(state) {
  const connected = new Set();
  for (const connection of state?.connections || []) {
    connected.add(connection.fromNodeId);
    connected.add(connection.toNodeId);
  }
  for (const nodeId of state?.trail || []) connected.add(nodeId);
  return connected;
}

function nearestNodeId(state, point, stage) {
  const bounds = stage.getBoundingClientRect();
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const node of state?.puzzle?.nodes || []) {
    const dx = (node.x - point.x) * bounds.width;
    const dy = (node.y - point.y) * bounds.height;
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearest = node.id;
      nearestDistance = distance;
    }
  }
  return nearestDistance <= ENDPOINT_HIT_RADIUS ? nearest : null;
}

function elementById(document, id) {
  return document?.getElementById?.(id) || null;
}

function resolveElements(document) {
  const elements = {
    retry: elementById(document, "resultRetry"),
    dialog: elementById(document, "cosmicInterludeDialog"),
    title: elementById(document, "cosmicInterludeTitle"),
    description: elementById(document, "cosmicInterludeDescription"),
    status: elementById(document, "cosmicInterludeStatus"),
    stage: elementById(document, "cosmicInterludeStage"),
    canvas: elementById(document, "cosmicInterludeCanvas"),
    endpoints: elementById(document, "cosmicInterludeEndpoints"),
    help: elementById(document, "cosmicInterludeStageHelp"),
    memory: elementById(document, "cosmicInterludeMemory"),
    primary: elementById(document, "cosmicInterludePrimary"),
    undo: elementById(document, "cosmicInterludeUndo"),
    skip: elementById(document, "cosmicInterludeSkip"),
    announcement: elementById(document, "cosmicInterludeAnnouncement")
  };
  const required = [
    "retry",
    "dialog",
    "title",
    "description",
    "status",
    "stage",
    "canvas",
    "endpoints",
    "help",
    "memory",
    "primary",
    "skip",
    "announcement"
  ];
  return required.every((key) => Boolean(elements[key])) ? elements : null;
}

function storageFor(view, suppliedStorage) {
  if (suppliedStorage) return suppliedStorage;
  try {
    return view?.localStorage || null;
  } catch {
    return null;
  }
}

/**
 * Mounts the optional between-challenge activity. It never mutates score,
 * rank, rewards, profile, or difficulty; its only persistent state is the
 * device-local challenge number at which the last offer was settled.
 */
export function installCosmicInterludeRuntime({
  document = globalThis.document,
  view = document?.defaultView || globalThis.window,
  storage: suppliedStorage,
  crypto: suppliedCrypto = globalThis.crypto
} = {}) {
  const elements = resolveElements(document);
  if (!elements) return null;
  if (elements.retry[RUNTIME_MARK]) return elements.retry[RUNTIME_MARK];

  const storage = storageFor(view, suppliedStorage);
  const reducedMotion = (() => {
    try {
      return view?.matchMedia?.("(prefers-reduced-motion: reduce)") || { matches: false };
    } catch {
      return { matches: false };
    }
  })();
  const disposers = [];
  let record = readRecord(storage, freshSeed(suppliedCrypto, view));
  let session = null;
  let bypassClick = false;
  let animationFrame = 0;
  let resizeObserver = null;
  let canvasSize = { width: 1, height: 1, dpr: 1 };
  let backgroundStars = [];
  let activePointer = null;
  let suppressClick = null;
  let lastFeedback = "";
  let settling = false;
  let entryPending = false;
  let completionFocusTimer = 0;
  let memoryCountdownTimer = 0;

  const listen = (target, eventName, listener, options) => {
    target?.addEventListener?.(eventName, listener, options);
    disposers.push(() => target?.removeEventListener?.(eventName, listener, options));
  };

  const requestFrame = (callback) => {
    if (typeof view?.requestAnimationFrame === "function") return view.requestAnimationFrame(callback);
    return view?.setTimeout?.(() => callback(Date.now()), 16) || 0;
  };

  const cancelFrame = () => {
    if (!animationFrame) return;
    if (typeof view?.cancelAnimationFrame === "function") view.cancelAnimationFrame(animationFrame);
    else view?.clearTimeout?.(animationFrame);
    animationFrame = 0;
  };

  const now = () => {
    const value = Number(view?.performance?.now?.());
    return Number.isFinite(value) ? value : Date.now();
  };

  const clearMemoryCountdown = () => {
    if (!memoryCountdownTimer) return;
    view?.clearTimeout?.(memoryCountdownTimer);
    memoryCountdownTimer = 0;
  };

  const resizeCanvas = () => {
    const bounds = elements.stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const dpr = Math.max(1, Math.min(2, Number(view?.devicePixelRatio) || 1));
    if (canvasSize.width === width && canvasSize.height === height && canvasSize.dpr === dpr) return;
    canvasSize = { width, height, dpr };
    elements.canvas.width = Math.max(1, Math.round(width * dpr));
    elements.canvas.height = Math.max(1, Math.round(height * dpr));
  };

  const draw = (time = 0) => {
    if (!session || !elements.dialog.open) return;
    resizeCanvas();
    const context = elements.canvas.getContext?.("2d");
    if (!context) return;
    const { width, height, dpr } = canvasSize;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const phase = Number(time || 0) / 1_000;
    for (const star of backgroundStars) {
      const shimmer = reducedMotion.matches ? 0.72 : 0.56 + Math.sin(phase * 0.9 + star.phase) * 0.18;
      context.beginPath();
      context.fillStyle = star.warm
        ? `rgba(246, 206, 121, ${Math.max(0.16, shimmer)})`
        : `rgba(197, 241, 248, ${Math.max(0.12, shimmer)})`;
      context.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
      context.fill();
    }

    const state = session.state;
    const nodes = nodeMap(state);
    const pairs = pairMap(state);
    const pulse = state.status === "complete" && !reducedMotion.matches
      ? (Math.sin(phase * 5) + 1) * 0.5
      : 0;

    for (const connection of state.connections || []) {
      const from = nodes.get(connection.fromNodeId);
      const pair = pairs.get(connection.pairId);
      const points = connection.points?.length
        ? connection.points
        : [from, nodes.get(connection.toNodeId)].filter(Boolean);
      drawLine(context, points, pair?.color || nodeColor(from, pairs), width, height, {
        alpha: 0.92,
        pulse
      });
      drawPathSparks(
        context,
        points,
        pair?.color || nodeColor(from, pairs),
        width,
        height,
        time,
        reducedMotion.matches
      );
    }

    if (state.type === "star-trail" && state.trail?.length > 1) {
      const points = state.trail.map((nodeId) => nodes.get(nodeId)).filter(Boolean);
      drawLine(context, points, "#81e9f4", width, height, { alpha: 0.96, pulse });
      drawPathSparks(context, points, "#81e9f4", width, height, time, reducedMotion.matches);
    }

    if (state.input?.activePath?.points?.length) {
      const from = nodes.get(state.input.activePath.fromNodeId);
      drawLine(
        context,
        state.input.activePath.points,
        nodeColor(from, pairs),
        width,
        height,
        { alpha: 0.78, dashed: true }
      );
    }

    for (const node of state.puzzle?.nodes || []) {
      const x = node.x * width;
      const y = node.y * height;
      const glow = state.status === "complete" ? 8 + pulse * 9 : 6;
      context.beginPath();
      context.strokeStyle = nodeColor(node, pairs);
      context.globalAlpha = 0.38;
      context.lineWidth = 1;
      context.arc(x, y, 18 + glow, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }

    if (!reducedMotion.matches && elements.dialog.open) {
      animationFrame = requestFrame(draw);
    }
  };

  const scheduleDraw = () => {
    if (animationFrame) return;
    animationFrame = requestFrame((time) => {
      animationFrame = 0;
      draw(time);
    });
  };

  const focusCurrentNode = () => {
    const currentId = cosmicInterludeView(session?.state)?.currentNodeId;
    if (!currentId) return;
    elements.endpoints.querySelector?.(`[data-node-id="${globalThis.CSS?.escape?.(currentId) || currentId}"]`)?.focus?.();
  };

  const applyAction = (action, { focusNode = false } = {}) => {
    if (!session) return null;
    session.state = cosmicInterludeAction(session.state, action);
    render();
    if (focusNode) focusCurrentNode();
    return session.state;
  };

  const syncEndpoints = (state) => {
    const nodes = state.puzzle?.nodes || [];
    const viewState = cosmicInterludeView(state);
    const interactive = new Set(viewState.interactiveNodeIds || nodes.map((node) => node.id));
    const connected = endpointSet(state);
    const existing = new Map(
      [...(elements.endpoints.querySelectorAll?.("[data-node-id]") || [])]
        .map((button) => [button.dataset.nodeId, button])
    );
    const currentId = viewState.currentNodeId;
    const memoryPreview = state.type === "star-trail" && state.memory?.phase === "preview";

    for (const node of nodes) {
      let button = existing.get(node.id);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "cosmic-interlude-endpoint";
        button.dataset.nodeId = node.id;
        elements.endpoints.append(button);
      }
      existing.delete(node.id);
      button.style.left = `${clampedPoint(node.x) * 100}%`;
      button.style.top = `${clampedPoint(node.y) * 100}%`;
      button.style.borderColor = node.color || "";
      const trailNumber = state.type === "star-trail"
        ? state.puzzle.sequence.indexOf(node.id) + 1
        : 0;
      button.textContent = memoryPreview && trailNumber > 0
        ? String(trailNumber)
        : symbolGlyph(node.symbol);
      const trailLabel = trailNumber > 0
        ? memoryPreview
          ? `Star ${trailNumber} of ${state.puzzle.sequence.length}: ${node.label || "star"}`
          : `${node.label || "Star"}. Choose this star from memory.`
        : "";
      button.setAttribute("aria-label", trailLabel || node.label || `${node.symbol || "Star"} endpoint`);
      button.setAttribute("aria-pressed", String(state.input?.selectedNodeId === node.id));
      button.classList.remove("is-current");
      button.removeAttribute("aria-current");
      button.classList.toggle("is-connected", connected.has(node.id));
      button.disabled = state.type === "star-trail"
        ? !memoryPreview && (connected.has(node.id) || !interactive.has(node.id))
        : !interactive.has(node.id) || connected.has(node.id);
      button.setAttribute("aria-disabled", String(memoryPreview || button.disabled));
      button.tabIndex = memoryPreview ? 0 : node.id === currentId && !button.disabled ? 0 : -1;
    }
    for (const button of existing.values()) button.remove();
  };

  const render = () => {
    if (!session) return;
    const state = session.state;
    const memoryPreview = state.type === "star-trail"
      && state.memory?.phase === "preview"
      && !session.introPending
      && state.status === "playing";
    const memoryCountdown = memoryPreview && session.memoryStartedAt != null
      ? cosmicInterludeMemoryCountdown({ startedAt: session.memoryStartedAt, now: now() })
      : null;
    elements.title.textContent = state.type === "star-trail"
      ? "Remember the star order"
      : "Connect the matching stars";
    elements.description.textContent = state.type === "star-trail"
      ? "You have five seconds to memorize the numbers. Then repeat the order after they disappear."
      : "Join matching shapes. Do not cross another line.";
    elements.status.textContent = memoryCountdown?.locked
      ? `Memorize · ${memoryCountdown.seconds} second${memoryCountdown.seconds === 1 ? "" : "s"}`
      : progressText(state);
    const help = memoryCountdown?.locked
      ? "Memorize the numbered stars. Input unlocks when the countdown ends."
      : feedbackText(state.feedback, state.type, state.progress);
    elements.help.textContent = help;
    const showMemoryMessage = state.type === "star-trail"
      && !session.introPending
      && state.status === "playing";
    elements.memory.hidden = !showMemoryMessage;
    elements.memory.classList.toggle("is-preview", Boolean(memoryCountdown?.locked));
    elements.memory.classList.toggle("is-recall", showMemoryMessage && !memoryCountdown?.locked);
    elements.memory.textContent = memoryCountdown?.locked
      ? `Memorize the order · ${memoryCountdown.seconds}`
      : "Numbers hidden · repeat the order";
    elements.stage.classList.toggle("memory-preview", Boolean(memoryCountdown?.locked));
    elements.stage.dataset.memoryPhase = memoryCountdown?.locked
      ? "preview"
      : state.type === "star-trail" && state.memory?.phase === "recall"
        ? "recall"
        : "none";
    if (state.feedback && state.feedback !== lastFeedback) {
      elements.announcement.textContent = help;
      lastFeedback = state.feedback;
    }
    const controls = cosmicInterludeControlState({
      introPending: session.introPending,
      status: state.status,
      completed: state.progress?.completed,
      memoryPhase: state.memory?.phase
    });
    elements.dialog.classList.toggle("is-complete", controls.complete);
    elements.stage.hidden = controls.stageHidden;
    if ("inert" in elements.stage) elements.stage.inert = controls.stageHidden;
    elements.stage.toggleAttribute?.("inert", controls.stageHidden);
    const primaryLabel = elements.primary.querySelector?.("span") || elements.primary;
    primaryLabel.textContent = controls.primaryLabel;
    elements.primary.hidden = controls.primaryHidden;
    elements.primary.disabled = controls.primaryDisabled;
    if (elements.undo) {
      elements.undo.hidden = controls.undoHidden;
      elements.undo.disabled = controls.undoDisabled;
      elements.undo.textContent = state.type === "star-trail" ? "Undo star" : "Undo line";
    }
    elements.skip.hidden = controls.skipHidden;
    elements.skip.disabled = controls.skipDisabled;
    syncEndpoints(state);
    if (controls.intro) cancelFrame();
    else scheduleDraw();
    if (controls.complete && !session.completionFocused) {
      session.completionFocused = true;
      completionFocusTimer = view?.setTimeout?.(() => {
        completionFocusTimer = 0;
        if (session?.state?.status === "complete" && elements.dialog.open) elements.primary.focus?.();
      }, reducedMotion.matches ? 0 : 280) || 0;
    }
  };

  const finishMemoryPreview = () => {
    clearMemoryCountdown();
    if (!session
      || session.introPending
      || session.state?.type !== "star-trail"
      || session.state?.memory?.phase !== "preview") return;
    session.memoryStartedAt = null;
    session.state = cosmicInterludeAction(session.state, { type: "begin-recall" });
    render();
    requestFrame(() => {
      if (session?.state?.memory?.phase === "recall" && elements.dialog.open) focusCurrentNode();
    });
  };

  const scheduleMemoryCountdown = () => {
    clearMemoryCountdown();
    if (!session || session.memoryStartedAt == null || session.state?.memory?.phase !== "preview") return;
    const countdown = cosmicInterludeMemoryCountdown({
      startedAt: session.memoryStartedAt,
      now: now()
    });
    if (!countdown.locked) {
      finishMemoryPreview();
      return;
    }
    render();
    const untilNextSecond = Math.max(1, countdown.remainingMs - (countdown.seconds - 1) * 1_000);
    memoryCountdownTimer = view?.setTimeout?.(scheduleMemoryCountdown, untilNextSecond) || 0;
  };

  const startMemoryPreview = () => {
    if (!session || session.state?.type !== "star-trail" || session.state?.memory?.phase !== "preview") return false;
    session.memoryStartedAt = now();
    scheduleMemoryCountdown();
    elements.stage.focus?.({ preventScroll: true });
    return true;
  };

  const continueNextChallenge = () => {
    bypassClick = true;
    try {
      elements.retry.click();
    } catch {
      bypassClick = false;
    }
    // HTMLElement.click() does not dispatch while disabled. Do not let a
    // failed hand-off make an unrelated later click bypass the interlude.
    if (bypassClick) bypassClick = false;
  };

  const settle = (outcome = "skipped") => {
    if (!session || settling) return;
    settling = true;
    const settledChallenge = integer(session.offer?.atChallenge, integer(session.completedChallenges));
    record = sanitizeCosmicInterludeRuntimeRecord({
      ...record,
      lastSettledChallenge: Math.max(record.lastSettledChallenge, settledChallenge),
      lastType: session.state?.type || record.lastType,
      starTrailRounds: record.starTrailRounds + (session.state?.type === "star-trail" ? 1 : 0)
    }, { seed: record.seed });
    writeRecord(storage, record);
    if (outcome !== "complete" && session.state?.status === "playing") {
      try {
        session.state = cosmicInterludeAction(session.state, { type: "skip" });
      } catch {
        // Settling is deliberately fail-open.
      }
    }
    cancelFrame();
    clearMemoryCountdown();
    if (completionFocusTimer) view?.clearTimeout?.(completionFocusTimer);
    completionFocusTimer = 0;
    activePointer = null;
    if (elements.dialog.open) elements.dialog.close();
    elements.endpoints.replaceChildren?.();
    session = null;
    settling = false;
    view?.setTimeout?.(continueNextChallenge, 0);
  };

  const begin = (offer, completedChallenges) => {
    session = {
      offer,
      completedChallenges,
      introPending: true,
      completionFocused: false,
      memoryStartedAt: null,
      state: createCosmicInterlude({
        seed: offer.seed,
        type: offer.type,
        starCount: offer.starCount
      })
    };
    backgroundStars = seededStars(offer.seed);
    lastFeedback = "";
    settling = false;
    render();
    try {
      elements.dialog.showModal();
    } catch {
      settle("error");
      return;
    }
    render();
    elements.primary.focus?.();
  };

  const failOpenOffer = (offer, completedChallenges) => {
    record = {
      ...record,
      lastSettledChallenge: Math.max(record.lastSettledChallenge, integer(offer.atChallenge, completedChallenges)),
      lastType: offer.type || record.lastType,
      starTrailRounds: record.starTrailRounds + (offer.type === "star-trail" ? 1 : 0)
    };
    writeRecord(storage, record);
    session = null;
    entryPending = false;
    view?.setTimeout?.(continueNextChallenge, 0);
  };

  const onRetryCapture = (event) => {
    if (bypassClick) {
      bypassClick = false;
      return;
    }
    if (session || entryPending) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const completedChallenges = integer(elements.retry.dataset.interludeWin);
    if (!completedChallenges) return;
    let offer = null;
    try {
      offer = cosmicInterludeOffer({
        seed: record.seed,
        completedChallenges,
        lastSettledChallenge: record.lastSettledChallenge,
        lastType: record.lastType,
        completedStarTrails: record.starTrailRounds
      });
    } catch {
      return;
    }
    if (!offer) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    entryPending = true;
    const stylesReady = loadOptionalStylesheet(COSMIC_INTERLUDE_STYLESHEET, document)
      .catch(() => null);
    const start = async () => {
      const stylesheet = await stylesReady;
      entryPending = false;
      if (!stylesheet) {
        failOpenOffer(offer, completedChallenges);
        return;
      }
      try {
        begin(offer, completedChallenges);
      } catch {
        // Never strand the player between levels if an optional activity fails.
        failOpenOffer(offer, completedChallenges);
      }
    };
    requestCosmicInterludeEntry({
      target: document,
      EventConstructor: view?.CustomEvent || globalThis.CustomEvent,
      type: offer.type,
      start
    });
  };

  const endpointIdFromEvent = (event) => event.target?.closest?.("[data-node-id]")?.dataset?.nodeId || null;

  const onStagePointerDown = (event) => {
    if (!session || session.state.type !== "constellation-links" || event.button > 0) return;
    const point = pointFromEvent(event, elements.stage);
    const nodeId = endpointIdFromEvent(event) || nearestNodeId(session.state, point, elements.stage);
    if (!nodeId) return;
    event.preventDefault();
    elements.stage.setPointerCapture?.(event.pointerId);
    activePointer = {
      id: event.pointerId,
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    applyAction({ type: "pointer-start", nodeId });
  };

  const onStagePointerMove = (event) => {
    if (!session || activePointer?.id !== event.pointerId) return;
    const point = pointFromEvent(event, elements.stage);
    if (Math.hypot(event.clientX - activePointer.startX, event.clientY - activePointer.startY) > 5) {
      activePointer.moved = true;
    }
    if (activePointer.moved) applyAction({ type: "pointer-move", x: point.x, y: point.y });
  };

  const onStagePointerEnd = (event) => {
    if (!session || activePointer?.id !== event.pointerId) return;
    event.preventDefault();
    const pointer = activePointer;
    activePointer = null;
    elements.stage.releasePointerCapture?.(event.pointerId);
    const point = pointFromEvent(event, elements.stage);
    const nodeId = endpointIdFromEvent(event) || nearestNodeId(session.state, point, elements.stage);
    suppressClick = { nodeId: pointer.nodeId, until: Date.now() + 650 };
    if (pointer.moved) {
      applyAction({ type: "pointer-end", nodeId, x: point.x, y: point.y });
    } else {
      applyAction({ type: "cancel-path" });
      applyAction({ type: "activate-node", nodeId: pointer.nodeId });
    }
  };

  const onStagePointerCancel = (event) => {
    if (!session || activePointer?.id !== event.pointerId) return;
    activePointer = null;
    elements.stage.releasePointerCapture?.(event.pointerId);
    applyAction({ type: "cancel-path" });
  };

  const onEndpointClick = (event) => {
    const nodeId = endpointIdFromEvent(event);
    if (!session || !nodeId) return;
    if (session.state.type === "star-trail" && session.state.memory?.phase !== "recall") {
      event.preventDefault();
      return;
    }
    if (suppressClick?.nodeId === nodeId && Date.now() <= suppressClick.until) {
      suppressClick = null;
      return;
    }
    suppressClick = null;
    applyAction(
      { type: "activate-node", nodeId },
      { focusNode: session.state.type === "star-trail" }
    );
  };

  const onStageKeyDown = (event) => {
    if (!session) return;
    if (session.state.type === "star-trail" && session.state.memory?.phase !== "recall") {
      if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
      }
      return;
    }
    if (["ArrowRight", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      applyAction({ type: "focus-next" }, { focusNode: true });
    } else if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      applyAction({ type: "focus-previous" }, { focusNode: true });
    } else if (event.target === elements.stage && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      applyAction({ type: "activate-focused" }, { focusNode: true });
    }
  };

  const onDialogCancel = (event) => {
    if (!session) return;
    event.preventDefault();
    settle("skipped");
  };

  const onPrimary = () => {
    if (!session) return;
    if (session.introPending) {
      session.introPending = false;
      if (startMemoryPreview()) return;
      render();
      requestFrame(() => {
        if (!session?.introPending && elements.dialog.open) focusCurrentNode();
      });
      return;
    }
    if (session.state?.status === "complete") settle("complete");
  };

  listen(elements.retry, "click", onRetryCapture, true);
  listen(elements.primary, "click", onPrimary);
  listen(elements.undo, "click", () => applyAction({ type: "undo" }, { focusNode: true }));
  listen(elements.skip, "click", () => settle("skipped"));
  listen(elements.dialog, "cancel", onDialogCancel);
  listen(elements.stage, "pointerdown", onStagePointerDown);
  listen(elements.stage, "pointermove", onStagePointerMove);
  listen(elements.stage, "pointerup", onStagePointerEnd);
  listen(elements.stage, "pointercancel", onStagePointerCancel);
  listen(elements.endpoints, "click", onEndpointClick);
  listen(elements.stage, "keydown", onStageKeyDown);
  listen(reducedMotion, "change", scheduleDraw);

  if (typeof view?.ResizeObserver === "function") {
    resizeObserver = new view.ResizeObserver(scheduleDraw);
    resizeObserver.observe(elements.stage);
  } else {
    listen(view, "resize", scheduleDraw);
  }

  const runtime = {
    get active() {
      return Boolean(session);
    },
    get record() {
      return { ...record };
    },
    destroy() {
      cancelFrame();
      clearMemoryCountdown();
      if (completionFocusTimer) view?.clearTimeout?.(completionFocusTimer);
      completionFocusTimer = 0;
      resizeObserver?.disconnect?.();
      resizeObserver = null;
      for (const dispose of disposers.splice(0)) dispose();
      if (session && elements.dialog.open) elements.dialog.close();
      session = null;
      entryPending = false;
      if (elements.retry[RUNTIME_MARK] === runtime) delete elements.retry[RUNTIME_MARK];
    }
  };
  elements.retry[RUNTIME_MARK] = runtime;
  return runtime;
}

function autoInstall() {
  try {
    installCosmicInterludeRuntime();
  } catch {
    // Importing this optional activity must never stop the main game.
  }
}

if (typeof globalThis.document !== "undefined") {
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", autoInstall, { once: true });
  } else {
    autoInstall();
  }
}
