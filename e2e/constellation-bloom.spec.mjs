import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { EXPANDED_RECIPES, EXPANDED_RECIPE_BASE_CONCEPTS } from "../content/expanded-recipes.mjs";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const MOBILE_PROJECTS = new Set(["chromium-mobile", "chromium-reduced-motion", "webkit-mobile"]);
const DESKTOP_PROJECT = "chromium-desktop";

const isMobileProject = (testInfo) => MOBILE_PROJECTS.has(testInfo.project.name);

const DISCOVERIES = Object.freeze([
  "Mud", "Energy", "Dust", "Rain", "Steam", "Lava", "Cloud", "Storm",
  "Plant", "Stone", "Metal", "Brick", "Atmosphere", "Mountain", "Ocean"
]);

function profileFixture({ discovered = ["Earth", "Water", "Fire", "Air", ...DISCOVERIES] } = {}) {
  return {
    version: 10,
    wins: 3,
    discovered,
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true },
    routeRank: { rank: "silver", challengeRank: "silver" },
    routeProgression: {
      version: 2,
      masteryPoints: 50,
      completedChallenges: 3,
      failedChallenges: 0,
      currentWinStreak: 0,
      rankId: "silver",
      promotionTrial: null
    },
    feedbackPreferences: {
      sound: true,
      music: true,
      haptics: true,
      resultDetails: false,
      helpNudges: false,
      fusionAnimation: "normal",
      muted: false,
      volume: 0.75,
      musicVolume: 1,
      sfxVolume: 1
    }
  };
}

async function installProfile(page, options = {}) {
  const registrationResponse = await page.request.post("/api/player/register");
  expect(registrationResponse.ok()).toBe(true);
  const registration = await registrationResponse.json();
  const fixture = {
    ...profileFixture(options),
    playerId: registration.player.id,
    playerToken: registration.playerToken
  };
  const seededPlayer = {
    ...registration.player,
    wins: fixture.wins,
    discovered: fixture.discovered,
    routeRank: fixture.routeRank
  };
  await page.addInitScript(({ player }) => {
    const nativeFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (input, init = {}) => {
      const request = input instanceof Request ? input : null;
      const url = new URL(request?.url || input, location.href);
      const method = String(init.method || request?.method || "GET").toUpperCase();
      if (url.pathname === "/api/player" && method === "GET") {
        return Promise.resolve(new Response(JSON.stringify({ player }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }));
      }
      if (url.pathname === "/api/player/restore" && method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({
          player,
          entitlements: { products: [], vault: [] }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }));
      }
      return nativeFetch(input, init);
    };
  }, { player: seededPlayer });
  const serialized = JSON.stringify(fixture);
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", serialized],
      ["constellore-local-profile-v1", serialized],
      ["constellore-birthday-voyage-complete-v1", "2026-01-01T00:00:00.000Z"]
    ]
  });
}

function expectedLayout({ width, height }) {
  if (width > height && width <= 900 && height <= 500) return "short-landscape";
  if (width <= 700 || (height >= width && width <= 900)) return "stacked";
  return "wide";
}

async function startChallenge(page, viewport, target = "Horizon") {
  await page.setViewportSize(viewport);
  await installProfile(page);
  await page.goto(`/play/?challenge=1&target=${encodeURIComponent(target)}&seed=73&birthday=off`);
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  await page.locator("#beginMission").evaluate((button) => button.click());
  await expect(briefing).toHaveJSProperty("open", false);
  const game = page.locator("#gameScreen");
  await expect(game).toBeVisible();
  await expect(game).toHaveAttribute("data-play-layout", expectedLayout(viewport));
  await expect(game).toHaveAttribute("data-play-phase", "normal");
  return game;
}

