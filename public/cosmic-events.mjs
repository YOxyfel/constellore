export const COSMIC_EVENTS_VERSION = 1;
export const COSMIC_EVENT_ROTATION_WEEKS = 5;
export const MAX_COSMIC_EVENT_TARGETS = 6;
export const MAX_COSMIC_EVENT_COLLECTION_WORDS = 12;
export const MAX_COSMIC_EVENT_DISCOVERIES = 512;

const WEEK_MS = 7 * 86_400_000;
const ROTATION_EPOCH_MS = Date.UTC(2024, 0, 1); // Monday
const MAX_ID_LENGTH = 48;
const MAX_WORD_LENGTH = 80;

const freezeEvent = (event) => Object.freeze({
  ...event,
  boundary: Object.freeze({ ...event.boundary }),
  law: Object.freeze({ ...event.law }),
  presentation: Object.freeze({ ...event.presentation }),
  temporaryTargets: Object.freeze(event.temporaryTargets.map((target) => Object.freeze({ ...target }))),
  collection: Object.freeze({ ...event.collection, words: Object.freeze([...event.collection.words]) })
});

// Events rotate attention around canonical content. They may choose temporary
// destinations and presentation collections, but never define a combination.
const EVENTS = Object.freeze([
  freezeEvent({
    id: "ocean-depths",
    theme: "Ocean",
    name: "The Ocean Remembers",
    icon: "🌊",
    description: "Follow currents, storms, ice, and the small worlds held beneath glass.",
    boundary: { temporaryContentOnly: true, canonicalRecipes: "unchanged", rankedSemantics: "unchanged" },
    law: {
      id: "tidal-memory",
      name: "Tidal Memory",
      description: "Collection words receive a ripple marker in event views only.",
      presentationOnly: true
    },
    presentation: { accent: "tidal-cyan", backdrop: "abyssal-current", trail: "sea-foam", label: "TIDAL SIGNAL" },
    temporaryTargets: [
      { word: "Ocean", emoji: "🌊", clue: "Let water meet itself until no shore remains.", tier: 2 },
      { word: "River", emoji: "🏞️", clue: "Give mountain water a road toward the sea.", tier: 2 },
      { word: "Aquarium", emoji: "🐠", clue: "Hold a small water world behind clear walls.", tier: 3 },
      { word: "Iceberg", emoji: "🧊", clue: "Set a great piece of ice afloat.", tier: 4 },
      { word: "Hurricane", emoji: "🌀", clue: "Feed a storm with an ocean.", tier: 4 }
    ],
    collection: {
      id: "voices-of-the-tide",
      name: "Voices of the Tide",
      description: "Discover the connected forms of water.",
      words: ["Water", "Ocean", "River", "Fish", "Aquarium", "Iceberg", "Hurricane"]
    }
  }),
  freezeEvent({
    id: "machine-awakening",
    theme: "Machines",
    name: "The Machine Awakening",
    icon: "⚙️",
    description: "Map the line from worked metal to engines built for the stars.",
    boundary: { temporaryContentOnly: true, canonicalRecipes: "unchanged", rankedSemantics: "unchanged" },
    law: {
      id: "visible-circuit",
      name: "The Visible Circuit",
      description: "Event collection links are drawn as fine brass circuits only.",
      presentationOnly: true
    },
    presentation: { accent: "brass-amber", backdrop: "clockwork-grid", trail: "electric-arc", label: "CIRCUIT ONLINE" },
    temporaryTargets: [
      { word: "Machine", emoji: "⚙️", clue: "Give shaped metal a purpose and motion.", tier: 2 },
      { word: "Electricity", emoji: "⚡", clue: "Let metal carry a bolt from the sky.", tier: 4 },
      { word: "Rocket", emoji: "🚀", clue: "Build a machine that can leave the sky.", tier: 4 },
      { word: "Spacecraft", emoji: "🚀", clue: "Power a rocket for the journey beyond air.", tier: 4 },
      { word: "High Voltage", emoji: "⚡", clue: "Concentrate current until the circuit hums.", tier: 5 }
    ],
    collection: {
      id: "engines-of-ascent",
      name: "Engines of Ascent",
      description: "Discover the materials, power, and machines of ascent.",
      words: ["Metal", "Machine", "Electricity", "Engine", "Rocket", "Spacecraft", "High Voltage"]
    }
  }),
  freezeEvent({
    id: "mythic-constellation",
    theme: "Mythic",
    name: "The Mythic Constellation",
    icon: "🐉",
    description: "Trace how one legendary creature changes through fire, sea, and sky.",
    boundary: { temporaryContentOnly: true, canonicalRecipes: "unchanged", rankedSemantics: "unchanged" },
    law: {
      id: "legendary-outline",
      name: "Legendary Outline",
      description: "Mythic collection words receive an illustrated silhouette only.",
      presentationOnly: true
    },
    presentation: { accent: "mythic-rose", backdrop: "violet-parchment", trail: "ember-script", label: "LEGEND STIRS" },
    temporaryTargets: [
      { word: "Phoenix", emoji: "🔥", clue: "Let a winged creature pass through flame.", tier: 2 },
      { word: "Dragon", emoji: "🐉", clue: "Find the great creature at the root of many legends.", tier: 3 },
      { word: "Fire Dragon", emoji: "🐉", clue: "Return a dragon to the element it breathes.", tier: 4 },
      { word: "Sea Dragon", emoji: "🐉", clue: "Carry a dragon beneath the waves.", tier: 4 },
      { word: "Flying Dragon", emoji: "🐉", clue: "Give a dragon the open air.", tier: 4 }
    ],
    collection: {
      id: "many-forms-of-legend",
      name: "Many Forms of Legend",
      description: "Discover the elemental branches of the dragon story.",
      words: ["Phoenix", "Dragon", "Fire Dragon", "Sea Dragon", "Flying Dragon", "Dragon Brood", "Dragon Lair"]
    }
  }),
  freezeEvent({
    id: "lost-civilizations",
    theme: "Lost Civilizations",
    name: "Echoes of Lost Civilizations",
    icon: "🏺",
    description: "Recover the materials, settlements, and monuments left in the dust.",
    boundary: { temporaryContentOnly: true, canonicalRecipes: "unchanged", rankedSemantics: "unchanged" },
    law: {
      id: "archival-light",
      name: "Archival Light",
      description: "Discovered collection words appear as illuminated archive fragments.",
      presentationOnly: true
    },
    presentation: { accent: "archive-gold", backdrop: "buried-mosaic", trail: "dust-script", label: "ARCHIVE OPEN" },
    temporaryTargets: [
      { word: "Pottery", emoji: "🏺", clue: "Shape earth and preserve it with fire.", tier: 2 },
      { word: "Village", emoji: "🏘️", clue: "Let many homes share one path.", tier: 3 },
      { word: "City", emoji: "🏙️", clue: "Grow a settlement beyond the village horizon.", tier: 3 },
      { word: "Monument", emoji: "🗿", clue: "Give worked stone a lasting memory.", tier: 4 },
      { word: "Wonder", emoji: "✨", clue: "Raise a creation remembered beyond its builders.", tier: 5 }
    ],
    collection: {
      id: "the-buried-archive",
      name: "The Buried Archive",
      description: "Discover the objects and places that let a civilization endure.",
      words: ["Clay", "Pottery", "Sculpture", "Village", "City", "Fortress", "Monument", "Wonder"]
    }
  }),
  freezeEvent({
    id: "deep-space-signal",
    theme: "Deep Space",
    name: "The Deep Space Signal",
    icon: "📡",
    description: "Look outward until observation becomes a home among the stars.",
    boundary: { temporaryContentOnly: true, canonicalRecipes: "unchanged", rankedSemantics: "unchanged" },
    law: {
      id: "quiet-transmission",
      name: "The Quiet Transmission",
      description: "Celestial collection words pulse with a slow navigational beacon.",
      presentationOnly: true
    },
    presentation: { accent: "signal-violet", backdrop: "deep-starfield", trail: "radio-wave", label: "SIGNAL ACQUIRED" },
    temporaryTargets: [
      { word: "Telescope", emoji: "🔭", clue: "Shape a lens and point it beyond the sky.", tier: 3 },
      { word: "Astronomy", emoji: "🔭", clue: "Turn a telescope toward a star and begin to study.", tier: 4 },
      { word: "Observatory", emoji: "🔭", clue: "Build a place where many telescopes watch together.", tier: 4 },
      { word: "Galaxy", emoji: "🌌", clue: "Gather stars on a scale beyond one sky.", tier: 3 },
      { word: "Space Station", emoji: "🛰️", clue: "Bring a home and a rocket together beyond Earth.", tier: 5 }
    ],
    collection: {
      id: "the-long-listening",
      name: "The Long Listening",
      description: "Discover the lights, instruments, and structures of deep space.",
      words: ["Light", "Sky", "Star", "Telescope", "Astronomy", "Observatory", "Galaxy", "Space Station"]
    }
  })
]);

