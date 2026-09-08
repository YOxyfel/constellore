const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const BOARD_CAMERA_MIN_ZOOM = 0.35;
export const BOARD_CAMERA_MAX_ZOOM = 2.5;

export function clampBoardZoom(value, minimum = BOARD_CAMERA_MIN_ZOOM, maximum = BOARD_CAMERA_MAX_ZOOM) {
  const min = Math.max(0.05, finite(minimum, BOARD_CAMERA_MIN_ZOOM));
  const max = Math.max(min, finite(maximum, BOARD_CAMERA_MAX_ZOOM));
  return Math.min(max, Math.max(min, finite(value, 1)));
}

export function boardWorldToScreen(point, camera = {}) {
  const zoom = clampBoardZoom(camera.zoom);
  return {
    x: finite(point?.x) * zoom + finite(camera.x),
    y: finite(point?.y) * zoom + finite(camera.y)
  };
}

export function screenToBoardWorld(point, camera = {}) {
  const zoom = clampBoardZoom(camera.zoom);
  return {
    x: (finite(point?.x) - finite(camera.x)) / zoom,
    y: (finite(point?.y) - finite(camera.y)) / zoom
  };
}

export function zoomBoardCameraAt(camera = {}, nextZoom, anchor = {}) {
  const current = {
    x: finite(camera.x),
    y: finite(camera.y),
    zoom: clampBoardZoom(camera.zoom)
  };
  const zoom = clampBoardZoom(nextZoom);
  const point = { x: finite(anchor.x), y: finite(anchor.y) };
  const world = screenToBoardWorld(point, current);
  return {
    x: point.x - world.x * zoom,
    y: point.y - world.y * zoom,
    zoom
  };
}

const CAMERA_COORDINATE_LIMIT = 1_000_000;
const DOUBLE_ACTIVATION_MS = 500;
const PROTECTED_SELECTOR = [
  ".board-word",
  ".constellation-bloom",
  ".board-top-hud",
  ".board-bottom-hud",
  ".board-guide",
  ".help-nudge",
  ".first-orbit-guide",
  ".rival-ghost",
  ".ghost-preview",
  ".tap-chain-status",
  ".board-undo",
  ".reveal-controller",
  ".recipe-feedback",
  ".expected-pair-feedback",
  ".mobile-assist-surface",
  ".board-assistance-rail",
  ".board-camera-controls",
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  "[contenteditable='true']",
  "[data-no-board-camera]"
].join(",");
const WHEEL_PROTECTED_SELECTOR = [
  ".constellation-bloom",
  ".board-top-hud",
  ".board-bottom-hud",
  ".board-guide",
  ".help-nudge",
  ".first-orbit-guide",
  ".rival-ghost",
  ".ghost-preview",
  ".tap-chain-status",
  ".board-undo",
  ".reveal-controller",
  ".recipe-feedback",
  ".expected-pair-feedback",
  ".mobile-assist-surface",
  ".board-assistance-rail",
  ".board-camera-controls",
  ".board-quick-tools",
  ".run-milestone",
  ".alchemy-note",
  "button:not(.board-word)",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  "[contenteditable='true']",
  "[data-no-board-camera]"
].join(",");

function cameraPoint(point) {
  return {
    x: Math.min(CAMERA_COORDINATE_LIMIT, Math.max(-CAMERA_COORDINATE_LIMIT, finite(point?.x))),
    y: Math.min(CAMERA_COORDINATE_LIMIT, Math.max(-CAMERA_COORDINATE_LIMIT, finite(point?.y))),
    zoom: clampBoardZoom(point?.zoom)
  };
}

function activationMatches(left, right) {
  if (!left || !right || left.pointerType !== right.pointerType) return false;
  const radius = right.pointerType === "touch" || right.pointerType === "pen" ? 48 : 32;
  const elapsed = right.at - left.at;
  return elapsed >= 0 && elapsed <= DOUBLE_ACTIVATION_MS
    && (right.x - left.x) ** 2 + (right.y - left.y) ** 2 <= radius ** 2;
}

