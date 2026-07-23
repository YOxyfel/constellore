import test from "node:test";
import assert from "node:assert/strict";
import { ANALYTICS_EVENT_NAMES, GameStore, RunRegistry } from "../game-services.mjs";
import { currentCosmicEvent } from "../public/cosmic-events.mjs";
import { sanitizeVoyageProgress } from "../public/constellation-voyages.mjs";

function completeMudRun(store, player, challengeId, { detour = false } = {}) {
  const registry = new RunRegistry(store);
  const started = registry.start(player.id, {
    mode: "quick",
    target: "Mud",
    tier: 1,
    starters: ["Earth", "Water", "Fire", "Air"]
  }, { ranked: true, challengeId });
  if (detour) {
    registry.recordCombination(started.run, {
      word: "Dust",
      category: "nature",
      source: "world"
    }, { a: "Earth", b: "Air" });
  }
  registry.recordCombination(started.run, {
    word: "Mud",
    category: "nature",
    source: "world"
  }, { a: "Earth", b: "Water" });
  return { registry, entry: registry.finalize(started.run, player.callsign), run: started.run, token: started.token };
}

test("ranked runs receive server-derived anonymous signatures and community comparisons", async () => {
  const store = await new GameStore().init();
  const first = await store.registerPlayer();
  const second = await store.registerPlayer();
  const challengeId = "quick:signature-community";
  const fast = completeMudRun(store, first, challengeId);
  const scenic = completeMudRun(store, second, challengeId, { detour: true });

  assert.equal(fast.entry.signature.kind, "constellore-route-signature");
  assert.equal(fast.entry.signature.privacy, "anonymous");
  assert.equal(fast.entry.signature.scoreEligible, true);
  const privateRouteText = JSON.stringify(fast.entry.signature);
  for (const privateValue of [first.id, fast.run.runId, "Earth", "Water", "Mud"]) assert.equal(privateRouteText.includes(privateValue), false);

  await store.addScore(fast.entry);
  await store.addScore(scenic.entry);
  // Unknown stored metadata must never pass through the public signature view.
  store.data.scores.find((entry) => entry.playerId === first.id).signature.privateWord = "unreleased-route-word";

  const board = store.leaderboard("sprint", "pure", 10, first.id, { challengeId });
  assert.equal(board.entries.length, 2);
  assert.equal(board.entries[0].signature.privateWord, undefined);
  assert.equal(board.community.eligibleRoutes, 2);
  assert.equal(board.community.sampledRoutes, 2);
  assert.equal(board.community.completedRoutes, 2);
  assert.equal(board.community.player.rank, 1);
  assert.equal(board.community.distinctSignatures, 2);
  const publicCommunity = JSON.stringify(board.community);
  for (const privateValue of [first.id, second.id, fast.run.runId, scenic.run.runId, "unreleased-route-word"]) {
    assert.equal(publicCommunity.includes(privateValue), false);
  }

  const placement = store.rankFor(challengeId, "pure", second.id);
  assert.equal(placement.rank, 2);
  assert.equal(placement.community.player.rank, 2);
  assert.equal("playerId" in placement.entry, false);
  assert.equal(store.playerDataExport(first.id).scores[0].signature.kind, "constellore-route-signature");
});

test("Signature Route novelty is lifetime-scoped while each finalized signature remains independently recoverable", async () => {
  const at = new Date("2026-07-22T12:00:00.000Z");
  const store = await new GameStore(":memory:", { clock: () => at }).init();
  const player = await store.registerPlayer();
  const first = completeMudRun(store, player, "quick:lifetime-novelty:first");
  const repeated = completeMudRun(store, player, "quick:lifetime-novelty:second");

  assert.equal(first.entry.signature.discoveries, 1);
  assert.equal(repeated.entry.signature.discoveries, 0);
  assert.ok(repeated.entry.signature.dimensions.novelty < first.entry.signature.dimensions.novelty);
  assert.deepEqual(first.run.verifiedSignature, first.entry.signature);
  assert.deepEqual(repeated.run.verifiedSignature, repeated.entry.signature);

  await store.addScore(first.entry);
  const slowerSameChallenge = completeMudRun(store, player, "quick:lifetime-novelty:first", { detour: true });
  const placement = await store.addScore(slowerSameChallenge.entry);
  assert.equal(placement.entry.signature.signatureId, first.entry.signature.signatureId, "leaderboard placement keeps the better score");
  assert.notEqual(slowerSameChallenge.run.verifiedSignature.signatureId, placement.entry.signature.signatureId, "the finalized run keeps its own verified signature");
  const restored = new RunRegistry(store).get(slowerSameChallenge.run.runId, player.id, slowerSameChallenge.token);
  assert.deepEqual(restored.verifiedSignature, slowerSameChallenge.entry.signature, "verified run truth survives registry recovery");
});

