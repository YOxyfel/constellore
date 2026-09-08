import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const releaseVersion = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
).version;
const releaseVersionPattern = releaseVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RAIN_CHALLENGE_URL = "/play/?challenge=1&target=Rain&seed=73";
const FULL_MOTION_HIDE_FLOOR_MS = 3_100;
const FULL_MOTION_HIDE_CEILING_MS = 3_900;
const REDUCED_MOTION_HIDE_CEILING_MS = 650;

test.skip(({ browserName }) => browserName !== "chromium", "Golden Pair geometry and motion are covered on Chromium phone and desktop.");

test.beforeEach(async ({ page }) => {
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
    sessionStorage.setItem("constellore-birthday-voyage-prompt-v1", "shown");
  });
  await installSeenIntroFixture(page);
});

async function startRainChallenge(page) {
  await page.goto(RAIN_CHALLENGE_URL);

  const goldenStyle = page.locator("link[data-golden-pair-style]");
  await expect(goldenStyle).toHaveCount(0);

  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  await briefing.locator("#beginMission").click();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#boardQuickTools")).toBeVisible();

  await expect(goldenStyle).toHaveCount(1);
  await expect(goldenStyle).toHaveAttribute(
    "href",
    new RegExp(`/story/golden-fusions/golden-pair[.]css\\?v=${releaseVersionPattern}$`)
  );
  await expect.poll(async () => goldenStyle.evaluate((link) => {
    try {
      return Boolean(link.sheet) && link.sheet.cssRules.length > 0;
    } catch {
      return Boolean(link.sheet);
    }
  }), {
    message: "the lazy Golden Pair stylesheet should finish loading",
    timeout: 10_000
  }).toBe(true);
}

async function combineInventoryWords(page, a, b, result) {
  const inventoryWord = (word) => page.locator(`.inventory-word[data-word="${word.toLowerCase()}"]`);
  const first = inventoryWord(a);
  const second = inventoryWord(b);

  await expect(first).toBeVisible();
  await expect(first).toBeEnabled();
  await first.click();
  await expect(page.locator("#tapChainStatus")).toBeVisible();

  await expect(second).toBeVisible();
  await expect(second).toBeEnabled();
  await second.click();
  await expect(inventoryWord(result)).toBeVisible();
  await expect(page.locator("#tapChainStatus")).toBeHidden();
}

async function completeRainLeadIn(page) {
  await combineInventoryWords(page, "Fire", "Water", "Steam");
  await combineInventoryWords(page, "Air", "Steam", "Cloud");
  await expect(page.locator("[data-golden-pair]")).toBeHidden();
}

