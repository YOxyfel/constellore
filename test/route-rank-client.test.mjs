import assert from "node:assert/strict";
import test from "node:test";

import {
  routeRankChangeMessage,
  sanitizeRouteOutcomeHashes,
  sanitizeRouteRankSummary,
  sanitizeStartStylePreference
} from "../public/route-rank-client.mjs";

test("starting-word preferences stay within the three player-facing choices", () => {
  assert.equal(sanitizeStartStylePreference(" SHUFFLED "), "shuffled");
  assert.equal(sanitizeStartStylePreference("anything-else"), "auto");
});

test("recorded route outcomes are unique, bounded fingerprints", () => {
  const values = Array.from({ length: 300 }, (_, index) => index.toString(16).padStart(8, "0"));
  assert.equal(sanitizeRouteOutcomeHashes([...values, values.at(-1), "not-a-hash"]).length, 256);
  assert.equal(sanitizeRouteOutcomeHashes(null).length, 0);
});

test("route-rank summaries clamp untrusted counters and preserve safe presentation", () => {
  const summary = sanitizeRouteRankSummary({
    rank: "cosmic",
    challengeRank: "cosmic",
    mastery: { points: -4, fraction: 4 },
    promotion: { attemptsTotal: 99, winsRequired: 0 },
    remixIntensity: { activeCount: 99 },
    familyMastery: { chain: { wins: 2 } }
  });
  assert.equal(summary.rank.id, "cosmic");
  assert.equal(summary.mastery.points, 0);
  assert.equal(summary.mastery.fraction, 1);
  assert.equal(summary.promotion.attemptsTotal, 3);
  assert.equal(summary.promotion.winsRequired, 2);
  assert.equal(summary.remixIntensity.activeCount, 5);
  assert.deepEqual(summary.familyMastery, { chain: { wins: 2 } });
});

test("rank-up messages celebrate a newly unlocked sky without overpromising every promotion", () => {
  const bronze = sanitizeRouteRankSummary({ rank: "bronze" });
  const silver = sanitizeRouteRankSummary({ rank: "silver" });
  const gold = sanitizeRouteRankSummary({ rank: "gold" });
  assert.match(routeRankChangeMessage(bronze, silver), /Promotion complete/);
  assert.match(routeRankChangeMessage(silver, gold), /board unlocked/);
});
