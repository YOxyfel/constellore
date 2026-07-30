import { COMBINATION_STORY_MAX_CHAPTERS } from "./combination-story.mjs?v=5.0.0-beta.1";

/**
 * On-demand host contract (the controller owns and replaces its children):
 *
 *   <section id="combinationStory" data-combination-story></section>
 *
 * The controller creates every child with `createElement` and writes model
 * copy with `textContent`. Stable generated selectors are exported below.
 *
 * API:
 *   createCombinationStoryView({
 *     root,
 *     timers?: { setTimeout, clearTimeout },
 *     reducedMotion?: () => boolean,
 *     maxVisualLayers?: number,
 *     timings?: { crumbleMs, rebuildStepMs }
 *   }) -> { render(model), reset(), dispose() }
 */

export const COMBINATION_STORY_VIEW_MAX_LAYERS = 12;
export const COMBINATION_STORY_VIEW_SELECTORS = Object.freeze({
  root: "[data-combination-story]",
  summary: "[data-story-summary]",
  scene: "[data-story-scene]",
  layers: "[data-story-layers]",
  layer: "[data-story-layer]",
  layerEmoji: "[data-story-layer-emoji]",
  layerWord: "[data-story-layer-word]",
  empty: "[data-story-empty]",
  chapters: "[data-story-chapters]",
  chapter: "[data-story-chapter]",
  chapterTitle: "[data-story-chapter-title]",
  chapterNarration: "[data-story-chapter-narration]",
  narration: "[data-story-narration]"
});

const MAX_VISUAL_LAYERS = 24;
const DEFAULT_TIMINGS = Object.freeze({
  crumbleMs: 180,
  rebuildStepMs: 70
});
const VALID_STATUSES = new Set(["empty", "building", "finale"]);
const VALID_ROLES = new Set([
  "foundation",
  "finale",
  "energy",
  "landscape",
  "inhabitants",
  "architecture",
  "sky",
  "discovery"
]);
const VALID_CATEGORIES = new Set([
  "force",
  "nature",
  "life",
  "structure",
  "celestial",
  "unknown"
]);
const VALID_SCENE_VARIANTS = new Set([
  "orbital-garden",
  "living-forge",
  "storm-archive",
  "deep-cosmos"
]);
const VALID_SCENE_PALETTES = new Set(["aurora", "ember", "tidal", "violet", "verdant"]);
const VALID_MOTIFS = new Set(["current", "terrain", "pulse", "skyline", "constellation", "anomaly"]);
const STORY_SLOT_POSITIONS = Object.freeze([
  Object.freeze([50, 84]),
  Object.freeze([10, 70]),
  Object.freeze([30, 70]),
  Object.freeze([70, 70]),
  Object.freeze([90, 70]),
  Object.freeze([10, 42]),
  Object.freeze([37, 42]),
  Object.freeze([63, 42]),
  Object.freeze([90, 42]),
  Object.freeze([24, 15]),
  Object.freeze([50, 15]),
  Object.freeze([76, 15])
]);

function boundedText(value, maximum = 320) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maximum);
}

function boundedAttribute(value, fallback = "", maximum = 80) {
  const text = boundedText(value, maximum);
  return text || fallback;
}

function safeToken(value, allowed, fallback) {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
}

function assertRoot(root) {
  const documentRef = root?.ownerDocument;
  if (
    !root
    || typeof root.replaceChildren !== "function"
    || typeof root.setAttribute !== "function"
    || typeof documentRef?.createElement !== "function"
  ) {
    throw new TypeError("Combination story view requires a dedicated DOM Element root.");
  }
  return documentRef;
}

function resolveTimers(injected) {
  const source = injected || globalThis;
  if (typeof source?.setTimeout !== "function" || typeof source?.clearTimeout !== "function") {
    throw new TypeError("Combination story view requires setTimeout and clearTimeout.");
  }
  return {
    setTimeout: source.setTimeout.bind(source),
    clearTimeout: source.clearTimeout.bind(source)
  };
}

function createMarkedElement(documentRef, tag, marker) {
  const element = documentRef.createElement(tag);
  element.setAttribute(marker, "");
  return element;
}

