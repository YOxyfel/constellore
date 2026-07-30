import { randomBytes, randomUUID } from "node:crypto";
import {
  DUEL_SEASON_ID,
  sanitizeDuelEligibility,
  sanitizeDuelRating,
  serviceError
} from "./game-services.mjs";
import {
  SCRAMBLE_DEFAULT_MODE_ID,
  applyScrambleModeRating,
  getScrambleModeDefinition,
  listScrambleModeDefinitions,
  normalizeScrambleModeId,
  publicScrambleArenaSnapshot,
  sanitizeScrambleArena,
  sanitizeScrambleModeRating,
  scrambleRatingForMode
} from "./public/scramble-arena.mjs";
import { resolveForgeClash, selectForgeChampion } from "./public/forge-clash.mjs";
import {
  RIDDLE_SAGA_CHAPTER_COUNT,
  RIDDLE_SAGA_CHAPTER_POINTS,
  RIDDLE_SAGA_FORMAT_ID,
  RIDDLE_SAGA_INTERMISSION_SECONDS,
  RIDDLE_SAGA_VERSION,
  riddleSagaChapterDurationMs,
  riddleSagaScoreWinner,
  selectRiddleSagaArc
} from "./riddle-saga.mjs";

export const DUEL_COUNTDOWN_MS = 3_000;
export const DUEL_DURATION_MS = 5 * 60_000;
export const DUEL_INVITE_TTL_MS = 15 * 60_000;
export const DUEL_QUEUE_TTL_MS = 90_000;
export const DUEL_DISCONNECT_AFTER_MS = 18_000;
export const DUEL_RECONNECT_GRACE_MS = 30_000;
export const DUEL_INTERCEPT_MS = 1_500;

const FINISHED_DUEL_RETENTION_MS = 24 * 60 * 60_000;
const RATED_PAIR_WINDOW_MS = 24 * 60 * 60_000;
const MAX_RATED_PAIR_RESULTS = 3;
const MAX_EVENTS = 512;
const MAX_RESULTS = 5_000;
const ACTION_ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;
const INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]{24,160}$/;
const ACTIVE_STATUSES = new Set(["waiting", "countdown", "active"]);
const SCRAMBLE_XP = Object.freeze({ win: 40, draw: 24, loss: 16 });
const SCRAMBLE_XP_PER_LEVEL = 250;

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function iso(timestamp) {
  const value = Number(timestamp);
  return Number.isFinite(value) && value > 0 ? new Date(value).toISOString() : null;
}

function milliseconds(value) {
  if (Number.isFinite(Number(value))) return Math.max(0, Math.floor(Number(value)));
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionId(value) {
  const id = String(value || "").trim();
  if (!ACTION_ID_PATTERN.test(id)) {
    throw serviceError(400, "Duel action IDs must be 8-100 letters, numbers, dashes, or underscores.", "invalid_duel_action_id");
  }
  return id;
}

function cleanWord(value) {
  const word = String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!word || word.length > 48 || !/^[\p{L}\p{N}][\p{L}\p{N} '&-]*$/u.test(word)) {
    throw serviceError(400, "Choose two short recognizable words.", "invalid_duel_pair");
  }
  return word;
}

function pairKey(a, b) {
  return [a, b]
    .map((word) => String(word || "").normalize("NFKC").trim().toLocaleLowerCase("en-US"))
    .sort()
    .join("+");
}

function scrambleMode(value, { requireEnabled = true } = {}) {
  const modeId = normalizeScrambleModeId(value);
  const definition = modeId ? getScrambleModeDefinition(modeId) : null;
  if (!definition || requireEnabled && !definition.enabled) {
    throw serviceError(422, "That Scramble mode is not available yet.", "scramble_mode_unavailable");
  }
  return definition;
}

function storedScrambleMode(value) {
  const modeId = normalizeScrambleModeId(value);
  const definition = modeId ? getScrambleModeDefinition(modeId) : null;
  return definition?.enabled
    ? definition
    : getScrambleModeDefinition(SCRAMBLE_DEFAULT_MODE_ID);
}

function modeDurationMs(duel) {
  const definition = storedScrambleMode(duel?.format);
  if (definition.id === RIDDLE_SAGA_FORMAT_ID) {
    return riddleSagaChapterDurationMs(duel?.saga?.chapterIndex || 0);
  }
  return Math.max(1, Math.floor(Number(definition.config.durationSeconds) || 300)) * 1_000;
}

function starterCount(game) {
  return new Set((Array.isArray(game?.starters) ? game.starters : [])
    .map((entry) => String(entry?.word || entry || "").trim().toLocaleLowerCase("en-US"))
    .filter(Boolean)).size;
}

function publicChampion(value) {
  if (!value || typeof value !== "object") return null;
  return {
    word: String(value.word || "").slice(0, 48),
    emoji: String(value.emoji || "\u2726").slice(0, 12),
    category: String(value.category || "").slice(0, 32),
    power: Math.max(0, Math.min(64, Math.floor(Number(value.power) || 0)))
  };
}

function publicFormatState(value) {
  const source = asRecord(value);
  return {
    score: Math.max(0, Math.min(10_000, Math.floor(Number(source.score) || 0))),
    quota: Math.max(0, Math.min(1_000, Math.floor(Number(source.quota) || 0))),
    turnsLeft: Math.max(0, Math.min(1_000, Math.floor(Number(source.turnsLeft) || 0))),
    turnLimit: Math.max(0, Math.min(1_000, Math.floor(Number(source.turnLimit) || 0))),
    champion: publicChampion(source.champion),
    depth: Math.max(0, Math.min(64, Math.floor(Number(source.depth) || 0))),
    discoveries: Math.max(0, Math.min(10_000, Math.floor(Number(source.discoveries) || 0))),
    attempts: Math.max(0, Math.min(10_000, Math.floor(Number(source.attempts) || 0))),
    claims: Math.max(0, Math.min(10_000, Math.floor(Number(source.claims) || 0))),
    remaining: Math.max(0, Math.min(10_000, Math.floor(Number(source.remaining) || 0))),
    rank: Math.max(0, Math.min(10_000, Math.floor(Number(source.rank) || 0))),
    locked: source.locked === true,
    complete: source.complete === true
  };
}

function boundedSagaText(value, maximum = 120) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maximum);
}

function sagaScoreMap(value) {
  const source = asRecord(value);
  return {
    "slot-a": Math.max(0, Math.min(6, Math.floor(Number(source["slot-a"]) || 0))),
    "slot-b": Math.max(0, Math.min(6, Math.floor(Number(source["slot-b"]) || 0)))
  };
}

function normalizeSagaRunIds(value) {
  const source = asRecord(value);
  return {
    "slot-a": boundedSagaText(source["slot-a"], 80),
    "slot-b": boundedSagaText(source["slot-b"], 80)
  };
}

function normalizeStoredSaga(value) {
  const source = asRecord(value);
  const chapters = (Array.isArray(source.chapters) ? source.chapters : [])
    .slice(0, RIDDLE_SAGA_CHAPTER_COUNT)
    .map((raw, index) => {
      const chapter = asRecord(raw);
      const game = clone(chapter.game);
      if (!game?.target || !Array.isArray(game.starters)) return null;
      return {
        index,
        number: index + 1,
        chapterPoints: RIDDLE_SAGA_CHAPTER_POINTS[index],
        title: boundedSagaText(chapter.title, 72),
        story: boundedSagaText(chapter.story, 180),
        target: boundedSagaText(game.target, 48),
        game,
        solutionRoute: (Array.isArray(chapter.solutionRoute) ? chapter.solutionRoute : [])
          .map((step) => clone(step))
          .slice(0, 64),
        challengeIdentity: clone(chapter.challengeIdentity || null),
        runIds: normalizeSagaRunIds(chapter.runIds),
        status: ["pending", "playing", "won", "timed_out"].includes(chapter.status)
          ? chapter.status
          : "pending",
        startsAt: chapter.startsAt == null ? null : milliseconds(chapter.startsAt),
        deadlineAt: chapter.deadlineAt == null ? null : milliseconds(chapter.deadlineAt),
        winnerPlayerId: boundedSagaText(chapter.winnerPlayerId, 80),
        winnerSlot: ["slot-a", "slot-b"].includes(chapter.winnerSlot) ? chapter.winnerSlot : "",
        settledAt: chapter.settledAt == null ? null : milliseconds(chapter.settledAt)
      };
    })
    .filter(Boolean);
  if (chapters.length !== RIDDLE_SAGA_CHAPTER_COUNT) return null;
  const chapterIndex = Math.max(
    0,
    Math.min(RIDDLE_SAGA_CHAPTER_COUNT - 1, Math.floor(Number(source.chapterIndex) || 0))
  );
  return {
    version: RIDDLE_SAGA_VERSION,
    arcId: boundedSagaText(source.arcId, 48),
    arcTitle: boundedSagaText(source.arcTitle, 72),
    status: ["playing", "intermission", "complete"].includes(source.status)
      ? source.status
      : "playing",
    chapterIndex,
    chapterVersion: Math.max(1, Math.floor(Number(source.chapterVersion) || 1)),
    nextChapterAt: source.nextChapterAt == null ? null : milliseconds(source.nextChapterAt),
    scores: sagaScoreMap(source.scores),
    chapters
  };
}

function publicResult(result) {
  if (!result || typeof result !== "object") return null;
  return {
    word: String(result.word || "").slice(0, 48),
    emoji: String(result.emoji || "✦").slice(0, 12),
    category: String(result.category || "").slice(0, 32),
    source: "world",
    note: String(result.note || "").slice(0, 120),
    provisional: false,
    recipeStatus: "verified",
    progressionEligible: false,
    eventEligible: false,
    newDiscovery: false,
    scoringDisabled: true,
    scoreEligible: false
  };
}

function normalizeParticipant(value) {
  const source = asRecord(value);
  const playerId = String(source.playerId || "");
  const runId = String(source.runId || "");
  if (!playerId || !runId) return null;
  return {
    playerId,
    slot: source.slot === "slot-b" ? "slot-b" : "slot-a",
    callsign: String(source.callsign || "STARGAZER").slice(0, 32),
    runId,
    ready: source.ready === true,
    revision: Math.max(0, Math.floor(Number(source.revision) || 0)),
    joinedAt: milliseconds(source.joinedAt),
    lastSeenAt: milliseconds(source.lastSeenAt),
    disconnectedAt: source.disconnectedAt == null ? null : milliseconds(source.disconnectedAt),
    lastActionAt: milliseconds(source.lastActionAt)
  };
}

