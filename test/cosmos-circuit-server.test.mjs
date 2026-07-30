import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { GameStore, chainCircuitTelemetry } from "../game-services.mjs";
import {
  CIRCUIT_BOOSTS,
  CRAZY_PATH_DAILY_DAYS,
  CRAZY_PATH_DAILY_POWERS,
  CRAZY_PATH_ENTRY_PASSES,
  CRAZY_PATH_INSTANT_POWERS,
  cosmosCircuitCourse
} from "../public/cosmos-circuit.mjs";
import { createRemixProgressionState } from "../public/remix-progression.mjs";
import { server } from "../server.mjs";

const DAY_MS = 86_400_000;
const START_MS = Date.parse("2026-07-27T12:00:00.000Z");

function signedTelemetry(active, events) {
  return chainCircuitTelemetry(events, active.telemetrySeed);
}

async function registeredStore(startMs = START_MS) {
  let clockMs = startMs;
  const store = await new GameStore(":memory:", {
    clock: () => new Date(clockMs)
  }).init();
  const player = await store.registerPlayer();
  return {
    store,
    playerId: player.id,
    now: () => clockMs,
    setNow: (value) => {
      clockMs = value;
    }
  };
}

function perfectTelemetry(course) {
  let elapsedMs = 0;
  return course.segments.map((segment) => {
    const startMs = course.segments
      .slice(0, segment.index)
      .reduce((sum, candidate) => sum + candidate.durationMs, 0);
    const endElapsedMs = elapsedMs + segment.durationMs;
    const expectedType = segment.kind === "planet-gate"
      ? "gate"
      : segment.kind === "black-hole"
        ? "blackHole"
        : segment.kind === "ability-gate"
          ? "beacon"
          : "";
    const target = course.checkpoints.find((candidate) =>
      candidate.type === expectedType
      && candidate.at >= startMs
      && candidate.at < startMs + segment.durationMs
    ) || (() => {
      const angle = ((course.seed + segment.index * 7919) % 628) / 100;
      return {
        x: Math.min(0.82, Math.max(0.18, 0.5 + Math.sin(angle) * 0.28)),
        y: Math.min(0.82, Math.max(0.18, 0.5 + Math.cos(angle * 1.7) * 0.28))
      };
    })();
    const dust = course.checkpoints
      .filter((candidate) =>
        candidate.type === "stardust"
        && candidate.at >= startMs
        && candidate.at < startMs + segment.durationMs
      )
      .map((candidate) => ({
        progressMs: candidate.at - startMs,
        x: candidate.x,
        y: candidate.y
      }));
    const waypoints = [
      { progressMs: 0, x: 0.5, y: 0.5 },
      ...dust,
      { progressMs: segment.durationMs, x: target.x, y: target.y }
    ].sort((left, right) => left.progressMs - right.progressMs);
    const progresses = new Set([0, segment.durationMs, ...dust.map((candidate) => candidate.progressMs)]);
    for (let progressMs = 160; progressMs < segment.durationMs; progressMs += 160) progresses.add(progressMs);
    const positionAt = (progressMs) => {
      if (progressMs <= 0) return waypoints[0];
      for (let index = 1; index < waypoints.length; index += 1) {
        const right = waypoints[index];
        if (right.progressMs < progressMs) continue;
        const left = waypoints[index - 1];
        const span = right.progressMs - left.progressMs;
        const ratio = span ? (progressMs - left.progressMs) / span : 0;
        return {
          x: left.x + (right.x - left.x) * ratio,
          y: left.y + (right.y - left.y) * ratio
        };
      }
      return waypoints.at(-1);
    };
    const samples = [...progresses].sort((left, right) => left - right).map((progressMs) => {
      const position = positionAt(progressMs);
      return {
        progressMs,
        elapsedMs: elapsedMs + progressMs,
        x: Number(position.x.toFixed(4)),
        y: Number(position.y.toFixed(4))
      };
    });
    const abilityOffset = (course.seed + segment.index) % CIRCUIT_BOOSTS.length;
    const ability = segment.kind === "ability-gate"
      ? CIRCUIT_BOOSTS[abilityOffset]
      : "";
    const event = {
      segmentId: segment.id,
      outcome: "perfect",
      stardust: segment.stardust,
      ability,
      useAbility: "",
      samples,
      elapsedMs: endElapsedMs
    };
    elapsedMs = endElapsedMs;
    return event;
  });
}

function boundedCrazyTelemetry(course) {
  let elapsedMs = 0;
  let origin = { x: 0.5, y: 0.5 };
  return course.segments.map((segment) => {
    const startMs = course.segments
      .slice(0, segment.index)
      .reduce((sum, candidate) => sum + candidate.durationMs, 0);
    const expectedType = segment.kind === "planet-gate"
      ? "gate"
      : segment.kind === "black-hole"
        ? "blackHole"
        : segment.kind === "ability-gate"
          ? "beacon"
          : "";
    const target = course.checkpoints.find((candidate) =>
      candidate.type === expectedType
      && candidate.at >= startMs
      && candidate.at < startMs + segment.durationMs
    ) || (() => {
      const angle = ((course.seed + segment.index * 7919) % 628) / 100;
      return {
        x: Math.min(0.82, Math.max(0.18, 0.5 + Math.sin(angle) * 0.28)),
        y: Math.min(0.82, Math.max(0.18, 0.5 + Math.cos(angle * 1.7) * 0.28))
      };
    })();
    const progresses = [0];
    for (let progressMs = 160; progressMs < segment.durationMs; progressMs += 160) {
      progresses.push(progressMs);
    }
    progresses.push(segment.durationMs);
    const samples = progresses.map((progressMs) => {
      const ratio = progressMs / segment.durationMs;
      return {
        progressMs,
        elapsedMs: elapsedMs + progressMs,
        x: Number((origin.x + (target.x - origin.x) * ratio).toFixed(4)),
        y: Number((origin.y + (target.y - origin.y) * ratio).toFixed(4))
      };
    });
    const abilityOffset = (course.seed + segment.index) % CIRCUIT_BOOSTS.length;
    const ability = segment.kind === "ability-gate"
      ? CIRCUIT_BOOSTS[abilityOffset]
      : "";
    elapsedMs += segment.durationMs;
    origin = { x: target.x, y: target.y };
    return {
      segmentId: segment.id,
      outcome: "perfect",
      stardust: 0,
      ability,
      useAbility: "",
      samples,
      elapsedMs
    };
  });
}

