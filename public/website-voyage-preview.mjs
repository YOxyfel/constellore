import { createVoyageProjectionExperience } from "./cinematic/voyage-projection-experience.mjs?v=5.0.0-beta.4";

let activePreview = null;

function createPreviewStorage() {
  const entries = new Map();
  return Object.freeze({
    getItem(key) { return entries.get(String(key)) ?? null; },
    setItem(key, value) { entries.set(String(key), String(value)); },
    removeItem(key) { entries.delete(String(key)); }
  });
}

/**
 * Open the game's current Voyage Projection from an explicit website action.
 * Both storage adapters are ephemeral: even the runtime's first-open session
 * marker stays in memory and cannot suppress a later first launch of the game.
 *
 * The shared runtime owns its dialog, reduced-motion delivery, Escape/Skip,
 * focus/inert restoration, narration, and WebGL/timer cleanup. The returned
 * promise settles only after that cleanup; onClose receives the same outcome.
 * Repeated calls during playback share the first launch and its callback.
 */
export function playWebsiteVoyage({ onClose, onEvent } = {}) {
  if (activePreview) return activePreview;

  activePreview = Promise.resolve().then(async () => {
    let outcome;
    try {
      const experience = createVoyageProjectionExperience({
        storage: createPreviewStorage(),
        sessionStorage: createPreviewStorage(),
        storageKey: "constellore-website-voyage-preview",
        sessionKey: "constellore-website-voyage-preview-session",
        choice: "realtime",
        variant: "promise",
        bypass: false,
        // The website has no game import map. Reuse the same local Three.js
        // build directly, and request it only after the visitor starts play.
        loadThree: () => import("./vendor/three/planet-hub-three.mjs?v=5.0.0-beta.4"),
        onEvent
      });
      outcome = await experience.playLaunch({ force: true, persist: false });
      return outcome;
    } finally {
      activePreview = null;
      onClose?.(outcome);
    }
  });

  return activePreview;
}
