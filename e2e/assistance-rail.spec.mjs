import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

async function startChallenge(page) {
  await page.goto("/play/?challenge=1&target=Telescope&seed=73&birthday=off");
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  await page.locator("#beginMission").evaluate((button) => button.click());
  await expect(briefing).toHaveJSProperty("open", false);
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#mobileAssistToggle")).toBeVisible();
  await expect(page.locator("#mobileAssistToggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#boardAssistanceRail")).toBeHidden();
}

async function openAssistance(page) {
  const screen = page.locator("#gameScreen");
  const toggle = page.locator("#mobileAssistToggle");
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(screen).toHaveAttribute("data-mobile-surface", "assistance");
  const rail = page.locator("#boardAssistanceRail");
  await expect(rail).toBeVisible();
  await rail.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)));
  });
  return true;
}

async function installProfile(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    const profile = {
      version: 7,
      wins: 0,
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true }
    };
    localStorage.setItem("constellore-profile-v1", JSON.stringify(profile));
    localStorage.setItem("constellore-local-profile-v1", JSON.stringify(profile));
  });
  await installSeenIntroFixture(page);
}

test.beforeEach(async ({ page }) => {
  await installProfile(page);
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 820 },
  { name: "phone", width: 320, height: 568 }
]) {
  test(`assistance controls stay vertical and inside the workspace on ${viewport.name}`, async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== "chromium", "Responsive assistance geometry is covered once in Chromium.");
    test.skip(viewport.name === "phone"
      ? !testInfo.project.name.includes("mobile")
      : !testInfo.project.name.includes("desktop"), "Sample each pointer model once.");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startChallenge(page);

    {
      const toggle = page.locator("#mobileAssistToggle");
      await expect(toggle).toHaveAccessibleName("Open assistance tools");
      const toggleBox = await toggle.boundingBox();
      expect(toggleBox.width).toBeGreaterThanOrEqual(44);
      expect(toggleBox.height).toBeGreaterThanOrEqual(44);
      await openAssistance(page);
    }

    const geometry = await page.locator("#boardAssistanceRail").evaluate((rail) => {
      const rect = (element) => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
      };
      const board = rail.closest("#gameScreen");
      return {
        board: rect(board),
        rail: rect(rail),
        direction: getComputedStyle(rail).flexDirection,
        actions: [...rail.querySelectorAll("button")].map(rect)
      };
    });

    expect(geometry.direction).toBe("column");
    expect(geometry.rail.left).toBeGreaterThanOrEqual(geometry.board.left);
    expect(geometry.rail.right).toBeLessThanOrEqual(geometry.board.right);
    expect(geometry.rail.top).toBeGreaterThanOrEqual(geometry.board.top);
    expect(geometry.rail.bottom).toBeLessThanOrEqual(geometry.board.bottom);
    expect(geometry.actions).toHaveLength(5);
    for (const action of geometry.actions) {
      expect(action.width).toBeGreaterThanOrEqual(44);
      expect(action.height).toBeGreaterThanOrEqual(44);
    }
    expect(geometry.actions.every((action, index) => index === 0 || action.top >= geometry.actions[index - 1].bottom)).toBe(true);
    for (const [shortcut, key] of [["quickTipShortcut", "1"], ["senseShortcut", "2"], ["wordGiftShortcut", "3"], ["revealShortcut", "4"]]) {
      await expect(page.locator(`#${shortcut}`)).toHaveAttribute("aria-keyshortcuts", key);
    }
    if (viewport.name === "phone") {
      await expect(page.locator("#boardAssistanceRail kbd")).toHaveCount(4);
      for (const badge of await page.locator("#boardAssistanceRail kbd").all()) await expect(badge).toBeHidden();
    }
    expect(await page.locator("html").evaluate((html) => html.scrollWidth <= html.clientWidth + 1)).toBe(true);
  });
}

