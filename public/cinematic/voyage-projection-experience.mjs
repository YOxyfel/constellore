import {
  VOYAGE_DURATION_SECONDS,
  VOYAGE_FINAL_TEXT,
  createVoyageWorldPresentation,
  normalizeVoyageVariant,
  selectVoyageQuality,
  shotAtTime
} from "../voyage-projection-domain.mjs?v=5.0.0-beta.4";
import { createVoyageProjectionRuntime } from "../voyage-projection-runtime.mjs?v=5.0.0-beta.4";
import { createVoyageProjectionScene } from "../voyage-projection-scene.mjs?v=5.0.0-beta.4";
import {
  configureVoyageMasterVideo,
  loadApprovedVoyageMedia
} from "./voyage-projection-media.mjs?v=5.0.0-beta.4";
import {
  FIRST_OPEN_CINEMATIC_BYPASS_KEY,
  FIRST_OPEN_CINEMATIC_SESSION_KEY,
  FIRST_OPEN_CINEMATIC_STORAGE_KEY,
  clearFirstOpenCinematicSession,
  hasCompletedFirstOpenCinematic,
  hasPlayedFirstOpenCinematicThisSession,
  markFirstOpenCinematicComplete,
  markFirstOpenCinematicSessionPlayed
} from "./first-open-cinematic.mjs?v=5.0.0-beta.4";

const STYLE_MARKER = "data-voyage-projection-style";
const REDUCED_QUERY_VALUES = new Set(["poster", "static"]);
const VIDEO_QUERY_VALUES = new Set(["video", "master"]);
const POSTER_SHOT_IDS = new Set([
  "earth",
  "solar",
  "heliopause",
  "warp",
  "black-hole",
  "singularity",
  "return",
  "beyond"
]);
export const VOYAGE_PLATE_CROSSFADE_MS = 160;
const styleLoads = new WeakMap();

function frozen(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) frozen(child);
  return Object.freeze(value);
}

function delay(timers, milliseconds) {
  return new Promise((resolve) => timers.setTimeout(resolve, Math.max(0, milliseconds)));
}

function safeStorage(value, fallbackName) {
  if (value) return value;
  try { return globalThis[fallbackName] || null; } catch { return null; }
}

function normalizedChoice(value) {
  return String(value || "").trim().toLocaleLowerCase("en");
}

/** Pure delivery selection shared by startup code and tests. */
export function resolveVoyageProjectionDelivery({
  choice = "realtime",
  reducedMotion = false,
  saveData = false,
  webgl2 = true
} = {}) {
  const requested = normalizedChoice(choice);
  if (VIDEO_QUERY_VALUES.has(requested)) return frozen({ requested, delivery: "video", reason: "requested-video" });
  if (REDUCED_QUERY_VALUES.has(requested) || saveData) {
    return frozen({ requested, delivery: "poster", reason: saveData ? "save-data" : "requested-poster" });
  }
  if (!webgl2) return frozen({ requested, delivery: "poster", reason: "webgl2-unavailable" });
  return frozen({ requested, delivery: "realtime", reason: reducedMotion ? "reduced-motion-plates" : "realtime" });
}

function supportsWebGl2(documentRef) {
  try {
    const canvas = documentRef?.createElement?.("canvas");
    return Boolean(canvas?.getContext?.("webgl2", { failIfMajorPerformanceCaveat: true }));
  } catch {
    return false;
  }
}

function prefersReducedMotion(documentRef) {
  try { return documentRef?.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true; }
  catch { return false; }
}

function saveDataEnabled(documentRef) {
  return documentRef?.defaultView?.navigator?.connection?.saveData === true;
}

function makeElement(documentRef, tag, className = "", attributes = {}) {
  const element = documentRef.createElement(tag);
  if (className) element.className = className;
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) element.setAttribute(name, String(value));
  }
  return element;
}

function normalizedPosterShot(value) {
  const normalized = String(value || "").trim().toLocaleLowerCase("en");
  return POSTER_SHOT_IDS.has(normalized) ? normalized : "earth";
}

/**
 * Poster state is derived exclusively from the authored shot and the immutable
 * projection facts. It never guesses an arrival or mutates expedition state.
 */
export function resolveVoyagePosterComposition({
  shotId = "earth",
  variant = "promise",
  currentWorldId = "earth"
} = {}) {
  return frozen({
    shotId: normalizedPosterShot(shotId),
    variant: normalizeVoyageVariant(variant),
    currentWorldId: String(currentWorldId || "earth").trim().toLocaleLowerCase("en") || "earth"
  });
}

function applyPosterComposition(target, composition) {
  if (!target?.dataset) return;
  target.dataset.shot = composition.shotId;
  target.dataset.variant = composition.variant;
  target.dataset.currentWorld = composition.currentWorldId;
}

