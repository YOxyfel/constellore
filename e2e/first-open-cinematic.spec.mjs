import { expect, test } from "@playwright/test";

const removedIntroRequest = /\/(?:cinematic\/(?:first-open|intro-video|voyage-projection)|(?:website-)?voyage-projection[^/]*[.]|birthday-voyage[^/]*[.])/i;
const removedOverlays = ".first-open-cinematic, .voyage-projection-experience, .birthday-voyage";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const clearedKey = "constellore-e2e-launch-storage-cleared";
    if (sessionStorage.getItem(clearedKey) === "true") return;
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(clearedKey, "true");
  });
});

async function expectDirectHome(page) {
  await expect(page.locator("#startScreen")).toBeVisible();
  await expect(page.locator("#cosmicGate")).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/cosmic-intro-pending/);
  await expect(page.locator("#primaryOrbitButton")).toBeVisible();
  await expect(page.locator("#primaryOrbitButton")).toBeEnabled();
  await expect(page.locator("#gameScreen")).toBeHidden();
  await expect(page.locator(removedOverlays)).toHaveCount(0);
}

test("fresh public entry and reload open home without fetching either intro or the personal replay", async ({ page }) => {
  const requests = [];
  page.on("request", request => { if (removedIntroRequest.test(request.url())) requests.push(request.url()); });
  await page.goto("/play/");
  await expectDirectHome(page);
  await page.reload();
  await expectDirectHome(page);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("constellore-first-open-cinematic-v1"))).toBeNull();
});

test("retired voyage query overrides cannot bring back the intro", async ({ page }) => {
  const requests = [];
  page.on("request", request => { if (removedIntroRequest.test(request.url())) requests.push(request.url()); });
  for (const choice of ["realtime", "video", "poster"]) {
    await page.goto(`/play/?voyage=${choice}`);
    await expectDirectHome(page);
  }
  expect(requests).toEqual([]);
});

test("Start playing opens the playable lesson directly and Settings contains no cinematic replay", async ({ page }) => {
  const requests = [];
  page.on("request", request => { if (removedIntroRequest.test(request.url())) requests.push(request.url()); });
  await page.goto("/play/");
  await expectDirectHome(page);
  await expect(page.locator("#replayVoyageProjection")).toHaveCount(0);
  await expect(page.locator("#replayFirstOrbit")).toHaveCount(1);
  await page.locator("#primaryOrbitButton").click();
  await expect(page.locator("#missionBriefingDialog")).toHaveJSProperty("open", false);
  await expect(page.locator("#firstOrbitGuide")).toBeVisible();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#targetWord")).toHaveText("Mud");
  await expect(page.locator(removedOverlays)).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("reduced motion reaches the same usable home without an intro", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/");
  await expectDirectHome(page);
});

test("refreshing an active lesson restores the exact orbit without replaying either intro", async ({ page }) => {
  await page.addInitScript(() => {
    const fixtureKey = "constellore-e2e-resume-fixture-v1";
    if (sessionStorage.getItem(fixtureKey) === "seeded") return;
    const now = new Date().toISOString();
    localStorage.setItem("constellore-active-run-v1", JSON.stringify({
      version: 1,
      savedAt: now,
      game: {
        mode: "second-orbit",
        target: "Mountain",
        seed: 202
      },
      journeyContext: null,
      run: {
        id: "client-second-orbit-e2e-resume",
        token: "client-only",
        startedAt: now,
        deadlineAt: null,
        activationPending: false,
        assist: "none",
        scoreEligible: false,
        scoreMultiplier: 0,
        ranked: false,
        localOnly: true,
        clientOnly: true,
        hasRuntimeRun: false
      },
      progress: {
        moves: 1,
        completed: false,
        submitted: false,
        discovered: [
          { word: "Earth", emoji: "🌍", category: "nature", source: "origin" },
          { word: "Water", emoji: "💧", category: "force", source: "origin" },
          { word: "Fire", emoji: "🔥", category: "force", source: "origin" },
          { word: "Air", emoji: "💨", category: "force", source: "origin" },
          { word: "Dust", emoji: "✦", category: "nature", source: "world" }
        ],
        history: [{
          move: 1,
          a: "Earth",
          b: "Air",
          word: "Dust",
          emoji: "✦",
          category: "nature",
          source: "world",
          progressionEligible: false,
          eventEligible: false
        }],
        usedBend: false,
        usedWish: false,
        tipsUsed: 0,
        tipIds: [],
        currentTip: "",
        giftUsed: false,
        giftUnavailable: false,
        giftItem: null,
        assist: "none",
        scoringDisabled: true,
        scoreMultiplier: 0
      },
      visuals: {
        nodes: [
          { word: "Earth", x: 0.2, y: 0.32, z: 11, cosmicTwist: false },
          { word: "Air", x: 0.66, y: 0.34, z: 12, cosmicTwist: false },
          { word: "Dust", x: 0.43, y: 0.62, z: 13, cosmicTwist: false }
        ],
        inventoryQuery: "",
        inventoryRecency: [["dust", 1]]
      }
    }));
    sessionStorage.setItem(fixtureKey, "seeded");
  });

  const assertRestoredOrbit = async () => {
    await expect(page.locator(".first-open-cinematic")).toHaveCount(0);
    await expect(page.locator("#cosmicGate")).toBeHidden();
    await expect(page.locator("#startScreen")).toBeHidden();
    await expect(page.locator("#gameScreen")).toBeVisible();
    await expect(page.locator("#targetWord")).toHaveText("Mountain");
    await expect(page.locator("#movesValue")).toHaveText("1");
    await expect(page.locator('.board-word[data-word="dust"]')).toHaveCount(1);
    await expect(page.locator(".voyage-projection-experience, .birthday-voyage")).toHaveCount(0);
  };

  await page.goto("/play/");
  await assertRestoredOrbit();

  await page.waitForTimeout(250);
  await page.goto("/play/", { waitUntil: "domcontentloaded" });
  await assertRestoredOrbit();
});
