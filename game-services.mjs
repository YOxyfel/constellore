import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const MARKET_CATALOG = Object.freeze([
  { id: "moon", word: "Moon", emoji: "🌙", category: "nature", usefulness: 5, basePrice: 180, reason: "Strong links to tides, night, eclipses, and space." },
  { id: "magic", word: "Magic", emoji: "✨", category: "force", usefulness: 5, basePrice: 195, reason: "A versatile force with many legendary outcomes." },
  { id: "time", word: "Time", emoji: "⌛", category: "force", usefulness: 5, basePrice: 205, reason: "Connects natural change, history, and the future." },
  { id: "human", word: "Human", emoji: "🧑", category: "life", usefulness: 5, basePrice: 190, reason: "Bridges life into culture, work, and civilization." },
  { id: "computer", word: "Computer", emoji: "💻", category: "structure", usefulness: 4, basePrice: 155, reason: "Unlocks technology, networks, hardware, and AI." },
  { id: "love", word: "Love", emoji: "❤️", category: "force", usefulness: 4, basePrice: 145, reason: "Creates emotional, social, and poetic concepts." },
  { id: "music", word: "Music", emoji: "🎵", category: "force", usefulness: 4, basePrice: 140, reason: "Links air, rhythm, culture, and performance." },
  { id: "robot", word: "Robot", emoji: "🤖", category: "structure", usefulness: 4, basePrice: 150, reason: "A direct bridge to machines and automation." },
  { id: "sword", word: "Sword", emoji: "⚔️", category: "structure", usefulness: 3, basePrice: 115, reason: "Useful for metal, legends, tools, and conflict." },
  { id: "dream", word: "Dream", emoji: "💭", category: "force", usefulness: 3, basePrice: 110, reason: "Connects sleep, imagination, and ambition." },
  { id: "gravity", word: "Gravity", emoji: "🪐", category: "force", usefulness: 4, basePrice: 160, reason: "Pulls together space, motion, weight, and orbit." },
  { id: "ocean", word: "Ocean", emoji: "🌊", category: "nature", usefulness: 3, basePrice: 105, reason: "A shortcut into weather, life, and geography." },
  { id: "sun", word: "Sun", emoji: "☀️", category: "force", usefulness: 5, basePrice: 185, reason: "Radiates into daylight, seasons, warmth, and space." },
  { id: "space", word: "Space", emoji: "🌌", category: "nature", usefulness: 5, basePrice: 180, reason: "Opens cosmic routes through planets, stars, and exploration." },
  { id: "planet", word: "Planet", emoji: "🪐", category: "nature", usefulness: 4, basePrice: 155, reason: "Connects worlds, atmospheres, oceans, and solar systems." },
  { id: "storm", word: "Storm", emoji: "⛈️", category: "force", usefulness: 4, basePrice: 145, reason: "A powerful weather bridge to wind, rain, and lightning." },
  { id: "metal", word: "Metal", emoji: "🔩", category: "structure", usefulness: 5, basePrice: 175, reason: "Builds tools, machines, alloys, and modern infrastructure." },
  { id: "electricity", word: "Electricity", emoji: "⚡", category: "force", usefulness: 5, basePrice: 190, reason: "Energizes technology, weather, light, and machines." },
  { id: "animal", word: "Animal", emoji: "🐾", category: "life", usefulness: 5, basePrice: 180, reason: "Branches naturally into habitats, species, and mythology." },
  { id: "dragon", word: "Dragon", emoji: "🐉", category: "life", usefulness: 4, basePrice: 155, reason: "A legendary creature with elemental and story-rich links." },
  { id: "flower", word: "Flower", emoji: "🌸", category: "life", usefulness: 3, basePrice: 105, reason: "Connects gardens, seasons, color, and living ecosystems." },
  { id: "cat", word: "Cat", emoji: "🐈", category: "life", usefulness: 4, basePrice: 135, reason: "A familiar animal with wild, domestic, and playful routes." },
  { id: "dog", word: "Dog", emoji: "🐕", category: "life", usefulness: 4, basePrice: 135, reason: "Links companionship, packs, work, and wordplay." },
  { id: "insect", word: "Insect", emoji: "🐞", category: "life", usefulness: 3, basePrice: 100, reason: "Unlocks pollination, swarms, metamorphosis, and tiny life." },
  { id: "book", word: "Book", emoji: "📘", category: "structure", usefulness: 4, basePrice: 145, reason: "Leads into knowledge, stories, maps, and libraries." },
  { id: "art", word: "Art", emoji: "🎨", category: "structure", usefulness: 4, basePrice: 140, reason: "Combines materials and ideas into creative forms." },
  { id: "science", word: "Science", emoji: "🔬", category: "structure", usefulness: 5, basePrice: 185, reason: "A broad path into nature, research, and discovery." },
  { id: "technology", word: "Technology", emoji: "🖥️", category: "structure", usefulness: 5, basePrice: 200, reason: "Connects invention, transport, power, and communication." },
  { id: "money", word: "Money", emoji: "🪙", category: "structure", usefulness: 4, basePrice: 150, reason: "Creates economic, social, and playful combinations." },
  { id: "food", word: "Food", emoji: "🍲", category: "structure", usefulness: 5, basePrice: 170, reason: "A flexible route through nature, cooking, and culture." },
  { id: "vehicle", word: "Vehicle", emoji: "🚗", category: "structure", usefulness: 4, basePrice: 145, reason: "Adapts naturally to land, sea, air, and engines." },
  { id: "ship", word: "Ship", emoji: "🚢", category: "structure", usefulness: 3, basePrice: 120, reason: "Travels through water, air, trade, and exploration." },
  { id: "castle", word: "Castle", emoji: "🏰", category: "structure", usefulness: 3, basePrice: 115, reason: "Builds toward defenses, kingdoms, ruins, and legends." },
  { id: "phone", word: "Phone", emoji: "📱", category: "structure", usefulness: 4, basePrice: 150, reason: "Connects signals, networks, communication, and devices." },
  { id: "night", word: "Night", emoji: "🌙", category: "nature", usefulness: 4, basePrice: 140, reason: "Links darkness, stars, dreams, and nocturnal life." },
  { id: "river", word: "River", emoji: "🏞️", category: "nature", usefulness: 4, basePrice: 130, reason: "Flows into terrain, weather, travel, and ecosystems." }
]);

