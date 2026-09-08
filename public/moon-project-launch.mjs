const BLACKOUT_MS = 320;
const REVEAL_MS = 420;
const REDUCED_BLACKOUT_MS = 90;
const REDUCED_REVEAL_MS = 120;

function delay(timers, milliseconds) {
  return new Promise((resolve) => timers.setTimeout(resolve, Math.max(0, milliseconds)));
}

function nextPaint(documentRef, timers) {
  const view = documentRef?.defaultView;
  if (typeof view?.requestAnimationFrame === "function") {
    return new Promise((resolve) => view.requestAnimationFrame(() => view.requestAnimationFrame(resolve)));
  }
  if (typeof globalThis.requestAnimationFrame === "function") {
    return new Promise((resolve) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)));
  }
  return delay(timers, 0);
}

function defaultReducedMotion(documentRef) {
  try {
    return documentRef?.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  } catch {
    return false;
  }
}

function createElement(documentRef, tagName, className = "", attributes = {}) {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) element.setAttribute(name, String(value));
  }
  return element;
}

function snapshotInertSurfaces(documentRef, overlay) {
  const entries = Array.from(documentRef.body?.children || [])
    .filter((element) => element !== overlay && !["SCRIPT", "STYLE", "LINK"].includes(element.tagName))
    .map((element) => ({
      element,
      inert: Boolean(element.inert),
      hadAttribute: element.hasAttribute?.("inert") === true,
      attribute: element.getAttribute?.("inert")
    }));
  entries.forEach(({ element }) => {
    if ("inert" in element) element.inert = true;
    element.setAttribute?.("inert", "");
  });
  return () => entries.forEach(({ element, inert, hadAttribute, attribute }) => {
    if ("inert" in element) element.inert = inert;
    if (hadAttribute) element.setAttribute?.("inert", attribute ?? "");
    else element.removeAttribute?.("inert");
  });
}

/** The 3D hub owns the complete flight; this plan only crosses black into Moon. */
export function moonProjectLaunchPlan({ reducedMotion = false } = {}) {
  const reduced = Boolean(reducedMotion);
  return Object.freeze({
    blackoutMs: reduced ? REDUCED_BLACKOUT_MS : BLACKOUT_MS,
    revealMs: reduced ? REDUCED_REVEAL_MS : REVEAL_MS,
    playVideo: false
  });
}

function buildOverlay(documentRef, { label = "Moon project" } = {}) {
  const root = createElement(documentRef, "section", "moon-project-launch", {
    "data-moon-project-launch": "",
    "data-phase": "prime"
  });
  const status = createElement(documentRef, "p", "moon-project-launch__sr-only", {
    id: "moonProjectLaunchStatus",
    role: "status",
    "aria-live": "polite",
    "aria-atomic": "true"
  });
  status.textContent = `Arriving at ${label}.`;
  root.append(status);
  return { root, status };
}

export function createMoonProjectLaunch({
  documentRef = globalThis.document,
  timers = globalThis,
  reducedMotion = () => defaultReducedMotion(documentRef),
  onCue = null
} = {}) {
  if (!documentRef?.body || !documentRef?.createElement) {
    throw new TypeError("Moon project launch requires a document-backed body.");
  }

  let activePromise = null;
  const emit = (cue, detail = {}) => {
    try { onCue?.(cue, detail); } catch { /* Navigation never depends on feedback. */ }
  };

  function prepare() {
    return Object.freeze({ ready: true, presentation: "black-fade" });
  }

  async function run({
    open,
    trigger = documentRef.activeElement,
    label = "Moon project"
  } = {}) {
    if (typeof open !== "function") return Object.freeze({ opened: false, reason: "missing-destination" });
    const reduced = typeof reducedMotion === "function" ? Boolean(reducedMotion()) : Boolean(reducedMotion);
    const plan = moonProjectLaunchPlan({ reducedMotion: reduced });
    const { root, status } = buildOverlay(documentRef, { label });
    const previousFocus = documentRef.activeElement;
    documentRef.body.append(root);
    documentRef.body.classList.add("moon-project-launch-is-active");
    const restoreInertSnapshot = snapshotInertSurfaces(documentRef, root);
    let inertActive = true;
    const restoreInert = () => {
      if (!inertActive) return;
      inertActive = false;
      restoreInertSnapshot();
    };
    let opened = false;
    const reason = reduced ? "reduced-motion" : "black-fade";

    try {
      emit("blackout", { label, plan });
      await nextPaint(documentRef, timers);
      root.dataset.phase = "blackout";
      await delay(timers, plan.blackoutMs);

      root.dataset.phase = "handoff";
      status.textContent = `Arriving at ${label}.`;
      emit("handoff", { label, reason });
      opened = (await open({ trigger })) !== false;
      // The destination now owns interaction. Release the old Home surfaces
      // before waiting for its first paint; the overlay itself is visual-only.
      if (opened) restoreInert();
      await nextPaint(documentRef, timers);
      root.dataset.phase = "reveal";
      await delay(timers, plan.revealMs);
      return Object.freeze({ opened, reason });
    } finally {
      restoreInert();
      documentRef.body.classList.remove("moon-project-launch-is-active");
      root.remove();
      emit("complete", { label, opened, reason });
      if (!opened && (trigger?.isConnected ?? previousFocus?.isConnected)) {
        (trigger?.isConnected ? trigger : previousFocus)?.focus?.({ preventScroll: true });
      }
    }
  }

  function play(options = {}) {
    if (activePromise) return activePromise;
    activePromise = run(options).finally(() => { activePromise = null; });
    return activePromise;
  }

  return Object.freeze({
    prepare,
    play,
    skip: () => false,
    isActive: () => Boolean(activePromise)
  });
}
