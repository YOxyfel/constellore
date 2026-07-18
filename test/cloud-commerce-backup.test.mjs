import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CREATIVE_COMMERCE_CATALOG, GameStore, RunRegistry } from "../game-services.mjs";

test("anonymous recovery kits are one-time, rotated, persisted, and never stored raw", async () => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-recovery-"));
  const path = join(directory, "constellore.json");
  const store = await new GameStore(path).init();
  const registration = await store.registerPlayer({ withRecoveryCode: true });
  const { player, recoveryCode: firstCode } = registration;
  const bearer = store.tokenForPlayer(player.id);
  const legacyPlayer = await store.registerPlayer();
  delete store.data.players[legacyPlayer.id].authVersion;
  const legacyBearer = store.sign(`player:${legacyPlayer.id}`);
  await store.persist();

  assert.match(firstCode, /^CF(?:-[0-9A-F]{4}){8}$/);
  let serialized = await readFile(path, "utf8");
  assert.equal(serialized.includes(firstCode), false);
  assert.equal(serialized.includes(bearer), false);

  const recovered = await store.recoverPlayer(player.id, firstCode.toLowerCase().replaceAll("-", " "));
  assert.equal(recovered.player.id, player.id);
  assert.ok(store.authenticate(player.id, recovered.playerToken));
  assert.equal(store.authenticate(player.id, bearer), null, "recovery revokes bearer sessions from the lost device");
  assert.notEqual(recovered.recoveryCode, firstCode);
  await assert.rejects(store.recoverPlayer(player.id, firstCode), (error) => error.serviceCode === "invalid_recovery_code");

  const reloaded = await new GameStore(path).init();
  assert.equal(reloaded.authenticate(legacyPlayer.id, legacyBearer)?.id, legacyPlayer.id, "pre-recovery bearer tokens survive the data migration");
  const recoveredAfterRestart = await reloaded.recoverPlayer(player.id, recovered.recoveryCode);
  assert.equal(recoveredAfterRestart.recoveryVersion, 3);
  await reloaded.revokeRecovery(player.id);
  await assert.rejects(reloaded.recoverPlayer(player.id, recoveredAfterRestart.recoveryCode), (error) => error.serviceCode === "invalid_recovery_code");
  serialized = await readFile(path, "utf8");
  for (const secret of [firstCode, recovered.recoveryCode, recoveredAfterRestart.recoveryCode, bearer, recovered.playerToken, legacyBearer]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("cloud profiles use a strict allowlist and optimistic version conflicts", async () => {
  const store = await new GameStore().init();
  const player = await store.registerPlayer();
  assert.deepEqual(store.cloudProfile(player.id), { version: 0, profile: {}, updatedAt: null });
  await store.setFounderPass(player.id, true);

  const allowed = {
    theme: "aurora",
    cosmetics: { theme: "aurora", board: "nebula", trail: "comet", sound: "glass" },
    firstOrbit: { seen: true, completed: true },
    rivalGhostEnabled: false,
    feedbackPreferences: { sound: true, haptics: false, muted: false, volume: 0.5 },
    discovered: ["Earth", "Water", "earth"],
    masteryCelebrated: ["celestial"],
    recipeMastery: {
      version: 1,
      recipes: [{ key: '["earth","water","mud"]', a: "Earth", b: "Water", word: "Mud", discoveries: 1, stars: 1, proofs: ["p-123abcd"] }]
    },
    weekly: { key: "2026-W29", stage: 2, complete: false }
  };
  const updated = await store.updateCloudProfile(player.id, 0, allowed);
  assert.equal(updated.version, 1);
  assert.deepEqual(updated.profile.discovered, ["Earth", "Water"]);
  assert.deepEqual(updated.profile.firstOrbit, { seen: true, completed: true });

  await assert.rejects(
    store.updateCloudProfile(player.id, 0, { theme: "void" }),
    (error) => error.serviceCode === "cloud_profile_conflict" && error.details.current.version === 1
  );
  await assert.rejects(store.updateCloudProfile(player.id, 1, { credits: 999_999 }), (error) => error.serviceCode === "invalid_cloud_profile");
  await assert.rejects(store.updateCloudProfile(player.id, 1, { cosmetics: { board: "void", scoreBoost: "yes" } }), (error) => error.serviceCode === "invalid_cloud_profile");
  await assert.rejects(store.updateCloudProfile(player.id, 1, { firstOrbit: { seen: false, completed: true } }), (error) => error.serviceCode === "invalid_cloud_profile");
});

test("real-money fulfillment is creative-only while earned credits and Word Vault ownership remain server-authoritative", async () => {
  assert.deepEqual(CREATIVE_COMMERCE_CATALOG.map((product) => product.id), ["constellore_founders_pass"]);
  assert.ok(CREATIVE_COMMERCE_CATALOG.every((product) => product.competitive === false));

  const store = await new GameStore().init();
  const first = await store.registerPlayer();
  const second = await store.registerPlayer();
  const initialCredits = first.credits;
  const purchase = { productId: "constellore_founders_pass", provider: "xsolla", transactionId: "verified-payment-0001" };
  const fulfilled = await store.fulfillVerifiedPurchase(first.id, purchase);
  const repeated = await store.fulfillVerifiedPurchase(first.id, purchase);
  assert.equal(fulfilled.restored, false);
  assert.equal(repeated.restored, true);
  assert.equal(store.publicPlayer(first.id).credits, initialCredits, "real-money fulfillment must not mint gameplay currency");
  assert.equal(store.publicPlayer(first.id).founderPass, true);
  assert.equal(fulfilled.entitlements.products[0].competitive, false);
  assert.equal(fulfilled.entitlements.products[0].useDivision, "open");
  await assert.rejects(store.fulfillVerifiedPurchase(second.id, purchase), (error) => error.serviceCode === "commerce_transaction_conflict");
  await assert.rejects(
    store.fulfillVerifiedPurchase(first.id, { ...purchase, productId: "star_credits_300", transactionId: "verified-payment-0002" }),
    (error) => error.serviceCode === "invalid_commerce_product"
  );

  const quote = store.marketSnapshot(first.id).items.find((item) => item.id === "moon");
  assert.equal(quote.competitive, false);
  assert.equal(quote.useDivision, "open");
  const wordPurchase = await store.buyLicense(first.id, quote.quoteId, "creative-word-0001");
  assert.equal(wordPurchase.balance, initialCredits - wordPurchase.price);
  assert.equal(wordPurchase.useDivision, "open");
  const restored = store.entitlementSnapshot(first.id);
  assert.equal(restored.balance.starCredits, wordPurchase.balance);
  assert.deepEqual(restored.vault.map((item) => item.id), ["moon"]);

  const runs = new RunRegistry(store);
  const started = runs.start(first.id, { mode: "quick", target: "Moon", starters: ["Earth", "Water", "Fire", "Air"], tier: 1 }, { ranked: true, challengeId: "quick:creative" });
  runs.addBend(started.run, { id: "moon", word: "Moon", source: "market" }, "market");
  assert.equal(started.run.assist, "market");
  assert.equal(started.run.game.division, "open");
  started.run.completedAt = Date.now();
  assert.equal(runs.finalize(started.run, first.callsign).division, "open");
});

test("safe backup rotation preserves account records without authentication or recovery material", async () => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-backup-"));
  const path = join(directory, "constellore.json");
  const backupDirectory = join(directory, "backups");
  const store = await new GameStore(path).init();
  const registration = await store.registerPlayer({ withRecoveryCode: true });
  await store.fulfillVerifiedPurchase(registration.player.id, { productId: "constellore_founders_pass", provider: "test", transactionId: "backup-transaction-1" });
  await store.recordAnalyticsEvent({ name: "app_opened", sessionId: "private-backup-session", properties: {} }, new Date("2026-07-18T09:00:00.000Z"));

  await store.exportSafeBackup(backupDirectory, { keep: 2, date: new Date("2026-07-16T09:00:00.000Z") });
  await store.exportSafeBackup(backupDirectory, { keep: 2, date: new Date("2026-07-17T09:00:00.000Z") });
  const latest = await store.exportSafeBackup(backupDirectory, { keep: 2, date: new Date("2026-07-18T09:00:00.000Z") });
  const files = await readdir(backupDirectory);
  assert.deepEqual(files.sort(), ["constellore-safe-20260717T090000000Z.json", "constellore-safe-20260718T090000000Z.json"]);
  assert.equal(latest.retained, 2);

  const raw = await readFile(join(backupDirectory, latest.filename), "utf8");
  const backup = JSON.parse(raw);
  assert.equal(backup.format, "constellore-safe-backup");
  assert.equal(backup.authenticationResetRequired, true);
  assert.equal(backup.data.secret, undefined);
  assert.equal(backup.data.runs, undefined);
  assert.equal(backup.data.players[registration.player.id].recovery, undefined);
  assert.equal(backup.data.players[registration.player.id].purchaseKeys, undefined);
  assert.deepEqual(backup.data.interest.records, {});
  assert.deepEqual(backup.data.analytics.days["2026-07-18"].sessionHashes, {});
  assert.equal(raw.includes(registration.recoveryCode), false);
  assert.equal(raw.includes(store.tokenForPlayer(registration.player.id)), false);
  assert.equal(raw.includes("private-backup-session"), false);
  assert.equal(backup.data.players[registration.player.id].founderPass, true);
});
