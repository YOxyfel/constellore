import {
  COSMOS_CIRCUIT_VERSION,
  cosmosCircuitCourse,
  cosmosCircuitWeek,
  sanitizeCircuitRun
} from "./cosmos-circuit.mjs?v=5.0.0-beta.1";

export const CIRCUIT_LIVE_OPS_VERSION = 1;
export const WEEKLY_CIRCUIT_OBJECTIVES = 3;
export const MAX_WEEKLY_CREDITED_RUNS = 128;
export const MAX_PERSONAL_CIRCUIT_RECORDS = 120;

const DAY_MS = 86_400_000;
const FALLBACK_MS = Date.UTC(2024, 0, 1);
const MAX_RUN_ID_LENGTH = 80;
const MAX_SCORE = 10_000_000;
const MAX_ELAPSED_MS = 10 * 60_000;
const MILESTONES = new Set(["none", "drift", "orbit", "nebula", "galaxy", "cosmos"]);
const MODES = new Set(["ticketed", "practice"]);

const OBJECTIVE_SETS = Object.freeze([
  Object.freeze([
    Object.freeze({
      id: "complete-flights",
      label: "Complete two flights",
      description: "Reach the end of any two Circuit flights. Practice Flights count.",
      metric: "completedCourse",
      aggregation: "sum",
      target: 2,
      unit: "flights"
    }),
    Object.freeze({
      id: "planet-navigation",
      label: "Pass sixteen planet gates",
      description: "Pass 16 planet gates across verified flights.",
      metric: "planetGatesPassed",
      aggregation: "sum",
      target: 16,
      unit: "gates"
    }),
    Object.freeze({
      id: "perfect-slingshots",
      label: "Make two perfect slingshots",
      description: "Clear two black-hole tunnels with a perfect line across any flights.",
      metric: "perfectSlingshots",
      aggregation: "sum",
      target: 2,
      unit: "slingshots"
    })
  ]),
  Object.freeze([
    Object.freeze({
      id: "sector-survey",
      label: "Clear six sectors",
      description: "Clear six full sectors across verified flights.",
      metric: "sectorsCleared",
      aggregation: "sum",
      target: 6,
      unit: "sectors"
    }),
    Object.freeze({
      id: "stardust-pilot",
      label: "Collect 90 Stardust points",
      description: "Add together your Stardust percentages across any flights.",
      metric: "stardustPercent",
      aggregation: "sum",
      target: 90,
      unit: "points"
    }),
    Object.freeze({
      id: "flow-chain",
      label: "Build twelve Flow",
      description: "Add together your best Flow chain from each flight.",
      metric: "maxFlow",
      aggregation: "sum",
      target: 12,
      unit: "flow"
    })
  ]),
  Object.freeze([
    Object.freeze({
      id: "black-hole-cartography",
      label: "Chart four black holes",
      description: "Clear four black-hole tunnels across verified flights.",
      metric: "blackHolesCleared",
      aggregation: "sum",
      target: 4,
      unit: "tunnels"
    }),
    Object.freeze({
      id: "shielded-arrival",
      label: "Finish with shields intact",
      description: "Complete one flight without losing shield integrity.",
      metric: "shieldedFinish",
      aggregation: "sum",
      target: 1,
      unit: "flights"
    }),
    Object.freeze({
      id: "three-finishes",
      label: "Complete three flights",
      description: "Reach the end of any three Circuit flights. Practice Flights count.",
      metric: "completedCourse",
      aggregation: "sum",
      target: 3,
      unit: "flights"
    })
  ]),
  Object.freeze([
    Object.freeze({
      id: "long-range-navigation",
      label: "Pass twenty planet gates",
      description: "Pass 20 planet gates across verified flights.",
      metric: "planetGatesPassed",
      aggregation: "sum",
      target: 20,
      unit: "gates"
    }),
    Object.freeze({
      id: "deep-sector-survey",
      label: "Clear six sectors",
      description: "Clear six full sectors across verified flights.",
      metric: "sectorsCleared",
      aggregation: "sum",
      target: 6,
      unit: "sectors"
    }),
    Object.freeze({
      id: "four-finishes",
      label: "Complete four flights",
      description: "Reach the end of any four Circuit flights. Practice Flights count.",
      metric: "completedCourse",
      aggregation: "sum",
      target: 4,
      unit: "flights"
    })
  ]),
  Object.freeze([
    Object.freeze({
      id: "deep-gravity",
      label: "Clear six black holes",
      description: "Clear six black-hole tunnels across verified flights.",
      metric: "blackHolesCleared",
      aggregation: "sum",
      target: 6,
      unit: "tunnels"
    }),
    Object.freeze({
      id: "stardust-cartographer",
      label: "Collect 120 Stardust points",
      description: "Add together your Stardust percentages across any flights.",
      metric: "stardustPercent",
      aggregation: "sum",
      target: 120,
      unit: "points"
    }),
    Object.freeze({
      id: "gravity-virtuoso",
      label: "Make three perfect slingshots",
      description: "Clear three black-hole tunnels with a perfect line across any flights.",
      metric: "perfectSlingshots",
      aggregation: "sum",
      target: 3,
      unit: "slingshots"
    })
  ])
]);

