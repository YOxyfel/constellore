const starterEmoji = { Earth: "🌍", Water: "💧", Fire: "🔥", Air: "💨" };
const starterCategory = { Earth: "nature", Water: "force", Fire: "force", Air: "force" };
const isStaticBeta = document.body.dataset.runtime === "local-practice";
const PROFILE_KEY = isStaticBeta ? "constellore-local-profile-v1" : "constellore-profile-v1";
const LEGACY_PROFILE_KEYS = isStaticBeta ? [] : ["wordforge-profile-v3", "wordforge-profile-v2"];
const todayKey = new Date().toISOString().slice(0, 10);
const sessionId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const defaultProfile = {
  version: 3,
  playerId: "",
  playerToken: "",
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
  weekly: { key: "", stage: 0, complete: false }
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
  busyPairs: new Set(),
  selectedNodeId: null,
  timerId: null,
  remainingSeconds: 0,
  startedAt: 0,
  finished: false,
  startingRun: false,
  wished: false,
  rewardedWish: false,
  cosmosFrame: null,
  stars: [],
  resultAction: null,
  shareGame: null,
  installPrompt: null,
  run: null,
  assist: "none",
  scoringDisabled: false,
  reveal: {
    active: false,
    paused: false,
    speed: 1,
    skip: false,
    pending: false,
    revealed: false,
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
  leaderboardDivision: "pure"
};

let profile = loadProfile();
let config = { billingEnabled: false, checkoutUrl: "", testStoreEnabled: false, creditPacks: [], rewardedAdsEnabled: false, founderPrice: "€6.99", aiEnabled: false };
let localRuntimePromise;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const billingAdapter = () => globalThis.constelloreBilling || globalThis.wordforgeBilling;
const adsAdapter = () => globalThis.constelloreAds || globalThis.wordforgeAds;
const creditsAdapter = () => globalThis.constelloreCredits || globalThis.wordforgeCredits;
const els = {
  startScreen: $("#startScreen"), gameScreen: $("#gameScreen"), targetMessage: $("#targetMessage"),
  board: $("#board"), boardItems: $("#boardItems"), boardGuide: $("#boardGuide"), cosmosCanvas: $("#cosmosCanvas"),
  alchemyNote: $("#alchemyNote"), wordList: $("#wordList"), collectionCount: $("#collectionCount"),
  modeName: $("#modeName"), targetWord: $("#targetWord"), lawPill: $("#lawPill"), movesValue: $("#movesValue"),
  timerHud: $("#timerHud"), timerValue: $("#timerValue"), pathCount: $("#pathCount"),
  milestoneText: $("#milestoneText"), milestoneBar: $("#milestoneBar"), wishState: $("#wishState"),
  paywallDialog: $("#paywallDialog"), wishDialog: $("#wishDialog"), atlasDialog: $("#atlasDialog"),
  profileDialog: $("#profileDialog"), shareDialog: $("#shareDialog"), resultDialog: $("#resultDialog"),
  exchangeDialog: $("#exchangeDialog"), marketBuyDialog: $("#marketBuyDialog"), leaderboardDialog: $("#leaderboardDialog"),
  revealDialog: $("#revealDialog"), revealController: $("#revealController"), revealPathButton: $("#revealPathButton"),
  revealStepText: $("#revealStepText"), revealPause: $("#revealPause"), revealSpeed: $("#revealSpeed"),
  revealSkip: $("#revealSkip"), revealProgressBar: $("#revealProgressBar"), revealAnnouncement: $("#revealAnnouncement"),
  marketList: $("#marketList"), marketBalance: $("#marketBalance"), marketCountdown: $("#marketCountdown"),
  marketMessage: $("#marketMessage"), leaderboardRows: $("#leaderboardRows"), leaderboardMessage: $("#leaderboardMessage"),
  resultEmoji: $("#resultEmoji"), resultKicker: $("#resultKicker"), resultTitle: $("#resultTitle"),
  resultStats: $("#resultStats"), resultPrimary: $("#resultPrimary"), resultRetry: $("#resultRetry"),
  resultShare: $("#resultShare"), rewardCard: $("#rewardCard"), rewardDust: $("#rewardDust"),
  rewardReason: $("#rewardReason"), toast: $("#toast"), connectionBadge: $("#connectionBadge")
};

function loadProfile() {
  try {
    const legacyProfile = LEGACY_PROFILE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || legacyProfile || "null");
    if (!stored || typeof stored !== "object") return structuredClone(defaultProfile);
    return {
      ...structuredClone(defaultProfile),
      ...stored,
      version: 3,
      vault: Array.isArray(stored.vault) ? stored.vault : [],
      discovered: Array.isArray(stored.discovered) ? [...new Set([...defaultProfile.discovered, ...stored.discovered])].slice(0, 1000) : [...defaultProfile.discovered],
      weekly: { ...defaultProfile.weekly, ...(stored.weekly || {}) }
    };
  } catch {
    return structuredClone(defaultProfile);
  }
}

function saveProfile() {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* Private mode can disable storage. */ }
  renderProfile();
}

function rankFor(stardust) {
  const ranks = ["Stargazer I", "Stargazer II", "Pathfinder", "Constellation Keeper", "Reality Weaver", "Loreweaver"];
  const level = Math.min(ranks.length, Math.floor(Math.max(0, stardust) / 250) + 1);
  return { level, name: ranks[level - 1], progress: level === ranks.length ? 100 : (stardust % 250) / 2.5 };
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
  const completed = profile.dailyCompleted === todayKey;
  $("#dailyCard").classList.toggle("completed", completed);
  $("#dailyState").textContent = completed ? "COMPLETED" : "AVAILABLE";
  $("#dailyButton").disabled = completed;
  $("#dailyButton span").textContent = completed ? "Return tomorrow" : "Accept challenge";
}

function renderProfile() {
  setupWeeklyState();
  setupDailyState();
  const rank = rankFor(profile.stardust);
  document.body.dataset.theme = profile.theme || "void";
  $("#profileLevel").textContent = rank.level;
  $("#profileDust").textContent = profile.stardust;
  $("#universeRank").textContent = rank.name;
  $("#rankProgress").style.width = `${rank.progress}%`;
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
  $("#profileCredits").textContent = profile.credits;
  $("#profileVaultCount").textContent = profile.vault.length;
  $("#marketBalance").textContent = profile.credits;
  $("#vaultCount").textContent = profile.vault.length;
  $$('[data-theme]').forEach((button) => button.classList.toggle("active", button.dataset.theme === profile.theme));
  updateWishButton();
}

