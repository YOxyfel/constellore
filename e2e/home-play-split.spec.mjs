import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

async function installCompletedOnboarding(page, { wins, dailyPlayed = "" }) {
  const profile = JSON.stringify({
    version: 8,
    wins,
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true },
    dailyCompleted: "",
    dailyPlayed
  });
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", profile],
      ["constellore-local-profile-v1", profile],
      ["constellore-birthday-voyage-complete-v1", "e2e"]
    ]
  });
}

async function duelFeatures(page) {
  const response = await page.request.get("/api/config");
  expect(response.ok()).toBeTruthy();
  return (await response.json()).duels || {};
}

async function openCompletedHome(page, { wins, viewport, dailyPlayed = "" }) {
  await page.setViewportSize(viewport);
  await installCompletedOnboarding(page, { wins, dailyPlayed });
  await page.goto("/play/?birthday=off");
  await expect(page.locator("body")).toHaveAttribute("data-home-stage", "core");
  await expect(page.locator("#scramblePortal")).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
}

test("the launch handoff reveals the completed home split on its first visible frame", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The direct home handoff is sampled once on desktop.");
  await page.setViewportSize({ width: 1440, height: 900 });
  const profile = JSON.stringify({
    version: 10,
    wins: 3,
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true },
    routeRank: { rank: { id: "gold", number: 3 } }
  });
  await page.addInitScript(({ savedProfile }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("constellore-profile-v1", savedProfile);
    localStorage.setItem("constellore-local-profile-v1", savedProfile);
    localStorage.setItem("constellore-birthday-voyage-complete-v1", "e2e");
    localStorage.setItem("constellore-first-open-cinematic-v1", JSON.stringify({
      schemaVersion: 1,
      completed: true,
      completedAt: "2026-01-01T00:00:00.000Z"
    }));
  }, { savedProfile: profile });

  await page.addInitScript(() => {
    window.__homeHandoffFrames = [];
    const startedAt = performance.now();
    const sample = () => {
      const startScreen = document.querySelector("#startScreen");
      const title = document.querySelector("#startTitle")?.getBoundingClientRect();
      const portal = document.querySelector("#scramblePortal");
      const portalRect = portal?.getBoundingClientRect();
      window.__homeHandoffFrames.push({
        elapsed: performance.now() - startedAt,
        visible: startScreen ? !startScreen.hidden && getComputedStyle(startScreen).visibility === "visible" : false,
        introPending: document.body?.classList.contains("cosmic-intro-pending") !== false,
        firstSession: document.body?.classList.contains("first-session") === true,
        stage: document.body?.dataset.homeStage || "",
        destination: document.querySelector("#homePlaySplit")?.dataset.homeOrbitActive || "",
        titleX: title?.x ?? -1,
        portalVisible: Boolean(portalRect?.width && portalRect?.height && getComputedStyle(portal).display !== "none")
      });
      if (performance.now() - startedAt < 10_000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await page.goto("/play/?birthday=off");
  await expect(page.locator(".first-open-cinematic")).toHaveCount(0);
  await expect(page.locator("body")).toHaveAttribute("data-home-stage", "core");
  await page.waitForTimeout(1_850);
  const visibleFrames = await page.evaluate(() => window.__homeHandoffFrames.filter((frame) => (
    frame.visible && !frame.introPending
  )));
  expect(visibleFrames.length).toBeGreaterThan(0);
  expect(visibleFrames.every((frame) => frame.stage === "core")).toBeTruthy();
  expect(visibleFrames.every((frame) => !frame.firstSession && frame.destination === "forge")).toBeTruthy();
  expect(Math.max(...visibleFrames.map((frame) => frame.titleX)) - Math.min(...visibleFrames.map((frame) => frame.titleX))).toBeLessThan(32);
});

test("Today's word stays outside the level queue and dismisses only after a successful start", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The complete Daily launcher flow is exercised once on desktop.");

  await openCompletedHome(page, {
    wins: 1,
    viewport: { width: 1440, height: 900 }
  });

  const primary = page.locator("#primaryOrbitButton");
  const dailyStar = page.locator("#dailyStarButton");
  await expect(primary).not.toHaveAttribute("data-action", "daily");
  await expect(page.locator("#primaryOrbitKicker")).not.toContainText("TODAY");
  await expect(dailyStar).toBeVisible();
  await expect(dailyStar).toHaveAccessibleName("Play Today’s word");
  await expect(dailyStar).toHaveAttribute("data-motion", "roaming");
  const firstStarPosition = await dailyStar.boundingBox();
  await page.waitForTimeout(850);
  const movedStarPosition = await dailyStar.boundingBox();
  expect(firstStarPosition).toBeTruthy();
  expect(movedStarPosition).toBeTruthy();
  expect(Math.hypot(
    movedStarPosition.x - firstStarPosition.x,
    movedStarPosition.y - firstStarPosition.y
  )).toBeGreaterThan(8);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 568, height: 320 }
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(120);
    const geometry = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      };
      return {
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        star: rect("#dailyStarButton"),
        lane: rect(".daily-star-lane"),
        obstacles: [
          ".home-orbit__rail",
          ".home-orbit__arrow:not(:disabled)",
          "#startTitle",
          ".hero-promise",
          "#heroRecipeExample",
          ".primary-orbit-panel",
          ".home-forge-catalog-toggle:not([hidden])",
          "#scramblePortal"
        ].map(rect).filter((box) => box && box.width > 0 && box.height > 0)
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.star.width).toBeGreaterThanOrEqual(44);
    expect(geometry.star.height).toBeGreaterThanOrEqual(44);
    expect(geometry.star.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.star.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    const motion = await dailyStar.getAttribute("data-motion");
    if (viewport.width <= 900) {
      expect(motion, `${viewport.width}×${viewport.height} uses the collision-free Daily lane`).toBe("guided");
      expect(geometry.lane.width).toBeGreaterThanOrEqual(geometry.star.width);
      expect(geometry.star.left).toBeGreaterThanOrEqual(geometry.lane.left - 1);
      expect(geometry.star.right).toBeLessThanOrEqual(geometry.lane.right + 1);
      expect(geometry.star.top).toBeGreaterThanOrEqual(geometry.lane.top - 6);
      expect(geometry.star.bottom).toBeLessThanOrEqual(geometry.lane.bottom + 6);
    } else if (motion === "roaming") {
      expect(geometry.star.top).toBeGreaterThanOrEqual(-1);
      expect(geometry.star.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
      for (const obstacle of geometry.obstacles) {
        const separated = (
          geometry.star.bottom <= obstacle.top + 1
          || geometry.star.top >= obstacle.bottom - 1
          || geometry.star.right <= obstacle.left + 1
          || geometry.star.left >= obstacle.right - 1
        );
        expect(separated, `Daily star overlaps content at ${viewport.width}×${viewport.height}: ${JSON.stringify({ star: geometry.star, obstacle })}`).toBeTruthy();
      }
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(350);
  await expect(dailyStar).toHaveAttribute("data-motion", "roaming");
  // Hover/focus deliberately pauses the roaming star so a player can commit
  // the target they have acquired instead of chasing a stale coordinate.
  await dailyStar.dispatchEvent("pointerenter", { pointerType: "mouse", isPrimary: true });
  await expect(dailyStar).toHaveClass(/is-motion-paused/);
  await expect(page.locator("#homePlaySplit")).toHaveAttribute("data-home-destination", "forge");
  const acquiredStar = await dailyStar.boundingBox();
  expect(acquiredStar).toBeTruthy();
  const starHitTarget = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return {
      tag: element?.tagName || "",
      id: element?.id || "",
      className: typeof element?.className === "string" ? element.className : "",
      buttonId: element?.closest?.("button")?.id || ""
    };
  }, {
    x: acquiredStar.x + (acquiredStar.width / 2),
    y: acquiredStar.y + (acquiredStar.height / 2)
  });
  expect(starHitTarget.buttonId, JSON.stringify(starHitTarget)).toBe("dailyStarButton");
  await page.mouse.click(
    acquiredStar.x + (acquiredStar.width / 2),
    acquiredStar.y + (acquiredStar.height / 2)
  );
  await expect(dailyStar).toBeDisabled();
  await expect(page.locator("#cosmicGate")).toBeVisible();
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  const today = new Date().toISOString().slice(0, 10);
  const playedBeforeStart = await page.evaluate(() => [
    "constellore-profile-v1",
    "constellore-local-profile-v1"
  ].map((key) => {
    try { return JSON.parse(localStorage.getItem(key) || "null")?.dailyPlayed || ""; }
    catch { return ""; }
  }));
  expect(playedBeforeStart).not.toContain(today);
  await page.locator("#beginMission").click();
  await expect(briefing).toHaveJSProperty("open", false);
  await expect(page.locator("#gameScreen")).toBeVisible();

  const playedDates = await page.evaluate(() => [
    "constellore-profile-v1",
    "constellore-local-profile-v1"
  ].map((key) => {
    try { return JSON.parse(localStorage.getItem(key) || "null")?.dailyPlayed || ""; }
    catch { return ""; }
  }));
  expect(playedDates).toContain(today);

  await page.locator("#pauseRunButton").click();
  await page.locator("#pauseExit").click();
  await expect(page.locator("#startScreen")).toBeVisible();
  await expect(dailyStar).toBeHidden();
  await expect(primary).not.toHaveAttribute("data-action", "daily");
  await page.reload();
  await expect(dailyStar).toBeHidden();
  await expect(primary).not.toHaveAttribute("data-action", "daily");
});