function pointerCentroid(entries) {
  const points = [...entries];
  const count = Math.max(1, points.length);
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / count,
    y: points.reduce((sum, point) => sum + point.y, 0) / count
  };
}

function pointerDistance(entries) {
  const points = [...entries];
  return points.length < 2 ? 0 : Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
}

function normalizedWheelDelta(event, viewport) {
  const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? Math.max(320, viewport?.clientHeight || 720) : 1;
  return Math.max(-900, Math.min(900, finite(event.deltaY) * unit));
}

export function createBoardCameraRuntime({
  viewport,
  world,
  zoomOutButton,
  zoomInButton,
  resetButton,
  zoomValue,
  status,
  viewWindow = globalThis,
  enabled = () => true,
  onSingleActivation,
  onDoubleActivation,
  onChange
} = {}) {
  if (!viewport || !world) throw new TypeError("createBoardCameraRuntime requires viewport and world elements.");
  const listeners = [];
  const pointers = new Map();
  let camera = { x: 0, y: 0, zoom: 1 };
  let gesture = null;
  let pinch = null;
  let pendingActivation = null;
  let pendingTimer = 0;
  let destroyed = false;

  const listen = (target, type, handler, options) => {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };

  function snapshot() {
    return { ...camera };
  }

  function localPoint(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    return { x: finite(clientX) - rect.left, y: finite(clientY) - rect.top };
  }

  function updateSurface({ reason = "camera", announce = false } = {}) {
    if (destroyed) return;
    const x = Math.abs(camera.x) < 0.0001 ? 0 : camera.x;
    const y = Math.abs(camera.y) < 0.0001 ? 0 : camera.y;
    camera = cameraPoint({ ...camera, x, y });
    world.style.setProperty("--board-camera-x", `${camera.x}px`);
    world.style.setProperty("--board-camera-y", `${camera.y}px`);
    world.style.setProperty("--board-camera-zoom", String(camera.zoom));
    viewport.dataset.cameraX = camera.x.toFixed(3);
    viewport.dataset.cameraY = camera.y.toFixed(3);
    viewport.dataset.cameraZoom = camera.zoom.toFixed(4);
    viewport.dataset.cameraDragging = String(Boolean(gesture?.moved || pinch));
    if (zoomValue) zoomValue.textContent = `${Math.round(camera.zoom * 100)}%`;
    if (resetButton) resetButton.disabled = camera.x === 0 && camera.y === 0 && camera.zoom === 1;
    if (zoomOutButton) zoomOutButton.disabled = camera.zoom <= BOARD_CAMERA_MIN_ZOOM + 0.001;
    if (zoomInButton) zoomInButton.disabled = camera.zoom >= BOARD_CAMERA_MAX_ZOOM - 0.001;
    if (announce && status) status.textContent = `Board view ${Math.round(camera.zoom * 100)} percent.`;
    onChange?.(snapshot(), { reason });
  }

  function setCamera(next, options = {}) {
    camera = cameraPoint({ ...camera, ...next });
    updateSurface(options);
    return snapshot();
  }

  function worldToScreenLocal(point) {
    return boardWorldToScreen(point, camera);
  }

  function screenLocalToWorld(point) {
    return screenToBoardWorld(point, camera);
  }

  function clientToWorld(point) {
    return screenLocalToWorld(localPoint(point?.x ?? point?.clientX, point?.y ?? point?.clientY));
  }

  function zoomAt(nextZoom, anchor = null, options = {}) {
    const rect = viewport.getBoundingClientRect();
    const localAnchor = anchor
      ? ("clientX" in anchor || "clientY" in anchor)
        ? localPoint(anchor.clientX, anchor.clientY)
        : { x: finite(anchor.x), y: finite(anchor.y) }
      : { x: rect.width / 2, y: rect.height / 2 };
    camera = cameraPoint(zoomBoardCameraAt(camera, nextZoom, localAnchor));
    updateSurface(options);
    return snapshot();
  }

  function reset({ announce = false, reason = "reset" } = {}) {
    pointers.clear();
    gesture = null;
    pinch = null;
    pendingActivation = null;
    clearPendingTimer();
    camera = { x: 0, y: 0, zoom: 1 };
    updateSurface({ reason, announce });
  }

  function clearPendingTimer() {
    if (!pendingTimer) return;
    viewWindow.clearTimeout?.(pendingTimer);
    pendingTimer = 0;
  }

  function commitPendingActivation() {
    const pending = pendingActivation;
    pendingActivation = null;
    clearPendingTimer();
    if (pending) onSingleActivation?.({ ...pending, origin: { ...pending.origin } });
  }

  function blockedTarget(target) {
    return Boolean(target?.closest?.(PROTECTED_SELECTOR));
  }

  function startPinch() {
    const touchPoints = [...pointers.values()].filter((point) => point.pointerType === "touch").slice(0, 2);
    if (touchPoints.length < 2) return;
    clearPendingTimer();
    pendingActivation = null;
    const centroid = pointerCentroid(touchPoints);
    pinch = {
      pointerIds: touchPoints.map((point) => point.pointerId),
      camera: snapshot(),
      centroid,
      world: screenToBoardWorld(centroid, camera),
      distance: Math.max(1, pointerDistance(touchPoints))
    };
    gesture = null;
    updateSurface({ reason: "pinch-start" });
  }

  function begin(event) {
    if (destroyed) return;
    if (blockedTarget(event.target)) {
      pendingActivation = null;
      clearPendingTimer();
      return;
    }
    if (event.defaultPrevented || !enabled()) return;
    const pointerType = event.pointerType || "mouse";
    if (pointerType === "mouse" && ![0, 1].includes(Number(event.button))) return;
    if (pointerType !== "mouse" && event.isPrimary === false && pointerType !== "touch") return;
    const point = localPoint(event.clientX, event.clientY);
    const pointer = { pointerId: event.pointerId, pointerType, ...point };
    const candidate = {
      pointerType,
      x: finite(event.clientX),
      y: finite(event.clientY),
      at: Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now()
    };
    if (!(pointerType === "mouse" && Number(event.button) === 1) && activationMatches(pendingActivation, candidate)) clearPendingTimer();
    pointers.set(event.pointerId, pointer);
    if (pointerType === "touch" && [...pointers.values()].filter((entry) => entry.pointerType === "touch").length >= 2) {
      startPinch();
    } else {
      gesture = {
        pointerId: event.pointerId,
        pointerType,
        button: Number(event.button),
        start: point,
        camera: snapshot(),
        moved: false,
        suppressActivation: pointerType === "mouse" && Number(event.button) === 1
      };
    }
    if (pointerType === "mouse" && Number(event.button) === 1) event.preventDefault?.();
    try { viewport.setPointerCapture?.(event.pointerId); } catch {}
  }

  function move(event) {
    if (!pointers.has(event.pointerId)) return;
    const point = localPoint(event.clientX, event.clientY);
    pointers.set(event.pointerId, { ...pointers.get(event.pointerId), ...point });
    if (pinch) {
      const touchPoints = pinch.pointerIds.map((id) => pointers.get(id)).filter(Boolean);
      if (touchPoints.length < 2) return;
      const centroid = pointerCentroid(touchPoints);
      const ratio = pointerDistance(touchPoints) / pinch.distance;
      const zoom = clampBoardZoom(pinch.camera.zoom * ratio);
      camera = cameraPoint({
        x: centroid.x - pinch.world.x * zoom,
        y: centroid.y - pinch.world.y * zoom,
        zoom
      });
      event.preventDefault?.();
      updateSurface({ reason: "pinch" });
      return;
    }
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = point.x - gesture.start.x;
    const dy = point.y - gesture.start.y;
    const threshold = gesture.pointerType === "touch" ? 10 : gesture.pointerType === "pen" ? 8 : 6;
    if (!gesture.moved && Math.hypot(dx, dy) < threshold) return;
    gesture.moved = true;
    camera = cameraPoint({
      x: gesture.camera.x + dx,
      y: gesture.camera.y + dy,
      zoom: gesture.camera.zoom
    });
    event.preventDefault?.();
    updateSurface({ reason: "pan" });
  }

  function completeActivation(event, finished) {
    if (finished.suppressActivation) return;
    const point = localPoint(event.clientX, event.clientY);
    const completed = {
      pointerType: finished.pointerType,
      x: finite(event.clientX),
      y: finite(event.clientY),
      at: Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now(),
      origin: point
    };
    if (activationMatches(pendingActivation, completed)) {
      pendingActivation = null;
      clearPendingTimer();
      event.preventDefault?.();
      onDoubleActivation?.({ ...completed, origin: { ...point } });
      return;
    }
    if (pendingActivation) commitPendingActivation();
    pendingActivation = completed;
    pendingTimer = viewWindow.setTimeout?.(commitPendingActivation, DOUBLE_ACTIVATION_MS) || 0;
  }

  function end(event, cancelled = false) {
    if (!pointers.has(event.pointerId)) return;
    const wasPinching = Boolean(pinch?.pointerIds.includes(event.pointerId));
    pointers.delete(event.pointerId);
    if (wasPinching) {
      pinch = null;
      gesture = null;
      updateSurface({ reason: cancelled ? "pinch-cancel" : "pinch-end" });
      return;
    }
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const finished = gesture;
    gesture = null;
    updateSurface({ reason: cancelled ? "pan-cancel" : finished.moved ? "pan-end" : "activation" });
    if (!cancelled && !finished.moved && enabled() && !blockedTarget(event.target)) completeActivation(event, finished);
    else if (pendingActivation && !pendingTimer) commitPendingActivation();
  }

  function cancelGestures() {
    pointers.clear();
    gesture = null;
    pinch = null;
    pendingActivation = null;
    clearPendingTimer();
    updateSurface({ reason: "cancel" });
  }

  function wheel(event) {
    if (destroyed || !enabled() || event.target?.closest?.(WHEEL_PROTECTED_SELECTOR)) return;
    const delta = normalizedWheelDelta(event, viewport);
    if (!delta) return;
    event.preventDefault();
    const factor = Math.exp(-delta * 0.00135);
    zoomAt(camera.zoom * factor, { clientX: event.clientX, clientY: event.clientY }, { reason: "wheel" });
  }

  listen(viewport, "pointerdown", begin);
  listen(viewWindow, "pointermove", move, { passive: false });
  listen(viewWindow, "pointerup", (event) => end(event));
  listen(viewWindow, "pointercancel", (event) => end(event, true));
  listen(viewport, "lostpointercapture", (event) => end(event, true));
  listen(viewWindow, "blur", cancelGestures);
  listen(viewport, "wheel", wheel, { passive: false });
  listen(viewport, "dblclick", (event) => {
    if (!blockedTarget(event.target)) event.preventDefault();
  });
  listen(zoomOutButton, "click", () => { if (enabled()) zoomAt(camera.zoom / 1.2, null, { reason: "zoom-out", announce: true }); });
  listen(zoomInButton, "click", () => { if (enabled()) zoomAt(camera.zoom * 1.2, null, { reason: "zoom-in", announce: true }); });
  listen(resetButton, "click", () => { if (enabled()) reset({ reason: "reset-button", announce: true }); });

  updateSurface({ reason: "init" });

  return Object.freeze({
    snapshot,
    setCamera,
    reset,
    zoomAt,
    worldToScreenLocal,
    screenLocalToWorld,
    clientToWorld,
    cancelGestures,
    get zoom() { return camera.zoom; },
    destroy() {
      destroyed = true;
      clearPendingTimer();
      pointers.clear();
      listeners.splice(0).forEach((remove) => remove());
      world.style.removeProperty("--board-camera-x");
      world.style.removeProperty("--board-camera-y");
      world.style.removeProperty("--board-camera-zoom");
      delete viewport.dataset.cameraX;
      delete viewport.dataset.cameraY;
      delete viewport.dataset.cameraZoom;
      delete viewport.dataset.cameraDragging;
    }
  });
}
