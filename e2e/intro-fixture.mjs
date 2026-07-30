export const FIRST_OPEN_CINEMATIC_STORAGE_KEY = "constellore-first-open-cinematic-v1";
export const FIRST_OPEN_CINEMATIC_BYPASS_KEY = "constellore-e2e-skip-launch-cinematic-v1";
export const FIRST_OPEN_CINEMATIC_SESSION_KEY = "constellore-launch-cinematic-session-v1";

const COMPLETED_INTRO_RECORD = Object.freeze({
  schemaVersion: 1,
  completed: true,
  completedAt: "2026-01-01T00:00:00.000Z"
});

/**
 * Keep non-cinematic browser tests deterministic. Install this after any
 * per-spec storage reset so the application starts on the surface the test is
 * actually intended to exercise.
 */
export async function installSeenIntroFixture(page) {
  await page.addInitScript(({ key, bypassKey, sessionKey, record }) => {
    localStorage.setItem(key, JSON.stringify(record));
    sessionStorage.removeItem(bypassKey);
    sessionStorage.setItem(sessionKey, "played");
  }, {
    key: FIRST_OPEN_CINEMATIC_STORAGE_KEY,
    bypassKey: FIRST_OPEN_CINEMATIC_BYPASS_KEY,
    sessionKey: FIRST_OPEN_CINEMATIC_SESSION_KEY,
    record: COMPLETED_INTRO_RECORD
  });
}
