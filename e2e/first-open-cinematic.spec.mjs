import { expect, test } from "@playwright/test";

const LANDSCAPE_BRAND_RATE_CUE_SECONDS = 15;

async function ensureAutomaticPlayback(cinematic) {
  await expect(cinematic).toHaveAttribute(
    "data-phase",
    /playing|handoff|reveal/,
    { timeout: 12_000 }
  );
  const video = cinematic.locator("video");
  await expect(video).toHaveJSProperty("paused", false);
  await expect.poll(() => video.evaluate((element) => element.currentTime)).toBeGreaterThan(0);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const clearedKey = "constellore-e2e-launch-storage-cleared";
    if (sessionStorage.getItem(clearedKey) === "true") return;
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(clearedKey, "true");
  });
});

test("the first opening plays the Oxyfel brand film and launch video at 1x", async ({ page, browserName }) => {
  test.setTimeout(60_000);
  if (browserName === "chromium") {
    await page.addInitScript(() => {
      globalThis.__constelloreLoopStarts = [];
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      const prototype = AudioContextClass?.prototype;
      if (!prototype || prototype.__constelloreLoopAudit) return;
      const nativeCreateBufferSource = prototype.createBufferSource;
      Object.defineProperty(prototype, "__constelloreLoopAudit", { value: true });
      prototype.createBufferSource = function auditedCreateBufferSource() {
        const activeContext = this;
        const source = nativeCreateBufferSource.call(this);
        const nativeStart = source.start;
        source.start = function auditedStart(...args) {
          if (source.loop) {
            globalThis.__constelloreLoopStarts.push({
              contextState: activeContext.state,
              offset: Number(args[1]) || 0
            });
          }
          return nativeStart.apply(this, args);
        };
        return source;
      };
    });
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/play/");

  const cinematic = page.locator(".first-open-cinematic");
  const video = cinematic.locator("video");
  const expectedLayout = await page.evaluate(() => innerHeight > innerWidth) ? "phone" : "landscape";
  const expectedVideo = expectedLayout === "phone"
    ? /cinematic\/intro-video-phone[.]mp4(?:\?.*)?$/
    : /cinematic\/intro-video[.]mp4(?:\?.*)?$/;
  const expectedBrandCue = expectedLayout === "phone" ? "15.25" : "15";
  await expect(cinematic).toBeVisible();
  await expect(cinematic).toHaveAttribute("data-video-layout", expectedLayout);
  await expect(video).toHaveAttribute("src", expectedVideo);
  await expect(page.locator("#cosmicGate")).toBeHidden();
  await expect(cinematic).toHaveAttribute("data-phase", /blackout|video-prime|playing/);
  await expect(cinematic).toHaveAttribute("data-playback-rate", "1");
  await expect(cinematic).toHaveAttribute("data-brand-playback-rate", "1");
  await expect(cinematic).toHaveAttribute("data-brand-rate-cue", expectedBrandCue);
  await expect(cinematic).toHaveAttribute("data-segment", "brand");
  await expect(video).toHaveJSProperty("playbackRate", 1);
  await ensureAutomaticPlayback(cinematic);
  await expect.poll(() => video.evaluate((element) => element.duration))
    .toBeGreaterThan(expectedLayout === "phone" ? 18 : 24);

  await expect(cinematic).toHaveCount(0, { timeout: 50_000 });
  await expect(page.locator("#cosmicGate")).toBeHidden();
  await expect(page.locator("#startScreen")).toBeVisible();
  await expect(page.locator("#gameScreen")).toBeHidden();
  if (browserName === "chromium") {
    await expect.poll(() => page.evaluate(() => globalThis.__constelloreLoopStarts
      .filter(({ contextState, offset }) => contextState === "running" && offset === 0)
      .length)).toBeGreaterThanOrEqual(2);
  }

  const marker = await page.evaluate(() => JSON.parse(
    localStorage.getItem("constellore-first-open-cinematic-v1") || "null"
  ));
  expect(marker).toMatchObject({ schemaVersion: 1, completed: true });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".first-open-cinematic")).toHaveCount(0);
  await expect(page.locator("#cosmicGate")).toBeHidden();
  await expect(page.locator("#startScreen")).toBeVisible();
});

