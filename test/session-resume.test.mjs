import assert from "node:assert/strict";
import test from "node:test";

import {
  CLIENT_ONLY_RESUME_MODES,
  FIRST_OPEN_CINEMATIC_SESSION_KEY,
  activeRunSnapshotIsValid,
  clientOnlyRestorePayload,
  createClientRunPersistence,
  markLaunchCinematicSessionPlayed,
  navigationIsReload,
  selectStartupResumeSnapshot,
  snapshotMatchesLaunchIntent
} from "../public/session-resume.mjs";

const NOW = Date.parse("2026-07-29T12:00:00.000Z");

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }
}

function clientSnapshot(mode, {
  now = NOW,
  overrides = {}
} = {}) {
  const canonical = {
    training: { target: "Mud", seed: 101, id: "training-contract", token: "local-training", hasRuntimeRun: true },
    "second-orbit": { target: "Mountain", seed: 202, id: "client-second-orbit-contract", token: "client-only", hasRuntimeRun: false },
    explore: { target: "Free exploration", seed: 31_415, id: "client-explore-contract", token: "client-only", hasRuntimeRun: false }
  }[mode];
  assert.ok(canonical, `missing canonical fixture for ${mode}`);
  const base = {
    version: 1,
    savedAt: new Date(now).toISOString(),
    game: { mode, target: canonical.target, seed: canonical.seed },
    journeyContext: null,
    run: {
      id: canonical.id,
      token: canonical.token,
      startedAt: new Date(now - 30_000).toISOString(),
      deadlineAt: null,
      activationPending: false,
      scoreEligible: false,
      ranked: false,
      localOnly: true,
      clientOnly: true,
      hasRuntimeRun: canonical.hasRuntimeRun
    },
    progress: {
      completed: false,
      submitted: false,
      scoringDisabled: true,
      scoreMultiplier: 0,
      assist: mode === "training" ? "training" : "none",
      history: []
    },
    visuals: {}
  };
  return {
    ...base,
    ...overrides,
    game: { ...base.game, ...overrides.game },
    run: { ...base.run, ...overrides.run },
    progress: { ...base.progress, ...overrides.progress }
  };
}

test("the launch-session marker is scoped to session storage and fails open", () => {
  const storage = new MemoryStorage();
  assert.equal(markLaunchCinematicSessionPlayed(storage), true);
  assert.equal(storage.getItem(FIRST_OPEN_CINEMATIC_SESSION_KEY), "played");
  assert.equal(markLaunchCinematicSessionPlayed({
    setItem() {
      throw new Error("blocked");
    }
  }), false);
});

test("reload and matching launch intents select the saved run without hijacking a different URL", () => {
  const snapshot = { game: { mode: "reach", target: "Moon", seed: 42 } };
  assert.equal(navigationIsReload({ getEntriesByType: () => [{ type: "reload" }] }), true);
  assert.equal(navigationIsReload({ getEntriesByType: () => [], navigation: { type: 1 } }), true);
  assert.equal(navigationIsReload({ getEntriesByType: () => [{ type: "navigate" }] }), false);

  assert.equal(selectStartupResumeSnapshot({ snapshot, reload: true }), snapshot);
  assert.equal(selectStartupResumeSnapshot({ snapshot, reload: false }), snapshot);
  assert.equal(
    selectStartupResumeSnapshot({
      snapshot,
      sharedChallenge: { target: " moon ", seed: "42" },
      reload: false
    }),
    snapshot
  );
  assert.equal(
    selectStartupResumeSnapshot({
      snapshot,
      sharedChallenge: { target: "Sun", seed: 42 },
      reload: false
    }),
    null
  );
  assert.equal(snapshotMatchesLaunchIntent(
    { game: { mode: "explore" } },
    null,
    "creator"
  ), true);
  assert.equal(selectStartupResumeSnapshot({
    snapshot,
    modeIntent: "daily",
    reload: false
  }), null);
});

test("client persistence is restricted to the three unranked local modes", () => {
  assert.deepEqual([...CLIENT_ONLY_RESUME_MODES], ["training", "second-orbit", "explore"]);
  assert.equal(createClientRunPersistence({ game: { mode: "reach" } }), null);
  const persistence = createClientRunPersistence({
    game: { mode: "explore" },
    startedAt: NOW,
    cryptoRef: { randomUUID: () => "contract-id" },
    now: () => NOW
  });
  assert.deepEqual(persistence, {
    id: "client-explore-contract-id",
    token: "client-only",
    startedAt: new Date(NOW).toISOString(),
    deadlineAt: null,
    activationPending: false,
    scoreEligible: false,
    scoreMultiplier: 0,
    ranked: false,
    localOnly: true
  });
});

test("client-only snapshots rebuild canonical games and reject forged rules or score eligibility", () => {
  for (const mode of CLIENT_ONLY_RESUME_MODES) {
    const snapshot = clientSnapshot(mode);
    const payload = clientOnlyRestorePayload(snapshot, { now: () => NOW });
    assert.ok(payload, `${mode} should restore`);
    assert.equal(payload.game.mode, mode);
    assert.equal(payload.game.target, snapshot.game.target);
    assert.equal(payload.game.seed, snapshot.game.seed);
    assert.equal(payload.persistenceRun.clientOnly, true);
    assert.equal(payload.persistenceRun.ranked, false);
    assert.equal(payload.persistenceRun.scoreEligible, false);
    assert.equal(payload.progress.scoringDisabled, true);
    assert.equal(payload.progress.scoreMultiplier, 0);
    assert.equal(Boolean(payload.run), mode === "training");
    assert.equal(activeRunSnapshotIsValid(snapshot, { now: () => NOW }), true);
  }

  assert.equal(clientOnlyRestorePayload(clientSnapshot("training", {
    overrides: { game: { target: "Forged target" } }
  }), { now: () => NOW }), null);
  assert.equal(clientOnlyRestorePayload(clientSnapshot("explore", {
    overrides: { run: { ranked: true } }
  }), { now: () => NOW }), null);
  assert.equal(clientOnlyRestorePayload(clientSnapshot("second-orbit", {
    overrides: { progress: { scoringDisabled: false } }
  }), { now: () => NOW }), null);
  assert.equal(activeRunSnapshotIsValid(clientSnapshot("explore", {
    overrides: { run: { clientOnly: false } }
  }), { now: () => NOW }), false);
});

test("active snapshot validation keeps hosted runs generic but rejects stale and future records", () => {
  const hosted = {
    version: 1,
    savedAt: new Date(NOW).toISOString(),
    game: { mode: "reach", target: "Moon", seed: 42 },
    run: { id: "hosted-run", token: "hosted-token", clientOnly: false }
  };
  assert.equal(activeRunSnapshotIsValid(hosted, { now: () => NOW }), true);
  assert.equal(activeRunSnapshotIsValid({
    ...hosted,
    savedAt: new Date(NOW - 8 * 86_400_000).toISOString()
  }, { now: () => NOW }), false);
  assert.equal(activeRunSnapshotIsValid({
    ...hosted,
    savedAt: new Date(NOW + 61_000).toISOString()
  }, { now: () => NOW }), false);
});
