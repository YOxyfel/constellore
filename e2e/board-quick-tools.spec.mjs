import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

async function startChallenge(page) {
  await page.goto("/play/?challenge=1&target=Telescope&seed=73");
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  await page.locator("#beginMission").click();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#boardQuickTools")).toBeVisible();
}

async function addWord(page, word) {
  const item = page.locator(`.inventory-word[data-word="${word}"]`);
  await expect(item).toBeVisible();
  await expect(item).toBeEnabled();
  await item.click({ force: true });
}

function rectanglesIntersect(left, right, gap = 0) {
  return !(left.right + gap <= right.left
    || right.right + gap <= left.left
    || left.bottom + gap <= right.top
    || right.bottom + gap <= left.top);
}

async function boardHudGeometry(page) {
  return page.locator("#board").evaluate((board) => {
    const rectangle = (element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
    };
    const visible = (element) => element && !element.hidden && getComputedStyle(element).display !== "none" && rectangle(element).width > 0;
    const toolbar = board.querySelector("#boardQuickTools");
    const milestone = board.querySelector("#runMilestone");
    return {
      board: rectangle(board),
      toolbar: rectangle(toolbar),
      milestone: visible(milestone) ? rectangle(milestone) : null,
      buttons: [...toolbar.querySelectorAll("button")].map(rectangle),
      bottom: [...board.querySelectorAll("#boardBottomHud > *")].filter(visible).map(rectangle)
    };
  });
}

async function inventoryGeometry(page) {
  return page.locator(".game-layout").evaluate((layout) => {
    const rectangle = (element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
    };
    const board = layout.querySelector("#board");
    const inventory = layout.querySelector(".inventory");
    const list = layout.querySelector("#wordList");
    const style = getComputedStyle(list);
    return {
      board: rectangle(board),
      inventory: rectangle(inventory),
      list: rectangle(list),
      display: style.display,
      direction: style.flexDirection,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      items: [...list.querySelectorAll(".inventory-word")].slice(0, 4).map(rectangle)
    };
  });
}

test.beforeEach(async ({ page, request }, testInfo) => {
  const wins = testInfo.title.includes("missing combination") ? 10 : 0;
  let player = null;
  if (wins >= 10) {
    const registration = await request.post("/api/player/register");
    expect(registration.ok()).toBe(true);
    const payload = await registration.json();
    player = { playerId: payload.player.id, playerToken: payload.playerToken };
  }
  await page.addInitScript(({ seedWins, seededPlayer }) => {
    localStorage.clear();
    sessionStorage.clear();
    const profile = {
      version: 7,
      wins: seedWins,
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true },
      ...(seededPlayer || {}),
      ...(seedWins >= 10 ? { routeRank: { rank: "gold", challengeRank: "gold" } } : {})
    };
    localStorage.setItem("constellore-profile-v1", JSON.stringify(profile));
    localStorage.setItem("constellore-local-profile-v1", JSON.stringify(profile));
  }, { seedWins: wins, seededPlayer: player });
  await installSeenIntroFixture(page);
});

