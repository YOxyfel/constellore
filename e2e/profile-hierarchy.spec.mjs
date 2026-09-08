import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

// This spec mocks account identity. Block the PWA worker so reload requests
// remain observable by Playwright instead of reaching the real test server.
test.use({ serviceWorkers: "block" });

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
  const profile = {
    version: 8,
    wins: 1,
    stardust: 12345,
    playerId: "profile-menu-e2e",
    playerToken: "profile-menu-e2e-token",
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true }
  };
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", JSON.stringify(profile)],
      ["constellore-local-profile-v1", JSON.stringify(profile)],
      ["constellore-profile-frame-v1", "ember-sovereign"],
      ["constellore-birthday-voyage-complete-v1", "2026-01-01T00:00:00.000Z"]
    ]
  });
});

test("the Rank control stays recognizable at every responsive header width", async ({ page }) => {
  await page.goto("/play/?birthday=off");
  const rankButton = page.locator("#profileButton");
  const stardustWallet = page.locator("#homeStardustWallet");
  const stardustValue = page.locator("#profileDust");
  const rankLabel = rankButton.locator(".profile-label");
  const rankKind = rankButton.locator(".profile-chip__kind");
  const rankMark = rankButton.locator(".profile-chip__mark");

  for (const width of [320, 350, 390, 436, 520, 568, 700, 760, 768, 887, 900, 901, 1024]) {
    await page.setViewportSize({ width, height: 720 });
    const geometry = await rankButton.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      const nav = button.closest(".start-nav");
      const navBounds = nav.getBoundingClientRect();
      const brandBounds = nav.querySelector(".brand").getBoundingClientRect();
      const brandName = nav.querySelector(".brand-name");
      const brandNameBounds = brandName.getBoundingClientRect();
      const lab = nav.querySelector("#customizeButton");
      const labBounds = lab.getBoundingClientRect();
      const wallet = nav.querySelector("#homeStardustWallet");
      const walletBounds = wallet.getBoundingClientRect();
      const menu = nav.querySelector("#hubMenuButton");
      const menuBounds = menu.getBoundingClientRect();
      const menuLabel = menu.querySelector("b");
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
        markWidth: mark.getBoundingClientRect().width,
        menuWidth: menuBounds.width,
        menuHeight: menuBounds.height,
        menuLabelDisplay: getComputedStyle(menuLabel).display,
        walletDisplay: getComputedStyle(wallet).display,
        walletLeft: walletBounds.left,
        walletRight: walletBounds.right,
        walletWidth: walletBounds.width,
        walletHeight: walletBounds.height,
        walletInsideNav: walletBounds.left >= navBounds.left - 1 && walletBounds.right <= navBounds.right + 1,
        brandEndsBeforeWallet: brandBounds.right <= walletBounds.left + 1,
        labVisible: labBounds.width > 0,
        labEndsBeforeWallet: labBounds.width === 0 || labBounds.right <= walletBounds.left + 1,
        walletEndsBeforeRank: walletBounds.right <= bounds.left + 1,
        rankEndsBeforeMenu: bounds.right <= menuBounds.left + 1,
        menuEndsBeforeBrand: menuBounds.right <= brandNameBounds.left + 1,
        brandEndsBeforeRank: brandNameBounds.right <= bounds.left + 1,
        brandTextContained: brandName.scrollWidth <= brandName.clientWidth + 1,
        documentHasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      };
    });
    const compact = width <= 900;

    await expect(rankKind, `${width}px Rank kind`).toHaveText("Rank");
    await expect(rankLabel, `${width}px Rank value`).toHaveText("Bronze");
    await expect(rankMark, `${width}px Rank mark`).toBeVisible();
    await expect(stardustWallet, `${width}px Stardust accessible value`).toHaveAttribute("aria-label", "12,345 Stardust available");
    await expect(stardustValue, `${width}px Stardust number`).toHaveText("12,345");
    await expect(rankButton, `${width}px accessible Rank identity`).toHaveAccessibleName(/Bronze Route Rank/i);
    expect(geometry.left, `${width}px left edge`).toBeGreaterThanOrEqual(0);
    expect(geometry.right, `${width}px right edge`).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.height, `${width}px touch target`).toBeGreaterThanOrEqual(44);
    expect(geometry.borderStyle, `${width}px button border`).toBe("solid");
    expect(geometry.markDisplay, `${width}px mark display`).toBe("grid");
    expect(geometry.markWidth, `${width}px mark width`).toBeGreaterThanOrEqual(25);
    expect(geometry.documentHasHorizontalOverflow, `${width}px document overflow`).toBe(false);

    if (compact) {
      await expect(rankKind, `${width}px compact Rank kind`).toBeHidden();
      await expect(rankLabel, `${width}px compact Rank value`).toBeHidden();
      await expect(stardustWallet, `${width}px compact Stardust moves into Menu`).toBeHidden();
      expect(geometry.width, `${width}px compact Rank orb`).toBeGreaterThanOrEqual(44);
      expect(geometry.width, `${width}px compact Rank orb`).toBeLessThanOrEqual(48);
      expect(geometry.walletDisplay, `${width}px hidden header wallet`).toBe("none");
      expect(geometry.labVisible, `${width}px Lab moves into Menu`).toBe(false);
      expect(geometry.menuWidth, `${width}px readable Menu width`).toBeGreaterThanOrEqual(74);
      expect(geometry.menuHeight, `${width}px Menu touch target`).toBeGreaterThanOrEqual(44);
      expect(geometry.menuLabelDisplay, `${width}px Menu label`).not.toBe("none");
      expect(geometry.menuEndsBeforeBrand, `${width}px Menu/brand separation`).toBe(true);
      expect(geometry.brandEndsBeforeRank, `${width}px brand/Rank separation`).toBe(true);
      expect(geometry.brandTextContained, `${width}px brand text containment`).toBe(true);
    } else {
      await expect(rankKind, `${width}px Rank kind visibility`).toBeVisible();
      await expect(rankLabel, `${width}px Rank value visibility`).toBeVisible();
      await expect(stardustWallet, `${width}px Stardust wallet`).toBeVisible();
      expect(geometry.width, `${width}px desktop Rank width`).toBeGreaterThanOrEqual(95);
      expect(geometry.labelDisplay, `${width}px label display`).not.toBe("none");
      expect(geometry.labelWidth, `${width}px label width`).toBeGreaterThan(24);
      expect(geometry.walletDisplay, `${width}px wallet display`).toBe("grid");
      expect(geometry.walletWidth, `${width}px wallet width`).toBeGreaterThanOrEqual(54);
      expect(geometry.walletHeight, `${width}px wallet touch rhythm`).toBeGreaterThanOrEqual(44);
      expect(geometry.walletInsideNav, `${width}px wallet nav containment`).toBe(true);
      expect(geometry.brandEndsBeforeWallet, `${width}px brand/wallet overlap`).toBe(true);
      expect(geometry.labEndsBeforeWallet, `${width}px Lab/wallet overlap`).toBe(true);
      expect(geometry.walletEndsBeforeRank, `${width}px wallet/Rank overlap`).toBe(true);
      expect(geometry.rankEndsBeforeMenu, `${width}px Rank/Menu overlap`).toBe(true);
    }
  }

  await expect(page.locator("#cosmosCircuitHomeButton")).toBeHidden();
  await page.locator("#hubMenuButton").click();
  await expect(page.locator("#hubStardustWallet")).toBeVisible();
  await expect(page.locator("#hubStardustWallet")).toHaveAttribute("aria-label", "12,345 Stardust available");
  await expect(page.locator("#hubStardust")).toHaveText("12,345");
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
  await expect(dialog.locator("#profileTotalDust")).toHaveText("12,345");
  await expect(dialog.locator(".profile-total > span")).toContainText("Stardust");
  await expect(dialog.locator(".progression-dashboard")).toBeHidden();
  await expect(dialog.locator(".profile-more")).toBeHidden();

  await expect(dialog.locator(":scope > [data-profile-frame-overlay]")).toHaveCount(0);
  await expect(dialog.locator(":scope > .profile-modal__viewport")).toHaveCount(0);
  await expect(dialog.getByText("Equipped profile frame", { exact: true })).toHaveCount(0);
  await expect(dialog.locator("#profileFrameEquipped, .profile-rank-frame-card")).toHaveCount(0);

  await expect(dialog.locator(".profile-preferences, .profile-data, .profile-account")).toHaveCount(0);
  await expect(dialog.locator(".profile-archive")).toBeHidden();
  await expect(dialog.locator(".profile-badges")).toBeHidden();
  await expect(dialog.locator(".badge-shelf")).toBeHidden();

  const layout = await dialog.evaluate((element) => {
    const dialogRect = element.getBoundingClientRect();
    const overviewRect = element.querySelector(".profile-overview").getBoundingClientRect();
    const grid = element.querySelector(".profile-core-grid");
    const cards = [...grid.children].map((card) => {
      const rect = card.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    });
    return {
      dialogWidth: dialogRect.width,
      viewportWidth: document.documentElement.clientWidth,
      dialogHasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      documentHasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      overview: { left: overviewRect.left, right: overviewRect.right, top: overviewRect.top, bottom: overviewRect.bottom },
      cards
    };
  });
  if (layout.viewportWidth > 700) {
    expect(layout.dialogWidth).toBeGreaterThanOrEqual(680);
    expect(layout.dialogWidth).toBeLessThanOrEqual(740);
  } else {
    expect(layout.dialogWidth).toBeGreaterThanOrEqual(layout.viewportWidth - 2);
  }
  expect(layout.dialogHasHorizontalOverflow).toBe(false);
  expect(layout.documentHasHorizontalOverflow).toBe(false);
  expect(layout.cards).toHaveLength(4);
  for (const card of layout.cards) {
    expect(card.width).toBeGreaterThan(0);
    expect(card.height).toBeGreaterThan(0);
    expect(card.left).toBeGreaterThanOrEqual(layout.overview.left - 1);
    expect(card.right).toBeLessThanOrEqual(layout.overview.right + 1);
    expect(card.top).toBeGreaterThanOrEqual(layout.overview.top - 1);
    expect(card.bottom).toBeLessThanOrEqual(layout.overview.bottom + 1);
  }
  if (layout.viewportWidth > 700) {
    expect(Math.max(...layout.cards.map((card) => card.top)) - Math.min(...layout.cards.map((card) => card.top))).toBeLessThanOrEqual(1);
    expect(Math.max(...layout.cards.map((card) => card.bottom)) - Math.min(...layout.cards.map((card) => card.bottom))).toBeLessThanOrEqual(1);
  } else {
    expect(Math.abs(layout.cards[0].top - layout.cards[1].top)).toBeLessThanOrEqual(1);
    expect(layout.cards[2].top).toBeGreaterThan(layout.cards[0].bottom);
  }

  // Arena-frame changes must not decorate or reshape the permanent Progress surface.
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent("constellore:profile-frame-change", {
      detail: { slug: "berry-burrow" }
    }));
  });
  await expect(dialog.locator(":scope > [data-profile-frame-overlay]")).toHaveCount(0);
  await expect(dialog).not.toHaveAttribute("data-profile-frame");

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

  if (testInfo.project.name.includes("webkit")) {
    await page.reload({ waitUntil: "domcontentloaded" });
  } else {
    await page.goto("/play/", { waitUntil: "domcontentloaded" });
  }
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("constellore-profile-v1")
      || localStorage.getItem("constellore-local-profile-v1");
    const preferences = JSON.parse(raw || "null")?.feedbackPreferences;
    return [preferences?.volume, preferences?.musicVolume, preferences?.sfxVolume];
  })).toEqual([.4, .65, .3]);

  const restoredMenu = page.locator("#hubMenuDialog");
  const restoredMenuButton = page.locator("#hubMenuButton");
  await expect(restoredMenuButton).toBeVisible();
  await restoredMenuButton.click();
  await expect(restoredMenu).toHaveJSProperty("open", true);
  await restoredMenu.locator(".profile-preferences > summary").click();
  await expect(restoredMenu.locator("#masterVolumePreference")).toHaveValue("0.4");
  await expect(restoredMenu.locator("#musicVolumePreference")).toHaveValue("0.65");
  await expect(restoredMenu.locator("#sfxVolumePreference")).toHaveValue("0.3");
});
