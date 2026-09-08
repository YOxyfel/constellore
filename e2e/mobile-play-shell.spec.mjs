import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const MOBILE_VIEWPORTS = Object.freeze([
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 449, height: 221 },
  { width: 568, height: 320 },
  { width: 667, height: 375 },
  { width: 765, height: 238 },
  { width: 768, height: 1024 },
  { width: 818, height: 284 },
  { width: 887, height: 427 },
  { width: 1024, height: 768 }
]);

const EXTRA_DISCOVERIES = Object.freeze([
  "Mud", "Energy", "Dust", "Rain", "Steam", "Lava", "Cloud", "Storm",
  "Plant", "Stone", "Metal", "Brick", "Atmosphere", "Mountain", "Ocean"
]);

const REVEAL_ROUTE = Object.freeze([
  { a: "Earth", b: "Water", word: "Mud", emoji: "🟫", category: "nature", source: "core" },
  { a: "Fire", b: "Air", word: "Energy", emoji: "⚡", category: "force", source: "core" },
  { a: "Earth", b: "Air", word: "Dust", emoji: "🌫️", category: "nature", source: "core" },
  { a: "Water", b: "Air", word: "Rain", emoji: "🌧️", category: "nature", source: "core" },
  { a: "Mud", b: "Energy", word: "Brick", emoji: "🧱", category: "structure", source: "core" },
  { a: "Dust", b: "Rain", word: "Atmosphere", emoji: "🪐", category: "nature", source: "core" },
  { a: "Brick", b: "Atmosphere", word: "Wall", emoji: "🧱", category: "structure", source: "core" }
]);

const MOBILE_SHELL_PROJECTS = new Set(["chromium-mobile", "webkit-mobile"]);

function supportsMobileShell(testInfo) {
  return MOBILE_SHELL_PROJECTS.has(testInfo.project.name);
}

function expectedPlayLayout({ width, height }) {
  if (width > height && width <= 900 && height <= 500) return "short-landscape";
  if (width <= 700 || (height >= width && width <= 900)) return "stacked";
  return "wide";
}

function profileFixture({ wins = 2, discoveries = [] } = {}) {
  return {
    version: 8,
    wins,
    discovered: ["Earth", "Water", "Fire", "Air", ...discoveries],
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true },
    feedbackPreferences: {
      sound: true,
      music: true,
      haptics: true,
      resultDetails: false,
      helpNudges: true,
      fusionAnimation: "normal",
      muted: false,
      volume: .75,
      musicVolume: 1,
      sfxVolume: 1
    }
  };
}

async function installProfile(page, options = {}) {
  const profile = profileFixture(options);
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", JSON.stringify(profile)],
      ["constellore-local-profile-v1", JSON.stringify(profile)]
    ]
  });
}

async function startReturningChallenge(page, viewport, {
  target = "Telescope",
  wins = 2,
  discoveries = []
} = {}) {
  await page.setViewportSize(viewport);
  await installProfile(page, { wins, discoveries });
  await page.goto("/play/?challenge=1&target=" + encodeURIComponent(target) + "&seed=73&birthday=off");
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  await page.locator("#beginMission").evaluate((button) => button.click());
  await expect(briefing).toHaveJSProperty("open", false);
  const game = page.locator("#gameScreen");
  await expect(game).toBeVisible();
  await expect(game).toHaveAttribute("data-play-layout", expectedPlayLayout(viewport));
  await expect(game).toHaveAttribute("data-play-phase", "normal");
  return game;
}

async function startFirstOrbit(page, viewport) {
  await page.setViewportSize(viewport);
  await installSeenIntroFixture(page, { resetStorage: true });
  await page.goto("/play/?birthday=off");
  const game = page.locator("#gameScreen");
  if (await game.isHidden()) {
    const begin = page.locator("#primaryOrbitButton");
    await expect(begin).toBeVisible();
    await begin.click();
    const briefing = page.locator("#missionBriefingDialog");
    await expect(briefing).toHaveJSProperty("open", false);
    await expect(page.locator("#cosmicGate")).toBeHidden();
    await expect(briefing).toHaveJSProperty("open", false);
  }
  await expect(game).toBeVisible();
  await expect(page.locator("#targetWord")).toHaveText("Mud");
  await expect(game).toHaveAttribute("data-play-layout", expectedPlayLayout(viewport));
  await expect(game).toHaveAttribute("data-play-phase", "tutorial");
  return game;
}

