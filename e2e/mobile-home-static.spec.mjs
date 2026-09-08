import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const unfinishedFirstOrbitProfile = Object.freeze({
  version: 8,
  wins: 0,
  firstOrbit: { seen: true, completed: false },
  secondOrbit: { seen: false, completed: false }
});

const viewports = [
  { name: "small phone portrait", width: 320, height: 568, compactHeader: true },
  { name: "compact phone portrait", width: 360, height: 800, compactHeader: true },
  { name: "modern phone portrait", width: 390, height: 844, compactHeader: true },
  { name: "large phone portrait", width: 430, height: 932, compactHeader: true },
  { name: "short phone landscape", width: 568, height: 320, compactHeader: true },
  { name: "desktop observatory", width: 1440, height: 900, compactHeader: false }
];

function rectanglesOverlap(first, second, tolerance = 1) {
  return first.left < second.right - tolerance
    && first.right > second.left + tolerance
    && first.top < second.bottom - tolerance
    && first.bottom > second.top + tolerance;
}

function rectangleInsideViewport(rectangle, viewport, tolerance = 1) {
  return rectangle.left >= -tolerance
    && rectangle.right <= viewport.width + tolerance
    && rectangle.top >= -tolerance
    && rectangle.bottom <= viewport.height + tolerance;
}

test.beforeEach(async ({ page }) => {
  const profile = JSON.stringify(unfinishedFirstOrbitProfile);
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", profile],
      ["constellore-local-profile-v1", profile]
    ]
  });
});

