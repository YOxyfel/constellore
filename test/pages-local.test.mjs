import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { generateLocalWorldData, lookupGeneratedCombination, writeLocalWorldModule } from "../scripts/build-local-world.mjs";

test("the compact Pages universe preserves important logical combinations", async () => {
  const data = await generateLocalWorldData();
  assert.equal(data.words.length, 423);
  assert.equal(data.matrix.length, 89_676);
  assert.equal(lookupGeneratedCombination(data, "Earth", "Water").word, "Mud");
  assert.equal(lookupGeneratedCombination(data, "Water", "Water").word, "Ocean");
  assert.equal(lookupGeneratedCombination(data, "Fire", "Fire").word, "Inferno");
  assert.equal(lookupGeneratedCombination(data, "Species", "Air").word, "Bird");
});

test("every Pages mode target has a dependency-ordered route from the four starters", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-routes-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const data = await generateLocalWorldData();
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  const world = await import(`${pathToFileURL(join(directory, "local-world.mjs")).href}?test=${Date.now()}`);
  assert.deepEqual(world.localRouteTo("Earth"), [], "starter targets should use a zero-step local route");

  const regularModes = ["reach", "quick", "moves", "daily", "challenge"];
  const games = regularModes.flatMap((mode) => data.payload.modes[mode]);
  for (const stages of data.payload.modes.weekly) games.push(...stages);
  const targets = new Set(games.map((game) => game.target));
  assert.ok(targets.size >= 8, "the local mode cycles should cover the featured target catalog");

  for (const target of targets) {
    const route = world.localRouteTo(target);
    assert.ok(Array.isArray(route) && route.length > 0, `${target} should have a reveal route`);
    const available = new Set(["earth", "water", "fire", "air"]);
    for (const step of route) {
      assert.ok(available.has(step.a.toLowerCase()), `${target}: ${step.a} should be available before ${step.word}`);
      assert.ok(available.has(step.b.toLowerCase()), `${target}: ${step.b} should be available before ${step.word}`);
      assert.equal(world.lookupLocalCombination(step.a, step.b).word, step.word, `${target}: reveal steps must use the local matrix`);
      available.add(step.word.toLowerCase());
    }
    assert.equal(route.at(-1).word.toLowerCase(), target.toLowerCase());
  }

  const repeatedInput = world.localRouteTo("Ocean");
  assert.ok(repeatedInput.some((step) => step.a === "Water" && step.b === "Water" && step.word === "Ocean"));
});

test("the Pages adapter completes a real local Telescope route without a server", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-pages-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  await copyFile(new URL("../public/local-beta.mjs", import.meta.url), join(directory, "local-beta.mjs"));
  const { localRequest } = await import(`${pathToFileURL(join(directory, "local-beta.mjs")).href}?test=${Date.now()}`);

  const registration = await localRequest("/api/player/register", { method: "POST" });
  assert.equal(registration.player.callsign, "Local Stargazer");
  const started = await localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ mode: "reach", seed: 7, target: "Telescope" })
  });
  assert.equal(started.game.target, "Telescope");
  assert.equal(started.run.ranked, false);

  const wished = await localRequest("/api/wish", {
    method: "POST",
    body: JSON.stringify({ word: "Moon", runId: started.run.id, runToken: started.run.token })
  });
  assert.equal(wished.word, "Moon");
  assert.equal(wished.localOnly, true);

  const combine = (a, b) => localRequest("/api/combine", {
    method: "POST",
    body: JSON.stringify({ a, b, runId: started.run.id, runToken: started.run.token })
  });
  assert.equal((await combine("Air", "Fire")).word, "Energy");
  assert.equal((await combine("Air", "Energy")).word, "Light");
  assert.equal((await combine("Air", "Light")).word, "Sky");
  assert.equal((await combine("Earth", "Fire")).word, "Lava");
  assert.equal((await combine("Lava", "Water")).word, "Stone");
  assert.equal((await combine("Air", "Stone")).word, "Sand");
  assert.equal((await combine("Fire", "Sand")).word, "Glass");
  const telescope = await combine("Glass", "Sky");
  assert.equal(telescope.word, "Telescope");
  assert.equal(telescope.completed, true);
  assert.equal(telescope.ranked, false);

  await assert.rejects(
    localRequest("/api/custom-target", { method: "POST", body: JSON.stringify({ target: "Unmapped Nonsensecraft" }) }),
    /not mapped in local practice/i
  );
  await assert.rejects(localRequest("/api/leaderboard"), /online account service/i);
});

test("the Pages reveal endpoint is idempotent and permanently zero-score", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-reveal-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  await copyFile(new URL("../public/local-beta.mjs", import.meta.url), join(directory, "local-beta.mjs"));
  const { localRequest } = await import(`${pathToFileURL(join(directory, "local-beta.mjs")).href}?test=${Date.now()}`);
  const started = await localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ mode: "reach", seed: 7, target: "Telescope" })
  });
  const request = {
    method: "POST",
    body: JSON.stringify({ runId: started.run.id, runToken: started.run.token })
  };

  const first = await localRequest("/api/run/reveal", request);
  const second = await localRequest("/api/run/reveal", request);
  assert.deepEqual(second, first);
  assert.equal(first.target, "Telescope");
  assert.equal(first.route.at(-1).word, "Telescope");
  assert.equal(first.assisted, true);
  assert.equal(first.assist, "reveal");
  assert.equal(first.completed, true);
  assert.equal(first.scoringDisabled, true);
  assert.equal(first.scoreEligible, false);
  assert.equal(first.rewardEligible, false);
  assert.equal(first.leaderboardEligible, false);
  assert.equal(first.score, 0);

  const available = new Set(["earth", "water", "fire", "air"]);
  for (const step of first.route) {
    assert.ok(available.has(step.a.toLowerCase()));
    assert.ok(available.has(step.b.toLowerCase()));
    available.add(step.word.toLowerCase());
  }
  await assert.rejects(
    localRequest("/api/combine", {
      method: "POST",
      body: JSON.stringify({ runId: started.run.id, runToken: started.run.token, a: "Earth", b: "Water" })
    }),
    /already complete/i
  );
  await assert.rejects(
    localRequest("/api/wish", {
      method: "POST",
      body: JSON.stringify({ runId: started.run.id, runToken: started.run.token, word: "Moon" })
    }),
    /already complete/i
  );
});
