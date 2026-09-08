import assert from "node:assert/strict";
import test from "node:test";

import {
  MOON_HOME_WORLD_UNLOCK_ANCHOR_ID,
  MOON_WORLDWEAVING,
  WORLDWEAVING_VERSION,
  createWorldweavingState,
  mergeWorldweavingStates,
  moonHomeWorldAccess,
  moonWorldweavingContext,
  moonWorldweavingView,
  normalizeWorldweavingContext,
  recipeMatchesWorldweavingObjective,
  recordWorldweavingCompletion,
  sanitizeWorldweavingState,
  worldweavingObjective,
  worldwordInventoryItem
} from "../public/worldweaving.mjs";
import { recipeKey } from "../public/recipe-mastery.mjs";

const AT = "2026-08-01T12:00:00.000Z";

function step(a, b, word, extras = {}) {
  return { a, b, word, progressionEligible: true, routeCompleted: true, ...extras };
}

function complete(raw, slotId, choiceId, terminalStep, completedAt = AT) {
  return recordWorldweavingCompletion(raw, {
    context: moonWorldweavingContext(slotId, choiceId),
    history: [{ a: "Earlier", b: "Memory", word: "Path" }, terminalStep],
    completedAt
  });
}

function completedMoon({ power = "solar", shelter = "bastion", signal = "beacon" } = {}) {
  let state = createWorldweavingState();
  const recipes = {
    solar: step("Sun", "Power", "Solar Power"),
    lunar: step("Moon", "Energy", "Lunar Energy"),
    bastion: step("Wall", "Wall", "House"),
    hive: step("Room", "Room", "House"),
    haven: step("Adobe", "Construction", "House"),
    beacon: step("Light", "Light", "Laser"),
    stars: step("Sky", "Star", "Constellation")
  };
  state = complete(state, "power", power, recipes[power], "2026-08-01T10:00:00Z").state;
  state = complete(state, "shelter", shelter, recipes[shelter], "2026-08-01T11:00:00Z").state;
  return complete(state, "signal", signal, recipes[signal], "2026-08-01T12:00:00Z").state;
}

test("the Moon catalog pins seven exact terminal choices and the Lander worldword", () => {
  assert.equal(WORLDWEAVING_VERSION, 1);
  assert.deepEqual(MOON_WORLDWEAVING.slots.map(({ id, choices }) => [
    id,
    choices.map(({ id: choiceId, recipe }) => [choiceId, recipe.a, recipe.b, recipe.word])
  ]), [
    ["power", [["solar", "Sun", "Power", "Solar Power"], ["lunar", "Moon", "Energy", "Lunar Energy"]]],
    ["shelter", [["bastion", "Wall", "Wall", "House"], ["hive", "Room", "Room", "House"], ["haven", "Adobe", "Construction", "House"]]],
    ["signal", [["beacon", "Light", "Light", "Laser"], ["stars", "Sky", "Star", "Constellation"]]]
  ]);
  assert.deepEqual(
    [MOON_WORLDWEAVING.worldword.recipe.a, MOON_WORLDWEAVING.worldword.recipe.b, MOON_WORLDWEAVING.worldword.recipe.word],
    ["Rocket", "Moon", "Lander"]
  );
  assert.equal(Object.isFrozen(MOON_WORLDWEAVING.slots[0].choices[0].recipe), true);
});

test("fresh states are independent and expose Power as the only current slot", () => {
  const first = createWorldweavingState();
  const second = createWorldweavingState();
  first.worlds.moon.anchors.power = { tampered: true };
  assert.equal(second.worlds.moon.anchors.power, null);
  assert.deepEqual(moonWorldweavingView(second), {
    ...moonWorldweavingView(second),
    completed: false,
    completedAnchors: 0,
    totalAnchors: 3,
    progress: 0,
    currentSlotId: "power",
    outcomeKey: "",
    completion: null,
    worldword: null
  });
  assert.deepEqual(moonWorldweavingView(second).slots.map(({ status }) => status), ["current", "locked", "locked"]);
});

