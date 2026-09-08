import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const REGRESSION_VIEWPORTS = [
  { name: "wide compact landscape", width: 887, height: 427, compactTarget: true, centeredTarget: true },
  {
    name: "short tablet landscape",
    width: 765,
    height: 238,
    compactTarget: true,
    centeredTarget: true,
    guardRequired: true,
    milestoneHidden: true
  },
  {
    name: "tablet portrait",
    width: 765,
    height: 1024,
    guardRequired: true
  },
  { name: "medium ultra-short landscape", width: 818, height: 284, compactTarget: true, centeredTarget: true, milestoneHidden: true },
  { name: "phone ultra-short landscape", width: 449, height: 221, sideInventory: true }
];

const intersects = (left, right, gap = 0) => !(
  left.right + gap <= right.left
  || right.right + gap <= left.left
  || left.bottom + gap <= right.top
  || right.bottom + gap <= left.top
);

const contains = (outer, inner, tolerance = 1) => (
  inner.left >= outer.left - tolerance
  && inner.right <= outer.right + tolerance
  && inner.top >= outer.top - tolerance
  && inner.bottom <= outer.bottom + tolerance
);

async function installReturningProfile(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    const profile = {
      version: 7,
      wins: 2,
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true }
    };
    localStorage.setItem("constellore-profile-v1", JSON.stringify(profile));
    localStorage.setItem("constellore-local-profile-v1", JSON.stringify(profile));
  });
  await installSeenIntroFixture(page);
}

async function startStressChallenge(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await installReturningProfile(page);
  await page.goto("/play/?challenge=1&target=Telescope&seed=73&birthday=off");
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true, { timeout: 30_000 });
  await page.locator("#beginMission").evaluate((button) => button.click());
  await expect(briefing).toHaveJSProperty("open", false, { timeout: 30_000 });
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#gameScreen")).toHaveAttribute("data-play-layout", /stacked|short-landscape|wide/);

  await page.evaluate(async () => {
    document.querySelector("#targetWord").textContent = "Horizon";
    const law = document.querySelector("#lawPill");
    law.hidden = false;
    law.className = "path-guard-status";
    law.textContent = "PATH GUARD · ON";
    await document.fonts?.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function geometry(page) {
  return page.evaluate(() => {
    const node = (selector) => document.querySelector(selector);
    const visible = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && bounds.width > 0 && bounds.height > 0;
    };
    const rectangle = (element) => {
      if (!visible(element)) return null;
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
        centerX: bounds.left + bounds.width / 2,
        centerY: bounds.top + bounds.height / 2
      };
    };

    const nav = node(".game-nav");
    const target = node(".game-target");
    const hud = node(".game-hud");
    const board = node("#board");
    const inventory = node(".inventory");
    const wordList = node("#wordList");
    const law = node("#lawPill");
    const targetStyle = getComputedStyle(target);
    const hudStyle = getComputedStyle(hud);
    const inventoryStyle = getComputedStyle(inventory);
    const wordListStyle = getComputedStyle(wordList);

    return {
      nav: rectangle(nav),
      menu: rectangle(node("#pauseRunButton")),
      target: rectangle(target),
      targetLabel: rectangle(node(".game-target strong")),
      law: rectangle(law),
      hud: rectangle(hud),
      sound: rectangle(node("#playVolumeControl")),
      board: rectangle(board),
      bloomTrigger: rectangle(node("#constellationBloomTrigger")),
      assistToggle: rectangle(node("#mobileAssistToggle")),
      assistanceRail: rectangle(node("#boardAssistanceRail")),
      toolbar: rectangle(node("#boardQuickTools")),
      milestone: rectangle(node("#runMilestone")),
      inventory: rectangle(inventory),
      targetGridColumn: targetStyle.gridColumnStart,
      targetGridColumnEnd: targetStyle.gridColumnEnd,
      hudGridColumn: hudStyle.gridColumnStart,
      hudJustifySelf: hudStyle.justifySelf,
      inventoryDisplay: inventoryStyle.display,
      wordListDisplay: wordListStyle.display,
      wordListOverflowY: wordListStyle.overflowY
    };
  });
}

