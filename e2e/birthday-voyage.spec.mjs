import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  BIRTHDAY_CHAPTER_INTRO_MS,
  BIRTHDAY_CHAPTER_RAIL_SETTLE_MS,
  BIRTHDAY_CAR_RESELECT_MS,
  BIRTHDAY_HOVER_DWELL_MS,
  BIRTHDAY_RAGEBAIT_HOLD_MS,
  BIRTHDAY_ROUTE,
  BIRTHDAY_ROUTE_PREVIEW_MS,
  resolveBirthdayVoyageAccess
} from "../public/birthday-voyage.mjs";
import { BIRTHDAY_VOYAGE_VERSION } from "../public/birthday-voyage-config.mjs";

test.describe.configure({ timeout: 240_000 });

const RECIPIENT_ALIASES = Object.freeze([
  "Sophia",
  "София",
  "Sofi",
  "Салфетка",
  "Коте",
  "Слънце"
]);

async function openBirthdayVoyage(page, mode = "replay", {
  clearCheckpoint = true
} = {}) {
  if (page.url() !== "about:blank") {
    await page.evaluate(() => {
      sessionStorage.removeItem("constellore-birthday-e2e-initialized");
    });
  }
  await page.addInitScript(({ clearCheckpoint: shouldClearCheckpoint }) => {
    if (sessionStorage.getItem("constellore-birthday-e2e-initialized") === "true") return;
    localStorage.removeItem("constellore-birthday-voyage-complete-v1");
    localStorage.removeItem("constellore-birthday-voyage-complete-v2");
    if (shouldClearCheckpoint) {
      localStorage.removeItem("constellore-birthday-voyage-checkpoint-v1");
      localStorage.removeItem("constellore-birthday-voyage-checkpoint-v2");
    }
    sessionStorage.clear();
    sessionStorage.setItem("constellore-birthday-e2e-initialized", "true");
    sessionStorage.setItem("constellore-launch-cinematic-session-v1", "played");
  }, { clearCheckpoint });
  await page.goto(`/play/?birthday=${mode}`);
  await expect(page.locator(".birthday-voyage")).toBeVisible();
}

async function enterName(page, name = "Sophia") {
  await page.getByLabel("Traveler name").fill(name);
  await page.getByRole("button", { name: "Join the voyage" }).click();
}

async function expectNoSeriousA11yViolations(page, label) {
  const results = await new AxeBuilder({ page })
    .include(".birthday-voyage")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violations = results.violations.filter(({ impact }) => (
    impact === "serious" || impact === "critical"
  ));
  expect(violations, `${label}: ${violations.map(({ id, impact, help }) => (
    `${impact} ${id} (${help})`
  )).join("; ")}`).toEqual([]);
}

async function expectRouteMediaDecoded(page) {
  await expect.poll(() => page.locator(
    ".birthday-voyage__route-card-back img"
  ).evaluateAll((images) => images.every((image) => (
    image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
  ))), { timeout: 20_000 }).toBe(true);
}

async function expectNoRouteOverlaps(page) {
  const collisions = await page.evaluate(() => {
    const visibleRect = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        rect.width <= 0
        || rect.height <= 0
        || style.display === "none"
        || style.visibility === "hidden"
        || Number.parseFloat(style.opacity || "1") <= .2
      ) return null;
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    };
    const overlap = (first, second, tolerance = 5) => {
      const overlapX = Math.min(first.right, second.right) - Math.max(first.left, second.left);
      const overlapY = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
      return overlapX > tolerance && overlapY > tolerance;
    };
    const cards = Array.from(document.querySelectorAll(".birthday-voyage__route-card"))
      .map((element) => ({
        element,
        name: `card:${element.dataset.destination}`,
        rect: visibleRect(element)
      }))
      .filter(({ rect }) => rect);
    const signs = Array.from(document.querySelectorAll(".birthday-voyage__parking-sign"))
      .map((element) => ({
        element,
        name: `sign:${element.closest(".birthday-voyage__route-card")?.dataset.destination}`,
        rect: visibleRect(element)
      }))
      .filter(({ rect }) => rect);
    const vehicleElement = document.querySelector(".birthday-voyage__vehicle");
    const vehicleRect = vehicleElement ? visibleRect(vehicleElement) : null;
    const found = [];
    for (let index = 0; index < cards.length; index += 1) {
      for (let other = index + 1; other < cards.length; other += 1) {
        if (overlap(cards[index].rect, cards[other].rect, 3)) {
          found.push(`${cards[index].name}/${cards[other].name}`);
        }
      }
    }
    for (const sign of signs) {
      for (const card of cards) {
        if (overlap(sign.rect, card.rect, 4)) found.push(`${sign.name}/${card.name}`);
      }
      if (vehicleRect && overlap(sign.rect, vehicleRect, 6)) {
        found.push(`${sign.name}/vehicle`);
      }
    }
    if (vehicleRect) {
      for (const card of cards) {
        if (overlap(vehicleRect, card.rect, 6)) found.push(`vehicle/${card.name}`);
      }
    }
    return found;
  });
  expect.soft(collisions, "card/sign/vehicle collisions").toEqual([]);
}

async function installVehiclePoseProbe(page) {
  await page.evaluate(() => {
    const vehicle = document.querySelector(".birthday-voyage__vehicle");
    if (!vehicle) throw new Error("The birthday vehicle is missing.");
    const samples = [];
    const sample = () => {
      samples.push({
        angle: Number.parseFloat(vehicle.style.getPropertyValue("--vehicle-angle")) || 0,
        scaleX: Number.parseFloat(vehicle.style.getPropertyValue("--vehicle-facing-scale")) || 1,
        facing: vehicle.dataset.facing || "right",
        rocket: vehicle.classList.contains("is-rocket"),
        phase: vehicle.closest(".birthday-voyage")?.dataset.routePhase || ""
      });
    };
    const observer = new MutationObserver(sample);
    observer.observe(vehicle, {
      attributes: true,
      attributeFilter: ["class", "data-facing", "style"]
    });
    sample();
    window.__birthdayVehiclePoseProbe = { samples, observer };
  });
}

async function readVehiclePoseProbe(page) {
  return page.evaluate(() => {
    const probe = window.__birthdayVehiclePoseProbe;
    probe?.observer?.disconnect?.();
    return probe?.samples || [];
  });
}

function destinationTrigger(page, destinationId) {
  return page.locator(
    `.birthday-voyage__route-card[data-destination="${destinationId}"] .birthday-voyage__route-card-trigger`
  );
}

async function expectEarnestQuestionnaire(page) {
  await expect(page.locator(".birthday-voyage")).not.toContainText(
    /totally serious|rage.?bait|prank|joke|evasive|outsmart|unbiased|chaos|mistake|ignored every answer|real itinerary/i
  );
}

async function runClockUntil(page, predicate, { step = 25, max = 10_000 } = {}) {
  for (let elapsed = 0; elapsed <= max; elapsed += step) {
    if (await predicate()) return elapsed;
    await page.waitForTimeout(step);
  }
  throw new Error(`Birthday route condition was not reached within ${max}ms.`);
}

async function expectPreviewIntroBeforePlayback(fatePreview, accessibleName) {
  await expect(fatePreview).toBeVisible();
  await expect(fatePreview).toHaveAccessibleName(accessibleName);
  await expect(fatePreview).toHaveAttribute("data-opened", "true");
  await expect(fatePreview).toHaveAttribute(
    "data-autoclose-ms",
    String(BIRTHDAY_ROUTE_PREVIEW_MS)
  );
  await expect(fatePreview).toHaveAttribute("data-chapter-phase", "intro", {
    timeout: 2_000
  });
  await expect(fatePreview).toHaveAttribute("data-playing", "false");
  await expect(fatePreview).not.toHaveAttribute("data-chapter-settled", "true");
  const progressState = await fatePreview.locator(
    ".birthday-voyage__route-preview-progress i"
  ).evaluate((bar) => ({
    animationName: getComputedStyle(bar).animationName,
    animationDuration: getComputedStyle(bar).animationDuration
  }));
  expect(progressState.animationName).not.toBe("birthday-route-preview-progress");
}

async function expectPreviewSettledAndPlaying(fatePreview) {
  await expect(fatePreview).toHaveAttribute("data-chapter-phase", "rail", {
    timeout: BIRTHDAY_CHAPTER_INTRO_MS + 1_000
  });
  await expect(fatePreview).toHaveAttribute("data-chapter-settled", "true", {
    timeout: BIRTHDAY_CHAPTER_RAIL_SETTLE_MS + 1_000
  });
  await expect(fatePreview).toHaveAttribute("data-playing", "true");
  await expect(fatePreview).toHaveAttribute("data-playback-started-at", /\d+/);
  const progressTiming = await fatePreview.locator(
    ".birthday-voyage__route-preview-progress i"
  ).evaluate((bar) => {
    const style = getComputedStyle(bar);
    const durationText = style.animationDuration;
    const duration = Number.parseFloat(durationText);
    return {
      animationName: style.animationName,
      durationMs: durationText.endsWith("ms") ? duration : duration * 1_000
    };
  });
  expect(progressTiming.animationName).toBe("birthday-route-preview-progress");
  expect(progressTiming.durationMs).toBe(BIRTHDAY_ROUTE_PREVIEW_MS);
}

async function expectReducedPreviewSettled(fatePreview, accessibleName) {
  await expect(fatePreview).toBeVisible();
  await expect(fatePreview).toHaveAccessibleName(accessibleName);
  await expect(fatePreview).toHaveAttribute(
    "data-autoclose-ms",
    String(BIRTHDAY_ROUTE_PREVIEW_MS)
  );
  await expect(fatePreview).toHaveAttribute("data-chapter-phase", "rail");
  await expect(fatePreview).toHaveAttribute("data-chapter-settled", "true");
  await expect(fatePreview).toHaveAttribute("data-playing", "true");
}

