import {
  buildLocalGame,
  canonicalLocalTarget,
  canonicalLocalWord,
  localItemFor,
  localRouteTo,
  localSuggestions,
  lookupLocalCombination
} from "./local-world.mjs";
import { cosmicTwistOptions, cosmicTwistSeedFor, selectCosmicTwist } from "./cosmic-twists.mjs";
import { rankSenseCandidates } from "./engagement-features.mjs";
import { annotateUniverseResult, selectUniverse, validateUniverseRoute } from "./universe-director.mjs";
import { sanitizeRecipeRating } from "./recipe-feedback.mjs";

const runs = new Map();
const missionPreviews = new Map();
const LOCAL_MISSION_PREVIEW_TTL_MS = 15 * 60_000;
const MAX_RESUME_DISCOVERIES = 1000;
const MAX_RESUME_HISTORY = 500;
const player = {
  id: "local-stargazer",
  callsign: "Local Stargazer",
  credits: 0,
  vault: [],
  founderPass: false,
  freeWishUsed: false,
  wishAvailable: true,
  dailyWishUsedDate: ""
};

function localId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function fail(message, code = "local_beta_error", status = 422) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  throw error;
}

function parseBody(options) {
  if (!options?.body) return {};
  try { return JSON.parse(options.body); }
  catch { return fail("That local request could not be read.", "invalid_json", 400); }
}

function publicPlayer() {
  return { ...player, vault: [] };
}

function cloneMissionGame(game) {
  return JSON.parse(JSON.stringify(game));
}

function pruneMissionPreviews() {
  const now = Date.now();
  for (const [token, preview] of missionPreviews) {
    if (preview.expiresAt <= now) missionPreviews.delete(token);
  }
  while (missionPreviews.size >= 24) missionPreviews.delete(missionPreviews.keys().next().value);
}

function directedLocalGame(mode, seed, target, stage) {
  const game = buildLocalGame(mode, seed, target, stage);
  return game ? { ...game, universe: selectUniverse(game.seed) } : null;
}

function canonicalRouteRecipes(route) {
  if (!Array.isArray(route)) return [];
  return route.map((step) => {
    const a = canonicalLocalWord(step?.a);
    const b = canonicalLocalWord(step?.b);
    const result = a && b ? lookupLocalCombination(a, b) : null;
    return result ? { a, b, ...result } : null;
  }).filter(Boolean);
}

function verifiedLocalRoute(game) {
  const route = game ? localRouteTo(game.target) : null;
  if (!Array.isArray(route)) return null;
  const canonicalRecipes = canonicalRouteRecipes(route);
  const validation = validateUniverseRoute({
    starters: game.starters,
    target: game.target,
    route,
    recipes: canonicalRecipes
  });
  return validation.valid ? canonicalRecipes : null;
}

function requireRun(body) {
  const run = runs.get(body.runId);
  if (!run || run.token !== body.runToken) fail("This local orbit expired. Start it again.", "run_missing", 404);
  return run;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedInteger(value, fallback = 0, maximum = 10_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(0, Math.trunc(parsed)));
}

function restoredItem(value) {
  const requestedWord = typeof value === "string" ? value : value?.word;
  const canonicalWord = canonicalLocalWord(requestedWord);
  return canonicalWord ? localItemFor(canonicalWord) : null;
}

function restoredHistory(value) {
  if (!Array.isArray(value)) return [];
  const history = [];
  for (const entry of value.slice(0, MAX_RESUME_HISTORY)) {
    if (!isRecord(entry)) continue;
    const a = canonicalLocalWord(entry.a);
    const b = canonicalLocalWord(entry.b);
    const item = restoredItem(entry);
    if (!a || !b || !item) continue;
    const canonicalResult = lookupLocalCombination(a, b);
    const twisted = Boolean(entry.twisted || entry.source === "twist");
    if (!twisted && canonicalResult?.word.toLowerCase() !== item.word.toLowerCase()) continue;
    if (twisted && !cosmicTwistOptions(a, b).some((option) => option.word.toLowerCase() === item.word.toLowerCase())) continue;
    history.push({
      a,
      b,
      word: item.word,
      emoji: item.emoji,
      category: item.category,
      source: twisted ? "twist" : String(entry.source || canonicalResult.source || "local-catalog").slice(0, 32),
      ...(twisted ? { twisted: true, canonicalWord: canonicalResult?.word || "" } : {}),
      ...(entry.revealed ? { revealed: true } : {})
    });
  }
  return history;
}

