import assert from "node:assert/strict";
import { once } from "node:events";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { adaptiveDifficultyTag, adaptiveRewardMultiplier } from "../public/adaptive-difficulty.mjs";
import { createRemixProgressionState } from "../public/remix-progression.mjs";
import { writeLocalWorldModule } from "../scripts/build-local-world.mjs";
import { buildGameForMode, server, solutionRoute } from "../server.mjs";

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
  "recipe-feedback.mjs"
];

function assertVerifiedRoute(game, { maximumLength = Infinity } = {}) {
  const route = solutionRoute(game.target);
  assert.ok(Array.isArray(route) && route.length > 0, `${game.target} must have an authored route`);
  assert.equal(game.routeLength ?? route.length, route.length);
  assert.ok(route.length <= maximumLength, `${game.target} must fit within ${maximumLength} route steps`);
  assert.equal(route.at(-1).word, game.target);
  return route;
}

async function prepareLocalRuntime(directory) {
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  await Promise.all(LOCAL_RUNTIME_ASSETS.map((filename) =>
    copyFile(new URL(`../public/${filename}`, import.meta.url), join(directory, filename))
  ));
  const runtime = await import(`${pathToFileURL(join(directory, "local-beta.mjs")).href}?adaptive=${Date.now()}`);
  const world = await import(`${pathToFileURL(join(directory, "local-world.mjs")).href}?adaptive=${Date.now()}`);
  return { runtime, world };
}

test("adaptive server game construction is deterministic, reachable, personal, and reward-scaled", () => {
  const requestedState = {
    version: 2,
    level: 7,
    failureStreak: 2,
    completedChallenges: 4,
    majorChallengePending: false,
    majorChallengeBaseLevel: null,
    recentTargets: ["Telescope", "Phoenix"]
  };

  for (const [mode, maximumLength] of [["reach", Infinity], ["quick", 8], ["moves", 12]]) {
    const first = buildGameForMode(mode, 417, "", 0, requestedState);
    const replay = buildGameForMode(mode, 417, "", 0, requestedState);
    assert.deepEqual(first, replay, `${mode} selection must be deterministic for the same seed and state`);
    assert.equal(first.adaptive, true);
    assert.equal(first.adaptiveVersion, 2);
    assert.equal(first.adaptiveLevel, 7);
    assert.equal(first.adaptiveBaseLevel, 7);
    assert.equal(first.adaptiveEffectiveLevel, 7);
    assert.equal(first.adaptiveCompletedChallenges, 4);
    assert.equal(first.adaptiveCompletionsTowardNextLevel, 1);
    assert.equal(first.adaptiveCompletionsUntilNextLevel, 2);
    assert.equal(first.adaptiveMajorChallengePending, false);
    assert.equal(first.adaptiveMajorChallengeBaseLevel, null);
    assert.equal(first.adaptiveSurge, false);
    assert.equal(first.surge, false);
    assert.match(first.adaptiveMessage, /1 of 3 challenges complete/i);
    assert.equal(first.ranked, false);
    assert.equal(first.leaderboardEligible, false);
    assert.equal(first.scoreEligible, true);
    assert.equal(first.rewardEligible, true);
    assert.equal(first.adaptiveRewardMultiplier, adaptiveRewardMultiplier(first.challengeLevel));
    assert.equal(first.difficultyTag, adaptiveDifficultyTag(first.challengeLevel));
    assertVerifiedRoute(first, { maximumLength });

    const baseGame = buildGameForMode(mode, first.seed, first.target);
    assert.equal(
      first.reward,
      Math.max(1, Math.round(baseGame.reward * first.adaptiveRewardMultiplier)),
      `${mode} reward must use the selected challenge's level`
    );
  }

  const seededTargets = new Set(Array.from({ length: 48 }, (_, seed) =>
    buildGameForMode("reach", seed, "", 0, { level: 5, failureStreak: 0, recentTargets: [] }).target
  ));
  assert.ok(seededTargets.size > 1, "seeded tie-breaking should distribute personal targets");
});

