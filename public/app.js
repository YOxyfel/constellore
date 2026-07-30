import { createCtrlHoverController } from "./ctrl-hover.mjs?v=5.0.0-beta.1";
import { resetAccountProfile } from "./account-profile.mjs?v=5.0.0-beta.1";
import { createShiftBoardController } from "./shift-board.mjs?v=5.0.0-beta.1";
import { findOpenSpawn, orderInventory, packOrbit, pickMagneticTarget } from "./frictionless.mjs?v=5.0.0-beta.1";
import { buildMasteryCollections, lifetimeMasteryProgress, recordRecipeDiscovery, sanitizeRecipeMasteryState, summarizeMasteryCollections } from "./recipe-mastery.mjs?v=5.0.0-beta.1";
import { QUICK_TIP_LIMIT, assistancePolicy, buildGhost, combineAssistance, ghostSnapshot, ghostTrailPreviewState, grantSenseCharges, lifetimeProgression, reconcileCloudProgression, refillSenseWallet, sanitizeFeedbackPreferences, sanitizeSenseWallet, spendSenseCharge, weeklyRatingPresentation } from "./engagement-features.mjs?v=5.0.0-beta.1";
import { createFirstOrbitGame, firstOrbitProgress, firstOrbitWrongPairMessage, resolveFirstOrbitCombination, sanitizeFirstOrbitState } from "./first-orbit.mjs?v=5.0.0-beta.1";
import { firstGameLaunchIntent, firstGameRequired } from "./first-game-experience.mjs?v=5.0.0-beta.1";
import { createSecondOrbitGame, secondOrbitProgress, sanitizeSecondOrbitState } from "./second-orbit.mjs?v=5.0.0-beta.1";
import { exploreGame, mergeExploreInventory, sanitizeExploreInventory } from "./explore-sandbox.mjs?v=5.0.0-beta.1";
import { parseConstelloreChallengeUrl } from "./constellation-card.mjs?v=5.0.0-beta.1";
import { createShareCardController } from "./share-card-runtime.mjs?v=5.0.0-beta.1";
import { ALL_COSMETIC_BODY_CLASSES, COSMETIC_ITEMS, DEFAULT_COSMETIC_LOADOUT, collectionForCosmeticLoadout, cosmeticById, cosmeticClasses, earnedBadges, migrateCosmeticLoadout, progressionAuraClass, sanitizeCosmeticLoadout } from "./cosmetic-economy.mjs?v=5.0.0-beta.1";
import { createAudioRuntime } from "./audio-runtime.mjs?v=5.0.0-beta.1";
import { createFeedbackPreferencesUi } from "./feedback-preferences-ui.mjs?v=5.0.0-beta.1";
import { beginCosmeticDragTrail as resetCosmeticDragTrail, measuredNodeAnchor, queueCosmeticFusionBurst as appendCosmeticFusionBurst, recordCosmeticDragTrail as appendCosmeticDragTrail, startCosmosCanvas } from "./cosmetic-canvas.mjs?v=5.0.0-beta.1";
import { createRecipeFeedbackRequest, recipeFingerprint, sanitizeRecipeRating } from "./recipe-feedback.mjs?v=5.0.0-beta.1";
import { selectUniverse } from "./universe-director.mjs?v=5.0.0-beta.1";
import { clearGameStorage, createRevisionedStorageCoordinator, listPendingScoreRecords, removePendingScoreRecord, revisionMetadata, safeBrowserStorage, savePendingScoreRecord } from "./pending-scores.mjs?v=5.0.0-beta.1";
import { buildMissionBriefing } from "./mission-briefing.mjs?v=5.0.0-beta.1";
import { advanceVoyageProgress, constellationVoyage, constellationVoyageCatalog, currentVoyageStage, sanitizeVoyageProgress, voyageProgress } from "./constellation-voyages.mjs?v=5.0.0-beta.1";
import { annotateCosmicEventResult, cosmicEventCollectionProgress, cosmicEventTargets, currentCosmicEvent } from "./cosmic-events.mjs?v=5.0.0-beta.1";
import { explainRecipeNearMiss, explainSuccessfulRecipe } from "./recipe-insight.mjs?v=5.0.0-beta.1";
import { buildLivingAtlas, buildRouteProgress } from "./living-atlas.mjs?v=5.0.0-beta.1";
import { sanitizeAuthoredRouteProgress } from "./route-distance.mjs?v=5.0.0-beta.1";
import { PATH_GUARD_VERSION, pathGuardEligibility, pathGuardPairKey } from "./path-guard.mjs?v=5.0.0-beta.1";
import { buildCommunityResults } from "./community-results.mjs?v=5.0.0-beta.1";
import { comparePersonalBest, createRouteSignature, gradeSignatureRoute, sanitizeRouteSignature } from "./signature-routes.mjs?v=5.0.0-beta.1";
import { createHomeMenuState, HOME_MENU_ADVANCED_WINS } from "./home-menu.mjs?v=5.0.0-beta.1";
import { renderProfileRankView, syncHomeMenuView } from "./home-menu-view.mjs?v=5.0.0-beta.1";
import { createRunIqState, rewardRunIq, runIqApplies, runIqPairKey, runIqRouteContext, sanitizeRunIqState, softenRunIq } from "./run-iq.mjs?v=5.0.0-beta.1";
import { adaptiveModePolicy, applyAdaptiveChallengeOutcome, createAdaptiveDifficultyState, rememberAdaptiveTarget, sanitizeAdaptiveDifficultyState } from "./adaptive-difficulty.mjs?v=5.0.0-beta.1";
import { createRemixProgressionState, getPromotionEligibility, getRemixMasteryProgress, getRemixRankPresentation, recordRemixProgressionOutcome, recordRemixPromotionTrialOutcome, sanitizeRemixProgressionState, startRemixPromotionTrial } from "./remix-progression.mjs?v=5.0.0-beta.1";
import { createRemixReadinessState, getAdaptiveRemixIntensity, recordRemixReadinessOutcome, sanitizeRemixReadinessState } from "./remix-readiness.mjs?v=5.0.0-beta.1";
import { selectStartStyle } from "./shuffled-start.mjs?v=5.0.0-beta.1";
import { createRankBoardArtRuntime } from "./rank-board-art-runtime.mjs?v=5.0.0-beta.1";
import { routeRankChangeMessage, sanitizeRouteOutcomeHashes, sanitizeRouteRankSummary } from "./route-rank-client.mjs?v=5.0.0-beta.1";
import { createDefaultProfile } from "./default-profile.mjs?v=5.0.0-beta.1";
import { MASTERY_CATALOG } from "./mastery-catalog.mjs?v=5.0.0-beta.1";
import { createInitialAppState } from "./initial-app-state.mjs?v=5.0.0-beta.1";
import { createCombinationReportDelivery, sanitizeCombinationSuggestion, validateCombinationReportEndpoint } from "./combination-report-delivery.mjs?v=5.0.0-beta.1";
import { buildRevealTree, revealWordKey } from "./reveal-tree.mjs?v=5.0.0-beta.1";
import { createCosmicGate } from "./cosmic-gate.mjs?v=5.0.0-beta.1";
import { victoryHandoffHoldMs } from "./victory-handoff.mjs?v=5.0.0-beta.1";
import { activatedRunClock, enterPreparedRun, isPermanentActivationFailure, isReplayResponseCurrent, shouldRestoreObjective } from "./run-entry.mjs?v=5.0.0-beta.1";
import { CLIENT_ONLY_RESUME_MODES, activeRunSnapshotIsValid, clientOnlyRestorePayload, createClientRunPersistence, markLaunchCinematicSessionPlayed, selectStartupResumeSnapshot } from "./session-resume.mjs?v=5.0.0-beta.1";
import "./cosmic-interlude-runtime.mjs?v=5.0.0-beta.1";
import { drawRevealGraph, renderRevealController, renderRevealPresentation, revealBatchAnnouncement, revealBatchKeys, revealCameraForBatch, revealStageGeometry } from "./reveal-presentation.mjs?v=5.0.0-beta.1";

const starterEmoji = { Earth: "🌍", Water: "💧", Fire: "🔥", Air: "💨" };
const starterCategory = { Earth: "nature", Water: "force", Fire: "force", Air: "force" };
const isStaticBeta = document.body.dataset.runtime === "local-practice";
const PROFILE_KEY = isStaticBeta ? "constellore-local-profile-v1" : "constellore-profile-v1";
const LEGACY_PROFILE_KEYS = isStaticBeta ? [] : ["wordforge-profile-v3", "wordforge-profile-v2"];
const todayKey = new Date().toISOString().slice(0, 10);
const sessionId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const PROFILE_SAVE_META_KEY = "__localSave";
const MAX_BOARD_NODES = 180;
const MAX_SHIFT_COPIES_PER_DRAG = 24;
const MAX_BOARD_HISTORY = 30;
const MAX_PATH_GUARD_PAIRS = 128;
const LOCAL_ANALYTICS_KEY = "constellore-local-event-counts-v1";
const LOCAL_RECIPE_FEEDBACK_KEY = "constellore-local-recipe-feedback-v1";
const LOCAL_EXPECTED_PAIRS_KEY = "constellore-local-expected-pairs-v1";
const LOCAL_EXPECTED_PAIR_OUTBOX_KEY = "constellore-local-expected-pair-outbox-v1";
const FIRST_OPEN_CINEMATIC_KEY = "constellore-first-open-cinematic-v1";
const ANALYTICS_COHORT_KEY = "constellore-analytics-cohort-v1";
const ANALYTICS_PREFERENCE_KEY = "constellore-analytics-preference-v1";
const PENDING_RECOVERY_KIT_KEY = "constellore-pending-recovery-kit-v1";
const COSMOS_CIRCUIT_SAVE_KEY = "constellore-cosmos-circuit-v1";
const DUEL_IDENTITY_KEY = "constellore-duel-identity-v1";
const DUEL_ACTIVE_MATCH_KEY = "constellore-scramble-active-v1";
const DUEL_API_BASE = configuredDuelApiBase(document.body.dataset.duelApi);
const ADAPTIVE_DIFFICULTY_KEY = isStaticBeta ? "constellore-local-adaptive-difficulty-v1" : "constellore-adaptive-difficulty-v1";
const VOYAGE_REWARD = 35;
const EVENT_COLLECTION_REWARD = 60;
const MAX_TRANSIENT_TRAILS = 120;
const FEEDBACK_API_URL = validateCombinationReportEndpoint(document.body.dataset.feedbackApi);
const COMMERCE_LAUNCH_READY = document.body.dataset.commerce === "enabled";
const ANALYTICS_DIMENSIONS = new Set([
  "mode", "division", "source", "result", "completed", "installed", "replay",
  "free", "status", "scope", "location", "phase", "ranked", "reward", "success",
  "milestone", "kind", "track", "tier", "practiceBoost"
]);

const defaultProfile = createDefaultProfile({
  cosmeticLoadout: DEFAULT_COSMETIC_LOADOUT,
  voyageProgress: sanitizeVoyageProgress({}),
  routeProgression: createRemixProgressionState(),
  remixReadiness: createRemixReadinessState()
});

const state = createInitialAppState({
  adaptiveDifficulty: readAdaptiveDifficulty(),
  runIq: createRunIqState(),
  routeProgress: sanitizeAuthoredRouteProgress(null)
});

let profile = loadProfile();
let profileSaveBaseline = structuredClone(profile);
const profilePersistence = createRevisionedStorageCoordinator({
  key: PROFILE_KEY,
  channelName: "constellore-profile-v1",
  writer: sessionId,
  metadataKey: PROFILE_SAVE_META_KEY,
  normalize: normalizeStoredProfile,
  getCurrent: () => profile,
  onExternal(incoming) {
    if (!incoming) return;
    profile = incoming;
    profileSaveBaseline = structuredClone(incoming);
    renderProfile();
  }
});

const gameAudio = createAudioRuntime({
  getPreferences: () => profile.feedbackPreferences,
  getSoundTheme: () => profile.cosmetics?.soundTheme
});
gameAudio.setScene("silent");
let secondarySurfaceLoaderPromise = null;
let cosmeticsObservatoryHostPromise = null;
let cosmeticsObservatoryHost = null;
let stardustStorePromise = null;
let stardustStoreRuntime = null;
let scramblePromise = null;
let scrambleRuntime = null;
let scrambleHostEpochKey = "";
let duelIdentity = readDuelIdentity();
let duelIdentityPromise = null;
let playerIdentityPromise = null;

function loadSecondarySurfaceModule() {
  if (!secondarySurfaceLoaderPromise) {
    secondarySurfaceLoaderPromise = import("./secondary-surface-loader.mjs?v=5.0.0-beta.1")
      .catch((error) => {
        secondarySurfaceLoaderPromise = null;
        throw error;
      });
  }
  return secondarySurfaceLoaderPromise;
}

function ensureStardustStore() {
  if (stardustStoreRuntime) return Promise.resolve(stardustStoreRuntime);
  if (!stardustStorePromise) {
    stardustStorePromise = Promise.all([
      loadSecondarySurfaceModule().then((module) => module.loadOptionalStylesheet("stardust-store.css?v=5.0.0-beta.1")),
      import("./stardust-store-runtime.mjs?v=5.0.0-beta.1")
    ])
      .then(([, module]) => {
        if (typeof module.createStardustStoreRuntime !== "function") {
          throw new Error("Stardust supplies could not be initialized.");
        }
        stardustStoreRuntime = module.createStardustStoreRuntime({
          documentRef: document,
          getProfile: () => profile,
          isPowerupBusy: () => state.powerups.busy,
          onProfileChange: () => {
            saveProfile({ fields: ["progression"] });
            renderProfile();
          },
          playFeedback,
          showToast,
          track
        });
        return stardustStoreRuntime;
      })
      .catch((error) => {
        stardustStorePromise = null;
        throw error;
      });
  }
  return stardustStorePromise;
}

function ensureScramble() {
  if (scrambleRuntime) return Promise.resolve(scrambleRuntime);
  if (!scramblePromise) {
    scramblePromise = loadSecondarySurfaceModule()
      .then((module) => module.createLazyScramble({
        documentRef: document,
        windowRef: window,
        available: duelFeatureAvailable(),
        request: requestDuelApi,
        callsign: () => duelIdentity?.callsign || profile.callsign || "STARGAZER",
        soloWins: () => profile.wins,
        onBeginMatch: hydrateScrambleMatch,
        onChapterChange: hydrateScrambleMatch,
        onMatchLive: () => {
          if (state.mode === "scramble") {
            state.pause.active = false;
            els.gameScreen.classList.remove("orbit-paused");
          }
        },
        onFinished: finishScrambleMatch,
        onHome: () => returnHome({ skipForfeit: true }),
        onConnectionChange: (status) => {
          if (status === "reconnecting") showToast("Reconnecting to your rival\u2026", { scope: "global" });
        },
        playFeedback,
        track
      }))
      .then((runtime) => {
        if (!runtime || typeof runtime.open !== "function" || typeof runtime.submitAction !== "function") {
          throw new Error("Constellation Scramble could not be initialized.");
        }
        scrambleRuntime = runtime;
        return runtime;
      })
      .catch((error) => {
        scramblePromise = null;
        throw error;
      });
  }
  return scramblePromise;
}

async function openScramble({ trigger = document.activeElement, invite = "" } = {}) {
  if (!homeMenuState().onboardingComplete) {
    showToast("Finish the two short opening constellations before entering a live 1v1.", { scope: "global" });
    return false;
  }
  if (!duelFeatureAvailable()) {
    showToast("Live 1v1 is unavailable in this build.", { scope: "global" });
    return false;
  }
  closeHubMenu();
  try {
    const runtime = await ensureScramble();
    runtime.setRankedUnlocked(scrambleRankedUnlocked());
    await runtime.open({ opener: trigger, invite, ranked: scrambleRankedUnlocked() });
    track("scramble_lobby_opened", { ranked: scrambleRankedUnlocked(), source: invite ? "invite" : "home" });
    return true;
  } catch (error) {
    showSecondarySurfaceFailure(error, "Constellation Scramble could not be opened.");
    return false;
  }
}

function showSecondarySurfaceFailure(error, fallback) {
  showToast(error?.message || fallback, { scope: "global" });
}
const feedbackPreferencesUi = createFeedbackPreferencesUi({
  get: () => profile.feedbackPreferences,
  set: (value) => { profile.feedbackPreferences = value; },
  save: () => saveProfile({ fields: ["settings"] }),
  audio: gameAudio,
  track
});
const cosmeticClassNames = [...ALL_COSMETIC_BODY_CLASSES];
const fullCosmeticPreviewOwnership = Object.freeze({
  supporter: true,
  itemIds: COSMETIC_ITEMS.map((item) => item.id)
});
applyCosmeticLoadout();
const networkInformation = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const syncReducedDataPreference = () => {
  document.body.dataset.saveData = String(Boolean(networkInformation?.saveData));
  gameAudio.setPreferences();
};
syncReducedDataPreference();
networkInformation?.addEventListener?.("change", syncReducedDataPreference);
let config = { billingEnabled: false, checkoutUrl: "", testStoreEnabled: false, creditPacks: [], rewardedAdsEnabled: false, founderPrice: "€6.99", aiEnabled: false, cloudProfileEnabled: false };
let localRuntimePromise;
let activeTrayDragCleanup = null;
let activeTrayShiftSource = null;
let activeBoardDragCleanup = null;
let shiftCopyLimitAnnounced = false;
let lastPointerPosition = null;
let boardHistory = { past: [], future: [] };
let shiftHistorySnapshot = null;
let boardUndoTimer = null;
let armedPowerupShortcut = { kind: "", expiresAt: 0, timer: null };
let runSaveTimer = null;
let cloudSyncTimer = null;
let pauseCloseRestoreFocus = true;
let boardGeometryVersion = 0;
let runIqFeedbackTimer = null;
let routeProgressFeedbackTimer = null;
let rankBoardArtRuntime = null;
let developerConsolePromise = null;
let combinationStoryPromise = null;
let combinationStoryView = null;
let combinationStoryRevision = 0;
let goldenPairRuntimePromise = null;
let goldenPairRuntime = null;
let analyticsPreference = readAnalyticsPreference();
let analyticsCohortId = readAnalyticsCohort();
const pendingScoreRetryPromises = new Map();
const expectedPairDelivery = createCombinationReportDelivery({
  endpoint: FEEDBACK_API_URL,
  getMode: () => state.mode || "reach",
  getReporterId: () => analyticsCohortId || sessionId,
  pairKey: expectedPairKey
});
const ACTIVE_RUN_KEY = isStaticBeta ? "constellore-local-active-run-v1" : "constellore-active-run-v1";
const LEGACY_PENDING_SCORES_KEY = "constellore-pending-scores-v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const billingAdapter = () => globalThis.constelloreBilling || globalThis.wordforgeBilling;
const adsAdapter = () => globalThis.constelloreAds || globalThis.wordforgeAds;
const els = {
  startScreen: $("#startScreen"), gameScreen: $("#gameScreen"), targetMessage: $("#targetMessage"),
  board: $("#board"), boardItems: $("#boardItems"), boardGuide: $("#boardGuide"), cosmosCanvas: $("#cosmosCanvas"), combinationStory: $("#combinationStory"),
  tidyBoard: $("#tidyBoard"), resetBoard: $("#resetBoard"), undoBoardAction: $("#undoBoardAction"), redoBoardAction: $("#redoBoardAction"), dropPairPreview: $("#dropPairPreview"),
  tapChainStatus: $("#tapChainStatus"), tapChainText: $("#tapChainText"), boardUndo: $("#boardUndo"),
  alchemyNote: $("#alchemyNote"), boardAnnouncement: $("#boardAnnouncement"), wordList: $("#wordList"), collectionCount: $("#collectionCount"),
  expectedPairFeedback: $("#expectedPairFeedback"), expectedPairForm: $("#expectedPairForm"), expectedPairButton: $("#expectedPairButton"),
  expectedPairResult: $("#expectedPairResult"), expectedPairDelivery: $("#expectedPairDelivery"),
  inventorySearch: $("#inventorySearch"), inventorySearchClear: $("#inventorySearchClear"), inventorySearchStatus: $("#inventorySearchStatus"),
  modeName: $("#modeName"), targetWord: $("#targetWord"), difficultyPill: $("#difficultyPill"), remixPill: $("#remixPill"), universePill: $("#universePill"), lawPill: $("#lawPill"), movesValue: $("#movesValue"),
  timerHud: $("#timerHud"), timerValue: $("#timerValue"), pathCount: $("#pathCount"),
  runIqHud: $("#runIqHud"), runIqValue: $("#runIqValue"), runIqDelta: $("#runIqDelta"), runIqStreak: $("#runIqStreak"), runIqBar: $("#runIqBar"), runIqStatus: $("#runIqStatus"),
  runMilestone: $("#runMilestone"), milestoneText: $("#milestoneText"), milestoneBar: $("#milestoneBar"), hintObjective: $("#hintObjective"), hintObjectiveText: $("#hintObjectiveText"), wishState: $("#wishState"),
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
  missionBriefingDialog: $("#missionBriefingDialog"), missionAdaptiveNote: $("#missionAdaptiveNote"), pauseDialog: $("#pauseDialog"), journeyDialog: $("#journeyDialog"),
  profileDialog: $("#profileDialog"), shareDialog: $("#shareDialog"), resultDialog: $("#resultDialog"),
  developerLoginDialog: $("#developerLoginDialog"), developerDialog: $("#developerDialog"), developerVfxDialog: $("#developerVfxDialog"),
  updatesDialog: $("#updatesDialog"), hubMenuDialog: $("#hubMenuDialog"),
  exchangeDialog: $("#exchangeDialog"), marketBuyDialog: $("#marketBuyDialog"), leaderboardDialog: $("#leaderboardDialog"),
  revealDialog: $("#revealDialog"), revealController: $("#revealController"), revealPathButton: $("#revealPathButton"),
  revealStepText: $("#revealStepText"), revealPause: $("#revealPause"), revealSpeed: $("#revealSpeed"),
  revealSkip: $("#revealSkip"), revealProgressBar: $("#revealProgressBar"), revealAnnouncement: $("#revealAnnouncement"),
  revealEquation: $("#revealEquation"), revealEquationStep: $("#revealEquationStep"),
  revealEquationA: $("#revealEquationA"), revealEquationAEmoji: $("#revealEquationAEmoji"),
  revealEquationB: $("#revealEquationB"), revealEquationBEmoji: $("#revealEquationBEmoji"),
  revealEquationAnswer: $("#revealEquationAnswer"), revealEquationAnswerEmoji: $("#revealEquationAnswerEmoji"),
  revealEquationNote: $("#revealEquationNote"),
  marketList: $("#marketList"), marketBalance: $("#marketBalance"), marketCountdown: $("#marketCountdown"),
  marketMessage: $("#marketMessage"), leaderboardRows: $("#leaderboardRows"), leaderboardMessage: $("#leaderboardMessage"),
  resultEmoji: $("#resultEmoji"), resultKicker: $("#resultKicker"), resultTitle: $("#resultTitle"),
  resultStats: $("#resultStats"), resultAdaptiveNote: $("#resultAdaptiveNote"), resultRemixNote: $("#resultRemixNote"), resultMasteryCard: $("#resultMasteryCard"), resultMasteryText: $("#resultMasteryText"), resultPrimary: $("#resultPrimary"), resultRetry: $("#resultRetry"), resultReplay: $("#resultReplay"),
  resultShare: $("#resultShare"), rewardCard: $("#rewardCard"), rewardDust: $("#rewardDust"),
  rewardReason: $("#rewardReason"), masteryCollectionList: $("#masteryCollectionList"),
  atlasMap: $("#atlasMap"), atlasGraph: $("#atlasGraph"), atlasGraphEdges: $("#atlasGraphEdges"), atlasGraphNodes: $("#atlasGraphNodes"), atlasGraphSummary: $("#atlasGraphSummary"),
  signatureResultCard: $("#signatureResultCard"), communityResultCard: $("#communityResultCard"), communityResultStats: $("#communityResultStats"),
  firstOrbitGuide: $("#firstOrbitGuide"), recipeFeedback: $("#recipeFeedback"),
  routeProgressTrail: $("#routeProgressTrail"),
  toast: $("#toast"), connectionBadge: $("#connectionBadge")
};

const cosmicGateRoot = $("#cosmicGate");
const cosmicGate = createCosmicGate({
  root: cosmicGateRoot,
  onTransition: (cue) => playFeedback(cue),
  surfaces: [els.startScreen, els.gameScreen]
});
// The inline display guard prevents the gate from flashing before CSS loads.
// Once the controller owns it, `hidden` and the controller's phases take over.
cosmicGateRoot?.style.removeProperty("display");
const shareCards = createShareCardController({
  state,
  getTodayKey: () => todayKey,
  stopTimer,
  showToast,
  track,
  fetchJson,
  closeHubMenu,
  getCosmeticCardStyle: () => collectionForCosmeticLoadout(profile.cosmetics)?.slug || "custom"
});
shareCards.bind();

function cosmeticWorldPreviewActive() {
  return cosmeticsObservatoryHost?.isPreviewActive?.() === true;
}

function ensureCosmeticsObservatoryHost() {
  if (cosmeticsObservatoryHost) return Promise.resolve(cosmeticsObservatoryHost);
  if (!cosmeticsObservatoryHostPromise) {
    cosmeticsObservatoryHostPromise = loadSecondarySurfaceModule()
      .then((module) => module.createLazyCosmeticsObservatoryHost({
        state, cosmicGate, gameAudio, getProfile: () => profile, ensurePlayer, fetchJson, authHeaders,
        applyServerPlayer, applyCosmeticLoadout, cosmeticOwnershipOptions, legacyThemeForLoadout,
        saveProfile, sanitizeCosmeticEffects, track, openPremium, resumeTimerIfNeeded, startCosmos,
        stopTimer, closeHubMenu
      }))
      .then((host) => {
        if (!host || typeof host.open !== "function") {
          throw new Error("Cosmetics Observatory could not be initialized.");
        }
        cosmeticsObservatoryHost = host;
        return host;
      })
      .catch((error) => {
        cosmeticsObservatoryHostPromise = null;
        throw error;
      });
  }
  return cosmeticsObservatoryHostPromise;
}

async function openCosmeticsObservatory(options = {}) {
  try {
    const host = await ensureCosmeticsObservatoryHost();
    await host.open(options);
  } catch (error) {
    showSecondarySurfaceFailure(error, "Cosmetics Observatory could not be opened.");
  }
}

