import { feedbackCuePolicy, sanitizeFeedbackPreferences } from "./engagement-features.mjs?v=5.0.0-beta.4";
import { DEFAULT_COSMETIC_LOADOUT, cosmeticById, transformFeedbackAudio } from "./cosmetic-economy.mjs?v=5.0.0-beta.4";

const CUE_ORDER = Object.freeze([
  "place",
  "combineStart",
  "success",
  "reject",
  "twist",
  "target",
  "sense",
  "mastery",
  "ghostPass",
  "gateClose",
  "gateOpen",
  "runStart",
  "resultReveal",
  "homeReturn",
  "timerWarning",
  "timeout",
  "failure",
  "reward",
  "collectionUnlock",
  "rankPromotion",
  "earth",
  "water",
  "fire",
  "air"
]);
const CUE_SLOT_SECONDS = 1.4;
const MAX_SFX_VOICES = 6;
const PREVIEW_FADE_OUT_SECONDS = 0.18;
const PREVIEW_SILENT_GAP_SECONDS = 0.04;
const PREVIEW_FADE_IN_SECONDS = 0.34;
const SCENE_GAIN = Object.freeze({
  home: 1,
  run: 0.76,
  paused: 0.34,
  result: 0.62,
  silent: 0
});
const CATEGORY_TONE = Object.freeze({
  nature: Object.freeze({ rate: 0.965, filter: 2_350, pan: -0.05 }),
  force: Object.freeze({ rate: 1.045, filter: 5_900, pan: 0.08 }),
  life: Object.freeze({ rate: 1.015, filter: 3_850, pan: 0.03 }),
  structure: Object.freeze({ rate: 0.91, filter: 1_850, pan: -0.08 }),
  celestial: Object.freeze({ rate: 1.095, filter: 6_700, pan: 0.11 })
});
const STARTER_CUES = Object.freeze({ earth: "earth", water: "water", fire: "fire", air: "air" });
const CUE_MIX = Object.freeze({
  place: Object.freeze({ priority: 1, cooldown: 24 }),
  uiSelect: Object.freeze({ priority: 1, cooldown: 36 }),
  earth: Object.freeze({ priority: 2, cooldown: 60 }),
  water: Object.freeze({ priority: 2, cooldown: 60 }),
  fire: Object.freeze({ priority: 2, cooldown: 60 }),
  air: Object.freeze({ priority: 2, cooldown: 60 }),
  combineStart: Object.freeze({ priority: 2, cooldown: 70 }),
  ghostPass: Object.freeze({ priority: 2, cooldown: 420 }),
  success: Object.freeze({ priority: 3, cooldown: 100, group: "outcome" }),
  reject: Object.freeze({ priority: 3, cooldown: 110 }),
  gateClose: Object.freeze({ priority: 3, cooldown: 180, group: "transition" }),
  gateOpen: Object.freeze({ priority: 3, cooldown: 180, group: "transition" }),
  homeReturn: Object.freeze({ priority: 3, cooldown: 400, group: "transition" }),
  twist: Object.freeze({ priority: 4, cooldown: 180, group: "outcome" }),
  sense: Object.freeze({ priority: 4, cooldown: 300 }),
  mastery: Object.freeze({ priority: 4, cooldown: 420, group: "outcome" }),
  runStart: Object.freeze({ priority: 4, cooldown: 350, group: "transition" }),
  timerWarning: Object.freeze({ priority: 5, cooldown: 10_000, group: "warning" }),
  resultReveal: Object.freeze({ priority: 5, cooldown: 600, group: "transition" }),
  failure: Object.freeze({ priority: 6, cooldown: 800, group: "critical" }),
  reward: Object.freeze({ priority: 6, cooldown: 650, group: "progression" }),
  timeout: Object.freeze({ priority: 7, cooldown: 1_200, group: "critical" }),
  collectionUnlock: Object.freeze({ priority: 7, cooldown: 900, group: "progression" }),
  target: Object.freeze({ priority: 8, cooldown: 500, group: "outcome" }),
  rankPromotion: Object.freeze({ priority: 9, cooldown: 1_200, group: "progression" })
});
const MUSIC_DUCK = Object.freeze({
  target: Object.freeze({ amount: 0.48, hold: 720 }),
  timeout: Object.freeze({ amount: 0.50, hold: 640 }),
  failure: Object.freeze({ amount: 0.56, hold: 560 }),
  resultReveal: Object.freeze({ amount: 0.62, hold: 520 }),
  reward: Object.freeze({ amount: 0.64, hold: 460 }),
  collectionUnlock: Object.freeze({ amount: 0.52, hold: 760 }),
  rankPromotion: Object.freeze({ amount: 0.42, hold: 960 })
});