const catalogById = new Map(MARKET_CATALOG.map((item) => [item.id, item]));
const adjectives = ["Amber", "Astral", "Bright", "Cinder", "Cosmic", "Distant", "Echo", "Frost", "Golden", "Hidden", "Ivory", "Lunar", "Neon", "Quiet", "Solar", "Velvet"];
const nouns = ["Comet", "Drifter", "Ember", "Harbor", "Meteor", "Moon", "Nova", "Orbit", "Pioneer", "Raven", "Signal", "Sparrow", "Star", "Voyager", "Willow", "Wisp"];
const INTEREST_CAMPAIGN = "web-release";
const INTEREST_SOURCES = new Set(["github-pages", "website", "local-practice", "game", "direct"]);
const INTEREST_ACTIONS = new Set(["add", "remove"]);
const anonymousInterestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emptyInterestData() {
  return { version: 1, records: {}, totals: {}, updatedAt: null };
}

function normalizeInterestData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyInterestData();
  return {
    version: 1,
    records: value.records && typeof value.records === "object" && !Array.isArray(value.records) ? value.records : {},
    totals: value.totals && typeof value.totals === "object" && !Array.isArray(value.totals) ? value.totals : {},
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null
  };
}

function emptyInterestTotals() {
  return { active: 0, total: 0, additions: 0, removals: 0, reactivations: 0, sources: {} };
}

function normalizeInterestTotals(value) {
  const totals = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sources = totals.sources && typeof totals.sources === "object" && !Array.isArray(totals.sources) ? totals.sources : {};
  return {
    active: Math.max(0, Number(totals.active) || 0),
    total: Math.max(0, Number(totals.total) || 0),
    additions: Math.max(0, Number(totals.additions) || 0),
    removals: Math.max(0, Number(totals.removals) || 0),
    reactivations: Math.max(0, Number(totals.reactivations) || 0),
    sources: Object.fromEntries(Object.entries(sources)
      .filter(([source]) => INTEREST_SOURCES.has(source))
      .map(([source, count]) => [source, Math.max(0, Number(count) || 0)]))
  };
}