function applyServerPlayer(player) {
  if (!player) return;
  const founderActivated = Boolean(player.founderPass) && !profile.premium;
  profile.playerId = player.id || profile.playerId;
  profile.callsign = player.callsign || profile.callsign;
  profile.credits = Number(player.credits) || 0;
  profile.vault = Array.isArray(player.vault) ? player.vault : [];
  profile.premium = Boolean(player.founderPass);
  profile.freeWishUsed = Boolean(player.freeWishUsed);
  profile.wishAvailable = player.wishAvailable !== false;
  profile.dailyWishUsedDate = player.dailyWishUsedDate || "";
  if (founderActivated) profile.streakShields += 1;
  saveProfile();
  renderWishVault();
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

async function ensurePlayer() {
  if (profile.playerId && profile.playerToken) {
    try {
      const { player } = await fetchJson("/api/player", { headers: authHeaders() });
      applyServerPlayer(player);
      return player;
    } catch { /* Register a replacement guest identity below. */ }
  }
  const { player, playerToken } = await fetchJson("/api/player/register", { method: "POST" });
  profile.playerToken = playerToken;
  applyServerPlayer(player);
  return player;
}

async function loadConfig() {
  try {
    config = { ...config, ...(await fetchJson("/api/config")) };
  } catch { /* Offline boot keeps safe defaults. */ }
  $("#founderPrice").textContent = config.founderPrice;
  const checkoutButton = $("#checkoutButton");
  const checkoutLabel = $("#checkoutButton span");
  checkoutButton.disabled = false;
  if (profile.premium) {
    checkoutLabel.textContent = "Founder's Pass owned";
    checkoutButton.disabled = true;
    $("#billingNote").textContent = "Your lifetime pass is active. One personal Wish renews each UTC day.";
  } else if (config.testStoreEnabled && !config.billingEnabled && !billingAdapter()) {
    checkoutLabel.textContent = "Unlock test pass";
    $("#billingNote").textContent = "Development store: unlock a server test entitlement. No charge.";
  } else if (!config.billingEnabled && !billingAdapter()) {
    checkoutLabel.textContent = "Coming after the beta";
    checkoutButton.disabled = true;
    $("#billingNote").textContent = "Purchases are safely disabled during the free beta. Your first Wish is still free.";
  }
  renderCreditPacks();
  $("#rewardWish").hidden = !(config.rewardedAdsEnabled && adsAdapter()?.showRewarded);
}

async function fetchJson(url, options = {}, timeout = 20000) {
  if (isStaticBeta) {
    localRuntimePromise ||= import("./local-beta.mjs");
    const runtime = await localRuntimePromise;
    return runtime.localRequest(url, options);
  }
  const controller = new AbortController();
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
  }
}

function track(name, properties = {}) {
  if (isStaticBeta) return;
  const body = JSON.stringify({ name, sessionId, properties });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    else fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* Analytics must never interrupt play. */ }
}

async function beginMode(mode, options = {}) {
  if (state.startingRun) return;
  if (mode === "daily" && profile.dailyCompleted === todayKey) return;
  if (mode === "weekly" && profile.weekly.complete) return;
  state.startingRun = true;
  if (state.game) updateHud();
  const button = document.querySelector(`[data-mode="${mode}"]`);
  const label = button?.classList.contains("mode-action") ? button.querySelector("span") : null;
  const original = label?.textContent;
  if (button) button.disabled = true;
  if (label) label.textContent = "Mapping orbit…";
  try {
    if (!profile.playerId || !profile.playerToken) await ensurePlayer();
    const seed = options.seed ?? (mode === "daily" ? Math.floor(Date.now() / 86_400_000) : mode === "weekly" ? currentWeekSeed() : Math.floor(Math.random() * 1_000_000));
    const started = await fetchJson("/api/run/start", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ mode, seed, target: options.target || "", stage: mode === "weekly" ? profile.weekly.stage : undefined })
    });
    applyServerPlayer(started.player);
    startWithGame(started.game, started.run);
  } catch (error) {
    showToast(error.message);
  } finally {
    state.startingRun = false;
    if (state.game) updateHud();
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
    if (!profile.playerId || !profile.playerToken) await ensurePlayer();
    const started = await fetchJson("/api/run/start", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ mode: "reach", seed: game.seed, target: game.target, custom: true })
    });
    els.targetMessage.textContent = "";
    applyServerPlayer(started.player);
    startWithGame(started.game, started.run);
  } catch (error) {
    els.targetMessage.textContent = error.message;
  } finally {
    state.startingRun = false;
    if (state.game) updateHud();
    submit.disabled = false;
  }
}

function startWithGame(game, run) {
  stopTimer();
  resetRevealPlayback();
  [els.revealDialog, els.resultDialog, els.leaderboardDialog, els.shareDialog, els.atlasDialog, els.wishDialog, els.paywallDialog, els.exchangeDialog, els.marketBuyDialog]
    .forEach((dialog) => { if (dialog?.open) dialog.close(); });
  state.game = game;
  state.run = run;
  state.assist = run?.assist || "none";
  state.scoringDisabled = run?.scoreEligible === false || game?.scoreEligible === false;
  state.mode = game.mode;
  state.words = game.starters.map((word) => ({ word, emoji: starterEmoji[word] || "✦", category: starterCategory[word], source: "origin" }));
  state.nodes = [];
  state.history = [];
  state.trails = [];
  state.moves = 0;
  state.newDiscoveries = 0;
  state.nextId = 1;
  state.topZ = 10;
  state.busyPairs.clear();
  state.selectedNodeId = null;
  state.finished = false;
  state.wished = false;
  state.rewardedWish = false;
  state.startedAt = run?.startedAt ? Date.parse(run.startedAt) : Date.now();
  state.remainingSeconds = run?.deadlineAt ? Math.max(0, Math.ceil((Date.parse(run.deadlineAt) - Date.now()) / 1000)) : game.timeLimit || 0;
  state.resultAction = null;
  clearTimeout(showAlchemy.timer);
  els.alchemyNote.classList.remove("show", "error");
  els.alchemyNote.textContent = "";
  els.board.classList.remove("reveal-complete");
  els.startScreen.hidden = true;
  els.gameScreen.hidden = false;
  els.modeName.textContent = game.modeName.toUpperCase();
  els.targetWord.textContent = game.target;
  els.timerHud.hidden = !game.timeLimit;
  els.lawPill.hidden = !game.law;
  els.lawPill.textContent = game.law ? `${game.law.name}: ${game.law.description}` : "";
  renderInventory();
  renderBoard();
  renderAtlas();
  updateHud();
  updateMilestone();
  requestAnimationFrame(startCosmos);
  if (game.timeLimit) startTimer();
  track("run_started", { mode: game.mode, target: game.target, stage: game.stage ?? null, aiEnabled: game.aiEnabled });
}

