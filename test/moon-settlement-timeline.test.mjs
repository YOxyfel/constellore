import test from "node:test";
import assert from "node:assert/strict";
import {
  appendMoonSettlementTimeline,
  exportMoonSettlementTimeline,
  sanitizeMoonSettlementTimeline
} from "../public/moon-settlement-timeline.mjs";

test("timeline records only privacy-safe bounded event fields", () => {
  const timeline = appendMoonSettlementTimeline({}, {
    type: "milestone",
    key: "vault-repaired",
    step: 3,
    customName: "private astronaut name",
    dialogue: "private line"
  }, { at: new Date("2026-08-20T12:00:00Z") });
  assert.deepEqual(timeline.events[0], {
    type: "milestone",
    at: "2026-08-20T12:00:00.000Z",
    key: "vault-repaired",
    step: 3
  });
  assert.doesNotMatch(exportMoonSettlementTimeline(timeline), /private/);
});

test("timeline drops malformed entries and clamps idle gaps", () => {
  const timeline = sanitizeMoonSettlementTimeline({ events: [
    { type: "dialogue", at: "2026-08-20T12:00:00Z", key: "no" },
    { type: "idle-gap", at: "2026-08-20T12:01:00Z", key: "board", durationMs: 999_999_999 }
  ] });
  assert.equal(timeline.events.length, 1);
  assert.equal(timeline.events[0].durationMs, 86_400_000);
});

