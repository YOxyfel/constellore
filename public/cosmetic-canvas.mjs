import { cosmeticTrailStyle } from "./cosmetic-economy.mjs?v=5.0.0-beta.4";

const clampValue = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function beginCosmeticDragTrail(state) {
  state.dragTrailSamples = [];
}

export function recordCosmeticDragTrail(state, moveEvent, board) {
  const styles = getComputedStyle(document.body);
  const enabled = Number.parseFloat(styles.getPropertyValue("--cosmetic-trail-enabled")) !== 0;
  const cap = clampValue(Number.parseInt(styles.getPropertyValue("--cosmetic-trail-sample-cap"), 10) || 40, 0, 48);
  if (!enabled || !cap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const boardRect = board.getBoundingClientRect();
  const coalesced = typeof moveEvent.getCoalescedEvents === "function"
    ? moveEvent.getCoalescedEvents()
    : [];
  const samples = coalesced.length ? coalesced : [moveEvent];
  const now = performance.now();
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const x = sample.clientX - boardRect.left;
    const y = sample.clientY - boardRect.top;
    if (x < -24 || y < -24 || x > boardRect.width + 24 || y > boardRect.height + 24) continue;
    const previous = state.dragTrailSamples.at(-1);
    if (previous && Math.hypot(x - previous.x, y - previous.y) < 2.5) continue;
    state.dragTrailSamples.push({
      x,
      y,
      at: now - (samples.length - index - 1) * 2
    });
  }
  if (state.dragTrailSamples.length > cap) {
    state.dragTrailSamples.splice(0, state.dragTrailSamples.length - cap);
  }
}

export function queueCosmeticFusionBurst(state, x, y) {
  if (document.body.dataset.cosmeticEffects === "off") return;
  state.fusionBursts.push({ x, y, at: performance.now() });
  if (state.fusionBursts.length > 12) state.fusionBursts.splice(0, state.fusionBursts.length - 12);
}

export function measuredNodeAnchor(node, element, fallback = { width: 88, height: 40 }) {
  const width = element?.offsetWidth || fallback.width;
  const height = element?.offsetHeight || fallback.height;
  return { x: node.x + width / 2, y: node.y + height / 2 };
}

function seeded(value) {
  const x = Math.sin(value * 999.91) * 43758.5453;
  return x - Math.floor(x);
}

function cosmeticCanvasRecipe(loadout) {
  const fallback = cosmeticTrailStyle(loadout);
  const styles = getComputedStyle(document.body);
  const number = (property, value) => {
    const parsed = Number.parseFloat(styles.getPropertyValue(property));
    return Number.isFinite(parsed) ? parsed : value;
  };
  const color = (property, value) => styles.getPropertyValue(property).trim() || value;
  return {
    ...fallback,
    dragColor: color("--cosmetic-trail-drag-color", fallback.color),
    dragSecondary: color("--cosmetic-trail-drag-secondary", fallback.secondary),
    connectionColor: color("--cosmetic-trail-connection-color", fallback.color),
    connectionSecondary: color("--cosmetic-trail-connection-secondary", fallback.secondary),
    burstColor: color("--cosmetic-trail-burst-color", fallback.color),
    burstSecondary: color("--cosmetic-trail-burst-secondary", fallback.secondary),
    dragWidth: number("--cosmetic-trail-drag-width", fallback.width),
    connectionWidth: number("--cosmetic-trail-connection-width", Math.max(1, fallback.width * .65)),
    glow: number("--cosmetic-trail-glow", fallback.glow),
    dragLifetimeMs: number("--cosmetic-trail-drag-duration", fallback.dragLifetimeMs),
    burstLifetimeMs: number("--cosmetic-trail-burst-duration", 680),
    enabled: number("--cosmetic-trail-enabled", 1) !== 0
  };
}