function hashNumber(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundToFive(value) {
  return Math.max(5, Math.round(value / 5) * 5);
}

export function callsignFor(playerId) {
  const hash = hashNumber(playerId);
  const compactId = String(playerId).replace(/[^a-z0-9]/gi, "");
  const discriminator = (compactId || hash.toString(36)).slice(-8).toUpperCase().padStart(8, "0");
  return `${adjectives[hash % adjectives.length]} ${nouns[(hash >>> 8) % nouns.length]} ${discriminator}`;
}

export function marketPrice(wordOrId, minute = Math.floor(Date.now() / 60_000), demand = 0) {
  const item = typeof wordOrId === "string" ? catalogById.get(wordOrId) : wordOrId;
  if (!item) return null;
  const phaseA = hashNumber(`${item.id}:a`) % 1000;
  const phaseB = hashNumber(`${item.id}:b`) % 1000;
  const wave = Math.sin((minute + phaseA) / 11) * .09 + Math.sin((minute + phaseB) / 5) * .035;
  const demandLift = clamp(Number(demand) || 0, 0, 1) * .06;
  const roundedPrice = roundToFive(item.basePrice * clamp(1 + wave + demandLift, .8, 1.2));
  const minimumPrice = Math.ceil(item.basePrice * .8 / 5) * 5;
  const maximumPrice = Math.floor(item.basePrice * 1.2 / 5) * 5;
  return clamp(roundedPrice, minimumPrice, maximumPrice);
}

export function marketTrend(item, minute, demand, length = 12) {
  return Array.from({ length }, (_, index) => marketPrice(item, minute - (length - index - 1), demand));
}

export function calculateStarscore({ game, moves, elapsedSeconds, assisted = false }) {
  const tier = clamp(Number(game?.tier) || 1, 1, 5);
  const parMoves = 3 + tier * 3;
  const base = 100_000 + tier * 5_000;
  const movePenalty = Math.max(0, Number(moves) - parMoves) * 5_000;
  const timePenalty = Math.max(0, Number(elapsedSeconds)) * 25;
  const assistPenalty = assisted ? 7_500 : 0;
  return Math.max(1, Math.round(base - movePenalty - timePenalty - assistPenalty));
}

export function compareEntries(left, right) {
  if (right.score !== left.score) return right.score - left.score;
  if (left.moves !== right.moves) return left.moves - right.moves;
  return left.elapsedMs - right.elapsedMs;
}

function betterEntry(next, current) {
  return !current || compareEntries(next, current) < 0;
}

export class GameStore {
  constructor(path = ":memory:") {
    this.path = path;
    this.data = { version: 3, secret: "", players: {}, scores: [], demand: {}, interest: emptyInterestData() };
    this.writeQueue = Promise.resolve();
  }

  async init() {
    if (this.path !== ":memory:") {
      try {
        const parsed = JSON.parse(await readFile(this.path, "utf8"));
        if (parsed && typeof parsed === "object") this.data = {
          ...this.data,
          ...parsed,
          version: 3,
          players: parsed.players || {},
          scores: parsed.scores || [],
          demand: parsed.demand || {},
          interest: normalizeInterestData(parsed.interest)
        };
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    if (!this.data.secret) {
      this.data.secret = randomBytes(32).toString("base64url");
      await this.persist();
    }
    let playersMigrated = false;
    for (const player of Object.values(this.data.players)) {
      if (!player.callsign || /^[A-Za-z]+ [A-Za-z]+ \d{2}$/.test(player.callsign)) {
        player.callsign = callsignFor(player.id);
        playersMigrated = true;
      }
      if (!player.forfeitedChallenges || typeof player.forfeitedChallenges !== "object") {
        player.forfeitedChallenges = {};
        playersMigrated = true;
      }
    }
    if (playersMigrated) await this.persist();
    return this;
  }

  sign(value) {
    return createHmac("sha256", this.data.secret).update(String(value)).digest("base64url");
  }

  verify(value, signature) {
    if (typeof signature !== "string") return false;
    const expected = Buffer.from(this.sign(value));
    const received = Buffer.from(signature);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  async registerPlayer() {
    const id = randomUUID();
    this.data.players[id] = {
      id,
      callsign: callsignFor(id),
      credits: 300,
      licenses: {},
      founderPass: false,
      freeWishUsed: false,
      dailyWishUsedDate: "",
      earned: { date: "", amount: 0 },
      rewardedChallenges: {},
      forfeitedChallenges: {},
      weeklyActivity: { week: "", days: [], bonusClaimed: false },
      createdAt: new Date().toISOString()
    };
    await this.persist();
    return this.publicPlayer(id);
  }

  authenticate(playerId, playerToken) {
    const player = this.data.players[playerId];
    if (!player || !this.verify(`player:${playerId}`, playerToken)) return null;
    return player;
  }

  tokenForPlayer(playerId) {
    return this.sign(`player:${playerId}`);
  }

  publicPlayer(playerId) {
    const player = this.data.players[playerId];
    if (!player) return null;
    return {
      id: player.id,
      callsign: player.callsign,
      credits: player.credits,
      founderPass: Boolean(player.founderPass),
      freeWishUsed: Boolean(player.freeWishUsed),
      wishAvailable: this.canUseWish(playerId),
      dailyWishUsedDate: player.dailyWishUsedDate || "",
      vault: MARKET_CATALOG.filter((item) => player.licenses[item.id]).map((item) => ({ ...item, owned: true }))
    };
  }

  interestAggregate(campaign = INTEREST_CAMPAIGN) {
    if (campaign !== INTEREST_CAMPAIGN) throw serviceError(400, "That interest campaign is not available.", "invalid_interest_campaign");
    const totals = normalizeInterestTotals(this.data.interest.totals[campaign]);
    return {
      campaign,
      ...totals,
      sources: { ...totals.sources },
      updatedAt: this.data.interest.updatedAt || null
    };
  }

  async recordInterest({ anonymousId, campaign, source, action }, date = new Date()) {
    if (!anonymousInterestIdPattern.test(String(anonymousId || ""))) throw serviceError(400, "A valid anonymous interest ID is required.", "invalid_interest_id");
    if (campaign !== INTEREST_CAMPAIGN) throw serviceError(400, "That interest campaign is not available.", "invalid_interest_campaign");
    if (!INTEREST_SOURCES.has(source)) throw serviceError(400, "That interest source is not available.", "invalid_interest_source");
    if (!INTEREST_ACTIONS.has(action)) throw serviceError(400, "That interest action is not available.", "invalid_interest_action");
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw serviceError(400, "A valid interest date is required.", "invalid_interest_date");

    const day = date.toISOString().slice(0, 10);
    const digest = this.sign(`interest:v1:${campaign}:${anonymousId}`);
    const recordKey = `${campaign}:${digest}`;
    const records = this.data.interest.records;
    const existing = records[recordKey];
    const totals = normalizeInterestTotals(this.data.interest.totals[campaign]);
    this.data.interest.totals[campaign] = totals;
    let changed = false;
    let interested = Boolean(existing?.active);

    if (action === "add" && !existing) {
      records[recordKey] = { campaign, active: true, firstDate: day, lastChangedDate: day, firstSource: source };
      totals.active += 1;
      totals.total += 1;
      totals.additions += 1;
      totals.sources[source] = (totals.sources[source] || 0) + 1;
      changed = true;
      interested = true;
    } else if (action === "add" && !existing.active) {
      existing.active = true;
      existing.lastChangedDate = day;
      totals.active += 1;
      totals.additions += 1;
      totals.reactivations += 1;
      changed = true;
      interested = true;
    } else if (action === "remove" && existing?.active) {
      existing.active = false;
      existing.lastChangedDate = day;
      totals.active = Math.max(0, totals.active - 1);
      totals.removals += 1;
      changed = true;
      interested = false;
    }

    if (changed) {
      this.data.interest.updatedAt = day;
      await this.persist();
    }
    return { campaign, interested, changed };
  }

  demandForMinute(wordId, minute) {
    const demand = this.data.demand[wordId] || { ema: 0, purchases: 0, activeMinute: minute, purchasesThisMinute: 0 };
    demand.ema = clamp(Number(demand.ema) || 0, 0, 1);
    demand.purchases = Math.max(0, Number(demand.purchases) || 0);
    if (!Number.isInteger(demand.activeMinute)) demand.activeMinute = minute;
    demand.purchasesThisMinute = Math.max(0, Number(demand.purchasesThisMinute) || 0);

    if (minute > demand.activeMinute) {
      const completedMinutePurchases = Math.min(20, Math.floor(demand.purchasesThisMinute));
      for (let index = 0; index < completedMinutePurchases; index += 1) demand.ema = demand.ema * .82 + .18;
      const idleMinutes = Math.max(0, minute - demand.activeMinute - 1);
      if (idleMinutes) demand.ema *= .82 ** idleMinutes;
      demand.ema = clamp(demand.ema, 0, 1);
      demand.activeMinute = minute;
      demand.purchasesThisMinute = 0;
    }

    this.data.demand[wordId] = demand;
    return demand;
  }

  marketSnapshot(playerId, now = Date.now()) {
    const player = this.data.players[playerId];
    const minute = Math.floor(now / 60_000);
    const nextRepriceAt = (minute + 1) * 60_000;
    const items = MARKET_CATALOG.map((item) => {
      const demand = this.demandForMinute(item.id, minute).ema;
      const trend = marketTrend(item, minute, demand);
      const price = trend.at(-1);
      const previous = trend.at(-2) || price;
      const quotePayload = `${item.id}:${minute}:${price}`;
      return {
        ...item,
        price,
        owned: Boolean(player?.licenses[item.id]),
        changePercent: previous ? Number((((price - previous) / previous) * 100).toFixed(1)) : 0,
        trend,
        quoteId: `${quotePayload}.${this.sign(`quote:${quotePayload}`)}`,
        quoteExpiresAt: new Date(nextRepriceAt).toISOString()
      };
    });
    return { serverTime: new Date(now).toISOString(), nextRepriceAt: new Date(nextRepriceAt).toISOString(), balance: player?.credits || 0, items };
  }

  verifyQuote(quoteId, now = Date.now()) {
    if (typeof quoteId !== "string") return null;
    const split = quoteId.lastIndexOf(".");
    if (split < 1) return null;
    const payload = quoteId.slice(0, split);
    const signature = quoteId.slice(split + 1);
    if (!this.verify(`quote:${payload}`, signature)) return null;
    const [wordId, minuteText, priceText] = payload.split(":");
    const minute = Number(minuteText);
    const price = Number(priceText);
    if (!catalogById.has(wordId) || !Number.isInteger(minute) || !Number.isFinite(price) || minute !== Math.floor(now / 60_000)) return null;
    const demand = this.demandForMinute(wordId, minute).ema;
    if (marketPrice(wordId, minute, demand) !== price) return null;
    return { item: catalogById.get(wordId), minute, price };
  }

  async buyLicense(playerId, quoteId, idempotencyKey) {
    const player = this.data.players[playerId];
    if (!player) throw serviceError(401, "Player not found.", "player_missing");
    if (!/^[\w-]{8,80}$/.test(String(idempotencyKey || ""))) throw serviceError(400, "A valid purchase key is required.", "invalid_idempotency_key");
    player.purchaseKeys ||= {};
    if (player.purchaseKeys[idempotencyKey]) {
      const previous = player.purchaseKeys[idempotencyKey];
      if (previous.quoteId && previous.quoteId !== quoteId) throw serviceError(409, "That purchase key was already used for another quote.", "idempotency_conflict");
      return previous.result || previous;
    }
    const quote = this.verifyQuote(quoteId);
    if (!quote) throw serviceError(409, "That quote expired. The current price is now shown.", "quote_expired");
    if (player.licenses[quote.item.id]) throw serviceError(409, "You already own this word.", "already_owned");
    if (player.credits < quote.price) throw serviceError(402, "Not enough Star Credits.", "insufficient_credits");
    player.credits -= quote.price;
    player.licenses[quote.item.id] = { purchasedAt: new Date().toISOString(), price: quote.price };
    const demand = this.demandForMinute(quote.item.id, quote.minute);
    demand.purchasesThisMinute += 1;
    demand.purchases += 1;
    const result = { item: { ...quote.item, owned: true }, balance: player.credits, price: quote.price };
    player.purchaseKeys[idempotencyKey] = { quoteId, result };
    await this.persist();
    return result;
  }

  ownsLicense(playerId, wordId) {
    return Boolean(this.data.players[playerId]?.licenses?.[wordId]);
  }

  async setFounderPass(playerId, enabled = true) {
    const player = this.data.players[playerId];
    if (!player) return null;
    player.founderPass = Boolean(enabled);
    await this.persist();
    return this.publicPlayer(playerId);
  }

  canUseWish(playerId, date = new Date()) {
    const player = this.data.players[playerId];
    if (!player) return false;
    const day = date.toISOString().slice(0, 10);
    return Boolean(!player.freeWishUsed || (player.founderPass && player.dailyWishUsedDate !== day));
  }

  async consumeWish(playerId, date = new Date()) {
    const player = this.data.players[playerId];
    if (!player) return;
    player.freeWishUsed = true;
    player.dailyWishUsedDate = date.toISOString().slice(0, 10);
    await this.persist();
  }

  hasScore(playerId, challengeId) {
    return this.data.scores.some((entry) => entry.playerId === playerId && entry.challengeId === challengeId);
  }

  forfeitedChallenge(playerId, challengeId) {
    const player = this.data.players[playerId];
    const key = String(challengeId || "").trim();
    return player && key ? player.forfeitedChallenges?.[key] || null : null;
  }

  hasForfeitedChallenge(playerId, challengeId) {
    return Boolean(this.forfeitedChallenge(playerId, challengeId));
  }

  async forfeitChallenge(playerId, challengeId, { reason = "reveal", runId = "" } = {}, date = new Date()) {
    const player = this.data.players[playerId];
    const key = String(challengeId || "").trim();
    if (!player || !key) throw serviceError(400, "A player and challenge are required.", "invalid_challenge_forfeit");
    player.forfeitedChallenges ||= {};
    if (player.forfeitedChallenges[key]) {
      await this.writeQueue;
      return player.forfeitedChallenges[key];
    }

    const record = {
      reason: String(reason || "reveal").slice(0, 32),
      runId: String(runId || "").slice(0, 64),
      at: date.toISOString()
    };
    player.forfeitedChallenges[key] = record;

    const history = Object.entries(player.forfeitedChallenges);
    if (history.length > 180) {
      history.sort((left, right) => Date.parse(right[1].at) - Date.parse(left[1].at));
      player.forfeitedChallenges = Object.fromEntries(history.slice(0, 180));
    }
    await this.persist();
    return record;
  }

  async addScore(entry) {
    const index = this.data.scores.findIndex((score) => score.playerId === entry.playerId && score.challengeId === entry.challengeId && score.division === entry.division);
    const current = index >= 0 ? this.data.scores[index] : null;
    if (betterEntry(entry, current)) {
      if (index >= 0) this.data.scores[index] = entry;
      else this.data.scores.push(entry);
    }
    if (this.data.scores.length > 5000) this.data.scores = this.data.scores.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5000);
    await this.persist();
    return this.rankFor(entry.challengeId, entry.division, entry.playerId);
  }

  leaderboard(scope, division = "pure", limit = 50, playerId = "") {
    const currentDaily = new Date().toISOString().slice(0, 10);
    const currentWeekly = isoWeekKey();
    const filtered = this.data.scores.filter((entry) => {
      if (entry.division !== division) return false;
      if (scope === "daily") return entry.mode === "daily" && entry.dailyKey === currentDaily;
      if (scope === "weekly") return entry.mode === "weekly" && entry.weeklyKey === currentWeekly;
      if (scope === "sprint") return ["quick", "moves"].includes(entry.mode) && Date.now() - Date.parse(entry.createdAt) < 7 * 86400000;
      return true;
    }).sort(compareEntries);
    const top = filtered.slice(0, clamp(Number(limit) || 25, 1, 100)).map((entry, index) => publicEntry(entry, index + 1));
    const playerIndex = playerId ? filtered.findIndex((entry) => entry.playerId === playerId) : -1;
    return { scope, division, entries: top, playerEntry: playerIndex >= 0 ? publicEntry(filtered[playerIndex], playerIndex + 1) : null, updatedAt: new Date().toISOString() };
  }

  rankFor(challengeId, division, playerId) {
    const entries = this.data.scores.filter((entry) => entry.challengeId === challengeId && entry.division === division).sort(compareEntries);
    const index = entries.findIndex((entry) => entry.playerId === playerId);
    return index >= 0 ? { rank: index + 1, entry: publicEntry(entries[index], index + 1) } : null;
  }

  async grantEarnedCredits(playerId, requested) {
    const player = this.data.players[playerId];
    if (!player) return 0;
    const date = new Date().toISOString().slice(0, 10);
    if (player.earned.date !== date) player.earned = { date, amount: 0 };
    const grant = Math.max(0, Math.min(Number(requested) || 0, 25 - player.earned.amount));
    if (!grant) return 0;
    player.credits += grant;
    player.earned.amount += grant;
    await this.persist();
    return grant;
  }

  async grantChallengeCredits(playerId, challengeId, requested, date = new Date()) {
    const player = this.data.players[playerId];
    const rewardKey = String(challengeId || "").trim();
    if (!player || !rewardKey) return { creditReward: 0, weeklyBonus: 0, alreadyRewarded: false };

    player.rewardedChallenges ||= {};
    if (player.rewardedChallenges[rewardKey]) return { creditReward: 0, weeklyBonus: 0, alreadyRewarded: true };

    const day = date.toISOString().slice(0, 10);
    if (player.earned?.date !== day) player.earned = { date: day, amount: 0 };
    const creditReward = Math.max(0, Math.min(Number(requested) || 0, 25 - player.earned.amount));
    player.credits += creditReward;
    player.earned.amount += creditReward;
    player.rewardedChallenges[rewardKey] = date.toISOString();

    const week = isoWeekKey(date);
    if (player.weeklyActivity?.week !== week) player.weeklyActivity = { week, days: [], bonusClaimed: false };
    if (!player.weeklyActivity.days.includes(day)) player.weeklyActivity.days.push(day);
    let weeklyBonus = 0;
    if (player.weeklyActivity.days.length >= 4 && !player.weeklyActivity.bonusClaimed) {
      weeklyBonus = 40;
      player.credits += weeklyBonus;
      player.weeklyActivity.bonusClaimed = true;
    }

    const rewardHistory = Object.entries(player.rewardedChallenges);
    if (rewardHistory.length > 180) {
      rewardHistory.sort((left, right) => Date.parse(right[1]) - Date.parse(left[1]));
      player.rewardedChallenges = Object.fromEntries(rewardHistory.slice(0, 180));
    }
    await this.persist();
    return { creditReward, weeklyBonus, alreadyRewarded: false };
  }

  persist() {
    if (this.path === ":memory:") return Promise.resolve();
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(this.data, null, 2), "utf8");
      await rename(temporary, this.path);
    });
    return this.writeQueue;
  }
}