function firstRequiredMissTelemetry(course) {
  const event = structuredClone(perfectTelemetry(course)[0]);
  const segment = course.segments[0];
  assert.equal(segment.required, true);
  const target = course.checkpoints.find((candidate) =>
    candidate.type === "gate"
    && candidate.at >= 0
    && candidate.at < segment.durationMs
  );
  assert.ok(target);
  const destination = [
    { x: 0.04, y: 0.06 },
    { x: 0.04, y: 0.94 },
    { x: 0.96, y: 0.06 },
    { x: 0.96, y: 0.94 }
  ].sort((left, right) =>
    Math.hypot(right.x - target.x, right.y - target.y)
    - Math.hypot(left.x - target.x, left.y - target.y)
  )[0];
  event.outcome = "perfect";
  event.stardust = segment.stardust;
  event.ability = "";
  event.useAbility = "";
  event.samples = event.samples.map((sample) => {
    const progress = sample.progressMs / segment.durationMs;
    return {
      ...sample,
      x: Number((0.5 + (destination.x - 0.5) * progress).toFixed(4)),
      y: Number((0.5 + (destination.y - 0.5) * progress).toFixed(4))
    };
  });
  return [event];
}

function retimeTelemetry(events, course, segmentElapsedMs) {
  let elapsedMs = 0;
  return events.map((event, index) => {
    const segment = course.segments[index];
    const nextElapsedMs = elapsedMs + segmentElapsedMs;
    const samples = event.samples.map((sample) => ({
      progressMs: sample.progressMs,
      elapsedMs: elapsedMs + Math.round((sample.progressMs / segment.durationMs) * segmentElapsedMs),
      x: 0.5,
      y: 0.5
    }));
    samples[0].elapsedMs = elapsedMs;
    samples[samples.length - 1].elapsedMs = nextElapsedMs;
    elapsedMs = nextElapsedMs;
    return { ...event, samples, elapsedMs: nextElapsedMs };
  });
}

function offTargetTelemetry(course) {
  let elapsedMs = 0;
  return course.segments.map((segment) => {
    const startMs = course.segments
      .slice(0, segment.index)
      .reduce((sum, candidate) => sum + candidate.durationMs, 0);
    const relevant = course.checkpoints.filter((candidate) =>
      candidate.at >= startMs
      && candidate.at < startMs + segment.durationMs
    );
    const corners = [
      { x: 0.04, y: 0.06 },
      { x: 0.04, y: 0.94 },
      { x: 0.96, y: 0.06 },
      { x: 0.96, y: 0.94 }
    ];
    const corner = corners
      .map((candidate) => ({
        ...candidate,
        clearance: Math.min(...relevant.map((checkpoint) =>
          Math.hypot(candidate.x - checkpoint.x, candidate.y - checkpoint.y)
        ))
      }))
      .sort((left, right) => right.clearance - left.clearance)[0];
    const progresses = [0];
    for (let progressMs = 240; progressMs < segment.durationMs; progressMs += 240) progresses.push(progressMs);
    progresses.push(segment.durationMs);
    const samples = progresses.map((progressMs, index) => ({
      progressMs,
      elapsedMs: elapsedMs + progressMs,
      x: index === 0 ? 0.5 : corner.x,
      y: index === 0 ? 0.5 : corner.y
    }));
    elapsedMs += segment.durationMs;
    return {
      segmentId: segment.id,
      outcome: "perfect",
      stardust: segment.stardust,
      ability: "",
      useAbility: "",
      samples,
      elapsedMs
    };
  });
}

class FlakyStorage {
  constructor() {
    this.kind = "test";
    this.snapshot = null;
    this.failNext = false;
  }

  async load() {
    return this.snapshot ? structuredClone(this.snapshot) : null;
  }

  async save(data) {
    if (this.failNext) {
      this.failNext = false;
      throw Object.assign(new Error("Temporary storage failure."), { code: "EIO" });
    }
    this.snapshot = structuredClone(data);
  }

  health() {
    return { kind: this.kind, ready: !this.failNext };
  }
}

function verifiedPureScore(playerId, runId, createdAt) {
  return {
    id: `score-${runId}`,
    runId,
    playerId,
    callsign: "Test Voyager",
    challengeId: "quick:circuit-server",
    division: "pure",
    assist: "none",
    mode: "quick",
    target: "Forest",
    dailyKey: createdAt.slice(0, 10),
    weeklyKey: "2026-W31",
    score: 100_000,
    moves: 4,
    elapsedMs: 30_000,
    status: "verified",
    createdAt
  };
}

function promotionOutcome(outcomeId, overrides = {}) {
  return {
    outcomeId,
    outcome: "completed",
    mode: "reach",
    target: "City",
    rankId: "bronze",
    familyIds: [],
    clean: true,
    flawless: true,
    ...overrides
  };
}

async function qualifyForCrazyPath(context, prefix) {
  const { store, playerId } = context;
  seedGoldRouteRank(context);
  store.data.players[playerId].circuit.wallet.passes = 6;
  const started = await store.startCircuitAttempt(playerId, {
    mode: "ticketed",
    idempotencyKey: `${prefix}-qualify-start`
  });
  const active = started.circuit.activeAttempt;
  const events = signedTelemetry(active, perfectTelemetry(active.course));
  context.setNow(context.now() + events.at(-1).elapsedMs + 1_000);
  const completed = await store.submitCircuitAttempt(playerId, {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: `${prefix}-qualify-submit`,
    events,
    reason: "finish"
  });
  assert.equal(completed.result.milestone, "cosmos");
  assert.equal(completed.grant.firstCosmosOfWeek, true);
  assert.equal(completed.circuit.crazyPath.qualified, true);
  assert.equal(completed.circuit.launchPasses, 5);
  return completed;
}

function seedGoldRouteRank(context) {
  context.store.data.players[context.playerId].routeProgression = createRemixProgressionState({
    rankId: "gold",
    masteryPoints: 200,
    completedChallenges: 8
  });
}

function seedCrazyQualification(context, passes = 6) {
  seedGoldRouteRank(context);
  const circuit = context.store.data.players[context.playerId].circuit;
  circuit.wallet.passes = passes;
  circuit.claims.cosmosWeekKeys = [
    cosmosCircuitCourse(new Date(context.now())).weekKey
  ];
}

