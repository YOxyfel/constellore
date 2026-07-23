import test from "node:test";
import assert from "node:assert/strict";
import {
  GameStore,
  JsonGameStorage,
  MARKET_REPRICE_INTERVAL_MS,
  RunRegistry,
  buildChallengeIdentity,
  calculateStarscore
} from "../game-services.mjs";

const game = (overrides = {}) => ({
  mode: "quick",
  target: "Mud",
  tier: 1,
  seed: 42,
  timeLimit: 90,
  moveLimit: null,
  graphVersion: "graph-a",
  buildVersion: "build-a",
  rulesVersion: "ranked-v3",
  starters: ["Earth", "Water", "Fire", "Air"],
  ...overrides
});

test("purpose-signed device sessions expire and can be revoked without storing bearer values", async () => {
  let now = new Date("2026-07-22T00:00:00Z");
  const store = await new GameStore(":memory:", { clock: () => now }).init();
  const player = await store.registerPlayer();
  const legacy = store.tokenForPlayer(player.id);
  assert.ok(store.authenticate(player.id, legacy), "pre-upgrade bearer remains valid until session migration");

  const issued = await store.issuePlayerSession(player.id, { deviceLabel: "test phone", ttlMs: 60_000 });
  assert.match(issued.playerToken, /^cs3\./);
  assert.equal(JSON.stringify(store.data).includes(issued.playerToken), false);
  assert.equal(store.authenticate(player.id, legacy), null, "issuing v3 sessions disables the non-expiring legacy bearer");
  assert.equal(store.authenticate(player.id, issued.playerToken)?.id, player.id);

  await store.revokePlayerSession(player.id, issued.playerToken);
  assert.equal(store.authenticate(player.id, issued.playerToken), null);

  const replacement = await store.issuePlayerSession(player.id, { ttlMs: 60_000 });
  now = new Date("2026-07-22T00:01:01Z");
  assert.equal(store.authenticate(player.id, replacement.playerToken), null, "expiry is checked against the server clock");
});

test("exact challenge identities include target, rules, modifier, versions, seed, and assistance class", () => {
  const base = buildChallengeIdentity(game(), { assist: "none" });
  assert.equal(base.descriptor.target, "mud");
  assert.equal(base.descriptor.assistanceClass, "pure");
  for (const different of [
    buildChallengeIdentity(game({ target: "Steam" }), { assist: "none" }),
    buildChallengeIdentity(game({ seed: 43 }), { assist: "none" }),
    buildChallengeIdentity(game({ moveLimit: 8 }), { assist: "none" }),
    buildChallengeIdentity(game({ graphVersion: "graph-b" }), { assist: "none" }),
    buildChallengeIdentity(game(), { assist: "sense" })
  ]) assert.notEqual(different.key, base.key);
});

test("one active ranked attempt is enforced and rejected attempts affect errorless score integrity", async () => {
  let clockMs = Date.parse("2026-07-22T00:00:00Z");
  const store = await new GameStore(":memory:", { clock: () => new Date(clockMs) }).init();
  const player = await store.registerPlayer();
  const runs = new RunRegistry(store);
  const started = runs.start(player.id, game(), { ranked: true, challengeId: "quick:2026-07-22" });
  assert.throws(
    () => runs.start(player.id, game(), { ranked: true, challengeId: "quick:2026-07-22" }),
    (error) => error.serviceCode === "ranked_attempt_active"
  );

  clockMs += 5_000;
  runs.recordRejectedAttempt(started.run, { a: "Earth", b: "Fire" });
  clockMs += 5_000;
  runs.recordCombination(started.run, { word: "Mud", source: "world" }, { a: "Earth", b: "Water" });
  const entry = runs.finalize(started.run, player.callsign);
  assert.equal(entry.attempts, 2);
  assert.equal(entry.rejectedAttempts, 1);
  assert.equal(entry.errorless, false);
  assert.equal(entry.status, "verified");
  assert.ok(entry.score < calculateStarscore({ game: started.run.game, moves: 1, elapsedSeconds: 10 }));

  const placement = await store.addScore(entry);
  assert.equal(placement.rank, 1);
  assert.equal(placement.entry.ghost.synthetic, false);
  assert.equal(placement.entry.ghost.label, "Verified player route");
  assert.equal(store.competitiveProgression(player.id).verifiedWins, 1);
});

