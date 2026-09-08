const DEFAULT_MUTED_STORAGE_KEY = "constellore-birthday-audio-muted-v1";

export const BIRTHDAY_AUDIO_CUES = Object.freeze([
  "sabotage",
  "water",
  "fate",
  "ribbon",
  "flip",
  "engine",
  "indicator",
  "parking",
  "rocket",
  "boost",
  "docking",
  "glint",
  "finale"
]);

export const BIRTHDAY_AUDIO_ACTS = Object.freeze([
  "varna",
  "europe",
  "tokyo",
  "space",
  "cosmos",
  "finale"
]);

const CUE_SCORE = Object.freeze({
  sabotage: Object.freeze({
    gain: .16,
    notes: [[510, .00, .07, "square"], [390, .06, .08, "square"], [250, .13, .13, "triangle"]]
  }),
  water: Object.freeze({
    gain: .17,
    notes: [[260, .00, .16, "sine"], [420, .08, .13, "sine"], [690, .17, .16, "sine"]],
    noise: Object.freeze({ duration: .24, highpass: 760, gain: .12 })
  }),
  fate: Object.freeze({
    gain: .19,
    notes: [[110, .00, .54, "sine"], [164.81, .04, .52, "triangle"], [246.94, .08, .48, "sine"]]
  }),
  ribbon: Object.freeze({
    gain: .13,
    notes: [[880, .00, .08, "sine"], [1174.66, .07, .10, "sine"], [1567.98, .14, .16, "sine"]],
    noise: Object.freeze({ duration: .19, highpass: 3200, gain: .035 })
  }),
  flip: Object.freeze({
    gain: .12,
    notes: [[220, .00, .20, "sine", 820]],
    noise: Object.freeze({ duration: .18, highpass: 1100, gain: .06 })
  }),
  engine: Object.freeze({
    gain: .075,
    notes: [[63, .00, .28, "sawtooth"], [126, .01, .22, "triangle"]]
  }),
  indicator: Object.freeze({
    gain: .095,
    notes: [[1046.5, .00, .035, "square"], [783.99, .065, .032, "square"]]
  }),
  parking: Object.freeze({
    gain: .115,
    notes: [[740, .00, .08, "sine"], [740, .16, .08, "sine"], [987.77, .34, .16, "sine"]]
  }),
  rocket: Object.freeze({
    gain: .17,
    notes: [[72, .00, .70, "sawtooth", 920], [144, .14, .55, "triangle", 580]],
    noise: Object.freeze({ duration: .68, highpass: 180, gain: .09 })
  }),
  boost: Object.freeze({
    gain: .15,
    notes: [[120, .00, .52, "sawtooth", 1380], [240, .08, .46, "triangle", 2100]],
    noise: Object.freeze({ duration: .42, highpass: 900, gain: .07 })
  }),
  docking: Object.freeze({
    gain: .13,
    notes: [[174.61, .00, .24, "sine"], [261.63, .12, .27, "sine"], [349.23, .24, .32, "triangle"]]
  }),
  glint: Object.freeze({
    gain: .09,
    notes: [[1318.51, .00, .07, "sine"], [1975.53, .055, .16, "sine"]]
  }),
  finale: Object.freeze({
    gain: .15,
    notes: [[196, .00, 1.35, "sine"], [246.94, .08, 1.30, "triangle"], [293.66, .16, 1.25, "sine"], [392, .48, 1.05, "sine"]]
  })
});

