import {
  FIRST_ORBIT_COMBINATION_COUNT,
  FIRST_ORBIT_TARGET
} from "./first-orbit.mjs?v=5.0.0-beta.4";

const MODE_RULES = {
  training: `Make ${FIRST_ORBIT_TARGET} in ${FIRST_ORBIT_COMBINATION_COUNT} combination${FIRST_ORBIT_COMBINATION_COUNT === 1 ? "" : "s"}.`,
  "second-orbit": "Make Mountain in three combinations.",
  explore: "There is no target, timer, or move limit.",
  reach: "There is no timer or move limit.",
  quick: "Make the target before time runs out.",
  moves: "Each successful combination uses one move.",
  daily: "You can finish today's word once.",
  weekly: "Finish this game within the move limit.",
  challenge: "Make the same target as your friend."
};

function positiveInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function startingWords(game) {
  for (const source of [game?.starters, game?.startProfile?.starters]) {
    if (!Array.isArray(source)) continue;
    const words = [];
    const seen = new Set();
    for (const candidate of source) {
      const word = String(candidate?.word ?? candidate ?? "").trim();
      const key = word.toLocaleLowerCase("en-US");
      if (!word || seen.has(key)) continue;
      seen.add(key);
      words.push(word);
      if (words.length === 6) break;
    }
    if (words.length) return words;
  }
  return ["Earth", "Water", "Fire", "Air"];
}

function readableWordList(words) {
  if (words.length < 2) return words[0] || "";
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(", ")}, and ${words.at(-1)}`;
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
  const starters = startingWords(game);
  const actualStartStyle = String(
    game?.startProfile?.style ?? game?.startStyle ?? "classic"
  ).trim().toLocaleLowerCase("en-US");
  const shuffledStart = actualStartStyle === "shuffled";

  let limitValue = mode === "explore" ? "Free play." : "No time limit.";
  let limitDetail = "Take as long as you want.";
  if (timeLimit) {
    limitValue = `${timeLimit} seconds.`;
    limitDetail = "The timer starts when you begin.";
  } else if (moveLimit) {
    limitValue = `${moveLimit} moves.`;
    limitDetail = mode === "weekly" && Number.isFinite(Number(game?.stage))
      ? `Game ${Number(game.stage) + 1} of ${positiveInteger(game?.stageCount, 3)}.`
      : "Only successful combinations use a move.";
  } else if (mode === "daily") {
    limitValue = "One game today.";
    limitDetail = "Finish today's target once.";
  }

  return {
    mode,
    modeLabel: modeName,
    target,
    division,
    emoji: String(game?.emoji || "✦"),
    instruction: mode === "explore"
      ? "Combine freely, without a target or timer. Your discoveries are saved for your next visit."
      : `Keep combining words until you make ${target}.`,
    interactionRule: "Drop one word onto another to combine them.",
    modeRule: MODE_RULES[mode] || MODE_RULES.reach,
    startStyle: shuffledStart ? "shuffled" : "classic",
    startValue: `You start with ${starters.length} ${starters.length === 1 ? "word" : "words"}`,
    startDetail: readableWordList(starters),
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
      ? "Explore keeps its own reusable inventory. Target games begin again from the starting words shown above."
      : scoringDisabled
      ? ["training", "second-orbit"].includes(mode)
        ? "Training uses the same combinations as the full game, but saves no rewards or leaderboard result."
        : "Play it as a Study orbit, or choose another mode for a fresh scored mission."
      : ranked
      ? `${shuffledStart ? "These starting words are only for this game and are not added to your collection. " : ""}Each Route Signal keeps 90% of the remaining maximum: 90%, then 81%, then 72.9% of score and rewards. Compass and Gift keep a reduced Open score; complete Reveal becomes Study with 0 score.`
      : `${shuffledStart ? "These starting words are only for this game and are not added to your collection. " : ""}Each Route Signal keeps 90% of the remaining maximum: 90%, then 81%, then 72.9% of rewards. Compass and Gift keep reduced rewards in Open; complete Reveal becomes Study with 0 score.`
  };
}