async function installGoldenPairCapture(page) {
  await page.evaluate(() => {
    window.__goldenPairE2ECapture?.observer?.disconnect();
    const board = document.querySelector("#board");
    if (!board) throw new Error("The word board is unavailable.");

    const capture = {
      active: null,
      hidden: null
    };
    const rectangle = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height
      };
    };
    const isRendered = (element) => {
      if (!element || element.hidden) return false;
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && bounds.width > 0
        && bounds.height > 0;
    };
    const normalizedText = (element) => String(element?.textContent || "").replace(/\s+/g, " ").trim();
    const record = () => {
      const root = board.querySelector("[data-golden-pair]");
      if (!root) return;
      const rendered = isRendered(root);

      if (rendered && !capture.active) {
        const rootBounds = rectangle(root);
        const boardBounds = rectangle(board);
        const sceneBounds = rectangle(root.querySelector("[data-golden-scene]"));
        const resultElement = root.querySelector("[data-golden-result]");
        const resultBounds = rectangle(resultElement);
        const resultLayout = {
          width: resultElement.offsetWidth,
          height: resultElement.offsetHeight
        };
        const tools = board.querySelector("#boardQuickTools");
        const topHud = board.querySelector("#boardTopHud");
        const bottomHud = board.querySelector("#boardBottomHud");
        capture.active = {
          at: performance.now(),
          id: root.getAttribute("data-golden-id"),
          motion: root.getAttribute("data-golden-motion"),
          presentation: root.getAttribute("data-golden-presentation"),
          authored: root.getAttribute("data-golden-authored"),
          motionMode: root.getAttribute("data-golden-motion-mode"),
          phase: root.getAttribute("data-golden-phase"),
          ariaHidden: root.getAttribute("aria-hidden"),
          pointerEvents: getComputedStyle(root).pointerEvents,
          parentIsBoard: root.parentElement === board,
          interactiveDescendants: root.querySelectorAll("button, a, input, select, textarea, [tabindex]").length,
          beats: [...root.querySelectorAll("[data-golden-beat]")].map(normalizedText),
          result: normalizedText(root.querySelector("[data-golden-result-word]")),
          sourceWords: [...root.querySelectorAll("[data-golden-source-word]")].map(normalizedText),
          meteorTrails: root.querySelectorAll("[data-golden-meteor-trail]").length,
          rootBounds,
          boardBounds,
          sceneBounds,
          resultBounds,
          resultLayout,
          rainOnBoard: Boolean(board.querySelector('.board-word[data-word="rain"]')),
          topHudPreserved: Boolean(topHud?.isConnected),
          bottomHudPreserved: Boolean(bottomHud?.isConnected),
          toolsVisible: isRendered(tools),
          toolsText: normalizedText(tools)
        };
      }

      if (!rendered && capture.active && !capture.hidden) {
        capture.hidden = {
          at: performance.now(),
          phase: root.getAttribute("data-golden-phase"),
          reason: root.getAttribute("data-golden-stop-reason"),
          hidden: root.hidden
        };
      }
    };

    const observer = new MutationObserver(record);
    observer.observe(board, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "hidden",
        "data-golden-id",
        "data-golden-motion",
        "data-golden-motion-mode",
        "data-golden-phase",
        "data-golden-stop-reason"
      ]
    });
    window.__goldenPairE2ECapture = { capture, observer };
    record();
  });
}

async function capturedGoldenPair(page) {
  await expect.poll(
    () => page.evaluate(() => Boolean(window.__goldenPairE2ECapture?.capture?.active)),
    { message: "Cloud + Water should play its Golden Pair scene", timeout: 3_000 }
  ).toBe(true);
  return page.evaluate(() => structuredClone(window.__goldenPairE2ECapture.capture.active));
}

async function completedGoldenPair(page) {
  await expect.poll(
    () => page.evaluate(() => Boolean(window.__goldenPairE2ECapture?.capture?.hidden)),
    { message: "the Golden Pair scene should return to its hidden idle phase", timeout: 5_000 }
  ).toBe(true);
  return page.evaluate(() => {
    const { active, hidden } = window.__goldenPairE2ECapture.capture;
    return {
      ...structuredClone(hidden),
      elapsed: hidden.at - active.at
    };
  });
}

function expectSceneInsideBoard(scene) {
  expect(scene.parentIsBoard).toBe(true);
  expect(scene.rootBounds.width).toBeGreaterThan(0);
  expect(scene.rootBounds.height).toBeGreaterThan(0);
  expect(scene.rootBounds.left).toBeGreaterThanOrEqual(scene.boardBounds.left - 1);
  expect(scene.rootBounds.right).toBeLessThanOrEqual(scene.boardBounds.right + 1);
  expect(scene.rootBounds.top).toBeGreaterThanOrEqual(scene.boardBounds.top - 1);
  expect(scene.rootBounds.bottom).toBeLessThanOrEqual(scene.boardBounds.bottom + 1);
  expect(scene.sceneBounds.left).toBeGreaterThanOrEqual(scene.boardBounds.left - 1);
  expect(scene.sceneBounds.right).toBeLessThanOrEqual(scene.boardBounds.right + 1);
  expect(scene.sceneBounds.top).toBeGreaterThanOrEqual(scene.boardBounds.top - 1);
  expect(scene.sceneBounds.bottom).toBeLessThanOrEqual(scene.boardBounds.bottom + 1);
  expect(scene.resultLayout.width).toBeGreaterThan(180);
  expect(scene.resultLayout.width).toBeLessThan(scene.sceneBounds.width);
  expect(scene.resultLayout.height).toBeGreaterThan(48);
  expect(scene.resultLayout.height).toBeLessThan(100);
}

