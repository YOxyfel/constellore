import { selectCosmicQuote } from "./cosmic-quotes.mjs?v=5.0.0-beta.1";
import {
  FIRST_DISCOVERY_HOLD_MS,
  firstDiscoveryBurstPlan
} from "./first-game-experience.mjs?v=5.0.0-beta.1";

const DEFAULT_TIMINGS = Object.freeze({
  introHold: 300,
  seamDraw: 900,
  introQuoteHold: 3200,
  introOpen: 1250,
  enterClose: 1050,
  enterQuoteHold: 2800,
  enterOpen: 1150,
  reducedQuoteHold: 2200,
  reducedTransition: 70,
  doorOpen: 980,
  dialogClose: 720,
  dialogOpen: 280,
  dialogArrive: 430,
  firstDiscoveryHold: FIRST_DISCOVERY_HOLD_MS,
  firstDiscoveryReducedHold: 280
});

const FALLBACK_QUOTE = Object.freeze({
  id: "first-discovery",
  text: "Every discovery begins when two ideas meet.",
  author: "Constellore"
});

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function cssTimeMilliseconds(value) {
  const source = String(value || "").trim();
  if (!source) return 0;
  const numeric = Number.parseFloat(source);
  if (!Number.isFinite(numeric)) return 0;
  return source.endsWith("ms") ? numeric : source.endsWith("s") ? numeric * 1_000 : 0;
}

function transformTransitionMilliseconds(element) {
  if (!element || typeof globalThis.getComputedStyle !== "function") return 0;
  let style;
  try {
    style = globalThis.getComputedStyle(element);
  } catch {
    return 0;
  }
  const properties = String(style?.transitionProperty || "").split(",").map((value) => value.trim());
  const durations = String(style?.transitionDuration || "").split(",").map(cssTimeMilliseconds);
  const delays = String(style?.transitionDelay || "").split(",").map(cssTimeMilliseconds);
  const count = Math.max(properties.length, durations.length, delays.length);
  let longest = 0;
  for (let index = 0; index < count; index += 1) {
    const property = properties[index % properties.length] || "";
    if (property !== "transform" && property !== "all") continue;
    longest = Math.max(
      longest,
      (durations[index % durations.length] || 0) + (delays[index % delays.length] || 0)
    );
  }
  return longest;
}

function waitForTransformTransition(element, fallbackMilliseconds) {
  const fallback = Math.max(0, Number(fallbackMilliseconds) || 0);
  if (!element?.addEventListener) return delay(fallback);
  const computed = transformTransitionMilliseconds(element);
  const timeout = Math.max(fallback, computed);
  if (timeout <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    let timer = null;
    const finish = () => {
      if (timer !== null) clearTimeout(timer);
      element.removeEventListener("transitionend", onTransition);
      element.removeEventListener("transitioncancel", onTransition);
      resolve();
    };
    const onTransition = (event) => {
      if (event?.target !== element) return;
      if (event?.propertyName && event.propertyName !== "transform") return;
      finish();
    };
    element.addEventListener("transitionend", onTransition);
    element.addEventListener("transitioncancel", onTransition);
    timer = setTimeout(finish, timeout + 80);
  });
}

function waitForDoorClose(root, fallbackMilliseconds) {
  const doors = Array.from(root?.querySelectorAll?.(".cosmic-gate__door, .cosmic-door") || []);
  if (!doors.length) return delay(fallbackMilliseconds);
  return Promise.all(doors.map((door) => waitForTransformTransition(door, fallbackMilliseconds)));
}

function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

