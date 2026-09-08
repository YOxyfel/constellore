const PROJECT_STATES = new Set(["locked", "active", "choice", "crisis", "finale", "complete"]);
const CHAPTER_STATES = new Set(["locked", "available", "current", "complete"]);
const TASK_STATES = new Set(["locked", "available", "current", "complete"]);
const TASK_KINDS = new Set(["mission", "choice", "crisis", "finale", "complete"]);
const EVIDENCE_STATES = new Set(["missing", "found", "connected", "complete"]);

const MAX_CHAPTERS = 8;
const MAX_TASKS = 32;
const MAX_TASKS_PER_CHAPTER = 8;
const MAX_EVIDENCE_PER_CHAPTER = 8;
const MAX_CHOICES = 6;
const MAX_REWARD_ITEMS = 8;

export function moonHeartChoiceFailureMessage(reason) {
  return {
    already_chosen: "Moonhaven already carries that identity.",
    immutable_decision: "Moonhaven's founding character is permanent.",
    decision_locked: "Complete Garden, Factory, and Community research first.",
    unknown_choice: "That settlement identity is not available."
  }[reason] || "That settlement decision is not available yet.";
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function firstArray(...values) {
  return values.find(Array.isArray) || [];
}

function boundedText(value, fallback = "", maximum = 120) {
  const clean = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
  return clean || fallback;
}

function identifier(value, fallback = "") {
  const clean = boundedText(value, fallback, 56)
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || fallback;
}

function boundedCount(value, maximum = 10_000) {
  const number = Math.floor(Number(value) || 0);
  return Math.max(0, Math.min(maximum, number));
}

function normalizedState(value, allowed, fallback) {
  const state = identifier(value, fallback);
  return allowed.has(state) ? state : fallback;
}

function normalizedProgress(raw, fallbackCompleted = 0, fallbackTotal = 0) {
  const source = plainObject(raw) || {};
  const total = boundedCount(source.total ?? source.maximum ?? fallbackTotal, 999);
  const completed = Math.min(total || 999, boundedCount(source.completed ?? source.current ?? fallbackCompleted, 999));
  const percent = total ? Math.round((completed / total) * 100) : Math.min(100, boundedCount(source.percent, 100));
  return Object.freeze({
    completed,
    total,
    percent,
    label: boundedText(source.label, total ? `${completed} of ${total}` : `${percent}%`, 48),
    unit: boundedText(source.unit, "chapters", 24).toLocaleLowerCase("en-US")
  });
}

function normalizedEvidence(raw, index) {
  const source = plainObject(raw) || {};
  const found = Boolean(source.found || source.complete || source.word);
  const state = normalizedState(source.status ?? source.state, EVIDENCE_STATES, found ? source.corroborated ? "connected" : "found" : "missing");
  const proof = boundedCount(source.proofCount, 99);
  const perspectives = boundedCount(source.perspectiveCount, 99);
  return Object.freeze({
    id: identifier(source.id, `evidence-${index + 1}`),
    label: boundedText(source.label ?? source.title, `Finding ${index + 1}`, 64),
    word: boundedText(source.word ?? source.value ?? (found ? source.target : ""), "", 64),
    kind: identifier(source.kind ?? source.type, source.corroborated ? "corroboration" : "finding"),
    state,
    description: boundedText(source.description ?? source.summary ?? (found ? `${proof} recipe proof${proof === 1 ? "" : "s"} · ${perspectives} route perspective${perspectives === 1 ? "" : "s"}` : source.clue), "", 150)
  });
}

function normalizedTask(raw, index, chapterId = "") {
  const source = plainObject(raw) || {};
  const id = identifier(source.id ?? source.taskId, `task-${index + 1}`);
  const kind = normalizedState(source.kind ?? source.type, TASK_KINDS, "mission");
  const state = normalizedState(source.status ?? source.state, TASK_STATES, source.completed ? "complete" : "locked");
  const enabled = source.enabled == null
    ? ["available", "current"].includes(state) && kind !== "complete"
    : Boolean(source.enabled);
  return Object.freeze({
    id,
    chapterId: identifier(source.chapterId, chapterId),
    title: boundedText(source.title ?? source.label, "Continue the project", 72),
    summary: boundedText(source.summary ?? source.description ?? source.story, "", 180),
    target: boundedText(source.target, "", 72),
    kind,
    state,
    enabled,
    label: boundedText(source.actionLabel ?? source.buttonLabel ?? source.cta ?? source.label, kind === "finale" ? "Begin the finale" : kind === "crisis" ? "Face the crisis" : "Enter orbit", 48),
    reason: boundedText(source.reason ?? source.lockReason, "", 140)
  });
}

function normalizedChapter(raw, index, externalTasks) {
  const source = plainObject(raw) || {};
  const id = identifier(source.id ?? source.chapterId, `chapter-${index + 1}`);
  const findings = Array.isArray(source.findings) ? source.findings : [];
  const suppliedTasks = Array.isArray(source.tasks) ? source.tasks : findings.map((finding) => ({
    ...finding,
    chapterId: id,
    kind: id === "first-dawn" ? "finale" : id === "long-night" ? "crisis" : "mission",
    state: finding.found || finding.complete ? "complete" : source.unlocked ? "available" : "locked",
    enabled: !source.projectComplete && Boolean(source.unlocked || finding.unlocked || finding.found || finding.complete),
    actionLabel: finding.found || finding.complete ? `Deepen: ${finding.target}` : id === "first-dawn" ? "Begin First Dawn" : id === "long-night" ? `Answer: ${finding.target}` : `Research: ${finding.target}`,
    reason: source.unlocked || finding.unlocked ? "" : "Complete the previous chapter first."
  }));
  const nestedTasks = suppliedTasks
    .slice(0, MAX_TASKS_PER_CHAPTER)
    .map((task, taskIndex) => normalizedTask(task, taskIndex, id));
  const tasks = nestedTasks.length
    ? nestedTasks
    : externalTasks.filter((task) => task.chapterId === id).slice(0, MAX_TASKS_PER_CHAPTER);
  const evidence = firstArray(source.evidence, source.findings)
    .slice(0, MAX_EVIDENCE_PER_CHAPTER)
    .map(normalizedEvidence);
  const inferredComplete = tasks.length > 0 && tasks.every((task) => task.state === "complete");
  const state = normalizedState(
    source.status ?? source.state,
    CHAPTER_STATES,
    source.completed || inferredComplete ? "complete" : index === 0 ? "current" : "locked"
  );
  const progress = normalizedProgress(
    source.progress,
    evidence.filter((item) => item.state !== "missing").length || tasks.filter((task) => task.state === "complete").length,
    evidence.length || tasks.length
  );
  const suppliedAction = plainObject(source.action);
  const action = suppliedAction
    ? normalizedTask({ ...suppliedAction, chapterId: id }, 0, id)
    : tasks.find((task) => task.enabled && task.state !== "complete")
      || tasks.find((task) => task.enabled)
      || tasks.find((task) => task.state === "current")
      || null;
  return Object.freeze({
    id,
    number: boundedCount(source.number ?? source.chapter ?? index + 1, 99) || index + 1,
    title: boundedText(source.title, `Chapter ${index + 1}`, 72),
    subtitle: boundedText(source.subtitle ?? source.kicker, "", 72),
    summary: boundedText(source.summary ?? source.description ?? source.story ?? source.question, "", 220),
    state,
    progress,
    evidence: Object.freeze(evidence),
    tasks: Object.freeze(tasks),
    action
  });
}

function normalizedChoice(raw, index) {
  const source = plainObject(raw) || {};
  const id = identifier(source.id ?? source.choiceId, `choice-${index + 1}`);
  return Object.freeze({
    id,
    taskId: identifier(source.taskId ?? source.action?.taskId ?? source.action?.id, ""),
    title: boundedText(source.title ?? source.label, `Choice ${index + 1}`, 64),
    description: boundedText(source.description ?? source.summary, "", 150),
    consequence: boundedText(source.consequence ?? source.effect, "", 120),
    selected: Boolean(source.selected),
    enabled: source.enabled == null ? !source.locked : Boolean(source.enabled),
    reason: boundedText(source.reason ?? source.lockReason, "", 120)
  });
}

function normalizedSettlementChoice(raw) {
  const source = plainObject(raw) || {};
  const options = firstArray(source.options, source.choices)
    .slice(0, MAX_CHOICES)
    .map((choice, index) => normalizedChoice({
      ...choice,
      selected: source.choiceId === choice?.id,
      enabled: choice?.enabled ?? Boolean(source.available && !source.choiceId),
      consequence: choice?.consequence ?? ({ garden: "A living conservatory", workshop: "A maker district", commons: "A shared hearth" }[choice?.id] || ""),
      reason: choice?.reason ?? (source.available ? "" : "Complete all three settlement experiments first.")
    }, index));
  const selectedId = identifier(source.selectedId ?? source.choiceId, options.find((option) => option.selected)?.id || "");
  return Object.freeze({
    title: boundedText(source.title, "What should grow here?", 72),
    description: boundedText(source.description ?? source.summary, "Your decision will remain visible in Moonhaven.", 180),
    selectedId,
    options: Object.freeze(options)
  });
}

function normalizedReward(raw) {
  const source = plainObject(raw) || {};
  const items = (Array.isArray(source.items) ? source.items : [])
    .slice(0, MAX_REWARD_ITEMS)
    .map((item, index) => {
      const value = plainObject(item) || {};
      return Object.freeze({
        id: identifier(value.id, `reward-${index + 1}`),
        icon: boundedText(value.icon, "\u2726", 8),
        label: boundedText(value.label ?? value.title, "Project reward", 64),
        value: boundedText(value.value ?? value.amount, "", 48)
      });
    });
  return Object.freeze({
    title: boundedText(source.title, "Moonhaven remembers", 80),
    description: boundedText(source.description ?? source.summary, "The settlement carries your decisions forward.", 180),
    claimed: Boolean(source.claimed),
    items: Object.freeze(items)
  });
}

/**
 * Bounded adapter between the project domain and its lazy presentation.
 * The runtime is deliberately not a persistence or reward authority.
 */
export function createMoonHeartProjectModel(raw = {}) {
  const source = plainObject(raw) || {};
  const externalTasks = (Array.isArray(source.tasks) ? source.tasks : [])
    .slice(0, MAX_TASKS)
    .map((task, index) => normalizedTask(task, index));
  const domainFinale = plainObject(source.finale);
  const chapterInput = Array.isArray(source.chapters) ? [...source.chapters] : [];
  if (domainFinale) chapterInput.push({
    ...domainFinale,
    id: "first-dawn",
    number: 5,
    title: "First Dawn",
    question: "Bring homes and a living forest together, then christen the settlement Moonhaven.",
    status: domainFinale.complete ? "complete" : domainFinale.unlocked ? "current" : "locked",
    unlocked: domainFinale.unlocked,
    findings: [domainFinale]
  });
  const chapters = chapterInput
    .slice(0, MAX_CHAPTERS)
    .map((chapter, index) => normalizedChapter({ ...chapter, projectComplete: source.complete }, index, externalTasks));
  const fallbackChapter = chapters.find((chapter) => chapter.state === "current")
    || chapters.find((chapter) => chapter.state === "available")
    || chapters.at(-1)
    || null;
  const requestedActive = identifier(source.activeChapterId ?? source.currentChapterId, fallbackChapter?.id || "");
  const activeChapterId = chapters.some((chapter) => chapter.id === requestedActive)
    ? requestedActive
    : fallbackChapter?.id || "";
  const completedChapters = chapters.filter((chapter) => chapter.state === "complete").length;
  const domainProgress = plainObject(source.findingProgress);
  const progress = normalizedProgress(source.progress ?? (domainProgress ? { ...domainProgress, unit: "experiments", label: `${domainProgress.current} of ${domainProgress.total} experiments` } : null), completedChapters, chapters.length);
  const domainState = source.complete ? "complete" : source.phase === "decision" ? "choice" : source.phase === "finale" ? "finale" : source.currentChapterId === "long-night" ? "crisis" : "active";
  const state = normalizedState(typeof source.state === "string" ? source.state : source.status ?? domainState, PROJECT_STATES, progress.total > 0 && progress.completed >= progress.total ? "complete" : "active");
  const settlementChoice = normalizedSettlementChoice(source.settlementChoice ?? (source.decision ? {
    ...source.decision,
    title: "What should grow here first?",
    description: "This permanent identity changes Moonhaven's character, never its score or reward value."
  } : null));
  const domainReward = plainObject(source.reward);
  const domainCapability = plainObject(domainReward?.capability);
  const hasDomainReward = Boolean(
    domainReward
    && !Array.isArray(domainReward.items)
    && (Number.isFinite(Number(domainReward.stardust)) || domainCapability)
  );
  const reward = hasDomainReward ? {
    ...domainReward,
    title: "Moonhaven remembers",
    description: domainReward.claimed ? "The Heart and its stewardship are permanent." : "Complete First Dawn to make Moonhaven a living settlement.",
    items: [
      Number.isFinite(Number(domainReward.stardust))
        ? { id: "heart-stardust", icon: "✦", label: "First Dawn reserve", value: `${Math.max(0, Math.floor(Number(domainReward.stardust)))} Stardust` }
        : null,
      domainCapability
        ? { id: domainCapability.id, icon: "◇", label: domainCapability.name, value: "Permanent capability" }
        : null
    ].filter(Boolean)
  } : source.reward;
  return Object.freeze({
    id: identifier(source.id ?? source.projectId, "heart"),
    title: boundedText(source.title, "The Heart", 80),
    subtitle: boundedText(source.subtitle ?? source.description, "A Home Beneath No Sky", 140),
    state,
    variant: identifier(source.variant ?? settlementChoice.selectedId, "unwritten"),
    progress,
    activeChapterId: source.phase === "finale" || source.complete ? "first-dawn" : activeChapterId,
    chapters: Object.freeze(chapters),
    settlementChoice,
    reward: normalizedReward(reward)
  });
}

/**
 * Builds the compact dossier inventory without allowing a task that lacks a
 * matching evidence socket to disappear from the project UI.
 */
export function createMoonHeartDossierEntries(chapter = {}) {
  const source = plainObject(chapter) || {};
  const evidence = Array.isArray(source.evidence) ? source.evidence : [];
  const tasks = Array.isArray(source.tasks) ? source.tasks : [];
  const evidenceIds = new Set(evidence.map((entry) => entry.id));
  const entries = [
    ...evidence.map((entry) => Object.freeze({
      entry,
      task: tasks.find((candidate) => candidate.id === entry.id) || null
    })),
    ...tasks
      .filter((task) => !evidenceIds.has(task.id))
      .map((task) => Object.freeze({
        task,
        entry: Object.freeze({
          id: task.id,
          label: task.title,
          word: task.state === "complete" ? task.target : "",
          kind: task.kind === "crisis" ? "crisis finding" : task.kind === "finale" ? "final synthesis" : "finding",
          state: task.state === "complete" ? "complete" : "missing",
          description: task.summary
        })
      }))
  ];
  return Object.freeze(entries);
}

export const MOON_HEART_PROJECT_LIMITS = Object.freeze({
  chapters: MAX_CHAPTERS,
  tasks: MAX_TASKS,
  tasksPerChapter: MAX_TASKS_PER_CHAPTER,
  evidencePerChapter: MAX_EVIDENCE_PER_CHAPTER,
  choices: MAX_CHOICES,
  rewardItems: MAX_REWARD_ITEMS
});
