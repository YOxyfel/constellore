import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

process.env.NODE_ENV = "test";
process.env.CONSTELLORE_DUELS_ENABLED = "true";
process.env.CONSTELLORE_PUBLIC_DUELS_ENABLED = "true";
process.env.APP_ALLOWED_ORIGINS = "https://duel-client.example";

const { server, shutdownServer } = await import("../server.mjs");
const ALLOWED_ORIGIN = "https://duel-client.example";

function authHeaders(registration) {
  return {
    "x-constellore-player": registration.player.id,
    "x-constellore-token": registration.playerToken
  };
}

async function jsonRequest(baseUrl, pathname, {
  method = "GET",
  auth = null,
  body,
  origin = ALLOWED_ORIGIN
} = {}) {
  const headers = { origin };
  if (auth) Object.assign(headers, auth);
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

async function readSseUntil(response, predicate, timeoutMs = 8_000) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const next = await Promise.race([
      reader.read(),
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out waiting for Duel SSE.")), remaining);
        timer.unref?.();
      })
    ]);
    if (next.done) break;
    buffer += decoder.decode(next.value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const data = frame.split("\n").find((line) => line.startsWith("data: "));
      if (!data) continue;
      events.push(JSON.parse(data.slice(6)));
    }
    if (predicate(events)) return events;
  }
  throw new Error("Duel SSE closed before the expected event.");
}

