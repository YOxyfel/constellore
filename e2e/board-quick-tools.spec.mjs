import { expect, test } from "@playwright/test";

async function startChallenge(page) {
  await page.goto("/play/?challenge=1&target=Telescope&seed=73");
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  await page.locator("#beginMission").click();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#boardQuickTools")).toBeVisible();
}

async function addWord(page, word) {
  const item = page.locator(`.inventory-word[data-word="${word}"]`);
  await expect(item).toBeVisible();
  await expect(item).toBeEnabled();
  await item.click({ force: true });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("quick board tools undo, redo, tidy, and reversibly clear visual words", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Keyboard history is covered once in Chromium.");
  await startChallenge(page);

  const undo = page.locator("#undoBoardAction");
  const redo = page.locator("#redoBoardAction");
  const tidy = page.locator("#tidyBoard");
  const clear = page.locator("#resetBoard");
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  await addWord(page, "earth");
  await expect(page.locator('.board-word[data-word="earth"]')).toHaveCount(1);
  await expect(undo).toBeEnabled();

  await undo.click();
  await expect(page.locator(".board-word")).toHaveCount(0);
  await expect(redo).toBeEnabled();

  await redo.click();
  await expect(page.locator('.board-word[data-word="earth"]')).toHaveCount(1);

  await addWord(page, "water");
  await expect(page.locator(".board-word")).toHaveCount(2);
  await expect(tidy).toBeEnabled();
  await tidy.click();
  await expect(page.locator(".board-word")).toHaveCount(2);

  await clear.click();
  await expect(page.locator(".board-word")).toHaveCount(0);
  await expect(undo).toBeEnabled();
  await page.keyboard.press("Control+z");
  await expect(page.locator(".board-word")).toHaveCount(2);
  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator(".board-word")).toHaveCount(0);
});

test("a missing combination asks for the player's expected result and saves or sends the bounded report", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The report interaction is covered once in Chromium.");
  let reportPayload = null;
  await page.route("**/api/combination-reports", async (route) => {
    reportPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ accepted: true, duplicate: false, reviewable: true })
    });
  });

  await startChallenge(page);
  await addWord(page, "earth");
  await addWord(page, "water");
  await expect(page.locator('.inventory-word[data-word="mud"]')).toBeVisible();
  await page.locator("#resetBoard").click();
  await expect(page.locator(".board-word")).toHaveCount(0);
  await addWord(page, "fire");
  await addWord(page, "air");
  await expect(page.locator('.inventory-word[data-word="energy"]')).toBeVisible();
  await page.locator("#resetBoard").click();
  await expect(page.locator(".board-word")).toHaveCount(0);
  await page.route("**/api/combine", async (route) => {
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({ error: "No logical combination exists yet.", code: "combination_missing" })
    });
  });
  await addWord(page, "mud");
  await addWord(page, "energy");

  const feedback = page.locator("#expectedPairFeedback");
  await expect(feedback).toBeVisible();
  await expect(feedback.locator("#expectedPairTitle")).toContainText(/What should .* make\?/);
  await feedback.locator("#expectedPairResult").fill("Wetland");
  await feedback.locator("#expectedPairButton").click();
  await expect(feedback.locator("#expectedPairButton")).toHaveText(/Idea sent|Saved/);
  if (reportPayload) {
    expect(new Set([reportPayload.a, reportPayload.b])).toEqual(new Set(["Mud", "Energy"]));
    expect(reportPayload.expected).toBe("Wetland");
    expect(reportPayload.reason).toBe("");
    expect(reportPayload.reporterId).toMatch(/^[A-Za-z0-9_-]{16,80}$/);
  } else {
    const localReport = await page.evaluate(() => JSON.parse(localStorage.getItem("constellore-local-expected-pairs-v1") || "null"));
    const saved = Object.values(localReport?.reports || {}).find((entry) => {
      const pair = new Set(entry?.pair || []);
      return pair.has("Mud") && pair.has("Energy");
    });
    expect(saved?.suggestions?.Wetland).toBe(1);
  }
});
