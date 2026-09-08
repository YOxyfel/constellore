import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { createDefaultProfile } from "../public/default-profile.mjs";
import {
  chooseMoonHeartSettlement,
  moonHeartProjectCatalog,
  moonHeartProjectContext,
  recordMoonHeartProjectRoute
} from "../public/moon-heart-project.mjs";
import {
  createWorldweavingState,
  moonWorldweavingContext,
  recordWorldweavingCompletion
} from "../public/worldweaving.mjs";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

test.use({ serviceWorkers: "block" });

function completedMoon() {
  const routes = [
    ["power", "solar", { a: "Sun", b: "Power", word: "Solar Power" }],
    ["shelter", "haven", { a: "Adobe", b: "Construction", word: "House" }],
    ["signal", "beacon", { a: "Light", b: "Light", word: "Laser" }]
  ];
  let state = createWorldweavingState();
  for (const [slotId, choiceId, step] of routes) {
    state = recordWorldweavingCompletion(state, {
      context: moonWorldweavingContext(slotId, choiceId),
      history: [{ ...step, progressionEligible: true, routeCompleted: true }],
      completedAt: "2026-08-01T12:00:00.000Z"
    }).state;
  }
  return state;
}

function completeHeartProjects(profile) {
  const catalog = moonHeartProjectCatalog();
  let projects = profile.expedition.worlds.moon.outpost.projects;
  let receipt = 0;
  const recordFinding = (finding) => {
    receipt += 1;
    const context = moonHeartProjectContext(finding.id);
    const outcome = recordMoonHeartProjectRoute(projects, {
      context,
      history: [{
        a: `Project source ${receipt}`,
        b: `Project proof ${receipt}`,
        word: context.target,
        source: "world",
        routeCompleted: true,
        progressionEligible: true
      }],
      completedAt: `2026-08-01T12:${String(receipt).padStart(2, "0")}:00.000Z`,
      scoreEligible: true
    });
    if (!outcome.recorded) throw new Error(`Could not complete Heart finding ${finding.id}: ${outcome.reason}`);
    projects = outcome.state;
  };
  for (const chapter of catalog.chapters.slice(0, 3)) for (const finding of chapter.findings) recordFinding(finding);
  const choice = chooseMoonHeartSettlement(projects, {
    choiceId: "commons",
    decidedAt: "2026-08-01T13:00:00.000Z"
  });
  if (!choice.chosen) throw new Error(`Could not settle Moonhaven: ${choice.reason}`);
  projects = choice.state;
  for (const finding of catalog.chapters[3].findings) recordFinding(finding);
  recordFinding(catalog.finale);
  profile.expedition.worlds.moon.outpost.projects = projects;
  return profile;
}

async function installOutpostProfile(page, { heartComplete = false } = {}) {
  const profile = createDefaultProfile({
    cosmeticLoadout: {},
    voyageProgress: {},
    routeProgression: {},
    remixReadiness: {},
    worldweaving: completedMoon()
  });
  profile.wins = 3;
  profile.stardust = 500;
  profile.firstOrbit = { seen: true, completed: true };
  profile.secondOrbit = { seen: true, completed: true };
  if (heartComplete) completeHeartProjects(profile);
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", JSON.stringify(profile)],
      ["constellore-local-profile-v1", JSON.stringify(profile)]
    ]
  });
}

async function installEarthJourneyProfile(page) {
  const profile = createDefaultProfile({
    cosmeticLoadout: {},
    voyageProgress: {},
    routeProgression: {},
    remixReadiness: {},
    worldweaving: createWorldweavingState()
  });
  profile.wins = 1;
  profile.firstOrbit = { seen: true, completed: true };
  profile.secondOrbit = { seen: true, completed: true };
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", JSON.stringify(profile)],
      ["constellore-local-profile-v1", JSON.stringify(profile)]
    ]
  });
}

async function openOutpost(page) {
  await page.goto("/play/?birthday=off");
  await page.waitForTimeout(750);
  const pause = page.locator("#pauseDialog");
  if (await pause.evaluate((dialog) => dialog.open).catch(() => false)) {
    await page.locator("#pauseExit").click();
    await expect(pause).not.toHaveJSProperty("open", true);
  }
  await expect(page.locator("#startScreen")).toBeVisible();
  await page.locator("#hubMenuButton").click();
  await expect(page.locator("#moonWorldweavingMenuButton")).toContainText("Moon Outpost");
  await page.locator("#moonWorldweavingMenuButton").click();
  const dialog = page.locator("#moonOutpostDialog");
  await expect(dialog).toHaveJSProperty("open", true);
  await expect(dialog.locator("#moonOutpostTitle")).toContainText("Moon");
  return dialog;
}