export class RunRegistry {
  constructor(store) {
    this.store = store;
    this.runs = new Map();
  }

  start(playerId, game, { ranked = false, challengeId = "", scoringDisabled = false, forfeitReason = "" } = {}) {
    this.cleanup();
    const runId = randomUUID();
    const startedAt = Date.now();
    const run = {
      runId,
      playerId,
      game,
      ranked,
      challengeId: challengeId || `practice:${runId}`,
      startedAt,
      expiresAt: startedAt + Math.max((game.timeLimit || 0) * 1000 + 10_000, 30 * 60_000),
      discovered: new Map(game.starters.map((word) => [word.toLowerCase(), { word }])),
      moves: 0,
      assist: scoringDisabled ? "reveal" : "none",
      scoringDisabled: Boolean(scoringDisabled),
      forfeited: Boolean(scoringDisabled),
      forfeitReason: scoringDisabled ? String(forfeitReason || "reveal") : null,
      forfeitedAt: scoringDisabled ? startedAt : null,
      revealRoute: null,
      usedBend: false,
      completedAt: null,
      submitted: false
    };
    this.runs.set(runId, run);
    return { run, token: this.store.sign(`run:${runId}:${playerId}:${startedAt}`) };
  }

  get(runId, playerId, token) {
    const run = this.runs.get(runId);
    if (!run || run.playerId !== playerId || !this.store.verify(`run:${runId}:${playerId}:${run.startedAt}`, token)) throw serviceError(401, "This run is not valid anymore.", "invalid_run");
    if (Date.now() > run.expiresAt) throw serviceError(410, "This run has expired.", "run_expired");
    return run;
  }

