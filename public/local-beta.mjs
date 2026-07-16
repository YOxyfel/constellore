import {
  buildLocalGame,
  canonicalLocalTarget,
  canonicalLocalWord,
  localItemFor,
  localSuggestions,
  lookupLocalCombination
} from "./local-world.mjs";

const runs = new Map();
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

function requireRun(body) {
  const run = runs.get(body.runId);
  if (!run || run.token !== body.runToken) fail("This local orbit expired. Start it again.", "run_missing", 404);
  return run;
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
    const game = buildLocalGame(requestUrl.searchParams.get("mode") || "challenge", requestUrl.searchParams.get("seed") || 0);
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
    return buildLocalGame("reach", 0, target);
  }

  if (method === "POST" && path === "/api/run/start") {
    const target = body.target ? canonicalLocalTarget(body.target) : "";
    if (body.target && !target) fail("That target is not mapped in local practice yet.", "local_target_unknown");
    const game = buildLocalGame(body.mode, body.seed, target, body.stage);
    if (!game) fail("The local universe could not map that orbit.");
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
      moves: 0,
      completed: false,
      wished: false,
      assist: "none"
    };
    runs.set(run.id, run);
    return {
      player: publicPlayer(),
      game,
      run: {
        id: run.id,
        token: run.token,
        ranked: false,
        localOnly: true,
        startedAt: run.startedAt,
        deadlineAt: run.deadlineAt
      }
    };
  }

  if (method === "POST" && path === "/api/combine") {
    const run = requireRun(body);
    const a = canonicalLocalWord(body.a);
    const b = canonicalLocalWord(body.b);
    if (!a || !b || !run.available.has(a.toLowerCase()) || !run.available.has(b.toLowerCase())) {
      fail("Use words already discovered in this orbit.", "word_unavailable", 409);
    }
    if (run.deadlineAt && Date.now() > Date.parse(run.deadlineAt)) fail("This quick orbit has ended.", "time_expired", 409);
    if (run.game.moveLimit && run.moves >= run.game.moveLimit) fail("No moves remain in this orbit.", "move_limit", 409);
    const result = lookupLocalCombination(a, b);
    if (!result) fail("Those ideas are outside this local universe.", "combination_missing");
    run.moves += 1;
    run.available.add(result.word.toLowerCase());
    run.completed ||= result.word.toLowerCase() === run.game.target.toLowerCase();
    return {
      ...result,
      completed: run.completed,
      ranked: false,
      localOnly: true,
      division: run.assist === "none" ? "local" : "local-assisted"
    };
  }

  if (method === "POST" && path === "/api/wish") {
    const run = requireRun(body);
    if (run.wished) fail("Only one Practice Wish may be used in an orbit.", "wish_used", 409);
    const item = localItemFor(body.word);
    if (!item) fail("Practice Wishes must use a word mapped in the local universe.", "local_wish_unknown");
    run.wished = true;
    run.assist = "wish";
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
