/**
 * Presentation-only Canvas2D backdrop for the combining board.
 *
 * The caller owns every gameplay decision and supplies already-projected,
 * non-secret visual data. This scene never combines words, changes score,
 * reveals recipes, moves HTML word controls, or writes save data.
 *
 * The canvas is deliberately aria-hidden, removed from the tab order, and
 * pointer-transparent. Real HTML controls must remain the accessible and
 * interactive layer above it.
 */

export const COMBINING_BOARD_DPR_CAPS = Object.freeze({
  low: 1.25,
  standard: 1.75
});

export const COMBINING_BOARD_FUSION_DURATIONS_MS = Object.freeze({
  micro: 720,
  discovery: 1_400,
  hero: 3_400
});

const TAU = Math.PI * 2;
const DEFAULT_PALETTE = Object.freeze({
  space: "#02050f",
  spaceLift: "#071426",
  nebula: "#123b58",
  nebulaSecondary: "#342052",
  star: "#dff8ff",
  starWarm: "#f7d68b",
  memory: "#68b7c7",
  memoryMuted: "#526d80",
  route: "#f1c86e",
  routeGlow: "#ffe5a3",
  beacon: "#76e8f1",
  target: "#f6d581",
  fusionCore: "#f8e9bd",
  fusionCyan: "#71eff5",
  fusionViolet: "#9d74e6"
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, finite(value, minimum)));
}

function color(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function qualityName(value) {
  return value === "low" ? "low" : "standard";
}

export function capCombiningBoardDpr(value, quality = "standard") {
  return Math.max(1, Math.min(
    COMBINING_BOARD_DPR_CAPS[qualityName(quality)],
    finite(value, 1)
  ));
}

function normalizePoint(value, fallback = null) {
  if (!value || typeof value !== "object") return fallback;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback;
  return Object.freeze({
    x,
    y,
    normalized: value.normalized !== false
  });
}

function normalizeEndpoint(value, fallback = null) {
  if (typeof value === "string" && value) return Object.freeze({ id: value });
  return normalizePoint(value, fallback);
}

function normalizeStar(value, index, palette) {
  const point = normalizePoint(value);
  if (!point) return null;
  return Object.freeze({
    ...point,
    id: typeof value.id === "string" ? value.id : `star-${index}`,
    radius: clamp(value.radius, 0.35, 7),
    alpha: clamp(value.alpha ?? 0.72, 0, 1),
    phase: finite(value.phase, index * 0.73),
    warm: value.warm === true,
    color: color(value.color, value.warm ? palette.starWarm : palette.star)
  });
}

function normalizeNebula(value, index, palette) {
  const point = normalizePoint(value);
  if (!point) return null;
  return Object.freeze({
    ...point,
    id: typeof value.id === "string" ? value.id : `nebula-${index}`,
    radius: clamp(value.radius ?? 0.28, 0.04, 1.25),
    alpha: clamp(value.alpha ?? 0.17, 0, 0.72),
    color: color(value.color, index % 2 ? palette.nebulaSecondary : palette.nebula)
  });
}

function normalizeBeacon(value, index, palette) {
  const point = normalizePoint(value);
  if (!point) return null;
  return Object.freeze({
    ...point,
    id: typeof value.id === "string" ? value.id : `beacon-${index}`,
    label: typeof value.label === "string" ? value.label.slice(0, 44) : "",
    count: Math.max(0, Math.floor(finite(value.count, 0))),
    active: value.active === true,
    color: color(value.color, palette.beacon)
  });
}

function normalizeMemoryStar(value, index, palette) {
  const point = normalizePoint(value);
  if (!point) return null;
  return Object.freeze({
    ...point,
    id: typeof value.id === "string" ? value.id : `memory-${index}`,
    radius: clamp(value.radius ?? 2.2, 0.6, 9),
    alpha: clamp(value.alpha ?? 0.58, 0, 1),
    route: value.route === true,
    color: color(value.color, value.route ? palette.route : palette.memory)
  });
}

function normalizeEdge(value, index, palette, route = false) {
  if (!value || typeof value !== "object") return null;
  if (route && value.earned === false) return null;
  const from = normalizeEndpoint(value.from)
    || normalizePoint({ x: value.x1, y: value.y1, normalized: value.normalized });
  const to = normalizeEndpoint(value.to)
    || normalizePoint({ x: value.x2, y: value.y2, normalized: value.normalized });
  if (!from || !to) return null;
  return Object.freeze({
    id: typeof value.id === "string" ? value.id : `${route ? "route" : "memory"}-edge-${index}`,
    from,
    to,
    alpha: clamp(value.alpha ?? (route ? 0.9 : 0.34), 0, 1),
    width: clamp(value.width ?? (route ? 1.8 : 0.8), 0.25, 8),
    color: color(value.color, route ? palette.route : palette.memoryMuted),
    earned: route
  });
}

function normalizeTarget(value, palette) {
  const point = normalizePoint(value);
  if (!point) return null;
  return Object.freeze({
    ...point,
    id: typeof value.id === "string" ? value.id : "target",
    label: typeof value.label === "string" ? value.label.slice(0, 52) : "TARGET",
    color: color(value.color, palette.target),
    disconnected: true
  });
}

function normalizeDrag(value, palette) {
  if (!value || typeof value !== "object" || value.active !== true) return null;
  const from = normalizePoint(value.from);
  const to = normalizePoint(value.to);
  if (!from || !to) return null;
  return Object.freeze({
    active: true,
    from,
    to,
    color: color(value.color, palette.beacon)
  });
}

function paletteFrom(source = {}, previous = DEFAULT_PALETTE) {
  const farField = source.farField?.palette || {};
  const cosmetics = source.cosmeticColors || source.cosmetic?.colors || {};
  const explicit = source.palette || {};
  const merged = { ...previous, ...farField, ...cosmetics, ...explicit };
  return Object.freeze(Object.fromEntries(
    Object.entries(DEFAULT_PALETTE).map(([key, fallback]) => [key, color(merged[key], fallback)])
  ));
}

function supplied(source, direct, nested, nestedKey) {
  if (Object.hasOwn(source, direct)) return source[direct];
  if (source[nested] && Object.hasOwn(source[nested], nestedKey)) return source[nested][nestedKey];
  return undefined;
}

function arrayOrPrevious(value, previous, normalize) {
  if (value === undefined) return previous;
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value.map(normalize).filter(Boolean));
}

