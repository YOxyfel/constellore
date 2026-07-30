const ORIGIN_WORDS = Object.freeze([
  Object.freeze({ word: "Earth", emoji: "\u{1F30D}", category: "nature", source: "origin" }),
  Object.freeze({ word: "Water", emoji: "\u{1F4A7}", category: "force", source: "origin" }),
  Object.freeze({ word: "Fire", emoji: "\u{1F525}", category: "force", source: "origin" }),
  Object.freeze({ word: "Air", emoji: "\u{1F4A8}", category: "force", source: "origin" })
]);
const SCRAMBLE_FORMATS = new Set(["target-race", "wordstorm", "forge-clash", "riddle-saga"]);
const MAX_WORDS = 180;
const MAX_HISTORY = 180;

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maximum = 96) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function integer(value, minimum = 0, maximum = 1_000_000_000) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : minimum;
}

function formatId(value) {
  const format = text(value, 32).toLowerCase();
  return SCRAMBLE_FORMATS.has(format) ? format : "target-race";
}

function wordItem(value, fallbackSource = "scramble") {
  const source = typeof value === "string" ? { word: value } : record(value);
  const word = text(source.word, 48);
  if (!word) return null;
  return {
    word,
    emoji: text(source.emoji, 12) || "\u2726",
    category: text(source.category, 32),
    source: text(source.source, 32) || fallbackSource
  };
}

function wordKey(value) {
  return text(typeof value === "string" ? value : value?.word, 48).toLocaleLowerCase("en-US");
}

function uniqueWords(values, maximum = MAX_WORDS) {
  const words = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const item = wordItem(value);
    const key = wordKey(item);
    if (!item || !key || seen.has(key)) continue;
    seen.add(key);
    words.push(item);
    if (words.length >= maximum) break;
  }
  return words;
}

function historyStep(value) {
  const source = record(value);
  const result = wordItem(source.result || source, "scramble");
  const a = text(source.a, 48);
  const b = text(source.b, 48);
  if (!result || !a || !b) return null;
  return {
    a,
    b,
    word: result.word,
    emoji: result.emoji,
    category: result.category,
    source: result.source,
    newDiscovery: false,
    progressionEligible: false,
    eventEligible: false,
    contextual: false,
    context: "scramble"
  };
}

function selfBoard(match) {
  const selfId = text(match?.selfId || match?.selfSlot, 96);
  const boards = Array.isArray(match?.boards) ? match.boards : [];
  return (selfId ? boards.find((value) => text(value?.slot || value?.id, 96) === selfId) : null)
    || boards.find((value) => text(value?.side, 16) === "self")
    || null;
}