for (const viewport of [
  { name: "compact desktop", width: 835, height: 677, inventory: "side" },
  { name: "portrait tablet", width: 797, height: 1265, inventory: "bottom" },
  { name: "wide phone", width: 655, height: 610, inventory: "bottom" },
  { name: "short tablet", width: 758, height: 414, inventory: "side" },
  { name: "short phone landscape", width: 655, height: 414, inventory: "side" },
  { name: "small phone", width: 320, height: 568, inventory: "bottom" }
]) {
  test(`board HUD stays centered and collision-free on ${viewport.name}`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Responsive board geometry is covered once in Chromium.");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startChallenge(page);

    const inventory = await inventoryGeometry(page);
    const placement = inventory.inventory.top >= inventory.board.bottom - 2 ? "bottom" : "side";
    expect(placement).toBe(viewport.inventory);
    if (placement === "bottom") {
      expect(inventory.display).toBe("flex");
      expect(inventory.direction).toBe("row");
      expect(inventory.overflowX).toBe("auto");
      expect(inventory.overflowY).toBe("hidden");
      expect(inventory.items.length).toBeGreaterThanOrEqual(4);
      expect(Math.max(...inventory.items.map((item) => item.top)) - Math.min(...inventory.items.map((item) => item.top))).toBeLessThanOrEqual(2);
      expect(inventory.items.every((item, index) => index === 0 || item.left > inventory.items[index - 1].left)).toBe(true);
      expect(inventory.items.every((item) => item.width < inventory.list.width / 2)).toBe(true);
    } else {
      expect(inventory.display).toBe("block");
      expect(inventory.overflowY).toBe("auto");
      expect(inventory.items.every((item, index) => index === 0 || item.top > inventory.items[index - 1].top)).toBe(true);
    }

    const top = await boardHudGeometry(page);
    expect(Math.abs((top.toolbar.left + top.toolbar.right) / 2 - (top.board.left + top.board.right) / 2)).toBeLessThanOrEqual(1);
    expect(top.toolbar.left).toBeGreaterThanOrEqual(top.board.left);
    expect(top.toolbar.right).toBeLessThanOrEqual(top.board.right);
    for (const button of top.buttons) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
    }
    if (top.milestone) {
      expect(top.milestone.left).toBeGreaterThanOrEqual(top.board.left);
      expect(top.milestone.right).toBeLessThanOrEqual(top.board.right);
      expect(rectanglesIntersect(top.toolbar, top.milestone, 6)).toBe(false);
    }

    await page.locator("#tidyBoard").focus();
    await page.keyboard.down("Shift");
    await expect(page.locator("#alchemyNote")).toBeVisible();
    const notice = await boardHudGeometry(page);
    expect(notice.bottom).toHaveLength(1);
    expect(notice.bottom[0].left).toBeGreaterThanOrEqual(notice.board.left);
    expect(notice.bottom[0].right).toBeLessThanOrEqual(notice.board.right);
    expect(notice.bottom[0].bottom).toBeLessThanOrEqual(notice.board.bottom);
    expect(rectanglesIntersect(notice.toolbar, notice.bottom[0])).toBe(false);
    if (notice.milestone) expect(rectanglesIntersect(notice.milestone, notice.bottom[0])).toBe(false);
    await page.keyboard.up("Shift");

    await addWord(page, "earth");
    await page.locator("#resetBoard").click();
    await expect(page.locator("#boardUndo")).toBeVisible();
    await expect(page.locator("#alchemyNote")).toBeHidden();
    const cleared = await boardHudGeometry(page);
    expect(cleared.bottom).toHaveLength(1);
    expect(cleared.bottom[0].bottom).toBeLessThanOrEqual(cleared.board.bottom);
  });
}

test("the active Route Signal persists, advances, and clears without crowding a phone board", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The focused hint-objective flow is covered once in Chromium.");
  await page.setViewportSize({ width: 320, height: 568 });
  let tipCall = 0;
  const hints = [
    "Try pairing Earth with a force concept.",
    "Your newest route signal points toward a warm energy concept."
  ];
  await page.route("**/api/run/tip", async (route) => {
    const index = Math.min(tipCall, hints.length - 1);
    tipCall += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        remaining: Math.max(0, 3 - tipCall),
        scoreSafe: true,
        text: hints[index],
        used: tipCall
      })
    });
  });

  await startChallenge(page);
  const objective = page.locator("#hintObjective");
  await expect(objective).toBeHidden();
  await page.locator("#senseButton").click();
  await page.locator("#useQuickTip").click();
  await expect(page.locator("#quickTipMessage")).toHaveText(hints[0]);
  await page.locator('[data-close="senseDialog"]').click();
  await expect(objective).toBeVisible();
  await expect(page.locator("#hintObjectiveText")).toHaveText(hints[0]);

  const geometry = await page.locator("#board").evaluate((board) => {
    const rectangle = (element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
    };
    return {
      board: rectangle(board),
      tools: rectangle(board.querySelector("#boardQuickTools")),
      milestone: rectangle(board.querySelector("#runMilestone")),
      objective: rectangle(board.querySelector("#hintObjective"))
    };
  });
  expect(geometry.objective.left).toBeGreaterThanOrEqual(geometry.board.left);
  expect(geometry.objective.right).toBeLessThanOrEqual(geometry.board.right);
  expect(geometry.objective.top).toBeGreaterThanOrEqual(geometry.board.top);
  expect(rectanglesIntersect(geometry.tools, geometry.objective, 6)).toBe(false);
  expect(rectanglesIntersect(geometry.milestone, geometry.objective, 6)).toBe(false);

  await page.locator("#senseButton").click();
  await expect(page.locator("#quickTipMessage")).toHaveText(hints[0]);
  await page.locator("#useQuickTip").click();
  await expect(page.locator("#quickTipMessage")).toHaveText(hints[1]);
  await page.locator('[data-close="senseDialog"]').click();
  await expect(page.locator("#hintObjectiveText")).toHaveText(hints[1]);
  await expect(objective).not.toContainText(hints[0]);

  await page.locator("#pauseRunButton").click();
  await page.locator("#pauseRestart").click();
  await page.locator("#pauseRestart").click();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(objective).toBeHidden();
  await expect(page.locator("#hintObjectiveText")).toHaveText("");
});