test("daily Launch Passes, starts, and reconnect recovery are authoritative and idempotent", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-circuit-server-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "store.json");
  let clockMs = START_MS;
  const first = await new GameStore(path, { clock: () => new Date(clockMs) }).init();
  const player = await first.registerPlayer();

  assert.equal(first.publicCircuitState(player.id).launchPasses, 3);
  const started = await first.startCircuitAttempt(player.id, {
    mode: "ticketed",
    idempotencyKey: "start-recovery-001"
  });
  assert.equal(started.started, true);
  assert.equal(started.resumed, false);
  assert.equal(started.consumed, 1);
  assert.equal(started.circuit.launchPasses, 2);
  const active = started.circuit.activeAttempt;
  assert.ok(active.attemptToken.startsWith("cc1."));

  const retried = await first.startCircuitAttempt(player.id, {
    mode: "ticketed",
    idempotencyKey: "start-recovery-001"
  });
  assert.equal(retried.resumed, true);
  assert.equal(retried.consumed, 0);
  assert.equal(retried.circuit.launchPasses, 2);
  assert.equal(retried.circuit.activeAttempt.run.id, active.run.id);
  assert.equal(retried.circuit.activeAttempt.attemptToken, active.attemptToken);

  const restored = await new GameStore(path, { clock: () => new Date(clockMs) }).init();
  const status = await restored.circuitStatus(player.id);
  assert.equal(status.circuit.launchPasses, 2);
  assert.equal(status.circuit.activeAttempt.run.id, active.run.id);
  assert.equal(status.circuit.activeAttempt.attemptToken, active.attemptToken);

  const abandoned = await restored.abandonCircuitAttempt(player.id, {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: "abandon-recovery-001"
  });
  assert.equal(abandoned.abandoned, true);
  assert.equal(abandoned.circuit.activeAttempt, null);
  assert.equal(abandoned.circuit.launchPasses, 2, "abandonment never refunds a consumed pass");
  const terminalRetry = await restored.startCircuitAttempt(player.id, {
    mode: "ticketed",
    idempotencyKey: "start-recovery-001"
  });
  assert.equal(terminalRetry.duplicate, true);
  assert.equal(terminalRetry.terminal, true);
  assert.equal(terminalRetry.resumed, true);
  assert.equal(terminalRetry.circuit.launchPasses, 2);
  assert.equal(terminalRetry.receipt.attemptId, active.run.id);
  assert.equal(terminalRetry.receipt.abandoned, true);
  await assert.rejects(
    restored.startCircuitAttempt(player.id, {
      mode: "practice",
      idempotencyKey: "start-recovery-001"
    }),
    (error) => error.statusCode === 409 && error.serviceCode === "circuit_idempotency_conflict"
  );

  const terminalRestored = await new GameStore(path, { clock: () => new Date(clockMs) }).init();
  const restoredRetry = await terminalRestored.startCircuitAttempt(player.id, {
    mode: "ticketed",
    idempotencyKey: "start-recovery-001"
  });
  assert.equal(restoredRetry.terminal, true);
  assert.equal(restoredRetry.circuit.launchPasses, 2);

  clockMs += DAY_MS;
  const nextDay = await terminalRestored.circuitStatus(player.id);
  assert.equal(nextDay.dailyGrant.granted, 3);
  assert.equal(nextDay.circuit.launchPasses, 5);
  assert.equal((await terminalRestored.circuitStatus(player.id)).dailyGrant.granted, 0);
  clockMs += DAY_MS;
  const cappedDay = await terminalRestored.circuitStatus(player.id);
  assert.equal(cappedDay.dailyGrant.granted, 1);
  assert.equal(cappedDay.circuit.launchPasses, 6);
});

