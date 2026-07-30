import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GameStore, RunRegistry, effectiveRunStartedAt } from "../game-services.mjs";

const localBetaSource = await readFile(new URL("../public/local-beta.mjs", import.meta.url), "utf8");

test("authoritative timed runs charge play only after one-time activation", async () => {
  let now = Date.parse("2026-07-25T12:00:00.000Z");
  const store = await new GameStore(":memory:", {
    clock: () => new Date(now)
  }).init();
  const player = await store.registerPlayer();
  const runs = new RunRegistry(store);
  const game = {
    mode: "quick",
    target: "Mud",
    tier: 1,
    timeLimit: 10,
    starters: ["Earth", "Water", "Fire", "Air"]
  };

  const started = runs.start(player.id, game, {
    ranked: false,
    deferActivation: true
  });
  const run = runs.get(started.run.runId, player.id, started.token);
  const createdAt = run.startedAt;

  assert.equal(run.activatedAt, null);
  assert.equal(effectiveRunStartedAt(run), createdAt);
  assert.throws(
    () => runs.canCombine(run, "Earth", "Water"),
    (error) => error.serviceCode === "run_not_active"
  );

  now += 2_500;
  runs.activate(run);
  const activatedAt = run.activatedAt;
  assert.equal(activatedAt, now, "the full gate duration must precede the authoritative clock");
  assert.equal(effectiveRunStartedAt(run), activatedAt);
  assert.equal(runs.get(run.runId, player.id, started.token), run, "activation must not invalidate the signed run token");

  now += 1_000;
  runs.activate(run);
  assert.equal(run.activatedAt, activatedAt, "activation retries must be idempotent");

  now = activatedAt + 9_000;
  assert.doesNotThrow(() => runs.canCombine(run, "Earth", "Water"));
  runs.recordCombination(run, { word: "Mud", emoji: "🟤", source: "world" }, { a: "Earth", b: "Water" });
  const entry = runs.finalize(run, player.callsign);
  assert.equal(entry.elapsedMs, 9_000);
  assert.equal(entry.elapsedMs < now - createdAt, true, "closed and opening door time must not enter scoring");
});

test("authoritative untimed scores also exclude the readable gate", async () => {
  let now = Date.parse("2026-07-25T13:00:00.000Z");
  const store = await new GameStore(":memory:", {
    clock: () => new Date(now)
  }).init();
  const player = await store.registerPlayer();
  const runs = new RunRegistry(store);
  const game = {
    mode: "reach",
    target: "Mud",
    tier: 1,
    starters: ["Earth", "Water", "Fire", "Air"]
  };

  const started = runs.start(player.id, game, { deferActivation: true });
  const run = started.run;
  const createdAt = run.startedAt;
  assert.equal(run.activatedAt, null);
  assert.throws(
    () => runs.canCombine(run, "Earth", "Water"),
    (error) => error.serviceCode === "run_not_active"
  );

  now += 5_000;
  runs.activate(run);
  assert.equal(run.activatedAt, now);

  now += 2_000;
  runs.recordCombination(run, { word: "Mud", emoji: "🟤", source: "world" }, { a: "Earth", b: "Water" });
  const entry = runs.finalize(run, player.callsign);
  assert.equal(entry.elapsedMs, 2_000);
  assert.equal(entry.elapsedMs < now - createdAt, true, "the readable gate must not lower an untimed score");
});

test("local practice implements the same pending and idempotent activation contract", () => {
  assert.match(localBetaSource, /const deferActivation = body[.]deferActivation === true/);
  assert.match(localBetaSource, /activatedAt:\s*deferActivation\s*[?]\s*null\s*:\s*startedAt[.]toISOString\(\)/);
  assert.match(localBetaSource, /method === "POST" && path === "\/api\/run\/activate"/);
  assert.match(localBetaSource, /function activateLocalRun\(run\)/);
  assert.match(localBetaSource, /if \(!run \|\| run[.]activatedAt != null\) return run/);
  assert.match(localBetaSource, /run[.]activatedAt = activatedAt[.]toISOString\(\)/);
  assert.match(localBetaSource, /run[.]deadlineAt = run[.]game[.]timeLimit[\s\S]*activatedAt[.]getTime\(\) \+ run[.]game[.]timeLimit \* 1000/);
  assert.match(localBetaSource, /run && run[.]activatedAt == null\)[\s\S]*"run_not_active"/);
});
