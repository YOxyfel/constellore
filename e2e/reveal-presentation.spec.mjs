import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const REVEAL_ROUTE = [
  { a: "Earth", b: "Water", word: "Mud", emoji: "🟫", category: "nature", source: "core" },
  { a: "Fire", b: "Air", word: "Energy", emoji: "⚡", category: "force", source: "core" },
  { a: "Earth", b: "Air", word: "Dust", emoji: "🌫️", category: "nature", source: "core" },
  { a: "Water", b: "Air", word: "Rain", emoji: "🌧️", category: "nature", source: "core" },
  { a: "Mud", b: "Energy", word: "Brick", emoji: "🧱", category: "structure", source: "core" },
  { a: "Dust", b: "Rain", word: "Atmosphere", emoji: "🪐", category: "nature", source: "core" },
  { a: "Brick", b: "Atmosphere", word: "Wall", emoji: "🧱", category: "structure", source: "core" }
];

async function openDeterministicReveal(page, { pauseAtStart = false } = {}) {
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

  await page.goto("/play/?challenge=1&target=Wall&seed=73");
  await expect(page.locator(".first-open-cinematic")).toHaveCount(0);
  await expect(page.locator("#missionBriefingDialog")).toHaveJSProperty("open", true);
  await page.locator("#beginMission").click();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await page.locator("#senseButton").click();
  await expect(page.locator("#senseDialog")).toHaveJSProperty("open", true);
  await page.locator("#revealPathButton").click();
  await expect(page.locator("#revealDialog")).toHaveJSProperty("open", true);

  await page.evaluate(({ shouldPause }) => {
    const boardItems = document.querySelector("#boardItems");
    const controller = document.querySelector("#revealController");
    const stepText = document.querySelector("#revealStepText");
    const equation = document.querySelector("#revealEquation");
    const audit = { frames: [], labels: [], phases: [], pauseAtStart: shouldPause };
    window.__revealPresentationAudit = audit;

    const record = () => {
      const words = [...boardItems.querySelectorAll(".board-word")].map((element) => ({
        word: element.dataset.word || element.textContent.trim(),
        key: element.dataset.revealKey || "",
        wave: Number(element.dataset.revealWave || 0),
        past: element.classList.contains("reveal-past"),
        source: element.classList.contains("reveal-source"),
        result: element.classList.contains("reveal-result"),
        target: element.classList.contains("reveal-target"),
        merging: element.classList.contains("merging"),
        opacity: Number(getComputedStyle(element).opacity)
      }));
      const label = stepText.textContent.trim();
      const phase = equation?.dataset.phase || "";
      audit.frames.push({
        words,
        label,
        phase,
        equationLabel: equation?.getAttribute("aria-label") || "",
        activePaths: Number(document.querySelector("#board")?.dataset.revealActivePaths || 0),
        completedPaths: Number(document.querySelector("#board")?.dataset.revealCompletedPaths || 0)
      });
      if (label && audit.labels.at(-1) !== label) audit.labels.push(label);
      if (phase && audit.phases.at(-1) !== phase) audit.phases.push(phase);
      if (audit.pauseAtStart && !controller.hidden && !document.querySelector("#revealPause").disabled) {
        audit.pauseAtStart = false;
        document.querySelector("#revealPause").click();
      }
    };

    const observer = new MutationObserver(() => queueMicrotask(record));
    observer.observe(boardItems, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    observer.observe(controller, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
    if (equation) observer.observe(equation, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "data-phase"] });
    audit.observer = observer;
    record();
  }, { shouldPause: pauseAtStart });

  await page.locator("#confirmReveal").click();
  await expect(page.locator("#revealController")).toBeVisible();
}

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
  });
  await installSeenIntroFixture(page);
});