test("voluntary extraction makes the advertised partial reward tiers server-authoritative", async () => {
  const context = await registeredStore();
  const { store, playerId, setNow } = context;
  const started = await store.startCircuitAttempt(playerId, {
    mode: "ticketed",
    idempotencyKey: "start-extract-001"
  });
  const active = started.circuit.activeAttempt;
  const events = signedTelemetry(active, perfectTelemetry(active.course).slice(0, 5));
  setNow(START_MS + events.at(-1).elapsedMs + 1_000);
  const extracted = await store.submitCircuitAttempt(playerId, {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: "submit-extract-001",
    events,
    reason: "extract",
    chosenBoost: "shield"
  });
  assert.equal(extracted.result.milestone, "drift");
  assert.equal(extracted.result.rewardEligible, true);
  assert.equal(extracted.grant.tier, "drift");
  assert.deepEqual(extracted.grant.boosts, {
    shield: 1,
    phase: 0,
    magnet: 0,
    timeWarp: 0
  });
  assert.equal(extracted.circuit.activeAttempt, null);

  const duplicate = await store.submitCircuitAttempt(playerId, {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: "submit-extract-001",
    events,
    reason: "extract",
    chosenBoost: "shield"
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.grant.tier, "drift");
});

test("signed ordered telemetry rejects forgery and a valid Cosmos receipt cannot double-grant", async () => {
  const context = await registeredStore();
  const { store, playerId } = context;
  const started = await store.startCircuitAttempt(playerId, {
    mode: "ticketed",
    idempotencyKey: "start-cosmos-001"
  });
  const active = started.circuit.activeAttempt;
  const events = signedTelemetry(active, perfectTelemetry(active.course));
  const finalElapsedMs = events.at(-1).elapsedMs;
  context.setNow(context.now() + finalElapsedMs + 1_000);

  await assert.rejects(
    store.submitCircuitAttempt(playerId, {
      attemptId: active.run.id,
      attemptToken: `${active.attemptToken.slice(0, -1)}x`,
      idempotencyKey: "submit-cosmos-001",
      events,
      reason: "finish"
    }),
    (error) => error.statusCode === 401 && error.serviceCode === "invalid_circuit_attempt"
  );

  const brokenChain = structuredClone(events);
  brokenChain[0].chain = `${brokenChain[0].chain.slice(0, -1)}${brokenChain[0].chain.endsWith("0") ? "1" : "0"}`;
  await assert.rejects(
    store.submitCircuitAttempt(playerId, {
      attemptId: active.run.id,
      attemptToken: active.attemptToken,
      idempotencyKey: "submit-cosmos-001",
      events: brokenChain,
      reason: "finish"
    }),
    (error) => error.statusCode === 422 && error.serviceCode === "invalid_circuit_telemetry_chain"
  );

  let outOfOrder = structuredClone(events);
  outOfOrder[0].segmentId = active.course.segments[1].id;
  outOfOrder = signedTelemetry(active, outOfOrder);
  await assert.rejects(
    store.submitCircuitAttempt(playerId, {
      attemptId: active.run.id,
      attemptToken: active.attemptToken,
      idempotencyKey: "submit-cosmos-001",
      events: outOfOrder,
      reason: "finish"
    }),
    (error) => error.statusCode === 422 && error.serviceCode === "circuit_checkpoint_order"
  );

  const tooFast = signedTelemetry(
    active,
    retimeTelemetry(structuredClone(events), active.course, 100)
  );
  await assert.rejects(
    store.submitCircuitAttempt(playerId, {
      attemptId: active.run.id,
      attemptToken: active.attemptToken,
      idempotencyKey: "submit-cosmos-001",
      events: tooFast,
      reason: "finish"
    }),
    (error) => error.statusCode === 422
      && ["implausible_circuit_timing", "implausible_circuit_trajectory"].includes(error.serviceCode)
  );

  const result = await store.submitCircuitAttempt(playerId, {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: "submit-cosmos-001",
    events,
    reason: "finish"
  });
  assert.equal(result.result.milestone, "cosmos");
  assert.equal(result.grant.tier, "cosmos");
  assert.equal(result.grant.firstCosmosOfWeek, true);
  assert.equal(result.grant.starPathXp, 325);
  assert.equal(result.grant.starPathBaseXp, 125);
  assert.equal(result.grant.starPathWeeklyBonusXp, 200);
  assert.deepEqual(result.grant.boosts, {
    shield: 4,
    phase: 4,
    magnet: 4,
    timeWarp: 4
  });
  assert.equal(result.starPath.xp, 325);
  assert.equal(result.circuit.activeAttempt, null);

  const inventory = structuredClone(result.circuit.boosts);
  const duplicate = await store.submitCircuitAttempt(playerId, {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: "submit-cosmos-001",
    events,
    reason: "finish"
  });
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.circuit.boosts, inventory);
  assert.equal(duplicate.starPath.xp, 325);

  const repeatStarted = await store.startCircuitAttempt(playerId, {
    mode: "ticketed",
    idempotencyKey: "start-cosmos-repeat-001"
  });
  const repeatActive = repeatStarted.circuit.activeAttempt;
  const repeatEvents = signedTelemetry(repeatActive, perfectTelemetry(repeatActive.course));
  context.setNow(context.now() + repeatEvents.at(-1).elapsedMs + 1_000);
  const repeat = await store.submitCircuitAttempt(playerId, {
    attemptId: repeatActive.run.id,
    attemptToken: repeatActive.attemptToken,
    idempotencyKey: "submit-cosmos-repeat-001",
    events: repeatEvents,
    reason: "finish"
  });
  assert.equal(repeat.result.milestone, "cosmos");
  assert.equal(repeat.grant.milestone, "cosmos");
  assert.equal(repeat.grant.tier, "galaxy");
  assert.equal(repeat.grant.firstCosmosOfWeek, false);
  assert.equal(repeat.grant.starPathXp, 0);
  assert.equal(repeat.grant.starPathBaseXp, 0);
  assert.equal(repeat.grant.starPathWeeklyBonusXp, 0);
  assert.equal(repeat.starPath.xp, 325);

  const repeatDuplicate = await store.submitCircuitAttempt(playerId, {
    attemptId: repeatActive.run.id,
    attemptToken: repeatActive.attemptToken,
    idempotencyKey: "submit-cosmos-repeat-001",
    events: repeatEvents,
    reason: "finish"
  });
  assert.equal(repeatDuplicate.duplicate, true);
  assert.equal(repeatDuplicate.starPath.xp, 325);
});