test("the arrived Home rocket continues directly to the active Heart project", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await installOutpostProfile(page);
  await page.goto("/play/?birthday=off");
  await page.locator("#homeOrbitTabJourney").click();

  const rocket = page.locator("#moonHomeRocket");
  await expect(rocket).toBeVisible();
  await expect(rocket).toHaveAttribute("data-project-surface", "heart");
  await expect(rocket).toHaveAttribute("data-origin-world", "moon");
  await expect(rocket).toHaveAttribute("data-destination-world", "moon");
  await expect(rocket).toHaveAttribute("data-journey-state", "continue");
  await expect(rocket).toHaveAttribute("data-journey-action", "continue");
  await expect(rocket.locator("#moonHomeRocketTitle")).toHaveText("The Heart");
  await expect(rocket.locator("#moonHomeRocketArt")).toHaveAttribute("src", /art\/moon-outpost\/rocket-core-v1[.]png/);
  await expect(rocket.locator("#moonHomePlatformArt")).toHaveAttribute("src", /moon-master[.]webp/);
  await expect(rocket.locator("#moonHomeDestinationArt")).toHaveAttribute("src", /moon-thumb[.]webp/);

  await rocket.click();
  const project = page.locator("#moonHeartProjectDialog");
  await expect(project).toHaveJSProperty("open", true);
  await expect(project.locator("#moonHeartProjectTitle")).toHaveText("The Heart");
  await expect(page.locator("[data-moon-project-launch]")).toHaveCount(0);
});

test("the planetary Home scene stays grounded and collision-free across viewports", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installOutpostProfile(page);
  await page.goto("/play/?birthday=off");
  await page.locator("#homeOrbitTabJourney").click();
  const scene = page.locator("#moonHomeRocket");
  await expect(scene).toBeVisible();

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 667, height: 375 },
    { width: 1280, height: 800 }
  ]) {
    await page.setViewportSize(viewport);
    await scene.scrollIntoViewIfNeeded();
    await scene.locator("#moonHomeRocketArt").evaluate((image) => image.decode());
    await scene.locator("#moonHomePlatformArt").evaluate((image) => image.decode());
    const geometry = await scene.evaluate((root) => {
      const rect = (selector) => root.querySelector(selector).getBoundingClientRect();
      const sceneRect = root.getBoundingClientRect();
      const rocket = rect("#moonHomeRocketArt");
      const platform = rect(".moon-home-voyage__platform");
      const destination = rect(".moon-home-voyage__destination");
      const arena = document.querySelector("#scramblePortal")?.getBoundingClientRect();
      const image = root.querySelector("#moonHomeRocketArt");
      const overlaps = (a, b) => Boolean(b) && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const center = { x: sceneRect.left + sceneRect.width / 2, y: sceneRect.top + sceneRect.height / 2 };
      return {
        scene: sceneRect.toJSON(),
        rocket: rocket.toJSON(),
        platform: platform.toJSON(),
        destination: destination.toJSON(),
        rocketNaturalRatio: image.naturalWidth / image.naturalHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        arenaOverlap: overlaps(sceneRect, arena),
        hit: document.elementFromPoint(center.x, center.y)?.closest("#moonHomeRocket") === root
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.scene.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.scene.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(geometry.rocket.height / geometry.scene.height).toBeGreaterThan(0.55);
    expect(geometry.rocket.width / geometry.rocket.height).toBeCloseTo(geometry.rocketNaturalRatio, 1);
    expect(geometry.rocket.bottom).toBeGreaterThan(geometry.platform.top);
    expect(geometry.destination.bottom).toBeLessThan(geometry.platform.top + 4);
    expect(geometry.arenaOverlap).toBe(false);
    expect(geometry.hit).toBe(true);
  }
});

test("completing the Moon promotes it to the Mars preparation platform", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installOutpostProfile(page, { heartComplete: true });
  await page.goto("/play/?birthday=off");
  await page.locator("#homeOrbitTabJourney").click();

  const scene = page.locator("#moonHomeRocket");
  await expect(scene).toHaveAttribute("data-project-surface", "outpost");
  await expect(scene).toHaveAttribute("data-origin-world", "moon");
  await expect(scene).toHaveAttribute("data-destination-world", "mars");
  await expect(scene).toHaveAttribute("data-journey-state", "preparing");
  await expect(scene.locator("#moonHomeRocketTitle")).toHaveText("Prepare the Mars mission");
  await expect(scene.locator("#moonHomePlatformArt")).toHaveAttribute("src", /moon-master[.]webp/);
  await expect(scene.locator("#moonHomeDestinationArt")).toHaveAttribute("src", /mars-thumb[.]webp/);

  await expect(scene).toBeDisabled();
  const moonhaven = page.locator("#moonHomeProjectVisit");
  await expect(moonhaven).toBeVisible();
  await moonhaven.click();
  await expect(page.locator("#moonOutpostDialog")).toHaveJSProperty("open", true);
  await expect(page.locator("[data-moon-project-launch]")).toHaveCount(0);
});

