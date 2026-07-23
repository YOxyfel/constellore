export const CONSTELLATION_VOYAGES_VERSION = 1;
export const MAX_CONSTELLATION_VOYAGES = 8;
export const MAX_VOYAGE_CHAPTERS = 8;

const MAX_ID_LENGTH = 48;
const MAX_WORD_LENGTH = 80;

const freezeVoyage = (voyage) => Object.freeze({
  ...voyage,
  law: Object.freeze({ ...voyage.law }),
  chapters: Object.freeze(voyage.chapters.map((chapter) => Object.freeze({ ...chapter })))
});

// A Voyage is a long-form presentation and progression path through existing
// authored concepts. Its laws never alter recipes, scores, rewards, or limits.
const VOYAGES = Object.freeze([
  freezeVoyage({
    id: "first-cities",
    title: "The First Cities",
    icon: "🏙️",
    summary: "Raise a civilization from wet earth to a living city.",
    law: {
      id: "memory-in-stone",
      name: "Memory in Stone",
      description: "Each finished chapter adds a new light to the settlement skyline.",
      presentationOnly: true
    },
    chapters: [
      { id: "soft-ground", chapter: 1, title: "Soft Ground", target: "Mud", emoji: "🟤", story: "Water settles into earth, leaving the first material in patient hands." },
      { id: "the-first-brick", chapter: 2, title: "The First Brick", target: "Brick", emoji: "🧱", story: "Fire gives the soft ground a shape that can outlast its maker." },
      { id: "a-place-within", chapter: 3, title: "A Place Within", target: "House", emoji: "🏠", story: "Walls become shelter, and shelter becomes the beginning of belonging." },
      { id: "many-hearths", chapter: 4, title: "Many Hearths", target: "Village", emoji: "🏘️", story: "One home calls to another until paths grow between their doors." },
      { id: "lights-on-the-horizon", chapter: 5, title: "Lights on the Horizon", target: "City", emoji: "🏙️", story: "The settlement becomes a constellation built at human scale." }
    ]
  }),
  freezeVoyage({
    id: "living-canopy",
    title: "The Living Canopy",
    icon: "🌲",
    summary: "Follow the first spark of life into a world that sustains itself.",
    law: {
      id: "roots-remember",
      name: "Roots Remember",
      description: "Completed chapters add branching growth to the Voyage portrait.",
      presentationOnly: true
    },
    chapters: [
      { id: "awakening", chapter: 1, title: "Awakening", target: "Life", emoji: "🌱", story: "Energy stirs the quiet earth and something begins to grow." },
      { id: "first-leaf", chapter: 2, title: "First Leaf", target: "Plant", emoji: "🌿", story: "Life takes root and learns to drink the light." },
      { id: "deep-roots", chapter: 3, title: "Deep Roots", target: "Tree", emoji: "🌳", story: "A patient stem becomes a landmark with roots beneath the years." },
      { id: "green-choir", chapter: 4, title: "Green Choir", target: "Forest", emoji: "🌲", story: "Many trees share rain, shadow, and a language of leaves." },
      { id: "world-in-balance", chapter: 5, title: "World in Balance", target: "Ecosystem", emoji: "🦋", story: "Air, soil, water, and life settle into a living exchange." }
    ]
  }),
  freezeVoyage({
    id: "storm-circuit",
    title: "The Storm Circuit",
    icon: "⚡",
    summary: "Trace power from a quiet cloud to a force that can move a world.",
    law: {
      id: "charge-leaves-a-trace",
      name: "Charge Leaves a Trace",
      description: "The Voyage path pulses more brightly as the circuit closes.",
      presentationOnly: true
    },
    chapters: [
      { id: "gathering-sky", chapter: 1, title: "Gathering Sky", target: "Cloud", emoji: "☁️", story: "Warm vapor rises until the sky can hold it no longer." },
      { id: "pressure-front", chapter: 2, title: "Pressure Front", target: "Storm", emoji: "⛈️", story: "Energy enters the cloud and the horizon begins to answer." },
      { id: "bright-strike", chapter: 3, title: "Bright Strike", target: "Lightning", emoji: "🌩️", story: "The storm releases one brilliant path between sky and ground." },
      { id: "captured-current", chapter: 4, title: "Captured Current", target: "Electricity", emoji: "⚡", story: "Metal carries the wild strike and turns it into a usable current." },
      { id: "the-great-arc", chapter: 5, title: "The Great Arc", target: "High Voltage", emoji: "⚡", story: "Current gathers upon itself until the air hums around it." }
    ]
  }),
  freezeVoyage({
    id: "ocean-memory",
    title: "The Ocean Remembers",
    icon: "🌊",
    summary: "Cross the water cycle from open sea to weather and ice.",
    law: {
      id: "returning-tide",
      name: "The Returning Tide",
      description: "Past chapters return as soft ripples behind the current destination.",
      presentationOnly: true
    },
    chapters: [
      { id: "endless-water", chapter: 1, title: "Endless Water", target: "Ocean", emoji: "🌊", story: "Water meets itself and discovers a horizon." },
      { id: "road-from-the-mountain", chapter: 2, title: "Road from the Mountain", target: "River", emoji: "🏞️", story: "The high ground gives water a direction and a long memory." },
      { id: "weather-engine", chapter: 3, title: "Weather Engine", target: "Hurricane", emoji: "🌀", story: "A storm drinks from the ocean until it begins to turn." },
      { id: "floating-cold", chapter: 4, title: "Floating Cold", target: "Iceberg", emoji: "🧊", story: "Ancient ice leaves the land and carries its history into the sea." },
      { id: "world-under-glass", chapter: 5, title: "World Under Glass", target: "Aquarium", emoji: "🐠", story: "A small clear world keeps a fragment of the ocean close." }
    ]
  }),
  freezeVoyage({
    id: "beyond-the-sky",
    title: "Beyond the Sky",
    icon: "🔭",
    summary: "Turn light and invention into a map of the deep cosmos.",
    law: {
      id: "distant-light",
      name: "Distant Light",
      description: "Each chapter reveals another ring in the Voyage star chart.",
      presentationOnly: true
    },
    chapters: [
      { id: "first-light", chapter: 1, title: "First Light", target: "Light", emoji: "✨", story: "Energy races through the air and makes the unseen visible." },
      { id: "open-sky", chapter: 2, title: "Open Sky", target: "Sky", emoji: "🌌", story: "Light finds a vast blue field above the world." },
      { id: "one-distant-sun", chapter: 3, title: "One Distant Sun", target: "Star", emoji: "⭐", story: "A point in the sky becomes a sun beyond reach." },
      { id: "the-long-lens", chapter: 4, title: "The Long Lens", target: "Telescope", emoji: "🔭", story: "Glass and sky become an instrument for crossing distance with sight." },
      { id: "reading-the-heavens", chapter: 5, title: "Reading the Heavens", target: "Astronomy", emoji: "🔭", story: "Observation becomes a discipline, and the stars become a map." }
    ]
  })
]);