async function settleLayout(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve))));
}

async function openBloomCategory(page, category = "basics") {
  const bloom = page.locator("#constellationBloom");
  if (await bloom.getAttribute("data-stage") !== "closed") {
    await page.locator("#constellationBloomTrigger").click();
    await expect(bloom).toHaveAttribute("data-stage", "closed");
  }
  await page.locator("#constellationBloomTrigger").click();
  await expect(bloom).toHaveAttribute("data-stage", "words");
  await page.locator("#constellationBloomBack").click();
  await expect(bloom).toHaveAttribute("data-stage", "categories");
  await page.locator(`[data-bloom-category="${category}"]`).click();
  await expect(bloom).toHaveAttribute("data-stage", category === "search" ? "browse" : "words");
}

async function expectSurface(page, active) {
  const game = page.locator("#gameScreen");
  await expect(game).toHaveAttribute("data-mobile-surface", active || "none");
  const entries = [
    { name: "tools", toggle: "#mobileToolsToggle", panel: "#mobileToolsPanel" },
    { name: "assistance", toggle: "#mobileAssistToggle", panel: "#boardAssistanceRail" },
    { name: "sound", toggle: "#playSoundToggle", panel: "#playSoundPanel" }
  ];
  for (const entry of entries) {
    const open = active === entry.name;
    await expect(page.locator(entry.toggle)).toHaveAttribute("aria-expanded", String(open));
    const state = await page.locator(entry.panel).evaluate((panel) => ({
      hidden: panel.hidden,
      inert: panel.inert,
      ariaHidden: panel.getAttribute("aria-hidden"),
      display: getComputedStyle(panel).display
    }));
    if (open) {
      expect(state.hidden, entry.name + " panel must not be hidden while open").toBe(false);
      expect(state.inert, entry.name + " panel must not be inert while open").toBe(false);
      expect(state.ariaHidden).toBe("false");
      expect(state.display).not.toBe("none");
    } else {
      expect(state.hidden, entry.name + " panel must be hidden while closed").toBe(true);
      expect(state.inert, entry.name + " panel must be inert while closed").toBe(true);
      expect(state.ariaHidden).toBe("true");
    }
  }
  await expect(page.locator("#playSoundDisclosure")).toHaveJSProperty("open", active === "sound");
}

async function touchGesture(page, start, end, steps = 8) {
  const session = await page.context().newCDPSession(page);
  const point = (index) => ({
    x: start.x + ((end.x - start.x) * index) / steps,
    y: start.y + ((end.y - start.y) * index) / steps,
    id: 1,
    radiusX: 2,
    radiusY: 2,
    force: 1
  });
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point(0)]
    });
    for (let index = 1; index <= steps; index += 1) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [point(index)]
      });
      await page.waitForTimeout(16);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: []
    });
  } finally {
    await session.detach();
  }
}

async function placeWordWithoutCombining(page, word) {
  await openBloomCategory(page, "basics");
  const item = page.locator('.constellation-bloom__word[data-word="' + word.toLowerCase() + '"]');
  await expect(item).toBeVisible();
  await item.click();
  const node = page.locator('.board-word[data-word="' + word.toLowerCase() + '"]');
  await expect(node).toHaveCount(1);
  await expect(node).toHaveAttribute("aria-pressed", "true");
  await page.locator("#constellationBloomTrigger").click();
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "closed");
  await node.click();
  await expect(node).toHaveAttribute("aria-pressed", "false");
}

