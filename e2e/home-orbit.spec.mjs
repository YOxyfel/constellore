import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const completedProfile = JSON.stringify({
  version: 10,
  wins: 12,
  firstOrbit: { seen: true, completed: true },
  secondOrbit: { seen: true, completed: true },
  routeRank: { rank: "gold", challengeRank: "gold" }
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__CONSTELLORE_PLANET_HUB_DIAGNOSTICS__ = true;
  });
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", completedProfile],
      ["constellore-local-profile-v1", completedProfile],
      ["constellore-birthday-voyage-complete-v1", "e2e"]
    ]
  });
  await page.goto("/play/?birthday=off");
  await expect(page.locator("body")).toHaveAttribute("data-home-stage", /core|established/);
});

test("Orbit Home exposes one active destination and always reloads into Forge", async ({ page }) => {
  const root = page.locator("#homePlaySplit");
  const forge = page.locator("#homeOrbitForge");
  const journey = page.locator("#homeOrbitJourney");
  const arena = page.locator("#homeOrbitArena");

  await expect(root).toHaveAttribute("data-home-orbit-active", "forge");
  await expect(forge).toHaveAttribute("aria-hidden", "false");
  await expect(journey).toHaveAttribute("inert", "");
  await expect(arena).toHaveAttribute("inert", "");
  const forgeAction = await page.evaluate(() => {
    const viewport = document.querySelector("[data-home-orbit-viewport]").getBoundingClientRect();
    const action = document.querySelector("#primaryOrbitButton").getBoundingClientRect();
    return { viewportTop: viewport.top, viewportBottom: viewport.bottom, actionTop: action.top, actionBottom: action.bottom };
  });
  expect(forgeAction.actionTop).toBeGreaterThanOrEqual(forgeAction.viewportTop - 1);
  expect(forgeAction.actionBottom).toBeLessThanOrEqual(forgeAction.viewportBottom + 1);

  await page.locator("#homeOrbitTabArena").click();
  await expect(root).toHaveAttribute("data-home-orbit-active", "arena");
  await expect(arena).toHaveAttribute("aria-hidden", "false");
  await expect(arena).not.toHaveAttribute("inert", "");
  await expect(forge).toHaveAttribute("inert", "");

  await page.reload();
  await expect(root).toHaveAttribute("data-home-orbit-active", "forge");
  await expect(page.locator("#homeOrbitTabForge")).toHaveAttribute("aria-selected", "true");
});

test("poster fallback keeps every HTML destination usable without WebGL2", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, ...args) {
      if (String(type).toLowerCase() === "webgl2") return null;
      return nativeGetContext.call(this, type, ...args);
    };
  });
  await page.reload();

  const root = page.locator("#homePlaySplit");
  const stage = page.locator("[data-planet-hub]");
  const poster = stage.locator("[data-planet-hub-poster]");
  await expect(stage).toHaveAttribute("data-home-hub-renderer", "fallback");
  await expect(stage).toHaveAttribute("data-home-hub-quality", "static");
  await expect(poster).toHaveAttribute("src", /earth-forge[.]webp$/);

  await page.locator("#homeOrbitTabJourney").click();
  await expect(root).toHaveAttribute("data-home-orbit-active", "journey");
  await expect(page.locator("#homeOrbitJourney")).toHaveAttribute("aria-hidden", "false");
  await expect(poster).toHaveAttribute("src", /earth-journey[.]webp$/);

  await page.locator("#homeOrbitTabArena").click();
  await expect(root).toHaveAttribute("data-home-orbit-active", "arena");
  await expect(page.locator("#scrambleHomeButton")).toBeVisible();
  await expect(poster).toHaveAttribute("src", /earth-arena[.]webp$/);
});

test("Forge catalog is a focus-contained searchable modal and restores focus", async ({ page }, testInfo) => {
  // Wait for anonymous registration to persist the returning-player profile
  // before exposing this isolated presentation fixture. A fixed delay races a
  // later profile synchronization when this file runs fully parallel.
  await expect.poll(() => page.evaluate(() => {
    try {
      const profile = JSON.parse(localStorage.getItem("constellore-profile-v1") || "null");
      return Boolean(profile?.playerId && profile?.playerToken);
    } catch {
      return false;
    }
  })).toBe(true);
  await page.evaluate(async () => {
    document.body.classList.add("choices-ready", "explore-ready", "adventures-ready");
    const { syncHomeOrbitView } = await import("/home-menu-view.mjs?v=5.0.0-beta.1");
    syncHomeOrbitView({
      forgeAvailable: true,
      journeyAvailable: true,
      arenaAvailable: true,
      catalogAvailable: true
    }, document);
    const toggle = document.querySelector("#homeForgeCatalogToggle");
    toggle.hidden = false;
    toggle.disabled = false;
  });
  const toggle = page.locator("#homeForgeCatalogToggle");
  const sheet = page.locator("#homeForgeCatalog");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("role", "dialog");
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  await expect(sheet).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#homePlaySplit")).toHaveAttribute("inert", "");
  await expect(sheet.locator("#modePicker")).toHaveCount(1);
  await expect(sheet.locator("#exploreHub")).toHaveCount(1);
  await expect(sheet.locator("#cosmosCircuitHomeButton")).toHaveCount(1);
  await expect(sheet.locator("#adventuresHub")).toHaveCount(1);
  // The native modal must keep keyboard traversal inside even if the fixture's
  // final hydration pass briefly resets the document's active element.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => document.querySelector("#homeForgeCatalog")?.contains(document.activeElement))).toBe(true);
  await page.locator("#homeForgeCatalogClose").focus();

  const search = page.locator("#homeForgeCatalogSearch");
  await search.fill("weekly");
  await expect(page.locator("#weeklyButton")).toBeVisible();
  await expect(page.locator("#modePicker")).toBeHidden();
  await expect(page.locator("#exploreHub")).toBeHidden();
  await expect(page.locator("#adventuresHub")).toBeVisible();
  await expect(page.locator("#homeForgeCatalogSearchStatus")).toContainText("1 Forge choice");

  await search.fill("nothing in this universe");
  await expect(page.locator("#homeForgeCatalogNoResults")).toBeVisible();
  await expect(page.locator("#homeForgeCatalogSearchStatus")).toContainText("No Forge choices");
  await page.locator("#homeForgeCatalogSearchClear").click();
  await expect(search).toHaveValue("");
  await expect(page.locator("#modePicker")).toBeVisible();
  await expect(page.locator("#exploreHub")).toBeVisible();
  await expect(page.locator("#adventuresHub")).toBeVisible();

  if (testInfo.project.name.includes("desktop")) {
    const geometry = await sheet.locator(".home-forge-sheet__surface").evaluate((surface) => ({
      left: surface.getBoundingClientRect().left,
      right: surface.getBoundingClientRect().right,
      viewport: innerWidth
    }));
    expect(geometry.left).toBeGreaterThan(geometry.viewport * .48);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewport - 12);
  }

  await search.fill("timed");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeVisible();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(sheet).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#homePlaySplit")).not.toHaveAttribute("inert", "");
  await expect(toggle).toBeFocused();
});

