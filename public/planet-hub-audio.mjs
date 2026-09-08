const DESTINATIONS = Object.freeze(["forge", "journey", "arena"]);
const DESTINATION_STEMS = Object.freeze({
  forge: Object.freeze([
    Object.freeze({ frequency: 110, type: "sine", gain: 0.032, detune: 0 }),
    Object.freeze({ frequency: 164.81, type: "triangle", gain: 0.012, detune: -4 })
  ]),
  journey: Object.freeze([
    Object.freeze({ frequency: 73.42, type: "sine", gain: 0.036, detune: 0 }),
    Object.freeze({ frequency: 146.83, type: "sine", gain: 0.011, detune: 5 })
  ]),
  arena: Object.freeze([
    Object.freeze({ frequency: 49, type: "sine", gain: 0.038, detune: 0 }),
    Object.freeze({ frequency: 98, type: "triangle", gain: 0.013, detune: -7 })
  ])
});

const CUE_ALIASES = Object.freeze({
  settled: "settled",
  "forge-chime": "forge-chime",
  "journey-ignition": "journey-ignition",
  "journey-liftoff": "journey-liftoff",
  "journey-transfer": "journey-transfer",
  "journey-approach": "journey-approach",
  "journey-touchdown": "journey-touchdown",
  "arena-portal": "arena-portal",
  "arena-thunder": "arena-thunder"
});

function normalizedDestination(value) {
  return DESTINATIONS.includes(value) ? value : "forge";
}

function safeNow(context) {
  return Math.max(0, Number(context?.currentTime) || 0);
}

function setParam(param, value, at) {
  if (!param) return;
  if (typeof param.setValueAtTime === "function") param.setValueAtTime(value, at);
  else param.value = value;
}

function rampParam(param, value, at, { exponential = false } = {}) {
  if (!param) return;
  if (exponential && value > 0 && typeof param.exponentialRampToValueAtTime === "function") {
    param.exponentialRampToValueAtTime(value, at);
  } else if (typeof param.linearRampToValueAtTime === "function") {
    param.linearRampToValueAtTime(value, at);
  } else param.value = value;
}

function cancelParam(param, at) {
  try { param?.cancelScheduledValues?.(at); } catch { /* Optional automation. */ }
}

export function dispatchPlanetHubSemanticAudio(target, cue, detail = {}) {
  if (!target?.dispatchEvent || !cue) return false;
  const WindowCustomEvent = target?.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;
  if (typeof WindowCustomEvent !== "function") return false;
  target.dispatchEvent(new WindowCustomEvent("planet-hub-semantic-audio", {
    bubbles: false,
    detail: { ...detail, cue: String(cue) }
  }));
  return true;
}

