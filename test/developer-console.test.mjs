import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildConstellationCard } from "../public/constellation-card.mjs";
import {
  DEVELOPER_CONSOLE_VERSION,
  DEVELOPER_MODE_OPTIONS,
  DEVELOPER_RANK_OPTIONS,
  createDeveloperDifficultyState,
  createDeveloperRankPreset,
  createDeveloperShowcaseCardInput,
  developerModeAvailability,
  normalizeDeveloperDifficultyLevel,
  verifyDeveloperCredentials
} from "../public/developer-console.mjs";
import {
  ADAPTIVE_DIFFICULTY_VERSION,
  ADAPTIVE_LEVEL_MAX,
  ADAPTIVE_LEVEL_MIN
} from "../public/adaptive-difficulty.mjs";
import {
  REMIX_PROGRESSION_VERSION,
  REMIX_RANKS,
  sanitizeRemixProgressionState
} from "../public/remix-progression.mjs";

const [page, app, developerRuntime, styles] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/developer-console-runtime.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8")
]);
const releaseVersion = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
const releaseVersionPattern = releaseVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const developerSources = `${app}\n${developerRuntime}`;

test("developer credential verification is exact and returns only a boolean", () => {
  assert.equal(DEVELOPER_CONSOLE_VERSION, 1);
  assert.equal(verifyDeveloperCredentials("oxyfelcorp", "admin"), true);

  for (const [username, password] of [
    ["Oxyfelcorp", "admin"],
    ["oxyfelcorp ", "admin"],
    [" oxyfelcorp", "admin"],
    ["oxyfelcorp", "Admin"],
    ["oxyfelcorp", "admin "],
    ["oxyfelcorp", ""],
    ["", "admin"],
    [undefined, "admin"],
    ["oxyfelcorp", undefined],
    [{ toString: () => "oxyfelcorp" }, "admin"]
  ]) {
    assert.equal(verifyDeveloperCredentials(username, password), false);
  }
});

test("developer rank options canonically mirror all twelve remix ranks", () => {
  assert.equal(DEVELOPER_RANK_OPTIONS.length, 12);
  assert.equal(Object.isFrozen(DEVELOPER_RANK_OPTIONS), true);
  assert.equal(
    DEVELOPER_RANK_OPTIONS.every((rank) => Object.isFrozen(rank)),
    true
  );
  assert.deepEqual(
    DEVELOPER_RANK_OPTIONS.map((rank) => ({
      id: rank.id,
      name: rank.name,
      number: rank.number,
      masteryPoints: rank.masteryPoints,
      completedChallenges: rank.completedChallenges
    })),
    REMIX_RANKS.map((rank) => ({
      id: rank.id,
      name: rank.name,
      number: rank.number,
      masteryPoints: rank.masteryPoints,
      completedChallenges: rank.completedChallenges
    }))
  );
  assert.equal(DEVELOPER_RANK_OPTIONS[0].label, "01 · Bronze");
  assert.equal(DEVELOPER_RANK_OPTIONS.at(-1).label, "12 · Cosmic");
});

test("rank presets produce coherent progression and completed onboarding", () => {
  const expectedMinimumWins = [1, 3, 10, 15, 25, 40, 60, 85, 115, 150, 190, 240];

  for (const [index, rank] of REMIX_RANKS.entries()) {
    const preset = createDeveloperRankPreset(rank.id);
    assert.deepEqual(preset.rank, DEVELOPER_RANK_OPTIONS[index]);
    assert.notEqual(preset.rank, DEVELOPER_RANK_OPTIONS[index]);
    assert.equal(preset.minimumWins, expectedMinimumWins[index]);
    assert.equal(preset.onboardingComplete, true);
    assert.deepEqual(preset.firstOrbit, { seen: true, completed: true });
    assert.deepEqual(preset.secondOrbit, { seen: true, completed: true });
    assert.equal(preset.routeProgression.version, REMIX_PROGRESSION_VERSION);
    assert.equal(preset.routeProgression.rankId, rank.id);
    assert.equal(preset.routeProgression.masteryPoints, rank.masteryPoints);
    assert.ok(
      preset.routeProgression.completedChallenges >= rank.completedChallenges
    );
    assert.deepEqual(
      sanitizeRemixProgressionState(preset.routeProgression),
      preset.routeProgression
    );
  }
});

test("rank presets accept canonical ids, names, one-based numbers, and options", () => {
  assert.equal(createDeveloperRankPreset("gold").rank.id, "gold");
  assert.equal(createDeveloperRankPreset(" Gold ").rank.id, "gold");
  assert.equal(createDeveloperRankPreset("3").rank.id, "gold");
  assert.equal(createDeveloperRankPreset(3).rank.id, "gold");
  assert.equal(
    createDeveloperRankPreset(DEVELOPER_RANK_OPTIONS[2]).rank.id,
    "gold"
  );
  assert.equal(
    createDeveloperRankPreset({ rankId: "grandmaster" }).rank.id,
    "grandmaster"
  );
});

