/**
 * Pure, presentation-only domain helpers for the Constellore Voyage Projection.
 *
 * Nothing in this module writes profile state, records arrivals, or unlocks a
 * world. Callers pass an immutable progression snapshot in and receive a new,
 * deeply frozen presentation snapshot out.
 */

export const VOYAGE_VARIANTS = Object.freeze(["promise", "progress", "completion"]);
export const VOYAGE_QUALITIES = Object.freeze(["low", "standard", "master-video", "fallback"]);

// Astronomical order. The Moon is deliberately not represented as a planet.
export const SOLAR_PLANET_ORDER = Object.freeze([
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune"
]);

// Scene/progression order inserts Earth's satellite at the only valid point.
// This lets the same helpers accept today's Earth/Moon facts while remaining
// ready for the later solar-system worlds.
export const VOYAGE_WORLD_ORDER = Object.freeze([
  "mercury",
  "venus",
  "earth",
  "moon",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune"
]);

export const VOYAGE_DURATION_SECONDS = 57;

const BASE_SHOTS = [
  { id: "earth", startSeconds: 0, endSeconds: 7, setting: "earth-departure" },
  { id: "solar", startSeconds: 7, endSeconds: 20, setting: "solar-system" },
  { id: "heliopause", startSeconds: 20, endSeconds: 27, setting: "heliopause" },
  { id: "warp", startSeconds: 27, endSeconds: 38, setting: "interstellar-corridor" },
  { id: "black-hole", startSeconds: 38, endSeconds: 48, setting: "black-hole-approach" },
  { id: "singularity", startSeconds: 48, endSeconds: 53, setting: "event-horizon" }
];

export const VOYAGE_NARRATION = deepFreeze([
  {
    id: "understanding-makes-reachable",
    startSeconds: 1,
    endSeconds: 6.2,
    shotId: "earth",
    text: "Every world we understand becomes somewhere we can reach.",
    variants: [...VOYAGE_VARIANTS]
  },
  {
    id: "discovery-makes-coordinate",
    startSeconds: 8.4,
    endSeconds: 14.2,
    shotId: "solar",
    text: "Every discovery gives the voyage another coordinate.",
    variants: [...VOYAGE_VARIANTS]
  },
  {
    id: "map-has-no-word",
    startSeconds: 39.4,
    endSeconds: 46.8,
    shotId: "black-hole",
    text: "Beyond the last light, the map has no word for what comes next.",
    variants: [...VOYAGE_VARIANTS]
  },
  {
    id: "make-one",
    startSeconds: 54,
    endSeconds: 56.4,
    shotId: "return",
    text: "So we will make one.",
    variants: ["promise", "progress"]
  }
]);

// The visual reduced-motion timeline is intentionally 24 seconds, but the
// canonical 57-second cue timestamps cannot simply be scaled: doing that
// causes a slow, accessible narration voice to be cancelled by the following
// line. These authored playback windows preserve the exact approved text while
// guaranteeing sequential speech at the contract's 105 WPM floor.
export const VOYAGE_REDUCED_MOTION_NARRATION = deepFreeze([
  {
    ...VOYAGE_NARRATION[0],
    startSeconds: 0.4,
    endSeconds: 5.65,
    sourceTimelineSeconds: { start: 1, end: 6.2 }
  },
  {
    ...VOYAGE_NARRATION[1],
    startSeconds: 6,
    endSeconds: 11.8,
    sourceTimelineSeconds: { start: 8.4, end: 14.2 }
  },
  {
    ...VOYAGE_NARRATION[2],
    startSeconds: 12.15,
    endSeconds: 19.65,
    sourceTimelineSeconds: { start: 39.4, end: 46.8 }
  },
  {
    ...VOYAGE_NARRATION[3],
    startSeconds: 20.25,
    endSeconds: 23.7,
    sourceTimelineSeconds: { start: 54, end: 56.4 }
  }
]);

export const VOYAGE_FINAL_TEXT = deepFreeze([
  "DESTINATION UNRESOLVED",
  "MAKE THE ROUTE"
]);

// Times are authored seek points, not a second timeline. Earth replays from
// launch; the Moon and later worlds enter within the solar-system shot.
export const VOYAGE_REPLAY_MILESTONES = deepFreeze({
  earth: { timeSeconds: 0, shotId: "earth" },
  moon: { timeSeconds: 7, shotId: "solar" },
  mercury: { timeSeconds: 8.2, shotId: "solar" },
  venus: { timeSeconds: 9.8, shotId: "solar" },
  mars: { timeSeconds: 11.6, shotId: "solar" },
  jupiter: { timeSeconds: 13.7, shotId: "solar" },
  saturn: { timeSeconds: 15.7, shotId: "solar" },
  uranus: { timeSeconds: 17.4, shotId: "solar" },
  neptune: { timeSeconds: 19, shotId: "solar" }
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value, minimum)));
}

function valuesFrom(value) {
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  if (value && typeof value !== "string" && Symbol.iterator in Object(value)) return [...value];
  return [];
}

