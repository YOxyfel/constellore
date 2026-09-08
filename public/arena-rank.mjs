export const SCRAMBLE_ARENA_LEAGUES = Object.freeze([
  Object.freeze({ id: "bronze", name: "Bronze", minimumXp: 0, mark: "◆" }),
  Object.freeze({ id: "silver", name: "Silver", minimumXp: 500, mark: "✦" }),
  Object.freeze({ id: "gold", name: "Gold", minimumXp: 1_500, mark: "✶" })
]);

function safeRecord(value) {
  try {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function ownDataValue(value, key) {
  const source = safeRecord(value);
  if (!source) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function boundedXp(candidate) {
  const outer = safeRecord(candidate) || { xp: candidate };
  const nestedScramble = safeRecord(ownDataValue(outer, "scrambleArena"));
  const nestedArena = safeRecord(ownDataValue(outer, "arena"));
  const arena = nestedScramble || nestedArena || outer;
  const source = safeRecord(ownDataValue(arena, "progression")) || arena;
  const raw = ownDataValue(source, "xp");
  const value = typeof raw === "number"
    ? raw
    : typeof raw === "string" && raw.trim()
      ? Number(raw)
      : Number.NaN;
  return Math.max(0, Math.min(1_000_000_000, Math.floor(Number.isFinite(value) ? value : 0)));
}

/**
 * Maps shared seasonal Arena XP to a player-facing league. Per-mode ratings
 * remain separate and continue to drive matchmaking.
 */
export function scrambleArenaLeaguePresentation(candidate) {
  const xp = boundedXp(candidate);
  const index = SCRAMBLE_ARENA_LEAGUES.findLastIndex((league) => xp >= league.minimumXp);
  const league = SCRAMBLE_ARENA_LEAGUES[Math.max(0, index)];
  const next = SCRAMBLE_ARENA_LEAGUES[index + 1] || null;
  const span = next ? next.minimumXp - league.minimumXp : 0;
  const progress = next
    ? Math.max(0, Math.min(100, Math.round(((xp - league.minimumXp) / span) * 100)))
    : 100;
  return Object.freeze({
    ...league,
    xp,
    progress,
    next: next ? Object.freeze({ ...next }) : null,
    xpIntoLeague: next ? Math.max(0, xp - league.minimumXp) : 0,
    xpRequired: span,
    xpRemaining: next ? Math.max(0, next.minimumXp - xp) : 0,
    label: `${league.name} Arena Rank`
  });
}