let launchCinematicOutcome = {
  played: false,
  handled: false,
  menuHandoff: false,
  playbackRate: 0
};
let launchMenuAudioStarted = false;
function releaseLaunchBlackout() {
  cosmicGate.skipIntro();
}
function handoffLaunchMenu() {
  if (!launchMenuAudioStarted) {
    launchMenuAudioStarted = true;
    gameAudio.setScene("home");
    gameAudio.prime();
  }
  releaseLaunchBlackout();
}
function startupScrambleInvite(locationRef = location) {
  try {
    const url = new URL(locationRef.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const token = String(hash.get("scramble") || hash.get("duel") || url.searchParams.get("scramble") || url.searchParams.get("duel") || "").trim();
    return /^[a-z0-9][a-z0-9._~-]{7,159}$/i.test(token) ? token : "";
  } catch {
    return "";
  }
}
function hasRememberedScrambleMatch() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DUEL_ACTIVE_MATCH_KEY) || "null");
    return typeof saved?.id === "string" && saved.id.length > 0 && saved.id.length <= 96;
  } catch {
    return false;
  }
}
const startupParams = new URLSearchParams(location.search);
const startupSharedChallenge = parseConstelloreChallengeUrl(startupParams, todayKey);
const startupModeIntent = firstGameLaunchIntent(startupParams.get("mode"));
const startupScrambleInviteCode = startupScrambleInvite();
const startupScrambleResume = hasRememberedScrambleMatch();
const startupLaunchIntent = Boolean(startupScrambleInviteCode || startupScrambleResume || startupSharedChallenge || startupModeIntent);
const startupResumeSnapshot = selectStartupResumeSnapshot({
  snapshot: readActiveRunSnapshot(),
  sharedChallenge: startupSharedChallenge,
  modeIntent: startupModeIntent
});
const startupScramblePreemptsResume = Boolean(startupScrambleInviteCode || startupScrambleResume);
if (!startupResumeSnapshot) {
  if (!startupScramblePreemptsResume) {
    try {
      const { createFirstOpenCinematic } = await import("./cinematic/first-open-cinematic.mjs?v=5.0.0-beta.1");
      launchCinematicOutcome = await createFirstOpenCinematic({
        storageKey: FIRST_OPEN_CINEMATIC_KEY,
        onPlaybackIntent: () => gameAudio.prime({ startMusic: false }),
        onHandoff: handoffLaunchMenu
      }).playLaunch();
    } catch { /* A failed optional film opens the menu without reviving the retired launch gate. */ }
    handoffLaunchMenu();
  } else {
    markLaunchCinematicSessionPlayed();
    launchCinematicOutcome = {
      played: false,
      handled: true,
      reason: "live-duel",
      menuHandoff: false,
      playbackRate: 0
    };
    handoffLaunchMenu();
  }
} else {
  markLaunchCinematicSessionPlayed();
  launchCinematicOutcome = {
    played: false,
    handled: true,
    reason: "active-run",
    menuHandoff: false,
    playbackRate: 0
  };
  if (startupScrambleInviteCode || startupScrambleResume) handoffLaunchMenu();
}

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
  try { localStorage.setItem(ANALYTICS_COHORT_KEY, analyticsCohortId); } catch {}
  return analyticsCohortId;
}

function readAdaptiveDifficulty() {
  try {
    return sanitizeAdaptiveDifficultyState(JSON.parse(localStorage.getItem(ADAPTIVE_DIFFICULTY_KEY) || "null"));
  } catch {
    return createAdaptiveDifficultyState();
  }
}

function saveAdaptiveDifficulty() {
  try {
    localStorage.setItem(ADAPTIVE_DIFFICULTY_KEY, JSON.stringify(sanitizeAdaptiveDifficultyState(state.adaptiveDifficulty)));
  } catch {}
}

function localRouteRankSummary() {
  profile.routeProgression = sanitizeRemixProgressionState(profile.routeProgression);
  profile.remixReadiness = sanitizeRemixReadinessState(profile.remixReadiness);
  const progression = profile.routeProgression;
  const mastery = getRemixMasteryProgress(progression);
  const promotion = getPromotionEligibility(progression);
  const rank = getRemixRankPresentation(progression.rankId);
  const challengeRank = promotion.active && promotion.nextRank
    ? getRemixRankPresentation(promotion.nextRank.id)
    : rank;
  const intensity = getAdaptiveRemixIntensity(profile.remixReadiness, challengeRank.id);
  return sanitizeRouteRankSummary({
    version: progression.version,
    rank,
    challengeRank,
    mastery: {
      points: mastery.masteryPoints,
      rankFloor: mastery.rankFloor,
      nextThreshold: mastery.nextThreshold,
      pointsIntoRank: mastery.pointsIntoRank,
      pointsRequired: mastery.pointsRequired,
      pointsRemaining: mastery.pointsRemaining,
      fraction: mastery.fraction
    },
    promotion: {
      active: promotion.active,
      eligible: promotion.eligible,
      status: promotion.status,
      currentRank: promotion.rank,
      targetRank: promotion.nextRank,
      attempt: promotion.trial ? promotion.trial.attempts + 1 : 0,
      attemptsCompleted: promotion.trial?.attempts || 0,
      attemptsTotal: promotion.trialLength,
      wins: promotion.trial?.wins || 0,
      winsRequired: promotion.winsRequired,
      flawlessWins: promotion.trial?.flawlessWins || 0
    },
    remixIntensity: intensity,
    familyMastery: profile.remixReadiness.familyMastery,
    adaptiveDifficulty: state.adaptiveDifficulty
  });
}

function currentRouteRank() {
  return sanitizeRouteRankSummary(profile.routeRank)
    || (isStaticBeta ? localRouteRankSummary() : sanitizeRouteRankSummary({
      rank: "bronze",
      challengeRank: "bronze",
      adaptiveDifficulty: state.adaptiveDifficulty
    }));
}

function pathGuardContextFor(game = state.game, run = state.run) {
  const mode = String(game?.mode || "").trim().toLowerCase();
  const currentGame = game === state.game;
  const assist = currentGame ? state.assist : run?.assist || "none";
  const scoringDisabled = currentGame
    ? Boolean(state.scoringDisabled)
    : Boolean(run?.scoreEligible === false || game?.scoreEligible === false);
  return {
    rankId: game?.remixes?.rank?.id || "",
    mode,
    target: game?.target || "",
    assist,
    scoringDisabled,
    scoreEligible: !scoringDisabled,
    finished: currentGame ? Boolean(state.finished) : false,
    ranked: Boolean(run?.ranked),
    practiceReplay: game?.practiceReplay === true,
    remixes: game?.remixes || null,
    promotion: game?.promotion || null,
    tutorial: ["training", "second-orbit"].includes(mode),
    multiplayer: mode === "scramble",
    competitive: Boolean(run?.ranked || ["daily", "weekly", "challenge", "scramble"].includes(mode)),
    wished: currentGame && Boolean(state.wished),
    powerups: currentGame ? state.powerups : null,
    reveal: currentGame ? state.reveal : null
  };
}

function pathGuardActiveFor(game = state.game, run = state.run) {
  const mode = String(game?.mode || "").trim().toLowerCase();
  if (
    !game
    || game.adaptive !== true
    || game.practiceReplay === true
    || run?.ranked === true
    || mode !== "reach"
    || Math.max(
      Array.isArray(game.remixes?.rules) ? game.remixes.rules.length : 0,
      Math.trunc(Number(game.remixes?.activeCount) || 0)
    ) > 0
  ) return false;
  return pathGuardEligibility(pathGuardContextFor(game, run)).active;
}

function sanitizeRememberedPathGuardPairs(value) {
  const pairs = new Set();
  if (!Array.isArray(value)) return pairs;
  for (const candidate of value.slice(-MAX_PATH_GUARD_PAIRS)) {
    if (typeof candidate !== "string" || candidate.length > 180) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (!Array.isArray(parsed) || parsed.length !== 2) continue;
      const normalized = pathGuardPairKey(parsed[0], parsed[1]);
      if (normalized && normalized === candidate) pairs.add(normalized);
    } catch { /* Invalid saved guidance is ignored. */ }
  }
  return pairs;
}

function rememberPathGuardPair(a, b) {
  const pairKey = pathGuardPairKey(a, b);
  if (!pairKey) return { pairKey: "", remembered: false };
  const remembered = state.pathGuard.blockedPairs.has(pairKey);
  if (!remembered) {
    state.pathGuard.blockedPairs.add(pairKey);
    while (state.pathGuard.blockedPairs.size > MAX_PATH_GUARD_PAIRS) {
      state.pathGuard.blockedPairs.delete(state.pathGuard.blockedPairs.values().next().value);
    }
    scheduleRunSave();
  }
  return { pairKey, remembered };
}

function pathGuardPairWasRemembered(a, b) {
  const pairKey = pathGuardPairKey(a, b);
  return Boolean(
    pathGuardActiveFor()
    && pairKey
    && state.pathGuard.blockedPairs.has(pairKey)
  );
}

function syncRankBoardArt() {
  const routeRank = currentRouteRank();
  const rankId = routeRank?.rank?.id || "bronze";
  document.body.dataset.routeRank = rankId;
  document.body.dataset.routeArtTier = String(Math.ceil((routeRank?.rank?.number || 1) / 2));
  if (!els.board) return;
  if (!rankBoardArtRuntime) {
    rankBoardArtRuntime = createRankBoardArtRuntime({
      target: els.board,
      rank: rankId,
      quality: "auto",
      preload: true
    });
    return;
  }
  rankBoardArtRuntime.setRank(rankId);
}

function applyRouteRank(candidate, { announce = false } = {}) {
  const next = sanitizeRouteRankSummary(candidate);
  if (!next) return null;
  const previous = sanitizeRouteRankSummary(profile.routeRank);
  profile.routeRank = next;
  if (isStaticBeta || Object.hasOwn(candidate, "adaptiveDifficulty")) {
    state.adaptiveDifficulty = sanitizeAdaptiveDifficultyState(candidate.adaptiveDifficulty);
  }
  const message = routeRankChangeMessage(previous, next);
  if (announce && message) {
    state.routeRankNotice = { message, rankUp: Boolean(previous && previous.rank.id !== next.rank.id) };
    if (els.resultDialog?.open && els.resultAdaptiveNote) {
      els.resultAdaptiveNote.hidden = false;
      els.resultAdaptiveNote.textContent = message;
      els.resultAdaptiveNote.classList.toggle("is-surge-perfect", state.routeRankNotice.rankUp);
    }
    if (state.routeRankNotice.rankUp && els.resultDialog?.open) gameAudio.queueProgression("rankPromotion", 120);
  }
  saveProfile({ cloud: false });
  return next;
}

function ensureLocalPromotion() {
  if (!isStaticBeta) return currentRouteRank();
  profile.routeProgression = sanitizeRemixProgressionState(profile.routeProgression);
  const started = startRemixPromotionTrial(profile.routeProgression);
  if (started.started) profile.routeProgression = started.state;
  profile.routeRank = localRouteRankSummary();
  if (started.started) saveProfile({ cloud: false });
  return profile.routeRank;
}

function nextStartStyleDecision() {
  const routeRank = currentRouteRank();
  const adaptive = sanitizeAdaptiveDifficultyState(routeRank?.adaptiveDifficulty || state.adaptiveDifficulty);
  return selectStartStyle({
    preference: "auto",
    rank: routeRank?.rank?.id || "bronze",
    challengeIndex: adaptive.completedChallenges,
    failureRecovery: adaptive.failureStreak > 0 || ["failed", "forfeit", "reveal"].includes(profile.lastRouteOutcome),
    promotion: routeRank?.promotion?.active === true,
    promotionAttempt: routeRank?.promotion?.attemptsCompleted || 0
  });
}

function startStyleSummary(decision = nextStartStyleDecision()) {
  if (decision.style === "shuffled") return "A new mix of useful words";
  return "Earth, Water, Fire, and Air";
}

function syncStartStylePreview() {
  const decision = nextStartStyleDecision();
  const preview = $("#primaryOrbitMeta");
  if (preview && primaryOrbitState().action !== "training") {
    preview.textContent = `${currentRouteRank().rank.name} · ${startStyleSummary(decision)}`;
  }
}

function recordLocalRouteRankOutcome(outcome, { flawless = false } = {}) {
  if (!isStaticBeta || !state.run?.id || !adaptiveRunEligible()) return null;
  const outcomeHash = stableHash(`route-outcome\0${state.run.id}`).toString(16).padStart(8, "0");
  profile.routeOutcomeHashes = sanitizeRouteOutcomeHashes(profile.routeOutcomeHashes);
  if (profile.routeOutcomeHashes.includes(outcomeHash)) return null;
  const assisted = Boolean(
    state.scoringDisabled
    || state.assist !== "none"
    || state.wished
    || state.powerups.giftUsed
  );
  const completed = outcome === "completed";
  const clean = completed && !assisted && state.runIq.misses === 0;
  const familyIds = (state.game?.remixes?.rules || []).map((rule) => rule.family).filter(Boolean);
  const event = {
    outcome,
    assisted,
    usedMajorPowerup: assisted,
    usedReveal: outcome === "reveal",
    revealed: assisted || outcome === "reveal",
    clean,
    flawless: clean && flawless,
    activeRemixes: familyIds.length
  };
  profile.routeProgression = sanitizeRemixProgressionState(profile.routeProgression);
  const promotionWasActive = Boolean(profile.routeProgression.promotionTrial);
  const progressionResult = promotionWasActive
    ? recordRemixPromotionTrialOutcome(profile.routeProgression, event)
    : recordRemixProgressionOutcome(profile.routeProgression, event);
  profile.routeProgression = progressionResult.state;
  const readinessResult = recordRemixReadinessOutcome(profile.remixReadiness, {
    outcomeId: state.run.id,
    outcome: outcome === "reveal" ? "reveal" : completed && !assisted ? "completed" : "failed",
    rankId: state.game?.remixes?.rank?.id || profile.routeProgression.rankId,
    families: familyIds,
    clean,
    assisted
  });
  profile.remixReadiness = readinessResult.state;
  profile.routeOutcomeHashes = sanitizeRouteOutcomeHashes([...profile.routeOutcomeHashes, outcomeHash]);
  profile.lastRouteOutcome = completed && !assisted ? "completed" : outcome === "reveal" ? "reveal" : "failed";
  const previous = sanitizeRouteRankSummary(profile.routeRank);
  profile.routeRank = localRouteRankSummary();
  const message = progressionResult.message || routeRankChangeMessage(previous, profile.routeRank);
  if (message) state.routeRankNotice = {
    message,
    rankUp: progressionResult.promoted === true || previous?.rank?.id !== profile.routeRank.rank.id
  };
  saveProfile({ cloud: false });
  return { progressionResult, readinessResult, routeRank: profile.routeRank };
}

function adaptiveSeriesEligible(game = state.game) {
  return Boolean(
    (game?.adaptive === true || (game?.practiceReplay === true && game?.replayOf?.adaptive === true))
    && adaptiveModePolicy({ mode: game.mode }).eligible
  );
}

function adaptiveRunEligible(game = state.game) {
  return Boolean(adaptiveSeriesEligible(game) && game?.practiceReplay !== true);
}

function adaptiveRequestFor(mode, options = {}) {
  const fixedContext = Boolean(
    options.target
    || options.custom
    || options.fixed
    || options.shared
    || options.context
  );
  const policy = adaptiveModePolicy({ mode, fixed: fixedContext });
  if (!policy.eligible) return {};
  if (isStaticBeta) ensureLocalPromotion();
  const adaptive = sanitizeAdaptiveDifficultyState(state.adaptiveDifficulty);
  const publicRequest = {
    adaptive: true,
    adaptiveTarget: String(options.adaptiveTarget || ""),
    ...(options.avoidTarget || state.recoveryTarget
      ? { avoidTarget: String(options.avoidTarget || state.recoveryTarget).slice(0, 80) }
      : {}),
    startStyle: "auto"
  };
  if (!isStaticBeta) return publicRequest;
  return {
    ...publicRequest,
    adaptiveVersion: adaptive.version,
    adaptiveLevel: adaptive.level,
    failureStreak: adaptive.failureStreak,
    adaptiveCompletedChallenges: adaptive.completedChallenges,
    adaptiveMajorChallengePending: adaptive.majorChallengePending,
    adaptiveMajorChallengeBaseLevel: adaptive.majorChallengeBaseLevel,
    recentTargets: adaptive.recentTargets,
    routeProgression: sanitizeRemixProgressionState(profile.routeProgression),
    remixReadiness: sanitizeRemixReadinessState(profile.remixReadiness),
    lastRouteOutcome: profile.lastRouteOutcome
  };
}

function recordAdaptiveOutcome(outcome, { flawless = false } = {}) {
  if (state.adaptiveOutcomeRecorded || !adaptiveRunEligible()) return null;
  if (!isStaticBeta) {
    state.adaptiveOutcomeRecorded = true;
    return null;
  }
  const result = applyAdaptiveChallengeOutcome(state.adaptiveDifficulty, {
    mode: state.game.mode,
    outcome,
    flawless: outcome === "completed" && flawless === true,
    surge: Boolean(state.game.adaptiveSurge || state.game.surge),
    surgeBaseLevel: state.game.adaptiveSurgeBaseLevel
      ?? state.game.surgeBaseLevel
      ?? state.game.adaptiveLevel,
    baseLevel: state.game.adaptiveLevel,
    challengeLevel: state.game.challengeLevel
  });
  if (result.outcome === "ignored") return null;
  state.adaptiveDifficulty = result.state;
  state.adaptiveNotice = result;
  state.adaptiveOutcomeRecorded = true;
  saveAdaptiveDifficulty();
  recordLocalRouteRankOutcome(
    outcome === "abandoned" ? "forfeit" : outcome,
    { flawless }
  );
  return result;
}

function normalizeStoredProfile(stored) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return structuredClone(defaultProfile);
  const cosmeticOwnership = sanitizeCosmeticOwnership(stored.cosmeticOwnership);
    const cosmeticAccess = {
      supporter: Boolean(stored.premium) || cosmeticOwnership.supporter || isStaticBeta,
      founder: Boolean(stored.premium) || isStaticBeta,
      itemIds: cosmeticOwnership.items,
      collectionIds: cosmeticOwnership.collections,
      earnedIds: cosmeticOwnership.earned,
      progress: {
        wins: stored.wins,
        discoveries: stored.discovered,
        weekly: stored.weekly
      }
    };
    return {
      ...structuredClone(defaultProfile),
      ...stored,
      version: 8,
      [PROFILE_SAVE_META_KEY]: revisionMetadata(stored[PROFILE_SAVE_META_KEY]),
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
      cosmetics: sanitizeCosmeticLoadout(stored.cosmetics || { theme: stored.theme }, cosmeticAccess),
      cosmeticEffects: sanitizeCosmeticEffects(stored.cosmeticEffects),
      cosmeticOwnership,
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
      rewardedRunIds: sanitizeRewardedRunIds(stored.rewardedRunIds),
      routeProgression: sanitizeRemixProgressionState(stored.routeProgression),
      remixReadiness: sanitizeRemixReadinessState(stored.remixReadiness),
      routeOutcomeHashes: sanitizeRouteOutcomeHashes(stored.routeOutcomeHashes),
      routeRank: sanitizeRouteRankSummary(stored.routeRank),
      lastRouteOutcome: ["completed", "failed", "forfeit", "reveal"].includes(stored.lastRouteOutcome)
        ? stored.lastRouteOutcome
        : ""
    };
}

function loadProfile() {
  try {
    const storage = safeBrowserStorage();
    const legacyProfile = LEGACY_PROFILE_KEYS.map((key) => storage?.getItem(key)).find(Boolean);
    return normalizeStoredProfile(JSON.parse(storage?.getItem(PROFILE_KEY) || legacyProfile || "null"));
  } catch {
    return structuredClone(defaultProfile);
  }
}

function saveProfile({ cloud = true, fields = ["all"] } = {}) {
  const cloudGameplaySync = cloud && !isStaticBeta && config.cloudProfileEnabled === true;
  if (cloudGameplaySync) {
    profile.cloudPending = true;
    const pending = Array.isArray(profile.cloudPendingFields) ? profile.cloudPendingFields : [];
    profile.cloudPendingFields = [...new Set([...pending, ...fields])].slice(0, 8);
  }
  const saved = profilePersistence.save(profile, profileSaveBaseline);
  profile = saved.record;
  profileSaveBaseline = saved.baseline;
  renderProfile();
  if (cloudGameplaySync) scheduleCloudProfileSync();
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
    routeRank: currentRouteRank(),
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
  syncHomeMenuView({
    menu,
    trainingCompleted: training.completed,
    secondOrbitCompleted: bridge.completed,
    wins: profile.wins,
    routeRank: currentRouteRank(),
    startStyle: startStyleSummary(),
    dailyCompleted: profile.dailyCompleted,
    todayKey
  });
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
  if (!homeMenuState().adventuresReady) {
    showToast("Adventures unlock at Gold Route Rank after 10 completed games.");
    return;
  }
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
  if (!newlyCompleted || !step.routeCompleted) {
    setTimeout(() => playFeedback(newlyCompleted ? "collectionUnlock" : "mastery", { analytics: true, word: award.recipe.word, category: award.recipe.category }), 180);
  }
  return { ...award, newlyCompleted, notice };
}

function founderCosmeticsOwned() {
  return Boolean(profile.premium || profile.cosmeticOwnership?.supporter || isStaticBeta);
}

function sanitizeCosmeticOwnership(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const ids = (value) => [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))].slice(0, 256);
  return {
    supporter: Boolean(source.supporter),
    collections: ids(source.collections),
    items: ids(source.items),
    earned: ids(source.earned)
  };
}

function cosmeticOwnershipOptions() {
  const remote = sanitizeCosmeticOwnership(profile.cosmeticOwnership);
  const routeRank = currentRouteRank()?.rank;
  const localEarnedProgress = isStaticBeta
    ? {
        wins: profile.wins,
        discoveries: profile.discovered.filter((word) => !["earth", "water", "fire", "air"].includes(inventoryKey(word))),
        weekly: profile.weekly,
        routeRank
      }
    : { routeRank };
  return {
    supporter: founderCosmeticsOwned(),
    founder: founderCosmeticsOwned(),
    itemIds: remote.items,
    collectionIds: remote.collections,
    earnedIds: remote.earned,
    progress: localEarnedProgress
  };
}

function sanitizeCosmeticEffects(value) {
  return ["full", "reduced", "off"].includes(value) ? value : "full";
}

function legacyThemeForLoadout(loadout) {
  const uiFinish = cosmeticById(loadout?.uiFinish, "uiFinish");
  if (uiFinish?.collectionId?.endsWith(".aurora-archive")) return "aurora";
  if (uiFinish?.collectionId?.endsWith(".solar-foundry")) return "solar";
  return "void";
}

function applyCosmeticLoadout(candidate = profile.cosmetics, { preview = false } = {}) {
  const ownership = preview ? fullCosmeticPreviewOwnership : cosmeticOwnershipOptions();
  const loadout = preview
    ? migrateCosmeticLoadout(candidate)
    : sanitizeCosmeticLoadout(candidate || { theme: profile.theme }, ownership);
  if (!preview) {
    profile.cosmetics = loadout;
    profile.theme = legacyThemeForLoadout(loadout);
  }
  document.body.classList.remove(...cosmeticClassNames);
  document.body.classList.add(...cosmeticClasses(loadout, ownership));
  const collection = collectionForCosmeticLoadout(loadout);
  document.body.dataset.cosmeticCollection = collection?.slug || "custom";
  document.body.dataset.cosmeticEffects = sanitizeCosmeticEffects(profile.cosmeticEffects);
  document.body.dataset.theme = legacyThemeForLoadout(loadout);
  if (preview && loadout.soundTheme !== profile.cosmetics?.soundTheme) {
    gameAudio.setTheme(loadout.soundTheme, { preview: true });
  } else if (preview) {
    gameAudio.endPreview();
  } else {
    gameAudio.setTheme(loadout.soundTheme);
  }
  return loadout;
}

function applyVisibleCosmeticLoadout() {
  const previewLoadout = cosmeticsObservatoryHost?.getPreviewLoadout?.();
  return previewLoadout
    ? applyCosmeticLoadout(previewLoadout, { preview: true })
    : applyCosmeticLoadout();
}

function renderCosmeticLoadout() {
  const container = $("#cosmeticLoadout");
  if (!container) return;
  const collection = collectionForCosmeticLoadout(profile.cosmetics);
  container.textContent = collection ? `${collection.label} equipped` : "Custom collection equipped";
}

function sanitizeHintObjective(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 240);
}

function renderHintObjective() {
  const text = sanitizeHintObjective(state.powerups?.currentTip);
  const active = Boolean(text && state.game && state.run && !state.finished && !state.startingRun && !state.reveal.active && !state.reveal.pending);
  els.hintObjective.hidden = !active;
  els.hintObjectiveText.textContent = text;
}

function resetCombinationStory() {
  combinationStoryRevision += 1;
  combinationStoryView?.reset();
  els.combinationStory.hidden = true;
}

function prepareGoldenPairAnimations() {
  goldenPairRuntimePromise ||= import("./story/golden-fusions/golden-pair-runtime.mjs?v=5.0.0-beta.1")
    .then(({ createGoldenPairRuntime }) => createGoldenPairRuntime({
      board: els.board,
      reducedMotion: () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.dataset.cosmeticEffects === "reduced"
    }))
    .then((runtime) => (goldenPairRuntime = runtime))
    .catch((error) => {
      console.warn("Golden Pair animation could not load.", error);
      return null;
    });
  return goldenPairRuntimePromise;
}

function resetGoldenPairAnimations() {
  goldenPairRuntime?.cancel();
}

async function playGoldenPairAnimation(a, b, result) {
  if (document.body.dataset.cosmeticEffects === "off") return false;
  const generation = state.orbitGeneration;
  const runtime = await prepareGoldenPairAnimations();
  if (!runtime || generation !== state.orbitGeneration || !state.game || els.resultDialog.open) return false;
  return runtime.play({ a, b, result })?.played === true;
}

function renderCombinationStory(failedAttempt = null) {
  if (!state.game || (!state.history.length && !failedAttempt)) return resetCombinationStory();
  const revision = ++combinationStoryRevision;
  const orbitGeneration = state.orbitGeneration;
  combinationStoryPromise ||= import("./story/combination-story-runtime.mjs?v=5.0.0-beta.1")
    .then(({ createCombinationStoryRuntime }) => createCombinationStoryRuntime({ root: els.combinationStory }))
    .catch((error) => {
      console.warn("Combination story could not load.", error);
      return null;
    });
  void combinationStoryPromise.then((view) => {
    if (!view || revision !== combinationStoryRevision || orbitGeneration !== state.orbitGeneration || !state.game) return;
    combinationStoryView = view;
    view.render({ target: state.game.target, history: state.history, failedAttempt });
    els.combinationStory.hidden = false;
  });
}

function renderPowerups() {
  const activeRun = Boolean(state.game && state.run && !state.finished && !state.startingRun && !state.reveal.active && !state.reveal.pending && !state.busyPairs.size);
  const tipsUsed = clamp(Number(state.powerups?.tipsUsed) || 0, 0, QUICK_TIP_LIMIT);
  const tipsRemaining = QUICK_TIP_LIMIT - tipsUsed;
  const senseCount = sanitizeSenseWallet(profile.senseWallet).charges;
  const giftReady = !state.powerups.giftUsed && !state.powerups.giftUnavailable;
  const armedKind = activeArmedPowerup();
  els.senseButton.disabled = !activeRun;
  els.quickTipCount.textContent = `${tipsRemaining} left`;
  els.useQuickTip.disabled = !activeRun || state.powerups.busy || tipsRemaining <= 0;
  els.wordGiftState.textContent = state.powerups.giftUsed ? "Used" : state.powerups.giftUnavailable ? "Unavailable" : "1 left";
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
    ? `${state.mode === "explore" ? "Help is not needed in free play" : "This lesson includes its own hint"}`
    : `Open help; ${tipsRemaining} hint${tipsRemaining === 1 ? "" : "s"} left`);
  renderHintObjective();
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
  playFeedback("uiSelect");
}

function resetPowerupControlLabels() {
  els.useWordGift.querySelector("span").textContent = "Add word";
  const senseLabel = $("#useSense span");
  if (senseLabel) senseLabel.textContent = "Use extra hint";
}