const REWARD_SPECS = Object.freeze([
  Object.freeze({
    kind: "profileBadge",
    slug: "weekly-navigator",
    label: "Weekly Navigator Badge",
    description: "A dated profile badge marking this week's completed flight objective."
  }),
  Object.freeze({
    kind: "shipDecal",
    slug: "charted-course",
    label: "Charted Course Decal",
    description: "A cosmetic hull marking traced from this week's Circuit."
  }),
  Object.freeze({
    kind: "ostRemix",
    slug: "flight-lines",
    label: "Flight Lines OST Remix",
    description: "A presentation-only arrangement inspired by this week's course."
  })
]);

function cleanText(value, maximum = 96) {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanId(value, maximum = MAX_RUN_ID_LENGTH) {
  return cleanText(value, maximum)
    .toLocaleLowerCase("en-US")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function validDayKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

function validWeekKey(value) {
  return typeof value === "string" && /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(value) ? value : "";
}

function safeDate(value) {
  if (value === undefined) return new Date();
  if (value instanceof Date && Number.isFinite(value.getTime())) return new Date(value.getTime());
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
  }
  if (typeof value === "string" && value.length <= 64) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
  }
  return new Date(FALLBACK_MS);
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function countdownLabel(remainingSeconds) {
  const hours = Math.floor(remainingSeconds / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  const seconds = remainingSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

/**
 * Metadata for the active globally deterministic UTC course. Calling this with
 * the same timestamp always returns the same course and countdown.
 */
export function circuitDailyRotation(value = new Date()) {
  const now = safeDate(value);
  const course = cosmosCircuitCourse(now);
  const endsAtMs = Date.parse(course.endsAt);
  const remainingMs = Math.max(0, Math.min(DAY_MS, endsAtMs - now.getTime()));
  const remainingSeconds = Math.ceil(remainingMs / 1_000);
  const nextCourse = cosmosCircuitCourse(course.endsAt);
  return {
    version: CIRCUIT_LIVE_OPS_VERSION,
    circuitVersion: COSMOS_CIRCUIT_VERSION,
    courseId: course.id,
    courseName: course.name,
    dayKey: course.dayKey,
    weekKey: course.weekKey,
    seed: course.seed,
    startsAt: course.startsAt,
    endsAt: course.endsAt,
    nextCourseId: nextCourse.id,
    countdown: {
      remainingMs,
      remainingSeconds,
      label: countdownLabel(remainingSeconds)
    }
  };
}

function rewardFor(week, slot) {
  const spec = REWARD_SPECS[slot];
  const weekToken = week.weekKey.toLocaleLowerCase("en-US");
  return {
    id: `constellore.circuit.weekly.${weekToken}.${spec.kind}.${spec.slug}`,
    label: `${week.name} ${spec.label}`,
    description: spec.description,
    kind: spec.kind,
    quantity: 1,
    access: "everyone",
    exact: true,
    randomized: false,
    cosmeticOnly: true,
    gameplayEffect: "none"
  };
}

function cloneReward(reward) {
  return { ...reward };
}

function cloneObjective(objective) {
  return {
    ...objective,
    reward: cloneReward(objective.reward)
  };
}

function objectiveSet(value) {
  const week = cosmosCircuitWeek(value);
  const specs = OBJECTIVE_SETS[week.rotationIndex % OBJECTIVE_SETS.length];
  return {
    week,
    objectives: specs.map((spec, slot) => ({
      ...spec,
      slot: slot + 1,
      practiceCounts: true,
      authoritativeMetricsOnly: true,
      reward: rewardFor(week, slot)
    }))
  };
}

/**
 * Three fixed objectives per Circuit week. Selection follows the authored
 * course rotation and contains no random draw or player-specific targeting.
 */
export function circuitWeeklyChallenges(value = new Date()) {
  const { week, objectives } = objectiveSet(value);
  return {
    version: CIRCUIT_LIVE_OPS_VERSION,
    weekKey: week.weekKey,
    startsAt: week.startsAt,
    endsAt: week.endsAt,
    circuitId: week.id,
    title: `${week.name} Weekly Flight Log`,
    description: "Complete any of these with verified Launch or Practice Flights.",
    fairness: {
      deterministic: true,
      practiceCounts: true,
      cosmeticOnlyRewards: true,
      randomRewards: false,
      grantsPasses: false,
      grantsBoosts: false,
      grantsCurrency: false,
      gameplayAdvantage: false
    },
    objectives: objectives.map(cloneObjective)
  };
}

function dateForIsoWeek(year, week) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const weekday = januaryFourth.getUTCDay() || 7;
  return new Date(januaryFourth.getTime() - (weekday - 1) * DAY_MS + (week - 1) * 7 * DAY_MS);
}

/** Resolves only one authored deterministic weekly cosmetic reward ID. */
export function circuitWeeklyRewardById(value) {
  const id = cleanText(value, 180);
  const match = /^constellore[.]circuit[.]weekly[.](\d{4})-w(\d{2})[.]/.exec(id);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const at = dateForIsoWeek(year, week);
  if (!Number.isFinite(at.getTime())) return null;
  const weekly = circuitWeeklyChallenges(at);
  if (weekly.weekKey.toLocaleLowerCase("en-US") !== `${match[1]}-w${match[2]}`) return null;
  const reward = weekly.objectives
    .map((objective) => objective.reward)
    .find((candidate) => candidate.id === id);
  return reward ? cloneReward(reward) : null;
}

function progressSource(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const nested = raw.progress && typeof raw.progress === "object" && !Array.isArray(raw.progress)
    ? raw.progress
    : raw.objectiveProgress && typeof raw.objectiveProgress === "object" && !Array.isArray(raw.objectiveProgress)
      ? raw.objectiveProgress
      : {};
  return nested;
}

function sanitizeRunLedger(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values.slice(0, MAX_WEEKLY_CREDITED_RUNS) : []) {
    const id = cleanId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/**
 * Bounded local weekly state. Unknown objective keys and stale-week progress
 * are discarded; claims survive only when their objective is complete.
 */
export function sanitizeCircuitWeeklyState(raw, value = new Date()) {
  const weekly = circuitWeeklyChallenges(value);
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const sourceWeekKey = validWeekKey(source.weekKey);
  const current = !sourceWeekKey || sourceWeekKey === weekly.weekKey;
  const rawProgress = current ? progressSource(source) : {};
  const progress = {};
  for (const objective of weekly.objectives) {
    progress[objective.id] = clampInteger(rawProgress[objective.id], 0, objective.target, 0);
  }
  const completedIds = new Set(weekly.objectives
    .filter((objective) => progress[objective.id] >= objective.target)
    .map((objective) => objective.id));
  const claimed = [];
  const seenClaims = new Set();
  const rawClaims = source.claimedObjectiveIds ?? source.claimed;
  for (const value of current && Array.isArray(rawClaims) ? rawClaims.slice(0, WEEKLY_CIRCUIT_OBJECTIVES * 2) : []) {
    const id = cleanId(value);
    if (!completedIds.has(id) || seenClaims.has(id)) continue;
    seenClaims.add(id);
    claimed.push(id);
  }
  const rawLedger = source.creditedRunIds ?? source.runIds;
  return {
    version: CIRCUIT_LIVE_OPS_VERSION,
    weekKey: weekly.weekKey,
    creditedRunIds: current ? sanitizeRunLedger(rawLedger) : [],
    progress,
    claimedObjectiveIds: claimed
  };
}

function objectiveMeasurement(metric, metrics) {
  switch (metric) {
    case "completedCourse":
      return metrics.completedCourse === true ? 1 : 0;
    case "planetGatesPassed":
      return clampInteger(metrics.planetGatesPassed, 0, 8, 0);
    case "perfectSlingshots":
      return clampInteger(metrics.perfectSlingshots, 0, 2, 0);
    case "sectorsCleared":
      return clampInteger(metrics.sectorsCleared, 0, 3, 0);
    case "stardustPercent":
      return clampInteger(metrics.stardustPercent, 0, 100, 0);
    case "maxFlow":
      return clampInteger(metrics.maxFlow, 0, 64, 0);
    case "blackHolesCleared":
      return clampInteger(metrics.blackHolesCleared, 0, 2, 0);
    case "shieldedFinish":
      return metrics.completedCourse === true && metrics.shieldIntact === true ? 1 : 0;
    case "cosmosComplete":
      return metrics.cosmosComplete === true ? 1 : 0;
    default:
      return 0;
  }
}

/**
 * Records one verified finished run. Metrics are always rebuilt by
 * sanitizeCircuitRun; caller-supplied metrics and reward fields are ignored.
 */
export function recordCircuitWeeklyProgress(rawState, rawRun, {
  verified = false,
  at = new Date()
} = {}) {
  const state = sanitizeCircuitWeeklyState(rawState, at);
  if (verified !== true) {
    return { state, recorded: false, advanced: false, reason: "verification_required", updates: [] };
  }
  const run = sanitizeCircuitRun(rawRun);
  if (!run || run.status !== "finished" || !run.result) {
    return { state, recorded: false, advanced: false, reason: "finished_run_required", updates: [] };
  }
  if (run.path === "crazy") {
    return { state, recorded: false, advanced: false, reason: "crazy_path_excluded", updates: [] };
  }
  if (run.weekKey !== state.weekKey) {
    return { state, recorded: false, advanced: false, reason: "wrong_week", updates: [] };
  }
  if (state.creditedRunIds.includes(run.id)) {
    return { state, recorded: false, advanced: false, reason: "already_credited", updates: [] };
  }
  if (state.creditedRunIds.length >= MAX_WEEKLY_CREDITED_RUNS) {
    return { state, recorded: false, advanced: false, reason: "run_ledger_full", updates: [] };
  }
  const weekly = circuitWeeklyChallenges(at);
  const nextState = {
    ...state,
    creditedRunIds: [...state.creditedRunIds, run.id],
    progress: { ...state.progress },
    claimedObjectiveIds: [...state.claimedObjectiveIds]
  };
  const updates = [];
  for (const objective of weekly.objectives) {
    const before = nextState.progress[objective.id];
    const measured = objectiveMeasurement(objective.metric, run.metrics);
    const after = objective.aggregation === "max"
      ? Math.max(before, Math.min(objective.target, measured))
      : Math.min(objective.target, before + measured);
    nextState.progress[objective.id] = after;
    updates.push({
      objectiveId: objective.id,
      before,
      after,
      added: after - before,
      complete: after >= objective.target
    });
  }
  return {
    state: nextState,
    recorded: true,
    advanced: updates.some((update) => update.added > 0),
    reason: "run_recorded",
    mode: run.mode,
    updates
  };
}

/** Claims one exact weekly cosmetic reward, once. */
export function claimCircuitWeeklyReward(rawState, rawObjective, value = new Date()) {
  const state = sanitizeCircuitWeeklyState(rawState, value);
  const objectiveId = cleanId(
    rawObjective && typeof rawObjective === "object" ? rawObjective.objectiveId ?? rawObjective.id : rawObjective
  );
  const weekly = circuitWeeklyChallenges(value);
  const objective = weekly.objectives.find((entry) => entry.id === objectiveId);
  if (!objective) return { state, claimed: false, reward: null, reason: "unknown_objective" };
  if (state.progress[objective.id] < objective.target) {
    return { state, claimed: false, reward: null, reason: "objective_incomplete" };
  }
  if (state.claimedObjectiveIds.includes(objective.id)) {
    return { state, claimed: false, reward: null, reason: "already_claimed" };
  }
  const nextState = {
    ...state,
    creditedRunIds: [...state.creditedRunIds],
    progress: { ...state.progress },
    claimedObjectiveIds: [...state.claimedObjectiveIds, objective.id]
  };
  return {
    state: nextState,
    claimed: true,
    reward: cloneReward(objective.reward),
    reason: "reward_claimed"
  };
}

function milestoneRank(value) {
  return ["none", "drift", "orbit", "nebula", "galaxy", "cosmos"].indexOf(value);
}

function compareFlightRecords(left, right) {
  if (left.score !== right.score) return right.score - left.score;
  const milestoneDifference = milestoneRank(right.milestone) - milestoneRank(left.milestone);
  if (milestoneDifference) return milestoneDifference;
  if (left.elapsedMs !== right.elapsedMs) return left.elapsedMs - right.elapsedMs;
  return left.runId.localeCompare(right.runId, "en-US");
}

function sanitizeFlightRecord(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const dayKey = validDayKey(source.dayKey ?? source.courseDayKey);
  const runId = cleanId(source.runId ?? source.id);
  const mode = MODES.has(source.mode) ? source.mode : "";
  if (!dayKey || !runId || !mode || source.verified !== true) return null;
  const course = cosmosCircuitCourse(dayKey);
  if (cleanText(source.courseId, 40) !== course.id) return null;
  const milestone = MILESTONES.has(source.milestone) ? source.milestone : "none";
  return {
    courseId: course.id,
    dayKey,
    weekKey: course.weekKey,
    mode,
    runId,
    score: clampInteger(source.score, 0, MAX_SCORE, 0),
    elapsedMs: clampInteger(source.elapsedMs, 0, MAX_ELAPSED_MS, MAX_ELAPSED_MS),
    milestone,
    stars: milestone === "cosmos" ? 3 : ["nebula", "galaxy"].includes(milestone) ? 2 : milestone === "none" ? 0 : 1,
    verified: true
  };
}

function sortPersonalRecords(left, right) {
  const dayDifference = right.dayKey.localeCompare(left.dayKey, "en-US");
  if (dayDifference) return dayDifference;
  if (left.mode !== right.mode) return left.mode === "ticketed" ? -1 : 1;
  return compareFlightRecords(left, right);
}

/**
 * Fixed-shape, personal-only record storage. At most one best verified Launch
 * record and one best verified Practice record are retained per daily course.
 */
export function sanitizePersonalCircuitBoard(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const rawRecords = Array.isArray(raw) ? raw : source.records;
  const bestByCourseAndMode = new Map();
  for (const rawRecord of Array.isArray(rawRecords) ? rawRecords.slice(0, MAX_PERSONAL_CIRCUIT_RECORDS * 3) : []) {
    const record = sanitizeFlightRecord(rawRecord);
    if (!record) continue;
    const key = `${record.courseId}:${record.mode}`;
    const current = bestByCourseAndMode.get(key);
    if (!current || compareFlightRecords(record, current) < 0) bestByCourseAndMode.set(key, record);
  }
  return {
    version: CIRCUIT_LIVE_OPS_VERSION,
    scope: "personal-local",
    records: [...bestByCourseAndMode.values()]
      .sort(sortPersonalRecords)
      .slice(0, MAX_PERSONAL_CIRCUIT_RECORDS)
  };
}

function recordFromRun(run) {
  return {
    courseId: run.courseId,
    dayKey: run.courseDayKey,
    weekKey: run.weekKey,
    mode: run.mode,
    runId: run.id,
    score: run.metrics.score,
    elapsedMs: run.end?.elapsedMs ?? MAX_ELAPSED_MS,
    milestone: run.result?.milestone ?? "none",
    stars: run.result?.stars ?? 0,
    verified: true
  };
}

/** Adds or replaces a personal best using the stable score/time/run-id order. */
export function recordPersonalCircuitResult(rawBoard, rawRun, {
  verified = false
} = {}) {
  const board = sanitizePersonalCircuitBoard(rawBoard);
  if (verified !== true) return { board, recorded: false, replaced: false, reason: "verification_required", record: null };
  const run = sanitizeCircuitRun(rawRun);
  if (!run || run.status !== "finished" || !run.result) {
    return { board, recorded: false, replaced: false, reason: "finished_run_required", record: null };
  }
  if (run.path === "crazy") {
    return { board, recorded: false, replaced: false, reason: "crazy_path_excluded", record: null };
  }
  const candidate = sanitizeFlightRecord(recordFromRun(run));
  if (!candidate) return { board, recorded: false, replaced: false, reason: "invalid_record", record: null };
  const existing = board.records.find((record) => (
    record.courseId === candidate.courseId && record.mode === candidate.mode
  ));
  if (existing?.runId === candidate.runId) {
    return { board, recorded: false, replaced: false, reason: "already_recorded", record: { ...existing } };
  }
  if (existing && compareFlightRecords(candidate, existing) >= 0) {
    return { board, recorded: false, replaced: false, reason: "not_personal_best", record: { ...existing } };
  }
  const nextRecords = board.records.filter((record) => !(
    record.courseId === candidate.courseId && record.mode === candidate.mode
  ));
  const nextBoard = sanitizePersonalCircuitBoard({ records: [...nextRecords, candidate] });
  return {
    board: nextBoard,
    recorded: true,
    replaced: Boolean(existing),
    reason: existing ? "personal_best_improved" : "personal_best_recorded",
    record: { ...candidate }
  };
}

/** Presentation model with Practice Flights explicitly separated. */
export function personalCircuitRecordBoard(rawBoard, { limit = 20 } = {}) {
  const board = sanitizePersonalCircuitBoard(rawBoard);
  const count = clampInteger(limit, 1, MAX_PERSONAL_CIRCUIT_RECORDS, 20);
  return {
    version: CIRCUIT_LIVE_OPS_VERSION,
    scope: "personal-local",
    privacy: {
      otherPlayers: false,
      fakePlayers: false,
      piiStored: false
    },
    launch: {
      label: "My Launch Flights",
      records: board.records.filter((record) => record.mode === "ticketed").slice(0, count)
    },
    practice: {
      label: "My Practice Flights",
      rewardEligible: false,
      records: board.records.filter((record) => record.mode === "practice").slice(0, count)
    }
  };
}