test("1-4 activate the matching board assistance controls while typing remains safe", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Keyboard assistance dispatch is covered once in Chromium.");
  let tipCalls = 0;
  await page.route("**/api/run/tip", async (route) => {
    tipCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        remaining: Math.max(0, 3 - tipCalls),
        scoreSafe: false,
        scoreMultiplier: Math.max(.7, 1 - tipCalls * .1),
        text: "A route signal from shortcut 1.",
        used: tipCalls
      })
    });
  });
  await startChallenge(page);

  await page.keyboard.press("1");
  await expect.poll(() => tipCalls).toBe(1);
  await expect(page.locator("#hintObjectiveText")).toHaveText("A route signal from shortcut 1.");

  await page.keyboard.press("2");
  await expect(page.locator("#senseShortcut")).toHaveClass(/is-armed/);
  await page.keyboard.press("3");
  await expect(page.locator("#wordGiftShortcut")).toHaveClass(/is-armed/);

  await page.keyboard.press("4");
  await expect(page.locator("#revealDialog")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#revealDialog")).toHaveJSProperty("open", false);

  let search = page.locator("#inventorySearch");
  if (await page.locator("#gameScreen").getAttribute("data-play-layout") !== "wide") {
    await page.locator("#constellationBloomTrigger").click();
    search = page.locator("#constellationBloomSearch");
    await expect(page.locator("#constellationBloomPanel")).not.toHaveAttribute("inert", "");
  } else if (!(await search.isVisible())) {
    // The desktop shelf intentionally omits search for the four-word starter
    // inventory. Expose the existing control here so this test can isolate the
    // keyboard-shortcut guard without requiring a large persisted profile.
    await page.locator(".inventory").evaluate((inventory) => inventory.classList.add("has-many-words"));
  }
  await expect(search).toBeVisible();
  await search.focus();
  await expect(search).toBeFocused();
  await page.keyboard.type("4");
  await expect(search).toHaveValue("4");
  await expect(page.locator("#revealDialog")).toHaveJSProperty("open", false);
});

test("an exhausted allowance becomes a plus and opens its contextual supply explanation", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The empty-stock routing contract is covered once in Chromium.");
  let tipCalls = 0;
  await page.route("**/api/run/tip", async (route) => {
    tipCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        remaining: Math.max(0, 3 - tipCalls),
        scoreSafe: false,
        scoreMultiplier: Math.max(.7, 1 - tipCalls * .1),
        text: `Route Signal ${tipCalls}`,
        used: tipCalls
      })
    });
  });
  await startChallenge(page);

  const signal = page.locator("#quickTipShortcut");
  for (const remaining of [2, 1, 0]) {
    await openAssistance(page);
    await signal.click();
    await expect.poll(() => tipCalls).toBe(3 - remaining);
    await expect(page.locator("#quickTipShortcutCount")).toHaveText(remaining ? String(remaining) : "+");
  }
  await expect(signal).toBeEnabled();
  await openAssistance(page);
  await signal.click();

  const supplies = page.locator("#stardustDialog");
  await expect(supplies).toHaveJSProperty("open", true);
  await expect(page.locator("#stardustDialogContext")).toContainText(/Route Signal/i);
  await expect(page.locator("#routeSignalSupply")).toBeFocused();
  await expect(page.locator("#routeSignalRefillStatus")).toContainText(/new orbit|0|empty/i);
});

test("the bottom question mark opens Help and Help explicitly hands off to Stardust Supplies", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Dialog separation is covered once in Chromium.");
  await startChallenge(page);

  await openAssistance(page);
  await page.locator("#senseButton").click();
  const help = page.locator("#senseDialog");
  const supplies = page.locator("#stardustDialog");
  await expect(help).toHaveJSProperty("open", true);
  await expect(help.getByRole("heading", { name: "Need help?" })).toBeVisible();
  await expect(help.locator(".stardust-store")).toHaveCount(0);

  await page.locator("#powerupShopShortcut").click();
  await expect(help).toHaveJSProperty("open", false);
  await expect(supplies).toHaveJSProperty("open", true);
  await expect(supplies.getByRole("heading", { name: "Stardust supplies" })).toBeVisible();
});
