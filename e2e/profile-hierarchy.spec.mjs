import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/player", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        player: {
          id: "profile-menu-e2e",
          callsign: "Menu Stargazer",
          credits: 0,
          vault: [],
          cosmeticOwnership: {}
        }
      })
    });
  });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("profile-hierarchy-seeded") === "true") return;
    localStorage.clear();
    sessionStorage.clear();
    const profile = {
      version: 8,
      wins: 1,
      playerId: "profile-menu-e2e",
      playerToken: "profile-menu-e2e-token",
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true }
    };
    localStorage.setItem("constellore-profile-v1", JSON.stringify(profile));
    localStorage.setItem("constellore-local-profile-v1", JSON.stringify(profile));
    sessionStorage.setItem("profile-hierarchy-seeded", "true");
  });
  await installSeenIntroFixture(page);
});

test("the Rank control stays recognizable at every responsive header width", async ({ page }) => {
  await page.goto("/play/");
  const rankButton = page.locator("#profileButton");
  const rankLabel = rankButton.locator(".profile-label");
  const rankKind = rankButton.locator(".profile-chip__kind");
  const rankMark = rankButton.locator(".profile-chip__mark");

  for (const width of [320, 350, 390, 436, 520, 521, 700, 701, 760, 1024]) {
    await page.setViewportSize({ width, height: 720 });
    const geometry = await rankButton.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      const label = button.querySelector(".profile-label");
      const mark = button.querySelector(".profile-chip__mark");
      return {
        viewportWidth: document.documentElement.clientWidth,
        left: bounds.left,
        right: bounds.right,
        width: bounds.width,
        height: bounds.height,
        borderStyle: getComputedStyle(button).borderStyle,
        labelDisplay: getComputedStyle(label).display,
        labelWidth: label.getBoundingClientRect().width,
        markDisplay: getComputedStyle(mark).display,
        markWidth: mark.getBoundingClientRect().width
      };
    });

    await expect(rankKind, `${width}px Rank kind`).toHaveText("Rank");
    await expect(rankKind, `${width}px Rank kind visibility`).toBeVisible();
    await expect(rankLabel, `${width}px Rank value`).toHaveText("Bronze");
    await expect(rankLabel, `${width}px Rank value visibility`).toBeVisible();
    await expect(rankMark, `${width}px Rank mark`).toBeVisible();
    expect(geometry.left, `${width}px left edge`).toBeGreaterThanOrEqual(0);
    expect(geometry.right, `${width}px right edge`).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.width, `${width}px button width`).toBeGreaterThanOrEqual(96);
    expect(geometry.height, `${width}px touch target`).toBeGreaterThanOrEqual(44);
    expect(geometry.borderStyle, `${width}px button border`).toBe("solid");
    expect(geometry.labelDisplay, `${width}px label display`).not.toBe("none");
    expect(geometry.labelWidth, `${width}px label width`).toBeGreaterThan(24);
    expect(geometry.markDisplay, `${width}px mark display`).toBe("grid");
    expect(geometry.markWidth, `${width}px mark width`).toBeGreaterThanOrEqual(25);
  }

  await expect(page.locator("#cosmosCircuitHomeButton")).toBeHidden();
  await page.locator("#hubMenuButton").click();
  await expect(page.locator("#cosmosCircuitButton")).toBeHidden();
  await expect(page.locator("#starPathButton")).toBeHidden();
  await expect(page.locator('link[data-optional-surface^="cosmos-circuit.css"]')).toHaveCount(0);
});