async function installChapterMotionProbe(fatePreview) {
  await fatePreview.evaluate((dialog) => {
    const stage = dialog.querySelector(".birthday-voyage__route-preview-chapter-stage");
    const card = dialog.querySelector(".birthday-voyage__route-preview-card");
    const header = dialog.querySelector(".birthday-voyage__route-preview-header");
    const progress = dialog.querySelector(".birthday-voyage__route-preview-progress");
    if (!(stage && card && header && progress)) {
      throw new Error("The chapter motion probe could not find the preview geometry.");
    }

    const cssTimeToMs = (value) => {
      const text = String(value || "").trim();
      const amount = Number.parseFloat(text);
      if (!Number.isFinite(amount)) return 0;
      return text.endsWith("ms") ? amount : amount * 1_000;
    };
    const cssTimeListToMs = (value) => String(value || "")
      .split(",")
      .map(cssTimeToMs);
    const intersects = (first, second) => (
      Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1
      && Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1
    );
    const snapshot = (elapsed = 0) => {
      const stageRect = stage.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const progressRect = progress.getBoundingClientRect();
      return {
        elapsed,
        centerY: stageRect.top + stageRect.height / 2,
        top: stageRect.top,
        bottom: stageRect.bottom,
        cardTop: cardRect.top,
        cardBottom: cardRect.bottom,
        cardCenterY: cardRect.top + cardRect.height / 2,
        cardHeight: cardRect.height,
        dialogBottom: dialog.getBoundingClientRect().bottom,
        overlapsHeader: intersects(stageRect, headerRect),
        overlapsProgress: intersects(stageRect, progressRect)
      };
    };
    const maxDeclaredMotionMs = () => {
      const style = getComputedStyle(stage);
      const transitionDurations = cssTimeListToMs(style.transitionDuration);
      const transitionDelays = cssTimeListToMs(style.transitionDelay);
      const animationDurations = cssTimeListToMs(style.animationDuration);
      const animationDelays = cssTimeListToMs(style.animationDelay);
      const declared = [
        ...transitionDurations.map((duration, index) => (
          duration + (transitionDelays[index % Math.max(transitionDelays.length, 1)] || 0)
        )),
        ...animationDurations.map((duration, index) => (
          duration + (animationDelays[index % Math.max(animationDelays.length, 1)] || 0)
        ))
      ];
      const running = stage.getAnimations().map((animation) => {
        const timing = animation.effect?.getComputedTiming?.();
        const duration = Number(timing?.activeDuration ?? timing?.duration ?? 0);
        const delay = Number(timing?.delay || 0);
        return (Number.isFinite(duration) ? duration : 0) + (Number.isFinite(delay) ? delay : 0);
      });
      return Math.max(0, ...declared, ...running);
    };

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const probe = {
      reducedMotion,
      intro: snapshot(),
      beforeRail: null,
      maxMotionMs: 0,
      samples: [],
      railStarted: false,
      done: false
    };
    window.__birthdayChapterMotionProbe = probe;

    let observer;
    const beginRailSampling = () => {
      if (probe.railStarted) return;
      probe.railStarted = true;
      probe.beforeRail = snapshot();
      requestAnimationFrame((startedAt) => {
        probe.maxMotionMs = maxDeclaredMotionMs();
        const sampleForMs = reducedMotion
          ? 180
          : Math.max(900, Math.min(probe.maxMotionMs + 180, 2_000));
        const sample = (now) => {
          probe.samples.push(snapshot(now - startedAt));
          if (now - startedAt < sampleForMs) {
            requestAnimationFrame(sample);
            return;
          }
          probe.done = true;
          observer?.disconnect();
        };
        sample(startedAt);
      });
    };

    observer = new MutationObserver(() => {
      if (dialog.dataset.chapterPhase === "rail") beginRailSampling();
    });
    observer.observe(dialog, { attributes: true, attributeFilter: ["data-chapter-phase"] });
    if (dialog.dataset.chapterPhase === "rail") beginRailSampling();
  });
}

async function readChapterMotionProbe(page) {
  await expect.poll(() => page.evaluate(() => (
    window.__birthdayChapterMotionProbe?.done === true
  )), { timeout: 5_000 }).toBe(true);
  return page.evaluate(() => window.__birthdayChapterMotionProbe);
}

function expectChapterMotion(probe, { reducedMotion = false } = {}) {
  expect(probe.reducedMotion).toBe(reducedMotion);
  expect(probe.railStarted).toBe(true);
  expect(probe.samples.length).toBeGreaterThan(reducedMotion ? 2 : 8);

  const first = probe.samples[0];
  const last = probe.samples.at(-1);
  expect(last.centerY).toBeGreaterThan(last.cardCenterY);
  expect(last.bottom).toBeGreaterThan(last.cardTop + last.cardHeight * .7);
  expect(last.bottom).toBeLessThanOrEqual(last.cardBottom + 12);
  expect(last.bottom).toBeLessThanOrEqual(last.dialogBottom);
  expect(last.overlapsHeader).toBe(false);
  expect(last.overlapsProgress).toBe(false);

  if (reducedMotion) {
    expect(probe.maxMotionMs).toBeLessThanOrEqual(100);
    const settledCenters = probe.samples.slice(-3).map(({ centerY }) => centerY);
    expect(Math.max(...settledCenters) - Math.min(...settledCenters)).toBeLessThan(1);
    return;
  }

  expect(Math.abs(probe.intro.centerY - probe.intro.cardCenterY))
    .toBeLessThan(probe.intro.cardHeight * .2);
  expect(probe.maxMotionMs).toBeGreaterThanOrEqual(500);
  expect(probe.maxMotionMs).toBeLessThanOrEqual(2_000);
  expect(last.centerY - first.centerY).toBeGreaterThan(first.cardHeight * .1);
  for (let index = 1; index < probe.samples.length; index += 1) {
    expect(probe.samples[index].centerY).toBeGreaterThanOrEqual(
      probe.samples[index - 1].centerY - 1
    );
  }
  const intermediateCenters = probe.samples
    .slice(1, -1)
    .map(({ centerY }) => centerY)
    .filter((centerY) => centerY > first.centerY + 2 && centerY < last.centerY - 2);
  expect(new Set(intermediateCenters.map((centerY) => Math.round(centerY))).size)
    .toBeGreaterThan(4);
}

async function eliminateCars(page, labels) {
  for (const label of labels) {
    const option = page.getByRole("button", { name: label, exact: true });
    await option.click();
    await expect(option).toHaveCount(0);
  }
}

async function completeRagebaitSurvey(page) {
  await enterName(page);
  await expectEarnestQuestionnaire(page);
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
  await expectEarnestQuestionnaire(page);

  await eliminateCars(page, ["Toyota RAV4", "Mini Cooper", "Porsche 911", "Fiat 500"]);
  await expect(page.getByRole("button", { name: "Volvo 240" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Next question/ }).click();

  await expectEarnestQuestionnaire(page);
  await page.getByRole("textbox", { name: "Favorite animal", exact: true }).fill("Lion");
  await page.getByRole("button", { name: "Save animal" }).click();
  await expect(page.locator(".birthday-voyage__saved-answer")).not.toContainText("Lion");
  await page.getByRole("button", { name: /Next question/ }).click();

  await expectEarnestQuestionnaire(page);
  const tokyo = page.locator('.birthday-voyage__city-card[data-slot="tokyo"]');
  await tokyo.click();
  await expect(tokyo).toHaveAttribute("data-sabotaged", "true");
  await expect(tokyo.locator("strong")).toHaveText("Sofia");
  await expect(tokyo).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Next question/ }).click();

  await expectEarnestQuestionnaire(page);
  await expect(page.locator(".birthday-voyage__drink-arena")).toHaveCount(0);
  await expect(page.locator(".birthday-voyage__drink-hint")).toHaveCount(0);
  await page.getByRole("button", { name: "Water" }).focus();
  await page.getByRole("button", { name: "Water" }).press("Enter");
  await expect(page.getByRole("button", { name: "Melted ice" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Review answers/ }).click();
  await expect(page.locator(".birthday-voyage__summary")).toBeVisible();
  await expectEarnestQuestionnaire(page);
}

async function revealFate(page) {
  const confirm = page.getByRole("button", { name: "Confirm", exact: true });
  const confirmBox = await confirm.boundingBox();
  const panelBox = await page.locator(".birthday-voyage__panel").boundingBox();
  const compactCardHeights = await page.locator(".birthday-voyage__summary-card")
    .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
  expect(confirmBox.x + confirmBox.width / 2).toBeGreaterThan(panelBox.x + panelBox.width / 2);
  await confirm.click();
  const revealingFate = page.getByRole("button", { name: "Revealing fate…", exact: true });
  await expect(revealingFate).toBeDisabled();
  await page.waitForTimeout(Math.max(0, BIRTHDAY_RAGEBAIT_HOLD_MS - 220));
  await expect(revealingFate).toBeDisabled();
  await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-revealed", "true");
  await expect(page.getByRole("heading", {
    name: "The stars have reviewed your answers."
  })).toBeVisible();
  await expect(page.locator(".birthday-voyage")).not.toContainText(
    "The questionnaire was rage bait."
  );
  await expect(page.getByText("Fate made four small corrections.", { exact: true }))
    .toBeVisible();
  await expect(page.locator(".birthday-voyage__lion-intro-video")).toHaveCount(0);
  await expect(page.locator(".birthday-voyage__summary-card.is-overruled")).toHaveCount(4);
  await expect(page.locator(".birthday-voyage__fate-replacement"))
    .toHaveText(["Toyota RAV4", "Lion", "Vienna", "Water"]);
  const strikeTargets = await page.locator(".birthday-voyage__summary-card").evaluateAll((cards) => (
    cards.map((card) => {
      const original = card.querySelector(".birthday-voyage__answer-original");
      const replacement = card.querySelector(".birthday-voyage__fate-replacement");
      const originalBox = original.getBoundingClientRect();
      const replacementBox = replacement.getBoundingClientRect();
      return {
        cardStrike: getComputedStyle(card, "::before").content,
        originalStrike: getComputedStyle(original, "::before").content,
        originalBottom: originalBox.bottom,
        replacementTop: replacementBox.top
      };
    })
  ));
  expect(strikeTargets.every(({ cardStrike }) => cardStrike === "none")).toBe(true);
  expect(strikeTargets.every(({ originalStrike }) => originalStrike !== "none")).toBe(true);
  expect(strikeTargets.every(({ originalBottom, replacementTop }) => originalBottom < replacementTop)).toBe(true);
  await expect(page.getByRole("button", { name: "Let fate drive", exact: true }))
    .toBeEnabled();
  const expandedCardHeights = await page.locator(".birthday-voyage__summary-card")
    .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
  expect(expandedCardHeights.every((height, index) => (
    height >= compactCardHeights[index] + 30
  ))).toBe(true);
}