test("signed Crazy Path qualification, entry, instant settlement, and retries are authoritative", async () => {
  const context = await registeredStore();
  const { store, playerId } = context;

  await assert.rejects(
    store.startCircuitAttempt(playerId, {
      mode: "ticketed",
      path: "crazy",
      idempotencyKey: "crazy-before-qualification"
    }),
    (error) => error.statusCode === 409
      && error.serviceCode === "crazy_path_route_rank_required"
  );

  seedGoldRouteRank(context);
  await assert.rejects(
    store.startCircuitAttempt(playerId, {
      mode: "ticketed",
      path: "crazy",
      idempotencyKey: "crazy-before-cosmos-qualification"
    }),
    (error) => error.statusCode === 409
      && error.serviceCode === "crazy_path_cosmos_qualification_required"
  );

  const qualification = await qualifyForCrazyPath(context, "crazy-instant");
  const pathXpBefore = qualification.starPath.xp;
  assert.equal(pathXpBefore, 325);

  store.data.players[playerId].circuit.wallet.passes = CRAZY_PATH_ENTRY_PASSES - 1;
  await assert.rejects(
    store.startCircuitAttempt(playerId, {
      mode: "ticketed",
      path: "crazy",
      idempotencyKey: "crazy-insufficient-passes"
    }),
    (error) => error.statusCode === 409
      && error.serviceCode === "launch_pass_required"
  );
  store.data.players[playerId].circuit.wallet.passes = 5;

  const started = await store.startCircuitAttempt(playerId, {
    mode: "ticketed",
    path: "crazy",
    idempotencyKey: "crazy-instant-start"
  });
  assert.equal(started.consumed, CRAZY_PATH_ENTRY_PASSES);
  assert.equal(started.circuit.launchPasses, 2);
  assert.equal(started.circuit.activeAttempt.run.path, "crazy");
  assert.equal(started.circuit.activeAttempt.course.variant, "crazy");
  assert.equal(started.circuit.crazyPath.attempted, true);

  const resumed = await store.startCircuitAttempt(playerId, {
    mode: "ticketed",
    path: "crazy",
    idempotencyKey: "crazy-instant-start"
  });
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.consumed, 0);
  assert.equal(resumed.circuit.launchPasses, 2);
  assert.equal(
    resumed.circuit.activeAttempt.attemptToken,
    started.circuit.activeAttempt.attemptToken
  );

  await assert.rejects(
    store.startCircuitAttempt(playerId, {
      mode: "ticketed",
      path: "standard",
      idempotencyKey: "crazy-instant-start"
    }),
    (error) => error.statusCode === 409
      && error.serviceCode === "circuit_idempotency_conflict"
  );

  const active = started.circuit.activeAttempt;
  const events = signedTelemetry(active, boundedCrazyTelemetry(active.course));
  context.setNow(context.now() + events.at(-1).elapsedMs + 1_000);
  const settled = await store.submitCircuitAttempt(playerId, {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: "crazy-instant-submit",
    events,
    reason: "finish",
    crazyRewardChoice: "instant"
  });
  assert.equal(settled.result.path, "crazy");
  assert.equal(settled.result.milestone, "crazy");
  assert.equal(settled.result.rewardEligible, true);
  assert.equal(settled.grant.crazyRewardChoice, "instant");
  assert.equal(settled.grant.totalPerBoost, CRAZY_PATH_INSTANT_POWERS);
  assert.deepEqual(settled.grant.boosts, {
    shield: 20,
    phase: 20,
    magnet: 20,
    timeWarp: 20
  });
  assert.deepEqual(settled.circuit.boosts, {
    shield: 24,
    phase: 24,
    magnet: 24,
    timeWarp: 24
  });
  assert.equal(settled.grant.starPathXp, 0);
  assert.equal(settled.grant.starPathBaseXp, 0);
  assert.equal(settled.grant.starPathWeeklyBonusXp, 0);
  assert.equal(settled.starPath.xp, pathXpBefore);
  assert.equal(settled.circuit.activeAttempt, null);

  const inventory = structuredClone(settled.circuit.boosts);
  const duplicate = await store.submitCircuitAttempt(playerId, {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: "crazy-instant-submit",
    events,
    reason: "finish",
    crazyRewardChoice: "instant"
  });
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.circuit.boosts, inventory);
  assert.equal(duplicate.starPath.xp, pathXpBefore);

  await assert.rejects(
    store.submitCircuitAttempt(playerId, {
      attemptId: active.run.id,
      attemptToken: active.attemptToken,
      idempotencyKey: "crazy-instant-submit",
      events,
      reason: "finish",
      crazyRewardChoice: "daily"
    }),
    (error) => error.statusCode === 409
      && error.serviceCode === "circuit_idempotency_conflict"
  );
  assert.deepEqual(store.publicCircuitState(playerId).boosts, inventory);

  const terminalRetry = await store.startCircuitAttempt(playerId, {
    mode: "ticketed",
    path: "crazy",
    idempotencyKey: "crazy-instant-start"
  });
  assert.equal(terminalRetry.terminal, true);
  assert.equal(terminalRetry.duplicate, true);
  assert.equal(terminalRetry.receipt.grant.crazyRewardChoice, "instant");
  await assert.rejects(
    store.startCircuitAttempt(playerId, {
      mode: "ticketed",
      path: "standard",
      idempotencyKey: "crazy-instant-start"
    }),
    (error) => error.statusCode === 409
      && error.serviceCode === "circuit_idempotency_conflict"
  );
});

test("Crazy Path required misses, abandonment, and expiry settle no reward", async () => {
  const failed = await registeredStore();
  seedCrazyQualification(failed);
  const failedStart = await failed.store.startCircuitAttempt(failed.playerId, {
    mode: "ticketed",
    path: "crazy",
    idempotencyKey: "crazy-failure-start"
  });
  const failedActive = failedStart.circuit.activeAttempt;
  const missedEvents = signedTelemetry(failedActive, firstRequiredMissTelemetry(failedActive.course));
  failed.setNow(failed.now() + missedEvents.at(-1).elapsedMs + 1_000);
  const failure = await failed.store.submitCircuitAttempt(failed.playerId, {
    attemptId: failedActive.run.id,
    attemptToken: failedActive.attemptToken,
    idempotencyKey: "crazy-failure-submit",
    events: missedEvents,
    reason: "crash",
    crazyRewardChoice: "instant"
  });
  assert.equal(failure.result.path, "crazy");
  assert.equal(failure.result.milestone, "none");
  assert.equal(failure.result.rewardEligible, false);
  assert.equal(failure.grant, null);
  assert.deepEqual(failure.circuit.boosts, {
    shield: 0,
    phase: 0,
    magnet: 0,
    timeWarp: 0
  });
  assert.equal(failure.starPath.xp, 0);
  assert.equal(failure.circuit.launchPasses, 3);
  assert.equal(failure.circuit.activeAttempt, null);
  await assert.rejects(
    failed.store.startCircuitAttempt(failed.playerId, {
      mode: "ticketed",
      path: "crazy",
      idempotencyKey: "crazy-failure-weekly-retry"
    }),
    (error) => error.statusCode === 409
      && error.serviceCode === "crazy_path_weekly_attempt_used"
  );

  const abandonedContext = await registeredStore();
  seedCrazyQualification(abandonedContext);
  const abandonedStart = await abandonedContext.store.startCircuitAttempt(abandonedContext.playerId, {
    mode: "ticketed",
    path: "crazy",
    idempotencyKey: "crazy-abandon-start"
  });
  const abandonedActive = abandonedStart.circuit.activeAttempt;
  const abandoned = await abandonedContext.store.abandonCircuitAttempt(abandonedContext.playerId, {
    attemptId: abandonedActive.run.id,
    attemptToken: abandonedActive.attemptToken,
    idempotencyKey: "crazy-abandon-submit"
  });
  assert.equal(abandoned.abandoned, true);
  assert.equal(abandoned.result.path, "crazy");
  assert.equal(abandoned.result.milestone, "none");
  assert.equal(abandoned.grant, null);
  assert.equal(abandoned.starPath.xp, 0);
  assert.deepEqual(abandoned.circuit.boosts, {
    shield: 0,
    phase: 0,
    magnet: 0,
    timeWarp: 0
  });
  assert.equal(abandoned.circuit.launchPasses, 3);

  const expired = await registeredStore();
  seedCrazyQualification(expired);
  const expiredStart = await expired.store.startCircuitAttempt(expired.playerId, {
    mode: "ticketed",
    path: "crazy",
    idempotencyKey: "crazy-expired-start"
  });
  const expiredActive = expiredStart.circuit.activeAttempt;
  expired.setNow(expired.now() + 49 * 60 * 60_000);
  await assert.rejects(
    expired.store.submitCircuitAttempt(expired.playerId, {
      attemptId: expiredActive.run.id,
      attemptToken: expiredActive.attemptToken,
      idempotencyKey: "crazy-expired-submit",
      events: [],
      reason: "crash",
      crazyRewardChoice: "instant"
    }),
    (error) => error.statusCode === 410
      && error.serviceCode === "circuit_attempt_expired"
  );
  const expiredState = expired.store.publicCircuitState(expired.playerId);
  assert.equal(expiredState.activeAttempt, null);
  assert.equal(expiredState.launchPasses, 3);
  assert.deepEqual(expiredState.boosts, {
    shield: 0,
    phase: 0,
    magnet: 0,
    timeWarp: 0
  });
  assert.equal(expired.store.publicStarPathState(expired.playerId).xp, 0);
});

