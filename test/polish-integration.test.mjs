import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("secondary destinations stay lazy while the Cosmos suite remains staged", async () => {
  const [page, loader, pagesBuild, releaseSync] = await Promise.all([
    source("public/index.html"),
    source("public/secondary-surface-loader.mjs"),
    source("scripts/build-pages.mjs"),
    source("scripts/sync-public-release.mjs")
  ]);

  assert.doesNotMatch(page, /<link[^>]+(?:cosmos-circuit|cosmetics-observatory(?:-full-page)?|profile-rank-frame)[.]css/i);
  assert.match(page, /id="cosmosCircuitHomeButton"[^>]*data-development-only="cosmos-suite"[^>]*hidden/);
  assert.match(page, /id="cosmosCircuitHomeStatus"/);
  assert.match(loader, /createLazyCosmosCircuit/);
  assert.match(loader, /createLazyCosmeticsObservatory/);
  assert.match(loader, /stardust-store[.]css/);
  assert.match(pagesBuild, /lazyFiles: SECONDARY_SURFACE_FILES/);
  assert.match(releaseSync, /lazyFiles: SECONDARY_SURFACE_FILES/);
});

test("Circuit lobby uses one compact keyboard-addressable tab set", async () => {
  const page = await source("public/index.html");
  assert.match(page, /role="tablist" aria-label="Cosmos Circuit sections"/);
  for (const id of ["fly", "progress", "rewards", "rules"]) {
    assert.match(page, new RegExp(`data-circuit-lobby-tab="${id}"`));
    assert.match(page, new RegExp(`data-circuit-lobby-panel="${id}"`));
  }
});

test("earned Stardust supplies disclose exact prices, caps, and local-only account behavior", async () => {
  const page = await source("public/index.html");
  assert.match(page, /id="buyStarCompass"[\s\S]*90 Stardust[\s\S]*0 \/ 9/);
  assert.match(page, /id="buyStreakShield"[\s\S]*240 Stardust[\s\S]*0 \/ 3/);
  assert.match(page, /Star Compass enters the declared Open division at 75% score/);
  assert.match(page, /Nothing here is sold for money/);
  assert.match(page, /id="syncCloudProfile"[^>]*hidden/);
  assert.match(page, /Gameplay stays on this device/);
  assert.match(page, /3 of every power per UTC day for 30 days/);
  assert.match(page, /90 of each, 360 powers total/);
});
