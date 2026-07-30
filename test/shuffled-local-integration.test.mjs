import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  createRemixProgressionState
} from "../public/remix-progression.mjs";
import {
  createRemixReadinessState
} from "../public/remix-readiness.mjs";
import { writeLocalWorldModule } from "../scripts/build-local-world.mjs";

const LOCAL_RUNTIME_ASSETS = [
  "adaptive-difficulty.mjs",
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

async function prepareRuntime(directory, suffix = "initial") {
  if (suffix === "initial") {
    await writeLocalWorldModule(join(directory, "local-world.mjs"));
    await Promise.all(LOCAL_RUNTIME_ASSETS.map((filename) =>
      copyFile(new URL(`../public/${filename}`, import.meta.url), join(directory, filename))
    ));
  }
  const runtime = await import(
    `${pathToFileURL(join(directory, "local-beta.mjs")).href}?shuffled-local=${suffix}-${Date.now()}`
  );
  const world = await import(
    `${pathToFileURL(join(directory, "local-world.mjs")).href}?shuffled-local=${suffix}-${Date.now()}`
  );
  return { runtime, world };
}

const requestOptions = (body) => ({
  method: "POST",
  body: JSON.stringify(body)
});

function progressionAt(rankId, masteryPoints, completedChallenges) {
  return createRemixProgressionState({
    masteryPoints,
    completedChallenges,
    rankId
  });
}

function masteredWaypointReadiness() {
  const state = createRemixReadinessState();
  state.familyMastery.required_waypoint = {
    attempts: 3,
    completions: 3,
    cleanCompletions: 3,
    mastered: true
  };
  return state;
}

function adaptiveRequest(overrides = {}) {
  return {
    mode: "reach",
    seed: 81357,
    adaptive: true,
    adaptiveVersion: 2,
    adaptiveLevel: 5,
    adaptiveCompletedChallenges: 5,
    adaptiveTarget: "Forest",
    routeProgression: progressionAt("silver", 50, 5),
    remixReadiness: createRemixReadinessState(),
    startStyle: "shuffled",
    ...overrides
  };
}

test("Shuffled local missions use one deterministic suffix for starters, help, Reveal, progress, and resume", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-shuffled-local-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const { runtime, world } = await prepareRuntime(directory);
  const body = adaptiveRequest();

  const firstPreview = await runtime.localRequest(
    "/api/run/preview",
    requestOptions(body)
  );
  const repeatedPreview = await runtime.localRequest(
    "/api/run/preview",
    requestOptions(body)
  );
  assert.deepEqual(repeatedPreview.game, firstPreview.game);

  const game = firstPreview.game;
  const fullRoute = world.localRouteTo(game.target);
  const suffix = fullRoute.slice(game.startProfile.routeStartIndex);
  const baseWords = new Set(["Earth", "Water", "Fire", "Air"]);
  const advancedStarters = game.starters.filter((word) => !baseWords.has(word));

  assert.equal(game.startStyle, "shuffled");
  assert.equal(game.startProfile.style, "shuffled");
  assert.equal(game.startProfile.fallback, false);
  assert.ok(game.startProfile.routeStartIndex > 0);
  assert.equal(game.routeLength, suffix.length);
  assert.deepEqual(suffix.at(-1).word, game.target);
  assert.ok(game.starters.length <= 6);
  assert.ok(advancedStarters.length >= 2);
  assert.equal(game.starters.includes(game.target), false);
  assert.ok(game.starters.includes(suffix[0].a));
  assert.ok(game.starters.includes(suffix[0].b));
  for (const word of advancedStarters) {
    const item = game.starterItems.find((candidate) => candidate.word === word);
    assert.equal(item.loaned, true);
    assert.equal(item.source, "loaned-start");
    assert.equal(item.premium, false);
  }

  const started = await runtime.localRequest(
    "/api/run/start",
    requestOptions({ previewToken: firstPreview.previewToken })
  );
  assert.deepEqual(started.game, game);
  assert.equal(started.run.routeProgress.total, suffix.length);
  assert.equal(started.run.routeProgress.remaining, suffix.length);

  const tip = await runtime.localRequest("/api/run/tip", requestOptions({
    runId: started.run.id,
    runToken: started.run.token,
    tipIndex: 0
  }));
  assert.equal(tip.scoreSafe, true);

  const gift = await runtime.localRequest("/api/run/gift", requestOptions({
    runId: started.run.id,
    runToken: started.run.token
  }));
  const suffixBridges = new Set(suffix.slice(0, -1).map((step) => step.word));
  assert.equal(suffixBridges.has(gift.item.word), true);

  const combined = await runtime.localRequest("/api/combine", requestOptions({
    a: suffix[0].a,
    b: suffix[0].b,
    runId: started.run.id,
    runToken: started.run.token
  }));
  assert.ok(combined.routeProgress.remaining < suffix.length);

  const snapshot = await runtime.localRequest("/api/run/resume", requestOptions({
    runId: started.run.id,
    runToken: started.run.token
  }));
  for (const word of advancedStarters) {
    const item = snapshot.progress.discovered.find((candidate) => candidate.word === word);
    assert.equal(item?.source, "loaned-start");
    assert.equal(item?.loaned, true);
  }

  const { runtime: reloaded } = await prepareRuntime(directory, "reload");
  const restored = await reloaded.localRequest("/api/run/resume", requestOptions({
    runId: started.run.id,
    runToken: started.run.token,
    snapshot: {
      game: snapshot.game,
      run: snapshot.run,
      progress: snapshot.progress
    }
  }));
  assert.deepEqual(restored.game.startProfile, game.startProfile);
  assert.deepEqual(restored.game.starters, game.starters);
  assert.deepEqual(restored.game.remixes, game.remixes);
  assert.equal(restored.run.routeProgress.total, suffix.length);

  const reveal = await reloaded.localRequest("/api/run/reveal", requestOptions({
    runId: started.run.id,
    runToken: started.run.token
  }));
  assert.deepEqual(
    reveal.route.map(({ a, b, word }) => ({ a, b, word })),
    suffix.map(({ a, b, word }) => ({ a, b, word }))
  );
  assert.equal(reveal.routeProgress.complete, true);
  assert.equal(reveal.routeProgress.percent, 100);
});

