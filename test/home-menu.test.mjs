import assert from "node:assert/strict";
import test from "node:test";

import { createHomeMenuState, HOME_MENU_ADVANCED_WINS } from "../public/home-menu.mjs";

const todayKey = "2026-07-22";

function menu(overrides = {}) {
  return createHomeMenuState({
    firstOrbit: { seen: false, completed: false },
    wins: 0,
    dailyCompleted: "",
    todayKey,
    ...overrides
  });
}

test("a fresh player sees one guided Play action and one game chooser", () => {
  const state = menu();
  assert.equal(state.stage, "onboarding");
  assert.equal(state.onboardingComplete, false);
  assert.equal(state.progressReady, false);
  assert.equal(state.adventuresReady, false);
  assert.equal(state.advancedReady, false);
  assert.equal(state.primary.action, "training");
  assert.equal(state.primary.label, "Play");
  assert.equal(state.primary.secondaryAction, "modes");
  assert.equal(state.primary.secondaryLabel, "Choose game");
  assert.match(state.primary.description, /first target is Wall/i);
});

test("dismissing training does not unlock the full hub", () => {
  const state = menu({ firstOrbit: { seen: true, completed: false } });
  assert.equal(state.stage, "onboarding");
  assert.equal(state.onboardingComplete, false);
  assert.equal(state.primary.action, "reach");
  assert.equal(state.primary.secondaryAction, "training");
  assert.equal(state.progressReady, false);
  assert.equal(state.adventuresReady, false);
});

test("completing the first lesson presents one short second lesson", () => {
  const state = menu({ firstOrbit: { seen: true, completed: true } });
  assert.equal(state.stage, "onboarding");
  assert.equal(state.onboardingComplete, false);
  assert.equal(state.primary.action, "second-orbit");
  assert.equal(state.primary.label, "Play");
  assert.equal(state.primary.secondaryAction, "modes");
  assert.equal(state.progressReady, false, "zero-value progress stays hidden until a scored win");
  assert.equal(state.adventuresReady, false);
});

test("completing both lessons reveals core modes and recommends the daily word", () => {
  const state = menu({
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true }
  });
  assert.equal(state.stage, "core");
  assert.equal(state.onboardingComplete, true);
  assert.equal(state.primary.action, "daily");
  assert.equal(state.primary.secondaryAction, "modes");
});

test("a scored completion makes progress meaningful without exposing every system", () => {
  const state = menu({ firstOrbit: { seen: true, completed: false }, wins: 1 });
  assert.equal(state.stage, "core");
  assert.equal(state.onboardingComplete, true);
  assert.equal(state.progressReady, true);
  assert.equal(state.adventuresReady, false);
  assert.equal(state.advancedReady, false);
  assert.equal(state.primary.action, "daily");
});

test("adventures and advanced tools unlock together after demonstrated play", () => {
  const state = menu({ firstOrbit: { seen: true, completed: true }, wins: HOME_MENU_ADVANCED_WINS });
  assert.equal(state.stage, "established");
  assert.equal(state.progressReady, true);
  assert.equal(state.adventuresReady, true);
  assert.equal(state.advancedReady, true);
});

test("a completed daily falls back to the plain untimed game chooser", () => {
  const state = menu({ firstOrbit: { seen: true, completed: true }, wins: 3, dailyCompleted: todayKey });
  assert.equal(state.primary.action, "reach");
  assert.equal(state.primary.secondaryAction, "modes");
  assert.equal(state.primary.label, "Play");
  assert.match(state.primary.description, /without a timer or move limit/i);
});

test("malformed saved onboarding data remains safely locked", () => {
  for (const firstOrbit of [null, [], "seen", { seen: 1, completed: "yes" }]) {
    const state = menu({ firstOrbit, wins: -20 });
    assert.equal(state.onboardingComplete, false);
    assert.equal(state.primary.action, "training");
  }
});
