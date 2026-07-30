import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

test.beforeEach(async ({ page }) => {
  test.skip(true, "Cosmos Circuit and Star Path are in separate development and are not exposed in this release.");
  await page.route("**/api/player**", (route) => route.abort("failed"));
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
});

async function expectDialogFitsViewport(page, selector) {
  const geometry = await page.locator(selector).evaluate((dialog) => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    dialogWidth: dialog.getBoundingClientRect().width,
    dialogScrollWidth: dialog.scrollWidth,
    dialogClientWidth: dialog.clientWidth
  }));
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.dialogWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.dialogScrollWidth).toBeLessThanOrEqual(geometry.dialogClientWidth + 1);
}

async function serveQualifiedLocalCrazyPath(page) {
  const seed = `
    {
      const now = new Date();
      const dayKey = now.toISOString().slice(0, 10);
      const weekDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      weekDate.setUTCDate(weekDate.getUTCDate() + 4 - (weekDate.getUTCDay() || 7));
      const weekYear = weekDate.getUTCFullYear();
      const yearStart = new Date(Date.UTC(weekYear, 0, 1));
      const weekNumber = Math.ceil((((weekDate - yearStart) / 86400000) + 1) / 7);
      const weekKey = \`\${weekYear}-W\${String(weekNumber).padStart(2, "0")}\`;
      localStorage.setItem("constellore-cosmos-circuit-v1", JSON.stringify({
        version: 2,
        wallet: { passes: 6, dailyGrantDay: dayKey },
        claims: {
          claimedRunIds: [],
          cosmosWeekKeys: [weekKey],
          crazyAttemptWeekKeys: [],
          crazyCooldownUntilDay: ""
        },
        onboarding: { circuitSeen: true, starPathSeen: true }
      }));
    }
  `;
  await page.route("**/app.js*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${seed}\n${await response.text()}` });
  });
  await page.route("**/play/", async (route) => {
    const response = await route.fetch();
    let html = await response.text();
    html = html.replace(/<body([^>]*)>/, (tag, attributes) => (
      attributes.includes("data-runtime=")
        ? tag.replace(/data-runtime="[^"]*"/, 'data-runtime="local-practice"')
        : `<body${attributes} data-runtime="local-practice">`
    ));
    await route.fulfill({ response, body: html });
  });
}

