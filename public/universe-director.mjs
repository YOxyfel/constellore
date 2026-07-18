export const UNIVERSE_DIRECTOR_VERSION = 1;
export const MAX_UNIVERSE_ROUTE_STEPS = 48;
export const MAX_UNIVERSE_CACHE_ENTRIES = 64;

const MAX_WORD_LENGTH = 80;
const MAX_NOTE_LENGTH = 180;
const MAX_SEED_LENGTH = 160;
const MAX_STARTERS = 32;
const MAX_RESULT_CANDIDATES = 16;

// Universe laws are presentation lenses, not recipe or scoring modifiers. That
// distinction lets a shared seed feel different without making a ranked run
// behave differently on the server and the static Pages build.
const UNIVERSES = Object.freeze([
  Object.freeze({
    id: "verdant-echo",
    name: "Verdant Echo",
    icon: "❋",
    description: "A young cosmos where every living pattern leaves a luminous trace.",
    affinities: Object.freeze(["life", "nature"]),
    season: Object.freeze({
      id: "rootwake",
      name: "Rootwake",
      description: "Living and elemental discoveries glow with new growth."
    }),
    law: Object.freeze({
      id: "living-thread",
      name: "The Living Thread",
      description: "Related discoveries are marked as resonant, without changing their recipe or value."
    })
  }),
  Object.freeze({
    id: "ember-eclipse",
    name: "Ember Eclipse",
    icon: "◉",
    description: "Heat and shadow cross beneath a copper-colored sky.",
    affinities: Object.freeze(["force", "nature"]),
    season: Object.freeze({
      id: "ashfall",
      name: "Ashfall",
      description: "Elemental forces leave bright paths through the dark."
    }),
    law: Object.freeze({
      id: "afterglow",
      name: "Law of Afterglow",
      description: "Force and nature results receive an afterglow annotation only."
    })
  }),
  Object.freeze({
    id: "clockwork-bloom",
    name: "Clockwork Bloom",
    icon: "⚙",
    description: "Machines grow like gardens across a precisely turning world.",
    affinities: Object.freeze(["structure", "life"]),
    season: Object.freeze({
      id: "brass-spring",
      name: "Brass Spring",
      description: "Crafted forms and living systems appear in the same constellation."
    }),
    law: Object.freeze({
      id: "ordered-growth",
      name: "Ordered Growth",
      description: "Structure and life results are identified as harmonious, with no mechanical bonus."
    })
  }),
  Object.freeze({
    id: "tidal-archive",
    name: "Tidal Archive",
    icon: "≋",
    description: "An oceanic library records each discovery as a ripple of light.",
    affinities: Object.freeze(["nature", "structure"]),
    season: Object.freeze({
      id: "high-memory",
      name: "High Memory",
      description: "Natural and crafted discoveries surface from the cosmic tide."
    }),
    law: Object.freeze({
      id: "returning-wave",
      name: "The Returning Wave",
      description: "Matching affinities receive a tidal context label, never a different result."
    })
  }),
  Object.freeze({
    id: "stellar-drift",
    name: "Stellar Drift",
    icon: "✦",
    description: "Slow constellations cross a weightless frontier of blue stars.",
    affinities: Object.freeze(["force", "structure"]),
    season: Object.freeze({
      id: "long-orbit",
      name: "Long Orbit",
      description: "Energy and invention trace the clearest lines between stars."
    }),
    law: Object.freeze({
      id: "quiet-gravity",
      name: "Quiet Gravity",
      description: "Force and structure results receive navigational context only."
    })
  }),
  Object.freeze({
    id: "dreaming-frontier",
    name: "Dreaming Frontier",
    icon: "◇",
    description: "A violet horizon makes familiar discoveries feel newly strange.",
    affinities: Object.freeze(["life", "force"]),
    season: Object.freeze({
      id: "violet-dawn",
      name: "Violet Dawn",
      description: "Living ideas and untamed forces shine through the mist."
    }),
    law: Object.freeze({
      id: "lucid-connection",
      name: "Lucid Connection",
      description: "Life and force results are described as lucid, without altering play."
    })
  })
]);