function expectPreservedBoardAndHud(scene) {
  expect(scene.rainOnBoard).toBe(true);
  expect(scene.topHudPreserved).toBe(true);
  expect(scene.bottomHudPreserved).toBe(true);
  expect(scene.toolsVisible).toBe(true);
  expect(scene.toolsText).toContain("Undo");
  expect(scene.toolsText).toContain("Redo");
  expect(scene.toolsText).toContain("Tidy");
  expect(scene.toolsText).toContain("Clear");
}

test("Cloud + Water plays the bounded Rain scene without replacing the responsive board", async ({ page }) => {
  await startRainChallenge(page);
  await completeRainLeadIn(page);
  await installGoldenPairCapture(page);

  await combineInventoryWords(page, "Cloud", "Water", "Rain");

  const scene = await capturedGoldenPair(page);
  expect(scene.id).toBe("golden-01");
  expect(scene.motion).toBe("fall");
  expect(scene.presentation).toBe("authored");
  expect(scene.authored).toBe("true");
  expect(scene.motionMode).toBe("full");
  expect(scene.phase).toBe("active");
  expect(scene.beats).toEqual(["CONDENSE", "RELEASE", "RIPPLE"]);
  expect(scene.result).toBe("Rain");
  expect([...scene.sourceWords].sort()).toEqual(["Cloud", "Water"].sort());
  expect(scene.ariaHidden).toBe("true");
  expect(scene.pointerEvents).toBe("none");
  expect(scene.interactiveDescendants).toBe(0);
  expect(scene.meteorTrails).toBe(2);
  expectSceneInsideBoard(scene);
  expectPreservedBoardAndHud(scene);

  const completed = await completedGoldenPair(page);
  expect(completed.hidden).toBe(true);
  expect(completed.phase).toBe("idle");
  expect(completed.reason).toBe("complete");
  expect(completed.elapsed).toBeGreaterThanOrEqual(FULL_MOTION_HIDE_FLOOR_MS);
  expect(completed.elapsed).toBeLessThanOrEqual(FULL_MOTION_HIDE_CEILING_MS);

  const resultDialog = page.locator("#resultDialog");
  await expect(resultDialog).toHaveJSProperty("open", false);
  await expect(resultDialog).toHaveJSProperty("open", true, { timeout: 3_000 });
  const resultElapsed = await page.evaluate(() =>
    performance.now() - window.__goldenPairE2ECapture.capture.active.at
  );
  expect(resultElapsed).toBeGreaterThanOrEqual(3_600);
});

test("a foundational fusion crosses the board as two meteors and lifts the discovery", async ({ page }) => {
  await startRainChallenge(page);
  await installGoldenPairCapture(page);

  await combineInventoryWords(page, "Earth", "Water", "Mud");

  const scene = await capturedGoldenPair(page);
  expect(scene.id).toBe("major-meteor");
  expect(scene.presentation).toBe("generic");
  expect(scene.authored).toBe("false");
  expect(scene.motion).toBe("pulse");
  expect(scene.beats).toEqual(["APPROACH", "IMPACT", "ASCEND"]);
  expect(scene.result).toBe("Mud");
  expect([...scene.sourceWords].sort()).toEqual(["Earth", "Water"].sort());
  expect(scene.meteorTrails).toBe(2);
  expect(scene.ariaHidden).toBe("true");
  expect(scene.pointerEvents).toBe("none");
  expect(scene.interactiveDescendants).toBe(0);
  expectSceneInsideBoard(scene);

  const completed = await completedGoldenPair(page);
  expect(completed.hidden).toBe(true);
  expect(completed.phase).toBe("idle");
  expect(completed.reason).toBe("complete");
  expect(completed.elapsed).toBeGreaterThanOrEqual(FULL_MOTION_HIDE_FLOOR_MS);
  expect(completed.elapsed).toBeLessThanOrEqual(FULL_MOTION_HIDE_CEILING_MS);
});