function normalizeStoredDuel(value, id) {
  const source = asRecord(value);
  const mode = storedScrambleMode(source.format || source.mode || source.game?.scrambleFormat);
  const saga = mode.id === RIDDLE_SAGA_FORMAT_ID
    ? normalizeStoredSaga(source.saga)
    : null;
  const participants = (Array.isArray(source.participants) ? source.participants : [])
    .map(normalizeParticipant)
    .filter(Boolean)
    .slice(0, 2);
  if (
    !participants.length
    || !source.game
    || typeof source.game !== "object"
    || mode.id === RIDDLE_SAGA_FORMAT_ID && !saga
  ) return null;
  if (saga) {
    const activeChapter = saga.chapters[saga.chapterIndex];
    for (const participant of participants) {
      const chapterRunId = activeChapter?.runIds?.[participant.slot];
      if (chapterRunId) participant.runId = chapterRunId;
    }
  }
  return {
    id,
    kind: ["public", "rematch"].includes(source.kind) ? source.kind : "invite",
    format: mode.id,
    formatVersion: Math.max(1, Math.floor(Number(source.formatVersion || source.rulesVersion || mode.rulesVersion) || 1)),
    rules: clone(source.rules || mode.config),
    objective: String(source.objective || mode.objective).slice(0, 180),
    rated: source.rated === true,
    visibility: "open",
    status: ["waiting", "countdown", "active", "finished", "cancelled"].includes(source.status)
      ? source.status
      : "cancelled",
    inviteDigest: String(source.inviteDigest || ""),
    createdByActionId: String(source.createdByActionId || ""),
    game: clone(saga?.chapters?.[saga.chapterIndex]?.game || source.game),
    challengeIdentity: clone(
      saga?.chapters?.[saga.chapterIndex]?.challengeIdentity
      || source.challengeIdentity
      || null
    ),
    createdAt: milliseconds(source.createdAt),
    expiresAt: milliseconds(source.expiresAt),
    startsAt: source.startsAt == null ? null : milliseconds(source.startsAt),
    deadlineAt: source.deadlineAt == null ? null : milliseconds(source.deadlineAt),
    participants,
    revision: Math.max(0, Math.floor(Number(source.revision) || 0)),
    eventSequence: Math.max(0, Math.floor(Number(source.eventSequence) || 0)),
    events: (Array.isArray(source.events) ? source.events : []).slice(-MAX_EVENTS),
    pairClaims: asRecord(source.pairClaims),
    actionReceipts: (Array.isArray(source.actionReceipts) ? source.actionReceipts : []).slice(-256),
    leaderSlot: ["slot-a", "slot-b"].includes(source.leaderSlot) ? source.leaderSlot : null,
    winnerPlayerId: String(source.winnerPlayerId || ""),
    finishReason: String(source.finishReason || ""),
    settledAt: source.settledAt == null ? null : milliseconds(source.settledAt),
    ratingReceipt: clone(source.ratingReceipt || null),
    formatResult: clone(source.formatResult || null),
    rematchOf: String(source.rematchOf || ""),
    rematchVotes: [...new Set(Array.isArray(source.rematchVotes) ? source.rematchVotes.map(String) : [])].slice(0, 2),
    rematchDuelId: String(source.rematchDuelId || ""),
    pairDigest: String(source.pairDigest || ""),
    saga
  };
}

function ratingOutcome(winnerPlayerId, playerId) {
  if (!winnerPlayerId) return 0.5;
  return winnerPlayerId === playerId ? 1 : 0;
}

export class DuelService {
  constructor(store, runRegistry, {
    buildGame,
    resolveCombination,
    routeProgress,
    clock = null
  } = {}) {
    if (!store || !runRegistry) throw new TypeError("DuelService requires a GameStore and RunRegistry.");
    if (typeof buildGame !== "function" || typeof resolveCombination !== "function" || typeof routeProgress !== "function") {
      throw new TypeError("DuelService requires buildGame, resolveCombination, and routeProgress callbacks.");
    }
    this.store = store;
    this.runRegistry = runRegistry;
    this.buildGame = buildGame;
    this.resolveCombination = resolveCombination;
    this.routeProgress = routeProgress;
    this.clock = typeof clock === "function" ? clock : () => this.store.now().getTime();
    this.queue = new Map();
    this.listeners = new Map();
    this.inviteCodes = new Map();
    this.actionLocks = new Map();
    this.store.data.duels ||= {};
    this.store.data.duelResults ||= [];
    this.store.data.duelRatingLedger ||= [];
    for (const [id, raw] of Object.entries(this.store.data.duels)) {
      const duel = normalizeStoredDuel(raw, id);
      if (duel) this.store.data.duels[id] = duel;
      else delete this.store.data.duels[id];
    }
  }

  now() {
    return Math.max(0, Math.floor(Number(this.clock()) || Date.now()));
  }

  player(playerId) {
    const player = this.store.data.players[playerId];
    if (!player) throw serviceError(401, "Your player session is no longer valid.", "invalid_player");
    return player;
  }

  duel(duelId) {
    const duel = this.store.data.duels[String(duelId || "")];
    if (!duel) throw serviceError(404, "That Duel no longer exists.", "duel_missing");
    return duel;
  }

  participant(duel, playerId) {
    const participant = duel.participants.find((entry) => entry.playerId === playerId);
    if (!participant) throw serviceError(403, "Only the two competitors can view this Duel.", "duel_membership_required");
    return participant;
  }

  run(participant) {
    return this.runRegistry.getOwned(participant.runId, participant.playerId);
  }

  arena(playerId) {
    const player = this.player(playerId);
    let arena = sanitizeScrambleArena(player.scrambleArena, {
      legacyDuelRating: player.duelRating,
      seasonId: DUEL_SEASON_ID
    });
    const legacy = sanitizeDuelRating(player.duelRating, DUEL_SEASON_ID);
    const targetRace = scrambleRatingForMode(arena, SCRAMBLE_DEFAULT_MODE_ID, {
      seasonId: DUEL_SEASON_ID
    });
    const legacyDiffers = legacy.seasonId === DUEL_SEASON_ID
      && ["rating", "games", "wins", "losses", "draws", "streak"]
        .some((key) => Number(legacy[key]) !== Number(targetRace[key]));
    if (legacyDiffers) {
      arena = applyScrambleModeRating(arena, SCRAMBLE_DEFAULT_MODE_ID, legacy, {
        seasonId: DUEL_SEASON_ID
      });
    }
    player.scrambleArena = structuredClone(arena);
    return arena;
  }

  modeRating(playerId, format = SCRAMBLE_DEFAULT_MODE_ID) {
    return sanitizeScrambleModeRating(
      scrambleRatingForMode(this.arena(playerId), format, { seasonId: DUEL_SEASON_ID }),
      DUEL_SEASON_ID
    );
  }

  sagaFor(duel) {
    return storedScrambleMode(duel?.format).id === RIDDLE_SAGA_FORMAT_ID
      ? duel.saga || null
      : null;
  }

  sagaChapter(duel) {
    const saga = this.sagaFor(duel);
    return saga?.chapters?.[saga.chapterIndex] || null;
  }

  sagaScores(duel) {
    const saga = this.sagaFor(duel);
    return duel.participants.map((participant) => {
      const chaptersWon = saga?.chapters?.filter((chapter) =>
        chapter.winnerSlot === participant.slot
      ).length || 0;
      return {
        slot: participant.slot,
        score: Math.max(0, Math.floor(Number(saga?.scores?.[participant.slot]) || 0)),
        chaptersWon
      };
    });
  }

  sagaRunIds(duel) {
    const saga = this.sagaFor(duel);
    if (!saga) return duel.participants.map((participant) => participant.runId);
    return [...new Set(saga.chapters.flatMap((chapter) =>
      Object.values(normalizeSagaRunIds(chapter.runIds))
    ).filter(Boolean))];
  }

  publicSagaChapter(chapter) {
    if (!chapter) return null;
    return {
      index: chapter.index,
      number: chapter.number,
      title: boundedSagaText(chapter.title, 72),
      story: boundedSagaText(chapter.story, 180),
      target: boundedSagaText(chapter.target || chapter.game?.target, 48),
      chapterPoints: RIDDLE_SAGA_CHAPTER_POINTS[chapter.index],
      status: chapter.status === "timed_out" ? "timeout" : chapter.status,
      winnerSlot: ["slot-a", "slot-b"].includes(chapter.winnerSlot)
        ? chapter.winnerSlot
        : "",
      startsAt: iso(chapter.startsAt),
      deadlineAt: iso(chapter.deadlineAt),
      settledAt: iso(chapter.settledAt),
      finale: chapter.index === RIDDLE_SAGA_CHAPTER_COUNT - 1
    };
  }

  publicSagaFor(duel) {
    const saga = this.sagaFor(duel);
    if (!saga) return null;
    const chapter = this.sagaChapter(duel);
    const settledChapters = saga.chapters
      .filter((entry) => ["won", "timed_out"].includes(entry.status))
      .map((entry) => this.publicSagaChapter(entry));
    const currentChapter = saga.status === "playing"
      ? this.publicSagaChapter(chapter)
      : null;
    const chapters = [
      ...settledChapters,
      ...(currentChapter && !settledChapters.some((entry) => entry.index === currentChapter.index)
        ? [currentChapter]
        : [])
    ].sort((left, right) => left.index - right.index);
    const scores = this.sagaScores(duel).map((entry) => ({
      id: entry.slot,
      slot: entry.slot,
      points: entry.score,
      score: entry.score,
      chaptersWon: entry.chaptersWon
    }));
    return {
      version: RIDDLE_SAGA_VERSION,
      revision: saga.chapterVersion,
      arcId: saga.arcId,
      arcTitle: saga.arcTitle,
      status: saga.status,
      chapterCount: RIDDLE_SAGA_CHAPTER_COUNT,
      chapterIndex: saga.chapterIndex,
      chapterNumber: saga.chapterIndex + 1,
      chapterPoints: RIDDLE_SAGA_CHAPTER_POINTS[saga.chapterIndex],
      chapterStartsAt: iso(chapter?.startsAt),
      chapterDeadlineAt: iso(chapter?.deadlineAt),
      nextChapterAt: iso(saga.nextChapterAt),
      finale: saga.chapterIndex === RIDDLE_SAGA_CHAPTER_COUNT - 1,
      currentChapter,
      settledChapters,
      chapters,
      scores
    };
  }

