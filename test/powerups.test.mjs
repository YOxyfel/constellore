import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { GameStore, RunRegistry } from "../game-services.mjs";
import { server } from "../server.mjs";
import { writeLocalWorldModule } from "../scripts/build-local-world.mjs";

const giftResponseKeys = [
  "assist", "assisted", "item", "leaderboardEligible", "ranked",
  "rewardEligible", "scoreEligible", "scoringDisabled"
];
const localGiftResponseKeys = [...giftResponseKeys, "localOnly"].sort();
const giftItemKeys = ["category", "emoji", "source", "word"];

function assertSafeGift(payload, { local = false } = {}) {
  assert.deepEqual(Object.keys(payload).sort(), local ? localGiftResponseKeys : giftResponseKeys);
  assert.deepEqual(Object.keys(payload.item).sort(), giftItemKeys);
  assert.equal(payload.item.source, "gift");
  assert.ok(payload.item.word);
  assert.equal(payload.assisted, true);
  assert.equal(payload.scoringDisabled, true);
  assert.equal(payload.scoreEligible, false);
  assert.equal(payload.rewardEligible, false);
  assert.equal(payload.leaderboardEligible, false);
  assert.equal(payload.ranked, false);
  for (const forbidden of ["a", "b", "ingredients", "note", "recipe", "result", "route", "target"]) {
    assert.equal(Object.hasOwn(payload, forbidden), false, `Gift response must not expose ${forbidden}`);
    assert.equal(Object.hasOwn(payload.item, forbidden), false, `Gift item must not expose ${forbidden}`);
  }
}

test("Word Gift is a durable, score-ineligible run mutation", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-gift-store-"));
  const path = join(directory, "store.json");
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = await new GameStore(path).init();
  const player = await store.registerPlayer();
  const registry = new RunRegistry(store);
  const game = { mode: "quick", target: "Telescope", tier: 2, starters: ["Earth", "Water", "Fire", "Air"] };
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
  assert.equal(started.run.scoringDisabled, true);
  assert.equal(started.run.forfeited, true);
  assert.equal(started.run.forfeitReason, "gift");
  assert.equal(started.run.discovered.get("glass").source, "gift");
  assert.deepEqual(registry.gift(started.run, { word: "Stone" }), item, "retries return the original gift");
  assert.throws(() => registry.finalize(started.run, player.callsign), (error) => error.serviceCode === "assisted_run");
  await registry.persist(started.run);

  const reloadedStore = await new GameStore(path).init();
  const reloadedRegistry = new RunRegistry(reloadedStore);
  const restored = reloadedRegistry.get(started.run.runId, player.id, started.token);
  assert.equal(restored.giftUsed, true);
  assert.equal(restored.giftItem.word, "Glass");
  assert.equal(restored.discovered.get("glass").feedbackEligible, false);
  assert.equal(restored.assist, "gift");
  assert.equal(restored.scoringDisabled, true);

  const replay = reloadedRegistry.start(player.id, game, {
    ranked: false,
    challengeId: "quick:gift-test",
    scoringDisabled: true,
    forfeitReason: "gift"
  });
  assert.equal(replay.run.assist, "gift", "a forfeited challenge must not restore as Reveal");
  assert.equal(replay.run.scoringDisabled, true);
});

test("the authenticated Word Gift endpoint is idempotent, spoiler-safe, and forfeits the shared challenge", async (context) => {
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
  const parallel = await request("/api/run/start", { body: { mode: "quick" } });
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
  assert.equal(resumed.payload.run.scoringDisabled, true);
  assert.equal(resumed.payload.run.scoreEligible, false);
  assert.equal(resumed.payload.progress.giftUsed, true);
  assert.equal(resumed.payload.progress.giftItem.word, first.payload.item.word);

  const submit = await request("/api/run/submit", { body: credentials });
  assert.equal(submit.response.status, 200);
  assert.equal(submit.payload.assist, "gift");
  assert.equal(submit.payload.score, 0);
  assert.match(submit.payload.reason, /Word Gift/);

  const parallelSubmit = await request("/api/run/submit", {
    body: { runId: parallel.payload.run.id, runToken: parallel.payload.run.token }
  });
  assert.equal(parallelSubmit.response.status, 200);
  assert.equal(parallelSubmit.payload.assist, "gift");
  assert.equal(parallelSubmit.payload.score, 0);

  const replay = await request("/api/run/start", { body: { mode: "quick" } });
  assert.equal(replay.payload.run.ranked, false);
  assert.equal(replay.payload.run.scoringDisabled, true);
  assert.equal(replay.payload.run.assist, "gift");
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
  assert.equal(resumed.run.scoreEligible, false);
  assert.equal(resumed.progress.giftUsed, true);

  const snapshot = {
    version: 1,
    game: started.game,
    run: { ...started.run, assist: "none", scoreEligible: true },
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
      assist: "none",
      scoringDisabled: false
    }
  };
  const secondRuntime = await import(`${moduleUrl}?test=restore-${Date.now()}`);
  const hostileResume = await secondRuntime.localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify({ ...credentials, snapshot })
  });
  assert.equal(hostileResume.run.assist, "gift");
  assert.equal(hostileResume.run.scoringDisabled, true);
  assert.equal(hostileResume.run.scoreEligible, false);
  assert.equal(hostileResume.progress.giftUsed, true);
  assert.equal(hostileResume.progress.giftItem.word, first.item.word);
});
