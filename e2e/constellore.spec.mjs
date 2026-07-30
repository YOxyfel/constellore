import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(overflow.page, `page width ${overflow.page}px exceeds viewport ${overflow.viewport}px`).toBeLessThanOrEqual(overflow.viewport + 1);
}

async function visibleTextBelow15px(page) {
  return page.evaluate(() => [...document.querySelectorAll("body *")]
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const text = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      return text && rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden";
    })
    .map((element) => ({ tag: element.tagName, id: element.id, className: element.className, text: element.textContent.trim().slice(0, 60), size: Number.parseFloat(getComputedStyle(element).fontSize) }))
    .filter((item) => item.size < 14.9));
}

async function activateInventoryWord(page, word) {
  const item = page.locator(`.inventory-word[data-word="${word}"]`);
  await expect(item).toBeVisible();
  await expect(item).toBeEnabled();
  await item.click();
}

async function installPresentationExclusionAudit(page) {
  await page.evaluate(() => {
    const gate = document.querySelector("#cosmicGate");
    const celebration = document.querySelector(".cosmic-gate__first-discovery");
    const result = document.querySelector("#resultDialog");
    const home = document.querySelector("#startScreen");
    const menu = document.querySelector("#hubMenuDialog");
    const collisions = [];
    const record = () => {
      const celebrationVisible = celebration && !celebration.hidden;
      const resultOpen = result?.open === true;
      const gateMoving = ["closing", "opening"].includes(gate?.dataset.phase || "");
      if (resultOpen && celebrationVisible) collisions.push("result + celebration");
      if (celebrationVisible && gateMoving) collisions.push(`celebration + gate ${gate.dataset.phase}`);
      if (celebrationVisible && home && !home.hidden) collisions.push("celebration + home");
      if (celebrationVisible && menu?.open) collisions.push("celebration + menu");
    };
    const observer = new MutationObserver(record);
    for (const element of [gate, celebration, result, home, menu].filter(Boolean)) {
      observer.observe(element, { attributes: true, attributeFilter: ["data-phase", "hidden", "open"] });
    }
    window.__presentationExclusionAudit = { collisions, observer };
    record();
  });
}

async function expectNoPresentationCollisions(page) {
  const collisions = await page.evaluate(() => {
    const audit = window.__presentationExclusionAudit;
    audit?.observer?.disconnect();
    return [...new Set(audit?.collisions || [])];
  });
  expect(collisions).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const cleanMarker = "constellore-e2e-storage-clean-v1";
    if (sessionStorage.getItem(cleanMarker) === "true") return;
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(cleanMarker, "true");
  });
  await installSeenIntroFixture(page);
});

test("marketing path makes the playable beta obvious and mobile-safe", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Constellore/i);
  await expect(page.getByRole("heading", { name: "Make the word." })).toBeVisible();
  await expect(page.locator(".hero-lede")).toContainText(/make the target word/i);
  const primaryPlay = page.locator(".hero-copy a.hero-button");
  await expect(primaryPlay).toBeVisible();
  await expect(primaryPlay).toHaveAttribute("href", /\/play\/$/);
  await expectNoHorizontalOverflow(page);
  expect(await visibleTextBelow15px(page)).toEqual([]);
});

