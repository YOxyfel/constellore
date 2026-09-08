import {
  classifyWordBloomDirection,
  previewWordBloomSwipe,
  wordBloomOrbitLayout
} from "./word-orbit.mjs?v=5.0.0-beta.4";
import {
  bloomBoardTapAllowed,
  bloomPointFromPointer,
  syncBloomCategoryHighlight
} from "./word-bloom-view.mjs?v=5.0.0-beta.4";

export function createBloomFocusController({ bloom, viewWindow, isDestroyed, getCategoryButton } = {}) {
  let pending = null;

  function request(target) {
    pending = target || null;
    if (!pending) return;
    viewWindow.requestAnimationFrame?.(() => {
      if (isDestroyed() || bloom.root.hidden || !pending) return;
      let candidate = null;
      if (typeof pending?.focus === "function") candidate = pending;
      else if (pending === "search") candidate = bloom.search;
      else if (pending === "first-word") candidate = bloom.words.querySelector(".constellation-bloom__word:not(:disabled)");
      else if (pending === "category") candidate = getCategoryButton() || bloom.categories.querySelector(".constellation-bloom__category:not(:disabled)");
      else candidate = bloom.trigger;
      if (candidate && !candidate.hidden && !candidate.disabled) {
        pending = null;
        candidate.focus({ preventScroll: true });
      }
    });
  }

  return Object.freeze({ request, reset: () => { pending = null; } });
}

export function createBloomRelocator({
  bloom,
  snapshot,
  busy,
  isDestroyed,
  getStage,
  getVisualStage,
  getOpeningStage = () => "categories",
  setActiveStage,
  setOrigin,
  transitions,
  render,
  announce,
  activity
} = {}) {
  return function relocateBloom(origin, { pointerType = "pointer" } = {}) {
    const view = snapshot();
    if (isDestroyed() || bloom.root.hidden || busy(view) || !origin) return Promise.resolve(null);
    const from = getVisualStage();
    const nextStage = getStage() === "closed" ? getOpeningStage() : getStage();
    setActiveStage(nextStage);
    const handoff = transitions.begin(from, nextStage, {
      kind: "bloom-relocate",
      duration: 160,
      force: true,
      swap: () => setOrigin({ x: origin.x, y: origin.y })
    });
    render();
    announce(from === "closed"
      ? "Word constellation opened here. Choose a direction."
      : "Word constellation moved here.");
    activity("open", { mode: pointerType === "touch" ? "touch-board" : "board", relocated: true });
    return handoff;
  };
}

export function bindBloomBoardTapInput({
  bloom,
  board,
  viewWindow,
  listen,
  snapshot,
  busy,
  isDestroyed,
  dismiss,
  relocate
} = {}) {
  let active = null;
  let pendingTap = null;
  let pendingTapTimer = 0;
  const doubleActivationMs = 500;

  function clearPendingTapTimer() {
    if (!pendingTapTimer) return;
    viewWindow.clearTimeout?.(pendingTapTimer);
    pendingTapTimer = 0;
  }

  function commitPendingTap() {
    const pending = pendingTap;
    pendingTap = null;
    clearPendingTapTimer();
    if (pending) dismiss?.({ pointerType: pending.pointerType });
  }

  function activationMatches(left, right) {
    if (!left || !right || left.pointerType !== right.pointerType) return false;
    const radius = right.pointerType === "touch" || right.pointerType === "pen" ? 48 : 32;
    const elapsed = right.at - left.at;
    const dx = right.x - left.x;
    const dy = right.y - left.y;
    return elapsed >= 0 && elapsed <= doubleActivationMs && dx * dx + dy * dy <= radius * radius;
  }

  function reset() {
    active = null;
    pendingTap = null;
    clearPendingTapTimer();
  }

  function begin(event) {
    const view = snapshot();
    if (event.defaultPrevented || Number(event.button ?? 0) !== 0 || event.isPrimary === false) return;
    if (isDestroyed() || bloom.root.hidden || busy(view) || !bloomBoardTapAllowed(event.target, board)) return;
    active = {
      pointerId: event.pointerId,
      pointerType: event.pointerType || "pointer",
      x: event.clientX,
      y: event.clientY,
      moved: false
    };
    const candidate = {
      pointerType: active.pointerType,
      x: active.x,
      y: active.y,
      at: Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now()
    };
    if (activationMatches(pendingTap, candidate)) clearPendingTapTimer();
    event.stopImmediatePropagation?.();
  }

  function move(event) {
    if (!active || (event.pointerId != null && event.pointerId !== active.pointerId)) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (dx * dx + dy * dy > 144) active.moved = true;
  }

  function end(event, cancelled = false) {
    if (!active || (event.pointerId != null && event.pointerId !== active.pointerId)) return;
    const finished = active;
    active = null;
    if (cancelled || finished.moved || event.defaultPrevented || !bloomBoardTapAllowed(event.target, board)) {
      if (pendingTap && !pendingTapTimer) commitPendingTap();
      return;
    }
    const origin = bloomPointFromPointer(event, board?.getBoundingClientRect?.());
    if (!origin) return;
    const completed = {
      pointerType: finished.pointerType,
      x: event.clientX,
      y: event.clientY,
      at: Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now(),
      origin
    };
    if (activationMatches(pendingTap, completed)) {
      pendingTap = null;
      clearPendingTapTimer();
      event.preventDefault?.();
      void relocate(completed.origin, { pointerType: completed.pointerType });
      return;
    }
    if (pendingTap) commitPendingTap();
    pendingTap = completed;
    pendingTapTimer = viewWindow.setTimeout?.(commitPendingTap, doubleActivationMs) || 0;
  }

  listen(board, "pointerdown", begin);
  listen(viewWindow, "pointermove", move, { passive: true });
  listen(viewWindow, "pointerup", (event) => end(event));
  listen(viewWindow, "pointercancel", (event) => end(event, true));
  listen(viewWindow, "blur", reset);
  listen(board, "dblclick", (event) => {
    if (bloomBoardTapAllowed(event.target, board)) event.preventDefault();
  });

  return Object.freeze({ reset });
}

