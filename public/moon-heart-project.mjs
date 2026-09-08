import { recipeKey } from "./recipe-mastery.mjs?v=5.0.0-beta.4";

export const MOON_PROJECTS_VERSION = 1;
export const MOON_HEART_CONTENT_VERSION = 1;
export const MOON_HEART_PROJECT_ID = "heart";
export const MOON_PROJECT_ENTRY_LIMIT = 8;
export const MOON_PROJECT_EVIDENCE_LIMIT = 64;
export const MOON_PROJECT_DECISION_LIMIT = 16;
export const MOON_PROJECT_REWARD_LIMIT = 32;

export const MOON_HEART_REWARD = Object.freeze({
  id: "heart-first-dawn",
  stardust: 300,
  capability: Object.freeze({
    id: "moonhaven-stewardship",
    name: "Moonhaven Stewardship"
  })
});

const WORLD_ID = "moon";
const DECISION_ID = "settlement-character";
const MAX_TIMESTAMP_LENGTH = 40;
const MAX_ROUTE_STEPS = 64;
const MAX_EVIDENCE_PER_MILESTONE = 4;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function finding(id, title, target, routeLength, clue, icon) {
  return { id, title, target, routeLength, clue, icon };
}

const HEART_CHAPTERS = deepFreeze([
  {
    id: "vital-systems",
    number: 1,
    title: "A Place That Can Breathe",
    question: "What does life need before it can call the Moon home?",
    settlementStage: 2,
    findings: [
      finding("living-spark", "A living spark", "Life", 2, "Wake the ground with a force that can become life.", "✶"),
      finding("held-sky", "A held sky", "Atmosphere", 5, "Build a world, then give its air something that can hold it close.", "◌"),
      finding("first-meal", "The first meal", "Food", 7, "Bring plant life and animal life into one sustaining idea.", "✦"),
      finding("living-habitat", "A living habitat", "Habitat", 5, "Make a place where life can keep living, not merely arrive.", "⌂")
    ]
  },
  {
    id: "first-rooms",
    number: 2,
    title: "When Shelter Becomes Home",
    question: "Which ideas turn protection into belonging?",
    settlementStage: 3,
    findings: [
      finding("first-brick", "The first brick", "Brick", 2, "Give wet earth a permanent shape.", "◇"),
      finding("boundary-wall", "A boundary that holds", "Wall", 3, "Join the first building material to itself.", "□"),
      finding("enclosed-house", "A room beneath the stars", "House", 4, "Let boundaries meet until they enclose a place.", "⌂"),
      finding("rooted-home", "A place that remembers us", "Home", 5, "Root a house in the world around it.", "♡")
    ]
  },
  {
    id: "settlement-character",
    number: 3,
    title: "What Should Grow Here?",
    question: "Will Moonhaven nurture life, craft, or fellowship first?",
    settlementStage: 4,
    decisionId: DECISION_ID,
    findings: [
      finding("cultivated-garden", "A cultivated future", "Garden", 3, "Let living things multiply with intention.", "✿"),
      finding("maker-factory", "A place that makes", "Factory", 3, "Join two engines into a place of patient industry.", "⚙"),
      finding("shared-community", "A reason to stay", "Community", 12, "Connect a population through a shared society.", "◉")
    ]
  },
  {
    id: "long-night",
    number: 4,
    title: "The Long Night",
    question: "Can the settlement endure what the Moon sends against it?",
    settlementStage: 5,
    findings: [
      finding("dust-warning", "Read the dust", "Dust Storm", 4, "Let a storm meet the bare ground.", "≋"),
      finding("falling-sky", "Watch the falling sky", "Meteor", 5, "Bring a star down toward the earth.", "☄"),
      finding("fortified-heart", "Reinforce the heart", "Fortress", 4, "Root a wall deeply enough to endure.", "△"),
      finding("green-return", "Make green return", "Greenhouse", 7, "Give fragile growth a house of its own.", "❋")
    ]
  }
]);

const HEART_FINALE = deepFreeze({
  id: "first-dawn",
  title: "First Dawn",
  target: "Settlement",
  routeLength: 10,
  clue: "Let homes and a living forest become somewhere people can remain.",
  icon: "✺"
});

