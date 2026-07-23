import assert from "node:assert/strict";
import test from "node:test";
import { calculateStarscore } from "../game-services.mjs";
import { buildMissionBriefing, starscoreCeiling } from "../public/mission-briefing.mjs";

const baseGame = {
  mode: "reach",
  modeName: "Reach",
  target: "Telescope",
  emoji: "🔭",
  tier: 2,
  reward: 70,
  timeLimit: null,
  moveLimit: null,
  ranked: false,
  scoreEligible: true
};

test("mission briefings make the destination and win condition explicit", () => {
  const briefing = buildMissionBriefing(baseGame);
  assert.equal(briefing.target, "Telescope");
  assert.equal(briefing.instruction, "Combine words until one fusion creates Telescope.");
  assert.equal(briefing.limitValue, "No limit");
  assert.equal(briefing.rewardValue, "70 Stardust");
  assert.equal(briefing.scoringValue, "Practice");
  assert.match(briefing.interactionRule, /Drag one word onto another/);
  assert.match(briefing.fairnessNote, /Route Signals are score-safe/);
  assert.match(briefing.fairnessNote, /Compass and Gift keep reduced rewards in Open/);
  assert.match(briefing.fairnessNote, /Reveal becomes Study with 0 score/);
});

test("each competitive mode reports its real limit, base reward, and scoring policy", () => {
  const quick = buildMissionBriefing({ ...baseGame, mode: "quick", modeName: "Quick Orbit", timeLimit: 90, reward: 100, ranked: true });
  assert.equal(quick.limitValue, "90 seconds");
  assert.equal(quick.rewardValue, "100 Stardust");
  assert.equal(quick.scoringLabel, "MAX STARSCORE");
  assert.equal(quick.scoringValue, "110,000");
  assert.match(quick.scoringDetail, /25 per second/);

  const moves = buildMissionBriefing({ ...baseGame, mode: "moves", modeName: "Move Limit", moveLimit: 12, reward: 110, ranked: true });
  assert.equal(moves.limitValue, "12 fusions");
  assert.match(moves.modeRule, /limited moves/);

  const daily = buildMissionBriefing({ ...baseGame, mode: "daily", modeName: "Word of the Day", reward: 180, ranked: true });
  assert.equal(daily.limitValue, "One scored run");
  assert.equal(daily.rewardValue, "180 Stardust");

  const weekly = buildMissionBriefing({ ...baseGame, mode: "weekly", modeName: "Weekly Expedition", moveLimit: 14, reward: 130, stage: 2, stageCount: 3, ranked: true });
  assert.equal(weekly.limitValue, "14 fusions");
  assert.equal(weekly.limitDetail, "Expedition stage 3 of 3.");

  const challenge = buildMissionBriefing({ ...baseGame, mode: "challenge", modeName: "Friend Challenge", reward: 90 });
  assert.equal(challenge.rewardValue, "90 Stardust");
  assert.match(challenge.modeRule, /shared challenge/);
});

test("the displayed Starscore ceiling stays aligned with authoritative scoring", () => {
  for (let tier = 1; tier <= 5; tier += 1) {
    const game = { tier };
    assert.equal(starscoreCeiling(game), calculateStarscore({ game, moves: 0, elapsedSeconds: 0 }));
  }
});

test("local practice never claims a leaderboard score", () => {
  const briefing = buildMissionBriefing({ ...baseGame, mode: "quick", timeLimit: 90, ranked: true }, { localOnly: true });
  assert.equal(briefing.scoringValue, "Practice");
  assert.match(briefing.scoringDetail, /no leaderboard upload/i);
});

test("a previously forfeited official challenge is clearly shown as zero-score", () => {
  const briefing = buildMissionBriefing({ ...baseGame, mode: "quick", timeLimit: 90, ranked: false, scoreEligible: false, rewardEligible: false });
  assert.equal(briefing.scoringValue, "0 points");
  assert.equal(briefing.rewardValue, "0 Stardust");
  assert.match(briefing.scoringDetail, /already forfeited/i);
});

test("Second Orbit is score-free while Explore is presented as persistent Practice", () => {
  const second = buildMissionBriefing({
    ...baseGame,
    mode: "second-orbit",
    modeName: "Second Orbit",
    target: "Mountain",
    scoreEligible: false,
    rewardEligible: false
  });
  assert.equal(second.division.id, "study");
  assert.equal(second.scoringValue, "0 points");
  assert.match(second.modeRule, /three route fusions/i);

  const explore = buildMissionBriefing({
    ...baseGame,
    mode: "explore",
    modeName: "Explore",
    target: "Free exploration",
    ranked: false,
    scoreEligible: false,
    rewardEligible: false
  });
  assert.equal(explore.division.id, "practice");
  assert.equal(explore.scoringValue, "Unranked");
  assert.equal(explore.rewardValue, "No rewards");
  assert.match(explore.fairnessNote, /Ranked modes always begin again from Earth, Water, Fire, and Air/);
});
