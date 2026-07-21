const MODE_RULES = {
  reach: "There is no clock or move cap, so you can explore freely.",
  quick: "Reach the destination before the 90-second clock expires.",
  moves: "Every successful fusion uses one of your limited moves.",
  daily: "You get one scored completion of today's shared destination.",
  weekly: "Complete this stage within its move limit to continue the expedition.",
  challenge: "You are tracing the same target and universe as the shared challenge."
};

function positiveInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function starscoreCeiling(game) {
  const tier = Math.min(5, Math.max(1, positiveInteger(game?.tier, 1)));
  return 100_000 + tier * 5_000;
}

export function buildMissionBriefing(game, { localOnly = false } = {}) {
  const mode = String(game?.mode || "reach").toLowerCase();
  const modeName = String(game?.modeName || "Reach").trim() || "Reach";
  const target = String(game?.target || "the target").trim() || "the target";
  const timeLimit = positiveInteger(game?.timeLimit);
  const moveLimit = positiveInteger(game?.moveLimit);
  const reward = positiveInteger(game?.reward, 70);
  const tier = Math.min(5, Math.max(1, positiveInteger(game?.tier, 1)));
  const parMoves = 3 + tier * 3;
  const scoringDisabled = game?.scoreEligible === false || game?.rewardEligible === false;
  const ranked = Boolean(game?.ranked && !localOnly && !scoringDisabled);

  let limitValue = "No limit";
  let limitDetail = "Explore at your own pace.";
  if (timeLimit) {
    limitValue = `${timeLimit} seconds`;
    limitDetail = "The clock starts after this briefing.";
  } else if (moveLimit) {
    limitValue = `${moveLimit} fusions`;
    limitDetail = mode === "weekly" && Number.isFinite(Number(game?.stage))
      ? `Expedition stage ${Number(game.stage) + 1} of ${positiveInteger(game?.stageCount, 3)}.`
      : "Only successful combinations spend a move.";
  } else if (mode === "daily") {
    limitValue = "One scored run";
    limitDetail = "Complete today's destination once.";
  }

  return {
    mode,
    modeLabel: `${modeName.toUpperCase()} · MISSION BRIEF`,
    target,
    emoji: String(game?.emoji || "✦"),
    instruction: `Combine words until one fusion creates ${target}.`,
    interactionRule: "Drag one word onto another, or tap any two discovered words, to fuse them.",
    modeRule: MODE_RULES[mode] || MODE_RULES.reach,
    limitValue,
    limitDetail,
    rewardValue: scoringDisabled ? "0 Stardust" : `${reward} Stardust`,
    rewardDetail: scoringDisabled ? "This replay cannot earn progression rewards." : "Base reward; discoveries and mode bonuses can add more.",
    scoringLabel: ranked ? "MAX STARSCORE" : "SCORING",
    scoringValue: scoringDisabled ? "0 points" : ranked ? starscoreCeiling(game).toLocaleString("en-US") : "Practice",
    scoringDetail: scoringDisabled
      ? "This challenge was already forfeited; the replay stays unranked."
      : ranked
      ? `Lose 25 per second; each move after ${parMoves} costs 5,000.`
      : localOnly
        ? "Saved on this device; no leaderboard upload."
        : "This mode does not upload to a leaderboard.",
    fairnessNote: scoringDisabled
      ? "Play it as a study orbit, or choose another mode for a fresh scored mission."
      : ranked
      ? "A Wish moves the run to Open. Sense or Reveal turns score and rewards off."
      : "Sense or Reveal turns progression rewards off for this run."
  };
}