async function boardNodeGeometry(page) {
  return page.locator("#board").evaluate((board) => {
    const boardRect = board.getBoundingClientRect();
    return [...board.querySelectorAll(".board-word")].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        id: element.dataset.id,
        word: element.dataset.word,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        withinBoard: rect.left >= boardRect.left - 1
          && rect.top >= boardRect.top - 1
          && rect.right <= boardRect.right + 1
          && rect.bottom <= boardRect.bottom + 1
      };
    });
  });
}

test.describe("coarse-pointer mobile shell", () => {
for (const viewport of MOBILE_VIEWPORTS) {
  test("play shell remains contained and usable at " + viewport.width + "x" + viewport.height, async ({ page }, testInfo) => {
    test.skip(!supportsMobileShell(testInfo), "The geometry matrix requires a coarse-pointer mobile project.");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await startReturningChallenge(page, viewport);
    await settleLayout(page);

    const geometry = await page.locator("#gameScreen").evaluate((root) => {
      const rectangle = (element) => {
        const bounds = element.getBoundingClientRect();
        return {
          id: element?.id || element?.className || element?.tagName,
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height
        };
      };
      const visible = (element) => {
        if (!element || element.hidden) return false;
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        return style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity) !== 0
          && bounds.width > 0
          && bounds.height > 0
          && centerX >= 0
          && centerX <= innerWidth
          && centerY >= 0
          && centerY <= innerHeight;
      };
      const overlaps = (left, right) => !(
        left.right <= right.left
        || right.right <= left.left
        || left.bottom <= right.top
        || right.bottom <= left.top
      );
      const selectors = [
        "#pauseRunButton",
        "#playSoundToggle",
        "#undoBoardAction",
        "#mobileToolsToggle",
        "#runMilestone",
        "#mobileAssistToggle",
        "#inventoryDrawerToggle"
      ];
      const persistent = selectors
        .map((selector) => root.querySelector(selector))
        .filter(visible)
        .map(rectangle);
      const controls = [...root.querySelectorAll("button, summary")]
        .filter(visible)
        .map((element) => {
          const rect = rectangle(element);
          const point = document.elementFromPoint(
            Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2)),
            Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2))
          );
          return {
            ...rect,
            selector: element.id ? "#" + element.id : element.tagName.toLowerCase(),
            scrollableWord: element.classList.contains("inventory-word"),
            hit: point === element || element.contains(point),
            hitTarget: point?.id ? "#" + point.id : point?.className || point?.tagName || "none"
          };
        });
      const nav = root.querySelector(".game-nav");
      const menu = root.querySelector("#pauseRunButton");
      const target = root.querySelector(".game-target");
      const sound = root.querySelector("#playSoundToggle");
      const board = root.querySelector("#board");
      const layout = root.querySelector(".game-layout");
      const inventory = root.querySelector(".inventory");
      return {
        viewport: { width: innerWidth, height: innerHeight },
        page: {
          htmlWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth
        },
        root: rectangle(root),
        nav: rectangle(nav),
        menu: rectangle(menu),
        target: rectangle(target),
        sound: rectangle(sound),
        board: rectangle(board),
        layout: rectangle(layout),
        inventory: rectangle(inventory),
        headerOverlap: {
          menuTarget: overlaps(rectangle(menu), rectangle(target)),
          targetSound: overlaps(rectangle(target), rectangle(sound)),
          menuSound: overlaps(rectangle(menu), rectangle(sound))
        },
        persistent,
        persistentOverlaps: persistent.flatMap((left, leftIndex) =>
          persistent.slice(leftIndex + 1)
            .filter((right) => overlaps(left, right))
            .map((right) => left.id + " overlaps " + right.id)),
        controls
      };
    });

    const withinViewport = (rect) => {
      expect(rect.left, rect.id + " exits the viewport on the left").toBeGreaterThanOrEqual(-1);
      expect(rect.top, rect.id + " exits the viewport on top").toBeGreaterThanOrEqual(-1);
      expect(rect.right, rect.id + " exits the viewport on the right").toBeLessThanOrEqual(viewport.width + 1);
      expect(rect.bottom, rect.id + " exits the viewport on the bottom").toBeLessThanOrEqual(viewport.height + 1);
    };

    expect(geometry.page.htmlWidth).toBeLessThanOrEqual(geometry.viewport.width + 1);
    expect(geometry.page.bodyWidth).toBeLessThanOrEqual(geometry.viewport.width + 1);
    for (const rect of [geometry.root, geometry.nav, geometry.menu, geometry.target, geometry.sound, geometry.layout, geometry.board, geometry.inventory]) {
      withinViewport(rect);
    }
    expect(geometry.board.top, "the board must begin below the navigation bar").toBeGreaterThanOrEqual(geometry.nav.bottom - 1);
    expect(geometry.headerOverlap, JSON.stringify({
      menu: geometry.menu,
      target: geometry.target,
      sound: geometry.sound
    })).toEqual({
      menuTarget: false,
      targetSound: false,
      menuSound: false
    });
    expect(geometry.persistentOverlaps).toEqual([]);
    expect(geometry.controls.length).toBeGreaterThanOrEqual(4);
    for (const control of geometry.controls) {
      if (!control.scrollableWord) withinViewport(control);
      expect(control.width, control.selector + " is narrower than a 44px touch target").toBeGreaterThanOrEqual(43.5);
      expect(control.height, control.selector + " is shorter than a 44px touch target").toBeGreaterThanOrEqual(43.5);
      if (!control.scrollableWord) {
        expect(control.hit, control.selector + " is obscured at its center point by " + control.hitTarget).toBe(true);
      }
    }
  });
}

