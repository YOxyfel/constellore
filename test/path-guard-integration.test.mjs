import assert from "node:assert/strict";
import { once } from "node:events";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  createPathGuardEvidence,
  evaluatePathGuard,
  pathGuardEligibility
} from "../public/path-guard.mjs";
import { createRemixProgressionState } from "../public/remix-progression.mjs";
import { writeLocalWorldModule } from "../scripts/build-local-world.mjs";
import {
  contextualCombination,
  curatedCombination,
  server,
  solutionRoute
} from "../server.mjs";

const CLASSIC_STARTERS = ["Earth", "Water", "Fire", "Air"];
const LOCAL_RUNTIME_ASSETS = [
  "adaptive-difficulty.mjs",
  "cosmic-twists.mjs",
  "engagement-features.mjs",
  "local-beta.mjs",
  "path-guard.mjs",
  "recipe-feedback.mjs",
  "remix-progression.mjs",
  "remix-readiness.mjs",
  "route-remixes.mjs",
  "shuffled-start.mjs",
  "universe-director.mjs"
];
const FORBIDDEN_PATH_EVIDENCE_KEYS = new Set([
  "allowedPairs",
  "afterDistance",
  "beforeDistance",
  "bridge",
  "deadEndPairs",
  "expectedIngredients",
  "expectedPair",
  "expectedPairs",
  "result",
  "resultWord",
  "solutionRecipes",
  "solutionRoute"
]);

const requestOptions = (body) => ({
  method: "POST",
  body: JSON.stringify(body)
});

function pairKey(a, b) {
  return [a, b]
    .map((word) => String(word || "").toLocaleLowerCase("en-US"))
    .sort()
    .join("+");
}

function starterPairs(starters) {
  const pairs = [];
  for (let left = 0; left < starters.length; left += 1) {
    for (let right = left; right < starters.length; right += 1) {
      pairs.push([starters[left], starters[right]]);
    }
  }
  return pairs;
}

function actionableStep(route, available) {
  const known = new Set(available.map((word) => word.toLocaleLowerCase("en-US")));
  return route.find((step) =>
    known.has(step.a.toLocaleLowerCase("en-US"))
    && known.has(step.b.toLocaleLowerCase("en-US"))
    && !known.has(step.word.toLocaleLowerCase("en-US"))
  );
}

function offRouteStarterPair({ route, starters, target, lookup, isProductive = () => false }) {
  const available = new Set(starters.map((word) => word.toLocaleLowerCase("en-US")));
  const expected = new Set(route
    .filter((step) =>
      available.has(step.a.toLocaleLowerCase("en-US"))
      && available.has(step.b.toLocaleLowerCase("en-US"))
      && !available.has(step.word.toLocaleLowerCase("en-US"))
    )
    .map((step) => pairKey(step.a, step.b)));
  for (const [a, b] of starterPairs(starters)) {
    const result = lookup(a, b);
    if (
      result?.word
      && result.word.toLocaleLowerCase("en-US") !== target.toLocaleLowerCase("en-US")
      && !expected.has(pairKey(a, b))
      && !isProductive(result)
    ) {
      return { a, b, result };
    }
  }
  assert.fail(`No valid off-route starter pair was available for ${target}`);
}

function onlineOffRoutePair({ route, starters, target }) {
  const guidedResults = new Set(route.map((step) => step.word.toLocaleLowerCase("en-US")));
  return offRouteStarterPair({
    route,
    starters,
    target,
    lookup: curatedCombination,
    isProductive: (result) =>
      guidedResults.has(result.word.toLocaleLowerCase("en-US"))
  });
}

function localOffRoutePair({ route, starters, target, world }) {
  const guidedResults = new Set(route.map((step) => step.word.toLocaleLowerCase("en-US")));
  return offRouteStarterPair({
    route,
    starters,
    target,
    lookup: world.lookupLocalCombination,
    isProductive: (result) =>
      guidedResults.has(result.word.toLocaleLowerCase("en-US"))
  });
}

