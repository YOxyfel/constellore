import {
  REMIX_FAMILIES,
  getRemixRank,
  getRemixRankPresentation,
  remixFamiliesAreCompatible
} from "./remix-progression.mjs?v=3.3.0-beta.1";

export const REMIX_READINESS_VERSION = 1;
export const REMIX_READINESS_HISTORY_LIMIT = 36;
export const CLEAN_WINS_PER_INTENSITY_STEP = 3;
export const CLEAN_WINS_FOR_FAMILY_MASTERY = 3;

const MAX_COUNTER = 1_000_000;
const MAX_EVENT_ID_LENGTH = 160;
const FAMILY_IDS = Object.freeze(REMIX_FAMILIES.map((family) => family.id));
const FAMILY_ID_SET = new Set(FAMILY_IDS);
const TERMINAL_OUTCOMES = new Set([
  "completed",
  "failed",
  "forfeit",
  "reveal"
]);
const SETBACK_OUTCOMES = new Set(["failed", "forfeit", "reveal"]);
const OUTCOME_ALIASES = new Map([
  ["abandoned", "forfeit"],
  ["complete", "completed"],
  ["completed", "completed"],
  ["failure", "failed"],
  ["failed", "failed"],
  ["forfeit", "forfeit"],
  ["given_up", "forfeit"],
  ["quit", "forfeit"],
  ["reveal", "reveal"],
  ["revealed", "reveal"],
  ["study", "reveal"],
  ["success", "completed"],
  ["timeout", "failed"],
  ["win", "completed"]
]);

function clampInteger(value, minimum = 0, maximum = MAX_COUNTER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function cleanIdentifier(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_EVENT_ID_LENGTH);
}

function canonicalFamilyId(value) {
  const id = String(value?.id ?? value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s-]+/g, "_");
  return FAMILY_ID_SET.has(id) ? id : "";
}

function uniqueFamilyIds(candidate) {
  if (!Array.isArray(candidate)) return [];
  const ids = [];
  const seen = new Set();
  for (const value of candidate) {
    const id = canonicalFamilyId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function canonicalOutcome(value) {
  const key = String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s-]+/g, "_");
  return OUTCOME_ALIASES.get(key) || "";
}

function eventIdHash(value) {
  const id = cleanIdentifier(value);
  if (!id) return "";
  return stableHash(`constellore-remix-outcome\0${id}`)
    .toString(16)
    .padStart(8, "0");
}

function blankFamilyMastery() {
  return {
    attempts: 0,
    completions: 0,
    cleanCompletions: 0,
    mastered: false
  };
}

function sanitizeFamilyMastery(candidate) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  const attempts = clampInteger(source.attempts);
  const completions = Math.min(attempts, clampInteger(source.completions));
  const cleanCompletions = Math.min(
    completions,
    clampInteger(source.cleanCompletions)
  );
  return {
    attempts,
    completions,
    cleanCompletions,
    // Never trust a persisted boolean. Mastery is derived from bounded evidence.
    mastered: cleanCompletions >= CLEAN_WINS_FOR_FAMILY_MASTERY
  };
}

function blankMasteryMap() {
  return Object.fromEntries(
    FAMILY_IDS.map((id) => [id, blankFamilyMastery()])
  );
}

function eventFamilies(event) {
  return uniqueFamilyIds(
    event?.families
    ?? event?.familyIds
    ?? event?.modifierIds
    ?? event?.remixes
    ?? []
  );
}

function cleanCompletion(event, outcome) {
  if (outcome !== "completed" || event?.clean !== true) return false;
  if (
    event?.assisted === true
    || event?.usedHelp === true
    || event?.usedHint === true
    || event?.usedReveal === true
    || event?.revealed === true
  ) {
    return false;
  }
  if (event?.mistakes != null && clampInteger(event.mistakes) !== 0) {
    return false;
  }
  return true;
}

function sanitizeHistoryEntry(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const outcome = canonicalOutcome(candidate.outcome);
  if (!TERMINAL_OUTCOMES.has(outcome)) return null;
  const families = eventFamilies(candidate);
  const rank = getRemixRank(candidate.rankId ?? candidate.rank ?? "bronze");
  return {
    idHash: /^[a-f0-9]{8}$/u.test(String(candidate.idHash || ""))
      ? String(candidate.idHash)
      : eventIdHash(
          candidate.outcomeId
          ?? candidate.runId
          ?? candidate.challengeId
          ?? candidate.id
        ),
    rankId: rank.id,
    outcome,
    clean: cleanCompletion(candidate, outcome),
    activeCount: families.length,
    families
  };
}

