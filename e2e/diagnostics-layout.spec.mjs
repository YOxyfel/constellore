import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("profile diagnostics actions remain readable in the desktop dialog", async ({ page }) => {
  // The original regression only appeared when the viewport was wide enough
  // to miss the mobile breakpoint while the profile dialog stayed narrow.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/play/");
  await page.locator("#profileDialog").evaluate((dialog) => {
    dialog.querySelector(".profile-data").open = true;
    dialog.showModal();
  });

  const card = page.locator(".diagnostics-preference");
  const preference = page.locator("#diagnosticsPreference");
  await expect(card).toBeVisible();
  await expect(preference).toBeVisible();

  const layout = await card.evaluate((section) => {
    const sectionRect = section.getBoundingClientRect();
    const buttons = [...section.querySelectorAll("button")];
    const epsilon = 1;
    return {
      sectionWidth: sectionRect.width,
      preferenceWidth: buttons[0].getBoundingClientRect().width,
      overflows: buttons.flatMap((button) => {
        const buttonRect = button.getBoundingClientRect();
        const contentOutsideButton = [...button.children].some((child) => {
          const childRect = child.getBoundingClientRect();
          return childRect.left < buttonRect.left - epsilon
            || childRect.right > buttonRect.right + epsilon
            || childRect.top < buttonRect.top - epsilon
            || childRect.bottom > buttonRect.bottom + epsilon;
        });
        const scrollOverflow = button.scrollWidth > button.clientWidth + epsilon
          || button.scrollHeight > button.clientHeight + epsilon;
        return contentOutsideButton || scrollOverflow ? [button.id] : [];
      })
    };
  });

  expect(layout.preferenceWidth).toBeGreaterThan(layout.sectionWidth * 0.85);
  expect(layout.overflows).toEqual([]);
});
