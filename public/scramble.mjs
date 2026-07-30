import {
  SCRAMBLE_DEFAULT_MODE_ID,
  getScrambleModeDefinition,
  normalizeScrambleModeId
} from "./scramble-arena.mjs?v=5.0.0-beta.1";

export const SCRAMBLE_COUNTDOWN_SECONDS = 3;
export const SCRAMBLE_MATCH_SECONDS = 5 * 60;
export const SCRAMBLE_EVENT_LIMIT = 600;
export const SCRAMBLE_BOARD_WORD_LIMIT = 512;
export const SCRAMBLE_BOARD_HISTORY_LIMIT = 256;

const EVENT_TYPES = new Set([
  "attempt",
  "success",
  "failure",
  "first_light",
  "echo_steal",
  "intercept",
  "lead_change",
  "player_joined",
  "ready",
  "countdown_started",
  "match_started",
  "disconnect",
  "reconnect",
  "rematch_requested",
  "rematch_ready",
  "chapter_started",
  "chapter_won",
  "chapter_timeout",
  "finished"
]);

function record(value) {
  try {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function ownValue(value, key) {
  const source = record(value);
  try {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function firstOwnValue(value, keys) {
  for (const key of keys) {
    const candidate = ownValue(value, key);
    if (candidate !== undefined) return candidate;
  }
  return undefined;
}

function hasAnyOwnValue(value, keys) {
  return keys.some((key) => ownValue(value, key) !== undefined);
}

function hasOwnDataProperties(value) {
  const source = record(value);
  try {
    return Object.getOwnPropertyNames(source).some((key) => ownValue(source, key) !== undefined);
  } catch {
    return false;
  }
}

function boundedText(value, maximum = 64) {
  try {
    return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maximum);
  } catch {
    return "";
  }
}

function boundedInteger(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  let number;
  try {
    number = Math.floor(Number(value));
  } catch {
    return minimum;
  }
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : minimum;
}

function finiteNumber(value) {
  try {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  } catch {
    return null;
  }
}

function safeTimestamp(value) {
  try {
    const timestamp = Date.parse(String(value || ""));
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
  } catch {
    return "";
  }
}

function safeArray(value) {
  try {
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function safeVersion(value, fallback = 1) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return boundedInteger(value, 0, 1_000_000);
  }
  const text = boundedText(value, 40);
  return text || fallback;
}

function scrambleFormat(value, fallback = SCRAMBLE_DEFAULT_MODE_ID) {
  const normalized = normalizeScrambleModeId(value);
  return normalized || normalizeScrambleModeId(fallback) || SCRAMBLE_DEFAULT_MODE_ID;
}

function formatFromSource(source, fallback = SCRAMBLE_DEFAULT_MODE_ID) {
  const explicit = firstOwnValue(source, ["format", "formatId", "scrambleMode"]);
  if (explicit !== undefined) return scrambleFormat(explicit, fallback);
  const legacyMode = ownValue(source, "mode");
  if (legacyMode !== undefined) {
    const normalizedLegacy = normalizeScrambleModeId(legacyMode);
    if (normalizedLegacy) return normalizedLegacy;
  }
  return scrambleFormat(fallback);
}

function modeDefinition(format) {
  return getScrambleModeDefinition(format) || getScrambleModeDefinition(SCRAMBLE_DEFAULT_MODE_ID);
}

function boundedBoolean(value) {
  return value === true;
}

export function sanitizeScrambleToken(value) {
  const token = boundedText(value, 160);
  return /^[a-z0-9][a-z0-9._~-]{7,159}$/i.test(token) ? token : "";
}

export function parseScrambleInvite(locationLike = globalThis.location) {
  const href = typeof locationLike === "string" ? locationLike : locationLike?.href;
  if (!href) return null;
  let url;
  try {
    url = new URL(href, "https://constellore.invalid/play/");
  } catch {
    return null;
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const token = sanitizeScrambleToken(
    hash.get("scramble")
    || hash.get("duel")
    || url.searchParams.get("scramble")
    || url.searchParams.get("duel")
  );
  return token ? { token, source: hash.has("scramble") || hash.has("duel") ? "fragment" : "query" } : null;
}

export function buildScrambleInviteUrl(token, locationLike = globalThis.location) {
  const safeToken = sanitizeScrambleToken(token);
  if (!safeToken) return "";
  const href = typeof locationLike === "string" ? locationLike : locationLike?.href;
  let url;
  try {
    url = new URL(href || "https://constellore.invalid/play/");
  } catch {
    return "";
  }
  for (const key of ["scramble", "duel", "challenge", "target", "seed", "from", "mode"]) {
    url.searchParams.delete(key);
  }
  url.hash = new URLSearchParams({ scramble: safeToken }).toString();
  return url.toString();
}

export function clearScrambleInviteFromUrl(locationLike = globalThis.location) {
  const href = typeof locationLike === "string" ? locationLike : locationLike?.href;
  try {
    const url = new URL(href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    hash.delete("scramble");
    hash.delete("duel");
    url.searchParams.delete("scramble");
    url.searchParams.delete("duel");
    url.hash = hash.toString();
    return url.toString();
  } catch {
    return "";
  }
}

const SCRAMBLE_RULE_INTEGER_FIELDS = Object.freeze({
  durationSeconds: [1, 60 * 60],
  discoveryQuota: [1, 999],
  quota: [1, 999],
  turnLimit: [1, 999],
  claimQuota: [1, 999],
  scoreToWin: [1, 1_000_000],
  scorePerDiscovery: [0, 100_000],
  firstLightBonus: [0, 100_000],
  echoStealBonus: [0, 100_000],
  interceptBonus: [0, 100_000],
  goldenPairBonus: [0, 100_000],
  chapterCount: [1, 20],
  chapterIntermissionSeconds: [1, 30],
  maxAttempts: [1, 10_000],
  maxMoves: [1, 10_000]
});

const SCRAMBLE_RULE_BOOLEAN_FIELDS = Object.freeze([
  "openBoards",
  "visibleBoards",
  "suddenDeath"
]);

/**
 * Keeps only the small, documented rule vocabulary needed by Scramble clients.
 * Unknown server fields never become client state.
 */
export function sanitizeScrambleRules(value, format = SCRAMBLE_DEFAULT_MODE_ID, fallbackValue) {
  const safeFormat = scrambleFormat(format);
  const definition = modeDefinition(safeFormat);
  const supplied = record(value);
  const fallback = record(fallbackValue);
  const defaults = record(definition?.config);
  const result = {};
  for (const [key, [minimum, maximum]] of Object.entries(SCRAMBLE_RULE_INTEGER_FIELDS)) {
    const candidate = ownValue(supplied, key)
      ?? ownValue(fallback, key)
      ?? ownValue(defaults, key);
    if (candidate !== undefined) result[key] = boundedInteger(candidate, minimum, maximum);
  }
  for (const key of SCRAMBLE_RULE_BOOLEAN_FIELDS) {
    const candidate = ownValue(supplied, key) ?? ownValue(fallback, key);
    if (candidate !== undefined) result[key] = boundedBoolean(candidate);
  }
  const resolution = boundedText(
    ownValue(supplied, "resolution") ?? ownValue(fallback, "resolution"),
    48
  );
  if (resolution) result.resolution = resolution;
  const scoring = record(ownValue(supplied, "scoring") ?? ownValue(fallback, "scoring"));
  const scoreWeights = {};
  for (const key of ["discovery", "firstLight", "echoSteal", "intercept", "goldenPair"]) {
    const candidate = ownValue(scoring, key);
    if (candidate !== undefined) scoreWeights[key] = boundedInteger(candidate, 0, 100_000);
  }
  if (Object.keys(scoreWeights).length) result.scoring = scoreWeights;
  const counterCycle = safeArray(
    ownValue(supplied, "counterCycle") ?? ownValue(fallback, "counterCycle")
  ).map((entry) => boundedText(entry, 24)).filter(Boolean).slice(0, 12);
  if (counterCycle.length) result.counterCycle = counterCycle;
  const chapterPoints = safeArray(
    ownValue(supplied, "chapterPoints")
    ?? ownValue(fallback, "chapterPoints")
    ?? ownValue(defaults, "chapterPoints")
  ).slice(0, 20).map((entry) => boundedInteger(entry, 1, 100));
  if (chapterPoints.length) result.chapterPoints = chapterPoints;
  return result;
}

export function sanitizeScrambleWord(value) {
  const source = typeof value === "string" ? { word: value } : record(value);
  const word = boundedText(firstOwnValue(source, ["word", "name", "label"]), 48);
  if (!word) return null;
  return {
    word,
    emoji: boundedText(ownValue(source, "emoji"), 12) || "\u2726",
    category: boundedText(ownValue(source, "category"), 32),
    source: boundedText(ownValue(source, "source"), 32)
  };
}

export function sanitizeScrambleChampion(value) {
  const source = record(value);
  const cleanWord = sanitizeScrambleWord(source);
  if (!cleanWord) return null;
  const power = boundedInteger(firstOwnValue(source, ["power", "strength"]), 0, 999);
  const depth = boundedInteger(firstOwnValue(source, ["depth", "buildDepth"]), 0, 999);
  return {
    ...cleanWord,
    category: boundedText(firstOwnValue(source, ["category", "archetype"]), 32),
    power,
    depth: depth || power,
    craftedAt: boundedInteger(firstOwnValue(source, ["craftedAt", "move"]), 0, 10_000)
  };
}

const SCRAMBLE_SAGA_STATUSES = new Set(["idle", "playing", "intermission", "complete"]);
const SCRAMBLE_SAGA_CHAPTER_STATUSES = new Set(["pending", "playing", "won", "timeout"]);

function sagaStatus(value, allowed, fallback) {
  const normalized = boundedText(value, 24).toLowerCase().replace(/[\s-]+/g, "_");
  return allowed.has(normalized) ? normalized : fallback;
}

function sanitizeScrambleSagaScore(value) {
  const source = record(value);
  const slot = boundedText(firstOwnValue(source, ["slot", "id", "playerSlot"]), 96);
  if (!slot) return null;
  return {
    id: boundedText(ownValue(source, "id"), 96) || slot,
    slot,
    points: boundedInteger(ownValue(source, "points"), 0, 10_000),
    score: boundedInteger(ownValue(source, "score"), 0, 10_000),
    chaptersWon: boundedInteger(
      firstOwnValue(source, ["chaptersWon", "riddlesWon", "wins"]),
      0,
      20
    )
  };
}

function sanitizeScrambleSagaChapter(value, chapterCount, fallbackStatus = "playing") {
  const source = record(value);
  const rawNumber = firstOwnValue(source, ["number", "chapterNumber"]);
  const rawIndex = firstOwnValue(source, ["index", "chapterIndex"]);
  const number = rawNumber !== undefined
    ? boundedInteger(rawNumber, 0, chapterCount)
    : rawIndex !== undefined
      ? boundedInteger(rawIndex, 0, Math.max(0, chapterCount - 1)) + 1
      : 0;
  if (!number) return null;
  const status = sagaStatus(
    ownValue(source, "status"),
    SCRAMBLE_SAGA_CHAPTER_STATUSES,
    fallbackStatus
  );
  const winnerSlot = boundedText(firstOwnValue(source, ["winnerSlot", "winnerId"]), 96);
  return {
    number,
    index: number - 1,
    chapterPoints: boundedInteger(
      firstOwnValue(source, ["chapterPoints", "points", "value"]),
      0,
      100
    ),
    status,
    winnerSlot,
    winnerId: winnerSlot,
    target: boundedText(
      ownValue(record(ownValue(source, "target")), "word") ?? ownValue(source, "target"),
      48
    ),
    title: boundedText(firstOwnValue(source, ["title", "chapterTitle"]), 100),
    story: boundedText(firstOwnValue(source, ["story", "storyBeat", "narration"]), 280),
    startsAt: safeTimestamp(firstOwnValue(source, ["chapterStartsAt", "startsAt"])),
    deadlineAt: safeTimestamp(firstOwnValue(source, ["chapterDeadlineAt", "deadlineAt"])),
    settledAt: safeTimestamp(ownValue(source, "settledAt")),
    finale: ownValue(source, "finale") === true
  };
}

function sagaChapterNumber(source, chapterCount, fallback = 0) {
  const suppliedNumber = firstOwnValue(source, ["chapterNumber", "currentChapterNumber"]);
  const suppliedIndex = firstOwnValue(source, ["chapterIndex", "currentChapterIndex"]);
  return suppliedNumber !== undefined
    ? boundedInteger(suppliedNumber, 0, chapterCount)
    : suppliedIndex !== undefined
      ? boundedInteger(suppliedIndex, 0, Math.max(0, chapterCount - 1)) + 1
      : boundedInteger(fallback, 0, chapterCount);
}

function sagaScoreSource(value) {
  if (Array.isArray(value)) return value;
  const source = record(value);
  return Object.entries(source).slice(0, 2).map(([slot, score]) => ({ slot, score }));
}

/**
 * Copies only the authoritative current chapter, settled ledger, and score
 * rows. Any future chapter material included by a malformed response is
 * discarded, so the client cannot reveal upcoming answers.
 */
export function sanitizeScrambleSaga(value, fallbackValue) {
  const source = record(value);
  const fallback = record(fallbackValue);
  const chapterCount = boundedInteger(
    firstOwnValue(source, ["chapterCount", "totalChapters"])
      ?? firstOwnValue(fallback, ["chapterCount", "totalChapters"]),
    0,
    20
  );
  const fallbackNumber = sagaChapterNumber(fallback, chapterCount);
  const chapterNumber = sagaChapterNumber(source, chapterCount, fallbackNumber);
  const rawCurrent = firstOwnValue(source, ["currentChapter", "chapter"]);
  const fallbackCurrent = record(firstOwnValue(fallback, ["currentChapter", "chapter"]));
  const currentSource = record(rawCurrent === undefined ? fallbackCurrent : rawCurrent);
  const currentNumber = sagaChapterNumber(currentSource, chapterCount, chapterNumber);
  const fallbackCurrentNumber = sagaChapterNumber(fallbackCurrent, chapterCount, fallbackNumber);
  const currentChapter = rawCurrent !== null && chapterNumber && currentNumber === chapterNumber
    ? sanitizeScrambleSagaChapter({
        ...(fallbackCurrentNumber === chapterNumber ? fallbackCurrent : {}),
        ...currentSource,
        number: chapterNumber
      }, chapterCount, "playing")
    : null;
  const rawSettled = firstOwnValue(source, ["settledChapters", "settled", "chapterHistory"]);
  const settledSource = rawSettled === undefined
    ? safeArray(firstOwnValue(fallback, ["settledChapters", "settled", "chapterHistory"]))
    : safeArray(rawSettled);
  const settledChapters = settledSource
    .map((chapter) => sanitizeScrambleSagaChapter(chapter, chapterCount, "timeout"))
    .filter((chapter) => chapter && chapter.number <= chapterNumber
      && ["won", "timeout"].includes(chapter.status))
    .sort((left, right) => left.number - right.number)
    .slice(-chapterCount);
  const rawScores = ownValue(source, "scores");
  const scores = sagaScoreSource(rawScores === undefined ? ownValue(fallback, "scores") : rawScores)
    .map(sanitizeScrambleSagaScore)
    .filter(Boolean)
    .slice(0, 2);
  const chapterVersion = boundedInteger(
    firstOwnValue(source, ["chapterVersion", "revision", "currentChapterVersion"])
      ?? firstOwnValue(fallback, ["chapterVersion", "revision", "currentChapterVersion"]),
    0,
    1_000_000_000
  );
  const chapters = [...settledChapters];
  if (currentChapter && !chapters.some((chapter) => chapter.number === currentChapter.number)) {
    chapters.push(currentChapter);
  }
  chapters.sort((left, right) => left.number - right.number);
  return {
    version: safeVersion(ownValue(source, "version") ?? ownValue(fallback, "version"), 1),
    chapterVersion,
    revision: chapterVersion,
    status: sagaStatus(
      ownValue(source, "status") ?? ownValue(fallback, "status"),
      SCRAMBLE_SAGA_STATUSES,
      chapterNumber ? "playing" : "idle"
    ),
    arcTitle: boundedText(
      firstOwnValue(source, ["arcTitle", "storyTitle"])
        ?? firstOwnValue(fallback, ["arcTitle", "storyTitle"]),
      100
    ),
    arcId: boundedText(ownValue(source, "arcId") ?? ownValue(fallback, "arcId"), 80),
    chapterNumber,
    chapterIndex: chapterNumber ? chapterNumber - 1 : 0,
    chapterCount,
    chapterPoints: boundedInteger(
      ownValue(currentChapter, "chapterPoints")
        ?? firstOwnValue(source, ["chapterPoints", "points", "value"])
        ?? firstOwnValue(fallback, ["chapterPoints", "points", "value"]),
      0,
      100
    ),
    finale: ownValue(source, "finale") === true
      || ownValue(source, "finale") === undefined && ownValue(fallback, "finale") === true,
    chapterStartsAt: safeTimestamp(
      firstOwnValue(source, ["chapterStartsAt", "startsAt"])
        ?? ownValue(currentChapter, "startsAt")
        ?? ownValue(fallback, "chapterStartsAt")
    ),
    chapterDeadlineAt: safeTimestamp(
      firstOwnValue(source, ["chapterDeadlineAt", "deadlineAt"])
        ?? ownValue(currentChapter, "deadlineAt")
        ?? ownValue(fallback, "chapterDeadlineAt")
    ),
    nextChapterAt: safeTimestamp(
      ownValue(source, "nextChapterAt") ?? ownValue(fallback, "nextChapterAt")
    ),
    currentChapter,
    settledChapters,
    chapters,
    scores
  };
}

/**
 * Server-authoritative mode progress. It is stored on snapshots and boards so
 * event truncation cannot change scores, quotas, turns, or Forge champions.
 */
export function sanitizeScrambleFormatState(value, format = SCRAMBLE_DEFAULT_MODE_ID) {
  const source = record(value);
  const champion = sanitizeScrambleChampion(firstOwnValue(source, ["champion", "contender"]));
  const turnLimit = boundedInteger(firstOwnValue(source, ["turnLimit", "maxTurns"]), 0, 999);
  return {
    score: boundedInteger(firstOwnValue(source, ["score", "points"]), 0, 1_000_000),
    quota: boundedInteger(firstOwnValue(source, ["quota", "discoveryQuota", "claimQuota"]), 0, 999),
    turnsLeft: boundedInteger(firstOwnValue(source, ["turnsLeft", "remainingTurns"]), 0, 999),
    turnLimit,
    champion,
    depth: boundedInteger(firstOwnValue(source, ["depth", "buildDepth"]), 0, 999) || champion?.depth || 0,
    discoveries: boundedInteger(firstOwnValue(source, ["discoveries", "uniqueDiscoveries"]), 0, 10_000),
    attempts: boundedInteger(firstOwnValue(source, ["attempts", "moves"]), 0, 10_000),
    claims: boundedInteger(firstOwnValue(source, ["claims", "uniqueClaims"]), 0, 10_000),
    chaptersWon: boundedInteger(firstOwnValue(source, ["chaptersWon", "riddlesWon"]), 0, 20),
    remaining: boundedInteger(firstOwnValue(source, ["remaining", "remainingToGoal"]), 0, 10_000),
    rank: boundedInteger(firstOwnValue(source, ["rank", "place"]), 0, 99),
    locked: ownValue(source, "locked") === true,
    complete: firstOwnValue(source, ["complete", "completed"]) === true,
    outcome: boundedText(firstOwnValue(source, ["outcome", "status"]), 40),
    format: scrambleFormat(format)
  };
}

export function sanitizeScrambleFormatResult(value, format = SCRAMBLE_DEFAULT_MODE_ID) {
  const source = record(value);
  const safeFormat = formatFromSource(source, format);
  if (safeFormat === "forge-clash") {
    const battle = record(ownValue(source, "battle"));
    return {
      format: safeFormat,
      battle: {
        winnerSlot: boundedText(firstOwnValue(battle, ["winnerSlot", "winnerId"]), 96),
        reason: boundedText(ownValue(battle, "reason"), 48),
        left: sanitizeScrambleChampion(ownValue(battle, "left")),
        right: sanitizeScrambleChampion(ownValue(battle, "right"))
      }
    };
  }
  if (safeFormat === "wordstorm") {
    const standings = safeArray(ownValue(source, "standings")).slice(0, 2).map((entry) => {
      const standing = record(entry);
      return {
        slot: boundedText(firstOwnValue(standing, ["slot", "id"]), 96),
        score: boundedInteger(ownValue(standing, "score"), 0, 1_000_000),
        quota: boundedInteger(ownValue(standing, "quota"), 0, 999),
        rejectedAttempts: boundedInteger(ownValue(standing, "rejectedAttempts"), 0, 10_000)
      };
    }).filter((entry) => entry.slot);
    return { format: safeFormat, standings };
  }
  return {
    format: safeFormat
  };
}

export function sanitizeScramblePlayer(value, format = SCRAMBLE_DEFAULT_MODE_ID) {
  const source = record(value);
  const id = boundedText(firstOwnValue(source, ["slot", "id", "participantSlot"]), 96);
  if (!id) return null;
  const explicitFormatState = firstOwnValue(source, ["formatState", "modeState"]);
  return {
    id,
    callsign: boundedText(firstOwnValue(source, ["callsign", "name"]), 32) || "STARGAZER",
    ready: ownValue(source, "ready") === true,
    connected: ownValue(source, "connected") !== false,
    discoveries: boundedInteger(firstOwnValue(source, ["discoveries", "successes"]), 0, 999),
    attempts: boundedInteger(firstOwnValue(source, ["attempts", "moves"]), 0, 999),
    rating: boundedInteger(ownValue(source, "rating"), 0, 100_000),
    side: boundedText(ownValue(source, "side"), 12),
    formatState: sanitizeScrambleFormatState(
      explicitFormatState === undefined ? source : explicitFormatState,
      format
    )
  };
}

function sanitizeScrambleProgress(value) {
  const source = record(value);
  const result = {};
  for (const key of ["remaining", "total", "completed", "depth", "current", "best", "percent"]) {
    const candidate = ownValue(source, key);
    if (candidate !== undefined) result[key] = boundedInteger(candidate, 0, 1_000_000);
  }
  const target = boundedText(ownValue(source, "target"), 48);
  if (target) result.target = target;
  const route = safeArray(ownValue(source, "route"))
    .map((entry) => boundedText(ownValue(record(entry), "word") ?? entry, 48))
    .filter(Boolean)
    .slice(0, 128);
  if (route.length) result.route = route;
  return result;
}

function sanitizeScrambleHistoryStep(value, fallbackMove = 0) {
  const source = record(value);
  const result = sanitizeScrambleWord(
    firstOwnValue(source, ["result", "output"]) ?? source
  );
  const pair = safeArray(ownValue(source, "pair"));
  const a = boundedText(
    ownValue(record(pair[0]), "word") ?? pair[0] ?? firstOwnValue(source, ["a", "left"]),
    48
  );
  const b = boundedText(
    ownValue(record(pair[1]), "word") ?? pair[1] ?? firstOwnValue(source, ["b", "right"]),
    48
  );
  if (!a && !b && !result) return null;
  return {
    move: boundedInteger(ownValue(source, "move") ?? fallbackMove, 0, 10_000),
    a,
    b,
    result
  };
}

export function sanitizeScrambleBoard(value, format = SCRAMBLE_DEFAULT_MODE_ID) {
  const source = record(value);
  const slot = boundedText(firstOwnValue(source, ["slot", "id", "participantSlot"]), 96);
  if (!slot) return null;
  const words = safeArray(firstOwnValue(source, ["words", "discoveries"]))
    .map(sanitizeScrambleWord)
    .filter(Boolean)
    .slice(0, SCRAMBLE_BOARD_WORD_LIMIT);
  const history = safeArray(ownValue(source, "history"))
    .slice(-SCRAMBLE_BOARD_HISTORY_LIMIT)
    .map((step, index) => sanitizeScrambleHistoryStep(step, index + 1))
    .filter(Boolean);
  const explicitFormatState = firstOwnValue(source, ["formatState", "modeState"]);
  return {
    slot,
    revision: boundedInteger(firstOwnValue(source, ["revision", "boardRevision"]), 0, 1_000_000_000),
    words,
    history,
    progress: sanitizeScrambleProgress(ownValue(source, "progress")),
    moves: boundedInteger(ownValue(source, "moves"), 0, 10_000),
    attempts: boundedInteger(ownValue(source, "attempts"), 0, 10_000),
    rejectedAttempts: boundedInteger(ownValue(source, "rejectedAttempts"), 0, 10_000),
    formatState: sanitizeScrambleFormatState(
      explicitFormatState === undefined ? source : explicitFormatState,
      format
    )
  };
}

function normalizeEventType(value) {
  const raw = boundedText(value, 32).toLowerCase().replace(/[\s-]+/g, "_");
  if (EVENT_TYPES.has(raw)) return raw;
  if (["pair_started", "pair_attempted", "combination_attempted", "fusion_attempted", "action"].includes(raw)) return "attempt";
  if (["pair_resolved", "combination_succeeded", "fusion_succeeded", "resolved"].includes(raw)) return "success";
  if (["pair_rejected", "combination_failed", "fusion_rejected", "rejected", "miss"].includes(raw)) return "failure";
  if (["firstlight", "first_discovery"].includes(raw)) return "first_light";
  if (["echo", "steal"].includes(raw)) return "echo_steal";
  if (["riddle_started", "saga_chapter_started"].includes(raw)) return "chapter_started";
  if (["riddle_won", "riddle_solved", "saga_chapter_won"].includes(raw)) return "chapter_won";
  if (["riddle_timeout", "riddle_timed_out", "saga_chapter_timeout", "chapter_timed_out"].includes(raw)) {
    return "chapter_timeout";
  }
  if (["player_disconnected"].includes(raw)) return "disconnect";
  if (["player_reconnected"].includes(raw)) return "reconnect";
  if (["match_finished", "complete", "completed"].includes(raw)) return "finished";
  return "";
}

export function sanitizeScrambleEvent(value, fallbackSequence = 0) {
  const source = record(value);
  let type = normalizeEventType(firstOwnValue(source, ["type", "kind", "event"]));
  const outcome = boundedText(firstOwnValue(source, ["outcome", "status"]), 24).toLowerCase();
  if (type === "attempt" && ["success", "resolved", "complete", "completed"].includes(outcome)) type = "success";
  if (type === "attempt" && ["failure", "failed", "rejected", "missing"].includes(outcome)) type = "failure";
  if (!type) return null;
  const suppliedSequence = firstOwnValue(source, ["sequence", "seq"]);
  const sequence = finiteNumber(suppliedSequence) != null
    ? boundedInteger(suppliedSequence, 0, 1_000_000_000)
    : boundedInteger(fallbackSequence, 0, 1_000_000_000);
  const suppliedRevision = ownValue(source, "revision");
  const revision = finiteNumber(suppliedRevision) != null
    ? boundedInteger(suppliedRevision, 0, 1_000_000_000)
    : sequence;
  const actor = record(firstOwnValue(source, ["actor", "player"]));
  const result = sanitizeScrambleWord(firstOwnValue(source, ["result", "word", "output"]));
  const suppliedPair = ownValue(source, "pair");
  const pair = safeArray(suppliedPair).length
    ? safeArray(suppliedPair)
    : [firstOwnValue(source, ["a", "left"]), firstOwnValue(source, ["b", "right"])];
  const sanitized = {
    id: boundedText(firstOwnValue(source, ["id", "eventId"]), 120) || `${sequence}:${type}`,
    sequence,
    revision,
    type,
    actorId: boundedText(
      firstOwnValue(source, ["actorSlot", "actorId"])
      ?? firstOwnValue(actor, ["slot", "id"]),
      96
    ),
    callsign: boundedText(
      ownValue(source, "callsign") ?? firstOwnValue(actor, ["callsign", "name"]),
      32
    ),
    a: boundedText(ownValue(record(pair[0]), "word") ?? pair[0], 48),
    b: boundedText(ownValue(record(pair[1]), "word") ?? pair[1], 48),
    result,
    reason: boundedText(firstOwnValue(source, ["reason", "message", "error"]), 100),
    createdAt: safeTimestamp(firstOwnValue(source, ["serverAt", "createdAt", "at", "timestamp"])),
    winnerId: boundedText(
      firstOwnValue(source, ["winnerSlot", "winnerId"])
      ?? firstOwnValue(record(ownValue(source, "winner")), ["slot", "id"]),
      96
    ),
    ratingDelta: Math.max(
      -10_000,
      Math.min(10_000, Math.floor(finiteNumber(ownValue(source, "ratingDelta")) || 0))
    ),
    ready: ownValue(source, "ready") === true,
    nextDuelId: boundedText(ownValue(source, "nextDuelId"), 96)
  };
  const classification = ownValue(source, "classification");
  const move = ownValue(source, "move");
  const attempt = ownValue(source, "attempt");
  const boardRevision = ownValue(source, "boardRevision");
  if (classification !== undefined) sanitized.classification = boundedText(classification, 40);
  if (move !== undefined) sanitized.move = boundedInteger(move, 0, 10_000);
  if (attempt !== undefined) sanitized.attempt = boundedInteger(attempt, 0, 10_000);
  if (boardRevision !== undefined) {
    sanitized.boardRevision = boundedInteger(boardRevision, 0, 1_000_000_000);
  }
  const chapterNumber = firstOwnValue(source, ["chapterNumber", "riddleNumber"]);
  const chapterIndex = firstOwnValue(source, ["chapterIndex", "riddleIndex"]);
  const chapterVersion = firstOwnValue(source, ["sagaRevision", "chapterVersion", "chapterRevision", "chapterEpoch"]);
  const chapterPoints = firstOwnValue(source, ["chapterPoints", "points", "value"]);
  if (chapterNumber !== undefined) {
    sanitized.chapterNumber = boundedInteger(chapterNumber, 0, 20);
  } else if (chapterIndex !== undefined) {
    sanitized.chapterNumber = boundedInteger(chapterIndex, 0, 19) + 1;
  }
  if (chapterIndex !== undefined) {
    sanitized.chapterIndex = boundedInteger(chapterIndex, 0, 19);
  } else if (sanitized.chapterNumber) {
    sanitized.chapterIndex = sanitized.chapterNumber - 1;
  }
  if (chapterVersion !== undefined) {
    sanitized.sagaRevision = boundedInteger(chapterVersion, 0, 1_000_000_000);
    sanitized.chapterVersion = sanitized.sagaRevision;
  }
  if (chapterPoints !== undefined) {
    sanitized.chapterPoints = boundedInteger(chapterPoints, 0, 100);
  }
  if (["chapter_started", "chapter_won", "chapter_timeout"].includes(type)) {
    sanitized.chapterTitle = boundedText(firstOwnValue(source, ["chapterTitle", "title"]), 100);
    sanitized.story = boundedText(firstOwnValue(source, ["story", "storyBeat", "narration"]), 280);
    sanitized.chapterTarget = boundedText(
      ownValue(record(ownValue(source, "target")), "word") ?? ownValue(source, "target"),
      48
    );
    sanitized.chapterStatus = boundedText(ownValue(source, "chapterStatus") ?? ownValue(source, "status"), 24);
    sanitized.chapterStartsAt = safeTimestamp(firstOwnValue(source, ["chapterStartsAt", "startsAt"]));
    sanitized.chapterDeadlineAt = safeTimestamp(firstOwnValue(source, ["chapterDeadlineAt", "deadlineAt"]));
    sanitized.finale = ownValue(source, "finale") === true;
  }
  const eventFormatStateKeys = ["actorFormatState", "formatState", "modeState"];
  const actorFormatState = firstOwnValue(source, eventFormatStateKeys)
    ?? firstOwnValue(actor, ["formatState", "modeState"]);
  if (hasAnyOwnValue(source, eventFormatStateKeys) || hasAnyOwnValue(actor, ["formatState", "modeState"])) {
    sanitized.actorFormatState = actorFormatState == null
      ? null
      : sanitizeScrambleFormatState(
          actorFormatState,
          firstOwnValue(source, ["format", "formatId", "scrambleMode"])
        );
  }
  return sanitized;
}

function emptyMetrics() {
  return {
    attempts: 0,
    successes: 0,
    failures: 0,
    firstLights: 0,
    echoSteals: 0,
    intercepts: 0
  };
}

export function createScrambleState(seed = {}) {
  const source = record(seed);
  const format = formatFromSource(source);
  const definition = modeDefinition(format);
  const suppliedRules = firstOwnValue(source, ["rules", "formatRules", "modeRules"]);
  const suppliedConfig = firstOwnValue(source, ["config", "formatConfig", "modeConfig"]);
  const rules = sanitizeScrambleRules(suppliedRules ?? suppliedConfig, format);
  const config = sanitizeScrambleRules(suppliedConfig ?? suppliedRules, format);
  const rawObjective = ownValue(source, "objective");
  const objective = boundedText(
    firstOwnValue(record(rawObjective), ["label", "text", "description"]) ?? rawObjective,
    180
  ) || definition?.objective || "";
  return {
    id: boundedText(firstOwnValue(source, ["id", "matchId"]), 96),
    status: boundedText(ownValue(source, "status"), 24).toLowerCase() || "idle",
    ranked: ownValue(source, "ranked") === true
      || ownValue(source, "kind") === "ranked"
      || ownValue(source, "mode") === "ranked",
    revision: boundedInteger(ownValue(source, "revision"), 0, 1_000_000_000),
    lastSequence: 0,
    format,
    formatVersion: safeVersion(
      firstOwnValue(source, ["formatVersion", "modeVersion"]),
      definition?.rulesVersion || 1
    ),
    rulesVersion: safeVersion(ownValue(source, "rulesVersion"), definition?.rulesVersion || 1),
    objective,
    rules,
    config,
    target: boundedText(
      ownValue(record(ownValue(source, "target")), "word") ?? ownValue(source, "target"),
      48
    ),
    startsAt: safeTimestamp(ownValue(source, "startsAt")),
    deadlineAt: safeTimestamp(ownValue(source, "deadlineAt")),
    durationSeconds: ownValue(source, "durationSeconds") == null
      ? boundedInteger(config.durationSeconds, 1, 60 * 60) || SCRAMBLE_MATCH_SECONDS
      : boundedInteger(ownValue(source, "durationSeconds"), 1, 60 * 60),
    selfId: boundedText(
      firstOwnValue(source, ["selfSlot", "selfId"])
      ?? firstOwnValue(record(ownValue(source, "you")), ["slot", "id"]),
      96
    ),
    players: [],
    starters: [],
    boards: [],
    events: [],
    metrics: {},
    winnerId: boundedText(firstOwnValue(source, ["winnerSlot", "winnerId"]), 96),
    finishReason: boundedText(ownValue(source, "finishReason"), 100),
    formatResult: sanitizeScrambleFormatResult(ownValue(source, "formatResult"), format),
    saga: sanitizeScrambleSaga(ownValue(source, "saga")),
    rating: record(ownValue(source, "rating")),
    rematch: record(ownValue(source, "rematch")),
    nextDuelId: boundedText(
      ownValue(source, "nextDuelId") ?? ownValue(record(ownValue(source, "rematch")), "nextDuelId"),
      96
    )
  };
}

function computeMetrics(events, players) {
  const metrics = Object.fromEntries(players.map((player) => [player.id, emptyMetrics()]));
  for (const event of events) {
    if (!event.actorId) continue;
    metrics[event.actorId] ||= emptyMetrics();
    const value = metrics[event.actorId];
    if (event.type === "attempt") value.attempts += 1;
    if (event.type === "success") {
      value.successes += 1;
      if (!events.some((candidate) => candidate.sequence < event.sequence && candidate.actorId === event.actorId
        && candidate.type === "attempt" && candidate.a === event.a && candidate.b === event.b)) {
        value.attempts += 1;
      }
    }
    if (event.type === "failure") {
      value.failures += 1;
      if (!events.some((candidate) => candidate.sequence < event.sequence && candidate.actorId === event.actorId
        && candidate.type === "attempt" && candidate.a === event.a && candidate.b === event.b)) {
        value.attempts += 1;
      }
    }
    if (event.type === "first_light") value.firstLights += 1;
    if (event.type === "echo_steal") value.echoSteals += 1;
    if (event.type === "intercept") value.intercepts += 1;
  }
  return metrics;
}

function appendEvents(current, incoming) {
  const events = [...current];
  const known = new Set(events.map((event) => event.id));
  for (const raw of Array.isArray(incoming) ? incoming : []) {
    const event = sanitizeScrambleEvent(raw, events.length ? events.at(-1).sequence + 1 : 1);
    if (!event || known.has(event.id)) continue;
    known.add(event.id);
    events.push(event);
  }
  events.sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  return events.slice(-SCRAMBLE_EVENT_LIMIT);
}

export function reduceScrambleSnapshot(previous, payload) {
  const current = previous && record(previous) === previous ? previous : createScrambleState();
  const envelope = record(payload);
  const wrapped = firstOwnValue(envelope, ["snapshot", "match", "duel"]);
  const source = record(wrapped === undefined ? envelope : wrapped);
  const suppliedRevision = ownValue(envelope, "revision") ?? ownValue(source, "revision");
  const revision = finiteNumber(suppliedRevision) != null
    ? boundedInteger(suppliedRevision, 0, 1_000_000_000)
    : current.revision;
  if (revision && revision < current.revision) return previous;

  const format = formatFromSource(source, current.format);
  const definition = modeDefinition(format);
  const changedFormat = format !== current.format;
  const suppliedRules = firstOwnValue(source, ["rules", "formatRules", "modeRules"]);
  const suppliedConfig = firstOwnValue(source, ["config", "formatConfig", "modeConfig"]);
  const ruleFallback = changedFormat ? definition?.config : current.rules;
  const configFallback = changedFormat ? definition?.config : current.config;
  const rules = sanitizeScrambleRules(suppliedRules ?? suppliedConfig, format, ruleFallback);
  const config = sanitizeScrambleRules(suppliedConfig ?? suppliedRules, format, configFallback);

  const boardsSource = firstOwnValue(source, ["boards", "authoritativeBoards"]);
  const suppliedBoards = boardsSource !== undefined;
  const sanitizedBoards = safeArray(boardsSource)
    .map((board) => sanitizeScrambleBoard(board, format))
    .filter(Boolean)
    .slice(0, 2);
  const boards = suppliedBoards ? sanitizedBoards : safeArray(current.boards);

  const playersSource = firstOwnValue(source, ["players", "participants"]);
  const rawPlayers = safeArray(playersSource).slice(0, 2);
  const players = rawPlayers
    .map((player) => {
      const clean = sanitizeScramblePlayer(player, format);
      if (!clean) return null;
      const explicitModeState = hasAnyOwnValue(player, [
        "formatState", "modeState", "score", "points", "quota", "discoveryQuota",
        "claimQuota", "turnsLeft", "remainingTurns", "turnLimit", "maxTurns",
        "champion", "contender", "depth", "buildDepth", "claims", "uniqueClaims"
      ]);
      if (!explicitModeState) {
        const boardState = boards.find((board) => board.slot === clean.id)?.formatState;
        const previousState = safeArray(current.players)
          .find((candidate) => candidate?.id === clean.id)?.formatState;
        clean.formatState = boardState || previousState || clean.formatState;
      }
      return clean;
    })
    .filter(Boolean);
  const startersSource = firstOwnValue(source, ["starterItems", "starters"]);
  const starters = safeArray(startersSource)
    .map(sanitizeScrambleWord)
    .filter(Boolean)
    .slice(0, 24);
  const incomingEvents = [
    ...safeArray(ownValue(source, "events")),
    ...(source === envelope ? [] : safeArray(ownValue(envelope, "events"))),
    ...(ownValue(envelope, "event") !== undefined ? [ownValue(envelope, "event")] : [])
  ];
  const events = appendEvents(
    safeArray(current.events),
    incomingEvents
  );
  const finished = events.findLast((event) => event.type === "finished");
  const nextPlayers = (players.length ? players : safeArray(current.players))
    .map((player) => ({ ...player }));
  for (const event of events) {
    if (!["disconnect", "reconnect"].includes(event.type)) continue;
    const player = nextPlayers.find((candidate) => candidate.id === event.actorId);
    if (player) player.connected = event.type === "reconnect";
  }
  let ratingSource = record(
    firstOwnValue(source, ["rating", "ratingReceipt"])
    ?? firstOwnValue(envelope, ["rating", "ratingReceipt"])
  );
  const suppliedRatingDelta = ownValue(source, "ratingDelta") ?? ownValue(envelope, "ratingDelta");
  if (!hasOwnDataProperties(ratingSource) && finiteNumber(suppliedRatingDelta) != null) {
    ratingSource = { delta: finiteNumber(suppliedRatingDelta) };
  }
  const rematchSource = record(ownValue(source, "rematch") ?? ownValue(envelope, "rematch"));
  const eventNextDuelId = [...events].reverse().find((event) => event.nextDuelId)?.nextDuelId || "";
  const rawObjective = ownValue(source, "objective");
  const suppliedObjective = boundedText(
    firstOwnValue(record(rawObjective), ["label", "text", "description"]) ?? rawObjective,
    180
  );
  const targetValue = ownValue(source, "target");
  const suppliedSaga = ownValue(source, "saga");
  const saga = suppliedSaga === undefined
    ? sanitizeScrambleSaga(current.saga)
    : sanitizeScrambleSaga(suppliedSaga, current.saga);
  const eventRevision = events.reduce(
    (maximum, event) => Math.max(maximum, boundedInteger(event.revision, 0, 1_000_000_000)),
    0
  );
  const eventSequence = events.reduce(
    (maximum, event) => Math.max(maximum, boundedInteger(event.sequence, 0, 1_000_000_000)),
    0
  );
  const next = {
    ...current,
    id: boundedText(firstOwnValue(source, ["id", "matchId"]), 96) || current.id,
    status: finished
      ? "finished"
      : boundedText(ownValue(source, "status"), 24).toLowerCase() || current.status,
    ranked: typeof ownValue(source, "ranked") === "boolean"
      ? ownValue(source, "ranked")
      : ownValue(source, "kind") === "ranked"
        || ownValue(source, "mode") === "ranked"
        || current.ranked,
    revision: Math.max(current.revision, revision, eventRevision),
    lastSequence: Math.max(current.lastSequence, eventSequence),
    format,
    formatVersion: safeVersion(
      firstOwnValue(source, ["formatVersion", "modeVersion"]),
      changedFormat ? definition?.rulesVersion || 1 : current.formatVersion
    ),
    rulesVersion: safeVersion(
      ownValue(source, "rulesVersion"),
      changedFormat ? definition?.rulesVersion || 1 : current.rulesVersion
    ),
    objective: suppliedObjective || (changedFormat ? definition?.objective || "" : current.objective),
    rules,
    config,
    target: boundedText(ownValue(record(targetValue), "word") ?? targetValue, 48)
      || (changedFormat ? "" : current.target),
    startsAt: safeTimestamp(ownValue(source, "startsAt")) || current.startsAt,
    deadlineAt: safeTimestamp(ownValue(source, "deadlineAt")) || current.deadlineAt,
    durationSeconds: ownValue(source, "durationSeconds") == null
      ? changedFormat
        ? boundedInteger(config.durationSeconds, 1, 60 * 60) || SCRAMBLE_MATCH_SECONDS
        : current.durationSeconds
      : boundedInteger(ownValue(source, "durationSeconds"), 1, 60 * 60),
    selfId: boundedText(
      firstOwnValue(envelope, ["selfSlot", "selfId"])
      ?? firstOwnValue(source, ["selfSlot", "selfId"])
      ?? firstOwnValue(record(ownValue(source, "you")), ["slot", "id"]),
      96
    ) || current.selfId,
    players: nextPlayers,
    starters: starters.length ? starters : current.starters,
    boards,
    events,
    winnerId: boundedText(
      firstOwnValue(source, ["winnerSlot", "winnerId"])
      ?? firstOwnValue(record(ownValue(source, "winner")), ["slot", "id"])
      ?? finished?.winnerId,
      96
    ) || current.winnerId,
    finishReason: boundedText(
      firstOwnValue(source, ["finishReason", "reason"]) ?? finished?.reason,
      100
    ) || current.finishReason,
    formatResult: ownValue(source, "formatResult") !== undefined
      ? sanitizeScrambleFormatResult(ownValue(source, "formatResult"), format)
      : changedFormat
        ? sanitizeScrambleFormatResult(null, format)
        : current.formatResult,
    saga: changedFormat && suppliedSaga === undefined
      ? sanitizeScrambleSaga(null)
      : saga,
    rating: hasOwnDataProperties(ratingSource) ? ratingSource : current.rating,
    rematch: hasOwnDataProperties(rematchSource) ? rematchSource : current.rematch,
    nextDuelId: boundedText(
      ownValue(source, "nextDuelId")
      ?? ownValue(envelope, "nextDuelId")
      ?? ownValue(rematchSource, "nextDuelId")
      ?? eventNextDuelId,
      96
    ) || current.nextDuelId
  };
  next.metrics = computeMetrics(next.events, next.players);
  return next;
}

export function scramblePlayerPair(state) {
  const source = record(state);
  const players = safeArray(ownValue(source, "players"));
  const selfId = boundedText(ownValue(source, "selfId"), 96);
  const self = players.find((player) => player?.id === selfId) || players[0] || null;
  const rival = players.find((player) => player.id !== self?.id) || null;
  return { self, rival };
}

export function scrambleClockSeconds(state, now = Date.now()) {
  if (!state) return SCRAMBLE_MATCH_SECONDS;
  const source = record(state);
  const deadline = Date.parse(boundedText(ownValue(source, "deadlineAt"), 64));
  if (Number.isFinite(deadline)) return Math.max(0, Math.ceil((deadline - now) / 1000));
  const start = Date.parse(boundedText(ownValue(source, "startsAt"), 64));
  const duration = boundedInteger(ownValue(source, "durationSeconds"), 1, 60 * 60)
    || SCRAMBLE_MATCH_SECONDS;
  if (!Number.isFinite(start)) return duration;
  return Math.max(0, duration - Math.floor((now - start) / 1000));
}

export function formatScrambleClock(seconds) {
  const safe = boundedInteger(seconds, 0, 60 * 60);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function formatLabel(format) {
  return modeDefinition(format)?.label || "Target Race";
}

function normalizedFinishReason(reason) {
  return boundedText(reason, 100).toLowerCase().replace(/[\s-]+/g, "_");
}

export function scrambleFinishReasonText(
  reason,
  { format = SCRAMBLE_DEFAULT_MODE_ID, won = false, tied = false } = {}
) {
  const safeFormat = scrambleFormat(format);
  const code = normalizedFinishReason(reason);
  if (!code || code === "finished" || code === "complete" || code === "completed") {
    if (safeFormat === "wordstorm") return "The Wordstorm is complete.";
    if (safeFormat === "forge-clash") return "The Forge Clash is complete.";
    if (safeFormat === "claim-war") return "The Claim War is complete.";
    if (safeFormat === "riddle-saga") return "The final chapter is complete.";
    return "The Target Race is complete.";
  }
  if (["target_reached", "target_created", "goal_reached"].includes(code)) {
    return "The shared target was created.";
  }
  if (["quota_reached", "discovery_quota", "wordstorm_quota", "wordstorm_quota_reached"].includes(code)) {
    return "The discovery quota was reached.";
  }
  if (["claim_quota", "claim_quota_reached"].includes(code)) {
    return "The pairing-claim quota was reached.";
  }
  if (["saga_complete", "riddle_saga_complete", "all_chapters_complete"].includes(code)) {
    return tied ? "The saga ended with both scores level." : "The final riddle decided the saga.";
  }
  if (["time_limit_score", "time_limit_points", "score_lead"].includes(code)) {
    return tied ? "Time expired with the scores level." : "Time expired; the higher score won.";
  }
  if (code === "time_limit_accuracy") return "Time expired; accuracy broke the tied score.";
  if (code === "time_limit_progress") return "Time expired; the closest route won.";
  if (["time_limit_draw", "timeout_draw"].includes(code)) return "Time expired with both players level.";
  if (["turn_limit", "turn_limit_clash", "forge_resolved", "forge_clash"].includes(code)) {
    return "The crafting turns ended and the champions clashed.";
  }
  if (["category_counter", "forge_category_counter", "turn_limit_category_counter"].includes(code)) {
    return "The category counter decided the clash.";
  }
  if (["build_depth", "forge_build_depth", "turn_limit_build_depth"].includes(code)) {
    return "The deeper-built champion won the clash.";
  }
  if (["equal_force", "forge_equal_force", "turn_limit_equal_force"].includes(code)) {
    return "The champions met with equal force.";
  }
  if (["no_champions", "forge_no_champions", "turn_limit_no_champions"].includes(code)) {
    return "Neither player forged a champion.";
  }
  if (["only_champion", "forge_only_champion", "turn_limit_only_champion"].includes(code)) {
    return "Only one champion reached the arena.";
  }
  if (["forfeit", "player_forfeit"].includes(code)) {
    return won ? "Your rival forfeited the match." : "The match ended by forfeit.";
  }
  if (code === "disconnect_forfeit") return "The match ended after a connection timeout.";
  if (code === "both_disconnected") return "Both players lost connection.";
  if (code === "invite_expired") return "The private invitation expired.";
  if (code === "player_data_deleted") return "The match ended because a player left the service.";
  const copy = code.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  return copy ? `${copy.charAt(0).toUpperCase()}${copy.slice(1)}.` : `${formatLabel(safeFormat)} complete.`;
}

export function scrambleEventSentence(
  event,
  { selfId = "", format = SCRAMBLE_DEFAULT_MODE_ID } = {}
) {
  const value = sanitizeScrambleEvent(event);
  if (!value) return "";
  const safeFormat = scrambleFormat(format);
  const who = value.actorId && value.actorId === selfId ? "You" : value.callsign || "Your rival";
  const pair = value.a && value.b ? `${value.a} + ${value.b}` : "a pairing";
  if (value.type === "attempt") return `${who} tried ${pair}.`;
  if (value.type === "success") {
    const result = value.result?.word || "a new word";
    if (safeFormat === "wordstorm" && value.actorFormatState) {
      return `${who} made ${result} from ${pair}. Score: ${value.actorFormatState.score}.`;
    }
    if (safeFormat === "forge-clash" && value.actorFormatState) {
      const turns = value.actorFormatState.turnsLeft;
      return `${who} forged ${result} from ${pair}. ${turns} ${turns === 1 ? "turn" : "turns"} left.`;
    }
    if (safeFormat === "claim-war") return `${who} claimed ${result} from ${pair}.`;
    return `${who} made ${result} from ${pair}.`;
  }
  if (value.type === "failure") return `${who} tried ${pair}. No match.`;
  if (value.type === "first_light") {
    return safeFormat === "wordstorm"
      ? `${who} claimed First Light and its score bonus.`
      : `${who} claimed First Light.`;
  }
  if (value.type === "echo_steal") return `${who} echoed a rival discovery.`;
  if (value.type === "intercept") return `${who} intercepted the same pairing.`;
  if (value.type === "lead_change") return `${who} took the lead.`;
  if (value.type === "chapter_started") {
    const number = value.chapterNumber || 1;
    const points = value.chapterPoints || 0;
    return `Chapter ${number} has begun${points ? ` for ${points} ${points === 1 ? "point" : "points"}` : ""}.`;
  }
  if (value.type === "chapter_won") {
    const number = value.chapterNumber || 1;
    const points = value.chapterPoints || 0;
    return `${who} solved chapter ${number}${points ? ` and earned ${points} ${points === 1 ? "point" : "points"}` : ""}.`;
  }
  if (value.type === "chapter_timeout") {
    return `Chapter ${value.chapterNumber || 1} ended without an answer.`;
  }
  if (value.type === "disconnect") return `${who} lost connection.`;
  if (value.type === "reconnect") return `${who} reconnected.`;
  if (value.type === "finished") {
    const won = Boolean(selfId && value.winnerId === selfId);
    const tied = !value.winnerId;
    if (safeFormat === SCRAMBLE_DEFAULT_MODE_ID && !value.reason) {
      return won ? "You won the scramble." : "The scramble has ended.";
    }
    const outcome = tied
      ? `${formatLabel(safeFormat)} ended in a draw.`
      : won ? `You won the ${formatLabel(safeFormat)}.` : `${formatLabel(safeFormat)} has ended.`;
    return `${outcome} ${scrambleFinishReasonText(value.reason, { format: safeFormat, won, tied })}`;
  }
  return "";
}

export function scrambleResultPresentation(state) {
  const source = record(state);
  const format = scrambleFormat(ownValue(source, "format"));
  const definition = modeDefinition(format);
  const { self, rival } = scramblePlayerPair(state);
  const winnerId = boundedText(ownValue(source, "winnerId"), 96);
  const won = Boolean(self?.id && winnerId === self.id);
  const tied = !winnerId;
  const metrics = record(ownValue(source, "metrics"));
  const selfMetricSource = record(ownValue(metrics, self?.id));
  const rivalMetricSource = record(ownValue(metrics, rival?.id));
  const selfMetrics = hasOwnDataProperties(selfMetricSource) ? selfMetricSource : emptyMetrics();
  const rivalMetrics = hasOwnDataProperties(rivalMetricSource) ? rivalMetricSource : emptyMetrics();
  const ratingSource = record(ownValue(source, "rating"));
  const ratingDelta = Math.max(-10_000, Math.min(
    10_000,
    Math.floor(finiteNumber(firstOwnValue(ratingSource, ["delta", "change", "selfDelta"])) || 0)
  ));
  const selfFormatState = sanitizeScrambleFormatState(self?.formatState, format);
  const rivalFormatState = sanitizeScrambleFormatState(rival?.formatState, format);
  let title;
  if (format === "wordstorm") {
    title = tied
      ? "Wordstorm draw"
      : won ? "You won the Wordstorm" : `${rival?.callsign || "Your rival"} won the Wordstorm`;
  } else if (format === "forge-clash") {
    title = tied
      ? "The champions stand equal"
      : won ? "Your champion prevailed" : `${rival?.callsign || "Your rival"} forged the winner`;
  } else if (format === "claim-war") {
    title = tied
      ? "Claim War draw"
      : won ? "You claimed the board" : `${rival?.callsign || "Your rival"} claimed the board`;
  } else if (format === "riddle-saga") {
    title = tied
      ? "The saga ends level"
      : won ? "You wrote the winning ending" : `${rival?.callsign || "Your rival"} won the saga`;
  } else {
    title = tied
      ? "Starlight draw"
      : won ? "You reached it first" : `${rival?.callsign || "Your rival"} reached it first`;
  }
  const ranked = ownValue(source, "ranked") === true;
  const modeLabel = definition?.label || "Target Race";
  const kicker = format === SCRAMBLE_DEFAULT_MODE_ID
    ? ranked ? "RANKED CONSTELLATION SCRAMBLE" : "PRIVATE CONSTELLATION SCRAMBLE"
    : `${ranked ? "RANKED" : "PRIVATE"} ${modeLabel.toUpperCase()}`;
  const finishReason = boundedText(ownValue(source, "finishReason"), 100);
  return {
    won,
    tied,
    format,
    modeLabel,
    objective: boundedText(ownValue(source, "objective"), 180) || definition?.objective || "",
    kicker,
    title,
    selfMetrics,
    rivalMetrics,
    selfFormatState,
    rivalFormatState,
    saga: sanitizeScrambleSaga(ownValue(source, "saga")),
    formatResult: sanitizeScrambleFormatResult(ownValue(source, "formatResult"), format),
    finishReasonLabel: scrambleFinishReasonText(finishReason, { format, won, tied }),
    ratingDelta,
    ratingLabel: ranked
      ? `${format === SCRAMBLE_DEFAULT_MODE_ID ? "Duel" : modeLabel} Rating ${ratingDelta > 0 ? "+" : ""}${ratingDelta}`
      : "Private match \u00b7 no rating"
  };
}

export function scrambleShareText(state, url = "") {
  const source = record(state);
  const { self, rival } = scramblePlayerPair(state);
  const result = scrambleResultPresentation(state);
  if (result.format === SCRAMBLE_DEFAULT_MODE_ID) {
    const legacyOutcome = result.tied ? "drew" : result.won ? "won" : "raced";
    return [
      `I ${legacyOutcome} a Constellation Scramble${rival ? ` against ${rival.callsign}` : ""}.`,
      ownValue(source, "target") ? `Target: ${boundedText(ownValue(source, "target"), 48)}.` : "",
      "Every pairing was visible. Can you reach it first?",
      boundedText(url, 500)
    ].filter(Boolean).join(" ");
  }
  const outcome = result.tied ? "drew" : result.won ? "won" : "played";
  let challenge;
  if (result.format === "wordstorm") {
    challenge = `Score: ${result.selfFormatState.score}\u2013${result.rivalFormatState.score}. Every discovery was visible.`;
  } else if (result.format === "forge-clash") {
    const champion = result.selfFormatState.champion;
    challenge = champion
      ? `My champion was ${champion.word} (${champion.category || "wild"}, power ${champion.power}). What would you forge?`
      : "Six turns to forge a champion. What would you build?";
  } else if (result.format === "claim-war") {
    challenge = `Claims: ${result.selfFormatState.claims}\u2013${result.rivalFormatState.claims}. Can you seize the board?`;
  } else if (result.format === "riddle-saga") {
    const saga = sanitizeScrambleSaga(ownValue(source, "saga"));
    const selfScore = saga.scores.find((score) => score.slot === self?.id)?.score || 0;
    const rivalScore = saga.scores.find((score) => score.slot === rival?.id)?.score || 0;
    challenge = `Riddle score: ${selfScore}\u2013${rivalScore}. The finale was worth two.`;
  } else {
    challenge = "Every pairing was visible. Can you reach it first?";
  }
  return [
    `I ${outcome} a ${result.modeLabel}${rival ? ` against ${rival.callsign}` : ""}.`,
    challenge,
    boundedText(url, 500)
  ].filter(Boolean).join(" ");
}
