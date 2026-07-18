import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { generateLocalWorldData, lookupGeneratedCombination, writeLocalWorldModule } from "../scripts/build-local-world.mjs";

test("the compact Pages universe preserves important logical combinations", async () => {
  const data = await generateLocalWorldData();
  assert.ok(data.words.length >= 425);
  assert.equal(data.matrix.length, data.words.length * (data.words.length + 1) / 2);
  assert.ok(data.words.some((item) => item.word === "Concrete"));
  assert.ok(data.words.some((item) => item.word === "Great Wall"));
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
  await copyFile(new URL("../public/cosmic-twists.mjs", import.meta.url), join(directory, "cosmic-twists.mjs"));
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

test("the Pages adapter produces one contextual Cosmic Twist and keeps it playable", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-twist-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  await copyFile(new URL("../public/local-beta.mjs", import.meta.url), join(directory, "local-beta.mjs"));
  await copyFile(new URL("../public/cosmic-twists.mjs", import.meta.url), join(directory, "cosmic-twists.mjs"));
  const { localRequest } = await import(`${pathToFileURL(join(directory, "local-beta.mjs")).href}?test=${Date.now()}`);
  const started = await localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ mode: "reach", seed: 14, target: "Telescope" })
  });
  const combine = (a, b) => localRequest("/api/combine", {
    method: "POST",
    body: JSON.stringify({ a, b, runId: started.run.id, runToken: started.run.token })
  });

  assert.equal((await combine("Earth", "Water")).word, "Mud");
  assert.equal((await combine("Mud", "Fire")).word, "Brick");
  const twist = await combine("Brick", "Brick");
  assert.equal(twist.word, "Great Wall");
  assert.equal(twist.source, "twist");
  assert.equal(twist.twisted, true);
  assert.equal(twist.twist.canonicalWord, "Wall");

  const retry = await combine("Brick", "Brick");
  assert.equal(retry.word, "Wall", "the same pair should return its canonical result after the one Twist");
  assert.equal(retry.twisted, undefined);
  const continued = await combine(twist.word, "Earth");
  assert.ok(continued.word, "a Cosmic Twist discovery should remain usable in later combinations");
});

test("the Pages reveal endpoint is idempotent and permanently zero-score", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-reveal-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  await copyFile(new URL("../public/local-beta.mjs", import.meta.url), join(directory, "local-beta.mjs"));
  await copyFile(new URL("../public/cosmic-twists.mjs", import.meta.url), join(directory, "cosmic-twists.mjs"));
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

test("the Pages adapter safely reconstructs an unranked run after a module reload", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-resume-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  await copyFile(new URL("../public/local-beta.mjs", import.meta.url), join(directory, "local-beta.mjs"));
  await copyFile(new URL("../public/cosmic-twists.mjs", import.meta.url), join(directory, "cosmic-twists.mjs"));
  const moduleUrl = pathToFileURL(join(directory, "local-beta.mjs")).href;
  const firstRuntime = await import(`${moduleUrl}?test=start-${Date.now()}`);
  const started = await firstRuntime.localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ mode: "reach", seed: 7, target: "Telescope" })
  });
  const mud = await firstRuntime.localRequest("/api/combine", {
    method: "POST",
    body: JSON.stringify({ a: "Earth", b: "Water", runId: started.run.id, runToken: started.run.token })
  });
  assert.equal(mud.word, "Mud");
  const wished = await firstRuntime.localRequest("/api/wish", {
    method: "POST",
    body: JSON.stringify({ word: "Moon", runId: started.run.id, runToken: started.run.token })
  });

  const snapshot = {
    game: { ...started.game, moveLimit: 1, ranked: true },
    run: { ...started.run, ranked: true },
    progress: {
      moves: 1,
      completed: false,
      submitted: true,
      usedWish: true,
      bendItem: wished,
      discovered: [
        ...started.game.starters.map((word) => ({ word })),
        mud,
        wished,
        { word: "Definitely Not A Local Word" }
      ],
      history: [
        { a: "Earth", b: "Water", ...mud },
        { a: "Earth", b: "Air", word: "Ocean", source: "twist", twisted: true },
        { a: "Earth", b: "Air", word: "Definitely Not A Local Word" }
      ]
    }
  };

  const secondRuntime = await import(`${moduleUrl}?test=reload-${Date.now()}`);
  const resumed = await secondRuntime.localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify({ runId: started.run.id, runToken: started.run.token, snapshot })
  });
  assert.equal(resumed.game.target, "Telescope");
  assert.equal(resumed.game.ranked, false);
  assert.notEqual(resumed.game.moveLimit, 1, "client game rules must be rebuilt from the local catalog");
  assert.equal(resumed.run.ranked, false);
  assert.equal(resumed.run.localOnly, true);
  assert.equal(resumed.run.scoreEligible, false);
  assert.equal(resumed.run.leaderboardEligible, false);
  assert.equal(resumed.progress.moves, 1);
  assert.equal(resumed.progress.completed, false);
  assert.equal(resumed.progress.submitted, false, "an incomplete snapshot cannot be marked submitted");
  assert.equal(resumed.progress.usedBend, true);
  assert.equal(resumed.progress.bendItem.word, "Moon");
  assert.deepEqual(resumed.progress.history.map((step) => step.word), ["Mud"]);
  assert.ok(resumed.progress.discovered.some((item) => item.word === "Mud"));
  assert.ok(resumed.progress.discovered.some((item) => item.word === "Moon"));
  assert.ok(!resumed.progress.discovered.some((item) => item.word === "Definitely Not A Local Word"));

  const brick = await secondRuntime.localRequest("/api/combine", {
    method: "POST",
    body: JSON.stringify({ a: "Mud", b: "Fire", runId: started.run.id, runToken: started.run.token })
  });
  assert.equal(brick.word, "Brick", "restored discoveries should remain playable");
  const resumedFromMemory = await secondRuntime.localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify({ runId: started.run.id, runToken: started.run.token })
  });
  assert.equal(resumedFromMemory.progress.moves, 2);
  assert.equal(resumedFromMemory.progress.history.at(-1).word, "Brick");

  const thirdRuntime = await import(`${moduleUrl}?test=mismatch-${Date.now()}`);
  await assert.rejects(
    thirdRuntime.localRequest("/api/run/resume", {
      method: "POST",
      body: JSON.stringify({ runId: started.run.id, runToken: started.run.token, snapshot: { ...snapshot, run: { ...snapshot.run, id: "other-run" } } })
    }),
    (error) => error.code === "resume_mismatch"
  );
});