export function startCosmosCanvas({
  state,
  gameScreen,
  board,
  canvas,
  cosmeticLoadout,
  getBoardCamera = () => ({ x: 0, y: 0, zoom: 1 }),
  drawRevealGraph
}) {
  cancelAnimationFrame(state.cosmosFrame);
  if (gameScreen.hidden) return;
  const rect = board.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  const count = Math.min(150, Math.max(55, Math.floor(rect.width * rect.height / 7500)));
  state.stars = Array.from({ length: count }, (_, index) => ({
    x: seeded(index * 17 + 3) * rect.width,
    y: seeded(index * 31 + 7) * rect.height,
    r: .35 + seeded(index * 47 + 11) * 1.25,
    alpha: .22 + seeded(index * 61 + 13) * .65,
    phase: seeded(index * 73 + 19) * Math.PI * 2
  }));
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const strongerContrast = matchMedia("(prefers-contrast: more)").matches;
  const forcedColors = matchMedia("(forced-colors: active)").matches;
  const accent = getComputedStyle(document.body).getPropertyValue("--violet").trim() || "#aa8cff";
  const cyan = getComputedStyle(document.body).getPropertyValue("--cyan").trim() || "#69e6ff";
  const trailStyle = cosmeticCanvasRecipe(cosmeticLoadout);
  const draw = (time = 0) => {
    if (gameScreen.hidden) return;
    const frameTime = time || performance.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(ratio, ratio);
    for (const star of state.stars) {
      const pulse = reduced ? 1 : .78 + Math.sin(time * .0007 + star.phase) * .22;
      ctx.globalAlpha = star.alpha * pulse;
      ctx.fillStyle = star.r > 1.2 ? accent : "#ffffff";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const connectionColor = forcedColors ? "#ffffff" : trailStyle.connectionColor;
    const connectionSecondary = forcedColors ? "#ffffff" : trailStyle.connectionSecondary;
    const camera = getBoardCamera?.() || { x: 0, y: 0, zoom: 1 };
    const project = (x, y) => ({
      x: x * (Number(camera.zoom) || 1) + (Number(camera.x) || 0),
      y: y * (Number(camera.zoom) || 1) + (Number(camera.y) || 0)
    });
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = trailStyle.enabled && !forcedColors ? trailStyle.glow : 0;
    ctx.lineWidth = strongerContrast || forcedColors
      ? Math.max(2.5, trailStyle.connectionWidth)
      : trailStyle.connectionWidth;
    for (let trailIndex = 0; trailIndex < state.trails.length; trailIndex += 1) {
      const trail = state.trails[trailIndex];
      const a = project(trail.ax, trail.ay);
      const b = project(trail.bx, trail.by);
      const result = project(trail.x, trail.y);
      const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      gradient.addColorStop(0, connectionColor);
      gradient.addColorStop(.5, connectionSecondary);
      gradient.addColorStop(1, connectionColor);
      ctx.strokeStyle = gradient;
      ctx.shadowColor = connectionSecondary;
      ctx.globalAlpha = strongerContrast || forcedColors ? .72 : trailStyle.enabled ? .34 : .24;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(result.x, result.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = connectionSecondary;
      ctx.globalAlpha = strongerContrast || forcedColors ? .9 : .7;
      ctx.beginPath();
      ctx.arc(result.x, result.y, strongerContrast || forcedColors ? 2.5 : 1.75, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (trailStyle.enabled && !reduced && trailStyle.dragLifetimeMs > 0) {
      state.dragTrailSamples = state.dragTrailSamples.filter((sample) =>
        frameTime - sample.at <= trailStyle.dragLifetimeMs
      );
      ctx.save();
      ctx.lineCap = "round";
      ctx.shadowBlur = forcedColors ? 0 : trailStyle.glow;
      for (let index = 1; index < state.dragTrailSamples.length; index += 1) {
        const previous = state.dragTrailSamples[index - 1];
        const sample = state.dragTrailSamples[index];
        const age = Math.max(0, frameTime - sample.at);
        const life = Math.max(0, 1 - age / trailStyle.dragLifetimeMs);
        if (life <= 0) continue;
        const color = forcedColors
          ? "#ffffff"
          : index % 2
            ? trailStyle.dragColor
            : trailStyle.dragSecondary;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.globalAlpha = (strongerContrast || forcedColors ? .9 : .68) * life;
        ctx.lineWidth = Math.max(
          strongerContrast || forcedColors ? 2.5 : .8,
          trailStyle.dragWidth * (.45 + life * .55)
        );
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(sample.x, sample.y);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      state.dragTrailSamples = [];
    }

    if (trailStyle.enabled && !reduced && trailStyle.burstLifetimeMs > 0) {
      state.fusionBursts = state.fusionBursts.filter((burst) =>
        frameTime - burst.at <= trailStyle.burstLifetimeMs
      );
      ctx.save();
      ctx.lineCap = "round";
      for (const burst of state.fusionBursts) {
        const projectedBurst = project(burst.x, burst.y);
        const age = Math.max(0, frameTime - burst.at);
        const life = Math.max(0, 1 - age / trailStyle.burstLifetimeMs);
        const radius = 5 + (1 - life) * 24;
        ctx.globalAlpha = life * (strongerContrast || forcedColors ? .95 : .78);
        ctx.lineWidth = strongerContrast || forcedColors ? 2.5 : 1.4;
        ctx.shadowBlur = forcedColors ? 0 : trailStyle.glow;
        for (let ray = 0; ray < 8; ray += 1) {
          const angle = ray * Math.PI / 4;
          const color = forcedColors
            ? "#ffffff"
            : ray % 2
              ? trailStyle.burstColor
              : trailStyle.burstSecondary;
          ctx.strokeStyle = color;
          ctx.shadowColor = color;
          ctx.beginPath();
          ctx.moveTo(
            projectedBurst.x + Math.cos(angle) * radius * .35,
            projectedBurst.y + Math.sin(angle) * radius * .35
          );
          ctx.lineTo(
            projectedBurst.x + Math.cos(angle) * radius,
            projectedBurst.y + Math.sin(angle) * radius
          );
          ctx.stroke();
        }
      }
      ctx.restore();
    } else {
      state.fusionBursts = [];
    }

    const revealVisual = state.reveal.visual;
    const revealLayout = revealVisual?.layout || state.reveal.layout;
    drawRevealGraph(ctx, {
      visual: revealVisual,
      layout: revealLayout,
      nodes: state.nodes,
      completedSteps: state.reveal.completedSteps,
      paused: state.reveal.paused,
      pausedAt: state.reveal.pausedAt,
      time,
      speed: state.reveal.speed,
      reduced,
      strongerContrast,
      accent,
      cyan
    });
    ctx.restore();
    if (!reduced) state.cosmosFrame = requestAnimationFrame(draw);
  };
  draw();
  return Object.freeze({
    invalidate() {
      if (reduced) draw(performance.now());
    }
  });
}
