/**
 * Deterministic, DOM-free Forge Clash resolution.
 *
 * Players get a bounded crafting phase. Their deepest successfully-created
 * concept becomes the champion, then the visible category cycle resolves the
 * clash:
 *
 *   Force > Structure > Nature > Life > Force
 *
 * Opposite and matching categories compare build depth. Equal depth draws.
 */

export const FORGE_CLASH_VERSION = 1;
export const FORGE_ARCHETYPES = Object.freeze(["force", "structure", "nature", "life"]);
export const FORGE_COUNTERS = Object.freeze({
  force: "structure",
  structure: "nature",
  nature: "life",
  life: "force"
});

const MAX_WORD_LENGTH = 48;
const MAX_HISTORY = 64;

function safeProperty(value, key) {
  try {
    return value?.[key];
  } catch {
    return undefined;
  }
}

function word(value) {
  const raw = typeof value === "string"
    ? value
    : safeProperty(value, "word") ?? safeProperty(value, "target");
  try {
    return String(raw || "").normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, MAX_WORD_LENGTH);
  } catch {
    return "";
  }
}

function key(value) {
  return word(value).toLocaleLowerCase("en-US");
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function forgeArchetype(value, rawCategory = "") {
  const category = String(
    rawCategory
    || safeProperty(value, "category")
    || ""
  ).trim().toLocaleLowerCase("en-US");
  if (FORGE_ARCHETYPES.includes(category)) return category;
  const normalized = key(value);
  return normalized ? FORGE_ARCHETYPES[stableHash(normalized) % FORGE_ARCHETYPES.length] : "";
}

function frozenChampion(entry) {
  return entry ? Object.freeze({ ...entry }) : null;
}

export function selectForgeChampion({ history = [], starters = [] } = {}) {
  const depths = new Map();
  const safeStarters = Array.isArray(starters) ? starters.slice(0, 24) : [];
  for (const starter of safeStarters) {
    const starterKey = key(starter);
    if (starterKey) depths.set(starterKey, 0);
  }

  const safeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];
  let champion = null;
  for (let index = 0; index < safeHistory.length; index += 1) {
    const step = safeHistory[index];
    if (!step || typeof step !== "object" || Array.isArray(step)) continue;
    const resultWord = word(safeProperty(step, "word") ?? safeProperty(step, "result"));
    if (!resultWord) continue;
    const aDepth = depths.get(key(safeProperty(step, "a"))) ?? 0;
    const bDepth = depths.get(key(safeProperty(step, "b"))) ?? 0;
    const depth = Math.max(1, Math.min(MAX_HISTORY, Math.max(aDepth, bDepth) + 1));
    depths.set(key(resultWord), Math.max(depths.get(key(resultWord)) || 0, depth));
    const candidate = {
      word: resultWord,
      emoji: String(safeProperty(step, "emoji") || "\u2726").slice(0, 12),
      category: forgeArchetype(resultWord, safeProperty(step, "category")),
      power: depth,
      craftedAt: index + 1
    };
    if (
      !champion
      || candidate.power > champion.power
      || candidate.power === champion.power && candidate.craftedAt > champion.craftedAt
    ) champion = candidate;
  }
  return frozenChampion(champion);
}

export function resolveForgeClash(left, right) {
  const first = left && typeof left === "object" && !Array.isArray(left)
    ? frozenChampion({
        word: word(left),
        emoji: String(safeProperty(left, "emoji") || "\u2726").slice(0, 12),
        category: forgeArchetype(left),
        power: Math.max(0, Math.min(MAX_HISTORY, Math.floor(Number(safeProperty(left, "power")) || 0))),
        craftedAt: Math.max(0, Math.min(MAX_HISTORY, Math.floor(Number(safeProperty(left, "craftedAt")) || 0)))
      })
    : null;
  const second = right && typeof right === "object" && !Array.isArray(right)
    ? frozenChampion({
        word: word(right),
        emoji: String(safeProperty(right, "emoji") || "\u2726").slice(0, 12),
        category: forgeArchetype(right),
        power: Math.max(0, Math.min(MAX_HISTORY, Math.floor(Number(safeProperty(right, "power")) || 0))),
        craftedAt: Math.max(0, Math.min(MAX_HISTORY, Math.floor(Number(safeProperty(right, "craftedAt")) || 0)))
      })
    : null;

  if (!first?.word && !second?.word) {
    return Object.freeze({ winner: "", reason: "no_champions", left: null, right: null });
  }
  if (!first?.word) return Object.freeze({ winner: "right", reason: "only_champion", left: null, right: second });
  if (!second?.word) return Object.freeze({ winner: "left", reason: "only_champion", left: first, right: null });

  if (FORGE_COUNTERS[first.category] === second.category) {
    return Object.freeze({ winner: "left", reason: "category_counter", left: first, right: second });
  }
  if (FORGE_COUNTERS[second.category] === first.category) {
    return Object.freeze({ winner: "right", reason: "category_counter", left: first, right: second });
  }
  if (first.power !== second.power) {
    return Object.freeze({
      winner: first.power > second.power ? "left" : "right",
      reason: "build_depth",
      left: first,
      right: second
    });
  }
  return Object.freeze({ winner: "", reason: "equal_force", left: first, right: second });
}
