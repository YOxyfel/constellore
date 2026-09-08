const STORAGE_SCHEMA_VERSION = 1;
const STYLE_MARKER = "data-first-open-cinematic-style";
const FIXED_PLAYBACK_RATE = 1;
const DEFAULT_HANDOFF_MS = 820;
const REDUCED_HANDOFF_MS = 90;
// The new wide ident fades into the rocket film at 15 seconds.
const LANDSCAPE_BRAND_RATE_CUE_SECONDS = 15;
// The phone cut includes a short black pre-roll before the ident fades in.
const PHONE_BRAND_RATE_CUE_SECONDS = 15.25;
const HANDOFF_LEAD_SECONDS = 0.55;
const PHONE_VIDEO_MEDIA_QUERY = "(orientation: portrait)";
const FIRST_STUDIO_IDENT_TIMING = Object.freeze({
  blackout: 800
});
const REPEAT_STUDIO_IDENT_TIMING = Object.freeze({
  blackout: 650
});

export const FIRST_OPEN_CINEMATIC_STORAGE_KEY = "constellore-first-open-cinematic-v1";
export const FIRST_OPEN_CINEMATIC_SESSION_KEY = "constellore-launch-cinematic-session-v1";
export const FIRST_OPEN_CINEMATIC_BYPASS_KEY = "constellore-e2e-skip-launch-cinematic-v1";
export const FIRST_OPEN_CINEMATIC_VIDEO_PATH = "./intro-video.mp4";
export const FIRST_OPEN_CINEMATIC_PHONE_VIDEO_PATH = "./intro-video-phone.mp4";
export const FIRST_OPEN_CINEMATIC_REPEAT_RATE = FIXED_PLAYBACK_RATE;
export const FIRST_OPEN_CINEMATIC_BRAND_RATE_CUE_SECONDS = LANDSCAPE_BRAND_RATE_CUE_SECONDS;
export const FIRST_OPEN_CINEMATIC_PHONE_BRAND_RATE_CUE_SECONDS = PHONE_BRAND_RATE_CUE_SECONDS;
export const FIRST_OPEN_CINEMATIC_HANDOFF_LEAD_SECONDS = HANDOFF_LEAD_SECONDS;

export function launchStudioIdentTiming({ repeat = false } = {}) {
  return repeat ? REPEAT_STUDIO_IDENT_TIMING : FIRST_STUDIO_IDENT_TIMING;
}

export function firstOpenCinematicBrandRateCueSeconds(videoLayout = "landscape") {
  return videoLayout === "phone"
    ? PHONE_BRAND_RATE_CUE_SECONDS
    : LANDSCAPE_BRAND_RATE_CUE_SECONDS;
}

const styleLoads = new WeakMap();

function safeStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function safeSessionStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

function completionRecord(now = Date.now) {
  const rawTimestamp = typeof now === "function" ? now() : now;
  const timestamp = Number.isFinite(Number(rawTimestamp))
    ? Number(rawTimestamp)
    : Date.now();
  return Object.freeze({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    completed: true,
    completedAt: new Date(timestamp).toISOString()
  });
}

export function hasCompletedFirstOpenCinematic(
  storage = safeStorage(),
  storageKey = FIRST_OPEN_CINEMATIC_STORAGE_KEY
) {
  try {
    const raw = storage?.getItem?.(storageKey);
    if (!raw) return false;
    if (raw === "1" || raw === "complete") return true;
    const parsed = JSON.parse(raw);
    return parsed?.schemaVersion === STORAGE_SCHEMA_VERSION && parsed.completed === true;
  } catch {
    return false;
  }
}

export function markFirstOpenCinematicComplete(
  storage = safeStorage(),
  {
    storageKey = FIRST_OPEN_CINEMATIC_STORAGE_KEY,
    now = Date.now
  } = {}
) {
  try {
    storage?.setItem?.(storageKey, JSON.stringify(completionRecord(now)));
    return storage?.getItem?.(storageKey) != null;
  } catch {
    return false;
  }
}

export function clearFirstOpenCinematicCompletion(
  storage = safeStorage(),
  storageKey = FIRST_OPEN_CINEMATIC_STORAGE_KEY
) {
  try {
    storage?.removeItem?.(storageKey);
    return true;
  } catch {
    return false;
  }
}

