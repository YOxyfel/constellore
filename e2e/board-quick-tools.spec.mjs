import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

async function startChallenge(page) {
  await page.goto("/play/?challenge=1&target=Telescope&seed=73&birthday=off");
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  await page.locator("#beginMission").evaluate((button) => button.click());
  await expect(briefing).toHaveJSProperty("open", false);
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#boardQuickTools")).toBeVisible();
}

async function addWord(page, word) {
  const game = page.locator("#gameScreen");
  if (await game.getAttribute("data-mobile-surface") !== "none") {
    await page.keyboard.press("Escape");
    await expect(game).toHaveAttribute("data-mobile-surface", "none");
  }
  if (await game.getAttribute("data-word-input") !== "bloom") {
    const item = page.locator(`.inventory-word[data-word="${word}"]`);
    await expect(item).toBeVisible();
    await expect(item).toBeEnabled();
    await item.click();
    return;
  }
  const bloom = page.locator("#constellationBloom");
  for (let step = 0; step < 5 && await bloom.getAttribute("data-stage") !== "closed"; step += 1) await page.keyboard.press("Escape");
  await expect(bloom).toHaveAttribute("data-stage", "closed");
  if (await game.getAttribute("data-mobile-surface") !== "none") {
    await page.keyboard.press("Escape");
    await expect(game).toHaveAttribute("data-mobile-surface", "none");
  }
  const trigger = page.locator("#constellationBloomTrigger");
  await expect(trigger).toBeVisible();
  await expect(trigger).toBeEnabled();
  await trigger.click();
  await expect(page.locator("#constellationBloomSearch")).toBeVisible();
  await page.locator("#constellationBloomSearch").fill(word);
  await expect(bloom).toHaveAttribute("data-stage", "search");
  const item = page.locator(`.constellation-bloom__word[data-word="${word}"]`);
  await expect(item).toBeVisible();
  await expect(item).toBeEnabled();
  await item.click();
  await expect(bloom).not.toHaveAttribute("data-transition", /\S/);
  // The picker stays open after arming a word so the player can choose its partner.
  await expect(page.locator(".board-word").first()).toBeVisible();
}

async function mobilePlayLayout(page) {
  return (await page.locator("#gameScreen").getAttribute("data-play-layout")) !== "wide";
}

async function openTools(page) {
  const toggle = page.locator("#mobileToolsToggle");
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#mobileToolsPanel")).toBeVisible();
  return true;
}

async function openAssistance(page) {
  const toggle = page.locator("#mobileAssistToggle");
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#boardAssistanceRail")).toBeVisible();
  return true;
}

function rectanglesIntersect(left, right, gap = 0) {
  return !(left.right + gap <= right.left
    || right.right + gap <= left.left
    || left.bottom + gap <= right.top
    || right.bottom + gap <= left.top);
}

