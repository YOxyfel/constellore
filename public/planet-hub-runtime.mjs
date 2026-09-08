import {
  PLANET_HUB_DESTINATIONS,
  PLANET_HUB_PHASES,
  assetUrl,
  normalizePlanetHubDestination,
  normalizePlanetHubWorld,
  selectPlanetHubQuality,
  validatePlanetHubManifest
} from "./planet-hub-domain.mjs?v=5.0.0-beta.4";
import {
  DEFAULT_PLANET_HUB_GLTF_LOADER_URL,
  DEFAULT_PLANET_HUB_THREE_SPECIFIER,
  PLANET_HUB_JOURNEY_APPROACH_START_MS,
  PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS,
  PLANET_HUB_JOURNEY_IGNITION_MS,
  createThreePlanetHubRenderer,
  loadPlanetHubThree
} from "./planet-hub-renderer.mjs?v=5.0.0-beta.4";
import {
  PLANET_HUB_COSMIC_DISTANCE_STOPS,
  PLANET_HUB_DISTANCE_METERS,
  PLANET_HUB_DISTANCE_STOPS,
  PLANET_HUB_VIEW_BANDS,
  PLANET_HUB_ZOOM_ANCHOR_PROGRESS,
  calculatePlanetHubCosmicWheelZoom,
  calculatePlanetHubPinchZoom,
  calculatePlanetHubWheelZoom,
  isPlanetHubZoomBlockedTarget,
  resolvePlanetHubRepresentedDistance,
  resolvePlanetHubZoomOwnership,
  stabilizePlanetHubViewBand
} from "./planet-hub-zoom.mjs?v=5.0.0-beta.4";

const PLANET_HUB_COSMIC_PINCH_BOUNDS = Object.freeze({
  distanceLogRange: Math.log(
    PLANET_HUB_COSMIC_DISTANCE_STOPS.observableUniverse
      / PLANET_HUB_COSMIC_DISTANCE_STOPS.milkyWayBoundary
  )
});

export const DEFAULT_PLANET_HUB_MANIFEST_URL = "./art/planet-hub/manifest.json";
export const DEFAULT_PLANET_HUB_PLACES_MODULE_URL = "./planet-hub-places.mjs?v=5.0.0-beta.4";
export const PLANET_HUB_BODY_DOUBLE_TAP_MS = 500;
const PLANET_HUB_BODY_DOUBLE_TAP_MOUSE_PX = 32;
const PLANET_HUB_BODY_DOUBLE_TAP_TOUCH_PX = 48;
export const PLANET_HUB_SEMANTIC_ZOOM_STOPS = Object.freeze(
  PLANET_HUB_VIEW_BANDS.map((band) => ({ band, progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS[band] }))
);

