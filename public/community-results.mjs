import { sanitizeRouteSignature } from "./signature-routes.mjs?v=3.0.0-beta.2";

const MAX_COMMUNITY_ENTRIES = 500;

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function safeCallsign(value) {
  if (typeof value !== "string") return "Anonymous Stargazer";
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 48);
  return /^[\p{L}\p{N} ._-]{2,48}$/u.test(text) ? text : "Anonymous Stargazer";
}

function safeInternalId(value) {
  if (typeof value !== "string") return "";
  const text = value.trim().slice(0, 80);
  return /^[a-z0-9:_-]{1,80}$/i.test(text) ? text : "";
}

function sanitizeEntry(raw, index) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const moves = clampInteger(raw.moves, 1, 1_000, 1_000);
  const elapsedMs = clampInteger(raw.elapsedMs, 1, 86_400_000, 86_400_000);
  const score = clampInteger(raw.score, 0, 1_000_000_000, 0);
  const signature = sanitizeRouteSignature(raw.signature);
  return {
    internalId: safeInternalId(raw.playerId),
    rank: clampInteger(raw.rank, 1, MAX_COMMUNITY_ENTRIES, index + 1),
    callsign: safeCallsign(raw.callsign),
    moves,
    elapsedMs,
    score,
    signature
  };
}

function roundedAverage(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function publicRoute(entry) {
  if (!entry) return null;
  return {
    rank: entry.rank,
    callsign: entry.callsign,
    moves: entry.moves,
    seconds: Math.max(1, Math.round(entry.elapsedMs / 1000)),
    signatureScore: entry.signature?.score || 0,
    tier: entry.signature?.tierLabel || "Unrated Route"
  };
}

/**
 * Aggregates completed asynchronous routes. Raw player identifiers are used
 * only to locate the requesting player and are never returned.
 */
export function buildCommunityResults(rawEntries, { playerId = "" } = {}) {
  const entries = [];
  for (const raw of Array.isArray(rawEntries) ? rawEntries.slice(0, MAX_COMMUNITY_ENTRIES) : []) {
    const entry = sanitizeEntry(raw, entries.length);
    if (entry) entries.push(entry);
  }
  entries.sort((left, right) => left.rank - right.rank || right.score - left.score || left.moves - right.moves || left.elapsedMs - right.elapsedMs);
  const requester = safeInternalId(playerId);
  const playerIndex = requester ? entries.findIndex((entry) => entry.internalId === requester) : -1;
  const player = playerIndex >= 0 ? entries[playerIndex] : null;
  const fingerprints = new Set(entries.map((entry) => entry.signature?.routeFingerprint).filter(Boolean));
  const signedEntries = entries.filter((entry) => entry.signature);
  const mostOriginal = [...signedEntries].sort((left, right) => {
    const leftOriginality = (left.signature.dimensions.variety + left.signature.dimensions.novelty) / 2;
    const rightOriginality = (right.signature.dimensions.variety + right.signature.dimensions.novelty) / 2;
    return rightOriginality - leftOriginality || right.signature.score - left.signature.score || left.rank - right.rank;
  })[0] || null;
  const nearby = player ? entries[playerIndex > 0 ? playerIndex - 1 : playerIndex + 1] || null : null;
  const completed = entries.length;
  return {
    version: 1,
    privacy: "aggregate-and-public-callsign",
    completedRoutes: completed,
    averageMoves: roundedAverage(entries.map((entry) => entry.moves)),
    averageSeconds: Math.max(0, Math.round(roundedAverage(entries.map((entry) => entry.elapsedMs)) / 1000)),
    distinctSignatures: fingerprints.size,
    signatureVarietyPercent: signedEntries.length ? Math.round(fingerprints.size / signedEntries.length * 100) : 0,
    player: player ? {
      rank: player.rank,
      topPercent: completed ? Math.max(1, Math.ceil(player.rank / completed * 100)) : 100,
      movesVsAverage: player.moves - roundedAverage(entries.map((entry) => entry.moves)),
      secondsVsAverage: Math.round((player.elapsedMs - roundedAverage(entries.map((entry) => entry.elapsedMs))) / 1000),
      signatureScore: player.signature?.score || 0,
      tier: player.signature?.tierLabel || "Unrated Route"
    } : null,
    mostOriginal: publicRoute(mostOriginal),
    nearby: publicRoute(nearby)
  };
}