const HEART_CHOICES = deepFreeze([
  {
    id: "garden",
    title: "The Garden",
    description: "Moonhaven begins as a conservatory: patient, living, and generous."
  },
  {
    id: "workshop",
    title: "The Workshop",
    description: "Moonhaven begins as a maker district: ingenious, practical, and always becoming."
  },
  {
    id: "commons",
    title: "The Commons",
    description: "Moonhaven begins around a shared hearth: welcoming, social, and remembered together."
  }
]);

const HEART_CONNECTIONS = deepFreeze([
  { id: "life-feeds-food", title: "Life feeds the table", targetFindingId: "first-meal", requiredWords: ["Life"] },
  { id: "life-fills-habitat", title: "Life fills a habitat", targetFindingId: "living-habitat", requiredWords: ["Life"] },
  { id: "brick-becomes-wall", title: "Brick becomes boundary", targetFindingId: "boundary-wall", requiredWords: ["Brick"] },
  { id: "wall-becomes-house", title: "Boundary becomes shelter", targetFindingId: "enclosed-house", requiredWords: ["Wall"] },
  { id: "house-becomes-home", title: "Shelter becomes belonging", targetFindingId: "rooted-home", requiredWords: ["House"] },
  { id: "life-meets-community", title: "Life becomes community", targetFindingId: "shared-community", requiredWords: ["Life", "House"] },
  { id: "garden-under-glass", title: "The garden survives beneath glass", targetFindingId: "green-return", requiredWords: ["Garden", "Glass"] },
  { id: "home-survives-storm", title: "The walls remember the storm", targetFindingId: "fortified-heart", requiredWords: ["Wall", "Dust Storm"] },
  { id: "roots-become-settlement", title: "Homes take root", targetFindingId: HEART_FINALE.id, requiredWords: ["House", "Forest"] }
]);

const FINDINGS = deepFreeze([
  ...HEART_CHAPTERS.flatMap((chapter) => chapter.findings.map((entry) => ({ ...entry, chapterId: chapter.id }))),
  { ...HEART_FINALE, chapterId: "finale", finale: true }
]);
const FINDING_BY_ID = new Map(FINDINGS.map((entry) => [entry.id, entry]));
const CHAPTER_BY_ID = new Map(HEART_CHAPTERS.map((entry) => [entry.id, entry]));
const CHOICE_BY_ID = new Map(HEART_CHOICES.map((entry) => [entry.id, entry]));
const CONNECTION_BY_ID = new Map(HEART_CONNECTIONS.map((entry) => [entry.id, entry]));

