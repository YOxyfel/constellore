import { expect, test } from "@playwright/test";

test.skip(({ browserName }) => browserName !== "chromium", "The instant mobile quit contract is covered in Chromium.");

test("one Quit game click returns Home before the held forfeit response", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile", "The instant quit interaction is exercised once in the mobile Chromium project.");

  const registrationResponse = await request.post("/api/player/register");
  expect(registrationResponse.ok()).toBeTruthy();
  const registration = await registrationResponse.json();
  const today = new Date().toISOString().slice(0, 10);

  await page.addInitScript(({ playerId, playerToken, dailyCompleted }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("constellore-profile-v1", JSON.stringify({
      version: 8,
      playerId,
      playerToken,
      wins: 1,
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true },
      dailyCompleted
    }));
  }, {
    playerId: registration.player.id,
    playerToken: registration.playerToken,
    dailyCompleted: today
  });

  let forfeitRequests = 0;
  let releaseForfeit;
  let forfeitFulfilled = false;
  const heldForfeit = new Promise((resolve) => {
    releaseForfeit = resolve;
  });

  await page.route("**/api/run/forfeit", async (route) => {
    forfeitRequests += 1;
    await heldForfeit;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        completed: false,
        forfeited: true,
        scoringDisabled: true,
        scoreEligible: false,
        rewardEligible: false,
        leaderboardEligible: false,
        score: 0
      })
    });
    forfeitFulfilled = true;
  });

  try {
    await page.goto("/play/");
    expect(page.viewportSize()?.width).toBeLessThanOrEqual(412);

    const home = page.locator("#startScreen");
    const game = page.locator("#gameScreen");
    const primary = page.locator("#primaryOrbitButton");
    await expect(home).toBeVisible();
    await expect(primary).toBeVisible();
    await expect(primary).toBeEnabled();

    await primary.click();
    const briefing = page.locator("#missionBriefingDialog");
    await expect(briefing).toHaveJSProperty("open", true);
    await page.locator("#beginMission").click();
    await expect(briefing).toHaveJSProperty("open", false);
    await expect(game).toBeVisible();
    await expect(home).toBeHidden();

    await page.locator("#pauseRunButton").click();
    const pauseDialog = page.locator("#pauseDialog");
    const confirmation = page.locator("#pauseConfirmation");
    const quit = page.locator("#pauseExit");
    await expect(pauseDialog).toHaveJSProperty("open", true);
    await expect(confirmation).toBeHidden();
    await expect(quit).toHaveText("Quit game");

    await page.evaluate(() => {
      const panel = document.querySelector("#pauseConfirmation");
      window.__instantQuitConfirmationShown = false;
      const recordVisibility = () => {
        if (panel && !panel.hidden) window.__instantQuitConfirmationShown = true;
      };
      new MutationObserver(recordVisibility).observe(panel, {
        attributes: true,
        attributeFilter: ["hidden"]
      });
      recordVisibility();
    });

    await quit.click();

    await expect(game).toBeHidden();
    await expect(home).toBeVisible();
    await expect(pauseDialog).toHaveJSProperty("open", false);
    await expect.poll(() => forfeitRequests).toBe(1);
    expect(await page.evaluate(() => window.__instantQuitConfirmationShown)).toBe(false);
    expect(forfeitFulfilled).toBe(false);

    releaseForfeit();
    await expect.poll(() => forfeitFulfilled).toBe(true);
    expect(forfeitRequests).toBe(1);
  } finally {
    releaseForfeit();
  }
});
