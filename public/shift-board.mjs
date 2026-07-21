const finitePoint = (value) => {
  const x = Number(value?.x);
  const y = Number(value?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

const finiteSize = (value) => {
  const width = Number(value?.width);
  const height = Number(value?.height);
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0 ? { width, height } : null;
};

const stableCoordinate = (value) => Math.round(value * 1_000_000) / 1_000_000;

/**
 * Returns trail points whose chip rectangles are separated on at least one
 * axis. The final anchor is the next position to stamp after more travel.
 */
export function spacedTrailPoints(anchor, current, size, { gap = 52, limit = 24 } = {}) {
  const start = finitePoint(anchor);
  const end = finitePoint(current);
  const measured = finiteSize(size);
  const safeGap = Number(gap);
  const safeLimit = Math.min(180, Math.max(0, Math.floor(Number(limit) || 0)));
  if (!start || !end || !measured || !Number.isFinite(safeGap) || safeGap < 0 || !safeLimit) {
    return { points: [], anchor: start || end };
  }

  const separationX = measured.width + safeGap;
  const separationY = measured.height + safeGap;
  const points = [];
  let cursor = { ...start };
  while (points.length < safeLimit) {
    const dx = end.x - cursor.x;
    const dy = end.y - cursor.y;
    const progress = Math.max(Math.abs(dx) / separationX, Math.abs(dy) / separationY);
    if (!Number.isFinite(progress) || progress < 1) break;
    points.push({ ...cursor });
    const fraction = 1 / progress;
    cursor = {
      x: stableCoordinate(cursor.x + dx * fraction),
      y: stableCoordinate(cursor.y + dy * fraction)
    };
  }
  return { points, anchor: cursor };
}

export function createShiftBoardController({
  getNode,
  removeNode,
  duplicateNode,
  onChange = () => {},
  maxCopies = 24,
  eraseDebounceDistance = 10,
  stampGap = 52
} = {}) {
  if (typeof getNode !== "function" || typeof removeNode !== "function" || typeof duplicateNode !== "function") {
    throw new TypeError("Shift board controls require node, remove, and duplicate callbacks.");
  }

  const copyLimit = Math.min(180, Math.max(1, Math.floor(Number(maxCopies) || 24)));
  const eraseGap = Math.max(0, Number(eraseDebounceDistance) || 0);
  let held = false;
  let dragging = false;
  let dragNodeId = null;
  let dragPoint = null;
  let dragSize = null;
  let stampAnchor = null;
  let stampPoints = [];
  let copies = 0;
  let lastErasePoint = null;
  let eraseNeedsPointerSync = false;
  let eraseSuppressedUntilRelease = false;

  const snapshot = () => ({ held, dragging, dragNodeId, copies });
  const emit = () => onChange(snapshot());

  const setHeld = (value) => {
    const next = Boolean(value);
    if (next === held) return false;
    held = next;
    lastErasePoint = null;
    eraseNeedsPointerSync = false;
    if (!held) eraseSuppressedUntilRelease = false;
    stampAnchor = held && dragging && dragPoint ? { ...dragPoint } : null;
    emit();
    return true;
  };

  const enter = (id, { buttons = 0, point = null } = {}) => {
    if (!held || dragging || eraseSuppressedUntilRelease || eraseNeedsPointerSync || Number(buttons) !== 0) return { type: "ignored" };
    const node = getNode(id);
    if (!node) return { type: "ignored" };
    const erasePoint = finitePoint(point);
    if (erasePoint && lastErasePoint && Math.hypot(erasePoint.x - lastErasePoint.x, erasePoint.y - lastErasePoint.y) < eraseGap) {
      return { type: "ignored", reason: "stationary" };
    }
    const previousPoint = lastErasePoint;
    lastErasePoint = erasePoint;
    if (removeNode(node) === false) {
      lastErasePoint = previousPoint;
      return { type: "ignored" };
    }
    eraseNeedsPointerSync = !erasePoint;
    emit();
    return { type: "removed", node };
  };

  const pointerMove = (point) => {
    const current = finitePoint(point);
    if (!held || dragging || !eraseNeedsPointerSync || !current) return false;
    lastErasePoint = current;
    eraseNeedsPointerSync = false;
    return true;
  };

  const beginDrag = (id, point, size) => {
    const node = getNode(id);
    const start = finitePoint(point);
    const measured = finiteSize(size);
    if (!node || !start || !measured) return false;
    dragging = true;
    dragNodeId = node.id;
    dragPoint = start;
    dragSize = measured;
    stampAnchor = held ? { ...start } : null;
    stampPoints = [];
    copies = 0;
    eraseSuppressedUntilRelease = held;
    emit();
    return true;
  };

  const moveDrag = (point) => {
    if (!dragging || !getNode(dragNodeId)) return { type: "ignored", points: [] };
    const current = finitePoint(point);
    if (!current) return { type: "ignored", points: [] };
    dragPoint = current;
    if (!held || copies >= copyLimit) {
      stampAnchor = null;
      return { type: "moved", points: [] };
    }
    if (!stampAnchor) {
      stampAnchor = { ...current };
      return { type: "armed", points: [] };
    }

    const plan = spacedTrailPoints(stampAnchor, current, dragSize, {
      gap: stampGap,
      limit: 180
    });
    stampAnchor = plan.anchor;
    const placed = [];
    const node = getNode(dragNodeId);
    for (const placement of plan.points) {
      if (copies >= copyLimit) break;
      const overlapsTrail = stampPoints.some((prior) => (
        Math.abs(placement.x - prior.x) < dragSize.width + stampGap
        && Math.abs(placement.y - prior.y) < dragSize.height + stampGap
      ));
      if (overlapsTrail) continue;
      if (!node || duplicateNode(node, placement, { copyNumber: copies + 1, size: dragSize }) === false) break;
      copies += 1;
      stampPoints.push({ ...placement });
      placed.push(placement);
    }
    if (placed.length) emit();
    return { type: placed.length ? "stamped" : "moved", points: placed };
  };

  const endDrag = () => {
    if (!dragging) return false;
    dragging = false;
    dragNodeId = null;
    dragPoint = null;
    dragSize = null;
    stampAnchor = null;
    stampPoints = [];
    copies = 0;
    eraseSuppressedUntilRelease = held;
    emit();
    return true;
  };

  const reset = () => {
    held = false;
    dragging = false;
    dragNodeId = null;
    dragPoint = null;
    dragSize = null;
    stampAnchor = null;
    stampPoints = [];
    copies = 0;
    lastErasePoint = null;
    eraseNeedsPointerSync = false;
    eraseSuppressedUntilRelease = false;
    emit();
  };

  return { setHeld, enter, pointerMove, beginDrag, moveDrag, endDrag, reset, snapshot };
}
