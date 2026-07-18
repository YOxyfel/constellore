export const COSMETIC_CATALOG = Object.freeze([
  Object.freeze({ id: "void", kind: "theme", label: "Deep Void", entitlement: "free" }),
  Object.freeze({ id: "aurora", kind: "theme", label: "Aurora", entitlement: "founder" }),
  Object.freeze({ id: "solar", kind: "theme", label: "Solar", entitlement: "founder" }),
  Object.freeze({ id: "starlit", kind: "board", label: "Starlit Blackboard", entitlement: "free" }),
  Object.freeze({ id: "nebula", kind: "board", label: "Nebula Glass", entitlement: "founder" }),
  Object.freeze({ id: "blueprint", kind: "board", label: "Cosmic Blueprint", entitlement: "founder" }),
  Object.freeze({ id: "classic", kind: "trail", label: "Classic Thread", entitlement: "free" }),
  Object.freeze({ id: "comet", kind: "trail", label: "Comet Tail", entitlement: "founder" }),
  Object.freeze({ id: "prism", kind: "trail", label: "Prism Thread", entitlement: "founder" }),
  Object.freeze({ id: "cosmic", kind: "sound", label: "Cosmic Chimes", entitlement: "free" }),
  Object.freeze({ id: "glass", kind: "sound", label: "Glass Orbit", entitlement: "founder" }),
  Object.freeze({ id: "analog", kind: "sound", label: "Analog Stars", entitlement: "founder" })
]);

export const REAL_MONEY_CATALOG = Object.freeze([
  Object.freeze({ id: "constellore_founders_pass", kind: "entitlement", label: "Founder's Pass", grants: Object.freeze(["founder_cosmetics", "daily_wish", "daily_sense_bonus"]) })
]);

const defaults = Object.freeze({ theme: "void", board: "starlit", trail: "classic", sound: "cosmic" });
const byId = new Map(COSMETIC_CATALOG.map((item) => [item.id, item]));

export function cosmeticOptions(kind, { founder = false } = {}) {
  return COSMETIC_CATALOG.filter((item) => item.kind === kind).map((item) => ({ ...item, owned: item.entitlement === "free" || founder }));
}

export function sanitizeCosmeticLoadout(raw, { founder = false } = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const result = {};
  for (const kind of Object.keys(defaults)) {
    const item = byId.get(String(source[kind] || ""));
    result[kind] = item?.kind === kind && (item.entitlement === "free" || founder) ? item.id : defaults[kind];
  }
  return result;
}

export function cosmeticClasses(raw, options) {
  const loadout = sanitizeCosmeticLoadout(raw, options);
  return [`theme-${loadout.theme}`, `board-${loadout.board}`, `trail-${loadout.trail}`, `sound-${loadout.sound}`];
}

export function transformFeedbackAudio(audio, soundPack = "cosmic") {
  if (!audio) return null;
  const safe = {
    ...audio,
    tones: Array.isArray(audio.tones) ? audio.tones.map(Number).filter(Number.isFinite).slice(0, 8) : []
  };
  if (soundPack === "glass") {
    safe.wave = "sine";
    safe.tones = safe.tones.map((tone) => Math.min(1400, Math.max(90, Math.round(tone * 1.35))));
    safe.gain = Math.min(.08, Number(safe.gain || 0) * .84);
  } else if (soundPack === "analog") {
    safe.wave = "triangle";
    safe.tones = safe.tones.map((tone) => Math.min(1100, Math.max(80, Math.round(tone * .82))));
    safe.gain = Math.min(.08, Number(safe.gain || 0) * 1.08);
  }
  return safe;
}

export function economyIntegrityPolicy() {
  return {
    realMoneyProductKinds: [...new Set(REAL_MONEY_CATALOG.map((item) => item.kind))],
    soldForCash: REAL_MONEY_CATALOG.map((item) => item.id),
    forbiddenCashProducts: ["star_credits", "word_license", "sense_charge", "score_boost", "extra_moves", "extra_time"],
    competitiveWordDivision: "open",
    fluctuatingPricesCurrency: "star_credits",
    personalizedPricing: false,
    randomPaidContents: false
  };
}
