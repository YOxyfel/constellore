import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

async function installCompletedPlayer(page, frameSlug = "ember-sovereign") {
  await page.addInitScript((selectedFrame) => {
    const profile = {
      version: 10,
      wins: 3,
      routeRank: { rank: "silver", challengeRank: "silver" },
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true }
    };
    localStorage.setItem("constellore-profile-v1", JSON.stringify(profile));
    localStorage.setItem("constellore-local-profile-v1", JSON.stringify(profile));
    localStorage.setItem("constellore-profile-frame-v1", selectedFrame);
    localStorage.setItem("constellore-birthday-voyage-complete-v1", "2026-01-01T00:00:00.000Z");
  }, frameSlug);
  await installSeenIntroFixture(page);
}

async function createPrivatePair({ browser, host, guestViewport, format = "" }) {
  await installCompletedPlayer(host, "ember-sovereign");
  const guestContext = await browser.newContext({
    viewport: guestViewport,
    serviceWorkers: "block"
  });
  const guest = await guestContext.newPage();
  await installCompletedPlayer(guest, "berry-burrow");

  await host.goto("/play/?birthday=off");
  await expect(host.locator("body")).toHaveAttribute("data-home-stage", "core");
  await host.locator("#homeOrbitTabArena").click();
  await expect(host.locator("#homePlaySplit")).toHaveAttribute("data-home-orbit-active", "arena");
  const entry = host.locator("#scrambleHomeButton");
  await expect(entry).toBeVisible();
  await expect(entry).toBeEnabled();
  await entry.click();

  const hostDialog = host.locator("#scrambleDialog");
  await expect(hostDialog).toHaveJSProperty("open", true);
  if (format) {
    const option = host.locator(`input[name="scrambleFormat"][value="${format}"]`);
    await expect(option).toBeEnabled();
    await option.check();
  }
  await host.locator("#scrambleCreateInvite").click();
  const invite = host.locator("#scrambleInviteLink");
  await expect(invite).toHaveValue(/#scramble=[a-z0-9._~-]+/i);
  const inviteUrl = await invite.inputValue();

  await guest.goto(inviteUrl);
  await expect(guest.locator("#scrambleDialog")).toHaveJSProperty("open", true);
  await expect(host.locator("#scrambleReady")).toBeVisible();
  await expect(guest.locator("#scrambleReady")).toBeVisible();
  await expect(host.locator("#scrambleLobbySelfCard [data-arena-duel-card]"))
    .toHaveAttribute("data-frame", "ember-sovereign");
  await expect(host.locator("#scrambleLobbyRivalCard [data-arena-duel-card]"))
    .toHaveAttribute("data-frame", "berry-burrow");
  await expect(guest.locator("#scrambleLobbySelfCard [data-arena-duel-card]"))
    .toHaveAttribute("data-frame", "berry-burrow");
  await expect(guest.locator("#scrambleLobbyRivalCard [data-arena-duel-card]"))
    .toHaveAttribute("data-frame", "ember-sovereign");

  return { guest, guestContext };
}

async function openLobby(page) {
  await installCompletedPlayer(page);
  await page.goto("/play/?birthday=off");
  await expect(page.locator("body")).toHaveAttribute("data-home-stage", "core");
  await page.locator("#homeOrbitTabArena").click();
  await expect(page.locator("#homePlaySplit")).toHaveAttribute("data-home-orbit-active", "arena");
  const entry = page.locator("#scrambleHomeButton");
  await expect(entry).toBeVisible();
  await expect(entry).toBeEnabled();
  await entry.click();
  await expect(page.locator("#scrambleDialog")).toHaveJSProperty("open", true);
}

async function readyBoth(host, guest, {
  hostFrame = "ember-sovereign",
  guestFrame = "berry-burrow"
} = {}) {
  await host.locator("#scrambleReady").click();
  await guest.locator("#scrambleReady").click();

  await expect(guest.locator("#scrambleCountdown")).toBeVisible({ timeout: 5_000 });
  await expect(guest.locator("#scrambleCountdownValue")).toHaveText(/^[123]$/);
  await expect(host.locator("#scrambleCountdownSelfCard [data-arena-duel-card]"))
    .toHaveAttribute("data-frame", hostFrame);
  await expect(guest.locator("#scrambleCountdownSelfCard [data-arena-duel-card]"))
    .toHaveAttribute("data-frame", guestFrame);
  await expect(host.locator("#scrambleScorebar")).toBeVisible();
  await expect(guest.locator("#scrambleScorebar")).toBeVisible();
  await expect(guest.locator("#scrambleCountdown")).toBeHidden({ timeout: 10_000 });
  await expect(guest.locator("#scrambleConnection")).toHaveText("LIVE");
  await expect(host.locator("#scrambleScorebar"))
    .toHaveAttribute("data-self-arena-frame", hostFrame);
  await expect(host.locator("#scrambleScorebar"))
    .toHaveAttribute("data-rival-arena-frame", guestFrame);
  await expect(host.locator("#scrambleScorebar [data-arena-duel-card]")).toHaveCount(0);
}

async function expectNoHorizontalOverflow(page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  }));
  expect(layout.content).toBeLessThanOrEqual(layout.viewport + 1);
}

