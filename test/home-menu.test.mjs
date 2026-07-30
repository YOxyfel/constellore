import assert from "node:assert/strict";
import test from "node:test";

import {
  createHomeMenuState,
  HOME_MENU_ADVANCED_WINS,
  HOME_MENU_ADVENTURES_RANK,
  HOME_MENU_DAILY_RANK,
  HOME_MENU_DAILY_WINS,
  HOME_MENU_CHOICES_RANK,
  HOME_MENU_CHOICES_WINS,
  HOME_MENU_EXPLORE_RANK,
  HOME_MENU_EXPLORE_WINS,
  HOME_MENU_SHARE_WINS,
  pressureModesUnlocked
} from "../public/home-menu.mjs";

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

test("a fresh player sees one guided action and one game chooser", () => {
  const state = menu();
  assert.equal(state.stage, "onboarding");
  assert.equal(state.onboardingComplete, false);
  assert.equal(state.progressReady, false);
  assert.equal(state.sharingReady, false);
  assert.equal(state.dailyReady, false);
  assert.equal(state.dailyLocked, true);
  assert.equal(state.dailyAvailable, false);
  assert.equal(state.choicesReady, false);
  assert.equal(state.exploreReady, false);
  assert.equal(state.adventuresReady, false);
  assert.equal(state.advancedReady, false);
  assert.equal(state.focusMode, true);
  assert.equal(state.winsUntilAdvanced, HOME_MENU_ADVANCED_WINS);
  assert.equal(state.primary.action, "training");
  assert.equal(state.primary.label, "Begin");
  assert.equal(state.primary.secondaryAction, "modes");
  assert.equal(state.primary.secondaryLabel, "Choose game");
  assert.equal(state.primary.kicker, "FIRST CONSTELLATION");
  assert.equal(state.primary.title, "Make Mud");
  assert.equal(state.primary.description, "Earth + Water. One move. You can’t get lost.");
  assert.equal(state.primary.meta, "Mud · 1 combination");
});

test("an unfinished first game remains the primary action after an exit", () => {
  const state = menu({ firstOrbit: { seen: true, completed: false } });
  assert.equal(state.stage, "onboarding");
  assert.equal(state.onboardingComplete, false);
  assert.equal(state.primary.action, "training");
  assert.equal(state.primary.kicker, "ORBIT IN PROGRESS");
  assert.equal(state.primary.title, "Return to Mud");
  assert.equal(state.primary.description, "Your first constellation is waiting.");
  assert.equal(state.primary.label, "Continue");
  assert.equal(state.progressReady, false);
  assert.equal(state.adventuresReady, false);
});

test("completing the first lesson presents one short second lesson", () => {
  const state = menu({ firstOrbit: { seen: true, completed: true } });
  assert.equal(state.stage, "onboarding");
  assert.equal(state.onboardingComplete, false);
  assert.equal(state.primary.action, "second-orbit");
  assert.equal(state.primary.kicker, "NEXT CONSTELLATION");
  assert.equal(state.primary.title, "Make Mountain");
  assert.equal(state.primary.label, "Continue");
  assert.equal(state.primary.secondaryAction, "modes");
  assert.equal(state.progressReady, false, "zero-value progress stays hidden until a scored win");
  assert.equal(state.adventuresReady, false);
});

test("completing both lessons keeps today's word locked until a scored Bronze win", () => {
  const state = menu({
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true },
    routeRank: "bronze"
  });
  assert.equal(state.stage, "core");
  assert.equal(state.onboardingComplete, true);
  assert.equal(state.dailyReady, false);
  assert.equal(state.dailyLocked, true);
  assert.equal(state.dailyAvailable, false);
  assert.equal(state.rankReadyForDaily, true);
  assert.equal(state.primary.action, "reach");
  assert.equal(state.primary.secondaryAction, "modes");
});

test("a scored Bronze completion unlocks today's word without exposing every system", () => {
  const state = menu({
    firstOrbit: { seen: true, completed: false },
    wins: HOME_MENU_DAILY_WINS,
    routeRank: { number: HOME_MENU_DAILY_RANK }
  });
  assert.equal(state.stage, "core");
  assert.equal(state.onboardingComplete, true);
  assert.equal(state.progressReady, true);
  assert.equal(state.sharingReady, true);
  assert.equal(state.dailyReady, true);
  assert.equal(state.dailyLocked, false);
  assert.equal(state.dailyAvailable, true);
  assert.equal(state.choicesReady, false);
  assert.equal(state.exploreReady, false);
  assert.equal(state.adventuresReady, false);
  assert.equal(state.advancedReady, false);
  assert.equal(state.focusMode, true);
  assert.equal(state.primary.action, "daily");
});