test("a first-time player opens directly into a guaranteed game, celebrates, and reaches the next-game menu", async ({ page }) => {
  await page.goto("/play/");
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#startScreen")).toBeHidden();
  await expect(page.locator("#cosmicGate")).toBeHidden();
  await expect(page.locator("#missionBriefingDialog")).toHaveJSProperty("open", false);
  await expect(page.locator("#targetWord")).toHaveText("Mud");
  await expect(page.locator("#firstOrbitInstruction")).toHaveText("Tap Earth, then tap Water.");
  const incomplete = await page.evaluate(() => {
    const raw = localStorage.getItem("constellore-local-profile-v1")
      || localStorage.getItem("constellore-profile-v1");
    return JSON.parse(raw || "null")?.firstOrbit;
  });
  expect(incomplete).toEqual({ seen: true, completed: false });

  await page.reload();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#targetWord")).toHaveText("Mud");
  await installPresentationExclusionAudit(page);

  await activateInventoryWord(page, "earth");
  await activateInventoryWord(page, "water");
  await expect(page.locator('.inventory-word[data-word="mud"]')).toBeVisible();
  await expect(page.locator(".cosmic-gate__first-discovery")).toBeVisible({ timeout: 4_000 });
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", true, { timeout: 6_000 });
  await expect(page.locator("#resultTitle")).toHaveText("Your first discovery: Mud!");
  await expect(page.locator("#resultDetails")).toBeHidden();
  await expect(page.locator("#resultPrimary")).toContainText("Next game");
  await expect(page.locator("#resultPrimary")).toBeFocused();
  await expect(page.locator(".cosmic-gate__first-discovery")).toBeHidden();
  await expect(page.locator("#cosmicGate")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#cosmicGate")).toHaveAttribute("data-phase", "closed");
  await expectNoPresentationCollisions(page);
  const completion = await page.evaluate(() => {
    const raw = localStorage.getItem("constellore-local-profile-v1")
      || localStorage.getItem("constellore-profile-v1");
    return JSON.parse(raw || "null")?.firstOrbit;
  });
  expect(completion).toEqual({ seen: true, completed: true });

  await page.locator("#resultPrimary").click();
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", false, { timeout: 8_000 });
  await expect(page.locator("#targetWord")).toHaveText("Mountain", { timeout: 8_000 });
  await expect(page.locator("#missionBriefingDialog")).toHaveJSProperty("open", true, { timeout: 8_000 });

  await page.reload();
  await expect(page.locator("#startScreen")).toBeVisible();
  await expect(page.locator("#gameScreen")).toBeHidden();
  const customize = page.locator("#customizeButton");
  await expect(customize).toBeVisible();
  await expect(customize).toContainText("Customize");
  const customizeBox = await customize.boundingBox();
  expect(customizeBox).not.toBeNull();
  expect(customizeBox.width).toBeGreaterThanOrEqual(44);
  expect(customizeBox.height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);
  await customize.click();
  const observatory = page.locator(".cosmetics-observatory");
  await expect(observatory).toHaveJSProperty("open", true);
  await expect(observatory.getByRole("heading", { name: "Cosmetics Observatory" })).toBeVisible();
  await observatory.getByRole("button", { name: "Close Cosmetics Observatory" }).click();
  await expect(customize).toBeFocused();
});

test("the full-motion first discovery launches all space-confetti particles without overlapping the result", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/play/");
  await installPresentationExclusionAudit(page);
  await activateInventoryWord(page, "earth");
  await activateInventoryWord(page, "water");
  await expect(page.locator('.inventory-word[data-word="mud"]')).toBeVisible();
  await expect(page.locator("#cosmicGate")).toBeHidden();
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", false);
  await page.waitForTimeout(650);
  await expect(page.locator("#cosmicGate")).toBeHidden();
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", false);
  await expect(page.locator(".cosmic-gate__first-discovery")).toBeVisible({ timeout: 4_000 });
  await expect(page.locator(".cosmic-gate__first-discovery-particle")).toHaveCount(42);
  const animationNames = await page.locator(".cosmic-gate__first-discovery-particle").evaluateAll(
    (particles) => [...new Set(particles.map((particle) => getComputedStyle(particle).animationName))]
  );
  expect(animationNames.some((name) => name !== "none")).toBeTruthy();
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", true, { timeout: 6_000 });
  await expect(page.locator(".cosmic-gate__first-discovery")).toBeHidden();
  await expect(page.locator("#cosmicGate")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#cosmicGate")).toHaveAttribute("data-phase", "closed");
  await expectNoPresentationCollisions(page);
});

test("the first-discovery layer honors reduced-motion preferences", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/");
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  await expect(page.locator(".cosmic-gate__confetti")).toHaveCSS("display", "none");
  const raysDisplay = await page.locator(".cosmic-gate__first-discovery").evaluate(
    (layer) => getComputedStyle(layer, "::before").display
  );
  expect(raysDisplay).toBe("none");
});

test("PWA metadata advertises wide and narrow install previews", async ({ request }) => {
  let response = await request.get("/manifest.webmanifest");
  if (!response.ok()) response = await request.get("/play/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.screenshots.some((shot) => shot.form_factor === "wide")).toBeTruthy();
  expect(manifest.screenshots.some((shot) => shot.form_factor === "narrow")).toBeTruthy();
  expect(manifest.shortcuts.some((shortcut) => shortcut.url.includes("mode=daily"))).toBeTruthy();
  for (const screenshot of manifest.screenshots) {
    const screenshotResponse = await request.get(new URL(screenshot.src, response.url()).href);
    expect(screenshotResponse.ok(), `${screenshot.src} must be reachable`).toBeTruthy();
    expect(screenshotResponse.headers()["content-type"]).toMatch(/^image\/png\b/i);
    const data = await screenshotResponse.body();
    expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const [expectedWidth, expectedHeight] = screenshot.sizes.split("x").map(Number);
    expect(data.readUInt32BE(16)).toBe(expectedWidth);
    expect(data.readUInt32BE(20)).toBe(expectedHeight);
  }
});

test("landing and playable-board surfaces have no serious WCAG violations", async ({ page }) => {
  for (const path of ["/", "/play/"]) {
    await page.goto(path);
    if (path === "/play/") {
      await expect(page.locator(".first-open-cinematic")).toHaveCount(0);
      await expect(page.locator("#gameScreen")).toBeVisible();
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
    expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
  }
});

test("beta privacy, terms, and support information is public and readable", async ({ page, browserName }) => {
  for (const [path, heading] of [["/privacy.html", "Privacy notice"], ["/terms.html", "Beta terms"], ["/support.html", "Beta support"]]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\bTODO\b|\bTBD\b/);
    // All policy documents share the same stylesheet. Keep their semantic
    // smoke coverage cross-engine, but run computed-layout audits once in
    // Chromium: Firefox can sporadically stall its page-evaluation IPC on
    // these long static documents even after every visible assertion passes.
    if (browserName === "chromium") {
      await expectNoHorizontalOverflow(page);
      expect(await visibleTextBelow15px(page)).toEqual([]);
    }
  }
});
