export const COSMOS_CIRCUIT_COPY_VERSION = 2;

const ENGLISH = Object.freeze({
  "circuit.guide.eyebrow": "FIRST FLIGHT",
  "circuit.guide.title": "Learn the route in under a minute",
  "circuit.guide.summary": "Practice uses today's exact course, costs nothing, and never grants material rewards.",
  "circuit.guide.steer": "Steer with touch, pointer, arrow keys, or W A S D.",
  "circuit.guide.targets": "Follow the direction cue and pass through planet gates and black-hole tunnels.",
  "circuit.guide.powers": "Choose one equal power at each beacon. Space or the Power button activates it.",
  "circuit.guide.fairness": "Reward Flights spend one earned Launch Pass. Entries are never sold and rewards are fixed.",
  "circuit.reward.cosmos.first": "First Cosmos clear this UTC week: 4 of every Practice power.",
  "circuit.reward.cosmos.repeat": "Repeat Cosmos clear this UTC week: Galaxy payout, 2 of every Practice power.",
  "circuit.reward.drift": "Drift payout: 1 chosen Practice power.",
  "circuit.reward.orbit": "Orbit payout: 2 chosen Practice powers.",
  "circuit.reward.nebula": "Nebula payout: 1 of every Practice power.",
  "circuit.reward.galaxy": "Galaxy payout: 2 of every Practice power.",
  "passes.status": "{passes} / {maximum} Launch Passes",
  "passes.daily": "Up to 3 earned Launch Passes are available once per UTC day. The wallet holds 6.",
  "passes.daily.reset": "Daily grants and Pure-win progress reset at 00:00 UTC.",
  "passes.pure.progress": "{current} / {required} verified unassisted Pure wins today",
  "passes.pure.rule": "Four distinct verified unassisted Pure wins earn 1 bonus Launch Pass, once per UTC day.",
  "passes.pending": "{count} earned Launch Pass grant is waiting for wallet space.",
  "passes.pending.plural": "{count} earned Launch Pass grants are waiting for wallet space.",
  "passes.rank.pending": "A rank-up pass never expires when the wallet is full. It is released automatically after a Reward Flight spends space.",
  "daily.streak.utc": "Daily streak days follow UTC. A new day begins at 00:00 UTC.",
  "daily.streak.shield": "A Streak Shield automatically covers one missed UTC day. It is consumed when the next Daily Word is completed.",
  "circuit.guide.practice": "Start guided Practice",
  "circuit.guide.dismiss": "Got it",
  "circuit.guide.replay": "How to fly",
  "crazy.card.eyebrow": "ALL-OR-NOTHING",
  "crazy.card.title": "Crazy Path",
  "crazy.card.summary": "Clear twenty required hazards on a faster route with tighter gates. One miss ends the attempt with zero reward.",
  "crazy.card.qualification": "Complete a Cosmos-tier standard Reward Flight this UTC week",
  "crazy.card.rank": "Reach Gold route rank",
  "crazy.card.entry": "Spend 3 earned Launch Passes · one attempt per UTC week",
  "crazy.card.cooldown": "Victory starts a 30-day cooldown",
  "crazy.confirm.eyebrow": "POINT OF NO RETURN",
  "crazy.confirm.title": "Commit 3 Launch Passes?",
  "crazy.confirm.warning": "A missed required checkpoint, crash, timeout, expiry, or abandonment ends this attempt. Your three passes and this week's attempt are not refunded.",
  "crazy.confirm.noPartial": "No extraction or partial milestone reward",
  "crazy.confirm.noProgress": "No powers, Path XP, or weekly-objective progress on failure",
  "crazy.confirm.equalPowers": "Stored Practice powers cannot enter; checkpoint powers are equal for everyone",
  "crazy.confirm.reward": "Success chooses 20 of each now or 3 of each per UTC day for 30 days",
  "crazy.confirm.cancel": "Keep training",
  "crazy.confirm.launch": "Launch Crazy Path · spend 3 passes",
  "crazy.flight.banner": "CRAZY PATH · ALL OR NOTHING · ANY REQUIRED MISS ENDS THE FLIGHT",
  "crazy.reward.legend": "Choose your Crazy Path reward",
  "crazy.reward.summary": "Both rewards are exact and Practice-only. Immediate Cache favors access now; Thirty-Day Supply pays more overall for waiting.",
  "crazy.reward.instant.title": "Immediate Cache",
  "crazy.reward.instant.detail": "20 Shield, 20 Phase, 20 Magnet, and 20 Time Warp now · 80 powers total",
  "crazy.reward.daily.title": "Thirty-Day Supply",
  "crazy.reward.daily.detail": "3 of every power per UTC day for 30 days · 90 of each, 360 powers total · elapsed days accrue",
  "crazy.reward.prompt": "Choose one reward to continue.",
  "crazy.reward.confirm": "Confirm permanent reward",
  "path.guide.eyebrow": "HOW STAR PATH WORKS",
  "path.guide.title": "One season, two cosmetic lanes",
  "path.guide.summary": "Eligible word wins and verified Circuit milestones earn the same XP whether or not you support the game.",
  "path.guide.free": "The Free Constellation lane is available to every player.",
  "path.guide.supporter": "The Supporter lane adds only cosmetics, profile pieces, and soundtrack unlocks.",
  "path.guide.fairness": "Neither lane changes speed, scores, Launch Passes, powers, or reward quantities.",
  "path.guide.pacing": "Your first eligible win or verified flight each UTC week includes 200 catch-up XP. Base gains are capped at 125 XP per UTC day.",
  "path.guide.dismiss": "View reward track",
  "path.guide.replay": "How it works",
  "flight.target": "Next {kind}: {direction}",
  "flight.countdown": "Flight starts in 3.",
  "flight.started": "Flight started. {target}",
  "flight.kind.gate": "planet gate",
  "flight.kind.blackHole": "black-hole tunnel",
  "flight.kind.beacon": "power beacon",
  "flight.kind.asteroid": "asteroid field",
  "flight.direction.center": "straight ahead",
  "flight.direction.left": "left",
  "flight.direction.right": "right",
  "flight.direction.up": "up",
  "flight.direction.down": "down",
  "flight.direction.upLeft": "up and left",
  "flight.direction.upRight": "up and right",
  "flight.direction.downLeft": "down and left",
  "flight.direction.downRight": "down and right"
});

