import {
  AUTHORED_PAIR_KEYS,
  FEEDBACK_GRAPH_VERSION,
  REVIEW_CONCEPTS
} from "../generated/review-manifest.mjs";

const REPORT_PATH = "/api/combination-reports";
const ADMIN_REPORT_PATH = "/api/admin/rejected-pairs";
const ADMIN_RECIPE_PATH = "/api/admin/recipe-feedback";
const REPORT_REASONS = new Set(["", "direct", "mixture", "repeat", "culture", "other"]);
const REPORT_MODES = new Set(["reach", "quick", "moves", "daily", "weekly", "challenge", "explore"]);
const REPORT_KEYS = new Set(["a", "b", "expected", "reason", "mode", "reporterId"]);
const REQUIRED_REPORT_KEYS = ["a", "b", "mode", "reporterId"];
const MAX_BODY_BYTES = 1024;
const MAX_ADMIN_LIMIT = 500;
const DEFAULT_ALLOWED_ORIGIN = "https://yoxyfel.github.io";
const ITCH_HOST_SUFFIXES = [".itch.io", ".itch.zone"];

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function errorResponse(status, error, code, headers = {}) {
  return json({ error, code }, status, headers);
}

function configuredOrigins(env) {
  const configured = String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGIN);
  return new Set(configured.split(",").map((value) => value.trim()).filter(Boolean));
}

function allowedOrigin(origin, env) {
  if (!origin) return "";
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return "";
  }
  if (parsed.origin !== origin || parsed.protocol !== "https:") return "";
  if (configuredOrigins(env).has(origin)) return origin;
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "itch.io" || ITCH_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return origin;
  return "";
}

function corsHeaders(origin) {
  return origin ? {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  } : {};
}

function normalizedText(value) {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function safeSuggestion(value, { optional = false } = {}) {
  const text = normalizedText(value);
  if (!text && optional) return "";
  if (
    !text
    || text.length > 28
    || text.split(/\s+/u).length > 4
    || /[@\r\n]/u.test(text)
    || /(?:https?:\/\/|www[.]|[.](?:app|bg|co|com|dev|eu|gg|io|me|net|org)\b)/iu.test(text)
    || !/^[\p{L}\p{N}][\p{L}\p{N} '&-]{0,27}$/u.test(text)
  ) return null;
  return text;
}

function conceptKey(value) {
  return normalizedText(value).toLocaleLowerCase("en");
}

function pairKey(left, right) {
  return [conceptKey(left), conceptKey(right)].sort().join("\0");
}

function validateReport(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: 400, code: "invalid_combination_report_request" };
  }
  const keys = Object.keys(value);
  if (
    keys.some((key) => !REPORT_KEYS.has(key))
    || REQUIRED_REPORT_KEYS.some((key) => !Object.hasOwn(value, key))
  ) return { status: 400, code: "invalid_combination_report_request" };

  const safeA = safeSuggestion(value.a);
  const safeB = safeSuggestion(value.b);
  const expected = safeSuggestion(value.expected, { optional: true });
  const reason = String(value.reason || "");
  const mode = String(value.mode || "");
  const reporterId = String(value.reporterId || "");
  if (
    !safeA
    || !safeB
    || expected === null
    || !REPORT_REASONS.has(reason)
    || !REPORT_MODES.has(mode)
    || !/^[A-Za-z0-9_-]{16,80}$/.test(reporterId)
  ) return { status: 400, code: "invalid_combination_report_request" };
  const a = REVIEW_CONCEPTS.get(conceptKey(safeA));
  const b = REVIEW_CONCEPTS.get(conceptKey(safeB));
  if (!a || !b) return { status: 422, code: "combination_report_unknown_concept" };
  return { clean: { a, b, expected, reason, mode, reporterId } };
}

function sanitizeReport(value) {
  return validateReport(value).clean || null;
}

async function readReportBody(request) {
  const contentType = String(request.headers.get("Content-Type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    return { response: errorResponse(415, "Send the report as JSON.", "combination_report_content_type") };
  }
  const declaredSize = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    return { response: errorResponse(413, "That report is too large.", "combination_report_too_large") };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { response: errorResponse(413, "That report is too large.", "combination_report_too_large") };
  }
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { response: errorResponse(400, "That report is not valid JSON.", "invalid_combination_report_json") };
  }
}