test("Circuit and Star Path teach their fair local loops on a phone", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "One Chromium mobile path covers the feature onboarding contract.");

  await page.goto("/play/");
  await page.locator("#hubMenuButton").click();
  await page.locator("#cosmosCircuitButton").click();

  const circuit = page.locator("#cosmosCircuitDialog");
  await expect(circuit).toHaveJSProperty("open", true);
  await expect(circuit.getByRole("heading", { name: "Learn the route in under a minute" })).toBeVisible();
  await expect(page.locator("#circuitGuide")).toBeFocused();
  await expect(page.locator("#circuitLobbyFlyTab")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#circuitLobbyProgressPanel")).toBeHidden();

  await page.locator("#circuitLobbyFlyTab").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#circuitLobbyProgressTab")).toBeFocused();
  await expect(page.locator("#circuitLobbyProgressTab")).toHaveAttribute("aria-selected", "true");
  await expect(circuit.getByRole("heading", { name: "Cosmetic objectives" })).toBeVisible();
  await expect(circuit.getByRole("heading", { name: "My local leaderboard" })).toBeVisible();
  await expect(circuit).toContainText("No fake rivals or personal information");

  await page.locator("#circuitLobbyRewardsTab").click();
  await expect(circuit.getByRole("heading", { name: "Completion rewards" })).toBeVisible();
  await page.locator("#circuitLobbyRulesTab").click();
  await expect(circuit).toContainText("Launch Passes are earned and never sold");
  await expectDialogFitsViewport(page, "#cosmosCircuitDialog");

  const circuitA11y = await new AxeBuilder({ page })
    .include("#cosmosCircuitDialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(circuitA11y.violations).toEqual([]);

  await page.locator("#circuitLobbyFlyTab").click();
  await page.locator("#dismissCircuitGuide").click();
  await expect(page.locator("#circuitGuide")).toBeHidden();
  await expect(page.locator("#startCircuitPractice")).toBeFocused();
  await page.locator("#showCircuitGuide").click();
  await expect(page.locator("#circuitGuide")).toBeVisible();
  await page.locator("#closeCosmosCircuit").click();

  await page.locator("#hubMenuButton").click();
  await page.locator("#starPathButton").click();

  const path = page.locator("#starPathDialog");
  await expect(path).toHaveJSProperty("open", true);
  await expect(path.getByRole("heading", { name: "One season, two cosmetic lanes" })).toBeVisible();
  await expect(page.locator("#starPathGuide")).toBeFocused();
  await expect(path).toContainText("Supporter rewards never increase speed");
  await expectDialogFitsViewport(page, "#starPathDialog");

  await page.locator("#dismissStarPathGuide").click();
  await expect(page.locator("#starPathGuide")).toBeHidden();
  await expect(page.locator("#starPathTrack > li")).toHaveCount(12);
  await expect(page.locator("#claimAllStarPathRewards")).toBeVisible();

  const pathA11y = await new AxeBuilder({ page })
    .include("#starPathDialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(pathA11y.violations).toEqual([]);
});

test("Circuit and Observatory styles stay out of the shell and load on first use", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium covers the lazy secondary-surface boundary.");

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/play/");
  const circuitStylesheet = page.locator('link[data-optional-surface^="cosmos-circuit.css"]');
  const observatoryStylesheet = page.locator('link[data-optional-surface^="cosmetics-observatory.css"]');
  await expect(circuitStylesheet).toHaveCount(0);
  await expect(observatoryStylesheet).toHaveCount(0);

  const homeCircuit = page.locator("#cosmosCircuitHomeButton");
  await expect(homeCircuit).toBeVisible();
  await expect(homeCircuit).toContainText("Practice is free");
  const homeGeometry = await homeCircuit.evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    return {
      left: bounds.left,
      right: bounds.right,
      height: bounds.height,
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth
    };
  });
  expect(homeGeometry.left).toBeGreaterThanOrEqual(-1);
  expect(homeGeometry.right).toBeLessThanOrEqual(homeGeometry.viewportWidth + 1);
  expect(homeGeometry.height).toBeGreaterThanOrEqual(44);
  expect(homeGeometry.documentWidth).toBeLessThanOrEqual(homeGeometry.viewportWidth + 1);

  await homeCircuit.click();
  await expect(page.locator("#cosmosCircuitDialog")).toHaveJSProperty("open", true);
  await expect(circuitStylesheet).toHaveCount(1);
  await expectDialogFitsViewport(page, "#cosmosCircuitDialog");
  await page.locator("#closeCosmosCircuit").click();

  await page.locator("#customizeButton").click();
  await expect(page.locator("dialog.cosmetics-observatory")).toHaveJSProperty("open", true);
  await expect(observatoryStylesheet).toHaveCount(1);
});

test("local account and Stardust supplies stay explicit and usable on a narrow phone", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium covers the narrow local-data and earn-only store contract.");

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/play/");
  await page.getByRole("button", { name: "Open main menu" }).click();
  await page.locator("#cloudProfileGroup > summary").click();
  await expect(page.locator(".cloud-local-note")).toBeVisible();
  await expect(page.locator(".cloud-local-note")).toContainText("remain device-local");
  await expect(page.locator("#cloudSyncStatus")).toHaveText("Gameplay stays on this device");
  await expectDialogFitsViewport(page, "#hubMenuDialog");

  await page.locator('[data-close="hubMenuDialog"]').click();
  await page.locator("#senseDialog").evaluate((dialog) => dialog.showModal());

  const help = page.locator("#senseDialog");
  await expect(help).toHaveJSProperty("open", true);
  await expect(help.getByRole("button", { name: "Star Compass 90 Stardust" })).toBeVisible();
  await expect(help.getByRole("button", { name: "Streak Shield 240 Stardust" })).toBeVisible();
  await expect(help).toContainText("Neither is sold for money");
  await expectDialogFitsViewport(page, "#senseDialog");

  const helpA11y = await new AxeBuilder({ page })
    .include("#senseDialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(helpA11y.violations).toEqual([]);
});