const eventById = new Map(EVENTS.map((event) => [event.id, event]));
const eventByTheme = new Map(EVENTS.map((event) => [event.theme.toLocaleLowerCase("en-US"), event]));

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

function cloneEvent(event) {
  if (!event) return null;
  return {
    id: event.id,
    theme: event.theme,
    name: event.name,
    icon: event.icon,
    description: event.description,
    boundary: { ...event.boundary },
    law: { ...event.law },
    presentation: { ...event.presentation },
    temporaryTargets: event.temporaryTargets.map((target) => ({ ...target })),
    collection: { ...event.collection, words: [...event.collection.words] }
  };
}

function resolveEvent(value) {
  const raw = typeof value === "object" && value !== null ? value.id ?? value.theme : value;
  const id = cleanId(raw);
  if (eventById.has(id)) return eventById.get(id);
  const theme = cleanText(raw, MAX_ID_LENGTH).toLocaleLowerCase("en-US");
  return eventByTheme.get(theme) || null;
}

function safeDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return new Date(value.getTime());
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
  }
  if (typeof value === "string") {
    const parsed = new Date(cleanText(value, 64));
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return new Date(ROTATION_EPOCH_MS);
}

function startOfUtcWeek(value) {
  const date = safeDate(value);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day = new Date(midnight).getUTCDay();
  return midnight - ((day + 6) % 7) * 86_400_000;
}

