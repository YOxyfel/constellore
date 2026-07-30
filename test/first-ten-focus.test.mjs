import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  createHomeMenuState,
  HOME_MENU_ADVANCED_WINS
} from "../public/home-menu.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const homeMenuView = await readFile(new URL("../public/home-menu-view.mjs", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

test("the shared daily target waits for the first scored Bronze win", () => {
  const lessonsComplete = createHomeMenuState({
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true },
    wins: 0,
    routeRank: "bronze",
    dailyCompleted: "",
    todayKey: "2026-07-26"
  });

  assert.equal(lessonsComplete.primary.action, "reach");
  assert.equal(lessonsComplete.dailyReady, false);
  assert.equal(lessonsComplete.dailyLocked, true);
  assert.equal(lessonsComplete.dailyAvailable, false);

  const firstScoredWin = createHomeMenuState({
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true },
    wins: 1,
    routeRank: "bronze",
    dailyCompleted: "",
    todayKey: "2026-07-26"
  });

  assert.equal(firstScoredWin.primary.action, "daily");
  assert.equal(firstScoredWin.dailyReady, true);
  assert.equal(firstScoredWin.dailyLocked, false);
  assert.equal(firstScoredWin.dailyAvailable, true);
  assert.equal(firstScoredWin.choicesReady, false);
  assert.equal(firstScoredWin.exploreReady, false);
  assert.equal(firstScoredWin.adventuresReady, false);
  assert.equal(firstScoredWin.advancedReady, false);
  assert.equal(firstScoredWin.focusMode, true);

  assert.match(app, /mode === "daily" && !menu\.dailyReady/);
  assert.match(app, /Today’s Word unlocks after your first scored Bronze win\./);
  assert.match(app, /const nextMode = homeMenuState\(\)\.dailyAvailable \? "daily" : "reach"/);
  assert.match(app, /homeMenuState\(\)\.dailyAvailable \? "Play today’s word" : "Begin Bronze route"/);
  assert.match(app, /function handleLaunchIntent[\s\S]*!homeMenuState\(\)\.dailyReady[\s\S]*return false/);
  assert.match(app, /sharedChallenge\.mode === "daily" && !homeMenuState\(\)\.dailyReady/);
});

test("sharing is a core reward, while competitive and economy tools wait for ten wins", () => {
  const firstWin = createHomeMenuState({ wins: 1 });
  assert.equal(firstWin.sharingReady, true);
  assert.equal(firstWin.advancedReady, false);

  const ninthWin = createHomeMenuState({ wins: HOME_MENU_ADVANCED_WINS - 1 });
  assert.equal(ninthWin.focusMode, true);
  assert.equal(ninthWin.winsUntilAdvanced, 1);

  const tenthWin = createHomeMenuState({ wins: HOME_MENU_ADVANCED_WINS, routeRank: "gold" });
  assert.equal(tenthWin.focusMode, false);
  assert.equal(tenthWin.advancedReady, true);
  assert.equal(tenthWin.adventuresReady, true);

  assert.match(page, /id="createChallenge"[^>]+data-progressive="sharing"/);
  for (const id of ["leaderboardButton", "viewMastery", "marketButton", "startPremium"]) {
    assert.match(page, new RegExp(`id="${id}"[^>]+data-progressive="advanced"`));
  }
});

test("the home combines play-history gates with Route Rank gates", () => {
  assert.match(styles, /body:not\(\.choices-ready\) #modePicker/);
  assert.match(styles, /body:not\(\.explore-ready\) #exploreHub/);
  assert.match(styles, /body:not\(\.adventures-ready\) \[data-progressive="adventure"\]/);
  assert.match(styles, /body:not\(\.advanced-ready\) \[data-progressive="advanced"\]/);
  assert.match(homeMenuView, /\["progress", "sharing", "daily", "choices", "explore", "adventures", "advanced"\]/);
  assert.match(homeMenuView, /classList\.toggle\(`\$\{state\}-ready`, menu\[`\$\{state\}Ready`\]\)/);
  assert.match(homeMenuView, /classList[.]toggle\("daily-locked", menu[.]dailyLocked\)/);
  assert.match(homeMenuView, /card[.]dataset[.]homeMode === "daily" && !menu[.]dailyAvailable/);
  assert.match(app, /routeRank:\s*currentRouteRank\(\)/);
  assert.match(homeMenuView, /!menu\.rankReadyForAdvanced/);
  assert.match(homeMenuView, /winsUntilAdvanced/);
  assert.doesNotMatch(app, /classList[.]add\("intent-explore"\)/);
  assert.doesNotMatch(styles, /body[.]intent-explore #exploreHub/);
  assert.match(styles, /:is\([.]home-disclosure, [.]home-catalog\)[.]launch-intent/);
});

test("an early run keeps advanced board prompts and result metadata out of the core loop", () => {
  const start = app.slice(app.indexOf("function startWithGameNow"), app.indexOf("function pauseMenuAvailable"));
  assert.match(start, /state\.focusMode = homeMenuState\(\)\.focusMode/);
  assert.match(start, /classList\.toggle\("focus-orbit", state\.focusMode\)/);

  const expectedPair = app.slice(app.indexOf("function offerExpectedPairFeedback"), app.indexOf("async function submitExpectedPairFeedback"));
  const recipeRating = app.slice(app.indexOf("function offerRecipeFeedback"), app.indexOf("function recordLocalRecipeVote"));
  assert.match(expectedPair, /if \(state\.focusMode \|\|/);
  assert.match(recipeRating, /if \(state\.focusMode\) return/);

  const iq = app.slice(app.indexOf("function renderRunIq"), app.indexOf("function animateRunIq"));
  assert.match(iq, /els\.runIqHud\.hidden = !active \|\| state\.focusMode/);
  assert.match(app, /classList\.toggle\("focus-result", state\.focusMode\)/);
  assert.match(styles, /\.result-modal\.focus-result :is\(/);
  assert.match(styles, /\.rank-result-card/);
  assert.match(styles, /\.result-leaderboard/);
  assert.doesNotMatch(
    styles.slice(styles.indexOf(".result-modal.focus-result :is("), styles.indexOf(") { display: none !important; }", styles.indexOf(".result-modal.focus-result :is("))),
    /result-share/
  );
  assert.match(app, /mode === "explore" && !menu[.]exploreReady/);
  assert.match(app, /mode === "weekly" && !menu[.]adventuresReady/);
  assert.match(app, /function openJourneyHub[\s\S]*!homeMenuState\(\)[.]adventuresReady/);
});

test("early focus keeps Rank about progression and puts settings and privacy in Menu", () => {
  const profile = page.slice(page.indexOf('<dialog id="profileDialog"'), page.indexOf('<dialog id="recoveryDialog"'));
  const menu = page.slice(page.indexOf('id="hubMenuDialog"'), page.indexOf("</dialog>", page.indexOf('id="hubMenuDialog"')));
  assert.match(styles, /body\.focus-mode \.profile-more/);
  assert.doesNotMatch(profile, /profile-preferences|profile-data|profile-account/);
  assert.match(menu, /profile-preferences/);
  assert.match(menu, /profile-data/);
  assert.match(menu, /id="openObservatory"/);
});