test("phones receive the portrait cinematic and it paints edge to edge", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/play/");

  const cinematic = page.locator(".first-open-cinematic");
  const video = cinematic.locator("video");
  await expect(cinematic).toBeVisible();
  await expect(cinematic).toHaveAttribute("data-video-layout", "phone");
  await expect(cinematic).toHaveAttribute("data-brand-rate-cue", "15.25");
  await expect(video).toHaveAttribute("src", /cinematic\/intro-video-phone[.]mp4(?:\?.*)?$/);
  await expect.poll(() => video.evaluate((element) => (
    element.videoWidth > 0 && element.videoHeight > 0
  ))).toBe(true);

  const geometry = await cinematic.evaluate((root) => {
    const media = root.querySelector("video");
    const rootRect = root.getBoundingClientRect();
    const videoRect = media.getBoundingClientRect();
    return {
      decodedRatio: media.videoWidth / media.videoHeight,
      root: {
        left: rootRect.left,
        top: rootRect.top,
        right: rootRect.right,
        bottom: rootRect.bottom
      },
      video: {
        left: videoRect.left,
        top: videoRect.top,
        right: videoRect.right,
        bottom: videoRect.bottom,
        objectFit: getComputedStyle(media).objectFit
      }
    };
  });

  expect(geometry.decodedRatio).toBeCloseTo(9 / 16, 2);
  expect(geometry.root.left).toBeLessThanOrEqual(0);
  expect(geometry.root.top).toBeLessThanOrEqual(0);
  expect(geometry.root.right).toBeGreaterThanOrEqual(390);
  expect(geometry.root.bottom).toBeGreaterThanOrEqual(844);
  expect(geometry.video.left).toBeLessThan(0);
  expect(geometry.video.top).toBeLessThan(0);
  expect(geometry.video.right).toBeGreaterThan(390);
  expect(geometry.video.bottom).toBeGreaterThan(844);
  expect(geometry.video.objectFit).toBe("cover");

  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expect(cinematic).toHaveCount(0);
});

test("portrait tablets also use the portrait composition", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/play/");

  const cinematic = page.locator(".first-open-cinematic");
  const video = cinematic.locator("video");
  await expect(cinematic).toBeVisible();
  await expect(cinematic).toHaveAttribute("data-video-layout", "phone");
  await expect(video).toHaveAttribute("src", /cinematic\/intro-video-phone[.]mp4(?:\?.*)?$/);
  await expect.poll(() => video.evaluate((element) => (
    element.videoWidth / element.videoHeight
  ))).toBeCloseTo(9 / 16, 2);

  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expect(cinematic).toHaveCount(0);
});

test("refreshing an active lesson restores the exact orbit without replaying either intro", async ({ page }) => {
  await page.addInitScript(() => {
    const fixtureKey = "constellore-e2e-resume-fixture-v1";
    if (sessionStorage.getItem(fixtureKey) === "seeded") return;
    const now = new Date().toISOString();
    localStorage.setItem("constellore-active-run-v1", JSON.stringify({
      version: 1,
      savedAt: now,
      game: {
        mode: "second-orbit",
        target: "Mountain",
        seed: 202
      },
      journeyContext: null,
      run: {
        id: "client-second-orbit-e2e-resume",
        token: "client-only",
        startedAt: now,
        deadlineAt: null,
        activationPending: false,
        assist: "none",
        scoreEligible: false,
        scoreMultiplier: 0,
        ranked: false,
        localOnly: true,
        clientOnly: true,
        hasRuntimeRun: false
      },
      progress: {
        moves: 1,
        completed: false,
        submitted: false,
        discovered: [
          { word: "Earth", emoji: "🌍", category: "nature", source: "origin" },
          { word: "Water", emoji: "💧", category: "force", source: "origin" },
          { word: "Fire", emoji: "🔥", category: "force", source: "origin" },
          { word: "Air", emoji: "💨", category: "force", source: "origin" },
          { word: "Dust", emoji: "✦", category: "nature", source: "world" }
        ],
        history: [{
          move: 1,
          a: "Earth",
          b: "Air",
          word: "Dust",
          emoji: "✦",
          category: "nature",
          source: "world",
          progressionEligible: false,
          eventEligible: false
        }],
        usedBend: false,
        usedWish: false,
        tipsUsed: 0,
        tipIds: [],
        currentTip: "",
        giftUsed: false,
        giftUnavailable: false,
        giftItem: null,
        assist: "none",
        scoringDisabled: true,
        scoreMultiplier: 0
      },
      visuals: {
        nodes: [
          { word: "Earth", x: 0.2, y: 0.32, z: 11, cosmicTwist: false },
          { word: "Air", x: 0.66, y: 0.34, z: 12, cosmicTwist: false },
          { word: "Dust", x: 0.43, y: 0.62, z: 13, cosmicTwist: false }
        ],
        inventoryQuery: "",
        inventoryRecency: [["dust", 1]]
      }
    }));
    sessionStorage.setItem(fixtureKey, "seeded");
  });

  const assertRestoredOrbit = async () => {
    await expect(page.locator(".first-open-cinematic")).toHaveCount(0);
    await expect(page.locator("#cosmicGate")).toBeHidden();
    await expect(page.locator("#startScreen")).toBeHidden();
    await expect(page.locator("#gameScreen")).toBeVisible();
    await expect(page.locator("#targetWord")).toHaveText("Mountain");
    await expect(page.locator("#movesValue")).toHaveText("1");
    await expect(page.locator('.inventory-word[data-word="dust"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (
      sessionStorage.getItem("constellore-launch-cinematic-session-v1")
    ))).toBe("played");
  };

  await page.goto("/play/");
  await assertRestoredOrbit();

  await page.waitForTimeout(250);
  await page.reload({ waitUntil: "domcontentloaded" });
  await assertRestoredOrbit();
});

