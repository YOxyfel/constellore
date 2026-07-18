import assert from "node:assert/strict";
import test from "node:test";
import {
  COSMIC_TWIST_CHANCE,
  cosmicTwistOptions,
  cosmicTwistPairs,
  cosmicTwistSeedFor,
  cosmicTwistWords,
  selectCosmicTwist
} from "../public/cosmic-twists.mjs";
import { curatedCombination, isSensibleResult, isSensibleWish, semanticCategoryFor } from "../server.mjs";

const canonicalWall = { word: "Wall", emoji: "🧱", category: "structure", source: "world" };
const eligible = {
  a: "Brick",
  b: "Brick",
  canonicalResult: canonicalWall,
  target: "Telescope",
  mode: "reach",
  seed: "reach:14:telescope",
  moveNumber: 3,
  discovered: ["Earth", "Water", "Fire", "Air", "Mud", "Brick"]
};

test("Cosmic Twist catalog contains contextual alternatives to real canonical recipes", () => {
  assert.deepEqual(cosmicTwistOptions("brick", "BRICK").map((item) => item.word), ["Concrete", "Great Wall", "Fortress"]);
  assert.ok(cosmicTwistOptions("Water", "Water").some((item) => item.word === "Whirlpool"));
  assert.ok(cosmicTwistOptions("Fire", "Fire").some((item) => item.word === "Firestorm"));

  for (const { a, b, variants } of cosmicTwistPairs()) {
    const canonical = curatedCombination(a, b);
    assert.ok(canonical, `${a} + ${b} should have a canonical result before it can twist`);
    assert.ok(variants.length >= 2, `${a} + ${b} should have genuine variety`);
    assert.equal(new Set(variants.map((item) => item.word.toLowerCase())).size, variants.length);
    for (const item of variants) {
      assert.notEqual(item.word.toLowerCase(), canonical.word.toLowerCase());
      assert.ok(isSensibleResult(item, a, b), `${a} + ${b} -> ${item.word} should pass the nonsense filter`);
      assert.ok(["force", "nature", "life", "structure"].includes(item.category));
    }
  }

  const words = cosmicTwistWords();
  assert.equal(new Set(words.map((item) => item.word.toLowerCase())).size, words.length);
  const categoryByWord = new Map(words.map((item) => [item.word.toLowerCase(), item.category]));
  for (const item of words) {
    assert.ok(isSensibleWish(item.word), `${item.word} should pass the recognizable-word filter`);
    assert.ok(item.emoji.trim());
    assert.ok(item.note.trim());
    if (semanticCategoryFor(item.word)) assert.equal(item.category, semanticCategoryFor(item.word), `${item.word} should match its established semantic category`);
  }
  for (const { variants } of cosmicTwistPairs()) {
    for (const item of variants) assert.equal(item.category, categoryByWord.get(item.word.toLowerCase()), `${item.word} should keep one category across all Twist pairs`);
  }
});

test("Cosmic Twists are rare, deterministic, and protected by a two-move grace period", () => {
  assert.equal(COSMIC_TWIST_CHANCE, 0.12);
  assert.equal(selectCosmicTwist({ ...eligible, moveNumber: 1, roll: 0 }), null);
  assert.equal(selectCosmicTwist({ ...eligible, moveNumber: 2, roll: 0 }), null);
  assert.equal(selectCosmicTwist({ ...eligible, roll: COSMIC_TWIST_CHANCE }), null);
  assert.equal(selectCosmicTwist({ ...eligible, roll: COSMIC_TWIST_CHANCE - Number.EPSILON })?.twisted, true);

  const first = selectCosmicTwist(eligible);
  const repeated = selectCosmicTwist(eligible);
  assert.deepEqual(first, repeated);
  assert.equal(first?.word, "Great Wall");
  assert.equal(first?.twist.canonicalWord, "Wall");
});

test("the deterministic selector stays close to the advertised twelve-percent rate", () => {
  let hits = 0;
  for (let seed = 0; seed < 10_000; seed += 1) {
    const twist = selectCosmicTwist({
      ...eligible,
      seed: cosmicTwistSeedFor({ mode: "reach", seed, target: "Telescope" })
    });
    if (twist) hits += 1;
  }
  assert.ok(hits >= 1_100 && hits <= 1_300, `expected about 12% Twists, received ${hits / 100}%`);
});

test("Cosmic Twists stay out of competitive modes and never replace the target", () => {
  for (const mode of ["quick", "moves", "daily", "weekly"]) {
    assert.equal(selectCosmicTwist({ ...eligible, mode, roll: 0 }), null, `${mode} must stay luck-free`);
  }
  assert.ok(selectCosmicTwist({ ...eligible, mode: "challenge", roll: 0 }));
  assert.equal(selectCosmicTwist({ ...eligible, twistUsed: true, roll: 0 }), null);
  assert.equal(selectCosmicTwist({ ...eligible, target: "Wall", roll: 0 }), null);
});

test("targets, inputs, canonical results, and existing discoveries cannot be selected as the Twist", () => {
  const selected = selectCosmicTwist({
    ...eligible,
    target: "Concrete",
    discovered: [...eligible.discovered, "Great Wall"],
    roll: 0
  });
  assert.equal(selected?.word, "Fortress");

  assert.equal(selectCosmicTwist({
    ...eligible,
    target: "Concrete",
    discovered: [...eligible.discovered, "Great Wall", "Fortress"],
    roll: 0
  }), null);
});

test("game seed fingerprints include mode and target", () => {
  assert.equal(cosmicTwistSeedFor({ mode: "reach", seed: -14, target: " Telescope " }), "reach:14:telescope");
  assert.notEqual(
    cosmicTwistSeedFor({ mode: "reach", seed: 14, target: "Telescope" }),
    cosmicTwistSeedFor({ mode: "challenge", seed: 14, target: "Telescope" })
  );
});