let profileRankSurface;

async function prepareProfileRankSurface() {
  try {
    profileRankSurface ||= await import("./profile-rank-surface.mjs?v=5.0.0-beta.1");
    profileRankSurface.mountProfileRankSurface();
  } catch {
    profileRankSurface = null;
  }
}

function showStardustStoreFailure(error, fallback) {
  const status = $("#stardustStoreStatus");
  if (status) {
    status.textContent = "Stardust supplies are temporarily unavailable.";
    status.classList.add("error");
  }
  showSecondarySurfaceFailure(error, fallback);
}

function renderStardustStore() {
  if (stardustStoreRuntime) {
    stardustStoreRuntime.render();
    return;
  }
  $("#buyStarCompass").disabled = true;
  $("#buyStreakShield").disabled = true;
}

function renderProfile() {
  setupWeeklyState();
  setupDailyState();
  setupJourneyState();
  const rank = rankFor();
  const routeRank = currentRouteRank();
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
  applyVisibleCosmeticLoadout();
  $(".profile-label").textContent = routeRank.rank.name;
  $("#profileButton").setAttribute("aria-label", `Open your ${routeRank.rank.name} Route Rank and progress`);
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
  $("#profileRankTitle").textContent = "Your progress";
  $("#profileTotalDust").textContent = profile.stardust;
  $("#profileWords").textContent = profile.discovered.length;
  $("#profileWins").textContent = profile.wins;
  $("#profileStreak").textContent = profile.dailyStreak;
  renderProfileRankView(routeRank);
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
    if (config.cloudProfileEnabled === true && !state.cloudReady && !state.cloudSyncing) {
      setCloudStatus(profile.playerId ? "Preparing cloud profile…" : "Connecting…");
    } else if (config.cloudProfileEnabled !== true) {
      setCloudStatus("Gameplay stays on this device");
    }
    const syncButton = $("#syncCloudProfile");
    syncButton.hidden = config.cloudProfileEnabled !== true;
    syncButton.disabled = config.cloudProfileEnabled !== true || !profile.playerId || state.cloudSyncing;
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
  els.senseHudCount.textContent = `${tipsRemaining}`;
  $("#senseEarnNote").textContent = "One charge returns each UTC day for every player.";
  els.senseButton.setAttribute("aria-label", `Open help; ${tipsRemaining} hint${tipsRemaining === 1 ? "" : "s"} left`);
  renderStardustStore();
  renderPowerups();
  feedbackPreferencesUi.render();
  els.rivalGhost.setAttribute("aria-pressed", String(profile.rivalGhostEnabled));
  els.rivalGhost.setAttribute("aria-label", profile.rivalGhostEnabled ? "Hide Rival Ghost pace" : "Show Rival Ghost pace");
  $("#marketBalance").textContent = profile.credits;
  $("#vaultCount").textContent = profile.vault.length;
  renderCosmeticLoadout();
  renderMastery();
  syncProgressiveDisclosure();
  syncStartStylePreview();
  syncRankBoardArt();
  updateWishButton();
  syncScrambleEntryState();
}

function syncScrambleEntryState() {
  const available = duelFeatureAvailable();
  const ranked = scrambleRankedUnlocked();
  const homeButton = $("#scrambleHomeButton");
  const menuButton = $("#scrambleMenuButton");
  if (homeButton) homeButton.disabled = !available;
  if (menuButton) menuButton.disabled = !available;
  const status = !available
    ? "Live 1v1 is unavailable in this build"
    : ranked
      ? "Private invites and public ranked matchmaking"
      : "Private invites \u00b7 ranked unlocks after one scored solo win";
  if ($("#scrambleHomeStatus")) $("#scrambleHomeStatus").textContent = status;
  if ($("#scrambleMenuStatus")) $("#scrambleMenuStatus").textContent = status;
  scrambleRuntime?.setRankedUnlocked(ranked);
}

function duelFeatureAvailable() {
  return Boolean(DUEL_API_BASE) && config.duels?.enabled !== false;
}

function scrambleRankedUnlocked() {
  return profile.wins > 0 && config.duels?.publicMatchmakingEnabled !== false;
}

function applyServerPlayer(player) {
  if (!player) return false;
  if (profile.playerId && player.id && profile.playerId !== player.id) return false;
  const serverCosmeticOwnership = sanitizeCosmeticOwnership(player.cosmeticOwnership);
  const supporterActive = Boolean(player.founderPass || player.supporter || serverCosmeticOwnership.supporter);
  const founderActivated = supporterActive && !profile.premium;
  profile.playerId = player.id || profile.playerId;
  profile.callsign = player.callsign || profile.callsign;
  profile.credits = Number(player.credits) || 0;
  profile.vault = Array.isArray(player.vault) ? player.vault : [];
  profile.premium = supporterActive;
  profile.cosmeticOwnership = serverCosmeticOwnership;
  profile.freeWishUsed = Boolean(player.freeWishUsed);
  profile.wishAvailable = player.wishAvailable !== false;
  profile.dailyWishUsedDate = player.dailyWishUsedDate || "";
  if (Number.isInteger(player.cloudProfileVersion)) profile.cloudProfileVersion = Math.max(0, player.cloudProfileVersion);
  if (player.routeRank) profile.routeRank = sanitizeRouteRankSummary(player.routeRank);
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

function configuredDuelApiBase(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, location.href);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHttp && url.origin !== location.origin) return "";
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function sanitizeDuelIdentity(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const playerId = String(source.playerId || source.id || "").trim().slice(0, 96);
  // Signed cs3 session tokens currently exceed 256 characters. Keep a finite
  // ceiling without truncating a valid credential into an inevitable 401.
  const playerToken = String(source.playerToken || source.token || "").trim().slice(0, 1_024);
  const callsign = String(source.callsign || source.player?.callsign || "").trim().slice(0, 32);
  if (!/^[a-z0-9][a-z0-9._~-]{5,95}$/i.test(playerId) || playerToken.length < 8) return null;
  return { playerId, playerToken, callsign: callsign || "STARGAZER" };
}

function readDuelIdentity() {
  try {
    return sanitizeDuelIdentity(JSON.parse(localStorage.getItem(DUEL_IDENTITY_KEY) || "null"));
  } catch {
    return null;
  }
}

function saveDuelIdentity(identity) {
  duelIdentity = sanitizeDuelIdentity(identity);
  try {
    if (duelIdentity) localStorage.setItem(DUEL_IDENTITY_KEY, JSON.stringify(duelIdentity));
    else localStorage.removeItem(DUEL_IDENTITY_KEY);
  } catch { /* The live identity remains available for this tab. */ }
  return duelIdentity;
}

function duelPlayerUrl(suffix = "") {
  const url = new URL(DUEL_API_BASE);
  url.pathname = `${url.pathname.replace(/\/duels\/?$/, "")}/player${suffix}`.replace(/\/{2,}/g, "/");
  return url.href;
}

async function parseDuelResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "The live constellation did not answer.");
    error.code = result.code || "duel_request_error";
    error.status = response.status;
    error.payload = result;
    throw error;
  }
  return result;
}

async function ensureDuelIdentity({ forceRegistration = false } = {}) {
  if (!DUEL_API_BASE) {
    const error = new Error("Live 1v1 is not configured in this build.");
    error.code = "online_required";
    throw error;
  }
  if (duelIdentityPromise) return duelIdentityPromise;
  duelIdentityPromise = (async () => {
    // The hosted runtime and Duel API share an account service. Coalesce with
    // the normal boot registration so an immediate lobby click cannot create
    // two competing anonymous identities. Hybrid static builds deliberately
    // keep their local solo identity separate from the hosted Duel identity.
    if (!isStaticBeta && (!profile.playerId || !profile.playerToken || playerIdentityPromise)) {
      await ensurePlayer();
    }
    const profileIdentity = sanitizeDuelIdentity({
      playerId: profile.playerId,
      playerToken: profile.playerToken,
      callsign: profile.callsign
    });
    const candidate = forceRegistration ? null : duelIdentity || profileIdentity;
    if (candidate) {
      try {
        const response = await fetch(duelPlayerUrl(), {
          headers: {
            "X-Constellore-Player": candidate.playerId,
            "X-Constellore-Token": candidate.playerToken
          }
        });
        if (response.ok) {
          const result = await response.json().catch(() => ({}));
          return saveDuelIdentity({
            ...candidate,
            callsign: result.player?.callsign || candidate.callsign
          });
        }
        if (![401, 404].includes(response.status)) await parseDuelResponse(response);
      } catch (error) {
        if (![401, 404].includes(error.status)) throw error;
      }
    }
    const registration = await parseDuelResponse(await fetch(duelPlayerUrl("/register"), { method: "POST" }));
    const identity = saveDuelIdentity({
      playerId: registration.player?.id,
      playerToken: registration.playerToken,
      callsign: registration.player?.callsign
    });
    if (!identity) throw new Error("The live player identity was incomplete.");
    return identity;
  })().finally(() => {
    duelIdentityPromise = null;
  });
  return duelIdentityPromise;
}

async function requestDuelApi(suffix, options = {}, retryAuth = true) {
  const route = String(suffix || "");
  if (!route.startsWith("/") || route.startsWith("//") || /(?:^|\/)\.\.(?:\/|$)/.test(route)) {
    throw new Error("Invalid live match route.");
  }
  const identity = await ensureDuelIdentity();
  const controller = new AbortController();
  const upstreamSignal = options.signal;
  const abortFromUpstream = () => controller.abort();
  if (upstreamSignal?.aborted) controller.abort();
  else upstreamSignal?.addEventListener?.("abort", abortFromUpstream, { once: true });
  const timer = options.stream ? null : setTimeout(() => controller.abort(), 20_000);
  const headers = {
    ...(options.body != null ? { "Content-Type": "application/json" } : {}),
    ...(options.stream ? { Accept: "text/event-stream" } : {}),
    ...(options.headers || {}),
    "X-Constellore-Player": identity.playerId,
    "X-Constellore-Token": identity.playerToken
  };
  try {
    const response = await fetch(`${DUEL_API_BASE}${route}`, {
      method: options.method || "GET",
      headers,
      body: options.body == null ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });
    if (response.status === 401 && retryAuth) {
      saveDuelIdentity(null);
      await ensureDuelIdentity({ forceRegistration: true });
      return requestDuelApi(route, options, false);
    }
    if (!response.ok) return parseDuelResponse(response);
    if (options.stream) return response;
    return response.json().catch(() => ({}));
  } catch (error) {
    if (error.name === "AbortError") {
      const aborted = new DOMException("Live match request aborted.", "AbortError");
      throw aborted;
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    upstreamSignal?.removeEventListener?.("abort", abortFromUpstream);
  }
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
  if (playerIdentityPromise) return playerIdentityPromise;
  playerIdentityPromise = ensurePlayerNow().finally(() => {
    playerIdentityPromise = null;
  });
  return playerIdentityPromise;
}

async function ensurePlayerNow() {
  const anonymous = !profile.playerId && !profile.playerToken;
  if (!state.recoveryKit && profile.playerId) state.recoveryKit = restorePendingRecoveryKit(profile.playerId);
  if (profile.playerId && profile.playerToken) {
    try {
      const { player } = await fetchJson("/api/player", { headers: authHeaders() });
      applyServerPlayer(player);
      return player;
    } catch (error) {
      if (![401, 404].includes(error.status)) throw error;
    }
  }
  const registration = await fetchJson("/api/player/register", { method: "POST" });
  resetProfileForAccount({
    playerId: registration.player.id,
    playerToken: registration.playerToken,
    preserveFirstOrbit: anonymous,
    preserveLocalProgress: anonymous
  });
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
  const cosmetics = sanitizeCosmeticLoadout(profile.cosmetics || { theme: profile.theme }, cosmeticOwnershipOptions());
  const safeDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
  return {
    theme: legacyThemeForLoadout(cosmetics),
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

function resetProfileForAccount(options={}) { profile=resetAccountProfile(defaultProfile, profile, options); }

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
    profile.cosmetics = sanitizeCosmeticLoadout(remote.cosmetics || { theme: remote.theme }, cosmeticOwnershipOptions());
    profile.theme = legacyThemeForLoadout(profile.cosmetics);
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
  if (isStaticBeta || config.cloudProfileEnabled !== true || !profile.playerId || !profile.playerToken) {
    if (manual) showToast("Gameplay progress stays on this device. Cloud profile saving is off.");
    return null;
  }
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
      if (syncButton) {
        syncButton.hidden = config.cloudProfileEnabled !== true;
        syncButton.disabled = config.cloudProfileEnabled !== true || !profile.playerId;
      }
      if (!failed && state.cloudDirty && state.cloudReady) {
        clearTimeout(cloudSyncTimer);
        cloudSyncTimer = setTimeout(() => { void syncCloudProfile(); }, 250);
      }
    }
  }
  return null;
}

function scheduleCloudProfileSync({ changed = true, delay = 1800 } = {}) {
  if (isStaticBeta || config.cloudProfileEnabled !== true || !profile.playerId || !profile.playerToken) return;
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
  const synced = config.cloudProfileEnabled === true ? await syncCloudProfile() : null;
  state.cloudReady = true;
  if (synced) setCloudStatus("Cloud profile ready");
  else if (config.cloudProfileEnabled !== true) {
    profile.cloudPending = false;
    profile.cloudPendingFields = [];
    saveProfile({ cloud: false });
    setCloudStatus("Gameplay progress stays on this device");
  }
  if (synced && state.cloudDirty) scheduleCloudProfileSync({ changed: false, delay: 250 });
}

function handleOnline() {
  updateConnection();
  if (isStaticBeta) void expectedPairDelivery.flush();
  if (!isStaticBeta && profile.playerId && profile.playerToken) void refreshCosmicEventState();
  if (!isStaticBeta && config.cloudProfileEnabled === true && state.cloudReady && profile.playerId && profile.playerToken) {
    scheduleCloudProfileSync({ changed: false, delay: 250 });
  }
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
    state.runPersistence = null;
    clearActiveRunSnapshot();
    applyServerPlayer(result.player);
    rememberPendingRecoveryKit({ playerId: result.player.id, code: result.recoveryCode, version: result.recoveryVersion });
    await restoreOwnership({ silent: true });
    if (config.cloudProfileEnabled === true) await syncCloudProfile({ replaceRemote: true });
    // Cloud restoration may contain an older event snapshot. Apply server event
    // truth last so account recovery cannot roll progress or reward state back.
    await refreshCosmicEventState();
    const dailySense = refillDailySense();
    if (dailySense.refilled) saveProfile({ cloud: false });
    state.cloudReady = true;
    if (config.cloudProfileEnabled === true && state.cloudDirty) {
      scheduleCloudProfileSync({ changed: false, delay: 250 });
    }
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
  renderProfile();
}

async function fetchJson(url, options = {}, timeout = 20000) {
  if (isStaticBeta) {
    localRuntimePromise ||= import("./local-beta.mjs?v=5.0.0-beta.1");
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

function primeFeedbackAudio() {
  return gameAudio.prime();
}

function playFeedback(cue, { analytics = false, soundTheme = profile.cosmetics?.soundTheme, ...options } = {}) {
  const played = gameAudio.playFeedback(cue, { ...options, soundTheme });
  if (analytics && (played.audio || played.haptic)) {
    const kind = ({ reject: "rejection", twist: "twist", target: "target", mastery: "discovery", collectionUnlock: "discovery", place: "ui", uiSelect: "ui", sense: "ui", ghostPass: "ui" })[cue] || "fusion";
    track("fusion_feedback_played", { kind });
  }
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
    ? '<i aria-hidden="true">◇</i> PRACTICE'
    : '<i aria-hidden="true">&#10022;</i> LEARN TO PLAY';
  $("#skipFirstOrbit").textContent = second ? "Leave" : "Exit";
  $("#firstOrbitStep").textContent = `${progress.index + 1} of ${progress.total}`;
  $("#firstOrbitGuideTitle").textContent = step.title;
  $("#firstOrbitInstruction").textContent = step.instruction;
  $("#firstOrbitTip").textContent = step.tip;
  $("#firstOrbitProgressBar").style.width = `${progress.percent}%`;
  const progressBar = els.firstOrbitGuide.querySelector("[role='progressbar']");
  progressBar.setAttribute("aria-label", "Lesson progress");
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

async function startFirstOrbit({ enterThroughGate = true } = {}) {
  if (state.startingRun) return;
  state.startingRun = true;
  rememberFirstOrbitSeen();
  if (els.profileDialog.open) els.profileDialog.close();
  closeHubMenu();
  const startedAt = new Date().toISOString();
  track("first_orbit_started", { replay: Boolean(profile.firstOrbit.completed) });
  try {
    await startWithGame(createFirstOrbitGame(selectUniverse(101)), {
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
    }, { enterThroughGate });
    syncFirstOrbitGuide();
    if (!enterThroughGate) {
      requestAnimationFrame(() => {
        els.wordList.querySelector(".inventory-word.tutorial-hot")?.focus({ preventScroll: true });
      });
    }
  } finally {
    state.startingRun = false;
  }
}

async function startSecondOrbit({ enterThroughGate = true } = {}) {
  if (state.startingRun || (!profile.firstOrbit.completed && profile.wins === 0)) return;
  state.startingRun = true;
  profile.secondOrbit = { ...sanitizeSecondOrbitState(profile.secondOrbit), seen: true };
  saveProfile({ cloud: false });
  if (els.profileDialog.open) els.profileDialog.close();
  closeHubMenu();
  track("second_orbit_started", { replay: Boolean(profile.secondOrbit.completed) });
  try {
    await startWithGame(createSecondOrbitGame(selectUniverse(202)), null, { enterThroughGate });
    syncFirstOrbitGuide();
  } finally {
    state.startingRun = false;
  }
}

async function startExplore({ enterThroughGate = true } = {}) {
  if (state.startingRun) return;
  state.startingRun = true;
  const game = exploreGame(Math.floor(Math.random() * 1_000_000));
  game.universe = selectUniverse(game.seed);
  track("explore_started", { discoveries: profile.discovered.length });
  try {
    await startWithGame(game, null, { enterThroughGate });
  } finally {
    state.startingRun = false;
  }
}

function skipFirstOrbit() {
  if (secondOrbitActive()) {
    returnHome();
    showToast("Second Orbit paused · replay it anytime from Menu → Settings.");
    return;
  }
  if (!firstOrbitActive()) return;
  rememberFirstOrbitSeen();
  returnHome();
  showToast("Your first game is still waiting · it will open again next time.");
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

function renderMissionRemixes(game) {
  const panel = $("#missionRemixSummary");
  const remixes = game?.remixes;
  const rules = Array.isArray(remixes?.rules) ? remixes.rules : [];
  panel.hidden = !remixes || rules.length === 0;
  if (!remixes || rules.length === 0) {
    $("#missionRemixRules").replaceChildren();
    return;
  }
  const rank = remixes.rank || getRemixRankPresentation({
    completedChallenges: remixes.completedChallenges
  });
  $("#missionRemixRank").textContent = `${rank.name || "Gold"} challenge`;
  $("#missionRemixCount").textContent = `${rules.length} extra rule${rules.length === 1 ? "" : "s"}`;
  $("#missionRemixRules").replaceChildren(...rules.map((rule) => {
    const item = document.createElement("li");
    item.textContent = rule.instruction;
    return item;
  }));
}

function openMissionBriefing(game, request, trigger = null, context = null) {
  const briefing = buildMissionBriefing(game, { localOnly: isStaticBeta });
  const journeyContext = normalizeJourneyContext(context, game);
  const journeyKindLabel = journeyContext?.kind === "event" ? "Event" : journeyContext?.kind === "voyage" ? "Story" : "";
  const journeyClue = journeyContext?.kind === "event"
    ? "This target is part of this week’s event."
    : journeyContext?.kind === "voyage"
      ? "This target is part of your story."
      : "";
  state.pendingMission = {
    game,
    runId: state.run?.id || "",
    request: { ...request },
    trigger,
    context: journeyContext,
    postLoad: true
  };
  $("#missionBriefingMode").textContent = journeyKindLabel || briefing.modeLabel;
  $("#missionBriefingEmoji").textContent = briefing.emoji;
  $("#missionBriefingTarget").textContent = briefing.target;
  $("#missionBriefingClue").textContent = journeyClue || game.clue || "Combine two words to make a new word.";
  $("#missionBriefingRule").textContent = briefing.instruction;
  $("#missionBriefingStart").textContent = briefing.startValue;
  $("#missionBriefingStarters").textContent = briefing.startDetail;
  $("#missionBriefingLimit").textContent = briefing.limitValue;
  $("#missionBriefingLimitDetail").textContent = briefing.limitDetail;
  $("#missionBriefingReward").textContent = briefing.rewardValue;
  $("#missionBriefingRewardDetail").textContent = briefing.rewardDetail;
  $("#missionBriefingScoreLabel").textContent = briefing.scoringLabel;
  $("#missionBriefingScore").textContent = briefing.scoringValue;
  $("#missionBriefingScoreDetail").textContent = briefing.scoringDetail;
  const division = $("#missionBriefingDivision");
  division.className = `mission-division simple-hidden ${briefing.division.id}`;
  $("#missionBriefingDivisionLabel").textContent = briefing.division.label;
  $("#missionBriefingDivisionTitle").textContent = briefing.division.title;
  $("#missionBriefingDivisionDetail").textContent = briefing.division.detail;
  $("#missionBriefingLimitSummary").textContent = briefing.limitValue;
  const missionIqRule = $("#missionBriefingIqRule");
  missionIqRule.hidden = !runIqApplies(briefing.mode, briefing.target, {
    scoreEligible: game.scoreEligible !== false
  });
  const difficultChallenge = game.difficultyTag === "Difficult";
  const pathGuardActive = pathGuardActiveFor(game, state.run);
  els.missionAdaptiveNote.hidden = !difficultChallenge && !pathGuardActive;
  els.missionAdaptiveNote.classList.toggle("is-difficult", difficultChallenge);
  els.missionAdaptiveNote.classList.toggle("path-guard-note", pathGuardActive);
  els.missionAdaptiveNote.textContent = [
    difficultChallenge ? "Difficult" : "",
    pathGuardActive ? "Path Guard on" : ""
  ].filter(Boolean).join(" · ");
  els.missionAdaptiveNote.setAttribute(
    "aria-label",
    [
      difficultChallenge ? "This is a difficult challenge." : "",
      pathGuardActive ? "Path Guard locks route-diverging pairings without using a move." : ""
    ].filter(Boolean).join(" ")
  );
  els.missionAdaptiveNote.title = pathGuardActive
    ? "Route-diverging pairings are locked without using a move."
    : difficultChallenge ? "This is a difficult challenge." : "";
  renderMissionRemixes(game);
  $("#missionBriefingInteraction").textContent = briefing.interactionRule;
  $("#missionBriefingModeRule").textContent = briefing.modeRule;
  $("#missionBriefingFairness").textContent = briefing.fairnessNote;
  $("#missionJourneyContext").hidden = !journeyContext;
  $("#missionJourneyType").textContent = journeyContext?.kind === "event" ? "Event" : "Story";
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
  $("#beginMission span").textContent = "Start";
  els.missionBriefingDialog.scrollTop = 0;
  $("#missionBriefingScroll").scrollTop = 0;
  presentMissionBriefing();
}

function cancelMissionBriefing() {
  if (state.startingRun || !state.pendingMission) return;
  requestAnimationFrame(() => $("#beginMission").focus({ preventScroll: true }));
}

async function createRun(request) {
  if (!profile.playerId || !profile.playerToken) await ensurePlayer();
  return fetchJson("/api/run/start", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(request)
  });
}

async function activateTimedRun(run) {
  if (!run?.activationPending) return run;
  let failure = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const activated = await fetchJson("/api/run/activate", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ runId: run.id, runToken: run.token })
      });
      applyServerPlayer(activated.player);
      return activated.run;
    } catch (error) {
      failure = error;
      if (attempt === 0) await wait(150);
    }
  }
  throw failure || new Error("This orbit could not begin.");
}

async function confirmMissionBriefing() {
  const pending = state.pendingMission;
  if (!pending || state.startingRun) return;
  const begin = $("#beginMission");
  const status = $("#missionBriefingStatus");
  state.startingRun = true;
  begin.disabled = true;
  begin.querySelector("span").textContent = "Starting…";
  status.classList.remove("error");
  status.textContent = "";
  let recoverToHome = false;
  try {
    if (state.game !== pending.game || (pending.runId && state.run?.id !== pending.runId)) {
      throw new Error("This game is no longer active.");
    }
    if (state.run?.activationPending) state.run = await activateTimedRun(state.run);
    const clock = activatedRunClock(state.run, state.game);
    state.startedAt = clock.startedAt;
    state.remainingSeconds = clock.remainingSeconds;
    state.pendingMission = null;
    if (els.missionBriefingDialog.open) els.missionBriefingDialog.close("start");
    playFeedback("runStart");
    updateHud();
    scheduleRunSave();
    if (competitiveGhostEligible()) void startRivalGhost();
    if (state.game.timeLimit && !state.finished) startTimer();
    track("run_started", { mode: state.game.mode, target: state.game.target, stage: state.game.stage ?? null, aiEnabled: state.game.aiEnabled });
    requestAnimationFrame(() => els.wordList.querySelector(".inventory-word.tutorial-hot, .inventory-word")?.focus({ preventScroll: true }));
  } catch (error) {
    if (isPermanentActivationFailure(error)) {
      recoverToHome = true;
      state.pendingMission = null;
      clearActiveRunSnapshot();
      status.classList.add("error");
      status.textContent = "That game is no longer available.";
    } else {
      status.classList.add("error");
      status.textContent = error.message || "This game could not start. Try again.";
      begin.disabled = false;
      begin.querySelector("span").textContent = "Try again";
    }
  } finally {
    state.startingRun = false;
    if (recoverToHome) {
      returnHome({ skipForfeit: true });
      showToast("That game expired. Choose Play to start a fresh one.", { scope: "global" });
    } else if (state.game) {
      updateHud();
      updateBoardTools();
    }
  }
}

