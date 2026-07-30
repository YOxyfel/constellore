/**
 * DOM-only renderer for authored Golden Pair fusion moments.
 *
 * The supplied root is dedicated to this view. The renderer owns its children,
 * is excluded from the accessibility tree, and never accepts pointer input.
 *
 * API:
 *   createGoldenPairView({
 *     root,
 *     timers?: { setTimeout, clearTimeout },
 *     reducedMotion?: () => boolean
 *   }) -> { play(model), cancel(reason?), dispose(), active }
 */

export const GOLDEN_PAIR_MOTIONS = Object.freeze([
  "fall",
  "rise",
  "fly",
  "pulse",
  "transmute",
  "orbit",
  "build",
  "grow",
  "horizon",
  "reflect",
  "flow",
  "spectrum"
]);

export const GOLDEN_PAIR_VIEW_SELECTORS = Object.freeze({
  root: "[data-golden-pair]",
  scene: "[data-golden-scene]",
  sources: "[data-golden-sources]",
  source: "[data-golden-source]",
  sourceEmoji: "[data-golden-source-emoji]",
  sourceWord: "[data-golden-source-word]",
  glyphs: "[data-golden-glyphs]",
  glyph: "[data-golden-glyph]",
  core: "[data-golden-core]",
  coreRing: "[data-golden-core-ring]",
  coreSpark: "[data-golden-core-spark]",
  beats: "[data-golden-beats]",
  beat: "[data-golden-beat]",
  result: "[data-golden-result]",
  resultEmoji: "[data-golden-result-emoji]",
  resultWord: "[data-golden-result-word]"
});

export const GOLDEN_PAIR_MAX_ACTIVE_MS = 850;

const MOTIONS = new Set(GOLDEN_PAIR_MOTIONS);
const DEFAULT_DURATION_MS = 720;
const MIN_DURATION_MS = 240;
const REDUCED_FRAME_MS = 320;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/gu;
const UNSAFE_TOKEN_CHARACTERS = /[^a-z0-9-]/gu;

function boundedText(value, maximum = 80) {
  if (typeof value !== "string") return "";
  return value
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maximum);
}

function safeToken(value, fallback, maximum = 32) {
  const token = boundedText(value, maximum)
    .toLowerCase()
    .replace(/\s+/gu, "-")
    .replace(UNSAFE_TOKEN_CHARACTERS, "")
    .replace(/-{2,}/gu, "-")
    .replace(/^-|-$/gu, "");
  return token || fallback;
}

function boundedDuration(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_DURATION_MS;
  return Math.min(GOLDEN_PAIR_MAX_ACTIVE_MS, Math.max(MIN_DURATION_MS, Math.round(number)));
}

function normalizeDiscovery(value, fallbackWord) {
  return Object.freeze({
    emoji: boundedText(value?.emoji, 16),
    word: boundedText(value?.word, 64) || fallbackWord
  });
}

function normalizeTriplet(value, fallback) {
  const source = Array.isArray(value) ? value : [];
  return Object.freeze([0, 1, 2].map((index) => (
    boundedText(source[index], 48) || fallback[index]
  )));
}

function normalizeModel(model) {
  if (!model || typeof model !== "object") return null;
  const a = normalizeDiscovery(model.a, "First");
  const b = normalizeDiscovery(model.b, "Second");
  const result = normalizeDiscovery(model.result, "Discovery");
  if (!boundedText(model.a?.word, 64) || !boundedText(model.b?.word, 64) || !boundedText(model.result?.word, 64)) {
    return null;
  }
  const requestedMotion = boundedText(model.motion, 24).toLowerCase();
  const motion = MOTIONS.has(requestedMotion) ? requestedMotion : "pulse";
  return Object.freeze({
    id: safeToken(model.id, "golden-pair", 64),
    a,
    b,
    result,
    family: safeToken(model.family, "fusion"),
    motion,
    palette: safeToken(model.palette, "gold"),
    beats: normalizeTriplet(model.beats, ["Awaken", "Converge", "Discover"]),
    glyphs: normalizeTriplet(model.glyphs, ["✦", "◆", "✧"]),
    duration: boundedDuration(model.duration),
    announcement: boundedText(
      model.announcement,
      180
    ) || `${a.word} and ${b.word} become ${result.word}.`
  });
}

