import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import {
  DYNAMIC_RECIPE_LIMIT,
  cacheDynamicRecipe,
  curatedCombination,
  dynamicRecipeCacheSize,
  registerDynamicRoute,
  server,
  solutionRoute
} from "../server.mjs";

const fixture = (a, b, word, source = "ai-route") => ({
  a,
  b,
  word,
  emoji: "*",
  note: `${a} and ${b} form ${word}.`.slice(0, 100),
  source
});

test("AI recipes stay bounded without corrupting authored or active-run routes", async (t) => {
  const authoredConflict = cacheDynamicRecipe(fixture("Earth", "Water", "Bogus Mud", "ai"));
  assert.equal(authoredConflict.word, "Mud");
  assert.equal(curatedCombination("Earth", "Water").word, "Mud", "authored recipes must remain authoritative");

  assert.equal(registerDynamicRoute([
    fixture("Earth", "Water", "Bogus Mud"),
    fixture("Bogus Mud", "Fire", "Bogus Brick")
  ], "Bogus Brick"), null, "an AI route cannot redefine an authored pair");

  const target = "Aurora Gate";
  const route = registerDynamicRoute([
    fixture("Earth", "Water", "Mud"),
    fixture("Air", "Fire", "Energy"),
    fixture("Mud", "Energy", target)
  ], target);
  assert.ok(route);
  assert.equal(route.at(-1).word, target);
  assert.equal(curatedCombination("Earth", "Water").word, "Mud");

  assert.equal(registerDynamicRoute([
    fixture("Earth", "Water", "Mud"),
    fixture("Air", "Fire", "Energy"),
    fixture("Mud", "Energy", "False Gate")
  ], "False Gate"), null, "an AI route cannot redefine an existing dynamic pair");
  assert.equal(curatedCombination("Mud", "Energy").word, target);

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    if (server.listening) {
      server.close();
      await once(server, "close");
    }
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let auth = {};
  const request = async (path, { method = "GET", body } = {}) => {
    const encodedBody = body ? JSON.stringify(body) : "";
    const { status, text } = await new Promise((resolve, reject) => {
      const outgoing = httpRequest(`${baseUrl}${path}`, {
        method,
        headers: {
          ...auth,
          ...(body ? { "content-type": "application/json", "content-length": Buffer.byteLength(encodedBody) } : {})
        }
      }, (incoming) => {
        const chunks = [];
        incoming.on("data", (chunk) => chunks.push(chunk));
        incoming.on("end", () => resolve({
          status: incoming.statusCode || 0,
          text: Buffer.concat(chunks).toString("utf8")
        }));
      });
      outgoing.on("error", reject);
      if (encodedBody) outgoing.write(encodedBody);
      outgoing.end();
    });
    return { response: { status }, payload: JSON.parse(text) };
  };

  const registration = await request("/api/player/register", { method: "POST" });
  assert.equal(registration.response.status, 201);
  auth = {
    "x-constellore-player": registration.payload.player.id,
    "x-constellore-token": registration.payload.playerToken
  };

  const start = () => request("/api/run/start", { method: "POST", body: { mode: "reach", target, custom: true } });
  const missionPreview = await request("/api/run/preview", {
    method: "POST",
    body: { mode: "reach", target, custom: true }
  });
  assert.equal(missionPreview.response.status, 200);
  assert.equal(missionPreview.payload.game.target, target);
  assert.equal(typeof missionPreview.payload.previewToken, "string");
  const combinationRun = await start();
  const revealRun = await start();
  assert.equal(combinationRun.response.status, 201);
  assert.equal(revealRun.response.status, 201);
  assert.equal(combinationRun.payload.run.ranked, false);

  for (let index = 0; index <= DYNAMIC_RECIPE_LIMIT; index += 1) {
    cacheDynamicRecipe(fixture(`Cache A ${index}`, `Cache B ${index}`, `Cache Result ${index}`, "ai"));
  }
  assert.equal(dynamicRecipeCacheSize(), DYNAMIC_RECIPE_LIMIT);
  assert.equal(solutionRoute(target, { includeDynamic: true }), null, "the target route should be gone from the global cache");

  const combine = (run, a, b) => request("/api/combine", {
    method: "POST",
    body: { a, b, runId: run.payload.run.id, runToken: run.payload.run.token }
  });
  assert.equal((await combine(combinationRun, "Earth", "Water")).payload.word, "Mud");
  assert.equal((await combine(combinationRun, "Air", "Fire")).payload.word, "Energy");
  const completed = await combine(combinationRun, "Mud", "Energy");
  assert.equal(completed.response.status, 200);
  assert.equal(completed.payload.word, target);
  assert.equal(completed.payload.completed, true, "the run-scoped recipe must survive global eviction");

  const revealed = await request("/api/run/reveal", {
    method: "POST",
    body: { runId: revealRun.payload.run.id, runToken: revealRun.payload.run.token }
  });
  assert.equal(revealed.response.status, 200);
  assert.equal(revealed.payload.route.at(-1).word, target, "Reveal Path must use the run-scoped route after eviction");

  const expiredTarget = await start();
  assert.equal(expiredTarget.response.status, 422, "evicted routes should not remain globally reachable for new runs");

  const previewStart = await request("/api/run/start", {
    method: "POST",
    body: { previewToken: missionPreview.payload.previewToken }
  });
  assert.equal(previewStart.response.status, 201);
  assert.equal(previewStart.payload.game.target, target, "a signed briefing must carry its verified custom route through cache eviction or a restart");
});
