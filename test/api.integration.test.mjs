import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { curatedCombination, server } from "../server.mjs";

const starters = ["Earth", "Water", "Fire", "Air"];

function verifiedRoute(target) {
  const known = new Map(starters.map((word) => [word.toLowerCase(), word]));
  const parents = new Map();

  while (!known.has(target.toLowerCase())) {
    const available = [...known.values()];
    let changed = false;
    for (let left = 0; left < available.length; left += 1) {
      for (let right = left; right < available.length; right += 1) {
        const result = curatedCombination(available[left], available[right]);
        const resultKey = result?.word?.toLowerCase();
        if (!resultKey || known.has(resultKey)) continue;
        known.set(resultKey, result.word);
        parents.set(resultKey, { a: available[left], b: available[right], word: result.word });
        changed = true;
      }
    }
    assert.ok(changed, `No curated route reaches ${target}`);
  }

  const route = [];
  const emitted = new Set();
  const visit = (word) => {
    const key = word.toLowerCase();
    if (starters.some((starter) => starter.toLowerCase() === key) || emitted.has(key)) return;
    const step = parents.get(key);
    assert.ok(step, `Missing route dependency for ${word}`);
    visit(step.a);
    visit(step.b);
    route.push(step);
    emitted.add(key);
  };
  visit(target);
  return route;
}