test("the cinematic shell covers every phone, tablet, laptop, and ultrawide viewport", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/play/");

  const cinematic = page.locator(".first-open-cinematic");
  const runtimeVideo = cinematic.locator("video");
  await expect(cinematic).toBeVisible();
  await expect(runtimeVideo).toBeAttached();
  await cinematic.evaluate((root) => {
    const fixture = root.cloneNode(true);
    fixture.setAttribute("data-viewport-coverage-fixture", "");
    root.after(fixture);
  });
  const coverageCinematic = page.locator("[data-viewport-coverage-fixture]");
  const video = coverageCinematic.locator("video");
  await expect(coverageCinematic).toBeVisible();
  await expect.poll(() => video.evaluate((element) => (
    element.videoWidth > 0 && element.videoHeight > 0
  ))).toBe(true);
  const decodedVideoSize = await video.evaluate((element) => ({
    width: element.videoWidth,
    height: element.videoHeight
  }));
  const videoLayout = await coverageCinematic.getAttribute("data-video-layout");
  expect(decodedVideoSize.width / decodedVideoSize.height)
    .toBeCloseTo(videoLayout === "phone" ? 9 / 16 : 16 / 9, 2);
  await video.evaluate((element) => {
    element.pause();
    element.currentTime = 2;
  });

  const viewports = [
    { name: "small phone portrait", width: 320, height: 568 },
    { name: "modern phone portrait", width: 390, height: 844 },
    { name: "phone landscape", width: 844, height: 390 },
    { name: "tablet portrait", width: 768, height: 1024 },
    { name: "tablet landscape", width: 1180, height: 820 },
    { name: "laptop", width: 1366, height: 768 },
    { name: "desktop", width: 1920, height: 1080 },
    { name: "ultrawide", width: 3440, height: 1440 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));

    const geometry = await coverageCinematic.evaluate((root) => {
      const media = root.querySelector("video");
      const rootRect = root.getBoundingClientRect();
      const videoRect = media.getBoundingClientRect();
      const style = getComputedStyle(media);
      const scale = Math.max(
        rootRect.width / media.videoWidth,
        rootRect.height / media.videoHeight
      );
      return {
        viewport: { width: innerWidth, height: innerHeight },
        root: {
          left: rootRect.left,
          top: rootRect.top,
          right: rootRect.right,
          bottom: rootRect.bottom,
          width: rootRect.width,
          height: rootRect.height
        },
        video: {
          left: videoRect.left,
          top: videoRect.top,
          right: videoRect.right,
          bottom: videoRect.bottom,
          objectFit: style.objectFit,
          fittedWidth: media.videoWidth * scale,
          fittedHeight: media.videoHeight * scale
        }
      };
    });

    expect(geometry.root.left, `${viewport.name}: root left edge`).toBeLessThanOrEqual(0);
    expect(geometry.root.top, `${viewport.name}: root top edge`).toBeLessThanOrEqual(0);
    expect(geometry.root.right, `${viewport.name}: root right edge`).toBeGreaterThanOrEqual(geometry.viewport.width);
    expect(geometry.root.bottom, `${viewport.name}: root bottom edge`).toBeGreaterThanOrEqual(geometry.viewport.height);
    expect(geometry.root.width, `${viewport.name}: root width`).toBe(geometry.viewport.width);
    expect(geometry.root.height, `${viewport.name}: root height`).toBe(geometry.viewport.height);
    expect(geometry.video.left, `${viewport.name}: video left edge`).toBeLessThan(0);
    expect(geometry.video.top, `${viewport.name}: video top edge`).toBeLessThan(0);
    expect(geometry.video.right, `${viewport.name}: video right edge`).toBeGreaterThan(geometry.viewport.width);
    expect(geometry.video.bottom, `${viewport.name}: video bottom edge`).toBeGreaterThan(geometry.viewport.height);
    expect(geometry.video.objectFit, `${viewport.name}: video fit`).toBe("cover");
    expect(geometry.video.fittedWidth, `${viewport.name}: painted video width`).toBeGreaterThanOrEqual(geometry.root.width);
    expect(geometry.video.fittedHeight, `${viewport.name}: painted video height`).toBeGreaterThanOrEqual(geometry.root.height);
  }
});

