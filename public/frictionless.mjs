function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function candidateRect(candidate) {
  const source = candidate?.rect || candidate;
  if (!source) return null;

  const rawLeft = finiteNumber(source.left ?? source.x);
  const rawTop = finiteNumber(source.top ?? source.y);
  const rawRight = finiteNumber(source.right);
  const rawBottom = finiteNumber(source.bottom);
  const width = finiteNumber(source.width);
  const height = finiteNumber(source.height);
  if (rawLeft == null || rawTop == null) return null;

  const derivedRight = rawRight ?? (width == null ? null : rawLeft + width);
  const derivedBottom = rawBottom ?? (height == null ? null : rawTop + height);
  if (derivedRight == null || derivedBottom == null) return null;

  return {
    left: Math.min(rawLeft, derivedRight),
    right: Math.max(rawLeft, derivedRight),
    top: Math.min(rawTop, derivedBottom),
    bottom: Math.max(rawTop, derivedBottom)
  };
}

function distanceToRect(point, rect) {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.hypot(dx, dy);
}

/**
 * Picks a direct hit before considering nearby magnetic targets. A sole direct
 * hit is never made ambiguous by a merely nearby chip. Overlapping direct hits
 * and near-equal nearby hits are reported as ambiguous instead of guessed.
 */
export function pickMagneticTarget(candidates, point, { radius = 38, ambiguityGap = 8 } = {}) {
  const x = finiteNumber(point?.x ?? point?.clientX);
  const y = finiteNumber(point?.y ?? point?.clientY);
  const safeRadius = finiteNumber(radius);
  const safeGap = finiteNumber(ambiguityGap);
  const empty = { selected: null, ambiguous: false, exact: false, distance: null };
  if (!Array.isArray(candidates) || x == null || y == null || safeRadius == null || safeRadius < 0 || safeGap == null || safeGap < 0) return empty;

  const ranked = candidates.flatMap((candidate, index) => {
    const rect = candidateRect(candidate);
    if (!rect) return [];
    return [{ candidate, distance: distanceToRect({ x, y }, rect), index }];
  }).sort((left, right) => left.distance - right.distance || left.index - right.index);

  const exact = ranked.filter((entry) => entry.distance === 0);
  if (exact.length === 1) return { selected: exact[0].candidate, ambiguous: false, exact: true, distance: 0 };
  if (exact.length > 1) return { selected: null, ambiguous: true, exact: true, distance: 0 };

  const nearby = ranked.filter((entry) => entry.distance <= safeRadius);
  if (!nearby.length) return empty;
  const lead = nearby[0];
  const runnerUp = nearby[1];
  const tied = runnerUp && runnerUp.distance === lead.distance;
  const tooCloseToCall = runnerUp && runnerUp.distance - lead.distance < safeGap;
  if (tied || tooCloseToCall) return { selected: null, ambiguous: true, exact: false, distance: lead.distance };
  return { selected: lead.candidate, ambiguous: false, exact: false, distance: lead.distance };
}

function normalizedBounds(bounds) {
  if (!bounds || typeof bounds !== "object") return null;
  const left = finiteNumber(bounds.left ?? bounds.x ?? 0);
  const top = finiteNumber(bounds.top ?? bounds.y ?? 0);
  const explicitRight = finiteNumber(bounds.right);
  const explicitBottom = finiteNumber(bounds.bottom);
  const width = finiteNumber(bounds.width);
  const height = finiteNumber(bounds.height);
  const right = explicitRight ?? (left == null || width == null ? null : left + width);
  const bottom = explicitBottom ?? (top == null || height == null ? null : top + height);
  const gap = finiteNumber(bounds.gap ?? 10);
  if (left == null || top == null || right == null || bottom == null || gap == null || gap < 0 || right <= left || bottom <= top) return null;
  return { left, top, right, bottom, gap, width: right - left, height: bottom - top };
}

/**
 * Deterministic first-fit-decreasing shelf packing. Every returned rectangle is
 * centered inside the supplied bounds and separated by at least bounds.gap.
 * Invalid or impossible input returns null; input items are never mutated.
 */
export function packOrbit(items, bounds) {
  if (!Array.isArray(items)) return null;
  if (!items.length) return [];
  const area = normalizedBounds(bounds);
  if (!area) return null;

  const ids = new Set();
  const measured = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const id = item?.id;
    const width = finiteNumber(item?.width ?? item?.rect?.width);
    const height = finiteNumber(item?.height ?? item?.rect?.height);
    if (id == null || ids.has(id) || width == null || height == null || width <= 0 || height <= 0 || width > area.width || height > area.height) return null;
    ids.add(id);
    measured.push({ id, width, height, index });
  }

  const ordered = measured.slice().sort((left, right) => right.height - left.height || right.width - left.width || left.index - right.index);
  const shelves = [];
  for (const item of ordered) {
    let shelf = shelves.find((entry) => entry.usedWidth + area.gap + item.width <= area.width);
    if (!shelf) {
      const y = shelves.length ? shelves.at(-1).y + shelves.at(-1).height + area.gap : 0;
      shelf = { y, height: item.height, usedWidth: 0, items: [] };
      shelves.push(shelf);
    }
    const x = shelf.items.length ? shelf.usedWidth + area.gap : 0;
    shelf.items.push({ ...item, relativeX: x });
    shelf.usedWidth = x + item.width;
  }

  const contentHeight = shelves.at(-1).y + shelves.at(-1).height;
  if (contentHeight > area.height) return null;
  const verticalOffset = area.top + (area.height - contentHeight) / 2;
  const placements = [];
  for (const shelf of shelves) {
    const horizontalOffset = area.left + (area.width - shelf.usedWidth) / 2;
    for (const item of shelf.items) {
      placements.push({
        id: item.id,
        x: horizontalOffset + item.relativeX,
        y: verticalOffset + shelf.y + (shelf.height - item.height) / 2,
        width: item.width,
        height: item.height,
        index: item.index
      });
    }
  }

  return placements.sort((left, right) => left.index - right.index).map(({ index, ...placement }) => placement);
}

