export const COSMOS_CIRCUIT_VERSION = 2;
export const DAILY_LAUNCH_PASSES = 3;
export const MAX_LAUNCH_PASSES = 6;
export const PURE_WINS_PER_BONUS_PASS = 4;
export const MAX_DAILY_PURE_WIN_BONUSES = 1;
export const MAX_CIRCUIT_CLAIMS = 256;
export const CRAZY_PATH_ENTRY_PASSES = 3;
export const CRAZY_PATH_MIN_ROUTE_RANK = 3;
export const CRAZY_PATH_INSTANT_POWERS = 20;
export const CRAZY_PATH_DAILY_POWERS = 3;
export const CRAZY_PATH_DAILY_DAYS = 30;
export const CRAZY_PATH_VICTORY_COOLDOWN_DAYS = 30;
export const CRAZY_PATH_REWARD_CHOICES = Object.freeze(["instant", "daily"]);

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const CIRCUIT_EPOCH_MS = Date.UTC(2024, 0, 1); // Monday
const MAX_RUN_ID_LENGTH = 80;
const MAX_EVENT_ELAPSED_MS = 10 * 60_000;
const MAX_RECENT_WIN_IDS = 64;
const MAX_RANK_GRANT_IDS = 64;
const MAX_SPENT_RUN_IDS = 64;
const MAX_COSMOS_WEEK_KEYS = 104;
const MAX_CRAZY_ATTEMPT_WEEK_KEYS = 104;
const MINIMUM_DRIFT_SEGMENTS = 5;

export const CIRCUIT_BOOSTS = Object.freeze(["shield", "phase", "magnet", "timeWarp"]);
export const CIRCUIT_POWERUPS = CIRCUIT_BOOSTS;
export const CIRCUIT_ABILITIES = CIRCUIT_BOOSTS;

// This module deliberately has no purchase path. Launch Passes are earned,
// rewards are deterministic, and Practice Flights never consume a pass.
export const COSMOS_CIRCUIT_ECONOMY = Object.freeze({
  launchPasses: "earned-only",
  paidEntries: false,
  randomRewards: false,
  practiceFlights: "unlimited",
  crazyPath: Object.freeze({
    entryPasses: CRAZY_PATH_ENTRY_PASSES,
    minimumRouteRank: CRAZY_PATH_MIN_ROUTE_RANK,
    qualification: "same-week-cosmos",
    attempts: "one-per-utc-week",
    rewards: "all-or-nothing",
    victoryCooldownDays: CRAZY_PATH_VICTORY_COOLDOWN_DAYS
  }),
  rankedWordGameAdvantage: false
});

const WEEKLY_CIRCUITS = Object.freeze([
  Object.freeze({
    id: "aurora-rim",
    name: "Aurora Rim",
    accent: "ion-cyan",
    planets: Object.freeze(["Aster", "Caelum", "Vela", "Nacre", "Ilyra", "Orison", "Solis", "Viridia", "Halcyon", "Cinder"]),
    blackHoles: Object.freeze(["Umbra Well", "Silent Maw", "Night Lens", "Gravitas"]),
    asteroidFields: Object.freeze(["Glasswake Belt", "Cinder Drift", "Needle Field"])
  }),
  Object.freeze({
    id: "ember-expanse",
    name: "Ember Expanse",
    accent: "solar-amber",
    planets: Object.freeze(["Pyra", "Orrery", "Kestrel", "Emberfall", "Caldera", "Helios", "Brasshaven", "Ferro", "Morrow", "Flare"]),
    blackHoles: Object.freeze(["Ashen Eye", "Dark Furnace", "Obsidian Gate", "Null Star"]),
    asteroidFields: Object.freeze(["Iron Choir", "Saffron Belt", "Redglass Reach"])
  }),
  Object.freeze({
    id: "tidal-constellation",
    name: "Tidal Constellation",
    accent: "deep-aqua",
    planets: Object.freeze(["Pelagos", "Tethys", "Nerida", "Thalassa", "Maris", "Coralyn", "Deluge", "Azure", "Current", "Isla"]),
    blackHoles: Object.freeze(["Abyssal Turn", "Deep Quiet", "Drowned Sun", "Midnight Current"]),
    asteroidFields: Object.freeze(["Pearl Scatter", "Foamline", "Moon-Tide Belt"])
  }),
  Object.freeze({
    id: "luminous-archive",
    name: "Luminous Archive",
    accent: "archive-violet",
    planets: Object.freeze(["Codex", "Mosaic", "Glyph", "Vesper", "Lumen", "Ananke", "Echo", "Palimpsest", "Rune", "Axiom"]),
    blackHoles: Object.freeze(["Forgotten Door", "Ink Horizon", "Quiet Index", "Last Page"]),
    asteroidFields: Object.freeze(["Fragment Field", "Dust Archive", "Broken Orrery"])
  }),
  Object.freeze({
    id: "verdant-spiral",
    name: "Verdant Spiral",
    accent: "canopy-green",
    planets: Object.freeze(["Canopy", "Sylva", "Mosslight", "Fern", "Grove", "Bloom", "Rootsong", "Meadow", "Lichen", "Seed"]),
    blackHoles: Object.freeze(["Hollow Root", "Shadow Canopy", "Old Growth", "Deep Seed"]),
    asteroidFields: Object.freeze(["Pollen Wake", "Bramble Belt", "Spore Cloud"])
  })
]);

const SEGMENT_PATTERN = Object.freeze([
  "planet-gate",
  "asteroid-field",
  "planet-gate",
  "black-hole",
  "planet-gate",
  "ability-gate",
  "planet-gate",
  "asteroid-field",
  "planet-gate",
  "black-hole",
  "planet-gate",
  "planet-gate",
  "planet-gate",
  "ability-gate",
  "asteroid-field"
]);

const CRAZY_SEGMENT_PATTERN = Object.freeze([
  "planet-gate",
  "asteroid-field",
  "planet-gate",
  "black-hole",
  "planet-gate",
  "asteroid-field",
  "planet-gate",
  "black-hole",
  "ability-gate",
  "planet-gate",
  "black-hole",
  "asteroid-field",
  "planet-gate",
  "black-hole",
  "planet-gate",
  "ability-gate",
  "planet-gate",
  "black-hole",
  "asteroid-field",
  "planet-gate",
  "planet-gate",
  "black-hole"
]);

const ROUTE_ARCHETYPE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "wayfinder-weave",
    name: "Wayfinder Weave",
    description: "A balanced centerline that alternates wide turns and narrow returns."
  }),
  Object.freeze({
    id: "gravity-braid",
    name: "Gravity Braid",
    description: "A mirrored route that repeatedly crosses the gravity center."
  }),
  Object.freeze({
    id: "comet-switchback",
    name: "Comet Switchback",
    description: "Alternating high and low lanes form a sharp cosmic switchback."
  })
]);

export const COSMOS_CIRCUIT_ARCHETYPES = Object.freeze(
  ROUTE_ARCHETYPE_DEFINITIONS.map((archetype) => Object.freeze({ ...archetype }))
);