async function beginMode(mode, options = {}) {
  if (state.startingRun) return;
  const menu = homeMenuState();
  if (mode === "daily" && !menu.dailyReady) {
    showToast("Today’s Word unlocks after your first scored Bronze win.", { scope: "global" });
    return;
  }
  if (["quick", "moves"].includes(mode) && currentRouteRank().rank.number < 3) {
    showToast("Timed and limited-move games unlock at Gold.");
    return;
  }
  if (mode === "explore" && !menu.exploreReady) {
    showToast("Free play unlocks at Silver Route Rank after three completed games.");
    return;
  }
  if (mode === "weekly" && !menu.adventuresReady) {
    showToast("Adventures unlock at Gold Route Rank after 10 completed games.");
    return;
  }
  if (mode === "second-orbit") {
    await startSecondOrbit({ enterThroughGate: true });
    return;
  }
  if (mode === "explore") {
    await startExplore({ enterThroughGate: true });
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
  if (label) label.textContent = "Loading…";
  try {
    if (state.forfeitPromise) await state.forfeitPromise;
    await enterPreparedMission(() => ({
      mode,
      seed: options.seed ?? (mode === "daily" ? Math.floor(Date.now() / 86_400_000) : mode === "weekly" ? currentWeekSeed() : Math.floor(Math.random() * 1_000_000)),
      target: options.target || "",
      stage: mode === "weekly" ? profile.weekly.stage : undefined,
      ...adaptiveRequestFor(mode, options)
    }), { context: options.context, trigger });
    state.recoveryTarget = "";
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
  if (!homeMenuState().exploreReady) {
    showToast("Custom targets unlock with Free play at Silver Route Rank.");
    return;
  }
  const input = $("#customTarget");
  const target = input.value.trim();
  if (!target) return;
  const submit = event.currentTarget.querySelector("button");
  state.startingRun = true;
  submit.disabled = true;
  els.targetMessage.textContent = "Opening your game…";
  try {
    await enterPreparedMission(async () => {
      const game = await fetchJson("/api/custom-target", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target })
      }, 45000);
      return { mode: "reach", seed: game.seed, target: game.target, custom: true };
    }, { trigger: submit });
    els.targetMessage.textContent = "";
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

function activeRunPersistence() {
  if (state.run?.id && state.run?.token) return state.run;
  if (!state.game || !CLIENT_ONLY_RESUME_MODES.has(state.mode)) return null;
  state.runPersistence ||= createClientRunPersistence({
    game: state.game,
    mode: state.mode,
    startedAt: state.startedAt
  });
  return state.runPersistence;
}

function buildActiveRunSnapshot({ completed = false } = {}) {
  const persistenceRun = activeRunPersistence();
  if (!state.game || state.mode === "scramble" || !persistenceRun || (state.finished && !completed) || state.reveal.active || state.reveal.pending) return null;
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
      id: persistenceRun.id,
      token: persistenceRun.token,
      startedAt: persistenceRun.startedAt,
      deadlineAt: persistenceRun.deadlineAt,
      activationPending: Boolean(persistenceRun.activationPending),
      assist: state.assist,
      scoreEligible: persistenceRun.scoreEligible !== false && !state.scoringDisabled,
      scoreMultiplier: state.scoreMultiplier,
      ranked: Boolean(persistenceRun.ranked),
      localOnly: Boolean(persistenceRun.localOnly),
      clientOnly: CLIENT_ONLY_RESUME_MODES.has(state.mode),
      hasRuntimeRun: Boolean(state.run?.id && state.run?.token)
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
      currentTip: sanitizeHintObjective(state.powerups.currentTip),
      giftUsed: Boolean(state.powerups.giftUsed),
      giftUnavailable: Boolean(state.powerups.giftUnavailable),
      giftItem: snapshotItem(state.powerups.giftItem),
      assist: state.assist,
      scoringDisabled: state.scoringDisabled,
      scoreMultiplier: state.scoreMultiplier,
      pathGuardBlockedPairs: [...state.pathGuard.blockedPairs].slice(-MAX_PATH_GUARD_PAIRS),
      runIq: sanitizeRunIqState(state.runIq)
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
  if (!snapshot || snapshot.run.clientOnly === true || snapshot.run.ranked !== true) {
    return { activeSaved: false, pendingSaved: false };
  }
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
  if (!state.game || state.mode === "scramble" || !activeRunPersistence() || state.finished || state.reveal.active || state.reveal.pending) return;
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
  if (
    isStaticBeta
    || snapshot?.run?.clientOnly === true
    || snapshot?.run?.ranked !== true
    || !profile.playerId
    || !snapshot?.run?.id
    || !snapshot?.run?.token
  ) return false;
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
    if (!activeRunSnapshotIsValid(snapshot)) {
      if (snapshot) clearActiveRunSnapshot();
      return null;
    }
    return snapshot;
  } catch {
    clearActiveRunSnapshot();
    return null;
  }
}

async function enterPreparedMission(prepare, { context = null, trigger = null } = {}) {
  return enterPreparedRun({
    gate: cosmicGate,
    prepare,
    create: createRun,
    commit: (started) => {
      applyServerPlayer(started.player);
      startWithGameNow(started.game, started.run, { context, deferTimer: true });
    },
    ready: (started, request) => openMissionBriefing(started.game, request, trigger, context)
  });
}

function decorateRestoredHistory(rawHistory, extraKnownWords = []) {
  const event = currentEventState().event;
  const knownInRun = new Set([
    ...(state.game?.starters || []),
    ...(Array.isArray(extraKnownWords) ? extraKnownWords : [])
  ].map((value) => inventoryKey(value?.word || value)).filter(Boolean));
  return (Array.isArray(rawHistory) ? rawHistory.slice(-500) : []).map((rawStep, index) => {
    const step = rawStep && typeof rawStep === "object" && !Array.isArray(rawStep) ? rawStep : {};
    const a = String(step.a || "").trim().slice(0, 80);
    const b = String(step.b || "").trim().slice(0, 80);
    const word = String(step.word || "").trim().slice(0, 80);
    if (!a || !b || !word) return null;
    const wordKey = inventoryKey(word);
    const runIqNewToRun = typeof step.runIqNewToRun === "boolean"
      ? step.runIqNewToRun
      : !knownInRun.has(wordKey);
    knownInRun.add(wordKey);
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
      rarity: twisted ? 90 : eventAnnotation.context?.collectionMatch ? 55 : 0,
      runIqKey: String(step.runIqKey || "").trim().slice(0, 180),
      runIqNewToRun,
      runIqRelevance: ["route", "target", "discovery", "known", "ignored"].includes(step.runIqRelevance) ? step.runIqRelevance : "",
      routeTotal: clamp(Number(step.routeTotal) || 0, 0, 100),
      routeStepsAdvanced: clamp(Number(step.routeStepsAdvanced) || 0, 0, 100),
      routeCompleted: Boolean(step.routeCompleted)
    };
  }).filter(Boolean);
}

function reconcileRestoredMastery(history) {
  let mastery = profile.recipeMastery;
  let awarded = false;
  for (const step of Array.isArray(history) ? history : []) {
    const result = recordRecipeDiscovery(mastery, {
      ...step,
      runId: state.runPersistence?.id || state.run?.id || sessionId,
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
  const starterItems = new Map((payload.game.starterItems || []).map((item) => [inventoryKey(item), item]));
  for (const starter of payload.game.starters || []) {
    const key = inventoryKey(starter);
    const item = starterItems.get(key);
    if (!byWord.has(key)) byWord.set(key, {
      word: starter,
      emoji: item?.emoji || starterEmoji[starter] || "✦",
      category: item?.category || starterCategory[starter] || null,
      source: item?.source || (starterEmoji[starter] ? "origin" : "loaned-start")
    });
  }
  state.words = [...byWord.values()];
  state.history = decorateRestoredHistory(progress.history, [progress.bendItem, progress.giftItem]);
  state.newDiscoveries = state.history.reduce((total, step) => total + (step.newDiscovery ? 1 : 0), 0);
  reconcileRestoredMastery(state.history);
  state.moves = Math.max(0, Number(progress.moves) || 0);
  state.wished = Boolean(progress.usedBend || progress.usedWish || progress.wished);
  state.bendItem = snapshotItem(progress.bendItem);
  state.assist = payload.run?.assist || progress.assist || "none";
  const persistenceRun = state.runPersistence || state.run || payload.run;
  const snapshotMatchesRun = Boolean(
    snapshot?.run?.id
    && persistenceRun?.id
    && snapshot.run.id === persistenceRun.id
  );
  const matchingSnapshot = snapshotMatchesRun ? snapshot.progress || {} : {};
  state.pathGuard.active = pathGuardActiveFor(payload.game, state.run);
  state.pathGuard.rankId = String(payload.game?.remixes?.rank?.id || "");
  state.pathGuard.blockedPairs = state.pathGuard.active
    ? sanitizeRememberedPathGuardPairs(matchingSnapshot.pathGuardBlockedPairs)
    : new Set();
  const authoritativeHistoryKeys = state.history.map((step) => `${inventoryKey(step.a)}+${inventoryKey(step.b)}=>${inventoryKey(step.word)}`);
  const snapshotHistoryKeys = (Array.isArray(matchingSnapshot.history) ? matchingSnapshot.history : [])
    .map((step) => `${inventoryKey(step?.a)}+${inventoryKey(step?.b)}=>${inventoryKey(step?.word)}`);
  const snapshotMatchesHistory = authoritativeHistoryKeys.length === snapshotHistoryKeys.length
    && authoritativeHistoryKeys.every((key, index) => key === snapshotHistoryKeys[index]);
  const restoredRunIq = progress.runIq || (snapshotMatchesHistory ? matchingSnapshot.runIq : null);
  state.runIq = restoredRunIq
    ? sanitizeRunIqState(restoredRunIq)
    : state.history.reduce(
      (score, step) => step.runIqRelevance === "ignored"
        ? score
        : rewardRunIq(score, step.runIqKey || `${runIqPairKey(step.a, step.b)}=>${inventoryKey(step.word)}`, {
        relevance: step.runIqRelevance || (step.routeCompleted ? "target" : step.routeStepsAdvanced ? "route" : step.runIqNewToRun ? "discovery" : "known"),
        routeAdvanced: step.routeStepsAdvanced > 0,
        routeTotal: step.routeTotal || state.game?.routeLength,
        stepsAdvanced: step.routeStepsAdvanced,
        completed: step.routeCompleted,
        newDiscovery: step.runIqNewToRun
      }),
      createRunIqState()
    );
  state.powerups.tipsUsed = clamp(Number(progress.tipsUsed ?? matchingSnapshot.tipsUsed) || 0, 0, QUICK_TIP_LIMIT);
  state.powerups.tipIds = Array.isArray(matchingSnapshot.tipIds) ? [...new Set(matchingSnapshot.tipIds.map((value) => String(value || "").slice(0, 60)).filter(Boolean))].slice(0, QUICK_TIP_LIMIT) : [];
  state.powerups.currentTip = sanitizeHintObjective(progress.currentTip ?? matchingSnapshot.currentTip);
  state.powerups.giftUsed = Boolean(progress.giftUsed || matchingSnapshot.giftUsed || state.assist === "gift");
  state.powerups.giftUnavailable = !state.powerups.giftUsed && Boolean(matchingSnapshot.giftUnavailable);
  state.powerups.giftItem = snapshotItem(progress.giftItem) || snapshotItem(matchingSnapshot.giftItem);
  state.powerups.busy = false;
  clearArmedPowerup({ render: false });
  state.scoringDisabled = payload.run?.scoreEligible === false || payload.game?.scoreEligible === false || Boolean(progress.scoringDisabled);
  state.scoreMultiplier = state.scoringDisabled ? 0 : cappedScoreMultiplier(state.assist, payload.run?.scoreMultiplier, progress.scoreMultiplier);
  state.remixProgress = progress.remixProgress || payload.run?.remixProgress || state.remixProgress;
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
  resetBoardHistory();
  if (snapshotMatchesRun && Array.isArray(snapshot?.visuals?.nodes)) {
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
  const restoredWords = state.words
    .filter((item) => item.source !== "loaned-start")
    .map((item) => item.word);
  const profileSize = profile.discovered.length;
  if (!state.scoringDisabled) profile.discovered = [...new Set([...profile.discovered, ...restoredWords])].slice(0, 1000);
  if (profile.discovered.length !== profileSize) saveProfile({ fields: ["mastery"] });
  renderInventory();
  renderBoard();
  if (boardNodesOverlap()) tidyOrbit({ silent: true });
  renderAtlas();
  updateHud();
  updateMilestone(Boolean(progress.completed));
  renderCombinationStory();
  syncFirstOrbitGuide();
  scheduleRunSave();
}

async function restoreInterruptedRun(snapshot) {
  if (startupScramblePreemptsResume) return false;
  if (!snapshot) return false;
  try {
    if (snapshot.run.clientOnly === true) {
      const payload = clientOnlyRestorePayload(snapshot);
      if (!payload) {
        clearActiveRunSnapshot();
        return false;
      }
      startWithGame(payload.game, payload.run, {
        restored: true,
        context: null,
        deferTimer: false,
        persistenceRun: payload.persistenceRun
      });
      hydrateRestoredRun(payload, snapshot);
      showToast(`Restored your ${payload.game.mode === "explore" ? "free exploration" : "lesson"}.`);
      track("run_restored", {
        mode: payload.game.mode,
        target: payload.game.target,
        moves: state.moves,
        source: "client"
      });
      return true;
    }
    const pendingActivation = snapshot.run.activationPending === true;
    const payload = await fetchJson("/api/run/resume", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(isStaticBeta
        ? { runId: snapshot.run.id, runToken: snapshot.run.token, snapshot, deferActivation: pendingActivation }
        : { runId: snapshot.run.id, runToken: snapshot.run.token, deferActivation: pendingActivation })
    });
    applyServerPlayer(payload.player);
    const restoreObjective = shouldRestoreObjective(snapshot, payload.run);
    const restoredEvent = applyAuthoritativeEventPayload(payload);
    startWithGame(payload.game, payload.run, {
      restored: true,
      context: snapshot.journeyContext,
      deferTimer: restoreObjective
    });
    hydrateRestoredRun(payload, snapshot);
    if (restoredEvent?.reward?.claimable) {
      try { await claimCurrentCosmicEventReward(restoredEvent.event); }
      catch { /* Reconnect refresh retries the server-side idempotent claim. */ }
    }
    if (restoreObjective) {
      openMissionBriefing(payload.game, { mode: payload.game.mode }, null, snapshot.journeyContext);
      showToast(`Your game is ready. Start when you are ready.`);
    } else {
      showToast(`Restored your path to ${payload.game.target}.`);
    }
    track("run_restored", { mode: payload.game.mode, target: payload.game.target, moves: state.moves });
    if (payload.progress?.completed) requestAnimationFrame(() => finishGame(true, "", { skipSubmit: Boolean(payload.progress.submitted) }));
    else if (!restoreObjective && payload.run?.deadlineAt && Date.parse(payload.run.deadlineAt) <= Date.now()) requestAnimationFrame(() => finishGame(false, "Time is up."));
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

function startWithGame(game, run, {
  restored = false,
  context = null,
  enterThroughGate = false,
  deferTimer = false,
  persistenceRun = null
} = {}) {
  const shouldEnterThroughGate = Boolean(enterThroughGate && !restored);
  if (!shouldEnterThroughGate) {
    if (persistenceRun) {
      startWithGameNow(game, run, { restored, context, deferTimer, persistenceRun });
    } else {
      startWithGameNow(game, run, { restored, context, deferTimer });
    }
    return Promise.resolve(false);
  }
  const label = game.mode === "explore"
    ? "The board is ready."
    : `Find ${game.target}.`;
  return cosmicGate.enterBoard(
    () => startWithGameNow(game, run, {
      restored,
      context,
      deferTimer: true,
      persistenceRun
    }),
    {
      label,
      afterOpen: () => openMissionBriefing(game, { mode: game.mode }, null, context)
    }
  );
}

function hydrateScrambleMatch(projection) {
  if (!projection?.epochKey || !projection.game?.id || !projection.game?.target) {
    showToast("The live match snapshot was incomplete.", { scope: "global" });
    return false;
  }
  if (
    projection.epochKey === scrambleHostEpochKey
    && state.mode === "scramble"
    && state.game?.id === projection.game.id
  ) return true;
  scrambleHostEpochKey = projection.epochKey;
  projection.game.universe = selectUniverse(projection.game.seed);
  startWithGameNow(projection.game, projection.run, {
    context: { kind: "scramble", matchId: projection.game.id },
    deferTimer: true
  });
  state.words = structuredClone(projection.board.words);
  state.history = structuredClone(projection.board.history);
  state.moves = projection.board.moves;
  state.newDiscoveries = projection.board.newDiscoveries;
  state.scoringDisabled = true;
  state.scoreMultiplier = 0;
  renderInventory();
  renderBoard();
  updateHud();
  clearActiveRunSnapshot();
  requestAnimationFrame(() => els.wordList.querySelector(".inventory-word")?.focus({ preventScroll: true }));
  return true;
}

function finishScrambleMatch() {
  if (state.mode !== "scramble" || !state.game) return;
  cancelActiveTrayDrag();
  cancelActiveBoardDrag();
  cancelActivePointerGestures();
  cancelTapChain();
  ctrlHover.reset({ abandonPending: true });
  shiftBoard.reset();
  state.finished = true;
  state.pause.active = false;
  state.finishedElapsedSeconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1_000));
  stopTimer();
  clearActiveRunSnapshot();
  els.gameScreen.classList.remove("orbit-paused");
  els.gameScreen.classList.add("scramble-finished");
  gameAudio.setScene("result");
}

function startWithGameNow(game, run, {
  restored = false,
  context = null,
  deferTimer = false,
  persistenceRun = null
} = {}) {
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
  state.runPersistence = persistenceRun;
  state.focusMode = homeMenuState().focusMode;
  if (game.mode === "scramble") state.focusMode = false;
  state.adaptiveOutcomeRecorded = false;
  state.adaptiveNotice = null;
  state.routeRankNotice = null;
  if (game.adaptive === true && adaptiveModePolicy({ mode: game.mode }).eligible) {
    state.adaptiveDifficulty = rememberAdaptiveTarget(state.adaptiveDifficulty, game.target);
    saveAdaptiveDifficulty();
  }
  state.pause = { active: false, confirmAction: "" };
  state.journeyContext = normalizeJourneyContext(context, game);
  state.signature = null;
  state.community = null;
  state.eventRewardGranted = 0;
  state.assist = run?.assist || "none";
  state.scoringDisabled = run?.scoreEligible === false || game?.scoreEligible === false;
  state.scoreMultiplier = state.scoringDisabled ? 0 : cappedScoreMultiplier(state.assist, run?.scoreMultiplier, game?.scoreMultiplier);
  state.runIq = createRunIqState();
  state.routeProgress = sanitizeAuthoredRouteProgress(run?.routeProgress, game?.routeLength);
  state.remixProgress = run?.remixProgress || null;
  clearTimeout(runIqFeedbackTimer);
  runIqFeedbackTimer = null;
  clearTimeout(routeProgressFeedbackTimer);
  routeProgressFeedbackTimer = null;
  els.runMilestone?.classList.remove("route-closer");
  state.mode = game.mode;
  const starterItems = new Map((game.starterItems || []).map((item) => [inventoryKey(item), item]));
  state.words = game.mode === "explore"
    ? reusableExploreInventory()
    : game.starters.map((word) => {
        const item = starterItems.get(inventoryKey(word));
        return {
          word,
          emoji: item?.emoji || starterEmoji[word] || "✦",
          category: item?.category || starterCategory[word] || null,
          source: item?.source || (starterEmoji[word] ? "origin" : "loaned-start")
        };
      });
  state.nodes = [];
  state.history = [];
  resetCombinationStory();
  resetGoldenPairAnimations();
  resetBoardHistory();
  state.trails = [];
  state.dragTrailSamples = [];
  state.fusionBursts = [];
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
  state.powerups = { tipsUsed: 0, tipIds: [], currentTip: "", giftUsed: false, giftUnavailable: false, giftItem: null, busy: false };
  state.pathGuard = {
    version: PATH_GUARD_VERSION,
    active: pathGuardActiveFor(game, run),
    rankId: String(game.remixes?.rank?.id || ""),
    blockedPairs: new Set()
  };
  state.expectedPairReports = new Set();
  clearArmedPowerup({ render: false });
  resetPowerupControlLabels();
  state.startedAt = run?.startedAt
    ? Date.parse(run.startedAt)
    : persistenceRun?.startedAt
      ? Date.parse(persistenceRun.startedAt)
      : Date.now();
  state.finishedElapsedSeconds = 0;
  state.remainingSeconds = run?.deadlineAt ? Math.max(0, Math.ceil((Date.parse(run.deadlineAt) - Date.now()) / 1000)) : game.timeLimit || 0;
  state.timerWarningPlayed = false;
  state.resultAction = null;
  state.resultMasteryNotice = "";
  clearGlobalToast();
  clearBoardNotices();
  els.board.classList.remove("reveal-complete");
  els.startScreen.hidden = true;
  els.gameScreen.hidden = false;
  gameAudio.setIntensity(0);
  gameAudio.setScene("run");
  els.gameScreen.classList.toggle("training-orbit", game.mode === "training");
  els.gameScreen.classList.toggle("second-orbit", game.mode === "second-orbit");
  els.gameScreen.classList.toggle("explore-orbit", game.mode === "explore");
  els.gameScreen.classList.toggle("scramble-orbit", game.mode === "scramble");
  els.gameScreen.classList.toggle("focus-orbit", state.focusMode);
  els.gameScreen.classList.toggle("first-ranked-orbit", !["training", "second-orbit", "explore", "scramble"].includes(game.mode) && profile.wins === 0);
  els.gameScreen.classList.remove("orbit-paused");
  els.board.scrollTop = 0;
  els.board.scrollLeft = 0;
  els.modeName.textContent = missionModeLabel(game);
  $("#objectiveVerb").textContent = String(game.objectiveVerb || "Make");
  els.targetWord.textContent = game.mode === "explore" ? "Anything" : game.target;
  els.difficultyPill.hidden = game.difficultyTag !== "Difficult";
  els.difficultyPill.textContent = game.difficultyTag === "Difficult" ? "Difficult" : "";
  els.universePill.hidden = ["training", "second-orbit"].includes(game.mode);
  els.universePill.textContent = ["training", "second-orbit"].includes(game.mode) ? "" : `${game.universe.icon} ${game.universe.name} · ${game.universe.season.name}`;
  els.universePill.title = ["training", "second-orbit"].includes(game.mode) ? "" : `${game.universe.law.name}: ${game.universe.law.description}`;
  $("#journeyPill").hidden = !state.journeyContext;
  $("#journeyPill").textContent = state.journeyContext
    ? `${state.journeyContext.icon || "✦"} ${state.journeyContext.kind === "event" ? "EVENT" : "VOYAGE"} · ${state.journeyContext.title}`
    : "";
  els.timerHud.hidden = !game.timeLimit;
  $("#movesHud").hidden = !game.moveLimit;
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
  syncRankBoardArt();
  syncFirstOrbitGuide();
  requestAnimationFrame(startCosmos);
  void prepareGoldenPairAnimations();
  if (!deferTimer && competitiveGhostEligible()) void startRivalGhost();
  requestAnimationFrame(() => {
    els.wordList.scrollTop = 0;
    els.wordList.scrollLeft = 0;
  });
  if (game.timeLimit && !deferTimer) startTimer();
  if (game.mode === "scramble") clearActiveRunSnapshot();
  else scheduleRunSave();
  if (!restored && !deferTimer) {
    playFeedback("runStart");
    track("run_started", { mode: game.mode, target: game.target, stage: game.stage ?? null, aiEnabled: game.aiEnabled });
  }
}

function pauseMenuAvailable() {
  const openDialog = document.querySelector("dialog[open]");
  return Boolean(
    state.game
    && !cosmeticWorldPreviewActive()
    && !els.gameScreen.hidden
    && !state.finished
    && !state.startingRun
    && !state.reveal.active
    && !state.reveal.pending
    && !state.busyPairs.size
    && !state.powerups.busy
    && !cosmicGate.isActive()
    && !openDialog
  );
}

function resetPauseConfirmation({ focus = false } = {}) {
  const previousAction = state.pause.confirmAction;
  state.pause.confirmAction = "";
  $("#pauseConfirmation").hidden = true;
  $("#pauseRestart").classList.remove("is-confirming");
  $("#pauseExit").classList.remove("is-confirming");
  $("#pauseRestart span").textContent = "Restart";
  $("#pauseExit").textContent = "Quit game";
  if (focus && previousAction === "restart") $("#pauseRestart").focus();
}

function confirmPauseRestart() {
  if (state.pause.confirmAction === "restart") return true;
  state.pause.confirmAction = "restart";
  const ranked = Boolean(state.run?.ranked && !state.scoringDisabled);
  $("#pauseConfirmation").hidden = false;
  $("#pauseConfirmationTitle").textContent = "Restart this game?";
  $("#pauseConfirmationText").textContent = `${ranked ? "This starts a new attempt. " : ""}Your progress in this game will be lost.`;
  $("#pauseRestart").classList.add("is-confirming");
  $("#pauseExit").classList.remove("is-confirming");
  $("#pauseRestart span").textContent = "Yes, restart";
  $("#pauseExit").textContent = "Quit game";
  return false;
}

function populatePauseMenu() {
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));
  const timed = Boolean(state.game?.timeLimit);
  const ranked = Boolean(state.run?.ranked && !state.scoringDisabled);
  $("#pauseTitle").textContent = "Game paused";
  $("#pauseTarget").textContent = state.game?.target || "Unknown target";
  $("#pauseMode").textContent = String(state.game?.modeName || state.mode || "Game");
  $("#pauseMoves").textContent = String(state.moves);
  $("#pauseDiscoveries").textContent = String(state.newDiscoveries);
  $("#pauseClockLabel").textContent = timed ? "Time left" : "Time";
  $("#pauseClock").textContent = formatTime(timed ? Math.max(0, state.remainingSeconds) : elapsedSeconds);
  $("#pauseClockMessage").textContent = timed
    ? "The timer keeps running while this menu is open."
    : ranked
      ? "Your score timer keeps running while this menu is open."
      : "";
  $("#pauseClockPolicy").hidden = !timed && !ranked;
}

function openPauseMenu() {
  if (state.mode === "scramble" && scrambleRuntime?.isActive()) {
    return scrambleRuntime.requestForfeitConfirmation();
  }
  if (!pauseMenuAvailable()) {
    if (state.busyPairs.size || state.powerups.busy) showToast("Wait for the words to finish combining.");
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
  gameAudio.setScene("paused");
  renderInventory();
  renderBoard();
  void cosmicGate.presentDialog(els.pauseDialog, {
    kind: "pause",
    label: `Paused · Make ${state.game?.target || "the target"}`,
    focus: "#resumePausedRun"
  });
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
  gameAudio.setScene(state.finished ? "result" : els.gameScreen.hidden ? "home" : "run");
  if (state.game && !state.finished) {
    renderInventory();
    renderBoard();
  }
  if (wasActive) track("run_menu_closed", { mode: state.mode, moves: state.moves });
  if (restoreFocus && state.game && !state.finished) requestAnimationFrame(() => $("#pauseRunButton")?.focus({ preventScroll: true }));
}

async function closePauseMenu({ immediate = false, resume = true } = {}) {
  if (!state.pause.active && !els.pauseDialog.open) return;
  if (els.pauseDialog.open) {
    await cosmicGate.dismissDialog(els.pauseDialog, { immediate });
    if (resume) setTimeout(resumeTimerIfNeeded, 0);
  }
  else {
    finishPauseClose();
    if (resume) setTimeout(resumeTimerIfNeeded, 0);
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
    void closePauseMenu();
    return;
  }
  if (state.selectedNodeId != null) return;
  if (!pauseMenuAvailable()) return;
  event.preventDefault();
  openPauseMenu();
}

async function submitRunForfeit(run = state.run, game = state.game, { announce = false } = {}) {
  if (adaptiveRunEligible(game)) state.recoveryTarget = String(game.target || "");
  if (!run?.id || !run?.token || !game || run.forfeitSubmitted || !adaptiveRunEligible(game)) return null;
  run.forfeitSubmitted = true;
  if (isStaticBeta) {
    recordAdaptiveOutcome("abandoned");
    return { routeRank: currentRouteRank() };
  }
  try {
    const result = await fetchJson("/api/run/forfeit", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ runId: run.id, runToken: run.token })
    });
    const receipt = result.routeRankOutcome && typeof result.routeRankOutcome === "object"
      ? result.routeRankOutcome
      : null;
    const routeRank = receipt?.routeRank || result.routeRank;
    if (routeRank) applyRouteRank(routeRank, { announce });
    if (receipt?.adaptive?.message) {
      state.adaptiveNotice = {
        message: receipt.adaptive.message,
        metadata: receipt.adaptive.metadata || {}
      };
    }
    if (receipt?.promotion?.message) {
      state.routeRankNotice = {
        message: receipt.promotion.message,
        rankUp: receipt.promotion.promoted === true
      };
    }
    state.adaptiveOutcomeRecorded = true;
    return result;
  } catch (error) {
    if (["run_complete", "already_submitted", "run_missing"].includes(error.code)) return null;
    run.forfeitSubmitted = false;
    if (announce) showToast("Your game ended, but rank progress will sync when you reconnect.");
    return null;
  }
}