function returnHome() {
  if (state.startingRun) return showToast("The next orbit is still being mapped.");
  if (state.game && !state.finished && state.history.length) track("run_failed", { mode: state.mode, reason: "abandoned", moves: state.moves });
  stopTimer();
  resetRevealPlayback();
  cancelAnimationFrame(state.cosmosFrame);
  state.cosmosFrame = null;
  state.game = null;
  state.run = null;
  state.nodes = [];
  els.gameScreen.hidden = true;
  els.startScreen.hidden = false;
  [els.resultDialog, els.atlasDialog, els.shareDialog, els.wishDialog, els.paywallDialog, els.exchangeDialog, els.marketBuyDialog, els.leaderboardDialog, els.revealDialog].forEach((dialog) => { if (dialog?.open) dialog.close(); });
  renderProfile();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function retryGame() {
  if (!state.game || state.startingRun) return;
  const mode = state.game.mode;
  const options = { seed: state.game.seed, target: ["reach", "challenge"].includes(mode) ? state.game.target : undefined };
  const resultActions = [els.resultPrimary, els.resultRetry, $("#resultLeaderboard"), els.resultShare, $("#resultReveal")];
  resultActions.forEach((control) => { control.disabled = true; });
  try { await beginMode(mode, options); }
  finally {
    resultActions.forEach((control) => { control.disabled = false; });
  }
}

function startTimer() {
  stopTimer();
  els.timerValue.textContent = formatTime(state.remainingSeconds);
  state.timerId = setInterval(() => {
    if (state.finished || state.reveal.active || state.reveal.pending) return;
    state.remainingSeconds = state.run?.deadlineAt
      ? Math.max(0, Math.ceil((Date.parse(state.run.deadlineAt) - Date.now()) / 1000))
      : Math.max(0, Math.ceil((state.startedAt + Number(state.game?.timeLimit || 0) * 1000 - Date.now()) / 1000));
    els.timerValue.textContent = formatTime(Math.max(0, state.remainingSeconds));
    els.timerValue.classList.toggle("urgent", state.remainingSeconds <= 15);
    if (state.remainingSeconds <= 0) finishGame(false, "Time slipped beyond your orbit.");
  }, 250);
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
}

function updateHud() {
  if (!state.game) return;
  els.movesValue.textContent = state.game.moveLimit ? `${state.moves}/${state.game.moveLimit}` : String(state.moves);
  els.collectionCount.textContent = state.words.length;
  els.pathCount.textContent = state.history.length;
  if (state.game.timeLimit) els.timerValue.textContent = formatTime(state.remainingSeconds);
  if (els.revealPathButton) {
    const alreadyRevealed = state.reveal.revealed;
    els.revealPathButton.disabled = !state.game || state.finished || state.startingRun || state.reveal.active || state.reveal.pending || alreadyRevealed;
    els.revealPathButton.classList.toggle("assisted", state.scoringDisabled);
    els.revealPathButton.querySelector("b").textContent = state.scoringDisabled && alreadyRevealed ? "0 SCORE" : "REVEAL";
  }
  updateWishButton();
}

function updateMilestone(won = false) {
  if (!state.game) return;
  const estimated = Math.max(5, (state.game.tier || 2) * 3 + 1);
  const progress = won ? 100 : Math.min(92, state.history.length / estimated * 100);
  els.milestoneBar.style.width = `${progress}%`;
  els.milestoneText.textContent = state.history.length ? `${state.history.length} stars traced · ${state.newDiscoveries} new to your universe` : "Your constellation begins here";
}

function renderInventory() {
  els.wordList.replaceChildren(...state.words.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `inventory-word${["wish", "market"].includes(item.source) ? " wish" : ""}${item.ghost ? " reveal-ghost" : ""}`;
    const revealLocked = state.reveal.active || state.reveal.pending;
    const unavailable = state.finished || revealLocked || item.ghost;
    button.draggable = !unavailable;
    button.disabled = unavailable;
    button.setAttribute("aria-label", item.ghost ? `${item.word}, temporary revealed word. Not saved or playable.` : unavailable ? `${item.word}. Unavailable while this orbit is locked.` : `Add ${item.word} to the cosmos`);
    const tag = item.ghost ? "REVEALED" : item.source === "wish" ? "WISH" : item.source === "market" ? "VAULT" : item.source?.startsWith("ai") ? "AI" : "";
    button.innerHTML = `<span class="emoji">${escapeHtml(item.emoji)}</span><span class="word">${escapeHtml(item.word)}</span>${tag ? `<span class="source-tag">${tag}</span>` : ""}`;
    button.addEventListener("click", () => placeFromTray(item));
    button.addEventListener("dragstart", (event) => {
      if (state.reveal.active || state.reveal.pending || state.finished) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("application/x-constellore", item.word);
    });
    return button;
  }));
  updateHud();
}

function renderBoard(newId = null) {
  els.boardItems.replaceChildren(...state.nodes.map((node) => createBoardNode(node, node.id === newId)));
  els.boardGuide.classList.toggle("hidden", state.nodes.length > 0);
  els.boardGuide.setAttribute("aria-hidden", String(state.nodes.length > 0));
}

