import { expect, test } from "@playwright/test";

const REVEAL_ROUTE = [
  { a: "Earth", b: "Water", word: "Mud", emoji: "🟫", category: "nature", source: "core" },
  { a: "Fire", b: "Mud", word: "Brick", emoji: "🧱", category: "structure", source: "core" },
  { a: "Brick", b: "Brick", word: "Wall", emoji: "🧱", category: "structure", source: "core" }
];

async function openDeterministicReveal(page, { pauseAtStart = false } = {}) {
  await page.route("**/api/run/reveal", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assisted: true,
        scoringDisabled: true,
        score: 0,
        leaderboardEligible: false,
        route: REVEAL_ROUTE
      })
    });
  });

  await page.goto("/play/?challenge=1&target=Wall&seed=73");
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
        source: element.classList.contains("reveal-source"),
        result: element.classList.contains("reveal-result"),
        target: element.classList.contains("reveal-target"),
        merging: element.classList.contains("merging")
      }));
      const label = stepText.textContent.trim();
      const phase = equation?.dataset.phase || "";
      audit.frames.push({ words, label, phase });
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
  });
});

test("answer reveal keeps one readable equation on stage and removes old DOM between steps", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The reveal choreography is covered once in Chromium.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDeterministicReveal(page, { pauseAtStart: true });

  await expect(page.locator("#revealPause")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#revealStepText")).toHaveText("Step 1 of 3: Earth + Water");
  await expect(page.locator("#revealEquation")).toBeVisible();
  await expect(page.locator("#revealEquation")).toHaveAttribute("data-phase", "summon");
  await expect(page.locator("#revealEquation .reveal-term")).toHaveCount(3);
  await expect(page.locator("#revealEquation .reveal-a")).toContainText("Earth");
  await expect(page.locator("#revealEquation .reveal-b")).toContainText("Water");
  await expect(page.locator("#revealEquation .reveal-answer")).toContainText("?");
  await expect(page.locator(".board-word.reveal-source")).toHaveCount(2);

  const sourceAnimations = await page.locator(".board-word.reveal-source").evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).animationName));
  expect(sourceAnimations.every((animation) => animation === "none")).toBeTruthy();
  const equationAnimations = await page.locator("#revealEquation, #revealEquation *").evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).animationName));
  expect(equationAnimations.every((animation) => animation === "none")).toBeTruthy();

  await page.locator("#revealSkip").click();
  await expect(page.locator("#resultDialog")).toHaveJSProperty("open", true);
  await expect(page.locator(".board-word.reveal-target")).toHaveCount(1);
  await expect(page.locator(".board-word")).toHaveCount(1);
  await expect(page.locator("#revealStepText")).toContainText("Answer complete");

  const audit = await page.evaluate(() => {
    const value = window.__revealPresentationAudit;
    value.observer.disconnect();
    return { frames: value.frames, labels: value.labels, phases: value.phases };
  });
  expect(Math.max(...audit.frames.map((frame) => frame.words.length))).toBeLessThanOrEqual(3);
  expect(audit.frames.some((frame) => frame.phase === "complete"
    && frame.words.length === 1
    && frame.words[0].word.toLowerCase() === "wall"
    && frame.words[0].target)).toBeTruthy();
});

test("normal-motion answer reveal visibly stages summon, merge, result, and completion", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The reveal choreography is covered once in Chromium.");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openDeterministicReveal(page);

  await expect(page.locator("#revealEquation")).toBeVisible();
  await expect(page.locator("#revealEquation")).toHaveAttribute("data-phase", "summon");
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
  const audit = await page.evaluate(() => {
    const value = window.__revealPresentationAudit;
    value.observer.disconnect();
    return { frames: value.frames, phases: value.phases };
  });
  for (const phase of ["summon", "merge", "result", "complete"]) expect(audit.phases).toContain(phase);
  expect(Math.max(...audit.frames.map((frame) => frame.words.length))).toBeLessThanOrEqual(3);
  for (const [index, step] of REVEAL_ROUTE.entries()) {
    expect(audit.labels).toContain(`Step ${index + 1} of ${REVEAL_ROUTE.length}: ${step.a} + ${step.b}`);
    expect(audit.labels).toContain(`Step ${index + 1} of ${REVEAL_ROUTE.length}: ${step.a} + ${step.b} = ${step.word}`);
    expect(audit.frames.some((frame) => {
      if (frame.phase !== "summon" || !frame.label.startsWith(`Step ${index + 1} of `)) return false;
      const words = frame.words.map((word) => word.word.toLowerCase()).sort();
      return JSON.stringify(words) === JSON.stringify([step.a.toLowerCase(), step.b.toLowerCase()].sort());
    })).toBeTruthy();
    expect(audit.frames.some((frame) => frame.phase === "result"
      && frame.words.length === 1
      && frame.words[0].word.toLowerCase() === step.word.toLowerCase()
      && (frame.words[0].result || frame.words[0].target))).toBeTruthy();
  }
  const readableTerms = await page.locator("#revealEquation .reveal-term strong").evaluateAll((elements) =>
    elements.every((element) => element.scrollWidth <= element.clientWidth + 1));
  expect(readableTerms).toBeTruthy();
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
  expect(Math.max(...audit)).toBeLessThanOrEqual(3);
});