function audioAssetsFor(rawTheme) {
  const item = cosmeticById(rawTheme, "soundTheme")
    || cosmeticById(DEFAULT_COSMETIC_LOADOUT.soundTheme, "soundTheme");
  const soundtrack = item?.assets?.soundtrack;
  const gameplayPulse = item?.assets?.gameplayPulse;
  const sfxBank = item?.assets?.sfxBank;
  if (!soundtrack?.path || !sfxBank?.path) return null;
  return {
    id: item.id,
    title: String(soundtrack.title || item.label),
    soundtrack: resolveAudioAsset(soundtrack.path),
    gameplayPulse: resolveAudioAsset(gameplayPulse?.path),
    sfxBank: resolveAudioAsset(sfxBank.path),
    musicGain: Math.min(1, Math.max(0, Number(soundtrack.gain) || 0.46)),
    pulseGain: Math.min(1, Math.max(0, Number(gameplayPulse?.gain) || 0.38)),
    previewAt: Math.max(0, Number(soundtrack.previewAt) || 0)
  };
}

function resolveAudioAsset(rawPath) {
  const path = String(rawPath || "").trim();
  if (!/^audio\/[a-z0-9._/-]+$/i.test(path) || path.includes("..")) return "";
  return new URL(path, import.meta.url).href;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "").toLocaleLowerCase("en-US")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function safeContext() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    return new AudioContextClass();
  } catch {
    return null;
  }
}

function canVibrate() {
  return typeof globalThis.navigator?.vibrate === "function";
}

function safeMatchMedia(query) {
  try {
    return Boolean(globalThis.matchMedia?.(query)?.matches);
  } catch {
    return false;
  }
}

function saveDataEnabled() {
  const connection = globalThis.navigator?.connection || globalThis.navigator?.mozConnection || globalThis.navigator?.webkitConnection;
  return Boolean(connection?.saveData);
}

