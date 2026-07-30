/**
 * On-demand presentation model for the cumulative story made by successful word
 * combinations. This module does not touch the DOM, storage, networking,
 * progression, scoring, rank, or economy state.
 *
 * API:
 *   buildCombinationStory({
 *     target: string,
 *     history: Array<{ a, b, word, emoji?, category? }>,
 *     failedAttempt?: { a, b }
 *   })
 *
 * The returned immutable model contains sanitized chapters, visual scene
 * layers, narration-ready accessibility strings, and (when failedAttempt is
 * valid) a non-destructive `crumble-rebuild` event. Consumers should render
 * all strings as text; this module never returns HTML.
 */

export const COMBINATION_STORY_VERSION = 1;
export const COMBINATION_STORY_MAX_CHAPTERS = 48;
export const COMBINATION_STORY_CATEGORIES = Object.freeze([
  "force",
  "nature",
  "life",
  "structure",
  "celestial",
  "unknown"
]);
export const COMBINATION_STORY_SCENE_VARIANTS = Object.freeze([
  "orbital-garden",
  "living-forge",
  "storm-archive",
  "deep-cosmos"
]);

const MAX_INPUT_STEPS = COMBINATION_STORY_MAX_CHAPTERS * 2;
const MAX_WORD_LENGTH = 48;
const MAX_EMOJI_POINTS = 8;
const MAX_NARRATION_LENGTH = 300;
const CATEGORY_SET = new Set(COMBINATION_STORY_CATEGORIES);
const CATEGORY_PRESENTATION = Object.freeze({
  force: Object.freeze({
    sceneRole: "energy",
    motif: "current",
    narration: "motion and energy move through the scene"
  }),
  nature: Object.freeze({
    sceneRole: "landscape",
    motif: "terrain",
    narration: "a natural landscape settles into the scene"
  }),
  life: Object.freeze({
    sceneRole: "inhabitants",
    motif: "pulse",
    narration: "a living presence enters the scene"
  }),
  structure: Object.freeze({
    sceneRole: "architecture",
    motif: "skyline",
    narration: "a built layer rises in the scene"
  }),
  celestial: Object.freeze({
    sceneRole: "sky",
    motif: "constellation",
    narration: "the sky opens above the scene"
  }),
  unknown: Object.freeze({
    sceneRole: "discovery",
    motif: "anomaly",
    narration: "a new discovery joins the scene"
  })
});
const SCENE_PALETTES = Object.freeze(["aurora", "ember", "tidal", "violet", "verdant"]);

