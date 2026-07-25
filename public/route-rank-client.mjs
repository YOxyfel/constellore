import { sanitizeAdaptiveDifficultyState } from "./adaptive-difficulty.mjs?v=3.3.0-beta.1";
import { getRankBoardArtTier } from "./rank-board-art.mjs?v=3.3.0-beta.1";
import { getRemixRankPresentation } from "./remix-progression.mjs?v=3.3.0-beta.1";

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function sanitizeStartStylePreference(value) {
  const style = String(value || "auto").trim().toLowerCase();
  return ["auto", "classic", "shuffled"].includes(style) ? style : "auto";
}

export function sanitizeRouteOutcomeHashes(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((entry) => String(entry || "").toLowerCase()).filter((entry) => /^[a-f0-9]{8}$/.test(entry)))].slice(-256)
    : [];
}

export function sanitizeRouteRankSummary(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const rank = getRemixRankPresentation(candidate.rank?.id || candidate.rank || candidate.rankId || "bronze");
  const challengeRank = getRemixRankPresentation(candidate.challengeRank?.id || candidate.challengeRank || rank.id);
  const mastery = candidate.mastery && typeof candidate.mastery === "object" ? candidate.mastery : {};
  const promotion = candidate.promotion && typeof candidate.promotion === "object" ? candidate.promotion : {};
  const intensity = candidate.remixIntensity && typeof candidate.remixIntensity === "object" ? candidate.remixIntensity : {};
  const bounded = (value, maximum = 100_000_000) => clamp(Math.trunc(Number(value) || 0), 0, maximum);
  return {
    version: bounded(candidate.version, 100),
    rank,
    challengeRank,
    mastery: {
      points: bounded(mastery.points),
      rankFloor: bounded(mastery.rankFloor),
      nextThreshold: mastery.nextThreshold == null ? null : bounded(mastery.nextThreshold),
      pointsIntoRank: bounded(mastery.pointsIntoRank),
      pointsRequired: bounded(mastery.pointsRequired),
      pointsRemaining: bounded(mastery.pointsRemaining),
      fraction: clamp(Number(mastery.fraction) || 0, 0, 1)
    },
    promotion: {
      active: promotion.active === true,
      eligible: promotion.eligible === true,
      status: String(promotion.status || "").slice(0, 32),
      currentRank: getRemixRankPresentation(promotion.currentRank?.id || promotion.currentRank || rank.id),
      targetRank: promotion.targetRank
        ? getRemixRankPresentation(promotion.targetRank.id || promotion.targetRank)
        : null,
      attempt: bounded(promotion.attempt, 3),
      attemptsCompleted: bounded(promotion.attemptsCompleted, 3),
      attemptsTotal: clamp(bounded(promotion.attemptsTotal, 3) || 3, 1, 3),
      wins: bounded(promotion.wins, 3),
      winsRequired: clamp(bounded(promotion.winsRequired, 3) || 2, 1, 3),
      flawlessWins: bounded(promotion.flawlessWins, 3)
    },
    remixIntensity: {
      activeCount: bounded(intensity.activeCount, 5),
      minimumCount: bounded(intensity.minimumCount, 5),
      maximumCount: bounded(intensity.maximumCount, 5),
      cleanWinsTowardNextStep: bounded(intensity.cleanWinsTowardNextStep, 3),
      cleanWinsNeededForNextStep: bounded(intensity.cleanWinsNeededForNextStep, 3),
      atMaximum: intensity.atMaximum === true
    },
    adaptiveDifficulty: sanitizeAdaptiveDifficultyState(candidate.adaptiveDifficulty),
    familyMastery: candidate.familyMastery && typeof candidate.familyMastery === "object"
      ? structuredClone(candidate.familyMastery)
      : {}
  };
}

export function routeRankChangeMessage(previous, next) {
  if (!next) return "";
  if (previous && previous.rank.id !== next.rank.id) {
    const previousSky = getRankBoardArtTier(previous.rank.id);
    const nextSky = getRankBoardArtTier(next.rank.id);
    return previousSky.id === nextSky.id
      ? `${next.rank.name} reached. Promotion complete.`
      : `${next.rank.name} reached. ${nextSky.name} board unlocked.`;
  }
  if ((!previous?.promotion?.active && next.promotion.active) || next.promotion.attempt === 1 && next.promotion.attemptsCompleted === 0) {
    return `${next.promotion.targetRank?.name || "Next rank"} promotion: win ${next.promotion.winsRequired} of ${next.promotion.attemptsTotal}.`;
  }
  const gained = Math.max(0, next.mastery.points - (previous?.mastery?.points || 0));
  if (gained <= 0) return "";
  return next.mastery.pointsRemaining > 0
    ? `+${gained} mastery · ${next.mastery.pointsRemaining} to ${next.mastery.nextThreshold == null ? "the summit" : next.rank.nextRank?.name || "promotion"}`
    : `+${gained} mastery · promotion ready`;
}