function normalizedWorldSet(value) {
  return new Set(valuesFrom(value)
    .map((worldId) => normalizeVoyageWorld(worldId, null))
    .filter(Boolean));
}

export function normalizeVoyageVariant(value, fallback = "promise") {
  const normalized = String(value || "").trim().toLowerCase();
  return VOYAGE_VARIANTS.includes(normalized) ? normalized : fallback;
}

export function normalizeVoyageWorld(value, fallback = "earth") {
  const normalized = String(value || "").trim().toLowerCase();
  return VOYAGE_WORLD_ORDER.includes(normalized) ? normalized : fallback;
}

function makeTimeline(variant) {
  const normalized = normalizeVoyageVariant(variant);
  const unresolved = normalized !== "completion";
  const shots = BASE_SHOTS.map((shot) => ({
    ...shot,
    durationSeconds: shot.endSeconds - shot.startSeconds,
    outcome: shot.id === "singularity"
      ? (unresolved ? "unresolved" : "crossed")
      : null
  }));
  shots.push(unresolved
    ? {
        id: "return",
        startSeconds: 53,
        endSeconds: 57,
        durationSeconds: 4,
        setting: "earth-return",
        outcome: "destination-unresolved"
      }
    : {
        id: "beyond",
        startSeconds: 53,
        endSeconds: 57,
        durationSeconds: 4,
        setting: "beyond-singularity",
        outcome: "continued-beyond"
      });
  return deepFreeze(shots);
}

const TIMELINES = deepFreeze(Object.fromEntries(
  VOYAGE_VARIANTS.map((variant) => [variant, makeTimeline(variant)])
));

/** Return the immutable, deterministic 57-second shot list for a variant. */
export function createVoyageTimeline(variant = "promise") {
  return TIMELINES[normalizeVoyageVariant(variant)];
}

/**
 * Resolve the active authored shot at a projection time. Times outside the
 * timeline clamp to its endpoints so renderers never receive an empty phase.
 */
export function shotAtTime(timeSeconds, { variant = "promise" } = {}) {
  const normalizedVariant = normalizeVoyageVariant(variant);
  const timeline = createVoyageTimeline(normalizedVariant);
  const requestedTimeSeconds = finite(timeSeconds);
  const timelineTimeSeconds = clamp(requestedTimeSeconds, 0, VOYAGE_DURATION_SECONDS);
  const lookupTime = timelineTimeSeconds === VOYAGE_DURATION_SECONDS
    ? VOYAGE_DURATION_SECONDS - Number.EPSILON * VOYAGE_DURATION_SECONDS
    : timelineTimeSeconds;
  const shot = timeline.find((candidate) => (
    lookupTime >= candidate.startSeconds && lookupTime < candidate.endSeconds
  )) || timeline.at(-1);
  const elapsedSeconds = clamp(
    timelineTimeSeconds - shot.startSeconds,
    0,
    shot.durationSeconds
  );
  return deepFreeze({
    ...shot,
    variant: normalizedVariant,
    requestedTimeSeconds,
    timelineTimeSeconds,
    elapsedSeconds,
    progress: shot.durationSeconds ? elapsedSeconds / shot.durationSeconds : 1,
    ended: timelineTimeSeconds >= VOYAGE_DURATION_SECONDS
  });
}

/** Return the currently spoken approved narration cue, if any. */
export function narrationAtTime(timeSeconds, { variant = "promise" } = {}) {
  const normalizedVariant = normalizeVoyageVariant(variant);
  const time = clamp(timeSeconds, 0, VOYAGE_DURATION_SECONDS);
  const cue = VOYAGE_NARRATION.find((candidate) => (
    candidate.variants.includes(normalizedVariant)
      && time >= candidate.startSeconds
      && time < candidate.endSeconds
  ));
  if (!cue) return null;
  return deepFreeze({
    ...cue,
    variant: normalizedVariant,
    elapsedSeconds: time - cue.startSeconds,
    progress: (time - cue.startSeconds) / (cue.endSeconds - cue.startSeconds)
  });
}

/** Resolve narration on the separately authored 24-second still-plate clock. */
export function reducedMotionNarrationAtTime(playbackSeconds, { variant = "promise" } = {}) {
  const normalizedVariant = normalizeVoyageVariant(variant);
  const time = clamp(playbackSeconds, 0, 24);
  const cue = VOYAGE_REDUCED_MOTION_NARRATION.find((candidate) => (
    candidate.variants.includes(normalizedVariant)
      && time >= candidate.startSeconds
      && time < candidate.endSeconds
  ));
  if (!cue) return null;
  return deepFreeze({
    ...cue,
    variant: normalizedVariant,
    elapsedSeconds: time - cue.startSeconds,
    progress: (time - cue.startSeconds) / (cue.endSeconds - cue.startSeconds)
  });
}

export function nextVoyageWorld(worldId) {
  const current = normalizeVoyageWorld(worldId);
  const index = VOYAGE_WORLD_ORDER.indexOf(current);
  return index >= 0 && index < VOYAGE_WORLD_ORDER.length - 1
    ? VOYAGE_WORLD_ORDER[index + 1]
    : null;
}

