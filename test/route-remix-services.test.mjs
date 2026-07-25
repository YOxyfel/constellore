import assert from "node:assert/strict";
import test from "node:test";

import { GameStore, RunRegistry } from "../game-services.mjs";
import {
  checkRouteRemixCompletion,
  createRouteRemixPlan
} from "../public/route-remixes.mjs";

const route = [
  { a: "Earth", b: "Water", word: "Mud" },
  { a: "Mud", b: "Fire", word: "Brick" },
  { a: "Brick", b: "Brick", word: "Wall" },
  { a: "Wall", b: "Air", word: "Castle" }
];

const recipes = [
  ...route,
  { a: "Stone", b: "Stone", word: "Wall" },
  { a: "King", b: "Wall", word: "Castle" }
];

function remixedGame(families = ["required_waypoint", "graph_safe_rule", "orbit_chain"]) {
  const plan = createRouteRemixPlan({
    route,
    recipes,
    target: "Castle",
    families,
    seed: "service-remix"
  });
  const rules = plan.public.remixes.map((rule, index) => ({
    id: `${rule.family}:${index + 1}`,
    family: rule.family,
    title: rule.label,
    instruction: rule.instruction,
    detail: rule.detail
  }));
  return {
    plan,
    game: {
      mode: "reach",
      target: "Castle",
      tier: 2,
      starters: ["Earth", "Water", "Fire", "Air"],
      remixes: {
        version: plan.version,
        selectionId: "rmx1_service",
        rank: { id: "gold", number: 3 },
        completedChallenges: 6,
        requestedCount: rules.length,
        activeCount: rules.length,
        summary: plan.public.summary,
        rules
      }
    }
  };
}

function worldResult(step) {
  return { word: step.word, source: "world", emoji: "", note: "" };
}

test("a completed remixed run rebuilds progress and still finalizes after restart", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const first = new RunRegistry(store);
  const { game, plan } = remixedGame();
  const started = first.start(player.id, game, {
    ranked: true,
    challengeId: "remix:restart",
    remixRuntime: plan.runtime
  });
  started.run.solutionRoute = route;

  for (const step of route) {
    first.canCombine(started.run, step.a, step.b);
    first.recordCombination(started.run, worldResult(step), step);
  }
  assert.ok(started.run.completedAt);
  await first.persist(started.run);

  const second = new RunRegistry(store);
  const resumed = second.get(started.run.runId, player.id, started.token);
  assert.equal(second.progress(resumed).remixProgress.rulesComplete, true);
  assert.equal(checkRouteRemixCompletion(
    resumed.remixRuntime,
    resumed.remixProgress,
    resumed.game.target
  ).complete, true);
  const entry = second.finalize(resumed, player.callsign);
  assert.equal(entry.target, "Castle");
  assert.equal(entry.moves, route.length);
});

test("RunRegistry drops malformed or progress-forged remixed snapshots", async () => {
  const corruptions = [
    (snapshot) => { snapshot.remixRuntime = null; },
    (snapshot) => { snapshot.remixRuntime.target = "Different target"; },
    (snapshot) => { snapshot.remixRuntime.activeFamilies = []; },
    (snapshot) => { snapshot.remixProgress.twinPairUsed = true; },
    (snapshot) => { snapshot.game.remixes.activeCount += 1; },
    (snapshot) => { snapshot.game.remixes.rules[0].detail = "Changed rule"; },
    (snapshot) => {
      snapshot.remixRuntime.constraints.orbit_chain.sequence[1].pairKey = "air\u0000fire";
    }
  ];

  for (const corrupt of corruptions) {
    const store = await new GameStore(":memory:").init();
    const player = await store.registerPlayer();
    const first = new RunRegistry(store);
    const { game, plan } = remixedGame();
    const started = first.start(player.id, game, { remixRuntime: plan.runtime });
    const snapshot = store.data.runs[started.run.runId];
    corrupt(snapshot);
    const restored = new RunRegistry(store);
    assert.equal(
      restored.runs.has(started.run.runId),
      false,
      "a mismatched Remix envelope must fail closed"
    );
  }
});

test("pre-v5 Remix snapshots migrate by replaying history instead of trusting old progress", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const first = new RunRegistry(store);
  const { game, plan } = remixedGame();
  const started = first.start(player.id, game, { remixRuntime: plan.runtime });
  first.recordCombination(started.run, worldResult(route[0]), route[0]);

  const snapshot = store.data.runs[started.run.runId];
  snapshot.version = 4;
  snapshot.remixProgress = {
    moves: 0,
    twinPairUsed: true,
    orbitComplete: true,
    discoveredWords: ["Castle"]
  };
  const restored = new RunRegistry(store);
  const resumed = restored.get(started.run.runId, player.id, started.token);
  assert.equal(resumed.remixProgress.moves, 1);
  assert.equal(resumed.remixProgress.twinPairUsed, false);
  assert.equal(resumed.remixProgress.orbitComplete, false);
  assert.deepEqual(resumed.remixProgress.discoveredWords, ["mud"]);
});

test("Reveal resumes as completed Study without becoming scored Remix completion", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const first = new RunRegistry(store);
  const { game, plan } = remixedGame();
  const started = first.start(player.id, game, {
    ranked: true,
    challengeId: "remix:reveal",
    remixRuntime: plan.runtime
  });

  first.canCombine(started.run, route[0].a, route[0].b);
  first.recordCombination(started.run, worldResult(route[0]), route[0]);
  first.reveal(started.run, route);
  const firstProgress = first.progress(started.run);
  assert.equal(firstProgress.completed, true);
  assert.equal(firstProgress.remixProgress.complete, true);
  assert.equal(firstProgress.remixProgress.studyComplete, true);
  assert.equal(checkRouteRemixCompletion(
    started.run.remixRuntime,
    started.run.remixProgress,
    started.run.game.target
  ).code, "answer_revealed");
  await first.persist(started.run);

  const second = new RunRegistry(store);
  const resumed = second.get(started.run.runId, player.id, started.token);
  const resumedProgress = second.progress(resumed);
  assert.equal(resumedProgress.completed, true);
  assert.equal(resumedProgress.remixProgress.complete, true);
  assert.equal(resumedProgress.remixProgress.studyComplete, true);
  assert.throws(
    () => second.finalize(resumed, player.callsign),
    (error) => error.serviceCode === "assisted_run"
  );
});