function queueRunForfeit(...args) {
  return state.forfeitPromise = submitRunForfeit(...args);
}

function quitActiveGame() {
  const priorRun = state.run;
  const priorGame = state.game;
  pauseCloseRestoreFocus = false;
  void queueRunForfeit(priorRun, priorGame, { announce: true });
  returnHome({ skipForfeit: true });
}

function returnHome({ skipForfeit = false } = {}) {
  if (state.startingRun) return showToast("The next orbit is still being mapped.");
  if (state.mode === "scramble" && scrambleRuntime?.isActive() && !skipForfeit) {
    scrambleRuntime.requestForfeitConfirmation();
    return;
  }
  if (pendingScoreBlocksExit()) {
    if (!els.resultDialog.open) els.resultDialog.showModal();
    showToast("Upload or queue this score before starting another orbit.");
    return;
  }
  const hadActiveRun = Boolean(state.game);
  if (state.game && !state.finished && !skipForfeit) void queueRunForfeit(state.run, state.game);
  const showRecoveryAfterExit = Boolean(state.finished && state.recoveryKit?.code && profile.wins > 0);
  pauseCloseRestoreFocus = false;
  cancelActiveTrayDrag();
  cancelActiveBoardDrag();
  dismissClearUndo();
  cancelTapChain();
  ctrlHover.reset({ abandonPending: true });
  shiftBoard.reset();
  state.orbitGeneration += 1;
  resetCombinationStory();
  resetGoldenPairAnimations();
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
  state.runPersistence = null;
  state.pause = { active: false, confirmAction: "" };
  state.journeyContext = null;
  state.signature = null;
  state.community = null;
  state.eventRewardGranted = 0;
  state.pendingMission = null;
  state.nodes = [];
  resetBoardHistory();
  resetPowerupControlLabels();
  clearActiveRunSnapshot();
  els.gameScreen.classList.remove("training-orbit", "second-orbit", "explore-orbit", "scramble-orbit", "scramble-finished", "first-ranked-orbit", "orbit-paused");
  document.body.classList.remove("scramble-active", "scramble-counting-down", "scramble-view-rival");
  scrambleRuntime?.deactivate();
  els.firstOrbitGuide.hidden = true;
  els.gameScreen.hidden = true;
  els.startScreen.hidden = false;
  gameAudio.setScene("home");
  if (hadActiveRun) playFeedback("homeReturn");
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
    if (action === "training") await startFirstOrbit({ enterThroughGate: true });
    else await beginMode(action, { trigger: button });
  } finally {
    button.disabled = false;
    syncProgressiveDisclosure();
  }
}

function openModePicker() {
  const picker = $("#modePicker");
  if (!picker || picker.closest("[hidden]") || !homeMenuState().choicesReady) return;
  picker.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start"
  });
  requestAnimationFrame(() => {
    picker.querySelector('[data-home-mode]:not([hidden]) button')?.focus({ preventScroll: true });
  });
}

async function beginPrimarySecondary() {
  if (state.startingRun) return;
  const button = $("#primaryOrbitSecondary");
  const action = primaryOrbitState().secondaryAction;
  if (action === "modes") return openModePicker();
  if (action === "training") return startFirstOrbit({ enterThroughGate: true });
  if (action === "reach") {
    rememberFirstOrbitSeen();
    syncProgressiveDisclosure();
    return beginMode("reach", { trigger: button });
  }
}

function openHubMenu() {
  const dialog = $("#hubMenuDialog");
  renderProfile();
  dialog.querySelectorAll(".menu-disclosure[open]").forEach((section) => { section.open = false; });
  if (!dialog.open) dialog.showModal();
}

function closeHubMenu() {
  const dialog = $("#hubMenuDialog");
  if (dialog?.open) dialog.close();
}

function loadDeveloperConsole() {
  if (!isStaticBeta) return Promise.resolve(null);
  if (!developerConsolePromise) {
    developerConsolePromise = import("./developer-console-runtime.mjs?v=5.0.0-beta.1")
      .then(({ createDeveloperConsoleController }) => createDeveloperConsoleController({
        isStaticBeta,
        stopTimer,
        closeHubMenu,
        showToast,
        getState: () => state,
        getProfile: () => profile,
        currentRouteRank,
        homeMenuState,
        applyRouteRank,
        localRouteRankSummary,
        saveAdaptiveDifficulty,
        saveProfile,
        currentWeekKey,
        stableHash,
        returnHome,
        startFirstOrbit,
        startSecondOrbit,
        beginMode,
        populateShare: shareCards.populateShare,
        cosmicGate,
        downloadJson,
        getTodayKey: () => todayKey,
        cancelExpectedPairDelivery: () => expectedPairDelivery.cancel(),
        clearActiveRunSnapshot,
        reload: () => location.reload()
      }))
      .catch((error) => {
        developerConsolePromise = null;
        showToast(error?.message || "Developer tools could not load.", { scope: "global" });
        return null;
      });
  }
  return developerConsolePromise;
}

function openDeveloperAccess() {
  void loadDeveloperConsole().then((controller) => controller?.open());
}

function handleDeveloperShortcut(event) {
  if (!isStaticBeta || !event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey || event.key.toLowerCase() !== "d") return;
  event.preventDefault();
  void loadDeveloperConsole().then((controller) => controller?.toggle());
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

async function enterCosmicInterlude(event) {
  const start = event.detail?.start;
  if (typeof start !== "function") return;
  if (state.startingRun || pendingScoreBlocksExit()) {
    showToast("Wait for this result to finish saving.");
    return;
  }
  event.preventDefault();
  state.startingRun = true;
  let started = false;
  const begin = () => {
    if (started) return;
    started = true;
    start();
  };
  try {
    const entered = await cosmicGate.enterBoard(
      () => {
        if (els.resultDialog.open) els.resultDialog.close();
      },
      {
        label: event.detail?.type === "star-trail"
          ? "A star trail is ready."
          : "A constellation puzzle is ready.",
        afterOpen: begin
      }
    );
    if (!entered) begin();
  } catch {
    if (els.resultDialog.open) els.resultDialog.close();
    begin();
  } finally {
    state.startingRun = false;
  }
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
    await startFirstOrbit();
    return;
  }
  if (mode === "second-orbit") {
    await startSecondOrbit();
    return;
  }
  if (mode === "explore") {
    await startExplore();
    return;
  }
  const adaptive = adaptiveSeriesEligible();
  const wasFinished = state.finished;
  const options = adaptive
    ? { trigger: wasFinished ? els.resultRetry : null, avoidTarget: state.recoveryTarget }
    : { seed: state.game.seed, target: ["reach", "challenge"].includes(mode) ? state.game.target : undefined, context: state.journeyContext };
  const resultActions = [els.resultPrimary, els.resultRetry, els.resultReplay, $("#resultLeaderboard"), els.resultShare, $("#resultReveal")];
  resultActions.forEach((control) => { control.disabled = true; });
  try {
    await beginMode(mode, options);
  }
  finally {
    resultActions.forEach((control) => { control.disabled = false; });
  }
}

async function replayFinishedChallenge() {
  if (!state.game || !state.finished || state.startingRun || state.reveal.replayAvailable) return;
  if (pendingScoreBlocksExit()) {
    showToast("Upload or queue this score before starting another game.");
    return;
  }
  const sourceRun = state.run;
  const sourceGeneration = state.orbitGeneration;
  const replay = { mode: state.game.mode, target: state.game.target };
  track("run_replayed", replay);
  const controls = [els.resultPrimary, els.resultRetry, els.resultReplay, $("#resultLeaderboard"), els.resultShare, $("#resultReveal")];
  state.startingRun = true;
  controls.forEach((control) => { control.disabled = true; });
  try {
    const payload = await fetchJson("/api/run/replay", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ runId: sourceRun.id, runToken: sourceRun.token, deferActivation: true })
    });
    if (!isReplayResponseCurrent({
      sourceRunId: sourceRun.id,
      sourceGeneration,
      currentRunId: state.run?.id,
      currentGeneration: state.orbitGeneration,
      finished: state.finished
    })) {
      void submitRunForfeit(payload.run, payload.game);
      return;
    }
    applyServerPlayer(payload.player);
    await startWithGame(payload.game, payload.run, { enterThroughGate: true });
    showToast(`Restarted ${payload.game.target} with the same opening and rules. Practice replay: no rank or rewards.`);
  } catch (error) {
    showToast(error.message || "That challenge could not be restarted.");
  } finally {
    state.startingRun = false;
    controls.forEach((control) => { control.disabled = false; });
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
    if (state.remainingSeconds > 0 && state.remainingSeconds <= 15 && !state.timerWarningPlayed) {
      state.timerWarningPlayed = true;
      playFeedback("timerWarning");
    }
    if (state.remainingSeconds <= 0) finishGame(false, "Time is up.");
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
    const pendingExpectedPairReports = expectedPairDelivery.pending().map(({ payload }) => ({
      pair: [payload.a, payload.b],
      expected: payload.expected,
      reason: payload.reason,
      mode: payload.mode,
      delivery: "pending"
    }));
    downloadJson(`constellore-local-report-${todayKey}.json`, {
      version: 3,
      exportedAt: new Date().toISOString(),
      counts: parsed.counts || {},
      recipeFeedback: recipeFeedback.recipes || {},
      expectedPairs: expectedPairs.pairs || {},
      expectedPairReports: expectedPairs.reports || {},
      pendingExpectedPairReports
    });
  } catch { showToast("The local report could not be exported.", { scope: "global" }); }
}

function resetLocalDiagnostics() {
  expectedPairDelivery.cancel();
  try {
    localStorage.removeItem(LOCAL_ANALYTICS_KEY);
    localStorage.removeItem(LOCAL_RECIPE_FEEDBACK_KEY);
    localStorage.removeItem(LOCAL_EXPECTED_PAIRS_KEY);
    localStorage.removeItem(LOCAL_EXPECTED_PAIR_OUTBOX_KEY);
  } catch { /* Storage can be unavailable. */ }
  showToast("Local report reset.", { scope: "global" });
}

async function exportLocalPractice() {
  const snapshot = structuredClone(profile);
  delete snapshot.playerToken;
  delete snapshot.cloudPending;
  delete snapshot.cloudPendingFields;
  downloadJson(`constellore-local-save-${todayKey}.json`, {
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: snapshot,
    cosmosCircuit: null
  });
}

function resetLocalPractice() {
  if (!window.confirm("Reset every local discovery, badge, score, and setting on this device? This cannot be undone.")) return;
  expectedPairDelivery.cancel();
  clearGameStorage(safeBrowserStorage());
  clearGameStorage(safeBrowserStorage(globalThis, "sessionStorage"));
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
      localStorage.removeItem(COSMOS_CIRCUIT_SAVE_KEY);
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
  const pathGuardActive = pathGuardActiveFor();
  state.pathGuard.active = pathGuardActive;
  state.pathGuard.rankId = String(state.game.remixes?.rank?.id || "");
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
  els.lawPill.classList.toggle("path-guard-status", pathGuardActive);
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
  } else if (pathGuardActive) {
    els.lawPill.hidden = false;
    els.lawPill.textContent = "◇ PATH GUARD · ON";
  } else {
    els.lawPill.hidden = !state.game.law;
    els.lawPill.textContent = state.game.law ? `${state.game.law.name}: ${state.game.law.description}` : "";
  }
  els.lawPill.title = pathGuardActive
    ? "Bronze and Silver Path Guard locks route-diverging pairings without using a move."
    : state.game.law ? `${state.game.law.name}: ${state.game.law.description}` : "";
  if (pathGuardActive) {
    els.lawPill.setAttribute(
      "aria-label",
      "Path Guard on. Route-diverging pairings are locked without using a move."
    );
  } else {
    els.lawPill.removeAttribute("aria-label");
  }
}

function runIqActive() {
  return Boolean(
    state.game
    && runIqApplies(state.mode, state.game.target, {
      scoreEligible: !state.scoringDisabled,
      revealed: state.reveal.revealed,
      study: state.assist === "reveal"
    })
    && !state.reveal.active
    && !state.reveal.pending
  );
}

function renderRunIq({ announce = "" } = {}) {
  if (!els.runIqHud) return;
  const active = runIqActive();
  els.runIqHud.hidden = !active || state.focusMode;
  if (!active) return;
  const score = sanitizeRunIqState(state.runIq);
  const percent = Math.round(score.value / 2);
  els.runIqValue.textContent = String(score.value);
  els.runIqBar.style.width = `${percent}%`;
  els.runIqHud.setAttribute("aria-valuenow", String(score.value));
  els.runIqHud.setAttribute(
    "aria-valuetext",
    `Run IQ ${score.value} out of 200. Playful score for this game, not an intelligence test.${score.streak > 1 ? ` ${score.streak} target-path discoveries in a row.` : ""}`
  );
  const streaking = score.streak > 1;
  els.runIqStreak.hidden = !streaking;
  els.runIqStreak.textContent = `×${score.multiplier.toFixed(score.multiplier % 1 ? 2 : 0)}`;
  if (announce) els.runIqStatus.textContent = announce;
}

function animateRunIq(outcome) {
  if (!runIqActive()) return;
  clearTimeout(runIqFeedbackTimer);
  const score = state.runIq;
  const className = ["repeat", "known"].includes(score.outcome)
    ? "iq-repeat"
    : outcome === "miss"
      ? "iq-miss"
      : score.maxed
        ? "iq-max"
        : "iq-gain";
  els.runIqHud.classList.remove("iq-gain", "iq-miss", "iq-max", "iq-repeat");
  void els.runIqHud.offsetWidth;
  els.runIqHud.classList.add(className);
  els.runIqDelta.textContent = score.outcome === "repeat"
    ? "REPEAT"
    : score.outcome === "known"
      ? "KNOWN"
      : score.maxed && score.delta === 0
        ? "MAX"
        : `${score.delta > 0 ? "+" : ""}${score.delta}`;
  const announcement = score.outcome === "repeat"
    ? `That pair was already scored. Run IQ stays at ${score.value}.`
    : score.outcome === "known"
      ? `That result is already in this game. Run IQ stays at ${score.value}.`
    : outcome === "miss"
    ? score.delta < 0
      ? `That pair does not combine. Run IQ drops to ${score.value}, and the target-path streak resets.`
      : `That pair does not combine. Run IQ stays at ${score.value}, and the target-path streak resets.`
    : score.maxed
      ? "Run IQ reached the playful maximum of 200."
      : score.outcome === "explore"
        ? score.delta > 0
          ? `New discovery, but it does not shorten the path to ${state.game.target}. Run IQ adds only ${score.delta}.`
          : `New discovery, but it does not shorten the path to ${state.game.target}. The small discovery bonus is already full.`
        : score.outcome === "route"
          ? `That discovery moves you closer to ${state.game.target}. Run IQ rises to ${score.value}${score.streak > 1 ? ` with a ${score.multiplier.toFixed(2)} times path streak` : ""}.`
          : score.outcome === "target"
            ? `Target reached. Run IQ rises to ${score.value}.`
            : `Run IQ stays at ${score.value}.`;
  renderRunIq({ announce: announcement });
  runIqFeedbackTimer = setTimeout(() => {
    els.runIqHud?.classList.remove("iq-gain", "iq-miss", "iq-max", "iq-repeat");
    if (els.runIqDelta) els.runIqDelta.textContent = "";
    runIqFeedbackTimer = null;
  }, 1350);
}

function changeRunIq(outcome, a = "", b = "", context = {}) {
  if (!runIqActive()) return;
  const pairKey = String(context.pairKey || runIqPairKey(a, b)).slice(0, 180);
  state.runIq = outcome === "miss"
    ? softenRunIq(state.runIq, pairKey)
    : rewardRunIq(state.runIq, pairKey, context);
  animateRunIq(outcome);
  return state.runIq;
}

function runIqSuccessfulPairKey(a, b, resultWord) {
  return `${runIqPairKey(a, b)}=>${inventoryKey(resultWord)}`.slice(0, 180);
}

function renderRemixHud() {
  if (!els.remixPill) return;
  const rules = Array.isArray(state.game?.remixes?.rules) ? state.game.remixes.rules : [];
  els.remixPill.hidden = rules.length === 0;
  if (!rules.length) {
    els.remixPill.textContent = "Rules";
    els.remixPill.title = "";
    return;
  }
  const progressItems = Array.isArray(state.remixProgress?.items) ? state.remixProgress.items : [];
  const byFamily = new Map(progressItems.map((item) => [item.family, item]));
  const complete = rules.filter((rule) => byFamily.get(rule.family)?.complete === true).length;
  const nextRule = rules.find((rule) => byFamily.get(rule.family)?.complete !== true) || rules[0];
  els.remixPill.textContent = `Rules ${complete}/${rules.length}`;
  els.remixPill.title = nextRule?.instruction || "Show route rules";
  els.remixPill.setAttribute("aria-label", `${complete} of ${rules.length} route rules ready. Show route rules.`);
}

function renderResultRemixes(won, revealed) {
  if (!els.resultRemixNote) return;
  const remixes = state.game?.remixes;
  if (!remixes) {
    els.resultRemixNote.hidden = true;
    els.resultRemixNote.textContent = "";
    return;
  }
  const routeRank = currentRouteRank();
  const rank = routeRank.rank || getRemixRankPresentation(remixes.rank?.id || "bronze");
  const rules = Array.isArray(remixes.rules) ? remixes.rules : [];
  const progressItems = Array.isArray(state.remixProgress?.items) ? state.remixProgress.items : [];
  const byFamily = new Map(progressItems.map((item) => [item.family, item]));
  const complete = rules.filter((rule) => byFamily.get(rule.family)?.complete === true).length;
  const rankChanged = Boolean(
    won
    && !revealed
    && remixes.rank?.id
    && remixes.rank.id !== rank.id
  );
  const ruleSummary = rules.length
    ? `${complete}/${rules.length} route rules complete`
    : "Classic route complete";
  const nextSummary = routeRank.promotion?.active
    ? `${routeRank.promotion.wins}/${routeRank.promotion.winsRequired} promotion wins`
    : rank.nextRank
      ? routeRank.mastery.pointsRemaining > 0
        ? `${routeRank.mastery.pointsRemaining} mastery to promotion`
        : "Promotion ready"
      : "Highest Route Rank";
  els.resultRemixNote.textContent = rankChanged
    ? `${rank.name} Route Rank unlocked! ${rank.remixRange} now available.`
    : won && !revealed
      ? `${ruleSummary} · ${rank.name} Route Rank · ${nextSummary}`
      : `${rank.name} Route Rank kept · ${nextSummary}`;
  els.resultRemixNote.hidden = false;
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
    els.revealPathButton.querySelector("b").textContent = state.scoringDisabled && alreadyRevealed ? "Shown" : "Show answer";
  }
  renderRunIq();
  renderRemixHud();
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

function acceptRouteProgress(rawProgress) {
  if (!rawProgress || !state.game) return;
  const previous = state.routeProgress;
  const next = sanitizeAuthoredRouteProgress(rawProgress, state.game.routeLength);
  state.routeProgress = next;
  const improved = Number.isFinite(previous?.remaining) && next.remaining < previous.remaining;
  if (!improved || !els.runMilestone) return;
  clearTimeout(routeProgressFeedbackTimer);
  els.runMilestone.classList.remove("route-closer");
  void els.runMilestone.offsetWidth;
  els.runMilestone.classList.add("route-closer");
  routeProgressFeedbackTimer = setTimeout(() => {
    els.runMilestone?.classList.remove("route-closer");
    routeProgressFeedbackTimer = null;
  }, 900);
}

function updateMilestone(won = false) {
  if (!state.game) return;
  if (state.mode === "explore") {
    const combinations = state.history.length;
    gameAudio.setIntensity(Math.min(.35, combinations * .04));
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
  const progress = sanitizeAuthoredRouteProgress(state.routeProgress, state.game.routeLength);
  const reached = Boolean(won || model.targetReached);
  gameAudio.setIntensity(reached ? 1 : progress.percent / 100);
  els.milestoneBar.style.width = `${reached ? 100 : progress.percent}%`;
  els.milestoneText.textContent = reached
    ? `${state.game.target} reached`
    : progress.remaining > 0
      ? `Closest route to ${state.game.target}`
      : `${state.game.target} is ready`;
  $("#routeStepCount").textContent = reached
    ? "DONE"
    : progress.remaining > 0
      ? `${progress.remaining} STEP${progress.remaining === 1 ? "" : "S"} LEFT`
      : "READY";
  els.runMilestone?.setAttribute(
    "aria-label",
    reached
      ? `${state.game.target} reached`
      : progress.remaining > 0
        ? `Closest known route to ${state.game.target}: ${progress.remaining} step${progress.remaining === 1 ? "" : "s"} left`
        : `${state.game.target} is ready`
  );
  renderRouteStarStrip(els.routeProgressTrail, model);
}

function renderResultRoute() {
  if (!state.game) return;
  const model = buildRouteProgress({ history: state.history, target: state.game.target, limit: 7 });
  $("#resultRouteTitle").textContent = model.targetReached ? `Your route to ${state.game.target}` : `Your orbit toward ${state.game.target}`;
  $("#resultRouteSummary").textContent = `${model.combinations} recipe${model.combinations === 1 ? "" : "s"} · ${state.newDiscoveries} new discover${state.newDiscoveries === 1 ? "y" : "ies"}`;
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
  if (state.startingRun || state.pause.active || state.reveal.active || state.reveal.pending || state.busyPairs.size) return showToast("Wait for the words to finish combining.");
  clearArmedPowerup({ render: false });
  stopTimer();
  els.quickTipMessage.classList.remove("error");
  els.quickTipMessage.textContent = state.powerups.tipsUsed >= QUICK_TIP_LIMIT
    ? "You have used all three hints."
    : state.powerups.currentTip;
  els.wordGiftMessage.classList.remove("error");
  els.wordGiftMessage.textContent = state.powerups.giftUsed
    ? `${state.powerups.giftItem?.word || "A helpful word"} was added. You keep half your points.`
    : state.powerups.giftUnavailable
      ? "You already know every helpful word for this target."
    : "";
  $("#senseMessage").classList.remove("error");
  $("#senseMessage").textContent = "";
  const strongerHelp = document.querySelector(".guidance-stronger");
  if (strongerHelp) strongerHelp.open = false;
  renderProfile();
  els.senseDialog.scrollTop = 0;
  els.senseDialog.showModal();
  void ensureStardustStore()
    .then(() => renderStardustStore())
    .catch((error) => showStardustStoreFailure(error, "Stardust supplies could not be opened."));
  track("sense_opened", { mode: state.mode, surface: "help" });
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
  label.textContent = "Finding a hint…";
  els.quickTipMessage.classList.remove("error");
  els.quickTipMessage.textContent = "Looking for a useful word…";
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
      const tipId = `hint-${state.powerups.tipsUsed}`;
      if (!state.powerups.tipIds.includes(tipId)) state.powerups.tipIds.push(tipId);
      state.powerups.tipIds = state.powerups.tipIds.slice(-QUICK_TIP_LIMIT);
      state.powerups.currentTip = sanitizeHintObjective(tip.text);
    }
    els.quickTipMessage.textContent = tip.text;
    scheduleRunSave();
    if (!els.senseDialog.open) showAlchemy(`HINT · ${tip.text}`);
    if (tip.available) {
      playFeedback("sense");
      track("quick_tip_used", { mode: state.mode, tipIndex, remaining: tip.remaining, scoreSafe: tip.scoreSafe === true });
    }
  } catch (error) {
    if (state.run?.id !== runId || state.orbitGeneration !== orbitGeneration) return;
    els.quickTipMessage.classList.add("error");
    els.quickTipMessage.textContent = error.message || "The hint could not load. You did not use one.";
    if (!els.senseDialog.open) showAlchemy("The hint could not load. Try again.", true);
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
  label.textContent = "Adding a word…";
  els.wordGiftMessage.classList.remove("error");
  els.wordGiftMessage.textContent = "Finding a helpful word…";
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
    acceptRouteProgress(result.routeProgress);
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
    updateMilestone();
    scheduleRunSave();
    if (els.senseDialog.open) els.senseDialog.close();
    placeFromTray(item);
    playFeedback("sense", { analytics: true });
    showAlchemy(`${item.word} was added · ${Math.round(state.scoreMultiplier * 100)}% points.`);
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
      els.wordGiftMessage.textContent = "The reply was interrupted. Try again to add the same word.";
    }
    els.wordGiftMessage.classList.add("error");
    if (!els.senseDialog.open) showToast(error.code === "gift_unavailable" ? "No helpful word is available." : "The word could not be added. Try again.");
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