test("adaptive construction exposes one-game Surge metadata without mutating the base", () => {
  const surgeState = {
    version: 2,
    level: 6,
    failureStreak: 0,
    completedChallenges: 10,
    majorChallengePending: true,
    majorChallengeBaseLevel: 6,
    recentTargets: []
  };
  const game = buildGameForMode("reach", 927, "", 0, surgeState);
  assert.equal(game.adaptive, true);
  assert.equal(game.adaptiveBaseLevel, 6);
  assert.equal(game.adaptiveEffectiveLevel, 9);
  assert.equal(game.adaptiveLevel, 6);
  assert.equal(game.adaptiveCompletedChallenges, 10);
  assert.equal(game.adaptiveCompletionsTowardNextLevel, 1);
  assert.equal(game.adaptiveCompletionsUntilNextLevel, 2);
  assert.equal(game.adaptiveMajorChallengePending, true);
  assert.equal(game.adaptiveMajorChallengeBaseLevel, 6);
  assert.equal(game.adaptiveSurge, true);
  assert.equal(game.adaptiveSurgeBonus, 3);
  assert.equal(game.adaptiveSurgeBaseLevel, 6);
  assert.equal(game.surge, true);
  assert.equal(game.surgeBaseLevel, 6);
  assert.equal(game.difficultyTag, adaptiveDifficultyTag(game.challengeLevel));
  assert.match(game.adaptiveMessage, /Surge challenge.*one much harder game/i);
  assertVerifiedRoute(game);
});

test("adaptive state cannot alter fixed daily or weekly construction", () => {
  const hostileAdaptiveState = {
    level: 10,
    failureStreak: 99,
    recentTargets: ["Telescope", "Phoenix", "City"]
  };
  for (const [mode, seed, stage] of [["daily", 9001, 0], ["weekly", 611, 2]]) {
    const fixed = buildGameForMode(mode, seed, "", stage);
    const attemptedAdaptive = buildGameForMode(mode, seed, "", stage, hostileAdaptiveState);
    assert.deepEqual(attemptedAdaptive, fixed);
    assert.notEqual(attemptedAdaptive.adaptive, true);
  }
});