  formatStateFor(duel, participant) {
    const mode = storedScrambleMode(duel.format);
    const run = this.run(participant);
    const discoveries = Math.max(0, run.discovered.size - starterCount(duel.game));
    const claims = Object.values(asRecord(duel.pairClaims))
      .filter((claim) => claim?.slot === participant.slot).length;
    if (mode.id === "wordstorm") {
      const quota = Math.max(1, Math.floor(Number(mode.config.discoveryQuota) || 12));
      return publicFormatState({
        score: discoveries,
        quota,
        discoveries,
        attempts: run.attempts,
        claims,
        remaining: Math.max(0, quota - discoveries),
        complete: discoveries >= quota
      });
    }
    if (mode.id === RIDDLE_SAGA_FORMAT_ID) {
      const saga = this.sagaFor(duel);
      const score = Math.max(0, Math.floor(Number(saga?.scores?.[participant.slot]) || 0));
      const settledCount = saga?.chapters?.filter((chapter) =>
        ["won", "timed_out"].includes(chapter.status)
      ).length || 0;
      return publicFormatState({
        score,
        quota: RIDDLE_SAGA_CHAPTER_POINTS.reduce((sum, points) => sum + points, 0),
        discoveries,
        attempts: run.attempts,
        claims,
        remaining: Math.max(0, RIDDLE_SAGA_CHAPTER_COUNT - settledCount),
        complete: saga?.status === "complete"
      });
    }
    if (mode.id === "forge-clash") {
      const turnLimit = Math.max(1, Math.floor(Number(mode.config.turnLimit) || 6));
      const champion = selectForgeChampion({
        history: run.history,
        starters: duel.game.starterItems || duel.game.starters
      });
      const turnsLeft = Math.max(0, turnLimit - run.attempts);
      return publicFormatState({
        score: champion?.power || 0,
        turnsLeft,
        turnLimit,
        champion,
        depth: champion?.power || 0,
        discoveries,
        attempts: run.attempts,
        claims,
        locked: turnsLeft === 0,
        complete: turnsLeft === 0
      });
    }
    const route = asRecord(this.routeProgress(run));
    return publicFormatState({
      score: Math.max(0, Math.floor(Number(route.percent) || 0)),
      discoveries,
      attempts: run.attempts,
      claims,
      remaining: Math.max(0, Math.floor(Number(route.remaining) || 0)),
      complete: route.complete === true || run.completedAt != null
    });
  }

  formatLeaderSlot(duel) {
    const ranked = duel.participants.map((participant) => ({
      slot: participant.slot,
      state: this.formatStateFor(duel, participant),
      run: this.run(participant)
    }));
    if (ranked.length !== 2) return null;
    const mode = storedScrambleMode(duel.format).id;
    if (mode === "wordstorm") {
      if (ranked[0].state.score === ranked[1].state.score) return null;
      return ranked[0].state.score > ranked[1].state.score ? ranked[0].slot : ranked[1].slot;
    }
    if (mode === "forge-clash") {
      if (ranked[0].state.depth === ranked[1].state.depth) return null;
      return ranked[0].state.depth > ranked[1].state.depth ? ranked[0].slot : ranked[1].slot;
    }
    if (mode === RIDDLE_SAGA_FORMAT_ID) {
      if (ranked[0].state.score === ranked[1].state.score) return null;
      return ranked[0].state.score > ranked[1].state.score ? ranked[0].slot : ranked[1].slot;
    }
    if (ranked[0].state.remaining === ranked[1].state.remaining) return null;
    return ranked[0].state.remaining < ranked[1].state.remaining ? ranked[0].slot : ranked[1].slot;
  }

  activeDuelFor(playerId) {
    return Object.values(this.store.data.duels).find((duel) =>
      ACTIVE_STATUSES.has(duel.status)
      && duel.participants.some((participant) => participant.playerId === playerId)
    ) || null;
  }

  assertAvailable(playerId, { allowDuelId = "" } = {}) {
    const active = this.activeDuelFor(playerId);
    if (active && active.id !== allowDuelId) {
      throw serviceError(409, "Finish or forfeit your active Duel first.", "duel_already_active", { duelId: active.id });
    }
    if (this.queue.has(playerId)) {
      throw serviceError(409, "You are already searching for a rival.", "duel_queue_active");
    }
  }

  hasRankedMatchmakingAccess(playerId) {
    const player = this.player(playerId);
    return sanitizeDuelEligibility(player.duelEligibility).soloWinAttested
      || (this.store.data.progressionLedger || []).some((entry) =>
      entry?.playerId === playerId && entry?.type === "verified_run_completed"
      ) || (this.store.data.scores || []).some((entry) =>
      entry?.playerId === playerId && entry?.status !== "provisional"
      );
  }

  async attestSoloWin(playerId, rawSoloWins) {
    if (rawSoloWins === undefined) return false;
    if (!Number.isInteger(rawSoloWins) || rawSoloWins < 0 || rawSoloWins > 100_000) {
      throw serviceError(
        400,
        "Solo wins must be a whole number between 0 and 100000.",
        "invalid_duel_solo_wins"
      );
    }
    if (rawSoloWins < 1) return false;
    const player = this.player(playerId);
    if (sanitizeDuelEligibility(player.duelEligibility).soloWinAttested) return false;
    player.duelEligibility = {
      soloWinAttested: true,
      attestedAt: new Date(this.now()).toISOString()
    };
    await this.store.persist();
    return true;
  }

  async createParticipantRun(playerId, game, solutionRoute = []) {
    const started = this.runRegistry.start(playerId, clone(game), {
      ranked: false,
      challengeId: `duel:${randomUUID()}`,
      scoringDisabled: false,
      deferActivation: true
    });
    if (Array.isArray(solutionRoute) && solutionRoute.length) {
      started.run.solutionRoute = solutionRoute.map((step) => clone(step));
      started.run.solutionRecipes = new Map(solutionRoute.map((step) => [pairKey(step.a, step.b), clone(step)]));
    }
    this.runRegistry.checkpoint(started.run);
    return started.run.runId;
  }

  async createParticipant(playerId, slot, game, solutionRoute = []) {
    const player = this.player(playerId);
    const runId = await this.createParticipantRun(playerId, game, solutionRoute);
    const now = this.now();
    return {
      playerId,
      slot,
      callsign: String(player.callsign || "STARGAZER").slice(0, 32),
      runId,
      ready: false,
      revision: 0,
      joinedAt: now,
      lastSeenAt: now,
      disconnectedAt: null,
      lastActionAt: 0
    };
  }

  async attachSagaRuns(duel, participant) {
    const saga = this.sagaFor(duel);
    if (!saga) return participant;
    const chapter = this.sagaChapter(duel);
    let runId = chapter?.runIds?.[participant.slot] || participant.runId || "";
    if (!runId) {
      runId = await this.createParticipantRun(
        participant.playerId,
        chapter.game,
        chapter.solutionRoute
      );
      chapter.runIds[participant.slot] = runId;
    }
    participant.runId = runId;
    return participant;
  }

  async createDuel(kind, playerIds, {
    format = SCRAMBLE_DEFAULT_MODE_ID,
    target = "",
    seed,
    rated = false,
    rematchOf = "",
    inviteDigest = "",
    createdByActionId = ""
  } = {}) {
    const mode = scrambleMode(format);
    const id = randomUUID();
    const numericSeed = Number.isFinite(Number(seed))
      ? Math.abs(Math.trunc(Number(seed)))
      : randomBytes(4).readUInt32BE(0);
    const buildBoard = async (boardTarget, boardSeed, chapterIndex = null) => {
      const built = await this.buildGame({
        kind,
        format: mode.id,
        rules: clone(mode.config),
        target: boardTarget,
        seed: boardSeed,
        duelId: id,
        rematchOf,
        chapterIndex
      });
      const envelope = asRecord(built);
      const game = clone(envelope.game || built);
      if (!game?.target || !Array.isArray(game.starters)) {
        throw serviceError(503, "The Duel board could not be prepared.", "duel_game_unavailable");
      }
      game.scrambleFormat = mode.id;
      game.scrambleRulesVersion = mode.rulesVersion;
      game.timeLimit = chapterIndex == null
        ? Math.max(1, Math.floor(Number(mode.config.durationSeconds) || 300))
        : riddleSagaChapterDurationMs(chapterIndex) / 1_000;
      game.completionPolicy = [SCRAMBLE_DEFAULT_MODE_ID, RIDDLE_SAGA_FORMAT_ID].includes(mode.id)
        ? "target"
        : "external";
      return {
        game,
        route: Array.isArray(envelope.solutionRoute)
          ? envelope.solutionRoute.map((step) => clone(step))
          : [],
        challengeIdentity: clone(envelope.challengeIdentity || null)
      };
    };

    let saga = null;
    let board;
    if (mode.id === RIDDLE_SAGA_FORMAT_ID) {
      const arc = selectRiddleSagaArc(numericSeed);
      const chapters = [];
      for (const authored of arc.chapters) {
        const chapterSeed = (numericSeed + Math.imul(authored.index + 1, 0x9e3779b1)) >>> 0;
        const prepared = await buildBoard(authored.target, chapterSeed, authored.index);
        chapters.push({
          index: authored.index,
          number: authored.number,
          chapterPoints: RIDDLE_SAGA_CHAPTER_POINTS[authored.index],
          title: authored.title,
          story: authored.story,
          target: prepared.game.target,
          game: prepared.game,
          solutionRoute: prepared.route,
          challengeIdentity: prepared.challengeIdentity,
          runIds: { "slot-a": "", "slot-b": "" },
          status: "pending",
          startsAt: null,
          deadlineAt: null,
          winnerPlayerId: "",
          winnerSlot: "",
          settledAt: null
        });
      }
      saga = {
        version: RIDDLE_SAGA_VERSION,
        arcId: arc.id,
        arcTitle: arc.title,
        status: "playing",
        chapterIndex: 0,
        chapterVersion: 1,
        nextChapterAt: null,
        scores: { "slot-a": 0, "slot-b": 0 },
        chapters
      };
      board = {
        game: chapters[0].game,
        route: chapters[0].solutionRoute,
        challengeIdentity: chapters[0].challengeIdentity
      };
    } else {
      board = await buildBoard(target, numericSeed);
    }
    const game = board.game;
    const route = board.route;
    const participants = [];
    for (let index = 0; index < playerIds.length; index += 1) {
      participants.push(await this.createParticipant(playerIds[index], index === 0 ? "slot-a" : "slot-b", game, route));
    }
    if (saga) {
      for (const participant of participants) {
        saga.chapters[0].runIds[participant.slot] = participant.runId;
      }
    }
    const now = this.now();
    const duel = {
      id,
      kind,
      format: mode.id,
      formatVersion: mode.rulesVersion,
      rules: clone(mode.config),
      objective: mode.objective,
      rated: rated === true,
      visibility: "open",
      status: "waiting",
      inviteDigest,
      createdByActionId,
      game,
      challengeIdentity: clone(board.challengeIdentity || null),
      createdAt: now,
      expiresAt: now + DUEL_INVITE_TTL_MS,
      startsAt: null,
      deadlineAt: null,
      participants,
      revision: 0,
      eventSequence: 0,
      events: [],
      pairClaims: {},
      actionReceipts: [],
      leaderSlot: null,
      winnerPlayerId: "",
      finishReason: "",
      settledAt: null,
      ratingReceipt: null,
      formatResult: null,
      rematchOf,
      rematchVotes: [],
      rematchDuelId: "",
      pairDigest: playerIds.length === 2
        ? this.store.signFor("duel-pair", [...playerIds].sort().join(":"))
        : "",
      saga
    };
    this.store.data.duels[id] = duel;
    await this.store.persist();
    return duel;
  }

