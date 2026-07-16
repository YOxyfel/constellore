import test from "node:test";
import assert from "node:assert/strict";
import { GameStore, MARKET_CATALOG, RunRegistry, calculateStarscore, callsignFor, marketPrice } from "../game-services.mjs";

test("generated public callsigns have a scalable anonymous discriminator", () => {
  const callsigns = Array.from({ length: 2_000 }, (_, index) => callsignFor(`player-${index.toString(16).padStart(12, "0")}`));
  assert.equal(new Set(callsigns).size, callsigns.length);
  assert.ok(callsigns.every((callsign) => /^[A-Za-z]+ [A-Za-z]+ [A-Z0-9]{8}$/.test(callsign)));
});

test("minute market prices are deterministic, bounded, and usefulness-weighted", () => {
  const minute = 30_000_000;
  const moon = MARKET_CATALOG.find((item) => item.id === "moon");
  const ocean = MARKET_CATALOG.find((item) => item.id === "ocean");
  assert.equal(marketPrice(moon, minute), marketPrice(moon, minute));
  assert.ok(marketPrice(moon, minute) >= moon.basePrice * .8);
  assert.ok(marketPrice(moon, minute) <= moon.basePrice * 1.2);
  assert.ok(marketPrice(moon, minute) > marketPrice(ocean, minute), "more useful words should generally have a higher base cost");
});

test("the expanded Exchange is unique, categorized, strictly bounded, and smooth", () => {
  assert.equal(MARKET_CATALOG.length, 36);
  assert.equal(new Set(MARKET_CATALOG.map((item) => item.id)).size, MARKET_CATALOG.length);
  assert.equal(new Set(MARKET_CATALOG.map((item) => item.word.toLowerCase())).size, MARKET_CATALOG.length);
  const categories = new Set(["force", "nature", "life", "structure"]);

  for (const item of MARKET_CATALOG) {
    assert.ok(categories.has(item.category), `${item.word} should use an allowed semantic category`);
    let previous = marketPrice(item, 30_000_000, .5);
    for (let minute = 30_000_001; minute < 30_000_241; minute += 1) {
      const current = marketPrice(item, minute, .5);
      assert.ok(current >= item.basePrice * .8, `${item.word} should stay above its price floor`);
      assert.ok(current <= item.basePrice * 1.2, `${item.word} should stay below its price ceiling`);
      assert.ok(Math.abs(current - previous) <= 5, `${item.word} should move by at most one five-credit tick per minute`);
      previous = current;
    }
  }
});

test("wallet quotes purchase permanent licenses atomically and idempotently", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const token = store.tokenForPlayer(player.id);
  assert.ok(store.authenticate(player.id, token));
  const quote = store.marketSnapshot(player.id).items.find((item) => item.id === "moon");
  const purchase = await store.buyLicense(player.id, quote.quoteId, "purchase-123456");
  const repeated = await store.buyLicense(player.id, quote.quoteId, "purchase-123456");
  assert.equal(purchase.item.word, "Moon");
  assert.deepEqual(repeated, purchase);
  assert.equal(store.ownsLicense(player.id, "moon"), true);
  assert.equal(store.publicPlayer(player.id).vault.length, 1);
});

test("demand affects the next minute without invalidating current signed quotes", async (t) => {
  const fixedNow = 1_800_000_030_000;
  t.mock.method(Date, "now", () => fixedNow);
  const store = await new GameStore(":memory:").init();
  const firstPlayer = await store.registerPlayer();
  const secondPlayer = await store.registerPlayer();
  const firstQuote = store.marketSnapshot(firstPlayer.id).items.find((item) => item.id === "ocean");
  const secondQuote = store.marketSnapshot(secondPlayer.id).items.find((item) => item.id === "ocean");

  await store.buyLicense(firstPlayer.id, firstQuote.quoteId, "first-ocean-purchase");
  const sameMinute = store.marketSnapshot(secondPlayer.id).items.find((item) => item.id === "ocean");
  assert.equal(sameMinute.price, secondQuote.price);
  await assert.doesNotReject(store.buyLicense(secondPlayer.id, secondQuote.quoteId, "second-ocean-purchase"));

  const nextMinute = store.marketSnapshot(secondPlayer.id, fixedNow + 60_000).items.find((item) => item.id === "ocean");
  assert.notEqual(nextMinute.quoteId, secondQuote.quoteId);
  assert.ok(store.data.demand.ocean.ema > 0, "completed-minute purchases should lift subsequent demand");
});

test("an idempotency key cannot be reused for a different quote", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const snapshot = store.marketSnapshot(player.id);
  const moon = snapshot.items.find((item) => item.id === "moon");
  const ocean = snapshot.items.find((item) => item.id === "ocean");
  await store.buyLicense(player.id, moon.quoteId, "one-purchase-key");
  await assert.rejects(
    store.buyLicense(player.id, ocean.quoteId, "one-purchase-key"),
    (error) => error.statusCode === 409 && error.serviceCode === "idempotency_conflict"
  );
  assert.equal(store.ownsLicense(player.id, "ocean"), false);
});