function formatPlanetHubDistanceScalar(value = 0) {
  const amount = Math.max(0, Number(value) || 0);
  const decimals = amount >= 100 ? 0 : amount >= 10 ? 1 : amount >= 1 ? 2 : 3;
  const fixed = amount.toFixed(decimals);
  const [integer, fraction = ""] = (decimals ? fixed.replace(/[.]?0+$/, "") : fixed).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/**
 * Turns the physical distance represented by the camera into a compact ruler
 * label. Unit changes are monotonic, so scrolling outward never appears to
 * jump backward merely because the rail switched notation.
 */
export function formatPlanetHubRepresentedDistance(distanceMeters = PLANET_HUB_DISTANCE_STOPS.planet) {
  const meters = Number(distanceMeters);
  const safeMeters = Number.isFinite(meters) && meters > 0
    ? meters
    : PLANET_HUB_DISTANCE_STOPS.planet;
  let scaled;
  let label;
  let unit;
  let spokenValue;
  let spokenUnit;
  if (safeMeters < PLANET_HUB_DISTANCE_METERS.au * 0.1) {
    scaled = safeMeters / 1000;
    unit = "km";
    spokenUnit = "kilometres";
    if (scaled >= 1_000_000) {
      spokenValue = `${formatPlanetHubDistanceScalar(scaled / 1_000_000)} million`;
      label = `${formatPlanetHubDistanceScalar(scaled / 1_000_000)}M`;
    }
  } else if (safeMeters < PLANET_HUB_DISTANCE_METERS.lightYear * 0.1) {
    scaled = safeMeters / PLANET_HUB_DISTANCE_METERS.au;
    unit = "AU";
    spokenUnit = "astronomical units";
  } else if (safeMeters < PLANET_HUB_DISTANCE_METERS.lightYear * 1000) {
    scaled = safeMeters / PLANET_HUB_DISTANCE_METERS.lightYear;
    unit = "ly";
    spokenUnit = "light-years";
  } else {
    const lightYears = safeMeters / PLANET_HUB_DISTANCE_METERS.lightYear;
    const divisor = lightYears >= 1_000_000_000 ? 1_000_000_000
      : lightYears >= 1_000_000 ? 1_000_000 : 1000;
    scaled = lightYears / divisor;
    unit = divisor === 1_000_000_000 ? "Gly" : divisor === 1_000_000 ? "Mly" : "kly";
    spokenUnit = divisor === 1_000_000_000 ? "billion light-years"
      : divisor === 1_000_000 ? "million light-years" : "thousand light-years";
  }
  label ||= formatPlanetHubDistanceScalar(scaled);
  spokenValue ||= label;
  if (Math.abs(scaled - 1) < 1e-9) {
    if (unit === "km") spokenUnit = "kilometre";
    else if (unit === "AU") spokenUnit = "astronomical unit";
    else if (unit === "ly") spokenUnit = "light-year";
  }
  return Object.freeze({
    distanceMeters: safeMeters,
    label,
    unit,
    text: `${label} ${unit}`,
    ariaLabel: `Current view distance: ${spokenValue} ${spokenUnit}`
  });
}

export function resolvePlanetHubSemanticZoomKey(key, index = 0) {
  const last = PLANET_HUB_SEMANTIC_ZOOM_STOPS.length - 1;
  const current = Math.max(0, Math.min(last, Number(index) || 0));
  if (["ArrowUp", "ArrowLeft", "PageUp"].includes(key)) return Math.max(0, current - 1);
  if (["ArrowDown", "ArrowRight", "PageDown"].includes(key)) return Math.min(last, current + 1);
  if (key === "Home") return 0;
  if (key === "End") return last;
  return null;
}

export function resolvePlanetHubOrbitReturnContract({
  mode = "overview",
  worldId = "earth",
  orbitBodyId = worldId,
  selectedBodyId = orbitBodyId
} = {}) {
  const world = String(worldId || "earth").trim().toLowerCase();
  const orbitBody = String(orbitBodyId || world).trim().toLowerCase();
  const selectedBody = String(selectedBodyId || orbitBody).trim().toLowerCase();
  if (mode === "focused") return Object.freeze({
    visible: true,
    kind: "landmark",
    action: "exit-focus",
    label: "Orbit view",
    ariaLabel: "Return to planet orbit view"
  });
  if (orbitBody !== world) return Object.freeze({
    visible: true,
    kind: "body-focus",
    action: "solar-system",
    label: "← Solar system",
    ariaLabel: "Back to Solar System"
  });
  if (selectedBody !== world) return Object.freeze({
    visible: true,
    kind: "body-selection",
    action: "reset-view",
    label: "Reset view",
    ariaLabel: "Reset celestial body selection"
  });
  return Object.freeze({
    visible: false,
    kind: "none",
    action: "none",
    label: "Orbit view",
    ariaLabel: "Return to planet orbit view"
  });
}

export function resolvePlanetHubJourneyAudioTimeline({
  direction = "outbound",
  reducedMotion = false
} = {}) {
  const normalizedDirection = direction === "return" ? "return" : "outbound";
  const entries = [
    Object.freeze({ cue: "journey-ignition", delayMs: 0, direction: normalizedDirection })
  ];
  if (!reducedMotion) entries.push(
    Object.freeze({ cue: "journey-liftoff", delayMs: PLANET_HUB_JOURNEY_IGNITION_MS, direction: normalizedDirection }),
    Object.freeze({ cue: "journey-transfer", delayMs: PLANET_HUB_JOURNEY_CAMERA_CRANE_END_MS + 420, direction: normalizedDirection }),
    Object.freeze({ cue: "journey-approach", delayMs: PLANET_HUB_JOURNEY_APPROACH_START_MS, direction: normalizedDirection })
  );
  return Object.freeze(entries);
}

export function normalizePlanetHubEffectsLevel(value) {
  return ["full", "reduced", "off"].includes(value) ? value : "full";
}

function frozenSnapshot(state) {
  return Object.freeze({
    renderer: state.renderer,
    phase: state.phase,
    quality: state.quality,
    worldId: state.worldId,
    activeDestination: state.activeDestination,
    mode: state.mode,
    focusedDestination: state.focusedDestination,
    orbitBodyId: state.orbitBodyId,
    selectedBodyId: state.selectedBodyId,
    selectedPlaceId: state.selectedPlaceId,
    visitedPlaceId: state.visitedPlaceId,
    availableDestinations: Object.freeze([...state.availableDestinations]),
    selectableHomeWorldIds: Object.freeze([...state.selectableHomeWorldIds]),
    moonHomeWorldAccess: Object.freeze({ ...state.moonHomeWorldAccess }),
    journeyAction: state.journeyAction,
    revealState: state.revealState,
    effectsLevel: state.effectsLevel,
    viewBand: state.viewBand,
    viewProgress: state.viewProgress,
    viewSegment: state.viewSegment,
    cosmicProgress: state.cosmicProgress,
    viewDistanceMeters: state.viewDistanceMeters,
    viewDistanceLabel: state.viewDistanceLabel,
    viewDistanceUnit: state.viewDistanceUnit,
    space: state.space,
    suspended: state.suspended,
    suspendReasons: Object.freeze([...state.suspendReasons]),
    contextLosses: state.contextLosses,
    ready: state.renderer === "webgl" && state.phase === "ready"
  });
}

function canUseWebGL2(documentRef) {
  try {
    const probe = documentRef?.createElement?.("canvas");
    // Do not silently retry without the performance-caveat guard. A software
    // WebGL context can technically exist while being too expensive for the
    // continuously animated hub, particularly in embedded browser surfaces.
    const context = probe?.getContext?.("webgl2", {
      failIfMajorPerformanceCaveat: true,
      powerPreference: "high-performance"
    }) || null;
    const supported = Boolean(context);
    // The capability probe must not keep one of the browser's scarce WebGL
    // contexts alive. In particular, mobile Safari and headless Chromium can
    // otherwise reject the real Planet Hub renderer created immediately after
    // this check and incorrectly strand a capable device on the poster.
    context?.getExtension?.("WEBGL_lose_context")?.loseContext?.();
    return supported;
  } catch {
    return false;
  }
}

function matchMedia(windowRef, query) {
  try { return Boolean(windowRef?.matchMedia?.(query)?.matches); } catch { return false; }
}

function readPositiveCapability(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function readPlanetHubQualityOverride(locationRef = globalThis.location) {
  try {
    let search = "";
    if (typeof locationRef === "string") {
      search = new URL(locationRef, "http://localhost/").search;
    } else if (locationRef?.search) {
      search = String(locationRef.search);
    } else if (locationRef?.href) {
      search = new URL(locationRef.href, "http://localhost/").search;
    }
    const requested = String(new URLSearchParams(search).get("hub") || "").trim().toLowerCase();
    return requested === "static" || requested === "low" ? requested : null;
  } catch {
    return null;
  }
}

export function readPlanetHubCapabilities({
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  navigatorRef = globalThis.navigator,
  webgl2,
  qualityOverride
} = {}) {
  const width = windowRef?.visualViewport?.width || windowRef?.innerWidth || 1280;
  const height = windowRef?.visualViewport?.height || windowRef?.innerHeight || 720;
  return Object.freeze({
    webgl2: webgl2 ?? canUseWebGL2(documentRef),
    saveData: Boolean(navigatorRef?.connection?.saveData),
    width,
    height,
    deviceMemory: readPositiveCapability(navigatorRef?.deviceMemory),
    hardwareConcurrency: readPositiveCapability(navigatorRef?.hardwareConcurrency),
    coarsePointer: matchMedia(windowRef, "(pointer: coarse)"),
    mobile: matchMedia(windowRef, "(max-width: 600px)"),
    qualityOverride: qualityOverride ?? readPlanetHubQualityOverride(windowRef?.location)
  });
}

function normalizeAvailability(value) {
  const available = PLANET_HUB_DESTINATIONS.filter((destination) => {
    if (Array.isArray(value)) return value.includes(destination);
    return value?.[destination] !== false;
  });
  return available.length ? available : ["forge"];
}

function normalizeSelectableHomeWorlds(value) {
  const requested = Array.isArray(value) ? value : [];
  return requested.includes("moon") ? ["earth", "moon"] : ["earth"];
}

function normalizeMoonHomeWorldAccess(value, selectableHomeWorldIds = ["earth"]) {
  const source = value && typeof value === "object" ? value : {};
  return {
    worldId: "moon",
    unlocked: selectableHomeWorldIds.includes("moon") && source.unlocked !== false,
    milestoneId: String(source.milestoneId || "power"),
    completedAt: String(source.completedAt || "")
  };
}

function normalizeJourneyAction(value) {
  if (value && typeof value === "object") {
    return String(value.actionKind || value.kind || value.action || value.state || "launch").trim().toLowerCase();
  }
  return String(value || "launch").trim().toLowerCase();
}

function interactiveGestureTarget(target, stage) {
  if (!target || target === stage || target.tagName === "CANVAS") return false;
  if (target.closest?.("button, a, input, select, textarea, summary, [role='button'], [contenteditable='true'], [data-planet-hub-ignore-gesture]")) return true;
  let element = target;
  while (element && element !== stage) {
    if ((element.scrollWidth > element.clientWidth && element.clientWidth > 0)
      || (element.scrollHeight > element.clientHeight && element.clientHeight > 0)) return true;
    element = element.parentElement;
  }
  return false;
}

function visibleControl(element) {
  return Boolean(element
    && !element.hidden
    && !element.disabled
    && element.getAttribute?.("aria-hidden") !== "true"
    && !element.closest?.("[hidden], [inert]"));
}

function uniqueControls(values) {
  return [...new Set(values.filter(Boolean))];
}

export function resolvePlanetHubJourneyControls({
  documentRef = globalThis.document,
  actionElements = null,
  journeyAction = "launch"
} = {}) {
  const rocket = actionElements?.journey
    || actionElements?.journeyRocket
    || documentRef?.getElementById?.("moonHomeRocket")
    || null;
  const visit = actionElements?.journeyVisit
    || documentRef?.getElementById?.("moonHomeProjectVisit")
    || null;
  const tab = actionElements?.journeyTab
    || documentRef?.getElementById?.("homeOrbitTabJourney")
    || null;
  const controls = uniqueControls([rocket, visit]);
  const orderedActions = normalizeJourneyAction(journeyAction) === "preparing"
    ? uniqueControls([visit, rocket])
    : uniqueControls([rocket, visit]);
  const actionTarget = orderedActions.find((element) => visibleControl(element) && typeof element.click === "function") || null;
  const focusTarget = orderedActions.find((element) => visibleControl(element) && typeof element.focus === "function")
    || (visibleControl(tab) && typeof tab.focus === "function" ? tab : null);
  return Object.freeze({
    actionTarget,
    focusTarget,
    controls: Object.freeze(controls)
  });
}

function defaultFocusAction(documentRef, destination, {
  journeyAction = "launch",
  actionElements = null
} = {}) {
  if (destination === "journey") {
    const target = resolvePlanetHubJourneyControls({ documentRef, actionElements, journeyAction }).focusTarget;
    target?.focus?.({ preventScroll: true });
    return;
  }
  const ids = destination === "arena"
    ? ["scrambleHomeButton", "homeOrbitTabArena"]
    : ["primaryOrbitButton", "homeOrbitTabForge"];
  const target = ids
    .map((id) => documentRef?.getElementById?.(id))
    .find((element) => visibleControl(element) && typeof element.focus === "function");
  target?.focus?.({ preventScroll: true });
}

export function createPlanetHubInteraction({
  stage,
  windowRef = globalThis.window,
  getAvailable = () => PLANET_HUB_DESTINATIONS,
  getMode = () => "overview",
  pick = () => null,
  pickDetail = null,
  onHoverEnd = () => {},
  onDragOrbit = () => false,
  onDragEnd = () => false,
  onPinchZoom = () => false,
  onPinchEnd = () => {},
  onLandmarkHoverChange = () => {},
  onCommit = () => {},
  onBodySelect = () => {},
  onBodyFocus = () => {},
  onExitFocus = () => {}
} = {}) {
  if (!stage?.addEventListener) return Object.freeze({
    reconcilePointer: () => false,
    snapshotPointer: () => Object.freeze({ active: false, region: "none" }),
    destroy() {}
  });
  let pointer = null;
  const touchPointers = new Map();
  let pinch = null;
  let hoveredLandmark = null;
  let hoveredLandmarkAction = null;
  let lastFinePointer = null;
  let hoverRegion = "none";
  let pendingBodyTap = null;
  let reconcilingPointer = false;
  let destroyed = false;

  function readPick(clientX, clientY) {
    const detail = typeof pickDetail === "function" ? pickDetail(clientX, clientY) : null;
    if (detail?.target || detail?.body) return {
      ...detail,
      target: detail.target || detail.body
    };
    const target = pick(clientX, clientY);
    return target ? {
      target,
      destination: getAvailable().includes(target) ? target : null,
      action: null,
      body: null
    } : null;
  }

  function bodyOnlyTarget(target) {
    return target?.body && !target.destination && !target.action ? target.body : null;
  }

  function registerBodyTap(target, event, current) {
    const body = bodyOnlyTarget(target);
    if (!body || current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 7) {
      pendingBodyTap = null;
      return false;
    }
    const pointerType = String(event.pointerType || current.pointerType || "mouse").toLowerCase();
    const at = event.timeStamp || 0;
    const previous = pendingBodyTap;
    const matched = previous
      && previous[0] === body
      && previous[1] === pointerType
      && at >= previous[2]
      && at - previous[2] <= PLANET_HUB_BODY_DOUBLE_TAP_MS
      && Math.hypot(event.clientX - previous[3], event.clientY - previous[4]) <= (pointerType === "touch"
        ? PLANET_HUB_BODY_DOUBLE_TAP_TOUCH_PX
        : PLANET_HUB_BODY_DOUBLE_TAP_MOUSE_PX);
    if (!matched) {
      pendingBodyTap = [body, pointerType, at, event.clientX, event.clientY];
      onBodySelect(body, {
        source: pointerType === "touch" ? "body-tap" : "body-click",
        pointerType,
        clientX: event.clientX,
        clientY: event.clientY
      });
      return true;
    }
    pendingBodyTap = null;
    event.preventDefault?.();
    onBodyFocus(body, {
      source: pointerType === "touch" ? "body-double-tap" : "body-double-click",
      pointerType,
      clientX: event.clientX,
      clientY: event.clientY
    });
    return true;
  }

  function setHoveredLandmark(destination = null, source = "hover", action = null, { force = false } = {}) {
    const next = destination && getAvailable().includes(destination) ? destination : null;
    const nextAction = next ? action : null;
    if (hoveredLandmark === next && hoveredLandmarkAction === nextAction) {
      // Renderer focus can be cleared by a programmatic destination/focus
      // transition while the pointer remains parked over this same landmark.
      // Reassert only when the reconciler explicitly crosses such a boundary;
      // ordinary render-frame reconciliation must remain DOM-churn free.
      if (force && next) onLandmarkHoverChange(next, { source, action: nextAction });
      return false;
    }
    hoveredLandmark = next;
    hoveredLandmarkAction = nextAction;
    onLandmarkHoverChange(next, { source, action: nextAction });
    return true;
  }

  function snapshotPointer() {
    return Object.freeze({
      active: Boolean(lastFinePointer),
      clientX: lastFinePointer?.clientX ?? null,
      clientY: lastFinePointer?.clientY ?? null,
      region: hoverRegion,
      destination: hoveredLandmark,
      action: hoveredLandmarkAction,
      pendingBody: pendingBodyTap?.[0] || null
    });
  }

  function rememberFinePointer(event) {
    const pointerType = String(event?.pointerType || "mouse").toLowerCase();
    if (pointerType === "touch" || matchMedia(windowRef, "(pointer: coarse)")) {
      lastFinePointer = null;
      return false;
    }
    const clientX = Number(event?.clientX);
    const clientY = Number(event?.clientY);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
    const target = event?.target || stage;
    if (interactiveGestureTarget(target, stage)) {
      lastFinePointer = null;
      return false;
    }
    lastFinePointer = { clientX, clientY, pointerType, target };
    return true;
  }

  function updateHoverRegion(kind) {
    const changed = hoverRegion !== kind;
    hoverRegion = kind;
    return changed;
  }

  function reconcilePointer({ source = "motion-reconcile", force = false } = {}) {
    if (destroyed || reconcilingPointer || pointer?.draggingOrbit || !lastFinePointer) return false;
    reconcilingPointer = true;
    try {
      const { clientX, clientY } = lastFinePointer;
      const hoveredTarget = readPick(clientX, clientY);

      if (getMode() !== "overview") {
        const destination = hoveredTarget?.destination || null;
        const action = hoveredTarget?.action || null;
        const changed = updateHoverRegion(destination ? "landmark" : "focused-background");
        const hoverChanged = setHoveredLandmark(destination, destination ? "landmark-hover" : "focused-background", action, {
          force: force && Boolean(destination)
        });
        return changed || hoverChanged;
      }

      const destination = hoveredTarget?.destination || null;
      if (destination) {
        const action = hoveredTarget?.action || null;
        const changed = updateHoverRegion("landmark");
        const hoverChanged = setHoveredLandmark(destination, "landmark-hover", action, { force: force && !changed });
        return changed || hoverChanged;
      }

      // Solar-system navigation is direct manipulation. Passive pointer
      // position may highlight a body or landmark, but it must never steer the
      // camera: that made the globe appear to rotate in an unrelated direction
      // and fought release inertia. Mouse/touch drag owns camera orbiting.
      setHoveredLandmark(null, source === "pointermove" ? "celestial-hover" : source);
      const hoveredBody = bodyOnlyTarget(hoveredTarget);
      const changed = updateHoverRegion(hoveredBody ? "body" : "space");
      return changed;
    } finally {
      reconcilingPointer = false;
    }
  }

  function buildDragReleaseMeta(current, event, {
    cancelled = false,
    source = "pointer-drag-release"
  } = {}) {
    const eventTime = Number(event?.timeStamp);
    const endAt = Number.isFinite(eventTime) && eventTime > 0
      ? eventTime
      : current.lastAt;
    const eventX = Number(event?.clientX);
    const eventY = Number(event?.clientY);
    const endX = !cancelled && Number.isFinite(eventX) ? eventX : current.lastX;
    const endY = !cancelled && Number.isFinite(eventY) ? eventY : current.lastY;
    let recentVelocityX = current.recentVelocityX || 0;
    let recentVelocityY = current.recentVelocityY || 0;
    let lastMotionAt = current.lastMotionAt || current.startedAt;
    const finalDeltaX = endX - current.lastX;
    const finalDeltaY = endY - current.lastY;
    const finalDeltaMs = Math.max(0, endAt - current.lastAt);
    if (!cancelled && Math.hypot(finalDeltaX, finalDeltaY) > 0.25 && finalDeltaMs > 0) {
      const sampleMs = Math.max(1, Math.min(80, finalDeltaMs));
      const alpha = current.velocitySamples > 0 ? 1 - Math.exp(-sampleMs / 55) : 1;
      recentVelocityX += ((finalDeltaX / sampleMs) - recentVelocityX) * alpha;
      recentVelocityY += ((finalDeltaY / sampleMs) - recentVelocityY) * alpha;
      lastMotionAt = endAt;
    }
    const displacementX = endX - current.startX;
    const displacementY = endY - current.startY;
    const bounds = stage.getBoundingClientRect?.() || {
      width: stage.clientWidth || 1,
      height: stage.clientHeight || 1
    };
    return {
      source,
      cancelled,
      pointerType: current.pointerType,
      displacementX,
      displacementY,
      distancePx: Math.hypot(displacementX, displacementY),
      durationMs: Math.max(0, endAt - current.startedAt),
      heldStillMs: Math.max(0, endAt - lastMotionAt),
      recentVelocityX,
      recentVelocityY,
      recentSpeedPxPerMs: Math.hypot(recentVelocityX, recentVelocityY),
      viewportWidth: Math.max(1, Number(bounds.width) || stage.clientWidth || 1),
      viewportHeight: Math.max(1, Number(bounds.height) || stage.clientHeight || 1)
    };
  }

  function pointerDown(event) {
    if (event.pointerType === "touch") {
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touchPointers.size >= 2) {
        pendingBodyTap = null;
        const points = [...touchPointers.values()].slice(0, 2);
        const span = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        if (pointer?.draggingOrbit) onDragEnd({ source: "pinch-start", cancelled: true, pointerType: "touch" });
        pointer = null;
        pinch = { startSpan: Math.max(1, span), lastSpan: Math.max(1, span) };
        setHoveredLandmark(null, "pinch-start");
        event.preventDefault?.();
        try { stage.setPointerCapture?.(event.pointerId); } catch { /* Optional. */ }
        return;
      }
    }
    if (event.isPrimary === false || (event.button != null && event.button !== 0)) return;
    if (interactiveGestureTarget(event.target, stage)) return;
    rememberFinePointer(event);
    // Capture the pressed landmark before braking inertia. The model may move a
    // few pixels while velocity settles, but a normal click must still commit
    // the landmark the player actually pressed.
    const pressedTarget = readPick(event.clientX, event.clientY);
    const pressedBody = bodyOnlyTarget(pressedTarget);
    if (pendingBodyTap && pendingBodyTap[0] !== pressedBody) pendingBodyTap = null;
    setHoveredLandmark(null, "pointer-down");
    onHoverEnd({ source: "pointer-down" });
    hoverRegion = "none";
    pointer = {
      id: event.pointerId,
      startedMode: getMode(),
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startedAt: Number(event.timeStamp) || 0,
      lastAt: Number(event.timeStamp) || 0,
      pointerType: event.pointerType || "mouse",
      pressedTarget,
      moved: false,
      draggingOrbit: false,
      recentVelocityX: 0,
      recentVelocityY: 0,
      velocitySamples: 0,
      lastMotionAt: Number(event.timeStamp) || 0
    };
    try { stage.setPointerCapture?.(event.pointerId); } catch { /* Pointer capture is an enhancement only. */ }
  }

  function pointerMove(event) {
    if (event.pointerType === "touch" && touchPointers.has(event.pointerId)) {
      touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && touchPointers.size >= 2) {
        const points = [...touchPointers.values()].slice(0, 2);
        const currentSpan = Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
        const accepted = onPinchZoom({
          startSpan: pinch.startSpan,
          currentSpan,
          previousSpan: pinch.lastSpan
        }, { source: "pinch" });
        pinch.lastSpan = currentSpan;
        if (accepted) event.preventDefault?.();
        return;
      }
    }
    if (pointer && event.pointerId === pointer.id) {
      rememberFinePointer(event);
      const previousX = pointer.lastX;
      const previousY = pointer.lastY;
      const previousAt = pointer.lastAt;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      pointer.lastAt = Number(event.timeStamp) || previousAt + 16;
      const sampleDeltaX = pointer.lastX - previousX;
      const sampleDeltaY = pointer.lastY - previousY;
      const sampleDistance = Math.hypot(sampleDeltaX, sampleDeltaY);
      const sampleMs = Math.max(1, Math.min(80, pointer.lastAt - previousAt || 16));
      if (sampleDistance > 0.25) {
        const sampleVelocityX = sampleDeltaX / sampleMs;
        const sampleVelocityY = sampleDeltaY / sampleMs;
        const alpha = pointer.velocitySamples > 0 ? 1 - Math.exp(-sampleMs / 55) : 1;
        pointer.recentVelocityX += (sampleVelocityX - pointer.recentVelocityX) * alpha;
        pointer.recentVelocityY += (sampleVelocityY - pointer.recentVelocityY) * alpha;
        pointer.velocitySamples += 1;
        pointer.lastMotionAt = pointer.lastAt;
      }
      const deltaX = pointer.lastX - pointer.startX;
      const deltaY = pointer.lastY - pointer.startY;
      pointer.moved ||= Math.hypot(deltaX, deltaY) > 7;
      if (pointer.moved) pendingBodyTap = null;
      // Focused mode is an inspection surface, not a carousel gesture surface.
      // Track the pointer so a click remains robust to normal hand jitter, but
      // never let that jitter create a destination preview that can swallow the
      // subsequent background-exit action.
      if (pointer.startedMode === "focused" || getMode() === "focused") return;
      const pointerType = event.pointerType || pointer.pointerType;
      if (!pointer.moved) return;
      const firstDragSample = !pointer.draggingOrbit;
      const accepted = onDragOrbit({
        deltaX: firstDragSample ? deltaX : pointer.lastX - previousX,
        deltaY: firstDragSample ? deltaY : pointer.lastY - previousY,
        deltaMs: Math.max(8, Math.min(80, pointer.lastAt - previousAt || 16))
      }, {
        source: pointerType === "touch" ? "touch-orbit" : "pointer-drag",
        pointerType
      });
      pointer.draggingOrbit ||= accepted === true;
      if (pointer.draggingOrbit) event.preventDefault?.();
      return;
    }
    if (event.pointerType === "touch" || matchMedia(windowRef, "(pointer: coarse)")) return;
    if (interactiveGestureTarget(event.target, stage)) {
      lastFinePointer = null;
      hoverRegion = "interactive-control";
      setHoveredLandmark(null, "interactive-control");
      return;
    }
    if (!rememberFinePointer(event)) return;
    reconcilePointer({ source: "pointermove", force: true });
  }

  function pointerUp(event) {
    if (event.pointerType === "touch" && touchPointers.has(event.pointerId)) {
      touchPointers.delete(event.pointerId);
      if (pinch) {
        if (touchPointers.size < 2) {
          pinch = null;
          onPinchEnd({ source: "pinch-end" });
        }
        try { stage.releasePointerCapture?.(event.pointerId); } catch { /* Optional. */ }
        event.preventDefault?.();
        return;
      }
    }
    if (!pointer || event.pointerId !== pointer.id) return;
    const current = pointer;
    rememberFinePointer(event);
    pointer = null;
    try { stage.releasePointerCapture?.(event.pointerId); } catch { /* Capture may already be released. */ }
    if (current.startedMode === "focused" || getMode() === "focused") {
      pendingBodyTap = null;
      const pressedDestination = current.pressedTarget?.destination;
      // The down-hit is authoritative while the world is moving. A background
      // coordinate can slide underneath a landmark between down and up during
      // focus animation; re-raycasting here would turn the intended exit back
      // into a landmark commit.
      const target = pressedDestination && getAvailable().includes(pressedDestination)
        ? current.pressedTarget
        : null;
      const destination = target?.destination || null;
      if (destination && getAvailable().includes(destination)) {
        onCommit(destination, { source: "landmark", action: target?.action || null });
      } else {
        // Treat any completed background press as the requested return. This is
        // intentionally independent of the generic 7px drag threshold: tiny
        // mouse/touch drift must not make exiting a structure intermittent.
        onExitFocus({ source: "planet-background" });
      }
      return;
    }
    if (current.draggingOrbit) {
      pendingBodyTap = null;
      setHoveredLandmark(null, "pointer-drag-release");
      onDragEnd(buildDragReleaseMeta(current, event, {
        source: "pointer-drag-release",
        cancelled: false
      }));
      return;
    }
    if (current.pointerType !== "touch" && current.moved) {
      pendingBodyTap = null;
      setHoveredLandmark(null, "pointer-drag-release");
      return;
    }
    if (!current.moved) {
      const releasedTarget = readPick(event.clientX, event.clientY);
      const pressedDestination = current.pressedTarget?.destination;
      const pressedBody = bodyOnlyTarget(current.pressedTarget);
      const target = pressedDestination && getAvailable().includes(pressedDestination)
        ? current.pressedTarget
        : pressedBody ? current.pressedTarget : releasedTarget;
      const destination = target?.destination || null;
      if (registerBodyTap(target, event, current)) return;
      if (destination && getAvailable().includes(destination)) {
        onCommit(destination, { source: "landmark", action: target?.action || null });
      }
      else {
        onExitFocus({ source: "planet-background" });
      }
    }
  }

  function pointerCancel(event) {
    if (event.pointerType === "touch") {
      touchPointers.delete(event.pointerId);
      if (pinch) {
        pinch = null;
        onPinchEnd({ source: "pinch-cancel", cancelled: true });
      }
    }
    const current = pointer;
    pendingBodyTap = null;
    if (current?.id != null) {
      try { stage.releasePointerCapture?.(current.id); } catch { /* Capture may already be released. */ }
    }
    pointer = null;
    lastFinePointer = null;
    hoverRegion = "none";
    setHoveredLandmark(null, "pointer-cancel");
    if (current?.draggingOrbit) {
      onDragEnd(buildDragReleaseMeta(current, event, {
        source: "pointer-drag-cancel",
        cancelled: true
      }));
    }
  }

  function pointerCaptureLost(event) {
    if (event.pointerType === "touch") {
      touchPointers.delete(event.pointerId);
      if (pinch && touchPointers.size < 2) {
        pinch = null;
        onPinchEnd({ source: "pinch-capture-lost", cancelled: true });
      }
    }
    if (!pointer || (event.pointerId != null && event.pointerId !== pointer.id)) return;
    const current = pointer;
    pendingBodyTap = null;
    pointer = null;
    lastFinePointer = null;
    hoverRegion = "none";
    setHoveredLandmark(null, "pointer-capture-lost");
    if (current.draggingOrbit) {
      onDragEnd(buildDragReleaseMeta(current, event, {
        source: "pointer-capture-lost",
        cancelled: true
      }));
    }
  }

  function pointerLeave() {
    // Hover is direct input, not a temporary destination preview. Preserve the
    // exit source so the renderer can apply its appropriate settling behavior;
    // only an explicit tab/keyboard selection re-centres an authored site.
    if (!pointer) {
      lastFinePointer = null;
      hoverRegion = "none";
      setHoveredLandmark(null, "pointer-leave");
      onHoverEnd({ source: "pointer-leave" });
    }
  }

  const listeners = [
    ["pointerdown", pointerDown],
    ["pointermove", pointerMove],
    ["pointerup", pointerUp],
    ["pointercancel", pointerCancel],
    ["lostpointercapture", pointerCaptureLost],
    ["pointerleave", pointerLeave]
  ];
  for (const [type, listener] of listeners) stage.addEventListener(type, listener);
  return Object.freeze({
    reconcilePointer,
    snapshotPointer,
    destroy() {
      destroyed = true;
      if (pointer?.draggingOrbit) {
        onDragEnd({ source: "destroy", cancelled: true, pointerType: pointer.pointerType });
      }
      pointer = null;
      pendingBodyTap = null;
      touchPointers.clear();
      pinch = null;
      lastFinePointer = null;
      hoverRegion = "none";
      setHoveredLandmark(null, "destroy");
      onHoverEnd({ source: "destroy" });
      for (const [type, listener] of listeners) stage.removeEventListener?.(type, listener);
    }
  });
}

