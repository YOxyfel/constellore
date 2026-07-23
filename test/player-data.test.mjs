import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { server } from "../server.mjs";

test("free beta players can export and permanently delete their server profile", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(async () => {
    if (!server.listening) return;
    server.close();
    await once(server, "close");
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const registrationResponse = await fetch(`${baseUrl}/api/player/register`, { method: "POST" });
  assert.equal(registrationResponse.status, 201);
  const registration = await registrationResponse.json();
  const headers = {
    "x-constellore-player": registration.player.id,
    "x-constellore-token": registration.playerToken
  };

  const exportResponse = await fetch(`${baseUrl}/api/player/export`, { headers });
  assert.equal(exportResponse.status, 200);
  const exported = await exportResponse.json();
  assert.equal(exported.player.id, registration.player.id);
  assert.equal("playerToken" in exported, false);

  const missingConfirmation = await fetch(`${baseUrl}/api/player/profile`, {
    method: "DELETE",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ confirm: "no" })
  });
  assert.equal(missingConfirmation.status, 400);

  const deletedResponse = await fetch(`${baseUrl}/api/player/profile`, {
    method: "DELETE",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ confirm: "DELETE" })
  });
  assert.equal(deletedResponse.status, 200);
  assert.deepEqual(await deletedResponse.json(), { deleted: true });

  const afterDelete = await fetch(`${baseUrl}/api/player`, { headers });
  assert.equal(afterDelete.status, 401);
});