const SEED_ID_PATTERN = /^cx1-[a-z0-9]{14}$/;
const TARGET_ID_PATTERN = /^t-[a-z0-9]{14}$/;

function cleanText(value, maximum) {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function wordText(value) {
  return cleanText(value, MAX_WORD_LENGTH);
}

function normalizedWord(value) {
  return wordText(value).toLowerCase();
}

function stableHash(value, salt = "") {
  let hash = 2166136261;
  const text = `${salt}|${String(value)}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function seedDigest(value) {
  return `${stableHash(value, "constellore-universe-a")}${stableHash(value, "constellore-universe-b")}`;
}

function cloneUniverse(universe, seedId) {
  return {
    version: UNIVERSE_DIRECTOR_VERSION,
    seedId,
    id: universe.id,
    name: universe.name,
    icon: universe.icon,
    description: universe.description,
    affinities: [...universe.affinities],
    season: { ...universe.season },
    law: { ...universe.law }
  };
}

/** Returns an opaque, reusable identity. Passing it back in reproduces the same universe. */
export function universeSeedIdentity(seed) {
  const cleaned = cleanText(seed, MAX_SEED_LENGTH);
  if (SEED_ID_PATTERN.test(cleaned)) return cleaned;
  return `cx1-${seedDigest(cleaned || "constellore")}`;
}

/** A defensive, presentation-safe copy of the finite authored universe catalog. */
export function universeCatalog() {
  return UNIVERSES.map((universe) => cloneUniverse(universe, null));
}

/** Selects exactly one authored universe. No recipe, reward, or ranking data is generated. */
export function selectUniverse(seed) {
  const seedId = universeSeedIdentity(seed);
  const index = Number.parseInt(stableHash(seedId, "universe-selection"), 36) % UNIVERSES.length;
  return cloneUniverse(UNIVERSES[index], seedId);
}

function pairKey(a, b) {
  const pair = [normalizedWord(a), normalizedWord(b)];
  if (!pair[0] || !pair[1]) return "";
  pair.sort();
  return JSON.stringify(pair);
}

function recipeParts(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const ingredients = source.ingredients || source.inputs || source.parents || source.recipe;
  const a = wordText(source.a ?? source.inputA ?? ingredients?.[0]);
  const b = wordText(source.b ?? source.inputB ?? ingredients?.[1]);
  const word = wordText(source.word ?? source.result?.word ?? source.result);
  const key = pairKey(a, b);
  if (!key || !word) return null;
  return {
    key,
    a,
    b,
    word,
    emoji: cleanText(source.emoji ?? source.result?.emoji, 16),
    category: normalizedWord(source.category ?? source.result?.category).slice(0, 32),
    note: cleanText(source.note ?? source.result?.note, MAX_NOTE_LENGTH)
  };
}

function recipeIndex(recipes) {
  const index = new Map();
  const ambiguous = new Set();
  for (const source of Array.isArray(recipes) ? recipes : []) {
    const recipe = recipeParts(source);
    if (!recipe) continue;
    const existing = index.get(recipe.key);
    if (existing && normalizedWord(existing.word) !== normalizedWord(recipe.word)) {
      ambiguous.add(recipe.key);
      continue;
    }
    if (!existing) index.set(recipe.key, recipe);
  }
  return { index, ambiguous };
}

function invalidRoute(reason, step = null) {
  return {
    valid: false,
    reason,
    step,
    target: "",
    starters: [],
    route: [],
    routeSteps: 0
  };
}

/**
 * Verifies that every dependency exists before use and every result is the
 * canonical result of a supplied, unambiguous recipe. The returned route is
 * rebuilt from that catalog rather than trusting route-provided result data.
 */
export function validateUniverseRoute({
  starters = [],
  target,
  route = [],
  recipes = [],
  maxSteps = MAX_UNIVERSE_ROUTE_STEPS
} = {}) {
  const cleanTarget = wordText(target);
  if (!cleanTarget) return invalidRoute("invalid_target");
  if (!Array.isArray(starters) || !Array.isArray(route) || !Array.isArray(recipes)) return invalidRoute("invalid_input");
  const cleanStarters = [];
  const available = new Map();
  for (const source of starters.slice(0, MAX_STARTERS + 1)) {
    const word = wordText(typeof source === "string" ? source : source?.word);
    const key = normalizedWord(word);
    if (!key || available.has(key)) continue;
    if (cleanStarters.length >= MAX_STARTERS) return invalidRoute("starter_limit");
    available.set(key, word);
    cleanStarters.push(word);
  }
  if (!cleanStarters.length) return invalidRoute("missing_starters");

  const parsedMaximum = Number(maxSteps);
  const boundedMaximum = Math.max(0, Math.min(
    MAX_UNIVERSE_ROUTE_STEPS,
    Number.isFinite(parsedMaximum) ? Math.floor(parsedMaximum) : MAX_UNIVERSE_ROUTE_STEPS
  ));
  if (route.length > boundedMaximum || route.length > MAX_UNIVERSE_ROUTE_STEPS) return invalidRoute("route_limit");
  if (available.has(normalizedWord(cleanTarget))) {
    if (route.length) return invalidRoute("target_already_available");
    return { valid: true, reason: "validated", step: null, target: cleanTarget, starters: cleanStarters, route: [], routeSteps: 0 };
  }
  if (!route.length) return invalidRoute("target_unreachable");

  const catalog = recipeIndex(recipes);
  const validated = [];
  for (let index = 0; index < route.length; index += 1) {
    const proposed = recipeParts(route[index]);
    if (!proposed) return invalidRoute("invalid_step", index);
    const key = pairKey(proposed.a, proposed.b);
    if (catalog.ambiguous.has(key)) return invalidRoute("ambiguous_recipe", index);
    const canonical = catalog.index.get(key);
    if (!canonical) return invalidRoute("unknown_recipe", index);
    if (normalizedWord(canonical.word) !== normalizedWord(proposed.word)) return invalidRoute("recipe_mismatch", index);
    if (!available.has(normalizedWord(proposed.a)) || !available.has(normalizedWord(proposed.b))) {
      return invalidRoute("dependency_unavailable", index);
    }
    const resultKey = normalizedWord(canonical.word);
    if (available.has(resultKey)) return invalidRoute("redundant_result", index);
    const isTarget = resultKey === normalizedWord(cleanTarget);
    if (isTarget && index !== route.length - 1) return invalidRoute("target_not_final", index);
    const step = {
      a: available.get(normalizedWord(proposed.a)),
      b: available.get(normalizedWord(proposed.b)),
      word: canonical.word,
      emoji: canonical.emoji,
      category: canonical.category,
      note: canonical.note
    };
    validated.push(step);
    available.set(resultKey, canonical.word);
  }
  if (normalizedWord(validated.at(-1)?.word) !== normalizedWord(cleanTarget)) return invalidRoute("wrong_target", route.length - 1);
  return {
    valid: true,
    reason: "validated",
    step: null,
    target: cleanTarget,
    starters: cleanStarters,
    route: validated,
    routeSteps: validated.length
  };
}

function universeFrom(value, seed) {
  return selectUniverse(value?.seedId || seed);
}

/**
 * Adds separate display context only after exact catalog validation. `result`
 * is returned by reference and is never rewritten, preserving source, score,
 * ranked eligibility, and every other gameplay field owned by the caller.
 */
export function annotateUniverseResult({ universe, seed, a, b, result, recipes = [] } = {}) {
  const proposed = recipeParts({ a, b, result });
  if (!proposed) return null;
  const catalog = recipeIndex(recipes);
  if (catalog.ambiguous.has(proposed.key)) return null;
  const canonical = catalog.index.get(proposed.key);
  if (!canonical || normalizedWord(canonical.word) !== normalizedWord(proposed.word)) return null;
  const selected = universeFrom(universe, seed);
  const category = canonical.category || "uncategorized";
  const resonance = selected.affinities.includes(category) ? "resonant" : "wandering";
  return {
    result,
    context: {
      seedId: selected.seedId,
      universeId: selected.id,
      seasonId: selected.season.id,
      lawId: selected.law.id,
      resonance,
      label: resonance === "resonant" ? `${selected.law.name} resonates.` : `${selected.season.name} records the discovery.`
    }
  };
}

/** Filters a caller-owned candidate list; it never synthesizes a fallback. */
export function constrainUniverseResults({ universe, seed, a, b, results = [], recipes = [], limit = MAX_RESULT_CANDIDATES } = {}) {
  if (!Array.isArray(results)) return [];
  const parsedLimit = Number(limit);
  const maximum = Math.max(0, Math.min(MAX_RESULT_CANDIDATES, Number.isFinite(parsedLimit) ? Math.floor(parsedLimit) : MAX_RESULT_CANDIDATES));
  const constrained = [];
  if (maximum === 0) return constrained;
  for (const result of results) {
    const annotated = annotateUniverseResult({ universe, seed, a, b, result, recipes });
    if (annotated) constrained.push(annotated);
    if (constrained.length >= maximum) break;
  }
  return constrained;
}

function targetIdentity(seedId, target) {
  const normalized = normalizedWord(target);
  return `t-${stableHash(`${seedId}|${normalized}`, "target-a")}${stableHash(`${seedId}|${normalized}`, "target-b")}`;
}

/**
 * Produces the only shape intended for persistence or sharing. It deliberately
 * excludes raw seeds, target words, routes, recipes, player data, and scoring.
 */
export function buildUniverseManifest({ seed, validation } = {}) {
  if (!validation?.valid || validation.reason !== "validated") return null;
  const universe = selectUniverse(seed);
  const target = wordText(validation.target);
  if (!target) return null;
  return {
    version: UNIVERSE_DIRECTOR_VERSION,
    seedId: universe.seedId,
    universeId: universe.id,
    seasonId: universe.season.id,
    lawId: universe.law.id,
    targetId: targetIdentity(universe.seedId, target),
    routeSteps: Math.min(MAX_UNIVERSE_ROUTE_STEPS, Math.max(0, Math.floor(Number(validation.routeSteps) || 0))),
    starterCount: Math.min(MAX_STARTERS, Math.max(0, Array.isArray(validation.starters) ? validation.starters.length : 0)),
    validated: true
  };
}

function sanitizedManifest(source) {
  if (!source || typeof source !== "object" || Array.isArray(source) || source.validated !== true) return null;
  const seedId = cleanText(source.seedId, 40);
  const targetId = cleanText(source.targetId, 40);
  if (!SEED_ID_PATTERN.test(seedId) || !TARGET_ID_PATTERN.test(targetId)) return null;
  const universe = selectUniverse(seedId);
  if (source.universeId !== universe.id || source.seasonId !== universe.season.id || source.lawId !== universe.law.id) return null;
  const routeSteps = Number(source.routeSteps);
  const starterCount = Number(source.starterCount);
  if (!Number.isInteger(routeSteps) || routeSteps < 0 || routeSteps > MAX_UNIVERSE_ROUTE_STEPS) return null;
  if (!Number.isInteger(starterCount) || starterCount < 1 || starterCount > MAX_STARTERS) return null;
  return {
    version: UNIVERSE_DIRECTOR_VERSION,
    seedId,
    universeId: universe.id,
    seasonId: universe.season.id,
    lawId: universe.law.id,
    targetId,
    routeSteps,
    starterCount,
    validated: true
  };
}

/** Allowlist-only, deduplicated and bounded metadata cache migration. */
export function sanitizeUniverseCache(raw, { limit = MAX_UNIVERSE_CACHE_ENTRIES } = {}) {
  const parsedLimit = Number(limit);
  const requested = Number.isFinite(parsedLimit) ? Math.floor(parsedLimit) : MAX_UNIVERSE_CACHE_ENTRIES;
  const maximum = Math.max(0, Math.min(MAX_UNIVERSE_CACHE_ENTRIES, requested));
  const sources = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
  const entries = [];
  const seen = new Set();
  if (maximum === 0) return { version: UNIVERSE_DIRECTOR_VERSION, entries };
  for (const source of sources) {
    const manifest = sanitizedManifest(source);
    if (!manifest) continue;
    const key = `${manifest.seedId}:${manifest.targetId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(manifest);
    if (entries.length >= maximum) break;
  }
  return { version: UNIVERSE_DIRECTOR_VERSION, entries };
}