async function startExplore(page, viewport, profileOptions = {}) {
  await page.setViewportSize(viewport);
  await installProfile(page, profileOptions);
  await page.goto("/play/?mode=explore&birthday=off");
  const launch = page.locator("#exploreHub [data-mode='explore']");
  await expect(launch).toHaveCount(1);
  // Direct fixture entry avoids coupling Bloom coverage to Orbit Home's
  // modal Forge catalog while still exercising the canonical mode handler.
  await launch.evaluate((button) => button.click());
  const game = page.locator("#gameScreen");
  await expect(game).toBeVisible({ timeout: 20_000 });
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true, { timeout: 20_000 });
  await page.locator("#beginMission").evaluate((button) => button.click());
  await expect(briefing).toHaveJSProperty("open", false);
  await expect(game).toHaveAttribute("data-play-layout", expectedLayout(viewport));
  await expect(game).toHaveAttribute("data-play-phase", "normal");
  return game;
}

async function settleLayout(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function openLatchedCategories(page) {
  const trigger = page.locator("#constellationBloomTrigger");
  await expect(trigger).toBeVisible();
  await expect(trigger).toBeEnabled();
  if (await page.locator("#constellationBloom").getAttribute("data-stage") !== "closed") {
    await trigger.click();
    await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "closed");
  }
  await trigger.click();
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "words");
  await page.locator("#constellationBloomBack").click();
  await expect(page.locator("#constellationBloom")).toHaveAttribute("data-stage", "categories");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-bloom-category]")).toHaveCount(4);
}

async function openBrowse(page) {
  await openLatchedCategories(page);
  await page.locator("[data-bloom-category='search']").click();
  const bloom = page.locator("#constellationBloom");
  const search = page.locator("#constellationBloomSearch");
  await expect(bloom).toHaveAttribute("data-stage", "browse");
  await expectNoBloomTransition(page);
  await expect(search).toBeVisible();
  await expect(search).not.toBeFocused();
  await expect(page.locator("#constellationBloomCategories")).toHaveAttribute("aria-label", "Available word categories");
  return { bloom, search };
}

async function flickTrigger(page, { dx, dy }) {
  const trigger = page.locator("#constellationBloomTrigger");
  const box = await trigger.boundingBox();
  expect(box).not.toBeNull();
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
  await page.mouse.up();
}

async function visibleBloomControlGeometry(page) {
  return page.locator("#constellationBloom").evaluate((root) => {
    const board = root.closest("#board");
    const boardRect = board.getBoundingClientRect();
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return !element.hidden
        && style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity) !== 0
        && rect.width > 0
        && rect.height > 0;
    };
    return [...root.querySelectorAll("button, input")].filter(visible).map((element) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(centerX, centerY);
      return {
        id: element.id || element.dataset.bloomCategory || element.dataset.word || element.tagName,
        width: rect.width,
        height: rect.height,
        withinViewport: rect.left >= -1 && rect.top >= -1
          && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
        withinBoard: rect.left >= boardRect.left - 1 && rect.top >= boardRect.top - 1
          && rect.right <= boardRect.right + 1 && rect.bottom <= boardRect.bottom + 1,
        hitTestable: Boolean(hit && (hit === element || element.contains(hit)))
      };
    });
  });
}

async function expectNoBloomTransition(page) {
  await expect.poll(() => page.locator("#constellationBloom").evaluate((root) => root.dataset.transition || ""))
    .toBe("");
}

async function blankBoardPoint(page, { reverse = false } = {}) {
  return page.locator("#board").evaluate((board, fromEnd) => {
    const rect = board.getBoundingClientRect();
    const fractions = fromEnd
      ? [[.78, .75], [.22, .75], [.78, .42], [.22, .42]]
      : [[.22, .75], [.78, .75], [.22, .42], [.78, .42]];
    const protectedSelector = ".constellation-bloom, .board-word, button, a, input, select, textarea, [role='button'], .board-quick-tools, .board-assistance-rail, .mobile-assist-surface, .help-nudge, .board-top-hud";
    for (const [xFraction, yFraction] of fractions) {
      const x = rect.left + rect.width * xFraction;
      const y = rect.top + rect.height * yFraction;
      const target = document.elementFromPoint(x, y);
      if (target && board.contains(target) && !target.closest(protectedSelector)) return { x, y };
    }
    return { x: rect.left + 18, y: rect.bottom - 18 };
  }, reverse);
}


