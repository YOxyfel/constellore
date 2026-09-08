import {
  buildSemanticBeacons,
  classifyFusionTier,
  deterministicBoardAnchor,
  getCombiningBoardModeRules,
  normalizeBoardAnchor,
  normalizeCombiningBoardMode,
  projectCombinationMemory
} from "./combining-board-domain.mjs?v=5.0.0-beta.4";
import { createCombiningBoardScene } from "./combining-board-scene.mjs?v=5.0.0-beta.4";

const TAU = Math.PI * 2;
const FUSION_RANK = Object.freeze({ instant: 0, micro: 1, discovery: 2, hero: 3 });

function normalizedText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

function wordKey(value) {
  return normalizedText(value).toLocaleLowerCase("en");
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, finite(value, minimum)));
}

function qualityName(value) {
  return value === "low" ? "low" : "standard";
}

function frozen(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(frozen));
  return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, frozen(item)])
  ));
}

function boardBounds(board, canvas, explicit = null) {
  const measured = explicit
    || board?.getBoundingClientRect?.()
    || canvas?.getBoundingClientRect?.()
    || {};
  return Object.freeze({
    left: finite(measured.left),
    top: finite(measured.top),
    width: Math.max(1, finite(measured.width, canvas?.clientWidth || 1)),
    height: Math.max(1, finite(measured.height, canvas?.clientHeight || 1))
  });
}

function sanitizeWord(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  return {
    id: item.id,
    word: item.word,
    category: item.category,
    tags: item.tags,
    semanticTags: item.semanticTags,
    facets: item.facets,
    ghost: item.ghost === true,
    unavailable: item.unavailable === true,
    disabled: item.disabled === true
  };
}

function sanitizeHistoryStep(step) {
  if (!step || typeof step !== "object" || Array.isArray(step)) return null;
  const result = step.result && typeof step.result === "object" && !Array.isArray(step.result)
    ? sanitizeWord(step.result)
    : step.result;
  const item = sanitizeWord(step.item);
  const sourceAnchors = step.anchors && typeof step.anchors === "object"
    ? step.anchors
    : step.derivationAnchors && typeof step.derivationAnchors === "object"
      ? step.derivationAnchors
      : {};
  return {
    a: step.a,
    b: step.b,
    left: step.left,
    right: step.right,
    ingredients: Array.isArray(step.ingredients) ? step.ingredients.slice(0, 2) : undefined,
    word: step.word,
    result,
    item,
    anchors: {
      ingredientA: normalizeBoardAnchor(sourceAnchors.ingredientA ?? sourceAnchors.a ?? sourceAnchors.left),
      ingredientB: normalizeBoardAnchor(sourceAnchors.ingredientB ?? sourceAnchors.b ?? sourceAnchors.right),
      result: normalizeBoardAnchor(sourceAnchors.result ?? sourceAnchors.word ?? sourceAnchors.output)
    },
    category: step.category,
    tags: step.tags,
    semanticTags: step.semanticTags,
    routeStepsAdvanced: step.routeStepsAdvanced,
    routeDerived: step.routeDerived === true,
    routeCompleted: step.routeCompleted === true,
    preview: step.preview === true,
    predicted: step.predicted === true,
    future: step.future === true,
    futureRecipe: step.futureRecipe === true,
    locked: step.locked === true,
    performed: step.performed,
    resolved: step.resolved,
    success: step.success,
    accepted: step.accepted
  };
}

function sanitizeNode(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  const item = sanitizeWord(node.item || node);
  if (!item || !wordKey(item.word)) return null;
  return {
    id: node.id == null ? null : String(node.id),
    item,
    x: node.x,
    y: node.y,
    normalized: node.normalized === true,
    coordinateSpace: node.coordinateSpace
  };
}

function sanitizeColors(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return Object.freeze({});
  return Object.freeze(Object.fromEntries(
    Object.entries(value)
      .filter(([, color]) => typeof color === "string" && color.trim())
      .map(([key, color]) => [String(key), color.trim()])
  ));
}