  canCombine(run, a, b) {
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
    if (!run.discovered.has(String(a).toLowerCase()) || !run.discovered.has(String(b).toLowerCase())) throw serviceError(422, "That combination contains an undiscovered word.", "impossible_combination");
    if (run.game.moveLimit && run.moves >= run.game.moveLimit) throw serviceError(409, "No moves remain in this orbit.", "move_limit");
    if (run.game.timeLimit && Date.now() - run.startedAt > run.game.timeLimit * 1000 + 3000) throw serviceError(409, "Time has expired for this orbit.", "time_limit");
  }

  recordCombination(run, result) {
    run.moves += 1;
    run.discovered.set(result.word.toLowerCase(), result);
    if (result.source === "ai") run.assist = "ai";
    if (result.word.toLowerCase() === run.game.target.toLowerCase()) run.completedAt = Date.now();
  }

  reveal(run, route) {
    if (run.revealRoute) return run.revealRoute;
    if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
    if (!Array.isArray(route)) throw serviceError(422, "No verified answer path is available.", "route_unavailable");

    run.assist = "reveal";
    run.scoringDisabled = true;
    run.forfeited = true;
    run.forfeitReason = "reveal";
    run.forfeitedAt ||= Date.now();
    run.revealRoute = route.map((step) => ({ ...step }));
    for (const step of run.revealRoute) run.discovered.set(step.word.toLowerCase(), { ...step });
    run.moves += run.revealRoute.length;
    run.completedAt = Date.now();
    return run.revealRoute;
  }