export function createPlanetHub({
  root,
  orbitRoot = root?.closest?.("[data-home-orbit]") || globalThis.document?.querySelector?.("[data-home-orbit]"),
  orbitController = null,
  manifestUrl = DEFAULT_PLANET_HUB_MANIFEST_URL,
  fetchRef = globalThis.fetch?.bind(globalThis),
  documentRef = root?.ownerDocument || globalThis.document,
  windowRef = documentRef?.defaultView || globalThis.window,
  navigatorRef = windowRef?.navigator || globalThis.navigator,
  importer,
  threeSpecifier = DEFAULT_PLANET_HUB_THREE_SPECIFIER,
  loaderUrl = DEFAULT_PLANET_HUB_GLTF_LOADER_URL,
  modulesLoader = loadPlanetHubThree,
  rendererFactory = createThreePlanetHubRenderer,
  onSelect = null,
  onWorldSelect = null,
  onSemanticEvent = () => {},
  focusAction = null,
  actionElements = null,
  placesLoader = (specifier) => import(specifier),
  capabilities = null,
  reducedMotion = matchMedia(windowRef, "(prefers-reduced-motion: reduce)"),
  effectsLevel = "full"
} = {}) {
  if (!root?.dataset || !documentRef?.createElement) return null;

  const initialViewDistance = formatPlanetHubRepresentedDistance(
    PLANET_HUB_DISTANCE_STOPS.planet
  );
  const state = {
    renderer: "pending",
    phase: "loading",
    quality: "static",
    worldId: "earth",
    orbitBodyId: "earth",
    selectedBodyId: "earth",
    selectedPlaceId: "earth",
    visitedPlaceId: "earth",
    activeDestination: "forge",
    mode: "overview",
    focusTransition: null,
    focusedDestination: null,
    availableDestinations: ["forge"],
    selectableHomeWorldIds: ["earth"],
    moonHomeWorldAccess: normalizeMoonHomeWorldAccess(null),
    journeyAction: "launch",
    revealState: "tutorial",
    effectsLevel: normalizePlanetHubEffectsLevel(effectsLevel),
    viewBand: "planet",
    viewProgress: 0,
    viewSegment: "legacy",
    cosmicProgress: 0,
    cosmicTargetProgress: 0,
    cosmicTier: null,
    viewDistanceMeters: initialViewDistance.distanceMeters,
    viewDistanceLabel: initialViewDistance.label,
    viewDistanceUnit: initialViewDistance.unit,
    viewDistanceAriaLabel: initialViewDistance.ariaLabel,
    space: "static",
    suspended: false,
    suspendReasons: [],
    contextLosses: 0
  };
  let manifest = null;
  let modules = null;
  let renderer = null;
  let interaction = null;
  let placesController = null;
  let placesPromise = null;
  let destroyed = false;
  let generation = 0;
  let restorationAttempts = 0;
  let preparePromise = null;
  // `preparePromise` follows the renderer build all the way to completion so a
  // late WebGL scene can still crossfade over the poster. Interaction must not
  // await that unbounded work: it waits for this deadline-bounded readiness
  // gate instead.
  let prepareReadinessPromise = null;
  let centerSelectionInFlight = null;
  let journeyActivationPromise = null;
  let journeyActivationBypass = false;
  let journeyActivationGeneration = 0;
  let journeyReturnPromise = null;
  let journeyReturnSession = null;
  let journeyReturnGeneration = 0;
  const journeySemanticTimers = new Set();
  let worldSelectionInFlight = null;
  let restoreWorldSwitchFocus = false;
  const JOURNEY_DELEGATED_TOKEN = "planet-hub-handoff";
  const listeners = [];

  function emitSemanticEvent(cue, detail = {}) {
    if (!cue || destroyed) return false;
    try {
      onSemanticEvent(Object.freeze({
        type: "planet-hub-audio",
        cue: String(cue),
        destination: state.activeDestination,
        worldId: state.worldId,
        ...detail
      }));
      return true;
    } catch {
      return false;
    }
  }

  function clearJourneySemanticTimeline() {
    const clearTimer = windowRef?.clearTimeout || globalThis.clearTimeout;
    for (const timer of journeySemanticTimers) clearTimer?.(timer);
    journeySemanticTimers.clear();
  }

  function scheduleJourneySemanticCue(cue, delay, direction) {
    const setTimer = windowRef?.setTimeout || globalThis.setTimeout;
    if (typeof setTimer !== "function") return null;
    const timer = setTimer(() => {
      journeySemanticTimers.delete(timer);
      emitSemanticEvent(cue, { direction });
    }, Math.max(0, Number(delay) || 0));
    timer?.unref?.();
    journeySemanticTimers.add(timer);
    return timer;
  }

  function beginJourneySemanticTimeline(direction = "outbound", { reduced = false } = {}) {
    clearJourneySemanticTimeline();
    for (const entry of resolvePlanetHubJourneyAudioTimeline({ direction, reducedMotion: reduced })) {
      if (entry.delayMs <= 0) emitSemanticEvent(entry.cue, { direction: entry.direction });
      else scheduleJourneySemanticCue(entry.cue, entry.delayMs, entry.direction);
    }
  }
  function resolveJourneyControls() {
    return resolvePlanetHubJourneyControls({
      documentRef,
      actionElements,
      journeyAction: state.journeyAction
    });
  }

  function focusDestinationControl(destination) {
    if (typeof focusAction === "function") {
      focusAction(destination, {
        journeyAction: state.journeyAction,
        actionElements
      });
      return;
    }
    defaultFocusAction(documentRef, destination, {
      journeyAction: state.journeyAction,
      actionElements
    });
  }

  function delegateJourneyClick(trigger) {
    if (!trigger?.click) return false;
    if (trigger.dataset) trigger.dataset.planetHubJourneyDelegated = JOURNEY_DELEGATED_TOKEN;
    journeyActivationBypass = true;
    try { trigger.click(); }
    finally { journeyActivationBypass = false; }
    return true;
  }

  function cancelJourneyActivation(reason = "cancelled") {
    if (!journeyActivationPromise) return false;
    journeyActivationGeneration += 1;
    clearJourneySemanticTimeline();
    renderer?.cancelJourneyDeparture?.({ reason });
    root.dataset.homeHubJourneyDeparture = "cancelled";
    root.dataset.homeHubJourneyCancelReason = reason;
    if (state.phase === "transitioning") {
      state.phase = state.renderer === "webgl" ? "ready" : "fallback";
      publish();
    }
    return true;
  }

  function interruptedJourneyReturn(reason = "interrupted") {
    return Object.freeze({
      status: "interrupted",
      completed: false,
      reason: String(reason || "interrupted")
    });
  }

  function interruptJourneyReturn(reason = "interrupted") {
    const session = journeyReturnSession;
    if (!session || session.interrupted) return false;
    session.interrupted = true;
    session.outcome = interruptedJourneyReturn(reason);
    journeyReturnGeneration += 1;
    clearJourneySemanticTimeline();
    renderer?.cancelJourneyReturn?.({ reason: session.outcome.reason });
    root.dataset.homeHubJourneyReturn = "interrupted";
    root.dataset.homeHubJourneyReturnReason = session.outcome.reason;
    session.resolveInterruption?.(session.outcome);
    return true;
  }

  function absoluteManifestUrl() {
    try { return new URL(manifestUrl, documentRef?.baseURI || windowRef?.location?.href).href; }
    catch { return manifestUrl; }
  }

  function publicAssetBaseUrl() {
    return documentRef?.baseURI || windowRef?.location?.href || absoluteManifestUrl();
  }

  const canvas = root.querySelector?.("canvas[data-planet-hub-canvas]") || documentRef.createElement("canvas");
  canvas.dataset.planetHubCanvas = "";
  canvas.setAttribute?.("aria-hidden", "true");
  canvas.setAttribute?.("role", "presentation");
  canvas.tabIndex = -1;
  if (!canvas.parentNode) root.append?.(canvas);

  const poster = root.querySelector?.("[data-planet-hub-poster]") || documentRef.createElement("img");
  poster.dataset.planetHubPoster = "";
  poster.alt = "";
  poster.setAttribute?.("aria-hidden", "true");
  poster.draggable = false;
  if (!poster.parentNode) root.append?.(poster);

  // The canvas remains decorative/aria-hidden. Focused landmark presentation
  // therefore gets a real HTML exit beside the stage, never a canvas-only hit.
  const returnHost = root.parentElement || orbitRoot || root;
  const inspectionHost = orbitRoot || returnHost;
  const orbitReturn = returnHost?.querySelector?.("[data-planet-hub-orbit-return]")
    || orbitRoot?.querySelector?.("[data-planet-hub-orbit-return]");
  const worldInspection = inspectionHost?.querySelector?.("[data-planet-hub-world-inspection]");
  const inspectionReturn = worldInspection?.querySelector?.("[data-planet-hub-inspection-return]");
  const inspectionTitle = worldInspection?.querySelector?.("[data-planet-hub-inspection-title]");
  const inspectionDetail = worldInspection?.querySelector?.("[data-planet-hub-inspection-detail]");
  const inspectionSelect = worldInspection?.querySelector?.("[data-planet-hub-inspection-select]");
  const worldSwitch = inspectionHost?.querySelector?.("[data-planet-hub-world-switch]");
  const worldSwitchLabel = worldSwitch?.querySelector?.("[data-planet-hub-world-switch-label]");
  const zoomRail = returnHost?.querySelector?.("[data-planet-hub-zoom-rail]")
    || orbitRoot?.querySelector?.("[data-planet-hub-zoom-rail]");
  const zoomReset = zoomRail?.querySelector?.("[data-planet-hub-zoom-reset]");
  const zoomDistance = zoomRail?.querySelector?.("[data-planet-hub-distance]");
  const zoomDistanceValue = zoomDistance?.querySelector?.("[data-planet-hub-distance-value]");
  const zoomDistanceUnit = zoomDistance?.querySelector?.("[data-planet-hub-distance-unit]");
  const zoomStops = [...(zoomRail?.querySelectorAll?.("[data-planet-hub-zoom-stop]") || [])];
  if (!orbitReturn || !worldInspection || !inspectionReturn) return null;

  function ensurePlacesController() {
    if (destroyed) return Promise.resolve(null);
    if (placesController) return Promise.resolve(placesController);
    if (placesPromise) return placesPromise;
    placesPromise = placesLoader(DEFAULT_PLANET_HUB_PLACES_MODULE_URL)
      .then((module) => {
        if (destroyed || typeof module?.createPlanetHubPlacesController !== "function") return null;
        const candidate = module.createPlanetHubPlacesController({
          root,
          orbitRoot,
          documentRef,
          windowRef,
          getHubState: () => state,
          getRenderer: () => renderer,
          selectBody: selectOrbitBody,
          visitBody: focusOrbitBody,
          onPlaceStateChange: ({ label, centered, bodyId, selectedPlaceId, visitedPlaceId }) => {
            state.selectedPlaceId = selectedPlaceId || state.selectedPlaceId;
            if (visitedPlaceId) state.visitedPlaceId = visitedPlaceId;
            if (bodyId) {
              state.selectedBodyId = bodyId;
              if (centered) state.orbitBodyId = bodyId;
            }
            publishPlaceStatus(label, centered);
            publish();
          }
        });
        if (destroyed) {
          candidate?.destroy?.();
          return null;
        }
        placesController = candidate;
        publish();
        return placesController;
      })
      .catch(() => null);
    return placesPromise;
  }

  function focusVisibleWorldSwitch() {
    if (!worldSwitch
      || worldSwitch.hidden
      || worldSwitch.disabled
      || worldSwitch.inert) return false;
    worldSwitch.focus?.({ preventScroll: true });
    return true;
  }

  function assignViewDistance(value = {}, progress = state.viewProgress) {
    const suppliedDistance = Number(value.distanceMeters);
    const represented = Number.isFinite(suppliedDistance) && suppliedDistance > 0
      ? suppliedDistance
      : resolvePlanetHubRepresentedDistance(progress, value.bounds).distanceMeters;
    const formatted = formatPlanetHubRepresentedDistance(represented);
    state.viewDistanceMeters = formatted.distanceMeters;
    state.viewDistanceLabel = formatted.label;
    state.viewDistanceUnit = formatted.unit;
    state.viewDistanceAriaLabel = formatted.ariaLabel;
    return formatted;
  }

  function syncViewDistanceReadout() {
    const meters = String(state.viewDistanceMeters);
    canvas.dataset.planetHubDistanceMeters = meters;
    canvas.dataset.planetHubDistanceLabel = state.viewDistanceLabel;
    canvas.dataset.planetHubDistanceUnit = state.viewDistanceUnit;
    if (zoomRail?.dataset) {
      zoomRail.dataset.planetHubDistanceMeters = meters;
      zoomRail.dataset.planetHubDistanceUnit = state.viewDistanceUnit;
    }
    if (zoomDistanceValue) zoomDistanceValue.textContent = state.viewDistanceLabel;
    if (zoomDistanceUnit) {
      zoomDistanceUnit.textContent = state.viewDistanceUnit;
      zoomDistanceUnit.title = state.viewDistanceUnit === "km" ? "kilometres"
        : state.viewDistanceUnit === "AU" ? "astronomical units"
          : state.viewDistanceUnit === "ly" ? "light-years"
            : state.viewDistanceUnit === "kly" ? "thousand light-years"
              : state.viewDistanceUnit === "Mly" ? "million light-years"
                : state.viewDistanceUnit === "Gly" ? "billion light-years"
              : state.viewDistanceUnit;
    }
    zoomDistance?.setAttribute?.("aria-label", state.viewDistanceAriaLabel);
    zoomDistance?.setAttribute?.("title", state.viewDistanceAriaLabel);
  }

  function publish() {
    for (const host of new Set([root, orbitRoot].filter((value) => value?.dataset))) {
      host.dataset.homeHubRenderer = state.renderer;
      host.dataset.homeHubPhase = state.phase;
      host.dataset.homeHubQuality = state.quality;
      host.dataset.homeHubSpace = state.space;
      host.dataset.homeSpaceQuality = state.space === "static" ? "static" : state.quality;
      host.dataset.homeSpaceEffects = state.effectsLevel;
      host.dataset.homeSpaceMotion = state.suspended
        ? "suspended"
        : state.space === "dynamic" && state.effectsLevel === "full" && !reducedMotion
          ? "active"
          : "frozen";
      host.dataset.homeWorld = state.worldId;
      host.dataset.homeHubOrbitBody = state.orbitBodyId;
      host.dataset.homeHubSelectedBody = state.selectedBodyId;
      host.dataset.homeHubDestination = state.activeDestination;
      host.dataset.homeHubMode = state.mode;
      host.dataset.homeHubView = state.viewBand;
      host.dataset.homeHubZoom = Number(state.viewProgress || 0).toFixed(3);
      host.dataset.homeHubCosmicZoom = Number(state.cosmicProgress || 0).toFixed(3);
      host.dataset.homeHubZoomSegment = state.viewSegment;
      host.dataset.homeHubDistanceMeters = String(state.viewDistanceMeters);
      host.dataset.homeHubDistanceLabel = state.viewDistanceLabel;
      host.dataset.homeHubDistanceUnit = state.viewDistanceUnit;
      if (state.focusTransition) host.dataset.homeHubTransition = state.focusTransition;
      else delete host.dataset.homeHubTransition;
      host.dataset.homeHubSuspended = state.suspended ? "true" : "false";
    }
    syncViewDistanceReadout();
    // Keep both layers laid out; CSS opacity performs the no-reflow poster/3D crossfade.
    canvas.hidden = false;
    poster.hidden = false;
    const fallbackReturnContract = resolvePlanetHubOrbitReturnContract(state);
    const returnContract = placesController?.getBackContract?.(fallbackReturnContract)
      || fallbackReturnContract;
    orbitReturn.hidden = !returnContract.visible;
    orbitReturn.toggleAttribute?.("inert", !returnContract.visible);
    orbitReturn.textContent = returnContract.label;
    orbitReturn.setAttribute?.("aria-label", returnContract.ariaLabel);
    syncSemanticZoomRail();
    orbitReturn.dataset.planetHubReturnKind = returnContract.kind;
    for (const host of new Set([root, orbitRoot].filter((value) => value?.dataset))) {
      host.dataset.homeHubReturn = returnContract.kind;
    }
    const inspectingWorld = state.worldId === "earth" && state.orbitBodyId === "moon";
    const moonSelectable = state.selectableHomeWorldIds.includes("moon")
      && state.moonHomeWorldAccess.unlocked;
    worldInspection.hidden = !inspectingWorld;
    worldInspection.toggleAttribute?.("inert", !inspectingWorld);
    if (inspectionTitle) inspectionTitle.textContent = moonSelectable ? "Moon orbit ready" : "Wake the Moon";
    if (inspectionDetail) inspectionDetail.textContent = moonSelectable
      ? "Its Power is awake. The Moon can now become your full planetary Home."
      : "Complete the Power project to make the Moon a Home world.";
    if (inspectionSelect) {
      const showSelect = inspectingWorld && moonSelectable && worldSelectionInFlight == null;
      inspectionSelect.hidden = !showSelect;
      inspectionSelect.inert = !showSelect;
    }
    if (worldSwitch) {
      const targetWorld = state.worldId === "moon" ? "earth" : "moon";
      const showSwitch = state.mode === "overview"
        && worldSelectionInFlight == null
        && state.selectableHomeWorldIds.includes(targetWorld);
      worldSwitch.hidden = !showSwitch;
      worldSwitch.inert = !showSwitch;
      worldSwitch.dataset.planetHubWorldTarget = targetWorld;
      worldSwitch.setAttribute?.("aria-label", targetWorld === "moon" ? "View Moon Home world" : "Return to Earth Home world");
      if (worldSwitchLabel) worldSwitchLabel.textContent = targetWorld === "moon" ? "View Moon" : "Return to Earth";
    }
    if (state.renderer === "webgl" && !placesController) void ensurePlacesController();
  }

  function selectHomeWorld(targetWorld, { source = "world-switch" } = {}) {
    const normalized = targetWorld === "moon" ? "moon" : "earth";
    if (destroyed
      || normalized === state.worldId
      || worldSelectionInFlight
      || !state.selectableHomeWorldIds.includes(normalized)
      || typeof onWorldSelect !== "function") return false;
    worldSelectionInFlight = normalized;
    restoreWorldSwitchFocus = false;
    root.dataset.homeHubWorldSelection = normalized;
    publish();
    let accepted = false;
    try {
      accepted = onWorldSelect(normalized, { source, fromWorld: state.worldId }) !== false;
    } catch {
      accepted = false;
    }
    if (!accepted) {
      worldSelectionInFlight = null;
      restoreWorldSwitchFocus = false;
      delete root.dataset.homeHubWorldSelection;
      publish();
    } else {
      restoreWorldSwitchFocus = true;
    }
    return accepted;
  }

  function setPhase(phase) {
    const nextPhase = PLANET_HUB_PHASES.includes(phase) ? phase : "fallback";
    const previousPhase = state.phase;
    const hadFocusTransition = Boolean(state.focusTransition);
    state.phase = nextPhase;
    if (state.phase === "ready") state.focusTransition = null;
    if (previousPhase !== nextPhase || (nextPhase === "ready" && hadFocusTransition)) publish();
    // A completed authored move can carry a landmark into or out of a parked
    // pointer. Re-raycast once from the retained client coordinate. Continuous
    // motion uses the renderer's optional `onInteractionFrame` seam below.
    if (state.phase === "ready" && (previousPhase !== "ready" || hadFocusTransition)) {
      interaction?.reconcilePointer?.({ source: "renderer-ready", force: true });
    }
  }

  function setSpaceState(value) {
    state.space = ["dynamic", "reduced", "static", "failed"].includes(value) ? value : "failed";
    publish();
    return state.space;
  }

  function setViewState(value = {}) {
    const progress = Math.max(0, Math.min(1, Number(value.progress) || 0));
    const band = stabilizePlanetHubViewBand({
      progress,
      previousBand: state.viewBand
    });
    state.viewProgress = progress;
    state.viewBand = band;
    state.viewSegment = value.segment === "cosmic" ? "cosmic" : "legacy";
    state.cosmicProgress = Math.max(0, Math.min(1, Number(value.cosmicProgress) || 0));
    state.cosmicTargetProgress = Math.max(0, Math.min(1,
      Number(value.cosmicTargetProgress ?? state.cosmicProgress) || 0
    ));
    state.cosmicTier = value.cosmicTier || null;
    assignViewDistance(value, progress);
    for (const host of new Set([root, orbitRoot].filter((entry) => entry?.dataset))) {
      host.dataset.homeHubView = band;
      host.dataset.homeHubZoom = progress.toFixed(3);
      host.dataset.homeHubCosmicZoom = state.cosmicProgress.toFixed(3);
      host.dataset.homeHubZoomSegment = state.viewSegment;
      host.dataset.homeHubZooming = String(
        Math.abs(Number(value.targetProgress) - progress) > 0.0001
          || Math.abs(state.cosmicTargetProgress - state.cosmicProgress) > 0.0001
      );
      host.dataset.homeHubDistanceMeters = String(state.viewDistanceMeters);
      host.dataset.homeHubDistanceLabel = state.viewDistanceLabel;
      host.dataset.homeHubDistanceUnit = state.viewDistanceUnit;
    }
    syncViewDistanceReadout();
    syncSemanticZoomRail();
    return Object.freeze({
      progress,
      band,
      segment: state.viewSegment,
      cosmicProgress: state.cosmicProgress,
      cosmicTier: state.cosmicTier,
      distanceMeters: state.viewDistanceMeters,
      distanceLabel: state.viewDistanceLabel,
      distanceUnit: state.viewDistanceUnit
    });
  }

  function setPoster(destination = state.activeDestination) {
    const value = manifest?.worlds?.[state.worldId]?.posters?.[normalizePlanetHubDestination(destination)];
    if (!value) return;
    try { poster.src = new URL(value, publicAssetBaseUrl()).href; } catch { poster.src = value; }
  }

  function fallback(phase = "fallback") {
    placesController?.reset?.({ selectedId: state.worldId });
    state.renderer = "fallback";
    state.phase = phase;
    state.space = "static";
    state.focusTransition = null;
    state.viewBand = "planet";
    state.viewProgress = 0;
    state.viewSegment = "legacy";
    state.cosmicProgress = 0;
    state.cosmicTargetProgress = 0;
    state.selectedPlaceId = state.worldId;
    state.visitedPlaceId = state.worldId;
    assignViewDistance({}, 0);
    setPoster();
    publish();
  }

  function applyRendererCenterDestination(destination, {
    availableDestinations = state.availableDestinations
  } = {}) {
    const normalized = normalizePlanetHubDestination(destination);
    const available = normalizeAvailability(availableDestinations);
    if (state.mode !== "overview" || !available.includes(normalized)) return false;
    state.availableDestinations = available;
    state.activeDestination = normalized;
    state.focusedDestination = null;
    state.mode = "overview";
    // Portal playback follows what is physically front-facing, but this path
    // intentionally does not call setDestination/setHubMode: the globe already
    // reached this pose through direct manipulation or its living-world idle.
    renderer?.adoptDestination?.(normalized);
    setPoster(normalized);
    publish();
    return true;
  }

  function onRendererCenterDestination(destination) {
    const normalized = normalizePlanetHubDestination(destination);
    if (destroyed
      || state.mode !== "overview"
      || state.orbitBodyId !== state.worldId
      || state.selectedBodyId !== state.worldId
      || !state.availableDestinations.includes(normalized)
      || normalized === state.activeDestination
      || centerSelectionInFlight === normalized) return false;

    centerSelectionInFlight = normalized;
    const source = "planet-center";
    const selected = orbitController?.select
      ? orbitController.select(normalized, { source, announce: false, focusTab: false })
      : typeof onSelect === "function"
        ? onSelect(normalized, { source })
        : true;
    if (selected !== false && state.activeDestination !== normalized) {
      applyRendererCenterDestination(normalized);
    }
    centerSelectionInFlight = null;
    return selected !== false;
  }

  function focusOrbitBody(body = state.worldId, {
    source = "body-double-click",
    animate = !reducedMotion,
    restoreFocus = false
  } = {}) {
    const normalized = String(body || state.worldId).trim().toLowerCase() || state.worldId;
    const accepted = renderer?.setOrbitBody?.(normalized, { animate, source }) || false;
    if (!accepted) return false;
    state.orbitBodyId = normalized;
    state.selectedBodyId = normalized;
    state.selectedPlaceId = normalized;
    state.visitedPlaceId = normalized;
    state.phase = state.renderer === "webgl"
      ? (renderer?.getNavigationPhase?.() || (animate ? "transitioning" : "ready"))
      : "fallback";
    publishBodyStatus(normalized, true);
    publish();
    if (restoreFocus) {
      const tabId = `homeOrbitTab${state.activeDestination[0].toUpperCase()}${state.activeDestination.slice(1)}`;
      documentRef?.getElementById?.(tabId)?.focus?.({ preventScroll: true });
    }
    return true;
  }

  function selectOrbitBody(body = state.orbitBodyId, { source = "body-click" } = {}) {
    const normalized = String(body || state.orbitBodyId || state.worldId).trim().toLowerCase();
    const accepted = renderer?.setSelectedBody?.(normalized, { source }) || false;
    if (!accepted) return false;
    state.selectedBodyId = normalized;
    state.selectedPlaceId = normalized;
    publishBodyStatus(normalized, normalized === state.orbitBodyId);
    publish();
    return true;
  }

  function publishBodyStatus(body, centered) {
    const label = renderer?.getBodyLabel?.(body)
      || `${body.slice(0, 1).toUpperCase()}${body.slice(1)}`;
    publishPlaceStatus(label, centered);
  }

  function publishPlaceStatus(label, centered) {
    const status = documentRef?.getElementById?.("homeOrbitStatus");
    if (!status) return;
    status.textContent = centered
      ? `${label} centered. Drag to orbit or scroll to zoom.`
      : `${label} selected. Choose Visit or activate it again to center.`;
  }

  function commit(destination, meta = {}) {
    const normalized = normalizePlanetHubDestination(destination);
    if (!state.availableDestinations.includes(normalized)) return false;
    if (normalized === "journey"
      && meta.action === "journey-launch"
      && state.mode === "focused"
      && state.focusedDestination === "journey"
      && state.activeDestination === "journey"
      && !state.focusTransition
      && state.phase === "ready") {
      const journeyControl = resolveJourneyControls().actionTarget;
      if (journeyControl) {
        void stageJourneyActivation({ trigger: journeyControl }).then((proceed) => {
          if (!proceed || destroyed) return;
          delegateJourneyClick(journeyControl);
        });
        return true;
      }
      focusDestinationControl("journey");
      return false;
    }
    const selected = orbitController?.select
      ? orbitController.select(normalized, { source: meta.source || "planet-hub" })
      : typeof onSelect === "function"
        ? onSelect(normalized, { source: meta.source || "planet-hub" })
        : true;
    if (selected === false) return false;
    state.activeDestination = normalized;
    const landmarkFocus = ["landmark", "journey-control"].includes(meta.source);
    const focusTransition = landmarkFocus && state.renderer === "webgl" ? "focus-in" : null;
    // Clear hover/inertia while the controller still describes the authored
    // overview. The renderer may publish a final `ready` pulse while braking;
    // doing this first prevents that cleanup pulse from erasing focus-in before
    // the actual presentation transition begins.
    renderer?.clearPointerOrbit?.({
      source: landmarkFocus ? "landmark-commit" : (meta.source || "destination-commit")
    });
    state.mode = landmarkFocus ? "focused" : "overview";
    state.focusTransition = focusTransition;
    state.focusedDestination = landmarkFocus ? normalized : null;
    if (landmarkFocus) renderer?.setHubMode?.("focused", normalized, { animate: true });
    else {
      renderer?.setHubMode?.("overview", normalized, { animate: false });
      renderer?.setDestination?.(normalized, { animate: true });
    }
    setPoster(normalized);
    publish();
    if (landmarkFocus) focusDestinationControl(normalized);
    return true;
  }

  function exitFocusedMode({ source = "orbit-return", restoreFocus = false } = {}) {
    if (state.mode !== "focused") return false;
    cancelJourneyActivation(source);
    // As on entry, finish pointer cleanup before publishing the next mode. A
    // renderer `ready` pulse here must belong to the old focused state, not
    // prematurely complete the focus-out choreography.
    renderer?.clearPointerOrbit?.({ source });
    state.mode = "overview";
    state.focusTransition = state.renderer === "webgl" ? "focus-out" : null;
    state.focusedDestination = null;
    renderer?.setHubMode?.("overview", state.activeDestination, { animate: true });
    state.phase = state.renderer === "webgl" ? "transitioning" : "fallback";
    root.dataset.homeHubExitSource = source;
    setPoster(state.activeDestination);
    publish();
    if (restoreFocus) {
      const tabId = `homeOrbitTab${state.activeDestination[0].toUpperCase()}${state.activeDestination.slice(1)}`;
      documentRef?.getElementById?.(tabId)?.focus?.({ preventScroll: true });
    }
    return true;
  }

  function applyViewZoom(progress, {
    direction = 0,
    input = "api",
    source = input,
    target = root,
    event = null,
    segment = "legacy"
  } = {}) {
    const zoom = renderer?.getViewZoom?.() || {
      progress: state.viewProgress,
      targetProgress: state.viewProgress
    };
    const ownership = resolvePlanetHubZoomOwnership({
      renderer: state.renderer,
      mode: state.mode,
      phase: state.phase,
      cameraOwner: renderer?.getCameraOwner?.() || "home-orbit",
      input,
      direction,
      interactiveTarget: isPlanetHubZoomBlockedTarget(target, root),
      atMinimum: segment === "cosmic"
        ? Number(zoom.cosmicTargetProgress) <= 0.0001
        : zoom.targetProgress <= 0.0001,
      atMaximum: segment === "cosmic"
        ? Number(zoom.cosmicTargetProgress) >= 0.9999
        : zoom.targetProgress >= 0.9999
    });
    if (!ownership.accepted) return false;
    if (ownership.action === "retarget") return false;
    if (ownership.consume) event?.preventDefault?.();
    if (ownership.action === "exit-focus") {
      return exitFocusedMode({ source: `${source}-out`, restoreFocus: false });
    }
    renderer?.setHoveredDestination?.(null);
    const method = segment === "cosmic" ? renderer?.setCosmicZoom : renderer?.setViewZoom;
    return method?.call?.(renderer, progress, {
      source,
      immediate: reducedMotion
    }) || false;
  }

  function syncSemanticZoomRail() {
    placesController?.sync?.();
    if (!zoomRail) return false;
    const flight = root.dataset.planetHubJourneyFlight === "true"
      || orbitRoot?.dataset?.planetHubJourneyFlight === "true";
    const dialogOpen = Boolean(documentRef?.querySelector?.(
      "dialog[open], [role='dialog'][aria-modal='true']:not([hidden])"
    ));
    const returnKind = resolvePlanetHubOrbitReturnContract(state).kind;
    const currentWorldOwnsCamera = state.orbitBodyId === state.worldId
      && (!state.visitedPlaceId || state.visitedPlaceId === state.worldId)
      && !["body-focus", "body-selection"].includes(returnKind);
    const visible = state.renderer === "webgl"
      && state.mode === "overview"
      && !["loading", "fallback", "lost"].includes(state.phase)
      && currentWorldOwnsCamera
      && !flight
      && !dialogOpen;
    zoomRail.hidden = !visible;
    zoomRail.toggleAttribute?.("inert", !visible);
    zoomRail.setAttribute?.("aria-hidden", String(!visible));
    const activeIndex = Math.max(0, PLANET_HUB_SEMANTIC_ZOOM_STOPS.findIndex(({ band }) => band === state.viewBand));
    zoomStops.forEach((control, index) => {
      const active = index === activeIndex;
      control.setAttribute?.("aria-checked", String(active));
      control.tabIndex = active ? 0 : -1;
      control.disabled = !visible;
    });
    if (zoomReset) {
      const body = renderer?.getBodyLabel?.(state.orbitBodyId) || state.orbitBodyId;
      zoomReset.disabled = !visible;
      zoomReset.setAttribute?.("aria-label", `Reset view to ${body}`);
    }
    return visible;
  }

  function selectSemanticZoom(index, { source = "zoom-rail", focus = false } = {}) {
    const stop = PLANET_HUB_SEMANTIC_ZOOM_STOPS[index];
    if (!stop || !syncSemanticZoomRail()) return false;
    const zoom = renderer?.getViewZoom?.();
    if (stop.band === "universe" && Number(zoom?.cosmicTargetProgress) > 1e-9) {
      const accepted = applyViewZoom(0, {
        direction: -1,
        input: "api",
        source,
        target: root,
        segment: "cosmic"
      });
      if (accepted && focus) zoomStops[index]?.focus?.({ preventScroll: true });
      return accepted;
    }
    const current = Number(zoom?.targetProgress ?? state.viewProgress) || 0;
    const accepted = applyViewZoom(stop.progress, {
      direction: Math.sign(stop.progress - current),
      input: "api",
      source,
      target: root
    });
    if (accepted && focus) zoomStops[index]?.focus?.({ preventScroll: true });
    return accepted;
  }

  function wheelZoom(event) {
    if (destroyed || isPlanetHubZoomBlockedTarget(event?.target, root)) return;
    const zoom = renderer?.getViewZoom?.();
    const current = Number(zoom?.targetProgress ?? state.viewProgress) || 0;
    const cosmicCurrent = Number(zoom?.cosmicTargetProgress ?? state.cosmicTargetProgress) || 0;
    const outward = Number(event?.deltaY) > 0;
    const cosmicSegment = cosmicCurrent > 1e-9 || (current >= 0.9999 && outward);
    const calculate = cosmicSegment ? calculatePlanetHubCosmicWheelZoom : calculatePlanetHubWheelZoom;
    const next = calculate({
      progress: cosmicSegment ? cosmicCurrent : current,
      deltaY: event?.deltaY,
      deltaMode: event?.deltaMode,
      viewportHeight: windowRef?.visualViewport?.height || windowRef?.innerHeight || 720
    });
    if (!next.changed && state.mode !== "focused") {
      event?.preventDefault?.();
      return;
    }
    const accepted = applyViewZoom(next.progress, {
      direction: next.direction,
      input: "wheel",
      source: "wheel",
      target: event?.target,
      event,
      segment: cosmicSegment ? "cosmic" : "legacy"
    });
    if (!accepted) event?.preventDefault?.();
  }

  let pinchStartProgress = null;
  let pinchStartSegment = "legacy";
  interaction = createPlanetHubInteraction({
    stage: root,
    windowRef,
    getAvailable: () => state.availableDestinations,
    getMode: () => state.mode,
    pick: (x, y) => renderer?.pick?.(x, y) || null,
    pickDetail: (x, y) => renderer?.pickDetail?.(x, y) || null,
    onHoverEnd: ({ source = "hover-stop" } = {}) => {
      if (state.focusTransition) return false;
      // Preserve why hover ended. The renderer uses this to distinguish a
      // landmark acquisition from the dead zone and a genuine stage exit.
      const stopped = renderer?.clearPointerOrbit?.({ source }) || false;
      const nextPhase = state.renderer === "webgl" ? "ready" : "fallback";
      if (stopped && state.phase !== nextPhase) {
        state.phase = nextPhase;
        publish();
      }
      return stopped;
    },
    onDragOrbit: (delta) => {
      if (destroyed || state.mode !== "overview" || state.focusTransition) return false;
      const accepted = renderer?.setPointerDrag?.(delta) || false;
      if (!accepted) return false;
      state.phase = state.renderer === "webgl" ? "preview" : "fallback";
      root.dataset.planetHubDragging = "true";
      publish();
      return true;
    },
    onDragEnd: ({ cancelled = false, ...release } = {}) => {
      delete root.dataset.planetHubDragging;
      const released = renderer?.releasePointerDrag?.({ cancelled, ...release }) || false;
      if (released) state.phase = state.renderer === "webgl" ? "ready" : "fallback";
      publish();
      return released;
    },
    onPinchZoom: ({ startSpan, currentSpan } = {}, meta = {}) => {
      const zoom = renderer?.getViewZoom?.();
      if (pinchStartProgress == null) {
        const legacyProgress = Number(zoom?.targetProgress ?? state.viewProgress) || 0;
        const cosmicProgress = Number(zoom?.cosmicTargetProgress ?? state.cosmicTargetProgress) || 0;
        const outward = Number(currentSpan) < Number(startSpan);
        pinchStartSegment = cosmicProgress > 1e-9 || (legacyProgress >= 0.9999 && outward)
          ? "cosmic" : "legacy";
        pinchStartProgress = pinchStartSegment === "cosmic" ? cosmicProgress : legacyProgress;
      }
      const next = calculatePlanetHubPinchZoom({
        startProgress: pinchStartProgress,
        startSpan,
        currentSpan,
        bounds: pinchStartSegment === "cosmic" ? PLANET_HUB_COSMIC_PINCH_BOUNDS : zoom?.bounds
      });
      if (!next.changed && state.mode !== "focused") return false;
      return applyViewZoom(next.progress, {
        direction: Math.sign(next.progress - pinchStartProgress),
        input: "pinch",
        source: meta?.source || "pinch",
        target: root,
        segment: pinchStartSegment
      });
    },
    onPinchEnd: () => {
      pinchStartProgress = null;
      pinchStartSegment = "legacy";
      return true;
    },
    onLandmarkHoverChange: (destination, meta) => {
      const action = meta?.action || null;
      const changed = renderer?.setHoveredDestination?.(destination, { action }) || false;
      return changed;
    },
    onBodySelect: (body, meta = {}) => selectOrbitBody(body, {
      source: meta.source || "body-click"
    }),
    onBodyFocus: (body, meta = {}) => focusOrbitBody(body, {
      source: meta.source || "body-double-click"
    }),
    onCommit: commit,
    onExitFocus: (meta = {}) => state.orbitBodyId !== state.worldId
      ? focusOrbitBody(state.worldId, { source: meta.source || "planet-background" })
      : state.selectedBodyId !== state.worldId
        ? selectOrbitBody(state.worldId, { source: meta.source || "space-background" })
        : exitFocusedMode(meta)
  });
  listen(root, "wheel", wheelZoom, { passive: false });

  async function fetchManifest() {
    if (manifest) return manifest;
    if (typeof fetchRef !== "function") throw new TypeError("fetch is unavailable for the planet hub manifest.");
    // Revalidate the small versioned contract so a newly shipped optional
    // model (for example the Sun) cannot remain invisible behind an older HTTP
    // cache entry. The service worker still provides the warm-offline copy.
    const response = await fetchRef(manifestUrl, { cache: "no-cache" });
    if (!response?.ok) throw new Error(`Planet hub manifest request failed (${response?.status || "network"}).`);
    const value = await response.json();
    validatePlanetHubManifest(value);
    manifest = value;
    setPoster();
    return manifest;
  }

  async function buildRenderer(expectedGeneration) {
    if (destroyed || expectedGeneration !== generation || state.quality === "static") return false;
    modules ||= await modulesLoader({ importer, threeSpecifier, loaderUrl });
    if (destroyed || expectedGeneration !== generation) return false;
    renderer?.destroy?.();
    renderer = null;
    placesController?.destroy?.();
    placesController = null;
    placesPromise = null;
    const candidate = await rendererFactory({
      canvas,
      manifest,
      worldId: state.worldId,
      quality: state.quality,
      modules,
      availableDestinations: state.availableDestinations,
      activeDestination: state.activeDestination,
      assetBaseUrl: publicAssetBaseUrl(),
      documentRef,
      windowRef,
      reducedMotion,
      effectsLevel: state.effectsLevel,
      onPhase: setPhase,
      // Runtime owns pointer semantics while the renderer owns moving scene
      // matrices. Renderers may call this after a motion frame to re-raycast a
      // stationary fine pointer without dispatching synthetic DOM events.
      onInteractionFrame: (meta = {}) => interaction?.reconcilePointer?.({
        source: meta?.source || "renderer-frame"
      }) || false,
      onViewChange: setViewState,
      onSpaceState: setSpaceState,
      onCenterDestination: onRendererCenterDestination,
      onAutoplayFailure: () => root.dataset.homeHubPortal = "poster"
    });
    if (destroyed || expectedGeneration !== generation) {
      candidate?.destroy?.();
      return false;
    }
    renderer = candidate;
    setViewState(renderer.getViewZoom?.() || { progress: 0, band: "planet" });
    renderer.setEffectsLevel?.(state.effectsLevel, { reducedMotion });
    state.renderer = "webgl";
    state.phase = "ready";
    publish();
    return true;
  }

  function deriveQuality() {
    const measured = capabilities || readPlanetHubCapabilities({ documentRef, windowRef, navigatorRef });
    return selectPlanetHubQuality({ ...measured, contextLosses: state.contextLosses });
  }

  async function beginPrepare(expectedGeneration) {
    try {
      await fetchManifest();
      if (destroyed || expectedGeneration !== generation) return false;
      if (state.quality === "static") {
        fallback();
        return false;
      }
      return await buildRenderer(expectedGeneration);
    } catch (error) {
      if (destroyed || expectedGeneration !== generation) return false;
      root.dataset.homeHubError = error?.name || "Error";
      root.dataset.homeHubErrorMessage = String(error?.message || "Planet Hub preparation failed.");
      fallback();
      return false;
    }
  }

  async function prepare({ worldId = state.worldId, deadlineMs = 650 } = {}) {
    if (destroyed) return frozenSnapshot(state);
    state.worldId = normalizePlanetHubWorld(worldId);
    state.orbitBodyId = state.worldId;
    state.selectedBodyId = state.worldId;
    placesController?.reset?.({ selectedId: state.worldId });
    state.viewBand = "planet";
    state.viewProgress = 0;
    assignViewDistance({}, 0);
    state.quality = deriveQuality();
    if (state.quality === "static" && renderer) {
      renderer.destroy?.();
      renderer = null;
    }
    state.renderer = "pending";
    state.phase = "loading";
    publish();
    generation += 1;
    const expectedGeneration = generation;
    preparePromise = beginPrepare(expectedGeneration);
    const deadline = Math.max(0, Number(deadlineMs) || 0);
    if (!deadline) {
      prepareReadinessPromise = preparePromise;
      await prepareReadinessPromise;
      return frozenSnapshot(state);
    }
    let timer = 0;
    const timedOut = new Promise((resolve) => {
      timer = windowRef?.setTimeout?.(() => resolve("timeout"), deadline) || setTimeout(() => resolve("timeout"), deadline);
    });
    prepareReadinessPromise = Promise.race([preparePromise.then(() => "ready"), timedOut])
      .then((result) => {
        if (timer) (windowRef?.clearTimeout || clearTimeout)(timer);
        // A capable device that misses the interaction deadline is still
        // building the live scene.  Reclassifying that work as `fallback`
        // hides the charting indicator and leaves an apparently frozen poster
        // on screen until model parsing and GPU upload happen to finish.  Keep
        // the truthful pending/loading state; genuine static capability,
        // preparation errors, and context loss continue to call fallback().
        return result;
      });
    await prepareReadinessPromise;
    return frozenSnapshot(state);
  }

  function sync({
    worldId = state.worldId,
    activeDestination = state.activeDestination,
    availableDestinations = state.availableDestinations,
    selectableHomeWorldIds = state.selectableHomeWorldIds,
    moonHomeWorldAccess = state.moonHomeWorldAccess,
    journeyAction = state.journeyAction,
    revealState = state.revealState,
    effectsLevel = state.effectsLevel
  } = {}) {
    if (destroyed) return frozenSnapshot(state);
    const previousWorld = state.worldId;
    const previousDestination = state.activeDestination;
    const previousAvailability = state.availableDestinations;
    const previousMode = state.mode;
    const previousEffectsLevel = state.effectsLevel;
    const returnInProgress = Boolean(journeyReturnSession && !journeyReturnSession.interrupted);
    const requestedWorld = normalizePlanetHubWorld(worldId);
    const nextWorld = returnInProgress ? previousWorld : requestedWorld;
    const nextAvailability = normalizeAvailability(availableDestinations);
    const nextSelectableHomeWorldIds = normalizeSelectableHomeWorlds(selectableHomeWorldIds);
    const requested = normalizePlanetHubDestination(activeDestination);
    const nextDestination = returnInProgress
      ? previousDestination
      : nextAvailability.includes(requested) ? requested : nextAvailability[0];
    const worldChanged = nextWorld !== previousWorld;
    const destinationChanged = nextDestination !== previousDestination;
    const availabilityChanged = previousAvailability.length !== nextAvailability.length
      || previousAvailability.some((destination, index) => destination !== nextAvailability[index]);
    if (journeyActivationPromise && (worldChanged || destinationChanged)) {
      cancelJourneyActivation("sync");
    }
    if (returnInProgress) {
      // While reverse travel is staged, the Earth renderer temporarily owns
      // both worlds even though the authoritative profile still reports Moon.
      // Passive Home/activity sync may refresh metadata, but it must never
      // tear down or retarget that in-flight presentation.
      state.availableDestinations = nextAvailability;
      state.selectableHomeWorldIds = nextSelectableHomeWorldIds;
      state.moonHomeWorldAccess = normalizeMoonHomeWorldAccess(moonHomeWorldAccess, nextSelectableHomeWorldIds);
      state.journeyAction = normalizeJourneyAction(journeyAction);
      state.revealState = String(revealState || "tutorial");
      state.effectsLevel = normalizePlanetHubEffectsLevel(effectsLevel);
      if (availabilityChanged) renderer?.setAvailable?.(state.availableDestinations);
      if (previousEffectsLevel !== state.effectsLevel) {
        renderer?.setEffectsLevel?.(state.effectsLevel, { reducedMotion });
      }
      publish();
      return frozenSnapshot(state);
    }
    state.worldId = nextWorld;
    state.availableDestinations = nextAvailability;
    state.selectableHomeWorldIds = nextSelectableHomeWorldIds;
    state.moonHomeWorldAccess = normalizeMoonHomeWorldAccess(moonHomeWorldAccess, nextSelectableHomeWorldIds);
    state.activeDestination = nextDestination;
    state.mode = "overview";
    state.focusTransition = null;
    state.focusedDestination = null;
    if (worldChanged) {
      state.orbitBodyId = nextWorld;
      state.selectedBodyId = nextWorld;
    }
    if (worldChanged || destinationChanged) placesController?.reset?.({ selectedId: nextWorld });
    const completedWorldSelection = worldSelectionInFlight === state.worldId;
    const shouldRestoreWorldSwitchFocus = completedWorldSelection && restoreWorldSwitchFocus;
    if (worldChanged || completedWorldSelection) {
      worldSelectionInFlight = null;
      restoreWorldSwitchFocus = false;
      delete root.dataset.homeHubWorldSelection;
    }
    state.journeyAction = normalizeJourneyAction(journeyAction);
    state.revealState = String(revealState || "tutorial");
    state.effectsLevel = normalizePlanetHubEffectsLevel(effectsLevel);
    if (availabilityChanged) renderer?.setAvailable?.(state.availableDestinations);
    if (previousEffectsLevel !== state.effectsLevel) {
      renderer?.setEffectsLevel?.(state.effectsLevel, { reducedMotion });
    }
    if (worldChanged && manifest) {
      renderer?.destroy?.();
      renderer = null;
      void prepare({ worldId: nextWorld, deadlineMs: 0 });
    } else {
      // Home's HTML controller publishes its selection synchronously, then the
      // app bridge follows with an asynchronous snapshot sync. When the
      // renderer itself selected a landmark that second, semantically
      // identical sync must not hard-stop the globe's physical coast or replay
      // the same destination transition. Only a real destination/mode change
      // owns the presentation transform.
      const presentationChanged = destinationChanged || previousMode !== "overview";
      if (presentationChanged) {
        renderer?.clearPointerOrbit?.({ source: "sync" });
        // The renderer is already in overview for ordinary rail/keyboard
        // changes. Hard-setting that same mode first applies the destination
        // quaternion immediately, leaving the following animated call with no
        // distance to travel. Only mode exits need setHubMode; destination-only
        // changes rotate from the current physical pose in one authored move.
        if (previousMode !== "overview") {
          renderer?.setHubMode?.("overview", state.activeDestination, { animate: true });
        } else {
          renderer?.setDestination?.(state.activeDestination, { animate: true });
        }
      }
      setPoster();
      publish();
    }
    if (shouldRestoreWorldSwitchFocus) focusVisibleWorldSwitch();
    return frozenSnapshot(state);
  }

  function focus(destination, { animate = true } = {}) {
    const normalized = normalizePlanetHubDestination(destination);
    if (destroyed || !state.availableDestinations.includes(normalized)) return false;
    renderer?.clearPointerOrbit?.({ source: "focus" });
    state.phase = state.renderer === "webgl" ? (animate ? "transitioning" : "ready") : "fallback";
    renderer?.setDestination?.(normalized, { animate });
    setPoster(normalized);
    publish();
    if (!animate || state.renderer !== "webgl") state.phase = state.renderer === "webgl" ? "ready" : "fallback";
    return true;
  }

  function playRocketIgnition() {
    if (destroyed || reducedMotion) return false;
    renderer?.setRocketIgnition?.(1, 620);
    return Boolean(renderer);
  }

  async function stageJourneyActivation({ trigger = null } = {}) {
    if (destroyed) return false;
    if (trigger?.dataset?.planetHubJourneyDelegated === JOURNEY_DELEGATED_TOKEN) {
      delete trigger.dataset.planetHubJourneyDelegated;
      return true;
    }
    // The delegated semantic click is the final handoff into the existing
    // Journey authority. It must not recursively replay the in-hub departure.
    if (journeyActivationBypass) return true;
    if (journeyActivationPromise) return false;

    if (state.renderer === "pending" || state.phase === "loading") {
      // Await the same deadline used by Home's intro handoff, not the renderer
      // build itself. A model decoder is allowed to finish late, but a semantic
      // click can never hang behind it forever.
      try { await (prepareReadinessPromise || Promise.resolve()); } catch { /* fallback handling below */ }
      if (destroyed) return false;
    }
    if (state.renderer === "fallback") {
      return state.activeDestination === "journey";
    }
    if (state.renderer !== "webgl") return false;

    const frontAndFocused = state.activeDestination === "journey"
      && state.mode === "focused"
      && state.focusedDestination === "journey"
      && !state.focusTransition
      && state.phase === "ready";
    if (!frontAndFocused) {
      // A Journey activation is a spatial selection first. The same input can
      // never both pull the launch site into the foreground and leave Home.
      commit("journey", {
        source: "journey-control",
        action: null,
        trigger
      });
      return false;
    }

    const journeyControl = trigger || resolveJourneyControls().actionTarget;
    if (!journeyControl) return false;
    root.dataset.homeHubJourneyActivation = state.journeyAction;
    const stagesEarthToMoonTravel = state.worldId === "earth"
      && ["launch", "continue"].includes(state.journeyAction);
    if (!stagesEarthToMoonTravel) return true;
    root.dataset.homeHubJourneyDeparture = "ignition";
    beginJourneySemanticTimeline("outbound", { reduced: reducedMotion });
    renderer?.setRocketIgnition?.(1, reducedMotion ? 260 : 1500);
    state.phase = "transitioning";
    publish();

    const activationGeneration = ++journeyActivationGeneration;
    let activationCompleted = false;
    const pendingActivation = Promise.resolve(
      renderer?.playJourneyDeparture?.({ reducedMotion, destination: "moon" }) ?? true
    ).then((completed) => {
      if (destroyed || completed === false || activationGeneration !== journeyActivationGeneration) return false;
      activationCompleted = true;
      clearJourneySemanticTimeline();
      emitSemanticEvent("journey-touchdown", { direction: "outbound" });
      root.dataset.homeHubJourneyDeparture = "handoff";
      return true;
    }).catch(() => false).finally(() => {
      if (journeyActivationPromise === pendingActivation) journeyActivationPromise = null;
      if (!activationCompleted) clearJourneySemanticTimeline();
      if (!destroyed && !activationCompleted && state.phase === "transitioning") {
        state.phase = state.renderer === "webgl" ? "ready" : "fallback";
        publish();
      }
    });
    journeyActivationPromise = pendingActivation;
    return pendingActivation;
  }

  async function playJourneyReturn({
    fromWorld = "moon",
    toWorld = "earth",
    onPrepared = null
  } = {}) {
    if (destroyed || journeyReturnPromise || journeyActivationPromise) return false;
    if (fromWorld !== "moon" || toWorld !== "earth") return false;
    const returnGeneration = ++journeyReturnGeneration;
    let resolveInterruption = null;
    const interruption = new Promise((resolve) => { resolveInterruption = resolve; });
    const session = {
      generation: returnGeneration,
      fromWorld,
      toWorld,
      interrupted: false,
      outcome: null,
      resolveInterruption
    };
    journeyReturnSession = session;
    delete root.dataset.homeHubJourneyReturnReason;

    const waitFor = (value) => Promise.race([Promise.resolve(value), interruption]);
    const pendingReturn = (async () => {
      if (state.renderer === "pending" || state.phase === "loading") {
        try {
          const readiness = await waitFor(prepareReadinessPromise || Promise.resolve());
          if (readiness?.status === "interrupted") return readiness;
        } catch { /* poster fallback below */ }
        if (destroyed) return false;
      }

      // Earth owns both the launch pad and the orbiting Moon. A Home opened
      // from a lunar project initially projects the saved Moon world, so stage
      // the Earth renderer internally before reverse travel. The session is
      // registered before preparation so a passive Moon snapshot cannot swap
      // the renderer back out underneath this handoff.
      if (state.worldId === "moon") {
        root.dataset.homeHubJourneyReturn = "preparing";
        const prepared = await waitFor(prepare({ worldId: "earth", deadlineMs: 0 }));
        if (prepared?.status === "interrupted") return prepared;
        if (destroyed) return false;
      }
      if (session.interrupted) return session.outcome;
      if (state.renderer !== "webgl" || typeof renderer?.playJourneyReturn !== "function") return false;
      try { onPrepared?.(); } catch { /* presentation readiness never gates travel */ }

      root.dataset.homeHubJourneyReturn = "departing";
      beginJourneySemanticTimeline("return", { reduced: reducedMotion });
      state.phase = "transitioning";
      publish();
      const completed = await waitFor(renderer.playJourneyReturn({
        reducedMotion,
        fromWorld,
        toWorld
      }));
      if (completed?.status === "interrupted") return completed;
      if (session.interrupted) return session.outcome;
      if (destroyed || completed !== true || returnGeneration !== journeyReturnGeneration) return false;
      root.dataset.homeHubJourneyReturn = "arrived";
      clearJourneySemanticTimeline();
      emitSemanticEvent("journey-touchdown", { direction: "return" });
      return true;
    })().catch(() => session.interrupted ? session.outcome : false).finally(() => {
      if (journeyReturnPromise === pendingReturn) journeyReturnPromise = null;
      if (journeyReturnSession === session) journeyReturnSession = null;
      clearJourneySemanticTimeline();
      if (!destroyed && state.phase === "transitioning") {
        state.phase = state.renderer === "webgl" ? "ready" : "fallback";
        publish();
      }
    });
    journeyReturnPromise = pendingReturn;
    return pendingReturn;
  }

  function restoreJourneyAfterHandoff() {
    delete root.dataset.homeHubJourneyCancelReason;
    root.dataset.homeHubJourneyDeparture = "docked";
    return renderer?.restoreJourneyRocket?.() || false;
  }

  function setEffectsLevel(value) {
    if (destroyed) return state.effectsLevel;
    state.effectsLevel = normalizePlanetHubEffectsLevel(value);
    if (renderer?.setEffectsLevel) renderer.setEffectsLevel(state.effectsLevel, { reducedMotion });
    else state.space = "static";
    publish();
    return state.effectsLevel;
  }

  function setReducedMotion(value) {
    if (destroyed) return Boolean(reducedMotion);
    reducedMotion = Boolean(value);
    renderer?.setEffectsLevel?.(state.effectsLevel, { reducedMotion });
    publish();
    return reducedMotion;
  }

  function suspend(reason = "manual") {
    if (destroyed) return false;
    const normalizedReason = String(reason);
    if (state.suspendReasons.includes(normalizedReason)) return false;
    cancelJourneyActivation(reason);
    interruptJourneyReturn(reason);
    const reasons = new Set(state.suspendReasons);
    reasons.add(normalizedReason);
    state.suspendReasons = [...reasons];
    state.suspended = true;
    renderer?.suspend?.(reason);
    publish();
    return true;
  }

  function resume(reason = null) {
    if (destroyed) return false;
    if (reason == null) {
      if (state.suspendReasons.length === 0) return false;
      state.suspendReasons = [];
    } else {
      const normalizedReason = String(reason);
      if (!state.suspendReasons.includes(normalizedReason)) return false;
      state.suspendReasons = state.suspendReasons.filter((value) => value !== normalizedReason);
    }
    state.suspended = state.suspendReasons.length > 0;
    if (!state.suspended) renderer?.resume?.();
    publish();
    return true;
  }

  function onContextLost(event) {
    event?.preventDefault?.();
    renderer?.suspend?.("context-lost");
    state.contextLosses += 1;
    state.phase = "lost";
    state.renderer = "fallback";
    state.space = "static";
    if (state.contextLosses >= 2) {
      state.quality = "static";
      renderer?.destroy?.();
      renderer = null;
    }
    setPoster();
    publish();
  }

  function onContextRestored() {
    if (destroyed || restorationAttempts >= 1 || state.quality === "static") return;
    restorationAttempts += 1;
    generation += 1;
    state.renderer = "pending";
    state.phase = "loading";
    publish();
    void buildRenderer(generation).catch(() => fallback());
  }

  function onVisibilityChange() {
    if (documentRef.hidden) suspend("document-hidden");
    else resume("document-hidden");
  }

  function onOrbitChange(event) {
    const detail = event?.detail || {};
    if (detail.source === "planet-center") {
      if (state.orbitBodyId !== state.worldId || state.selectedBodyId !== state.worldId) return;
      applyRendererCenterDestination(detail.activeScene, {
        availableDestinations: detail.availableScenes
      });
      return;
    }
    const requestedDestination = normalizePlanetHubDestination(detail.activeScene);
    const passiveSameDestinationRefresh = state.mode === "overview"
      && requestedDestination === state.activeDestination
      && (state.orbitBodyId !== state.worldId || state.selectedBodyId !== state.worldId)
      && ["availability", "sync", "layout"].includes(String(detail.source || ""));
    if (passiveSameDestinationRefresh) {
      // Responsive Home layout changes can make the HTML controller republish
      // its unchanged active scene while it refreshes availability. That event
      // is metadata, not a destination command: a centered celestial body owns
      // the camera until the player explicitly chooses another destination or
      // exits body focus. Treating the refresh like a rail click used to call
      // setOrbitBody(worldId), which reset Moon focus during viewport resize.
      sync({
        activeDestination: detail.activeScene,
        availableDestinations: detail.availableScenes,
        worldId: state.worldId,
        journeyAction: state.journeyAction,
        revealState: state.revealState
      });
      return;
    }
    if (journeyActivationPromise && requestedDestination !== state.activeDestination) {
      cancelJourneyActivation("destination-control");
    }
    placesController?.reset?.({ selectedId: state.worldId });
    if (state.orbitBodyId !== state.worldId) {
      focusOrbitBody(state.worldId, {
        source: "destination-control",
        animate: !reducedMotion
      });
    }
    // Rail and keyboard navigation always return to the orbit overview.
    // A landmark click dispatches this event synchronously, then commit() enters
    // focused mode after the authoritative controller accepts the selection.
    if (state.mode === "focused") exitFocusedMode({ source: "destination-control" });
    sync({
      activeDestination: detail.activeScene,
      availableDestinations: detail.availableScenes,
      worldId: state.worldId,
      journeyAction: state.journeyAction,
      revealState: state.revealState
    });
  }

  function listen(target, type, listener, options) {
    target?.addEventListener?.(type, listener, options);
    listeners.push([target, type, listener, options]);
  }

  listen(canvas, "webglcontextlost", onContextLost, false);
  listen(canvas, "webglcontextrestored", onContextRestored, false);
  listen(documentRef, "visibilitychange", onVisibilityChange, false);
  listen(documentRef, "toggle", syncSemanticZoomRail, true);
  listen(documentRef, "close", syncSemanticZoomRail, true);
  listen(documentRef, "cancel", syncSemanticZoomRail, true);
  listen(orbitRoot, "homeorbitchange", onOrbitChange, false);
  listen(orbitReturn, "click", () => {
    const fallbackContract = resolvePlanetHubOrbitReturnContract(state);
    const contract = placesController?.getBackContract?.(fallbackContract) || fallbackContract;
    if (contract.action === "place-history") {
      void placesController?.back?.({ source: "orbit-return", restoreFocus: true });
    } else if (contract.action === "exit-focus") {
      exitFocusedMode({ source: "orbit-return", restoreFocus: true });
    } else if (contract.action === "solar-system") {
      focusOrbitBody(state.worldId, { source: "orbit-return", restoreFocus: true });
    } else if (contract.action === "reset-view") {
      selectOrbitBody(state.worldId, { source: "orbit-return" });
    }
  }, false);
  for (const [index, control] of zoomStops.entries()) {
    listen(control, "click", () => selectSemanticZoom(index), false);
    listen(control, "keydown", (event) => {
      const next = resolvePlanetHubSemanticZoomKey(event.key, index);
      if (next == null) return;
      event.preventDefault?.();
      event.stopPropagation?.();
      selectSemanticZoom(next, { source: "zoom-rail-keyboard", focus: true });
    }, false);
  }
  listen(zoomReset, "click", () => {
    if (state.selectedBodyId !== state.orbitBodyId) {
      selectOrbitBody(state.orbitBodyId, { source: "zoom-reset" });
    }
    selectSemanticZoom(0, { source: "zoom-reset", focus: false });
  }, false);
  listen(inspectionReturn, "click", () => focusOrbitBody(state.worldId, {
    source: "inspection-return",
    restoreFocus: true
  }), false);
  listen(inspectionSelect, "click", () => selectHomeWorld("moon", { source: "moon-inspection" }), false);
  listen(worldSwitch, "click", () => {
    const targetWorld = worldSwitch?.dataset?.planetHubWorldTarget;
    selectHomeWorld(targetWorld, { source: "world-switch" });
  }, false);
  listen(root, "click", (event) => {
    if (state.mode !== "overview") return;
    const label = event.target?.closest?.("[data-planet-hub-body-label]");
    const body = String(label?.dataset?.body || "").trim().toLowerCase();
    if (!body || label?.dataset?.visible === "false") return;
    event.preventDefault?.();
    event.stopPropagation?.();
    if (state.selectedBodyId === body) {
      focusOrbitBody(body, { source: "body-label-click", restoreFocus: false });
    } else {
      selectOrbitBody(body, { source: "body-label-click" });
    }
  }, false);
  listen(root, "keydown", (event) => {
    if (!['Enter', ' '].includes(event.key) || event.repeat || state.mode !== "overview") return;
    const label = event.target?.closest?.("[data-planet-hub-body-label]");
    const body = String(label?.dataset?.body || "").trim().toLowerCase();
    if (!body) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    if (state.selectedBodyId === body) {
      focusOrbitBody(body, { source: "body-keyboard", restoreFocus: false });
    } else {
      selectOrbitBody(body, { source: "body-keyboard" });
    }
  }, false);
  listen(documentRef, "keydown", (event) => {
    if (event.key !== "Escape"
      || event.defaultPrevented
      || documentRef?.querySelector?.("dialog[open], [role='dialog'][aria-modal='true']:not([hidden])")) return;
    if (placesController?.handleEscape?.()) {
      event.preventDefault?.();
      event.stopPropagation?.();
      return;
    }
    const action = state.mode === "focused"
      ? () => exitFocusedMode({ source: "escape", restoreFocus: true })
      : state.orbitBodyId !== state.worldId
        ? () => focusOrbitBody(state.worldId, { source: "escape", restoreFocus: true })
        : state.selectedBodyId !== state.worldId
          ? () => selectOrbitBody(state.worldId, { source: "escape" })
          : null;
    if (!action) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    action();
  }, true);

  const journeyControls = resolveJourneyControls().controls;
  const hoveredJourneyControls = new Set();
  const focusedJourneyControls = new Set();
  const syncJourneyControlIgnition = () => renderer?.setRocketIgnition?.(
    hoveredJourneyControls.size || focusedJourneyControls.size ? 0.42 : 0,
    0
  );
  const pressRocket = () => renderer?.setRocketIgnition?.(1, 620);
  const gateJourneyActivation = (event) => {
    if (journeyActivationBypass || destroyed) return;
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    const trigger = event?.currentTarget || event?.target || null;
    void stageJourneyActivation({ trigger }).then((proceed) => {
      if (!proceed || destroyed || !trigger?.click) return;
      delegateJourneyClick(trigger);
    });
  };
  for (const journeyControl of journeyControls) {
    listen(journeyControl, "pointerenter", () => {
      hoveredJourneyControls.add(journeyControl);
      syncJourneyControlIgnition();
    }, false);
    listen(journeyControl, "pointerleave", () => {
      hoveredJourneyControls.delete(journeyControl);
      syncJourneyControlIgnition();
    }, false);
    listen(journeyControl, "focus", () => {
      focusedJourneyControls.add(journeyControl);
      syncJourneyControlIgnition();
    }, false);
    listen(journeyControl, "blur", () => {
      focusedJourneyControls.delete(journeyControl);
      syncJourneyControlIgnition();
    }, false);
    listen(journeyControl, "pointerdown", pressRocket, false);
    listen(journeyControl, "click", pressRocket, false);
    // Capture precedes app.js and keyboard-generated click handlers, so every
    // semantic Journey activation follows the same spatial guard as a 3D
    // rocket pick. The delegated post-flight click is explicitly bypassed.
    listen(journeyControl, "click", gateJourneyActivation, true);
  }

  function destroy() {
    if (destroyed) return;
    interruptJourneyReturn("destroyed");
    destroyed = true;
    generation += 1;
    journeyReturnGeneration += 1;
    clearJourneySemanticTimeline();
    interaction.destroy();
    for (const [target, type, listener, options] of listeners) target?.removeEventListener?.(type, listener, options);
    listeners.length = 0;
    renderer?.destroy?.();
    renderer = null;
    placesController?.destroy?.();
    placesController = null;
    placesPromise = null;
    if (zoomRail) {
      zoomRail.hidden = true;
      zoomRail.toggleAttribute?.("inert", true);
      zoomRail.setAttribute?.("aria-hidden", "true");
    }
    canvas.remove?.();
  }

  publish();
  if (orbitController?.snapshot) {
    const orbit = orbitController.snapshot();
    sync({ activeDestination: orbit.activeScene, availableDestinations: orbit.availableScenes });
  }

  return Object.freeze({
    prepare,
    sync,
    focus,
    exitFocusedMode,
    playRocketIgnition,
    stageJourneyActivation,
    playJourneyReturn,
    restoreJourneyAfterHandoff,
    setEffectsLevel,
    setReducedMotion,
    selectPlace: (...args) => ensurePlacesController().then((controller) => controller?.selectPlace?.(...args) || false),
    visitPlace: (...args) => ensurePlacesController().then((controller) => controller?.visitPlace?.(...args) || false),
    backPlace: (...args) => ensurePlacesController().then((controller) => controller?.back?.(...args) || false),
    getPlaces: () => placesController?.snapshot?.() || null,
    reconcilePointer: (meta) => interaction?.reconcilePointer?.(meta) || false,
    suspend,
    resume,
    destroy,
    snapshot: () => frozenSnapshot(state),
    canvas,
    poster
  });
}