test("current Cosmic Event progress is server-week scoped, Pure-only, and claimed once", async () => {
  const at = new Date("2026-07-22T12:00:00.000Z");
  const store = await new GameStore(":memory:", { clock: () => at }).init();
  const player = await store.registerPlayer();
  const event = currentCosmicEvent(at);

  const spoofed = await store.updateCloudProfile(player.id, 0, {
    journeys: {
      eventProgress: {
        weekKey: event.weekKey,
        eventId: event.id,
        words: event.collection.words,
        rewarded: true
      }
    }
  });
  assert.deepEqual(spoofed.profile.journeys.eventProgress.words, [], "client-declared collection words cannot mint progress");
  assert.equal(spoofed.profile.journeys.eventProgress.rewarded, false, "client-declared rewarded is read-only");

  const registry = new RunRegistry(store);
  const started = registry.start(player.id, {
    mode: "reach",
    target: event.collection.words.at(-1),
    tier: 2,
    starters: ["Earth", "Water", "Fire", "Air"]
  });
  for (const word of event.collection.words) {
    const step = registry.recordCombination(started.run, { word, category: "structure", source: "world" }, { a: "Earth", b: "Water" });
    assert.equal(step.progressionEligible, true);
    assert.equal(step.eventEligible, true);
  }
  await registry.persist(started.run);

  const beforeClaim = store.cosmicEventState(player.id, at);
  assert.deepEqual(beforeClaim.progress.words, event.collection.words);
  assert.equal(beforeClaim.reward.claimable, true);
  const firstClaim = await store.claimCosmicEventReward(player.id, { weekKey: event.weekKey, eventId: event.id }, at);
  assert.equal(firstClaim.reward.granted, true);
  assert.equal(firstClaim.progress.rewarded, true);
  assert.equal(store.cloudProfile(player.id).profile.progression.stardust, 60, "the server durably credits currency before acknowledging the claim");
  assert.equal(store.cloudProfile(player.id).version, 2);
  const retryClaim = await store.claimCosmicEventReward(player.id, { weekKey: event.weekKey, eventId: event.id }, at);
  assert.equal(retryClaim.reward.granted, false);
  assert.equal(retryClaim.reward.alreadyClaimed, true);
  assert.equal(store.cloudProfile(player.id).profile.progression.stardust, 60, "a retried or lost response cannot credit twice");
  assert.equal(store.cloudProfile(player.id).version, 2);
  assert.equal(Object.keys(store.data.players[player.id].cosmicEventRewards).length, 1);

  const canonical = await store.updateCloudProfile(player.id, 2, {
    journeys: { eventProgress: { weekKey: event.weekKey, eventId: event.id, words: [], rewarded: false } }
  });
  assert.deepEqual(canonical.profile.journeys.eventProgress.words, event.collection.words);
  assert.equal(canonical.profile.journeys.eventProgress.rewarded, true);

  const assistedPlayer = await store.registerPlayer();
  const assistedRegistry = new RunRegistry(store);
  const assisted = assistedRegistry.start(assistedPlayer.id, {
    mode: "reach",
    target: "Unrelated Target",
    tier: 2,
    starters: ["Earth", "Water", "Fire", "Air"]
  });
  assistedRegistry.addBend(assisted.run, { word: "Moon", source: "market" }, "market");
  const excluded = assistedRegistry.recordCombination(assisted.run, { word: event.collection.words[0], source: "world" }, { a: "Earth", b: "Water" });
  assert.equal(excluded.eventEligible, false);
  assert.equal(store.cosmicEventState(assistedPlayer.id, at).progress.words.includes(event.collection.words[0]), false);

  const prior = currentCosmicEvent(new Date(at.getTime() - 7 * 86_400_000));
  await assert.rejects(
    store.updateCloudProfile(player.id, 3, {
      journeys: { eventProgress: { weekKey: prior.weekKey, eventId: prior.id, words: [], rewarded: false } }
    }),
    (error) => error.serviceCode === "cosmic_event_stale"
  );
});