test("the Home rocket launches once, then continues without replaying the film", async ({ page, browserName }) => {
  const activate = async (locator) => {
    if (browserName === "webkit") await locator.evaluate((button) => button.click());
    else await locator.click();
  };
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await installEarthJourneyProfile(page);
  await page.goto("/play/?birthday=off");
  const home = page.locator("#homePlaySplit");
  await expect(home).toHaveAttribute("data-home-hub-renderer", "webgl", { timeout: 15_000 });
  await activate(page.locator("#homeOrbitTabJourney"));

  const rocket = page.locator("#moonHomeRocket");
  await expect(rocket).toHaveAttribute("data-journey-action", "launch");
  await activate(rocket);
  const flight = page.locator("[data-moon-project-launch]");
  await expect(home).toHaveAttribute("data-home-hub-mode", "focused");
  await expect(flight).toHaveCount(0);
  await expect(home).toHaveAttribute("data-home-hub-phase", "ready", { timeout: 5_000 });
  await activate(rocket);
  await expect(flight).toBeVisible();
  await expect(flight).toHaveAttribute("data-phase", "playing", { timeout: 15_000 });
  const filmTime = await flight.locator("video").evaluate((video) => video.currentTime);
  expect(filmTime).toBeGreaterThanOrEqual(14.8);
  // WebKit can finish this deliberately short film while its animated skip
  // button is still settling. A direct activation tests the command without
  // requiring the temporary overlay to remain geometrically stable.
  await flight.locator(".moon-project-launch__skip").evaluate((button) => button.click()).catch(() => {});

  const project = page.locator("#moonWorldDialog");
  await expect(project).toHaveJSProperty("open", true);
  await expect(flight).toHaveCount(0);

  // Home is already the recorded origin, so the project avoids duplicating
  // that route in its overflow menu. Use the visible, origin-aware Back action.
  await activate(project.locator("#moonWorldClose"));
  await expect(page.locator("#startScreen")).toBeVisible();
  await expect(page.locator("#homePlaySplit")).toHaveAttribute("data-home-destination", "journey");
  await expect(rocket).toHaveAttribute("data-journey-action", "continue");

  await activate(rocket);
  await expect(home).toHaveAttribute("data-home-hub-mode", "focused");
  await expect(project).toHaveJSProperty("open", false);
  await expect(home).toHaveAttribute("data-home-hub-phase", "ready", { timeout: 5_000 });
  await activate(rocket);
  await expect(project).toHaveJSProperty("open", true);
  await expect(page.locator("[data-moon-project-launch]")).toHaveCount(0);
});

test("Moon Outpost is contained and touchable across phone, landscape, and desktop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installOutpostProfile(page);
  const viewports = [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 887, height: 427 },
    { width: 1280, height: 800 }
  ];
  let dialog = null;
  for (const [index, viewport] of viewports.entries()) {
    await page.setViewportSize(viewport);
    if (index === 0) dialog = await openOutpost(page);
    else await page.waitForTimeout(60);
    const geometry = await dialog.evaluate((root) => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return !element.hidden && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const controls = [...root.querySelectorAll("button, select")]
        .filter(visible)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            name: element.getAttribute("aria-label") || element.textContent.trim(),
            width: rect.width,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom
          };
        });
      const rect = root.getBoundingClientRect();
      return {
        controls,
        visiblePanes: [...root.querySelectorAll("[data-outpost-pane-content]")].filter(visible).length,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        dialogOverflow: root.scrollWidth > root.clientWidth + 1
      };
    });
    expect(geometry.pageOverflow, `${viewport.width} page overflow`).toBe(false);
    expect(geometry.dialogOverflow, `${viewport.width} dialog overflow`).toBe(false);
    expect(geometry.visiblePanes, `${viewport.width} visible project panes`).toBe(viewport.width === 1280 ? 2 : 1);
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.top).toBeGreaterThanOrEqual(-1);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    for (const control of geometry.controls) {
      expect(control.width, `${viewport.width} ${control.name} width`).toBeGreaterThanOrEqual(44);
      expect(control.height, `${viewport.width} ${control.name} height`).toBeGreaterThanOrEqual(44);
    }
    if (index === 0) {
      await dialog.locator('[data-outpost-action="structure"][data-structure-id="shelter"]').click();
      await expect(dialog).toHaveAttribute("data-project-pane", "detail");
      await expect(dialog.locator("#moonOutpostConsole")).toBeVisible();
      await expect(dialog.locator("#moonOutpostScene")).toBeHidden();
      await dialog.locator('[data-outpost-pane="scene"]').click();
    }
  }
  const rocketImage = dialog.locator('[data-rocket-layer="hull"] img');
  await expect(rocketImage).toBeVisible();
  const rocket = await rocketImage.evaluate((image) => ({
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    objectFit: getComputedStyle(image).objectFit
  }));
  expect(rocket.complete).toBe(true);
  expect(rocket.naturalWidth).toBeGreaterThan(0);
  expect(rocket.naturalHeight).toBeGreaterThan(0);
  expect(rocket.objectFit).toBe("contain");
});