function currentSaga(match) {
  const saga = record(match?.saga);
  const chapter = record(saga.currentChapter || saga.chapter);
  const chapterNumber = integer(
    saga.chapterNumber ?? (Number.isFinite(Number(saga.chapterIndex)) ? Number(saga.chapterIndex) + 1 : 0),
    0,
    20
  );
  return {
    source: saga,
    chapter,
    chapterNumber,
    revision: integer(saga.revision ?? saga.chapterVersion, 0),
    status: text(saga.status, 24).toLowerCase(),
    target: text(chapter.target?.word || chapter.target, 48),
    title: text(chapter.title, 100),
    story: text(chapter.story, 280),
    startsAt: text(
      chapter.startsAt || chapter.chapterStartsAt || saga.chapterStartsAt || match?.startsAt,
      64
    ),
    deadlineAt: text(
      chapter.deadlineAt || chapter.chapterDeadlineAt || saga.chapterDeadlineAt || match?.deadlineAt,
      64
    )
  };
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function scrambleGameSeed(match) {
  const saga = currentSaga(match);
  return stableHash([
    text(match?.id, 96) || "scramble",
    formatId(match?.format),
    text(match?.rulesVersion || match?.formatVersion, 32) || "1",
    formatId(match?.format) === "riddle-saga" ? saga.chapterNumber || 1 : "",
    formatId(match?.format) === "riddle-saga" ? saga.revision || 1 : "",
    formatId(match?.format) === "riddle-saga" ? saga.target : text(match?.target, 48) || "target"
  ].join(":")) || 1;
}

export function scrambleObjectivePresentation(match) {
  const format = formatId(match?.format);
  const rules = record(match?.rules);
  if (format === "wordstorm") {
    const quota = integer(rules.discoveryQuota || 12, 1, 999);
    return {
      format,
      modeName: "WORDSTORM",
      objectiveVerb: "Find",
      target: `${quota} discoveries`,
      emoji: "\u2604"
    };
  }
  if (format === "forge-clash") {
    const turnLimit = integer(rules.turnLimit || 6, 1, 99);
    return {
      format,
      modeName: "FORGE CLASH",
      objectiveVerb: "Forge",
      target: `a champion in ${turnLimit} turns`,
      emoji: "\u2694"
    };
  }
  if (format === "riddle-saga") {
    const saga = currentSaga(match);
    return {
      format,
      modeName: "RIDDLE SAGA",
      objectiveVerb: "Solve",
      target: saga.target,
      emoji: "\u2727",
      chapterNumber: saga.chapterNumber,
      chapterTitle: saga.title,
      chapterStory: saga.story
    };
  }
  return {
    format,
    modeName: "TARGET RACE",
    objectiveVerb: "Make",
    target: text(match?.target, 48),
    emoji: "\u2726"
  };
}

export function scrambleHostEpoch(match) {
  const id = text(match?.id, 96);
  const format = formatId(match?.format);
  if (!id) return "";
  if (format !== "riddle-saga") return `${id}:${format}`;
  const saga = currentSaga(match);
  if (saga.status !== "playing" || !saga.chapterNumber || !saga.target) return "";
  return [
    id,
    format,
    saga.chapterNumber,
    saga.revision || saga.startsAt || saga.target.toLocaleLowerCase("en-US")
  ].join(":");
}

/**
 * Converts the lazy runtime's sanitized raw match into the small host contract
 * needed by app.js. Riddle Saga deliberately reads only the current
 * authoritative board, history, target, and starters; old chapter events can
 * therefore remain visible in the Arena feed without leaking into a new board.
 */
export function projectScrambleHostMatch(match) {
  const source = record(match);
  const objective = scrambleObjectivePresentation(source);
  const id = text(source.id, 96);
  const epochKey = scrambleHostEpoch(source);
  if (!id || !epochKey || !objective.target) return null;

  const saga = currentSaga(source);
  const authoritativeBoard = selfBoard(source);
  if (
    objective.format === "riddle-saga"
    && (!text(source.selfId || source.selfSlot, 96) || !authoritativeBoard)
  ) return null;
  const board = record(authoritativeBoard);
  const suppliedStarters = uniqueWords(source.starters);
  if (objective.format === "riddle-saga" && !suppliedStarters.length) return null;
  const starters = suppliedStarters.length
    ? suppliedStarters
    : ORIGIN_WORDS.map((item) => ({ ...item }));
  const boardWords = uniqueWords(board.words);
  const words = uniqueWords([...starters, ...boardWords]);
  const history = (Array.isArray(board.history) ? board.history : [])
    .slice(-MAX_HISTORY)
    .map(historyStep)
    .filter(Boolean);
  const formatState = record(board.formatState);
  const player = (Array.isArray(source.players) ? source.players : [])
    .find((entry) => text(entry?.id || entry?.slot, 96) === text(source.selfId || source.selfSlot, 96));
  const playerFormatState = record(player?.formatState);
  const starterKeys = new Set(starters.map(wordKey));
  const discoveredCount = words.reduce((count, item) => count + (starterKeys.has(wordKey(item)) ? 0 : 1), 0);
  const startsAt = objective.format === "riddle-saga" ? saga.startsAt : text(source.startsAt, 64);
  const deadlineAt = objective.format === "riddle-saga" ? saga.deadlineAt : text(source.deadlineAt, 64);
  const durationSeconds = Math.max(
    1,
    integer(source.durationSeconds || 300, 1, 3_600)
  );
  const seed = scrambleGameSeed(source);

  return {
    epochKey,
    game: {
      id,
      mode: "scramble",
      modeName: objective.modeName,
      target: objective.target,
      objectiveVerb: objective.objectiveVerb,
      scrambleFormat: objective.format,
      scrambleTarget: objective.format === "riddle-saga" ? saga.target : text(source.target, 48),
      scrambleObjective: text(source.objective, 180),
      scrambleRules: { ...record(source.rules) },
      emoji: objective.emoji,
      category: "celestial",
      seed,
      starters: starters.map((item) => item.word),
      starterItems: starters,
      timeLimit: durationSeconds,
      moveLimit: 0,
      scoreEligible: false,
      scoreMultiplier: 0,
      difficultyTag: ""
    },
    run: {
      id,
      token: "duel-server-membership",
      ranked: false,
      duelRanked: source.ranked === true,
      scrambleFormat: objective.format,
      startedAt: startsAt,
      deadlineAt,
      assist: "duel",
      assisted: true,
      scoreEligible: false,
      rewardEligible: false,
      leaderboardEligible: false,
      scoreMultiplier: 0
    },
    board: {
      words,
      history,
      moves: Math.max(
        integer(board.attempts, 0, 10_000),
        integer(board.moves, 0, 10_000),
        history.length
      ),
      newDiscoveries: Math.max(
        integer(formatState.discoveries ?? playerFormatState.discoveries, 0, 10_000),
        discoveredCount
      )
    }
  };
}
