import assert from "node:assert/strict";
import { once } from "node:events";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { GameStore, RunRegistry } from "../game-services.mjs";
import { writeLocalWorldModule } from "../scripts/build-local-world.mjs";
import { server } from "../server.mjs";

const ENTRY_ID = "entry-12345678-1234-1234-1234-123456789abc";

function registryGame(overrides = {}) {
  return {
    mode: "quick",
    target: "Telescope",
    seed: 7,
    starters: ["Earth", "Water", "Fire", "Air"],
    timeLimit: 90,
    adaptive: true,
    ...overrides
  };
}

async function preparedLocalRequest(context) {
  const directory = await mkdtemp(join(tmpdir(), "constellore-entry-recovery-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeLocalWorldModule(join(directory, "local-world.mjs"));
  await Promise.all([
    "local-beta.mjs",
    "concept-chemistry.mjs",
    "cosmic-twists.mjs",
    "engagement-features.mjs",
    "universe-director.mjs",
    "recipe-feedback.mjs",
    "adaptive-difficulty.mjs",
    "remix-progression.mjs",
    "remix-readiness.mjs",
    "path-guard.mjs",
    "route-remixes.mjs",
    "shuffled-start.mjs"
  ].map((filename) => copyFile(
    new URL(`../public/${filename}`, import.meta.url),
    join(directory, filename)
  )));
  const runtime = await import(`${pathToFileURL(join(directory, "local-beta.mjs")).href}?test=${Date.now()}`);
  return runtime.localRequest;
}

test("RunRegistry recovers a persisted start before active-attempt guards", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const firstRegistry = new RunRegistry(store);
  const options = {
    ranked: true,
    challengeId: "quick:recovery-proof",
    entryId: ENTRY_ID,
    deferActivation: true
  };

  const first = firstRegistry.start(player.id, registryGame(), options);
  const immediateRetry = firstRegistry.start(player.id, registryGame(), options);
  assert.equal(immediateRetry.recovered, true);
  assert.equal(immediateRetry.run.runId, first.run.runId);
  assert.equal(immediateRetry.token, first.token);
  assert.equal(firstRegistry.runs.size, 1);
  assert.equal(Object.keys(store.data.runs).length, 1);

  await firstRegistry.persist(first.run);
  const restoredRegistry = new RunRegistry(store);
  const restoredRetry = restoredRegistry.start(player.id, registryGame(), options);
  assert.equal(restoredRetry.recovered, true);
  assert.equal(restoredRetry.run.runId, first.run.runId);
  assert.equal(restoredRetry.token, first.token);
  assert.equal(restoredRegistry.runs.size, 1);

  assert.throws(
    () => restoredRegistry.start(
      player.id,
      registryGame({ target: "City", seed: 9 }),
      options
    ),
    (error) => error.statusCode === 409 && error.serviceCode === "run_entry_conflict"
  );
  assert.equal(restoredRegistry.runs.size, 1);

  for (const invalidEntryId of [null, "", "short", "entry_with_underscores_123456"]) {
    assert.throws(
      () => restoredRegistry.start(
        player.id,
        registryGame({ adaptive: false }),
        { entryId: invalidEntryId }
      ),
      (error) => error.statusCode === 400 && error.serviceCode === "invalid_run_entry_id"
    );
  }
});

test("hosted start retries and deferred resume are idempotent", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(async () => {
    if (!server.listening) return;
    server.close();
    await once(server, "close");
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let auth = {};
  const request = async (path, { method = "GET", body, authenticated = true } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(authenticated ? auth : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return { response, payload: await response.json() };
  };

  const registration = await request("/api/player/register", {
    method: "POST",
    authenticated: false
  });
  assert.equal(registration.response.status, 201);
  auth = {
    "x-constellore-player": registration.payload.player.id,
    "x-constellore-token": registration.payload.playerToken
  };

  const preview = await request("/api/run/preview", {
    method: "POST",
    body: { mode: "reach", seed: 7, target: "Telescope" }
  });
  assert.equal(preview.response.status, 200);
  const startBody = {
    previewToken: preview.payload.previewToken,
    entryId: ENTRY_ID,
    deferActivation: true
  };
  const first = await request("/api/run/start", { method: "POST", body: startBody });
  const retry = await request("/api/run/start", { method: "POST", body: startBody });
  assert.equal(first.response.status, 201);
  assert.equal(retry.response.status, 201);
  assert.equal(first.payload.run.id, retry.payload.run.id);
  assert.equal(first.payload.run.token, retry.payload.run.token);
  assert.equal(retry.payload.run.activationPending, true);

  const credentials = {
    runId: first.payload.run.id,
    runToken: first.payload.run.token
  };
  const deferredResume = await request("/api/run/resume", {
    method: "POST",
    body: { ...credentials, deferActivation: true }
  });
  assert.equal(deferredResume.response.status, 200);
  assert.equal(deferredResume.payload.run.activationPending, true);

  const activatedResume = await request("/api/run/resume", {
    method: "POST",
    body: credentials
  });
  assert.equal(activatedResume.response.status, 200);
  assert.equal(activatedResume.payload.run.activationPending, false);

  const invalidResume = await request("/api/run/resume", {
    method: "POST",
    body: { ...credentials, deferActivation: "true" }
  });
  assert.equal(invalidResume.response.status, 400);
  assert.equal(invalidResume.payload.code, "invalid_resume_request");

  const conflictingStart = await request("/api/run/start", {
    method: "POST",
    body: {
      mode: "reach",
      seed: 9,
      target: "City",
      entryId: ENTRY_ID
    }
  });
  assert.equal(conflictingStart.response.status, 409);
  assert.equal(conflictingStart.payload.code, "run_entry_conflict");
});

test("local beta mirrors idempotent starts and deferred resume", async (context) => {
  const localRequest = await preparedLocalRequest(context);
  const localEntryId = "entry-abcdefab-cdef-abcd-efab-cdefabcdefab";
  const preview = await localRequest("/api/run/preview", {
    method: "POST",
    body: JSON.stringify({ mode: "reach", seed: 7, target: "Telescope" })
  });
  const startBody = JSON.stringify({
    previewToken: preview.previewToken,
    entryId: localEntryId,
    deferActivation: true
  });
  const first = await localRequest("/api/run/start", {
    method: "POST",
    body: startBody
  });
  const retry = await localRequest("/api/run/start", {
    method: "POST",
    body: startBody
  });
  assert.equal(first.run.id, retry.run.id);
  assert.equal(first.run.token, retry.run.token);
  assert.equal(retry.run.activationPending, true);

  const credentials = {
    runId: first.run.id,
    runToken: first.run.token
  };
  const deferredResume = await localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify({ ...credentials, deferActivation: true })
  });
  assert.equal(deferredResume.run.activationPending, true);

  const activatedResume = await localRequest("/api/run/resume", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
  assert.equal(activatedResume.run.activationPending, false);

  await assert.rejects(
    localRequest("/api/run/resume", {
      method: "POST",
      body: JSON.stringify({ ...credentials, deferActivation: "true" })
    }),
    (error) => error.status === 400 && error.code === "invalid_resume_request"
  );

  await assert.rejects(
    localRequest("/api/run/start", {
      method: "POST",
      body: JSON.stringify({
        mode: "reach",
        seed: 9,
        target: "City",
        entryId: localEntryId
      })
    }),
    (error) => error.status === 409 && error.code === "run_entry_conflict"
  );
});