function contextualOffRoutePair({ route, available, target }) {
  const routePairs = new Set(route.map((step) => pairKey(step.a, step.b)));
  const guidedResults = new Set(route.map((step) => step.word.toLocaleLowerCase("en-US")));
  for (const [a, b] of starterPairs(available)) {
    if (routePairs.has(pairKey(a, b)) || curatedCombination(a, b)) continue;
    const result = contextualCombination(a, b);
    if (
      result?.word
      && result.word.toLocaleLowerCase("en-US") !== target.toLocaleLowerCase("en-US")
      && !guidedResults.has(result.word.toLocaleLowerCase("en-US"))
    ) {
      return { a, b, result };
    }
  }
  assert.fail(`No contextual off-route pair was available for ${target}`);
}

function missingPair({ route, available, lookup }) {
  const routePairs = new Set(route.map((step) => pairKey(step.a, step.b)));
  for (const [a, b] of starterPairs(available)) {
    if (!routePairs.has(pairKey(a, b)) && !lookup(a, b)) return { a, b };
  }
  assert.fail("The fixture needs a definitively missing discovered pair");
}

function privateEvidenceKeys(value, found = []) {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    for (const item of value) privateEvidenceKeys(item, found);
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PATH_EVIDENCE_KEYS.has(key)) found.push(key);
    privateEvidenceKeys(child, found);
  }
  return found;
}

function assertSpoilerSafe(value, { rejectedResult = "" } = {}) {
  assert.deepEqual(
    privateEvidenceKeys(value),
    [],
    "public Path Guard payloads must not expose route, pair, result, bridge, or distance evidence"
  );
  if (rejectedResult) {
    const payload = JSON.stringify(value).toLocaleLowerCase("en-US");
    assert.equal(
      payload.includes(`"${rejectedResult.toLocaleLowerCase("en-US")}"`),
      false,
      "a rejected pairing must not disclose its canonical result"
    );
  }
}

function comparableOnlineProgress(response) {
  return {
    routeProgress: response.run.routeProgress,
    moves: response.progress.moves,
    attempts: response.progress.attempts,
    rejectedAttempts: response.progress.rejectedAttempts,
    errorless: response.progress.errorless,
    discovered: response.progress.discovered,
    history: response.progress.history
  };
}

function comparableLocalProgress(response) {
  return {
    routeProgress: response.run.routeProgress,
    moves: response.progress.moves,
    discovered: response.progress.discovered,
    history: response.progress.history
  };
}

function helperContext(overrides = {}) {
  return {
    rankId: "bronze",
    mode: "reach",
    target: "Brick",
    assist: "none",
    scoringDisabled: false,
    scoreEligible: true,
    finished: false,
    ...overrides
  };
}

test("the pure Path Guard contract blocks only authoritative off-route Bronze/Silver pairs", () => {
  const route = [
    { a: "Earth", b: "Water", word: "Mud" },
    { a: "Mud", b: "Fire", word: "Brick" }
  ];
  const evidence = createPathGuardEvidence({
    authoritative: true,
    exhaustive: true,
    target: "Brick",
    solutionRoute: route,
    available: CLASSIC_STARTERS
  });

  for (const rankId of ["bronze", "silver"]) {
    const context = helperContext({ rankId });
    assert.equal(pathGuardEligibility(context).active, true);

    const productive = evaluatePathGuard(context, { a: "Earth", b: "Water" }, evidence);
    assert.equal(productive.blocked, false);
    assert.equal(productive.reason, "expected-pair");

    const offRoute = evaluatePathGuard(context, { a: "Air", b: "Fire" }, evidence);
    assert.equal(offRoute.blocked, true);
    assert.equal(offRoute.action, "reject");
    assert.equal(offRoute.reason, "outside-exhaustive-route");
    assert.equal("result" in offRoute, false);
    assert.equal("expectedPair" in offRoute, false);
  }

  const failOpenContexts = [
    helperContext({ rankId: "gold" }),
    helperContext({ ranked: true, competitive: true }),
    helperContext({ assist: "sense", assisted: true }),
    helperContext({ remixes: { activeCount: 1 }, competitive: true }),
    helperContext({ practiceReplay: true, training: true })
  ];
  for (const context of failOpenContexts) {
    const decision = evaluatePathGuard(context, { a: "Air", b: "Fire" }, evidence);
    assert.equal(decision.blocked, false);
    assert.equal(decision.active, false);
  }
});

