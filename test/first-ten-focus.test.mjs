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
const epicHome = await readFile(new URL("../public/epic-home.css", import.meta.url), "utf8");
const heroRecipes = await readFile(new URL("../public/hero-recipes.mjs", import.meta.url), "utf8");
const defaultProfile = await readFile(new URL("../public/default-profile.mjs", import.meta.url), "utf8");

test("the shared daily target waits for the first scored Bronze win", () => {
  const lessonsComplete = createHomeMenuState({
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true },
    wins: 0,
    routeRank: "bronze",
    dailyCompleted: "",
    dailyPlayed: "",
    todayKey: "2026-07-26"
  });

  assert.equal(lessonsComplete.primary.action, "reach");
  assert.equal(lessonsComplete.dailyReady, false);
  assert.equal(lessonsComplete.dailyLocked, true);
  assert.equal(lessonsComplete.dailyAvailable, false);
  assert.equal(lessonsComplete.dailyAttention, false);

  const firstScoredWin = createHomeMenuState({
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true },
    wins: 1,
    routeRank: "bronze",
    dailyCompleted: "",
    dailyPlayed: "",
    todayKey: "2026-07-26"
  });

  assert.equal(firstScoredWin.primary.action, "reach");
  assert.equal(firstScoredWin.dailyReady, true);
  assert.equal(firstScoredWin.dailyLocked, false);
  assert.equal(firstScoredWin.dailyAvailable, true);
  assert.equal(firstScoredWin.dailyAttention, true);
  assert.equal(firstScoredWin.choicesReady, false);
  assert.equal(firstScoredWin.exploreReady, false);
  assert.equal(firstScoredWin.adventuresReady, false);
  assert.equal(firstScoredWin.advancedReady, false);
  assert.equal(firstScoredWin.focusMode, true);

  assert.match(app, /mode === "daily" && !menu\.dailyReady/);
  assert.match(app, /Today’s Word unlocks after your first scored Bronze win\./);
  assert.doesNotMatch(app, /const nextMode = homeMenuState\(\)\.dailyAvailable \? "daily" : "reach"/);
  assert.doesNotMatch(app, /homeMenuState\(\)\.dailyAvailable \? "Play today’s word" : "Begin Bronze route"/);
  assert.match(app, /state\.resultAction = \(\) => void beginMode\("reach"\)/);
  assert.match(app, /function handleLaunchIntent[\s\S]*!homeMenuState\(\)\.dailyReady[\s\S]*return false/);
  assert.match(app, /sharedChallenge\.mode === "daily" && !homeMenuState\(\)\.dailyReady/);
});

test("today's word is an independent orbiting prompt that settles after a successful start", () => {
  const today = "2026-07-26";
  const played = createHomeMenuState({
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true },
    wins: 1,
    routeRank: "bronze",
    dailyCompleted: "",
    dailyPlayed: today,
    todayKey: today
  });
  assert.equal(played.primary.action, "reach");
  assert.equal(played.dailyAvailable, true);
  assert.equal(played.dailyAttention, false);

  const forge = page.slice(page.indexOf('<div class="hero-forge">'), page.indexOf('<section class="primary-orbit-panel"'));
  assert.match(forge, /id="dailyStarButton"[^>]+data-mode="daily"[^>]+hidden/);
  assert.match(forge, /Today’s word/);
  assert.match(homeMenuView, /dailyStar\.hidden = !menu\.dailyAttention/);
  assert.match(homeMenuView, /classList\.toggle\("daily-attention", menu\.dailyAttention\)/);
  assert.match(defaultProfile, /dailyPlayed:\s*""/);
  assert.match(app, /function markDailyPlayed\(\)[\s\S]*profile\.dailyPlayed = todayKey[\s\S]*saveProfile\(\{ cloud: false \}\)/);
  assert.match(app, /if \(state\.game\.mode === "daily"\) markDailyPlayed\(\)/);
  assert.match(app, /restored && game\.mode === "daily" && run\?\.activationPending !== true\) markDailyPlayed\(\)/);
  assert.match(app, /\[data-mode\][\s\S]*beginMode\(button\.dataset\.mode, \{ trigger: event\.currentTarget \}\)/);
  assert.match(app, /const trigger = options\.trigger \|\| fallbackButton;[\s\S]*const button = trigger \|\| fallbackButton/);

  assert.match(epicHome, /\.daily-star-launcher\s*\{[^}]*position:\s*absolute[^}]*min-height:\s*48px/s);
  assert.match(epicHome, /\.daily-star-launcher\.is-roaming\s*\{[^}]*position:\s*fixed[^}]*translate3d/s);
  assert.match(page, /class="daily-star-lane"[\s\S]*id="dailyStarButton"/);
  assert.match(epicHome, /@media \(max-width: 900px\)[\s\S]*\.daily-star-lane[\s\S]*display:\s*grid/);
  assert.match(epicHome, /\.daily-star-launcher\.is-guided\[data-motion="guided"\][\s\S]*daily-star-guided-arrival/);
  assert.match(heroRecipes, /matchMediaFn\("\(max-width: 900px\)"\)/);
  assert.match(heroRecipes, /launcher\.dataset\.motion = motionAllowed\(\) \? "guided" : "docked"/);
  assert.match(epicHome, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.daily-star-launcher__glyph[\s\S]*animation:\s*none !important/);
  assert.match(heroRecipes, /function createDailyStarMotion\(/);
  assert.match(heroRecipes, /prefers-reduced-motion: reduce/);
  assert.match(heroRecipes, /\["reduced", "off"\]\.includes\(body\?\.dataset\?\.cosmeticEffects\)/);
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
  assert.match(homeMenuView, /classList[.]toggle\("daily-attention", menu[.]dailyAttention\)/);
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