test("answer reveal grows parallel branches and leaves the full path on the board", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The reveal choreography is covered once in Chromium.");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDeterministicReveal(page, { pauseAtStart: true });

  await expect(page.locator("#revealPause")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#revealStepText")).toHaveText("4 paths combining together · 0 of 7");
  await expect(page.locator("#revealEquation")).toBeVisible();
  await expect(page.locator("#revealEquation")).toHaveAttribute("data-phase", "summon");
  await expect(page.locator("#revealEquation .reveal-term")).toHaveCount(3);
  await expect(page.locator("#revealEquation .reveal-a")).toContainText("Earth");
  await expect(page.locator("#revealEquation .reveal-b")).toContainText("Water");
  await expect(page.locator("#revealEquation .reveal-answer")).toContainText("?");
  await expect(page.locator(".board-word.reveal-source")).toHaveCount(4);
  const compactLayout = await page.evaluate(() => {
    const rectOf = (element) => element.getBoundingClientRect();
    const overlaps = (left, right) => !(
      left.right <= right.left
      || right.right <= left.left
      || left.bottom <= right.top
      || right.bottom <= left.top
    );
    const board = rectOf(document.querySelector("#board"));
    const equation = rectOf(document.querySelector("#revealEquation"));
    const controller = rectOf(document.querySelector("#revealController"));
    const sources = [...document.querySelectorAll(".board-word.reveal-source")];
    return {
      boardHeight: board.height,
      contentHeight: Number(document.querySelector("#board").dataset.revealContentHeight || 0),
      compact: document.querySelector("#board").dataset.revealCompact,
      sources: sources.map((element) => {
        const rect = rectOf(element);
        const label = element.querySelector("span:last-child");
        return {
          withinBoard: rect.top >= board.top - 1 && rect.bottom <= board.bottom + 1,
          avoidsEquation: !overlaps(rect, equation),
          avoidsController: !overlaps(rect, controller),
          emojiHidden: getComputedStyle(element.querySelector(".emoji")).display === "none",
          lineClamp: getComputedStyle(label).webkitLineClamp,
          fullLabel: element.getAttribute("aria-label")
        };
      })
    };
  });
  expect(compactLayout.compact).toBe("true");
  expect(compactLayout.contentHeight).toBeGreaterThan(compactLayout.boardHeight);
  for (const source of compactLayout.sources) {
    expect(source.withinBoard).toBeTruthy();
    expect(source.avoidsEquation).toBeTruthy();
    expect(source.avoidsController).toBeTruthy();
    expect(source.emojiHidden).toBeTruthy();
    expect(source.lineClamp).toBe("2");
    expect(source.fullLabel).toContain("revealed constellation word");
  }

  const sourceAnimations = await page.locator(".board-word.reveal-source").evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).animationName));
  expect(sourceAnimations.every((animation) => animation === "none")).toBeTruthy();
  const equationAnimations = await page.locator("#revealEquation, #revealEquation *").evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).animationName));
  expect(equationAnimations.every((animation) => animation === "none")).toBeTruthy();

  await page.setViewportSize({ width: 1200, height: 600 });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await expect(page.locator("#board")).toHaveAttribute("data-reveal-compact", "false");
  const rotatedLayout = await page.evaluate(() => {
    const board = document.querySelector("#board").getBoundingClientRect();
    const canvas = document.querySelector("#cosmosCanvas").getBoundingClientRect();
    const nodes = [...document.querySelectorAll(".board-word.reveal-source")].map((element) => element.getBoundingClientRect());
    const overlaps = nodes.some((left, leftIndex) => nodes.some((right, rightIndex) =>
      rightIndex > leftIndex
      && !(left.right <= right.left || right.right <= left.left || left.bottom <= right.top || right.bottom <= left.top)
    ));
    return {
      canvasAligned: Math.abs(canvas.width - board.width) <= 1 && Math.abs(canvas.height - board.height) <= 1,
      nodesInside: nodes.every((node) =>
        node.left >= board.left - 1
        && node.right <= board.right + 1
        && node.top >= board.top - 1
        && node.bottom <= board.bottom + 1
      ),
      overlaps
    };
  });
  expect(rotatedLayout).toEqual({ canvasAligned: true, nodesInside: true, overlaps: false });

  await page.locator("#revealSkip").click();
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", true);
  await expect(page.locator(".board-word.reveal-target")).toHaveCount(1);
  await expect(page.locator(".board-word.reveal-past")).toHaveCount(10);
  await expect(page.locator(".board-word")).toHaveCount(11);
  await expect(page.locator("#board")).toHaveAttribute("data-reveal-edge-count", "14");
  await expect(page.locator("#revealStepText")).toContainText("Answer complete");
  await expect(page.locator("#revealEquation")).toBeHidden();
  await expect(page.locator("#revealController")).toBeHidden();

  const settledOpacity = await page.locator(".board-word.reveal-past").evaluateAll((elements) =>
    elements.map((element) => Number(getComputedStyle(element).opacity)));
  expect(settledOpacity.every((opacity) => opacity >= .3 && opacity <= .85)).toBeTruthy();
  const targetOpacity = await page.locator(".board-word.reveal-target").evaluate((element) =>
    Number(getComputedStyle(element).opacity));
  expect(targetOpacity).toBeGreaterThanOrEqual(.95);
  const overlappingWords = await page.locator(".board-word").evaluateAll((elements) => {
    const rectangles = elements.map((element) => ({ word: element.textContent.trim(), rect: element.getBoundingClientRect() }));
    const overlaps = [];
    for (let left = 0; left < rectangles.length; left += 1) {
      for (let right = left + 1; right < rectangles.length; right += 1) {
        const a = rectangles[left].rect;
        const b = rectangles[right].rect;
        if (!(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)) {
          overlaps.push(`${rectangles[left].word}/${rectangles[right].word}`);
        }
      }
    }
    return overlaps;
  });
  expect(overlappingWords).toEqual([]);

  const audit = await page.evaluate(() => {
    const value = window.__revealPresentationAudit;
    value.observer.disconnect();
    return { frames: value.frames, labels: value.labels, phases: value.phases };
  });
  expect(Math.max(...audit.frames.map((frame) => frame.activePaths))).toBeGreaterThanOrEqual(4);
  const populatedCounts = audit.frames.map((frame) => frame.words.length).filter(Boolean);
  expect(populatedCounts.every((count, index) => index === 0 || count >= populatedCounts[index - 1])).toBeTruthy();
  expect(audit.frames.some((frame) => frame.phase === "complete"
    && frame.words.length === 11
    && frame.words.some((word) => word.word.toLowerCase() === "wall" && word.target)
    && frame.words.filter((word) => word.past).length === 10)).toBeTruthy();
});

