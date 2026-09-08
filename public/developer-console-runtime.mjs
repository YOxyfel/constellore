import {
  DEVELOPER_RANK_OPTIONS,
  createDeveloperDifficultyState,
  createDeveloperRankPreset,
  createDeveloperShowcaseCardInput,
  developerModeAvailability,
  normalizeDeveloperDifficultyLevel,
  verifyDeveloperCredentials
} from "./developer-console.mjs?v=5.0.0-beta.4";
import { sanitizeAdaptiveDifficultyState } from "./adaptive-difficulty.mjs?v=5.0.0-beta.4";
import { sanitizeFirstOrbitState } from "./first-orbit.mjs?v=5.0.0-beta.4";
import { sanitizeSecondOrbitState } from "./second-orbit.mjs?v=5.0.0-beta.4";
import {
  getRemixRankPresentation,
  sanitizeRemixProgressionState
} from "./remix-progression.mjs?v=5.0.0-beta.4";
import {
  createRemixReadinessState,
  sanitizeRemixReadinessState
} from "./remix-readiness.mjs?v=5.0.0-beta.4";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const developerStylesReady = typeof document === "undefined"
  ? Promise.resolve()
  : new Promise((resolve) => {
      const existing = document.querySelector('link[data-developer-console-styles]');
      if (existing?.sheet) {
        resolve();
        return;
      }
      const link = existing || document.createElement("link");
      link.rel = "stylesheet";
      link.href = new URL(
        "./developer-console.css?v=5.0.0-beta.4",
        import.meta.url
      ).href;
      link.dataset.developerConsoleStyles = "true";
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", resolve, { once: true });
      if (!existing) document.head.append(link);
    });

export function clearConstelloreStorage(storage) {
  if (!storage) return;
  const keys = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && (key.startsWith("constellore-") || key.startsWith("wordforge-"))) {
        keys.push(key);
      }
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Reload still starts from in-memory defaults when storage is unavailable.
  }
}