const MUSIC_SCORE = Object.freeze({
  varna: Object.freeze({ root: 146.83, ratios: [1, 1.25, 1.5, 2], pace: 3.8 }),
  europe: Object.freeze({ root: 164.81, ratios: [1, 1.2, 1.5, 1.8], pace: 3.4 }),
  tokyo: Object.freeze({ root: 185, ratios: [1, 1.125, 1.5, 2], pace: 2.8 }),
  space: Object.freeze({ root: 110, ratios: [1, 1.5, 2, 2.25], pace: 4.2 }),
  cosmos: Object.freeze({ root: 130.81, ratios: [1, 1.25, 1.5, 2], pace: 5.0 }),
  finale: Object.freeze({ root: 196, ratios: [1, 1.25, 1.5, 2], pace: 6.2 })
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function safeStorage(target) {
  return target && typeof target.getItem === "function" && typeof target.setItem === "function"
    ? target
    : null;
}

function storedMute(target, key) {
  try {
    return safeStorage(target)?.getItem(key) === "muted";
  } catch {
    return false;
  }
}

function saveMute(target, key, muted) {
  try {
    safeStorage(target)?.setItem(key, muted ? "muted" : "sound");
  } catch { /* Private mode can reject writes; sound remains usable in memory. */ }
}

function normalizedPreferences(getPreferences) {
  let source = {};
  try { source = getPreferences?.() || {}; }
  catch { source = {}; }
  return Object.freeze({
    muted: Boolean(source.muted),
    sound: source.sound !== false,
    music: source.music !== false,
    volume: clamp(source.volume ?? 1, 0, 1),
    sfxVolume: clamp(source.sfxVolume ?? 1, 0, 1),
    musicVolume: clamp(source.musicVolume ?? 1, 0, 1)
  });
}

function stopNode(node, at = 0) {
  try { node.stop(at); } catch { /* A finished oscillator is already stopped. */ }
}

/**
 * Original, procedural voyage audio. No downloaded or copyrighted samples are
 * used: every cue and music bed is synthesized in the browser.
 */
export function createBirthdayVoyageAudioDirector({
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  navigatorRef = windowRef?.navigator || globalThis.navigator,
  storage = globalThis.localStorage,
  storageKey = DEFAULT_MUTED_STORAGE_KEY,
  getPreferences = () => ({}),
  hostAudio = {},
  AudioContextCtor = windowRef?.AudioContext || windowRef?.webkitAudioContext,
  timers = windowRef || globalThis
} = {}) {
  let context = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let muted = storedMute(storage, storageKey);
  let entered = false;
  let primed = false;
  let hostDucked = false;
  let musicAct = "varna";
  let musicTimer = null;
  let lifecycleObserver = null;
  let lifecycleRoot = null;
  let quietGeneration = 0;
  const activeNodes = new Set();
  const loopTimers = new Map();
  const listeners = new Set();

  const preferences = () => normalizedPreferences(getPreferences);
  const canPlaySfx = () => {
    const prefs = preferences();
    return !muted && !prefs.muted && prefs.sound && prefs.volume > 0 && prefs.sfxVolume > 0;
  };
  const canPlayMusic = () => {
    const prefs = preferences();
    return !muted && !prefs.muted && prefs.music && prefs.volume > 0 && prefs.musicVolume > 0;
  };

  function notify() {
    const state = Object.freeze({ muted, entered, primed, musicAct });
    listeners.forEach((listener) => {
      try { listener(state); } catch { /* One sound-toggle listener cannot break playback. */ }
    });
    try {
      windowRef?.dispatchEvent?.(new windowRef.CustomEvent("constellore:birthday-audio-change", {
        detail: state
      }));
    } catch { /* CustomEvent is optional in tests and old embedded browsers. */ }
    return state;
  }

  function ensureGraph() {
    if (context || typeof AudioContextCtor !== "function") return context;
    try {
      context = new AudioContextCtor();
      master = context.createGain();
      musicBus = context.createGain();
      sfxBus = context.createGain();
      master.gain.setValueAtTime(.74, context.currentTime);
      musicBus.gain.setValueAtTime(.22, context.currentTime);
      sfxBus.gain.setValueAtTime(.78, context.currentTime);
      musicBus.connect(master);
      sfxBus.connect(master);
      master.connect(context.destination);
    } catch {
      context = null;
      master = null;
      musicBus = null;
      sfxBus = null;
    }
    return context;
  }

  function trackNode(node) {
    activeNodes.add(node);
    node.addEventListener?.("ended", () => activeNodes.delete(node), { once: true });
    return node;
  }

  function scheduleTone({
    frequency,
    at,
    duration,
    type = "sine",
    gain = .1,
    sweep = 0,
    bus = sfxBus,
    pan = 0,
    attack = .014,
    release = .08
  }) {
    if (!context || !bus) return false;
    const oscillator = trackNode(context.createOscillator());
    const envelope = context.createGain();
    const panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
    const start = Math.max(context.currentTime, at);
    const finish = start + Math.max(.025, duration);
    const peak = Math.max(.0001, gain);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (sweep) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + sweep), finish);
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(peak, start + Math.min(attack, duration * .35));
    envelope.gain.setValueAtTime(peak, Math.max(start + attack, finish - release));
    envelope.gain.exponentialRampToValueAtTime(.0001, finish);
    if (panner) {
      panner.pan.setValueAtTime(clamp(pan, -1, 1), start);
      oscillator.connect(envelope).connect(panner).connect(bus);
    } else {
      oscillator.connect(envelope).connect(bus);
    }
    oscillator.start(start);
    oscillator.stop(finish + .02);
    return true;
  }

  function scheduleNoise({ at, duration, highpass = 900, gain = .05, pan = 0 }) {
    if (!context || !sfxBus || typeof context.createBuffer !== "function") return false;
    const length = Math.max(1, Math.round(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const fade = 1 - index / length;
      data[index] = (Math.random() * 2 - 1) * fade;
    }
    const source = trackNode(context.createBufferSource());
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
    const start = Math.max(context.currentTime, at);
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.setValueAtTime(highpass, start);
    envelope.gain.setValueAtTime(Math.max(.0001, gain), start);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    if (panner) {
      panner.pan.setValueAtTime(clamp(pan, -1, 1), start);
      source.connect(filter).connect(envelope).connect(panner).connect(sfxBus);
    } else {
      source.connect(filter).connect(envelope).connect(sfxBus);
    }
    source.start(start);
    source.stop(start + duration + .02);
    return true;
  }

  async function prime({ music = true, act = musicAct } = {}) {
    const activeContext = ensureGraph();
    if (!activeContext) return false;
    primed = true;
    try { await activeContext.resume?.(); } catch { /* A later intentional click can retry. */ }
    if (music && entered) startMusic(act);
    notify();
    return activeContext.state !== "suspended";
  }

  function play(cue, { intensity = 1, pan = 0 } = {}) {
    if (!BIRTHDAY_AUDIO_CUES.includes(cue) || !canPlaySfx()) return false;
    const activeContext = ensureGraph();
    if (!activeContext) return false;
    primed = true;
    void activeContext.resume?.().catch?.(() => {});
    const score = CUE_SCORE[cue];
    const prefs = preferences();
    const scale = score.gain * prefs.volume * prefs.sfxVolume * clamp(intensity, .2, 1.4);
    const origin = activeContext.currentTime + .008;
    score.notes.forEach(([frequency, offset, duration, type, sweep = 0], index) => {
      scheduleTone({
        frequency,
        at: origin + offset,
        duration,
        type,
        sweep,
        gain: scale * (index ? .74 : 1),
        pan: clamp(pan + (index % 2 ? .08 : -.08), -1, 1)
      });
    });
    if (score.noise) {
      scheduleNoise({
        at: origin,
        duration: score.noise.duration,
        highpass: score.noise.highpass,
        gain: score.noise.gain * prefs.volume * prefs.sfxVolume * clamp(intensity, .2, 1.4),
        pan
      });
    }
    return true;
  }

  function stopLoop(name) {
    const timer = loopTimers.get(name);
    if (!timer) return false;
    timers.clearInterval(timer);
    loopTimers.delete(name);
    return true;
  }

  function startLoop(name, { intensity = 1, pan = 0 } = {}) {
    if (!new Set(["engine", "indicator"]).has(name)) return false;
    stopLoop(name);
    const interval = name === "engine" ? 310 : 580;
    play(name, { intensity, pan });
    loopTimers.set(name, timers.setInterval(() => play(name, { intensity, pan }), interval));
    return true;
  }

  function scheduleMusicPhrase(act = musicAct) {
    if (!context || !musicBus || !entered || !primed || !canPlayMusic()) return;
    const score = MUSIC_SCORE[act] || MUSIC_SCORE.europe;
    const prefs = preferences();
    const origin = context.currentTime + .025;
    const baseGain = .055 * prefs.volume * prefs.musicVolume;
    const chord = score.ratios.slice(0, 3);
    chord.forEach((ratio, index) => scheduleTone({
      frequency: score.root * ratio,
      at: origin + index * .06,
      duration: score.pace * .92,
      type: index === 1 ? "triangle" : "sine",
      gain: baseGain * (index ? .72 : 1),
      bus: musicBus,
      pan: (index - 1) * .24,
      attack: .58,
      release: .9
    }));
    const melodyRatio = score.ratios[(Math.floor(origin * 10) + act.length) % score.ratios.length];
    scheduleTone({
      frequency: score.root * melodyRatio * 2,
      at: origin + score.pace * .56,
      duration: .52,
      gain: baseGain * .46,
      bus: musicBus,
      pan: act === "tokyo" ? .36 : -.22,
      attack: .08,
      release: .26
    });
  }

  function stopMusic({ fadeMs = 260 } = {}) {
    if (musicTimer) timers.clearInterval(musicTimer);
    musicTimer = null;
    if (musicBus && context) {
      const now = context.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setValueAtTime(Math.max(.0001, musicBus.gain.value), now);
      musicBus.gain.exponentialRampToValueAtTime(.0001, now + Math.max(.03, fadeMs / 1000));
    }
  }

  function startMusic(act = musicAct) {
    musicAct = BIRTHDAY_AUDIO_ACTS.includes(act) ? act : "europe";
    if (!entered || !primed || !canPlayMusic() || !ensureGraph()) {
      notify();
      return false;
    }
    if (musicTimer) timers.clearInterval(musicTimer);
    const score = MUSIC_SCORE[musicAct];
    const now = context.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(Math.max(.0001, musicBus.gain.value), now);
    musicBus.gain.linearRampToValueAtTime(.22, now + .55);
    scheduleMusicPhrase(musicAct);
    musicTimer = timers.setInterval(() => scheduleMusicPhrase(musicAct), score.pace * 1000);
    notify();
    return true;
  }

  function setMusicAct(act) {
    const nextAct = BIRTHDAY_AUDIO_ACTS.includes(act) ? act : "europe";
    if (nextAct === musicAct) return musicAct;
    stopMusic({ fadeMs: 480 });
    musicAct = nextAct;
    if (entered && primed && canPlayMusic()) {
      timers.setTimeout(() => {
        if (entered && musicAct === nextAct) startMusic(nextAct);
      }, 500);
    }
    notify();
    return musicAct;
  }

  async function quietBeat(milliseconds = 900, { resume = false } = {}) {
    const generation = ++quietGeneration;
    const restoreAct = musicAct;
    stopMusic({ fadeMs: Math.min(420, milliseconds * .45) });
    await new Promise((resolve) => timers.setTimeout(resolve, Math.max(0, milliseconds)));
    if (generation !== quietGeneration || !entered) return false;
    if (resume) startMusic(restoreAct);
    return true;
  }

  function detachLifecycle() {
    lifecycleObserver?.disconnect?.();
    lifecycleObserver = null;
    lifecycleRoot = null;
    windowRef?.removeEventListener?.("pagehide", handlePageHide);
  }

  function handlePageHide() {
    exit({ restoreHost: true });
  }

  function attachLifecycle(root) {
    detachLifecycle();
    lifecycleRoot = root || null;
    const Observer = windowRef?.MutationObserver || globalThis.MutationObserver;
    if (lifecycleRoot && typeof Observer === "function" && documentRef?.documentElement) {
      lifecycleObserver = new Observer(() => {
        if (!lifecycleRoot?.isConnected) exit({ restoreHost: true });
      });
      lifecycleObserver.observe(documentRef.documentElement, { childList: true, subtree: true });
    }
    windowRef?.addEventListener?.("pagehide", handlePageHide, { once: true });
  }

  function enter({ root = null, act = musicAct } = {}) {
    if (!entered) {
      entered = true;
      if (!hostDucked) {
        try { hostAudio.duck?.(); } catch { /* Birthday audio still works without the host soundtrack. */ }
        hostDucked = true;
      }
    }
    attachLifecycle(root || lifecycleRoot);
    musicAct = BIRTHDAY_AUDIO_ACTS.includes(act) ? act : musicAct;
    if (primed) startMusic(musicAct);
    notify();
    return true;
  }

  function exit({ restoreHost = true } = {}) {
    if (!entered && !hostDucked) return false;
    entered = false;
    quietGeneration += 1;
    detachLifecycle();
    stopMusic({ fadeMs: 180 });
    [...loopTimers.keys()].forEach(stopLoop);
    activeNodes.forEach((node) => stopNode(node, context?.currentTime || 0));
    activeNodes.clear();
    if (restoreHost && hostDucked) {
      try { hostAudio.restore?.(); } catch { /* The game can recover its audio on its next scene change. */ }
    }
    hostDucked = false;
    notify();
    return true;
  }

  function setMuted(value) {
    muted = Boolean(value);
    saveMute(storage, storageKey, muted);
    if (muted) {
      stopMusic({ fadeMs: 120 });
      [...loopTimers.keys()].forEach(stopLoop);
      activeNodes.forEach((node) => stopNode(node, context?.currentTime || 0));
      activeNodes.clear();
    } else if (entered && primed) {
      startMusic(musicAct);
    }
    notify();
    return muted;
  }

  function toggleMuted() {
    return setMuted(!muted);
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    listener(Object.freeze({ muted, entered, primed, musicAct }));
    return () => listeners.delete(listener);
  }

  function dispose({ restoreHost = true } = {}) {
    exit({ restoreHost });
    listeners.clear();
    if (context) void context.close?.().catch?.(() => {});
    context = null;
    master = null;
    musicBus = null;
    sfxBus = null;
  }

  function cacheMedia(urls) {
    return requestBirthdayMediaCache(urls, { navigatorRef });
  }

  return Object.freeze({
    cacheMedia,
    dispose,
    enter,
    exit,
    isMuted: () => muted,
    play,
    prime,
    quietBeat,
    setMusicAct,
    setMuted,
    startLoop,
    startMusic,
    stopLoop,
    stopMusic,
    subscribe,
    toggleMuted,
    get state() {
      return Object.freeze({ muted, entered, primed, musicAct });
    }
  });
}

export function birthdayAudioToggleLabel(muted) {
  return muted ? "Turn voyage sound on" : "Mute voyage sound";
}

export function requestBirthdayMediaCache(urls, {
  navigatorRef = globalThis.navigator,
  requestId = `birthday-${Date.now().toString(36)}`
} = {}) {
  const selected = [...new Set((Array.isArray(urls) ? urls : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean))].slice(0, 3);
  const worker = navigatorRef?.serviceWorker?.controller;
  if (!worker?.postMessage || !selected.length) return false;
  worker.postMessage({
    type: "CONSTELLORE_CACHE_BIRTHDAY_MEDIA",
    requestId: String(requestId || "").slice(0, 80),
    urls: selected
  });
  return true;
}

export const BIRTHDAY_AUDIO_MUTED_STORAGE_KEY = DEFAULT_MUTED_STORAGE_KEY;