function isoWeekKey(mondayMs) {
  const thursday = new Date(mondayMs + 3 * 86_400_000);
  const year = thursday.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil((((thursday.getTime() - yearStart) / 86_400_000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function cosmicEventCatalog() {
  return EVENTS.map(cloneEvent);
}

export function cosmicEvent(value) {
  return cloneEvent(resolveEvent(value));
}

export function cosmicEventWeek(value = new Date()) {
  const startsAtMs = startOfUtcWeek(value);
  const absoluteWeek = Math.floor((startsAtMs - ROTATION_EPOCH_MS) / WEEK_MS);
  const rotationIndex = positiveModulo(absoluteWeek, EVENTS.length);
  return {
    weekKey: isoWeekKey(startsAtMs),
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt: new Date(startsAtMs + WEEK_MS).toISOString(),
    rotationIndex
  };
}

/** One globally reproducible event per UTC week, cycling through all five. */
export function currentCosmicEvent(value = new Date()) {
  const week = cosmicEventWeek(value);
  return {
    version: COSMIC_EVENTS_VERSION,
    ...cloneEvent(EVENTS[week.rotationIndex]),
    ...week
  };
}

export function cosmicEventTargets(value) {
  const event = resolveEvent(value);
  return event ? event.temporaryTargets.slice(0, MAX_COSMIC_EVENT_TARGETS).map((target) => ({ ...target })) : [];
}

/** Bounded local presentation progress; raw or unknown words are never retained. */
export function cosmicEventCollectionProgress(value, rawDiscoveries) {
  const event = resolveEvent(value);
  if (!event) return {
    eventId: "",
    collectionId: "",
    found: [],
    missing: [],
    discovered: 0,
    total: 0,
    percent: 0,
    complete: false
  };
  const discoveryKeys = new Set((Array.isArray(rawDiscoveries) ? rawDiscoveries : [])
    .slice(0, MAX_COSMIC_EVENT_DISCOVERIES)
    .map(wordKey)
    .filter(Boolean));
  const words = event.collection.words.slice(0, MAX_COSMIC_EVENT_COLLECTION_WORDS);
  const found = words.filter((word) => discoveryKeys.has(wordKey(word)));
  const missing = words.filter((word) => !discoveryKeys.has(wordKey(word)));
  return {
    eventId: event.id,
    collectionId: event.collection.id,
    found,
    missing,
    discovered: found.length,
    total: words.length,
    percent: words.length ? Math.round((found.length / words.length) * 100) : 100,
    complete: missing.length === 0
  };
}

/** Adds event context beside an immutable gameplay result, never over it. */
export function annotateCosmicEventResult({ event: rawEvent, result } = {}) {
  const event = resolveEvent(rawEvent);
  const key = wordKey(result);
  if (!event || !key || !result || typeof result !== "object" || Array.isArray(result)) return { result, context: null };
  const targetKeys = new Set(event.temporaryTargets.map((target) => wordKey(target.word)));
  const collectionKeys = new Set(event.collection.words.map(wordKey));
  const rawWeekKey = typeof rawEvent === "object" && rawEvent !== null ? cleanText(rawEvent.weekKey, 16) : "";
  return {
    result,
    context: {
      eventId: event.id,
      eventName: event.name,
      weekKey: /^\d{4}-W\d{2}$/.test(rawWeekKey) ? rawWeekKey : "",
      lawId: event.law.id,
      accent: event.presentation.accent,
      label: event.presentation.label,
      featuredTarget: targetKeys.has(key),
      collectionMatch: collectionKeys.has(key)
    }
  };
}

