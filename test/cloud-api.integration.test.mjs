import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { server } from "../server.mjs";

test("cloud account, restore, and protected operator contracts are enforced over HTTP", async (t) => {
  const previousAdminToken = process.env.CONSTELLORE_ADMIN_TOKEN;
  delete process.env.CONSTELLORE_ADMIN_TOKEN;
  t.after(() => {
    if (previousAdminToken === undefined) delete process.env.CONSTELLORE_ADMIN_TOKEN;
    else process.env.CONSTELLORE_ADMIN_TOKEN = previousAdminToken;
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
  const base = `http://127.0.0.1:${address.port}`;
  let auth = {};
  const request = async (path, { method = "GET", body, headers = {}, authenticated = true } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(authenticated ? auth : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    return { response, payload: await response.json() };
  };

  const disabledSummary = await request("/api/analytics/summary", { authenticated: false });
  assert.equal(disabledSummary.response.status, 404);
  assert.equal(disabledSummary.payload.code, "admin_api_disabled");
  process.env.CONSTELLORE_ADMIN_TOKEN = "too-short";
  const weakSummary = await request("/api/analytics/summary", { authenticated: false, headers: { authorization: "Bearer too-short" } });
  assert.equal(weakSummary.response.status, 404);
  process.env.CONSTELLORE_ADMIN_TOKEN = "operator-token-at-least-thirty-two-characters";
  const deniedSummary = await request("/api/analytics/summary", { authenticated: false, headers: { authorization: "Bearer wrong" } });
  assert.equal(deniedSummary.response.status, 401);
  const allowedSummary = await request("/api/analytics/summary?days=7", {
    authenticated: false,
    headers: { "x-constellore-admin": "operator-token-at-least-thirty-two-characters" }
  });
  assert.equal(allowedSummary.response.status, 200);
  assert.equal(allowedSummary.payload.privacy, "aggregate-only");
  assert.equal(allowedSummary.response.headers.get("cache-control"), "no-store");

  const config = await request("/api/config", { authenticated: false });
  assert.deepEqual(config.payload.creditPacks, []);
  assert.equal(config.payload.testStoreEnabled, false, "the test store must require an explicit opt-in flag");
  assert.equal(config.payload.commercePolicy.starCreditsSoldForCash, false);
  assert.deepEqual(config.payload.products.map((product) => product.id), ["constellore_founders_pass"]);

  const registration = await request("/api/player/register", { method: "POST", authenticated: false });
  assert.equal(registration.response.status, 201);
  assert.match(registration.payload.recoveryCode, /^CF(?:-[0-9A-F]{4}){8}$/);
  auth = {
    "x-constellore-player": registration.payload.player.id,
    "x-constellore-token": registration.payload.playerToken
  };
  const defaultTestGrant = await request("/api/player/test-entitlement", { method: "POST", body: {} });
  assert.equal(defaultTestGrant.response.status, 403);
  assert.equal(defaultTestGrant.payload.code, "test_store_disabled");

  const initialProfile = await request("/api/player/profile");
  assert.deepEqual(initialProfile.payload, { version: 0, profile: {}, updatedAt: null });
  assert.equal(initialProfile.response.headers.get("cache-control"), "no-store");
  const updatedProfile = await request("/api/player/profile", {
    method: "PUT",
    body: {
      version: 0,
      profile: {
        theme: "void",
        cosmetics: { theme: "void", board: "starlit", trail: "classic", sound: "cosmic" },
        firstOrbit: { seen: true, completed: true },
        feedbackPreferences: { sound: false, haptics: true, muted: false, volume: 0.75 },
        progression: { stardust: 420, wins: 3, dailyStreak: 2, lastDailyDate: "2026-07-17", dailyCompleted: "2026-07-17", streakShields: 1 }
      }
    }
  });
  assert.equal(updatedProfile.response.status, 200);
  assert.equal(updatedProfile.payload.version, 1);
  const forbiddenBalance = await request("/api/player/profile", { method: "PUT", body: { version: 1, profile: { credits: 999_999 } } });
  assert.equal(forbiddenBalance.response.status, 400);
  const lockedCosmetic = await request("/api/player/profile", { method: "PUT", body: { version: 1, profile: { cosmetics: { trail: "comet" } } } });
  assert.equal(lockedCosmetic.response.status, 403);
  assert.equal(lockedCosmetic.payload.code, "cosmetic_entitlement_required");
  const conflict = await request("/api/player/profile", { method: "PUT", body: { version: 0, profile: { theme: "void" } } });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.payload.details.current.version, 1);
  const largeProfile = await request("/api/player/profile", {
    method: "PUT",
    body: {
      version: 1,
      profile: { discovered: Array.from({ length: 700 }, (_, index) => `Discovery-${String(index).padStart(4, "0")}-${"x".repeat(60)}`) }
    }
  });
  assert.equal(largeProfile.response.status, 200, "a valid mature cloud profile may exceed the old 50 KB transport cap");
  assert.equal(largeProfile.payload.version, 2);

  const restored = await request("/api/player/restore", { method: "POST", body: {} });
  assert.equal(restored.response.status, 200);
  assert.equal(restored.payload.entitlements.balance.starCredits, registration.payload.player.credits);
  assert.equal(restored.payload.entitlements.policy.rankedAdvantages, false);

  const recovery = await request("/api/player/recover", {
    method: "POST",
    authenticated: false,
    body: { playerId: registration.payload.player.id, recoveryCode: registration.payload.recoveryCode }
  });
  assert.equal(recovery.response.status, 200);
  assert.notEqual(recovery.payload.recoveryCode, registration.payload.recoveryCode);
  const oldSession = await request("/api/player");
  assert.equal(oldSession.response.status, 401);
  auth["x-constellore-token"] = recovery.payload.playerToken;
  const recoveredSession = await request("/api/player");
  assert.equal(recoveredSession.response.status, 200);
  const replayedRecovery = await request("/api/player/recover", {
    method: "POST",
    authenticated: false,
    body: { playerId: registration.payload.player.id, recoveryCode: registration.payload.recoveryCode }
  });
  assert.equal(replayedRecovery.response.status, 401);

  const unavailableBackup = await request("/api/admin/backup", {
    method: "POST",
    authenticated: false,
    headers: { authorization: "Bearer operator-token-at-least-thirty-two-characters" },
    body: {}
  });
  assert.equal(unavailableBackup.response.status, 409, "the imported test server intentionally uses an in-memory store");
});