export function createPlanetHubAudioDirector({
  documentRef = globalThis.document,
  windowRef = documentRef?.defaultView || globalThis.window,
  root = documentRef?.querySelector?.("[data-planet-hub]") || null,
  audioRuntime,
  cuePlayers = {},
  stemFactory = null,
  setTimeoutRef = globalThis.setTimeout,
  clearTimeoutRef = globalThis.clearTimeout
} = {}) {
  let destination = "forge";
  let reducedMotion = false;
  let destroyed = false;
  let primed = false;
  let musicChannel = null;
  let effectsChannel = null;
  let context = null;
  let settleTimer = null;
  let arenaThunderTimer = null;
  const suspendedReasons = new Set();
  const listeners = [];
  const persistentSources = new Set();
  const transientSources = new Set();
  const stemGains = new Map();

  function listen(target, type, listener, options) {
    target?.addEventListener?.(type, listener, options);
    listeners.push([target, type, listener, options]);
  }

  function clearScheduledCues() {
    clearTimeoutRef?.(settleTimer);
    clearTimeoutRef?.(arenaThunderTimer);
    settleTimer = null;
    arenaThunderTimer = null;
  }

  function isSuspended() {
    return destroyed || suspendedReasons.size > 0 || Boolean(documentRef?.hidden);
  }

  function stopSource(source) {
    if (!source) return;
    persistentSources.delete(source);
    transientSources.delete(source);
    try { source.stop?.(); } catch { /* A completed source is already silent. */ }
    try { source.disconnect?.(); } catch { /* Optional cleanup. */ }
  }

  function createPersistentTone({ frequency, type = "sine", gain = 0.02, detune = 0 }, output) {
    if (!context?.createOscillator || !context?.createGain || !output) return null;
    const source = context.createOscillator();
    const toneGain = context.createGain();
    source.type = type;
    setParam(source.frequency, frequency, safeNow(context));
    setParam(source.detune, detune, safeNow(context));
    setParam(toneGain.gain, gain, safeNow(context));
    source.connect(toneGain).connect(output);
    source.start?.(safeNow(context));
    persistentSources.add(source);
    return { source, gain: toneGain };
  }

  function createDefaultStems() {
    if (!context || !musicChannel?.input) return false;
    const now = safeNow(context);
    const bedGain = context.createGain();
    setParam(bedGain.gain, 0.018, now);
    bedGain.connect(musicChannel.input);
    createPersistentTone({ frequency: 32.7, type: "sine", gain: 0.7 }, bedGain);
    createPersistentTone({ frequency: 65.41, type: "sine", gain: 0.14, detune: -3 }, bedGain);

    for (const name of DESTINATIONS) {
      const group = context.createGain();
      setParam(group.gain, 0, now);
      group.connect(musicChannel.input);
      stemGains.set(name, group);
      for (const descriptor of DESTINATION_STEMS[name]) createPersistentTone(descriptor, group);
    }
    return true;
  }

  function createStems() {
    if (typeof stemFactory === "function") {
      const result = stemFactory({ context, output: musicChannel?.input, destination });
      if (result && typeof result === "object") {
        for (const name of DESTINATIONS) {
          const gain = result[name];
          if (gain?.gain) stemGains.set(name, gain);
        }
        for (const source of result.sources || []) persistentSources.add(source);
        if (stemGains.size) return true;
      }
    }
    return createDefaultStems();
  }

  function syncStemMix(seconds = 0.72) {
    if (!context) return;
    const now = safeNow(context);
    const audible = !isSuspended();
    for (const [name, gainNode] of stemGains) {
      const target = audible && name === destination ? 1 : 0;
      cancelParam(gainNode.gain, now);
      setParam(gainNode.gain, Math.max(0, Number(gainNode.gain?.value) || 0), now);
      rampParam(gainNode.gain, target, now + Math.max(0.02, seconds));
    }
    musicChannel?.setLevel?.(audible ? 0.3 : 0, seconds);
    effectsChannel?.setLevel?.(audible ? 0.58 : 0, Math.min(0.16, seconds));
  }

  function prime() {
    if (destroyed || primed || isSuspended()) return primed;
    const activeContext = audioRuntime?.prime?.({ startMusic: false });
    if (!activeContext || typeof audioRuntime?.createAuxiliaryChannel !== "function") return false;
    musicChannel = audioRuntime.createAuxiliaryChannel({ kind: "music", level: 0.3 });
    effectsChannel = audioRuntime.createAuxiliaryChannel({ kind: "effects", level: 0.58 });
    context = musicChannel?.context || effectsChannel?.context || activeContext;
    if (!context || !musicChannel?.input || !effectsChannel?.input) {
      musicChannel?.close?.();
      effectsChannel?.close?.();
      musicChannel = null;
      effectsChannel = null;
      context = null;
      return false;
    }
    primed = true;
    createStems();
    syncStemMix(0.7);
    scheduleDestinationArrival({ initial: true });
    return true;
  }

  function tone({
    frequency = 220,
    endFrequency = frequency,
    type = "sine",
    gain = 0.08,
    duration = 0.5,
    delay = 0,
    attack = 0.025,
    pan = 0,
    filter = 0
  } = {}) {
    if (!primed || isSuspended() || !context?.createOscillator || !effectsChannel?.input) return false;
    const source = context.createOscillator();
    const voiceGain = context.createGain();
    const filterNode = filter > 0 && context.createBiquadFilter ? context.createBiquadFilter() : null;
    const panner = context.createStereoPanner ? context.createStereoPanner() : null;
    const now = safeNow(context) + Math.max(0, delay);
    const end = now + Math.max(0.04, duration);
    source.type = type;
    setParam(source.frequency, Math.max(8, frequency), now);
    rampParam(source.frequency, Math.max(8, endFrequency), end);
    setParam(voiceGain.gain, 0.0001, now);
    rampParam(voiceGain.gain, Math.max(0.0001, gain), now + Math.min(duration * 0.35, attack), { exponential: true });
    rampParam(voiceGain.gain, 0.0001, end, { exponential: true });
    if (filterNode) {
      filterNode.type = "lowpass";
      setParam(filterNode.frequency, filter, now);
      setParam(filterNode.Q, 0.7, now);
    }
    if (panner) setParam(panner.pan, Math.max(-1, Math.min(1, pan)), now);
    source.connect(filterNode || panner || voiceGain);
    if (filterNode) filterNode.connect(panner || voiceGain);
    if (panner) panner.connect(voiceGain);
    voiceGain.connect(effectsChannel.input);
    transientSources.add(source);
    source.onended = () => {
      transientSources.delete(source);
      try { source.disconnect(); } catch { /* Optional cleanup. */ }
      try { voiceGain.disconnect(); } catch { /* Optional cleanup. */ }
      try { filterNode?.disconnect(); } catch { /* Optional cleanup. */ }
      try { panner?.disconnect(); } catch { /* Optional cleanup. */ }
    };
    source.start?.(now);
    source.stop?.(end + 0.03);
    return true;
  }

  function playProceduralCue(cue, meta = {}) {
    switch (cue) {
      case "settled":
        tone({ frequency: 196, endFrequency: 220, gain: 0.035, duration: 0.42, pan: -0.08 });
        return tone({ frequency: 293.66, endFrequency: 329.63, gain: 0.026, duration: 0.5, delay: 0.08, pan: 0.08 });
      case "forge-chime":
        tone({ frequency: 392, gain: 0.05, duration: 0.65, pan: -0.18 });
        tone({ frequency: 523.25, gain: 0.038, duration: 0.76, delay: 0.1 });
        return tone({ frequency: 659.25, gain: 0.026, duration: 0.9, delay: 0.2, pan: 0.18 });
      case "journey-ignition":
        tone({ frequency: 36, endFrequency: 68, type: "sawtooth", gain: 0.075, duration: 1.05, filter: 180 });
        return tone({ frequency: 82, endFrequency: 118, type: "triangle", gain: 0.032, duration: 0.7, delay: 0.18, filter: 520 });
      case "journey-liftoff":
        tone({ frequency: 52, endFrequency: 94, type: "sawtooth", gain: 0.095, duration: 1.55, filter: 260 });
        return tone({ frequency: 104, endFrequency: 156, type: "triangle", gain: 0.032, duration: 1.2, delay: 0.12, filter: 720 });
      case "journey-transfer":
        tone({ frequency: 116, endFrequency: 74, type: "sine", gain: 0.042, duration: 1.6, pan: meta.direction === "return" ? -0.22 : 0.22 });
        return tone({ frequency: 174, endFrequency: 112, type: "triangle", gain: 0.018, duration: 1.35, delay: 0.16, filter: 900 });
      case "journey-approach":
        tone({ frequency: 168, endFrequency: 72, type: "triangle", gain: 0.05, duration: 1.3, filter: 650 });
        return tone({ frequency: 55, endFrequency: 42, type: "sine", gain: 0.045, duration: 1.6, delay: 0.12 });
      case "journey-touchdown":
        tone({ frequency: 47, endFrequency: 32, type: "sine", gain: 0.12, duration: 0.7, filter: 180 });
        tone({ frequency: 94, endFrequency: 62, type: "triangle", gain: 0.05, duration: 0.46, filter: 420 });
        return tone({ frequency: 220, endFrequency: 246.94, type: "sine", gain: 0.022, duration: 0.8, delay: 0.2 });
      case "arena-portal":
        tone({ frequency: 98, endFrequency: 110, type: "sine", gain: 0.045, duration: 1.15, pan: -0.15 });
        return tone({ frequency: 147, endFrequency: 164.81, type: "triangle", gain: 0.032, duration: 1.2, delay: 0.08, pan: 0.15 });
      case "arena-thunder":
        tone({ frequency: 38, endFrequency: 24, type: "sawtooth", gain: 0.095, duration: 1.4, filter: 130, pan: -0.3 });
        return tone({ frequency: 29, endFrequency: 21, type: "sine", gain: 0.07, duration: 1.8, delay: 0.16, pan: 0.25 });
      default:
        return false;
    }
  }

  function cue(rawCue, meta = {}) {
    const cueName = CUE_ALIASES[String(rawCue || "").trim()];
    if (!cueName || !primed || isSuspended()) return false;
    const replacement = cuePlayers?.[cueName];
    if (typeof replacement === "function") {
      try {
        if (replacement({ context, output: effectsChannel?.input, cue: cueName, destination, ...meta }) === true) return true;
      } catch { /* A failed authored cue falls back to the procedural cue. */ }
    }
    return playProceduralCue(cueName, meta);
  }

  function scheduleDestinationArrival({ initial = false } = {}) {
    clearScheduledCues();
    if (!primed || isSuspended()) return;
    settleTimer = setTimeoutRef?.(() => {
      settleTimer = null;
      if (isSuspended()) return;
      cue("settled", { destination, initial });
      if (destination === "forge") cue("forge-chime", { destination, initial });
      if (destination === "arena") {
        cue("arena-portal", { destination, initial });
        arenaThunderTimer = setTimeoutRef?.(() => {
          arenaThunderTimer = null;
          cue("arena-thunder", { destination });
        }, 680);
      }
    }, reducedMotion ? 90 : 540);
  }

  function sync(snapshot = {}) {
    const next = normalizedDestination(snapshot.activeDestination);
    const changed = next !== destination;
    destination = next;
    if (changed) {
      syncStemMix(reducedMotion ? 0.12 : 0.72);
      scheduleDestinationArrival();
    }
    return snapshot;
  }

  function suspend(reason = "manual") {
    if (destroyed) return false;
    const normalizedReason = String(reason || "manual");
    const changed = !suspendedReasons.has(normalizedReason);
    suspendedReasons.add(normalizedReason);
    clearScheduledCues();
    syncStemMix(0.1);
    return changed;
  }

  function resume(reason = "manual") {
    if (destroyed) return false;
    suspendedReasons.delete(String(reason || "manual"));
    if (isSuspended()) return false;
    syncStemMix(0.38);
    return true;
  }

  function setReducedMotion(value) {
    // Motion accessibility changes transition timing, never audio availability.
    reducedMotion = Boolean(value);
    return reducedMotion;
  }

  function syncPreferences() {
    musicChannel?.sync?.();
    effectsChannel?.sync?.();
  }

  function onGesture() {
    if (prime()) {
      for (const [target, type, listener, options] of listeners.filter((entry) => entry[4] === "gesture")) {
        target?.removeEventListener?.(type, listener, options);
      }
    }
  }

  function listenGesture(target, type) {
    const options = { capture: true, passive: true };
    target?.addEventListener?.(type, onGesture, options);
    listeners.push([target, type, onGesture, options, "gesture"]);
  }

  listenGesture(documentRef, "pointerdown");
  listenGesture(documentRef, "touchstart");
  listenGesture(documentRef, "keydown");
  listen(documentRef, "visibilitychange", () => {
    if (documentRef?.hidden) suspend("document-hidden");
    else resume("document-hidden");
  });
  listen(root, "planet-hub-semantic-audio", (event) => cue(event?.detail?.cue, event?.detail || {}));

  return Object.freeze({
    cue,
    prime,
    resume,
    setReducedMotion,
    snapshot() {
      return Object.freeze({
        destination,
        primed,
        reducedMotion,
        suspended: isSuspended(),
        suspendReasons: Object.freeze([...suspendedReasons])
      });
    },
    suspend,
    sync,
    syncPreferences,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      clearScheduledCues();
      for (const [target, type, listener, options] of listeners) target?.removeEventListener?.(type, listener, options);
      listeners.length = 0;
      for (const source of [...transientSources, ...persistentSources]) stopSource(source);
      transientSources.clear();
      persistentSources.clear();
      stemGains.clear();
      musicChannel?.close?.();
      effectsChannel?.close?.();
      musicChannel = null;
      effectsChannel = null;
      context = null;
      return true;
    }
  });
}

export const PLANET_HUB_AUDIO_CUES = Object.freeze(Object.keys(CUE_ALIASES));