test("Today's word respects reduced motion while remaining a clear target", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Reduced motion is exercised once on desktop.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCompletedHome(page, {
    wins: 1,
    viewport: { width: 1440, height: 900 }
  });

  const dailyStar = page.locator("#dailyStarButton");
  await expect(dailyStar).toBeVisible();
  await expect(dailyStar).toHaveAttribute("data-motion", "docked");
  const before = await dailyStar.boundingBox();
  await page.waitForTimeout(500);
  const after = await dailyStar.boundingBox();
  expect(before).toBeTruthy();
  expect(after).toBeTruthy();
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  expect(after.width).toBeGreaterThanOrEqual(44);
  expect(after.height).toBeGreaterThanOrEqual(44);
});

test("phone and tablet homes keep Today's word in its own touch-safe orbit", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "The guided Daily orbit is a compact-home contract.");
  await openCompletedHome(page, {
    wins: 1,
    viewport: { width: 390, height: 844 }
  });

  const dailyStar = page.locator("#dailyStarButton");
  await expect(dailyStar).toBeVisible();
  await expect(dailyStar).toHaveAccessibleName("Play Today’s word");

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 568, height: 320 },
    { width: 768, height: 1024 }
  ]) {
    await page.setViewportSize(viewport);
    await expect(dailyStar).toHaveAttribute("data-motion", "guided");
    const geometry = await page.evaluate(() => {
      const box = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        lane: box(".daily-star-lane"),
        star: box("#dailyStarButton"),
        forge: box(".hero-forge"),
        recipeWords: [...document.querySelectorAll("#heroRecipeExample > *")].map((element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        }),
        primary: box(".primary-orbit-panel")
      };
    });
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.star.width).toBeGreaterThanOrEqual(44);
    expect(geometry.star.height).toBeGreaterThanOrEqual(44);
    expect(geometry.star.left).toBeGreaterThanOrEqual(geometry.forge.left - 1);
    expect(geometry.star.right).toBeLessThanOrEqual(geometry.forge.right + 1);
    expect(geometry.star.top).toBeGreaterThanOrEqual(geometry.forge.top - 1);
    expect(geometry.star.bottom).toBeLessThanOrEqual(geometry.forge.bottom + 1);
    const primarySeparated = geometry.star.bottom <= geometry.primary.top + 1
      || geometry.star.top >= geometry.primary.bottom - 1
      || geometry.star.right <= geometry.primary.left + 1
      || geometry.star.left >= geometry.primary.right - 1;
    expect(primarySeparated, `Daily beacon overlaps the primary action at ${viewport.width}Г—${viewport.height}`).toBeTruthy();
    for (const word of geometry.recipeWords) {
      const separated = geometry.star.bottom <= word.top + 1
        || geometry.star.top >= word.bottom - 1
        || geometry.star.right <= word.left + 1
        || geometry.star.left >= word.right - 1;
      expect(separated, `Daily beacon overlaps a recipe word at ${viewport.width}Г—${viewport.height}`).toBeTruthy();
    }
  }
});

