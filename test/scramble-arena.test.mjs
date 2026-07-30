import assert from "node:assert/strict";
import test from "node:test";

import {
  SCRAMBLE_ARENA_SEASON_ID,
  SCRAMBLE_ARENA_VERSION,
  SCRAMBLE_DEFAULT_MODE_ID,
  SCRAMBLE_MODE_IDS,
  SCRAMBLE_MODES,
  applyScrambleModeRating,
  getScrambleModeDefinition,
  listScrambleModeDefinitions,
  normalizeScrambleModeId,
  publicScrambleArenaSnapshot,
  sanitizeScrambleArena,
  sanitizeScrambleModeRating,
  scrambleRatingForMode
} from "../public/scramble-arena.mjs";

test("Scramble Arena exposes five deeply immutable canonical mode definitions", () => {
  assert.deepEqual(SCRAMBLE_MODE_IDS, [
    "target-race",
    "wordstorm",
    "forge-clash",
    "riddle-saga",
    "claim-war"
  ]);
  assert.ok(Object.isFrozen(SCRAMBLE_MODES));
  for (const mode of SCRAMBLE_MODES) {
    assert.ok(Object.isFrozen(mode));
    assert.ok(Object.isFrozen(mode.config));
    assert.equal(mode.rulesVersion, 1);
    assert.equal(mode.supportsRanked, true);
    assert.ok(mode.label);
    assert.ok(mode.description);
    assert.ok(mode.objective);
  }

  assert.deepEqual(getScrambleModeDefinition("target-race").config, {
    durationSeconds: 300
  });
  assert.deepEqual(getScrambleModeDefinition("wordstorm").config, {
    durationSeconds: 120,
    discoveryQuota: 12
  });
  assert.deepEqual(getScrambleModeDefinition("forge-clash").config, {
    durationSeconds: 150,
    turnLimit: 6
  });
  assert.deepEqual(getScrambleModeDefinition("riddle-saga").config, {
    durationSeconds: 300,
    chapterCount: 5,
    chapterPoints: [1, 1, 1, 1, 2],
    chapterDurationSeconds: 45,
    finaleDurationSeconds: 60,
    intermissionSeconds: 3
  });
  assert.ok(Object.isFrozen(getScrambleModeDefinition("riddle-saga").config.chapterPoints));
  assert.throws(() => {
    getScrambleModeDefinition("riddle-saga").config.chapterPoints[4] = 99;
  }, TypeError);
  assert.deepEqual(getScrambleModeDefinition("claim-war").config, {
    durationSeconds: 120,
    claimQuota: 10
  });
  assert.equal(getScrambleModeDefinition("claim-war").enabled, false);
  assert.equal(getScrambleModeDefinition("claim-war").preview, true);
  assert.deepEqual(
    listScrambleModeDefinitions({ enabledOnly: true }).map((mode) => mode.id),
    ["target-race", "wordstorm", "forge-clash", "riddle-saga"]
  );
  assert.deepEqual(
    listScrambleModeDefinitions({ includePreview: false }).map((mode) => mode.id),
    ["target-race", "wordstorm", "forge-clash", "riddle-saga"]
  );
});

test("mode normalization preserves legacy Target Race and rejects unknown explicit modes", () => {
  assert.equal(normalizeScrambleModeId(), SCRAMBLE_DEFAULT_MODE_ID);
  assert.equal(normalizeScrambleModeId("  "), SCRAMBLE_DEFAULT_MODE_ID);
  assert.equal(normalizeScrambleModeId("TARGET_RACE"), "target-race");
  assert.equal(normalizeScrambleModeId("word storm"), "wordstorm");
  assert.equal(normalizeScrambleModeId("Forge"), "forge-clash");
  assert.equal(normalizeScrambleModeId("story rush"), "riddle-saga");
  assert.equal(normalizeScrambleModeId("claims"), "claim-war");
  assert.equal(normalizeScrambleModeId("not-a-mode"), "");
  assert.equal(normalizeScrambleModeId(Symbol("hostile")), "");
  assert.equal(getScrambleModeDefinition("not-a-mode"), null);
});

test("legacy Duel rating migrates into Target Race only", () => {
  const arena = sanitizeScrambleArena(null, {
    legacyDuelRating: {
      seasonId: "v5-s1",
      rating: 1_375,
      games: 7,
      wins: 4,
      losses: 2,
      draws: 1,
      streak: 2,
      updatedAt: "2026-07-29T12:00:00.000Z"
    }
  });

  assert.equal(arena.version, SCRAMBLE_ARENA_VERSION);
  assert.equal(arena.seasonId, SCRAMBLE_ARENA_SEASON_ID);
  assert.deepEqual(arena.progression, {
    seasonId: SCRAMBLE_ARENA_SEASON_ID,
    xp: 0,
    level: 1,
    updatedAt: null
  });
  assert.deepEqual(arena.ratings["target-race"], {
    seasonId: "v5-s1",
    rating: 1_375,
    games: 7,
    wins: 4,
    losses: 2,
    draws: 1,
    streak: 2,
    provisional: false,
    placement: "established",
    updatedAt: "2026-07-29T12:00:00.000Z"
  });
  for (const modeId of ["wordstorm", "forge-clash", "riddle-saga", "claim-war"]) {
    assert.equal(arena.ratings[modeId].rating, 1_000);
    assert.equal(arena.ratings[modeId].games, 0);
    assert.equal(arena.ratings[modeId].placement, "unplaced");
  }
});