function normalizeScene(source = {}, previous = null) {
  const prior = previous || {
    quality: "standard",
    palette: DEFAULT_PALETTE,
    stars: Object.freeze([]),
    nebulae: Object.freeze([]),
    semanticBeacons: Object.freeze([]),
    memoryStars: Object.freeze([]),
    memoryEdges: Object.freeze([]),
    routeEdges: Object.freeze([]),
    targetBeacon: null,
    drag: null,
    ambientAnimation: false
  };
  const palette = paletteFrom(source, prior.palette);
  const stars = arrayOrPrevious(
    supplied(source, "stars", "farField", "stars"),
    prior.stars,
    (item, index) => normalizeStar(item, index, palette)
  );
  const nebulae = arrayOrPrevious(
    supplied(source, "nebulae", "farField", "nebulae"),
    prior.nebulae,
    (item, index) => normalizeNebula(item, index, palette)
  );
  const semanticBeacons = arrayOrPrevious(
    source.semanticBeacons,
    prior.semanticBeacons,
    (item, index) => normalizeBeacon(item, index, palette)
  ).slice(0, 6);
  const memoryStars = arrayOrPrevious(
    supplied(source, "memoryStars", "memory", "stars"),
    prior.memoryStars,
    (item, index) => normalizeMemoryStar(item, index, palette)
  );
  const memoryEdges = arrayOrPrevious(
    supplied(source, "memoryEdges", "memory", "edges"),
    prior.memoryEdges,
    (item, index) => normalizeEdge(item, index, palette, false)
  );
  const routeEdges = arrayOrPrevious(
    supplied(source, "routeEdges", "route", "edges")
      ?? source.earnedRouteEdges,
    prior.routeEdges,
    (item, index) => normalizeEdge(item, index, palette, true)
  );
  const targetInput = Object.hasOwn(source, "targetBeacon")
    ? source.targetBeacon
    : source.route && Object.hasOwn(source.route, "target")
      ? source.route.target
      : undefined;

  return Object.freeze({
    quality: Object.hasOwn(source, "quality") ? qualityName(source.quality) : prior.quality,
    palette,
    stars,
    nebulae,
    semanticBeacons: Object.freeze([...semanticBeacons]),
    memoryStars,
    memoryEdges,
    routeEdges,
    targetBeacon: targetInput === undefined ? prior.targetBeacon : normalizeTarget(targetInput, palette),
    drag: Object.hasOwn(source, "drag") ? normalizeDrag(source.drag, palette) : prior.drag,
    ambientAnimation: Object.hasOwn(source, "ambientAnimation")
      ? source.ambientAnimation === true
      : source.farField && Object.hasOwn(source.farField, "animate")
        ? source.farField.animate === true
        : prior.ambientAnimation
  });
}