function sanitizeRouteProgress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({ progress: 0, stepsAdvanced: 0, stepsRemaining: null, completed: false });
  }
  const rawProgress = finite(value.progress ?? value.ratio ?? value.percent, 0);
  const progress = rawProgress > 1 ? rawProgress / 100 : rawProgress;
  const remaining = Number(value.stepsRemaining);
  return Object.freeze({
    progress: clamp(progress),
    stepsAdvanced: Math.max(0, Math.floor(finite(value.stepsAdvanced, 0))),
    stepsRemaining: Number.isFinite(remaining) ? Math.max(0, Math.floor(remaining)) : null,
    completed: value.completed === true
  });
}

function sanitizeRuntimeSnapshot(source = {}) {
  const targetValue = source.target?.word ?? source.target?.label ?? source.target;
  const colors = sanitizeColors(source.cosmetics?.colors || source.cosmeticColors || source.palette);
  return {
    mode: normalizeCombiningBoardMode(source.mode),
    words: (Array.isArray(source.words) ? source.words : []).map(sanitizeWord).filter(Boolean),
    history: (Array.isArray(source.history) ? source.history : []).map(sanitizeHistoryStep).filter(Boolean),
    nodes: (Array.isArray(source.nodes) ? source.nodes : []).map(sanitizeNode).filter(Boolean),
    target: normalizedText(targetValue),
    activeFacet: wordKey(source.activeFacet),
    quality: qualityName(source.quality),
    effects: source.effects ?? source.cinematicSpeed ?? source.combinationVisualSpeed,
    cosmetics: Object.freeze({
      colors,
      ambientAnimation: source.cosmetics?.ambientAnimation === true
    }),
    earnedRouteEvidence: [
      ...(Array.isArray(source.earnedRouteEvidence) ? source.earnedRouteEvidence : []),
      ...(Array.isArray(source.earnedRouteEdges) ? source.earnedRouteEdges : [])
    ],
    routeProgress: sanitizeRouteProgress(source.earnedRouteProgress || source.routeProgress)
  };
}

/** Converts live HTML-node coordinates into normalized board-relative anchors. */
export function normalizeLiveNodeAnchors({ nodes, bounds } = {}) {
  const measured = boardBounds(null, null, bounds);
  const seen = new Set();
  const anchors = [];
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const word = normalizedText(node?.item?.word ?? node?.word);
    const key = wordKey(word);
    if (!key || seen.has(key)) continue;

    let x = finite(node.x, NaN);
    let y = finite(node.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (node.normalized !== true) {
      if (node.coordinateSpace === "viewport") {
        x -= measured.left;
        y -= measured.top;
      }
      x /= measured.width;
      y /= measured.height;
    }
    const anchor = normalizeBoardAnchor({ x, y, unclamped: true });
    if (!anchor) continue;
    seen.add(key);
    anchors.push(Object.freeze({ word, ...anchor }));
  }
  return Object.freeze(anchors);
}

function semanticBeaconPoint(beacon) {
  const authoredCount = 15;
  const angle = ((finite(beacon.priority) % authoredCount) / authoredCount) * TAU - (Math.PI / 2);
  return Object.freeze({
    x: Number((0.5 + Math.cos(angle) * 0.42).toFixed(6)),
    y: Number((0.52 + Math.sin(angle) * 0.34).toFixed(6))
  });
}

const FAR_FIELD_CACHE = new Map();

