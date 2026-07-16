import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const STARTERS = [
  { word: "Earth", emoji: "🌍", category: "nature" },
  { word: "Water", emoji: "💧", category: "force" },
  { word: "Fire", emoji: "🔥", category: "force" },
  { word: "Air", emoji: "💨", category: "force" }
];

function pairOffset(left, right, size) {
  const a = Math.min(left, right);
  const b = Math.max(left, right);
  return a * size - (a * (a - 1)) / 2 + (b - a);
}

function gameSignature(game) {
  const clean = structuredClone(game);
  delete clean.seed;
  delete clean.challengeId;
  delete clean.aiEnabled;
  delete clean.worldSize;
  return JSON.stringify(clean);
}

function modeCycle(buildGameForMode, mode, stage = 0) {
  const games = Array.from({ length: 256 }, (_, seed) => buildGameForMode(mode, seed, "", stage));
  const signatures = games.map(gameSignature);
  for (let period = 1; period <= 128; period += 1) {
    if (signatures.every((signature, index) => index < period || signature === signatures[index % period])) {
      return games.slice(0, period).map((game) => JSON.parse(gameSignature(game)));
    }
  }
  throw new Error(`Could not determine a deterministic cycle for ${mode}.`);
}

export async function generateLocalWorldData() {
  const {
    buildGameForMode,
    contextualCombination,
    curatedCombination,
    registerWishConcept,
    semanticCategoryFor
  } = await import("../server.mjs");
  const { MARKET_CATALOG } = await import("../game-services.mjs");

  const records = new Map(STARTERS.map((item) => [item.word.toLowerCase(), { ...item }]));
  const expandRecords = () => {
    for (let round = 0; round < 12; round += 1) {
      const words = [...records.values()];
      let added = 0;
      for (let left = 0; left < words.length; left += 1) {
        for (let right = left; right < words.length; right += 1) {
          const result = curatedCombination(words[left].word, words[right].word)
            || contextualCombination(words[left].word, words[right].word);
          if (!result || records.has(result.word.toLowerCase())) continue;
          records.set(result.word.toLowerCase(), {
            word: result.word,
            emoji: result.emoji,
            category: semanticCategoryFor(result.word) || "nature"
          });
          added += 1;
        }
      }
      if (!added) return;
    }
    throw new Error("The local word universe did not settle.");
  };

  expandRecords();
  const naturalTargets = new Set(records.keys());
  for (const item of MARKET_CATALOG) {
    if (records.has(item.word.toLowerCase())) continue;
    records.set(item.word.toLowerCase(), {
      word: item.word,
      emoji: item.emoji,
      category: semanticCategoryFor(item.word) || registerWishConcept(item.word) || item.category || "nature"
    });
  }
  expandRecords();

  const words = [...records.values()];
  const indexByWord = new Map(words.map((item, index) => [item.word.toLowerCase(), index]));
  const matrix = new Uint16Array(words.length * (words.length + 1) / 2);
  const curated = {};

  for (let left = 0; left < words.length; left += 1) {
    for (let right = left; right < words.length; right += 1) {
      const authored = curatedCombination(words[left].word, words[right].word);
      const result = authored || contextualCombination(words[left].word, words[right].word);
      if (!result) throw new Error(`No local result for ${words[left].word} + ${words[right].word}.`);
      const resultIndex = indexByWord.get(result.word.toLowerCase());
      if (resultIndex === undefined) throw new Error(`Local result ${result.word} is outside the generated universe.`);
      const offset = pairOffset(left, right, words.length);
      matrix[offset] = resultIndex;
      if (authored) curated[offset] = {
        emoji: authored.emoji,
        note: authored.note,
        source: authored.source || "world"
      };
    }
  }

  const bytes = Buffer.alloc(matrix.length * 2);
  matrix.forEach((value, index) => bytes.writeUInt16LE(value, index * 2));
  const targetDetails = Object.fromEntries(words.filter((item) => naturalTargets.has(item.word.toLowerCase())).map((item) => {
    const known = buildGameForMode("reach", 0, item.word);
    return [item.word.toLowerCase(), known
      ? { target: known.target, emoji: known.emoji, clue: known.clue, tier: known.tier }
      : { target: item.word, emoji: item.emoji, clue: "A destination mapped in the local word universe.", tier: 3 }];
  }));

  return {
    words,
    matrix,
    payload: {
      version: 1,
      words,
      matrix: bytes.toString("base64"),
      curated,
      targetDetails,
      modes: {
        reach: modeCycle(buildGameForMode, "reach"),
        quick: modeCycle(buildGameForMode, "quick"),
        moves: modeCycle(buildGameForMode, "moves"),
        daily: modeCycle(buildGameForMode, "daily"),
        challenge: modeCycle(buildGameForMode, "challenge"),
        weekly: [0, 1, 2].map((stage) => modeCycle(buildGameForMode, "weekly", stage))
      }
    }
  };
}