test("invalid developer ranks are refused instead of silently becoming Bronze", () => {
  for (const value of [
    undefined,
    null,
    "",
    "platinum",
    0,
    13,
    1.5,
    NaN,
    {},
    [],
    { id: "platinum" }
  ]) {
    assert.throws(
      () => createDeveloperRankPreset(value),
      RangeError
    );
  }
});

test("developer difficulty levels normalize to whole values from 1 through 10", () => {
  assert.equal(normalizeDeveloperDifficultyLevel(1), ADAPTIVE_LEVEL_MIN);
  assert.equal(normalizeDeveloperDifficultyLevel(10), ADAPTIVE_LEVEL_MAX);
  assert.equal(normalizeDeveloperDifficultyLevel(0), ADAPTIVE_LEVEL_MIN);
  assert.equal(normalizeDeveloperDifficultyLevel(-99), ADAPTIVE_LEVEL_MIN);
  assert.equal(normalizeDeveloperDifficultyLevel(99), ADAPTIVE_LEVEL_MAX);
  assert.equal(normalizeDeveloperDifficultyLevel("7"), 7);
  assert.equal(normalizeDeveloperDifficultyLevel(4.49), 4);
  assert.equal(normalizeDeveloperDifficultyLevel(4.5), 5);
  assert.equal(normalizeDeveloperDifficultyLevel("not-a-level"), 1);
  assert.equal(normalizeDeveloperDifficultyLevel(undefined, 6), 6);
  assert.equal(normalizeDeveloperDifficultyLevel(Infinity, 99), 10);
});

test("developer difficulty state resets adaptive history at the selected level", () => {
  const state = createDeveloperDifficultyState(8);
  assert.deepEqual(state, {
    version: ADAPTIVE_DIFFICULTY_VERSION,
    level: 8,
    failureStreak: 0,
    completedChallenges: 0,
    majorChallengePending: false,
    majorChallengeBaseLevel: null,
    recoveryLevel: null,
    recoveryStrict: false,
    recentTargets: []
  });
  assert.equal(createDeveloperDifficultyState(999).level, 10);
  assert.notEqual(createDeveloperDifficultyState(8), state);
});

test("developer mode options use stable ids and rank-aware availability", () => {
  assert.deepEqual(
    DEVELOPER_MODE_OPTIONS.map((mode) => mode.id),
    ["training", "reach", "daily", "quick", "moves", "explore", "weekly"]
  );
  assert.equal(Object.isFrozen(DEVELOPER_MODE_OPTIONS), true);

  const bronze = Object.fromEntries(
    developerModeAvailability("bronze").map((mode) => [mode.id, mode.available])
  );
  assert.deepEqual(bronze, {
    training: true,
    reach: true,
    daily: true,
    quick: false,
    moves: false,
    explore: false,
    weekly: false
  });

  const silver = Object.fromEntries(
    developerModeAvailability("silver").map((mode) => [mode.id, mode.available])
  );
  assert.deepEqual(silver, {
    training: true,
    reach: true,
    daily: true,
    quick: false,
    moves: false,
    explore: true,
    weekly: false
  });

  const gold = developerModeAvailability(createDeveloperRankPreset("gold"));
  assert.equal(gold.every((mode) => mode.available), true);
  assert.equal(gold.every((mode) => Object.isFrozen(mode)), true);
  assert.equal(Object.isFrozen(gold), true);
});

test("mode availability respects explicit onboarding and wins overrides", () => {
  const locked = developerModeAvailability({
    rank: "gold",
    wins: 10,
    onboardingComplete: false
  });
  assert.equal(locked.find((mode) => mode.id === "training").available, true);
  assert.equal(
    locked.filter((mode) => mode.id !== "training").every((mode) => !mode.available),
    true
  );
  assert.equal(
    locked.find((mode) => mode.id === "reach").reason,
    "Complete onboarding first."
  );

  const lowWins = developerModeAvailability({
    rank: "gold",
    wins: 1,
    onboardingComplete: true
  });
  assert.equal(lowWins.find((mode) => mode.id === "reach").available, true);
  assert.equal(lowWins.find((mode) => mode.id === "quick").available, false);
  assert.equal(lowWins.find((mode) => mode.id === "explore").available, false);
  assert.equal(lowWins.find((mode) => mode.id === "weekly").available, false);
});

test("showcase card fixture is deterministic, completed, and isolated per call", () => {
  const first = createDeveloperShowcaseCardInput();
  const second = createDeveloperShowcaseCardInput();
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.history, second.history);
  assert.notEqual(first.history[0], second.history[0]);
  assert.deepEqual(
    first.history.map((step) => step.word),
    ["Mud", "Brick", "Wall", "House"]
  );

  const card = buildConstellationCard(first);
  const repeated = buildConstellationCard(second);
  assert.deepEqual(card, repeated);
  assert.equal(card.target, "House");
  assert.equal(card.completed, true);
  assert.equal(card.realm, "structure");
  assert.equal(card.moves, 4);
  assert.deepEqual(card.milestones, ["Mud", "Brick", "Wall"]);

  first.history[0].word = "Changed";
  assert.equal(second.history[0].word, "Mud");
});

