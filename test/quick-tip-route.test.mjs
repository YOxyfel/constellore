import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { GameStore, RunRegistry } from "../game-services.mjs";
import { QUICK_TIP_LIMIT, selectRouteNavigationTip } from "../public/engagement-features.mjs";
import { server, solutionRoute } from "../server.mjs";
import { writeLocalWorldModule } from "../scripts/build-local-world.mjs";

const PUBLIC_TIP_KEYS = ["available", "remaining", "scoreSafe", "text", "used"];

function assertPublicTip(payload, { available = true } = {}) {
  assert.deepEqual(Object.keys(payload).sort(), PUBLIC_TIP_KEYS);
  assert.equal(payload.available, available);
  assert.equal(payload.scoreSafe, true);
  assert.equal(typeof payload.text, "string");
  assert.ok(payload.text.length > 0 && payload.text.length <= 240);
  assert.ok(Number.isInteger(payload.used) && payload.used >= 0 && payload.used <= QUICK_TIP_LIMIT);
  assert.equal(payload.remaining, QUICK_TIP_LIMIT - payload.used);
  for (const forbidden of ["anchor", "category", "id", "ingredients", "partner", "recipe", "result", "route", "target"]) {
    assert.equal(Object.hasOwn(payload, forbidden), false, `public tip response must not expose ${forbidden}`);
  }
}

const starters = [
  { word: "Earth", category: "nature" },
  { word: "Water", category: "force" },
  { word: "Fire", category: "force" },
  { word: "Air", category: "force" }
];

test("route navigation tips expose one stable discovered anchor without completing a recipe", () => {
  const route = [
    { a: "Earth", b: "Water", word: "Mud" },
    { a: "Fire", b: "Air", word: "Energy" },
    { a: "Mud", b: "Energy", word: "Life" }
  ];
  const options = { words: starters, route, target: "Life", seed: 0, mode: "quick" };
  const first = selectRouteNavigationTip(options);
  assert.deepEqual(selectRouteNavigationTip(options), first, "the same run state must produce the same signal");
  assert.equal(first.kind, "route");
  assert.equal(first.available, true);
  assert.equal(["Earth", "Water"].filter((word) => first.text.includes(word)).length, 1, "only one side of the ready pair may be named");
  assert.doesNotMatch(first.text, /Mud|Life/);

  const repeatedFrontier = selectRouteNavigationTip({ ...options, used: 1, seen: [first.id] });
  assert.equal(repeatedFrontier.kind, "route");
  assert.equal(repeatedFrontier.available, false, "an unresolved signal must not spend another tip");
  assert.match(repeatedFrontier.text, /still active/i);
  assert.equal(["Earth", "Water"].filter((word) => repeatedFrontier.text.includes(word)).length, 0);

  for (const seed of [0, 1, 99]) {
    const useful = selectRouteNavigationTip({ ...options, seed });
    assert.match(useful.text, /Earth/, "the signal should prefer the anchor that permits useful safe guidance");
    assert.match(useful.text, /force concept/i, "a category remains safe when multiple discovered partners fit it");
    assert.doesNotMatch(useful.text, /Water/, "the hidden partner must remain unnamed");
  }

  const sameWord = selectRouteNavigationTip({
    words: starters,
    route: [{ a: "Fire", b: "Fire", word: "Energy" }],
    target: "Energy",
    seed: 4
  });
  assert.match(sameWord.text, /same-word fusion/i);
  assert.doesNotMatch(sameWord.text, /Fire|Energy/, "same-word route steps must not name their ingredient or result");

  assert.doesNotThrow(() => selectRouteNavigationTip({ words: starters, route, target: Symbol("target"), seed: Symbol("seed"), moves: Symbol("moves") }));
});

