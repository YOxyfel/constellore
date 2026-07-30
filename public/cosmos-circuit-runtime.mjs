import {
  CIRCUIT_BOOSTS,
  CRAZY_PATH_DAILY_DAYS,
  CRAZY_PATH_DAILY_POWERS,
  CRAZY_PATH_ENTRY_PASSES,
  CRAZY_PATH_INSTANT_POWERS,
  CRAZY_PATH_REWARD_CHOICES,
  advanceCircuitRun,
  circuitPassEarningStatus,
  circuitRewardPreview,
  claimCircuitReward,
  cosmosCircuitCourse,
  cosmosCircuitCrazyCourse,
  cosmosCircuitRewardLadder,
  createCircuitSnapshot,
  crazyPathEligibility,
  crazyPathRewardOptions,
  finishCircuitRun,
  grantCrazyPathDailyPowers,
  grantDailyLaunchPasses,
  grantRankLaunchPass,
  recordEligiblePureWin,
  resumeCircuitRun,
  sanitizeCircuitClaims,
  sanitizeCrazyPathStipend,
  sanitizeCircuitWallet,
  startCircuitRun
} from "./cosmos-circuit.mjs?v=5.0.0-beta.1";
import {
  STAR_PATH_XP_RULES,
  claimAllStarPathRewards as claimAllStarPathRewardsDomain,
  claimStarPathReward,
  recordStarPathProgress,
  sanitizeStarPathState,
  starPathCatalog,
  starPathCircuitXpEvent,
  starPathProgress,
  starPathRewardById,
  starPathWordWinXpEvent
} from "./star-path.mjs?v=5.0.0-beta.1";
import {
  cosmosCircuitCopy,
  cosmosCircuitLocale,
  cosmosCircuitPassCopy,
  cosmosCircuitPolicyCopy
} from "./cosmos-circuit-copy.mjs?v=5.0.0-beta.1";
import { createCircuitLobbyTabs } from "./circuit-lobby-tabs.mjs?v=5.0.0-beta.1";
import {
  circuitDailyRotation,
  circuitWeeklyRewardById,
  circuitWeeklyChallenges,
  claimCircuitWeeklyReward,
  personalCircuitRecordBoard,
  recordCircuitWeeklyProgress,
  recordPersonalCircuitResult,
  sanitizeCircuitWeeklyState,
  sanitizePersonalCircuitBoard
} from "./circuit-live-ops.mjs?v=5.0.0-beta.1";

export const COSMOS_CIRCUIT_SAVE_KEY = "constellore-cosmos-circuit-v1";
const SAVE_KEY = COSMOS_CIRCUIT_SAVE_KEY;
const SAVE_LEASE_KEY = `${SAVE_KEY}:lease`;
const SAVE_CHANNEL_NAME = `${SAVE_KEY}:channel`;
const SAVE_LEASE_MS = 20_000;
const TELEMETRY_CHAIN_PATTERN = /^[0-9a-f]{64}$/;
const LABELS = Object.freeze({
  shield: "Shield",
  phase: "Phase",
  magnet: "Magnet",
  timeWarp: "Time Warp"
});
const BOOST_LIMIT = 9_999;
const MAX_LOCAL_SEASON_REWARDS = 2_048;
export const CIRCUIT_REMIX_THEMES = Object.freeze([
  "constellore.celestial-atlas.sound-theme.cosmic-chimes",
  "constellore.aurora-archive.sound-theme.glass-orbit",
  "constellore.solar-foundry.sound-theme.analog-stars",
  "constellore.lunar-garden.sound-theme.moon-bells",
  "constellore.eclipse-sovereign.sound-theme.eclipse-choir",
  "constellore.pixel-frontier.sound-theme.pixel-pulse",
  "constellore.bubble-reef.sound-theme.bubble-beat",
  "constellore.stellar-vanguard.sound-theme.void-overture"
]);

function identifier(prefix = "circuit") {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 80);
}

export function createCircuitStorage(scope = globalThis) {
  const memory = new Map();
  let persistent = null;
  try { persistent = scope?.localStorage || null; }
  catch { persistent = null; }
  const failPersistent = () => { persistent = null; };
  return {
    get persistent() { return Boolean(persistent); },
    storage: {
      getItem(key) {
        if (persistent) {
          try {
            const value = persistent.getItem(key);
            if (value != null) memory.set(String(key), String(value));
            return value;
          } catch { failPersistent(); }
        }
        return memory.has(String(key)) ? memory.get(String(key)) : null;
      },
      setItem(key, value) {
        const safeKey = String(key);
        const safeValue = String(value);
        memory.set(safeKey, safeValue);
        if (persistent) {
          try { persistent.setItem(safeKey, safeValue); }
          catch { failPersistent(); }
        }
      },
      removeItem(key) {
        const safeKey = String(key);
        memory.delete(safeKey);
        if (persistent) {
          try { persistent.removeItem(safeKey); }
          catch { failPersistent(); }
        }
      }
    }
  };
}

export function isRetryableCircuitError(error) {
  if (error?.retryable === false) return false;
  const status = Number(error?.status);
  return !Number.isFinite(status) || status === 408 || status === 425 || status === 429 || status >= 500;
}

function canonicalTelemetryEvent(event, sequence) {
  return JSON.stringify([
    sequence,
    String(event?.segmentId || ""),
    String(event?.outcome || ""),
    Number(event?.stardust) || 0,
    String(event?.ability || ""),
    String(event?.useAbility || ""),
    Number(event?.elapsedMs) || 0,
    (Array.isArray(event?.samples) ? event.samples : []).map((sample) => [
      Number(sample?.elapsedMs) || 0,
      Number(sample?.progressMs) || 0,
      Number(sample?.x) || 0,
      Number(sample?.y) || 0
    ])
  ]);
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await globalThis.crypto?.subtle?.digest?.("SHA-256", bytes);
  if (!digest) throw new Error("Verified telemetry is unavailable in this browser.");
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function chainCircuitTelemetry(events, seed) {
  if (!TELEMETRY_CHAIN_PATTERN.test(String(seed || ""))) {
    const error = new Error("The signed flight telemetry seed is missing.");
    error.retryable = false;
    throw error;
  }
  let previous = String(seed);
  const chained = [];
  for (const [sequence, event] of (Array.isArray(events) ? events : []).entries()) {
    const chain = await sha256Hex(`${previous}\0${canonicalTelemetryEvent(event, sequence)}`);
    chained.push({ ...event, sequence, chain });
    previous = chain;
  }
  return chained;
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function emptyBoosts(raw) {
  return Object.fromEntries(CIRCUIT_BOOSTS.map((boost) => [
    boost,
    Math.min(BOOST_LIMIT, Math.max(0, Math.floor(Number(raw?.[boost]) || 0)))
  ]));
}

function addBoosts(left, right) {
  return Object.fromEntries(CIRCUIT_BOOSTS.map((boost) => [
    boost,
    Math.min(BOOST_LIMIT, (Number(left?.[boost]) || 0) + (Number(right?.[boost]) || 0))
  ]));
}

function sanitizeRewardIds(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(String)
    .filter((id) => id.length <= 180 && Boolean(starPathRewardById(id) || circuitWeeklyRewardById(id)))
    .slice(-MAX_LOCAL_SEASON_REWARDS))];
}

function sanitizeFeaturedRewardId(value) {
  const id = String(value || "").slice(0, 180);
  return starPathRewardById(id) || circuitWeeklyRewardById(id) ? id : "";
}

function readLocalState(storage, now) {
  let source = {};
  try { source = JSON.parse(storage?.getItem(SAVE_KEY) || "{}"); }
  catch { /* A damaged local save falls back to a bounded fresh state. */ }
  const daily = grantDailyLaunchPasses(sanitizeCircuitWallet(source.wallet), now);
  const crazyDaily = grantCrazyPathDailyPowers(source.crazyStipend, now);
  const starRewards = sanitizeRewardIds(source.starRewards);
  const featuredRewardId = sanitizeFeaturedRewardId(source.featuredRewardId);
  const activeSource = source.active && typeof source.active === "object" ? source.active : null;
  const resumed = activeSource?.snapshot ? resumeCircuitRun(activeSource.snapshot) : null;
  const recoveredRun = resumed?.resumed
    ? resumed.run
    : resumed?.run?.status === "finished"
      && (activeSource?.server === true || resumed.run.result?.rewardEligible === true)
      ? resumed.run
      : null;
  return {
    revision: Math.max(0, Math.floor(Number(source.revision) || 0)),
    writer: String(source.writer || "").slice(0, 80),
    wallet: daily.wallet,
    claims: sanitizeCircuitClaims(source.claims),
    boosts: addBoosts(emptyBoosts(source.boosts), crazyDaily.boosts),
    crazyStipend: crazyDaily.stipend,
    starPath: sanitizeStarPathState(source.starPath, now),
    starRewards,
    featuredRewardId,
    onboarding: {
      circuitSeen: source.onboarding?.circuitSeen === true,
      starPathSeen: source.onboarding?.starPathSeen === true
    },
    weekly: sanitizeCircuitWeeklyState(source.weekly, now),
    records: sanitizePersonalCircuitBoard(source.records),
    dailyGrant: { granted: daily.granted, reason: daily.reason },
    crazyDailyGrant: {
      grantedDays: crazyDaily.grantedDays,
      each: crazyDaily.each,
      reason: crazyDaily.reason
    },
    active: recoveredRun ? {
      run: recoveredRun,
      attemptToken: String(activeSource.attemptToken || "").slice(0, 160),
      telemetrySeed: TELEMETRY_CHAIN_PATTERN.test(String(activeSource.telemetrySeed || ""))
        ? String(activeSource.telemetrySeed)
        : "",
      startKey: String(activeSource.startKey || "").slice(0, 80),
      submitKey: String(activeSource.submitKey || "").slice(0, 80),
      abandonKey: String(activeSource.abandonKey || "").slice(0, 80),
      chosenRewardBoost: CIRCUIT_BOOSTS.includes(activeSource.chosenRewardBoost)
        ? activeSource.chosenRewardBoost
        : "",
      chosenCrazyReward: CRAZY_PATH_REWARD_CHOICES.includes(activeSource.chosenCrazyReward)
        ? activeSource.chosenCrazyReward
        : "",
      submissionRejected: activeSource.submissionRejected === true,
      server: Boolean(activeSource.server)
    } : null
  };
}

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function segmentStart(course, index) {
  return course.segments.slice(0, index).reduce((sum, segment) => sum + segment.durationMs, 0);
}

function checkpointFor(course, segment, start) {
  const end = start + segment.durationMs;
  const expected = segment.kind === "planet-gate" ? "gate"
    : segment.kind === "black-hole" ? "blackHole"
      : segment.kind === "ability-gate" ? "beacon" : "";
  const checkpoint = course.checkpoints.find((candidate) =>
    candidate.type === expected && candidate.at >= start && candidate.at < end
  );
  if (checkpoint) return checkpoint;
  const angle = ((course.seed + segment.index * 7919) % 628) / 100;
  return {
    id: `field-${segment.index}`,
    type: "asteroid",
    at: start + Math.floor(segment.durationMs / 2),
    x: clamp(0.5 + Math.sin(angle) * 0.28, 0.18, 0.82),
    y: clamp(0.5 + Math.cos(angle * 1.7) * 0.28, 0.18, 0.82),
    radius: 0.12
  };
}

