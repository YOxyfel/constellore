import { sanitizeFeedbackPreferences } from "./engagement-features.mjs?v=5.0.0-beta.1";

const TOGGLES = Object.freeze([
  ["sound", "soundPreference", "audio_toggled"],
  ["music", "musicPreference", "music_toggled"],
  ["haptics", "hapticPreference", "haptic_toggled"],
  ["resultDetails", "resultDetailsPreference", "result_details_toggled"]
]);

const VOLUMES = Object.freeze([
  ["volume", Object.freeze([
    ["masterVolumePreference", "masterVolumeValue"],
    ["playMasterVolumePreference", "playMasterVolumeValue"],
    ["pauseMasterVolumePreference", "pauseMasterVolumeValue"],
    ["circuitMasterVolumePreference", "circuitMasterVolumeValue"]
  ])],
  ["musicVolume", Object.freeze([
    ["musicVolumePreference", "musicVolumeValue"],
    ["playMusicVolumePreference", "playMusicVolumeValue"],
    ["pauseMusicVolumePreference", "pauseMusicVolumeValue"],
    ["circuitMusicVolumePreference", "circuitMusicVolumeValue"]
  ])],
  ["sfxVolume", Object.freeze([
    ["sfxVolumePreference", "sfxVolumeValue"],
    ["playSfxVolumePreference", "playSfxVolumeValue"],
    ["pauseSfxVolumePreference", "pauseSfxVolumeValue"],
    ["circuitSfxVolumePreference", "circuitSfxVolumeValue"]
  ])]
]);

const QUICK_MASTER_OUTPUTS = Object.freeze([
  "playMasterVolumeQuickValue",
  "pauseMasterVolumeQuickValue",
  "circuitMasterVolumeQuickValue"
]);

const QUICK_MASTER_STEPS = Object.freeze([
  ["playVolumeDown", -.05],
  ["playVolumeUp", .05],
  ["pauseVolumeDown", -.05],
  ["pauseVolumeUp", .05],
  ["circuitVolumeDown", -.05],
  ["circuitVolumeUp", .05]
]);

const percentage = (value) => `${Math.round(Number(value) * 100)}%`;

export function createFeedbackPreferencesUi({
  root = globalThis.document,
  get = () => ({}),
  set = () => {},
  save = () => {},
  audio = null,
  track = () => {}
} = {}) {
  const byId = (id) => root?.getElementById?.(id) || null;
  const dirtyVolumes = new Set();
  let lastPreviewAt = 0;

  const setRangePresentation = (field, input, output, preferences) => {
    const value = preferences[field];
    const label = percentage(value);
    if (input) {
      input.value = String(value);
      input.setAttribute("aria-valuetext", `${label.slice(0, -1)} percent`);
    }
    if (output) output.textContent = label;
  };

  const renderVolume = (field, controls, preferences) => {
    for (const [inputId, outputId] of controls) {
      setRangePresentation(field, byId(inputId), byId(outputId), preferences);
    }
  };

  const renderQuickMaster = (preferences) => {
    const label = percentage(preferences.volume);
    for (const outputId of QUICK_MASTER_OUTPUTS) {
      const output = byId(outputId);
      if (output) output.textContent = label;
    }
    for (const [buttonId, delta] of QUICK_MASTER_STEPS) {
      const button = byId(buttonId);
      if (button) button.disabled = delta < 0 ? preferences.volume <= 0 : preferences.volume >= 1;
    }
  };

  const applyLiveVolume = (field, preferences) => {
    audio?.prime?.();
    audio?.setPreferences?.();
    const now = Date.now();
    if (field !== "musicVolume" && preferences.sound && preferences.volume > 0 && preferences.sfxVolume > 0 && now - lastPreviewAt >= 120) {
      lastPreviewAt = now;
      audio?.playFeedback?.("uiSelect");
    }
  };

  const render = (raw = get()) => {
    const preferences = sanitizeFeedbackPreferences(raw);
    set(preferences);
    for (const [field, id] of TOGGLES) {
      const button = byId(id);
      if (!button) continue;
      button.setAttribute("aria-pressed", String(preferences[field]));
      const status = button.querySelector?.("small");
      if (status) status.textContent = preferences[field] ? "ON" : "OFF";
    }
    for (const [field, controls] of VOLUMES) {
      renderVolume(field, controls, preferences);
    }
    renderQuickMaster(preferences);
    const quickToggle = byId("feedbackToggle");
    if (quickToggle) {
      quickToggle.setAttribute("aria-pressed", String(preferences.sound));
      quickToggle.setAttribute("aria-label", preferences.sound ? "Mute sound effects" : "Enable sound effects");
      const icon = quickToggle.querySelector?.("span");
      if (icon) icon.textContent = preferences.sound ? "♪" : "×";
    }
    const resultDetails = byId("resultDetails");
    if (resultDetails) resultDetails.hidden = !preferences.resultDetails;
    audio?.setPreferences?.();
    return preferences;
  };

  const toggle = (field, eventName) => {
    const preferences = sanitizeFeedbackPreferences(get());
    preferences[field] = !preferences[field];
    set(preferences);
    save(preferences, field);
    track(eventName, { enabled: preferences[field] });
    if (field === "music" && preferences.music) audio?.prime?.();
    else if ((field === "sound" && preferences.sound) || (field === "haptics" && preferences.haptics)) {
      audio?.playFeedback?.("uiSelect");
    }
  };

  for (const [field, id, eventName] of TOGGLES) {
    byId(id)?.addEventListener?.("click", () => toggle(field, eventName));
  }
  byId("feedbackToggle")?.addEventListener?.("click", () => toggle("sound", "audio_toggled"));

  for (const [field, controls] of VOLUMES) {
    for (const [inputId] of controls) {
      const input = byId(inputId);
      input?.addEventListener?.("input", () => {
        const preferences = sanitizeFeedbackPreferences({ ...get(), [field]: input.value });
        set(preferences);
        renderVolume(field, controls, preferences);
        if (field === "volume") renderQuickMaster(preferences);
        dirtyVolumes.add(field);
        applyLiveVolume(field, preferences);
      });
      input?.addEventListener?.("change", () => {
        const previous = sanitizeFeedbackPreferences(get())[field];
        const preferences = sanitizeFeedbackPreferences({ ...get(), [field]: input.value });
        set(preferences);
        renderVolume(field, controls, preferences);
        if (field === "volume") renderQuickMaster(preferences);
        if (dirtyVolumes.delete(field) || preferences[field] !== previous) {
          save(preferences, field);
        }
      });
    }
  }

  for (const [buttonId, delta] of QUICK_MASTER_STEPS) {
    byId(buttonId)?.addEventListener?.("click", () => {
      const current = sanitizeFeedbackPreferences(get());
      const nextVolume = Math.min(1, Math.max(0, Number((current.volume + delta).toFixed(2))));
      if (nextVolume === current.volume) {
        renderQuickMaster(current);
        return;
      }
      const preferences = sanitizeFeedbackPreferences({ ...current, volume: nextVolume });
      set(preferences);
      renderVolume("volume", VOLUMES[0][1], preferences);
      renderQuickMaster(preferences);
      dirtyVolumes.delete("volume");
      save(preferences, "volume");
      applyLiveVolume("volume", preferences);
    });
  }

  return Object.freeze({ render });
}
