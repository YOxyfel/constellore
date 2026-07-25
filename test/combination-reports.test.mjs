import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { GameStore } from "../game-services.mjs";
import { server } from "../server.mjs";

const reporterA = "reporter-device-123456789";
const reporterB = "reporter-device-987654321";

test("combination reports aggregate reviewable suggestions without retaining reporter IDs", async () => {
  const store = await new GameStore().init();
  const at = new Date("2026-07-24T12:00:00.000Z");

  const first = await store.recordCombinationReport({
    a: "Earth",
    b: "Air",
    expected: "Dust",
    reason: "direct",
    mode: "quick",
    reporterId: reporterA
  }, at);
  assert.equal(first.duplicate, false);
  assert.equal(first.reviewable, true);

  const duplicate = await store.recordCombinationReport({
    a: "Air",
    b: "Earth",
    expected: "Sandstorm",
    reason: "culture",
    mode: "daily",
    reporterId: reporterA
  }, new Date(at.getTime() + 1_000));
  assert.equal(duplicate.duplicate, true);

  await store.recordCombinationReport({
    a: "Air",
    b: "Earth",
    expected: "Dust",
    reason: "mixture",
    mode: "explore",
    reporterId: reporterB
  }, new Date(at.getTime() + 2_000));

  const summary = store.rejectedPairSummary();
  assert.equal(summary.reports.length, 1);
  assert.deepEqual(summary.reports[0].pair, ["air", "earth"]);
  assert.equal(summary.reports[0].count, 2);
  assert.deepEqual(summary.reports[0].modes, { quick: 1, explore: 1 });
  assert.deepEqual(summary.reports[0].reasons, { direct: 1, mixture: 1 });
  assert.deepEqual(summary.reports[0].suggestions.map(({ word, count }) => ({ word, count })), [{ word: "dust", count: 2 }]);
  assert.equal(summary.reports[0].reviewable, true);

  const persisted = JSON.stringify(store.data);
  assert.equal(persisted.includes(reporterA), false);
  assert.equal(persisted.includes(reporterB), false);
});

test("combination report text, reasons, modes, and reporter identities are strictly bounded", async () => {
  const store = await new GameStore().init();
  const base = { a: "Water", b: "Water", expected: "", reason: "", mode: "reach", reporterId: reporterA };
  const rejects = async (overrides, code) => {
    await assert.rejects(
      store.recordCombinationReport({ ...base, ...overrides }),
      (error) => error.serviceCode === code
    );
  };

  await rejects({ a: "Water\nprivate" }, "unsafe_combination_report_text");
  await rejects({ expected: "person@example.com" }, "unsafe_combination_report_text");
  await rejects({ expected: "https://example.com" }, "unsafe_combination_report_text");
  await rejects({ expected: "x".repeat(29) }, "invalid_combination_report_text");
  await rejects({ reason: "because" }, "invalid_combination_report_reason");
  await rejects({ reason: false }, "invalid_combination_report_reason");
  await rejects({ mode: "training" }, "invalid_combination_report_mode");
  await rejects({ reporterId: "short" }, "invalid_combination_report_reporter");

  const optional = await store.recordCombinationReport(base);
  assert.equal(optional.accepted, true);
  assert.deepEqual(store.rejectedPairSummary().reports[0].suggestions, []);
});

test("legacy combination_expected analytics remains compatible with the dedicated report store", async () => {
  const store = await new GameStore().init();
  await store.recordAnalyticsEvent({
    name: "combination_expected",
    sessionId: "legacy-session",
    cohortId: "legacy-cohort-123456789",
    properties: { a: "Earth", b: "Water", mode: "reach" }
  }, new Date("2026-07-24T12:00:00.000Z"), { allowRejectedPairPlaintext: true });

  const report = store.rejectedPairSummary().reports[0];
  assert.equal(report.count, 1);
  assert.deepEqual(report.pair, ["earth", "water"]);
  assert.deepEqual(report.suggestions, []);
  assert.deepEqual(report.reasons, {});
  assert.equal(store.analyticsSummary(1, new Date("2026-07-24T12:00:00.000Z")).events.combination_expected, 1);
});

