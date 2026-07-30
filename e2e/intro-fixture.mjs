export const FIRST_OPEN_CINEMATIC_STORAGE_KEY = "constellore-first-open-cinematic-v1";
export const FIRST_OPEN_CINEMATIC_BYPASS_KEY = "constellore-e2e-skip-launch-cinematic-v1";
export const FIRST_OPEN_CINEMATIC_SESSION_KEY = "constellore-launch-cinematic-session-v1";

const COMPLETED_INTRO_RECORD = Object.freeze({
  schemaVersion: 1,
  completed: true,
  completedAt: "2026-01-01T00:00:00.000Z"
});

const STORAGE_RESET_MARKER = "constellore-e2e-seen-intro-storage-reset-v1";

/**
 * Keep non-cinematic browser tests deterministic. Storage resets and seed
 * values can be installed in this same init script so their order cannot race
 * the returning-player cinematic marker.
 */
export async function installSeenIntroFixture(page, {
  resetStorage = false,
  localStorageEntries = [],
  launchToMenu = false
} = {}) {
  await page.addInitScript(({
    key,
    bypassKey,
    sessionKey,
    resetMarker,
    record,
    shouldResetStorage,
    seededLocalStorageEntries,
    shouldLaunchToMenu
  }) => {
    const firstStorageReset = shouldResetStorage
      && sessionStorage.getItem(resetMarker) !== "true"
      && localStorage.getItem(resetMarker) !== "true";
    if (firstStorageReset) {
      localStorage.clear();
      sessionStorage.clear();
    }
    if (shouldResetStorage) {
      // WebKit can expose the new document before its session storage marker
      // is restored. Mirror the one-time guard in durable origin storage so a
      // reload cannot accidentally clear and reseed the active test profile.
      localStorage.setItem(resetMarker, "true");
      sessionStorage.setItem(resetMarker, "true");
    }
    if (!shouldResetStorage || firstStorageReset) {
      for (const [entryKey, entryValue] of seededLocalStorageEntries) {
        localStorage.setItem(entryKey, entryValue);
      }
    }
    localStorage.setItem(key, JSON.stringify(record));
    if (shouldLaunchToMenu) sessionStorage.removeItem(bypassKey);
    else sessionStorage.setItem(bypassKey, "true");
    sessionStorage.setItem(sessionKey, "played");
  }, {
    key: FIRST_OPEN_CINEMATIC_STORAGE_KEY,
    bypassKey: FIRST_OPEN_CINEMATIC_BYPASS_KEY,
    sessionKey: FIRST_OPEN_CINEMATIC_SESSION_KEY,
    resetMarker: STORAGE_RESET_MARKER,
    record: COMPLETED_INTRO_RECORD,
    shouldResetStorage: resetStorage,
    seededLocalStorageEntries: localStorageEntries,
    shouldLaunchToMenu: launchToMenu
  });
}