async function boardHudGeometry(page) {
  return page.locator("#gameScreen").evaluate((game) => {
    const rectangle = (element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
    };
    const visible = (element) => element && !element.hidden && getComputedStyle(element).display !== "none" && rectangle(element).width > 0;
    const board = game.querySelector("#board");
    const toolbar = game.querySelector("#boardQuickTools");
    const milestone = game.querySelector("#runMilestone");
    const help = game.querySelector("#mobileAssistToggle");
    return {
      board: rectangle(board),
      bar: rectangle(game.querySelector(".board-workspace-bar")),
      layout: game.dataset.playLayout || "wide",
      toolbar: rectangle(toolbar),
      milestone: visible(milestone) ? rectangle(milestone) : null,
      help: rectangle(help),
      buttons: [...toolbar.querySelectorAll("button"), help].filter(visible).map((element) => {
        const rect = rectangle(element);
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return { ...rect, id: element.id, hit: hit === element || element.contains(hit) };
      }),
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
  { name: "compact desktop", width: 835, height: 677 },
  { name: "portrait tablet", width: 797, height: 1265 },
  { name: "wide phone", width: 655, height: 610 },
  { name: "short tablet", width: 758, height: 414 },
  { name: "short phone landscape", width: 655, height: 414 },
  { name: "small phone", width: 320, height: 568 }
]) {
  test(`board workspace keeps utilities clear of the canvas on ${viewport.name}`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Responsive board geometry is covered once in Chromium.");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startChallenge(page);

    const layout = await page.locator("#gameScreen").getAttribute("data-play-layout");
    if (layout === "wide") {
      await expect(page.locator(".inventory")).toBeVisible();
      await expect(page.locator("#constellationBloom")).toBeHidden();
      await expect(page.locator("#gameScreen")).toHaveAttribute("data-word-input", "inventory");
    } else {
      await expect(page.locator(".inventory")).toBeHidden();
      const bloom = page.locator("#constellationBloomTrigger");
      await expect(bloom).toBeVisible();
      const geometry = await page.locator("#board").evaluate((board) => {
        const trigger = board.querySelector("#constellationBloomTrigger");
        const rect = (element) => {
          const bounds = element.getBoundingClientRect();
          return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
        };
        return { board: rect(board), trigger: rect(trigger) };
      });
      expect(geometry.trigger.width).toBeGreaterThanOrEqual(44);
      expect(geometry.trigger.height).toBeGreaterThanOrEqual(44);
      expect(geometry.trigger.left).toBeGreaterThanOrEqual(geometry.board.left);
      expect(geometry.trigger.right).toBeLessThanOrEqual(geometry.board.right);
      expect(geometry.trigger.top).toBeGreaterThanOrEqual(geometry.board.top);
      expect(geometry.trigger.bottom).toBeLessThanOrEqual(geometry.board.bottom);
    }

    const top = await boardHudGeometry(page);
    expect(top.buttons.map(({ id }) => id)).toEqual(["undoBoardAction", "mobileToolsToggle", "mobileAssistToggle"]);
    await expect(page.locator("#mobileToolsToggle")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#mobileAssistToggle")).toHaveAttribute("aria-expanded", "false");
    expect(top.bar.bottom).toBeLessThanOrEqual(top.board.top + 1);
    expect(rectanglesIntersect(top.toolbar, top.board)).toBe(false);
    expect(top.toolbar.left).toBeGreaterThanOrEqual(top.bar.left);
    expect(top.toolbar.right).toBeLessThanOrEqual(top.bar.right);
    for (const button of top.buttons) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(top.layout === "wide" ? 40 : 44);
      expect(button.hit, `${button.id} remains directly clickable`).toBe(true);
      expect(button.bottom).toBeLessThanOrEqual(top.bar.bottom);
    }
    const clippedCaptions = await page.locator("#boardQuickTools button > b, #mobileAssistToggle > b").evaluateAll((labels) => (
      labels.filter((label) => label.getBoundingClientRect().width > 0
        && label.scrollWidth > label.clientWidth + 1).map((label) => label.textContent)
    ));
    expect(clippedCaptions, "Board command names remain readable").toEqual([]);
    if (top.milestone) {
      expect(top.milestone.left).toBeGreaterThanOrEqual(top.bar.left);
      expect(top.milestone.right).toBeLessThanOrEqual(top.bar.right);
      expect(top.milestone.bottom).toBeLessThanOrEqual(top.board.top + 1);
      expect(rectanglesIntersect(top.toolbar, top.milestone, 6)).toBe(false);
      expect(rectanglesIntersect(top.help, top.milestone, 6)).toBe(false);
    }
    await openTools(page);
    await openAssistance(page);
    await expect(page.locator("#mobileToolsPanel")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.locator("#boardAssistanceRail")).toBeHidden();
    await expect(page.locator("#mobileAssistToggle")).toBeFocused();

    await openTools(page);
    await page.locator("#tidyBoard").focus();
    await page.keyboard.down("Shift");
    if (top.layout === "wide") await expect(page.locator("#alchemyNote")).toBeVisible();
    else {
      await expect(page.locator("#alchemyNote")).toBeHidden();
    }
    const notice = await boardHudGeometry(page);
    if (top.layout === "wide") {
      expect(notice.bottom).toHaveLength(1);
      expect(notice.bottom[0].left).toBeGreaterThanOrEqual(notice.board.left);
      expect(notice.bottom[0].right).toBeLessThanOrEqual(notice.board.right);
      expect(notice.bottom[0].bottom).toBeLessThanOrEqual(notice.board.bottom);
      expect(rectanglesIntersect(notice.toolbar, notice.bottom[0])).toBe(false);
      if (notice.milestone) expect(rectanglesIntersect(notice.milestone, notice.bottom[0])).toBe(false);
    } else {
      expect(notice.bottom).toHaveLength(0);
    }
    await page.keyboard.up("Shift");

    await addWord(page, "earth");
    await openTools(page);
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
        scoreSafe: false,
        scoreMultiplier: Math.max(.7, 1 - tipCall * .1),
        text: hints[index],
        used: tipCall
      })
    });
  });

  await startChallenge(page);
  const objective = page.locator("#hintObjective");
  await expect(objective).toBeHidden();
  await openAssistance(page);
  await page.locator("#senseButton").click();
  await page.locator("#useQuickTip").click();
  await expect(page.locator("#quickTipMessage")).toHaveText(hints[0]);
  await page.locator('[data-close="senseDialog"]').click();
  await expect(objective).toBeHidden();
  await expect(page.locator("#hintObjectiveText")).toHaveText(hints[0]);
  await expect(page.locator("#runMilestone")).toHaveClass(/has-route-signal/);
  await expect(page.locator("#milestoneText")).toHaveText(hints[0]);
  await expect(page.locator("#milestoneText")).toBeVisible();

  const geometry = await boardHudGeometry(page);
  expect(geometry.milestone.left).toBeGreaterThanOrEqual(geometry.bar.left);
  expect(geometry.milestone.right).toBeLessThanOrEqual(geometry.bar.right);
  expect(geometry.milestone.bottom).toBeLessThanOrEqual(geometry.board.top + 1);
  expect(rectanglesIntersect(geometry.toolbar, geometry.milestone, 6)).toBe(false);

  await openAssistance(page);
  await page.locator("#senseButton").click();
  await expect(page.locator("#quickTipMessage")).toHaveText(hints[0]);
  await page.locator("#useQuickTip").click();
  await expect(page.locator("#quickTipMessage")).toHaveText(hints[1]);
  await page.locator('[data-close="senseDialog"]').click();
  await expect(page.locator("#hintObjectiveText")).toHaveText(hints[1]);
  await expect(page.locator("#milestoneText")).toHaveText(hints[1]);

  await page.locator("#pauseRunButton").click();
  await page.locator("#pauseRestart").click();
  await page.locator("#pauseRestart").click();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(objective).toBeHidden();
  await expect(page.locator("#hintObjectiveText")).toHaveText("");
  await expect(page.locator("#runMilestone")).not.toHaveClass(/has-route-signal/);
});