function resolveValue(value) {
  return typeof value === "function" ? value() : value;
}

function drawPoint(point, width, height) {
  if (!point) return null;
  if (point.normalized === false) return { x: point.x, y: point.y };
  return { x: point.x * width, y: point.y * height };
}

function alphaColor(hex, alpha) {
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const value = Math.round(clamp(alpha) * 255).toString(16).padStart(2, "0");
  return `${hex}${value}`;
}

function withState(context, draw) {
  context.save?.();
  try {
    draw();
  } finally {
    context.restore?.();
  }
}

function drawLine(context, from, to, { color: stroke, alpha, width, dashed = false, glow = 0 }) {
  withState(context, () => {
    context.beginPath?.();
    context.moveTo?.(from.x, from.y);
    context.lineTo?.(to.x, to.y);
    context.strokeStyle = stroke;
    context.globalAlpha = alpha;
    context.lineWidth = width;
    context.shadowColor = stroke;
    context.shadowBlur = glow;
    context.setLineDash?.(dashed ? [5, 7] : []);
    context.stroke?.();
  });
}

function drawCircle(context, x, y, radius, { fill = null, stroke = null, alpha = 1, width = 1, glow = 0, dashed = false } = {}) {
  withState(context, () => {
    context.beginPath?.();
    context.arc?.(x, y, Math.max(0.01, radius), 0, TAU);
    context.globalAlpha = alpha;
    context.shadowColor = stroke || fill || "transparent";
    context.shadowBlur = glow;
    if (fill) {
      context.fillStyle = fill;
      context.fill?.();
    }
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = width;
      context.setLineDash?.(dashed ? [4, 6] : []);
      context.stroke?.();
    }
  });
}

function drawBackground(context, scene, metrics, time, forcedColors, reducedMotion) {
  const { width, height } = metrics;
  context.fillStyle = forcedColors ? "#000000" : scene.palette.space;
  context.fillRect?.(0, 0, width, height);
  if (forcedColors) return;

  for (const nebula of scene.nebulae) {
    const point = drawPoint(nebula, width, height);
    const radius = nebula.normalized === false
      ? nebula.radius
      : nebula.radius * Math.max(width, height);
    const gradient = context.createRadialGradient?.(
      point.x,
      point.y,
      0,
      point.x,
      point.y,
      Math.max(1, radius)
    );
    if (gradient?.addColorStop) {
      gradient.addColorStop(0, alphaColor(nebula.color, nebula.alpha));
      gradient.addColorStop(0.55, alphaColor(nebula.color, nebula.alpha * 0.32));
      gradient.addColorStop(1, alphaColor(nebula.color, 0));
      context.fillStyle = gradient;
    } else context.fillStyle = alphaColor(nebula.color, nebula.alpha * 0.4);
    context.fillRect?.(
      point.x - radius,
      point.y - radius,
      radius * 2,
      radius * 2
    );
  }

  const seconds = time / 1_000;
  for (const star of scene.stars) {
    const point = drawPoint(star, width, height);
    const shimmer = reducedMotion || !scene.ambientAnimation
      ? 1
      : 0.82 + Math.sin(seconds * 1.35 + star.phase) * 0.18;
    drawCircle(context, point.x, point.y, star.radius, {
      fill: star.color,
      alpha: star.alpha * shimmer,
      glow: star.radius > 2 ? 5 : 0
    });
  }
}