export function bindBloomOrbInput({
  bloom,
  board,
  listen,
  snapshot,
  busy,
  getStage,
  setStage,
  chooseCategory,
  returnToParent,
  getCategoryButtons,
  getCategoryLayout,
  getCategoryEntries,
  getCurrentWindowItems,
  getFocusIndex,
  syncWordFocus,
  activity,
  render,
  navigatorRef = globalThis.navigator
} = {}) {
  let active = null;
  let suppressClickUntil = 0;

  function reset() {
    active = null;
    suppressClickUntil = 0;
  }

  function pulse() {
    if (navigatorRef?.vibrate) navigatorRef.vibrate(7);
  }

  function highlight(event) {
    if (!active) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    const categoryButtons = getCategoryButtons();
    if (active.kind === "categories") {
      const next = classifyWordBloomDirection(dx, dy, { deadZone: 28 });
      if (next !== active.highlight) {
        active.highlight = next;
        if (next) pulse();
        syncBloomCategoryHighlight(categoryButtons, next);
      }
      return;
    }
    if (active.kind === "browse") {
      const preview = previewWordBloomSwipe(dx, dy, {
        layout: getCategoryLayout(),
        focusIndex: -1,
        deadZone: 26
      });
      if (!preview.moved) return;
      active.moved = true;
      const next = getCategoryEntries()[preview.focusIndex]?.id || null;
      if (next !== active.highlight) {
        active.highlight = next;
        if (next) pulse();
        syncBloomCategoryHighlight(categoryButtons, next);
      }
      return;
    }
    const layout = wordBloomOrbitLayout({
      count: getCurrentWindowItems().length,
      width: board?.clientWidth,
      height: board?.clientHeight,
      compact: snapshot().layout === "short-landscape"
    });
    const preview = previewWordBloomSwipe(dx, dy, {
      layout,
      focusIndex: getFocusIndex(),
      deadZone: 26
    });
    if (!preview.moved) return;
    active.moved = true;
    if (preview.changed) {
      syncWordFocus(preview.focusIndex);
      pulse();
    }
  }

  function end(event, cancelled = false) {
    if (!active || (event.pointerId != null && event.pointerId !== active.pointerId)) return;
    const finished = active;
    active = null;
    suppressClickUntil = Date.now() + 450;
    try { bloom.trigger.releasePointerCapture?.(finished.pointerId); } catch {}
    if (cancelled) return void setStage(finished.from === "closed" ? "closed" : finished.from);
    const categoryButtons = getCategoryButtons();
    if (finished.kind === "categories" && finished.highlight) return void chooseCategory(finished.highlight, categoryButtons.get(finished.highlight));
    if (finished.kind === "categories" && finished.from === "categories") return void setStage("closed", { announce: "Word constellation closed." });
    if (finished.kind === "browse" && finished.highlight) return void chooseCategory(finished.highlight, categoryButtons.get(finished.highlight));
    if (finished.kind === "browse" && finished.from === "browse" && !finished.moved) return void setStage("closed", { announce: "Word picker closed." });
    if (["words", "browse"].includes(finished.kind) && !finished.moved) return void setStage("closed", { announce: "Word picker closed." });
    render();
  }

  listen(bloom.trigger, "pointerdown", (event) => {
    if (event.button !== 0 || busy(snapshot())) return;
    const from = getStage();
    if (from === "closed") setStage("categories", { announce: "Swipe toward a category, or tap a category." });
    active = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      from,
      kind: ["closed", "categories"].includes(from) ? "categories" : from === "browse" ? "browse" : "words",
      highlight: null,
      moved: false
    };
    bloom.trigger.setPointerCapture?.(event.pointerId);
    activity("open", { mode: event.pointerType === "touch" ? "touch" : "pointer" });
  });
  listen(bloom.trigger, "pointermove", highlight);
  listen(bloom.trigger, "pointerup", (event) => end(event));
  listen(bloom.trigger, "pointercancel", (event) => end(event, true));
  listen(bloom.trigger, "lostpointercapture", (event) => {
    if (active?.pointerId === event.pointerId) end(event, true);
  });
  listen(bloom.trigger, "contextmenu", (event) => event.preventDefault());
  listen(bloom.trigger, "click", (event) => {
    if (Date.now() < suppressClickUntil) return event.preventDefault();
    const stage = getStage();
    if (stage === "closed") setStage("categories", { announce: "Choose a word.", focus: "first-word" });
    else if (stage === "categories") setStage("closed", { announce: "Word constellation closed." });
    else setStage("closed", { announce: "Word picker closed." });
  });

  return Object.freeze({
    reset,
    get highlight() {
      return active?.highlight || null;
    }
  });
}
