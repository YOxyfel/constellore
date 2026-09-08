export const HERO_RECIPE_INTERVAL_MS = 4_800;
export const DAILY_STAR_MAX_FRAME_MS = 48;
export const DAILY_STAR_EDGE_MARGIN = 14;
export const DAILY_STAR_OBSTACLE_GAP = 10;

export const DAILY_STAR_OBSTACLE_SELECTORS = Object.freeze([
  ".start-nav",
  ".home-orbit__rail",
  ".home-orbit__arrow:not(:disabled)",
  ".hero-kicker",
  "#startTitle",
  ".hero-promise",
  "#heroRecipeExample",
  ".primary-orbit-panel",
  ".home-forge-catalog-toggle:not([hidden])",
  ".universe-summary:not([hidden])",
  "#scramblePortal",
  "#modePicker:not([hidden])",
  "#exploreHub:not([hidden])",
  ".cosmos-circuit-home:not([hidden])"
]);

export const HERO_RECIPES = Object.freeze([
  Object.freeze({ a: "Earth", aEmoji: "🌍", b: "Water", bEmoji: "💧", result: "Mud", resultEmoji: "🟤" }),
  Object.freeze({ a: "Fire", aEmoji: "🔥", b: "Water", bEmoji: "💧", result: "Steam", resultEmoji: "♨️" }),
  Object.freeze({ a: "Species", aEmoji: "🧬", b: "Air", bEmoji: "💨", result: "Bird", resultEmoji: "🐦" }),
  Object.freeze({ a: "Brick", aEmoji: "🧱", b: "Brick", bEmoji: "🧱", result: "Wall", resultEmoji: "🧱" }),
  Object.freeze({ a: "Fire", aEmoji: "🔥", b: "Sand", bEmoji: "🏖️", result: "Glass", resultEmoji: "🪟" }),
  Object.freeze({ a: "Light", aEmoji: "✨", b: "Rain", bEmoji: "🌧️", result: "Rainbow", resultEmoji: "🌈" })
]);

export function heroRecipeLabel(recipe) {
  return `Example: ${recipe.a} plus ${recipe.b} makes ${recipe.result}`;
}