function publicRun(run) {
  const scoreEligible = !run.scoringDisabled;
  return {
    id: run.id,
    token: run.token,
    ranked: false,
    localOnly: true,
    startedAt: run.startedAt,
    deadlineAt: run.deadlineAt,
    assist: run.assist,
    scoringDisabled: Boolean(run.scoringDisabled),
    scoreEligible,
    rewardEligible: scoreEligible,
    leaderboardEligible: false
  };
}

function publicProgress(run) {
  return {
    moves: run.moves,
    completed: Boolean(run.completed),
    submitted: Boolean(run.submitted),
    discovered: [...run.available].map((word) => localItemFor(word)).filter(Boolean),
    history: structuredClone(run.history),
    usedBend: Boolean(run.wished),
    usedWish: Boolean(run.wished),
    wished: Boolean(run.wished),
    bendItem: run.bendItem ? { ...run.bendItem } : null,
    assist: run.assist,
    scoringDisabled: Boolean(run.scoringDisabled)
  };
}

function resumeResponse(run) {
  return {
    player: publicPlayer(),
    game: structuredClone(run.game),
    run: publicRun(run),
    progress: publicProgress(run)
  };
}

function restoreRun(body) {
  const runId = String(body.runId || "").trim();
  const runToken = String(body.runToken || "").trim();
  if (!runId || !runToken || runId.length > 256 || runToken.length > 256) {
    fail("This local orbit could not be restored.", "run_missing", 404);
  }

  const existing = runs.get(runId);
  if (existing) {
    if (existing.token !== runToken) fail("This local orbit could not be restored.", "run_missing", 404);
    return existing;
  }

  const snapshot = body.snapshot;
  const snapshotRun = snapshot?.run;
  const snapshotGame = snapshot?.game;
  const progress = snapshot?.progress;
  if (!isRecord(snapshot) || !isRecord(snapshotRun) || !isRecord(snapshotGame) || !isRecord(progress)) {
    fail("This local orbit expired. Start it again.", "run_missing", 404);
  }

  const snapshotRunId = String(snapshotRun.id || snapshotRun.runId || "").trim();
  const snapshotRunToken = String(snapshotRun.token || snapshotRun.runToken || "").trim();
  if (snapshotRunId !== runId || snapshotRunToken !== runToken) {
    fail("That saved orbit does not match this local run.", "resume_mismatch", 409);
  }

  const mode = String(snapshotGame.mode || "").trim().toLowerCase();
  if (!["reach", "quick", "moves", "daily", "weekly", "challenge"].includes(mode)) {
    fail("That saved local mode is not available.", "resume_invalid", 422);
  }
  const target = canonicalLocalTarget(snapshotGame.target);
  if (!target) fail("That saved destination is not mapped in local practice.", "resume_invalid", 422);
  const game = directedLocalGame(mode, snapshotGame.seed, target, snapshotGame.stage);
  if (!game || game.target.toLowerCase() !== target.toLowerCase()) {
    fail("The local universe could not reconstruct that orbit.", "resume_invalid", 422);
  }
  const solutionRoute = verifiedLocalRoute(game);
  if (!solutionRoute) fail("That saved orbit no longer has a verified local route.", "resume_invalid", 422);

  const startedValue = Date.parse(snapshotRun.startedAt);
  const startedAtMs = Number.isFinite(startedValue) && startedValue <= Date.now() + 60_000 ? startedValue : Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const available = new Set(game.starters.map((word) => word.toLowerCase()));
  if (Array.isArray(progress.discovered)) {
    for (const value of progress.discovered.slice(0, MAX_RESUME_DISCOVERIES)) {
      const item = restoredItem(value);
      if (item) available.add(item.word.toLowerCase());
    }
  }

  const bendItem = restoredItem(progress.bendItem);
  const wished = Boolean(progress.usedBend || progress.usedWish || progress.wished);
  if (bendItem) available.add(bendItem.word.toLowerCase());
  const history = restoredHistory(progress.history);
  for (const entry of history) available.add(entry.word.toLowerCase());
  const assistValue = String(progress.assist || snapshotRun.assist || "none").toLowerCase();
  const assist = ["none", "wish", "reveal", "sense"].includes(assistValue) ? assistValue : wished ? "wish" : "none";
  const moveMaximum = game.moveLimit ? Math.max(game.moveLimit, history.length) : 10_000;
  const moves = Math.max(history.length, boundedInteger(progress.moves, history.length, moveMaximum));
  const targetFound = available.has(game.target.toLowerCase());
  const completed = Boolean(progress.completed && targetFound);
  const twistEntry = history.find((entry) => entry.twisted);
  const run = {
    id: runId,
    token: runToken,
    ranked: false,
    localOnly: true,
    game,
    startedAt,
    deadlineAt: game.timeLimit ? new Date(startedAtMs + game.timeLimit * 1000).toISOString() : null,
    available,
    history,
    moves,
    completed,
    submitted: Boolean(progress.submitted && completed),
    wished,
    bendItem,
    assist: assist === "none" && wished ? "wish" : assist,
    scoringDisabled: Boolean(progress.scoringDisabled || ["reveal", "sense"].includes(assist)),
    twistUsed: Boolean(twistEntry),
    twistedPairKey: twistEntry ? [twistEntry.a, twistEntry.b].map((word) => word.toLowerCase()).sort().join("+") : null,
    solutionRoute,
    feedbackMoves: new Set(),
    revealRoute: null
  };
  runs.set(run.id, run);
  return run;
}