function nodeIndex(scene) {
  const index = new Map();
  for (const node of [...scene.memoryStars, ...scene.semanticBeacons]) index.set(node.id, node);
  if (scene.targetBeacon) index.set(scene.targetBeacon.id, scene.targetBeacon);
  return index;
}

function endpointPoint(endpoint, index, width, height) {
  if (!endpoint) return null;
  const source = endpoint.id ? index.get(endpoint.id) : endpoint;
  return drawPoint(source, width, height);
}

function drawGraph(context, scene, metrics, forcedColors) {
  const { width, height } = metrics;
  const index = nodeIndex(scene);
  for (const edge of scene.memoryEdges) {
    const from = endpointPoint(edge.from, index, width, height);
    const to = endpointPoint(edge.to, index, width, height);
    if (!from || !to) continue;
    drawLine(context, from, to, {
      color: forcedColors ? "#ffffff" : edge.color,
      alpha: forcedColors ? 0.8 : edge.alpha,
      width: forcedColors ? Math.max(2, edge.width) : edge.width
    });
  }
  for (const edge of scene.routeEdges) {
    const from = endpointPoint(edge.from, index, width, height);
    const to = endpointPoint(edge.to, index, width, height);
    if (!from || !to) continue;
    drawLine(context, from, to, {
      color: forcedColors ? "#ffff00" : edge.color,
      alpha: 1,
      width: forcedColors ? Math.max(3, edge.width) : edge.width,
      glow: forcedColors ? 0 : 9
    });
  }
  for (const star of scene.memoryStars) {
    const point = drawPoint(star, width, height);
    drawCircle(context, point.x, point.y, star.radius, {
      fill: forcedColors ? "#ffffff" : star.color,
      alpha: forcedColors ? 1 : star.alpha,
      glow: forcedColors ? 0 : star.route ? 8 : 3
    });
  }
}

function drawBeacons(context, scene, metrics, forcedColors, time, reducedMotion) {
  const { width, height } = metrics;
  for (const beacon of scene.semanticBeacons) {
    const point = drawPoint(beacon, width, height);
    const pulse = reducedMotion ? 0 : (Math.sin(time / 620 + beacon.x * 8) + 1) * 1.5;
    const stroke = forcedColors ? "#ffffff" : beacon.color;
    drawCircle(context, point.x, point.y, 11 + pulse + (beacon.active ? 4 : 0), {
      stroke,
      alpha: beacon.active ? 0.95 : 0.48,
      width: forcedColors ? 2.5 : beacon.active ? 1.8 : 1,
      glow: forcedColors ? 0 : beacon.active ? 13 : 5
    });
    if (beacon.active && beacon.label && typeof context.fillText === "function") {
      withState(context, () => {
        context.fillStyle = stroke;
        context.globalAlpha = forcedColors ? 1 : 0.9;
        context.font = "600 11px system-ui, sans-serif";
        context.textAlign = "center";
        context.fillText(beacon.count ? `${beacon.label} · ${beacon.count}` : beacon.label, point.x, point.y + 31);
      });
    }
  }
  if (scene.targetBeacon) {
    const target = drawPoint(scene.targetBeacon, width, height);
    const stroke = forcedColors ? "#ffff00" : scene.targetBeacon.color;
    drawCircle(context, target.x, target.y, 19, {
      stroke,
      alpha: 0.92,
      width: forcedColors ? 3 : 1.8,
      glow: forcedColors ? 0 : 14,
      dashed: true
    });
    drawCircle(context, target.x, target.y, 3.2, { fill: stroke, alpha: 1 });
    if (typeof context.fillText === "function") {
      withState(context, () => {
        context.fillStyle = stroke;
        context.font = "700 11px system-ui, sans-serif";
        context.textAlign = "center";
        context.fillText(scene.targetBeacon.label, target.x, Math.min(height - 8, target.y < 43 ? target.y + 36 : target.y - 27));
      });
    }
  }
}

function drawDrag(context, scene, metrics, forcedColors, time, reducedMotion) {
  if (!scene.drag) return;
  const from = drawPoint(scene.drag.from, metrics.width, metrics.height);
  const to = drawPoint(scene.drag.to, metrics.width, metrics.height);
  const colorValue = forcedColors ? "#ffffff" : scene.drag.color;
  drawLine(context, from, to, {
    color: colorValue,
    alpha: 0.76,
    width: forcedColors ? 3 : 1.5,
    dashed: true,
    glow: forcedColors ? 0 : reducedMotion ? 4 : 7 + Math.sin(time / 90) * 2
  });
}