const REWARD_LADDER = Object.freeze({
  none: Object.freeze({ tier: "none", chosen: 0, each: 0, starPathXp: 0, cosmeticMasteryXp: 0 }),
  drift: Object.freeze({ tier: "drift", chosen: 1, each: 0, starPathXp: 20, cosmeticMasteryXp: 10 }),
  orbit: Object.freeze({ tier: "orbit", chosen: 2, each: 0, starPathXp: 35, cosmeticMasteryXp: 20 }),
  nebula: Object.freeze({ tier: "nebula", chosen: 0, each: 1, starPathXp: 55, cosmeticMasteryXp: 35 }),
  galaxy: Object.freeze({ tier: "galaxy", chosen: 0, each: 2, starPathXp: 85, cosmeticMasteryXp: 60 }),
  cosmos: Object.freeze({ tier: "cosmos", chosen: 0, each: 4, starPathXp: 125, cosmeticMasteryXp: 100 })
});

function cleanIdentifier(value, maximum = MAX_RUN_ID_LENGTH) {
  if (typeof value !== "string") return "";
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  if (!normalized || normalized.length > maximum || !/^[a-z0-9][a-z0-9-]*$/.test(normalized)) return "";
  return normalized;
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function uniqueIdentifiers(values, maximumItems, maximumLength = MAX_RUN_ID_LENGTH) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values.slice(-maximumItems * 2) : []) {
    const id = cleanIdentifier(value, maximumLength);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result.slice(-maximumItems);
}

function safeDate(value, fallback = CIRCUIT_EPOCH_MS) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return new Date(value.getTime());
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
  }
  if (typeof value === "string" && value.length <= 64) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
  }
  return new Date(fallback);
}

function dayKeyFor(value) {
  return safeDate(value).toISOString().slice(0, 10);
}

function validDayKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
}

function weekStartMs(value) {
  const date = safeDate(value);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return midnight - ((new Date(midnight).getUTCDay() + 6) % 7) * DAY_MS;
}

