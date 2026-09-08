import test from "node:test";
import assert from "node:assert/strict";
import {
  ANIMATIONS,
  COUNT,
  GENERIC_MAJOR_DURATION_MS,
  GOLDEN_PAIR_FULL_MAX_DURATION_MS,
  GOLDEN_PAIR_FULL_MIN_DURATION_MS,
  MOTIONS,
  VERSION,
  buildGoldenPairAnimation,
  goldenPairAnimation
} from "../public/story/golden-fusions/golden-pair-animations.mjs";
import { GOLDEN_TARGETS } from "../public/golden-targets.mjs";
import { authoredCombination, solutionRoute } from "../server.mjs";

const cleanKey = (value) => String(value || "").trim().toLocaleLowerCase("en-US");
const pairKey = (a, b) => [cleanKey(a), cleanKey(b)].sort((left, right) => (
  left.localeCompare(right, "en")
)).join("\u0000");

function assertDeepFrozen(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

function allStrings(value, output = [], seen = new WeakSet()) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return output;
  seen.add(value);
  for (const child of Object.values(value)) allStrings(child, output, seen);
  return output;
}

test("catalog covers exactly the canonical final pair of every Golden target", () => {
  assert.equal(VERSION, 1);
  assert.equal(COUNT, 50);
  assert.equal(ANIMATIONS.length, COUNT);
  assert.equal(GOLDEN_TARGETS.length, COUNT);
  assert.deepEqual(
    ANIMATIONS.map((entry) => entry.id),
    Array.from({ length: COUNT }, (_, index) => `golden-${String(index + 1).padStart(2, "0")}`)
  );

  for (const [index, definition] of GOLDEN_TARGETS.entries()) {
    const entry = ANIMATIONS[index];
    const route = solutionRoute(definition.target);
    const finalStep = route?.at(-1);
    assert.ok(finalStep, `${definition.target} needs a canonical final route step`);
    assert.equal(entry.target, definition.target);
    assert.equal(entry.family, definition.family);
    assert.equal(
      pairKey(entry.a, entry.b),
      pairKey(finalStep.a, finalStep.b),
      `${entry.id} must animate the canonical final pair for ${entry.target}`
    );
    assert.equal(cleanKey(finalStep.word), cleanKey(entry.target));
    assert.equal(
      cleanKey(authoredCombination(entry.a, entry.b)?.word),
      cleanKey(entry.target),
      `${entry.a} + ${entry.b} must remain an authored ${entry.target} recipe`
    );
  }
});

test("canonical animation identity and lookup are unique and commutative", () => {
  const ids = new Set();
  const targets = new Set();
  const recipes = new Set();

  for (const entry of ANIMATIONS) {
    const recipe = `${pairKey(entry.a, entry.b)}\u0001${cleanKey(entry.target)}`;
    assert.equal(ids.has(entry.id), false, `duplicate animation id ${entry.id}`);
    assert.equal(targets.has(cleanKey(entry.target)), false, `duplicate target ${entry.target}`);
    assert.equal(recipes.has(recipe), false, `duplicate commutative recipe for ${entry.target}`);
    ids.add(entry.id);
    targets.add(cleanKey(entry.target));
    recipes.add(recipe);

    assert.equal(goldenPairAnimation(entry.a, entry.b, entry.target), entry);
    assert.equal(goldenPairAnimation(entry.b, entry.a, entry.target), entry);
    assert.equal(
      goldenPairAnimation(
        { word: `  ${entry.b.toLocaleUpperCase("en-US")} ` },
        { word: entry.a },
        { target: entry.target }
      ),
      entry
    );
  }

  assert.equal(goldenPairAnimation("Cloud", "Water", "Storm"), null);
  assert.equal(goldenPairAnimation("Cloud", "Unknown", "Rain"), null);
  assert.equal(goldenPairAnimation("", "Water", "Rain"), null);
  assert.equal(goldenPairAnimation({ toString: () => "Cloud" }, "Water", "Rain"), null);
});