test("quick board tools undo, redo, tidy, and reversibly clear visual words", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Keyboard history is covered once in Chromium.");
  await startChallenge(page);

  const undo = page.locator("#undoBoardAction");
  const redo = page.locator("#redoBoardAction");
  const tidy = page.locator("#tidyBoard");
  const clear = page.locator("#resetBoard");
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  await addWord(page, "earth");
  await expect(page.locator('.board-word[data-word="earth"]')).toHaveCount(1);
  await expect(undo).toBeEnabled();

  await undo.click();
  await expect(page.locator(".board-word")).toHaveCount(0);
  await expect(redo).toBeEnabled();

  await redo.click();
  await expect(page.locator('.board-word[data-word="earth"]')).toHaveCount(1);

  await addWord(page, "water");
  await expect(page.locator(".board-word")).toHaveCount(2);
  await expect(tidy).toBeEnabled();
  await tidy.click();
  await expect(page.locator(".board-word")).toHaveCount(2);

  await clear.click();
  await expect(page.locator(".board-word")).toHaveCount(0);
  await expect(undo).toBeEnabled();
  await page.keyboard.press("Control+z");
  await expect(page.locator(".board-word")).toHaveCount(2);
  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator(".board-word")).toHaveCount(0);
});

test("a missing combination asks for the player's expected result and saves or sends the bounded report", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The report interaction is covered once in Chromium.");
  let reportPayload = null;
  let runStartIntercepted = false;
  await page.route("**/api/combination-reports", async (route) => {
    reportPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ accepted: true, duplicate: false, reviewable: true })
    });
  });
  await page.route("**/api/run/start", async (route) => {
    runStartIntercepted = true;
    const response = await route.fetch();
    const payload = await response.json();
    payload.player = {
      ...payload.player,
      routeRank: { rank: "gold", challengeRank: "gold" }
    };
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload)
    });
  });

  await startChallenge(page);
  expect(runStartIntercepted).toBe(true);
  const seededProfile = await page.evaluate(() => JSON.parse(localStorage.getItem("constellore-profile-v1") || "null"));
  expect(seededProfile).toMatchObject({ wins: 10 });
  await expect(page.locator("#gameScreen")).not.toHaveClass(/focus-orbit/);
  await addWord(page, "earth");
  await addWord(page, "water");
  await expect(page.locator('.inventory-word[data-word="mud"]')).toBeVisible();
  await expect(page.locator("#combinationStory")).toHaveAttribute("data-story-total-layers", "1");
  await page.locator("#resetBoard").click();
  await expect(page.locator(".board-word")).toHaveCount(0);
  await addWord(page, "fire");
  await addWord(page, "air");
  await expect(page.locator('.inventory-word[data-word="energy"]')).toBeVisible();
  await expect(page.locator("#combinationStory")).toHaveAttribute("data-story-total-layers", "2");
  await page.locator("#resetBoard").click();
  await expect(page.locator(".board-word")).toHaveCount(0);
  await page.route("**/api/combine", async (route) => {
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({ error: "No logical combination exists yet.", code: "combination_missing" })
    });
  });
  await addWord(page, "mud");
  await addWord(page, "energy");
  await expect(page.locator("#combinationStory")).toHaveAttribute("data-story-total-layers", "2");
  await expect(page.locator("#combinationStory [data-story-narration]")).toContainText(/crumbles.*rebuilds/i);

  const feedback = page.locator("#expectedPairFeedback");
  await expect(feedback).toBeVisible();
  await expect(feedback.locator("#expectedPairTitle")).toContainText(/What should .* make\?/);
  await feedback.locator("#expectedPairResult").fill("Wetland");
  await feedback.locator("#expectedPairButton").click();
  await expect(feedback.locator("#expectedPairButton")).toHaveText(/Idea sent|Saved/);
  if (reportPayload) {
    expect(new Set([reportPayload.a, reportPayload.b])).toEqual(new Set(["Mud", "Energy"]));
    expect(reportPayload.expected).toBe("Wetland");
    expect(reportPayload.reason).toBe("");
    expect(reportPayload.reporterId).toMatch(/^[A-Za-z0-9_-]{16,80}$/);
  } else {
    const localReport = await page.evaluate(() => JSON.parse(localStorage.getItem("constellore-local-expected-pairs-v1") || "null"));
    const saved = Object.values(localReport?.reports || {}).find((entry) => {
      const pair = new Set(entry?.pair || []);
      return pair.has("Mud") && pair.has("Energy");
    });
    expect(saved?.suggestions?.Wetland).toBe(1);
  }
});
