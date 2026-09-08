export const MOON_SETTLEMENT_TIMELINE_VERSION = 1;
export const MOON_SETTLEMENT_TIMELINE_LIMIT = 512;

const EVENT_TYPES = new Set([
  "milestone",
  "retry",
  "hint",
  "idle-gap",
  "exit",
  "mode",
  "operation"
]);

function cleanText(value, maximum = 80) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanTimestamp(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return "";
  return new Date(value).toISOString();
}

function cleanEvent(raw = {}) {
  const type = cleanText(raw.type, 24).toLowerCase();
  const at = cleanTimestamp(raw.at);
  if (!EVENT_TYPES.has(type) || !at) return null;
  const event = {
    type,
    at,
    key: cleanText(raw.key, 80),
    step: Math.max(0, Math.min(10_000, Math.floor(Number(raw.step) || 0)))
  };
  if (type === "idle-gap") {
    event.durationMs = Math.max(0, Math.min(86_400_000, Math.floor(Number(raw.durationMs) || 0)));
  }
  return Object.freeze(event);
}

export function sanitizeMoonSettlementTimeline(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const events = (Array.isArray(source.events) ? source.events : [])
    .map(cleanEvent)
    .filter(Boolean)
    .slice(-MOON_SETTLEMENT_TIMELINE_LIMIT);
  return Object.freeze({
    kind: "moon-settlement-playtest-timeline",
    version: MOON_SETTLEMENT_TIMELINE_VERSION,
    events: Object.freeze(events)
  });
}

export function appendMoonSettlementTimeline(raw, event, { at = new Date() } = {}) {
  const before = sanitizeMoonSettlementTimeline(raw);
  const accepted = cleanEvent({ ...event, at: cleanTimestamp(event?.at) || cleanTimestamp(at) });
  if (!accepted) return before;
  return sanitizeMoonSettlementTimeline({ events: [...before.events, accepted] });
}

export function exportMoonSettlementTimeline(raw) {
  return JSON.stringify(sanitizeMoonSettlementTimeline(raw), null, 2);
}