test("the player constellation is glanceable before secondary detail is requested", async ({ page }, testInfo) => {
  if (testInfo.project.name.includes("mobile")) await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/play/");
  await page.locator("#profileButton").click();

  const dialog = page.locator("#profileDialog");
  await expect(dialog).toHaveJSProperty("open", true);
  await expect(dialog.getByRole("heading", { name: "Your progress" })).toBeVisible();
  await expect(dialog.locator(".profile-route-rank")).toBeVisible();
  await expect(dialog.locator("#profileRouteRankName")).toHaveText("Bronze");
  await expect(dialog.locator("#profileRouteRankMeter")).toHaveAttribute("role", "progressbar");
  await expect(dialog.locator(".profile-overview")).toBeVisible();
  await expect(dialog.locator(".profile-core-grid")).toBeVisible();
  await expect(dialog.locator(".progression-dashboard")).toBeHidden();
  await expect(dialog.locator(".profile-more")).toBeHidden();

  await expect(dialog.locator(".profile-preferences, .profile-data, .profile-account")).toHaveCount(0);
  await expect(dialog.locator(".profile-archive")).toBeHidden();
  await expect(dialog.locator(".profile-badges")).toBeHidden();
  await expect(dialog.locator(".badge-shelf")).toBeHidden();

  const layout = await dialog.evaluate((element) => ({
    dialogWidth: element.getBoundingClientRect().width,
    viewportWidth: document.documentElement.clientWidth,
    hasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1
  }));
  if (layout.viewportWidth > 700) {
    expect(layout.dialogWidth).toBeGreaterThanOrEqual(680);
    expect(layout.dialogWidth).toBeLessThanOrEqual(740);
  } else {
    expect(layout.dialogWidth).toBeGreaterThanOrEqual(layout.viewportWidth - 2);
  }
  expect(layout.hasHorizontalOverflow).toBe(false);

  if (layout.viewportWidth <= 700) {
    const closeButton = await dialog.locator(".modal-close").boundingBox();
    expect(closeButton).not.toBeNull();
    expect(closeButton.y).toBeGreaterThanOrEqual(0);
    expect(closeButton.y + closeButton.height).toBeLessThanOrEqual(568);
  }

  await dialog.locator(".modal-close").click();
  const hubMenuButton = page.getByRole("button", { name: "Open main menu" });
  await expect(hubMenuButton).toHaveAttribute("aria-controls", "hubMenuDialog");
  await expect(hubMenuButton).toHaveAttribute("aria-haspopup", "dialog");
  await hubMenuButton.click();
  const menu = page.locator("#hubMenuDialog");
  await expect(menu).toHaveJSProperty("open", true);
  await expect(menu.getByRole("heading", { name: "Settings and data" })).toBeVisible();
  await menu.locator(".profile-preferences > summary").click();
  const resultDetailsPreference = menu.locator("#resultDetailsPreference");
  await expect(resultDetailsPreference).toHaveAttribute("aria-pressed", "false");
  await resultDetailsPreference.click();
  await expect(resultDetailsPreference).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => {
    const raw = localStorage.getItem("constellore-profile-v1") || localStorage.getItem("constellore-local-profile-v1");
    return JSON.parse(raw || "null")?.feedbackPreferences?.resultDetails;
  })).toBe(true);
  await expect(page.locator("#resultDetails")).not.toHaveAttribute("hidden", "");

  for (const [id, outputId, value, label] of [
    ["masterVolumePreference", "masterVolumeValue", "0.4", "40%"],
    ["musicVolumePreference", "musicVolumeValue", "0.65", "65%"],
    ["sfxVolumePreference", "sfxVolumeValue", "0.3", "30%"]
  ]) {
    await menu.locator(`#${id}`).evaluate((input, nextValue) => {
      input.value = nextValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    await expect(menu.locator(`#${outputId}`)).toHaveText(label);
  }
  expect(await page.evaluate(() => {
    const raw = localStorage.getItem("constellore-profile-v1") || localStorage.getItem("constellore-local-profile-v1");
    const preferences = JSON.parse(raw || "null")?.feedbackPreferences;
    return [preferences?.volume, preferences?.musicVolume, preferences?.sfxVolume];
  })).toEqual([.4, .65, .3]);

  await page.reload();
  await page.locator("#hubMenuButton").click();
  await page.locator("#hubMenuDialog .profile-preferences > summary").click();
  await expect(page.locator("#masterVolumePreference")).toHaveValue("0.4");
  await expect(page.locator("#musicVolumePreference")).toHaveValue("0.65");
  await expect(page.locator("#sfxVolumePreference")).toHaveValue("0.3");
});