export const COSMOS_CIRCUIT_COPY = Object.freeze({
  en: ENGLISH
});

function localeKey(value) {
  const locale = String(value || "en").trim().toLowerCase();
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(locale) ? locale : "en";
}

function interpolate(template, values) {
  return String(template).replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, key) => {
    const value = values?.[key];
    return value == null ? match : String(value);
  });
}

export function cosmosCircuitCopy(key, values = {}, locale = "en") {
  const normalized = localeKey(locale);
  const language = normalized.split("-")[0];
  const catalog = COSMOS_CIRCUIT_COPY[normalized]
    || COSMOS_CIRCUIT_COPY[language]
    || ENGLISH;
  const fallback = ENGLISH[key];
  return interpolate(catalog?.[key] ?? fallback ?? key, values);
}

export function cosmosCircuitLocale(value = globalThis.document?.documentElement?.lang) {
  const normalized = localeKey(value);
  return COSMOS_CIRCUIT_COPY[normalized]
    ? normalized
    : COSMOS_CIRCUIT_COPY[normalized.split("-")[0]]
      ? normalized.split("-")[0]
      : "en";
}

export function cosmosCircuitPassCopy(status = {}, locale = "en") {
  const passes = Number.isFinite(Number(status?.passes)) ? Math.max(0, Math.floor(Number(status.passes))) : 0;
  const maximum = Number.isFinite(Number(status?.maximumPasses))
    ? Math.max(0, Math.floor(Number(status.maximumPasses)))
    : 6;
  const current = Number.isFinite(Number(status?.pureWins?.current))
    ? Math.max(0, Math.floor(Number(status.pureWins.current)))
    : 0;
  const required = Number.isFinite(Number(status?.pureWins?.required))
    ? Math.max(1, Math.floor(Number(status.pureWins.required)))
    : 4;
  const pending = Number.isFinite(Number(status?.pendingTotal))
    ? Math.max(0, Math.floor(Number(status.pendingTotal)))
    : 0;
  return {
    status: cosmosCircuitCopy("passes.status", { passes, maximum }, locale),
    daily: cosmosCircuitCopy("passes.daily", {}, locale),
    reset: cosmosCircuitCopy("passes.daily.reset", {}, locale),
    pureProgress: cosmosCircuitCopy("passes.pure.progress", { current, required }, locale),
    pureRule: cosmosCircuitCopy("passes.pure.rule", {}, locale),
    pending: pending > 0
      ? cosmosCircuitCopy(pending === 1 ? "passes.pending" : "passes.pending.plural", { count: pending }, locale)
      : "",
    rankPending: cosmosCircuitCopy("passes.rank.pending", {}, locale)
  };
}

export function cosmosCircuitPolicyCopy(locale = "en") {
  return {
    utcDay: cosmosCircuitCopy("daily.streak.utc", {}, locale),
    streakShield: cosmosCircuitCopy("daily.streak.shield", {}, locale),
    firstCosmos: cosmosCircuitCopy("circuit.reward.cosmos.first", {}, locale),
    repeatCosmos: cosmosCircuitCopy("circuit.reward.cosmos.repeat", {}, locale)
  };
}