test("desktop Living Planet hub is full-bleed inside an exact 1280 by 720 viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Exact desktop containment is sampled in desktop projects.");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const root = page.locator("#homePlaySplit");
  const previous = page.locator("[data-home-orbit-previous]");
  const next = page.locator("[data-home-orbit-next]");
  const stage = page.locator("[data-planet-hub]");
  await expect(previous).toHaveCount(0);
  await expect(next).toHaveCount(0);
  await expect(stage).not.toHaveAttribute("aria-hidden", "true");
  await expect(stage.locator("[data-planet-hub-label-layer]")).not.toHaveAttribute("aria-hidden", "true");
  await expect(stage).toHaveAttribute("data-home-hub-destination", "forge");
  await expect(stage.locator("[data-planet-hub-poster]")).toHaveAttribute("alt", "");
  await expect(stage.locator("canvas[data-planet-hub-canvas]")).toHaveAttribute("aria-hidden", "true");

  const initial = await page.evaluate(() => {
    const bounds = document.querySelector("#homePlaySplit").getBoundingClientRect();
    const forge = document.querySelector("#homeOrbitForge");
    const viewport = document.querySelector("[data-home-orbit-viewport]").getBoundingClientRect();
    const cta = document.querySelector("#primaryOrbitButton").getBoundingClientRect();
    return {
      rootTop: bounds.top,
      rootBottom: bounds.bottom,
      forgeScrollHeight: forge.scrollHeight,
      forgeClientHeight: forge.clientHeight,
      ctaTop: cta.top,
      ctaBottom: cta.bottom,
      viewportTop: viewport.top,
      viewportBottom: viewport.bottom,
      viewportLeft: viewport.left,
      viewportRight: viewport.right,
      viewportBorder: getComputedStyle(document.querySelector("[data-home-orbit-viewport]")).borderTopWidth,
      viewportRadius: getComputedStyle(document.querySelector("[data-home-orbit-viewport]")).borderTopLeftRadius,
      viewportShadow: getComputedStyle(document.querySelector("[data-home-orbit-viewport]")).boxShadow,
      scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      clientHeight: document.documentElement.clientHeight,
      scrollY
    };
  });
  expect(initial.rootTop).toBeGreaterThanOrEqual(0);
  expect(initial.rootBottom).toBeLessThanOrEqual(721);
  expect(initial.forgeScrollHeight).toBeLessThanOrEqual(initial.forgeClientHeight + 1);
  expect(initial.ctaTop).toBeGreaterThanOrEqual(initial.viewportTop - 1);
  expect(initial.ctaBottom).toBeLessThanOrEqual(initial.viewportBottom + 1);
  expect(initial.viewportLeft).toBeLessThanOrEqual(1);
  expect(initial.viewportRight).toBeGreaterThanOrEqual(1279);
  expect(initial.viewportBorder).toBe("0px");
  expect(initial.viewportRadius).toBe("0px");
  expect(initial.viewportShadow).toBe("none");
  expect(initial.scrollHeight).toBeLessThanOrEqual(initial.clientHeight + 1);
  expect(initial.scrollY).toBeLessThanOrEqual(1);

  await page.locator("#homeOrbitTabArena").click();
  await expect(root).toHaveAttribute("data-home-orbit-active", "arena");
  await expect(page.locator("#scramblePortalModes")).toBeHidden();
  await expect(page.locator("#scramblePortalStakes")).toBeHidden();
  await expect(page.locator("#scramblePortal .arena-portal__topline")).toBeHidden();
  await expect(page.locator("#scrambleHomeStatus")).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBeLessThanOrEqual(1);
});

test("desktop camera drag follows the hand and releases without changing the selected world", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Direct mouse orbit is sampled in desktop WebGL projects.");
  await page.setViewportSize({ width: 1280, height: 720 });
  const root = page.locator("#homePlaySplit");
  const stage = page.locator("[data-planet-hub]");
  const canvas = stage.locator("canvas[data-planet-hub-canvas]");
  await expect(stage).toHaveAttribute("data-home-hub-renderer", "webgl");
  await page.locator("#homeOrbitTabForge").click();
  await expect(stage).toHaveAttribute("data-home-hub-phase", "ready");

  const bounds = await stage.boundingBox();
  expect(bounds).not.toBeNull();
  const radiusBefore = Number(await canvas.getAttribute("data-planet-hub-camera-radius"));
  const start = {
    x: bounds.x + bounds.width * .57,
    y: bounds.y + bounds.height * .5
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 160, start.y + 4, { steps: 5 });
  await page.mouse.up();

  await expect.poll(() => canvas.evaluate((element) => Math.abs(Number(element.dataset.planetHubLastDragYaw)))).toBeGreaterThan(.08);
  expect(Number(await canvas.getAttribute("data-planet-hub-drag-release-speed"))).toBeGreaterThan(.01);
  await expect(canvas).toHaveAttribute("data-planet-hub-coasting", "true");
  await expect(canvas).toHaveAttribute("data-planet-hub-camera-owner", "home-orbit");
  await expect(canvas).toHaveAttribute("data-planet-hub-orbit-body", "earth");
  await expect(canvas).toHaveAttribute("data-planet-hub-selected-body", "earth");
  await expect(root).toHaveAttribute("data-home-hub-mode", "overview");
  await expect(root).not.toHaveAttribute("data-planet-hub-dragging", "true");
  await expect(root).toHaveAttribute("data-home-orbit-active", "forge");
  expect(Number(await canvas.getAttribute("data-planet-hub-camera-radius"))).toBeCloseTo(radiusBefore, 3);
});

test("desktop hover is passive while direct drag owns camera movement", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Mouse hover and drag ownership are sampled in desktop WebGL projects.");
  await page.setViewportSize({ width: 1280, height: 720 });
  const stage = page.locator("[data-planet-hub]");
  const canvas = stage.locator("canvas[data-planet-hub-canvas]");
  await expect(stage).toHaveAttribute("data-home-hub-renderer", "webgl");
  await page.locator("#homeOrbitTabForge").click();
  await expect(stage).toHaveAttribute("data-home-hub-phase", "ready");
  const bounds = await stage.boundingBox();
  expect(bounds).not.toBeNull();
  const center = {
    x: bounds.x + bounds.width * .5,
    y: bounds.y + bounds.height * .5
  };

  const beforeHover = await canvas.evaluate((element) => ({
    radius: element.dataset.planetHubCameraRadius,
    lastYaw: element.dataset.planetHubLastDragYaw || "",
    owner: element.dataset.planetHubCameraOwner,
    selected: element.dataset.planetHubSelectedBody
  }));
  await page.mouse.move(center.x, center.y);
  await page.mouse.move(bounds.x + bounds.width * .78, center.y);
  await page.waitForTimeout(450);
  const afterHover = await canvas.evaluate((element) => ({
    radius: element.dataset.planetHubCameraRadius,
    lastYaw: element.dataset.planetHubLastDragYaw || "",
    owner: element.dataset.planetHubCameraOwner,
    selected: element.dataset.planetHubSelectedBody,
    coasting: element.dataset.planetHubCoasting || ""
  }));
  expect(afterHover).toEqual({ ...beforeHover, coasting: "" });

  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 132, center.y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => canvas.evaluate((element) => Math.abs(Number(element.dataset.planetHubLastDragYaw)))).toBeGreaterThan(.06);
  await expect(canvas).toHaveAttribute("data-planet-hub-camera-owner", "home-orbit");
  await expect(canvas).toHaveAttribute("data-planet-hub-coasting", "true");
});