test("Bloom and mobile disclosures are exclusive, accessible, and Escape restores context", async ({ page }, testInfo) => {
  test.skip(!supportsMobileShell(testInfo), "Mobile disclosure behavior requires a mobile project.");
  const game = await startReturningChallenge(page, { width: 390, height: 844 });
  await expectSurface(page, null);

  const bloomTrigger = page.locator("#constellationBloomTrigger");
  await expect(bloomTrigger).toHaveAttribute("aria-controls", "constellationBloomPanel");
  await openBloomCategory(page, "search");
  await expect(bloomTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#constellationBloomSearch")).not.toBeFocused();
  const bloomA11y = await new AxeBuilder({ page }).include("#constellationBloom").analyze();
  expect(bloomA11y.violations.filter(({ impact }) => ["serious", "critical"].includes(impact))).toEqual([]);

  await page.locator("#constellationBloomSearch").focus();
  await page.locator("#constellationBloomSearch").fill("wat");
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "search");
  await page.keyboard.press("Escape");
  await expect(page.locator("#constellationBloomSearch")).toHaveValue("");
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "browse");
  await page.keyboard.press("Escape");
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "categories");
  await page.keyboard.press("Escape");
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "closed");
  await expect(bloomTrigger).toBeFocused();

  const toolsToggle = page.locator("#mobileToolsToggle");
  await expect(toolsToggle).toHaveAttribute("aria-controls", "mobileToolsPanel");
  await toolsToggle.click();
  await expectSurface(page, "tools");
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "closed");

  await toolsToggle.click();
  await expectSurface(page, null);

  const assistToggle = page.locator("#mobileAssistToggle");
  await expect(assistToggle).toHaveAttribute("aria-controls", "boardAssistanceRail");
  await assistToggle.click();
  await expectSurface(page, "assistance");

  const soundToggle = page.locator("#playSoundToggle");
  await expect(soundToggle).toHaveAttribute("aria-controls", "playSoundPanel");
  await soundToggle.click();
  await expectSurface(page, "sound");
  await page.keyboard.press("Escape");
  await expectSurface(page, null);
  await expect(soundToggle).toBeFocused();
  await expect(page.locator("#pauseDialog")).toHaveJSProperty("open", false);

  await toolsToggle.click();
  await expectSurface(page, "tools");
  await page.keyboard.press("Escape");
  await expectSurface(page, null);
  await expect(toolsToggle).toBeFocused();
  await expect(game).toHaveAttribute("data-play-phase", "normal");
});

