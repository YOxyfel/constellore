import test from "node:test";
import assert from "node:assert/strict";
import {
  createMoonSettlementSnapshot,
  createMoonSettlementStorage,
  readMoonSettlementSnapshot
} from "../public/moon-settlement-persistence.mjs";

function sanitize(raw = {}) {
  return {
    version: 1,
    revision: Math.max(0, Math.floor(Number(raw?.revision) || 0)),
    goods: { Soil: Math.max(0, Math.floor(Number(raw?.goods?.Soil) || 0)) }
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values
  };
}

test("snapshot checksum rejects corrupted settlement data", () => {
  const snapshot = createMoonSettlementSnapshot({ revision: 2, goods: { Soil: 4 } }, {
    sanitize,
    at: new Date("2026-08-20T10:00:00Z")
  });
  assert.equal(readMoonSettlementSnapshot(snapshot, { sanitize }).state.goods.Soil, 4);
  assert.equal(readMoonSettlementSnapshot({ ...snapshot, state: { ...snapshot.state, revision: 9 } }, { sanitize }), null);
});

test("storage rotates three validated snapshots and loads the newest revision", () => {
  const storage = memoryStorage();
  let minute = 0;
  const adapter = createMoonSettlementStorage({
    storage,
    sanitize,
    now: () => new Date(Date.UTC(2026, 7, 20, 10, minute++))
  });
  for (let revision = 1; revision <= 5; revision += 1) {
    adapter.save({ revision, goods: { Soil: revision } });
  }
  assert.equal(adapter.snapshots().length, 3);
  assert.deepEqual(adapter.load(), { version: 1, revision: 5, goods: { Soil: 5 } });
});

test("storage recovers from a corrupted newest slot", () => {
  const storage = memoryStorage();
  const adapter = createMoonSettlementStorage({ storage, sanitize });
  adapter.save({ revision: 1, goods: { Soil: 1 } });
  adapter.save({ revision: 2, goods: { Soil: 2 } });
  storage.setItem(adapter.keys[2], "{broken");
  assert.equal(adapter.load().revision, 1);
});

test("export and import remain validated and reset is isolated", () => {
  const storage = memoryStorage();
  const adapter = createMoonSettlementStorage({ storage, sanitize });
  const exported = adapter.exportJson({ revision: 7, goods: { Soil: 6 } });
  const imported = adapter.importJson(exported);
  assert.equal(imported.goods.Soil, 6);
  assert.throws(() => adapter.importJson(exported.replace('"Soil": 6', '"Soil": 600')), /validation/);
  adapter.reset();
  assert.equal(adapter.snapshots().length, 0);
});

test("a validated lower-revision import replaces newer rotating slots", () => {
  const storage = memoryStorage();
  let minute = 0;
  const adapter = createMoonSettlementStorage({
    storage,
    sanitize,
    now: () => new Date(Date.UTC(2026, 7, 20, 10, minute++))
  });
  const older = adapter.exportJson({ revision: 1, goods: { Soil: 3 } });
  adapter.save({ revision: 8, goods: { Soil: 8 } });
  adapter.save({ revision: 9, goods: { Soil: 9 } });

  adapter.importJson(older);

  assert.deepEqual(adapter.load(), { version: 1, revision: 1, goods: { Soil: 3 } });
  assert.equal(adapter.snapshots().length, 1);
});
