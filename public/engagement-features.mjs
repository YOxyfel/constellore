export const SENSE_WALLET_VERSION = 1;
export const MAX_SENSE_CHARGES = 9;

export const ASSISTANCE_POLICIES = Object.freeze({
  none: Object.freeze({ id: "none", label: "Pure", division: "pure", scoreMultiplier: 1, scoreEligible: true, study: false }),
  tip: Object.freeze({ id: "tip", label: "Route Signal", division: "pure", scoreMultiplier: 1, scoreEligible: true, study: false }),
  open: Object.freeze({ id: "open", label: "Open", division: "open", scoreMultiplier: .85, scoreEligible: true, study: false }),
  wish: Object.freeze({ id: "wish", label: "Wish", division: "open", scoreMultiplier: .8, scoreEligible: true, study: false }),
  market: Object.freeze({ id: "market", label: "Vault Word", division: "open", scoreMultiplier: .8, scoreEligible: true, study: false }),
  ai: Object.freeze({ id: "ai", label: "AI Assist", division: "open", scoreMultiplier: .8, scoreEligible: true, study: false }),
  sense: Object.freeze({ id: "sense", label: "Star Compass", division: "open", scoreMultiplier: .75, scoreEligible: true, study: false }),
  gift: Object.freeze({ id: "gift", label: "Word Gift", division: "open", scoreMultiplier: .5, scoreEligible: true, study: false }),
  reveal: Object.freeze({ id: "reveal", label: "Cosmos Reveal", division: "study", scoreMultiplier: 0, scoreEligible: false, study: true }),
  training: Object.freeze({ id: "training", label: "Training", division: "study", scoreMultiplier: 0, scoreEligible: false, study: true })
});

export function assistancePolicy(value = "none") {
  const id = String(value || "none").toLowerCase();
  return { ...(ASSISTANCE_POLICIES[id] || ASSISTANCE_POLICIES.none) };
}

/** Keeps the strongest assistance used in an orbit and its lowest score rate. */
export function combineAssistance(current = "none", next = "none") {
  const left = assistancePolicy(current);
  const right = assistancePolicy(next);
  const selected = right.scoreMultiplier < left.scoreMultiplier ? right : left;
  return {
    ...selected,
    scoreMultiplier: Math.min(left.scoreMultiplier, right.scoreMultiplier),
    scoreEligible: left.scoreEligible && right.scoreEligible,
    study: left.study || right.study,
    division: left.study || right.study ? "study" : left.division === "open" || right.division === "open" ? "open" : "pure"
  };
}

const LIFETIME_RANKS = Object.freeze([
  Object.freeze({ name: "Stargazer I", at: 0 }),
  Object.freeze({ name: "Stargazer II", at: 250 }),
  Object.freeze({ name: "Pathfinder", at: 750 }),
  Object.freeze({ name: "Constellation Keeper", at: 1_500 }),
  Object.freeze({ name: "Reality Weaver", at: 3_000 }),
  Object.freeze({ name: "Loreweaver", at: 6_000 }),
  Object.freeze({ name: "Celestial Archivist", at: 12_000 }),
  Object.freeze({ name: "Universe Cartographer", at: 24_000 }),
  Object.freeze({ name: "Eternal Cartographer", at: 48_000 })
]);

/**
 * Long-tail presentation rank. It combines durable collection and play
 * accomplishments, then continues in named Eternal tiers instead of capping.
 */
