import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { GameStore, RunRegistry } from "../game-services.mjs";
import { server, solutionRoute } from "../server.mjs";
import { writeLocalWorldModule } from "../scripts/build-local-world.mjs";

const giftResponseKeys = [
  "assist", "assisted", "division", "item", "leaderboardEligible", "ranked",
  "rewardEligible", "scoreEligible", "scoreMultiplier", "scoringDisabled"
];
const localGiftResponseKeys = [...giftResponseKeys, "localOnly"].sort();
const giftItemKeys = ["category", "emoji", "source", "word"];

function assertSafeGift(payload, { local = false } = {}) {
  assert.deepEqual(Object.keys(payload).sort(), local ? localGiftResponseKeys : giftResponseKeys);
  assert.deepEqual(Object.keys(payload.item).sort(), giftItemKeys);
  assert.equal(payload.item.source, "gift");
  assert.ok(payload.item.word);
  assert.equal(payload.assisted, true);
  assert.equal(payload.division, "open");
  assert.equal(payload.scoringDisabled, false);
  assert.equal(payload.scoreEligible, true);
  assert.equal(payload.scoreMultiplier, 0.5);
  assert.equal(payload.rewardEligible, true);
  assert.equal(payload.leaderboardEligible, !local);
  assert.equal(payload.ranked, !local);
  for (const forbidden of ["a", "b", "ingredients", "note", "recipe", "result", "route", "target"]) {
    assert.equal(Object.hasOwn(payload, forbidden), false, `Gift response must not expose ${forbidden}`);
    assert.equal(Object.hasOwn(payload.item, forbidden), false, `Gift item must not expose ${forbidden}`);
  }
}

test("Word Gift is a durable half-score Open run mutation", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-gift-store-"));
  const path = join(directory, "store.json");
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = await new GameStore(path).init();
  const player = await store.registerPlayer();
  const registry = new RunRegistry(store);
  const game = { mode: "quick", target: "Mud", tier: 1, starters: ["Earth", "Water", "Fire", "Air"] };
  const started = registry.start(player.id, game, { ranked: true, challengeId: "quick:gift-test" });
  const item = registry.gift(started.run, { word: "Glass", emoji: "🔍", category: "structure", source: "gift", a: "forbidden", b: "forbidden" });

  assert.deepEqual(item, {
    word: "Glass",
    emoji: "🔍",
    category: "structure",
    source: "gift",
    note: "A crucial bridge gifted by the cosmos.",
    feedbackEligible: false
  });
  assert.equal(started.run.giftUsed, true);
  assert.equal(started.run.assist, "gift");
  assert.equal(started.run.scoringDisabled, false);
  assert.equal(started.run.forfeited, false);
  assert.equal(started.run.forfeitReason, null);
  assert.equal(started.run.game.division, "open");
  assert.equal(started.run.discovered.get("glass").source, "gift");
  assert.deepEqual(registry.gift(started.run, { word: "Stone" }), item, "retries return the original gift");
  await registry.persist(started.run);

  const reloadedStore = await new GameStore(path).init();
  const reloadedRegistry = new RunRegistry(reloadedStore);
  const restored = reloadedRegistry.get(started.run.runId, player.id, started.token);
  assert.equal(restored.giftUsed, true);
  assert.equal(restored.giftItem.word, "Glass");
  assert.equal(restored.discovered.get("glass").feedbackEligible, false);
  assert.equal(restored.assist, "gift");
  assert.equal(restored.scoringDisabled, false);

  reloadedRegistry.canCombine(restored, "Earth", "Water");
  reloadedRegistry.recordCombination(restored, { word: "Mud", emoji: "🟤", category: "nature", source: "world" }, { a: "Earth", b: "Water" });
  const entry = reloadedRegistry.finalize(restored, player.callsign);
  assert.equal(entry.division, "open");
  assert.equal(entry.assist, "gift");
  assert.ok(entry.score > 0);
});

