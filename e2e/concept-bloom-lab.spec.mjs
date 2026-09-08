import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ serviceWorkers: "block" });

async function plantWord(page, word) {
  await page.locator(`#wordPalette [data-word="${word}"]`).click();
  await page.getByRole("button", { name: "Plant one as node", exact: true }).click();
}

async function connect(page, fromWord, toWord, type) {
  await page.locator(`.concept-node[data-word="${fromWord}"]`).click();
  await page.locator(`.concept-node[data-word="${toWord}"]`).click();
  await page.locator(`#bondTypePicker [data-bond-type="${type}"]`).click();
  await page.getByRole("button", { name: "Create bond", exact: true }).click();
}

async function showPanel(page, panel) {
  if (await page.locator(`#${panel}Panel`).isVisible()) return;
  await page.locator(`[data-mobile-tab="${panel}"]`).click();
  await expect(page.locator(`#${panel}Panel`)).toBeVisible();
}

test("the standalone lab builds, stresses, rewires, and previews a Concept Bloom without game APIs", async ({ page }) => {
  const apiRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
  });

  await page.goto("/play/concept-bloom-lab.html");
  await expect(page.getByRole("heading", { name: "Concept Bloom Lab", exact: true })).toBeVisible();
  await expect(page.getByText("All operations unlocked", { exact: true })).toBeVisible();
  await expect(page.getByText("Memory only", { exact: true })).toBeVisible();
  await expect(page.locator("a[href='/play/']")).toHaveCount(0);

  await page.locator('[data-recipe="Wall|Wall"]').click();
  await page.getByRole("button", { name: "Fuse pair", exact: true }).click();
  await expect(page.locator('.concept-node[data-kind="core"]')).toContainText("House");
  await expect(page.locator("#aspectName")).toHaveText("Bastion");

  for (const word of ["Energy", "Life", "Atmosphere", "Community"]) await plantWord(page, word);
  await page.keyboard.press("Escape");
  await connect(page, "Energy", "House", "flow");
  await connect(page, "House", "Atmosphere", "shell");
  await connect(page, "Atmosphere", "Life", "flow");
  await connect(page, "Energy", "Life", "flow");
  await connect(page, "Life", "Community", "bridge");

  await expect(page.locator("#bondLedger .bond-entry")).toHaveCount(5);
  await expect(page.locator("#inferredPurpose")).toContainText("Shelter 100%");
  await expect(page.locator("#inferredPurpose")).toContainText("Habitat 100%");
  await expect(page.locator("#inferredPurpose")).toContainText("Community 100%");
  await expect(page.locator("#coherenceValue")).toHaveText("100");
  await expect(page.locator("#overallState")).toHaveText("resilient");

  await showPanel(page, "inspect");
  for (const purpose of ["shelter", "habitat", "community"]) {
    await page.locator(`#purposePicker input[value="${purpose}"]`).check();
  }
  await expect(page.locator("#capacityValue")).toHaveText("9.5 / 8");
  await expect(page.locator("#overallState")).toHaveText("fragile");
  await page.getByRole("button", { name: "Run all four", exact: true }).click();
  await expect(page.locator("#stressResults .stress-result")).toHaveCount(4);
  await expect(page.locator("#stressResults")).toContainText("Meteor strike");

  await page.getByRole("button", { name: "Rewire Energy flows into House · Bastion", exact: true }).click();
  await page.getByRole("button", { name: "Swap direction", exact: true }).click();
  await page.getByRole("button", { name: "Update bond", exact: true }).click();
  await expect(page.locator("#bondLedger .bond-entry").filter({ hasText: "House · Bastion flows into Energy" }))
    .toContainText("asserted");
  await expect(page.locator("#findingList")).toContainText("asserted");

  await showPanel(page, "inspect");
  await page.getByRole("button", { name: "Rewire House · Bastion flows into Energy", exact: true }).click();
  await page.getByRole("button", { name: "Swap direction", exact: true }).click();
  await page.getByRole("button", { name: "Update bond", exact: true }).click();
  await expect(page.locator("#bondLedger .bond-entry").filter({ hasText: "Energy flows into House · Bastion" }))
    .toContainText("supported");

  await showPanel(page, "inspect");
  await page.getByRole("button", { name: /Preview world consequence/i }).click();
  await expect(page.locator("#commitDialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#commitTitle")).toHaveText("Shelter + Habitat + Community Bastion");
  await expect(page.locator(".commit-note")).toContainText("does not touch Moonhaven, ranks, profile data, or the main menu");
  expect(apiRequests).toEqual([]);
});

test("the lab remains contained, keyboard-operable, and serious-issue-free at phone size", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/concept-bloom-lab.html");

  await expect(page.locator(".mobile-tabs")).toBeVisible();
  await expect(page.locator('[data-mobile-tab="build"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#buildPanel")).toBeVisible();
  await expect(page.locator("#inspectPanel")).toBeHidden();

  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    reset: document.querySelector("#resetLab").getBoundingClientRect().toJSON(),
    bloom: document.querySelector("#bloomStage").getBoundingClientRect().toJSON()
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.reset.width).toBeGreaterThanOrEqual(44);
  expect(geometry.reset.height).toBeGreaterThanOrEqual(44);
  expect(geometry.bloom.width).toBeLessThanOrEqual(geometry.clientWidth);

  await page.locator('[data-mobile-tab="inspect"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-mobile-tab="inspect"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#buildPanel")).toBeHidden();
  await expect(page.locator("#inspectPanel")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations.filter(({ impact }) => ["serious", "critical"].includes(impact));
  expect(blocking, blocking.map(({ id, help }) => `${id}: ${help}`).join("\n")).toEqual([]);
});