/** Creates the same far field for a quality tier on every sync and resize. */
export function createCombiningBoardFarField({ quality = "standard" } = {}) {
  const tier = qualityName(quality);
  if (FAR_FIELD_CACHE.has(tier)) return FAR_FIELD_CACHE.get(tier);
  const starCount = tier === "low" ? 32 : 56;
  const nebulaCount = tier === "low" ? 2 : 4;
  const stars = Array.from({ length: starCount }, (_, index) => {
    const point = deterministicBoardAnchor(`observatory:star:${index}`);
    return Object.freeze({
      id: `far-star:${index}`,
      ...point,
      radius: Number((0.45 + ((point.x * 7 + point.y * 11 + index) % 1) * 1.65).toFixed(3)),
      alpha: Number((0.28 + ((point.x * 13 + point.y * 5 + index) % 1) * 0.6).toFixed(3)),
      phase: Number(((point.x + point.y + index * 0.31) % TAU).toFixed(4)),
      warm: index % 11 === 0
    });
  });
  const nebulae = Array.from({ length: nebulaCount }, (_, index) => {
    const point = deterministicBoardAnchor(`observatory:nebula:${index}`);
    return Object.freeze({
      id: `far-nebula:${index}`,
      ...point,
      radius: Number((0.24 + index * 0.045).toFixed(3)),
      alpha: Number((0.105 + index * 0.018).toFixed(3))
    });
  });
  const field = Object.freeze({ stars: Object.freeze(stars), nebulae: Object.freeze(nebulae) });
  FAR_FIELD_CACHE.set(tier, field);
  return field;
}

function memoryScene(memory, rules) {
  if (!rules.memoryConstellation) {
    return { stars: Object.freeze([]), edges: Object.freeze([]), routeEdges: Object.freeze([]), knownIds: new Set() };
  }
  const stars = [
    ...memory.stars.map((star) => Object.freeze({
      id: star.id,
      ...star.anchor,
      route: star.routeForward,
      radius: star.role === "result" ? 2.7 : 1.8,
      alpha: star.role === "result" ? 0.68 : 0.42
    })),
    ...memory.aggregates.map((aggregate) => Object.freeze({
      id: aggregate.id,
      ...aggregate.anchor,
      route: aggregate.routeForward,
      radius: Math.min(7, 2.8 + Math.log2(aggregate.count + 1)),
      alpha: 0.52
    }))
  ];
  const edges = memory.edges.map((edge) => Object.freeze({
    id: edge.id,
    from: edge.from,
    to: edge.to,
    alpha: edge.routeForward ? 0.22 : 0.31
  }));
  const routeEdges = rules.routeChart
    ? memory.edges.filter((edge) => edge.routeForward).map((edge) => Object.freeze({
      id: `earned:${edge.id}`,
      from: edge.from,
      to: edge.to,
      earned: true
    }))
    : [];
  return {
    stars: Object.freeze(stars),
    edges: Object.freeze(edges),
    routeEdges: Object.freeze(routeEdges),
    knownIds: new Set(stars.map(({ id }) => id))
  };
}

function earnedEvidenceEdges(source, knownIds) {
  const edges = [];
  for (const value of Array.isArray(source) ? source : []) {
    if (!value || typeof value !== "object" || value.earned !== true) continue;
    const fromId = typeof value.from === "string" ? value.from : value.from?.id;
    const toId = typeof value.to === "string" ? value.to : value.to?.id;
    if (!knownIds.has(fromId) || !knownIds.has(toId)) continue;
    edges.push(Object.freeze({
      id: normalizedText(value.id) || `earned-evidence:${edges.length}`,
      from: fromId,
      to: toId,
      earned: true
    }));
  }
  return edges;
}

function targetBeacon(target, rules) {
  if (!rules.targetBeacon || !target) return null;
  const seed = deterministicBoardAnchor(`observatory:target:${wordKey(target)}`);
  return Object.freeze({
    id: "current-target",
    label: target,
    x: Number((0.42 + seed.x * 0.16).toFixed(6)),
    y: 0.085,
    disconnected: true
  });
}