for (const viewport of viewports) {
  test(`unfinished local-practice home stays composed at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/play/?birthday=off");

    const runtime = await page.locator("body").getAttribute("data-runtime");
    test.skip(runtime !== "local-practice", "This regression targets the built Pages/itch local-practice surface.");

    await expect(page.locator("body")).toHaveAttribute("data-home-stage", "onboarding");
    await expect(page.locator("#startScreen")).toBeVisible();
    await expect(page.locator("#cosmicGate")).toBeHidden();
    await expect(page.locator(".first-open-cinematic")).toHaveCount(0);
    await expect(page.locator("#practiceBanner")).toBeVisible();
    await expect(page.locator("#homeOrbitForge")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#primaryOrbitKicker")).toHaveText("Continue playing");
    await expect(page.locator("#primaryOrbitTitle")).toHaveText("Return to Mud");
    await expect(page.locator("#primaryOrbitTitle")).toBeVisible();
    await expect(page.locator("#primaryOrbitButton")).toHaveAccessibleName("Continue playing");
    await expect(page.locator("#primaryOrbitButton")).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);

    const layout = await page.locator("#startScreen").evaluate((startScreen) => {
      const select = (selector) => startScreen.querySelector(selector);
      const visible = (element) => {
        if (!element) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && !element.hidden
          && rect.width > 0
          && rect.height > 0;
      };
      const rectangle = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left, top: rect.top, right: rect.right,
          bottom: rect.bottom, width: rect.width, height: rect.height
        };
      };
      const details = (selector) => {
        const element = select(selector);
        return {
          ...rectangle(element),
          visible: visible(element),
          text: element.textContent.replace(/\s+/g, " ").trim(),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize)
        };
      };
      const visibleHeaderButtons = [...startScreen.querySelectorAll(".start-actions > button")]
        .filter(visible)
        .map((button) => ({
          id: button.id,
          ...rectangle(button),
          ariaLabel: button.getAttribute("aria-label") || "",
          visibleText: [...button.querySelectorAll("b, .profile-chip__kind, .profile-label")]
            .filter(visible)
            .map((element) => element.textContent.trim())
            .filter(Boolean)
        }));
      return {
        viewport: {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight
        },
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        banner: details("#practiceBanner"),
        bannerLink: details("#practiceBanner > a"),
        bannerStatus: details("#practiceBanner > span"),
        bannerStatusLines: [...select("#practiceBanner > span").children].filter(visible).length,
        nav: details(".start-nav"),
        brand: details(".brand"),
        brandName: details(".brand-name"),
        actions: details(".start-actions"),
        customize: details("#customizeButton"),
        profile: details("#profileButton"),
        profileKind: details("#profileButton .profile-chip__kind"),
        profileLabel: details("#profileButton .profile-label"),
        menu: details("#hubMenuButton"),
        orbitPanel: details(".primary-orbit-panel"),
        kicker: details("#primaryOrbitKicker"),
        title: details("#primaryOrbitTitle"),
        description: details("#primaryOrbitDescription"),
        continueButton: details("#primaryOrbitButton"),
        continueLabel: details("#primaryOrbitButton > span"),
        visibleHeaderButtons
      };
    });

    expect(layout.documentWidth, "the static home must not create horizontal page overflow")
      .toBeLessThanOrEqual(layout.viewport.width + 1);
    expect(layout.banner.height, "the local-practice notice must remain a compact utility bar")
      .toBeLessThanOrEqual(64);
    expect(layout.bannerStatus.scrollWidth, "the local-practice status must not clip horizontally")
      .toBeLessThanOrEqual(layout.bannerStatus.clientWidth + 1);
    expect(layout.bannerStatus.scrollHeight, "the local-practice status must not clip vertically")
      .toBeLessThanOrEqual(layout.bannerStatus.clientHeight + 1);
    expect(layout.bannerStatusLines, "the status must use no more than two compact lines")
      .toBeLessThanOrEqual(2);
    expect(rectanglesOverlap(layout.bannerLink, layout.bannerStatus), "Website and status must not overlap")
      .toBe(false);

    expect(layout.brandName.visible, "Constellore must remain visibly branded").toBe(true);
    expect(layout.brandName.text).toMatch(/^Constellore$/i);
    expect(layout.profileKind.text).toBe("Rank");
    expect(layout.profileLabel.text).toBe("Bronze");
    expect(layout.profileKind.visible).toBe(!viewport.compactHeader);
    expect(layout.profileLabel.visible).toBe(!viewport.compactHeader);
    expect(layout.customize.visible, "compact headers keep Cosmetic Lab accessible through Menu")
      .toBe(!viewport.compactHeader);
    expect(layout.menu.visible, "Menu must remain available during First Orbit").toBe(true);
    await expect(page.locator("#profileButton")).toHaveAccessibleName(/Bronze Route Rank/i);
    await expect(page.locator("#hubMenuButton")).toHaveAccessibleName("Open main menu");
    for (const button of layout.visibleHeaderButtons) {
      expect(button.width, `${button.id} must meet the touch-target width floor`).toBeGreaterThanOrEqual(44);
      expect(button.height, `${button.id} must meet the touch-target height floor`).toBeGreaterThanOrEqual(44);
      expect(button.visibleText.length > 0 || button.ariaLabel.length > 0,
        `${button.id} must retain an accessible identity`).toBe(true);
    }

    for (const [name, rectangle] of [
      ["practice banner", layout.banner], ["Website", layout.bannerLink],
      ["home navigation", layout.nav], ["brand", layout.brand],
      ["header actions", layout.actions], ["primary orbit", layout.orbitPanel],
      ["target title", layout.title], ["Continue", layout.continueButton]
    ]) {
      expect(rectangleInsideViewport(rectangle, layout.viewport),
        `${name} must remain fully visible without scrolling`).toBe(true);
    }
    expect(rectanglesOverlap(layout.brand, layout.actions), "brand and header actions must not overlap")
      .toBe(false);
    expect(layout.banner.bottom, "navigation must follow the practice banner")
      .toBeLessThanOrEqual(layout.nav.top + 1);
    expect(layout.nav.bottom, "the active destination card must clear the navigation")
      .toBeLessThanOrEqual(layout.orbitPanel.top + 1);

    // The planet fills the viewport. Its active card stacks on portrait/desktop
    // and places title beside the action on short landscape screens.
    const visiblePrimaryContent = [layout.kicker, layout.title, layout.description, layout.continueButton]
      .filter((item) => item.visible);
    for (const [index, item] of visiblePrimaryContent.entries()) {
      expect(item.scrollWidth, `${item.text} must not clip horizontally`)
        .toBeLessThanOrEqual(item.clientWidth + 1);
      for (const other of visiblePrimaryContent.slice(index + 1)) {
        expect(rectanglesOverlap(item, other), `${item.text} must not overlap ${other.text}`).toBe(false);
      }
    }
    expect(layout.title.fontSize, "the target remains the readable primary heading").toBeGreaterThanOrEqual(24);
    expect(layout.continueLabel.fontSize, "the primary action label remains readable").toBeGreaterThanOrEqual(14);
    expect(layout.continueButton.width).toBeGreaterThanOrEqual(44);
    expect(layout.continueButton.height).toBeGreaterThanOrEqual(44);
    expect(layout.continueLabel.top, "the action label must fit vertically inside its button")
      .toBeGreaterThanOrEqual(layout.continueButton.top - 1);
    expect(layout.continueLabel.bottom, "the action label must fit vertically inside its button")
      .toBeLessThanOrEqual(layout.continueButton.bottom + 1);

    await page.locator("#profileButton").click({ trial: true });
    await page.locator("#hubMenuButton").click({ trial: true });
    await page.locator("#primaryOrbitButton").click({ trial: true });
    await page.locator("#primaryOrbitButton").focus();
    await expect(page.locator("#primaryOrbitButton")).toBeFocused();
  });
}