for (const viewport of REGRESSION_VIEWPORTS) {
  test(`play chrome stays readable and collision-free at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Focused responsive geometry is covered once in desktop Chromium.");
    await startStressChallenge(page, viewport);
    const layout = await geometry(page);

    for (const key of ["nav", "menu", "target", "targetLabel", "hud", "sound", "board", "assistToggle", "toolbar", "bloomTrigger"]) {
      expect(layout[key], `${key} should remain visible at ${viewport.width}x${viewport.height}`).not.toBeNull();
    }
    expect(layout.inventory, "the mobile Bloom should replace the crowded permanent Words shelf").toBeNull();
    expect(layout.assistanceRail, "the five-button Assistance rail stays collapsed until the Assist orb is opened").toBeNull();
    await expect(page.locator("#mobileAssistToggle")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#mobileAssistToggle")).toHaveAccessibleName("Open assistance tools");

    if (viewport.centeredTarget) {
      expect(Math.abs(layout.target.centerX - layout.nav.centerX), "the objective should be optically centered in the header").toBeLessThanOrEqual(4);
    } else {
      expect(layout.targetGridColumn).toBe("2");
    }
    expect(layout.hudGridColumn).toBe("3");
    expect(layout.hudJustifySelf).toBe("end");
    expect(layout.nav.height).toBeLessThanOrEqual(80);

    if (viewport.guardRequired) {
      expect(layout.law, "Path Guard should remain visible in the tablet header").not.toBeNull();
      expect(contains(layout.target, layout.law), "Path Guard should stay inside the objective group").toBe(true);
      expect(contains(layout.nav, layout.law), "Path Guard should stay inside the navigation bar").toBe(true);
      expect(intersects(layout.targetLabel, layout.law), "Path Guard should not overlap the objective label").toBe(false);
    }

    for (const [name, element] of Object.entries({
      Menu: layout.menu,
      objective: layout.target,
      HUD: layout.hud,
      sound: layout.sound
    })) {
      expect(contains(layout.nav, element), `${name} should fit inside the one-row header`).toBe(true);
    }
    expect(contains(layout.target, layout.targetLabel), "the objective label should fit its grid column").toBe(true);
    expect(contains(layout.hud, layout.sound), "sound should remain owned by the right-side HUD").toBe(true);
    expect(intersects(layout.menu, layout.target, 4)).toBe(false);
    expect(intersects(layout.target, layout.hud, 4)).toBe(false);
    expect(intersects(layout.target, layout.sound, 4)).toBe(false);
    expect(intersects(layout.menu, layout.sound, 4)).toBe(false);

    const rowCenters = [layout.menu.centerY, layout.target.centerY, layout.sound.centerY];
    expect(Math.max(...rowCenters) - Math.min(...rowCenters)).toBeLessThanOrEqual(4);

    expect(contains(layout.board, layout.toolbar), "board toolbar should stay inside the board").toBe(true);
    expect(contains(layout.board, layout.assistToggle), "Assist orb should stay inside the board").toBe(true);
    expect(contains(layout.board, layout.bloomTrigger), "Bloom trigger should stay inside the playable board").toBe(true);
    expect(layout.bloomTrigger.width).toBeGreaterThanOrEqual(44);
    expect(layout.bloomTrigger.height).toBeGreaterThanOrEqual(44);
    expect(layout.assistToggle.width).toBeGreaterThanOrEqual(44);
    expect(layout.assistToggle.height).toBeGreaterThanOrEqual(44);
    expect(intersects(layout.assistToggle, layout.toolbar)).toBe(false);
    if (viewport.milestoneHidden) {
      expect(layout.milestone).toBeNull();
    } else {
      expect(layout.milestone, "route progress should remain visible at this size").not.toBeNull();
      expect(contains(layout.board, layout.milestone), "route progress should stay inside the board").toBe(true);
      expect(intersects(layout.toolbar, layout.milestone, 6)).toBe(false);
      expect(intersects(layout.assistToggle, layout.milestone)).toBe(false);
    }
    expect(layout.toolbar.top).toBeGreaterThanOrEqual(layout.nav.bottom - 1);

    if (viewport.compactTarget && layout.law) {
      expect(layout.law.width, "medium-landscape path guard should use its compact badge").toBeLessThanOrEqual(120);
      expect(intersects(layout.targetLabel, layout.law)).toBe(false);
    }

    expect(intersects(layout.bloomTrigger, layout.toolbar)).toBe(false);
    expect(intersects(layout.bloomTrigger, layout.assistToggle)).toBe(false);
  });
}
