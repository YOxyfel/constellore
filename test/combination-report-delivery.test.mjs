import assert from "node:assert/strict";
import test from "node:test";

import {
  createCombinationReportDelivery,
  sanitizeCombinationSuggestion,
  validateCombinationReportEndpoint
} from "../public/combination-report-delivery.mjs";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function fakeTimers() {
  let nextId = 0;
  const active = new Map();
  return {
    active,
    setTimer(callback, delay) {
      const id = ++nextId;
      active.set(id, { callback, delay });
      return id;
    },
    clearTimer(id) {
      active.delete(id);
    }
  };
}

test("anonymous report endpoints and suggestions reject unsafe input", () => {
  assert.equal(validateCombinationReportEndpoint(""), "");
  assert.equal(
    validateCombinationReportEndpoint("https://feedback.example/api/combination-reports"),
    "https://feedback.example/api/combination-reports"
  );
  for (const unsafe of [
    "http://feedback.example/api/combination-reports",
    "https://feedback.example/api/combination-reports?token=secret",
    "https://user:pass@feedback.example/api/combination-reports",
    "https://feedback.example/api/other"
  ]) assert.equal(validateCombinationReportEndpoint(unsafe), "");

  assert.equal(sanitizeCombinationSuggestion("  Bird  "), "Bird");
  assert.equal(sanitizeCombinationSuggestion("https://example.com"), null);
  assert.equal(sanitizeCombinationSuggestion("name@example.com"), null);
  assert.equal(sanitizeCombinationSuggestion("one two three four five"), null);

  const offline = createCombinationReportDelivery({ endpoint: "" });
  assert.equal(offline.submitLabel(true), "Save idea");
  assert.match(offline.deliveryMessage(true), /saved|Saves/i);
  assert.match(offline.deliveryMessage(true), /no account/i);
});

test("one-tap reports save locally, queue safely, and send without credentials", async () => {
  const storage = memoryStorage();
  const timers = fakeTimers();
  const requests = [];
  const delivery = createCombinationReportDelivery({
    endpoint: "https://feedback.example/api/combination-reports",
    storage,
    getMode: () => "reach",
    getReporterId: () => "anonymous_device_123",
    fetchReport: async (...args) => {
      requests.push(args);
      return { ok: true, status: 202 };
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    random: () => 0
  });

  const payload = delivery.payload({ a: "Species", b: "Air", expected: "Bird" });
  assert.equal(delivery.submitLabel(true), "Send idea");
  assert.match(delivery.deliveryMessage(true), /No account/);
  assert.deepEqual(payload, {
    a: "Species",
    b: "Air",
    expected: "Bird",
    reason: "",
    mode: "reach",
    reporterId: "anonymous_device_123"
  });
  assert.equal(delivery.saveLocal({ a: "Species", b: "Air", expected: "Bird" }), true);
  const local = JSON.parse(storage.getItem("constellore-local-expected-pairs-v1"));
  assert.deepEqual(local.reports["air+species"].pair, ["Species", "Air"]);
  assert.equal(JSON.stringify(local).includes("anonymous_device_123"), false);

  assert.match(delivery.queue(payload), /^[a-f0-9]{8}$/);
  assert.equal(delivery.pending().length, 1);
  assert.deepEqual(await delivery.flush(), { sent: 1, retry: false });
  assert.equal(delivery.pending().length, 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], "https://feedback.example/api/combination-reports");
  assert.equal(requests[0][1].credentials, "omit");
  assert.equal(requests[0][1].referrerPolicy, "no-referrer");
});

test("temporary delivery failures stay queued while permanent rejections are dropped", async () => {
  const storage = memoryStorage();
  const timers = fakeTimers();
  let status = 503;
  const delivery = createCombinationReportDelivery({
    endpoint: "https://feedback.example/api/combination-reports",
    storage,
    getMode: () => "quick",
    getReporterId: () => "anonymous_device_456",
    fetchReport: async () => ({ ok: false, status }),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    random: () => 0
  });
  const payload = delivery.payload({ a: "Brick", b: "Brick", expected: "Wall" });
  delivery.queue(payload);
  assert.deepEqual(await delivery.flush(), { sent: 0, retry: true });
  assert.equal(delivery.pending().length, 1);
  assert.equal([...timers.active.values()].some(({ delay }) => delay >= 10_000), true);

  status = 422;
  assert.deepEqual(await delivery.flush(), { sent: 0, retry: false });
  assert.equal(delivery.pending().length, 0);
  delivery.cancel();
  assert.equal(timers.active.size, 0);
});
