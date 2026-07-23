const ORIGINS = Object.freeze([
  Object.freeze({ word: "Earth", emoji: "🌍", category: "nature", source: "origin" }),
  Object.freeze({ word: "Water", emoji: "💧", category: "nature", source: "origin" }),
  Object.freeze({ word: "Fire", emoji: "🔥", category: "force", source: "origin" }),
  Object.freeze({ word: "Air", emoji: "💨", category: "force", source: "origin" })
]);

function cleanWord(value) {
  return String(value || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function wordKey(value) {
  return cleanWord(typeof value === "object" ? value?.word : value).toLocaleLowerCase();
}

function cleanItem(value, fallbackSource = "universe") {
  const word = cleanWord(typeof value === "object" ? value?.word : value);
  if (!word) return null;
  return {
    word,
    emoji: cleanWord(typeof value === "object" ? value?.emoji : "").slice(0, 24) || "✦",
    category: typeof value === "object" && value?.category != null ? cleanWord(value.category).slice(0, 40) || null : null,
    source: cleanWord(typeof value === "object" ? value?.source : "").slice(0, 40) || fallbackSource,
    ...(typeof value === "object" && value?.note ? { note: cleanWord(value.note).slice(0, 180) } : {})
  };
}

export function sanitizeExploreInventory(raw, discovered = []) {
  const items = new Map(ORIGINS.map((item) => [wordKey(item), { ...item }]));
  for (const value of Array.isArray(raw) ? raw.slice(0, 1000) : []) {
    const item = cleanItem(value);
    const key = wordKey(item);
    if (item && key && !items.has(key)) items.set(key, item);
  }
  for (const value of Array.isArray(discovered) ? discovered.slice(0, 1000) : []) {
    const item = cleanItem(value);
    const key = wordKey(item);
    if (item && key && !items.has(key)) items.set(key, item);
  }
  return [...items.values()].slice(0, 1000);
}

export function mergeExploreInventory(raw, item) {
  return sanitizeExploreInventory([...(Array.isArray(raw) ? raw : []), item]);
}

export function exploreGame(seed = Date.now()) {
  const safeSeed = Math.abs(Math.floor(Number(seed) || 0)) % 1_000_000;
  return {
    mode: "explore",
    modeName: "Explore",
    target: "Free exploration",
    emoji: "∞",
    starters: ORIGINS.map((item) => item.word),
    seed: safeSeed,
    tier: 1,
    timeLimit: null,
    moveLimit: null,
    law: null,
    aiEnabled: false,
    scoreEligible: false,
    rewardEligible: false,
    leaderboardEligible: false,
    ranked: false,
    sandbox: true
  };
}
