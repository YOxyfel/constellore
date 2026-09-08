import { sanitizeAdaptiveDifficultyState } from "./adaptive-difficulty.mjs?v=5.0.0-beta.4";
import { getRankBoardArtTier } from "./rank-board-art.mjs?v=5.0.0-beta.4";
import { getRemixRankPresentation } from "./remix-progression.mjs?v=5.0.0-beta.4";

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

export function routeRankProgressPresentation(candidate) {
  const summary = sanitizeRouteRankSummary(candidate)
    || sanitizeRouteRankSummary({ rank: "bronze", challengeRank: "bronze" });
  const rank = summary.rank;
  const nextRank = rank.nextRank;
  const promotion = summary.promotion;
  const inferredRequired = nextRank
    ? Math.max(0, nextRank.masteryPoints - rank.masteryPoints)
    : 0;
  const pointsRequired = summary.mastery.pointsRequired || inferredRequired;
  const pointsIntoRank = summary.mastery.pointsRequired
    ? summary.mastery.pointsIntoRank
    : clamp(summary.mastery.points - rank.masteryPoints, 0, pointsRequired);
  const pointsRemaining = nextRank
    ? summary.mastery.nextThreshold == null
      ? Math.max(0, nextRank.masteryPoints - summary.mastery.points)
      : summary.mastery.pointsRemaining
    : 0;
  let progress = Math.round(
    summary.mastery.pointsRequired
      ? summary.mastery.fraction * 100
      : pointsRequired > 0
        ? pointsIntoRank / pointsRequired * 100
        : 100
  );
  let status = nextRank
    ? `${pointsRemaining.toLocaleString("en-US")} mastery to ${nextRank.name}`
    : "Highest Route Rank reached";
  let detail = `${summary.mastery.points.toLocaleString("en-US")} total mastery`;

  if (promotion.active && promotion.targetRank) {
    progress = Math.round(promotion.attemptsCompleted / promotion.attemptsTotal * 100);
    status = `${promotion.targetRank.name} promotion · ${promotion.wins} of ${promotion.winsRequired} wins`;
    detail = `${promotion.attemptsCompleted} of ${promotion.attemptsTotal} promotion games complete`;
  } else if (promotion.eligible && promotion.targetRank) {
    progress = 100;
    status = `${promotion.targetRank.name} promotion ready`;
    detail = "Your next ranked challenge starts the promotion series";
  } else if (nextRank && pointsRequired > 0) {
    detail = `${pointsIntoRank.toLocaleString("en-US")} of ${pointsRequired.toLocaleString("en-US")} rank mastery`;
  }

  const nextUnlock = rank.id === "bronze"
    ? "Silver unlocks Free play and custom targets"
    : rank.id === "silver"
      ? "Gold unlocks timed games and Adventures"
      : nextRank
        ? `${nextRank.name} brings a richer sky and tougher routes`
        : "Every Route Rank and sky is unlocked";

  return {
    id: rank.id,
    name: rank.name,
    number: rank.number,
    mark: rank.name.slice(0, 1).toUpperCase(),
    progress: clamp(progress, 0, 100),
    status,
    detail,
    nextUnlock,
    meterLabel: `${rank.name} Route Rank. ${status}. ${detail}.`
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