for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`Bloom opens actual words and combines without reopening at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), "Touch palette flow.");
    await startChallenge(page, viewport, "Mud");
    const bloom = page.locator("#constellationBloom");
    await page.locator("#constellationBloomTrigger").click();
    await expect(bloom).toHaveAttribute("data-stage", "words");
    await expectNoBloomTransition(page);
    await expect(page.locator("#constellationBloomSearch")).toBeVisible();
    await expect(page.locator("#constellationBloomSearch")).not.toBeFocused();
    await page.locator("#constellationBloomWords [data-word='earth']").click();
    await expect(page.locator("#constellationBloomTitle")).toHaveText("Combine with Earth");
    await expect(bloom).toHaveAttribute("data-stage", "words");
    await expectNoBloomTransition(page);
    const word = page.locator("#constellationBloomWords [data-word='water']");
    const bounds = await word.boundingBox();
    expect(bounds.height).toBeLessThanOrEqual(68);
    await word.click();
    await expect(page.locator(".board-word[data-word='mud']")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator("#resultDialog")).toHaveJSProperty("open", true, { timeout: 15_000 });
  });

  test(`Bloom search is immediate and hit-testable after anchoring at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), "Touch palette search regression.");
    await startChallenge(page, viewport, "Mud");
    const bloom = page.locator("#constellationBloom");
    await page.locator("#constellationBloomTrigger").click();
    await expect(bloom).toHaveAttribute("data-stage", "words");
    await page.locator("#constellationBloomWords [data-word='earth']").click();
    await expect(page.locator("#constellationBloomTitle")).toHaveText("Combine with Earth");
    await page.locator("#constellationBloomSearch").fill("wat");
    await expect(bloom).toHaveAttribute("data-stage", "search");
    await expect(bloom).not.toHaveAttribute("data-transition", /\S/);
    const water = page.locator("#constellationBloomWords [data-word='water']");
    await expect(water).toBeEnabled();
    const hit = await water.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return target === el || el.contains(target);
    });
    expect(hit).toBe(true);
    await water.click();
    await expect(page.locator("#resultDialog")).toHaveJSProperty("open", true, { timeout: 15_000 });
  });
}

test("blank-board deselection leaves a usable Add word entry and double click relocates the same picker", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile", "Pointer semantics covered once.");
  await startChallenge(page, { width: 390, height: 844 });
  const bloom = page.locator("#constellationBloom");
  const trigger = page.locator("#constellationBloomTrigger");
  await trigger.click();
  await page.locator("#constellationBloomWords [data-word='earth']").click();
  await expect(page.locator("#constellationBloomTitle")).toHaveText("Combine with Earth");
  await trigger.click();
  await expect(bloom).toHaveAttribute("data-stage", "closed");
  const point = await blankBoardPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".board-word[data-word='earth']")).toHaveAttribute("aria-pressed", "false");
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAccessibleName("Add a word");
  await expect(page.locator("#constellationBloomCancel")).toBeHidden();
  const before = await bloom.evaluate(el => el.style.getPropertyValue("--bloom-origin-x"));
  const next = await blankBoardPoint(page, { reverse: true });
  await page.mouse.dblclick(next.x, next.y);
  await expect(bloom).toHaveAttribute("data-stage", "words");
  await expectNoBloomTransition(page);
  await expect(bloom).toHaveCount(1);
  const after = await bloom.evaluate(el => el.style.getPropertyValue("--bloom-origin-x"));
  expect(after).not.toBe(before);
});

test("anchored cancellation restores a recoverable picker", async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo), "Touch anchor flow.");
  await startChallenge(page, { width: 320, height: 568 });
  await page.locator("#constellationBloomTrigger").click();
  await page.locator("#constellationBloomWords [data-word='earth']").click();
  await expect(page.locator("#constellationBloomTitle")).toHaveText("Combine with Earth");
  await page.locator("#constellationBloomTrigger").click();
  await expect(page.locator("#constellationBloomCancel")).toBeVisible();
  await page.locator("#constellationBloomCancel").click();
  await expect(page.locator(".board-word[data-word='earth']")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#constellationBloomTrigger")).toHaveAccessibleName("Add a word");
  await expect(page.locator("#constellationBloomTrigger")).toBeFocused();
});

