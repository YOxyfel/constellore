const PLAY_LAYOUT = Object.freeze({
  STACKED: "stacked",
  SHORT_LANDSCAPE: "short-landscape",
  WIDE: "wide"
});

const SURFACE_NONE = "none";
const CSS_VIEWPORT_PROPERTIES = Object.freeze([
  "--play-vv-width",
  "--play-vv-height",
  "--play-vv-offset-left",
  "--play-vv-offset-top"
]);

const noop = () => {};

function finiteNonnegative(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : Math.max(0, Number(fallback) || 0);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : (Number(fallback) || 0);
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizedOrientation(orientation, width, height) {
  if (orientation === "portrait" || orientation === "landscape") return orientation;
  return width > height ? "landscape" : "portrait";
}

/**
 * Classify the play shell from the layout viewport. Short landscape takes
 * precedence over stacked so small landscape phones keep their side shelf.
 */
export function classifyMobilePlayLayout({ width = 0, height = 0, orientation } = {}) {
  const safeWidth = finiteNonnegative(width);
  const safeHeight = finiteNonnegative(height);
  const direction = normalizedOrientation(orientation, safeWidth, safeHeight);
  if (direction === "landscape" && safeWidth <= 900 && safeHeight <= 500) {
    return PLAY_LAYOUT.SHORT_LANDSCAPE;
  }
  if (safeWidth <= 700 || (direction === "portrait" && safeWidth <= 900)) {
    return PLAY_LAYOUT.STACKED;
  }
  return PLAY_LAYOUT.WIDE;
}

function normalizeInsets(persistentInsets, boardWidth, boardHeight) {
  const source = persistentInsets && typeof persistentInsets === "object" ? persistentInsets : {};
  const left = clamp(finiteNonnegative(source.left), 0, boardWidth);
  const right = clamp(finiteNonnegative(source.right), 0, Math.max(0, boardWidth - left));
  const top = clamp(finiteNonnegative(source.top), 0, boardHeight);
  const bottom = clamp(finiteNonnegative(source.bottom), 0, Math.max(0, boardHeight - top));
  return { left, top, right, bottom };
}

function normalizeBlocker(blocker, bounds) {
  if (!blocker || typeof blocker !== "object") return null;
  const rawLeft = finiteNumber(blocker.left ?? blocker.x);
  const rawTop = finiteNumber(blocker.top ?? blocker.y);
  const rawRight = Number.isFinite(Number(blocker.right))
    ? Math.max(rawLeft, Number(blocker.right))
    : rawLeft + finiteNonnegative(blocker.width);
  const rawBottom = Number.isFinite(Number(blocker.bottom))
    ? Math.max(rawTop, Number(blocker.bottom))
    : rawTop + finiteNonnegative(blocker.height);
  const left = clamp(rawLeft, bounds.left, bounds.right);
  const top = clamp(rawTop, bounds.top, bounds.bottom);
  const right = clamp(rawRight, left, bounds.right);
  const bottom = clamp(rawBottom, top, bounds.bottom);
  if (right <= left || bottom <= top) return null;
  return {
    ...(blocker.id == null ? {} : { id: blocker.id }),
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

/**
 * Convert measured board chrome into a bounded packing area. `minimum` is
 * diagnostic only: it never expands the board or discards real insets.
 */
export function calculatePlayableBounds({
  boardWidth = 0,
  boardHeight = 0,
  persistentInsets = {},
  blockers = [],
  minimum = {}
} = {}) {
  const safeBoardWidth = finiteNonnegative(boardWidth);
  const safeBoardHeight = finiteNonnegative(boardHeight);
  const insets = normalizeInsets(persistentInsets, safeBoardWidth, safeBoardHeight);
  const left = insets.left;
  const top = insets.top;
  const right = Math.max(left, safeBoardWidth - insets.right);
  const bottom = Math.max(top, safeBoardHeight - insets.bottom);
  const width = right - left;
  const height = bottom - top;
  const minimumWidth = finiteNonnegative(minimum?.width);
  const minimumHeight = finiteNonnegative(minimum?.height);
  const playable = { left, top, right, bottom, width, height };
  const normalizedBlockers = (Array.isArray(blockers) ? blockers : [])
    .map((blocker) => normalizeBlocker(blocker, playable))
    .filter(Boolean);
  return {
    ...playable,
    insets,
    blockers: normalizedBlockers,
    minimum: { width: minimumWidth, height: minimumHeight },
    meetsMinimum: width >= minimumWidth && height >= minimumHeight
  };
}

function setAttribute(element, name, value) {
  element?.setAttribute?.(name, String(value));
}

function removeAttribute(element, name) {
  element?.removeAttribute?.(name);
}

function toggleAttribute(element, name, enabled) {
  if (!element) return;
  if (typeof element.toggleAttribute === "function") element.toggleAttribute(name, Boolean(enabled));
  else if (enabled) setAttribute(element, name, "");
  else removeAttribute(element, name);
}

function setHiddenAndInert(element, hidden, { desktop = false } = {}) {
  if (!element) return;
  element.hidden = Boolean(hidden);
  toggleAttribute(element, "hidden", hidden);
  if ("inert" in element) element.inert = Boolean(hidden);
  toggleAttribute(element, "inert", hidden);
  if (desktop) removeAttribute(element, "aria-hidden");
  else setAttribute(element, "aria-hidden", String(Boolean(hidden)));
}

function setStyleProperty(element, name, value) {
  element?.style?.setProperty?.(name, value);
}

function removeStyleProperty(element, name) {
  element?.style?.removeProperty?.(name);
}

function surfaceEntries(surfaces) {
  if (!surfaces || typeof surfaces !== "object") return new Map();
  return new Map(Object.entries(surfaces)
    .filter(([name, entry]) => name && entry && typeof entry === "object")
    .map(([name, entry]) => [String(name), {
      toggle: entry.toggle || null,
      panel: entry.panel || null,
      disclosure: entry.disclosure || null
    }]));
}

function readOrientation(windowRef, width, height, override) {
  if (override === "portrait" || override === "landscape") return override;
  try {
    if (windowRef?.matchMedia?.("(orientation: portrait)")?.matches) return "portrait";
    if (windowRef?.matchMedia?.("(orientation: landscape)")?.matches) return "landscape";
  } catch { /* Dimension comparison is the safe fallback. */ }
  return normalizedOrientation(undefined, width, height);
}

function focusElement(element, focus) {
  if (!element) return;
  try {
    focus(element);
  } catch {
    try { element.focus?.(); } catch { /* Focus restoration is best effort. */ }
  }
}

/**
 * Coordinate play disclosures and the compact inventory without owning game actions. Callers
 * supply the real controls, so their existing listeners and state stay intact.
 */
export function createMobilePlayChrome({
  root,
  windowRef = globalThis.window,
  visualViewport = windowRef?.visualViewport,
  surfaces = {},
  inventory = {},
  inventoryExpanded = false,
  focus = (element) => element?.focus?.({ preventScroll: true }),
  onChange = noop,
  onLayoutChange = noop,
  onSurfaceChange = noop,
  onInventoryChange = noop,
  onViewportChange = noop,
  onBeforeDialog = noop,
  onReset = noop
} = {}) {
  if (!root) throw new TypeError("createMobilePlayChrome requires a root element");
  const entries = surfaceEntries(surfaces);
  const inventoryToggle = inventory?.toggle || null;
  const inventoryPanel = inventory?.panel || null;
  const preserveInventoryPeek = Boolean(inventory?.preservePeekContent);
  const state = {
    layout: PLAY_LAYOUT.WIDE,
    activeSurface: null,
    inventoryExpanded: Boolean(inventoryExpanded),
    opener: null
  };
  let destroyed = false;

  const snapshot = () => Object.freeze({ ...state });
  const event = (type, details = {}) => Object.freeze({ type, ...details, state: snapshot() });
  const notify = (callback, value) => {
    callback(value);
    if (callback !== onChange) onChange(value);
  };

  const setViewportProperties = (metrics) => {
    setStyleProperty(root, "--play-vv-width", `${metrics.visualWidth}px`);
    setStyleProperty(root, "--play-vv-height", `${metrics.visualHeight}px`);
    setStyleProperty(root, "--play-vv-offset-left", `${metrics.offsetLeft}px`);
    setStyleProperty(root, "--play-vv-offset-top", `${metrics.offsetTop}px`);
  };

  const render = () => {
    const mobile = state.layout !== PLAY_LAYOUT.WIDE;
    setAttribute(root, "data-play-layout", state.layout);
    if (!root.hasAttribute?.("data-play-phase")) setAttribute(root, "data-play-phase", "normal");
    setAttribute(root, "data-mobile-surface", state.activeSurface || SURFACE_NONE);
    setAttribute(root, "data-inventory-expanded", String(state.inventoryExpanded));

    for (const [name, entry] of entries) {
      const open = state.activeSurface === name;
      setAttribute(entry.toggle, "data-mobile-surface-toggle", name);
      setAttribute(entry.toggle, "data-mobile-state", open ? "open" : "closed");
      setAttribute(entry.toggle, "aria-expanded", String(open));
      if (entry.panel?.id) setAttribute(entry.toggle, "aria-controls", entry.panel.id);
      setAttribute(entry.panel, "data-mobile-surface-panel", name);
      setAttribute(entry.panel, "data-mobile-state", open ? "open" : "closed");
      setHiddenAndInert(entry.panel, !open);
      if (entry.disclosure) entry.disclosure.open = open;
    }

    const inventoryOpen = !mobile || state.inventoryExpanded;
    setAttribute(inventoryToggle, "data-mobile-inventory-toggle", "true");
    setAttribute(inventoryToggle, "data-mobile-state", mobile ? (inventoryOpen ? "open" : "closed") : "desktop");
    setAttribute(inventoryToggle, "aria-expanded", String(inventoryOpen));
    if (inventoryPanel?.id) setAttribute(inventoryToggle, "aria-controls", inventoryPanel.id);
    setAttribute(inventoryPanel, "data-mobile-inventory-panel", "true");
    setAttribute(inventoryPanel, "data-mobile-state", mobile ? (inventoryOpen ? "open" : "closed") : "desktop");
    setHiddenAndInert(inventoryPanel, mobile && !inventoryOpen && !preserveInventoryPeek, { desktop: !mobile });
  };

  const readMetrics = (overrides = {}) => {
    const width = finiteNonnegative(overrides.width, windowRef?.innerWidth);
    const height = finiteNonnegative(overrides.height, windowRef?.innerHeight);
    const orientation = readOrientation(windowRef, width, height, overrides.orientation);
    return {
      width,
      height,
      orientation,
      visualWidth: finiteNonnegative(overrides.visualWidth, visualViewport?.width ?? width),
      visualHeight: finiteNonnegative(overrides.visualHeight, visualViewport?.height ?? height),
      offsetLeft: finiteNonnegative(overrides.offsetLeft, visualViewport?.offsetLeft),
      offsetTop: finiteNonnegative(overrides.offsetTop, visualViewport?.offsetTop)
    };
  };

  const closeSurface = ({ restoreFocus = true, reason = "close" } = {}) => {
    if (destroyed || !state.activeSurface) return snapshot();
    const previousSurface = state.activeSurface;
    const previousOpener = state.opener;
    state.activeSurface = null;
    state.opener = null;
    render();
    notify(onSurfaceChange, event("surface", {
      previous: previousSurface,
      current: null,
      reason
    }));
    if (restoreFocus) focusElement(previousOpener, focus);
    return snapshot();
  };

  const setInventoryExpanded = (expanded, { reason = "api" } = {}) => {
    if (destroyed) return snapshot();
    const next = Boolean(expanded);
    if (next && state.activeSurface) closeSurface({ restoreFocus: false, reason: "inventory" });
    if (state.inventoryExpanded === next) {
      render();
      return snapshot();
    }
    const previous = state.inventoryExpanded;
    state.inventoryExpanded = next;
    render();
    notify(onInventoryChange, event("inventory", { previous, current: next, reason }));
    return snapshot();
  };

  const toggleSurface = (name, { opener = entries.get(String(name))?.toggle || null, reason = "toggle" } = {}) => {
    if (destroyed) return snapshot();
    const key = String(name);
    if (!entries.has(key)) throw new RangeError(`Unknown mobile play surface: ${key}`);
    if (state.activeSurface === key) return closeSurface({ restoreFocus: true, reason });
    if (state.activeSurface) closeSurface({ restoreFocus: false, reason: "switch" });
    if (state.inventoryExpanded) setInventoryExpanded(false, { reason: "surface" });
    const previous = state.activeSurface;
    state.activeSurface = key;
    state.opener = opener;
    render();
    notify(onSurfaceChange, event("surface", { previous, current: key, reason }));
    return snapshot();
  };

  const syncLayout = (overrides = {}, { notifyChange = true, reason = "viewport" } = {}) => {
    if (destroyed) return snapshot();
    const metrics = readMetrics(overrides);
    const nextLayout = classifyMobilePlayLayout(metrics);
    const previousLayout = state.layout;
    if (nextLayout !== previousLayout && state.activeSurface) {
      closeSurface({ restoreFocus: false, reason: "layout" });
    }
    state.layout = nextLayout;
    setViewportProperties(metrics);
    render();
    if (notifyChange && nextLayout !== previousLayout) {
      notify(onLayoutChange, event("layout", {
        previous: previousLayout,
        current: nextLayout,
        reason,
        metrics: Object.freeze({ ...metrics })
      }));
    }
    if (notifyChange) {
      notify(onViewportChange, event("viewport", {
        reason,
        metrics: Object.freeze({ ...metrics })
      }));
    }
    return snapshot();
  };

  const beforeDialog = ({ collapseInventory = true } = {}) => {
    if (destroyed) return snapshot();
    closeSurface({ restoreFocus: false, reason: "dialog" });
    if (collapseInventory) setInventoryExpanded(false, { reason: "dialog" });
    const current = snapshot();
    notify(onBeforeDialog, event("before-dialog"));
    return current;
  };

  const reset = ({ collapseInventory = true, restoreFocus = false, reason = "reset" } = {}) => {
    if (destroyed) return snapshot();
    closeSurface({ restoreFocus, reason });
    if (collapseInventory) setInventoryExpanded(false, { reason });
    state.opener = null;
    render();
    const current = snapshot();
    notify(onReset, event("reset", { reason }));
    return current;
  };

  const handleWindowViewportChange = () => syncLayout({}, { reason: "window" });
  const handleVisualViewportChange = () => syncLayout({}, { reason: "visual-viewport" });
  windowRef?.addEventListener?.("resize", handleWindowViewportChange);
  windowRef?.addEventListener?.("orientationchange", handleWindowViewportChange);
  visualViewport?.addEventListener?.("resize", handleVisualViewportChange);
  visualViewport?.addEventListener?.("scroll", handleVisualViewportChange);

  syncLayout({}, { notifyChange: false, reason: "initial" });

  const destroy = () => {
    if (destroyed) return;
    windowRef?.removeEventListener?.("resize", handleWindowViewportChange);
    windowRef?.removeEventListener?.("orientationchange", handleWindowViewportChange);
    visualViewport?.removeEventListener?.("resize", handleVisualViewportChange);
    visualViewport?.removeEventListener?.("scroll", handleVisualViewportChange);
    destroyed = true;
    state.activeSurface = null;
    state.opener = null;
    for (const entry of entries.values()) {
      setHiddenAndInert(entry.panel, false, { desktop: true });
      if (entry.disclosure) entry.disclosure.open = false;
      for (const element of [entry.toggle, entry.panel]) {
        removeAttribute(element, "aria-expanded");
        removeAttribute(element, "data-mobile-state");
        removeAttribute(element, "data-mobile-surface-toggle");
        removeAttribute(element, "data-mobile-surface-panel");
      }
    }
    setHiddenAndInert(inventoryPanel, false, { desktop: true });
    for (const element of [inventoryToggle, inventoryPanel]) {
      removeAttribute(element, "aria-expanded");
      removeAttribute(element, "data-mobile-state");
      removeAttribute(element, "data-mobile-inventory-toggle");
      removeAttribute(element, "data-mobile-inventory-panel");
    }
    removeAttribute(root, "data-play-layout");
    removeAttribute(root, "data-mobile-surface");
    removeAttribute(root, "data-inventory-expanded");
    CSS_VIEWPORT_PROPERTIES.forEach((property) => removeStyleProperty(root, property));
  };

  return Object.freeze({
    get state() { return snapshot(); },
    toggleSurface,
    closeSurface,
    setInventoryExpanded,
    beforeDialog,
    syncLayout,
    reset,
    destroy
  });
}

export { PLAY_LAYOUT as MOBILE_PLAY_LAYOUT };
