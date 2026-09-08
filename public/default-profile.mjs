import { createExpeditionState } from "./expedition.mjs?v=5.0.0-beta.4";

export function createDefaultProfile({
  cosmeticLoadout,
  voyageProgress,
  routeProgression,
  remixReadiness,
  expedition,
  worldweaving = {
    version: 1,
    worlds: {
      moon: {
        anchors: { power: null, shelter: null, signal: null },
        completion: null,
        outcomeKey: "",
        worldword: null
      }
    }
  }
}) {
  const expeditionState = expedition ?? createExpeditionState(worldweaving);
  return {
    version: 10,
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
    dailyPlayed: "",
    streakShields: 1,
    freeWishUsed: false,
    wishAvailable: true,
    dailyWishUsedDate: "",
    premium: false,
    theme: "void",
    cosmetics: { ...cosmeticLoadout },
    cosmeticEffects: "full",
    cosmeticOwnership: { supporter: false, collections: [], items: [], earned: [] },
    recipeMastery: { version: 1, recipes: [] },
    masteryCelebrated: [],
    senseWallet: { version: 1, charges: 0, lastRefillDate: "", earned: 0, spent: 0 },
    senseFounderBonusDate: "",
    feedbackPreferences: {
      sound: true,
      music: true,
      haptics: true,
      resultDetails: false,
      helpNudges: true,
      fusionAnimation: "normal",
      muted: false,
      volume: .75,
      musicVolume: 1,
      sfxVolume: 1
    },
    rivalGhostEnabled: true,
    firstOrbit: { seen: false, completed: false },
    secondOrbit: { seen: false, completed: false },
    exploreWords: [],
    weekly: { key: "", stage: 0, complete: false },
    voyageProgress,
    selectedVoyageId: "first-cities",
    eventProgress: { weekKey: "", eventId: "", words: [], rewarded: false },
    worldweaving: structuredClone(worldweaving),
    expedition: structuredClone(expeditionState),
    signatureBests: [],
    rewardedRunIds: [],
    routeProgression,
    remixReadiness,
    routeOutcomeHashes: [],
    routeRank: null,
    lastRouteOutcome: ""
  };
}