test("Groups retains populated semantic categories and selected group on reopening", async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo), "Touch library groups.");
  await startExplore(page, { width: 390, height: 844 }, { discovered: ["Earth", "Water", "Fire", "Air", "House", "City"] });
  const { bloom } = await openBrowse(page);
  await expect(page.locator("[data-bloom-category='architecture']")).toHaveAccessibleName(/Architecture, 2 words/i);
  await expect(page.locator("[data-bloom-category='liquids']")).toHaveCount(0);
  await page.locator("[data-bloom-category='architecture']").click();
  await expect(bloom).toHaveAttribute("data-stage", "words");
  await expect(page.locator("#constellationBloomWords .constellation-bloom__word")).toHaveCount(2);
  await page.locator("#constellationBloomTrigger").click();
  await expect(bloom).toHaveAttribute("data-stage", "closed");
  await page.locator("#constellationBloomTrigger").click();
  await expect(bloom).toHaveAttribute("data-stage", "words");
  await expect(page.locator("#constellationBloomWords [data-word='house']")).toBeVisible();
  await expect(page.locator("#constellationBloomWords [data-word='city']")).toBeVisible();
});

test("large word collections page within a bounded palette and search restores the group", async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo), "Touch library pagination.");
  await startExplore(page, { width: 320, height: 568 });
  const { bloom, search } = await openBrowse(page);
  await page.locator("[data-bloom-category='all']").click();
  const words = page.locator("#constellationBloomWords .constellation-bloom__word");
  await expectNoBloomTransition(page);
  await expect(words.first()).toBeVisible();
  const capacity = await words.count();
  expect(capacity).toBeGreaterThan(0);
  expect(capacity).toBeLessThanOrEqual(8);
  const first = await words.evaluateAll(items => items.map(item => item.dataset.word));
  await page.locator("#constellationBloomNext").click();
  await expect(page.locator("#constellationBloomPage")).toHaveText(`2 / ${Math.ceil(19 / capacity)}`);
  expect(await words.evaluateAll(items => items.map(item => item.dataset.word))).not.toEqual(first);
  await search.fill("wat");
  await expect(bloom).toHaveAttribute("data-stage", "search");
  await expect(words).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(search).toHaveValue("");
  await expect(bloom).toHaveAttribute("data-stage", "words");
  await expect(words).toHaveCount(capacity);
});

test("keyboard opening, Escape, Close and reduced motion keep Bloom usable", async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo), "Touch accessibility with keyboard fallback.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startChallenge(page, { width: 320, height: 568 });
  const bloom = page.locator("#constellationBloom");
  const trigger = page.locator("#constellationBloomTrigger");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(bloom).toHaveAttribute("data-stage", "words");
  await expect(page.locator("#constellationBloomWords button").first()).toBeFocused();
  await page.locator("#constellationBloomBack").click();
  await expect(bloom).toHaveAttribute("data-stage", "categories");
  const results = await new AxeBuilder({ page }).include("#constellationBloom").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.filter(v => ["serious", "critical"].includes(v.impact))).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(bloom).toHaveAttribute("data-stage", "closed");
  await expect(trigger).toBeFocused();
  await openBrowse(page);
  await trigger.click();
  await expect(bloom).toHaveAttribute("data-stage", "closed");
});

test("wide desktop defaults to inventory and can opt into the Spatial Bloom selector", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP_PROJECT, "Desktop Observatory input is covered once in desktop Chromium.");
  const game = await startExplore(page, { width: 1280, height: 800 });
  await expect(game).toHaveAttribute("data-play-layout", "wide");
  await expect(game).toHaveAttribute("data-word-input", "inventory");
  await expect(page.locator("#constellationBloom")).toBeHidden();
  await expect(page.locator(".inventory")).toBeVisible();

  await page.locator("#pauseRunButton").click();
  const pause = page.locator("#pauseDialog");
  await expect(pause).toHaveJSProperty("open", true);
  const preference = pause.locator("[data-spatial-bloom-preference]");
  await expect(preference).toHaveAttribute("aria-pressed", "false");
  await preference.click();
  await expect(preference).toHaveAttribute("aria-pressed", "true");
  await page.locator("#resumePausedRun").click();
  await expect(pause).toHaveJSProperty("open", false);

  await expect(game).toHaveAttribute("data-word-input", "bloom");
  await expect(page.locator("#constellationBloom")).toBeVisible();
  await expect(page.locator("#constellationBloomTrigger")).toBeVisible();
  await expect(page.locator(".inventory")).toBeHidden();
});