test("quick board tools undo, redo, align, tidy, and reversibly clear visual words", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Keyboard history is covered once in Chromium.");
  await startChallenge(page);

  const undo = page.locator("#undoBoardAction");
  const redo = page.locator("#redoBoardAction");
  const align = page.locator("#alignConstellation");
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

  await openTools(page);
  await redo.click();
  await expect(page.locator('.board-word[data-word="earth"]')).toHaveCount(1);

  await addWord(page, "water");
  await expect(page.locator(".board-word")).toHaveCount(2);
  await expect(align).toBeEnabled();
  await openTools(page);
  await align.click();
  await expect(page.locator(".board-word")).toHaveCount(2);
  await expect(tidy).toBeEnabled();
  await openTools(page);
  await tidy.click();
  await expect(page.locator(".board-word")).toHaveCount(2);

  await openTools(page);
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
  await expect(page.locator('.board-word[data-word="mud"]')).toHaveCount(1);
  await expect(page.locator("#combinationStory")).toHaveCount(0);
  await openTools(page);
  await page.locator("#resetBoard").click();
  await expect(page.locator(".board-word")).toHaveCount(0);
  await addWord(page, "fire");
  await addWord(page, "air");
  await expect(page.locator('.board-word[data-word="energy"]')).toHaveCount(1);
  await openTools(page);
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
  await expect(page.locator("#combinationStory")).toHaveCount(0);
  await expect(page.locator("link[data-combination-story-style]")).toHaveCount(0);

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

for (const viewport of [
  { name: "small portrait", width: 320, height: 568 },
  { name: "short landscape", width: 844, height: 390 }
]) {
  test(`recipe notices stay clear of zoom and the word palette on ${viewport.name}`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Compact board notice geometry is covered in Chromium.");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startChallenge(page);
    await page.locator("#constellationBloomTrigger").click();
    await page.locator("#constellationBloomSearch").fill("earth");
    await page.locator('.constellation-bloom__word[data-word="earth"]').click();
    await expect(page.locator('.board-word[data-word="earth"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#constellationBloom")).not.toHaveAttribute("data-transition", /\S/);
    await page.locator("#constellationBloomSearch").fill("water");
    await page.locator('.constellation-bloom__word[data-word="water"]').click();
    await expect(page.locator('.board-word[data-word="mud"]')).toHaveCount(1);
    await expect(page.locator("[data-golden-pair]:visible")).toHaveCount(0);
    await expect(page.locator("#alchemyNote")).toContainText("Mud");
    await expect.poll(() => page.locator("#alchemyNote").evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.5);

    const noticeGeometry = async () => page.evaluate(() => {
      const rect = (element) => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
      };
      const note = document.querySelector("#alchemyNote");
      const panel = document.querySelector("#constellationBloomPanel");
      const visible = (element) => element?.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true });
      const controls = [...document.querySelectorAll("#boardCameraControls button,#constellationBloomPanel button,#constellationBloomTrigger")]
        .filter(visible).filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.top >= 0 && bounds.bottom <= innerHeight && bounds.left >= 0 && bounds.right <= innerWidth;
        });
      return {
        camera: rect(document.querySelector("#boardCameraControls")),
        notice: visible(note) ? rect(note) : null,
        palette: visible(panel) ? rect(panel) : null,
        controls: controls.map((element) => {
          const bounds = rect(element);
          const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
          return { ...bounds, id: element.id || element.dataset.word, hit: hit === element || element.contains(hit) };
        })
      };
    });
    const closed = await noticeGeometry();
    expect(closed.notice).not.toBeNull();
    expect(rectanglesIntersect(closed.notice, closed.camera)).toBe(false);
    for (const control of closed.controls) {
      expect(control.hit, `${control.id} has a clear hit target`).toBe(true);
      if (["boardZoomOut", "resetBoardView", "boardZoomIn"].includes(control.id)) {
        expect(control.width).toBeGreaterThanOrEqual(44);
        expect(control.height).toBeGreaterThanOrEqual(44);
      }
    }
    await page.locator("#constellationBloomTrigger").click();
    await expect(page.locator("#constellationBloomPanel")).toBeVisible();
    await expect(page.locator("#constellationBloom")).not.toHaveAttribute("data-transition", /\S/);
    const open = await noticeGeometry();
    expect(open.notice, "transient notices stay hidden while choosing a word").toBeNull();
    await expect(page.locator("#alchemyNote")).toBeHidden();
    for (const control of open.controls) expect(control.hit, `${control.id} has a clear hit target with the palette open`).toBe(true);
  });
}