function isoWeekKey(mondayMs) {
  const thursday = new Date(mondayMs + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil((((thursday.getTime() - yearStart) / DAY_MS) + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function validWeekKey(value) {
  return typeof value === "string" && /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(value) ? value : "";
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function hash32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function randomGenerator(seed) {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function freezeCourse(course) {
  return Object.freeze({
    ...course,
    archetype: Object.freeze({ ...course.archetype }),
    weeklyCircuit: Object.freeze({ ...course.weeklyCircuit }),
    checkpoints: Object.freeze(course.checkpoints.map((checkpoint) => Object.freeze({ ...checkpoint }))),
    segments: Object.freeze(course.segments.map((segment) => Object.freeze({
      ...segment,
      abilityOptions: segment.abilityOptions ? Object.freeze([...segment.abilityOptions]) : undefined
    }))),
    goals: Object.freeze(course.goals.map((goal) => Object.freeze({ ...goal })))
  });
}

function archetypePoint(x, y, index, archetypeIndex) {
  if (archetypeIndex === 1) return { x: 1 - x, y };
  if (archetypeIndex === 2) {
    return index % 2 ? { x: y, y: 1 - x } : { x: 1 - y, y: x };
  }
  return { x, y };
}

function courseIdentity(value = new Date(), path = "standard") {
  const dayKey = validDayKey(value) || dayKeyFor(value);
  const weekly = cosmosCircuitWeek(Date.parse(`${dayKey}T00:00:00.000Z`));
  const definition = WEEKLY_CIRCUITS[weekly.rotationIndex];
  const crazy = path === "crazy";
  const seed = hash32(`${weekly.weekKey}:${dayKey}:${definition.id}${crazy ? ":crazy" : ""}`);
  const archetypeIndex = positiveModulo(seed, ROUTE_ARCHETYPE_DEFINITIONS.length);
  return { dayKey, weekly, definition, crazy, seed, archetypeIndex };
}

export function cosmosCircuitArchetypes() {
  return COSMOS_CIRCUIT_ARCHETYPES.map((archetype) => ({ ...archetype }));
}

export function cosmosCircuitArchetype(value = new Date(), path = "standard") {
  const identity = courseIdentity(value, path === "crazy" ? "crazy" : "standard");
  return {
    ...COSMOS_CIRCUIT_ARCHETYPES[identity.archetypeIndex],
    index: identity.archetypeIndex,
    dayKey: identity.dayKey,
    path: identity.crazy ? "crazy" : "standard"
  };
}

function resolveCourse(value = new Date(), path = "standard") {
  const resolve = path === "crazy" ? cosmosCircuitCrazyCourse : cosmosCircuitCourse;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const explicitDay = validDayKey(value.dayKey ?? value.courseDayKey);
    if (explicitDay) return resolve(explicitDay);
  }
  const explicitDay = validDayKey(value);
  return resolve(explicitDay || value);
}

export function cosmosCircuitWeek(value = new Date()) {
  const startsAtMs = weekStartMs(value);
  const absoluteWeek = Math.floor((startsAtMs - CIRCUIT_EPOCH_MS) / WEEK_MS);
  const rotationIndex = positiveModulo(absoluteWeek, WEEKLY_CIRCUITS.length);
  const definition = WEEKLY_CIRCUITS[rotationIndex];
  return {
    version: COSMOS_CIRCUIT_VERSION,
    weekKey: isoWeekKey(startsAtMs),
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt: new Date(startsAtMs + WEEK_MS).toISOString(),
    rotationIndex,
    seed: hash32(`cosmos-circuit:${isoWeekKey(startsAtMs)}`),
    id: definition.id,
    name: definition.name,
    accent: definition.accent
  };
}

function buildCircuitCourse(value = new Date(), crazy = false) {
  const identity = courseIdentity(value, crazy ? "crazy" : "standard");
  const { dayKey, weekly, definition, seed, archetypeIndex } = identity;
  const startsAtMs = Date.parse(`${dayKey}T00:00:00.000Z`);
  const random = randomGenerator(seed);
  const planets = shuffled(definition.planets, random).slice(0, crazy ? 10 : 8);
  const blackHoles = shuffled(definition.blackHoles, random);
  const asteroidFields = shuffled(definition.asteroidFields, random);
  let planetIndex = 0;
  let blackHoleIndex = 0;
  let asteroidIndex = 0;
  const archetype = {
    ...COSMOS_CIRCUIT_ARCHETYPES[archetypeIndex],
    index: archetypeIndex
  };
  const pattern = crazy ? CRAZY_SEGMENT_PATTERN : SEGMENT_PATTERN;
  const segments = pattern.map((kind, index) => {
    const sector = Math.floor(index / 5) + 1;
    const number = index + 1;
    const durationMs = crazy
      ? 3_800 + Math.floor(random() * 900)
      : 4_800 + Math.floor(random() * 1_400);
    const stardust = 5 + Math.floor(random() * 5);
    let name = `Checkpoint ${number}`;
    if (kind === "planet-gate") name = planets[planetIndex++];
    else if (kind === "black-hole") {
      const pass = Math.floor(blackHoleIndex / blackHoles.length) + 1;
      name = `${blackHoles[blackHoleIndex % blackHoles.length]}${pass > 1 ? ` ${pass}` : ""}`;
      blackHoleIndex += 1;
    } else if (kind === "asteroid-field") {
      const pass = Math.floor(asteroidIndex / asteroidFields.length) + 1;
      name = `${asteroidFields[asteroidIndex % asteroidFields.length]}${pass > 1 ? ` ${pass}` : ""}`;
      asteroidIndex += 1;
    } else name = crazy ? "Singularity Cache" : sector === 2 ? "Wayfinder Cache" : "Farstar Cache";
    return {
      id: `s${String(number).padStart(2, "0")}-${kind}`,
      index,
      sector,
      kind,
      name,
      durationMs,
      stardust,
      required: kind !== "ability-gate",
      abilityOptions: kind === "ability-gate" ? [...CIRCUIT_ABILITIES] : undefined
    };
  });
  const totalStardust = segments.reduce((sum, segment) => sum + segment.stardust, 0);
  const expectedDurationMs = segments.reduce((sum, segment) => sum + segment.durationMs, 0);
  let elapsedMs = 0;
  const checkpointCounts = { gate: 0, blackHole: 0, beacon: 0, stardust: 0 };
  const checkpoints = [];
  for (const segment of segments) {
    const at = elapsedMs + Math.floor(segment.durationMs / 2);
    elapsedMs += segment.durationMs;
    const type = segment.kind === "planet-gate"
      ? "gate"
      : segment.kind === "black-hole"
        ? "blackHole"
        : segment.kind === "ability-gate"
          ? "beacon"
          : "";
    if (!type) continue;
    checkpointCounts[type] += 1;
    const point = archetypePoint(
      0.18 + random() * 0.64,
      0.16 + random() * 0.68,
      checkpoints.length,
      archetypeIndex
    );
    checkpoints.push({
      id: `${type}-${String(checkpointCounts[type]).padStart(2, "0")}`,
      type,
      at,
      x: Number(point.x.toFixed(4)),
      y: Number(point.y.toFixed(4)),
      radius: crazy
        ? type === "blackHole" ? 0.095 : type === "gate" ? 0.075 : 0.06
        : type === "blackHole" ? 0.13 : type === "gate" ? 0.105 : 0.075
    });
  }
  const stardustCount = crazy ? 36 : 24;
  for (let index = 0; index < stardustCount; index += 1) {
    checkpointCounts.stardust += 1;
    const point = archetypePoint(
      0.16 + random() * 0.68,
      0.14 + random() * 0.72,
      index,
      archetypeIndex
    );
    checkpoints.push({
      id: `stardust-${String(index + 1).padStart(2, "0")}`,
      type: "stardust",
      at: Math.floor(2_500 + ((index + 0.5) / stardustCount) * (expectedDurationMs - 5_000)),
      x: Number(point.x.toFixed(4)),
      y: Number(point.y.toFixed(4)),
      radius: 0.026
    });
  }
  checkpoints.sort((left, right) => left.at - right.at || left.id.localeCompare(right.id));
  const planetGoal = segments.filter((segment) => segment.kind === "planet-gate").length;
  const blackHoleGoal = segments.filter((segment) => segment.kind === "black-hole").length;
  const requiredGoal = segments.filter((segment) => segment.required).length;
  return freezeCourse({
    version: COSMOS_CIRCUIT_VERSION,
    id: `${crazy ? "crazy" : "cosmos"}-${dayKey}`,
    variant: crazy ? "crazy" : "standard",
    dayKey,
    weekKey: weekly.weekKey,
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt: new Date(startsAtMs + DAY_MS).toISOString(),
    seed,
    archetype,
    archetypeId: archetype.id,
    name: crazy ? `${weekly.name} Singularity Path` : `${weekly.name} Circuit`,
    durationMs: expectedDurationMs,
    expectedDurationMs,
    totalStardust,
    weeklyCircuit: weekly,
    checkpoints,
    segments,
    goals: crazy
      ? [
          { id: "all-required", label: `Clear all ${requiredGoal} required checkpoints`, required: requiredGoal },
          { id: "planet-sequence", label: `Pass all ${planetGoal} planets in order`, required: planetGoal },
          { id: "black-hole-tunnels", label: `Clear all ${blackHoleGoal} black-hole tunnels`, required: blackHoleGoal },
          { id: "no-extraction", label: "Finish the entire route · no extraction", required: true },
          { id: "all-or-nothing", label: "Any required miss ends the attempt", required: true }
        ]
      : [
          { id: "planet-sequence", label: "Pass all 8 planets in order", required: 8 },
          { id: "black-hole-tunnels", label: "Clear 2 black-hole tunnels", required: 2 },
          { id: "perfect-slingshots", label: "Perform 2 perfect slingshots", required: 2 },
          { id: "stardust-trail", label: "Collect 80% of the Stardust trail", required: 80 },
          { id: "shield-intact", label: "Finish with your shield intact", required: true }
        ]
  });
}

export function cosmosCircuitCourse(value = new Date()) {
  return buildCircuitCourse(value, false);
}

export function cosmosCircuitCrazyCourse(value = new Date()) {
  return buildCircuitCourse(value, true);
}

export function cosmosCircuitRewardLadder() {
  return Object.fromEntries(Object.entries(REWARD_LADDER)
    .filter(([tier]) => tier !== "none")
    .map(([tier, reward]) => [tier, { ...reward }]));
}

export function sanitizeCircuitWallet(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const dailyPureSource = source.dailyPure && typeof source.dailyPure === "object" && !Array.isArray(source.dailyPure)
    ? source.dailyPure
    : {};
  const dailyPureDay = validDayKey(dailyPureSource.dayKey);
  const awarded = Boolean(dailyPureDay && dailyPureSource.awarded);
  const rankGrantIds = uniqueIdentifiers(source.rankGrantIds, MAX_RANK_GRANT_IDS);
  const rankGrantSet = new Set(rankGrantIds);
  const pendingRankGrantIds = uniqueIdentifiers(source.pendingRankGrantIds, MAX_RANK_GRANT_IDS)
    .filter((id) => !rankGrantSet.has(id));
  return {
    version: COSMOS_CIRCUIT_VERSION,
    earnedOnly: true,
    passes: clampInteger(source.passes, 0, MAX_LAUNCH_PASSES, 0),
    dailyGrantDay: validDayKey(source.dailyGrantDay),
    dailyPure: {
      dayKey: dailyPureDay,
      wins: clampInteger(dailyPureSource.wins, 0, PURE_WINS_PER_BONUS_PASS, 0),
      awarded,
      pending: Boolean(awarded && dailyPureSource.pending)
    },
    recentPureWinIds: uniqueIdentifiers(source.recentPureWinIds, MAX_RECENT_WIN_IDS),
    rankGrantIds,
    pendingRankGrantIds,
    spentRunIds: uniqueIdentifiers(source.spentRunIds, MAX_SPENT_RUN_IDS)
  };
}

export function claimPendingLaunchPasses(rawWallet, { maximum = MAX_LAUNCH_PASSES } = {}) {
  const wallet = sanitizeCircuitWallet(rawWallet);
  const limit = clampInteger(maximum, 0, MAX_LAUNCH_PASSES, MAX_LAUNCH_PASSES);
  let available = Math.max(0, limit - wallet.passes);
  const rankIds = wallet.pendingRankGrantIds.slice(0, available);
  if (rankIds.length) {
    const released = new Set(rankIds);
    wallet.pendingRankGrantIds = wallet.pendingRankGrantIds.filter((id) => !released.has(id));
    wallet.rankGrantIds = [...wallet.rankGrantIds, ...rankIds].slice(-MAX_RANK_GRANT_IDS);
    wallet.passes += rankIds.length;
    available -= rankIds.length;
  }
  const pureGranted = available > 0 && wallet.dailyPure.pending ? 1 : 0;
  if (pureGranted) {
    wallet.dailyPure.pending = false;
    wallet.passes += 1;
  }
  const granted = rankIds.length + pureGranted;
  const hasPending = wallet.pendingRankGrantIds.length > 0 || wallet.dailyPure.pending;
  return {
    wallet,
    granted,
    rankGranted: rankIds.length,
    rankIds,
    pureGranted,
    reason: granted > 0 ? "pending_grant_released" : hasPending ? "wallet_full" : "nothing_pending"
  };
}

export function circuitPassEarningStatus(rawWallet, at = new Date()) {
  const wallet = sanitizeCircuitWallet(rawWallet);
  const dayKey = dayKeyFor(at);
  const pureIsToday = wallet.dailyPure.dayKey === dayKey;
  const pureWins = pureIsToday ? wallet.dailyPure.wins : 0;
  const pureAwarded = pureIsToday && wallet.dailyPure.awarded;
  const resetAt = new Date(Date.parse(`${dayKey}T00:00:00.000Z`) + DAY_MS).toISOString();
  return {
    dayKey,
    resetAt,
    resetPolicy: "utc-midnight",
    passes: wallet.passes,
    maximumPasses: MAX_LAUNCH_PASSES,
    spaceAvailable: MAX_LAUNCH_PASSES - wallet.passes,
    daily: {
      amount: DAILY_LAUNCH_PASSES,
      available: wallet.dailyGrantDay < dayKey,
      lastGrantedDay: wallet.dailyGrantDay
    },
    pureWins: {
      current: pureWins,
      required: PURE_WINS_PER_BONUS_PASS,
      remaining: pureAwarded ? 0 : Math.max(0, PURE_WINS_PER_BONUS_PASS - pureWins),
      complete: pureAwarded,
      pending: Boolean(pureIsToday && wallet.dailyPure.pending)
    },
    pendingRankGrants: wallet.pendingRankGrantIds.length,
    pendingTotal: wallet.pendingRankGrantIds.length + (wallet.dailyPure.pending ? 1 : 0)
  };
}

export function grantDailyLaunchPasses(rawWallet, at = new Date()) {
  const wallet = sanitizeCircuitWallet(rawWallet);
  const dayKey = dayKeyFor(at);
  if (wallet.dailyGrantDay >= dayKey) {
    return {
      wallet,
      granted: 0,
      reason: wallet.dailyGrantDay === dayKey ? "already_granted" : "clock_before_last_grant"
    };
  }
  if (wallet.passes >= MAX_LAUNCH_PASSES) {
    return { wallet, granted: 0, reason: "wallet_full" };
  }
  const granted = Math.min(DAILY_LAUNCH_PASSES, MAX_LAUNCH_PASSES - wallet.passes);
  wallet.passes += granted;
  wallet.dailyGrantDay = dayKey;
  return { wallet, granted, reason: "daily_grant" };
}

export function recordEligiblePureWin(rawWallet, {
  winId = "",
  mode = "",
  won = false,
  assisted = true,
  verified = false,
  at = new Date()
} = {}) {
  const wallet = sanitizeCircuitWallet(rawWallet);
  const id = cleanIdentifier(winId);
  if (!id || mode !== "pure" || won !== true || assisted !== false || verified !== true) {
    return { wallet, granted: 0, stamped: false, reason: "ineligible_win" };
  }
  if (wallet.recentPureWinIds.includes(id)) return { wallet, granted: 0, stamped: false, reason: "duplicate_win" };
  const dayKey = dayKeyFor(at);
  if (wallet.dailyPure.dayKey !== dayKey) {
    wallet.dailyPure = { dayKey, wins: 0, awarded: false, pending: false };
  }
  wallet.recentPureWinIds = [...wallet.recentPureWinIds, id].slice(-MAX_RECENT_WIN_IDS);
  if (wallet.dailyPure.awarded) return { wallet, granted: 0, stamped: false, reason: "daily_bonus_complete" };
  wallet.dailyPure.wins = Math.min(PURE_WINS_PER_BONUS_PASS, wallet.dailyPure.wins + 1);
  if (wallet.dailyPure.wins < PURE_WINS_PER_BONUS_PASS) {
    return { wallet, granted: 0, stamped: true, reason: "pure_win_stamped" };
  }
  wallet.dailyPure.awarded = true;
  if (wallet.passes >= MAX_LAUNCH_PASSES) {
    wallet.dailyPure.pending = true;
    return { wallet, granted: 0, stamped: true, reason: "bonus_pending" };
  }
  wallet.passes += 1;
  return { wallet, granted: 1, stamped: true, reason: "pure_win_bonus" };
}

export function grantRankLaunchPass(rawWallet, {
  rankId = "",
  verified = false
} = {}) {
  const wallet = sanitizeCircuitWallet(rawWallet);
  const id = cleanIdentifier(rankId);
  if (!id || verified !== true) return { wallet, granted: 0, reason: "invalid_rank" };
  if (wallet.rankGrantIds.includes(id)) return { wallet, granted: 0, reason: "already_granted" };
  if (wallet.pendingRankGrantIds.includes(id)) {
    return { wallet, granted: 0, pending: 1, reason: "already_pending" };
  }
  if (wallet.passes >= MAX_LAUNCH_PASSES) {
    wallet.pendingRankGrantIds = [...wallet.pendingRankGrantIds, id].slice(-MAX_RANK_GRANT_IDS);
    return { wallet, granted: 0, pending: 1, reason: "rank_grant_pending" };
  }
  wallet.passes += 1;
  wallet.rankGrantIds = [...wallet.rankGrantIds, id].slice(-MAX_RANK_GRANT_IDS);
  return { wallet, granted: 1, pending: 0, reason: "rank_grant" };
}

function canonicalMode(value) {
  return value === "ticketed" ? "ticketed" : "practice";
}

function canonicalPath(value) {
  return value === "crazy" ? "crazy" : "standard";
}

function canonicalOutcome(value) {
  return ["perfect", "clear", "near-miss", "miss"].includes(value) ? value : "miss";
}

function canonicalAbility(value) {
  return CIRCUIT_ABILITIES.includes(value) ? value : "";
}

function canonicalEndReason(value) {
  return ["finish", "extract", "crash", "timeout", "withdraw"].includes(value) ? value : "";
}

function canonicalTrajectorySamples(rawSamples, segment, previousElapsedMs) {
  const samples = [];
  let lastProgressMs = -1;
  let lastElapsedMs = previousElapsedMs - 1;
  for (const raw of Array.isArray(rawSamples) ? rawSamples.slice(0, 64) : []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const progressMs = clampInteger(raw.progressMs, 0, segment.durationMs, -1);
    const elapsedMs = clampInteger(raw.elapsedMs, previousElapsedMs, MAX_EVENT_ELAPSED_MS, -1);
    const x = Number(raw.x);
    const y = Number(raw.y);
    if (progressMs < 0
      || elapsedMs < previousElapsedMs
      || !Number.isFinite(x)
      || !Number.isFinite(y)
      || x < 0
      || x > 1
      || y < 0
      || y > 1
      || progressMs <= lastProgressMs
      || elapsedMs <= lastElapsedMs) {
      continue;
    }
    samples.push({
      progressMs,
      elapsedMs,
      x: Math.round(x * 10_000) / 10_000,
      y: Math.round(y * 10_000) / 10_000
    });
    lastProgressMs = progressMs;
    lastElapsedMs = elapsedMs;
  }
  return samples;
}

function canonicalRunEvent(rawEvent, segment, previousElapsedMs) {
  const source = rawEvent && typeof rawEvent === "object" && !Array.isArray(rawEvent) ? rawEvent : {};
  if (source.segmentId !== segment.id) return null;
  const outcome = canonicalOutcome(source.outcome);
  const elapsedMs = Math.max(
    previousElapsedMs,
    clampInteger(source.elapsedMs, 0, MAX_EVENT_ELAPSED_MS, previousElapsedMs + segment.durationMs)
  );
  return {
    segmentId: segment.id,
    outcome,
    stardust: clampInteger(source.stardust, 0, segment.stardust, 0),
    ability: segment.kind === "ability-gate" ? canonicalAbility(source.ability) : "",
    useAbility: canonicalAbility(source.useAbility),
    samples: canonicalTrajectorySamples(source.samples, segment, previousElapsedMs),
    elapsedMs
  };
}

function rewardMilestone(metrics, endReason, path = "standard") {
  if (!endReason || endReason === "withdraw") return "none";
  if (path === "crazy") return endReason === "finish" && metrics.crazyComplete ? "crazy" : "none";
  if (metrics.cosmosComplete) return "cosmos";
  if (metrics.completedCourse) return "galaxy";
  if (metrics.sectorsCleared >= 2) return "nebula";
  if (metrics.planetGatesPassed >= 8) return "orbit";
  if (metrics.segmentsCompleted >= MINIMUM_DRIFT_SEGMENTS) return "drift";
  return "none";
}

function calculateMetrics(course, events, practiceBoost = "") {
  const abilities = Object.fromEntries(CIRCUIT_ABILITIES.map((ability) => [ability, 0]));
  if (practiceBoost) abilities[practiceBoost] = 1;
  let shieldIntact = true;
  let flow = 0;
  let maxFlow = 0;
  let score = 0;
  let collectedStardust = 0;
  let planetGatesPassed = 0;
  let blackHolesCleared = 0;
  let perfectSlingshots = 0;
  const sectorCount = Math.ceil(course.segments.length / 5);
  const successfulRequiredBySector = Array(sectorCount).fill(true);
  const reachedSectors = new Set();
  let requiredCheckpointsCleared = 0;
  let requiredCheckpointsFailed = 0;

  events.forEach((event, index) => {
    const segment = course.segments[index];
    reachedSectors.add(segment.sector);
    if (event.ability) abilities[event.ability] += 1;
    let usedAbility = "";
    if (event.useAbility && abilities[event.useAbility] > 0) {
      abilities[event.useAbility] -= 1;
      usedAbility = event.useAbility;
    }
    let successful = event.outcome !== "miss";
    if (!successful && usedAbility === "phase") successful = true;
    const hazardous = segment.kind === "black-hole" || segment.kind === "asteroid-field";
    if (!successful && hazardous && usedAbility !== "shield") shieldIntact = false;
    const collected = Math.min(segment.stardust, event.stardust + (usedAbility === "magnet" ? 2 : 0));
    collectedStardust += collected;

    if (successful) {
      const base = segment.kind === "planet-gate"
        ? 1_000
        : segment.kind === "black-hole"
          ? 1_500
          : segment.kind === "asteroid-field"
            ? 650
            : 300;
      const quality = event.outcome === "perfect" ? 1.35 : event.outcome === "near-miss" ? 1.1 : 1;
      score += Math.round(base * quality * (1 + Math.min(flow, 10) * 0.08));
      flow += event.outcome === "perfect" ? 2 : 1;
      maxFlow = Math.max(maxFlow, flow);
    } else {
      flow = 0;
    }
    score += collected * 25;
    if (usedAbility === "timeWarp") score += 200;

    if (segment.kind === "planet-gate" && successful) planetGatesPassed += 1;
    if (segment.kind === "black-hole" && successful) {
      blackHolesCleared += 1;
      if (event.outcome === "perfect") perfectSlingshots += 1;
    }
    if (segment.required) {
      if (successful) requiredCheckpointsCleared += 1;
      else {
        requiredCheckpointsFailed += 1;
        successfulRequiredBySector[segment.sector - 1] = false;
      }
    }
  });

  const sectorsCleared = successfulRequiredBySector.reduce((total, successful, index) => (
    total + (successful
      && reachedSectors.has(index + 1)
      && events.length >= Math.min(course.segments.length, (index + 1) * 5) ? 1 : 0)
  ), 0);
  const stardustPercent = course.totalStardust
    ? Math.floor((collectedStardust / course.totalStardust) * 100)
    : 100;
  const completedCourse = events.length === course.segments.length;
  const requiredCheckpoints = course.segments.filter((segment) => segment.required).length;
  const crazyComplete = course.variant === "crazy"
    && completedCourse
    && requiredCheckpointsFailed === 0
    && requiredCheckpointsCleared === requiredCheckpoints;
  const cosmosComplete = course.variant !== "crazy" && completedCourse
    && planetGatesPassed === 8
    && blackHolesCleared >= 2
    && perfectSlingshots >= 2
    && stardustPercent >= 80
    && shieldIntact;
  return {
    segmentsCompleted: events.length,
    totalSegments: course.segments.length,
    sectorsCleared,
    planetGatesPassed,
    blackHolesCleared,
    perfectSlingshots,
    collectedStardust,
    totalStardust: course.totalStardust,
    stardustPercent,
    shieldIntact,
    flow,
    maxFlow,
    score,
    completedCourse,
    cosmosComplete,
    crazyComplete,
    requiredCheckpoints,
    requiredCheckpointsCleared,
    requiredCheckpointsFailed,
    abilities
  };
}

function rebuildRun(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const dayKey = validDayKey(source.courseDayKey);
  const id = cleanIdentifier(source.id);
  if (!dayKey || !id) return null;
  const mode = canonicalMode(source.mode);
  const path = mode === "ticketed" ? canonicalPath(source.path) : "standard";
  const course = resolveCourse(dayKey, path);
  const events = [];
  let previousElapsedMs = 0;
  for (const [index, rawEvent] of (Array.isArray(source.events) ? source.events : []).slice(0, course.segments.length).entries()) {
    const event = canonicalRunEvent(rawEvent, course.segments[index], previousElapsedMs);
    if (!event) break;
    events.push(event);
    previousElapsedMs = event.elapsedMs;
  }
  const practiceBoost = mode === "practice" ? canonicalAbility(source.practiceBoost) : "";
  const startedAt = safeDate(source.startedAt, Date.parse(course.startsAt)).toISOString();
  let end = null;
  if (events.length === course.segments.length) {
    end = { reason: "finish", elapsedMs: previousElapsedMs };
  } else {
    const rawEnd = source.end && typeof source.end === "object" && !Array.isArray(source.end) ? source.end : {};
    const reason = canonicalEndReason(rawEnd.reason);
    if (reason && reason !== "finish") {
      end = {
        reason,
        elapsedMs: Math.max(previousElapsedMs, clampInteger(rawEnd.elapsedMs, 0, MAX_EVENT_ELAPSED_MS, previousElapsedMs))
      };
    }
  }
  const metrics = calculateMetrics(course, events, practiceBoost);
  const milestone = rewardMilestone(metrics, end?.reason, path);
  const rewardEligible = mode === "ticketed" && milestone !== "none" && end?.reason !== "withdraw";
  const stars = ["cosmos", "crazy"].includes(milestone)
    ? 3
    : ["nebula", "galaxy"].includes(milestone) ? 2 : milestone !== "none" ? 1 : 0;
  return {
    version: COSMOS_CIRCUIT_VERSION,
    id,
    courseId: course.id,
    courseVariant: course.variant,
    courseDayKey: course.dayKey,
    weekKey: course.weekKey,
    mode,
    path,
    practiceBoost,
    startedAt,
    status: end ? "finished" : "active",
    cursor: events.length,
    events,
    end,
    metrics,
    result: end ? {
      runId: id,
      courseId: course.id,
      weekKey: course.weekKey,
      path,
      milestone,
      tier: milestone,
      stars,
      score: metrics.score,
      rewardEligible,
      verificationRequired: rewardEligible
    } : null
  };
}

export function sanitizeCircuitRun(raw) {
  return rebuildRun(raw);
}

export function startCircuitRun({
  course: rawCourse = new Date(),
  mode: rawMode = "practice",
  path: rawPath = "standard",
  wallet: rawWallet,
  runId = "",
  practiceBoost = "",
  claims: rawClaims,
  crazyStipend: rawCrazyStipend,
  routeRank,
  at = new Date()
} = {}) {
  const mode = canonicalMode(rawMode);
  const path = mode === "ticketed" ? canonicalPath(rawPath) : "standard";
  const course = resolveCourse(rawCourse, path);
  const timestamp = safeDate(at).getTime();
  const id = cleanIdentifier(runId) || cleanIdentifier(`circuit-${course.dayKey}-${timestamp.toString(36)}`);
  let wallet = sanitizeCircuitWallet(rawWallet);
  let claims = sanitizeCircuitClaims(rawClaims);
  let consumed = 0;
  let redeemedPending = 0;
  let pendingRelease = { granted: 0, rankGranted: 0, rankIds: [], pureGranted: 0 };
  if (mode === "ticketed") {
    if (wallet.spentRunIds.includes(id)) {
      return { started: false, reason: "already_started", run: null, wallet, claims, consumed, redeemedPending, pendingRelease };
    }
    const entryPasses = path === "crazy" ? CRAZY_PATH_ENTRY_PASSES : 1;
    if (path === "crazy") {
      const eligibility = crazyPathEligibility(
        wallet,
        claims,
        rawCrazyStipend,
        course.startsAt,
        { routeRank }
      );
      if (!eligibility.eligible) {
        return { started: false, reason: eligibility.reason, run: null, wallet, claims, consumed, redeemedPending, pendingRelease };
      }
    }
    if (wallet.passes < entryPasses) {
      return { started: false, reason: "no_launch_pass", run: null, wallet, claims, consumed, redeemedPending, pendingRelease };
    }
    wallet.passes -= entryPasses;
    consumed = entryPasses;
    wallet.spentRunIds = [...wallet.spentRunIds, id].slice(-MAX_SPENT_RUN_IDS);
    if (path === "crazy") {
      claims.crazyAttemptWeekKeys = [...claims.crazyAttemptWeekKeys, course.weekKey]
        .slice(-MAX_CRAZY_ATTEMPT_WEEK_KEYS);
    }
    const released = claimPendingLaunchPasses(wallet);
    wallet = released.wallet;
    redeemedPending = released.granted;
    pendingRelease = {
      granted: released.granted,
      rankGranted: released.rankGranted,
      rankIds: released.rankIds,
      pureGranted: released.pureGranted
    };
  }
  const run = rebuildRun({
    version: COSMOS_CIRCUIT_VERSION,
    id,
    courseDayKey: course.dayKey,
    mode,
    path,
    practiceBoost: mode === "practice" ? canonicalAbility(practiceBoost) : "",
    startedAt: safeDate(at).toISOString(),
    events: []
  });
  return { started: true, reason: "started", run, wallet, claims, consumed, redeemedPending, pendingRelease };
}

export function advanceCircuitRun(rawRun, rawEvent = {}) {
  const run = rebuildRun(rawRun);
  if (!run) return { advanced: false, reason: "invalid_run", run: null, segment: null, complete: false };
  if (run.status !== "active") return { advanced: false, reason: "run_finished", run, segment: null, complete: true };
  const course = resolveCourse(run.courseDayKey, run.path);
  const segment = course.segments[run.cursor];
  const event = canonicalRunEvent(rawEvent, segment, run.events.at(-1)?.elapsedMs || 0);
  if (!event) return { advanced: false, reason: "unexpected_segment", run, segment: { ...segment }, complete: false };
  const nextRun = rebuildRun({ ...run, events: [...run.events, event] });
  return {
    advanced: true,
    reason: nextRun.status === "finished" ? "course_complete" : "segment_complete",
    run: nextRun,
    segment: { ...segment },
    complete: nextRun.status === "finished"
  };
}

export function finishCircuitRun(rawRun, {
  reason = "withdraw",
  elapsedMs
} = {}) {
  const run = rebuildRun(rawRun);
  if (!run) return { finished: false, reason: "invalid_run", run: null, result: null };
  if (run.status === "finished") return { finished: true, reason: "already_finished", run, result: run.result };
  const endReason = canonicalEndReason(reason);
  if (!endReason || endReason === "finish") {
    return { finished: false, reason: "course_incomplete", run, result: null };
  }
  const previousElapsedMs = run.events.at(-1)?.elapsedMs || 0;
  const nextRun = rebuildRun({
    ...run,
    end: {
      reason: endReason,
      elapsedMs: Math.max(previousElapsedMs, clampInteger(elapsedMs, 0, MAX_EVENT_ELAPSED_MS, previousElapsedMs))
    }
  });
  return { finished: true, reason: endReason, run: nextRun, result: nextRun.result };
}

export function sanitizeCircuitClaims(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const cosmosWeekKeys = [];
  const seenWeeks = new Set();
  for (const value of Array.isArray(source.cosmosWeekKeys) ? source.cosmosWeekKeys.slice(-MAX_COSMOS_WEEK_KEYS * 2) : []) {
    const key = validWeekKey(value);
    if (!key || seenWeeks.has(key)) continue;
    seenWeeks.add(key);
    cosmosWeekKeys.push(key);
  }
  return {
    version: COSMOS_CIRCUIT_VERSION,
    claimedRunIds: uniqueIdentifiers(source.claimedRunIds, MAX_CIRCUIT_CLAIMS),
    cosmosWeekKeys: cosmosWeekKeys.slice(-MAX_COSMOS_WEEK_KEYS),
    crazyAttemptWeekKeys: [...new Set((Array.isArray(source.crazyAttemptWeekKeys)
      ? source.crazyAttemptWeekKeys
      : [])
      .map(validWeekKey)
      .filter(Boolean))]
      .slice(-MAX_CRAZY_ATTEMPT_WEEK_KEYS),
    crazyCooldownUntilDay: validDayKey(source.crazyCooldownUntilDay)
  };
}

function addUtcDays(dayKey, days) {
  const start = Date.parse(`${dayKey}T00:00:00.000Z`);
  return Number.isFinite(start)
    ? new Date(start + clampInteger(days, 0, 10_000, 0) * DAY_MS).toISOString().slice(0, 10)
    : "";
}

function emptyCrazyStipend() {
  return {
    version: COSMOS_CIRCUIT_VERSION,
    runId: "",
    startDay: "",
    endDay: "",
    creditedDays: 0,
    totalDays: CRAZY_PATH_DAILY_DAYS,
    complete: false
  };
}

export function sanitizeCrazyPathStipend(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const runId = cleanIdentifier(source.runId);
  const startDay = validDayKey(source.startDay);
  if (!runId || !startDay) return emptyCrazyStipend();
  const endDay = addUtcDays(startDay, CRAZY_PATH_DAILY_DAYS - 1);
  const creditedDays = clampInteger(source.creditedDays, 0, CRAZY_PATH_DAILY_DAYS, 0);
  return {
    version: COSMOS_CIRCUIT_VERSION,
    runId,
    startDay,
    endDay,
    creditedDays,
    totalDays: CRAZY_PATH_DAILY_DAYS,
    complete: creditedDays >= CRAZY_PATH_DAILY_DAYS
  };
}

export function grantCrazyPathDailyPowers(rawStipend, at = new Date()) {
  const stipend = sanitizeCrazyPathStipend(rawStipend);
  const boosts = Object.fromEntries(CIRCUIT_BOOSTS.map((boost) => [boost, 0]));
  if (!stipend.runId) return { stipend, boosts, grantedDays: 0, each: 0, reason: "inactive" };
  const dayKey = dayKeyFor(at);
  if (dayKey < stipend.startDay) {
    return { stipend, boosts, grantedDays: 0, each: 0, reason: "clock_before_start" };
  }
  const effectiveDay = dayKey > stipend.endDay ? stipend.endDay : dayKey;
  const availableDays = clampInteger(
    Math.floor((Date.parse(`${effectiveDay}T00:00:00.000Z`) - Date.parse(`${stipend.startDay}T00:00:00.000Z`)) / DAY_MS) + 1,
    0,
    CRAZY_PATH_DAILY_DAYS,
    0
  );
  const grantedDays = Math.max(0, availableDays - stipend.creditedDays);
  if (!grantedDays) {
    return {
      stipend,
      boosts,
      grantedDays: 0,
      each: 0,
      reason: stipend.complete ? "complete" : "already_credited"
    };
  }
  const each = grantedDays * CRAZY_PATH_DAILY_POWERS;
  const next = sanitizeCrazyPathStipend({ ...stipend, creditedDays: availableDays });
  for (const boost of CIRCUIT_BOOSTS) boosts[boost] = each;
  return {
    stipend: next,
    boosts,
    grantedDays,
    each,
    reason: grantedDays > 1 ? "accrued_grant" : "daily_grant"
  };
}

const ROUTE_RANK_IDS = Object.freeze([
  "bronze",
  "silver",
  "gold",
  "diamond",
  "emerald",
  "sapphire",
  "ruby",
  "master",
  "grandmaster",
  "mythic",
  "legend",
  "cosmic"
]);

export function crazyPathRankEligibility(rawRank) {
  const supplied = rawRank !== undefined && rawRank !== null && rawRank !== "";
  const validNumber = (value) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= ROUTE_RANK_IDS.length ? number : 0;
  };
  let number = 0;
  if (typeof rawRank === "number" || (typeof rawRank === "string" && /^\d{1,2}$/.test(rawRank.trim()))) {
    number = validNumber(rawRank);
  } else {
    const outer = rawRank && typeof rawRank === "object" && !Array.isArray(rawRank) ? rawRank : {};
    const source = outer.rank && typeof outer.rank === "object" && !Array.isArray(outer.rank)
      ? outer.rank
      : outer;
    const explicitNumber = source.number ?? source.rankNumber;
    if (explicitNumber != null) number = validNumber(explicitNumber);
    else if (source.index != null) number = validNumber(Number(source.index) + 1);
    else {
      const id = cleanIdentifier(source.id ?? source.rankId ?? rawRank, 24);
      number = ROUTE_RANK_IDS.indexOf(id) + 1;
    }
  }
  return {
    supplied,
    qualified: !supplied || number >= CRAZY_PATH_MIN_ROUTE_RANK,
    number,
    id: number ? ROUTE_RANK_IDS[number - 1] : "",
    minimumNumber: CRAZY_PATH_MIN_ROUTE_RANK,
    minimumId: ROUTE_RANK_IDS[CRAZY_PATH_MIN_ROUTE_RANK - 1]
  };
}

export function crazyPathRewardOptions() {
  return [
    {
      id: "instant",
      delivery: "immediate",
      eachPerGrant: CRAZY_PATH_INSTANT_POWERS,
      grantDays: 1,
      totalPerBoost: CRAZY_PATH_INSTANT_POWERS,
      totalPowers: CRAZY_PATH_INSTANT_POWERS * CIRCUIT_BOOSTS.length,
      tradeoff: "smaller-total-immediate-access"
    },
    {
      id: "daily",
      delivery: "utc-daily",
      eachPerGrant: CRAZY_PATH_DAILY_POWERS,
      grantDays: CRAZY_PATH_DAILY_DAYS,
      totalPerBoost: CRAZY_PATH_DAILY_POWERS * CRAZY_PATH_DAILY_DAYS,
      totalPowers: CRAZY_PATH_DAILY_POWERS * CRAZY_PATH_DAILY_DAYS * CIRCUIT_BOOSTS.length,
      tradeoff: "larger-total-delayed-access"
    }
  ];
}

export function crazyPathEligibility(
  rawWallet,
  rawClaims,
  rawStipend,
  at = new Date(),
  { routeRank } = {}
) {
  const wallet = sanitizeCircuitWallet(rawWallet);
  const claims = sanitizeCircuitClaims(rawClaims);
  const stipend = sanitizeCrazyPathStipend(rawStipend);
  const rank = crazyPathRankEligibility(routeRank);
  const dayKey = dayKeyFor(at);
  const week = cosmosCircuitWeek(at);
  const qualified = claims.cosmosWeekKeys.includes(week.weekKey);
  const attempted = claims.crazyAttemptWeekKeys.includes(week.weekKey);
  const coolingDown = Boolean(claims.crazyCooldownUntilDay && dayKey < claims.crazyCooldownUntilDay);
  let reason = "ready";
  if (coolingDown) reason = "victory_cooldown";
  else if (attempted) reason = "weekly_attempt_used";
  else if (!rank.qualified) reason = "route_rank_required";
  else if (!qualified) reason = "cosmos_qualification_required";
  else if (wallet.passes < CRAZY_PATH_ENTRY_PASSES) reason = "launch_passes_required";
  return {
    eligible: reason === "ready",
    reason,
    dayKey,
    weekKey: week.weekKey,
    resetsAt: week.endsAt,
    qualified,
    attempted,
    coolingDown,
    cooldownUntilDay: claims.crazyCooldownUntilDay,
    entryPasses: CRAZY_PATH_ENTRY_PASSES,
    passes: wallet.passes,
    passesNeeded: Math.max(0, CRAZY_PATH_ENTRY_PASSES - wallet.passes),
    rank,
    stipend
  };
}

function boostGrant(tier, chosenBoost) {
  const reward = REWARD_LADDER[tier] || REWARD_LADDER.none;
  const boosts = Object.fromEntries(CIRCUIT_BOOSTS.map((boost) => [boost, reward.each]));
  if (reward.chosen) boosts[chosenBoost] = reward.chosen;
  return {
    tier,
    boosts,
    starPathXp: reward.starPathXp,
    cosmeticMasteryXp: reward.cosmeticMasteryXp
  };
}

export function circuitRewardPreview(milestone, rawClaims = {}, { weekKey = "", at = new Date() } = {}) {
  const claims = sanitizeCircuitClaims(rawClaims);
  const requestedTier = Object.hasOwn(REWARD_LADDER, milestone) ? milestone : "none";
  const validRunWeek = validWeekKey(weekKey) || cosmosCircuitWeek(at).weekKey;
  const firstCosmosOfWeek = requestedTier === "cosmos"
    && Boolean(validRunWeek)
    && !claims.cosmosWeekKeys.includes(validRunWeek);
  const effectiveTier = requestedTier === "cosmos" && !firstCosmosOfWeek
    ? "galaxy"
    : requestedTier;
  return {
    milestone: requestedTier,
    tier: effectiveTier,
    firstCosmosOfWeek,
    repeatAdjusted: requestedTier === "cosmos" && effectiveTier !== "cosmos",
    disclosureKey: requestedTier === "cosmos"
      ? firstCosmosOfWeek
        ? "circuit.reward.cosmos.first"
        : "circuit.reward.cosmos.repeat"
      : `circuit.reward.${effectiveTier}`,
    reward: { ...REWARD_LADDER[effectiveTier] }
  };
}

export function effectiveCircuitRewardTier(milestone, rawClaims = {}, options = {}) {
  return circuitRewardPreview(milestone, rawClaims, options).tier;
}

export function claimCircuitReward(rawClaims, rawRun, {
  chosenBoost = "",
  chosenPowerup = "",
  crazyRewardChoice = "",
  verified = false,
  at = new Date()
} = {}) {
  const claims = sanitizeCircuitClaims(rawClaims);
  const run = rebuildRun(rawRun);
  if (!run?.result?.rewardEligible) return { claimed: false, reason: "reward_ineligible", claims, grant: null };
  if (verified !== true) return { claimed: false, reason: "verification_required", claims, grant: null };
  if (claims.claimedRunIds.includes(run.id)) return { claimed: false, reason: "already_claimed", claims, grant: null };
  const milestone = run.result.milestone;
  if (run.path === "crazy") {
    const choice = CRAZY_PATH_REWARD_CHOICES.includes(crazyRewardChoice) ? crazyRewardChoice : "";
    if (!choice) return { claimed: false, reason: "choose_crazy_reward", claims, grant: null };
    const dayKey = dayKeyFor(at);
    claims.claimedRunIds = [...claims.claimedRunIds, run.id].slice(-MAX_CIRCUIT_CLAIMS);
    claims.crazyCooldownUntilDay = addUtcDays(dayKey, CRAZY_PATH_VICTORY_COOLDOWN_DAYS);
    const boosts = Object.fromEntries(CIRCUIT_BOOSTS.map((boost) => [
      boost,
      choice === "instant" ? CRAZY_PATH_INSTANT_POWERS : 0
    ]));
    const stipend = choice === "daily"
      ? sanitizeCrazyPathStipend({ runId: run.id, startDay: dayKey, creditedDays: 0 })
      : emptyCrazyStipend();
    return {
      claimed: true,
      reason: "claimed",
      claims,
      grant: {
        runId: run.id,
        milestone: "crazy",
        tier: "crazy",
        firstCosmosOfWeek: false,
        crazyRewardChoice: choice,
        boosts,
        stipend,
        totalPerBoost: choice === "instant"
          ? CRAZY_PATH_INSTANT_POWERS
          : CRAZY_PATH_DAILY_POWERS * CRAZY_PATH_DAILY_DAYS,
        starPathXp: 0,
        cosmeticMasteryXp: 0
      }
    };
  }
  const requestedBoost = chosenBoost || chosenPowerup;
  const chosen = CIRCUIT_BOOSTS.includes(requestedBoost) ? requestedBoost : "";
  if (["drift", "orbit"].includes(milestone) && !chosen) {
    return { claimed: false, reason: "choose_powerup", claims, grant: null };
  }
  const preview = circuitRewardPreview(milestone, claims, { weekKey: run.weekKey });
  const { firstCosmosOfWeek } = preview;
  const rewardTier = preview.tier;
  claims.claimedRunIds = [...claims.claimedRunIds, run.id].slice(-MAX_CIRCUIT_CLAIMS);
  if (firstCosmosOfWeek) claims.cosmosWeekKeys = [...claims.cosmosWeekKeys, run.weekKey].slice(-MAX_COSMOS_WEEK_KEYS);
  const grant = {
    runId: run.id,
    milestone,
    firstCosmosOfWeek,
    repeatAdjusted: preview.repeatAdjusted,
    disclosureKey: preview.disclosureKey,
    ...boostGrant(rewardTier, chosen)
  };
  return { claimed: true, reason: "claimed", claims, grant };
}

function snapshotPayload(run) {
  return {
    version: COSMOS_CIRCUIT_VERSION,
    courseDayKey: run.courseDayKey,
    run: {
      id: run.id,
      courseDayKey: run.courseDayKey,
      mode: run.mode,
      path: run.path,
      practiceBoost: run.practiceBoost,
      startedAt: run.startedAt,
      events: run.events.map((event) => ({
        ...event,
        samples: event.samples.map((sample) => ({ ...sample }))
      })),
      end: run.end ? { ...run.end } : null
    }
  };
}

function snapshotChecksum(payload) {
  return `fnv1a-${hash32(JSON.stringify(payload)).toString(16).padStart(8, "0")}`;
}

export function createCircuitSnapshot(rawRun, at = new Date()) {
  const run = rebuildRun(rawRun);
  if (!run) return null;
  const payload = snapshotPayload(run);
  return {
    ...payload,
    savedAt: safeDate(at).toISOString(),
    checksum: snapshotChecksum(payload)
  };
}

export function sanitizeCircuitSnapshot(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const outerDayKey = validDayKey(source.courseDayKey);
  const innerDayKey = validDayKey(source.run?.courseDayKey);
  if (!outerDayKey || !innerDayKey || outerDayKey !== innerDayKey) {
    return {
      version: COSMOS_CIRCUIT_VERSION,
      courseDayKey: "",
      savedAt: "",
      checksum: "",
      checksumValid: false,
      recovered: false,
      resumable: false,
      run: null
    };
  }
  const run = rebuildRun(source.run);
  if (!run) {
    return {
      version: COSMOS_CIRCUIT_VERSION,
      courseDayKey: "",
      savedAt: "",
      checksum: "",
      checksumValid: false,
      recovered: false,
      resumable: false,
      run: null
    };
  }
  const canonical = createCircuitSnapshot(run, source.savedAt);
  const suppliedChecksum = typeof source.checksum === "string" ? source.checksum.slice(0, 32) : "";
  const checksumValid = suppliedChecksum === canonical.checksum;
  return {
    ...canonical,
    checksumValid,
    recovered: Boolean(suppliedChecksum && !checksumValid),
    resumable: run.status === "active",
    run
  };
}

export function resumeCircuitRun(rawSnapshot) {
  const snapshot = sanitizeCircuitSnapshot(rawSnapshot);
  if (!snapshot.run) return { resumed: false, reason: "invalid_snapshot", run: null, snapshot };
  if (!snapshot.resumable) return { resumed: false, reason: "run_finished", run: snapshot.run, snapshot };
  return {
    resumed: true,
    reason: snapshot.recovered ? "snapshot_recovered" : "resumed",
    run: snapshot.run,
    snapshot
  };
}