test("a released desktop throw preserves the drag direction when inertia begins", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Release direction is sampled in desktop WebGL projects.");
  await page.setViewportSize({ width: 1280, height: 720 });
  const stage = page.locator("[data-planet-hub]");
  const canvas = stage.locator("canvas[data-planet-hub-canvas]");
  await expect(stage).toHaveAttribute("data-home-hub-renderer", "webgl");
  await page.locator("#homeOrbitTabForge").click();
  await expect(stage).toHaveAttribute("data-home-hub-phase", "ready");
  const bounds = await stage.boundingBox();
  expect(bounds).not.toBeNull();
  const start = {
    x: bounds.x + bounds.width * .42,
    y: bounds.y + bounds.height * .51
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 170, start.y + 2, { steps: 6 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-planet-hub-coasting", "true");
  const release = await canvas.evaluate((element) => ({
    dragYaw: Number(element.dataset.planetHubLastDragYaw),
    velocityYaw: Number(element.dataset.planetHubDragVelocityYaw),
    speed: Number(element.dataset.planetHubLiveAngularSpeed),
    duration: Number(element.dataset.planetHubCoastDuration)
  }));
  expect(Math.abs(release.dragYaw), JSON.stringify(release)).toBeGreaterThan(.08);
  expect(Math.abs(release.velocityYaw), JSON.stringify(release)).toBeGreaterThan(.1);
  expect(Math.sign(release.velocityYaw), JSON.stringify(release)).toBe(Math.sign(release.dragYaw));
  expect(release.speed, JSON.stringify(release)).toBeGreaterThan(.1);
  expect(release.duration, JSON.stringify(release)).toBeGreaterThan(250);
  await expect(canvas).toHaveAttribute("data-planet-hub-camera-owner", "home-orbit");
});

test("projected body labels follow camera inertia while the pointer is stationary", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Projected chart motion is sampled in desktop WebGL projects.");
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const stage = page.locator("[data-planet-hub]");
  await expect(stage).toHaveAttribute("data-home-hub-renderer", "webgl");
  await page.locator("#homeOrbitTabForge").click();
  await expect(stage).toHaveAttribute("data-home-hub-phase", "ready");
  const bounds = await stage.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5);
  for (let index = 0; index < 7; index += 1) await page.mouse.wheel(0, 900);
  await expect(stage).toHaveAttribute("data-home-hub-view", /orbit|system|universe/);

  const label = page.locator('.planet-hub__label[data-visible="true"]').first();
  await expect(label).toBeVisible();
  const before = await label.boundingBox();
  expect(before).not.toBeNull();

  const start = { x: bounds.x + bounds.width * .48, y: bounds.y + bounds.height * .52 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 120, start.y + 3, { steps: 5 });
  await page.mouse.up();
  await page.mouse.move(bounds.x + 24, bounds.y + 24);
  await page.waitForTimeout(180);
  const during = await label.boundingBox();
  expect(during).not.toBeNull();
  const travel = Math.hypot(during.x - before.x, during.y - before.y);
  expect(travel).toBeGreaterThan(2);
  await expect(page.locator("#homePlaySplit")).toHaveAttribute("data-home-orbit-active", "forge");
  await expect(stage.locator("canvas[data-planet-hub-canvas]")).toHaveAttribute("data-planet-hub-coasting", "true");
});

test("a fast far desktop throw creates substantially stronger inertia than a short drag", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "High-energy mouse inertia is sampled in desktop WebGL projects.");
  await page.setViewportSize({ width: 1280, height: 720 });
  const root = page.locator("#homePlaySplit");
  const stage = page.locator("[data-planet-hub]");
  const canvas = stage.locator("canvas[data-planet-hub-canvas]");
  await expect(stage).toHaveAttribute("data-home-hub-renderer", "webgl");
  await page.locator("#homeOrbitTabForge").click();
  await expect(stage).toHaveAttribute("data-home-hub-phase", "ready");
  const bounds = await stage.boundingBox();
  expect(bounds).not.toBeNull();
  const shortStart = { x: bounds.x + bounds.width * .4, y: bounds.y + bounds.height * .48 };
  await page.mouse.move(shortStart.x, shortStart.y);
  await page.mouse.down();
  await page.mouse.move(shortStart.x + 48, shortStart.y + 2, { steps: 5 });
  await page.mouse.up();
  const shortRelease = await canvas.evaluate((element) => ({
    speed: Number(element.dataset.planetHubDragReleaseSpeed),
    force: Number(element.dataset.planetHubDragReleaseForce),
    duration: Number(element.dataset.planetHubCoastDuration)
  }));

  const start = {
    x: bounds.x + bounds.width * .2,
    y: bounds.y + bounds.height * .56
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 520, start.y + 3, { steps: 3 });
  await page.mouse.up();

  const fastRelease = await canvas.evaluate((element) => ({
    speed: Number(element.dataset.planetHubDragReleaseSpeed),
    force: Number(element.dataset.planetHubDragReleaseForce),
    duration: Number(element.dataset.planetHubCoastDuration)
  }));
  expect(fastRelease.speed, JSON.stringify({ shortRelease, fastRelease })).toBeGreaterThan(shortRelease.speed * 3);
  expect(fastRelease.force, JSON.stringify({ shortRelease, fastRelease })).toBeGreaterThan(shortRelease.force * 3);
  expect(fastRelease.duration, JSON.stringify({ shortRelease, fastRelease })).toBeGreaterThan(shortRelease.duration);
  await expect(root).toHaveAttribute("data-home-hub-mode", "overview");
  await expect(root).not.toHaveAttribute("data-planet-hub-dragging", "true");
  await expect(canvas).toHaveAttribute("data-planet-hub-coasting", "true");
  await expect(root).toHaveAttribute("data-home-orbit-active", "forge");
});

test("the projected Moon selects on click, centers on the selected label, and returns without changing worlds", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The deterministic Moon chart pick is sampled in a desktop WebGL project.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload();

  const root = page.locator("#homePlaySplit");
  const stage = page.locator("[data-planet-hub]");
  const canvas = stage.locator("canvas[data-planet-hub-canvas]");
  const inspection = page.locator("[data-planet-hub-world-inspection]");
  const returnButton = inspection.locator("[data-planet-hub-inspection-return]");
  await expect(stage).toHaveAttribute("data-home-hub-renderer", "webgl");

  const bounds = await stage.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5);
  for (let index = 0; index < 7; index += 1) await page.mouse.wheel(0, 900);
  await expect(stage).toHaveAttribute("data-home-hub-view", /orbit|system|universe/);
  const moonLabel = page.locator('.planet-hub__label[data-body="moon"][data-visible="true"]');
  await expect(moonLabel).toBeVisible();
  let moonPick = await moonLabel.boundingBox();
  await page.mouse.click(moonPick.x + moonPick.width / 2, moonPick.y + moonPick.height / 2);
  await expect(canvas).toHaveAttribute("data-planet-hub-selected-body", "moon");
  await expect(canvas).toHaveAttribute("data-planet-hub-orbit-body", "earth");
  await expect(page.locator("#homeOrbitStatus")).toContainText("Moon selected. Double-click to center.");
  await page.waitForTimeout(520);
  // The semantic label intentionally focuses on its next activation once the
  // body is selected. Sending a synthetic `dblclick` here would dispatch two
  // additional click events: the first starts the Moon flight and the second
  // can land at the label's old projected coordinate after it begins moving.
  await moonLabel.click();

  await expect(canvas).toHaveAttribute("data-planet-hub-orbit-body", "moon");
  await expect(canvas).toHaveAttribute("data-planet-hub-selected-body", "moon");
  await expect(canvas).toHaveAttribute("data-planet-hub-camera-owner", "celestial-body-focus");
  await expect(page.locator("#homeOrbitStatus")).toContainText("Moon centered");
  await expect(root).toHaveAttribute("data-home-hub-mode", "overview");
  await expect(root).toHaveAttribute("data-home-world", "earth");
  await expect(inspection).toBeVisible();
  await expect(inspection.locator("[data-planet-hub-inspection-copy] strong")).toHaveText("Wake the Moon");
  await expect(returnButton).toHaveAttribute("aria-label", "Return to Earth orbit");
  // A centered locked world remains a chart pivot, but its compact contextual
  // information replaces the destination rail until the player returns.
  await expect(page.locator("#startScreen > .start-nav")).toBeVisible();
  await expect(page.locator("#startScreen > .start-nav")).not.toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".home-orbit__rail")).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(root).toHaveAttribute("data-home-hub-mode", "overview");
  await expect(root).toHaveAttribute("data-home-world", "earth");
  await expect(canvas).toHaveAttribute("data-planet-hub-orbit-body", "moon");
  await expect(canvas).toHaveAttribute("data-planet-hub-camera-owner", "celestial-body-focus");
  await expect(inspection).toBeVisible();
  const phoneInspection = await inspection.evaluate((element) => {
    const action = element.querySelector("[data-planet-hub-inspection-return]").getBoundingClientRect();
    const message = element.querySelector("[data-planet-hub-inspection-copy]").getBoundingClientRect();
    return {
      action: { left: action.left, right: action.right, top: action.top, bottom: action.bottom },
      message: { left: message.left, right: message.right, top: message.top, bottom: message.bottom },
      width: innerWidth,
      height: innerHeight
    };
  });
  expect(phoneInspection.action.left).toBeGreaterThanOrEqual(0);
  expect(phoneInspection.action.right).toBeLessThanOrEqual(phoneInspection.width + 1);
  expect(phoneInspection.action.top).toBeGreaterThanOrEqual(0);
  expect(phoneInspection.action.bottom).toBeLessThanOrEqual(phoneInspection.height + 1);
  expect(phoneInspection.message.left).toBeGreaterThanOrEqual(0);
  expect(phoneInspection.message.right).toBeLessThanOrEqual(phoneInspection.width + 1);
  expect(phoneInspection.message.top).toBeGreaterThanOrEqual(0);
  expect(phoneInspection.message.bottom).toBeLessThanOrEqual(phoneInspection.height + 1);

  await returnButton.click();
  await expect(root).toHaveAttribute("data-home-hub-mode", "overview");
  await expect(root).toHaveAttribute("data-home-world", "earth");
  await expect(canvas).toHaveAttribute("data-planet-hub-orbit-body", "earth");
  await expect(canvas).toHaveAttribute("data-planet-hub-selected-body", "earth");
  await expect(canvas).toHaveAttribute("data-planet-hub-camera-owner", "home-orbit");
  await expect(inspection).toBeHidden();
  await expect(page.locator("#startScreen > .start-nav")).toBeVisible();
  await expect(page.locator("#startScreen > .start-nav")).not.toHaveAttribute("aria-hidden", "true");
});