test("phone pause closes the Bloom and desktop gesture notices remain visually suppressed", async ({ page }, testInfo) => {
  test.skip(!supportsMobileShell(testInfo), "The compact presentation contract requires a mobile project.");
  const viewport = { width: 375, height: 667 };
  await startReturningChallenge(page, viewport, { target: "Mud" });
  await settleLayout(page);

  await expect(page.locator("#gameScreen .inventory")).toBeHidden();
  await openBloomCategory(page, "discoveries");
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "words");

  await page.locator("#pauseRunButton").click();
  const pause = page.locator("#pauseDialog");
  await expect(pause).toHaveJSProperty("open", true, { timeout: 6_000 });
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "closed");
  const pauseMission = await page.evaluate(() => {
    const card = document.querySelector(".pause-target").getBoundingClientRect();
    const target = document.querySelector("#pauseTarget").getBoundingClientRect();
    const mode = document.querySelector("#pauseMode").getBoundingClientRect();
    return {
      targetContained: target.left >= card.left && target.right <= card.right,
      metadataBelowTarget: mode.top >= target.bottom - 1,
      targetText: document.querySelector("#pauseTarget").textContent,
      modeText: document.querySelector("#pauseMode").textContent
    };
  });
  expect(pauseMission.targetContained).toBe(true);
  expect(pauseMission.metadataBelowTarget).toBe(true);
  expect(pauseMission.targetText).toBe("Mud");
  expect(pauseMission.modeText).toContain(" · ");

  await page.locator("#resumePausedRun").click();
  await expect(pause).toHaveJSProperty("open", false);
  const note = page.locator("#alchemyNote");
  await page.keyboard.down("Shift");
  await expect(note).toContainText("SHIFT REMOVE");
  await expect(note).toBeHidden();
  await expect(page.locator("#boardAnnouncement")).toContainText("SHIFT REMOVE");
  await page.keyboard.up("Shift");
  await page.keyboard.down("Control");
  await expect(note).toContainText("CTRL FUSION");
  await expect(note).toBeHidden();
  await expect(page.locator("#boardAnnouncement")).toContainText("CTRL FUSION");
  await page.keyboard.up("Control");
});

test("the tutorial keeps chrome quiet while word taps still complete its guaranteed pair", async ({ page }, testInfo) => {
  test.skip(!supportsMobileShell(testInfo), "The touch tutorial contract requires a mobile project.");
  const game = await startFirstOrbit(page, { width: 390, height: 844 });
  await expect(page.locator("#firstOrbitGuide")).toBeVisible();
  const guide = await page.locator("#firstOrbitGuide").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const board = element.closest("#gameScreen").getBoundingClientRect();
    return {
      width: bounds.width,
      height: bounds.height,
      contained: bounds.left >= board.left - 1
        && bounds.top >= board.top - 1
        && bounds.right <= board.right + 1
        && bounds.bottom <= board.bottom + 1,
      stepDisplay: getComputedStyle(document.querySelector("#firstOrbitStep")).display,
      instructionWhiteSpace: getComputedStyle(document.querySelector("#firstOrbitInstruction")).whiteSpace
    };
  });
  expect(guide.contained).toBe(true);
  expect(guide.width).toBeGreaterThan(0);
  expect(guide.height).toBeGreaterThan(0);
  expect(guide.stepDisplay).toBe("none");
  expect(guide.instructionWhiteSpace).toBe("normal");
  await expect(page.locator("#firstOrbitInstruction")).toContainText("Tap Add word. Choose Earth, then Water");
  const guideCoversWordControls = await page.evaluate(() => {
    const guide = document.querySelector("#firstOrbitGuide").getBoundingClientRect();
    return [...document.querySelectorAll("#constellationBloom button")].some(button => {
      if (!button.checkVisibility()) return false;
      const control = button.getBoundingClientRect();
      return Math.min(guide.right, control.right) > Math.max(guide.left, control.left)
        && Math.min(guide.bottom, control.bottom) > Math.max(guide.top, control.top);
    });
  });
  expect(guideCoversWordControls).toBe(false);
  await expect(page.locator("#mobileToolsToggle")).toBeHidden();
  await expect(page.locator("#mobileAssistToggle")).toBeHidden();
  await expect(page.locator("#runMilestone")).toBeHidden();
  await expect(page.locator("#gameScreen .inventory")).toBeHidden();

  await page.locator("#constellationBloomTrigger").click();
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "words");
  const earth = page.locator('.constellation-bloom__word[data-word="earth"]');
  await earth.tap();
  const earthNode = page.locator('.board-word[data-word="earth"]');
  await expect(earthNode).toHaveCount(1);
  await expect(earthNode).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#boardAnnouncement")).toContainText(/Earth armed/i);
  await expect(page.locator("#constellationBloomTitle")).toHaveText("Combine with Earth");

  const water = page.locator('.constellation-bloom__word[data-word="water"]');
  await water.tap();
  await expect(page.locator('.board-word[data-word="mud"]')).toHaveCount(1, { timeout: 12_000 });
  await expect(game).toHaveAttribute("data-play-phase", /tutorial|cinematic|result/);
});