const voyageById = new Map(VOYAGES.map((voyage) => [voyage.id, voyage]));

function cleanText(value, maximum) {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanId(value) {
  return cleanText(value, MAX_ID_LENGTH)
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function wordKey(value) {
  const word = typeof value === "object" && value !== null ? value.word : value;
  return cleanText(word, MAX_WORD_LENGTH).toLocaleLowerCase("en-US");
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function cloneVoyage(voyage) {
  if (!voyage) return null;
  return {
    id: voyage.id,
    title: voyage.title,
    icon: voyage.icon,
    summary: voyage.summary,
    law: { ...voyage.law },
    chapters: voyage.chapters.map((chapter) => ({ ...chapter }))
  };
}

function cloneStage(chapter, index, total) {
  if (!chapter) return null;
  return { ...chapter, index, number: index + 1, total };
}

export function constellationVoyageCatalog() {
  return VOYAGES.map(cloneVoyage);
}

export function constellationVoyage(value) {
  return cloneVoyage(voyageById.get(cleanId(typeof value === "object" && value !== null ? value.id : value)));
}

/** Fixed-size, allowlist-only progress suitable for local or cloud persistence. */
export function sanitizeVoyageProgress(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const rawVoyages = source.voyages && typeof source.voyages === "object" && !Array.isArray(source.voyages)
    ? source.voyages
    : {};
  const voyages = {};
  for (const voyage of VOYAGES.slice(0, MAX_CONSTELLATION_VOYAGES)) {
    const entry = rawVoyages[voyage.id];
    const completed = entry && typeof entry === "object" && !Array.isArray(entry) ? entry.completed : entry;
    voyages[voyage.id] = { completed: clampInteger(completed, 0, Math.min(voyage.chapters.length, MAX_VOYAGE_CHAPTERS), 0) };
  }
  return { version: CONSTELLATION_VOYAGES_VERSION, voyages };
}

export function voyageProgress(voyageId, rawProgress) {
  const id = cleanId(typeof voyageId === "object" && voyageId !== null ? voyageId.id : voyageId);
  const voyage = voyageById.get(id);
  if (!voyage) return {
    version: CONSTELLATION_VOYAGES_VERSION,
    voyageId: "",
    found: false,
    completed: 0,
    total: 0,
    percent: 0,
    complete: false,
    currentStage: null
  };
  const progress = sanitizeVoyageProgress(rawProgress);
  const total = voyage.chapters.length;
  const completed = progress.voyages[voyage.id].completed;
  return {
    version: CONSTELLATION_VOYAGES_VERSION,
    voyageId: voyage.id,
    found: true,
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 100,
    complete: completed >= total,
    currentStage: cloneStage(voyage.chapters[completed], completed, total)
  };
}

/** The same sanitized progress always resolves to the same next chapter. */
export function currentVoyageStage(voyageId, rawProgress) {
  return voyageProgress(voyageId, rawProgress).currentStage;
}

/** Advances exactly one chapter; discoveries cannot skip or rewrite the path. */
export function advanceVoyageProgress(rawProgress, { voyageId = "", target = "" } = {}) {
  const progress = sanitizeVoyageProgress(rawProgress);
  const id = cleanId(voyageId);
  const voyage = voyageById.get(id);
  if (!voyage) return { progress, advanced: false, reason: "unknown_voyage", currentStage: null };
  const before = voyageProgress(id, progress);
  if (before.complete) return { progress, advanced: false, reason: "already_complete", currentStage: null };
  if (wordKey(target) !== wordKey(before.currentStage.target)) {
    return { progress, advanced: false, reason: "wrong_target", currentStage: before.currentStage };
  }
  const nextProgress = {
    version: CONSTELLATION_VOYAGES_VERSION,
    voyages: Object.fromEntries(Object.entries(progress.voyages).map(([key, entry]) => [key, { ...entry }]))
  };
  nextProgress.voyages[id].completed += 1;
  return {
    progress: nextProgress,
    advanced: true,
    reason: nextProgress.voyages[id].completed >= voyage.chapters.length ? "voyage_complete" : "chapter_complete",
    currentStage: currentVoyageStage(id, nextProgress)
  };
}