function makePoster(documentRef, modifier = "") {
  const className = ["voyage-projection__poster", modifier].filter(Boolean).join(" ");
  const poster = makeElement(documentRef, "div", className, {
    "aria-hidden": "true",
    "data-shot": "earth",
    "data-variant": "promise",
    "data-current-world": "earth"
  });
  const planets = makeElement(documentRef, "i", "voyage-projection__poster-planets");
  for (let index = 0; index < 7; index += 1) {
    planets.append(makeElement(documentRef, "span", "", { "data-planet": String(index + 1) }));
  }
  poster.append(
    makeElement(documentRef, "i", "voyage-projection__poster-sun"),
    makeElement(documentRef, "i", "voyage-projection__poster-earth"),
    makeElement(documentRef, "i", "voyage-projection__poster-moon"),
    makeElement(documentRef, "i", "voyage-projection__poster-orbit"),
    planets,
    makeElement(documentRef, "i", "voyage-projection__poster-heliopause"),
    makeElement(documentRef, "i", "voyage-projection__poster-warp"),
    makeElement(documentRef, "i", "voyage-projection__poster-black-hole"),
    makeElement(documentRef, "i", "voyage-projection__poster-singularity"),
    makeElement(documentRef, "i", "voyage-projection__poster-route"),
    makeElement(documentRef, "i", "voyage-projection__poster-destination"),
    makeElement(documentRef, "i", "voyage-projection__poster-rocket")
  );
  return poster;
}

/**
 * Reduced motion uses authored still plates, but a shot boundary should remain
 * legible rather than flashing. The outgoing WebGL frame is captured when the
 * browser permits it; an independently composed poster echo always remains as
 * the safe fallback. Both layers crossfade within the 180ms production cap.
 */
export function createVoyagePlateTransitionController({
  root,
  canvas,
  poster,
  posterEcho,
  plateSnapshot,
  reducedMotion = false,
  timers = globalThis,
  requestFrame = null,
  cancelFrame = null
} = {}) {
  if (!root?.dataset || !poster?.dataset || !posterEcho?.dataset || !plateSnapshot?.dataset) {
    throw new TypeError("Voyage plate transitions require the projection plate layers.");
  }
  const timerHost = typeof timers?.setTimeout === "function" ? timers : globalThis;
  const scheduleFrame = typeof requestFrame === "function"
    ? requestFrame
    : (callback) => {
        const native = root.ownerDocument?.defaultView?.requestAnimationFrame;
        return typeof native === "function"
          ? native.call(root.ownerDocument.defaultView, callback)
          : timerHost.setTimeout(callback, 16);
      };
  const cancelScheduledFrame = typeof cancelFrame === "function"
    ? cancelFrame
    : (handle) => {
        const native = root.ownerDocument?.defaultView?.cancelAnimationFrame;
        if (typeof native === "function") native.call(root.ownerDocument.defaultView, handle);
        else timerHost.clearTimeout?.(handle);
      };
  let current = null;
  let frameHandle = null;
  let finishHandle = null;
  let destroyed = false;

  const clearPending = () => {
    if (frameHandle !== null) cancelScheduledFrame(frameHandle);
    if (finishHandle !== null) timerHost.clearTimeout?.(finishHandle);
    frameHandle = null;
    finishHandle = null;
  };

  const clearLayers = () => {
    posterEcho.dataset.active = "false";
    plateSnapshot.dataset.active = "false";
    root.dataset.plateTransition = "idle";
  };

  const apply = (composition) => {
    current = composition;
    root.dataset.shot = composition.shotId;
    applyPosterComposition(poster, composition);
  };

  const captureCanvas = () => {
    try {
      const width = Math.max(1, Number(canvas?.width) || 0);
      const height = Math.max(1, Number(canvas?.height) || 0);
      if (!canvas || width <= 1 || height <= 1) return false;
      plateSnapshot.width = width;
      plateSnapshot.height = height;
      const context = plateSnapshot.getContext?.("2d", { alpha: false });
      if (!context?.drawImage) return false;
      context.clearRect?.(0, 0, width, height);
      context.drawImage(canvas, 0, 0, width, height);
      return true;
    } catch {
      return false;
    }
  };

  const setInitial = (state = {}) => {
    clearPending();
    clearLayers();
    apply(resolveVoyagePosterComposition(state));
    return current;
  };

  const transitionTo = (state = {}) => {
    const incoming = resolveVoyagePosterComposition(state);
    if (destroyed) return incoming;
    if (!current || !reducedMotion || current.shotId === incoming.shotId) {
      setInitial(incoming);
      return incoming;
    }

    clearPending();
    applyPosterComposition(posterEcho, current);
    posterEcho.dataset.active = "true";
    plateSnapshot.dataset.active = String(captureCanvas());
    root.dataset.plateTransition = "primed";
    apply(incoming);

    // Force the outgoing plate's fully opaque state to commit before fading.
    posterEcho.getBoundingClientRect?.();
    frameHandle = scheduleFrame(() => {
      frameHandle = null;
      if (destroyed) return;
      root.dataset.plateTransition = "fading";
      finishHandle = timerHost.setTimeout(() => {
        finishHandle = null;
        clearLayers();
      }, VOYAGE_PLATE_CROSSFADE_MS);
    });
    return incoming;
  };

  return Object.freeze({
    setInitial,
    transitionTo,
    destroy() {
      destroyed = true;
      clearPending();
      clearLayers();
    },
    snapshot() {
      return frozen({
        composition: current,
        phase: root.dataset.plateTransition || "idle",
        posterEchoActive: posterEcho.dataset.active === "true",
        canvasSnapshotActive: plateSnapshot.dataset.active === "true"
      });
    }
  });
}