test("the online missing-result branch guards before recording a rejected attempt", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const missingResult = source.indexOf("if (!result) {", source.indexOf('url.pathname === "/api/combine"'));
  const mutation = source.indexOf("runRegistry.recordRejectedAttempt", missingResult);
  const guardedReturn = source.indexOf("pathGuardWrongPathPayload(run)", missingResult);
  assert.ok(missingResult >= 0 && guardedReturn > missingResult);
  assert.ok(
    guardedReturn < mutation,
    "an eligible definitely-missing pair must return before attempts or rejectedAttempts mutate"
  );
  assert.match(
    source.slice(missingResult, mutation),
    /if \(run && pathGuardEnabledForRun\(run\)\)[\s\S]*sendJson\(response,\s*409,\s*pathGuardWrongPathPayload\(run\)\)/
  );
});

test("online Bronze Path Guard is non-consuming, spoiler-safe, and fails open for excluded runs", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(async () => {
    if (!server.listening) return;
    server.close();
    await once(server, "close");
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let auth = {};
  const request = async (path, { method = "GET", body, authenticated = true } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(authenticated ? auth : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return { response, payload: await response.json() };
  };
  const register = await request("/api/player/register", {
    method: "POST",
    authenticated: false
  });
  assert.equal(register.response.status, 201);
  auth = {
    "x-constellore-player": register.payload.player.id,
    "x-constellore-token": register.payload.playerToken
  };
  const start = async (body) => {
    const preview = await request("/api/run/preview", { method: "POST", body });
    assert.equal(preview.response.status, 200);
    const started = await request("/api/run/start", {
      method: "POST",
      body: { previewToken: preview.payload.previewToken }
    });
    assert.equal(started.response.status, 201);
    return started.payload;
  };
  const resume = (started) => request("/api/run/resume", {
    method: "POST",
    body: {
      runId: started.run.id,
      runToken: started.run.token,
      deferActivation: true
    }
  });
  const combine = (started, pair) => request("/api/combine", {
    method: "POST",
    body: {
      a: pair.a,
      b: pair.b,
      runId: started.run.id,
      runToken: started.run.token
    }
  });
  const revealIfNeeded = async (started, combination = null) => {
    if (combination?.payload?.completed) return;
    const revealed = await request("/api/run/reveal", {
      method: "POST",
      body: {
        runId: started.run.id,
        runToken: started.run.token
      }
    });
    assert.equal(revealed.response.status, 200);
  };

  const bronze = await start({ mode: "quick", seed: 9471 });
  assert.equal(bronze.game.remixes.rank.id, "bronze");
  assert.equal(bronze.game.remixes.activeCount, 0);
  assertSpoilerSafe(bronze);
  const bronzeRoute = solutionRoute(bronze.game.target);
  const productive = actionableStep(bronzeRoute, bronze.game.starters);
  assert.ok(productive, "the Bronze fixture needs a playable authored first step");
  const offRoute = onlineOffRoutePair({
    route: bronzeRoute,
    starters: bronze.game.starters,
    target: bronze.game.target
  });
  const before = await resume(bronze);
  assert.equal(before.response.status, 200);
  assertSpoilerSafe(before.payload);
  const blocked = await combine(bronze, offRoute);
  assert.equal(blocked.response.status, 409);
  assert.equal(blocked.payload.code, "wrong_path");
  assert.match(blocked.payload.error, /wrong path|cannot advance|does not advance/i);
  assertSpoilerSafe(blocked.payload, { rejectedResult: offRoute.result.word });
  const after = await resume(bronze);
  assert.equal(after.response.status, 200);
  assert.deepEqual(
    comparableOnlineProgress(after.payload),
    comparableOnlineProgress(before.payload),
    "a blocked online pairing must consume no move, attempt, error, discovery, or route progress"
  );

  const accepted = await combine(bronze, productive);
  assert.equal(accepted.response.status, 200);
  assert.equal(accepted.payload.word, productive.word);
  assert.equal(accepted.payload.completed, false, "the fixture needs room to test a contextual pairing");
  const contextualOffRoute = contextualOffRoutePair({
    route: bronzeRoute,
    available: [...bronze.game.starters, productive.word],
    target: bronze.game.target
  });
  const beforeContextual = await resume(bronze);
  const blockedContextual = await combine(bronze, contextualOffRoute);
  assert.equal(blockedContextual.response.status, 409);
  assert.equal(blockedContextual.payload.code, "wrong_path");
  assertSpoilerSafe(blockedContextual.payload, {
    rejectedResult: contextualOffRoute.result.word
  });
  const afterContextual = await resume(bronze);
  assert.deepEqual(
    comparableOnlineProgress(afterContextual.payload),
    comparableOnlineProgress(beforeContextual.payload),
    "a guarded contextual result must not consume an attempt or disclose the resolved result"
  );
  await revealIfNeeded(bronze, accepted);

  // Regression: the distance planner can prefer independently shorter
  // prerequisite plans whose union is not globally shortest. Path Guard must
  // still permit an immediately playable step from its verified run route.
  const manufacturing = await start({
    mode: "reach",
    adaptive: true,
    adaptiveTarget: "Manufacturing"
  });
  assert.equal(manufacturing.game.target, "Manufacturing");
  assert.equal(manufacturing.game.remixes.rank.id, "bronze");
  const manufacturingRoute = solutionRoute(manufacturing.game.target);
  const energyStep = manufacturingRoute.find((step) =>
    pairKey(step.a, step.b) === pairKey("Air", "Fire")
    && step.word === "Energy"
  );
  assert.ok(energyStep, "Manufacturing's verified route must include Air + Fire → Energy");
  const canonicalRouteCombination = await combine(manufacturing, energyStep);
  assert.equal(
    canonicalRouteCombination.response.status,
    200,
    "Path Guard must never reject a currently playable step from the verified run route"
  );
  assert.equal(canonicalRouteCombination.payload.word, "Energy");
  await revealIfNeeded(manufacturing, canonicalRouteCombination);

  const guidedMud = await start({
    mode: "reach",
    adaptive: true,
    adaptiveTarget: "Mud"
  });
  assert.equal(guidedMud.game.target, "Mud");
  assert.equal(guidedMud.game.remixes.rank.id, "bronze");
  const guidedMudRoute = solutionRoute(guidedMud.game.target);
  assert.equal(
    guidedMudRoute.some((step) => step.word.toLocaleLowerCase("en-US") === "land"),
    false,
    "Land must not be a selected-guide result for Mud"
  );
  const landDetour = {
    a: "Earth",
    b: "Earth",
    result: curatedCombination("Earth", "Earth")
  };
  assert.equal(landDetour.result?.word, "Land");
  const guidedMudBefore = await resume(guidedMud);
  const guidedMudBlocked = await combine(guidedMud, landDetour);
  assert.equal(guidedMudBlocked.response.status, 409);
  assert.equal(guidedMudBlocked.payload.code, "wrong_path");
  assertSpoilerSafe(guidedMudBlocked.payload, { rejectedResult: "Land" });
  const guidedMudAfter = await resume(guidedMud);
  assert.deepEqual(
    comparableOnlineProgress(guidedMudAfter.payload),
    comparableOnlineProgress(guidedMudBefore.payload),
    "the hosted selected-guide detour must remain completely non-consuming"
  );
  await revealIfNeeded(guidedMud);

  const assisted = await start({ mode: "quick", seed: 9472 });
  const assistedRoute = solutionRoute(assisted.game.target);
  const assistedOffRoute = onlineOffRoutePair({
    route: assistedRoute,
    starters: assisted.game.starters,
    target: assisted.game.target
  });
  const sensed = await request("/api/run/sense", {
    method: "POST",
    body: {
      runId: assisted.run.id,
      runToken: assisted.run.token
    }
  });
  assert.equal(sensed.response.status, 200);
  const assistedCombination = await combine(assisted, assistedOffRoute);
  assert.equal(assistedCombination.response.status, 200, "assisted runs must fail open");
  assert.equal(assistedCombination.payload.word, assistedOffRoute.result.word);
  await revealIfNeeded(assisted, assistedCombination);

  const replaySource = await start({ mode: "quick", seed: 9473 });
  await revealIfNeeded(replaySource);
  const replayedResponse = await request("/api/run/replay", {
    method: "POST",
    body: {
      runId: replaySource.run.id,
      runToken: replaySource.run.token
    }
  });
  assert.equal(replayedResponse.response.status, 201);
  const replayed = replayedResponse.payload;
  assert.equal(replayed.game.practiceReplay, true);
  const replayRoute = solutionRoute(replayed.game.target);
  const replayOffRoute = onlineOffRoutePair({
    route: replayRoute,
    starters: replayed.game.starters,
    target: replayed.game.target
  });
  const replayCombination = await combine(replayed, replayOffRoute);
  assert.equal(replayCombination.response.status, 200, "practice replays must fail open");
  assert.equal(replayCombination.payload.word, replayOffRoute.result.word);

  const ranked = await start({ mode: "daily", seed: 9474 });
  assert.equal(ranked.game.ranked, true);
  const rankedRoute = solutionRoute(ranked.game.target);
  const rankedOffRoute = onlineOffRoutePair({
    route: rankedRoute,
    starters: ranked.game.starters,
    target: ranked.game.target
  });
  const rankedCombination = await combine(ranked, rankedOffRoute);
  assert.equal(rankedCombination.response.status, 200, "ranked runs must never expose the Path Guard oracle");
  assert.equal(rankedCombination.payload.word, rankedOffRoute.result.word);
  const rankedMissing = missingPair({
    route: rankedRoute,
    available: [...ranked.game.starters, rankedOffRoute.result.word],
    lookup: curatedCombination
  });
  const rankedBeforeMissing = await resume(ranked);
  const rankedMissingResponse = await combine(ranked, rankedMissing);
  assert.equal(rankedMissingResponse.response.status, 422);
  assert.equal(rankedMissingResponse.payload.code, "combination_missing");
  assert.equal(rankedMissingResponse.payload.attempts, rankedBeforeMissing.payload.progress.attempts + 1);
  assert.equal(
    rankedMissingResponse.payload.rejectedAttempts,
    rankedBeforeMissing.payload.progress.rejectedAttempts + 1
  );
  assert.equal(rankedMissingResponse.payload.errorless, false);
  const rankedAfterMissing = await resume(ranked);
  assert.equal(rankedAfterMissing.payload.progress.moves, rankedBeforeMissing.payload.progress.moves);
  assert.equal(rankedAfterMissing.payload.progress.attempts, rankedBeforeMissing.payload.progress.attempts + 1);
  assert.equal(
    rankedAfterMissing.payload.progress.rejectedAttempts,
    rankedBeforeMissing.payload.progress.rejectedAttempts + 1
  );
  assert.equal(rankedAfterMissing.payload.progress.errorless, false);
  assert.deepEqual(rankedAfterMissing.payload.progress.discovered, rankedBeforeMissing.payload.progress.discovered);
  assert.deepEqual(rankedAfterMissing.payload.progress.history, rankedBeforeMissing.payload.progress.history);
  assert.deepEqual(rankedAfterMissing.payload.run.routeProgress, rankedBeforeMissing.payload.run.routeProgress);
});

test("the static local runtime matches Path Guard consumption, allowance, exclusions, and secrecy", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-path-guard-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  await Promise.all(LOCAL_RUNTIME_ASSETS.map((filename) =>
    copyFile(new URL(`../public/${filename}`, import.meta.url), join(directory, filename))
  ));
  const runtime = await import(
    `${pathToFileURL(join(directory, "local-beta.mjs")).href}?path-guard=${Date.now()}`
  );
  const world = await import(
    `${pathToFileURL(join(directory, "local-world.mjs")).href}?path-guard=${Date.now()}`
  );
  const start = async (body) => {
    const preview = await runtime.localRequest("/api/run/preview", requestOptions(body));
    const started = await runtime.localRequest(
      "/api/run/start",
      requestOptions({ previewToken: preview.previewToken })
    );
    return started;
  };
  const routeFor = (started) => {
    const fullRoute = world.localRouteTo(started.game.target);
    return fullRoute.slice(Math.max(0, Number(started.game.startProfile?.routeStartIndex) || 0));
  };
  const resume = (started) => runtime.localRequest("/api/run/resume", requestOptions({
    runId: started.run.id,
    runToken: started.run.token,
    deferActivation: true
  }));
  const combine = (started, pair) => runtime.localRequest("/api/combine", requestOptions({
    a: pair.a,
    b: pair.b,
    runId: started.run.id,
    runToken: started.run.token
  }));
  const reveal = (started) => runtime.localRequest("/api/run/reveal", requestOptions({
    runId: started.run.id,
    runToken: started.run.token
  }));
  const rejectedLocalPair = async (started, pair) => {
    try {
      await combine(started, pair);
      assert.fail("the off-route local pairing should have been rejected");
    } catch (error) {
      assert.equal(error.code, "wrong_path");
      assert.equal(error.status, 409);
      assert.match(error.message, /wrong path|cannot advance|does not advance/i);
      assertSpoilerSafe(
        { error: error.message, code: error.code },
        { rejectedResult: pair.result?.word || "" }
      );
    }
  };
  const expectLocalCombinationMissing = async (started, pair) => {
    try {
      await combine(started, pair);
      assert.fail("the excluded local pairing should remain combination_missing");
    } catch (error) {
      assert.equal(error.code, "combination_missing");
      assert.equal(error.status, 422);
    }
  };

  for (const [rankId, masteryPoints, completedChallenges] of [
    ["bronze", 0, 0],
    ["silver", 50, 5]
  ]) {
    const started = await start({
      mode: "quick",
      seed: rankId === "bronze" ? 7811 : 7812,
      routeProgression: createRemixProgressionState({
        rankId,
        masteryPoints,
        completedChallenges
      })
    });
    assert.equal(started.game.remixes.rank.id, rankId);
    assert.equal(started.game.remixes.activeCount, 0);
    assertSpoilerSafe(started);
    const route = routeFor(started);
    const productive = actionableStep(route, started.game.starters);
    assert.ok(productive);
    const offRoute = localOffRoutePair({
      route,
      starters: started.game.starters,
      target: started.game.target,
      world
    });
    const before = await resume(started);
    assertSpoilerSafe(before);
    await rejectedLocalPair(started, offRoute);
    const after = await resume(started);
    assert.deepEqual(
      comparableLocalProgress(after),
      comparableLocalProgress(before),
      `${rankId} local rejection must not consume a move, discovery, history entry, or route progress`
    );
    const accepted = await combine(started, productive);
    assert.equal(accepted.word, productive.word);
    assert.equal(accepted.completed, false, "the fixture needs room to test a missing pairing");
    const missing = missingPair({
      route,
      available: [...started.game.starters, productive.word],
      lookup: world.lookupLocalCombination
    });
    const beforeMissing = await resume(started);
    await rejectedLocalPair(started, missing);
    const afterMissing = await resume(started);
    assert.deepEqual(
      comparableLocalProgress(afterMissing),
      comparableLocalProgress(beforeMissing),
      `${rankId} missing-pair guidance must remain completely non-consuming`
    );
  }

  const bronzeProgression = createRemixProgressionState({
    rankId: "bronze",
    masteryPoints: 0,
    completedChallenges: 0
  });
  const localManufacturing = await start({
    mode: "reach",
    adaptive: true,
    adaptiveTarget: "Manufacturing",
    routeProgression: bronzeProgression
  });
  assert.equal(localManufacturing.game.target, "Manufacturing");
  assert.equal(localManufacturing.game.remixes.rank.id, "bronze");
  const localManufacturingRoute = routeFor(localManufacturing);
  const localEnergyStep = localManufacturingRoute.find((step) =>
    pairKey(step.a, step.b) === pairKey("Air", "Fire")
    && step.word === "Energy"
  );
  assert.ok(localEnergyStep, "the local Manufacturing guide must include Air + Fire в†’ Energy");
  const localEnergy = await combine(localManufacturing, localEnergyStep);
  assert.equal(localEnergy.word, "Energy");
  await reveal(localManufacturing);

  const localMud = await start({
    mode: "reach",
    adaptive: true,
    adaptiveTarget: "Mud",
    routeProgression: bronzeProgression
  });
  assert.equal(localMud.game.target, "Mud");
  assert.equal(localMud.game.remixes.rank.id, "bronze");
  const localMudRoute = routeFor(localMud);
  assert.equal(
    localMudRoute.some((step) => step.word.toLocaleLowerCase("en-US") === "land"),
    false,
    "Land must not be a local selected-guide result for Mud"
  );
  const localLandDetour = {
    a: "Earth",
    b: "Earth",
    result: world.lookupLocalCombination("Earth", "Earth")
  };
  assert.equal(localLandDetour.result?.word, "Land");
  const localMudBefore = await resume(localMud);
  await rejectedLocalPair(localMud, localLandDetour);
  const localMudAfter = await resume(localMud);
  assert.deepEqual(
    comparableLocalProgress(localMudAfter),
    comparableLocalProgress(localMudBefore),
    "the local selected-guide detour must remain completely non-consuming"
  );
  await reveal(localMud);

  const assisted = await start({ mode: "quick", seed: 7813 });
  const assistedRoute = routeFor(assisted);
  const assistedProductive = actionableStep(assistedRoute, assisted.game.starters);
  const assistedProductiveResult = await combine(assisted, assistedProductive);
  assert.equal(assistedProductiveResult.completed, false);
  const assistedOffRoute = localOffRoutePair({
    route: assistedRoute,
    starters: assisted.game.starters,
    target: assisted.game.target,
    world
  });
  const assistedMissing = missingPair({
    route: assistedRoute,
    available: [...assisted.game.starters, assistedProductive.word],
    lookup: world.lookupLocalCombination
  });
  await runtime.localRequest("/api/run/sense", requestOptions({
    runId: assisted.run.id,
    runToken: assisted.run.token
  }));
  await expectLocalCombinationMissing(assisted, assistedMissing);
  const assistedCombination = await combine(assisted, assistedOffRoute);
  assert.equal(assistedCombination.word, assistedOffRoute.result.word);

  const replaySource = await start({ mode: "quick", seed: 7814 });
  await reveal(replaySource);
  const replayed = await runtime.localRequest("/api/run/replay", requestOptions({
    runId: replaySource.run.id,
    runToken: replaySource.run.token
  }));
  assert.equal(replayed.game.practiceReplay, true);
  const replayRoute = routeFor(replayed);
  const replayOffRoute = localOffRoutePair({
    route: replayRoute,
    starters: replayed.game.starters,
    target: replayed.game.target,
    world
  });
  const replayCombination = await combine(replayed, replayOffRoute);
  assert.equal(replayCombination.word, replayOffRoute.result.word);

  const gold = await start({
    mode: "reach",
    seed: 7815,
    adaptive: true,
    adaptiveVersion: 2,
    adaptiveLevel: 7,
    adaptiveCompletedChallenges: 8,
    routeProgression: createRemixProgressionState({
      rankId: "gold",
      masteryPoints: 200,
      completedChallenges: 8
    })
  });
  assert.equal(gold.game.remixes.rank.id, "gold");
  assert.ok(gold.game.remixes.activeCount > 0);
  const goldRoute = routeFor(gold);
  const goldOffRoute = localOffRoutePair({
    route: goldRoute,
    starters: gold.game.starters,
    target: gold.game.target,
    world
  });
  const goldCombination = await combine(gold, goldOffRoute);
  assert.equal(goldCombination.word, goldOffRoute.result.word, "Gold/Remix runs must fail open");
  const goldMissing = missingPair({
    route: goldRoute,
    available: [...gold.game.starters, goldOffRoute.result.word],
    lookup: world.lookupLocalCombination
  });
  await expectLocalCombinationMissing(gold, goldMissing);
});