test("the first canonical Power memory unlocks the Moon as a revisitable Home world", () => {
  const initial = createWorldweavingState();
  assert.equal(MOON_HOME_WORLD_UNLOCK_ANCHOR_ID, "power");
  assert.deepEqual(moonHomeWorldAccess(initial), {
    worldId: "moon",
    unlocked: false,
    milestoneId: "power",
    completedAt: ""
  });

  const awakened = complete(
    initial,
    "power",
    "solar",
    step("Sun", "Power", "Solar Power"),
    "2026-08-01T10:00:00Z"
  ).state;
  assert.deepEqual(moonHomeWorldAccess(awakened), {
    worldId: "moon",
    unlocked: true,
    milestoneId: "power",
    completedAt: "2026-08-01T10:00:00.000Z"
  });

  assert.equal(moonHomeWorldAccess({
    worlds: { moon: { anchors: { power: { choiceId: "admin", completedAt: "now" } } } }
  }).unlocked, false, "forged anchors cannot unlock a Home world");
});

test("contexts normalize only authored IDs and targets, and objectives match either ingredient order", () => {
  const context = moonWorldweavingContext("shelter", "haven");
  assert.deepEqual(context, {
    kind: "worldweaving",
    worldId: "moon",
    slotId: "shelter",
    choiceId: "haven",
    target: "House"
  });
  assert.deepEqual(normalizeWorldweavingContext({
    kind: "WORLDWEAVING",
    world: "MOON",
    anchorId: "SHELTER",
    interpretationId: "HAVEN",
    target: " house "
  }, "HOUSE"), context);
  assert.equal(normalizeWorldweavingContext({ ...context, target: "Palace" }), null);
  assert.equal(normalizeWorldweavingContext({ ...context, worldId: "mars" }), null);
  assert.equal(moonWorldweavingContext("power", "invented"), null);

  const objective = worldweavingObjective(context, "House");
  assert.equal(recipeMatchesWorldweavingObjective(objective, step("Construction", "Adobe", "house")), true);
  assert.equal(recipeMatchesWorldweavingObjective(objective, step("Wall", "Wall", "House")), false);
});

test("completion advances only the current sequential slot from the exact final history receipt", () => {
  const initial = createWorldweavingState();
  const skipped = complete(initial, "shelter", "bastion", step("Wall", "Wall", "House"));
  assert.equal(skipped.reason, "out_of_order");
  assert.equal(skipped.advanced, false);

  const wrong = complete(initial, "power", "solar", step("Moon", "Energy", "Lunar Energy"));
  assert.equal(wrong.reason, "wrong_target");
  assert.equal(wrong.advanced, false);

  const result = complete(initial, "power", "solar", step("Power", "Sun", "Solar Power"));
  assert.equal(result.advanced, true);
  assert.equal(result.reason, "advanced");
  assert.equal(result.worldwordUnlocked, false);
  assert.deepEqual(result.anchor.memory, {
    key: recipeKey("Sun", "Power", "Solar Power"),
    a: "Sun",
    b: "Power",
    word: "Solar Power"
  });
  assert.equal(result.anchor.completedAt, AT);
  assert.deepEqual(moonWorldweavingView(result.state).slots.map(({ status }) => status), ["anchored", "current", "locked"]);
});

test("revealed, Study, explicitly ineligible, incomplete, empty, and non-terminal receipts do not advance", () => {
  const state = createWorldweavingState();
  for (const [expected, history] of [
    ["missing_history", []],
    ["ineligible", [step("Sun", "Power", "Solar Power", { worldweavingEligible: false })]],
    ["revealed", [step("Sun", "Power", "Solar Power", { revealed: true })]],
    ["revealed", [step("Sun", "Power", "Solar Power", { source: "reveal" })]],
    ["study", [step("Sun", "Power", "Solar Power", { study: true })]],
    ["study", [step("Sun", "Power", "Solar Power", { scoringDisabled: true })]],
    ["study", [step("Sun", "Power", "Solar Power", { scoreEligible: false })]],
    ["incomplete_route", [step("Sun", "Power", "Solar Power", { routeCompleted: false })]],
    ["wrong_recipe", [step("Sun", "Light", "Solar Power")]],
    ["wrong_target", [step("Sun", "Power", "Other")]]
  ]) {
    const result = recordWorldweavingCompletion(state, {
      context: moonWorldweavingContext("power", "solar"),
      history,
      completedAt: AT
    });
    assert.equal(result.reason, expected);
    assert.equal(result.advanced, false);
  }
});

