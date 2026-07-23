const ROUTE = [
  {
    a: "Earth",
    b: "Fire",
    word: "Lava",
    title: "Change the ground",
    instruction: "Route Signal: keep Earth in play. One starting element can heat it into something new.",
    tip: "This lesson no longer locks wrong pairs. Explore freely; the signal only points you forward.",
    spotlightWords: ["Earth"]
  },
  {
    a: "Lava",
    b: "Water",
    word: "Stone",
    title: "Cool what you created",
    instruction: "Route Signal: Lava is useful here. Pair it with a cooling starting element.",
    tip: "A discovered word can connect back to any of the four starting elements.",
    spotlightWords: ["Lava"]
  },
  {
    a: "Stone",
    b: "Stone",
    word: "Mountain",
    title: "Let the idea grow",
    instruction: "Route Signal: Stone is the final bridge. Some ideas become larger when doubled.",
    tip: "Summon Stone twice, then bring the copies together.",
    spotlightWords: ["Stone"]
  }
];

export const SECOND_ORBIT_ROUTE = Object.freeze(ROUTE.map((step) => Object.freeze({
  ...step,
  spotlightWords: Object.freeze([...step.spotlightWords])
})));

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
 * Unrelated discoveries are intentionally ignored. Second Orbit is a bridge
 * into free play, so the player can experiment without breaking the lesson.
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
