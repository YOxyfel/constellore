import test from "node:test";
import assert from "node:assert/strict";
import {
  GameStore,
  RunRegistry,
  sanitizeDuelEligibility,
  sanitizeDuelRating
} from "../game-services.mjs";
import { DuelService } from "../duel-services.mjs";
import {
  createDuelHarness,
  createStartedInvite,
  successfulAction
} from "./fixtures/duel-harness.mjs";

function memoryStorage(initial = null) {
  let snapshot = initial == null ? null : structuredClone(initial);
  let saves = 0;
  return {
    kind: "test-memory",
    async load() {
      return snapshot == null ? null : structuredClone(snapshot);
    },
    async save(value) {
      snapshot = structuredClone(value);
      saves += 1;
    },
    snapshot() {
      return snapshot == null ? null : structuredClone(snapshot);
    },
    saveCount() {
      return saves;
    }
  };
}

async function startPublic(harness) {
  const [first, second] = harness.players;
  const duel = await harness.service.createDuel("public", [first.id, second.id], {
    rated: true
  });
  await harness.service.ready(duel.id, first.id, {
    actionId: "ready_store1",
    ready: true
  });
  const countdown = await harness.service.ready(duel.id, second.id, {
    actionId: "ready_store2",
    ready: true
  });
  harness.setNow(Date.parse(countdown.duel.startsAt));
  await harness.service.tick();
  return duel.id;
}

test("v10 data migrates to the bounded v12 Scramble Arena schema", async () => {
  const sourceStore = await new GameStore(":memory:").init();
  const player = await sourceStore.registerPlayer();
  const legacy = structuredClone(sourceStore.data);
  legacy.version = 10;
  delete legacy.duels;
  legacy.duelResults = Array.from({ length: 5_001 }, (_, index) => ({ id: `old-${index}` }));
  delete legacy.duelRatingLedger;
  delete legacy.players[player.id].duelRating;
  delete legacy.players[player.id].scrambleArena;
  delete legacy.players[player.id].duelEligibility;
  const storage = memoryStorage(legacy);

  const migrated = await new GameStore(":memory:", { storage }).init();
  assert.equal(migrated.data.version, 12);
  assert.deepEqual(migrated.data.duels, {});
  assert.equal(migrated.data.duelResults.length, 5_000);
  assert.deepEqual(migrated.data.duelRatingLedger, []);
  assert.deepEqual(migrated.data.players[player.id].duelRating, sanitizeDuelRating());
  assert.equal(migrated.data.players[player.id].scrambleArena.ratings["target-race"].rating, 1_000);
  assert.equal(migrated.data.players[player.id].scrambleArena.ratings.wordstorm.games, 0);
  assert.equal(migrated.data.players[player.id].scrambleArena.ratings["forge-clash"].games, 0);
  assert.deepEqual(
    migrated.data.players[player.id].duelEligibility,
    sanitizeDuelEligibility()
  );
  assert.equal(storage.snapshot().version, 12);
});

test("player export keeps Duel slots but strips rival IDs and internal rating receipts", async () => {
  const harness = await createDuelHarness({ target: "Mud" });
  const [winner, rival] = harness.players;
  const duelId = await startPublic(harness);
  await successfulAction(harness.service, duelId, winner.id, {
    actionId: "finish_store",
    a: "Earth",
    b: "Water"
  });

  const exported = harness.store.playerDataExport(winner.id);
  assert.equal(exported.duels.length, 1);
  assert.equal(exported.duels[0].kind, "public");
  assert.deepEqual(
    exported.duels[0].participants.map((participant) => participant.slot),
    ["slot-a", "slot-b"]
  );
  assert.deepEqual(
    exported.duels[0].participants.map((participant) => participant.you),
    [true, false]
  );
  assert.equal(JSON.stringify(exported.duels).includes(rival.id), false);
  assert.equal(
    exported.duels[0].ratingReceipt.participants.some((participant) =>
      Object.hasOwn(participant, "playerId")
    ),
    false
  );
  assert.deepEqual(
    exported.duels[0].ratingReceipt.participants.map((participant) => participant.slot),
    ["slot-a", "slot-b"]
  );
});