test("Open assistance and hints may install semantic memory after paying their score reduction", () => {
  for (const assistance of [
    { assisted: true, assist: "sense", progressionEligible: false, scoreEligible: true, scoreMultiplier: .75 },
    { hinted: true, progressionEligible: false, scoreEligible: true, scoreMultiplier: .9 }
  ]) {
    const result = recordWorldweavingCompletion(createWorldweavingState(), {
      context: moonWorldweavingContext("power", "solar"),
      history: [step("Sun", "Power", "Solar Power", assistance)],
      completedAt: AT
    });
    assert.equal(result.advanced, true);
    assert.equal(result.reason, "advanced");
    assert.equal(result.anchor.choiceId, "solar");
  }
});

test("the three House outputs remain distinct because their exact terminal pairs are receipts", () => {
  let state = complete(createWorldweavingState(), "power", "lunar", step("Energy", "Moon", "Lunar Energy")).state;
  const wrongHouse = complete(state, "shelter", "hive", step("Wall", "Wall", "House"));
  assert.equal(wrongHouse.reason, "wrong_recipe");

  const hive = complete(state, "shelter", "hive", step("Room", "Room", "House"));
  assert.equal(hive.advanced, true);
  assert.equal(hive.anchor.choiceId, "hive");
  assert.equal(hive.anchor.memory.key, recipeKey("Room", "Room", "House"));

  const repeat = complete(hive.state, "shelter", "hive", step("Room", "Room", "House"));
  assert.equal(repeat.reason, "already_recorded");
  assert.equal(repeat.advanced, false);
  const overwrite = complete(hive.state, "shelter", "bastion", step("Wall", "Wall", "House"));
  assert.equal(overwrite.reason, "immutable_anchor");
});

test("sanitization migrates bounded legacy anchors and drops tampering, gaps, and arbitrary data", () => {
  const raw = {
    version: 0,
    moon: {
      slots: [
        {
          anchorId: "power",
          interpretationId: "solar",
          recipe: { a: "Power", b: "Sun", word: "solar power" },
          at: "2026-08-01T10:00:00Z",
          runId: "raw-run-secret"
        },
        {
          anchorId: "shelter",
          interpretationId: "hive",
          recipe: { a: "Room", b: "Room", word: "House", key: "tampered-key" }
        },
        {
          anchorId: "signal",
          interpretationId: "beacon",
          recipe: { a: "Light", b: "Light", word: "Laser" }
        }
      ],
      outcomeKey: "moon:forged:outcome",
      worldword: { word: "Admin Lander" }
    },
    admin: true
  };
  const state = sanitizeWorldweavingState(raw);
  assert.equal(state.worlds.moon.anchors.power.choiceId, "solar");
  assert.equal(state.worlds.moon.anchors.shelter, null, "a mismatched key invalidates its receipt");
  assert.equal(state.worlds.moon.anchors.signal, null, "later anchors are discarded after a gap");
  assert.equal(state.worlds.moon.completion, null);
  assert.equal(state.worlds.moon.worldword, null);
  assert.doesNotMatch(JSON.stringify(state), /raw-run-secret|Admin Lander|admin|forged/);
});

