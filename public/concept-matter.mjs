import { createConceptReactionHistory } from "./concept-chemistry.mjs?v=5.0.0-beta.4";

export const CONCEPT_MATTER_VERSION = 1;
export const CONCEPT_MATTER_HOLD_MS = 480;
export const CONCEPT_MATTER_MAX_VISIBLE_GROUPS = 5;
export const CONCEPT_MATTER_MAX_FRACTURE_FRAGMENTS = 4;

export const CONCEPT_MATTER_REPRESENTATIONS = Object.freeze(["compound", "compact"]);
export const CONCEPT_MATTER_ACTIONS = Object.freeze(["inspect", "peel", "split", "fracture", "twist"]);

const ACTION_SET = new Set(CONCEPT_MATTER_ACTIONS);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanText(value, fallback = "", maximum = 180) {
  try {
    const normalized = String(value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
    return (normalized || fallback).slice(0, maximum);
  } catch {
    return fallback;
  }
}

function wordKey(value) {
  const source = record(value);
  return cleanText(source.word ?? source.label ?? source.name ?? value, "", 96).toLocaleLowerCase("en-US");
}

function identifier(value, fallback = "") {
  return cleanText(value, fallback, 180).replace(/[^a-z0-9:_-]+/giu, "-").replace(/^-+|-+$/gu, "") || fallback;
}

function hash32(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value ?? "")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value) || Object.isFrozen(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function boolean(value) {
  return value === true;
}

export function normalizeConceptMatterRepresentation(value) {
  return value === "compound" ? "compound" : "compact";
}

/**
 * One deny-by-default capability profile for every play surface. The browser
 * view never grants authoritative rewards; this object only decides which
 * reversible board transactions may be presented.
 */
export function conceptMatterCapabilities(sourceValue = {}) {
  const source = record(sourceValue);
  const mode = cleanText(source.mode || source.boardMode || source.gameplayMode, "ranked", 40).toLocaleLowerCase("en-US");
  const gameplayMode = cleanText(source.gameplayMode || mode, mode, 40).toLocaleLowerCase("en-US");
  const finished = boolean(source.finished);
  const reveal = boolean(source.reveal) || mode === "reveal";
  const multiplayer = boolean(source.multiplayer) || mode === "scramble" || gameplayMode === "scramble";
  const matchFinished = multiplayer && boolean(source.matchFinished);
  const tutorial = boolean(source.tutorial) || mode === "tutorial" || ["training", "second-orbit"].includes(gameplayMode);
  const sandbox = boolean(source.sandbox) || mode === "explore" || gameplayMode === "explore";
  const project = boolean(source.project) || mode === "project";
  const competitiveMode = ["daily", "weekly", "quick", "moves", "challenge", "scramble"].includes(gameplayMode);
  const competitive = multiplayer || competitiveMode || boolean(source.ranked) || boolean(source.leaderboardEligible);
  const inspect = !reveal && (!finished || matchFinished) && (!multiplayer || matchFinished);
  const scriptedTutorialEdit = tutorial && boolean(source.scriptedTutorialEdit);
  const projectRules = record(source.projectRules);

  let peel = false;
  let split = false;
  let fracture = false;
  let twist = false;
  let profile = "observational";

  if (inspect && sandbox && !competitive && source.scoreEligible !== true && source.rewardEligible !== true) {
    profile = "laboratory";
    peel = true;
    split = true;
    fracture = true;
    twist = true;
  } else if (inspect && project && !competitive) {
    profile = "authored-project";
    peel = projectRules.peel !== false;
    split = projectRules.split === true;
    fracture = projectRules.fracture === true;
    twist = projectRules.twist === true;
  } else if (inspect && tutorial) {
    profile = "tutorial";
    peel = scriptedTutorialEdit;
  } else if (inspect && !competitive && !multiplayer) {
    profile = "solo";
    peel = source.allowSoloPeel !== false;
  } else if (multiplayer) {
    profile = "arena";
  } else if (competitive) {
    profile = "competitive";
  }

  return deepFreeze({
    kind: "concept-matter-capabilities",
    version: CONCEPT_MATTER_VERSION,
    profile,
    mode,
    gameplayMode,
    inspect,
    peel,
    split,
    fracture,
    twist,
    merge: !finished && !reveal,
    destructive: split || fracture || twist,
    zeroRewardTransactions: true
  });
}

export function conceptMatterActionAllowed(capabilitiesValue, action) {
  const capabilities = record(capabilitiesValue);
  const key = cleanText(action, "", 32).toLocaleLowerCase("en-US");
  if (!ACTION_SET.has(key)) return false;
  return capabilities[key] === true;
}

function eventMaps(history) {
  const ledger = createConceptReactionHistory(history);
  return {
    ledger,
    byId: new Map(ledger.events.map((event) => [event.id, event])),
    byOutput: new Map(ledger.events.map((event) => [event.output.instanceId, event]))
  };
}

function selection(value) {
  const source = record(value);
  return {
    word: cleanText(source.word ?? value, "", 96),
    key: wordKey(source.word ?? value),
    instanceId: cleanText(source.instanceId ?? source.molecularMemoryInstanceId ?? source.id, "", 180)
  };
}

function selectedEventFor(maps, requested) {
  if (requested.instanceId && maps.byOutput.has(requested.instanceId)) return maps.byOutput.get(requested.instanceId);
  if (!requested.key) return null;
  return [...maps.ledger.events].reverse().find((event) => event.output.key === requested.key) || null;
}

function ancestryDepth(instanceId, byOutput, visiting = new Set()) {
  if (!instanceId || visiting.has(instanceId)) return 0;
  const event = byOutput.get(instanceId);
  if (!event) return 0;
  const next = new Set(visiting).add(instanceId);
  return 1 + Math.max(0, ...event.inputs.map((input) => ancestryDepth(input.instanceId, byOutput, next)));
}

export function conceptMatterContinuityInputIndex(eventValue, history = []) {
  const event = record(eventValue);
  const explicit = Number(event.continuityInputIndex);
  if (explicit === 0 || explicit === 1) return explicit;
  const { byOutput } = eventMaps(history);
  const depths = (Array.isArray(event.inputs) ? event.inputs : []).slice(0, 2)
    .map((input) => ancestryDepth(input?.instanceId, byOutput));
  return depths[1] > depths[0] ? 1 : 0;
}

function ancestorEvents(root, byOutput) {
  const ordered = [];
  const seen = new Set();
  const visit = (event) => {
    if (!event || seen.has(event.id)) return;
    seen.add(event.id);
    for (const input of event.inputs) visit(byOutput.get(input.instanceId));
    ordered.push(event);
  };
  visit(root);
  return ordered;
}

export function projectConceptMatterCompound({ history = [], concept = "", maxVisibleGroups = CONCEPT_MATTER_MAX_VISIBLE_GROUPS } = {}) {
  const maps = eventMaps(history);
  const requested = selection(concept);
  const event = selectedEventFor(maps, requested);
  const instanceId = event?.output.instanceId || requested.instanceId || (requested.key ? `origin:${requested.key}` : "");
  const word = event?.word || requested.word;
  const ancestry = event ? ancestorEvents(event, maps.byOutput) : [];
  const immediateInputs = event?.inputs?.map((input) => ({
    word: input.word,
    key: input.key,
    instanceId: input.instanceId,
    slot: input.slot
  })) || [];
  const visibleLimit = Math.max(2, Math.min(8, Number(maxVisibleGroups) || CONCEPT_MATTER_MAX_VISIBLE_GROUPS));
  return deepFreeze({
    kind: "concept-matter-compound",
    version: CONCEPT_MATTER_VERSION,
    word,
    key: wordKey(word),
    instanceId,
    derived: Boolean(event),
    reactionId: event?.id || null,
    recipeId: event?.recipeId || null,
    isomerId: event?.isomerId || null,
    immediateInputs,
    ancestryCount: ancestry.length,
    componentCount: event ? Math.max(2, ancestry.length + 1) : 1,
    hiddenGroupCount: Math.max(0, ancestry.length + 1 - visibleLimit),
    accessibleLabel: event
      ? `${word}, compound made from ${immediateInputs.map((input) => input.word).join(" and ")}. ${ancestry.length} recorded ${ancestry.length === 1 ? "reaction" : "reactions"}.`
      : `${word}, origin concept.`
  });
}

export function conceptMatterCutId(eventId, inputIndex) {
  const id = cleanText(eventId, "", 180);
  const index = Number(inputIndex);
  return id && (index === 0 || index === 1) ? `${id}:input:${index}` : "";
}

function authoredTwistKey({ selectedWord, cutEventWord, cutInputWord }) {
  return [selectedWord, cutEventWord, cutInputWord].map(wordKey).join("|");
}

/**
 * Small deterministic starter catalog. These are rearrangements of the
 * fragments that remain after cutting an interior Mud bond inside Brick.
 */
export const AUTHORED_FRACTURE_TWISTS = deepFreeze([
  {
    id: "brick-mud-earth-to-steam",
    selectedWord: "Brick",
    cutEventWord: "Mud",
    cutInputWord: "Earth",
    result: { word: "Steam", emoji: "♨️", category: "force", source: "fracture-twist", note: "Water and Fire rebind after Earth is released." }
  },
  {
    id: "brick-mud-water-to-lava",
    selectedWord: "Brick",
    cutEventWord: "Mud",
    cutInputWord: "Water",
    result: { word: "Lava", emoji: "🌋", category: "nature", source: "fracture-twist", note: "Earth and Fire rebind after Water is released." }
  }
]);

function twistIndex(source) {
  const rules = Array.isArray(source) ? source : AUTHORED_FRACTURE_TWISTS;
  return new Map(rules.map((rule) => [authoredTwistKey(rule), rule]));
}

function routeLocksCut({ routeGuide, selectedEvent, cutEvent }) {
  const guide = record(routeGuide);
  if (guide.strict !== true || guide.complete === true) return false;
  const protectedWords = new Set([
    guide.activeWord,
    guide.backboneWord,
    guide.backboneProduct,
    guide.expectedProduct
  ].map(wordKey).filter(Boolean));
  return protectedWords.has(selectedEvent?.output?.key) || protectedWords.has(cutEvent?.output?.key);
}

function cutKind({ selectedEvent, cutEvent, inputIndex, continuityIndex, twist }) {
  if (twist) return "twist";
  if (selectedEvent.id === cutEvent.id && inputIndex !== continuityIndex) return "peel";
  if (selectedEvent.id === cutEvent.id) return "split";
  return "fracture";
}

function actionReason(kind, capabilities, routeLocked) {
  if (routeLocked) return "This bond is stabilized by the active Concept Bond.";
  if (capabilities[kind] === true) return "";
  if (capabilities.profile === "arena") return "Compound editing is stabilized during Arena play.";
  if (capabilities.profile === "competitive") return "Inspect this bond now; editing is disabled in scored play.";
  if (capabilities.profile === "tutorial") return "This lesson has not introduced bond editing yet.";
  if (capabilities.profile === "authored-project") return "This project has not authored an outcome for that bond.";
  return "This bond is stable in the current mode.";
}

export function listConceptMatterCuts({
  history = [],
  concept = "",
  capabilities: capabilityValue = {},
  routeGuide = null,
  twistRules = AUTHORED_FRACTURE_TWISTS
} = {}) {
  const capabilities = record(capabilityValue).kind === "concept-matter-capabilities"
    ? capabilityValue
    : conceptMatterCapabilities(capabilityValue);
  const maps = eventMaps(history);
  const requested = selection(concept);
  const selectedEvent = selectedEventFor(maps, requested);
  if (!selectedEvent) return deepFreeze([]);
  const ancestry = ancestorEvents(selectedEvent, maps.byOutput);
  const twists = twistIndex(twistRules);
  const cuts = [];
  for (const cutEvent of ancestry.slice().reverse()) {
    const continuityIndex = conceptMatterContinuityInputIndex(cutEvent, maps.ledger);
    for (let inputIndex = 0; inputIndex < cutEvent.inputs.length; inputIndex += 1) {
      const input = cutEvent.inputs[inputIndex];
      const twist = twists.get(authoredTwistKey({
        selectedWord: selectedEvent.word,
        cutEventWord: cutEvent.word,
        cutInputWord: input.word
      })) || null;
      const kind = cutKind({ selectedEvent, cutEvent, inputIndex, continuityIndex, twist });
      const routeLocked = routeLocksCut({ routeGuide, selectedEvent, cutEvent });
      const enabled = capabilities.inspect === true && capabilities[kind] === true && !routeLocked;
      const counterpart = cutEvent.inputs[inputIndex === 0 ? 1 : 0];
      const outcomeLabel = kind === "peel"
        ? `Restore ${cutEvent.inputs[continuityIndex].word} and release ${input.word}`
        : kind === "twist"
          ? `Release ${input.word}; the remainder can rearrange`
          : `Separate ${input.word} from ${counterpart?.word || cutEvent.word}`;
      cuts.push(deepFreeze({
        id: conceptMatterCutId(cutEvent.id, inputIndex),
        kind,
        enabled,
        reason: enabled ? "" : actionReason(kind, capabilities, routeLocked),
        selectedInstanceId: selectedEvent.output.instanceId,
        selectedWord: selectedEvent.word,
        eventId: cutEvent.id,
        eventWord: cutEvent.word,
        inputIndex,
        input,
        counterpart,
        continuityInputIndex: continuityIndex,
        latest: cutEvent.id === selectedEvent.id,
        authoredOutcomeId: twist?.id || null,
        outcomeLabel
      }));
    }
  }
  return deepFreeze(cuts);
}

function dedupeFragments(fragments) {
  const seen = new Set();
  return fragments.filter((fragment) => {
    const id = cleanText(fragment?.instanceId, "", 180) || `${wordKey(fragment?.word)}:${seen.size}`;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function fracturedComponents(selectedEvent, cutEvent, byOutput) {
  const ancestry = ancestorEvents(selectedEvent, byOutput);
  const fragments = cutEvent.inputs.map((input) => ({ ...input, origin: "cut" }));
  let invalidatedInstanceId = cutEvent.output.instanceId;
  let started = false;
  for (const event of ancestry) {
    if (event.id === cutEvent.id) {
      started = true;
      continue;
    }
    if (!started) continue;
    const dependentIndex = event.inputs.findIndex((input) => input.instanceId === invalidatedInstanceId);
    if (dependentIndex < 0) continue;
    for (let index = 0; index < event.inputs.length; index += 1) {
      if (index === dependentIndex) continue;
      fragments.push({ ...event.inputs[index], origin: "released-branch" });
    }
    invalidatedInstanceId = event.output.instanceId;
  }
  return dedupeFragments(fragments);
}

export function planConceptMatterCut({
  history = [],
  concept = "",
  cutId = "",
  capabilities = {},
  routeGuide = null,
  twistRules = AUTHORED_FRACTURE_TWISTS
} = {}) {
  const cuts = listConceptMatterCuts({ history, concept, capabilities, routeGuide, twistRules });
  const cut = cuts.find((candidate) => candidate.id === cutId) || null;
  if (!cut) return deepFreeze({ allowed: false, code: "unknown-cut", message: "That bond is not part of this compound." });
  if (!cut.enabled) return deepFreeze({ allowed: false, code: "blocked", message: cut.reason, cut });
  const maps = eventMaps(history);
  const selectedEvent = maps.byOutput.get(cut.selectedInstanceId);
  const cutEvent = maps.byId.get(cut.eventId);
  if (!selectedEvent || !cutEvent) return deepFreeze({ allowed: false, code: "stale-cut", message: "The compound changed before that bond could be opened." });

  let fragments;
  let twist = null;
  if (cut.kind === "peel" || cut.kind === "split") {
    fragments = cutEvent.inputs.map((input) => ({ ...input, origin: cut.kind }));
  } else if (cut.kind === "twist") {
    const rule = twistIndex(twistRules).get(authoredTwistKey({
      selectedWord: selectedEvent.word,
      cutEventWord: cutEvent.word,
      cutInputWord: cut.input.word
    }));
    if (!rule) return deepFreeze({ allowed: false, code: "missing-authored-outcome", message: "This rearrangement has no authored outcome." });
    twist = { ...rule.result, authoredOutcomeId: rule.id };
    fragments = [
      { ...cut.input, origin: "released-cut" },
      { word: twist.word, key: wordKey(twist.word), instanceId: `fracture:${rule.id}:${hash32(cut.selectedInstanceId)}`, origin: "authored-twist", item: twist }
    ];
  } else {
    fragments = fracturedComponents(selectedEvent, cutEvent, maps.byOutput);
  }
  fragments = dedupeFragments(fragments);
  if (fragments.length < 2) return deepFreeze({ allowed: false, code: "unstable", message: "This bond cannot form two stable compounds." });
  if (fragments.length > CONCEPT_MATTER_MAX_FRACTURE_FRAGMENTS) {
    return deepFreeze({
      allowed: false,
      code: "too-complex",
      message: `This core supports ${fragments.length} fragments. Stabilize the molecule before opening it.`,
      cut
    });
  }
  return deepFreeze({
    allowed: true,
    code: cut.kind,
    kind: cut.kind,
    cut,
    selectedWord: selectedEvent.word,
    selectedInstanceId: selectedEvent.output.instanceId,
    fragments,
    twist,
    summary: cut.kind === "peel"
      ? `${selectedEvent.word} peels into ${fragments.map((fragment) => fragment.word).join(" + ")}.`
      : cut.kind === "twist"
        ? `${cut.input.word} is released; the remainder rearranges into ${twist.word}.`
        : `${selectedEvent.word} separates into ${fragments.map((fragment) => fragment.word).join(", ")}.`
  });
}

export function createConceptMatterOperation({ plan, sourceNode = {}, operationId = "", now = Date.now() } = {}) {
  if (!plan?.allowed) throw new TypeError("A successful concept-matter plan is required.");
  const id = identifier(operationId, `matter:${Math.max(0, Math.floor(Number(now) || Date.now()))}:${hash32(`${plan.selectedInstanceId}:${plan.cut.id}`)}`);
  return deepFreeze({
    id,
    version: CONCEPT_MATTER_VERSION,
    type: plan.kind,
    status: "open",
    sourceInstanceId: plan.selectedInstanceId,
    sourceWord: plan.selectedWord,
    sourceNodeId: sourceNode.id == null ? null : String(sourceNode.id),
    sourceMatterId: cleanText(sourceNode.conceptMatterMatterId ?? sourceNode.matterId, "", 180) || null,
    cutId: plan.cut.id,
    authoredOutcomeId: plan.twist?.authoredOutcomeId || null,
    fragmentTokens: plan.fragments.map((fragment, index) => `${id}:fragment:${index}:${hash32(fragment.instanceId || fragment.word)}`),
    fragments: plan.fragments.map((fragment) => ({
      word: cleanText(fragment.word, "", 96),
      instanceId: cleanText(fragment.instanceId, "", 180),
      origin: cleanText(fragment.origin, "fragment", 40)
    })),
    createdAt: Math.max(0, Math.floor(Number(now) || Date.now()))
  });
}

export function findConceptMatterReassembly({ operations = [], leftNode = null, rightNode = null } = {}) {
  const tokens = new Set([
    cleanText(leftNode?.conceptMatterFragmentToken, "", 240),
    cleanText(rightNode?.conceptMatterFragmentToken, "", 240)
  ].filter(Boolean));
  if (tokens.size !== 2) return null;
  for (const operation of [...(Array.isArray(operations) ? operations : [])].reverse()) {
    if (operation?.status !== "open" || operation?.type !== "peel" || !Array.isArray(operation.fragmentTokens) || operation.fragmentTokens.length !== 2) continue;
    if (operation.fragmentTokens.every((token) => tokens.has(token))) return operation;
  }
  return null;
}

export function settleConceptMatterOperation(operations = [], operationId = "", status = "reassembled", now = Date.now()) {
  const id = cleanText(operationId, "", 240);
  const nextStatus = ["reassembled", "undone", "superseded"].includes(status) ? status : "reassembled";
  return (Array.isArray(operations) ? operations : []).map((operation) => (
    operation?.id === id
      ? deepFreeze({ ...operation, status: nextStatus, settledAt: Math.max(0, Math.floor(Number(now) || Date.now())) })
      : operation
  ));
}

export function sanitizeConceptMatterState(value = {}) {
  const source = record(value);
  const operations = (Array.isArray(source.operations) ? source.operations : []).slice(-64).flatMap((operationValue) => {
    const operation = record(operationValue);
    const id = identifier(operation.id, "");
    const type = cleanText(operation.type, "", 24);
    if (!id || !["peel", "split", "fracture", "twist"].includes(type)) return [];
    return [{
      id,
      version: CONCEPT_MATTER_VERSION,
      type,
      status: ["open", "reassembled", "undone", "superseded"].includes(operation.status) ? operation.status : "open",
      sourceInstanceId: cleanText(operation.sourceInstanceId, "", 180),
      sourceWord: cleanText(operation.sourceWord, "", 96),
      sourceNodeId: operation.sourceNodeId == null ? null : String(operation.sourceNodeId).slice(0, 80),
      sourceMatterId: cleanText(operation.sourceMatterId, "", 180) || null,
      cutId: cleanText(operation.cutId, "", 240),
      authoredOutcomeId: cleanText(operation.authoredOutcomeId, "", 180) || null,
      fragmentTokens: (Array.isArray(operation.fragmentTokens) ? operation.fragmentTokens : []).slice(0, CONCEPT_MATTER_MAX_FRACTURE_FRAGMENTS).map((token) => cleanText(token, "", 240)).filter(Boolean),
      fragments: (Array.isArray(operation.fragments) ? operation.fragments : []).slice(0, CONCEPT_MATTER_MAX_FRACTURE_FRAGMENTS).map((fragment) => ({
        word: cleanText(fragment?.word, "", 96),
        instanceId: cleanText(fragment?.instanceId, "", 180),
        origin: cleanText(fragment?.origin, "fragment", 40)
      })).filter((fragment) => fragment.word),
      createdAt: Math.max(0, Math.floor(Number(operation.createdAt) || 0)),
      ...(Number(operation.settledAt) > 0 ? { settledAt: Math.floor(Number(operation.settledAt)) } : {})
    }];
  });
  return deepFreeze({
    version: CONCEPT_MATTER_VERSION,
    representation: normalizeConceptMatterRepresentation(source.representation),
    operations
  });
}