function sanitizeRecentOutcomes(candidate) {
  if (!Array.isArray(candidate)) return [];
  const output = [];
  const seenIds = new Set();
  for (const value of candidate.slice(-REMIX_READINESS_HISTORY_LIMIT * 2)) {
    const entry = sanitizeHistoryEntry(value);
    if (!entry) continue;
    if (entry.idHash && seenIds.has(entry.idHash)) continue;
    if (entry.idHash) seenIds.add(entry.idHash);
    output.push(entry);
  }
  return output.slice(-REMIX_READINESS_HISTORY_LIMIT);
}

export function createRemixReadinessState() {
  return {
    version: REMIX_READINESS_VERSION,
    totalRankedOutcomes: 0,
    familyMastery: blankMasteryMap(),
    recentOutcomes: []
  };
}

/**
 * Persistence boundary for local saves and server snapshots. Unknown fields,
 * unknown families, raw identifiers and impossible counters are discarded.
 * The result is safe to JSON serialize and contains no free text.
 */
export function sanitizeRemixReadinessState(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return createRemixReadinessState();
  }
  const sourceMastery = candidate.familyMastery
    && typeof candidate.familyMastery === "object"
    && !Array.isArray(candidate.familyMastery)
      ? candidate.familyMastery
      : {};
  return {
    version: REMIX_READINESS_VERSION,
    totalRankedOutcomes: clampInteger(candidate.totalRankedOutcomes),
    familyMastery: Object.fromEntries(
      FAMILY_IDS.map((id) => [id, sanitizeFamilyMastery(sourceMastery[id])])
    ),
    recentOutcomes: sanitizeRecentOutcomes(candidate.recentOutcomes)
  };
}

function rankFromInput(candidate) {
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    if (candidate.rank != null) return getRemixRank(candidate.rank);
    if (candidate.rankId != null) return getRemixRank(candidate.rankId);
  }
  return getRemixRank(candidate);
}

function outcomesAtRank(state, rankId) {
  return state.recentOutcomes.filter((entry) => entry.rankId === rankId);
}

function intensityProof(outcomes) {
  let lastSetback = -1;
  for (let index = 0; index < outcomes.length; index += 1) {
    if (SETBACK_OUTCOMES.has(outcomes[index].outcome)) lastSetback = index;
  }
  const sinceSetback = outcomes.slice(lastSetback + 1);
  let consecutiveCleanWins = 0;
  let provenSteps = 0;
  for (const entry of sinceSetback) {
    if (entry.outcome === "completed" && entry.clean) {
      consecutiveCleanWins += 1;
      if (consecutiveCleanWins === CLEAN_WINS_PER_INTENSITY_STEP) {
        provenSteps += 1;
        consecutiveCleanWins = 0;
      }
    } else {
      consecutiveCleanWins = 0;
    }
  }
  return {
    lastOutcome: outcomes.at(-1)?.outcome || "",
    provenSteps,
    cleanWinsTowardNextStep: consecutiveCleanWins,
    outcomesSinceSetback: sinceSetback.length
  };
}

/**
 * Returns the next challenge's remix count. A setback immediately returns the
 * player to the rank minimum. Each step above that minimum must be earned with
 * three consecutive clean completions at the same permanent rank.
 */