test("landscape tablet keeps an observatory-sized planet stage without page overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Landscape-tablet containment is sampled in desktop projects.");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(160);
  const geometry = await page.evaluate(() => {
    const root = document.querySelector("#homePlaySplit");
    const viewport = root.querySelector("[data-home-orbit-viewport]").getBoundingClientRect();
    const rail = root.querySelector(".home-orbit__rail").getBoundingClientRect();
    const forge = document.querySelector("#homeOrbitForge");
    return {
      layout: root.dataset.homeLayout,
      viewportHeight: viewport.height,
      viewportBottom: viewport.bottom,
      railTop: rail.top,
      railBottom: rail.bottom,
      forgeScrollHeight: forge.scrollHeight,
      forgeClientHeight: forge.clientHeight,
      pageHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      clientHeight: document.documentElement.clientHeight
    };
  });
  expect(geometry.layout).toBe("observatory");
  expect(geometry.viewportHeight).toBeGreaterThanOrEqual(500);
  expect(geometry.railTop).toBeLessThan(geometry.viewportBottom);
  expect(Math.abs(geometry.viewportBottom - geometry.railBottom)).toBeGreaterThanOrEqual(8);
  expect(Math.abs(geometry.viewportBottom - geometry.railBottom)).toBeLessThanOrEqual(16);
  expect(geometry.railBottom).toBeLessThanOrEqual(geometry.clientHeight + 1);
  expect(geometry.forgeScrollHeight).toBeLessThanOrEqual(geometry.forgeClientHeight + 1);
  expect(geometry.pageHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
});

test("cinematic destination cards share one geometry and the painted rail stays viewport-safe", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Shared HUD geometry is sampled once in the desktop project.");
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('link[href*="planet-hub-cinematic.css"]')).toHaveCount(1);

  const measurements = [];
  for (const destination of ["forge", "journey", "arena"]) {
    await page.locator(`[data-home-orbit-tab="${destination}"]`).click();
    await expect(page.locator("#homePlaySplit")).toHaveAttribute("data-home-orbit-active", destination);
    await page.waitForTimeout(620);
    measurements.push(await page.evaluate((activeDestination) => {
      const scene = document.querySelector(`[data-home-orbit-scene="${activeDestination}"]`);
      const inner = activeDestination === "forge"
        ? scene.querySelector(".primary-orbit-panel")
        : activeDestination === "journey"
          ? [...scene.querySelectorAll(".moon-home-voyage, .home-journey-locked")].find((element) => element.getClientRects().length)
          : scene.querySelector(".arena-portal");
      const action = [...scene.querySelectorAll(".primary-orbit-button, .moon-home-voyage__action, .home-journey-locked > button, .arena-portal__action")]
        .find((element) => element.getClientRects().length);
      const title = [...scene.querySelectorAll(".primary-orbit-panel h2, .moon-home-voyage__copy strong, .home-journey-locked > strong, .arena-portal__copy h2")]
        .find((element) => element.getClientRects().length);
      const bounds = scene.getBoundingClientRect();
      const innerBounds = inner.getBoundingClientRect();
      const actionBounds = action.getBoundingClientRect();
      const titleBounds = title.getBoundingClientRect();
      const style = getComputedStyle(scene);
      const innerStyle = getComputedStyle(inner);
      return {
        destination: activeDestination,
        width: bounds.width,
        height: bounds.height,
        bounds: { left: bounds.left, right: bounds.right },
        innerBounds: { left: innerBounds.left, right: innerBounds.right },
        actionBounds: { left: actionBounds.left, right: actionBounds.right },
        titleBounds: { left: titleBounds.left, right: titleBounds.right },
        padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
        gridColumns: innerStyle.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
        contained: innerBounds.left >= bounds.left - 1
          && innerBounds.right <= bounds.right + 1
          && actionBounds.left >= bounds.left - 1
          && actionBounds.right <= bounds.right + 1
          && titleBounds.left >= bounds.left - 1
          && titleBounds.right <= bounds.right + 1,
        journeyBefore: activeDestination === "journey" ? getComputedStyle(inner, "::before").content : null,
        journeyAfter: activeDestination === "journey" ? getComputedStyle(inner, "::after").content : null
      };
    }, destination));
  }

  expect(Math.max(...measurements.map(({ width }) => width)) - Math.min(...measurements.map(({ width }) => width))).toBeLessThanOrEqual(1);
  expect(Math.max(...measurements.map(({ height }) => height)) - Math.min(...measurements.map(({ height }) => height))).toBeLessThanOrEqual(1);
  expect(new Set(measurements.map(({ padding }) => padding.join(" "))).size).toBe(1);
  expect(measurements.every(({ gridColumns, contained }) => gridColumns === 2 && contained), JSON.stringify(measurements)).toBeTruthy();
  expect(measurements.find(({ destination }) => destination === "journey").journeyBefore).toBe("none");
  expect(measurements.find(({ destination }) => destination === "journey").journeyAfter).toBe("none");

  await page.setViewportSize({ width: 603, height: 96 });
  await page.waitForTimeout(120);
  const shallow = await page.evaluate(() => {
    const rail = document.querySelector(".home-orbit__rail").getBoundingClientRect();
    const tabs = document.querySelector(".home-orbit__tabs");
    const tabBounds = [...tabs.querySelectorAll(".home-orbit__tab:not([hidden])")].map((tab) => tab.getBoundingClientRect());
    return {
      rail: { left: rail.left, right: rail.right, top: rail.top, bottom: rail.bottom },
      tabBounds: tabBounds.map((bounds) => ({ left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, height: bounds.height })),
      shadow: getComputedStyle(tabs).boxShadow,
      width: innerWidth,
      height: innerHeight
    };
  });
  expect(shallow.rail.left).toBeGreaterThanOrEqual(0);
  expect(shallow.rail.right).toBeLessThanOrEqual(shallow.width + 1);
  expect(shallow.rail.top).toBeGreaterThanOrEqual(0);
  expect(shallow.rail.bottom).toBeLessThanOrEqual(shallow.height + 1);
  expect(shallow.tabBounds.every((bounds) => bounds.left >= shallow.rail.left - 1
    && bounds.right <= shallow.rail.right + 1
    && bounds.top >= shallow.rail.top - 1
    && bounds.bottom <= shallow.rail.bottom + 1
    && bounds.height >= 44)).toBeTruthy();
  expect(shallow.shadow === "none" || shallow.shadow.includes("inset")).toBeTruthy();

  await page.setViewportSize({ width: 568, height: 320 });
  await page.waitForTimeout(120);
  const shortLandscape = await page.evaluate(() => {
    const rail = document.querySelector(".home-orbit__rail").getBoundingClientRect();
    const tabs = [...document.querySelectorAll(".home-orbit__tab:not([hidden])")]
      .map((tab) => tab.getBoundingClientRect());
    return {
      rail: { left: rail.left, right: rail.right, top: rail.top, bottom: rail.bottom },
      tabs: tabs.map((bounds) => ({ left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, height: bounds.height })),
      width: innerWidth,
      height: innerHeight
    };
  });
  expect(shortLandscape.rail.left).toBeGreaterThanOrEqual(0);
  expect(shortLandscape.rail.right).toBeLessThanOrEqual(shortLandscape.width + 1);
  expect(shortLandscape.rail.top).toBeGreaterThanOrEqual(0);
  expect(shortLandscape.rail.bottom).toBeLessThanOrEqual(shortLandscape.height + 1);
  expect(shortLandscape.tabs.every((bounds) => bounds.left >= shortLandscape.rail.left - 1
    && bounds.right <= shortLandscape.rail.right + 1
    && bounds.top >= shortLandscape.rail.top - 1
    && bounds.bottom <= shortLandscape.rail.bottom + 1
    && bounds.height >= 44)).toBeTruthy();
});