test("player-shaped records and legacy rating-shaped records migrate safely", () => {
  const wrapper = sanitizeScrambleArena({
    duelRating: { rating: 1_222, games: 2, wins: 2 },
    scrambleArena: {
      progression: { xp: 450, level: 3 },
      ratings: {
        wordStorm: { rating: 1_111, games: 1, wins: 1 }
      }
    }
  });
  assert.equal(wrapper.ratings["target-race"].rating, 1_222);
  assert.equal(wrapper.ratings.wordstorm.rating, 1_111);
  assert.equal(wrapper.progression.xp, 450);
  assert.equal(wrapper.progression.level, 3);

  const legacy = sanitizeScrambleArena({
    rating: 988,
    games: 1,
    losses: 1
  });
  assert.equal(legacy.ratings["target-race"].rating, 988);
  assert.equal(legacy.ratings["target-race"].placement, "provisional");
  assert.equal(legacy.ratings.wordstorm.placement, "unplaced");
});

test("mode ratings retain Duel bounds and enforce cross-field counts", () => {
  assert.deepEqual(
    sanitizeScrambleModeRating({
      rating: 99_999,
      games: 3,
      wins: 20,
      losses: 20,
      draws: 20,
      streak: -5,
      updatedAt: "not-a-date"
    }),
    {
      seasonId: SCRAMBLE_ARENA_SEASON_ID,
      rating: 10_000,
      games: 3,
      wins: 3,
      losses: 0,
      draws: 0,
      streak: 0,
      provisional: true,
      placement: "provisional",
      updatedAt: null
    }
  );
  assert.equal(sanitizeScrambleModeRating({ rating: -400 }).rating, 100);
  assert.equal(sanitizeScrambleModeRating({ rating: 0 }).rating, 1_000);
});

test("rating selection and replacement are mode-specific, immutable, and reward-neutral", () => {
  const source = {
    seasonId: "season-safe",
    progression: {
      xp: 900,
      level: 4,
      updatedAt: "2026-07-29T12:00:00.000Z"
    },
    ratings: {
      "target-race": { rating: 1_050, games: 5, wins: 3, losses: 2 },
      wordstorm: { rating: 980, games: 1, losses: 1 }
    }
  };
  const before = structuredClone(source);
  const next = applyScrambleModeRating(source, "wordstorm", {
    rating: 1_020,
    games: 2,
    wins: 1,
    losses: 1,
    updatedAt: "2026-07-29T12:05:00.000Z"
  });

  assert.deepEqual(source, before);
  assert.equal(next.ratings.wordstorm.rating, 1_020);
  assert.equal(next.ratings["target-race"].rating, 1_050);
  assert.deepEqual(next.progression, {
    seasonId: "season-safe",
    xp: 900,
    level: 4,
    updatedAt: "2026-07-29T12:00:00.000Z"
  }, "applying a rating must not duplicate or alter shared XP rewards");
  assert.deepEqual(scrambleRatingForMode(next, "storm"), next.ratings.wordstorm);
  assert.equal(scrambleRatingForMode(next, "unknown-mode"), null);
  assert.ok(Object.isFrozen(next));
  assert.ok(Object.isFrozen(next.progression));
  assert.ok(Object.isFrozen(next.ratings));
  for (const rating of Object.values(next.ratings)) assert.ok(Object.isFrozen(rating));

  assert.throws(() => {
    next.ratings.wordstorm.rating = 9_999;
  }, TypeError);
});

test("public snapshots allowlist fields and remain deeply frozen", () => {
  const snapshot = publicScrambleArenaSnapshot({
    version: 99,
    secret: "do-not-copy",
    progression: {
      xp: 25,
      level: 2,
      secret: "do-not-copy"
    },
    ratings: {
      "target-race": {
        rating: 1_100,
        games: 5,
        wins: 5,
        secret: "do-not-copy"
      }
    }
  });
  assert.equal(snapshot.secret, undefined);
  assert.equal(snapshot.progression.secret, undefined);
  assert.equal(snapshot.ratings["target-race"].secret, undefined);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.progression));
  assert.ok(Object.isFrozen(snapshot.ratings));
  assert.ok(Object.values(snapshot.ratings).every(Object.isFrozen));
});

