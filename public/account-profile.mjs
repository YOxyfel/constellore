import { sanitizeSenseWallet } from "./engagement-features.mjs?v=5.0.0-beta.1";
import { preserveAnonymousFirstGameProgress } from "./first-game-experience.mjs?v=5.0.0-beta.1";

export function resetAccountProfile(defaultProfile, currentProfile, {
  playerId = currentProfile?.playerId,
  playerToken = currentProfile?.playerToken,
  preserveServer = false,
  preserveFirstOrbit = false,
  preserveLocalProgress = false
} = {}) {
  const firstOrbit = preserveAnonymousFirstGameProgress(currentProfile?.firstOrbit, {
    anonymous: preserveFirstOrbit
  });
  const localProgress = preserveLocalProgress
    && currentProfile
    && typeof currentProfile === "object"
    && !Array.isArray(currentProfile)
    ? structuredClone(currentProfile)
    : {};
  // Creating an identity for an existing anonymous player must attach the new
  // credentials to their device-local solo profile, not replace that profile
  // with a new account. Server-owned identity, commerce, and cloud fields are
  // still reset here and populated from the authoritative registration reply.
  const resetServerState = preserveLocalProgress ? {
    playerId: "",
    playerToken: "",
    cloudProfileVersion: 0,
    cloudPending: false,
    cloudPendingFields: [],
    callsign: "",
    credits: 0,
    vault: [],
    premium: false,
    cosmeticOwnership: structuredClone(defaultProfile.cosmeticOwnership || {}),
    freeWishUsed: false,
    wishAvailable: true,
    dailyWishUsedDate: ""
  } : {};
  const serverState = preserveServer ? {
    callsign: currentProfile.callsign,
    credits: currentProfile.credits,
    vault: [...currentProfile.vault],
    premium: currentProfile.premium,
    cosmeticOwnership: structuredClone(currentProfile.cosmeticOwnership || {}),
    freeWishUsed: currentProfile.freeWishUsed,
    wishAvailable: currentProfile.wishAvailable,
    dailyWishUsedDate: currentProfile.dailyWishUsedDate,
    streakShields: currentProfile.streakShields,
    senseWallet: sanitizeSenseWallet(currentProfile.senseWallet),
    senseFounderBonusDate: currentProfile.senseFounderBonusDate
  } : {};
  return {
    ...structuredClone(defaultProfile),
    ...localProgress,
    ...resetServerState,
    ...serverState,
    playerId: String(playerId || ""),
    playerToken: String(playerToken || ""),
    ...(firstOrbit ? { firstOrbit } : {})
  };
}