test("an ultra-short wide desktop contains its HUD and places words outside persistent blockers", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP_PROJECT, "Short wide desktop geometry is covered once in desktop Chromium.");
  const game = await startChallenge(page, { width: 1897, height: 243 });
  await expect(game).toHaveAttribute("data-play-layout", "wide");
  await expect(game).toHaveAttribute("data-word-input", "inventory");
  await page.locator('.inventory-word[data-word="earth"]').click();
  await expect(page.locator('.board-word[data-word="earth"]')).toBeVisible();
  await settleLayout(page);

  const geometry = await page.locator("#board").evaluate((board) => {
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
    };
    const visibleRect = (element) => {
      if (!element || element.hidden) return null;
      const bounds = element.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return null;
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
    };
    const overlaps = (left, right, gap = 0) => !(
      left.right + gap <= right.left || right.right + gap <= left.left
      || left.bottom + gap <= right.top || right.bottom + gap <= left.top
    );
    const boardRect = rect(board);
    const tools = rect(document.querySelector("#boardQuickTools"));
    const route = visibleRect(document.querySelector("#runMilestone"));
    const word = rect(board.querySelector('.board-word[data-word="earth"]'));
    const inside = (item) => item.left >= boardRect.left && item.right <= boardRect.right
      && item.top >= boardRect.top && item.bottom <= boardRect.bottom;
    return {
      toolsInside: tools.left >= 0 && tools.right <= innerWidth && tools.top >= 0 && tools.bottom <= innerHeight,
      routeVisible: Boolean(route),
      routeInside: route ? route.left >= 0 && route.right <= innerWidth && route.top >= 0 && route.bottom <= innerHeight : true,
      wordInside: inside(word),
      hudOverlap: route ? overlaps(tools, route, 6) : false,
      wordToolsOverlap: overlaps(word, tools, 6),
      wordRouteOverlap: route ? overlaps(word, route, 6) : false,
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });
  expect(geometry.toolsInside).toBe(true);
  expect(geometry.routeInside).toBe(true);
  expect(geometry.wordInside).toBe(true);
  expect(geometry.hudOverlap).toBe(false);
  expect(geometry.wordToolsOverlap).toBe(false);
  expect(geometry.wordRouteOverlap).toBe(false);
  expect(geometry.pageOverflow).toBe(false);
});



const LARGE_BLOOM_LIBRARY = [...new Set([
  "Earth", "Water", "Fire", "Air",
  ...[...new Set(EXPANDED_RECIPES.map(recipe => recipe.word))].sort((a, b) => b.length - a.length).slice(0, 24),
  ...EXPANDED_RECIPE_BASE_CONCEPTS
])].slice(0, 144);

