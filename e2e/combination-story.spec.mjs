import { expect, test } from "@playwright/test";

test.skip(({ browserName }) => browserName !== "chromium", "One browser covers the retired presentation contract.");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

async function enterFirstOrbit(page) {
  const cinematic = page.locator(".first-open-cinematic");
  await expect(cinematic).toHaveCount(0);
  await expect(page.locator("#startScreen")).toBeVisible();
  await expect(page.locator("#gameScreen")).toBeHidden();

  const primaryOrbit = page.locator("#primaryOrbitButton");
  await expect(primaryOrbit).toBeVisible();
  await expect(primaryOrbit).toBeEnabled();
  await primaryOrbit.click();
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", false);
  await expect(page.locator("#firstOrbitGuide")).toBeVisible();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#cosmicGate")).toBeHidden();
}

async function choosePlayWord(page, word) {
  const key = word.toLowerCase();
  const game = page.locator("#gameScreen");
  if (await game.getAttribute("data-word-input") !== "bloom") {
    await page.locator(`.inventory-word[data-word="${key}"]`).click();
    return;
  }

  const bloom = page.locator("#constellationBloom");
  const bubble = page.locator(`#constellationBloomWords [data-word="${key}"]`);
  await expect.poll(() => bloom.getAttribute("data-transition")).toBe(null);
  if (await bloom.getAttribute("data-stage") === "closed") {
    await page.locator("#constellationBloomTrigger").click();
    await expect(bloom).toHaveAttribute("data-stage", "words");
  }
  if (!await bubble.isVisible()) {
    await page.locator("#constellationBloomSearch").fill(word);
  }
  await expect(bubble).toBeVisible();
  await bubble.click();
  // A first ingredient keeps the palette open for its partner; a completed
  // combination closes it. The real result assertions below cover the commit.

}

test("a correct route creates its real result without mounting a duplicate story overlay", async ({ page }) => {
  await page.goto("/play/?birthday=off");
  await enterFirstOrbit(page);

  await expect(page.locator("#combinationStory")).toHaveCount(0);
  await expect(page.locator("link[data-combination-story-style]")).toHaveCount(0);

  await choosePlayWord(page, "Earth");
  await choosePlayWord(page, "Water");

  await expect(page.locator('.board-word[data-word="mud"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('.board-word[data-word="mud"]')).toHaveClass(/route-derived/);
  await expect(page.locator("#combinationStory")).toHaveCount(0);
  await expect(page.locator("link[data-combination-story-style]")).toHaveCount(0);
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", true, { timeout: 8_000 });
});