test("authenticated HTTP Duel contract enforces CORS and streams replay plus live actions", async (t) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const streamAbort = new AbortController();
  t.after(async () => {
    streamAbort.abort();
    await shutdownServer("duel-api-test");
  });

  const preflight = await fetch(`${baseUrl}/api/duels/matchmaking/join`, {
    method: "OPTIONS",
    headers: {
      origin: ALLOWED_ORIGIN,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,x-constellore-player,x-constellore-token"
    }
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN);
  assert.match(preflight.headers.get("access-control-allow-methods") || "", /POST/);

  const registrations = [];
  for (let index = 0; index < 2; index += 1) {
    const registered = await jsonRequest(baseUrl, "/api/player/register", {
      method: "POST"
    });
    assert.equal(registered.response.status, 201);
    assert.equal(registered.response.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN);
    registrations.push(registered.payload);
  }
  const [hostRegistration, rivalRegistration] = registrations;
  const hostAuth = authHeaders(hostRegistration);
  const rivalAuth = authHeaders(rivalRegistration);

  const deniedOrigin = await jsonRequest(baseUrl, "/api/duels/rating", {
    auth: hostAuth,
    origin: "https://evil.example"
  });
  assert.equal(deniedOrigin.response.status, 403);
  assert.equal(deniedOrigin.payload.code, "duel_origin_denied");

  const unauthenticated = await jsonRequest(baseUrl, "/api/duels/rating");
  assert.equal(unauthenticated.response.status, 401);

  const invalidMatchmaking = await jsonRequest(baseUrl, "/api/duels/matchmaking/join", {
    method: "POST",
    auth: hostAuth,
    body: { actionId: "queue_http01", soloWins: 100_001 }
  });
  assert.equal(invalidMatchmaking.response.status, 400);
  assert.equal(invalidMatchmaking.payload.code, "invalid_duel_matchmaking");

  const invited = await jsonRequest(baseUrl, "/api/duels/invites", {
    method: "POST",
    auth: hostAuth,
    body: { actionId: "invite_http1" }
  });
  assert.equal(invited.response.status, 201);
  const joined = await jsonRequest(baseUrl, "/api/duels/join", {
    method: "POST",
    auth: rivalAuth,
    body: {
      actionId: "join_http001",
      inviteCode: invited.payload.inviteCode
    }
  });
  assert.equal(joined.response.status, 200);
  const duelId = joined.payload.duel.id;

  const hostReady = await jsonRequest(baseUrl, `/api/duels/${duelId}/ready`, {
    method: "POST",
    auth: hostAuth,
    body: { actionId: "ready_http01", ready: true }
  });
  assert.equal(hostReady.response.status, 200);
  assert.equal(hostReady.payload.duel.status, "waiting");
  const rivalReady = await jsonRequest(baseUrl, `/api/duels/${duelId}/ready`, {
    method: "POST",
    auth: rivalAuth,
    body: { actionId: "ready_http02", ready: true }
  });
  assert.equal(rivalReady.response.status, 200);
  assert.equal(rivalReady.payload.duel.status, "countdown");
  assert.equal(
    Date.parse(rivalReady.payload.duel.deadlineAt) - Date.parse(rivalReady.payload.duel.startsAt),
    300_000
  );

  const eventResponse = await fetch(
    `${baseUrl}/api/duels/${duelId}/events?after=0`,
    {
      headers: {
        origin: ALLOWED_ORIGIN,
        accept: "text/event-stream",
        ...hostAuth
      },
      signal: streamAbort.signal
    }
  );
  assert.equal(eventResponse.status, 200);
  assert.match(eventResponse.headers.get("content-type") || "", /^text\/event-stream/);
  const streamedEvents = readSseUntil(
    eventResponse,
    (events) => events.some((event) => event.type === "fusion_succeeded")
  );

  const waitForStart = Math.max(0, Date.parse(rivalReady.payload.duel.startsAt) - Date.now() + 40);
  await new Promise((resolve) => setTimeout(resolve, waitForStart));
  const action = await jsonRequest(baseUrl, `/api/duels/${duelId}/actions`, {
    method: "POST",
    auth: hostAuth,
    body: {
      actionId: "action_http1",
      expectedRevision: 0,
      a: "Earth",
      b: "Water"
    }
  });
  assert.equal(action.response.status, 200);
  assert.equal(action.payload.result.word, "Mud");
  assert.equal(action.payload.event.type, "fusion_succeeded");
  assert.ok(action.payload.duel);

  const events = await streamedEvents;
  assert.ok(events.some((event) => event.type === "player_joined"), "SSE must replay prior events");
  assert.ok(events.some((event) => event.type === "countdown_started"), "SSE must replay countdown state");
  assert.ok(events.some((event) => event.type === "fusion_succeeded"), "SSE must deliver live actions");
  assert.deepEqual(
    events.map((event) => event.sequence),
    [...events.map((event) => event.sequence)].sort((a, b) => a - b)
  );

  const publicPayload = JSON.stringify({
    joined: joined.payload,
    ready: rivalReady.payload,
    action: action.payload,
    events
  });
  for (const registration of registrations) {
    assert.equal(publicPayload.includes(registration.player.id), false);
    assert.equal(publicPayload.includes(registration.playerToken), false);
  }

  const forfeited = await jsonRequest(baseUrl, `/api/duels/${duelId}/forfeit`, {
    method: "POST",
    auth: rivalAuth,
    body: { actionId: "forfeit_http" }
  });
  assert.equal(forfeited.response.status, 200);
  assert.equal(forfeited.payload.duel.status, "finished");
  assert.equal(forfeited.payload.duel.winnerId, "slot-a");
  assert.equal(forfeited.payload.duel.rated, false);

  const sagaInvite = await jsonRequest(baseUrl, "/api/duels/invites", {
    method: "POST",
    auth: hostAuth,
    body: {
      actionId: "invite_saga_http",
      format: "riddle-saga",
      seed: 0
    }
  });
  assert.equal(sagaInvite.response.status, 201);
  assert.equal(sagaInvite.payload.duel.format, "riddle-saga");
  assert.equal(sagaInvite.payload.duel.saga.chapterCount, 5);
  assert.equal(sagaInvite.payload.duel.saga.currentChapter.number, 1);
  assert.equal(sagaInvite.payload.duel.saga.chapters.length, 1);
  assert.equal(sagaInvite.payload.duel.saga.settledChapters.length, 0);
  assert.deepEqual(
    sagaInvite.payload.duel.saga.scores.map(({ slot, score }) => ({ slot, score })),
    [
      { slot: "slot-a", score: 0 }
    ]
  );
  const sagaPublic = JSON.stringify(sagaInvite.payload);
  for (const secret of ["solutionRoute", "challengeIdentity", "runIds", "private-signature"]) {
    assert.equal(sagaPublic.includes(secret), false);
  }
});