test("hostile getters, proxies, and option objects cannot execute or break sanitation", () => {
  let getterCalls = 0;
  const poisoned = {};
  for (const key of ["scrambleArena", "duelRating", "ratings", "progression", "seasonId"]) {
    Object.defineProperty(poisoned, key, {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("getter executed");
      }
    });
  }
  const throwingProxy = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error("descriptor trap");
    },
    get() {
      throw new Error("get trap");
    }
  });
  const { proxy: revokedProxy, revoke } = Proxy.revocable({}, {});
  revoke();

  assert.doesNotThrow(() => sanitizeScrambleArena(poisoned, throwingProxy));
  assert.doesNotThrow(() => sanitizeScrambleArena(throwingProxy));
  assert.doesNotThrow(() => sanitizeScrambleArena(revokedProxy));
  assert.doesNotThrow(() => sanitizeScrambleModeRating(throwingProxy));
  assert.doesNotThrow(() => listScrambleModeDefinitions(throwingProxy));
  assert.equal(getterCalls, 0);

  const safe = sanitizeScrambleArena(poisoned, throwingProxy);
  assert.equal(safe.ratings["target-race"].rating, 1_000);
  assert.equal(safe.ratings["target-race"].placement, "unplaced");
  assert.equal(safe.progression.xp, 0);
});

test("invalid rating updates preserve a clean arena without mutating shared progression", () => {
  const arena = sanitizeScrambleArena({
    progression: { xp: 88, level: 2 },
    ratings: {
      "target-race": { rating: 1_150, games: 5, wins: 3, losses: 2 }
    }
  });
  const result = applyScrambleModeRating(arena, "__proto__", {
    rating: 10_000,
    games: 100,
    wins: 100
  });
  assert.equal(result.ratings["target-race"].rating, 1_150);
  assert.equal(result.progression.xp, 88);
  assert.equal(Object.getPrototypeOf(result.ratings), Object.prototype);
  assert.equal(Object.hasOwn(result.ratings, "__proto__"), false);
});

test("an explicit active season resets stale arena ratings and shared progression", () => {
  const rolled = sanitizeScrambleArena({
    seasonId: "v4-s9",
    progression: {
      seasonId: "v4-s9",
      xp: 50_000,
      level: 99
    },
    ratings: {
      "target-race": {
        seasonId: "v4-s9",
        rating: 4_500,
        games: 200,
        wins: 180
      },
      wordstorm: {
        seasonId: "v4-s9",
        rating: 3_500,
        games: 100,
        wins: 80
      }
    }
  }, {
    seasonId: "v5-s1"
  });

  assert.equal(rolled.seasonId, "v5-s1");
  assert.deepEqual(rolled.progression, {
    seasonId: "v5-s1",
    xp: 0,
    level: 1,
    updatedAt: null
  });
  for (const modeId of SCRAMBLE_MODE_IDS) {
    assert.equal(rolled.ratings[modeId].seasonId, "v5-s1");
    assert.equal(rolled.ratings[modeId].rating, 1_000);
    assert.equal(rolled.ratings[modeId].games, 0);
    assert.equal(rolled.ratings[modeId].placement, "unplaced");
  }
});

test("an explicit season rejects stale per-mode, progression, and legacy records", () => {
  const mixed = sanitizeScrambleArena({
    seasonId: "v5-s1",
    progression: {
      seasonId: "v4-s9",
      xp: 9_000,
      level: 20
    },
    duelRating: {
      seasonId: "v4-s9",
      rating: 2_500,
      games: 50,
      wins: 40
    },
    ratings: {
      wordstorm: {
        seasonId: "v5-s1",
        rating: 1_250,
        games: 5,
        wins: 3,
        losses: 2
      },
      "forge-clash": {
        seasonId: "v4-s9",
        rating: 2_000,
        games: 30,
        wins: 20
      }
    }
  }, {
    seasonId: "v5-s1",
    legacyDuelRating: {
      seasonId: "v4-s9",
      rating: 9_000,
      games: 500,
      wins: 500
    }
  });

  assert.equal(mixed.progression.xp, 0);
  assert.equal(mixed.ratings["target-race"].placement, "unplaced");
  assert.equal(mixed.ratings.wordstorm.rating, 1_250);
  assert.equal(mixed.ratings["forge-clash"].placement, "unplaced");

  const matchingLegacy = sanitizeScrambleArena(null, {
    seasonId: "v5-s1",
    legacyDuelRating: {
      seasonId: "v5-s1",
      rating: 1_333,
      games: 6,
      wins: 4,
      losses: 2
    }
  });
  assert.equal(matchingLegacy.ratings["target-race"].rating, 1_333);

  const seasonlessLegacy = sanitizeScrambleArena(null, {
    seasonId: "v5-s1",
    legacyDuelRating: {
      rating: 1_444,
      games: 6,
      wins: 4,
      losses: 2
    }
  });
  assert.equal(seasonlessLegacy.ratings["target-race"].placement, "unplaced");
});

test("without an explicit active season, a legacy record retains its own season", () => {
  const migrated = sanitizeScrambleArena({
    duelRating: {
      seasonId: "legacy-s7",
      rating: 1_275,
      games: 5,
      wins: 3,
      losses: 2
    }
  });
  assert.equal(migrated.seasonId, "legacy-s7");
  assert.equal(migrated.ratings["target-race"].seasonId, "legacy-s7");
  assert.equal(migrated.ratings["target-race"].rating, 1_275);
});
