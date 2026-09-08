export const HOME_MENU_SHARE_WINS = 1;
export const HOME_MENU_DAILY_WINS = 1;
export const HOME_MENU_CHOICES_WINS = 2;
export const HOME_MENU_EXPLORE_WINS = 3;
export const HOME_MENU_ADVANCED_WINS = 10;
export const HOME_MENU_DAILY_RANK = 1;
export const HOME_MENU_CHOICES_RANK = 3;
export const HOME_MENU_EXPLORE_RANK = 2;
export const HOME_MENU_ADVENTURES_RANK = 3;
export const HOME_MENU_ARENA_RANK = 2;
const ROUTE_RANK_NUMBERS = new Map([
  ["bronze", 1],
  ["silver", 2],
  ["gold", 3],
  ["diamond", 4],
  ["emerald", 5],
  ["sapphire", 6],
  ["ruby", 7],
  ["master", 8],
  ["grandmaster", 9],
  ["mythic", 10],
  ["legend", 11],
  ["cosmic", 12]
]);

export function pressureModesUnlocked(value) {
  return normalizeRouteRankNumber(value) >= HOME_MENU_CHOICES_RANK;
}

function normalizeTraining(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    seen: source.seen === true,
    completed: source.completed === true
  };
}

function normalizeWins(value) {
  const wins = Math.floor(Number(value) || 0);
  return Math.max(0, wins);
}

function normalizeRouteRankNumber(value) {
  const rank = value?.rank || value;
  const direct = Math.floor(Number(rank?.number));
  if (Number.isFinite(direct) && direct > 0) return Math.min(12, direct);
  const id = String(rank?.id || rank || "").trim().toLowerCase();
  return ROUTE_RANK_NUMBERS.get(id) || 1;
}

function recognizedRouteRankNumber(value) {
  const rank = value?.rank || value;
  const direct = Math.floor(Number(rank?.number));
  if (Number.isFinite(direct) && direct > 0) return Math.min(12, direct);
  const id = String(rank?.id || rank || "").trim().toLowerCase();
  return ROUTE_RANK_NUMBERS.get(id) || 0;
}

export function createHomeMenuState({ firstOrbit, secondOrbit, wins, routeRank, dailyCompleted, dailyPlayed, todayKey } = {}) {
  const training = normalizeTraining(firstOrbit);
  const bridge = normalizeTraining(secondOrbit);
  const completedWins = normalizeWins(wins);
  const routeRankNumber = normalizeRouteRankNumber(routeRank);
  const rankReadyForDaily = recognizedRouteRankNumber(routeRank) >= HOME_MENU_DAILY_RANK;
  // Existing players who already earned a real win are never pushed backward
  // into newly-added onboarding. New players move through both short lessons.
  const bridgeComplete = bridge.completed || completedWins > 0;
  const onboardingComplete = (training.completed && bridgeComplete) || completedWins > 0;
  const progressReady = completedWins > 0;
  const sharingReady = completedWins >= HOME_MENU_SHARE_WINS;
  const dailyReady = onboardingComplete
    && completedWins >= HOME_MENU_DAILY_WINS
    && rankReadyForDaily;
  const dailyLocked = !dailyReady;
  const arenaReady = onboardingComplete && routeRankNumber >= HOME_MENU_ARENA_RANK;
  const choicesReady = completedWins >= HOME_MENU_CHOICES_WINS
    && routeRankNumber >= HOME_MENU_CHOICES_RANK;
  const exploreReady = completedWins >= HOME_MENU_EXPLORE_WINS
    && routeRankNumber >= HOME_MENU_EXPLORE_RANK;
  const adventuresReady = completedWins >= HOME_MENU_ADVANCED_WINS
    && routeRankNumber >= HOME_MENU_ADVENTURES_RANK;
  const advancedReady = adventuresReady;
  const focusMode = !advancedReady;
  const dailyAvailable = dailyReady && Boolean(todayKey) && dailyCompleted !== todayKey;
  const dailyAttention = dailyAvailable && dailyPlayed !== todayKey;

  let primary;
  if (!training.completed && completedWins === 0) {
    primary = {
      action: "training",
      kicker: training.seen ? "Continue playing" : "Your first discovery",
      title: training.seen ? "Return to Mud" : "Make Mud",
      description: training.seen
        ? "Your first constellation is waiting."
        : "Combine Earth and Water to discover your first word.",
      label: training.seen ? "Continue playing" : "Start playing",
      meta: "Mud · 1 combination",
      secondaryAction: "modes",
      secondaryLabel: "Choose game"
    };
  } else if (!bridgeComplete) {
    primary = {
      action: "second-orbit",
      kicker: "Keep discovering",
      title: "Make Mountain",
      description: "A short guided route through your new universe.",
      label: "Continue",
      meta: "Mountain",
      secondaryAction: "modes",
      secondaryLabel: "Choose game"
    };
  } else {
    primary = {
      action: "reach",
      kicker: "A universe of possibilities",
      title: "Create something impossible",
      description: "Find the target at your own pace.",
      label: "Play a new game",
      meta: "No timer",
      secondaryAction: "modes",
      secondaryLabel: "Choose game"
    };
  }

  return {
    stage: !onboardingComplete ? "onboarding" : adventuresReady ? "established" : "core",
    onboardingComplete,
    progressReady,
    sharingReady,
    dailyReady,
    dailyLocked,
    dailyAvailable,
    dailyAttention,
    arenaReady,
    choicesReady,
    exploreReady,
    adventuresReady,
    advancedReady,
    focusMode,
    routeRankNumber,
    rankReadyForDaily,
    rankReadyForArena: routeRankNumber >= HOME_MENU_ARENA_RANK,
    rankReadyForChoices: routeRankNumber >= HOME_MENU_CHOICES_RANK,
    rankReadyForExplore: routeRankNumber >= HOME_MENU_EXPLORE_RANK,
    rankReadyForAdvanced: routeRankNumber >= HOME_MENU_ADVENTURES_RANK,
    winsUntilAdvanced: Math.max(0, HOME_MENU_ADVANCED_WINS - completedWins),
    primary
  };
}