test("signed server preview and start preserve one unranked adaptive mission while fixed modes stay fixed", async (context) => {
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
  const request = async (path, { method = "GET", body, authenticated = true } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(authenticated ? auth : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json();
    return { response, payload };
  };

  const registration = await request("/api/player/register", { method: "POST", authenticated: false });
  assert.equal(registration.response.status, 201);
  auth = {
    "x-constellore-player": registration.payload.player.id,
    "x-constellore-token": registration.payload.playerToken
  };

  const adaptiveBody = {
    mode: "quick",
    seed: 7823,
    adaptive: true,
    adaptiveVersion: 2,
    adaptiveLevel: 6,
    failureStreak: 1,
    adaptiveCompletedChallenges: 10,
    adaptiveMajorChallengePending: true,
    adaptiveMajorChallengeBaseLevel: 6,
    recentTargets: ["Telescope", "Phoenix"]
  };
  const preview = await request("/api/run/preview", { method: "POST", body: adaptiveBody });
  assert.equal(preview.response.status, 200);
  assert.equal(preview.payload.game.adaptive, true);
  assert.equal(preview.payload.game.mode, "reach");
  assert.equal(preview.payload.game.timeLimit, null);
  assert.equal(preview.payload.game.moveLimit, null);
  // Online difficulty, rank, and Remix readiness are server-owned. Hostile or
  // stale client claims cannot skip a new account into an advanced challenge,
  // and the response does not reveal the server's counters or formula.
  const privateDifficultyFields = [
    "adaptiveVersion",
    "adaptiveLevel",
    "adaptiveBaseLevel",
    "adaptiveEffectiveLevel",
    "adaptiveCompletedChallenges",
    "adaptiveCompletionsTowardNextLevel",
    "adaptiveCompletionsUntilNextLevel",
    "adaptiveMajorChallengePending",
    "adaptiveMajorChallengeBaseLevel",
    "adaptiveSurge",
    "adaptiveSurgeBonus",
    "adaptiveSurgeBaseLevel",
    "surge",
    "surgeBaseLevel",
    "challengeLevel",
    "adaptiveRewardMultiplier",
    "adaptiveMessage"
  ];
  for (const field of privateDifficultyFields) {
    assert.equal(Object.hasOwn(preview.payload.game, field), false, `${field} must remain server-private`);
  }
  assert.match(preview.payload.previewToken, /^mission_[0-9a-f-]{36}$/);
  assert.equal(preview.payload.previewToken.includes("."), false);
  assert.equal(preview.payload.game.remixes.rank.id, "bronze");
  assert.equal(preview.payload.game.remixes.activeCount, 0);
  assert.equal(preview.payload.player.routeRank.rank.id, "bronze");
  assert.equal(preview.payload.player.routeRank.mastery.points, 0);
  assert.equal(Object.hasOwn(preview.payload.player.routeRank, "adaptiveDifficulty"), false);
  assert.equal(Object.hasOwn(preview.payload.player.routeRank, "remixIntensity"), false);
  assert.equal(preview.payload.game.ranked, false);
  assert.equal(preview.payload.game.leaderboardEligible, false);
  assert.equal(preview.payload.game.scoreEligible, true);
  assert.equal(preview.payload.game.rewardEligible, true);
  assert.ok(["", "Difficult"].includes(preview.payload.game.difficultyTag));
  assertVerifiedRoute(preview.payload.game);

  const manuallyRequestedPressure = await request("/api/run/preview", {
    method: "POST",
    body: {
      mode: "moves",
      seed: 7823,
      adaptive: false,
      routeProgression: {
        rankId: "cosmic",
        masteryPoints: 999999,
        completedChallenges: 999999
      }
    }
  });
  assert.equal(manuallyRequestedPressure.response.status, 200);
  assert.equal(manuallyRequestedPressure.payload.game.mode, "reach");
  assert.equal(manuallyRequestedPressure.payload.game.adaptive, true);
  assert.equal(manuallyRequestedPressure.payload.game.timeLimit, null);
  assert.equal(manuallyRequestedPressure.payload.game.moveLimit, null);
  assert.equal(manuallyRequestedPressure.payload.game.remixes.rank.id, "bronze");

  const avoidedPreview = await request("/api/run/preview", {
    method: "POST",
    body: {
      ...adaptiveBody,
      avoidTarget: preview.payload.game.target.toLocaleUpperCase("en-US")
    }
  });
  assert.equal(avoidedPreview.response.status, 200);
  assert.notEqual(
    avoidedPreview.payload.game.target.toLocaleLowerCase("en-US"),
    preview.payload.game.target.toLocaleLowerCase("en-US")
  );
  assert.equal(Object.hasOwn(avoidedPreview.payload.game, "avoidTarget"), false);

  const invalidAvoidTarget = await request("/api/run/preview", {
    method: "POST",
    body: { ...adaptiveBody, avoidTarget: "x".repeat(81) }
  });
  assert.equal(invalidAvoidTarget.response.status, 400);
  assert.equal(invalidAvoidTarget.payload.code, "invalid_avoid_target");

  const started = await request("/api/run/start", {
    method: "POST",
    body: { previewToken: avoidedPreview.payload.previewToken }
  });
  assert.equal(started.response.status, 201);
  assert.equal(started.payload.game.target, avoidedPreview.payload.game.target);
  assert.equal(started.payload.game.reward, avoidedPreview.payload.game.reward);
  assert.equal(started.payload.game.difficultyTag, avoidedPreview.payload.game.difficultyTag);
  for (const field of privateDifficultyFields) {
    assert.equal(Object.hasOwn(started.payload.game, field), false, `${field} must remain server-private after start`);
  }
  assert.equal(started.payload.run.ranked, false);
  assert.equal(started.payload.run.leaderboardEligible, false);
  assert.equal(started.payload.run.routeProgress.total, avoidedPreview.payload.game.routeLength);

  const completedForReplay = await request("/api/run/reveal", {
    method: "POST",
    body: {
      runId: started.payload.run.id,
      runToken: started.payload.run.token
    }
  });
  assert.equal(completedForReplay.response.status, 200);
  const replayed = await request("/api/run/replay", {
    method: "POST",
    body: {
      runId: started.payload.run.id,
      runToken: started.payload.run.token
    }
  });
  assert.equal(replayed.response.status, 201);
  for (const field of ["mode", "target", "seed", "timeLimit", "moveLimit", "starters", "starterItems", "startProfile", "remixes"]) {
    assert.deepEqual(replayed.payload.game[field], started.payload.game[field], `replay ${field}`);
  }
  assert.equal(replayed.payload.game.practiceReplay, true);
  assert.equal(replayed.payload.game.replayOf.runId, started.payload.run.id);
  assert.equal(replayed.payload.game.replayOf.adaptive, true);
  assert.equal(replayed.payload.game.adaptive, false);
  assert.equal(replayed.payload.game.ranked, false);
  assert.equal(replayed.payload.game.scoreEligible, false);
  assert.equal(replayed.payload.game.rewardEligible, false);
  assert.equal(replayed.payload.game.leaderboardEligible, false);
  assert.equal(replayed.payload.run.ranked, false);
  assert.equal(replayed.payload.run.scoreEligible, false);
  assert.equal(replayed.payload.run.rewardEligible, false);
  assert.equal(replayed.payload.run.leaderboardEligible, false);
  const replayedAfterLoss = await request("/api/run/replay", {
    method: "POST",
    body: {
      runId: replayed.payload.run.id,
      runToken: replayed.payload.run.token
    }
  });
  assert.equal(replayedAfterLoss.response.status, 201);
  assert.equal(replayedAfterLoss.payload.game.practiceReplay, true);
  assert.equal(replayedAfterLoss.payload.game.replayOf.runId, replayed.payload.run.id);
  assert.equal(replayedAfterLoss.payload.game.replayOf.adaptive, true);

  for (const body of [
    { mode: "daily", adaptive: true, adaptiveLevel: 1, failureStreak: 50 },
    { mode: "weekly", stage: 1, adaptive: true, adaptiveLevel: 10, failureStreak: 0 }
  ]) {
    const fixedPreview = await request("/api/run/preview", { method: "POST", body });
    assert.equal(fixedPreview.response.status, 200);
    assert.notEqual(fixedPreview.payload.game.adaptive, true);
    assert.equal(fixedPreview.payload.game.ranked, true);
    assert.equal(fixedPreview.payload.game.leaderboardEligible, true);
  }

  const customPreview = await request("/api/run/preview", {
    method: "POST",
    body: {
      mode: "reach",
      seed: 27,
      target: "Telescope",
      custom: true,
      adaptive: true,
      adaptiveLevel: 10
    }
  });
  assert.equal(customPreview.response.status, 200);
  assert.equal(customPreview.payload.game.target, "Telescope");
  assert.notEqual(customPreview.payload.game.adaptive, true);
  assert.equal(customPreview.payload.game.ranked, false);
  assert.equal(customPreview.payload.game.leaderboardEligible, false);
});

test("the static beta preview/start adapter matches adaptive server semantics", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-adaptive-local-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const { runtime, world } = await prepareLocalRuntime(directory);

  const bronzePressure = await runtime.localRequest("/api/run/preview", {
    method: "POST",
    body: JSON.stringify({ mode: "quick", seed: 73 })
  });
  assert.equal(bronzePressure.game.mode, "reach");
  assert.equal(bronzePressure.game.adaptive, true);
  assert.equal(bronzePressure.game.timeLimit, null);
  assert.equal(bronzePressure.game.moveLimit, null);
  assert.equal(bronzePressure.game.remixes.rank.id, "bronze");

  const goldPressure = await runtime.localRequest("/api/run/preview", {
    method: "POST",
    body: JSON.stringify({
      mode: "quick",
      seed: 73,
      routeProgression: createRemixProgressionState({
        rankId: "gold",
        masteryPoints: 200,
        completedChallenges: 8
      })
    })
  });
  assert.equal(goldPressure.game.mode, "quick");
  assert.equal(goldPressure.game.adaptive, undefined);
  assert.equal(goldPressure.game.timeLimit, 90);

  const firstRecoveryCandidate = await runtime.localRequest("/api/run/preview", {
    method: "POST",
    body: JSON.stringify({
      mode: "reach",
      seed: 991,
      adaptive: true,
      adaptiveVersion: 2,
      adaptiveLevel: 5
    })
  });
  const alternateRecoveryCandidate = await runtime.localRequest("/api/run/preview", {
    method: "POST",
    body: JSON.stringify({
      mode: "reach",
      seed: 991,
      adaptive: true,
      adaptiveVersion: 2,
      adaptiveLevel: 5,
      avoidTarget: firstRecoveryCandidate.game.target.toLocaleUpperCase("en-US")
    })
  });
  assert.notEqual(
    alternateRecoveryCandidate.game.target.toLocaleLowerCase("en-US"),
    firstRecoveryCandidate.game.target.toLocaleLowerCase("en-US")
  );
  assert.equal(
    alternateRecoveryCandidate.game.adaptiveRecentTargets.at(-1),
    alternateRecoveryCandidate.game.target
  );
  const startedAlternate = await runtime.localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ previewToken: alternateRecoveryCandidate.previewToken })
  });
  assert.equal(startedAlternate.game.target, alternateRecoveryCandidate.game.target);

  await assert.rejects(
    runtime.localRequest("/api/run/preview", {
      method: "POST",
      body: JSON.stringify({ mode: "reach", adaptive: true, avoidTarget: "x".repeat(81) })
    }),
    (error) => error?.code === "invalid_avoid_target" && error?.status === 400
  );

  const adaptiveBody = {
    mode: "moves",
    seed: 31415,
    adaptive: true,
    adaptiveVersion: 2,
    adaptiveLevel: 7,
    failureStreak: 2,
    adaptiveCompletedChallenges: 20,
    adaptiveMajorChallengePending: true,
    adaptiveMajorChallengeBaseLevel: 7,
    recentTargets: ["Telescope", "Phoenix"]
  };
  const preview = await runtime.localRequest("/api/run/preview", {
    method: "POST",
    body: JSON.stringify(adaptiveBody)
  });
  assert.equal(preview.game.adaptive, true);
  assert.equal(preview.game.adaptiveVersion, 2);
  assert.equal(preview.game.adaptiveLevel, 7);
  assert.equal(preview.game.adaptiveBaseLevel, 7);
  assert.equal(preview.game.adaptiveEffectiveLevel, 10);
  assert.equal(preview.game.adaptiveCompletedChallenges, 20);
  assert.equal(preview.game.adaptiveCompletionsTowardNextLevel, 2);
  assert.equal(preview.game.adaptiveCompletionsUntilNextLevel, 1);
  assert.equal(preview.game.adaptiveMajorChallengePending, true);
  assert.equal(preview.game.adaptiveMajorChallengeBaseLevel, 7);
  assert.equal(preview.game.adaptiveSurge, true);
  assert.equal(preview.game.adaptiveSurgeBonus, 3);
  assert.equal(preview.game.adaptiveSurgeBaseLevel, 7);
  assert.equal(preview.game.surge, true);
  assert.equal(preview.game.surgeBaseLevel, 7);
  assert.match(preview.game.adaptiveMessage, /Surge challenge/i);
  assert.equal(preview.game.ranked, false);
  assert.equal(preview.game.leaderboardEligible, false);
  assert.equal(preview.game.difficultyTag, adaptiveDifficultyTag(preview.game.challengeLevel));
  assert.equal(preview.game.remixes.rank.id, "diamond");
  assert.ok(preview.game.remixes.activeCount >= 1 && preview.game.remixes.activeCount <= 2);
  assert.equal(preview.game.remixes.rules.length, preview.game.remixes.activeCount);
  const route = world.localRouteTo(preview.game.target);
  assert.ok(Array.isArray(route) && route.length > 0);
  assert.equal(route.length, preview.game.routeLength);
  assert.ok(route.length <= 12);

  const baseGame = world.buildLocalGame("moves", preview.game.seed, preview.game.target);
  assert.equal(
    preview.game.reward,
    Math.max(1, Math.round(baseGame.reward * preview.game.adaptiveRewardMultiplier))
  );
  assert.equal(preview.game.adaptiveRewardMultiplier, adaptiveRewardMultiplier(preview.game.challengeLevel));

  const started = await runtime.localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ previewToken: preview.previewToken })
  });
  assert.equal(started.game.target, preview.game.target);
  assert.equal(started.game.challengeLevel, preview.game.challengeLevel);
  assert.equal(started.game.reward, preview.game.reward);
  for (const field of [
    "adaptiveVersion",
    "adaptiveLevel",
    "adaptiveBaseLevel",
    "adaptiveEffectiveLevel",
    "adaptiveCompletedChallenges",
    "adaptiveCompletionsTowardNextLevel",
    "adaptiveCompletionsUntilNextLevel",
    "adaptiveMajorChallengePending",
    "adaptiveMajorChallengeBaseLevel",
    "adaptiveSurge",
    "adaptiveSurgeBonus",
    "adaptiveSurgeBaseLevel",
    "surge",
    "surgeBaseLevel",
    "adaptiveMessage"
  ]) {
    assert.deepEqual(started.game[field], preview.game[field], field);
  }
  assert.equal(started.run.ranked, false);
  assert.equal(started.run.leaderboardEligible, false);
  assert.equal(started.run.routeProgress.total, route.length);
  assert.deepEqual(started.game.remixes, preview.game.remixes);
  assert.equal(started.run.remixProgress.items.length, preview.game.remixes.activeCount);

  const localCompletedForReplay = await runtime.localRequest("/api/run/reveal", {
    method: "POST",
    body: JSON.stringify({
      runId: started.run.id,
      runToken: started.run.token
    })
  });
  assert.equal(localCompletedForReplay.completed, true);
  const localReplay = await runtime.localRequest("/api/run/replay", {
    method: "POST",
    body: JSON.stringify({
      runId: started.run.id,
      runToken: started.run.token
    })
  });
  for (const field of ["mode", "target", "seed", "timeLimit", "moveLimit", "starters", "starterItems", "startProfile", "remixes"]) {
    assert.deepEqual(localReplay.game[field], started.game[field], `local replay ${field}`);
  }
  assert.equal(localReplay.game.practiceReplay, true);
  assert.equal(localReplay.game.replayOf.runId, started.run.id);
  assert.equal(localReplay.game.replayOf.adaptive, true);
  assert.equal(localReplay.game.adaptive, false);
  assert.equal(localReplay.game.ranked, false);
  assert.equal(localReplay.game.scoreEligible, false);
  assert.equal(localReplay.game.rewardEligible, false);
  assert.equal(localReplay.run.scoreEligible, false);
  assert.equal(localReplay.run.rewardEligible, false);
  const localReplayAfterLoss = await runtime.localRequest("/api/run/replay", {
    method: "POST",
    body: JSON.stringify({
      runId: localReplay.run.id,
      runToken: localReplay.run.token
    })
  });
  assert.equal(localReplayAfterLoss.game.practiceReplay, true);
  assert.equal(localReplayAfterLoss.game.replayOf.runId, localReplay.run.id);
  assert.equal(localReplayAfterLoss.game.replayOf.adaptive, true);

  const fixedDaily = await runtime.localRequest("/api/run/preview", {
    method: "POST",
    body: JSON.stringify({ mode: "daily", seed: 19, adaptive: true, adaptiveLevel: 10 })
  });
  assert.notEqual(fixedDaily.game.adaptive, true);
  assert.equal(fixedDaily.game.target, world.buildLocalGame("daily", 19).target);

  const fixedCustom = await runtime.localRequest("/api/run/preview", {
    method: "POST",
    body: JSON.stringify({
      mode: "reach",
      seed: 19,
      target: "Telescope",
      custom: true,
      adaptive: true,
      adaptiveLevel: 10
    })
  });
  assert.equal(fixedCustom.game.target, "Telescope");
  assert.notEqual(fixedCustom.game.adaptive, true);

  const cosmicPreview = await runtime.localRequest("/api/run/preview", {
    method: "POST",
    body: JSON.stringify({
      mode: "reach",
      seed: 271828,
      adaptive: true,
      adaptiveVersion: 2,
      adaptiveLevel: 10,
      adaptiveCompletedChallenges: 240
    })
  });
  assert.equal(cosmicPreview.game.remixes.rank.id, "cosmic");
  assert.equal(cosmicPreview.game.remixes.activeCount, 5);
  assert.equal(
    new Set(cosmicPreview.game.remixes.rules.map((rule) => rule.family)).size,
    5
  );

  const cosmicStarted = await runtime.localRequest("/api/run/start", {
    method: "POST",
    body: JSON.stringify({ previewToken: cosmicPreview.previewToken })
  });
  const cosmicRoute = world.localRouteTo(cosmicStarted.game.target);
  const firstStep = cosmicRoute[0];
  await runtime.localRequest("/api/combine", {
    method: "POST",
    body: JSON.stringify({
      a: firstStep.a,
      b: firstStep.b,
      runId: cosmicStarted.run.id,
      runToken: cosmicStarted.run.token
    })
  });
  const revealed = await runtime.localRequest("/api/run/reveal", {
    method: "POST",
    body: JSON.stringify({
      runId: cosmicStarted.run.id,
      runToken: cosmicStarted.run.token
    })
  });
  assert.equal(revealed.completed, true);
  assert.equal(revealed.routeProgress.complete, true);
  assert.equal(revealed.routeProgress.percent, 100);

  const revealedSnapshot = await runtime.localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify({
      runId: cosmicStarted.run.id,
      runToken: cosmicStarted.run.token
    })
  });
  const reloadedRuntime = await import(
    `${pathToFileURL(join(directory, "local-beta.mjs")).href}?adaptive-reveal=${Date.now()}`
  );
  const restoredReveal = await reloadedRuntime.localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify({
      runId: cosmicStarted.run.id,
      runToken: cosmicStarted.run.token,
      snapshot: {
        game: revealedSnapshot.game,
        run: revealedSnapshot.run,
        progress: revealedSnapshot.progress
      }
    })
  });
  assert.equal(restoredReveal.progress.completed, true);
  assert.equal(restoredReveal.run.assist, "reveal");
  assert.equal(restoredReveal.run.routeProgress.complete, true);
  assert.equal(restoredReveal.run.routeProgress.percent, 100);
});
