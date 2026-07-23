import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  exploreGame,
  mergeExploreInventory,
  sanitizeExploreInventory
} from "../public/explore-sandbox.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const localRuntime = await readFile(new URL("../public/local-beta.mjs", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("Explore inventory is persistent, bounded, and always contains four origins", () => {
  const inventory = sanitizeExploreInventory(
    [{ word: "Mud", emoji: "🟤", category: "nature" }, { word: "mud", emoji: "duplicate" }],
    ["Wall"]
  );
  assert.deepEqual(inventory.slice(0, 4).map((item) => item.word), ["Earth", "Water", "Fire", "Air"]);
  assert.equal(inventory.filter((item) => item.word.toLowerCase() === "mud").length, 1);
  assert.ok(inventory.some((item) => item.word === "Wall"));

  const merged = mergeExploreInventory(inventory, { word: "Mountain", emoji: "⛰️", category: "nature" });
  assert.ok(merged.some((item) => item.word === "Mountain" && item.emoji === "⛰️"));
});

test("Explore is explicitly unranked and targetless in its client contract", () => {
  const game = exploreGame(42);
  assert.equal(game.mode, "explore");
  assert.equal(game.ranked, false);
  assert.equal(game.leaderboardEligible, false);
  assert.equal(game.scoreEligible, false);
  assert.equal(game.rewardEligible, false);
  assert.equal(game.timeLimit, null);
  assert.equal(game.moveLimit, null);
  assert.deepEqual(game.starters, ["Earth", "Water", "Fire", "Air"]);
  assert.match(page, /data-mode="explore"/);
});

test("only Explore hydrates the reusable universe; mission modes still reset to game starters", () => {
  assert.match(app, /state\.words = game\.mode === "explore"[\s\S]+reusableExploreInventory\(\)[\s\S]+game\.starters\.map/);
  assert.match(app, /profile\.exploreWords = mergeExploreInventory/);
  assert.match(localRuntime, /const hasRunCredentials = Boolean\(body\.runId \|\| body\.runToken\)/);
  assert.match(localRuntime, /const available = run\?\.available \|\| new Set/);
});
