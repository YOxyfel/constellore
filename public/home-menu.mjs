export const HOME_MENU_ADVANCED_WINS = 2;

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

export function createHomeMenuState({ firstOrbit, secondOrbit, wins, dailyCompleted, todayKey } = {}) {
  const training = normalizeTraining(firstOrbit);
  const bridge = normalizeTraining(secondOrbit);
  const completedWins = normalizeWins(wins);
  // Existing players who already earned a real win are never pushed backward
  // into newly-added onboarding. New players move through both short lessons.
  const bridgeComplete = bridge.completed || completedWins > 0;
  const onboardingComplete = (training.completed && bridgeComplete) || completedWins > 0;
  const progressReady = completedWins > 0;
  const adventuresReady = completedWins >= HOME_MENU_ADVANCED_WINS;
  const advancedReady = adventuresReady;
  const dailyAvailable = Boolean(todayKey) && dailyCompleted !== todayKey;

  let primary;
  if (!training.completed && completedWins === 0 && !training.seen) {
    primary = {
      action: "training",
      kicker: "RECOMMENDED · ABOUT 90 SECONDS",
      title: "Learn the game in three real combinations.",
      description: "Your target is Wall. Drag or tap words together and discover the short route at your own pace.",
      label: "Play First Orbit",
      meta: "TARGET: WALL · GUIDED · NO SCORE",
      secondaryAction: "reach",
      secondaryLabel: "Skip tutorial · Play relaxed"
    };
  } else if (!training.completed && completedWins === 0) {
    primary = {
      action: "reach",
      kicker: "READY WHEN YOU ARE",
      title: "Reach one word at your own pace.",
      description: "Start with four elements and combine toward a guaranteed reachable target. There is no timer or move limit.",
      label: "Start relaxed game",
      meta: "RANDOM TARGET · NO CLOCK · NO MOVE CAP",
      secondaryAction: "training",
      secondaryLabel: "Play the 90-second tutorial"
    };
  } else if (!bridgeComplete) {
    primary = {
      action: "second-orbit",
      kicker: "NEXT LESSON · ABOUT 2 MINUTES",
      title: "Reach Mountain with one gentle signal.",
      description: "You know the controls. Now follow a three-fusion route while every logical combination remains open.",
      label: "Play Second Orbit",
      meta: "TARGET: MOUNTAIN · FREE EXPERIMENTATION · NO SCORE",
      secondaryAction: "reach",
      secondaryLabel: "Skip lesson · play relaxed"
    };
  } else if (dailyAvailable) {
    primary = {
      action: "daily",
      kicker: "NEXT UP · TODAY'S WORD",
      title: "Reach today's shared target.",
      description: "Everyone gets the same destination. Your combinations, discoveries, and route are entirely your own.",
      label: "Play today's word",
      meta: "ONE DAILY TARGET · SCORE EXPLAINED BEFORE START",
      secondaryAction: "modes",
      secondaryLabel: "Choose another mode"
    };
  } else {
    primary = {
      action: "reach",
      kicker: "TODAY'S WORD COMPLETE · KEEP EXPLORING",
      title: "Follow a new route at your own pace.",
      description: "Reach gives you a guaranteed target with no clock and no move limit. Every logical discovery joins your universe.",
      label: "Start a relaxed game",
      meta: "RANDOM TARGET · NO CLOCK · NO MOVE CAP",
      secondaryAction: "modes",
      secondaryLabel: "Choose another mode"
    };
  }

  return {
    stage: !onboardingComplete ? "onboarding" : adventuresReady ? "established" : "core",
    onboardingComplete,
    progressReady,
    adventuresReady,
    advancedReady,
    primary
  };
}