test("Bloom touch swipes do not commit words, while an explicit tile tap anchors one", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile", "CDP touch arbitration is Chromium-specific.");
  await startReturningChallenge(page, { width: 667, height: 375 }, {
    wins: 2,
    discoveries: EXTRA_DISCOVERIES
  });
  const trigger = page.locator("#constellationBloomTrigger");
  const triggerBox = await trigger.boundingBox();
  expect(triggerBox).not.toBeNull();
  await touchGesture(page, {
    x: triggerBox.x + triggerBox.width / 2,
    y: triggerBox.y + triggerBox.height / 2
  }, {
    x: triggerBox.x + triggerBox.width / 2 + 84,
    y: triggerBox.y + triggerBox.height / 2 + 58
  }, 10);
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "words");
  const earth = page.locator('.constellation-bloom__word[data-word="earth"]');
  await expect(earth).toBeVisible();
  await expect(page.locator(".board-word")).toHaveCount(0);
  const earthBox = await earth.boundingBox();
  expect(earthBox).not.toBeNull();
  const wordHubBox = await trigger.boundingBox();
  await touchGesture(page, {
    x: wordHubBox.x + wordHubBox.width / 2,
    y: wordHubBox.y + wordHubBox.height / 2
  }, {
    x: earthBox.x + earthBox.width / 2,
    y: earthBox.y + earthBox.height / 2
  }, 10);
  await expect(page.locator(".board-word")).toHaveCount(0);
  await earth.tap();
  await expect(page.locator('.board-word[data-word="earth"]')).toHaveCount(1);
  await expect(page.locator('.board-word[data-word="earth"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".tray-drag-ghost")).toHaveCount(0);
  await expect(page.locator(".inventory-word.pointer-dragging")).toHaveCount(0);
  await expect(page.locator(".board-word.drop-target, .board-word.drop-ambiguous")).toHaveCount(0);
});

test("orientation changes preserve phase and word positions while swapping Bloom and desktop inventory", async ({ page }, testInfo) => {
  test.skip(!supportsMobileShell(testInfo), "Orientation reflow requires a mobile project.");
  const game = await startReturningChallenge(page, { width: 768, height: 1024 });
  await placeWordWithoutCombining(page, "Earth");
  await placeWordWithoutCombining(page, "Water");
  await expect(page.locator(".board-word")).toHaveCount(2);
  await page.locator("#constellationBloomTrigger").click();
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "words");

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(game).toHaveAttribute("data-play-layout", "wide");
  await expect(game).toHaveAttribute("data-play-phase", "normal");
  await expect(page.locator("#constellationBloom")).toBeHidden();
  await expect.poll(async () => (await boardNodeGeometry(page)).every((node) => node.withinBoard)).toBe(true);
  await expect(page.locator("#gameScreen .inventory")).toBeVisible();

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(game).toHaveAttribute("data-play-layout", "stacked");
  await expect(game).toHaveAttribute("data-play-phase", "normal");
  await expect(page.locator("#constellationBloom")).toBeVisible();
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "closed");
  await expect(page.locator("#gameScreen .inventory")).toBeHidden();
  await expect.poll(async () => (await boardNodeGeometry(page)).every((node) => node.withinBoard)).toBe(true);
  expect(await page.locator(".board-word").count()).toBe(2);
});