/** Pure snapshot-to-scene projection used by the runtime and its tests. */
export function buildCombiningBoardSceneModel({ snapshot: source, bounds, drag = null } = {}) {
  const snapshot = sanitizeRuntimeSnapshot(source);
  const rules = getCombiningBoardModeRules(snapshot.mode);
  const measured = boardBounds(null, null, bounds);
  const liveAnchors = normalizeLiveNodeAnchors({ nodes: snapshot.nodes, bounds: measured });
  const memory = projectCombinationMemory({ history: snapshot.history, liveAnchors });
  const memoryModel = memoryScene(memory, rules);
  const beacons = rules.semanticBeacons
    ? buildSemanticBeacons({ words: snapshot.words, max: 6 }).map((beacon) => Object.freeze({
      id: `semantic:${beacon.id}`,
      label: beacon.shortLabel || beacon.label,
      count: beacon.count,
      active: snapshot.activeFacet === beacon.id,
      ...semanticBeaconPoint(beacon)
    }))
    : [];
  const explicitEarned = rules.routeChart
    ? earnedEvidenceEdges(snapshot.earnedRouteEvidence, memoryModel.knownIds)
    : [];
  const routeEdges = Object.freeze([
    ...memoryModel.routeEdges,
    ...explicitEarned
  ].filter((edge, index, all) => all.findIndex(({ id }) => id === edge.id) === index));
  const farField = createCombiningBoardFarField({ quality: snapshot.quality });

  return frozen({
    mode: snapshot.mode,
    quality: snapshot.quality,
    rules,
    farField: {
      ...farField,
      animate: snapshot.cosmetics.ambientAnimation,
      palette: snapshot.cosmetics.colors
    },
    semanticBeacons: beacons,
    memoryStars: memoryModel.stars,
    memoryEdges: memoryModel.edges,
    routeEdges,
    targetBeacon: targetBeacon(snapshot.target, rules),
    drag,
    routeProgress: snapshot.routeProgress,
    projection: {
      totalPerformed: memory.totalPerformed,
      detailedCount: memory.detailedCount,
      aggregatedCount: memory.aggregatedCount
    }
  });
}

