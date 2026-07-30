import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ANALYTICS_EVENT_NAMES, GameStore } from "../game-services.mjs";
import { server } from "../server.mjs";

const FEATURE_EVENTS = Object.freeze([
  "cosmos_circuit_opened",
  "cosmos_circuit_started",
  "cosmos_circuit_completed",
  "cosmos_circuit_extracted",
  "cosmos_circuit_abandoned",
  "cosmos_circuit_tutorial_viewed",
  "cosmos_circuit_tutorial_completed",
  "cosmos_circuit_challenge_completed",
  "cosmos_circuit_weekly_reward_claimed",
  "cosmos_circuit_personal_best",
  "star_path_opened",
  "star_path_tutorial_viewed",
  "star_path_tutorial_completed",
  "star_path_reward_claimed",
  "star_path_rewards_claimed_all"
]);
const runtimeSource = await readFile(new URL("../public/cosmos-circuit-runtime.mjs", import.meta.url), "utf8");
const EMITTED_FEATURE_EVENTS = Object.freeze([...new Set(
  [...runtimeSource.matchAll(/["']((?:cosmos_circuit|star_path)_[a-z0-9_]+)["']/g)]
    .map((match) => match[1])
)]);

test("Circuit and Star Path analytics retain bounded aggregates only", async () => {
  assert.deepEqual([...EMITTED_FEATURE_EVENTS].sort(), [...FEATURE_EVENTS].sort());
  for (const eventName of FEATURE_EVENTS) assert.ok(ANALYTICS_EVENT_NAMES.includes(eventName), eventName);

  const store = await new GameStore(":memory:").init();
  const at = new Date("2026-07-27T12:00:00.000Z");
  const privateValues = [
    "private-circuit-session",
    "private-player-id",
    "Secret trajectory note",
    "Secret Planet",
    "private-account@example.test"
  ];

  for (let index = 0; index < 2; index += 1) {
    await store.recordAnalyticsEvent({
      name: "cosmos_circuit_opened",
      sessionId: privateValues[0],
      properties: {
        playerId: privateValues[1],
        note: privateValues[2],
        planet: privateValues[3],
        email: privateValues[4],
        trajectory: [{ x: 0.123, y: 0.987 }]
      }
    }, at);
  }
  await store.recordAnalyticsEvent({
    name: "cosmos_circuit_started",
    sessionId: privateValues[0],
    properties: { mode: "ticketed", path: "crazy", practiceBoost: false, passes: 3 }
  }, at);
  await store.recordAnalyticsEvent({
    name: "cosmos_circuit_started",
    sessionId: privateValues[0],
    properties: { mode: "practice", practiceBoost: true }
  }, at);
  await store.recordAnalyticsEvent({
    name: "cosmos_circuit_completed",
    sessionId: privateValues[0],
    properties: {
      mode: "ticketed",
      path: "crazy",
      milestone: "crazy",
      reward: true,
      xp: 125,
      durationMs: 61_500,
      segments: 15,
      stardustPercent: 91,
      rawSamples: [{ elapsedMs: 10, x: 0.4, y: 0.6 }]
    }
  }, at);
  await store.recordAnalyticsEvent({
    name: "cosmos_circuit_extracted",
    sessionId: privateValues[0],
    properties: { mode: "ticketed", milestone: "drift", reward: true }
  }, at);
  await store.recordAnalyticsEvent({
    name: "cosmos_circuit_abandoned",
    sessionId: privateValues[0],
    properties: { mode: "practice", reason: "withdraw" }
  }, at);
  await store.recordAnalyticsEvent({
    name: "cosmos_circuit_tutorial_viewed",
    sessionId: privateValues[0]
  }, at);
  await store.recordAnalyticsEvent({
    name: "cosmos_circuit_tutorial_completed",
    sessionId: privateValues[0],
    properties: { mode: "practice", completed: true }
  }, at);
  await store.recordAnalyticsEvent({
    name: "cosmos_circuit_challenge_completed",
    sessionId: privateValues[0],
    properties: { mode: "ticketed", milestone: "cosmos", completed: true }
  }, at);
  await store.recordAnalyticsEvent({
    name: "cosmos_circuit_weekly_reward_claimed",
    sessionId: privateValues[0],
    properties: { kind: "shipDecal" }
  }, at);
  await store.recordAnalyticsEvent({
    name: "cosmos_circuit_personal_best",
    sessionId: privateValues[0],
    properties: { mode: "practice", milestone: "galaxy" }
  }, at);
  for (let index = 0; index < 2; index += 1) {
    await store.recordAnalyticsEvent({ name: "star_path_opened", sessionId: privateValues[0] }, at);
  }
  await store.recordAnalyticsEvent({
    name: "star_path_tutorial_viewed",
    sessionId: privateValues[0]
  }, at);
  await store.recordAnalyticsEvent({
    name: "star_path_tutorial_completed",
    sessionId: privateValues[0]
  }, at);
  await store.recordAnalyticsEvent({
    name: "star_path_reward_claimed",
    sessionId: privateValues[0],
    properties: { track: "free", tier: 1 }
  }, at);
  await store.recordAnalyticsEvent({
    name: "star_path_reward_claimed",
    sessionId: privateValues[0],
    properties: { track: "supporter", tier: 12 }
  }, at);

  const summary = store.analyticsSummary(30, at);
  assert.equal(summary.privacy, "aggregate-only");
  assert.equal(summary.events.cosmos_circuit_completed, 1);
  assert.equal(summary.segments.cosmos_circuit_started.mode.ticketed, 1);
  assert.equal(summary.segments.cosmos_circuit_started.path.crazy, 1);
  assert.equal(summary.segments.cosmos_circuit_started.mode.practice, 1);
  assert.equal(summary.segments.cosmos_circuit_started.practiceBoost.false, 1);
  assert.equal(summary.segments.cosmos_circuit_started.practiceBoost.true, 1);
  assert.equal(summary.segments.cosmos_circuit_completed.path.crazy, 1);
  assert.equal(summary.segments.cosmos_circuit_completed.milestone.crazy, 1);
  assert.equal(summary.segments.cosmos_circuit_completed.reward.true, 1);
  assert.equal(summary.segments.cosmos_circuit_weekly_reward_claimed.kind.shipdecal, 1);
  assert.equal(summary.segments.star_path_reward_claimed.track.free, 1);
  assert.equal(summary.segments.star_path_reward_claimed.track.supporter, 1);
  assert.equal(summary.segments.star_path_reward_claimed.tier["1"], 1);
  assert.equal(summary.segments.star_path_reward_claimed.tier["12"], 1);
  assert.deepEqual(summary.metrics.cosmos_circuit_completed.reward, { count: 1, sum: 1, min: 1, max: 1, average: 1 });
  assert.equal(summary.metrics.cosmos_circuit_completed.xp.sum, 125);
  assert.equal(summary.metrics.cosmos_circuit_completed.durationMs.sum, 61_500);
  assert.equal(summary.metrics.cosmos_circuit_completed.segments.sum, 15);
  assert.equal(summary.metrics.cosmos_circuit_completed.stardustPercent.sum, 91);
  assert.deepEqual(summary.funnels.cosmosCircuit, {
    opened: 2,
    started: 2,
    completed: 1,
    extracted: 1,
    abandoned: 1,
    tutorialViewed: 1,
    tutorialCompleted: 1,
    challengesCompleted: 1,
    weeklyRewardsClaimed: 1,
    personalBests: 1,
    rewarded: 1,
    startRatePercent: 100,
    completionPercent: 50,
    rewardPercent: 100
  });
  assert.deepEqual(summary.funnels.starPath, {
    opened: 2,
    tutorialViewed: 1,
    tutorialCompleted: 1,
    rewardsClaimed: 2,
    claimRatePercent: 100
  });
  assert.equal(summary.economy.circuitRewardedFlights, 1);
  assert.equal(summary.economy.starPathRewardsClaimed, 2);

  const retained = JSON.stringify({ analytics: store.data.analytics, summary });
  for (const privateValue of privateValues) assert.equal(retained.includes(privateValue), false, privateValue);
  for (const forbiddenKey of ["trajectory", "rawSamples", "\"x\"", "\"y\"", "\"playerId\"", "\"email\""]) {
    assert.equal(retained.includes(forbiddenKey), false, forbiddenKey);
  }
});

test("the analytics HTTP endpoint accepts the bounded Circuit and Star Path event vocabulary", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(async () => {
    if (!server.listening) return;
    server.close();
    await once(server, "close");
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  for (const [index, name] of FEATURE_EVENTS.entries()) {
    const response = await fetch(`${baseUrl}/api/analytics`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        sessionId: `cosmos-analytics-http-${index}`,
        properties: name === "star_path_reward_claimed"
          ? { track: "free", tier: 1 }
          : { mode: "ticketed", milestone: "drift", reward: false }
      })
    });
    assert.equal(response.status, 202, `${name}: ${await response.text()}`);
  }
});