test("a Bronze help nudge occupies its own lane without moving existing words", async ({ page }, testInfo) => {
  test.skip(!supportsMobileShell(testInfo), "The timed nudge geometry requires a mobile project.");
  await page.setViewportSize({ width: 390, height: 844 });
  await installProfile(page, { wins: 0 });
  await page.goto("/play/?birthday=off");
  await page.locator("#primaryOrbitButton").click();
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  await page.locator("#beginMission").click();
  await expect(briefing).toHaveJSProperty("open", false);
  await expect(page.locator("#gameScreen")).toHaveAttribute("data-play-phase", "normal");
  await placeWordWithoutCombining(page, "Earth");
  await placeWordWithoutCombining(page, "Water");
  await page.waitForTimeout(500);

  const before = await boardNodeGeometry(page);
  expect(before).toHaveLength(2);
  await expect(page.locator("#helpNudge")).toBeVisible({ timeout: 22_000 });
  await settleLayout(page);
  const after = await boardNodeGeometry(page);
  expect(after).toHaveLength(before.length);
  for (const original of before) {
    const current = after.find((node) => node.id === original.id);
    expect(current, "word " + original.word + " disappeared when the nudge opened").toBeTruthy();
    expect(Math.abs(current.left - original.left), original.word + " moved horizontally").toBeLessThanOrEqual(1.5);
    expect(Math.abs(current.top - original.top), original.word + " moved vertically").toBeLessThanOrEqual(1.5);
  }

  const nudgeGeometry = await page.locator("#helpNudge").evaluate((nudge) => {
    const board = nudge.closest("#board").getBoundingClientRect();
    const notice = nudge.getBoundingClientRect();
    const nodes = [...nudge.closest("#board").querySelectorAll(".board-word")].map((element) => element.getBoundingClientRect());
    const overlaps = (left, right) => !(
      left.right <= right.left
      || right.right <= left.left
      || left.bottom <= right.top
      || right.bottom <= left.top
    );
    return {
      inside: notice.left >= board.left - 1
        && notice.top >= board.top - 1
        && notice.right <= board.right + 1
        && notice.bottom <= board.bottom + 1,
      overlapsNode: nodes.some((node) => overlaps(notice, node))
    };
  });
  expect(nudgeGeometry).toEqual({ inside: true, overlapsNode: false });
});