test("the third anchor completes one deterministic outcome and unlocks Lander exactly once", () => {
  let state = createWorldweavingState();
  state = complete(state, "power", "lunar", step("Moon", "Energy", "Lunar Energy"), "2026-08-01T10:00:00Z").state;
  state = complete(state, "shelter", "haven", step("Construction", "Adobe", "House"), "2026-08-01T11:00:00Z").state;
  const final = complete(state, "signal", "stars", step("Star", "Sky", "Constellation"), "2026-08-01T12:00:00Z");

  assert.equal(final.advanced, true);
  assert.equal(final.reason, "worldword_unlocked");
  assert.equal(final.worldwordUnlocked, true);
  assert.equal(final.state.worlds.moon.outcomeKey, "moon:lunar:haven:stars");
  assert.deepEqual(final.state.worlds.moon.completion, { completedAt: "2026-08-01T12:00:00.000Z" });
  assert.deepEqual(final.state.worlds.moon.worldword.provenance.recipe, {
    key: recipeKey("Rocket", "Moon", "Lander"),
    a: "Rocket",
    b: "Moon",
    word: "Lander"
  });

  const repeated = complete(final.state, "signal", "stars", step("Sky", "Star", "Constellation"));
  assert.equal(repeated.reason, "already_complete");
  assert.equal(repeated.worldwordUnlocked, false);
  assert.deepEqual(repeated.state, final.state);
});

test("merge is monotonic on one branch, deterministic on conflicts, and never rolls back completion", () => {
  const powerSolar = complete(createWorldweavingState(), "power", "solar", step("Sun", "Power", "Solar Power"), "2026-08-01T12:00:00Z").state;
  let solarHive = complete(powerSolar, "shelter", "hive", step("Room", "Room", "House"), "2026-08-01T13:00:00Z").state;
  const olderPower = complete(createWorldweavingState(), "power", "solar", step("Sun", "Power", "Solar Power"), "2026-08-01T10:00:00Z").state;
  solarHive = mergeWorldweavingStates(solarHive, olderPower);
  assert.equal(moonWorldweavingView(solarHive).completedAnchors, 2);
  assert.equal(solarHive.worlds.moon.anchors.power.completedAt, "2026-08-01T10:00:00.000Z");

  const lunar = complete(createWorldweavingState(), "power", "lunar", step("Moon", "Energy", "Lunar Energy")).state;
  assert.equal(moonHomeWorldAccess(mergeWorldweavingStates(createWorldweavingState(), lunar)).unlocked, true,
    "a canonical Power receipt carries the revisit unlock across devices");
  assert.equal(mergeWorldweavingStates(powerSolar, lunar).worlds.moon.anchors.power.choiceId, "lunar");
  assert.equal(mergeWorldweavingStates(powerSolar, lunar, { preferLocal: true }).worlds.moon.anchors.power.choiceId, "solar");

  const finished = completedMoon({ power: "solar", shelter: "bastion", signal: "beacon" });
  assert.equal(mergeWorldweavingStates(lunar, finished, { preferLocal: true }).worlds.moon.outcomeKey, "moon:solar:bastion:beacon");
  assert.equal(mergeWorldweavingStates(finished, lunar).worlds.moon.outcomeKey, "moon:solar:bastion:beacon");
});

test("the inventory item is absent until completion and carries bounded authored provenance", () => {
  assert.equal(worldwordInventoryItem(createWorldweavingState()), null);
  const state = completedMoon({ power: "lunar", shelter: "hive", signal: "stars" });
  const item = worldwordInventoryItem(state);
  assert.deepEqual(item, {
    id: "worldword-moon-lander",
    word: "Lander",
    emoji: "🚀",
    category: "structure",
    source: "worldweaving",
    provenance: {
      kind: "worldweaving",
      worldId: "moon",
      outcomeKey: "moon:lunar:hive:stars",
      anchorKeys: [
        recipeKey("Moon", "Energy", "Lunar Energy"),
        recipeKey("Room", "Room", "House"),
        recipeKey("Sky", "Star", "Constellation")
      ],
      recipe: {
        key: recipeKey("Rocket", "Moon", "Lander"),
        a: "Rocket",
        b: "Moon",
        word: "Lander"
      }
    }
  });
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(item)));
});