function safeWord(value) {
  if (typeof value !== "string") return "";
  let normalized;
  try {
    normalized = value
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
  } catch {
    return "";
  }
  if (!normalized || normalized.length > MAX_WORD_LENGTH) return "";
  if (!/^[\p{L}\p{N}]+(?:[ '\u2019-][\p{L}\p{N}]+)*$/u.test(normalized)) return "";
  if (normalized.split(" ").length > 6) return "";
  return normalized;
}

function safeEmoji(value) {
  if (typeof value !== "string") return "";
  let normalized;
  try {
    normalized = value
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f<>&"']/gu, "")
      .trim();
  } catch {
    return "";
  }
  return [...normalized].slice(0, MAX_EMOJI_POINTS).join("");
}

function safeCategory(value) {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLocaleLowerCase("en-US");
  return CATEGORY_SET.has(normalized) ? normalized : "unknown";
}

function wordKey(value) {
  return String(value || "").toLocaleLowerCase("en-US");
}

function boundedNarration(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f<>]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_NARRATION_LENGTH);
}

function stableHashNumber(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableHash(value) {
  return stableHashNumber(value).toString(36);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sanitizeHistory(rawHistory) {
  const source = Array.isArray(rawHistory) ? rawHistory : [];
  const steps = [];
  let validSeen = 0;
  const scanned = source.slice(0, MAX_INPUT_STEPS);
  for (const raw of scanned) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const a = safeWord(raw.a);
    const b = safeWord(raw.b);
    const word = safeWord(raw.word);
    if (!a || !b || !word) continue;
    validSeen += 1;
    if (steps.length >= COMBINATION_STORY_MAX_CHAPTERS) continue;
    steps.push({
      a,
      b,
      word,
      emoji: safeEmoji(raw.emoji),
      category: safeCategory(raw.category)
    });
  }
  return {
    steps,
    truncated: source.length > MAX_INPUT_STEPS || validSeen > COMBINATION_STORY_MAX_CHAPTERS
  };
}

function uniqueParentChapters(step, chapterByResult) {
  const parents = [];
  const seen = new Set();
  for (const ingredient of [step.a, step.b]) {
    const chapter = chapterByResult.get(wordKey(ingredient));
    if (!chapter || seen.has(chapter.id)) continue;
    seen.add(chapter.id);
    parents.push(chapter);
  }
  return parents;
}

function chapterRelation(index, finale, parentCount) {
  if (index === 0) return "foundation";
  if (finale) return "finale";
  if (parentCount > 1) return "convergence";
  if (parentCount === 1) return "continuation";
  return "parallel";
}

function chapterNarration({ step, number, kind, parents, target }) {
  const equation = `${step.a} and ${step.b} make ${step.word}.`;
  const categoryNarration = CATEGORY_PRESENTATION[step.category].narration;
  if (kind === "foundation") {
    return boundedNarration(`${equation} ${step.word} becomes the foundation; ${categoryNarration}.`);
  }
  if (kind === "finale") {
    return boundedNarration(`${equation} The target ${target} completes the scene as the finale after ${number} chapters.`);
  }
  if (parents.length > 1) {
    const references = parents.map((parent) => `chapter ${parent.number}`).join(" and ");
    return boundedNarration(`Chapter ${number}: ${equation} It brings ${references} together, and ${categoryNarration}.`);
  }
  if (parents.length === 1) {
    return boundedNarration(`Chapter ${number}: ${equation} It builds on chapter ${parents[0].number}, and ${categoryNarration}.`);
  }
  return boundedNarration(`Chapter ${number}: ${equation} It opens a parallel part of the story, and ${categoryNarration}.`);
}

function sceneProfile(target, steps) {
  const targetStep = target
    ? [...steps].reverse().find((step) => wordKey(step.word) === wordKey(target))
    : null;
  const foundation = steps[0];
  const anchorCategory = targetStep?.category || foundation?.category || "unknown";
  const signature = target
    ? `target:${target}`
    : foundation
      ? `foundation:${foundation.category}:${foundation.word}`
      : "empty";
  const seed = stableHashNumber(signature);
  return {
    variant: COMBINATION_STORY_SCENE_VARIANTS[seed % COMBINATION_STORY_SCENE_VARIANTS.length],
    palette: SCENE_PALETTES[Math.floor(seed / COMBINATION_STORY_SCENE_VARIANTS.length) % SCENE_PALETTES.length],
    category: anchorCategory,
    motif: CATEGORY_PRESENTATION[anchorCategory].motif,
    slotOffset: seed % 11
  };
}

function buildChapter(step, index, target, chapterByResult, profile) {
  const number = index + 1;
  const finale = Boolean(target && wordKey(step.word) === wordKey(target));
  const parents = uniqueParentChapters(step, chapterByResult);
  const kind = chapterRelation(index, finale, parents.length);
  const categoryPresentation = CATEGORY_PRESENTATION[step.category];
  const id = `story-chapter-${number}`;
  const layerId = `story-layer-${number}`;
  const title = kind === "foundation"
    ? `Foundation: ${step.word}`
    : kind === "finale"
      ? `Finale: ${step.word}`
      : `Chapter ${number}: ${step.word}`;
  const narration = chapterNarration({ step, number, kind, parents, target });
  const variation = (stableHashNumber(`${target}|${step.category}|${step.word}`) % 4) + 1;
  const slot = kind === "foundation" ? 0 : 1 + ((number - 2 + profile.slotOffset) % 11);
  return {
    id,
    number,
    kind,
    relation: kind,
    title,
    ingredients: [step.a, step.b],
    result: {
      word: step.word,
      emoji: step.emoji,
      category: step.category
    },
    parentChapterIds: parents.map((parent) => parent.id),
    narration,
    accessibleLabel: boundedNarration(`${title}. ${narration}`),
    layer: {
      id: layerId,
      order: number,
      role: kind === "foundation" ? "foundation" : kind === "finale" ? "finale" : categoryPresentation.sceneRole,
      categoryRole: categoryPresentation.sceneRole,
      category: step.category,
      motif: categoryPresentation.motif,
      slot,
      variation,
      depth: 1 + ((number + variation) % 3),
      sceneVariant: profile.variant,
      word: step.word,
      emoji: step.emoji,
      parentLayerIds: parents.map((parent) => parent.layer.id),
      persistent: true
    }
  };
}

function sanitizeFailedAttempt(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const a = safeWord(raw.a);
  const b = safeWord(raw.b);
  return a && b ? { a, b } : null;
}

function buildFailureEvent(attempt, chapters, target) {
  if (!attempt) return null;
  const layers = chapters.map((chapter) => chapter.layer);
  const rebuildLayerIds = layers.map((layer) => layer.id);
  const crumbleLayerIds = [...rebuildLayerIds].reverse();
  const lastChapter = chapters.at(-1) || null;
  const restoreText = lastChapter
    ? `The last valid story rebuilds through ${lastChapter.result.word}.`
    : "The empty scene settles, ready for the first valid combination.";
  const narration = boundedNarration(
    `${attempt.a} and ${attempt.b} do not combine. The whole scene crumbles, then rebuilds without losing progress. ${restoreText}`
  );
  return {
    id: `story-event-${stableHash(`${target}|${attempt.a}|${attempt.b}|${chapters.length}`)}`,
    type: "crumble-rebuild",
    scope: "all-scene",
    cause: "wrong-pair",
    attemptedPair: attempt,
    historyEffect: "none",
    preservesValidStory: true,
    restoreChapterCount: chapters.length,
    restoreLayerIds: rebuildLayerIds,
    narration,
    announcementPriority: "polite",
    phases: [
      {
        id: "crumble",
        order: 1,
        action: "crumble",
        layerIds: crumbleLayerIds
      },
      {
        id: "rebuild",
        order: 2,
        action: "rebuild",
        layerIds: rebuildLayerIds,
        focusLayerId: lastChapter?.layer.id || ""
      }
    ]
  };
}

function storySummary(target, chapterCount, complete) {
  if (!chapterCount) return target ? `No story chapters yet for ${target}.` : "No combination story yet.";
  if (complete) return `${target} completes a ${chapterCount}-chapter story.`;
  if (target) return `${chapterCount} ${chapterCount === 1 ? "chapter is" : "chapters are"} building toward ${target}.`;
  return `${chapterCount} ${chapterCount === 1 ? "chapter is" : "chapters are"} built.`;
}

/**
 * Builds one immutable, deterministic story snapshot.
 *
 * `history` is read-only and only successful combinations belong in it.
 * `failedAttempt` never changes those chapters; it only adds an animation and
 * narration event whose rebuild phase restores every valid layer.
 */
export function buildCombinationStory(options = {}) {
  const source = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const target = safeWord(source.target);
  const sanitized = sanitizeHistory(source.history);
  const targetIndex = target
    ? sanitized.steps.findIndex((step) => wordKey(step.word) === wordKey(target))
    : -1;
  const storySteps = targetIndex >= 0
    ? sanitized.steps.slice(0, targetIndex + 1)
    : sanitized.steps;
  const chapters = [];
  const chapterByResult = new Map();
  const profile = sceneProfile(target, storySteps);
  for (const step of storySteps) {
    const chapter = buildChapter(step, chapters.length, target, chapterByResult, profile);
    chapters.push(chapter);
    chapterByResult.set(wordKey(step.word), chapter);
  }
  const complete = targetIndex >= 0;
  const status = complete ? "finale" : chapters.length ? "building" : "empty";
  const summary = storySummary(target, chapters.length, complete);
  const event = buildFailureEvent(sanitizeFailedAttempt(source.failedAttempt), chapters, target);
  const layers = chapters.map((chapter) => chapter.layer);
  const announcement = event?.narration || chapters.at(-1)?.narration || summary;
  return deepFreeze({
    version: COMBINATION_STORY_VERSION,
    target,
    status,
    complete,
    truncated: sanitized.truncated || (targetIndex >= 0 && targetIndex < sanitized.steps.length - 1),
    chapterCount: chapters.length,
    summary,
    chapters,
    scene: {
      id: "combination-story-scene",
      revision: chapters.length,
      status,
      variant: profile.variant,
      palette: profile.palette,
      category: profile.category,
      motif: profile.motif,
      layerCount: layers.length,
      layers,
      foundationLayerId: layers[0]?.id || "",
      focusLayerId: layers.at(-1)?.id || ""
    },
    event,
    accessibility: {
      label: target ? `Combination story for ${target}` : "Combination story",
      description: summary,
      announcement,
      announcementPriority: "polite",
      chapterLabels: chapters.map((chapter) => chapter.accessibleLabel)
    }
  });
}
