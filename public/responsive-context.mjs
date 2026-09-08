export const UI_LAYOUT = Object.freeze({
  STACKED: "stacked",
  SHORT_LANDSCAPE: "short-landscape",
  WIDE: "wide"
});

export const UI_DENSITY = Object.freeze({
  COMPACT_HEIGHT: "compact-height",
  REGULAR: "regular"
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : Math.max(0, Number(fallback) || 0);
}

function orientationFor(width, height, orientation) {
  if (orientation === "portrait" || orientation === "landscape") return orientation;
  return width > height ? "landscape" : "portrait";
}

export function classifyResponsiveContext({ width = 0, height = 0, orientation } = {}) {
  const safeWidth = finite(width);
  const safeHeight = finite(height);
  const direction = orientationFor(safeWidth, safeHeight, orientation);
  const layout = direction === "landscape" && safeWidth <= 900 && safeHeight <= 500
    ? UI_LAYOUT.SHORT_LANDSCAPE
    : safeWidth <= 700 || (direction === "portrait" && safeWidth <= 900)
      ? UI_LAYOUT.STACKED
      : UI_LAYOUT.WIDE;
  return Object.freeze({
    width: safeWidth,
    height: safeHeight,
    orientation: direction,
    layout,
    density: safeHeight < 700 ? UI_DENSITY.COMPACT_HEIGHT : UI_DENSITY.REGULAR
  });
}

export function classifyHomeLayout(context = {}) {
  const resolved = context.layout ? context : classifyResponsiveContext(context);
  if (resolved.layout === UI_LAYOUT.STACKED) return "stacked";
  if (
    resolved.layout === UI_LAYOUT.SHORT_LANDSCAPE
    || resolved.width < 1180
    || resolved.height < 700
  ) return "compact";
  return "observatory";
}

function safeInsets(documentRef) {
  const probe = documentRef?.createElement?.("div");
  if (!probe || !documentRef?.documentElement) return Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });
  probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  documentRef.documentElement.append(probe);
  const style = documentRef.defaultView?.getComputedStyle?.(probe);
  const read = (value) => finite(String(value || "").replace("px", ""));
  const insets = Object.freeze({
    top: read(style?.paddingTop),
    right: read(style?.paddingRight),
    bottom: read(style?.paddingBottom),
    left: read(style?.paddingLeft)
  });
  probe.remove();
  return insets;
}

export function createResponsiveContext({
  documentRef = globalThis.document,
  windowRef = documentRef?.defaultView || globalThis.window,
  onChange = () => {}
} = {}) {
  const root = documentRef?.documentElement;
  const viewport = windowRef?.visualViewport;
  let state = null;
  let frame = 0;

  const read = () => {
    const layoutWidth = finite(windowRef?.innerWidth, viewport?.width);
    const layoutHeight = finite(windowRef?.innerHeight, viewport?.height);
    const viewportWidth = finite(viewport?.width, layoutWidth);
    const viewportHeight = finite(viewport?.height, layoutHeight);
    const classified = classifyResponsiveContext({ width: layoutWidth, height: layoutHeight });
    return Object.freeze({
      ...classified,
      viewportWidth,
      viewportHeight,
      offsetLeft: finite(viewport?.offsetLeft),
      offsetTop: finite(viewport?.offsetTop),
      safeInsets: safeInsets(documentRef)
    });
  };

  const render = (next) => {
    if (!root) return;
    root.dataset.uiLayout = next.layout;
    root.dataset.uiDensity = next.density;
    root.dataset.homeLayout = classifyHomeLayout(next);
    root.style.setProperty("--ui-vv-width", `${next.viewportWidth}px`);
    root.style.setProperty("--ui-vv-height", `${next.viewportHeight}px`);
    root.style.setProperty("--ui-vv-offset-left", `${next.offsetLeft}px`);
    root.style.setProperty("--ui-vv-offset-top", `${next.offsetTop}px`);
  };

  const sync = () => {
    frame = 0;
    const next = read();
    const changed = !state
      || state.layout !== next.layout
      || state.density !== next.density
      || state.viewportWidth !== next.viewportWidth
      || state.viewportHeight !== next.viewportHeight;
    state = next;
    render(next);
    if (changed) onChange(next);
    return next;
  };

  const schedule = () => {
    if (frame) return;
    frame = windowRef?.requestAnimationFrame?.(sync) || windowRef?.setTimeout?.(sync, 0) || 0;
  };

  windowRef?.addEventListener?.("resize", schedule);
  windowRef?.addEventListener?.("orientationchange", schedule);
  viewport?.addEventListener?.("resize", schedule);
  viewport?.addEventListener?.("scroll", schedule);
  sync();

  return Object.freeze({
    get state() { return state; },
    sync,
    destroy() {
      if (frame) (windowRef?.cancelAnimationFrame || windowRef?.clearTimeout)?.call(windowRef, frame);
      windowRef?.removeEventListener?.("resize", schedule);
      windowRef?.removeEventListener?.("orientationchange", schedule);
      viewport?.removeEventListener?.("resize", schedule);
      viewport?.removeEventListener?.("scroll", schedule);
    }
  });
}
