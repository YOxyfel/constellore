import { GameStore, RunRegistry } from "../../game-services.mjs";
import { DuelService } from "../../duel-services.mjs";

const STARTERS = ["Earth", "Water", "Fire", "Air"];
const RECIPES = [
  { a: "Earth", b: "Water", word: "Mud", emoji: "\u{1F7E4}", category: "matter", source: "world" },
  { a: "Fire", b: "Water", word: "Steam", emoji: "\u2668\uFE0F", category: "energy", source: "world" },
  { a: "Air", b: "Water", word: "Rain", emoji: "\u{1F327}\uFE0F", category: "weather", source: "world" },
  { a: "Mud", b: "Fire", word: "Brick", emoji: "\u{1F9F1}", category: "matter", source: "world" }
];

function pairKey(a, b) {
  return [a, b].map((word) => String(word).trim().toLowerCase()).sort().join("+");
}

const RECIPE_MAP = new Map(RECIPES.map((recipe) => [pairKey(recipe.a, recipe.b), recipe]));

export async function createDuelHarness({
  target = "Brick",
  startedAt = Date.parse("2026-07-29T12:00:00.000Z"),
  buildGame = null,
  resolveCombination = null,
  routeProgress = null,
  storage = null
} = {}) {
  let now = startedAt;
  const store = await new GameStore(":memory:", {
    clock: () => new Date(now),
    storage
  }).init();
  const players = [
    await store.registerPlayer(),
    await store.registerPlayer(),
    await store.registerPlayer()
  ];
  const runs = new RunRegistry(store);
  const service = new DuelService(store, runs, {
    clock: () => now,
    buildGame: buildGame || (async ({
      seed,
      kind,
      duelId,
      rematchOf,
      target: requestedTarget
    }) => {
      const gameTarget = String(requestedTarget || target);
      return {
        game: {
          mode: "duel",
          modeName: "Constellation Scramble",
          target: gameTarget,
          tier: 1,
          seed,
          kind,
          duelId,
          rematchOf,
          timeLimit: 300,
          routeLength: 2,
          starters: [...STARTERS],
          starterItems: STARTERS.map((word) => ({
            word,
            emoji: "\u2726",
            category: "origin",
            source: "origin"
          })),
          scoringDisabled: true,
          scoreEligible: false,
          rewardEligible: false,
          leaderboardEligible: false
        },
        solutionRoute: RECIPES.filter((recipe) =>
          ["Mud", "Brick"].includes(recipe.word)
        ),
        challengeIdentity: {
          challengeKey: "private-challenge-key",
          signature: "private-signature"
        }
      };
    }),
    resolveCombination: resolveCombination || (async (a, b) => {
      const recipe = RECIPE_MAP.get(pairKey(a, b));
      return recipe ? structuredClone(recipe) : null;
    }),
    routeProgress: routeProgress || ((run) => {
      const runTarget = String(run.game.target || target);
      const complete = run.discovered.has(runTarget.toLowerCase());
      const remaining = complete ? 0 : Math.max(1, 2 - run.moves);
      return {
        total: 2,
        remaining,
        complete,
        percent: complete ? 100 : Math.round(((2 - remaining) / 2) * 100)
      };
    })
  });
  return {
    now: () => now,
    setNow(value) {
      now = Number(value);
    },
    advance(milliseconds) {
      now += milliseconds;
      return now;
    },
    store,
    players,
    runs,
    service
  };
}

export async function createStartedInvite(harness) {
  const [host, rival] = harness.players;
  const invited = await harness.service.createInvite(host.id, {
    actionId: "invite_0001"
  });
  const joined = await harness.service.joinInvite(rival.id, {
    actionId: "join_000001",
    inviteCode: invited.inviteCode
  });
  await harness.service.ready(joined.duel.id, host.id, {
    actionId: "ready_00001",
    ready: true
  });
  const countdown = await harness.service.ready(joined.duel.id, rival.id, {
    actionId: "ready_00002",
    ready: true
  });
  harness.setNow(Date.parse(countdown.duel.startsAt));
  await harness.service.tick();
  return {
    duelId: joined.duel.id,
    host,
    rival,
    countdown: countdown.duel
  };
}

export function successfulAction(service, duelId, playerId, {
  actionId,
  a,
  b,
  expectedRevision = 0
}) {
  return service.act(duelId, playerId, {
    actionId,
    a,
    b,
    expectedRevision
  });
}