test("second lesson offers the discovered Stone directly without requiring search", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The tutorial palette continuation is covered in Chromium.");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    for (const key of ["constellore-profile-v1", "constellore-local-profile-v1"]) localStorage.removeItem(key);
  });
  await page.goto("/play/?birthday=off");
  await page.locator("#firstOrbitGuide:visible,#primaryOrbitButton:visible").first().waitFor();
  if (await page.locator("#primaryOrbitButton").isVisible()) await page.locator("#primaryOrbitButton").click();
  await expect(page.locator("#firstOrbitGuide")).toBeVisible();

  const chooseDefaultWord = async (word) => {
    const bloom = page.locator("#constellationBloom");
    await expect(bloom).not.toHaveAttribute("data-transition", /\S/);
    if (await bloom.getAttribute("data-stage") === "closed") await page.locator("#constellationBloomTrigger").click();
    await expect(page.locator("#constellationBloomSearch")).toHaveValue("");
    const choice = page.locator(`.constellation-bloom__word[data-word="${word}"]`);
    await expect(choice).toBeVisible();
    await choice.click();
  };
  await chooseDefaultWord("earth");
  await chooseDefaultWord("water");
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", true);
  await page.locator("#resultPrimary").click();
  await expect(page.locator("#missionBriefingDialog")).toHaveJSProperty("open", true);
  await page.locator("#beginMission").click();
  await expect(page.locator("#firstOrbitGuideTitle")).toHaveText("Make Lava");
  await chooseDefaultWord("earth");
  await chooseDefaultWord("fire");
  await expect(page.locator("[data-golden-pair]:visible")).toHaveCount(0);
  await expect(page.locator("#firstOrbitInstruction")).toHaveText("Lava is ready. Choose Water to make Stone.");
  await chooseDefaultWord("water");
  await expect(page.locator("[data-golden-pair]:visible")).toHaveCount(0);
  await expect(page.locator("#firstOrbitInstruction")).toHaveText("Stone is ready. Choose Stone again to make Mountain.");
  await chooseDefaultWord("stone");
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#resultTitle")).toHaveText("You made Mountain!");
  await expect(page.locator("#resultStats")).toContainText("3 combinations");
});