export function lifetimeProgression(raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const stardust = clampInteger(source.stardust, 0, 1_000_000_000, 0);
  const wins = clampInteger(source.wins, 0, 1_000_000, 0);
  const discoveries = clampInteger(source.discoveries, 0, 10_000, 0);
  const masteryStars = clampInteger(source.masteryStars, 0, 100_000, 0);
  const points = Math.min(1_000_000_000, stardust + wins * 40 + discoveries * 2 + masteryStars * 20);
  let levelIndex = LIFETIME_RANKS.findLastIndex((rank) => points >= rank.at);
  levelIndex = Math.max(0, levelIndex);
  const finalRank = LIFETIME_RANKS.at(-1);
  let name = LIFETIME_RANKS[levelIndex].name;
  let currentAt = LIFETIME_RANKS[levelIndex].at;
  let nextAt = LIFETIME_RANKS[levelIndex + 1]?.at ?? null;
  let nextName = LIFETIME_RANKS[levelIndex + 1]?.name ?? null;
  let level = levelIndex + 1;
  if (points >= finalRank.at) {
    const eternalTier = Math.floor((points - finalRank.at) / 48_000) + 1;
    level = LIFETIME_RANKS.length + eternalTier - 1;
    name = `Eternal Cartographer ${eternalTier}`;
    currentAt = finalRank.at + (eternalTier - 1) * 48_000;
    nextAt = currentAt + 48_000;
    nextName = `Eternal Cartographer ${eternalTier + 1}`;
  }
  const span = Math.max(1, (nextAt ?? currentAt + 1) - currentAt);
  const progress = nextAt == null ? 100 : Math.min(100, Math.max(0, Math.round(((points - currentAt) / span) * 100)));
  return {
    points,
    level,
    name,
    currentAt,
    nextAt,
    nextName,
    remaining: nextAt == null ? 0 : Math.max(0, nextAt - points),
    progress
  };
}

function isoWeekKey(value) {
  const input = value instanceof Date && Number.isFinite(value.getTime()) ? value : new Date();
  const date = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** A resettable, non-punitive weekly momentum presentation beside lifetime rank. */
export function weeklyRatingPresentation(raw = {}, { date = new Date() } = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const stage = clampInteger(source.stage ?? source.weeklyStage, 0, 3, 0);
  const dailyStreak = clampInteger(source.dailyStreak, 0, 100_000, 0);
  const masteryStars = clampInteger(source.masteryStars, 0, 100_000, 0);
  const complete = Boolean(source.complete ?? source.weeklyComplete);
  const rating = 1_000 + stage * 140 + (complete ? 220 : 0) + Math.min(7, dailyStreak) * 18 + Math.min(100, masteryStars) * 2;
  const bands = [
    { at: 0, name: "Quiet Orbit" },
    { at: 1_100, name: "Rising Orbit" },
    { at: 1_350, name: "Bright Orbit" },
    { at: 1_650, name: "Radiant Orbit" }
  ];
  const band = [...bands].reverse().find((entry) => rating >= entry.at) || bands[0];
  const next = bands.find((entry) => entry.at > rating) || null;
  const safeDate = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
  return {
    weekKey: isoWeekKey(safeDate),
    season: `${safeDate.getUTCFullYear()} · SEASON ${Math.floor(safeDate.getUTCMonth() / 3) + 1}`,
    rating,
    name: band.name,
    nextAt: next?.at ?? null,
    remaining: next ? next.at - rating : 0,
    progress: next ? Math.round(((rating - band.at) / Math.max(1, next.at - band.at)) * 100) : 100,
    resetsWeekly: true
  };
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function cleanCloudDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
}

function sanitizeCloudProgression(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    stardust: clampInteger(source.stardust, 0, 1_000_000_000, 0),
    wins: clampInteger(source.wins, 0, 1_000_000, 0),
    dailyStreak: clampInteger(source.dailyStreak, 0, 100_000, 0),
    lastDailyDate: cleanCloudDate(source.lastDailyDate),
    dailyCompleted: cleanCloudDate(source.dailyCompleted),
    streakShields: clampInteger(source.streakShields, 0, 1_000, 0)
  };
}

/**
 * Spendable/resettable counters cannot use a max merge: doing so resurrects
 * spent Stardust, used streak shields, and reset streaks. A device with a
 * pending progression edit wins those fields; otherwise the cloud copy wins.
 * Wins remain monotonic and can safely take the greater value.
 */
export function reconcileCloudProgression(local, remote, { replace = false, preferLocal = false } = {}) {
  const localState = sanitizeCloudProgression(local);
  const remoteState = sanitizeCloudProgression(remote);
  if (replace || !preferLocal) return remoteState;
  return { ...localState, wins: Math.max(localState.wins, remoteState.wins) };
}

