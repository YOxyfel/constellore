import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { contentQualityReport, generateLocalWorldData, lookupGeneratedCombination, writeLocalWorldModule } from "../scripts/build-local-world.mjs";

async function preparePagesAdapter(directory) {
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  await Promise.all([
    "local-beta.mjs",
    "cosmic-twists.mjs",
    "engagement-features.mjs",
    "universe-director.mjs",
    "recipe-feedback.mjs"
  ].map((filename) => copyFile(new URL(`../public/${filename}`, import.meta.url), join(directory, filename))));
}

test("the compact Pages universe preserves important logical combinations", async () => {
  const data = await generateLocalWorldData();
  assert.ok(data.words.length >= 700);
  assert.equal(data.matrix.length, data.words.length * (data.words.length + 1) / 2);
  assert.equal(data.payload.version, 3);
  assert.equal(data.payload.matrix, undefined, "the shipped local world must not serialize the dense empty matrix");
  assert.equal(data.payload.recipes.length, data.contentQuality.authoredCoverage.authoredPairs);
  assert.ok(data.words.some((item) => item.word === "Concrete"));
  assert.ok(data.words.some((item) => item.word === "Great Wall"));
  assert.equal(lookupGeneratedCombination(data, "Earth", "Water").word, "Mud");
  assert.equal(lookupGeneratedCombination(data, "Water", "Water").word, "Ocean");
  assert.equal(lookupGeneratedCombination(data, "Fire", "Fire").word, "Inferno");
  assert.equal(lookupGeneratedCombination(data, "Species", "Air").word, "Bird");
  assert.equal(lookupGeneratedCombination(data, "Dragon", "Telescope"), null, "the static goal universe must not manufacture a category-roulette answer");
  assert.ok(contentQualityReport(data).officialTargetCount >= 30);
});

test("the generated Pages world uses a compact sparse O(1) recipe index", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-sparse-world-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const worldPath = join(directory, "local-world.mjs");
  const payload = await writeLocalWorldModule(worldPath);
  const source = await readFile(worldPath, "utf8");
  const world = await import(`${pathToFileURL(worldPath).href}?test=sparse-${Date.now()}`);

  assert.doesNotMatch(source, /\"matrix\":/, "the generated module must not contain the former dense matrix payload");
  assert.match(source, /new Map\(payload[.]recipes[.]map/, "sparse recipes should be indexed once for practical O(1) lookup");
  assert.ok(Buffer.byteLength(source) < 450_000, `local-world.mjs should stay under 450 KB, got ${Buffer.byteLength(source)}`);
  assert.equal(world.localRecipeCount, payload.recipes.length);
  assert.match(world.localGraphVersion, /^3\./);
  assert.equal(world.lookupLocalCombination("Water", "Wind").word, "Wave");
  assert.equal(world.lookupLocalCombination("Dragon", "Telescope"), null);
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
  assert.ok(targets.size >= 30, "the local mode cycles should cover a deep official target catalog");

  for (const game of games) {
    const route = world.localRouteTo(game.target);
    assert.ok(route, `${game.mode} target ${game.target} should have guidance`);
    if (game.moveLimit) assert.ok(route.length <= game.moveLimit, `${game.target} guidance must fit ${game.moveLimit} moves`);
  }

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
  await preparePagesAdapter(directory);
  const { localRequest } = await import(`${pathToFileURL(join(directory, "local-beta.mjs")).href}?test=${Date.now()}`);

  const registration = await localRequest("/api/player/register", { method: "POST" });
  assert.equal(registration.player.callsign, "Local Stargazer");
  const missionPreview = await localRequest("/api/run/preview", {
    method: "POST",
    body: JSON.stringify({ mode: "reach", seed: 7, target: "Telescope" })
  });
  assert.equal("run" in missionPreview, false, "local briefing does not start an orbit");
  assert.equal(missionPreview.game.target, "Telescope");
  assert.equal(missionPreview.game.leaderboardEligible, false);
  assert.match(missionPreview.previewToken, /^mission-preview-/);
  const started = await localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ previewToken: missionPreview.previewToken })
  });
  assert.equal(started.game.target, "Telescope");
  assert.equal(started.game.target, missionPreview.game.target);
  assert.equal(started.run.ranked, false);
  assert.equal(started.game.universe.seedId.startsWith("cx1-"), true);
  assert.ok(started.game.universe.season.id);
  assert.ok(started.game.universe.law.id);
  const gamePreview = await localRequest("/api/game?mode=reach&seed=7");
  assert.deepEqual(gamePreview.universe, started.game.universe, "the same seed must select identical Pages universe presentation");

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
  const energy = await combine("Air", "Fire");
  assert.equal(energy.word, "Energy");
  assert.equal(energy.ranked, false);
  assert.equal(energy.localOnly, true);
  assert.equal(energy.feedbackEligible, true, "authored Pages recipes can be rated for local QA");
  const recipeVote = await localRequest("/api/recipe-feedback", {
    method: "POST",
    body: JSON.stringify({ runId: started.run.id, runToken: started.run.token, move: 1, rating: "logical" })
  });
  assert.deepEqual(recipeVote, { accepted: true, move: 1, rating: "logical", localOnly: true });
  assert.equal(energy.universeContext.seedId, started.game.universe.seedId);
  assert.equal(energy.universeContext.universeId, started.game.universe.id);
  assert.deepEqual(Object.keys(energy.universeContext).sort(), ["label", "lawId", "resonance", "seasonId", "seedId", "universeId"]);
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
  await preparePagesAdapter(directory);
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
  assert.equal(twist.universeContext, undefined, "a non-canonical Twist result must never receive canonical universe context");

  const retry = await combine("Brick", "Brick");
  assert.equal(retry.word, "Wall", "the same pair should return its canonical result after the one Twist");
  assert.equal(retry.twisted, undefined);
  assert.equal(retry.universeContext.seedId, started.game.universe.seedId);
  const continued = await combine(twist.word, "Earth");
  assert.ok(continued.word, "a Cosmic Twist discovery should remain usable in later combinations");
});