async function startRouteAfterLion(page, {
  finishIntro = false
} = {}) {
  await revealFate(page);
  await page.getByRole("button", { name: "Let fate drive", exact: true }).click();
  const startWithSound = page.getByRole("button", {
    name: "Start our journey with sound",
    exact: true
  });
  await expect(startWithSound).toBeVisible();
  const video = page.locator(".birthday-voyage__lion-intro-video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("poster", /lion-intro-poster-master[.]webp$/);
  await expect(video).not.toHaveAttribute("autoplay", "");
  await expect.poll(() => video.evaluate((element) => element.duration)).toBeGreaterThan(9);
  expect(await video.evaluate((element) => ({
    muted: element.muted,
    volume: element.volume
  }))).toEqual({ muted: false, volume: 1 });
  await startWithSound.click();
  await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-playback", "playing");
  if (!finishIntro) await page.waitForTimeout(80);
  await video.dispatchEvent("ended");
  await expect(page.locator(".birthday-voyage__route")).toBeVisible();
}

test("the version-two gift contract exposes complete route media metadata", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Static contract only needs one project.");
  expect(BIRTHDAY_VOYAGE_VERSION).toBe(2);
  expect(BIRTHDAY_ROUTE).toHaveLength(11);
  expect(BIRTHDAY_ROUTE.map(({ id }) => id)).toEqual([
    "varna",
    "vienna",
    "brussels",
    "sofia",
    "tokyo",
    "shibuya",
    "earth",
    "moon",
    "mars",
    "kepler",
    "cosmos"
  ]);
  for (const destination of BIRTHDAY_ROUTE) {
    expect(destination.thumb, `${destination.id} thumbnail`).toMatch(/[.]webp$/);
    expect(destination.poster, `${destination.id} poster`).toMatch(/[.]webp$/);
    expect(Array.isArray(destination.videoSources), `${destination.id} videoSources`).toBe(true);
    expect(destination.alt, `${destination.id} alt`).not.toHaveLength(0);
    expect(destination.story, `${destination.id} story`).not.toHaveLength(0);
    expect(destination.scenePreset, `${destination.id} scene preset`).not.toHaveLength(0);
    expect(destination.soundPreset, `${destination.id} sound preset`).not.toHaveLength(0);
    expect(destination.durationMs, `${destination.id} duration`).toBe(BIRTHDAY_ROUTE_PREVIEW_MS);
  }
  expect(resolveBirthdayVoyageAccess("Guest", {
    locationRef: { href: "https://example.com/play/?birthday=special" }
  }).special).toBe(false);
  for (const placeholderName of ["", "me", "admin", "Starlight"]) {
    expect(resolveBirthdayVoyageAccess(placeholderName, {
      locationRef: { href: "https://example.com/play/?birthday=replay" }
    }).special, `${placeholderName || "blank"} must never unlock the private route`).toBe(false);
  }
  expect(resolveBirthdayVoyageAccess("Guest", {
    locationRef: { href: "http://127.0.0.1:4173/play/?birthday=SpEcIaL" }
  }).special).toBe(true);
});

test("destination masters and board thumbnails decode at their intended resolutions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Asset dimensions only need one decoder.");
  await page.goto("/play/");
  const media = await page.evaluate(async (destinations) => {
    const decode = (source) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({
        source,
        width: image.naturalWidth,
        height: image.naturalHeight,
        decoded: image.naturalWidth > 0
      });
      image.onerror = () => resolve({ source, width: 0, height: 0, decoded: false });
      image.src = source;
    });
    return Promise.all(destinations.flatMap((destination) => ([
      decode(destination.thumb).then((result) => ({
        ...result,
        id: destination.id,
        kind: destination.kind,
        role: "thumb"
      })),
      decode(destination.poster).then((result) => ({
        ...result,
        id: destination.id,
        kind: destination.kind,
        role: "poster"
      }))
    ])));
  }, BIRTHDAY_ROUTE.map(({ id, kind, thumb, poster }) => ({ id, kind, thumb, poster })));

  expect(media.every(({ decoded }) => decoded), JSON.stringify(media, null, 2)).toBe(true);
  const thumbnails = media.filter(({ role }) => role === "thumb");
  expect(thumbnails.every(({ width, height }) => width <= 512 && height <= 512)).toBe(true);
  const cityMasters = media.filter(({ role, kind }) => role === "poster" && kind === "city");
  expect(cityMasters.every(({ width, height }) => width >= 1440 && height >= 960), (
    JSON.stringify(cityMasters, null, 2)
  )).toBe(true);
  const planetMasters = media.filter(({ role, kind }) => role === "poster" && kind === "planet");
  expect(planetMasters.every(({ width, height }) => width >= 1024 && height >= 1024), (
    JSON.stringify(planetMasters, null, 2)
  )).toBe(true);
});

test("all six recipient aliases unlock the real replay gift", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "One browser covers identity normalization.");
  for (const alias of RECIPIENT_ALIASES) {
    await openBirthdayVoyage(page, "RePlAy");
    await enterName(page, alias);
    await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-special", "true");
    await expect(page.getByRole("heading", { name: "There you are, Sophia." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Begin questionnaire" })).toBeVisible();
  }
});

test("birthday special is a localhost-only test route", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "One browser covers the local-only override.");
  await openBirthdayVoyage(page, "SpEcIaL");
  await enterName(page, "Local QA Traveler");
  await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-special", "true");
  await expect(page.getByRole("heading", { name: "There you are, Sophia." })).toBeVisible();
});

test("birthday audio remains controllable and restores the host soundtrack on every exit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "One browser covers the audio lifecycle.");
  await openBirthdayVoyage(page, "replay");
  const voyage = page.locator(".birthday-voyage");
  const muteButton = page.getByRole("button", { name: "Mute voyage sound" });
  await expect(muteButton).toBeVisible();
  await expect(voyage).toHaveAttribute("data-sound", "on");
  await muteButton.click();
  await expect(page.getByRole("button", { name: "Turn voyage sound on" })).toBeVisible();
  await expect(voyage).toHaveAttribute("data-sound", "muted");
  expect(await page.evaluate(() => (
    localStorage.getItem("constellore-birthday-audio-muted-v1")
  ))).toBe("muted");

  await enterName(page, "Sophia");
  await expect(page.getByRole("button", { name: "Turn voyage sound on" })).toBeVisible();
  await page.getByRole("button", { name: "Turn voyage sound on" }).click();
  await expect(page.getByRole("button", { name: "Mute voyage sound" })).toBeVisible();
  await expect(voyage).toHaveAttribute("data-sound", "on");

  const lifecycle = await page.evaluate(async () => {
    const { createBirthdayVoyageAudioDirector } = await import(
      "/birthday-voyage-audio.mjs?birthday-e2e-lifecycle=1"
    );
    let ducks = 0;
    let restores = 0;
    const makeDirector = () => createBirthdayVoyageAudioDirector({
      windowRef: window,
      documentRef: document,
      storage: sessionStorage,
      getPreferences: () => ({
        muted: false,
        sound: true,
        music: true,
        volume: 1,
        sfxVolume: 1,
        musicVolume: 1
      }),
      hostAudio: {
        duck() { ducks += 1; },
        restore() { restores += 1; }
      }
    });
    const attach = (director, id) => {
      const root = document.createElement("section");
      root.id = id;
      document.body.append(root);
      director.enter({ root });
      return root;
    };

    const detachedDirector = makeDirector();
    const detachedRoot = attach(detachedDirector, "birthday-audio-detached-root");
    detachedRoot.remove();
    await new Promise((resolve) => setTimeout(resolve, 40));
    const detached = detachedDirector.state.entered;
    detachedDirector.dispose();

    const hiddenDirector = makeDirector();
    attach(hiddenDirector, "birthday-audio-pagehide-root");
    window.dispatchEvent(new Event("pagehide"));
    const pageHidden = hiddenDirector.state.entered;
    hiddenDirector.dispose();

    const failedLaunchDirector = makeDirector();
    const failedRoot = attach(failedLaunchDirector, "birthday-audio-failed-root");
    failedLaunchDirector.dispose();
    failedRoot.remove();

    return { ducks, restores, detached, pageHidden };
  });
  expect(lifecycle).toEqual({
    ducks: 3,
    restores: 3,
    detached: false,
    pageHidden: false
  });
});

test("the birthday modal keeps keyboard focus inside the voyage", async ({ page }) => {
  await openBirthdayVoyage(page, "replay");
  const voyage = page.locator(".birthday-voyage");
  await expect(page.getByLabel("Traveler name")).toBeFocused();
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press(index === 0 ? "Shift+Tab" : "Tab");
    await expect.poll(() => page.evaluate(() => (
      Boolean(document.activeElement?.closest?.(".birthday-voyage"))
    ))).toBe(true);
  }
  await expect(voyage).toBeVisible();
});

test("the gate and questionnaire have no serious accessibility violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Representative Axe scans run once.");
  await openBirthdayVoyage(page, "replay");
  await expectNoSeriousA11yViolations(page, "traveler gate");
  await enterName(page, "Sophia");
  await expectNoSeriousA11yViolations(page, "private gift unlock");
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
  await expectNoSeriousA11yViolations(page, "first questionnaire step");
});

test("question headings receive focus and are announced as the survey advances", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "One keyboard engine covers dynamic focus.");
  await openBirthdayVoyage(page, "replay");
  await enterName(page);
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
  await expect(page.getByRole("heading", { name: "Choose the perfect road-trip car." }))
    .toBeFocused();

  await eliminateCars(page, ["Toyota RAV4", "Mini Cooper", "Porsche 911", "Fiat 500"]);
  await page.getByRole("button", { name: /Next question/ }).click();
  await expect(page.getByRole("heading", { name: "What is your favorite animal?" }))
    .toBeFocused();
  await page.getByRole("textbox", { name: "Favorite animal", exact: true }).fill("Capybara");
  await page.getByRole("button", { name: "Save animal" }).click();
  await page.getByRole("button", { name: /Next question/ }).click();
  await expect(page.getByRole("heading", { name: "Which city would you choose?" }))
    .toBeFocused();

  const sofia = page.locator('.birthday-voyage__city-card[data-slot="sofia"]');
  await sofia.click();
  await page.getByRole("button", { name: /Next question/ }).click();
  await expect(page.getByRole("heading", { name: "What is the perfect travel drink?" }))
    .toBeFocused();
});

test("car sabotage rapidly reopens the remaining choices", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "One browser covers the reselection timing contract.");
  await openBirthdayVoyage(page, "replay");
  await enterName(page);
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
  const toyota = page.getByRole("button", { name: "Toyota RAV4", exact: true });
  const startedAt = Date.now();
  await toyota.click();
  await expect(toyota).toHaveClass(/is-removing/);
  await page.waitForTimeout(Math.max(40, BIRTHDAY_CAR_RESELECT_MS - 120));
  await expect(toyota).toBeVisible();
  await expect(toyota).toHaveClass(/is-removing/);
  await expect(toyota).toHaveCount(0);
  const elapsed = Date.now() - startedAt;
  expect(elapsed).toBeGreaterThanOrEqual(BIRTHDAY_CAR_RESELECT_MS - 80);
  expect(elapsed).toBeLessThan(BIRTHDAY_CAR_RESELECT_MS + 700);
  const nextChoice = page.getByRole("button", { name: "Mini Cooper", exact: true });
  await expect(nextChoice).toBeEnabled();
  await expect(nextChoice).toBeFocused();
  await nextChoice.click();
  await expect(nextChoice).toHaveCount(0);
});