function createShell(documentRef, root) {
  const summary = createMarkedElement(documentRef, "p", "data-story-summary");
  const scene = createMarkedElement(documentRef, "div", "data-story-scene");
  const layers = createMarkedElement(documentRef, "div", "data-story-layers");
  const empty = createMarkedElement(documentRef, "p", "data-story-empty");
  const chapters = createMarkedElement(documentRef, "ol", "data-story-chapters");
  const narration = createMarkedElement(documentRef, "p", "data-story-narration");

  scene.setAttribute("role", "img");
  layers.setAttribute("aria-hidden", "true");
  chapters.setAttribute("aria-label", "Combination story chapters");
  narration.setAttribute("role", "status");
  narration.setAttribute("aria-live", "polite");
  narration.setAttribute("aria-atomic", "true");
  scene.append(layers, empty);

  root.setAttribute("data-combination-story", "");
  root.setAttribute("role", "region");
  root.replaceChildren(summary, scene, chapters, narration);
  return { summary, scene, layers, empty, chapters, narration };
}

function createLayerNode(documentRef, layer, index) {
  const node = createMarkedElement(documentRef, "div", "data-story-layer");
  const emoji = createMarkedElement(documentRef, "span", "data-story-layer-emoji");
  const word = createMarkedElement(documentRef, "span", "data-story-layer-word");
  const id = boundedAttribute(layer?.id, `story-layer-visible-${index + 1}`);
  const role = safeToken(layer?.role, VALID_ROLES, "discovery");
  const category = safeToken(layer?.category, VALID_CATEGORIES, "unknown");
  const motif = safeToken(layer?.motif, VALID_MOTIFS, "anomaly");
  const slot = boundedInteger(layer?.slot, index % 12, 0, 11);
  const variation = boundedInteger(layer?.variation, 1, 1, 4);
  const depth = boundedInteger(layer?.depth, 1, 1, 3);

  node.setAttribute("data-layer-id", id);
  node.setAttribute("data-layer-order", String(boundedInteger(layer?.order, index + 1, 1, 999)));
  node.setAttribute("data-layer-role", role);
  node.setAttribute("data-layer-category", category);
  node.setAttribute("data-layer-motif", motif);
  node.setAttribute("data-layer-slot", String(slot));
  node.setAttribute("data-layer-variation", String(variation));
  node.setAttribute("data-layer-depth", String(depth));
  node.setAttribute("data-layer-state", "ready");
  if (node.style && typeof node.style.setProperty === "function") {
    const [left, top] = STORY_SLOT_POSITIONS[slot];
    const scale = role === "finale" ? 1.18 : role === "foundation" ? 1.1 : 0.92 + depth * 0.04;
    const rotation = role === "foundation" || role === "finale" ? 0 : (variation - 2.5) * 2;
    node.style.setProperty("position", "absolute");
    node.style.setProperty("left", `${left}%`);
    node.style.setProperty("top", `${top}%`);
    node.style.setProperty("z-index", String(role === "finale" ? 20 : role === "foundation" ? 10 : depth + 1));
    node.style.setProperty("transform", `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`);
  }
  emoji.setAttribute("aria-hidden", "true");
  emoji.textContent = boundedText(layer?.emoji, 16);
  word.textContent = boundedText(layer?.word, 80) || "Discovery";
  node.append(emoji, word);
  return { id, node };
}

function createChapterNode(documentRef, chapter, index) {
  const node = createMarkedElement(documentRef, "li", "data-story-chapter");
  const title = createMarkedElement(documentRef, "span", "data-story-chapter-title");
  const narration = createMarkedElement(documentRef, "span", "data-story-chapter-narration");
  const number = boundedInteger(chapter?.number, index + 1, 1, COMBINATION_STORY_MAX_CHAPTERS);
  const kind = safeToken(
    chapter?.kind,
    new Set(["foundation", "continuation", "parallel", "convergence", "finale"]),
    number === 1 ? "foundation" : "continuation"
  );

  node.setAttribute("data-chapter-number", String(number));
  node.setAttribute("data-chapter-kind", kind);
  title.textContent = boundedText(chapter?.title, 120) || `Chapter ${number}`;
  narration.textContent = boundedText(chapter?.narration);
  const label = boundedText(chapter?.accessibleLabel);
  if (label) node.setAttribute("aria-label", label);
  node.append(title, narration);
  return node;
}