test("motion, copy, glyph, palette, and timing values stay bounded for rendering", () => {
  assert.deepEqual(MOTIONS, [
    "fall",
    "rise",
    "fly",
    "pulse",
    "transmute",
    "orbit",
    "build",
    "grow",
    "horizon",
    "reflect",
    "flow",
    "spectrum"
  ]);
  assert.equal(new Set(MOTIONS).size, 12);
  assert.equal(new Set(ANIMATIONS.map((entry) => entry.motion)).size, MOTIONS.length);

  const motionSet = new Set(MOTIONS);
  const sequenceSignatures = new Set();
  for (const entry of ANIMATIONS) {
    assert.deepEqual(Object.keys(entry).sort(), [
      "a",
      "b",
      "beats",
      "duration",
      "family",
      "glyphs",
      "id",
      "motion",
      "palette",
      "target"
    ]);
    assert.match(entry.id, /^golden-\d{2}$/u);
    assert.match(entry.family, /^[a-z][a-z0-9-]{0,23}$/u);
    assert.match(entry.palette, /^[a-z][a-z0-9-]{0,31}$/u);
    assert.equal(motionSet.has(entry.motion), true);
    assert.equal(Number.isInteger(entry.duration), true);
    assert.ok(entry.duration >= GOLDEN_PAIR_FULL_MIN_DURATION_MS);
    assert.ok(entry.duration <= GOLDEN_PAIR_FULL_MAX_DURATION_MS);
    assert.equal(entry.beats.length, 3);
    assert.equal(entry.glyphs.length, 3);

    const signature = entry.beats.join("\u0000");
    assert.equal(sequenceSignatures.has(signature), false, `${entry.id} repeats another beat sequence`);
    sequenceSignatures.add(signature);

    for (const beat of entry.beats) {
      assert.equal(typeof beat, "string");
      assert.ok(beat.length >= 2 && beat.length <= 18);
      assert.match(beat, /^[A-Z]+(?: [A-Z]+){0,2}$/u);
      assert.doesNotMatch(beat, /[\u0000-\u001f\u007f<>]/u);
    }
    for (const glyph of entry.glyphs) {
      assert.equal(typeof glyph, "string");
      assert.ok([...glyph].length >= 1 && [...glyph].length <= 8);
      assert.doesNotMatch(glyph, /[\u0000-\u001f\u007f<>&"']/u);
    }
    assertDeepFrozen(entry);
  }
  assert.equal(sequenceSignatures.size, COUNT);
  assertDeepFrozen(MOTIONS);
  assertDeepFrozen(ANIMATIONS);
});

test("builder uses sanitized live word and emoji objects deterministically", () => {
  const sourceA = { word: "  Cloud\u0000 ", emoji: " ☁️ ", privateNote: "<secret>" };
  const sourceB = { word: "Water", emoji: " 💧 ", playerId: "private-player" };
  const sourceResult = { word: "Rain", emoji: " 🌧️ ", html: "<img onerror=alert(1)>" };
  const first = buildGoldenPairAnimation({
    a: sourceA,
    b: sourceB,
    result: sourceResult,
    unsafe: "<script>alert(1)</script>"
  });
  const second = buildGoldenPairAnimation({
    a: { ...sourceA },
    b: { ...sourceB },
    result: { ...sourceResult }
  });

  assert.ok(first);
  assert.deepEqual(second, first);
  assert.equal(first.id, "golden-01");
  assert.equal(first.presentation, "authored");
  assert.equal(first.authored, true);
  assert.deepEqual(first.a, { word: "Cloud", emoji: "☁️" });
  assert.deepEqual(first.b, { word: "Water", emoji: "💧" });
  assert.deepEqual(first.result, { word: "Rain", emoji: "🌧️" });
  assert.deepEqual(first.authoredPair, { a: "Cloud", b: "Water" });
  assert.equal(first.announcement, "Cloud and Water combine to create Rain.");
  assert.equal("privateNote" in first.a, false);
  assert.equal("playerId" in first.b, false);
  assert.equal("html" in first.result, false);
  assert.equal("unsafe" in first, false);
  assert.equal(first.beats.length, 3);
  assert.equal(first.glyphs.length, 3);
  assertDeepFrozen(first);

  sourceA.word = "Fire";
  sourceB.emoji = "<changed>";
  sourceResult.word = "Ash";
  assert.deepEqual(first.a, { word: "Cloud", emoji: "☁️" });
  assert.deepEqual(first.b, { word: "Water", emoji: "💧" });
  assert.deepEqual(first.result, { word: "Rain", emoji: "🌧️" });
  assert.throws(() => {
    first.a.word = "Changed";
  }, TypeError);

  for (const value of allStrings(first)) {
    assert.doesNotMatch(value, /[\u0000-\u001f\u007f<>]/u);
  }
});

test("generic meteor fallback is explicit, sanitized, bounded, and never replaces an authored scene", () => {
  const ordinary = {
    a: { word: " Earth ", emoji: " 🌍 ", privateNote: "<secret>" },
    b: { word: "Water", emoji: "💧", playerId: "private-player" },
    result: { word: "Mud", emoji: "🟤", html: "<img onerror=alert(1)>" }
  };

  assert.equal(buildGoldenPairAnimation(ordinary), null);
  assert.equal(buildGoldenPairAnimation({ ...ordinary, major: 1 }), null);
  assert.equal(buildGoldenPairAnimation({ ...ordinary, major: "true" }), null);

  const generic = buildGoldenPairAnimation({ ...ordinary, major: true });
  assert.ok(generic);
  assert.equal(generic.id, "major-meteor");
  assert.equal(generic.presentation, "generic");
  assert.equal(generic.authored, false);
  assert.equal(generic.authoredPair, null);
  assert.equal(generic.family, "major");
  assert.equal(generic.motion, "pulse");
  assert.equal(generic.palette, "meteor-cyan");
  assert.equal(generic.duration, GENERIC_MAJOR_DURATION_MS);
  assert.ok(generic.duration >= GOLDEN_PAIR_FULL_MIN_DURATION_MS);
  assert.ok(generic.duration <= GOLDEN_PAIR_FULL_MAX_DURATION_MS);
  assert.deepEqual(generic.a, { word: "Earth", emoji: "🌍" });
  assert.deepEqual(generic.b, { word: "Water", emoji: "💧" });
  assert.deepEqual(generic.result, { word: "Mud", emoji: "🟤" });
  assert.deepEqual(generic.beats, ["APPROACH", "IMPACT", "ASCEND"]);
  assert.equal(generic.announcement, "Earth and Water combine to create Mud.");
  assert.equal("privateNote" in generic.a, false);
  assert.equal("playerId" in generic.b, false);
  assert.equal("html" in generic.result, false);
  assertDeepFrozen(generic);

  const unsafeEmoji = buildGoldenPairAnimation({
    a: { word: "Earth", emoji: "<img src=x>" },
    b: { word: "Water", emoji: "water" },
    result: { word: "Mud", emoji: "\"mud\"" },
    major: true
  });
  assert.deepEqual(
    [unsafeEmoji.a.emoji, unsafeEmoji.b.emoji, unsafeEmoji.result.emoji],
    ["", "", ""]
  );
  assert.doesNotMatch(JSON.stringify(unsafeEmoji), /img src|[<>]/iu);

  const authored = buildGoldenPairAnimation({
    a: { word: "Cloud", emoji: "☁️" },
    b: { word: "Water", emoji: "💧" },
    result: { word: "Rain", emoji: "🌧️" },
    major: true
  });
  assert.equal(authored.id, "golden-01");
  assert.equal(authored.presentation, "authored");
  assert.equal(authored.authored, true);

  const hostileMajor = buildGoldenPairAnimation({
    ...ordinary,
    get major() {
      throw new Error("hostile major getter");
    }
  });
  assert.equal(hostileMajor, null);
});

test("builder drops unsafe emoji and rejects malformed or mismatched payloads", () => {
  const sanitized = buildGoldenPairAnimation({
    a: { word: "Cloud", emoji: "<img src=x onerror=alert(1)>" },
    b: { word: "Water", emoji: "water" },
    result: { word: "Rain", emoji: "\"rain\"" }
  });
  assert.ok(sanitized);
  assert.equal(sanitized.a.emoji, "");
  assert.equal(sanitized.b.emoji, "");
  assert.equal(sanitized.result.emoji, "");
  assert.doesNotMatch(JSON.stringify(sanitized), /img src|onerror|[<>]/iu);

  assert.equal(buildGoldenPairAnimation(), null);
  assert.equal(buildGoldenPairAnimation([]), null);
  assert.equal(buildGoldenPairAnimation({
    a: "Cloud",
    b: { word: "Water", emoji: "💧" },
    result: { word: "Rain", emoji: "🌧️" }
  }), null);
  assert.equal(buildGoldenPairAnimation({
    a: { word: "Cloud<script>", emoji: "☁️" },
    b: { word: "Water", emoji: "💧" },
    result: { word: "Rain", emoji: "🌧️" }
  }), null);
  assert.equal(buildGoldenPairAnimation({
    a: { word: "Cloud", emoji: "☁️" },
    b: { word: "Water", emoji: "💧" },
    result: { word: "Storm", emoji: "⛈️" }
  }), null);
  assert.equal(buildGoldenPairAnimation({
    get a() {
      throw new Error("hostile getter");
    },
    b: { word: "Water" },
    result: { word: "Rain" }
  }), null);
  assert.equal(buildGoldenPairAnimation({
    a: {
      get word() {
        throw new Error("hostile word getter");
      }
    },
    b: { word: "Water" },
    result: { word: "Rain" }
  }), null);
});