export function nextHeroRecipeIndex(index, count = HERO_RECIPES.length) {
  return count > 0 ? (Math.max(0, Number(index) || 0) + 1) % count : 0;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function motionRect(x, y, size) {
  return {
    left: x,
    top: y,
    right: x + size.width,
    bottom: y + size.height,
    width: size.width,
    height: size.height
  };
}

function motionLimits(bounds, size) {
  const left = finiteNumber(bounds?.left);
  const top = finiteNumber(bounds?.top);
  return {
    minX: left,
    minY: top,
    maxX: Math.max(left, finiteNumber(bounds?.right, left) - size.width),
    maxY: Math.max(top, finiteNumber(bounds?.bottom, top) - size.height)
  };
}

export function dailyStarRectsOverlap(a, b, gap = 0) {
  const padding = Math.max(0, finiteNumber(gap));
  return Boolean(a && b)
    && finiteNumber(a.left) < finiteNumber(b.right) + padding
    && finiteNumber(a.right) > finiteNumber(b.left) - padding
    && finiteNumber(a.top) < finiteNumber(b.bottom) + padding
    && finiteNumber(a.bottom) > finiteNumber(b.top) - padding;
}

export function findDailyStarPosition({
  size,
  bounds,
  obstacles = [],
  preferred = null,
  gap = DAILY_STAR_OBSTACLE_GAP
} = {}) {
  const safeSize = {
    width: Math.max(1, finiteNumber(size?.width, 1)),
    height: Math.max(1, finiteNumber(size?.height, 1))
  };
  const limits = motionLimits(bounds, safeSize);
  const fallback = {
    x: clamp(finiteNumber(preferred?.x, limits.minX), limits.minX, limits.maxX),
    y: clamp(finiteNumber(preferred?.y, limits.minY), limits.minY, limits.maxY)
  };
  const isFree = ({ x, y }) => {
    const candidate = motionRect(x, y, safeSize);
    return obstacles.every((obstacle) => !dailyStarRectsOverlap(candidate, obstacle, gap));
  };
  if (isFree(fallback)) return fallback;

  const candidates = [
    { x: limits.minX, y: limits.minY },
    { x: limits.maxX, y: limits.minY },
    { x: limits.minX, y: limits.maxY },
    { x: limits.maxX, y: limits.maxY },
    { x: (limits.minX + limits.maxX) / 2, y: limits.minY },
    { x: (limits.minX + limits.maxX) / 2, y: limits.maxY },
    { x: limits.minX, y: (limits.minY + limits.maxY) / 2 },
    { x: limits.maxX, y: (limits.minY + limits.maxY) / 2 }
  ];
  const scanStep = Math.max(12, Math.min(safeSize.width, safeSize.height) / 3);
  for (let y = limits.minY; y <= limits.maxY + .5; y += scanStep) {
    for (let x = limits.minX; x <= limits.maxX + .5; x += scanStep) {
      candidates.push({ x: Math.min(x, limits.maxX), y: Math.min(y, limits.maxY) });
    }
  }
  candidates.sort((a, b) => (
    ((a.x - fallback.x) ** 2) + ((a.y - fallback.y) ** 2)
    - ((b.x - fallback.x) ** 2) - ((b.y - fallback.y) ** 2)
  ));
  return candidates.find(isFree) || null;
}

export function advanceDailyStarMotion(
  state,
  {
    size,
    bounds,
    obstacles = [],
    gap = DAILY_STAR_OBSTACLE_GAP
  } = {},
  elapsedMs = 0
) {
  const safeSize = {
    width: Math.max(1, finiteNumber(size?.width, 1)),
    height: Math.max(1, finiteNumber(size?.height, 1))
  };
  const limits = motionLimits(bounds, safeSize);
  const seconds = clamp(finiteNumber(elapsedMs), 0, DAILY_STAR_MAX_FRAME_MS) / 1_000;
  let x = clamp(finiteNumber(state?.x, limits.minX), limits.minX, limits.maxX);
  let y = clamp(finiteNumber(state?.y, limits.minY), limits.minY, limits.maxY);
  let vx = finiteNumber(state?.vx, 38);
  let vy = finiteNumber(state?.vy, 27);

  let nextX = x + (vx * seconds);
  if (nextX < limits.minX) {
    nextX = limits.minX + (limits.minX - nextX);
    vx = Math.abs(vx);
  } else if (nextX > limits.maxX) {
    nextX = limits.maxX - (nextX - limits.maxX);
    vx = -Math.abs(vx);
  }
  nextX = clamp(nextX, limits.minX, limits.maxX);
  for (const obstacle of obstacles) {
    if (!dailyStarRectsOverlap(motionRect(nextX, y, safeSize), obstacle, gap)) continue;
    nextX = vx >= 0
      ? finiteNumber(obstacle.left) - gap - safeSize.width
      : finiteNumber(obstacle.right) + gap;
    vx = vx >= 0 ? -Math.abs(vx) : Math.abs(vx);
    nextX = clamp(nextX, limits.minX, limits.maxX);
  }
  x = nextX;

  let nextY = y + (vy * seconds);
  if (nextY < limits.minY) {
    nextY = limits.minY + (limits.minY - nextY);
    vy = Math.abs(vy);
  } else if (nextY > limits.maxY) {
    nextY = limits.maxY - (nextY - limits.maxY);
    vy = -Math.abs(vy);
  }
  nextY = clamp(nextY, limits.minY, limits.maxY);
  for (const obstacle of obstacles) {
    if (!dailyStarRectsOverlap(motionRect(x, nextY, safeSize), obstacle, gap)) continue;
    nextY = vy >= 0
      ? finiteNumber(obstacle.top) - gap - safeSize.height
      : finiteNumber(obstacle.bottom) + gap;
    vy = vy >= 0 ? -Math.abs(vy) : Math.abs(vy);
    nextY = clamp(nextY, limits.minY, limits.maxY);
  }
  y = nextY;

  return { x, y, vx, vy };
}

export function renderHeroRecipe(root, recipe) {
  if (!root || !recipe) return false;
  const fields = {
    a: recipe.a.toUpperCase(),
    "a-emoji": recipe.aEmoji,
    b: recipe.b.toUpperCase(),
    "b-emoji": recipe.bEmoji,
    result: recipe.result.toUpperCase(),
    "result-emoji": recipe.resultEmoji
  };
  for (const [field, value] of Object.entries(fields)) {
    const node = root.querySelector(`[data-hero-recipe="${field}"]`);
    if (!node) return false;
    node.textContent = value;
  }
  root.setAttribute("aria-label", heroRecipeLabel(recipe));
  return true;
}

export function createHeroRecipeRotator({
  root = globalThis.document?.querySelector("#heroRecipeExample"),
  recipes = HERO_RECIPES,
  intervalMs = HERO_RECIPE_INTERVAL_MS,
  documentRef = globalThis.document,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval
} = {}) {
  if (!root || recipes.length < 2 || typeof setIntervalFn !== "function") {
    return Object.freeze({ stop() {} });
  }

  let index = 0;
  let cycle = 0;
  let timer = null;

  const advance = () => {
    if (documentRef?.hidden) return;
    index = nextHeroRecipeIndex(index, recipes.length);
    cycle += 1;
    renderHeroRecipe(root, recipes[index]);
    root.dataset.cycle = cycle % 2 ? "odd" : "even";
  };
  const start = () => {
    if (timer === null) timer = setIntervalFn(advance, intervalMs);
  };
  const pause = () => {
    if (timer !== null && typeof clearIntervalFn === "function") clearIntervalFn(timer);
    timer = null;
  };
  const onVisibilityChange = () => {
    if (documentRef?.hidden) pause();
    else start();
  };

  documentRef?.addEventListener?.("visibilitychange", onVisibilityChange);
  start();

  return Object.freeze({
    advance,
    stop() {
      pause();
      documentRef?.removeEventListener?.("visibilitychange", onVisibilityChange);
    }
  });
}

export function createDailyStarMotion({
  launcher = globalThis.document?.querySelector?.("#dailyStarButton"),
  surface = globalThis.document?.querySelector?.("#startScreen"),
  obstacleSelectors = DAILY_STAR_OBSTACLE_SELECTORS,
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  requestAnimationFrameFn = globalThis.window?.requestAnimationFrame?.bind(globalThis.window),
  cancelAnimationFrameFn = globalThis.window?.cancelAnimationFrame?.bind(globalThis.window),
  matchMediaFn = globalThis.window?.matchMedia?.bind(globalThis.window)
} = {}) {
  if (!launcher || !surface || !documentRef || !windowRef || typeof requestAnimationFrameFn !== "function") {
    return Object.freeze({ refresh() {}, stop() {} });
  }

  const reducedMotion = typeof matchMediaFn === "function"
    ? matchMediaFn("(prefers-reduced-motion: reduce)")
    : null;
  const guidedHome = typeof matchMediaFn === "function"
    ? matchMediaFn("(max-width: 900px)")
    : null;
  const body = documentRef.body;
  const visualViewport = windowRef.visualViewport;
  const MutationObserverCtor = windowRef.MutationObserver || globalThis.MutationObserver;
  const launcherHome = {
    parent: launcher.parentNode,
    nextSibling: launcher.nextSibling
  };
  const roamingHost = surface.querySelector?.("[data-home-orbit]") || surface;
  const state = {
    position: null,
    size: null,
    geometry: null,
    roaming: false,
    guided: false,
    hovered: false,
    focused: false,
    pressed: false,
    frame: null,
    lastFrameAt: null,
    geometryMeasuredAt: 0,
    geometryDirty: true
  };

  const effectsBlockMotion = () => ["reduced", "off"].includes(body?.dataset?.cosmeticEffects);
  const visible = () => !launcher.hidden
    && !launcher.disabled
    && !surface.hidden
    && !documentRef.hidden;
  const motionAllowed = () => visible()
    && !reducedMotion?.matches
    && !effectsBlockMotion();
  const eligible = () => motionAllowed() && !guidedHome?.matches;
  const temporarilyPaused = () => state.hovered
    || state.focused
    || state.pressed
    || Boolean(documentRef.querySelector?.("dialog[open]"));

  const viewportBounds = () => {
    const offsetLeft = Math.max(0, finiteNumber(visualViewport?.offsetLeft));
    const offsetTop = Math.max(0, finiteNumber(visualViewport?.offsetTop));
    const width = Math.max(1, finiteNumber(
      visualViewport?.width,
      finiteNumber(windowRef.innerWidth, documentRef.documentElement?.clientWidth)
    ));
    const height = Math.max(1, finiteNumber(
      visualViewport?.height,
      finiteNumber(windowRef.innerHeight, documentRef.documentElement?.clientHeight)
    ));
    return {
      left: offsetLeft + DAILY_STAR_EDGE_MARGIN,
      top: offsetTop + DAILY_STAR_EDGE_MARGIN,
      right: offsetLeft + width - DAILY_STAR_EDGE_MARGIN,
      bottom: offsetTop + height - DAILY_STAR_EDGE_MARGIN
    };
  };

  const readObstacles = (bounds) => {
    const nodes = new Set();
    for (const selector of obstacleSelectors) {
      for (const node of documentRef.querySelectorAll?.(`#startScreen ${selector}`) || []) {
        if (node !== launcher) nodes.add(node);
      }
    }
    return [...nodes].map((node) => node.getBoundingClientRect())
      .filter((rect) => rect.width > 0
        && rect.height > 0
        && rect.right > bounds.left
        && rect.left < bounds.right
        && rect.bottom > bounds.top
        && rect.top < bounds.bottom)
      .map((rect) => ({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      }));
  };

  const writePosition = () => {
    if (!state.position) return;
    launcher.style.setProperty("--daily-star-x", `${state.position.x.toFixed(2)}px`);
    launcher.style.setProperty("--daily-star-y", `${state.position.y.toFixed(2)}px`);
    const tailAngle = (Math.atan2(state.position.vy, state.position.vx) * 180 / Math.PI) + 180;
    launcher.style.setProperty("--daily-star-tail-angle", `${tailAngle.toFixed(1)}deg`);
  };

  const clearPosition = () => {
    launcher.style.removeProperty("--daily-star-x");
    launcher.style.removeProperty("--daily-star-y");
    launcher.style.removeProperty("--daily-star-tail-angle");
  };

  const restoreLauncherHome = () => {
    if (!launcherHome.parent || launcher.parentNode === launcherHome.parent) return;
    launcherHome.parent.insertBefore(launcher, launcherHome.nextSibling?.parentNode === launcherHome.parent
      ? launcherHome.nextSibling
      : null);
  };

  const portalLauncherForRoaming = () => {
    if (roamingHost && launcher.parentNode !== roamingHost) roamingHost.append?.(launcher);
  };

  const schedule = () => {
    if (state.frame === null && state.roaming) state.frame = requestAnimationFrameFn(tick);
  };

  const deactivate = () => {
    if (state.frame !== null && typeof cancelAnimationFrameFn === "function") cancelAnimationFrameFn(state.frame);
    state.frame = null;
    state.lastFrameAt = null;
    state.position = null;
    state.geometry = null;
    state.roaming = false;
    state.guided = false;
    launcher.classList.remove("is-roaming", "is-guided", "is-motion-paused");
    body?.classList?.remove("daily-star-roaming");
    launcher.dataset.motion = "docked";
    clearPosition();
    restoreLauncherHome();
  };

  const guide = () => {
    if (state.frame !== null && typeof cancelAnimationFrameFn === "function") cancelAnimationFrameFn(state.frame);
    state.frame = null;
    state.lastFrameAt = null;
    state.position = null;
    state.geometry = null;
    state.roaming = false;
    state.guided = true;
    launcher.classList.remove("is-roaming", "is-motion-paused");
    launcher.classList.add("is-guided");
    body?.classList?.remove("daily-star-roaming");
    launcher.dataset.motion = motionAllowed() ? "guided" : "docked";
    clearPosition();
    restoreLauncherHome();
  };

  const measureGeometry = (preferred = state.position) => {
    if (!state.size) return false;
    const bounds = viewportBounds();
    const obstacles = readObstacles(bounds);
    const freePosition = findDailyStarPosition({
      size: state.size,
      bounds,
      obstacles,
      preferred
    });
    if (!freePosition) return false;
    state.geometry = { size: state.size, bounds, obstacles };
    state.position = {
      x: freePosition.x,
      y: freePosition.y,
      vx: finiteNumber(state.position?.vx, 42),
      vy: finiteNumber(state.position?.vy, 29)
    };
    state.geometryDirty = false;
    writePosition();
    return true;
  };

  const activate = () => {
    if (!eligible() || state.roaming) return state.roaming;
    const anchored = launcher.getBoundingClientRect();
    state.size = {
      width: Math.max(1, anchored.width),
      height: Math.max(1, anchored.height)
    };
    state.guided = false;
    portalLauncherForRoaming();
    launcher.classList.remove("is-guided");
    launcher.classList.add("is-roaming");
    body?.classList?.add("daily-star-roaming");
    state.roaming = true;
    const shortestEdge = Math.min(
      finiteNumber(visualViewport?.width, windowRef.innerWidth),
      finiteNumber(visualViewport?.height, windowRef.innerHeight)
    );
    const speed = clamp(shortestEdge * .065, 34, 52);
    state.position = {
      x: anchored.left,
      y: anchored.top,
      vx: speed * .82,
      vy: speed * .57
    };
    if (!measureGeometry(state.position)) {
      deactivate();
      return false;
    }
    launcher.dataset.motion = "roaming";
    schedule();
    return true;
  };

  function tick(timestamp) {
    state.frame = null;
    if (!eligible()) {
      deactivate();
      return;
    }
    if (!state.roaming && !activate()) return;
    // A resize can invalidate the safe track while the player is already
    // hovering/pressing the star. Re-measure before honoring the interaction
    // pause so the frozen target can never remain over newly positioned UI.
    if (state.geometryDirty || timestamp - state.geometryMeasuredAt > 240) {
      if (!measureGeometry()) {
        deactivate();
        return;
      }
      state.geometryMeasuredAt = timestamp;
    }
    const paused = temporarilyPaused();
    launcher.classList.toggle("is-motion-paused", paused);
    if (paused) {
      state.lastFrameAt = timestamp;
      schedule();
      return;
    }
    if (state.lastFrameAt !== null) {
      state.position = advanceDailyStarMotion(
        state.position,
        state.geometry,
        timestamp - state.lastFrameAt
      );
      writePosition();
    }
    state.lastFrameAt = timestamp;
    schedule();
  }

  const sync = () => {
    if (!visible()) {
      deactivate();
      return;
    }
    if (guidedHome?.matches) {
      guide();
      return;
    }
    if (!motionAllowed()) {
      deactivate();
      return;
    }
    if (!state.roaming) activate();
    else schedule();
  };
  const refresh = () => {
    state.geometryDirty = true;
    sync();
  };
  const onPointerEnter = () => { state.hovered = true; };
  const onPointerLeave = () => { state.hovered = false; };
  const onPointerDown = () => { state.pressed = true; };
  const onPointerUp = () => { state.pressed = false; };
  const onFocus = () => { state.focused = true; };
  const onBlur = () => { state.focused = false; };
  const onVisibilityChange = () => sync();

  launcher.addEventListener("pointerenter", onPointerEnter);
  launcher.addEventListener("pointerleave", onPointerLeave);
  launcher.addEventListener("pointerdown", onPointerDown);
  launcher.addEventListener("pointerup", onPointerUp);
  launcher.addEventListener("pointercancel", onPointerUp);
  launcher.addEventListener("focus", onFocus);
  launcher.addEventListener("blur", onBlur);
  windowRef.addEventListener("resize", refresh);
  windowRef.addEventListener("orientationchange", refresh);
  windowRef.addEventListener("scroll", refresh, { passive: true });
  visualViewport?.addEventListener?.("resize", refresh);
  visualViewport?.addEventListener?.("scroll", refresh);
  documentRef.addEventListener("visibilitychange", onVisibilityChange);
  reducedMotion?.addEventListener?.("change", sync);
  guidedHome?.addEventListener?.("change", sync);

  const observers = [];
  if (typeof MutationObserverCtor === "function") {
    const eligibilityObserver = new MutationObserverCtor(sync);
    eligibilityObserver.observe(launcher, { attributes: true, attributeFilter: ["hidden", "disabled"] });
    eligibilityObserver.observe(surface, { attributes: true, attributeFilter: ["hidden"] });
    if (body) eligibilityObserver.observe(body, { attributes: true, attributeFilter: ["data-cosmetic-effects"] });
    observers.push(eligibilityObserver);
  }
  sync();

  return Object.freeze({
    refresh,
    stop() {
      deactivate();
      for (const observer of observers) observer.disconnect();
      launcher.removeEventListener("pointerenter", onPointerEnter);
      launcher.removeEventListener("pointerleave", onPointerLeave);
      launcher.removeEventListener("pointerdown", onPointerDown);
      launcher.removeEventListener("pointerup", onPointerUp);
      launcher.removeEventListener("pointercancel", onPointerUp);
      launcher.removeEventListener("focus", onFocus);
      launcher.removeEventListener("blur", onBlur);
      windowRef.removeEventListener("resize", refresh);
      windowRef.removeEventListener("orientationchange", refresh);
      windowRef.removeEventListener("scroll", refresh);
      visualViewport?.removeEventListener?.("resize", refresh);
      visualViewport?.removeEventListener?.("scroll", refresh);
      documentRef.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion?.removeEventListener?.("change", sync);
      guidedHome?.removeEventListener?.("change", sync);
    }
  });
}

if (globalThis.document) {
  createHeroRecipeRotator();
  createDailyStarMotion();
}