test("a scored win cannot expose today's word before Route Rank is known as Bronze", () => {
  for (const routeRank of [undefined, null, "unranked", "bogus", { number: 0 }, { rank: { id: "unranked" } }]) {
    const state = menu({
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true },
      wins: HOME_MENU_DAILY_WINS,
      routeRank
    });
    assert.equal(state.rankReadyForDaily, false);
    assert.equal(state.dailyReady, false);
    assert.equal(state.dailyLocked, true);
    assert.equal(state.dailyAvailable, false);
    assert.equal(state.primary.action, "reach");
  }
});

test("game catalogs appear only when both play history and Route Rank are ready", () => {
  const bronzeChoices = menu({ wins: HOME_MENU_CHOICES_WINS, routeRank: "bronze" });
  assert.equal(bronzeChoices.choicesReady, false);
  assert.equal(bronzeChoices.rankReadyForChoices, false);

  const choices = menu({ wins: HOME_MENU_CHOICES_WINS, routeRank: { number: HOME_MENU_CHOICES_RANK } });
  assert.equal(choices.choicesReady, true);
  assert.equal(choices.advancedReady, false);

  const bronzeExplore = menu({ wins: HOME_MENU_EXPLORE_WINS, routeRank: "bronze" });
  assert.equal(bronzeExplore.exploreReady, false);
  assert.equal(bronzeExplore.rankReadyForExplore, false);

  const explore = menu({ wins: HOME_MENU_EXPLORE_WINS, routeRank: { number: HOME_MENU_EXPLORE_RANK } });
  assert.equal(explore.choicesReady, false);
  assert.equal(explore.exploreReady, true);
  assert.equal(explore.advancedReady, false);
});

test("advanced and adventure systems wait for Gold and ten completed games", () => {
  const stillFocused = menu({ wins: HOME_MENU_ADVANCED_WINS - 1, routeRank: "gold" });
  assert.equal(stillFocused.stage, "core");
  assert.equal(stillFocused.focusMode, true);
  assert.equal(stillFocused.winsUntilAdvanced, 1);
  assert.equal(stillFocused.adventuresReady, false);
  assert.equal(stillFocused.advancedReady, false);

  const rankLocked = menu({ wins: HOME_MENU_ADVANCED_WINS, routeRank: "silver" });
  assert.equal(rankLocked.rankReadyForAdvanced, false);
  assert.equal(rankLocked.adventuresReady, false);

  const state = menu({
    firstOrbit: { seen: true, completed: true },
    wins: HOME_MENU_ADVANCED_WINS,
    routeRank: { number: HOME_MENU_ADVENTURES_RANK }
  });
  assert.equal(state.stage, "established");
  assert.equal(state.focusMode, false);
  assert.equal(state.winsUntilAdvanced, 0);
  assert.equal(state.progressReady, true);
  assert.equal(state.adventuresReady, true);
  assert.equal(state.advancedReady, true);
});

test("a completed daily falls back to the plain untimed primary game", () => {
  const state = menu({ firstOrbit: { seen: true, completed: true }, wins: 3, routeRank: "silver", dailyCompleted: todayKey });
  assert.equal(state.dailyReady, true);
  assert.equal(state.dailyLocked, false);
  assert.equal(state.dailyAvailable, false);
  assert.equal(state.primary.action, "reach");
  assert.equal(state.primary.secondaryAction, "modes");
  assert.equal(state.primary.label, "Enter");
  assert.equal(state.primary.title, "Create something impossible");
  assert.equal(state.primary.description, "Find the target at your own pace.");
});

test("malformed saved onboarding data remains safely locked", () => {
  for (const firstOrbit of [null, [], "seen", { seen: 1, completed: "yes" }]) {
    const state = menu({ firstOrbit, wins: -20 });
    assert.equal(state.onboardingComplete, false);
    assert.equal(state.primary.action, "training");
  }
});

test("timed and limited-move games unlock only after Silver", () => {
  assert.equal(pressureModesUnlocked({ rank: { id: "bronze" } }), false);
  assert.equal(pressureModesUnlocked({ rank: { id: "silver" } }), false);
  assert.equal(pressureModesUnlocked({ rank: { id: "gold" } }), true);
  assert.equal(pressureModesUnlocked({ rank: { number: 1 } }), false);
  assert.equal(pressureModesUnlocked({ rank: { number: 3 } }), true);
  assert.equal(pressureModesUnlocked("bogus"), false);
  assert.equal(pressureModesUnlocked(null), false);

  const malformed = menu({ wins: 99, routeRank: "bogus" });
  assert.equal(malformed.routeRankNumber, 1);
  assert.equal(malformed.choicesReady, false);
  assert.equal(malformed.adventuresReady, false);
});
