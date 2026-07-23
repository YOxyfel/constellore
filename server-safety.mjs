const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const CONCEPT_CHARACTERS = /^[\p{L}\p{N}][\p{L}\p{N} &'’\-/.]{0,79}$/u;

export function safeConcept(value, maximum = 80) {
  const text = String(value ?? "")
    .normalize("NFKC")
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length > maximum || !CONCEPT_CHARACTERS.test(text)) return null;
  return text;
}

export function safeDiscoveryContext(value, { maximumItems = 40, maximumWordLength = 80 } = {}) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const candidate of value) {
    const word = safeConcept(candidate, maximumWordLength);
    if (!word) continue;
    const key = word.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(word);
    if (result.length >= maximumItems) break;
  }
  return result;
}

export class MemoryRateLimiter {
  constructor({ windowMs = 60_000, maximumKeys = 10_000 } = {}) {
    this.windowMs = Math.max(1_000, Number(windowMs) || 60_000);
    this.maximumKeys = Math.max(100, Number(maximumKeys) || 10_000);
    this.records = new Map();
    this.lastSweepAt = 0;
  }

  limited(key, limit, now = Date.now()) {
    const safeLimit = Math.max(1, Math.floor(Number(limit) || 1));
    const safeKey = String(key || "anonymous").slice(0, 256);
    if (now - this.lastSweepAt >= this.windowMs || this.records.size >= this.maximumKeys) this.sweep(now);
    const current = this.records.get(safeKey);
    if (!current || now - current.startedAt >= this.windowMs) {
      this.records.set(safeKey, { count: 1, startedAt: now, touchedAt: now });
      return false;
    }
    current.touchedAt = now;
    current.count += 1;
    return current.count > safeLimit;
  }

  sweep(now = Date.now()) {
    const expiry = now - this.windowMs * 2;
    for (const [key, record] of this.records) {
      if (record.touchedAt < expiry) this.records.delete(key);
    }
    if (this.records.size > this.maximumKeys) {
      const oldest = [...this.records.entries()].sort((left, right) => left[1].touchedAt - right[1].touchedAt);
      for (const [key] of oldest.slice(0, this.records.size - this.maximumKeys)) this.records.delete(key);
    }
    this.lastSweepAt = now;
  }
}

export class AiRequestGate {
  constructor({ maximumConcurrent = 3, dailyLimit = 500 } = {}) {
    this.maximumConcurrent = Math.max(1, Math.floor(Number(maximumConcurrent) || 3));
    this.dailyLimit = Math.max(1, Math.floor(Number(dailyLimit) || 500));
    this.active = 0;
    this.day = "";
    this.used = 0;
  }

  acquire(date = new Date()) {
    const day = date.toISOString().slice(0, 10);
    if (this.day !== day) {
      this.day = day;
      this.used = 0;
    }
    if (this.active >= this.maximumConcurrent) {
      const error = new Error("The discovery engine is busy. Try again shortly.");
      error.code = "ai_busy";
      error.statusCode = 503;
      throw error;
    }
    if (this.used >= this.dailyLimit) {
      const error = new Error("Today's experimental discovery budget has been reached.");
      error.code = "ai_budget_reached";
      error.statusCode = 503;
      throw error;
    }
    this.active += 1;
    this.used += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
    };
  }
}

export function trustedWriteOrigin(origin, allowedOrigins = []) {
  if (!origin) return true;
  let parsed;
  try { parsed = new URL(origin); }
  catch { return false; }
  return new Set(allowedOrigins.filter(Boolean).map((value) => {
    try { return new URL(value).origin; }
    catch { return ""; }
  })).has(parsed.origin);
}