function revealedRun(run) {
  return {
    route: structuredClone(run.revealRoute),
    target: run.game.target,
    assisted: true,
    assist: "reveal",
    completed: true,
    scoringDisabled: true,
    scoreEligible: false,
    rewardEligible: false,
    leaderboardEligible: false,
    score: 0,
    ranked: false,
    localOnly: true
  };
}

export async function localRequest(url, options = {}) {
  const requestUrl = new URL(url, "https://local.constellore.invalid");
  const path = requestUrl.pathname;
  const method = String(options.method || "GET").toUpperCase();
  const body = parseBody(options);

  if (method === "GET" && path === "/api/config") return {
    billingEnabled: false,
    checkoutUrl: "",
    testStoreEnabled: false,
    creditPacks: [],
    rewardedAdsEnabled: false,
    founderPrice: "Not sold in local practice",
    aiEnabled: false,
    localOnly: true
  };
  if (method === "POST" && path === "/api/player/register") return { player: publicPlayer(), playerToken: "local-practice" };
  if (method === "GET" && path === "/api/player") return { player: publicPlayer() };
  if (method === "POST" && path === "/api/analytics") return { ok: true, localOnly: true };

  if (method === "GET" && path === "/api/game") {
    const game = directedLocalGame(requestUrl.searchParams.get("mode") || "challenge", requestUrl.searchParams.get("seed") || 0);
    return game;
  }

  if (method === "POST" && path === "/api/custom-target") {
    const target = canonicalLocalTarget(body.target);
    if (!target) {
      const error = new Error("That destination is not mapped in local practice yet. Try one of the suggested targets.");
      error.code = "local_target_unknown";
      error.status = 422;
      error.payload = { suggestions: localSuggestions() };
      throw error;
    }
    return directedLocalGame("reach", 0, target);
  }

  if (method === "POST" && path === "/api/run/preview") {
    const target = body.target ? canonicalLocalTarget(body.target) : "";
    if (body.target && !target) fail("That target is not mapped in local practice yet.", "local_target_unknown");
    const game = directedLocalGame(body.mode, body.seed, target, body.stage);
    if (!game) fail("The local universe could not map that orbit.");
    if (!verifiedLocalRoute(game)) fail("The local universe could not verify a route to that target.", "local_route_invalid", 409);
    const missionGame = {
      ...game,
      ranked: false,
      scoreEligible: true,
      rewardEligible: true,
      leaderboardEligible: false
    };
    pruneMissionPreviews();
    const previewToken = localId("mission-preview");
    missionPreviews.set(previewToken, {
      game: cloneMissionGame(missionGame),
      expiresAt: Date.now() + LOCAL_MISSION_PREVIEW_TTL_MS
    });
    return {
      player: publicPlayer(),
      game: missionGame,
      previewToken
    };
  }

  if (method === "POST" && path === "/api/run/start") {
    let game;
    if (body.previewToken) {
      pruneMissionPreviews();
      const preview = missionPreviews.get(body.previewToken);
      if (!preview) fail("This mission briefing expired or changed. Review the refreshed mission before starting.", "mission_stale", 409);
      missionPreviews.delete(body.previewToken);
      game = cloneMissionGame(preview.game);
    } else {
      const target = body.target ? canonicalLocalTarget(body.target) : "";
      if (body.target && !target) fail("That target is not mapped in local practice yet.", "local_target_unknown");
      game = directedLocalGame(body.mode, body.seed, target, body.stage);
    }
    if (!game) fail("The local universe could not map that orbit.");
    const solutionRoute = verifiedLocalRoute(game);
    if (!solutionRoute) fail("The local universe could not verify a route to that target.", "local_route_invalid", 409);
    const startedAt = new Date();
    const run = {
      id: localId("run"),
      token: localId("token"),
      ranked: false,
      localOnly: true,
      game,
      startedAt: startedAt.toISOString(),
      deadlineAt: game.timeLimit ? new Date(startedAt.getTime() + game.timeLimit * 1000).toISOString() : null,
      available: new Set(game.starters.map((word) => word.toLowerCase())),
      history: [],
      moves: 0,
      completed: false,
      submitted: false,
      wished: false,
      bendItem: null,
      assist: "none",
      scoringDisabled: false,
      twistUsed: false,
      twistedPairKey: null,
      solutionRoute,
      feedbackMoves: new Set(),
      revealRoute: null
    };
    runs.set(run.id, run);
    return {
      player: publicPlayer(),
      game,
      run: publicRun(run)
    };
  }

  if (method === "POST" && path === "/api/run/resume") {
    return resumeResponse(restoreRun(body));
  }

  if (method === "POST" && path === "/api/recipe-feedback") {
    const run = requireRun(body);
    const move = Number(body.move);
    const rating = sanitizeRecipeRating(body.rating);
    if (!Number.isInteger(move) || move < 1 || !rating) fail("That recipe rating is not valid.", "invalid_recipe_feedback", 400);
    const step = run.history[move - 1];
    if (!step || step.revealed) fail("That discovery is not available for rating.", "recipe_feedback_missing", 409);
    run.feedbackMoves ||= new Set();
    if (run.feedbackMoves.has(move)) fail("That discovery was already rated.", "recipe_feedback_duplicate", 409);
    run.feedbackMoves.add(move);
    return { accepted: true, move, rating, localOnly: true };
  }

  if (method === "POST" && path === "/api/run/sense") {
    const run = requireRun(body);
    if (run.completed) fail("This local orbit is already complete.", "run_complete", 409);
    const route = run.solutionRoute;
    if (!Array.isArray(route)) fail("No safe constellation signal is available for this target.", "sense_unavailable", 422);
    const words = [...run.available].map((word) => localItemFor(word)).filter(Boolean);
    const candidates = rankSenseCandidates({
      words,
      target: run.game.target,
      history: run.history,
      route,
      seed: run.game.seed,
      limit: 3
    }).map((candidate) => {
      const discovered = localItemFor(candidate.word);
      return {
        word: discovered?.word || candidate.word,
        emoji: discovered?.emoji || candidate.emoji || "",
        category: discovered?.category || null,
        signal: ["bright", "warm", "resonant"].includes(candidate.signal) ? candidate.signal : "warm"
      };
    }).slice(0, 3);
    if (!candidates.length) fail("No safe constellation signal is available yet.", "sense_unavailable", 422);
    run.assist = "sense";
    run.scoringDisabled = true;
    return {
      candidates,
      assisted: true,
      assist: "sense",
      scoringDisabled: true,
      scoreEligible: false,
      rewardEligible: false,
      leaderboardEligible: false,
      ranked: false,
      localOnly: true
    };
  }

  if (method === "POST" && path === "/api/run/reveal") {
    const run = requireRun(body);
    if (run.revealRoute) return revealedRun(run);
    if (run.completed) fail("This local orbit is already complete.", "run_complete", 409);

    const route = run.solutionRoute;
    if (!Array.isArray(route)) fail("The local cosmos could not reconstruct this answer.", "route_unavailable", 409);

    run.revealRoute = structuredClone(route);
    run.assist = "reveal";
    run.scoringDisabled = true;
    run.completed = true;
    for (const step of route) {
      run.available.add(step.word.toLowerCase());
      run.history.push({ ...step, source: "reveal", revealed: true });
    }
    run.moves += route.length;
    return revealedRun(run);
  }

  if (method === "POST" && path === "/api/combine") {
    const run = requireRun(body);
    if (run.completed) fail("This local orbit is already complete.", "run_complete", 409);
    const a = canonicalLocalWord(body.a);
    const b = canonicalLocalWord(body.b);
    if (!a || !b || !run.available.has(a.toLowerCase()) || !run.available.has(b.toLowerCase())) {
      fail("Use words already discovered in this orbit.", "word_unavailable", 409);
    }
    if (run.deadlineAt && Date.now() > Date.parse(run.deadlineAt)) fail("This quick orbit has ended.", "time_expired", 409);
    if (run.game.moveLimit && run.moves >= run.game.moveLimit) fail("No moves remain in this orbit.", "move_limit", 409);
    const canonicalResult = lookupLocalCombination(a, b);
    if (!canonicalResult) fail("Those ideas are outside this local universe.", "combination_missing");
    const twist = selectCosmicTwist({
      a,
      b,
      canonicalResult,
      target: run.game.target,
      mode: run.game.mode,
      seed: cosmicTwistSeedFor(run.game),
      moveNumber: run.moves + 1,
      twistUsed: run.twistUsed,
      discovered: run.available
    });
    const result = twist || canonicalResult;
    const annotation = annotateUniverseResult({
      universe: run.game.universe,
      a,
      b,
      result,
      recipes: [{ a, b, ...canonicalResult }]
    });
    if (twist) {
      run.twistUsed = true;
      run.twistedPairKey = [a, b].map((word) => word.toLowerCase()).sort().join("+");
    }
    run.moves += 1;
    run.available.add(result.word.toLowerCase());
    run.history.push({
      a,
      b,
      word: result.word,
      emoji: result.emoji,
      category: result.category,
      source: result.source,
      ...(result.twisted ? { twisted: true, canonicalWord: result.twist?.canonicalWord || canonicalResult.word } : {})
    });
    run.completed ||= result.word.toLowerCase() === run.game.target.toLowerCase();
    return {
      ...result,
      ...(annotation ? { universeContext: annotation.context } : {}),
      feedbackEligible: false,
      completed: run.completed,
      ranked: false,
      localOnly: true,
      division: run.assist === "none" ? "local" : "local-assisted"
    };
  }

  if (method === "POST" && path === "/api/wish") {
    const run = requireRun(body);
    if (run.completed) fail("This local orbit is already complete.", "run_complete", 409);
    if (run.wished) fail("Only one Practice Wish may be used in an orbit.", "wish_used", 409);
    const item = localItemFor(body.word);
    if (!item) fail("Practice Wishes must use a word mapped in the local universe.", "local_wish_unknown");
    run.wished = true;
    run.assist = "wish";
    run.bendItem = { ...item };
    run.available.add(item.word.toLowerCase());
    return { ...item, assist: "wish", player: publicPlayer(), localOnly: true };
  }

  if (method === "POST" && path === "/api/run/submit") return {
    ranked: false,
    localOnly: true,
    reason: "Local practice results stay on this device and are never presented as verified scores."
  };

  if (path.startsWith("/api/leaderboard")) fail("Verified leaderboards require the online account service.", "online_required", 503);
  if (path.startsWith("/api/market")) fail("The Word Exchange requires the online account service. No purchases are available here.", "online_required", 503);
  if (path === "/api/player/test-entitlement") fail("Purchases are disabled in local practice.", "payments_disabled", 503);
  fail("That feature needs the online game server.", "online_required", 503);
}
