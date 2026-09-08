export const CONCEPT_CHEMISTRY_VERSION = 1;

export const CONCEPT_CHEMISTRY_PAIR_KINDS = Object.freeze([
  "backbone",
  "reagent",
  "blocked",
  "free"
]);

export function isConceptChemistryGuide(value) {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.kind === "concept-chemistry-guide"
    && Number(value.version) === CONCEPT_CHEMISTRY_VERSION
  );
}

const MAX_WORD_LENGTH = 80;
const MAX_ROUTE_STEPS = 512;
const MAX_HISTORY_EVENTS = 2_048;
const REACTION_ROLES = new Set(["backbone", "reagent", "free"]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cleanWord(value) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value.word
    : value;
  if (typeof source !== "string") return "";
  try {
    return source
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, MAX_WORD_LENGTH);
  } catch {
    return "";
  }
}

function wordKey(value) {
  try {
    return cleanWord(value).toLocaleLowerCase("en-US");
  } catch {
    return "";
  }
}

function cleanIdentifier(value, maximum = 180) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  try {
    return String(value)
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, maximum);
  } catch {
    return "";
  }
}

function hash32(source) {
  let hash = 0x811c9dc5;
  for (const character of String(source)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function collectionValues(source, { mapKeys = false, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  try {
    if (Array.isArray(source)) return source.slice(0, maximum);
    if (source instanceof Set) return [...source.values()].slice(0, maximum);
    if (source instanceof Map) {
      return [...(mapKeys ? source.keys() : source.values())].slice(0, maximum);
    }
  } catch {
    return [];
  }
  return [];
}

/** Returns the order-independent key used by authored recipes and guide checks. */
export function conceptChemistryPairKey(a, b) {
  const left = wordKey(a);
  const right = wordKey(b);
  if (!left || !right) return "";
  return JSON.stringify([left, right].sort());
}

/** Distinguishes alternate derivations that produce the same concept. */
export function conceptChemistryRecipeKey(a, b, word) {
  const pairKey = conceptChemistryPairKey(a, b);
  const resultKey = wordKey(word);
  return pairKey && resultKey ? `${resultKey}=${pairKey}` : "";
}

function successfulReaction(value) {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.preview !== true
    && value.predicted !== true
    && value.future !== true
    && value.futureRecipe !== true
    && value.success !== false
    && value.accepted !== false
    && value.resolved !== false
    && value.performed !== false
  );
}

function rawReactionParts(value) {
  if (!successfulReaction(value)) return null;
  const rawInputs = Array.isArray(value.inputs) ? value.inputs : [];
  const resultValue = value.word
    ?? (value.output && typeof value.output === "object" ? value.output.word : value.output)
    ?? (value.result && typeof value.result === "object" ? value.result.word : value.result);
  const a = cleanWord(value.a ?? value.left ?? value.ingredients?.[0] ?? rawInputs[0]);
  const b = cleanWord(value.b ?? value.right ?? value.ingredients?.[1] ?? rawInputs[1]);
  const word = cleanWord(resultValue);
  const pairKey = conceptChemistryPairKey(a, b);
  const recipeKey = conceptChemistryRecipeKey(a, b, word);
  return a && b && word && pairKey && recipeKey
    ? { a, b, word, pairKey, recipeKey, rawInputs }
    : null;
}

function reactionSourceValues(source) {
  if (Array.isArray(source)) return source.slice(0, MAX_HISTORY_EVENTS);
  if (source && typeof source === "object" && Array.isArray(source.events)) {
    return source.events.slice(0, MAX_HISTORY_EVENTS);
  }
  return [];
}

function inputInstanceId(raw, rawInput, slot, key, latestByWord) {
  const direct = slot === "a" ? raw.aInstanceId : raw.bInstanceId;
  return cleanIdentifier(
    rawInput?.instanceId
    ?? rawInput?.id
    ?? direct
    ?? latestByWord.get(key)
    ?? `origin:${key}`
  );
}

function uniqueIdentifier(preferred, used, fallback) {
  const base = cleanIdentifier(preferred) || fallback;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}:${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function normalizeReactionEvents(source) {
  const events = [];
  const latestByWord = new Map();
  const usedEventIds = new Set();
  const usedOutputIds = new Set();

  for (const raw of reactionSourceValues(source)) {
    const parts = rawReactionParts(raw);
    if (!parts) continue;
    const sequence = events.length + 1;
    const resultKey = wordKey(parts.word);
    const recipeId = cleanIdentifier(raw.recipeId ?? raw.routeId)
      || `recipe:${hash32(parts.recipeKey)}`;
    const isomerId = `isomer:${hash32(parts.recipeKey)}`;
    const eventId = uniqueIdentifier(
      raw.id ?? raw.eventId,
      usedEventIds,
      `reaction:${sequence}:${hash32(parts.recipeKey)}`
    );
    const aKey = wordKey(parts.a);
    const bKey = wordKey(parts.b);
    const explicitContinuity = Number(raw.continuityInputIndex);
    const requestedContinuityWord = wordKey(raw.continuationWord ?? raw.continuityWord);
    const continuityInputIndex = explicitContinuity === 0 || explicitContinuity === 1
      ? explicitContinuity
      : requestedContinuityWord && requestedContinuityWord === bKey
        ? 1
        : 0;
    const inputs = [
      {
        slot: "a",
        word: parts.a,
        key: aKey,
        instanceId: inputInstanceId(raw, parts.rawInputs[0], "a", aKey, latestByWord),
        bondRole: continuityInputIndex === 0 ? "continuation" : "addition"
      },
      {
        slot: "b",
        word: parts.b,
        key: bKey,
        instanceId: inputInstanceId(raw, parts.rawInputs[1], "b", bKey, latestByWord),
        bondRole: continuityInputIndex === 1 ? "continuation" : "addition"
      }
    ];
    const outputInstanceId = uniqueIdentifier(
      raw.outputInstanceId
        ?? (raw.output && typeof raw.output === "object" ? raw.output.instanceId ?? raw.output.id : ""),
      usedOutputIds,
      `molecule:${sequence}:${resultKey}`
    );
    const roleValue = wordKey(raw.role ?? raw.classification);
    const role = REACTION_ROLES.has(roleValue) ? roleValue : "free";
    const createdAt = typeof raw.createdAt === "string" || Number.isFinite(raw.createdAt)
      ? raw.createdAt
      : null;
    const event = {
      id: eventId,
      type: "concept-reaction",
      version: CONCEPT_CHEMISTRY_VERSION,
      sequence,
      role,
      a: parts.a,
      b: parts.b,
      word: parts.word,
      pairKey: parts.pairKey,
      recipeKey: parts.recipeKey,
      recipeId,
      isomerId,
      routeStepId: cleanIdentifier(raw.routeStepId ?? raw.stepId) || null,
      source: cleanIdentifier(raw.source) || null,
      createdAt,
      continuityInputIndex,
      inputs,
      output: {
        word: parts.word,
        key: resultKey,
        instanceId: outputInstanceId
      }
    };
    events.push(deepFreeze(event));
    latestByWord.set(resultKey, outputInstanceId);
  }
  return events;
}

/**
 * Creates a serialization-safe, immutable reaction ledger. Every successful
 * reaction remains a distinct event, including repeated recipes.
 */
export function createConceptReactionHistory(source = []) {
  return deepFreeze({
    kind: "concept-reaction-history",
    version: CONCEPT_CHEMISTRY_VERSION,
    events: normalizeReactionEvents(source)
  });
}

/** Appends one performed reaction without mutating the previous ledger. */
export function appendConceptReaction(history = [], reaction = {}) {
  const current = createConceptReactionHistory(history);
  return createConceptReactionHistory([...current.events, reaction]);
}

function routeStep(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const a = cleanWord(value.a ?? value.inputs?.[0]);
  const b = cleanWord(value.b ?? value.inputs?.[1]);
  const word = cleanWord(value.word ?? value.output);
  const pairKey = conceptChemistryPairKey(a, b);
  const recipeKey = conceptChemistryRecipeKey(a, b, word);
  if (!a || !b || !word || !pairKey || !recipeKey) return null;
  const recipeId = cleanIdentifier(value.recipeId ?? value.routeId ?? value.id)
    || `recipe:${hash32(recipeKey)}`;
  return deepFreeze({
    id: `route:${index}:${hash32(`${recipeId}:${recipeKey}`)}`,
    index,
    a,
    b,
    word,
    aKey: wordKey(a),
    bKey: wordKey(b),
    resultKey: wordKey(word),
    pairKey,
    recipeKey,
    recipeId
  });
}

function sanitizeRoute(source) {
  const values = collectionValues(source, { maximum: MAX_ROUTE_STEPS });
  if (!values.length) return { steps: [], malformed: false, truncated: false };
  const steps = [];
  let malformed = false;
  for (let index = 0; index < values.length; index += 1) {
    const step = routeStep(values[index], index);
    if (!step) malformed = true;
    else steps.push(step);
  }
  return {
    steps,
    malformed,
    truncated: Array.isArray(source) && source.length > MAX_ROUTE_STEPS
  };
}

function addAvailable(index, value) {
  const word = cleanWord(value);
  const key = wordKey(word);
  if (key && !index.has(key)) index.set(key, word);
}

function availableWordIndex(source, history) {
  const index = new Map();
  if (source instanceof Map) {
    for (const [key, value] of source.entries()) {
      addAvailable(index, value);
      addAvailable(index, key);
    }
  } else {
    for (const value of collectionValues(source, { maximum: 1_500 })) addAvailable(index, value);
  }
  for (const event of history.events) {
    addAvailable(index, event.a);
    addAvailable(index, event.b);
    addAvailable(index, event.word);
  }
  return index;
}

function emptyDetour() {
  return {
    active: false,
    target: null,
    activeWord: null,
    requiredPartner: null,
    expectedProduct: null,
    remainingReactions: 0,
    allowedPair: null
  };
}

function guideBase({ strict, target, valid = false, complete = false, reason }) {
  return {
    kind: "concept-chemistry-guide",
    version: CONCEPT_CHEMISTRY_VERSION,
    strict,
    valid,
    complete,
    reason,
    target: target || null,
    activeWord: null,
    requiredPartner: null,
    expectedProduct: null,
    backboneWord: null,
    backboneRequiredPartner: null,
    backboneProduct: null,
    detour: emptyDetour(),
    allowedPair: null,
    remainingReactions: 0
  };
}

function invalidGuide({ strict, target, reason }) {
  return deepFreeze(guideBase({ strict, target, reason }));
}

function dependencyModel(steps, root, available) {
  const closure = new Map();
  const producerByUse = new Map();
  const missingOrigins = new Set();

  const producerBefore = (key, beforeIndex) => {
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      const candidate = steps[index];
      if (candidate.index >= beforeIndex || candidate.resultKey !== key) continue;
      return candidate;
    }
    return null;
  };

  const include = (step) => {
    if (closure.has(step.index)) return;
    closure.set(step.index, step);
    for (const key of [...new Set([step.aKey, step.bKey])]) {
      const producer = producerBefore(key, step.index);
      producerByUse.set(`${step.index}:${key}`, producer?.index ?? null);
      if (producer) include(producer);
      else if (!available.has(key)) missingOrigins.add(key);
    }
  };
  include(root);

  return {
    closure: [...closure.values()].sort((left, right) => left.index - right.index),
    producerByUse,
    missingOrigins
  };
}

function chosenProducer(model, step, ingredientKey) {
  const index = model.producerByUse.get(`${step.index}:${ingredientKey}`);
  return index == null ? null : model.closure.find((candidate) => candidate.index === index) || null;
}

function seedFor(model, available) {
  const first = model.closure[0];
  if (!first) return null;
  if (available.has(first.aKey)) return { key: first.aKey, word: first.a, producerIndex: null };
  if (available.has(first.bKey)) return { key: first.bKey, word: first.b, producerIndex: null };
  return null;
}

function consumerFor(model, currentKey, producerIndex) {
  return model.closure.find((step) => {
    for (const ingredientKey of [...new Set([step.aKey, step.bKey])]) {
      if (ingredientKey !== currentKey) continue;
      const selectedProducer = model.producerByUse.get(`${step.index}:${ingredientKey}`);
      if ((selectedProducer ?? null) === (producerIndex ?? null)) return true;
    }
    return false;
  }) || null;
}

function backboneFrontier(model, available, targetKey) {
  const seed = seedFor(model, available);
  if (!seed) return { valid: false, reason: "missing-backbone-origin" };
  let current = seed;
  const visited = new Set();

  while (!visited.has(`${current.key}:${current.producerIndex ?? "origin"}`)) {
    visited.add(`${current.key}:${current.producerIndex ?? "origin"}`);
    if (current.key === targetKey && available.has(targetKey)) {
      return { valid: true, complete: true, active: current, step: null };
    }
    const step = consumerFor(model, current.key, current.producerIndex);
    if (!step) {
      return available.has(targetKey)
        ? { valid: true, complete: true, active: current, step: null }
        : { valid: false, reason: "disconnected-backbone" };
    }
    if (!available.has(step.resultKey)) {
      return { valid: true, complete: false, active: current, step };
    }
    current = { key: step.resultKey, word: step.word, producerIndex: step.index };
  }
  return { valid: false, reason: "cyclic-backbone" };
}

function partnerFor(step, active) {
  if (step.aKey === active.key && step.bKey === active.key) return { key: active.key, word: active.word };
  if (step.aKey === active.key) return { key: step.bKey, word: step.b };
  if (step.bKey === active.key) return { key: step.aKey, word: step.a };
  return null;
}

function collectDependencies(model, step, result = new Map()) {
  if (!step || result.has(step.index)) return result;
  result.set(step.index, step);
  for (const key of [...new Set([step.aKey, step.bKey])]) {
    collectDependencies(model, chosenProducer(model, step, key), result);
  }
  return result;
}

function actionableDetour(model, backboneStep, partner, available) {
  const producer = chosenProducer(model, backboneStep, partner.key);
  if (!producer) return null;
  const dependencies = [...collectDependencies(model, producer).values()]
    .sort((left, right) => left.index - right.index);
  const unresolved = dependencies.filter((step) => !available.has(step.resultKey));
  const step = unresolved.find((candidate) => (
    available.has(candidate.aKey) && available.has(candidate.bKey)
  ));
  return step ? { step, remainingReactions: unresolved.length } : null;
}

function allowedPair(step, classification, continuationWord = step.a, additionWord = step.b) {
  return deepFreeze({
    classification,
    a: step.a,
    b: step.b,
    key: step.pairKey,
    product: step.word,
    continuationWord: cleanWord(continuationWord),
    additionWord: cleanWord(additionWord),
    stepId: step.id,
    recipeId: step.recipeId
  });
}

/**
 * Builds the only guide state needed by the current Bloom. `route` is the
 * server's ordered solutionRoute shape (`{ a, b, word, ... }`). Unrelated
 * trailing steps are ignored because only the target dependency closure is
 * inspected.
 *
 * The snapshot contains no hidden future route and is safe to JSON serialize.
 */
export function createConceptChemistryGuide({
  route = [],
  history = [],
  available = [],
  target = "",
  strict = true
} = {}) {
  const cleanTarget = cleanWord(target);
  const targetKey = wordKey(cleanTarget);
  const isStrict = strict === true;
  if (!isStrict) {
    return deepFreeze(guideBase({ strict: false, target: cleanTarget, valid: true, reason: "free-play" }));
  }
  if (!targetKey) return invalidGuide({ strict: true, target: cleanTarget, reason: "missing-target" });

  const reactionHistory = createConceptReactionHistory(history);
  const availableIndex = availableWordIndex(available, reactionHistory);
  const sanitized = sanitizeRoute(route);
  if (sanitized.malformed || sanitized.truncated) {
    return invalidGuide({ strict: true, target: cleanTarget, reason: "malformed-route" });
  }
  if (!sanitized.steps.length) {
    if (availableIndex.has(targetKey)) {
      return deepFreeze(guideBase({
        strict: true,
        target: cleanTarget,
        valid: true,
        complete: true,
        reason: "target-complete"
      }));
    }
    return invalidGuide({ strict: true, target: cleanTarget, reason: "missing-route" });
  }

  const pairResults = new Map();
  for (const step of sanitized.steps) {
    const prior = pairResults.get(step.pairKey);
    if (prior && prior !== step.resultKey) {
      return invalidGuide({ strict: true, target: cleanTarget, reason: "conflicting-route-pair" });
    }
    pairResults.set(step.pairKey, step.resultKey);
    if (step.resultKey === step.aKey || step.resultKey === step.bKey) {
      return invalidGuide({ strict: true, target: cleanTarget, reason: "cyclic-route" });
    }
  }

  const roots = sanitized.steps.filter((step) => step.resultKey === targetKey);
  const root = roots.at(-1);
  if (!root) return invalidGuide({ strict: true, target: cleanTarget, reason: "target-not-in-route" });
  const model = dependencyModel(sanitized.steps, root, availableIndex);
  if (model.missingOrigins.size) {
    return invalidGuide({ strict: true, target: cleanTarget, reason: "missing-route-origin" });
  }
  const frontier = backboneFrontier(model, availableIndex, targetKey);
  if (!frontier.valid) {
    return invalidGuide({ strict: true, target: cleanTarget, reason: frontier.reason });
  }
  const remainingReactions = model.closure.filter((step) => !availableIndex.has(step.resultKey)).length;
  if (frontier.complete || availableIndex.has(targetKey)) {
    return deepFreeze({
      ...guideBase({
        strict: true,
        target: cleanTarget,
        valid: true,
        complete: true,
        reason: "target-complete"
      }),
      activeWord: frontier.active?.word || cleanTarget,
      backboneWord: frontier.active?.word || cleanTarget,
      remainingReactions: 0
    });
  }

  const backboneStep = frontier.step;
  const partner = partnerFor(backboneStep, frontier.active);
  if (!partner) {
    return invalidGuide({ strict: true, target: cleanTarget, reason: "disconnected-backbone" });
  }
  const backbonePair = allowedPair(backboneStep, "backbone", frontier.active.word, partner.word);
  const base = {
    ...guideBase({ strict: true, target: cleanTarget, valid: true, reason: "backbone-ready" }),
    activeWord: frontier.active.word,
    requiredPartner: partner.word,
    expectedProduct: backboneStep.word,
    backboneWord: frontier.active.word,
    backboneRequiredPartner: partner.word,
    backboneProduct: backboneStep.word,
    allowedPair: backbonePair,
    remainingReactions
  };

  if (availableIndex.has(partner.key)) return deepFreeze(base);
  const detourAction = actionableDetour(model, backboneStep, partner, availableIndex);
  if (!detourAction) {
    return invalidGuide({ strict: true, target: cleanTarget, reason: "unbuildable-reagent" });
  }
  const sideStep = detourAction.step;
  const sidePair = allowedPair(sideStep, "reagent", sideStep.a, sideStep.b);
  return deepFreeze({
    ...base,
    reason: "reagent-detour",
    activeWord: sideStep.a,
    requiredPartner: sideStep.b,
    expectedProduct: sideStep.word,
    allowedPair: sidePair,
    detour: {
      active: true,
      target: partner.word,
      activeWord: sideStep.a,
      requiredPartner: sideStep.b,
      expectedProduct: sideStep.word,
      remainingReactions: detourAction.remainingReactions,
      allowedPair: sidePair
    }
  });
}

function pairingParts(pairing) {
  if (Array.isArray(pairing)) {
    return { a: cleanWord(pairing[0]), b: cleanWord(pairing[1]) };
  }
  return {
    a: cleanWord(pairing?.a ?? pairing?.left ?? pairing?.inputs?.[0]),
    b: cleanWord(pairing?.b ?? pairing?.right ?? pairing?.inputs?.[1])
  };
}

function pairDecision(guide, pairing, classification, reason, allowed) {
  const parts = pairingParts(pairing);
  const pairKey = conceptChemistryPairKey(parts.a, parts.b);
  const expectedProduct = cleanWord(guide?.expectedProduct) || null;
  const message = classification === "blocked"
    ? expectedProduct
      ? `Finish forming ${expectedProduct} first.`
      : "Finish the active reaction first."
    : "";
  return deepFreeze({
    classification,
    allowed,
    blocked: !allowed,
    action: allowed ? "allow" : "reject",
    reason,
    pairKey,
    activeWord: cleanWord(guide?.activeWord) || null,
    requiredPartner: cleanWord(guide?.requiredPartner) || null,
    expectedProduct,
    continuationWord: cleanWord(guide?.allowedPair?.continuationWord) || null,
    additionWord: cleanWord(guide?.allowedPair?.additionWord) || null,
    message
  });
}

/**
 * Classifies a proposed pair against one guide snapshot. Invalid/non-strict
 * guides fail open as `free`; a valid strict guide permits exactly one pair.
 */
export function evaluateConceptChemistryPair(guide, pairing) {
  const parts = pairingParts(pairing);
  const pairKey = conceptChemistryPairKey(parts.a, parts.b);
  if (!guide || typeof guide !== "object" || guide.kind !== "concept-chemistry-guide") {
    return pairDecision(guide, pairing, "free", "invalid-guide", true);
  }
  if (guide.strict !== true) return pairDecision(guide, pairing, "free", "free-play", true);
  if (guide.valid !== true) return pairDecision(guide, pairing, "free", "invalid-guide", true);
  if (guide.complete === true) return pairDecision(guide, pairing, "free", "target-complete", true);
  if (!pairKey) return pairDecision(guide, pairing, "blocked", "invalid-pair", false);

  const expectedKey = typeof guide.allowedPair?.key === "string" ? guide.allowedPair.key : "";
  const expectedKind = guide.allowedPair?.classification === "reagent" ? "reagent" : "backbone";
  if (expectedKey && pairKey === expectedKey) {
    return pairDecision(
      guide,
      pairing,
      expectedKind,
      expectedKind === "reagent" ? "authorized-reagent-detour" : "expected-backbone-pair",
      true
    );
  }
  return pairDecision(
    guide,
    pairing,
    "blocked",
    guide.detour?.active === true ? "finish-reagent-detour" : "finish-active-reaction",
    false
  );
}

function moleculeSelection(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      word: cleanWord(value.word),
      key: wordKey(value.word),
      instanceId: cleanIdentifier(value.instanceId ?? value.id)
    };
  }
  return { word: cleanWord(value), key: wordKey(value), instanceId: "" };
}