function createBoardNode(node, isNew) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `board-word${isNew ? " appear" : ""}${["wish", "market"].includes(node.item.source) ? " wish" : ""}${node.item.ghost ? " reveal-ghost" : ""}${node.revealRole ? ` reveal-${node.revealRole}` : ""}${state.selectedNodeId === node.id ? " keyboard-selected" : ""}`;
  button.dataset.id = node.id;
  button.style.setProperty("--x", `${node.x}px`);
  button.style.setProperty("--y", `${node.y}px`);
  button.style.zIndex = node.z;
  const revealedNode = Boolean(node.revealRole || node.item.ghost);
  const unavailable = state.finished || state.reveal.active || state.reveal.pending || revealedNode;
  button.disabled = unavailable;
  button.setAttribute("aria-label", revealedNode ? `${node.item.word}, revealed constellation word. Not playable.` : unavailable ? `${node.item.word}. Unavailable while this orbit is locked.` : `${node.item.word}. Drag onto another word to combine.`);
  button.setAttribute("aria-pressed", String(state.selectedNodeId === node.id));
  button.innerHTML = `<span class="emoji">${escapeHtml(node.item.emoji)}</span><span>${escapeHtml(node.item.word)}</span>`;
  button.addEventListener("pointerdown", (event) => startNodeDrag(event, node, button));
  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectNodeForKeyboard(node);
    }
  });
  return button;
}

function selectNodeForKeyboard(node) {
  if (state.finished || state.reveal.active || state.reveal.pending) return;
  if (!state.selectedNodeId) {
    state.selectedNodeId = node.id;
    renderBoard();
    showAlchemy(`${node.item.word} selected. Choose another word.`);
    return;
  }
  if (state.selectedNodeId === node.id) {
    state.selectedNodeId = null;
    renderBoard();
    return;
  }
  const first = state.nodes.find((entry) => entry.id === state.selectedNodeId);
  state.selectedNodeId = null;
  if (first) combineNodes(first, node);
}

function placeFromTray(item, point) {
  if (state.finished || state.reveal.active || state.reveal.pending || item.ghost) return;
  const rect = els.board.getBoundingClientRect();
  const spread = state.nodes.length % 7;
  const x = point ? point.x - rect.left - 55 : rect.width * .46 + (spread - 3) * 22;
  const y = point ? point.y - rect.top - 22 : rect.height * .43 + ((state.nodes.length * 31) % 100) - 50;
  addNode(item, x, y);
}

function addNode(item, x, y, options = {}) {
  const bounds = els.board.getBoundingClientRect();
  const node = {
    id: state.nextId++, item,
    x: clamp(x, 8, Math.max(8, bounds.width - 155)),
    y: clamp(y, 8, Math.max(8, bounds.height - 54)),
    z: ++state.topZ,
    ...options
  };
  state.nodes.push(node);
  renderBoard(node.id);
  return node;
}

function startNodeDrag(event, node, element) {
  if (event.button !== 0 || state.finished || state.reveal.active || state.reveal.pending || node.revealRole || node.item.ghost || state.busyPairs.has(node.id)) return;
  event.preventDefault();
  const boardRect = els.board.getBoundingClientRect();
  const nodeRect = element.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const offsetX = event.clientX - nodeRect.left;
  const offsetY = event.clientY - nodeRect.top;
  let moved = false;
  node.z = ++state.topZ;
  element.style.zIndex = node.z;
  element.classList.add("dragging");
  element.setPointerCapture(event.pointerId);

  const move = (moveEvent) => {
    if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 5) moved = true;
    node.x = clamp(moveEvent.clientX - boardRect.left - offsetX, 5, boardRect.width - element.offsetWidth - 5);
    node.y = clamp(moveEvent.clientY - boardRect.top - offsetY, 5, boardRect.height - element.offsetHeight - 5);
    element.style.setProperty("--x", `${node.x}px`);
    element.style.setProperty("--y", `${node.y}px`);
    markDropTarget(node, element);
  };
  const cleanup = () => {
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", end);
    element.removeEventListener("pointercancel", cancel);
    element.classList.remove("dragging");
    clearDropTargets();
  };
  const end = () => {
    const target = findCollision(node, element);
    cleanup();
    if (target) combineNodes(node, target);
    else if (!moved) selectNodeForKeyboard(node);
  };
  const cancel = () => cleanup();
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", end);
  element.addEventListener("pointercancel", cancel);
}

function findCollision(source, sourceElement) {
  const sourceRect = sourceElement.getBoundingClientRect();
  const centerX = sourceRect.left + sourceRect.width / 2;
  const centerY = sourceRect.top + sourceRect.height / 2;
  let best = null;
  let bestOverlap = 0;
  for (const target of state.nodes) {
    if (target.id === source.id || state.busyPairs.has(target.id)) continue;
    const element = els.boardItems.querySelector(`[data-id="${target.id}"]`);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    const inside = centerX >= rect.left && centerX <= rect.right && centerY >= rect.top && centerY <= rect.bottom;
    const overlap = Math.max(0, Math.min(sourceRect.right, rect.right) - Math.max(sourceRect.left, rect.left)) * Math.max(0, Math.min(sourceRect.bottom, rect.bottom) - Math.max(sourceRect.top, rect.top));
    if ((inside || overlap > sourceRect.width * sourceRect.height * .25) && overlap >= bestOverlap) {
      best = target;
      bestOverlap = overlap;
    }
  }
  return best;
}

function markDropTarget(source, element) {
  clearDropTargets();
  const target = findCollision(source, element);
  if (target) els.boardItems.querySelector(`[data-id="${target.id}"]`)?.classList.add("drop-target");
}

function clearDropTargets() {
  els.boardItems.querySelectorAll(".drop-target").forEach((element) => element.classList.remove("drop-target"));
}