test("Crazy Path daily supply accrues authoritatively across status calls and restarts", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-crazy-stipend-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "store.json");
  let clockMs = START_MS;
  const store = await new GameStore(path, {
    clock: () => new Date(clockMs)
  }).init();
  const player = await store.registerPlayer();
  const context = {
    store,
    playerId: player.id,
    now: () => clockMs,
    setNow: (value) => {
      clockMs = value;
    }
  };
  const qualification = await qualifyForCrazyPath(context, "crazy-daily");
  const pathXpBefore = qualification.starPath.xp;
  assert.equal(pathXpBefore, 325);

  const started = await store.startCircuitAttempt(player.id, {
    mode: "ticketed",
    path: "crazy",
    idempotencyKey: "crazy-daily-start"
  });
  const active = started.circuit.activeAttempt;
  const events = signedTelemetry(active, boundedCrazyTelemetry(active.course));
  clockMs += events.at(-1).elapsedMs + 1_000;
  const settled = await store.submitCircuitAttempt(player.id, {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: "crazy-daily-submit",
    events,
    reason: "finish",
    crazyRewardChoice: "daily"
  });
  assert.equal(settled.result.milestone, "crazy");
  assert.equal(settled.grant.crazyRewardChoice, "daily");
  assert.equal(settled.grant.totalPerBoost, CRAZY_PATH_DAILY_POWERS * CRAZY_PATH_DAILY_DAYS);
  assert.equal(settled.grant.grantedDays, 1);
  assert.equal(settled.grant.stipend.creditedDays, 1);
  assert.deepEqual(settled.grant.boosts, {
    shield: CRAZY_PATH_DAILY_POWERS,
    phase: CRAZY_PATH_DAILY_POWERS,
    magnet: CRAZY_PATH_DAILY_POWERS,
    timeWarp: CRAZY_PATH_DAILY_POWERS
  });
  assert.deepEqual(settled.circuit.boosts, {
    shield: 4 + CRAZY_PATH_DAILY_POWERS,
    phase: 4 + CRAZY_PATH_DAILY_POWERS,
    magnet: 4 + CRAZY_PATH_DAILY_POWERS,
    timeWarp: 4 + CRAZY_PATH_DAILY_POWERS
  });
  assert.equal(settled.grant.starPathXp, 0);
  assert.equal(settled.starPath.xp, pathXpBefore);

  const duplicate = await store.submitCircuitAttempt(player.id, {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: "crazy-daily-submit",
    events,
    reason: "finish",
    crazyRewardChoice: "daily"
  });
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.circuit.boosts, settled.circuit.boosts);

  clockMs += 9 * DAY_MS;
  let restored = await new GameStore(path, {
    clock: () => new Date(clockMs)
  }).init();
  const accruedDayTen = await restored.circuitStatus(player.id);
  assert.equal(accruedDayTen.crazyDailyGrant.grantedDays, 9);
  assert.equal(accruedDayTen.crazyDailyGrant.each, 9 * CRAZY_PATH_DAILY_POWERS);
  assert.equal(accruedDayTen.circuit.crazyPath.stipend.creditedDays, 10);
  assert.deepEqual(accruedDayTen.circuit.boosts, {
    shield: 4 + 10 * CRAZY_PATH_DAILY_POWERS,
    phase: 4 + 10 * CRAZY_PATH_DAILY_POWERS,
    magnet: 4 + 10 * CRAZY_PATH_DAILY_POWERS,
    timeWarp: 4 + 10 * CRAZY_PATH_DAILY_POWERS
  });
  assert.equal(accruedDayTen.starPath.xp, pathXpBefore);

  restored = await new GameStore(path, {
    clock: () => new Date(clockMs)
  }).init();
  const sameDay = await restored.circuitStatus(player.id);
  assert.equal(sameDay.crazyDailyGrant.grantedDays, 0);
  assert.equal(sameDay.crazyDailyGrant.each, 0);
  assert.equal(sameDay.circuit.crazyPath.stipend.creditedDays, 10);
  assert.deepEqual(sameDay.circuit.boosts, accruedDayTen.circuit.boosts);

  clockMs += 20 * DAY_MS;
  const dayThirty = await restored.circuitStatus(player.id);
  assert.equal(dayThirty.crazyDailyGrant.grantedDays, 20);
  assert.equal(dayThirty.crazyDailyGrant.each, 20 * CRAZY_PATH_DAILY_POWERS);
  assert.equal(dayThirty.circuit.crazyPath.stipend.creditedDays, CRAZY_PATH_DAILY_DAYS);
  assert.equal(dayThirty.circuit.crazyPath.stipend.complete, true);
  assert.deepEqual(dayThirty.circuit.boosts, {
    shield: 4 + CRAZY_PATH_DAILY_DAYS * CRAZY_PATH_DAILY_POWERS,
    phase: 4 + CRAZY_PATH_DAILY_DAYS * CRAZY_PATH_DAILY_POWERS,
    magnet: 4 + CRAZY_PATH_DAILY_DAYS * CRAZY_PATH_DAILY_POWERS,
    timeWarp: 4 + CRAZY_PATH_DAILY_DAYS * CRAZY_PATH_DAILY_POWERS
  });
  assert.notEqual(dayThirty.starPath.season.id, settled.starPath.season.id);
  assert.equal(dayThirty.starPath.xp, 0);

  clockMs += DAY_MS;
  const dayThirtyOne = await restored.circuitStatus(player.id);
  assert.equal(dayThirtyOne.crazyDailyGrant.grantedDays, 0);
  assert.equal(dayThirtyOne.crazyDailyGrant.each, 0);
  assert.deepEqual(dayThirtyOne.circuit.boosts, dayThirty.circuit.boosts);
  assert.equal(dayThirtyOne.starPath.season.id, dayThirty.starPath.season.id);
  assert.equal(dayThirtyOne.starPath.xp, 0);
});

