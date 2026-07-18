export const SENSE_WALLET_VERSION = 1;
export const MAX_SENSE_CHARGES = 9;

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
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
    division: "assisted",
    scoreEligible: false
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

function interpolate(left, right, elapsedMs, field) {
  if (!right || right.elapsedMs <= left.elapsedMs) return left[field];
  const ratio = Math.min(1, Math.max(0, (elapsedMs - left.elapsedMs) / (right.elapsedMs - left.elapsedMs)));
  return left[field] + (right[field] - left[field]) * ratio;
}

export function ghostSnapshot(ghost, { elapsedMs = 0, playerProgress = 0, playerMoves = 0, tolerance = .06 } = {}) {
  const samples = Array.isArray(ghost?.samples) && ghost.samples.length ? ghost.samples : buildGhost([]).samples;
  const now = Math.max(0, Number(elapsedMs) || 0);
  let left = samples[0];
  let right = samples.at(-1);
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].elapsedMs >= now) { right = samples[index]; left = samples[index - 1]; break; }
    left = samples[index];
  }
  const progress = Math.min(1, interpolate(left, right, now, "progress"));
  const moves = Math.max(0, interpolate(left, right, now, "moves"));
  const player = Math.min(1, Math.max(0, Number(playerProgress) || 0));
  const gap = player - progress;
  const safeTolerance = Math.max(.01, Number(tolerance) || .06);
  const relation = gap > safeTolerance ? "ahead" : gap < -safeTolerance ? "behind" : "even";
  const currentMilestone = clampInteger(left.milestone, 0, 1_000_000, Math.floor(progress * 4));
  const nextMilestoneSample = samples.find((sample) => sample.elapsedMs > now && sample.milestone > currentMilestone);
  return {
    mode: "asynchronous",
    live: false,
    label: ghost?.label || "Cosmos Scout",
    elapsedMs: now,
    projectedProgress: progress,
    projectedMoves: Math.round(moves),
    playerMoves: Math.max(0, Number(playerMoves) || 0),
    relation,
    gap,
    complete: progress >= 1,
    milestone: {
      current: currentMilestone,
      next: nextMilestoneSample?.milestone ?? null,
      etaMs: nextMilestoneSample ? Math.max(0, nextMilestoneSample.elapsedMs - now) : null
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
