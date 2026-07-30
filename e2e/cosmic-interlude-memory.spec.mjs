import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

test.skip(({ browserName }) => browserName !== "chromium", "One deterministic mobile browser covers the memory timer contract.");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("constellore-cosmic-interludes-v1", JSON.stringify({
      version: 2,
      seed: 72,
      lastSettledChallenge: 0,
      lastType: "constellation-links",
      starTrailRounds: 0
    }));
  });
  await installSeenIntroFixture(page);
});

test("Star Trail shows three numbered stars for exactly five seconds, then tests memory", async ({ page }) => {
  await page.goto("/play/");
  await expect(page.locator("#cosmicGate")).toBeHidden();
  const interludeStyles = page.locator('link[rel="stylesheet"][data-optional-surface^="cosmic-interlude.css"]');
  await expect(interludeStyles).toHaveCount(0);

  await page.evaluate(() => {
    const retry = document.querySelector("#resultRetry");
    retry.dataset.interludeWin = "3";
    retry.click();
  });

  const dialog = page.locator("#cosmicInterludeDialog");
  const stage = page.locator("#cosmicInterludeStage");
  const memory = page.locator("#cosmicInterludeMemory");
  const stars = page.locator("#cosmicInterludeEndpoints [data-node-id]");
  await expect(interludeStyles).toHaveCount(1);
  await expect(dialog).toHaveJSProperty("open", true);
  await expect(dialog.getByRole("heading", { name: "Remember the star order" })).toBeVisible();
  await expect(stage).toBeHidden();

  await page.clock.install();
  const clockNow = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(clockNow + 100);
  await page.locator("#cosmicInterludePrimary").click();

  await expect(stage).toBeVisible();
  await expect(stage).toHaveAttribute("data-memory-phase", "preview");
  await expect(memory).toHaveText("Memorize the order · 5");
  await expect(stars).toHaveCount(3);
  expect((await stars.allTextContents()).sort()).toEqual(["1", "2", "3"]);
  for (let index = 0; index < 3; index += 1) {
    await expect(stars.nth(index)).toHaveAttribute("aria-disabled", "true");
  }

  await page.locator('[data-node-id="star-1"]').click({ force: true });
  await expect(page.locator("#cosmicInterludeStatus")).toContainText("Memorize");
  await expect(page.locator("#cosmicInterludeStatus")).not.toContainText("1 of");

  await page.clock.fastForward(4_999);
  await expect(stage).toHaveAttribute("data-memory-phase", "preview");
  await expect(memory).toHaveText("Memorize the order · 1");
  expect((await stars.allTextContents()).sort()).toEqual(["1", "2", "3"]);

  await page.clock.fastForward(1);
  await expect(stage).toHaveAttribute("data-memory-phase", "recall");
  await expect(memory).toHaveText("Numbers hidden · repeat the order");
  expect((await stars.allTextContents()).every((text) => !/^[1-5]$/.test(text))).toBe(true);
  await expect(page.locator("#cosmicInterludeEndpoints [data-node-id].is-current")).toHaveCount(0);
  for (let index = 0; index < 3; index += 1) {
    await expect(stars.nth(index)).toHaveAttribute("aria-disabled", "false");
    await expect(stars.nth(index)).not.toHaveAttribute("aria-current", "step");
  }

  await page.locator('[data-node-id="star-2"]').click();
  await expect(page.locator("#cosmicInterludeStatus")).toHaveText("0 of 3 stars");
  await expect(page.locator("#cosmicInterludeStageHelp")).toHaveText("That star was out of order. Try again.");

  const first = page.locator('[data-node-id="star-1"]');
  await first.focus();
  await first.press("Enter");
  await expect(page.locator("#cosmicInterludeStatus")).toHaveText("1 of 3 stars");
  await expect(page.locator("#cosmicInterludeUndo")).toBeVisible();
  await expect(page.locator("#cosmicInterludeSkip")).toBeVisible();
});