test("reduced motion shows the same Rain discovery as a short static frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startRainChallenge(page);
  await completeRainLeadIn(page);
  await installGoldenPairCapture(page);

  await combineInventoryWords(page, "Cloud", "Water", "Rain");

  const scene = await capturedGoldenPair(page);
  expect(scene.id).toBe("golden-01");
  expect(scene.motion).toBe("fall");
  expect(scene.motionMode).toBe("reduced");
  expect(scene.phase).toBe("static");
  expect(scene.beats).toEqual(["CONDENSE", "RELEASE", "RIPPLE"]);
  expect(scene.result).toBe("Rain");
  expect(scene.ariaHidden).toBe("true");
  expect(scene.pointerEvents).toBe("none");
  expectSceneInsideBoard(scene);
  expectPreservedBoardAndHud(scene);

  const completed = await completedGoldenPair(page);
  expect(completed.hidden).toBe(true);
  expect(completed.phase).toBe("idle");
  expect(completed.reason).toBe("complete");
  expect(completed.elapsed).toBeLessThanOrEqual(REDUCED_MOTION_HIDE_CEILING_MS);
});

test("all 50 authored Golden pairs play through the real browser runtime", async ({ page }) => {
  await startRainChallenge(page);

  const audit = await page.evaluate(async (version) => {
    const [{ ANIMATIONS }, { createGoldenPairRuntime }] = await Promise.all([
      import(`/play/story/golden-fusions/golden-pair-animations.mjs?v=${version}`),
      import(`/play/story/golden-fusions/golden-pair-runtime.mjs?v=${version}`)
    ]);
    const board = document.querySelector("#board");
    const overlaysBefore = board.querySelectorAll("[data-golden-pair-runtime-root]").length;
    const auditHost = document.createElement("div");
    auditHost.setAttribute("data-golden-pair-audit-root", "");
    board.append(auditHost);
    const runtime = await createGoldenPairRuntime({
      root: auditHost,
      reducedMotion: () => false
    });
    const failures = [];
    const ids = new Set();
    const motions = new Set();

    for (const definition of ANIMATIONS) {
      const outcome = runtime.play({
        a: { word: definition.a, emoji: "✦" },
        b: { word: definition.b, emoji: "✦" },
        result: { word: definition.target, emoji: "✦" }
      });
      const root = auditHost;
      const scene = root?.querySelector("[data-golden-scene]");
      const result = root?.querySelector("[data-golden-result]");
      const boardBounds = board.getBoundingClientRect();
      const sceneBounds = scene?.getBoundingClientRect();
      const valid = outcome.played
        && root?.getAttribute("data-golden-id") === definition.id
        && root?.getAttribute("data-golden-motion") === definition.motion
        && root?.getAttribute("data-golden-phase") === "active"
        && sceneBounds
        && sceneBounds.left >= boardBounds.left - 1
        && sceneBounds.right <= boardBounds.right + 1
        && sceneBounds.top >= boardBounds.top - 1
        && sceneBounds.bottom <= boardBounds.bottom + 1
        && result?.offsetWidth > 180
        && result?.offsetHeight > 48
        && result?.offsetHeight < 100;
      if (!valid) failures.push(definition.id);
      ids.add(root?.getAttribute("data-golden-id"));
      motions.add(root?.getAttribute("data-golden-motion"));
    }

    runtime.cancel("audit-complete");
    const phase = auditHost.getAttribute("data-golden-phase");
    runtime.dispose();
    auditHost.remove();
    return {
      count: ANIMATIONS.length,
      ids: ids.size,
      motions: motions.size,
      failures,
      overlaysStable: board.querySelectorAll("[data-golden-pair-runtime-root]").length === overlaysBefore,
      phase
    };
  }, releaseVersion);

  expect(audit).toEqual({
    count: 50,
    ids: 50,
    motions: 12,
    failures: [],
    overlaysStable: true,
    phase: "idle"
  });
});