function ensureStyles(documentRef) {
  if (!documentRef?.head) return Promise.resolve("unavailable");
  if (documentRef.head.querySelector?.(`[${STYLE_MARKER}]`)) return Promise.resolve("existing");
  if (styleLoads.has(documentRef)) return styleLoads.get(documentRef);
  const link = makeElement(documentRef, "link", "", {
    rel: "stylesheet",
    href: new URL("./voyage-projection-experience.css?v=5.0.0-beta.4", import.meta.url).href,
    [STYLE_MARKER]: ""
  });
  const timerHost = typeof documentRef.defaultView?.setTimeout === "function"
    ? documentRef.defaultView
    : globalThis;
  const promise = new Promise((resolve) => {
    let settled = false;
    let timeout = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timeout !== null) timerHost.clearTimeout?.(timeout);
      link.removeEventListener?.("load", loaded);
      link.removeEventListener?.("error", failed);
      if (value !== "loaded") {
        link.remove?.();
        styleLoads.delete(documentRef);
      }
      resolve(value);
    };
    const loaded = () => finish("loaded");
    const failed = () => finish("error");
    link.addEventListener?.("load", loaded, { once: true });
    link.addEventListener?.("error", failed, { once: true });
    try {
      documentRef.head.append?.(link);
      timeout = timerHost.setTimeout?.(() => finish("timeout"), 650) ?? null;
    } catch {
      finish("error");
    }
  });
  styleLoads.set(documentRef, promise);
  void promise.then((state) => {
    if (state !== "loaded" && state !== "existing" && styleLoads.get(documentRef) === promise) {
      styleLoads.delete(documentRef);
    }
  });
  return promise;
}

function applyCriticalFallbackStyles(dom) {
  const assign = (element, styles) => {
    if (!element?.style) return;
    Object.assign(element.style, styles);
  };
  assign(dom.root, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    overflow: "hidden",
    color: "#f6f1e8",
    background: "#02040d",
    fontFamily: "system-ui, sans-serif"
  });
  assign(dom.canvas, { position: "absolute", inset: "0", width: "100%", height: "100%" });
  assign(dom.video, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover" });
  assign(dom.poster, {
    position: "absolute",
    inset: "0",
    background: "radial-gradient(circle at 30% 55%, #12345d 0, #050b1c 30%, #01020a 72%)"
  });
  assign(dom.posterEcho, { display: "none" });
  assign(dom.plateSnapshot, { display: "none" });
  assign(dom.hud, { position: "absolute", top: "24px", left: "24px", right: "24px" });
  assign(dom.caption, {
    position: "absolute",
    left: "max(24px, 8vw)",
    right: "max(24px, 8vw)",
    bottom: "92px",
    textAlign: "center"
  });
  assign(dom.skip.parentNode, {
    position: "absolute",
    right: "24px",
    bottom: "24px",
    display: "flex",
    gap: "12px"
  });
  for (const control of [dom.sound, dom.skip]) {
    assign(control, {
      minWidth: "48px",
      minHeight: "48px",
      color: "inherit",
      border: "1px solid currentColor",
      borderRadius: "999px",
      background: "rgba(2, 8, 20, .78)"
    });
  }
}

export function buildVoyageProjectionDom(documentRef = globalThis.document) {
  if (!documentRef?.createElement) throw new TypeError("Voyage Projection requires a document.");
  const root = makeElement(documentRef, "section", "voyage-projection", {
    "data-voyage-projection": "",
    "data-phase": "loading",
    "data-shot": "earth",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "voyageProjectionTitle",
    "aria-describedby": "voyageProjectionStatus"
  });
  const title = makeElement(documentRef, "h1", "voyage-projection__sr-only", { id: "voyageProjectionTitle" });
  title.textContent = "Constellore voyage projection";
  const status = makeElement(documentRef, "p", "voyage-projection__sr-only", {
    id: "voyageProjectionStatus",
    role: "status",
    "aria-live": "polite",
    "aria-atomic": "true"
  });
  status.textContent = "Projecting the route from Earth toward the edge of the known universe.";

  const canvas = makeElement(documentRef, "canvas", "voyage-projection__canvas", {
    "aria-hidden": "true",
    tabindex: "-1"
  });
  const video = makeElement(documentRef, "video", "voyage-projection__video", {
    "aria-hidden": "true",
    tabindex: "-1",
    playsinline: "",
    preload: "auto"
  });
  const poster = makePoster(documentRef);
  const posterEcho = makePoster(documentRef, "voyage-projection__poster--echo");
  posterEcho.dataset.active = "false";
  const plateSnapshot = makeElement(documentRef, "canvas", "voyage-projection__plate-snapshot", {
    "aria-hidden": "true",
    tabindex: "-1",
    "data-active": "false"
  });
  const grade = makeElement(documentRef, "div", "voyage-projection__grade", { "aria-hidden": "true" });

  const hud = makeElement(documentRef, "header", "voyage-projection__hud");
  const mission = makeElement(documentRef, "div", "voyage-projection__mission");
  const missionKicker = makeElement(documentRef, "small");
  missionKicker.textContent = "NAVIGATION INTELLIGENCE · MISSION PROJECTION";
  const missionShot = makeElement(documentRef, "strong");
  missionShot.textContent = "EARTH DEPARTURE";
  mission.append(missionKicker, missionShot);
  const timer = makeElement(documentRef, "output", "voyage-projection__time", { "aria-hidden": "true" });
  timer.textContent = "00:57";
  hud.append(mission, timer);

  const narrative = makeElement(documentRef, "div", "voyage-projection__narrative");
  const caption = makeElement(documentRef, "p", "voyage-projection__caption", {
    role: "status",
    "aria-live": "polite",
    "aria-atomic": "true"
  });
  const finalText = makeElement(documentRef, "div", "voyage-projection__final", { hidden: "" });
  finalText.append(...VOYAGE_FINAL_TEXT.map((line) => {
    const row = makeElement(documentRef, "strong");
    row.textContent = line;
    return row;
  }));
  narrative.append(caption, finalText);

  const controls = makeElement(documentRef, "div", "voyage-projection__controls");
  const sound = makeElement(documentRef, "button", "voyage-projection__sound", {
    type: "button",
    "aria-pressed": "true",
    "aria-label": "Mute narration"
  });
  sound.innerHTML = "<span aria-hidden=\"true\">&#9835;</span><b>Narration</b>";
  const skip = makeElement(documentRef, "button", "voyage-projection__skip", {
    type: "button",
    "aria-label": "Skip voyage projection"
  });
  skip.innerHTML = "<b>Skip</b><span aria-hidden=\"true\">&rarr;</span>";
  controls.append(sound, skip);

  const progress = makeElement(documentRef, "div", "voyage-projection__progress", {
    role: "progressbar",
    "aria-label": "Voyage projection progress",
    "aria-valuemin": "0",
    "aria-valuemax": "100",
    "aria-valuenow": "0"
  });
  const progressBar = makeElement(documentRef, "i");
  progress.append(progressBar);

  root.append(video, canvas, poster, posterEcho, plateSnapshot, grade, hud, narrative, controls, progress, title, status);
  return Object.freeze({
    root, video, canvas, poster, posterEcho, plateSnapshot, hud, missionShot, timer, caption, finalText,
    sound, skip, progress, progressBar, status
  });
}

