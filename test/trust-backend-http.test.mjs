import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { server } from "../server.mjs";

test("health, legal pages, request IDs, expiring sessions, and structured logs expose no credentials", async (t) => {
  const logs = [];
  t.mock.method(console, "info", (line) => logs.push(String(line)));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    if (!server.listening) return;
    server.close();
    await once(server, "close");
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const live = await fetch(`${baseUrl}/livez`);
  const ready = await fetch(`${baseUrl}/readyz`);
  assert.equal(live.status, 200);
  assert.equal(ready.status, 200);
  const readyBody = await ready.json();
  assert.equal(readyBody.status, "ready");
  assert.equal(typeof readyBody.build, "string");
  assert.equal(typeof readyBody.graphVersion, "string");
  assert.equal(readyBody.storage.ready, true);
  assert.match(live.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);

  for (const path of ["/privacy.html", "/terms.html", "/support.html"]) {
    const page = await fetch(`${baseUrl}${path}`);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("cache-control"), "no-cache");
  }

  const registrationResponse = await fetch(`${baseUrl}/api/player/register`, { method: "POST" });
  assert.equal(registrationResponse.status, 201);
  const registration = await registrationResponse.json();
  assert.match(registration.playerToken, /^cs3\./);
  assert.ok(Date.parse(registration.sessionExpiresAt) > Date.now());

  const authHeaders = {
    "x-constellore-player": registration.player.id,
    "x-constellore-token": registration.playerToken
  };
  assert.equal((await fetch(`${baseUrl}/api/player`, { headers: authHeaders })).status, 200);
  const revoked = await fetch(`${baseUrl}/api/player/session/revoke`, {
    method: "POST",
    headers: { ...authHeaders, "content-type": "application/json" },
    body: "{}"
  });
  assert.equal(revoked.status, 200);
  assert.equal((await fetch(`${baseUrl}/api/player`, { headers: authHeaders })).status, 401);

  await new Promise((resolve) => setImmediate(resolve));
  const serializedLogs = logs.join("\n");
  assert.match(serializedLogs, /"type":"http_request"/);
  assert.match(serializedLogs, /"requestId":"[0-9a-f-]{36}"/);
  for (const secret of [registration.playerToken, registration.recoveryCode, registration.player.id]) {
    assert.equal(serializedLogs.includes(secret), false, "structured request logs must never include credentials or player identity");
  }
});