test("chart destination rail keeps three unsquashed 48px controls inside asymmetric safe areas", async ({ page }) => {
  const fixtures = [
    { width: 1280, height: 720, view: "system", safe: { top: 0, right: 11, bottom: 10, left: 37 } },
    { width: 390, height: 844, view: "galaxy", safe: { top: 0, right: 0, bottom: 34, left: 0 } },
    { width: 568, height: 320, view: "system", safe: { top: 0, right: 44, bottom: 21, left: 0 } },
    { width: 603, height: 96, view: "galaxy", safe: { top: 0, right: 0, bottom: 8, left: 44 } }
  ];

  for (const fixture of fixtures) {
    await page.setViewportSize({ width: fixture.width, height: fixture.height });
    const geometry = await page.evaluate(({ safe, view }) => {
      const root = document.querySelector("#homePlaySplit");
      root.dataset.homeHubView = view;
      root.dataset.homeOrbitReveal = "settled";
      for (const [edge, value] of Object.entries(safe)) {
        root.style.setProperty(`--planet-hud-safe-${edge}`, `${value}px`);
      }
      const railElement = root.querySelector(".home-orbit__rail");
      const tabsElement = railElement.querySelector(".home-orbit__tabs");
      const rail = railElement.getBoundingClientRect();
      const rootBounds = root.getBoundingClientRect();
      const railStyle = getComputedStyle(railElement);
      const tabs = [...tabsElement.querySelectorAll(".home-orbit__tab:not([hidden])")].map((tab) => {
        const bounds = tab.getBoundingClientRect();
        const label = tab.querySelector("b");
        const center = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
        return {
          label: label?.textContent?.trim(),
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height,
          labelClipped: Boolean(label && label.scrollWidth > label.clientWidth + 1),
          hitAtCenter: Boolean(center && (center === tab || tab.contains(center)))
        };
      });
      const horizontal = rail.width >= rail.height;
      return {
        viewport: { width: innerWidth, height: innerHeight },
        rail: { left: rail.left, right: rail.right, top: rail.top, bottom: rail.bottom },
        root: { left: rootBounds.left, right: rootBounds.right, width: rootBounds.width },
        railStyle: {
          position: railStyle.position,
          left: railStyle.left,
          right: railStyle.right,
          width: railStyle.width,
          transform: railStyle.transform,
          offsetParent: railElement.offsetParent?.id || railElement.offsetParent?.className || null
        },
        tabs,
        horizontal,
        tabsOverflow: tabsElement.scrollWidth > tabsElement.clientWidth + 1
          || tabsElement.scrollHeight > tabsElement.clientHeight + 1
      };
    }, fixture);

    expect(geometry.tabs.map(({ label }) => label), JSON.stringify({ fixture, geometry }))
      .toEqual(["Forge", "Journey", "Arena"]);
    expect(geometry.rail.left, JSON.stringify({ fixture, geometry }))
      .toBeGreaterThanOrEqual(fixture.safe.left - 1);
    expect(geometry.rail.right, JSON.stringify({ fixture, geometry }))
      .toBeLessThanOrEqual(geometry.viewport.width - fixture.safe.right + 1);
    expect(geometry.rail.top, JSON.stringify({ fixture, geometry }))
      .toBeGreaterThanOrEqual(fixture.safe.top - 1);
    expect(geometry.rail.bottom, JSON.stringify({ fixture, geometry }))
      .toBeLessThanOrEqual(geometry.viewport.height - fixture.safe.bottom + 1);
    expect(geometry.tabsOverflow, JSON.stringify({ fixture, geometry })).toBe(false);
    expect(geometry.tabs.every((tab) => tab.width >= 48 && tab.height >= 48
      && tab.left >= geometry.rail.left - 1
      && tab.right <= geometry.rail.right + 1
      && tab.top >= geometry.rail.top - 1
      && tab.bottom <= geometry.rail.bottom + 1
      && !tab.labelClipped
      && tab.hitAtCenter), JSON.stringify({ fixture, geometry })).toBe(true);
    const primarySizes = geometry.tabs.map((tab) => geometry.horizontal ? tab.width : tab.height);
    expect(Math.max(...primarySizes) - Math.min(...primarySizes), JSON.stringify({ fixture, geometry }))
      .toBeLessThanOrEqual(2);
  }
});

test("semantic zoom rail keeps every 48px stop inside the safe viewport without colliding with Home navigation", async ({ page }) => {
  const fixtures = [
    { width: 1280, height: 720, safe: { top: 0, right: 19, bottom: 0, left: 43 } },
    { width: 320, height: 568, safe: { top: 24, right: 0, bottom: 20, left: 0 } },
    { width: 568, height: 320, safe: { top: 0, right: 44, bottom: 21, left: 0 } }
  ];
  for (const fixture of fixtures) {
    await page.setViewportSize({ width: fixture.width, height: fixture.height });
    const geometry = await page.evaluate(({ safe }) => {
      const root = document.querySelector("#homePlaySplit");
      for (const [edge, value] of Object.entries(safe)) {
        root.style.setProperty(`--planet-hub-safe-${edge}`, `${value}px`);
      }
      const railElement = root.querySelector("[data-planet-hub-zoom-rail]");
      // Geometry is an HTML fallback contract too. Mobile CI intentionally
      // selects the static renderer on constrained capabilities, so expose the
      // otherwise inert rail only for this layout measurement.
      railElement.hidden = false;
      railElement.removeAttribute("inert");
      railElement.setAttribute("aria-hidden", "false");
      const navigation = document.querySelector("#startScreen > .start-nav")?.getBoundingClientRect();
      const rail = railElement.getBoundingClientRect();
      const controls = [
        railElement.querySelector("[data-planet-hub-zoom-reset]"),
        ...railElement.querySelectorAll("[data-planet-hub-zoom-stop]")
      ].map((control) => {
        const bounds = control.getBoundingClientRect();
        const center = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
        return {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height,
          hitAtCenter: Boolean(center && (center === control || control.contains(center)))
        };
      });
      return {
        viewport: { width: innerWidth, height: innerHeight },
        rail: { left: rail.left, right: rail.right, top: rail.top, bottom: rail.bottom },
        navigation: navigation ? { top: navigation.top, bottom: navigation.bottom } : null,
        controls
      };
    }, fixture);

    expect(geometry.rail.left, JSON.stringify({ fixture, geometry })).toBeGreaterThanOrEqual(fixture.safe.left - 1);
    expect(geometry.rail.right, JSON.stringify({ fixture, geometry }))
      .toBeLessThanOrEqual(geometry.viewport.width - fixture.safe.right + 1);
    expect(geometry.rail.top, JSON.stringify({ fixture, geometry })).toBeGreaterThanOrEqual(fixture.safe.top - 1);
    expect(geometry.rail.bottom, JSON.stringify({ fixture, geometry }))
      .toBeLessThanOrEqual(geometry.viewport.height - fixture.safe.bottom + 1);
    expect(geometry.controls.every((control) => control.width >= 48 && control.height >= 48
      && control.left >= geometry.rail.left - 1
      && control.right <= geometry.rail.right + 1
      && control.top >= geometry.rail.top - 1
      && control.bottom <= geometry.rail.bottom + 1
      && control.hitAtCenter), JSON.stringify({ fixture, geometry })).toBe(true);
    if (fixture.width <= 900) {
      expect(geometry.rail.top, JSON.stringify({ fixture, geometry }))
        .toBeGreaterThanOrEqual((geometry.navigation?.bottom || 0) - 1);
    }
  }
});

