import { recipeKey } from "./recipe-mastery.mjs?v=5.0.0-beta.4";

export const WORLDWEAVING_VERSION = 1;
export const MOON_HOME_WORLD_UNLOCK_ANCHOR_ID = "power";

const WORLD_ID = "moon";
const MAX_TIMESTAMP_LENGTH = 40;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function authoredRecipe(a, b, word) {
  return { a, b, word, key: recipeKey(a, b, word) };
}

/**
 * The first Worldweaving chapter. Choice IDs and terminal recipes are durable
 * profile identifiers; presentation copy may change without migrating saves.
 */
export const MOON_WORLDWEAVING = deepFreeze({
  id: WORLD_ID,
  title: "The Moon",
  slots: [
    {
      id: "power",
      title: "Power",
      choices: [
        { id: "solar", title: "Solar Power", recipe: authoredRecipe("Sun", "Power", "Solar Power") },
        { id: "lunar", title: "Lunar Energy", recipe: authoredRecipe("Moon", "Energy", "Lunar Energy") }
      ]
    },
    {
      id: "shelter",
      title: "Shelter",
      choices: [
        { id: "bastion", title: "Bastion", recipe: authoredRecipe("Wall", "Wall", "House") },
        { id: "hive", title: "Hive", recipe: authoredRecipe("Room", "Room", "House") },
        { id: "haven", title: "Haven", recipe: authoredRecipe("Adobe", "Construction", "House") }
      ]
    },
    {
      id: "signal",
      title: "Signal",
      choices: [
        { id: "beacon", title: "Beacon", recipe: authoredRecipe("Light", "Light", "Laser") },
        { id: "stars", title: "Star Map", recipe: authoredRecipe("Sky", "Star", "Constellation") }
      ]
    }
  ],
  worldword: {
    id: "lander",
    title: "Lander",
    emoji: "🚀",
    category: "structure",
    recipe: authoredRecipe("Rocket", "Moon", "Lander")
  }
});

const SLOT_IDS = MOON_WORLDWEAVING.slots.map((slot) => slot.id);
const SLOT_BY_ID = new Map(MOON_WORLDWEAVING.slots.map((slot) => [slot.id, slot]));

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function cleanIdentifier(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .toLocaleLowerCase("en-US")
    .slice(0, 32);
}

function normalizedWord(value) {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US")
    .slice(0, 80);
}

function cleanTimestamp(value) {
  if (value instanceof Date && Number.isFinite(value.valueOf())) return value.toISOString();
  if (typeof value !== "string") return "";
  const candidate = value.trim().slice(0, MAX_TIMESTAMP_LENGTH);
  if (!candidate || !Number.isFinite(Date.parse(candidate))) return "";
  return new Date(candidate).toISOString();
}

function cloneRecipe(recipe) {
  return { key: recipe.key, a: recipe.a, b: recipe.b, word: recipe.word };
}

function cloneAnchor(anchor) {
  if (!anchor) return null;
  return {
    choiceId: anchor.choiceId,
    memory: cloneRecipe(anchor.memory),
    completedAt: anchor.completedAt
  };
}

function emptyMoonState() {
  return {
    anchors: { power: null, shelter: null, signal: null },
    completion: null,
    outcomeKey: "",
    worldword: null
  };
}

export function createWorldweavingState() {
  return { version: WORLDWEAVING_VERSION, worlds: { moon: emptyMoonState() } };
}

function choiceFor(slotId, choiceId) {
  const slot = SLOT_BY_ID.get(cleanIdentifier(slotId));
  if (!slot) return null;
  const id = cleanIdentifier(choiceId);
  return slot.choices.find((choice) => choice.id === id) || null;
}

function recipeSource(value) {
  const source = plainObject(value);
  if (!source) return null;
  return plainObject(source.memory)
    || plainObject(source.recipe)
    || plainObject(source.terminalRecipe)
    || source;
}

function recipeIdentity(source) {
  const value = recipeSource(source);
  if (!value) return null;
  const result = plainObject(value.result);
  const a = value.a ?? value.left ?? value.inputA ?? value.ingredients?.[0];
  const b = value.b ?? value.right ?? value.inputB ?? value.ingredients?.[1];
  const word = value.word ?? value.output ?? (typeof value.result === "string" ? value.result : result?.word);
  const key = recipeKey(a, b, word);
  return key ? { key, providedKey: typeof value.key === "string" ? value.key.trim() : "" } : null;
}

function rawMoon(raw) {
  const root = plainObject(raw);
  if (!root) return null;
  return plainObject(root.worlds)?.moon
    || plainObject(root.moon)
    || (root.anchors || root.slots ? root : null);
}

