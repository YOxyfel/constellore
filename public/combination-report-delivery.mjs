const REPORT_REASONS = new Set(["", "direct", "mixture", "repeat", "culture", "other"]);
const REPORT_MODES = new Set(["reach", "quick", "moves", "daily", "weekly", "challenge", "explore"]);

export function validateCombinationReportEndpoint(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.search
      || url.hash
      || url.pathname !== "/api/combination-reports"
    ) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function sanitizeCombinationSuggestion(value) {
  const normalized = String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (
    normalized.length > 28
    || normalized.split(/\s+/u).length > 4
    || /[@\r\n]/u.test(normalized)
    || /(?:https?:\/\/|www[.]|[.](?:app|bg|co|com|dev|eu|gg|io|me|net|org)\b)/iu.test(normalized)
  ) return null;
  return /^[\p{L}\p{N}][\p{L}\p{N} '&-]{0,27}$/u.test(normalized) ? normalized : null;
}

function defaultPairKey(a, b) {
  return [a, b]
    .map((value) => String(value || "").normalize("NFKC").trim().toLocaleLowerCase("en"))
    .sort()
    .join("+")
    .slice(0, 120);
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createCombinationReportDelivery({
  endpoint = "",
  storage = globalThis.localStorage,
  localReportKey = "constellore-local-expected-pairs-v1",
  outboxKey = "constellore-local-expected-pair-outbox-v1",
  getMode = () => "reach",
  getReporterId = () => "",
  pairKey = defaultPairKey,
  fetchReport = (...args) => globalThis.fetch(...args),
  isOnline = () => globalThis.navigator?.onLine !== false,
  isHidden = () => Boolean(globalThis.document?.hidden),
  setTimer = globalThis.setTimeout.bind(globalThis),
  clearTimer = globalThis.clearTimeout.bind(globalThis),
  random = Math.random
} = {}) {
  const reportEndpoint = validateCombinationReportEndpoint(endpoint);
  let flushPromise = null;
  let retryTimer = null;
  let retryAttempt = 0;
  let generation = 0;
  const requests = new Set();

  function submitLabel(staticBeta) {
    return staticBeta && !reportEndpoint ? "Save idea" : "Send idea";
  }

  function deliveryMessage(staticBeta) {
    if (!staticBeta) return "Sends these two words, your answer, and the game mode to Oxyfel Games. Do not enter your name or private information.";
    if (reportEndpoint) return "Sends only these two words, your answer, the game mode, and a random duplicate-check ID. No account or contact details.";
    return "Saves this idea on your device. Direct sending is not connected in this build, and no account is required.";
  }

  function sanitizePayload(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const a = sanitizeCombinationSuggestion(value.a);
    const b = sanitizeCombinationSuggestion(value.b);
    const expected = sanitizeCombinationSuggestion(value.expected);
    const reason = String(value.reason || "");
    const mode = String(value.mode || "");
    const reporterId = String(value.reporterId || "");
    if (
      !a
      || !b
      || expected === null
      || !REPORT_REASONS.has(reason)
      || !REPORT_MODES.has(mode)
      || !/^[A-Za-z0-9_-]{16,80}$/.test(reporterId)
    ) return null;
    return { a, b, expected, reason, mode, reporterId };
  }

  function payload({ a, b, expected = "", reason = "" } = {}) {
    const reporterId = String(getReporterId() || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
    return sanitizePayload({
      a: String(a || "").slice(0, 28),
      b: String(b || "").slice(0, 28),
      expected: String(expected || "").slice(0, 28),
      reason: REPORT_REASONS.has(reason) ? reason : "",
      mode: String(getMode() || "reach").slice(0, 24),
      reporterId
    });
  }

  function saveLocal({ a, b, expected = "", reason = "" } = {}) {
    try {
      const cleanA = sanitizeCombinationSuggestion(a);
      const cleanB = sanitizeCombinationSuggestion(b);
      const cleanExpected = sanitizeCombinationSuggestion(expected);
      const cleanReason = REPORT_REASONS.has(reason) ? reason : "";
      if (!cleanA || !cleanB || cleanExpected === null) return false;
      const parsed = JSON.parse(storage.getItem(localReportKey) || "null");
      const pairs = parsed?.pairs && typeof parsed.pairs === "object" && !Array.isArray(parsed.pairs) ? parsed.pairs : {};
      const bounded = Object.fromEntries(
        Object.entries(pairs)
          .filter(([key, count]) => key.length <= 120 && Number.isFinite(Number(count)))
          .slice(-255)
      );
      const key = pairKey(cleanA, cleanB);
      if (!key) return false;
      bounded[key] = Math.min(1000, Math.max(0, Math.floor(Number(bounded[key]) || 0)) + 1);
      const reports = parsed?.reports && typeof parsed.reports === "object" && !Array.isArray(parsed.reports) ? parsed.reports : {};
      const previous = reports[key] && typeof reports[key] === "object" ? reports[key] : {};
      const suggestions = previous.suggestions && typeof previous.suggestions === "object" ? previous.suggestions : {};
      const reasons = previous.reasons && typeof previous.reasons === "object" ? previous.reasons : {};
      if (cleanExpected) suggestions[cleanExpected] = Math.min(1000, Math.max(0, Math.floor(Number(suggestions[cleanExpected]) || 0)) + 1);
      if (cleanReason) reasons[cleanReason] = Math.min(1000, Math.max(0, Math.floor(Number(reasons[cleanReason]) || 0)) + 1);
      reports[key] = {
        pair: [cleanA, cleanB],
        count: bounded[key],
        suggestions: Object.fromEntries(Object.entries(suggestions).slice(-20)),
        reasons: Object.fromEntries(Object.entries(reasons).filter(([name]) => REPORT_REASONS.has(name)).slice(-5))
      };
      const stored = JSON.stringify({
        version: 2,
        pairs: bounded,
        reports: Object.fromEntries(Object.entries(reports).slice(-255))
      });
      storage.setItem(localReportKey, stored);
      return storage.getItem(localReportKey) === stored;
    } catch {
      return false;
    }
  }

  function readOutbox() {
    try {
      const parsed = JSON.parse(storage.getItem(outboxKey) || "null");
      if (parsed?.version !== 1 || !Array.isArray(parsed.reports)) return [];
      return parsed.reports.flatMap((entry) => {
        const clean = sanitizePayload(entry?.payload);
        if (!clean || typeof entry?.id !== "string" || !/^[a-f0-9]{8,16}$/.test(entry.id)) return [];
        return [{ id: entry.id, payload: clean }];
      }).slice(-24);
    } catch {
      return [];
    }
  }

  function writeOutbox(reports) {
    try {
      const stored = JSON.stringify({ version: 1, reports: reports.slice(-24) });
      storage.setItem(outboxKey, stored);
      return storage.getItem(outboxKey) === stored;
    } catch {
      return false;
    }
  }

  function queue(value) {
    const clean = sanitizePayload(value);
    if (!clean) return "";
    const id = hashText(`${pairKey(clean.a, clean.b)}\0${clean.reporterId}`);
    const reports = readOutbox().filter((entry) => entry.id !== id);
    reports.push({ id, payload: clean });
    return writeOutbox(reports) ? id : "";
  }

  function remove(id) {
    retryAttempt = 0;
    return writeOutbox(readOutbox().filter((entry) => entry.id !== id));
  }

  function cancel() {
    generation += 1;
    retryAttempt = 0;
    clearTimer(retryTimer);
    retryTimer = null;
    for (const controller of requests) controller.abort();
    requests.clear();
  }

  function schedule({ soon = false } = {}) {
    if (!reportEndpoint || !isOnline() || !readOutbox().length) return;
    clearTimer(retryTimer);
    const baseDelay = soon
      ? 1_000
      : Math.min(300_000, 10_000 * (2 ** Math.min(5, retryAttempt)));
    const delay = baseDelay + Math.floor(random() * Math.min(5_000, Math.max(500, baseDelay * .2)));
    retryTimer = setTimer(() => {
      retryTimer = null;
      if (isHidden()) return schedule();
      void flush();
    }, delay);
  }

  async function post(value) {
    if (!reportEndpoint) throw new Error("Feedback receiver unavailable.");
    const clean = sanitizePayload(value);
    if (!clean) {
      const error = new Error("Feedback report is invalid.");
      error.status = 400;
      throw error;
    }
    const controller = new AbortController();
    requests.add(controller);
    const timeout = setTimer(() => controller.abort(), 8_000);
    try {
      const response = await fetchReport(reportEndpoint, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clean),
        signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error(`Feedback receiver returned ${response.status}.`);
        error.status = response.status;
        throw error;
      }
      retryAttempt = 0;
      return true;
    } finally {
      clearTimer(timeout);
      requests.delete(controller);
    }
  }

  function flush() {
    if (!reportEndpoint || !isOnline()) return Promise.resolve({ sent: 0 });
    if (flushPromise) return flushPromise;
    clearTimer(retryTimer);
    retryTimer = null;
    const activeGeneration = generation;
    flushPromise = (async () => {
      let sent = 0;
      let retry = false;
      for (const entry of readOutbox().slice(0, 6)) {
        try {
          await post(entry.payload);
          if (activeGeneration !== generation) break;
          remove(entry.id);
          sent += 1;
        } catch (error) {
          if (activeGeneration !== generation) break;
          const permanent = Number(error?.status) >= 400
            && Number(error.status) < 500
            && ![408, 429].includes(Number(error.status));
          if (permanent) {
            remove(entry.id);
            continue;
          }
          retryAttempt += 1;
          retry = true;
          break;
        }
      }
      if (activeGeneration === generation && readOutbox().length) schedule({ soon: !retry });
      return { sent, retry };
    })().finally(() => {
      flushPromise = null;
    });
    return flushPromise;
  }

  return {
    endpoint: reportEndpoint,
    cancel,
    deliveryMessage,
    flush,
    payload,
    pending: readOutbox,
    post,
    queue,
    remove,
    sanitizePayload,
    saveLocal,
    schedule,
    submitLabel
  };
}
