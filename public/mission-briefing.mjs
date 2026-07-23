const MODE_RULES = {
  training: "Follow three guided fusions to learn the real board controls.",
  "second-orbit": "Reach Mountain in three route fusions. Other logical combinations remain available, so experimenting is safe.",
  explore: "There is no destination, score, clock, or move cap. Every discovery remains available when you return to Explore.",
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

export function missionDivision(game, { localOnly = false } = {}) {
  const mode = String(game?.mode || "reach").toLowerCase();
  const scoringDisabled = game?.scoreEligible === false || game?.rewardEligible === false;
  const assist = String(game?.assist || game?.division || "").toLowerCase();
  if (mode === "explore") {
    return {
      id: "practice",
      label: "PRACTICE",
      title: "A persistent, unranked sandbox",
      detail: localOnly ? "Progress stays on this device and no score is uploaded." : "Discoveries persist, but this mode never enters a leaderboard."
    };
  }
  if (mode === "training" || mode === "second-orbit" || scoringDisabled || assist === "study" || assist === "reveal") {
    return {
      id: "study",
      label: "STUDY",
      title: ["training", "second-orbit"].includes(mode) ? "Learn without score pressure" : "Learn from the complete route",
      detail: "This orbit earns 0 score and never enters a leaderboard."
    };
  }
  if (assist === "open" || (assist && !["none", "pure", "practice"].includes(assist))) {
    return {
      id: "open",
      label: "OPEN",
      title: "Assistance is declared",
      detail: "The exact Guidance reduction remains visible for the whole orbit."
    };
  }
  if (game?.ranked && !localOnly) {
    return {
      id: "pure",
      label: "PURE",
      title: "A verified competitive route",
      detail: "Score-changing Guidance moves this attempt to the separate Open division."
    };
  }
  return {
    id: "practice",
    label: "PRACTICE",
    title: "Explore without leaderboard pressure",
    detail: localOnly ? "Progress stays on this device and no score is uploaded." : "This route does not upload to a leaderboard."
  };
}

export function starscoreCeiling(game) {
  const tier = Math.min(5, Math.max(1, positiveInteger(game?.tier, 1)));
  return 100_000 + tier * 5_000;
}

export function buildMissionBriefing(game, { localOnly = false } = {}) {
  const mode = String(game?.mode || "reach").toLowerCase();
  const sandbox = mode === "explore";
  const modeName = String(game?.modeName || "Reach").trim() || "Reach";
  const target = String(game?.target || "the target").trim() || "the target";
  const timeLimit = positiveInteger(game?.timeLimit);
  const moveLimit = positiveInteger(game?.moveLimit);
  const reward = positiveInteger(game?.reward, 70);
  const tier = Math.min(5, Math.max(1, positiveInteger(game?.tier, 1)));
  const parMoves = 3 + tier * 3;
  const scoringDisabled = game?.scoreEligible === false || game?.rewardEligible === false;
  const ranked = Boolean(game?.ranked && !localOnly && !scoringDisabled);
  const division = missionDivision(game, { localOnly });

  let limitValue = mode === "explore" ? "Persistent sandbox" : "No limit";
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
    division,
    emoji: String(game?.emoji || "✦"),
    instruction: mode === "explore"
      ? "Combine any two meaningful ideas and grow a universe you can reuse in every Explore session."
      : `Combine words until one fusion creates ${target}.`,
    interactionRule: "Drag one word onto another, or tap any two discovered words, to fuse them.",
    modeRule: MODE_RULES[mode] || MODE_RULES.reach,
    limitValue,
    limitDetail,
    rewardValue: sandbox ? "No rewards" : scoringDisabled ? "0 Stardust" : `${reward} Stardust`,
    rewardDetail: sandbox
      ? "Explore discoveries persist, but this sandbox never grants score, rank, or Stardust."
      : scoringDisabled ? "This replay cannot earn progression rewards." : "Base reward; discoveries and mode bonuses can add more.",
    scoringLabel: ranked ? "MAX STARSCORE" : "SCORING",
    scoringValue: sandbox ? "Unranked" : scoringDisabled ? "0 points" : ranked ? starscoreCeiling(game).toLocaleString("en-US") : "Practice",
    scoringDetail: sandbox
      ? "Your reusable Explore universe stays separate from every ranked mission."
      : scoringDisabled
      ? ["training", "second-orbit"].includes(mode)
        ? `${mode === "training" ? "First" : "Second"} Orbit is always score-free and never changes your rank.`
        : "This challenge was already forfeited; the replay stays unranked."
      : ranked
      ? `Lose 25 per second; each move after ${parMoves} costs 5,000.`
      : localOnly
        ? "Saved on this device; no leaderboard upload."
        : "This mode does not upload to a leaderboard.",
    fairnessNote: sandbox
      ? "Explore keeps its own reusable inventory. Ranked modes always begin again from Earth, Water, Fire, and Air."
      : scoringDisabled
      ? ["training", "second-orbit"].includes(mode)
        ? "Training uses the same combinations as the full game, but saves no rewards or leaderboard result."
        : "Play it as a Study orbit, or choose another mode for a fresh scored mission."
      : ranked
      ? "Route Signals are score-safe. Compass and Gift keep a reduced Open score; complete Reveal becomes Study with 0 score."
      : "Route Signals are score-safe. Compass and Gift keep reduced rewards in Open; complete Reveal becomes Study with 0 score."
  };
}
