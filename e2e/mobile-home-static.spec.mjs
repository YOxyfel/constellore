import { expect, test } from "@playwright/test";
import {
  FIRST_OPEN_CINEMATIC_SESSION_KEY,
  FIRST_OPEN_CINEMATIC_STORAGE_KEY
} from "./intro-fixture.mjs";

const unfinishedFirstOrbitProfile = Object.freeze({
  version: 8,
  wins: 0,
  firstOrbit: { seen: true, completed: false },
  secondOrbit: { seen: false, completed: false }
});

const viewports = [
  { name: "small phone portrait", width: 320, height: 568, continueAboveFold: true },
  { name: "compact phone portrait", width: 360, height: 800, continueAboveFold: true },
  { name: "modern phone portrait", width: 390, height: 844, continueAboveFold: true },
  { name: "large phone portrait", width: 430, height: 932, continueAboveFold: true },
  { name: "short phone landscape", width: 568, height: 320 }
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
    && rectangle.top >= -tolerance;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.clear();
    sessionStorage.clear();

    const profile = JSON.stringify(fixture.profile);
    localStorage.setItem("constellore-profile-v1", profile);
    localStorage.setItem("constellore-local-profile-v1", profile);
    localStorage.removeItem("constellore-active-run-v1");
    localStorage.removeItem("constellore-local-active-run-v1");
    sessionStorage.removeItem("constellore-scramble-active-v1");

    localStorage.setItem(fixture.cinematicStorageKey, JSON.stringify({
      schemaVersion: 1,
      completed: true,
      completedAt: "2026-01-01T00:00:00.000Z"
    }));
    sessionStorage.setItem(fixture.cinematicSessionKey, "played");
  }, {
    profile: unfinishedFirstOrbitProfile,
    cinematicStorageKey: FIRST_OPEN_CINEMATIC_STORAGE_KEY,
    cinematicSessionKey: FIRST_OPEN_CINEMATIC_SESSION_KEY
  });
});