test("version-two checkpoints offer both resume and start-over recovery", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "One browser covers local checkpoint recovery.");
  await openBirthdayVoyage(page, "replay");
  await enterName(page);
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
  await page.getByRole("button", { name: "Toyota RAV4", exact: true }).click();
  await expect(page.getByRole("button", { name: "Toyota RAV4", exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("constellore-birthday-voyage-checkpoint-v2");
    if (!raw) return null;
    const value = JSON.parse(raw);
    return {
      version: value.version,
      question: value.question,
      removed: value.responses?.removedCarIds
    };
  })).toEqual({ version: 2, question: "car", removed: ["rav4"] });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Resume our journey?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume our journey" })).toBeFocused();
  await page.getByRole("button", { name: "Resume our journey" }).click();
  await expect(page.getByRole("heading", { name: "Choose the perfect road-trip car." }))
    .toBeVisible();
  await expect(page.getByRole("button", { name: "Toyota RAV4", exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Resume our journey?" })).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByRole("heading", { name: "There you are, Sophia." })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    localStorage.getItem("constellore-birthday-voyage-checkpoint-v2")
  ))).toBeNull();
});

test("the honoree route playfully sabotages answers and reaches the stars", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The full 11-chapter narrative runs once.");
  test.setTimeout(240_000);
  await openBirthdayVoyage(page, "replay");
  await completeRagebaitSurvey(page);

  if (testInfo.project.name === "chromium-desktop") {
    await page.waitForTimeout(900);
    await page.screenshot({
      path: "test-results/birthday-voyage-survey-desktop.png",
      fullPage: true
    });
  }

  const reviewPresentation = await page.locator(".birthday-voyage__summary-card").evaluateAll((cards) => (
    cards.map((card) => ({
      entry: card.dataset.entry,
      animation: getComputedStyle(card).animationName
    }))
  ));
  expect(reviewPresentation.map(({ entry }) => entry)).toEqual(["top", "bottom", "top", "bottom"]);
  const reviewAnimations = reviewPresentation.map(({ animation }) => animation);
  expect(reviewAnimations).toEqual([
    "birthday-summary-drop-top",
    "birthday-summary-drop-bottom",
    "birthday-summary-drop-top",
    "birthday-summary-drop-bottom"
  ]);

  await revealFate(page);
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({
      path: "test-results/birthday-voyage-fate-reveal.png",
      fullPage: true
    });
  }
  await page.getByRole("button", { name: "Let fate drive", exact: true }).click();
  const lionStart = page.getByRole("button", {
    name: "Start our journey with sound",
    exact: true
  });
  await expect(lionStart).toBeVisible();
  await expect(page.locator(".birthday-voyage__lion-intro-video")).toBeVisible();
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({
      path: "test-results/birthday-voyage-lion-intro.png",
      fullPage: true
    });
  }
  await lionStart.click();
  await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-playback", "playing");
  await page.locator(".birthday-voyage__lion-intro-video").dispatchEvent("ended");
  await expect(page.locator(".birthday-voyage__route")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Our Journey" })).toBeVisible();
  await expect(page.getByText("Sophia + Yane · every road, every world, together.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open the birthday message" })).toHaveCount(0);
  await expect(page.locator(".birthday-voyage__route-card")).toHaveCount(11);
  await expectRouteMediaDecoded(page);
  await expectNoRouteOverlaps(page);
  if (testInfo.project.name === "chromium-desktop") {
    await expectNoSeriousA11yViolations(page, "journey board");
  }
  await installVehiclePoseProbe(page);
  const varnaCard = page.locator('.birthday-voyage__route-card[data-destination="varna"]');
  await expect(varnaCard).toHaveClass(/is-special/);
  await expect(page.locator(".birthday-voyage__route-card.is-arrived")).toHaveCount(0);
  await expect(page.locator(".birthday-voyage__arrival-vfx")).toHaveCount(0);
  await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-route-phase", "waiting");
  await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-route-index", "0");
  await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-route-scene", "varna");
  const supportsCardHover = await page.evaluate(() => (
    matchMedia("(hover: hover) and (pointer: fine)").matches
  ));
  await expect(page.locator(".birthday-voyage__route-card-front b"))
    .toHaveText([supportsCardHover ? "Hover me" : "Tap me", ...Array(10).fill("Waiting...")]);
  expect(await page.locator(".birthday-voyage__route-card-back img").evaluateAll((images) => (
    images.map((image) => getComputedStyle(image).opacity)
  ))).toEqual(Array(11).fill("1"));
  const vfxLevels = await page.locator(".birthday-voyage__route-card").evaluateAll((cards) => (
    cards.map((card) => card.style.getPropertyValue("--vfx-level"))
  ));
  expect(vfxLevels).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
  await expect(page.locator(".birthday-voyage__route-card-back strong"))
    .toHaveText(["Varna", "Vienna", "Brussels", "Sofia", "Tokyo", "Shibuya", "Earth", "Moon", "Mars", "Kepler-452b", "Our Cosmos"]);

  const journeyOptionsToggle = page.getByRole("button", { name: "Journey Options" });
  await expect(journeyOptionsToggle).toBeVisible();
  await expect(journeyOptionsToggle).toHaveAttribute("aria-expanded", "false");
  await journeyOptionsToggle.click();
  await expect(journeyOptionsToggle).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("menuitem", { name: "Go to the final moment" }).click();
  const journeyOptionsConfirmation = page.getByRole("dialog", {
    name: "Leave the current chapter?"
  });
  await expect(journeyOptionsConfirmation).toBeVisible();
  await expect(journeyOptionsConfirmation).not.toContainText(/rage.?bait|questionnaire|answer/i);
  await journeyOptionsConfirmation.getByRole("button", { name: "Keep exploring" }).click();
  await expect(journeyOptionsConfirmation).toBeHidden();
  await expect(page.locator("#birthdayRouteBirthdayMessage")).toBeHidden();
  const fateCardTriggers = page.locator(".birthday-voyage__route-card-trigger");
  await expect(fateCardTriggers).toHaveCount(11);
  expect(await fateCardTriggers.evaluateAll((triggers) => triggers.map((trigger) => ({
    hasPopup: trigger.getAttribute("aria-haspopup"),
    controls: trigger.getAttribute("aria-controls")
  })))).toEqual(Array.from({ length: 11 }, () => ({
    hasPopup: "dialog",
      controls: "birthdayRouteCardPreview"
    })));
  const parkingSigns = page.locator(".birthday-voyage__parking-sign");
  await expect(parkingSigns).toHaveCount(11);
  const parkingSignContracts = await parkingSigns.evaluateAll((signs) => signs.map((sign) => ({
    hidden: sign.getAttribute("aria-hidden"),
    kind: sign.getAttribute("data-parking-kind")
  })));
  expect(parkingSignContracts.every(({ hidden, kind }) => (
    hidden === "true" && ["parking", "dock"].includes(kind)
  ))).toBe(true);
  expect(new Set(parkingSignContracts.map(({ kind }) => kind))).toEqual(new Set(["parking", "dock"]));
  const giftWraps = page.locator(".birthday-voyage__gift-wrap");
  await expect(giftWraps).toHaveCount(11);
  await expect(page.locator(".birthday-voyage__gift-lid")).toHaveCount(11);
  await expect(page.locator(".birthday-voyage__gift-ribbon")).toHaveCount(11);
  await expect(page.locator(".birthday-voyage__gift-bow")).toHaveCount(11);
  const giftPrompts = page.locator(".birthday-voyage__gift-prompt");
  await expect(giftPrompts).toHaveCount(11);
  await expect(giftPrompts.filter({ visible: true })).toHaveCount(1);
  await expect(giftPrompts.first()).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".birthday-voyage__route-card-trigger:enabled")).toHaveCount(1);
  const varnaTrigger = destinationTrigger(page, "varna");
  const viennaTrigger = destinationTrigger(page, "vienna");
  await expect(varnaTrigger).toHaveAttribute("aria-label", /Varna/);
  await expect(varnaTrigger).toBeEnabled();
  await expect(viennaTrigger).toBeDisabled();
  const varnaGiftPrompt = varnaCard.locator(".birthday-voyage__gift-prompt");
  await expect(varnaGiftPrompt).toBeVisible();
  await expect(varnaGiftPrompt.locator(".birthday-voyage__gift-prompt-label"))
    .toHaveText(supportsCardHover ? "Hover me" : "Tap me");
  const giftPromptPresentation = await varnaCard.evaluate((card) => {
    const prompt = card.querySelector(".birthday-voyage__gift-prompt");
    const promptLabel = prompt.querySelector(".birthday-voyage__gift-prompt-label");
    const giftWrap = card.querySelector(".birthday-voyage__gift-wrap");
    const cardRect = card.getBoundingClientRect();
    const promptRect = prompt.getBoundingClientRect();
    const promptLabelRect = promptLabel.getBoundingClientRect();
    const promptStyle = getComputedStyle(prompt);
    const wrapStyle = getComputedStyle(giftWrap);
    return {
      centerInsideCard: promptRect.left + promptRect.width / 2 >= cardRect.left
        && promptRect.right - promptRect.width / 2 <= cardRect.right
        && promptRect.top + promptRect.height / 2 >= cardRect.top
        && promptRect.bottom - promptRect.height / 2 <= cardRect.bottom,
      labelContained: promptLabelRect.left >= promptRect.left - 1
        && promptLabelRect.right <= promptRect.right + 1
        && promptLabelRect.top >= promptRect.top - 1
        && promptLabelRect.bottom <= promptRect.bottom + 1,
      labelUnclipped: promptLabel.scrollWidth <= promptLabel.clientWidth + 1,
      promptZ: Number.parseInt(promptStyle.zIndex, 10),
      wrapZ: Number.parseInt(wrapStyle.zIndex, 10),
      backgroundColor: promptStyle.backgroundColor,
      backgroundImage: promptStyle.backgroundImage
    };
  });
  expect(giftPromptPresentation.centerInsideCard).toBe(true);
  expect(giftPromptPresentation.labelContained).toBe(true);
  expect(giftPromptPresentation.labelUnclipped).toBe(true);
  expect(giftPromptPresentation.promptZ).toBeGreaterThan(giftPromptPresentation.wrapZ);
  expect(
    giftPromptPresentation.backgroundColor !== "rgba(0, 0, 0, 0)"
    || giftPromptPresentation.backgroundImage !== "none",
    "the active Hover me prompt needs a readable scrim"
  ).toBe(true);

  const car = page.locator(".birthday-voyage__vehicle-car");
  const vehicle = page.locator(".birthday-voyage__vehicle");
  await expect(car).toHaveAttribute("src", /01-toyota-rav4-2002-gray-right-transparent[.]webp$/);
  await expect.poll(() => car.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await car.evaluate((image) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, 1, 1).data[3];
  })).toBe(0);
  await expect(vehicle).toHaveAttribute("data-position", "before-varna");
  expect(await vehicle.evaluate((element) => (
    Number.parseFloat(element.style.getPropertyValue("--vehicle-x"))
  ))).toBeLessThan(14);

  await page.evaluate(() => {
    const vehicleElement = document.querySelector(".birthday-voyage__vehicle");
    const signElement = document.querySelector(
      '.birthday-voyage__route-card[data-destination="varna"] > .birthday-voyage__parking-sign'
    );
    const probe = {
      activeFrames: 0,
      collisions: []
    };
    window.__birthdayParkingProbe = probe;
    const sampleParkingGeometry = () => {
      const phase = vehicleElement?.dataset.parkingPhase || "";
      if (["approach", "reverse", "straighten"].includes(phase) && signElement) {
        const vehicleRect = vehicleElement.getBoundingClientRect();
        const signRect = signElement.getBoundingClientRect();
        const signOpacity = Number.parseFloat(getComputedStyle(signElement).opacity);
        const overlapX = Math.min(vehicleRect.right, signRect.right)
          - Math.max(vehicleRect.left, signRect.left);
        const overlapY = Math.min(vehicleRect.bottom, signRect.bottom)
          - Math.max(vehicleRect.top, signRect.top);
        probe.activeFrames += 1;
        if (signOpacity > .2 && overlapX > 6 && overlapY > 6) {
          probe.collisions.push({ phase, overlapX, overlapY });
        }
      }
      if (phase !== "settled") requestAnimationFrame(sampleParkingGeometry);
    };
    requestAnimationFrame(sampleParkingGeometry);
  });

  if (supportsCardHover) {
    const hoverStartedAt = Date.now();
    await varnaTrigger.hover();
    await page.waitForTimeout(Math.max(80, BIRTHDAY_HOVER_DWELL_MS - 180));
    await expect(varnaCard).not.toHaveClass(/is-unwrapping/);
    await expect(varnaCard).toHaveClass(/is-unwrapping/);
    expect(Date.now() - hoverStartedAt).toBeGreaterThanOrEqual(BIRTHDAY_HOVER_DWELL_MS - 40);
  } else {
    await varnaTrigger.click();
  }
  await expect(varnaGiftPrompt).toHaveAttribute("data-prompt-state", "opening");
  await expect(varnaGiftPrompt.locator(".birthday-voyage__gift-prompt-label"))
    .toHaveText("Unwrapping...");
  await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-route-phase", "flipping");
  await expect(viennaTrigger).toBeDisabled();

  const compactFateCardBox = await varnaCard.boundingBox();
  const fatePreview = page.locator("#birthdayRouteCardPreview");
  await runClockUntil(page, () => fatePreview.isVisible(), { max: 7_000 });
  await expect(varnaCard).toHaveClass(/is-arrived/);
  await expectPreviewIntroBeforePlayback(fatePreview, "Varna");
  await expect(fatePreview).toHaveAttribute(
    "data-chapter-intro-ms",
    String(BIRTHDAY_CHAPTER_INTRO_MS)
  );
  await expect(fatePreview.getByRole("heading", { name: "Varna" })).toBeVisible();
  const chapterStage = fatePreview.locator(".birthday-voyage__route-preview-chapter-stage");
  await expect(chapterStage).toBeVisible();
  await installChapterMotionProbe(fatePreview);
  await expect(chapterStage).toHaveAttribute("data-chapter-phase", "intro");
  await expect(chapterStage.locator(".birthday-voyage__route-preview-chapter-kicker"))
    .toHaveText("Chapter 01");
  await expect(chapterStage.locator(".birthday-voyage__route-preview-chapter-title"))
    .toHaveText("Where our journey begins");
  await expect(chapterStage.locator(".birthday-voyage__route-preview-chapter-copy"))
    .toHaveText("Where we are now, and where every physical and inner journey begins.");
  await expect(fatePreview.locator("img"))
    .toHaveAttribute("src", /masters\/varna-master[.]webp$/);
  await expect.poll(() => fatePreview.locator("img").evaluate((image) => (
    image.complete && image.naturalWidth > 0
  ))).toBe(true);
  await expect(vehicle).toHaveAttribute("data-position", "varna");
  await expect(vehicle).toHaveClass(/is-parked/);
  await expect(vehicle).toHaveAttribute("data-parking-phase", "settled");
  await expect(vehicle).toHaveAttribute(
    "data-parking-history",
    /(?:^|,)approach,reverse,straighten,settled(?:,|$)/
  );
  const parkingProbe = await page.evaluate(() => window.__birthdayParkingProbe);
  expect(parkingProbe.activeFrames).toBeGreaterThan(3);
  expect(parkingProbe.collisions).toEqual([]);
  const parkingGeometry = await page.locator(
    '.birthday-voyage__route-card[data-destination="varna"]'
  ).evaluate((card) => {
    const vehicleElement = card.parentElement.querySelector(".birthday-voyage__vehicle");
    const signElement = card.querySelector(":scope > .birthday-voyage__parking-sign");
    const labelElement = signElement.querySelector(".birthday-voyage__parking-sign-label");
    const vehicleRect = vehicleElement.getBoundingClientRect();
    const signRect = signElement.getBoundingClientRect();
    const labelRect = labelElement.getBoundingClientRect();
    const overlapX = Math.min(vehicleRect.right, signRect.right)
      - Math.max(vehicleRect.left, signRect.left);
    const overlapY = Math.min(vehicleRect.bottom, signRect.bottom)
      - Math.max(vehicleRect.top, signRect.top);
    return {
      signClearOfVehicle: overlapX <= 1 || overlapY <= 1,
      labelInsideSign: labelRect.left >= signRect.left - 1
        && labelRect.right <= signRect.right + 1
        && labelRect.top >= signRect.top - 1
        && labelRect.bottom <= signRect.bottom + 1
    };
  });
  expect(parkingGeometry.signClearOfVehicle).toBe(true);
  expect(parkingGeometry.labelInsideSign).toBe(true);
  await expectNoRouteOverlaps(page);
  await expect(viennaTrigger).toBeDisabled();
  const enlargedFateCardBox = await fatePreview.locator(".birthday-voyage__route-preview-card")
    .boundingBox();
  expect(enlargedFateCardBox.width).toBeGreaterThan(compactFateCardBox.width * 2);
  const chapterIntroPresentation = await fatePreview.evaluate((dialog) => {
    const card = dialog.querySelector(".birthday-voyage__route-preview-card");
    const stage = dialog.querySelector(".birthday-voyage__route-preview-chapter-stage");
    const title = stage.querySelector(".birthday-voyage__route-preview-chapter-title");
    const copy = stage.querySelector(".birthday-voyage__route-preview-chapter-copy");
    const cardRect = card.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return {
      stageWidth: stageRect.width,
      cardWidth: cardRect.width,
      centerDelta: Math.abs(
        stageRect.top + stageRect.height / 2 - (cardRect.top + cardRect.height / 2)
      ),
      cardHeight: cardRect.height,
      titleSize: Number.parseFloat(getComputedStyle(title).fontSize),
      copySize: Number.parseFloat(getComputedStyle(copy).fontSize),
      backgroundColor: getComputedStyle(stage).backgroundColor,
      backgroundImage: getComputedStyle(stage).backgroundImage
    };
  });
  expect(chapterIntroPresentation.stageWidth)
    .toBeGreaterThan(chapterIntroPresentation.cardWidth * .55);
  expect(chapterIntroPresentation.centerDelta)
    .toBeLessThan(chapterIntroPresentation.cardHeight * .16);
  expect(chapterIntroPresentation.titleSize)
    .toBeGreaterThan(chapterIntroPresentation.copySize * 1.5);
  expect(
    chapterIntroPresentation.backgroundColor !== "rgba(0, 0, 0, 0)"
    || chapterIntroPresentation.backgroundImage !== "none"
  ).toBe(true);
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({
      path: "test-results/birthday-voyage-fate-card-preview.png",
      fullPage: true
    });
  }
  await expectPreviewSettledAndPlaying(fatePreview);
  await expect(fatePreview).toBeVisible();
  await expect(chapterStage).toHaveAttribute("data-chapter-phase", "rail");
  const chapterMotion = await readChapterMotionProbe(page);
  expectChapterMotion(chapterMotion);
  const chapterRailPresentation = await fatePreview.evaluate((dialog) => {
    const cardRect = dialog.querySelector(".birthday-voyage__route-preview-card").getBoundingClientRect();
    const stageRect = dialog.querySelector(
      ".birthday-voyage__route-preview-chapter-stage"
    ).getBoundingClientRect();
    return {
      stageCenter: stageRect.top + stageRect.height / 2,
      cardCenter: cardRect.top + cardRect.height / 2,
      stageBottom: stageRect.bottom,
      cardBottom: cardRect.bottom,
      stageWidth: stageRect.width
    };
  });
  expect(chapterRailPresentation.stageCenter).toBeGreaterThan(chapterRailPresentation.cardCenter);
  expect(chapterRailPresentation.stageBottom).toBeLessThanOrEqual(chapterRailPresentation.cardBottom + 12);
  expect(chapterRailPresentation.stageWidth).toBeGreaterThanOrEqual(chapterIntroPresentation.stageWidth);
  await expect(viennaTrigger).toBeDisabled();
  await fatePreview.getByRole("button", { name: "Skip destination preview" }).click();
  await runClockUntil(page, () => fatePreview.isHidden(), { max: 1_200 });
  await expect(fatePreview).toHaveAttribute("data-chapter-phase", "idle");
  await expect(varnaCard).toHaveClass(/is-complete/);
  await expect.poll(() => varnaCard.locator(".birthday-voyage__route-card-back img")
    .evaluate((image) => Number.parseFloat(getComputedStyle(image).opacity)))
    .toBeLessThan(1);

  const viennaCard = page.locator('.birthday-voyage__route-card[data-destination="vienna"]');
  await expect(viennaTrigger).toBeEnabled();
  await expect(viennaCard.locator(".birthday-voyage__route-card-front b"))
    .toHaveText(supportsCardHover ? "Hover me" : "Tap me");
  await expect(viennaCard.locator(".birthday-voyage__route-card-back img")).toHaveCSS("opacity", "1");
  await page.waitForTimeout(350);
  await expect(viennaCard).not.toHaveClass(/is-arrived/);
  await expect(fatePreview).toBeHidden();

  if (supportsCardHover) await viennaTrigger.hover();
  else await viennaTrigger.click();
  await expect(viennaCard).toHaveAttribute("data-route-status", "driving");
  await expect(viennaTrigger).toHaveCSS("opacity", "1");
  await expect(viennaCard.locator(".birthday-voyage__route-card-back img"))
    .toHaveCSS("opacity", "1");
  await expect(viennaCard.locator(".birthday-voyage__route-card-back img"))
    .toHaveCSS("filter", "none");
  await runClockUntil(page, () => fatePreview.isVisible(), { max: 7_000 });
  await expectPreviewIntroBeforePlayback(fatePreview, "Vienna");
  await expect(chapterStage.locator(".birthday-voyage__route-preview-chapter-kicker"))
    .toHaveText("Chapter 02");
  await expect(chapterStage.locator(".birthday-voyage__route-preview-chapter-title"))
    .toHaveText("The road opens");
  await expect(fatePreview.locator("img"))
    .toHaveAttribute("src", /masters\/vienna-master[.]webp$/);
  await expect(vehicle).toHaveAttribute("data-position", "vienna");
  await expectPreviewSettledAndPlaying(fatePreview);
  await page.keyboard.press("Escape");
  await runClockUntil(page, () => fatePreview.isHidden(), { max: 700 });
  await expect(fatePreview).toHaveAttribute("data-chapter-phase", "idle");
  await expect(viennaCard).toHaveClass(/is-complete/);
  await expect(destinationTrigger(page, "brussels")).toBeEnabled();

  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({
      path: "test-results/birthday-voyage-route-desktop.png",
      fullPage: true
    });
  }

  const remainingDestinations = [
    ["Brussels", "brussels"],
    ["Sofia", "sofia"],
    ["Tokyo", "tokyo"],
    ["Shibuya", "shibuya"],
    ["Earth", "earth"],
    ["Moon", "moon"],
    ["Mars", "mars"],
    ["Kepler-452b", "kepler"],
    ["Our Cosmos", "cosmos"]
  ];
  for (const [destination, destinationId] of remainingDestinations) {
    const trigger = destinationTrigger(page, destinationId);
    await expect(trigger).toBeEnabled();
    await expect(trigger).toHaveAttribute("aria-label", new RegExp(destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    if (destination === "Shibuya") {
      const cardsDoNotOverlap = await page.evaluate(() => {
        const shibuya = document.querySelector(
          '.birthday-voyage__route-card[data-destination="shibuya"]'
        ).getBoundingClientRect();
        const cosmos = document.querySelector(
          '.birthday-voyage__route-card[data-destination="cosmos"]'
        ).getBoundingClientRect();
        const expandedShibuya = {
          left: shibuya.left - shibuya.width * .06,
          right: shibuya.right + shibuya.width * .06,
          top: shibuya.top - shibuya.height * .06,
          bottom: shibuya.bottom + shibuya.height * .06
        };
        return expandedShibuya.right + 8 <= cosmos.left
          || cosmos.right + 8 <= expandedShibuya.left
          || expandedShibuya.bottom + 8 <= cosmos.top
          || cosmos.bottom + 8 <= expandedShibuya.top;
      });
      expect(cardsDoNotOverlap).toBe(true);
    }
    if (supportsCardHover) await trigger.hover();
    else await trigger.click();
    await runClockUntil(page, () => fatePreview.isVisible(), { max: 7_000 });
    await expectPreviewIntroBeforePlayback(fatePreview, destination);
    if (destination === "Earth") {
      await expect(vehicle).toHaveClass(/is-rocket/);
      await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-space", "true");
      await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-route-scene", "earth");
    }
    if (destination === "Our Cosmos") {
      await expect(fatePreview.locator("img"))
        .toHaveAttribute("src", /masters\/our-cosmos-master[.]webp$/);
      await expect.poll(() => fatePreview.locator("img").evaluate((image) => (
        image.complete && image.naturalWidth > 0
      ))).toBe(true);
      await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-route-scene", "cosmos");
    }
    await expectPreviewSettledAndPlaying(fatePreview);
    await fatePreview.getByRole("button", { name: "Skip destination preview" }).click();
    await runClockUntil(page, () => fatePreview.isHidden(), { max: 600 });
    await expect(page.locator(`.birthday-voyage__route-card[data-destination="${destinationId}"]`))
      .toHaveClass(/is-complete/);
  }

  const vehiclePoseSamples = await readVehiclePoseProbe(page);
  expect(vehiclePoseSamples.length).toBeGreaterThan(20);
  expect(vehiclePoseSamples.filter(({ rocket }) => !rocket)
    .every(({ angle }) => Math.abs(angle) <= 10.01)).toBe(true);
  expect(vehiclePoseSamples.filter(({ rocket }) => rocket)
    .every(({ angle }) => Math.abs(angle) <= 25.01)).toBe(true);
  expect(vehiclePoseSamples.some(({ facing, scaleX, rocket }) => (
    !rocket && facing === "left" && scaleX < 0
  ))).toBe(true);
  expect(vehiclePoseSamples.some(({ facing, scaleX }) => (
    facing === "right" && scaleX > 0
  ))).toBe(true);
  expect(vehiclePoseSamples.some(({ facing, scaleX }) => (
    facing === "left" && scaleX > 0
  ))).toBe(false);

  const birthdayMessageDialog = page.locator("#birthdayRouteBirthdayMessage");
  await expect(birthdayMessageDialog).toBeVisible();
  await expect(birthdayMessageDialog.locator(".birthday-voyage__finale-signature"))
    .toHaveText("София ✦ Яне");
  await expect(birthdayMessageDialog)
    .toHaveAttribute("data-finale-phase", "dedication", { timeout: 5_000 });
  await expect(birthdayMessageDialog.getByRole("heading", {
    name: "Happy birthday, Sophia."
  })).toBeVisible();
  await expect(birthdayMessageDialog).toContainText(
    "Happy birthday, Sophia. Our journey begins here in Varna"
  );
  await expect(birthdayMessageDialog).toContainText(
    "the physical ones, the imagined ones, and the inner worlds we discover together"
  );
  await expect(birthdayMessageDialog).not.toContainText(
    /rage.?bait|questionnaire|fake|The stars have reviewed your answers|Fate made four small corrections/i
  );
  await expect(birthdayMessageDialog.getByRole("button", { name: "Re-explore any chapter" }))
    .toBeVisible();
  await expect(birthdayMessageDialog.getByRole("button", { name: "Watch our whole journey again" }))
    .toBeVisible();
  await expect(birthdayMessageDialog.getByRole("button", { name: "Continue to Constellore" }))
    .toBeVisible();
  if (testInfo.project.name === "chromium-desktop") {
    await expectNoSeriousA11yViolations(page, "birthday finale");
  }
  await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-route-mode", "message");
  await expect(page.locator(".birthday-voyage__route-card.is-complete")).toHaveCount(11);
  await expect(page.locator(".birthday-voyage__route-card-trigger:enabled")).toHaveCount(0);
  await expect(birthdayMessageDialog).toHaveAttribute("data-locked", "true");
  const topClose = page.locator(".birthday-voyage__close");
  await expect(topClose).toBeDisabled();
  await expect(topClose).toHaveAttribute("aria-hidden", "true");
  await expect(topClose).toHaveAttribute("tabindex", "-1");
  if (testInfo.project.name === "chromium-desktop") {
    // Capture the settled confession rather than the intentional blurred
    // opening frame, so the artifact remains useful for visual review.
    await page.waitForTimeout(760);
    await page.screenshot({
      path: "test-results/birthday-voyage-birthday-message.png",
      fullPage: true
    });
  }

  await page.keyboard.press("Escape");
  await expect(birthdayMessageDialog).toBeVisible();
  await birthdayMessageDialog.dispatchEvent("click");
  await expect(birthdayMessageDialog).toBeVisible();
  for (const key of ["q", "ArrowLeft", "Space"]) {
    await page.keyboard.press(key);
    await expect(birthdayMessageDialog).toBeVisible();
  }
  await birthdayMessageDialog.evaluate((dialog) => dialog.close());
  await expect(birthdayMessageDialog).toBeVisible();
  await birthdayMessageDialog.getByRole("button", { name: "Re-explore any chapter" }).click();
  await expect(birthdayMessageDialog).toBeHidden();
  await expect(page.locator(".birthday-voyage")).toBeVisible();
  await expect(page.locator(".birthday-voyage__route")).toBeVisible();
  await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-route-mode", "reexplore");
  await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-route-phase", "explore");
  await expect(page.locator(".birthday-voyage__route-card-trigger:enabled")).toHaveCount(11);
});