test("a newly introduced Remix family forces a calm Classic start", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-shuffled-onboarding-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const { runtime } = await prepareRuntime(directory);
  const preview = await runtime.localRequest("/api/run/preview", requestOptions(adaptiveRequest({
    adaptiveCompletedChallenges: 8,
    routeProgression: progressionAt("gold", 200, 8),
    remixReadiness: createRemixReadinessState()
  })));

  assert.equal(preview.game.remixes.rank.id, "gold");
  assert.equal(preview.game.remixes.activeCount, 1);
  assert.equal(preview.game.remixes.introducesFamily, "required_waypoint");
  assert.equal(preview.game.startStyle, "classic");
  assert.deepEqual(preview.game.starters, ["Earth", "Water", "Fire", "Air"]);
  assert.equal(preview.game.startProfile.fallback, true);
  assert.equal(preview.game.startProfile.fallbackReason, "new_remix_family");
  assert.equal(preview.game.startProfile.selection.reason, "new_remix_family");
  assert.equal(preview.game.startProfile.requestedStyle, "shuffled");
});

test("mastered Remix families may safely accompany Shuffled starts, while Auto honors recovery", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-shuffled-mastered-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const { runtime } = await prepareRuntime(directory);
  const gold = {
    adaptiveCompletedChallenges: 8,
    routeProgression: progressionAt("gold", 200, 8),
    remixReadiness: masteredWaypointReadiness()
  };

  const shuffled = await runtime.localRequest("/api/run/preview", requestOptions(adaptiveRequest(gold)));
  assert.equal(shuffled.game.remixes.activeCount, 1);
  assert.equal(shuffled.game.remixes.introducesFamily, null);
  assert.equal(shuffled.game.startStyle, "shuffled");
  assert.equal(shuffled.game.startProfile.fallback, false);

  const recovery = await runtime.localRequest("/api/run/preview", requestOptions(adaptiveRequest({
    ...gold,
    startStyle: "auto",
    lastRouteOutcome: "failed"
  })));
  assert.equal(recovery.game.startStyle, "classic");
  assert.equal(recovery.game.startProfile.selection.reason, "failure_recovery");
  assert.equal(recovery.game.startProfile.fallback, false);
});