export function getAdaptiveRemixIntensity(candidate, rankCandidate) {
  const state = sanitizeRemixReadinessState(candidate);
  const rank = rankFromInput(rankCandidate);
  const proof = intensityProof(outcomesAtRank(state, rank.id));
  const availableSteps = Math.max(0, rank.maximumRemixes - rank.minimumRemixes);
  const earnedSteps = Math.min(availableSteps, proof.provenSteps);
  const activeCount = rank.minimumRemixes + earnedSteps;
  const nextStepNeeds = activeCount < rank.maximumRemixes
    ? Math.max(
        0,
        CLEAN_WINS_PER_INTENSITY_STEP - proof.cleanWinsTowardNextStep
      )
    : 0;
  return {
    version: REMIX_READINESS_VERSION,
    rank: getRemixRankPresentation(rank),
    minimumCount: rank.minimumRemixes,
    maximumCount: rank.maximumRemixes,
    activeCount,
    earnedSteps,
    atMaximum: activeCount >= rank.maximumRemixes,
    lastOutcome: proof.lastOutcome,
    outcomesSinceSetback: proof.outcomesSinceSetback,
    cleanWinsTowardNextStep: proof.cleanWinsTowardNextStep,
    cleanWinsNeededForNextStep: nextStepNeeds,
    message: activeCount >= rank.maximumRemixes
      ? "Full remix intensity ready."
      : `${nextStepNeeds} clean win${nextStepNeeds === 1 ? "" : "s"} to raise remix intensity.`
  };
}

function normalizeEvent(event) {
  const entry = sanitizeHistoryEntry({
    ...event,
    idHash: "",
    outcomeId: event?.outcomeId
      ?? event?.runId
      ?? event?.challengeId
      ?? event?.id
  });
  return entry;
}

/**
 * Applies one authoritative ranked challenge outcome. Supplying a stable
 * outcomeId/runId makes retries idempotent, preventing accidental double credit.
 */
export function recordRemixReadinessOutcome(candidate, event = {}) {
  const state = sanitizeRemixReadinessState(candidate);
  const entry = normalizeEvent(event);
  if (!entry) {
    return {
      state,
      changed: false,
      duplicate: false,
      reason: "ignored_outcome",
      masteryGained: []
    };
  }
  if (
    entry.idHash
    && state.recentOutcomes.some((value) => value.idHash === entry.idHash)
  ) {
    return {
      state,
      changed: false,
      duplicate: true,
      reason: "duplicate_outcome",
      masteryGained: []
    };
  }

  const familyMastery = Object.fromEntries(
    FAMILY_IDS.map((id) => [id, { ...state.familyMastery[id] }])
  );
  const masteryGained = [];
  for (const id of entry.families) {
    const previous = familyMastery[id];
    const next = {
      attempts: Math.min(MAX_COUNTER, previous.attempts + 1),
      completions: Math.min(
        MAX_COUNTER,
        previous.completions + (entry.outcome === "completed" ? 1 : 0)
      ),
      cleanCompletions: Math.min(
        MAX_COUNTER,
        previous.cleanCompletions + (entry.clean ? 1 : 0)
      )
    };
    next.mastered = next.cleanCompletions >= CLEAN_WINS_FOR_FAMILY_MASTERY;
    familyMastery[id] = next;
    if (!previous.mastered && next.mastered) masteryGained.push(id);
  }
  const nextState = sanitizeRemixReadinessState({
    version: REMIX_READINESS_VERSION,
    totalRankedOutcomes: Math.min(
      MAX_COUNTER,
      state.totalRankedOutcomes + 1
    ),
    familyMastery,
    recentOutcomes: [...state.recentOutcomes, entry]
  });
  return {
    state: nextState,
    changed: true,
    duplicate: false,
    reason: entry.outcome,
    outcome: entry,
    masteryGained,
    intensity: getAdaptiveRemixIntensity(nextState, entry.rankId)
  };
}

function availableFamilyIds(rank, candidate) {
  const explicitlyAvailable = Array.isArray(candidate)
    ? new Set(uniqueFamilyIds(candidate))
    : null;
  return rank.unlockedFamilies.filter(
    (id) => !explicitlyAvailable || explicitlyAvailable.has(id)
  );
}

function normalizedIncompatiblePairs(candidate) {
  if (!Array.isArray(candidate)) return [];
  const output = [];
  for (const value of candidate) {
    const entries = Array.isArray(value)
      ? value
      : String(value || "").split(/[|,+/]/u);
    if (entries.length < 2) continue;
    const first = canonicalFamilyId(entries[0]);
    const second = canonicalFamilyId(entries[1]);
    if (!first || !second || first === second) continue;
    output.push([first, second]);
  }
  return output;
}

function combinations(values, size, start = 0, prefix = [], output = []) {
  if (prefix.length === size) {
    output.push(prefix);
    return output;
  }
  for (
    let index = start;
    index <= values.length - (size - prefix.length);
    index += 1
  ) {
    combinations(values, size, index + 1, [...prefix, values[index]], output);
  }
  return output;
}