test("answers survive Back and Next while Water evades a mouse", async ({ page }, testInfo) => {
  await openBirthdayVoyage(page, "replay");
  await enterName(page);
  await page.getByRole("button", { name: "Begin questionnaire" }).click();

  await eliminateCars(page, ["Toyota RAV4", "Mini Cooper", "Porsche 911", "Fiat 500"]);
  await page.getByRole("button", { name: /Next question/ }).click();

  await page.getByRole("textbox", { name: "Favorite animal", exact: true }).fill("Capybara");
  await page.getByRole("button", { name: "Save animal" }).click();
  await expect(page.locator(".birthday-voyage__saved-answer")).toHaveText("Saved answer: Capybara");
  await page.getByRole("textbox", { name: "Favorite animal", exact: true }).fill("Lion");
  await page.getByRole("button", { name: "Resave animal" }).click();
  const machineAnimal = await page.locator(".birthday-voyage__saved-answer").textContent();
  await page.getByRole("button", { name: /Back/ }).click();
  await expect(page.getByRole("button", { name: "Toyota RAV4" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Volvo 240" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Volvo 240" })).toBeDisabled();
  await page.getByRole("button", { name: /Next question/ }).click();
  await expect(page.getByRole("textbox", { name: "Favorite animal", exact: true }))
    .toHaveValue("Lion");
  await expect(page.locator(".birthday-voyage__saved-answer")).toHaveText(machineAnimal);
  await page.getByRole("button", { name: /Next question/ }).click();

  const tokyo = page.locator('.birthday-voyage__city-card[data-slot="tokyo"]');
  await tokyo.click();
  await expect(tokyo.locator("strong")).toHaveText("Sofia");
  await page.getByRole("button", { name: /Next question/ }).click();

  const water = page.getByRole("button", { name: "Water" });
  const supportsMouseEvasion = await page.evaluate(() => (
    matchMedia("(hover: hover) and (pointer: fine)").matches
  ));
  if (supportsMouseEvasion) {
    await expect(water).toHaveClass(/is-viewport-evasive/);
    const initialDrinkRows = await page.locator(
      '.birthday-voyage button[data-value="water"], .birthday-voyage__drink-options button[data-value]'
    ).evaluateAll((buttons) => buttons.map((button) => ({
      value: button.dataset.value,
      top: button.getBoundingClientRect().top,
      height: button.getBoundingClientRect().height
    })));
    expect(initialDrinkRows).toHaveLength(5);
    const initialWaterRow = initialDrinkRows.find(({ value }) => value === "water");
    const initialOtherRows = initialDrinkRows.filter(({ value }) => value !== "water");
    expect(initialOtherRows.every(({ top }) => Math.abs(top - initialWaterRow.top) < 3)).toBe(true);
    expect(initialOtherRows.every(({ height }) => Math.abs(height - initialWaterRow.height) < 3)).toBe(true);
    const viewport = page.viewportSize();
    const restingBox = await water.boundingBox();
    const restingCenterX = restingBox.x + restingBox.width / 2;
    const restingCenterY = restingBox.y + restingBox.height / 2;
    const approachX = restingCenterX > viewport.width / 2
      ? restingCenterX - 170
      : restingCenterX + 170;
    await page.mouse.move(approachX, restingCenterY);
    const smoothPositions = [];
    for (let frame = 0; frame < 8; frame += 1) {
      await page.waitForTimeout(28);
      smoothPositions.push(await water.boundingBox());
    }
    const smoothSteps = smoothPositions.slice(1).map((position, index) => Math.hypot(
      position.x - smoothPositions[index].x,
      position.y - smoothPositions[index].y
    ));
    const distinctSmoothPositions = new Set(smoothPositions.map(({ x, y }) => (
      `${Math.round(x)},${Math.round(y)}`
    )));
    expect(distinctSmoothPositions.size).toBeGreaterThan(2);
    expect(smoothSteps.some((distance) => distance > 1)).toBe(true);
    expect(Math.max(...smoothSteps)).toBeLessThan(80);
    expect(await water.evaluate((element) => element.matches(":hover"))).toBe(false);

    const evasivePositions = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const waterBox = await water.boundingBox();
      await page.mouse.move(
        waterBox.x + waterBox.width / 2,
        waterBox.y + waterBox.height / 2
      );
      await page.waitForTimeout(45);
      expect(await water.evaluate((element) => element.matches(":hover"))).toBe(false);
      const moved = await water.boundingBox();
      evasivePositions.push(moved);
      expect(moved.x).toBeGreaterThanOrEqual(0);
      expect(moved.y).toBeGreaterThanOrEqual(0);
      expect(moved.x + moved.width).toBeLessThanOrEqual(viewport.width);
      expect(moved.y + moved.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(new Set(evasivePositions.map(({ x, y }) => (
      `${Math.round(x)},${Math.round(y)}`
    ))).size).toBeGreaterThan(1);
    await expect(water).toHaveAttribute("aria-pressed", "false");
    if (testInfo.project.name === "chromium-desktop") {
      await page.screenshot({
        path: "test-results/birthday-voyage-water-dodge.png",
        fullPage: true
      });
    }
  } else {
    await expect(water).toBeVisible();
  }

  await page.getByRole("button", { name: "Coffee" }).click();
  await page.getByRole("button", { name: /Back/ }).click();
  await expect(page.locator('.birthday-voyage__city-card[data-slot="tokyo"] strong'))
    .toHaveText("Sofia");
  await expect(page.locator('.birthday-voyage__city-card[data-slot="tokyo"]'))
    .toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Next question/ }).click();
  await expect(page.getByRole("button", { name: "Coffee" })).toHaveAttribute("aria-pressed", "true");
});