export function hasPlayedFirstOpenCinematicThisSession(
  storage = safeSessionStorage(),
  storageKey = FIRST_OPEN_CINEMATIC_SESSION_KEY
) {
  try {
    return storage?.getItem?.(storageKey) === "played";
  } catch {
    return false;
  }
}

export function markFirstOpenCinematicSessionPlayed(
  storage = safeSessionStorage(),
  storageKey = FIRST_OPEN_CINEMATIC_SESSION_KEY
) {
  try {
    storage?.setItem?.(storageKey, "played");
    return storage?.getItem?.(storageKey) === "played";
  } catch {
    return false;
  }
}

export function clearFirstOpenCinematicSession(
  storage = safeSessionStorage(),
  storageKey = FIRST_OPEN_CINEMATIC_SESSION_KEY
) {
  try {
    storage?.removeItem?.(storageKey);
    return true;
  } catch {
    return false;
  }
}

export function launchCinematicPlaybackRateAt() {
  return FIXED_PLAYBACK_RATE;
}

export function launchCinematicPlan({
  completed = false,
  reducedMotion = false
} = {}) {
  const repeat = Boolean(completed);
  const reduced = Boolean(reducedMotion);
  return Object.freeze({
    shouldPlay: !reduced,
    repeat,
    playbackRate: reduced ? 0 : FIXED_PLAYBACK_RATE,
    handoffDuration: reduced ? REDUCED_HANDOFF_MS : DEFAULT_HANDOFF_MS
  });
}

function createElement(documentRef, tagName, className = "", attributes = {}) {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) element.setAttribute(name, String(value));
  }
  return element;
}

function versionedVideoUrl(path) {
  const moduleUrl = new URL(import.meta.url);
  const videoUrl = new URL(path, moduleUrl);
  videoUrl.search = moduleUrl.search;
  return videoUrl.href;
}

export function prefersPhoneFirstOpenCinematic(documentRef = globalThis.document) {
  const view = documentRef?.defaultView;
  try {
    if (typeof view?.matchMedia === "function") {
      return view.matchMedia(PHONE_VIDEO_MEDIA_QUERY).matches === true;
    }
  } catch {
    // Fall through to bounded viewport dimensions.
  }
  const width = Number(view?.innerWidth);
  const height = Number(view?.innerHeight);
  return Number.isFinite(width)
    && Number.isFinite(height)
    && width > 0
    && height > 0
    && height > width;
}

export function firstOpenCinematicVideoSelection(documentRef = globalThis.document) {
  const phone = prefersPhoneFirstOpenCinematic(documentRef);
  const path = phone
    ? FIRST_OPEN_CINEMATIC_PHONE_VIDEO_PATH
    : FIRST_OPEN_CINEMATIC_VIDEO_PATH;
  return Object.freeze({
    layout: phone ? "phone" : "landscape",
    path,
    url: versionedVideoUrl(path)
  });
}