async function combineNodes(a, b) {
  if (state.finished || state.reveal.active || state.reveal.pending || state.busyPairs.has(a.id) || state.busyPairs.has(b.id)) return;
  if (state.game.moveLimit && state.moves >= state.game.moveLimit) return finishGame(false, "No moves remain in this orbit.");
  state.busyPairs.add(a.id);
  state.busyPairs.add(b.id);
  const aElement = els.boardItems.querySelector(`[data-id="${a.id}"]`);
  const bElement = els.boardItems.querySelector(`[data-id="${b.id}"]`);
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  try {
    const result = await fetchJson("/api/combine", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        a: a.item.word,
        b: b.item.word,
        categoryA: a.item.category,
        categoryB: b.item.category,
        discovered: state.words.map((item) => item.word),
        runId: state.run?.id,
        runToken: state.run?.token
      })
    });
    aElement?.classList.add("merging");
    bElement?.classList.add("merging");
    await wait(170);
    state.moves += 1;
    const known = state.words.find((item) => item.word.toLowerCase() === result.word.toLowerCase());
    const globallyKnown = profile.discovered.some((word) => word.toLowerCase() === result.word.toLowerCase());
    if (!known) {
      state.words.push(result);
      if (!globallyKnown) {
        profile.discovered.push(result.word);
        state.newDiscoveries += 1;
        saveProfile();
      }
      renderInventory();
    }
    state.history.push({ a: a.item.word, b: b.item.word, word: result.word, emoji: result.emoji, source: result.source, newDiscovery: !globallyKnown });
    state.trails.push({ ax: a.x + 44, ay: a.y + 20, bx: b.x + 44, by: b.y + 20, x: x + 44, y: y + 20 });
    state.nodes = state.nodes.filter((node) => node.id !== a.id && node.id !== b.id);
    addNode(known || result, x, y);
    showAlchemy(`${a.item.word} + ${b.item.word} = ${result.emoji} ${result.word}`);
    if (navigator.vibrate) navigator.vibrate(18);
    updateHud();
    updateMilestone();
    renderAtlas();
    track("combination_completed", { mode: state.mode, a: a.item.word, b: b.item.word, result: result.word, source: result.source, newDiscovery: !globallyKnown });
    if (result.division === "open" && state.assist === "none") state.assist = "open";
    const won = Boolean(result.completed);
    state.busyPairs.delete(a.id);
    state.busyPairs.delete(b.id);
    if (won) setTimeout(() => finishGame(true), 480);
    else if (state.game.moveLimit && state.moves >= state.game.moveLimit) setTimeout(() => finishGame(false, "No moves remain in this orbit."), 350);
  } catch (error) {
    state.busyPairs.delete(a.id);
    state.busyPairs.delete(b.id);
    for (const element of [aElement, bElement]) {
      element?.classList.remove("merging");
      element?.classList.add("rejected");
      setTimeout(() => element?.classList.remove("rejected"), 380);
    }
    showAlchemy(error.message, true);
    track("combination_rejected", { mode: state.mode, a: a.item.word, b: b.item.word });
  }
}

function resetRevealPlayback({ keepConstellation = false } = {}) {
  const previous = state.reveal || {};
  previous.wake?.();
  state.reveal = {
    active: false,
    paused: false,
    speed: 1,
    skip: false,
    pending: false,
    revealed: keepConstellation ? Boolean(previous.revealed) : false,
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
    : warnings[state.mode] || "This orbit will become a permanent Assisted run.";
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
    state.run = { ...state.run, ranked: false, scoreEligible: false, assisted: true };
    stopTimer();
    if (mode === "daily") {
      profile.dailyCompleted = todayKey;
      saveProfile();
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
    ? `Constellation complete · ${total} combinations traced`
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

async function playRevealPath(route) {
  const generation = state.reveal.generation + 1;
  state.finished = false;
  state.nodes = [];
  state.selectedNodeId = null;
  state.reveal = {
    active: true,
    paused: false,
    speed: 1,
    skip: false,
    pending: false,
    revealed: true,
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
    state.moves += 1;
    state.history.push({ a: step.a, b: step.b, word: step.word, emoji: result.emoji, source: "reveal", newDiscovery: false, revealed: true });
    state.reveal.completed = index + 1;
    updateHud();
    updateMilestone(index === route.length - 1);
    renderAtlas();
    updateRevealController(index + 1, route[index + 1]);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) startCosmos();
    if (navigator.vibrate) navigator.vibrate([10, 18, 10]);
    if (!await revealDelay(620, generation)) return;
  }

  if (generation !== state.reveal.generation) return;
  state.reveal.active = false;
  state.reveal.completed = route.length;
  els.board.classList.remove("reveal-active");
  els.board.classList.add("reveal-complete");
  updateRevealController(route.length);
  finishGame(true);
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
  if (state.scoringDisabled) return { reward: 0, reason: "Assisted path · no progression rewards" };
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

function finishGame(won, reason = "") {
  if (state.finished) return;
  state.finished = true;
  stopTimer();
  updateMilestone(won);
  const elapsed = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  const assisted = Boolean(state.scoringDisabled || state.assist === "reveal");
  const revealed = assisted && state.reveal.revealed;
  let reward = null;
  state.resultAction = returnHome;
  $("#rankResultCard").hidden = isStaticBeta || !won || assisted;
  $("#resultLeaderboard").hidden = isStaticBeta || !won || assisted;
  $("#assistResultCard").hidden = !assisted;
  $("#resultReveal").hidden = won || assisted || !state.run;
  if (won && !assisted) {
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
    profile.stardust += reward.reward;
    profile.wins += 1;
    saveProfile();
  } else if (won && revealed) {
    state.resultAction = () => els.resultDialog.close();
  }
  els.resultEmoji.textContent = won ? state.game.emoji : state.mode === "quick" ? "⌛" : "◇";
  els.resultKicker.textContent = revealed
    ? "PATH REVEALED · ASSISTED"
    : won
    ? isStaticBeta
      ? "LOCAL TARGET REACHED"
      : state.mode === "weekly" && !profile.weekly.complete
        ? `STAGE ${state.game.stage + 1} COMPLETE`
        : "TARGET REACHED"
    : "ORBIT ENDED";
  els.resultTitle.textContent = revealed ? `The cosmos revealed ${state.game.target}.` : won ? `You found ${state.game.target}.` : reason;
  const timeStat = state.game.timeLimit || state.mode === "challenge" ? ` · ${formatTime(elapsed)} elapsed` : "";
  els.resultStats.textContent = revealed
    ? `${state.reveal.route.length} combinations traced · 0 score · no discoveries saved`
    : `${state.words.length} discoveries · ${state.moves} moves${timeStat}${state.wished ? " · 1 Wish" : ""}`;
  els.rewardCard.hidden = !won || assisted;
  if (reward) {
    els.rewardDust.textContent = reward.reward;
    els.rewardReason.textContent = reward.reason;
  }
  els.resultPrimary.querySelector("span").textContent = revealed ? "Study constellation" : won && state.mode === "weekly" && !profile.weekly.complete ? "Continue expedition" : won ? "Choose another mode" : "Back to modes";
  els.resultRetry.hidden = assisted || (won && (state.mode === "daily" || state.mode === "weekly"));
  els.resultRetry.textContent = won ? "Replay this target" : "Try again";
  els.resultShare.hidden = !won || assisted;
  els.resultDialog.showModal();
  if (won && !assisted) submitRankedScore();
  track(won ? "target_reached" : "run_failed", { mode: state.mode, target: state.game.target, moves: state.moves, seconds: elapsed, wished: state.wished, reward: reward?.reward || 0, assisted, revealed });
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
  const division = state.assist === "none" ? "pure" : "open";
  $("#resultDivision").textContent = `${division.toUpperCase()} - SERVER VERIFIED`;
  $("#resultRank").textContent = "#--";
  $("#resultScore").textContent = "VERIFYING";
  $("#resultRankMessage").textContent = "Uploading the server-recorded path...";
  card.classList.add("loading");
  try {
    const result = await fetchJson("/api/run/submit", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ runId: state.run.id, runToken: state.run.token })
    });
    if (!result.ranked) throw new Error(result.reason || "This orbit is not ranked.");
    applyServerPlayer(result.player);
    state.leaderboardDivision = result.placement.entry.division;
    state.leaderboardScope = state.mode === "daily" ? "daily" : state.mode === "weekly" ? "weekly" : "sprint";
    $("#resultDivision").textContent = `${result.placement.entry.division.toUpperCase()} - SERVER VERIFIED`;
    $("#resultRank").textContent = `#${result.placement.rank}`;
    $("#resultScore").textContent = Number(result.placement.entry.score).toLocaleString();
    const totalCredits = Number(result.creditReward || 0) + Number(result.weeklyBonus || 0);
    $("#resultRankMessage").textContent = result.weeklyBonus
      ? `Personal best recorded - +${totalCredits} Star Credits, including the 4-day bonus`
      : result.creditReward
        ? `Personal best recorded - +${result.creditReward} Star Credits earned`
        : result.alreadyRewarded
          ? "Score recorded. This challenge's credit reward was already claimed."
          : "Personal best recorded on the shared ladder.";
    track("score_uploaded", { mode: state.mode, division: result.placement.entry.division, score: result.placement.entry.score, rank: result.placement.rank });
  } catch (error) {
    $("#resultScore").textContent = "PENDING";
    $("#resultRankMessage").textContent = `${error.message} Your local run result is still saved.`;
  } finally {
    card.classList.remove("loading");
  }
}