test("reset restores false hope before Toyota turns into a sedan", async ({ page }) => {
  await openBirthdayVoyage(page, "replay");
  await enterName(page);
  await page.getByRole("button", { name: "Begin questionnaire" }).click();

  await eliminateCars(page, ["Mini Cooper", "Porsche 911"]);
  await page.getByRole("button", { name: "Reset questionnaire" }).click();
  for (const car of ["Toyota RAV4", "Mini Cooper", "Porsche 911", "Fiat 500", "Volvo 240"]) {
    await expect(page.getByRole("button", { name: car, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Next question/ })).toBeDisabled();

  await eliminateCars(page, ["Mini Cooper", "Porsche 911", "Fiat 500", "Volvo 240"]);
  await expect(page.getByRole("button", { name: "Toyota RAV4" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sedan", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Sedan", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Next question/ })).toBeEnabled();

  await page.getByRole("button", { name: "Reset questionnaire" }).click();
  await expect(page.getByRole("button", { name: "Sedan", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Toyota RAV4", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Next question/ })).toBeDisabled();
});

test("every non-Sofia city card becomes Sofia and the swaps persist", async ({ page }) => {
  await openBirthdayVoyage(page, "replay");
  await enterName(page);
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
  await eliminateCars(page, ["Toyota RAV4", "Mini Cooper", "Porsche 911", "Fiat 500"]);
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByRole("textbox", { name: "Favorite animal", exact: true }).fill("Lion");
  await page.getByRole("button", { name: "Save animal" }).click();
  await page.getByRole("button", { name: /Next question/ }).click();

  for (const slot of ["vienna", "brussels", "tokyo", "shibuya"]) {
    const card = page.locator(`.birthday-voyage__city-card[data-slot="${slot}"]`);
    await card.click();
    await expect(card).toHaveAttribute("data-sabotaged", "true");
    await expect(card.locator("strong")).toHaveText("Sofia");
  }
  const sofia = page.locator('.birthday-voyage__city-card[data-slot="sofia"]');
  await sofia.click();
  await expect(sofia).toHaveAttribute("data-sabotaged", "false");
  await expect(sofia).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /Back/ }).click();
  await page.getByRole("button", { name: /Next question/ }).click();
  for (const slot of ["vienna", "brussels", "tokyo", "shibuya"]) {
    await expect(page.locator(`.birthday-voyage__city-card[data-slot="${slot}"] strong`))
      .toHaveText("Sofia");
  }

  await page.getByRole("button", { name: "Reset questionnaire" }).click();
  await expect(page.getByRole("heading", { name: "Choose the perfect road-trip car." })).toBeVisible();
  await expect(page.locator(".birthday-voyage__choice-grid--cars .birthday-voyage__choice")).toHaveCount(5);
});

test("a non-honoree receives a session-only guest pass", async ({ page }) => {
  await openBirthdayVoyage(page, "replay");
  await enterName(page, "Guest Voyager");
  await expect(page.getByRole("heading", { name: "Welcome aboard, Guest Voyager." })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    sessionStorage.getItem("constellore-birthday-voyage-guest-v2")
  ))).toBe("Guest Voyager");
  await expect(page.locator("#birthdayVoyageGuestBadge")).toContainText("Guest Voyager");
  await page.getByRole("button", { name: "Continue to Constellore" }).click();
  await expect(page.locator(".birthday-voyage")).toHaveCount(0);
  await expect(page.locator("#startScreen")).toBeVisible();
});