  addBend(run, item, assist) {
    if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
    if (run.usedBend) throw serviceError(409, "Only one Reality Bend may be used in a run.", "bend_used");
    run.usedBend = true;
    run.assist = assist;
    run.discovered.set(item.word.toLowerCase(), item);
  }

  finalize(run, callsign) {
    if (run.scoringDisabled || run.forfeited) throw serviceError(409, "Assisted orbits cannot submit a score.", "assisted_run");
    if (!run.completedAt) throw serviceError(422, "The target has not been reached.", "target_missing");
    if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
    run.submitted = true;
    const elapsedMs = Math.max(1, run.completedAt - run.startedAt);
    const assisted = run.assist !== "none";
    return {
      id: randomUUID(),
      runId: run.runId,
      playerId: run.playerId,
      callsign,
      challengeId: run.challengeId,
      division: assisted ? "open" : "pure",
      assist: run.assist,
      mode: run.game.mode,
      target: run.game.target,
      score: calculateStarscore({ game: run.game, moves: run.moves, elapsedSeconds: Math.round(elapsedMs / 1000), assisted }),
      moves: run.moves,
      elapsedMs,
      dailyKey: new Date(run.startedAt).toISOString().slice(0, 10),
      weeklyKey: isoWeekKey(new Date(run.startedAt)),
      createdAt: new Date().toISOString()
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [id, run] of this.runs) if (now > run.expiresAt + 60_000) this.runs.delete(id);
  }
}

export function serviceError(statusCode, message, code = "service_error") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.serviceCode = code;
  return error;
}

export function isoWeekKey(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function publicEntry(entry, rank) {
  return { rank, callsign: entry.callsign, score: entry.score, moves: entry.moves, elapsedMs: entry.elapsedMs, mode: entry.mode, target: entry.target, assist: entry.assist, division: entry.division };
}