function normalizedRuntimePoint(value, bounds) {
  if (!value || typeof value !== "object") return null;
  if (value.normalized === true) return normalizeBoardAnchor(value);
  let x = finite(value.x ?? value.clientX, NaN);
  let y = finite(value.y ?? value.clientY, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (value.clientX != null || value.coordinateSpace === "viewport") {
    x -= bounds.left;
    y -= bounds.top;
  }
  return normalizeBoardAnchor({ x: x / bounds.width, y: y / bounds.height });
}

function normalizedFusionSource(value, bounds) {
  const point = normalizedRuntimePoint(value, bounds);
  if (!point) return null;
  const label = normalizedText(value?.label ?? value?.word).slice(0, 48);
  const emoji = normalizedText(value?.emoji).slice(0, 12);
  return Object.freeze({
    ...point,
    ...(label ? { label } : {}),
    ...(emoji ? { emoji } : {})
  });
}

function limitedFusionTier(tier, maximum) {
  if (tier === "instant") return "instant";
  return FUSION_RANK[tier] > FUSION_RANK[maximum] ? maximum : tier;
}

function fusionSpeed(value) {
  return wordKey(value) === "faster" ? 1.7 : 1;
}

export function readCombiningBoardPalette(element = globalThis.document?.body) {
  const styles = globalThis.getComputedStyle?.(element);
  const value = (property, fallback) => styles?.getPropertyValue?.(property)?.trim() || fallback;
  return {
    space: value("--board-c", "#02050f"),
    spaceLift: value("--board-b", "#071426"),
    nebula: value("--theme-glow", "#123b58"),
    nebulaSecondary: value("--violet", "#342052"),
    memory: value("--cosmetic-trail-connection-color", "#68b7c7"),
    memoryMuted: value("--cosmetic-trail-drag-secondary", "#526d80"),
    route: value("--amber", "#f1c86e"),
    routeGlow: value("--gold", "#ffe5a3"),
    beacon: value("--cyan", "#76e8f1"),
    target: value("--amber", "#f6d581"),
    fusionCyan: value("--cosmetic-trail-burst-color", "#71eff5"),
    fusionViolet: value("--cosmetic-trail-burst-secondary", "#9d74e6")
  };
}

const FOUNDATIONAL_WORDS = new Set(["earth", "water", "fire", "air"]);

export function describeCombiningBoardFusion(
  aAnchor, bAnchor, a, b, result, newDiscovery, routeStepsAdvanced,
  routeCompleted, cosmicTwist, finalTarget, effects
) {
  const foundationalPair = FOUNDATIONAL_WORDS.has(wordKey(a?.word ?? a))
    && FOUNDATIONAL_WORDS.has(wordKey(b?.word ?? b));
  return {
    at: { x: (aAnchor.x + bAnchor.x) / 2, y: (aAnchor.y + bAnchor.y) / 2 },
    sources: [
      { ...aAnchor, label: a?.word, emoji: a?.emoji },
      { ...bAnchor, label: b?.word, emoji: b?.emoji }
    ],
    result,
    newDiscovery,
    routeStepsAdvanced,
    routeCompleted,
    cosmicTwist,
    foundationalPair,
    finalTarget,
    effects
  };
}

/**
 * Presentation-only controller. It reads a gameplay snapshot but never calls a
 * recipe, scoring, save, profile, or progression mutation operation.
 */
export function createCombiningBoardRuntime({
  canvas,
  board = null,
  getSnapshot,
  ResizeObserver: ResizeObserverCtor = globalThis.ResizeObserver,
  createScene = createCombiningBoardScene,
  sceneOptions = {}
} = {}) {
  if (typeof getSnapshot !== "function") {
    throw new TypeError("createCombiningBoardRuntime requires getSnapshot");
  }
  if (typeof createScene !== "function") {
    throw new TypeError("createCombiningBoardRuntime requires a scene factory");
  }

  const scene = createScene({ canvas, board, ...sceneOptions });
  const suspensionReasons = new Set();
  let destroyed = false;
  let sceneSuspended = false;
  let bounds = boardBounds(board, canvas);
  let source = sanitizeRuntimeSnapshot(getSnapshot() || {});
  let model = null;
  let drag = null;
  let activeFusion = null;
  let observer = null;

  function reconcileSuspension() {
    const shouldSuspend = destroyed || suspensionReasons.size > 0 || model?.rules?.suspended === true;
    if (shouldSuspend === sceneSuspended) return;
    sceneSuspended = shouldSuspend;
    if (shouldSuspend) scene.suspend();
    else scene.resume();
  }

  function applyModel() {
    model = buildCombiningBoardSceneModel({ snapshot: source, bounds, drag });
    scene.sync(model);
    reconcileSuspension();
  }

  function sync(next = getSnapshot()) {
    if (destroyed) return snapshot();
    source = sanitizeRuntimeSnapshot(next || {});
    applyModel();
    return snapshot();
  }

  function resize(nextBounds = null) {
    if (destroyed) return snapshot();
    bounds = boardBounds(board, canvas, nextBounds);
    scene.resize({ width: bounds.width, height: bounds.height, quality: source.quality });
    applyModel();
    return snapshot();
  }

  function fusionTier(event = {}) {
    if (!model.rules.fusion) return "instant";
    const tier = classifyFusionTier(event, {
      mode: source.mode,
      effects: event.effects ?? source.effects
    });
    return limitedFusionTier(tier, model.rules.maxFusionTier);
  }

  function beginFusion(event = {}) {
    if (destroyed) return snapshot();
    const tier = fusionTier(event);
    const position = normalizedRuntimePoint(event.position || event.at || event, bounds)
      || Object.freeze({ x: 0.5, y: 0.5 });
    const speed = fusionSpeed(event.effects ?? source.effects);
    const sources = Object.freeze((Array.isArray(event.sources) ? event.sources : [])
      .slice(0, 2)
      .map((point) => normalizedFusionSource(point, bounds))
      .filter(Boolean));
    activeFusion = tier === "instant" ? null : Object.freeze({ tier, position, speed, sources });
    if (tier === "instant") scene.cancelFusion();
    else scene.beginFusion({ tier, position, speed, sources, result: normalizedText(event.result?.word ?? event.result) });
    return snapshot();
  }

  function commitFusion(event = {}) {
    if (destroyed) return snapshot();
    const classified = fusionTier(event);
    if (classified === "instant") {
      activeFusion = null;
      scene.cancelFusion();
      return snapshot();
    }
    const activeTier = activeFusion?.tier || "micro";
    const tier = limitedFusionTier(
      FUSION_RANK[classified] > FUSION_RANK[activeTier] ? classified : activeTier,
      model.rules.maxFusionTier
    );
    const position = normalizedRuntimePoint(event.position || event.at, bounds)
      || activeFusion?.position
      || Object.freeze({ x: 0.5, y: 0.5 });
    const speed = event.effects != null
      ? fusionSpeed(event.effects)
      : activeFusion?.speed || fusionSpeed(source.effects);
    const sources = Array.isArray(event.sources)
      ? Object.freeze(event.sources
        .slice(0, 2)
        .map((point) => normalizedFusionSource(point, bounds))
        .filter(Boolean))
      : activeFusion?.sources || Object.freeze([]);
    activeFusion = Object.freeze({ tier, position, speed, sources });
    scene.commitFusion({ tier, position, speed, sources, result: normalizedText(event.result?.word ?? event.result) });
    return snapshot();
  }

  function cancelFusion() {
    if (destroyed) return snapshot();
    activeFusion = null;
    scene.cancelFusion();
    return snapshot();
  }

  function setDrag(value = null) {
    if (destroyed) return snapshot();
    const from = normalizedRuntimePoint(value?.from, bounds);
    const to = normalizedRuntimePoint(value?.to, bounds);
    drag = value?.active === true && from && to
      ? Object.freeze({ active: true, from, to })
      : null;
    scene.sync({ drag });
    return snapshot();
  }

  function suspend(reason = "manual") {
    if (destroyed) return snapshot();
    suspensionReasons.add(normalizedText(reason) || "manual");
    reconcileSuspension();
    return snapshot();
  }

  function resume(reason = "manual") {
    if (destroyed) return snapshot();
    suspensionReasons.delete(normalizedText(reason) || "manual");
    reconcileSuspension();
    return snapshot();
  }

  function destroy() {
    if (destroyed) return snapshot();
    destroyed = true;
    observer?.disconnect?.();
    observer = null;
    suspensionReasons.clear();
    activeFusion = null;
    drag = null;
    scene.destroy();
    sceneSuspended = true;
    return snapshot();
  }

  function snapshot() {
    return frozen({
      destroyed,
      mode: source.mode,
      quality: source.quality,
      suspended: sceneSuspended,
      suspensionReasons: [...suspensionReasons].sort((left, right) => left.localeCompare(right, "en")),
      bounds,
      semanticBeaconCount: model?.semanticBeacons?.length || 0,
      memoryStarCount: model?.memoryStars?.length || 0,
      memoryEdgeCount: model?.memoryEdges?.length || 0,
      routeEdgeCount: model?.routeEdges?.length || 0,
      hasDisconnectedTarget: model?.targetBeacon?.disconnected === true,
      routeProgress: source.routeProgress,
      dragActive: drag?.active === true,
      fusionTier: activeFusion?.tier || null,
      scene: scene.snapshot?.() || null
    });
  }

  applyModel();
  const observedTarget = board || canvas;
  if (typeof ResizeObserverCtor === "function" && observedTarget) {
    observer = new ResizeObserverCtor((entries = []) => {
      if (destroyed) return;
      const entry = entries.find?.(({ target }) => target === observedTarget) || entries[0];
      resize(entry?.contentRect || null);
    });
    observer.observe?.(observedTarget);
  }

  return Object.freeze({
    sync,
    resize,
    beginFusion,
    commitFusion,
    cancelFusion,
    setDrag,
    suspend,
    resume,
    destroy,
    snapshot
  });
}