test("cloud sync strictly canonicalizes journeys, event collections, and Signature Route bests", async () => {
  const at = new Date("2026-07-22T12:00:00.000Z");
  const store = await new GameStore(":memory:", { clock: () => at }).init();
  const player = await store.registerPlayer();
  const { entry } = completeMudRun(store, player, "quick:cloud-signature");
  const event = currentCosmicEvent(at);
  for (const word of event.collection.words) store.recordCosmicEventDiscovery(player.id, word, at);
  const claim = await store.claimCosmicEventReward(player.id, { weekKey: event.weekKey, eventId: event.id }, at);
  assert.equal(claim.reward.granted, true);
  const voyageProgress = sanitizeVoyageProgress({ voyages: { "first-cities": { completed: 2 } } });
  const profile = {
    journeys: {
      selectedVoyageId: "first-cities",
      voyageProgress,
      eventProgress: {
        weekKey: event.weekKey,
        eventId: event.id,
        words: [...event.collection.words, event.collection.words[0].toLowerCase()],
        rewarded: true
      }
    },
    signatureBests: [entry.signature, entry.signature],
    progression: {
      stardust: 60,
      wins: 1,
      dailyStreak: 0,
      lastDailyDate: "",
      dailyCompleted: "",
      streakShields: 0,
      rewardedRunIds: [entry.runId, entry.runId.toUpperCase()]
    }
  };

  const saved = await store.updateCloudProfile(player.id, 1, profile);
  assert.equal(saved.profile.journeys.selectedVoyageId, "first-cities");
  assert.equal(saved.profile.journeys.voyageProgress.voyages["first-cities"].completed, 2);
  assert.deepEqual(saved.profile.journeys.eventProgress.words, event.collection.words);
  assert.equal(saved.profile.journeys.eventProgress.rewarded, true);
  assert.equal(saved.profile.signatureBests.length, 1, "only one best is retained for each anonymous scope");
  assert.deepEqual(saved.profile.signatureBests[0], entry.signature);
  assert.deepEqual(saved.profile.progression.rewardedRunIds, [entry.runId]);

  await assert.rejects(
    store.updateCloudProfile(player.id, 2, { journeys: { selectedVoyageId: "unreleased-voyage" } }),
    (error) => error.serviceCode === "invalid_cloud_profile"
  );
  await assert.rejects(
    store.updateCloudProfile(player.id, 2, {
      journeys: { eventProgress: { weekKey: event.weekKey, eventId: event.id, words: ["Private Word"], rewarded: false } }
    }),
    (error) => error.serviceCode === "invalid_cloud_profile"
  );
  await assert.rejects(
    store.updateCloudProfile(player.id, 2, { signatureBests: [{ ...entry.signature, privateWord: "Mud" }] }),
    (error) => error.serviceCode === "invalid_cloud_profile"
  );
});

test("a Pure run that crosses the weekly rollover can still claim its run-bound Cosmic Event once", async () => {
  let now = new Date("2026-07-26T23:59:30.000Z");
  const store = await new GameStore(":memory:", { clock: () => now }).init();
  const player = await store.registerPlayer();
  const event = currentCosmicEvent(now);
  const registry = new RunRegistry(store);
  const started = registry.start(player.id, {
    mode: "reach",
    target: event.collection.words.at(-1),
    tier: 3,
    starters: ["Earth", "Water", "Fire", "Air"]
  });

  for (const word of event.collection.words) {
    const step = registry.recordCombination(started.run, { word, category: "nature", source: "world" }, { a: "Earth", b: "Water" });
    assert.equal(step.eventEligible, true);
  }
  await registry.persist(started.run);

  now = new Date("2026-07-27T00:00:30.000Z");
  assert.notEqual(currentCosmicEvent(now).weekKey, event.weekKey);
  const claim = await store.claimCosmicEventReward(player.id, { weekKey: event.weekKey, eventId: event.id }, now);
  assert.equal(claim.event.weekKey, event.weekKey);
  assert.equal(claim.reward.granted, true);
  assert.equal(claim.serverTime, now.toISOString());
  assert.equal(currentCosmicEvent(new Date(claim.eventServerTime)).weekKey, event.weekKey);
  assert.equal(store.cloudProfile(player.id).profile.progression.stardust, 60);

  const repeated = await store.claimCosmicEventReward(player.id, { weekKey: event.weekKey, eventId: event.id }, now);
  assert.equal(repeated.reward.granted, false);
  assert.equal(repeated.reward.alreadyClaimed, true);
  assert.equal(store.cloudProfile(player.id).profile.progression.stardust, 60);
});

