export function deferredRunRequest(request) {
  return {
    ...(request && typeof request === "object" ? request : {}),
    deferActivation: true
  };
}

export function createRunEntryId({
  crypto = globalThis.crypto,
  now = Date.now,
  random = Math.random
} = {}) {
  try {
    const uuid = String(crypto?.randomUUID?.() || "").trim();
    if (/^[A-Za-z0-9][A-Za-z0-9-]{15,63}$/.test(uuid)) return uuid;
  } catch {
    // A local fallback still gives one stable key for this launch attempt.
  }
  const time = Math.max(0, Number(now?.()) || 0).toString(36);
  const entropy = Math.max(0, Math.min(0.999999999999, Number(random?.()) || 0))
    .toString(36)
    .slice(2, 18);
  return `entry-${time}-${entropy || "0"}-fallback`.slice(0, 64);
}

export function isExplicitClientFailure(error) {
  const status = Number(error?.status);
  return Number.isInteger(status) && status >= 400 && status < 500;
}

export function isPermanentActivationFailure(error) {
  const code = String(error?.code || "");
  if ([
    "invalid_run",
    "run_expired",
    "run_missing",
    "run_activation_invalid",
    "invalid_activation_request"
  ].includes(code)) return true;
  return [401, 404, 410].includes(Number(error?.status));
}

export function shouldRestoreObjective(snapshot, run) {
  return snapshot?.run?.activationPending === true && run?.activationPending === true;
}

export function isReplayResponseCurrent({
  sourceRunId,
  sourceGeneration,
  currentRunId,
  currentGeneration,
  finished
}) {
  return Boolean(
    finished
    && sourceRunId
    && currentRunId === sourceRunId
    && currentGeneration === sourceGeneration
  );
}

export async function createRunWithRetry(create, request) {
  try {
    return await create(request);
  } catch (error) {
    if (isExplicitClientFailure(error)) throw error;
    return create(request);
  }
}

export async function enterPreparedRun({
  gate,
  prepare,
  create,
  commit,
  ready,
  entryIdFactory = createRunEntryId,
  label = "Your next game is loading."
}) {
  if (!gate?.enterBoard || typeof prepare !== "function" || typeof create !== "function") {
    throw new TypeError("A gate, request builder, and run creator are required.");
  }
  let request = null;
  let payload = null;
  const entered = await gate.enterBoard(async () => {
    request = await prepare();
    const requestedEntryId = String(entryIdFactory?.() || "").trim();
    const runRequest = {
      ...deferredRunRequest(request),
      entryId: (requestedEntryId || createRunEntryId()).slice(0, 64)
    };
    payload = await createRunWithRetry(create, runRequest);
    if (typeof commit === "function") await commit(payload, request);
  }, {
    label,
    afterOpen: async () => {
      if (typeof ready === "function") await ready(payload, request);
    }
  });
  return { entered, payload, request };
}

export function activatedRunClock(run, game, now = Date.now()) {
  const parsedStart = Date.parse(String(run?.startedAt || ""));
  const startedAt = Number.isFinite(parsedStart) ? parsedStart : Number(now);
  const parsedDeadline = Date.parse(String(run?.deadlineAt || ""));
  const remainingSeconds = Number.isFinite(parsedDeadline)
    ? Math.max(0, Math.ceil((parsedDeadline - Number(now)) / 1000))
    : Math.max(0, Number(game?.timeLimit) || 0);
  return { startedAt, remainingSeconds };
}