test("Crazy Path safely confirms its local all-or-nothing launch on a phone", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "One Chromium mobile path covers the high-risk launch contract.");

  await serveQualifiedLocalCrazyPath(page);
  await page.goto("/play/");
  await page.locator("#hubMenuButton").click();
  await page.locator("#cosmosCircuitButton").click();

  const circuit = page.locator("#cosmosCircuitDialog");
  const launch = page.locator("#startCircuitCrazy");
  const confirmation = page.locator("#crazyPathConfirm");
  await expect(circuit).toHaveJSProperty("open", true);
  await expect(page.locator("#circuitGuide")).toBeHidden();
  await expect(launch).toBeEnabled();
  await expect(page.locator("#crazyPathStatus")).toContainText("Qualified this week");
  await expect(launch).toContainText("Review 3-pass entry");
  await expectDialogFitsViewport(page, "#cosmosCircuitDialog");

  await launch.click();
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("Commit 3 Launch Passes");
  await expect(confirmation).toContainText("No extraction or partial milestone reward");
  await expect(page.locator("#cancelCrazyPath")).toBeFocused();
  const confirmationGeometry = await confirmation.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      left: bounds.left,
      right: bounds.right,
      width: bounds.width,
      viewportWidth: document.documentElement.clientWidth
    };
  });
  expect(confirmationGeometry.left).toBeGreaterThanOrEqual(-1);
  expect(confirmationGeometry.right).toBeLessThanOrEqual(confirmationGeometry.viewportWidth + 1);
  expect(confirmationGeometry.width).toBeLessThanOrEqual(confirmationGeometry.viewportWidth + 1);

  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(launch).toBeFocused();
  await expect(circuit).toHaveJSProperty("open", true);
  await expect(page.locator("#circuitPassCount")).toHaveText("6");

  await launch.click();
  await expect(page.locator("#cancelCrazyPath")).toBeFocused();
  await page.locator("#confirmCrazyPath").click();

  await expect(page.locator("#circuitFlight")).toBeVisible();
  await expect(page.locator("#circuitFlightRiskBanner")).toBeVisible();
  await expect(page.locator("#circuitFlightRiskBanner")).toContainText("CRAZY PATH · ALL OR NOTHING");
  await expect(page.locator("#extractCircuitFlight")).toBeHidden();
  await expect(page.locator("#circuitPassCount")).toHaveText("3");
  await expectDialogFitsViewport(page, "#cosmosCircuitDialog");
});

test("reduced-motion presentation can change during a flight without changing controls", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium covers dynamic media preference changes.");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/");
  await page.locator("#hubMenuButton").click();
  await page.locator("#cosmosCircuitButton").click();
  await page.locator("#dismissCircuitGuide").click();
  await page.locator("#startCircuitPractice").click();

  await expect(page.locator("#circuitFlight")).toBeVisible();
  await expect(page.locator("#cosmosCircuitCanvas")).toBeFocused({ timeout: 5_000 });
  await expect(page.locator("#cosmosCircuitCanvas")).toHaveAttribute("role", "application");
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))
    .toBe(true);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))
    .toBe(false);
  await expect(page.locator("#activateCircuitPower")).toBeVisible();
  await expect(page.locator("#leaveCircuitFlight")).toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))
    .toBe(true);
  await page.locator("#pauseCircuitFlight").click();
  await expect(page.locator("#circuitFlightStatus")).toHaveText("Flight paused.");
});
