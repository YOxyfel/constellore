import assert from "node:assert/strict";
import test from "node:test";

import {
  COSMOS_CIRCUIT_COPY,
  COSMOS_CIRCUIT_COPY_VERSION,
  cosmosCircuitCopy,
  cosmosCircuitLocale,
  cosmosCircuitPassCopy,
  cosmosCircuitPolicyCopy
} from "../public/cosmos-circuit-copy.mjs";

test("Circuit copy resolves language variants and falls back safely", () => {
  assert.equal(cosmosCircuitLocale("en-US"), "en");
  assert.equal(cosmosCircuitLocale("../../bad"), "en");
  assert.equal(
    cosmosCircuitCopy("flight.target", { kind: "planet gate", direction: "left" }, "en-US"),
    "Next planet gate: left"
  );
  assert.equal(cosmosCircuitCopy("missing.key"), "missing.key");
});

test("Circuit onboarding copy names every fairness boundary", () => {
  const values = Object.values(COSMOS_CIRCUIT_COPY.en).join(" ");
  assert.match(values, /Practice uses today's exact course/i);
  assert.match(values, /never grants material rewards/i);
  assert.match(values, /earned Launch Pass/i);
  assert.match(values, /Entries are never sold/i);
  assert.match(values, /only cosmetics/i);
  assert.match(values, /Neither lane changes speed, scores, Launch Passes, powers, or reward quantities/i);
});

test("Crazy Path copy states the complete earned-only risk and fixed rewards", () => {
  const entries = Object.entries(COSMOS_CIRCUIT_COPY.en)
    .filter(([key]) => key.startsWith("crazy."));
  const values = entries.map(([, value]) => value).join(" ");
  assert.ok(entries.length >= 20);
  assert.match(values, /all.or.nothing/i);
  assert.match(values, /One miss ends the attempt with zero reward/i);
  assert.match(values, /3 earned Launch Passes/i);
  assert.match(values, /not refunded/i);
  assert.match(values, /No extraction or partial milestone reward/i);
  assert.match(values, /20 Shield, 20 Phase, 20 Magnet, and 20 Time Warp/i);
  assert.match(values, /90 of each, 360 powers total/i);
  assert.match(values, /elapsed days accrue/i);
  assert.doesNotMatch(values, /\b(?:buy|purchase|checkout|price|ticket-sale|cloud saving|cloud sync)\b/i);
});

test("pass, UTC, streak-shield, and repeat-Cosmos policies have reusable player-facing copy", () => {
  const passes = cosmosCircuitPassCopy({
    passes: 4,
    maximumPasses: 6,
    pureWins: { current: 2, required: 4 },
    pendingTotal: 2
  });
  assert.equal(passes.status, "4 / 6 Launch Passes");
  assert.match(passes.pureProgress, /2 \/ 4/);
  assert.match(passes.pending, /2 earned Launch Pass grants/);
  assert.match(passes.rankPending, /never expires/i);
  const policy = cosmosCircuitPolicyCopy();
  assert.match(policy.utcDay, /00:00 UTC/);
  assert.match(policy.streakShield, /covers one missed UTC day/i);
  assert.match(policy.firstCosmos, /4 of every/i);
  assert.match(policy.repeatCosmos, /Galaxy payout, 2 of every/i);
  assert.equal(COSMOS_CIRCUIT_COPY_VERSION, 2);
});