  appendEvent(duel, type, fields = {}) {
    duel.eventSequence += 1;
    duel.revision += 1;
    const event = {
      sequence: duel.eventSequence,
      type,
      serverAt: new Date(this.now()).toISOString(),
      ...clone(fields)
    };
    duel.events.push(event);
    if (duel.events.length > MAX_EVENTS) duel.events.splice(0, duel.events.length - MAX_EVENTS);
    return event;
  }

  publicEvent(duel, event, viewerId) {
    const viewer = this.participant(duel, viewerId);
    const actor = event.actorPlayerId
      ? duel.participants.find((participant) => participant.playerId === event.actorPlayerId)
      : null;
    const winner = duel.winnerPlayerId
      ? duel.participants.find((participant) => participant.playerId === duel.winnerPlayerId)
      : null;
    const ratingEntry = duel.ratingReceipt?.participants?.find((entry) => entry.playerId === viewerId);
    return {
      sequence: Math.max(0, Math.floor(Number(event.sequence) || 0)),
      type: String(event.type || ""),
      actorSlot: actor?.slot || null,
      callsign: actor?.callsign || "",
      a: String(event.a || ""),
      b: String(event.b || ""),
      result: publicResult(event.result),
      reason: String(event.reason || ""),
      classification: String(event.classification || ""),
      move: Math.max(0, Math.floor(Number(event.move) || 0)),
      attempt: Math.max(0, Math.floor(Number(event.attempt) || 0)),
      boardRevision: Math.max(0, Math.floor(Number(event.boardRevision) || 0)),
      actorFormatState: event.actorFormatState
        ? publicFormatState(event.actorFormatState)
        : null,
      revision: viewer.revision,
      serverAt: event.serverAt || null,
      winnerId: winner?.slot || "",
      ratingDelta: Math.floor(Number(ratingEntry?.delta) || 0),
      nextDuelId: String(event.nextDuelId || ""),
      sagaRevision: Math.max(0, Math.floor(Number(event.sagaRevision) || 0)),
      chapterIndex: Math.max(0, Math.min(
        RIDDLE_SAGA_CHAPTER_COUNT - 1,
        Math.floor(Number(event.chapterIndex) || 0)
      )),
      chapterNumber: Math.max(0, Math.min(
        RIDDLE_SAGA_CHAPTER_COUNT,
        Math.floor(Number(event.chapterNumber) || 0)
      )),
      chapterPoints: Math.max(0, Math.min(2, Math.floor(Number(event.chapterPoints) || 0))),
      chapterStatus: ["playing", "won", "timeout"].includes(event.chapterStatus)
        ? event.chapterStatus
        : "",
      chapterWinnerId: ["slot-a", "slot-b"].includes(event.winnerSlot)
        ? event.winnerSlot
        : "",
      chapterTitle: boundedSagaText(event.chapterTitle, 72),
      chapterStory: boundedSagaText(event.chapterStory, 180),
      chapterTarget: boundedSagaText(event.chapterTarget, 48),
      chapterStartsAt: iso(event.chapterStartsAt),
      chapterDeadlineAt: iso(event.chapterDeadlineAt),
      nextChapterAt: iso(event.nextChapterAt),
      finale: event.finale === true
    };
  }

  eventListeners(duelId, playerId, create = false) {
    let byPlayer = this.listeners.get(duelId);
    if (!byPlayer && create) {
      byPlayer = new Map();
      this.listeners.set(duelId, byPlayer);
    }
    let listeners = byPlayer?.get(playerId);
    if (!listeners && create) {
      listeners = new Set();
      byPlayer.set(playerId, listeners);
    }
    return listeners || null;
  }

  notify(duel, events) {
    const rawEvents = Array.isArray(events) ? events : [events];
    for (const participant of duel.participants) {
      const listeners = this.eventListeners(duel.id, participant.playerId);
      if (!listeners?.size) continue;
      const projected = rawEvents.filter(Boolean).map((event) => this.publicEvent(duel, event, participant.playerId));
      for (const listener of [...listeners]) {
        try {
          listener(projected);
        } catch {
          listeners.delete(listener);
        }
      }
    }
  }