test("normal-motion answer reveal visibly stages summon, merge, result, and completion", async ({ page, browserName }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openDeterministicReveal(page);

  await expect(page.locator("#revealEquation")).toBeVisible();
  await expect(page.locator("#revealEquation")).toHaveAttribute("data-phase", "summon");
  await expect(page.locator("#board")).toHaveAttribute("data-reveal-active-paths", "4");
  await expect(page.locator("#revealStepText")).toHaveText("4 paths combining together · 0 of 7");
  const visualEffects = await page.locator("#revealEquation, #revealEquation *, .board-word.reveal-source").evaluateAll((elements) =>
    elements.filter((element) => {
      const style = getComputedStyle(element);
      return style.animationName !== "none"
        || style.boxShadow !== "none"
        || style.filter !== "none"
        || style.transitionDuration.split(",").some((duration) => Number.parseFloat(duration) > 0);
    }).length);
  expect(visualEffects).toBeGreaterThanOrEqual(3);

  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", true, { timeout: 20_000 });
  await expect(page.locator("#revealEquation")).toBeHidden();
  await expect(page.locator("#revealController")).toBeHidden();
  const audit = await page.evaluate(() => {
    const value = window.__revealPresentationAudit;
    value.observer.disconnect();
    return { frames: value.frames, labels: value.labels, phases: value.phases };
  });
  for (const phase of ["summon", "merge", "result", "complete"]) expect(audit.phases).toContain(phase);
  expect(Math.max(...audit.frames.map((frame) => frame.activePaths))).toBeGreaterThanOrEqual(1);
  if (browserName === "chromium") {
    expect(Math.max(...audit.frames.map((frame) => frame.activePaths))).toBe(4);
    expect(audit.labels).toContain("4 paths combining together · 0 of 7");
    expect(audit.labels).toContain("2 paths combining together · 4 of 7");
    for (const step of REVEAL_ROUTE) {
      expect(audit.frames.some((frame) =>
        frame.equationLabel.includes(`${step.a} + ${step.b} = ${step.word}`))).toBeTruthy();
    }
  }
  await expect(page.locator(".board-word")).toHaveCount(11);
  await expect(page.locator(".board-word.reveal-past")).toHaveCount(10);
});

test("the single replay starts clean, finishes clean, and returns to mode selection", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The reveal replay lifecycle is covered once in Chromium.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDeterministicReveal(page, { pauseAtStart: true });
  await page.locator("#revealSkip").click();
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#resultPrimary")).toContainText("Watch answer once");

  await page.locator("#resultPrimary").click();
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", false);
  await expect(page.locator("#startScreen")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#gameScreen")).toBeHidden();
  await expect(page.locator("#revealController")).toBeHidden();
  await expect(page.locator("#boardItems .board-word")).toHaveCount(0);
  const audit = await page.evaluate(() => {
    const value = window.__revealPresentationAudit;
    value.observer.disconnect();
    return value.frames.map((frame) => frame.words.length);
  });
  expect(Math.max(...audit)).toBe(11);
});
