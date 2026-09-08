import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const releaseVersion = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;

test.describe("PWA runtime", () => {
  test("registers a versioned worker and reloads its shell while offline", async ({ page, context, browserName }, testInfo) => {
    test.skip(browserName !== "chromium", "Chromium is the release PWA runtime gate.");
    await installSeenIntroFixture(page);
    const productionLikeUrl = new URL("/play/", testInfo.project.use.baseURL);
    productionLikeUrl.hostname = "constellore.localhost";
    await page.goto(productionLikeUrl.href);

    await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable.");
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

    const expectedCacheName = await page.evaluate((version) => {
      const prefix = document.body.dataset.runtime === "local-practice"
        ? "constellore-pages-practice-"
        : "constellore-play-";
      return `${prefix}${version}`;
    }, releaseVersion);
    await expect.poll(() => page.evaluate(async (cacheName) => {
      const cacheKeys = await caches.keys();
      return cacheKeys.includes(cacheName);
    }, expectedCacheName)).toBe(true);

    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveTitle(/Constellore/i);
      await expect(page.locator("body")).not.toHaveClass(/cosmic-intro-pending/);
      await expect(page.locator("#primaryOrbitButton")).toBeVisible();
      await expect(page.locator("#primaryOrbitButton")).toBeEnabled();
      await expect(page.locator("body")).toHaveAttribute("data-build-version", releaseVersion);
      expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    } finally {
      await context.setOffline(false);
    }
  });
});
