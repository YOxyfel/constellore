import test from "node:test";
import assert from "node:assert/strict";
import {
  activatedRunClock,
  createRunEntryId,
  createRunWithRetry,
  deferredRunRequest,
  enterPreparedRun,
  isPermanentActivationFailure,
  isReplayResponseCurrent,
  shouldRestoreObjective
} from "../public/run-entry.mjs";

test("run requests are deferred without mutating the caller's mode choice", () => {
  const request = { mode: "daily", seed: 42 };
  assert.deepEqual(deferredRunRequest(request), {
    mode: "daily",
    seed: 42,
    deferActivation: true
  });
  assert.deepEqual(request, { mode: "daily", seed: 42 });
});

test("the gate closes before a run is fetched and opens before its objective", async () => {
  const order = [];
  let createdRequest = null;
  const gate = {
    async enterBoard(swap, options) {
      order.push("doors-closing");
      await swap();
      order.push("doors-opening");
      await options.afterOpen();
      return true;
    }
  };

  const result = await enterPreparedRun({
    gate,
    prepare: async () => {
      order.push("choose-level");
      return { mode: "reach", seed: 7 };
    },
    create: async (request) => {
      createdRequest = request;
      order.push("fetch-run");
      return { game: { target: "Telescope" }, run: { id: "run-1" } };
    },
    commit: () => order.push("load-board"),
    ready: () => order.push("show-objective"),
    entryIdFactory: () => "entry-test-00001"
  });

  assert.deepEqual(createdRequest, {
    mode: "reach",
    seed: 7,
    deferActivation: true,
    entryId: "entry-test-00001"
  });
  assert.deepEqual(order, [
    "doors-closing",
    "choose-level",
    "fetch-run",
    "load-board",
    "doors-opening",
    "show-objective"
  ]);
  assert.equal(result.entered, true);
  assert.equal(result.payload.run.id, "run-1");
});

test("a superseded fold still presents the committed run objective exactly once", async () => {
  const order = [];
  const gate = {
    async enterBoard(swap) {
      await swap();
      order.push("fold-superseded");
      return false;
    }
  };

  const result = await enterPreparedRun({
    gate,
    prepare: () => ({ mode: "reach" }),
    create: () => ({ game: { target: "Steam" }, run: { id: "run-committed" } }),
    commit: () => order.push("load-board"),
    ready: () => order.push("show-objective")
  });

  assert.equal(result.entered, false);
  assert.equal(result.payload.run.id, "run-committed");
  assert.deepEqual(order, ["load-board", "fold-superseded", "show-objective"]);
});

test("ambiguous run creation retries once with the identical idempotency body", async () => {
  const requests = [];
  const body = { mode: "reach", entryId: "stable-entry" };
  const result = await createRunWithRetry(async (request) => {
    requests.push(request);
    if (requests.length === 1) throw new TypeError("network interrupted");
    return { run: { id: "same-run" } };
  }, body);

  assert.equal(result.run.id, "same-run");
  assert.equal(requests.length, 2);
  assert.equal(requests[0], body);
  assert.equal(requests[1], body);
});

test("explicit 4xx run failures are never retried", async () => {
  let attempts = 0;
  const error = Object.assign(new Error("invalid target"), { status: 422 });
  await assert.rejects(createRunWithRetry(async () => {
    attempts += 1;
    throw error;
  }, { mode: "reach", entryId: "stable-entry" }), error);
  assert.equal(attempts, 1);
});

test("only terminal activation failures force a safe return home", () => {
  assert.equal(isPermanentActivationFailure({ code: "run_expired", status: 410 }), true);
  assert.equal(isPermanentActivationFailure({ code: "invalid_run", status: 401 }), true);
  assert.equal(isPermanentActivationFailure({ code: "run_activation_invalid", status: 409 }), true);
  assert.equal(isPermanentActivationFailure({ code: "network_error" }), false);
  assert.equal(isPermanentActivationFailure({ status: 503 }), false);
  assert.equal(isPermanentActivationFailure({ status: 429 }), false);
});

test("only a still-pending restored run reopens the Start objective", () => {
  const snapshot = { run: { activationPending: true } };
  assert.equal(shouldRestoreObjective(snapshot, { activationPending: true }), true);
  assert.equal(shouldRestoreObjective(snapshot, { activationPending: false }), false);
  assert.equal(shouldRestoreObjective({ run: { activationPending: false } }, { activationPending: true }), false);
  assert.equal(shouldRestoreObjective(null, { activationPending: true }), false);
});

test("late replay responses are rejected after any result exit or orbit change", () => {
  const source = {
    sourceRunId: "run-1",
    sourceGeneration: 8,
    currentRunId: "run-1",
    currentGeneration: 8,
    finished: true
  };
  assert.equal(isReplayResponseCurrent(source), true);
  assert.equal(isReplayResponseCurrent({ ...source, currentGeneration: 9 }), false);
  assert.equal(isReplayResponseCurrent({ ...source, currentRunId: "run-2" }), false);
  assert.equal(isReplayResponseCurrent({ ...source, finished: false }), false);
});

test("entry IDs are bounded UUIDs with a deterministic safe fallback", () => {
  assert.equal(createRunEntryId({
    crypto: { randomUUID: () => "123e4567-e89b-42d3-a456-426614174000" }
  }), "123e4567-e89b-42d3-a456-426614174000");
  const fallback = createRunEntryId({
    crypto: null,
    now: () => 1_700_000_000_000,
    random: () => 0.25
  });
  assert.match(fallback, /^[A-Za-z0-9][A-Za-z0-9-]{15,63}$/);
  assert.ok(fallback.length >= 16);
  assert.ok(fallback.length <= 64);
  assert.match(createRunEntryId({
    crypto: null,
    now: () => 0,
    random: () => 0
  }), /^[A-Za-z0-9][A-Za-z0-9-]{15,63}$/);
});

test("a failed fetch never commits a board or presents an objective", async () => {
  const order = [];
  const gate = {
    async enterBoard(swap) {
      await swap();
      return true;
    }
  };
  await assert.rejects(
    enterPreparedRun({
      gate,
      prepare: () => ({ mode: "reach" }),
      create: async () => {
        throw Object.assign(new Error("invalid request"), { status: 400 });
      },
      commit: () => order.push("commit"),
      ready: () => order.push("ready")
    }),
    /invalid request/
  );
  assert.deepEqual(order, []);
});

test("the client clock starts from authoritative activation, not loading time", () => {
  const now = Date.parse("2026-07-26T12:00:00.000Z");
  assert.deepEqual(activatedRunClock({
    startedAt: "2026-07-26T11:59:58.500Z",
    deadlineAt: "2026-07-26T12:01:28.500Z"
  }, { timeLimit: 90 }, now), {
    startedAt: Date.parse("2026-07-26T11:59:58.500Z"),
    remainingSeconds: 89
  });
  assert.deepEqual(activatedRunClock(null, { timeLimit: null }, now), {
    startedAt: now,
    remainingSeconds: 0
  });
});