test("RunRegistry makes Quick Tips durable, bounded, idempotent, and score safe", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-tip-store-"));
  const path = join(directory, "store.json");
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = await new GameStore(path).init();
  const player = await store.registerPlayer();
  const registry = new RunRegistry(store);
  const game = { mode: "quick", target: "Mud", tier: 1, starters: ["Earth", "Water", "Fire", "Air"] };
  const started = registry.start(player.id, game, { ranked: true, challengeId: "quick:tip-test" });
  let selections = 0;
  const select = ({ used }) => {
    selections += 1;
    return { id: `route-${used + 1}`, text: `Safe direction ${used + 1}.`, available: true };
  };

  const first = registry.tip(started.run, 0, select);
  const retry = registry.tip(started.run, 0, () => { throw new Error("idempotent retry must not reselect"); });
  assert.deepEqual(retry, first);
  assert.equal(selections, 1);
  assertPublicTip(first);
  assert.equal(first.used, 1);
  registry.tip(started.run, 1, select);
  registry.tip(started.run, 2, select);
  const exhausted = registry.tip(started.run, 3, select);
  assertPublicTip(exhausted, { available: false });
  assert.equal(selections, QUICK_TIP_LIMIT);
  assert.equal(started.run.assist, "none");
  assert.equal(started.run.scoringDisabled, false);
  assert.equal(started.run.forfeited, false);
  const progress = registry.progress(started.run);
  assert.equal(progress.tipsUsed, QUICK_TIP_LIMIT);
  assert.equal(Object.hasOwn(progress, "tipRecords"), false);
  assert.equal(Object.hasOwn(progress, "tipIds"), false);
  await registry.persist(started.run);

  const reloadedStore = await new GameStore(path).init();
  const reloadedRegistry = new RunRegistry(reloadedStore);
  const restored = reloadedRegistry.get(started.run.runId, player.id, started.token);
  assert.equal(restored.tipRecords.length, QUICK_TIP_LIMIT);
  assert.equal(reloadedRegistry.progress(restored).tipsUsed, QUICK_TIP_LIMIT);
  assert.equal(restored.assist, "none");
  assert.equal(restored.scoringDisabled, false);
});

test("the authenticated Quick Tip endpoint is exact, idempotent, and leaves ranked scoring intact", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(async () => {
    if (!server.listening) return;
    server.close();
    await once(server, "close");
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let auth = {};
  const request = async (path, { body = {}, authenticated = true } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(authenticated ? auth : {}) },
      body: JSON.stringify(body)
    });
    return { response, payload: await response.json() };
  };

  const registration = await request("/api/player/register", { authenticated: false });
  auth = {
    "x-constellore-player": registration.payload.player.id,
    "x-constellore-token": registration.payload.playerToken
  };
  const started = await request("/api/run/start", { body: { mode: "quick" } });
  const credentials = { runId: started.payload.run.id, runToken: started.payload.run.token };

  const unauthenticated = await request("/api/run/tip", { body: { ...credentials, tipIndex: 0 }, authenticated: false });
  assert.equal(unauthenticated.response.status, 401);
  const malformed = await request("/api/run/tip", { body: { ...credentials, tipIndex: 0, requestedWord: "Mud" } });
  assert.equal(malformed.response.status, 400);
  assert.equal(malformed.payload.code, "invalid_tip_request");

  const [first, concurrent] = await Promise.all([
    request("/api/run/tip", { body: { ...credentials, tipIndex: 0 } }),
    request("/api/run/tip", { body: { ...credentials, tipIndex: 0 } })
  ]);
  assert.equal(first.response.status, 200);
  assertPublicTip(first.payload);
  assert.deepEqual(concurrent.payload, first.payload);
  const route = solutionRoute(started.payload.game.target);
  const known = new Set(started.payload.game.starters.map((word) => word.toLowerCase()));
  const frontier = route.find((step) => known.has(step.a.toLowerCase()) && known.has(step.b.toLowerCase()));
  assert.ok(frontier);
  assert.equal([frontier.a, frontier.b].filter((word) => first.payload.text.includes(word)).length, frontier.a === frontier.b ? 0 : 1);
  assert.equal(first.payload.text.includes(frontier.word), false);
  assert.equal(first.payload.text.includes(started.payload.game.target), false);

  const unresolved = await request("/api/run/tip", { body: { ...credentials, tipIndex: 1 } });
  assertPublicTip(unresolved.payload, { available: false });
  assert.equal(unresolved.payload.used, 1, "the same unresolved route signal cannot spend another tip");
  assert.match(unresolved.payload.text, /still active/i);
  const retriedFirst = await request("/api/run/tip", { body: { ...credentials, tipIndex: 0 } });
  assert.equal(retriedFirst.payload.text, first.payload.text);
  assert.equal(retriedFirst.payload.used, 1, "an old retry returns the cached text with authoritative current counts");

  const resumed = await request("/api/run/resume", { body: credentials });
  assert.equal(resumed.payload.progress.tipsUsed, 1);
  assert.equal(Object.hasOwn(resumed.payload.progress, "tipRecords"), false);
  assert.equal(resumed.payload.run.assist, "none");
  assert.equal(resumed.payload.run.scoringDisabled, false);
  assert.equal(resumed.payload.run.scoreEligible, true);
  assert.equal(resumed.payload.run.leaderboardEligible, true);
});