function inertSiblings(documentRef, root) {
  const records = [];
  for (const element of documentRef.body?.children || []) {
    if (element === root) continue;
    const tagName = String(element.tagName || "").toUpperCase();
    if (["SCRIPT", "STYLE", "LINK"].includes(tagName)) continue;
    records.push({
      element,
      inert: element.inert,
      hadInertAttribute: element.hasAttribute?.("inert") === true,
      inertAttribute: element.getAttribute?.("inert"),
      ariaHidden: element.getAttribute?.("aria-hidden")
    });
    try { element.inert = true; } catch { /* Best effort for old browsers. */ }
    element.setAttribute?.("inert", "");
    element.setAttribute?.("aria-hidden", "true");
  }
  return () => {
    for (const record of records) {
      try { record.element.inert = record.inert; } catch { /* Best effort. */ }
      if (record.hadInertAttribute) record.element.setAttribute?.("inert", record.inertAttribute ?? "");
      else record.element.removeAttribute?.("inert");
      if (record.ariaHidden == null) record.element.removeAttribute?.("aria-hidden");
      else record.element.setAttribute?.("aria-hidden", record.ariaHidden);
    }
  };
}

function restoreProjectionFocus(documentRef, previous) {
  if (previous?.isConnected) {
    previous.focus?.({ preventScroll: true });
    return;
  }
  const fallback = documentRef.querySelector?.(
    "[data-home-orbit-tab][aria-selected='true'], #primaryOrbitButton, main button:not([disabled])"
  );
  fallback?.focus?.({ preventScroll: true });
}

function pickNarrationVoice(speech) {
  const voices = speech?.getVoices?.() || [];
  const scored = voices.map((voice) => {
    const identity = `${voice.name || ""} ${voice.lang || ""}`.toLocaleLowerCase("en");
    let score = /en[-_](gb|us|au)/.test(identity) ? 20 : identity.includes("en") ? 8 : 0;
    if (/aria|sonia|serena|ava|samantha|natural|neural/.test(identity)) score += 12;
    if (/male|david|mark/.test(identity)) score += 2;
    if (/compact|espeak/.test(identity)) score -= 8;
    return { voice, score };
  }).sort((left, right) => right.score - left.score || String(left.voice.name).localeCompare(String(right.voice.name), "en"));
  return scored[0]?.voice || null;
}

export function createVoyageNarrator({ windowRef = globalThis.window, enabled = true } = {}) {
  const speech = windowRef?.speechSynthesis;
  let active = Boolean(enabled);
  let lastCueId = "";
  function cancel() { try { speech?.cancel?.(); } catch { /* Optional browser service. */ } }
  function speak(cue) {
    if (!active || !cue?.text || !speech || cue.id === lastCueId || typeof windowRef?.SpeechSynthesisUtterance !== "function") return false;
    lastCueId = cue.id;
    cancel();
    const utterance = new windowRef.SpeechSynthesisUtterance(cue.text);
    utterance.voice = pickNarrationVoice(speech);
    utterance.rate = 0.88;
    utterance.pitch = 0.82;
    utterance.volume = 0.82;
    try { speech.speak(utterance); return true; } catch { return false; }
  }
  return Object.freeze({
    speak,
    cancel,
    reset() { lastCueId = ""; cancel(); },
    setEnabled(value) { active = Boolean(value); if (!active) cancel(); return active; },
    get enabled() { return active; }
  });
}