export function createCosmosCircuitRuntime({
  online = false,
  request = null,
  supporter = () => false,
  audio = null,
  soundTheme = () => "constellore.celestial-atlas.sound-theme.cosmic-chimes",
  track = () => {},
  toast = () => {},
  locale = () => globalThis.document?.documentElement?.lang || "en"
} = {}) {
  const byId = (id) => document.getElementById(id);
  const copy = (key, values = {}) => cosmosCircuitCopy(key, values, cosmosCircuitLocale(locale()));
  const abort = new AbortController();
  const listen = (target, type, callback, options = {}) =>
    target?.addEventListener(type, callback, { ...options, signal: abort.signal });
  const storageBackend = createCircuitStorage(globalThis);
  const storage = storageBackend.storage;
  const instanceId = identifier("circuit-tab");
  let local = readLocalState(storage, new Date());
  let localSaveBaseline = structuredClone(local);
  let storageAvailable = storageBackend.persistent;
  let flightLeaseHeld = false;
  let lastLeaseRenewalAt = 0;
  let storageChannel = null;
  let remoteCircuit = null;
  let remoteStarPath = null;
  let connected = !online;
  let course = cosmosCircuitCourse();
  let selectedBoost = "";
  let active = local.active;
  let run = active?.run || null;
  if (run) course = run.path === "crazy"
    ? cosmosCircuitCrazyCourse(run.courseDayKey)
    : cosmosCircuitCourse(run.courseDayKey);
  let previousMode = run?.mode || "practice";
  let previousPath = run?.path || "standard";
  let crazyRewardSelection = "";
  let frame = 0;
  let flightGeneration = 0;
  let playing = false;
  let submitting = false;
  let claimingStarPath = false;
  let paused = false;
  let choosing = false;
  let lastFrameAt = 0;
  let segmentProgressMs = 0;
  let segmentWallMs = 0;
  let ship = { x: 0.5, y: 0.5 };
  let pointer = null;
  let queuedUse = "";
  let pendingEvent = null;
  let checkedDust = new Set();
  let collectedDust = new Set();
  let segmentSamples = [];
  let lastSampleProgressMs = -1;
  let lastPausedDrawAt = 0;
  let lastAudioIntensity = -1;
  let lastReducedMotionDrawAt = 0;
  let lastNavigationAnnouncement = "";
  let lastNavigationAnnouncedAt = 0;
  let pendingNavigationAnnouncement = "";
  let pendingNavigationSince = 0;
  let extractionPreview = null;
  let extractionCursor = -1;
  let extractionRunId = "";
  let rotationTimer = 0;
  let observedUtcDay = new Date().toISOString().slice(0, 10);
  let serverClockOffsetMs = 0;
  let rolloverRefreshPending = false;
  let lastDailyGrantAnnouncementDay = "";
  let passAnnouncement = "";
  let starPathAnnouncement = "";
  let featuredCacheSignature = "";
  let featuredCacheReward = null;
  let paletteCacheId = "";
  let paletteCache = null;
  const rewardMetadataCache = new Map();
  const keys = new Set();

  const dialog = byId("cosmosCircuitDialog");
  const pathDialog = byId("starPathDialog");
  const lobbyTabs = createCircuitLobbyTabs({
    root: byId("circuitLobby"),
    initial: "fly"
  });
  const canvas = byId("cosmosCircuitCanvas");
  const context = canvas?.getContext("2d", { alpha: false });
  const reducedMotionQuery = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (canvas) {
    canvas.tabIndex = 0;
    canvas.removeAttribute("aria-hidden");
    canvas.setAttribute("role", "application");
    canvas.setAttribute(
      "aria-label",
      "Cosmos Circuit flight controller. Steer with arrow keys or W A S D. Press Space to activate a power."
    );
    canvas.setAttribute("aria-describedby", "circuitFlightInstruction circuitTargetCue circuitNavigationStatus");
  }

  function leaseRecord() {
    try {
      const parsed = JSON.parse(storage.getItem(SAVE_LEASE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      const owner = String(parsed.owner || "");
      const expiresAt = Number(parsed.expiresAt) || 0;
      return owner && expiresAt > Date.now() ? { owner, expiresAt } : null;
    } catch {
      return null;
    }
  }

  function acquireStorageLease({ hold = false } = {}) {
    const existing = leaseRecord();
    if (existing && existing.owner !== instanceId) return false;
    try {
      storage.setItem(SAVE_LEASE_KEY, JSON.stringify({
        owner: instanceId,
        expiresAt: Date.now() + SAVE_LEASE_MS
      }));
      const acquired = leaseRecord()?.owner === instanceId;
      if (acquired && hold) {
        flightLeaseHeld = true;
        lastLeaseRenewalAt = Date.now();
      }
      return acquired;
    } catch {
      return false;
    }
  }

  function releaseStorageLease() {
    if (leaseRecord()?.owner === instanceId) storage.removeItem(SAVE_LEASE_KEY);
    flightLeaseHeld = false;
    lastLeaseRenewalAt = 0;
  }

  function acquireFlightLease() {
    if (flightLeaseHeld && acquireStorageLease({ hold: true })) return true;
    if (acquireStorageLease({ hold: true })) return true;
    toast("This Circuit save is active in another tab. Finish or leave that flight first.");
    return false;
  }

  function localizeSurface() {
    document.querySelectorAll("[data-circuit-copy]").forEach((element) => {
      element.textContent = copy(element.dataset.circuitCopy);
    });
    const circuitReplay = byId("showCircuitGuide");
    const pathReplay = byId("showStarPathGuide");
    if (circuitReplay) circuitReplay.textContent = copy("circuit.guide.replay");
    if (pathReplay) pathReplay.textContent = copy("path.guide.replay");
  }

  function setGuide(kind, visible, { remember = false, focus = false } = {}) {
    const circuitGuide = kind === "circuit";
    const guide = byId(circuitGuide ? "circuitGuide" : "starPathGuide");
    if (!guide) return;
    guide.hidden = !visible;
    if (remember) {
      local.onboarding ||= { circuitSeen: false, starPathSeen: false };
      if (circuitGuide) local.onboarding.circuitSeen = true;
      else local.onboarding.starPathSeen = true;
      save();
    }
    if (visible && focus) requestAnimationFrame(() => guide.focus());
  }

  function showFirstGuide(kind) {
    const circuitGuide = kind === "circuit";
    const seen = circuitGuide
      ? local.onboarding?.circuitSeen
      : local.onboarding?.starPathSeen;
    setGuide(kind, !seen, { focus: !seen });
    if (!seen) track(circuitGuide ? "cosmos_circuit_tutorial_viewed" : "star_path_tutorial_viewed");
  }

  function changedLocalKeys(current, baseline) {
    const ignored = new Set(["revision", "writer", "dailyGrant", "crazyDailyGrant"]);
    return [...new Set([...Object.keys(current || {}), ...Object.keys(baseline || {})])]
      .filter((key) => !ignored.has(key))
      .filter((key) => {
        try { return JSON.stringify(current?.[key]) !== JSON.stringify(baseline?.[key]); }
        catch { return true; }
      });
  }

  function save() {
    const transientLease = !flightLeaseHeld;
    if (!acquireStorageLease({ hold: flightLeaseHeld })) return false;
    const keepFinishedClaim = run?.status === "finished"
      && (active?.server === true || run.result?.rewardEligible === true);
    if (active && (run?.status === "active" || keepFinishedClaim)) {
      active = {
        ...(active || {}),
        run,
        snapshot: createCircuitSnapshot(run),
        server: Boolean(active?.server)
      };
      local.active = active;
    } else {
      local.active = null;
      active = null;
    }
    local.wallet = sanitizeCircuitWallet(local.wallet);
    local.claims = sanitizeCircuitClaims(local.claims);
    local.crazyStipend = sanitizeCrazyPathStipend(local.crazyStipend);
    local.starPath = sanitizeStarPathState(local.starPath);
    local.starRewards = sanitizeRewardIds(local.starRewards);
    local.featuredRewardId = sanitizeFeaturedRewardId(local.featuredRewardId);
    const external = readLocalState(storage, circuitNow());
    if (!flightLeaseHeld && external.revision > localSaveBaseline.revision && external.writer !== instanceId) {
      const localChanges = changedLocalKeys(local, localSaveBaseline);
      const merged = { ...external };
      for (const key of localChanges) merged[key] = structuredClone(local[key]);
      local = merged;
      active = local.active;
      run = active?.run || null;
    }
    try {
      local.revision = Math.max(local.revision, external.revision) + 1;
      local.writer = instanceId;
      storage.setItem(SAVE_KEY, JSON.stringify({
        revision: local.revision,
        writer: local.writer,
        wallet: local.wallet,
        claims: local.claims,
        boosts: emptyBoosts(local.boosts),
        crazyStipend: local.crazyStipend,
        starPath: local.starPath,
        starRewards: local.starRewards,
        featuredRewardId: local.featuredRewardId,
        onboarding: {
          circuitSeen: local.onboarding?.circuitSeen === true,
          starPathSeen: local.onboarding?.starPathSeen === true
        },
        weekly: sanitizeCircuitWeeklyState(local.weekly),
        records: sanitizePersonalCircuitBoard(local.records),
        active: active ? {
          snapshot: createCircuitSnapshot(run),
          attemptToken: active.attemptToken || "",
          telemetrySeed: active.telemetrySeed || "",
          startKey: active.startKey || "",
          submitKey: active.submitKey || "",
          abandonKey: active.abandonKey || "",
          chosenRewardBoost: active.chosenRewardBoost || "",
          chosenCrazyReward: active.chosenCrazyReward || "",
          submissionRejected: active.submissionRejected === true,
          server: Boolean(active.server)
        } : null
      }));
      storageAvailable = storageBackend.persistent;
      localSaveBaseline = structuredClone(local);
      storageChannel?.postMessage?.({
        type: "circuit-saved",
        revision: local.revision,
        writer: instanceId
      });
      return storageAvailable;
    } catch {
      storageAvailable = false;
      return false;
    } finally {
      if (transientLease) releaseStorageLease();
    }
  }

  function reconcileCircuitStorage() {
    if (flightLeaseHeld || playing || submitting) return false;
    const incoming = readLocalState(storage, circuitNow());
    if (incoming.revision <= local.revision || incoming.writer === instanceId) return false;
    local = incoming;
    localSaveBaseline = structuredClone(incoming);
    active = local.active;
    run = active?.run || null;
    if (run) {
      course = run.path === "crazy"
        ? cosmosCircuitCrazyCourse(run.courseDayKey)
        : cosmosCircuitCourse(run.courseDayKey);
    }
    renderLobby();
    renderStarPath();
    updateMenuStatus();
    return true;
  }

  try {
    if (typeof globalThis.BroadcastChannel === "function") {
      storageChannel = new BroadcastChannel(SAVE_CHANNEL_NAME);
      listen(storageChannel, "message", (event) => {
        if (event.data?.type === "circuit-saved" && event.data?.writer !== instanceId) {
          reconcileCircuitStorage();
        }
      });
    }
  } catch { /* The storage event remains the cross-tab fallback. */ }
  listen(globalThis, "storage", (event) => {
    if (event.key === SAVE_KEY) reconcileCircuitStorage();
  });

  function circuitState() {
    return online && connected && remoteCircuit ? remoteCircuit : {
      launchPasses: local.wallet.passes,
      wallet: local.wallet,
      boosts: local.boosts,
      crazyPath: crazyPathEligibility(local.wallet, local.claims, local.crazyStipend, circuitNow()),
      activeAttempt: active ? { run: active.run, attemptToken: active.attemptToken, course } : null
    };
  }

  function boosts() {
    return emptyBoosts(circuitState().boosts);
  }

  function passPresentation(state = circuitState(), at = circuitNow()) {
    const source = state?.wallet && typeof state.wallet === "object"
      ? state.wallet
      : {};
    const wallet = {
      ...source,
      passes: Math.max(0, Number(state?.launchPasses ?? source.passes) || 0)
    };
    const status = circuitPassEarningStatus(wallet, at);
    return {
      status,
      text: cosmosCircuitPassCopy(status, cosmosCircuitLocale(locale()))
    };
  }

  function rewardPreviewClaims(state = circuitState()) {
    if (!online || !connected) return local.claims;
    if (state?.claims && typeof state.claims === "object") return state.claims;
    return {
      cosmosWeekKeys: state?.crazyPath?.qualified === true ? [course.weekKey] : []
    };
  }

  function renderPassStatus(state = circuitState()) {
    const { status, text } = passPresentation(state);
    const policy = cosmosCircuitPolicyCopy(cosmosCircuitLocale(locale()));
    const visiblePolicy = document.querySelector("#circuitLobby .circuit-pass-policy");
    if (visiblePolicy) {
      const pending = text.pending
        ? ` ${text.pending}${status.pendingRankGrants ? ` ${text.rankPending}` : ""}`
        : "";
      visiblePolicy.innerHTML =
        `<strong>${safeText(text.status)}.</strong> ${safeText(text.daily)} ${safeText(text.reset)} ${safeText(text.pureRule)}${safeText(pending)}`;
      visiblePolicy.dataset.resetPolicy = status.resetPolicy;
    }
    const liveStatus = byId("circuitPassStatus");
    if (liveStatus) {
      liveStatus.textContent = [
        passAnnouncement,
        text.status,
        text.pureProgress,
        text.pending,
        status.pendingRankGrants ? text.rankPending : "",
        policy.utcDay
      ].filter(Boolean).join(" ");
    }
    return { status, text };
  }

  function updateMenuStatus() {
    const state = circuitState();
    const { status, text } = passPresentation(state);
    const passes = status.passes;
    const unavailable = online && !connected;
    const pendingLabel = status.pendingTotal
      ? ` · ${status.pendingTotal} earned pending`
      : "";
    const circuitStatus = byId("cosmosCircuitMenuStatus");
    if (circuitStatus) circuitStatus.textContent = unavailable
      ? "Practice available offline"
      : `${passes} Launch Pass${passes === 1 ? "" : "es"} ready${pendingLabel}`;
    const homeStatus = byId("cosmosCircuitHomeStatus");
    if (homeStatus) homeStatus.textContent = unavailable
      ? "Practice is free offline · reconnect for Reward Flights"
      : status.pendingTotal
        ? `${text.status} · ${text.pending}`
        : `${text.status} · ${text.pureProgress}`;
    const progress = online && connected && remoteStarPath
      ? remoteStarPath
      : starPathProgress(local.starPath);
    const pathStatus = byId("starPathMenuStatus");
    const claimable = (progress.claimable?.free?.length || 0)
      + (supporter() ? progress.claimable?.supporter?.length || 0 : 0);
    if (pathStatus) pathStatus.textContent = claimable
      ? `${claimable} cosmetic${claimable === 1 ? "" : "s"} ready`
      : `Tier ${Math.min(12, (progress.reachedTier || 0) + 1)} · ${progress.xp || 0} XP`;
  }

  function renderLadder(state = circuitState()) {
    const ladder = byId("circuitRewardLadder");
    if (!ladder) return;
    const rewards = cosmosCircuitRewardLadder();
    const policy = cosmosCircuitPolicyCopy(cosmosCircuitLocale(locale()));
    const preview = circuitRewardPreview("cosmos", rewardPreviewClaims(state), {
      weekKey: course.weekKey,
      at: circuitNow()
    });
    ladder.innerHTML = Object.values(rewards).map((reward) => {
      const effective = reward.tier === "cosmos" ? preview.reward : reward;
      const payout = effective.each
        ? `${effective.each} of every Practice boost`
        : `${effective.chosen} chosen Practice boost${effective.chosen === 1 ? "" : "s"}`;
      const disclosureKey = reward.tier === "cosmos"
        ? preview.disclosureKey
        : `circuit.reward.${effective.tier}`;
      const disclosure = reward.tier === "cosmos"
        ? preview.repeatAdjusted ? policy.repeatCosmos : policy.firstCosmos
        : copy(disclosureKey);
      return `<li data-tier="${safeText(reward.tier)}" data-effective-tier="${safeText(effective.tier)}" data-disclosure-key="${safeText(disclosureKey)}"><small>${safeText(reward.tier)}</small><strong>${safeText(payout)}</strong><span>${safeText(disclosure)} Up to +${effective.starPathXp} base Path XP · ${STAR_PATH_XP_RULES.dailyBaseXpCap}/day cap</span></li>`;
    }).join("");
  }

  function updateRotationClock(now = new Date()) {
    const rotation = circuitDailyRotation(now);
    const countdown = byId("circuitRotationCountdown");
    if (countdown) countdown.textContent = rotation.countdown.label;
  }

  function circuitNow() {
    return new Date(Date.now() + serverClockOffsetMs);
  }

  function announceDailyGrant(granted, at = circuitNow()) {
    const amount = Math.max(0, Math.floor(Number(granted) || 0));
    const dayKey = at.toISOString().slice(0, 10);
    if (!amount || lastDailyGrantAnnouncementDay === dayKey) return;
    lastDailyGrantAnnouncementDay = dayKey;
    passAnnouncement = `${amount} daily Launch Pass${amount === 1 ? "" : "es"} added. Wallet cap: 6.`;
    const status = byId("circuitPassStatus");
    if (status) status.textContent = passAnnouncement;
  }

  function announceCrazyDailyGrant(grantedDays, each) {
    const days = Math.max(0, Math.floor(Number(grantedDays) || 0));
    const amount = Math.max(0, Math.floor(Number(each) || 0));
    if (!days || !amount) return;
    const status = byId("crazyPowerStatus");
    if (status) status.textContent = days === 1
      ? `${amount} of every Practice power added for today.`
      : `${amount} of every Practice power added for ${days} accrued UTC days.`;
  }

  function renderLiveOps(now = new Date()) {
    const weekly = circuitWeeklyChallenges(now);
    local.weekly = sanitizeCircuitWeeklyState(local.weekly, now);
    local.records = sanitizePersonalCircuitBoard(local.records);
    byId("circuitWeeklyTitle").textContent = weekly.title;
    const ending = new Intl.DateTimeFormat(cosmosCircuitLocale(locale()), {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    }).format(new Date(weekly.endsAt));
    byId("circuitWeeklyEnds").textContent = `Resets ${ending} at 00:00 UTC`;
    updateRotationClock(now);
    byId("circuitWeeklyChallenges").innerHTML = weekly.objectives.map((objective) => {
      const progress = local.weekly.progress[objective.id] || 0;
      const complete = progress >= objective.target;
      const claimed = local.weekly.claimedObjectiveIds.includes(objective.id);
      const percent = Math.round(clamp(progress / Math.max(1, objective.target)) * 100);
      const action = claimed ? "Claimed" : complete ? "Claim cosmetic" : `${progress} / ${objective.target}`;
      return `<li class="${complete ? "is-complete" : ""} ${claimed ? "is-claimed" : ""}">
        <div><strong>${safeText(objective.label)}</strong><small>${safeText(objective.reward.label)} · cosmetic only</small></div>
        <button type="button" data-circuit-weekly-claim="${safeText(objective.id)}" ${complete && !claimed ? "" : "disabled"}>${safeText(action)}</button>
        <span class="circuit-objective-meter"><i style="--objective-progress:${percent}%"></i><b>${progress} / ${objective.target}</b></span>
      </li>`;
    }).join("");
    const board = personalCircuitRecordBoard(local.records, { limit: 3 });
    const records = [
      ...board.launch.records.map((record) => ({ ...record, label: "Launch" })),
      ...board.practice.records.map((record) => ({ ...record, label: "Practice" }))
    ].slice(0, 6);
    byId("circuitPersonalRecords").innerHTML = records.length
      ? records.map((record, index) => `<li>
          <span class="record-rank">#${index + 1}</span>
          <div><strong>${safeText(record.label)} · ${safeText(record.milestone)}</strong><small>${safeText(record.dayKey)} · ${formatTime(record.elapsedMs)}</small></div>
          <span class="record-score">${record.score}</span>
        </li>`).join("")
      : "<li class=\"record-empty\">Finish a flight to chart your first private record.</li>";
    byId("circuitRecordsStatus").textContent = records.length
      ? `${board.launch.records.length} Launch best · ${board.practice.records.length} Practice best. Stored only on this device.`
      : "Launch and Practice bests are kept separately. No fake rivals or personal information.";
  }

  function recordLiveOps(completed, now = new Date()) {
    if (completed?.path === "crazy") {
      save();
      renderLiveOps(now);
      return;
    }
    const weekly = recordCircuitWeeklyProgress(local.weekly, completed, {
      verified: true,
      at: now
    });
    local.weekly = weekly.state;
    const personal = recordPersonalCircuitResult(local.records, completed, { verified: true });
    local.records = personal.board;
    save();
    renderLiveOps(now);
    if (personal.recorded) track("cosmos_circuit_personal_best", {
      mode: completed.mode,
      milestone: completed.result?.milestone || "none"
    });
    if (weekly.updates?.some((update) => update.complete && update.before < update.after)) {
      track("cosmos_circuit_challenge_completed");
    }
  }

  function claimWeekly(objectiveId) {
    const claim = claimCircuitWeeklyReward(local.weekly, objectiveId);
    local.weekly = claim.state;
    if (!claim.claimed) {
      toast(claim.reason === "already_claimed"
        ? "That weekly cosmetic is already in your collection."
        : "Complete that flight objective first.");
      renderLiveOps();
      return;
    }
    local.starRewards = sanitizeRewardIds([...local.starRewards, claim.reward.id]);
    const persisted = save();
    renderLiveOps();
    renderSeasonLocker();
    audio?.playResult?.({ unlock: true });
    toast(persisted
      ? `${claim.reward.label} unlocked on this device.`
      : `${claim.reward.label} is available for this session. Local storage is unavailable; export a backup before leaving.`);
    track("cosmos_circuit_weekly_reward_claimed", { kind: claim.reward.kind });
  }

  function renderLobby() {
    if (!active?.run) course = cosmosCircuitCourse(circuitNow());
    if (!online) {
      const now = circuitNow();
      const daily = grantDailyLaunchPasses(local.wallet, now);
      local.wallet = daily.wallet;
      const crazyDaily = grantCrazyPathDailyPowers(local.crazyStipend, now);
      local.crazyStipend = crazyDaily.stipend;
      if (crazyDaily.each) {
        local.boosts = addBoosts(local.boosts, crazyDaily.boosts);
        announceCrazyDailyGrant(crazyDaily.grantedDays, crazyDaily.each);
      }
      if (daily.granted) {
        announceDailyGrant(daily.granted, now);
      }
      if (daily.granted || crazyDaily.grantedDays) save();
    }
    const state = circuitState();
    const inventory = boosts();
    const passes = Math.max(0, Number(state.launchPasses ?? state.wallet?.passes) || 0);
    byId("circuitPassCount").textContent = String(passes);
    byId("circuitCourseKey").textContent = `${course.dayKey} · ${course.weekKey}`;
    byId("circuitCourseName").textContent = course.name;
    const archetype = course.archetype && typeof course.archetype === "object"
      ? course.archetype
      : {};
    const routeSummary = course.variant === "crazy"
      ? "Twenty required hazards, tighter gates, faster sectors, two equal power beacons, and zero partial rewards."
      : "Eight planetary gates, two black-hole tunnels, two power beacons, and a collectible Stardust trail.";
    byId("circuitCourseDescription").textContent = archetype.name
      ? `${archetype.name} · ${archetype.description || routeSummary} ${routeSummary}`
      : routeSummary;
    byId("circuitCourseDescription").dataset.archetype = String(course.archetypeId || archetype.id || "");
    byId("circuitCourseGoals").innerHTML = course.goals
      .map((goal) => `<li>${safeText(goal.label)}</li>`).join("");
    for (const boost of CIRCUIT_BOOSTS) {
      const count = byId(`circuitBoost${boost[0].toUpperCase()}${boost.slice(1)}`);
      if (count) count.textContent = String(inventory[boost]);
      const button = document.querySelector(`[data-practice-boost="${boost}"]`);
      if (button) {
        button.disabled = inventory[boost] < 1;
        button.setAttribute("aria-pressed", String(selectedBoost === boost));
      }
    }
    const hasActive = Boolean(active?.run && ["active", "finished"].includes(active.run.status));
    const pendingSubmit = active?.run?.status === "finished";
    const activeMode = active?.run?.mode || "";
    const activePath = active?.run?.path || "standard";
    const pendingVerb = active?.server ? "Submit" : "Claim";
    const practice = byId("startCircuitPractice");
    const reward = byId("startCircuitReward");
    const crazy = byId("startCircuitCrazy");
    const abandonButton = byId("abandonCircuitAttempt");
    practice.querySelector("span").textContent = hasActive
      ? activeMode === "practice"
        ? pendingSubmit ? `${pendingVerb} saved Practice Flight` : "Resume Practice Flight"
        : "Finish saved Reward Flight first"
      : "Practice";
    practice.disabled = hasActive
      && (activeMode !== "practice" || (pendingSubmit && active?.server && !connected));
    reward.querySelector("span").textContent = hasActive
      ? activeMode === "ticketed" && activePath !== "crazy"
        ? pendingSubmit && active?.server && !connected
          ? "Reconnect to submit saved Reward Flight"
          : pendingSubmit ? `${pendingVerb} saved Reward Flight` : "Resume Reward Flight"
        : "Finish saved Practice Flight first"
      : online && !connected
        ? "Reconnect for Reward Flight"
        : "Use 1 Launch Pass";
    reward.disabled = hasActive
      ? activeMode !== "ticketed" || activePath === "crazy" || (pendingSubmit && active?.server && !connected)
      : passes < 1 || (online && !connected);
    const crazyState = state.crazyPath || crazyPathEligibility(
      local.wallet,
      local.claims,
      local.crazyStipend,
      circuitNow()
    );
    let crazyLabel = "Review 3-pass entry";
    if (hasActive) {
      crazyLabel = activePath === "crazy"
        ? pendingSubmit && active?.server && !connected
          ? "Reconnect to settle saved Crazy Path"
          : pendingSubmit ? `${pendingVerb} saved Crazy Path` : "Resume Crazy Path"
        : "Finish saved flight first";
    } else if (online && !connected) crazyLabel = "Reconnect for Crazy Path";
    else if (crazyState.reason === "cosmos_qualification_required") crazyLabel = "Complete a Cosmos flight this week";
    else if (crazyState.reason === "route_rank_required") crazyLabel =
      `Reach ${String(crazyState.rank?.minimumId || "gold").replace(/^\w/, (letter) => letter.toUpperCase())} route rank`;
    else if (crazyState.reason === "weekly_attempt_used") crazyLabel = "Attempt used · resets Monday UTC";
    else if (crazyState.reason === "victory_cooldown") crazyLabel = `Victory cooldown · eligible ${crazyState.cooldownUntilDay}`;
    else if (crazyState.reason === "launch_passes_required") {
      crazyLabel = `Need ${crazyState.passesNeeded} more Launch Pass${crazyState.passesNeeded === 1 ? "" : "es"}`;
    }
    crazy.querySelector("span").textContent = crazyLabel;
    crazy.disabled = hasActive
      ? activePath !== "crazy" || (pendingSubmit && active?.server && !connected)
      : !crazyState.eligible || (online && !connected);
    if (active?.submissionRejected) {
      practice.disabled = true;
      reward.disabled = true;
      crazy.disabled = true;
      const blockedButton = activePath === "crazy"
        ? crazy
        : activeMode === "ticketed"
          ? reward
          : practice;
      blockedButton.querySelector("span").textContent = "Result rejected · abandon saved flight";
    }
    const crazyStatus = byId("crazyPathStatus");
    if (crazyStatus) {
      const stipend = sanitizeCrazyPathStipend(crazyState.stipend);
      if (stipend.runId) {
        const delivered = stipend.creditedDays * CRAZY_PATH_DAILY_POWERS;
        crazyStatus.textContent = stipend.complete
          ? `Thirty-Day Supply complete · ${delivered} of each Practice power delivered.`
          : `Day ${stipend.creditedDays} of ${CRAZY_PATH_DAILY_DAYS} credited · ${delivered} of each delivered · elapsed days accrue automatically.`;
      } else if (crazyState.eligible) {
        crazyStatus.textContent = "Qualified this week · one all-or-nothing attempt is ready.";
      } else if (crazyState.reason === "cosmos_qualification_required") {
        crazyStatus.textContent = "Unlock by completing a Cosmos-tier standard Reward Flight during this UTC week.";
      } else if (crazyState.reason === "route_rank_required") {
        const minimum = String(crazyState.rank?.minimumId || "gold").replace(/^\w/, (letter) => letter.toUpperCase());
        crazyStatus.textContent = crazyState.qualified
          ? `This week’s Cosmos qualification is complete. Reach ${minimum} route rank to enter.`
          : `Reach ${minimum} route rank and complete this UTC week’s Cosmos-tier standard Reward Flight.`;
      } else if (crazyState.reason === "weekly_attempt_used") {
        crazyStatus.textContent = "This week’s attempt is spent. A new week requires a new Cosmos qualification.";
      } else if (crazyState.reason === "victory_cooldown") {
        crazyStatus.textContent = `Victory cooldown ends ${crazyState.cooldownUntilDay} UTC.`;
      } else {
        crazyStatus.textContent = `Three earned Launch Passes are required · ${crazyState.passesNeeded || 0} still needed.`;
      }
    }
    abandonButton.hidden = !hasActive;
    abandonButton.disabled = Boolean(active?.server && !connected);
    abandonButton.textContent = active?.server && !connected
      ? "Reconnect to abandon saved flight"
      : activePath === "crazy"
        ? "Abandon saved Crazy Path · 3 Launch Passes and this week’s attempt are not refunded"
        : activeMode === "ticketed"
          ? "Abandon saved Reward Flight · Launch Pass is not refunded"
          : "Abandon saved Practice Flight";
    renderPassStatus(state);
    renderLadder(state);
    renderLiveOps();
    renderSeasonLocker();
    const backupStatus = byId("circuitBackupStatus");
    if (backupStatus && !storageAvailable && !backupStatus.textContent) {
      backupStatus.textContent = "Local storage is unavailable. Export JSON before leaving to keep this session’s Circuit data.";
    }
    byId("circuitLobby").hidden = false;
    byId("circuitFlight").hidden = true;
    byId("circuitResult").hidden = true;
    updateMenuStatus();
  }

  function ingestStatus(payload) {
    if (!payload || typeof payload !== "object") return;
    const serverTime = Date.parse(payload.serverTime || "");
    if (Number.isFinite(serverTime)) {
      serverClockOffsetMs = clamp(serverTime - Date.now(), -300_000, 300_000);
      observedUtcDay = circuitNow().toISOString().slice(0, 10);
    }
    remoteCircuit = payload.circuit || remoteCircuit;
    remoteStarPath = payload.starPath || remoteStarPath;
    const beforeRewards = local.starRewards.join("|");
    local.starRewards = sanitizeRewardIds(
      local.starRewards.filter((id) => Boolean(circuitWeeklyRewardById(id)))
    );
    if (beforeRewards !== local.starRewards.join("|")) save();
    const serverAttempt = remoteCircuit?.activeAttempt;
    course = serverAttempt?.course
      || (serverAttempt?.run
        ? serverAttempt.run.path === "crazy"
          ? cosmosCircuitCrazyCourse(serverAttempt.run.courseDayKey)
          : cosmosCircuitCourse(serverAttempt.run.courseDayKey)
        : null)
      || payload.course
      || course;
    if (serverAttempt?.run) {
      const saved = local.active;
      const recovered = saved?.run?.id === serverAttempt.run.id ? saved.run : serverAttempt.run;
      active = {
        run: recovered,
        attemptToken: serverAttempt.attemptToken || saved?.attemptToken || "",
        telemetrySeed: serverAttempt.telemetrySeed || saved?.telemetrySeed || "",
        startKey: saved?.startKey || identifier("start"),
        submitKey: saved?.submitKey || identifier("submit"),
        abandonKey: saved?.abandonKey || identifier("abandon"),
        chosenRewardBoost: CIRCUIT_BOOSTS.includes(saved?.chosenRewardBoost)
          ? saved.chosenRewardBoost
          : "",
        chosenCrazyReward: CRAZY_PATH_REWARD_CHOICES.includes(saved?.chosenCrazyReward)
          ? saved.chosenCrazyReward
          : "",
        submissionRejected: saved?.submissionRejected === true,
        server: true
      };
      run = recovered;
      local.active = active;
      save();
    } else if (active?.server) {
      active = null;
      run = null;
      local.active = null;
      save();
    }
  }

  async function refresh() {
    if (!online || typeof request !== "function") {
      const now = circuitNow();
      const daily = grantDailyLaunchPasses(local.wallet, now);
      local.wallet = daily.wallet;
      announceDailyGrant(daily.granted, now);
      course = active?.run
        ? active.run.path === "crazy"
          ? cosmosCircuitCrazyCourse(active.run.courseDayKey)
          : cosmosCircuitCourse(active.run.courseDayKey)
        : cosmosCircuitCourse(now);
      connected = true;
      save();
      renderLobby();
      renderStarPath();
      return { circuit: circuitState(), course };
    }
    try {
      const payload = await request("/api/circuit");
      connected = true;
      ingestStatus(payload);
      announceDailyGrant(payload?.dailyGrant?.granted, circuitNow());
      announceCrazyDailyGrant(payload?.crazyDailyGrant?.grantedDays, payload?.crazyDailyGrant?.each);
      renderLobby();
      renderStarPath();
      return payload;
    } catch (error) {
      connected = false;
      course = active?.run
        ? active.run.path === "crazy"
          ? cosmosCircuitCrazyCourse(active.run.courseDayKey)
          : cosmosCircuitCourse(active.run.courseDayKey)
        : cosmosCircuitCourse(circuitNow());
      renderLobby();
      updateMenuStatus();
      return { error };
    }
  }

  function rewardMetadata(rewardId) {
    const id = sanitizeFeaturedRewardId(rewardId);
    if (!id) return null;
    if (!rewardMetadataCache.has(id)) {
      rewardMetadataCache.set(id, starPathRewardById(id) || circuitWeeklyRewardById(id));
    }
    const reward = rewardMetadataCache.get(id);
    return reward ? { ...reward } : null;
  }

  function ownedRewardIds() {
    if (online && connected && remoteStarPath) {
      const localWeekly = local.starRewards.filter((id) => Boolean(circuitWeeklyRewardById(id)));
      const remoteSeasonal = (Array.isArray(remoteStarPath.rewards) ? remoteStarPath.rewards : [])
        .filter((id) => Boolean(starPathRewardById(id)));
      return sanitizeRewardIds([...localWeekly, ...remoteSeasonal]);
    }
    return sanitizeRewardIds(local.starRewards);
  }

  function featuredReward() {
    const id = sanitizeFeaturedRewardId(local.featuredRewardId);
    const authority = online && connected && remoteStarPath
      ? `${remoteStarPath.rewards?.join("|") || ""}|${local.starRewards.filter((rewardId) => rewardId.includes(".circuit.weekly.")).join("|")}`
      : local.starRewards.join("|");
    const signature = `${id}|${authority}`;
    if (signature !== featuredCacheSignature) {
      featuredCacheSignature = signature;
      featuredCacheReward = id && ownedRewardIds().includes(id) ? rewardMetadata(id) : null;
      paletteCacheId = "";
    }
    return featuredCacheReward ? { ...featuredCacheReward } : null;
  }

  function rewardHash(value) {
    let hash = 0x811c9dc5;
    for (const character of String(value || "")) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  function practicePalette() {
    const reward = featuredReward();
    const cacheId = reward?.id || "default";
    if (paletteCacheId === cacheId && paletteCache) return paletteCache;
    paletteCacheId = cacheId;
    paletteCache = !reward
      ? {
        ship: "#fff2b5",
        trail: "#55ddff",
        gate: "#e7b95a",
        label: "Default Circuit styling"
      }
      : (() => {
          const hue = rewardHash(reward.id) % 360;
          return {
            ship: `hsl(${hue} 92% 82%)`,
            trail: `hsl(${(hue + 58) % 360} 88% 66%)`,
            gate: `hsl(${(hue + 302) % 360} 92% 70%)`,
            label: reward.label
          };
        })();
    return paletteCache;
  }

  function remixTheme(reward = featuredReward()) {
    if (!reward || String(reward.kind).toLocaleLowerCase("en-US") !== "ostremix") return "";
    if (reward.id.includes("wayfinder-reprise")) return CIRCUIT_REMIX_THEMES[0];
    if (reward.id.includes("midnight-navigation")) return CIRCUIT_REMIX_THEMES[4];
    return CIRCUIT_REMIX_THEMES[rewardHash(reward.id) % CIRCUIT_REMIX_THEMES.length];
  }

  function applyFeaturedAudio() {
    const theme = remixTheme();
    if (theme) audio?.setTheme?.(theme);
  }

  function restoreSoundTheme() {
    audio?.setTheme?.(soundTheme());
  }

  function renderSeasonLocker() {
    const select = byId("starPathFeaturedReward");
    const status = byId("starPathLockerStatus");
    const owned = ownedRewardIds()
      .map(rewardMetadata)
      .filter(Boolean)
      .sort((left, right) => left.label.localeCompare(right.label));
    const selected = featuredReward();
    if (local.featuredRewardId && !selected && (!online || connected)) {
      local.featuredRewardId = "";
      save();
    }
    if (select) {
      select.innerHTML = [
        "<option value=\"\">Default Circuit styling</option>",
        ...owned.map((reward) => `<option value="${safeText(reward.id)}">${safeText(reward.label)} · ${safeText(reward.kind)}</option>`)
      ].join("");
      select.value = selected?.id || "";
      select.disabled = owned.length === 0;
    }
    if (status) {
      status.textContent = selected
        ? `${selected.label} is featured in Circuit. Cosmetic presentation only.`
        : owned.length
          ? `${owned.length} earned cosmetic${owned.length === 1 ? "" : "s"} ready to feature.`
          : "Claim a season or weekly cosmetic to add it here.";
    }
    const lobbyLabel = byId("circuitFeaturedCosmetic");
    if (lobbyLabel) {
      lobbyLabel.textContent = selected
        ? `Season Locker: ${selected.label} featured`
        : "Season Locker: default flight styling";
    }
  }

  function sizeCanvas() {
    if (!canvas || !context) return { width: 960, height: 540, dpr: 1 };
    const rectangle = canvas.getBoundingClientRect();
    const saveData = Boolean(globalThis.navigator?.connection?.saveData
      || globalThis.navigator?.mozConnection?.saveData
      || globalThis.navigator?.webkitConnection?.saveData);
    const reducedMotion = Boolean(reducedMotionQuery?.matches);
    const compact = Math.min(rectangle.width || 960, globalThis.innerWidth || 960) <= 480;
    const dprCap = saveData ? 1 : compact || reducedMotion ? 1.5 : 2;
    const dpr = Math.min(dprCap, globalThis.devicePixelRatio || 1);
    const width = Math.max(320, Math.round(rectangle.width || 960));
    const height = Math.max(180, Math.round(rectangle.height || 540));
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height, dpr };
  }

  function prefersReducedMotion() {
    return Boolean(reducedMotionQuery?.matches);
  }

  function currentVisual() {
    if (!run) return null;
    const segment = course.segments[run.cursor];
    if (!segment) return null;
    const start = segmentStart(course, run.cursor);
    return { segment, start, target: checkpointFor(course, segment, start) };
  }

  function draw() {
    if (!context) return;
    const { width, height } = sizeCanvas();
    const visual = currentVisual();
    const palette = practicePalette();
    const reducedMotion = prefersReducedMotion();
    const gradient = context.createRadialGradient(width * 0.52, height * 0.48, 10, width * 0.5, height * 0.5, width);
    gradient.addColorStop(0, "#112a59");
    gradient.addColorStop(0.5, "#07142f");
    gradient.addColorStop(1, "#020611");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(255,255,255,.72)";
    const saveData = Boolean(globalThis.navigator?.connection?.saveData
      || globalThis.navigator?.mozConnection?.saveData
      || globalThis.navigator?.webkitConnection?.saveData);
    const starCount = saveData ? 36 : 74;
    for (let index = 0; index < starCount; index += 1) {
      const x = ((index * 89 + course.seed) % 997) / 997 * width;
      const y = ((index * 149 + course.seed) % 541) / 541 * height;
      const radius = index % 9 === 0 ? 1.5 : 0.7;
      context.globalAlpha = 0.35 + ((index * 17) % 50) / 100;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    if (visual) {
      const progress = clamp(segmentProgressMs / visual.segment.durationMs);
      const targetX = visual.target.x * width;
      const targetY = visual.target.y * height;
      const approach = reducedMotion ? 1 : 0.35 + progress * 0.9;
      const radius = visual.target.radius * Math.min(width, height) * approach;
      context.save();
      context.translate(targetX, targetY);
      if (visual.target.type === "blackHole") {
        const hole = context.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius * 1.5);
        hole.addColorStop(0, "#000");
        hole.addColorStop(0.48, "#080713");
        hole.addColorStop(0.62, "rgba(173,103,255,.9)");
        hole.addColorStop(1, "rgba(74,165,255,0)");
        context.fillStyle = hole;
        context.beginPath();
        context.arc(0, 0, radius * 1.5, 0, Math.PI * 2);
        context.fill();
      } else {
        context.strokeStyle = palette.gate;
        context.shadowColor = palette.gate;
        context.shadowBlur = reducedMotion ? 0 : 18;
        context.lineWidth = Math.max(3, radius * 0.12);
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = 0.4;
        context.beginPath();
        context.arc(0, 0, radius * 0.65, 0, Math.PI * 2);
        context.stroke();
      }
      context.restore();
      const end = visual.start + visual.segment.durationMs;
      for (const dust of course.checkpoints.filter((item) =>
        item.type === "stardust" && item.at >= visual.start && item.at < end && !checkedDust.has(item.id)
      )) {
        const distanceToPass = (dust.at - (visual.start + segmentProgressMs)) / visual.segment.durationMs;
        if (distanceToPass < -0.08 || distanceToPass > 0.65) continue;
        const scale = 0.5 + (0.65 - distanceToPass) * 1.3;
        context.fillStyle = "#fff3a5";
        context.shadowColor = "#ffd95a";
        context.shadowBlur = reducedMotion ? 0 : 10;
        context.beginPath();
        context.arc(dust.x * width, dust.y * height, 3.2 * scale, 0, Math.PI * 2);
        context.fill();
      }
    }
    const shipX = ship.x * width;
    const shipY = ship.y * height;
    context.shadowColor = palette.trail;
    context.shadowBlur = reducedMotion ? 0 : 16;
    context.strokeStyle = palette.trail;
    context.lineWidth = 4;
    context.globalAlpha = 0.55;
    context.beginPath();
    context.moveTo(shipX, shipY + 10);
    context.lineTo(shipX, shipY + (reducedMotion ? 22 : 42));
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = palette.ship;
    context.beginPath();
    context.moveTo(shipX, shipY - 15);
    context.lineTo(shipX - 12, shipY + 13);
    context.lineTo(shipX, shipY + 8);
    context.lineTo(shipX + 12, shipY + 13);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
  }

  function powers() {
    return emptyBoosts(run?.metrics?.abilities);
  }

  function syncPowerButton() {
    const button = byId("activateCircuitPower");
    if (!button) return;
    const ready = CIRCUIT_BOOSTS.find((boost) => powers()[boost] > 0) || "";
    button.dataset.power = ready;
    button.disabled = !ready || Boolean(queuedUse) || paused || choosing;
    button.querySelector("b").textContent = queuedUse
      ? `${LABELS[queuedUse]} armed`
      : ready ? `${LABELS[ready]} ready` : "No power ready";
  }

  function updateExtractionPreview(force = false) {
    const button = byId("extractCircuitFlight");
    if (!button) return;
    const needsPreview = force
      || extractionRunId !== (run?.id || "")
      || extractionCursor !== (run?.cursor ?? -1);
    if (needsPreview) {
      extractionRunId = run?.id || "";
      extractionCursor = run?.cursor ?? -1;
      extractionPreview = run?.status === "active"
        && run.mode === "ticketed"
        && run.path !== "crazy"
        ? finishCircuitRun(run, {
            reason: "extract",
            elapsedMs: run.events.at(-1)?.elapsedMs || 0
          })
        : null;
    }
    const milestone = extractionPreview?.result?.milestone || "none";
    const available = extractionPreview?.finished === true
      && extractionPreview.result?.rewardEligible === true;
    button.hidden = run?.mode !== "ticketed" || run?.path === "crazy";
    button.disabled = !available || paused || choosing || submitting;
    button.textContent = available
      ? `Bank ${milestone[0].toUpperCase()}${milestone.slice(1)} reward`
      : "Bank progress after checkpoint 5";
  }

  function directionKey(target) {
    const horizontal = target.x - ship.x;
    const vertical = target.y - ship.y;
    const x = Math.abs(horizontal) < 0.08 ? "" : horizontal < 0 ? "Left" : "Right";
    const y = Math.abs(vertical) < 0.08 ? "" : vertical < 0 ? "up" : "down";
    if (!x && !y) return "center";
    if (!x) return y;
    if (!y) return x.toLowerCase();
    return `${y}${x}`;
  }

  function syncTargetCue(forceAnnouncement = false) {
    const target = currentVisual()?.target;
    const cue = byId("circuitTargetCue");
    if (!target || !cue) return;
    const kind = ["gate", "blackHole", "beacon"].includes(target.type) ? target.type : "asteroid";
    const message = copy("flight.target", {
      kind: copy(`flight.kind.${kind}`),
      direction: copy(`flight.direction.${directionKey(target)}`)
    });
    cue.textContent = message;
    const now = globalThis.performance?.now?.() ?? Date.now();
    if (message !== pendingNavigationAnnouncement) {
      pendingNavigationAnnouncement = message;
      pendingNavigationSince = now;
    }
    if (forceAnnouncement
      || (message !== lastNavigationAnnouncement
        && now - pendingNavigationSince >= 600
        && now - lastNavigationAnnouncedAt >= 3_000)) {
      const live = byId("circuitNavigationStatus");
      if (live) live.textContent = message;
      lastNavigationAnnouncement = message;
      lastNavigationAnnouncedAt = now;
    }
  }

  function syncAudioIntensity(progress, flow) {
    const crazyPath = run?.path === "crazy";
    const next = clamp(
      (crazyPath ? 0.38 : 0.12)
      + progress * (crazyPath ? 0.5 : 0.62)
      + Math.min(10, flow || 0) * 0.026
    );
    if (Math.abs(next - lastAudioIntensity) < 0.075) return;
    lastAudioIntensity = next;
    audio?.setIntensity?.(next);
  }

  function updateHud() {
    if (!run) return;
    const metrics = run.metrics;
    const elapsedBefore = run.events.at(-1)?.elapsedMs || 0;
    byId("circuitHudCourse").textContent = course.name;
    byId("circuitHudTime").textContent = formatTime(course.expectedDurationMs - elapsedBefore - segmentWallMs);
    byId("circuitHudFlow").textContent = `x${(1 + Math.min(10, metrics.flow || 0) * 0.08).toFixed(1)}`;
    const gateGoal = course.segments.filter((segment) => segment.kind === "planet-gate").length;
    byId("circuitHudGates").textContent = `${metrics.planetGatesPassed || 0} / ${gateGoal}`;
    const percent = clamp((run.cursor + segmentProgressMs / (course.segments[run.cursor]?.durationMs || 1)) / course.segments.length) * 100;
    byId("circuitProgressBar").style.width = `${percent}%`;
    byId("circuitProgressBar").parentElement?.setAttribute("aria-valuenow", String(Math.round(percent)));
    syncTargetCue();
    syncAudioIntensity(percent / 100, metrics.flow);
    syncPowerButton();
    updateExtractionPreview();
  }

  function captureTrajectorySample(force = false) {
    if (!run || run.status !== "active") return;
    const progressMs = Math.round(segmentProgressMs);
    if (!force && progressMs - lastSampleProgressMs < 180) return;
    const sample = {
      progressMs,
      elapsedMs: (run.events.at(-1)?.elapsedMs || 0) + Math.round(segmentWallMs),
      x: Number(ship.x.toFixed(4)),
      y: Number(ship.y.toFixed(4))
    };
    if (segmentSamples.at(-1)?.progressMs === progressMs) {
      segmentSamples[segmentSamples.length - 1] = sample;
    } else if (segmentSamples.length < 64) {
      segmentSamples.push(sample);
    } else {
      segmentSamples[segmentSamples.length - 1] = sample;
    }
    lastSampleProgressMs = progressMs;
  }

  function evaluateDust(visual) {
    const courseElapsed = visual.start + segmentProgressMs;
    const threshold = queuedUse === "magnet" ? 0.2 : 0.075;
    for (const dust of course.checkpoints) {
      if (dust.type !== "stardust" || checkedDust.has(dust.id) || dust.at > courseElapsed) continue;
      if (dust.at < visual.start || dust.at >= visual.start + visual.segment.durationMs) continue;
      checkedDust.add(dust.id);
      const distance = Math.hypot(ship.x - dust.x, ship.y - dust.y);
      if (distance <= threshold) {
        collectedDust.add(dust.id);
        audio?.playFeedback?.("place");
      }
    }
  }

  function sampledPositionAt(progressMs) {
    const first = segmentSamples[0] || { x: ship.x, y: ship.y, progressMs: 0 };
    if (progressMs <= first.progressMs) return first;
    const last = segmentSamples.at(-1) || first;
    if (progressMs >= last.progressMs) return last;
    for (let index = 1; index < segmentSamples.length; index += 1) {
      const right = segmentSamples[index];
      if (right.progressMs < progressMs) continue;
      const left = segmentSamples[index - 1];
      const span = right.progressMs - left.progressMs;
      const ratio = span > 0 ? (progressMs - left.progressMs) / span : 0;
      return {
        x: left.x + (right.x - left.x) * ratio,
        y: left.y + (right.y - left.y) * ratio
      };
    }
    return last;
  }

  function eventForSegment(visual) {
    const distance = Math.hypot(ship.x - visual.target.x, ship.y - visual.target.y);
    const radius = visual.target.radius * (queuedUse === "phase" ? 1.55 : 1);
    let outcome = distance <= radius * 0.48 ? "perfect"
      : distance <= radius ? "clear"
        : distance <= radius * 1.38 ? "near-miss" : "miss";
    if (queuedUse === "shield" && outcome === "miss"
      && ["black-hole", "asteroid-field"].includes(visual.segment.kind)) outcome = "near-miss";
    const dustInSegment = course.checkpoints.filter((item) =>
      item.type === "stardust"
      && item.at >= visual.start
      && item.at < visual.start + visual.segment.durationMs
    );
    const dustThreshold = queuedUse === "magnet" ? 0.2 : 0.075;
    const collected = dustInSegment.filter((item) => {
      const position = sampledPositionAt(item.at - visual.start);
      return Math.hypot(position.x - item.x, position.y - item.y) <= dustThreshold + 0.012;
    }).length;
    const stardust = dustInSegment.length
      ? Math.round((collected / dustInSegment.length) * visual.segment.stardust)
      : 0;
    return {
      segmentId: visual.segment.id,
      outcome,
      stardust,
      ability: "",
      useAbility: queuedUse,
      samples: segmentSamples.map((sample) => ({ ...sample })),
      elapsedMs: Math.max(
        (run.events.at(-1)?.elapsedMs || 0) + 1,
        (run.events.at(-1)?.elapsedMs || 0) + Math.round(segmentWallMs)
      )
    };
  }

  function abilityOptions(segment) {
    const offset = (course.seed + segment.index) % CIRCUIT_BOOSTS.length;
    return [CIRCUIT_BOOSTS[offset], CIRCUIT_BOOSTS[(offset + 2) % CIRCUIT_BOOSTS.length]];
  }

  function askForAbility(event, segment) {
    pendingEvent = event;
    choosing = true;
    paused = true;
    const choice = byId("circuitAbilityChoice");
    choice.querySelector("div").innerHTML = abilityOptions(segment)
      .map((boost) => `<button type="button" data-circuit-ability="${boost}">${LABELS[boost]}</button>`)
      .join("");
    choice.hidden = false;
    byId("circuitAbilityPrompt").textContent = "Choose one equal checkpoint power";
    audio?.playFeedback?.("twist");
    choice.querySelector("button")?.focus();
  }

  function renderRewardChoice(result) {
    renderResult(result, null);
    byId("circuitResultEyebrow").textContent = "FLIGHT COMPLETE · CHOOSE YOUR FIXED REWARD";
    byId("circuitResultReward").hidden = true;
    byId("circuitResultActions").hidden = true;
    const choice = byId("circuitRewardChoice");
    choice.hidden = false;
    choice.querySelectorAll("button").forEach((button) => {
      button.disabled = false;
    });
    choice.querySelector("button")?.focus();
    byId("circuitRewardChoiceStatus").textContent =
      `${result.milestone === "orbit" ? "Two" : "One"} Practice boost${result.milestone === "orbit" ? "s" : ""} will be added after verification.`;
  }

  function renderCrazyRewardChoice(result) {
    renderResult(result, null);
    const instant = crazyPathRewardOptions().find((option) => option.id === "instant");
    const daily = crazyPathRewardOptions().find((option) => option.id === "daily");
    crazyRewardSelection = "";
    byId("circuitResultEyebrow").textContent = "CRAZY PATH CONQUERED · CHOOSE ONE";
    byId("circuitResultTitle").textContent = "Claim the impossible";
    byId("circuitResultSummary").textContent =
      "The verified route is complete. Choose one exact Practice-power reward; this decision is permanent.";
    byId("circuitResultReward").hidden = true;
    byId("circuitResultActions").hidden = true;
    const choice = byId("crazyRewardChoice");
    choice.hidden = false;
    choice.querySelectorAll("input").forEach((input) => { input.checked = false; });
    byId("confirmCrazyReward").disabled = true;
    byId("crazyRewardChoiceStatus").textContent =
      `No reward selected. Immediate Cache gives ${instant?.totalPerBoost || CRAZY_PATH_INSTANT_POWERS} of each now; Thirty-Day Supply gives ${daily?.totalPerBoost || (CRAZY_PATH_DAILY_POWERS * CRAZY_PATH_DAILY_DAYS)} of each across ${daily?.grantDays || CRAZY_PATH_DAILY_DAYS} UTC days.`;
    choice.querySelector("input")?.focus();
  }

  async function completeRun(requestedBoost = "", requestedCrazyReward = "") {
    if (submitting || !run) return;
    if (active && !acquireFlightLease()) return;
    flightGeneration += 1;
    playing = false;
    cancelAnimationFrame(frame);
    lastAudioIntensity = 0;
    audio?.setIntensity?.(0);
    audio?.setScene?.("result");
    const completed = run;
    let result = completed.result;
    let grant = null;
    const chosenBoost = CIRCUIT_BOOSTS.includes(requestedBoost)
      ? requestedBoost
      : CIRCUIT_BOOSTS.includes(active?.chosenRewardBoost)
        ? active.chosenRewardBoost
        : "";
    const chosenCrazyReward = CRAZY_PATH_REWARD_CHOICES.includes(requestedCrazyReward)
      ? requestedCrazyReward
      : CRAZY_PATH_REWARD_CHOICES.includes(active?.chosenCrazyReward)
        ? active.chosenCrazyReward
        : "";
    if (completed.path === "crazy"
      && result?.rewardEligible
      && !chosenCrazyReward) {
      save();
      renderCrazyRewardChoice(result);
      return;
    }
    if (completed.mode === "ticketed"
      && result?.rewardEligible
      && ["drift", "orbit"].includes(result?.milestone)
      && !chosenBoost) {
      save();
      renderRewardChoice(result);
      return;
    }
    if (active) {
      active.chosenRewardBoost = chosenBoost;
      active.chosenCrazyReward = chosenCrazyReward;
      active.submitKey ||= identifier("submit");
      save();
    }
    if (active?.server && (!connected || typeof request !== "function")) {
      save();
      releaseStorageLease();
      toast("Flight saved. Reconnect to submit the verified result.");
      renderLobby();
      return;
    }
    submitting = true;
    if (active?.server) {
      try {
        const chainedEvents = await chainCircuitTelemetry(completed.events, active.telemetrySeed);
        const response = await request("/api/circuit/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId: completed.id,
            attemptToken: active.attemptToken,
            idempotencyKey: active.submitKey,
            reason: completed.end?.reason || "finish",
            chosenBoost,
            crazyRewardChoice: chosenCrazyReward,
            events: chainedEvents
          })
        });
        result = response.result || result;
        grant = response.grant || null;
        remoteCircuit = response.circuit || remoteCircuit;
        remoteStarPath = response.starPath || remoteStarPath;
      } catch (error) {
        submitting = false;
        const retryable = isRetryableCircuitError(error);
        const terminal = !retryable && [401, 404, 410].includes(Number(error?.status));
        if (terminal) {
          active = null;
          run = null;
          local.active = null;
        } else if (!retryable && active) {
          active.submissionRejected = true;
        }
        save();
        releaseStorageLease();
        playing = false;
        toast(terminal
          ? (error?.message || "That signed flight is no longer active. Start a new flight.")
          : retryable
          ? (error?.message || "Flight saved. Reconnect to submit the result.")
          : `${error?.message || "The result was rejected."} Abandon this saved flight before starting another.`);
        renderLobby();
        return;
      }
    } else if (completed.mode === "ticketed" && completed.result?.rewardEligible) {
      const claimed = claimCircuitReward(local.claims, completed, {
        chosenBoost,
        crazyRewardChoice: chosenCrazyReward,
        verified: true,
        at: circuitNow()
      });
      if (claimed.claimed) {
        local.claims = claimed.claims;
        grant = claimed.grant;
        if (completed.path === "crazy" && grant.crazyRewardChoice === "daily") {
          const daily = grantCrazyPathDailyPowers(grant.stipend, circuitNow());
          local.crazyStipend = daily.stipend;
          grant = {
            ...grant,
            stipend: daily.stipend,
            boosts: daily.boosts,
            grantedDays: daily.grantedDays
          };
        }
        for (const boost of CIRCUIT_BOOSTS) {
          local.boosts[boost] = Math.min(BOOST_LIMIT, local.boosts[boost] + grant.boosts[boost]);
        }
        if (completed.path !== "crazy") {
          const progress = recordStarPathProgress(
            local.starPath,
            starPathCircuitXpEvent({
              ...result,
              milestone: grant.tier || result?.milestone,
              verified: true,
              rewardEligible: true
            })
          );
          local.starPath = progress.state;
          grant = {
            ...grant,
            starPathXp: progress.xpAwarded,
            starPathBaseXp: progress.baseXpAwarded,
            starPathWeeklyBonusXp: progress.weeklyBonusXpAwarded
          };
        }
      }
    }
    submitting = false;
    run = completed;
    active = null;
    local.active = null;
    recordLiveOps(completed);
    save();
    releaseStorageLease();
    renderResult(result, grant);
    updateMenuStatus();
    audio?.playResult?.({ reward: Boolean(grant) });
    track("cosmos_circuit_completed", {
      mode: completed.mode,
      path: completed.path,
      milestone: result?.milestone || "none",
      reward: Boolean(grant)
    });
  }

  function advance(event) {
    const completedSegment = course.segments[run?.cursor || 0];
    const outcome = advanceCircuitRun(run, event);
    if (!outcome.advanced) {
      toast("The course checkpoint could not be recorded.");
      return;
    }
    run = outcome.run;
    active.run = run;
    queuedUse = "";
    segmentProgressMs = 0;
    segmentWallMs = 0;
    checkedDust = new Set();
    collectedDust = new Set();
    segmentSamples = [];
    lastSampleProgressMs = -1;
    captureTrajectorySample(true);
    save();
    const status = event.outcome === "perfect" ? "Perfect line."
      : event.outcome === "miss" ? "Checkpoint missed." : "Checkpoint clear.";
    byId("circuitFlightStatus").textContent = status;
    if (event.outcome === "perfect") audio?.playFeedback?.("place");
    else if (event.outcome === "miss") audio?.playFeedback?.("reject");
    if (run.path === "crazy" && completedSegment?.required && event.outcome === "miss") {
      const failed = finishCircuitRun(run, {
        reason: "crash",
        elapsedMs: event.elapsedMs
      });
      run = failed.run;
      active.run = run;
      byId("circuitFlightStatus").textContent =
        `Required checkpoint ${completedSegment.index + 1} missed. Crazy Path failed with zero reward.`;
      save();
      void completeRun();
      return;
    }
    if (outcome.complete) void completeRun();
    else {
      updateHud();
      syncTargetCue(true);
    }
  }

  function extractFlight() {
    updateExtractionPreview(true);
    if (!playing || paused || choosing || submitting
      || extractionPreview?.result?.rewardEligible !== true) return;
    const milestone = extractionPreview.result.milestone;
    const label = `${milestone[0].toUpperCase()}${milestone.slice(1)}`;
    const warning = `Finish this Reward Flight now and bank the fixed ${label} reward? The current unfinished checkpoint will not count.`;
    if (typeof globalThis.confirm === "function" && !globalThis.confirm(warning)) return;
    playing = false;
    cancelAnimationFrame(frame);
    run = extractionPreview.run;
    active.run = run;
    save();
    track("cosmos_circuit_extracted", {
      mode: run?.mode || "ticketed",
      path: run?.path || "standard",
      milestone
    });
    void completeRun();
  }

  function finishSegment() {
    const visual = currentVisual();
    if (!visual) return;
    captureTrajectorySample(true);
    const event = eventForSegment(visual);
    if (visual.segment.kind === "ability-gate" && event.outcome !== "miss") {
      askForAbility(event, visual.segment);
      return;
    }
    advance(event);
  }

  function tick(timestamp) {
    if (!playing) return;
    if (flightLeaseHeld && Date.now() - lastLeaseRenewalAt >= 5_000) {
      if (!acquireStorageLease({ hold: true })) {
        flightLeaseHeld = false;
        saveAndLeave({ close: false });
        toast("Another tab took control of this Circuit save. Flight paused to protect progress.");
        return;
      }
    }
    if ((paused || choosing) && timestamp - lastPausedDrawAt < 180) {
      frame = requestAnimationFrame(tick);
      return;
    }
    if (paused || choosing) lastPausedDrawAt = timestamp;
    const delta = Math.min(48, Math.max(0, timestamp - (lastFrameAt || timestamp)));
    lastFrameAt = timestamp;
    const reducedMotion = prefersReducedMotion();
    if (!paused && !choosing) {
      const shipBeforeInput = { ...ship };
      const speed = 0.00055 * delta;
      if (keys.has("arrowleft") || keys.has("a")) ship.x -= speed;
      if (keys.has("arrowright") || keys.has("d")) ship.x += speed;
      if (keys.has("arrowup") || keys.has("w")) ship.y -= speed;
      if (keys.has("arrowdown") || keys.has("s")) ship.y += speed;
      if (pointer) {
        ship.x += (pointer.x - ship.x) * Math.min(1, delta * 0.008);
        ship.y += (pointer.y - ship.y) * Math.min(1, delta * 0.008);
      }
      const visual = currentVisual();
      if (visual?.target.type === "blackHole") {
        ship.x += (visual.target.x - ship.x) * delta * 0.00008;
        ship.y += (visual.target.y - ship.y) * delta * 0.00008;
      }
      if (run?.path === "crazy") {
        const movementX = ship.x - shipBeforeInput.x;
        const movementY = ship.y - shipBeforeInput.y;
        const movement = Math.hypot(movementX, movementY);
        const maximumMovement = delta * 0.0007;
        if (movement > maximumMovement && movement > 0) {
          ship.x = shipBeforeInput.x + movementX * (maximumMovement / movement);
          ship.y = shipBeforeInput.y + movementY * (maximumMovement / movement);
        }
      }
      ship.x = clamp(ship.x, 0.04, 0.96);
      ship.y = clamp(ship.y, 0.06, 0.94);
      segmentWallMs += delta;
      segmentProgressMs += delta * (queuedUse === "timeWarp" ? 0.58 : 1);
      captureTrajectorySample();
      if (visual) evaluateDust(visual);
      const renderFrame = !reducedMotion || timestamp - lastReducedMotionDrawAt >= 80;
      if (renderFrame) {
        lastReducedMotionDrawAt = timestamp;
        updateHud();
      }
      if (visual && segmentProgressMs >= visual.segment.durationMs) finishSegment();
      if (renderFrame) draw();
    } else {
      draw();
    }
    frame = requestAnimationFrame(tick);
  }

  async function countdown(generation) {
    const count = byId("circuitCountdown");
    byId("circuitFlightStatus").textContent = copy("flight.countdown");
    for (const value of ["3", "2", "1", "GO"]) {
      if (generation !== flightGeneration) return false;
      count.textContent = value;
      count.hidden = false;
      await new Promise((resolve) => setTimeout(resolve, value === "GO" ? 300 : 520));
    }
    if (generation !== flightGeneration) return false;
    count.hidden = true;
    return true;
  }

  async function enterFlight() {
    if (!run) return;
    const generation = ++flightGeneration;
    setGuide("circuit", false);
    byId("circuitLobby").hidden = true;
    byId("circuitResult").hidden = true;
    byId("circuitFlight").hidden = false;
    byId("circuitAbilityChoice").hidden = true;
    previousMode = run.mode;
    previousPath = run.path;
    const riskBanner = byId("circuitFlightRiskBanner");
    if (riskBanner) riskBanner.hidden = run.path !== "crazy";
    ship = { x: 0.5, y: 0.5 };
    queuedUse = "";
    segmentProgressMs = 0;
    segmentWallMs = 0;
    segmentSamples = [];
    lastSampleProgressMs = -1;
    lastPausedDrawAt = 0;
    lastReducedMotionDrawAt = 0;
    lastAudioIntensity = -1;
    lastNavigationAnnouncement = "";
    lastNavigationAnnouncedAt = 0;
    pendingNavigationAnnouncement = "";
    pendingNavigationSince = 0;
    captureTrajectorySample(true);
    paused = false;
    choosing = false;
    playing = false;
    updateHud();
    draw();
    audio?.setScene?.("run");
    audio?.playFeedback?.("runStart");
    const countdownComplete = await countdown(generation);
    if (!countdownComplete
      || generation !== flightGeneration
      || !dialog?.open
      || run?.status !== "active"
      || byId("circuitFlight")?.hidden) {
      byId("circuitCountdown").hidden = true;
      return;
    }
    playing = true;
    const initialTarget = byId("circuitTargetCue")?.textContent || "";
    byId("circuitFlightStatus").textContent = copy("flight.started", { target: initialTarget });
    lastNavigationAnnouncement = initialTarget;
    lastNavigationAnnouncedAt = globalThis.performance?.now?.() ?? Date.now();
    lastFrameAt = performance.now();
    frame = requestAnimationFrame(tick);
    byId("pauseCircuitFlight").textContent = "Pause";
    canvas?.focus();
  }

  async function start(mode, path = "standard") {
    if (byId("circuitGuide")?.hidden === false) {
      setGuide("circuit", false, { remember: true });
      track("cosmos_circuit_tutorial_completed");
    }
    if (active?.run?.status === "finished") {
      if (active.submissionRejected) {
        toast("This result was rejected permanently. Abandon the saved flight before starting another.");
        return;
      }
      if (!acquireFlightLease()) return;
      run = active.run;
      course = run.path === "crazy"
        ? cosmosCircuitCrazyCourse(run.courseDayKey)
        : cosmosCircuitCourse(run.courseDayKey);
      return completeRun(active.chosenRewardBoost || "", active.chosenCrazyReward || "");
    }
    if (active?.run?.status === "active") {
      if (!acquireFlightLease()) return;
      run = active.run;
      course = run.path === "crazy"
        ? cosmosCircuitCrazyCourse(run.courseDayKey)
        : cosmosCircuitCourse(run.courseDayKey);
      return enterFlight();
    }
    if (!acquireFlightLease()) return;
    path = mode === "ticketed" && path === "crazy" ? "crazy" : "standard";
    course = path === "crazy" ? cosmosCircuitCrazyCourse(circuitNow()) : cosmosCircuitCourse(circuitNow());
    const practiceBoost = mode === "practice" ? selectedBoost : "";
    if (practiceBoost && boosts()[practiceBoost] < 1) {
      selectedBoost = "";
      renderLobby();
      toast("That Practice boost is no longer available.");
      releaseStorageLease();
      return;
    }
    if (online && connected && typeof request === "function") {
      try {
        const startKey = identifier("start");
        const payload = await request("/api/circuit/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, path, idempotencyKey: startKey, practiceBoost })
        });
        remoteCircuit = payload.circuit;
        const attempt = remoteCircuit?.activeAttempt;
        if (!attempt?.run) throw new Error("The signed flight did not arrive.");
        course = attempt.course || (attempt.run.path === "crazy"
          ? cosmosCircuitCrazyCourse(attempt.run.courseDayKey)
          : cosmosCircuitCourse(attempt.run.courseDayKey));
        active = {
          run: attempt.run,
          attemptToken: attempt.attemptToken,
          telemetrySeed: attempt.telemetrySeed || "",
          startKey,
          submitKey: identifier("submit"),
          abandonKey: identifier("abandon"),
          chosenRewardBoost: "",
          chosenCrazyReward: "",
          submissionRejected: false,
          server: true
        };
        run = attempt.run;
      } catch (error) {
        releaseStorageLease();
        toast(error?.message || (path === "crazy"
          ? "The Crazy Path could not launch."
          : "The Reward Flight could not launch."));
        await refresh();
        return;
      }
    } else {
      if (mode === "ticketed" && online) {
        toast("Reconnect for a verified Reward Flight. Practice remains unlimited.");
        releaseStorageLease();
        return;
      }
      const started = startCircuitRun({
        course,
        mode,
        path,
        wallet: local.wallet,
        claims: local.claims,
        crazyStipend: local.crazyStipend,
        runId: identifier("circuit"),
        practiceBoost
      });
      if (!started.started) {
        const message = {
          cosmos_qualification_required: "Complete a Cosmos-tier standard Reward Flight this UTC week first.",
          route_rank_required: "Reach Gold route rank before entering Crazy Path.",
          weekly_attempt_used: "This UTC week’s Crazy Path attempt is already spent.",
          victory_cooldown: "Crazy Path is in its 30-day victory cooldown.",
          launch_passes_required: "Crazy Path requires three earned Launch Passes.",
          no_launch_pass: path === "crazy"
            ? "Crazy Path requires three earned Launch Passes."
            : "Earn a Launch Pass or choose unlimited Practice."
        }[started.reason];
        toast(message || "The flight could not start.");
        releaseStorageLease();
        return;
      }
      local.wallet = started.wallet;
      local.claims = started.claims;
      if (practiceBoost) local.boosts[practiceBoost] = Math.max(0, local.boosts[practiceBoost] - 1);
      run = started.run;
      active = {
        run,
          attemptToken: "",
          telemetrySeed: "",
        startKey: identifier("start"),
        submitKey: identifier("submit"),
        abandonKey: identifier("abandon"),
          chosenRewardBoost: "",
          chosenCrazyReward: "",
          submissionRejected: false,
          server: false
      };
    }
    if (practiceBoost) selectedBoost = "";
    local.active = active;
    save();
    renderLobby();
    track("cosmos_circuit_started", { mode, path, practiceBoost: Boolean(practiceBoost) });
    return enterFlight();
  }

  function renderResult(result, grant) {
    const metrics = run?.metrics || {};
    const milestone = result?.milestone || "none";
    const crazyPath = run?.path === "crazy";
    const gateGoal = course.segments.filter((segment) => segment.kind === "planet-gate").length;
    const tunnelGoal = course.segments.filter((segment) => segment.kind === "black-hole").length;
    byId("circuitLobby").hidden = true;
    byId("circuitFlight").hidden = true;
    byId("circuitResult").hidden = false;
    byId("circuitResultEyebrow").textContent = crazyPath
      ? grant ? "CRAZY PATH CONQUERED" : "CRAZY PATH FAILED · ZERO REWARD"
      : run?.mode === "practice"
        ? "PRACTICE COMPLETE · NO MATERIAL REWARD"
        : "VERIFIED REWARD FLIGHT";
    byId("circuitResultTitle").textContent = crazyPath
      ? grant ? "The singularity broke first" : "The route collapsed"
      : milestone === "none"
        ? "Course logged" : `${milestone[0].toUpperCase()}${milestone.slice(1)} flight`;
    byId("circuitResultSummary").textContent =
      crazyPath && !grant
        ? `${metrics.requiredCheckpointsCleared || 0} of ${metrics.requiredCheckpoints || 0} required checkpoints cleared. Three passes and this week’s attempt were consumed.`
        : `${metrics.sectorsCleared || 0} sectors · ${metrics.stardustPercent || 0}% Stardust · ${metrics.shieldIntact ? "shield intact" : "shield depleted"}.`;
    byId("circuitResultGates").textContent = `${metrics.planetGatesPassed || 0} / ${gateGoal}`;
    byId("circuitResultTunnels").textContent = `${metrics.blackHolesCleared || 0} / ${tunnelGoal}`;
    byId("circuitResultFlow").textContent = String(metrics.score || 0);
    const reward = byId("circuitResultReward");
    reward.hidden = false;
    delete reward.dataset.disclosureKey;
    delete reward.dataset.repeatAdjusted;
    byId("circuitRewardChoice").hidden = true;
    byId("crazyRewardChoice").hidden = true;
    byId("circuitResultActions").hidden = false;
    byId("retryCircuitFlight").hidden = crazyPath;
    if (!grant) {
      reward.innerHTML = crazyPath
        ? "<small>ALL OR NOTHING</small><strong>No powers or Path XP awarded</strong><span>No partial milestone, extraction reward, weekly progress, or refund applies.</span>"
        : run?.mode === "practice"
          ? "<small>REWARD</small><strong>Practice flight · no material reward</strong><span>Use Practice to learn the exact course freely.</span>"
          : "<small>REWARD</small><strong>No milestone reward earned</strong><span>Your Launch Pass was used when this verified flight began.</span>";
    } else {
      const payout = CIRCUIT_BOOSTS.filter((boost) => grant.boosts?.[boost])
        .map((boost) => `${grant.boosts[boost]} ${LABELS[boost]}`).join(" · ");
      if (grant.tier === "crazy") {
        const daily = crazyPathRewardOptions().find((option) => option.id === "daily");
        const instant = crazyPathRewardOptions().find((option) => option.id === "instant");
        reward.innerHTML = grant.crazyRewardChoice === "daily"
          ? `<small>THIRTY-DAY SUPPLY STARTED</small><strong>${safeText(payout)}</strong><span>${daily?.eachPerGrant || CRAZY_PATH_DAILY_POWERS} of each credited per UTC day for ${daily?.grantDays || CRAZY_PATH_DAILY_DAYS} days · ${daily?.totalPerBoost || (CRAZY_PATH_DAILY_POWERS * CRAZY_PATH_DAILY_DAYS)} of each total · elapsed days accrue.</span>`
          : `<small>IMMEDIATE CACHE</small><strong>${safeText(payout)}</strong><span>${instant?.totalPerBoost || CRAZY_PATH_INSTANT_POWERS} of every Practice power added now · no Path XP.</span>`;
        byId("circuitResultTitle")?.focus();
        return;
      }
      const baseXp = Math.max(0, Number(grant.starPathBaseXp ?? grant.starPathXp) || 0);
      const weeklyXp = Math.max(0, Number(grant.starPathWeeklyBonusXp) || 0);
      const xpLabel = weeklyXp
        ? `+${baseXp} base Path XP · +${weeklyXp} weekly catch-up XP`
        : `+${baseXp} base Path XP`;
      const disclosureKey = String(grant.disclosureKey || (
        grant.milestone === "cosmos"
          ? grant.firstCosmosOfWeek
            ? "circuit.reward.cosmos.first"
            : "circuit.reward.cosmos.repeat"
          : `circuit.reward.${grant.tier}`
      ));
      const disclosure = copy(disclosureKey);
      reward.dataset.disclosureKey = disclosureKey;
      reward.dataset.repeatAdjusted = String(grant.repeatAdjusted === true
        || (grant.milestone === "cosmos" && !grant.firstCosmosOfWeek));
      reward.innerHTML = `<small>FIXED ${safeText(grant.tier)} REWARD</small><strong>${safeText(payout)}</strong><span>${safeText(disclosure)} ${safeText(xpLabel)} · Practice-only powers</span>`;
    }
    byId("circuitResultTitle")?.focus();
  }

  function pause(toggle = !paused) {
    if (!playing || choosing) return;
    paused = Boolean(toggle);
    byId("pauseCircuitFlight").textContent = paused ? "Resume" : "Pause";
    byId("circuitFlightStatus").textContent = paused ? "Flight paused." : "Flight resumed.";
    updateExtractionPreview();
    audio?.setSuspended?.(paused);
    if (!paused) requestAnimationFrame(() => canvas?.focus());
  }

  function saveAndLeave({ close = true } = {}) {
    flightGeneration += 1;
    setCrazyConfirmation(false);
    if (run?.status === "active") {
      paused = true;
      playing = false;
      cancelAnimationFrame(frame);
      const persisted = save();
      toast(persisted
        ? "Flight saved at the last cleared checkpoint."
        : "Flight is held for this session only. Local storage is unavailable; export a backup before leaving.");
    }
    releaseStorageLease();
    renderLobby();
    if (close && dialog?.open) dialog.close();
    lastAudioIntensity = 0;
    audio?.setIntensity?.(0);
    audio?.setSuspended?.(false);
    audio?.setScene?.("menu");
    restoreSoundTheme();
  }

  function localDataPayload({ includeActive = true } = {}) {
    return {
      version: 1,
      wallet: sanitizeCircuitWallet(local.wallet),
      claims: sanitizeCircuitClaims(local.claims),
      boosts: emptyBoosts(local.boosts),
      crazyStipend: sanitizeCrazyPathStipend(local.crazyStipend),
      starPath: sanitizeStarPathState(local.starPath),
      starRewards: sanitizeRewardIds(local.starRewards),
      featuredRewardId: sanitizeFeaturedRewardId(local.featuredRewardId),
      onboarding: {
        circuitSeen: local.onboarding?.circuitSeen === true,
        starPathSeen: local.onboarding?.starPathSeen === true
      },
      weekly: sanitizeCircuitWeeklyState(local.weekly),
      records: sanitizePersonalCircuitBoard(local.records),
      active: includeActive && active ? {
        snapshot: createCircuitSnapshot(run),
        mode: run?.mode || "",
        server: Boolean(active.server)
      } : null
    };
  }

  function exportCircuitBackup() {
    const persisted = save();
    const payload = {
      schema: "constellore-cosmos-circuit-local-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      cloudSync: false,
      cosmosCircuit: localDataPayload({ includeActive: false })
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
    const url = globalThis.URL?.createObjectURL?.(blob);
    const status = byId("circuitBackupStatus");
    if (!url) {
      if (status) status.textContent = "This browser could not create the backup download.";
      return false;
    }
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `constellore-circuit-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    globalThis.setTimeout?.(() => globalThis.URL.revokeObjectURL?.(url), 0);
    if (status) status.textContent = persisted
      ? "Local Circuit backup exported. Active flights are intentionally excluded."
      : "Session data exported. Local storage is unavailable, so keep this file before leaving.";
    toast("Circuit backup downloaded. No cloud service was used.");
    return true;
  }

  async function importCircuitBackupFile(file) {
    const status = byId("circuitBackupStatus");
    if (!file) return false;
    if (active?.run) {
      if (status) status.textContent = "Finish or abandon the saved flight before importing a backup.";
      toast("A backup cannot replace data while a flight is active.");
      return false;
    }
    if (Number(file.size) > 1_000_000) {
      if (status) status.textContent = "That file is too large to be a Circuit backup.";
      return false;
    }
    try {
      const parsed = JSON.parse(await file.text());
      const manualEnvelope = parsed?.schema === "constellore-cosmos-circuit-local-backup"
        && parsed?.version === 1
        && parsed?.cloudSync === false;
      const localSaveEnvelope = parsed?.version === 2
        && Number.isFinite(Date.parse(parsed?.exportedAt || ""))
        && parsed?.profile && typeof parsed.profile === "object"
        && parsed?.cosmosCircuit && typeof parsed.cosmosCircuit === "object";
      const source = manualEnvelope || localSaveEnvelope ? parsed.cosmosCircuit : parsed;
      const requiredKeys = [
        "version", "wallet", "claims", "boosts", "starPath", "starRewards",
        "onboarding", "weekly", "records"
      ];
      if (!source
        || typeof source !== "object"
        || Array.isArray(source)
        || source.version !== 1
        || !requiredKeys.every((key) => Object.hasOwn(source, key))) {
        throw new Error("invalid");
      }
      const starRewards = sanitizeRewardIds(source.starRewards)
        .filter((id) => !online || Boolean(circuitWeeklyRewardById(id)));
      const featuredRewardId = sanitizeFeaturedRewardId(source.featuredRewardId);
      const candidate = {
        wallet: grantDailyLaunchPasses(sanitizeCircuitWallet(source.wallet)).wallet,
        claims: sanitizeCircuitClaims(source.claims),
        boosts: emptyBoosts(source.boosts),
        crazyStipend: online
          ? sanitizeCrazyPathStipend(null)
          : sanitizeCrazyPathStipend(source.crazyStipend),
        starPath: sanitizeStarPathState(source.starPath),
        starRewards,
        featuredRewardId: starRewards.includes(featuredRewardId) ? featuredRewardId : "",
        onboarding: {
          circuitSeen: source.onboarding?.circuitSeen === true,
          starPathSeen: source.onboarding?.starPathSeen === true
        },
        weekly: sanitizeCircuitWeeklyState(source.weekly),
        records: sanitizePersonalCircuitBoard(source.records),
        active: null
      };
      if (typeof globalThis.confirm === "function"
        && !globalThis.confirm("Replace this device’s local Circuit data with the selected backup? Active flights are never imported.")) {
        if (status) status.textContent = "Circuit backup import cancelled.";
        return false;
      }
      local = candidate;
      active = null;
      run = null;
      const persisted = save();
      renderLobby();
      renderStarPath();
      if (status) status.textContent = persisted
        ? "Local Circuit backup restored. Active or signed flights were not imported."
        : "Backup restored for this session, but local storage is unavailable.";
      toast(persisted ? "Circuit backup restored locally." : "Circuit backup restored for this session.");
      return true;
    } catch {
      if (status) status.textContent = "That JSON file is not a valid Circuit backup.";
      return false;
    }
  }

  async function abandonSavedFlight() {
    if (!active?.run || submitting) return;
    if (!acquireFlightLease()) return;
    const ticketed = active.run.mode === "ticketed";
    const crazyPath = active.run.path === "crazy";
    const warning = crazyPath
      ? "Abandon this Crazy Path? Three Launch Passes and this UTC week’s attempt are already spent. No reward or refund will be granted."
      : ticketed
      ? "Abandon this Reward Flight? Its Launch Pass has already been used and will not be refunded."
      : "Abandon this saved Practice Flight?";
    if (typeof globalThis.confirm === "function" && !globalThis.confirm(warning)) return;
    if (active.server && (!connected || typeof request !== "function")) {
      toast("Reconnect before abandoning this signed flight.");
      return;
    }
    playing = false;
    cancelAnimationFrame(frame);
    active.abandonKey ||= identifier("abandon");
    save();
    if (active.server) {
      try {
        const payload = await request("/api/circuit/abandon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId: active.run.id,
            attemptToken: active.attemptToken,
            idempotencyKey: active.abandonKey
          })
        });
        remoteCircuit = payload.circuit || remoteCircuit;
        remoteStarPath = payload.starPath || remoteStarPath;
      } catch (error) {
        save();
        releaseStorageLease();
        toast(error?.message || "The saved flight could not be abandoned.");
        return;
      }
    } else {
      finishCircuitRun(active.run, {
        reason: "withdraw",
        elapsedMs: active.run.events.at(-1)?.elapsedMs || 0
      });
    }
    flightGeneration += 1;
    active = null;
    run = null;
    local.active = null;
    save();
    releaseStorageLease();
    renderLobby();
    toast(crazyPath
      ? "Crazy Path abandoned. No reward or refund was granted."
      : ticketed
        ? "Reward Flight abandoned. The spent Launch Pass was not refunded."
      : "Practice Flight abandoned.");
    track("cosmos_circuit_abandoned", {
      mode: ticketed ? "ticketed" : "practice",
      path: crazyPath ? "crazy" : "standard"
    });
  }

  function activatePower() {
    if (!run || paused || choosing || queuedUse) return;
    const power = byId("activateCircuitPower")?.dataset.power;
    if (!CIRCUIT_BOOSTS.includes(power) || powers()[power] < 1) return;
    queuedUse = power;
    audio?.playFeedback?.("sense");
    byId("circuitFlightStatus").textContent = `${LABELS[power]} armed for this checkpoint.`;
    syncPowerButton();
  }

  function chooseAbility(boost) {
    if (!pendingEvent || !CIRCUIT_BOOSTS.includes(boost)) return;
    pendingEvent.ability = boost;
    const event = pendingEvent;
    pendingEvent = null;
    choosing = false;
    paused = false;
    byId("circuitAbilityChoice").hidden = true;
    advance(event);
  }

  function localStarPresentation() {
    const progress = starPathProgress(local.starPath);
    const catalog = starPathCatalog();
    return { ...progress, catalog, rewards: local.starRewards, supporterAccess: supporter() };
  }

  function renderStarPath() {
    const presentation = online && connected && remoteStarPath ? remoteStarPath : localStarPresentation();
    const catalog = presentation.catalog?.tiers
      ? presentation.catalog
      : starPathCatalog();
    const season = presentation.season || catalog.season;
    const currentTier = Math.min(12, (presentation.reachedTier || 0) + 1);
    const next = catalog.tiers[currentTier - 1] || catalog.tiers.at(-1);
    byId("starPathSeason").textContent = `SEASON ${String(Math.max(1, season?.number || 1)).padStart(2, "0")} · 8 WEEKS`;
    byId("starPathTitle").textContent = season?.title || "Star Path";
    byId("starPathIntro").textContent = season?.description || "Complete eligible routes and Circuit milestones to chart the season.";
    byId("starPathLevel").textContent = String(Math.max(1, currentTier));
    byId("starPathXp").textContent = presentation.complete
      ? `${presentation.xp} XP · COMPLETE`
      : `${presentation.xp || 0} / ${next?.xpRequired || 0} XP`;
    const percent = presentation.complete ? 100 : presentation.percentToNext || 0;
    byId("starPathProgressBar").style.width = `${percent}%`;
    byId("starPathProgressBar").parentElement?.setAttribute("aria-valuenow", String(percent));
    const claimed = presentation.claimed || { free: [], supporter: [] };
    const supporterAccess = Boolean(presentation.supporterAccess ?? supporter());
    const claimableCount = (presentation.claimable?.free?.length || 0)
      + (supporterAccess ? presentation.claimable?.supporter?.length || 0 : 0);
    const claimAllButton = byId("claimAllStarPathRewards");
    if (claimAllButton) {
      const reconnectRequired = online && !connected;
      claimAllButton.disabled = reconnectRequired || claimableCount === 0;
      claimAllButton.textContent = reconnectRequired && claimableCount
        ? `Reconnect to claim ${claimableCount}`
        : claimableCount
          ? `Claim all ${claimableCount} available`
          : "All available rewards claimed";
      claimAllButton.dataset.claimableCount = String(claimableCount);
    }
    byId("starPathTrack").innerHTML = catalog.tiers.map((tier) => {
      const cards = ["free", "supporter"].map((trackName) => {
        const reward = tier.rewards[trackName];
        const isClaimed = claimed[trackName]?.includes(tier.tier);
        const locked = (presentation.xp || 0) < tier.xpRequired;
        const gated = trackName === "supporter" && !supporterAccess;
        const label = isClaimed ? "Claimed" : gated ? "Supporter" : locked ? `${tier.xpRequired} XP` : "Claim";
        return `<div class="star-path-reward ${trackName} ${isClaimed ? "is-claimed" : ""} ${locked || gated ? "is-locked" : ""}">
          <span aria-hidden="true">${trackName === "supporter" ? "✦" : "◇"}</span>
          <div><strong>${safeText(reward.label)}</strong><small>${trackName} · ${safeText(reward.kind)}</small></div>
          <button type="button" data-star-claim="${trackName}" data-tier="${tier.tier}" ${isClaimed || locked || gated ? "disabled" : ""}>${label}</button>
        </div>`;
      }).join("");
      return `<li class="${tier.tier <= (presentation.reachedTier || 0) ? "reached" : ""}">
        <b class="star-path-tier-number">${String(tier.tier).padStart(2, "0")}</b>${cards}
      </li>`;
    }).join("");
    byId("starPathStatus").textContent = [
      starPathAnnouncement,
      `Every reward is exact and cosmetic-only. Base XP is capped at ${STAR_PATH_XP_RULES.dailyBaseXpCap} per UTC day; the first eligible event each UTC week includes ${STAR_PATH_XP_RULES.weeklyParticipationBonus.xp} catch-up XP.`
    ].filter(Boolean).join(" ");
    renderSeasonLocker();
    updateMenuStatus();
  }

  async function claimPath(trackName, tier) {
    if (online && connected && typeof request === "function") {
      try {
        const payload = await request("/api/star-path/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ track: trackName, tier })
        });
        remoteStarPath = payload.starPath || remoteStarPath;
        save();
        toast(payload.duplicate ? "That cosmetic was already claimed." : `${payload.reward?.label || "Cosmetic"} claimed.`);
      } catch (error) {
        toast(error?.message || "That Star Path reward could not be claimed.");
      }
    } else {
      const claim = claimStarPathReward(local.starPath, {
        track: trackName,
        tier,
        supporterAccess: supporter()
      });
      if (!claim.claimed) {
        toast(claim.reason === "supporter_required" ? "The Supporter lane requires the cosmetic Supporter Pack." : "That reward is not ready yet.");
        return;
      }
      local.starPath = claim.state;
      local.starRewards = sanitizeRewardIds([...local.starRewards, claim.reward.id]);
      const persisted = save();
      toast(persisted
        ? `${claim.reward.label} claimed.`
        : `${claim.reward.label} is available for this session. Local storage is unavailable; export a backup before leaving.`);
    }
    renderStarPath();
    track("star_path_reward_claimed", { track: trackName, tier });
  }

  async function claimAllPathRewards() {
    if (claimingStarPath) {
      return { claimed: false, count: 0, reason: "claim_in_progress" };
    }
    if (online && (!connected || typeof request !== "function")) {
      const supporterAccess = Boolean(remoteStarPath?.supporterAccess ?? supporter());
      const availableCount = (remoteStarPath?.claimable?.free?.length || 0)
        + (supporterAccess ? remoteStarPath?.claimable?.supporter?.length || 0 : 0);
      starPathAnnouncement = availableCount
        ? `${availableCount} reward${availableCount === 1 ? " is" : "s are"} ready. Reconnect to claim them.`
        : "Reconnect to check and claim available Star Path rewards.";
      renderStarPath();
      return { claimed: false, count: 0, availableCount, reason: "reconnect_required" };
    }
    const at = circuitNow();
    const presentation = online && connected && remoteStarPath
      ? remoteStarPath
      : localStarPresentation();
    const supporterAccess = Boolean(presentation.supporterAccess ?? supporter());
    const source = online && connected
      ? {
          version: presentation.version,
          seasonId: presentation.season?.id,
          xp: presentation.xp,
          claimed: presentation.claimed
        }
      : local.starPath;
    const preview = claimAllStarPathRewardsDomain(source, { supporterAccess }, at);
    if (!preview.claimed) {
      starPathAnnouncement = "No Star Path rewards are available to claim.";
      renderStarPath();
      return preview;
    }
    claimingStarPath = true;
    const button = byId("claimAllStarPathRewards");
    if (button) {
      button.disabled = true;
      button.textContent = `Claiming ${preview.count}…`;
    }
    try {
      if (online) {
        const free = new Set(preview.claimedTiers.free);
        const supporterTiers = new Set(preview.claimedTiers.supporter);
        const plan = [];
        for (let tier = 1; tier <= 12; tier += 1) {
          if (free.has(tier)) plan.push({ track: "free", tier });
          if (supporterTiers.has(tier)) plan.push({ track: "supporter", tier });
        }
        let count = 0;
        for (const claim of plan) {
          try {
            const payload = await request("/api/star-path/claim", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(claim)
            });
            remoteStarPath = payload.starPath || remoteStarPath;
            if (payload.claimed === true && payload.duplicate !== true) count += 1;
          } catch (error) {
            starPathAnnouncement = count
              ? `Claimed ${count} of ${preview.count} available rewards before the connection was interrupted.`
              : `${preview.count} rewards remain ready. Reconnect to claim them.`;
            renderStarPath();
            toast(starPathAnnouncement);
            return {
              ...preview,
              claimed: count > 0,
              count,
              reason: count ? "partial_claim" : "claim_failed",
              error: error?.message || "claim_failed"
            };
          }
        }
        starPathAnnouncement = `Claimed ${count} Star Path reward${count === 1 ? "" : "s"}.`;
        renderStarPath();
        toast(starPathAnnouncement);
        track("star_path_rewards_claimed_all", { count, supporterAccess });
        return { ...preview, claimed: count > 0, count, reason: count ? "rewards_claimed" : "nothing_claimable" };
      }

      local.starPath = preview.state;
      local.starRewards = sanitizeRewardIds([
        ...local.starRewards,
        ...preview.rewards.free.map((reward) => reward.id),
        ...preview.rewards.supporter.map((reward) => reward.id)
      ]);
      const persisted = save();
      starPathAnnouncement = `Claimed ${preview.count} Star Path reward${preview.count === 1 ? "" : "s"}${persisted ? "." : " for this session."}`;
      renderStarPath();
      toast(starPathAnnouncement);
      track("star_path_rewards_claimed_all", { count: preview.count, supporterAccess });
      return preview;
    } finally {
      claimingStarPath = false;
    }
  }

  function recordWordWin(result = {}) {
    if (online) return refresh();
    const runId = String(result.runId || "");
    const win = recordEligiblePureWin(local.wallet, {
      winId: runId,
      mode: result.division || "pure",
      won: result.won ?? true,
      assisted: result.assisted ?? false,
      verified: result.verified ?? true
    });
    local.wallet = win.wallet;
    const xp = recordStarPathProgress(local.starPath, starPathWordWinXpEvent({
      resultId: runId,
      verified: result.verified ?? true,
      won: result.won ?? true,
      mode: result.mode,
      division: result.division || "pure",
      challengeId: result.challengeId || "",
      practice: result.practice ?? false
    }));
    local.starPath = xp.state;
    if (result.rankId) {
      local.wallet = grantRankLaunchPass(local.wallet, {
        rankId: result.rankId,
        verified: true
      }).wallet;
    }
    save();
    updateMenuStatus();
    return { launchPass: win, starPath: xp };
  }

  function showDialog(target) {
    if (!target?.open) target?.showModal?.();
  }

  function setCrazyConfirmation(visible, { restoreFocus = false } = {}) {
    const confirmation = byId("crazyPathConfirm");
    if (!confirmation) return;
    confirmation.hidden = !visible;
    for (const sibling of confirmation.parentElement?.children || []) {
      if (sibling !== confirmation) sibling.inert = visible;
    }
    if (visible) byId("cancelCrazyPath")?.focus();
    else if (restoreFocus) byId("startCircuitCrazy")?.focus();
  }

  function open(view = "circuit") {
    if (view === "path") {
      renderStarPath();
      showDialog(pathDialog);
      showFirstGuide("path");
      void refresh().then(renderStarPath);
      track("star_path_opened");
      return;
    }
    applyFeaturedAudio();
    lobbyTabs.select("fly");
    renderLobby();
    showDialog(dialog);
    showFirstGuide("circuit");
    void refresh();
    track("cosmos_circuit_opened");
  }

  listen(byId("startCircuitPractice"), "click", () => void start("practice"));
  listen(byId("startGuidedCircuitPractice"), "click", () => {
    setGuide("circuit", false, { remember: true });
    track("cosmos_circuit_tutorial_completed");
    void start("practice");
  });
  listen(byId("dismissCircuitGuide"), "click", () => {
    setGuide("circuit", false, { remember: true });
    track("cosmos_circuit_tutorial_completed");
    byId("startCircuitPractice")?.focus();
  });
  listen(byId("showCircuitGuide"), "click", () => {
    setGuide("circuit", true, { focus: true });
    track("cosmos_circuit_tutorial_viewed");
  });
  listen(byId("startCircuitReward"), "click", () => void start("ticketed"));
  listen(byId("startCircuitCrazy"), "click", () => {
    if (active?.run?.path === "crazy") void start("ticketed", "crazy");
    else setCrazyConfirmation(true);
  });
  listen(byId("cancelCrazyPath"), "click", () => setCrazyConfirmation(false, { restoreFocus: true }));
  listen(byId("confirmCrazyPath"), "click", () => {
    setCrazyConfirmation(false);
    void start("ticketed", "crazy");
  });
  listen(byId("abandonCircuitAttempt"), "click", () => void abandonSavedFlight());
  listen(byId("pauseCircuitFlight"), "click", () => pause());
  listen(byId("leaveCircuitFlight"), "click", () => saveAndLeave());
  listen(byId("activateCircuitPower"), "click", activatePower);
  listen(byId("extractCircuitFlight"), "click", extractFlight);
  listen(byId("returnCircuitLobby"), "click", () => {
    lobbyTabs.select("fly");
    renderLobby();
  });
  listen(byId("retryCircuitFlight"), "click", () => void start(previousMode, previousPath));
  listen(byId("closeCosmosCircuit"), "click", () => saveAndLeave());
  listen(byId("closeStarPath"), "click", () => {
    pathDialog?.close();
    restoreSoundTheme();
  });
  listen(byId("dismissStarPathGuide"), "click", () => {
    setGuide("path", false, { remember: true });
    track("star_path_tutorial_completed");
    byId("starPathTrack")?.querySelector("button:not(:disabled)")?.focus();
  });
  listen(byId("showStarPathGuide"), "click", () => {
    setGuide("path", true, { focus: true });
    track("star_path_tutorial_viewed");
  });
  listen(byId("circuitPracticeLoadout"), "click", (event) => {
    const button = event.target.closest("[data-practice-boost]");
    if (!button || button.disabled) return;
    selectedBoost = selectedBoost === button.dataset.practiceBoost ? "" : button.dataset.practiceBoost;
    renderLobby();
  });
  listen(byId("circuitAbilityChoice"), "click", (event) => {
    const button = event.target.closest("[data-circuit-ability]");
    if (button) chooseAbility(button.dataset.circuitAbility);
  });
  listen(byId("circuitRewardChoice"), "click", (event) => {
    const button = event.target.closest("[data-circuit-reward-boost]");
    if (!button || button.disabled) return;
    byId("circuitRewardChoice").querySelectorAll("button").forEach((candidate) => {
      candidate.disabled = true;
    });
    void completeRun(button.dataset.circuitRewardBoost);
  });
  listen(byId("crazyRewardChoice"), "change", (event) => {
    const input = event.target.closest("input[name=\"crazyReward\"]");
    if (!input || !CRAZY_PATH_REWARD_CHOICES.includes(input.value)) return;
    const option = crazyPathRewardOptions().find((candidate) => candidate.id === input.value);
    crazyRewardSelection = input.value;
    byId("confirmCrazyReward").disabled = false;
    byId("crazyRewardChoiceStatus").textContent = input.value === "instant"
      ? `Immediate Cache selected · ${option?.totalPerBoost || CRAZY_PATH_INSTANT_POWERS} of every Practice power will be added now.`
      : `Thirty-Day Supply selected · ${option?.eachPerGrant || CRAZY_PATH_DAILY_POWERS} of each for ${option?.grantDays || CRAZY_PATH_DAILY_DAYS} UTC days, ${option?.totalPerBoost || (CRAZY_PATH_DAILY_POWERS * CRAZY_PATH_DAILY_DAYS)} of each total; elapsed days accrue.`;
  });
  listen(byId("confirmCrazyReward"), "click", () => {
    if (!CRAZY_PATH_REWARD_CHOICES.includes(crazyRewardSelection)) return;
    byId("confirmCrazyReward").disabled = true;
    void completeRun("", crazyRewardSelection);
  });
  listen(byId("circuitWeeklyChallenges"), "click", (event) => {
    const button = event.target.closest("[data-circuit-weekly-claim]");
    if (button && !button.disabled) claimWeekly(button.dataset.circuitWeeklyClaim);
  });
  listen(byId("starPathTrack"), "click", (event) => {
    const button = event.target.closest("[data-star-claim]");
    if (button && !button.disabled) void claimPath(button.dataset.starClaim, Number(button.dataset.tier));
  });
  listen(byId("claimAllStarPathRewards"), "click", () => void claimAllPathRewards());
  listen(byId("starPathFeaturedReward"), "change", (event) => {
    const rewardId = sanitizeFeaturedRewardId(event.target.value);
    if (rewardId && !ownedRewardIds().includes(rewardId)) {
      renderSeasonLocker();
      return;
    }
    local.featuredRewardId = rewardId;
    const persisted = save();
    renderSeasonLocker();
    draw();
    const reward = featuredReward();
    const theme = remixTheme(reward);
    if (theme) audio?.preview?.(theme);
    else restoreSoundTheme();
    toast(reward
      ? `${reward.label} featured in Cosmos Circuit${persisted ? "." : " for this session."}`
      : "Default Circuit styling restored.");
  });
  listen(byId("exportCircuitBackup"), "click", exportCircuitBackup);
  listen(byId("importCircuitBackup"), "click", () => byId("importCircuitBackupFile")?.click());
  listen(byId("importCircuitBackupFile"), "change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    void importCircuitBackupFile(file);
  });
  listen(canvas, "pointermove", (event) => {
    const rectangle = canvas.getBoundingClientRect();
    pointer = {
      x: clamp((event.clientX - rectangle.left) / Math.max(1, rectangle.width)),
      y: clamp((event.clientY - rectangle.top) / Math.max(1, rectangle.height))
    };
  });
  listen(canvas, "pointerdown", (event) => {
    canvas.focus();
    canvas.setPointerCapture?.(event.pointerId);
    const rectangle = canvas.getBoundingClientRect();
    pointer = {
      x: clamp((event.clientX - rectangle.left) / Math.max(1, rectangle.width)),
      y: clamp((event.clientY - rectangle.top) / Math.max(1, rectangle.height))
    };
  });
  listen(canvas, "pointerup", () => { pointer = null; });
  listen(canvas, "pointercancel", () => { pointer = null; });
  listen(canvas, "pointerleave", () => { pointer = null; });
  listen(window, "keydown", (event) => {
    const crazyConfirmation = byId("crazyPathConfirm");
    if (crazyConfirmation?.hidden === false) {
      if (event.key === "Escape") {
        event.preventDefault();
        setCrazyConfirmation(false, { restoreFocus: true });
        return;
      }
      if (event.key === "Tab") {
        const focusable = [...crazyConfirmation.querySelectorAll("button:not(:disabled)")];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
    }
    if (!dialog?.open || byId("circuitFlight")?.hidden) return;
    if (event.target?.closest?.("button, input, select, textarea, summary, a[href], [contenteditable='true'], [role='button'], [role='slider']")) return;
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s", " "].includes(key)) {
      event.preventDefault();
      if (key === " ") activatePower();
      else keys.add(key);
    }
  });
  listen(window, "keyup", (event) => keys.delete(event.key.toLowerCase()));
  listen(document, "visibilitychange", () => {
    if (document.hidden && playing) pause(true);
    if (!document.hidden && (dialog?.open || pathDialog?.open)) void refresh();
  });
  listen(dialog, "cancel", (event) => {
    if (!byId("circuitFlight")?.hidden && run?.status === "active") {
      event.preventDefault();
      saveAndLeave();
    }
  });
  listen(dialog, "close", () => {
    flightGeneration += 1;
    playing = false;
    cancelAnimationFrame(frame);
    keys.clear();
    releaseStorageLease();
    setCrazyConfirmation(false);
    restoreSoundTheme();
  });

  rotationTimer = globalThis.setInterval?.(() => {
    const now = circuitNow();
    const dayKey = now.toISOString().slice(0, 10);
    if (dayKey !== observedUtcDay && !rolloverRefreshPending) {
      observedUtcDay = dayKey;
      rolloverRefreshPending = true;
      void Promise.resolve(refresh()).finally(() => { rolloverRefreshPending = false; });
    } else if (dialog?.open && byId("circuitLobby")?.hidden === false) {
      updateRotationClock(now);
    }
  }, 1_000) || 0;
  localizeSurface();
  renderLadder();
  renderLobby();
  announceDailyGrant(local.dailyGrant?.granted, circuitNow());
  renderPassStatus();
  updateMenuStatus();

  return {
    open,
    refresh,
    recordWordWin,
    claimAllStarPathRewards: claimAllPathRewards,
    exportLocalData() {
      save();
      return localDataPayload();
    },
    dispose() {
      flightGeneration += 1;
      playing = false;
      cancelAnimationFrame(frame);
      clearInterval(rotationTimer);
      releaseStorageLease();
      storageChannel?.close?.();
      lobbyTabs.destroy();
      restoreSoundTheme();
      abort.abort();
    }
  };
}