/**
 * Convert authoritative progression facts into a render-only solar-system
 * snapshot. `activeWorldId` is accepted as the current production fact name;
 * `currentWorldId` is a convenient domain alias.
 */
export function createVoyageWorldPresentation({
  activeWorldId,
  currentWorldId = activeWorldId,
  completedWorldIds = [],
  availableWorldIds,
  actionableWorldIds = availableWorldIds ?? ["earth", "moon"]
} = {}) {
  const current = normalizeVoyageWorld(currentWorldId);
  const completed = normalizedWorldSet(completedWorldIds);
  const available = normalizedWorldSet(actionableWorldIds);
  const next = nextVoyageWorld(current);

  const worlds = VOYAGE_WORLD_ORDER.map((worldId, sceneIndex) => {
    const isCurrent = worldId === current;
    const isCompleted = completed.has(worldId);
    const isNext = worldId === next;
    const isMaterialized = isCurrent || isCompleted;
    const isActionable = isCurrent || (isNext && available.has(worldId));
    const isLocked = !isMaterialized && !isActionable;
    return {
      worldId,
      kind: worldId === "moon" ? "satellite" : "planet",
      solarIndex: SOLAR_PLANET_ORDER.indexOf(worldId),
      sceneIndex,
      status: isCurrent
        ? "current"
        : isCompleted
          ? "completed"
          : isNext
            ? (isActionable ? "next" : "locked")
            : "locked",
      presentation: isMaterialized ? "materialized" : "distant",
      materialized: isMaterialized,
      distant: !isMaterialized,
      locked: isLocked,
      actionable: isActionable,
      action: isCurrent ? "continue" : isActionable ? "launch" : null,
      current: isCurrent,
      completed: isCompleted,
      next: isNext
    };
  });

  return deepFreeze({
    currentWorldId: current,
    nextWorldId: next,
    completedWorldIds: VOYAGE_WORLD_ORDER.filter((worldId) => completed.has(worldId)),
    actionableWorldIds: worlds.filter((world) => world.actionable).map((world) => world.worldId),
    worlds
  });
}

/** Choose a delivery tier without changing any cinematic or profile state. */
export function selectVoyageQuality({
  variant = "promise",
  webgl2 = true,
  masterVideoAvailable = false,
  videoSupported = true,
  preferMasterVideo = true,
  reducedMotion = false,
  saveData = false,
  forceFallback = false,
  width = 1280,
  height = 720,
  deviceMemory = null,
  hardwareConcurrency = null,
  coarsePointer = false,
  mobile = false
} = {}) {
  const normalizedVariant = normalizeVoyageVariant(variant);
  if (forceFallback || saveData || reducedMotion) return "fallback";
  if (normalizedVariant !== "progress"
    && preferMasterVideo
    && masterVideoAvailable
    && videoSupported) {
    return "master-video";
  }
  if (!webgl2) return "fallback";

  const viewportWidth = Math.max(1, finite(width, 1280));
  const viewportHeight = Math.max(1, finite(height, 720));
  const portraitTablet = viewportHeight > viewportWidth && viewportWidth <= 1024;
  const phone = mobile || (coarsePointer && Math.min(viewportWidth, viewportHeight) <= 700);
  const memory = Number(deviceMemory);
  const cores = Number(hardwareConcurrency);
  const knownMemory = Number.isFinite(memory) && memory > 0;
  const knownCores = Number.isFinite(cores) && cores > 0;
  const constrained = !knownMemory || !knownCores || memory <= 4 || cores <= 4;
  return phone || portraitTablet || constrained ? "low" : "standard";
}

/** Describe the deterministic terminal state produced by Skip. */
export function resolveVoyageSkipOutcome({ variant = "promise", timeSeconds = 0 } = {}) {
  const normalizedVariant = normalizeVoyageVariant(variant);
  const completed = normalizedVariant === "completion";
  return deepFreeze({
    variant: normalizedVariant,
    skipped: true,
    skippedAtSeconds: clamp(timeSeconds, 0, VOYAGE_DURATION_SECONDS),
    terminalShotId: completed ? "beyond" : "return",
    outcome: completed ? "continued-beyond" : "destination-unresolved",
    finalText: completed ? [] : [...VOYAGE_FINAL_TEXT],
    cinematicAcknowledgement: true,
    progressionEffect: null
  });
}

/** Resolve a stable seek point for replaying from a world milestone. */
export function resolveVoyageReplayMilestone(worldId, { variant = "progress" } = {}) {
  const normalizedWorldId = normalizeVoyageWorld(worldId);
  const normalizedVariant = normalizeVoyageVariant(variant, "progress");
  const milestone = VOYAGE_REPLAY_MILESTONES[normalizedWorldId];
  return deepFreeze({
    worldId: normalizedWorldId,
    variant: normalizedVariant,
    ...milestone,
    shot: shotAtTime(milestone.timeSeconds, { variant: normalizedVariant }),
    progressionEffect: null
  });
}
