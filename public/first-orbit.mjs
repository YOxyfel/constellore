const ROUTE = [
  {
    a: "Earth",
    b: "Water",
    word: "Mud",
    emoji: "🟤",
    category: "nature",
    title: "Make your first discovery",
    instruction: "Bring Earth and Water together to create Mud.",
    tip: "Drag one word onto the other, or tap both words."
  },
  {
    a: "Mud",
    b: "Fire",
    word: "Brick",
    emoji: "🧱",
    category: "structure",
    title: "Build with what you found",
    instruction: "Combine Mud with Fire to forge Brick.",
    tip: "New discoveries stay in your word tray and can be used again."
  },
  {
    a: "Brick",
    b: "Brick",
    word: "Wall",
    emoji: "🧱",
    category: "structure",
    title: "Use a word twice",
    instruction: "Place Brick twice, then combine the two Bricks into Wall.",
    tip: "Every discovered word can be summoned more than once."
  }
];

export const FIRST_ORBIT_ROUTE = Object.freeze(ROUTE.map((step) => Object.freeze({ ...step })));

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
    note: "Mapped in the First Orbit training constellation.",
    source: "training",
    completed: progress.index === progress.total - 1,
    ranked: false,
    division: "training"
  };
}

export function firstOrbitWrongPairMessage(history) {
  const progress = firstOrbitProgress(history);
  if (!progress.step) return "Your First Orbit is already complete.";
  return `Follow the training signal: combine ${progress.step.a} with ${progress.step.b}.`;
}