test("the special link opens above a persisted run without clearing it", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const activeRun = {
      version: 1,
      savedAt: now,
      game: { mode: "training", target: "Mud", seed: 101 },
      journeyContext: null,
      run: {
        id: "training-birthday-replay",
        token: "local-training",
        startedAt: now,
        deadlineAt: null,
        activationPending: false,
        scoreEligible: false,
        ranked: false,
        localOnly: true,
        clientOnly: true,
        hasRuntimeRun: true
      },
      progress: {
        completed: false,
        submitted: false,
        history: [],
        scoringDisabled: true,
        scoreMultiplier: 0
      },
      visuals: {}
    };
    localStorage.setItem("constellore-active-run-v1", JSON.stringify(activeRun));
    localStorage.setItem("constellore-local-active-run-v1", JSON.stringify(activeRun));
  });

  await openBirthdayVoyage(page);
  await page.getByRole("button", { name: "Close birthday voyage" }).click();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#targetWord")).toHaveText("Mud");
});

test("the birthday route remains usable on a phone", async ({ page }, testInfo) => {
  test.skip(
    !["chromium-mobile", "webkit-mobile"].includes(testInfo.project.name),
    "Phone composition runs in the two mobile projects."
  );
  await page.setViewportSize(
    testInfo.project.name === "webkit-mobile"
      ? { width: 320, height: 568 }
      : { width: 390, height: 844 }
  );
  await openBirthdayVoyage(page, "replay");
  await completeRagebaitSurvey(page);
  await startRouteAfterLion(page);
  await expect(page.locator(".birthday-voyage__route-board")).toBeVisible();

  const geometry = await page.locator(".birthday-voyage__route-board").evaluate((board) => {
    const rect = board.getBoundingClientRect();
    const shell = board.closest(".birthday-voyage__shell");
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      height: rect.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      overflowX: getComputedStyle(board).overflowX,
      overflowY: getComputedStyle(board).overflowY,
      shellOverflowY: getComputedStyle(shell).overflowY,
      shellScrollHeight: shell.scrollHeight,
      shellClientHeight: shell.clientHeight,
      layout: board.dataset.layout
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeGreaterThan(geometry.viewportHeight);
  expect(geometry.height).toBeGreaterThan(geometry.viewportHeight * 1.8);
  expect(geometry.overflowX).toBe("hidden");
  expect(geometry.overflowY).toBe("hidden");
  expect(["auto", "scroll"]).toContain(geometry.shellOverflowY);
  expect(geometry.shellScrollHeight).toBeGreaterThan(geometry.shellClientHeight * 1.8);
  expect(geometry.layout).toBe("mobile");

  const mobileCardWidths = await page.locator(".birthday-voyage__route-card")
    .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().width));
  expect(mobileCardWidths.every((width) => width >= 112)).toBe(true);
  await expectRouteMediaDecoded(page);
  await expectNoRouteOverlaps(page);

  const varnaTrigger = destinationTrigger(page, "varna");
  const mobileViennaTrigger = destinationTrigger(page, "vienna");
  await expect(varnaTrigger).toBeEnabled();
  await expect(mobileViennaTrigger).toBeDisabled();
  await expect(destinationTrigger(page, "kepler")).toBeDisabled();
  const mobileGiftPrompt = page.locator(
    '.birthday-voyage__route-card[data-destination="varna"] .birthday-voyage__gift-prompt'
  );
  const mobilePromptVerb = await page.evaluate(() => (
    matchMedia("(hover: hover) and (pointer: fine)").matches ? "Hover me" : "Tap me"
  ));
  await expect(mobileGiftPrompt).toBeVisible();
  await expect(mobileGiftPrompt.locator(".birthday-voyage__gift-prompt-label"))
    .toHaveText(mobilePromptVerb);

  await varnaTrigger.click();
  await expect(mobileGiftPrompt).toHaveAttribute("data-prompt-state", "opening");
  const fatePreview = page.locator("#birthdayRouteCardPreview");
  await runClockUntil(page, () => fatePreview.isVisible(), { max: 7_000 });
  await expectPreviewIntroBeforePlayback(fatePreview, "Varna");
  await expect(fatePreview.locator(".birthday-voyage__route-preview-chapter-title"))
    .toHaveText("Where our journey begins");
  await installChapterMotionProbe(fatePreview);
  const previewGeometry = await fatePreview.evaluate((dialog) => {
    const dialogRect = dialog.getBoundingClientRect();
    const cardRect = dialog.querySelector(".birthday-voyage__route-preview-card").getBoundingClientRect();
    const chapterRect = dialog.querySelector(
      ".birthday-voyage__route-preview-chapter-stage"
    ).getBoundingClientRect();
    return {
      dialog: {
        left: dialogRect.left,
        top: dialogRect.top,
        right: dialogRect.right,
        bottom: dialogRect.bottom
      },
      card: {
        left: cardRect.left,
        top: cardRect.top,
        right: cardRect.right,
        bottom: cardRect.bottom
      },
      chapter: {
        left: chapterRect.left,
        top: chapterRect.top,
        right: chapterRect.right,
        bottom: chapterRect.bottom,
        centerY: chapterRect.top + chapterRect.height / 2
      },
      cardCenterY: cardRect.top + cardRect.height / 2,
      cardHeight: cardRect.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight
    };
  });
  const transformedEdgeTolerance = 2;
  for (const rect of [previewGeometry.dialog, previewGeometry.card, previewGeometry.chapter]) {
    expect(rect.left).toBeGreaterThanOrEqual(-transformedEdgeTolerance);
    expect(rect.top).toBeGreaterThanOrEqual(-transformedEdgeTolerance);
    expect(rect.right).toBeLessThanOrEqual(previewGeometry.viewportWidth + transformedEdgeTolerance);
    expect(rect.bottom).toBeLessThanOrEqual(previewGeometry.viewportHeight + transformedEdgeTolerance);
  }
  expect(Math.abs(previewGeometry.chapter.centerY - previewGeometry.cardCenterY))
    .toBeLessThan(previewGeometry.cardHeight * .18);
  await expectPreviewSettledAndPlaying(fatePreview);
  const mobileChapterMotion = await readChapterMotionProbe(page);
  expectChapterMotion(mobileChapterMotion);
  await fatePreview.getByRole("button", { name: "Skip destination preview" }).click();
  await runClockUntil(page, () => fatePreview.isHidden(), { max: 1_200 });
  await expect(mobileViennaTrigger).toBeEnabled();

  const parkedVehicle = await page.locator(".birthday-voyage__vehicle").evaluate((vehicle) => {
    const vehicleRect = vehicle.getBoundingClientRect();
    const board = vehicle.closest(".birthday-voyage__route-board");
    const boardRect = board.getBoundingClientRect();
    const sign = board.querySelector(
      '.birthday-voyage__route-card[data-destination="varna"] > .birthday-voyage__parking-sign'
    );
    const label = sign.querySelector(".birthday-voyage__parking-sign-label");
    const signRect = sign.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const overlapX = Math.min(vehicleRect.right, signRect.right)
      - Math.max(vehicleRect.left, signRect.left);
    const overlapY = Math.min(vehicleRect.bottom, signRect.bottom)
      - Math.max(vehicleRect.top, signRect.top);
    return {
      left: vehicleRect.left,
      right: vehicleRect.right,
      boardLeft: boardRect.left,
      boardRight: boardRect.right,
      angle: vehicle.style.getPropertyValue("--vehicle-angle").trim(),
      signClearOfVehicle: overlapX <= 1 || overlapY <= 1,
      labelInsideSign: labelRect.left >= signRect.left - 1
        && labelRect.right <= signRect.right + 1
        && labelRect.top >= signRect.top - 1
        && labelRect.bottom <= signRect.bottom + 1
    };
  });
  expect(parkedVehicle.left).toBeGreaterThanOrEqual(parkedVehicle.boardLeft);
  expect(parkedVehicle.right).toBeLessThanOrEqual(parkedVehicle.boardRight);
  expect(parkedVehicle.angle).toBe("0deg");
  expect(parkedVehicle.signClearOfVehicle).toBe(true);
  expect(parkedVehicle.labelInsideSign).toBe(true);
  await expect(page.locator(".birthday-voyage__vehicle")).toHaveAttribute("data-parking-phase", "settled");
  await expectNoRouteOverlaps(page);

  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({
      path: "test-results/birthday-voyage-route-mobile.png",
      fullPage: true
    });
  }
});

