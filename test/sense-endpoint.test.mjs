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

const candidateKeys = ["category", "emoji", "signal", "word"];

function assertSafeCandidates(payload, availableWords) {
  assert.ok(Array.isArray(payload.candidates));
  assert.ok(payload.candidates.length >= 1 && payload.candidates.length <= 3);
  for (const candidate of payload.candidates) {
    assert.deepEqual(Object.keys(candidate).sort(), candidateKeys);
    assert.ok(availableWords.has(candidate.word.toLowerCase()), `${candidate.word} must already be discovered`);
    assert.ok(["bright", "warm", "resonant"].includes(candidate.signal));
    for (const forbidden of ["partner", "result", "route", "score", "rank", "reason"]) {
      assert.equal(Object.hasOwn(candidate, forbidden), false, `Sense must not leak ${forbidden}`);
    }
  }
  assert.equal(Object.hasOwn(payload, "route"), false);
  assert.equal(Object.hasOwn(payload, "target"), false);
  assert.equal(Object.hasOwn(payload, "score"), false);
}

test("Sense forfeiture is durable and cannot be submitted", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-sense-"));
  const path = join(directory, "store.json");
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = await new GameStore(path).init();
  const player = await store.registerPlayer();
  const registry = new RunRegistry(store);
  const game = { mode: "quick", target: "Mud", tier: 1, starters: ["Earth", "Water", "Fire", "Air"] };
  const started = registry.start(player.id, game, { ranked: true, challengeId: "quick:sense-test" });

  registry.sense(started.run);
  await registry.persist(started.run);
  assert.equal(started.run.assist, "sense");
  assert.equal(started.run.scoringDisabled, true);
  assert.equal(started.run.forfeited, true);
  assert.equal(started.run.forfeitReason, "sense");
  assert.throws(() => registry.finalize(started.run, player.callsign), (error) => error.serviceCode === "assisted_run");

  const reloadedStore = await new GameStore(path).init();
  const reloadedRegistry = new RunRegistry(reloadedStore);
  const restored = reloadedRegistry.get(started.run.runId, player.id, started.token);
  assert.equal(restored.assist, "sense");
  assert.equal(restored.scoringDisabled, true);
  assert.equal(restored.forfeitReason, "sense");
});

test("the authenticated Sense endpoint exposes only discovered descriptors and forfeits the shared challenge", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(async () => {
    if (!server.listening) return;
    server.close();
    await once(server, "close");
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let auth = {};
  const request = async (path, { body, authenticated = true } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(authenticated ? auth : {}) },
      body: JSON.stringify(body || {})
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
  assert.equal(started.response.status, 201);
  assert.equal(started.payload.run.ranked, true);

  const invalid = await request("/api/run/sense", {
    body: { runId: started.payload.run.id, runToken: "wrong-token" }
  });
  assert.equal(invalid.response.status, 401);

  const sensed = await request("/api/run/sense", {
    body: { runId: started.payload.run.id, runToken: started.payload.run.token }
  });
  assert.equal(sensed.response.status, 200);
  assert.equal(sensed.payload.assist, "sense");
  assert.equal(sensed.payload.assisted, true);
  assert.equal(sensed.payload.scoringDisabled, true);
  assert.equal(sensed.payload.scoreEligible, false);
  assert.equal(sensed.payload.rewardEligible, false);
  assert.equal(sensed.payload.leaderboardEligible, false);
  assertSafeCandidates(sensed.payload, new Set(["earth", "water", "fire", "air"]));

  const resumed = await request("/api/run/resume", {
    body: { runId: started.payload.run.id, runToken: started.payload.run.token }
  });
  assert.equal(resumed.payload.run.assist, "sense");
  assert.equal(resumed.payload.run.scoringDisabled, true);

  const parallelSubmit = await request("/api/run/submit", {
    body: { runId: parallel.payload.run.id, runToken: parallel.payload.run.token }
  });
  assert.equal(parallelSubmit.response.status, 200);
  assert.equal(parallelSubmit.payload.assist, "sense");
  assert.equal(parallelSubmit.payload.score, 0);

  const replay = await request("/api/run/start", { body: { mode: "quick" } });
  assert.equal(replay.payload.run.ranked, false);
  assert.equal(replay.payload.run.scoringDisabled, true);
  assert.equal(replay.payload.run.assist, "sense");
});

test("local practice Sense has the same non-spoiling, permanently assisted contract", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-local-sense-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  await copyFile(new URL("../public/local-beta.mjs", import.meta.url), join(directory, "local-beta.mjs"));
  await copyFile(new URL("../public/cosmic-twists.mjs", import.meta.url), join(directory, "cosmic-twists.mjs"));
  await copyFile(new URL("../public/engagement-features.mjs", import.meta.url), join(directory, "engagement-features.mjs"));
  await copyFile(new URL("../public/universe-director.mjs", import.meta.url), join(directory, "universe-director.mjs"));
  await copyFile(new URL("../public/recipe-feedback.mjs", import.meta.url), join(directory, "recipe-feedback.mjs"));
  const { localRequest } = await import(`${pathToFileURL(join(directory, "local-beta.mjs")).href}?test=${Date.now()}`);
  const started = await localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ mode: "reach", seed: 23, target: "Telescope" })
  });
  const credentials = { runId: started.run.id, runToken: started.run.token };
  const sensed = await localRequest("/api/run/sense", { method: "POST", body: JSON.stringify(credentials) });
  assert.equal(sensed.assist, "sense");
  assert.equal(sensed.scoringDisabled, true);
  assertSafeCandidates(sensed, new Set(["earth", "water", "fire", "air"]));

  const combined = await localRequest("/api/combine", {
    method: "POST",
    body: JSON.stringify({ ...credentials, a: "Earth", b: "Water" })
  });
  assert.equal(combined.word, "Mud", "Sense must not auto-complete or block continued play");
  assert.equal(combined.division, "local-assisted");

  const resumed = await localRequest("/api/run/resume", { method: "POST", body: JSON.stringify(credentials) });
  assert.equal(resumed.run.assist, "sense");
  assert.equal(resumed.run.scoringDisabled, true);
});