test("mobile touch drag orbits the camera while the labeled rail changes destination", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile direct manipulation is sampled in mobile projects.");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const root = page.locator("#homePlaySplit");
  const viewport = page.locator("[data-home-orbit-viewport]");
  const stage = page.locator("[data-planet-hub]");
  const rail = page.locator(".home-orbit__rail");
  await expect(stage).toHaveAttribute("data-home-hub-destination", "forge");
  await expect(stage).toHaveAttribute("data-home-hub-phase", /ready|fallback/);
  await expect(page.locator("#homeOrbitTabJourney")).toBeEnabled();
  // Re-selecting through the authoritative tab guarantees the presentation
  // controller has received the final post-hydration availability snapshot.
  await page.locator("#homeOrbitTabForge").click();
  const stacked = await page.evaluate(() => {
    const viewportBounds = document.querySelector("[data-home-orbit-viewport]").getBoundingClientRect();
    const railBounds = document.querySelector(".home-orbit__rail").getBoundingClientRect();
    return { viewportBottom: viewportBounds.bottom, railTop: railBounds.top, railBottom: railBounds.bottom, height: innerHeight };
  });
  expect(stacked.railTop).toBeLessThan(stacked.viewportBottom);
  expect(Math.abs(stacked.viewportBottom - stacked.railBottom)).toBeGreaterThanOrEqual(8);
  expect(Math.abs(stacked.viewportBottom - stacked.railBottom)).toBeLessThanOrEqual(16);
  expect(stacked.railBottom).toBeLessThanOrEqual(stacked.height + 1);

  await stage.dispatchEvent("pointerdown", {
    pointerId: 7,
    isPrimary: true,
    button: 0,
    pointerType: "touch",
    clientX: 300,
    clientY: 300
  });
  await stage.dispatchEvent("pointermove", {
    pointerId: 7,
    isPrimary: true,
    button: 0,
    pointerType: "touch",
    clientX: 220,
    clientY: 302
  });
  await stage.dispatchEvent("pointerup", {
    pointerId: 7,
    isPrimary: true,
    button: 0,
    pointerType: "touch",
    clientX: 100,
    clientY: 302
  });
  await expect(root).toHaveAttribute("data-home-orbit-active", "forge");
  await expect(stage).toHaveAttribute("data-home-hub-destination", "forge");
  await expect(root).toHaveAttribute("data-home-orbit-dragging", "false");
  const renderer = await stage.getAttribute("data-home-hub-renderer");
  if (renderer === "webgl") {
    await expect.poll(() => stage.locator("canvas[data-planet-hub-canvas]").evaluate((element) => (
      Math.abs(Number(element.dataset.planetHubLastDragYaw))
    ))).toBeGreaterThan(.04);
  } else {
    await expect(stage).toHaveAttribute("data-home-hub-quality", "static");
  }
  expect(await viewport.evaluate((element) => getComputedStyle(element.querySelector("[data-home-orbit-track]")).transform)).toBe("none");

  await page.locator("#homeOrbitTabJourney").click();
  await expect(root).toHaveAttribute("data-home-orbit-active", "journey");
  await expect(stage).toHaveAttribute("data-home-hub-destination", "journey");

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});

test("locked-world inspection keeps its message and return control inside phone safe bounds", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Phone inspection containment is sampled in mobile projects.");
  // Let the lazy renderer (or its deliberate static fallback) finish its first
  // publish before staging this layout-only inspection fixture. Otherwise a
  // late preparation publish can legitimately restore overview mid-measure.
  await expect(page.locator("[data-planet-hub]")).toHaveAttribute("data-home-hub-renderer", /webgl|fallback/);
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 412, height: 915 }
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(120);
    const geometry = await page.evaluate(() => {
      // Stage and measure atomically. The living WebGL scene keeps publishing
      // its semantic mode on animation frames; splitting these operations can
      // let WebKit restore overview between two Playwright evaluations.
      const root = document.querySelector("#homePlaySplit");
      const inspection = root.querySelector("[data-planet-hub-world-inspection]");
      root.dataset.homeHubMode = "world-inspection";
      inspection.hidden = false;
      inspection.inert = false;
      inspection.setAttribute("aria-hidden", "false");
      const action = inspection.querySelector("[data-planet-hub-inspection-return]").getBoundingClientRect();
      const message = inspection.querySelector("[data-planet-hub-inspection-copy]").getBoundingClientRect();
      return {
        width: innerWidth,
        height: innerHeight,
        action: { left: action.left, right: action.right, top: action.top, bottom: action.bottom, width: action.width, height: action.height },
        message: { left: message.left, right: message.right, top: message.top, bottom: message.bottom },
        contentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
      };
    });

    expect(geometry.action.left).toBeGreaterThanOrEqual(0);
    expect(geometry.action.right).toBeLessThanOrEqual(geometry.width + 1);
    expect(geometry.action.top).toBeGreaterThanOrEqual(0);
    expect(geometry.action.bottom).toBeLessThanOrEqual(geometry.height + 1);
    expect(geometry.action.width).toBeGreaterThanOrEqual(44);
    expect(geometry.action.height).toBeGreaterThanOrEqual(44);
    expect(geometry.message.left).toBeGreaterThanOrEqual(0);
    expect(geometry.message.right).toBeLessThanOrEqual(geometry.width + 1);
    expect(geometry.message.top).toBeGreaterThanOrEqual(0);
    expect(geometry.message.bottom).toBeLessThanOrEqual(geometry.height + 1);
    expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.width + 1);
  }
});

