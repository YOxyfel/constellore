const ROUTE = [
  {
    a: "Earth",
    b: "Fire",
    word: "Lava",
    title: "Make Lava",
    instruction: "Earth is useful. Try adding heat.",
    tip: "Choose Earth, then Fire to make Lava.",
    spotlightWords: ["Earth", "Fire"]
  },
  {
    a: "Lava",
    b: "Water",
    word: "Stone",
    title: "Make Stone",
    instruction: "Lava is useful. Try cooling it.",
    tip: "Choose your new Lava, then add Water.",
    spotlightWords: ["Lava", "Water"]
  },
  {
    a: "Stone",
    b: "Stone",
    word: "Mountain",
    title: "Make Mountain",
    instruction: "Stone is useful. Some things grow when doubled.",
    tip: "Place Stone twice. Combine the two copies.",
    spotlightWords: ["Stone"]
  }
];

export const SECOND_ORBIT_ROUTE = Object.freeze(ROUTE.map((step) => Object.freeze({
  ...step,
  spotlightWords: Object.freeze([...step.spotlightWords])
})));

export function createSecondOrbitGame(universe) {
  return {
    mode: "second-orbit",
    modeName: "Second Orbit \u00b7 Lesson",
    target: "Mountain",
    emoji: "\u26F0\uFE0F",
    starters: ["Earth", "Water", "Fire", "Air"],
    seed: 202,
    tier: 1,
    timeLimit: null,
    moveLimit: null,
    law: null,
    aiEnabled: false,
    universe,
    scoreEligible: false,
    rewardEligible: false,
    leaderboardEligible: false,
    ranked: false,
    training: true
  };
}

function wordKey(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function confirmedStep(entry, step) {
  if (!entry || entry.revealed) return false;
  const pair = [wordKey(entry.a), wordKey(entry.b)].sort();
  const expected = [wordKey(step.a), wordKey(step.b)].sort();
  return pair[0] === expected[0]
    && pair[1] === expected[1]
    && wordKey(entry.word) === wordKey(step.word);
}

export function sanitizeSecondOrbitState(value) {
  return {
    seen: Boolean(value?.seen),
    completed: Boolean(value?.completed)
  };
}

/**
 * Legacy snapshots may contain unrelated discoveries, so progress still scans
 * defensively. Live Second Orbit play now enforces this authored sequence.
 */
export function secondOrbitProgress(history) {
  let index = 0;
  for (const entry of Array.isArray(history) ? history : []) {
    if (index < SECOND_ORBIT_ROUTE.length && confirmedStep(entry, SECOND_ORBIT_ROUTE[index])) index += 1;
  }
  const complete = index >= SECOND_ORBIT_ROUTE.length;
  const step = complete ? null : SECOND_ORBIT_ROUTE[index];
  return {
    index,
    total: SECOND_ORBIT_ROUTE.length,
    complete,
    step,
    spotlightWords: step ? [...step.spotlightWords] : [],
    percent: Math.round(index / SECOND_ORBIT_ROUTE.length * 100)
  };
}