function buyStardustSupply(itemId) {
  void ensureStardustStore()
    .then((runtime) => runtime.purchase(itemId))
    .catch((error) => showStardustStoreFailure(error, "That Stardust supply could not be purchased."));
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
  return Boolean(
    profile.wins >= HOME_MENU_ADVANCED_WINS
    && !state.focusMode
    && state.game
    && !["training", "second-orbit", "explore", "reach"].includes(state.mode)
    && !state.scoringDisabled
  );
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

function visualWordToken(value) {
  if (typeof value !== "string") return "unknown";
  const token = value.trim().toLowerCase();
  return /^[a-z][a-z0-9-]{0,31}$/.test(token) ? token : "unknown";
}

function visualWordCategory(value) {
  const category = visualWordToken(value);
  return ["force", "nature", "life", "structure", "celestial"].includes(category) ? category : "unknown";
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
    button.className = `inventory-word${["wish", "market"].includes(item.source) ? " wish" : ""}${item.source === "gift" ? " gift" : ""}${item.source === "twist" ? " twist" : ""}${item.source === "loaned-start" ? " loaned" : ""}${item.ghost ? " reveal-ghost" : ""}${senseWordActive(item) ? " sense-hot" : ""}${firstOrbitWordActive(item) ? " tutorial-hot" : ""}`;
    button.dataset.word = inventoryKey(item);
    button.dataset.category = visualWordCategory(item.category);
    button.dataset.source = visualWordToken(item.source);
    const revealLocked = state.reveal.active || state.reveal.pending;
    const unavailable = state.finished || state.pause.active || revealLocked || item.ghost;
    button.draggable = false;
    button.disabled = unavailable;
    const temporaryStart = item.source === "loaned-start";
    button.setAttribute("aria-label", item.ghost
      ? `${item.word}, temporary answer word. Not playable.`
      : unavailable
        ? `${item.word}. Not available right now.`
        : temporaryStart
          ? `Add ${item.word} to the board. This starting word is only for this game.`
          : `Add ${item.word} to the board. Drop it onto another word to combine.`);
    if (!unavailable) button.title = temporaryStart
      ? `${item.word} is a starting word for this game`
      : `Drag ${item.word} onto a board word to combine`;
    const tag = item.ghost ? "REVEALED" : item.source === "loaned-start" ? "START" : item.source === "gift" ? "GIFT" : item.source === "twist" ? "TWIST" : item.source === "wish" ? "WISH" : item.source === "market" ? "VAULT" : item.source?.startsWith("ai") ? "AI" : "";
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
  document.querySelector(".inventory")?.classList.toggle("has-many-words", state.words.length >= 12);
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
  else clearBoardAnnouncement("tap-chain");
}

function cancelTapChain({ announce = false } = {}) {
  if (state.selectedNodeId == null) return false;
  state.selectedNodeId = null;
  syncSelectedNodeState();
  if (announce) showAlchemy("Tap chain cancelled.");
  return true;
}

function dismissClearUndo() {
  clearTimeout(boardUndoTimer);
  boardUndoTimer = null;
  if (els.boardUndo) els.boardUndo.hidden = true;
  clearBoardAnnouncement("board-clear");
}

function boardHistorySnapshot() {
  return {
    runId: state.run?.id || "",
    generation: state.orbitGeneration,
    progressRevision: state.history.length,
    nextId: state.nextId,
    topZ: state.topZ,
    nodes: structuredClone(state.nodes.filter((node) => !node.revealRole && !node.item.ghost))
  };
}

function boardHistoryFingerprint(snapshot) {
  return JSON.stringify((snapshot?.nodes || []).map((node) => [
    String(node.id),
    inventoryKey(node.item),
    Math.round(Number(node.x) * 10) / 10,
    Math.round(Number(node.y) * 10) / 10,
    Number(node.z) || 0,
    Boolean(node.cosmicTwist)
  ]));
}

function boardHistoryMatchesRun(snapshot) {
  return Boolean(snapshot
    && snapshot.generation === state.orbitGeneration
    && snapshot.runId === (state.run?.id || "")
    && snapshot.progressRevision === state.history.length);
}

function resetBoardHistory() {
  boardHistory = { past: [], future: [] };
  shiftHistorySnapshot = null;
  updateBoardTools();
}

function commitBoardEdit(before, label) {
  if (!boardHistoryMatchesRun(before)) return resetBoardHistory();
  const after = boardHistorySnapshot();
  if (boardHistoryFingerprint(before) === boardHistoryFingerprint(after)) return updateBoardTools();
  boardHistory.past.push({ snapshot: before, label: String(label || "board change").slice(0, 48) });
  if (boardHistory.past.length > MAX_BOARD_HISTORY) boardHistory.past.splice(0, boardHistory.past.length - MAX_BOARD_HISTORY);
  boardHistory.future = [];
  updateBoardTools();
}

function restoreBoardHistorySnapshot(snapshot) {
  if (!boardHistoryMatchesRun(snapshot) || state.busyPairs.size) return false;
  cancelActiveTrayDrag();
  cancelActiveBoardDrag();
  ctrlHover.reset();
  shiftBoard.reset();
  cancelTapChain();
  dismissClearUndo();
  state.nodes = structuredClone(snapshot.nodes);
  state.nextId = Math.max(Number(snapshot.nextId) || 1, ...state.nodes.map((node) => Number(node.id) + 1).filter(Number.isFinite), 1);
  state.topZ = Math.max(Number(snapshot.topZ) || 10, ...state.nodes.map((node) => Number(node.z)).filter(Number.isFinite), 10);
  renderBoard();
  scheduleRunSave();
  return true;
}

function undoBoardEdit() {
  const entry = boardHistory.past.pop();
  if (!entry) return updateBoardTools();
  const current = boardHistorySnapshot();
  if (!restoreBoardHistorySnapshot(entry.snapshot)) {
    resetBoardHistory();
    return;
  }
  boardHistory.future.push({ snapshot: current, label: entry.label });
  if (boardHistory.future.length > MAX_BOARD_HISTORY) boardHistory.future.shift();
  updateBoardTools();
  showAlchemy(`Undid ${entry.label}. Score and discoveries stay the same.`);
}

function redoBoardEdit() {
  const entry = boardHistory.future.pop();
  if (!entry) return updateBoardTools();
  const current = boardHistorySnapshot();
  if (!restoreBoardHistorySnapshot(entry.snapshot)) {
    resetBoardHistory();
    return;
  }
  boardHistory.past.push({ snapshot: current, label: entry.label });
  if (boardHistory.past.length > MAX_BOARD_HISTORY) boardHistory.past.shift();
  updateBoardTools();
  showAlchemy(`Redid ${entry.label}. Score and discoveries stay the same.`);
}

function updateBoardTools() {
  const boardLocked = !state.game || state.finished || state.startingRun || state.reveal.active || state.reveal.pending || state.busyPairs.size > 0;
  els.tidyBoard.disabled = boardLocked || state.nodes.length < 2;
  els.resetBoard.disabled = boardLocked || state.nodes.length === 0;
  els.undoBoardAction.disabled = boardLocked || !boardHistory.past.length;
  els.redoBoardAction.disabled = boardLocked || !boardHistory.future.length;
  els.senseButton.disabled = boardLocked || state.pause.active;
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
  resetExpectedPairFeedback();
  clearBoardNotices();
  dismissClearUndo();
  const before = boardHistorySnapshot();
  state.nodes = [];
  renderBoard();
  commitBoardEdit(before, "clear board");
  els.boardUndo.hidden = false;
  boardUndoTimer = setTimeout(dismissClearUndo, 6000);
  scheduleRunSave();
  announceBoardMessage("Board cleared. Use Undo to restore it. Your discoveries remain.", "board-clear");
}

function undoBoardClear() {
  dismissClearUndo();
  undoBoardEdit();
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
  const candidates = [els.rivalGhost, els.ghostPreview, document.querySelector(".board-quick-tools"), document.querySelector(".run-milestone"), els.hintObjective, els.tapChainStatus, els.boardUndo, els.recipeFeedback, els.expectedPairFeedback, els.alchemyNote, els.firstOrbitGuide];
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

function moveBoardNodeOutsideOverlays(node, element, boardRect, size) {
  const width = Math.max(1, Number(size?.width) || element?.offsetWidth || 1);
  const height = Math.max(1, Number(size?.height) || element?.offsetHeight || 1);
  const overlays = visibleBoardOverlayRectangles(boardRect);
  const current = { left: node.x, top: node.y, width, height };
  if (!overlays.some((overlay) => rectanglesOverlap(current, overlay, 6))) return false;
  const occupied = [...els.boardItems.querySelectorAll(".board-word")]
    .filter((candidate) => candidate !== element)
    .map((candidate) => {
      const bounds = candidate.getBoundingClientRect();
      return { left: bounds.left - boardRect.left, top: bounds.top - boardRect.top, width: bounds.width, height: bounds.height };
    });
  const open = findOpenSpawn(
    { x: node.x, y: node.y },
    { width, height },
    [...occupied, ...overlays],
    { left: 5, top: 5, width: Math.max(1, boardRect.width - 10), height: Math.max(1, boardRect.height - 10) },
    { gap: 8, step: 12 }
  );
  if (!open) return false;
  const relocated = { left: open.x, top: open.y, width, height };
  if ([...occupied, ...overlays].some((blocker) => rectanglesOverlap(relocated, blocker, 6))) return false;
  node.x = open.x;
  node.y = open.y;
  element.style.setProperty("--x", `${node.x}px`);
  element.style.setProperty("--y", `${node.y}px`);
  return true;
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
  const before = options?.silent ? null : boardHistorySnapshot();
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
  if (before) commitBoardEdit(before, "tidy words");
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
  if (state.reveal.revealed) {
    refreshRevealLayoutForViewport();
    return;
  }
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
  const before = boardHistorySnapshot();
  if (state.selectedNodeId === current.id) state.selectedNodeId = null;
  state.nodes = state.nodes.filter((entry) => entry.id !== current.id);
  els.boardItems.querySelector(`[data-id="${current.id}"]`)?.remove();
  boardGeometryVersion += 1;
  els.boardGuide.classList.toggle("hidden", state.nodes.length > 0);
  els.boardGuide.setAttribute("aria-hidden", String(state.nodes.length > 0));
  syncSelectedNodeState();
  updateBoardTools();
  syncFirstOrbitGuide();
  commitBoardEdit(before, `remove ${current.item.word}`);
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
  shiftHistorySnapshot ||= boardHistorySnapshot();
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

function commitShiftBoardHistory() {
  if (!shiftHistorySnapshot) return;
  const before = shiftHistorySnapshot;
  shiftHistorySnapshot = null;
  commitBoardEdit(before, "stamp words");
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

function handleBoardHistoryShortcut(event) {
  if (event.defaultPrevented || event.altKey || (!event.ctrlKey && !event.metaKey) || boardModifierBlocked(event)) return;
  if (els.gameScreen.hidden || !state.game || state.finished || state.pause.active || state.startingRun || state.reveal.active || state.reveal.pending || state.busyPairs.size) return;
  const key = String(event.key || "").toLowerCase();
  const wantsUndo = key === "z" && !event.shiftKey;
  const wantsRedo = (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey);
  if (!wantsUndo && !wantsRedo) return;
  const available = wantsUndo ? boardHistory.past.length : boardHistory.future.length;
  if (!available) return;
  event.preventDefault();
  if (wantsUndo) undoBoardEdit();
  else redoBoardEdit();
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
  button.dataset.category = visualWordCategory(node.item.category);
  button.dataset.source = visualWordToken(node.item.source);
  if (node.revealKey) {
    button.dataset.revealKey = node.revealKey;
    button.dataset.revealWave = String(node.revealWave ?? 0);
    button.style.setProperty("--reveal-node-width", `${Number(node.revealWidth) || 132}px`);
    button.style.setProperty("--reveal-node-height", `${Number(node.revealHeight) || 42}px`);
    button.title = node.item.word;
  } else {
    delete button.dataset.revealKey;
    delete button.dataset.revealWave;
    button.style.removeProperty("--reveal-node-width");
    button.style.removeProperty("--reveal-node-height");
    button.removeAttribute("title");
  }
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
      : `${node.item.word}${node.item.source === "gift" ? ", Word Gift bridge" : node.item.source === "twist" || node.cosmicTwist ? ", Cosmic Twist discovery" : ""}. Press to arm, then press another word to combine. You can also drag it onto another word. Hold Shift while hovering to remove; grab it first and then hold Shift while dragging to copy.`);
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
  resetExpectedPairFeedback();
  if (!state.selectedNodeId) {
    state.selectedNodeId = node.id;
    syncSelectedNodeState();
    announceBoardMessage(`${node.item.word} armed. Tap another word.`, "tap-chain");
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
  if ((!outcome || outcome.wrongPath) && getCtrlHoverNode(node.id)) {
    state.selectedNodeId = node.id;
    syncSelectedNodeState();
    els.tapChainText.textContent = `${node.item.word} still armed · try another word`;
    announceBoardMessage(
      outcome?.wrongPath
        ? `${outcome.message} ${node.item.word} remains armed; choose another word.`
        : `${node.item.word} remains armed. Try another word.`,
      outcome?.wrongPath ? "board-notice" : "tap-chain"
    );
  }
}

async function activateTrayItem(item) {
  if (state.pause.active) return;
  resetRecipeFeedback();
  resetExpectedPairFeedback();
  const selected = state.nodes.find((node) => node.id === state.selectedNodeId);
  if (!selected) {
    const placed = placeFromTray(item);
    if (!placed) return null;
    state.selectedNodeId = placed.id;
    syncSelectedNodeState();
    announceBoardMessage(`${placed.item.word} armed. Tap another word.`, "tap-chain");
    return placed;
  }
  state.selectedNodeId = null;
  syncSelectedNodeState();
  const outcome = await combineTrayWithTarget(item, selected);
  if ((!outcome || outcome.wrongPath) && getCtrlHoverNode(selected.id)) {
    state.selectedNodeId = selected.id;
    syncSelectedNodeState();
    els.tapChainText.textContent = `${selected.item.word} still armed · try another word`;
    announceBoardMessage(
      outcome?.wrongPath
        ? `${outcome.message} ${selected.item.word} remains armed; choose another word.`
        : `${selected.item.word} remains armed. Try another word.`,
      outcome?.wrongPath ? "board-notice" : "tap-chain"
    );
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
  const before = boardHistorySnapshot();
  touchInventory(item);
  renderInventory();
  const node = addNode(item, x, y, measuredSize ? { size: measuredSize, inset: 5 } : {});
  commitBoardEdit(before, `place ${item.word}`);
  playFeedback("place", { category: item.category, word: item.word, source: item.source });
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
      const compactSideRail = matchMedia("(max-width: 700px) and (max-height: 500px) and (min-width: 520px)").matches;
      const mobileTray = !compactSideRail
        && matchMedia("(max-width: 700px), (max-width: 900px) and (orientation: portrait)").matches;
      const headingTowardBoard = mobileTray
        ? dy < -8 && Math.abs(dy) > Math.abs(dx) * .65
        : dx < -8 && Math.abs(dx) > Math.abs(dy) * .65;
      if (!moved || !headingTowardBoard) return;
      dragging = true;
      resetCosmeticDragTrail(state);
      cancelTapChain();
      dismissClearUndo();
      element.classList.add("pointer-dragging");
      ghost = document.createElement("div");
      ghost.className = "tray-drag-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.dataset.category = visualWordCategory(item.category);
      ghost.dataset.source = visualWordToken(item.source);
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
    appendCosmeticDragTrail(state, moveEvent, els.board);
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
    commitShiftBoardHistory();
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
  const allowOutOfBounds = nodeOptions.allowOutOfBounds === true;
  delete nodeOptions.allowOutOfBounds;
  const width = Number(size?.width) > 0 ? Number(size.width) : 155;
  const height = Number(size?.height) > 0 ? Number(size.height) : 54;
  const inset = Number.isFinite(Number(requestedInset)) ? clamp(Number(requestedInset), 0, 20) : 8;
  const node = {
    id: state.nextId++, item,
    x: allowOutOfBounds ? Number(x) || 0 : clamp(x, inset, Math.max(inset, bounds.width - width - inset)),
    y: allowOutOfBounds ? Number(y) || 0 : clamp(y, inset, Math.max(inset, bounds.height - height - inset)),
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
  const boardBeforeDrag = boardHistorySnapshot();
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
      resetCosmeticDragTrail(state);
      element.classList.add("dragging");
      cancelTapChain();
      dismissClearUndo();
    }
    if (!moved) return;
    node.x = clamp(point.clientX - boardRect.left - offsetX, 5, boardRect.width - nodeWidth - 5);
    node.y = clamp(point.clientY - boardRect.top - offsetY, 5, boardRect.height - nodeHeight - 5);
    element.style.setProperty("--x", `${node.x}px`);
    element.style.setProperty("--y", `${node.y}px`);
    appendCosmeticDragTrail(state, moveEvent, els.board);
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
    commitShiftBoardHistory();
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
    if (moved && !resolution?.selected) moveBoardNodeOutsideOverlays(node, element, boardRect, { width: nodeWidth, height: nodeHeight });
    const stampedDuringDrag = Boolean(shiftHistorySnapshot);
    cleanup();
    if (moved && !stampedDuringDrag) commitBoardEdit(boardBeforeDrag, `move ${node.item.word}`);
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

function moveLimitEndMessage() {
  const masterRoute = state.game?.remixes?.rules?.some((rule) => rule.family === "master_route");
  return masterRoute ? "Master Route limit reached." : "No moves left.";
}

function pulsePathGuardNodes(...elements) {
  for (const element of elements) {
    if (!element) continue;
    element.classList.remove("combining", "merging", "rejected");
    element.classList.add("wrong-path");
    setTimeout(() => element.classList.remove("wrong-path"), 760);
  }
}

function showPathGuardFeedback(a, b, { remembered = false, elements = [] } = {}) {
  pulsePathGuardNodes(...elements);
  const message = remembered
    ? "WRONG PATH · PAIR LOCKED · You already checked this connection. Try a different partner; move unchanged."
    : `WRONG PATH · PAIR LOCKED · ${a} + ${b} does not follow the guided route to ${state.game?.target || "this target"}. Words kept; move unchanged.`;
  showAlchemy(message, false, false, {
    tone: "wrong-path",
    key: `wrong-path:${pathGuardPairKey(a, b)}`,
    duration: 3900
  });
  playFeedback("uiSelect");
  return message;
}

function commitGameOutcome() {
  if (state.finished) return false;
  state.finished = true;
  stopTimer();
  return true;
}

async function combineNodes(a, b) {
  if (state.finished || state.pause.active || state.reveal.active || state.reveal.pending || state.busyPairs.has(a.id) || state.busyPairs.has(b.id)) return;
  const scrambleActive = state.mode === "scramble" && scrambleRuntime?.isActive();
  if (state.mode === "scramble" && (!scrambleActive || scrambleRuntime.isCountingDown())) {
    showToast(scrambleRuntime?.isCountingDown() ? "Wait for the three-second countdown." : "The live match is reconnecting.", { scope: "global" });
    return;
  }
  if (state.game.moveLimit && state.moves >= state.game.moveLimit) return finishGame(false, moveLimitEndMessage());
  if (!scrambleActive && pathGuardPairWasRemembered(a.item.word, b.item.word)) {
    const aElement = els.boardItems.querySelector(`[data-id="${a.id}"]`);
    const bElement = els.boardItems.querySelector(`[data-id="${b.id}"]`);
    const message = showPathGuardFeedback(a.item.word, b.item.word, {
      remembered: true,
      elements: [aElement, bElement]
    });
    track("path_guard_remembered", {
      mode: state.mode,
      status: "remembered"
    });
    return {
      rejected: true,
      code: "wrong_path",
      wrongPath: true,
      remembered: true,
      message
    };
  }
  resetExpectedPairFeedback();
  dismissClearUndo();
  const orbitGeneration = state.orbitGeneration;
  state.busyPairs.add(a.id);
  state.busyPairs.add(b.id);
  playFeedback("combineStart", { word: `${a.item.word}+${b.item.word}` });
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
    } else if (scrambleActive) {
      const duelAction = await scrambleRuntime.submitAction({
        a: a.item.word,
        b: b.item.word
      });
      result = duelAction.result;
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
    if (orbitGeneration !== state.orbitGeneration || !state.game || (state.finished && !scrambleActive)) return null;
    aElement?.classList.remove("combining");
    bElement?.classList.remove("combining");
    aElement?.classList.add("merging");
    bElement?.classList.add("merging");
    await wait(170);
    if (orbitGeneration !== state.orbitGeneration || !state.game || (state.finished && !scrambleActive)) return null;
    state.moves += 1;
    if (state.moves === 1) track("first_combination", { mode: state.mode, training: learningOrbitActive() });
    let known = state.words.find((item) => item.word.toLowerCase() === result.word.toLowerCase());
    const newToRun = !known;
    const locallyKnown = profile.discovered.some((word) => word.toLowerCase() === result.word.toLowerCase());
    const newDiscovery = scrambleActive
      ? false
      : !isStaticBeta && typeof result.newDiscovery === "boolean" ? result.newDiscovery : !locallyKnown;
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
    if (result.scoringDisabled === true || result.scoreEligible === false) {
      state.scoringDisabled = true;
      state.scoreMultiplier = 0;
      state.run = { ...state.run, scoringDisabled: true, scoreEligible: false, scoreMultiplier: 0 };
    }
    const eventAnnotation = scrambleActive
      ? { context: null }
      : annotateCosmicEventResult({ event: currentEventState().event, result });
    const journeyMatch = Boolean(!scrambleActive && state.journeyContext && inventoryKey(state.journeyContext.target) === inventoryKey(result.word));
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
    const won = Boolean(!scrambleActive && (result.completed || (secondOrbitActive() && inventoryKey(result.word) === inventoryKey(state.game.target))));
    const outcomeCommitted = won ? commitGameOutcome() : false;
    if (won && !outcomeCommitted) return null;
    const firstCompletion = Boolean(won && firstOrbitActive() && !sanitizeFirstOrbitState(profile.firstOrbit).completed);
    if (firstCompletion) {
      profile.firstOrbit = { seen: true, completed: true };
      saveProfile({ fields: ["firstOrbit"] });
    }
    const routeRankOutcome = result.routeRankOutcome && typeof result.routeRankOutcome === "object"
      ? result.routeRankOutcome
      : null;
    if (!scrambleActive && (routeRankOutcome?.routeRank || result.routeRank)) {
      applyRouteRank(routeRankOutcome?.routeRank || result.routeRank, { announce: won });
    }
    if (!scrambleActive && routeRankOutcome?.adaptive?.message) {
      state.adaptiveNotice = {
        message: routeRankOutcome.adaptive.message,
        metadata: routeRankOutcome.adaptive.metadata || {}
      };
    }
    if (!scrambleActive && routeRankOutcome?.promotion?.message) {
      state.routeRankNotice = {
        message: routeRankOutcome.promotion.message,
        rankUp: routeRankOutcome.promotion.promoted === true
      };
    }
    const routeProgressBefore = state.routeProgress;
    if (!scrambleActive) {
      acceptRouteProgress(result.routeProgress);
      if (result.remixProgress) state.remixProgress = result.remixProgress;
    }
    const iqContext = scrambleActive
      ? { relevance: "ignored", routeTotal: 0, stepsAdvanced: 0, completed: false }
      : runIqRouteContext(routeProgressBefore, state.routeProgress, {
          completed: won,
          newDiscovery: newToRun
        });
    const iqPairKey = runIqSuccessfulPairKey(a.item.word, b.item.word, result.word);
    iqContext.pairKey = iqPairKey;
    historyStep.runIqKey = iqPairKey;
    historyStep.runIqNewToRun = newToRun;
    historyStep.runIqRelevance = iqContext.relevance;
    historyStep.routeTotal = iqContext.routeTotal;
    historyStep.routeStepsAdvanced = iqContext.stepsAdvanced;
    historyStep.routeCompleted = iqContext.completed;
    state.history.push(historyStep);
    if (!scrambleActive) {
      renderCombinationStory();
      changeRunIq("success", a.item.word, b.item.word, iqContext);
    }
    const mastery = scrambleActive ? null : recordMasteryStep(historyStep);
    const aAnchor = measuredNodeAnchor(a, aElement);
    const bAnchor = measuredNodeAnchor(b, bElement);
    state.nodes = state.nodes.filter((node) => node.id !== a.id && node.id !== b.id);
    aElement?.remove();
    bElement?.remove();
    boardGeometryVersion += 1;
    const resultNode = addNode(known, x, y, { cosmicTwist: Boolean(result.twisted) });
    const resultElement = els.boardItems.querySelector(`[data-id="${resultNode.id}"]`);
    const resultAnchor = measuredNodeAnchor(resultNode, resultElement, measureBoardWord(known));
    state.trails.push({
      ax: aAnchor.x,
      ay: aAnchor.y,
      bx: bAnchor.x,
      by: bAnchor.y,
      x: resultAnchor.x,
      y: resultAnchor.y
    });
    if (state.trails.length > MAX_TRANSIENT_TRAILS) state.trails.splice(0, state.trails.length - MAX_TRANSIENT_TRAILS);
    appendCosmeticFusionBurst(state, resultAnchor.x, resultAnchor.y);
    const authoredGoldenPair = !result.twisted
      ? await playGoldenPairAnimation(a.item, b.item, known)
      : false;
    const celebrationStartedAt = won ? performance.now() : 0;
    resetBoardHistory();
    const universeLabel = result.universeContext?.label ? ` · ${result.universeContext.label}` : "";
    showAlchemy(result.twisted
      ? `✦ COSMIC TWIST · ${a.item.word} + ${b.item.word} found ${result.emoji} ${result.word} instead of ${result.twist.canonicalWord}. Mix them again for ${result.twist.canonicalWord}.`
      : `${a.item.word} + ${b.item.word} = ${result.emoji} ${result.word}${universeLabel}${insight?.text ? ` · ${insight.text}` : ""}`, false, Boolean(result.twisted));
    if (result.completionBlocked && result.remixMessage) {
      queueAlchemyNotice(`TARGET FOUND · ${result.remixMessage}`, true, false, {
        key: `remix:${result.remixMessage}`,
        retain: true,
        maxAge: 10_000
      });
    }
    let eventDiscovery = null;
    if (!scrambleActive && !learningOrbitActive() && state.mode !== "explore") {
      try {
        eventDiscovery = await recordEventDiscovery(result);
      } catch (error) {
        console.warn("Cosmic event progress could not be refreshed.", error);
      }
    }
    if (orbitGeneration !== state.orbitGeneration || !state.game || (state.finished && !outcomeCommitted && !scrambleActive)) return null;
    if (eventDiscovery?.notice) {
      queueAlchemyNotice(eventDiscovery.notice, false, true, { key: `event:${inventoryKey(result.word)}`, retain: true, maxAge: 12_000 });
    }
    if (mastery?.notice) {
      if (result.completed) state.resultMasteryNotice = mastery.notice;
      else queueAlchemyNotice(mastery.notice, false, false, { key: `mastery:${inventoryKey(mastery.notice)}`, retain: true, maxAge: 10_000 });
    }
    playFeedback(result.twisted ? "twist" : "success", {
      analytics: Boolean(result.twisted),
      category: result.category || known.category,
      word: result.word,
      source: result.source,
      newDiscovery
    });
    updateHud();
    if (!scrambleActive) {
      updateMilestone();
      renderAtlas();
    }
    track("combination_completed", { mode: state.mode, a: a.item.word, b: b.item.word, result: result.word, source: result.source, newDiscovery, twisted: Boolean(result.twisted) });
    if (!scrambleActive && !won && !learningOrbitActive() && historyStep.feedbackEligible) offerRecipeFeedback(historyStep, state.moves);
    if (won) finishGame(true, "", {
      firstCompletion,
      outcomeCommitted,
      celebrationStartedAt,
      authoredGoldenPair
    });
    else if (state.game.moveLimit && state.moves >= state.game.moveLimit) setTimeout(() => finishGame(false, moveLimitEndMessage()), 350);
    return { node: resultNode, completed: won };
  } catch (error) {
    if (orbitGeneration !== state.orbitGeneration || !state.game) return null;
    const wrongPath = !scrambleActive && error.code === "wrong_path";
    const memory = wrongPath
      ? rememberPathGuardPair(a.item.word, b.item.word)
      : { pairKey: "", remembered: false };
    const pathGuardMessage = wrongPath
      ? showPathGuardFeedback(a.item.word, b.item.word, {
        remembered: memory.remembered,
        elements: [aElement, bElement]
      })
      : "";
    if (!wrongPath) {
      for (const element of [aElement, bElement]) {
        element?.classList.remove("combining");
        element?.classList.remove("merging");
        element?.classList.add("rejected");
        setTimeout(() => element?.classList.remove("rejected"), 380);
      }
    }
    const nearMiss = !scrambleActive && error.code === "combination_missing" ? explainRecipeNearMiss({
      a: a.item.word,
      b: b.item.word,
      ...(categoryForInsightWord(a.item.word) ? { categoryA: categoryForInsightWord(a.item.word) } : {}),
      ...(categoryForInsightWord(b.item.word) ? { categoryB: categoryForInsightWord(b.item.word) } : {}),
      discovered: state.words,
      recipes: authoredInsightCatalog()
    }) : null;
    if (!wrongPath) showAlchemy(nearMiss?.text || error.message, true);
    if (!scrambleActive && (error.code === "combination_missing" || firstOrbitActive())) {
      renderCombinationStory({ a: a.item.word, b: b.item.word });
    }
    if (!scrambleActive && error.code === "combination_missing" && !learningOrbitActive()) {
      changeRunIq("miss", a.item.word, b.item.word);
      scheduleRunSave();
      offerExpectedPairFeedback(a.item.word, b.item.word);
    }
    if (wrongPath) {
      track("path_guard_blocked", {
        mode: state.mode,
        status: memory.remembered ? "remembered" : "new"
      });
    } else {
      playFeedback("reject", { word: `${a.item.word}+${b.item.word}` });
      track("combination_rejected", { mode: state.mode, a: a.item.word, b: b.item.word });
    }
    if (wrongPath) {
      return {
        rejected: true,
        code: "wrong_path",
        wrongPath: true,
        remembered: memory.remembered,
        message: pathGuardMessage
      };
    }
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
  state.expectedPair = { a: "", b: "", key: "", submitted: false, localSaved: false, timer: null };
  if (els.expectedPairFeedback) {
    els.expectedPairFeedback.hidden = true;
    els.expectedPairButton.disabled = false;
    els.expectedPairResult.value = "";
    els.expectedPairResult.removeAttribute("aria-invalid");
    els.expectedPairButton.textContent = expectedPairDelivery.submitLabel(isStaticBeta);
    els.expectedPairDelivery.textContent = expectedPairDelivery.deliveryMessage(isStaticBeta);
  }
  clearBoardAnnouncement("expected-pair");
}

function offerExpectedPairFeedback(a, b) {
  const key = expectedPairKey(a, b);
  if (state.focusMode || !key || state.expectedPairReports.has(key) || !els.expectedPairFeedback) return;
  resetRecipeFeedback();
  clearBoardNotices();
  state.expectedPair = { a: String(a).slice(0, 48), b: String(b).slice(0, 48), key, submitted: false, localSaved: false, timer: null };
  $("#expectedPairRecipe").textContent = `${state.expectedPair.a} + ${state.expectedPair.b}`;
  els.expectedPairButton.textContent = expectedPairDelivery.submitLabel(isStaticBeta);
  els.expectedPairDelivery.textContent = expectedPairDelivery.deliveryMessage(isStaticBeta);
  els.expectedPairFeedback.hidden = false;
  const action = isStaticBeta && !FEEDBACK_API_URL ? "save an idea on this device" : "send Oxyfel Games an idea";
  announceBoardMessage(`What should ${state.expectedPair.a} plus ${state.expectedPair.b} make? You can ${action}.`, "expected-pair");
}

async function submitExpectedPairFeedback(event) {
  event?.preventDefault?.();
  const report = state.expectedPair;
  if (!report?.key || report.submitted || state.expectedPairReports.has(report.key)) return;
  const expected = sanitizeCombinationSuggestion(els.expectedPairResult.value);
  const reason = "";
  if (expected === null) {
    els.expectedPairResult.setAttribute("aria-invalid", "true");
    els.expectedPairDelivery.textContent = "Use one short thing or idea. Do not enter a link, email, or private information.";
    els.expectedPairResult.focus();
    return;
  }
  els.expectedPairResult.removeAttribute("aria-invalid");
  report.submitted = true;
  els.expectedPairButton.disabled = true;
  els.expectedPairButton.textContent = isStaticBeta && !FEEDBACK_API_URL ? "Saving…" : "Sending…";
  try {
    if (isStaticBeta) {
      report.localSaved = report.localSaved || expectedPairDelivery.saveLocal({ a: report.a, b: report.b, expected: expected || "", reason });
      const payload = expectedPairDelivery.payload({ a: report.a, b: report.b, expected: expected || "", reason });
      if (FEEDBACK_API_URL) {
        const outboxId = expectedPairDelivery.queue(payload);
        try {
          await expectedPairDelivery.post(payload);
          if (outboxId) expectedPairDelivery.remove(outboxId);
          els.expectedPairButton.textContent = "Idea sent";
          els.expectedPairDelivery.textContent = "Sent to Oxyfel Games. Thank you—no sign-in was needed.";
        } catch (error) {
          if (!outboxId) throw error;
          els.expectedPairButton.textContent = "Saved";
          els.expectedPairDelivery.textContent = "Saved safely. The game will send it automatically when the feedback receiver is reachable.";
          expectedPairDelivery.schedule();
        }
      } else {
        if (!report.localSaved) throw new Error("This device did not allow the idea to be saved.");
        els.expectedPairButton.textContent = "Saved";
        els.expectedPairDelivery.textContent = "Saved on this device. Direct sending is not connected in this build.";
      }
    } else {
      await fetchJson("/api/combination-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          a: report.a,
          b: report.b,
          expected: expected || "",
          reason,
          mode: String(state.mode || "reach").slice(0, 24),
          reporterId: analyticsCohortId || sessionId
        })
      });
      els.expectedPairButton.textContent = "Idea sent";
      els.expectedPairDelivery.textContent = "Sent to Oxyfel Games for recipe review. Thank you!";
    }
    state.expectedPairReports.add(report.key);
    announceBoardMessage(`${FEEDBACK_API_URL || !isStaticBeta ? "Suggestion recorded" : "Suggestion saved"} for ${report.a} plus ${report.b}. Thank you.`, "expected-pair");
  } catch {
    report.submitted = false;
    els.expectedPairButton.disabled = false;
    els.expectedPairButton.textContent = "Try again";
    els.expectedPairDelivery.textContent = FEEDBACK_API_URL
      ? "The idea was not sent or queued. Check your connection or storage settings and try again."
      : "The idea could not be saved on this device. Check your storage settings and try again.";
  }
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
  if (state.focusMode) return;
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
    completedSteps: keepConstellation ? previous.completedSteps || [] : [],
    layout: keepConstellation ? previous.layout || null : null,
    cameraY: keepConstellation ? previous.cameraY || 0 : 0,
    pausedAt: 0,
    visual: null,
    wake: null
  };
  const revealNodes = state.nodes.filter((node) => node.revealRole);
  if (revealNodes.length) {
    state.nodes = state.nodes.filter((node) => !node.revealRole);
    renderBoard();
  }
  if (els.revealController) els.revealController.hidden = true;
  els.revealController?.classList.remove("is-paused", "is-complete");
  els.board?.classList.remove("reveal-active", "reveal-summoning", "reveal-merging", "reveal-resulting", "reveal-paused");
  for (const attribute of ["data-reveal-node-count", "data-reveal-edge-count", "data-reveal-active-paths", "data-reveal-completed-paths", "data-reveal-phase", "data-reveal-camera-y", "data-reveal-content-height", "data-reveal-compact"]) {
    els.board?.removeAttribute(attribute);
  }
  if (els.revealEquation) {
    els.revealEquation.hidden = true;
    els.revealEquation.dataset.phase = "summon";
  }
  els.revealDialog?.classList.remove("is-pending");
  $$('[data-close="revealDialog"]').forEach((button) => { button.disabled = false; });
  const confirm = $("#confirmReveal");
  if (confirm) {
    confirm.disabled = false;
    confirm.querySelector("span").textContent = "Show answer";
  }
  if (!keepConstellation) els.board?.classList.remove("reveal-complete");
}

function openRevealPath() {
  if (!state.game || !state.run || state.startingRun || state.reveal.revealed || state.reveal.active || state.reveal.pending) return;
  if (state.busyPairs.size) return showToast("Wait for the words to finish combining.");
  ctrlHover.reset();
  shiftBoard.reset();
  stopTimer();
  $("#revealTitle").textContent = `Show the answer for ${state.game.target}?`;
  const warnings = {
    daily: "You will get no points for today’s word.",
    quick: "You will get no points for this timed game.",
    moves: "You will get no points for this limited-moves game.",
    weekly: "You will get no points or progress for this game."
  };
  $("#revealModeWarning").textContent = state.scoringDisabled
    ? "You can watch the answer once."
    : warnings[state.mode] || "You will get no points for this game.";
  els.revealDialog.showModal();
}

async function confirmRevealPath() {
  if (!state.game || !state.run || state.reveal.active || state.reveal.pending) return;
  if (state.busyPairs.size) return showToast("Wait for the words to finish combining.");
  const revealState = state.reveal;
  const runId = state.run.id;
  const runToken = state.run.token;
  const mode = state.mode;
  const target = state.game.target;
  const button = $("#confirmReveal");
  const label = button.querySelector("span");
  const dismissers = $$('[data-close="revealDialog"]');
  let pendingUiCleared = false;
  let playbackCommitted = false;
  const clearPendingUi = () => {
    revealState.pending = false;
    button.disabled = false;
    dismissers.forEach((control) => { control.disabled = false; });
    els.revealDialog.classList.remove("is-pending");
    label.textContent = "Show answer";
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
    if (payload.routeRankOutcome?.routeRank || payload.routeRank) {
      applyRouteRank(payload.routeRankOutcome?.routeRank || payload.routeRank, { announce: true });
    }
    if (payload.routeRankOutcome?.promotion?.message) {
      state.routeRankNotice = {
        message: payload.routeRankOutcome.promotion.message,
        rankUp: payload.routeRankOutcome.promotion.promoted === true
      };
    }
    state.assist = "reveal";
    state.scoringDisabled = true;
    state.scoreMultiplier = 0;
    state.run = { ...state.run, assist: "reveal", ranked: false, scoreEligible: false, scoreMultiplier: 0, leaderboardEligible: false, assisted: true, division: "study" };
    state.runPersistence = null;
    clearActiveRunSnapshot();
    stopTimer();
    if (mode === "daily") {
      profile.dailyCompleted = todayKey;
      saveProfile({ fields: ["progression"] });
    }
    const route = Array.isArray(payload.route) ? payload.route : [];
    playbackCommitted = true;
    if (els.resultDialog.open) els.resultDialog.close();
    if (els.revealDialog.open) els.revealDialog.close();
    clearPendingUi();
    track("answer_revealed", { mode, target, steps: route.length });
    await playRevealPath(route);
  } catch (error) {
    if (state.reveal === revealState && state.run?.id === runId) showToast(error.message);
    if (playbackCommitted && state.reveal === revealState && state.run?.id === runId && !els.resultDialog.open) returnHome();
  } finally {
    if (!pendingUiCleared && state.reveal === revealState) clearPendingUi();
  }
}

function buildRevealLayout(route) {
  const rect = els.board.getBoundingClientRect();
  return buildRevealTree(route, {
    width: rect.width,
    height: rect.height,
    compact: rect.width < 760
  });
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

function clearRevealStage() {
  state.nodes = [];
  renderBoard();
}

function revealTreeNode(key, layout = state.reveal.layout) {
  return layout?.nodeByKey?.[revealWordKey(key)] || null;
}

function revealBoardNode(key) {
  const normalized = revealWordKey(key);
  return state.nodes.find((node) => node.revealKey === normalized) || null;
}

function syncRevealBoardNode(node) {
  const element = els.boardItems.querySelector(`[data-id="${CSS.escape(String(node.id))}"]`);
  if (element) syncBoardNodeElement(element, node);
}

function applyRevealCamera(cameraY = state.reveal.cameraY) {
  const layout = state.reveal.layout;
  if (!layout) return;
  state.reveal.cameraY = clamp(
    Number(cameraY) || 0,
    0,
    Number(layout.bounds?.maxCameraY) || 0
  );
  for (const node of state.nodes.filter((entry) => entry.revealKey)) {
    const graphNode = revealTreeNode(node.revealKey, layout);
    if (!graphNode) continue;
    node.x = graphNode.x;
    node.y = graphNode.y - state.reveal.cameraY;
    node.revealWidth = graphNode.width;
    node.revealHeight = graphNode.height;
    syncRevealBoardNode(node);
  }
  els.board.dataset.revealCameraY = String(Math.round(state.reveal.cameraY));
  els.board.dataset.revealContentHeight = String(Math.round(layout.bounds?.contentHeight || layout.bounds?.height || 0));
  els.board.dataset.revealCompact = String(layout.bounds?.compact === true);
  boardGeometryVersion += 1;
}

function focusRevealBatch(batch, phase = "result") {
  applyRevealCamera(revealCameraForBatch(batch, state.reveal.layout, phase));
}

function refreshRevealLayoutForViewport() {
  if (!state.reveal.revealed || !state.reveal.route.length) return false;
  const previousVisual = state.reveal.visual;
  const layout = buildRevealLayout(state.reveal.route);
  state.reveal.layout = layout;
  if (previousVisual) {
    previousVisual.layout = layout;
    previousVisual.steps = previousVisual.steps
      .map((step) => layout.steps.find((candidate) => candidate.index === step.index))
      .filter(Boolean);
  }
  const activeIndices = new Set(previousVisual?.activeStepIndices || []);
  const batch = layout.batches.find((candidate) =>
    candidate.steps.some((step) => activeIndices.has(step.index))
  ) || layout.batches.at(-1);
  applyRevealCamera(revealCameraForBatch(batch, layout, previousVisual?.phase || "result"));
  return true;
}

function setRevealNodeRole(node, role) {
  if (!node || node.revealRole === role) return node;
  node.revealRole = role;
  node.z = ++state.topZ;
  syncRevealBoardNode(node);
  return node;
}

function ensureRevealTreeNode(key, role = "past") {
  const graphNode = revealTreeNode(key);
  if (!graphNode) return null;
  const existing = revealBoardNode(graphNode.key);
  if (existing) return setRevealNodeRole(existing, role);
  const item = revealItem(graphNode.word, {
    emoji: graphNode.emoji,
    category: graphNode.category
  });
  return addNode(item, graphNode.x, graphNode.y - state.reveal.cameraY, {
    revealRole: role,
    revealKey: graphNode.key,
    revealWave: graphNode.depth,
    revealWidth: graphNode.width,
    revealHeight: graphNode.height,
    size: { width: graphNode.width, height: graphNode.height },
    inset: 2,
    allowOutOfBounds: true
  });
}

function stageRevealBatch(batch, phase) {
  focusRevealBatch(batch, phase);
  const { sourceKeys, resultKeys } = revealBatchKeys(batch);
  for (const node of state.nodes.filter((entry) => entry.revealRole)) setRevealNodeRole(node, "past");
  for (const key of sourceKeys) ensureRevealTreeNode(key, "source");
  if (phase === "result" || phase === "complete") {
    for (const key of resultKeys) {
      ensureRevealTreeNode(
        key,
        key === state.reveal.layout?.targetKey ? "target" : "result"
      );
    }
  }
}

function materializeRevealTree({ targetBright = true } = {}) {
  const layout = state.reveal.layout;
  if (!layout) return;
  for (const graphNode of layout.nodes) {
    ensureRevealTreeNode(
      graphNode.key,
      targetBright && graphNode.key === layout.targetKey ? "target" : "past"
    );
  }
}

function setRevealPresentation(batch, batchIndex, phase) {
  const steps = Array.isArray(batch?.steps) ? batch.steps : [];
  const step = steps[0];
  if (!step || !els.revealEquation) return;
  const total = state.reveal.route.length;
  const left = revealItem(step.a);
  const right = revealItem(step.b);
  const result = revealItem(step.word, { emoji: step.emoji });
  const completedNow = Math.min(total, state.reveal.completedSteps.length);
  state.reveal.visual = renderRevealPresentation({
    batch,
    batchIndex,
    phase,
    total,
    completedNow,
    target: state.game.target,
    layout: state.reveal.layout,
    left,
    right,
    result,
    elements: els
  });
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) startCosmos();
}

function recordRevealStep(step, result, replay) {
  if (replay) return;
  state.moves += 1;
  state.history.push({
    a: step.a,
    b: step.b,
    word: step.word,
    emoji: result.emoji,
    source: "reveal",
    newDiscovery: false,
    revealed: true
  });
}

function completeRevealRouteImmediately(route, replay) {
  const completed = new Set(state.reveal.completedSteps);
  for (let index = 0; index < route.length; index += 1) {
    if (completed.has(index)) continue;
    const step = route[index];
    const result = addRevealDiscovery(step);
    recordRevealStep(step, result, replay);
  }
  state.reveal.completed = route.length;
  state.reveal.completedSteps = route.map((_, index) => index);
  materializeRevealTree();
  const finalBatch = state.reveal.layout?.batches?.at(-1);
  if (finalBatch) {
    stageRevealBatch(finalBatch, "complete");
    materializeRevealTree();
    setRevealPresentation(finalBatch, finalBatch.index, "complete");
  } else {
    clearRevealStage();
    const rect = els.board.getBoundingClientRect();
    const geometry = revealStageGeometry(rect);
    const target = revealItem(state.game.target, { emoji: state.game.emoji });
    addNode(target, geometry.targetX, geometry.targetY, { revealRole: "target" });
    if (els.revealEquation) els.revealEquation.hidden = true;
  }
  if (!replay) {
    updateHud();
    updateMilestone(true);
    renderAtlas();
  }
  updateRevealController(route.length);
  playFeedback("success", { category: route.at(-1)?.category, word: route.at(-1)?.word });
}

function wakeRevealPlayback() {
  const wake = state.reveal.wake;
  state.reveal.wake = null;
  wake?.();
}

async function revealDelay(milliseconds, generation) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let remaining = state.reveal.skip ? 0 : reduced ? Math.min(300, milliseconds) : milliseconds;
  let previousTime = performance.now();
  while (remaining > 0) {
    if (generation !== state.reveal.generation || !state.reveal.active) return false;
    if (state.reveal.paused || document.hidden) {
      await new Promise((resolve) => { state.reveal.wake = resolve; });
      previousTime = performance.now();
      continue;
    }
    const slice = Math.min(50, remaining / Math.max(.5, state.reveal.speed));
    await wait(slice);
    const now = performance.now();
    remaining -= Math.max(0, now - previousTime) * state.reveal.speed;
    previousTime = now;
    if (state.reveal.skip) remaining = 0;
  }
  return generation === state.reveal.generation && state.reveal.active;
}

function updateRevealController(completedCount = state.reveal.completedSteps.length, batch = null, { resolved = false } = {}) {
  renderRevealController({
    completedCount,
    batch,
    resolved,
    total: state.reveal.route.length,
    replaying: state.reveal.replaying,
    paused: state.reveal.paused,
    elements: els
  });
}

function announceRevealBatchResult(batch) {
  const message = revealBatchAnnouncement(
    batch,
    state.reveal.completedSteps.length,
    state.reveal.route.length
  );
  if (message) els.revealAnnouncement.textContent = message;
}

async function playRevealPath(route, { replay = false } = {}) {
  const generation = state.reveal.generation + 1;
  const runId = state.run?.id;
  const layout = buildRevealLayout(route);
  ctrlHover.reset({ abandonPending: true });
  shiftBoard.reset();
  resetRecipeFeedback();
  clearBoardNotices();
  if (!replay) state.finished = false;
  state.nodes = [];
  resetBoardHistory();
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
    completedSteps: [],
    layout,
    cameraY: 0,
    pausedAt: 0,
    visual: null,
    wake: null
  };
  els.board.classList.add("reveal-active");
  els.board.classList.remove("reveal-complete", "reveal-paused", "reveal-summoning", "reveal-merging", "reveal-resulting");
  els.revealController.hidden = false;
  els.revealController.classList.remove("is-paused", "is-complete");
  if (els.revealEquation) els.revealEquation.hidden = true;
  els.revealPause.textContent = "Pause";
  els.revealPause.setAttribute("aria-pressed", "false");
  els.revealSpeed.textContent = "1×";
  els.revealSkip.hidden = false;
  renderInventory();
  renderBoard();
  updateHud();
  updateRevealController(0, layout.batches[0] || null);
  startCosmos();

  if (!route.length) {
    const target = revealItem(state.game.target, { emoji: state.game.emoji });
    const rect = els.board.getBoundingClientRect();
    const geometry = revealStageGeometry(rect);
    addNode(target, geometry.targetX, geometry.targetY, { revealRole: "target" });
  }

  let skippedToEnd = false;
  revealSteps:
  for (const batch of layout.batches) {
    if (generation !== state.reveal.generation) return;
    if (state.reveal.skip) {
      completeRevealRouteImmediately(route, replay);
      skippedToEnd = true;
      break;
    }
    const completedBefore = state.reveal.completedSteps.length;
    stageRevealBatch(batch, "summon");
    setRevealPresentation(batch, batch.index, "summon");
    updateRevealController(completedBefore, batch);
    if (!await revealDelay(680, generation)) return;
    if (state.reveal.skip) {
      completeRevealRouteImmediately(route, replay);
      skippedToEnd = true;
      break revealSteps;
    }
    setRevealPresentation(batch, batch.index, "merge");
    const { sourceKeys } = revealBatchKeys(batch);
    for (const key of sourceKeys) {
      const source = revealBoardNode(key);
      const element = source && els.boardItems.querySelector(`[data-id="${CSS.escape(String(source.id))}"]`);
      element?.classList.add("merging");
    }
    if (!await revealDelay(620, generation)) return;
    if (state.reveal.skip) {
      completeRevealRouteImmediately(route, replay);
      skippedToEnd = true;
      break revealSteps;
    }
    if (!await revealDelay(180, generation)) return;
    if (state.reveal.skip) {
      completeRevealRouteImmediately(route, replay);
      skippedToEnd = true;
      break revealSteps;
    }
    for (const step of batch.steps) {
      const result = addRevealDiscovery(step);
      recordRevealStep(step, result, replay);
      if (!state.reveal.completedSteps.includes(step.index)) state.reveal.completedSteps.push(step.index);
    }
    state.reveal.completed = state.reveal.completedSteps.length;
    stageRevealBatch(batch, "result");
    setRevealPresentation(batch, batch.index, "result");
    if (!replay) {
      updateHud();
      updateMilestone(state.reveal.completed === route.length);
      renderAtlas();
    }
    updateRevealController(completedBefore, batch, { resolved: true });
    announceRevealBatchResult(batch);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) startCosmos();
    playFeedback("success", { category: batch.steps.at(-1)?.category, word: batch.steps.at(-1)?.word });
    if (!await revealDelay(state.reveal.completed === route.length ? 1350 : 1050, generation)) return;
  }

  if (generation !== state.reveal.generation) return;
  if (route.length && !skippedToEnd) {
    const finalBatch = layout.batches.at(-1);
    materializeRevealTree();
    setRevealPresentation(finalBatch, finalBatch.index, "complete");
  }
  state.reveal.active = false;
  state.reveal.completed = route.length;
  els.board.classList.remove("reveal-active", "reveal-summoning", "reveal-merging", "reveal-resulting", "reveal-paused");
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
  } catch (error) {
    showToast(error?.message || "The answer replay could not finish.");
    if (state.reveal === revealState && state.game && !els.resultDialog.open) returnHome();
  } finally {
    resultActions.forEach((control) => { control.disabled = false; });
  }
}

