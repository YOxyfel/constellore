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
      kicker: "RECOMMENDED",
      title: "Ready to play?",
      description: "Your first target is Wall. We will show you how.",
      label: "Play",
      meta: "Wall",
      secondaryAction: "modes",
      secondaryLabel: "Choose game"
    };
  } else if (!training.completed && completedWins === 0) {
    primary = {
      action: "reach",
      kicker: "READY",
      title: "Make a new target word.",
      description: "There is no timer and no move limit.",
      label: "Play",
      meta: "No timer",
      secondaryAction: "training",
      secondaryLabel: "Learn how to play"
    };
  } else if (!bridgeComplete) {
    primary = {
      action: "second-orbit",
      kicker: "NEXT LESSON",
      title: "Make Mountain.",
      description: "Try a short game with one helpful hint.",
      label: "Play",
      meta: "Mountain",
      secondaryAction: "modes",
      secondaryLabel: "Choose game"
    };
  } else if (dailyAvailable) {
    primary = {
      action: "daily",
      kicker: "TODAY'S WORD",
      title: "Make today’s word.",
      description: "Everyone gets the same target.",
      label: "Play",
      meta: "Today’s target",
      secondaryAction: "modes",
      secondaryLabel: "Choose game"
    };
  } else {
    primary = {
      action: "reach",
      kicker: "READY",
      title: "Make a new target word.",
      description: "Play without a timer or move limit.",
      label: "Play",
      meta: "No timer",
      secondaryAction: "modes",
      secondaryLabel: "Choose game"
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