function shotLabel(id) {
  return ({
    earth: "EARTH DEPARTURE",
    solar: "SOLAR TRANSIT",
    heliopause: "THE LAST SOLAR WIND",
    warp: "INTERSTELLAR CORRIDOR",
    "black-hole": "BEYOND THE LAST LIGHT",
    singularity: "SINGULARITY",
    return: "ROUTE UNRESOLVED",
    beyond: "THE MAP CONTINUES"
  })[id] || "VOYAGE PROJECTION";
}

/**
 * Real-time, presentation-only Voyage Projection. It defaults to the Earth
 * promise used at first open, while optional immutable world facts let a
 * Settings replay reflect confirmed progress. The first-open prologue promises
 * the voyage but does not move the player's authoritative world location; no
 * variant emits an expedition-arrival intent.
 */
export function createVoyageProjectionExperience({
  documentRef = globalThis.document,
  storage = null,
  sessionStorage = null,
  storageKey = FIRST_OPEN_CINEMATIC_STORAGE_KEY,
  sessionKey = FIRST_OPEN_CINEMATIC_SESSION_KEY,
  choice = "realtime",
  variant = "promise",
  currentWorldId = "earth",
  completedWorldIds = [],
  actionableWorldIds = ["earth", "moon"],
  bypass = null,
  onPlaybackIntent = null,
  onHandoff = null,
  onEvent = null,
  loadThree = () => import("three"),
  mediaLoader = loadApprovedVoyageMedia,
  runtimeFactory = createVoyageProjectionRuntime,
  sceneFactory = createVoyageProjectionScene,
  timers = documentRef?.defaultView || globalThis,
  now = () => documentRef?.defaultView?.performance?.now?.() ?? Date.now()
} = {}) {
  if (!documentRef?.body || !documentRef?.createElement) {
    throw new TypeError("Voyage Projection requires a document-backed body.");
  }
  const local = safeStorage(storage, "localStorage");
  const session = safeStorage(sessionStorage, "sessionStorage");
  const timerHost = typeof timers?.setTimeout === "function" ? timers : globalThis;
  const projectionVariant = normalizeVoyageVariant(variant);
  const projectionFacts = Object.freeze({
    currentWorldId,
    completedWorldIds: Array.isArray(completedWorldIds)
      ? [...completedWorldIds]
      : completedWorldIds instanceof Set ? [...completedWorldIds] : [],
    actionableWorldIds: Array.isArray(actionableWorldIds)
      ? [...actionableWorldIds]
      : actionableWorldIds instanceof Set ? [...actionableWorldIds] : ["earth", "moon"]
  });
  let active = null;
  let activeSkip = null;

  function emit(type, detail = {}) {
    try { onEvent?.(frozen({ type, ...detail })); } catch { /* Analytics is optional. */ }
  }

  async function playLaunch({ persist = true, force = false } = {}) {
    if (active) return active;
    let storedBypass = false;
    try { storedBypass = session?.getItem?.(FIRST_OPEN_CINEMATIC_BYPASS_KEY) === "true"; } catch { /* Storage is optional. */ }
    let bypassed = storedBypass;
    try {
      bypassed = typeof bypass === "function"
        ? Boolean(bypass())
        : bypass == null
          ? storedBypass
          : Boolean(bypass);
    } catch {
      bypassed = storedBypass;
    }
    if (bypassed) {
      let menuHandoff = false;
      try { await onHandoff?.(); menuHandoff = true; } catch { /* Startup owns the final fallback. */ }
      const outcome = frozen({ played: false, handled: true, reason: "bypassed", completed: false, skipped: false, menuHandoff, playbackRate: 0 });
      emit("bypassed", outcome);
      return outcome;
    }
    const sessionPlayedBefore = hasPlayedFirstOpenCinematicThisSession(session, sessionKey);
    if (!force && sessionPlayedBefore) {
      let menuHandoff = false;
      try { await onHandoff?.(); menuHandoff = true; } catch { /* Startup owns the final fallback. */ }
      const outcome = frozen({ played: false, handled: true, reason: "session-played", completed: false, skipped: false, menuHandoff, playbackRate: 0 });
      emit("session-played", outcome);
      return outcome;
    }

    const reducedMotion = prefersReducedMotion(documentRef);
    const delivery = resolveVoyageProjectionDelivery({
      choice,
      reducedMotion,
      saveData: saveDataEnabled(documentRef),
      webgl2: supportsWebGl2(documentRef)
    });
    const approvedMedia = delivery.delivery === "video"
      ? await mediaLoader({ variant: projectionVariant })
      : null;
    if (delivery.delivery === "video" && !approvedMedia) {
      return frozen({ played: false, handled: false, reason: "video-requested", completed: false, skipped: false, menuHandoff: false, playbackRate: 0 });
    }

    active = (async () => {
      let dom = null;
      let restoreFocus = null;
      let restoreInert = () => {};
      let sessionMarkerOwned = false;
      let outcome = null;
      let finishPromise = null;
      let resolveSettlement = null;
      const settlement = new Promise((resolve) => { resolveSettlement = resolve; });
      const raceWithSettlement = async (work) => {
        const result = await Promise.race([
          Promise.resolve(work).then(
            (value) => ({ kind: "value", value }),
            (error) => ({ kind: "error", error })
          ),
          settlement.then(() => ({ kind: "settled" }))
        ]);
        if (result.kind === "error") throw result.error;
        return result;
      };
      let scene = null;
      let runtime = null;
      let activeDelivery = delivery.delivery;
      let masterVideoPlaying = false;
      let videoTimeUpdate = null;
      let videoEnded = null;
      let videoError = null;
      let plateTransition = null;
      let resizeObserver = null;
      let hardTimeout = null;
      let hardTimeoutStartedAt = null;
      let hardTimeoutRemaining = reducedMotion ? 32_000 : 68_000;
      let keydown = null;
      let soundToggle = null;
      let visibilityChange = null;
      let skip = null;
      let finish = null;
      let handoffPromise = null;
      let styleState = "unavailable";
      const narrator = createVoyageNarrator({ windowRef: documentRef.defaultView, enabled: true });
      const worldPresentation = createVoyageWorldPresentation(projectionFacts);

      const callHandoff = () => {
        if (handoffPromise) return handoffPromise;
        handoffPromise = (async () => {
          try { await onHandoff?.(); return true; }
          catch { return false; }
        })();
        return handoffPromise;
      };

      const clockNow = () => {
        try {
          const value = Number(now());
          return Number.isFinite(value) ? value : Date.now();
        } catch {
          return Date.now();
        }
      };

      const clearHardTimeout = ({ preserveRemaining = false } = {}) => {
        if (hardTimeout === null) return;
        timerHost.clearTimeout?.(hardTimeout);
        hardTimeout = null;
        if (preserveRemaining && hardTimeoutStartedAt !== null) {
          hardTimeoutRemaining = Math.max(1, hardTimeoutRemaining - Math.max(0, clockNow() - hardTimeoutStartedAt));
        }
        hardTimeoutStartedAt = null;
      };

      const armHardTimeout = () => {
        if (finishPromise || hardTimeout !== null || documentRef.hidden || documentRef.visibilityState === "hidden") return;
        hardTimeoutStartedAt = clockNow();
        hardTimeout = timerHost.setTimeout(() => {
          hardTimeout = null;
          hardTimeoutStartedAt = null;
          runtime?.pause?.("timeout");
          void finish?.("timeout", runtime?.snapshot?.() || null);
        }, hardTimeoutRemaining);
      };

      finish = (reason, completion = null) => {
        if (finishPromise) return finishPromise;
        resolveSettlement?.();
        resolveSettlement = null;
        clearHardTimeout();
        runtime?.pause?.("handoff");
        scene?.suspend?.("handoff");
        dom?.video?.pause?.();
        const completed = reason === "completed" || reason === "skipped";
        finishPromise = (async () => {
          narrator.cancel();
          dom.root.dataset.phase = "handoff";
          dom.status.textContent = reason === "skipped"
            ? "Projection skipped. Opening Home."
            : reason === "completed"
              ? "Projection complete. Opening Home."
              : "Projection unavailable. Opening Home.";
          let persisted = false;
          if (persist && completed) {
            persisted = markFirstOpenCinematicComplete(local, { storageKey });
          } else if (!completed && sessionMarkerOwned) {
            clearFirstOpenCinematicSession(session, sessionKey);
            sessionMarkerOwned = false;
          }
          await delay(timerHost, reducedMotion ? 90 : 520);
          const menuHandoff = await callHandoff();
          dom.root.dataset.phase = "exit";
          await delay(timerHost, reducedMotion ? 40 : 360);
          outcome = frozen({
            played: true,
            handled: true,
            reason,
            completed,
            skipped: reason === "skipped",
            persisted,
            menuHandoff,
            playbackRate: 1,
            delivery: dom.root.dataset.delivery || delivery.delivery,
            styleState,
            completion,
            progressionEffect: null
          });
          emit("complete", outcome);
          return outcome;
        })();
        return finishPromise;
      };

      try {
        styleState = await ensureStyles(documentRef);
        dom = buildVoyageProjectionDom(documentRef);
        if (styleState !== "loaded" && styleState !== "existing") {
          applyCriticalFallbackStyles(dom);
          emit("style-fallback", { reason: styleState });
        }
        restoreFocus = documentRef.activeElement;
        documentRef.body.append(dom.root);
        documentRef.body.classList?.add("voyage-projection-active");
        restoreInert = inertSiblings(documentRef, dom.root);
        sessionMarkerOwned = !sessionPlayedBefore
          && markFirstOpenCinematicSessionPlayed(session, sessionKey);
        try { onPlaybackIntent?.(); } catch { /* Audio priming is optional. */ }
        dom.root.dataset.delivery = delivery.delivery;
        dom.root.dataset.reducedMotion = String(reducedMotion);
        dom.root.dataset.variant = projectionVariant;
        dom.root.dataset.currentWorld = worldPresentation.currentWorldId;
        dom.root.dataset.styleState = styleState;
        plateTransition = createVoyagePlateTransitionController({
          root: dom.root,
          canvas: dom.canvas,
          poster: dom.poster,
          posterEcho: dom.posterEcho,
          plateSnapshot: dom.plateSnapshot,
          reducedMotion,
          timers: timerHost
        });
        plateTransition.setInitial({
          shotId: "earth",
          variant: projectionVariant,
          currentWorldId: worldPresentation.currentWorldId
        });
        dom.root.dataset.phase = "reveal";
        dom.skip.focus?.({ preventScroll: true });

        if (approvedMedia) {
          configureVoyageMasterVideo(dom.video, approvedMedia, documentRef);
          videoTimeUpdate = () => {
            const seconds = Math.max(0, Math.min(VOYAGE_DURATION_SECONDS, Number(dom.video.currentTime) || 0));
            const percent = Math.round((seconds / VOYAGE_DURATION_SECONDS) * 100);
            const shot = shotAtTime(seconds, { variant: projectionVariant });
            dom.root.dataset.shot = shot.id;
            dom.missionShot.textContent = shotLabel(shot.id);
            dom.progress.setAttribute("aria-valuenow", String(percent));
            dom.progressBar.style.setProperty("--voyage-progress", `${percent}%`);
            dom.timer.textContent = `00:${String(Math.max(0, Math.ceil(VOYAGE_DURATION_SECONDS - seconds))).padStart(2, "0")}`;
            dom.finalText.hidden = shot.id !== "return";
          };
          videoEnded = () => { void finish?.("completed", { completionReason: "master-video", skipped: false }); };
          videoError = () => {
            if (!masterVideoPlaying || finishPromise) return;
            void finish?.("fallback", { reason: "approved-media-playback-failed" });
          };
          dom.video.addEventListener("timeupdate", videoTimeUpdate);
          dom.video.addEventListener("ended", videoEnded, { once: true });
          dom.video.addEventListener("error", videoError);
          try {
            await dom.video.play?.();
            masterVideoPlaying = true;
            dom.root.dataset.delivery = "video";
          } catch {
            activeDelivery = supportsWebGl2(documentRef) ? "realtime" : "poster";
            dom.root.dataset.delivery = activeDelivery;
            dom.root.dataset.videoFallback = "autoplay-rejected";
          }
        }

        skip = () => {
          if (finishPromise) return false;
          const completion = runtime?.skip?.() || null;
          if (!finishPromise) void finish("skipped", completion);
          return true;
        };
        activeSkip = skip;
        keydown = (event) => {
          if (event.key !== "Escape") return;
          event.preventDefault?.();
          skip();
        };
        soundToggle = () => {
          if (masterVideoPlaying) {
            dom.video.muted = !dom.video.muted;
            const enabled = !dom.video.muted;
            dom.sound.setAttribute("aria-pressed", String(enabled));
            dom.sound.setAttribute("aria-label", enabled ? "Mute projection audio" : "Enable projection audio");
            const label = dom.sound.querySelector?.("b");
            if (label) label.textContent = enabled ? "Sound" : "Muted";
            return;
          }
          const enabled = narrator.setEnabled(!narrator.enabled);
          dom.sound.setAttribute("aria-pressed", String(enabled));
          dom.sound.setAttribute("aria-label", enabled ? "Mute narration" : "Enable narration");
          const label = dom.sound.querySelector?.("b");
          if (label) label.textContent = enabled ? "Narration" : "Muted";
        };
        visibilityChange = () => {
          const hidden = Boolean(documentRef.hidden || documentRef.visibilityState === "hidden");
          if (hidden) {
            clearHardTimeout({ preserveRemaining: true });
            narrator.reset();
            scene?.suspend?.("visibility");
            if (masterVideoPlaying) dom.video.pause?.();
            return;
          }
          scene?.resume?.("visibility");
          if (masterVideoPlaying && !dom.video.ended) void dom.video.play?.().catch?.(() => {});
          const cue = runtime?.snapshot?.().narrationCue;
          if (cue) narrator.speak(cue);
          armHardTimeout();
        };
        dom.skip.addEventListener("click", skip);
        dom.sound.addEventListener("click", soundToggle);
        documentRef.addEventListener("keydown", keydown, true);
        documentRef.addEventListener("visibilitychange", visibilityChange);

        if (activeDelivery === "realtime" && !finishPromise) {
          try {
            const loadedThree = await raceWithSettlement(loadThree());
            if (loadedThree.kind === "settled" || finishPromise) {
              await finishPromise;
              return outcome;
            }
            const module = loadedThree.value;
            const THREE = module?.default?.Scene ? module.default : module;
            const quality = selectVoyageQuality({
              variant: projectionVariant,
              webgl2: true,
              preferMasterVideo: false,
              reducedMotion: false,
              saveData: false,
              width: documentRef.defaultView?.innerWidth,
              height: documentRef.defaultView?.innerHeight,
              deviceMemory: documentRef.defaultView?.navigator?.deviceMemory,
              hardwareConcurrency: documentRef.defaultView?.navigator?.hardwareConcurrency,
              coarsePointer: documentRef.defaultView?.matchMedia?.("(pointer: coarse)")?.matches,
              mobile: documentRef.defaultView?.matchMedia?.("(max-width: 700px)")?.matches
            });
            scene = sceneFactory({
              canvas: dom.canvas,
              THREE,
              quality,
              reducedMotion,
              onFallback: ({ reason }) => {
                dom.root.dataset.delivery = "poster";
                dom.root.dataset.sceneFallback = reason;
              }
            });
            const bounds = dom.root.getBoundingClientRect?.() || {};
            const prepared = await raceWithSettlement(scene.prepare({ width: bounds.width, height: bounds.height }));
            if (prepared.kind === "settled" || finishPromise) {
              await finishPromise;
              return outcome;
            }
            if (scene.snapshot?.().phase === "fallback") dom.root.dataset.delivery = "poster";
            const ResizeObserverCtor = documentRef.defaultView?.ResizeObserver;
            if (!finishPromise && typeof ResizeObserverCtor === "function") {
              resizeObserver = new ResizeObserverCtor((entries) => {
                const rect = entries[0]?.contentRect;
                if (rect) scene?.resize({ width: rect.width, height: rect.height });
              });
              resizeObserver.observe(dom.root);
            }
          } catch (error) {
            dom.root.dataset.delivery = "poster";
            dom.root.dataset.sceneFallback = "load-failed";
            emit("scene-fallback", { message: error?.message || String(error) });
          }
        }

        if (!finishPromise && !masterVideoPlaying) {
          runtime = runtimeFactory({
            variant: projectionVariant,
            reducedMotion,
            arrivalWorldId: null,
            visibilityTarget: documentRef,
            onShotChange(shot) {
              plateTransition.transitionTo({
                shotId: shot.id,
                variant: projectionVariant,
                currentWorldId: worldPresentation.currentWorldId
              });
              dom.missionShot.textContent = shotLabel(shot.id);
              dom.status.textContent = `Voyage projection: ${shotLabel(shot.id).toLocaleLowerCase("en")}.`;
              dom.finalText.hidden = shot.id !== "return";
            },
            onNarrationCue(cue) {
              dom.caption.textContent = cue?.text || "";
              dom.caption.toggleAttribute("data-speaking", Boolean(cue));
              if (cue) narrator.speak(cue);
            },
            onProgress(snapshot) {
              scene?.sync({ projectionSnapshot: snapshot, worldPresentation });
              const percent = Math.round(snapshot.progress * 100);
              dom.progress.setAttribute("aria-valuenow", String(percent));
              dom.progressBar.style.setProperty("--voyage-progress", `${percent}%`);
              const remaining = Math.max(0, Math.ceil(VOYAGE_DURATION_SECONDS - snapshot.timelineSeconds));
              dom.timer.textContent = `00:${String(remaining).padStart(2, "0")}`;
            },
            onCompletion(completion) {
              const skipped = completion?.skipped === true || completion?.completionReason === "skip";
              void finish(skipped ? "skipped" : "completed", completion);
            },
            onFallback(info) {
              dom.root.dataset.delivery = "poster";
              emit("runtime-fallback", { reason: info.reason });
              void finish("fallback", info);
            }
          });
          emit("start", { delivery: dom.root.dataset.delivery, reducedMotion });
          runtime.start();
          visibilityChange();
          armHardTimeout();
        } else if (!finishPromise && masterVideoPlaying) {
          emit("start", { delivery: "video", reducedMotion: false });
          armHardTimeout();
        }

        await settlement;
        if (finishPromise) await finishPromise;
      } catch (error) {
        emit("failure", { message: error?.message || String(error) });
        if (dom && finish) {
          try { await finish("failed", { message: error?.message || String(error) }); }
          catch { /* The unconditional cleanup below still restores Home. */ }
        } else {
          if (sessionMarkerOwned) clearFirstOpenCinematicSession(session, sessionKey);
          const menuHandoff = await callHandoff();
          outcome = frozen({
            played: false,
            handled: true,
            reason: "failed",
            completed: false,
            skipped: false,
            persisted: false,
            menuHandoff,
            playbackRate: 0,
            delivery: delivery.delivery,
            styleState,
            progressionEffect: null
          });
        }
      } finally {
        clearHardTimeout();
        if (activeSkip === skip) activeSkip = null;
        if (keydown) documentRef.removeEventListener("keydown", keydown, true);
        if (visibilityChange) documentRef.removeEventListener("visibilitychange", visibilityChange);
        if (dom && skip) dom.skip.removeEventListener("click", skip);
        if (dom && soundToggle) dom.sound.removeEventListener("click", soundToggle);
        if (dom && videoTimeUpdate) dom.video.removeEventListener("timeupdate", videoTimeUpdate);
        if (dom && videoEnded) dom.video.removeEventListener("ended", videoEnded);
        if (dom && videoError) dom.video.removeEventListener("error", videoError);
        resizeObserver?.disconnect?.();
        runtime?.destroy?.();
        scene?.destroy?.();
        plateTransition?.destroy?.();
        narrator.cancel();
        restoreInert();
        documentRef.body.classList?.remove("voyage-projection-active");
        dom?.root?.remove?.();
        restoreProjectionFocus(documentRef, restoreFocus);
      }
      return outcome || frozen({ played: false, handled: true, reason: "failed", menuHandoff: false, playbackRate: 0 });
    })();

    try { return await active; }
    finally {
      active = null;
      activeSkip = null;
    }
  }

  return Object.freeze({
    playLaunch,
    playIfNeeded: playLaunch,
    skip() { return activeSkip?.() === true; },
    get active() { return Boolean(active); },
    hasCompleted() { return hasCompletedFirstOpenCinematic(local, storageKey); }
  });
}