export function buildFirstOpenCinematicDom(
  documentRef = globalThis.document,
  { videoUrl = null, videoLayout = null } = {}
) {
  if (!documentRef?.createElement) {
    throw new TypeError("Launch cinematic requires a document.");
  }

  const defaultVideo = firstOpenCinematicVideoSelection(documentRef);
  const resolvedVideoUrl = videoUrl || defaultVideo.url;
  const resolvedVideoLayout = videoLayout || (videoUrl ? "custom" : defaultVideo.layout);
  const root = createElement(documentRef, "section", "first-open-cinematic", {
    "data-first-open-cinematic": "",
    "data-phase": "loading",
    "data-video-layout": resolvedVideoLayout,
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "firstOpenCinematicTitle",
    "aria-describedby": "firstOpenCinematicStatus"
  });

  const title = createElement(
    documentRef,
    "h1",
    "first-open-cinematic__sr-only",
    { id: "firstOpenCinematicTitle" }
  );
  title.textContent = "Constellore introduction";

  const status = createElement(
    documentRef,
    "p",
    "first-open-cinematic__sr-only",
    {
      id: "firstOpenCinematicStatus",
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true"
    }
  );
  status.textContent = "Playing the Constellore launch cinematic.";

  const studio = createElement(documentRef, "div", "first-open-cinematic__studio", {
    "aria-hidden": "true"
  });
  const starfield = createElement(documentRef, "div", "first-open-cinematic__studio-stars");
  for (let index = 0; index < 12; index += 1) {
    starfield.append(createElement(
      documentRef,
      "i",
      "first-open-cinematic__studio-star",
      { style: `--studio-star-index:${index}` }
    ));
  }

  const lockup = createElement(documentRef, "div", "first-open-cinematic__studio-lockup");
  const mark = createElement(documentRef, "div", "first-open-cinematic__studio-mark");
  mark.append(
    createElement(documentRef, "i", "first-open-cinematic__studio-orbit first-open-cinematic__studio-orbit--outer"),
    createElement(documentRef, "i", "first-open-cinematic__studio-orbit first-open-cinematic__studio-orbit--inner"),
    Object.assign(createElement(documentRef, "b", "first-open-cinematic__studio-star-mark"), {
      textContent: "✦"
    })
  );
  const credit = Object.assign(
    createElement(documentRef, "p", "first-open-cinematic__studio-credit"),
    { textContent: "A PRODUCTION BY" }
  );
  const brand = createElement(documentRef, "h2", "first-open-cinematic__studio-brand");
  brand.append(
    Object.assign(createElement(documentRef, "span"), { textContent: "OXYFEL" }),
    Object.assign(createElement(documentRef, "em"), { textContent: "GAMES" })
  );
  const signature = Object.assign(
    createElement(documentRef, "p", "first-open-cinematic__studio-signature"),
    { textContent: "FORGED AMONG THE STARS" }
  );
  lockup.append(mark, credit, brand, signature);
  studio.append(starfield, lockup);

  const video = createElement(documentRef, "video", "first-open-cinematic__video", {
    src: resolvedVideoUrl,
    preload: "auto",
    playsinline: "",
    "aria-hidden": "true"
  });
  video.controls = false;
  video.disablePictureInPicture = true;
  video.playsInline = true;
  video.defaultMuted = false;
  video.muted = false;
  video.tabIndex = -1;

  const handoff = createElement(documentRef, "div", "first-open-cinematic__handoff", {
    "aria-hidden": "true"
  });
  handoff.append(
    createElement(documentRef, "i", "first-open-cinematic__handoff-ring"),
    createElement(documentRef, "i", "first-open-cinematic__handoff-core")
  );

  const controls = createElement(documentRef, "div", "first-open-cinematic__controls");
  const sound = createElement(documentRef, "button", "first-open-cinematic__sound", {
    type: "button",
    "aria-label": "Mute introduction",
    "aria-pressed": "false"
  });
  sound.textContent = "Sound on";

  const skip = createElement(documentRef, "button", "first-open-cinematic__skip", {
    type: "button",
    "aria-label": "Skip introduction"
  });
  skip.append(
    Object.assign(createElement(documentRef, "span"), { textContent: "Skip intro" }),
    Object.assign(createElement(documentRef, "i", "", { "aria-hidden": "true" }), { textContent: "→" })
  );
  controls.append(sound, skip);
  root.append(video, studio, handoff, title, status, controls);

  return Object.freeze({
    root,
    video,
    studio,
    starfield,
    lockup,
    mark,
    credit,
    brand,
    signature,
    handoff,
    title,
    status,
    controls,
    sound,
    skip
  });
}

function ensureStyles(documentRef) {
  if (!documentRef?.head) return Promise.resolve(false);
  if (styleLoads.has(documentRef)) return styleLoads.get(documentRef);
  if (documentRef.querySelector?.(`[${STYLE_MARKER}]`)) return Promise.resolve(true);

  const link = documentRef.createElement("link");
  const moduleUrl = new URL(import.meta.url);
  const styleUrl = new URL("./first-open-cinematic.css?v=5.0.0-beta.4", moduleUrl);
  styleUrl.search = moduleUrl.search;
  link.rel = "stylesheet";
  link.href = styleUrl.href;
  link.setAttribute(STYLE_MARKER, "");
  const promise = new Promise((resolve) => {
    link.addEventListener("load", () => resolve(true), { once: true });
    link.addEventListener("error", () => resolve(false), { once: true });
    documentRef.head.append(link);
  });
  styleLoads.set(documentRef, promise);
  return promise;
}

