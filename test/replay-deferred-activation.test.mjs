import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, server, local] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../server.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/local-beta.mjs", import.meta.url), "utf8")
]);

function endpointSource(source, marker, nextMarker) {
  const start = source.indexOf(marker);
  const end = source.indexOf(nextMarker, start + marker.length);
  assert.notEqual(start, -1, `Missing endpoint ${marker}`);
  assert.notEqual(end, -1, `Missing endpoint boundary ${nextMarker}`);
  return source.slice(start, end);
}

test("the exact-replay client asks both runtimes for a pending run", () => {
  const replay = app.slice(
    app.indexOf("async function replayFinishedChallenge"),
    app.indexOf("function startTimer")
  );
  assert.match(replay, /\/api\/run\/replay/);
  assert.match(replay, /const sourceRun = state[.]run/);
  assert.match(replay, /runId:\s*sourceRun[.]id/);
  assert.match(replay, /runToken:\s*sourceRun[.]token/);
  assert.match(replay, /deferActivation:\s*true/);
});

test("the hosted replay endpoint accepts only the optional deferred-start flag", () => {
  const replay = endpointSource(server, 'url.pathname === "/api/run/replay"', 'url.pathname === "/api/run/resume"');
  assert.match(replay, /hasOnlyKeys\(body,\s*\["runId",\s*"runToken"\],\s*\["runId",\s*"runToken",\s*"deferActivation"\]\)/);
  assert.match(replay, /deferActivation:\s*body[.]deferActivation === true/);
});

test("local practice returns replay runs pending when requested", () => {
  const replay = endpointSource(local, 'path === "/api/run/replay"', 'path === "/api/run/resume"');
  assert.match(replay, /\["runId",\s*"runToken",\s*"deferActivation"\][.]includes\(key\)/);
  assert.match(replay, /const deferActivation = body[.]deferActivation === true/);
  assert.match(replay, /activatedAt:\s*deferActivation\s*[?]\s*null/);
  assert.match(replay, /game[.]timeLimit && !deferActivation/);
});
