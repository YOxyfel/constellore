import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const releaseVersion = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
const releaseVersionPattern = releaseVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test.skip(({ browserName }) => browserName !== "chromium", "One mobile browser covers the on-demand story presentation.");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

async function enterFirstOrbit(page) {
  const cinematic = page.locator(".first-open-cinematic");
  await expect(cinematic).toBeVisible();
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expect(cinematic).toHaveCount(0);
  await expect(page.locator("#startScreen")).toBeVisible();
  await expect(page.locator("#gameScreen")).toBeHidden();

  const primaryOrbit = page.locator("#primaryOrbitButton");
  await expect(primaryOrbit).toBeVisible();
  await expect(primaryOrbit).toBeEnabled();
  await primaryOrbit.click();
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  await briefing.locator("#beginMission").click();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#cosmicGate")).toBeHidden();
}

test("the first combination becomes a visible story foundation before the result", async ({ page }) => {
  await page.goto("/play/");
  await enterFirstOrbit(page);

  await page.locator('.inventory-word[data-word="earth"]').click({ force: true });
  await page.locator('.inventory-word[data-word="water"]').click({ force: true });

  const story = page.locator("#combinationStory");
  await expect(story).not.toHaveAttribute("hidden", "");
  await expect(story).toHaveAttribute("data-story-status", "finale");
  await expect(story).toHaveAttribute("data-story-total-layers", "1");
  await expect(story.locator("[data-story-summary]")).toContainText("Mud");
  await expect(story.locator("[data-story-layer-word]")).toHaveText("Mud");
  await expect(page.locator("link[data-combination-story-style]")).toHaveAttribute(
    "href",
    new RegExp(`/story/combination-story[.]css\\?v=${releaseVersionPattern}$`)
  );

  const presentation = await story.evaluate((root) => {
    const style = getComputedStyle(root);
    return { position: style.position, pointerEvents: style.pointerEvents, zIndex: style.zIndex };
  });
  expect(presentation).toEqual({ position: "absolute", pointerEvents: "none", zIndex: "2" });
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", true, { timeout: 8_000 });
});