function isomerSummaries(events, resultKey) {
  const groups = new Map();
  for (const event of events) {
    if (event.output.key !== resultKey) continue;
    const group = groups.get(event.isomerId) || {
      id: event.isomerId,
      word: event.word,
      pairKey: event.pairKey,
      ingredients: [event.a, event.b],
      recipeIds: new Set(),
      eventIds: [],
      instanceIds: [],
      firstSequence: event.sequence,
      lastSequence: event.sequence
    };
    group.recipeIds.add(event.recipeId);
    group.eventIds.push(event.id);
    group.instanceIds.push(event.output.instanceId);
    group.lastSequence = event.sequence;
    groups.set(event.isomerId, group);
  }
  return [...groups.values()].map((group) => deepFreeze({
    id: group.id,
    word: group.word,
    pairKey: group.pairKey,
    ingredients: group.ingredients,
    recipeIds: [...group.recipeIds],
    eventIds: group.eventIds,
    instanceIds: group.instanceIds,
    count: group.eventIds.length,
    firstSequence: group.firstSequence,
    lastSequence: group.lastSequence
  }));
}

function provenanceStructure(events, selection) {
  const eventByOutput = new Map(events.map((event) => [event.output.instanceId, event]));
  const nodes = [];
  const bonds = [];
  const ancestry = [];
  const seenNodes = new Set();
  const seenEvents = new Set();

  const addConcept = (instanceId, word, origin, eventId = null) => {
    if (seenNodes.has(instanceId)) return;
    seenNodes.add(instanceId);
    nodes.push(deepFreeze({ id: instanceId, type: "concept", word, origin, eventId }));
  };

  const visitInstance = (instanceId, fallbackWord) => {
    const event = eventByOutput.get(instanceId);
    if (!event) {
      addConcept(instanceId, fallbackWord, true);
      return;
    }
    if (seenEvents.has(event.id)) return;
    seenEvents.add(event.id);
    for (const input of event.inputs) visitInstance(input.instanceId, input.word);
    addConcept(event.output.instanceId, event.word, false, event.id);
    const junctionId = `junction:${event.id}`;
    if (!seenNodes.has(junctionId)) {
      seenNodes.add(junctionId);
      nodes.push(deepFreeze({
        id: junctionId,
        type: "reaction",
        eventId: event.id,
        role: event.role,
        recipeId: event.recipeId,
        isomerId: event.isomerId
      }));
    }
    for (const input of event.inputs) {
      bonds.push(deepFreeze({
        id: `bond:${event.id}:${input.slot}`,
        from: input.instanceId,
        to: junctionId,
        type: "input",
        slot: input.slot,
        role: input.bondRole || "unknown",
        eventId: event.id
      }));
    }
    bonds.push(deepFreeze({
      id: `bond:${event.id}:output`,
      from: junctionId,
      to: event.output.instanceId,
      type: "output",
      slot: "output",
      eventId: event.id
    }));
    ancestry.push(event);
  };

  if (selection.instanceId) visitInstance(selection.instanceId, selection.word);
  ancestry.sort((left, right) => left.sequence - right.sequence);
  return deepFreeze({ nodes, bonds, events: ancestry });
}