test("the local-only developer entry is release-hidden unless explicitly requested", () => {
  const trigger = page.match(/<button class="developer-menu-trigger"[^>]*id="developerMenuButton"[^>]*>/)?.[0] || "";
  assert.match(trigger, /aria-haspopup="dialog"/);
  assert.match(trigger, /aria-controls="developerLoginDialog developerDialog"/);
  assert.match(trigger, /\shidden/);

  const login = page.match(/<dialog id="developerLoginDialog"[\s\S]*?<\/dialog>/)?.[0] || "";
  assert.match(login, /aria-labelledby="developerLoginTitle"/);
  assert.match(login, /aria-describedby="developerLoginIntro"/);
  assert.match(login, /<label for="developerLoginName">Login name<\/label>/);
  assert.match(login, /id="developerLoginName"[^>]*type="text"[^>]*autocomplete="off"/);
  assert.match(login, /<label for="developerLoginPassword">Password<\/label>/);
  assert.match(login, /id="developerLoginPassword"[^>]*type="password"[^>]*autocomplete="off"/);
  assert.match(login, /id="developerLoginStatus" role="alert" aria-live="assertive"/);
  assert.match(login, /Credentials are never saved or sent/);

  assert.match(app, /new URLSearchParams\(window[.]location[.]search\)[.]get\("devtools"\) === "1"/);
  assert.match(app, /#developerMenuButton"\)[.]hidden = !developerToolsRequested/);
  assert.match(app, new RegExp(`import\\("\\./developer-console-runtime[.]mjs\\?v=${releaseVersionPattern}"\\)`));
  assert.match(developerRuntime, /function authorized\(\)\s*\{\s*return isStaticBeta && unlocked;/);
  assert.match(styles, /[.]developer-menu-trigger\s*\{[^}]*min-width:\s*44px;[^}]*height:\s*44px/);
});

test("the unlocked console exposes coherent rank, level, launch, showcase, and reset tools", () => {
  const dialog = page.match(/<dialog id="developerDialog"[\s\S]*?<\/dialog>/)?.[0] || "";
  assert.match(dialog, /aria-labelledby="developerTitle"/);
  assert.match(dialog, /Test runs stay local and unranked/);
  assert.match(dialog, /<select id="developerRank"><\/select>/);
  assert.match(dialog, /id="developerDifficulty" type="range" min="1" max="10" step="1"/);
  assert.equal((dialog.match(/data-developer-mode=/g) || []).length, 8);
  for (const mode of ["training", "second-orbit", "reach", "quick", "moves", "explore", "daily", "weekly"]) {
    assert.match(dialog, new RegExp(`data-developer-mode="${mode}"`));
  }
  assert.match(dialog, /id="showcaseShareCard"/);
  assert.match(dialog, /id="showcaseFirstWin"/);
  assert.match(dialog, /id="exportDeveloperSnapshot"/);
  assert.match(dialog, /id="resetDeveloperFreshStart"/);
  assert.match(dialog, /id="cancelDeveloperReset" type="button" hidden/);
  assert.match(dialog, /id="developerStatus" role="status" aria-live="polite"/);

  assert.match(developerSources, /profile[.]routeProgression = preset[.]routeProgression/);
  assert.match(developerSources, /profile[.]wins = preset[.]minimumWins/);
  assert.match(developerSources, /state[.]adaptiveDifficulty = createDeveloperDifficultyState\(level\)/);
  assert.match(developerSources, /stableHash\(`developer[|]\$\{routeRank[.]id\}[|]\$\{level\}[|]\$\{mode\}`\)/);
  assert.match(developerSources, /populateShare\(game, sample[.]completed, sample\)/);
  assert.match(developerSources, /kind: "first-orbit",[\s\S]*word: "Mud",[\s\S]*emoji: "🟤"/);
});

test("fresh-start reset is two-step, neutralizes the live run, clears only product keys, and reloads", () => {
  assert.match(developerSources, /resetArmedUntil = Date[.]now\(\) \+ 8000/);
  assert.match(developerSources, /Confirm erase and restart/);
  assert.match(developerSources, /key[.]startsWith\("constellore-"\) \|\| key[.]startsWith\("wordforge-"\)/);
  assert.doesNotMatch(developerSources, /localStorage[.]clear\(\)|sessionStorage[.]clear\(\)/);
  assert.match(developerSources, /state[.]finished = true;[\s\S]*state[.]game = null;[\s\S]*state[.]run = null;[\s\S]*state[.]pendingMission = null;[\s\S]*clearActiveRunSnapshot\(\);/);
  assert.match(developerSources, /clearConstelloreStorage\(localStorage\);[\s\S]*clearConstelloreStorage\(sessionStorage\);[\s\S]*unlocked = false;[\s\S]*reload\(\)/);
});
