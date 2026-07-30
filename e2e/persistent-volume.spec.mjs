import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

test.skip(({ browserName }) => browserName !== "chromium", "Responsive sound-control geometry is covered once in Chromium.");

const intersects = (left, right) => !(
  left.right <= right.left
  || right.right <= left.left
  || left.bottom <= right.top
  || right.bottom <= left.top
);

async function bounds(locator) {
  return locator.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    return {
      left: rectangle.left,
      right: rectangle.right,
      top: rectangle.top,
      bottom: rectangle.bottom,
      width: rectangle.width,
      height: rectangle.height
    };
  });
}

async function expectControlFits(page, selector) {
  const control = page.locator(selector);
  await expect(control).toBeVisible();
  await expect(control.locator(":scope > output")).toBeVisible();
  await expect.poll(async () => {
    const sizes = await control.locator(":scope > button").evaluateAll((buttons) => (
      buttons.map((button) => {
        const rectangle = button.getBoundingClientRect();
        return { width: rectangle.width, height: rectangle.height };
      })
    ));
    return sizes.every(({ width, height }) => width >= 44 && height >= 44);
  }, {
    message: `${selector} touch targets should settle at the 44px floor`
  }).toBe(true);
  const geometry = await bounds(control);
  const viewport = page.viewportSize();
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(viewport.width + 1);
  expect(geometry.top).toBeGreaterThanOrEqual(-1);
  expect(geometry.bottom).toBeLessThanOrEqual(viewport.height + 1);
  for (const button of await control.locator(":scope > button").all()) {
    const buttonBounds = await bounds(button);
    expect(buttonBounds.width).toBeGreaterThanOrEqual(44);
    expect(buttonBounds.height).toBeGreaterThanOrEqual(44);
  }
}

async function expectMixerFits(page, controlSelector) {
  const control = page.locator(controlSelector);
  await control.locator("summary").click();
  const panel = control.locator(".vpanel");
  await expect(panel).toBeVisible();
  const geometry = await bounds(panel);
  const viewport = page.viewportSize();
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(viewport.width + 1);
  for (const slider of await panel.locator('input[type="range"]').all()) {
    expect((await bounds(slider)).height).toBeGreaterThanOrEqual(44);
  }
}

async function enterFirstOrbit(page) {
  const cinematic = page.locator(".first-open-cinematic");
  await expect(cinematic).toBeVisible();
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expect(cinematic).toHaveCount(0);
  await expect(page.locator("#startScreen")).toBeVisible();
  await expect(page.locator("#gameScreen")).toBeHidden();

  const primaryOrbit = page.locator("#primaryOrbitButton");
  await expect(primaryOrbit).toBeVisible();
  await expect(primaryOrbit).toBeEnabled();
  await primaryOrbit.click();
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  await briefing.locator("#beginMission").click();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#cosmicGate")).toBeHidden();
}

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