  subscribe(duelId, playerId, listener) {
    const duel = this.duel(duelId);
    const participant = this.participant(duel, playerId);
    if (typeof listener !== "function") throw new TypeError("Duel listeners must be functions.");
    participant.lastSeenAt = this.now();
    const listeners = this.eventListeners(duel.id, playerId, true);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      const byPlayer = this.listeners.get(duel.id);
      if (!listeners.size) byPlayer?.delete(playerId);
      if (byPlayer && !byPlayer.size) this.listeners.delete(duel.id);
    };
  }

  receipt(duel, playerId, type, id) {
    return duel.actionReceipts.find((entry) =>
      entry.playerId === playerId && entry.type === type && entry.actionId === id
    ) || null;
  }

  rememberReceipt(duel, playerId, type, id, fields = {}) {
    const receipt = { playerId, type, actionId: id, ...clone(fields) };
    duel.actionReceipts.push(receipt);
    if (duel.actionReceipts.length > 256) duel.actionReceipts.splice(0, duel.actionReceipts.length - 256);
    return receipt;
  }

  boardFor(duel, participant) {
    const run = this.run(participant);
    return {
      slot: participant.slot,
      revision: participant.revision,
      words: [...run.discovered.values()].map((word) => publicResult(word)),
      history: run.history.map((step) => ({
        move: step.move,
        a: step.a,
        b: step.b,
        result: publicResult(step)
      })),
      progress: clone(this.routeProgress(run)),
      formatState: this.formatStateFor(duel, participant),
      moves: run.moves,
      attempts: run.attempts,
      rejectedAttempts: run.rejectedAttempts
    };
  }

  publicSnapshot(duel, playerId) {
    const viewer = this.participant(duel, playerId);
    const winner = duel.winnerPlayerId
      ? duel.participants.find((participant) => participant.playerId === duel.winnerPlayerId)
      : null;
    const boards = duel.participants.map((participant) => this.boardFor(duel, participant));
    const ratingEntry = duel.ratingReceipt?.participants?.find((entry) => entry.playerId === playerId);
    const playerRating = this.modeRating(playerId, duel.format);
    const mode = storedScrambleMode(duel.format);
    const publicSaga = this.publicSagaFor(duel);
    const sagaIntermission = publicSaga?.status === "intermission";
    return {
      id: duel.id,
      kind: duel.kind,
      format: mode.id,
      formatVersion: duel.formatVersion || mode.rulesVersion,
      rulesVersion: duel.formatVersion || mode.rulesVersion,
      rules: clone(duel.rules || mode.config),
      objective: String(duel.objective || mode.objective),
      ranked: duel.kind === "public",
      rated: duel.rated === true,
      visibility: "open",
      status: duel.status,
      revision: viewer.revision,
      eventSequence: duel.eventSequence,
      target: sagaIntermission ? "" : String(duel.game.target || ""),
      starters: sagaIntermission
        ? []
        : clone(duel.game.starterItems || duel.game.starters || []),
      startsAt: iso(duel.startsAt),
      deadlineAt: iso(duel.deadlineAt),
      durationSeconds: modeDurationMs(duel) / 1_000,
      selfSlot: viewer.slot,
      players: duel.participants.map((participant) => {
        const board = boards.find((candidate) => candidate.slot === participant.slot);
        return {
          id: participant.slot,
          slot: participant.slot,
          side: participant.playerId === playerId ? "self" : "rival",
          callsign: participant.callsign,
          ready: participant.ready,
          connected: participant.disconnectedAt == null,
          discoveries: Math.max(0, board.words.length - (duel.game.starters?.length || 0)),
          attempts: board.attempts,
          formatState: clone(board.formatState),
          rating: this.modeRating(participant.playerId, duel.format).rating
        };
      }),
      boards,
      events: duel.events.map((event) => this.publicEvent(duel, event, playerId)),
      winnerId: winner?.slot || "",
      finishReason: duel.finishReason,
      formatResult: clone(duel.formatResult),
      saga: publicSaga,
      rating: {
        ...playerRating,
        delta: Math.floor(Number(ratingEntry?.delta) || 0),
        before: Number(ratingEntry?.before) || playerRating.rating,
        after: Number(ratingEntry?.after) || playerRating.rating,
        rated: duel.ratingReceipt?.rated === true
      },
      rematch: {
        requestedBy: duel.rematchVotes.map((voteId) =>
          duel.participants.find((participant) => participant.playerId === voteId)?.slot
        ).filter(Boolean),
        nextDuelId: duel.rematchDuelId || ""
      }
    };
  }

  async snapshot(duelId, playerId) {
    const duel = this.duel(duelId);
    const participant = this.participant(duel, playerId);
    const events = [];
    participant.lastSeenAt = this.now();
    if (participant.disconnectedAt != null) {
      participant.disconnectedAt = null;
      events.push(this.appendEvent(duel, "player_reconnected", { actorPlayerId: playerId }));
      await this.store.persist();
      this.notify(duel, events);
    }
    await this.tickDuel(duel);
    return { duel: this.publicSnapshot(duel, playerId) };
  }

  async createInvite(playerId, options = {}) {
    this.player(playerId);
    const mode = scrambleMode(options.format);
    const id = actionId(options.actionId);
    const duplicate = Object.values(this.store.data.duels).find((duel) =>
      duel.participants[0]?.playerId === playerId && duel.createdByActionId === id
    );
    if (duplicate) {
      const code = this.inviteCodes.get(duplicate.id);
      if (!code) throw serviceError(409, "That invitation was already created.", "duel_invite_already_created");
      return { inviteCode: code, duel: this.publicSnapshot(duplicate, playerId) };
    }
    this.assertAvailable(playerId);
    const inviteCode = randomBytes(24).toString("base64url");
    const inviteDigest = this.store.signFor("duel-invite", inviteCode);
    const duel = await this.createDuel("invite", [playerId], {
      format: mode.id,
      target: String(options.target || ""),
      seed: options.seed,
      rated: false,
      inviteDigest,
      createdByActionId: id
    });
    this.inviteCodes.set(duel.id, inviteCode);
    return { inviteCode, duel: this.publicSnapshot(duel, playerId) };
  }

  async joinInvite(playerId, options = {}) {
    this.player(playerId);
    const id = actionId(options.actionId);
    const code = String(options.inviteCode || "").trim();
    if (!INVITE_CODE_PATTERN.test(code)) throw serviceError(400, "That Duel invitation is invalid.", "invalid_duel_invite");
    const digest = this.store.signFor("duel-invite", code);
    const duel = Object.values(this.store.data.duels).find((candidate) =>
      candidate.inviteDigest === digest && candidate.kind === "invite"
    );
    if (!duel) throw serviceError(404, "That Duel invitation is invalid or expired.", "duel_invite_missing");
    const duplicate = this.receipt(duel, playerId, "join", id);
    if (duplicate) return { duel: this.publicSnapshot(duel, playerId) };
    if (duel.status !== "waiting" || duel.participants.length !== 1 || this.now() > duel.expiresAt) {
      throw serviceError(410, "That Duel invitation has expired or was already used.", "duel_invite_expired");
    }
    if (duel.participants[0].playerId === playerId) {
      throw serviceError(409, "Open your invitation on your friend's device.", "duel_self_join");
    }
    this.assertAvailable(playerId);
    const hostRun = this.run(duel.participants[0]);
    const rival = await this.createParticipant(
      playerId,
      "slot-b",
      duel.game,
      hostRun.solutionRoute || []
    );
    duel.participants.push(await this.attachSagaRuns(duel, rival));
    duel.inviteDigest = "";
    duel.expiresAt = this.now() + modeDurationMs(duel) + DUEL_RECONNECT_GRACE_MS;
    this.inviteCodes.delete(duel.id);
    this.rememberReceipt(duel, playerId, "join", id);
    const event = this.appendEvent(duel, "player_joined", { actorPlayerId: playerId });
    await this.store.persist();
    this.notify(duel, event);
    return { duel: this.publicSnapshot(duel, playerId) };
  }

  queueWindow(ticket, now = this.now()) {
    return Math.min(600, 150 + Math.floor(Math.max(0, now - ticket.joinedAt) / 10_000) * 75);
  }

  async joinPublicQueue(playerId, options = {}) {
    this.player(playerId);
    const mode = scrambleMode(options.format);
    actionId(options.actionId);
    await this.attestSoloWin(playerId, options.soloWins);
    if (!this.hasRankedMatchmakingAccess(playerId)) {
      throw serviceError(
        403,
        "Win one scored solo orbit before entering ranked matchmaking.",
        "duel_matchmaking_locked"
      );
    }
    const active = this.activeDuelFor(playerId);
    if (active) return { duel: this.publicSnapshot(active, playerId), queue: { status: "matched" } };
    const existing = this.queue.get(playerId);
    if (existing) return this.queueStatus(playerId);
    const rating = this.modeRating(playerId, mode.id).rating;
    const ticket = {
      playerId,
      format: mode.id,
      rating,
      joinedAt: this.now(),
      actionId: options.actionId
    };
    this.queue.set(playerId, ticket);
    const candidates = [...this.queue.values()]
      .filter((candidate) => candidate.playerId !== playerId && candidate.format === mode.id)
      .sort((left, right) => left.joinedAt - right.joinedAt);
    const opponent = candidates.find((candidate) => {
      const allowed = Math.max(this.queueWindow(ticket), this.queueWindow(candidate));
      return Math.abs(candidate.rating - rating) <= allowed;
    });
    if (!opponent) return this.queueStatus(playerId);
    this.queue.delete(playerId);
    this.queue.delete(opponent.playerId);
    const duel = await this.createDuel("public", [opponent.playerId, playerId], {
      format: mode.id,
      rated: true
    });
    const events = [
      this.appendEvent(duel, "player_joined", { actorPlayerId: opponent.playerId }),
      this.appendEvent(duel, "player_joined", { actorPlayerId: playerId })
    ];
    await this.store.persist();
    this.notify(duel, events);
    return { duel: this.publicSnapshot(duel, playerId), queue: { status: "matched" } };
  }

  async queueStatus(playerId) {
    this.player(playerId);
    const active = this.activeDuelFor(playerId);
    if (active) return { duel: this.publicSnapshot(active, playerId), queue: { status: "matched", position: 0 } };
    const ticket = this.queue.get(playerId);
    if (!ticket) return { queue: { status: "idle", position: 0, format: SCRAMBLE_DEFAULT_MODE_ID } };
    if (this.now() - ticket.joinedAt >= DUEL_QUEUE_TTL_MS) {
      this.queue.delete(playerId);
      return { queue: { status: "expired", position: 0, format: ticket.format } };
    }
    const ordered = [...this.queue.values()]
      .filter((entry) => entry.format === ticket.format)
      .sort((left, right) => left.joinedAt - right.joinedAt);
    return {
      queue: {
        status: "waiting",
        position: ordered.findIndex((entry) => entry.playerId === playerId) + 1,
        format: ticket.format
      }
    };
  }

  async leavePublicQueue(playerId) {
    this.player(playerId);
    const left = this.queue.delete(playerId);
    return { queue: { status: "idle", left } };
  }

  async ready(duelId, playerId, options = {}) {
    const duel = this.duel(duelId);
    const participant = this.participant(duel, playerId);
    const id = actionId(options.actionId);
    const duplicate = this.receipt(duel, playerId, "ready", id);
    if (duplicate) return { duel: this.publicSnapshot(duel, playerId) };
    if (duel.status === "countdown") {
      if (options.ready !== true || participant.ready !== true) {
        throw serviceError(409, "The shared countdown has already started.", "duel_countdown_locked");
      }
      return { duel: this.publicSnapshot(duel, playerId) };
    }
    if (duel.status !== "waiting") {
      throw serviceError(409, "That Duel is no longer waiting for ready status.", "duel_not_waiting");
    }
    if (duel.participants.length !== 2) throw serviceError(409, "Your rival has not joined yet.", "duel_rival_missing");
    participant.ready = options.ready === true;
    participant.lastSeenAt = this.now();
    const events = [this.appendEvent(duel, "ready", { actorPlayerId: playerId, ready: participant.ready })];
    this.rememberReceipt(duel, playerId, "ready", id);
    if (duel.participants.every((entry) => entry.ready)) {
      duel.status = "countdown";
      duel.startsAt = this.now() + DUEL_COUNTDOWN_MS;
      const saga = this.sagaFor(duel);
      if (saga) {
        const chapter = this.sagaChapter(duel);
        saga.status = "playing";
        saga.nextChapterAt = null;
        chapter.status = "playing";
        chapter.startsAt = duel.startsAt;
        chapter.deadlineAt = duel.startsAt + riddleSagaChapterDurationMs(chapter.index);
        duel.deadlineAt = chapter.deadlineAt;
        const totalSagaMs = (
          (RIDDLE_SAGA_CHAPTER_COUNT - 1) * riddleSagaChapterDurationMs(0)
          + riddleSagaChapterDurationMs(RIDDLE_SAGA_CHAPTER_COUNT - 1)
          + (RIDDLE_SAGA_CHAPTER_COUNT - 1) * RIDDLE_SAGA_INTERMISSION_SECONDS * 1_000
        );
        duel.expiresAt = duel.startsAt + totalSagaMs + DUEL_RECONNECT_GRACE_MS;
      } else {
        duel.deadlineAt = duel.startsAt + modeDurationMs(duel);
        duel.expiresAt = duel.deadlineAt + DUEL_RECONNECT_GRACE_MS;
      }
      for (const entry of duel.participants) this.runRegistry.activateAt(this.run(entry), duel.startsAt);
      events.push(this.appendEvent(duel, "countdown_started", {}));
    }
    await this.store.persist();
    this.notify(duel, events);
    return { duel: this.publicSnapshot(duel, playerId) };
  }

  async heartbeat(duelId, playerId) {
    const duel = this.duel(duelId);
    const participant = this.participant(duel, playerId);
    const events = [];
    participant.lastSeenAt = this.now();
    if (participant.disconnectedAt != null) {
      participant.disconnectedAt = null;
      events.push(this.appendEvent(duel, "player_reconnected", { actorPlayerId: playerId }));
      await this.store.persist();
      this.notify(duel, events);
    }
    await this.tickDuel(duel);
    return {
      ok: true,
      status: duel.status,
      revision: participant.revision,
      eventSequence: duel.eventSequence
    };
  }

  actionResponse(duel, playerId, receipt) {
    const event = duel.events.find((candidate) => candidate.sequence === receipt.eventSequence);
    return {
      result: publicResult(receipt.result),
      event: event ? this.publicEvent(duel, event, playerId) : null,
      duel: this.publicSnapshot(duel, playerId)
    };
  }

  sagaEventFields(duel, chapter = this.sagaChapter(duel)) {
    const saga = this.sagaFor(duel);
    return {
      sagaRevision: saga?.chapterVersion || 0,
      chapterIndex: chapter?.index || 0,
      chapterNumber: chapter?.number || 0,
      chapterPoints: RIDDLE_SAGA_CHAPTER_POINTS[chapter?.index] || 0,
      chapterTitle: chapter?.title || "",
      chapterStory: chapter?.story || "",
      chapterTarget: chapter?.target || chapter?.game?.target || "",
      chapterStartsAt: chapter?.startsAt || null,
      chapterDeadlineAt: chapter?.deadlineAt || null,
      finale: chapter?.index === RIDDLE_SAGA_CHAPTER_COUNT - 1
    };
  }

  sagaActionContext(duel, participant) {
    const saga = this.sagaFor(duel);
    if (!saga) return null;
    const chapter = this.sagaChapter(duel);
    if (
      saga.status !== "playing"
      || chapter?.status !== "playing"
      || chapter.runIds?.[participant.slot] !== participant.runId
    ) {
      throw serviceError(
        409,
        saga.status === "intermission"
          ? "The next riddle is being prepared."
          : "That riddle is no longer accepting pairings.",
        saga.status === "intermission" ? "saga_intermission" : "saga_chapter_closed"
      );
    }
    return {
      chapterIndex: saga.chapterIndex,
      chapterVersion: saga.chapterVersion,
      runId: participant.runId
    };
  }

  sagaActionIsCurrent(duel, participant, context) {
    if (!context) return true;
    const saga = this.sagaFor(duel);
    const chapter = this.sagaChapter(duel);
    return duel.status === "active"
      && saga?.status === "playing"
      && chapter?.status === "playing"
      && saga.chapterIndex === context.chapterIndex
      && saga.chapterVersion === context.chapterVersion
      && participant.runId === context.runId
      && chapter.runIds?.[participant.slot] === context.runId;
  }

  async settleSagaChapter(duel, {
    winner = null,
    reason = "timeout",
    pendingEvents = []
  } = {}) {
    const saga = this.sagaFor(duel);
    const chapter = this.sagaChapter(duel);
    if (
      !saga
      || saga.status !== "playing"
      || chapter?.status !== "playing"
      || !ACTIVE_STATUSES.has(duel.status)
    ) return false;

    const now = this.now();
    const chapterWinner = winner && duel.participants.includes(winner)
      ? winner
      : null;
    chapter.status = chapterWinner ? "won" : "timed_out";
    chapter.winnerPlayerId = chapterWinner?.playerId || "";
    chapter.winnerSlot = chapterWinner?.slot || "";
    chapter.settledAt = now;
    if (chapterWinner) {
      saga.scores[chapterWinner.slot] = Math.min(
        6,
        Math.max(0, Math.floor(Number(saga.scores[chapterWinner.slot]) || 0))
          + RIDDLE_SAGA_CHAPTER_POINTS[chapter.index]
      );
    }
    saga.chapterVersion += 1;
    const chapterEvent = this.appendEvent(
      duel,
      chapterWinner ? "chapter_won" : "chapter_timeout",
      {
        ...this.sagaEventFields(duel, chapter),
        actorPlayerId: chapterWinner?.playerId || "",
        winnerSlot: chapterWinner?.slot || "",
        chapterStatus: chapterWinner ? "won" : "timeout",
        reason
      }
    );
    if (chapterWinner) {
      chapterEvent.actorFormatState = this.formatStateFor(duel, chapterWinner);
    }
    const emitted = [...pendingEvents, chapterEvent];
    const lastChapter = chapter.index === RIDDLE_SAGA_CHAPTER_COUNT - 1;

    if (!lastChapter) {
      saga.status = "intermission";
      saga.nextChapterAt = now + RIDDLE_SAGA_INTERMISSION_SECONDS * 1_000;
      duel.deadlineAt = null;
      chapterEvent.nextChapterAt = saga.nextChapterAt;
      const leaderSlot = this.formatLeaderSlot(duel);
      if (leaderSlot !== duel.leaderSlot) {
        duel.leaderSlot = leaderSlot;
        if (leaderSlot) {
          const leader = duel.participants.find((entry) => entry.slot === leaderSlot);
          emitted.push(this.appendEvent(duel, "lead_change", {
            actorPlayerId: leader?.playerId || "",
            classification: "LEAD_CHANGE"
          }));
        }
      }
      await this.store.persist();
      this.notify(duel, emitted);
      return true;
    }

    saga.status = "complete";
    saga.nextChapterAt = null;
    duel.deadlineAt = null;
    const outcome = riddleSagaScoreWinner(saga.scores, duel.participants);
    duel.formatResult = {
      format: RIDDLE_SAGA_FORMAT_ID,
      arcId: saga.arcId,
      standings: outcome.entries.map((entry) => ({
        slot: entry.slot,
        score: entry.score,
        chaptersWon: saga.chapters.filter((entryChapter) =>
          entryChapter.winnerSlot === entry.slot
        ).length
      })),
      chapters: saga.chapters.map((entry) => ({
        number: entry.number,
        chapterPoints: RIDDLE_SAGA_CHAPTER_POINTS[entry.index],
        status: entry.status === "timed_out" ? "timeout" : entry.status,
        winnerSlot: entry.winnerSlot || ""
      })),
      draw: outcome.draw
    };
    await this.finishDuel(
      duel,
      outcome.winnerPlayerId,
      outcome.draw ? "saga_points_draw" : "saga_points",
      emitted
    );
    return true;
  }

  async activateNextSagaChapter(duel) {
    const lockKey = `saga-transition:${duel.id}`;
    const existing = this.actionLocks.get(lockKey);
    if (existing) return existing;
    const transition = (async () => {
      const saga = this.sagaFor(duel);
      if (
        !saga
        || saga.status !== "intermission"
        || this.now() < Number(saga.nextChapterAt || Infinity)
        || !ACTIVE_STATUSES.has(duel.status)
      ) return false;
      const previousIndex = saga.chapterIndex;
      const previousVersion = saga.chapterVersion;
      const chapter = saga.chapters[previousIndex + 1];
      if (!chapter) return false;

      const nextRuns = [];
      try {
        for (const participant of duel.participants) {
          const runId = await this.createParticipantRun(
            participant.playerId,
            chapter.game,
            chapter.solutionRoute
          );
          nextRuns.push({ participant, runId });
        }
      } catch (error) {
        for (const { runId } of nextRuns) this.runRegistry.discard(runId);
        throw error;
      }
      if (
        duel.status !== "active"
        || saga.status !== "intermission"
        || saga.chapterIndex !== previousIndex
        || saga.chapterVersion !== previousVersion
      ) {
        for (const { runId } of nextRuns) this.runRegistry.discard(runId);
        return false;
      }

      const startsAt = this.now();
      const previousChapter = saga.chapters[previousIndex];
      for (const participant of duel.participants) {
        const previousRunId = previousChapter.runIds?.[participant.slot] || "";
        if (previousRunId) this.runRegistry.discard(previousRunId);
        previousChapter.runIds[participant.slot] = "";
      }
      for (const { participant, runId } of nextRuns) {
        chapter.runIds[participant.slot] = runId;
        participant.runId = runId;
        participant.revision += 1;
        participant.lastActionAt = 0;
        this.runRegistry.activateAt(this.run(participant), startsAt);
      }
      saga.chapterIndex = chapter.index;
      saga.chapterVersion += 1;
      saga.status = "playing";
      saga.nextChapterAt = null;
      chapter.status = "playing";
      chapter.startsAt = startsAt;
      chapter.deadlineAt = startsAt + riddleSagaChapterDurationMs(chapter.index);
      duel.game = clone(chapter.game);
      duel.challengeIdentity = clone(chapter.challengeIdentity || null);
      duel.pairClaims = {};
      duel.deadlineAt = chapter.deadlineAt;
      duel.expiresAt = Math.max(
        Number(duel.expiresAt) || 0,
        chapter.deadlineAt + DUEL_RECONNECT_GRACE_MS
      );
      const event = this.appendEvent(duel, "chapter_started", {
        ...this.sagaEventFields(duel, chapter),
        chapterStatus: "playing"
      });
      await this.store.persist();
      this.notify(duel, event);
      return true;
    })();
    this.actionLocks.set(lockKey, transition);
    try {
      return await transition;
    } finally {
      if (this.actionLocks.get(lockKey) === transition) this.actionLocks.delete(lockKey);
    }
  }

  async act(duelId, playerId, options = {}) {
    const duel = this.duel(duelId);
    const participant = this.participant(duel, playerId);
    const id = actionId(options.actionId);
    const duplicate = this.receipt(duel, playerId, "action", id);
    if (duplicate) return this.actionResponse(duel, playerId, duplicate);
    await this.tickDuel(duel);
    if (!["countdown", "active"].includes(duel.status)) {
      throw serviceError(409, "That Duel is not accepting pairings.", "duel_not_active");
    }
    const now = this.now();
    const mode = storedScrambleMode(duel.format);
    const saga = this.sagaFor(duel);
    if (saga?.status === "intermission") {
      throw serviceError(409, "The next riddle is being prepared.", "saga_intermission", {
        nextChapterAt: iso(saga.nextChapterAt),
        duel: this.publicSnapshot(duel, playerId)
      });
    }
    if (!duel.startsAt || now < duel.startsAt) throw serviceError(409, "Wait for the countdown.", "duel_countdown");
    if (duel.deadlineAt && now >= duel.deadlineAt) {
      await this.finishByFormat(duel, "time_limit");
      throw serviceError(409, "The Duel clock has expired.", "duel_time_limit");
    }
    duel.status = "active";
    const expectedRevision = Math.max(0, Math.floor(Number(options.expectedRevision) || 0));
    if (expectedRevision !== participant.revision) {
      throw serviceError(409, "Your board changed. The latest Duel state is attached.", "duel_revision_conflict", {
        revision: participant.revision,
        duel: this.publicSnapshot(duel, playerId)
      });
    }
    if (participant.lastActionAt && now - participant.lastActionAt < 60) {
      throw serviceError(429, "Pairings are arriving too quickly.", "duel_action_cooldown");
    }
    const a = cleanWord(options.a);
    const b = cleanWord(options.b);
    const run = this.run(participant);
    if (mode.id === "forge-clash" && this.formatStateFor(duel, participant).locked) {
      throw serviceError(409, "Your Forge is locked while your rival finishes.", "forge_turns_exhausted");
    }
    const sagaContext = this.sagaActionContext(duel, participant);
    this.runRegistry.canCombine(run, a, b);
    participant.lastActionAt = now;
    participant.lastSeenAt = now;
    const attemptedFields = {
      actorPlayerId: playerId,
      a,
      b,
      attempt: run.attempts + 1,
      boardRevision: participant.revision
    };
    const emitted = sagaContext
      ? []
      : [this.appendEvent(duel, "fusion_attempted", attemptedFields)];
    const resolved = await this.resolveCombination(a, b, {
      game: clone(duel.game),
      duelId: duel.id,
      kind: duel.kind
    });
    if (duel.status === "finished" || duel.status === "cancelled") {
      throw serviceError(409, "The Final Spark has already been claimed.", "duel_finished");
    }
    if (!this.sagaActionIsCurrent(duel, participant, sagaContext)) {
      throw serviceError(
        409,
        "That riddle has already closed. Your pairing was not applied.",
        "saga_chapter_advanced",
        { duel: this.publicSnapshot(duel, playerId) }
      );
    }
    if (sagaContext) emitted.push(this.appendEvent(duel, "fusion_attempted", attemptedFields));
    if (!resolved?.word) {
      this.runRegistry.recordRejectedAttempt(run, { a, b });
      participant.revision += 1;
      this.runRegistry.checkpoint(run);
      const rejected = this.appendEvent(duel, "fusion_rejected", {
        actorPlayerId: playerId,
        a,
        b,
        reason: "Those ideas do not form a known concept yet.",
        attempt: run.attempts,
        boardRevision: participant.revision
      });
      rejected.actorFormatState = this.formatStateFor(duel, participant);
      emitted.push(rejected);
      const receipt = this.rememberReceipt(duel, playerId, "action", id, {
        eventSequence: rejected.sequence,
        result: null
      });
      if (
        mode.id === "forge-clash"
        && duel.participants.every((entry) => this.formatStateFor(duel, entry).locked)
      ) {
        await this.finishByFormat(duel, "turn_limit", emitted);
      } else {
        await this.store.persist();
        this.notify(duel, emitted);
      }
      return this.actionResponse(duel, playerId, receipt);
    }
    const result = publicResult(resolved);
    const history = this.runRegistry.recordCombination(run, result, {
      a,
      b,
      recordProgression: false
    });
    participant.revision += 1;
    this.runRegistry.checkpoint(run);
    const succeeded = this.appendEvent(duel, "fusion_succeeded", {
      actorPlayerId: playerId,
      a,
      b,
      result,
      move: run.moves,
      attempt: run.attempts,
      boardRevision: participant.revision
    });
    succeeded.actorFormatState = this.formatStateFor(duel, participant);
    emitted.push(succeeded);

    const key = pairKey(a, b);
    const claim = asRecord(duel.pairClaims[key]);
    if (!claim.slot) {
      duel.pairClaims[key] = { slot: participant.slot, at: now, result: result.word };
      emitted.push(this.appendEvent(duel, "first_light", {
        actorPlayerId: playerId,
        a,
        b,
        result,
        classification: "FIRST_LIGHT",
        boardRevision: participant.revision
      }));
    } else if (claim.slot !== participant.slot) {
      const intercepted = now - Number(claim.at || 0) <= DUEL_INTERCEPT_MS;
      emitted.push(this.appendEvent(duel, intercepted ? "intercept" : "echo_steal", {
        actorPlayerId: playerId,
        a,
        b,
        result,
        classification: intercepted ? "INTERCEPTED" : "ECHO_STEAL",
        boardRevision: participant.revision
      }));
    }

    const latestActorFormatState = this.formatStateFor(duel, participant);
    for (const event of emitted) {
      if (event.actorPlayerId === playerId) event.actorFormatState = latestActorFormatState;
    }

    const leaderSlot = this.formatLeaderSlot(duel);
    if (leaderSlot && leaderSlot !== duel.leaderSlot) {
      duel.leaderSlot = leaderSlot;
      const leader = duel.participants.find((entry) => entry.slot === leaderSlot);
      emitted.push(this.appendEvent(duel, "lead_change", {
        actorPlayerId: leader?.playerId || "",
        classification: "LEAD_CHANGE"
      }));
    }

    const receipt = this.rememberReceipt(duel, playerId, "action", id, {
      eventSequence: succeeded.sequence,
      result
    });
    const actorFormatState = this.formatStateFor(duel, participant);
    const sagaTargetMade = sagaContext
      && result.word.toLocaleLowerCase("en-US")
        === String(this.sagaChapter(duel)?.target || "").toLocaleLowerCase("en-US");
    if (sagaTargetMade) {
      await this.settleSagaChapter(duel, {
        winner: participant,
        reason: "riddle_solved",
        pendingEvents: emitted
      });
    } else if (mode.id === "target-race" && (history?.targetMade === true || run.completedAt)) {
      await this.finishDuel(duel, playerId, "target_reached", emitted);
    } else if (mode.id === "wordstorm" && actorFormatState.complete) {
      await this.finishDuel(duel, playerId, "discovery_quota", emitted);
    } else if (
      mode.id === "forge-clash"
      && duel.participants.every((entry) => this.formatStateFor(duel, entry).locked)
    ) {
      await this.finishByFormat(duel, "turn_limit", emitted);
    } else {
      await this.store.persist();
      this.notify(duel, emitted);
    }
    return this.actionResponse(duel, playerId, receipt);
  }

  pairRatedCount(duel, now = this.now()) {
    return (this.store.data.duelResults || []).filter((result) =>
      result?.kind === "public"
      && result?.rated === true
      && result?.pairDigest === duel.pairDigest
      && storedScrambleMode(result?.format).id === storedScrambleMode(duel.format).id
      && now - milliseconds(result.settledAt) <= RATED_PAIR_WINDOW_MS
    ).length;
  }

  settleRating(duel) {
    const existing = (this.store.data.duelRatingLedger || []).find((entry) =>
      entry.idempotencyKey === `duel-rating:${duel.id}`
    );
    if (existing) return clone(existing);
    const now = this.now();
    const mayRate = duel.kind === "public"
      && duel.rated === true
      && duel.participants.length === 2
      && this.pairRatedCount(duel, now) < MAX_RATED_PAIR_RESULTS;
    if (!mayRate) {
      duel.rated = false;
      return {
        idempotencyKey: `duel-rating:${duel.id}`,
        duelId: duel.id,
        seasonId: DUEL_SEASON_ID,
        format: storedScrambleMode(duel.format).id,
        rated: false,
        reason: duel.kind === "public" ? "repeat_pair_limit" : "private_match",
        participants: [],
        createdAt: new Date(now).toISOString()
      };
    }
    const [first, second] = duel.participants;
    const format = storedScrambleMode(duel.format).id;
    const firstRating = this.modeRating(first.playerId, format);
    const secondRating = this.modeRating(second.playerId, format);
    const actualFirst = ratingOutcome(duel.winnerPlayerId, first.playerId);
    const expectedFirst = 1 / (1 + 10 ** ((secondRating.rating - firstRating.rating) / 400));
    const k = firstRating.games < 10 || secondRating.games < 10 ? 40 : 24;
    let deltaFirst = Math.round(k * (actualFirst - expectedFirst));
    const lowerDelta = Math.max(
      100 - firstRating.rating,
      secondRating.rating - 10_000
    );
    const upperDelta = Math.min(
      10_000 - firstRating.rating,
      secondRating.rating - 100
    );
    deltaFirst = Math.max(lowerDelta, Math.min(upperDelta, deltaFirst));
    const deltaSecond = -deltaFirst;
    const settledAt = new Date(now).toISOString();
    const projections = [
      { participant: first, rating: firstRating, actual: actualFirst, delta: deltaFirst },
      { participant: second, rating: secondRating, actual: 1 - actualFirst, delta: deltaSecond }
    ];
    const participants = projections.map(({ participant, rating, actual, delta }) => {
      const next = sanitizeScrambleModeRating({
        ...rating,
        rating: rating.rating + delta,
        games: rating.games + 1,
        wins: rating.wins + (actual === 1 ? 1 : 0),
        losses: rating.losses + (actual === 0 ? 1 : 0),
        draws: rating.draws + (actual === 0.5 ? 1 : 0),
        streak: actual === 1 ? rating.streak + 1 : 0,
        updatedAt: settledAt
      }, DUEL_SEASON_ID);
      const player = this.player(participant.playerId);
      const currentArena = this.arena(participant.playerId);
      const withRating = applyScrambleModeRating(currentArena, format, next, {
        seasonId: DUEL_SEASON_ID
      });
      const outcome = actual === 1 ? "win" : actual === 0 ? "loss" : "draw";
      const xpAward = SCRAMBLE_XP[outcome];
      const xp = Math.min(1_000_000_000, withRating.progression.xp + xpAward);
      const nextArena = sanitizeScrambleArena({
        ...withRating,
        progression: {
          seasonId: DUEL_SEASON_ID,
          xp,
          level: Math.min(10_000, 1 + Math.floor(xp / SCRAMBLE_XP_PER_LEVEL)),
          updatedAt: settledAt
        }
      }, { seasonId: DUEL_SEASON_ID });
      player.scrambleArena = structuredClone(nextArena);
      if (format === SCRAMBLE_DEFAULT_MODE_ID) {
        player.duelRating = sanitizeDuelRating(next, DUEL_SEASON_ID);
      }
      return {
        playerId: participant.playerId,
        slot: participant.slot,
        before: rating.rating,
        after: next.rating,
        delta,
        outcome,
        xpAward
      };
    });
    const receipt = {
      idempotencyKey: `duel-rating:${duel.id}`,
      type: "duel_rating_settled",
      duelId: duel.id,
      seasonId: DUEL_SEASON_ID,
      format,
      pairDigest: duel.pairDigest,
      rated: true,
      participants,
      createdAt: settledAt
    };
    return clone(this.store.appendLedger("duelRatingLedger", receipt).entry);
  }

  resultRecord(duel) {
    return {
      id: duel.id,
      kind: duel.kind,
      format: storedScrambleMode(duel.format).id,
      formatVersion: duel.formatVersion,
      rules: clone(duel.rules),
      rated: duel.ratingReceipt?.rated === true,
      pairDigest: duel.pairDigest,
      target: String(duel.game.target || ""),
      startedAt: iso(duel.startsAt),
      settledAt: iso(duel.settledAt),
      winnerPlayerId: duel.winnerPlayerId,
      finishReason: duel.finishReason,
      formatResult: clone(duel.formatResult),
      participants: duel.participants.map((participant) => {
        const run = this.run(participant);
        const progress = this.routeProgress(run);
        return {
          playerId: participant.playerId,
          slot: participant.slot,
          callsign: participant.callsign,
          moves: run.moves,
          attempts: run.attempts,
          formatState: this.formatStateFor(duel, participant),
          remaining: Math.max(0, Math.floor(Number(progress?.remaining) || 0)),
          history: run.history.map((step) => ({
            a: step.a,
            b: step.b,
            word: step.word,
            emoji: step.emoji || ""
          }))
        };
      }),
      ratingReceipt: clone(duel.ratingReceipt),
      events: duel.events.map((event) => clone(event))
    };
  }

  async finishDuel(duel, winnerPlayerId, reason, pendingEvents = []) {
    if (duel.status === "finished" || duel.status === "cancelled") return duel;
    duel.status = "finished";
    duel.winnerPlayerId = String(winnerPlayerId || "");
    duel.finishReason = String(reason || "finished");
    duel.settledAt = this.now();
    for (const participant of duel.participants) {
      const runIds = this.sagaFor(duel)
        ? duel.saga.chapters.map((chapter) => chapter.runIds?.[participant.slot]).filter(Boolean)
        : [participant.runId];
      for (const runId of new Set(runIds)) {
        const run = this.runRegistry.getOwned(runId, participant.playerId);
        run.expiresAt = Math.max(
          Number(run.expiresAt) || 0,
          duel.settledAt + FINISHED_DUEL_RETENTION_MS + 60_000
        );
        this.runRegistry.checkpoint(run);
      }
    }
    duel.ratingReceipt = this.settleRating(duel);
    const finished = this.appendEvent(duel, "match_finished", {
      winnerPlayerId: duel.winnerPlayerId,
      reason: duel.finishReason
    });
    const index = this.store.data.duelResults.findIndex((result) => result?.id === duel.id);
    const record = this.resultRecord(duel);
    if (index >= 0) this.store.data.duelResults[index] = record;
    else this.store.data.duelResults.push(record);
    if (this.store.data.duelResults.length > MAX_RESULTS) {
      this.store.data.duelResults.splice(0, this.store.data.duelResults.length - MAX_RESULTS);
    }
    await this.store.persist();
    this.notify(duel, [...pendingEvents, finished]);
    return duel;
  }

  async finishByFormat(duel, reason = "time_limit", pendingEvents = []) {
    if (duel.status === "finished" || duel.status === "cancelled") return duel;
    const mode = storedScrambleMode(duel.format).id;
    if (mode === RIDDLE_SAGA_FORMAT_ID) {
      await this.settleSagaChapter(duel, {
        reason: reason === "time_limit" ? "chapter_time_limit" : reason,
        pendingEvents
      });
      return duel;
    }
    if (mode === "wordstorm") {
      const entries = duel.participants.map((participant) => ({
        participant,
        run: this.run(participant),
        state: this.formatStateFor(duel, participant)
      }));
      let winner = "";
      let suffix = "draw";
      if (entries.length === 2 && entries[0].state.score !== entries[1].state.score) {
        winner = entries[0].state.score > entries[1].state.score
          ? entries[0].participant.playerId
          : entries[1].participant.playerId;
        suffix = "score";
      } else if (
        entries.length === 2
        && entries[0].run.rejectedAttempts !== entries[1].run.rejectedAttempts
      ) {
        winner = entries[0].run.rejectedAttempts < entries[1].run.rejectedAttempts
          ? entries[0].participant.playerId
          : entries[1].participant.playerId;
        suffix = "accuracy";
      }
      duel.formatResult = {
        format: mode,
        standings: entries.map(({ participant, run, state }) => ({
          slot: participant.slot,
          score: state.score,
          quota: state.quota,
          rejectedAttempts: run.rejectedAttempts
        }))
      };
      return this.finishDuel(duel, winner, `${reason}_${suffix}`, pendingEvents);
    }
    if (mode === "forge-clash") {
      const entries = duel.participants.map((participant) => ({
        participant,
        champion: this.formatStateFor(duel, participant).champion
      }));
      const battle = resolveForgeClash(entries[0]?.champion, entries[1]?.champion);
      const winner = battle.winner === "left"
        ? entries[0]?.participant.playerId || ""
        : battle.winner === "right"
          ? entries[1]?.participant.playerId || ""
          : "";
      duel.formatResult = {
        format: mode,
        battle: {
          winnerSlot: battle.winner === "left"
            ? entries[0]?.participant.slot || ""
            : battle.winner === "right"
              ? entries[1]?.participant.slot || ""
              : "",
          reason: battle.reason,
          left: publicChampion(battle.left),
          right: publicChampion(battle.right)
        }
      };
      return this.finishDuel(duel, winner, `${reason}_${battle.reason}`, pendingEvents);
    }
    return this.finishByProgress(duel, reason, pendingEvents);
  }

  async finishByProgress(duel, reason = "time_limit", pendingEvents = []) {
    if (duel.status === "finished" || duel.status === "cancelled") return duel;
    const progress = duel.participants.map((participant) => ({
      participant,
      remaining: Math.max(0, Math.floor(Number(this.routeProgress(this.run(participant))?.remaining) || 0))
    }));
    let winner = "";
    if (progress.length === 2 && progress[0].remaining !== progress[1].remaining) {
      winner = progress[0].remaining < progress[1].remaining
        ? progress[0].participant.playerId
        : progress[1].participant.playerId;
    }
    return this.finishDuel(duel, winner, winner ? `${reason}_progress` : `${reason}_draw`, pendingEvents);
  }

  async forfeit(duelId, playerId, options = {}) {
    const duel = this.duel(duelId);
    this.participant(duel, playerId);
    const id = actionId(options.actionId);
    const duplicate = this.receipt(duel, playerId, "forfeit", id);
    if (duplicate) return { duel: this.publicSnapshot(duel, playerId) };
    if (!ACTIVE_STATUSES.has(duel.status)) return { duel: this.publicSnapshot(duel, playerId) };
    this.rememberReceipt(duel, playerId, "forfeit", id);
    const opponent = duel.participants.find((participant) => participant.playerId !== playerId);
    if (duel.status === "waiting" || duel.status === "countdown" && this.now() < Number(duel.startsAt || Infinity)) {
      duel.rated = false;
    }
    await this.finishDuel(duel, opponent?.playerId || "", "forfeit");
    return { duel: this.publicSnapshot(duel, playerId) };
  }

  async requestRematch(duelId, playerId, options = {}) {
    const duel = this.duel(duelId);
    this.participant(duel, playerId);
    const id = actionId(options.actionId);
    const duplicate = this.receipt(duel, playerId, "rematch", id);
    if (duplicate) {
      const next = duel.rematchDuelId ? this.duel(duel.rematchDuelId) : duel;
      return { duel: this.publicSnapshot(next, playerId) };
    }
    if (duel.status !== "finished") throw serviceError(409, "Finish this Duel before requesting a rematch.", "duel_not_finished");
    this.rememberReceipt(duel, playerId, "rematch", id);
    if (!duel.rematchVotes.includes(playerId)) duel.rematchVotes.push(playerId);
    const events = [this.appendEvent(duel, "rematch_requested", { actorPlayerId: playerId })];
    if (duel.rematchVotes.length < 2) {
      await this.store.persist();
      this.notify(duel, events);
      return { duel: this.publicSnapshot(duel, playerId) };
    }
    const next = await this.createDuel("rematch", duel.participants.map((participant) => participant.playerId), {
      format: duel.format,
      target: duel.game.target,
      rated: false,
      rematchOf: duel.id
    });
    duel.rematchDuelId = next.id;
    const ready = this.appendEvent(duel, "rematch_ready", { nextDuelId: next.id });
    await this.store.persist();
    this.notify(duel, [...events, ready]);
    return { duel: this.publicSnapshot(next, playerId), rematchOf: duel.id };
  }

  async eventsSince(duelId, playerId, after = 0) {
    const duel = this.duel(duelId);
    this.participant(duel, playerId);
    const sequence = Math.max(0, Math.floor(Number(after) || 0));
    return duel.events
      .filter((event) => Number(event.sequence) > sequence)
      .map((event) => this.publicEvent(duel, event, playerId));
  }

  async rating(playerId, format = SCRAMBLE_DEFAULT_MODE_ID) {
    const mode = scrambleMode(format);
    const arena = publicScrambleArenaSnapshot(this.arena(playerId), {
      seasonId: DUEL_SEASON_ID
    });
    return {
      seasonId: DUEL_SEASON_ID,
      format: mode.id,
      modes: listScrambleModeDefinitions().map((entry) => clone(entry)),
      arena,
      rating: arena.ratings[mode.id]
    };
  }

  async leaderboard(limit = 50, format = SCRAMBLE_DEFAULT_MODE_ID) {
    const mode = scrambleMode(format);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 50)));
    const entries = Object.values(this.store.data.players)
      .map((player) => ({
        callsign: String(player.callsign || "STARGAZER"),
        ...this.modeRating(player.id, mode.id)
      }))
      .filter((entry) => entry.games >= 5)
      .sort((left, right) => right.rating - left.rating || right.wins - left.wins || left.callsign.localeCompare(right.callsign))
      .slice(0, safeLimit)
      .map((entry, index) => ({
        rank: index + 1,
        callsign: entry.callsign,
        rating: entry.rating,
        games: entry.games,
        wins: entry.wins,
        losses: entry.losses,
        draws: entry.draws
      }));
    return { seasonId: DUEL_SEASON_ID, format: mode.id, entries };
  }

  async tickDuel(duel) {
    const now = this.now();
    if (duel.status === "waiting" && duel.participants.length < 2 && now >= duel.expiresAt) {
      duel.status = "cancelled";
      duel.rated = false;
      duel.finishReason = "invite_expired";
      duel.settledAt = now;
      for (const participant of duel.participants) {
        const run = this.run(participant);
        run.expiresAt = Math.max(
          Number(run.expiresAt) || 0,
          duel.settledAt + FINISHED_DUEL_RETENTION_MS + 60_000
        );
        this.runRegistry.checkpoint(run);
      }
      const event = this.appendEvent(duel, "match_finished", { reason: duel.finishReason });
      await this.store.persist();
      this.notify(duel, event);
      return duel;
    }
    if (duel.status === "countdown" && duel.startsAt && now >= duel.startsAt) {
      duel.status = "active";
      const events = [this.appendEvent(duel, "match_started", {})];
      const saga = this.sagaFor(duel);
      if (saga) {
        const chapter = this.sagaChapter(duel);
        events.push(this.appendEvent(duel, "chapter_started", {
          ...this.sagaEventFields(duel, chapter),
          chapterStatus: "playing"
        }));
      }
      await this.store.persist();
      this.notify(duel, events);
    }
    const saga = this.sagaFor(duel);
    if (
      duel.status === "active"
      && saga?.status === "intermission"
      && now >= Number(saga.nextChapterAt || Infinity)
    ) {
      await this.activateNextSagaChapter(duel);
      return duel;
    }
    if (duel.status === "active" && duel.deadlineAt && now >= duel.deadlineAt) {
      await this.finishByFormat(duel);
      return duel;
    }
    if (!["countdown", "active"].includes(duel.status)) return duel;
    const disconnectEvents = [];
    for (const participant of duel.participants) {
      if (participant.disconnectedAt == null && now - participant.lastSeenAt >= DUEL_DISCONNECT_AFTER_MS) {
        participant.disconnectedAt = now;
        disconnectEvents.push(this.appendEvent(duel, "player_disconnected", { actorPlayerId: participant.playerId }));
      }
    }
    const forfeited = duel.participants.filter((participant) =>
      participant.disconnectedAt != null && now - participant.disconnectedAt >= DUEL_RECONNECT_GRACE_MS
    );
    if (forfeited.length) {
      if (forfeited.some((participant) =>
        Number(duel.startsAt) > 0
        && Number(participant.lastSeenAt) < Number(duel.startsAt)
      )) {
        duel.rated = false;
      }
      if (forfeited.length === duel.participants.length) {
        duel.rated = false;
        await this.finishDuel(duel, "", "both_disconnected", disconnectEvents);
      } else {
        const winner = duel.participants.find((participant) => !forfeited.includes(participant));
        await this.finishDuel(duel, winner?.playerId || "", "disconnect_forfeit", disconnectEvents);
      }
      return duel;
    }
    if (disconnectEvents.length) {
      await this.store.persist();
      this.notify(duel, disconnectEvents);
    }
    return duel;
  }

  async tick() {
    const now = this.now();
    let pruned = false;
    for (const [playerId, ticket] of this.queue) {
      if (now - ticket.joinedAt >= DUEL_QUEUE_TTL_MS) this.queue.delete(playerId);
    }
    for (const duel of Object.values(this.store.data.duels)) await this.tickDuel(duel);
    for (const [duelId, duel] of Object.entries(this.store.data.duels)) {
      if (!["finished", "cancelled"].includes(duel.status) || now - Number(duel.settledAt || duel.createdAt) < FINISHED_DUEL_RETENTION_MS) continue;
      for (const runId of this.sagaRunIds(duel)) this.runRegistry.discard(runId);
      delete this.store.data.duels[duelId];
      this.listeners.delete(duelId);
      pruned = true;
    }
    if (pruned) await this.store.persist();
    return { queued: this.queue.size, active: Object.values(this.store.data.duels).filter((duel) => ACTIVE_STATUSES.has(duel.status)).length };
  }

  async revokePlayer(playerId) {
    this.queue.delete(playerId);
    for (const duel of Object.values(this.store.data.duels)) {
      if (!ACTIVE_STATUSES.has(duel.status) || !duel.participants.some((participant) => participant.playerId === playerId)) continue;
      const opponent = duel.participants.find((participant) => participant.playerId !== playerId);
      duel.rated = false;
      await this.finishDuel(duel, opponent?.playerId || "", "player_data_deleted");
    }
    return { revoked: true };
  }

  async shutdown() {
    this.queue.clear();
    this.listeners.clear();
    await this.store.persist();
  }
}
