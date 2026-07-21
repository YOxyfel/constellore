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
  const previousInterestOrigins = process.env.INTEREST_ALLOWED_ORIGINS;
  const previousAdminToken = process.env.CONSTELLORE_ADMIN_TOKEN;
  process.env.INTEREST_ALLOWED_ORIGINS = "https://yoxyfel.github.io,https://constellore.example";
  process.env.CONSTELLORE_ADMIN_TOKEN = "integration-admin-token-keep-private";
  t.after(() => {
    if (previousInterestOrigins === undefined) delete process.env.INTEREST_ALLOWED_ORIGINS;
    else process.env.INTEREST_ALLOWED_ORIGINS = previousInterestOrigins;
    if (previousAdminToken === undefined) delete process.env.CONSTELLORE_ADMIN_TOKEN;
    else process.env.CONSTELLORE_ADMIN_TOKEN = previousAdminToken;
  });
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
  assert.match(await serviceWorkerResponse.text(), /constellore-shell-v17/);
  const moduleResponse = await fetch(`${baseUrl}/frictionless.mjs`);
  assert.equal(moduleResponse.status, 200);
  assert.match(moduleResponse.headers.get("content-type") || "", /^text\/javascript/);
  const briefingModuleResponse = await fetch(`${baseUrl}/mission-briefing.mjs`);
  assert.equal(briefingModuleResponse.status, 200);
  assert.match(briefingModuleResponse.headers.get("content-type") || "", /^text\/javascript/);

  const manifestResponse = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.start_url, "/play/");
  assert.equal(manifest.scope, "/play/");

  const headResponse = await fetch(`${baseUrl}/`, { method: "HEAD" });
  assert.equal(headResponse.status, 200);
  assert.ok(Number(headResponse.headers.get("content-length")) > 0);
  assert.equal(await headResponse.text(), "");

  const request = async (path, { method = "GET", body, authenticated = true, headers = {} } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(authenticated ? auth : {}),
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json();
    return { response, payload };
  };

  const analyticsSession = "integration-private-session";
  const senseAnalytics = await request("/api/analytics", {
    method: "POST",
    authenticated: false,
    body: { name: "sense_used", sessionId: analyticsSession, properties: { mode: "quick", source: "daily", chargesBefore: 2, chargesAfter: 1, target: "Private Target" } }
  });
  assert.equal(senseAnalytics.response.status, 202);
  assert.deepEqual(senseAnalytics.payload, { accepted: true });
  const tidyAnalytics = await request("/api/analytics", {
    method: "POST",
    authenticated: false,
    body: { name: "board_tidied", sessionId: analyticsSession, properties: { mode: "quick", words: 8 } }
  });
  assert.equal(tidyAnalytics.response.status, 202);
  const sensePurchaseAnalytics = await request("/api/analytics", {
    method: "POST",
    authenticated: false,
    body: { name: "sense_purchased", sessionId: analyticsSession, properties: { cost: 90 } }
  });
  assert.equal(sensePurchaseAnalytics.response.status, 202);
  const themeAnalytics = await request("/api/analytics", {
    method: "POST",
    authenticated: false,
    body: { name: "theme_changed", sessionId: analyticsSession, properties: { theme: "aurora" } }
  });
  assert.equal(themeAnalytics.response.status, 202);
  const unauthorizedAnalyticsSummary = await request("/api/analytics/summary?days=7", { authenticated: false });
  assert.equal(unauthorizedAnalyticsSummary.response.status, 401);
  assert.equal(unauthorizedAnalyticsSummary.payload.code, "invalid_admin_token");
  const analyticsSummary = await request("/api/analytics/summary?days=7", {
    authenticated: false,
    headers: { authorization: "Bearer integration-admin-token-keep-private" }
  });
  assert.equal(analyticsSummary.response.status, 200);
  assert.equal(analyticsSummary.payload.privacy, "aggregate-only");
  assert.equal(analyticsSummary.payload.period.days, 7);
  assert.equal(analyticsSummary.payload.events.sense_used, 1);
  assert.equal(analyticsSummary.payload.events.board_tidied, 1);
  assert.equal(analyticsSummary.payload.segments.sense_used.mode.quick, 1);
  assert.equal(analyticsSummary.payload.metrics.sense_used.chargesBefore.sum, 2);
  assert.equal(analyticsSummary.payload.segments.theme_changed.theme.aurora, 1);
  assert.equal(analyticsSummary.payload.economy.senseStardustSpent, 90);
  assert.equal("senseCreditsSpent" in analyticsSummary.payload.economy, false);
  assert.equal(JSON.stringify(analyticsSummary.payload).includes(analyticsSession), false);
  assert.equal(JSON.stringify(analyticsSummary.payload).includes("Private Target"), false);

  const invalidAnalytics = await request("/api/analytics", {
    method: "POST",
    authenticated: false,
    body: { name: "player_email_collected", sessionId: analyticsSession, properties: {} }
  });
  assert.equal(invalidAnalytics.response.status, 400);
  assert.equal(invalidAnalytics.payload.code, "invalid_analytics_event");

  const allowedOrigin = "https://yoxyfel.github.io";
  const preflight = await fetch(`${baseUrl}/api/interest`, {
    method: "OPTIONS",
    headers: { Origin: allowedOrigin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" }
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(preflight.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
  assert.equal(preflight.headers.get("access-control-allow-headers"), "Content-Type");
  assert.equal(preflight.headers.get("access-control-allow-credentials"), null);

  const initialInterest = await request("/api/interest", { authenticated: false, headers: { Origin: baseUrl } });
  assert.equal(initialInterest.response.status, 200);
  assert.equal(initialInterest.response.headers.get("access-control-allow-origin"), baseUrl);
  assert.deepEqual(initialInterest.payload, {
    campaign: "web-release",
    active: 0,
    total: 0,
    additions: 0,
    removals: 0,
    reactivations: 0,
    sources: {},
    updatedAt: null
  });

  const interestBody = {
    anonymousId: "223e4567-e89b-42d3-a456-426614174000",
    campaign: "web-release",
    source: "github-pages",
    action: "add"
  };
  const wrongType = await fetch(`${baseUrl}/api/interest`, {
    method: "POST",
    headers: { Origin: allowedOrigin, "Content-Type": "text/plain" },
    body: JSON.stringify(interestBody)
  });
  assert.equal(wrongType.status, 415);

  const oversized = await fetch(`${baseUrl}/api/interest`, {
    method: "POST",
    headers: { Origin: allowedOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ ...interestBody, padding: "x".repeat(1_100) })
  });
  assert.equal(oversized.status, 413);

  const extraField = await request("/api/interest", {
    method: "POST",
    authenticated: false,
    headers: { Origin: allowedOrigin },
    body: { ...interestBody, email: "do-not-store@example.com" }
  });
  assert.equal(extraField.response.status, 400);
  assert.equal(extraField.payload.code, "invalid_interest_request");

  const deniedOrigin = await request("/api/interest", {
    method: "POST",
    authenticated: false,
    headers: { Origin: "https://attacker.example" },
    body: interestBody
  });
  assert.equal(deniedOrigin.response.status, 403);
  assert.equal(deniedOrigin.response.headers.get("access-control-allow-origin"), null);

  const addedInterest = await request("/api/interest", { method: "POST", authenticated: false, headers: { Origin: allowedOrigin }, body: interestBody });
  assert.equal(addedInterest.response.status, 201);
  assert.equal(addedInterest.response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.deepEqual(addedInterest.payload, { campaign: "web-release", interested: true, changed: true });
  assert.equal(JSON.stringify(addedInterest.payload).includes(interestBody.anonymousId), false);

  const duplicateInterest = await request("/api/interest", { method: "POST", authenticated: false, headers: { Origin: allowedOrigin }, body: interestBody });
  assert.equal(duplicateInterest.response.status, 200);
  assert.deepEqual(duplicateInterest.payload, { campaign: "web-release", interested: true, changed: false });

  const removedInterest = await request("/api/interest", {
    method: "POST",
    authenticated: false,
    headers: { Origin: allowedOrigin },
    body: { ...interestBody, action: "remove" }
  });
  assert.equal(removedInterest.response.status, 200);
  assert.deepEqual(removedInterest.payload, { campaign: "web-release", interested: false, changed: true });

  const restoredInterest = await request("/api/interest", { method: "POST", authenticated: false, headers: { Origin: allowedOrigin }, body: interestBody });
  assert.equal(restoredInterest.response.status, 201);
  const interestAggregate = await request("/api/interest", { authenticated: false, headers: { Origin: allowedOrigin } });
  assert.deepEqual(interestAggregate.payload, {
    campaign: "web-release",
    active: 1,
    total: 1,
    additions: 2,
    removals: 1,
    reactivations: 1,
    sources: { "github-pages": 1 },
    updatedAt: new Date().toISOString().slice(0, 10)
  });

  const rateLimitedId = "323e4567-e89b-42d3-a456-426614174000";
  const rateBody = { ...interestBody, anonymousId: rateLimitedId, action: "remove" };
  for (let index = 0; index < 20; index += 1) {
    const allowed = await request("/api/interest", { method: "POST", authenticated: false, headers: { Origin: allowedOrigin }, body: rateBody });
    assert.equal(allowed.response.status, 200);
    assert.equal(allowed.payload.changed, false);
  }
  const limited = await request("/api/interest", { method: "POST", authenticated: false, headers: { Origin: allowedOrigin }, body: rateBody });
  assert.equal(limited.response.status, 429);
  assert.equal(limited.payload.code, "interest_rate_limited");

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

  const unauthenticatedResume = await request("/api/run/resume", {
    method: "POST",
    authenticated: false,
    body: { runId: quickStart.payload.run.id, runToken: quickStart.payload.run.token }
  });
  assert.equal(unauthenticatedResume.response.status, 401);

  const invalidResume = await request("/api/run/resume", {
    method: "POST",
    body: { runId: quickStart.payload.run.id, runToken: `${quickStart.payload.run.token}invalid` }
  });
  assert.equal(invalidResume.response.status, 401);

  const initialResume = await request("/api/run/resume", {
    method: "POST",
    body: { runId: quickStart.payload.run.id, runToken: quickStart.payload.run.token }
  });
  assert.equal(initialResume.response.status, 200);
  assert.equal(initialResume.payload.game.target, quickStart.payload.game.target);
  assert.equal(initialResume.payload.run.id, quickStart.payload.run.id);
  assert.equal(initialResume.payload.progress.moves, 0);
  assert.equal(initialResume.payload.progress.completed, false);
  assert.equal(initialResume.payload.progress.submitted, false);
  assert.equal(initialResume.payload.progress.history.length, 0);
  assert.equal(initialResume.payload.progress.usedBend, false);
  assert.equal(initialResume.payload.progress.bendItem, null);
  assert.deepEqual(initialResume.payload.progress.discovered.map((item) => item.word), starters);
  assert.ok(initialResume.payload.progress.discovered.every((item) => item.emoji && item.category && item.source === "origin"));

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
      assert.equal(finalCombination.payload.feedbackEligible, true);
    }
    assert.equal(finalCombination.payload.completed, true);
    return { route, finalCombination };
  };

  const quickPlay = await play(quickStart);
  assert.equal(quickPlay.finalCombination.payload.division, "pure");
  const unauthenticatedRecipeFeedback = await request("/api/recipe-feedback", {
    method: "POST",
    authenticated: false,
    body: { runId: quickStart.payload.run.id, runToken: quickStart.payload.run.token, move: 1, rating: "logical" }
  });
  assert.equal(unauthenticatedRecipeFeedback.response.status, 401);
  const recipeFeedback = await request("/api/recipe-feedback", {
    method: "POST",
    body: { runId: quickStart.payload.run.id, runToken: quickStart.payload.run.token, move: 1, rating: "logical" }
  });
  assert.equal(recipeFeedback.response.status, 202);
  assert.deepEqual(recipeFeedback.payload, { accepted: true, move: 1, rating: "logical" });
  const duplicateRecipeFeedback = await request("/api/recipe-feedback", {
    method: "POST",
    body: { runId: quickStart.payload.run.id, runToken: quickStart.payload.run.token, move: 1, rating: "bad" }
  });
  assert.equal(duplicateRecipeFeedback.response.status, 409);
  assert.equal(duplicateRecipeFeedback.payload.code, "recipe_feedback_duplicate");
  const forgedRecipeFeedback = await request("/api/recipe-feedback", {
    method: "POST",
    body: { runId: quickStart.payload.run.id, runToken: quickStart.payload.run.token, move: 999, rating: "surprising" }
  });
  assert.equal(forgedRecipeFeedback.response.status, 422);
  assert.equal(forgedRecipeFeedback.payload.code, "recipe_feedback_move_unavailable");
  const invalidRecipeFeedback = await request("/api/recipe-feedback", {
    method: "POST",
    body: { runId: quickStart.payload.run.id, runToken: quickStart.payload.run.token, move: 2, rating: "love it" }
  });
  assert.equal(invalidRecipeFeedback.response.status, 400);
  assert.equal(invalidRecipeFeedback.payload.code, "invalid_recipe_feedback");
  const recipeFeedbackSummary = await request("/api/admin/recipe-feedback?minimumVotes=1&limit=10", {
    authenticated: false,
    headers: { authorization: "Bearer integration-admin-token-keep-private" }
  });
  assert.equal(recipeFeedbackSummary.response.status, 200);
  assert.equal(recipeFeedbackSummary.payload.privacy, "aggregate-only");
  assert.equal(recipeFeedbackSummary.payload.totalVotes, 1);
  assert.equal(recipeFeedbackSummary.payload.recipes.length, 1);
  assert.equal(recipeFeedbackSummary.payload.recipes[0].ratings.logical, 1);
  assert.equal(JSON.stringify(recipeFeedbackSummary.payload).includes(registration.payload.player.id), false);
  assert.equal(JSON.stringify(recipeFeedbackSummary.payload).includes(quickStart.payload.run.id), false);
  const completedResume = await request("/api/run/resume", {
    method: "POST",
    body: { runId: quickStart.payload.run.id, runToken: quickStart.payload.run.token }
  });
  assert.equal(completedResume.response.status, 200);
  assert.equal(completedResume.payload.progress.completed, true);
  assert.equal(completedResume.payload.progress.submitted, false);
  assert.equal(completedResume.payload.progress.moves, quickPlay.route.length);
  assert.deepEqual(
    completedResume.payload.progress.history.map(({ a, b, word }) => ({ a, b, word })),
    quickPlay.route
  );
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
  const retriedPureSubmit = await request("/api/run/submit", {
    method: "POST",
    body: { runId: quickStart.payload.run.id, runToken: quickStart.payload.run.token }
  });
  assert.equal(retriedPureSubmit.response.status, 200, "a lost success response must be safely retryable");
  assert.equal(retriedPureSubmit.payload.ranked, true);
  assert.equal(retriedPureSubmit.payload.recovered, true);
  assert.equal(retriedPureSubmit.payload.creditReward, 0);
  assert.equal(retriedPureSubmit.payload.alreadyRewarded, true);
  const submittedResume = await request("/api/run/resume", {
    method: "POST",
    body: { runId: quickStart.payload.run.id, runToken: quickStart.payload.run.token }
  });
  assert.equal(submittedResume.response.status, 200);
  assert.equal(submittedResume.payload.progress.submitted, true);

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

  const bendResume = await request("/api/run/resume", {
    method: "POST",
    body: { runId: movesStart.payload.run.id, runToken: movesStart.payload.run.token }
  });
  assert.equal(bendResume.response.status, 200);
  assert.equal(bendResume.payload.progress.usedBend, true);
  assert.equal(bendResume.payload.progress.bendItem.word, "Moon");
  assert.ok(bendResume.payload.progress.discovered.some((item) => item.word === "Moon"));

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

  const assistedRegistration = await request("/api/player/register", { method: "POST", authenticated: false });
  assert.equal(assistedRegistration.response.status, 201);
  auth = {
    "x-constellore-player": assistedRegistration.payload.player.id,
    "x-constellore-token": assistedRegistration.payload.playerToken
  };
  const assistedStart = await request("/api/run/start", { method: "POST", body: { mode: "quick" } });
  assert.equal(assistedStart.response.status, 201);
  assert.equal(assistedStart.payload.run.ranked, true);
  assert.equal(assistedStart.payload.run.scoringDisabled, false);
  const parallelAssistedStart = await request("/api/run/start", { method: "POST", body: { mode: "quick" } });
  assert.equal(parallelAssistedStart.response.status, 201);
  assert.equal(parallelAssistedStart.payload.run.ranked, true);
  assert.equal(parallelAssistedStart.payload.run.challengeId, assistedStart.payload.run.challengeId);
  const preForfeitPreview = await request("/api/run/preview", { method: "POST", body: { mode: "quick" } });
  assert.equal(preForfeitPreview.response.status, 200);
  assert.equal(preForfeitPreview.payload.game.scoreEligible, true);
  assert.equal(typeof preForfeitPreview.payload.previewToken, "string");

  const reveal = await request("/api/run/reveal", {
    method: "POST",
    body: { runId: assistedStart.payload.run.id, runToken: assistedStart.payload.run.token }
  });
  assert.equal(reveal.response.status, 200);
  assert.equal(reveal.payload.assisted, true);
  assert.equal(reveal.payload.scoringDisabled, true);
  assert.equal(reveal.payload.score, 0);
  assert.equal(reveal.payload.leaderboardEligible, false);
  const available = new Set(starters.map((word) => word.toLowerCase()));
  for (const step of reveal.payload.route) {
    assert.ok(available.has(step.a.toLowerCase()));
    assert.ok(available.has(step.b.toLowerCase()));
    available.add(step.word.toLowerCase());
  }
  assert.equal(reveal.payload.route.at(-1).word, assistedStart.payload.game.target);

  const repeatedReveal = await request("/api/run/reveal", {
    method: "POST",
    body: { runId: assistedStart.payload.run.id, runToken: assistedStart.payload.run.token }
  });
  assert.equal(repeatedReveal.response.status, 200);
  assert.deepEqual(repeatedReveal.payload.route, reveal.payload.route);

  const assistedSubmit = await request("/api/run/submit", {
    method: "POST",
    body: { runId: assistedStart.payload.run.id, runToken: assistedStart.payload.run.token }
  });
  assert.equal(assistedSubmit.response.status, 200);
  assert.equal(assistedSubmit.payload.ranked, false);
  assert.equal(assistedSubmit.payload.assisted, true);
  assert.equal(assistedSubmit.payload.score, 0);
  assert.equal(assistedSubmit.payload.creditReward, 0);
  assert.equal(assistedSubmit.payload.weeklyBonus, 0);
  assert.equal(assistedSubmit.payload.player.credits, 300);

  await play(parallelAssistedStart);
  const parallelAssistedSubmit = await request("/api/run/submit", {
    method: "POST",
    body: { runId: parallelAssistedStart.payload.run.id, runToken: parallelAssistedStart.payload.run.token }
  });
  assert.equal(parallelAssistedSubmit.response.status, 200);
  assert.equal(parallelAssistedSubmit.payload.ranked, false);
  assert.equal(parallelAssistedSubmit.payload.assisted, true);
  assert.equal(parallelAssistedSubmit.payload.score, 0, "a run started before Reveal Path must also forfeit the shared challenge");

  const pureAfterReveal = await request("/api/leaderboard?scope=all&division=pure");
  const openAfterReveal = await request("/api/leaderboard?scope=all&division=open");
  assert.equal(pureAfterReveal.payload.entries.length, 1);
  assert.equal(openAfterReveal.payload.entries.length, 1);
  assert.equal(pureAfterReveal.payload.entries.some((entry) => entry.callsign === assistedRegistration.payload.player.callsign), false);
  assert.equal(openAfterReveal.payload.entries.some((entry) => entry.callsign === assistedRegistration.payload.player.callsign), false);

  const stalePreviewStart = await request("/api/run/start", {
    method: "POST",
    body: { previewToken: preForfeitPreview.payload.previewToken }
  });
  assert.equal(stalePreviewStart.response.status, 409);
  assert.equal(stalePreviewStart.payload.code, "mission_stale", "a run may not start under scoring terms that changed after its briefing");

  const assistedPreview = await request("/api/run/preview", { method: "POST", body: { mode: "quick" } });
  assert.equal(assistedPreview.response.status, 200);
  assert.equal(assistedPreview.payload.game.ranked, false);
  assert.equal(assistedPreview.payload.game.scoreEligible, false, "the briefing must disclose an earlier forfeit before replay starts");
  assert.equal(assistedPreview.payload.game.rewardEligible, false);

  const assistedReplay = await request("/api/run/start", {
    method: "POST",
    body: { previewToken: assistedPreview.payload.previewToken }
  });
  assert.equal(assistedReplay.response.status, 201);
  assert.equal(assistedReplay.payload.run.ranked, false);
  assert.equal(assistedReplay.payload.run.scoringDisabled, true);
  assert.equal(assistedReplay.payload.run.assist, "reveal");

  const disguisedMovesStart = await request("/api/run/start", { method: "POST", body: { mode: "moves", custom: true } });
  assert.equal(disguisedMovesStart.response.status, 201);
  assert.equal(disguisedMovesStart.payload.run.ranked, true, "client-controlled custom flags cannot downgrade official challenges before revealing them");
  const disguisedMovesReveal = await request("/api/run/reveal", {
    method: "POST",
    body: { runId: disguisedMovesStart.payload.run.id, runToken: disguisedMovesStart.payload.run.token }
  });
  assert.equal(disguisedMovesReveal.response.status, 200);
  const movesReplayAfterReveal = await request("/api/run/start", { method: "POST", body: { mode: "moves" } });
  assert.equal(movesReplayAfterReveal.response.status, 201);
  assert.equal(movesReplayAfterReveal.payload.run.ranked, false);
  assert.equal(movesReplayAfterReveal.payload.run.scoringDisabled, true);

  const twistStart = await request("/api/run/start", { method: "POST", body: { mode: "reach", seed: 14, target: "Telescope" } });
  assert.equal(twistStart.response.status, 201);
  assert.equal(twistStart.payload.run.ranked, false);
  const twistCombine = (a, b) => request("/api/combine", {
    method: "POST",
    body: { a, b, runId: twistStart.payload.run.id, runToken: twistStart.payload.run.token }
  });
  assert.equal((await twistCombine("Earth", "Water")).payload.word, "Mud");
  assert.equal((await twistCombine("Mud", "Fire")).payload.word, "Brick");
  const parallelBrickMixes = await Promise.all([twistCombine("Brick", "Brick"), twistCombine("Brick", "Brick")]);
  assert.ok(parallelBrickMixes.every(({ response }) => response.status === 200));
  const twistedMixes = parallelBrickMixes.filter(({ payload }) => payload.twisted);
  assert.equal(twistedMixes.length, 1, "concurrent requests must never create two Twists in one orbit");
  assert.equal(twistedMixes[0].payload.word, "Great Wall");
  assert.equal(twistedMixes[0].payload.source, "twist");
  assert.equal(twistedMixes[0].payload.twist.canonicalWord, "Wall");
  assert.equal(parallelBrickMixes.find(({ payload }) => !payload.twisted).payload.word, "Wall");
  const canonicalRetry = await twistCombine("Brick", "Brick");
  assert.equal(canonicalRetry.payload.word, "Wall");
  assert.equal(canonicalRetry.payload.twisted, undefined);
  const twistContinuation = await twistCombine("Great Wall", "Earth");
  assert.equal(twistContinuation.response.status, 200);
  assert.ok(twistContinuation.payload.word, "the alternate discovery must remain a usable concept");

  const feedbackIntegrityRun = await request("/api/run/start", { method: "POST", body: { mode: "reach", seed: 999, target: "Telescope" } });
  assert.equal(feedbackIntegrityRun.response.status, 201);
  const feedbackMix = (a, b) => request("/api/combine", {
    method: "POST",
    body: { a, b, runId: feedbackIntegrityRun.payload.run.id, runToken: feedbackIntegrityRun.payload.run.token }
  });
  assert.equal((await feedbackMix("Earth", "Water")).payload.word, "Mud");
  assert.equal((await feedbackMix("Earth", "Water")).payload.word, "Mud");
  const firstRecipeVote = await request("/api/recipe-feedback", {
    method: "POST",
    body: { runId: feedbackIntegrityRun.payload.run.id, runToken: feedbackIntegrityRun.payload.run.token, move: 1, rating: "logical" }
  });
  assert.equal(firstRecipeVote.response.status, 202);
  const repeatedRecipeVote = await request("/api/recipe-feedback", {
    method: "POST",
    body: { runId: feedbackIntegrityRun.payload.run.id, runToken: feedbackIntegrityRun.payload.run.token, move: 2, rating: "bad" }
  });
  assert.equal(repeatedRecipeVote.response.status, 409);
  assert.equal(repeatedRecipeVote.payload.code, "recipe_feedback_recipe_duplicate");

  const privateWish = await request("/api/wish", {
    method: "POST",
    body: { word: "Yane Zhekov", runId: feedbackIntegrityRun.payload.run.id, runToken: feedbackIntegrityRun.payload.run.token }
  });
  assert.equal(privateWish.response.status, 200);
  const privateMix = await feedbackMix("Yane Zhekov", "Earth");
  assert.equal(privateMix.response.status, 200);
  assert.equal(privateMix.payload.feedbackEligible, false);
  const privateRecipeVote = await request("/api/recipe-feedback", {
    method: "POST",
    body: { runId: feedbackIntegrityRun.payload.run.id, runToken: feedbackIntegrityRun.payload.run.token, move: 3, rating: "surprising" }
  });
  assert.equal(privateRecipeVote.response.status, 422);
  assert.equal(privateRecipeVote.payload.code, "recipe_feedback_private_recipe");
  const privateSummary = await request("/api/admin/recipe-feedback?minimumVotes=1&limit=200", {
    authenticated: false,
    headers: { authorization: "Bearer integration-admin-token-keep-private" }
  });
  assert.equal(JSON.stringify(privateSummary.payload).includes("Yane Zhekov"), false);
});
