import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

test.beforeEach(async ({ page }) => {
  await installSeenIntroFixture(page, { resetStorage: true });
});

test("popup windows grow smoothly without disturbing centered layouts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The shared window motion contract is exercised once on desktop.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/play/");
  await expect(page.locator("#cosmicGate")).toBeHidden();

  const profile = page.locator("#profileDialog");
  const profileMotion = await profile.evaluate((dialog) => {
    dialog.showModal();
    const style = getComputedStyle(dialog);
    const animation = dialog.getAnimations()[0];
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      frames: animation?.effect?.getKeyframes?.().map((frame) => ({
        opacity: frame.opacity,
        scale: frame.scale
      })) || []
    };
  });
  expect(profileMotion.animationName).toBe("ui-window-enter");
  expect(profileMotion.animationDuration).toBe("0.38s");
  expect(Number.parseFloat(profileMotion.frames[0]?.scale)).toBeLessThan(1);
  expect(Number.parseFloat(profileMotion.frames.at(-1)?.scale)).toBe(1);
  expect(Number.parseFloat(profileMotion.frames[0]?.opacity)).toBe(0);
  await profile.evaluate((dialog) => dialog.close());

  const briefing = page.locator("#missionBriefingDialog");
  const centerDuringEntry = await briefing.evaluate((dialog) => {
    dialog.showModal();
    const rect = dialog.getBoundingClientRect();
    return {
      horizontal: rect.left + rect.width / 2,
      vertical: rect.top + rect.height / 2,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      transform: getComputedStyle(dialog).transform
    };
  });
  expect(centerDuringEntry.transform).not.toBe("none");
  expect(Math.abs(centerDuringEntry.horizontal - centerDuringEntry.viewportWidth / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(centerDuringEntry.vertical - centerDuringEntry.viewportHeight / 2)).toBeLessThanOrEqual(1);
  await briefing.evaluate((dialog) => dialog.close());

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileWindow = await profile.evaluate((dialog) => {
    dialog.showModal();
    const rect = dialog.getBoundingClientRect();
    return {
      animationName: getComputedStyle(dialog).animationName,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight
    };
  });
  expect(mobileWindow.animationName).toBe("ui-full-window-enter");
  expect(mobileWindow.left).toBeGreaterThanOrEqual(-1);
  expect(mobileWindow.top).toBeGreaterThanOrEqual(-1);
  expect(mobileWindow.right).toBeLessThanOrEqual(mobileWindow.viewportWidth + 1);
  expect(mobileWindow.bottom).toBeLessThanOrEqual(mobileWindow.viewportHeight + 1);
  await profile.evaluate((dialog) => dialog.close());

  const resultFallback = page.locator("#resultDialog");
  const fallbackAnimation = await resultFallback.evaluate((dialog) => {
    dialog.removeAttribute("data-phase");
    dialog.showModal();
    return getComputedStyle(dialog).animationName;
  });
  // The viewport is still the 390px phone size established above. Result is
  // one of the mobile full-window dialogs, even when its cinematic phase is
  // absent and the shared motion fallback takes over.
  expect(fallbackAnimation).toBe("ui-full-window-enter");
  await resultFallback.evaluate((dialog) => dialog.close());

  const pause = page.locator("#pauseDialog");
  const cinematicAnimation = await pause.evaluate((dialog) => {
    dialog.dataset.phase = "opening";
    dialog.showModal();
    return getComputedStyle(dialog).animationName;
  });
  expect(cinematicAnimation).toBe("cosmic-dialog-arrive");
});

test("popup motion becomes still when reduced motion is requested", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Reduced popup motion is exercised once on desktop.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/");

  const profile = page.locator("#profileDialog");
  const reducedMotion = await profile.evaluate((dialog) => {
    dialog.showModal();
    const style = getComputedStyle(dialog);
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      scale: style.scale
    };
  });
  expect(reducedMotion.animationName).toBe("none");
  expect(Number.parseFloat(reducedMotion.animationDuration) * 1000).toBeLessThanOrEqual(1);
  expect(["none", "1"]).toContain(reducedMotion.scale);
});