test("completed onboarding exposes a Bronze-locked Arena destination", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The Orbit Home Arena contract is exercised once on desktop.");
  const features = await duelFeatures(page);
  test.skip(features.enabled !== true, "The local Scramble service is disabled.");

  await openCompletedHome(page, {
    wins: 0,
    viewport: { width: 1440, height: 900 }
  });

  const portal = page.locator("#scramblePortal");
  const entry = page.locator("#scrambleHomeButton");
  await expect(portal).toHaveAttribute("data-arena-state", "locked");
  await expect(entry).toHaveAttribute("data-arena-state", "locked");
  await expect(page.locator("#scramblePortalAccess")).toHaveText("SILVER REQUIRED");
  await expect(page.locator("#scrambleHomeStatus")).toHaveText("Reach Silver Route Rank to unlock Scramble Arena");
  await expect(entry).toBeDisabled();
  await page.locator("#homeOrbitTabArena").click();
  await expect(page.locator("#homePlaySplit")).toHaveAttribute("data-home-orbit-active", "arena");
  await page.waitForTimeout(700);

  const geometry = await page.locator("#startScreen .hero-row").evaluate((hero) => {
    const viewport = hero.querySelector("[data-home-orbit-viewport]").getBoundingClientRect();
    const arena = hero.querySelector("#scramblePortal").getBoundingClientRect();
    return {
      arena: { left: arena.left, right: arena.right, width: arena.width },
      viewport: { left: viewport.left, right: viewport.right }
    };
  });
  expect(geometry.arena.width).toBeGreaterThan(0);
  expect(geometry.arena.left).toBeGreaterThanOrEqual(geometry.viewport.left - 1);
  expect(geometry.arena.right).toBeLessThanOrEqual(geometry.viewport.right + 1);
  await expect(page.locator("#homeOrbitForge")).toHaveAttribute("inert", "");
  await expectNoHorizontalOverflow(page);

});

