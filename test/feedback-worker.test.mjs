import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import worker, {
  allowedOrigin,
  pairKey,
  sanitizeReport
} from "../workers/feedback/src/index.mjs";
import { authoredRecipeCatalog } from "../server.mjs";
import {
  AUTHORED_PAIR_KEYS,
  FEEDBACK_GRAPH_VERSION,
  REVIEW_CONCEPTS
} from "../workers/feedback/generated/review-manifest.mjs";

const REPORTER = "test_reporter_1234567890";
const ADMIN_TOKEN = "operator-secret-that-is-long-enough";
const HMAC_SECRET = "report-hmac-secret-that-is-at-least-thirty-two-characters";

class MemoryD1 {
  constructor() {
    this.rows = [];
  }

  prepare(sql) {
    const database = this;
    return {
      args: [],
      bind(...args) {
        this.args = args;
        return this;
      },
      async first() {
        if (/SELECT 1 AS ok/i.test(sql)) return { ok: 1 };
        return null;
      },
      async run() {
        if (/INSERT OR IGNORE INTO combination_reports/i.test(sql)) {
          const [id, storedPairKey, a, b, expected, reason, mode, reporterHash, timestamp] = this.args;
          const duplicate = database.rows.some((row) => (
            row.pair_key === storedPairKey && row.reporter_hash === reporterHash
          ));
          if (duplicate) return { meta: { changes: 0 } };
          database.rows.push({
            id,
            pair_key: storedPairKey,
            a,
            b,
            expected,
            reason,
            mode,
            reporter_hash: reporterHash,
            first_seen_at: timestamp,
            last_seen_at: timestamp
          });
          return { meta: { changes: 1 } };
        }
        if (/UPDATE combination_reports SET last_seen_at/i.test(sql)) {
          const [timestamp, storedPairKey, reporterHash] = this.args;
          const row = database.rows.find((entry) => (
            entry.pair_key === storedPairKey && entry.reporter_hash === reporterHash
          ));
          if (row) row.last_seen_at = timestamp;
          return { meta: { changes: row ? 1 : 0 } };
        }
        if (/DELETE FROM combination_reports/i.test(sql)) return { meta: { changes: 0 } };
        throw new Error(`Unexpected D1 run query: ${sql}`);
      },
      async all() {
        if (/FROM combination_reports AS reports/i.test(sql)) {
          return { results: database.rows.map((row) => ({ ...row })) };
        }
        throw new Error(`Unexpected D1 all query: ${sql}`);
      }
    };
  }
}

function environment({ rateAllowed = true } = {}) {
  const rateKeys = [];
  return {
    ALLOWED_ORIGINS: "https://yoxyfel.github.io",
    CONSTELLORE_ADMIN_TOKEN: ADMIN_TOKEN,
    REPORT_HMAC_SECRET: HMAC_SECRET,
    DB: new MemoryD1(),
    REPORT_RATE_LIMITER: {
      async limit({ key }) {
        rateKeys.push(key);
        return { success: rateAllowed };
      }
    },
    rateKeys
  };
}

function reportRequest(payload, origin = "https://yoxyfel.github.io", network = "203.0.113.10") {
  return new Request("https://constellore-feedback.example/api/combination-reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "CF-Connecting-IP": network
    },
    body: JSON.stringify(payload)
  });
}

function payload(overrides = {}) {
  return {
    a: "Earth",
    b: "Bird",
    expected: "Nest",
    reason: "direct",
    mode: "reach",
    reporterId: REPORTER,
    ...overrides
  };
}

test("the Worker recognizes exact Pages and safe itch origins only", () => {
  const env = environment();
  assert.equal(allowedOrigin("https://yoxyfel.github.io", env), "https://yoxyfel.github.io");
  assert.equal(allowedOrigin("https://demo.itch.zone", env), "https://demo.itch.zone");
  assert.equal(allowedOrigin("https://oxyfel.itch.io", env), "https://oxyfel.itch.io");
  assert.equal(allowedOrigin("http://yoxyfel.github.io", env), "");
  assert.equal(allowedOrigin("https://yoxyfel.github.io.evil.test", env), "");
});

test("the review manifest stays synchronized with the released authored graph", () => {
  const recipes = authoredRecipeCatalog();
  assert.equal(AUTHORED_PAIR_KEYS.size, recipes.length);
  for (const recipe of recipes) {
    assert.equal(AUTHORED_PAIR_KEYS.has(pairKey(recipe.a, recipe.b)), true);
    for (const word of [recipe.a, recipe.b, recipe.word]) {
      assert.equal(REVIEW_CONCEPTS.has(String(word).toLocaleLowerCase("en")), true);
    }
  }
});

test("the review manifest carries the current release identity", async () => {
  const packageData = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(FEEDBACK_GRAPH_VERSION, `world-${packageData.version}`);
});

test("report sanitization is strict and preserves only released concepts", () => {
  assert.deepEqual(sanitizeReport(payload()), payload());
  assert.equal(sanitizeReport(payload({ a: "Unknownwordzz" })), null);
  assert.equal(sanitizeReport({ ...payload(), email: "player@example.com" }), null);
  assert.equal(sanitizeReport(payload({ expected: "https://example.com" })), null);
  assert.equal(pairKey("Bird", "Earth"), pairKey("Earth", "Bird"));
});