test("authenticated HTTP runs produce verified Pure and Open leaderboard scores", async (t) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    if (server.listening) {
      server.close();
      await once(server, "close");
    }
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let auth = {};

  const landingResponse = await fetch(`${baseUrl}/`);
  assert.equal(landingResponse.status, 200);
  assert.match(landingResponse.headers.get("content-type"), /^text\/html/);
  assert.match(landingResponse.headers.get("content-security-policy"), /frame-src 'self'/);
  assert.match(await landingResponse.text(), /Build a universe[.]\s*Find the word[.]/);

  const legacyPlayResponse = await fetch(`${baseUrl}/play`, { redirect: "manual" });
  assert.equal(legacyPlayResponse.status, 308);
  assert.equal(legacyPlayResponse.headers.get("location"), "/play/");

  const playResponse = await fetch(`${baseUrl}/play/`);
  assert.equal(playResponse.status, 200);
  assert.match(await playResponse.text(), /id="startScreen"/);

  const siteScriptResponse = await fetch(`${baseUrl}/website.js`);
  assert.equal(siteScriptResponse.status, 200);
  assert.match(siteScriptResponse.headers.get("content-type"), /^text\/javascript/);

  const serviceWorkerResponse = await fetch(`${baseUrl}/play/service-worker.js`);
  assert.equal(serviceWorkerResponse.status, 200);
  assert.match(await serviceWorkerResponse.text(), /constellore-shell-v2/);

  const manifestResponse = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.start_url, "/play/");
  assert.equal(manifest.scope, "/play/");

  const headResponse = await fetch(`${baseUrl}/`, { method: "HEAD" });
  assert.equal(headResponse.status, 200);
  assert.ok(Number(headResponse.headers.get("content-length")) > 0);
  assert.equal(await headResponse.text(), "");

  const request = async (path, { method = "GET", body, authenticated = true } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(authenticated ? auth : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json();
    return { response, payload };
  };

  const registration = await request("/api/player/register", { method: "POST", authenticated: false });
  assert.equal(registration.response.status, 201);
  assert.match(registration.payload.player.callsign, /^[A-Za-z]+ [A-Za-z]+ [A-Z0-9]{8}$/);
  assert.equal(registration.payload.player.credits, 300);
  auth = {
    "x-constellore-player": registration.payload.player.id,
    "x-constellore-token": registration.payload.playerToken
  };

  const playerCheck = await request("/api/player");
  assert.equal(playerCheck.response.status, 200);
  assert.equal(playerCheck.payload.player.id, registration.payload.player.id);

  const quickStart = await request("/api/run/start", { method: "POST", body: { mode: "quick" } });
  assert.equal(quickStart.response.status, 201);
  assert.equal(quickStart.payload.run.ranked, true);
  assert.ok(quickStart.payload.run.deadlineAt);

  const impossible = await request("/api/combine", {
    method: "POST",
    body: {
      a: "Earth",
      b: "Moon",
      runId: quickStart.payload.run.id,
      runToken: quickStart.payload.run.token
    }
  });
  assert.equal(impossible.response.status, 422);
  assert.equal(impossible.payload.code, "impossible_combination");

  const play = async (started) => {
    const route = verifiedRoute(started.payload.game.target);
    let finalCombination = null;
    for (const step of route) {
      finalCombination = await request("/api/combine", {
        method: "POST",
        body: {
          a: step.a,
          b: step.b,
          runId: started.payload.run.id,
          runToken: started.payload.run.token
        }
      });
      assert.equal(finalCombination.response.status, 200);
      assert.equal(finalCombination.payload.word, step.word);
    }
    assert.equal(finalCombination.payload.completed, true);
    return { route, finalCombination };
  };

  const quickPlay = await play(quickStart);
  assert.equal(quickPlay.finalCombination.payload.division, "pure");
  const pureSubmit = await request("/api/run/submit", {
    method: "POST",
    body: { runId: quickStart.payload.run.id, runToken: quickStart.payload.run.token }
  });
  assert.equal(pureSubmit.response.status, 201);
  assert.equal(pureSubmit.payload.ranked, true);
  assert.equal(pureSubmit.payload.placement.rank, 1);
  assert.equal(pureSubmit.payload.placement.entry.division, "pure");
  assert.equal(pureSubmit.payload.placement.entry.moves, quickPlay.route.length);
  assert.equal(pureSubmit.payload.creditReward, 4);

  const pureBoard = await request("/api/leaderboard?scope=all&division=pure");
  assert.equal(pureBoard.response.status, 200);
  assert.equal(pureBoard.payload.entries.length, 1);
  assert.equal(pureBoard.payload.entries[0].callsign, registration.payload.player.callsign);
  assert.equal(pureBoard.payload.entries[0].target, quickStart.payload.game.target);
  assert.equal(pureBoard.payload.playerEntry.rank, 1);

  const market = await request("/api/market?q=moon");
  assert.equal(market.response.status, 200);
  assert.equal(market.payload.items.length, 1);
  const moonQuote = market.payload.items[0];
  assert.equal(moonQuote.word, "Moon");
  assert.equal(moonQuote.owned, false);
  const purchaseKey = "integration-moon-purchase";
  const purchase = await request("/api/market/buy", {
    method: "POST",
    body: { quoteId: moonQuote.quoteId, idempotencyKey: purchaseKey }
  });
  assert.equal(purchase.response.status, 200);
  assert.equal(purchase.payload.price, moonQuote.price);
  assert.equal(purchase.payload.balance, market.payload.balance - moonQuote.price);
  assert.equal(purchase.payload.player.vault[0].word, "Moon");

  const repeatedPurchase = await request("/api/market/buy", {
    method: "POST",
    body: { quoteId: moonQuote.quoteId, idempotencyKey: purchaseKey }
  });
  assert.equal(repeatedPurchase.response.status, 200);
  assert.equal(repeatedPurchase.payload.price, purchase.payload.price);
  assert.equal(repeatedPurchase.payload.balance, purchase.payload.balance);
  assert.equal(repeatedPurchase.payload.player.credits, purchase.payload.player.credits);

  const movesStart = await request("/api/run/start", { method: "POST", body: { mode: "moves" } });
  assert.equal(movesStart.response.status, 201);
  assert.equal(movesStart.payload.run.ranked, true);
  const activation = await request("/api/market/activate", {
    method: "POST",
    body: { runId: movesStart.payload.run.id, runToken: movesStart.payload.run.token, wordId: "moon" }
  });
  assert.equal(activation.response.status, 200);
  assert.equal(activation.payload.item.word, "Moon");
  assert.equal(activation.payload.assist, "market");

  const movesPlay = await play(movesStart);
  assert.equal(movesPlay.finalCombination.payload.division, "open");
  const openSubmit = await request("/api/run/submit", {
    method: "POST",
    body: { runId: movesStart.payload.run.id, runToken: movesStart.payload.run.token }
  });
  assert.equal(openSubmit.response.status, 201);
  assert.equal(openSubmit.payload.placement.entry.division, "open");
  assert.equal(openSubmit.payload.placement.entry.assist, "market");
  assert.equal(openSubmit.payload.placement.entry.moves, movesPlay.route.length);

  const openBoard = await request("/api/leaderboard?scope=all&division=open");
  assert.equal(openBoard.response.status, 200);
  assert.equal(openBoard.payload.entries.length, 1);
  assert.equal(openBoard.payload.entries[0].assist, "market");
  assert.equal(openBoard.payload.entries[0].target, movesStart.payload.game.target);
  assert.equal(openBoard.payload.playerEntry.rank, 1);
});