test("the combination report API enforces its contract, dedupes, rate-limits, and feeds the admin queue", async (t) => {
  const previousAdminToken = process.env.CONSTELLORE_ADMIN_TOKEN;
  const previousInterestOrigins = process.env.INTEREST_ALLOWED_ORIGINS;
  const previousTrustProxy = process.env.CONSTELLORE_TRUST_PROXY;
  process.env.CONSTELLORE_ADMIN_TOKEN = "combination-report-test-admin-token";
  process.env.INTEREST_ALLOWED_ORIGINS = "https://yoxyfel.github.io";
  t.after(() => {
    if (previousAdminToken === undefined) delete process.env.CONSTELLORE_ADMIN_TOKEN;
    else process.env.CONSTELLORE_ADMIN_TOKEN = previousAdminToken;
    if (previousInterestOrigins === undefined) delete process.env.INTEREST_ALLOWED_ORIGINS;
    else process.env.INTEREST_ALLOWED_ORIGINS = previousInterestOrigins;
    if (previousTrustProxy === undefined) delete process.env.CONSTELLORE_TRUST_PROXY;
    else process.env.CONSTELLORE_TRUST_PROXY = previousTrustProxy;
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    if (server.listening) {
      server.close();
      await once(server, "close");
    }
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const request = async (path, { method = "GET", body, headers = {} } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { response, payload: await response.json() };
  };
  const report = {
    a: "Telescope",
    b: "Mud",
    expected: "Observatory",
    reason: "direct",
    mode: "moves",
    reporterId: reporterA
  };

  for (const origin of ["https://yoxyfel.github.io", "https://html-classic.itch.zone"]) {
    const preflight = await fetch(`${baseUrl}/api/combination-reports`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
      }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
    assert.equal(preflight.headers.get("access-control-allow-credentials"), null);
  }
  for (const origin of ["https://attacker.example", "http://itch.io", "https://itch.zone.attacker.example", "null"]) {
    const preflight = await fetch(`${baseUrl}/api/combination-reports`, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "POST" }
    });
    assert.equal(preflight.status, 403);
    assert.equal((await preflight.json()).code, "combination_report_origin_denied");
  }

  const accepted = await request("/api/combination-reports", {
    method: "POST",
    body: report,
    headers: { Origin: "https://yoxyfel.github.io" }
  });
  assert.equal(accepted.response.status, 202);
  assert.equal(accepted.response.headers.get("access-control-allow-origin"), "https://yoxyfel.github.io");
  assert.deepEqual(accepted.payload, { accepted: true, duplicate: false, reviewable: true });

  const duplicate = await request("/api/combination-reports", {
    method: "POST",
    body: { ...report, a: report.b, b: report.a, expected: "Blaze" }
  });
  assert.equal(duplicate.response.status, 202);
  assert.equal(duplicate.payload.duplicate, true);

  const extraField = await request("/api/combination-reports", {
    method: "POST",
    body: { ...report, email: "not-accepted@example.com" }
  });
  assert.equal(extraField.response.status, 400);
  assert.equal(extraField.payload.code, "invalid_combination_report_request");

  const authoredPair = await request("/api/combination-reports", {
    method: "POST",
    body: { ...report, a: "Fire", b: "Fire", expected: "Inferno" }
  });
  assert.equal(authoredPair.response.status, 409);
  assert.equal(authoredPair.payload.code, "combination_report_already_authored");

  const unknownConcept = await request("/api/combination-reports", {
    method: "POST",
    body: { ...report, a: "AbsolutelyUnknownConcept", b: "Mud" }
  });
  assert.equal(unknownConcept.response.status, 422);
  assert.equal(unknownConcept.payload.code, "combination_report_unknown_concept");

  const queue = await request("/api/admin/rejected-pairs", {
    headers: { "x-constellore-admin": "combination-report-test-admin-token" }
  });
  assert.equal(queue.response.status, 200);
  const stored = queue.payload.reports.find((entry) => entry.pair?.join("+") === "mud+telescope");
  assert.ok(stored);
  assert.equal(stored.count, 1);
  assert.deepEqual(stored.suggestions.map(({ word, count }) => ({ word, count })), [{ word: "observatory", count: 1 }]);
  assert.deepEqual(stored.reasons, { direct: 1 });

  let limited = null;
  for (let index = 0; index < 10; index += 1) {
    limited = await request("/api/combination-reports", { method: "POST", body: report });
  }
  assert.equal(limited.response.status, 429);
  assert.equal(limited.payload.code, "combination_report_rate_limited");

  process.env.CONSTELLORE_TRUST_PROXY = "true";
  const proxiedClient = await request("/api/combination-reports", {
    method: "POST",
    body: { ...report, reporterId: reporterB },
    headers: { "x-forwarded-for": "203.0.113.42" }
  });
  assert.equal(proxiedClient.response.status, 202);
});

test("operator documentation names the real hosted and static report destinations", async () => {
  const [readme, deploy, packageSource, operatorScript] = await Promise.all([
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../DEPLOY_BETA.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/export-operator-feedback.mjs", import.meta.url), "utf8")
  ]);
  const packageJson = JSON.parse(packageSource);
  assert.equal(packageJson.scripts["operator:feedback"], "node scripts/export-operator-feedback.mjs");
  assert.match(readme, /POST `?\/api\/combination-reports`?/);
  assert.match(readme, /Pages and itch always retain a bounded local copy[\s\S]*PUBLIC_FEEDBACK_API_URL[\s\S]*retry/i);
  assert.match(deploy, /not emailed/i);
  assert.match(deploy, /hosted Node beta[\s\S]*server store/i);
  assert.match(deploy, /operator:feedback[\s\S]*retrieve the aggregate/i);
  assert.match(deploy, /without (?:a )?GitHub account/i);
  assert.match(deploy, /GitHub issues remain an optional manual support route/i);
  assert.match(operatorScript, /Authorization: `Bearer \$\{token\}`/);
  assert.match(operatorScript, /\/api\/admin\/rejected-pairs/);
  assert.match(operatorScript, /\/api\/admin\/recipe-feedback/);
});
