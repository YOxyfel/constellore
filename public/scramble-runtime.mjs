import {
  SCRAMBLE_COUNTDOWN_SECONDS,
  SCRAMBLE_MATCH_SECONDS,
  buildScrambleInviteUrl,
  clearScrambleInviteFromUrl,
  createScrambleState,
  formatScrambleClock,
  parseScrambleInvite,
  reduceScrambleSnapshot,
  scrambleClockSeconds,
  scrambleEventSentence,
  scramblePlayerPair,
  scrambleResultPresentation,
  scrambleShareText,
  sanitizeScrambleEvent,
  sanitizeScrambleToken
} from "./scramble.mjs?v=5.0.0-beta.4";
import {
  SCRAMBLE_DEFAULT_MODE_ID,
  SCRAMBLE_MODES,
  getScrambleModeDefinition,
  normalizeScrambleModeId
} from "./scramble-arena.mjs?v=5.0.0-beta.4";
import { scrambleArenaLeaguePresentation } from "./arena-rank.mjs?v=5.0.0-beta.4";
import {
  createArenaDuelCard
} from "./arena-duel-card.mjs?v=5.0.0-beta.4";
import {
  profileFrameBySlug
} from "./profile-frame-catalog.mjs?v=5.0.0-beta.4";
import { victoryHandoffHoldMs } from "./victory-handoff.mjs?v=5.0.0-beta.4";