test("short-landscape Arena setup keeps one contextual match choice in its initial view", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Compact setup geometry is covered once in Chromium.");
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto("/healthz");
  await page.setContent(`
    <main id="gameScreen">
      <div class="game-layout">
        <section id="board"></section>
        <aside class="inventory"></aside>
      </div>
    </main>
  `);
  await page.addStyleTag({ url: "/play/scramble.css?v=compact-lobby-e2e" });
  await page.evaluate(async () => {
    const { createScrambleRuntime } = await import("/play/scramble-runtime.mjs?v=compact-lobby-e2e");
    window.__compactArenaRuntime = createScrambleRuntime({
      documentRef: document,
      windowRef: window,
      request: async () => ({}),
      available: true
    });
    await window.__compactArenaRuntime.open({ ranked: true });
  });
  await expect(page.locator("#scrambleDialog")).toHaveJSProperty("open", true);

  const dialog = page.locator("#scrambleDialog");
  const privateTab = page.locator("#scrambleQueuePrivate");
  const rankedTab = page.locator("#scrambleQueueRanked");
  await expect(privateTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#scramblePrivateCard")).toBeVisible();
  await expect(page.locator("#scrambleRankedCard")).toBeHidden();

  const initial = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const visibleControls = [...element.querySelectorAll("button:not([hidden])")]
      .filter((control) => {
        const style = getComputedStyle(control);
        const rect = control.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((control) => {
        const rect = control.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          contained: rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
            && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1
        };
      });
    return {
      horizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      verticalOverflow: element.scrollHeight > element.clientHeight + 1,
      visibleControls
    };
  });
  expect(initial.horizontalOverflow).toBe(false);
  expect(initial.verticalOverflow).toBe(false);
  expect(initial.visibleControls.every(({ width, height, contained }) => width >= 44 && height >= 44 && contained)).toBe(true);

  await rankedTab.click();
  await expect(rankedTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#scramblePrivateCard")).toBeHidden();
  await expect(page.locator("#scrambleRankedCard")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("desktop private Scramble reaches a live two-board race", async ({ browser, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Desktop geometry is covered by the desktop project.");
  await page.setViewportSize({ width: 1440, height: 900 });
  const { guest, guestContext } = await createPrivatePair({
    browser,
    host: page,
    guestViewport: { width: 1440, height: 900 }
  });

  try {
    await readyBoth(page, guest);
    const ownBoard = page.locator("#board");
    const rivalBoard = page.locator("#scrambleRivalBoard");
    await expect(ownBoard).toBeVisible();
    await expect(rivalBoard).toBeVisible();

    const geometry = await page.locator("#gameScreen .game-layout").evaluate((layout) => {
      const own = layout.querySelector("#board").getBoundingClientRect();
      const rival = layout.querySelector("#scrambleRivalBoard").getBoundingClientRect();
      return {
        own: { left: own.left, right: own.right, width: own.width, height: own.height },
        rival: { left: rival.left, right: rival.right, width: rival.width, height: rival.height }
      };
    });
    expect(geometry.own.width).toBeGreaterThan(0);
    expect(geometry.own.height).toBeGreaterThan(0);
    expect(geometry.rival.width).toBeGreaterThan(0);
    expect(geometry.rival.height).toBeGreaterThan(0);
    expect(geometry.own.right).toBeLessThanOrEqual(geometry.rival.left + 2);
    await expectNoHorizontalOverflow(page);
  } finally {
    await guestContext.close();
  }
});

test("Arena frames stay intact from the versus reveal through the winner card", async ({ browser, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The complete Duel Card ceremony is covered once on desktop.");
  await page.setViewportSize({ width: 1440, height: 900 });
  const { guest, guestContext } = await createPrivatePair({
    browser,
    host: page,
    guestViewport: { width: 1200, height: 820 }
  });

  try {
    const geometry = await page.locator("#scrambleLobbySelfCard [data-arena-duel-card]").evaluate((card) => {
      const artboard = card.querySelector("[data-arena-duel-card-artboard]").getBoundingClientRect();
      const art = card.querySelector("[data-arena-duel-card-art]").getBoundingClientRect();
      const meta = card.querySelector(".arena-duel-card__meta").getBoundingClientRect();
      return {
        artboardRatio: artboard.width / artboard.height,
        artMatchesArtboard: Math.abs(art.width - artboard.width) <= 1
          && Math.abs(art.height - artboard.height) <= 1,
        metadataClearsArtwork: meta.top >= artboard.bottom - 1
      };
    });
    expect(geometry.artboardRatio).toBeCloseTo(0.75, 2);
    expect(geometry.artMatchesArtboard).toBe(true);
    expect(geometry.metadataClearsArtwork).toBe(true);

    await readyBoth(page, guest);
    await page.keyboard.press("Escape");
    await expect(page.locator("#scrambleForfeitDialog")).toHaveJSProperty("open", true);
    await page.locator("#scrambleConfirmForfeit").click();
    await expect(page.locator("#scrambleResultDialog")).toHaveJSProperty("open", true);
    await expect(page.locator("#scrambleResultFeaturedCard [data-arena-duel-card]"))
      .toHaveAttribute("data-frame", "berry-burrow");
    await expect(page.locator("#scrambleResultFeaturedCard [data-arena-duel-card]"))
      .toHaveAttribute("data-side", "rival");
    await expect(page.locator("#scrambleResultFeaturedCard [data-arena-duel-card-status]"))
      .toHaveText("Winner");
  } finally {
    await guestContext.close();
  }
});

test("short landscape keeps the versus and winner cards in the initial dialog view", async ({ browser, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The rotated-phone geometry is covered once in Chromium.");
  await page.setViewportSize({ width: 844, height: 390 });
  const { guest, guestContext } = await createPrivatePair({
    browser,
    host: page,
    guestViewport: { width: 844, height: 390 }
  });

  const expectCardInInitialView = async (dialogSelector, cardSelector) => {
    const geometry = await page.locator(dialogSelector).evaluate((dialog, selector) => {
      const card = document.querySelector(selector);
      const dialogRect = dialog.getBoundingClientRect();
      const cardRect = card?.getBoundingClientRect();
      return {
        intersects: Boolean(cardRect)
          && cardRect.top < dialogRect.bottom
          && cardRect.bottom > dialogRect.top,
        cardTop: cardRect?.top ?? 0,
        dialogBottom: dialogRect.bottom,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      };
    }, cardSelector);
    expect(geometry.intersects).toBe(true);
    expect(geometry.cardTop).toBeLessThan(geometry.dialogBottom);
    expect(geometry.horizontalOverflow).toBe(false);
  };

  try {
    await expectCardInInitialView("#scrambleDialog", "#scrambleLobbySelfCard [data-arena-duel-card]");
    await readyBoth(page, guest);
    await page.keyboard.press("Escape");
    await expect(page.locator("#scrambleForfeitDialog")).toHaveJSProperty("open", true);
    await page.locator("#scrambleConfirmForfeit").click();
    await expect(page.locator("#scrambleResultDialog")).toHaveJSProperty("open", true);
    await expectCardInInitialView("#scrambleResultDialog", "#scrambleResultFeaturedCard [data-arena-duel-card]");
  } finally {
    await guestContext.close();
  }
});

test("phone private Scramble uses the rival ticker and board toggle without overflow", async ({ browser, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile", "Phone behavior is covered by the mobile project.");
  await page.setViewportSize({ width: 390, height: 844 });
  const { guest, guestContext } = await createPrivatePair({
    browser,
    host: page,
    guestViewport: { width: 1000, height: 800 }
  });

  try {
    await readyBoth(page, guest);
    const ticker = page.locator("#scrambleRivalTicker");
    const ownBoard = page.locator("#board");
    const rivalBoard = page.locator("#scrambleRivalBoard");
    const selfToggle = page.locator('[data-scramble-view="self"]');
    const rivalToggle = page.locator('[data-scramble-view="rival"]');

    await expect(ticker).toBeVisible();
    await expect(selfToggle).toBeVisible();
    await expect(rivalToggle).toBeVisible();
    await expect(selfToggle).toHaveAttribute("aria-pressed", "true");
    await expect(ownBoard).toBeVisible();
    await expect(rivalBoard).toBeHidden();

    await rivalToggle.click();
    await expect(rivalToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("body")).toHaveClass(/scramble-view-rival/);
    await expect(rivalBoard).toBeVisible();
    await expect(ownBoard).toBeHidden();
    await expectNoHorizontalOverflow(page);

    await selfToggle.click();
    await expect(selfToggle).toHaveAttribute("aria-pressed", "true");
    await expect(ownBoard).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    await guestContext.close();
  }
});

test("Riddle Saga exposes five spoiler-safe chapters, live scores, and the +2 finale on desktop and phone", async ({ browser, page }, testInfo) => {
  const phone = testInfo.project.name === "chromium-mobile";
  test.skip(!phone && testInfo.project.name !== "chromium-desktop", "Saga geometry is covered on desktop and phone.");
  const viewport = phone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  const { guest, guestContext } = await createPrivatePair({
    browser,
    host: page,
    guestViewport: phone ? { width: 1000, height: 800 } : viewport,
    format: "riddle-saga"
  });

  try {
    await expect(page.locator('input[value="riddle-saga"]')).toBeChecked();
    await expect(page.locator("#scrambleWaitingCopy")).toContainText(/final riddle is worth two/i);
    await readyBoth(page, guest);

    const track = page.locator("#scrambleSagaTrack");
    await expect(track).toBeVisible();
    await expect(page.locator("#scrambleSagaChapters > li")).toHaveCount(5);
    await expect(page.locator("#scrambleSagaChapters > li").last()).toContainText("+2");
    await expect(page.locator("#scrambleSagaTitle")).not.toHaveText("");
    await expect(page.locator("#scrambleSagaStory")).not.toHaveText("");
    await expect(page.locator("#scrambleSagaTarget")).not.toHaveText(/^(?:|Hidden)$/);
    await expect(page.locator("#scrambleSagaSelfScore")).toHaveText("0");
    await expect(page.locator("#scrambleSagaRivalScore")).toHaveText("0");
    await expect(page.locator("#scrambleSagaValue")).toContainText("+1");
    await expectNoHorizontalOverflow(page);

    const geometry = await track.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.top).toBeGreaterThanOrEqual(-1);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  } finally {
    await guestContext.close();
  }
});

test("Riddle Saga resyncs exactly once when an intermission boundary arrives", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The boundary scheduler needs one browser contract.");
  await page.goto("/healthz");
  await page.setContent(`
    <main id="gameScreen">
      <div class="game-layout">
        <section id="board"></section>
        <aside class="inventory"></aside>
      </div>
    </main>
  `);
  const result = await page.evaluate(async () => {
    const { createScrambleRuntime } = await import("/play/scramble-runtime.mjs?v=saga-boundary-e2e");
    const exactSnapshots = [];
    const matchId = "saga-boundary-12345678";
    const request = async (path) => {
      if (path === `/${matchId}`) exactSnapshots.push(performance.now());
      return {};
    };
    const runtime = createScrambleRuntime({
      documentRef: document,
      windowRef: window,
      request,
      available: true,
      onBeginMatch() {}
    });
    await runtime.open({ format: "riddle-saga", ranked: true });
    runtime.acceptPayload({
      duel: {
        id: matchId,
        format: "riddle-saga",
        status: "active",
        selfSlot: "slot-a",
        players: [{ slot: "slot-a", callsign: "YOU" }, { slot: "slot-b", callsign: "NOVA" }],
        boards: [{ slot: "slot-a", words: [] }, { slot: "slot-b", words: [] }],
        saga: {
          version: 1,
          revision: 4,
          status: "intermission",
          arcTitle: "Roots to Stars",
          chapterCount: 5,
          chapterNumber: 1,
          chapterIndex: 0,
          chapterPoints: 1,
          currentChapter: null,
          settledChapters: [{
            number: 1,
            title: "The Sleeping Green",
            target: "Forest",
            chapterPoints: 1,
            status: "timeout"
          }],
          scores: [
            { slot: "slot-a", points: 0, score: 0, chaptersWon: 0 },
            { slot: "slot-b", points: 0, score: 0, chaptersWon: 0 }
          ],
          nextChapterAt: new Date(Date.now() + 120).toISOString()
        }
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 900));
    const momentVisible = !document.querySelector("#scrambleSagaMoment")?.hidden;
    runtime.destroy();
    return { count: exactSnapshots.length, momentVisible };
  });
  expect(result).toEqual({ count: 1, momentVisible: true });
});

test("public matchmaking pairs two eligible players into the same ranked countdown", async ({ browser, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The ranked browser contract is covered once on desktop.");
  const guestContext = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    serviceWorkers: "block"
  });
  const guest = await guestContext.newPage();

  try {
    await Promise.all([openLobby(page), openLobby(guest)]);
    await expect(page.locator("#scrambleFindRival")).toBeEnabled();
    await expect(guest.locator("#scrambleFindRival")).toBeEnabled();
    await page.locator("#scrambleFindRival").click();
    await expect(page.locator("#scrambleWaitingTitle")).toContainText(/Searching|rival/i);
    await guest.locator("#scrambleFindRival").click();

    await expect(page.locator("#scrambleReady")).toBeVisible({ timeout: 10_000 });
    await expect(guest.locator("#scrambleReady")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#scrambleWaitingKicker")).toHaveText("PUBLIC RANKED");
    await expect(guest.locator("#scrambleWaitingKicker")).toHaveText("PUBLIC RANKED");
    await readyBoth(page, guest, { guestFrame: "ember-sovereign" });
    await expect(page.locator("#scrambleScorebar")).toBeVisible();
  } finally {
    await guestContext.close();
  }
});
