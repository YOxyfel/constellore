import test from "node:test";
import assert from "node:assert/strict";
import { AiRequestGate, MemoryRateLimiter, safeConcept, safeDiscoveryContext, trustedWriteOrigin } from "../server-safety.mjs";

test("AI concepts and discovery context are tightly bounded", () => {
  assert.equal(safeConcept("  Space   Station "), "Space Station");
  assert.equal(safeConcept("<script>alert(1)</script>"), null);
  assert.equal(safeConcept("x".repeat(81)), null);
  assert.deepEqual(safeDiscoveryContext(["Fire", "fire", " Water ", "<bad>", ...Array.from({ length: 60 }, (_, index) => `Word ${index}`)]).slice(0, 2), ["Fire", "Water"]);
  assert.equal(safeDiscoveryContext(Array.from({ length: 60 }, (_, index) => `Word ${index}`)).length, 40);
});

test("rate limiter expires and caps attacker-controlled keys", () => {
  const limiter = new MemoryRateLimiter({ windowMs: 1_000, maximumKeys: 100 });
  assert.equal(limiter.limited("one", 2, 0), false);
  assert.equal(limiter.limited("one", 2, 1), false);
  assert.equal(limiter.limited("one", 2, 2), true);
  assert.equal(limiter.limited("one", 2, 1_001), false);
  for (let index = 0; index < 150; index += 1) limiter.limited(`key-${index}`, 2, 2_000 + index);
  limiter.sweep(2_200);
  assert.ok(limiter.records.size <= 100);
});

test("AI request gate enforces concurrency and a daily budget", () => {
  const gate = new AiRequestGate({ maximumConcurrent: 1, dailyLimit: 2 });
  const releaseFirst = gate.acquire(new Date("2026-07-22T12:00:00Z"));
  assert.throws(() => gate.acquire(new Date("2026-07-22T12:00:01Z")), (error) => error.code === "ai_busy");
  releaseFirst();
  const releaseSecond = gate.acquire(new Date("2026-07-22T12:01:00Z"));
  releaseSecond();
  assert.throws(() => gate.acquire(new Date("2026-07-22T12:02:00Z")), (error) => error.code === "ai_budget_reached");
  const releaseTomorrow = gate.acquire(new Date("2026-07-23T00:00:00Z"));
  releaseTomorrow();
});

test("write origin allowlist rejects unknown sites", () => {
  const allowed = ["https://yoxyfel.github.io/constellore/", "https://constellore.example"];
  assert.equal(trustedWriteOrigin("https://yoxyfel.github.io", allowed), true);
  assert.equal(trustedWriteOrigin("https://evil.example", allowed), false);
  assert.equal(trustedWriteOrigin("not-a-url", allowed), false);
  assert.equal(trustedWriteOrigin("", allowed), true);
});