const HEART_CATALOG = deepFreeze({
  id: MOON_HEART_PROJECT_ID,
  contentVersion: MOON_HEART_CONTENT_VERSION,
  worldId: WORLD_ID,
  title: "The Heart",
  subtitle: "A Home Beneath No Sky",
  description: "Research what lunar life needs, decide what Moonhaven values, survive the long night, and build a settlement that can remember you.",
  chapters: HEART_CHAPTERS,
  finale: HEART_FINALE,
  decision: {
    id: DECISION_ID,
    title: "Choose Moonhaven's first character",
    description: "The choice changes the settlement's permanent identity, not the rules or reward value.",
    choices: HEART_CHOICES
  },
  connections: HEART_CONNECTIONS,
  reward: MOON_HEART_REWARD
});

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanText(value, maximum = 96) {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function normalizedWord(value) {
  return cleanText(value, 80).toLocaleLowerCase("en-US");
}

function cleanId(value, maximum = 64) {
  return normalizedWord(value).replace(/[^a-z0-9:_-]/g, "").slice(0, maximum);
}

function timestamp(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== "string" || value.length > MAX_TIMESTAMP_LENGTH) return "";
  const parsed = Date.parse(value.trim());
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function completedAt(value, fallback = new Date()) {
  return timestamp(value) || timestamp(fallback) || new Date().toISOString();
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function canonicalRecipeKey(value) {
  if (typeof value !== "string" || value.length > 260) return "";
  try {
    const parts = JSON.parse(value);
    if (!Array.isArray(parts) || parts.length !== 3 || parts.some((part) => typeof part !== "string")) return "";
    const canonical = recipeKey(parts[0], parts[1], parts[2]);
    return canonical === value ? canonical : "";
  } catch {
    return "";
  }
}

function recipeOutput(key) {
  try {
    const parts = JSON.parse(key);
    return Array.isArray(parts) && parts.length === 3 ? normalizedWord(parts[2]) : "";
  } catch {
    return "";
  }
}

function findingIdForMilestone(value) {
  const id = cleanId(value);
  const findingId = id.startsWith("finding:") ? id.slice(8) : "";
  return FINDING_BY_ID.has(findingId) ? findingId : "";
}

function connectionIdForMilestone(value) {
  const id = cleanId(value);
  const connectionId = id.startsWith("connection:") ? id.slice(11) : "";
  return CONNECTION_BY_ID.has(connectionId) ? connectionId : "";
}

function canonicalMilestoneId(value) {
  const findingId = findingIdForMilestone(value);
  if (findingId) return `finding:${findingId}`;
  const connectionId = connectionIdForMilestone(value);
  return connectionId ? `connection:${connectionId}` : "";
}

function targetForMilestone(milestoneId) {
  const findingId = findingIdForMilestone(milestoneId);
  if (findingId) return FINDING_BY_ID.get(findingId)?.target || "";
  const connectionId = connectionIdForMilestone(milestoneId);
  const connection = CONNECTION_BY_ID.get(connectionId);
  return FINDING_BY_ID.get(connection?.targetFindingId)?.target || "";
}

function canonicalRouteKey(value) {
  const clean = cleanText(value, 32).toLocaleLowerCase("en-US");
  return /^route:[a-z0-9]{7}$/.test(clean) ? clean : "";
}

function evidenceSort(left, right) {
  return left.milestoneId.localeCompare(right.milestoneId, "en")
    || left.recipeKey.localeCompare(right.recipeKey, "en")
    || left.routeKey.localeCompare(right.routeKey, "en")
    || left.completedAt.localeCompare(right.completedAt, "en");
}

function canonicalEvidence(value) {
  const source = record(value);
  const milestoneId = canonicalMilestoneId(source.milestoneId);
  const canonicalRecipe = canonicalRecipeKey(source.recipeKey);
  const routeKey = canonicalRouteKey(source.routeKey);
  const at = timestamp(source.completedAt);
  if (!milestoneId || !canonicalRecipe || !routeKey || !at) return null;
  if (recipeOutput(canonicalRecipe) !== normalizedWord(targetForMilestone(milestoneId))) return null;
  return { milestoneId, recipeKey: canonicalRecipe, routeKey, completedAt: at };
}

function sanitizeEvidence(raw) {
  const byIdentity = new Map();
  const counts = new Map();
  for (const value of (Array.isArray(raw) ? raw : []).slice(0, MOON_PROJECT_EVIDENCE_LIMIT * 3)) {
    const entry = canonicalEvidence(value);
    if (!entry) continue;
    const identity = `${entry.milestoneId}\u0000${entry.recipeKey}\u0000${entry.routeKey}`;
    const existing = byIdentity.get(identity);
    if (!existing || entry.completedAt < existing.completedAt) byIdentity.set(identity, entry);
  }
  return [...byIdentity.values()]
    .sort(evidenceSort)
    .filter((entry) => {
      const count = counts.get(entry.milestoneId) || 0;
      if (count >= MAX_EVIDENCE_PER_MILESTONE) return false;
      counts.set(entry.milestoneId, count + 1);
      return true;
    })
    .slice(0, MOON_PROJECT_EVIDENCE_LIMIT);
}

function canonicalDecision(value) {
  const source = record(value);
  const decisionId = cleanId(source.decisionId);
  const choiceId = cleanId(source.choiceId);
  const decidedAt = timestamp(source.decidedAt);
  if (decisionId !== DECISION_ID || !CHOICE_BY_ID.has(choiceId) || !decidedAt) return null;
  return { decisionId, choiceId, decidedAt };
}

function sanitizeDecisions(raw) {
  const byId = new Map();
  for (const value of (Array.isArray(raw) ? raw : []).slice(0, MOON_PROJECT_DECISION_LIMIT * 2)) {
    const entry = canonicalDecision(value);
    if (!entry) continue;
    const existing = byId.get(entry.decisionId);
    if (!existing || entry.decidedAt < existing.decidedAt || (entry.decidedAt === existing.decidedAt && entry.choiceId < existing.choiceId)) {
      byId.set(entry.decisionId, entry);
    }
  }
  return [...byId.values()]
    .sort((left, right) => left.decisionId.localeCompare(right.decisionId, "en"))
    .slice(0, MOON_PROJECT_DECISION_LIMIT);
}

function canonicalReward(value) {
  const source = record(value);
  const rewardId = cleanId(source.rewardId);
  const claimedAt = timestamp(source.claimedAt);
  return rewardId === MOON_HEART_REWARD.id && claimedAt ? { rewardId, claimedAt } : null;
}

function sanitizeRewards(raw) {
  const byId = new Map();
  for (const value of (Array.isArray(raw) ? raw : []).slice(0, MOON_PROJECT_REWARD_LIMIT * 2)) {
    const entry = canonicalReward(value);
    if (!entry) continue;
    const existing = byId.get(entry.rewardId);
    if (!existing || entry.claimedAt < existing.claimedAt) byId.set(entry.rewardId, entry);
  }
  return [...byId.values()]
    .sort((left, right) => left.rewardId.localeCompare(right.rewardId, "en"))
    .slice(0, MOON_PROJECT_REWARD_LIMIT);
}

function emptyHeartEntry() {
  return {
    id: MOON_HEART_PROJECT_ID,
    contentVersion: MOON_HEART_CONTENT_VERSION,
    evidence: [],
    decisions: [],
    rewards: [],
    completedAt: ""
  };
}

function findingEvidenceSet(entry) {
  return new Set(entry.evidence
    .map((evidence) => findingIdForMilestone(evidence.milestoneId))
    .filter(Boolean));
}

function coreCompletion(entry) {
  const found = findingEvidenceSet(entry);
  const chaptersComplete = HEART_CHAPTERS.every((chapter) => chapter.findings.every((finding) => found.has(finding.id)));
  const decisionComplete = entry.decisions.some((decision) => decision.decisionId === DECISION_ID);
  const finaleComplete = found.has(HEART_FINALE.id);
  return { chaptersComplete, decisionComplete, finaleComplete, complete: chaptersComplete && decisionComplete && finaleComplete };
}

function canonicalHeartEntry(value) {
  const source = record(value);
  const entry = emptyHeartEntry();
  entry.evidence = sanitizeEvidence(source.evidence);
  entry.decisions = sanitizeDecisions(source.decisions);
  const completion = coreCompletion(entry);
  entry.completedAt = completion.complete ? timestamp(source.completedAt) : "";
  entry.rewards = completion.complete ? sanitizeRewards(source.rewards) : [];
  return entry;
}

function emptyState() {
  return { version: MOON_PROJECTS_VERSION, entries: [emptyHeartEntry()] };
}

export function createMoonProjectsState(_options = {}) {
  return emptyState();
}

/** Projects are strict, bounded receipts. Unknown projects and fields never survive. */
export function sanitizeMoonProjectsState(raw, _options = {}) {
  const source = record(raw);
  const entries = Array.isArray(source.entries) ? source.entries : [];
  const heart = entries.find((entry) => cleanId(entry?.id) === MOON_HEART_PROJECT_ID);
  return {
    version: MOON_PROJECTS_VERSION,
    entries: [canonicalHeartEntry(heart)]
  };
}

function appendMissingReceipts(winner, loser, identity) {
  const occupied = new Set(winner.map(identity));
  return [...winner, ...loser.filter((entry) => !occupied.has(identity(entry)))];
}

/**
 * Evidence is monotonic, while choices and claimed economic receipts belong
 * to the complete snapshot selected by the expedition envelope. The first
 * argument is therefore authoritative for conflicts; the losing branch only
 * fills a receipt the winner does not have.
 */
export function mergeMoonProjectsState(winnerRaw, loserRaw, options = {}) {
  const winner = sanitizeMoonProjectsState(winnerRaw, options).entries[0];
  const loser = sanitizeMoonProjectsState(loserRaw, options).entries[0];
  const evidence = sanitizeEvidence([...winner.evidence, ...loser.evidence]);
  const decisions = sanitizeDecisions(appendMissingReceipts(
    winner.decisions,
    loser.decisions,
    (entry) => entry.decisionId
  ));
  const rewards = options.includeRewards === false
    ? sanitizeRewards(winner.rewards)
    : sanitizeRewards(appendMissingReceipts(
        winner.rewards,
        loser.rewards,
        (entry) => entry.rewardId
      ));
  const merged = canonicalHeartEntry({
    ...emptyHeartEntry(),
    evidence,
    decisions,
    rewards,
    completedAt: winner.completedAt || loser.completedAt
  });
  const completion = coreCompletion(merged);
  if (completion.complete && !merged.completedAt) {
    const finaleTimes = merged.evidence
      .filter((entry) => findingIdForMilestone(entry.milestoneId) === HEART_FINALE.id)
      .map((entry) => entry.completedAt)
      .sort();
    merged.completedAt = finaleTimes[0] || "";
  }
  return sanitizeMoonProjectsState({ version: MOON_PROJECTS_VERSION, entries: [merged] }, options);
}

export function moonHeartProjectCatalog() {
  return structuredClone(HEART_CATALOG);
}

function entryFromState(raw) {
  return sanitizeMoonProjectsState(raw).entries[0];
}

function evidenceForFinding(entry, findingId) {
  return entry.evidence.filter((evidence) => findingIdForMilestone(evidence.milestoneId) === findingId);
}

function chapterCompletion(entry, chapter) {
  return chapter.findings.every((finding) => evidenceForFinding(entry, finding.id).length > 0);
}

function contiguousCompletedChapters(entry) {
  let count = 0;
  for (const chapter of HEART_CHAPTERS) {
    if (!chapterCompletion(entry, chapter)) break;
    count += 1;
  }
  return count;
}

function boundedStage(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(5, Math.max(1, Math.floor(number))) : 1;
}

export function moonHeartProjectView(raw, { shelterStage = 1 } = {}) {
  const state = sanitizeMoonProjectsState(raw);
  const entry = state.entries[0];
  const decision = entry.decisions.find((candidate) => candidate.decisionId === DECISION_ID) || null;
  const completedChapters = contiguousCompletedChapters(entry);
  const chapters = HEART_CHAPTERS.map((chapter, index) => {
    const complete = chapterCompletion(entry, chapter);
    const previousComplete = index === 0 || HEART_CHAPTERS.slice(0, index).every((candidate) => chapterCompletion(entry, candidate));
    const decisionGateOpen = chapter.id !== "long-night" || Boolean(decision);
    const unlocked = previousComplete && decisionGateOpen;
    return {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      question: chapter.question,
      status: complete ? "complete" : unlocked ? "current" : "locked",
      complete,
      unlocked,
      findings: chapter.findings.map((finding) => {
        const evidence = evidenceForFinding(entry, finding.id);
        const recipes = new Set(evidence.map((item) => item.recipeKey));
        const routes = new Set(evidence.map((item) => item.routeKey));
        return {
          ...finding,
          milestoneId: `finding:${finding.id}`,
          found: evidence.length > 0,
          proofCount: recipes.size,
          perspectiveCount: routes.size,
          corroborated: recipes.size > 1
        };
      })
    };
  });
  const finaleEvidence = evidenceForFinding(entry, HEART_FINALE.id);
  const allChaptersComplete = HEART_CHAPTERS.every((chapter) => chapterCompletion(entry, chapter));
  const finaleUnlocked = allChaptersComplete && Boolean(decision);
  const complete = coreCompletion(entry).complete;
  const rewardReceipt = entry.rewards.find((reward) => reward.rewardId === MOON_HEART_REWARD.id) || null;
  const connectionIds = new Set(entry.evidence
    .map((evidence) => connectionIdForMilestone(evidence.milestoneId))
    .filter(Boolean));
  const decisionRequired = chapterCompletion(entry, CHAPTER_BY_ID.get("settlement-character")) && !decision;
  const currentChapter = chapters.find((chapter) => chapter.status === "current") || null;
  return {
    version: MOON_PROJECTS_VERSION,
    projectId: MOON_HEART_PROJECT_ID,
    contentVersion: MOON_HEART_CONTENT_VERSION,
    title: HEART_CATALOG.title,
    subtitle: HEART_CATALOG.subtitle,
    description: HEART_CATALOG.description,
    complete,
    completedAt: complete ? entry.completedAt : "",
    phase: complete ? "complete" : decisionRequired ? "decision" : finaleUnlocked ? "finale" : "chapter",
    currentChapterId: currentChapter?.id || "",
    completedChapters,
    totalChapters: HEART_CHAPTERS.length,
    findingProgress: {
      current: FINDINGS.filter((finding) => evidenceForFinding(entry, finding.id).length > 0).length,
      total: FINDINGS.length
    },
    projectedShelterStage: Math.max(boundedStage(shelterStage), Math.min(5, 1 + completedChapters)),
    chapters,
    decision: {
      id: DECISION_ID,
      required: decisionRequired,
      available: chapterCompletion(entry, CHAPTER_BY_ID.get("settlement-character")),
      choiceId: decision?.choiceId || "",
      decidedAt: decision?.decidedAt || "",
      choice: decision ? structuredClone(CHOICE_BY_ID.get(decision.choiceId)) : null,
      choices: structuredClone(HEART_CHOICES)
    },
    finale: {
      ...structuredClone(HEART_FINALE),
      milestoneId: `finding:${HEART_FINALE.id}`,
      unlocked: finaleUnlocked,
      complete: finaleEvidence.length > 0,
      proofCount: new Set(finaleEvidence.map((item) => item.recipeKey)).size,
      perspectiveCount: new Set(finaleEvidence.map((item) => item.routeKey)).size
    },
    connections: HEART_CONNECTIONS.map((connection) => ({
      ...structuredClone(connection),
      milestoneId: `connection:${connection.id}`,
      found: connectionIds.has(connection.id)
    })),
    reward: {
      ...structuredClone(MOON_HEART_REWARD),
      available: complete && !rewardReceipt,
      claimed: Boolean(rewardReceipt),
      claimedAt: rewardReceipt?.claimedAt || ""
    },
    state
  };
}

function contextForFinding(finding) {
  if (!finding) return null;
  const chapter = CHAPTER_BY_ID.get(finding.chapterId);
  return {
    kind: "moon-project",
    worldId: WORLD_ID,
    projectId: MOON_HEART_PROJECT_ID,
    chapterId: finding.chapterId,
    milestoneId: finding.id,
    target: finding.target,
    title: chapter ? `${HEART_CATALOG.title} · ${chapter.title}` : `${HEART_CATALOG.title} · ${HEART_FINALE.title}`,
    story: finding.clue,
    icon: finding.icon
  };
}

export function moonHeartProjectContext(rawMilestoneId) {
  const source = record(rawMilestoneId);
  const id = cleanId(source.milestoneId ?? source.findingId ?? rawMilestoneId);
  return contextForFinding(FINDING_BY_ID.get(id));
}

export function normalizeMoonHeartProjectContext(raw, target = "") {
  const source = record(raw);
  if (cleanId(source.kind) !== "moon-project") return null;
  if (cleanId(source.worldId ?? source.world) !== WORLD_ID) return null;
  if (cleanId(source.projectId ?? source.project) !== MOON_HEART_PROJECT_ID) return null;
  const context = moonHeartProjectContext(source.milestoneId ?? source.findingId);
  if (!context) return null;
  if (source.chapterId && cleanId(source.chapterId) !== context.chapterId) return null;
  const suppliedTarget = normalizedWord(target || source.target);
  if (suppliedTarget && suppliedTarget !== normalizedWord(context.target)) return null;
  return context;
}

function routeReceipt(value) {
  const source = record(value);
  const nested = record(source.recipe);
  const ingredients = source.ingredients ?? source.inputs ?? nested.ingredients;
  const result = record(source.result);
  const a = cleanText(source.a ?? source.left ?? nested.a ?? ingredients?.[0], 80);
  const b = cleanText(source.b ?? source.right ?? nested.b ?? ingredients?.[1], 80);
  const word = cleanText(source.word ?? source.output ?? (typeof source.result === "string" ? source.result : result.word) ?? nested.word, 80);
  const key = recipeKey(a, b, word);
  if (!key) return null;
  const supplied = String(source.key ?? nested.key ?? "").trim();
  if (supplied && supplied !== key) return null;
  return {
    key,
    a,
    b,
    word,
    output: normalizedWord(word),
    source: cleanId(source.source),
    division: cleanId(source.division),
    assist: cleanId(source.assist),
    revealed: source.revealed === true,
    scoringDisabled: source.scoringDisabled === true,
    scoreEligible: source.scoreEligible !== false,
    projectEligible: source.projectEligible !== false && source.worldweavingEligible !== false
  };
}

function eligibleRoute(payload) {
  const source = record(payload);
  const history = Array.isArray(source.history) ? source.history : Array.isArray(payload) ? payload : [];
  const receipts = history.slice(0, MAX_ROUTE_STEPS).map(routeReceipt).filter(Boolean);
  const payloadAssist = cleanId(source.assist);
  const payloadDivision = cleanId(source.division);
  if (
    source.revealed === true
    || source.scoringDisabled === true
    || source.scoreEligible === false
    || payloadAssist === "reveal"
    || payloadAssist === "training"
    || payloadDivision === "study"
  ) return { receipts: [], reason: "ineligible_run" };
  if (!receipts.length) return { receipts: [], reason: "missing_history" };
  if (receipts.some((entry) => (
    entry.revealed
    || entry.scoringDisabled
    || !entry.scoreEligible
    || !entry.projectEligible
    || entry.source === "reveal"
    || entry.division === "study"
    || entry.assist === "reveal"
    || entry.assist === "training"
  ))) return { receipts: [], reason: "ineligible_run" };
  return { receipts, reason: "eligible" };
}

function routeKey(receipts) {
  const keys = [...new Set(receipts.map((receipt) => receipt.key))].sort((left, right) => left.localeCompare(right, "en"));
  return `route:${stableHash(JSON.stringify(keys))}`;
}

function findingAccess(view, finding) {
  if (!finding) return { allowed: false, reason: "unknown_milestone" };
  const existing = view.state.entries[0].evidence.some((entry) => findingIdForMilestone(entry.milestoneId) === finding.id);
  if (existing) return { allowed: true, reason: "revisit" };
  if (finding.finale) return { allowed: view.finale.unlocked, reason: view.finale.unlocked ? "current" : "milestone_locked" };
  const chapter = view.chapters.find((candidate) => candidate.id === finding.chapterId);
  if (!chapter?.unlocked) return { allowed: false, reason: view.decision.required ? "decision_required" : "milestone_locked" };
  return { allowed: true, reason: "current" };
}

function addEvidence(entry, evidence) {
  const before = entry.evidence.length;
  entry.evidence = sanitizeEvidence([...entry.evidence, evidence]);
  return entry.evidence.length > before;
}

export function recordMoonHeartProjectRoute(raw, payload = {}) {
  const state = sanitizeMoonProjectsState(raw);
  const context = normalizeMoonHeartProjectContext(payload.context, payload.target);
  if (!context) return { state, recorded: false, advanced: false, reason: "invalid_context" };
  const viewBefore = moonHeartProjectView(state, { shelterStage: payload.shelterStage });
  const finding = FINDING_BY_ID.get(context.milestoneId);
  const access = findingAccess(viewBefore, finding);
  if (!access.allowed) return { state, recorded: false, advanced: false, reason: access.reason, milestoneId: finding?.id || "" };
  const route = eligibleRoute(payload);
  if (!route.receipts.length) return { state, recorded: false, advanced: false, reason: route.reason, milestoneId: finding.id };
  const final = route.receipts.at(-1);
  if (final.output !== normalizedWord(finding.target)) {
    return { state, recorded: false, advanced: false, reason: "target_not_completed", milestoneId: finding.id };
  }

  const entry = state.entries[0];
  const milestoneId = `finding:${finding.id}`;
  const prior = entry.evidence.filter((evidence) => evidence.milestoneId === milestoneId);
  const sameRecipe = prior.some((evidence) => evidence.recipeKey === final.key);
  const signature = routeKey(route.receipts);
  const sameRoute = prior.some((evidence) => evidence.recipeKey === final.key && evidence.routeKey === signature);
  if (sameRoute) {
    return {
      state,
      recorded: false,
      advanced: false,
      reason: "duplicate_route",
      milestoneId: finding.id,
      recipeKey: final.key,
      routeKey: signature
    };
  }

  const at = completedAt(payload.completedAt);
  const findingEvidence = { milestoneId, recipeKey: final.key, routeKey: signature, completedAt: at };
  const findingDiscovered = prior.length === 0;
  const corroborated = prior.length > 0 && !sameRecipe;
  const perspective = prior.length > 0 && sameRecipe;
  const recorded = addEvidence(entry, findingEvidence);
  if (!recorded) {
    return { state, recorded: false, advanced: false, reason: "evidence_limit", milestoneId: finding.id };
  }

  const outputSet = new Set(route.receipts.map((receipt) => receipt.output));
  const connections = [];
  for (const connection of HEART_CONNECTIONS) {
    if (connection.targetFindingId !== finding.id) continue;
    if (!connection.requiredWords.every((word) => outputSet.has(normalizedWord(word)))) continue;
    const connectionEvidence = {
      milestoneId: `connection:${connection.id}`,
      recipeKey: final.key,
      routeKey: signature,
      completedAt: at
    };
    if (addEvidence(entry, connectionEvidence)) connections.push(connection.id);
  }

  let next = sanitizeMoonProjectsState(state);
  let after = moonHeartProjectView(next, { shelterStage: payload.shelterStage });
  if (after.complete && !next.entries[0].completedAt) {
    next.entries[0].completedAt = at;
    next = sanitizeMoonProjectsState(next);
    after = moonHeartProjectView(next, { shelterStage: payload.shelterStage });
  }
  const chapterBefore = finding.finale
    ? viewBefore.finale.complete
    : viewBefore.chapters.find((chapter) => chapter.id === finding.chapterId)?.complete;
  const chapterAfter = finding.finale
    ? after.finale.complete
    : after.chapters.find((chapter) => chapter.id === finding.chapterId)?.complete;
  return {
    state: next,
    recorded: true,
    advanced: findingDiscovered || connections.length > 0,
    reason: findingDiscovered ? "finding_recorded" : corroborated ? "corroborated" : "perspective_recorded",
    milestoneId: finding.id,
    recipeKey: final.key,
    routeKey: signature,
    findingDiscovered,
    corroborated,
    perspective,
    connections,
    chapterCompleted: !chapterBefore && chapterAfter ? finding.chapterId : "",
    decisionRequired: after.decision.required,
    projectCompleted: !viewBefore.complete && after.complete,
    projectedShelterStage: after.projectedShelterStage,
    rewardAvailable: after.reward.available
  };
}

export function chooseMoonHeartSettlement(raw, { choiceId: rawChoiceId, decidedAt: rawDecidedAt, at = new Date() } = {}) {
  const state = sanitizeMoonProjectsState(raw);
  const view = moonHeartProjectView(state);
  const choiceId = cleanId(rawChoiceId);
  if (!CHOICE_BY_ID.has(choiceId)) return { state, chosen: false, reason: "unknown_choice", decision: null };
  const existing = state.entries[0].decisions.find((decision) => decision.decisionId === DECISION_ID);
  if (existing) {
    return {
      state,
      chosen: false,
      reason: existing.choiceId === choiceId ? "already_chosen" : "immutable_decision",
      decision: { ...existing }
    };
  }
  if (!view.decision.available) return { state, chosen: false, reason: "decision_locked", decision: null };
  const decision = { decisionId: DECISION_ID, choiceId, decidedAt: completedAt(rawDecidedAt, at) };
  state.entries[0].decisions = sanitizeDecisions([...state.entries[0].decisions, decision]);
  return {
    state: sanitizeMoonProjectsState(state),
    chosen: true,
    reason: "chosen",
    decision: { ...decision },
    choice: structuredClone(CHOICE_BY_ID.get(choiceId))
  };
}

export function claimMoonHeartProjectReward(raw, { claimedAt: rawClaimedAt, at = new Date() } = {}) {
  const state = sanitizeMoonProjectsState(raw);
  const view = moonHeartProjectView(state);
  if (!view.complete) return { state, claimed: false, reason: "project_incomplete", grant: null, receipt: null };
  const existing = state.entries[0].rewards.find((reward) => reward.rewardId === MOON_HEART_REWARD.id);
  if (existing) return { state, claimed: false, reason: "already_claimed", grant: null, receipt: { ...existing } };
  const receipt = {
    rewardId: MOON_HEART_REWARD.id,
    claimedAt: completedAt(rawClaimedAt, at)
  };
  state.entries[0].rewards = sanitizeRewards([...state.entries[0].rewards, receipt]);
  return {
    state: sanitizeMoonProjectsState(state),
    claimed: true,
    reason: "claimed",
    grant: {
      stardust: MOON_HEART_REWARD.stardust,
      capability: { ...MOON_HEART_REWARD.capability }
    },
    receipt: { ...receipt }
  };
}