test("the authenticated Word Gift endpoint is idempotent, spoiler-safe, and keeps a reduced Open score", async (context) => {
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

  const malformed = await request("/api/run/gift", { body: { ...credentials, requestedWord: "Telescope" } });
  assert.equal(malformed.response.status, 400);
  assert.equal(malformed.payload.code, "invalid_gift_request");

  const [first, concurrent] = await Promise.all([
    request("/api/run/gift", { body: credentials }),
    request("/api/run/gift", { body: credentials })
  ]);
  assert.equal(first.response.status, 200);
  assertSafeGift(first.payload);
  assert.equal(first.payload.assist, "gift");
  assert.notEqual(first.payload.item.word.toLowerCase(), started.payload.game.target.toLowerCase());
  assert.equal(concurrent.response.status, 200);
  assert.deepEqual(concurrent.payload, first.payload, "concurrent retries must receive the same bridge word");

  const repeated = await request("/api/run/gift", { body: credentials });
  assert.equal(repeated.response.status, 200);
  assert.deepEqual(repeated.payload, first.payload);

  const resumed = await request("/api/run/resume", { body: credentials });
  assert.equal(resumed.payload.run.assist, "gift");
  assert.equal(resumed.payload.run.scoringDisabled, false);
  assert.equal(resumed.payload.run.scoreEligible, true);
  assert.equal(resumed.payload.run.scoreMultiplier, 0.5);
  assert.equal(resumed.payload.run.ranked, true);
  assert.equal(resumed.payload.progress.giftUsed, true);
  assert.equal(resumed.payload.progress.giftItem.word, first.payload.item.word);

  const completeAndSubmit = async (startedRun, extraWords = []) => {
    const proof = { runId: startedRun.run.id, runToken: startedRun.run.token };
    const known = new Set([...startedRun.game.starters, ...extraWords].map((word) => word.toLowerCase()));
    for (const step of solutionRoute(startedRun.game.target)) {
      if (known.has(step.word.toLowerCase())) continue;
      assert.ok(known.has(step.a.toLowerCase()) && known.has(step.b.toLowerCase()), `route dependencies must exist for ${step.word}`);
      const combined = await request("/api/combine", { body: { ...proof, a: step.a, b: step.b } });
      assert.equal(combined.response.status, 200);
      known.add(step.word.toLowerCase());
    }
    return request("/api/run/submit", { body: proof });
  };

  const submit = await completeAndSubmit(started.payload, [first.payload.item.word]);
  assert.equal(submit.response.status, 201);
  assert.equal(submit.payload.ranked, true);
  assert.equal(submit.payload.placement.entry.assist, "gift");
  assert.equal(submit.payload.placement.entry.division, "open");
  assert.ok(submit.payload.placement.entry.score > 0);

  // Ranked integrity permits one active attempt per player. Start the pure
  // comparison only after the assisted run has been finalized.
  const parallel = await request("/api/run/start", { body: { mode: "quick" } });
  assert.equal(parallel.response.status, 201);
  const parallelSubmit = await completeAndSubmit(parallel.payload);
  assert.equal(parallelSubmit.response.status, 201);
  assert.equal(parallelSubmit.payload.placement.entry.division, "pure");

  const replay = await request("/api/run/start", { body: { mode: "quick" } });
  assert.equal(replay.payload.run.ranked, true);
  assert.equal(replay.payload.run.scoringDisabled, false);
  assert.equal(replay.payload.run.assist, "none");
});

test("local-practice Word Gift mirrors the safe contract and fails closed during hostile restore", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-local-gift-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  for (const file of ["local-beta.mjs", "cosmic-twists.mjs", "engagement-features.mjs", "universe-director.mjs", "recipe-feedback.mjs"]) {
    await copyFile(new URL(`../public/${file}`, import.meta.url), join(directory, file));
  }
  const moduleUrl = pathToFileURL(join(directory, "local-beta.mjs")).href;
  const firstRuntime = await import(`${moduleUrl}?test=start-${Date.now()}`);
  const started = await firstRuntime.localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ mode: "reach", seed: 23, target: "Telescope" })
  });
  const credentials = { runId: started.run.id, runToken: started.run.token };
  const first = await firstRuntime.localRequest("/api/run/gift", { method: "POST", body: JSON.stringify(credentials) });
  assertSafeGift(first, { local: true });
  assert.equal(first.assist, "gift");
  const repeated = await firstRuntime.localRequest("/api/run/gift", { method: "POST", body: JSON.stringify(credentials) });
  assert.deepEqual(repeated, first);

  const resumed = await firstRuntime.localRequest("/api/run/resume", { method: "POST", body: JSON.stringify(credentials) });
  assert.equal(resumed.run.assist, "gift");
  assert.equal(resumed.run.scoreEligible, true);
  assert.equal(resumed.run.scoreMultiplier, 0.5);
  assert.equal(resumed.progress.giftUsed, true);

  const snapshot = {
    version: 1,
    game: started.game,
    run: { ...started.run, assist: "sense", scoreEligible: true, scoreMultiplier: 0.75 },
    progress: {
      moves: 0,
      completed: false,
      submitted: false,
      discovered: started.game.starters.map((word) => ({ word, source: "origin" })).concat({ ...first.item, source: "gift" }),
      history: [],
      usedBend: false,
      usedWish: false,
      bendItem: null,
      giftUsed: true,
      giftItem: first.item,
      assist: "sense",
      scoringDisabled: false
    }
  };
  const secondRuntime = await import(`${moduleUrl}?test=restore-${Date.now()}`);
  const hostileResume = await secondRuntime.localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify({ ...credentials, snapshot })
  });
  assert.equal(hostileResume.run.assist, "gift");
  assert.equal(hostileResume.run.scoringDisabled, false);
  assert.equal(hostileResume.run.scoreEligible, true);
  assert.equal(hostileResume.run.scoreMultiplier, 0.5);
  assert.equal(hostileResume.progress.giftUsed, true);
  assert.equal(hostileResume.progress.giftItem.word, first.item.word);
});
