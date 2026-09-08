import { expect, test } from "@playwright/test";

import { SCENE_PRELOAD_MEDIA } from "../scripts/cosmetic-preload-bootstrap-audit.mjs";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

async function openObservatory(page) {
  const shortcut = page.locator("#customizeButton");
  if (await shortcut.isVisible()) {
    await shortcut.click();
    return;
  }
  await page.locator("#hubMenuButton").click();
  await expect(page.locator("#hubMenuDialog")).toHaveJSProperty("open", true);
  await page.locator("#openObservatory").click();
}

async function prepareCosmetics(page, { width = 1440, height = 900 } = {}) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.removeItem("constellore-active-run-v1");
    localStorage.removeItem("constellore-local-active-run-v1");
    const profile = {
      version: 8,
      wins: 1,
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true }
    };
    localStorage.setItem("constellore-profile-v1", JSON.stringify(profile));
    localStorage.setItem("constellore-local-profile-v1", JSON.stringify(profile));
  });
  await installSeenIntroFixture(page);
  await page.goto("/play/");
  await openObservatory(page);
  const observatory = page.locator(".cosmetics-observatory");
  await expect(observatory).toHaveJSProperty("open", true);
  return observatory;
}

async function chooseCategory(observatory, slot) {
  const category = observatory.locator(
    `.cosmetics-observatory__category-tab[data-slot="${slot}"], `
    + `.cosmetics-observatory__category-tab[data-category="${slot}"]`
  );
  await expect(category).toHaveCount(1);
  await category.click();
  await expect(category).toHaveAttribute("aria-selected", "true");
}

async function selectSlideFromEnd(observatory, stepsBack = 1) {
  const stage = observatory.locator("[data-carousel-stage]");
  await stage.press("End");
  for (let index = 0; index < stepsBack; index += 1) await stage.press("ArrowLeft");
  return stage;
}

test("Home preload media selects exactly one asset around the inclusive 6:5 boundary", async ({ page }) => {
  for (const width of [1199, 1200, 1201]) {
    await page.setViewportSize({ width, height: 1000 });
    const matches = await page.evaluate(
      (queries) => queries.map((query) => matchMedia(query).matches),
      SCENE_PRELOAD_MEDIA.home
    );

    expect(matches.filter(Boolean), `${width}×1000 must match exactly one Home preload`).toHaveLength(1);
    expect(matches[0], `${width}×1000 must preserve the narrow Home-art boundary`).toBe(width <= 1200);
  }
});