function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function constantTimeTokenMatch(candidate, expected) {
  if (typeof candidate !== "string" || typeof expected !== "string" || expected.length < 24) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = candidate.length ^ expected.length;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function bearerToken(request) {
  const header = String(request.headers.get("Authorization") || "");
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function requireAdmin(request, env) {
  return constantTimeTokenMatch(bearerToken(request), String(env.CONSTELLORE_ADMIN_TOKEN || ""));
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function clientNetworkKey(request) {
  const value = String(request.headers.get("CF-Connecting-IP") || "").trim();
  return value && value.length <= 64 ? value : "unavailable";
}

async function rateLimited(clean, request, env) {
  if (!env.REPORT_RATE_LIMITER?.limit) return false;
  const secret = String(env.REPORT_HMAC_SECRET || "");
  const subjects = [
    `reporter\0${clean.reporterId}`,
    `network\0${clientNetworkKey(request)}`
  ];
  for (const subject of subjects) {
    const key = await hmacHex(secret, `rate\0${subject}`);
    const result = await env.REPORT_RATE_LIMITER.limit({ key });
    if (!result?.success) return true;
  }
  return false;
}

async function storeReport(clean, env, date = new Date()) {
  const canonicalPair = [clean.a, clean.b].sort((left, right) => conceptKey(left).localeCompare(conceptKey(right), "en"));
  const key = pairKey(canonicalPair[0], canonicalPair[1]);
  const reporterHash = await hmacHex(
    String(env.REPORT_HMAC_SECRET || ""),
    `${key}\0${clean.reporterId}`
  );
  const fingerprint = await hmacHex(String(env.REPORT_HMAC_SECRET || ""), `pair\0${key}`);
  const timestamp = date.toISOString();
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO combination_reports
      (id, pair_key, a, b, expected, reason, mode, reporter_hash, first_seen_at, last_seen_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`
  ).bind(
    crypto.randomUUID(),
    key,
    canonicalPair[0],
    canonicalPair[1],
    clean.expected,
    clean.reason,
    clean.mode,
    reporterHash,
    timestamp
  ).run();
  const duplicate = Number(inserted?.meta?.changes ?? inserted?.changes ?? 0) === 0;
  if (duplicate) {
    await env.DB.prepare(
      "UPDATE combination_reports SET last_seen_at = ?1 WHERE pair_key = ?2 AND reporter_hash = ?3"
    ).bind(timestamp, key, reporterHash).run();
    return { accepted: true, duplicate: true, fingerprint, reviewable: true };
  }
  return { accepted: true, duplicate: false, fingerprint, reviewable: true };
}

async function receiveReport(request, env) {
  const origin = allowedOrigin(request.headers.get("Origin"), env);
  if (!origin) {
    return errorResponse(403, "That origin is not allowed.", "combination_report_origin_denied");
  }
  const cors = corsHeaders(origin);
  const parsed = await readReportBody(request);
  if (parsed.response) {
    for (const [name, value] of Object.entries(cors)) parsed.response.headers.set(name, value);
    return parsed.response;
  }
  const validation = validateReport(parsed.value);
  if (!validation.clean) {
    if (validation.status === 422) {
      return errorResponse(
        422,
        "That report includes a concept outside the released word graph.",
        validation.code,
        cors
      );
    }
    return errorResponse(
      400,
      "Combination reports accept only two released words, an optional short answer, a fixed reason, the game mode, and a duplicate-check ID.",
      validation.code,
      cors
    );
  }
  const clean = validation.clean;
  const key = pairKey(clean.a, clean.b);
  if (AUTHORED_PAIR_KEYS.has(key)) {
    return errorResponse(409, "That combination already has an authored result.", "combination_report_already_authored", cors);
  }
  if (
    String(env.REPORT_HMAC_SECRET || "").length < 32
    || !env.DB?.prepare
  ) {
    return errorResponse(503, "The feedback receiver is not ready.", "combination_report_unavailable", cors);
  }
  if (await rateLimited(clean, request, env)) {
    return errorResponse(429, "Too many combination reports. Please try again later.", "combination_report_rate_limited", {
      ...cors,
      "Retry-After": "60"
    });
  }
  try {
    return json(await storeReport(clean, env), 202, cors);
  } catch {
    return errorResponse(503, "The feedback receiver could not save that idea.", "combination_report_unavailable", cors);
  }
}

function countBy(rows, field) {
  const counts = {};
  for (const row of rows) {
    const value = String(row[field] || "");
    if (value) counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function aggregateSuggestions(rows) {
  const suggestions = new Map();
  for (const row of rows) {
    const word = String(row.expected || "");
    if (!word) continue;
    const existing = suggestions.get(word) || { word, count: 0, lastSeenAt: row.last_seen_at };
    existing.count += 1;
    if (String(row.last_seen_at) > String(existing.lastSeenAt)) existing.lastSeenAt = row.last_seen_at;
    suggestions.set(word, existing);
  }
  return [...suggestions.values()]
    .sort((left, right) => right.count - left.count || String(right.lastSeenAt).localeCompare(String(left.lastSeenAt)))
    .slice(0, 20);
}

async function rejectedPairSummary(url, env) {
  const minimumReports = boundedInteger(url.searchParams.get("minimumReports"), 1, 1, 100_000);
  const limit = boundedInteger(url.searchParams.get("limit"), 100, 1, MAX_ADMIN_LIMIT);
  const query = await env.DB.prepare(
    `SELECT reports.*
       FROM combination_reports AS reports
       INNER JOIN (
         SELECT pair_key, COUNT(*) AS report_count, MAX(last_seen_at) AS newest
           FROM combination_reports
          GROUP BY pair_key
         HAVING COUNT(*) >= ?1
          ORDER BY report_count DESC, newest DESC
          LIMIT ?2
       ) AS selected ON selected.pair_key = reports.pair_key
      ORDER BY selected.report_count DESC, selected.newest DESC, reports.last_seen_at DESC`
  ).bind(minimumReports, limit).all();
  const grouped = new Map();
  for (const row of query.results || []) {
    const group = grouped.get(row.pair_key) || [];
    group.push(row);
    grouped.set(row.pair_key, group);
  }
  const reports = [];
  for (const rows of grouped.values()) {
    const newest = rows.reduce((value, row) => String(row.last_seen_at) > value ? row.last_seen_at : value, "");
    reports.push({
      fingerprint: await hmacHex(String(env.REPORT_HMAC_SECRET || ""), `pair\0${rows[0].pair_key}`),
      count: rows.length,
      pair: [rows[0].a, rows[0].b],
      suggestions: aggregateSuggestions(rows),
      reasons: countBy(rows, "reason"),
      modes: countBy(rows, "mode"),
      lastSeenAt: newest,
      reviewable: true
    });
  }
  reports.sort((left, right) => right.count - left.count || String(right.lastSeenAt).localeCompare(String(left.lastSeenAt)));
  return {
    privacy: "reporter IDs are one-way pair-scoped digests; no raw identifier, IP address, contact detail, or open comment is stored",
    graphVersion: FEEDBACK_GRAPH_VERSION,
    reports: reports.slice(0, limit),
    updatedAt: reports[0]?.lastSeenAt || null
  };
}

async function adminResponse(request, env, url) {
  if (!(await requireAdmin(request, env))) {
    return errorResponse(404, "Not found.", "not_found");
  }
  if (!env.DB?.prepare || String(env.REPORT_HMAC_SECRET || "").length < 32) {
    return errorResponse(503, "The feedback receiver is not ready.", "feedback_backend_unavailable");
  }
  if (url.pathname === ADMIN_RECIPE_PATH) {
    return json({
      privacy: "aggregate-only",
      totalVotes: 0,
      recipes: [],
      updatedAt: null,
      note: "The free feedback receiver collects missing combinations only."
    });
  }
  try {
    return json(await rejectedPairSummary(url, env));
  } catch {
    return errorResponse(503, "The feedback report could not be read.", "feedback_backend_unavailable");
  }
}

async function health(env) {
  try {
    const row = await env.DB?.prepare("SELECT 1 AS ok").first();
    return json({
      ok: row?.ok === 1,
      service: "constellore-feedback",
      graphVersion: FEEDBACK_GRAPH_VERSION,
      storage: "d1"
    }, row?.ok === 1 ? 200 : 503);
  } catch {
    return errorResponse(503, "Feedback storage is unavailable.", "feedback_backend_unavailable");
  }
}

async function cleanup(env) {
  const retentionDays = boundedInteger(env.RETENTION_DAYS, 180, 30, 730);
  await env.DB.prepare(
    "DELETE FROM combination_reports WHERE last_seen_at < datetime('now', ?1)"
  ).bind(`-${retentionDays} days`).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz" && request.method === "GET") return health(env);
    if (url.pathname === REPORT_PATH && request.method === "OPTIONS") {
      const origin = allowedOrigin(request.headers.get("Origin"), env);
      return origin
        ? new Response(null, { status: 204, headers: corsHeaders(origin) })
        : errorResponse(403, "That origin is not allowed.", "combination_report_origin_denied");
    }
    if (url.pathname === REPORT_PATH && request.method === "POST") return receiveReport(request, env);
    if (
      request.method === "GET"
      && [ADMIN_REPORT_PATH, ADMIN_RECIPE_PATH].includes(url.pathname)
    ) return adminResponse(request, env, url);
    return errorResponse(404, "Not found.", "not_found");
  },

  async scheduled(_controller, env, context) {
    context.waitUntil(cleanup(env));
  }
};

export {
  ADMIN_RECIPE_PATH,
  ADMIN_REPORT_PATH,
  REPORT_PATH,
  allowedOrigin,
  pairKey,
  sanitizeReport
};
