export const MOON_SETTLEMENT_STORAGE_VERSION = 1;
export const MOON_SETTLEMENT_SNAPSHOT_COUNT = 3;
export const DEFAULT_MOON_SETTLEMENT_STORAGE_KEY = "constellore:moon-settlement-lab:v1";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function checksum(value) {
  const source = canonicalJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function cleanRevision(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1_000_000_000, Math.floor(number))) : 0;
}

function cleanTimestamp(value, fallback = "") {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

export function createMoonSettlementSnapshot(rawState, {
  sanitize,
  at = new Date()
} = {}) {
  if (typeof sanitize !== "function") throw new TypeError("A settlement sanitizer is required.");
  const state = sanitize(rawState);
  const savedAt = cleanTimestamp(at instanceof Date ? at.toISOString() : at, new Date(0).toISOString());
  const payload = {
    kind: "moon-settlement-snapshot",
    version: MOON_SETTLEMENT_STORAGE_VERSION,
    revision: cleanRevision(state.revision),
    savedAt,
    state
  };
  return Object.freeze({ ...payload, checksum: checksum(payload) });
}

export function readMoonSettlementSnapshot(raw, { sanitize } = {}) {
  if (typeof sanitize !== "function") throw new TypeError("A settlement sanitizer is required.");
  const source = record(raw);
  if (source.kind !== "moon-settlement-snapshot" || Number(source.version) !== MOON_SETTLEMENT_STORAGE_VERSION) return null;
  const payload = {
    kind: source.kind,
    version: MOON_SETTLEMENT_STORAGE_VERSION,
    revision: cleanRevision(source.revision),
    savedAt: cleanTimestamp(source.savedAt),
    state: source.state
  };
  if (!payload.savedAt || typeof source.checksum !== "string" || source.checksum !== checksum(payload)) return null;
  const state = sanitize(source.state);
  if (cleanRevision(state.revision) !== payload.revision) return null;
  return Object.freeze({ ...payload, state, checksum: source.checksum });
}

function parseStoredSnapshot(value, options) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return readMoonSettlementSnapshot(JSON.parse(value), options);
  } catch {
    return null;
  }
}

export function createMoonSettlementStorage({
  storage,
  sanitize,
  key = DEFAULT_MOON_SETTLEMENT_STORAGE_KEY,
  now = () => new Date()
} = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new TypeError("A Storage-compatible adapter is required.");
  }
  if (typeof sanitize !== "function") throw new TypeError("A settlement sanitizer is required.");
  const prefix = String(key || DEFAULT_MOON_SETTLEMENT_STORAGE_KEY);
  const slotKey = (slot) => `${prefix}:snapshot:${slot}`;

  function snapshots() {
    const found = [];
    for (let slot = 0; slot < MOON_SETTLEMENT_SNAPSHOT_COUNT; slot += 1) {
      const snapshot = parseStoredSnapshot(storage.getItem(slotKey(slot)), { sanitize });
      if (snapshot) found.push({ slot, snapshot });
    }
    return found.sort((left, right) => (
      right.snapshot.revision - left.snapshot.revision
      || Date.parse(right.snapshot.savedAt) - Date.parse(left.snapshot.savedAt)
      || right.slot - left.slot
    ));
  }

  function load(fallback) {
    return snapshots()[0]?.snapshot.state ?? sanitize(fallback);
  }

  function save(rawState) {
    const snapshot = createMoonSettlementSnapshot(rawState, { sanitize, at: now() });
    const slot = snapshot.revision % MOON_SETTLEMENT_SNAPSHOT_COUNT;
    storage.setItem(slotKey(slot), JSON.stringify(snapshot));
    return snapshot.state;
  }

  function reset() {
    for (let slot = 0; slot < MOON_SETTLEMENT_SNAPSHOT_COUNT; slot += 1) {
      storage.removeItem(slotKey(slot));
    }
  }

  function exportJson(rawState) {
    return JSON.stringify(createMoonSettlementSnapshot(rawState, { sanitize, at: now() }), null, 2);
  }

  function importJson(source) {
    let parsed;
    try {
      parsed = JSON.parse(String(source || ""));
    } catch {
      throw new TypeError("Settlement import is not valid JSON.");
    }
    const snapshot = readMoonSettlementSnapshot(parsed, { sanitize });
    if (!snapshot) throw new TypeError("Settlement import failed validation.");
    // Import replaces the disposable lab expedition as one whole revision.
    // Otherwise an older, valid import can lose to a newer rotating slot on reload.
    reset();
    return save(snapshot.state);
  }

  return Object.freeze({
    load,
    save,
    reset,
    exportJson,
    importJson,
    snapshots: () => snapshots().map(({ snapshot }) => snapshot),
    keys: Object.freeze(Array.from({ length: MOON_SETTLEMENT_SNAPSHOT_COUNT }, (_, slot) => slotKey(slot)))
  });
}