test("local Pages Quick Tips mirror the safe contract and restore only the used count", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-local-tips-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  for (const file of ["local-beta.mjs", "cosmic-twists.mjs", "engagement-features.mjs", "universe-director.mjs", "recipe-feedback.mjs"]) {
    await copyFile(new URL(`../public/${file}`, import.meta.url), join(directory, file));
  }
  const moduleUrl = pathToFileURL(join(directory, "local-beta.mjs")).href;
  const localWorld = await import(`${pathToFileURL(join(directory, "local-world.mjs")).href}?test=tips-world-${Date.now()}`);
  const firstRuntime = await import(`${moduleUrl}?test=tips-${Date.now()}`);
  const started = await firstRuntime.localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ mode: "reach", seed: 23, target: "Telescope" })
  });
  const credentials = { runId: started.run.id, runToken: started.run.token };

  await assert.rejects(
    firstRuntime.localRequest("/api/run/tip", { method: "POST", body: JSON.stringify({ ...credentials, tipIndex: 0, target: "Telescope" }) }),
    (error) => error.code === "invalid_tip_request" && error.status === 400
  );
  const first = await firstRuntime.localRequest("/api/run/tip", { method: "POST", body: JSON.stringify({ ...credentials, tipIndex: 0 }) });
  const retry = await firstRuntime.localRequest("/api/run/tip", { method: "POST", body: JSON.stringify({ ...credentials, tipIndex: 0 }) });
  assertPublicTip(first);
  assert.deepEqual(retry, first);
  const unresolved = await firstRuntime.localRequest("/api/run/tip", { method: "POST", body: JSON.stringify({ ...credentials, tipIndex: 1 }) });
  assertPublicTip(unresolved, { available: false });
  assert.equal(unresolved.used, 1);
  assert.match(unresolved.text, /still active/i);

  const resumed = await firstRuntime.localRequest("/api/run/resume", { method: "POST", body: JSON.stringify(credentials) });
  assert.equal(resumed.progress.tipsUsed, 1);
  assert.equal(Object.hasOwn(resumed.progress, "tipRecords"), false);
  assert.equal(resumed.run.assist, "none");
  assert.equal(resumed.run.scoringDisabled, false);
  assert.equal(resumed.run.scoreEligible, true);

  const snapshot = { version: 1, game: started.game, run: started.run, progress: resumed.progress };
  const secondRuntime = await import(`${moduleUrl}?test=tips-restore-${Date.now()}`);
  const restored = await secondRuntime.localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify({ ...credentials, snapshot })
  });
  assert.equal(restored.progress.tipsUsed, 1);
  assert.equal(Object.hasOwn(restored.progress, "tipRecords"), false);
  const restoredRetry = await secondRuntime.localRequest("/api/run/tip", {
    method: "POST",
    body: JSON.stringify({ ...credentials, tipIndex: 0 })
  });
  assertPublicTip(restoredRetry);
  assert.equal(restoredRetry.used, 1);
  assert.equal(restoredRetry.text, first.text, "the active private route signal is restored without entering public progress");
  const restoredUnresolved = await secondRuntime.localRequest("/api/run/tip", {
    method: "POST",
    body: JSON.stringify({ ...credentials, tipIndex: 1 })
  });
  assertPublicTip(restoredUnresolved, { available: false });
  assert.equal(restoredUnresolved.used, 1, "reload must not spend another tip on the same unresolved frontier");
  assert.match(restoredUnresolved.text, /still active/i);
  const resumedAgain = await secondRuntime.localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
  assert.equal(resumedAgain.progress.tipsUsed, 1);

  const firstRouteStep = localWorld.localRouteTo(started.game.target)?.[0];
  assert.ok(firstRouteStep, "the local target exposes a first canonical frontier in its private world module");
  const combined = await secondRuntime.localRequest("/api/combine", {
    method: "POST",
    body: JSON.stringify({ ...credentials, a: firstRouteStep.a, b: firstRouteStep.b })
  });
  assert.equal(combined.completed, false, "the regression needs a later frontier after resolving signal one");
  const progressed = await secondRuntime.localRequest("/api/run/resume", { method: "POST", body: JSON.stringify(credentials) });
  const progressedSnapshot = { version: 1, game: started.game, run: started.run, progress: progressed.progress };
  const thirdRuntime = await import(`${moduleUrl}?test=tips-progress-restore-${Date.now()}`);
  await thirdRuntime.localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify({ ...credentials, snapshot: progressedSnapshot })
  });
  const nextFrontier = await thirdRuntime.localRequest("/api/run/tip", {
    method: "POST",
    body: JSON.stringify({ ...credentials, tipIndex: 1 })
  });
  assertPublicTip(nextFrontier);
  assert.equal(nextFrontier.used, 2, "progress before reload must unlock a signal for the newly reachable frontier");
  assert.doesNotMatch(nextFrontier.text, /still active/i);
});