export function createDeveloperConsoleController(services) {
  const {
    isStaticBeta,
    stopTimer,
    closeHubMenu,
    showToast,
    getState,
    getProfile,
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
    populateShare,
    cosmicGate,
    downloadJson,
    getTodayKey,
    cancelExpectedPairDelivery,
    clearActiveRunSnapshot,
    reload
  } = services;

  const dialogs = {
    login: $("#developerLoginDialog"),
    console: $("#developerDialog"),
    vfx: $("#developerVfxDialog"),
    share: $("#shareDialog")
  };
  let unlocked = false;
  let resetTimer = null;
  let resetArmedUntil = 0;

  function authorized() {
    return isStaticBeta && unlocked;
  }

  function difficultyDescription(level) {
    const safeLevel = normalizeDeveloperDifficultyLevel(level);
    if (safeLevel <= 3) return "Gentle target selection";
    if (safeLevel <= 7) return "Standard target selection";
    return "Difficult target selection";
  }

  function setStatus(message = "", { error = false } = {}) {
    const output = $("#developerStatus");
    if (!output) return;
    output.textContent = message;
    output.classList.toggle("error", error);
  }

  function setLoginStatus(message = "") {
    const output = $("#developerLoginStatus");
    if (output) output.textContent = message;
  }

  function resetConfirmation() {
    clearTimeout(resetTimer);
    resetTimer = null;
    resetArmedUntil = 0;
    const reset = $("#resetDeveloperFreshStart");
    const cancel = $("#cancelDeveloperReset");
    reset?.classList.remove("is-armed");
    if (reset) {
      reset.disabled = false;
      reset.querySelector("span").textContent = "Reset everything and restart";
    }
    if (cancel) cancel.hidden = true;
  }

  function markOverride() {
    const trigger = $("#developerMenuButton");
    const stateLabel = $("#developerTriggerState");
    const rank = currentRouteRank().rank;
    const level = sanitizeAdaptiveDifficultyState(getState().adaptiveDifficulty).level;
    if (!trigger || !stateLabel) return;
    trigger.dataset.override = "true";
    stateLabel.hidden = false;
    stateLabel.textContent = `${rank.name.toUpperCase()} · L${level}`;
    trigger.setAttribute(
      "aria-label",
      `Open developer console. ${rank.name} Route Rank, adaptive level ${level} override active.`
    );
  }

  function renderRankChoice() {
    const select = $("#developerRank");
    const summary = $("#developerRankSummary");
    if (!select || !summary) return;
    const rank = DEVELOPER_RANK_OPTIONS.find((entry) => entry.id === select.value)
      || DEVELOPER_RANK_OPTIONS[0];
    const presentation = getRemixRankPresentation(rank.id);
    const preset = createDeveloperRankPreset(rank.id);
    summary.textContent = `${presentation.summary} · ${preset.minimumWins} completed game${preset.minimumWins === 1 ? "" : "s"}`;
  }

  function renderDifficultyChoice() {
    const input = $("#developerDifficulty");
    const output = $("#developerDifficultyValue");
    const summary = $("#developerDifficultySummary");
    if (!input || !output || !summary) return;
    const level = normalizeDeveloperDifficultyLevel(input.value);
    output.value = String(level);
    output.textContent = String(level);
    summary.textContent = difficultyDescription(level);
  }

  function renderConsole() {
    const select = $("#developerRank");
    if (!select) return;
    if (!select.options.length) {
      select.replaceChildren(...DEVELOPER_RANK_OPTIONS.map((rank) => {
        const option = document.createElement("option");
        option.value = rank.id;
        option.textContent = rank.label;
        return option;
      }));
    }
    const routeRank = currentRouteRank();
    const rank = routeRank.rank || getRemixRankPresentation("bronze");
    const state = getState();
    const profile = getProfile();
    const adaptive = sanitizeAdaptiveDifficultyState(state.adaptiveDifficulty);
    const menu = homeMenuState();
    select.value = rank.id;
    $("#developerDifficulty").value = String(adaptive.level);
    $("#developerCurrentRank").textContent = rank.name;
    $("#developerCurrentDifficulty").textContent = String(adaptive.level);
    $("#developerCurrentWins").textContent = String(profile.wins);
    renderRankChoice();
    renderDifficultyChoice();

    const availability = new Map(developerModeAvailability({
      rank: rank.id,
      wins: profile.wins,
      onboardingComplete: menu.onboardingComplete
    }).map((mode) => [mode.id, mode]));
    $$("[data-developer-mode]").forEach((button) => {
      const mode = button.dataset.developerMode;
      const result = mode === "second-orbit"
        ? { available: true, reason: "" }
        : availability.get(mode) || {
            available: false,
            reason: "Unavailable for this preset."
          };
      const detail = button.querySelector("small");
      if (detail && !button.dataset.defaultDescription) {
        button.dataset.defaultDescription = detail.textContent;
      }
      button.disabled = !result.available;
      button.title = result.reason || "";
      if (detail) {
        detail.textContent = result.available
          ? button.dataset.defaultDescription
          : result.reason;
      }
    });
  }

  function showConsole() {
    if (!authorized()) return open();
    stopTimer();
    if (dialogs.login.open) dialogs.login.close();
    renderConsole();
    resetConfirmation();
    setStatus("");
    if (!dialogs.console.open) dialogs.console.showModal();
    requestAnimationFrame(() => $("#developerRank")?.focus({ preventScroll: true }));
  }

  async function open() {
    if (!isStaticBeta) return;
    await developerStylesReady;
    const otherDialog = document.querySelector("dialog[open]");
    if (otherDialog && ![dialogs.login, dialogs.console].includes(otherDialog)) {
      if (otherDialog.id === "hubMenuDialog") closeHubMenu();
      else {
        showToast("Close the current window before opening developer tools.", {
          scope: "global"
        });
        return;
      }
    }
    if (unlocked) return showConsole();
    stopTimer();
    setLoginStatus("");
    $("#developerLoginPassword").value = "";
    if (!dialogs.login.open) dialogs.login.showModal();
    requestAnimationFrame(() => $("#developerLoginName")?.focus({ preventScroll: true }));
  }

  function toggle() {
    if (!isStaticBeta) return;
    if (dialogs.vfx.open) {
      closeVfxPreview({ reopen: false });
      return;
    }
    if (dialogs.console.open) {
      dialogs.console.close();
      return;
    }
    if (dialogs.login.open) {
      dialogs.login.close();
      return;
    }
    open();
  }

  function submitLogin(event) {
    event.preventDefault();
    if (!isStaticBeta) return;
    const username = $("#developerLoginName").value;
    const password = $("#developerLoginPassword").value;
    if (!verifyDeveloperCredentials(username, password)) {
      $("#developerLoginPassword").value = "";
      setLoginStatus("That login name or password is not correct.");
      $("#developerLoginPassword").focus();
      return;
    }
    unlocked = true;
    $("#developerLoginForm").reset();
    setLoginStatus("");
    showConsole();
  }

  function lock() {
    unlocked = false;
    resetConfirmation();
    if (dialogs.console.open) dialogs.console.close();
    showToast("Developer console locked.", { scope: "global" });
  }

  function endLocalRunForChange() {
    const state = getState();
    if (state.startingRun) {
      setStatus("Wait for the current game to finish loading.", { error: true });
      return false;
    }
    if (state.game || state.pendingMission) returnHome({ skipForfeit: true });
    return true;
  }

  function applyRankPreset() {
    if (!authorized() || !endLocalRunForChange()) return;
    let preset;
    try {
      preset = createDeveloperRankPreset($("#developerRank").value);
    } catch (error) {
      setStatus(error.message, { error: true });
      return;
    }
    const profile = getProfile();
    const state = getState();
    profile.routeProgression = preset.routeProgression;
    profile.remixReadiness = createRemixReadinessState();
    profile.routeOutcomeHashes = [];
    profile.lastRouteOutcome = "";
    profile.routeRank = null;
    profile.wins = preset.minimumWins;
    profile.firstOrbit = preset.firstOrbit;
    profile.secondOrbit = preset.secondOrbit;
    state.remixProgress = null;
    applyRouteRank(localRouteRankSummary());
    markOverride();
    renderConsole();
    setStatus(`${preset.rank.name} preset active · ${preset.minimumWins} completed game${preset.minimumWins === 1 ? "" : "s"} · local and unranked.`);
  }

  function applyDifficulty() {
    if (!authorized() || !endLocalRunForChange()) return;
    const state = getState();
    const profile = getProfile();
    const level = normalizeDeveloperDifficultyLevel($("#developerDifficulty").value);
    state.adaptiveDifficulty = createDeveloperDifficultyState(level);
    saveAdaptiveDifficulty();
    profile.routeRank = null;
    applyRouteRank(localRouteRankSummary());
    markOverride();
    renderConsole();
    setStatus(`Adaptive level ${level} active for the next personal test game.`);
  }

  function currentMode(mode) {
    if (mode === "second-orbit") return { available: true, reason: "" };
    const routeRank = currentRouteRank().rank;
    const profile = getProfile();
    const menu = homeMenuState();
    return developerModeAvailability({
      rank: routeRank.id,
      wins: profile.wins,
      onboardingComplete: menu.onboardingComplete
    }).find((entry) => entry.id === mode) || {
      available: false,
      reason: "Unavailable for this preset."
    };
  }

  async function launchGame(event) {
    if (!authorized()) return;
    const button = event.currentTarget;
    const mode = button.dataset.developerMode;
    const availability = currentMode(mode);
    if (!availability.available) {
      setStatus(availability.reason, { error: true });
      return;
    }
    const state = getState();
    const profile = getProfile();
    if (state.startingRun) {
      setStatus("Wait for the current game to finish loading.", { error: true });
      return;
    }
    if (state.game || state.pendingMission) returnHome({ skipForfeit: true });
    if (mode === "daily") {
      profile.dailyCompleted = "";
      profile.dailyPlayed = "";
    }
    if (mode === "weekly") {
      profile.weekly = { key: currentWeekKey(), stage: 0, complete: false };
    }
    saveProfile({ cloud: false });
    const routeRank = currentRouteRank().rank;
    const level = sanitizeAdaptiveDifficultyState(state.adaptiveDifficulty).level;
    const seed = stableHash(`developer|${routeRank.id}|${level}|${mode}`);
    if (dialogs.console.open) dialogs.console.close();
    if (mode === "training") {
      await startFirstOrbit({ enterThroughGate: true });
      return;
    }
    if (mode === "second-orbit") {
      await startSecondOrbit({ enterThroughGate: true });
      return;
    }
    await beginMode(mode, { seed, trigger: button });
  }

  function showcaseShareCard() {
    if (!authorized()) return;
    const sample = createDeveloperShowcaseCardInput();
    const game = {
      target: sample.target,
      emoji: sample.emoji,
      clue: sample.clue,
      category: sample.realm,
      mode: sample.mode,
      seed: stableHash(sample.seedIdentity),
      universe: sample.universe,
      law: sample.law
    };
    stopTimer();
    populateShare(game, sample.completed, sample);
    $("#shareEyebrow").textContent = "DEVELOPER PREVIEW · SHARING CARD";
    $("#shareTitle").textContent = "A completed constellation card";
    $("#shareDescription").textContent = "This deterministic sample uses the same renderer and download path as a real completed game.";
    $("#shareCard small").textContent = "CONSTELLORE SHOWCASE";
    $("#copyChallenge").hidden = true;
    $("#nativeShare").hidden = true;
    if (dialogs.console.open) dialogs.console.close();
    dialogs.share.showModal();
  }

  async function showcaseFirstWin() {
    if (!authorized()) return;
    stopTimer();
    if (dialogs.console.open) dialogs.console.close();
    await cosmicGate.presentDialog(dialogs.vfx, {
      kind: "victory",
      label: "Mud discovered",
      focus: "#finishDeveloperVfx",
      celebration: {
        kind: "first-orbit",
        word: "Mud",
        emoji: "🟤"
      }
    });
  }

  function closeVfxPreview({ reopen = true } = {}) {
    if (dialogs.vfx.open) dialogs.vfx.close();
    cosmicGate.clearDialog(dialogs.vfx);
    if (reopen && authorized()) showConsole();
  }

  function exportSnapshot() {
    if (!authorized()) return;
    const state = getState();
    const profile = getProfile();
    const routeRank = currentRouteRank();
    downloadJson(`constellore-dev-snapshot-${getTodayKey()}.json`, {
      version: 1,
      exportedAt: new Date().toISOString(),
      build: {
        version: document.body.dataset.buildVersion || "",
        id: document.body.dataset.buildId || ""
      },
      current: {
        rank: routeRank.rank,
        challengeRank: routeRank.challengeRank,
        adaptiveDifficulty: sanitizeAdaptiveDifficultyState(state.adaptiveDifficulty),
        completedGames: profile.wins,
        firstOrbit: sanitizeFirstOrbitState(profile.firstOrbit),
        secondOrbit: sanitizeSecondOrbitState(profile.secondOrbit),
        homeMenu: homeMenuState()
      },
      progression: {
        route: sanitizeRemixProgressionState(profile.routeProgression),
        readiness: sanitizeRemixReadinessState(profile.remixReadiness),
        weekly: { ...profile.weekly }
      },
      activeGame: state.game ? {
        mode: state.mode,
        target: state.game.target,
        tier: state.game.tier,
        challengeLevel: state.game.challengeLevel,
        moves: state.moves,
        finished: state.finished
      } : null
    });
    setStatus("Sanitized debug snapshot exported.");
  }

  function resetFreshStart() {
    if (!authorized()) return;
    if (Date.now() > resetArmedUntil) {
      resetArmedUntil = Date.now() + 8000;
      const reset = $("#resetDeveloperFreshStart");
      reset.classList.add("is-armed");
      reset.querySelector("span").textContent = "Confirm erase and restart";
      $("#cancelDeveloperReset").hidden = false;
      setStatus("Click Confirm erase and restart within 8 seconds. This removes every local Constellore save.");
      resetTimer = setTimeout(() => {
        resetConfirmation();
        setStatus("Fresh-start reset cancelled.");
      }, 8000);
      return;
    }
    clearTimeout(resetTimer);
    const reset = $("#resetDeveloperFreshStart");
    reset.disabled = true;
    reset.querySelector("span").textContent = "Resetting…";
    cancelExpectedPairDelivery();
    stopTimer();
    const state = getState();
    state.finished = true;
    state.game = null;
    state.run = null;
    state.pendingMission = null;
    clearActiveRunSnapshot();
    clearConstelloreStorage(localStorage);
    clearConstelloreStorage(sessionStorage);
    unlocked = false;
    reload();
  }

  function cancelReset() {
    resetConfirmation();
    setStatus("Fresh-start reset cancelled.");
  }

  $("#developerLoginForm").addEventListener("submit", submitLogin);
  $("#lockDeveloperConsole").addEventListener("click", lock);
  $("#developerRank").addEventListener("change", renderRankChoice);
  $("#developerDifficulty").addEventListener("input", renderDifficultyChoice);
  $("#applyDeveloperRank").addEventListener("click", applyRankPreset);
  $("#applyDeveloperDifficulty").addEventListener("click", applyDifficulty);
  $$("[data-developer-mode]").forEach((button) => {
    button.addEventListener("click", launchGame);
  });
  $("#showcaseShareCard").addEventListener("click", showcaseShareCard);
  $("#showcaseFirstWin").addEventListener("click", showcaseFirstWin);
  $("#exportDeveloperSnapshot").addEventListener("click", exportSnapshot);
  $("#resetDeveloperFreshStart").addEventListener("click", resetFreshStart);
  $("#cancelDeveloperReset").addEventListener("click", cancelReset);
  $("#closeDeveloperVfx").addEventListener("click", () => closeVfxPreview());
  $("#finishDeveloperVfx").addEventListener("click", () => closeVfxPreview());
  dialogs.console.addEventListener("close", resetConfirmation);
  dialogs.vfx.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeVfxPreview();
  });

  return Object.freeze({ open, toggle });
}