test("CORS preflight allows the game and rejects unrelated sites", async () => {
  const env = environment();
  const allowed = await worker.fetch(new Request(
    "https://constellore-feedback.example/api/combination-reports",
    { method: "OPTIONS", headers: { Origin: "https://yoxyfel.github.io" } }
  ), env);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://yoxyfel.github.io");

  const denied = await worker.fetch(new Request(
    "https://constellore-feedback.example/api/combination-reports",
    { method: "OPTIONS", headers: { Origin: "https://example.com" } }
  ), env);
  assert.equal(denied.status, 403);
});

test("a valid anonymous report is stored once with pair-scoped HMAC dedupe", async () => {
  const env = environment();
  const first = await worker.fetch(reportRequest(payload()), env);
  assert.equal(first.status, 202);
  const firstPayload = await first.json();
  assert.equal(firstPayload.accepted, true);
  assert.equal(firstPayload.duplicate, false);
  assert.equal(firstPayload.reviewable, true);
  assert.match(firstPayload.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(env.DB.rows.length, 1);
  assert.equal(env.DB.rows[0].a, "Bird");
  assert.equal(env.DB.rows[0].b, "Earth");
  assert.equal(env.DB.rows[0].expected, "Nest");
  assert.equal(env.DB.rows[0].reporter_id, undefined);
  assert.match(env.DB.rows[0].reporter_hash, /^[a-f0-9]{64}$/);
  assert.equal(env.DB.rows[0].reporter_hash.includes(REPORTER), false);
  assert.match(env.rateKeys[0], /^[a-f0-9]{64}$/);

  const duplicate = await worker.fetch(reportRequest(payload()), env);
  assert.equal(duplicate.status, 202);
  assert.equal((await duplicate.json()).duplicate, true);
  assert.equal(env.DB.rows.length, 1);
});

test("unknown and already-authored pairs fail closed", async () => {
  const env = environment();
  const unknown = await worker.fetch(reportRequest(payload({ a: "Unknownwordzz" })), env);
  assert.equal(unknown.status, 422);
  assert.equal((await unknown.json()).code, "combination_report_unknown_concept");

  const authored = await worker.fetch(reportRequest(payload({
    a: "Earth",
    b: "Water",
    expected: "Mud"
  })), env);
  assert.equal(authored.status, 409);
  assert.equal((await authored.json()).code, "combination_report_already_authored");
});

test("rate limiting and missing secrets fail without storing a report", async () => {
  const limitedEnv = environment({ rateAllowed: false });
  const limited = await worker.fetch(reportRequest(payload()), limitedEnv);
  assert.equal(limited.status, 429);
  assert.equal(limitedEnv.DB.rows.length, 0);

  const unavailableEnv = environment();
  unavailableEnv.REPORT_HMAC_SECRET = "";
  const unavailable = await worker.fetch(reportRequest(payload()), unavailableEnv);
  assert.equal(unavailable.status, 503);
  assert.equal(unavailableEnv.DB.rows.length, 0);
});

test("rotating a reporter ID cannot rotate the network rate-limit bucket", async () => {
  const env = environment();
  const first = await worker.fetch(reportRequest(payload()), env);
  const second = await worker.fetch(reportRequest(payload({
    reporterId: "rotated_reporter_123456789"
  })), env);
  assert.equal(first.status, 202);
  assert.equal(second.status, 202);
  assert.equal(env.rateKeys.length, 4);
  assert.notEqual(env.rateKeys[0], env.rateKeys[2]);
  assert.equal(env.rateKeys[1], env.rateKeys[3]);
});

test("the protected operator export is aggregate-only and recipe-compatible", async () => {
  const env = environment();
  await worker.fetch(reportRequest(payload()), env);
  await worker.fetch(reportRequest(payload({
    reporterId: "another_reporter_123456",
    expected: "Habitat",
    mode: "daily"
  })), env);

  const unauthorized = await worker.fetch(new Request(
    "https://constellore-feedback.example/api/admin/rejected-pairs"
  ), env);
  assert.equal(unauthorized.status, 404);

  const headers = { Authorization: `Bearer ${ADMIN_TOKEN}` };
  const response = await worker.fetch(new Request(
    "https://constellore-feedback.example/api/admin/rejected-pairs?minimumReports=1&limit=10",
    { headers }
  ), env);
  assert.equal(response.status, 200);
  const summary = await response.json();
  assert.equal(summary.reports.length, 1);
  assert.equal(summary.reports[0].count, 2);
  assert.deepEqual(summary.reports[0].pair, ["Bird", "Earth"]);
  assert.deepEqual(summary.reports[0].modes, { reach: 1, daily: 1 });
  assert.equal(JSON.stringify(summary).includes(REPORTER), false);

  const recipeResponse = await worker.fetch(new Request(
    "https://constellore-feedback.example/api/admin/recipe-feedback?minimumVotes=1&limit=10",
    { headers }
  ), env);
  assert.equal(recipeResponse.status, 200);
  assert.deepEqual((await recipeResponse.json()).recipes, []);
});

test("health reports whether D1 is connected", async () => {
  const response = await worker.fetch(new Request(
    "https://constellore-feedback.example/healthz"
  ), environment());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).storage, "d1");
});
