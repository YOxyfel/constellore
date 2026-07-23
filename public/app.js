import { createCtrlHoverController } from "./ctrl-hover.mjs?v=3.0.0-beta.1";
import { createShiftBoardController } from "./shift-board.mjs?v=3.0.0-beta.1";
import { findOpenSpawn, orderInventory, packOrbit, pickMagneticTarget } from "./frictionless.mjs?v=3.0.0-beta.1";
import { buildMasteryCollections, lifetimeMasteryProgress, recordRecipeDiscovery, sanitizeRecipeMasteryState, summarizeMasteryCollections } from "./recipe-mastery.mjs?v=3.0.0-beta.1";
import { QUICK_TIP_LIMIT, assistancePolicy, buildGhost, combineAssistance, feedbackCuePolicy, ghostSnapshot, ghostTrailPreviewState, grantSenseCharges, lifetimeProgression, reconcileCloudProgression, refillSenseWallet, sanitizeFeedbackPreferences, sanitizeSenseWallet, spendSenseCharge, weeklyRatingPresentation } from "./engagement-features.mjs?v=3.0.0-beta.1";
import { firstOrbitProgress, firstOrbitWrongPairMessage, resolveFirstOrbitCombination, sanitizeFirstOrbitState } from "./first-orbit.mjs?v=3.0.0-beta.1";
import { secondOrbitProgress, sanitizeSecondOrbitState } from "./second-orbit.mjs?v=3.0.0-beta.1";
import { exploreGame, mergeExploreInventory, sanitizeExploreInventory } from "./explore-sandbox.mjs?v=3.0.0-beta.1";
import { buildConstellationCard, constellationCardFilename, constellationCardShareText, renderConstellationCardSvg } from "./constellation-card.mjs?v=3.0.0-beta.1";
import { COSMETIC_CATALOG, cosmeticClasses, cosmeticOptions, earnedBadges, progressionAuraClass, sanitizeCosmeticLoadout, transformFeedbackAudio } from "./cosmetic-economy.mjs?v=3.0.0-beta.1";
import { createRecipeFeedbackRequest, recipeFingerprint, sanitizeRecipeRating } from "./recipe-feedback.mjs?v=3.0.0-beta.1";
import { selectUniverse } from "./universe-director.mjs?v=3.0.0-beta.1";
import { listPendingScoreRecords, removePendingScoreRecord, savePendingScoreRecord } from "./pending-scores.mjs?v=3.0.0-beta.1";
import { buildMissionBriefing } from "./mission-briefing.mjs?v=3.0.0-beta.1";
import { advanceVoyageProgress, constellationVoyage, constellationVoyageCatalog, currentVoyageStage, sanitizeVoyageProgress, voyageProgress } from "./constellation-voyages.mjs?v=3.0.0-beta.1";
import { annotateCosmicEventResult, cosmicEventCollectionProgress, cosmicEventTargets, currentCosmicEvent } from "./cosmic-events.mjs?v=3.0.0-beta.1";
import { explainRecipeNearMiss, explainSuccessfulRecipe } from "./recipe-insight.mjs?v=3.0.0-beta.1";
import { buildLivingAtlas, buildRouteProgress } from "./living-atlas.mjs?v=3.0.0-beta.1";
import { buildCommunityResults } from "./community-results.mjs?v=3.0.0-beta.1";
import { comparePersonalBest, createRouteSignature, gradeSignatureRoute, sanitizeRouteSignature } from "./signature-routes.mjs?v=3.0.0-beta.1";
import { createHomeMenuState } from "./home-menu.mjs?v=3.0.0-beta.1";

const starterEmoji = { Earth: "🌍", Water: "💧", Fire: "🔥", Air: "💨" };
const starterCategory = { Earth: "nature", Water: "force", Fire: "force", Air: "force" };
const isStaticBeta = document.body.dataset.runtime === "local-practice";
const PROFILE_KEY = isStaticBeta ? "constellore-local-profile-v1" : "constellore-profile-v1";
const LEGACY_PROFILE_KEYS = isStaticBeta ? [] : ["wordforge-profile-v3", "wordforge-profile-v2"];
const todayKey = new Date().toISOString().slice(0, 10);
const sessionId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const MAX_BOARD_NODES = 180;
const MAX_SHIFT_COPIES_PER_DRAG = 24;
const LOCAL_ANALYTICS_KEY = "constellore-local-event-counts-v1";
const LOCAL_RECIPE_FEEDBACK_KEY = "constellore-local-recipe-feedback-v1";
const LOCAL_EXPECTED_PAIRS_KEY = "constellore-local-expected-pairs-v1";
const ANALYTICS_COHORT_KEY = "constellore-analytics-cohort-v1";
const ANALYTICS_PREFERENCE_KEY = "constellore-analytics-preference-v1";
const PENDING_RECOVERY_KIT_KEY = "constellore-pending-recovery-kit-v1";
const VOYAGE_REWARD = 35;
const EVENT_COLLECTION_REWARD = 60;
const MAX_TRANSIENT_TRAILS = 120;
const COMMERCE_LAUNCH_READY = document.body.dataset.commerce === "enabled";
const ANALYTICS_DIMENSIONS = new Set(["mode", "division", "source", "result", "completed", "installed", "replay", "free", "status", "scope", "location", "phase", "ranked", "reward", "success"]);

const MASTERY_CATALOG = [
  ["Earth", "Water", "Mud", "🟤", "nature"], ["Air", "Water", "Mist", "🌫️", "nature"],
  ["Earth", "Fire", "Lava", "🌋", "nature"], ["Lava", "Water", "Stone", "🪨", "nature"],
  ["Air", "Steam", "Cloud", "☁️", "nature"], ["Cloud", "Water", "Rain", "🌧️", "nature"],
  ["Stone", "Stone", "Mountain", "⛰️", "nature"], ["Snow", "Water", "Ice", "🧊", "nature"],
  ["Water", "Water", "Ocean", "🌊", "nature"], ["Sand", "Sand", "Desert", "🏜️", "nature"],
  ["Earth", "Energy", "Life", "🌱", "life"], ["Earth", "Life", "Plant", "🌿", "life"],
  ["Plant", "Water", "Tree", "🌳", "life"], ["Air", "Life", "Bird", "🐦", "life"],
  ["Life", "Water", "Fish", "🐟", "life"], ["Tree", "Tree", "Forest", "🌲", "life"],
  ["Field", "Plant", "Garden", "🪴", "life"], ["Earth", "Species", "Animal", "🐾", "life"],
  ["Mud", "Fire", "Brick", "🧱", "structure"], ["Brick", "Brick", "Wall", "🧱", "structure"],
  ["Wall", "Wall", "House", "🏠", "structure"], ["House", "House", "Village", "🏘️", "structure"],
  ["Village", "Village", "City", "🏙️", "structure"], ["Fire", "Stone", "Metal", "🔩", "structure"],
  ["Energy", "Metal", "Machine", "⚙️", "structure"], ["Clay", "Fire", "Pottery", "🏺", "structure"],
  ["Fire", "Water", "Steam", "♨️", "force"], ["Air", "Energy", "Light", "✨", "force"],
  ["Cloud", "Energy", "Storm", "⛈️", "force"], ["Energy", "Storm", "Lightning", "🌩️", "force"],
  ["Fire", "Fire", "Inferno", "🔥", "force"], ["Air", "Air", "Wind", "🌬️", "force"],
  ["Energy", "Energy", "Power", "🔋", "force"], ["Light", "Light", "Laser", "🔦", "force"],
  ["Air", "Light", "Sky", "🌌", "celestial"], ["Light", "Sky", "Star", "⭐", "celestial"],
  ["Glass", "Sky", "Telescope", "🔭", "celestial"], ["Machine", "Sky", "Rocket", "🚀", "celestial"],
  ["Fire", "Light", "Sun", "☀️", "celestial"], ["Sky", "Sky", "Space", "🌌", "celestial"],
  ["Star", "Star", "Galaxy", "🌌", "celestial"], ["Sky", "Star", "Constellation", "✨", "celestial"]
].map(([a, b, word, emoji, category]) => ({ a, b, word, emoji, category }));

const defaultProfile = {
  version: 7,
  playerId: "",
  playerToken: "",
  cloudProfileVersion: 0,
  cloudPending: false,
  cloudPendingFields: [],
  callsign: "",
  credits: 0,
  vault: [],
  stardust: 0,
  wins: 0,
  discovered: ["Earth", "Water", "Fire", "Air"],
  dailyStreak: 0,
  lastDailyDate: "",
  dailyCompleted: "",
  streakShields: 1,
  freeWishUsed: false,
  wishAvailable: true,
  dailyWishUsedDate: "",
  premium: false,
  theme: "void",
  cosmetics: { theme: "void", board: "starlit", trail: "classic", sound: "cosmic" },
  recipeMastery: { version: 1, recipes: [] },
  masteryCelebrated: [],
  senseWallet: { version: 1, charges: 0, lastRefillDate: "", earned: 0, spent: 0 },
  senseFounderBonusDate: "",
  feedbackPreferences: { sound: true, haptics: true },
  rivalGhostEnabled: true,
  firstOrbit: { seen: false, completed: false },
  secondOrbit: { seen: false, completed: false },
  exploreWords: [],
  weekly: { key: "", stage: 0, complete: false },
  voyageProgress: sanitizeVoyageProgress({}),
  selectedVoyageId: "first-cities",
  eventProgress: { weekKey: "", eventId: "", words: [], rewarded: false },
  signatureBests: [],
  rewardedRunIds: []
};

const state = {
  game: null,
  mode: null,
  words: [],
  nodes: [],
  history: [],
  trails: [],
  moves: 0,
  newDiscoveries: 0,
  nextId: 1,
  topZ: 10,
  orbitGeneration: 0,
  busyPairs: new Set(),
  selectedNodeId: null,
  inventoryQuery: "",
  inventoryClock: 0,
  inventoryRecency: new Map(),
  inventoryFocusWord: "",
  inventoryVisibleCount: 0,
  timerId: null,
  remainingSeconds: 0,
  startedAt: 0,
  finishedElapsedSeconds: 0,
  finished: false,
  startingRun: false,
  pendingMission: null,
  wished: false,
  bendItem: null,
  rewardedWish: false,
  cosmosFrame: null,
  stars: [],
  resultAction: null,
  resultMasteryNotice: "",
  shareGame: null,
  shareCard: null,
  installPrompt: null,
  run: null,
  pause: { active: false, confirmAction: "" },
  assist: "none",
  scoringDisabled: false,
  scoreMultiplier: 1,
  reveal: {
    active: false,
    paused: false,
    speed: 1,
    skip: false,
    pending: false,
    revealed: false,
    replayAvailable: false,
    replayUsed: false,
    replaying: false,
    phase: "idle",
    generation: 0,
    route: [],
    completed: 0,
    layout: null,
    wake: null
  },
  market: null,
  marketView: "market",
  marketTimer: null,
  marketClockOffset: 0,
  selectedMarketItem: null,
  leaderboardScope: "daily",
  leaderboardDivision: "pure",
  sense: { words: [], timer: null, active: false },
  powerups: { tipsUsed: 0, tipIds: [], giftUsed: false, giftUnavailable: false, giftItem: null, busy: false },
  expectedPair: { a: "", b: "", key: "", submitted: false, timer: null },
  expectedPairReports: new Set(),
  recipeFeedback: { move: 0, step: null, timer: null, pendingTimer: null, submitted: false },
  scoreSubmission: { runId: "", activeSaved: false, pendingSaved: false, inFlight: false, exitAction: null, exitLabel: "" },
  recoveryKit: null,
  cloudReady: false,
  cloudSyncing: false,
  cloudDirty: false,
  cloudGeneration: 0,
  cloudController: null,
  cloudRevision: 0,
  ghost: { enabled: true, model: null, timerId: null, lastRelation: "", started: false, requestGeneration: 0, requestController: null, nextRival: null, estimatedSteps: 0 },
  journeyContext: null,
  journeyView: "voyage",
  signature: null,
  community: null,
  eventRewardGranted: 0,
  cosmicEvent: null,
  eventServerTime: ""
};

let profile = loadProfile();
let config = { billingEnabled: false, checkoutUrl: "", testStoreEnabled: false, creditPacks: [], rewardedAdsEnabled: false, founderPrice: "€6.99", aiEnabled: false };
let localRuntimePromise;
let activeTrayDragCleanup = null;
let activeTrayShiftSource = null;
let activeBoardDragCleanup = null;
let shiftCopyLimitAnnounced = false;
let lastPointerPosition = null;
let clearUndo = null;
let clearUndoTimer = null;
let armedPowerupShortcut = { kind: "", expiresAt: 0, timer: null };
let runSaveTimer = null;
let cloudSyncTimer = null;
let pauseCloseRestoreFocus = true;
let boardGeometryVersion = 0;
let analyticsPreference = readAnalyticsPreference();
let analyticsCohortId = readAnalyticsCohort();
const pendingScoreRetryPromises = new Map();
const ACTIVE_RUN_KEY = isStaticBeta ? "constellore-local-active-run-v1" : "constellore-active-run-v1";
const LEGACY_PENDING_SCORES_KEY = "constellore-pending-scores-v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const billingAdapter = () => globalThis.constelloreBilling || globalThis.wordforgeBilling;
const adsAdapter = () => globalThis.constelloreAds || globalThis.wordforgeAds;
const els = {
  startScreen: $("#startScreen"), gameScreen: $("#gameScreen"), targetMessage: $("#targetMessage"),
  board: $("#board"), boardItems: $("#boardItems"), boardGuide: $("#boardGuide"), cosmosCanvas: $("#cosmosCanvas"),
  tidyBoard: $("#tidyBoard"), resetBoard: $("#resetBoard"), dropPairPreview: $("#dropPairPreview"),
  tapChainStatus: $("#tapChainStatus"), tapChainText: $("#tapChainText"), boardUndo: $("#boardUndo"),
  alchemyNote: $("#alchemyNote"), boardAnnouncement: $("#boardAnnouncement"), wordList: $("#wordList"), collectionCount: $("#collectionCount"),
  expectedPairFeedback: $("#expectedPairFeedback"), expectedPairButton: $("#expectedPairButton"),
  inventorySearch: $("#inventorySearch"), inventorySearchClear: $("#inventorySearchClear"), inventorySearchStatus: $("#inventorySearchStatus"),
  modeName: $("#modeName"), targetWord: $("#targetWord"), universePill: $("#universePill"), lawPill: $("#lawPill"), movesValue: $("#movesValue"),
  timerHud: $("#timerHud"), timerValue: $("#timerValue"), pathCount: $("#pathCount"),
  milestoneText: $("#milestoneText"), milestoneBar: $("#milestoneBar"), wishState: $("#wishState"),
  senseButton: $("#senseButton"), senseHudCount: $("#senseHudCount"), senseDialog: $("#senseDialog"),
  quickTipShortcut: $("#quickTipShortcut"), quickTipShortcutCount: $("#quickTipShortcutCount"),
  wordGiftShortcut: $("#wordGiftShortcut"), wordGiftShortcutCount: $("#wordGiftShortcutCount"),
  senseShortcut: $("#senseShortcut"), senseShortcutCount: $("#senseShortcutCount"), powerupShopShortcut: $("#powerupShopShortcut"),
  quickTipCount: $("#quickTipCount"), useQuickTip: $("#useQuickTip"), quickTipMessage: $("#quickTipMessage"),
  wordGiftCard: $("#wordGiftCard"), wordGiftState: $("#wordGiftState"), useWordGift: $("#useWordGift"), wordGiftMessage: $("#wordGiftMessage"),
  rivalGhost: $("#rivalGhost"), ghostCallsign: $("#ghostCallsign"), ghostStatus: $("#ghostStatus"), ghostPace: $("#ghostPace"),
  ghostPreview: $("#ghostPreview"), ghostPreviewStatus: $("#ghostPreviewStatus"), ghostPreviewCount: $("#ghostPreviewCount"), ghostPreviewPercent: $("#ghostPreviewPercent"),
  ghostPreviewProgress: $("#ghostPreviewProgress"), ghostPreviewBar: $("#ghostPreviewBar"), ghostPreviewSteps: $("#ghostPreviewSteps"),
  paywallDialog: $("#paywallDialog"), wishDialog: $("#wishDialog"), atlasDialog: $("#atlasDialog"),
  missionBriefingDialog: $("#missionBriefingDialog"), pauseDialog: $("#pauseDialog"), journeyDialog: $("#journeyDialog"),
  profileDialog: $("#profileDialog"), shareDialog: $("#shareDialog"), resultDialog: $("#resultDialog"),
  updatesDialog: $("#updatesDialog"),
  exchangeDialog: $("#exchangeDialog"), marketBuyDialog: $("#marketBuyDialog"), leaderboardDialog: $("#leaderboardDialog"),
  revealDialog: $("#revealDialog"), revealController: $("#revealController"), revealPathButton: $("#revealPathButton"),
  revealStepText: $("#revealStepText"), revealPause: $("#revealPause"), revealSpeed: $("#revealSpeed"),
  revealSkip: $("#revealSkip"), revealProgressBar: $("#revealProgressBar"), revealAnnouncement: $("#revealAnnouncement"),
  marketList: $("#marketList"), marketBalance: $("#marketBalance"), marketCountdown: $("#marketCountdown"),
  marketMessage: $("#marketMessage"), leaderboardRows: $("#leaderboardRows"), leaderboardMessage: $("#leaderboardMessage"),
  resultEmoji: $("#resultEmoji"), resultKicker: $("#resultKicker"), resultTitle: $("#resultTitle"),
  resultStats: $("#resultStats"), resultMasteryCard: $("#resultMasteryCard"), resultMasteryText: $("#resultMasteryText"), resultPrimary: $("#resultPrimary"), resultRetry: $("#resultRetry"),
  resultShare: $("#resultShare"), rewardCard: $("#rewardCard"), rewardDust: $("#rewardDust"),
  rewardReason: $("#rewardReason"), masteryCollectionList: $("#masteryCollectionList"),
  atlasMap: $("#atlasMap"), atlasGraph: $("#atlasGraph"), atlasGraphEdges: $("#atlasGraphEdges"), atlasGraphNodes: $("#atlasGraphNodes"), atlasGraphSummary: $("#atlasGraphSummary"),
  signatureResultCard: $("#signatureResultCard"), communityResultCard: $("#communityResultCard"), communityResultStats: $("#communityResultStats"),
  firstOrbitGuide: $("#firstOrbitGuide"), recipeFeedback: $("#recipeFeedback"),
  routeProgressTrail: $("#routeProgressTrail"), resultRouteTrail: $("#resultRouteTrail"),
  toast: $("#toast"), connectionBadge: $("#connectionBadge")
};

const ctrlHover = createCtrlHoverController({
  getNode: getCtrlHoverNode,
  combine: combineNodes,
  onChange: syncCtrlHoverState
});

const shiftBoard = createShiftBoardController({
  getNode: getShiftBoardNode,
  removeNode: removeShiftBoardNode,
  duplicateNode: duplicateShiftBoardNode,
  onChange: syncShiftBoardState,
  maxCopies: MAX_SHIFT_COPIES_PER_DRAG
});

function sanitizeSignatureBests(raw) {
  const signatures = [];
  const scopes = new Set();
  for (const value of Array.isArray(raw) ? raw.slice(0, 160) : []) {
    const signature = sanitizeRouteSignature(value);
    if (!signature || scopes.has(signature.scopeKey)) continue;
    scopes.add(signature.scopeKey);
    signatures.push(signature);
    if (signatures.length >= 120) break;
  }
  return signatures;
}

function sanitizeRewardedRunIds(raw) {
  const ids = [];
  const seen = new Set();
  for (const value of Array.isArray(raw) ? raw.slice(0, 512) : []) {
    const id = typeof value === "string" ? value.trim().slice(0, 96) : "";
    if (!/^[a-z0-9][a-z0-9-]{7,95}$/i.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= 256) break;
  }
  return ids;
}

function sanitizeEventProgressForEvent(raw, event) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const sameEvent = source.weekKey === event.weekKey && source.eventId === event.id;
  const originWords = ["Earth", "Water", "Fire", "Air"].filter((word) => event.collection.words.some((entry) => inventoryKey(entry) === inventoryKey(word)));
  const collection = cosmicEventCollectionProgress(event, [...(sameEvent && Array.isArray(source.words) ? source.words : []), ...originWords]);
  return {
    weekKey: event.weekKey,
    eventId: event.id,
    words: collection.found,
    rewarded: sameEvent && Boolean(source.rewarded) && collection.complete
  };
}

function sanitizeEventProgress(raw, date = new Date()) {
  return sanitizeEventProgressForEvent(raw, currentCosmicEvent(date));
}

function sanitizeSelectedVoyage(value) {
  const selected = constellationVoyage(value);
  return selected?.id || constellationVoyageCatalog()[0]?.id || "first-cities";
}

function readAnalyticsPreference() {
  try {
    const stored = JSON.parse(localStorage.getItem(ANALYTICS_PREFERENCE_KEY) || "null");
    return stored?.enabled === true;
  } catch {
    return false;
  }
}

function readAnalyticsCohort() {
  try {
    const value = String(localStorage.getItem(ANALYTICS_COHORT_KEY) || "").trim();
    return /^[a-z0-9-]{16,80}$/i.test(value) ? value : "";
  } catch {
    return "";
  }
}

function ensureAnalyticsCohort() {
  if (analyticsCohortId) return analyticsCohortId;
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  analyticsCohortId = `cohort-${random}`.slice(0, 80);
  try { localStorage.setItem(ANALYTICS_COHORT_KEY, analyticsCohortId); } catch { /* Optional diagnostics must work without storage. */ }
  return analyticsCohortId;
}

function loadProfile() {
  try {
    const legacyProfile = LEGACY_PROFILE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || legacyProfile || "null");
    if (!stored || typeof stored !== "object") return structuredClone(defaultProfile);
    return {
      ...structuredClone(defaultProfile),
      ...stored,
      version: 7,
      vault: Array.isArray(stored.vault) ? stored.vault : [],
      discovered: Array.isArray(stored.discovered) ? [...new Set([...defaultProfile.discovered, ...stored.discovered])].slice(0, 1000) : [...defaultProfile.discovered],
      recipeMastery: sanitizeRecipeMasteryState(stored.recipeMastery),
      masteryCelebrated: Array.isArray(stored.masteryCelebrated) ? [...new Set(stored.masteryCelebrated.map(String))].slice(0, 20) : [],
      senseWallet: sanitizeSenseWallet(stored.senseWallet),
      feedbackPreferences: sanitizeFeedbackPreferences(stored.feedbackPreferences),
      rivalGhostEnabled: stored.rivalGhostEnabled !== false,
      firstOrbit: sanitizeFirstOrbitState(stored.firstOrbit),
      secondOrbit: sanitizeSecondOrbitState(stored.secondOrbit),
      exploreWords: sanitizeExploreInventory(stored.exploreWords, stored.discovered),
      cosmetics: sanitizeCosmeticLoadout(stored.cosmetics || { theme: stored.theme }, { founder: Boolean(stored.premium) || isStaticBeta }),
      cloudProfileVersion: Math.max(0, Math.floor(Number(stored.cloudProfileVersion) || 0)),
      cloudPending: Boolean(stored.cloudPending),
      cloudPendingFields: Array.isArray(stored.cloudPendingFields)
        ? [...new Set(stored.cloudPendingFields.filter((field) => ["all", "firstOrbit", "mastery", "progression", "settings", "journeys", "signatures"].includes(field)))].slice(0, 8)
        : [],
      weekly: { ...defaultProfile.weekly, ...(stored.weekly || {}) },
      voyageProgress: sanitizeVoyageProgress(stored.voyageProgress),
      selectedVoyageId: sanitizeSelectedVoyage(stored.selectedVoyageId),
      eventProgress: sanitizeEventProgress(stored.eventProgress),
      signatureBests: sanitizeSignatureBests(stored.signatureBests),
      rewardedRunIds: sanitizeRewardedRunIds(stored.rewardedRunIds)
    };
  } catch {
    return structuredClone(defaultProfile);
  }
}

function saveProfile({ cloud = true, fields = ["all"] } = {}) {
  if (cloud && !isStaticBeta) {
    profile.cloudPending = true;
    const pending = Array.isArray(profile.cloudPendingFields) ? profile.cloudPendingFields : [];
    profile.cloudPendingFields = [...new Set([...pending, ...fields])].slice(0, 8);
  }
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* Private mode can disable storage. */ }
  renderProfile();
  if (cloud) scheduleCloudProfileSync();
}

function rankFor() {
  const mastery = lifetimeMasteryProgress(profile.recipeMastery);
  return lifetimeProgression({
    stardust: 0,
    wins: profile.wins,
    discoveries: profile.discovered.length,
    masteryStars: mastery.stars
  });
}

function cappedScoreMultiplier(assist, ...values) {
  let multiplier = assistancePolicy(assist).scoreMultiplier;
  for (const value of values) {
    if (value == null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) multiplier = Math.min(multiplier, clamp(number, 0, 1));
  }
  return clamp(multiplier, 0, 1);
}

function firstSessionUnlocked() {
  return homeMenuState().onboardingComplete;
}

function homeMenuState() {
  return createHomeMenuState({
    firstOrbit: sanitizeFirstOrbitState(profile.firstOrbit),
    secondOrbit: sanitizeSecondOrbitState(profile.secondOrbit),
    wins: profile.wins,
    dailyCompleted: profile.dailyCompleted,
    todayKey
  });
}

function primaryOrbitState() {
  return homeMenuState().primary;
}

function syncProgressiveDisclosure() {
  const training = sanitizeFirstOrbitState(profile.firstOrbit);
  const bridge = sanitizeSecondOrbitState(profile.secondOrbit);
  const menu = homeMenuState();
  document.body.dataset.homeStage = menu.stage;
  document.body.classList.toggle("first-session", !menu.onboardingComplete);
  document.body.classList.toggle("training-needed", !training.completed);
  document.body.classList.toggle("second-orbit-needed", training.completed && !bridge.completed && profile.wins === 0);
  document.body.classList.toggle("progress-ready", menu.progressReady);
  document.body.classList.toggle("adventures-ready", menu.adventuresReady);
  document.body.classList.toggle("advanced-ready", menu.advancedReady);
  const primary = menu.primary;
  $("#primaryOrbitKicker").textContent = primary.kicker;
  $("#primaryOrbitTitle").textContent = primary.title;
  $("#primaryOrbitDescription").textContent = primary.description;
  $("#primaryOrbitButton span").textContent = primary.label;
  $("#primaryOrbitMeta").textContent = primary.meta;
  $("#primaryOrbitButton").dataset.action = primary.action;
  const secondary = $("#primaryOrbitSecondary");
  secondary.textContent = primary.secondaryLabel;
  secondary.dataset.action = primary.secondaryAction;
  for (const card of $$('[data-home-mode]')) {
    card.hidden = card.dataset.homeMode === primary.action || (card.dataset.homeMode === "daily" && profile.dailyCompleted === todayKey);
  }
}

function announceModeScreenViewed() {
  const primary = primaryOrbitState();
  track("mode_screen_viewed", { unlocked: firstSessionUnlocked(), primary: primary.action });
}

function currentWeekKey() {
  const date = new Date();
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function currentWeekSeed() {
  return stableHash(currentWeekKey());
}

function setupWeeklyState() {
  const key = currentWeekKey();
  if (profile.weekly.key !== key) profile.weekly = { key, stage: 0, complete: false };
  $("#weeklyProgress").textContent = `${profile.weekly.stage} / 3`;
  $("#weeklyProgressBar").style.width = `${profile.weekly.stage / 3 * 100}%`;
  $("#weeklyDescription").textContent = profile.weekly.complete ? "Expedition complete. A new rift opens next week." : `Stage ${profile.weekly.stage + 1} of 3 · shared weekly route`;
  $("#weeklyButton").disabled = profile.weekly.complete;
}

function setupDailyState() {
  return profile.dailyCompleted === todayKey;
}

function selectedVoyage() {
  profile.selectedVoyageId = sanitizeSelectedVoyage(profile.selectedVoyageId);
  return constellationVoyage(profile.selectedVoyageId);
}

function currentEventState() {
  const event = state.cosmicEvent || currentCosmicEvent();
  profile.eventProgress = sanitizeEventProgressForEvent(profile.eventProgress, event);
  return { event, collection: cosmicEventCollectionProgress(event, profile.eventProgress.words) };
}

function applyAuthoritativeEventPayload(payload, { allowReward = false } = {}) {
  if (isStaticBeta || !payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const rawTime = payload.eventServerTime || payload.serverTime;
  const parsedTime = Date.parse(String(rawTime || ""));
  if (!Number.isFinite(parsedTime)) return null;
  const event = currentCosmicEvent(new Date(parsedTime));
  if (payload.cosmicEvent?.id !== event.id || payload.cosmicEvent?.weekKey !== event.weekKey) return null;
  const previous = sanitizeEventProgressForEvent(profile.eventProgress, event);
  const rawProgress = payload.eventProgress && typeof payload.eventProgress === "object" && !Array.isArray(payload.eventProgress)
    ? payload.eventProgress
    : {};
  const rawReward = payload.eventReward && typeof payload.eventReward === "object" && !Array.isArray(payload.eventReward)
    ? payload.eventReward
    : {};
  const sanitized = sanitizeEventProgressForEvent({
    weekKey: rawProgress.weekKey,
    eventId: rawProgress.eventId,
    words: rawProgress.words,
    rewarded: Boolean(rawProgress.rewarded && rawReward.claimed)
  }, event);
  const before = new Set(previous.words.map(inventoryKey));
  const addedWords = sanitized.words.filter((word) => !before.has(inventoryKey(word)));
  state.cosmicEvent = event;
  state.eventServerTime = new Date(parsedTime).toISOString();
  profile.eventProgress = sanitized;
  let granted = 0;
  if (allowReward && rawReward.granted === true && Number(rawReward.amount) === EVENT_COLLECTION_REWARD && sanitized.rewarded) {
    granted = EVENT_COLLECTION_REWARD;
    state.eventRewardGranted += granted;
    profile.stardust += granted;
  }
  if (granted || JSON.stringify(previous) !== JSON.stringify(sanitized)) {
    saveProfile(granted ? { fields: ["progression", "journeys"] } : { cloud: false });
  }
  return {
    event,
    collection: cosmicEventCollectionProgress(event, sanitized.words),
    progress: sanitized,
    reward: { ...rawReward, granted: Boolean(granted) },
    addedWords
  };
}

async function claimCurrentCosmicEventReward(event = state.cosmicEvent) {
  if (isStaticBeta || !event || !profile.playerId || !profile.playerToken) return null;
  try {
    const claimed = await fetchJson("/api/events/current/claim", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ weekKey: event.weekKey, eventId: event.id })
    });
    return applyAuthoritativeEventPayload(claimed, { allowReward: true });
  } finally {
    // The claim and its cloud currency credit are one server transaction. Even
    // if the success response is lost, a profile refresh recovers the balance.
    scheduleCloudProfileSync({ changed: false, delay: 250 });
  }
}

async function refreshCosmicEventState({ claim = true, silent = true } = {}) {
  if (isStaticBeta || !profile.playerId || !profile.playerToken) return currentEventState();
  try {
    const payload = await fetchJson("/api/events/current", { headers: authHeaders() });
    let applied = applyAuthoritativeEventPayload(payload);
    if (claim && applied?.reward?.claimable) applied = await claimCurrentCosmicEventReward(applied.event) || applied;
    setupJourneyState();
    return applied;
  } catch (error) {
    if (!silent) showToast(error.message || "The Cosmic Event could not refresh.");
    return null;
  }
}

function eventTargetFor(event, collection) {
  const found = new Set(collection.found.map((word) => inventoryKey(word)));
  const curated = cosmicEventTargets(event).find((target) => !found.has(inventoryKey(target.word)));
  if (curated) return curated;
  const missingWord = collection.missing[0];
  if (!missingWord) return null;
  const known = MASTERY_CATALOG.find((item) => inventoryKey(item.word) === inventoryKey(missingWord));
  return {
    word: missingWord,
    emoji: known?.emoji || event.icon || "✦",
    clue: `Trace a logical route to ${missingWord} and add it to ${event.collection.name}.`,
    tier: 3
  };
}

function eventTargetDefinition(event, word) {
  const curated = cosmicEventTargets(event).find((target) => inventoryKey(target.word) === inventoryKey(word));
  if (curated) return curated;
  const canonical = event.collection.words.find((entry) => inventoryKey(entry) === inventoryKey(word));
  if (!canonical) return null;
  const known = MASTERY_CATALOG.find((item) => inventoryKey(item.word) === inventoryKey(canonical));
  return { word: canonical, emoji: known?.emoji || event.icon || "✦", clue: `Trace a logical route to ${canonical} for ${event.collection.name}.`, tier: 3 };
}

function setupJourneyState() {
  profile.voyageProgress = sanitizeVoyageProgress(profile.voyageProgress);
  const voyage = selectedVoyage();
  const voyageState = voyageProgress(voyage.id, profile.voyageProgress);
  $("#voyageHomeTitle").textContent = voyage.title;
  $("#voyageHomeStory").textContent = voyage.summary;
  $("#voyageHomeProgress").textContent = `${voyageState.completed} / ${voyageState.total}`;
  $("#voyageHomeProgressBar").style.width = `${voyageState.percent}%`;

  const { event, collection } = currentEventState();
  $("#eventHomeIcon").textContent = event.icon;
  $("#eventHomeTitle").textContent = event.name;
  $("#eventHomeStory").textContent = event.description;
  $("#eventHomeProgress").textContent = `${collection.discovered} / ${collection.total}`;
  const days = Math.max(1, Math.ceil((Date.parse(event.endsAt) - Date.now()) / 86_400_000));
  $("#eventHomeCountdown").textContent = `${days} DAY${days === 1 ? "" : "S"} LEFT`;
  return { voyage, voyageState, event, collection };
}

function selectJourneyTab(view = "voyage") {
  const eventView = view === "event";
  state.journeyView = eventView ? "event" : "voyage";
  $("#voyageJourneyTab").setAttribute("aria-selected", String(!eventView));
  $("#eventJourneyTab").setAttribute("aria-selected", String(eventView));
  $("#voyageJourneyTab").tabIndex = eventView ? -1 : 0;
  $("#eventJourneyTab").tabIndex = eventView ? 0 : -1;
  $("#voyageJourneyPanel").hidden = eventView;
  $("#eventJourneyPanel").hidden = !eventView;
}

function renderJourneyHub(view = state.journeyView) {
  const { voyage, voyageState, event, collection } = setupJourneyState();
  $("#voyageDialogIcon").textContent = voyage.icon;
  $("#voyageDialogChapter").textContent = `VOYAGE · ${voyageState.complete ? "COMPLETE" : `CHAPTER ${String(voyageState.completed + 1).padStart(2, "0")}`}`;
  $("#voyageDialogTitle").textContent = voyage.title;
  $("#voyageDialogStory").textContent = voyage.summary;
  $("#voyageStageList").replaceChildren(...voyage.chapters.map((chapter, index) => {
    const card = document.createElement("article");
    const complete = index < voyageState.completed;
    const current = index === voyageState.completed;
    card.className = `journey-stage${complete ? " complete" : current ? " current" : " locked"}`;
    card.innerHTML = `<span aria-hidden="true">${complete ? "✓" : String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(chapter.emoji)} ${escapeHtml(chapter.title)}</strong><small>${escapeHtml(chapter.story)}</small></div><b>${complete ? "FOUND" : current ? escapeHtml(chapter.target) : "LOCKED"}</b>`;
    return card;
  }));
  $("#voyageDialogStatus").textContent = voyageState.complete
    ? `${voyage.title} is complete. Choose another Voyage to keep tracing the campaign.`
    : `Next destination: ${voyageState.currentStage.target}. Voyage laws change presentation only; every recipe remains canonical.`;
  $("#startVoyageStage").disabled = voyageState.complete;
  $("#startVoyageStage span").textContent = voyageState.complete ? "Voyage complete" : `Find ${voyageState.currentStage.target}`;

  $("#eventDialogIcon").textContent = event.icon;
  $("#eventDialogDates").textContent = `${event.weekKey} · ENDS ${new Date(event.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase()}`;
  $("#eventDialogTitle").textContent = event.name;
  $("#eventDialogStory").textContent = event.description;
  $("#eventModifierTitle").textContent = event.law.name;
  $("#eventModifierDescription").textContent = `${event.law.description} Recipes, score rules, and ranked results remain unchanged.`;
  $("#eventCollectionProgress").textContent = `${collection.discovered} / ${collection.total}`;
  const found = new Set(collection.found.map((word) => inventoryKey(word)));
  $("#eventCollectionList").replaceChildren(...event.collection.words.map((word) => {
    const card = document.createElement("article");
    const collected = found.has(inventoryKey(word));
    const target = cosmicEventTargets(event).find((item) => inventoryKey(item.word) === inventoryKey(word));
    card.className = `event-collectible${collected ? " collected" : ""}`;
    card.innerHTML = `<span aria-hidden="true">${collected ? escapeHtml(target?.emoji || event.icon) : "◇"}</span><strong>${collected ? escapeHtml(word) : "Unknown"}</strong>`;
    card.setAttribute("aria-label", collected ? `${word} collected` : "Undiscovered event word");
    return card;
  }));
  const target = eventTargetFor(event, collection);
  $("#eventDialogStatus").textContent = collection.complete
    ? `${event.collection.name} is complete${profile.eventProgress.rewarded ? ". The collection reward was claimed." : ". Make one more Pure event discovery to claim its reward."}`
    : `${event.collection.name}: ${collection.discovered} of ${collection.total} found during this event.`;
  $("#startEventTarget").disabled = !target;
  $("#startEventTarget span").textContent = target ? `Find ${target.word}` : "Event mapped";
  selectJourneyTab(view);
}

function openJourneyHub(view = "voyage") {
  if (state.startingRun) return showToast("The next orbit is still being mapped.");
  stopTimer();
  renderJourneyHub(view);
  if (!els.journeyDialog.open) els.journeyDialog.showModal();
  track("journey_opened", { kind: view === "event" ? "event" : "voyage" });
}

function chooseNextVoyage() {
  const catalog = constellationVoyageCatalog();
  const index = Math.max(0, catalog.findIndex((voyage) => voyage.id === profile.selectedVoyageId));
  profile.selectedVoyageId = catalog[(index + 1) % catalog.length].id;
  saveProfile({ fields: ["journeys"] });
  renderJourneyHub("voyage");
}

function voyageContext(voyage, stage) {
  if (!voyage || !stage) return null;
  return { kind: "voyage", voyageId: voyage.id, chapterId: stage.id, target: stage.target, title: `${voyage.title} · ${stage.title}`, story: stage.story, icon: stage.emoji, law: voyage.law };
}

function eventContext(event, target) {
  if (!event || !target) return null;
  return { kind: "event", eventId: event.id, weekKey: event.weekKey, target: target.word, title: `${event.name} · ${target.word}`, story: target.clue, icon: target.emoji, law: event.law };
}

function normalizeJourneyContext(raw, game = null) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const target = String(game?.target || raw.target || "").trim();
  if (raw.kind === "voyage") {
    const voyage = constellationVoyage(raw.voyageId);
    const stage = voyage?.chapters.find((chapter) => chapter.id === raw.chapterId && inventoryKey(chapter.target) === inventoryKey(target));
    return stage ? voyageContext(voyage, { ...stage, number: stage.chapter, total: voyage.chapters.length }) : null;
  }
  if (raw.kind === "event") {
    const event = currentEventState().event;
    const selected = event.id === raw.eventId && event.weekKey === raw.weekKey ? eventTargetDefinition(event, target) : null;
    return selected ? eventContext(event, selected) : null;
  }
  return null;
}

async function beginVoyageStage() {
  const voyage = selectedVoyage();
  const stage = currentVoyageStage(voyage.id, profile.voyageProgress);
  if (!stage) return showToast("This Voyage is already complete.");
  if (els.journeyDialog.open) els.journeyDialog.close();
  track("voyage_started", { source: "voyage", collection: voyage.id, stage: stage.number || stage.chapter || 1 });
  await beginMode("reach", { target: stage.target, context: voyageContext(voyage, stage) });
}

async function beginEventTarget() {
  const { event, collection } = currentEventState();
  const target = eventTargetFor(event, collection);
  if (!target) return showToast("This event has no remaining mapped target.");
  if (els.journeyDialog.open) els.journeyDialog.close();
  track("event_started", { source: "event", collection: event.id, progress: collection.discovered });
  await beginMode("reach", { target: target.word, context: eventContext(event, target) });
}

async function recordEventDiscovery(result) {
  if (!isStaticBeta) {
    const applied = applyAuthoritativeEventPayload(result);
    if (!applied) return null;
    let claimed = null;
    if (applied.reward?.claimable) {
      try { claimed = await claimCurrentCosmicEventReward(applied.event); }
      catch { /* The authoritative claim remains available for the reconnect refresh. */ }
    }
    const reward = Number(claimed?.reward?.granted ? claimed.reward.amount : 0) || 0;
    const added = applied.addedWords.some((word) => inventoryKey(word) === inventoryKey(result.word));
    const collection = claimed?.collection || applied.collection;
    if (!added && !reward) return null;
    track("event_discovery", { collection: applied.event.collection.id, progress: collection.discovered, completed: collection.complete });
    return {
      event: applied.event,
      collection,
      reward,
      notice: reward
        ? `${applied.event.collection.name} complete \u00b7 +${reward} Stardust`
        : `${applied.event.presentation.label} \u00b7 ${result.word} joined ${applied.event.collection.name}`
    };
  }
  const { event, collection } = currentEventState();
  const annotation = annotateCosmicEventResult({ event, result });
  if (!annotation.context?.collectionMatch || state.scoringDisabled || state.assist !== "none") return null;
  if (collection.found.some((word) => inventoryKey(word) === inventoryKey(result.word))) return null;
  profile.eventProgress.words = [...collection.found, result.word];
  const updated = cosmicEventCollectionProgress(event, profile.eventProgress.words);
  let reward = 0;
  if (updated.complete && !profile.eventProgress.rewarded) {
    profile.eventProgress.rewarded = true;
    profile.stardust += EVENT_COLLECTION_REWARD;
    reward = EVENT_COLLECTION_REWARD;
    state.eventRewardGranted += reward;
  }
  saveProfile({ fields: ["journeys", ...(reward ? ["progression"] : [])] });
  track("event_discovery", { collection: event.collection.id, progress: updated.discovered, completed: updated.complete });
  return { event, collection: updated, reward, notice: reward ? `${event.collection.name} complete · +${reward} Stardust` : `${event.presentation.label} · ${result.word} joined ${event.collection.name}` };
}

function refillDailySense() {
  const result = refillSenseWallet(profile.senseWallet, { date: todayKey, amount: 1, cap: 5 });
  profile.senseWallet = result.wallet;
  return result;
}

function masteryCollections() {
  return buildMasteryCollections({
    recipes: MASTERY_CATALOG,
    history: state.history,
    discovered: profile.discovered,
    state: profile.recipeMastery,
    limitPerCollection: 8
  });
}

function masterySummary() {
  return summarizeMasteryCollections(masteryCollections());
}

function masteryStarsForWord(word) {
  return profile.recipeMastery.recipes.reduce((best, recipe) => recipe.word.toLowerCase() === String(word).toLowerCase() ? Math.max(best, recipe.stars) : best, 0);
}

function senseWordActive(itemOrWord) {
  return state.sense.active && state.sense.words.includes(inventoryKey(itemOrWord));
}

function renderMastery() {
  const collections = masteryCollections();
  const summary = summarizeMasteryCollections(collections);
  const lifetime = lifetimeMasteryProgress(profile.recipeMastery);
  $("#masteryStars").textContent = summary.stars;
  $("#masteryCollections").textContent = summary.completedCollections;
  $("#profileMasteryStars").textContent = lifetime.stars;
  $("#masteryLifetimeTitle").textContent = lifetime.title;
  $("#masteryLifetimeRecipes").textContent = lifetime.recipes;
  $("#masteryLifetimeProgress").style.width = `${lifetime.progress}%`;
  $("#masteryLifetimeNext").textContent = lifetime.nextAt
    ? `${lifetime.remaining} recipe star${lifetime.remaining === 1 ? "" : "s"} to the next mastery tier`
    : "Every mapped recipe remains part of your lifetime record.";
  els.masteryCollectionList.replaceChildren(...collections.map((collection) => {
    const card = document.createElement("article");
    card.className = `mastery-card${collection.progress.completed ? " complete" : ""}`;
    const percent = collection.progress.masteryPercent;
    const recipes = collection.entries.map((entry) => {
      if (entry.locked) return `<li class="mastery-recipe locked" aria-label="${escapeHtml(entry.clue)}"><span aria-hidden="true">◇</span><strong>${escapeHtml(entry.silhouette)}</strong><small>UNDISCOVERED</small></li>`;
      const stars = `${"★".repeat(entry.stars)}${"☆".repeat(Math.max(0, entry.maxStars - entry.stars))}`;
      return `<li class="mastery-recipe"><span aria-label="${entry.stars} of ${entry.maxStars} stars">${stars}</span><strong>${escapeHtml(entry.emoji)} ${escapeHtml(entry.word)}</strong><small>${escapeHtml(entry.a)} + ${escapeHtml(entry.b)}</small></li>`;
    }).join("");
    card.innerHTML = `<header class="mastery-card-head"><span class="mastery-card-icon" aria-hidden="true">${escapeHtml(collection.icon)}</span><span><strong>${escapeHtml(collection.title)}</strong><small>${collection.progress.unlocked}/${collection.progress.total} recipes mapped</small></span><b>${collection.progress.stars}/${collection.progress.maxStars} ★</b></header><div class="mastery-track" style="--mastery-progress:${percent}%" aria-label="${percent}% mastery"><i></i></div><ul class="mastery-recipes">${recipes}</ul>`;
    return card;
  }));
  return { collections, summary };
}

function recordMasteryStep(step) {
  const award = recordRecipeDiscovery(profile.recipeMastery, {
    ...step,
    runId: state.run?.id || sessionId,
    assisted: step.progressionEligible === false || state.scoringDisabled || state.assist !== "none",
    revealed: Boolean(step.revealed)
  });
  profile.recipeMastery = award.state;
  if (!award.awardedStar) return award;
  const snapshot = renderMastery();
  const newlyCompleted = snapshot.collections.find((collection) => collection.progress.completed && !profile.masteryCelebrated.includes(collection.id));
  if (newlyCompleted) {
    profile.masteryCelebrated.push(newlyCompleted.id);
    profile.senseWallet = grantSenseCharges(profile.senseWallet, 1).wallet;
    track("sense_earned", { source: "mastery", reward: 1 });
  }
  saveProfile({ fields: ["mastery"] });
  track("mastery_progressed", { stars: award.recipe.stars, completed: Boolean(newlyCompleted) });
  const notice = newlyCompleted
    ? `${newlyCompleted.title} collection complete · +1 Compass charge`
    : `Recipe Mastery · ${award.recipe.word} ${"★".repeat(award.recipe.stars)}${"☆".repeat(3 - award.recipe.stars)}`;
  if (newlyCompleted) {
    track("mastery_completed", { collection: newlyCompleted.id });
  }
  setTimeout(() => playFeedback("mastery", { analytics: true }), 180);
  return { ...award, newlyCompleted, notice };
}

const cosmeticClassNames = COSMETIC_CATALOG.map((item) => `${item.kind}-${item.id}`);

function founderCosmeticsOwned() {
  return Boolean(profile.premium || isStaticBeta);
}

function applyCosmeticLoadout() {
  profile.cosmetics = sanitizeCosmeticLoadout(profile.cosmetics || { theme: profile.theme }, { founder: founderCosmeticsOwned() });
  profile.theme = profile.cosmetics.theme;
  document.body.classList.remove(...cosmeticClassNames);
  document.body.classList.add(...cosmeticClasses(profile.cosmetics, { founder: founderCosmeticsOwned() }));
  document.body.dataset.theme = profile.cosmetics.theme;
}

function renderCosmeticLoadout() {
  const container = $("#cosmeticLoadout");
  if (!container) return;
  const groups = [
    ["board", "Blackboard"],
    ["trail", "Constellation trail"],
    ["sound", "Sound pack"]
  ];
  container.replaceChildren(...groups.map(([kind, label]) => {
    const section = document.createElement("section");
    section.className = "cosmetic-group";
    const heading = document.createElement("strong");
    heading.textContent = label;
    const options = document.createElement("div");
    options.replaceChildren(...cosmeticOptions(kind, { founder: founderCosmeticsOwned() }).map((item) => {
      const button = document.createElement("button");
      const active = profile.cosmetics[kind] === item.id;
      button.type = "button";
      button.className = active ? "active" : "";
      button.setAttribute("aria-pressed", String(active));
      button.innerHTML = `<span>${escapeHtml(item.label)}</span><small>${active ? "ACTIVE" : item.owned ? "OWNED" : "PASS"}</small>`;
      button.addEventListener("click", () => chooseCosmetic(kind, item.id, item.owned));
      return button;
    }));
    section.append(heading, options);
    return section;
  }));
}

function renderPowerups() {
  const activeRun = Boolean(state.game && state.run && !state.finished && !state.startingRun && !state.reveal.active && !state.reveal.pending && !state.busyPairs.size);
  const tipsUsed = clamp(Number(state.powerups?.tipsUsed) || 0, 0, QUICK_TIP_LIMIT);
  const tipsRemaining = QUICK_TIP_LIMIT - tipsUsed;
  const senseCount = sanitizeSenseWallet(profile.senseWallet).charges;
  const giftReady = !state.powerups.giftUsed && !state.powerups.giftUnavailable;
  const armedKind = activeArmedPowerup();
  els.senseButton.disabled = !activeRun;
  els.quickTipCount.textContent = `${tipsRemaining} / ${QUICK_TIP_LIMIT}`;
  els.useQuickTip.disabled = !activeRun || state.powerups.busy || tipsRemaining <= 0;
  els.wordGiftState.textContent = state.powerups.giftUsed ? "USED" : state.powerups.giftUnavailable ? "NO BRIDGE" : "1 READY";
  els.wordGiftCard.classList.toggle("is-used", state.powerups.giftUsed);
  els.wordGiftCard.classList.toggle("is-unavailable", state.powerups.giftUnavailable);
  els.useWordGift.disabled = !activeRun || state.powerups.busy || state.powerups.giftUsed || state.powerups.giftUnavailable;
  $("#useSense").disabled = !activeRun || state.powerups.busy || !senseCount;

  els.quickTipShortcutCount.textContent = String(tipsRemaining);
  els.quickTipShortcut.disabled = !activeRun || state.powerups.busy || tipsRemaining <= 0;
  els.quickTipShortcut.setAttribute("aria-label", `Read a Route Signal; ${tipsRemaining} remaining; score safe`);
  els.quickTipShortcut.title = tipsRemaining ? `Read a Route Signal · ${tipsRemaining} remaining · score safe` : "No Route Signals remain this orbit";
  els.quickTipShortcut.classList.toggle("is-empty", tipsRemaining <= 0);

  els.wordGiftShortcutCount.textContent = armedKind === "gift" ? "!" : state.powerups.giftUsed ? "✓" : giftReady ? "1" : "0";
  els.wordGiftShortcut.disabled = !activeRun || state.powerups.busy || !giftReady;
  els.wordGiftShortcut.setAttribute("aria-label", armedKind === "gift"
    ? "Confirm Word Gift now; this keeps half score in the Open division"
    : state.powerups.giftUsed
    ? "Word Gift used; this orbit keeps half score in Open"
    : state.powerups.giftUnavailable
      ? "Word Gift unavailable for this orbit"
      : "Use Word Gift; 1 ready; keeps half score in the Open division");
  els.wordGiftShortcut.classList.toggle("is-used", state.powerups.giftUsed);
  els.wordGiftShortcut.classList.toggle("is-empty", state.powerups.giftUnavailable);
  els.wordGiftShortcut.classList.toggle("is-armed", armedKind === "gift");
  els.wordGiftShortcut.title = state.powerups.giftUsed
    ? "Word Gift used · Open · 50% score"
    : state.powerups.giftUnavailable
      ? "No undiscovered bridge is available"
      : "Use Word Gift · Open · keep 50% score";

  els.senseShortcutCount.textContent = armedKind === "sense" ? "!" : String(senseCount);
  els.senseShortcut.disabled = !activeRun || state.powerups.busy || !senseCount;
  els.senseShortcut.setAttribute("aria-label", armedKind === "sense"
    ? "Confirm Star Compass now; this keeps 75% score in the Open division"
    : `Use Star Compass; ${senseCount} charge${senseCount === 1 ? "" : "s"}; keeps 75% score in the Open division`);
  els.senseShortcut.classList.toggle("is-empty", senseCount <= 0);
  els.senseShortcut.classList.toggle("is-armed", armedKind === "sense");
  els.senseShortcut.title = senseCount ? `Use Star Compass · ${senseCount} charge${senseCount === 1 ? "" : "s"} · keep 75% score` : "No Star Compass charges remain";
  els.powerupShopShortcut.disabled = !activeRun || state.powerups.busy;
  els.powerupShopShortcut.setAttribute("aria-label", `Open Cosmic Powerups to buy more Star Compass charges; ${senseCount} currently available`);
  const standaloneMode = learningOrbitActive() || state.mode === "explore";
  els.senseHudCount.textContent = state.mode === "explore" ? "OFF" : learningOrbitActive() ? "LESSON" : state.scoringDisabled ? "STUDY" : `${tipsRemaining} SAFE`;
  els.senseButton.setAttribute("aria-label", standaloneMode
    ? `${state.mode === "explore" ? "Guidance is unavailable in persistent Explore" : "This lesson provides its own Route Signal"}`
    : `Open Guidance; ${tipsRemaining} score-safe Route Signal${tipsRemaining === 1 ? "" : "s"} remain`);
}

function activeArmedPowerup() {
  if (!armedPowerupShortcut.kind || armedPowerupShortcut.expiresAt <= Date.now()) {
    clearTimeout(armedPowerupShortcut.timer);
    armedPowerupShortcut = { kind: "", expiresAt: 0, timer: null };
    return "";
  }
  return armedPowerupShortcut.kind;
}

function clearArmedPowerup({ render = true } = {}) {
  clearTimeout(armedPowerupShortcut.timer);
  armedPowerupShortcut = { kind: "", expiresAt: 0, timer: null };
  if (render) renderPowerups();
}

function useWordGiftShortcut() {
  return activateOpenPowerupShortcut("gift", useWordGift);
}

function useSenseShortcut() {
  return activateOpenPowerupShortcut("sense", useConstellationSense);
}

function activateOpenPowerupShortcut(kind, action) {
  if (state.scoringDisabled || activeArmedPowerup() === kind) {
    clearArmedPowerup({ render: false });
    return action();
  }
  clearArmedPowerup({ render: false });
  armedPowerupShortcut = {
    kind,
    expiresAt: Date.now() + 4_000,
    timer: setTimeout(() => clearArmedPowerup(), 4_000)
  };
  renderPowerups();
  const label = kind === "gift" ? "Word Gift" : "Star Compass";
  const policy = assistancePolicy(kind);
  showAlchemy(`TAP AGAIN · ${label} keeps ${Math.round(policy.scoreMultiplier * 100)}% score in Open.`);
  playFeedback("place");
}

function resetPowerupControlLabels() {
  els.useWordGift.querySelector("span").textContent = "Summon gift · keep 50%";
  $("#useSense span").textContent = "Activate compass · keep 75%";
}

function renderProfile() {
  setupWeeklyState();
  setupDailyState();
  setupJourneyState();
  const rank = rankFor();
  const lifetimeMastery = lifetimeMasteryProgress(profile.recipeMastery);
  const weeklyRating = weeklyRatingPresentation({
    stage: profile.weekly.stage,
    complete: profile.weekly.complete,
    dailyStreak: profile.dailyStreak,
    masteryStars: lifetimeMastery.stars
  });
  const badgeProgress = {
    firstOrbit: profile.firstOrbit,
    wins: profile.wins,
    discoveries: profile.discovered.length,
    masteryStars: lifetimeMastery.stars,
    dailyStreak: profile.dailyStreak,
    weekly: profile.weekly
  };
  applyCosmeticLoadout();
  $("#profileLevel").textContent = rank.level;
  $("#profileDust").textContent = profile.stardust;
  $("#universeRank").textContent = rank.name;
  $("#rankProgress").style.width = `${rank.progress}%`;
  $("#lifetimeRankName").textContent = rank.name;
  $("#lifetimePoints").textContent = rank.points.toLocaleString("en-US");
  $("#lifetimeRankProgress").style.width = `${rank.progress}%`;
  $("#lifetimeRankNext").textContent = rank.nextName ? `${rank.remaining.toLocaleString("en-US")} Atlas XP to ${rank.nextName}` : "Atlas XP never decays or gets spent.";
  $("#weeklyRatingSeason").textContent = "WEEKLY MOMENTUM";
  $("#weeklyRatingSeason").title = `${weeklyRating.season} · ${weeklyRating.weekKey}`;
  $("#weeklyRatingName").textContent = weeklyRating.name;
  $("#weeklyRatingValue").textContent = weeklyRating.rating.toLocaleString("en-US");
  $("#weeklyRatingProgress").style.width = `${weeklyRating.progress}%`;
  $("#weeklyRatingNext").textContent = weeklyRating.nextAt
    ? `${weeklyRating.remaining} momentum to ${weeklyRating.name === "Quiet Orbit" ? "Rising Orbit" : "the next orbit"}. Resets weekly.`
    : "Peak weekly orbit. Lifetime rank is safe.";
  $("#totalDiscoveries").textContent = profile.discovered.length;
  $("#dailyStreak").textContent = profile.dailyStreak;
  $("#completedOrbits").textContent = profile.wins;
  $("#profileRankTitle").textContent = rank.name;
  $("#profileTotalDust").textContent = profile.stardust;
  $("#profileWords").textContent = profile.discovered.length;
  $("#profileWins").textContent = profile.wins;
  $("#profileStreak").textContent = profile.dailyStreak;
  $("#profileShield").textContent = profile.streakShields;
  $("#profileCallsign").textContent = profile.callsign || "Offline Stargazer";
  const badges = earnedBadges(badgeProgress);
  $("#profileBadgeSummary").textContent = `${badges.filter((badge) => badge.earned).length} of ${badges.length} earned`;
  $("#badgeShelf").replaceChildren(...badges.map((badge) => {
    const item = document.createElement("article");
    item.className = `badge-chip${badge.earned ? " earned" : ""}`;
    item.setAttribute("aria-label", `${badge.label}: ${badge.earned ? "earned" : badge.description}`);
    item.innerHTML = `<span aria-hidden="true">${escapeHtml(badge.earned ? badge.icon : "◇")}</span><div><strong>${escapeHtml(badge.label)}</strong><small>${escapeHtml(badge.earned ? "EARNED" : badge.description)}</small></div>`;
    return item;
  }));
  document.body.classList.remove("aura-none", "aura-first-light", "aura-nebula", "aura-prism");
  document.body.classList.add(progressionAuraClass(badgeProgress));
  const cloudSection = $("#cloudAccountSection");
  const cloudGroup = $("#cloudProfileGroup");
  if (cloudSection) cloudSection.hidden = isStaticBeta;
  if (cloudGroup) cloudGroup.hidden = isStaticBeta;
  if (!isStaticBeta) {
    $("#cloudPlayerId").textContent = profile.playerId || "Creating…";
    if (!state.cloudReady && !state.cloudSyncing) setCloudStatus(profile.playerId ? "Preparing cloud profile…" : "Connecting…");
    $("#syncCloudProfile").disabled = !profile.playerId || state.cloudSyncing;
    $("#restoreOwnership").disabled = !profile.playerId;
    $("#rotateRecoveryKit").disabled = !profile.playerId;
    $("#rotateRecoveryKit").textContent = state.recoveryKit?.code ? "View unsaved recovery kit" : "Create new recovery kit";
  }
  $("#profileCredits").textContent = profile.credits;
  $("#profileVaultCount").textContent = profile.vault.length;
  $("#profileMasteryStars").textContent = lifetimeMastery.stars;
  profile.firstOrbit = sanitizeFirstOrbitState(profile.firstOrbit);
  $("#trainingReplayStatus").textContent = profile.firstOrbit.completed ? "Completed · replay anytime" : profile.firstOrbit.seen ? "Ready when you are" : "New · about 90 seconds";
  profile.secondOrbit = sanitizeSecondOrbitState(profile.secondOrbit);
  $("#secondOrbitReplayStatus").textContent = profile.secondOrbit.completed
    ? "Completed · replay anytime"
    : profile.firstOrbit.completed
      ? "Ready · about two minutes"
      : "Unlocks after First Orbit";
  $("#replaySecondOrbit").disabled = !profile.firstOrbit.completed && profile.wins === 0;
  const senseCount = sanitizeSenseWallet(profile.senseWallet).charges;
  $("#profileSenseCount").textContent = senseCount;
  $("#senseDialogCount").textContent = senseCount;
  const tipsRemaining = Math.max(0, QUICK_TIP_LIMIT - (Number(state.powerups?.tipsUsed) || 0));
  els.senseHudCount.textContent = `${tipsRemaining} SAFE`;
  $("#senseEarnNote").textContent = "One charge returns each UTC day for every player.";
  els.senseButton.setAttribute("aria-label", `Open Guidance; ${tipsRemaining} score-safe Route Signal${tipsRemaining === 1 ? "" : "s"} remain`);
  $("#buySense").disabled = state.powerups.busy || profile.stardust < 90 || senseCount >= 9;
  renderPowerups();
  const feedbackPreferences = sanitizeFeedbackPreferences(profile.feedbackPreferences);
  profile.feedbackPreferences = feedbackPreferences;
  for (const [id, enabled] of [["soundPreference", feedbackPreferences.sound], ["hapticPreference", feedbackPreferences.haptics]]) {
    const button = document.getElementById(id);
    button.setAttribute("aria-pressed", String(enabled));
    button.querySelector("small").textContent = enabled ? "ON" : "OFF";
  }
  $("#feedbackToggle").setAttribute("aria-pressed", String(feedbackPreferences.sound));
  $("#feedbackToggle").setAttribute("aria-label", feedbackPreferences.sound ? "Mute sound effects" : "Enable sound effects");
  $("#feedbackToggle span").textContent = feedbackPreferences.sound ? "♪" : "×";
  els.rivalGhost.setAttribute("aria-pressed", String(profile.rivalGhostEnabled));
  els.rivalGhost.setAttribute("aria-label", profile.rivalGhostEnabled ? "Hide Rival Ghost pace" : "Show Rival Ghost pace");
  $("#marketBalance").textContent = profile.credits;
  $("#vaultCount").textContent = profile.vault.length;
  $$('button[data-theme]').forEach((button) => {
    const active = button.dataset.theme === profile.cosmetics.theme;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    const item = COSMETIC_CATALOG.find((entry) => entry.kind === "theme" && entry.id === button.dataset.theme);
    button.querySelector("small").textContent = active ? "ACTIVE" : item?.entitlement === "free" || founderCosmeticsOwned() ? "OWNED" : "PASS";
  });
  renderCosmeticLoadout();
  renderMastery();
  syncProgressiveDisclosure();
  updateWishButton();
}

function applyServerPlayer(player) {
  if (!player) return false;
  if (profile.playerId && player.id && profile.playerId !== player.id) return false;
  const founderActivated = Boolean(player.founderPass) && !profile.premium;
  profile.playerId = player.id || profile.playerId;
  profile.callsign = player.callsign || profile.callsign;
  profile.credits = Number(player.credits) || 0;
  profile.vault = Array.isArray(player.vault) ? player.vault : [];
  profile.premium = Boolean(player.founderPass);
  profile.freeWishUsed = Boolean(player.freeWishUsed);
  profile.wishAvailable = player.wishAvailable !== false;
  profile.dailyWishUsedDate = player.dailyWishUsedDate || "";
  if (Number.isInteger(player.cloudProfileVersion)) profile.cloudProfileVersion = Math.max(0, player.cloudProfileVersion);
  saveProfile({ cloud: founderActivated, fields: ["progression"] });
  renderWishVault();
  return true;
}

function authHeaders(extra = {}) {
  return {
    ...extra,
    ...(profile.playerId && profile.playerToken ? {
      "X-Constellore-Player": profile.playerId,
      "X-Constellore-Token": profile.playerToken
    } : {})
  };
}

function normalizePendingRecoveryKit(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const playerId = String(value.playerId || "").trim().slice(0, 80);
  const code = String(value.code || "").trim().slice(0, 80);
  const version = Math.max(1, Math.min(1_000_000, Math.floor(Number(value.version) || 1)));
  return playerId && code ? { playerId, code, version } : null;
}

function rememberPendingRecoveryKit(value) {
  const kit = normalizePendingRecoveryKit(value);
  state.recoveryKit = kit;
  if (isStaticBeta) return kit;
  try {
    if (kit) localStorage.setItem(PENDING_RECOVERY_KIT_KEY, JSON.stringify(kit));
    else localStorage.removeItem(PENDING_RECOVERY_KIT_KEY);
  } catch { /* Private mode can disable storage; the in-memory prompt still works. */ }
  return kit;
}

function restorePendingRecoveryKit(playerId) {
  if (isStaticBeta || !playerId) return null;
  try {
    const kit = normalizePendingRecoveryKit(JSON.parse(localStorage.getItem(PENDING_RECOVERY_KIT_KEY) || "null"));
    return kit?.playerId === playerId ? kit : null;
  } catch { return null; }
}

async function ensurePlayer() {
  if (!state.recoveryKit && profile.playerId) state.recoveryKit = restorePendingRecoveryKit(profile.playerId);
  if (profile.playerId && profile.playerToken) {
    try {
      const { player } = await fetchJson("/api/player", { headers: authHeaders() });
      applyServerPlayer(player);
      return player;
    } catch (error) {
      // Network and server failures must never strand a valid anonymous
      // identity. Replace credentials only when the server explicitly rejects
      // them; otherwise keep the account intact and let boot surface offline.
      if (![401, 404].includes(error.status)) throw error;
    }
  }
  const registration = await fetchJson("/api/player/register", { method: "POST" });
  resetProfileForAccount({ playerId: registration.player.id, playerToken: registration.playerToken });
  applyServerPlayer(registration.player);
  if (registration.recoveryCode) {
    rememberPendingRecoveryKit({
      playerId: registration.player.id,
      code: registration.recoveryCode,
      version: registration.recoveryVersion || 1
    });
  }
  renderDiagnosticsPreference();
  return registration.player;
}

function cloudProfileSnapshot() {
  const cosmetics = sanitizeCosmeticLoadout(profile.cosmetics || { theme: profile.theme }, { founder: founderCosmeticsOwned() });
  const safeDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
  return {
    theme: cosmetics.theme,
    cosmetics,
    firstOrbit: sanitizeFirstOrbitState(profile.firstOrbit),
    rivalGhostEnabled: profile.rivalGhostEnabled !== false,
    feedbackPreferences: sanitizeFeedbackPreferences(profile.feedbackPreferences),
    discovered: [...new Set([...defaultProfile.discovered, ...profile.discovered.map(String)])].slice(0, 1000),
    masteryCelebrated: [...new Set(profile.masteryCelebrated.map(String))].slice(0, 64),
    progression: {
      stardust: Math.min(1_000_000_000, Math.max(0, Math.floor(Number(profile.stardust) || 0))),
      wins: Math.min(1_000_000, Math.max(0, Math.floor(Number(profile.wins) || 0))),
      dailyStreak: Math.min(100_000, Math.max(0, Math.floor(Number(profile.dailyStreak) || 0))),
      lastDailyDate: safeDate(profile.lastDailyDate),
      dailyCompleted: safeDate(profile.dailyCompleted),
      streakShields: Math.min(1_000, Math.max(0, Math.floor(Number(profile.streakShields) || 0))),
      rewardedRunIds: sanitizeRewardedRunIds(profile.rewardedRunIds)
    },
    weekly: { key: String(profile.weekly?.key || ""), stage: Math.min(3, Math.max(0, Math.floor(Number(profile.weekly?.stage) || 0))), complete: Boolean(profile.weekly?.complete) },
    recipeMastery: sanitizeRecipeMasteryState(profile.recipeMastery),
    journeys: {
      selectedVoyageId: sanitizeSelectedVoyage(profile.selectedVoyageId),
      voyageProgress: sanitizeVoyageProgress(profile.voyageProgress),
      eventProgress: sanitizeEventProgress(profile.eventProgress)
    },
    signatureBests: sanitizeSignatureBests(profile.signatureBests).filter((signature) => signature.scoreEligible)
  };
}

function resetProfileForAccount({ playerId = profile.playerId, playerToken = profile.playerToken, preserveServer = false } = {}) {
  const serverState = preserveServer ? {
    callsign: profile.callsign,
    credits: profile.credits,
    vault: [...profile.vault],
    premium: profile.premium,
    freeWishUsed: profile.freeWishUsed,
    wishAvailable: profile.wishAvailable,
    dailyWishUsedDate: profile.dailyWishUsedDate,
    streakShields: profile.streakShields,
    senseWallet: sanitizeSenseWallet(profile.senseWallet),
    senseFounderBonusDate: profile.senseFounderBonusDate
  } : {};
  profile = {
    ...structuredClone(defaultProfile),
    ...serverState,
    playerId: String(playerId || ""),
    playerToken: String(playerToken || "")
  };
}

function mergeCloudProfile(remote, { replace = false, preferLocalSettings = false, preferLocalProgression = false, preferLocalJourneys = false, preferLocalSignatures = false } = {}) {
  if (!remote || typeof remote !== "object" || Array.isArray(remote)) return;
  if (replace) resetProfileForAccount({ preserveServer: true });
  if (Array.isArray(remote.discovered)) {
    profile.discovered = [...new Set([...defaultProfile.discovered, ...(replace ? [] : profile.discovered), ...remote.discovered.map(String)])].slice(0, 1000);
  }
  if (remote.recipeMastery) {
    profile.recipeMastery = sanitizeRecipeMasteryState(replace
      ? remote.recipeMastery
      : { version: 1, recipes: [...sanitizeRecipeMasteryState(profile.recipeMastery).recipes, ...sanitizeRecipeMasteryState(remote.recipeMastery).recipes] });
  }
  if (Array.isArray(remote.masteryCelebrated)) {
    profile.masteryCelebrated = [...new Set([...(replace ? [] : profile.masteryCelebrated), ...remote.masteryCelebrated.map(String)])].slice(0, 64);
  }
  if (remote.progression && typeof remote.progression === "object" && !Array.isArray(remote.progression)) {
    const localRewardedRunIds = sanitizeRewardedRunIds(profile.rewardedRunIds);
    const remoteRewardedRunIds = sanitizeRewardedRunIds(remote.progression.rewardedRunIds);
    Object.assign(profile, reconcileCloudProgression(profile, remote.progression, { replace, preferLocal: preferLocalProgression }));
    profile.rewardedRunIds = replace
      ? remoteRewardedRunIds
      : sanitizeRewardedRunIds([...localRewardedRunIds, ...remoteRewardedRunIds]);
  }
  if (remote.firstOrbit) {
    const incoming = sanitizeFirstOrbitState(remote.firstOrbit);
    const local = sanitizeFirstOrbitState(profile.firstOrbit);
    profile.firstOrbit = replace ? incoming : { seen: local.seen || incoming.seen, completed: local.completed || incoming.completed };
  }
  if (remote.feedbackPreferences && (replace || !preferLocalSettings)) profile.feedbackPreferences = sanitizeFeedbackPreferences(remote.feedbackPreferences);
  if (typeof remote.rivalGhostEnabled === "boolean" && (replace || !preferLocalSettings)) profile.rivalGhostEnabled = remote.rivalGhostEnabled;
  if (remote.weekly?.key === currentWeekKey()) {
    const local = profile.weekly?.key === remote.weekly.key ? profile.weekly : { key: remote.weekly.key, stage: 0, complete: false };
    profile.weekly = replace
      ? { ...remote.weekly }
      : { key: remote.weekly.key, stage: Math.max(Number(local.stage) || 0, Number(remote.weekly.stage) || 0), complete: Boolean(local.complete || remote.weekly.complete) };
  }
  if ((remote.cosmetics || remote.theme) && (replace || !preferLocalSettings)) {
    profile.cosmetics = sanitizeCosmeticLoadout(remote.cosmetics || { theme: remote.theme }, { founder: founderCosmeticsOwned() });
    profile.theme = profile.cosmetics.theme;
  }
  if (remote.journeys && typeof remote.journeys === "object" && !Array.isArray(remote.journeys)) {
    const localVoyages = sanitizeVoyageProgress(profile.voyageProgress);
    const incomingVoyages = sanitizeVoyageProgress(remote.journeys.voyageProgress);
    profile.voyageProgress = replace ? incomingVoyages : sanitizeVoyageProgress({
      voyages: Object.fromEntries(Object.keys(localVoyages.voyages).map((id) => [id, {
        completed: Math.max(localVoyages.voyages[id]?.completed || 0, incomingVoyages.voyages[id]?.completed || 0)
      }]))
    });
    if (replace || !preferLocalJourneys) profile.selectedVoyageId = sanitizeSelectedVoyage(remote.journeys.selectedVoyageId);
    const incomingEvent = sanitizeEventProgress(remote.journeys.eventProgress);
    const localEvent = sanitizeEventProgress(profile.eventProgress);
    // Once the event endpoint has supplied server truth, a lagging cloud
    // snapshot must not replace it during boot, recovery, or claim retry.
    profile.eventProgress = !isStaticBeta && state.cosmicEvent
      ? sanitizeEventProgressForEvent(localEvent, state.cosmicEvent)
      : replace ? incomingEvent : sanitizeEventProgress({
          weekKey: incomingEvent.weekKey,
          eventId: incomingEvent.eventId,
          words: [...localEvent.words, ...incomingEvent.words],
          rewarded: localEvent.rewarded || incomingEvent.rewarded
        });
  }
  if (Array.isArray(remote.signatureBests)) {
    if (replace) profile.signatureBests = sanitizeSignatureBests(remote.signatureBests);
    else {
      const byScope = new Map();
      for (const signature of [...profile.signatureBests, ...remote.signatureBests].map(sanitizeRouteSignature).filter(Boolean)) {
        const previous = byScope.get(signature.scopeKey);
        byScope.set(signature.scopeKey, previous ? comparePersonalBest(signature, previous).best : signature);
      }
      // `byScope` already contains the best candidate across local pending and
      // cloud-verified entries. Prepending the local list here would let the
      // first-wins sanitizer replace a higher remote score with a lower draft.
      profile.signatureBests = sanitizeSignatureBests([...byScope.values()]);
    }
  }
}

function setCloudStatus(message, error = false) {
  const status = $("#cloudSyncStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", error);
}

async function syncCloudProfile({ manual = false, replaceRemote = false } = {}) {
  if (isStaticBeta || !profile.playerId || !profile.playerToken) return null;
  if (state.cloudSyncing) {
    state.cloudDirty = true;
    return null;
  }
  const playerId = profile.playerId;
  const playerToken = profile.playerToken;
  const generation = state.cloudGeneration;
  const revision = state.cloudRevision;
  const controller = new AbortController();
  const sameIdentity = () => generation === state.cloudGeneration && profile.playerId === playerId && profile.playerToken === playerToken;
  const identityHeaders = (extra = {}) => ({
    ...extra,
    "X-Constellore-Player": playerId,
    "X-Constellore-Token": playerToken
  });
  state.cloudSyncing = true;
  state.cloudController = controller;
  state.cloudDirty = false;
  let failed = false;
  if (manual) setCloudStatus("Syncing your universe…");
  try {
    let remote = await fetchJson("/api/player/profile", { headers: identityHeaders(), signal: controller.signal });
    if (!sameIdentity()) return null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const pendingFields = new Set(Array.isArray(profile.cloudPendingFields) ? profile.cloudPendingFields : []);
      const legacyPending = Boolean(profile.cloudPending && pendingFields.size === 0);
      const localSettingsPending = !replaceRemote && Boolean(profile.cloudPending && (legacyPending || pendingFields.has("all") || pendingFields.has("settings")));
      const localProgressionPending = !replaceRemote && Boolean(profile.cloudPending && (legacyPending || pendingFields.has("all") || pendingFields.has("progression")));
      const localJourneysPending = !replaceRemote && Boolean(profile.cloudPending && (legacyPending || pendingFields.has("all") || pendingFields.has("journeys")));
      const localSignaturesPending = !replaceRemote && Boolean(profile.cloudPending && (legacyPending || pendingFields.has("all") || pendingFields.has("signatures")));
      mergeCloudProfile(remote.profile, {
        replace: replaceRemote && attempt === 0,
        preferLocalSettings: localSettingsPending,
        preferLocalProgression: localProgressionPending,
        preferLocalJourneys: localJourneysPending,
        preferLocalSignatures: localSignaturesPending
      });
      if (!sameIdentity()) return null;
      const snapshot = cloudProfileSnapshot();
      if (JSON.stringify(snapshot) === JSON.stringify(remote.profile || {})) {
        profile.cloudProfileVersion = remote.version;
        if (state.cloudRevision === revision) {
          profile.cloudPending = false;
          profile.cloudPendingFields = [];
        }
        saveProfile({ cloud: false });
        setCloudStatus(remote.updatedAt ? "Cloud profile up to date" : "Cloud profile ready");
        if (manual) track("cloud_sync", { changed: false });
        return remote;
      }
      try {
        const updated = await fetchJson("/api/player/profile", {
          method: "PUT",
          headers: identityHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ version: remote.version, profile: snapshot }),
          signal: controller.signal
        });
        if (!sameIdentity()) return null;
        profile.cloudProfileVersion = updated.version;
        if (state.cloudRevision === revision) {
          profile.cloudPending = false;
          profile.cloudPendingFields = [];
        }
        saveProfile({ cloud: false });
        setCloudStatus("Cloud profile synced");
        if (manual) track("cloud_sync", { changed: true });
        return updated;
      } catch (error) {
        if (!sameIdentity()) return null;
        const current = error.code === "cloud_profile_conflict" ? error.payload?.details?.current : null;
        if (!current || attempt === 1) throw error;
        remote = current;
      }
    }
  } catch (error) {
    if (!sameIdentity()) return null;
    failed = true;
    state.cloudDirty = true;
    setCloudStatus(error.message || "Cloud sync unavailable", true);
    if (manual) showToast("Cloud sync could not finish. Your local progress is safe.");
    return null;
  } finally {
    if (generation === state.cloudGeneration && state.cloudController === controller) {
      state.cloudController = null;
      state.cloudSyncing = false;
      const syncButton = $("#syncCloudProfile");
      if (syncButton) syncButton.disabled = !profile.playerId;
      if (!failed && state.cloudDirty && state.cloudReady) {
        clearTimeout(cloudSyncTimer);
        cloudSyncTimer = setTimeout(() => { void syncCloudProfile(); }, 250);
      }
    }
  }
  return null;
}

function scheduleCloudProfileSync({ changed = true, delay = 1800 } = {}) {
  if (isStaticBeta || !profile.playerId || !profile.playerToken) return;
  if (changed) state.cloudRevision += 1;
  state.cloudDirty = true;
  if (!state.cloudReady || state.cloudSyncing) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => { void syncCloudProfile(); }, delay);
}

async function restoreOwnership({ silent = false } = {}) {
  if (isStaticBeta || !profile.playerId || !profile.playerToken) return null;
  const playerId = profile.playerId;
  const playerToken = profile.playerToken;
  const generation = state.cloudGeneration;
  const stillCurrent = () => generation === state.cloudGeneration && profile.playerId === playerId && profile.playerToken === playerToken;
  try {
    await billingAdapter()?.syncEntitlements?.();
    if (!stillCurrent()) return null;
    const result = await fetchJson("/api/player/restore", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Constellore-Player": playerId,
        "X-Constellore-Token": playerToken
      },
      body: "{}"
    });
    if (!stillCurrent()) return null;
    applyServerPlayer(result.player);
    if (!silent) {
      setCloudStatus("Ownership restored from the server");
      showToast("Supporter cosmetics, earned credits, and Vault words restored.");
      track("ownership_restored", { products: result.entitlements?.products?.length || 0, words: result.entitlements?.vault?.length || 0 });
    }
    return result;
  } catch (error) {
    if (!silent) showToast(error.message);
    return null;
  }
}

async function initializeCloudServices() {
  if (isStaticBeta) return;
  await restoreOwnership({ silent: true });
  const synced = await syncCloudProfile();
  state.cloudReady = true;
  if (synced) setCloudStatus("Cloud profile ready");
  if (synced && state.cloudDirty) scheduleCloudProfileSync({ changed: false, delay: 250 });
}

function handleOnline() {
  updateConnection();
  if (!isStaticBeta && profile.playerId && profile.playerToken) void refreshCosmicEventState();
  if (!isStaticBeta && state.cloudReady && profile.playerId && profile.playerToken) scheduleCloudProfileSync({ changed: false, delay: 250 });
  if (!isStaticBeta && profile.playerId && profile.playerToken) void retryPendingScoreUploads().then(announcePendingScoreRecovery);
}

function showRecoveryKit({ force = false } = {}) {
  if (!state.recoveryKit?.code || isStaticBeta) return;
  if (!force && profile.wins < 1) return;
  $("#recoveryPlayerId").textContent = state.recoveryKit.playerId;
  $("#recoveryCode").textContent = state.recoveryKit.code;
  $("#copyRecoveryKit span").textContent = "Copy recovery kit";
  if (els.profileDialog.open) els.profileDialog.close();
  const dialog = $("#recoveryDialog");
  if (!dialog.open) dialog.showModal();
}

async function copyRecoveryKit() {
  if (!state.recoveryKit?.code) return;
  const text = `Constellore Player ID: ${state.recoveryKit.playerId}\nRecovery code: ${state.recoveryKit.code}`;
  try {
    await navigator.clipboard.writeText(text);
    $("#copyRecoveryKit span").textContent = "Recovery kit copied";
  } catch {
    window.prompt("Copy and store this recovery kit safely:", text);
  }
}

function acknowledgeRecoveryKit() {
  rememberPendingRecoveryKit(null);
  $("#recoveryPlayerId").textContent = "Cleared";
  $("#recoveryCode").textContent = "Cleared from this screen";
  $("#recoveryDialog").close();
  renderProfile();
  if (state.pendingMission) {
    $("#missionBriefingStatus").textContent = "";
    requestAnimationFrame(presentMissionBriefing);
  }
}

async function rotateRecoveryKit() {
  if (state.recoveryKit?.code) {
    showRecoveryKit({ force: true });
    return;
  }
  try {
    const result = await fetchJson("/api/player/recovery/rotate", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: "{}"
    });
    rememberPendingRecoveryKit({ playerId: profile.playerId, code: result.recoveryCode, version: result.recoveryVersion });
    track("recovery_rotated", { version: result.recoveryVersion });
    showRecoveryKit({ force: true });
  } catch (error) {
    showToast(error.message);
  }
}

async function recoverAccount(event) {
  event.preventDefault();
  const playerId = $("#recoverPlayerId").value.trim();
  const recoveryCode = $("#recoverCodeInput").value.trim();
  const submit = event.currentTarget.querySelector("button[type=submit]");
  const message = $("#recoverMessage");
  submit.disabled = true;
  message.textContent = "Recovering your universe…";
  try {
    const result = await fetchJson("/api/player/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, recoveryCode })
    });
    state.cloudGeneration += 1;
    state.cloudController?.abort();
    state.cloudController = null;
    state.cloudSyncing = false;
    state.cloudDirty = false;
    clearTimeout(cloudSyncTimer);
    state.cloudReady = false;
    resetProfileForAccount({ playerId: result.player.id, playerToken: result.playerToken });
    clearActiveRunSnapshot();
    applyServerPlayer(result.player);
    rememberPendingRecoveryKit({ playerId: result.player.id, code: result.recoveryCode, version: result.recoveryVersion });
    await restoreOwnership({ silent: true });
    await syncCloudProfile({ replaceRemote: true });
    // Cloud restoration may contain an older event snapshot. Apply server event
    // truth last so account recovery cannot roll progress or reward state back.
    await refreshCosmicEventState();
    const dailySense = refillDailySense();
    if (dailySense.refilled) saveProfile({ cloud: false });
    state.cloudReady = true;
    if (state.cloudDirty) scheduleCloudProfileSync({ changed: false, delay: 250 });
    announcePendingScoreRecovery(await retryPendingScoreUploads());
    message.textContent = "";
    $("#recoverCodeInput").value = "";
    track("account_recovered", { recoveryVersion: result.recoveryVersion });
    showRecoveryKit({ force: true });
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}

async function loadConfig() {
  try {
    config = { ...config, ...(await fetchJson("/api/config")) };
  } catch { /* Offline boot keeps safe defaults. */ }
  $("#founderPrice").textContent = config.founderPrice;
  const checkoutButton = $("#checkoutButton");
  const checkoutLabel = $("#checkoutButton span");
  checkoutButton.disabled = !COMMERCE_LAUNCH_READY;
  if (profile.premium) {
    checkoutLabel.textContent = "Supporter Pack owned";
    checkoutButton.disabled = true;
    $("#billingNote").textContent = "Your lifetime cosmetic collection is active. Competitive rules remain identical for every player.";
  } else if (COMMERCE_LAUNCH_READY && config.testStoreEnabled && !config.billingEnabled && !billingAdapter()) {
    checkoutLabel.textContent = "Unlock test pass";
    $("#billingNote").textContent = "Development store: unlock a server test entitlement. No charge.";
  } else if (!COMMERCE_LAUNCH_READY || (!config.billingEnabled && !billingAdapter())) {
    checkoutLabel.textContent = "Coming after the beta";
    checkoutButton.disabled = true;
    $("#billingNote").textContent = "Purchases are safely disabled during the free beta. No checkout or ads are active.";
  }
  renderCreditPacks();
  $("#rewardWish").hidden = !(COMMERCE_LAUNCH_READY && config.rewardedAdsEnabled && adsAdapter()?.showRewarded);
}

async function fetchJson(url, options = {}, timeout = 20000) {
  if (isStaticBeta) {
    localRuntimePromise ||= import("./local-beta.mjs?v=3.0.0-beta.1");
    const runtime = await localRuntimePromise;
    return runtime.localRequest(url, options);
  }
  const controller = new AbortController();
  const upstreamSignal = options.signal;
  const abortFromUpstream = () => controller.abort();
  if (upstreamSignal?.aborted) controller.abort();
  else upstreamSignal?.addEventListener?.("abort", abortFromUpstream, { once: true });
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || "The cosmos did not answer.");
      error.code = result.code || "request_error";
      error.status = response.status;
      error.payload = result;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The cosmos took too long to answer.");
    throw error;
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener?.("abort", abortFromUpstream);
  }
}

function renderDiagnosticsPreference() {
  const button = $("#diagnosticsPreference");
  if (!button) return;
  button.setAttribute("aria-pressed", String(analyticsPreference));
  button.classList.toggle("active", analyticsPreference);
  button.querySelector("span").textContent = analyticsPreference ? "✦" : "◇";
  button.querySelector("small").textContent = analyticsPreference ? "ON" : "OFF";
}

function toggleDiagnosticsPreference() {
  analyticsPreference = !analyticsPreference;
  try { localStorage.setItem(ANALYTICS_PREFERENCE_KEY, JSON.stringify({ version: 1, enabled: analyticsPreference })); } catch { /* Preference remains active for this session. */ }
  if (analyticsPreference) ensureAnalyticsCohort();
  renderDiagnosticsPreference();
  showToast(analyticsPreference ? "Optional diagnostics enabled. Thank you for helping tune the cosmos." : "Optional diagnostics turned off.", { scope: "global" });
}

function exportDiagnostics() {
  let localCounts = null;
  if (isStaticBeta) {
    try { localCounts = JSON.parse(localStorage.getItem(LOCAL_ANALYTICS_KEY) || "null")?.counts || {}; }
    catch { localCounts = {}; }
  }
  downloadJson(`constellore-diagnostics-settings-${todayKey}.json`, {
    version: 1,
    exportedAt: new Date().toISOString(),
    optionalDiagnosticsEnabled: analyticsPreference,
    cohortId: analyticsPreference ? ensureAnalyticsCohort() : null,
    localCounts
  });
}

function resetAnalyticsIdentity() {
  try { localStorage.removeItem(ANALYTICS_COHORT_KEY); } catch { /* In-memory reset still applies. */ }
  analyticsCohortId = "";
  if (analyticsPreference) ensureAnalyticsCohort();
  showToast("Analytics ID reset. Past aggregate counts cannot be linked to this device again.", { scope: "global" });
}

function boundedAnalyticsProperties(properties) {
  const output = {};
  for (const [key, value] of Object.entries(properties && typeof properties === "object" ? properties : {}).slice(0, 16)) {
    if (!ANALYTICS_DIMENSIONS.has(key)) continue;
    if (typeof value === "boolean") output[key] = value;
    else if (Number.isFinite(Number(value)) && value !== "") output[key] = clamp(Math.round(Number(value)), -1_000_000, 1_000_000);
    else if (typeof value === "string" && /^[a-z0-9 _.-]{1,32}$/i.test(value)) output[key] = value.toLowerCase();
  }
  return output;
}

function track(name, properties = {}) {
  if (!analyticsPreference) return;
  const event = String(name || "").toLowerCase();
  if (!/^[a-z][a-z0-9_]{0,47}$/.test(event)) return;
  if (isStaticBeta) {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_ANALYTICS_KEY) || "null");
      const counts = parsed?.counts && typeof parsed.counts === "object" && !Array.isArray(parsed.counts) ? parsed.counts : {};
      const bounded = Object.fromEntries(Object.entries(counts)
        .filter(([key, value]) => /^[a-z][a-z0-9_]{0,47}$/.test(key) && Number.isFinite(Number(value)))
        .slice(0, 79)
        .map(([key, value]) => [key, Math.min(1_000_000, Math.max(0, Math.floor(Number(value))))]));
      bounded[event] = Math.min(1_000_000, (bounded[event] || 0) + 1);
      localStorage.setItem(LOCAL_ANALYTICS_KEY, JSON.stringify({ version: 1, counts: bounded }));
    } catch { /* Local diagnostics are optional and never interrupt play. */ }
    return;
  }
  const analyticsUrl = new URL("/api/analytics", location.origin);
  if (analyticsUrl.origin !== location.origin) return;
  const body = JSON.stringify({ name: event, sessionId, cohortId: ensureAnalyticsCohort(), properties: boundedAnalyticsProperties(properties) });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon(analyticsUrl, new Blob([body], { type: "application/json" }));
    else fetch(analyticsUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => {});
  } catch { /* Analytics must never interrupt play. */ }
}

let feedbackAudioContext = null;

function primeFeedbackAudio() {
  const preferences = sanitizeFeedbackPreferences(profile.feedbackPreferences);
  if (!preferences.sound) return null;
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    feedbackAudioContext ||= new AudioContextClass();
    if (feedbackAudioContext.state === "suspended") feedbackAudioContext.resume().catch(() => {});
    return feedbackAudioContext;
  } catch {
    return null;
  }
}

function playFeedback(cue, { analytics = false } = {}) {
  const context = primeFeedbackAudio();
  const policy = feedbackCuePolicy(cue, profile.feedbackPreferences, {
    audioAvailable: Boolean(context),
    hapticsAvailable: typeof navigator.vibrate === "function",
    documentHidden: document.hidden,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches
  });
  const audio = transformFeedbackAudio(policy.audio, profile.cosmetics?.sound || "cosmic");
  if (audio && context) {
    const start = context.currentTime + .005;
    const slice = Math.max(.025, audio.duration / 1000 / audio.tones.length);
    audio.tones.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + slice * index;
      oscillator.type = audio.wave;
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(audio.gain, at + Math.min(.018, slice / 3));
      gain.gain.exponentialRampToValueAtTime(.0001, at + slice);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + slice + .01);
    });
  }
  if (policy.haptic) {
    try { navigator.vibrate(policy.haptic); } catch { /* Haptics are optional. */ }
  }
  if (analytics && (audio || policy.haptic)) {
    const kind = cue === "reject" ? "rejection" : cue === "twist" ? "twist" : cue === "target" ? "target" : cue === "mastery" ? "discovery" : cue === "place" || cue === "sense" || cue === "ghostPass" ? "ui" : "fusion";
    track("fusion_feedback_played", { kind });
  }
}

function toggleFeedbackPreference(kind) {
  const preferences = sanitizeFeedbackPreferences(profile.feedbackPreferences);
  if (kind === "sound") preferences.sound = !preferences.sound;
  if (kind === "haptics") preferences.haptics = !preferences.haptics;
  profile.feedbackPreferences = preferences;
  saveProfile({ fields: ["settings"] });
  track(kind === "sound" ? "audio_toggled" : "haptic_toggled", { enabled: preferences[kind] });
  if (kind === "sound" && preferences.sound) playFeedback("place");
  else if (kind === "haptics" && preferences.haptics) playFeedback("place");
}

function firstOrbitActive() {
  return Boolean(state.game && state.mode === "training");
}

function secondOrbitActive() {
  return Boolean(state.game && state.mode === "second-orbit");
}

function learningOrbitActive() {
  return firstOrbitActive() || secondOrbitActive();
}

function firstOrbitWordActive(itemOrWord) {
  if (!learningOrbitActive() || state.finished) return false;
  const key = inventoryKey(itemOrWord);
  const progress = secondOrbitActive() ? secondOrbitProgress(state.history) : firstOrbitProgress(state.history);
  return progress.spotlightWords.some((word) => inventoryKey(word) === key);
}

function syncFirstOrbitGuide() {
  const active = learningOrbitActive() && !state.finished;
  els.gameScreen.classList.toggle("training-orbit", firstOrbitActive());
  els.gameScreen.classList.toggle("second-orbit", secondOrbitActive());
  els.firstOrbitGuide.hidden = !active;
  if (!active) return;
  const second = secondOrbitActive();
  const progress = second ? secondOrbitProgress(state.history) : firstOrbitProgress(state.history);
  const step = progress.step;
  if (!step) return;
  $("#orbitLessonLabel").innerHTML = second
    ? '<i aria-hidden="true">◇</i> SECOND ORBIT · 0 SCORE'
    : '<i aria-hidden="true">&#10022;</i> TRAINING ORBIT · 0 SCORE';
  $("#skipFirstOrbit").textContent = second ? "Leave lesson" : "Skip training";
  $("#firstOrbitStep").textContent = `STEP ${progress.index + 1} OF ${progress.total}`;
  $("#firstOrbitGuideTitle").textContent = step.title;
  $("#firstOrbitInstruction").textContent = step.instruction;
  $("#firstOrbitTip").textContent = step.tip;
  $("#firstOrbitProgressBar").style.width = `${progress.percent}%`;
  const progressBar = els.firstOrbitGuide.querySelector("[role='progressbar']");
  progressBar.setAttribute("aria-label", `${second ? "Second" : "First"} Orbit lesson progress`);
  progressBar.setAttribute("aria-valuemax", String(progress.total));
  progressBar.setAttribute("aria-valuenow", String(progress.index));
  for (const button of els.wordList.querySelectorAll(".inventory-word")) {
    const highlighted = firstOrbitWordActive(button.dataset.word);
    button.classList.toggle("tutorial-hot", highlighted);
    if (highlighted) button.setAttribute("aria-describedby", "firstOrbitInstruction");
    else button.removeAttribute("aria-describedby");
  }
  for (const button of els.boardItems.querySelectorAll(".board-word")) {
    const node = state.nodes.find((entry) => String(entry.id) === button.dataset.id);
    const highlighted = firstOrbitWordActive(node?.item);
    button.classList.toggle("tutorial-hot", highlighted);
    if (highlighted) button.setAttribute("aria-describedby", "firstOrbitInstruction");
    else button.removeAttribute("aria-describedby");
  }
}

function rememberFirstOrbitSeen() {
  profile.firstOrbit = { ...sanitizeFirstOrbitState(profile.firstOrbit), seen: true };
  saveProfile({ fields: ["firstOrbit"] });
}

function firstOrbitGame() {
  return {
    mode: "training",
    modeName: "First Orbit · Training",
    target: "Wall",
    emoji: "🧱",
    starters: ["Earth", "Water", "Fire", "Air"],
    seed: 101,
    tier: 1,
    timeLimit: null,
    moveLimit: null,
    law: null,
    aiEnabled: false,
    universe: selectUniverse(101),
    scoreEligible: false,
    rewardEligible: false,
    ranked: false,
    training: true
  };
}

function secondOrbitGame() {
  return {
    mode: "second-orbit",
    modeName: "Second Orbit · Lesson",
    target: "Mountain",
    emoji: "⛰️",
    starters: ["Earth", "Water", "Fire", "Air"],
    seed: 202,
    tier: 1,
    timeLimit: null,
    moveLimit: null,
    law: null,
    aiEnabled: false,
    universe: selectUniverse(202),
    scoreEligible: false,
    rewardEligible: false,
    leaderboardEligible: false,
    ranked: false,
    training: true
  };
}

function startFirstOrbit() {
  if (state.startingRun) return;
  rememberFirstOrbitSeen();
  if (els.profileDialog.open) els.profileDialog.close();
  const startedAt = new Date().toISOString();
  track("first_orbit_started", { replay: Boolean(profile.firstOrbit.completed) });
  startWithGame(firstOrbitGame(), {
    id: `training-${sessionId}-${Date.now()}`,
    token: "local-training",
    ranked: false,
    localOnly: true,
    startedAt,
    deadlineAt: null,
    assist: "training",
    assisted: true,
    scoreEligible: false,
    rewardEligible: false,
    leaderboardEligible: false
  });
  syncFirstOrbitGuide();
  requestAnimationFrame(() => els.wordList.querySelector(".inventory-word.tutorial-hot")?.focus({ preventScroll: true }));
}

function startSecondOrbit() {
  if (state.startingRun || (!profile.firstOrbit.completed && profile.wins === 0)) return;
  profile.secondOrbit = { ...sanitizeSecondOrbitState(profile.secondOrbit), seen: true };
  saveProfile({ cloud: false });
  if (els.profileDialog.open) els.profileDialog.close();
  track("second_orbit_started", { replay: Boolean(profile.secondOrbit.completed) });
  startWithGame(secondOrbitGame(), null);
  syncFirstOrbitGuide();
  requestAnimationFrame(() => els.wordList.querySelector(".inventory-word.tutorial-hot")?.focus({ preventScroll: true }));
}

function openFirstOrbitBriefing(trigger = null) {
  openMissionBriefing(firstOrbitGame(), { mode: "training", training: true }, trigger);
  if (state.pendingMission) state.pendingMission.training = true;
}

function openSecondOrbitBriefing(trigger = null) {
  openMissionBriefing(secondOrbitGame(), { mode: "second-orbit", localLesson: true }, trigger);
  if (state.pendingMission) state.pendingMission.secondOrbit = true;
}

function startExplore() {
  if (state.startingRun) return;
  const game = exploreGame(Math.floor(Math.random() * 1_000_000));
  game.universe = selectUniverse(game.seed);
  track("explore_started", { discoveries: profile.discovered.length });
  startWithGame(game, null);
}

function openExploreBriefing(trigger = null) {
  const game = exploreGame(Math.floor(Math.random() * 1_000_000));
  game.universe = selectUniverse(game.seed);
  openMissionBriefing(game, { mode: "explore", localSandbox: true }, trigger);
  if (state.pendingMission) state.pendingMission.explore = true;
}

function skipFirstOrbit() {
  if (secondOrbitActive()) {
    returnHome();
    showToast("Second Orbit paused · replay it anytime from your profile.");
    return;
  }
  if (!firstOrbitActive()) return;
  rememberFirstOrbitSeen();
  returnHome();
  showToast("Training skipped · replay it anytime from your profile.");
}

function presentMissionBriefing() {
  const pending = state.pendingMission;
  if (!pending || $("#recoveryDialog").open || els.missionBriefingDialog.open) return;
  els.missionBriefingDialog.scrollTop = 0;
  $("#missionBriefingScroll").scrollTop = 0;
  els.missionBriefingDialog.showModal();
  requestAnimationFrame(() => $("#beginMission").focus({ preventScroll: true }));
  track("mission_briefing_viewed", { mode: pending.game.mode, target: pending.game.target, ranked: Boolean(pending.game.leaderboardEligible) });
}

function openMissionBriefing(game, request, trigger = null, context = null) {
  const briefing = buildMissionBriefing(game, { localOnly: isStaticBeta });
  const journeyContext = normalizeJourneyContext(context, game);
  const journeyKindLabel = journeyContext?.kind === "event" ? "COSMIC EVENT" : journeyContext?.kind === "voyage" ? "VOYAGE" : "";
  const journeyClue = journeyContext?.kind === "event"
    ? "A game-curated destination from this week's Cosmic Event."
    : journeyContext?.kind === "voyage"
      ? "A game-curated destination from your active Constellation Voyage."
      : "";
  state.pendingMission = { game, request: { ...request }, trigger, context: journeyContext, returnToModes: !els.gameScreen.hidden };
  $("#missionBriefingMode").textContent = journeyKindLabel ? `${journeyKindLabel} \u00b7 MISSION BRIEF` : briefing.modeLabel;
  $("#missionBriefingEmoji").textContent = briefing.emoji;
  $("#missionBriefingTarget").textContent = briefing.target;
  $("#missionBriefingClue").textContent = journeyClue || game.clue || "A destination waits at the edge of this constellation.";
  $("#missionBriefingRule").textContent = briefing.instruction;
  $("#missionBriefingLimit").textContent = briefing.limitValue;
  $("#missionBriefingLimitDetail").textContent = briefing.limitDetail;
  $("#missionBriefingReward").textContent = briefing.rewardValue;
  $("#missionBriefingRewardDetail").textContent = briefing.rewardDetail;
  $("#missionBriefingScoreLabel").textContent = briefing.scoringLabel;
  $("#missionBriefingScore").textContent = briefing.scoringValue;
  $("#missionBriefingScoreDetail").textContent = briefing.scoringDetail;
  const division = $("#missionBriefingDivision");
  division.className = `mission-division ${briefing.division.id}`;
  $("#missionBriefingDivisionLabel").textContent = briefing.division.label;
  $("#missionBriefingDivisionTitle").textContent = briefing.division.title;
  $("#missionBriefingDivisionDetail").textContent = briefing.division.detail;
  $("#missionBriefingLimitSummary").textContent = `${briefing.limitValue} · ${briefing.division.label}`;
  $("#missionBriefingInteraction").textContent = briefing.interactionRule;
  $("#missionBriefingModeRule").textContent = briefing.modeRule;
  $("#missionBriefingFairness").textContent = briefing.fairnessNote;
  $("#missionJourneyContext").hidden = !journeyContext;
  $("#missionJourneyType").textContent = journeyContext?.kind === "event" ? "COSMIC EVENT TARGET" : "VOYAGE STAGE";
  $("#missionJourneyTitle").textContent = journeyContext?.title || "";
  $("#missionJourneyStory").textContent = journeyContext?.story || "";
  const law = game.law;
  $("#missionBriefingLaw").hidden = !law;
  $("#missionBriefingLawName").textContent = law?.name || "";
  $("#missionBriefingLawDescription").textContent = law?.description || "";
  const status = $("#missionBriefingStatus");
  status.textContent = "";
  status.classList.remove("error");
  $("#beginMission").disabled = false;
  $("#cancelMission").disabled = false;
  $("#beginMission span").textContent = `Start toward ${briefing.target}`;
  els.missionBriefingDialog.scrollTop = 0;
  $("#missionBriefingScroll").scrollTop = 0;
  presentMissionBriefing();
}

function cancelMissionBriefing() {
  if (state.startingRun || !state.pendingMission) return;
  const pending = state.pendingMission;
  state.pendingMission = null;
  if (els.missionBriefingDialog.open) els.missionBriefingDialog.close("cancel");
  track("mission_briefing_dismissed", { mode: pending.game.mode, target: pending.game.target });
  if (pending.returnToModes) returnHome();
  else requestAnimationFrame(() => pending.trigger?.focus?.({ preventScroll: true }));
}

async function createRun(request) {
  if (!profile.playerId || !profile.playerToken) await ensurePlayer();
  return fetchJson("/api/run/start", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(request)
  });
}

async function requestMissionPreview(request) {
  if (!profile.playerId || !profile.playerToken) await ensurePlayer();
  const preview = await fetchJson("/api/run/preview", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(request)
  });
  applyServerPlayer(preview.player);
  return {
    game: preview.game,
    request: { ...request, previewToken: preview.previewToken }
  };
}

async function rebuildCustomMission(request) {
  const game = await fetchJson("/api/custom-target", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: request.target })
  }, 45000);
  return {
    mode: "reach",
    seed: game.seed,
    target: game.target,
    custom: true
  };
}

async function refreshMissionPreview(pending) {
  const request = { ...pending.request };
  delete request.previewToken;
  try {
    return await requestMissionPreview(request);
  } catch (error) {
    if (!request.custom || error.code !== "target_unavailable") throw error;
    return requestMissionPreview(await rebuildCustomMission(request));
  }
}

async function confirmMissionBriefing() {
  const pending = state.pendingMission;
  if (!pending || state.startingRun) return;
  if (pending.training) {
    state.pendingMission = null;
    if (els.missionBriefingDialog.open) els.missionBriefingDialog.close("start");
    startFirstOrbit();
    return;
  }
  if (pending.secondOrbit) {
    state.pendingMission = null;
    if (els.missionBriefingDialog.open) els.missionBriefingDialog.close("start");
    startSecondOrbit();
    return;
  }
  if (pending.explore) {
    state.pendingMission = null;
    if (els.missionBriefingDialog.open) els.missionBriefingDialog.close("start");
    startExplore();
    return;
  }
  const begin = $("#beginMission");
  const cancel = $("#cancelMission");
  const status = $("#missionBriefingStatus");
  state.startingRun = true;
  begin.disabled = true;
  cancel.disabled = true;
  begin.querySelector("span").textContent = "Opening orbit…";
  status.classList.remove("error");
  status.textContent = "Creating your verified starting point…";
  try {
    if (!profile.playerId || !profile.playerToken) await ensurePlayer();
    const started = await createRun(pending.request);
    applyServerPlayer(started.player);
    state.pendingMission = null;
    if (els.missionBriefingDialog.open) els.missionBriefingDialog.close("start");
    startWithGame(started.game, started.run, { context: pending.context });
  } catch (error) {
    if (error.code === "mission_stale") {
      try {
        status.classList.remove("error");
        status.textContent = "The mission changed while this briefing was open. Refreshing it now...";
        begin.querySelector("span").textContent = "Refreshing mission...";
        const refreshed = await refreshMissionPreview(pending);
        openMissionBriefing(refreshed.game, refreshed.request, pending.trigger, pending.context);
        $("#missionBriefingStatus").textContent = "Mission refreshed. Review the updated details, then begin when ready.";
        return;
      } catch (refreshError) {
        error = refreshError;
      }
    }
    status.classList.add("error");
    status.textContent = error.message;
    begin.disabled = false;
    cancel.disabled = false;
    begin.querySelector("span").textContent = "Try again";
  } finally {
    state.startingRun = false;
    if (state.game) { updateHud(); updateBoardTools(); }
  }
}

async function beginMode(mode, options = {}) {
  if (state.startingRun) return;
  if (mode === "second-orbit") {
    openSecondOrbitBriefing(options.trigger || document.querySelector('[data-mode="second-orbit"]'));
    return;
  }
  if (mode === "explore") {
    openExploreBriefing(options.trigger || document.querySelector('[data-mode="explore"]'));
    return;
  }
  if (mode === "daily" && profile.dailyCompleted === todayKey) return;
  if (mode === "weekly" && profile.weekly.complete) return;
  state.startingRun = true;
  if (state.game) updateHud();
  const button = document.querySelector(`[data-mode="${mode}"]`);
  const trigger = options.trigger || button;
  const label = button?.classList.contains("mode-action") ? button.querySelector("span") : null;
  const original = label?.textContent;
  if (button) button.disabled = true;
  if (label) label.textContent = "Mapping orbit…";
  try {
    const seed = options.seed ?? (mode === "daily" ? Math.floor(Date.now() / 86_400_000) : mode === "weekly" ? currentWeekSeed() : Math.floor(Math.random() * 1_000_000));
    const request = { mode, seed, target: options.target || "", stage: mode === "weekly" ? profile.weekly.stage : undefined };
    if (options.skipBriefing) {
      const started = await createRun(request);
      applyServerPlayer(started.player);
      startWithGame(started.game, started.run, { context: options.context });
    } else {
      const preview = await requestMissionPreview(request);
      openMissionBriefing(preview.game, preview.request, trigger, options.context);
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    state.startingRun = false;
    if (state.game) { updateHud(); updateBoardTools(); }
    if (button) button.disabled = (mode === "daily" && profile.dailyCompleted === todayKey) || (mode === "weekly" && profile.weekly.complete);
    if (label && original) label.textContent = original;
  }
}

async function beginCustomTarget(event) {
  event.preventDefault();
  if (state.startingRun) return;
  const input = $("#customTarget");
  const target = input.value.trim();
  if (!target) return;
  const submit = event.currentTarget.querySelector("button");
  state.startingRun = true;
  submit.disabled = true;
  els.targetMessage.textContent = "Building a guaranteed route…";
  try {
    const game = await fetchJson("/api/custom-target", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target })
    }, 45000);
    const request = { mode: "reach", seed: game.seed, target: game.target, custom: true };
    const preview = await requestMissionPreview(request);
    els.targetMessage.textContent = "";
    openMissionBriefing(preview.game, preview.request, submit);
  } catch (error) {
    els.targetMessage.textContent = error.message;
  } finally {
    state.startingRun = false;
    if (state.game) { updateHud(); updateBoardTools(); }
    submit.disabled = false;
  }
}

function snapshotItem(item) {
  if (!item?.word || item.ghost) return null;
  return {
    word: String(item.word).slice(0, 80),
    emoji: String(item.emoji || "✦").slice(0, 24),
    category: item.category == null ? null : String(item.category).slice(0, 40),
    source: String(item.source || "world").slice(0, 40),
    note: String(item.note || "").slice(0, 180)
  };
}

function buildActiveRunSnapshot({ completed = false } = {}) {
  if (!state.game || !state.run || state.mode === "training" || (state.finished && !completed) || state.reveal.active || state.reveal.pending) return null;
  const boardRect = els.board.getBoundingClientRect();
  const width = Math.max(1, boardRect.width);
  const height = Math.max(1, boardRect.height);
  const bendItem = state.bendItem || state.words.find((item) => ["wish", "market"].includes(item.source));
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    game: structuredClone(state.game),
    journeyContext: state.journeyContext ? structuredClone(state.journeyContext) : null,
    run: {
      id: state.run.id,
      token: state.run.token,
      startedAt: state.run.startedAt,
      deadlineAt: state.run.deadlineAt,
      assist: state.assist,
      scoreEligible: state.run.scoreEligible !== false && !state.scoringDisabled,
      scoreMultiplier: state.scoreMultiplier
    },
    progress: {
      moves: state.moves,
      completed: Boolean(completed),
      submitted: false,
      discovered: state.words.slice(0, 1000).map(snapshotItem).filter(Boolean),
      history: state.history.slice(-500).map((step) => ({ ...step })),
      usedBend: state.wished,
      usedWish: state.wished,
      bendItem: snapshotItem(bendItem),
      tipsUsed: clamp(Number(state.powerups.tipsUsed) || 0, 0, QUICK_TIP_LIMIT),
      tipIds: state.powerups.tipIds.slice(0, QUICK_TIP_LIMIT),
      giftUsed: Boolean(state.powerups.giftUsed),
      giftUnavailable: Boolean(state.powerups.giftUnavailable),
      giftItem: snapshotItem(state.powerups.giftItem),
      assist: state.assist,
      scoringDisabled: state.scoringDisabled,
      scoreMultiplier: state.scoreMultiplier
    },
    visuals: {
      nodes: state.nodes.slice(0, MAX_BOARD_NODES).filter((node) => !node.revealRole && !node.item.ghost).map((node) => ({
        word: node.item.word,
        x: clamp(node.x / width, 0, 1),
        y: clamp(node.y / height, 0, 1),
        z: Number(node.z) || 0,
        cosmicTwist: Boolean(node.cosmicTwist)
      })),
      inventoryQuery: state.inventoryQuery,
      inventoryRecency: [...state.inventoryRecency.entries()].sort((left, right) => right[1] - left[1]).slice(0, 500)
    }
  };
}

function flushRunSave() {
  clearTimeout(runSaveTimer);
  runSaveTimer = null;
  const snapshot = buildActiveRunSnapshot();
  if (!snapshot) return;
  writeActiveRunSnapshot(snapshot);
}

function writeActiveRunSnapshot(snapshot) {
  if (!snapshot?.run?.id || !snapshot?.run?.token) return false;
  try {
    localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(snapshot));
    const confirmed = JSON.parse(localStorage.getItem(ACTIVE_RUN_KEY) || "null");
    return confirmed?.run?.id === snapshot.run.id && confirmed?.run?.token === snapshot.run.token;
  } catch {
    return false;
  }
}

function saveCompletedRunSnapshot() {
  clearTimeout(runSaveTimer);
  runSaveTimer = null;
  const snapshot = buildActiveRunSnapshot({ completed: true });
  if (!snapshot) return { activeSaved: false, pendingSaved: false };
  // The compact, per-run credential is the critical durable copy. Write it
  // before the larger visual snapshot so a nearly-full store preserves score
  // recovery even when it cannot preserve the whole board.
  const pendingSaved = rememberPendingScore(snapshot);
  return {
    activeSaved: writeActiveRunSnapshot(snapshot),
    pendingSaved
  };
}

function scheduleRunSave() {
  clearTimeout(runSaveTimer);
  if (!state.game || !state.run || state.mode === "training" || state.finished || state.reveal.active || state.reveal.pending) return;
  runSaveTimer = setTimeout(flushRunSave, 180);
}

function clearActiveRunSnapshot() {
  clearTimeout(runSaveTimer);
  runSaveTimer = null;
  try { localStorage.removeItem(ACTIVE_RUN_KEY); } catch { /* Storage can be unavailable. */ }
}

function migrateLegacyPendingScores() {
  if (isStaticBeta) return;
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_PENDING_SCORES_KEY) || "[]");
    if (!Array.isArray(parsed) || !parsed.length) return;
    let migrated = true;
    for (const entry of Array.isArray(parsed) ? parsed : []) {
      if (!savePendingScoreRecord(localStorage, entry)) migrated = false;
    }
    if (migrated) localStorage.removeItem(LEGACY_PENDING_SCORES_KEY);
  } catch { /* A blocked legacy store remains available for a later migration attempt. */ }
}

function readPendingScores() {
  if (isStaticBeta) return [];
  migrateLegacyPendingScores();
  return listPendingScoreRecords(localStorage);
}

function rememberPendingScore(snapshot) {
  if (isStaticBeta || !profile.playerId || !snapshot?.run?.id || !snapshot?.run?.token) return false;
  return savePendingScoreRecord(localStorage, {
    version: 1,
    savedAt: snapshot.savedAt,
    playerId: profile.playerId,
    runId: snapshot.run.id,
    runToken: snapshot.run.token,
    mode: snapshot.game?.mode || "",
    target: snapshot.game?.target || ""
  });
}

function markPendingScoreUploaded(playerId, runId) {
  removePendingScoreRecord(localStorage, playerId, runId);
  try {
    const active = JSON.parse(localStorage.getItem(ACTIVE_RUN_KEY) || "null");
    if (active?.run?.id === runId) localStorage.removeItem(ACTIVE_RUN_KEY);
  } catch { /* A malformed active snapshot is handled by normal restore cleanup. */ }
}

async function flushPendingScoreUploads(playerId, playerToken) {
  if (isStaticBeta || !playerId || !playerToken) return { uploaded: 0, discarded: 0 };
  let uploaded = 0;
  let discarded = 0;
  for (const pending of readPendingScores().filter((entry) => entry.playerId === playerId)) {
    try {
      const result = await fetchJson("/api/run/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Constellore-Player": playerId,
          "X-Constellore-Token": playerToken
        },
        body: JSON.stringify({ runId: pending.runId, runToken: pending.runToken })
      });
      if (!result.ranked) {
        markPendingScoreUploaded(playerId, pending.runId);
        discarded += 1;
        continue;
      }
      markPendingScoreUploaded(playerId, pending.runId);
      if (profile.playerId === playerId && profile.playerToken === playerToken) {
        applyServerPlayer(result.player);
        // A recovered upload may finish long after its result screen closed.
        // Persist server truth without attaching it to whichever run is open now.
        adoptVerifiedSignature(result.verifiedSignature || result.placement?.entry?.signature, {
          runId: pending.runId,
          updateCurrent: false
        });
      }
      track("score_upload_recovered", { mode: pending.mode, target: pending.target });
      uploaded += 1;
    } catch (error) {
      if (error.code === "already_submitted") {
        markPendingScoreUploaded(playerId, pending.runId);
        uploaded += 1;
        continue;
      }
      if (["invalid_run", "run_expired", "run_missing", "target_missing", "assisted_run"].includes(error.code)) {
        markPendingScoreUploaded(playerId, pending.runId);
        track("score_upload_expired", { mode: pending.mode, target: pending.target, reason: error.code });
        discarded += 1;
        continue;
      }
      // Keep every ambiguous failure for the next reconnect. Server-side
      // submissions are idempotent, so retrying can never duplicate a score.
      break;
    }
  }
  return { uploaded, discarded };
}

function retryPendingScoreUploads() {
  const playerId = profile.playerId;
  const playerToken = profile.playerToken;
  if (!playerId || !playerToken) return Promise.resolve({ uploaded: 0, discarded: 0 });
  const identity = `${playerId}:${playerToken}`;
  if (pendingScoreRetryPromises.has(identity)) return pendingScoreRetryPromises.get(identity);
  const promise = flushPendingScoreUploads(playerId, playerToken).finally(() => { pendingScoreRetryPromises.delete(identity); });
  pendingScoreRetryPromises.set(identity, promise);
  return promise;
}

function announcePendingScoreRecovery({ uploaded = 0, discarded = 0 } = {}) {
  if (uploaded) showToast(`${uploaded} saved score${uploaded === 1 ? "" : "s"} reached the leaderboard.`);
  else if (discarded) showToast(`${discarded} saved score${discarded === 1 ? "" : "s"} could no longer be verified.`);
}

function readActiveRunSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(ACTIVE_RUN_KEY) || "null");
    const savedAt = Date.parse(snapshot?.savedAt);
    if (snapshot?.version !== 1 || !snapshot?.run?.id || !snapshot?.run?.token || !snapshot?.game || !Number.isFinite(savedAt) || Date.now() - savedAt > 7 * 86400000) {
      if (snapshot) clearActiveRunSnapshot();
      return null;
    }
    return snapshot;
  } catch {
    clearActiveRunSnapshot();
    return null;
  }
}

function decorateRestoredHistory(rawHistory) {
  const event = currentEventState().event;
  return (Array.isArray(rawHistory) ? rawHistory.slice(-500) : []).map((rawStep, index) => {
    const step = rawStep && typeof rawStep === "object" && !Array.isArray(rawStep) ? rawStep : {};
    const a = String(step.a || "").trim().slice(0, 80);
    const b = String(step.b || "").trim().slice(0, 80);
    const word = String(step.word || "").trim().slice(0, 80);
    if (!a || !b || !word) return null;
    const item = state.words.find((entry) => inventoryKey(entry.word) === inventoryKey(word));
    const source = String(step.source || item?.source || "world").slice(0, 40);
    const category = String(step.category || item?.category || "").slice(0, 40);
    const twisted = Boolean(step.twisted);
    const eventAnnotation = annotateCosmicEventResult({ event, result: { word, source } });
    const journeyMatch = Boolean(state.journeyContext && inventoryKey(state.journeyContext.target) === inventoryKey(word));
    const insight = twisted ? null : explainSuccessfulRecipe({
      a,
      b,
      word,
      source,
      ...(categoryForInsightWord(a) ? { categoryA: categoryForInsightWord(a) } : {}),
      ...(categoryForInsightWord(b) ? { categoryB: categoryForInsightWord(b) } : {}),
      ...(insightCategoryFor(category) ? { category: insightCategoryFor(category) } : {})
    });
    return {
      move: Math.max(1, Math.floor(Number(step.move) || index + 1)),
      a,
      b,
      word,
      emoji: String(step.emoji || item?.emoji || "✦").slice(0, 24),
      category,
      note: String(step.note || item?.note || "").slice(0, 180),
      source,
      newDiscovery: step.newDiscovery === true,
      twisted,
      canonicalWord: String(step.canonicalWord || "").slice(0, 80),
      revealed: Boolean(step.revealed),
      feedbackEligible: step.feedbackEligible === true,
      progressionEligible: step.progressionEligible === true,
      eventEligible: step.eventEligible === true,
      insight: insight?.text || "",
      contextual: Boolean(journeyMatch || eventAnnotation.context?.collectionMatch),
      context: journeyMatch ? state.journeyContext.kind : eventAnnotation.context?.collectionMatch ? eventAnnotation.context.eventId : "",
      rarity: twisted ? 90 : eventAnnotation.context?.collectionMatch ? 55 : 0
    };
  }).filter(Boolean);
}

function reconcileRestoredMastery(history) {
  let mastery = profile.recipeMastery;
  let awarded = false;
  for (const step of Array.isArray(history) ? history : []) {
    const result = recordRecipeDiscovery(mastery, {
      ...step,
      runId: state.run?.id || sessionId,
      assisted: step.progressionEligible !== true,
      revealed: Boolean(step.revealed)
    });
    mastery = result.state;
    awarded ||= result.awardedStar;
  }
  if (!awarded) return false;
  profile.recipeMastery = mastery;
  const snapshot = renderMastery();
  for (const collection of snapshot.collections) {
    if (!collection.progress.completed || profile.masteryCelebrated.includes(collection.id)) continue;
    profile.masteryCelebrated.push(collection.id);
    profile.senseWallet = grantSenseCharges(profile.senseWallet, 1).wallet;
  }
  saveProfile({ fields: ["mastery"] });
  return true;
}

function hydrateRestoredRun(payload, snapshot) {
  const progress = payload.progress || {};
  const authoritativeWords = Array.isArray(progress.discovered) ? progress.discovered.map(snapshotItem).filter(Boolean) : [];
  const byWord = new Map(authoritativeWords.map((item) => [inventoryKey(item), item]));
  for (const starter of payload.game.starters || []) {
    const key = inventoryKey(starter);
    if (!byWord.has(key)) byWord.set(key, { word: starter, emoji: starterEmoji[starter] || "✦", category: starterCategory[starter] || null, source: "origin" });
  }
  state.words = [...byWord.values()];
  state.history = decorateRestoredHistory(progress.history);
  state.newDiscoveries = state.history.reduce((total, step) => total + (step.newDiscovery ? 1 : 0), 0);
  reconcileRestoredMastery(state.history);
  state.moves = Math.max(0, Number(progress.moves) || 0);
  state.wished = Boolean(progress.usedBend || progress.usedWish || progress.wished);
  state.bendItem = snapshotItem(progress.bendItem);
  state.assist = payload.run?.assist || progress.assist || "none";
  const matchingSnapshot = snapshot?.run?.id === payload.run?.id ? snapshot.progress || {} : {};
  state.powerups.tipsUsed = clamp(Number(progress.tipsUsed ?? matchingSnapshot.tipsUsed) || 0, 0, QUICK_TIP_LIMIT);
  state.powerups.tipIds = Array.isArray(matchingSnapshot.tipIds) ? [...new Set(matchingSnapshot.tipIds.map((value) => String(value || "").slice(0, 60)).filter(Boolean))].slice(0, QUICK_TIP_LIMIT) : [];
  state.powerups.giftUsed = Boolean(progress.giftUsed || matchingSnapshot.giftUsed || state.assist === "gift");
  state.powerups.giftUnavailable = !state.powerups.giftUsed && Boolean(matchingSnapshot.giftUnavailable);
  state.powerups.giftItem = snapshotItem(progress.giftItem) || snapshotItem(matchingSnapshot.giftItem);
  state.powerups.busy = false;
  clearArmedPowerup({ render: false });
  state.scoringDisabled = payload.run?.scoreEligible === false || payload.game?.scoreEligible === false || Boolean(progress.scoringDisabled);
  state.scoreMultiplier = state.scoringDisabled ? 0 : cappedScoreMultiplier(state.assist, payload.run?.scoreMultiplier, progress.scoreMultiplier);
  const completedAt = Date.parse(progress.completedAt || "");
  if (progress.completed && Number.isFinite(completedAt) && Number.isFinite(state.startedAt)) {
    state.finishedElapsedSeconds = Math.max(1, Math.round((completedAt - state.startedAt) / 1000));
  }
  state.inventoryQuery = String(snapshot?.visuals?.inventoryQuery || "").slice(0, 60);
  state.inventoryRecency = new Map(Array.isArray(snapshot?.visuals?.inventoryRecency)
    ? snapshot.visuals.inventoryRecency.slice(0, 500).filter((entry) => Array.isArray(entry) && typeof entry[0] === "string" && Number.isFinite(Number(entry[1]))).map(([word, clock]) => [word.slice(0, 80), Number(clock)])
    : []);
  state.inventoryClock = Math.max(0, ...state.inventoryRecency.values());
  const boardRect = els.board.getBoundingClientRect();
  state.nodes = [];
  state.nextId = 1;
  state.topZ = 10;
  if (snapshot?.run?.id === payload.run?.id && Array.isArray(snapshot?.visuals?.nodes)) {
    for (const savedNode of snapshot.visuals.nodes.slice(0, MAX_BOARD_NODES)) {
      const item = byWord.get(inventoryKey(savedNode?.word));
      if (!item) continue;
      state.nodes.push({
        id: state.nextId++,
        item,
        x: clamp(Number(savedNode.x) * boardRect.width || 8, 8, Math.max(8, boardRect.width - 155)),
        y: clamp(Number(savedNode.y) * boardRect.height || 8, 8, Math.max(8, boardRect.height - 54)),
        z: ++state.topZ,
        cosmicTwist: Boolean(savedNode.cosmicTwist)
      });
    }
  }
  const restoredWords = state.words.map((item) => item.word);
  const profileSize = profile.discovered.length;
  if (!state.scoringDisabled) profile.discovered = [...new Set([...profile.discovered, ...restoredWords])].slice(0, 1000);
  if (profile.discovered.length !== profileSize) saveProfile({ fields: ["mastery"] });
  renderInventory();
  renderBoard();
  if (boardNodesOverlap()) tidyOrbit({ silent: true });
  renderAtlas();
  updateHud();
  updateMilestone(Boolean(progress.completed));
  scheduleRunSave();
}

async function restoreInterruptedRun(snapshot) {
  if (!snapshot) return false;
  try {
    const payload = await fetchJson("/api/run/resume", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(isStaticBeta
        ? { runId: snapshot.run.id, runToken: snapshot.run.token, snapshot }
        : { runId: snapshot.run.id, runToken: snapshot.run.token })
    });
    applyServerPlayer(payload.player);
    const restoredEvent = applyAuthoritativeEventPayload(payload);
    startWithGame(payload.game, payload.run, { restored: true, context: snapshot.journeyContext });
    hydrateRestoredRun(payload, snapshot);
    if (restoredEvent?.reward?.claimable) {
      try { await claimCurrentCosmicEventReward(restoredEvent.event); }
      catch { /* Reconnect refresh retries the server-side idempotent claim. */ }
    }
    showToast(`Restored your path to ${payload.game.target}.`);
    track("run_restored", { mode: payload.game.mode, target: payload.game.target, moves: state.moves });
    if (payload.progress?.completed) requestAnimationFrame(() => finishGame(true, "", { skipSubmit: Boolean(payload.progress.submitted) }));
    else if (payload.run?.deadlineAt && Date.parse(payload.run.deadlineAt) <= Date.now()) requestAnimationFrame(() => finishGame(false, "Time slipped beyond your orbit."));
    return true;
  } catch (error) {
    if (["invalid_run", "run_expired", "run_missing", "resume_mismatch", "resume_invalid"].includes(error.code) || [401, 404, 409, 410, 422].includes(error.status)) clearActiveRunSnapshot();
    else showToast("Your saved orbit is safe; reconnect to restore it.");
    return false;
  }
}

function missionModeLabel(game) {
  const mode = String(game?.mode || "reach").toLowerCase();
  if (mode === "quick") return "REACH · SPRINT";
  if (mode === "moves") return "REACH · PRECISION";
  if (mode === "training") return "FIRST ORBIT";
  if (mode === "second-orbit") return "SECOND ORBIT";
  if (mode === "explore") return "EXPLORE · SANDBOX";
  return String(game?.modeName || mode || "REACH").toUpperCase();
}

function reusableExploreInventory() {
  const described = profile.discovered.map((word) => {
    if (starterEmoji[word]) return { word, emoji: starterEmoji[word], category: starterCategory[word], source: "origin" };
    const recipe = MASTERY_CATALOG.find((entry) => inventoryKey(entry.word) === inventoryKey(word));
    return recipe
      ? { word: recipe.word, emoji: recipe.emoji, category: recipe.category, source: "universe" }
      : { word, emoji: "✦", category: null, source: "universe" };
  });
  return sanitizeExploreInventory(profile.exploreWords, described);
}

function startWithGame(game, run, { restored = false, context = null } = {}) {
  game.universe ||= selectUniverse(game.seed);
  cancelActiveTrayDrag();
  cancelActiveBoardDrag();
  dismissClearUndo();
  ctrlHover.reset({ abandonPending: true });
  shiftBoard.reset();
  state.orbitGeneration += 1;
  stopTimer();
  resetRevealPlayback();
  clearSenseGlow();
  resetRecipeFeedback();
  resetExpectedPairFeedback();
  [els.missionBriefingDialog, els.pauseDialog, els.journeyDialog, els.revealDialog, els.resultDialog, els.leaderboardDialog, els.shareDialog, els.atlasDialog, els.senseDialog, els.wishDialog, els.paywallDialog, els.exchangeDialog, els.marketBuyDialog]
    .forEach((dialog) => { if (dialog?.open) dialog.close(); });
  state.game = game;
  state.run = run;
  state.pause = { active: false, confirmAction: "" };
  state.journeyContext = normalizeJourneyContext(context, game);
  state.signature = null;
  state.community = null;
  state.eventRewardGranted = 0;
  state.assist = run?.assist || "none";
  state.scoringDisabled = run?.scoreEligible === false || game?.scoreEligible === false;
  state.scoreMultiplier = state.scoringDisabled ? 0 : cappedScoreMultiplier(state.assist, run?.scoreMultiplier, game?.scoreMultiplier);
  state.mode = game.mode;
  state.words = game.mode === "explore"
    ? reusableExploreInventory()
    : game.starters.map((word) => ({ word, emoji: starterEmoji[word] || "✦", category: starterCategory[word], source: "origin" }));
  state.nodes = [];
  state.history = [];
  state.trails = [];
  state.moves = 0;
  state.newDiscoveries = 0;
  state.nextId = 1;
  state.topZ = 10;
  state.busyPairs.clear();
  state.selectedNodeId = null;
  state.inventoryQuery = "";
  state.inventoryClock = 0;
  state.inventoryRecency = new Map();
  state.inventoryFocusWord = "";
  state.finished = false;
  state.scoreSubmission = { runId: "", activeSaved: false, pendingSaved: false, inFlight: false, exitAction: null, exitLabel: "" };
  state.wished = false;
  state.bendItem = null;
  state.rewardedWish = false;
  state.powerups = { tipsUsed: 0, tipIds: [], giftUsed: false, giftUnavailable: false, giftItem: null, busy: false };
  state.expectedPairReports = new Set();
  clearArmedPowerup({ render: false });
  resetPowerupControlLabels();
  state.startedAt = run?.startedAt ? Date.parse(run.startedAt) : Date.now();
  state.finishedElapsedSeconds = 0;
  state.remainingSeconds = run?.deadlineAt ? Math.max(0, Math.ceil((Date.parse(run.deadlineAt) - Date.now()) / 1000)) : game.timeLimit || 0;
  state.resultAction = null;
  state.resultMasteryNotice = "";
  clearGlobalToast();
  clearBoardNotices();
  els.board.classList.remove("reveal-complete");
  els.startScreen.hidden = true;
  els.gameScreen.hidden = false;
  els.gameScreen.classList.toggle("training-orbit", game.mode === "training");
  els.gameScreen.classList.toggle("second-orbit", game.mode === "second-orbit");
  els.gameScreen.classList.toggle("explore-orbit", game.mode === "explore");
  els.gameScreen.classList.toggle("first-ranked-orbit", !["training", "second-orbit", "explore"].includes(game.mode) && profile.wins === 0);
  els.gameScreen.classList.remove("orbit-paused");
  els.board.scrollTop = 0;
  els.board.scrollLeft = 0;
  els.modeName.textContent = missionModeLabel(game);
  els.targetWord.textContent = game.mode === "explore" ? "FREE EXPLORE" : game.target;
  els.universePill.hidden = ["training", "second-orbit"].includes(game.mode);
  els.universePill.textContent = ["training", "second-orbit"].includes(game.mode) ? "" : `${game.universe.icon} ${game.universe.name} · ${game.universe.season.name}`;
  els.universePill.title = ["training", "second-orbit"].includes(game.mode) ? "" : `${game.universe.law.name}: ${game.universe.law.description}`;
  $("#journeyPill").hidden = !state.journeyContext;
  $("#journeyPill").textContent = state.journeyContext
    ? `${state.journeyContext.icon || "✦"} ${state.journeyContext.kind === "event" ? "EVENT" : "VOYAGE"} · ${state.journeyContext.title}`
    : "";
  els.timerHud.hidden = !game.timeLimit;
  els.lawPill.hidden = !game.law && !["training", "second-orbit", "explore"].includes(game.mode);
  els.lawPill.textContent = ["training", "second-orbit"].includes(game.mode)
    ? "0 SCORE · NO REWARDS"
    : game.mode === "explore"
      ? "PERSISTENT · UNRANKED"
      : game.law ? `${game.law.name}: ${game.law.description}` : "";
  renderInventory();
  els.wordList.scrollTop = 0;
  els.wordList.scrollLeft = 0;
  renderBoard();
  renderAtlas();
  updateHud();
  renderPowerups();
  updateMilestone();
  syncFirstOrbitGuide();
  requestAnimationFrame(startCosmos);
  if (competitiveGhostEligible()) void startRivalGhost();
  requestAnimationFrame(() => {
    els.wordList.scrollTop = 0;
    els.wordList.scrollLeft = 0;
  });
  if (game.timeLimit) startTimer();
  scheduleRunSave();
  if (!restored) track("run_started", { mode: game.mode, target: game.target, stage: game.stage ?? null, aiEnabled: game.aiEnabled });
}

function pauseMenuAvailable() {
  const openDialog = document.querySelector("dialog[open]");
  return Boolean(
    state.game
    && !els.gameScreen.hidden
    && !state.finished
    && !state.startingRun
    && !state.reveal.active
    && !state.reveal.pending
    && !state.busyPairs.size
    && !state.powerups.busy
    && !openDialog
  );
}

function resetPauseConfirmation({ focus = false } = {}) {
  const previousAction = state.pause.confirmAction;
  state.pause.confirmAction = "";
  $("#pauseConfirmation").hidden = true;
  $("#pauseRestart").classList.remove("is-confirming");
  $("#pauseExit").classList.remove("is-confirming");
  $("#pauseRestart span").textContent = "Restart this target";
  $("#pauseExit").textContent = "Exit to mode selection";
  if (focus && previousAction) $(previousAction === "restart" ? "#pauseRestart" : "#pauseExit").focus();
}

function confirmPauseAction(action) {
  if (state.pause.confirmAction === action) return true;
  state.pause.confirmAction = action;
  const restart = action === "restart";
  const ranked = Boolean(state.run?.ranked && !state.scoringDisabled);
  $("#pauseConfirmation").hidden = false;
  $("#pauseConfirmationTitle").textContent = restart ? "Restart this target?" : "Leave this orbit?";
  $("#pauseConfirmationText").textContent = restart
    ? `${ranked ? "This starts a fresh verified attempt. " : ""}Your current board, moves, and discoveries from this run will be discarded.`
    : `${ranked ? "This attempt will not post a score. " : ""}Your current board progress will be abandoned.`;
  $("#pauseRestart").classList.toggle("is-confirming", restart);
  $("#pauseExit").classList.toggle("is-confirming", !restart);
  $("#pauseRestart span").textContent = restart ? "Confirm restart" : "Restart this target";
  $("#pauseExit").textContent = restart ? "Exit to mode selection" : "Confirm exit to modes";
  return false;
}

function populatePauseMenu() {
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));
  const timed = Boolean(state.game?.timeLimit);
  const ranked = Boolean(state.run?.ranked && !state.scoringDisabled);
  $("#pauseTitle").textContent = timed ? "Orbit menu open." : "Your constellation is held.";
  $("#pauseTarget").textContent = state.game?.target || "Unknown target";
  $("#pauseMode").textContent = String(state.game?.modeName || state.mode || "ORBIT").toUpperCase();
  $("#pauseMoves").textContent = String(state.moves);
  $("#pauseDiscoveries").textContent = String(state.newDiscoveries);
  $("#pauseClockLabel").textContent = timed ? "TIME LEFT" : "ELAPSED";
  $("#pauseClock").textContent = formatTime(timed ? Math.max(0, state.remainingSeconds) : elapsedSeconds);
  $("#pauseClockMessage").textContent = timed
    ? "This timed mode keeps running against its verified deadline. Resume before the clock expires."
    : ranked
      ? "Your board is locked, but verified score time continues so leaderboard results stay fair."
      : "There is no countdown. Your board and discoveries are safely held until you resume.";
}

function openPauseMenu() {
  if (!pauseMenuAvailable()) {
    if (state.busyPairs.size || state.powerups.busy) showToast("Let the current constellation settle, then open the orbit menu.");
    return false;
  }
  cancelActiveTrayDrag();
  cancelActiveBoardDrag();
  cancelActivePointerGestures();
  cancelTapChain();
  ctrlHover.reset({ abandonPending: true });
  shiftBoard.reset();
  clearArmedPowerup({ render: true });
  flushRunSave();
  stopTimer();
  state.pause.active = true;
  pauseCloseRestoreFocus = true;
  resetPauseConfirmation();
  populatePauseMenu();
  els.gameScreen.classList.add("orbit-paused");
  renderInventory();
  renderBoard();
  els.pauseDialog.showModal();
  requestAnimationFrame(() => $("#resumePausedRun")?.focus({ preventScroll: true }));
  track("run_menu_opened", { mode: state.mode, moves: state.moves });
  return true;
}

function finishPauseClose() {
  const restoreFocus = pauseCloseRestoreFocus;
  const wasActive = state.pause.active;
  state.pause.active = false;
  pauseCloseRestoreFocus = true;
  resetPauseConfirmation();
  els.gameScreen.classList.remove("orbit-paused");
  if (state.game && !state.finished) {
    renderInventory();
    renderBoard();
  }
  if (wasActive) track("run_menu_closed", { mode: state.mode, moves: state.moves });
  if (restoreFocus && state.game && !state.finished) requestAnimationFrame(() => $("#pauseRunButton")?.focus({ preventScroll: true }));
}

function closePauseMenu() {
  if (!state.pause.active && !els.pauseDialog.open) return;
  if (els.pauseDialog.open) els.pauseDialog.close();
  else {
    finishPauseClose();
    setTimeout(resumeTimerIfNeeded, 0);
  }
}

function handlePauseShortcut(event) {
  if (event.key !== "Escape" || event.defaultPrevented || event.repeat) return;
  const target = event.target;
  const editable = target?.matches?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])') || target?.isContentEditable;
  if (editable && target !== els.inventorySearch) return;
  if (target === els.inventorySearch && state.inventoryQuery) return;
  if (target === els.inventorySearch) target.blur();
  if (els.pauseDialog.open) {
    event.preventDefault();
    els.pauseDialog.close();
    return;
  }
  if (state.selectedNodeId != null) return;
  if (!pauseMenuAvailable()) return;
  event.preventDefault();
  openPauseMenu();
}

function returnHome() {
  if (state.startingRun) return showToast("The next orbit is still being mapped.");
  if (pendingScoreBlocksExit()) {
    if (!els.resultDialog.open) els.resultDialog.showModal();
    showToast("Upload or queue this score before starting another orbit.");
    return;
  }
  const showRecoveryAfterExit = Boolean(state.finished && state.recoveryKit?.code && profile.wins > 0);
  pauseCloseRestoreFocus = false;
  cancelActiveTrayDrag();
  cancelActiveBoardDrag();
  dismissClearUndo();
  cancelTapChain();
  ctrlHover.reset({ abandonPending: true });
  shiftBoard.reset();
  state.orbitGeneration += 1;
  if (state.game && !state.finished && state.history.length) track("run_failed", { mode: state.mode, reason: "abandoned", moves: state.moves });
  stopTimer();
  resetRevealPlayback();
  clearBoardNotices();
  clearSenseGlow();
  resetRecipeFeedback();
  resetExpectedPairFeedback();
  stopRivalGhost();
  cancelAnimationFrame(state.cosmosFrame);
  state.cosmosFrame = null;
  state.game = null;
  state.run = null;
  state.pause = { active: false, confirmAction: "" };
  state.journeyContext = null;
  state.signature = null;
  state.community = null;
  state.eventRewardGranted = 0;
  state.pendingMission = null;
  state.nodes = [];
  resetPowerupControlLabels();
  clearActiveRunSnapshot();
  els.gameScreen.classList.remove("training-orbit", "second-orbit", "explore-orbit", "first-ranked-orbit", "orbit-paused");
  els.firstOrbitGuide.hidden = true;
  els.gameScreen.hidden = true;
  els.startScreen.hidden = false;
  [els.missionBriefingDialog, els.pauseDialog, els.journeyDialog, els.resultDialog, els.atlasDialog, els.senseDialog, els.shareDialog, els.wishDialog, els.paywallDialog, els.exchangeDialog, els.marketBuyDialog, els.leaderboardDialog, els.revealDialog].forEach((dialog) => { if (dialog?.open) dialog.close(); });
  renderProfile();
  if (!isStaticBeta && profile.playerId && profile.playerToken) void refreshCosmicEventState();
  window.scrollTo({ top: 0, behavior: "smooth" });
  announceModeScreenViewed();
  requestAnimationFrame(() => {
    $("#primaryOrbitButton")?.focus({ preventScroll: true });
    if (showRecoveryAfterExit) showRecoveryKit();
  });
}

async function beginPrimaryOrbit() {
  if (state.startingRun) return;
  const button = $("#primaryOrbitButton");
  const action = primaryOrbitState().action;
  button.disabled = true;
  try {
    if (action === "training") openFirstOrbitBriefing(button);
    else await beginMode(action, { trigger: button });
  } finally {
    button.disabled = false;
    syncProgressiveDisclosure();
  }
}

function openModePicker() {
  const picker = $("#modePicker");
  if (!picker || picker.closest("[hidden]")) return;
  picker.open = true;
}

async function beginPrimarySecondary() {
  if (state.startingRun) return;
  const button = $("#primaryOrbitSecondary");
  const action = primaryOrbitState().secondaryAction;
  if (action === "modes") return openModePicker();
  if (action === "training") return openFirstOrbitBriefing(button);
  if (action === "reach") {
    rememberFirstOrbitSeen();
    syncProgressiveDisclosure();
    return beginMode("reach", { trigger: button });
  }
}

function openHubMenu() {
  const dialog = $("#hubMenuDialog");
  if (!dialog.open) dialog.showModal();
}

function closeHubMenu() {
  const dialog = $("#hubMenuDialog");
  if (dialog?.open) dialog.close();
}

function pendingScoreBlocksExit() {
  return Boolean(
    state.finished
    && state.run?.ranked
    && !state.run.submitted
    && state.scoreSubmission.runId === state.run.id
    && !state.scoreSubmission.pendingSaved
  );
}

async function retryGame() {
  if (!state.game || state.startingRun) return;
  if (pendingScoreBlocksExit()) {
    showToast("Upload or queue this score before starting another orbit.");
    return;
  }
  const mode = state.game.mode;
  track("run_retried", { mode, target: state.game.target });
  if (mode === "training") {
    startFirstOrbit();
    return;
  }
  if (mode === "second-orbit") {
    startSecondOrbit();
    return;
  }
  if (mode === "explore") {
    startExplore();
    return;
  }
  const options = { seed: state.game.seed, target: ["reach", "challenge"].includes(mode) ? state.game.target : undefined, context: state.journeyContext, skipBriefing: true };
  const resultActions = [els.resultPrimary, els.resultRetry, $("#resultLeaderboard"), els.resultShare, $("#resultReveal")];
  resultActions.forEach((control) => { control.disabled = true; });
  try { await beginMode(mode, options); }
  finally {
    resultActions.forEach((control) => { control.disabled = false; });
  }
}

function startTimer() {
  stopTimer();
  const tick = () => {
    if (state.finished || state.pause.active || state.reveal.active || state.reveal.pending) return;
    state.remainingSeconds = state.run?.deadlineAt
      ? Math.max(0, Math.ceil((Date.parse(state.run.deadlineAt) - Date.now()) / 1000))
      : Math.max(0, Math.ceil((state.startedAt + Number(state.game?.timeLimit || 0) * 1000 - Date.now()) / 1000));
    els.timerValue.textContent = formatTime(Math.max(0, state.remainingSeconds));
    els.timerValue.classList.toggle("urgent", state.remainingSeconds <= 15);
    if (state.remainingSeconds <= 0) finishGame(false, "Time slipped beyond your orbit.");
  };
  tick();
  if (!state.finished) state.timerId = setInterval(tick, 250);
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportLocalDiagnostics() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_ANALYTICS_KEY) || "null") || { version: 1, counts: {} };
    const recipeFeedback = JSON.parse(localStorage.getItem(LOCAL_RECIPE_FEEDBACK_KEY) || "null") || { version: 1, recipes: {} };
    const expectedPairs = JSON.parse(localStorage.getItem(LOCAL_EXPECTED_PAIRS_KEY) || "null") || { version: 1, pairs: {} };
    downloadJson(`constellore-local-events-${todayKey}.json`, {
      version: 1,
      exportedAt: new Date().toISOString(),
      counts: parsed.counts || {},
      recipeFeedback: recipeFeedback.recipes || {},
      expectedPairs: expectedPairs.pairs || {}
    });
  } catch { showToast("Local diagnostics could not be exported.", { scope: "global" }); }
}

function resetLocalDiagnostics() {
  try {
    localStorage.removeItem(LOCAL_ANALYTICS_KEY);
    localStorage.removeItem(LOCAL_RECIPE_FEEDBACK_KEY);
    localStorage.removeItem(LOCAL_EXPECTED_PAIRS_KEY);
  } catch { /* Storage can be unavailable. */ }
  showToast("Local diagnostics reset.", { scope: "global" });
}

function exportLocalPractice() {
  const snapshot = structuredClone(profile);
  delete snapshot.playerToken;
  delete snapshot.cloudPending;
  delete snapshot.cloudPendingFields;
  downloadJson(`constellore-local-save-${todayKey}.json`, { version: 1, exportedAt: new Date().toISOString(), profile: snapshot });
}

function resetLocalPractice() {
  if (!window.confirm("Reset every local discovery, badge, score, and setting on this device? This cannot be undone.")) return;
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(ACTIVE_RUN_KEY);
    localStorage.removeItem(LOCAL_ANALYTICS_KEY);
    localStorage.removeItem(LOCAL_RECIPE_FEEDBACK_KEY);
    localStorage.removeItem(LOCAL_EXPECTED_PAIRS_KEY);
    localStorage.removeItem(ANALYTICS_COHORT_KEY);
    localStorage.removeItem(ANALYTICS_PREFERENCE_KEY);
    localStorage.removeItem(PENDING_RECOVERY_KIT_KEY);
  } catch { /* Reload still restores safe defaults when storage is blocked. */ }
  location.reload();
}

async function exportPlayerData() {
  if (!profile.playerId || !profile.playerToken) return showToast("Cloud identity is not ready yet.", { scope: "global" });
  try {
    const data = await fetchJson("/api/player/export", { headers: authHeaders() });
    downloadJson(`constellore-player-data-${todayKey}.json`, data);
  } catch (error) { showToast(error.message || "Player data could not be exported.", { scope: "global" }); }
}

async function deletePlayerData() {
  if (!profile.playerId || !profile.playerToken) return;
  if (!window.confirm("Permanently delete this free Constellore account, its progress, scores, and recovery access? This cannot be undone.")) return;
  try {
    await fetchJson("/api/player/profile", {
      method: "DELETE",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ confirm: "DELETE" })
    });
    try {
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem(ACTIVE_RUN_KEY);
      localStorage.removeItem(PENDING_RECOVERY_KIT_KEY);
    } catch { /* The reload below still clears in-memory ownership. */ }
    location.reload();
  } catch (error) { showToast(error.message || "This account could not be deleted.", { scope: "global" }); }
}

function updateStudyHud() {
  if (!state.game) return;
  const training = learningOrbitActive();
  const exploring = state.game.mode === "explore";
  const study = !training && !exploring && state.scoringDisabled;
  const partial = !training && !exploring && !study && state.scoreMultiplier < 1;
  const divisionId = exploring ? "practice" : training || study ? "study" : partial ? "open" : state.run?.ranked && !isStaticBeta ? "pure" : "practice";
  const divisionLabels = { pure: "PURE", open: `OPEN · ${Math.round(state.scoreMultiplier * 100)}%`, practice: "PRACTICE", study: "STUDY · 0 SCORE" };
  const divisionPill = $("#runDivisionPill");
  divisionPill.className = `run-division-pill ${divisionId}`;
  divisionPill.textContent = divisionLabels[divisionId];
  divisionPill.title = divisionId === "pure"
    ? "Verified run without score-changing Guidance"
    : divisionId === "open"
      ? "Score-changing Guidance is declared"
      : divisionId === "study"
        ? "No score, rewards, or leaderboard entry"
        : "Unranked practice route";
  els.lawPill.classList.toggle("study-status", study);
  els.lawPill.classList.toggle("partial-status", partial);
  els.universePill.hidden = training || study;
  if (training) {
    els.lawPill.hidden = false;
    els.lawPill.textContent = "0 SCORE · NO REWARDS";
  } else if (exploring) {
    els.lawPill.hidden = false;
    els.lawPill.textContent = "PERSISTENT · UNRANKED";
  } else if (study) {
    els.lawPill.hidden = false;
    els.lawPill.textContent = "◇ STUDY · 0 SCORE";
  } else if (partial) {
    els.lawPill.hidden = false;
    els.lawPill.textContent = `◇ OPEN · ${Math.round(state.scoreMultiplier * 100)}% SCORE`;
  } else {
    els.lawPill.hidden = !state.game.law;
    els.lawPill.textContent = state.game.law ? `${state.game.law.name}: ${state.game.law.description}` : "";
  }
}

function updateHud() {
  if (!state.game) return;
  els.movesValue.textContent = state.game.moveLimit ? `${state.moves}/${state.game.moveLimit}` : String(state.moves);
  els.collectionCount.textContent = state.inventoryQuery ? `${state.inventoryVisibleCount}/${state.words.length}` : state.words.length;
  els.pathCount.textContent = state.history.length;
  if (state.game.timeLimit) els.timerValue.textContent = formatTime(state.remainingSeconds);
  if (els.revealPathButton) {
    const alreadyRevealed = state.reveal.revealed;
    els.revealPathButton.disabled = !state.game || !state.run || state.finished || state.startingRun || state.reveal.active || state.reveal.pending || alreadyRevealed;
    els.revealPathButton.classList.toggle("assisted", state.scoringDisabled);
    els.revealPathButton.querySelector("b").textContent = state.scoringDisabled && alreadyRevealed ? "0 SCORE" : "REVEAL";
  }
  updateStudyHud();
  updateWishButton();
}

function renderRouteStarStrip(container, model) {
  if (!container) return;
  const stars = [];
  const origin = document.createElement("i");
  origin.className = "origin-star";
  origin.textContent = "✦";
  origin.title = "Four starting elements";
  stars.push(origin);
  if (model.omitted) {
    const omitted = document.createElement("i");
    omitted.className = "omitted-stars";
    omitted.textContent = `+${model.omitted}`;
    omitted.title = `${model.omitted} earlier recipe${model.omitted === 1 ? "" : "s"}`;
    stars.push(omitted);
  }
  for (const step of model.steps) {
    const star = document.createElement("i");
    star.className = `route-step-star${step.twisted ? " twisted" : ""}${step.revealed ? " revealed" : ""}`;
    star.textContent = step.emoji;
    star.title = `Star ${step.number}: ${step.word}`;
    stars.push(star);
  }
  const target = document.createElement("i");
  target.className = `target-star${model.targetReached ? " reached" : ""}`;
  target.textContent = model.targetReached ? state.game?.emoji || "✦" : "?";
  target.title = model.targetReached ? `${model.target} reached` : `${model.target} destination beacon`;
  stars.push(target);
  container.replaceChildren(...stars);
}

function updateMilestone(won = false) {
  if (!state.game) return;
  if (state.mode === "explore") {
    const combinations = state.history.length;
    els.milestoneBar.style.width = `${Math.min(100, combinations * 8)}%`;
    els.milestoneText.textContent = combinations
      ? `${combinations} recipe${combinations === 1 ? "" : "s"} added to this sandbox`
      : "Combine freely · every discovery will be here next time";
    $("#routeStepCount").textContent = `${state.words.length} WORD${state.words.length === 1 ? "" : "S"}`;
    const model = buildRouteProgress({ history: state.history, target: "", limit: window.innerWidth <= 700 ? 4 : 6 });
    renderRouteStarStrip(els.routeProgressTrail, { ...model, target: "Explore", targetReached: false });
    return;
  }
  const model = buildRouteProgress({ history: state.history, target: state.game.target, limit: window.innerWidth <= 700 ? 4 : 6 });
  els.milestoneBar.style.width = `${won ? 100 : model.lineFill}%`;
  els.milestoneText.textContent = model.targetReached || won
    ? `${state.game.target} reached · constellation complete`
    : model.combinations
      ? `${model.combinations} recipe${model.combinations === 1 ? "" : "s"} traced toward ${state.game.target}`
      : `Trace your path to ${state.game.target}`;
  $("#routeStepCount").textContent = `${model.combinations} STAR${model.combinations === 1 ? "" : "S"}`;
  renderRouteStarStrip(els.routeProgressTrail, model);
}

function renderResultRoute() {
  if (!state.game) return;
  const model = buildRouteProgress({ history: state.history, target: state.game.target, limit: 7 });
  $("#resultRouteTitle").textContent = model.targetReached ? `Your route to ${state.game.target}` : `Your orbit toward ${state.game.target}`;
  $("#resultRouteSummary").textContent = `${model.combinations} recipe${model.combinations === 1 ? "" : "s"} · ${state.newDiscoveries} new discover${state.newDiscoveries === 1 ? "y" : "ies"}`;
  renderRouteStarStrip(els.resultRouteTrail, model);
}

function clearSenseGlow() {
  clearTimeout(state.sense.timer);
  state.sense.timer = null;
  state.sense.active = false;
  state.sense.words = [];
  document.querySelectorAll(".sense-hot").forEach((element) => element.classList.remove("sense-hot"));
}

function applySenseGlow(words) {
  clearSenseGlow();
  state.sense.words = [...new Set((Array.isArray(words) ? words : []).map((entry) => inventoryKey(entry)).filter(Boolean))].slice(0, 3);
  state.sense.active = state.sense.words.length > 0;
  renderInventory();
  renderBoard();
  if (!state.sense.active) return;
  state.sense.timer = setTimeout(clearSenseGlow, 10_000);
}

function openPowerups() {
  if (!state.game || state.finished) return;
  if (state.startingRun || state.pause.active || state.reveal.active || state.reveal.pending || state.busyPairs.size) return showToast("Let the current constellation settle first.");
  clearArmedPowerup({ render: false });
  stopTimer();
  els.quickTipMessage.classList.remove("error");
  els.quickTipMessage.textContent = state.powerups.tipsUsed >= QUICK_TIP_LIMIT
    ? "All three Route Signals have been used for this orbit."
    : "Route Signal finds your next reachable bridge and names at most one word you already discovered.";
  els.wordGiftMessage.classList.remove("error");
  els.wordGiftMessage.textContent = state.powerups.giftUsed
    ? `${state.powerups.giftItem?.word || "Your bridge word"} was gifted. This orbit keeps half score in Open.`
    : state.powerups.giftUnavailable
      ? "Every safe bridge for this target is already known, so no Word Gift is available."
    : "Word Gift keeps half score in Open; only automatic Reveal becomes Study.";
  $("#senseMessage").classList.remove("error");
  $("#senseMessage").textContent = "";
  const strongerHelp = document.querySelector(".guidance-stronger");
  if (strongerHelp) strongerHelp.open = false;
  renderProfile();
  els.senseDialog.scrollTop = 0;
  els.senseDialog.showModal();
  track("sense_opened", { mode: state.mode, surface: "guidance" });
}

function openPowerupShop() {
  openPowerups();
  if (!els.senseDialog.open) return;
  const strongerHelp = document.querySelector(".guidance-stronger");
  if (strongerHelp) strongerHelp.open = true;
  requestAnimationFrame(() => {
    const buyButton = $("#buySense");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    buyButton.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
    buyButton.focus({ preventScroll: true });
  });
}

async function useQuickTip() {
  if (!state.run || state.finished || state.startingRun || state.reveal.active || state.reveal.pending || state.busyPairs.size || state.powerups.busy) return;
  clearArmedPowerup({ render: false });
  const runId = state.run.id;
  const runToken = state.run.token;
  const orbitGeneration = state.orbitGeneration;
  const tipIndex = clamp(Number(state.powerups.tipsUsed) || 0, 0, QUICK_TIP_LIMIT);
  const label = els.useQuickTip.querySelector("span");
  const original = label.textContent;
  state.powerups.busy = true;
  label.textContent = "Tracing the next bridge…";
  els.quickTipMessage.classList.remove("error");
  els.quickTipMessage.textContent = "Reading the first route connection your discoveries can reach…";
  renderPowerups();
  try {
    const tip = await fetchJson("/api/run/tip", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ runId, runToken, tipIndex })
    });
    if (state.run?.id !== runId || state.orbitGeneration !== orbitGeneration) return;
    state.powerups.tipsUsed = clamp(Number(tip.used) || 0, 0, QUICK_TIP_LIMIT);
    if (tip.available) {
      const tipId = `route-signal-${state.powerups.tipsUsed}`;
      if (!state.powerups.tipIds.includes(tipId)) state.powerups.tipIds.push(tipId);
      state.powerups.tipIds = state.powerups.tipIds.slice(-QUICK_TIP_LIMIT);
    }
    els.quickTipMessage.textContent = tip.text;
    scheduleRunSave();
    if (!els.senseDialog.open) showAlchemy(`ROUTE SIGNAL · ${tip.text}`);
    if (tip.available) {
      playFeedback("place");
      track("quick_tip_used", { mode: state.mode, tipIndex, remaining: tip.remaining, scoreSafe: tip.scoreSafe === true });
    }
  } catch (error) {
    if (state.run?.id !== runId || state.orbitGeneration !== orbitGeneration) return;
    els.quickTipMessage.classList.add("error");
    els.quickTipMessage.textContent = error.message || "The route signal could not be read. No tip was spent.";
    if (!els.senseDialog.open) showAlchemy("Route Signal could not connect. No tip was spent.", true);
  } finally {
    if (state.run?.id === runId && state.orbitGeneration === orbitGeneration) {
      state.powerups.busy = false;
      label.textContent = original;
      renderPowerups();
      resumeTimerIfNeeded();
    }
  }
}

async function useWordGift() {
  if (!state.run || state.finished || state.startingRun || state.reveal.active || state.reveal.pending || state.busyPairs.size || state.powerups.busy || state.powerups.giftUsed) return;
  clearArmedPowerup({ render: false });
  const runId = state.run.id;
  const orbitGeneration = state.orbitGeneration;
  const priorAssist = state.assist;
  const priorScoringDisabled = state.scoringDisabled;
  const priorScoreMultiplier = state.scoreMultiplier;
  const priorRun = { ...state.run };
  const label = els.useWordGift.querySelector("span");
  const original = label.textContent;
  state.powerups.busy = true;
  label.textContent = "Summoning a bridge…";
  els.wordGiftMessage.classList.remove("error");
  els.wordGiftMessage.textContent = "The cosmos is selecting an undiscovered bridge without exposing its recipe…";
  // Commit the declared Open penalty before requesting the bridge, so a lost
  // response can never leave a Pure-looking score.
  const pendingPolicy = combineAssistance(priorAssist, "gift");
  state.assist = pendingPolicy.id;
  state.scoringDisabled = Boolean(priorScoringDisabled || pendingPolicy.study);
  state.scoreMultiplier = state.scoringDisabled ? 0 : Math.min(priorScoreMultiplier, pendingPolicy.scoreMultiplier);
  state.run = { ...state.run, assist: state.assist, assisted: true, division: state.scoringDisabled ? "study" : pendingPolicy.division, scoreEligible: !state.scoringDisabled && pendingPolicy.scoreEligible, scoreMultiplier: state.scoreMultiplier };
  updateHud();
  renderPowerups();
  scheduleRunSave();
  try {
    const result = await fetchJson("/api/run/gift", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ runId, runToken: priorRun.token })
    });
    if (state.run?.id !== runId || state.orbitGeneration !== orbitGeneration) return;
    const received = snapshotItem({ ...result.item, source: "gift", note: "A crucial bridge gifted by the cosmos." });
    if (!received?.word) throw Object.assign(new Error("The cosmos returned an invalid Word Gift."), { code: "invalid_gift_response" });
    const existing = state.words.find((item) => inventoryKey(item) === inventoryKey(received));
    const item = existing || received;
    if (!existing) state.words.push(item);
    state.powerups.giftUsed = true;
    state.powerups.giftItem = item;
    const confirmedPolicy = combineAssistance(pendingPolicy.id, result.assist || "gift");
    state.assist = confirmedPolicy.id;
    state.scoringDisabled = Boolean(state.scoringDisabled || confirmedPolicy.study || result.scoringDisabled === true || result.scoreEligible === false);
    state.scoreMultiplier = state.scoringDisabled ? 0 : cappedScoreMultiplier(state.assist, state.scoreMultiplier, confirmedPolicy.scoreMultiplier, result.scoreMultiplier);
    state.run = {
      ...state.run,
      assist: state.assist,
      assisted: true,
      division: state.scoringDisabled ? "study" : result.division || confirmedPolicy.division,
      ranked: result.ranked ?? state.run.ranked,
      scoreEligible: !state.scoringDisabled,
      scoreMultiplier: state.scoreMultiplier,
      leaderboardEligible: state.scoringDisabled ? false : result.leaderboardEligible ?? state.run.leaderboardEligible
    };
    renderInventory();
    renderAtlas();
    updateHud();
    scheduleRunSave();
    if (els.senseDialog.open) els.senseDialog.close();
    placeFromTray(item);
    playFeedback("sense", { analytics: true });
    showAlchemy(`✦ WORD GIFT · ${item.word} joined your Open orbit · ${Math.round(state.scoreMultiplier * 100)}% score.`);
    track("word_gift_used", { mode: state.mode, word: item.word, scoreMultiplier: state.scoreMultiplier });
  } catch (error) {
    if (state.run?.id !== runId || state.orbitGeneration !== orbitGeneration) return;
    const confirmedBeforeForfeit = Number(error.status) >= 400 && Number(error.status) < 500;
    if (confirmedBeforeForfeit) {
      state.assist = priorAssist;
      state.scoringDisabled = priorScoringDisabled;
      state.scoreMultiplier = priorScoreMultiplier;
      state.run = priorRun;
      if (error.code === "gift_unavailable") state.powerups.giftUnavailable = true;
      els.wordGiftMessage.textContent = error.message;
    } else {
      els.wordGiftMessage.textContent = "The reply was interrupted. The visible Open penalty remains; retry to recover the same bridge.";
    }
    els.wordGiftMessage.classList.add("error");
    if (!els.senseDialog.open) showToast(error.code === "gift_unavailable" ? "No undiscovered bridge is available for this orbit." : "Word Gift could not confirm. The Open penalty remains; retry to recover it.");
    updateHud();
    scheduleRunSave();
  } finally {
    if (state.run?.id === runId && state.orbitGeneration === orbitGeneration) {
      state.powerups.busy = false;
      label.textContent = original;
      renderProfile();
      resumeTimerIfNeeded();
    }
  }
}

async function useConstellationSense() {
  if (!state.run || state.finished || state.startingRun || state.reveal.active || state.reveal.pending || state.busyPairs.size || state.powerups.busy) return;
  clearArmedPowerup({ render: false });
  const preview = spendSenseCharge(profile.senseWallet);
  if (!preview.spent) {
    $("#senseMessage").textContent = "No Star Compass charges remain. Earn one tomorrow or buy one with Stardust.";
    return;
  }
  const button = $("#useSense");
  const label = button.querySelector("span");
  const original = label.textContent;
  const runId = state.run.id;
  const orbitGeneration = state.orbitGeneration;
  const priorWallet = sanitizeSenseWallet(profile.senseWallet);
  const priorAssist = state.assist;
  const priorScoringDisabled = state.scoringDisabled;
  const priorScoreMultiplier = state.scoreMultiplier;
  const priorRun = { ...state.run };
  state.powerups.busy = true;
  button.disabled = true;
  renderPowerups();
  label.textContent = "Listening to the cosmos…";
  $("#senseMessage").textContent = "";
  // Commit the declared Open penalty before requesting the signal, so a lost
  // success response can never leave a Pure-looking score.
  profile.senseWallet = preview.wallet;
  const pendingPolicy = combineAssistance(priorAssist, "sense");
  state.assist = pendingPolicy.id;
  state.scoringDisabled = Boolean(priorScoringDisabled || pendingPolicy.study);
  state.scoreMultiplier = state.scoringDisabled ? 0 : Math.min(priorScoreMultiplier, pendingPolicy.scoreMultiplier);
  state.run = { ...state.run, assist: state.assist, assisted: true, division: state.scoringDisabled ? "study" : pendingPolicy.division, scoreEligible: !state.scoringDisabled && pendingPolicy.scoreEligible, scoreMultiplier: state.scoreMultiplier };
  saveProfile({ cloud: false });
  updateHud();
  scheduleRunSave();
  try {
    const result = await fetchJson("/api/run/sense", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ runId, runToken: priorRun.token })
    });
    if (state.run?.id !== runId || state.orbitGeneration !== orbitGeneration) return;
    const confirmedPolicy = combineAssistance(pendingPolicy.id, result.assist || "sense");
    state.assist = confirmedPolicy.id;
    state.scoringDisabled = Boolean(state.scoringDisabled || confirmedPolicy.study || result.scoringDisabled === true || result.scoreEligible === false);
    state.scoreMultiplier = state.scoringDisabled
      ? 0
      : cappedScoreMultiplier(state.assist, state.scoreMultiplier, confirmedPolicy.scoreMultiplier, result.scoreMultiplier);
    state.run = {
      ...state.run,
      assist: state.assist,
      assisted: true,
      division: state.scoringDisabled ? "study" : result.division || confirmedPolicy.division,
      ranked: result.ranked ?? state.run.ranked,
      scoreEligible: !state.scoringDisabled,
      scoreMultiplier: state.scoreMultiplier,
      leaderboardEligible: state.scoringDisabled ? false : result.leaderboardEligible ?? state.run.leaderboardEligible
    };
    saveProfile({ cloud: false });
    updateHud();
    scheduleRunSave();
    const candidates = result.words || result.candidates || [];
    applySenseGlow(candidates);
    els.senseDialog.close();
    const names = candidates.map((entry) => entry.word).filter(Boolean).join(", ");
    showAlchemy(names ? `STAR COMPASS · ${names} resonate for ten seconds · ${Math.round(state.scoreMultiplier * 100)}% score.` : `STAR COMPASS · Follow the brightest recent discoveries · ${Math.round(state.scoreMultiplier * 100)}% score.`);
    playFeedback("sense", { analytics: true });
    track("sense_used", { mode: state.mode, words: candidates.length, scoreMultiplier: state.scoreMultiplier });
  } catch (error) {
    const confirmedBeforeForfeit = Number(error.status) >= 400 && Number(error.status) < 500;
    if (state.run?.id !== runId || state.orbitGeneration !== orbitGeneration) {
      if (confirmedBeforeForfeit) {
        const refund = grantSenseCharges(profile.senseWallet, 1);
        profile.senseWallet = refund.wallet;
        saveProfile({ cloud: false });
        renderProfile();
        if (refund.granted) showToast("A Star Compass charge was returned after the earlier orbit closed.");
      }
      return;
    }
    if (confirmedBeforeForfeit && state.run?.id === runId) {
      profile.senseWallet = priorWallet;
      state.assist = priorAssist;
      state.scoringDisabled = priorScoringDisabled;
      state.scoreMultiplier = priorScoreMultiplier;
      state.run = priorRun;
      saveProfile({ cloud: false });
      updateHud();
      scheduleRunSave();
      $("#senseMessage").textContent = error.message;
    } else {
      $("#senseMessage").textContent = "The signal response was interrupted. The visible Open penalty remains and the Compass charge stays spent.";
      scheduleRunSave();
    }
    if (!els.senseDialog.open) showToast(confirmedBeforeForfeit ? error.message : "Star Compass could not confirm. The Open penalty remains.");
  } finally {
    if (state.run?.id === runId && state.orbitGeneration === orbitGeneration) {
      state.powerups.busy = false;
      label.textContent = original;
      renderProfile();
    }
  }
}

function buySenseCharge() {
  if (state.powerups.busy) return;
  const wallet = sanitizeSenseWallet(profile.senseWallet);
  track("sense_purchase_started", { cost: 90, chargesBefore: wallet.charges });
  if (wallet.charges >= 9) {
    $("#senseMessage").textContent = "Your Star Compass reserve is already full.";
    return;
  }
  if (profile.stardust < 90) {
    $("#senseMessage").textContent = `You need ${90 - profile.stardust} more Stardust.`;
    return;
  }
  profile.stardust -= 90;
  profile.senseWallet = grantSenseCharges(wallet, 1).wallet;
  saveProfile({ fields: ["progression"] });
  renderProfile();
  $("#senseMessage").textContent = "One Star Compass charge joined your reserve.";
  playFeedback("place");
  track("sense_purchased", { cost: 90, chargesBefore: wallet.charges, chargesAfter: profile.senseWallet.charges });
}

function ghostStepEstimate() {
  const candidates = [
    state.game?.routeLength,
    state.game?.minimumMoves,
    state.game?.verifiedRouteLength
  ];
  const actual = candidates.map(Number).find((value) => Number.isFinite(value) && value > 0);
  return actual ? clamp(Math.round(actual), 1, 100) : Math.max(5, Number(state.game?.tier || 2) * 3 + 1);
}

function ghostTimeline({ elapsedMs, moves, steps = ghostStepEstimate() }) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps;
    return {
      elapsedMs: Math.round(elapsedMs * progress),
      progress,
      moves: Math.round(moves * progress),
      milestone: index
    };
  });
}

function ghostLeaderboardScope(mode = state.mode) {
  return mode === "daily" ? "daily" : mode === "weekly" ? "weekly" : "sprint";
}

function queuedCommunityRival() {
  const queued = state.ghost.nextRival;
  state.ghost.nextRival = null;
  if (!queued || !state.game) return null;
  const targetMatches = String(queued.target || "").toLocaleLowerCase() === String(state.game.target || "").toLocaleLowerCase();
  const scopeMatches = queued.scope === ghostLeaderboardScope();
  const divisionMatches = ["pure", "open"].includes(queued.division);
  if (!targetMatches || !scopeMatches || !divisionMatches) return null;
  return queued;
}

function hideGhostPreview() {
  els.ghostPreview.hidden = true;
  els.ghostPreview.classList.remove("complete");
  els.ghostPreviewStatus.textContent = "SCOUT CALIBRATING";
  els.ghostPreviewCount.textContent = "0 / 0";
  els.ghostPreviewPercent.textContent = "0%";
  els.ghostPreviewProgress.setAttribute("aria-valuemax", "100");
  els.ghostPreviewProgress.setAttribute("aria-valuenow", "0");
  els.ghostPreviewProgress.setAttribute("aria-valuetext", "Scout calibration has not started");
  els.ghostPreviewBar.style.width = "0%";
  els.ghostPreviewSteps.replaceChildren();
}

function competitiveGhostEligible() {
  return Boolean(profile.wins >= 3 && state.game && !["training", "second-orbit", "explore", "reach"].includes(state.mode) && !state.scoringDisabled);
}

function renderGhostPreview(projectedProgress, estimated) {
  if (!competitiveGhostEligible() || !state.ghost.model || !profile.rivalGhostEnabled || state.finished) return hideGhostPreview();
  const continuousProgress = clamp(Number(projectedProgress) || 0, 0, 1);
  const continuousSteps = continuousProgress * estimated;
  const completedSteps = Math.min(estimated, Math.floor(continuousSteps + Number.EPSILON));
  const currentStepProgress = completedSteps >= estimated ? 1 : continuousSteps - completedSteps;
  const preview = ghostTrailPreviewState({ current: completedSteps, total: estimated, windowSize: 3, seed: state.game.seed });
  if (!preview.total) return hideGhostPreview();
  const percent = preview.complete ? 100 : Math.min(99, Math.floor(continuousProgress * 100));
  els.ghostPreview.hidden = false;
  els.ghostPreview.classList.toggle("complete", preview.complete);
  els.ghostPreviewStatus.textContent = preview.complete ? "ROUTE COMPLETE" : `TRACING STEP ${Math.min(preview.total, completedSteps + 1)}`;
  els.ghostPreviewCount.textContent = `${preview.current} / ${preview.total}`;
  els.ghostPreviewPercent.textContent = `${percent}%`;
  els.ghostPreviewProgress.setAttribute("aria-valuemax", "100");
  els.ghostPreviewProgress.setAttribute("aria-valuenow", String(percent));
  els.ghostPreviewProgress.setAttribute("aria-valuetext", `${percent}% of projected route; ${preview.current} of ${preview.total} steps complete; all words encrypted`);
  els.ghostPreviewBar.style.width = `${(continuousProgress * 100).toFixed(1)}%`;
  const existingSteps = [...els.ghostPreviewSteps.children];
  const sameWindow = existingSteps.length === preview.steps.length
    && preview.steps.every((step, index) => existingSteps[index]?.dataset.stepIndex === String(step.index));
  const stepNodes = sameWindow ? existingSteps : preview.steps.map((step) => {
    const placeholder = document.createElement("span");
    placeholder.dataset.stepIndex = String(step.index);
    const fill = document.createElement("b");
    fill.className = "ghost-preview-step-fill";
    placeholder.append(fill, document.createElement("i"));
    return placeholder;
  });
  preview.steps.forEach((step, index) => {
    const placeholder = stepNodes[index];
    placeholder.className = `ghost-preview-step ${step.status}`;
    placeholder.style.setProperty("--ghost-mask", `${step.widthPercent}%`);
    const stepProgress = step.index <= completedSteps ? 1 : step.index === completedSteps + 1 ? currentStepProgress : 0;
    placeholder.style.setProperty("--ghost-step-progress", `${(stepProgress * 100).toFixed(1)}%`);
  });
  if (!sameWindow) els.ghostPreviewSteps.replaceChildren(...stepNodes);
}

async function startRivalGhost() {
  stopRivalGhost();
  if (!competitiveGhostEligible() || state.finished) return;
  if (!profile.rivalGhostEnabled) {
    hideGhostPreview();
    els.rivalGhost.hidden = false;
    els.rivalGhost.setAttribute("aria-pressed", "false");
    els.rivalGhost.setAttribute("aria-label", "Show Rival Ghost pace");
    els.ghostCallsign.textContent = "RIVAL GHOST";
    els.ghostStatus.textContent = "Ghost hidden · tap to race";
    els.ghostPace.textContent = "OFF";
    return;
  }
  const generation = state.orbitGeneration;
  const requestGeneration = state.ghost.requestGeneration;
  const requestController = new AbortController();
  state.ghost.requestController = requestController;
  els.rivalGhost.hidden = false;
  els.ghostCallsign.textContent = "RIVAL GHOST";
  els.ghostStatus.textContent = "Mapping an asynchronous pace…";
  els.ghostPace.textContent = "—";
  let rival = queuedCommunityRival();
  let source = "benchmark";
  if (rival) source = `nearby-${rival.division}`;
  if (!rival && !isStaticBeta) {
    try {
      const scope = ghostLeaderboardScope();
      const division = state.assist === "none" ? "pure" : "open";
      const board = await fetchJson(`/api/leaderboard?scope=${encodeURIComponent(scope)}&division=${encodeURIComponent(division)}&limit=100`, { headers: authHeaders(), signal: requestController.signal });
      rival = (board.entries || []).find((entry) => entry.target?.toLowerCase() === state.game.target.toLowerCase() && entry.callsign !== profile.callsign)
        || null;
      if (rival) source = "verified";
    } catch { /* A projected scout keeps the feature available offline. */ }
  }
  if (state.ghost.requestController === requestController) state.ghost.requestController = null;
  if (generation !== state.orbitGeneration || requestGeneration !== state.ghost.requestGeneration || !profile.rivalGhostEnabled || !state.game || state.finished) return;
  const fallbackTime = Math.max(42_000, Math.min(150_000, (48 + Number(state.game.tier || 2) * 13) * 1000));
  const elapsedMs = Math.max(10_000, Number(rival?.elapsedMs) || fallbackTime);
  const estimatedSteps = ghostStepEstimate();
  const moves = Math.max(estimatedSteps, Number(rival?.moves) || estimatedSteps + 2);
  state.ghost.estimatedSteps = estimatedSteps;
  state.ghost.model = buildGhost(ghostTimeline({ elapsedMs, moves, steps: estimatedSteps }), { label: rival?.callsign || "Cosmos Scout" });
  state.ghost.lastRelation = "";
  state.ghost.started = true;
  renderRivalGhost();
  state.ghost.timerId = setInterval(renderRivalGhost, 500);
  track("ghost_loaded", { mode: state.mode, source, deltaMs: elapsedMs, moves });
  track("ghost_race_started", { mode: state.mode, source });
}

function renderRivalGhost() {
  if (!competitiveGhostEligible() || !state.ghost.model || state.finished) return;
  els.rivalGhost.hidden = false;
  els.rivalGhost.setAttribute("aria-pressed", String(profile.rivalGhostEnabled));
  els.rivalGhost.setAttribute("aria-label", profile.rivalGhostEnabled ? "Hide Rival Ghost pace" : "Show Rival Ghost pace");
  els.ghostCallsign.textContent = state.ghost.model.label.toUpperCase();
  if (!profile.rivalGhostEnabled) {
    hideGhostPreview();
    els.ghostStatus.textContent = "Ghost hidden · tap to race";
    els.ghostPace.textContent = "OFF";
    return;
  }
  const estimated = state.ghost.estimatedSteps || ghostStepEstimate();
  const playerProgress = Math.min(.98, state.history.length / estimated);
  const snapshot = ghostSnapshot(state.ghost.model, {
    elapsedMs: Math.max(0, Date.now() - state.startedAt),
    playerProgress,
    playerMoves: state.moves,
    tolerance: 1 / estimated * .55
  });
  const rivalStars = Math.min(estimated, Math.floor(snapshot.projectedProgress * estimated));
  const gap = Math.max(1, Math.abs(state.history.length - rivalStars));
  els.ghostPace.textContent = `${rivalStars}/${estimated} · ${formatTime(Math.round(snapshot.elapsedMs / 1000))}`;
  els.ghostStatus.textContent = snapshot.complete && state.history.length < estimated
    ? "Rival reached the target"
    : snapshot.relation === "ahead"
      ? `You lead by ${gap} star${gap === 1 ? "" : "s"}`
      : snapshot.relation === "behind"
        ? `Rival leads by ${gap} star${gap === 1 ? "" : "s"}`
        : "Neck and neck";
  renderGhostPreview(snapshot.projectedProgress, estimated);
  if (snapshot.relation === "ahead" && state.ghost.lastRelation && state.ghost.lastRelation !== "ahead") playFeedback("ghostPass");
  state.ghost.lastRelation = snapshot.relation;
}

function stopRivalGhost({ completed } = {}) {
  state.ghost.requestGeneration += 1;
  state.ghost.requestController?.abort();
  state.ghost.requestController = null;
  clearInterval(state.ghost.timerId);
  state.ghost.timerId = null;
  if (state.ghost.started && typeof completed === "boolean") {
    const result = state.ghost.lastRelation === "ahead" ? "won" : state.ghost.lastRelation === "behind" ? "lost" : "tied";
    track("ghost_race_completed", { mode: state.mode, completed, result, moves: state.moves });
  }
  state.ghost.started = false;
  state.ghost.model = null;
  state.ghost.estimatedSteps = 0;
  state.ghost.lastRelation = "";
  els.rivalGhost.hidden = true;
  hideGhostPreview();
}

function toggleRivalGhost() {
  if (!competitiveGhostEligible()) return;
  profile.rivalGhostEnabled = !profile.rivalGhostEnabled;
  saveProfile({ fields: ["settings"] });
  if (profile.rivalGhostEnabled) void startRivalGhost();
  else {
    stopRivalGhost();
    hideGhostPreview();
    els.rivalGhost.hidden = false;
    els.rivalGhost.setAttribute("aria-pressed", "false");
    els.rivalGhost.setAttribute("aria-label", "Show Rival Ghost pace");
    els.ghostCallsign.textContent = "RIVAL GHOST";
    els.ghostStatus.textContent = "Ghost hidden · tap to race";
    els.ghostPace.textContent = "OFF";
  }
}

function inventoryKey(itemOrWord) {
  return String(typeof itemOrWord === "object" ? itemOrWord?.word : itemOrWord || "").trim().toLocaleLowerCase();
}

function recentInventoryWords() {
  return [...state.inventoryRecency.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([word]) => word);
}

function touchInventory(itemOrWord, { focus = false } = {}) {
  const key = inventoryKey(itemOrWord);
  if (!key) return;
  state.inventoryClock += 1;
  state.inventoryRecency.set(key, state.inventoryClock);
  if (focus) state.inventoryFocusWord = key;
}

function renderInventory() {
  const focusedWord = els.wordList.contains(document.activeElement)
    ? document.activeElement.closest?.(".inventory-word")?.dataset.word || ""
    : "";
  const visible = orderInventory(state.words, {
    starters: state.game?.starters || ["Earth", "Water", "Fire", "Air"],
    recent: recentInventoryWords(),
    query: state.inventoryQuery
  });
  state.inventoryVisibleCount = visible.length;
  const controls = visible.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `inventory-word${["wish", "market"].includes(item.source) ? " wish" : ""}${item.source === "gift" ? " gift" : ""}${item.source === "twist" ? " twist" : ""}${item.ghost ? " reveal-ghost" : ""}${senseWordActive(item) ? " sense-hot" : ""}${firstOrbitWordActive(item) ? " tutorial-hot" : ""}`;
    button.dataset.word = inventoryKey(item);
    const revealLocked = state.reveal.active || state.reveal.pending;
    const unavailable = state.finished || state.pause.active || revealLocked || item.ghost;
    button.draggable = false;
    button.disabled = unavailable;
    button.setAttribute("aria-label", item.ghost ? `${item.word}, temporary revealed word. Not saved or playable.` : unavailable ? `${item.word}. Unavailable while this orbit is locked.` : `Add ${item.word}${item.source === "gift" ? ", Word Gift bridge" : ""} to the cosmos. Drag onto a board word to combine immediately.`);
    if (!unavailable) button.title = `Drag ${item.word} onto a board word to combine`;
    const tag = item.ghost ? "REVEALED" : item.source === "gift" ? "GIFT" : item.source === "twist" ? "TWIST" : item.source === "wish" ? "WISH" : item.source === "market" ? "VAULT" : item.source?.startsWith("ai") ? "AI" : "";
    const masteryStars = masteryStarsForWord(item.word);
    button.innerHTML = `<span class="emoji">${escapeHtml(item.emoji)}</span><span class="word">${escapeHtml(item.word)}</span>${tag ? `<span class="source-tag">${tag}</span>` : ""}${masteryStars ? `<span class="mastery-tag" aria-label="${masteryStars} recipe mastery stars">★${masteryStars}</span>` : ""}`;
    let suppressClickUntil = 0;
    button.addEventListener("click", (event) => {
      if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        return;
      }
      void activateTrayItem(item);
    });
    button.addEventListener("pointerdown", (event) => startTrayPointerDrag(event, item, button, () => {
      suppressClickUntil = performance.now() + 650;
    }));
    return button;
  });
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "inventory-empty";
    empty.textContent = state.inventoryQuery ? `No discoveries match “${state.inventoryQuery}”.` : "Your discoveries will gather here.";
    controls.push(empty);
  }
  els.wordList.replaceChildren(...controls);
  els.inventorySearch.value = state.inventoryQuery;
  els.inventorySearchClear.hidden = !state.inventoryQuery;
  els.inventorySearchStatus.textContent = state.inventoryQuery
    ? `${visible.length} of ${state.words.length} discovered words shown.`
    : `${state.words.length} discovered words.`;
  if (focusedWord) {
    const restoredFocus = [...els.wordList.querySelectorAll(".inventory-word")].find((button) => button.dataset.word === focusedWord);
    restoredFocus?.focus({ preventScroll: true });
  }
  const focusKey = state.inventoryFocusWord;
  if (focusKey) {
    const focusElement = [...els.wordList.querySelectorAll(".inventory-word")].find((button) => button.dataset.word === focusKey);
    if (focusElement) {
      focusElement.classList.add("new-discovery");
      requestAnimationFrame(() => focusElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }));
      setTimeout(() => focusElement.classList.remove("new-discovery"), 1000);
    }
    state.inventoryFocusWord = "";
  }
  updateHud();
}

function renderBoard(newId = null) {
  const focusedId = els.boardItems.contains(document.activeElement) ? document.activeElement.closest?.(".board-word")?.dataset.id : "";
  const existing = new Map([...els.boardItems.querySelectorAll(".board-word")].map((element) => [element.dataset.id, element]));
  const ordered = state.nodes.map((node) => {
    const key = String(node.id);
    let element = existing.get(key);
    if (!element || element.dataset.word !== inventoryKey(node.item)) element = createBoardNode(node, node.id === newId);
    else syncBoardNodeElement(element, node, node.id === newId);
    existing.delete(key);
    return element;
  });
  existing.forEach((element) => element.remove());
  els.boardItems.append(...ordered);
  boardGeometryVersion += 1;
  els.boardGuide.classList.toggle("hidden", state.nodes.length > 0);
  els.boardGuide.setAttribute("aria-hidden", String(state.nodes.length > 0));
  syncCtrlHoverState(ctrlHover.snapshot());
  syncShiftBoardState(shiftBoard.snapshot());
  syncSelectedNodeState();
  updateBoardTools();
  syncFirstOrbitGuide();
  if (focusedId) requestAnimationFrame(() => els.boardItems.querySelector(`[data-id="${CSS.escape(focusedId)}"]`)?.focus({ preventScroll: true }));
}

function syncSelectedNodeState() {
  let selected = state.nodes.find((node) => node.id === state.selectedNodeId);
  if (!selected || selected.revealRole || selected.item.ghost || state.busyPairs.has(selected.id)) {
    state.selectedNodeId = null;
    selected = null;
  }
  for (const element of els.boardItems.querySelectorAll(".board-word")) {
    const active = selected && String(selected.id) === element.dataset.id;
    element.classList.toggle("keyboard-selected", Boolean(active));
    element.setAttribute("aria-pressed", String(Boolean(active)));
  }
  els.tapChainStatus.hidden = !selected;
  els.board.classList.toggle("tap-chain-active", Boolean(selected));
  if (selected) els.tapChainText.textContent = `${selected.item.word} armed · tap another word`;
}

function cancelTapChain({ announce = false } = {}) {
  if (state.selectedNodeId == null) return false;
  state.selectedNodeId = null;
  syncSelectedNodeState();
  if (announce) showAlchemy("Tap chain cancelled.");
  return true;
}

function dismissClearUndo() {
  clearTimeout(clearUndoTimer);
  clearUndoTimer = null;
  clearUndo = null;
  els.boardUndo.hidden = true;
}

function updateBoardTools() {
  const locked = !state.game || state.finished || state.startingRun || state.pause.active || state.reveal.active || state.reveal.pending || state.busyPairs.size > 0;
  els.tidyBoard.disabled = locked || state.nodes.length < 2;
  els.resetBoard.disabled = locked || state.nodes.length === 0;
  els.senseButton.disabled = locked;
  renderPowerups();
}

function clearBoardWithUndo() {
  if (state.startingRun || state.reveal.active || state.reveal.pending) return showToast("The cosmos is tracing this path.");
  if (state.busyPairs.size) return showToast("Let the current combination resolve first.");
  if (!state.nodes.length) return;
  cancelActiveTrayDrag();
  cancelActiveBoardDrag();
  ctrlHover.reset();
  shiftBoard.reset();
  cancelTapChain();
  dismissClearUndo();
  clearUndo = {
    runId: state.run?.id || "",
    generation: state.orbitGeneration,
    nodes: structuredClone(state.nodes)
  };
  state.nodes = [];
  renderBoard();
  els.boardUndo.hidden = false;
  clearUndoTimer = setTimeout(dismissClearUndo, 6000);
  scheduleRunSave();
  showAlchemy("The board is clear. Your discoveries remain.");
}

function undoBoardClear() {
  if (!clearUndo || clearUndo.generation !== state.orbitGeneration || clearUndo.runId !== (state.run?.id || "") || state.busyPairs.size) return dismissClearUndo();
  const snapshot = clearUndo.nodes;
  dismissClearUndo();
  state.nodes = snapshot;
  state.nextId = Math.max(state.nextId, ...state.nodes.map((node) => Number(node.id) + 1).filter(Number.isFinite), 1);
  state.topZ = Math.max(state.topZ, ...state.nodes.map((node) => Number(node.z)).filter(Number.isFinite), 10);
  renderBoard();
  scheduleRunSave();
  showAlchemy("Board restored · score unchanged.");
}

function boardRectangle(rectangle) {
  const left = Number(rectangle?.left ?? rectangle?.x) || 0;
  const top = Number(rectangle?.top ?? rectangle?.y) || 0;
  const width = Math.max(0, Number(rectangle?.width) || 0);
  const height = Math.max(0, Number(rectangle?.height) || 0);
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function rectanglesOverlap(leftValue, rightValue, gap = 0) {
  const left = boardRectangle(leftValue);
  const right = boardRectangle(rightValue);
  return !(left.right + gap <= right.left || right.right + gap <= left.left || left.bottom + gap <= right.top || right.bottom + gap <= left.top);
}

function visibleBoardOverlayRectangles(boardRect = els.board.getBoundingClientRect()) {
  const candidates = [els.rivalGhost, els.ghostPreview, document.querySelector(".board-tools"), document.querySelector(".run-milestone"), els.tapChainStatus, els.boardUndo, els.recipeFeedback, els.expectedPairFeedback, els.alchemyNote, els.firstOrbitGuide];
  return candidates.map((element) => {
    if (!element || element.hidden) return null;
    if (element === els.alchemyNote && !element.classList.contains("show")) return null;
    const bounds = element.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return null;
    const left = clamp(bounds.left - boardRect.left, 0, boardRect.width);
    const top = clamp(bounds.top - boardRect.top, 0, boardRect.height);
    const right = clamp(bounds.right - boardRect.left, 0, boardRect.width);
    const bottom = clamp(bounds.bottom - boardRect.top, 0, boardRect.height);
    return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
  }).filter(Boolean);
}

function packOrbitAroundOverlays(items, bounds, blockers) {
  const packed = packOrbit(items, bounds);
  if (packed && packed.every((entry) => blockers.every((blocker) => !rectanglesOverlap(entry, blocker, bounds.gap)))) return packed;
  const indexed = items.map((item, index) => ({ ...item, index }));
  const ordered = indexed.slice().sort((left, right) => right.height - left.height || right.width - left.width || left.index - right.index);
  const placed = [];
  for (const item of ordered) {
    const preferred = {
      x: bounds.left + bounds.width * .5 - item.width * .5 + ((item.index % 5) - 2) * 18,
      y: bounds.top + bounds.height * .48 - item.height * .5 + ((item.index % 4) - 1.5) * 15
    };
    const position = findOpenSpawn(preferred, item, [...blockers, ...placed], bounds, { gap: bounds.gap, step: 14 });
    if (!position) return null;
    const candidate = { id: item.id, x: position.x, y: position.y, width: item.width, height: item.height, index: item.index };
    if ([...blockers, ...placed].some((blocker) => rectanglesOverlap(candidate, blocker, bounds.gap))) return null;
    placed.push(candidate);
  }
  return placed.sort((left, right) => left.index - right.index).map(({ index, ...entry }) => entry);
}

function tidyOrbit(options = {}) {
  if (els.tidyBoard.disabled) return;
  cancelActiveTrayDrag();
  cancelActiveBoardDrag();
  ctrlHover.reset();
  shiftBoard.reset();
  cancelTapChain();
  dismissClearUndo();
  const boardRect = els.board.getBoundingClientRect();
  const measured = state.nodes.map((node) => {
    const rect = els.boardItems.querySelector(`[data-id="${node.id}"]`)?.getBoundingClientRect();
    return rect ? { id: node.id, width: rect.width, height: rect.height } : null;
  }).filter(Boolean);
  if (measured.length !== state.nodes.length) return showToast("The orbit is still settling. Try again.");
  const padding = boardRect.width < 500 ? 10 : 18;
  const top = boardRect.width < 500 ? 64 : 72;
  const bottom = boardRect.width < 500 ? 70 : 64;
  const packBounds = {
    left: padding,
    top,
    width: Math.max(1, boardRect.width - padding * 2),
    height: Math.max(1, boardRect.height - top - bottom),
    gap: 10
  };
  const packed = packOrbitAroundOverlays(measured, packBounds, visibleBoardOverlayRectangles(boardRect));
  if (!packed) return showToast("These words need a little more room to tidy safely.");
  const byId = new Map(packed.map((entry) => [String(entry.id), entry]));
  for (const node of state.nodes) {
    const placement = byId.get(String(node.id));
    const element = els.boardItems.querySelector(`[data-id="${node.id}"]`);
    if (!placement || !element) continue;
    node.x = placement.x;
    node.y = placement.y;
    node.z = ++state.topZ;
    element.classList.add("tidying");
    element.style.setProperty("--x", `${node.x}px`);
    element.style.setProperty("--y", `${node.y}px`);
    element.style.zIndex = node.z;
    setTimeout(() => element.classList.remove("tidying"), 280);
  }
  boardGeometryVersion += 1;
  scheduleRunSave();
  if (!options?.silent) {
    showAlchemy("Orbit tidied · score unchanged.");
    track("board_tidied", { mode: state.mode, words: state.nodes.length });
  }
}

function boardNodesOverlap(gap = 2) {
  const rectangles = [...els.boardItems.querySelectorAll(".board-word")].map((element) => element.getBoundingClientRect());
  for (let left = 0; left < rectangles.length; left += 1) {
    for (let right = left + 1; right < rectangles.length; right += 1) {
      const a = rectangles[left];
      const b = rectangles[right];
      if (!(a.right + gap <= b.left || b.right + gap <= a.left || a.bottom + gap <= b.top || b.bottom + gap <= a.top)) return true;
    }
  }
  return false;
}

function constrainBoardNodes() {
  if (!state.game || els.gameScreen.hidden) return;
  const boardRect = els.board.getBoundingClientRect();
  for (const node of state.nodes) {
    const element = els.boardItems.querySelector(`[data-id="${node.id}"]`);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    node.x = clamp(node.x, 5, Math.max(5, boardRect.width - rect.width - 5));
    node.y = clamp(node.y, 5, Math.max(5, boardRect.height - rect.height - 5));
    element.style.setProperty("--x", `${node.x}px`);
    element.style.setProperty("--y", `${node.y}px`);
  }
  boardGeometryVersion += 1;
  if (boardNodesOverlap()) tidyOrbit({ silent: true });
  scheduleRunSave();
}

function ctrlHoverAvailable() {
  return Boolean(state.game && !els.gameScreen.hidden && !state.finished && !state.startingRun && !state.pause.active && !state.reveal.active && !state.reveal.pending);
}

function shiftBoardAvailable() {
  return ctrlHoverAvailable();
}

function boardModifierBlocked(event) {
  const editable = event?.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
  return Boolean(editable || document.querySelector("dialog[open]"));
}

function getCtrlHoverNode(id) {
  if (!ctrlHoverAvailable()) return null;
  const node = state.nodes.find((entry) => String(entry.id) === String(id));
  if (!node || node.revealRole || node.item.ghost || state.busyPairs.has(node.id)) return null;
  return node;
}

function syncCtrlHoverState(hoverState) {
  if (!els.board || !els.boardItems) return;
  els.board.classList.toggle("ctrl-hover-active", hoverState.active && ctrlHoverAvailable());
  for (const element of els.boardItems.querySelectorAll(".board-word")) {
    const id = element.dataset.id;
    element.classList.toggle("ctrl-hover-source", [hoverState.anchorId, hoverState.sourceId].some((value) => value != null && String(value) === id));
    element.classList.toggle("ctrl-hover-target", hoverState.targetId != null && String(hoverState.targetId) === id);
    element.classList.toggle("ctrl-hover-queued", hoverState.queuedId != null && String(hoverState.queuedId) === id);
  }
}

function getShiftBoardNode(id) {
  if (!shiftBoardAvailable()) return null;
  if (activeTrayShiftSource && String(activeTrayShiftSource.id) === String(id)) return activeTrayShiftSource;
  const node = state.nodes.find((entry) => String(entry.id) === String(id));
  if (!node || node.revealRole || node.item.ghost || state.busyPairs.has(node.id)) return null;
  return node;
}

function syncShiftBoardState(shiftState) {
  if (!els.board) return;
  const available = shiftBoardAvailable();
  els.board.classList.toggle("shift-remove-active", available && shiftState.held && !shiftState.dragging);
  els.board.classList.toggle("shift-stamp-active", available && shiftState.held && shiftState.dragging);
  if (shiftState.dragging && shiftState.copies >= MAX_SHIFT_COPIES_PER_DRAG && !shiftCopyLimitAnnounced) {
    shiftCopyLimitAnnounced = true;
    showAlchemy(`SHIFT COPY · ${MAX_SHIFT_COPIES_PER_DRAG} spaced copies is the limit for one drag.`);
  }
}

function removeShiftBoardNode(node) {
  const current = getShiftBoardNode(node?.id);
  if (!current) return false;
  dismissClearUndo();
  if (state.selectedNodeId === current.id) state.selectedNodeId = null;
  state.nodes = state.nodes.filter((entry) => entry.id !== current.id);
  els.boardItems.querySelector(`[data-id="${current.id}"]`)?.remove();
  boardGeometryVersion += 1;
  els.boardGuide.classList.toggle("hidden", state.nodes.length > 0);
  els.boardGuide.setAttribute("aria-hidden", String(state.nodes.length > 0));
  syncSelectedNodeState();
  updateBoardTools();
  syncFirstOrbitGuide();
  scheduleRunSave();
  showAlchemy(`SHIFT REMOVE · ${current.item.word} cleared from the board. It remains discovered.`);
  return true;
}

function duplicateShiftBoardNode(source, point, { copyNumber = 1, size } = {}) {
  const current = getShiftBoardNode(source?.id);
  if (!current) return false;
  if (state.nodes.length >= MAX_BOARD_NODES) {
    if (!shiftCopyLimitAnnounced) showAlchemy(`SHIFT COPY · This board can hold ${MAX_BOARD_NODES} words.`, true);
    shiftCopyLimitAnnounced = true;
    return false;
  }
  dismissClearUndo();
  const bounds = els.board.getBoundingClientRect();
  const width = Math.max(1, Number(size?.width) || 1);
  const height = Math.max(1, Number(size?.height) || 1);
  const copy = {
    id: state.nextId++,
    item: current.item,
    x: clamp(Number(point?.x) || 0, 5, Math.max(5, bounds.width - width - 5)),
    y: clamp(Number(point?.y) || 0, 5, Math.max(5, bounds.height - height - 5)),
    z: Math.max(1, (Number(current.z) || 2) - 1),
    cosmicTwist: Boolean(current.cosmicTwist),
    shiftStamped: true
  };
  state.nodes.push(copy);
  els.boardItems.append(createBoardNode(copy, true));
  boardGeometryVersion += 1;
  els.boardGuide.classList.add("hidden");
  els.boardGuide.setAttribute("aria-hidden", "true");
  updateBoardTools();
  syncFirstOrbitGuide();
  scheduleRunSave();
  if (copyNumber === 1) showAlchemy(`SHIFT COPY · ${current.item.word} is leaving a spaced trail. Drop the held word onto any word to fuse.`);
  return true;
}

function handleShiftBoardEnter(node, event = {}) {
  if (!shiftBoard.snapshot().held) return false;
  const x = Number(event.clientX);
  const y = Number(event.clientY);
  shiftBoard.enter(node.id, {
    buttons: event.buttons ?? 0,
    point: Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  });
  return true;
}

function activateShiftBoard(event) {
  if (event.key !== "Shift" || event.repeat || boardModifierBlocked(event) || !shiftBoardAvailable()) return;
  resetRecipeFeedback();
  ctrlHover.reset();
  shiftBoard.setHeld(true);
  if (shiftBoard.snapshot().dragging) {
    showAlchemy("SHIFT COPY · Keep dragging to leave safely spaced copies.");
    return;
  }
  if (activeTrayDragCleanup) {
    showAlchemy("SHIFT COPY · Drag this inventory word onto the board to leave spaced copies.");
    return;
  }
  const hovered = els.boardItems.querySelector(".board-word:hover");
  const focused = els.boardItems.contains(document.activeElement) ? document.activeElement.closest?.(".board-word") : null;
  const element = hovered || focused;
  const node = element ? getShiftBoardNode(element.dataset.id) : null;
  if (node) {
    const rect = element.getBoundingClientRect();
    const pointer = lastPointerPosition
      && lastPointerPosition.x >= rect.left && lastPointerPosition.x <= rect.right
      && lastPointerPosition.y >= rect.top && lastPointerPosition.y <= rect.bottom
      ? lastPointerPosition
      : null;
    handleShiftBoardEnter(node, { buttons: 0, clientX: pointer?.x, clientY: pointer?.y });
  } else {
    showAlchemy("SHIFT REMOVE · Hover words to clear them. Hold Shift before or during a drag to stamp copies.");
  }
}

function releaseShiftBoard(event) {
  if (event?.key && event.key !== "Shift") return;
  shiftBoard.setHeld(false);
}

function handleCtrlHoverEnter(node, event = {}) {
  if (shiftBoard.snapshot().held || shiftBoard.snapshot().dragging) return;
  if (event.ctrlKey && !ctrlHover.snapshot().active) ctrlHover.setActive(true);
  if (!ctrlHoverAvailable()) return;
  const action = ctrlHover.enter(node.id);
  if (action.type === "ignored") return;
  cancelTapChain();
  if (action.type === "armed") showAlchemy(`CTRL FUSION · ${action.node.item.word} remembered — hover another word.`);
  else if (action.type === "combining") showAlchemy(`CTRL FUSION · Combining ${action.source.item.word} + ${action.target.item.word}…`);
  else if (action.type === "queued") showAlchemy(`CTRL FUSION · ${action.node.item.word} is next.`);
}

function activateCtrlHover(event) {
  if (event.key !== "Control" || event.repeat || boardModifierBlocked(event) || !ctrlHoverAvailable() || shiftBoard.snapshot().held || shiftBoard.snapshot().dragging) return;
  if (!ctrlHover.setActive(true)) return;
  const hovered = els.boardItems.querySelector(".board-word:hover");
  const node = hovered ? getCtrlHoverNode(hovered.dataset.id) : null;
  if (node) handleCtrlHoverEnter(node, { buttons: 0, ctrlKey: true, pointerType: "mouse" });
  else showAlchemy("CTRL FUSION · Hover a word to remember it.");
}

function releaseCtrlHover(event) {
  if (event?.key && event.key !== "Control") return;
  const changed = ctrlHover.setActive(false);
  if (changed && els.alchemyNote.textContent.startsWith("CTRL FUSION")) els.alchemyNote.classList.remove("show");
}

function syncBoardNodeElement(button, node, isNew = false) {
  button.className = `board-word${isNew ? " appear" : ""}${isNew && node.shiftStamped ? " shift-stamped" : ""}${["wish", "market"].includes(node.item.source) ? " wish" : ""}${node.item.source === "gift" ? " gift" : ""}${node.item.source === "twist" || node.cosmicTwist ? " cosmic-twist" : ""}${node.item.ghost ? " reveal-ghost" : ""}${node.revealRole ? ` reveal-${node.revealRole}` : ""}${state.selectedNodeId === node.id ? " keyboard-selected" : ""}${senseWordActive(node.item) ? " sense-hot" : ""}${firstOrbitWordActive(node.item) ? " tutorial-hot" : ""}`;
  button.dataset.id = node.id;
  button.dataset.word = inventoryKey(node.item);
  button.style.setProperty("--x", `${node.x}px`);
  button.style.setProperty("--y", `${node.y}px`);
  button.style.zIndex = node.z;
  const revealedNode = Boolean(node.revealRole || node.item.ghost);
  const unavailable = state.finished || state.pause.active || state.reveal.active || state.reveal.pending || revealedNode;
  button.disabled = unavailable;
  button.setAttribute("aria-label", revealedNode
    ? `${node.item.word}, revealed constellation word. Not playable.`
    : unavailable
      ? `${node.item.word}. Unavailable while this orbit is locked.`
      : `${node.item.word}${node.item.source === "gift" ? ", Word Gift bridge" : node.item.source === "twist" || node.cosmicTwist ? ", Cosmic Twist discovery" : ""}. Drag onto another word to combine. Hold Shift while hovering to remove; grab it first and then hold Shift while dragging to copy.`);
  button.setAttribute("aria-pressed", String(state.selectedNodeId === node.id));
  const renderKey = `${node.item.emoji}␟${node.item.word}`;
  if (button.dataset.renderedWord !== renderKey) {
    button.innerHTML = `<span class="emoji">${escapeHtml(node.item.emoji)}</span><span>${escapeHtml(node.item.word)}</span>`;
    button.dataset.renderedWord = renderKey;
  }
  return button;
}

function createBoardNode(node, isNew) {
  const button = document.createElement("button");
  button.type = "button";
  syncBoardNodeElement(button, node, isNew);
  button.addEventListener("pointerdown", (event) => startNodeDrag(event, node, button));
  button.addEventListener("pointerenter", (event) => {
    if (!handleShiftBoardEnter(node, event)) handleCtrlHoverEnter(node, event);
  });
  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void selectNodeForTap(node);
    }
  });
  return button;
}

async function selectNodeForTap(node) {
  if (state.finished || state.pause.active || state.reveal.active || state.reveal.pending || ctrlHover.snapshot().active || shiftBoard.snapshot().held) return;
  resetRecipeFeedback();
  if (!state.selectedNodeId) {
    state.selectedNodeId = node.id;
    syncSelectedNodeState();
    showAlchemy(`${node.item.word} armed · tap another word.`);
    return;
  }
  if (state.selectedNodeId === node.id) {
    cancelTapChain({ announce: true });
    return;
  }
  const first = state.nodes.find((entry) => entry.id === state.selectedNodeId);
  state.selectedNodeId = null;
  syncSelectedNodeState();
  if (!first) return void selectNodeForTap(node);
  const outcome = await combineNodes(first, node);
  if (!outcome && getCtrlHoverNode(node.id)) {
    state.selectedNodeId = node.id;
    syncSelectedNodeState();
    showAlchemy(`${node.item.word} remains armed · try another word.`);
  }
}

async function activateTrayItem(item) {
  if (state.pause.active) return;
  resetRecipeFeedback();
  const selected = state.nodes.find((node) => node.id === state.selectedNodeId);
  if (!selected) {
    const placed = placeFromTray(item);
    if (!placed) return null;
    state.selectedNodeId = placed.id;
    syncSelectedNodeState();
    showAlchemy(`${placed.item.word} armed · tap another word.`);
    return placed;
  }
  state.selectedNodeId = null;
  syncSelectedNodeState();
  const outcome = await combineTrayWithTarget(item, selected);
  if (!outcome && getCtrlHoverNode(selected.id)) {
    state.selectedNodeId = selected.id;
    syncSelectedNodeState();
    showAlchemy(`${selected.item.word} remains armed · try another word.`);
  }
  return outcome;
}

function placeFromTray(item, point, placement = {}) {
  if (state.finished || state.pause.active || state.reveal.active || state.reveal.pending || item.ghost) return;
  const rect = els.board.getBoundingClientRect();
  const guideRect = learningOrbitActive() && !els.firstOrbitGuide.hidden ? els.firstOrbitGuide.getBoundingClientRect() : null;
  const safeTop = guideRect ? clamp(guideRect.bottom - rect.top + 9, 7, Math.max(7, rect.height - 55)) : 7;
  const spread = state.nodes.length % 7;
  const boardPoint = Number.isFinite(Number(placement?.boardPoint?.x)) && Number.isFinite(Number(placement?.boardPoint?.y))
    ? { x: Number(placement.boardPoint.x), y: Number(placement.boardPoint.y) }
    : null;
  const measuredSize = Number(placement?.size?.width) > 0 && Number(placement?.size?.height) > 0
    ? { width: Number(placement.size.width), height: Number(placement.size.height) }
    : null;
  let x = boardPoint ? boardPoint.x : point ? point.x - rect.left - 55 : rect.width * .46 + (spread - 3) * 22;
  let y = boardPoint ? boardPoint.y : point ? point.y - rect.top - 22 : Math.max(safeTop, rect.height * .43 + ((state.nodes.length * 31) % 100) - 50);
  if (!point) {
    const occupied = [...els.boardItems.querySelectorAll(".board-word")].map((element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left - rect.left, top: bounds.top - rect.top, width: bounds.width, height: bounds.height };
    }).concat(visibleBoardOverlayRectangles(rect));
    const estimatedWidth = clamp(56 + [...String(item.word || "")].length * 8.2, 82, 220);
    const open = findOpenSpawn({ x, y }, { width: estimatedWidth, height: 44 }, occupied, {
      left: 7, top: safeTop, width: Math.max(1, rect.width - 14), height: Math.max(1, rect.height - safeTop - 7)
    });
    if (open) ({ x, y } = open);
  }
  touchInventory(item);
  renderInventory();
  const node = addNode(item, x, y, measuredSize ? { size: measuredSize, inset: 5 } : {});
  playFeedback("place");
  return node;
}

function traySourceFor(item, target) {
  return {
    id: `tray-${state.nextId++}`,
    item,
    x: target.x,
    y: target.y,
    z: ++state.topZ,
    traySource: true
  };
}

function combineTrayWithTarget(item, target) {
  cancelTapChain();
  const targetElement = els.boardItems.querySelector(`[data-id="${target.id}"]`);
  targetElement?.classList.remove("keyboard-selected");
  targetElement?.setAttribute("aria-pressed", "false");
  return combineNodes(traySourceFor(item, target), target);
}

function cancelActiveTrayDrag() {
  activeTrayDragCleanup?.();
  activeTrayDragCleanup = null;
}

function cancelActiveBoardDrag() {
  activeBoardDragCleanup?.();
  activeBoardDragCleanup = null;
}

function rememberPointerPosition(event) {
  const x = Number(event?.clientX);
  const y = Number(event?.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  lastPointerPosition = { x, y };
  shiftBoard.pointerMove(lastPointerPosition);
}

function cancelActivePointerGestures() {
  cancelActiveTrayDrag();
  cancelActiveBoardDrag();
  shiftBoard.reset();
}

function pointInsideBoard(point, cachedRect = null) {
  const rect = cachedRect || els.board.getBoundingClientRect();
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function trayShiftBoardPoint(point, size, cachedRect = null) {
  const rect = cachedRect || els.board.getBoundingClientRect();
  const width = Math.max(1, Number(size?.width) || 1);
  const height = Math.max(1, Number(size?.height) || 1);
  return {
    x: clamp(Number(point?.x) - rect.left - width / 2, 5, Math.max(5, rect.width - width - 5)),
    y: clamp(Number(point?.y) - rect.top - height / 2, 5, Math.max(5, rect.height - height - 5))
  };
}

function measureBoardWord(item) {
  const probe = document.createElement("button");
  probe.type = "button";
  probe.className = "board-word board-word-measure";
  probe.tabIndex = -1;
  probe.setAttribute("aria-hidden", "true");
  probe.innerHTML = `<span class="emoji">${escapeHtml(item.emoji)}</span><span>${escapeHtml(item.word)}</span>`;
  els.boardItems.append(probe);
  const bounds = probe.getBoundingClientRect();
  probe.remove();
  return { width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) };
}

function dragThreshold(pointerType) {
  return pointerType === "touch" ? 12 : pointerType === "pen" ? 8 : 5;
}

function eligibleDropCandidates(excludeId = null) {
  return state.nodes.flatMap((node) => {
    if (String(node.id) === String(excludeId) || node.revealRole || node.item.ghost || state.busyPairs.has(node.id)) return [];
    const element = els.boardItems.querySelector(`[data-id="${node.id}"]`);
    if (!element || element.disabled) return [];
    return [{ node, element, rect: element.getBoundingClientRect() }];
  });
}

function captureDropGeometry(excludeId = null) {
  return {
    version: boardGeometryVersion,
    boardRect: els.board.getBoundingClientRect(),
    candidates: eligibleDropCandidates(excludeId)
  };
}

function refreshDropGeometry(geometry, excludeId = null) {
  return geometry?.version === boardGeometryVersion ? geometry : captureDropGeometry(excludeId);
}

function rectEdgeDistance(point, rect) {
  return Math.hypot(Math.max(rect.left - point.x, 0, point.x - rect.right), Math.max(rect.top - point.y, 0, point.y - rect.bottom));
}

function resolveDropCandidate({ point, sourceElement = null, sourceRect: cachedSourceRect = null, excludeId = null, pointerType = "mouse", geometry = null }) {
  const candidates = geometry?.candidates || eligibleDropCandidates(excludeId);
  if (!candidates.length) return { selected: null, ambiguous: false, contenders: [] };
  const sourceRect = cachedSourceRect || sourceElement?.getBoundingClientRect();
  const anchor = sourceRect
    ? { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 }
    : { x: point.x, y: point.y };
  const direct = pickMagneticTarget(candidates, anchor, { radius: 0, ambiguityGap: 0 });
  if (direct.selected) return { selected: direct.selected.node, ambiguous: false, contenders: [direct.selected.node], exact: true };
  if (direct.ambiguous) {
    const contenders = candidates.filter(({ rect }) => rectEdgeDistance(anchor, rect) === 0).map(({ node }) => node);
    return { selected: null, ambiguous: true, contenders, exact: true };
  }
  if (sourceRect) {
    const sourceArea = Math.max(1, sourceRect.width * sourceRect.height);
    const overlapping = candidates.map((candidate) => {
      const rect = candidate.rect;
      const area = Math.max(0, Math.min(sourceRect.right, rect.right) - Math.max(sourceRect.left, rect.left))
        * Math.max(0, Math.min(sourceRect.bottom, rect.bottom) - Math.max(sourceRect.top, rect.top));
      return { candidate, ratio: area / sourceArea };
    }).filter((entry) => entry.ratio > .25).sort((left, right) => right.ratio - left.ratio);
    if (overlapping.length) {
      if (overlapping[1] && overlapping[0].ratio - overlapping[1].ratio < .1) {
        return { selected: null, ambiguous: true, contenders: overlapping.slice(0, 2).map((entry) => entry.candidate.node) };
      }
      return { selected: overlapping[0].candidate.node, ambiguous: false, contenders: [overlapping[0].candidate.node] };
    }
  }
  const radius = pointerType === "touch" || pointerType === "pen" ? 48 : 30;
  const magnetic = pickMagneticTarget(candidates, anchor, { radius, ambiguityGap: 12 });
  if (magnetic.selected) return { selected: magnetic.selected.node, ambiguous: false, contenders: [magnetic.selected.node], magnetic: true };
  const contenders = magnetic.ambiguous
    ? candidates.map((candidate) => ({ candidate, distance: rectEdgeDistance(anchor, candidate.rect) }))
      .filter((entry) => entry.distance <= radius).sort((left, right) => left.distance - right.distance).slice(0, 2).map((entry) => entry.candidate.node)
    : [];
  return { selected: null, ambiguous: magnetic.ambiguous, contenders };
}

function setDropTarget(resolution, sourceItem, geometry = null) {
  clearDropTargets();
  if (!resolution) return;
  for (const contender of resolution.contenders || []) {
    els.boardItems.querySelector(`[data-id="${contender.id}"]`)?.classList.add(resolution.ambiguous ? "drop-ambiguous" : "drop-target");
  }
  if (!resolution.selected && !resolution.ambiguous) return;
  const target = resolution.selected;
  const targetElement = target && els.boardItems.querySelector(`[data-id="${target.id}"]`);
  const boardRect = geometry?.boardRect || els.board.getBoundingClientRect();
  const targetRect = target
    ? geometry?.candidates?.find(({ node }) => String(node.id) === String(target.id))?.rect || targetElement?.getBoundingClientRect()
    : null;
  els.dropPairPreview.textContent = resolution.ambiguous
    ? "Move closer to choose a word"
    : `${sourceItem?.word || "Word"} + ${target.item.word} → ?`;
  els.dropPairPreview.classList.toggle("ambiguous", resolution.ambiguous);
  els.dropPairPreview.hidden = false;
  els.dropPairPreview.style.setProperty("--preview-x", `${targetRect ? targetRect.left + targetRect.width / 2 - boardRect.left : boardRect.width / 2}px`);
  els.dropPairPreview.style.setProperty("--preview-y", `${targetRect ? Math.max(62, targetRect.top - boardRect.top - 6) : 78}px`);
}

function dropTrayItem(item, point, pointerType = "mouse", placement = {}) {
  const geometry = refreshDropGeometry(placement.geometry);
  if (state.finished || state.pause.active || state.reveal.active || state.reveal.pending || item.ghost || !pointInsideBoard(point, geometry.boardRect)) return;
  const resolution = resolveDropCandidate({ point, pointerType, geometry });
  if (resolution.ambiguous) {
    showAlchemy("Move closer to choose a word.", true);
    return;
  }
  if (!resolution.selected) {
    placeFromTray(item, point, placement);
    return;
  }
  void combineTrayWithTarget(item, resolution.selected);
}

function startTrayPointerDrag(event, item, element, suppressClick) {
  if (event.button !== 0 || (!event.isPrimary && event.pointerType !== "mouse") || state.finished || state.pause.active || state.reveal.active || state.reveal.pending || item.ghost) return;
  resetRecipeFeedback();
  cancelActiveTrayDrag();
  let shiftArmedByPointer = false;
  if (event.shiftKey && !shiftBoard.snapshot().held) {
    ctrlHover.reset();
    shiftBoard.setHeld(true);
    shiftArmedByPointer = true;
  }
  const pointerId = event.pointerId;
  const pointerType = event.pointerType || "mouse";
  const startX = event.clientX;
  const startY = event.clientY;
  let lastPoint = { x: startX, y: startY };
  let moved = false;
  let dragging = false;
  let ghost = null;
  let shiftDragStarted = false;
  let dragSize = null;
  let dropGeometry = null;
  let shiftPointerInsideBoard = false;
  let cleaned = false;

  const updateShiftTrail = (point) => {
    if (!shiftDragStarted || !activeTrayShiftSource) return;
    dropGeometry = refreshDropGeometry(dropGeometry);
    const inside = pointInsideBoard(point);
    if (!inside) {
      shiftPointerInsideBoard = false;
      return;
    }
    const boardPoint = trayShiftBoardPoint(point, dragSize, dropGeometry.boardRect);
    activeTrayShiftSource.x = boardPoint.x;
    activeTrayShiftSource.y = boardPoint.y;
    if (!shiftPointerInsideBoard) {
      shiftPointerInsideBoard = true;
      shiftBoard.reanchorDrag(boardPoint);
      return;
    }
    shiftBoard.moveDrag(boardPoint);
  };

  const update = (moveEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    const samples = typeof moveEvent.getCoalescedEvents === "function" ? moveEvent.getCoalescedEvents() : [];
    const point = samples.at(-1) || moveEvent;
    lastPoint = { x: point.clientX, y: point.clientY };
    if (moveEvent.shiftKey && !shiftBoard.snapshot().held) {
      ctrlHover.reset();
      shiftBoard.setHeld(true);
      shiftArmedByPointer = true;
    }
    const dx = lastPoint.x - startX;
    const dy = lastPoint.y - startY;
    if (Math.hypot(dx, dy) > 8) moved = true;
    if (!dragging) {
      const mobileTray = matchMedia("(max-width: 700px)").matches;
      const headingTowardBoard = mobileTray
        ? dy < -8 && Math.abs(dy) > Math.abs(dx) * .65
        : dx < -8 && Math.abs(dx) > Math.abs(dy) * .65;
      if (!moved || !headingTowardBoard) return;
      dragging = true;
      cancelTapChain();
      dismissClearUndo();
      element.classList.add("pointer-dragging");
      ghost = document.createElement("div");
      ghost.className = "tray-drag-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.innerHTML = `<span>${escapeHtml(item.emoji)}</span><strong>${escapeHtml(item.word)}</strong>`;
      ghost.style.left = `${lastPoint.x}px`;
      ghost.style.top = `${lastPoint.y}px`;
      document.body.append(ghost);
      dragSize = measureBoardWord(item);
      dropGeometry = captureDropGeometry();
      const origin = trayShiftBoardPoint(lastPoint, dragSize, dropGeometry.boardRect);
      activeTrayShiftSource = {
        id: `tray-shift-${state.orbitGeneration}-${pointerId}`,
        item,
        x: origin.x,
        y: origin.y,
        z: state.topZ + 1,
        traySource: true
      };
      shiftCopyLimitAnnounced = false;
      shiftDragStarted = shiftBoard.beginDrag(activeTrayShiftSource.id, origin, dragSize);
      if (!shiftDragStarted) activeTrayShiftSource = null;
    }
    moveEvent.preventDefault();
    ghost.style.left = `${lastPoint.x}px`;
    ghost.style.top = `${lastPoint.y}px`;
    updateShiftTrail(lastPoint);
    dropGeometry = refreshDropGeometry(dropGeometry);
    setDropTarget(resolveDropCandidate({ point: lastPoint, pointerType, geometry: dropGeometry }), item, dropGeometry);
  };

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.removeEventListener("pointermove", update);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", cancel);
    element.removeEventListener("lostpointercapture", cancel);
    element.classList.remove("pointer-dragging");
    ghost?.remove();
    clearDropTargets();
    if (shiftDragStarted) shiftBoard.endDrag();
    activeTrayShiftSource = null;
    if (shiftArmedByPointer) shiftBoard.setHeld(false);
    if (activeTrayDragCleanup === cleanup) activeTrayDragCleanup = null;
  };
  const end = (upEvent) => {
    if (upEvent.pointerId !== pointerId) return;
    lastPoint = { x: upEvent.clientX, y: upEvent.clientY };
    if (moved) suppressClick();
    dropGeometry = dragging ? refreshDropGeometry(dropGeometry) : dropGeometry;
    const shouldDrop = dragging && pointInsideBoard(lastPoint, dropGeometry?.boardRect);
    if (dragging) updateShiftTrail(lastPoint);
    dropGeometry = dragging ? refreshDropGeometry(dropGeometry) : dropGeometry;
    const placement = shouldDrop && dragSize ? { boardPoint: trayShiftBoardPoint(lastPoint, dragSize), size: dragSize } : {};
    if (shouldDrop) placement.geometry = dropGeometry;
    cleanup();
    if (shouldDrop) dropTrayItem(item, lastPoint, pointerType, placement);
  };
  const cancel = (cancelEvent) => {
    if (cancelEvent?.pointerId != null && cancelEvent.pointerId !== pointerId) return;
    if (moved) suppressClick();
    cleanup();
  };

  activeTrayDragCleanup = cleanup;
  element.setPointerCapture(event.pointerId);
  window.addEventListener("pointermove", update);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", cancel);
  element.addEventListener("lostpointercapture", cancel);
}

function addNode(item, x, y, options = {}) {
  dismissClearUndo();
  const bounds = els.board.getBoundingClientRect();
  const { size, inset: requestedInset, ...nodeOptions } = options;
  const width = Number(size?.width) > 0 ? Number(size.width) : 155;
  const height = Number(size?.height) > 0 ? Number(size.height) : 54;
  const inset = Number.isFinite(Number(requestedInset)) ? clamp(Number(requestedInset), 0, 20) : 8;
  const node = {
    id: state.nextId++, item,
    x: clamp(x, inset, Math.max(inset, bounds.width - width - inset)),
    y: clamp(y, inset, Math.max(inset, bounds.height - height - inset)),
    z: ++state.topZ,
    ...nodeOptions
  };
  state.nodes.push(node);
  els.boardItems.append(createBoardNode(node, true));
  boardGeometryVersion += 1;
  els.boardGuide.classList.add("hidden");
  els.boardGuide.setAttribute("aria-hidden", "true");
  syncCtrlHoverState(ctrlHover.snapshot());
  syncShiftBoardState(shiftBoard.snapshot());
  syncSelectedNodeState();
  updateBoardTools();
  syncFirstOrbitGuide();
  scheduleRunSave();
  return node;
}

function startNodeDrag(event, node, element) {
  if (ctrlHover.snapshot().active) {
    event.preventDefault();
    return;
  }
  if (event.button !== 0 || (!event.isPrimary && event.pointerType !== "mouse") || state.finished || state.pause.active || state.reveal.active || state.reveal.pending || node.revealRole || node.item.ghost || state.busyPairs.has(node.id)) return;
  resetRecipeFeedback();
  event.preventDefault();
  cancelActiveBoardDrag();
  const pointerId = event.pointerId;
  const pointerType = event.pointerType || "mouse";
  const boardRect = els.board.getBoundingClientRect();
  const nodeRect = element.getBoundingClientRect();
  const nodeWidth = nodeRect.width;
  const nodeHeight = nodeRect.height;
  let dropGeometry = captureDropGeometry(node.id);
  const startX = event.clientX;
  const startY = event.clientY;
  const offsetX = event.clientX - nodeRect.left;
  const offsetY = event.clientY - nodeRect.top;
  let moved = false;
  let highlightFrame = 0;
  let shiftArmedByPointer = false;
  node.z = ++state.topZ;
  element.style.zIndex = node.z;
  element.classList.remove("appear");
  element.setPointerCapture(event.pointerId);
  shiftCopyLimitAnnounced = false;
  shiftBoard.beginDrag(node.id, { x: node.x, y: node.y }, { width: nodeWidth, height: nodeHeight });

  const updatePosition = (moveEvent, highlight = true) => {
    if (moveEvent.pointerId !== pointerId) return;
    if (moveEvent.shiftKey && !shiftBoard.snapshot().held) {
      ctrlHover.reset();
      shiftBoard.setHeld(true);
      shiftArmedByPointer = true;
    }
    const samples = typeof moveEvent.getCoalescedEvents === "function" ? moveEvent.getCoalescedEvents() : [];
    const point = samples.at(-1) || moveEvent;
    if (!moved && Math.hypot(point.clientX - startX, point.clientY - startY) > dragThreshold(pointerType)) {
      moved = true;
      element.classList.add("dragging");
      cancelTapChain();
      dismissClearUndo();
    }
    if (!moved) return;
    node.x = clamp(point.clientX - boardRect.left - offsetX, 5, boardRect.width - nodeWidth - 5);
    node.y = clamp(point.clientY - boardRect.top - offsetY, 5, boardRect.height - nodeHeight - 5);
    element.style.setProperty("--x", `${node.x}px`);
    element.style.setProperty("--y", `${node.y}px`);
    shiftBoard.moveDrag({ x: node.x, y: node.y });
    if (highlight && !highlightFrame) {
      highlightFrame = requestAnimationFrame(() => {
        highlightFrame = 0;
        dropGeometry = refreshDropGeometry(dropGeometry, node.id);
        markDropTarget(node, element, pointerType, dropGeometry, { width: nodeWidth, height: nodeHeight });
      });
    }
  };
  const move = (moveEvent) => updatePosition(moveEvent);
  const cleanup = () => {
    if (highlightFrame) cancelAnimationFrame(highlightFrame);
    highlightFrame = 0;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", cancel);
    element.removeEventListener("lostpointercapture", cancel);
    element.classList.remove("dragging");
    clearDropTargets();
    shiftBoard.endDrag();
    if (shiftArmedByPointer) shiftBoard.setHeld(false);
    if (activeBoardDragCleanup === cleanup) activeBoardDragCleanup = null;
  };
  const end = (upEvent) => {
    if (upEvent.pointerId !== pointerId) return;
    updatePosition(upEvent, false);
    dropGeometry = refreshDropGeometry(dropGeometry, node.id);
    const sourceRect = {
      left: boardRect.left + node.x,
      top: boardRect.top + node.y,
      right: boardRect.left + node.x + nodeWidth,
      bottom: boardRect.top + node.y + nodeHeight,
      width: nodeWidth,
      height: nodeHeight
    };
    const resolution = moved ? resolveDropCandidate({ point: { x: upEvent.clientX, y: upEvent.clientY }, sourceElement: element, sourceRect, excludeId: node.id, pointerType, geometry: dropGeometry }) : null;
    cleanup();
    if (resolution?.selected) void combineNodes(node, resolution.selected);
    else if (resolution?.ambiguous) showAlchemy("Move closer to choose a word.", true);
    else if (!moved) void selectNodeForTap(node);
    else scheduleRunSave();
  };
  const cancel = (cancelEvent) => {
    if (cancelEvent?.pointerId != null && cancelEvent.pointerId !== pointerId) return;
    cleanup();
  };
  activeBoardDragCleanup = cleanup;
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", cancel);
  element.addEventListener("lostpointercapture", cancel);
}

function markDropTarget(source, element, pointerType, geometry = null, sourceSize = null) {
  const boardRect = geometry?.boardRect || els.board.getBoundingClientRect();
  const width = Number(sourceSize?.width) || element.offsetWidth;
  const height = Number(sourceSize?.height) || element.offsetHeight;
  const rect = {
    left: boardRect.left + source.x,
    top: boardRect.top + source.y,
    right: boardRect.left + source.x + width,
    bottom: boardRect.top + source.y + height,
    width,
    height
  };
  setDropTarget(resolveDropCandidate({
    point: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    sourceRect: rect,
    excludeId: source.id,
    pointerType,
    geometry
  }), source.item, geometry);
}

function clearDropTargets() {
  els.boardItems.querySelectorAll(".drop-target, .drop-ambiguous").forEach((element) => element.classList.remove("drop-target", "drop-ambiguous"));
  els.dropPairPreview.hidden = true;
  els.dropPairPreview.classList.remove("ambiguous");
}

function insightCategoryFor(value) {
  const category = String(value || "").toLowerCase();
  return ["force", "nature", "life", "structure"].includes(category) ? category : "";
}

function categoryForInsightWord(word) {
  const active = state.words.find((item) => inventoryKey(item.word) === inventoryKey(word));
  if (active) return insightCategoryFor(active.category);
  if (starterCategory[word]) return insightCategoryFor(starterCategory[word]);
  const recipe = MASTERY_CATALOG.find((item) => inventoryKey(item.word) === inventoryKey(word));
  return insightCategoryFor(recipe?.category);
}

function authoredInsightCatalog() {
  return MASTERY_CATALOG.map((recipe) => ({
    ...recipe,
    source: "world",
    ...(categoryForInsightWord(recipe.a) ? { categoryA: categoryForInsightWord(recipe.a) } : {}),
    ...(categoryForInsightWord(recipe.b) ? { categoryB: categoryForInsightWord(recipe.b) } : {}),
    ...(insightCategoryFor(recipe.category) ? { category: insightCategoryFor(recipe.category) } : {})
  }));
}

async function combineNodes(a, b) {
  if (state.finished || state.pause.active || state.reveal.active || state.reveal.pending || state.busyPairs.has(a.id) || state.busyPairs.has(b.id)) return;
  if (state.game.moveLimit && state.moves >= state.game.moveLimit) return finishGame(false, "No moves remain in this orbit.");
  resetExpectedPairFeedback();
  dismissClearUndo();
  const orbitGeneration = state.orbitGeneration;
  state.busyPairs.add(a.id);
  state.busyPairs.add(b.id);
  playFeedback("combineStart");
  updateBoardTools();
  const aElement = els.boardItems.querySelector(`[data-id="${a.id}"]`);
  const bElement = els.boardItems.querySelector(`[data-id="${b.id}"]`);
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  aElement?.classList.remove("appear");
  bElement?.classList.remove("appear");
  aElement?.classList.add("combining");
  bElement?.classList.add("combining");
  try {
    let result;
    if (firstOrbitActive()) {
      result = resolveFirstOrbitCombination(a.item.word, b.item.word, state.history);
      if (!result) throw new Error(firstOrbitWrongPairMessage(state.history));
      await wait(90);
    } else {
      result = await fetchJson("/api/combine", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          a: a.item.word,
          b: b.item.word,
          categoryA: a.item.category,
          categoryB: b.item.category,
          discovered: [...new Set([
            a.item.word,
            b.item.word,
            ...state.words.slice(-38).map((item) => item.word)
          ])].slice(0, 40),
          runId: state.run?.id,
          runToken: state.run?.token
        })
      });
    }
    if (orbitGeneration !== state.orbitGeneration || !state.game) return null;
    aElement?.classList.remove("combining");
    bElement?.classList.remove("combining");
    aElement?.classList.add("merging");
    bElement?.classList.add("merging");
    await wait(170);
    if (orbitGeneration !== state.orbitGeneration || !state.game) return null;
    state.moves += 1;
    if (state.moves === 1) track("first_combination", { mode: state.mode, training: learningOrbitActive() });
    let known = state.words.find((item) => item.word.toLowerCase() === result.word.toLowerCase());
    const newToRun = !known;
    const locallyKnown = profile.discovered.some((word) => word.toLowerCase() === result.word.toLowerCase());
    const newDiscovery = !isStaticBeta && typeof result.newDiscovery === "boolean" ? result.newDiscovery : !locallyKnown;
    if (!known) {
      result.discoveredAt ||= new Date().toISOString();
      state.words.push(result);
      known = result;
      if (newDiscovery) state.newDiscoveries += 1;
      if (!locallyKnown && !state.scoringDisabled) {
        profile.discovered.push(result.word);
        profile.discovered = profile.discovered.slice(0, 1000);
      }
    } else if (result.twisted) {
      Object.assign(known, result);
    }
    if (state.mode === "explore") {
      profile.exploreWords = mergeExploreInventory(profile.exploreWords, known);
      if (!profile.discovered.some((word) => inventoryKey(word) === inventoryKey(known))) profile.discovered.push(known.word);
      profile.discovered = profile.discovered.slice(0, 1000);
      saveProfile({ fields: ["mastery"] });
    } else if (!locallyKnown && !state.scoringDisabled) {
      saveProfile({ fields: ["mastery"] });
    }
    touchInventory(a.item);
    touchInventory(b.item);
    touchInventory(known, { focus: newToRun });
    renderInventory();
    if (result.division === "open") {
      const declaredPolicy = combineAssistance(state.assist, "open");
      const policy = combineAssistance(declaredPolicy.id, result.assist || "open");
      state.assist = policy.id;
      state.scoreMultiplier = cappedScoreMultiplier(state.assist, state.scoreMultiplier, declaredPolicy.scoreMultiplier, policy.scoreMultiplier, result.scoreMultiplier);
      state.run = { ...state.run, assist: state.assist, assisted: true, division: "open", scoreMultiplier: state.scoreMultiplier };
    }
    const eventAnnotation = annotateCosmicEventResult({ event: currentEventState().event, result });
    const journeyMatch = Boolean(state.journeyContext && inventoryKey(state.journeyContext.target) === inventoryKey(result.word));
    const insight = !result.twisted ? explainSuccessfulRecipe({
      a: a.item.word,
      b: b.item.word,
      word: result.word,
      source: result.source,
      ...(categoryForInsightWord(a.item.word) ? { categoryA: categoryForInsightWord(a.item.word) } : {}),
      ...(categoryForInsightWord(b.item.word) ? { categoryB: categoryForInsightWord(b.item.word) } : {}),
      ...(insightCategoryFor(result.category || known.category) ? { category: insightCategoryFor(result.category || known.category) } : {})
    }) : null;
    const historyStep = {
      a: a.item.word,
      b: b.item.word,
      word: result.word,
      emoji: result.emoji,
      category: result.category || known.category || "",
      source: result.source,
      newDiscovery,
      progressionEligible: result.progressionEligible === true,
      eventEligible: result.eventEligible === true,
      twisted: Boolean(result.twisted),
      canonicalWord: result.twist?.canonicalWord || "",
      feedbackEligible: result.feedbackEligible === true,
      insight: insight?.text || "",
      contextual: Boolean(journeyMatch || eventAnnotation.context?.collectionMatch),
      context: journeyMatch ? state.journeyContext.kind : eventAnnotation.context?.collectionMatch ? eventAnnotation.context.eventId : "",
      rarity: result.twisted ? 90 : eventAnnotation.context?.collectionMatch ? 55 : 0
    };
    state.history.push(historyStep);
    const mastery = recordMasteryStep(historyStep);
    state.trails.push({ ax: a.x + 44, ay: a.y + 20, bx: b.x + 44, by: b.y + 20, x: x + 44, y: y + 20 });
    if (state.trails.length > MAX_TRANSIENT_TRAILS) state.trails.splice(0, state.trails.length - MAX_TRANSIENT_TRAILS);
    state.nodes = state.nodes.filter((node) => node.id !== a.id && node.id !== b.id);
    aElement?.remove();
    bElement?.remove();
    boardGeometryVersion += 1;
    const resultNode = addNode(known, x, y, { cosmicTwist: Boolean(result.twisted) });
    const universeLabel = result.universeContext?.label ? ` · ${result.universeContext.label}` : "";
    showAlchemy(result.twisted
      ? `✦ COSMIC TWIST · ${a.item.word} + ${b.item.word} found ${result.emoji} ${result.word} instead of ${result.twist.canonicalWord}. Mix them again for ${result.twist.canonicalWord}.`
      : `${a.item.word} + ${b.item.word} = ${result.emoji} ${result.word}${universeLabel}${insight?.text ? ` · ${insight.text}` : ""}`, false, Boolean(result.twisted));
    const eventDiscovery = learningOrbitActive() || state.mode === "explore" ? null : await recordEventDiscovery(result);
    if (eventDiscovery?.notice) {
      queueAlchemyNotice(eventDiscovery.notice, false, true, { key: `event:${inventoryKey(result.word)}`, retain: true, maxAge: 12_000 });
    }
    if (mastery?.notice) {
      if (result.completed) state.resultMasteryNotice = mastery.notice;
      else queueAlchemyNotice(mastery.notice, false, false, { key: `mastery:${inventoryKey(mastery.notice)}`, retain: true, maxAge: 10_000 });
    }
    playFeedback(result.twisted ? "twist" : "success", { analytics: Boolean(result.twisted) });
    updateHud();
    updateMilestone();
    renderAtlas();
    const won = Boolean(result.completed || (secondOrbitActive() && inventoryKey(result.word) === inventoryKey(state.game.target)));
    track("combination_completed", { mode: state.mode, a: a.item.word, b: b.item.word, result: result.word, source: result.source, newDiscovery, twisted: Boolean(result.twisted) });
    if (!won && !learningOrbitActive() && historyStep.feedbackEligible) offerRecipeFeedback(historyStep, state.moves);
    if (won) setTimeout(() => finishGame(true), 480);
    else if (state.game.moveLimit && state.moves >= state.game.moveLimit) setTimeout(() => finishGame(false, "No moves remain in this orbit."), 350);
    return { node: resultNode, completed: won };
  } catch (error) {
    if (orbitGeneration !== state.orbitGeneration || !state.game) return null;
    for (const element of [aElement, bElement]) {
      element?.classList.remove("combining");
      element?.classList.remove("merging");
      element?.classList.add("rejected");
      setTimeout(() => element?.classList.remove("rejected"), 380);
    }
    const nearMiss = error.code === "combination_missing" ? explainRecipeNearMiss({
      a: a.item.word,
      b: b.item.word,
      ...(categoryForInsightWord(a.item.word) ? { categoryA: categoryForInsightWord(a.item.word) } : {}),
      ...(categoryForInsightWord(b.item.word) ? { categoryB: categoryForInsightWord(b.item.word) } : {}),
      discovered: state.words,
      recipes: authoredInsightCatalog()
    }) : null;
    showAlchemy(nearMiss?.text || error.message, true);
    if (error.code === "combination_missing" && !learningOrbitActive()) offerExpectedPairFeedback(a.item.word, b.item.word);
    playFeedback("reject");
    track("combination_rejected", { mode: state.mode, a: a.item.word, b: b.item.word });
    return null;
  } finally {
    if (orbitGeneration === state.orbitGeneration) {
      state.busyPairs.delete(a.id);
      state.busyPairs.delete(b.id);
    }
    aElement?.classList.remove("combining");
    bElement?.classList.remove("combining");
    updateBoardTools();
  }
}

function expectedPairKey(a, b) {
  return [inventoryKey(a), inventoryKey(b)].sort().join("+").slice(0, 120);
}

function resetExpectedPairFeedback() {
  clearTimeout(state.expectedPair?.timer);
  state.expectedPair = { a: "", b: "", key: "", submitted: false, timer: null };
  if (els.expectedPairFeedback) {
    els.expectedPairFeedback.hidden = true;
    els.expectedPairButton.disabled = false;
  }
  clearBoardAnnouncement("expected-pair");
}

function offerExpectedPairFeedback(a, b) {
  const key = expectedPairKey(a, b);
  if (!key || state.expectedPairReports.has(key) || !els.expectedPairFeedback) return;
  resetRecipeFeedback();
  state.expectedPair = { a: String(a).slice(0, 48), b: String(b).slice(0, 48), key, submitted: false, timer: null };
  $("#expectedPairRecipe").textContent = `${state.expectedPair.a} + ${state.expectedPair.b}`;
  els.expectedPairButton.textContent = "Expected this to work";
  els.expectedPairFeedback.hidden = false;
  announceBoardMessage(`No authored result for ${state.expectedPair.a} plus ${state.expectedPair.b}. You can report that you expected it to work.`, "expected-pair");
  state.expectedPair.timer = setTimeout(() => {
    if (els.expectedPairFeedback?.contains(document.activeElement)) return;
    resetExpectedPairFeedback();
  }, 9_000);
}

function recordLocalExpectedPair(a, b) {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_EXPECTED_PAIRS_KEY) || "null");
    const pairs = parsed?.pairs && typeof parsed.pairs === "object" && !Array.isArray(parsed.pairs) ? parsed.pairs : {};
    const bounded = Object.fromEntries(Object.entries(pairs).filter(([key, value]) => key.length <= 120 && Number.isFinite(Number(value))).slice(-255));
    const key = expectedPairKey(a, b);
    bounded[key] = Math.min(1000, Math.max(0, Math.floor(Number(bounded[key]) || 0)) + 1);
    localStorage.setItem(LOCAL_EXPECTED_PAIRS_KEY, JSON.stringify({ version: 1, pairs: bounded }));
  } catch { /* The explicit local report is optional. */ }
}

function submitExpectedPairFeedback() {
  const report = state.expectedPair;
  if (!report?.key || report.submitted || state.expectedPairReports.has(report.key)) return;
  report.submitted = true;
  state.expectedPairReports.add(report.key);
  els.expectedPairButton.disabled = true;
  els.expectedPairButton.textContent = "Reported · thank you";
  const properties = { mode: String(state.mode || "").slice(0, 24), a: report.a, b: report.b };
  if (isStaticBeta) recordLocalExpectedPair(report.a, report.b);
  else if (analyticsPreference) track("combination_expected", properties);
  else {
    const url = new URL("/api/analytics", location.origin);
    if (url.origin === location.origin) fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ name: "combination_expected", sessionId, properties, explicit: true })
    }).catch(() => {});
  }
  announceBoardMessage(`${report.a} plus ${report.b} was reported once for this orbit.`, "expected-pair");
  clearTimeout(report.timer);
  report.timer = setTimeout(resetExpectedPairFeedback, 2_400);
}

function resetRecipeFeedback() {
  clearTimeout(state.recipeFeedback.timer);
  clearTimeout(state.recipeFeedback.pendingTimer);
  state.recipeFeedback = { move: 0, step: null, timer: null, pendingTimer: null, submitted: false };
  if (els.recipeFeedback) {
    els.recipeFeedback.hidden = true;
    els.recipeFeedback.querySelectorAll("button").forEach((button) => { button.disabled = false; });
  }
  clearBoardAnnouncement("recipe-feedback");
}

function scheduleRecipeFeedbackExpiry(delay = 7600) {
  clearTimeout(state.recipeFeedback.timer);
  state.recipeFeedback.timer = setTimeout(() => {
    if (els.recipeFeedback?.contains(document.activeElement)) return scheduleRecipeFeedbackExpiry(3000);
    resetRecipeFeedback();
  }, delay);
}

function offerRecipeFeedback(step, move) {
  if (!step?.feedbackEligible || step.twisted || step.revealed || !els.recipeFeedback || !state.run?.id || !state.run?.token || !Number.isInteger(move) || move < 1) return;
  resetRecipeFeedback();
  state.recipeFeedback.move = move;
  state.recipeFeedback.step = { a: step.a, b: step.b, word: step.word };
  $("#recipeFeedbackRecipe").textContent = `${step.a} + ${step.b} → ${step.word}`;
  const revealFeedback = () => {
    if (!state.game || state.finished || state.recipeFeedback.move !== move) return;
    if (boardNoticeBusy()) {
      state.recipeFeedback.pendingTimer = setTimeout(revealFeedback, 280);
      return;
    }
    els.recipeFeedback.hidden = false;
    announceBoardMessage(`Optional recipe rating: ${step.a} plus ${step.b} made ${step.word}.`, "recipe-feedback");
    scheduleRecipeFeedbackExpiry();
  };
  state.recipeFeedback.pendingTimer = setTimeout(revealFeedback, 1650);
}

function recordLocalRecipeVote(step, rating) {
  const fingerprint = recipeFingerprint(step);
  const safeRating = sanitizeRecipeRating(rating);
  if (!fingerprint || !safeRating) return;
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_RECIPE_FEEDBACK_KEY) || "null");
    const source = parsed?.recipes && typeof parsed.recipes === "object" && !Array.isArray(parsed.recipes) ? parsed.recipes : {};
    const recipes = {};
    const entries = Object.entries(source);
    const prioritized = [entries.find(([key]) => key === fingerprint), ...entries.filter(([key]) => key !== fingerprint)].filter(Boolean).slice(0, 199);
    for (const [key, value] of prioritized) {
      if (!/^[a-z0-9]{7,16}$/.test(key) || !value || typeof value !== "object" || Array.isArray(value)) continue;
      recipes[key] = {
        logical: clamp(Math.floor(Number(value.logical) || 0), 0, 100_000),
        surprising: clamp(Math.floor(Number(value.surprising) || 0), 0, 100_000),
        bad: clamp(Math.floor(Number(value.bad) || 0), 0, 100_000)
      };
    }
    recipes[fingerprint] ||= { logical: 0, surprising: 0, bad: 0 };
    recipes[fingerprint][safeRating] = Math.min(100_000, recipes[fingerprint][safeRating] + 1);
    localStorage.setItem(LOCAL_RECIPE_FEEDBACK_KEY, JSON.stringify({ version: 1, recipes }));
  } catch { /* Recipe QA is optional and never interrupts play. */ }
}

async function submitRecipeFeedback(rating) {
  if (state.recipeFeedback.submitted) return;
  const request = createRecipeFeedbackRequest({
    runId: state.run?.id,
    runToken: state.run?.token,
    move: state.recipeFeedback.move,
    rating
  });
  if (!request) return resetRecipeFeedback();
  state.recipeFeedback.submitted = true;
  els.recipeFeedback.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  try {
    await fetchJson("/api/recipe-feedback", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(request)
    });
    if (isStaticBeta) recordLocalRecipeVote(state.recipeFeedback.step, rating);
    track("recipe_feedback_submitted", { rating });
  } catch {
    showToast("Recipe feedback will be available again on a later discovery.");
  } finally {
    resetRecipeFeedback();
  }
}

function resetRevealPlayback({ keepConstellation = false } = {}) {
  resetRecipeFeedback();
  const previous = state.reveal || {};
  previous.wake?.();
  state.reveal = {
    active: false,
    paused: false,
    speed: 1,
    skip: false,
    pending: false,
    revealed: keepConstellation ? Boolean(previous.revealed) : false,
    replayAvailable: keepConstellation ? Boolean(previous.replayAvailable) : false,
    replayUsed: keepConstellation ? Boolean(previous.replayUsed) : false,
    replaying: false,
    phase: keepConstellation ? previous.phase || "idle" : "idle",
    generation: Number(previous.generation || 0) + 1,
    route: keepConstellation ? previous.route || [] : [],
    completed: keepConstellation ? previous.completed || 0 : 0,
    layout: keepConstellation ? previous.layout || null : null,
    wake: null
  };
  if (els.revealController) els.revealController.hidden = true;
  els.revealController?.classList.remove("is-paused", "is-complete");
  els.board?.classList.remove("reveal-active");
  els.revealDialog?.classList.remove("is-pending");
  $$('[data-close="revealDialog"]').forEach((button) => { button.disabled = false; });
  const confirm = $("#confirmReveal");
  if (confirm) {
    confirm.disabled = false;
    confirm.querySelector("span").textContent = "Reveal and forfeit score";
  }
  if (!keepConstellation) els.board?.classList.remove("reveal-complete");
}

function openRevealPath() {
  if (!state.game || !state.run || state.startingRun || state.reveal.revealed || state.reveal.active || state.reveal.pending) return;
  if (state.busyPairs.size) return showToast("Let the current combination resolve before revealing the path.");
  ctrlHover.reset();
  shiftBoard.reset();
  stopTimer();
  $("#revealTitle").textContent = `Reveal the path to ${state.game.target}?`;
  const warnings = {
    daily: "Today's scored challenge will be consumed. Replays stay unranked.",
    quick: "Today's sprint will be forfeited. Replays of it stay unranked.",
    moves: "Today's move challenge will be forfeited. Replays stay unranked.",
    weekly: "This expedition stage will grant no progress, and its replays stay unranked."
  };
  $("#revealModeWarning").textContent = state.scoringDisabled
    ? "This orbit is already unranked. The revealed words will still remain temporary."
    : warnings[state.mode] || "This orbit will become a zero-score Study run.";
  els.revealDialog.showModal();
}

async function confirmRevealPath() {
  if (!state.game || !state.run || state.reveal.active || state.reveal.pending) return;
  if (state.busyPairs.size) return showToast("Let the current combination resolve before revealing the path.");
  const revealState = state.reveal;
  const runId = state.run.id;
  const runToken = state.run.token;
  const mode = state.mode;
  const target = state.game.target;
  const button = $("#confirmReveal");
  const label = button.querySelector("span");
  const dismissers = $$('[data-close="revealDialog"]');
  let pendingUiCleared = false;
  const clearPendingUi = () => {
    revealState.pending = false;
    button.disabled = false;
    dismissers.forEach((control) => { control.disabled = false; });
    els.revealDialog.classList.remove("is-pending");
    label.textContent = "Reveal and forfeit score";
    pendingUiCleared = true;
  };
  revealState.pending = true;
  button.disabled = true;
  dismissers.forEach((control) => { control.disabled = true; });
  els.revealDialog.classList.add("is-pending");
  label.textContent = "Committing assisted run…";
  try {
    const payload = await fetchJson("/api/run/reveal", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ runId, runToken })
    });
    if (state.reveal !== revealState || state.run?.id !== runId || state.game?.target !== target) return;
    state.assist = "reveal";
    state.scoringDisabled = true;
    state.scoreMultiplier = 0;
    state.run = { ...state.run, assist: "reveal", ranked: false, scoreEligible: false, scoreMultiplier: 0, leaderboardEligible: false, assisted: true, division: "study" };
    clearActiveRunSnapshot();
    stopTimer();
    if (mode === "daily") {
      profile.dailyCompleted = todayKey;
      saveProfile({ fields: ["progression"] });
    }
    const route = Array.isArray(payload.route) ? payload.route : [];
    if (els.revealDialog.open) els.revealDialog.close();
    clearPendingUi();
    track("answer_revealed", { mode, target, steps: route.length });
    await playRevealPath(route);
  } catch (error) {
    if (state.reveal === revealState && state.run?.id === runId) showToast(error.message);
  } finally {
    if (!pendingUiCleared && state.reveal === revealState) clearPendingUi();
  }
}

function buildRevealLayout(route) {
  const positions = new Map([
    ["earth", { x: .12, y: .82 }],
    ["water", { x: .36, y: .88 }],
    ["fire", { x: .64, y: .88 }],
    ["air", { x: .88, y: .82 }]
  ]);
  const segments = route.map((step, index) => {
    const progress = route.length <= 1 ? 1 : index / (route.length - 1);
    const final = index === route.length - 1;
    const to = {
      x: final ? .5 : .2 + (stableHash(step.word) % 600) / 1000,
      y: .7 - progress * .53
    };
    const a = positions.get(String(step.a).toLowerCase()) || { x: .22, y: Math.min(.9, to.y + .18) };
    const b = positions.get(String(step.b).toLowerCase()) || { x: .78, y: Math.min(.9, to.y + .18) };
    positions.set(String(step.word).toLowerCase(), to);
    return { a, b, to };
  });
  return { segments };
}

function revealItem(word, fallback = {}) {
  return state.words.find((item) => item.word.toLowerCase() === String(word).toLowerCase()) || {
    word,
    emoji: fallback.emoji || starterEmoji[word] || "✦",
    category: fallback.category || starterCategory[word] || "nature",
    source: "reveal",
    ghost: true
  };
}

function addRevealDiscovery(step) {
  const existing = state.words.find((item) => item.word.toLowerCase() === String(step.word).toLowerCase());
  if (existing) return existing;
  const item = {
    word: step.word,
    emoji: step.emoji || "✦",
    category: step.category || "nature",
    note: step.note || "Revealed by the cosmos.",
    source: "reveal",
    ghost: true
  };
  state.words.push(item);
  renderInventory();
  return item;
}

function wakeRevealPlayback() {
  const wake = state.reveal.wake;
  state.reveal.wake = null;
  wake?.();
}

async function revealDelay(milliseconds, generation) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let remaining = state.reveal.skip ? 0 : reduced ? Math.min(40, milliseconds) : milliseconds / state.reveal.speed;
  while (remaining > 0) {
    if (generation !== state.reveal.generation || !state.reveal.active) return false;
    if (state.reveal.paused || document.hidden) {
      await new Promise((resolve) => { state.reveal.wake = resolve; });
      continue;
    }
    const slice = Math.min(50, remaining);
    await wait(slice);
    remaining -= slice;
    if (state.reveal.skip) remaining = 0;
  }
  return generation === state.reveal.generation && state.reveal.active;
}

function updateRevealController(stepIndex = state.reveal.completed, step = null) {
  const total = state.reveal.route.length;
  const complete = stepIndex >= total;
  const label = complete
    ? state.reveal.replaying
      ? "Replay complete · returning to mode selection…"
      : `Constellation complete · ${total} combinations traced`
    : step
      ? `Step ${stepIndex + 1} of ${total}: ${step.a} + ${step.b} → ${step.word}`
      : "Preparing the constellation…";
  els.revealStepText.textContent = label;
  els.revealAnnouncement.textContent = label;
  els.revealProgressBar.style.width = `${total ? Math.min(100, stepIndex / total * 100) : 100}%`;
  els.revealProgressBar.parentElement?.setAttribute("aria-valuenow", String(total ? Math.round(Math.min(100, stepIndex / total * 100)) : 100));
  els.revealPause.disabled = complete;
  els.revealSpeed.disabled = complete;
  els.revealSkip.hidden = complete;
  els.revealController.classList.toggle("is-paused", state.reveal.paused && !complete);
  els.revealController.classList.toggle("is-complete", complete);
}

function moveRevealNode(node, x, y) {
  node.x = x;
  node.y = y;
  const element = els.boardItems.querySelector(`[data-id="${node.id}"]`);
  if (!element) return;
  element.classList.add("guided-drop");
  element.style.setProperty("--x", `${x}px`);
  element.style.setProperty("--y", `${y}px`);
}

async function playRevealPath(route, { replay = false } = {}) {
  const generation = state.reveal.generation + 1;
  const runId = state.run?.id;
  ctrlHover.reset({ abandonPending: true });
  shiftBoard.reset();
  resetRecipeFeedback();
  clearBoardNotices();
  if (!replay) state.finished = false;
  state.nodes = [];
  state.selectedNodeId = null;
  state.reveal = {
    active: true,
    paused: false,
    speed: 1,
    skip: false,
    pending: false,
    revealed: true,
    replayAvailable: false,
    replayUsed: replay,
    replaying: replay,
    phase: replay ? "replay" : "first",
    generation,
    route,
    completed: 0,
    layout: buildRevealLayout(route),
    wake: null
  };
  els.board.classList.add("reveal-active");
  els.board.classList.remove("reveal-complete");
  els.revealController.hidden = false;
  els.revealController.classList.remove("is-paused", "is-complete");
  els.revealPause.textContent = "Pause";
  els.revealPause.setAttribute("aria-pressed", "false");
  els.revealSpeed.textContent = "1×";
  els.revealSkip.hidden = false;
  renderInventory();
  renderBoard();
  updateHud();
  updateRevealController(0, route[0]);
  startCosmos();

  if (!route.length) {
    const target = revealItem(state.game.target, { emoji: state.game.emoji });
    const rect = els.board.getBoundingClientRect();
    state.nodes = [];
    addNode(target, rect.width / 2 - 55, rect.height * .35, { revealRole: "target" });
  }

  for (let index = 0; index < route.length; index += 1) {
    if (generation !== state.reveal.generation) return;
    const step = route[index];
    const rect = els.board.getBoundingClientRect();
    const segment = state.reveal.layout.segments[index];
    const targetX = clamp(segment.to.x * rect.width - 48, 10, Math.max(10, rect.width - 150));
    const targetY = clamp(segment.to.y * rect.height - 22, 58, Math.max(58, rect.height - 88));
    const spread = Math.min(150, rect.width * .25);
    const sourceY = clamp(targetY + Math.min(145, rect.height * .2), 70, Math.max(70, rect.height - 72));
    const leftItem = revealItem(step.a);
    const rightItem = revealItem(step.b);
    state.nodes = [];
    const left = addNode(leftItem, clamp(targetX - spread, 8, rect.width - 155), sourceY, { revealRole: "source" });
    const right = addNode(rightItem, clamp(targetX + spread, 8, rect.width - 155), sourceY, { revealRole: "source" });
    updateRevealController(index, step);
    if (!await revealDelay(620, generation)) return;
    moveRevealNode(left, targetX - 18, targetY + 6);
    moveRevealNode(right, targetX + 18, targetY + 6);
    if (!await revealDelay(520, generation)) return;
    els.boardItems.querySelectorAll(".reveal-source").forEach((element) => element.classList.add("merging"));
    if (!await revealDelay(220, generation)) return;
    const result = addRevealDiscovery(step);
    state.nodes = [];
    addNode(result, targetX, targetY, { revealRole: index === route.length - 1 ? "target" : "result" });
    if (!replay) {
      state.moves += 1;
      state.history.push({ a: step.a, b: step.b, word: step.word, emoji: result.emoji, source: "reveal", newDiscovery: false, revealed: true });
    }
    state.reveal.completed = index + 1;
    if (!replay) {
      updateHud();
      updateMilestone(index === route.length - 1);
      renderAtlas();
    }
    updateRevealController(index + 1, route[index + 1]);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) startCosmos();
    playFeedback("success");
    if (!await revealDelay(620, generation)) return;
  }

  if (generation !== state.reveal.generation) return;
  state.reveal.active = false;
  state.reveal.completed = route.length;
  els.board.classList.remove("reveal-active");
  els.board.classList.add("reveal-complete");
  updateRevealController(route.length);
  if (replay) {
    state.reveal.phase = "exiting";
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    await wait(route.length ? reduced ? 320 : 900 : reduced ? 480 : 1150);
    if (generation !== state.reveal.generation || state.run?.id !== runId || state.reveal.phase !== "exiting") return;
    returnHome();
    return;
  }
  state.reveal.replayAvailable = true;
  state.reveal.phase = "first-complete";
  finishGame(true);
}

async function replayRevealPathOnce() {
  const revealState = state.reveal;
  if (!state.game || !state.run || !state.finished || revealState.active || !revealState.replayAvailable || revealState.replayUsed) return;
  const route = revealState.route.map((step) => ({ ...step }));
  const resultActions = [els.resultPrimary, els.resultRetry, $("#resultLeaderboard"), els.resultShare, $("#resultReveal")];
  revealState.replayAvailable = false;
  revealState.replayUsed = true;
  revealState.phase = "replay";
  state.resultAction = null;
  resultActions.forEach((control) => { control.disabled = true; });
  if (els.resultDialog.open) els.resultDialog.close();
  try {
    await playRevealPath(route, { replay: true });
  } finally {
    resultActions.forEach((control) => { control.disabled = false; });
  }
}

function toggleRevealPause() {
  if (!state.reveal.active) return;
  state.reveal.paused = !state.reveal.paused;
  els.revealPause.textContent = state.reveal.paused ? "Resume" : "Pause";
  els.revealPause.setAttribute("aria-pressed", String(state.reveal.paused));
  els.revealController.classList.toggle("is-paused", state.reveal.paused);
  if (!state.reveal.paused) wakeRevealPlayback();
}

function cycleRevealSpeed() {
  if (!state.reveal.active) return;
  const speeds = [.5, 1, 2];
  state.reveal.speed = speeds[(speeds.indexOf(state.reveal.speed) + 1) % speeds.length];
  els.revealSpeed.textContent = `${state.reveal.speed}×`;
  els.revealSpeed.setAttribute("aria-label", `Reveal speed: ${state.reveal.speed} times`);
  wakeRevealPlayback();
}

function skipRevealAnimation() {
  if (!state.reveal.active) return;
  state.reveal.skip = true;
  state.reveal.paused = false;
  els.revealPause.textContent = "Pause";
  els.revealPause.setAttribute("aria-pressed", "false");
  els.revealController.classList.remove("is-paused");
  wakeRevealPlayback();
}

function calculateReward() {
  if (state.scoringDisabled) return { reward: 0, reason: "Study path · no progression rewards" };
  let reward = state.game.reward || 70;
  const reasons = [];
  if (state.newDiscoveries) {
    reward += state.newDiscoveries * 3;
    reasons.push(`${state.newDiscoveries} new discoveries`);
  }
  if (state.game.timeLimit && state.remainingSeconds > 0) {
    const bonus = Math.round(state.remainingSeconds * .4);
    reward += bonus;
    reasons.push("time bonus");
  }
  if (state.game.moveLimit && state.moves < state.game.moveLimit) {
    reward += (state.game.moveLimit - state.moves) * 4;
    reasons.push("moves saved");
  }
  if (state.game.law?.id === "first-light" && state.newDiscoveries) reward += 10;
  if (state.game.law?.id === "twin-stars") reward += state.history.filter((step) => step.a === step.b).length * 5;
  if (state.game.law?.id === "deep-space" && state.moves <= 8) reward += 20;
  if (state.game.law?.id === "bright-path") reward += state.newDiscoveries * 2;
  return { reward, reason: reasons.join(" · ") || "Constellation complete" };
}

function updateDailyStreak() {
  if (profile.lastDailyDate === todayKey) return;
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  const last = profile.lastDailyDate ? Date.parse(`${profile.lastDailyDate}T00:00:00Z`) : 0;
  const gap = last ? Math.round((today - last) / 86400000) : Infinity;
  if (gap === 1) profile.dailyStreak += 1;
  else if (gap === 2 && profile.streakShields > 0) {
    profile.streakShields -= 1;
    profile.dailyStreak += 1;
  } else profile.dailyStreak = 1;
  profile.lastDailyDate = todayKey;
  profile.dailyCompleted = todayKey;
}

function buildSignatureResult(won, { training = false, revealed = false } = {}) {
  state.signature = null;
  if (!won || training || !state.history.length) return null;
  const input = {
    history: state.history,
    target: state.game?.target,
    completed: true,
    moves: state.moves,
    parMoves: Math.max(1, 3 + (Number(state.game?.tier) || 1) * 3),
    game: state.game,
    mode: state.mode,
    challengeId: state.game?.challengeId || state.run?.challengeId,
    assist: state.assist,
    scoreMultiplier: state.scoreMultiplier,
    scoringDisabled: state.scoringDisabled,
    revealed
  };
  const grade = gradeSignatureRoute(input);
  const signature = createRouteSignature(input);
  if (!signature) return null;
  const awaitingVerification = Boolean(signature.scoreEligible && state.run?.ranked && !isStaticBeta);
  let comparison = { comparable: true, improved: false, reason: "study", delta: 0, best: null };
  if (signature.scoreEligible) {
    const previous = profile.signatureBests.find((entry) => entry.scopeKey === signature.scopeKey) || null;
    comparison = comparePersonalBest(signature, previous);
    if (comparison.improved && !awaitingVerification) {
      profile.signatureBests = sanitizeSignatureBests([signature, ...profile.signatureBests.filter((entry) => entry.scopeKey !== signature.scopeKey)]);
      saveProfile({ fields: ["signatures"] });
    }
  }
  state.signature = { grade, signature, comparison, awaitingVerification, runId: state.run?.id || "" };
  track("signature_graded", { mode: state.mode, score: signature.score, tier: signature.tier, improved: comparison.improved, eligible: signature.scoreEligible });
  return state.signature;
}

function renderSignatureResult() {
  const result = state.signature;
  els.signatureResultCard.hidden = !result;
  if (!result) return;
  const { grade, signature, comparison } = result;
  const symbols = { study: "0", spark: "✦", orbit: "C", constellation: "B", nova: "A", singularity: "S" };
  $("#signatureResultGrade").textContent = symbols[signature.tier] || "✦";
  $("#signatureResultTitle").textContent = signature.tierLabel;
  $("#signatureResultScore").textContent = signature.scoreEligible ? String(signature.score) : "STUDY";
  $("#signatureResultSummary").textContent = signature.scoreEligible
    ? `${grade.metrics.uniqueResults} distinct results across ${grade.metrics.categories} idea families.`
    : "This route can be studied and replayed, but it cannot become a scored personal best.";
  const metrics = [
    ["Efficiency", grade.dimensions.efficiency],
    ["Discovery", grade.dimensions.novelty],
    ["Originality", grade.dimensions.variety],
    ["Fair play", grade.dimensions.purity]
  ];
  $("#signatureResultMetrics").replaceChildren(...metrics.map(([label, value]) => {
    const item = document.createElement("span");
    item.innerHTML = `<small>${escapeHtml(label)}</small><strong>${Number(value)}</strong>`;
    return item;
  }));
  $("#signaturePersonalBest").textContent = result.awaitingVerification
    ? "Server verification will confirm this Signature and personal best."
    : !signature.scoreEligible
    ? "Study signatures are descriptive only."
    : comparison.reason === "first"
      ? "First personal signature recorded for this destination."
      : comparison.improved
        ? `New personal best · +${Math.max(0, comparison.delta)} signature points.`
        : `Personal best remains ${comparison.best?.score ?? signature.score}.`;
}

function adoptVerifiedSignature(raw, { runId = "", updateCurrent = true } = {}) {
  const signature = sanitizeRouteSignature(raw);
  if (!signature) return null;
  const previous = profile.signatureBests.find((entry) => entry.scopeKey === signature.scopeKey) || null;
  const comparison = comparePersonalBest(signature, previous);
  if (signature.scoreEligible && comparison.improved) {
    profile.signatureBests = sanitizeSignatureBests([signature, ...profile.signatureBests.filter((entry) => entry.scopeKey !== signature.scopeKey)]);
    saveProfile({ fields: ["signatures"] });
  }
  const currentRunMatches = Boolean(
    updateCurrent
    && state.signature
    && (!runId || state.signature.runId === runId)
  );
  if (currentRunMatches) {
    state.signature = {
      ...state.signature,
      signature,
      comparison,
      awaitingVerification: false,
      grade: {
        ...state.signature.grade,
        dimensions: { ...signature.dimensions },
        metrics: {
          ...state.signature.grade.metrics,
          moves: signature.moves,
          idealMoves: signature.idealMoves,
          newDiscoveries: signature.discoveries,
          categories: signature.categories,
          contextualSteps: signature.contextualSteps
        }
      }
    };
  }
  return { signature, comparison, updatedCurrent: currentRunMatches };
}

function communityStat(label, value) {
  const item = document.createElement("span");
  const name = document.createElement("small");
  const score = document.createElement("strong");
  name.textContent = label;
  score.textContent = value;
  item.append(name, score);
  return item;
}

function renderCommunityResult(community = null, { loading = false, status = "" } = {}) {
  if (Array.isArray(community)) community = buildCommunityResults(community, { playerId: profile.playerId });
  const phase = status || (loading ? "uploading" : community ? "verified" : isStaticBeta ? "local" : "verified-empty");
  state.community = phase === "verified" ? community : null;
  const eligible = Boolean(state.finished && state.game && !firstOrbitActive() && !state.scoringDisabled && state.assist !== "reveal");
  const shouldShow = phase !== "hidden" && eligible && (isStaticBeta || state.run?.ranked);
  els.communityResultCard.hidden = !shouldShow;
  if (!shouldShow) return;
  const race = $("#raceCommunityGhost");
  if (phase === "uploading") {
    $("#communityResultTitle").textContent = "Mapping verified routes…";
    els.communityResultStats.replaceChildren(communityStat("STATUS", "UPLOADING"));
    $("#communityResultNote").textContent = "Your result stays safe locally while the community sky is checked.";
    race.hidden = true;
    return;
  }
  if (isStaticBeta) {
    $("#communityResultTitle").textContent = "Community sky opens in the online release";
    els.communityResultStats.replaceChildren(
      communityStat("THIS BUILD", isStaticBeta ? "LOCAL" : "1"),
      communityStat("YOUR PATH", "ORIGINAL")
    );
    $("#communityResultNote").textContent = "Pages and itch practice never invent player counts or upload your route. Verified asynchronous comparisons require the online service.";
    race.hidden = true;
    return;
  }
  if (["pending", "error"].includes(phase)) {
    const pending = phase === "pending";
    $("#communityResultTitle").textContent = pending ? "Community upload pending" : "Community check interrupted";
    els.communityResultStats.replaceChildren(communityStat("STATUS", pending ? "SAVED LOCALLY" : "NOT VERIFIED"));
    $("#communityResultNote").textContent = pending
      ? "No position is claimed until the saved route reaches the server and a verified sky is returned."
      : "No verified community position is available for this attempt. Retry the score upload to compare routes.";
    race.hidden = true;
    return;
  }
  if (phase === "unavailable") {
    $("#communityResultTitle").textContent = "Community comparison not loaded";
    els.communityResultStats.replaceChildren(communityStat("STATUS", "NOT LOADED"));
    $("#communityResultNote").textContent = "This completed route has no fresh community response on this screen, so no position is claimed.";
    race.hidden = true;
    return;
  }
  if (!community) {
    $("#communityResultTitle").textContent = "No comparable verified routes returned";
    els.communityResultStats.replaceChildren(
      communityStat("COMPARABLE ROUTES", "0"),
      communityStat("STATUS", "VERIFIED EMPTY")
    );
    $("#communityResultNote").textContent = "The server verified this result, but returned no routes in the same comparison group.";
    race.hidden = true;
    return;
  }
  $("#communityResultTitle").textContent = community.player
    ? community.completedRoutes === 1 && community.player.rank === 1
      ? "First route in this community sky"
      : `Top ${community.player.topPercent}% of this community sky`
    : `${community.completedRoutes} verified routes mapped`;
  els.communityResultStats.replaceChildren(
    communityStat("COMPLETIONS", Number(community.completedRoutes || 0).toLocaleString()),
    communityStat("AVG MOVES", String(community.averageMoves || "—")),
    communityStat("ROUTE VARIETY", `${community.signatureVarietyPercent || 0}%`)
  );
  $("#communityResultNote").textContent = community.mostOriginal
    ? `Most original visible route: ${community.mostOriginal.callsign} · ${community.mostOriginal.tier}. Comparisons are asynchronous, never live multiplayer.`
    : "Comparisons use completed asynchronous routes, never live multiplayer.";
  race.hidden = !community.nearby;
  if (["daily", "weekly"].includes(state.mode)) race.hidden = true;
}

function queueNearbyCommunityRace() {
  const nearby = state.community?.nearby;
  if (!nearby || !state.game) return false;
  const division = ["pure", "open"].includes(state.leaderboardDivision) ? state.leaderboardDivision : "pure";
  state.ghost.nextRival = {
    callsign: String(nearby.callsign || "Nearby Stargazer").slice(0, 48),
    moves: clamp(Number(nearby.moves) || 1, 1, 1_000),
    elapsedMs: clamp(Number(nearby.seconds) * 1_000 || 1_000, 1_000, 86_400_000),
    target: String(state.game.target || "").slice(0, 80),
    scope: ghostLeaderboardScope(state.mode),
    division
  };
  return true;
}

function continueJourneyFromResult(view) {
  if (els.resultDialog.open) els.resultDialog.close();
  returnHome();
  requestAnimationFrame(() => {
    const recoveryDialog = $("#recoveryDialog");
    if (recoveryDialog.open) {
      recoveryDialog.addEventListener("close", () => openJourneyHub(view), { once: true });
      return;
    }
    openJourneyHub(view);
  });
}

function finishGame(won, reason = "", { skipSubmit = false } = {}) {
  if (state.finished) return;
  if (els.pauseDialog.open) {
    pauseCloseRestoreFocus = false;
    els.pauseDialog.close();
  }
  state.pause.active = false;
  els.gameScreen.classList.remove("orbit-paused");
  ctrlHover.reset({ abandonPending: true });
  cancelActiveTrayDrag();
  cancelActiveBoardDrag();
  shiftBoard.reset();
  cancelTapChain();
  dismissClearUndo();
  resetRecipeFeedback();
  clearBoardNotices();
  state.finished = true;
  syncFirstOrbitGuide();
  stopTimer();
  stopRivalGhost({ completed: won });
  if (won && !state.reveal.revealed) playFeedback("target", { analytics: true });
  updateMilestone(won);
  const elapsed = state.finishedElapsedSeconds || Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  state.finishedElapsedSeconds = elapsed;
  const firstTraining = firstOrbitActive();
  const secondTraining = secondOrbitActive();
  const training = firstTraining || secondTraining;
  const assisted = Boolean(training || state.scoringDisabled || state.assist === "reveal");
  const partialAssist = !assisted && state.scoreMultiplier < 1;
  const revealed = assisted && state.reveal.revealed;
  buildSignatureResult(won, { training, revealed });
  const pendingRankedSubmit = Boolean(won && !assisted && !skipSubmit && state.run?.ranked);
  if (pendingRankedSubmit) {
    const saved = saveCompletedRunSnapshot();
    state.scoreSubmission = { runId: state.run.id, ...saved, inFlight: false, exitAction: null, exitLabel: "" };
  }
  else {
    state.scoreSubmission = { runId: "", activeSaved: false, pendingSaved: false, inFlight: false, exitAction: null, exitLabel: "" };
    clearActiveRunSnapshot();
  }
  let reward = null;
  let voyageProgressAdvanced = false;
  const rewardRunId = String(state.run?.id || "").trim();
  const progressionAlreadyGranted = Boolean(rewardRunId && sanitizeRewardedRunIds(profile.rewardedRunIds).includes(rewardRunId));
  state.resultAction = returnHome;
  $("#rankResultCard").hidden = isStaticBeta || !won || assisted;
  $("#resultLeaderboard").hidden = isStaticBeta || !won || assisted || !state.run?.ranked;
  $("#assistResultCard").hidden = !assisted;
  $("#partialAssistResultCard").hidden = !partialAssist;
  if (partialAssist) {
    const policy = assistancePolicy(state.assist);
    $("#partialAssistScore").textContent = `${Math.round(state.scoreMultiplier * 100)}% SCORE`;
    $("#partialAssistDetail").textContent = `${policy.label} kept this result score-eligible in Open. Stardust and verified score use the same visible reduction.`;
  }
  if (assisted) $("#assistResultCard small").textContent = training
    ? "Training is never scored and grants no leaderboard place, Stardust, mastery, saved discoveries, streak progress, or rewards."
    : revealed
      ? "One visual replay is available. It returns to mode selection and grants no progression."
      : "This Study orbit grants no score, leaderboard place, rewards, or progression.";
  $("#resultReveal").hidden = won || assisted || !state.run;
  if (won && !assisted && !progressionAlreadyGranted) {
    reward = calculateReward();
    if (state.mode === "daily") updateDailyStreak();
    if (state.mode === "weekly") {
      profile.weekly.stage += 1;
      if (profile.weekly.stage >= 3) {
        profile.weekly.stage = 3;
        profile.weekly.complete = true;
        profile.streakShields += 1;
        reward.reward += 150;
        reward.reason += " · expedition complete";
      } else {
        state.resultAction = () => {
          els.resultDialog.close();
          beginMode("weekly");
        };
      }
    }
    if (state.journeyContext?.kind === "voyage") {
      const advanced = advanceVoyageProgress(profile.voyageProgress, {
        voyageId: state.journeyContext.voyageId,
        target: state.game.target
      });
      if (advanced.advanced) {
        voyageProgressAdvanced = true;
        profile.voyageProgress = advanced.progress;
        reward.reward += VOYAGE_REWARD;
        reward.reason += advanced.reason === "voyage_complete" ? " · Voyage complete" : " · Voyage chapter";
        state.resultAction = () => continueJourneyFromResult("voyage");
        track("voyage_completed", { collection: state.journeyContext.voyageId, stage: state.journeyContext.chapterId, complete: advanced.reason === "voyage_complete" });
      }
    } else if (state.journeyContext?.kind === "event") {
      state.resultAction = () => continueJourneyFromResult("event");
    }
    if (partialAssist) {
      const baseReward = reward.reward;
      reward.reward = Math.max(1, Math.round(baseReward * state.scoreMultiplier));
      reward.reason += ` · Open ${Math.round(state.scoreMultiplier * 100)}% of ${baseReward}`;
    }
    if (state.eventRewardGranted) {
      reward.reward += state.eventRewardGranted;
      reward.reason += ` · event collection +${state.eventRewardGranted}`;
    }
    profile.stardust += reward.reward - state.eventRewardGranted;
    profile.wins += 1;
    profile.rewardedRunIds = sanitizeRewardedRunIds([rewardRunId, ...profile.rewardedRunIds]);
    saveProfile({ fields: ["progression", ...(state.journeyContext ? ["journeys"] : [])] });
  } else if (won && !assisted) {
    reward = { reward: 0, reason: "Progression already granted for this completed orbit." };
    if (state.journeyContext?.kind === "event") state.resultAction = () => continueJourneyFromResult("event");
  } else if (won && training) {
    if (firstTraining) {
      profile.firstOrbit = { seen: true, completed: true };
      saveProfile({ fields: ["firstOrbit"] });
      track("first_orbit_completed", { moves: state.moves, seconds: elapsed });
      state.resultAction = () => {
        if (els.resultDialog.open) els.resultDialog.close();
        openSecondOrbitBriefing(els.resultPrimary);
      };
    } else {
      profile.secondOrbit = { seen: true, completed: true };
      saveProfile({ cloud: false });
      track("second_orbit_completed", { moves: state.moves, seconds: elapsed });
      const nextMode = profile.dailyCompleted === todayKey ? "reach" : "daily";
      state.resultAction = () => {
        if (els.resultDialog.open) els.resultDialog.close();
        void beginMode(nextMode);
      };
    }
  } else if (won && revealed) {
    state.resultAction = replayRevealPathOnce;
  }
  els.resultEmoji.textContent = won ? state.game.emoji : state.mode === "quick" ? "⌛" : "◇";
  els.resultKicker.textContent = training && won
    ? `${firstTraining ? "FIRST" : "SECOND"} ORBIT COMPLETE · TRAINING`
    : revealed
    ? "PATH REVEALED · STUDY"
    : won
    ? isStaticBeta
      ? "LOCAL TARGET REACHED"
      : state.mode === "weekly" && !profile.weekly.complete
        ? `STAGE ${state.game.stage + 1} COMPLETE`
        : "TARGET REACHED"
    : "ORBIT ENDED";
  els.resultTitle.textContent = training && won
    ? firstTraining ? "You built your first constellation." : "You reached Mountain on your own route."
    : revealed ? `The cosmos revealed ${state.game.target}.` : won ? `You found ${state.game.target}.` : reason;
  const timeStat = state.game.timeLimit || state.mode === "challenge" ? ` · ${formatTime(elapsed)} elapsed` : "";
  els.resultStats.textContent = training
    ? `${state.history.length} guided combinations · ${formatTime(elapsed)} elapsed · 0 score`
    : revealed
    ? `${state.reveal.route.length} combinations traced · 0 score · no discoveries saved`
    : `${state.words.length} discoveries · ${state.moves} moves${timeStat}${state.wished ? " · 1 Wish" : ""}${partialAssist ? ` · Open ${Math.round(state.scoreMultiplier * 100)}%` : ""}`;
  els.resultMasteryCard.hidden = !won || !state.resultMasteryNotice;
  els.resultMasteryText.textContent = won ? state.resultMasteryNotice : "";
  renderSignatureResult();
  const communityUploadExpected = Boolean(won && !assisted && !isStaticBeta && state.run?.ranked && !skipSubmit);
  renderCommunityResult(null, {
    loading: communityUploadExpected,
    status: !won ? "hidden" : !communityUploadExpected && !isStaticBeta && state.run?.ranked ? "unavailable" : ""
  });
  els.rewardCard.hidden = !won || assisted;
  if (reward) {
    els.rewardDust.textContent = reward.reward;
    els.rewardReason.textContent = reward.reason;
  }
  els.resultPrimary.querySelector("span").textContent = training
    ? firstTraining
      ? "Continue to Second Orbit"
      : profile.dailyCompleted === todayKey ? "Start a relaxed orbit" : "Play today's word"
    : revealed ? "Replay constellation once"
    : won && state.journeyContext?.kind === "voyage" && voyageProgressAdvanced ? "Continue Voyage"
    : won && state.journeyContext?.kind === "event" ? "View event collection"
    : won && state.mode === "weekly" && !profile.weekly.complete ? "Continue expedition"
    : won ? "Choose another mode"
    : "Back to modes";
  els.resultRetry.hidden = training || (revealed ? false : assisted || (won && (state.mode === "daily" || state.mode === "weekly")));
  els.resultRetry.textContent = revealed ? "Back to modes" : won ? "Replay this target" : "Try again";
  els.resultShare.hidden = !won || training;
  const openRun = !assisted && (state.assist !== "none" || state.wished);
  els.resultShare.querySelector("span").textContent = assisted ? "Share Study card" : openRun ? "Share Open card" : "Challenge a friend";
  renderResultRoute();
  $("#resultDetails").open = false;
  els.resultDialog.showModal();
  requestAnimationFrame(() => els.resultPrimary.focus({ preventScroll: true }));
  if (won && !assisted && !skipSubmit) submitRankedScore();
  track(won ? "target_reached" : "run_failed", { mode: state.mode, target: state.game.target, moves: state.moves, seconds: elapsed, wished: state.wished, reward: reward?.reward || 0, assisted, revealed, scoreMultiplier: state.scoreMultiplier });
}

async function submitRankedScore() {
  const card = $("#rankResultCard");
  if (state.scoringDisabled || state.assist === "reveal") {
    card.hidden = true;
    return;
  }
  if (!state.run?.ranked) {
    $("#resultDivision").textContent = "PRACTICE ORBIT";
    $("#resultRank").textContent = "UNRANKED";
    $("#resultScore").textContent = "";
    $("#resultRankMessage").textContent = "Reach and friend challenges stay outside competitive ladders.";
    return;
  }
  const submission = {
    playerId: profile.playerId,
    playerToken: profile.playerToken,
    runId: state.run.id,
    runToken: state.run.token,
    mode: state.mode
  };
  if (state.scoreSubmission.runId === submission.runId && state.scoreSubmission.inFlight) return;
  const locallyQueued = Boolean(state.scoreSubmission.runId === submission.runId && state.scoreSubmission.pendingSaved);
  if (state.scoreSubmission.runId === submission.runId) {
    state.scoreSubmission.exitAction ||= state.resultAction;
    state.scoreSubmission.exitLabel ||= els.resultPrimary.querySelector("span").textContent;
  }
  state.scoreSubmission.inFlight = true;
  if (!locallyQueued) {
    els.resultPrimary.disabled = true;
    els.resultRetry.hidden = true;
  }
  const division = state.assist === "none" ? "pure" : "open";
  state.leaderboardDivision = division;
  state.leaderboardScope = submission.mode === "daily" ? "daily" : submission.mode === "weekly" ? "weekly" : "sprint";
  $("#resultDivision").textContent = `${division.toUpperCase()} - SERVER VERIFIED`;
  $("#resultRank").textContent = "#--";
  $("#resultScore").textContent = "VERIFYING";
  $("#resultRankMessage").textContent = "Uploading the server-recorded path...";
  card.classList.add("loading");
  try {
    const result = await fetchJson("/api/run/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Constellore-Player": submission.playerId,
        "X-Constellore-Token": submission.playerToken
      },
      body: JSON.stringify({ runId: submission.runId, runToken: submission.runToken })
    });
    if (!result.ranked) throw new Error(result.reason || "This orbit is not ranked.");
    markPendingScoreUploaded(submission.playerId, submission.runId);
    const sameIdentity = profile.playerId === submission.playerId && profile.playerToken === submission.playerToken;
    let verifiedAdoption = null;
    if (sameIdentity) {
      applyServerPlayer(result.player);
      // The authoritative Signature belongs to the submitted run even when the
      // result dialog has already closed or placement rendering is unavailable.
      verifiedAdoption = adoptVerifiedSignature(result.verifiedSignature, {
        runId: submission.runId,
        updateCurrent: state.run?.id === submission.runId
      });
    }
    if (state.run?.id !== submission.runId) {
      showToast("Your saved score reached the leaderboard.");
      return;
    }
    const retryExitAction = state.scoreSubmission.exitAction;
    const retryExitLabel = state.scoreSubmission.exitLabel;
    state.run = { ...state.run, submitted: true };
    state.scoreSubmission = { runId: submission.runId, activeSaved: false, pendingSaved: false, inFlight: false, exitAction: null, exitLabel: "" };
    els.resultPrimary.querySelector("span").textContent = retryExitLabel || "Choose another mode";
    state.resultAction = retryExitAction || returnHome;
    els.resultPrimary.disabled = false;
    els.resultRetry.hidden = state.mode === "daily" || state.mode === "weekly";
    els.resultRetry.disabled = false;
    state.leaderboardDivision = result.placement.entry.division;
    state.leaderboardScope = submission.mode === "daily" ? "daily" : submission.mode === "weekly" ? "weekly" : "sprint";
    $("#resultDivision").textContent = `${result.placement.entry.division.toUpperCase()} - SERVER VERIFIED`;
    $("#resultRank").textContent = `#${result.placement.rank}`;
    $("#resultScore").textContent = Number(result.placement.entry.score).toLocaleString();
    if (verifiedAdoption?.updatedCurrent || (!verifiedAdoption && adoptVerifiedSignature(result.placement.entry.signature))) renderSignatureResult();
    renderCommunityResult(result.placement.community || null);
    track("community_viewed", { source: "community", completedRoutes: result.placement.community?.completedRoutes || 0, topPercent: result.placement.community?.player?.topPercent || 0 });
    const totalCredits = Number(result.creditReward || 0) + Number(result.weeklyBonus || 0);
    $("#resultRankMessage").textContent = result.weeklyBonus
      ? `Personal best recorded - +${totalCredits} Star Credits, including the 4-day bonus`
      : result.creditReward
        ? `Personal best recorded - +${result.creditReward} Star Credits earned`
        : result.alreadyRewarded
          ? "Score recorded. This challenge's credit reward was already claimed."
          : "Personal best recorded on the shared ladder.";
    track("score_uploaded", { mode: submission.mode, division: result.placement.entry.division, score: result.placement.entry.score, rank: result.placement.rank });
  } catch (error) {
    if (state.run?.id === submission.runId) {
      renderCommunityResult(null, { status: state.scoreSubmission.pendingSaved ? "pending" : "error" });
      $("#resultScore").textContent = "PENDING";
      if (state.scoreSubmission.pendingSaved) {
        $("#resultRankMessage").textContent = `${error.message} Your local run result is still saved and will retry after reconnecting.`;
      } else {
        const recoveryNote = state.scoreSubmission.activeSaved
          ? "The full orbit is recoverable, but its compact score credential could not be queued."
          : "This browser could not save the result.";
        $("#resultRankMessage").textContent = `${error.message} ${recoveryNote} Keep this screen open and retry the upload.`;
        state.resultAction = submitRankedScore;
        els.resultPrimary.querySelector("span").textContent = "Retry score upload";
        els.resultPrimary.disabled = false;
        els.resultRetry.hidden = true;
      }
    }
  } finally {
    if (state.scoreSubmission.runId === submission.runId) state.scoreSubmission.inFlight = false;
    card.classList.remove("loading");
  }
}

function creatorAssistanceEligible() {
  return Boolean(state.game && !["training", "second-orbit", "explore"].includes(state.mode) && !state.run?.ranked && !state.scoringDisabled);
}

function updateWishButton() {
  if (!els.wishState) return;
  const button = $("#wishWord");
  const used = state.wished;
  const eligible = creatorAssistanceEligible();
  if (button) button.hidden = !eligible;
  button?.classList.toggle("used", used);
  if (button) button.disabled = !eligible || state.finished || state.reveal.active || state.reveal.pending;
  if (isStaticBeta) {
    els.wishState.textContent = used ? "USED" : "PRACTICE";
    return;
  }
  if (used) els.wishState.textContent = "USED";
  else if (!profile.freeWishUsed || state.rewardedWish) els.wishState.textContent = state.rewardedWish ? "EARNED" : "FIRST FREE";
  else els.wishState.textContent = "PRACTICE ONLY";
}

function openPremium() {
  stopTimer();
  track("paywall_viewed", { location: els.gameScreen.hidden ? "home" : "run" });
  track("supporter_interest", { location: els.gameScreen.hidden ? "home" : "run" });
  els.paywallDialog.showModal();
}

function openWish() {
  if (!state.game || state.finished || state.reveal.active || state.reveal.pending) return;
  if (!creatorAssistanceEligible()) return showToast("Creator words are available only in unranked Practice or Creator’s Lab.");
  if (state.wished) return showToast("Only one Wish can bend each orbit.");
  track("wish_opened", { mode: state.mode, free: !profile.freeWishUsed });
  stopTimer();
  renderWishVault();
  const canWriteWish = isStaticBeta || !profile.freeWishUsed || state.rewardedWish;
  $("#wishForm").hidden = !canWriteWish;
  if (canWriteWish || profile.vault.length) els.wishDialog.showModal();
  else {
    resumeTimerIfNeeded();
    showToast("Your free Practice Wish is used. Creator’s Lab still lets you choose the next target.");
  }
}

async function checkoutPremium() {
  if (!COMMERCE_LAUNCH_READY) return showToast("Purchases stay disabled during the free beta.", { scope: "global" });
  if (profile.premium) return;
  const billing = billingAdapter();
  track("checkout_started", { provider: billing ? "native" : config.billingEnabled ? "web" : "sandbox" });
  try {
    if (billing?.purchase) {
      const result = await billing.purchase("constellore_founders_pass");
      if (!result?.success) return;
      await billing.syncEntitlements?.();
      await ensurePlayer();
      if (profile.premium) {
        if (els.paywallDialog.open) els.paywallDialog.close();
        showToast("Supporter Pack activated.");
      } else showToast("The store confirmed payment; server entitlement sync is still pending.");
    } else if (config.billingEnabled && config.checkoutUrl) {
      window.open(config.checkoutUrl, "_blank", "noopener,noreferrer");
      showToast("Checkout opened. Your pass activates after the store confirms it.");
    } else if (config.testStoreEnabled) {
      const { player } = await fetchJson("/api/player/test-entitlement", { method: "POST", headers: authHeaders() });
      applyServerPlayer(player);
      if (els.paywallDialog.open) els.paywallDialog.close();
      showToast("Development Supporter Pack activated. No charge.");
    } else {
      showToast("Store connection required for this purchase.");
    }
  } catch {
    showToast("The store could not complete that purchase.");
  }
}

async function makeWish(event) {
  event.preventDefault();
  if (!creatorAssistanceEligible()) return showToast("Creator words cannot enter a ranked orbit.");
  const input = $("#wishInput");
  const message = $("#wishMessage");
  const submit = event.currentTarget.querySelector("button[type=submit]");
  const word = input.value.trim().replace(/\s+/g, " ");
  if (state.words.some((entry) => entry.word.toLowerCase() === word.toLowerCase())) {
    message.textContent = `${word} is already in this universe.`;
    return;
  }
  submit.disabled = true;
  message.textContent = "Listening to the universe…";
  try {
    const item = await fetchJson("/api/wish", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ word, runId: state.run?.id, runToken: state.run?.token })
    });
    state.words.push(item);
    state.wished = true;
    state.bendItem = item;
    const declaredPolicy = combineAssistance(state.assist, "wish");
    const policy = combineAssistance(declaredPolicy.id, item.assist || "wish");
    state.assist = policy.id;
    state.scoreMultiplier = cappedScoreMultiplier(state.assist, state.scoreMultiplier, declaredPolicy.scoreMultiplier, policy.scoreMultiplier, item.scoreMultiplier);
    state.run = { ...state.run, assist: state.assist, assisted: true, division: "open", scoreEligible: true, scoreMultiplier: state.scoreMultiplier };
    applyServerPlayer(item.player);
    renderInventory();
    updateHud();
    scheduleRunSave();
    els.wishDialog.close();
    input.value = "";
    message.textContent = "";
    placeFromTray(item);
    showAlchemy(`✧ ${item.word} bent into your universe.`);
    track("wish_used", { mode: state.mode, word: item.word, entitlement: state.rewardedWish ? "reward" : "free" });
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
    resumeTimerIfNeeded();
  }
}

async function earnRewardedWish() {
  if (!COMMERCE_LAUNCH_READY) return showToast("Ads stay disabled during the free beta.");
  try {
    const earned = await adsAdapter()?.showRewarded("constellore_wish");
    if (!earned) return;
    state.rewardedWish = true;
    showToast("Wish earned for this orbit.");
  } catch {
    showToast("The sponsor star is unavailable right now.");
  }
}

function renderWishVault() {
  const section = $("#wishVaultSection");
  const list = $("#wishVaultList");
  if (!section || !list) return;
  section.hidden = profile.vault.length === 0;
  list.replaceChildren(...profile.vault.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vault-word";
    button.disabled = !state.game || state.finished || state.wished || state.reveal.active || state.reveal.pending;
    button.setAttribute("aria-label", `Activate ${item.word} in this run`);
    button.innerHTML = `<span class="emoji">${escapeHtml(item.emoji)}</span><span class="word">${escapeHtml(item.word)}</span>`;
    button.addEventListener("click", () => activateMarketWord(item.id));
    return button;
  }));
}

async function activateMarketWord(wordId) {
  if (!state.game || state.finished || state.reveal.active || state.reveal.pending) return showToast("Start an orbit before activating a Vault word.");
  if (!creatorAssistanceEligible()) return showToast("Vault words are available only in unranked Practice or Creator’s Lab.");
  if (state.wished) return showToast("Only one Reality Bend may be used in a run.");
  const owned = profile.vault.find((item) => item.id === wordId);
  if (!owned) return showToast("That word is not in your Vault.");
  if (state.words.some((entry) => entry.word.toLowerCase() === owned.word.toLowerCase())) return showToast(`${owned.word} is already in this universe.`);
  try {
    const result = await fetchJson("/api/market/activate", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ runId: state.run?.id, runToken: state.run?.token, wordId })
    });
    state.words.push(result.item);
    state.wished = true;
    state.bendItem = result.item;
    const declaredPolicy = combineAssistance(state.assist, "market");
    const policy = combineAssistance(declaredPolicy.id, result.assist || "market");
    state.assist = policy.id;
    state.scoreMultiplier = cappedScoreMultiplier(state.assist, state.scoreMultiplier, declaredPolicy.scoreMultiplier, policy.scoreMultiplier, result.scoreMultiplier);
    state.run = { ...state.run, assist: state.assist, assisted: true, division: "open", scoreEligible: true, scoreMultiplier: state.scoreMultiplier };
    renderInventory();
    updateHud();
    scheduleRunSave();
    renderWishVault();
    if (els.wishDialog.open) els.wishDialog.close();
    if (els.exchangeDialog.open) els.exchangeDialog.close();
    placeFromTray(result.item);
    showAlchemy(`${result.item.word} entered from your persistent beta Word Vault.`);
    track("market_word_used", { mode: state.mode, word: result.item.word });
  } catch (error) {
    showToast(error.message);
  }
}

function sparklineSvg(values) {
  const safe = Array.isArray(values) ? values.map(Number).filter(Number.isFinite) : [];
  if (safe.length < 2) return "";
  const minimum = Math.min(...safe);
  const maximum = Math.max(...safe);
  const range = Math.max(1, maximum - minimum);
  const points = safe.map((value, index) => `${(index / (safe.length - 1) * 100).toFixed(1)},${(30 - (value - minimum) / range * 25).toFixed(1)}`).join(" ");
  const last = points.split(" ").at(-1).split(",");
  return `<svg class="market-sparkline" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true" focusable="false"><polyline points="${points}"></polyline><circle cx="${last[0]}" cy="${last[1]}" r="2"></circle></svg>`;
}

function renderCreditPacks() {
  const container = $("#creditPacks");
  if (!container) return;
  const note = document.createElement("small");
  note.className = "beta-credit-note";
  note.textContent = "Star Credits are earned from verified play. They are never sold for cash.";
  container.replaceChildren(note);
}

async function openExchange(view = state.marketView) {
  state.marketView = view === "vault" ? "vault" : "market";
  stopTimer();
  if (els.wishDialog.open) els.wishDialog.close();
  if (!els.exchangeDialog.open) els.exchangeDialog.showModal();
  els.marketMessage.classList.remove("error");
  els.marketMessage.textContent = "Loading the shared earn-only rotation...";
  track("market_opened", { location: els.gameScreen.hidden ? "home" : "run" });
  try {
    if (!profile.playerId || !profile.playerToken) await ensurePlayer();
    await loadMarket();
  } catch (error) {
    els.marketMessage.classList.add("error");
    els.marketMessage.textContent = error.message;
  }
}

async function loadMarket() {
  state.market = await fetchJson("/api/market", { headers: authHeaders() });
  state.marketClockOffset = Date.parse(state.market.serverTime) - Date.now();
  profile.credits = state.market.balance;
  saveProfile({ cloud: false });
  renderMarket();
  startMarketClock();
}

function renderMarket() {
  if (!state.market) return;
  const search = $("#marketSearch").value.trim().toLowerCase();
  $$('[data-market-view]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.marketView === state.marketView)));
  const allItems = state.market.items || [];
  const items = allItems.filter((item) => (state.marketView !== "vault" || item.owned) && (!search || item.word.toLowerCase().includes(search)));
  els.marketBalance.textContent = state.market.balance;
  $("#vaultCount").textContent = allItems.filter((item) => item.owned).length;
  els.marketMessage.classList.remove("error");
  els.marketMessage.textContent = search ? `${items.length} matching useful word${items.length === 1 ? "" : "s"}.` : state.marketView === "vault" ? "Persistent beta licenses owned by this player." : "Shared prices rotate periodically. Star Credits are earned through verified play and are never sold.";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "market-empty";
    empty.textContent = state.marketView === "vault" ? "Your Vault is empty. Buy a word once and keep it for this beta." : "No useful words match that search.";
    els.marketList.replaceChildren(empty);
    return;
  }
  els.marketList.replaceChildren(...items.map((item) => {
    const trendClass = item.changePercent > 0 ? "up" : item.changePercent < 0 ? "down" : "flat";
    const trendText = item.changePercent > 0 ? `UP ${item.changePercent}% THIS ROTATION` : item.changePercent < 0 ? `DOWN ${Math.abs(item.changePercent)}% THIS ROTATION` : "STEADY THIS ROTATION";
    const article = document.createElement("article");
    article.className = `market-item${item.owned ? " owned" : ""}`;
    article.innerHTML = `<span class="market-item-emoji">${escapeHtml(item.emoji)}</span><div class="market-word"><strong>${escapeHtml(item.word)}</strong><small>${escapeHtml(item.reason)}</small></div><span class="market-utility"><b>UTILITY ${item.usefulness}/5</b><span>${"*".repeat(item.usefulness)}</span></span><div class="market-trend ${trendClass}">${sparklineSvg(item.trend)}<span>${trendText}</span></div><div class="market-price"><strong>${Number(item.price).toLocaleString()} C</strong><small>${item.owned ? "OWNED" : "CURRENT QUOTE"}</small></div>`;
    const action = document.createElement("button");
    action.type = "button";
    action.className = "market-item-action";
    const canActivate = item.owned && state.game && !state.finished && !state.wished && creatorAssistanceEligible();
    action.textContent = item.owned ? canActivate ? "USE NOW" : "OWNED" : "BUY WORD";
    action.disabled = item.owned && !canActivate;
    action.addEventListener("click", () => item.owned ? activateMarketWord(item.id) : openMarketBuy(item));
    article.append(action);
    return article;
  }));
}

function startMarketClock() {
  clearInterval(state.marketTimer);
  const update = () => {
    if (!state.market) return;
    const seconds = Math.max(0, Math.ceil((Date.parse(state.market.nextRepriceAt) - (Date.now() + state.marketClockOffset)) / 1000));
    els.marketCountdown.textContent = `00:${String(seconds).padStart(2, "0")}`;
    if (seconds <= 0) {
      clearInterval(state.marketTimer);
      state.marketTimer = null;
      loadMarket().catch((error) => {
        els.marketMessage.classList.add("error");
        els.marketMessage.textContent = error.message;
      });
    }
  };
  update();
  if (els.exchangeDialog.open) state.marketTimer = setInterval(update, 1000);
}

function openMarketBuy(item) {
  state.selectedMarketItem = item;
  if (els.exchangeDialog.open) els.exchangeDialog.close();
  $("#marketBuyEmoji").textContent = item.emoji;
  $("#marketBuyWord").textContent = item.word;
  $("#marketBuyReason").textContent = item.reason;
  $("#marketBuyPrice").textContent = Number(item.price).toLocaleString();
  const seconds = Math.max(0, Math.ceil((Date.parse(item.quoteExpiresAt) - (Date.now() + state.marketClockOffset)) / 1000));
  $("#marketBuyExpiry").textContent = `Quote refreshes in ${seconds} seconds`;
  els.marketBuyDialog.showModal();
}

async function confirmMarketPurchase() {
  const item = state.selectedMarketItem;
  if (!item) return;
  const button = $("#confirmMarketBuy");
  button.disabled = true;
  try {
    const result = await fetchJson("/api/market/buy", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ quoteId: item.quoteId, idempotencyKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-market` })
    });
    applyServerPlayer(result.player);
    track("word_purchased", { word: result.item.word, credits: result.price });
    showToast(`${result.item.word} was added to your persistent beta Vault.`);
    els.marketBuyDialog.close();
    await openExchange("vault");
  } catch (error) {
    showToast(error.message);
    if (error.code === "quote_expired") {
      els.marketBuyDialog.close();
      await openExchange("market");
    }
  } finally {
    button.disabled = false;
  }
}

async function openLeaderboard(scope = state.leaderboardScope, division = state.leaderboardDivision) {
  if (state.startingRun) return;
  state.leaderboardScope = ["daily", "weekly", "sprint", "all"].includes(scope) ? scope : "daily";
  state.leaderboardDivision = division === "open" ? "open" : "pure";
  stopTimer();
  $("#leaderboardScope").value = state.leaderboardScope;
  $$('[data-leaderboard-division]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.leaderboardDivision === state.leaderboardDivision)));
  if (!els.leaderboardDialog.open) els.leaderboardDialog.showModal();
  track("leaderboard_opened", { scope: state.leaderboardScope, division: state.leaderboardDivision });
  await loadLeaderboard();
}

async function loadLeaderboard() {
  els.leaderboardMessage.classList.remove("error");
  els.leaderboardMessage.textContent = "Mapping verified scores...";
  try {
    const params = new URLSearchParams({ scope: state.leaderboardScope, division: state.leaderboardDivision });
    const challengeId = state.game?.challengeId || state.run?.challengeId;
    if (challengeId) params.set("challengeId", String(challengeId));
    const board = await fetchJson(`/api/leaderboard?${params}`, { headers: authHeaders() });
    renderLeaderboard(board);
  } catch (error) {
    els.leaderboardRows.replaceChildren();
    els.leaderboardMessage.classList.add("error");
    els.leaderboardMessage.textContent = error.message;
  }
}

function renderLeaderboard(board) {
  const entries = board.entries || [];
  const community = board.community;
  els.leaderboardMessage.textContent = entries.length
    ? `${entries.length} verified personal best${entries.length === 1 ? "" : "s"}${community?.completedRoutes ? ` · ${community.completedRoutes} asynchronous routes · ${community.signatureVarietyPercent}% Signature variety` : ""}.`
    : "No verified score has reached this ladder yet.";
  if (!entries.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4"><div class="leaderboard-empty">Be the first constellation on this board.</div></td>`;
    els.leaderboardRows.replaceChildren(row);
  } else {
    els.leaderboardRows.replaceChildren(...entries.map((entry) => {
      const row = document.createElement("tr");
      if (entry.callsign === profile.callsign) row.className = "is-you";
      row.innerHTML = `<td class="rank">#${entry.rank}</td><td>${escapeHtml(entry.callsign)}${entry.callsign === profile.callsign ? " (YOU)" : ""}</td><td class="score">${Number(entry.score).toLocaleString()}</td><td class="path">${entry.moves} moves / ${formatTime(Math.round(entry.elapsedMs / 1000))}</td>`;
      return row;
    }));
  }
  const pinned = $("#leaderboardYou");
  if (board.playerEntry) {
    pinned.hidden = false;
    pinned.innerHTML = `<strong>#${board.playerEntry.rank}</strong><span>${escapeHtml(profile.callsign)} - your best</span><b>${Number(board.playerEntry.score).toLocaleString()}</b>`;
  } else {
    pinned.hidden = true;
    pinned.replaceChildren();
  }
  $("#leaderboardNote").textContent = board.division === "pure"
    ? "Pure runs use only forged discoveries and no injected concepts."
    : "Open runs used one Wish, Vault word, Compass, Gift, AI route, or another declared assist.";
  if (community?.completedRoutes) track("community_viewed", { source: "community", completedRoutes: community.completedRoutes, topPercent: community.player?.topPercent || 0 });
}

function resumeTimerIfNeeded() {
  if (state.game?.timeLimit && !state.finished && !state.startingRun && !state.pause.active && !state.reveal.active && !state.reveal.pending && !els.gameScreen.hidden && !els.missionBriefingDialog.open && !els.pauseDialog.open && !els.journeyDialog.open && !els.paywallDialog.open && !els.wishDialog.open && !els.atlasDialog.open && !els.senseDialog.open && !els.shareDialog.open && !els.profileDialog.open && !els.exchangeDialog.open && !els.marketBuyDialog.open && !els.leaderboardDialog.open && !els.revealDialog.open && !$("#recoveryDialog").open) startTimer();
}

function renderAtlas() {
  const hasHistory = state.history.length > 0;
  const compactGraph = window.innerWidth <= 700;
  const graph = buildLivingAtlas({
    history: state.history,
    target: state.game?.target || "",
    lockedCount: hasHistory ? Math.min(6, Math.max(2, 6 - Math.floor(state.history.length / 4))) : 0,
    width: compactGraph ? 480 : 760,
    height: compactGraph ? 360 : 420
  });
  $("#atlasEmpty").hidden = hasHistory;
  $("#atlasSummary").hidden = !hasHistory;
  els.atlasMap.hidden = !hasHistory;
  $("#atlasDiscoveries").textContent = state.newDiscoveries;
  $("#atlasMoves").textContent = state.moves;
  $("#atlasPath").replaceChildren(...state.history.map((step, index) => {
    const item = document.createElement("li");
    item.innerHTML = `<span class="atlas-star">${escapeHtml(step.emoji)}</span><small>STAR ${String(index + 1).padStart(2, "0")}${step.newDiscovery ? " · NEW" : ""}${step.twisted ? " · COSMIC TWIST" : ""}</small><strong>${escapeHtml(step.word)}</strong><span>${escapeHtml(step.a)} + ${escapeHtml(step.b)}${step.twisted ? ` · expected ${escapeHtml(step.canonicalWord)}` : ""}</span>${step.insight ? `<small class="recipe-insight">${escapeHtml(step.insight)}</small>` : ""}`;
    return item;
  }));
  if (hasHistory) {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    els.atlasGraph.setAttribute("viewBox", `0 0 ${graph.width} ${graph.height}`);
    els.atlasGraphEdges.replaceChildren(...graph.edges.map((edge) => {
      const from = nodesById.get(edge.from);
      const to = nodesById.get(edge.to);
      const line = document.createElementNS(svgNamespace, "line");
      line.setAttribute("x1", from.x);
      line.setAttribute("y1", from.y);
      line.setAttribute("x2", to.x);
      line.setAttribute("y2", to.y);
      line.setAttribute("class", `atlas-edge${edge.twisted ? " twisted" : ""}${edge.revealed ? " revealed" : ""}`);
      return line;
    }));
    els.atlasGraphNodes.replaceChildren(...graph.nodes.map((node) => {
      const group = document.createElementNS(svgNamespace, "g");
      group.setAttribute("class", `atlas-node${node.starter ? " starter" : ""}${node.target ? " target" : ""}${node.locked ? " locked" : ""}`);
      group.setAttribute("transform", `translate(${node.x} ${node.y})`);
      const title = document.createElementNS(svgNamespace, "title");
      title.textContent = node.locked ? "Undiscovered recipe silhouette" : `${node.label}${node.target ? " · destination" : ""}`;
      const circle = document.createElementNS(svgNamespace, "circle");
      circle.setAttribute("r", node.target ? "19" : node.locked ? "10" : "14");
      const emoji = document.createElementNS(svgNamespace, "text");
      emoji.setAttribute("class", "atlas-node-emoji");
      emoji.setAttribute("y", "6");
      emoji.textContent = node.locked ? "?" : node.emoji || "✦";
      const label = document.createElementNS(svgNamespace, "text");
      label.setAttribute("y", node.target ? "39" : "34");
      label.textContent = node.locked ? "" : node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label;
      group.append(title, circle, emoji, label);
      return group;
    }));
    els.atlasGraphSummary.textContent = graph.summary.targetReached
      ? `${graph.summary.words} visible stars · ${graph.summary.combinations} performed recipes · destination reached.`
      : `${graph.summary.words} visible stars · ${graph.summary.combinations} performed recipes · the destination beacon reveals no hidden route.`;
  } else {
    els.atlasGraphEdges.replaceChildren();
    els.atlasGraphNodes.replaceChildren();
  }
  renderMastery();
}

function selectAtlasTab(view = "orbit") {
  const mastery = view === "mastery";
  $("#orbitAtlasTab").setAttribute("aria-selected", String(!mastery));
  $("#masteryAtlasTab").setAttribute("aria-selected", String(mastery));
  $("#orbitAtlasTab").tabIndex = mastery ? -1 : 0;
  $("#masteryAtlasTab").tabIndex = mastery ? 0 : -1;
  $("#orbitAtlasPanel").hidden = mastery;
  $("#masteryAtlasPanel").hidden = !mastery;
  if (mastery) track("mastery_opened", { location: state.game ? "run" : "home" });
}

function openAtlas(view = "orbit") {
  if (!state.game && view !== "mastery") return;
  if (state.startingRun) return showToast("The next orbit is still being mapped.");
  if (state.reveal.active || state.reveal.pending) return showToast("Pause the Cosmos Reveal before opening the atlas.");
  stopTimer();
  renderAtlas();
  selectAtlasTab(view);
  els.atlasDialog.showModal();
}

function challengeUrl(game) {
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set("challenge", "1");
  url.searchParams.set("target", game.target);
  url.searchParams.set("seed", String(game.seed ?? stableHash(game.target)));
  return url.toString();
}

function populateShare(game, completed = false) {
  state.shareGame = game;
  const isCurrentRun = game === state.game;
  const study = Boolean(isCurrentRun && state.scoringDisabled);
  const openRun = Boolean(isCurrentRun && !study && (state.assist !== "none" || state.wished));
  const challengeEligible = !study && !openRun;
  const elapsed = isCurrentRun && state.startedAt
    ? state.finished && state.finishedElapsedSeconds ? state.finishedElapsedSeconds : Math.max(0, Math.round((Date.now() - state.startedAt) / 1000))
    : 0;
  state.shareCard = buildConstellationCard({
    target: game.target,
    emoji: game.emoji,
    moves: isCurrentRun ? state.moves : 0,
    seconds: elapsed,
    stars: isCurrentRun ? state.history.length : 0,
    discoveries: isCurrentRun ? state.newDiscoveries : 0,
    history: isCurrentRun ? state.history : [],
    universe: game.universe || selectUniverse(game.seed),
    seed: game.seed,
    assist: study || openRun ? state.assist : "none",
    scoringDisabled: isCurrentRun && state.scoringDisabled,
    wished: isCurrentRun && state.wished,
    training: game.mode === "training",
    challengeUrl: challengeEligible ? challengeUrl(game) : ""
  });
  $("#shareTarget").textContent = game.target;
  $("#shareTitle").textContent = study ? "Keep this study constellation." : openRun ? "Keep this Open constellation." : completed ? "Can they find it faster?" : "Invite them into this universe.";
  $("#shareDescription").textContent = study
    ? "This card is clearly marked Study and never links to a competitive challenge."
    : openRun
      ? "This card declares its Reality Bend as Open and never disguises it as a Pure challenge."
      : completed ? "Your path is set. Now see how a friend reaches the same word." : "Send the same target and compare your constellations.";
  $("#shareStats").textContent = `${state.shareCard.universe.name} · ${state.shareCard.division} · ${completed ? `${state.shareCard.moves} moves · ${state.shareCard.stars} stars` : "shared seed"}`;
  const preview = $("#shareCardPreview");
  preview.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderConstellationCardSvg(state.shareCard))}`;
  preview.alt = `${state.shareCard.division.toLowerCase()} constellation card for ${state.shareCard.target}`;
  $("#copyChallenge").hidden = !challengeEligible;
  $("#shareEyebrow").textContent = study ? "CONSTELLATION CARD · STUDY" : openRun ? "CONSTELLATION CARD · OPEN" : "CONSTELLATION CARD · FRIEND CHALLENGE";
}

function openShare() {
  if (!state.game) return;
  if (state.startingRun) return showToast("The next orbit is still being mapped.");
  if (state.reveal.active || state.reveal.pending) return showToast("Finish tracing the path before making its card.");
  stopTimer();
  populateShare(state.game, state.finished);
  $("#nativeShare").hidden = !navigator.share;
  els.shareDialog.showModal();
  track("share_created", { target: state.game.target, completed: state.finished });
}

async function createChallengeFromHome() {
  try {
    const seed = Math.floor(Math.random() * 1_000_000);
    const game = await fetchJson(`/api/game?mode=challenge&seed=${seed}`);
    populateShare(game, false);
    $("#nativeShare").hidden = !navigator.share;
    els.shareDialog.showModal();
    track("share_created", { target: game.target, completed: false });
  } catch (error) { showToast(error.message); }
}

async function copyChallenge() {
  if (!state.shareGame || !state.shareCard?.challengeUrl) return;
  const url = challengeUrl(state.shareGame);
  try {
    await navigator.clipboard.writeText(url);
    $("#copyChallenge span").textContent = "Challenge link copied";
    setTimeout(() => { $("#copyChallenge span").textContent = "Copy challenge link"; }, 1600);
  } catch {
    window.prompt("Copy this challenge link:", url);
  }
}

async function nativeShare() {
  if (!navigator.share || !state.shareGame || !state.shareCard) return;
  const svg = renderConstellationCardSvg(state.shareCard);
  const file = typeof File === "function" ? new File([svg], constellationCardFilename(state.shareCard), { type: "image/svg+xml" }) : null;
  const payload = {
    title: `${state.shareCard.target} · Constellore`,
    text: constellationCardShareText(state.shareCard),
    ...(state.shareCard.challengeUrl ? { url: state.shareCard.challengeUrl } : {})
  };
  if (file && navigator.canShare?.({ files: [file] })) payload.files = [file];
  try {
    await navigator.share(payload);
    track("card_shared", { division: state.shareCard.division, image: Boolean(payload.files) });
  } catch { /* Share cancellation is expected. */ }
}

function downloadConstellationCard() {
  if (!state.shareCard) return;
  const blob = new Blob([renderConstellationCardSvg(state.shareCard)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = constellationCardFilename(state.shareCard);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  track("card_downloaded", { division: state.shareCard.division });
}

function openProfile() {
  stopTimer();
  renderProfile();
  els.profileDialog.querySelectorAll(".profile-disclosure[open]").forEach((section) => { section.open = false; });
  els.profileDialog.showModal();
}

function chooseTheme(theme) {
  const item = COSMETIC_CATALOG.find((entry) => entry.kind === "theme" && entry.id === theme);
  chooseCosmetic("theme", theme, Boolean(item && (item.entitlement === "free" || founderCosmeticsOwned())));
}

function chooseCosmetic(kind, id, owned = false) {
  const item = COSMETIC_CATALOG.find((entry) => entry.kind === kind && entry.id === id);
  if (!item) return;
  if (!owned && item.entitlement !== "free") {
    els.profileDialog.close();
    return openPremium();
  }
  profile.cosmetics = sanitizeCosmeticLoadout({ ...profile.cosmetics, [kind]: id }, { founder: founderCosmeticsOwned() });
  profile.theme = profile.cosmetics.theme;
  saveProfile({ fields: ["settings"] });
  if (state.game) startCosmos();
  if (kind === "sound") playFeedback("place");
  track("cosmetic_changed", { kind, id });
}

function startCosmos() {
  cancelAnimationFrame(state.cosmosFrame);
  if (els.gameScreen.hidden) return;
  const canvas = els.cosmosCanvas;
  const rect = els.board.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  const count = Math.min(150, Math.max(55, Math.floor(rect.width * rect.height / 7500)));
  state.stars = Array.from({ length: count }, (_, index) => ({
    x: seeded(index * 17 + 3) * rect.width,
    y: seeded(index * 31 + 7) * rect.height,
    r: .35 + seeded(index * 47 + 11) * 1.25,
    alpha: .22 + seeded(index * 61 + 13) * .65,
    phase: seeded(index * 73 + 19) * Math.PI * 2
  }));
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const accent = getComputedStyle(document.body).getPropertyValue("--violet").trim() || "#aa8cff";
  const cyan = getComputedStyle(document.body).getPropertyValue("--cyan").trim() || "#69e6ff";
  const trailStyle = profile.cosmetics?.trail || "classic";
  const draw = (time = 0) => {
    if (els.gameScreen.hidden) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(ratio, ratio);
    for (const star of state.stars) {
      const pulse = reduced ? 1 : .78 + Math.sin(time * .0007 + star.phase) * .22;
      ctx.globalAlpha = star.alpha * pulse;
      ctx.fillStyle = star.r > 1.2 ? accent : "#ffffff";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = trailStyle === "comet" ? cyan : accent;
    ctx.fillStyle = trailStyle === "prism" ? cyan : accent;
    ctx.lineWidth = trailStyle === "comet" ? 1.45 : trailStyle === "prism" ? 1.05 : .7;
    for (let trailIndex = 0; trailIndex < state.trails.length; trailIndex += 1) {
      const trail = state.trails[trailIndex];
      if (trailStyle === "prism") ctx.strokeStyle = trailIndex % 2 ? cyan : accent;
      ctx.globalAlpha = trailStyle === "classic" ? .18 : .3;
      ctx.beginPath();
      ctx.moveTo(trail.ax, trail.ay);
      ctx.lineTo(trail.x, trail.y);
      ctx.lineTo(trail.bx, trail.by);
      ctx.stroke();
      ctx.globalAlpha = trailStyle === "classic" ? .42 : .66;
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const revealSegments = state.reveal.layout?.segments || [];
    if (revealSegments.length) {
      ctx.save();
      for (let index = 0; index < revealSegments.length; index += 1) {
        const segment = revealSegments[index];
        const completed = index < state.reveal.completed;
        const current = state.reveal.active && index === state.reveal.completed;
        const ax = segment.a.x * rect.width;
        const ay = segment.a.y * rect.height;
        const bx = segment.b.x * rect.width;
        const by = segment.b.y * rect.height;
        const tx = segment.to.x * rect.width;
        const ty = segment.to.y * rect.height;
        const pulse = reduced ? 1 : .72 + Math.sin(time * .004 + index) * .28;

        ctx.globalAlpha = completed ? .78 : current ? .35 + pulse * .22 : .1;
        ctx.strokeStyle = completed ? cyan : accent;
        ctx.fillStyle = completed ? cyan : accent;
        ctx.lineWidth = completed ? 1.8 : current ? 1.35 : .8;
        ctx.setLineDash(completed ? [] : [4, 9]);
        ctx.shadowColor = completed ? cyan : accent;
        ctx.shadowBlur = completed ? 11 : current ? 8 : 0;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(tx, ty);
        ctx.moveTo(bx, by);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(tx, ty, completed ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
        if (current) {
          ctx.globalAlpha = .18 + pulse * .18;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(tx, ty, 8 + pulse * 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.restore();
    if (!reduced) state.cosmosFrame = requestAnimationFrame(draw);
  };
  draw();
}

let boardNoticeTimer = null;
let boardNoticeNextTimer = null;
let activeBoardNotice = null;
const boardNoticeQueue = [];
let boardAnnouncementFrame = 0;
let boardAnnouncementKey = "";

function announceBoardMessage(message, key = "board") {
  const text = String(message || "").trim();
  if (!text || !els.boardAnnouncement) return;
  cancelAnimationFrame(boardAnnouncementFrame);
  els.boardAnnouncement.textContent = "";
  boardAnnouncementKey = String(key || "board");
  boardAnnouncementFrame = requestAnimationFrame(() => {
    boardAnnouncementFrame = 0;
    if (boardAnnouncementKey === String(key || "board")) els.boardAnnouncement.textContent = text;
  });
}

function clearBoardAnnouncement(key = "") {
  if (key && boardAnnouncementKey !== key) return false;
  cancelAnimationFrame(boardAnnouncementFrame);
  boardAnnouncementFrame = 0;
  boardAnnouncementKey = "";
  if (els.boardAnnouncement) els.boardAnnouncement.textContent = "";
  return true;
}

function boardNoticeDescriptor(message, error = false, twist = false, options = {}) {
  const text = String(message || "").trim();
  const prefix = text.split("·", 1)[0].trim().toLowerCase();
  const createdAt = Date.now();
  return {
    text,
    error: Boolean(error),
    twist: Boolean(twist),
    key: String(options.key || (["shift copy", "shift remove", "ctrl fusion"].includes(prefix) ? "gesture" : prefix || "notice")).slice(0, 80),
    duration: clamp(Number(options.duration) || (error ? 2800 : twist ? 3800 : 2300), 900, 8000),
    retain: Boolean(options.retain),
    expiresAt: createdAt + clamp(Number(options.maxAge) || (options.retain ? 10_000 : 6500), 1200, 30_000)
  };
}

function boardNoticeExpired(notice) {
  return !notice || notice.expiresAt <= Date.now();
}

function pruneBoardNoticeQueue() {
  for (let index = boardNoticeQueue.length - 1; index >= 0; index -= 1) {
    if (boardNoticeExpired(boardNoticeQueue[index])) boardNoticeQueue.splice(index, 1);
  }
}

function enqueueBoardNotice(notice) {
  if (boardNoticeExpired(notice)) return;
  for (let index = boardNoticeQueue.length - 1; index >= 0; index -= 1) {
    if (boardNoticeQueue[index].key === notice.key) boardNoticeQueue.splice(index, 1);
  }
  boardNoticeQueue.push(notice);
  if (boardNoticeQueue.length > 4) {
    const disposable = boardNoticeQueue.findIndex((queued) => !queued.retain);
    boardNoticeQueue.splice(disposable >= 0 ? disposable : 0, 1);
  }
}

function boardNoticeBusy() {
  pruneBoardNoticeQueue();
  return Boolean(activeBoardNotice || boardNoticeNextTimer || boardNoticeQueue.length);
}

function displayBoardNotice(notice) {
  if (boardNoticeExpired(notice)) return;
  if (els.recipeFeedback && !els.recipeFeedback.hidden) resetRecipeFeedback();
  clearGlobalToast();
  clearTimeout(boardNoticeTimer);
  clearTimeout(boardNoticeNextTimer);
  boardNoticeNextTimer = null;
  activeBoardNotice = notice;
  els.alchemyNote.textContent = notice.text;
  els.alchemyNote.classList.toggle("error", notice.error);
  els.alchemyNote.classList.toggle("twist", notice.twist);
  els.alchemyNote.classList.add("show");
  announceBoardMessage(notice.text, "board-notice");
  boardNoticeTimer = setTimeout(() => {
    els.alchemyNote.classList.remove("show");
    activeBoardNotice = null;
    boardNoticeNextTimer = setTimeout(() => {
      boardNoticeNextTimer = null;
      pruneBoardNoticeQueue();
      const next = boardNoticeQueue.shift();
      if (next) displayBoardNotice(next);
      else {
        els.alchemyNote.textContent = "";
        clearBoardAnnouncement("board-notice");
      }
    }, 170);
  }, notice.duration);
  showAlchemy.timer = boardNoticeTimer;
}

function showAlchemy(message, error = false, twist = false, options = {}) {
  const notice = boardNoticeDescriptor(message, error, twist, options);
  if (!notice.text) return;
  pruneBoardNoticeQueue();
  if (activeBoardNotice?.retain && activeBoardNotice.key !== notice.key && !boardNoticeExpired(activeBoardNotice)) enqueueBoardNotice(activeBoardNotice);
  displayBoardNotice(notice);
}

function queueAlchemyNotice(message, error = false, twist = false, options = {}) {
  const notice = boardNoticeDescriptor(message, error, twist, options);
  if (!notice.text) return;
  if (!activeBoardNotice && !boardNoticeNextTimer) return displayBoardNotice(notice);
  enqueueBoardNotice(notice);
}

function clearBoardNotices() {
  clearTimeout(boardNoticeTimer);
  clearTimeout(boardNoticeNextTimer);
  boardNoticeTimer = null;
  boardNoticeNextTimer = null;
  activeBoardNotice = null;
  boardNoticeQueue.length = 0;
  clearBoardAnnouncement("board-notice");
  if (!els.alchemyNote) return;
  els.alchemyNote.classList.remove("show", "error", "twist");
  els.alchemyNote.textContent = "";
}

function updateConnection() {
  if (isStaticBeta) {
    els.connectionBadge.hidden = false;
    els.connectionBadge.classList.add("local");
    els.connectionBadge.textContent = "LOCAL PRACTICE · UNRANKED";
    return;
  }
  els.connectionBadge.hidden = navigator.onLine;
}

function configureStaticBetaUi() {
  if (!isStaticBeta) return;
  document.body.classList.add("local-beta");
  const banner = $("#practiceBanner");
  if (banner) banner.hidden = false;
  $("#localDiagnosticsSection").hidden = false;
  ["marketButton", "leaderboardButton", "startPremium", "browseExchange", "resultLeaderboard"]
    .forEach((id) => { const element = document.getElementById(id); if (element) element.hidden = true; });
  const wishLabel = $("#wishWord b");
  if (wishLabel) wishLabel.textContent = "Practice Wish";
  const wishHeading = $("#wishDialog h2");
  if (wishHeading) wishHeading.textContent = "Wish a mapped word";
  const wishIntro = document.querySelector("#wishDialog > p");
  if (wishIntro) wishIntro.textContent = "Add one known concept to this local orbit. It may open a shortcut, but the result remains unranked.";
  $("#profileCallsign").textContent = "Local Stargazer";
}

async function loadBuildIdentity() {
  const output = $("#buildVersion");
  if (!output) return;
  let version = String(document.body.dataset.buildVersion || "").trim();
  let buildId = String(document.body.dataset.buildId || "").trim();
  if (!version || version === "development") {
    try {
      const response = await fetch("./release.json", { cache: "no-store", credentials: "same-origin" });
      if (response.ok) {
        const release = await response.json();
        version = String(release.version || version).trim();
        buildId = String(release.buildId || buildId).trim();
      }
    } catch { /* Source checkout and offline play can safely use the embedded label. */ }
  }
  output.textContent = (buildId || version || "development").toUpperCase();
  output.title = version && buildId && version !== buildId ? `Version ${version}` : "Constellore build";
}

function focusExploreLaunch() {
  const hub = $("#exploreHub");
  if (!hub) return false;
  document.body.classList.add("intent-explore");
  hub.open = true;
  const creator = hub.querySelector(".custom-target-disclosure");
  if (creator) creator.open = true;
  hub.classList.add("launch-intent");
  requestAnimationFrame(() => {
    hub.querySelector("summary")?.focus({ preventScroll: true });
    hub.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  setTimeout(() => hub.classList.remove("launch-intent"), 2400);
  return true;
}

async function handleLaunchIntent(params) {
  const mode = String(params.get("mode") || "").toLowerCase();
  if (mode === "daily") {
    if (profile.dailyCompleted === todayKey) {
      focusExploreLaunch();
      showToast("Today’s shared word is complete. Explore another guaranteed route.", { scope: "global" });
      return true;
    }
    await beginMode("daily");
    return true;
  }
  if (mode === "explore" || mode === "creator") return focusExploreLaunch();
  return false;
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

let toastTimer;
function clearGlobalToast() {
  clearTimeout(toastTimer);
  toastTimer = null;
  els.toast?.classList.remove("show");
  if (els.toast) els.toast.textContent = "";
}

function showToast(message, { scope = "auto" } = {}) {
  const boardCanOwnNotice = state.game && !els.gameScreen.hidden && !state.finished && !state.pause.active && !state.reveal.active && !state.reveal.pending && !document.querySelector("dialog[open]");
  if (scope !== "global" && boardCanOwnNotice) {
    showAlchemy(message);
    return;
  }
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 3000);
}

function stableHash(value) { let hash = 2166136261; for (const character of String(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function seeded(value) { const x = Math.sin(value * 999.91) * 43758.5453; return x - Math.floor(x); }
function wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }

$$('[data-mode]').forEach((button) => button.addEventListener("click", () => beginMode(button.dataset.mode)));
$("#primaryOrbitButton").addEventListener("click", beginPrimaryOrbit);
$("#primaryOrbitSecondary").addEventListener("click", beginPrimarySecondary);
$("#hubMenuButton").addEventListener("click", openHubMenu);
$("#customTargetForm").addEventListener("submit", beginCustomTarget);
$("#beginMission").addEventListener("click", confirmMissionBriefing);
$("#cancelMission").addEventListener("click", cancelMissionBriefing);
$("#pauseRunButton").addEventListener("click", openPauseMenu);
$("#resumePausedRun").addEventListener("click", closePauseMenu);
$("#cancelPauseAction").addEventListener("click", () => resetPauseConfirmation({ focus: true }));
$("#pauseRestart").addEventListener("click", () => {
  if (!confirmPauseAction("restart")) return;
  pauseCloseRestoreFocus = false;
  closePauseMenu();
  if (state.mode === "training") startFirstOrbit();
  else void retryGame();
});
$("#pauseExit").addEventListener("click", () => {
  if (!confirmPauseAction("exit")) return;
  pauseCloseRestoreFocus = false;
  closePauseMenu();
  returnHome();
});
els.resetBoard.addEventListener("click", clearBoardWithUndo);
els.tidyBoard.addEventListener("click", tidyOrbit);
$("#undoBoardClear").addEventListener("click", undoBoardClear);
$("#cancelTapChain").addEventListener("click", () => cancelTapChain({ announce: true }));
els.senseButton.addEventListener("click", openPowerups);
els.quickTipShortcut.addEventListener("click", useQuickTip);
els.wordGiftShortcut.addEventListener("click", useWordGiftShortcut);
els.senseShortcut.addEventListener("click", useSenseShortcut);
els.powerupShopShortcut.addEventListener("click", openPowerupShop);
els.expectedPairButton.addEventListener("click", submitExpectedPairFeedback);
$("#dismissExpectedPair").addEventListener("click", resetExpectedPairFeedback);
els.useQuickTip.addEventListener("click", useQuickTip);
els.useWordGift.addEventListener("click", useWordGift);
$("#useSense").addEventListener("click", useConstellationSense);
$("#buySense").addEventListener("click", buySenseCharge);
els.rivalGhost.addEventListener("click", toggleRivalGhost);
els.board.addEventListener("pointerdown", (event) => {
  if (event.target.closest?.(".board-word, .board-tools, .rival-ghost, .ghost-preview, .tap-chain-status, .board-undo, .reveal-controller, .recipe-feedback")) return;
  cancelTapChain();
});
els.inventorySearch.addEventListener("input", (event) => {
  state.inventoryQuery = event.currentTarget.value.trimStart().slice(0, 60);
  renderInventory();
  scheduleRunSave();
});
els.inventorySearch.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !state.inventoryQuery) return;
  event.preventDefault();
  state.inventoryQuery = "";
  renderInventory();
});
els.inventorySearchClear.addEventListener("click", () => {
  state.inventoryQuery = "";
  renderInventory();
  els.inventorySearch.focus();
  scheduleRunSave();
});
$("#atlasButton").addEventListener("click", () => openAtlas("orbit"));
$("#resultAtlas").addEventListener("click", () => {
  if (els.resultDialog.open) els.resultDialog.close();
  openAtlas("orbit");
});
$("#viewMastery").addEventListener("click", () => { closeHubMenu(); openAtlas("mastery"); });
$("#orbitAtlasTab").addEventListener("click", () => selectAtlasTab("orbit"));
$("#masteryAtlasTab").addEventListener("click", () => selectAtlasTab("mastery"));
[$("#orbitAtlasTab"), $("#masteryAtlasTab")].forEach((tab) => tab.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const next = tab.id === "orbitAtlasTab" ? $("#masteryAtlasTab") : $("#orbitAtlasTab");
  selectAtlasTab(next.id === "masteryAtlasTab" ? "mastery" : "orbit");
  next.focus();
}));
$("#shareRunButton").addEventListener("click", openShare);
$("#revealPathButton").addEventListener("click", () => {
  if (els.senseDialog.open) els.senseDialog.close();
  requestAnimationFrame(openRevealPath);
});
$("#confirmReveal").addEventListener("click", confirmRevealPath);
$("#revealPause").addEventListener("click", toggleRevealPause);
$("#revealSpeed").addEventListener("click", cycleRevealSpeed);
$("#revealSkip").addEventListener("click", skipRevealAnimation);
$("#startPremium").addEventListener("click", () => { closeHubMenu(); profile.premium ? openProfile() : openPremium(); });
$("#wishWord").addEventListener("click", openWish);
$("#checkoutButton").addEventListener("click", checkoutPremium);
$("#wishForm").addEventListener("submit", makeWish);
$("#rewardWish").addEventListener("click", earnRewardedWish);
$("#profileButton").addEventListener("click", openProfile);
$("#syncCloudProfile").addEventListener("click", () => syncCloudProfile({ manual: true }));
$("#restoreOwnership").addEventListener("click", () => restoreOwnership());
$("#rotateRecoveryKit").addEventListener("click", rotateRecoveryKit);
$("#exportPlayerData").addEventListener("click", exportPlayerData);
$("#deletePlayerData").addEventListener("click", deletePlayerData);
$("#exportLocalPractice").addEventListener("click", exportLocalPractice);
$("#resetLocalPractice").addEventListener("click", resetLocalPractice);
$("#exportLocalDiagnostics").addEventListener("click", exportLocalDiagnostics);
$("#resetLocalDiagnostics").addEventListener("click", resetLocalDiagnostics);
$("#diagnosticsPreference").addEventListener("click", toggleDiagnosticsPreference);
$("#exportDiagnostics").addEventListener("click", exportDiagnostics);
$("#resetAnalyticsIdentity").addEventListener("click", resetAnalyticsIdentity);
$("#recoverAccountForm").addEventListener("submit", recoverAccount);
$("#copyRecoveryKit").addEventListener("click", copyRecoveryKit);
$("#confirmRecoverySaved").addEventListener("click", acknowledgeRecoveryKit);
$("#replayFirstOrbit").addEventListener("click", startFirstOrbit);
$("#replaySecondOrbit").addEventListener("click", startSecondOrbit);
$("#skipFirstOrbit").addEventListener("click", skipFirstOrbit);
$("#feedbackToggle").addEventListener("click", () => toggleFeedbackPreference("sound"));
$("#soundPreference").addEventListener("click", () => toggleFeedbackPreference("sound"));
$("#hapticPreference").addEventListener("click", () => toggleFeedbackPreference("haptics"));
$("#marketButton").addEventListener("click", () => { closeHubMenu(); openExchange("market"); });
$("#leaderboardButton").addEventListener("click", () => { closeHubMenu(); openLeaderboard(); });
$("#updatesButton").addEventListener("click", () => {
  closeHubMenu();
  if (!els.updatesDialog.open) els.updatesDialog.showModal();
});
$("#voyageHubButton").addEventListener("click", () => openJourneyHub("voyage"));
$("#eventHubButton").addEventListener("click", () => openJourneyHub("event"));
$("#voyageJourneyTab").addEventListener("click", () => renderJourneyHub("voyage"));
$("#eventJourneyTab").addEventListener("click", () => renderJourneyHub("event"));
[$("#voyageJourneyTab"), $("#eventJourneyTab")].forEach((tab) => tab.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const next = tab.id === "voyageJourneyTab" ? $("#eventJourneyTab") : $("#voyageJourneyTab");
  renderJourneyHub(next.id === "eventJourneyTab" ? "event" : "voyage");
  next.focus();
}));
$("#chooseNextVoyage").addEventListener("click", chooseNextVoyage);
$("#startVoyageStage").addEventListener("click", beginVoyageStage);
$("#startEventTarget").addEventListener("click", beginEventTarget);
$("#browseExchange").addEventListener("click", () => openExchange("market"));
$("#confirmMarketBuy").addEventListener("click", confirmMarketPurchase);
$$('[data-recipe-rating]').forEach((button) => button.addEventListener("click", () => submitRecipeFeedback(button.dataset.recipeRating)));
$("#dismissRecipeFeedback").addEventListener("click", resetRecipeFeedback);
$("#marketSearch").addEventListener("input", () => {
  renderMarket();
  if ($("#marketSearch").value.trim()) track("market_searched", { length: $("#marketSearch").value.trim().length });
});
$$('[data-market-view]').forEach((button) => button.addEventListener("click", () => {
  state.marketView = button.dataset.marketView;
  renderMarket();
}));
$$('[data-leaderboard-division]').forEach((button) => button.addEventListener("click", () => {
  state.leaderboardDivision = button.dataset.leaderboardDivision;
  openLeaderboard(state.leaderboardScope, state.leaderboardDivision);
}));
$("#leaderboardScope").addEventListener("change", (event) => {
  state.leaderboardScope = event.currentTarget.value;
  loadLeaderboard();
});
$("#createChallenge").addEventListener("click", () => { closeHubMenu(); createChallengeFromHome(); });
$("#copyChallenge").addEventListener("click", copyChallenge);
$("#downloadCard").addEventListener("click", downloadConstellationCard);
$("#nativeShare").addEventListener("click", nativeShare);
$("#resultShare").addEventListener("click", () => {
  if (state.startingRun) return;
  els.resultDialog.close();
  openShare();
});
$("#resultReveal").addEventListener("click", () => {
  if (state.startingRun) return;
  els.resultDialog.close();
  openRevealPath();
});
$("#resultPrimary").addEventListener("click", () => state.resultAction?.());
$("#resultRetry").addEventListener("click", () => state.reveal.replayAvailable ? returnHome() : retryGame());
$("#raceCommunityGhost").addEventListener("click", () => {
  if (!queueNearbyCommunityRace()) return showToast("That nearby route is no longer available.");
  profile.rivalGhostEnabled = true;
  saveProfile({ fields: ["settings"] });
  track("community_viewed", { source: "community", action: "race" });
  if (els.resultDialog.open) els.resultDialog.close();
  void retryGame();
});
$("#resultLeaderboard").addEventListener("click", () => {
  if (state.startingRun) return;
  if (els.resultDialog.open) els.resultDialog.close();
  openLeaderboard(state.leaderboardScope, state.leaderboardDivision);
});
$$('button[data-theme]').forEach((button) => button.addEventListener("click", () => chooseTheme(button.dataset.theme)));
els.profileDialog.querySelectorAll(".profile-disclosure").forEach((section) => section.addEventListener("toggle", () => {
  if (!section.open) return;
  els.profileDialog.querySelectorAll(".profile-disclosure[open]").forEach((other) => {
    if (other !== section) other.open = false;
  });
}));
$$('[data-close]').forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.close === "revealDialog" && state.reveal.pending) return;
  document.getElementById(button.dataset.close).close();
}));
els.missionBriefingDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  cancelMissionBriefing();
});
els.pauseDialog.addEventListener("cancel", (event) => { event.preventDefault(); closePauseMenu(); });
els.pauseDialog.addEventListener("close", () => { finishPauseClose(); setTimeout(() => resumeTimerIfNeeded(), 0); });
els.revealDialog.addEventListener("cancel", (event) => {
  if (state.reveal.pending) event.preventDefault();
});
els.resultDialog.addEventListener("cancel", (event) => {
  if (state.startingRun) return event.preventDefault();
  if (pendingScoreBlocksExit()) {
    event.preventDefault();
    showToast("Upload or queue this score before leaving the result.");
    return;
  }
  if (state.reveal.replayAvailable) {
    event.preventDefault();
    returnHome();
  }
});
$("#recoveryDialog").addEventListener("cancel", (event) => event.preventDefault());
[els.paywallDialog, els.wishDialog, els.atlasDialog, els.senseDialog, els.shareDialog, els.profileDialog, els.journeyDialog, els.marketBuyDialog, els.leaderboardDialog, els.revealDialog, $("#recoveryDialog")].forEach((dialog) => dialog.addEventListener("close", () => setTimeout(resumeTimerIfNeeded, 0)));
els.exchangeDialog.addEventListener("close", () => {
  clearInterval(state.marketTimer);
  state.marketTimer = null;
  setTimeout(resumeTimerIfNeeded, 0);
});
window.addEventListener("resize", () => {
  if (els.gameScreen.hidden) return;
  requestAnimationFrame(() => {
    constrainBoardNodes();
    startCosmos();
    if (els.atlasDialog.open) renderAtlas();
  });
});
document.addEventListener("pointerdown", primeFeedbackAudio, { once: true, passive: true });
window.addEventListener("pointerdown", rememberPointerPosition, { capture: true, passive: true });
window.addEventListener("pointermove", rememberPointerPosition, { passive: true });
window.addEventListener("keydown", handlePauseShortcut);
window.addEventListener("keydown", activateShiftBoard);
window.addEventListener("keydown", activateCtrlHover);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.selectedNodeId != null && !event.defaultPrevented) {
    event.preventDefault();
    cancelTapChain({ announce: true });
  }
});
window.addEventListener("keyup", releaseCtrlHover);
window.addEventListener("keyup", releaseShiftBoard);
window.addEventListener("blur", releaseCtrlHover);
window.addEventListener("blur", releaseShiftBoard);
window.addEventListener("blur", cancelActivePointerGestures);
window.addEventListener("pagehide", flushRunSave);
window.addEventListener("beforeunload", (event) => {
  flushRunSave();
  if (pendingScoreBlocksExit() && !state.scoreSubmission.activeSaved) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("online", handleOnline);
window.addEventListener("offline", updateConnection);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    releaseCtrlHover();
    releaseShiftBoard();
    cancelActivePointerGestures();
    flushRunSave();
  }
  else wakeRevealPlayback();
});
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); state.installPrompt = event; $("#installButton").hidden = false; });
$("#installButton").addEventListener("click", async () => {
  if (!state.installPrompt) return;
  closeHubMenu();
  state.installPrompt.prompt();
  const choice = await state.installPrompt.userChoice;
  if (choice.outcome === "accepted") track("pwa_installed");
  state.installPrompt = null;
  $("#installButton").hidden = true;
});

async function boot() {
  configureStaticBetaUi();
  void loadBuildIdentity();
  const dailySense = refillDailySense();
  if (dailySense.refilled) saveProfile({ cloud: false });
  else renderProfile();
  if (dailySense.granted) track("sense_earned", { source: "daily", reward: dailySense.granted });
  updateConnection();
  await loadConfig();
  try { await ensurePlayer(); }
  catch { showToast("Leaderboard and Word Exchange need a connection."); }
  if (profile.playerId && profile.playerToken) await refreshCosmicEventState();
  if (profile.playerId && profile.playerToken) await initializeCloudServices();
  announcePendingScoreRecovery(await retryPendingScoreUploads());
  if ("serviceWorker" in navigator && window.top === window.self) {
    const serviceWorkerUrl = isStaticBeta ? "./service-worker.js?v=3.0.0-beta.1" : "/play/service-worker.js?v=3.0.0-beta.1";
    const serviceWorkerScope = isStaticBeta ? "./" : "/play/";
    navigator.serviceWorker.register(serviceWorkerUrl, { scope: serviceWorkerScope }).catch(() => {});
  }
  track("app_opened", { installed: matchMedia("(display-mode: standalone)").matches });
  announceModeScreenViewed();
  const params = new URLSearchParams(location.search);
  const challengeRequested = params.get("challenge") === "1" && params.get("target");
  const restored = challengeRequested ? false : await restoreInterruptedRun(readActiveRunSnapshot());
  if (!restored && challengeRequested) {
    track("challenge_opened", { target: params.get("target") });
    void beginMode("challenge", { target: params.get("target"), seed: Number(params.get("seed")) || stableHash(params.get("target")) });
  } else if (!restored) await handleLaunchIntent(params);
  if (window.parent !== window) window.parent.postMessage({ type: "constellore:ready", localOnly: isStaticBeta }, location.origin);
}

boot().catch((error) => {
  console.error("Constellore could not finish booting.", error);
  showToast("The cosmos could not finish loading. Refresh to try again.");
});