function cleanWord(value) {
  return String(value ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function wordKey(value) {
  return cleanWord(typeof value === "object" ? value?.word : value).toLocaleLowerCase("en-US");
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function sanitizeSenseWallet(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    version: SENSE_WALLET_VERSION,
    charges: clampInteger(source.charges, 0, MAX_SENSE_CHARGES, 0),
    lastRefillDate: /^\d{4}-\d{2}-\d{2}$/.test(String(source.lastRefillDate || "")) ? String(source.lastRefillDate) : "",
    earned: clampInteger(source.earned, 0, 1_000_000, 0),
    spent: clampInteger(source.spent, 0, 1_000_000, 0)
  };
}

export function refillSenseWallet(raw, { date = new Date().toISOString().slice(0, 10), amount = 1, cap = 5 } = {}) {
  const wallet = sanitizeSenseWallet(raw);
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? String(date) : new Date().toISOString().slice(0, 10);
  if (wallet.lastRefillDate === safeDate) return { wallet, refilled: false, granted: 0 };
  const limit = clampInteger(cap, 1, MAX_SENSE_CHARGES, 5);
  const granted = Math.min(clampInteger(amount, 0, MAX_SENSE_CHARGES, 1), Math.max(0, limit - wallet.charges));
  return {
    wallet: { ...wallet, charges: wallet.charges + granted, earned: wallet.earned + granted, lastRefillDate: safeDate },
    refilled: true,
    granted
  };
}

export function spendSenseCharge(raw) {
  const wallet = sanitizeSenseWallet(raw);
  if (!wallet.charges) {
    return { wallet, spent: false, reason: "empty", assisted: false, assist: "none", division: "pure", scoreEligible: true };
  }
  return {
    wallet: { ...wallet, charges: wallet.charges - 1, spent: wallet.spent + 1 },
    spent: true,
    reason: "spent",
    assisted: true,
    assist: "sense",
    division: "open",
    scoreEligible: true,
    scoreMultiplier: ASSISTANCE_POLICIES.sense.scoreMultiplier
  };
}

export function grantSenseCharges(raw, amount = 1, { cap = MAX_SENSE_CHARGES } = {}) {
  const wallet = sanitizeSenseWallet(raw);
  const limit = clampInteger(cap, 1, MAX_SENSE_CHARGES, MAX_SENSE_CHARGES);
  const granted = Math.min(clampInteger(amount, 0, MAX_SENSE_CHARGES, 0), Math.max(0, limit - wallet.charges));
  return { wallet: { ...wallet, charges: wallet.charges + granted, earned: wallet.earned + granted }, granted };
}

function normalizedWords(words) {
  const entries = new Map();
  for (const value of Array.isArray(words) ? words : []) {
    const word = cleanWord(typeof value === "object" ? value?.word : value);
    const key = wordKey(word);
    if (!key || entries.has(key)) continue;
    entries.set(key, {
      word,
      id: `sense-${stableHash(key).toString(36)}`,
      emoji: typeof value === "object" ? cleanWord(value?.emoji).slice(0, 16) : ""
    });
  }
  return entries;
}

/**
 * Returns only safe word descriptors. It deliberately omits partners, route
 * steps, results, scores, and reasons, and never highlights both sides of a
 * currently-ready route pair.
 */
export function rankSenseCandidates({ words = [], target = "", history = [], route = [], discovered = [], limit = 3, seed = 0 } = {}) {
  const available = normalizedWords(words.length ? words : discovered);
  const known = new Set([...available.keys(), ...(Array.isArray(discovered) ? discovered.map(wordKey) : [])]);
  const targetKey = wordKey(target);
  const pending = (Array.isArray(route) ? route : []).filter((step) => step && !known.has(wordKey(step.word)));
  const readyPairs = [];
  const weights = new Map();
  pending.forEach((step, index) => {
    const a = wordKey(step.a);
    const b = wordKey(step.b);
    const aReady = available.has(a);
    const bReady = available.has(b);
    if (aReady && bReady && a !== b) readyPairs.push(new Set([a, b]));
    const base = Math.max(2, 90 - index * 7);
    if (aReady) weights.set(a, (weights.get(a) || 0) + base + (bReady ? 24 : 0));
    if (bReady) weights.set(b, (weights.get(b) || 0) + base + (aReady ? 24 : 0));
  });
  const recent = new Map();
  (Array.isArray(history) ? history : []).forEach((step, index) => {
    for (const value of [step?.word, step?.a, step?.b]) {
      const key = wordKey(value);
      if (key) recent.set(key, index + 1);
    }
  });
  const ranked = [...available.entries()]
    .filter(([key]) => key !== targetKey)
    .map(([key, item]) => ({
      key,
      item,
      weight: (weights.get(key) || 0) + Math.min(12, recent.get(key) || 0) + (stableHash(`${seed}|${targetKey}|${key}`) % 997) / 997
    }))
    .sort((left, right) => right.weight - left.weight || left.key.localeCompare(right.key));

  const selected = [];
  const maximum = clampInteger(limit, 1, 3, 3);
  for (const candidate of ranked) {
    if (selected.length >= maximum) break;
    const wouldExposePair = readyPairs.some((pair) => pair.has(candidate.key) && selected.some((entry) => pair.has(entry.key)));
    if (!wouldExposePair) selected.push(candidate);
  }
  const signals = ["bright", "warm", "resonant"];
  return selected.map((entry, index) => ({ ...entry.item, signal: signals[index] || "warm", rank: index + 1 }));
}

export const QUICK_TIP_LIMIT = 3;

const ROUTE_TIP_CATEGORIES = new Set(["force", "nature", "life", "structure"]);

function normalizedTipWords(words) {
  const entries = new Map();
  for (const value of Array.isArray(words) ? words : []) {
    const word = cleanWord(typeof value === "object" ? value?.word : value);
    const key = wordKey(word);
    if (!key || entries.has(key)) continue;
    const requestedCategory = typeof value === "object" ? cleanWord(value?.category).toLowerCase() : "";
    entries.set(key, {
      key,
      word,
      category: ROUTE_TIP_CATEGORIES.has(requestedCategory) ? requestedCategory : ""
    });
  }
  return entries;
}

function tipMentionsConcept(text, concept) {
  const normalize = (value) => String(value ?? "").normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
  const haystack = normalize(text);
  const needle = normalize(concept);
  return Boolean(haystack && needle && ` ${haystack} `.includes(` ${needle} `));
}

function firstSpoilerSafeText(candidates, forbidden) {
  return candidates.find((text) => text && !(Array.isArray(forbidden) ? forbidden : []).some((word) => tipMentionsConcept(text, word))) || "↻ + ↻";
}

/**
 * Returns short mechanics advice using only public run state. Route data is
 * deliberately not accepted, so Quick Tips can remain score-safe.
 */
export function selectQuickTip(options = {}) {
  const source = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const mode = ["quick", "moves", "daily", "weekly", "challenge", "reach"].includes(String(source.mode || "").toLowerCase())
    ? String(source.mode).toLowerCase()
    : "reach";
  const used = clampInteger(source.used, 0, QUICK_TIP_LIMIT, 0);
  if (used >= QUICK_TIP_LIMIT) return { id: "tip-limit", text: "All three Quick Tips have been used for this orbit.", remaining: 0, available: false };

  const moves = clampInteger(source.moves, 0, 1_000_000, 0);
  const discoveries = clampInteger(source.discoveries, 0, 1_000_000, 4);
  const boardWords = clampInteger(source.boardWords, 0, 1_000, 0);
  const seed = clampInteger(source.seed, 0, 0xffffffff, 0);
  const seen = new Set((Array.isArray(source.seen) ? source.seen : []).map((value) => String(value || "").slice(0, 60)).filter(Boolean));
  const tips = [];
  if (!moves) tips.push({ id: "same-word", text: "Same-word fusions count too—try doubling a foundational element." });
  if (!boardWords) tips.push({ id: "summon", text: "Tap a discovered word to summon it, then tap another word to fuse." });
  if (mode === "quick") tips.push({ id: "quick-chain", text: "For speed, use tap chains on touch or hold Ctrl and sweep across words on desktop." });
  if (mode === "moves") tips.push({ id: "move-care", text: "With limited moves, favor combinations you recognize before testing wild pairs." });
  if (["daily", "weekly"].includes(mode)) tips.push({ id: "branching", text: "Hard targets often need several branches. Build materials, forces, life, and structures in parallel." });
  if (discoveries >= 12) tips.push({ id: "search", text: "Use inventory search when the cosmos gets crowded; clearing the board never erases discoveries." });
  tips.push(
    { id: "foundations", text: "Recombine recent discoveries with the four foundations—foundational ideas make strong bridges." },
    { id: "recent", text: "A fresh discovery is usually worth testing with the words that created it." },
    { id: "tidy", text: "Tidy only rearranges the board, so use it freely when words begin to overlap." }
  );
  const unique = [...new Map(tips.map((tip) => [tip.id, tip])).values()];
  const available = unique.filter((tip) => !seen.has(tip.id));
  const pool = available.length ? available : unique;
  const tip = pool[(stableHash(`${seed}|${mode}|${moves}|${discoveries}`) + used) % pool.length];
  return { ...tip, remaining: QUICK_TIP_LIMIT - used - 1, available: true };
}

/**
 * Produces a route-aware nudge without exposing a recipe. At most one already
 * discovered ingredient is named. Its partner category is included only when
 * at least two discovered candidates fit, so the category cannot identify the
 * other ingredient. A same-word frontier never names that word.
 *
 * `id` is private bookkeeping for the run service and must not be returned by
 * a public endpoint.
 */
export function selectRouteNavigationTip(options = {}) {
  const source = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const safeInteger = (value, minimum, maximum, fallback) => {
    try { return clampInteger(value, minimum, maximum, fallback); }
    catch { return fallback; }
  };
  const words = normalizedTipWords(Array.isArray(source.words) && source.words.length ? source.words : source.discovered);
  const known = new Set(words.keys());
  const targetKey = wordKey(source.target);
  const route = Array.isArray(source.route) ? source.route.slice(0, 1_000) : [];
  const seed = safeInteger(source.seed, 0, 0xffffffff, 0);
  const used = safeInteger(source.used, 0, QUICK_TIP_LIMIT, 0);
  const seen = new Set((Array.isArray(source.seen) ? source.seen : []).map((value) => String(value || "").slice(0, 80)).filter(Boolean));

  const pending = route.map((step) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) return null;
    const a = wordKey(step.a);
    const b = wordKey(step.b);
    const result = wordKey(step.word);
    if (!a || !b || !result || result === a || result === b) return null;
    return { a, b, result };
  }).filter(Boolean).filter((step) => !known.has(step.result));
  const frontier = pending.find((step) => known.has(step.a) && known.has(step.b));

  if (frontier) {
    const frontierId = `route-${stableHash(`${targetKey}|${frontier.result}`).toString(36)}`;
    if (seen.has(frontierId)) {
      const text = firstSpoilerSafeText([
        "That route signal is still active—use it to make progress before spending another.",
        "Your current signal is still active. Make progress before spending another Tip.",
        "◇ SIGNAL ACTIVE",
        "◇"
      ], [...known, frontier.result, targetKey]);
      return {
        id: frontierId,
        kind: "route",
        text,
        available: false
      };
    }

    if (frontier.a === frontier.b) {
        const category = words.get(frontier.a)?.category || "";
        const categoryCandidates = category
          ? [...words.values()].filter((item) => item.category === category && item.key !== targetKey)
          : [];
        const qualifier = categoryCandidates.length >= 2 ? ` ${category}` : "";
        const text = firstSpoilerSafeText([
          `A same-word fusion among your discovered${qualifier} concepts opens the next bridge.`,
          "Try doubling one of your existing discoveries.",
          "↻ + ↻"
        ], [...known, frontier.result, targetKey]);
        return {
          id: frontierId,
          kind: "route",
          text,
          available: true
        };
    }

    const anchorChoices = [
      { anchorKey: frontier.a, partnerKey: frontier.b },
      { anchorKey: frontier.b, partnerKey: frontier.a }
    ].map((choice) => {
      const anchor = words.get(choice.anchorKey);
      const partnerCategory = words.get(choice.partnerKey)?.category || "";
      const categoryCandidates = partnerCategory
        ? [...words.values()].filter((item) => item.key !== choice.anchorKey && item.key !== targetKey && item.category === partnerCategory)
        : [];
      return {
        ...choice,
        anchor,
        partnerCategory,
        categoryUseful: categoryCandidates.length >= 2
      };
    }).filter((choice) => choice.anchor?.word && choice.anchorKey !== targetKey);
    const usefulChoices = anchorChoices.filter((choice) => choice.categoryUseful);
    const choicePool = usefulChoices.length ? usefulChoices : anchorChoices;
    const anchorChoice = choicePool.length
      ? choicePool[stableHash(`${seed}|${targetKey}|${frontier.result}`) % choicePool.length]
      : null;
    if (anchorChoice) {
      const { anchor, anchorKey, partnerCategory, categoryUseful } = anchorChoice;
      const categoryText = categoryUseful
        ? `Keep ${anchor.word} in play. Try it with a discovered ${partnerCategory} concept.`
        : "";
      const text = firstSpoilerSafeText([
        categoryText,
        `Keep ${anchor.word} in play. Its route-forward partner is already in your discoveries.`,
        `Useful anchor: ${anchor.word}.`,
        `✦ ${anchor.word}`
      ], [...known].filter((key) => key !== anchorKey).concat(frontier.result, targetKey));
      return {
        id: frontierId,
        kind: "route",
        text,
        available: true
      };
    }
  }

  const fallback = selectQuickTip({
    mode: source.mode,
    used,
    moves: Array.isArray(source.history) ? source.history.length : safeInteger(source.moves, 0, 1_000_000, 0),
    discoveries: words.size,
    boardWords: source.boardWords,
    seed,
    seen: [...seen]
  });
  const protectedRouteWords = [targetKey, ...known, ...pending.flatMap((step) => [step.a, step.b, step.result])].filter(Boolean);
  const fallbackText = firstSpoilerSafeText([
    fallback.text,
    "Try a familiar pairing you have not tested in this orbit.",
    "◇"
  ], protectedRouteWords);
  return { id: fallback.id, kind: "mechanic", text: fallbackText, available: fallback.available };
}