/**
 * Projects one concept instance into a shared provenance DAG with reaction
 * junctions. Different ingredient pairs for the same output are exposed as
 * isomers; repeated uses of one instance remain shared rather than cloned.
 */
export function createMolecularMemory(history = [], concept = "") {
  const ledger = createConceptReactionHistory(history);
  const requested = moleculeSelection(concept);
  const byInstance = new Map(ledger.events.map((event) => [event.output.instanceId, event]));
  let selectedEvent = requested.instanceId ? byInstance.get(requested.instanceId) || null : null;
  const selectedKey = requested.key || selectedEvent?.output.key || "";
  if (!selectedEvent && selectedKey) {
    selectedEvent = [...ledger.events].reverse().find((event) => event.output.key === selectedKey) || null;
  }
  const word = selectedEvent?.word || requested.word;
  const key = selectedEvent?.output.key || selectedKey;
  const instanceId = selectedEvent?.output.instanceId
    || requested.instanceId
    || (key ? `origin:${key}` : "");
  const isomers = isomerSummaries(ledger.events, key);
  return deepFreeze({
    kind: "molecular-memory",
    version: CONCEPT_CHEMISTRY_VERSION,
    word: word || null,
    key: key || null,
    selectedInstanceId: instanceId || null,
    selectedIsomerId: selectedEvent?.isomerId || null,
    isomers,
    structure: provenanceStructure(ledger.events, {
      word,
      key,
      instanceId
    })
  });
}