test("anomalous scores remain provisional and never enter verified ladders", async () => {
  const store = await new GameStore().init();
  const player = await store.registerPlayer();
  const identity = buildChallengeIdentity(game(), { assist: "none" });
  const placement = await store.addScore({
    id: "score-provisional",
    runId: "00000000-0000-4000-8000-000000000001",
    playerId: player.id,
    callsign: player.callsign,
    challengeId: "quick:2026-07-22",
    challengeKey: identity.key,
    challenge: identity.descriptor,
    division: "pure",
    assist: "none",
    mode: "quick",
    target: "Mud",
    score: 100_000,
    moves: 4,
    attempts: 4,
    rejectedAttempts: 0,
    elapsedMs: 100,
    status: "provisional",
    anomalyFlags: ["implausible_total_cadence"],
    createdAt: new Date().toISOString()
  });
  assert.equal(placement.provisional, true);
  assert.equal(store.leaderboard("all", "pure", 10, player.id, { challengeKey: identity.key }).entries.length, 0);
  assert.equal(store.competitiveProgression(player.id).verifiedWins, 0);
});

test("AI proposals are quarantined with provenance and support explicit promotion and rollback", async () => {
  const store = await new GameStore().init();
  await store.rememberDynamicRecipes([{ a: "Moon", b: "Water", word: "Tide", emoji: "wave", note: "The moon pulls water.", source: "ai" }], new Date("2026-07-22T00:00:00Z"), {
    promptVersion: "combine-v3-test",
    model: "test-model",
    provenance: "test-proposal"
  });
  assert.equal(store.dynamicRecipeCatalog().length, 0);
  const proposal = store.dynamicRecipeReviewQueue()[0];
  assert.equal(proposal.status, "quarantined");
  assert.equal(proposal.promptVersion, "combine-v3-test");
  assert.equal(proposal.model, "test-model");

  const promoted = await store.reviewDynamicRecipe(proposal.proposalId, "promote", { reviewer: "qa", reason: "logical" });
  assert.equal(promoted.status, "promoted");
  assert.equal(store.dynamicRecipeCatalog().length, 1);
  const rolledBack = await store.reviewDynamicRecipe(proposal.proposalId, "rollback", { reviewer: "qa", reason: "regression" });
  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(store.dynamicRecipeCatalog().length, 0);
  assert.deepEqual(store.data.dynamicRecipeRevisions.map((entry) => entry.to), ["promoted", "rolled_back"]);
});

test("privacy-safe cohorts produce D1/D7 retention and rejected-pair reports remain bounded and deduplicated", async () => {
  const store = await new GameStore().init();
  const cohortId = "cohort_device_123456789";
  const dates = [0, 1, 7].map((offset) => new Date(Date.parse("2026-07-10T12:00:00Z") + offset * 86400000));
  for (const [index, date] of dates.entries()) await store.recordAnalyticsEvent({
    name: index ? "app_opened" : "mode_screen_viewed",
    sessionId: `session-${index}`,
    cohortId,
    properties: {}
  }, date);
  await store.recordAnalyticsEvent({
    name: "combination_expected",
    sessionId: "expect-session",
    cohortId,
    properties: { a: "Earth", b: "Water", mode: "reach" }
  }, dates[2], { allowRejectedPairPlaintext: true });
  await store.recordAnalyticsEvent({
    name: "combination_expected",
    sessionId: "expect-session-2",
    cohortId,
    properties: { a: "Earth", b: "Water", mode: "reach" }
  }, dates[2], { allowRejectedPairPlaintext: true });

  const summary = store.analyticsSummary(30, dates[2]);
  assert.deepEqual(summary.retention.d1, { eligible: 1, returned: 1, percent: 100 });
  assert.deepEqual(summary.retention.d7, { eligible: 1, returned: 1, percent: 100 });
  assert.equal(summary.funnels.guidance.opened, 0);
  const rejected = store.rejectedPairSummary();
  assert.equal(rejected.reports.length, 1);
  assert.equal(rejected.reports[0].count, 1, "one cohort cannot inflate the same expectation");
  assert.deepEqual(rejected.reports[0].pair, ["earth", "water"]);
  assert.equal(JSON.stringify(store.data).includes(cohortId), false);
});

test("the JSON adapter satisfies the storage contract and Exchange quotes hold for six hours", async () => {
  const storage = new JsonGameStorage(":memory:");
  const store = await new GameStore(":memory:", { storage }).init();
  const player = await store.registerPlayer();
  assert.deepEqual(store.storageHealth(), { kind: "memory", ready: true, contractVersion: 1, lastError: null, schemaVersion: 10, pendingWrites: false });
  const now = Math.floor(1_800_000_000_000 / MARKET_REPRICE_INTERVAL_MS) * MARKET_REPRICE_INTERVAL_MS;
  const first = store.marketSnapshot(player.id, now);
  const samePeriod = store.marketSnapshot(player.id, now + MARKET_REPRICE_INTERVAL_MS - 1);
  assert.equal(first.items[0].quoteId, samePeriod.items[0].quoteId);
  assert.equal(first.cadence, "six_hours");
  assert.notEqual(first.items[0].quoteId, store.marketSnapshot(player.id, now + MARKET_REPRICE_INTERVAL_MS).items[0].quoteId);
});