for (const viewport of viewports) {
  test(`unfinished local-practice home stays composed at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/play/");

    const runtime = await page.locator("body").getAttribute("data-runtime");
    test.skip(runtime !== "local-practice", "This regression targets the built Pages/itch local-practice surface.");

    await expect(page.locator("body")).toHaveAttribute("data-home-stage", "onboarding");
    await expect(page.locator("#startScreen")).toBeVisible();
    await expect(page.locator("#cosmicGate")).toBeHidden();
    await expect(page.locator(".first-open-cinematic")).toHaveCount(0);
    await expect(page.locator("#practiceBanner")).toBeVisible();
    await expect(page.locator("#primaryOrbitKicker")).toHaveText("ORBIT IN PROGRESS");
    await expect(page.locator("#primaryOrbitTitle")).toHaveText("Return to Mud");
    await expect(page.locator("#primaryOrbitButton")).toContainText("Continue");

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
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        };
      };
      const details = (selector) => {
        const element = select(selector);
        const style = getComputedStyle(element);
        const rect = rectangle(element);
        const lineHeight = Number.parseFloat(style.lineHeight);
        return {
          ...rect,
          visible: visible(element),
          text: element.textContent.replace(/\s+/g, " ").trim(),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          lineHeight: Number.isFinite(lineHeight) ? lineHeight : 0
        };
      };

      const viewport = {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight
      };
      const documentWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth
      );
      const visibleHeaderButtons = [...startScreen.querySelectorAll(".start-actions > button")]
        .filter(visible)
        .map((button) => {
          const visibleText = [...button.querySelectorAll("b, .profile-chip__kind, .profile-label")]
            .filter(visible)
            .map((element) => element.textContent.trim())
            .filter(Boolean);
          return {
            id: button.id,
            ...rectangle(button),
            visibleText
          };
        });

      return {
        viewport,
        documentWidth,
        banner: details("#practiceBanner"),
        bannerLink: details("#practiceBanner > a"),
        bannerStatus: details("#practiceBanner > span"),
        bannerStatusLines: [...select("#practiceBanner > span").children].filter(visible).length,
        nav: details(".start-nav"),
        brand: details(".brand"),
        brandName: details(".brand-name"),
        actions: details(".start-actions"),
        customize: details("#customizeButton"),
        customizeLabel: details("#customizeButton > b"),
        profile: details("#profileButton"),
        profileKind: details("#profileButton .profile-chip__kind"),
        profileLabel: details("#profileButton .profile-label"),
        menu: details("#hubMenuButton"),
        hero: details(".hero-row"),
        kicker: details(".hero-kicker"),
        title: details("#startTitle"),
        promise: details(".hero-promise"),
        forge: details(".hero-forge"),
        orbitPanel: details(".primary-orbit-panel"),
        continueButton: details("#primaryOrbitButton"),
        visibleHeaderButtons
      };
    });

    expect(layout.documentWidth, "the static home must not create horizontal page overflow")
      .toBeLessThanOrEqual(layout.viewport.width + 1);
    expect(layout.title.text, "the responsive hero title must retain its word boundary")
      .toBe("Make worlds out of words.");

    expect(layout.banner.height, "the local-practice notice must remain a compact utility bar")
      .toBeLessThanOrEqual(64);
    expect(layout.bannerStatus.scrollWidth, "the local-practice status must not clip horizontally")
      .toBeLessThanOrEqual(layout.bannerStatus.clientWidth + 1);
    expect(layout.bannerStatus.scrollHeight, "the local-practice status must not clip vertically")
      .toBeLessThanOrEqual(layout.bannerStatus.clientHeight + 1);
    expect(
      layout.bannerStatusLines,
      "the local-practice status must use no more than two compact lines"
    ).toBeLessThanOrEqual(2);
    expect(
      rectanglesOverlap(layout.bannerLink, layout.bannerStatus),
      "Website and the local-practice status must never overlap"
    ).toBe(false);

    expect(layout.brandName.visible, "CONSTELLORE must remain visibly branded on phone").toBe(true);
    expect(layout.brandName.text).toBe("CONSTELLORE");
    expect(layout.profileKind.visible, "the Route Rank control must visibly identify itself").toBe(true);
    expect(layout.profileKind.text).toBe("Rank");
    expect(layout.profileLabel.visible, "the current Route Rank must remain legible").toBe(true);
    expect(layout.profileLabel.text).toBe("Bronze");
    expect(layout.profile.scrollWidth, "the Rank control must not clip its label")
      .toBeLessThanOrEqual(layout.profile.clientWidth + 1);
    expect(layout.profile.width).toBeGreaterThanOrEqual(44);
    expect(layout.profile.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator("#profileButton")).toHaveAccessibleName(/Bronze Route Rank/i);

    if (viewport.width <= 520) {
      expect(layout.customize.visible, "phone onboarding must not leave an unexplained icon-only Customize control")
        .toBe(false);
    } else {
      expect(layout.customize.visible, "wider layouts may retain the labeled Customize control").toBe(true);
      expect(layout.customizeLabel.visible, "a visible Customize control must keep its text label").toBe(true);
      expect(layout.customizeLabel.text).toBe("Customize");
    }
    expect(layout.menu.visible, "Menu remains progressively hidden during First Orbit").toBe(false);
    for (const button of layout.visibleHeaderButtons) {
      expect(button.width, `${button.id} must meet the touch-target width floor`).toBeGreaterThanOrEqual(44);
      expect(button.height, `${button.id} must meet the touch-target height floor`).toBeGreaterThanOrEqual(44);
      expect(button.visibleText.length, `${button.id} must not be a mystery icon-only control`).toBeGreaterThan(0);
    }

    for (const [name, rectangle] of [
      ["practice banner", layout.banner],
      ["home navigation", layout.nav],
      ["brand", layout.brand],
      ["header actions", layout.actions],
      ["hero", layout.hero],
      ["Continue", layout.continueButton]
    ]) {
      expect(
        rectangleInsideViewport(rectangle, layout.viewport),
        `${name} must stay within the viewport width`
      ).toBe(true);
    }

    expect(rectanglesOverlap(layout.brand, layout.actions), "brand and header actions must not overlap")
      .toBe(false);
    expect(layout.banner.bottom, "navigation must follow the compact practice banner")
      .toBeLessThanOrEqual(layout.nav.top + 1);
    expect(layout.nav.bottom, "the hero must begin below the navigation")
      .toBeLessThanOrEqual(layout.hero.top + 1);
    for (const [earlierName, earlier, laterName, later] of [
      ["kicker", layout.kicker, "title", layout.title],
      ["title", layout.title, "promise", layout.promise],
      ["promise", layout.promise, "recipe", layout.forge],
      ["recipe", layout.forge, "primary orbit", layout.orbitPanel]
    ]) {
      expect(
        earlier.bottom,
        `${earlierName} must finish before ${laterName} begins`
      ).toBeLessThanOrEqual(later.top + 1);
    }

    if (viewport.continueAboveFold) {
      expect(
        layout.continueButton.bottom,
        `${viewport.name}: Continue must be fully visible without scrolling`
      ).toBeLessThanOrEqual(layout.viewport.height + 1);
    }
  });
}
