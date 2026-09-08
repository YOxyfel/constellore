import assert from "node:assert/strict";
import { once } from "node:events";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { writeLocalWorldModule } from "../scripts/build-local-world.mjs";
import { server, solutionRoute } from "../server.mjs";

const LOCAL_RUNTIME_ASSETS = [
  "adaptive-difficulty.mjs",
  "concept-chemistry.mjs",
  "remix-progression.mjs",
  "remix-readiness.mjs",
  "path-guard.mjs",
  "route-remixes.mjs",
  "shuffled-start.mjs",
  "local-beta.mjs",
  "cosmic-twists.mjs",
  "engagement-features.mjs",
  "universe-director.mjs",
  "recipe-feedback.mjs",
  "recipe-mastery.mjs",
  "worldweaving.mjs"
];

const requestOptions = (body) => ({ method: "POST", body: JSON.stringify(body) });

async function prepareRuntime(directory) {
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  await Promise.all(LOCAL_RUNTIME_ASSETS.map((filename) =>
    copyFile(new URL(`../public/${filename}`, import.meta.url), join(directory, filename))
  ));
  const suffix = Date.now();
  return {
    runtime: await import(`${pathToFileURL(join(directory, "local-beta.mjs")).href}?worldweaving=${suffix}`),
    world: await import(`${pathToFileURL(join(directory, "local-world.mjs")).href}?worldweaving=${suffix}`)
  };
}

test("Moon Hive missions require Room + Room even after Wall + Wall made House", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-worldweaving-run-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const { runtime, world } = await prepareRuntime(directory);
  const worldweaving = { worldId: "moon", slotId: "shelter", choiceId: "hive" };

  const preview = await runtime.localRequest("/api/run/preview", requestOptions({
    mode: "moves",
    seed: 417,
    target: "House",
    adaptive: true,
    worldweaving
  }));
  assert.equal(preview.game.mode, "reach");
  assert.equal(preview.game.modeName, "Moon Worldweaving");
  assert.equal(preview.game.objectiveVerb, "Weave");
  assert.equal(preview.game.ranked, false);
  assert.equal(preview.game.adaptive, false);
  assert.equal(preview.game.remixes, undefined);
  assert.deepEqual(
    {
      worldId: preview.game.worldweavingObjective.worldId,
      slotId: preview.game.worldweavingObjective.slotId,
      choiceId: preview.game.worldweavingObjective.choiceId,
      target: preview.game.worldweavingObjective.target
    },
    { ...worldweaving, target: "House" }
  );

  const started = await runtime.localRequest("/api/run/start", requestOptions({
    previewToken: preview.previewToken
  }));
  assert.ok(started.game.routeLength > world.localRouteTo("House").length);
  const roomRoute = world.localRouteTo("Room");
  assert.ok(roomRoute.some((step) => step.word === "House"));
  const route = [...roomRoute, { a: "Room", b: "Room", word: "House" }];

  let earlyHouse = null;
  let final = null;
  for (const step of route) {
    const result = await runtime.localRequest("/api/combine", requestOptions({
      a: step.a,
      b: step.b,
      runId: started.run.id,
      runToken: started.run.token
    }));
    if (step.word === "House" && step.a === "Wall") earlyHouse = result;
    if (step.a === "Room" && step.b === "Room") final = result;
  }

  assert.equal(earlyHouse.completed, false);
  assert.equal(earlyHouse.targetMade, true);
  assert.equal(earlyHouse.completionBlocked, true);
  assert.match(earlyHouse.worldweavingMessage, /Room \+ Room/);
  assert.equal(earlyHouse.routeProgress.complete, false);
  assert.ok(earlyHouse.routeProgress.remaining > 0);
  assert.equal(final.completed, true);
  assert.equal(final.targetMade, true);
  assert.equal(final.completionBlocked, false);
  assert.equal(final.worldweavingMessage, "");
  assert.deepEqual(final.routeProgress, {
    total: started.game.routeLength,
    remaining: 0,
    complete: true,
    percent: 100
  });

  const revealPreview = await runtime.localRequest("/api/run/preview", requestOptions({
    mode: "reach",
    seed: 418,
    target: "House",
    worldweaving
  }));
  const revealStarted = await runtime.localRequest("/api/run/start", requestOptions({
    previewToken: revealPreview.previewToken
  }));
  const revealed = await runtime.localRequest("/api/run/reveal", requestOptions({
    runId: revealStarted.run.id,
    runToken: revealStarted.run.token
  }));
  assert.equal(revealed.route.at(-1).a, "Room");
  assert.equal(revealed.route.at(-1).b, "Room");
  assert.equal(revealed.route.at(-1).word, "House");
  assert.ok(revealed.route.slice(0, -1).some((step) => (
    step.a === "Wall" && step.b === "Wall" && step.word === "House"
  )));
});