export function createAudioRuntime({
  getPreferences = () => ({}),
  getSoundTheme = () => DEFAULT_COSMETIC_LOADOUT.soundTheme
} = {}) {
  let context = null;
  let output = null;
  let sfxBus = null;
  let currentTheme = String(getSoundTheme() || DEFAULT_COSMETIC_LOADOUT.soundTheme);
  let scene = "home";
  let primed = false;
  let suspended = Boolean(globalThis.document?.hidden);
  let musicGeneration = 0;
  let currentMusic = null;
  let previewTimer = null;
  let previewTheme = "";
  let intensity = 0;
  let duckGeneration = 0;
  let duckTimer = null;
  let loadingMusic = null;
  let preparedMusic = null;
  let preparingMusic = null;
  let previewBufferState = null;
  let previewGeneration = 0;
  let progressionTimer = null;
  let pendingProgression = "";
  let playedProgressionPriority = 0;
  const sfxBuffers = new Map();
  const activeVoices = new Set();
  const lastCueAt = new Map();
  const auxiliaryChannels = new Set();

  function ensureGraph() {
    if (context) return context;
    context = safeContext();
    if (!context) return null;
    output = context.createDynamicsCompressor();
    output.threshold.setValueAtTime(-18, context.currentTime);
    output.knee.setValueAtTime(12, context.currentTime);
    output.ratio.setValueAtTime(5, context.currentTime);
    output.attack.setValueAtTime(0.004, context.currentTime);
    output.release.setValueAtTime(0.18, context.currentTime);
    output.connect(context.destination);
    sfxBus = context.createGain();
    sfxBus.gain.setValueAtTime(0.82, context.currentTime);
    sfxBus.connect(output);
    return context;
  }

  function preferences() {
    return sanitizeFeedbackPreferences(getPreferences());
  }

  function desiredAuxiliaryGain(channel) {
    const prefs = preferences();
    if (suspended || prefs.muted || prefs.volume <= 0) return 0;
    if (channel.kind === "music") {
      if (!prefs.music || prefs.musicVolume <= 0) return 0;
      return channel.level * prefs.volume * prefs.musicVolume;
    }
    if (!prefs.sound || prefs.sfxVolume <= 0) return 0;
    return channel.level * prefs.volume * prefs.sfxVolume;
  }

  function syncAuxiliaryChannel(channel, seconds = 0.08) {
    if (!context || channel.closed) return 0;
    const now = context.currentTime;
    const target = Math.max(0, Math.min(1, desiredAuxiliaryGain(channel)));
    channel.node.gain.cancelScheduledValues(now);
    channel.node.gain.setValueAtTime(channel.node.gain.value, now);
    if (suspended || seconds <= 0) channel.node.gain.setValueAtTime(target, now);
    else channel.node.gain.linearRampToValueAtTime(target, now + Math.max(0.01, seconds));
    return target;
  }

  function syncAuxiliaryChannels(seconds = 0.08) {
    for (const channel of auxiliaryChannels) syncAuxiliaryChannel(channel, seconds);
  }

  // Lazy presentation systems can share the authoritative AudioContext and
  // compressor without learning how profile preferences are stored. The
  // caller owns every node connected to `input`; this runtime owns only the
  // preference-aware channel gain and guarantees cleanup on dispose.
  function createAuxiliaryChannel({ kind = "effects", level = 1 } = {}) {
    const activeContext = ensureGraph();
    if (!activeContext || !output) return null;
    const normalizedKind = kind === "music" ? "music" : "effects";
    const node = activeContext.createGain();
    const channel = {
      closed: false,
      kind: normalizedKind,
      level: Math.max(0, Math.min(1, Number(level) || 0)),
      node
    };
    node.gain.setValueAtTime(0, activeContext.currentTime);
    node.connect(output);
    auxiliaryChannels.add(channel);
    syncAuxiliaryChannel(channel, 0.04);
    return Object.freeze({
      context: activeContext,
      input: node,
      kind: normalizedKind,
      setLevel(value, seconds = 0.08) {
        if (channel.closed) return 0;
        channel.level = Math.max(0, Math.min(1, Number(value) || 0));
        return syncAuxiliaryChannel(channel, seconds);
      },
      sync(seconds = 0.08) {
        return syncAuxiliaryChannel(channel, seconds);
      },
      close() {
        if (channel.closed) return false;
        channel.closed = true;
        auxiliaryChannels.delete(channel);
        try { node.disconnect(); } catch { /* Optional cleanup. */ }
        return true;
      }
    });
  }

  function desiredTheme() {
    return previewTheme || currentTheme || getSoundTheme();
  }

  function desiredMusicGain(theme = desiredTheme()) {
    const prefs = preferences();
    const assets = audioAssetsFor(theme);
    if (!prefs.music || prefs.muted || prefs.volume <= 0 || prefs.musicVolume <= 0 || suspended || !assets) return 0;
    return assets.musicGain * prefs.volume * prefs.musicVolume * (SCENE_GAIN[scene] ?? SCENE_GAIN.home);
  }

  function desiredPulseGain(theme = desiredTheme()) {
    const assets = audioAssetsFor(theme);
    if (!assets?.gameplayPulse || desiredMusicGain(theme) <= 0) return 0;
    if (previewTheme) return 0;
    const activity = scene === "run"
      ? 0.08 + 0.92 * (intensity ** 1.35)
      : 0;
    return assets.pulseGain * activity;
  }

  function setMusicGain(value, seconds = 0.32) {
    if (!currentMusic || !context) return;
    const now = context.currentTime;
    const gain = Math.min(1, Math.max(0, Number(value) || 0));
    currentMusic.gain.gain.cancelScheduledValues(now);
    currentMusic.gain.gain.setValueAtTime(currentMusic.gain.gain.value, now);
    currentMusic.gain.gain.linearRampToValueAtTime(gain, now + Math.max(0.01, seconds));
  }

  function setPulseGain(value = desiredPulseGain(), seconds = 0.5) {
    if (!currentMusic?.pulseGain || !context) return;
    const now = context.currentTime;
    const gain = Math.min(1, Math.max(0, Number(value) || 0));
    currentMusic.pulseGain.gain.cancelScheduledValues(now);
    currentMusic.pulseGain.gain.setValueAtTime(currentMusic.pulseGain.gain.value, now);
    currentMusic.pulseGain.gain.linearRampToValueAtTime(gain, now + Math.max(0.01, seconds));
  }

  function stopMusic(seconds = 0.38) {
    musicGeneration += 1;
    if (!currentMusic || !context) return;
    const music = currentMusic;
    currentMusic = null;
    const now = context.currentTime;
    music.gain.gain.cancelScheduledValues(now);
    music.gain.gain.setValueAtTime(music.gain.gain.value, now);
    music.gain.gain.linearRampToValueAtTime(0, now + seconds);
    setTimeout(() => {
      for (const source of music.sources) {
        try { source.stop(); } catch { /* A stopped source is already silent. */ }
        try { source.disconnect(); } catch { /* Optional cleanup. */ }
      }
      try { music.pulseGain?.disconnect(); } catch { /* Optional cleanup. */ }
      try { music.gain.disconnect(); } catch { /* Optional cleanup. */ }
    }, Math.ceil((seconds + 0.08) * 1000));
  }

  async function decode(path) {
    const activeContext = ensureGraph();
    if (!activeContext || !path) return null;
    const response = await fetch(path, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Audio asset unavailable (${response.status}).`);
    return activeContext.decodeAudioData(await response.arrayBuffer());
  }

  function decodeMusicAssets(assets, { preview = false } = {}) {
    return Promise.all([
      decode(assets.soundtrack),
      !preview && assets.gameplayPulse
        ? decode(assets.gameplayPulse).catch(() => null)
        : Promise.resolve(null)
    ]).then(([buffer, pulseBuffer]) => ({
      themeId: assets.id,
      buffer,
      pulseBuffer
    }));
  }

  function prepareMusic(theme = currentTheme) {
    const activeContext = ensureGraph();
    const assets = audioAssetsFor(theme);
    if (!activeContext || !assets) return Promise.resolve(null);
    if (preparedMusic?.themeId === assets.id) return Promise.resolve(preparedMusic);
    if (preparingMusic?.themeId === assets.id) return preparingMusic.promise;
    const state = {
      themeId: assets.id,
      promise: null
    };
    state.promise = decodeMusicAssets(assets)
      .then((decoded) => {
        if (preparingMusic === state || currentTheme === decoded.themeId) {
          preparedMusic = decoded;
        }
        return decoded;
      })
      .catch(() => null)
      .finally(() => {
        if (preparingMusic === state) preparingMusic = null;
      });
    preparingMusic = state;
    return state.promise;
  }

  function loadPreviewMusic(assets) {
    if (previewBufferState?.themeId === assets.id) return previewBufferState.promise;
    const state = {
      themeId: assets.id,
      promise: null
    };
    state.promise = decodeMusicAssets(assets, { preview: true })
      .catch(() => {
        if (previewBufferState === state) previewBufferState = null;
        return null;
      })
      .finally(() => {
        if (previewBufferState === state && previewTheme !== state.themeId) {
          previewBufferState = null;
        }
      });
    previewBufferState = state;
    return state.promise;
  }

  function clearPreviewTimer({ cancelMusic = false } = {}) {
    previewGeneration += 1;
    if (cancelMusic) musicGeneration += 1;
    clearTimeout(previewTimer);
    previewTimer = null;
  }

  function loadSfxBank(theme = desiredTheme()) {
    const assets = audioAssetsFor(theme);
    if (!assets?.sfxBank) return Promise.resolve(null);
    if (!sfxBuffers.has(assets.sfxBank)) {
      const state = { buffer: null, promise: null };
      state.promise = decode(assets.sfxBank)
        .then((buffer) => {
          state.buffer = buffer;
          return buffer;
        })
        .catch(() => {
          if (sfxBuffers.get(assets.sfxBank) === state) sfxBuffers.delete(assets.sfxBank);
          return null;
        });
      sfxBuffers.set(assets.sfxBank, state);
    }
    return sfxBuffers.get(assets.sfxBank).promise;
  }

  async function switchMusic(theme = desiredTheme(), {
    force = false,
    preview = false,
    restart = false
  } = {}) {
    const activeContext = ensureGraph();
    const assets = audioAssetsFor(theme);
    const targetGain = desiredMusicGain(theme);
    if (!primed || !activeContext || !assets || targetGain <= 0 || (saveDataEnabled() && !force)) {
      if (currentMusic) setMusicGain(0);
      return false;
    }
    if (
      currentMusic?.themeId === assets.id
      && currentMusic.preview === Boolean(preview)
      && !restart
    ) {
      setMusicGain(targetGain);
      setPulseGain(desiredPulseGain(theme));
      return true;
    }
    const loadKey = `${assets.id}:${preview ? "preview" : "loop"}`;
    if (
      loadingMusic?.key === loadKey
      && loadingMusic.generation === musicGeneration
    ) return loadingMusic.promise;
    const generation = ++musicGeneration;
    const task = (async () => {
      const decoded = preview
        ? await loadPreviewMusic(assets)
        : await prepareMusic(assets.id);
      if (!decoded?.buffer) return false;
      const { buffer, pulseBuffer } = decoded;
      if (generation !== musicGeneration || suspended || desiredMusicGain(theme) <= 0) return false;
      const source = activeContext.createBufferSource();
      const gain = activeContext.createGain();
      const pulseSource = !preview && pulseBuffer ? activeContext.createBufferSource() : null;
      const pulseGain = pulseSource ? activeContext.createGain() : null;
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = Math.min(64, buffer.duration);
      if (pulseSource) {
        pulseSource.buffer = pulseBuffer;
        pulseSource.loop = true;
        pulseSource.loopStart = 0;
        pulseSource.loopEnd = Math.min(64, pulseBuffer.duration);
        pulseGain.gain.setValueAtTime(0, activeContext.currentTime);
        pulseSource.connect(pulseGain).connect(gain);
      }
      gain.gain.setValueAtTime(0, activeContext.currentTime);
      source.connect(gain).connect(output);
      const previous = currentMusic;
      const exclusivePreviewTransition = Boolean(previous && (preview || previous.preview));
      const startAt = activeContext.currentTime + (
        exclusivePreviewTransition
          ? PREVIEW_FADE_OUT_SECONDS + PREVIEW_SILENT_GAP_SECONDS
          : 0.015
      );
      const startOffset = preview ? Math.min(assets.previewAt, Math.max(0, source.loopEnd - 1)) : 0;
      source.start(startAt, startOffset);
      pulseSource?.start(startAt, Math.min(startOffset, Math.max(0, pulseSource.loopEnd - 1)));
      currentMusic = {
        sources: pulseSource ? [source, pulseSource] : [source],
        gain,
        pulseGain,
        themeId: assets.id,
        title: assets.title,
        preview: Boolean(preview)
      };
      if (exclusivePreviewTransition) {
        const now = activeContext.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(targetGain, startAt + PREVIEW_FADE_IN_SECONDS);
        if (pulseGain) {
          const pulseTarget = desiredPulseGain(theme);
          pulseGain.gain.cancelScheduledValues(now);
          pulseGain.gain.setValueAtTime(0, now);
          pulseGain.gain.setValueAtTime(0, startAt);
          pulseGain.gain.linearRampToValueAtTime(pulseTarget, startAt + PREVIEW_FADE_IN_SECONDS);
        }
      } else {
        setMusicGain(targetGain, previous ? 1.05 : 0.72);
        setPulseGain(desiredPulseGain(theme), previous ? 1.05 : 0.72);
      }
      if (previous) {
        const now = activeContext.currentTime;
        const fadeSeconds = exclusivePreviewTransition ? PREVIEW_FADE_OUT_SECONDS : 1.05;
        previous.gain.gain.cancelScheduledValues(now);
        previous.gain.gain.setValueAtTime(previous.gain.gain.value, now);
        previous.gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
        setTimeout(() => {
          for (const previousSource of previous.sources) {
            try { previousSource.stop(); } catch { /* Already stopped. */ }
            try { previousSource.disconnect(); } catch { /* Optional cleanup. */ }
          }
          try { previous.pulseGain?.disconnect(); } catch { /* Optional cleanup. */ }
          try { previous.gain.disconnect(); } catch { /* Optional cleanup. */ }
        }, Math.ceil((fadeSeconds + 0.1) * 1000));
      }
      return true;
    })();
    loadingMusic = { key: loadKey, generation, promise: task };
    try {
      return await task;
    } finally {
      if (loadingMusic?.promise === task) loadingMusic = null;
    }
  }

  function stopVoice(voice) {
    if (!voice || voice.stopping) return;
    voice.stopping = true;
    activeVoices.delete(voice);
    const now = context?.currentTime || 0;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);
      voice.source.stop(now + 0.016);
    } catch { /* A completed voice is already silent. */ }
  }

  function claimCue(cue) {
    const mix = CUE_MIX[cue] || Object.freeze({ priority: 2, cooldown: 80 });
    const now = globalThis.performance?.now?.() ?? Date.now();
    const previous = lastCueAt.get(cue);
    if (previous !== undefined && now - previous < mix.cooldown) return null;
    if (mix.group) {
      const competing = [...activeVoices].filter((voice) => voice.group === mix.group);
      if (competing.some((voice) => voice.priority > mix.priority)) return null;
      competing.forEach(stopVoice);
    }
    if (activeVoices.size >= MAX_SFX_VOICES) {
      const lowest = [...activeVoices].sort((left, right) => left.priority - right.priority)[0];
      if (!lowest || lowest.priority >= mix.priority) return null;
      stopVoice(lowest);
    }
    lastCueAt.set(cue, now);
    return mix;
  }

  function registerVoice(source, gain, mix, cleanup = () => {}) {
    const voice = { source, gain, priority: mix.priority, group: mix.group || "", stopping: false };
    activeVoices.add(voice);
    source.onended = () => {
      activeVoices.delete(voice);
      cleanup();
      try { source.disconnect(); } catch { /* Optional cleanup. */ }
      try { gain.disconnect(); } catch { /* Optional cleanup. */ }
    };
    return voice;
  }

  function fallbackTone(audio, cue) {
    if (!audio || !context || !sfxBus) return false;
    const mix = claimCue(cue);
    if (!mix) return false;
    const start = context.currentTime + 0.005;
    const slice = Math.max(0.025, audio.duration / 1000 / Math.max(1, audio.tones.length));
    const available = Math.max(1, MAX_SFX_VOICES - activeVoices.size);
    audio.tones.slice(0, available).forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + slice * index;
      oscillator.type = audio.wave;
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, audio.gain), at + Math.min(0.018, slice / 3));
      gain.gain.exponentialRampToValueAtTime(0.0001, at + slice);
      oscillator.connect(gain).connect(sfxBus);
      registerVoice(oscillator, gain, mix);
      oscillator.start(at);
      oscillator.stop(at + slice + 0.01);
    });
    return true;
  }

  function playBuffer(buffer, cue, options, policyAudio) {
    if (!buffer || !context || !sfxBus) return false;
    const canonicalCue = cue === "uiSelect" ? "place" : cue;
    const cueIndex = CUE_ORDER.indexOf(canonicalCue);
    const mix = cueIndex < 0 ? null : claimCue(cue);
    if (!mix) return false;
    const category = CATEGORY_TONE[String(options.category || "").toLowerCase()] || { rate: 1, filter: 4_600, pan: 0 };
    const hash = stableHash(options.word || `${canonicalCue}:${options.source || ""}`);
    const variation = ((hash % 7) - 3) * 0.0045;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(category.rate + variation, context.currentTime);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(category.filter, context.currentTime);
    filter.Q.setValueAtTime(0.54, context.currentTime);
    if (panner) panner.pan.setValueAtTime(Math.max(-1, Math.min(1, category.pan + (((hash >> 4) % 5) - 2) * 0.018)), context.currentTime);
    const cueGain = cue === "uiSelect" ? 0.34 : canonicalCue === "place" ? 0.48 : 0.58;
    const rawGainScale = Number(policyAudio?.gainScale);
    const gainScale = Number.isFinite(rawGainScale) ? Math.min(1, Math.max(0, rawGainScale)) : 1;
    gain.gain.setValueAtTime(cueGain * gainScale, context.currentTime);
    source.connect(filter);
    filter.connect(panner || gain);
    if (panner) panner.connect(gain);
    gain.connect(sfxBus);
    registerVoice(source, gain, mix, () => {
      try { filter.disconnect(); } catch { /* Optional cleanup. */ }
      try { panner?.disconnect(); } catch { /* Optional cleanup. */ }
    });
    const offset = cueIndex * CUE_SLOT_SECONDS;
    source.start(context.currentTime + 0.004, offset, CUE_SLOT_SECONDS - 0.05);

    if (options.newDiscovery && canonicalCue === "success" && activeVoices.size < MAX_SFX_VOICES) {
      const sparkle = context.createBufferSource();
      const sparkleGain = context.createGain();
      sparkle.buffer = buffer;
      sparkle.playbackRate.setValueAtTime((category.rate + variation) * 1.122, context.currentTime);
      sparkleGain.gain.setValueAtTime(cueGain * gainScale * 0.24, context.currentTime);
      sparkle.connect(sparkleGain).connect(sfxBus);
      registerVoice(sparkle, sparkleGain, { priority: 1 });
      sparkle.start(context.currentTime + 0.085, offset, CUE_SLOT_SECONDS - 0.18);
    }
    return true;
  }

  function playFeedback(cue, options = {}) {
    const activeContext = prime();
    const starterCue = cue === "place"
      ? STARTER_CUES[String(options.word || "").trim().toLocaleLowerCase("en-US")]
      : "";
    const resolvedCue = starterCue || cue;
    const policy = feedbackCuePolicy(resolvedCue, getPreferences(), {
      audioAvailable: Boolean(activeContext),
      hapticsAvailable: canVibrate(),
      documentHidden: suspended || Boolean(globalThis.document?.hidden),
      reducedMotion: safeMatchMedia("(prefers-reduced-motion: reduce)")
    });
    const theme = options.soundTheme || desiredTheme();
    const transformed = transformFeedbackAudio(policy.audio, theme);
    let audioPlayed = false;
    if (transformed && activeContext) {
      const assets = audioAssetsFor(theme);
      const state = assets?.sfxBank ? sfxBuffers.get(assets.sfxBank) : null;
      if (state?.buffer) {
        const prefs = preferences();
        audioPlayed = playBuffer(state.buffer, resolvedCue, options, { gainScale: prefs.volume * prefs.sfxVolume });
      } else {
        void loadSfxBank(theme);
        audioPlayed = fallbackTone(transformed, resolvedCue);
      }
    }
    if (policy.haptic) {
      try { globalThis.navigator.vibrate(policy.haptic); } catch { /* Haptics are optional. */ }
    }
    const duck = MUSIC_DUCK[resolvedCue];
    if (duck && currentMusic && audioPlayed) {
      const token = ++duckGeneration;
      setMusicGain(desiredMusicGain() * duck.amount, 0.04);
      clearTimeout(duckTimer);
      duckTimer = setTimeout(() => {
        if (token === duckGeneration) setMusicGain(desiredMusicGain(), 0.42);
      }, duck.hold);
    }
    return { audio: audioPlayed, haptic: Boolean(policy.haptic) };
  }

  function prime({ startMusic = true } = {}) {
    primed = true;
    const prefs = preferences();
    const soundEnabled = prefs.sound && prefs.sfxVolume > 0;
    const musicEnabled = prefs.music && prefs.musicVolume > 0;
    if ((!soundEnabled && !musicEnabled) || prefs.muted || prefs.volume <= 0) return null;
    const activeContext = ensureGraph();
    if (!activeContext) return null;
    if (activeContext.state === "suspended" && !suspended) activeContext.resume().catch(() => {});
    if (soundEnabled) void loadSfxBank();
    if (musicEnabled) {
      void prepareMusic(currentTheme);
      if (startMusic && desiredMusicGain() > 0) {
        void switchMusic(desiredTheme(), { preview: Boolean(previewTheme) });
      }
    }
    return activeContext;
  }

  function setTheme(theme, { preview = false } = {}) {
    const resolved = audioAssetsFor(theme);
    if (!resolved) return false;
    clearPreviewTimer({
      cancelMusic: Boolean(preview || previewTheme || currentMusic?.preview)
    });
    if (preview) previewTheme = resolved.id;
    else {
      previewTheme = "";
      currentTheme = resolved.id;
    }
    if (primed) {
      const prefs = preferences();
      if (prefs.sound && prefs.sfxVolume > 0 && !prefs.muted && prefs.volume > 0) void loadSfxBank(resolved.id);
      if (prefs.music && prefs.musicVolume > 0 && !prefs.muted && prefs.volume > 0) {
        if (!preview) void prepareMusic(resolved.id);
        void switchMusic(resolved.id, { preview });
      }
    }
    return true;
  }

  function preview(theme, milliseconds = 7_500) {
    const resolved = audioAssetsFor(theme);
    if (!resolved) return false;
    clearPreviewTimer({ cancelMusic: true });
    previewTheme = resolved.id;
    prime({ startMusic: false });
    void switchMusic(resolved.id, { force: true, preview: true, restart: true });
    playFeedback("success", { soundTheme: theme, category: "celestial", newDiscovery: true });
    const generation = previewGeneration;
    previewTimer = setTimeout(() => {
      if (generation !== previewGeneration) return;
      previewTimer = null;
      previewGeneration += 1;
      musicGeneration += 1;
      previewTheme = "";
      void switchMusic(currentTheme);
    }, Math.max(2_000, Number(milliseconds) || 7_500));
    return true;
  }

  function endPreview() {
    const hadPreview = Boolean(previewTheme || currentMusic?.preview);
    clearPreviewTimer({ cancelMusic: hadPreview });
    previewTheme = "";
    if (primed && hadPreview) void switchMusic(currentTheme);
    return hadPreview;
  }

  function setScene(nextScene) {
    scene = Object.hasOwn(SCENE_GAIN, nextScene) ? nextScene : "home";
    if (scene !== "result") {
      clearTimeout(progressionTimer);
      pendingProgression = "";
      playedProgressionPriority = 0;
    }
    if (primed) {
      if (desiredMusicGain() > 0) void switchMusic(desiredTheme());
      else setMusicGain(0);
      setPulseGain();
    }
  }

  function setPreferences() {
    const prefs = preferences();
    if (!prefs.sound || prefs.muted || prefs.volume <= 0 || prefs.sfxVolume <= 0) {
      [...activeVoices].forEach(stopVoice);
    }
    if (!prefs.music || prefs.muted || prefs.volume <= 0 || prefs.musicVolume <= 0) {
      clearPreviewTimer({
        cancelMusic: Boolean(previewTheme || currentMusic?.preview)
      });
      previewTheme = "";
      setMusicGain(0);
    }
    else if (primed) void switchMusic(desiredTheme());
    syncAuxiliaryChannels();
  }

  function setIntensity(value) {
    const numeric = Number(value);
    intensity = Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 0;
    setPulseGain(desiredPulseGain(), 0.58);
    return intensity;
  }

  function queueProgression(cue, delay = 0) {
    const mix = CUE_MIX[cue];
    if (mix?.group !== "progression") return false;
    const pendingPriority = CUE_MIX[pendingProgression]?.priority || 0;
    if (mix.priority <= Math.max(pendingPriority, playedProgressionPriority)) return false;
    clearTimeout(progressionTimer);
    pendingProgression = cue;
    progressionTimer = setTimeout(() => {
      pendingProgression = "";
      playedProgressionPriority = mix.priority;
      playFeedback(cue);
    }, Math.max(0, Number(delay) || 0));
    return true;
  }

  function playResult({ reward = false, unlock = false, rankUp = false } = {}) {
    clearTimeout(progressionTimer);
    pendingProgression = "";
    playedProgressionPriority = 0;
    const reveal = playFeedback("resultReveal");
    const progression = rankUp ? "rankPromotion" : unlock ? "collectionUnlock" : reward ? "reward" : "";
    if (progression) queueProgression(progression, 640);
    return { ...reveal, progression };
  }

  function setSuspended(value) {
    suspended = Boolean(value);
    if (!context) return;
    syncAuxiliaryChannels(suspended ? 0 : 0.12);
    if (suspended) {
      context.suspend().catch(() => {});
    } else if (primed) {
      context.resume().then(() => switchMusic(desiredTheme())).catch(() => {});
    }
  }

  function dispose() {
    clearPreviewTimer({ cancelMusic: true });
    clearTimeout(duckTimer);
    clearTimeout(progressionTimer);
    progressionTimer = null;
    previewTheme = "";
    preparedMusic = null;
    preparingMusic = null;
    previewBufferState = null;
    stopMusic(0.05);
    [...activeVoices].forEach(stopVoice);
    for (const channel of [...auxiliaryChannels]) {
      channel.closed = true;
      try { channel.node.disconnect(); } catch { /* Optional cleanup. */ }
    }
    auxiliaryChannels.clear();
    if (context) context.close().catch(() => {});
    context = null;
    output = null;
    sfxBus = null;
    sfxBuffers.clear();
  }

  return Object.freeze({
    createAuxiliaryChannel,
    dispose,
    endPreview,
    playFeedback,
    playResult,
    preview,
    prime,
    queueProgression,
    setIntensity,
    setPreferences,
    setScene,
    setSuspended,
    setTheme
  });
}

export const AUDIO_CUE_SLOT_SECONDS = CUE_SLOT_SECONDS;
export const AUDIO_CUE_ORDER = CUE_ORDER;
