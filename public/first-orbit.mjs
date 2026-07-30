const ROUTE = [
  {
    a: "Earth",
    b: "Water",
    word: "Mud",
    emoji: "🟤",
    category: "nature",
    title: "Make Mud",
    instruction: "Tap Earth, then tap Water.",
    tip: "Or drag one word onto the other."
  }
];

export const FIRST_ORBIT_ROUTE = Object.freeze(ROUTE.map((step) => Object.freeze({ ...step })));
export const FIRST_ORBIT_STARTERS = Object.freeze(["Earth", "Water", "Fire", "Air"]);
export const FIRST_ORBIT_TARGET = FIRST_ORBIT_ROUTE.at(-1).word;
export const FIRST_ORBIT_COMBINATION_COUNT = FIRST_ORBIT_ROUTE.length;

export function createFirstOrbitGame(universe) {
  return {
    mode: "training",
    modeName: "First Game",
    target: FIRST_ORBIT_TARGET,
    emoji: "\u{1F7E4}",
    starters: [...FIRST_ORBIT_STARTERS],
    seed: 101,
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

function pairMatches(a, b, step) {
  const pair = [wordKey(a), wordKey(b)].sort();
  const expected = [wordKey(step.a), wordKey(step.b)].sort();
  return pair[0] === expected[0] && pair[1] === expected[1];
}

function confirmedStep(entry, step) {
  return Boolean(entry)
    && pairMatches(entry.a, entry.b, step)
    && wordKey(entry.word) === wordKey(step.word)
    && !entry.revealed;
}

export function sanitizeFirstOrbitState(value) {
  return {
    seen: Boolean(value?.seen),
    completed: Boolean(value?.completed)
  };
}

export function firstOrbitProgress(history) {
  let index = 0;
  for (const entry of Array.isArray(history) ? history : []) {
    if (index < FIRST_ORBIT_ROUTE.length && confirmedStep(entry, FIRST_ORBIT_ROUTE[index])) index += 1;
  }
  const complete = index >= FIRST_ORBIT_ROUTE.length;
  const step = complete ? null : FIRST_ORBIT_ROUTE[index];
  return {
    index,
    total: FIRST_ORBIT_ROUTE.length,
    complete,
    step,
    spotlightWords: step ? [...new Set([step.a, step.b])] : [],
    percent: Math.round(index / FIRST_ORBIT_ROUTE.length * 100)
  };
}

export function resolveFirstOrbitCombination(a, b, history) {
  const progress = firstOrbitProgress(history);
  if (!progress.step || !pairMatches(a, b, progress.step)) return null;
  return {
    word: progress.step.word,
    emoji: progress.step.emoji,
    category: progress.step.category,
    note: "Made in the first lesson.",
    source: "training",
    completed: progress.index === progress.total - 1,
    ranked: false,
    division: "training"
  };
}

export function firstOrbitWrongPairMessage(history) {
  const progress = firstOrbitProgress(history);
  if (!progress.step) return "This lesson is complete.";
  return `Try ${progress.step.a} and ${progress.step.b}.`;
}
