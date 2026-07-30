import { expect, test } from "@playwright/test";

import { SCENE_PRELOAD_MEDIA } from "../scripts/cosmetic-preload-bootstrap-audit.mjs";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

async function openObservatory(page) {
  const shortcut = page.locator("#customizeButton");
  if (await shortcut.isVisible()) {
    await shortcut.click();
    return;
  }
  await page.locator("#hubMenuButton").click();
  await expect(page.locator("#hubMenuDialog")).toHaveJSProperty("open", true);
  await page.locator("#openObservatory").click();
}

test("Home preload media selects exactly one asset around the inclusive 6:5 boundary", async ({ page }) => {
  for (const width of [1199, 1200, 1201]) {
    await page.setViewportSize({ width, height: 1000 });
    const matches = await page.evaluate(
      (queries) => queries.map((query) => matchMedia(query).matches),
      SCENE_PRELOAD_MEDIA.home
    );

    expect(matches.filter(Boolean), `${width}×1000 must match exactly one Home preload`).toHaveLength(1);
    expect(matches[0], `${width}×1000 must preserve the narrow Home-art boundary`).toBe(width <= 1200);
  }
});

test("the compact Observatory keeps its live preview and commit controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    const profile = {
      version: 8,
      wins: 1,
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true }
    };
    localStorage.setItem("constellore-profile-v1", JSON.stringify(profile));
    localStorage.setItem("constellore-local-profile-v1", JSON.stringify(profile));
  });
  await installSeenIntroFixture(page);
  await page.goto("/play/");
  await openObservatory(page);

  const observatory = page.locator(".cosmetics-observatory");
  await expect(observatory).toHaveJSProperty("open", true);
  const layout = await observatory.evaluate((dialog) => {
    const surface = dialog.querySelector(".cosmetics-observatory__surface");
    const board = dialog.querySelector(".cosmetics-observatory__mini-board");
    const rank = dialog.querySelector(".cosmetics-observatory__preview-rank");
    const caption = dialog.querySelector(".cosmetics-observatory__preview-caption");
    const footer = dialog.querySelector(".cosmetics-observatory__footer");
    const footerRect = footer.getBoundingClientRect();
    const buttons = [...footer.querySelectorAll("button")].map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    return {
      horizontalOverflow: surface.scrollWidth > surface.clientWidth + 1,
      scrollable: surface.scrollHeight > surface.clientHeight,
      boardHeight: board.getBoundingClientRect().height,
      rankDisplay: getComputedStyle(rank).display,
      captionDisplay: getComputedStyle(caption).display,
      footerHeight: footerRect.height,
      footerBottom: footerRect.bottom,
      viewportHeight: document.documentElement.clientHeight,
      buttons
    };
  });

  expect(layout.horizontalOverflow).toBe(false);
  expect(layout.scrollable).toBe(true);
  expect(layout.boardHeight).toBeLessThanOrEqual(90);
  expect(layout.rankDisplay).toBe("none");
  expect(layout.captionDisplay).toBe("none");
  expect(layout.footerHeight).toBeLessThanOrEqual(100);
  expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.buttons).toHaveLength(2);
  expect(layout.buttons.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
});

test("a piece preview closes Customize, shows the real frozen surface, and returns to its staged card", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.removeItem("constellore-active-run-v1");
    localStorage.removeItem("constellore-local-active-run-v1");
    const profile = {
      version: 8,
      wins: 1,
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true }
    };
    localStorage.setItem("constellore-profile-v1", JSON.stringify(profile));
    localStorage.setItem("constellore-local-profile-v1", JSON.stringify(profile));
  });
  await installSeenIntroFixture(page);
  await page.goto("/play/");
  await openObservatory(page);

  const observatory = page.locator(".cosmetics-observatory");
  await observatory.getByRole("tab", { name: "Pieces" }).click();
  await observatory.getByRole("button", { name: /Main-menu backgrounds/ }).click();
  const reef = observatory.locator('[data-item-id="constellore.bubble-reef.home-scene.reef-observatory"]');
  const storedBefore = await page.evaluate(() => {
    const keys = ["constellore-profile-v1", "constellore-local-profile-v1"];
    return keys.map((key) => JSON.parse(localStorage.getItem(key) || "null")?.cosmetics || null);
  });
  await reef.getByRole("button", { name: "Preview piece" }).click();

  const worldPreview = page.locator("#cosmeticWorldPreview");
  await expect(observatory).toHaveJSProperty("open", false);
  await expect(worldPreview).toHaveJSProperty("open", true);
  await expect(page.locator("body")).toHaveAttribute("data-cosmetic-preview-surface", "home");
  await expect(page.locator("body")).toHaveClass(/cosmetic-home-scene--reef-observatory/);
  await expect(page.locator("#startScreen")).toHaveJSProperty("hidden", false);
  await expect(page.locator("#startScreen")).toHaveAttribute("inert", "");
  await expect(page.locator("#gameScreen")).toHaveJSProperty("hidden", true);
  await expect(page.locator("#cosmicGate")).toHaveJSProperty("hidden", true);
  await expect(page.locator("#cosmeticPreviewExit")).toBeFocused();
  await expect(page.locator("#cosmeticPreviewSurfaces")).toBeHidden();

  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest("#cosmeticWorldPreview")?.id)).toBe("cosmeticWorldPreview");
  const storedDuring = await page.evaluate(() => {
    const keys = ["constellore-profile-v1", "constellore-local-profile-v1"];
    return keys.map((key) => JSON.parse(localStorage.getItem(key) || "null")?.cosmetics || null);
  });
  expect(storedDuring).toEqual(storedBefore);

  await page.keyboard.press("Escape");
  await expect(worldPreview).toHaveJSProperty("open", false);
  await expect(observatory).toHaveJSProperty("open", true);
  await expect(observatory).toHaveAttribute("data-preview-mode", "false");
  await expect(observatory.getByRole("heading", { name: "Cosmetics Observatory" })).toBeVisible();
  await expect(reef.getByRole("button", { name: "Previewing" })).toBeFocused();
  await expect(observatory.getByText("Locked previews cannot be equipped.")).toBeVisible();

  await observatory.getByRole("button", { name: "Close Cosmetics Observatory" }).click();
  await expect(observatory).toHaveJSProperty("open", false);
  await expect(page.locator("body")).not.toHaveClass(/cosmetic-home-scene--reef-observatory/);
});