/**
 * Picks one undiscovered non-target route result that feeds a later step. The
 * returned descriptor contains no ingredients or recipe metadata, making it
 * safe for a Word Gift response after the server has verified the route.
 */
export function selectWordGift(options = {}) {
  const source = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const route = Array.isArray(source.route) ? source.route.slice(0, 1_000) : [];
  const discoveredValues = Array.isArray(source.discovered) ? source.discovered : [];
  const discovered = new Set(discoveredValues.map(wordKey).filter(Boolean));
  const targetKey = wordKey(source.target);
  const steps = route.map((step, index) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) return null;
    const word = cleanWord(step.word);
    const a = wordKey(step.a);
    const b = wordKey(step.b);
    if (!word || !a || !b) return null;
    return {
      index,
      key: wordKey(word),
      word,
      a,
      b,
      emoji: cleanWord(step.emoji).slice(0, 16),
      category: cleanWord(step.category).slice(0, 40) || null
    };
  }).filter(Boolean);
  const candidates = steps.filter((step) => step.key !== targetKey && !discovered.has(step.key));
  if (!candidates.length) return null;

  const feedsLaterStep = (candidate) => steps.some((step) => step.index > candidate.index && (step.a === candidate.key || step.b === candidate.key));
  const selected = [...candidates].reverse().find(feedsLaterStep) || candidates.at(-1);
  return {
    word: selected.word,
    emoji: selected.emoji,
    category: selected.category,
    source: "gift",
    note: "A crucial bridge gifted by the cosmos.",
    feedbackEligible: false
  };
}

