export function createPowerupRenderer({
  $,
  els,
  getState,
  getProfile,
  learningOrbitActive,
  clamp,
  quickTipLimit,
  scoreMultiplierPercent,
  nextHelpNudgeScoreMultiplier,
  helpNudgeCostText,
  sanitizeSenseWallet,
  activeArmedPowerup,
  renderStardustRefills,
  renderHintObjective
} = {}) {
  return function renderPowerups() {
    const state = getState();
    const profile = getProfile();
    const QUICK_TIP_LIMIT = quickTipLimit;

    const activeRun = Boolean(state.game && state.run && !state.finished && !state.startingRun && !state.reveal.active && !state.reveal.pending && !state.busyPairs.size);
    const compassRunEligible = activeRun && !learningOrbitActive() && state.mode !== "explore" && !state.scoringDisabled;
    const tipsUsed = clamp(Number(state.powerups?.tipsUsed) || 0, 0, QUICK_TIP_LIMIT);
    const tipsRemaining = QUICK_TIP_LIMIT - tipsUsed;
    const nextTipPercent = scoreMultiplierPercent(nextHelpNudgeScoreMultiplier());
    const nextTipCost = helpNudgeCostText();
    const senseCount = sanitizeSenseWallet(profile.senseWallet).charges;
    const giftReady = !state.powerups.giftUsed && !state.powerups.giftUnavailable;
    const armedKind = activeArmedPowerup();
    const useSenseButton = $("#useSense");
    const useSenseLabel = useSenseButton?.querySelector("span");
    const useSenseStock = $("#useSenseStock") || $("#senseDialogCount");
    const senseLoading = useSenseButton?.dataset.loading === "true";
    const senseChargesLabel = `${senseCount} charge${senseCount === 1 ? "" : "s"}`;
    els.senseButton.disabled = !activeRun;
    els.quickTipCount.textContent = `${tipsRemaining} left`;
    if (els.quickTipCost) els.quickTipCost.textContent = tipsRemaining
      ? `${nextTipCost}.`
      : "All three hints used.";
    els.useQuickTip.disabled = !activeRun || state.powerups.busy || tipsRemaining <= 0;
    els.wordGiftState.textContent = state.powerups.giftUsed ? "Used" : state.powerups.giftUnavailable ? "Unavailable" : "1 left";
    els.wordGiftCard.classList.toggle("is-used", state.powerups.giftUsed);
    els.wordGiftCard.classList.toggle("is-unavailable", state.powerups.giftUnavailable);
    els.useWordGift.disabled = !activeRun || state.powerups.busy || state.powerups.giftUsed || state.powerups.giftUnavailable;
    if (useSenseButton) {
      useSenseButton.disabled = !compassRunEligible || state.powerups.busy || !senseCount;
      useSenseButton.classList.toggle("is-armed", armedKind === "sense");
      useSenseButton.setAttribute("aria-label", armedKind === "sense"
        ? `Confirm Star Compass; spend one of ${senseChargesLabel}; this orbit enters the Open division at 75% score`
        : `Use Star Compass; ${senseChargesLabel} ready; confirmation required; this orbit enters the Open division at 75% score`);
    }
    if (useSenseLabel) useSenseLabel.textContent = senseLoading
      ? "Listening to the cosmos\u2026"
      : armedKind === "sense"
        ? "Confirm use \u00b7 keep 75%"
        : "Use Compass \u00b7 keep 75%";
    if (useSenseStock) useSenseStock.textContent = senseLoading
      ? `${senseChargesLabel} left \u00b7 finding a direction\u2026`
      : armedKind === "sense"
        ? `${senseChargesLabel} ready \u00b7 tap again within 4 seconds`
        : !senseCount
          ? "0 charges ready \u00b7 earn or buy one"
          : !compassRunEligible
            ? `${senseChargesLabel} ready \u00b7 use in a scored orbit`
            : `${senseChargesLabel} ready`;
  
    els.quickTipShortcutCount.textContent = tipsRemaining > 0 ? String(tipsRemaining) : "+";
    els.quickTipShortcut.disabled = !activeRun || state.powerups.busy;
    els.quickTipShortcut.setAttribute("aria-label", tipsRemaining
      ? `Read a Route Signal; ${tipsRemaining} remaining; ${nextTipCost.toLowerCase()}`
      : "Route Signals are empty; open Stardust supplies to see when they refill");
    els.quickTipShortcut.setAttribute("aria-haspopup", tipsRemaining ? "false" : "dialog");
    if (tipsRemaining) els.quickTipShortcut.removeAttribute("aria-controls");
    else els.quickTipShortcut.setAttribute("aria-controls", "stardustDialog");
    els.quickTipShortcut.title = tipsRemaining ? `1 · Route Signal · ${tipsRemaining} remaining · ${nextTipPercent}% score and Stardust; Star Credits reduced too` : "1 · Route Signals empty · see refill information";
    els.quickTipShortcut.classList.toggle("is-empty", tipsRemaining <= 0);
  
    els.wordGiftShortcutCount.textContent = state.powerups.giftUsed ? "✓" : giftReady ? "1" : "+";
    els.wordGiftShortcut.disabled = !activeRun || state.powerups.busy;
    els.wordGiftShortcut.setAttribute("aria-label", armedKind === "gift"
      ? "Confirm Word Gift now; this keeps half score in the Open division"
      : state.powerups.giftUsed
      ? "Word Gift used; open Stardust supplies to see when it refills"
      : state.powerups.giftUnavailable
        ? "Word Gift unavailable; open Stardust supplies for refill information"
        : "Use Word Gift; 1 ready; keeps half score in the Open division");
    els.wordGiftShortcut.setAttribute("aria-haspopup", giftReady ? "false" : "dialog");
    if (giftReady) els.wordGiftShortcut.removeAttribute("aria-controls");
    else els.wordGiftShortcut.setAttribute("aria-controls", "stardustDialog");
    els.wordGiftShortcut.classList.toggle("is-used", state.powerups.giftUsed);
    els.wordGiftShortcut.classList.toggle("is-empty", !giftReady && !state.powerups.giftUsed);
    els.wordGiftShortcut.classList.toggle("is-armed", armedKind === "gift");
    els.wordGiftShortcut.title = state.powerups.giftUsed
      ? "3 · Word Gift used · Open · 50% score"
      : state.powerups.giftUnavailable
        ? "3 · No undiscovered bridge is available · see refill information"
        : "3 · Use Word Gift · Open · keep 50% score";
  
    els.senseShortcutCount.textContent = senseCount > 0 ? String(senseCount) : "+";
    els.senseShortcut.disabled = !compassRunEligible || state.powerups.busy;
    els.senseShortcut.setAttribute("aria-label", armedKind === "sense"
      ? "Confirm Star Compass now; this keeps 75% score in the Open division"
      : senseCount
        ? `Use Star Compass; ${senseCount} charge${senseCount === 1 ? "" : "s"}; keeps 75% score in the Open division`
        : "Star Compass is empty; open Stardust supplies to get more");
    els.senseShortcut.setAttribute("aria-haspopup", senseCount ? "false" : "dialog");
    if (senseCount) els.senseShortcut.removeAttribute("aria-controls");
    else els.senseShortcut.setAttribute("aria-controls", "stardustDialog");
    els.senseShortcut.classList.toggle("is-empty", senseCount <= 0);
    els.senseShortcut.classList.toggle("is-armed", armedKind === "sense");
    els.senseShortcut.title = senseCount ? `2 · Use Star Compass · ${senseCount} charge${senseCount === 1 ? "" : "s"} · keep 75% score` : "2 · Star Compass empty · get more";
    const revealReady = activeRun && !state.reveal.revealed;
    els.revealShortcutCount.textContent = state.reveal.revealed ? "✓" : "∞";
    els.revealShortcut.disabled = !revealReady || state.powerups.busy;
    els.revealShortcut.classList.toggle("is-used", state.reveal.revealed);
    els.revealShortcut.setAttribute("aria-label", state.reveal.revealed
      ? "Complete route already revealed in this Study run"
      : "Reveal the complete route; changes this to a Study run with no score; confirmation required");
    els.revealShortcut.title = state.reveal.revealed ? "4 · Route already revealed" : "4 · Reveal route · Study with no score";
    els.powerupShopShortcut.disabled = !activeRun || state.powerups.busy;
    els.powerupShopShortcut.setAttribute("aria-label", `Open Stardust supplies; ${senseCount} Star Compass charge${senseCount === 1 ? "" : "s"} currently available`);
    const standaloneMode = learningOrbitActive() || state.mode === "explore";
    els.senseHudCount.textContent = state.mode === "explore" ? "OFF" : learningOrbitActive() ? "LESSON" : state.scoringDisabled ? "STUDY" : `${tipsRemaining} LEFT`;
    els.senseButton.setAttribute("aria-label", standaloneMode
      ? `${state.mode === "explore" ? "Help is not needed in free play" : "This lesson includes its own hint"}`
      : `Open Need help information; ${tipsRemaining} Route Signal${tipsRemaining === 1 ? "" : "s"} left`);
    if (els.stardustDialog.open) renderStardustRefills();
    renderHintObjective();
    };
}