function fusionCenter(fusion, metrics) {
  const projected = drawPoint(fusion?.position, metrics.width, metrics.height);
  return projected || { x: metrics.width / 2, y: metrics.height / 2 };
}

function lerpPoint(from, to, progress) {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress
  };
}

function easeOutCubic(progress) {
  const value = clamp(progress, 0, 1);
  return 1 - ((1 - value) ** 3);
}

function drawFusionWord(context, text, point, {
  color: fill = "#ffffff",
  alpha = 1,
  scale = 1,
  glow = 0
} = {}) {
  const label = String(text || "").trim().slice(0, 52);
  if (!label || typeof context.fillText !== "function") return;
  context.save();
  context.globalAlpha = clamp(alpha, 0, 1);
  context.fillStyle = fill;
  context.font = `700 ${Math.round(clamp(13 * scale, 12, 23))}px ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = fill;
  context.shadowBlur = glow;
  context.fillText(label, point.x, point.y);
  context.restore();
}

function fusionSourcePoints(fusion, center, metrics) {
  const spread = Math.min(metrics.width * 0.36, 330);
  const rise = Math.min(metrics.height * 0.1, 54);
  const fallbacks = [
    { x: center.x - spread, y: center.y + rise },
    { x: center.x + spread, y: center.y - rise * 0.45 }
  ];
  return fallbacks.map((fallback, index) => (
    drawPoint(fusion?.sources?.[index], metrics.width, metrics.height) || fallback
  ));
}

function drawFusionComets(context, fusion, scene, metrics, center, forcedColors, reducedMotion) {
  if (reducedMotion || fusion.phase !== "release") return;
  const tierScale = fusion.tier === "hero" ? 1.45 : fusion.tier === "discovery" ? 1.15 : 0.86;
  const impact = easeOutCubic(clamp(fusion.progress / 0.46, 0, 1));
  const sources = fusionSourcePoints(fusion, center, metrics);
  const colors = forcedColors
    ? ["#ffffff", "#ffffff"]
    : [scene.palette.fusionCyan, scene.palette.fusionViolet];

  sources.forEach((source, index) => {
    const head = lerpPoint(source, center, impact);
    const bend = Math.sin(impact * Math.PI) * (index === 0 ? -18 : 18) * tierScale;
    head.y += bend;
    const tailProgress = Math.max(0, impact - 0.25);
    const tail = lerpPoint(source, center, tailProgress);
    tail.y += Math.sin(tailProgress * Math.PI) * (index === 0 ? -18 : 18) * tierScale;
    drawLine(context, tail, head, {
      color: colors[index],
      alpha: 0.34 + (1 - impact) * 0.46,
      width: forcedColors ? 3 : 2.1 * tierScale,
      glow: forcedColors ? 0 : 15 * tierScale
    });
    drawCircle(context, head.x, head.y, (3.6 + (1 - impact) * 2.6) * tierScale, {
      fill: forcedColors ? "#ffffff" : scene.palette.fusionCore,
      stroke: colors[index],
      alpha: Math.max(0.2, 1 - Math.max(0, impact - 0.82) * 4.4),
      width: forcedColors ? 2 : 1,
      glow: forcedColors ? 0 : 16 * tierScale
    });
    const sourceMeta = fusion.sources?.[index];
    const sourceLabel = [sourceMeta?.emoji, sourceMeta?.label].filter(Boolean).join(" ");
    drawFusionWord(context, sourceLabel, { x: head.x, y: head.y - 16 * tierScale }, {
      color: forcedColors ? "#ffffff" : colors[index],
      alpha: Math.max(0.14, 1 - impact * 0.86),
      scale: tierScale,
      glow: forcedColors ? 0 : 9 * tierScale
    });
  });

  if (fusion.progress <= 0.42) return;
  const ascent = easeOutCubic((fusion.progress - 0.42) / 0.58);
  const destination = {
    x: center.x,
    y: Math.max(30, center.y - Math.min(metrics.height * 0.24, 150))
  };
  const head = lerpPoint(center, destination, ascent);
  const tail = lerpPoint(center, destination, Math.max(0, ascent - 0.28));
  const outputColor = forcedColors ? "#ffff00" : (fusion.tier === "hero" ? scene.palette.route : scene.palette.fusionCore);
  drawLine(context, tail, head, {
    color: outputColor,
    alpha: Math.max(0.18, 0.9 - ascent * 0.42),
    width: forcedColors ? 3 : 2.4 * tierScale,
    glow: forcedColors ? 0 : 18 * tierScale
  });
  drawCircle(context, head.x, head.y, (4.4 + (1 - ascent) * 2.4) * tierScale, {
    fill: outputColor,
    alpha: Math.max(0.16, 1 - Math.max(0, ascent - 0.82) * 4.8),
    glow: forcedColors ? 0 : 20 * tierScale
  });
  drawFusionWord(context, fusion.result, { x: head.x, y: head.y - 18 * tierScale }, {
    color: outputColor,
    alpha: Math.max(0.16, 1 - Math.max(0, ascent - 0.84) * 5.2),
    scale: tierScale * 1.08,
    glow: forcedColors ? 0 : 12 * tierScale
  });
}

function drawFusion(context, fusion, scene, metrics, forcedColors, reducedMotion, time) {
  if (!fusion) return;
  const center = fusionCenter(fusion, metrics);
  const tierScale = fusion.tier === "hero" ? 1.7 : fusion.tier === "discovery" ? 1.25 : 0.88;
  const phase = fusion.phase === "release" ? fusion.progress : 0.22 + Math.sin(time / 150) * 0.06;
  const pulse = reducedMotion ? 0.74 : clamp(phase, 0, 1);
  const core = forcedColors ? "#ffffff" : scene.palette.fusionCore;
  const cyan = forcedColors ? "#ffffff" : scene.palette.fusionCyan;
  const violet = forcedColors ? "#ffffff" : scene.palette.fusionViolet;

  drawFusionComets(context, fusion, scene, metrics, center, forcedColors, reducedMotion);

  drawCircle(context, center.x, center.y, 9 * tierScale, {
    fill: scene.palette.space,
    stroke: core,
    alpha: 0.95,
    width: forcedColors ? 3 : 1.4,
    glow: forcedColors ? 0 : 18 * tierScale
  });
  drawCircle(context, center.x, center.y, (22 + pulse * 22) * tierScale, {
    stroke: cyan,
    alpha: Math.max(0.18, 0.74 - pulse * 0.44),
    width: forcedColors ? 2.5 : 1.5
  });
  if (fusion.tier !== "micro") {
    drawCircle(context, center.x, center.y, (34 + pulse * 34) * tierScale, {
      stroke: fusion.tier === "hero" ? scene.palette.route : violet,
      alpha: Math.max(0.12, 0.54 - pulse * 0.34),
      width: forcedColors ? 2 : 1,
      dashed: fusion.tier === "discovery"
    });
  }
  if (fusion.phase === "release") {
    const rayLength = (32 + 70 * pulse) * tierScale;
    for (let index = 0; index < (fusion.tier === "hero" ? 8 : 4); index += 1) {
      const angle = (index / (fusion.tier === "hero" ? 8 : 4)) * TAU + pulse * 0.35;
      drawLine(context, center, {
        x: center.x + Math.cos(angle) * rayLength,
        y: center.y + Math.sin(angle) * rayLength
      }, {
        color: index % 2 ? cyan : core,
        alpha: Math.max(0, 0.62 * (1 - pulse)),
        width: forcedColors ? 2 : 1,
        glow: forcedColors ? 0 : 8
      });
    }
  }
}

function frozenSnapshot(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(frozenSnapshot));
  return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, frozenSnapshot(item)])
  ));
}

/**
 * Creates the inert visual scene behind a combining board.
 *
 * `canvas` must not be used for hit testing. The returned controller enforces
 * `aria-hidden`, `tabIndex=-1`, and `pointer-events:none`; callers must provide
 * equivalent HTML controls for every meaningful action or label.
 */
export function createCombiningBoardScene({
  canvas,
  board = null,
  devicePixelRatio = () => globalThis.devicePixelRatio || 1,
  reducedMotion = false,
  forcedColors = false
} = {}) {
  if (!canvas || typeof canvas.getContext !== "function") {
    throw new TypeError("createCombiningBoardScene requires a Canvas2D canvas");
  }
  const context = canvas.getContext("2d");
  if (!context) throw new TypeError("createCombiningBoardScene could not acquire a 2D context");

  canvas.setAttribute?.("aria-hidden", "true");
  canvas.setAttribute?.("tabindex", "-1");
  canvas.tabIndex = -1;
  if (canvas.style) canvas.style.pointerEvents = "none";

  const view = board?.ownerDocument?.defaultView
    || canvas.ownerDocument?.defaultView
    || globalThis;
  const requestFrame = typeof view?.requestAnimationFrame === "function"
    ? view.requestAnimationFrame.bind(view)
    : (callback) => setTimeout(() => callback(Date.now()), 16);
  const cancelFrame = typeof view?.cancelAnimationFrame === "function"
    ? view.cancelAnimationFrame.bind(view)
    : clearTimeout;
  const currentTime = () => {
    const value = Number(view?.performance?.now?.());
    return Number.isFinite(value) ? value : Date.now();
  };

  let scene = normalizeScene();
  let metrics = { width: 1, height: 1, dpr: 1, quality: "standard" };
  let fusion = null;
  let frame = 0;
  let dirty = true;
  let suspended = false;
  let destroyed = false;
  let renderCount = 0;

  function motionReduced() {
    return Boolean(resolveValue(reducedMotion));
  }

  function colorsForced() {
    return Boolean(resolveValue(forcedColors));
  }

  function shouldAnimate() {
    if (destroyed || suspended || motionReduced()) return false;
    return Boolean(
      fusion
      || scene.drag?.active
      || scene.ambientAnimation
    );
  }

  function measure(bounds = null) {
    const rect = bounds || board?.getBoundingClientRect?.() || canvas.getBoundingClientRect?.() || {};
    const width = Math.max(1, Math.round(finite(rect.width, canvas.clientWidth || 1)));
    const height = Math.max(1, Math.round(finite(rect.height, canvas.clientHeight || 1)));
    const quality = qualityName(rect.quality ?? scene.quality ?? metrics.quality);
    const requestedDpr = rect.devicePixelRatio ?? resolveValue(devicePixelRatio);
    return { width, height, quality, dpr: capCombiningBoardDpr(requestedDpr, quality) };
  }

  function applySize(next) {
    metrics = next;
    const pixelWidth = Math.max(1, Math.round(next.width * next.dpr));
    const pixelHeight = Math.max(1, Math.round(next.height * next.dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  }

  function updateFusion(nowMs) {
    if (!fusion || fusion.phase !== "release") return;
    if (motionReduced()) {
      fusion = null;
      return;
    }
    const duration = Math.max(1, fusion.durationMs);
    const progress = clamp((nowMs - fusion.startedAt) / duration, 0, 1);
    fusion = Object.freeze({ ...fusion, progress });
    if (progress >= 1) fusion = null;
  }

  function render(nowMs = currentTime()) {
    if (destroyed || suspended) return false;
    dirty = false;
    applySize(measure(metrics));
    context.setTransform?.(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
    context.clearRect?.(0, 0, metrics.width, metrics.height);
    const reduced = motionReduced();
    const forced = colorsForced();
    drawBackground(context, scene, metrics, nowMs, forced, reduced);
    drawGraph(context, scene, metrics, forced);
    drawBeacons(context, scene, metrics, forced, nowMs, reduced);
    drawDrag(context, scene, metrics, forced, nowMs, reduced);
    drawFusion(context, fusion, scene, metrics, forced, reduced, nowMs);
    renderCount += 1;
    updateFusion(nowMs);
    return true;
  }

  function schedule() {
    if (destroyed || suspended || frame) return;
    frame = requestFrame((timestamp) => {
      frame = 0;
      const time = Number.isFinite(Number(timestamp)) ? Number(timestamp) : currentTime();
      if (dirty || shouldAnimate()) render(time);
      if (shouldAnimate()) schedule();
    });
  }

  function invalidate() {
    if (destroyed) return false;
    dirty = true;
    schedule();
    return true;
  }

  function sync(next = {}) {
    if (destroyed) return snapshot();
    scene = normalizeScene(next, scene);
    if (scene.quality !== metrics.quality) applySize(measure({
      width: metrics.width,
      height: metrics.height,
      quality: scene.quality
    }));
    invalidate();
    return snapshot();
  }

  function resize(bounds = null) {
    if (destroyed) return snapshot();
    if (bounds && Object.hasOwn(bounds, "quality")) {
      scene = normalizeScene({ quality: bounds.quality }, scene);
    }
    applySize(measure(bounds));
    invalidate();
    return snapshot();
  }

  function normalizeFusion(value = {}, phase = "charging") {
    const tier = Object.hasOwn(COMBINING_BOARD_FUSION_DURATIONS_MS, value.tier)
      ? value.tier
      : "micro";
    const speed = clamp(value.speed ?? value.speedMultiplier ?? 1, 0.25, 4);
    return Object.freeze({
      tier,
      phase,
      position: normalizePoint(value.position || value.at) || Object.freeze({ x: 0.5, y: 0.5, normalized: true }),
      sources: Object.freeze((Array.isArray(value.sources) ? value.sources : [])
        .slice(0, 2)
        .map((source) => {
          const point = normalizePoint(source);
          return point ? Object.freeze({
            ...point,
            label: typeof source?.label === "string" ? source.label.slice(0, 48) : "",
            emoji: typeof source?.emoji === "string" ? source.emoji.slice(0, 12) : ""
          }) : null;
        })
        .filter(Boolean)),
      result: typeof value.result === "string" ? value.result.slice(0, 80) : "",
      startedAt: currentTime(),
      speed,
      durationMs: motionReduced() ? 0 : COMBINING_BOARD_FUSION_DURATIONS_MS[tier] / speed,
      progress: phase === "release" && motionReduced() ? 1 : 0
    });
  }

  function beginFusion(value = {}) {
    if (destroyed) return snapshot();
    fusion = normalizeFusion(value, "charging");
    invalidate();
    return snapshot();
  }

  function commitFusion(value = {}) {
    if (destroyed) return snapshot();
    const source = {
      ...(fusion || {}),
      ...value,
      position: value.position || value.at || fusion?.position
    };
    fusion = normalizeFusion(source, "release");
    invalidate();
    return snapshot();
  }

  function cancelFusion() {
    if (destroyed) return snapshot();
    fusion = null;
    invalidate();
    return snapshot();
  }

  function suspend() {
    if (destroyed) return snapshot();
    suspended = true;
    if (frame) cancelFrame(frame);
    frame = 0;
    return snapshot();
  }

  function resume() {
    if (destroyed) return snapshot();
    suspended = false;
    invalidate();
    return snapshot();
  }

  function destroy() {
    if (destroyed) return snapshot();
    destroyed = true;
    suspended = true;
    fusion = null;
    dirty = false;
    if (frame) cancelFrame(frame);
    frame = 0;
    context.setTransform?.(1, 0, 0, 1, 0, 0);
    context.clearRect?.(0, 0, canvas.width || 1, canvas.height || 1);
    return snapshot();
  }

  function snapshot() {
    return frozenSnapshot({
      destroyed,
      suspended,
      dirty,
      framePending: Boolean(frame),
      animating: shouldAnimate(),
      renderCount,
      metrics: { ...metrics },
      semanticBeaconCount: scene.semanticBeacons.length,
      memoryStarCount: scene.memoryStars.length,
      memoryEdgeCount: scene.memoryEdges.length,
      routeEdgeCount: scene.routeEdges.length,
      hasDisconnectedTarget: scene.targetBeacon?.disconnected === true,
      ambientAnimation: scene.ambientAnimation,
      reducedMotion: motionReduced(),
      forcedColors: colorsForced(),
      fusion: fusion ? {
        tier: fusion.tier,
        phase: fusion.phase,
        progress: fusion.progress,
        durationMs: fusion.durationMs,
        speed: fusion.speed
      } : null
    });
  }

  applySize(measure());
  invalidate();

  return Object.freeze({
    sync,
    resize,
    beginFusion,
    commitFusion,
    cancelFusion,
    invalidate,
    suspend,
    resume,
    destroy,
    snapshot
  });
}