test("Moon mission requests cannot supply a recipe or mismatch their target", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-worldweaving-contract-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const { runtime } = await prepareRuntime(directory);

  await assert.rejects(
    runtime.localRequest("/api/run/preview", requestOptions({
      mode: "reach",
      seed: 1,
      target: "House",
      worldweaving: {
        worldId: "moon",
        slotId: "shelter",
        choiceId: "hive",
        recipe: { a: "Wall", b: "Wall", word: "House" }
      }
    })),
    (error) => error.code === "invalid_worldweaving_request" && error.status === 400
  );

  await assert.rejects(
    runtime.localRequest("/api/run/preview", requestOptions({
      mode: "reach",
      seed: 2,
      target: "House",
      worldweaving: { worldId: "moon", slotId: "power", choiceId: "solar" }
    })),
    (error) => error.code === "worldweaving_unavailable" && error.status === 422
  );
});

test("hosted Moon Hive runs remain open until the qualified pair is made", async (context) => {
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
  const request = async (path, body = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...auth },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    return { response, payload };
  };

  const registration = await request("/api/player/register");
  assert.equal(registration.response.status, 201);
  auth = {
    "x-constellore-player": registration.payload.player.id,
    "x-constellore-token": registration.payload.playerToken
  };

  const worldweaving = { worldId: "moon", slotId: "shelter", choiceId: "hive" };
  const preview = await request("/api/run/preview", {
    mode: "moves",
    seed: 419,
    target: "House",
    adaptive: true,
    worldweaving
  });
  assert.equal(preview.response.status, 200);
  assert.equal(preview.payload.game.mode, "reach");
  assert.equal(preview.payload.game.modeName, "Moon Worldweaving");
  assert.equal(preview.payload.game.ranked, false);
  assert.equal(preview.payload.game.adaptive, false);

  const started = await request("/api/run/start", { previewToken: preview.payload.previewToken });
  assert.equal(started.response.status, 201);
  const runAuth = {
    runId: started.payload.run.id,
    runToken: started.payload.run.token
  };

  let earlyHouse = null;
  for (const step of solutionRoute("Room")) {
    const combined = await request("/api/combine", { ...runAuth, a: step.a, b: step.b });
    assert.equal(combined.response.status, 200);
    if (step.word === "House" && step.a === "Wall" && step.b === "Wall") {
      earlyHouse = combined.payload;
    }
  }
  assert.ok(earlyHouse);
  assert.equal(earlyHouse.completed, false);
  assert.equal(earlyHouse.targetMade, true);
  assert.equal(earlyHouse.completionBlocked, true);
  assert.match(earlyHouse.worldweavingMessage, /Room \+ Room/);
  assert.equal(earlyHouse.routeProgress.complete, false);

  const final = await request("/api/combine", { ...runAuth, a: "Room", b: "Room" });
  assert.equal(final.response.status, 200);
  assert.equal(final.payload.completed, true);
  assert.equal(final.payload.completionBlocked, false);
  assert.deepEqual(final.payload.routeProgress, {
    total: started.payload.game.routeLength,
    remaining: 0,
    complete: true,
    percent: 100
  });
});
