import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("the player constellation is glanceable before secondary detail is requested", async ({ page }, testInfo) => {
  if (testInfo.project.name.includes("mobile")) await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/play/");
  await page.locator("#profileButton").click();

  const dialog = page.locator("#profileDialog");
  await expect(dialog).toHaveJSProperty("open", true);
  await expect(dialog.getByText("YOUR CONSTELLATION", { exact: true })).toBeVisible();
  await expect(dialog.locator(".profile-overview")).toBeVisible();
  await expect(dialog.locator(".progression-dashboard")).toBeVisible();

  for (const selector of [".profile-archive", ".profile-badges", ".profile-preferences", ".profile-data"]) {
    await expect(dialog.locator(selector)).not.toHaveAttribute("open", "");
  }
  await expect(dialog.locator(".badge-shelf")).toBeHidden();
  const trainingCards = dialog.locator(".training-replay-card");
  await expect(trainingCards).toHaveCount(2);
  for (let index = 0; index < await trainingCards.count(); index += 1) {
    await expect(trainingCards.nth(index)).toBeHidden();
  }
  await expect(dialog.locator(".diagnostics-preference")).toBeHidden();

  const layout = await dialog.evaluate((element) => ({
    dialogWidth: element.getBoundingClientRect().width,
    viewportWidth: document.documentElement.clientWidth,
    hasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1
  }));
  if (layout.viewportWidth > 700) expect(layout.dialogWidth).toBeGreaterThanOrEqual(740);
  else expect(layout.dialogWidth).toBeGreaterThanOrEqual(layout.viewportWidth - 2);
  expect(layout.hasHorizontalOverflow).toBe(false);

  await dialog.locator(".profile-badges > summary").click();
  await expect(dialog.locator(".profile-badges")).toHaveAttribute("open", "");
  await expect(dialog.locator(".badge-shelf")).toBeVisible();

  await dialog.locator(".profile-preferences > summary").click();
  await expect(dialog.locator(".profile-preferences")).toHaveAttribute("open", "");
  await expect(dialog.locator(".profile-badges")).not.toHaveAttribute("open", "");

  await dialog.locator(".profile-data > summary").click();
  await expect(dialog.locator(".profile-data")).toHaveAttribute("open", "");
  await expect(dialog.locator(".profile-preferences")).not.toHaveAttribute("open", "");
  await dialog.locator(".diagnostics-preference").scrollIntoViewIfNeeded();
  if (layout.viewportWidth <= 700) {
    const closeButton = await dialog.locator(".modal-close").boundingBox();
    expect(closeButton).not.toBeNull();
    expect(closeButton.y).toBeGreaterThanOrEqual(0);
    expect(closeButton.y + closeButton.height).toBeLessThanOrEqual(568);
  }
});