function assertRoot(root) {
  const documentRef = root?.ownerDocument;
  if (
    !root
    || typeof root.replaceChildren !== "function"
    || typeof root.setAttribute !== "function"
    || typeof documentRef?.createElement !== "function"
  ) {
    throw new TypeError("Golden Pair view requires a dedicated DOM Element root.");
  }
  return documentRef;
}

function resolveTimers(injected) {
  const source = injected || globalThis;
  if (typeof source?.setTimeout !== "function" || typeof source?.clearTimeout !== "function") {
    throw new TypeError("Golden Pair view requires setTimeout and clearTimeout.");
  }
  return Object.freeze({
    setTimeout: source.setTimeout.bind(source),
    clearTimeout: source.clearTimeout.bind(source)
  });
}

function markedElement(documentRef, tagName, marker) {
  const element = documentRef.createElement(tagName);
  element.setAttribute(marker, "");
  return element;
}

function createDiscoveryNode(documentRef, marker, slot) {
  const node = markedElement(documentRef, "div", marker);
  const emojiMarker = marker === "data-golden-result"
    ? "data-golden-result-emoji"
    : "data-golden-source-emoji";
  const wordMarker = marker === "data-golden-result"
    ? "data-golden-result-word"
    : "data-golden-source-word";
  const emoji = markedElement(documentRef, "span", emojiMarker);
  const word = markedElement(documentRef, "span", wordMarker);
  if (slot) node.setAttribute("data-golden-source", slot);
  emoji.setAttribute("aria-hidden", "true");
  node.append(emoji, word);
  return Object.freeze({ node, emoji, word });
}

function createShell(documentRef, root) {
  const scene = markedElement(documentRef, "div", "data-golden-scene");
  const sources = markedElement(documentRef, "div", "data-golden-sources");
  const sourceA = createDiscoveryNode(documentRef, "data-golden-source-node", "a");
  const sourceB = createDiscoveryNode(documentRef, "data-golden-source-node", "b");
  const glyphs = markedElement(documentRef, "div", "data-golden-glyphs");
  const glyphNodes = [0, 1, 2].map((index) => {
    const glyph = markedElement(documentRef, "span", "data-golden-glyph");
    glyph.setAttribute("data-golden-glyph-index", String(index + 1));
    glyph.setAttribute("aria-hidden", "true");
    return glyph;
  });
  const core = markedElement(documentRef, "div", "data-golden-core");
  const coreRing = markedElement(documentRef, "span", "data-golden-core-ring");
  const coreSpark = markedElement(documentRef, "span", "data-golden-core-spark");
  const beats = markedElement(documentRef, "div", "data-golden-beats");
  const beatNodes = [0, 1, 2].map((index) => {
    const beat = markedElement(documentRef, "span", "data-golden-beat");
    beat.setAttribute("data-golden-beat-index", String(index + 1));
    return beat;
  });
  const result = createDiscoveryNode(documentRef, "data-golden-result");

  coreRing.setAttribute("aria-hidden", "true");
  coreSpark.setAttribute("aria-hidden", "true");
  glyphs.append(...glyphNodes);
  core.append(coreRing, coreSpark);
  beats.append(...beatNodes);
  sources.append(sourceA.node, sourceB.node);
  scene.append(sources, glyphs, core, beats, result.node);

  root.setAttribute("data-golden-pair", "");
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("data-golden-phase", "idle");
  root.hidden = true;
  if (root.style && typeof root.style.setProperty === "function") {
    root.style.setProperty("pointer-events", "none");
  }
  root.replaceChildren(scene);

  return Object.freeze({
    scene,
    sourceA,
    sourceB,
    glyphs,
    glyphNodes,
    core,
    beats,
    beatNodes,
    result
  });
}

function writeDiscovery(nodes, discovery) {
  nodes.emoji.textContent = discovery.emoji;
  nodes.word.textContent = discovery.word;
}

/**
 * Creates a replaceable, short-lived Golden Pair overlay.
 *
 * `play` always returns synchronously. Starting any new play first cancels the
 * previous generation, including its completion timer.
 */