test("expired market quotes are rejected without changing the wallet", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const startingBalance = player.credits;
  const expiredSnapshot = store.marketSnapshot(player.id, Date.now() - 60_000);
  const quote = expiredSnapshot.items.find((item) => item.id === "moon");

  await assert.rejects(
    store.buyLicense(player.id, quote.quoteId, "expired-quote-123"),
    (error) => error.statusCode === 409 && error.serviceCode === "quote_expired"
  );
  assert.equal(store.publicPlayer(player.id).credits, startingBalance);
  assert.equal(store.ownsLicense(player.id, "moon"), false);
});

test("personal Wishes are free once and then renew daily for Founders", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const firstDay = new Date("2026-07-16T12:00:00.000Z");
  const nextDay = new Date("2026-07-17T00:01:00.000Z");

  assert.equal(store.canUseWish(player.id, firstDay), true);
  await store.consumeWish(player.id, firstDay);
  assert.equal(store.canUseWish(player.id, firstDay), false);

  await store.setFounderPass(player.id, true);
  assert.equal(store.canUseWish(player.id, firstDay), false, "buying the pass should not create a second Wish on the same day");
  assert.equal(store.canUseWish(player.id, nextDay), true);
  await store.consumeWish(player.id, nextDay);
  assert.equal(store.canUseWish(player.id, nextDay), false);
});

test("ranked credit rewards cannot be replay-farmed and grant a four-day weekly bonus", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const days = [16, 17, 18, 19].map((day) => new Date(`2026-07-${day}T12:00:00.000Z`));

  const first = await store.grantChallengeCredits(player.id, "daily:2026-07-16", 10, days[0]);
  const repeated = await store.grantChallengeCredits(player.id, "daily:2026-07-16", 10, days[0]);
  assert.deepEqual(first, { creditReward: 10, weeklyBonus: 0, alreadyRewarded: false });
  assert.deepEqual(repeated, { creditReward: 0, weeklyBonus: 0, alreadyRewarded: true });

  await store.grantChallengeCredits(player.id, "daily:2026-07-17", 10, days[1]);
  await store.grantChallengeCredits(player.id, "daily:2026-07-18", 10, days[2]);
  const fourthDay = await store.grantChallengeCredits(player.id, "daily:2026-07-19", 10, days[3]);
  assert.equal(fourthDay.weeklyBonus, 40);
  assert.equal(store.publicPlayer(player.id).credits, 380);
});

test("server runs reject impossible inputs and only complete through combinations", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const runs = new RunRegistry(store);
  const game = { mode: "daily", target: "Mud", tier: 1, starters: ["Earth", "Water", "Fire", "Air"] };
  const started = runs.start(player.id, game, { ranked: true, challengeId: "daily:test" });
  const run = runs.get(started.run.runId, player.id, started.token);
  assert.throws(() => runs.canCombine(run, "Earth", "Moon"), /undiscovered/i);
  runs.addBend(run, { word: "Moon", emoji: "🌙", category: "nature" }, "market");
  assert.equal(run.completedAt, null, "activating the exact target or another word never completes a run");
  runs.canCombine(run, "Earth", "Water");
  runs.recordCombination(run, { word: "Mud", emoji: "🟤", source: "world" });
  assert.ok(run.completedAt);
  const entry = runs.finalize(run, player.callsign);
  assert.equal(entry.division, "open");
  assert.equal(entry.moves, 1);
});

test("leaderboards keep each player's best verified result", async () => {
  const store = await new GameStore(":memory:").init();
  const player = await store.registerPlayer();
  const common = { playerId: player.id, callsign: player.callsign, challengeId: "quick:test", division: "pure", assist: "none", mode: "quick", target: "Forest", dailyKey: new Date().toISOString().slice(0, 10), weeklyKey: "test", createdAt: new Date().toISOString() };
  await store.addScore({ ...common, id: "one", runId: "run-one", score: 80_000, moves: 7, elapsedMs: 40_000 });
  await store.addScore({ ...common, id: "two", runId: "run-two", score: 90_000, moves: 6, elapsedMs: 35_000 });
  await store.addScore({ ...common, id: "three", runId: "run-three", score: 85_000, moves: 5, elapsedMs: 30_000 });
  const board = store.leaderboard("all", "pure", 10, player.id);
  assert.equal(board.entries.length, 1);
  assert.equal(board.entries[0].score, 90_000);
  assert.equal(board.playerEntry.rank, 1);
});

test("assisted Starscores are lower than otherwise identical pure scores", () => {
  const game = { tier: 3 };
  const pure = calculateStarscore({ game, moves: 8, elapsedSeconds: 40, assisted: false });
  const open = calculateStarscore({ game, moves: 8, elapsedSeconds: 40, assisted: true });
  assert.ok(pure > open);
});