function toggleRevealPause() {
  if (!state.reveal.active) return;
  const now = performance.now();
  const wasPaused = state.reveal.paused;
  state.reveal.paused = !wasPaused;
  if (state.reveal.paused) {
    state.reveal.pausedAt = now;
  } else {
    if (state.reveal.visual && state.reveal.pausedAt) {
      state.reveal.visual.startedAt = state.reveal.visual.startedAt
        + Math.max(0, now - state.reveal.pausedAt);
    }
    state.reveal.pausedAt = 0;
  }
  els.revealPause.textContent = state.reveal.paused ? "Resume" : "Pause";
  els.revealPause.setAttribute("aria-pressed", String(state.reveal.paused));
  els.revealController.classList.toggle("is-paused", state.reveal.paused);
  els.board.classList.toggle("reveal-paused", state.reveal.paused);
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
  state.reveal.pausedAt = 0;
  els.revealPause.textContent = "Pause";
  els.revealPause.setAttribute("aria-pressed", "false");
  els.revealController.classList.remove("is-paused");
  els.board.classList.remove("reveal-paused");
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
    ? `${grade.metrics.uniqueResults} results · ${grade.metrics.categories} ideas${result.awaitingVerification ? " · checking score" : comparison.improved ? " · new best" : ""}`
    : "Study route · no score";
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
  const shouldShow = !isStaticBeta && phase !== "hidden" && eligible && state.run?.ranked;
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

function waitForPaints(count = 1) {
  const total = Math.max(1, Math.floor(Number(count) || 1));
  if (document.hidden || typeof requestAnimationFrame !== "function") return wait(0);
  return new Promise((resolve) => {
    let remaining = total;
    const paint = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(paint);
    };
    requestAnimationFrame(paint);
  });
}

function resultPresentationIsCurrent({ generation, game, runId }, { dialogMayBeOpen = false } = {}) {
  return Boolean(
    state.finished
    && state.orbitGeneration === generation
    && state.game === game
    && String(state.run?.id || "") === runId
    && (dialogMayBeOpen || !els.resultDialog.open)
  );
}

async function presentResultAfterCelebration({
  won,
  revealed,
  authoredGoldenPair,
  celebrationStartedAt,
  gate,
  audio
}) {
  const snapshot = {
    generation: state.orbitGeneration,
    game: state.game,
    runId: String(state.run?.id || "")
  };
  await waitForPaints(2);
  if (!resultPresentationIsCurrent(snapshot)) return false;

  if (won) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fullHold = victoryHandoffHoldMs({
      won: true,
      revealed: revealed === true,
      authoredGoldenPair: authoredGoldenPair === true,
      reducedMotion: reduced
    });
    const elapsed = celebrationStartedAt > 0
      ? Math.max(0, performance.now() - celebrationStartedAt)
      : 0;
    const remaining = Math.max(0, fullHold - elapsed);
    if (remaining > 0) await wait(remaining);
    await waitForPaints(1);
    if (!resultPresentationIsCurrent(snapshot)) return false;
  }

  gameAudio.setScene("result");
  const shown = await cosmicGate.presentDialog(els.resultDialog, gate);
  if (!shown || !resultPresentationIsCurrent(snapshot, { dialogMayBeOpen: true })) return shown;
  gameAudio.playResult(audio);
  return true;
}

