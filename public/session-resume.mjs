import { assistancePolicy } from "./engagement-features.mjs?v=5.0.0-beta.4";
import { createFirstOrbitGame } from "./first-orbit.mjs?v=5.0.0-beta.4";
import { createSecondOrbitGame, secondOrbitProgress } from "./second-orbit.mjs?v=5.0.0-beta.4";
import { exploreGame } from "./explore-sandbox.mjs?v=5.0.0-beta.4";
import { selectUniverse } from "./universe-director.mjs?v=5.0.0-beta.4";

export const CLIENT_ONLY_RESUME_MODES = new Set(["training", "second-orbit", "explore"]);
export const FIRST_OPEN_CINEMATIC_SESSION_KEY = "constellore-launch-cinematic-session-v1";

function timestamp(now = Date.now) {
  const value = typeof now === "function" ? now() : now;
  return Number.isFinite(Number(value)) ? Number(value) : Date.now();
}

export function navigationIsReload(performanceRef = globalThis.performance) {
  try {
    const navigation = performanceRef?.getEntriesByType?.("navigation")?.[0];
    if (navigation?.type) return navigation.type === "reload";
    return performanceRef?.navigation?.type === 1;
  } catch {
    return false;
  }
}

export function markLaunchCinematicSessionPlayed(
  storage,
  key = FIRST_OPEN_CINEMATIC_SESSION_KEY
) {
  try {
    const target = storage ?? globalThis.sessionStorage;
    target?.setItem?.(key, "played");
    return target?.getItem?.(key) === "played";
  } catch {
    return false;
  }
}

export function snapshotMatchesLaunchIntent(snapshot, sharedChallenge, modeIntent) {
  if (!snapshot?.game) return false;
  if (sharedChallenge) {
    return String(snapshot.game.target || "").trim().toLowerCase()
        === String(sharedChallenge.target || "").trim().toLowerCase()
      && String(snapshot.game.seed ?? "") === String(sharedChallenge.seed ?? "");
  }
  if (!modeIntent) return false;
  const expectedMode = modeIntent === "creator" ? "explore" : modeIntent;
  return String(snapshot.game.mode || "").trim().toLowerCase() === expectedMode;
}

export function selectStartupResumeSnapshot({
  snapshot = null,
  sharedChallenge = null,
  modeIntent = "",
  reload = navigationIsReload()
} = {}) {
  if (!snapshot) return null;
  if (
    reload
    || (!sharedChallenge && !modeIntent)
    || snapshotMatchesLaunchIntent(snapshot, sharedChallenge, modeIntent)
  ) return snapshot;
  return null;
}

export function createClientRunPersistence({
  game = null,
  mode = game?.mode,
  startedAt = Date.now(),
  cryptoRef = globalThis.crypto,
  now = Date.now,
  random = Math.random
} = {}) {
  const normalizedMode = String(mode || "").trim().toLowerCase();
  if (!game || !CLIENT_ONLY_RESUME_MODES.has(normalizedMode)) return null;
  const currentTime = timestamp(now);
  const randomId = cryptoRef?.randomUUID?.()
    || `${currentTime.toString(36)}-${Number(random()).toString(36).slice(2, 12)}`;
  const started = Number(startedAt);
  return {
    id: `client-${normalizedMode}-${randomId}`.slice(0, 96),
    token: "client-only",
    startedAt: new Date(Number.isFinite(started) ? started : currentTime).toISOString(),
    deadlineAt: null,
    activationPending: false,
    scoreEligible: false,
    scoreMultiplier: 0,
    ranked: false,
    localOnly: true
  };
}