function rawAnchorFor(moon, slotId) {
  const anchors = plainObject(moon?.anchors);
  if (anchors) return anchors[slotId];
  for (const collection of [moon?.anchors, moon?.slots, moon?.memories]) {
    if (!Array.isArray(collection)) continue;
    const found = collection.slice(0, 12).find((entry) => {
      const source = plainObject(entry);
      return cleanIdentifier(source?.slotId ?? source?.anchorId ?? source?.slot) === slotId;
    });
    if (found) return found;
  }
  return null;
}

function sanitizeAnchor(source, slotId) {
  const raw = plainObject(source);
  if (!raw) return null;
  const identity = recipeIdentity(raw);
  if (!identity) return null;

  const suppliedChoice = cleanIdentifier(raw.choiceId ?? raw.interpretationId ?? raw.choice);
  const slot = SLOT_BY_ID.get(slotId);
  let choice = suppliedChoice ? choiceFor(slotId, suppliedChoice) : null;
  if (suppliedChoice && !choice) return null;
  if (!choice) choice = slot.choices.find((candidate) => candidate.recipe.key === identity.key) || null;
  if (!choice || identity.key !== choice.recipe.key) return null;
  if (identity.providedKey && identity.providedKey !== choice.recipe.key) return null;

  return {
    choiceId: choice.id,
    memory: cloneRecipe(choice.recipe),
    completedAt: cleanTimestamp(raw.completedAt ?? raw.at)
  };
}

function outcomeKeyFor(anchors) {
  if (SLOT_IDS.some((slotId) => !anchors[slotId])) return "";
  return `${WORLD_ID}:${SLOT_IDS.map((slotId) => anchors[slotId].choiceId).join(":")}`;
}

function worldwordFor(anchors, outcomeKey) {
  return {
    id: MOON_WORLDWEAVING.worldword.id,
    word: MOON_WORLDWEAVING.worldword.recipe.word,
    provenance: {
      kind: "worldweaving",
      worldId: WORLD_ID,
      outcomeKey,
      anchorKeys: SLOT_IDS.map((slotId) => anchors[slotId].memory.key),
      recipe: cloneRecipe(MOON_WORLDWEAVING.worldword.recipe)
    }
  };
}

function canonicalState(anchors, completionTimestamp = "") {
  const moon = emptyMoonState();
  let gapFound = false;
  for (const slotId of SLOT_IDS) {
    const anchor = gapFound ? null : cloneAnchor(anchors[slotId]);
    if (!anchor) gapFound = true;
    moon.anchors[slotId] = anchor;
  }
  const outcomeKey = outcomeKeyFor(moon.anchors);
  if (outcomeKey) {
    const finalTimestamp = cleanTimestamp(completionTimestamp)
      || moon.anchors.signal.completedAt;
    moon.completion = { completedAt: finalTimestamp };
    moon.outcomeKey = outcomeKey;
    moon.worldword = worldwordFor(moon.anchors, outcomeKey);
  }
  return { version: WORLDWEAVING_VERSION, worlds: { moon } };
}

/**
 * Migrates the small legacy shapes used during prototyping and returns only
 * authored Moon IDs, exact recipe receipts, and bounded timestamps. Later
 * anchors are discarded after the first missing or invalid sequential slot.
 */
export function sanitizeWorldweavingState(raw) {
  const moon = rawMoon(raw);
  if (!moon) return createWorldweavingState();
  const anchors = { power: null, shelter: null, signal: null };
  let gapFound = false;
  for (const slotId of SLOT_IDS) {
    const anchor = gapFound ? null : sanitizeAnchor(rawAnchorFor(moon, slotId), slotId);
    if (!anchor) gapFound = true;
    anchors[slotId] = anchor;
  }
  const completionTimestamp = cleanTimestamp(
    plainObject(moon.completion)?.completedAt
      ?? moon.completedAt
  );
  return canonicalState(anchors, completionTimestamp);
}

function anchorCount(state) {
  return SLOT_IDS.filter((slotId) => state.worlds.moon.anchors[slotId]).length;
}

function sameChoice(left, right) {
  return left?.choiceId === right?.choiceId;
}

function earlierTimestamp(left, right) {
  if (!left) return right || "";
  if (!right) return left;
  return left.localeCompare(right) <= 0 ? left : right;
}

/**
 * Monotonically merges a local and remote snapshot. Matching branches combine
 * their progress; a completed world beats an incomplete conflict. Other
 * branch conflicts default to remote unless `preferLocal` is explicitly set.
 */