export function createGoldenPairView(settings = {}) {
  const root = settings?.root;
  const documentRef = assertRoot(root);
  const timers = resolveTimers(settings?.timers);
  const reducedMotion = typeof settings?.reducedMotion === "function"
    ? settings.reducedMotion
    : () => Boolean(settings?.reducedMotion);
  const nodes = createShell(documentRef, root);
  const pendingTimers = new Set();
  let generation = 0;
  let disposed = false;
  let currentId = "";

  function clearTimers() {
    for (const timer of pendingTimers) timers.clearTimeout(timer);
    pendingTimers.clear();
  }

  function setIdle(reason) {
    root.hidden = true;
    root.setAttribute("data-golden-phase", "idle");
    root.setAttribute("data-golden-stop-reason", safeToken(reason, "cancelled"));
    root.removeAttribute("data-golden-motion");
    root.removeAttribute("data-golden-family");
    root.removeAttribute("data-golden-palette");
    root.removeAttribute("data-golden-id");
    root.removeAttribute("data-golden-motion-mode");
    currentId = "";
  }

  function cancel(reason = "cancelled") {
    const wasActive = Boolean(currentId) && !root.hidden;
    generation += 1;
    clearTimers();
    if (!disposed) setIdle(reason);
    return Object.freeze({
      cancelled: wasActive,
      reason: safeToken(reason, "cancelled")
    });
  }

  function scheduleCompletion(delay, activeGeneration) {
    let timer;
    timer = timers.setTimeout(() => {
      pendingTimers.delete(timer);
      if (disposed || activeGeneration !== generation) return;
      setIdle("complete");
    }, delay);
    pendingTimers.add(timer);
  }

  function play(candidate) {
    cancel("replaced");
    if (disposed) {
      return Object.freeze({ played: false, reason: "disposed" });
    }

    const model = normalizeModel(candidate);
    if (!model) {
      setIdle("invalid-model");
      return Object.freeze({ played: false, reason: "invalid-model" });
    }

    let prefersReducedMotion = true;
    try {
      prefersReducedMotion = Boolean(reducedMotion());
    } catch {
      prefersReducedMotion = true;
    }

    writeDiscovery(nodes.sourceA, model.a);
    writeDiscovery(nodes.sourceB, model.b);
    writeDiscovery(nodes.result, model.result);
    nodes.glyphNodes.forEach((node, index) => {
      node.textContent = model.glyphs[index];
    });
    nodes.beatNodes.forEach((node, index) => {
      node.textContent = model.beats[index];
    });

    currentId = model.id;
    root.setAttribute("data-golden-id", model.id);
    root.setAttribute("data-golden-family", model.family);
    root.setAttribute("data-golden-motion", model.motion);
    root.setAttribute("data-golden-palette", model.palette);
    root.setAttribute("data-golden-motion-mode", prefersReducedMotion ? "reduced" : "full");
    root.setAttribute("data-golden-phase", "arming");
    root.removeAttribute("data-golden-stop-reason");
    if (root.style && typeof root.style.setProperty === "function") {
      root.style.setProperty("--golden-duration", `${model.duration}ms`);
    }
    root.hidden = false;
    if (!prefersReducedMotion) {
      // Flush the hidden/arming frame so replaying an identical pair restarts
      // every descendant CSS animation in this same synchronous task.
      void root.offsetWidth;
    }
    root.setAttribute("data-golden-phase", prefersReducedMotion ? "static" : "active");

    const activeGeneration = generation;
    const displayDuration = prefersReducedMotion ? REDUCED_FRAME_MS : model.duration;
    scheduleCompletion(displayDuration, activeGeneration);

    return Object.freeze({
      played: true,
      id: model.id,
      motion: model.motion,
      duration: displayDuration,
      reducedMotion: prefersReducedMotion,
      announcement: model.announcement
    });
  }

  function dispose() {
    if (disposed) return;
    cancel("disposed");
    disposed = true;
    generation += 1;
    clearTimers();
    root.hidden = true;
    root.setAttribute("data-golden-phase", "disposed");
    root.removeAttribute("data-golden-motion");
    root.removeAttribute("data-golden-family");
    root.removeAttribute("data-golden-palette");
    root.removeAttribute("data-golden-id");
    root.removeAttribute("data-golden-motion-mode");
    root.replaceChildren();
  }

  return Object.freeze({
    play,
    cancel,
    dispose,
    get active() {
      return !disposed && Boolean(currentId) && !root.hidden;
    }
  });
}