function updateWishButton() {
  if (!els.wishState) return;
  const button = $("#wishWord");
  const used = state.wished;
  button?.classList.toggle("used", used);
  if (button) button.disabled = state.finished || state.reveal.active || state.reveal.pending;
  if (isStaticBeta) {
    els.wishState.textContent = used ? "USED" : "PRACTICE";
    return;
  }
  if (used) els.wishState.textContent = "USED";
  else if (profile.premium) els.wishState.textContent = profile.wishAvailable ? "DAILY" : "TOMORROW";
  else if (!profile.freeWishUsed) els.wishState.textContent = "FIRST FREE";
  else els.wishState.textContent = "PASS";
}

function openPremium() {
  stopTimer();
  track("paywall_viewed", { location: els.gameScreen.hidden ? "home" : "run" });
  els.paywallDialog.showModal();
}

function openWish() {
  if (!state.game || state.finished || state.reveal.active || state.reveal.pending) return;
  if (state.wished) return showToast("Only one Wish can bend each orbit.");
  track("wish_opened", { mode: state.mode, free: !profile.freeWishUsed });
  stopTimer();
  renderWishVault();
  const canWriteWish = profile.wishAvailable || state.rewardedWish;
  $("#wishForm").hidden = !canWriteWish;
  if (canWriteWish || profile.vault.length) els.wishDialog.showModal();
  else openPremium();
}

async function checkoutPremium() {
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
        showToast("Founder's Pass activated.");
      } else showToast("The store confirmed payment; server entitlement sync is still pending.");
    } else if (config.billingEnabled && config.checkoutUrl) {
      window.open(config.checkoutUrl, "_blank", "noopener,noreferrer");
      showToast("Checkout opened. Your pass activates after the store confirms it.");
    } else if (config.testStoreEnabled) {
      const { player } = await fetchJson("/api/player/test-entitlement", { method: "POST", headers: authHeaders() });
      applyServerPlayer(player);
      if (els.paywallDialog.open) els.paywallDialog.close();
      showToast("Development Founder's Pass activated. No charge.");
    } else {
      showToast("Store connection required for this purchase.");
    }
  } catch {
    showToast("The store could not complete that purchase.");
  }
}

async function makeWish(event) {
  event.preventDefault();
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
    state.assist = item.assist || "wish";
    applyServerPlayer(item.player);
    renderInventory();
    els.wishDialog.close();
    input.value = "";
    message.textContent = "";
    placeFromTray(item);
    showAlchemy(`✧ ${item.word} bent into your universe.`);
    track("wish_used", { mode: state.mode, word: item.word, entitlement: profile.premium ? "pass" : state.rewardedWish ? "reward" : "free" });
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
    resumeTimerIfNeeded();
  }
}

async function earnRewardedWish() {
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
    state.assist = result.assist || "market";
    renderInventory();
    renderWishVault();
    if (els.wishDialog.open) els.wishDialog.close();
    if (els.exchangeDialog.open) els.exchangeDialog.close();
    placeFromTray(result.item);
    showAlchemy(`${result.item.word} entered from your permanent Word Vault.`);
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
  if (!creditsAdapter()) {
    const note = document.createElement("small");
    note.className = "beta-credit-note";
    note.textContent = config.testStoreEnabled ? "Store packs are disabled in local QA." : "Earn credits from verified runs during the free beta.";
    container.replaceChildren(note);
    return;
  }
  container.replaceChildren(...(config.creditPacks || []).map((pack) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "credit-pack";
    button.innerHTML = `<strong>${Number(pack.credits).toLocaleString()} credits</strong><small>${escapeHtml(pack.price)}</small>`;
    button.addEventListener("click", () => buyCreditPack(pack));
    return button;
  }));
}

