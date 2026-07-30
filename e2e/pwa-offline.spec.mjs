import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const releaseVersion = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;

test.describe("PWA runtime", () => {
  test("registers a versioned worker and reloads its shell while offline", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Chromium is the release PWA runtime gate.");
    await installSeenIntroFixture(page);
    await page.goto("/play/");

    await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable.");
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

    const cacheKeys = await page.evaluate(() => caches.keys());
    expect(cacheKeys.some((key) => key.startsWith("constellore-play-"))).toBe(true);

    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveTitle(/Constellore/i);
      await expect(page.locator("#cosmicGate")).toBeAttached();
      await expect(page.locator("body")).toHaveAttribute("data-build-version", releaseVersion);
      expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    } finally {
      await context.setOffline(false);
    }
  });
});