test("the full-page atelier fills compact viewports without leaking horizontal overflow", async ({ page }) => {
  const observatory = await prepareCosmetics(page, { width: 320, height: 568 });

  const layout = await observatory.evaluate((dialog) => {
    const surface = dialog.querySelector(".cosmetics-observatory__surface");
    const viewport = dialog.querySelector("[data-carousel-viewport]");
    const segment = dialog.querySelector(".cosmetics-observatory__segment");
    const checkedEffect = segment.querySelector('[role="radio"][aria-checked="true"]');
    const dialogRect = dialog.getBoundingClientRect();
    const segmentRect = segment.getBoundingClientRect();
    const checkedRect = checkedEffect.getBoundingClientRect();
    const allowedTracks = [
      dialog.querySelector(".cosmetics-observatory__category-track"),
      dialog.querySelector(".cosmetics-observatory__carousel-shelf-track")
    ].filter(Boolean);
    const buttons = [
      ...dialog.querySelectorAll(
        ".cosmetics-observatory__close, .cosmetics-observatory__segment-button, .cosmetics-observatory__carousel-arrow, .cosmetics-observatory__footer button"
      )
    ].map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    return {
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      dialogOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
      surfaceOverflow: surface.scrollWidth > surface.clientWidth + 1,
      surfaceScrollable: surface.scrollHeight > surface.clientHeight,
      fullPage: {
        x: dialogRect.x,
        y: dialogRect.y,
        width: dialogRect.width,
        height: dialogRect.height
      },
      viewportHeight: viewport.getBoundingClientRect().height,
      allowedTrackOverflow: allowedTracks.some((track) => track.scrollWidth > track.clientWidth + 1),
      segmentOverflow: segment.scrollWidth > segment.clientWidth + 1,
      checkedContained:
        checkedRect.left >= segmentRect.left
        && checkedRect.right <= segmentRect.right
        && checkedRect.top >= segmentRect.top
        && checkedRect.bottom <= segmentRect.bottom,
      buttons
    };
  });

  expect(layout.fullPage.x).toBeCloseTo(0, 0);
  expect(layout.fullPage.y).toBeCloseTo(0, 0);
  expect(layout.fullPage.width).toBeCloseTo(320, 0);
  expect(layout.fullPage.height).toBeCloseTo(568, 0);
  expect(layout.documentOverflow).toBe(false);
  expect(layout.dialogOverflow).toBe(false);
  expect(layout.surfaceOverflow).toBe(false);
  expect(layout.surfaceScrollable).toBe(true);
  expect(layout.viewportHeight).toBeGreaterThanOrEqual(210);
  expect(layout.allowedTrackOverflow).toBe(true);
  expect(layout.segmentOverflow).toBe(false);
  expect(layout.checkedContained).toBe(true);
  expect(layout.buttons.length).toBeGreaterThanOrEqual(8);
  expect(layout.buttons.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
});

test("short-landscape Lab keeps its live preview above a compact non-overlapping footer", async ({ page }) => {
  const observatory = await prepareCosmetics(page, { width: 568, height: 320 });
  const layout = await observatory.evaluate((dialog) => {
    const surface = dialog.querySelector(".cosmetics-observatory__surface");
    const preview = dialog.querySelector("[data-carousel-viewport]");
    const footer = dialog.querySelector(".cosmetics-observatory__footer");
    const category = dialog.querySelector(".cosmetics-observatory__category-strip");
    const previewRect = preview.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const categoryRect = category.getBoundingClientRect();
    const controls = [...dialog.querySelectorAll(
      ".cosmetics-observatory__close, .cosmetics-observatory__segment-button, .cosmetics-observatory__carousel-arrow, .cosmetics-observatory__footer button"
    )].filter((control) => {
      const style = getComputedStyle(control);
      return style.display !== "none" && style.visibility !== "hidden";
    }).map((control) => {
      const rect = control.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    return {
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      surfaceOverflow: surface.scrollWidth > surface.clientWidth + 1,
      surfaceScrollable: surface.scrollHeight > surface.clientHeight + 1,
      previewHeight: previewRect.height,
      previewAboveFooter: previewRect.bottom <= footerRect.top + 1,
      categoryAbovePreview: categoryRect.bottom <= previewRect.bottom,
      footerHeight: footerRect.height,
      controls
    };
  });

  expect(layout.documentOverflow).toBe(false);
  expect(layout.surfaceOverflow).toBe(false);
  expect(layout.surfaceScrollable).toBe(false);
  expect(layout.previewHeight).toBeGreaterThan(70);
  expect(layout.previewAboveFooter).toBe(true);
  expect(layout.categoryAbovePreview).toBe(true);
  expect(layout.footerHeight).toBeGreaterThanOrEqual(56);
  expect(layout.footerHeight).toBeLessThanOrEqual(64);
  expect(layout.controls.length).toBeGreaterThanOrEqual(7);
  expect(layout.controls.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
});

test("cinematic Arena frames stay layered, contained, and static in Reduced mode on compact phones", async ({ page }) => {
  const observatory = await prepareCosmetics(page, { width: 320, height: 568 });
  await chooseCategory(observatory, "profileFrames");

  const stage = observatory.locator("[data-carousel-stage]");
  const frames = [
    {
      slug: "empyrean-ascension",
      name: "Empyrean Ascension",
      islands: ["left-angel-wing", "right-angel-wing", "halo-beam"]
    },
    {
      slug: "infernal-dominion",
      name: "Infernal Dominion",
      islands: ["left-devil-wing", "right-devil-wing", "horned-crown"]
    }
  ];

  for (const frame of frames) {
    const option = observatory.locator(
      `.cosmetics-observatory__carousel-thumb[data-profile-frame-slug="${frame.slug}"]`
    );
    await option.click();
    await expect(option).toHaveAttribute("aria-selected", "true");
    await expect(stage).toHaveAttribute("aria-label", new RegExp(`${frame.name}$`, "u"));

    const livePreview = stage.locator(
      `[data-profile-frame-live-preview][data-frame="${frame.slug}"]`
    );
    const video = livePreview.locator(":scope > [data-profile-frame-preview-video]");
    const card = livePreview.locator(`:scope > [data-arena-duel-card][data-frame="${frame.slug}"]`);
    await expect(livePreview).toHaveCount(1);
    await expect(livePreview).toHaveAttribute("data-has-video", "true");
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute(
      "src",
      new RegExp(`/cinematic/profile-frame-previews/${frame.slug}[.]mp4$`, "u")
    );
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-frame-layout", "partial");
    await expect(card.locator("[data-arena-duel-card-art]")).toBeHidden();
    await expect(card.locator("[data-arena-duel-card-art]")).not.toHaveAttribute("src", /.+/u);

    const islands = card.locator("[data-arena-frame-island]");
    await expect(islands).toHaveCount(3);
    expect(await islands.evaluateAll((nodes) => nodes.map((node) => node.dataset.island).sort()))
      .toEqual([...frame.islands].sort());

    const layout = await stage.evaluate((previewStage) => {
      const live = previewStage.querySelector("[data-profile-frame-live-preview]");
      const duelCard = live?.querySelector(":scope > [data-arena-duel-card]");
      const backdrop = live?.querySelector(":scope > [data-profile-frame-preview-video]");
      const stageRect = previewStage.getBoundingClientRect();
      const cardRect = duelCard?.getBoundingClientRect();
      const documentElement = previewStage.ownerDocument.documentElement;
      const dialog = previewStage.closest(".cosmetics-observatory");
      const surface = previewStage.closest(".cosmetics-observatory__surface");
      const tolerance = 1;
      return {
        documentOverflow:
          documentElement.scrollWidth > documentElement.clientWidth + tolerance,
        dialogOverflow: dialog.scrollWidth > dialog.clientWidth + tolerance,
        surfaceOverflow: surface.scrollWidth > surface.clientWidth + tolerance,
        stageOverflow: previewStage.scrollWidth > previewStage.clientWidth + tolerance,
        cardContained: Boolean(
          cardRect
          && cardRect.left >= stageRect.left - tolerance
          && cardRect.right <= stageRect.right + tolerance
          && cardRect.top >= stageRect.top - tolerance
          && cardRect.bottom <= stageRect.bottom + tolerance
        ),
        videoDirect: backdrop?.parentElement === live,
        cardDirect: duelCard?.parentElement === live,
        videoInsideCard: Boolean(duelCard?.contains(backdrop)),
        videoBeforeCard:
          Boolean(backdrop && duelCard)
          && [...live.children].indexOf(backdrop) < [...live.children].indexOf(duelCard)
      };
    });
    expect(layout).toEqual({
      documentOverflow: false,
      dialogOverflow: false,
      surfaceOverflow: false,
      stageOverflow: false,
      cardContained: true,
      videoDirect: true,
      cardDirect: true,
      videoInsideCard: false,
      videoBeforeCard: true
    });
  }

  await observatory.getByRole("radio", { name: "Reduced" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-cosmetic-effects", "reduced");

  for (const frame of frames) {
    await observatory.locator(
      `.cosmetics-observatory__carousel-thumb[data-profile-frame-slug="${frame.slug}"]`
    ).click();
    const livePreview = stage.locator(
      `[data-profile-frame-live-preview][data-frame="${frame.slug}"]`
    );
    const card = livePreview.locator(`:scope > [data-arena-duel-card][data-frame="${frame.slug}"]`);
    await expect(livePreview).toHaveAttribute("data-has-video", "false");
    await expect(livePreview.locator("[data-profile-frame-preview-video]")).toHaveCount(0);
    await expect(card).toBeVisible();
    await expect(card.locator("[data-arena-frame-island]")).toHaveCount(3);
  }
});

test("category tabs expose the complete library with clear owned and locked states", async ({ page }) => {
  const observatory = await prepareCosmetics(page);

  const categories = observatory.getByRole("tablist", { name: "Cosmetic categories" }).getByRole("tab");
  await expect(categories).toHaveCount(9);
  await expect(observatory.locator('.cosmetics-observatory__category-tab[aria-selected="true"]'))
    .toHaveAttribute("data-category", "collections");
  await expect(observatory.locator("[data-carousel-stage]"))
    .toHaveAttribute("aria-label", "1 of 8: Celestial Atlas");
  const carouselViewport = observatory.locator("[data-carousel-viewport]");
  await expect(carouselViewport).toHaveAttribute("data-has-previous", "false");
  await expect(carouselViewport).toHaveAttribute("data-has-next", "true");
  await expect(observatory.locator(".cosmetics-observatory__carousel-peek")).toHaveCount(0);
  const collectionShelf = observatory.locator(".cosmetics-observatory__carousel-shelf-track");
  await expect(collectionShelf.getByRole("option")).toHaveCount(8);
  await expect(collectionShelf.locator('[data-owned="true"]')).toHaveCount(1);
  await expect(collectionShelf.locator('[data-owned="false"]')).toHaveCount(7);
  await expect(collectionShelf.locator("[data-ownership-icon]")).toHaveCount(8);

  const equippedCollection = collectionShelf.locator(
    '[data-collection-id="constellore.collection.celestial-atlas"]'
  );
  await expect(equippedCollection).toHaveAttribute("aria-selected", "true");
  await expect(equippedCollection).toHaveAttribute("data-equipped", "true");
  await expect(equippedCollection.locator('[data-ownership-icon="equipped"]'))
    .toHaveAttribute("aria-hidden", "true");

  const pixelCollection = collectionShelf.locator(
    '[data-collection-id="constellore.collection.pixel-frontier"]'
  );
  await pixelCollection.click();
  await expect(pixelCollection).toHaveAttribute("aria-selected", "true");
  await expect(pixelCollection).toHaveAttribute("aria-label", /Locked\. Purchase for 700 Star Credits/);
  await expect(pixelCollection.locator('[data-ownership-icon="purchase"]'))
    .toHaveAttribute("aria-hidden", "true");
  await expect(observatory.locator("[data-carousel-viewport]"))
    .toHaveAttribute("data-selected-id", "constellore.collection.pixel-frontier");
  await expect(carouselViewport).toHaveAttribute("data-has-previous", "true");
  await expect(carouselViewport).toHaveAttribute("data-has-next", "true");
  await expect(page.locator("body"))
    .toHaveAttribute("data-cosmetic-collection", "celestial-atlas");
  await expect(observatory.locator(".cosmetics-observatory__carousel-details"))
    .toHaveAttribute("data-selected-id", "constellore.collection.pixel-frontier");

  await pixelCollection.press("Home");
  await expect(equippedCollection).toHaveAttribute("aria-selected", "true");
  await expect(equippedCollection).toBeFocused();

  await chooseCategory(observatory, "trailSet");
  await expect(observatory.locator(".cosmetics-observatory__carousel-shelf-track").getByRole("option"))
    .toHaveCount(9);
  await expect(observatory.locator("[data-carousel-stage]"))
    .toHaveAttribute("aria-label", "1 of 9: Classic Thread");
  await expect(observatory.locator('[data-item-id="constellore.celestial-atlas.trail-set.classic-thread"]'))
    .toHaveAttribute("data-equipped", "true");
  await expect(observatory.getByRole("button", { name: "Piece equipped" })).toBeDisabled();

  const trailCategory = observatory.locator('.cosmetics-observatory__category-tab[data-slot="trailSet"]');
  await trailCategory.press("ArrowRight");
  await expect(observatory.locator('.cosmetics-observatory__category-tab[aria-selected="true"]'))
    .toHaveAttribute("data-category", "boardFinish");
  await expect(observatory.locator('.cosmetics-observatory__category-tab[data-slot="boardFinish"]'))
    .toBeFocused();

  const stage = observatory.locator("[data-carousel-stage]");
  await stage.press("End");
  await expect(stage).toHaveAttribute("aria-label", "8 of 8: Command Deck");
  await expect(stage).toBeFocused();
  await expect(observatory.getByText("Locked preview · nothing has been purchased.")).toBeVisible();
});

test("Effects is a contained global utility and keeps the selected decoration stable", async ({ page }) => {
  const observatory = await prepareCosmetics(page, { width: 320, height: 568 });
  const segment = observatory.locator(".cosmetics-observatory__segment");
  const effects = observatory.getByRole("radiogroup", { name: "Cosmetic effects intensity" });
  await expect(effects.getByRole("radio")).toHaveCount(3);
  const full = observatory.getByRole("radio", { name: "Full" });
  const reduced = observatory.getByRole("radio", { name: "Reduced" });
  await expect(full).toHaveAttribute("aria-checked", "true");

  const selectedBefore = await observatory.locator("[data-carousel-viewport]").getAttribute("data-selected-id");
  await full.press("ArrowRight");
  await expect(reduced).toHaveAttribute("aria-checked", "true");
  await expect(reduced).toBeFocused();
  await expect(page.locator("body")).toHaveAttribute("data-cosmetic-effects", "reduced");
  await expect(observatory.locator("[data-carousel-viewport]"))
    .toHaveAttribute("data-selected-id", selectedBefore);

  const containment = await segment.evaluate((control) => {
    const bounds = control.getBoundingClientRect();
    const selected = control.querySelector('[aria-checked="true"]').getBoundingClientRect();
    return {
      overflow: control.scrollWidth > control.clientWidth + 1,
      contained:
        selected.left >= bounds.left
        && selected.right <= bounds.right
        && selected.top >= bounds.top
        && selected.bottom <= bounds.bottom,
      insideUtilityRail: Boolean(control.closest(".cosmetics-observatory__category-utilities")),
      insideDetails: Boolean(control.closest(".cosmetics-observatory__carousel-details"))
    };
  });
  expect(containment).toEqual({
    overflow: false,
    contained: true,
    insideUtilityRail: true,
    insideDetails: false
  });

  await chooseCategory(observatory, "homeScene");
  await expect(observatory.getByRole("radio", { name: "Reduced" }))
    .toHaveAttribute("aria-checked", "true");
});

test("phone swipe changes exactly one item and rejects vertical gestures", async ({ page }) => {
  const observatory = await prepareCosmetics(page, { width: 390, height: 844 });
  await chooseCategory(observatory, "homeScene");

  const stage = observatory.locator("[data-carousel-stage]");
  const viewport = observatory.locator("[data-carousel-viewport]");
  await expect(viewport).toHaveAttribute(
    "data-selected-id",
    "constellore.celestial-atlas.home-scene.deep-sky-observatory"
  );
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box.x + box.width * .78, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .5, { steps: 5 });
  await page.mouse.up();
  await expect(viewport).toHaveAttribute(
    "data-selected-id",
    "constellore.aurora-archive.home-scene.aurora-observatory"
  );

  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .28);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .52, box.y + box.height * .8, { steps: 5 });
  await page.mouse.up();
  await expect(viewport).toHaveAttribute(
    "data-selected-id",
    "constellore.aurora-archive.home-scene.aurora-observatory"
  );
});

test("View in game freezes the real Home surface and returns to the selected slide", async ({ page }) => {
  const observatory = await prepareCosmetics(page, { width: 390, height: 844 });
  await chooseCategory(observatory, "homeScene");
  const stage = await selectSlideFromEnd(observatory);
  await expect(stage).toHaveAttribute("aria-label", "7 of 8: Reef Observatory");

  const storedBefore = await page.evaluate(() => {
    const keys = ["constellore-profile-v1", "constellore-local-profile-v1"];
    return keys.map((key) => JSON.parse(localStorage.getItem(key) || "null")?.cosmetics || null);
  });
  await observatory.getByRole("button", { name: "View in game" }).click();

  const worldPreview = page.locator("#cosmeticWorldPreview");
  await expect(observatory).toHaveJSProperty("open", false);
  await expect(worldPreview).toHaveJSProperty("open", true);
  await expect(page.locator("body")).toHaveAttribute("data-cosmetic-preview-surface", "home");
  await expect(page.locator("body")).toHaveClass(/cosmetic-home-scene--reef-observatory/);
  await expect(page.locator("#startScreen")).toHaveJSProperty("hidden", false);
  await expect(page.locator("#startScreen")).toHaveAttribute("inert", "");
  await expect(page.locator("#gameScreen")).toHaveJSProperty("hidden", true);
  await expect(page.locator("#cosmicGate")).toHaveJSProperty("hidden", true);
  await expect(page.locator("#cosmeticPreviewExit")).toBeFocused();

  const storedDuring = await page.evaluate(() => {
    const keys = ["constellore-profile-v1", "constellore-local-profile-v1"];
    return keys.map((key) => JSON.parse(localStorage.getItem(key) || "null")?.cosmetics || null);
  });
  expect(storedDuring).toEqual(storedBefore);

  await page.keyboard.press("Escape");
  await expect(worldPreview).toHaveJSProperty("open", false);
  await expect(observatory).toHaveJSProperty("open", true);
  await expect(observatory.locator("[data-carousel-stage]"))
    .toHaveAttribute("aria-label", "7 of 8: Reef Observatory");
  await expect(page.locator("body"))
    .toHaveAttribute("data-cosmetic-collection", "celestial-atlas");
  await expect(observatory.getByRole("button", { name: "View in game" })).toBeFocused();
  await expect(observatory.getByText("Locked preview · nothing has been purchased.")).toBeVisible();
});

test("piece previews route to the frozen Board, Worldweave, and Menu surfaces", async ({ page }, testInfo) => {
  const mobileProject = testInfo.project.name.includes("mobile");
  const observatory = await prepareCosmetics(page, mobileProject
    ? { width: 390, height: 844 }
    : { width: 1180, height: 820 });
  const worldPreview = page.locator("#cosmeticWorldPreview");
  const body = page.locator("body");

  const destinations = [
    {
      slot: "boardFinish",
      label: "7 of 8: Coral Storybook",
      surface: "board",
      bodyClass: "cosmetic-board-finish--coral-storybook",
      exit: "button"
    },
    {
      slot: "gateStyle",
      label: "7 of 9: Pearl Current",
      surface: "gate",
      bodyClass: "cosmetic-gate-style--pearl-current",
      exit: "escape",
      stepsBack: 2
    },
    {
      slot: "uiFinish",
      label: "7 of 8: Coral Pop UI",
      surface: "menu",
      bodyClass: "cosmetic-ui-finish--coral-pop",
      exit: "button"
    }
  ];

  for (const destination of destinations) {
    await chooseCategory(observatory, destination.slot);
    const stage = await selectSlideFromEnd(observatory, destination.stepsBack || 1);
    await expect(stage).toHaveAttribute("aria-label", destination.label);
    await observatory.getByRole("button", { name: "View in game" }).click();

    await expect(observatory).toHaveJSProperty("open", false);
    await expect(worldPreview).toHaveJSProperty("open", true);
    await expect(body).toHaveAttribute("data-cosmetic-preview-surface", destination.surface);
    await expect(body).toHaveClass(new RegExp(destination.bodyClass));
    await expect(page.locator("#cosmeticPreviewExit")).toBeFocused();

    if (destination.surface === "board") {
      await expect(page.locator("#gameScreen")).toHaveJSProperty("hidden", false);
      await expect(page.locator("#gameScreen")).toHaveAttribute("inert", "");
      await expect(page.locator("#cosmeticPreviewBoardSample")).toBeVisible();
    } else if (destination.surface === "gate") {
      await expect(page.locator("#cosmicGate")).toHaveJSProperty("hidden", false);
      await expect(page.locator("#cosmicGate")).toHaveAttribute("inert", "");
      await expect(page.locator("#cosmicGate")).toHaveAttribute("data-phase", "closed");
      await expect(page.locator("#cosmicGate")).toHaveAttribute("data-content", "hidden");
    } else {
      await expect(page.locator("#hubMenuDialog")).toHaveJSProperty("open", true);
      await expect(page.locator("#hubMenuDialog")).toHaveAttribute("inert", "");
      await expect(page.locator("#hubMenuDialog")).toBeVisible();
    }

    if (destination.exit === "escape") await page.keyboard.press("Escape");
    else await page.locator("#cosmeticPreviewExit").click();

    await expect(worldPreview).toHaveJSProperty("open", false);
    await expect(observatory).toHaveJSProperty("open", true);
    await expect(body).not.toHaveAttribute("data-cosmetic-preview-surface", destination.surface);
    await expect(observatory.getByRole("button", { name: "View in game" })).toBeFocused();
  }
});