test("journey, event, signature, and community analytics remain aggregate-only", async () => {
  const store = await new GameStore().init();
  const at = new Date("2026-07-22T12:00:00.000Z");
  const sessionId = "private-six-system-session";
  for (const name of ["journey_opened", "voyage_started", "voyage_completed", "event_started", "event_discovery", "signature_graded", "community_viewed"]) {
    assert.ok(ANALYTICS_EVENT_NAMES.includes(name));
  }
  await store.recordAnalyticsEvent({
    name: "journey_opened",
    sessionId,
    properties: { kind: "voyage", location: "home", voyage: "first-cities", target: "Private Target" }
  }, at);
  await store.recordAnalyticsEvent({ name: "voyage_started", sessionId, properties: { voyage: "first-cities", chapter: "soft-ground", stage: 1 } }, at);
  await store.recordAnalyticsEvent({ name: "voyage_completed", sessionId, properties: { collection: "first-cities", stage: "soft-ground", complete: true } }, at);
  await store.recordAnalyticsEvent({
    name: "event_discovery",
    sessionId,
    properties: { kind: "event", event: "ocean-depths", collection: "voices-of-the-tide", progress: 3, completed: false, word: "Private Word" }
  }, at);
  await store.recordAnalyticsEvent({
    name: "signature_graded",
    sessionId,
    properties: { kind: "signature", tier: "nova", improved: true, eligible: true, signatureScore: 87, score: 108000, route: "Private Route" }
  }, at);
  await store.recordAnalyticsEvent({
    name: "community_viewed",
    sessionId,
    properties: { kind: "community", completedRoutes: 42, topPercent: 12, playerId: "Private Player" }
  }, at);

  const summary = store.analyticsSummary(7, at);
  assert.equal(summary.segments.journey_opened.kind.voyage, 1);
  assert.equal(summary.segments.journey_opened.voyage["first-cities"], 1);
  assert.equal(summary.segments.voyage_completed.stage["soft-ground"], 1);
  assert.equal(summary.segments.voyage_completed.complete["true"], 1);
  assert.equal(summary.segments.event_discovery.event["ocean-depths"], 1);
  assert.equal(summary.metrics.event_discovery.progress.sum, 3);
  assert.equal(summary.metrics.signature_graded.signatureScore.sum, 87);
  assert.equal(summary.segments.signature_graded.tier.nova, 1);
  assert.equal(summary.segments.signature_graded.improved["true"], 1);
  assert.equal(summary.segments.signature_graded.eligible["true"], 1);
  assert.equal(summary.metrics.community_viewed.completedRoutes.sum, 42);
  assert.equal(summary.funnels.constellation.journeyViews, 1);
  assert.equal(summary.funnels.constellation.voyagesStarted, 1);
  assert.equal(summary.funnels.constellation.voyagesCompleted, 1);
  assert.equal(summary.funnels.constellation.voyageCompletionPercent, 100);
  assert.equal(summary.funnels.constellation.eventDiscoveries, 1);
  assert.equal(summary.funnels.constellation.signaturesGraded, 1);
  assert.equal(summary.funnels.constellation.communityViews, 1);
  const publicSummary = JSON.stringify(summary);
  for (const privateValue of [sessionId, "Private Target", "Private Word", "Private Route", "Private Player"]) {
    assert.equal(publicSummary.includes(privateValue), false);
  }
});