const ACTIVE_MATCH_KEY = "constellore-scramble-active-v1";
const QUEUE_POLL_MS = 1_000;
const HEARTBEAT_MS = 12_000;
const RECONNECT_MIN_MS = 650;
const RECONNECT_MAX_MS = 5_000;
const RIVAL_EVENT_TYPES = new Set(["attempt", "success", "failure", "first_light", "echo_steal", "intercept", "lead_change", "chapter_won", "chapter_timeout"]);
const CONTROL_RESYNC_TYPES = new Set([
  "player_joined",
  "ready",
  "countdown_started",
  "match_started",
  "chapter_started",
  "chapter_won",
  "chapter_timeout",
  "match_finished",
  "rematch_ready"
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function actionId(prefix = "action") {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener?.("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function escapeSelector(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

function safeStorage(windowRef) {
  try {
    const storage = windowRef?.sessionStorage;
    const testKey = "__constellore_scramble_test__";
    storage?.setItem(testKey, "1");
    storage?.removeItem(testKey);
    return storage;
  } catch {
    return null;
  }
}

function matchIdFromPayload(payload) {
  const wrapped = payload?.duel || payload?.match || payload?.snapshot;
  const source = record(wrapped || payload);
  const id = wrapped
    ? source.id || source.duelId
    : source.duelId || source.matchId;
  return String(id || "").trim().slice(0, 96);
}

function payloadEvents(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.events)) return payload.events;
  if (payload?.event) return [payload.event];
  if (payload?.type || payload?.kind) return [payload];
  return [];
}

function isAbortError(error) {
  return error?.name === "AbortError" || /abort/i.test(String(error?.message || ""));
}

function deterministicPosition(word, index) {
  let hash = 2166136261;
  for (const character of `${word}:${index}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  return {
    x: 10 + (unsigned % 78),
    y: 12 + ((unsigned >>> 8) % 72)
  };
}

function setText(root, selector, value) {
  const element = root?.querySelector?.(selector) || root?.ownerDocument?.querySelector?.(selector);
  if (element) element.textContent = String(value ?? "");
  return element;
}

function setBusy(button, busy, label = "") {
  if (!button) return;
  if (busy) {
    button.dataset.previousLabel = button.textContent;
    button.disabled = true;
    if (label) button.textContent = label;
  } else {
    button.disabled = false;
    if (button.dataset.previousLabel) button.textContent = button.dataset.previousLabel;
    delete button.dataset.previousLabel;
  }
}

function scrambleFormat(value, { enabledOnly = false } = {}) {
  const id = normalizeScrambleModeId(value);
  const definition = getScrambleModeDefinition(id);
  if (!definition || enabledOnly && !definition.enabled) return SCRAMBLE_DEFAULT_MODE_ID;
  return definition.id;
}

function scrambleFormatDefinition(value) {
  return getScrambleModeDefinition(scrambleFormat(value))
    || getScrambleModeDefinition(SCRAMBLE_DEFAULT_MODE_ID);
}

function formatOptionMarkup(definition) {
  const availability = definition.preview ? "Coming soon" : definition.enabled ? "Available" : "Unavailable";
  return `
    <label class="scramble-format-option" data-format-option="${definition.id}">
      <input type="radio" name="scrambleFormat" value="${definition.id}"${definition.id === SCRAMBLE_DEFAULT_MODE_ID ? " checked" : ""}${definition.enabled ? "" : " disabled"}>
      <span>
        <strong>${definition.label}</strong>
        <small>${definition.description}</small>
        <em>${availability}</em>
      </span>
    </label>`;
}

function surfaceMarkup() {
  return `
    <dialog class="scramble-dialog" id="scrambleDialog" aria-labelledby="scrambleTitle" aria-describedby="scrambleIntro">
      <button class="scramble-close" type="button" data-scramble-close aria-label="Close Scramble Arena">&times;</button>
      <header class="scramble-heading">
        <span class="scramble-emblem" aria-hidden="true">&#10022;</span>
        <div><small>LIVE OPEN-BOARD 1V1</small><h2 id="scrambleTitle" tabindex="-1">Scramble Arena</h2></div>
      </header>
      <p id="scrambleIntro">Choose how you want to scramble. Every mode keeps both boards open and every pairing visible.</p>
      <fieldset class="scramble-format-picker" id="scrambleFormatPicker">
        <legend>Choose a Scramble mode</legend>
        <div class="scramble-format-track">${SCRAMBLE_MODES.map(formatOptionMarkup).join("")}</div>
        <p id="scrambleFormatObjective"><strong>Objective:</strong> Create the shared target before your rival.</p>
      </fieldset>
      <p class="scramble-status" id="scrambleLobbyStatus" role="status" aria-live="polite" aria-atomic="true"></p>
      <div class="scramble-queue-picker" id="scrambleQueuePicker" role="tablist" aria-label="Choose match type">
        <button type="button" role="tab" id="scrambleQueuePrivate" data-arena-queue="private" aria-selected="true" aria-controls="scramblePrivateCard" tabindex="0"><span aria-hidden="true">&#8734;</span><b>Private</b></button>
        <button type="button" role="tab" id="scrambleQueueRanked" data-arena-queue="ranked" aria-selected="false" aria-controls="scrambleRankedCard" tabindex="-1"><span aria-hidden="true">&#9889;</span><b>Ranked</b></button>
      </div>
      <section class="scramble-lobby-grid" id="scrambleLobbyChoices">
        <article class="scramble-mode-card scramble-private-card" id="scramblePrivateCard" data-arena-queue-panel="private" aria-labelledby="scrambleQueuePrivate">
          <span class="scramble-card-mark" aria-hidden="true">&#8734;</span>
          <small>PRIVATE 1V1</small>
          <h3>Invite a friend</h3>
          <p id="scramblePrivateCopy">Create a single-use Target Race link. Private matches never affect mode ratings.</p>
          <button class="scramble-primary" id="scrambleCreateInvite" type="button">Create invitation</button>
          <form id="scrambleJoinForm">
            <label for="scrambleInviteCode">Or enter an invite code</label>
            <div><input id="scrambleInviteCode" maxlength="160" autocomplete="off" spellcheck="false" placeholder="Invite code" required><button type="submit">Join</button></div>
          </form>
        </article>
        <article class="scramble-mode-card scramble-ranked-card" id="scrambleRankedCard" data-arena-queue-panel="ranked" aria-labelledby="scrambleQueueRanked">
          <span class="scramble-card-mark" aria-hidden="true">&#9889;</span>
          <small>PUBLIC RANKED</small>
          <h3>Find a rival</h3>
          <p id="scrambleRankedCopy">Race a public opponent. Wins and losses change only your Target Race Rating.</p>
          <div class="scramble-arena-rank" id="scrambleArenaRank" data-arena-rank="bronze"><span id="scrambleArenaRankMark" aria-hidden="true">&#9670;</span><strong id="scrambleArenaRankName">Bronze Arena Rank</strong><small id="scrambleArenaRankProgress">500 XP TO SILVER</small></div>
          <div class="scramble-rating"><span id="scrambleRatingLabel">Target Race Rating</span><strong id="scrambleRating">Unplaced</strong></div>
          <button class="scramble-primary" id="scrambleFindRival" type="button">Find rival</button>
          <p class="scramble-ranked-lock" id="scrambleRankedLock" hidden>Complete one scored solo constellation to unlock ranked matchmaking.</p>
        </article>
      </section>
      <section class="scramble-waiting" id="scrambleWaiting" hidden aria-labelledby="scrambleWaitingTitle">
        <span class="scramble-waiting-orbit" aria-hidden="true"></span>
        <small id="scrambleWaitingKicker">PRIVATE 1V1</small>
        <h3 id="scrambleWaitingTitle">Waiting for a rival</h3>
        <p id="scrambleWaitingCopy">Send the invitation, then keep this window open.</p>
        <div class="scramble-invite-output" id="scrambleInviteOutput" hidden>
          <label for="scrambleInviteLink">Single-use invitation</label>
          <div><input id="scrambleInviteLink" readonly><button id="scrambleCopyInvite" type="button">Copy link</button></div>
        </div>
        <div class="scramble-versus" id="scrambleLobbyVersus" hidden aria-label="Arena combatants">
          <div class="scramble-versus__combatant is-self">
            <div class="scramble-duel-card-host" id="scrambleLobbySelfCard"></div>
            <span class="sr-only"><small>YOU</small><strong id="scrambleLobbySelf">STARGAZER</strong><em id="scrambleSelfReady">Not ready</em></span>
          </div>
          <b aria-hidden="true">VS</b>
          <div class="scramble-versus__combatant is-rival">
            <div class="scramble-duel-card-host" id="scrambleLobbyRivalCard"></div>
            <span class="sr-only"><small>RIVAL</small><strong id="scrambleLobbyRival">CONNECTING</strong><em id="scrambleRivalReady">Not ready</em></span>
          </div>
        </div>
        <div class="scramble-waiting-actions">
          <button class="scramble-primary" id="scrambleReady" type="button" hidden>Ready</button>
          <button id="scrambleCancelWait" type="button">Cancel</button>
        </div>
      </section>
    </dialog>

    <section class="scramble-scorebar" id="scrambleScorebar" aria-label="Scramble Arena score" hidden>
      <div class="scramble-player-score is-self"><small>YOU</small><strong id="scrambleSelfName">STARGAZER</strong><span id="scrambleSelfModeStats">0 discoveries &middot; 0 attempts</span><em id="scrambleSelfChampion" hidden></em></div>
      <div class="scramble-clock" role="timer" aria-label="Match time remaining"><small id="scrambleScoreMode">TARGET RACE</small><strong id="scrambleClock">05:00</strong><span id="scrambleConnection">Connecting</span></div>
      <div class="scramble-player-score is-rival"><small>RIVAL</small><strong id="scrambleRivalName">CONNECTING</strong><span id="scrambleRivalModeStats">0 discoveries &middot; 0 attempts</span><em id="scrambleRivalChampion" hidden></em></div>
      <section class="scramble-saga-track" id="scrambleSagaTrack" aria-labelledby="scrambleSagaChapter" hidden>
        <header>
          <span><small id="scrambleSagaArc">RIDDLE SAGA</small><strong id="scrambleSagaChapter">Chapter 1 of 5</strong></span>
          <b id="scrambleSagaValue">+1 POINT</b>
        </header>
        <ol id="scrambleSagaChapters" aria-label="Riddle Saga chapter progress"></ol>
        <div class="scramble-saga-current">
          <small>CURRENT RIDDLE</small>
          <strong id="scrambleSagaTitle"></strong>
          <p id="scrambleSagaStory"></p>
          <p class="scramble-saga-target"><span>CREATE</span><b id="scrambleSagaTarget"></b></p>
        </div>
        <div class="scramble-saga-scores" aria-label="Live Riddle Saga score">
          <span><small>YOU</small><strong id="scrambleSagaSelfScore">0</strong><em id="scrambleSagaSelfWins">0 riddles</em></span>
          <i aria-hidden="true">—</i>
          <span><small>RIVAL</small><strong id="scrambleSagaRivalScore">0</strong><em id="scrambleSagaRivalWins">0 riddles</em></span>
        </div>
      </section>
      <div class="scramble-rival-ticker" id="scrambleRivalTicker" aria-label="Latest rival pairing">
        <span aria-hidden="true">&#9678;</span><p><small>RIVAL BOARD</small><strong id="scrambleTickerText">Waiting for their first pairing&hellip;</strong></p>
        <div class="scramble-mini-progress" role="progressbar" aria-label="Rival objective progress" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0"><i id="scrambleMiniProgress"></i></div>
      </div>
      <div class="scramble-view-toggle" role="group" aria-label="Choose board">
        <button type="button" data-scramble-view="self" aria-pressed="true">Your board</button>
        <button type="button" data-scramble-view="rival" aria-pressed="false">Rival board</button>
      </div>
    </section>

    <section class="scramble-rival-board" id="scrambleRivalBoard" aria-labelledby="scrambleRivalBoardTitle" hidden>
      <header>
        <span><small>LIVE OPEN BOARD</small><strong id="scrambleRivalBoardTitle" tabindex="-1">Rival constellation</strong></span>
        <b id="scrambleRivalConnection">CONNECTING</b>
      </header>
      <div class="scramble-rival-sky" id="scrambleRivalSky" role="img" aria-label="Read-only rival word board"></div>
      <section class="scramble-rival-feed" aria-labelledby="scrambleRivalFeedTitle">
        <h3 id="scrambleRivalFeedTitle">Every rival pairing</h3>
        <ol id="scrambleRivalEvents"></ol>
      </section>
    </section>

    <div class="scramble-countdown" id="scrambleCountdown" role="status" aria-live="assertive" aria-atomic="true" hidden>
      <small>OPEN-BOARD 1V1</small>
      <div class="scramble-countdown__cards" aria-label="Arena combatants">
        <div class="scramble-duel-card-host" id="scrambleCountdownSelfCard"></div>
        <b aria-hidden="true">VS</b>
        <div class="scramble-duel-card-host" id="scrambleCountdownRivalCard"></div>
      </div>
      <strong id="scrambleCountdownValue">3</strong>
      <span id="scrambleCountdownObjective">Create the shared target before your rival.</span>
    </div>
    <aside class="scramble-saga-moment" id="scrambleSagaMoment" role="status" aria-live="assertive" aria-atomic="true" aria-labelledby="scrambleSagaMomentTitle" hidden>
      <small id="scrambleSagaMomentKicker">CHAPTER SOLVED</small>
      <strong id="scrambleSagaMomentTitle">You found the answer</strong>
      <p id="scrambleSagaMomentStory"></p>
      <b id="scrambleSagaMomentScore">YOU 1 &middot; 0 RIVAL</b>
      <span id="scrambleSagaMomentNext">Next riddle incoming&hellip;</span>
    </aside>
    <p class="sr-only" id="scrambleAnnouncer" aria-live="polite" aria-atomic="true"></p>

    <dialog class="scramble-forfeit-dialog" id="scrambleForfeitDialog" aria-labelledby="scrambleForfeitTitle" aria-describedby="scrambleForfeitText">
      <span class="scramble-emblem" aria-hidden="true">&#9889;</span>
      <h2 id="scrambleForfeitTitle">Leave the live match?</h2>
      <p id="scrambleForfeitText">The match cannot pause. Leaving now gives the win to your rival.</p>
      <div><button id="scrambleKeepPlaying" type="button">Keep playing</button><button class="scramble-danger" id="scrambleConfirmForfeit" type="button">Forfeit match</button></div>
    </dialog>

    <dialog class="scramble-result-dialog" id="scrambleResultDialog" aria-labelledby="scrambleResultTitle">
      <button class="scramble-close" type="button" data-scramble-result-home aria-label="Return home">&times;</button>
      <span class="scramble-result-orb" id="scrambleResultOrb" aria-hidden="true">&#10022;</span>
      <small id="scrambleResultKicker">SCRAMBLE ARENA</small>
      <h2 id="scrambleResultTitle" tabindex="-1">Match complete</h2>
      <p id="scrambleResultReason"></p>
      <div class="scramble-result-rating" id="scrambleResultRating">Private match &middot; no rating</div>
      <section class="scramble-result-combatant" id="scrambleResultCombatant" aria-label="Featured Arena combatant">
        <div class="scramble-duel-card-host" id="scrambleResultFeaturedCard"></div>
      </section>
      <div class="scramble-result-stats">
        <section><small id="scrambleResultSelfLabel">YOUR ROUTE</small><strong id="scrambleResultSelfPrimary">0 discoveries</strong><span id="scrambleResultSelfSecondary">0 attempts &middot; 0 echoes</span></section>
        <section><small id="scrambleResultRivalLabel">RIVAL ROUTE</small><strong id="scrambleResultRivalPrimary">0 discoveries</strong><span id="scrambleResultRivalSecondary">0 attempts &middot; 0 echoes</span></section>
      </div>
      <section class="scramble-saga-ledger" id="scrambleSagaLedger" aria-labelledby="scrambleSagaLedgerTitle" hidden>
        <header><small>COMPLETE STORY</small><h3 id="scrambleSagaLedgerTitle">Five-riddle ledger</h3></header>
        <ol id="scrambleSagaLedgerList"></ol>
      </section>
      <div class="scramble-result-actions">
        <button class="scramble-primary" id="scrambleRematch" type="button">Request rematch</button>
        <button id="scrambleShareResult" type="button">Share result</button>
        <button id="scrambleResultHome" type="button">Return home</button>
      </div>
      <p id="scrambleResultStatus" role="status" aria-live="polite"></p>
    </dialog>`;
}

export function createScrambleRuntime(options = {}) {
  const documentRef = options.documentRef || globalThis.document;
  const windowRef = options.windowRef || globalThis.window;
  const request = options.request;
  const storage = safeStorage(windowRef);
  let model = createScrambleState();
  let root = null;
  let trigger = null;
  let inviteCode = "";
  let rankedUnlocked = false;
  let queueActive = false;
  let queueTimer = null;
  let clockTimer = null;
  let heartbeatTimer = null;
  let streamController = null;
  let streamGeneration = 0;
  let reconnectDelay = RECONNECT_MIN_MS;
  let hostMatchId = "";
  let active = false;
  let finishing = false;
  let lastAnnouncedSequence = 0;
  let lastAnnouncedAt = 0;
  let view = "self";
  let actionQueue = Promise.resolve();
  let lifecycleGeneration = 0;
  let controlResyncQueued = false;
  let awaitingRematch = false;
  let selectedFormat = SCRAMBLE_DEFAULT_MODE_ID;
  let selectedQueue = "private";
  let compactLobbyMedia = null;
  let hostedSagaChapterKey = "";
  let sagaChangeQueued = false;
  let lastSagaMomentKey = "";
  let sagaBoundaryResyncKey = "";
  const arenaCards = {
    lobbySelf: null,
    lobbyRival: null,
    countdownSelf: null,
    countdownRival: null,
    resultFeatured: null
  };

  const byId = (id) => documentRef.getElementById(id);

  function ensureSurface() {
    if (root) return root;
    root = documentRef.createElement("div");
    root.className = "scramble-surface";
    root.dataset.scrambleSurface = "true";
    root.innerHTML = surfaceMarkup();
    documentRef.body.append(root);
    const layout = documentRef.querySelector("#gameScreen .game-layout");
    const rivalBoard = byId("scrambleRivalBoard");
    if (layout && rivalBoard) layout.insertBefore(rivalBoard, layout.querySelector(".inventory"));
    const gameScreen = byId("gameScreen");
    const scorebar = byId("scrambleScorebar");
    const countdown = byId("scrambleCountdown");
    if (gameScreen && scorebar) gameScreen.insertBefore(scorebar, gameScreen.querySelector(".game-layout"));
    if (gameScreen && countdown) gameScreen.append(countdown);
    mountArenaCards();
    bindSurface();
    return root;
  }

  function mountArenaCard(key, hostId, side, featured = false) {
    const host = byId(hostId);
    if (!host || arenaCards[key]) return arenaCards[key];
    const card = createArenaDuelCard({
      documentRef,
      side,
      featured,
      status: "Waiting",
      frameSlug: side === "self" ? localFrameSlug() : "",
      player: {
        callsign: side === "self" ? options.callsign?.() || "STARGAZER" : "CONNECTING",
        frameSlug: side === "self" ? localFrameSlug() : ""
      }
    });
    if (card?.element) host.replaceChildren(card.element);
    arenaCards[key] = card || null;
    return arenaCards[key];
  }

  function mountArenaCards() {
    mountArenaCard("lobbySelf", "scrambleLobbySelfCard", "self");
    mountArenaCard("lobbyRival", "scrambleLobbyRivalCard", "rival");
  }

  function bindSurface() {
    root.querySelector("[data-scramble-close]")?.addEventListener("click", closeLobby);
    byId("scrambleDialog")?.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeLobby();
    });
    byId("scrambleCreateInvite")?.addEventListener("click", createInvite);
    byId("scrambleJoinForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void joinInvite(byId("scrambleInviteCode")?.value);
    });
    byId("scrambleFindRival")?.addEventListener("click", joinMatchmaking);
    for (const button of root.querySelectorAll("[data-arena-queue]")) {
      button.addEventListener("click", () => setLobbyQueue(button.dataset.arenaQueue));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = ["ArrowRight", "End"].includes(event.key) ? "ranked" : "private";
        setLobbyQueue(next, { focus: true });
      });
    }
    compactLobbyMedia = windowRef?.matchMedia?.("(max-width: 700px), (max-height: 520px) and (min-width: 520px) and (max-width: 900px)") || null;
    compactLobbyMedia?.addEventListener?.("change", syncLobbyQueuePresentation);
    syncLobbyQueuePresentation();
    byId("scrambleFormatPicker")?.addEventListener("change", (event) => {
      const input = event.target?.closest?.('input[name="scrambleFormat"]');
      if (!input || input.disabled || model.id || queueActive) return;
      const nextFormat = scrambleFormat(input.value, { enabledOnly: true });
      if (nextFormat === selectedFormat) return;
      selectedFormat = nextFormat;
      syncFormatPresentation();
      input.closest(".scramble-format-option")?.scrollIntoView?.({
        block: "nearest",
        inline: "center",
        behavior: windowRef?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth"
      });
      void refreshRating();
    });
    byId("scrambleCopyInvite")?.addEventListener("click", copyInvite);
    byId("scrambleReady")?.addEventListener("click", toggleReady);
    byId("scrambleCancelWait")?.addEventListener("click", cancelWaiting);
    for (const button of documentRef.querySelectorAll("[data-scramble-view]")) {
      button.addEventListener("click", () => setBoardView(button.dataset.scrambleView));
    }
    byId("scrambleKeepPlaying")?.addEventListener("click", () => byId("scrambleForfeitDialog")?.close());
    byId("scrambleConfirmForfeit")?.addEventListener("click", forfeit);
    byId("scrambleRematch")?.addEventListener("click", requestRematch);
    byId("scrambleShareResult")?.addEventListener("click", shareResult);
    byId("scrambleResultHome")?.addEventListener("click", returnHome);
    root.querySelector("[data-scramble-result-home]")?.addEventListener("click", returnHome);
    byId("scrambleForfeitDialog")?.addEventListener("cancel", (event) => {
      event.preventDefault();
      byId("scrambleForfeitDialog")?.close();
    });
  }

  function rememberMatch() {
    if (!model.id || ["finished", "cancelled"].includes(model.status)) {
      storage?.removeItem(ACTIVE_MATCH_KEY);
      return;
    }
    try {
      storage?.setItem(ACTIVE_MATCH_KEY, JSON.stringify({ id: model.id, savedAt: Date.now() }));
    } catch { /* A private tab can keep the match in memory. */ }
  }

  function rememberedMatchId() {
    try {
      const saved = JSON.parse(storage?.getItem(ACTIVE_MATCH_KEY) || "null");
      return typeof saved?.id === "string" && saved.id.length <= 96 ? saved.id : "";
    } catch {
      return "";
    }
  }

  function clearRememberedMatch() {
    try { storage?.removeItem(ACTIVE_MATCH_KEY); } catch { /* Ignore blocked storage. */ }
  }

  function lobbyMessage(message, error = false) {
    const status = byId("scrambleLobbyStatus");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", error);
  }

  function syncLobbyQueuePresentation() {
    if (!root) return;
    const compact = compactLobbyMedia?.matches === true;
    const dialog = byId("scrambleDialog");
    if (dialog) dialog.dataset.arenaQueue = selectedQueue;
    for (const button of root.querySelectorAll("[data-arena-queue]")) {
      const selected = button.dataset.arenaQueue === selectedQueue;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    for (const panel of root.querySelectorAll("[data-arena-queue-panel]")) {
      const hidden = compact && panel.dataset.arenaQueuePanel !== selectedQueue;
      panel.hidden = hidden;
      panel.inert = hidden;
      panel.setAttribute("aria-hidden", String(hidden));
    }
  }

  function setLobbyQueue(queue, { focus = false } = {}) {
    const next = queue === "ranked" ? "ranked" : "private";
    selectedQueue = next;
    syncLobbyQueuePresentation();
    if (focus) root?.querySelector(`[data-arena-queue="${next}"]`)?.focus?.({ preventScroll: true });
  }

  function currentSelf() {
    return scramblePlayerPair(model).self;
  }

  function currentRival() {
    return scramblePlayerPair(model).rival;
  }

  function localFrameSlug() {
    const candidate = typeof options.frameSlug === "function"
      ? options.frameSlug()
      : options.frameSlug;
    return profileFrameBySlug(candidate)?.slug || "";
  }

  function arenaCardPlayer(player, side = "self") {
    const isSelf = side === "self";
    const callsign = String(
      player?.callsign
      || (isSelf ? options.callsign?.() : "")
      || (isSelf ? "STARGAZER" : "CONNECTING")
    ).trim().slice(0, 48);
    const frameSlug = profileFrameBySlug(
      player?.frameSlug || (isSelf ? localFrameSlug() : "")
    )?.slug || "";
    const rating = Math.floor(Number(player?.rating?.value ?? player?.rating) || 0);
    return {
      ...record(player),
      callsign,
      frameSlug,
      mark: String(player?.mark || callsign.charAt(0) || (isSelf ? "Y" : "R")).slice(0, 2).toUpperCase(),
      rank: rating > 0 ? `Arena rating ${rating}` : isSelf ? "Your constellation" : "Rival constellation"
    };
  }

  function syncArenaCard(card, player, side, status, featured = false) {
    if (!card?.sync) return;
    const combatant = arenaCardPlayer(player, side);
    card.sync({
      player: combatant,
      callsign: combatant.callsign,
      frameSlug: combatant.frameSlug,
      side,
      status,
      featured
    });
  }

  function applyArenaFrameAccents() {
    const scorebar = byId("scrambleScorebar");
    const accentHosts = [root, scorebar].filter(Boolean);
    if (!accentHosts.length) return;
    for (const [side, player] of [
      ["self", currentSelf()],
      ["rival", currentRival()]
    ]) {
      const entry = profileFrameBySlug(arenaCardPlayer(player, side).frameSlug);
      const accent = entry?.palette?.[0] || (side === "self" ? "#69e6ff" : "#a886ff");
      const accentAlt = entry?.palette?.[1] || accent;
      for (const host of accentHosts) {
        host.style.setProperty(`--scramble-${side}-frame-accent`, accent);
        host.style.setProperty(`--scramble-${side}-frame-accent-alt`, accentAlt);
        host.dataset[`${side}ArenaFrame`] = entry?.slug || "none";
      }
    }
  }

  function authoritativeFormat() {
    return model.id
      ? scrambleFormat(model.format)
      : selectedFormat;
  }

  function clearFormatData() {
    for (const element of [
      documentRef.body,
      root,
      byId("scrambleScorebar"),
      byId("scrambleRivalBoard"),
      byId("scrambleCountdown"),
      byId("scrambleSagaMoment")
    ]) {
      if (element?.dataset) delete element.dataset.scrambleFormat;
    }
  }

  function setFormatData(format = authoritativeFormat()) {
    const value = scrambleFormat(format);
    for (const element of [
      documentRef.body,
      root,
      byId("scrambleScorebar"),
      byId("scrambleRivalBoard"),
      byId("scrambleCountdown"),
      byId("scrambleSagaMoment")
    ]) {
      if (element?.dataset) element.dataset.scrambleFormat = value;
    }
  }

  function syncFormatPresentation() {
    if (!root) return;
    const format = authoritativeFormat();
    const definition = scrambleFormatDefinition(format);
    if (model.id) selectedFormat = format;
    setFormatData(format);
    const locked = Boolean(model.id || queueActive);
    const picker = byId("scrambleFormatPicker");
    if (picker) {
      picker.disabled = locked;
      picker.setAttribute("aria-disabled", String(locked));
    }
    for (const input of root.querySelectorAll('input[name="scrambleFormat"]')) {
      const option = getScrambleModeDefinition(input.value);
      input.checked = input.value === format;
      input.disabled = locked || option?.enabled !== true;
    }
    setText(
      root,
      "#scrambleFormatObjective",
      `Objective: ${model.id ? model.objective || definition.objective : definition.objective}`
    );
    setText(root, "#scramblePrivateCopy",
      `Create a single-use ${definition.label} link. Private matches never affect mode ratings.`);
    setText(root, "#scrambleRankedCopy",
      `Play ${definition.label} against a public opponent. Wins and losses change only this mode's rating.`);
    setText(root, "#scrambleRatingLabel", `${definition.label} Rating`);
    setText(root, "#scrambleScoreMode", definition.label.toUpperCase());
  }

  function showLobby() {
    ensureSurface();
    syncFormatPresentation();
    syncLobbyQueuePresentation();
    const dialog = byId("scrambleDialog");
    if (dialog) dialog.dataset.arenaPhase = model.id || queueActive ? "combatants" : "modes";
    if (!dialog?.open) dialog?.showModal();
    requestAnimationFrame(() => byId("scrambleTitle")?.focus({ preventScroll: true }));
  }

  function closeLobby() {
    const dialog = byId("scrambleDialog");
    if (queueActive) {
      void cancelMatchmaking().then(() => {
        dialog?.close();
        clearFormatData();
        trigger?.focus?.({ preventScroll: true });
      });
      return;
    }
    dialog?.close();
    if (!model.id && !queueActive) clearFormatData();
    trigger?.focus?.({ preventScroll: true });
  }

  function renderAvailability() {
    // The host synchronizes ranked eligibility as soon as the lazy runtime is
    // created. The surface itself is mounted only when the player opens it.
    if (!root) return;
    const available = options.available !== false && typeof request === "function";
    const privateButton = byId("scrambleCreateInvite");
    const joinInput = byId("scrambleInviteCode");
    const joinButton = byId("scrambleJoinForm")?.querySelector("button");
    const rankedButton = byId("scrambleFindRival");
    for (const element of [privateButton, joinInput, joinButton]) if (element) element.disabled = !available;
    if (rankedButton) rankedButton.disabled = !available || !rankedUnlocked;
    const rankedLock = byId("scrambleRankedLock");
    if (rankedLock) rankedLock.hidden = rankedUnlocked;
    if (!available) lobbyMessage("Live 1v1 needs an online Scramble service. Solo play is still available.", true);
  }

  async function refreshRating({ allowDuringFinishedMatch = false } = {}) {
    if (options.available === false || typeof request !== "function") return;
    const format = selectedFormat;
    try {
      const payload = await request(`/rating?format=${encodeURIComponent(format)}`);
      if (format !== selectedFormat || model.id && !(allowDuringFinishedMatch && model.status === "finished")) return;
      const arena = record(payload?.scrambleArena || payload?.arena);
      const ratings = record(arena.ratings || payload?.ratings || payload?.modeRatings);
      const rawRating = payload?.modeRating
        ?? ratings[format]
        ?? payload?.rating
        ?? (format === SCRAMBLE_DEFAULT_MODE_ID ? payload?.duelRating : null);
      const rating = record(rawRating);
      const value = Math.floor(Number(
        typeof rawRating === "number" ? rawRating : rating.value ?? rating.rating ?? rating.score
      ));
      const placement = String(rating.placement || "").toLowerCase();
      const label = Number.isFinite(value)
        ? rating.games === 0 || placement === "unplaced" ? "Unplaced" : String(value)
        : placement === "provisional" ? "Provisional" : "Unplaced";
      const league = scrambleArenaLeaguePresentation(arena.progression);
      const leagueCard = byId("scrambleArenaRank");
      if (leagueCard) leagueCard.dataset.arenaRank = league.id;
      setText(root, "#scrambleArenaRankMark", league.mark);
      setText(root, "#scrambleArenaRankName", league.label);
      setText(root, "#scrambleArenaRankProgress", league.next
        ? `${league.xpRemaining} XP TO ${league.next.name.toUpperCase()}`
        : "TOP LEAGUE");
      setText(root, "#scrambleRating", label);
      options.onRatingChange?.({
        format,
        label: scrambleFormatDefinition(format).label,
        rating,
        progression: arena.progression,
        league
      });
    } catch {
      if (format === selectedFormat && !model.id) setText(root, "#scrambleRating", "Unavailable");
    }
  }

  function renderLobby() {
    if (!root) return;
    syncFormatPresentation();
    const waiting = Boolean(model.id || queueActive);
    const dialog = byId("scrambleDialog");
    if (dialog) dialog.dataset.arenaPhase = waiting ? "combatants" : "modes";
    byId("scrambleLobbyChoices").hidden = waiting;
    byId("scrambleWaiting").hidden = !waiting;
    if (!waiting) {
      syncLobbyQueuePresentation();
      renderAvailability();
      return;
    }
    const self = currentSelf();
    const rival = currentRival();
    const ranked = model.ranked || queueActive;
    const definition = scrambleFormatDefinition(authoritativeFormat());
    setText(root, "#scrambleWaitingKicker", ranked ? "PUBLIC RANKED" : "PRIVATE 1V1");
    setText(root, "#scrambleWaitingTitle", queueActive
      ? "Searching the constellation"
      : rival ? "Rival found" : "Waiting for a rival");
    setText(root, "#scrambleWaitingCopy", queueActive
      ? `Looking for another ${definition.label} player near your mode rating.`
      : rival ? `Both players must be ready. ${model.objective || definition.objective} The match begins after the countdown.`
        : "Send the invitation, then keep this window open.");
    byId("scrambleInviteOutput").hidden = ranked || !inviteCode;
    byId("scrambleLobbyVersus").hidden = !self && !rival;
    setText(root, "#scrambleLobbySelf", self?.callsign || options.callsign?.() || "STARGAZER");
    setText(root, "#scrambleLobbyRival", rival?.callsign || "CONNECTING");
    setText(root, "#scrambleSelfReady", self?.ready ? "Ready" : "Not ready");
    setText(root, "#scrambleRivalReady", rival?.ready ? "Ready" : rival ? "Not ready" : "Waiting");
    syncArenaCard(
      arenaCards.lobbySelf,
      self,
      "self",
      self?.connected === false ? "disconnected" : self?.ready ? "ready" : "waiting"
    );
    syncArenaCard(
      arenaCards.lobbyRival,
      rival,
      "rival",
      rival?.connected === false ? "disconnected" : rival?.ready ? "ready" : "waiting"
    );
    applyArenaFrameAccents();
    const ready = byId("scrambleReady");
    ready.hidden = !self || !rival || queueActive || !["waiting", "countdown"].includes(model.status);
    ready.textContent = self?.ready ? "Not ready" : "Ready";
    ready.setAttribute("aria-pressed", String(Boolean(self?.ready)));
    byId("scrambleCancelWait").textContent = queueActive ? "Cancel search" : "Leave lobby";
  }

  function latestRivalEvent() {
    const rivalId = currentRival()?.id;
    const chapterNumber = authoritativeFormat() === "riddle-saga" ? model.saga?.chapterNumber : 0;
    return [...model.events].reverse().find((event) => event.actorId === rivalId
      && RIVAL_EVENT_TYPES.has(event.type)
      && (!chapterNumber || !event.chapterNumber || event.chapterNumber === chapterNumber));
  }

  function rivalSuccessWords() {
    const rivalId = currentRival()?.id;
    if (authoritativeFormat() === "riddle-saga") {
      const board = (Array.isArray(model.boards) ? model.boards : [])
        .find((candidate) => candidate?.slot === rivalId);
      if (Array.isArray(board?.words) && board.words.length) return board.words.slice(-80);
    }
    const words = [...model.starters];
    const known = new Set(words.map((item) => item.word.toLowerCase()));
    for (const event of model.events) {
      if (event.actorId !== rivalId || event.type !== "success" || !event.result?.word) continue;
      if (known.has(event.result.word.toLowerCase())) continue;
      known.add(event.result.word.toLowerCase());
      words.push(event.result);
    }
    return words.slice(-80);
  }

  function playerFormatState(player) {
    const direct = record(player?.formatState);
    if (Object.keys(direct).length) return direct;
    const board = (Array.isArray(model.boards) ? model.boards : []).find((candidate) => {
      const source = record(candidate);
      return String(source.slot || source.playerId || source.playerSlot || source.participantSlot || source.id || "") === String(player?.id || "");
    });
    return record(board?.formatState);
  }

  function formatNumber(value, fallback = 0) {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) ? Math.max(0, number) : fallback;
  }

  function modePlayerPresentation(player, metrics = {}) {
    const format = authoritativeFormat();
    const definition = scrambleFormatDefinition(format);
    const state = playerFormatState(player);
    const config = { ...record(definition.config), ...record(model.config), ...record(model.rules) };
    const successes = formatNumber(metrics.successes ?? player?.discoveries);
    const attempts = formatNumber(metrics.attempts ?? player?.attempts);
    if (format === "riddle-saga") {
      const score = (Array.isArray(model.saga?.scores) ? model.saga.scores : [])
        .find((entry) => entry?.slot === player?.id);
      const points = formatNumber(score?.score);
      const chaptersWon = formatNumber(score?.chaptersWon);
      const chapterCount = Math.max(1, formatNumber(model.saga?.chapterCount, 5));
      return {
        summary: `${points} ${points === 1 ? "point" : "points"} \u00b7 ${chaptersWon} ${chaptersWon === 1 ? "riddle" : "riddles"}`,
        champion: "",
        primary: `${points} ${points === 1 ? "point" : "points"}`,
        secondary: `${chaptersWon} of ${chapterCount} riddles \u00b7 finale +2`,
        progress: points,
        maximum: Math.max(1, formatNumber(model.rules?.chapterPoints?.reduce?.((sum, value) => sum + formatNumber(value), 0), chapterCount + 1)),
        progressText: `${points} authoritative saga points`
      };
    }
    if (format === "wordstorm") {
      const score = formatNumber(state.score ?? metrics.score ?? successes);
      const quota = Math.max(1, formatNumber(state.quota ?? config.discoveryQuota, 12));
      return {
        summary: `${score} / ${quota} score \u00b7 ${successes} discoveries`,
        champion: "",
        primary: `${score} / ${quota} score`,
        secondary: `${successes} discoveries \u00b7 ${attempts} attempts`,
        progress: score,
        maximum: quota,
        progressText: `${score} of ${quota} score`
      };
    }
    if (format === "forge-clash") {
      const turnLimit = Math.max(1, formatNumber(state.turnLimit ?? config.turnLimit, 6));
      const turnsLeft = formatNumber(state.turnsLeft, Math.max(0, turnLimit - attempts));
      const depth = formatNumber(state.depth ?? state.champion?.depth);
      const champion = record(state.champion);
      const championWord = String(champion.word || "").trim().slice(0, 48);
      const championLabel = championWord
        ? `Champion: ${String(champion.emoji || "\u2726").slice(0, 12)} ${championWord}`
        : "Champion: not forged";
      return {
        summary: `${turnsLeft} turns left \u00b7 depth ${depth}`,
        champion: championLabel,
        primary: championLabel,
        secondary: `${turnsLeft} of ${turnLimit} turns left \u00b7 depth ${depth}`,
        progress: Math.max(0, turnLimit - turnsLeft),
        maximum: turnLimit,
        progressText: `${Math.max(0, turnLimit - turnsLeft)} of ${turnLimit} forge turns used`
      };
    }
    return {
      summary: `${successes} discoveries \u00b7 ${attempts} attempts`,
      champion: "",
      primary: `${successes} discoveries`,
      secondary: `${attempts} attempts \u00b7 ${formatNumber(metrics.echoSteals)} echoes`,
      progress: successes,
      maximum: Math.max(1, successes),
      progressText: `${successes} discoveries`
    };
  }

  function sagaScore(slot) {
    return (Array.isArray(model.saga?.scores) ? model.saga.scores : [])
      .find((entry) => entry?.slot === slot) || { score: 0, chaptersWon: 0 };
  }

  function sagaChapterPoints(number, chapter) {
    const direct = formatNumber(chapter?.chapterPoints);
    if (direct) return direct;
    const rules = Array.isArray(model.rules?.chapterPoints) ? model.rules.chapterPoints : [];
    return formatNumber(rules[number - 1]);
  }

  function renderSagaMoment() {
    const moment = byId("scrambleSagaMoment");
    const saga = record(model.saga);
    const settled = Array.isArray(saga.settledChapters) ? saga.settledChapters : [];
    const chapter = settled.at(-1);
    if (authoritativeFormat() !== "riddle-saga" || saga.status !== "intermission" || !chapter) {
      if (moment) moment.hidden = true;
      documentRef.body.classList.remove("scramble-saga-intermission");
      return;
    }
    const self = currentSelf();
    const rival = currentRival();
    const winner = chapter.winnerId;
    const timedOut = chapter.status === "timeout" || !winner;
    const selfResult = winner && winner === self?.id;
    const rivalResult = winner && winner === rival?.id;
    const key = `${model.id}:${chapter.number}:${chapter.status}:${winner}:${saga.chapterVersion}`;
    if (key !== lastSagaMomentKey) {
      lastSagaMomentKey = key;
      setText(root, "#scrambleSagaMomentKicker", timedOut ? "CHAPTER ENDED" : selfResult ? "RIDDLE WON" : "RIDDLE SOLVED");
      setText(root, "#scrambleSagaMomentTitle", timedOut
        ? "The answer stayed hidden"
        : selfResult ? "You found it first" : `${rival?.callsign || "Your rival"} found it first`);
      setText(root, "#scrambleSagaMomentStory",
        `${chapter.title || `Chapter ${chapter.number}`} \u00b7 ${chapter.target || "Riddle closed"}`);
      const selfScore = sagaScore(self?.id).score;
      const rivalScore = sagaScore(rival?.id).score;
      setText(root, "#scrambleSagaMomentScore", `YOU ${selfScore} \u00b7 ${rivalScore} RIVAL`);
      setText(root, "#scrambleSagaMomentNext",
        chapter.number >= saga.chapterCount ? "The complete story is settling\u2026" : "Next riddle incoming\u2026");
    }
    if (moment) moment.hidden = false;
    documentRef.body.classList.add("scramble-saga-intermission");
  }

  function renderSagaTrack() {
    const track = byId("scrambleSagaTrack");
    const isSaga = authoritativeFormat() === "riddle-saga";
    if (!track) return;
    track.hidden = !isSaga;
    if (!isSaga) {
      renderSagaMoment();
      return;
    }
    const saga = record(model.saga);
    const current = record(saga.currentChapter);
    const chapterCount = Math.max(1, formatNumber(saga.chapterCount, 5));
    const chapterNumber = Math.max(1, formatNumber(saga.chapterNumber, 1));
    const points = sagaChapterPoints(chapterNumber, current);
    const finale = chapterNumber === chapterCount || points > 1;
    setText(root, "#scrambleSagaArc", saga.arcTitle || "RIDDLE SAGA");
    setText(root, "#scrambleSagaChapter", `Chapter ${chapterNumber} of ${chapterCount}`);
    const value = byId("scrambleSagaValue");
    if (value) {
      value.textContent = finale ? `FINALE \u00b7 +${points || 2} POINTS` : `+${points || 1} POINT`;
      value.classList.toggle("is-finale", finale);
    }
    setText(root, "#scrambleSagaTitle", current.title || `Riddle ${chapterNumber}`);
    setText(root, "#scrambleSagaStory", current.story || "The next story beat is arriving.");
    setText(root, "#scrambleSagaTarget", current.target || "Hidden");
    const self = currentSelf();
    const rival = currentRival();
    const selfScore = sagaScore(self?.id);
    const rivalScore = sagaScore(rival?.id);
    setText(root, "#scrambleSagaSelfScore", selfScore.score);
    setText(root, "#scrambleSagaRivalScore", rivalScore.score);
    setText(root, "#scrambleSagaSelfWins", `${selfScore.chaptersWon} ${selfScore.chaptersWon === 1 ? "riddle" : "riddles"}`);
    setText(root, "#scrambleSagaRivalWins", `${rivalScore.chaptersWon} ${rivalScore.chaptersWon === 1 ? "riddle" : "riddles"}`);

    const settled = Array.isArray(saga.settledChapters) ? saga.settledChapters : [];
    const list = byId("scrambleSagaChapters");
    if (list) {
      list.replaceChildren(...Array.from({ length: chapterCount }, (_, index) => {
        const number = index + 1;
        const result = settled.find((chapter) => chapter?.number === number);
        const item = documentRef.createElement("li");
        const pointValue = sagaChapterPoints(number, result || (number === chapterNumber ? current : null));
        const status = result?.status === "won"
          ? result.winnerId === self?.id ? "won" : "lost"
          : result?.status === "timeout" ? "timeout"
            : number === chapterNumber ? saga.status === "intermission" ? "settled" : "current"
              : number < chapterNumber ? "settled" : "locked";
        item.dataset.status = status;
        if (number === chapterNumber) item.setAttribute("aria-current", "step");
        item.setAttribute("aria-label",
          `${number === chapterCount ? "Finale" : `Chapter ${number}`}, ${status}${pointValue ? `, ${pointValue} ${pointValue === 1 ? "point" : "points"}` : ""}`);
        const marker = documentRef.createElement("b");
        marker.textContent = result?.status === "won" ? result.winnerId === self?.id ? "\u2713" : "\u00d7"
          : result?.status === "timeout" ? "\u2013" : String(number);
        const label = documentRef.createElement("span");
        label.textContent = number === chapterCount ? "FINALE" : `R${number}`;
        const score = documentRef.createElement("small");
        score.textContent = pointValue ? `+${pointValue}` : number === chapterCount ? "+2" : "";
        item.append(marker, label, score);
        return item;
      }));
    }
    renderSagaMoment();
  }

  function renderSagaLedger() {
    const ledger = byId("scrambleSagaLedger");
    if (!ledger) return;
    const isSaga = authoritativeFormat() === "riddle-saga";
    ledger.hidden = !isSaga;
    if (!isSaga) return;
    const saga = record(model.saga);
    const self = currentSelf();
    const rival = currentRival();
    const chapters = Array.isArray(saga.settledChapters) ? saga.settledChapters : [];
    const list = byId("scrambleSagaLedgerList");
    if (!list) return;
    list.replaceChildren(...chapters.map((chapter) => {
      const item = documentRef.createElement("li");
      const heading = documentRef.createElement("span");
      const title = documentRef.createElement("strong");
      const outcome = documentRef.createElement("small");
      heading.textContent = chapter.number === saga.chapterCount ? "FINALE" : `RIDDLE ${chapter.number}`;
      title.textContent = `${chapter.title || `Chapter ${chapter.number}`} \u00b7 ${chapter.target || "No answer"}`;
      const winner = chapter.winnerId === self?.id ? "You"
        : chapter.winnerId === rival?.id ? rival?.callsign || "Rival" : "No one";
      outcome.textContent = chapter.status === "timeout"
        ? "Timed out \u00b7 no points"
        : `${winner} won \u00b7 +${sagaChapterPoints(chapter.number, chapter)} ${sagaChapterPoints(chapter.number, chapter) === 1 ? "point" : "points"}`;
      item.append(heading, title, outcome);
      return item;
    }));
  }

  function renderRivalBoard() {
    if (!root || !active) return;
    const rival = currentRival();
    const self = currentSelf();
    const selfMetrics = model.metrics[self?.id] || {};
    const rivalMetrics = model.metrics[rival?.id] || {};
    const selfPresentation = modePlayerPresentation(self, selfMetrics);
    const rivalPresentation = modePlayerPresentation(rival, rivalMetrics);
    renderSagaTrack();
    applyArenaFrameAccents();
    setText(root, "#scrambleSelfName", self?.callsign || options.callsign?.() || "STARGAZER");
    setText(root, "#scrambleRivalName", rival?.callsign || "CONNECTING");
    setText(root, "#scrambleRivalBoardTitle", `${rival?.callsign || "Rival"} \u00b7 ${scrambleFormatDefinition(authoritativeFormat()).label}`);
    setText(root, "#scrambleSelfModeStats", selfPresentation.summary);
    setText(root, "#scrambleRivalModeStats", rivalPresentation.summary);
    for (const [id, value] of [
      ["scrambleSelfChampion", selfPresentation.champion],
      ["scrambleRivalChampion", rivalPresentation.champion]
    ]) {
      const element = byId(id);
      if (!element) continue;
      element.hidden = !value;
      element.textContent = value;
    }
    const connected = rival?.connected !== false;
    setText(root, "#scrambleRivalConnection", connected ? "LIVE" : "RECONNECTING");
    setText(root, "#scrambleConnection", connected ? "LIVE" : "RIVAL RECONNECTING");
    const latest = latestRivalEvent();
    setText(root, "#scrambleTickerText", latest
      ? scrambleEventSentence(latest, { selfId: model.selfId, format: authoritativeFormat() })
      : "Waiting for their first pairing\u2026");
    const maximum = authoritativeFormat() === "target-race"
      ? Math.max(1, selfPresentation.progress, rivalPresentation.progress)
      : Math.max(1, rivalPresentation.maximum);
    const progress = Math.min(100, Math.round((rivalPresentation.progress / maximum) * 100));
    const progressRoot = byId("scrambleMiniProgress")?.parentElement;
    if (progressRoot) {
      progressRoot.setAttribute("aria-valuemax", String(maximum));
      progressRoot.setAttribute("aria-valuenow", String(Math.min(maximum, rivalPresentation.progress)));
      progressRoot.setAttribute("aria-valuetext", rivalPresentation.progressText);
      progressRoot.setAttribute("aria-label", `${scrambleFormatDefinition(authoritativeFormat()).label} rival progress`);
    }
    if (byId("scrambleMiniProgress")) byId("scrambleMiniProgress").style.width = `${progress}%`;

    const sky = byId("scrambleRivalSky");
    if (sky) {
      sky.replaceChildren(...rivalSuccessWords().map((item, index) => {
        const word = documentRef.createElement("span");
        const position = deterministicPosition(item.word, index);
        word.className = "scramble-rival-word";
        word.style.setProperty("--rival-x", `${position.x}%`);
        word.style.setProperty("--rival-y", `${position.y}%`);
        word.textContent = `${item.emoji || "\u2726"} ${item.word}`;
        word.setAttribute("aria-hidden", "true");
        return word;
      }));
      sky.setAttribute("aria-label", `${rival?.callsign || "Rival"} has ${rivalSuccessWords().length} visible words`);
    }

    const events = byId("scrambleRivalEvents");
    const sagaChapter = authoritativeFormat() === "riddle-saga" ? model.saga?.chapterNumber : 0;
    const rivalEvents = model.events.filter((event) => event.actorId === rival?.id
      && RIVAL_EVENT_TYPES.has(event.type)
      && (!sagaChapter || !event.chapterNumber || event.chapterNumber === sagaChapter));
    if (events) {
      events.replaceChildren(...rivalEvents.map((event) => {
        const item = documentRef.createElement("li");
        item.dataset.eventType = event.type;
        const label = documentRef.createElement("small");
        label.textContent = event.type === "success" ? "DISCOVERY"
          : event.type === "failure" ? "NO MATCH"
            : event.type.replaceAll("_", " ").toUpperCase();
        const sentence = documentRef.createElement("span");
        sentence.textContent = scrambleEventSentence(event, {
          selfId: model.selfId,
          format: authoritativeFormat()
        });
        item.append(label, sentence);
        return item;
      }));
      events.lastElementChild?.scrollIntoView?.({ block: "nearest" });
    }
  }

  function announceNewEvents() {
    const next = model.events.filter((event) => event.sequence > lastAnnouncedSequence);
    if (!next.length) return;
    lastAnnouncedSequence = Math.max(lastAnnouncedSequence, ...next.map((event) => event.sequence));
    const rivalId = currentRival()?.id;
    const important = [...next].reverse().find((event) => event.actorId === rivalId
      && ["success", "failure", "first_light", "echo_steal", "intercept", "disconnect", "reconnect", "chapter_won", "chapter_timeout"].includes(event.type));
    if (!important) return;
    const now = Date.now();
    if (now - lastAnnouncedAt < 900 && !["first_light", "finished"].includes(important.type)) return;
    lastAnnouncedAt = now;
    setText(root, "#scrambleAnnouncer", scrambleEventSentence(important, {
      selfId: model.selfId,
      format: authoritativeFormat()
    }));
  }

  function setBoardView(next) {
    view = next === "rival" ? "rival" : "self";
    documentRef.body.classList.toggle("scramble-view-rival", view === "rival");
    for (const button of documentRef.querySelectorAll("[data-scramble-view]")) {
      button.setAttribute("aria-pressed", String(button.dataset.scrambleView === view));
    }
    if (view === "rival") byId("scrambleRivalBoardTitle")?.focus?.({ preventScroll: true });
  }

  function renderClock() {
    if (!active) return;
    const definition = scrambleFormatDefinition(authoritativeFormat());
    const saga = authoritativeFormat() === "riddle-saga" ? record(model.saga) : null;
    const chapterDeadline = Date.parse(saga?.chapterDeadlineAt || "");
    const intermissionDeadline = Date.parse(saga?.nextChapterAt || "");
    const seconds = saga && saga.status === "intermission" && Number.isFinite(intermissionDeadline)
      ? Math.max(0, Math.ceil((intermissionDeadline - Date.now()) / 1_000))
      : saga && Number.isFinite(chapterDeadline)
        ? Math.max(0, Math.ceil((chapterDeadline - Date.now()) / 1_000))
        : scrambleClockSeconds(model);
    const sagaBoundary = saga?.status === "intermission" ? intermissionDeadline : chapterDeadline;
    if (saga && Number.isFinite(sagaBoundary) && sagaBoundary <= Date.now()) {
      const key = `${model.id}:${saga.status}:${saga.chapterVersion ?? saga.revision}:${sagaBoundary}`;
      if (key !== sagaBoundaryResyncKey) {
        sagaBoundaryResyncKey = key;
        scheduleSnapshotResync(model.id);
      }
    }
    setText(root, "#scrambleClock", formatScrambleClock(seconds));
    setText(root, "#scrambleScoreMode", saga
      ? saga.status === "intermission" ? "CHAPTER BREAK" : `RIDDLE ${saga.chapterNumber || 1}`
      : definition.label.toUpperCase());
    byId("scrambleClock")?.parentElement?.setAttribute(
      "aria-label",
      `${saga?.status === "intermission" ? "Next riddle in" : "Time remaining"} ${seconds} seconds`
    );
    const startsAt = Date.parse(saga?.chapterStartsAt || model.startsAt || "");
    const untilStart = Number.isFinite(startsAt) ? Math.ceil((startsAt - Date.now()) / 1000) : 0;
    const counting = model.status === "countdown"
      || saga?.status !== "intermission" && untilStart > 0;
    const countdown = byId("scrambleCountdown");
    countdown.hidden = !counting;
    documentRef.body.classList.toggle("scramble-counting-down", counting);
    if (counting) {
      const countdownSelf = mountArenaCard("countdownSelf", "scrambleCountdownSelfCard", "self");
      const countdownRival = mountArenaCard("countdownRival", "scrambleCountdownRivalCard", "rival");
      syncArenaCard(countdownSelf, currentSelf(), "self", "countdown");
      syncArenaCard(countdownRival, currentRival(), "rival", "countdown");
      applyArenaFrameAccents();
      const value = Math.max(1, Math.min(SCRAMBLE_COUNTDOWN_SECONDS, untilStart || SCRAMBLE_COUNTDOWN_SECONDS));
      setText(root, "#scrambleCountdownValue", value);
      setText(root, "#scrambleCountdownObjective",
        definition.id === "riddle-saga"
          ? `Chapter ${saga?.chapterNumber || 1}: create ${saga?.currentChapter?.target || "the answer"}.`
          : definition.id === "target-race" && model.target
          ? `First to create ${model.target} wins.`
          : model.objective || definition.objective);
    }
    if (!counting && model.status === "active" && (!saga || saga.status === "playing")) {
      options.onMatchLive?.(model);
    }
  }

  function renderResult() {
    const presentation = scrambleResultPresentation(model);
    const definition = scrambleFormatDefinition(authoritativeFormat());
    const self = currentSelf();
    const rival = currentRival();
    const selfPresentation = modePlayerPresentation(self, presentation.selfMetrics);
    const rivalPresentation = modePlayerPresentation(rival, presentation.rivalMetrics);
    const outcomeReason = presentation.tied
      ? definition.id === "wordstorm"
        ? "You finished level on score when the storm ended."
        : definition.id === "forge-clash"
          ? "Both forged champions were evenly matched."
          : definition.id === "riddle-saga"
            ? "The complete story ended with both riddle scores level."
          : "Neither player reached the objective before time ran out."
      : presentation.won
        ? definition.id === "wordstorm"
          ? "You reached the scoring objective first."
          : definition.id === "forge-clash"
            ? "Your forged champion won the clash."
            : definition.id === "riddle-saga"
              ? "You won the most riddle points across the complete story."
            : "You completed the shared objective first."
        : definition.id === "wordstorm"
          ? "Your rival reached the scoring objective first."
          : definition.id === "forge-clash"
            ? "Your rival's forged champion won the clash."
            : definition.id === "riddle-saga"
              ? "Your rival won the most riddle points across the complete story."
            : "Your rival completed the shared objective first.";
    const delta = Number(presentation.ratingDelta) || 0;
    const rating = record(model.rating);
    setText(root, "#scrambleResultKicker",
      `${model.ranked ? "RANKED" : "PRIVATE"} ${definition.label.toUpperCase()}`);
    setText(root, "#scrambleResultTitle", presentation.title);
    setText(root, "#scrambleResultReason", presentation.finishReasonLabel || outcomeReason);
    setText(root, "#scrambleResultRating", model.ranked
      ? rating.rated === false
        ? `${definition.label} Rating \u00b7 unrated match`
        : `${definition.label} Rating ${delta > 0 ? "+" : ""}${delta}`
      : "Private match \u00b7 no rating");
    const winner = model.winnerId
      ? [self, rival].find((player) => player?.id === model.winnerId) || null
      : null;
    const featuredPlayer = winner || self || rival;
    const featuredSide = featuredPlayer?.id && featuredPlayer.id === rival?.id ? "rival" : "self";
    const resultCombatant = byId("scrambleResultCombatant");
    if (resultCombatant) {
      resultCombatant.hidden = !featuredPlayer;
      resultCombatant.dataset.outcome = presentation.tied
        ? "draw"
        : featuredSide === "self" ? "self" : "rival";
    }
    const resultFeatured = mountArenaCard(
      "resultFeatured",
      "scrambleResultFeaturedCard",
      featuredSide,
      true
    );
    syncArenaCard(
      resultFeatured,
      featuredPlayer,
      featuredSide,
      winner ? "winner" : "defeated",
      true
    );
    applyArenaFrameAccents();
    setText(root, "#scrambleResultSelfLabel",
      definition.id === "forge-clash" ? "YOUR FORGE" : definition.id === "riddle-saga" ? "YOUR STORY" : "YOUR RUN");
    setText(root, "#scrambleResultRivalLabel",
      definition.id === "forge-clash" ? "RIVAL FORGE" : definition.id === "riddle-saga" ? "RIVAL STORY" : "RIVAL RUN");
    setText(root, "#scrambleResultSelfPrimary", selfPresentation.primary);
    setText(root, "#scrambleResultSelfSecondary", selfPresentation.secondary);
    setText(root, "#scrambleResultRivalPrimary", rivalPresentation.primary);
    setText(root, "#scrambleResultRivalSecondary", rivalPresentation.secondary);
    setText(root, "#scrambleResultOrb", presentation.won ? "\u2726" : presentation.tied ? "\u25c7" : "\u25cc");
    byId("scrambleRematch").disabled = model.status !== "finished";
    renderSagaLedger();
  }

  function render() {
    if (!root) return;
    renderLobby();
    renderClock();
    renderRivalBoard();
    announceNewEvents();
    if (model.status === "finished") renderResult();
  }

  function normalizePayload(payload) {
    const events = payloadEvents(payload);
    if (events.length && !payload?.duel && !payload?.match && !payload?.snapshot) {
      return { revision: Math.max(model.revision, ...events.map((event) => Number(event?.revision) || 0)), events };
    }
    return payload;
  }

  function rawEventType(event) {
    return String(event?.type || event?.kind || event?.event || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  }

  function scheduleSnapshotResync(id = model.id) {
    if (!id || controlResyncQueued) return;
    const generation = lifecycleGeneration;
    controlResyncQueued = true;
    queueMicrotask(() => {
      controlResyncQueued = false;
      if (generation !== lifecycleGeneration || model.id !== id) return;
      void loadSnapshot(id).catch(() => {
        if (generation === lifecycleGeneration && model.id === id) {
          setText(root, "#scrambleConnection", "RECONNECTING");
        }
      });
    });
  }

  function scheduleSagaChapterChange(previousId, previousSaga) {
    const saga = record(model.saga);
    const previous = record(previousSaga);
    const previousNumber = formatNumber(previous.chapterNumber);
    const chapterNumber = formatNumber(saga.chapterNumber);
    const key = `${model.id}:${chapterNumber}:${formatNumber(saga.chapterVersion ?? saga.revision)}`;
    if (
      authoritativeFormat() !== "riddle-saga"
      || !model.id
      || previousId !== model.id
      || !previousNumber
      || chapterNumber <= previousNumber
      || hostedSagaChapterKey === key
    ) {
      if (model.id && chapterNumber) hostedSagaChapterKey ||= key;
      return;
    }
    hostedSagaChapterKey = key;
    if (sagaChangeQueued) return;
    sagaChangeQueued = true;
    const snapshot = model;
    const metadata = Object.freeze({
      matchId: model.id,
      previousChapterNumber: previousNumber,
      chapterNumber,
      chapterVersion: formatNumber(saga.chapterVersion ?? saga.revision),
      chapterStartsAt: String(saga.chapterStartsAt || ""),
      chapterDeadlineAt: String(saga.chapterDeadlineAt || "")
    });
    queueMicrotask(() => {
      sagaChangeQueued = false;
      if (model.id !== metadata.matchId || model.saga?.chapterNumber !== metadata.chapterNumber) return;
      try {
        options.onChapterChange?.(snapshot, metadata);
      } catch {
        setText(root, "#scrambleConnection", "SYNCING CHAPTER");
        scheduleSnapshotResync(metadata.matchId);
      }
    });
  }

  async function switchToRematch(nextDuelId) {
    const nextId = String(nextDuelId || "").trim().slice(0, 96);
    if (!nextId || nextId === model.id) {
      if (nextId) scheduleSnapshotResync(nextId);
      return false;
    }
    const generation = ++lifecycleGeneration;
    stopNetwork();
    awaitingRematch = false;
    active = false;
    finishing = false;
    hostMatchId = "";
    lastAnnouncedSequence = 0;
    hostedSagaChapterKey = "";
    lastSagaMomentKey = "";
    sagaBoundaryResyncKey = "";
    actionQueue = Promise.resolve();
    model = createScrambleState({ id: nextId, status: "waiting" });
    rememberMatch();
    try {
      const payload = await request(`/${encodeURIComponent(nextId)}`);
      if (generation !== lifecycleGeneration || model.id !== nextId) return false;
      acceptPayload(payload);
      byId("scrambleResultDialog")?.close();
      showLobby();
      lobbyMessage("Rematch accepted. Ready up when your rival is ready.");
      startEventStream();
      startHeartbeat();
      return true;
    } catch (error) {
      if (generation !== lifecycleGeneration) return false;
      setText(root, "#scrambleResultStatus", error.message || "The rematch lobby could not be loaded.");
      return false;
    }
  }

  function acceptPayload(payload) {
    const rawEvents = payloadEvents(payload);
    const controlTypes = new Set(rawEvents.map(rawEventType).filter(Boolean));
    const nextDuelId = [...rawEvents].reverse()
      .find((event) => rawEventType(event) === "rematch_ready" && event?.nextDuelId)?.nextDuelId;
    const incomingId = matchIdFromPayload(payload);
    if (incomingId && model.id && incomingId !== model.id) {
      lifecycleGeneration += 1;
      model = createScrambleState();
      hostedSagaChapterKey = "";
      lastSagaMomentKey = "";
      sagaBoundaryResyncKey = "";
    }
    const previousStatus = model.status;
    const previousId = model.id;
    const previousSaga = model.saga;
    model = reduceScrambleSnapshot(model, normalizePayload(payload));
    if (!model.id) model.id = matchIdFromPayload(payload) || previousId;
    rememberMatch();
    render();
    scheduleSagaChapterChange(previousId, previousSaga);
    if (["countdown", "active"].includes(model.status)) beginHostMatch();
    if (model.status === "finished" && previousStatus !== "finished") finishHostMatch();
    if (nextDuelId || controlTypes.has("rematch_ready")) {
      void switchToRematch(nextDuelId || model.nextDuelId || model.rematch?.nextDuelId);
    } else if ([...controlTypes].some((type) => CONTROL_RESYNC_TYPES.has(type))) {
      scheduleSnapshotResync(model.id);
    }
    return model;
  }

  async function loadSnapshot(id = model.id) {
    if (!id) return null;
    const generation = lifecycleGeneration;
    const payload = await request(`/${encodeURIComponent(id)}`);
    if (generation !== lifecycleGeneration || model.id !== id) return null;
    acceptPayload(payload);
    return payload;
  }

  function beginHostMatch() {
    if (!model.id || hostMatchId === model.id && active) return;
    active = true;
    finishing = false;
    hostMatchId = model.id;
    hostedSagaChapterKey = authoritativeFormat() === "riddle-saga" && model.saga?.chapterNumber
      ? `${model.id}:${model.saga.chapterNumber}:${formatNumber(model.saga.chapterVersion ?? model.saga.revision)}`
      : "";
    ensureSurface();
    byId("scrambleDialog")?.close();
    byId("scrambleResultDialog")?.close();
    byId("scrambleScorebar").hidden = false;
    byId("scrambleRivalBoard").hidden = false;
    documentRef.body.classList.add("scramble-active");
    setFormatData(authoritativeFormat());
    setBoardView("self");
    options.onBeginMatch?.(model);
    startClock();
    startEventStream();
    startHeartbeat();
    options.playFeedback?.("runStart");
    options.track?.("scramble_match_started", {
      ranked: model.ranked,
      target: model.target,
      format: authoritativeFormat()
    });
  }

  function finishHostMatch() {
    if (finishing) return;
    finishing = true;
    active = false;
    stopNetwork();
    clearRememberedMatch();
    documentRef.body.classList.remove("scramble-counting-down");
    const finishGeneration = lifecycleGeneration;
    const finishMatchId = model.id;
    const presentation = scrambleResultPresentation(model);
    // Arena does not mount the solo Golden Pair overlay, so it must not reserve
    // an invisible cinematic hold even when the winning recipe is authored.
    const authoredGoldenPair = false;
    const holdMs = victoryHandoffHoldMs({
      won: presentation.won,
      revealed: false,
      authoredGoldenPair,
      reducedMotion: false
    });
    renderResult();
    options.track?.("scramble_match_finished", {
      ranked: model.ranked,
      result: presentation.won ? "win" : model.winnerId ? "loss" : "draw",
      authoredGoldenPair,
      format: authoritativeFormat()
    });
    void refreshRating({ allowDuringFinishedMatch: true });
    void (async () => {
      if (holdMs > 0) await wait(holdMs);
      if (
        !finishing
        || lifecycleGeneration !== finishGeneration
        || model.id !== finishMatchId
        || model.status !== "finished"
      ) return;
      options.onFinished?.(model);
      const dialog = byId("scrambleResultDialog");
      if (!dialog?.open) dialog?.showModal();
      requestAnimationFrame(() => byId("scrambleResultTitle")?.focus({ preventScroll: true }));
      options.playFeedback?.(presentation.won ? "target" : "failure");
    })();
  }

  function startClock() {
    clearInterval(clockTimer);
    renderClock();
    clockTimer = setInterval(renderClock, 250);
  }

  function startHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (!model.id || ["finished", "cancelled"].includes(model.status) || documentRef.hidden) return;
      void request(`/${encodeURIComponent(model.id)}/heartbeat`, {
        method: "POST",
        body: {
          lastEventSequence: model.lastSequence
        }
      }).then(acceptPayload).catch(() => {});
    }, HEARTBEAT_MS);
  }

  async function consumeSse(response, generation, signal) {
    if (!response?.body?.getReader) {
      const payload = typeof response?.json === "function" ? await response.json() : response;
      acceptPayload(payload);
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (generation === streamGeneration && !signal.aborted) {
      const { value, done } = await reader.read();
      if (generation !== streamGeneration || signal.aborted) break;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() || "";
      for (const chunk of chunks) {
        const data = chunk.split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!data || data === "[DONE]") continue;
        try { acceptPayload(JSON.parse(data)); } catch { /* Ignore malformed keepalive frames. */ }
      }
    }
  }

  async function runEventStream(generation, signal) {
    while (generation === streamGeneration && !signal.aborted && model.id
      && (!["finished", "cancelled"].includes(model.status) || awaitingRematch)) {
      try {
        const response = await request(`/${encodeURIComponent(model.id)}/events?after=${model.lastSequence}`, {
          signal,
          stream: true
        });
        setText(root, "#scrambleConnection", "LIVE");
        reconnectDelay = RECONNECT_MIN_MS;
        await consumeSse(response, generation, signal);
        if (!signal.aborted && generation === streamGeneration) await wait(250, signal);
      } catch (error) {
        if (signal.aborted || generation !== streamGeneration || isAbortError(error)) return;
        setText(root, "#scrambleConnection", "RECONNECTING");
        options.onConnectionChange?.("reconnecting");
        try {
          await wait(reconnectDelay, signal);
          reconnectDelay = Math.min(RECONNECT_MAX_MS, reconnectDelay * 1.65);
          await loadSnapshot();
        } catch (snapshotError) {
          if (isAbortError(snapshotError)) return;
        }
      }
    }
  }

  function startEventStream() {
    streamController?.abort();
    streamController = new AbortController();
    const generation = ++streamGeneration;
    void runEventStream(generation, streamController.signal);
  }

  function stopNetwork() {
    clearTimeout(queueTimer);
    queueTimer = null;
    clearInterval(clockTimer);
    clockTimer = null;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    streamGeneration += 1;
    streamController?.abort();
    streamController = null;
  }

  async function createInvite() {
    const button = byId("scrambleCreateInvite");
    const format = selectedFormat;
    setBusy(button, true, "Creating\u2026");
    lobbyMessage("");
    try {
      const payload = await request("/invites", {
        method: "POST",
        body: {
          actionId: actionId("invite"),
          format,
          frameSlug: localFrameSlug()
        }
      });
      inviteCode = sanitizeScrambleToken(payload?.inviteCode);
      model = createScrambleState();
      acceptPayload(payload);
      if (!model.id) throw new Error("The invitation did not include a match.");
      const link = buildScrambleInviteUrl(inviteCode, windowRef.location);
      byId("scrambleInviteLink").value = link;
      renderLobby();
      lobbyMessage("Invitation ready. Your rival can join once.");
      startEventStream();
      startHeartbeat();
    } catch (error) {
      lobbyMessage(error.message || "The invitation could not be created.", true);
    } finally {
      setBusy(button, false);
    }
  }

  async function joinInvite(value) {
    const code = sanitizeScrambleToken(value) || parseScrambleInvite(String(value || ""))?.token || "";
    if (!code) {
      lobbyMessage("Enter a valid invitation code or link.", true);
      return false;
    }
    const button = byId("scrambleJoinForm")?.querySelector("button");
    setBusy(button, true, "Joining\u2026");
    lobbyMessage("");
    try {
      const payload = await request("/join", {
        method: "POST",
        body: {
          inviteCode: code,
          actionId: actionId("join"),
          frameSlug: localFrameSlug()
        }
      });
      inviteCode = "";
      model = createScrambleState();
      acceptPayload(payload);
      if (!model.id) throw new Error("The match could not be joined.");
      renderLobby();
      lobbyMessage("You joined the lobby. Ready up when your rival arrives.");
      startEventStream();
      startHeartbeat();
      const cleanUrl = clearScrambleInviteFromUrl(windowRef.location);
      if (cleanUrl) windowRef.history?.replaceState?.(windowRef.history.state, "", cleanUrl);
      return true;
    } catch (error) {
      lobbyMessage(error.message || "The invitation could not be joined.", true);
      return false;
    } finally {
      setBusy(button, false);
    }
  }

  async function pollMatchmaking() {
    if (!queueActive) return;
    try {
      const payload = await request("/matchmaking");
      if (payload?.duel) {
        queueActive = false;
        acceptPayload(payload);
        lobbyMessage("Rival found. Ready up.");
        startEventStream();
        startHeartbeat();
        return;
      }
      if (typeof payload?.queue?.format === "string") {
        selectedFormat = scrambleFormat(payload.queue.format);
        syncFormatPresentation();
      }
      const position = Math.max(0, Math.floor(Number(payload?.queue?.position) || 0));
      lobbyMessage(position ? `Searching\u2026 queue position ${position}.` : "Searching for a compatible rival\u2026");
    } catch {
      lobbyMessage("Matchmaking is reconnecting\u2026");
    }
    queueTimer = setTimeout(pollMatchmaking, QUEUE_POLL_MS);
  }

  async function joinMatchmaking() {
    if (!rankedUnlocked) {
      lobbyMessage("Complete one scored solo constellation to unlock public ranked matches.", true);
      return;
    }
    const button = byId("scrambleFindRival");
    const format = selectedFormat;
    const picker = byId("scrambleFormatPicker");
    if (picker) picker.disabled = true;
    setBusy(button, true, "Searching\u2026");
    lobbyMessage("");
    try {
      const payload = await request("/matchmaking/join", {
        method: "POST",
        body: {
          actionId: actionId("queue"),
          format,
          frameSlug: localFrameSlug(),
          soloWins: Math.max(0, Math.min(100_000, Math.floor(Number(options.soloWins?.()) || 0)))
        }
      });
      if (payload?.duel) {
        queueActive = false;
        model = createScrambleState();
        acceptPayload(payload);
        startEventStream();
        startHeartbeat();
      } else {
        selectedFormat = format;
        queueActive = true;
        model = createScrambleState({ ranked: true, status: "queue", format });
        renderLobby();
        lobbyMessage("Searching for a compatible rival\u2026");
        queueTimer = setTimeout(pollMatchmaking, QUEUE_POLL_MS);
      }
    } catch (error) {
      lobbyMessage(error.message || "Matchmaking is unavailable.", true);
    } finally {
      setBusy(button, false);
      if (!queueActive && !model.id) syncFormatPresentation();
    }
  }

  async function cancelMatchmaking() {
    clearTimeout(queueTimer);
    queueTimer = null;
    try { await request("/matchmaking", { method: "DELETE" }); } catch { /* Queue expiry is also authoritative. */ }
    queueActive = false;
    model = createScrambleState();
    renderLobby();
    lobbyMessage("Matchmaking cancelled.");
  }

  async function cancelWaiting() {
    if (queueActive) return cancelMatchmaking();
    const leavingId = model.id;
    if (model.id) {
      const confirmed = windowRef.confirm?.("Leave this lobby? Your invitation will stop waiting.");
      if (confirmed === false) return;
    }
    lifecycleGeneration += 1;
    stopNetwork();
    if (leavingId) {
      try {
        await request(`/${encodeURIComponent(leavingId)}/forfeit`, {
          method: "POST",
          body: { actionId: actionId("leave") }
        });
      } catch { /* A waiting lobby also expires server-side. */ }
    }
    deactivate();
    byId("scrambleResultDialog")?.close();
    renderLobby();
    lobbyMessage("");
  }

  async function copyInvite() {
    const link = byId("scrambleInviteLink")?.value;
    if (!link) return;
    try {
      await windowRef.navigator?.clipboard?.writeText(link);
      setText(root, "#scrambleCopyInvite", "Copied");
      setTimeout(() => setText(root, "#scrambleCopyInvite", "Copy link"), 1_400);
    } catch {
      byId("scrambleInviteLink")?.select();
      lobbyMessage("Copy the selected invitation link.");
    }
  }

  async function toggleReady() {
    const self = currentSelf();
    if (!model.id || !self) return;
    const button = byId("scrambleReady");
    setBusy(button, true, self.ready ? "Updating\u2026" : "Ready\u2026");
    try {
      const payload = await request(`/${encodeURIComponent(model.id)}/ready`, {
        method: "POST",
        body: { ready: !self.ready, actionId: actionId("ready") }
      });
      acceptPayload(payload);
    } catch (error) {
      lobbyMessage(error.message || "Ready state could not be updated.", true);
    } finally {
      setBusy(button, false);
    }
  }

  async function forfeit() {
    const button = byId("scrambleConfirmForfeit");
    setBusy(button, true, "Forfeiting\u2026");
    try {
      const payload = await request(`/${encodeURIComponent(model.id)}/forfeit`, {
        method: "POST",
        body: { actionId: actionId("forfeit") }
      });
      byId("scrambleForfeitDialog")?.close();
      acceptPayload(payload);
      if (model.status !== "finished") {
        model = reduceScrambleSnapshot(model, {
          revision: model.revision + 1,
          status: "finished",
          finishReason: "You forfeited the match.",
          winnerId: currentRival()?.id
        });
        finishHostMatch();
      }
    } catch (error) {
      setText(root, "#scrambleForfeitText", error.message || "The forfeit could not be confirmed. Try again.");
    } finally {
      setBusy(button, false);
    }
  }

  async function requestRematch() {
    const button = byId("scrambleRematch");
    setBusy(button, true, "Requested\u2026");
    setText(root, "#scrambleResultStatus", "Waiting for your rival to accept.");
    try {
      awaitingRematch = true;
      const payload = await request(`/${encodeURIComponent(model.id)}/rematch`, {
        method: "POST",
        body: { actionId: actionId("rematch") }
      });
      acceptPayload(payload);
      setText(root, "#scrambleResultStatus", payload?.duel?.status === "waiting"
        ? "Rematch accepted. Ready up in the lobby."
        : "Rematch requested. Waiting for your rival.");
      if (model.status === "waiting" || model.status === "countdown") {
        awaitingRematch = false;
        byId("scrambleResultDialog")?.close();
        hostMatchId = "";
        finishing = false;
        active = false;
        showLobby();
        startEventStream();
        startHeartbeat();
      } else if (model.status === "finished") {
        startEventStream();
      }
    } catch (error) {
      awaitingRematch = false;
      setText(root, "#scrambleResultStatus", error.message || "The rematch request failed.");
    } finally {
      setBusy(button, false);
    }
  }

  async function shareResult() {
    const cleanUrl = clearScrambleInviteFromUrl(windowRef.location) || windowRef.location?.href || "";
    const text = scrambleShareText(model, cleanUrl);
    try {
      if (windowRef.navigator?.share) {
        await windowRef.navigator.share({ title: "Scramble Arena", text, url: cleanUrl });
      } else {
        await windowRef.navigator?.clipboard?.writeText(text);
        setText(root, "#scrambleResultStatus", "Result copied.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") setText(root, "#scrambleResultStatus", "Sharing is unavailable on this device.");
    }
  }

  function returnHome() {
    byId("scrambleResultDialog")?.close();
    deactivate();
    options.onHome?.();
  }

  function deactivate() {
    lifecycleGeneration += 1;
    stopNetwork();
    active = false;
    finishing = false;
    hostMatchId = "";
    awaitingRematch = false;
    queueActive = false;
    hostedSagaChapterKey = "";
    sagaChangeQueued = false;
    lastSagaMomentKey = "";
    sagaBoundaryResyncKey = "";
    model = createScrambleState();
    inviteCode = "";
    clearRememberedMatch();
    documentRef.body.classList.remove("scramble-active", "scramble-counting-down", "scramble-saga-intermission");
    byId("scrambleScorebar").hidden = true;
    byId("scrambleRivalBoard").hidden = true;
    byId("scrambleCountdown").hidden = true;
    byId("scrambleSagaMoment").hidden = true;
    setBoardView("self");
    clearFormatData();
  }

  async function open({ opener = documentRef.activeElement, invite = "", ranked = false, format = "" } = {}) {
    ensureSurface();
    trigger = opener;
    rankedUnlocked = ranked === true;
    if (format) selectedFormat = scrambleFormat(format, { enabledOnly: true });
    showLobby();
    renderAvailability();
    void refreshRating();
    const directInvite = sanitizeScrambleToken(invite);
    if (directInvite) {
      byId("scrambleInviteCode").value = directInvite;
      await joinInvite(directInvite);
    }
    return true;
  }

  async function resume() {
    const id = rememberedMatchId();
    if (!id || options.available === false || typeof request !== "function") return false;
    ensureSurface();
    try {
      model = createScrambleState({ id });
      await loadSnapshot(id);
      if (["finished", "cancelled"].includes(model.status)) {
        clearRememberedMatch();
        return false;
      }
      if (["countdown", "active"].includes(model.status)) beginHostMatch();
      else {
        showLobby();
        startEventStream();
        startHeartbeat();
      }
      return true;
    } catch {
      clearRememberedMatch();
      return false;
    }
  }

  async function submitActionNow({ a, b } = {}) {
    if (!active || !model.id || !["active", "countdown"].includes(model.status)) {
      const error = new Error("The scramble is not accepting pairings yet.");
      error.code = "scramble_not_active";
      throw error;
    }
    const saga = authoritativeFormat() === "riddle-saga" ? record(model.saga) : null;
    if (saga && saga.status !== "playing") {
      const error = new Error(saga.status === "intermission"
        ? "The next riddle is not open yet."
        : "This riddle is no longer accepting pairings.");
      error.code = "scramble_chapter_locked";
      throw error;
    }
    const startsAt = Date.parse(saga?.chapterStartsAt || model.startsAt || "");
    if (Number.isFinite(startsAt) && startsAt > Date.now()) {
      const error = new Error(saga ? "Wait for this riddle to begin." : "Wait for the countdown.");
      error.code = saga ? "scramble_chapter_countdown" : "scramble_countdown";
      throw error;
    }
    const chapterDeadline = Date.parse(saga?.chapterDeadlineAt || "");
    if (saga && Number.isFinite(chapterDeadline) && chapterDeadline <= Date.now()) {
      const error = new Error("This riddle has closed. The story is updating.");
      error.code = "scramble_chapter_closed";
      throw error;
    }
    assertForgeActionAvailable();
    const generation = lifecycleGeneration;
    const matchId = model.id;
    const chapterNumber = saga ? formatNumber(saga.chapterNumber) : 0;
    let payload;
    try {
      payload = await request(`/${encodeURIComponent(matchId)}/actions`, {
        method: "POST",
        body: {
          actionId: actionId("pair"),
          expectedRevision: model.revision,
          a: String(a || "").slice(0, 48),
          b: String(b || "").slice(0, 48)
        }
      });
    } catch (error) {
      if (error?.payload?.event || error?.payload?.duel || error?.payload?.events) acceptPayload(error.payload);
      throw error;
    }
    if (
      generation !== lifecycleGeneration
      || model.id !== matchId
      || chapterNumber && formatNumber(model.saga?.chapterNumber) !== chapterNumber
    ) {
      throw new DOMException("The previous match action is stale.", "AbortError");
    }
    acceptPayload(payload);
    const event = [...payloadEvents(payload)].reverse()
      .map((candidate) => sanitizeScrambleEvent(candidate))
      .find((candidate) => ["success", "failure"].includes(candidate?.type))
      || sanitizeScrambleEvent(payload?.event);
    if (event?.type === "failure") {
      const error = new Error(event.reason || "Those words do not combine.");
      error.code = "combination_missing";
      error.payload = payload;
      throw error;
    }
    const result = payload?.result || payload?.combination || event?.result || payload?.duelAction?.result;
    if (!result?.word) {
      const error = new Error("The pairing result was incomplete.");
      error.code = "scramble_result_missing";
      error.payload = payload;
      throw error;
    }
    return { result, payload, event };
  }

  function submitAction(input) {
    assertForgeActionAvailable();
    const pending = actionQueue.catch(() => {}).then(() => submitActionNow(input));
    actionQueue = pending;
    return pending;
  }

  function assertForgeActionAvailable() {
    if (authoritativeFormat() !== "forge-clash") return;
    const formatState = playerFormatState(currentSelf());
    const authoritativeTurnsLeft = Number(formatState.turnsLeft);
    const hasAuthoritativeTurnState = Number(formatState.turnLimit) > 0
      || formatState.locked === true
      || formatState.complete === true;
    if (!hasAuthoritativeTurnState || !Number.isFinite(authoritativeTurnsLeft) || authoritativeTurnsLeft > 0) return;
    const error = new Error(formatState.champion?.word
      ? "Your forge is locked. Watch the champions resolve the clash."
      : "Your forge turns are complete. No more pairings can be submitted.");
    error.code = "scramble_forge_locked";
    throw error;
  }

  function requestForfeitConfirmation() {
    if (!active || !model.id) return false;
    ensureSurface();
    setText(root, "#scrambleForfeitText", "The match cannot pause. Leaving now gives the win to your rival.");
    const dialog = byId("scrambleForfeitDialog");
    if (!dialog?.open) dialog?.showModal();
    requestAnimationFrame(() => byId("scrambleKeepPlaying")?.focus({ preventScroll: true }));
    return true;
  }

  function handleVisibilityChange() {
    if (!model.id) return;
    if (!documentRef.hidden) {
      void loadSnapshot().then(() => {
        if (active && !streamController) startEventStream();
      }).catch(() => {});
    }
  }

  function handlePageHide() {
    streamController?.abort();
    streamController = null;
  }

  documentRef?.addEventListener?.("visibilitychange", handleVisibilityChange);
  windowRef?.addEventListener?.("pageshow", handleVisibilityChange);
  windowRef?.addEventListener?.("pagehide", handlePageHide);

  return Object.freeze({
    open,
    resume,
    submitAction,
    acceptPayload,
    requestForfeitConfirmation,
    isActive: () => active && Boolean(model.id),
    isCountingDown: () => {
      const sagaStartsAt = authoritativeFormat() === "riddle-saga" ? model.saga?.chapterStartsAt : "";
      const startsAt = Date.parse(sagaStartsAt || model.startsAt || "");
      return model.status === "countdown"
        || model.saga?.status !== "intermission" && Number.isFinite(startsAt) && startsAt > Date.now();
    },
    current: () => model,
    deactivate,
    refresh: () => loadSnapshot(),
    setRankedUnlocked(value) {
      rankedUnlocked = value === true;
      renderAvailability();
    },
    destroy() {
      deactivate();
      compactLobbyMedia?.removeEventListener?.("change", syncLobbyQueuePresentation);
      compactLobbyMedia = null;
      documentRef?.removeEventListener?.("visibilitychange", handleVisibilityChange);
      windowRef?.removeEventListener?.("pageshow", handleVisibilityChange);
      windowRef?.removeEventListener?.("pagehide", handlePageHide);
      byId("scrambleScorebar")?.remove();
      byId("scrambleRivalBoard")?.remove();
      byId("scrambleCountdown")?.remove();
      root?.remove();
      root = null;
      clearFormatData();
    }
  });
}