test("compact Forge keeps its primary action and complete destination labels on the first frame", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Compact first-frame geometry is sampled in mobile projects.");
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 768, height: 1024 },
    { width: 568, height: 320 }
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(120);
    const geometry = await page.evaluate(() => {
      const forge = document.querySelector("#homeOrbitForge");
      const frame = document.querySelector("[data-home-orbit-viewport]").getBoundingClientRect();
      const action = document.querySelector("#primaryOrbitButton").getBoundingClientRect();
      const labels = [...document.querySelectorAll(".home-orbit__tab b")].map((label) => ({
        text: label.textContent.trim(),
        clientWidth: label.clientWidth,
        scrollWidth: label.scrollWidth
      }));
      return {
        layout: document.querySelector("#homePlaySplit").dataset.homeLayout,
        frame: { top: frame.top, bottom: frame.bottom },
        action: { top: action.top, bottom: action.bottom, width: action.width, height: action.height },
        forgeScrollHeight: forge.scrollHeight,
        forgeClientHeight: forge.clientHeight,
        labels
      };
    });
    expect(["stacked", "compact"]).toContain(geometry.layout);
    expect(geometry.action.top).toBeGreaterThanOrEqual(geometry.frame.top - 1);
    expect(geometry.action.bottom).toBeLessThanOrEqual(geometry.frame.bottom + 1);
    expect(geometry.action.width).toBeGreaterThanOrEqual(44);
    expect(geometry.action.height).toBeGreaterThanOrEqual(44);
    expect(geometry.forgeScrollHeight).toBeLessThanOrEqual(geometry.forgeClientHeight + 1);
    expect(geometry.labels.map(({ text }) => text)).toEqual(["Forge", "Journey", "Arena"]);
    expect(geometry.labels.every(({ clientWidth, scrollWidth }) => scrollWidth <= clientWidth + 1)).toBeTruthy();
  }
});

test("a real landmark click centers and restores the world without resizing or flashing chrome", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The authored landmark pick is sampled in the desktop WebGL project.");
  await page.setViewportSize({ width: 1280, height: 720 });
  const root = page.locator("#homePlaySplit");
  const stage = page.locator("[data-planet-hub]");
  const viewport = page.locator("[data-home-orbit-viewport]");
  const rail = page.locator(".home-orbit__rail");
  const card = page.locator('.home-orbit__scene[aria-hidden="false"]');
  const orbitReturn = page.locator("[data-planet-hub-orbit-return]");

  await expect(stage).toHaveAttribute("data-home-hub-renderer", "webgl");
  await page.locator("#homeOrbitTabForge").click();
  await expect(stage).toHaveAttribute("data-home-hub-phase", "ready");
  // Destination controls author the exact overview quaternion. The visible
  // Forge landmark is deliberately staged in the upper-middle of this frame.
  await page.waitForTimeout(560);
  const before = await viewport.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.click(
    before.x + before.width * .5,
    before.y + before.height * .17
  );

  await expect(root).toHaveAttribute("data-home-hub-mode", "focused");
  const focusTransition = await root.getAttribute("data-home-hub-transition");
  expect([null, "focus-in"]).toContain(focusTransition);
  // On a fast frame the semantic transition may already be complete before
  // Playwright observes it; the stable focused state is authoritative.
  await expect(stage).toHaveAttribute("data-home-hub-phase", /transitioning|ready/);
  await page.waitForTimeout(220);
  const entering = await viewport.boundingBox();
  expect(entering).toEqual(before);

  await expect(root).not.toHaveAttribute("data-home-hub-transition", /.+/, { timeout: 2_000 });
  await expect(stage).toHaveAttribute("data-home-hub-phase", "ready");
  await expect(orbitReturn).toBeVisible();
  await expect(card).toHaveCSS("opacity", "1");
  expect(await viewport.boundingBox()).toEqual(before);
  const focusedCard = await card.evaluate((element) => {
    const title = element.querySelector(".primary-orbit-panel h2")?.getBoundingClientRect();
    const action = element.querySelector(".primary-orbit-button")?.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    return {
      bounds: { left: bounds.left, right: bounds.right },
      title: title ? { left: title.left, right: title.right } : null,
      action: action ? { left: action.left, right: action.right } : null
    };
  });
  expect(focusedCard.title.left).toBeGreaterThanOrEqual(focusedCard.bounds.left - 1);
  expect(focusedCard.title.right).toBeLessThanOrEqual(focusedCard.bounds.right + 1);
  expect(focusedCard.action.left).toBeGreaterThanOrEqual(focusedCard.bounds.left - 1);
  expect(focusedCard.action.right).toBeLessThanOrEqual(focusedCard.bounds.right + 1);

  // Exit through the actual noninteractive world background with realistic
  // pointer jitter. This reproduces the user path more precisely than the
  // semantic Orbit View button and protects against moving landmarks being
  // re-raycast underneath the release point.
  await stage.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const dispatch = (type, x, y, buttons) => element.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 907,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons,
      clientX: x,
      clientY: y
    }));
    const x = bounds.right - 18;
    const y = bounds.top + 18;
    dispatch("pointerdown", x, y, 1);
    dispatch("pointermove", x - 10, y + 4, 1);
    dispatch("pointerup", x - 10, y + 4, 0);
  });
  await expect(root).toHaveAttribute("data-home-hub-mode", "overview");
  await expect(root).toHaveAttribute("data-home-hub-transition", "focus-out");
  await expect(rail).toBeHidden();
  // Stress the historical race: overview hover used to cancel focus-out at its
  // current enlarged scale, then reveal the rail around a permanently cropped
  // Earth. Cross both the active orbit zone and central dead zone while the
  // presentation transition is still in flight.
  await page.mouse.move(before.x + before.width * .84, before.y + before.height * .48, { steps: 5 });
  await page.mouse.move(before.x + before.width * .5, before.y + before.height * .5, { steps: 5 });
  await page.waitForTimeout(220);
  const returnState = await root.evaluate((element) => ({
    phase: element.dataset.homeHubPhase,
    transition: element.dataset.homeHubTransition || null
  }));
  expect([
    { phase: "transitioning", transition: "focus-out" },
    { phase: "ready", transition: null }
  ]).toContainEqual(returnState);
  expect(await viewport.boundingBox()).toEqual(before);

  await expect(root).not.toHaveAttribute("data-home-hub-transition", /.+/, { timeout: 2_000 });
  await expect(stage).toHaveAttribute("data-home-hub-phase", "ready");
  await expect(rail).toBeVisible();
  await expect(card).toHaveCSS("opacity", "1");
  const restoredCamera = await page.locator("canvas[data-planet-hub-canvas]").evaluate((element) => ({
    owner: element.dataset.planetHubCameraOwner,
    orbitBody: element.dataset.planetHubOrbitBody,
    selectedBody: element.dataset.planetHubSelectedBody,
    radius: Number(element.dataset.planetHubCameraRadius)
  }));
  expect(restoredCamera.owner).toBe("home-orbit");
  expect(restoredCamera.orbitBody).toBe("earth");
  expect(restoredCamera.selectedBody).toBe("earth");
  expect(Number.isFinite(restoredCamera.radius)).toBe(true);
  expect(restoredCamera.radius).toBeGreaterThan(0);
  expect(await viewport.boundingBox()).toEqual(before);
});