test("free-player deletion removes nested Duel rating records and live match data", async () => {
  const harness = await createDuelHarness({ target: "Mud" });
  const [deleted, survivor] = harness.players;
  const duelId = await startPublic(harness);
  await successfulAction(harness.service, duelId, deleted.id, {
    actionId: "finish_delete",
    a: "Earth",
    b: "Water"
  });
  assert.ok(harness.store.data.duelRatingLedger.some((entry) =>
    entry.participants.some((participant) => participant.playerId === deleted.id)
  ));

  await harness.store.deleteFreePlayerData(deleted.id);
  assert.equal(harness.store.data.players[deleted.id], undefined);
  assert.ok(harness.store.data.players[survivor.id]);
  assert.equal(harness.store.data.duels[duelId], undefined);
  assert.equal(harness.store.data.duelResults.length, 0);
  assert.equal(harness.store.data.duelRatingLedger.some((entry) =>
    entry?.playerId === deleted.id
    || entry?.participants?.some((participant) => participant.playerId === deleted.id)
  ), false);
});

test("safe backups omit live Duels while retaining settled, recovery-safe records", async () => {
  const harness = await createDuelHarness({ target: "Mud" });
  const [winner] = harness.players;
  const duelId = await startPublic(harness);
  await successfulAction(harness.service, duelId, winner.id, {
    actionId: "finish_backup",
    a: "Earth",
    b: "Water"
  });
  const backup = harness.store.safeBackupSnapshot(new Date(harness.now()));
  assert.equal(Object.hasOwn(backup.data, "duels"), false);
  assert.equal(backup.data.duelResults.length, 1);
  assert.equal(backup.data.duelRatingLedger.length, 1);
  for (const stored of Object.values(backup.data.players)) {
    assert.equal(Object.hasOwn(stored, "recovery"), false);
    assert.equal(Object.hasOwn(stored, "sessions"), false);
  }
});

test("finished Duel runs survive lobby retention and pruning is durably persisted", async () => {
  const storage = memoryStorage();
  const harness = await createDuelHarness({ target: "Mud", storage });
  const { duelId, host } = await createStartedInvite(harness);
  await successfulAction(harness.service, duelId, host.id, {
    actionId: "finish_prune1",
    a: "Earth",
    b: "Water"
  });
  const stored = harness.store.data.duels[duelId];
  for (const participant of stored.participants) {
    const run = harness.runs.getOwned(participant.runId, participant.playerId);
    assert.ok(run.expiresAt >= stored.settledAt + 24 * 60 * 60_000 + 60_000);
  }
  const savesBeforePrune = storage.saveCount();
  harness.advance(24 * 60 * 60_000 + 1);
  await harness.service.tick();
  assert.equal(harness.store.data.duels[duelId], undefined);
  assert.equal(storage.snapshot().duels[duelId], undefined);
  assert.ok(storage.saveCount() > savesBeforePrune);
});

test("stored Duel event buffers remain monotonic and bounded", async () => {
  const harness = await createDuelHarness();
  const [host] = harness.players;
  const invited = await harness.service.createInvite(host.id, {
    actionId: "invite_bound1"
  });
  const duel = harness.store.data.duels[invited.duel.id];
  for (let index = 0; index < 600; index += 1) {
    harness.service.appendEvent(duel, "audit_event", { move: index });
  }
  assert.equal(duel.events.length, 512);
  assert.equal(duel.events[0].sequence, 89);
  assert.equal(duel.events.at(-1).sequence, 600);
  assert.equal(new Set(duel.events.map((event) => event.sequence)).size, 512);

  const restoredRuns = new RunRegistry(harness.store);
  const restored = new DuelService(harness.store, restoredRuns, {
    clock: harness.now,
    buildGame: async () => {
      throw new Error("not used");
    },
    resolveCombination: async () => null,
    routeProgress: () => ({ total: 1, remaining: 1, complete: false, percent: 0 })
  });
  assert.equal(restored.duel(duel.id).events.length, 512);
});
