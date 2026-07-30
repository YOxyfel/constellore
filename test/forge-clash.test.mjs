import test from "node:test";
import assert from "node:assert/strict";
import {
  FORGE_ARCHETYPES,
  FORGE_COUNTERS,
  forgeArchetype,
  resolveForgeClash,
  selectForgeChampion
} from "../public/forge-clash.mjs";

test("Forge Clash exposes a complete frozen category cycle", () => {
  assert.deepEqual(FORGE_ARCHETYPES, ["force", "structure", "nature", "life"]);
  assert.deepEqual(FORGE_COUNTERS, {
    force: "structure",
    structure: "nature",
    nature: "life",
    life: "force"
  });
  assert.ok(Object.isFrozen(FORGE_ARCHETYPES));
  assert.ok(Object.isFrozen(FORGE_COUNTERS));
});

test("the deepest crafted concept is selected and the latest breaks equal depth", () => {
  const champion = selectForgeChampion({
    starters: ["Earth", "Water", "Fire", "Air"],
    history: [
      { a: "Earth", b: "Water", word: "Mud", category: "nature" },
      { a: "Mud", b: "Fire", word: "Brick", category: "structure" },
      { a: "Air", b: "Water", word: "Rain", category: "force" }
    ]
  });
  assert.equal(champion.word, "Brick");
  assert.equal(champion.power, 2);
  assert.ok(Object.isFrozen(champion));
});

test("category counters resolve before build depth and neutral clashes use depth", () => {
  const counter = resolveForgeClash(
    { word: "Pulse", category: "force", power: 1 },
    { word: "Tower", category: "structure", power: 6 }
  );
  assert.equal(counter.winner, "left");
  assert.equal(counter.reason, "category_counter");

  const depth = resolveForgeClash(
    { word: "Pulse", category: "force", power: 4 },
    { word: "Forest", category: "nature", power: 2 }
  );
  assert.equal(depth.winner, "left");
  assert.equal(depth.reason, "build_depth");
});

test("missing and exactly equal champions settle predictably", () => {
  assert.equal(resolveForgeClash(null, null).winner, "");
  assert.equal(resolveForgeClash(null, { word: "Mud", category: "nature", power: 1 }).winner, "right");
  assert.equal(resolveForgeClash(
    { word: "A", category: "force", power: 2 },
    { word: "B", category: "force", power: 2 }
  ).reason, "equal_force");
});

test("unknown categories are deterministic and hostile values stay bounded", () => {
  assert.equal(forgeArchetype("Cosmos"), forgeArchetype("Cosmos"));
  assert.ok(FORGE_ARCHETYPES.includes(forgeArchetype("Cosmos")));
  const hostile = new Proxy({}, { get() { throw new Error("no"); } });
  assert.equal(selectForgeChampion({ history: [hostile] }), null);
  assert.doesNotThrow(() => resolveForgeClash(hostile, hostile));
});