for (const viewport of [
  { width: 320, height: 568, probe: "#tidyBoard" },
  { width: 655, height: 720, probe: "#resetBoard" },
  { width: 655, height: 360, probe: "#resetBoard" }
]) {
  test(`the play volume dock does not intercept board tools at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installReturningProfile(page);
    await page.goto("/play/?challenge=1&target=Telescope&seed=73");
    await expect(page.locator("#missionBriefingDialog")).toHaveJSProperty("open", true, { timeout: 30_000 });
    await page.locator("#beginMission").click();
    await expect(page.locator("#gameScreen")).toBeVisible();

    const volume = page.locator("#playVolumeControl");
    const toolbar = page.locator("#boardQuickTools");
    await expectControlFits(page, "#playVolumeControl");
    await expect(toolbar).toBeVisible();
    expect(intersects(await bounds(volume), await bounds(toolbar))).toBe(false);

    const intercepted = await toolbar.locator(":scope > button").evaluateAll((buttons) => (
      buttons.flatMap((button) => {
        const rectangle = button.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rectangle.left + rectangle.width / 2,
          rectangle.top + rectangle.height / 2
        );
        return hit?.closest?.("#playVolumeControl") ? [button.id] : [];
      })
    ));
    expect(intercepted).toEqual([]);

    await page.keyboard.down("Shift");
    const alchemyNote = page.locator("#alchemyNote");
    await expect(alchemyNote).toBeVisible();
    expect(intersects(await bounds(volume), await bounds(alchemyNote))).toBe(false);
    await page.keyboard.up("Shift");

    const probe = page.locator(viewport.probe);
    await probe.evaluate((button) => { button.disabled = false; });
    await probe.click();
  });
}

test("play and pause expose synchronized, viewport-safe volume controls on a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installReturningProfile(page);
  await page.goto("/play/?challenge=1&target=Telescope&seed=73");
  await expect(page.locator("#missionBriefingDialog")).toHaveJSProperty("open", true, { timeout: 30_000 });
  await page.locator("#beginMission").click();
  await expect(page.locator("#gameScreen")).toBeVisible();

  await expectControlFits(page, "#playVolumeControl");
  const playControl = await bounds(page.locator("#playVolumeControl"));
  const playNav = await bounds(page.locator(".game-nav"));
  expect(playControl.top).toBeGreaterThanOrEqual(playNav.top);
  expect(playControl.bottom).toBeLessThanOrEqual(playNav.bottom);
  await page.locator("#playVolumeDown").click();
  await expect(page.locator("#playMasterVolumeQuickValue")).toHaveText("70%");
  await expectMixerFits(page, "#playVolumeControl");
  await page.locator("#playVolumeControl summary").click();

  await page.locator("#pauseRunButton").click();
  await expect(page.locator("#pauseDialog")).toHaveJSProperty("open", true);
  await expectControlFits(page, "#pauseVolumeControl");
  await expect(page.locator("#pauseMasterVolumeQuickValue")).toHaveText("70%");
  await page.locator("#pauseVolumeUp").click();
  await expect(page.locator("#pauseMasterVolumeQuickValue")).toHaveText("75%");
  await expect(page.locator("#playMasterVolumeQuickValue")).toHaveText("75%");
  await expectMixerFits(page, "#pauseVolumeControl");
});

test("the first-orbit lesson and persistent volume stepper do not overlap on a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto("/play/");
  await enterFirstOrbit(page);
  await expect(page.locator("#firstOrbitGuide")).toBeVisible();
  await expectControlFits(page, "#playVolumeControl");
  expect(intersects(await bounds(page.locator("#playVolumeControl")), await bounds(page.locator("#firstOrbitGuide")))).toBe(false);
});

test("Circuit keeps its sound controls clear of the title and flight close action", async ({ page }) => {
  test.skip(true, "Cosmos Circuit is in separate development and is not exposed in this release.");
  await page.setViewportSize({ width: 320, height: 568 });
  await installReturningProfile(page);
  await page.route("**/api/player**", (route) => route.abort("failed"));
  await page.goto("/play/");
  await page.locator("#hubMenuButton").click();
  await page.locator("#cosmosCircuitButton").click();
  const circuitDialog = page.locator("#cosmosCircuitDialog");
  await expect(circuitDialog).toHaveJSProperty("open", true);
  await circuitDialog.evaluate((dialog) => { dialog.scrollTop = 0; });

  await expectControlFits(page, "#circuitVolumeControl");
  const lobbyControl = await bounds(page.locator("#circuitVolumeControl"));
  expect(intersects(lobbyControl, await bounds(page.locator("#cosmosCircuitTitle")))).toBe(false);
  expect(intersects(lobbyControl, await bounds(page.locator("#closeCosmosCircuit")))).toBe(false);
  await expectMixerFits(page, "#circuitVolumeControl");
  await page.locator("#circuitVolumeControl summary").click();

  await page.locator("#dismissCircuitGuide").click();
  await page.locator("#startCircuitPractice").click();
  await expect(page.locator("#circuitFlight")).toBeVisible();
  await expectControlFits(page, "#circuitVolumeControl");
  const flightControl = await bounds(page.locator("#circuitVolumeControl"));
  expect(intersects(flightControl, await bounds(page.locator("#cosmosCircuitTitle")))).toBe(false);
  expect(intersects(flightControl, await bounds(page.locator("#closeCosmosCircuit")))).toBe(false);

  await page.locator("#circuitVolumeControl summary").click();
  const master = page.locator("#circuitMasterVolumePreference");
  await master.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(master).toHaveValue("0.7");
  await expect(page.locator("#circuitMasterVolumeQuickValue")).toHaveText("70%");
});
