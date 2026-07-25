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

test("mission briefings make the target and win condition explicit in plain words", () => {
  const briefing = buildMissionBriefing(baseGame);
  assert.equal(briefing.target, "Telescope");
  assert.equal(briefing.instruction, "Keep combining words until you make Telescope.");
  assert.equal(briefing.limitValue, "No time limit.");
  assert.equal(briefing.rewardValue, "70 Stardust");
  assert.equal(briefing.scoringValue, "Practice");
  assert.equal(briefing.interactionRule, "Drop one word onto another to combine them.");
  assert.equal(briefing.startValue, "You start with 4 words");
  assert.equal(briefing.startDetail, "Earth, Water, Fire, and Air");
  assert.match(briefing.fairnessNote, /score-safe/i);
  assert.match(briefing.fairnessNote, /reduced rewards/i);
  assert.match(briefing.fairnessNote, /0 score/i);
});

test("each competitive mode reports its real limit, base reward, and scoring policy", () => {
  const quick = buildMissionBriefing({ ...baseGame, mode: "quick", modeName: "Quick Orbit", timeLimit: 90, reward: 100, ranked: true });
  assert.equal(quick.limitValue, "90 seconds.");
  assert.equal(quick.rewardValue, "100 Stardust");
  assert.equal(quick.scoringLabel, "MAX STARSCORE");
  assert.equal(quick.scoringValue, "110,000");
  assert.match(quick.scoringDetail, /25 per second/);

  const moves = buildMissionBriefing({ ...baseGame, mode: "moves", modeName: "Move Limit", moveLimit: 12, reward: 110, ranked: true });
  assert.equal(moves.limitValue, "12 moves.");
  assert.match(moves.modeRule, /successful combination uses one move/i);

  const daily = buildMissionBriefing({ ...baseGame, mode: "daily", modeName: "Word of the Day", reward: 180, ranked: true });
  assert.equal(daily.limitValue, "One game today.");
  assert.equal(daily.rewardValue, "180 Stardust");

  const weekly = buildMissionBriefing({ ...baseGame, mode: "weekly", modeName: "Weekly Expedition", moveLimit: 14, reward: 130, stage: 2, stageCount: 3, ranked: true });
  assert.equal(weekly.limitValue, "14 moves.");
  assert.equal(weekly.limitDetail, "Game 3 of 3.");

  const challenge = buildMissionBriefing({ ...baseGame, mode: "challenge", modeName: "Friend Challenge", reward: 90 });
  assert.equal(challenge.rewardValue, "90 Stardust");
  assert.match(challenge.modeRule, /same target as your friend/i);
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
  assert.match(second.modeRule, /three combinations/i);

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
  assert.match(explore.fairnessNote, /starting words shown above/i);
});

test("the briefing lists the exact actual starting words without mode jargon", () => {
  const shuffled = buildMissionBriefing({
    ...baseGame,
    startProfile: {
      style: "shuffled",
      starters: ["Cloud", "Stone", "Energy", "Mud", "Cloud", "Rain"]
    }
  });
  assert.equal(shuffled.startStyle, "shuffled");
  assert.equal(shuffled.startValue, "You start with 5 words");
  assert.equal(shuffled.startDetail, "Cloud, Stone, Energy, Mud, and Rain");
  assert.doesNotMatch(shuffled.startValue, /shuffl|classic|frontier|loan/i);
  assert.match(shuffled.fairnessNote, /only for this game/i);

  const actualFallback = buildMissionBriefing({
    ...baseGame,
    startStyle: "shuffled",
    startProfile: {
      style: "classic",
      starters: ["Earth", "Water", "Fire", "Air"]
    }
  });
  assert.equal(actualFallback.startStyle, "classic");
  assert.equal(actualFallback.startDetail, "Earth, Water, Fire, and Air");
  assert.doesNotMatch(actualFallback.fairnessNote, /only for this game/i);
});