function eventLayerOrder(event, action, fallbackIds, knownNodes) {
  const phase = Array.isArray(event?.phases)
    ? event.phases.find((candidate) => candidate?.action === action)
    : null;
  const requested = Array.isArray(phase?.layerIds) ? phase.layerIds : [];
  const ordered = [];
  const seen = new Set();
  for (const rawId of [...requested, ...fallbackIds]) {
    const id = boundedAttribute(rawId);
    if (!id || seen.has(id) || !knownNodes.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

/**
 * Creates one controller for one dedicated story root.
 *
 * `render` accepts the immutable model returned by `buildCombinationStory`.
 * Calling `render`, `reset`, or `dispose` cancels every pending phase timer.
 */
export function createCombinationStoryView(settings = {}) {
  const root = settings?.root;
  const documentRef = assertRoot(root);
  const timers = resolveTimers(settings?.timers);
  const reducedMotion = typeof settings?.reducedMotion === "function"
    ? settings.reducedMotion
    : () => Boolean(settings?.reducedMotion);
  const maxVisualLayers = boundedInteger(
    settings?.maxVisualLayers,
    COMBINATION_STORY_VIEW_MAX_LAYERS,
    1,
    MAX_VISUAL_LAYERS
  );
  const crumbleMs = boundedInteger(
    settings?.timings?.crumbleMs,
    DEFAULT_TIMINGS.crumbleMs,
    0,
    5_000
  );
  const rebuildStepMs = boundedInteger(
    settings?.timings?.rebuildStepMs,
    DEFAULT_TIMINGS.rebuildStepMs,
    0,
    2_000
  );
  const nodes = createShell(documentRef, root);
  const pendingTimers = new Set();
  let generation = 0;
  let disposed = false;
  let layerNodes = new Map();
  let visibleLayerIds = [];
  let currentStatus = "empty";
  let currentMotion = "idle";

  function cancelTimers() {
    generation += 1;
    for (const timer of pendingTimers) timers.clearTimeout(timer);
    pendingTimers.clear();
  }

  function schedule(callback, delay, activeGeneration) {
    let timer;
    timer = timers.setTimeout(() => {
      pendingTimers.delete(timer);
      if (disposed || activeGeneration !== generation) return;
      callback();
    }, delay);
    pendingTimers.add(timer);
  }

  function setRootState(phase, busy) {
    root.setAttribute("data-story-status", currentStatus);
    root.setAttribute("data-story-phase", phase);
    root.setAttribute("data-story-motion", currentMotion);
    root.setAttribute("data-story-visible-layers", String(visibleLayerIds.length));
    root.setAttribute("aria-busy", String(Boolean(busy)));
  }

  function settle() {
    for (const node of layerNodes.values()) {
      node.hidden = false;
      node.setAttribute("data-layer-state", "ready");
    }
    setRootState("stable", false);
  }

  function renderLayers(model) {
    const source = Array.isArray(model?.scene?.layers) ? model.scene.layers : [];
    const total = Math.max(0, boundedInteger(model?.scene?.layerCount, source.length, 0, 9_999));
    const foundation = source.find((layer) => layer?.role === "foundation") || source[0];
    const latest = source.length <= maxVisualLayers
      ? source
      : maxVisualLayers === 1
        ? foundation ? [foundation] : []
        : [
            ...(foundation ? [foundation] : []),
            ...source
              .slice(-(maxVisualLayers - 1))
              .filter((layer) => layer !== foundation && layer?.id !== foundation?.id)
          ].slice(0, maxVisualLayers);
    layerNodes = new Map();
    visibleLayerIds = [];
    nodes.layers.replaceChildren();
    for (const [index, layer] of latest.entries()) {
      const rendered = createLayerNode(documentRef, layer, index);
      if (layerNodes.has(rendered.id)) continue;
      layerNodes.set(rendered.id, rendered.node);
      visibleLayerIds.push(rendered.id);
      nodes.layers.append(rendered.node);
    }
    root.setAttribute("data-story-total-layers", String(total));
    nodes.layers.hidden = visibleLayerIds.length === 0;
    nodes.empty.hidden = visibleLayerIds.length > 0;
  }

  function renderChapters(model) {
    const chapters = Array.isArray(model?.chapters)
      ? model.chapters.slice(-COMBINATION_STORY_MAX_CHAPTERS)
      : [];
    nodes.chapters.replaceChildren();
    for (const [index, chapter] of chapters.entries()) {
      nodes.chapters.append(createChapterNode(documentRef, chapter, index));
    }
    nodes.chapters.hidden = chapters.length === 0;
  }

  function beginFailureAnimation(event) {
    const activeGeneration = generation;
    const crumbleOrder = eventLayerOrder(
      event,
      "crumble",
      [...visibleLayerIds].reverse(),
      layerNodes
    );
    const rebuildOrder = eventLayerOrder(event, "rebuild", visibleLayerIds, layerNodes);

    setRootState("crumble", true);
    for (const id of crumbleOrder) {
      const node = layerNodes.get(id);
      node.hidden = false;
      node.setAttribute("data-layer-state", "crumbling");
    }

    schedule(() => {
      setRootState("rebuild", true);
      for (const node of layerNodes.values()) {
        node.hidden = true;
        node.setAttribute("data-layer-state", "queued");
      }
      if (!rebuildOrder.length) {
        settle();
        return;
      }
      rebuildOrder.forEach((id, index) => {
        schedule(() => {
          const node = layerNodes.get(id);
          if (node) {
            node.hidden = false;
            node.setAttribute("data-layer-state", "rebuilding");
          }
          if (index === rebuildOrder.length - 1) settle();
        }, rebuildStepMs * (index + 1), activeGeneration);
      });
    }, crumbleMs, activeGeneration);
  }

  function ensureActive() {
    if (disposed) throw new Error("Combination story view has been disposed.");
  }

  function reset() {
    ensureActive();
    cancelTimers();
    currentStatus = "empty";
    currentMotion = "idle";
    layerNodes = new Map();
    visibleLayerIds = [];
    nodes.summary.textContent = "No combination story yet.";
    nodes.scene.setAttribute("aria-label", "No combination story yet.");
    nodes.layers.replaceChildren();
    nodes.layers.hidden = true;
    nodes.empty.textContent = "Make a successful combination to begin the story.";
    nodes.empty.hidden = false;
    nodes.chapters.replaceChildren();
    nodes.chapters.hidden = true;
    nodes.narration.textContent = "";
    root.setAttribute("aria-label", "Combination story");
    root.setAttribute("data-story-total-layers", "0");
    setRootState("stable", false);
  }

  function render(model) {
    ensureActive();
    if (!model || typeof model !== "object" || Array.isArray(model)) {
      throw new TypeError("Combination story view requires a story model.");
    }
    cancelTimers();
    currentStatus = safeToken(model.status, VALID_STATUSES, "empty");
    let motionIsReduced = true;
    try {
      motionIsReduced = Boolean(reducedMotion());
    } catch {
      motionIsReduced = true;
    }
    currentMotion = motionIsReduced ? "reduced" : "full";

    const summary = boundedText(model.summary) || "No combination story yet.";
    const accessibility = model.accessibility && typeof model.accessibility === "object"
      ? model.accessibility
      : {};
    nodes.summary.textContent = summary;
    nodes.empty.textContent = summary;
    nodes.scene.setAttribute("aria-label", boundedText(accessibility.description) || summary);
    nodes.scene.setAttribute(
      "data-story-scene-variant",
      safeToken(model?.scene?.variant, VALID_SCENE_VARIANTS, "deep-cosmos")
    );
    nodes.scene.setAttribute(
      "data-story-scene-palette",
      safeToken(model?.scene?.palette, VALID_SCENE_PALETTES, "violet")
    );
    nodes.scene.setAttribute(
      "data-story-scene-category",
      safeToken(model?.scene?.category, VALID_CATEGORIES, "unknown")
    );
    root.setAttribute("aria-label", boundedText(accessibility.label) || "Combination story");
    nodes.narration.setAttribute(
      "aria-live",
      accessibility.announcementPriority === "assertive" ? "assertive" : "polite"
    );
    nodes.narration.textContent = boundedText(accessibility.announcement)
      || boundedText(model.event?.narration)
      || summary;

    renderLayers(model);
    renderChapters(model);
    setRootState("stable", false);

    if (model.event?.type !== "crumble-rebuild" || motionIsReduced) {
      settle();
      return;
    }
    beginFailureAnimation(model.event);
  }

  function dispose() {
    if (disposed) return;
    cancelTimers();
    disposed = true;
    layerNodes = new Map();
    visibleLayerIds = [];
    root.replaceChildren();
    for (const attribute of [
      "role",
      "aria-label",
      "aria-busy",
      "data-story-status",
      "data-story-phase",
      "data-story-motion",
      "data-story-total-layers",
      "data-story-visible-layers"
    ]) {
      root.removeAttribute?.(attribute);
    }
  }

  reset();
  return Object.freeze({ render, reset, dispose });
}
