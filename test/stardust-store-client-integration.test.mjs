import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const runtime = await readFile(new URL("../public/stardust-store-runtime.mjs", import.meta.url), "utf8");

test("the help surface lazy-loads one canonical Stardust store", () => {
  for (const id of [
    "stardustStoreBalance",
    "stardustCompassStock",
    "stardustShieldStock",
    "stardustStoreStatus",
    "buyStarCompass",
    "buyStreakShield",
    "buySense"
  ]) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  assert.match(app, /function ensureStardustStore\(\)/);
  assert.match(app, /import\("[.]\/stardust-store-runtime[.]mjs\?/);
  assert.match(app, /loadOptionalStylesheet\("stardust-store[.]css(?:[?]v=[^"]+)?"\)/);
  assert.doesNotMatch(app, /from "[.]\/stardust-store[.]mjs/);
  assert.doesNotMatch(page, /<link[^>]+stardust-store[.]css/);
  assert.match(app, /function openPowerups\(\{ trigger = document[.]activeElement \} = \{\}\)[\s\S]*ensureStardustStore\(\)/);
});

test("all Stardust buttons use the quote-and-apply purchase contract", () => {
  assert.match(runtime, /applyStardustPurchase\(before, itemId, 1\)/);
  assert.match(runtime, /powerups: \{ sense: profile[.]senseWallet[?][.]charges \}/);
  assert.match(runtime, /streakShields: profile[.]streakShields/);
  assert.match(runtime, /profile[.]stardust = result[.]state[.]stardust/);
  assert.match(runtime, /charges: result[.]state[.]inventory[.]sense/);
  assert.match(runtime, /profile[.]streakShields = result[.]state[.]inventory[.]streakShields/);
  assert.match(app, /saveProfile\(\{ fields: \["progression"\] \}\)/);
  assert.match(app, /buyStardustSupply\("star-compass"\)/);
  assert.match(app, /buyStardustSupply\("streak-shield"\)/);
  assert.doesNotMatch(app, /profile[.]stardust -= 90/);
});