async function expectBloomPageFits(page) {
  const geometry = await page.locator("#constellationBloomWords").evaluate(list => ({
    scroll: list.scrollHeight, height: list.clientHeight,
    words: [...list.querySelectorAll("button")].map(button => {
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { word: button.dataset.word, width: rect.width, height: rect.height, hit: hit === button || button.contains(hit) };
    })
  }));
  expect(geometry.scroll, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.height + 1);
  for (const word of geometry.words) {
    expect(word.width, word.word).toBeGreaterThanOrEqual(44);
    expect(word.height, word.word).toBeGreaterThanOrEqual(44);
    expect(word.hit, word.word).toBe(true);
  }
}

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
  test(`large Bloom library fits, follows its grid, and retains paging focus at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    test.skip(viewport.width > 900 ? testInfo.project.name !== DESKTOP_PROJECT : !isMobileProject(testInfo), "One matching pointer model per viewport.");
    await startExplore(page, viewport, { discovered: LARGE_BLOOM_LIBRARY });
    if (viewport.width > 900) {
      await page.locator("#pauseRunButton").click();
      await page.locator("#pauseDialog [data-spatial-bloom-preference]").click();
      await page.locator("#resumePausedRun").click();
    }
    const bloom = page.locator("#constellationBloom");
    const words = page.locator("#constellationBloomWords button");
    await page.locator("#constellationBloomTrigger").click();
    await expectNoBloomTransition(page);
    await expectBloomPageFits(page);
    const ids = await words.evaluateAll(items => items.map(item => item.dataset.word));
    const columns = Number(await bloom.getAttribute("data-columns"));
    await words.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(words.nth(1)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(words.nth(Math.min(ids.length - 1, 1 + columns))).toBeFocused();
    await page.keyboard.press("End");
    await expect(words.last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(words.first()).toBeFocused();
    const next = page.locator("#constellationBloomNext");
    await next.focus();
    await page.keyboard.press("Enter");
    await expectNoBloomTransition(page);
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");
    await expectNoBloomTransition(page);
    await expect(page.locator("#constellationBloomPage")).toHaveText(/^3 \/ /);
    await expect(next).toBeFocused();
    await expectBloomPageFits(page);
    const search = page.locator("#constellationBloomSearch");
    await search.pressSequentially("Satellite Constellation", { delay: 2 });
    await expect(words).toHaveCount(1);
    await expect(words).toHaveAttribute("data-word", "satellite constellation");
    await expect(bloom).not.toHaveAttribute("data-transition", /\S/);
    await expectBloomPageFits(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("#constellationBloomPage")).toHaveText(/^3 \/ /);
    await expect(words.first()).toBeFocused();
    await expectBloomPageFits(page);
  });
}

test("large Bloom library adapts to reduced visible height and 200 percent pinch zoom", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile", "Chromium visual viewport stress test.");
  await startExplore(page, { width: 390, height: 844 }, { discovered: LARGE_BLOOM_LIBRARY });
  const bloom = page.locator("#constellationBloom");
  await page.setViewportSize({ width: 390, height: 360 });
  await expect(page.locator("#gameScreen")).toHaveAttribute("data-play-layout", "short-landscape");
  await page.waitForTimeout(300);
  await page.locator("#constellationBloomTrigger").click();
  await expectNoBloomTransition(page);
  await expectBloomPageFits(page);
  const search = page.locator("#constellationBloomSearch");
  await search.fill("Satellite");
  await expectBloomPageFits(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#gameScreen")).toHaveAttribute("data-play-layout", "stacked");
  await page.waitForTimeout(300);
  if (await bloom.getAttribute("data-stage") === "closed") await page.locator("#constellationBloomTrigger").click();
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await expect(bloom).toHaveAttribute("data-columns", "1");
    await expectBloomPageFits(page);
    const geometry = await page.locator("#constellationBloomPanel").evaluate(panel => {
      const r = panel.getBoundingClientRect(), v = visualViewport;
      const title = panel.querySelector(".constellation-bloom__head strong").getBoundingClientRect();
      const close = document.querySelector("#constellationBloomTrigger").getBoundingClientRect();
      return { titleRight: title.right, closeLeft: close.left, left: r.left, right: r.right, top: r.top, bottom: r.bottom, visibleLeft: v.offsetLeft, visibleRight: v.offsetLeft + v.width, visibleTop: v.offsetTop, visibleBottom: v.offsetTop + v.height };
    });
    expect(geometry.titleRight).toBeLessThanOrEqual(geometry.closeLeft - 4);
    expect(geometry.left).toBeGreaterThanOrEqual(geometry.visibleLeft);
    expect(geometry.right).toBeLessThanOrEqual(geometry.visibleRight);
    expect(geometry.top).toBeGreaterThanOrEqual(geometry.visibleTop);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.visibleBottom);
  } finally { await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 }); await session.detach(); }
});
