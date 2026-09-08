import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";
import {
  createWorldweavingState,
  moonWorldweavingContext,
  recordWorldweavingCompletion
} from "../public/worldweaving.mjs";

test.use({ serviceWorkers: "block" });

async function register(request) {
  const response = await request.post("/api/player/register");
  expect(response.status()).toBe(201);
  return response.json();
}

function authHeaders(account, token = account.playerToken) {
  return { "X-Constellore-Player": account.player.id, "X-Constellore-Token": token };
}

async function seedLocalProgress(page, account) {
  const worldweaving = recordWorldweavingCompletion(createWorldweavingState(), {
    context: moonWorldweavingContext("power", "solar"),
    history: [{ a: "Sun", b: "Power", word: "Solar Power", progressionEligible: true, routeCompleted: true }],
    completedAt: "2026-09-01T12:00:00.000Z"
  }).state;
  // This fixture represents existing device-local solo progress. The live test
  // server still owns the account's identity, rank, Credits, and entitlements.
  const profile = {
    version: 10,
    playerId: account.player.id,
    playerToken: account.playerToken,
    wins: 12,
    stardust: 12345,
    discovered: ["Earth", "Water", "Fire", "Air", "Steam", "Mountain"],
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true },
    worldweaving,
    cosmeticEffects: "reduced",
    feedbackPreferences: { music: false, sound: true, haptics: false, volume: .35, musicVolume: .6, sfxVolume: .4 }
  };
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [["constellore-profile-v1", JSON.stringify(profile)]]
  });
  await page.goto("/play/?birthday=off");
  await expect(page.locator("#profileDust")).toHaveText("12,345");
  await expect.poll(async () => (await readProfile(page))?.callsign).toBe(account.player.callsign);
  return readProfile(page);
}

async function readProfile(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("constellore-profile-v1")));
}

async function recoverThroughMenu(page, account) {
  await page.getByRole("button", { name: "Open main menu", exact: true }).click();
  await page.locator("#cloudProfileGroup > summary").click();
  await page.locator("#cloudAccountSection details > summary").click();
  await page.getByLabel("Player ID", { exact: true }).fill(account.player.id);
  await page.getByLabel("Recovery code", { exact: true }).fill(account.recoveryCode);
  await page.getByRole("button", { name: "Recover and rotate kit" }).click();
  await expect(page.locator("#recoveryDialog")).toBeVisible();
  await expect(page.locator("#recoveryPlayerId")).toHaveText(account.player.id);
  return readProfile(page);
}

test("recovering the current account rotates credentials without erasing device-local progress", async ({ page, request }) => {
  const account = await register(request);
  const before = await seedLocalProgress(page, account);
  const after = await recoverThroughMenu(page, account);
  for (const key of ["wins", "stardust", "discovered", "firstOrbit", "secondOrbit", "worldweaving", "expedition", "cosmetics", "cosmeticEffects", "feedbackPreferences"]) {
    expect(after[key], key).toEqual(before[key]);
  }
  expect(after.playerId).toBe(account.player.id);
  expect(after.playerToken).not.toBe(account.playerToken);
  expect((await request.get("/api/player", { headers: authHeaders(account) })).status()).toBe(401);
  const authorized = await request.get("/api/player", { headers: authHeaders(account, after.playerToken) });
  expect(authorized.status()).toBe(200);
  const { player } = await authorized.json();
  expect(after.credits).toBe(player.credits);
  expect(player.cosmeticOwnership).toMatchObject(after.cosmeticOwnership);
  expect(after.routeRank).toEqual(before.routeRank);
  const oldKit = await request.post("/api/player/recover", {
    data: { playerId: account.player.id, recoveryCode: account.recoveryCode }
  });
  expect(oldKit.status()).toBe(401);
  await page.locator("#confirmRecoverySaved").click();
  await page.reload();
  await expect(page.locator("#profileDust")).toHaveText("12,345");
  expect((await readProfile(page)).worldweaving).toEqual(before.worldweaving);
});

test("recovering another account does not carry the previous account's local profile into it", async ({ page, request }) => {
  const current = await register(request);
  const recovered = await register(request);
  await seedLocalProgress(page, current);
  const after = await recoverThroughMenu(page, recovered);
  expect(after.playerId).toBe(recovered.player.id);
  expect(after.playerToken).not.toBe(recovered.playerToken);
  expect(after.wins).toBe(0);
  expect(after.stardust).toBe(0);
  expect(after.discovered).toEqual(["Earth", "Water", "Fire", "Air"]);
  expect(after.worldweaving.worlds.moon.anchors.power).toBeNull();
  expect(after.cosmeticEffects).toBe("full");
  expect(after.feedbackPreferences.music).toBe(true);
  expect(after.feedbackPreferences.volume).toBe(.75);
  const authorized = await request.get("/api/player", { headers: authHeaders(recovered, after.playerToken) });
  expect(authorized.status()).toBe(200);
  const { player } = await authorized.json();
  expect(after.callsign).toBe(player.callsign);
  expect(after.credits).toBe(player.credits);
  expect(player.cosmeticOwnership).toMatchObject(after.cosmeticOwnership);
  expect((await request.get("/api/player", { headers: authHeaders(current) })).status()).toBe(200);
});