test.describe("reduced-motion birthday voyage", () => {
  test.use({ reducedMotion: "reduce" });

  test("supports reversed chapter replay and whole-story restart from a finale checkpoint", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "One engine covers replay state transitions.");
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.evaluate(() => (
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ))).toBe(true);
    await page.addInitScript((destinationIds) => {
      localStorage.setItem("constellore-birthday-voyage-checkpoint-v2", JSON.stringify({
        version: 2,
        guestName: "Sophia",
        stage: "finale",
        question: "finale",
        responses: {},
        completedChapters: destinationIds,
        currentDestination: "cosmos",
        vehicleMode: "rocket",
        finaleState: "dedication",
        updatedAt: new Date().toISOString()
      }));
    }, BIRTHDAY_ROUTE.map(({ id }) => id));
    await openBirthdayVoyage(page, "replay", { clearCheckpoint: false });
    await enterName(page);
    await expect(page.getByRole("heading", { name: "Resume our journey?" })).toBeVisible();
    await page.getByRole("button", { name: "Resume our journey" }).click();

    const finale = page.locator("#birthdayRouteBirthdayMessage");
    await expect(finale).toBeVisible();
    await expect(finale.locator(".birthday-voyage__finale-signature"))
      .toHaveText("София ✦ Яне");
    await finale.getByRole("button", { name: "Read the dedication" }).click();
    await expect(finale.getByRole("heading", { name: "Happy birthday, Sophia." }))
      .toBeVisible();
    await finale.getByRole("button", { name: "Re-explore any chapter" }).click();
    await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-route-mode", "reexplore");

    const preview = page.locator("#birthdayRouteCardPreview");
    const vehicle = page.locator(".birthday-voyage__vehicle");
    await destinationTrigger(page, "cosmos").click();
    await runClockUntil(page, () => preview.isVisible(), { max: 3_000 });
    await expectReducedPreviewSettled(preview, "Our Cosmos");
    await expect(vehicle).toHaveClass(/is-rocket/);
    await expect(vehicle).toHaveAttribute("data-position", "cosmos");
    await preview.getByRole("button", { name: "Continue our journey" }).click();
    await runClockUntil(page, () => preview.isHidden(), { max: 1_200 });

    await destinationTrigger(page, "vienna").click();
    await runClockUntil(page, () => preview.isVisible(), { max: 3_000 });
    await expectReducedPreviewSettled(preview, "Vienna");
    await expect(vehicle).not.toHaveClass(/is-rocket/);
    await expect(vehicle).toHaveAttribute("data-position", "vienna");
    await preview.getByRole("button", { name: "Continue our journey" }).click();
    await runClockUntil(page, () => preview.isHidden(), { max: 1_200 });
    await expect(page.locator(".birthday-voyage__route-card-trigger:enabled")).toHaveCount(11);

    await page.getByRole("button", { name: "Journey Options" }).click();
    await page.getByRole("menuitem", { name: "Open the birthday message" }).click();
    await expect(finale).toBeVisible();
    await finale.getByRole("button", { name: "Read the dedication" }).click();
    await finale.getByRole("button", { name: "Watch our whole journey again" }).click();
    await expect(page.locator(".birthday-voyage")).toHaveAttribute("data-route-mode", "first-run");
    await expect(page.locator(".birthday-voyage__route-card.is-complete")).toHaveCount(0);
    await expect(destinationTrigger(page, "varna")).toBeEnabled();
    await expect(page.locator(".birthday-voyage__route-card-trigger:enabled")).toHaveCount(1);
  });

  test("uses manual chapter controls without transient motion bursts", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "One engine is enough for the motion preference contract.");
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.evaluate(() => (
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ))).toBe(true);
    await openBirthdayVoyage(page, "replay");
    await completeRagebaitSurvey(page);
    await startRouteAfterLion(page);
    await expect(page.locator(".birthday-voyage__route")).toBeVisible();
    await expect(page.locator(".birthday-voyage__route-card.is-arrived")).toHaveCount(0);
    await expect(page.locator(".birthday-voyage__arrival-vfx")).toHaveCount(0);
    await expect(page.locator(".birthday-voyage")).not.toHaveAttribute("data-space", "true");
    await expectNoRouteOverlaps(page);
    await destinationTrigger(page, "varna").click();
    const fatePreview = page.locator("#birthdayRouteCardPreview");
    await runClockUntil(page, () => fatePreview.isVisible(), { max: 3_000 });
    await expectReducedPreviewSettled(fatePreview, "Varna");
    const chapterStage = fatePreview.locator(".birthday-voyage__route-preview-chapter-stage");
    await expect(chapterStage).toBeVisible();
    await installChapterMotionProbe(fatePreview);
    await expect(page.locator('.birthday-voyage__route-card[data-destination="varna"]'))
      .toHaveClass(/is-arrived/);
    await expect(page.locator(".birthday-voyage__vehicle")).toHaveAttribute("data-position", "varna");
    await expect(page.locator(".birthday-voyage__arrival-vfx")).toHaveCount(0);
    await expectNoRouteOverlaps(page);
    await expect(fatePreview.getByRole("button", { name: "Replay chapter" })).toBeVisible();
    await expect(fatePreview.getByRole("button", { name: "Continue our journey" })).toBeVisible();
    await expect(fatePreview.getByRole("button", { name: "Continue our journey" })).toBeFocused();
    await expect(fatePreview).toHaveAttribute("data-chapter-phase", "rail");
    await expect(fatePreview).toHaveAttribute("data-chapter-settled", "true");
    const reducedChapterMotion = await readChapterMotionProbe(page);
    expectChapterMotion(reducedChapterMotion, { reducedMotion: true });
    await page.waitForTimeout(1_000);
    await expect(fatePreview).toBeVisible();
    await fatePreview.getByRole("button", { name: "Continue our journey" }).click();
    await runClockUntil(page, () => fatePreview.isHidden(), { max: 1_200 });
    await expect(destinationTrigger(page, "vienna")).toBeEnabled();
    await expect(page.locator(".birthday-voyage__route-card.is-arrived")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Happy birthday, Sophia." })).toHaveCount(0);
    await page.getByRole("button", { name: "Journey Options" }).click();
    await page.getByRole("menuitem", { name: "Go to the final moment" }).click();
    const options = page.getByRole("dialog", { name: "Leave the current chapter?" });
    await expect(options).toBeVisible();
    await options.getByRole("button", { name: "Go to the final moment" }).click();
    const finale = page.locator("#birthdayRouteBirthdayMessage");
    await expect(finale).toBeVisible();
    await expect(finale.locator(".birthday-voyage__finale-signature"))
      .toHaveText("София ✦ Яне");
    await finale.getByRole("button", { name: "Read the dedication" }).click();
    await expect(finale.getByRole("heading", { name: "Happy birthday, Sophia." }))
      .toBeVisible();
  });
});
