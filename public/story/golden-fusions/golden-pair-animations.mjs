/**
 * Authored presentation metadata for the canonical final combination of every
 * Golden target. This module is deliberately DOM-free: it only returns frozen,
 * bounded text models for a renderer to consume with textContent.
 */

export const VERSION = 1;
export const COUNT = 50;
export const MOTIONS = Object.freeze([
  "fall",
  "rise",
  "fly",
  "pulse",
  "transmute",
  "orbit",
  "build",
  "grow",
  "horizon",
  "reflect",
  "flow",
  "spectrum"
]);

const MAX_WORD_LENGTH = 48;
const MAX_EMOJI_POINTS = 8;

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function animation(id, a, b, target, family, motion, palette, beats, glyphs, duration) {
  return deepFreeze({
    id,
    a,
    b,
    target,
    family,
    motion,
    palette,
    beats,
    glyphs,
    duration
  });
}

export const ANIMATIONS = deepFreeze([
  animation(
    "golden-01", "Cloud", "Water", "Rain", "weather", "fall", "tidal-cyan",
    [
      "CONDENSE",
      "RELEASE",
      "RIPPLE"
    ],
    ["☁️", "↓", "🌧️"], 760
  ),
  animation(
    "golden-02", "Stone", "Stone", "Mountain", "land", "rise", "granite-gold",
    [
      "COLLIDE",
      "UPLIFT",
      "SUMMIT"
    ],
    ["◆", "▲", "⛰️"], 820
  ),
  animation(
    "golden-03", "Air", "Life", "Bird", "life", "fly", "sky-azure",
    [
      "QUICKEN",
      "UNFURL",
      "TAKE FLIGHT"
    ],
    ["✦", "↗", "🪽"], 720
  ),
  animation(
    "golden-04", "Cloud", "Cloud", "Storm", "weather", "pulse", "storm-violet",
    [
      "GATHER",
      "CHARGE",
      "BREAK"
    ],
    ["☁️", "⚡", "⛈️"], 800
  ),
  animation(
    "golden-05", "Fire", "Sand", "Glass", "craft", "transmute", "furnace-amber",
    [
      "HEAT",
      "MELT",
      "CLEAR"
    ],
    ["◈", "♨", "🔎"], 780
  ),
  animation(
    "golden-06", "Plant", "Plant", "Garden", "life", "grow", "verdant-bloom",
    [
      "ROOT",
      "BRANCH",
      "BLOOM"
    ],
    ["•", "↟", "🪴"], 810
  ),
  animation(
    "golden-07", "Land", "Ocean", "World", "land", "orbit", "ocean-terra",
    [
      "CURVE",
      "ENFOLD",
      "ROTATE"
    ],
    ["⌒", "⊕", "🌍"], 830
  ),
  animation(
    "golden-08", "Earth", "Sky", "Horizon", "sky", "horizon", "dawn-gold",
    [
      "SETTLE",
      "DIVIDE",
      "WIDEN"
    ],
    ["▬", "↔", "🌅"], 760
  ),
  animation(
    "golden-09", "Air", "Wave", "Sound", "physics", "pulse", "sonic-cyan",
    [
      "VIBRATE",
      "RESONATE",
      "ECHO"
    ],
    ["≋", "◌", "🔊"], 690
  ),
  animation(
    "golden-10", "Clay", "Clay", "Sculpture", "art", "build", "clay-ivory",
    [
      "PRESS",
      "CARVE",
      "REVEAL"
    ],
    ["◇", "✧", "🗿"], 840
  ),
  animation(
    "golden-11", "Clay", "Fire", "Pottery", "craft", "transmute", "kiln-ember",
    [
      "SHAPE",
      "FIRE",
      "HARDEN"
    ],
    ["◡", "♨", "🏺"], 780
  ),
  animation(
    "golden-12", "Fire", "Stone", "Metal", "craft", "transmute", "forge-steel",
    [
      "FRACTURE",
      "REFINE",
      "FORGE"
    ],
    ["◆", "✦", "🔩"], 790
  ),
  animation(
    "golden-13", "Engine", "Air", "Jet", "technology", "fly", "jet-blue",
    [
      "INTAKE",
      "IGNITE",
      "STREAK"
    ],
    ["⚙️", "➜", "✈️"], 700
  ),
  animation(
    "golden-14", "Engine", "Engine", "Factory", "technology", "build", "industrial-amber",
    [
      "SYNC",
      "ASSEMBLE",
      "POWER ON"
    ],
    ["⚙️", "⚙️", "🏭"], 850
  ),
  animation(
    "golden-15", "Fire", "Plant", "Ash", "fire", "transmute", "ash-silver",
    [
      "KINDLE",
      "CONSUME",
      "SETTLE"
    ],
    ["♨", "⋯", "◻️"], 730
  ),
  animation(
    "golden-16", "Bird", "Fire", "Phoenix", "myth", "rise", "phoenix-gold",
    [
      "DIVE",
      "REBIRTH",
      "ASCEND"
    ],
    ["🔥", "↟", "🪽"], 820
  ),
  animation(
    "golden-17", "Wall", "Wall", "House", "building", "build", "hearth-amber",
    [
      "RAISE WALLS",
      "LOCK ROOF",
      "LIGHT HEARTH"
    ],
    ["▦", "⌂", "🏠"], 800
  ),
  animation(
    "golden-18", "Mountain", "Water", "River", "water", "flow", "river-blue",
    [
      "GATHER",
      "DESCEND",
      "MEANDER"
    ],
    ["▲", "〰", "🏞️"], 780
  ),
  animation(
    "golden-19", "Tree", "Tree", "Forest", "life", "grow", "forest-green",
    [
      "ROOT",
      "MULTIPLY",
      "CANOPY"
    ],
    ["♣", "↟", "🌲"], 840
  ),
  animation(
    "golden-20", "Species", "Species", "Ecosystem", "life", "grow", "biosphere-teal",
    [
      "CONNECT",
      "DIVERSIFY",
      "BALANCE"
    ],
    ["•", "∞", "🦋"], 850
  ),
  animation(
    "golden-21", "Space", "Water", "Comet", "space", "fly", "comet-blue",
    [
      "FREEZE",
      "ACCELERATE",
      "TRAIL"
    ],
    ["◌", "➜", "☄️"], 730
  ),
  animation(
    "golden-22", "Glass", "Glass", "Mirror", "craft", "reflect", "mirror-silver",
    [
      "ALIGN",
      "SILVER",
      "REFLECT"
    ],
    ["◇", "↔", "🪞"], 710
  ),
  animation(
    "golden-23", "Garden", "Garden", "Park", "life", "grow", "park-green",
    [
      "UNFOLD",
      "SPREAD",
      "OPEN"
    ],
    ["❋", "⌒", "🏞️"], 830
  ),
  animation(
    "golden-24", "Space", "Fire", "Star", "space", "pulse", "stellar-gold",
    [
      "COMPRESS",
      "IGNITE",
      "RADIATE"
    ],
    ["◌", "✦", "⭐"], 750
  ),
  animation(
    "golden-25", "Space", "Earth", "Planet", "space", "orbit", "planetary-blue",
    [
      "LIFT",
      "WRAP",
      "ORBIT"
    ],
    ["◌", "⊙", "🪐"], 800
  ),
  animation(
    "golden-26", "Rain", "Rain", "Flood", "water", "fall", "flood-cyan",
    [
      "DOWNPOUR",
      "RISE",
      "SURGE"
    ],
    ["🌧️", "↓↓", "🌊"], 770
  ),
  animation(
    "golden-27", "Marsh", "Water", "Wetland", "water", "flow", "marsh-green",
    [
      "SATURATE",
      "SPROUT",
      "BREATHE"
    ],
    ["〰", "❋", "🪷"], 830
  ),
  animation(
    "golden-28", "Earth", "Wall", "Fortress", "building", "build", "fortress-bronze",
    [
      "ANCHOR",
      "FORTIFY",
      "SEAL"
    ],
    ["▧", "▦", "🏰"], 850
  ),
  animation(
    "golden-29", "Air", "Metal", "Rust", "craft", "transmute", "rust-orange",
    [
      "EXPOSE",
      "OXIDIZE",
      "WEATHER"
    ],
    ["🔩", "⋯", "🟠"], 740
  ),
  animation(
    "golden-30", "Air", "Wall", "Window", "building", "horizon", "window-blue",
    [
      "PRESS",
      "OPEN",
      "FRAME"
    ],
    ["▦", "◇", "🪟"], 730
  ),
  animation(
    "golden-31", "House", "House", "Village", "building", "build", "village-amber",
    [
      "BEACON",
      "GATHER",
      "GLOW"
    ],
    ["⌂", "⌂", "🏘️"], 850
  ),
  animation(
    "golden-32", "Star", "Star", "Galaxy", "space", "orbit", "galaxy-violet",
    [
      "GRAVITATE",
      "SPIRAL",
      "REVOLVE"
    ],
    ["⭐", "∞", "🌌"], 840
  ),
  animation(
    "golden-33", "Energy", "Storm", "Lightning", "weather", "pulse", "electric-violet",
    [
      "CHARGE",
      "BRANCH",
      "STRIKE"
    ],
    ["⛈️", "ϟ", "🌩️"], 620
  ),
  animation(
    "golden-34", "Forest", "Forest", "Jungle", "life", "grow", "jungle-green",
    [
      "ENTWINE",
      "OVERGROW",
      "THRIVE"
    ],
    ["🌲", "↟", "🦜"], 850
  ),
  animation(
    "golden-35", "Planet", "Planet", "Solar System", "space", "orbit", "solar-gold",
    [
      "GRAVITATE",
      "ALIGN ORBITS",
      "HARMONIZE"
    ],
    ["🪐", "⊙", "☀️"], 840
  ),
  animation(
    "golden-36", "Space", "Space", "Universe", "space", "orbit", "cosmos-violet",
    [
      "FOLD OUTWARD",
      "EXPAND",
      "REVEAL SCALE"
    ],
    ["◌", "∞", "🌌"], 850
  ),
  animation(
    "golden-37", "Planet", "Air", "Atmosphere", "space", "flow", "atmosphere-blue",
    [
      "STREAM",
      "ENVELOP",
      "SHIMMER"
    ],
    ["🪐", "◎", "🌌"], 790
  ),
  animation(
    "golden-38", "Field", "Field", "Farm", "life", "grow", "harvest-gold",
    [
      "PLOT",
      "CULTIVATE",
      "HARVEST"
    ],
    ["▤", "↟", "🚜"], 840
  ),
  animation(
    "golden-39", "Light", "Rain", "Rainbow", "weather", "spectrum", "prism-spectrum",
    [
      "REFRACT",
      "SPLIT",
      "ARCH"
    ],
    ["🌧️", "◇", "🌈"], 780
  ),
  animation(
    "golden-40", "Glass", "Sky", "Telescope", "space", "horizon", "observatory-blue",
    [
      "FOCUS",
      "ALIGN",
      "MAGNIFY"
    ],
    ["🔎", "↗", "🔭"], 800
  ),
  animation(
    "golden-41", "Village", "Village", "City", "building", "build", "city-gold",
    [
      "EXTEND",
      "RISE",
      "ILLUMINATE"
    ],
    ["⌂", "▦", "🏙️"], 850
  ),
  animation(
    "golden-42", "Galaxy", "Space", "Cosmos", "space", "orbit", "deep-cosmos",
    [
      "RECEDE",
      "DEEPEN",
      "REVEAL"
    ],
    ["🌌", "∞", "✦"], 850
  ),
  animation(
    "golden-43", "Engine", "Metal", "Rocket", "technology", "rise", "rocket-ember",
    [
      "PLATE",
      "ASSEMBLE",
      "LIFTOFF"
    ],
    ["⚙️", "↑", "🚀"], 760
  ),
  animation(
    "golden-44", "Cloud", "Metal", "Electricity", "technology", "pulse", "electric-cyan",
    [
      "CONNECT",
      "CONDUCT",
      "PULSE"
    ],
    ["☁️", "ϟ", "⚡"], 680
  ),
  animation(
    "golden-45", "Sky", "Telescope", "Observatory", "space", "horizon", "night-gold",
    [
      "TRACK",
      "DOME",
      "OPEN SKY"
    ],
    ["🔭", "⌂", "🌌"], 840
  ),
  animation(
    "golden-46", "Metal", "Rocket", "Spacecraft", "technology", "fly", "spacecraft-blue",
    [
      "REINFORCE",
      "DEPLOY",
      "DEPART"
    ],
    ["🚀", "◈", "✦"], 820
  ),
  animation(
    "golden-47", "Water", "Climate", "Water Cycle", "water", "flow", "water-cyan",
    [
      "EVAPORATE",
      "CONDENSE",
      "RETURN"
    ],
    ["💧", "↻", "🌧️"], 850
  ),
  animation(
    "golden-48", "House", "Plant", "Greenhouse", "life", "grow", "greenhouse-green",
    [
      "ROOT",
      "ENCLOSE",
      "FLOURISH"
    ],
    ["🏠", "❋", "🏡"], 840
  ),
  animation(
    "golden-49", "Space", "Metal", "Satellite", "space", "orbit", "satellite-silver",
    [
      "COMPACT",
      "DEPLOY",
      "TRANSMIT"
    ],
    ["🔩", "↗", "🛰️"], 790
  ),
  animation(
    "golden-50", "Space", "Weather", "Cosmic Weather", "space", "spectrum", "cosmic-storm",
    [
      "ESCAPE",
      "BRAID",
      "BLOOM"
    ],
    ["🌌", "ϟ", "☄️"], 850
  )
]);