function normalizeGhostSample(sample) {
  if (!sample || typeof sample !== "object") return null;
  const elapsedMs = Math.max(0, Number(sample.elapsedMs) || 0);
  const progress = Math.min(1, Math.max(0, Number(sample.progress ?? sample.playerProgress ?? (elapsedMs ? 1 : 0)) || 0));
  const moves = Math.max(0, Number(sample.moves) || 0);
  const milestone = clampInteger(sample.milestone, 0, 1_000_000, Math.floor(progress * 4));
  return { elapsedMs, progress, moves, milestone };
}

export function buildGhost(samples, { label = "Cosmos Scout" } = {}) {
  const normalized = (Array.isArray(samples) ? samples : []).map(normalizeGhostSample).filter(Boolean).sort((a, b) => a.elapsedMs - b.elapsedMs);
  if (!normalized.length) normalized.push({ elapsedMs: 0, progress: 0, moves: 0, milestone: 0 }, { elapsedMs: 75_000, progress: 1, moves: 9, milestone: 4 });
  if (normalized[0].elapsedMs > 0 || normalized[0].progress > 0) normalized.unshift({ elapsedMs: 0, progress: 0, moves: 0, milestone: 0 });
  const last = normalized.at(-1);
  if (last.progress < 1) normalized.push({ elapsedMs: Math.max(last.elapsedMs + 1, last.elapsedMs / Math.max(.01, last.progress)), progress: 1, moves: last.moves, milestone: Math.max(4, last.milestone) });
  const limited = normalized.length <= 100 ? normalized : [...normalized.slice(0, 99), normalized.at(-1)];
  return { mode: "asynchronous", live: false, label: cleanWord(label).slice(0, 40) || "Cosmos Scout", samples: limited };
}

