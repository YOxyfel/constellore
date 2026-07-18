export const PENDING_SCORE_PREFIX = "constellore-pending-score-v1:";
export const PENDING_SCORE_RETENTION_MS = 7 * 86400000;

function cleanIdentifier(value, maximum) {
  const text = String(value || "").trim();
  return text && text.length <= maximum && !/[\u0000-\u001f\u007f]/.test(text) ? text : "";
}
function cleanDate(value, now) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(now).toISOString();
}

export function pendingScoreStorageKey(playerId, runId) {
  const player = cleanIdentifier(playerId, 128);
  const run = cleanIdentifier(runId, 128);
  return player && run ? `${PENDING_SCORE_PREFIX}${encodeURIComponent(player)}:${encodeURIComponent(run)}` : "";
}

export function sanitizePendingScore(raw, { now = Date.now() } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const playerId = cleanIdentifier(raw.playerId, 128);
  const runId = cleanIdentifier(raw.runId, 128);
  const runToken = cleanIdentifier(raw.runToken, 512);
  if (!playerId || !runId || !runToken) return null;
  return {
    version: 1,
    savedAt: cleanDate(raw.savedAt, now),
    playerId,
    runId,
    runToken,
    mode: cleanIdentifier(raw.mode, 24),
    target: cleanIdentifier(raw.target, 80)
  };
}

/** Each score owns one localStorage key, so another tab/account can never be
 * lost through stale read-modify-write of a shared array. setItem is atomic;
 * a verified read makes quota and privacy-mode failures observable. */
export function savePendingScoreRecord(storage, raw, options = {}) {
  const record = sanitizePendingScore(raw, options);
  const key = record ? pendingScoreStorageKey(record.playerId, record.runId) : "";
  if (!storage || !key) return false;
  try {
    storage.setItem(key, JSON.stringify(record));
    const confirmed = sanitizePendingScore(JSON.parse(storage.getItem(key) || "null"), options);
    return Boolean(confirmed && confirmed.playerId === record.playerId && confirmed.runId === record.runId && confirmed.runToken === record.runToken);
  } catch {
    return false;
  }
}

export function removePendingScoreRecord(storage, playerId, runId) {
  const key = pendingScoreStorageKey(playerId, runId);
  if (!storage || !key) return false;
  try {
    storage.removeItem(key);
    return storage.getItem(key) == null;
  } catch {
    return false;
  }
}

export function listPendingScoreRecords(storage, { now = Date.now(), retentionMs = PENDING_SCORE_RETENTION_MS } = {}) {
  if (!storage) return [];
  try {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (String(key || "").startsWith(PENDING_SCORE_PREFIX)) keys.push(key);
    }
    const cutoff = now - Math.max(60_000, Number(retentionMs) || PENDING_SCORE_RETENTION_MS);
    const records = [];
    for (const key of keys) {
      let record = null;
      try { record = sanitizePendingScore(JSON.parse(storage.getItem(key) || "null"), { now }); }
      catch { /* Invalid records are removed below. */ }
      const valid = record && pendingScoreStorageKey(record.playerId, record.runId) === key && Date.parse(record.savedAt) >= cutoff;
      if (!valid) {
        try { storage.removeItem(key); } catch { /* Best-effort cleanup only. */ }
        continue;
      }
      records.push(record);
    }
    return records.sort((left, right) => Date.parse(left.savedAt) - Date.parse(right.savedAt) || left.runId.localeCompare(right.runId));
  } catch {
    return [];
  }
}
