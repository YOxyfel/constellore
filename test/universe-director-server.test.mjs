import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { selectUniverse } from "../public/universe-director.mjs";
import { server } from "../server.mjs";

const MANIFEST_KEYS = [
  "lawId",
  "routeSteps",
  "seasonId",
  "seedId",
  "starterCount",
  "targetId",
  "universeId",
  "validated",
  "version"
].sort();

test("online games validate and expose deterministic non-spoiler universe context", async (context) => {
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

  const preview = await request("/api/game?mode=reach&seed=7&target=Telescope", { authenticated: false });
  assert.equal(preview.response.status, 200);
  assert.deepEqual(preview.payload.universe, selectUniverse(preview.payload.seed));
  assert.equal(preview.payload.universe.seedId.startsWith("cx1-"), true);

  const custom = await request("/api/custom-target", {
    method: "POST",
    authenticated: false,
    body: { target: "Telescope" }
  });
  assert.equal(custom.response.status, 200);
  assert.deepEqual(custom.payload.universe, selectUniverse(custom.payload.seed));
  const seedZeroPreview = await request("/api/game?mode=reach&seed=0&target=Telescope", { authenticated: false });
  assert.deepEqual(custom.payload.universe, seedZeroPreview.payload.universe, "custom and regular games use the same seed selection contract");

  const registration = await request("/api/player/register", { method: "POST", authenticated: false });
  assert.equal(registration.response.status, 201);
  auth = {
    "x-constellore-player": registration.payload.player.id,
    "x-constellore-token": registration.payload.playerToken
  };

  const ranked = await request("/api/run/start", { method: "POST", body: { mode: "quick" } });
  assert.equal(ranked.response.status, 201);
  assert.equal(ranked.payload.run.ranked, true);
  assert.deepEqual(ranked.payload.game.universe, selectUniverse(ranked.payload.game.seed));
  assert.deepEqual(Object.keys(ranked.payload.game.universeManifest).sort(), MANIFEST_KEYS);
  assert.equal(ranked.payload.game.universeManifest.validated, true);
  assert.equal(ranked.payload.game.universeManifest.universeId, ranked.payload.game.universe.id);
  assert.ok(ranked.payload.game.universeManifest.routeSteps > 0);
  assert.equal(ranked.payload.game.universeManifest.starterCount, 4);
  assert.doesNotMatch(JSON.stringify(ranked.payload.game.universeManifest), new RegExp(ranked.payload.game.target, "i"));
  assert.equal("solutionRoute" in ranked.payload.game, false);
  assert.equal("solutionRoute" in ranked.payload.run, false);
  assert.equal("revealRoute" in ranked.payload.run, false);

  const rankedResume = await request("/api/run/resume", {
    method: "POST",
    body: { runId: ranked.payload.run.id, runToken: ranked.payload.run.token }
  });
  assert.equal(rankedResume.response.status, 200);
  assert.deepEqual(rankedResume.payload.game.universeManifest, ranked.payload.game.universeManifest, "only the opaque validated manifest is persisted with the game");
  assert.equal("solutionRoute" in rankedResume.payload.game, false);
  assert.equal("solutionRoute" in rankedResume.payload.progress, false);
  assert.equal("revealRoute" in rankedResume.payload.progress, false);

  const practice = await request("/api/run/start", {
    method: "POST",
    body: { mode: "reach", seed: 7, target: "Telescope" }
  });
  assert.equal(practice.response.status, 201);
  assert.equal(practice.payload.run.ranked, false);
  assert.deepEqual(practice.payload.game.universe, preview.payload.universe);
  assert.deepEqual(Object.keys(practice.payload.game.universeManifest).sort(), MANIFEST_KEYS);

  const credentials = { runId: practice.payload.run.id, runToken: practice.payload.run.token };
  const mud = await request("/api/combine", {
    method: "POST",
    body: { ...credentials, a: "Earth", b: "Water" }
  });
  assert.equal(mud.response.status, 200);
  assert.equal(mud.payload.word, "Mud");
  assert.equal(mud.payload.source, "world");
  assert.equal(mud.payload.completed, false);
  assert.equal(mud.payload.ranked, false);
  assert.equal(mud.payload.division, "pure");
  assert.equal(mud.payload.universeContext.seedId, practice.payload.game.universe.seedId);
  assert.equal(mud.payload.universeContext.universeId, practice.payload.game.universe.id);
  assert.deepEqual(Object.keys(mud.payload.universeContext).sort(), ["label", "lawId", "resonance", "seasonId", "seedId", "universeId"]);
  assert.doesNotMatch(JSON.stringify(mud.payload.universeContext), /score|ranked|reward|leaderboard/i);

  const twistRun = await request("/api/run/start", {
    method: "POST",
    body: { mode: "reach", seed: 14, target: "Telescope" }
  });
  const combineTwistRun = (a, b) => request("/api/combine", {
    method: "POST",
    body: { runId: twistRun.payload.run.id, runToken: twistRun.payload.run.token, a, b }
  });
  assert.equal((await combineTwistRun("Earth", "Water")).payload.word, "Mud");
  assert.equal((await combineTwistRun("Mud", "Fire")).payload.word, "Brick");
  const twist = await combineTwistRun("Brick", "Brick");
  assert.equal(twist.payload.twisted, true);
  assert.equal(twist.payload.source, "twist");
  assert.equal(twist.payload.universeContext, undefined, "a substituted result must not inherit canonical context");
  assert.equal(twist.payload.ranked, false);
  assert.equal(twist.payload.division, "pure");
});