export function mergeWorldweavingStates(localRaw, remoteRaw, { preferLocal = false } = {}) {
  const local = sanitizeWorldweavingState(localRaw);
  const remote = sanitizeWorldweavingState(remoteRaw);
  const localCount = anchorCount(local);
  const remoteCount = anchorCount(remote);
  if (localCount === SLOT_IDS.length && remoteCount !== SLOT_IDS.length) return local;
  if (remoteCount === SLOT_IDS.length && localCount !== SLOT_IDS.length) return remote;

  const commonCount = Math.min(localCount, remoteCount);
  const compatible = SLOT_IDS.slice(0, commonCount).every((slotId) => (
    sameChoice(local.worlds.moon.anchors[slotId], remote.worlds.moon.anchors[slotId])
  ));
  if (!compatible) return preferLocal ? local : remote;

  const longer = localCount > remoteCount ? local : remote;
  const anchors = { power: null, shelter: null, signal: null };
  for (const slotId of SLOT_IDS) {
    const left = local.worlds.moon.anchors[slotId];
    const right = remote.worlds.moon.anchors[slotId];
    if (left && right) {
      anchors[slotId] = cloneAnchor(left);
      anchors[slotId].completedAt = earlierTimestamp(left.completedAt, right.completedAt);
    } else {
      anchors[slotId] = cloneAnchor(longer.worlds.moon.anchors[slotId] || left || right);
    }
  }
  const completionTimestamp = earlierTimestamp(
    local.worlds.moon.completion?.completedAt,
    remote.worlds.moon.completion?.completedAt
  );
  return canonicalState(anchors, completionTimestamp);
}

export function moonWorldweavingContext(slotId, choiceId) {
  const slot = SLOT_BY_ID.get(cleanIdentifier(slotId));
  const choice = choiceFor(slot?.id, choiceId);
  if (!slot || !choice) return null;
  return {
    kind: "worldweaving",
    worldId: WORLD_ID,
    slotId: slot.id,
    choiceId: choice.id,
    target: choice.recipe.word
  };
}

export function normalizeWorldweavingContext(raw, target = "") {
  const source = plainObject(raw);
  if (!source || cleanIdentifier(source.kind) !== "worldweaving") return null;
  if (cleanIdentifier(source.worldId ?? source.world) !== WORLD_ID) return null;
  const context = moonWorldweavingContext(
    source.slotId ?? source.anchorId ?? source.slot,
    source.choiceId ?? source.interpretationId ?? source.choice
  );
  if (!context) return null;
  const suppliedTarget = normalizedWord(target || source.target);
  if (suppliedTarget && suppliedTarget !== normalizedWord(context.target)) return null;
  if (source.target && normalizedWord(source.target) !== normalizedWord(context.target)) return null;
  return context;
}

export function worldweavingObjective(raw, target = "") {
  const context = normalizeWorldweavingContext(raw, target);
  if (!context) return null;
  const choice = choiceFor(context.slotId, context.choiceId);
  return {
    kind: context.kind,
    worldId: context.worldId,
    slotId: context.slotId,
    choiceId: context.choiceId,
    target: choice.recipe.word,
    recipe: cloneRecipe(choice.recipe)
  };
}

export function recipeMatchesWorldweavingObjective(objective, step) {
  const expected = plainObject(objective)?.recipe;
  const actual = recipeIdentity(step);
  return Boolean(expected?.key && actual?.key && expected.key === actual.key);
}

function unchangedCompletion(state, reason, extras = {}) {
  return {
    state,
    advanced: false,
    reason,
    anchor: null,
    worldwordUnlocked: false,
    ...extras
  };
}

function completionBlockReason(step) {
  const source = cleanIdentifier(step?.source);
  const assist = cleanIdentifier(step?.assist);
  const division = cleanIdentifier(step?.division);
  if (step?.revealed === true || source === "reveal" || assist === "reveal") return "revealed";
  if (
    step?.study === true
    || step?.scoringDisabled === true
    || step?.scoreEligible === false
    || division === "study"
    || assist === "training"
  ) return "study";
  if (step?.worldweavingEligible === false) return "ineligible";
  return "";
}

/**
 * Commits exactly one current Moon slot from the terminal history receipt.
 * No run IDs, arbitrary context copy, or recursive ancestry enter the profile.
 */