test("Circuit telemetry requires covered trajectories and recomputes client-claimed outcomes", async () => {
  const immediate = await registeredStore();
  const immediateStart = await immediate.store.startCircuitAttempt(immediate.playerId, {
    mode: "ticketed",
    idempotencyKey: "start-immediate-forgery-001"
  });
  const immediateEvents = signedTelemetry(
    immediateStart.circuit.activeAttempt,
    retimeTelemetry(
      perfectTelemetry(immediateStart.circuit.activeAttempt.course).slice(0, 5),
      immediateStart.circuit.activeAttempt.course,
      750
    )
  );
  await assert.rejects(
    immediate.store.submitCircuitAttempt(immediate.playerId, {
      attemptId: immediateStart.circuit.activeAttempt.run.id,
      attemptToken: immediateStart.circuit.activeAttempt.attemptToken,
      idempotencyKey: "submit-immediate-forgery-001",
      chosenBoost: "shield",
      events: immediateEvents,
      reason: "crash"
    }),
    (error) => error.statusCode === 422
      && ["implausible_circuit_timing", "implausible_circuit_trajectory"].includes(error.serviceCode)
  );

  const context = await registeredStore();
  const started = await context.store.startCircuitAttempt(context.playerId, {
    mode: "ticketed",
    idempotencyKey: "start-derived-flight-001"
  });
  const active = started.circuit.activeAttempt;
  const forgedClaims = signedTelemetry(active, offTargetTelemetry(active.course));
  assert.ok(forgedClaims.every((event) => event.outcome === "perfect"));
  assert.ok(forgedClaims.every((event, index) => event.stardust === active.course.segments[index].stardust));
  context.setNow(context.now() + forgedClaims.at(-1).elapsedMs + 1_000);
  const derived = await context.store.submitCircuitAttempt(context.playerId, {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: "submit-derived-flight-001",
    events: forgedClaims,
    reason: "finish"
  });
  assert.equal(derived.result.milestone, "galaxy", "course completion remains a Galaxy payout, but forged Cosmos criteria do not");
  assert.equal(derived.grant.tier, "galaxy");
  assert.equal(derived.grant.starPathXp, 285);
  assert.equal(derived.grant.starPathBaseXp, 85);
  assert.equal(derived.grant.starPathWeeklyBonusXp, 200);
  assert.deepEqual(derived.grant.boosts, {
    shield: 2,
    phase: 2,
    magnet: 2,
    timeWarp: 2
  });

  const malformed = await registeredStore();
  const malformedStart = await malformed.store.startCircuitAttempt(malformed.playerId, {
    mode: "ticketed",
    idempotencyKey: "start-malformed-trajectory-001"
  });
  const malformedActive = malformedStart.circuit.activeAttempt;
  let malformedEvents = perfectTelemetry(malformedActive.course).slice(0, 1);
  malformedEvents[0].samples = malformedEvents[0].samples.slice(0, 2);
  malformedEvents = signedTelemetry(malformedActive, malformedEvents);
  malformed.setNow(malformed.now() + malformedEvents[0].elapsedMs + 1_000);
  await assert.rejects(
    malformed.store.submitCircuitAttempt(malformed.playerId, {
      attemptId: malformedActive.run.id,
      attemptToken: malformedActive.attemptToken,
      idempotencyKey: "submit-malformed-trajectory-001",
      events: malformedEvents,
      reason: "crash",
      chosenBoost: "magnet"
    }),
    (error) => error.statusCode === 422 && error.serviceCode === "implausible_circuit_trajectory"
  );
});

test("Circuit retries repair transient persistence failures before reporting durable success", async () => {
  let clockMs = START_MS;
  const storage = new FlakyStorage();
  const store = await new GameStore(":memory:", {
    storage,
    clock: () => new Date(clockMs)
  }).init();
  const player = await store.registerPlayer();

  storage.failNext = true;
  await assert.rejects(
    store.startCircuitAttempt(player.id, {
      mode: "ticketed",
      idempotencyKey: "persisted-start-retry-001"
    }),
    (error) => error.code === "EIO"
  );
  const resumed = await store.startCircuitAttempt(player.id, {
    mode: "ticketed",
    idempotencyKey: "persisted-start-retry-001"
  });
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.circuit.launchPasses, 2);

  let rebooted = await new GameStore(":memory:", {
    storage,
    clock: () => new Date(clockMs)
  }).init();
  assert.equal(rebooted.publicCircuitState(player.id).launchPasses, 2);
  assert.ok(rebooted.publicCircuitState(player.id, { includeAttempt: true }).activeAttempt);

  const active = resumed.circuit.activeAttempt;
  const events = signedTelemetry(active, perfectTelemetry(active.course));
  clockMs += events.at(-1).elapsedMs + 1_000;
  storage.failNext = true;
  await assert.rejects(
    store.submitCircuitAttempt(player.id, {
      attemptId: active.run.id,
      attemptToken: active.attemptToken,
      idempotencyKey: "persisted-submit-retry-001",
      events,
      reason: "finish"
    }),
    (error) => error.code === "EIO"
  );
  const duplicate = await store.submitCircuitAttempt(player.id, {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: "persisted-submit-retry-001",
    events,
    reason: "finish"
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.grant.tier, "cosmos");
  const terminalStartRetry = await store.startCircuitAttempt(player.id, {
    mode: "ticketed",
    idempotencyKey: "persisted-start-retry-001"
  });
  assert.equal(terminalStartRetry.terminal, true);
  assert.equal(terminalStartRetry.duplicate, true);
  assert.equal(terminalStartRetry.circuit.launchPasses, 2);

  rebooted = await new GameStore(":memory:", {
    storage,
    clock: () => new Date(clockMs)
  }).init();
  assert.equal(rebooted.publicCircuitState(player.id).activeAttempt, null);
  assert.deepEqual(rebooted.publicCircuitState(player.id).boosts, duplicate.circuit.boosts);
  assert.equal(rebooted.publicStarPathState(player.id).xp, 325);
});

