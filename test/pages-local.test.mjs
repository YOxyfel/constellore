import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { generateLocalWorldData, lookupGeneratedCombination, writeLocalWorldModule } from "../scripts/build-local-world.mjs";

test("the compact Pages universe preserves important logical combinations", async () => {
  const data = await generateLocalWorldData();
  assert.equal(data.words.length, 423);
  assert.equal(data.matrix.length, 89_676);
  assert.equal(lookupGeneratedCombination(data, "Earth", "Water").word, "Mud");
  assert.equal(lookupGeneratedCombination(data, "Water", "Water").word, "Ocean");
  assert.equal(lookupGeneratedCombination(data, "Fire", "Fire").word, "Inferno");
  assert.equal(lookupGeneratedCombination(data, "Species", "Air").word, "Bird");
});

test("the Pages adapter completes a real local Telescope route without a server", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-pages-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  await copyFile(new URL("../public/local-beta.mjs", import.meta.url), join(directory, "local-beta.mjs"));
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