/**
 * Builds a small encrypted-trail window without accepting or returning any
 * recipe content. Placeholder widths depend only on bounded numeric values,
 * so they cannot reveal a rival word's text or length.
 */
export function ghostTrailPreviewState(options = {}) {
  const source = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const safeInteger = (value, minimum, maximum, fallback) => {
    try { return clampInteger(value, minimum, maximum, fallback); }
    catch { return fallback; }
  };
  const total = safeInteger(source.total, 0, 1_000_000, 0);
  const current = safeInteger(source.current, 0, total, 0);
  const windowSize = safeInteger(source.windowSize, 1, 3, 3);
  const seed = safeInteger(source.seed, 0, 0xffffffff, 0);
  if (!total) {
    return { current: 0, total: 0, progress: 0, complete: false, hiddenBefore: 0, hiddenAfter: 0, steps: [] };
  }

  const complete = current >= total;
  const focus = complete ? total : current + 1;
  let start = Math.max(1, focus - (windowSize > 1 ? 1 : 0));
  let end = Math.min(total, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const steps = [];
  for (let index = start; index <= end; index += 1) {
    steps.push({
      index,
      status: index <= current ? "completed" : index === current + 1 ? "current" : "pending",
      widthPercent: 46 + stableHash(`${seed}|${total}|${index}`) % 43
    });
  }
  return {
    current,
    total,
    progress: current / total,
    complete,
    hiddenBefore: start - 1,
    hiddenAfter: total - end,
    steps
  };
}

function interpolate(left, right, elapsedMs, field) {
  if (!right || right.elapsedMs <= left.elapsedMs) return left[field];
  const ratio = Math.min(1, Math.max(0, (elapsedMs - left.elapsedMs) / (right.elapsedMs - left.elapsedMs)));
  return left[field] + (right[field] - left[field]) * ratio;
}

export function ghostSnapshot(ghost, { elapsedMs = 0, playerProgress = 0, playerMoves = 0, tolerance = .06 } = {}) {
  const samples = Array.isArray(ghost?.samples) && ghost.samples.length ? ghost.samples : buildGhost([]).samples;
  const now = Math.max(0, Number(elapsedMs) || 0);
  // A restored orbit may have been dormant for hours. The asynchronous ghost
  // has a finite recorded finish, so its displayed clock stops there instead
  // of borrowing the player's offline wall-clock time.
  const ghostElapsedMs = Math.min(now, Math.max(0, Number(samples.at(-1)?.elapsedMs) || 0));
  let left = samples[0];
  let right = samples.at(-1);
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].elapsedMs >= ghostElapsedMs) { right = samples[index]; left = samples[index - 1]; break; }
    left = samples[index];
  }
  const progress = Math.min(1, interpolate(left, right, ghostElapsedMs, "progress"));
  const moves = Math.max(0, interpolate(left, right, ghostElapsedMs, "moves"));
  const player = Math.min(1, Math.max(0, Number(playerProgress) || 0));
  const gap = player - progress;
  const safeTolerance = Math.max(.01, Number(tolerance) || .06);
  const relation = gap > safeTolerance ? "ahead" : gap < -safeTolerance ? "behind" : "even";
  const currentMilestone = clampInteger(left.milestone, 0, 1_000_000, Math.floor(progress * 4));
  const nextMilestoneSample = samples.find((sample) => sample.elapsedMs > ghostElapsedMs && sample.milestone > currentMilestone);
  return {
    mode: "asynchronous",
    live: false,
    label: ghost?.label || "Cosmos Scout",
    elapsedMs: ghostElapsedMs,
    projectedProgress: progress,
    projectedMoves: Math.round(moves),
    playerMoves: Math.max(0, Number(playerMoves) || 0),
    relation,
    gap,
    complete: progress >= 1,
    milestone: {
      current: currentMilestone,
      next: nextMilestoneSample?.milestone ?? null,
      etaMs: nextMilestoneSample ? Math.max(0, nextMilestoneSample.elapsedMs - ghostElapsedMs) : null
    }
  };
}

