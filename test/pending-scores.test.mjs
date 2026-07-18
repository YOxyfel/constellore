import assert from "node:assert/strict";
import test from "node:test";

import { listPendingScoreRecords, pendingScoreStorageKey, removePendingScoreRecord, savePendingScoreRecord } from "../public/pending-scores.mjs";

class FakeStorage {
  constructor() { this.values = new Map(); this.failWrites = false; }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  removeItem(key) { if (this.failWrites) throw new Error("blocked"); this.values.delete(key); }
  setItem(key, value) { if (this.failWrites) throw new Error("quota"); this.values.set(key, String(value)); }
}

const score = (playerId, runId, savedAt = "2026-07-18T12:00:00.000Z") => ({
  playerId, runId, runToken: `token-${runId}`, savedAt, mode: "quick", target: "Telescope"
});

test("pending score writes are observable when storage is unavailable", () => {
  const storage = new FakeStorage();
  storage.failWrites = true;
  assert.equal(savePendingScoreRecord(storage, score("player", "run")), false);
  assert.equal(removePendingScoreRecord(storage, "player", "run"), false);
});

test("per-run records survive stale cross-tab additions and removals", () => {
  const storage = new FakeStorage();
  assert.equal(savePendingScoreRecord(storage, score("player", "run-a")), true);
  assert.equal(savePendingScoreRecord(storage, score("player", "run-b")), true);
  assert.equal(removePendingScoreRecord(storage, "player", "run-a"), true);
  assert.equal(savePendingScoreRecord(storage, score("player", "run-c")), true);
  assert.deepEqual(listPendingScoreRecords(storage, { now: Date.parse("2026-07-18T13:00:00Z") }).map((entry) => entry.runId), ["run-b", "run-c"]);

  // A late same-run completion can only re-add its own idempotent upload; it
  // cannot erase run-b or run-c as a shared-array write would.
  assert.equal(savePendingScoreRecord(storage, score("player", "run-a")), true);
  assert.deepEqual(new Set(listPendingScoreRecords(storage, { now: Date.parse("2026-07-18T13:00:00Z") }).map((entry) => entry.runId)), new Set(["run-a", "run-b", "run-c"]));
});

test("accounts have independent unbounded-by-other-account score keys", () => {
  const storage = new FakeStorage();
  for (let index = 0; index < 20; index += 1) {
    assert.equal(savePendingScoreRecord(storage, score("account-a", `a-${index}`)), true);
    assert.equal(savePendingScoreRecord(storage, score("account-b", `b-${index}`)), true);
  }
  const records = listPendingScoreRecords(storage, { now: Date.parse("2026-07-18T13:00:00Z") });
  assert.equal(records.filter((entry) => entry.playerId === "account-a").length, 20);
  assert.equal(records.filter((entry) => entry.playerId === "account-b").length, 20);
  assert.notEqual(pendingScoreStorageKey("account-a", "same"), pendingScoreStorageKey("account-b", "same"));
});

test("expired and malformed records are pruned without touching valid scores", () => {
  const storage = new FakeStorage();
  savePendingScoreRecord(storage, score("player", "fresh", "2026-07-18T12:00:00Z"));
  savePendingScoreRecord(storage, score("player", "old", "2026-07-01T12:00:00Z"));
  storage.setItem("constellore-pending-score-v1:bad:key", "not json");
  assert.deepEqual(listPendingScoreRecords(storage, { now: Date.parse("2026-07-18T13:00:00Z") }).map((entry) => entry.runId), ["fresh"]);
});