export function createCosmicGate({
  root = document.querySelector("#cosmicGate"),
  timings = DEFAULT_TIMINGS,
  reducedMotion = prefersReducedMotion,
  quoteSelector = selectCosmicQuote,
  onTransition = null,
  surfaces = () => [
    document.querySelector("#startScreen"),
    document.querySelector("#gameScreen")
  ]
} = {}) {
  const timing = Object.freeze({ ...DEFAULT_TIMINGS, ...(timings || {}) });
  let sequence = 0;
  let activeTransitions = 0;
  let previousQuoteId = "";

  const emitTransition = (cue, detail = {}) => {
    try {
      if (typeof onTransition === "function") onTransition(cue, detail);
    } catch { /* Audio and analytics hooks must never interrupt navigation. */ }
  };

  const setBusy = (busy) => {
    activeTransitions = Math.max(0, activeTransitions + (busy ? 1 : -1));
    document.body?.classList.toggle("transition-active", activeTransitions > 0);
  };

  const reduced = () => typeof reducedMotion === "function" ? reducedMotion() : Boolean(reducedMotion);

  const clearFirstDiscovery = () => {
    if (!root) return;
    delete root.dataset.celebration;
    const layer = root.querySelector?.(".cosmic-gate__first-discovery");
    if (layer) layer.hidden = true;
  };

  const prepareFirstDiscovery = (celebration) => {
    if (!root) return false;
    const kind = typeof celebration === "string" ? celebration : celebration?.kind;
    if (kind !== "first-orbit") return false;
    const layer = root.querySelector?.(".cosmic-gate__first-discovery");
    const field = layer?.querySelector?.(".cosmic-gate__confetti");
    if (!layer || !field) return false;

    if (field.dataset.ready !== "true") {
      const ownerDocument = field.ownerDocument || globalThis.document;
      for (const particle of firstDiscoveryBurstPlan()) {
        const element = ownerDocument.createElement("i");
        element.className = `cosmic-gate__first-discovery-particle cosmic-gate__first-discovery-particle--${particle.kind}`;
        element.dataset.tone = particle.tone;
        element.setAttribute("aria-hidden", "true");
        element.style.setProperty("--burst-x", `${particle.x}vmin`);
        element.style.setProperty("--burst-y", `${particle.y}vmin`);
        element.style.setProperty("--burst-delay", `${particle.delay}ms`);
        element.style.setProperty("--burst-duration", `${particle.duration}ms`);
        element.style.setProperty("--burst-size", `${particle.size}px`);
        element.style.setProperty("--burst-spin", `${particle.spin}deg`);
        element.textContent = particle.glyph;
        field.append(element);
      }
      field.dataset.ready = "true";
    }

    const word = String(celebration?.word || "Mud").trim() || "Mud";
    const emoji = String(celebration?.emoji || "🟤").trim() || "🟤";
    const title = layer.querySelector?.(".cosmic-gate__first-discovery-title strong");
    if (title) {
      title.replaceChildren();
      const icon = (title.ownerDocument || globalThis.document).createElement("i");
      icon.textContent = emoji;
      icon.setAttribute("aria-hidden", "true");
      title.append(icon, ` ${word.toUpperCase()}`);
    }
    layer.hidden = false;
    root.dataset.celebration = "first-orbit";
    return true;
  };

  const suspendSurfaces = () => {
    const candidates = typeof surfaces === "function" ? surfaces() : surfaces;
    const elements = Array.from(candidates || []).filter(Boolean);
    const snapshots = elements.map((element) => ({
      element,
      inert: Boolean(element.inert),
      hadInertAttribute: element.hasAttribute?.("inert") === true,
      inertAttribute: element.getAttribute?.("inert")
    }));
    snapshots.forEach(({ element }) => {
      if ("inert" in element) element.inert = true;
      element.setAttribute?.("inert", "");
    });
    return () => snapshots.forEach(({
      element,
      inert,
      hadInertAttribute,
      inertAttribute
    }) => {
      if ("inert" in element) element.inert = inert;
      if (hadInertAttribute) element.setAttribute?.("inert", inertAttribute ?? "");
      else element.removeAttribute?.("inert");
    });
  };

  const setGateMessage = (kind, label) => {
    if (!root) return;
    const eyebrow = root.querySelector?.(".cosmic-gate__eyebrow");
    const title = root.querySelector?.(".cosmic-gate__label");
    const copy = root.querySelector?.(".cosmic-gate__copy");
    const messages = {
      intro: ["", "CONSTELLORE", ""],
      enter: ["YOUR NEXT ORBIT", "Enter the cosmos", label || "A new path is ready."],
      pause: ["THE COSMOS WAITS", "Game paused", label],
      victory: ["CONSTELLATION COMPLETE", "Target found", label],
      result: ["ROUTE COMPLETE", "Game complete", label]
    };
    const [nextEyebrow, nextTitle, nextCopy] = messages[kind] || messages.intro;
    if (eyebrow) {
      eyebrow.textContent = nextEyebrow;
      eyebrow.hidden = !nextEyebrow;
    }
    if (title) title.textContent = nextTitle;
    if (copy) {
      copy.textContent = nextCopy || "";
      copy.hidden = !nextCopy;
    }
  };

  const setGateQuote = (kind, label = "") => {
    if (!root) return FALLBACK_QUOTE;
    let selected;
    try {
      selected = typeof quoteSelector === "function"
        ? quoteSelector({ previousId: previousQuoteId })
        : null;
    } catch {
      selected = null;
    }
    const quote = selected && String(selected.text || "").trim()
      ? selected
      : FALLBACK_QUOTE;
    const quoteId = String(quote.id || quote.text);
    previousQuoteId = quoteId;
    root.dataset.quoteId = quoteId;
    root.dataset.content = "quote";

    const eyebrow = root.querySelector?.(".cosmic-gate__eyebrow");
    const title = root.querySelector?.(".cosmic-gate__label");
    const copy = root.querySelector?.(".cosmic-gate__copy");
    const context = kind === "enter" && label
      ? label
      : "CONSTELLORE";
    if (eyebrow) {
      eyebrow.textContent = context;
      eyebrow.hidden = false;
    }
    if (title) title.textContent = `“${String(quote.text).trim()}”`;
    if (copy) {
      const author = String(quote.author || "").trim();
      copy.textContent = author ? `— ${author}` : "";
      copy.hidden = !author;
    }
    return quote;
  };

  const hideGate = () => {
    if (!root) return;
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.dataset.phase = "idle";
    delete root.dataset.content;
  };

  function skipIntro() {
    sequence += 1;
    if (root) {
      root.dataset.played = "true";
      clearFirstDiscovery();
      hideGate();
    }
    document.body?.classList.remove("cosmic-intro-pending");
    return Boolean(root);
  }

  async function playIntro() {
    if (!root || root.dataset.played === "true") {
      document.body?.classList.remove("cosmic-intro-pending");
      return false;
    }
    const token = ++sequence;
    root.dataset.played = "true";
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    root.dataset.kind = "intro";
    root.dataset.phase = "primed";
    setGateQuote("intro");
    setBusy(true);
    try {
      if (reduced()) {
        root.dataset.phase = "closed";
        await delay(timing.reducedQuoteHold);
        if (token !== sequence) return false;
        root.dataset.phase = "opening";
        await delay(timing.reducedTransition);
      } else {
        await delay(timing.introHold);
        if (token !== sequence) return false;
        root.dataset.phase = "closing";
        await delay(timing.seamDraw);
        if (token !== sequence) return false;
        root.dataset.phase = "closed";
        await delay(timing.introQuoteHold);
        if (token !== sequence) return false;
        root.dataset.phase = "opening";
        await delay(timing.introOpen);
      }
      return true;
    } finally {
      if (token === sequence) {
        hideGate();
        document.body?.classList.remove("cosmic-intro-pending");
      }
      setBusy(false);
    }
  }

  async function presentDialog(dialog, {
    kind = "pause",
    label = "",
    focus = null,
    celebration = null
  } = {}) {
    if (!dialog || dialog.open) return false;
    const token = ++sequence;
    const firstDiscovery = (typeof celebration === "string" ? celebration : celebration?.kind) === "first-orbit";
    let restoreCelebrationSurfaces = null;
    dialog.classList.add("cosmic-dialog-transition", `cosmic-dialog-transition--${kind === "victory" || kind === "result" ? "result" : "pause"}`);
    dialog.dataset.phase = "opening";
    setBusy(true);
    try {
      if (root) {
        root.hidden = false;
        root.setAttribute("aria-hidden", "true");
        root.dataset.kind = kind;
        setGateMessage(kind, label);
        const firstDiscoveryPrepared = firstDiscovery && prepareFirstDiscovery(celebration);
        if (firstDiscoveryPrepared) restoreCelebrationSurfaces = suspendSurfaces();
        root.dataset.phase = firstDiscoveryPrepared ? "closed" : "opening";
        if (firstDiscoveryPrepared) {
          root.dataset.content = "hidden";
          await nextFrame();
          if (token !== sequence) return false;
          await delay(reduced() ? timing.firstDiscoveryReducedHold : timing.firstDiscoveryHold);
          if (token !== sequence) return false;
          clearFirstDiscovery();
          delete root.dataset.content;
          root.dataset.phase = "opening";
        } else {
          delete root.dataset.content;
        }
        await nextFrame();
        if (token !== sequence) return false;
        root.dataset.phase = "closing";
        emitTransition("gateClose", { kind, surface: "dialog" });
        if (reduced()) {
          await delay(90);
        } else {
          await waitForDoorClose(root, timing.dialogClose);
        }
        if (token !== sequence) return false;
        root.dataset.phase = "closed";
        root.dataset.content = "hidden";
        clearFirstDiscovery();
      }
      dialog.showModal();
      restoreCelebrationSurfaces?.();
      restoreCelebrationSurfaces = null;
      await nextFrame();
      if (token !== sequence || !dialog.open) return false;
      await delay(reduced() ? 70 : timing.dialogArrive);
      if (token !== sequence || !dialog.open) return false;
      dialog.dataset.phase = "closed";
      const target = typeof focus === "string" ? dialog.querySelector(focus) : focus;
      requestAnimationFrame(() => target?.focus?.({ preventScroll: true }));
      return true;
    } finally {
      restoreCelebrationSurfaces?.();
      clearFirstDiscovery();
      setBusy(false);
      if (!dialog.open) hideGate();
    }
  }

  async function enterBoard(swap, { label = "", afterOpen = null } = {}) {
    if (typeof swap !== "function") return false;
    const restoreSurfaces = suspendSurfaces();
    if (!root) {
      try {
        await swap();
        if (typeof afterOpen === "function") await afterOpen();
        return true;
      } finally {
        restoreSurfaces();
      }
    }
    const token = ++sequence;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    root.dataset.kind = "enter";
    root.dataset.phase = "opening";
    setGateQuote("enter", label);
    setBusy(true);
    try {
      await nextFrame();
      if (token !== sequence) return false;
      root.dataset.phase = "closing";
      emitTransition("gateClose", { kind: "enter", surface: "board" });
      await delay(reduced() ? timing.reducedTransition : timing.enterClose);
      if (token !== sequence) return false;
      root.dataset.phase = "closed";
      await swap();
      if (token !== sequence) return false;
      await delay(reduced() ? timing.reducedQuoteHold : timing.enterQuoteHold);
      if (token !== sequence) return false;
      await nextFrame();
      if (token !== sequence) return false;
      root.dataset.phase = "opening";
      emitTransition("gateOpen", { kind: "enter", surface: "board" });
      await delay(reduced() ? timing.reducedTransition : timing.enterOpen);
      if (token !== sequence) return false;
      if (typeof afterOpen === "function") await afterOpen();
      return token === sequence;
    } finally {
      if (token === sequence) hideGate();
      setBusy(false);
      restoreSurfaces();
    }
  }

  async function dismissDialog(dialog, { restoreFocus = null, immediate = false } = {}) {
    if (!dialog?.open) return false;
    const token = ++sequence;
    setBusy(true);
    try {
      dialog.dataset.phase = "closing";
      if (!immediate) await delay(reduced() ? 50 : timing.dialogOpen);
      if (token !== sequence || !dialog.open) return false;
      dialog.close();
      clearDialog(dialog);
      if (root && !root.hidden) {
        root.dataset.content = "hidden";
        root.dataset.phase = "opening";
        emitTransition("gateOpen", { kind: "dialog", surface: "dialog" });
        if (!immediate) await delay(reduced() ? 70 : timing.doorOpen);
        if (token === sequence) hideGate();
      }
      requestAnimationFrame(() => restoreFocus?.focus?.({ preventScroll: true }));
      return true;
    } finally {
      setBusy(false);
    }
  }

  function clearDialog(dialog) {
    if (!dialog) return;
    delete dialog.dataset.phase;
    dialog.classList.remove("cosmic-dialog-transition", "cosmic-dialog-transition--pause", "cosmic-dialog-transition--result");
    if (activeTransitions === 0) hideGate();
  }

  return Object.freeze({
    playIntro,
    skipIntro,
    enterBoard,
    presentDialog,
    dismissDialog,
    clearDialog,
    isActive: () => activeTransitions > 0
  });
}

export { DEFAULT_TIMINGS as COSMIC_GATE_TIMINGS };
