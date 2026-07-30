import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const ACTIVE_RUN_KEY = "constellore-active-run-v1";

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Path Guard client preflight and responsive geometry are covered on Chromium desktop and phone."
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const marker = "constellore-path-guard-e2e-ready-v1";
    if (sessionStorage.getItem(marker) === "true") return;
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(marker, "true");
    localStorage.setItem("constellore-profile-v1", JSON.stringify({
      version: 7,
      wins: 0,
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true }
    }));
  });
  await installSeenIntroFixture(page);
});

async function startBronzeReach(page) {
  await page.goto("/play/");
  await expect(page.locator("#startScreen")).toBeVisible();
  await expect(page.locator("#primaryOrbitButton")).toBeVisible();
  await page.locator("#primaryOrbitButton").click();

  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  const guardNote = page.locator("#missionAdaptiveNote");
  await expect(guardNote).toBeVisible();
  await expect(guardNote).toContainText("Path Guard on");
  await expect(guardNote).toHaveAttribute(
    "aria-label",
    /locks route-diverging pairings without using a move/i
  );

  await page.locator("#beginMission").click();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#lawPill")).toContainText("PATH GUARD");
}

async function selectInventoryPair(page, a, b) {
  const first = page.locator(`.inventory-word[data-word="${a}"]`);
  const second = page.locator(`.inventory-word[data-word="${b}"]`);
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await first.click();
  await expect(page.locator("#tapChainStatus")).toBeVisible();
  await second.click();
}

async function expectWrongPathFeedback(page, pattern) {
  const note = page.locator("#alchemyNote");
  await expect(note).toBeVisible();
  await expect(note).toHaveClass(/wrong-path/);
  await expect(note).not.toHaveClass(/error/);
  await expect(note).toContainText(pattern);
  await expect(note).toContainText(/move unchanged/i);
  await expect(note).toHaveAttribute("aria-hidden", "true");

  const announcement = page.locator("#boardAnnouncement");
  await expect(announcement).toHaveAttribute("role", "status");
  await expect(announcement).toHaveAttribute("aria-live", "polite");
  await expect(announcement).toHaveAttribute("aria-atomic", "true");
  await expect(announcement).toContainText(pattern);

  const geometry = await note.evaluate((element) => {
    const note = element.getBoundingClientRect();
    const board = document.querySelector("#board").getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      note: { left: note.left, right: note.right, width: note.width },
      board: { left: board.left, right: board.right, width: board.width }
    };
  });
  expect(geometry.note.width).toBeGreaterThan(0);
  expect(geometry.note.width).toBeLessThanOrEqual(geometry.board.width + 1);
  expect(geometry.note.left).toBeGreaterThanOrEqual(geometry.board.left - 1);
  expect(geometry.note.right).toBeLessThanOrEqual(geometry.board.right + 1);
  expect(geometry.note.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.note.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
}

test("wrong paths keep words and moves, survive resume, and preflight remembered retries", async ({ page }) => {
  let combineRequests = 0;
  await page.route("**/api/combine", async (route) => {
    combineRequests += 1;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: "That pairing is a wrong path for this target.",
        code: "wrong_path",
        pathGuard: { version: 1, blocked: true }
      })
    });
  });

  await startBronzeReach(page);
  const moves = page.locator("#movesValue");
  await expect(moves).toHaveText("0");

  await selectInventoryPair(page, "earth", "water");
  await expectWrongPathFeedback(page, /WRONG PATH/);
  await expect(page.locator("#expectedPairFeedback")).toBeHidden();
  await expect(page.locator("#runIqValue")).toHaveText("0");
  await expect(moves).toHaveText("0");
  await expect(page.locator('.board-word[data-word="earth"]')).toHaveCount(1);
  await expect(page.locator('.inventory-word[data-word="earth"]')).toBeVisible();
  await expect(page.locator('.inventory-word[data-word="water"]')).toBeVisible();
  expect(combineRequests).toBe(1);

  const boardEarth = page.locator('.board-word[data-word="earth"]').first();
  await expect(boardEarth).toHaveAttribute(
    "aria-label",
    /Press to arm, then press another word to combine/i
  );
  await expect.poll(async () => page.evaluate((key) => {
    const snapshot = JSON.parse(localStorage.getItem(key) || "null");
    return snapshot?.progress?.pathGuardBlockedPairs || [];
  }, ACTIVE_RUN_KEY)).toEqual(['["earth","water"]']);

  await page.reload();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#movesValue")).toHaveText("0");
  const restoredEarth = page.locator('.board-word[data-word="earth"]').first();
  await expect(restoredEarth).toBeVisible();
  await restoredEarth.click();
  await expect(restoredEarth).toHaveAttribute("aria-pressed", "true");
  await page.locator('.inventory-word[data-word="water"]').click();

  await expectWrongPathFeedback(page, /already checked this connection/i);
  await expect(page.locator("#movesValue")).toHaveText("0");
  expect(combineRequests).toBe(1);

  await expect(restoredEarth).not.toHaveClass(/wrong-path/, { timeout: 2_000 });
  await expect(restoredEarth).toHaveAttribute("aria-pressed", "true");
  await restoredEarth.focus();
  await restoredEarth.press("Enter");
  await expect(restoredEarth).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#alchemyNote")).toContainText(/Tap chain cancelled/i);
  await expect(page.locator("#alchemyNote")).not.toHaveClass(/wrong-path/);
  await expect(page.locator("#boardAnnouncement")).toContainText(/Tap chain cancelled/i);
  expect(combineRequests).toBe(1);
});