export function lookupGeneratedCombination(data, a, b) {
  const indexByWord = new Map(data.words.map((item, index) => [item.word.toLowerCase(), index]));
  const left = indexByWord.get(String(a).trim().toLowerCase());
  const right = indexByWord.get(String(b).trim().toLowerCase());
  if (left === undefined || right === undefined) return null;
  return data.words[data.matrix[pairOffset(left, right, data.words.length)]];
}

export async function writeLocalWorldModule(destination) {
  const { payload } = await generateLocalWorldData();
  const source = `const payload = ${JSON.stringify(payload)};
const indexByWord = new Map(payload.words.map((item, index) => [item.word.toLowerCase(), index]));
let matrixView;

function matrix() {
  if (matrixView) return matrixView;
  const raw = atob(payload.matrix);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  matrixView = new DataView(bytes.buffer);
  return matrixView;
}

function pairOffset(left, right) {
  const a = Math.min(left, right);
  const b = Math.max(left, right);
  return a * payload.words.length - (a * (a - 1)) / 2 + (b - a);
}

export function canonicalLocalWord(value) {
  const index = indexByWord.get(String(value || \"\").trim().toLowerCase());
  return index === undefined ? null : payload.words[index].word;
}

export function canonicalLocalTarget(value) {
  const normalized = String(value || \"\").trim().toLowerCase();
  return payload.targetDetails[normalized]?.target || null;
}

export function localItemFor(value) {
  const index = indexByWord.get(String(value || \"\").trim().toLowerCase());
  return index === undefined ? null : { ...payload.words[index], source: \"local-catalog\" };
}

export function lookupLocalCombination(a, b) {
  const left = indexByWord.get(String(a || \"\").trim().toLowerCase());
  const right = indexByWord.get(String(b || \"\").trim().toLowerCase());
  if (left === undefined || right === undefined) return null;
  const offset = pairOffset(left, right);
  const result = payload.words[matrix().getUint16(offset * 2, true)];
  const authored = payload.curated[offset];
  return {
    ...result,
    note: authored?.note || \`${"${a}"} and ${"${b}"} converge into ${"${result.word.toLowerCase()}"}.\`,
    source: authored?.source || \"semantic\",
    emoji: authored?.emoji || result.emoji
  };
}

export function buildLocalGame(mode, seed = 0, target = \"\", stage = 0) {
  const normalizedMode = [\"reach\", \"quick\", \"moves\", \"daily\", \"weekly\", \"challenge\"].includes(mode) ? mode : \"reach\";
  const safeSeed = Math.abs(Number(seed) || 0);
  const safeStage = Math.min(2, Math.max(0, Number(stage) || 0));
  const cycle = normalizedMode === \"weekly\" ? payload.modes.weekly[safeStage] : payload.modes[normalizedMode];
  const game = structuredClone(cycle[safeSeed % cycle.length]);
  if (target) {
    const detail = payload.targetDetails[String(target).trim().toLowerCase()];
    if (!detail) return null;
    Object.assign(game, detail);
  }
  return {
    ...game,
    seed: safeSeed,
    stage: normalizedMode === \"weekly\" ? safeStage : game.stage,
    starters: [\"Earth\", \"Water\", \"Fire\", \"Air\"],
    aiEnabled: false,
    worldSize: payload.words.length,
    ranked: false,
    localOnly: true
  };
}

export function localSuggestions(limit = 8) {
  const preferred = [\"Telescope\", \"Bird\", \"Forest\", \"Rainbow\", \"City\", \"Rocket\", \"Ocean\", \"Dragon\"];
  return preferred.filter((word) => indexByWord.has(word.toLowerCase())).slice(0, limit);
}

export const localWorldSize = payload.words.length;
`;
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, source, "utf8");
  return payload;
}