function snapshotInertSurfaces(documentRef, root) {
  const elements = Array.from(documentRef.body?.children || [])
    .filter((element) => (
      element !== root
      && !["SCRIPT", "STYLE", "LINK"].includes(String(element.tagName || "").toUpperCase())
      && typeof element.setAttribute === "function"
    ));
  const snapshots = elements.map((element) => ({
    element,
    inert: Boolean(element.inert),
    hadAttribute: element.hasAttribute?.("inert") === true,
    attribute: element.getAttribute?.("inert")
  }));
  snapshots.forEach(({ element }) => {
    if ("inert" in element) element.inert = true;
    element.setAttribute("inert", "");
  });
  return () => snapshots.forEach(({ element, inert, hadAttribute, attribute }) => {
    if ("inert" in element) element.inert = inert;
    if (hadAttribute) element.setAttribute?.("inert", attribute ?? "");
    else element.removeAttribute?.("inert");
  });
}

function defaultReducedMotion(documentRef) {
  return documentRef?.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function defaultBypass() {
  try {
    return globalThis.sessionStorage?.getItem?.(FIRST_OPEN_CINEMATIC_BYPASS_KEY) === "true";
  } catch {
    return false;
  }
}

function isAutoplayPermissionError(error) {
  return error?.name === "NotAllowedError";
}

function delay(timers, milliseconds) {
  return new Promise((resolve) => timers.setTimeout(resolve, Math.max(0, milliseconds)));
}

function launchResult({
  played = false,
  handled = false,
  reason = "unavailable",
  persisted = false,
  repeat = false,
  playbackRate = 0,
  menuHandoff = false,
  muted = false
} = {}) {
  return Object.freeze({
    played: Boolean(played),
    handled: Boolean(handled),
    completed: reason === "completed" || reason === "skipped",
    reason,
    persisted: Boolean(persisted),
    repeat: Boolean(repeat),
    playbackRate: Number(playbackRate) || 0,
    menuHandoff: Boolean(menuHandoff),
    muted: Boolean(muted)
  });
}

export function createFirstOpenCinematic({
  documentRef = globalThis.document,
  storage = safeStorage(),
  storageKey = FIRST_OPEN_CINEMATIC_STORAGE_KEY,
  sessionStorage = safeSessionStorage(),
  sessionStorageKey = FIRST_OPEN_CINEMATIC_SESSION_KEY,
  reducedMotion = () => defaultReducedMotion(documentRef),
  bypass = defaultBypass,
  videoUrl = null,
  videoLayout = null,
  loadStyles = true,
  now = Date.now,
  timers = globalThis,
  nextPaint = () => new Promise((resolve) => {
    const frame = documentRef?.defaultView?.requestAnimationFrame || globalThis.requestAnimationFrame;
    if (typeof frame === "function") frame(() => frame(resolve));
    else timers.setTimeout(resolve, 0);
  }),
  onCue = null,
  onPlaybackIntent = null,
  onHandoff = null,
  onComplete = null
} = {}) {
  if (!documentRef?.body || !documentRef?.createElement) {
    throw new TypeError("Launch cinematic requires a document-backed body.");
  }

  let activePromise = null;
  let activeSettle = null;
  let disposed = false;
  let dom = null;

  const emit = (cue, detail = {}) => {
    try {
      if (typeof onCue === "function") onCue(cue, detail);
    } catch {
      // Presentation and analytics hooks must never block app entry.
    }
  };

  const callHandoff = () => {
    try {
      if (typeof onHandoff === "function") onHandoff();
    } catch {
      // The overlay can still reveal the page if a handoff consumer fails.
    }
  };

  const callPlaybackIntent = () => {
    try {
      if (typeof onPlaybackIntent === "function") onPlaybackIntent();
    } catch {
      // Audio preparation is optional and must never block the film.
    }
  };

  const updateSoundButton = () => {
    if (!dom) return;
    const muted = Boolean(dom.video.muted);
    dom.sound.textContent = muted ? "Sound off" : "Sound on";
    dom.sound.setAttribute("aria-label", muted ? "Turn introduction sound on" : "Mute introduction");
    dom.sound.setAttribute("aria-pressed", muted ? "true" : "false");
  };

  const holdPhase = (duration) => new Promise((resolve) => {
    let settled = false;
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      timers.clearTimeout(timeout);
      activeSettle = null;
      resolve(reason);
    };
    const timeout = timers.setTimeout(() => finish("elapsed"), Math.max(0, Number(duration) || 0));
    activeSettle = finish;
  });

  async function revealMenu(plan, reason) {
    if (!dom) {
      callHandoff();
      return;
    }
    if (reason === "completed") {
      dom.root.dataset.phase = "handoff";
    }
    callHandoff();
    documentRef.body.classList?.add("launch-menu-reveal");
    dom.root.dataset.phase = reason === "skipped" ? "skip-reveal" : "reveal";
    emit("handoff", { reason, repeat: plan.repeat, playbackRate: plan.playbackRate });
    await nextPaint();
    await delay(timers, reason === "skipped" ? 240 : plan.handoffDuration);
  }

  async function run({ persist, force }) {
    const completedBefore = hasCompletedFirstOpenCinematic(storage, storageKey);
    const isBypassed = typeof bypass === "function" ? Boolean(bypass()) : Boolean(bypass);
    if (isBypassed) {
      callHandoff();
      const outcome = launchResult({
        handled: true,
        reason: "bypassed",
        repeat: completedBefore,
        menuHandoff: false
      });
      emit("bypassed", outcome);
      return outcome;
    }
    const playedThisSession = hasPlayedFirstOpenCinematicThisSession(
      sessionStorage,
      sessionStorageKey
    );
    if (!force && playedThisSession) {
      callHandoff();
      const outcome = launchResult({
        handled: true,
        reason: "session-played",
        repeat: completedBefore,
        menuHandoff: true
      });
      emit("session-played", outcome);
      try {
        if (typeof onComplete === "function") onComplete(outcome);
      } catch {
        // Completion consumers must not block app entry.
      }
      return outcome;
    }
    markFirstOpenCinematicSessionPlayed(sessionStorage, sessionStorageKey);
    const isReduced = typeof reducedMotion === "function"
      ? Boolean(reducedMotion())
      : Boolean(reducedMotion);
    const plan = launchCinematicPlan({
      completed: completedBefore,
      reducedMotion: isReduced
    });

    if (!plan.shouldPlay) {
      callHandoff();
      let persisted = false;
      if (persist && !completedBefore) {
        persisted = markFirstOpenCinematicComplete(storage, { storageKey, now });
      }
      const outcome = launchResult({
        handled: true,
        reason: "reduced-motion",
        persisted,
        repeat: plan.repeat,
        menuHandoff: true
      });
      emit("reduced-motion", outcome);
      try {
        if (typeof onComplete === "function") onComplete(outcome);
      } catch {
        // Completion consumers must not block app entry.
      }
      return outcome;
    }

    if (loadStyles && !await ensureStyles(documentRef)) {
      emit("unavailable", { reason: "stylesheet" });
      return launchResult({ reason: "unavailable", repeat: plan.repeat });
    }
    if (disposed) return launchResult({ reason: "disposed", repeat: plan.repeat });

    dom = buildFirstOpenCinematicDom(documentRef, { videoUrl, videoLayout });
    const brandRateCueSeconds = firstOpenCinematicBrandRateCueSeconds(
      dom.root.dataset.videoLayout
    );
    dom.root.dataset.repeat = plan.repeat ? "true" : "false";
    dom.root.dataset.playbackRate = String(plan.playbackRate);
    dom.root.dataset.brandPlaybackRate = "1";
    dom.root.dataset.brandRateCue = String(brandRateCueSeconds);
    dom.root.dataset.segment = "brand";
    dom.video.defaultPlaybackRate = 1;
    dom.video.playbackRate = 1;

    const previousFocus = documentRef.activeElement;
    documentRef.body.append(dom.root);
    documentRef.body.classList?.add("first-open-cinematic-active");
    const restoreInert = snapshotInertSurfaces(documentRef, dom.root);

    let started = false;
    let reason = "completed";
    let persisted = false;
    let removeMediaListeners = () => {};

    const keyHandler = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault?.();
      callPlaybackIntent();
      skip();
    };
    const skipHandler = () => {
      callPlaybackIntent();
      skip();
    };
    const soundHandler = () => {
      if (!dom) return;
      callPlaybackIntent();
      dom.video.muted = !dom.video.muted;
      updateSoundButton();
      if (!dom.video.paused) return;
      Promise.resolve(dom.video.play?.()).catch(() => {});
    };

    documentRef.addEventListener?.("keydown", keyHandler);
    dom.skip.addEventListener?.("click", skipHandler);
    dom.sound.addEventListener?.("click", soundHandler);

    try {
      const identTiming = launchStudioIdentTiming({ repeat: plan.repeat });
      dom.root.dataset.phase = "blackout";
      dom.status.textContent = "Preparing the Oxyfel Games brand film.";
      emit("brand-blackout", { repeat: plan.repeat });
      await nextPaint();

      const identReason = await holdPhase(identTiming.blackout);

      if (identReason !== "elapsed") {
        reason = identReason;
      } else {
        dom.root.dataset.phase = "video-prime";
        await nextPaint();
        try {
          callPlaybackIntent();
          dom.video.defaultMuted = false;
          dom.video.muted = false;
          updateSoundButton();
          await dom.video.play?.();
          started = true;
        } catch (error) {
          dom.video.pause?.();
          dom.video.currentTime = 0;
          if (!isAutoplayPermissionError(error)) {
            reason = "media-error";
            emit("media-error", {
              repeat: plan.repeat,
              playbackRate: plan.playbackRate,
              stage: "play"
            });
          } else {
            dom.video.defaultMuted = true;
            dom.video.muted = true;
            updateSoundButton();
            dom.status.textContent = "Starting the introduction with sound available in the controls.";
            try {
              await dom.video.play?.();
              started = true;
              emit("autoplay-muted", {
                repeat: plan.repeat,
                playbackRate: plan.playbackRate
              });
            } catch {
              reason = "media-error";
              emit("media-error", {
                repeat: plan.repeat,
                playbackRate: plan.playbackRate,
                stage: "muted-fallback"
              });
            }
          }
        }

        if (started) {
          dom.root.dataset.phase = "playing";
          dom.root.dataset.segment = "brand";
          dom.video.defaultPlaybackRate = 1;
          dom.video.playbackRate = 1;
          dom.status.textContent = "Playing the Oxyfel Games brand film at normal speed.";
          emit("start", {
            repeat: plan.repeat,
            playbackRate: plan.playbackRate,
            brandPlaybackRate: 1,
            muted: Boolean(dom.video.muted)
          });

          reason = await new Promise((resolve) => {
            let settled = false;
            const settle = (nextReason) => {
              if (settled) return;
              settled = true;
              resolve(nextReason);
            };
            activeSettle = settle;
            const onEnded = () => settle("completed");
            const onError = () => settle("media-error");
            const applySegmentPlaybackRate = (mediaTime) => {
              const currentTime = Number(mediaTime);
              if (
                Number.isFinite(currentTime)
                && currentTime >= brandRateCueSeconds
                && dom?.root.dataset.segment !== "launch"
              ) {
                dom.root.dataset.segment = "launch";
                dom.video.defaultPlaybackRate = plan.playbackRate;
                dom.video.playbackRate = plan.playbackRate;
                dom.status.textContent = plan.repeat
                  ? `Playing the Constellore launch film at ${plan.playbackRate} times speed.`
                  : "Playing the Constellore launch film.";
                emit("launch-film-start", {
                  repeat: plan.repeat,
                  playbackRate: plan.playbackRate
                });
              }
            };
            const applyHandoffPhase = (mediaTime) => {
              const duration = Number(dom?.video.duration);
              const currentTime = Number(mediaTime);
              const playbackRate = Math.max(1, Number(dom?.video.playbackRate) || 1);
              const remainingReal = (duration - currentTime) / playbackRate;
              if (
                Number.isFinite(remainingReal)
                && remainingReal <= HANDOFF_LEAD_SECONDS
                && dom?.root.dataset.phase === "playing"
              ) {
                dom.root.dataset.phase = "handoff";
              }
            };
            const onTimeUpdate = () => {
              applySegmentPlaybackRate(dom?.video.currentTime);
              applyHandoffPhase(dom?.video.currentTime);
            };
            dom.video.addEventListener?.("ended", onEnded);
            dom.video.addEventListener?.("error", onError);
            dom.video.addEventListener?.("timeupdate", onTimeUpdate);
            let videoFrameRequest = null;
            const onVideoFrame = (_now, metadata) => {
              applySegmentPlaybackRate(metadata?.mediaTime);
              applyHandoffPhase(metadata?.mediaTime);
              if (["playing", "handoff"].includes(dom?.root.dataset.phase)) {
                videoFrameRequest = dom.video.requestVideoFrameCallback?.(onVideoFrame) ?? null;
              }
            };
            videoFrameRequest = dom.video.requestVideoFrameCallback?.(onVideoFrame) ?? null;
            const duration = Number(dom.video.duration);
            const expectedSeconds = Number.isFinite(duration) && duration > 0
              ? Math.min(duration, brandRateCueSeconds)
                + Math.max(0, duration - brandRateCueSeconds) / Math.max(1, plan.playbackRate)
              : 24;
            const timeout = timers.setTimeout(
              () => settle("timeout"),
              Math.max(18_000, Math.ceil((expectedSeconds + 6) * 1_000))
            );
            removeMediaListeners = () => {
              timers.clearTimeout(timeout);
              dom?.video.removeEventListener?.("ended", onEnded);
              dom?.video.removeEventListener?.("error", onError);
              dom?.video.removeEventListener?.("timeupdate", onTimeUpdate);
              if (videoFrameRequest !== null) {
                dom?.video.cancelVideoFrameCallback?.(videoFrameRequest);
              }
            };
          });
          activeSettle = null;
          removeMediaListeners();
        }
      }

      if (reason === "disposed") {
        return launchResult({
          played: started,
          reason,
          repeat: plan.repeat,
          playbackRate: plan.playbackRate,
          muted: Boolean(dom.video.muted)
        });
      }

      dom.video.volume = 0;
      dom.video.pause?.();
      const handedOff = ["completed", "skipped", "media-error", "timeout"].includes(reason);
      if (handedOff) await revealMenu(plan, reason);
      if (persist && !completedBefore && (reason === "completed" || reason === "skipped")) {
        persisted = markFirstOpenCinematicComplete(storage, { storageKey, now });
      }

      const outcome = launchResult({
        played: started,
        handled: handedOff,
        reason,
        persisted,
        repeat: plan.repeat,
        playbackRate: plan.playbackRate,
        menuHandoff: handedOff,
        muted: Boolean(dom.video.muted)
      });
      emit(reason, outcome);
      try {
        if (typeof onComplete === "function") onComplete(outcome);
      } catch {
        // Completion consumers must not block app entry.
      }
      return outcome;
    } finally {
      activeSettle = null;
      removeMediaListeners();
      documentRef.removeEventListener?.("keydown", keyHandler);
      dom?.skip.removeEventListener?.("click", skipHandler);
      dom?.sound.removeEventListener?.("click", soundHandler);
      dom?.video.pause?.();
      restoreInert();
      documentRef.body.classList?.remove("first-open-cinematic-active", "launch-menu-reveal");
      dom?.root.remove?.();
      if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
      dom = null;
    }
  }

  function playLaunch({ persist = true, force = false } = {}) {
    if (activePromise) return activePromise;
    activePromise = run({ persist: Boolean(persist), force: Boolean(force) })
      .finally(() => {
        activePromise = null;
      });
    return activePromise;
  }

  function playIfNeeded(options = {}) {
    return playLaunch(options);
  }

  function skip() {
    if (!activePromise || !activeSettle || disposed) return false;
    activeSettle("skipped");
    return true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    activeSettle?.("disposed");
  }

  return Object.freeze({
    playLaunch,
    playIfNeeded,
    skip,
    dispose,
    isActive: () => Boolean(activePromise),
    hasCompleted: () => hasCompletedFirstOpenCinematic(storage, storageKey),
    hasPlayedThisSession: () => hasPlayedFirstOpenCinematicThisSession(
      sessionStorage,
      sessionStorageKey
    )
  });
}