export function recordWorldweavingCompletion(raw, { context, history, completedAt } = {}) {
  const state = sanitizeWorldweavingState(raw);
  const moon = state.worlds.moon;
  const normalizedContext = normalizeWorldweavingContext(context);
  if (!normalizedContext) return unchangedCompletion(state, "invalid_context");

  const requestedIndex = SLOT_IDS.indexOf(normalizedContext.slotId);
  const currentIndex = SLOT_IDS.findIndex((slotId) => !moon.anchors[slotId]);
  if (currentIndex < 0) return unchangedCompletion(state, "already_complete");
  if (requestedIndex < currentIndex) {
    const existing = moon.anchors[normalizedContext.slotId];
    return unchangedCompletion(
      state,
      existing?.choiceId === normalizedContext.choiceId ? "already_recorded" : "immutable_anchor",
      { anchor: cloneAnchor(existing) }
    );
  }
  if (requestedIndex > currentIndex) return unchangedCompletion(state, "out_of_order");

  const finalStep = Array.isArray(history) ? history.at(-1) : null;
  if (!plainObject(finalStep)) return unchangedCompletion(state, "missing_history");
  // `progressionEligible` governs rank/mastery rewards, not semantic memory.
  // Open assists and hints already pay through a reduced score and may still
  // shape a world. Reveal, Study, and an explicit domain veto may not.
  const blocked = completionBlockReason(finalStep);
  if (blocked) return unchangedCompletion(state, blocked);
  if (finalStep.routeCompleted === false) return unchangedCompletion(state, "incomplete_route");

  const objective = worldweavingObjective(normalizedContext, finalStep.word ?? finalStep.result?.word);
  if (!objective) return unchangedCompletion(state, "wrong_target");
  if (!recipeMatchesWorldweavingObjective(objective, finalStep)) {
    return unchangedCompletion(state, "wrong_recipe");
  }

  const nextAnchors = {
    power: cloneAnchor(moon.anchors.power),
    shelter: cloneAnchor(moon.anchors.shelter),
    signal: cloneAnchor(moon.anchors.signal)
  };
  const choice = choiceFor(normalizedContext.slotId, normalizedContext.choiceId);
  const anchor = {
    choiceId: choice.id,
    memory: cloneRecipe(choice.recipe),
    completedAt: cleanTimestamp(completedAt)
  };
  nextAnchors[normalizedContext.slotId] = anchor;
  const completesWorld = requestedIndex === SLOT_IDS.length - 1;
  const nextState = canonicalState(nextAnchors, completesWorld ? anchor.completedAt : "");
  return {
    state: nextState,
    advanced: true,
    reason: completesWorld ? "worldword_unlocked" : "advanced",
    anchor: cloneAnchor(anchor),
    worldwordUnlocked: completesWorld
  };
}

export function moonWorldweavingView(raw) {
  const state = sanitizeWorldweavingState(raw);
  const moon = state.worlds.moon;
  const completedAnchors = anchorCount(state);
  const currentSlotId = SLOT_IDS.find((slotId) => !moon.anchors[slotId]) || "";
  return {
    id: WORLD_ID,
    title: MOON_WORLDWEAVING.title,
    completed: completedAnchors === SLOT_IDS.length,
    completedAnchors,
    totalAnchors: SLOT_IDS.length,
    progress: completedAnchors / SLOT_IDS.length,
    currentSlotId,
    outcomeKey: moon.outcomeKey,
    completion: moon.completion ? { ...moon.completion } : null,
    slots: MOON_WORLDWEAVING.slots.map((slot) => {
      const anchor = moon.anchors[slot.id];
      const index = SLOT_IDS.indexOf(slot.id);
      return {
        id: slot.id,
        title: slot.title,
        status: anchor ? "anchored" : index === completedAnchors ? "current" : "locked",
        choiceId: anchor?.choiceId || "",
        memory: anchor ? cloneRecipe(anchor.memory) : null,
        completedAt: anchor?.completedAt || "",
        choices: slot.choices.map((choice) => ({
          id: choice.id,
          title: choice.title,
          target: choice.recipe.word,
          recipe: cloneRecipe(choice.recipe)
        }))
      };
    }),
    worldword: moon.worldword ? {
      id: moon.worldword.id,
      word: moon.worldword.word,
      provenance: {
        ...moon.worldword.provenance,
        anchorKeys: [...moon.worldword.provenance.anchorKeys],
        recipe: cloneRecipe(moon.worldword.provenance.recipe)
      }
    } : null
  };
}

/**
 * The Moon becomes an independently selectable Home world after the player
 * installs its first authored memory. Arrival remains a separate expedition
 * fact: this capability only says the Moon has become familiar enough to
 * revisit from Home without replaying departure.
 */
export function moonHomeWorldAccess(raw) {
  const state = sanitizeWorldweavingState(raw);
  const anchor = state.worlds.moon.anchors[MOON_HOME_WORLD_UNLOCK_ANCHOR_ID];
  return {
    worldId: WORLD_ID,
    unlocked: Boolean(anchor),
    milestoneId: MOON_HOME_WORLD_UNLOCK_ANCHOR_ID,
    completedAt: anchor?.completedAt || ""
  };
}

export function worldwordInventoryItem(raw) {
  const state = sanitizeWorldweavingState(raw);
  const worldword = state.worlds.moon.worldword;
  if (!worldword) return null;
  return {
    id: `worldword-${WORLD_ID}-${worldword.id}`,
    word: worldword.word,
    emoji: MOON_WORLDWEAVING.worldword.emoji,
    category: MOON_WORLDWEAVING.worldword.category,
    source: "worldweaving",
    provenance: {
      ...worldword.provenance,
      anchorKeys: [...worldword.provenance.anchorKeys],
      recipe: cloneRecipe(worldword.provenance.recipe)
    }
  };
}