test("cache economy remains usable while unreleased Mars content stays in preparing state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await installOutpostProfile(page);
  const dialog = await openOutpost(page);

  await dialog.locator('[data-outpost-action="cache"]').click();
  const tiers = dialog.locator("#moonOutpostCacheTiers .moon-outpost__cache-tier");
  await expect(tiers).toHaveCount(4);
  await expect(dialog.locator('[data-cache-tier="common"]')).toBeEnabled();
  await expect(dialog.locator('[data-cache-tier="rare"]')).toBeEnabled();
  await expect(dialog.locator('[data-cache-tier="epic"]')).toBeDisabled();
  await expect(dialog.locator('[data-cache-tier="mythic"]')).toBeDisabled();
  await expect(dialog.locator("#moonOutpostSelectionButton")).toBeDisabled();
  await dialog.locator("#moonOutpostCacheOpen").click();
  await expect(dialog.locator("#moonOutpostRewards .moon-outpost__reward")).toHaveCount(1);
  await expect(dialog.locator("#moonOutpostCacheStatus")).toContainText("Manifest recovered");

  await dialog.locator('[data-outpost-action="cache-back"]').click();
  const rocket = dialog.locator('[data-outpost-action="rocket-preview"]');
  await rocket.click();
  await expect(rocket).toHaveAttribute("data-ignited", "true");
  const launch = dialog.locator('[data-outpost-action="launch"]');
  await expect(launch).toBeDisabled();
  await expect(launch).toContainText("voyage preparing");
  await expect(dialog).toHaveAttribute("data-stage", "overview");

  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem("constellore-profile-v1") || localStorage.getItem("constellore-local-profile-v1");
    return JSON.parse(raw || "null");
  });
  expect(stored.expedition.worlds.moon.launches).toBe(0);
  expect(stored.expedition.salvage.opensByTier.common).toBe(1);
  expect(stored.expedition.salvage.receiptFingerprints).toHaveLength(1);
});

test("quitting a Heart experiment returns to the project, whose Main menu action returns Home", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await installOutpostProfile(page);
  const outpost = await openOutpost(page);

  await outpost.locator('[data-outpost-action="structure"][data-structure-id="shelter"]').click();
  await outpost.locator('[data-outpost-action="project"]').click();
  const heart = page.locator("#moonHeartProjectDialog");
  await expect(heart).toHaveJSProperty("open", true);
  await heart.locator('[data-heart-action="pane"][data-heart-pane="detail"]').click();
  await heart.locator("#moonHeartPrimaryAction").click();

  await expect(page.locator("#missionBriefingDialog")).toHaveJSProperty("open", true);
  await page.locator("#beginMission").click();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await page.locator("#pauseRunButton").click();
  await expect(page.locator("#pauseExit")).toHaveText("Return to The Heart");
  await page.locator("#pauseExit").click();

  await expect(heart).toHaveJSProperty("open", true);
  await expect(heart.locator('[data-heart-action="chapter"][data-chapter-id="vital-systems"]')).toHaveAttribute("aria-pressed", "true");
  await heart.locator("#moonHeartOverflow > summary").click();
  await heart.locator('[data-heart-action="main-menu"]').click();
  await expect(heart).toHaveJSProperty("open", false);
  await expect(page.locator("#startScreen")).toBeVisible();
});

test("Moon Outpost has no serious or critical accessibility violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await installOutpostProfile(page);
  await openOutpost(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    if (viewport.width > 1000) {
      const recipe = page.locator(".moon-outpost__recipe");
      await expect(recipe).toBeVisible();
      await expect(recipe).toHaveRole("group");
      await expect(recipe).toHaveAccessibleName("Sun plus Power made Solar Power");
    }
    const results = await new AxeBuilder({ page })
      .include("#moonOutpostDialog")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact))).toEqual([]);
  }
});