function compatibleCombination(ids, incompatiblePairs) {
  for (let first = 0; first < ids.length; first += 1) {
    for (let second = first + 1; second < ids.length; second += 1) {
      if (!remixFamiliesAreCompatible(ids[first], ids[second], {
        incompatiblePairs
      })) {
        return false;
      }
    }
  }
  return true;
}

function masteryScore(state, id) {
  const mastery = state.familyMastery[id];
  return mastery.cleanCompletions * 1000
    + mastery.completions * 10
    + mastery.attempts;
}

function chooseCombination(combinationsList, state, seed, rankId) {
  return combinationsList
    .map((ids) => {
      const unmastered = ids.filter((id) => !state.familyMastery[id].mastered);
      const onboardingScore = unmastered.length === 1
        ? masteryScore(state, unmastered[0])
        : -1;
      return {
        ids,
        onboardingScore,
        hash: stableHash(`${String(seed)}\0${rankId}\0${ids.join("|")}`)
      };
    })
    .sort((first, second) =>
      second.onboardingScore - first.onboardingScore
      || first.hash - second.hash
      || first.ids.join("|").localeCompare(second.ids.join("|"))
    )[0]?.ids || [];
}

/**
 * Produces a deterministic, serializable plan. Normally `activeCount` equals
 * the rank-safe intensity. If a migrated/forged state lacks enough mastered
 * families, it deliberately steps below the rank minimum instead of teaching
 * two unfamiliar rules at once; `reducedForOnboarding` makes that visible.
 */
export function selectAdaptiveRemixPlan({
  state: candidate,
  rank: rankCandidate,
  seed = 0,
  availableFamilies,
  incompatiblePairs = []
} = {}) {
  const state = sanitizeRemixReadinessState(candidate);
  const rank = rankFromInput(rankCandidate);
  const intensity = getAdaptiveRemixIntensity(state, rank);
  const available = availableFamilyIds(rank, availableFamilies);
  const incompatible = normalizedIncompatiblePairs(incompatiblePairs);
  let chosen = [];
  let realizedCount = Math.min(intensity.activeCount, available.length);

  while (realizedCount > 0) {
    const candidates = combinations(available, realizedCount)
      .filter((ids) =>
        ids.filter((id) => !state.familyMastery[id].mastered).length <= 1
      )
      .filter((ids) => compatibleCombination(ids, incompatible));
    if (candidates.length > 0) {
      chosen = chooseCombination(candidates, state, seed, rank.id);
      break;
    }
    realizedCount -= 1;
  }

  const unmasteredFamilyIds = chosen.filter(
    (id) => !state.familyMastery[id].mastered
  );
  return {
    version: REMIX_READINESS_VERSION,
    rank: intensity.rank,
    intensity,
    requestedCount: intensity.activeCount,
    activeCount: chosen.length,
    familyIds: chosen,
    masteredFamilyIds: chosen.filter(
      (id) => state.familyMastery[id].mastered
    ),
    unmasteredFamilyIds,
    introducesFamily: unmasteredFamilyIds[0] || null,
    reducedForAvailability: available.length < intensity.activeCount,
    reducedForCompatibility: chosen.length < Math.min(
      intensity.activeCount,
      available.length
    ),
    reducedForOnboarding: chosen.length < intensity.activeCount
      && available.some((id) => !state.familyMastery[id].mastered),
    belowRankMinimum: chosen.length < rank.minimumRemixes,
    summary: chosen.length === 0
      ? "Classic challenge"
      : chosen
          .map((id) => REMIX_FAMILIES.find((family) => family.id === id)?.shortName)
          .filter(Boolean)
          .join(" + ")
  };
}

export function getRemixFamilyMastery(candidate, familyCandidate) {
  const state = sanitizeRemixReadinessState(candidate);
  const id = canonicalFamilyId(familyCandidate);
  if (!id) return null;
  const mastery = state.familyMastery[id];
  return {
    id,
    ...mastery,
    cleanWinsRequired: CLEAN_WINS_FOR_FAMILY_MASTERY,
    cleanWinsRemaining: Math.max(
      0,
      CLEAN_WINS_FOR_FAMILY_MASTERY - mastery.cleanCompletions
    )
  };
}