if (ANIMATIONS.length !== COUNT) {
  throw new Error(`Golden pair animation catalog must contain exactly ${COUNT} entries.`);
}

function safeProperty(value, property) {
  try {
    return value?.[property];
  } catch {
    return undefined;
  }
}

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
      .replace(/[\u0000-\u001f\u007f]/gu, "")
      .trim();
  } catch {
    return "";
  }
  if (
    !normalized
    || /[<>&"']/u.test(normalized)
    || /[\p{L}\p{N}]/u.test(normalized)
    || [...normalized].length > MAX_EMOJI_POINTS
  ) return "";
  return normalized;
}

function wordValue(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const word = safeProperty(value, "word");
  if (typeof word === "string") return word;
  const target = safeProperty(value, "target");
  return typeof target === "string" ? target : "";
}

function wordKey(value) {
  return safeWord(wordValue(value)).toLocaleLowerCase("en-US");
}

function pairKey(a, b) {
  const parts = [wordKey(a), wordKey(b)];
  if (!parts[0] || !parts[1]) return "";
  return parts.sort((left, right) => left.localeCompare(right, "en")).join("\u0000");
}

const animationByRecipe = new Map(ANIMATIONS.map((entry) => [
  `${pairKey(entry.a, entry.b)}\u0001${wordKey(entry.target)}`,
  entry
]));

