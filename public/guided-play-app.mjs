import {
  lowRankHelpNudgeEligible,
  nextHelpNudgeDelay,
  sanitizeFeedbackPreferences,
  scoreMultiplierAfterNudges
} from "./engagement-features.mjs?v=5.0.0-beta.4";
import { FIRST_ORBIT_ROUTE } from "./first-orbit.mjs?v=5.0.0-beta.4";
import { SECOND_ORBIT_ROUTE } from "./second-orbit.mjs?v=5.0.0-beta.4";
import { pathGuardEligibility, pathGuardPairKey } from "./path-guard.mjs?v=5.0.0-beta.4";
import { createConceptChemistryGuide, isConceptChemistryGuide } from "./concept-chemistry.mjs?v=5.0.0-beta.4";

export function sanitizeRememberedPathGuardPairs(value, maximum = 128) {
  const pairs = new Set();
  if (!Array.isArray(value)) return pairs;
  for (const candidate of value.slice(-maximum)) {
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

export function createGuidedPlayController({
  documentRef = globalThis.document,
  viewWindow = globalThis.window,
  state,
  elements = {},
  getProfile,
  pathGuardContextFor,
  firstOrbitActive,
  secondOrbitActive,
  homeOnboardingComplete,
  getRouteRankNumber,
  scheduleRunSave,
  scheduleConceptBond,
  pulseConceptBond,
  mobilePlayShellActive,
  relocateBoardNodesForHelpNudge,
  clearBoardAnnouncement,
  announceBoardMessage,
  showAlchemy,
  playFeedback,
  maximumRememberedPairs = 128
} = {}) {
  if (!state || typeof getProfile !== "function" || typeof pathGuardContextFor !== "function") {
    throw new TypeError("Guided play controller requires state, profile, and Path Guard adapters.");
  }

  const helpNudge = elements.helpNudge;
  const helpNudgeAction = elements.helpNudgeAction;
  const helpNudgeCost = elements.helpNudgeCost;
  const mobileAssistToggle = elements.mobileAssistToggle;
  const gameScreen = elements.gameScreen;
  let nudgeTimer = null;
  let nudgeSequence = 0;
  let nudgeGeneration = 0;

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

  function acceptConceptChemistryGuide(value) {
    state.conceptChemistry = isConceptChemistryGuide(value) ? structuredClone(value) : null;
    scheduleConceptBond();
    return state.conceptChemistry;
  }

  function conceptChemistryGuideForState() {
    if (!state.game) return createConceptChemistryGuide({ strict: false });
    if (firstOrbitActive()) {
      return createConceptChemistryGuide({
        route: FIRST_ORBIT_ROUTE,
        history: state.history,
        available: state.words,
        target: state.game.target,
        strict: !state.finished
      });
    }
    if (secondOrbitActive()) {
      return createConceptChemistryGuide({
        route: SECOND_ORBIT_ROUTE,
        history: state.history,
        available: state.words,
        target: state.game.target,
        strict: !state.finished
      });
    }
    if (pathGuardActiveFor() && isConceptChemistryGuide(state.conceptChemistry)) return state.conceptChemistry;
    return createConceptChemistryGuide({ target: state.game.target, strict: false });
  }

  function rememberPathGuardPair(a, b) {
    const pairKey = pathGuardPairKey(a, b);
    if (!pairKey) return { pairKey: "", remembered: false };
    const remembered = state.pathGuard.blockedPairs.has(pairKey);
    if (!remembered) {
      state.pathGuard.blockedPairs.add(pairKey);
      while (state.pathGuard.blockedPairs.size > maximumRememberedPairs) {
        state.pathGuard.blockedPairs.delete(state.pathGuard.blockedPairs.values().next().value);
      }
      scheduleRunSave();
    }
    return { pairKey, remembered };
  }

  function pathGuardPairWasRemembered(a, b) {
    const pairKey = pathGuardPairKey(a, b);
    return Boolean(pathGuardActiveFor() && pairKey && state.pathGuard.blockedPairs.has(pairKey));
  }

  function publishedGuidanceAssist(assist = state.assist, tipsUsed = state.powerups?.tipsUsed) {
    return assist === "none" && Number(tipsUsed) > 0 ? "tip" : assist;
  }

  function nextHelpNudgeScoreMultiplier() {
    return scoreMultiplierAfterNudges({ baseMultiplier: state.scoreMultiplier, nudgesUsed: 1 });
  }

  function scoreMultiplierPercent(multiplier) {
    const percent = Math.round(Math.min(1, Math.max(0, Number(multiplier) || 0)) * 1_000) / 10;
    return Number.isInteger(percent) ? String(percent) : percent.toFixed(1);
  }

  function helpNudgeCostText(multiplier = nextHelpNudgeScoreMultiplier()) {
    return `Each hint keeps 90% of what remains. Next hint leaves ${scoreMultiplierPercent(multiplier)}% max score and Stardust; Star Credits are reduced too`;
  }

  function hideHelpNudge() {
    if (helpNudge) {
      helpNudge.hidden = true;
      helpNudge.classList.remove("is-positioning");
    }
    mobileAssistToggle?.setAttribute("aria-label", "Open assistance tools");
    clearBoardAnnouncement("help-nudge");
  }

  function cancelHelpNudge({ hide = true } = {}) {
    viewWindow?.clearTimeout?.(nudgeTimer);
    nudgeTimer = null;
    nudgeGeneration += 1;
    if (hide) hideHelpNudge();
  }

  function helpNudgeEligible() {
    const profile = getProfile();
    const preferences = sanitizeFeedbackPreferences(profile.feedbackPreferences);
    return lowRankHelpNudgeEligible({
      enabled: preferences.helpNudges,
      onboardingComplete: homeOnboardingComplete(),
      rankNumber: getRouteRankNumber(),
      mode: state.mode,
      active: Boolean(state.game && state.run && !gameScreen.hidden && !state.startingRun && state.assist === "none"),
      paused: Boolean(state.pause.active),
      busy: Boolean(state.finished || state.reveal.active || state.reveal.pending || state.busyPairs.size || state.powerups.busy || documentRef.hidden),
      dialogOpen: Boolean(documentRef.querySelector("dialog[open]")),
      tipsUsed: state.powerups?.tipsUsed
    });
  }

  function renderHelpNudge() {
    if (!helpNudge || !helpNudgeAction || !helpNudgeCost) return;
    const cost = helpNudgeCostText();
    helpNudgeCost.textContent = mobilePlayShellActive()
      ? "Hints keep 90% of remaining score. Tap for details."
      : cost;
    helpNudgeAction.setAttribute("aria-label", `Need help? ${cost}.`);
    mobileAssistToggle?.setAttribute("aria-label", "Need help? Open assistance tools");
    helpNudge.classList.add("is-positioning");
    helpNudge.hidden = false;
    if (mobilePlayShellActive()) {
      viewWindow?.requestAnimationFrame?.(() => {
        if (helpNudge.hidden) return;
        helpNudge.classList.remove("is-positioning");
        announceBoardMessage(`Need help? ${cost}.`, "help-nudge");
      });
      return;
    }
    viewWindow?.requestAnimationFrame?.(() => {
      if (helpNudge.hidden || !relocateBoardNodesForHelpNudge()) return;
      viewWindow?.setTimeout?.(() => viewWindow?.requestAnimationFrame?.(() => {
        if (helpNudge.hidden || !relocateBoardNodesForHelpNudge()) return;
        helpNudge.classList.remove("is-positioning");
        announceBoardMessage(`Need help? ${cost}.`, "help-nudge");
      }), 180);
    });
  }

  function armHelpNudge({ restart = false } = {}) {
    cancelHelpNudge();
    if (restart) nudgeSequence = 0;
    if (!helpNudgeEligible()) return false;
    const generation = nudgeGeneration;
    const delay = nextHelpNudgeDelay({ seed: state.game?.seed, sequence: nudgeSequence++ });
    nudgeTimer = viewWindow?.setTimeout?.(() => {
      nudgeTimer = null;
      if (generation !== nudgeGeneration || !helpNudgeEligible()) return;
      renderHelpNudge();
    }, delay) ?? null;
    return true;
  }

  function dismissHelpNudge() {
    hideHelpNudge();
    armHelpNudge();
  }

  function noteHelpNudgeActivity(event) {
    if (event?.target?.closest?.("#helpNudge")) return;
    armHelpNudge();
  }

  function pulsePathGuardNodes(...nodes) {
    for (const element of nodes) {
      if (!element) continue;
      element.classList.remove("combining", "merging", "rejected");
      element.classList.add("wrong-path");
      viewWindow?.setTimeout?.(() => element.classList.remove("wrong-path"), 760);
    }
  }

  function showPathGuardFeedback(a, b, { remembered = false, elements: nodes = [] } = {}) {
    pulsePathGuardNodes(...nodes);
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

  function showConceptChemistryFeedback(a, b, guide, decision, { elements: nodes = [] } = {}) {
    pulsePathGuardNodes(...nodes);
    pulseConceptBond();
    const detour = guide?.detour?.active === true;
    const reaction = guide?.expectedProduct
      ? `${guide.activeWord} + ${guide.requiredPartner} → ${guide.expectedProduct}`
      : `${guide?.activeWord || "the connected word"} + ${guide?.requiredPartner || "its reagent"}`;
    const message = detour
      ? `CONCEPT BOND · REAGENT REQUIRED · Finish ${reaction} before returning to ${guide.backboneProduct || state.game?.target}. Words kept; move unchanged.`
      : `CONCEPT BOND · REACTION LOCKED · Finish ${reaction} before starting ${a} + ${b}. Words kept; move unchanged.`;
    showAlchemy(message, false, false, {
      tone: "wrong-path",
      key: `concept-bond:${pathGuardPairKey(a, b)}`,
      duration: 4200
    });
    playFeedback("uiSelect");
    announceBoardMessage(`${decision?.message || "Finish the active reaction first."} ${reaction}.`, "board-notice");
    return message;
  }

  return Object.freeze({
    pathGuardActiveFor,
    acceptConceptChemistryGuide,
    conceptChemistryGuideForState,
    rememberPathGuardPair,
    pathGuardPairWasRemembered,
    publishedGuidanceAssist,
    nextHelpNudgeScoreMultiplier,
    scoreMultiplierPercent,
    helpNudgeCostText,
    hideHelpNudge,
    cancelHelpNudge,
    helpNudgeEligible,
    renderHelpNudge,
    armHelpNudge,
    dismissHelpNudge,
    noteHelpNudgeActivity,
    showPathGuardFeedback,
    showConceptChemistryFeedback,
    destroy() { cancelHelpNudge(); }
  });
}