function finishGame(won, reason = "", {
  skipSubmit = false,
  firstCompletion = false,
  outcomeCommitted = false,
  celebrationStartedAt = 0,
  authoredGoldenPair = false
} = {}) {
  if (state.finished && !outcomeCommitted) return;
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
  renderHintObjective();
  resetBoardHistory();
  syncFirstOrbitGuide();
  stopTimer();
  stopRivalGhost({ completed: won });
  const firstTraining = firstOrbitActive();
  const secondTraining = secondOrbitActive();
  const training = firstTraining || secondTraining;
  const firstEverCompletion = Boolean(won && firstTraining && (firstCompletion || !sanitizeFirstOrbitState(profile.firstOrbit).completed));
  if (won && !state.reveal.revealed) playFeedback("target", { analytics: true, category: state.game?.category || "celestial", word: state.game?.target });
  updateMilestone(won);
  const elapsed = state.finishedElapsedSeconds || Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  state.finishedElapsedSeconds = elapsed;
  const practiceReplay = state.game?.practiceReplay === true;
  const assisted = Boolean(training || state.scoringDisabled || state.assist === "reveal");
  const partialAssist = !assisted && state.scoreMultiplier < 1;
  const revealed = assisted && state.reveal.revealed;
  const flawlessAdaptiveCompletion = Boolean(
    won
    && !assisted
    && !partialAssist
    && state.assist === "none"
    && state.runIq.value === 200
    && state.runIq.misses === 0
  );
  const adaptiveOutcome = revealed
    ? "reveal"
    : won
      ? "completed"
      : /time/i.test(reason)
        ? "timeout"
        : "failed";
  if (!won && !revealed) playFeedback(adaptiveOutcome === "timeout" ? "timeout" : "failure");
  recordAdaptiveOutcome(adaptiveOutcome, { flawless: flawlessAdaptiveCompletion });
  if (!won && !revealed && !isStaticBeta) {
    void queueRunForfeit(state.run, state.game, { announce: true });
  }
  buildSignatureResult(won, { training, revealed });
  const pendingRankedSubmit = Boolean(won && !assisted && !skipSubmit && state.run?.ranked)
    && state.run?.localOnly !== true
    && state.runPersistence?.clientOnly !== true;
  if (pendingRankedSubmit) {
    const saved = saveCompletedRunSnapshot();
    state.scoreSubmission = { runId: state.run.id, ...saved, inFlight: false, exitAction: null, exitLabel: "" };
  }
  else {
    state.scoreSubmission = { runId: "", activeSaved: false, pendingSaved: false, inFlight: false, exitAction: null, exitLabel: "" };
    state.runPersistence = null;
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
    : practiceReplay
      ? "Practice replay keeps the exact target, opening, and rules. It grants no rank, rewards, or progression."
    : revealed
      ? "One visual replay is available. It returns to mode selection and grants no progression."
      : "This Study orbit grants no score, leaderboard place, rewards, or progression.";
  $("#resultReveal").hidden = won || assisted || !state.run;
  if (won && !assisted && !progressionAlreadyGranted) {
    reward = calculateReward();
    if (state.mode === "daily") {
      updateDailyStreak();
      state.resultAction = () => void beginMode("reach");
    }
    if (state.mode === "weekly") {
      profile.weekly.stage += 1;
      if (profile.weekly.stage >= 3) {
        profile.weekly.stage = 3;
        profile.weekly.complete = true;
        profile.streakShields += 1;
        reward.reward += 150;
        reward.reason += " · expedition complete";
        state.resultAction = () => void beginMode("reach");
      } else {
        state.resultAction = () => void beginMode("weekly");
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
      state.resultAction = () => void startSecondOrbit({ enterThroughGate: true });
    } else {
      profile.secondOrbit = { seen: true, completed: true };
      saveProfile({ cloud: false });
      track("second_orbit_completed", { moves: state.moves, seconds: elapsed });
      if (startupScrambleInviteCode) {
        state.resultAction = () => {
          returnHome({ skipForfeit: true });
          requestAnimationFrame(() => void openScramble({
            trigger: $("#scrambleHomeButton"),
            invite: startupScrambleInviteCode
          }));
        };
      } else {
        const nextMode = homeMenuState().dailyAvailable ? "daily" : "reach";
        state.resultAction = () => void beginMode(nextMode);
      }
    }
  } else if (won && revealed) {
    state.resultAction = replayRevealPathOnce;
  }
  els.resultEmoji.textContent = won ? state.game.emoji : state.mode === "quick" ? "⌛" : "◇";
  els.resultKicker.textContent = practiceReplay
    ? "PRACTICE REPLAY - NO RANK OR REWARDS"
    : training && won
    ? firstTraining ? "FIRST DISCOVERY · COMPLETE" : "SECOND ORBIT COMPLETE · TRAINING"
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
    ? firstTraining ? "Your first discovery: Mud!" : "You made Mountain!"
    : revealed ? `Answer for ${state.game.target}` : won ? `You made ${state.game.target}!` : reason;
  const timeStat = state.game.timeLimit || state.mode === "challenge" ? ` · ${formatTime(elapsed)}` : "";
  const runIqStat = !state.focusMode && !revealed && runIqApplies(state.mode, state.game.target, {
    scoreEligible: !state.scoringDisabled,
    study: assisted
  }) ? ` · ${state.runIq.value} Run IQ` : "";
  els.resultStats.textContent = training
    ? firstTraining ? `One combination · ${formatTime(elapsed)}` : `${state.history.length} combinations · ${formatTime(elapsed)}`
    : revealed
    ? `${state.reveal.route.length} combinations · No points`
    : `${state.newDiscoveries} words found · ${state.moves} moves${timeStat}${runIqStat}${partialAssist ? ` · ${Math.round(state.scoreMultiplier * 100)}% points` : ""}`;
  const routeResultNotice = state.routeRankNotice?.message
    ? state.routeRankNotice
    : null;
  els.resultAdaptiveNote.hidden = !routeResultNotice?.message;
  els.resultAdaptiveNote.textContent = routeResultNotice?.message || "";
  els.resultAdaptiveNote.classList.toggle(
    "is-surge-perfect",
    state.routeRankNotice?.rankUp === true
  );
  renderResultRemixes(won, revealed);
  els.resultMasteryCard.hidden = !won || !state.resultMasteryNotice;
  els.resultMasteryText.textContent = won ? state.resultMasteryNotice : "";
  renderSignatureResult();
  const communityUploadExpected = Boolean(pendingRankedSubmit && !isStaticBeta);
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
      ? "Next game"
      : homeMenuState().dailyAvailable ? "Play today’s word" : "Begin Bronze route"
    : revealed ? "Watch answer once"
    : won && state.journeyContext?.kind === "voyage" && voyageProgressAdvanced ? "Continue story"
    : won && state.journeyContext?.kind === "event" ? "View event"
    : won && ["daily", "weekly"].includes(state.mode) ? "Play next level"
    : "Main menu";
  const adaptiveSeries = adaptiveSeriesEligible();
  const easierNext = adaptiveSeries && (!won || revealed);
  if (easierNext) state.recoveryTarget = state.game.target;
  els.resultRetry.dataset.interludeWin = won && !assisted && !partialAssist && !progressionAlreadyGranted && adaptiveRunEligible() ? profile.wins : "";
  els.resultRetry.hidden = training || (revealed ? false : (assisted && !practiceReplay) || (won && (state.mode === "daily" || state.mode === "weekly")));
  els.resultRetry.textContent = easierNext ? "Try a fresh challenge"
    : revealed ? "Main menu"
      : adaptiveSeries ? "Next challenge"
        : won ? "Play again" : "Try again";
  const resultCanReplayTarget = adaptiveSeries
    && !training
    && !revealed
    && (!assisted || practiceReplay)
    && !state.journeyContext;
  els.resultReplay.hidden = !resultCanReplayTarget;
  els.resultReplay.textContent = won ? "Restart challenge" : "Try this challenge again";
  els.resultRetry.classList.toggle("primary-action", !els.resultRetry.hidden && (!revealed || easierNext));
  els.resultRetry.classList.toggle("secondary-action", !els.resultRetry.hidden && revealed && !easierNext);
  els.resultPrimary.classList.toggle("primary-action", els.resultRetry.hidden || (revealed && !easierNext));
  els.resultPrimary.classList.remove("secondary-action");
  els.resultPrimary.classList.toggle("quiet-action", !els.resultRetry.hidden && (!revealed || easierNext));
  els.resultShare.hidden = !won || training || !homeMenuState().sharingReady;
  const openRun = !assisted && (state.assist !== "none" || state.wished);
  els.resultShare.querySelector("span").textContent = assisted ? "Share Study card" : openRun ? "Share Open card" : "Challenge a friend";
  renderResultRoute();
  $("#resultDetails").hidden = !sanitizeFeedbackPreferences(profile.feedbackPreferences).resultDetails;
  $("#resultDetails").open = false;
  els.resultDialog.classList.toggle("focus-result", state.focusMode);
  if (firstEverCompletion) {
    announceBoardMessage(`First constellation complete. You made ${state.game.target}.`, "first-discovery");
  }
  void presentResultAfterCelebration({
    won,
    revealed,
    authoredGoldenPair,
    celebrationStartedAt,
    gate: {
      kind: won ? "victory" : "result",
      label: won ? `${state.game.target} discovered` : "Game complete",
      focus: ".primary-action:not([hidden]):not(:disabled)",
      celebration: firstEverCompletion
        ? { kind: "first-orbit", word: state.game.target, emoji: state.game.emoji }
        : null
    },
    audio: {
      reward: (reward?.reward || 0) > 0,
      unlock: Boolean(state.eventRewardGranted || voyageProgressAdvanced || state.resultMasteryNotice.includes("collection complete")),
      rankUp: state.routeRankNotice?.rankUp === true
    }
  });
  if (pendingRankedSubmit) submitRankedScore();
  track(won ? "target_reached" : "run_failed", { mode: state.mode, target: state.game.target, moves: state.moves, seconds: elapsed, wished: state.wished, reward: reward?.reward || 0, assisted, revealed, scoreMultiplier: state.scoreMultiplier });
}

async function submitRankedScore() {
  const card = $("#rankResultCard");
  if (state.scoringDisabled || state.assist === "reveal") {
    card.hidden = true;
    return;
  }
  if (
    state.run?.ranked !== true
    || state.run?.localOnly === true
    || state.runPersistence?.clientOnly === true
  ) {
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
    els.resultReplay.hidden = true;
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
    els.resultPrimary.querySelector("span").textContent = retryExitLabel || "Home";
    state.resultAction = retryExitAction || returnHome;
    els.resultPrimary.disabled = false;
    els.resultRetry.hidden = state.mode === "daily" || state.mode === "weekly";
    els.resultRetry.disabled = false;
    const resultCanReplayTarget = adaptiveSeriesEligible() && !state.journeyContext;
    els.resultReplay.hidden = !resultCanReplayTarget;
    els.resultReplay.disabled = false;
    state.leaderboardDivision = result.placement.entry.division;
    state.leaderboardScope = submission.mode === "daily" ? "daily" : submission.mode === "weekly" ? "weekly" : "sprint";
    $("#resultDivision").textContent = `${result.placement.entry.division.toUpperCase()} - SERVER VERIFIED`;
    $("#resultRank").textContent = `#${result.placement.rank}`;
    $("#resultScore").textContent = Number(result.placement.entry.score).toLocaleString();
    if (verifiedAdoption?.updatedCurrent || (!verifiedAdoption && adoptVerifiedSignature(result.placement.entry.signature))) renderSignatureResult();
    renderCommunityResult(result.placement.community || null);
    track("community_viewed", { source: "community", completedRoutes: result.placement.community?.completedRoutes || 0, topPercent: result.placement.community?.player?.topPercent || 0 });
    const totalCredits = Number(result.creditReward || 0) + Number(result.weeklyBonus || 0);
    if (totalCredits > 0) gameAudio.queueProgression("reward", 120);
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
    acceptRouteProgress(item.routeProgress);
    applyServerPlayer(item.player);
    renderInventory();
    updateHud();
    updateMilestone();
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
    acceptRouteProgress(result.routeProgress);
    renderInventory();
    updateHud();
    updateMilestone();
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
  if (state.game?.timeLimit && !cosmeticWorldPreviewActive() && !state.finished && !state.startingRun && !state.pause.active && !state.reveal.active && !state.reveal.pending && !cosmicGate.isActive() && !els.gameScreen.hidden && !els.missionBriefingDialog.open && !els.pauseDialog.open && !els.journeyDialog.open && !els.paywallDialog.open && !els.wishDialog.open && !els.atlasDialog.open && !els.senseDialog.open && !els.shareDialog.open && !els.profileDialog.open && !els.exchangeDialog.open && !els.marketBuyDialog.open && !els.leaderboardDialog.open && !els.revealDialog.open && !els.developerLoginDialog.open && !els.developerDialog.open && !els.developerVfxDialog.open && !$("#recoveryDialog").open) startTimer();
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

async function openProfile() {
  stopTimer();
  await prepareProfileRankSurface();
  renderProfile();
  els.profileDialog.querySelectorAll(".profile-disclosure[open]").forEach((section) => { section.open = false; });
  els.profileDialog.showModal();
}

function startCosmos() {
  startCosmosCanvas({
    state,
    gameScreen: els.gameScreen,
    board: els.board,
    canvas: els.cosmosCanvas,
    cosmeticLoadout: cosmeticsObservatoryHost?.getPreviewLoadout?.() || profile.cosmetics,
    drawRevealGraph
  });
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
    tone: options.tone === "wrong-path" ? "wrong-path" : "",
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
  els.alchemyNote.classList.toggle("wrong-path", notice.tone === "wrong-path");
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
  els.alchemyNote.classList.remove("show", "error", "twist", "wrong-path");
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
  const developerToolsRequested = new URLSearchParams(window.location.search).get("devtools") === "1";
  $("#developerMenuButton").hidden = !developerToolsRequested;
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
  if (!hub || !homeMenuState().exploreReady) {
    showToast("Explore unlocks at Silver Route Rank after three completed games.", { scope: "global" });
    return false;
  }
  const creator = hub.querySelector(".custom-target-disclosure");
  if (creator) creator.open = true;
  hub.classList.add("launch-intent");
  requestAnimationFrame(() => {
    hub.querySelector(".custom-target-disclosure > summary")?.focus({ preventScroll: true });
    hub.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  setTimeout(() => hub.classList.remove("launch-intent"), 2400);
  return true;
}

async function handleLaunchIntent(params) {
  const mode = String(params.get("mode") || "").toLowerCase();
  if (mode === "daily") {
    if (!homeMenuState().dailyReady) {
      showToast("Today’s Word unlocks after your first scored Bronze win.", { scope: "global" });
      return false;
    }
    if (profile.dailyCompleted === todayKey) {
      if (focusExploreLaunch()) {
        showToast("Today’s shared word is complete. Explore another guaranteed route.", { scope: "global" });
      }
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
function wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }

$$('[data-mode]').forEach((button) => button.addEventListener("click", () => beginMode(button.dataset.mode)));
$("#primaryOrbitButton").addEventListener("click", beginPrimaryOrbit);
$("#primaryOrbitSecondary").addEventListener("click", beginPrimarySecondary);
$("#hubMenuButton").addEventListener("click", openHubMenu);
[$("#scrambleHomeButton"), $("#scrambleMenuButton")].forEach((button) => {
  button?.addEventListener("click", () => void openScramble({ trigger: button }));
});
$("#developerMenuButton").addEventListener("click", openDeveloperAccess);
$("#customTargetForm").addEventListener("submit", beginCustomTarget);
$("#beginMission").addEventListener("click", confirmMissionBriefing);
$("#cancelMission").addEventListener("click", cancelMissionBriefing);
$("#pauseRunButton").addEventListener("click", openPauseMenu);
$("#resumePausedRun").addEventListener("click", closePauseMenu);
$("#cancelPauseAction").addEventListener("click", () => resetPauseConfirmation({ focus: true }));
$("#pauseRestart").addEventListener("click", async () => {
  if (!confirmPauseRestart()) return;
  const priorRun = state.run;
  const priorGame = state.game;
  pauseCloseRestoreFocus = false;
  await closePauseMenu({ resume: false });
  await queueRunForfeit(priorRun, priorGame, { announce: true });
  if (state.mode === "training") startFirstOrbit();
  else void retryGame();
});
$("#pauseRevealPath").addEventListener("click", async () => {
  if (state.startingRun || state.reveal.pending || state.reveal.active) return;
  pauseCloseRestoreFocus = false;
  await closePauseMenu({ resume: false });
  openRevealPath();
});
$("#pauseExit").addEventListener("click", quitActiveGame);
els.resetBoard.addEventListener("click", () => {
  clearBoardWithUndo();
  if (els.pauseDialog.open) closePauseMenu();
});
els.tidyBoard.addEventListener("click", () => {
  tidyOrbit();
  if (els.pauseDialog.open) closePauseMenu();
});
els.undoBoardAction.addEventListener("click", undoBoardEdit);
els.redoBoardAction.addEventListener("click", redoBoardEdit);
$("#undoBoardClear").addEventListener("click", undoBoardClear);
$("#cancelTapChain").addEventListener("click", () => cancelTapChain({ announce: true }));
els.senseButton.addEventListener("click", openPowerups);
els.remixPill?.addEventListener("click", () => {
  const rules = Array.isArray(state.game?.remixes?.rules) ? state.game.remixes.rules : [];
  if (!rules.length) return;
  const progressItems = Array.isArray(state.remixProgress?.items) ? state.remixProgress.items : [];
  const byFamily = new Map(progressItems.map((item) => [item.family, item]));
  const nextRule = rules.find((rule) => byFamily.get(rule.family)?.complete !== true);
  const message = nextRule
    ? nextRule.instruction
    : `All route rules are ready. Make ${state.game.target}.`;
  showAlchemy(message, false, true);
  els.boardAnnouncement.textContent = message;
});
els.quickTipShortcut.addEventListener("click", useQuickTip);
els.wordGiftShortcut.addEventListener("click", useWordGiftShortcut);
els.senseShortcut.addEventListener("click", useSenseShortcut);
els.powerupShopShortcut.addEventListener("click", openPowerupShop);
els.expectedPairForm.addEventListener("submit", submitExpectedPairFeedback);
$("#dismissExpectedPair").addEventListener("click", resetExpectedPairFeedback);
els.useQuickTip.addEventListener("click", useQuickTip);
els.useWordGift.addEventListener("click", useWordGift);
$("#useSense").addEventListener("click", useConstellationSense);
$("#buySense").addEventListener("click", () => buyStardustSupply("star-compass"));
$("#buyStarCompass")?.addEventListener("click", () => void buyStardustSupply("star-compass"));
$("#buyStreakShield")?.addEventListener("click", () => void buyStardustSupply("streak-shield"));
els.rivalGhost.addEventListener("click", toggleRivalGhost);
els.board.addEventListener("pointerdown", (event) => {
  if (event.target.closest?.(".board-word, .board-quick-tools, .rival-ghost, .ghost-preview, .tap-chain-status, .board-undo, .reveal-controller, .recipe-feedback, .expected-pair-feedback")) return;
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
$("#revealPathButton").addEventListener("click", () => {
  if (els.senseDialog.open) els.senseDialog.close();
  requestAnimationFrame(openRevealPath);
});
$("#confirmReveal").addEventListener("click", confirmRevealPath);
$("#revealPause").addEventListener("click", toggleRevealPause);
$("#revealSpeed").addEventListener("click", cycleRevealSpeed);
$("#revealSkip").addEventListener("click", skipRevealAnimation);
$("#startPremium").addEventListener("click", () => { closeHubMenu(); profile.premium ? openProfile() : openPremium(); });
[$("#openObservatory"), $("#customizeButton")].forEach((button) => {
  button?.addEventListener("click", () => void openCosmeticsObservatory({ trigger: button }));
});
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
$("#resultReveal").addEventListener("click", () => {
  if (state.startingRun) return;
  openRevealPath();
});
$("#resultPrimary").addEventListener("click", () => state.resultAction?.());
$("#resultRetry").addEventListener("click", () => state.reveal.replayAvailable && !adaptiveSeriesEligible() ? returnHome() : retryGame());
$("#resultReplay").addEventListener("click", replayFinishedChallenge);
$("#raceCommunityGhost").addEventListener("click", () => {
  if (!queueNearbyCommunityRace()) return showToast("That nearby route is no longer available.");
  profile.rivalGhostEnabled = true;
  saveProfile({ fields: ["settings"] });
  track("community_viewed", { source: "community", action: "race" });
  void retryGame();
});
$("#resultLeaderboard").addEventListener("click", () => {
  if (state.startingRun) return;
  openLeaderboard(state.leaderboardScope, state.leaderboardDivision);
});
els.profileDialog.querySelectorAll(".profile-disclosure").forEach((section) => section.addEventListener("toggle", () => {
  if (!section.open) return;
  els.profileDialog.querySelectorAll(".profile-disclosure[open]").forEach((other) => {
    if (other !== section) other.open = false;
  });
}));
$$('[data-close]').forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.close === "revealDialog" && state.reveal.pending) return;
  if (button.dataset.close === "resultDialog") {
    returnHome();
    return;
  }
  document.getElementById(button.dataset.close).close();
}));
els.missionBriefingDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  cancelMissionBriefing();
});
els.pauseDialog.addEventListener("cancel", (event) => { event.preventDefault(); closePauseMenu(); });
els.pauseDialog.addEventListener("close", () => {
  cosmicGate.clearDialog(els.pauseDialog);
  finishPauseClose();
  setTimeout(() => resumeTimerIfNeeded(), 0);
});
els.revealDialog.addEventListener("cancel", (event) => {
  if (state.reveal.pending) event.preventDefault();
});
els.resultDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  if (state.startingRun) return;
  if (pendingScoreBlocksExit()) {
    showToast("Wait for your score to finish saving.");
    return;
  }
  returnHome();
});
els.resultDialog.addEventListener("close", () => cosmicGate.clearDialog(els.resultDialog));
$("#recoveryDialog").addEventListener("cancel", (event) => event.preventDefault());
[els.paywallDialog, els.wishDialog, els.atlasDialog, els.senseDialog, els.shareDialog, els.profileDialog, els.journeyDialog, els.marketBuyDialog, els.leaderboardDialog, els.revealDialog, els.developerLoginDialog, els.developerDialog, els.developerVfxDialog, $("#recoveryDialog")].forEach((dialog) => dialog.addEventListener("close", () => setTimeout(resumeTimerIfNeeded, 0)));
els.exchangeDialog.addEventListener("close", () => {
  clearInterval(state.marketTimer);
  state.marketTimer = null;
  setTimeout(resumeTimerIfNeeded, 0);
});
window.addEventListener("resize", () => {
  if (els.gameScreen.hidden) return;
  if (cosmeticsObservatoryHost?.resizePreview?.()) return;
  requestAnimationFrame(() => {
    if (!refreshRevealLayoutForViewport()) constrainBoardNodes();
    startCosmos();
    if (els.atlasDialog.open) renderAtlas();
  });
});
document.addEventListener("pointerdown", primeFeedbackAudio, { once: true, passive: true });
document.addEventListener("keydown", primeFeedbackAudio, { once: true });
document.addEventListener("constellore:interlude-enter", enterCosmicInterlude);
window.addEventListener("pointerdown", rememberPointerPosition, { capture: true, passive: true });
window.addEventListener("pointermove", rememberPointerPosition, { passive: true });
window.addEventListener("keydown", handleDeveloperShortcut);
window.addEventListener("keydown", handlePauseShortcut);
window.addEventListener("keydown", activateShiftBoard);
window.addEventListener("keydown", handleBoardHistoryShortcut);
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
window.addEventListener("pagehide", () => gameAudio.setSuspended(true));
window.addEventListener("pageshow", () => gameAudio.setSuspended(document.hidden));
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
  gameAudio.setSuspended(document.hidden);
  if (document.hidden) {
    releaseCtrlHover();
    releaseShiftBoard();
    cancelActivePointerGestures();
    flushRunSave();
  }
  else {
    wakeRevealPlayback();
    if (isStaticBeta) void expectedPairDelivery.flush();
  }
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
  const params = new URLSearchParams(location.search);
  const sharedChallenge = parseConstelloreChallengeUrl(params, todayKey);
  const scrambleInvite = startupScrambleInviteCode || startupScrambleInvite();
  const scrambleResume = startupScrambleResume || hasRememberedScrambleMatch();
  const launchIntent = Boolean(sharedChallenge || firstGameLaunchIntent(params.get("mode")));
  const scrambleLaunchIntent = Boolean(scrambleInvite || scrambleResume);
  const launchMenuHandoff = launchCinematicOutcome.menuHandoff === true;
  const savedRun = startupResumeSnapshot;
  const dailySense = refillDailySense();
  if (dailySense.refilled) saveProfile({ cloud: false });
  else renderProfile();
  if (isStaticBeta) void expectedPairDelivery.flush();
  if (dailySense.granted) track("sense_earned", { source: "daily", reward: dailySense.granted });
  updateConnection();
  track("app_opened", { installed: matchMedia("(display-mode: standalone)").matches });
  let firstGameStarted = firstGameRequired(profile) && !launchMenuHandoff && !savedRun && !launchIntent && (!profile.playerId || !profile.playerToken || isStaticBeta) && !scrambleLaunchIntent;
  if (firstGameStarted) await startFirstOrbit({ enterThroughGate: false });
  await loadConfig();
  try { await ensurePlayer(); }
  catch { showToast("Leaderboard and Word Exchange need a connection."); }
  if (profile.playerId && profile.playerToken) await refreshCosmicEventState();
  if (profile.playerId && profile.playerToken) await initializeCloudServices();
  let scrambleHandled = false;
  if ((scrambleInvite || scrambleResume) && homeMenuState().onboardingComplete) {
    try {
      const runtime = await ensureScramble();
      runtime.setRankedUnlocked(scrambleRankedUnlocked());
      scrambleHandled = scrambleInvite
        ? await openScramble({ trigger: $("#scrambleHomeButton"), invite: scrambleInvite })
        : await runtime.resume();
    } catch (error) {
      showSecondarySurfaceFailure(error, "Your live match could not reconnect.");
    }
  }
  announcePendingScoreRecovery(await retryPendingScoreUploads());
  if ("serviceWorker" in navigator && window.top === window.self) {
    const serviceWorkerUrl = isStaticBeta ? "./service-worker.js?v=5.0.0-beta.1" : "/play/service-worker.js?v=5.0.0-beta.1";
    const serviceWorkerScope = isStaticBeta ? "./" : "/play/";
    navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: serviceWorkerScope,
      updateViaCache: "none"
    }).then((registration) => {
      if (!savedRun && registration.waiting) {
        let reloading = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloading) return;
          reloading = true;
          location.reload();
        }, { once: true });
        registration.waiting.postMessage({
          type: "CONSTELLORE_ACTIVATE_UPDATE",
          version: "5.0.0-beta.1"
        });
      }
    }).catch(() => {});
  }
  if (!firstGameStarted && (!firstGameRequired(profile) || savedRun || launchMenuHandoff)) announceModeScreenViewed();
  const restored = firstGameStarted ? false : await restoreInterruptedRun(savedRun);
  if (startupResumeSnapshot) {
    if (restored) releaseLaunchBlackout();
    else handoffLaunchMenu();
  }
  if (!restored && !firstGameStarted && !launchMenuHandoff && !launchIntent && !scrambleLaunchIntent && firstGameRequired(profile)) {
    await startFirstOrbit({ enterThroughGate: false });
    firstGameStarted = true;
  } else if (!restored && !firstGameStarted && sharedChallenge) {
    if (sharedChallenge.mode === "daily" && !homeMenuState().dailyReady) {
      showToast("Today’s Word unlocks after your first scored Bronze win.", { scope: "global" });
      if (firstGameRequired(profile)) {
        await startFirstOrbit({ enterThroughGate: false });
        firstGameStarted = true;
      }
    } else {
      const mode = sharedChallenge.mode === "daily" && profile.dailyCompleted !== todayKey
        ? "daily"
        : "challenge";
      track("challenge_opened", { target: sharedChallenge.target, source: sharedChallenge.source });
      void beginMode(mode, {
        target: sharedChallenge.target,
        seed: sharedChallenge.seed,
        context: sharedChallenge.source === "daily" ? "shared-daily" : "friend-challenge"
      });
    }
  } else if (!restored && !firstGameStarted) {
    const launchHandled = await handleLaunchIntent(params);
    if (!launchHandled && !launchMenuHandoff && firstGameRequired(profile)) {
      await startFirstOrbit({ enterThroughGate: false });
      firstGameStarted = true;
    }
  }
  if (window.parent !== window) window.parent.postMessage({ type: "constellore:ready", localOnly: isStaticBeta }, location.origin);
}

boot().catch((error) => {
  console.error("Constellore could not finish booting.", error);
  showToast("The cosmos could not finish loading. Refresh to try again.");
});