test("Skip reaches the menu immediately and repeat launches stay at 1x", async ({ page, browserName }) => {
  test.setTimeout(90_000);
  await page.goto("/play/");
  const cinematic = page.locator(".first-open-cinematic");
  await expect(cinematic).toBeVisible();
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expect(cinematic).toHaveCount(0);
  await expect(page.locator("#startScreen")).toBeVisible();

  await page.evaluate(async () => {
    const { createFirstOpenCinematic } = await import("/cinematic/first-open-cinematic.mjs");
    const repeatCinematic = createFirstOpenCinematic({
      storageKey: "constellore-first-open-cinematic-v1"
    });
    window.__repeatCinematicOutcome = repeatCinematic.playLaunch({ force: true });
  });
  const repeat = page.locator(".first-open-cinematic");
  await expect(repeat).toBeVisible();
  const repeatLayout = await repeat.getAttribute("data-video-layout");
  const repeatBrandCue = repeatLayout === "phone" ? 15.25 : LANDSCAPE_BRAND_RATE_CUE_SECONDS;
  await expect(repeat).toHaveAttribute("data-repeat", "true");
  await expect(repeat).toHaveAttribute("data-playback-rate", "1");
  await expect(repeat).toHaveAttribute("data-brand-playback-rate", "1");
  await expect(repeat).toHaveAttribute("data-segment", "brand");
  const repeatVideo = repeat.locator("video");
  await expect(repeatVideo).toHaveJSProperty("playbackRate", 1);
  if (browserName === "webkit") {
    // The synthetic forced replay is not backed by durable user activation in
    // headless WebKit. Its 1x contract is still verified above; initial
    // automatic playback and the real Skip flow remain covered in this engine.
    return;
  }
  await ensureAutomaticPlayback(repeat);
  await expect.poll(() => repeatVideo.evaluate((element) => element.duration))
    .toBeGreaterThan(repeatLayout === "phone" ? 18 : 24);
  await expect.poll(
    () => repeatVideo.evaluate((element) => element.currentTime),
    { timeout: 30_000 }
  ).toBeGreaterThan(repeatBrandCue);
  await expect(repeat).toHaveAttribute("data-segment", "launch");
  await expect(repeatVideo).toHaveJSProperty("playbackRate", 1);
  await expect(repeat).toHaveCount(0, { timeout: 18_000 });
  await expect(page.locator("#startScreen")).toBeVisible();
});

test("blocked sound autoplay immediately continues muted without a click", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium covers the browser audio-permission fallback.");
  await page.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    let blockOneUnmutedAttempt = true;
    HTMLMediaElement.prototype.play = function patchedPlay() {
      if (blockOneUnmutedAttempt && !this.muted) {
        blockOneUnmutedAttempt = false;
        return Promise.reject(new DOMException("User gesture required", "NotAllowedError"));
      }
      return nativePlay.call(this);
    };
  });
  await page.goto("/play/");

  const cinematic = page.locator(".first-open-cinematic");
  const video = cinematic.locator("video");
  await expect(cinematic).toHaveAttribute("data-phase", "playing", { timeout: 12_000 });
  await expect(video).toHaveJSProperty("muted", true);
  await expect(video).toHaveJSProperty("paused", false);
  await expect.poll(() => video.evaluate((element) => element.currentTime)).toBeGreaterThan(0);
  await expect(cinematic.locator(".first-open-cinematic__sound")).toHaveText("Sound off");
  await expect(cinematic.locator(".first-open-cinematic__sound-gate")).toHaveCount(0);
  await expect(cinematic.getByText("Begin with sound", { exact: true })).toHaveCount(0);

  await cinematic.locator(".first-open-cinematic__sound").click();
  await expect(video).toHaveJSProperty("muted", false);
  await expect(cinematic.locator(".first-open-cinematic__sound")).toHaveText("Sound on");
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expect(cinematic).toHaveCount(0);
  await expect(page.locator("#startScreen")).toBeVisible();
});

test("reduced motion bypasses the moving intro and opens the menu", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/");
  await expect(page.locator(".first-open-cinematic")).toHaveCount(0);
  await expect(page.locator("#cosmicGate")).toBeHidden();
  await expect(page.locator("#startScreen")).toBeVisible();
  await expect(page.locator("#gameScreen")).toBeHidden();
});
