import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameStore, RunRegistry } from "../game-services.mjs";
import { recipeFingerprint } from "../public/recipe-feedback.mjs";

test("active runs and their existing HMAC credentials survive a store restart", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-runs-"));
  const path = join(directory, "constellore.json");
  context.after(() => rm(directory, { recursive: true, force: true }));

  const firstStore = await new GameStore(path).init();
  const player = await firstStore.registerPlayer();
  const playerToken = firstStore.tokenForPlayer(player.id);
  const firstRegistry = new RunRegistry(firstStore);
  const game = { mode: "reach", target: "Forest", tier: 2, starters: ["Earth", "Water", "Fire", "Air"] };
  const started = firstRegistry.start(player.id, game, { ranked: false });
  const run = started.run;
  run.solutionRoute = [
    { a: "Earth", b: "Water", word: "Mud" },
    { a: "Mud", b: "Fire", word: "Brick" }
  ];
  run.solutionRecipes = new Map([["fire+mud", { a: "Mud", b: "Fire", word: "Brick", source: "world" }]]);
  firstRegistry.addBend(run, { word: "Moon", emoji: "moon", category: "nature", source: "market" }, "market");
  firstRegistry.recordCombination(run, { word: "Mud", emoji: "mud", category: "nature", source: "world" }, { a: "Earth", b: "Water" });
  const ratedStep = run.history[0];
  run.recipeFeedbackMoves.add(1);
  run.recipeFeedbackRecipes.add(recipeFingerprint(ratedStep));
  await firstStore.recordRecipeRating(ratedStep, "logical");
  await firstRegistry.persist(run);

  const serialized = await readFile(path, "utf8");
  assert.equal(serialized.includes(playerToken), false, "player bearer tokens must remain derived rather than stored");
  assert.equal(serialized.includes(started.token), false, "run bearer tokens must remain derived rather than stored");

  const secondStore = await new GameStore(path).init();
  assert.equal(secondStore.authenticate(player.id, playerToken)?.id, player.id, "the persisted signing secret must preserve player authentication");
  const secondRegistry = new RunRegistry(secondStore);
  const resumed = secondRegistry.get(run.runId, player.id, started.token);
  const progress = secondRegistry.progress(resumed);
  assert.equal(progress.moves, 1);
  assert.equal(progress.usedBend, true);
  assert.equal(progress.bendItem.word, "Moon");
  assert.deepEqual(progress.history.map(({ a, b, word }) => ({ a, b, word })), [{ a: "Earth", b: "Water", word: "Mud" }]);
  assert.ok(resumed.solutionRecipes instanceof Map);
  assert.equal(resumed.solutionRecipes.get("fire+mud").word, "Brick");
  assert.equal(resumed.recipeFeedbackMoves.has(1), true);
  assert.equal(resumed.recipeFeedbackRecipes.has(recipeFingerprint(ratedStep)), true);
  assert.equal(secondStore.recipeRatingSummary({ minimumVotes: 1 }).totalVotes, 1);

  secondRegistry.canCombine(resumed, "Mud", "Fire");
  secondRegistry.recordCombination(resumed, { word: "Brick", source: "world" }, { a: "Mud", b: "Fire" });
  await secondRegistry.flush();

  const thirdStore = await new GameStore(path).init();
  const thirdRegistry = new RunRegistry(thirdStore);
  const resumedAgain = thirdRegistry.get(run.runId, player.id, started.token);
  assert.equal(thirdRegistry.progress(resumedAgain).history.at(-1).word, "Brick");
});

test("expired durable runs are pruned from memory and disk", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-run-cleanup-"));
  const path = join(directory, "constellore.json");
  context.after(() => rm(directory, { recursive: true, force: true }));

  const store = await new GameStore(path).init();
  const player = await store.registerPlayer();
  const registry = new RunRegistry(store);
  const started = registry.start(player.id, { mode: "reach", target: "Mud", tier: 1, starters: ["Earth", "Water", "Fire", "Air"] });
  started.run.startedAt = Date.now() - 3_600_000;
  started.run.expiresAt = Date.now() - 120_000;
  await registry.persist(started.run);

  const reloadedStore = await new GameStore(path).init();
  const reloadedRegistry = new RunRegistry(reloadedStore);
  await reloadedRegistry.flush();
  assert.equal(reloadedRegistry.runs.has(started.run.runId), false);

  const finalStore = await new GameStore(path).init();
  assert.equal(started.run.runId in finalStore.data.runs, false);
});

test("a transient disk failure does not poison later persistence", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-write-recovery-"));
  context.after(async () => {
    await rm(directory, { recursive: true, force: true });
    await rm(`${directory}.${process.pid}.tmp`, { force: true });
  });
  const store = await new GameStore(":memory:").init();

  store.path = directory;
  await assert.rejects(store.persist(), "renaming a file over an existing directory must fail");

  const recoveredPath = join(directory, "constellore.json");
  store.path = recoveredPath;
  store.data.demand.recovered = 1;
  await store.persist();
  const recovered = JSON.parse(await readFile(recoveredPath, "utf8"));
  assert.equal(recovered.demand.recovered, 1, "the next queued write runs after the rejected write");
});

