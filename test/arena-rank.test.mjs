import assert from "node:assert/strict";
import test from "node:test";

import {
  SCRAMBLE_ARENA_LEAGUES,
  scrambleArenaLeaguePresentation
} from "../public/arena-rank.mjs";

test("shared Arena leagues are stable, immutable, and start in Bronze", () => {
  assert.deepEqual(
    SCRAMBLE_ARENA_LEAGUES.map(({ id, minimumXp }) => ({ id, minimumXp })),
    [
      { id: "bronze", minimumXp: 0 },
      { id: "silver", minimumXp: 500 },
      { id: "gold", minimumXp: 1_500 }
    ]
  );
  assert.equal(Object.isFrozen(SCRAMBLE_ARENA_LEAGUES), true);
  assert.equal(scrambleArenaLeaguePresentation().id, "bronze");
  assert.equal(scrambleArenaLeaguePresentation({ xp: 0 }).label, "Bronze Arena Rank");
});

test("Arena leagues follow shared seasonal XP while exposing next-league progress", () => {
  assert.equal(scrambleArenaLeaguePresentation(499).id, "bronze");
  const silver = scrambleArenaLeaguePresentation({ progression: { xp: 500 } });
  assert.equal(silver.id, "silver");
  assert.equal(silver.xpRemaining, 1_000);
  assert.equal(scrambleArenaLeaguePresentation({ arena: { progression: { xp: 1_499 } } }).id, "silver");
  const gold = scrambleArenaLeaguePresentation({ scrambleArena: { progression: { xp: 1_500 } } });
  assert.equal(gold.id, "gold");
  assert.equal(gold.xp, 1_500);
  assert.equal(gold.progress, 100);
});

test("malformed Arena progression fails safely to the starting league", () => {
  for (const value of [null, undefined, "nope", {}, [], Infinity, -Infinity]) {
    const rank = scrambleArenaLeaguePresentation(value);
    assert.equal(rank.id, "bronze");
    assert.equal(rank.xp, 0);
  }
});

test("Arena league presentation never invokes hostile accessors or proxy traps", () => {
  let getterCalled = false;
  const accessor = {};
  Object.defineProperty(accessor, "progression", {
    enumerable: true,
    get() {
      getterCalled = true;
      throw new Error("must not run");
    }
  });
  const revoked = Proxy.revocable({ xp: 2_000 }, {});
  revoked.revoke();

  assert.equal(scrambleArenaLeaguePresentation(accessor).id, "bronze");
  assert.equal(getterCalled, false);
  assert.equal(scrambleArenaLeaguePresentation(revoked.proxy).id, "bronze");
});