test("piece previews route to the frozen Board, Gate, and Menu surfaces", async ({ page }, testInfo) => {
  const mobileProject = testInfo.project.name.includes("mobile");
  await page.setViewportSize(mobileProject
    ? { width: 390, height: 844 }
    : { width: 1180, height: 820 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.removeItem("constellore-active-run-v1");
    localStorage.removeItem("constellore-local-active-run-v1");
    const profile = {
      version: 8,
      wins: 1,
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true }
    };
    localStorage.setItem("constellore-profile-v1", JSON.stringify(profile));
    localStorage.setItem("constellore-local-profile-v1", JSON.stringify(profile));
  });
  await installSeenIntroFixture(page);
  await page.goto("/play/");
  await openObservatory(page);

  const observatory = page.locator(".cosmetics-observatory");
  const worldPreview = page.locator("#cosmeticWorldPreview");
  const body = page.locator("body");
  await observatory.getByRole("tab", { name: "Pieces" }).click();

  const destinations = [
    {
      category: /Board backgrounds & finishes/,
      itemId: "constellore.bubble-reef.board-finish.coral-storybook",
      surface: "board",
      bodyClass: "cosmetic-board-finish--coral-storybook",
      exit: "button"
    },
    {
      category: /Opening gates/,
      itemId: "constellore.bubble-reef.gate-style.pearl-current",
      surface: "gate",
      bodyClass: "cosmetic-gate-style--pearl-current",
      exit: "escape"
    },
    {
      category: /Menu finishes/,
      itemId: "constellore.bubble-reef.ui-finish.coral-pop",
      surface: "menu",
      bodyClass: "cosmetic-ui-finish--coral-pop",
      exit: "button"
    }
  ];

  for (const destination of destinations) {
    await observatory.getByRole("button", { name: destination.category }).click();
    const card = observatory.locator(`[data-item-id="${destination.itemId}"]`);
    await card.getByRole("button", { name: "Preview piece" }).click();

    await expect(observatory).toHaveJSProperty("open", false);
    await expect(worldPreview).toHaveJSProperty("open", true);
    await expect(body).toHaveAttribute("data-cosmetic-preview-surface", destination.surface);
    await expect(body).toHaveClass(new RegExp(destination.bodyClass));
    await expect(page.locator("#cosmeticPreviewExit")).toBeFocused();

    if (destination.surface === "board") {
      await expect(page.locator("#startScreen")).toHaveJSProperty("hidden", true);
      await expect(page.locator("#gameScreen")).toHaveJSProperty("hidden", false);
      await expect(page.locator("#gameScreen")).toHaveAttribute("inert", "");
      await expect(page.locator("#board")).toBeVisible();
      await expect(page.locator("#cosmeticPreviewBoardSample")).toBeVisible();
      await expect(page.locator("#cosmicGate")).toHaveJSProperty("hidden", true);
    } else if (destination.surface === "gate") {
      await expect(page.locator("#startScreen")).toHaveJSProperty("hidden", false);
      await expect(page.locator("#startScreen")).toHaveAttribute("inert", "");
      await expect(page.locator("#gameScreen")).toHaveJSProperty("hidden", true);
      await expect(page.locator("#cosmicGate")).toHaveJSProperty("hidden", false);
      await expect(page.locator("#cosmicGate")).toHaveAttribute("inert", "");
      await expect(page.locator("#cosmicGate")).toHaveAttribute("data-phase", "closed");
      await expect(page.locator("#cosmicGate")).toHaveAttribute("data-content", "hidden");
    } else {
      await expect(page.locator("#startScreen")).toHaveJSProperty("hidden", false);
      await expect(page.locator("#startScreen")).toHaveAttribute("inert", "");
      await expect(page.locator("#gameScreen")).toHaveJSProperty("hidden", true);
      await expect(page.locator("#cosmicGate")).toHaveJSProperty("hidden", true);
      await expect(page.locator("#hubMenuDialog")).toHaveJSProperty("open", true);
      await expect(page.locator("#hubMenuDialog")).toHaveAttribute("inert", "");
      await expect(page.locator("#hubMenuDialog")).toBeVisible();
    }

    if (destination.exit === "escape") await page.keyboard.press("Escape");
    else await page.locator("#cosmeticPreviewExit").click();

    await expect(worldPreview).toHaveJSProperty("open", false);
    await expect(observatory).toHaveJSProperty("open", true);
    await expect(body).not.toHaveAttribute("data-cosmetic-preview-surface", destination.surface);
    await expect(card.getByRole("button", { name: "Previewing" })).toBeFocused();
  }
});
