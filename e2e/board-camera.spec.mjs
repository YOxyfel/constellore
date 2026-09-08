import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

test.describe.configure({ mode: "serial" });

const PROFILE = JSON.stringify({
  version: 10,
  wins: 2,
  discovered: ["Earth", "Water", "Fire", "Air"],
  firstOrbit: { seen: true, completed: true },
  secondOrbit: { seen: true, completed: true }
});

async function startChallenge(page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", PROFILE],
      ["constellore-local-profile-v1", PROFILE]
    ]
  });
  await page.goto("/play/?challenge=1&target=Telescope&seed=73&birthday=off");
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true, { timeout: 45_000 });
  await page.locator("#beginMission").evaluate((button) => button.click());
  await expect(briefing).toHaveJSProperty("open", false);
  await expect(page.locator("#gameScreen")).toHaveAttribute("data-play-phase", "normal");
  await expect(page.locator("#board")).toHaveAttribute("data-camera-zoom", "1.0000");
}

async function addEarth(page) {
  const item = page.locator('.inventory-word[data-word="earth"]');
  await expect(item).toBeVisible();
  await item.click({ force: true });
  const node = page.locator('.board-word[data-word="earth"]');
  await expect(node).toHaveCount(1);
  await node.evaluate((element) => Promise.all(
    element.getAnimations()
      .filter((animation) => animation.animationName === "appear")
      .map((animation) => animation.finished.catch(() => undefined))
  ));
  return node;
}

async function blankBoardPoint(page) {
  return page.locator("#board").evaluate((board) => {
    const rect = board.getBoundingClientRect();
    const protectedSelector = [
      ".board-word", ".constellation-bloom", ".board-top-hud", ".board-bottom-hud",
      ".board-camera-controls", ".board-assistance-rail", ".board-guide", ".help-nudge",
      "button", "a", "input", "select", "textarea", "[role='button']"
    ].join(",");
    for (const [xPart, yPart] of [
      [.72, .68], [.28, .68], [.72, .42], [.28, .42], [.5, .78], [.5, .5]
    ]) {
      const x = rect.left + rect.width * xPart;
      const y = rect.top + rect.height * yPart;
      const target = document.elementFromPoint(x, y);
      if (target && board.contains(target) && !target.closest(protectedSelector)) return { x, y };
    }
    throw new Error("Could not find an empty camera-drag point on the board.");
  });
}

async function cameraState(page) {
  return page.locator("#board").evaluate((board) => ({
    x: Number(board.dataset.cameraX),
    y: Number(board.dataset.cameraY),
    zoom: Number(board.dataset.cameraZoom),
    dragging: board.dataset.cameraDragging
  }));
}

async function nodeState(node) {
  return node.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      worldX: Number.parseFloat(element.style.getPropertyValue("--x")),
      worldY: Number.parseFloat(element.style.getPropertyValue("--y"))
    };
  });
}

const expectNear = (actual, expected, tolerance = 1.5) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
};

test("empty-board drag pans only the camera world", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Board camera pointer math is sampled once in desktop Chromium.");
  await startChallenge(page);
  const node = await addEarth(page);
  const board = page.locator("#board");
  const beforeCamera = await cameraState(page);
  const beforeNode = await nodeState(node);
  const beforeTools = await page.locator("#boardQuickTools").boundingBox();
  const start = await blankBoardPoint(page);
  const movement = { x: 96, y: 54 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + movement.x, start.y + movement.y, { steps: 6 });
  await expect(board).toHaveAttribute("data-camera-dragging", "true");
  await page.mouse.up();
  await expect(board).toHaveAttribute("data-camera-dragging", "false");

  const afterCamera = await cameraState(page);
  const afterNode = await nodeState(node);
  const afterTools = await page.locator("#boardQuickTools").boundingBox();
  expectNear(afterCamera.x - beforeCamera.x, movement.x);
  expectNear(afterCamera.y - beforeCamera.y, movement.y);
  expectNear(afterNode.left - beforeNode.left, movement.x);
  expectNear(afterNode.top - beforeNode.top, movement.y);
  expectNear(afterNode.worldX, beforeNode.worldX, .001);
  expectNear(afterNode.worldY, beforeNode.worldY, .001);
  expectNear(afterTools.x, beforeTools.x, .25);
  expectNear(afterTools.y, beforeTools.y, .25);
});

test("wheel, Zoom out, and Reset view control scale without clearing words", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Board camera controls are sampled once in desktop Chromium.");
  await startChallenge(page);
  const node = await addEarth(page);
  const beforeNode = await nodeState(node);

  await page.mouse.move(beforeNode.centerX, beforeNode.centerY);
  await page.mouse.wheel(0, 240);
  await expect.poll(async () => (await cameraState(page)).zoom).toBeLessThan(1);
  const wheelNode = await nodeState(node);
  expectNear(wheelNode.centerX, beforeNode.centerX);
  expectNear(wheelNode.centerY, beforeNode.centerY);
  await page.locator("#resetBoardView").click();
  await expect.poll(async () => (await cameraState(page)).zoom).toBe(1);

  await page.locator("#boardZoomOut").click();
  await expect.poll(async () => (await cameraState(page)).zoom).toBeLessThan(1);
  await expect(page.locator("#resetBoardView")).toBeEnabled();

  await page.locator("#resetBoardView").click();
  await expect.poll(async () => {
    const camera = await cameraState(page);
    return [camera.x, camera.y, camera.zoom, camera.dragging];
  }).toEqual([0, 0, 1, "false"]);
  await expect(page.locator("#resetBoardView")).toBeDisabled();
  await expect(node).toHaveCount(1);
  const afterNode = await nodeState(node);
  expectNear(afterNode.worldX, beforeNode.worldX, .001);
  expectNear(afterNode.worldY, beforeNode.worldY, .001);
});

test("word drag remains one-to-one in screen space under zoom", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Zoomed word-drag math is sampled once in desktop Chromium.");
  await startChallenge(page);
  const node = await addEarth(page);
  await page.locator("#boardZoomOut").click();
  await page.locator("#boardZoomOut").click();
  await expect.poll(async () => (await cameraState(page)).zoom).toBeLessThan(.8);

  const cameraBefore = await cameraState(page);
  const before = await nodeState(node);
  const movement = { x: 72, y: 36 };
  await page.mouse.move(before.centerX, before.centerY);
  await page.mouse.down();
  await page.mouse.move(before.centerX + movement.x, before.centerY + movement.y, { steps: 6 });
  await page.mouse.up();

  const cameraAfter = await cameraState(page);
  const after = await nodeState(node);
  expectNear(after.left - before.left, movement.x);
  expectNear(after.top - before.top, movement.y);
  expectNear(after.worldX - before.worldX, movement.x / cameraBefore.zoom);
  expectNear(after.worldY - before.worldY, movement.y / cameraBefore.zoom);
  expectNear(cameraAfter.x, cameraBefore.x, .001);
  expectNear(cameraAfter.y, cameraBefore.y, .001);
  expectNear(cameraAfter.zoom, cameraBefore.zoom, .0001);
  await expect(node).not.toHaveClass(/dragging/);
  await expect(page.locator(".board-word")).toHaveCount(1);
});