export const FEEDBACK_CUES = Object.freeze({
  place: Object.freeze({ wave: "sine", tones: [235], duration: 45, gain: .018, haptic: [7] }),
  combineStart: Object.freeze({ wave: "triangle", tones: [175, 280], duration: 85, gain: .022, haptic: [8] }),
  success: Object.freeze({ wave: "sine", tones: [330, 494], duration: 130, gain: .028, haptic: [14] }),
  reject: Object.freeze({ wave: "square", tones: [145, 118], duration: 95, gain: .018, haptic: [20, 28, 12] }),
  twist: Object.freeze({ wave: "triangle", tones: [294, 440, 659], duration: 220, gain: .032, haptic: [18, 35, 28, 35, 18] }),
  target: Object.freeze({ wave: "sine", tones: [262, 392, 523, 784], duration: 300, gain: .038, haptic: [20, 35, 24, 35, 36] }),
  sense: Object.freeze({ wave: "sine", tones: [220, 330, 660], duration: 260, gain: .025, haptic: [9, 42, 15] }),
  mastery: Object.freeze({ wave: "triangle", tones: [392, 523, 659], duration: 210, gain: .03, haptic: [12, 28, 20] }),
  ghostPass: Object.freeze({ wave: "sine", tones: [280, 420], duration: 120, gain: .02, haptic: [8, 24, 8] })
});