test("pre-upgrade completed ranked runs migrate out of the legacy expiry window", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const firstRegistry = new RunRegistry(store);
  const started = firstRegistry.start(player.id, { mode: "quick", target: "Mud", tier: 1, starters: ["Earth", "Water", "Fire", "Air"] }, { ranked: true, challengeId: "quick:legacy" });
  const legacyStartedAt = Date.now() - 2 * 60 * 60_000;
  const legacyCompletedAt = legacyStartedAt + 10 * 60_000;
  const snapshot = store.data.runs[started.run.runId];
  snapshot.startedAt = legacyStartedAt;
  snapshot.expiresAt = legacyStartedAt + 30 * 60_000;
  snapshot.completedAt = legacyCompletedAt;
  snapshot.ranked = true;

  const migratedRegistry = new RunRegistry(store);
  const migratedToken = store.sign(`run:${started.run.runId}:${player.id}:${legacyStartedAt}`);
  const migrated = migratedRegistry.get(started.run.runId, player.id, migratedToken);
  assert.ok(migrated.expiresAt >= legacyCompletedAt + 7 * 86400000);
});

test("product analytics persist useful aggregates without raw sessions or free-form words", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-analytics-"));
  const path = join(directory, "constellore.json");
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = await new GameStore(path).init();
  const at = new Date("2026-07-18T12:00:00.000Z");
  const firstSession = "session-sensitive-one";
  const secondSession = "session-sensitive-two";

  await store.recordAnalyticsEvent({
    name: "sense_used",
    sessionId: firstSession,
    properties: { mode: "quick", source: "daily", chargesBefore: 2, chargesAfter: 1, target: "Secret Target", word: "Moon", playerId: "private-player" }
  }, at);
  await store.recordAnalyticsEvent({ name: "sense_purchased", sessionId: firstSession, properties: { cost: 90 } }, at);
  await store.recordAnalyticsEvent({
    name: "ghost_race_completed",
    sessionId: firstSession,
    properties: { mode: "quick", result: "won", deltaMs: -1840, opponent: "Private Rival" }
  }, at);
  await store.recordAnalyticsEvent({
    name: "mastery_progressed",
    sessionId: secondSession,
    properties: { collection: "first-light", progress: 7, stars: 2 }
  }, at);
  await store.recordAnalyticsEvent({ name: "audio_toggled", sessionId: secondSession, properties: { enabled: false, kind: "music" } }, at);
  await store.recordAnalyticsEvent({ name: "run_restored", sessionId: firstSession, properties: { mode: "quick", moves: 3 } }, at);
  await store.recordAnalyticsEvent({ name: "board_tidied", sessionId: firstSession, properties: { mode: "quick", words: 9 } }, at);
  for (const theme of ["void", "aurora", "solar"]) {
    await store.recordAnalyticsEvent({ name: "theme_changed", sessionId: secondSession, properties: { theme } }, at);
  }

  const summary = store.analyticsSummary(30, at);
  assert.equal(summary.privacy, "aggregate-only");
  assert.equal(summary.dailyUniqueSessions, 2);
  assert.equal(summary.events.sense_used, 1);
  assert.equal(summary.events.run_restored, 1);
  assert.equal(summary.events.board_tidied, 1);
  assert.equal(summary.segments.sense_used.mode.quick, 1);
  assert.equal(summary.segments.sense_used.source.daily, 1);
  assert.equal(summary.segments.ghost_race_completed.result.won, 1);
  assert.deepEqual(summary.metrics.sense_used.chargesBefore, { count: 1, sum: 2, min: 2, max: 2, average: 2 });
  assert.deepEqual(summary.metrics.sense_used.chargesAfter, { count: 1, sum: 1, min: 1, max: 1, average: 1 });
  assert.equal(summary.metrics.ghost_race_completed.deltaMs.average, -1840);
  assert.equal(summary.segments.theme_changed.theme.void, 1);
  assert.equal(summary.segments.theme_changed.theme.aurora, 1);
  assert.equal(summary.segments.theme_changed.theme.solar, 1);
  assert.equal(summary.funnels.ghost.completed, 1);
  assert.equal(summary.economy.wordPurchases, 0);
  assert.equal(summary.economy.senseStardustSpent, 90);
  assert.equal("senseCreditsSpent" in summary.economy, false);

  const persisted = await readFile(path, "utf8");
  for (const privateValue of [firstSession, secondSession, "Secret Target", "Moon", "private-player", "Private Rival"]) {
    assert.equal(persisted.includes(privateValue), false, `${privateValue} must not be persisted in analytics`);
    assert.equal(JSON.stringify(summary).includes(privateValue), false, `${privateValue} must not appear in summaries`);
  }

  const reloaded = await new GameStore(path).init();
  assert.equal(reloaded.analyticsSummary(30, at).events.mastery_progressed, 1);
});

test("analytics rejects unknown events and prunes identifying daily hashes after 90 days", async () => {
  const store = await new GameStore(":memory:").init();
  await assert.rejects(
    store.recordAnalyticsEvent({ name: "arbitrary_event", sessionId: "session-one" }),
    (error) => error.serviceCode === "invalid_analytics_event"
  );
  await assert.rejects(
    store.recordAnalyticsEvent({ name: "app_opened", sessionId: "" }),
    (error) => error.serviceCode === "invalid_analytics_session"
  );

  await store.recordAnalyticsEvent({ name: "app_opened", sessionId: "old-session" }, new Date("2026-04-01T12:00:00.000Z"));
  await store.recordAnalyticsEvent({ name: "app_opened", sessionId: "new-session" }, new Date("2026-07-18T12:00:00.000Z"));
  assert.equal("2026-04-01" in store.data.analytics.days, false);
  assert.equal(store.analyticsSummary(90, new Date("2026-07-18T12:00:00.000Z")).events.app_opened, 1);
  assert.equal(store.analyticsSummary(90, new Date("2026-07-18T12:00:00.000Z")).allTimeEvents.app_opened, 2);
});