test("the Pages adapter rejects a run whose local route disagrees with the canonical matrix", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-invalid-route-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await preparePagesAdapter(directory);
  const worldPath = join(directory, "local-world.mjs");
  const source = await readFile(worldPath, "utf8");
  const routeReturn = "  return route;\n}\n\nexport function buildLocalGame";
  assert.ok(source.includes(routeReturn), "the fixture must find the generated route return");
  await writeFile(worldPath, source.replace(
    routeReturn,
    '  if (route.length) route[route.length - 1] = { ...route[route.length - 1], word: "Invented Route Result" };\n  return route;\n}\n\nexport function buildLocalGame'
  ), "utf8");
  const { localRequest } = await import(`${pathToFileURL(join(directory, "local-beta.mjs")).href}?test=${Date.now()}`);

  const preview = await localRequest("/api/game?mode=reach&seed=7");
  assert.ok(preview.universe?.seedId, "presentation metadata remains available before starting");
  await assert.rejects(
    localRequest("/api/run/start", {
      method: "POST",
      body: JSON.stringify({ mode: "reach", seed: 7, target: "Telescope" })
    }),
    (error) => error.code === "local_route_invalid" && error.status === 409
  );
});

test("the Pages reveal endpoint is idempotent and permanently zero-score", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-reveal-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await preparePagesAdapter(directory);
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
  assert.ok(first.route.every((step) => step.source), "verified reveal routes retain their existing recipe source field");
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

test("the Pages adapter supports safe no-run combinations for lessons and persistent Explore", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-pages-sandbox-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await preparePagesAdapter(directory);
  const { localRequest } = await import(`${pathToFileURL(join(directory, "local-beta.mjs")).href}?test=sandbox-${Date.now()}`);

  const lava = await localRequest("/api/combine", {
    method: "POST",
    body: JSON.stringify({ a: "Earth", b: "Fire", discovered: ["Earth", "Water", "Fire", "Air"] })
  });
  assert.equal(lava.word, "Lava");
  assert.equal(lava.completed, false);
  assert.equal(lava.ranked, false);
  assert.equal(lava.localOnly, true);

  const stone = await localRequest("/api/combine", {
    method: "POST",
    body: JSON.stringify({ a: "Lava", b: "Water", discovered: ["Earth", "Water", "Fire", "Air", "Lava"] })
  });
  assert.equal(stone.word, "Stone");

  await assert.rejects(
    localRequest("/api/combine", {
      method: "POST",
      body: JSON.stringify({ a: "Lava", b: "Water", discovered: ["Earth", "Water", "Fire", "Air"] })
    }),
    (error) => error.code === "word_unavailable" && error.status === 409
  );
});