test("one scored solo win cannot bypass the Silver Arena gate", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The Silver home gate is exercised once on desktop.");
  const features = await duelFeatures(page);
  test.skip(
    features.enabled !== true || features.publicMatchmakingEnabled !== true,
    "Public Scramble matchmaking is disabled in this local build."
  );

  await openCompletedHome(page, {
    wins: 1,
    viewport: { width: 1440, height: 900 }
  });

  const portal = page.locator("#scramblePortal");
  const entry = page.locator("#scrambleHomeButton");
  await expect(portal).toHaveAttribute("data-arena-state", "locked");
  await expect(entry).toHaveAttribute("data-arena-state", "locked");
  await expect(page.locator("#scramblePortalAccess")).toHaveText("SILVER REQUIRED");
  await expect(entry).toBeDisabled();
});

test("the phone home swaps to Scramble without stacking or horizontal overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile", "Phone geometry is covered by the mobile Chromium project.");
  const features = await duelFeatures(page);
  test.skip(features.enabled !== true, "The local Scramble service is disabled.");

  await openCompletedHome(page, {
    wins: 0,
    viewport: { width: 390, height: 844 }
  });
  await page.locator("#homeOrbitTabArena").click();
  await expect(page.locator("#homePlaySplit")).toHaveAttribute("data-home-orbit-active", "arena");
  await page.waitForTimeout(700);

  const geometry = await page.locator("#startScreen .hero-row").evaluate((hero) => {
    const viewport = hero.querySelector("[data-home-orbit-viewport]").getBoundingClientRect();
    const arena = hero.querySelector("#scramblePortal").getBoundingClientRect();
    return {
      arena: { top: arena.top, bottom: arena.bottom, left: arena.left, right: arena.right, width: arena.width },
      viewport: { top: viewport.top, bottom: viewport.bottom, left: viewport.left, right: viewport.right }
    };
  });
  expect(geometry.arena.width).toBeGreaterThan(0);
  expect(geometry.arena.top).toBeGreaterThanOrEqual(geometry.viewport.top - 1);
  expect(geometry.arena.bottom).toBeLessThanOrEqual(geometry.viewport.bottom + 1);
  expect(geometry.arena.left).toBeGreaterThanOrEqual(geometry.viewport.left - 1);
  expect(geometry.arena.right).toBeLessThanOrEqual(geometry.viewport.right + 1);
  await expect(page.locator("#homeOrbitForge")).toHaveAttribute("inert", "");
  await expectNoHorizontalOverflow(page);
  await expect(page.locator("#scramblePortal")).toHaveAttribute("data-arena-state", "locked");
  await expect(page.locator("#scrambleHomeButton")).toBeDisabled();
});