async function buyCreditPack(pack) {
  track("credit_pack_opened", { pack: pack.id });
  const credits = creditsAdapter();
  if (!credits?.purchase) return showToast("Connect App Store, Google Play, Steam, or Epic billing to buy credit packs.");
  try {
    const result = await credits.purchase(pack.id);
    if (!result?.success) return;
    await credits.syncWallet?.();
    await ensurePlayer();
    await loadMarket();
    showToast("Star Credits added to your wallet.");
  } catch {
    showToast("The store could not complete that credit purchase.");
  }
}

async function openExchange(view = state.marketView) {
  state.marketView = view === "vault" ? "vault" : "market";
  stopTimer();
  if (els.wishDialog.open) els.wishDialog.close();
  if (!els.exchangeDialog.open) els.exchangeDialog.showModal();
  els.marketMessage.classList.remove("error");
  els.marketMessage.textContent = "Loading the current global quotes...";
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
  saveProfile();
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
  els.marketMessage.textContent = search ? `${items.length} matching useful word${items.length === 1 ? "" : "s"}.` : state.marketView === "vault" ? "Permanent licenses owned by this player." : "Global prices are shared by every player and update once per minute.";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "market-empty";
    empty.textContent = state.marketView === "vault" ? "Your Vault is empty. Buy a word once and keep it permanently." : "No useful words match that search.";
    els.marketList.replaceChildren(empty);
    return;
  }
  els.marketList.replaceChildren(...items.map((item) => {
    const trendClass = item.changePercent > 0 ? "up" : item.changePercent < 0 ? "down" : "flat";
    const trendText = item.changePercent > 0 ? `UP ${item.changePercent}% / MIN` : item.changePercent < 0 ? `DOWN ${Math.abs(item.changePercent)}% / MIN` : "FLAT / MIN";
    const article = document.createElement("article");
    article.className = `market-item${item.owned ? " owned" : ""}`;
    article.innerHTML = `<span class="market-item-emoji">${escapeHtml(item.emoji)}</span><div class="market-word"><strong>${escapeHtml(item.word)}</strong><small>${escapeHtml(item.reason)}</small></div><span class="market-utility"><b>UTILITY ${item.usefulness}/5</b><span>${"*".repeat(item.usefulness)}</span></span><div class="market-trend ${trendClass}">${sparklineSvg(item.trend)}<span>${trendText}</span></div><div class="market-price"><strong>${Number(item.price).toLocaleString()} C</strong><small>${item.owned ? "OWNED" : "CURRENT QUOTE"}</small></div>`;
    const action = document.createElement("button");
    action.type = "button";
    action.className = "market-item-action";
    const canActivate = item.owned && state.game && !state.finished && !state.wished;
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
    showToast(`${result.item.word} is permanently yours.`);
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
  els.leaderboardMessage.textContent = entries.length ? `${entries.length} verified personal best${entries.length === 1 ? "" : "s"}.` : "No verified score has reached this ladder yet.";
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
    : "Open runs used one Wish, permanent Vault word, or another declared assist.";
}

function resumeTimerIfNeeded() {
  if (state.game?.timeLimit && !state.finished && !state.reveal.active && !state.reveal.pending && !els.gameScreen.hidden && !els.paywallDialog.open && !els.wishDialog.open && !els.atlasDialog.open && !els.shareDialog.open && !els.profileDialog.open && !els.exchangeDialog.open && !els.marketBuyDialog.open && !els.leaderboardDialog.open && !els.revealDialog.open) startTimer();
}

function renderAtlas() {
  $("#atlasEmpty").hidden = state.history.length > 0;
  $("#atlasSummary").hidden = state.history.length === 0;
  $("#atlasDiscoveries").textContent = state.newDiscoveries;
  $("#atlasMoves").textContent = state.moves;
  $("#atlasPath").replaceChildren(...state.history.map((step, index) => {
    const item = document.createElement("li");
    item.innerHTML = `<span class="atlas-star">${escapeHtml(step.emoji)}</span><small>STAR ${String(index + 1).padStart(2, "0")}${step.newDiscovery ? " · NEW" : ""}</small><strong>${escapeHtml(step.word)}</strong><span>${escapeHtml(step.a)} + ${escapeHtml(step.b)}</span>`;
    return item;
  }));
}

function openAtlas() {
  if (!state.game) return;
  if (state.startingRun) return showToast("The next orbit is still being mapped.");
  if (state.reveal.active || state.reveal.pending) return showToast("Pause the Cosmos Reveal before opening the atlas.");
  stopTimer();
  renderAtlas();
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
  $("#shareTarget").textContent = game.target;
  $("#shareDescription").textContent = completed ? "Your path is set. Now see how a friend reaches the same word." : "Send the same target and compare your constellations.";
  $("#shareStats").textContent = completed ? `${state.moves} moves · ${state.history.length} stars · ${state.wished ? "Wish used" : "pure path"}` : "Same universe. Different path.";
}

function openShare() {
  if (!state.game) return;
  if (state.startingRun) return showToast("The next orbit is still being mapped.");
  if (state.reveal.active || state.reveal.pending || state.scoringDisabled) return showToast("Assisted paths are for study, not challenge links.");
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
  if (!state.shareGame) return;
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
  if (!navigator.share || !state.shareGame) return;
  try { await navigator.share({ title: `Find ${state.shareGame.target} in Constellore`, text: "Can you trace a faster constellation?", url: challengeUrl(state.shareGame) }); } catch { /* Share cancellation is expected. */ }
}

function openProfile() {
  stopTimer();
  renderProfile();
  els.profileDialog.showModal();
}

function chooseTheme(theme) {
  if (theme !== "void" && !profile.premium && !isStaticBeta) {
    els.profileDialog.close();
    return openPremium();
  }
  profile.theme = theme;
  saveProfile();
  if (state.game) startCosmos();
  track("theme_changed", { theme });
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
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = .7;
    for (const trail of state.trails) {
      ctx.globalAlpha = .18;
      ctx.beginPath();
      ctx.moveTo(trail.ax, trail.ay);
      ctx.lineTo(trail.x, trail.y);
      ctx.lineTo(trail.bx, trail.by);
      ctx.stroke();
      ctx.globalAlpha = .42;
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

function showAlchemy(message, error = false) {
  clearTimeout(showAlchemy.timer);
  els.alchemyNote.textContent = message;
  els.alchemyNote.classList.toggle("error", error);
  els.alchemyNote.classList.add("show");
  showAlchemy.timer = setTimeout(() => els.alchemyNote.classList.remove("show"), error ? 2800 : 2300);
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
  ["marketButton", "leaderboardButton", "viewLeaderboards", "startPremium", "browseExchange", "resultLeaderboard"]
    .forEach((id) => { const element = document.getElementById(id); if (element) element.hidden = true; });
  const socialCopy = document.querySelector(".social-row > div p");
  if (socialCopy) socialCopy.textContent = "Practice runs stay on this device. Verified rankings will arrive with the online account service.";
  const wishLabel = $("#wishWord b");
  if (wishLabel) wishLabel.textContent = "Practice Wish";
  const wishHeading = $("#wishDialog h2");
  if (wishHeading) wishHeading.textContent = "Wish a mapped word";
  const wishIntro = document.querySelector("#wishDialog > p");
  if (wishIntro) wishIntro.textContent = "Add one known concept to this local orbit. It may open a shortcut, but the result remains unranked.";
  $("#profileCallsign").textContent = "Local Stargazer";
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

let toastTimer;
function showToast(message) {
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
$("#customTargetForm").addEventListener("submit", beginCustomTarget);
$("#homeButton").addEventListener("click", returnHome);
$("#resetBoard").addEventListener("click", () => {
  if (state.startingRun || state.reveal.active || state.reveal.pending) return showToast("The cosmos is tracing this path.");
  state.nodes = [];
  state.selectedNodeId = null;
  renderBoard();
  showAlchemy("The board is clear. Your discoveries remain.");
});
$("#atlasButton").addEventListener("click", openAtlas);
$("#shareRunButton").addEventListener("click", openShare);
$("#revealPathButton").addEventListener("click", openRevealPath);
$("#confirmReveal").addEventListener("click", confirmRevealPath);
$("#revealPause").addEventListener("click", toggleRevealPause);
$("#revealSpeed").addEventListener("click", cycleRevealSpeed);
$("#revealSkip").addEventListener("click", skipRevealAnimation);
$("#startPremium").addEventListener("click", () => profile.premium ? openProfile() : openPremium());
$("#wishWord").addEventListener("click", openWish);
$("#checkoutButton").addEventListener("click", checkoutPremium);
$("#wishForm").addEventListener("submit", makeWish);
$("#rewardWish").addEventListener("click", earnRewardedWish);
$("#profileButton").addEventListener("click", openProfile);
$("#marketButton").addEventListener("click", () => openExchange("market"));
$("#leaderboardButton").addEventListener("click", () => openLeaderboard());
$("#viewLeaderboards").addEventListener("click", () => openLeaderboard());
$("#browseExchange").addEventListener("click", () => openExchange("market"));
$("#confirmMarketBuy").addEventListener("click", confirmMarketPurchase);
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
$("#createChallenge").addEventListener("click", createChallengeFromHome);
$("#copyChallenge").addEventListener("click", copyChallenge);
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
$("#resultRetry").addEventListener("click", retryGame);
$("#resultLeaderboard").addEventListener("click", () => {
  if (state.startingRun) return;
  if (els.resultDialog.open) els.resultDialog.close();
  openLeaderboard(state.leaderboardScope, state.leaderboardDivision);
});
$$('[data-theme]').forEach((button) => button.addEventListener("click", () => chooseTheme(button.dataset.theme)));
$$('[data-close]').forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.close === "revealDialog" && state.reveal.pending) return;
  document.getElementById(button.dataset.close).close();
}));
els.revealDialog.addEventListener("cancel", (event) => {
  if (state.reveal.pending) event.preventDefault();
});
els.resultDialog.addEventListener("cancel", (event) => {
  if (state.startingRun) event.preventDefault();
});
[els.paywallDialog, els.wishDialog, els.atlasDialog, els.shareDialog, els.profileDialog, els.marketBuyDialog, els.leaderboardDialog, els.revealDialog].forEach((dialog) => dialog.addEventListener("close", () => setTimeout(resumeTimerIfNeeded, 0)));
els.exchangeDialog.addEventListener("close", () => {
  clearInterval(state.marketTimer);
  state.marketTimer = null;
  setTimeout(resumeTimerIfNeeded, 0);
});
els.board.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; });
els.board.addEventListener("drop", (event) => {
  event.preventDefault();
  if (state.reveal.active || state.reveal.pending) return;
  const word = event.dataTransfer.getData("application/x-constellore");
  const item = state.words.find((entry) => entry.word === word);
  if (item) placeFromTray(item, { x: event.clientX, y: event.clientY });
});
window.addEventListener("resize", () => { if (!els.gameScreen.hidden) startCosmos(); });
window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);
document.addEventListener("visibilitychange", () => { if (!document.hidden) wakeRevealPlayback(); });
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); state.installPrompt = event; $("#installButton").hidden = false; });
$("#installButton").addEventListener("click", async () => {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  const choice = await state.installPrompt.userChoice;
  if (choice.outcome === "accepted") track("pwa_installed");
  state.installPrompt = null;
  $("#installButton").hidden = true;
});

async function boot() {
  configureStaticBetaUi();
  renderProfile();
  updateConnection();
  await loadConfig();
  try { await ensurePlayer(); }
  catch { showToast("Leaderboard and Word Exchange need a connection."); }
  if ("serviceWorker" in navigator && window.top === window.self) {
    const serviceWorkerUrl = isStaticBeta ? "./service-worker.js" : "/play/service-worker.js";
    const serviceWorkerScope = isStaticBeta ? "./" : "/play/";
    navigator.serviceWorker.register(serviceWorkerUrl, { scope: serviceWorkerScope }).catch(() => {});
  }
  track("app_opened", { installed: matchMedia("(display-mode: standalone)").matches });
  const params = new URLSearchParams(location.search);
  if (params.get("challenge") === "1" && params.get("target")) {
    track("challenge_opened", { target: params.get("target") });
    beginMode("challenge", { target: params.get("target"), seed: Number(params.get("seed")) || stableHash(params.get("target")) });
  }
  if (window.parent !== window) window.parent.postMessage({ type: "constellore:ready", localOnly: isStaticBeta }, location.origin);
}

boot();