/**
 * Finds the closest free top-left position for a newly summoned word. The
 * search is deterministic, stays in bounds, and leaves existing chips where
 * the player put them. If the board is too crowded, the clamped preferred
 * position is returned and the normal Tidy Orbit escape hatch remains usable.
 */
export function findOpenSpawn(preferred, size, occupied, bounds, { gap = 10, step = 18 } = {}) {
  const area = normalizedBounds({ ...bounds, gap });
  const width = finiteNumber(size?.width);
  const height = finiteNumber(size?.height);
  const safeStep = finiteNumber(step);
  if (!area || width == null || height == null || width <= 0 || height <= 0 || width > area.width || height > area.height || safeStep == null || safeStep < 4) return null;
  const minimumX = area.left;
  const minimumY = area.top;
  const maximumX = area.right - width;
  const maximumY = area.bottom - height;
  const preferredX = Math.min(maximumX, Math.max(minimumX, finiteNumber(preferred?.x) ?? minimumX));
  const preferredY = Math.min(maximumY, Math.max(minimumY, finiteNumber(preferred?.y) ?? minimumY));
  const blockers = (Array.isArray(occupied) ? occupied : []).map(candidateRect).filter(Boolean);
  const free = ({ x, y }) => blockers.every((rect) => x + width + area.gap <= rect.left
    || rect.right + area.gap <= x
    || y + height + area.gap <= rect.top
    || rect.bottom + area.gap <= y);
  const candidates = [{ x: preferredX, y: preferredY }];
  for (let y = minimumY; y <= maximumY; y += safeStep) {
    for (let x = minimumX; x <= maximumX; x += safeStep) candidates.push({ x, y });
  }
  if ((maximumX - minimumX) % safeStep) candidates.push({ x: maximumX, y: preferredY });
  if ((maximumY - minimumY) % safeStep) candidates.push({ x: preferredX, y: maximumY });
  candidates.sort((left, right) => (left.x - preferredX) ** 2 + (left.y - preferredY) ** 2
    - ((right.x - preferredX) ** 2 + (right.y - preferredY) ** 2)
    || left.y - right.y || left.x - right.x);
  return candidates.find(free) || { x: preferredX, y: preferredY };
}

function normalizedWord(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function itemKeys(item) {
  const keys = [normalizedWord(item?.word)];
  if (item?.id != null) keys.push(normalizedWord(item.id));
  return keys.filter(Boolean);
}

function rankList(values) {
  const ranks = new Map();
  if (!Array.isArray(values)) return ranks;
  values.forEach((value, index) => {
    const keys = typeof value === "object" && value !== null ? itemKeys(value) : [normalizedWord(value)];
    for (const key of keys) if (key && !ranks.has(key)) ranks.set(key, index);
  });
  return ranks;
}

function listRank(item, ranks) {
  let best = Infinity;
  for (const key of itemKeys(item)) best = Math.min(best, ranks.get(key) ?? Infinity);
  return best;
}

function newestValue(item) {
  for (const value of [item?.discoveredAt, item?.createdAt, item?.updatedAt]) {
    const numeric = typeof value === "number" ? value : Date.parse(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

/**
 * Returns item references in display order without mutating the input. With no
 * query, starters stay pinned, then explicit recent items and newest additions.
 * Search filters nonmatches and ranks exact, prefix, then substring matches.
 */
export function orderInventory(items, { starters = [], recent = [], query = "" } = {}) {
  if (!Array.isArray(items)) return [];
  const starterRanks = rankList(starters);
  const recentRanks = rankList(recent);
  const needle = normalizedWord(query);

  return items.map((item, index) => {
    const word = normalizedWord(item?.word);
    const match = !needle ? 0 : word === needle ? 0 : word.startsWith(needle) ? 1 : word.includes(needle) ? 2 : Infinity;
    return {
      item,
      index,
      match,
      starter: listRank(item, starterRanks),
      recent: listRank(item, recentRanks),
      newest: newestValue(item)
    };
  }).filter((entry) => Number.isFinite(entry.match)).sort((left, right) => {
    if (left.match !== right.match) return left.match - right.match;
    const leftStarter = Number.isFinite(left.starter);
    const rightStarter = Number.isFinite(right.starter);
    if (leftStarter !== rightStarter) return leftStarter ? -1 : 1;
    if (leftStarter && left.starter !== right.starter) return left.starter - right.starter;
    const leftRecent = Number.isFinite(left.recent);
    const rightRecent = Number.isFinite(right.recent);
    if (leftRecent !== rightRecent) return leftRecent ? -1 : 1;
    if (leftRecent && left.recent !== right.recent) return left.recent - right.recent;
    if (left.newest != null || right.newest != null) {
      if (left.newest == null) return 1;
      if (right.newest == null) return -1;
      if (left.newest !== right.newest) return right.newest - left.newest;
    }
    return right.index - left.index;
  }).map((entry) => entry.item);
}