test("verified Pure wins and rank promotions grant passes once while Star Path claims stay cosmetic", async () => {
  const context = await registeredStore();
  const { store, playerId } = context;
  const createdAt = new Date(context.now()).toISOString();

  for (let index = 1; index <= 4; index += 1) {
    await store.addScore(verifiedPureScore(playerId, `pure-win-${index}`, createdAt));
  }
  assert.equal(store.publicCircuitState(playerId).launchPasses, 4);
  assert.equal(store.publicStarPathState(playerId).xp, 320);

  await store.addScore(verifiedPureScore(playerId, "pure-win-4", createdAt));
  assert.equal(store.publicCircuitState(playerId).launchPasses, 4);
  assert.equal(store.publicStarPathState(playerId).xp, 320);

  const free = await store.claimStarPathReward(playerId, { track: "free", tier: 1 });
  assert.equal(free.claimed, true);
  assert.equal(free.reward.cosmeticOnly, true);
  assert.equal(free.reward.gameplayEffect, "none");
  assert.ok(store.data.players[playerId].starPathRewards.includes(free.reward.id));
  const freeOwnership = store.cosmeticOwnership(playerId);
  assert.ok(freeOwnership.seasonal.includes(free.reward.id));
  assert.ok(!freeOwnership.items.includes(free.reward.id), "seasonal rewards stay outside fixed equip-slot entitlements");
  assert.equal(store.publicCircuitState(playerId).launchPasses, 4);

  const duplicate = await store.claimStarPathReward(playerId, { track: "free", tier: 1 });
  assert.equal(duplicate.claimed, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(
    store.data.entitlementLedger.filter((entry) => entry.rewardId === free.reward.id).length,
    1
  );

  await assert.rejects(
    store.claimStarPathReward(playerId, { track: "supporter", tier: 1 }),
    (error) => error.statusCode === 403 && error.serviceCode === "star_path_supporter_required"
  );
  await store.setFounderPass(playerId, true);
  const supporter = await store.claimStarPathReward(playerId, { track: "supporter", tier: 1 });
  assert.equal(supporter.claimed, true);
  assert.equal(supporter.reward.track, "supporter");
  assert.ok(store.publicPlayer(playerId).cosmeticOwnership.seasonal.includes(supporter.reward.id));

  const player = store.data.players[playerId];
  player.circuit.wallet.passes = 0;
  player.routeProgression = {
    ...createRemixProgressionState(),
    masteryPoints: 50,
    rankId: "bronze"
  };
  store.ensureRoutePromotion(playerId);
  store.recordRouteRankOutcome(playerId, promotionOutcome("promotion-circuit-1"));
  store.recordRouteRankOutcome(playerId, promotionOutcome("promotion-circuit-2", {
    outcome: "failed",
    clean: false,
    flawless: false
  }));
  const promoted = store.recordRouteRankOutcome(playerId, promotionOutcome("promotion-circuit-3"));
  assert.equal(promoted.promotion.promoted, true);
  assert.deepEqual(promoted.launchPassGrant, { granted: 1, reason: "rank_grant" });
  assert.equal(store.publicCircuitState(playerId).launchPasses, 1);
  const promotionRetry = store.recordRouteRankOutcome(playerId, promotionOutcome("promotion-circuit-3"));
  assert.equal(promotionRetry.duplicate, true);
  assert.equal(store.publicCircuitState(playerId).launchPasses, 1);
});

test("Circuit and Star Path HTTP endpoints enforce exact authenticated contracts", async (t) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    if (!server.listening) return;
    server.close();
    await once(server, "close");
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const request = async (path, { method = "GET", auth = {}, body } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...auth
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return { response, payload: await response.json() };
  };

  const registration = await request("/api/player/register", { method: "POST" });
  assert.equal(registration.response.status, 201);
  const auth = {
    "x-constellore-player": registration.payload.player.id,
    "x-constellore-token": registration.payload.playerToken
  };

  const status = await request("/api/circuit", { auth });
  assert.equal(status.response.status, 200);
  assert.equal(status.payload.circuit.launchPasses, 3);
  assert.equal(status.payload.starPath.xp, 0);

  const invalidStart = await request("/api/circuit/start", {
    method: "POST",
    auth,
    body: { mode: "ticketed", idempotencyKey: "api-start-001", extra: true }
  });
  assert.equal(invalidStart.response.status, 400);
  assert.equal(invalidStart.payload.code, "invalid_circuit_start");

  const started = await request("/api/circuit/start", {
    method: "POST",
    auth,
    body: { mode: "ticketed", idempotencyKey: "api-start-001" }
  });
  assert.equal(started.response.status, 201);
  assert.equal(started.payload.circuit.launchPasses, 2);
  const active = started.payload.circuit.activeAttempt;

  const resumed = await request("/api/circuit/start", {
    method: "POST",
    auth,
    body: { mode: "ticketed", idempotencyKey: "api-start-001" }
  });
  assert.equal(resumed.response.status, 200);
  assert.equal(resumed.payload.resumed, true);
  assert.equal(resumed.payload.circuit.launchPasses, 2);

  const trajectoryBody = {
    attemptId: active.run.id,
    attemptToken: active.attemptToken,
    idempotencyKey: "api-submit-trajectory-001",
    events: signedTelemetry(active, perfectTelemetry(active.course)),
    reason: "finish"
  };
  assert.ok(Buffer.byteLength(JSON.stringify(trajectoryBody)) > 32_768);
  const prematureTrajectory = await request("/api/circuit/submit", {
    method: "POST",
    auth,
    body: trajectoryBody
  });
  assert.equal(prematureTrajectory.response.status, 422, "the trajectory clears the raised body limit before timing validation");
  assert.equal(prematureTrajectory.payload.code, "implausible_circuit_timing");

  const abandoned = await request("/api/circuit/abandon", {
    method: "POST",
    auth,
    body: {
      attemptId: active.run.id,
      attemptToken: active.attemptToken,
      idempotencyKey: "api-abandon-001"
    }
  });
  assert.equal(abandoned.response.status, 200);
  assert.equal(abandoned.payload.abandoned, true);

  const starPath = await request("/api/star-path", { auth });
  assert.equal(starPath.response.status, 200);
  assert.equal(starPath.payload.starPath.xp, 0);
  const lockedClaim = await request("/api/star-path/claim", {
    method: "POST",
    auth,
    body: { track: "free", tier: 1 }
  });
  assert.equal(lockedClaim.response.status, 409);
  assert.equal(lockedClaim.payload.code, "star_path_tier_locked");
});