test("locked Journey card stays inside the planet stage in overview and focused layouts", async ({ page }) => {
  const root = page.locator("#homePlaySplit");
  await page.locator("#homeOrbitTabJourney").click();
  await expect(root).toHaveAttribute("data-home-orbit-active", "journey");

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 568, height: 320 },
    { width: 1280, height: 720 }
  ]) {
    await page.setViewportSize(viewport);
    for (const mode of ["overview", "focused", "overview"]) {
      await page.evaluate((nextMode) => {
        const root = document.querySelector("#homePlaySplit");
        const journey = document.querySelector("#homeOrbitJourney");
        root.dataset.homeHubMode = nextMode;
        journey.dataset.journeyReady = "false";
        document.querySelector("[data-home-journey-locked]").hidden = false;
        document.querySelector("#moonHomeRocket").hidden = true;
        document.querySelector("#moonHomeProjectVisit").hidden = true;
      }, mode);

      const geometry = await page.evaluate(() => {
        const rootElement = document.querySelector("#homePlaySplit");
        const root = rootElement.getBoundingClientRect();
        const frame = document.querySelector("[data-home-orbit-viewport]").getBoundingClientRect();
        const railElement = document.querySelector(".home-orbit__rail");
        const rail = railElement.getBoundingClientRect();
        const sceneElement = document.querySelector("#homeOrbitJourney");
        const scene = sceneElement.getBoundingClientRect();
        const locked = document.querySelector("[data-home-journey-locked]").getBoundingClientRect();
        const action = document.querySelector("[data-home-journey-locked] > button").getBoundingClientRect();
        return {
          mode: rootElement.dataset.homeHubMode,
          root: { left: root.left, right: root.right, top: root.top, bottom: root.bottom },
          frame: { left: frame.left, right: frame.right, top: frame.top, bottom: frame.bottom },
          rail: {
            top: rail.top,
            bottom: rail.bottom,
            display: getComputedStyle(railElement).display,
            visibility: getComputedStyle(railElement).visibility
          },
          scene: { left: scene.left, right: scene.right, top: scene.top, bottom: scene.bottom },
          locked: { left: locked.left, right: locked.right, top: locked.top, bottom: locked.bottom },
          action: { left: action.left, right: action.right, top: action.top, bottom: action.bottom, width: action.width, height: action.height },
          sceneClientWidth: sceneElement.clientWidth,
          sceneScrollWidth: sceneElement.scrollWidth,
          sceneClientHeight: sceneElement.clientHeight,
          sceneScrollHeight: sceneElement.scrollHeight,
          pageClientWidth: document.documentElement.clientWidth,
          pageScrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
        };
      });

      expect(geometry.scene.left).toBeGreaterThanOrEqual(geometry.frame.left - 1);
      expect(geometry.scene.right).toBeLessThanOrEqual(geometry.frame.right + 1);
      expect(geometry.scene.top).toBeGreaterThanOrEqual(geometry.frame.top - 1);
      expect(geometry.scene.bottom).toBeLessThanOrEqual(geometry.frame.bottom + 1);
      expect(geometry.locked.left).toBeGreaterThanOrEqual(geometry.scene.left - 1);
      expect(geometry.locked.right).toBeLessThanOrEqual(geometry.scene.right + 1);
      expect(geometry.locked.top).toBeGreaterThanOrEqual(geometry.scene.top - 1);
      expect(geometry.locked.bottom).toBeLessThanOrEqual(geometry.scene.bottom + 1);
      expect(geometry.action.left).toBeGreaterThanOrEqual(geometry.scene.left - 1);
      expect(geometry.action.right).toBeLessThanOrEqual(geometry.scene.right + 1);
      expect(geometry.action.top).toBeGreaterThanOrEqual(geometry.scene.top - 1);
      expect(geometry.action.bottom).toBeLessThanOrEqual(geometry.scene.bottom + 1);
      expect(geometry.action.width).toBeGreaterThanOrEqual(44);
      expect(geometry.action.height).toBeGreaterThanOrEqual(44);
      expect(geometry.sceneScrollWidth).toBeLessThanOrEqual(geometry.sceneClientWidth + 1);
      expect(geometry.sceneScrollHeight).toBeLessThanOrEqual(geometry.sceneClientHeight + 1);
      expect(geometry.pageScrollWidth).toBeLessThanOrEqual(geometry.pageClientWidth + 1);
      expect(geometry.frame.left).toBeLessThanOrEqual(geometry.root.left + 1);
      expect(geometry.frame.right).toBeGreaterThanOrEqual(geometry.root.right - 1);
      expect(geometry.frame.bottom).toBeGreaterThanOrEqual(geometry.root.bottom - 1);
      if (geometry.mode === "focused") {
        expect(geometry.rail.display).not.toBe("none");
        expect(geometry.rail.visibility).toBe("hidden");
      } else {
        expect(geometry.rail.display).not.toBe("none");
        expect(geometry.rail.visibility).toBe("visible");
      }
    }
  }
});

test("focused Journey project card preserves cinematic copy width without squashing", async ({ page }) => {
  const root = page.locator("#homePlaySplit");
  await page.locator("#homeOrbitTabJourney").click();
  await expect(root).toHaveAttribute("data-home-orbit-active", "journey");

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1280, height: 720 }
  ]) {
    for (const mode of ["overview", "focused"]) {
      await page.setViewportSize(viewport);
      await page.evaluate((nextMode) => {
        const root = document.querySelector("#homePlaySplit");
        const journey = document.querySelector("#homeOrbitJourney");
        root.dataset.homeHubMode = nextMode;
        journey.dataset.journeyReady = "true";
        document.querySelector("[data-home-journey-locked]").hidden = true;
        const voyage = document.querySelector("#moonHomeRocket");
        voyage.hidden = false;
        voyage.disabled = false;
        document.querySelector("#moonHomeProjectVisit").hidden = true;
        document.querySelector("#moonHomeRocketTitle").textContent = "Shape the Moon";
        document.querySelector("#moonHomeRocketStatus").textContent = "0 of 3 lunar memories installed";
        document.querySelector("#moonHomeRocketAction").textContent = "Continue Shape the Moon";
      }, mode);

      const geometry = await page.evaluate(() => {
        const rect = (selector) => {
          const element = document.querySelector(selector);
          const box = element.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth
          };
        };
        const overlapArea = (first, second) => (
          Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
          * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top))
        );
        const title = document.querySelector("#moonHomeRocketTitle");
        const titleStyle = getComputedStyle(title);
        const lineHeight = Number.parseFloat(titleStyle.lineHeight);
        const copy = rect(".moon-home-voyage__copy");
        const action = rect(".moon-home-voyage__action");
        return {
          scene: rect("#homeOrbitJourney"),
          voyage: rect("#moonHomeRocket"),
          copy,
          title: rect("#moonHomeRocketTitle"),
          action,
          copyActionOverlap: overlapArea(copy, action),
          titleLines: lineHeight > 0 ? title.getBoundingClientRect().height / lineHeight : 0,
          pageClientWidth: document.documentElement.clientWidth,
          pageScrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
        };
      });

      expect(geometry.voyage.left, `${mode} voyage left`).toBeGreaterThanOrEqual(geometry.scene.left - 1);
      expect(geometry.voyage.right, `${mode} voyage right`).toBeLessThanOrEqual(geometry.scene.right + 1);
      expect(geometry.copy.left, `${mode} copy left`).toBeGreaterThanOrEqual(geometry.voyage.left - 1);
      expect(geometry.copy.right, `${mode} copy right`).toBeLessThanOrEqual(geometry.voyage.right + 1);
      expect(geometry.action.left, `${mode} action left`).toBeGreaterThanOrEqual(geometry.voyage.left - 1);
      expect(geometry.action.right, `${mode} action right`).toBeLessThanOrEqual(geometry.voyage.right + 1);
      expect(geometry.action.top, `${mode} action top`).toBeGreaterThanOrEqual(geometry.voyage.top - 1);
      expect(geometry.action.bottom, `${mode} action bottom`).toBeLessThanOrEqual(geometry.voyage.bottom + 1);
      expect(geometry.copy.width, `${mode} copy width`).toBeGreaterThanOrEqual(220);
      expect(geometry.copy.scrollWidth, `${mode} copy clipping`).toBeLessThanOrEqual(geometry.copy.clientWidth + 1);
      expect(geometry.title.scrollWidth, `${mode} title clipping`).toBeLessThanOrEqual(geometry.title.clientWidth + 1);
      expect(geometry.copyActionOverlap, `${mode} copy/action overlap`).toBeLessThanOrEqual(1);
      expect(geometry.titleLines, `${mode} title lines`).toBeLessThanOrEqual(2.1);
      expect(geometry.action.width, `${mode} action width`).toBeGreaterThanOrEqual(44);
      expect(geometry.action.height, `${mode} action height`).toBeGreaterThanOrEqual(44);
      expect(geometry.pageScrollWidth, `${mode} page overflow`).toBeLessThanOrEqual(geometry.pageClientWidth + 1);
    }
  }
});