test("local restore keeps the strongest claimed assistance penalty", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-assist-restore-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await preparePagesAdapter(directory);
  const moduleUrl = pathToFileURL(join(directory, "local-beta.mjs")).href;
  const firstRuntime = await import(`${moduleUrl}?test=assist-start-${Date.now()}`);
  const started = await firstRuntime.localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ mode: "reach", seed: 23, target: "Telescope" })
  });
  const gift = await firstRuntime.localRequest("/api/run/gift", {
    method: "POST",
    body: JSON.stringify({ runId: started.run.id, runToken: started.run.token })
  });
  const compassAfterGift = await firstRuntime.localRequest("/api/run/sense", {
    method: "POST",
    body: JSON.stringify({ runId: started.run.id, runToken: started.run.token })
  });
  assert.equal(compassAfterGift.assist, "gift");
  assert.equal(compassAfterGift.scoreMultiplier, .5);
  const wishAfterGift = await firstRuntime.localRequest("/api/wish", {
    method: "POST",
    body: JSON.stringify({ word: "Moon", runId: started.run.id, runToken: started.run.token })
  });
  assert.equal(wishAfterGift.assist, "gift");
  assert.equal(wishAfterGift.scoreMultiplier, .5);
  const snapshot = {
    version: 1,
    game: started.game,
    run: { ...started.run, assist: "sense", scoreMultiplier: .75 },
    progress: {
      moves: 0,
      completed: false,
      submitted: false,
      discovered: started.game.starters.map((word) => ({ word, source: "origin" })).concat(gift.item),
      history: [],
      giftUsed: true,
      giftItem: gift.item,
      assist: "sense",
      scoringDisabled: false
    }
  };
  const restoredRuntime = await import(`${moduleUrl}?test=assist-restore-${Date.now()}`);
  const restored = await restoredRuntime.localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify({ runId: started.run.id, runToken: started.run.token, snapshot })
  });
  assert.equal(restored.run.assist, "gift", "Gift's 50% penalty must beat an earlier Compass penalty");
  assert.equal(restored.run.scoreMultiplier, .5);
  assert.equal(restored.run.scoreEligible, true);
});

test("the Pages adapter safely reconstructs an unranked run after a module reload", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-resume-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await preparePagesAdapter(directory);
  const moduleUrl = pathToFileURL(join(directory, "local-beta.mjs")).href;
  const firstRuntime = await import(`${moduleUrl}?test=start-${Date.now()}`);
  const started = await firstRuntime.localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ mode: "reach", seed: 7, target: "Telescope" })
  });
  assert.equal(started.run.ranked, false);
  assert.equal(started.run.scoreEligible, true, "a clean local orbit remains score-eligible for local results");
  assert.equal(started.run.rewardEligible, true);
  const cleanResume = await firstRuntime.localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify({ runId: started.run.id, runToken: started.run.token })
  });
  assert.equal(cleanResume.run.scoreEligible, true, "resuming must not silently forfeit a clean local orbit");
  assert.equal(cleanResume.run.rewardEligible, true);
  assert.deepEqual(Object.keys(cleanResume.run).sort(), Object.keys(started.run).sort(), "start and resume expose one public run shape");
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
  assert.deepEqual(resumed.game.universe, started.game.universe, "resume must reconstruct universe metadata from the trusted game seed");
  assert.notEqual(resumed.game.moveLimit, 1, "client game rules must be rebuilt from the local catalog");
  assert.equal(resumed.run.ranked, false);
  assert.equal(resumed.run.localOnly, true);
  assert.equal(resumed.run.scoreEligible, true, "a Wish remains progression-eligible in the Open division after reconstruction");
  assert.equal(resumed.run.rewardEligible, true);
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