/**
 * Finds the authored animation for one exact Golden result. Ingredient order
 * is intentionally commutative, while the result must match exactly.
 */
export function goldenPairAnimation(a, b, result) {
  const pair = pairKey(a, b);
  const target = wordKey(result);
  if (!pair || !target) return null;
  return animationByRecipe.get(`${pair}\u0001${target}`) || null;
}

function safeWordToken(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const word = safeWord(safeProperty(value, "word"));
  if (!word) return null;
  return {
    word,
    emoji: safeEmoji(safeProperty(value, "emoji"))
  };
}

/**
 * Builds a renderer-ready snapshot from the actual inventory/result objects.
 * No caller object is retained, no HTML is returned, and every nested value is
 * frozen. Invalid or non-Golden combinations return null.
 */
export function buildGoldenPairAnimation(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) return null;
  const a = safeWordToken(safeProperty(options, "a"));
  const b = safeWordToken(safeProperty(options, "b"));
  const result = safeWordToken(safeProperty(options, "result"));
  if (!a || !b || !result) return null;

  const definition = goldenPairAnimation(a.word, b.word, result.word);
  if (!definition) return null;

  return deepFreeze({
    version: VERSION,
    id: definition.id,
    family: definition.family,
    motion: definition.motion,
    palette: definition.palette,
    duration: definition.duration,
    target: definition.target,
    authoredPair: {
      a: definition.a,
      b: definition.b
    },
    a,
    b,
    result,
    beats: [...definition.beats],
    glyphs: [...definition.glyphs],
    announcement: `${a.word} and ${b.word} combine to create ${result.word}.`
  });
}