export function sanitizeFeedbackPreferences(raw) {
  let parsed = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  }
  const source = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const booleanPreference = (value, fallback) => {
    if (value === true || value === "true" || value === 1 || value === "1") return true;
    if (value === false || value === "false" || value === 0 || value === "0") return false;
    return fallback;
  };
  const rawVolume = Number(source.volume ?? source.masterVolume);
  return {
    sound: booleanPreference(source.sound, true),
    haptics: booleanPreference(source.haptics, true),
    muted: booleanPreference(source.muted, false),
    volume: Number.isFinite(rawVolume) ? Math.min(1, Math.max(0, rawVolume)) : .75
  };
}

/**
 * Pure policy for Web Audio and navigator.vibrate callers. Silent mode only
 * suppresses audio; reduced-motion suppresses vibration, while a hidden page
 * suppresses both so feedback never fires unexpectedly in the background.
 */
export function feedbackCuePolicy(cue, preferences, environment = {}) {
  const definition = FEEDBACK_CUES[cue];
  const prefs = sanitizeFeedbackPreferences(preferences);
  if (!definition) return { cue, audio: null, haptic: null };
  const hidden = environment.documentHidden === true;
  const audio = prefs.sound && !prefs.muted && prefs.volume > 0 && environment.audioAvailable !== false && environment.silent !== true && !hidden
    ? { wave: definition.wave, tones: [...definition.tones], duration: definition.duration, gain: definition.gain * prefs.volume }
    : null;
  const haptic = prefs.haptics && environment.hapticsAvailable !== false && environment.reducedMotion !== true && !hidden ? [...definition.haptic] : null;
  return { cue, audio, haptic };
}