test("short landscape promotes the Help nudge on the Assist orb without covering play", async ({ page }, testInfo) => {
  test.skip(!supportsMobileShell(testInfo), "The compact Help treatment requires a mobile project.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startReturningChallenge(page, { width: 356, height: 192 }, { wins: 0 });
  await page.locator("#helpNudge").evaluate((nudge) => { nudge.hidden = false; });

  await expect(page.locator("#helpNudge")).toBeHidden();
  const geometry = await page.locator("#mobileAssistToggle").evaluate((toggle) => {
    const toggleRect = toggle.getBoundingClientRect();
    const toolsRect = toggle.closest("#board").querySelector(".board-top-hud").getBoundingClientRect();
    const boardRect = toggle.closest("#board").getBoundingClientRect();
    const noticeLane = toggle.closest("#board").querySelector(".board-bottom-hud");
    const marker = getComputedStyle(toggle, "::after");
    const overlaps = !(toggleRect.right <= toolsRect.left || toolsRect.right <= toggleRect.left
      || toggleRect.bottom <= toolsRect.top || toolsRect.bottom <= toggleRect.top);
    const hit = document.elementFromPoint(toggleRect.left + toggleRect.width / 2, toggleRect.top + toggleRect.height / 2);
    return {
      inside: toggleRect.left >= boardRect.left - 1 && toggleRect.top >= boardRect.top - 1
        && toggleRect.right <= boardRect.right + 1 && toggleRect.bottom <= boardRect.bottom + 1,
      overlapsTools: overlaps,
      markerWidth: marker.width,
      noticeLaneVisibility: getComputedStyle(noticeLane).visibility,
      hitTestable: hit === toggle || toggle.contains(hit)
    };
  });
  expect(geometry).toEqual({ inside: true, overlapsTools: false, markerWidth: "11px", noticeLaneVisibility: "visible", hitTestable: true });
});

test("Reveal closes compact surfaces and replaces ordinary chrome with its focused controls", async ({ page }, testInfo) => {
  test.skip(!supportsMobileShell(testInfo), "The Reveal handoff requires a mobile project.");
  await page.addInitScript(({ revealPayload }) => {
    const nativeFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (input, init) => {
      const requestUrl = typeof input === "string" ? input : input?.url;
      const url = new URL(requestUrl, location.href);
      if (url.pathname === "/api/run/reveal") {
        return Promise.resolve(new Response(JSON.stringify(revealPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }));
      }
      return nativeFetch(input, init);
    };
  }, {
    revealPayload: {
      assisted: true,
      scoringDisabled: true,
      score: 0,
      leaderboardEligible: false,
      route: REVEAL_ROUTE
    }
  });
  const game = await startReturningChallenge(page, { width: 390, height: 844 }, { target: "Wall" });
  await page.locator("#mobileAssistToggle").click();
  await expectSurface(page, "assistance");
  await page.locator("#revealShortcut").click();
  await expect(page.locator("#revealDialog")).toHaveJSProperty("open", true);
  await expectSurface(page, null);
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "closed");

  await page.locator("#confirmReveal").click();
  await expect(game).toHaveAttribute("data-play-phase", "reveal");
  await expect(page.locator("#revealController")).toBeVisible();
  await expect(page.locator("#mobileToolsToggle")).toBeHidden();
  await expect(page.locator("#mobileAssistToggle")).toBeHidden();
  await expect(page.locator("#runMilestone")).toBeHidden();
});

});

test("reduced motion removes compact-shell transitions without changing disclosure state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-reduced-motion", "This contract requires the reduced-motion project.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  const game = await startReturningChallenge(page, { width: 390, height: 844 });
  await page.locator("#constellationBloomTrigger").click();
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "words");
  await page.locator("#mobileToolsToggle").click();
  await expectSurface(page, "tools");
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "closed");
  await settleLayout(page);

  const motion = await page.evaluate(() => {
    const parse = (value) => value.split(",").map((entry) => {
      const normalized = entry.trim();
      return normalized.endsWith("ms") ? Number.parseFloat(normalized) : Number.parseFloat(normalized) * 1000;
    });
    const elements = [
      document.querySelector("#gameScreen .game-layout"),
      document.querySelector("#constellationBloom"),
      document.querySelector("#constellationBloomTrigger"),
      document.querySelector("#mobileToolsPanel"),
      document.querySelector("#boardAssistanceRail"),
      document.querySelector("#playSoundPanel"),
      document.querySelector("#wordList")
    ].filter(Boolean);
    return elements.map((element) => {
      const style = getComputedStyle(element);
      const duration = Math.max(0, ...parse(style.transitionDuration), ...parse(style.animationDuration));
      const activeAnimations = element.getAnimations()
        .filter((animation) => animation.playState === "running").length;
      return {
        id: element.id || element.className,
        duration,
        activeAnimations,
        scrollBehavior: style.scrollBehavior
      };
    });
  });
  for (const entry of motion) {
    expect(entry.duration, entry.id + " retains motion under reduced-motion").toBeLessThanOrEqual(1);
    expect(entry.activeAnimations, entry.id + " has a running animation").toBe(0);
    expect(entry.scrollBehavior, entry.id + " retains smooth scrolling under reduced-motion").toBe("auto");
  }
  await expect(game).toHaveAttribute("data-play-phase", "normal");
});