function clientOnlyRestoreGame(snapshot) {
  const mode = String(snapshot?.game?.mode || "").trim().toLowerCase();
  let game = null;
  if (mode === "training") {
    game = createFirstOrbitGame(selectUniverse(101));
  } else if (mode === "second-orbit") {
    game = createSecondOrbitGame(selectUniverse(202));
  } else if (mode === "explore") {
    const seed = Number(snapshot?.game?.seed);
    if (!Number.isSafeInteger(seed) || seed < 0 || seed >= 1_000_000) return null;
    game = exploreGame(seed);
    game.universe = selectUniverse(game.seed);
  }
  if (!game) return null;
  const savedTarget = String(snapshot?.game?.target || "").trim().toLowerCase();
  if (savedTarget !== String(game.target || "").trim().toLowerCase()) return null;
  if (Number(snapshot?.game?.seed) !== Number(game.seed)) return null;
  return game;
}

export function clientOnlyRestorePayload(snapshot, { now = Date.now } = {}) {
  const run = snapshot?.run;
  const progress = snapshot?.progress;
  const visuals = snapshot?.visuals;
  const mode = String(snapshot?.game?.mode || "").trim().toLowerCase();
  const startedAt = Date.parse(run?.startedAt || "");
  const hasRuntimeRun = mode === "training";
  const expectedIdPrefix = hasRuntimeRun ? "training-" : `client-${mode}-`;
  const expectedToken = hasRuntimeRun ? "local-training" : "client-only";
  if (
    run?.clientOnly !== true
    || !CLIENT_ONLY_RESUME_MODES.has(mode)
    || run.localOnly !== true
    || run.ranked !== false
    || run.scoreEligible !== false
    || run.activationPending !== false
    || run.deadlineAt != null
    || run.hasRuntimeRun !== hasRuntimeRun
    || typeof run.id !== "string"
    || !run.id.startsWith(expectedIdPrefix)
    || run.token !== expectedToken
    || !Number.isFinite(startedAt)
    || startedAt > timestamp(now) + 60_000
    || !progress
    || typeof progress !== "object"
    || Array.isArray(progress)
    || progress.completed === true
    || progress.submitted === true
    || progress.scoringDisabled !== true
    || Number(progress.scoreMultiplier) !== 0
    || !visuals
    || typeof visuals !== "object"
    || Array.isArray(visuals)
    || snapshot.journeyContext != null
  ) return null;

  const game = clientOnlyRestoreGame(snapshot);
  if (!game) return null;
  if (mode === "training" && (Array.isArray(progress.history) ? progress.history.length : 0) > 0) return null;
  if (mode === "second-orbit" && secondOrbitProgress(progress.history).complete) return null;

  const assist = mode === "training" ? "training" : assistancePolicy(progress.assist).id;
  const persistenceRun = {
    id: run.id,
    token: run.token,
    startedAt: new Date(startedAt).toISOString(),
    deadlineAt: null,
    activationPending: false,
    assist,
    assisted: assist !== "none",
    scoreEligible: false,
    scoreMultiplier: 0,
    ranked: false,
    localOnly: true,
    clientOnly: true,
    hasRuntimeRun
  };
  const runtimeRun = hasRuntimeRun
    ? {
        ...persistenceRun,
        assist: "training",
        assisted: true,
        rewardEligible: false,
        leaderboardEligible: false
      }
    : null;
  return {
    game,
    run: runtimeRun,
    persistenceRun,
    progress: {
      ...structuredClone(progress),
      completed: false,
      submitted: false,
      assist,
      scoringDisabled: true,
      scoreMultiplier: 0
    }
  };
}

export function activeRunSnapshotIsValid(snapshot, { now = Date.now } = {}) {
  const currentTime = timestamp(now);
  const savedAt = Date.parse(snapshot?.savedAt);
  if (
    snapshot?.version !== 1
    || !snapshot?.run?.id
    || !snapshot?.run?.token
    || !snapshot?.game
    || !Number.isFinite(savedAt)
    || savedAt > currentTime + 60_000
    || currentTime - savedAt > 7 * 86_400_000
  ) return false;
  const mode = String(snapshot.game.mode || "").trim().toLowerCase();
  const clientOnly = snapshot.run.clientOnly === true;
  return clientOnly === CLIENT_ONLY_RESUME_MODES.has(mode)
    && (!clientOnly || Boolean(clientOnlyRestorePayload(snapshot, { now: currentTime })));
}
