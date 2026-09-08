import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const viewports = [
  { name: "wide desktop", width: 1440, height: 900 },
  { name: "compact desktop", width: 835, height: 677 },
  { name: "near-square tablet", width: 655, height: 610 },
  { name: "portrait tablet", width: 797, height: 1265 },
  { name: "short landscape goal", width: 758, height: 414 },
  { name: "narrow mobile", width: 320, height: 568 }
];

async function expectNoHorizontalOverflow(page, context) {
  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));

  expect(
    Math.max(layout.documentWidth, layout.bodyWidth),
    `${context}: content must remain inside the ${layout.viewportWidth}px viewport`
  ).toBeLessThanOrEqual(layout.viewportWidth + 1);
}

async function expectControlsRemainInsideViewport(page, selectors, context) {
  const layout = await page.locator(selectors.join(", ")).evaluateAll((elements) => {
    const viewportWidth = document.documentElement.clientWidth;
    return elements.flatMap((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) {
        return [];
      }
      return [{
        label: element.id || element.className || element.tagName,
        left: rect.left,
        right: rect.right,
        viewportWidth
      }];
    });
  });

  expect(layout.length, `${context}: expected at least one visible control`).toBeGreaterThan(0);
  for (const item of layout) {
    expect(item.left, `${context}: ${item.label} starts outside the viewport`).toBeGreaterThanOrEqual(-1);
    expect(item.right, `${context}: ${item.label} ends outside the viewport`).toBeLessThanOrEqual(item.viewportWidth + 1);
  }
}

async function atlasSurfaceDetails(page) {
  return page.locator("body").evaluate((body) => {
    const normalizeColor = (color) => {
      const swatch = document.createElement("span");
      swatch.style.color = color;
      document.body.append(swatch);
      const normalized = getComputedStyle(swatch).color;
      swatch.remove();
      return normalized;
    };
    const channels = (color) => (color.match(/\d+(?:\.\d+)?/g) || [])
      .slice(0, 3)
      .map(Number);
    const bodyStyle = getComputedStyle(document.body);
    const primary = document.querySelector("#primaryOrbitButton");
    const primaryStyle = getComputedStyle(primary);
    const start = document.querySelector(".start-screen");
    const backgroundLayers = [
      getComputedStyle(start).backgroundImage,
      getComputedStyle(start, "::before").backgroundImage,
      getComputedStyle(start, "::after").backgroundImage
    ];
    const tokens = Object.fromEntries(
      ["--atlas-deep", "--atlas-teal", "--atlas-gold", "--atlas-ivory"]
        .map((name) => [name, bodyStyle.getPropertyValue(name).trim()])
    );

    return {
      tokens,
      tokenColors: Object.fromEntries(
        Object.entries(tokens).map(([name, value]) => [name, normalizeColor(value)])
      ),
      tokenChannels: Object.fromEntries(
        Object.entries(tokens).map(([name, value]) => [name, channels(normalizeColor(value))])
      ),
      backgroundLayers,
      primaryBackgroundColor: primaryStyle.backgroundColor,
      primaryBackgroundImage: primaryStyle.backgroundImage,
      primaryBoxShadow: primaryStyle.boxShadow,
      primaryColor: primaryStyle.color,
      legacyViolet: normalizeColor("#aa8cff"),
      primaryIsTopmost: (() => {
        const rect = primary.getBoundingClientRect();
        const topmost = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return Boolean(topmost && (topmost === primary || primary.contains(topmost)));
      })()
    };
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  const freshFirstOrbit = testInfo.title.includes("unfinished first constellation");
  const profile = {
    version: 7,
    wins: 0,
    firstOrbit: { seen: true, completed: true },
    secondOrbit: { seen: true, completed: true }
  };
  const localStorageEntries = freshFirstOrbit
    ? []
    : [
        ["constellore-profile-v1", JSON.stringify(profile)],
        ["constellore-local-profile-v1", JSON.stringify(profile)]
      ];
  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries,
    launchToMenu: freshFirstOrbit
  });
});

for (const viewport of viewports) {
  test(`simple UI surfaces stay clean at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/play/");
    await expect(page.locator("#cosmicGate")).toBeHidden();

    const primaryOrbit = page.locator(".primary-orbit-panel");
    const primaryButton = page.locator("#primaryOrbitButton");
    await expect(primaryOrbit).toBeVisible();
    await expect(primaryButton).toBeVisible();
    await primaryButton.scrollIntoViewIfNeeded();

    const artUrl = await page.evaluate(() => new URL("art/home/home-cosmos-v1-portrait.webp", window.location.href).href);
    const art = await page.request.get(artUrl);
    expect(art.ok(), "the cinematic home background must be served by the playable build").toBe(true);
    expect(art.headers()["content-type"]).toContain("image/webp");
    expect((await art.body()).byteLength, "the home art must not regress to an empty placeholder").toBeGreaterThan(50_000);

    const surface = await atlasSurfaceDetails(page);
    for (const [name, token] of Object.entries(surface.tokens)) {
      expect(token, `the living-atlas theme must define ${name}`).not.toBe("");
      expect(surface.tokenChannels[name], `${name} must resolve to a real color`).toHaveLength(3);
    }
    expect(
      surface.backgroundLayers.some((layer) => layer.includes("home-cosmos-v1-")),
      "the home scene must actually use the responsive cinematic artwork"
    ).toBe(true);
    expect(surface.primaryBackgroundImage, "the main action should retain its crafted gold surface").toContain("gradient");
    expect(surface.primaryBoxShadow, "the main action should retain visible surface depth").not.toBe("none");
    expect(surface.primaryBackgroundColor).not.toBe("rgb(0, 0, 0)");
    expect(surface.primaryColor).not.toBe(surface.legacyViolet);
    expect(surface.primaryIsTopmost, "decoration must never cover the main action").toBe(true);
    await expect(page.locator(".home-vfx")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("#primaryOrbitSecondary")).toBeHidden();

    const gold = surface.tokenChannels["--atlas-gold"];
    const teal = surface.tokenChannels["--atlas-teal"];
    const deep = surface.tokenChannels["--atlas-deep"];
    expect(
      gold[0] > gold[1] && gold[1] > gold[2],
      `expected a restrained warm-gold action color, received ${surface.tokenColors["--atlas-gold"]}`
    ).toBe(true);
    expect(
      teal[1] > teal[2] && teal[2] > teal[0],
      `expected a teal route/focus color, received ${surface.tokenColors["--atlas-teal"]}`
    ).toBe(true);
    expect(
      deep[2] > deep[1] && deep[1] > deep[0],
      `expected an ink-blue foundation, received ${surface.tokenColors["--atlas-deep"]}`
    ).toBe(true);

    await expectNoHorizontalOverflow(page, `${viewport.name} home`);
    await expectControlsRemainInsideViewport(
      page,
      [".start-nav", ".start-content", ".primary-orbit-panel", "#primaryOrbitButton"],
      `${viewport.name} home`
    );

    // The catalog itself should communicate progression: Bronze sees the core
    // action, Silver adds Explore, and Gold opens games plus Adventures.
    await expect(page.locator("#modePicker")).toBeHidden();
    await expect(page.locator("#exploreHub")).toBeHidden();
    await expect(page.locator("#adventuresHub")).toBeHidden();

    const exploreHub = page.locator("#exploreHub");
    await page.locator("body").evaluate((body) => {
      body.classList.remove("first-session", "choices-ready", "adventures-ready", "advanced-ready");
      body.classList.add("explore-ready");
    });
    await page.evaluate(async () => {
      const { syncHomeOrbitView } = await import("/home-menu-view.mjs?v=5.0.0-beta.1");
      syncHomeOrbitView({
        forgeAvailable: true,
        journeyAvailable: true,
        arenaAvailable: true,
        catalogAvailable: true
      }, document);
    });
    await page.locator("#homeForgeCatalogToggle").click();
    await expect(page.locator("#homeForgeCatalog")).toBeVisible();
    await expect(exploreHub).toBeVisible();
    await expect(page.locator("#modePicker")).toBeHidden();
    await expect(page.locator("#adventuresHub")).toBeHidden();

    const cardLayout = await exploreHub.evaluate((hub) => {
      const cards = hub.querySelectorAll(".explore-card");
      const card = cards[1];
      const content = card.querySelector(":scope > div");
      const heading = content.querySelector("strong");
      const headingStyle = getComputedStyle(heading);
      return {
        copy: content.textContent,
        cardWidth: card.getBoundingClientRect().width,
        contentWidth: content.getBoundingClientRect().width,
        contentClientWidth: content.clientWidth,
        contentScrollWidth: content.scrollWidth,
        headingHeight: heading.getBoundingClientRect().height,
        headingLineHeight: Number.parseFloat(headingStyle.lineHeight)
      };
    });
    expect(cardLayout.copy).toContain("Play without a target");
    expect(
      cardLayout.contentWidth,
      "free-play copy must remain readable beside its atlas icon"
    ).toBeGreaterThan(cardLayout.cardWidth * 0.55);
    expect(cardLayout.contentScrollWidth).toBeLessThanOrEqual(cardLayout.contentClientWidth + 1);
    expect(cardLayout.headingHeight).toBeLessThanOrEqual(cardLayout.headingLineHeight * 2.25);
    await expectNoHorizontalOverflow(page, `${viewport.name} expanded game choices`);
    await expectControlsRemainInsideViewport(
      page,
      ["#exploreHub", ".explore-card", ".explore-card button"],
      `${viewport.name} expanded game choices`
    );

    await page.locator("body").evaluate((body) => {
      body.classList.add("choices-ready", "adventures-ready", "advanced-ready");
    });
    await expect(page.locator("#modePicker")).toBeVisible();
    await expect(page.locator("#adventuresHub")).toBeVisible();
    await expectControlsRemainInsideViewport(
      page,
      ["#modePicker", "#modePicker .mode-card", "#adventuresHub", "#adventuresHub button"],
      `${viewport.name} Gold catalogs`
    );

    await page.keyboard.press("Escape");
    await expect(page.locator("#homeForgeCatalog")).toBeHidden();

    await primaryButton.click();
    const briefing = page.locator("#missionBriefingDialog");
    await expect(briefing).toHaveJSProperty("open", true);
    const briefingCenter = await briefing.evaluate((dialog) => {
      const rect = dialog.getBoundingClientRect();
      return {
        horizontalOffset: Math.abs(rect.left + rect.width / 2 - document.documentElement.clientWidth / 2),
        verticalOffset: Math.abs(rect.top + rect.height / 2 - document.documentElement.clientHeight / 2),
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: document.documentElement.clientHeight
      };
    });
    expect(briefingCenter.horizontalOffset, "the goal prompt must stay horizontally centered").toBeLessThanOrEqual(1);
    expect(briefingCenter.verticalOffset, "the goal prompt must stay vertically centered").toBeLessThanOrEqual(1);
    expect(briefingCenter.top, "the goal prompt must stay within the viewport top").toBeGreaterThanOrEqual(-1);
    expect(briefingCenter.bottom, "the goal prompt must stay within the viewport bottom").toBeLessThanOrEqual(briefingCenter.viewportHeight + 1);
    await expect(briefing.locator("#beginMission")).toBeVisible();

    const missionActions = await briefing.locator(".mission-actions").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderTopWidth: style.borderTopWidth,
        paddingTop: style.paddingTop
      };
    });
    expect(missionActions.backgroundColor, "action rows must not reintroduce a pure-black slab").not.toBe("rgb(0, 0, 0)");
    await expectNoHorizontalOverflow(page, `${viewport.name} mission briefing`);
    await expectControlsRemainInsideViewport(
      page,
      ["#missionBriefingDialog", ".mission-target-lockup", ".mission-actions", ".mission-actions button"],
      `${viewport.name} mission briefing`
    );
  });
}

test("Silver Orbit stays below the hero at the reported desktop boundary", async ({ page }) => {
  await page.setViewportSize({ width: 1430, height: 1075 });
  await page.goto("/play/");
  await expect(page.locator("body")).toHaveAttribute("data-home-stage", /.+/);
  const hero = page.locator(".hero-row");
  await expect(hero).toBeVisible();

  const layout = await page.locator(".start-content").evaluate((content) => {
    document.body.classList.remove("first-session", "choices-ready", "adventures-ready", "advanced-ready");
    document.body.classList.add("explore-ready");
    const heroRect = content.querySelector(".hero-row").getBoundingClientRect();
    const exploreHub = content.querySelector("#exploreHub");
    const exploreRect = exploreHub.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const headerRect = content.querySelector("#exploreHub .home-catalog-heading").getBoundingClientRect();
    return {
      justifyContent: getComputedStyle(content).justifyContent,
      exploreDisplay: getComputedStyle(exploreHub).display,
      modeDisplay: getComputedStyle(content.querySelector("#modePicker")).display,
      adventuresDisplay: getComputedStyle(content.querySelector("#adventuresHub")).display,
      gap: exploreRect.top - heroRect.bottom,
      contentLeft: contentRect.left,
      contentRight: contentRect.right,
      exploreLeft: exploreRect.left,
      exploreRight: exploreRect.right,
      exploreHeight: exploreRect.height,
      headerTop: headerRect.top,
      headerBottom: headerRect.bottom,
      exploreTop: exploreRect.top,
      exploreBottom: exploreRect.bottom
    };
  });
  expect(layout.justifyContent).toBe("flex-start");
  expect(layout.exploreDisplay).not.toBe("none");
  expect(layout.modeDisplay).toBe("none");
  expect(layout.adventuresDisplay).toBe("none");
  expect(layout.gap, "Silver Orbit must flow after the hero rather than overlay it").toBeGreaterThanOrEqual(12);
  expect(layout.exploreHeight, "desktop Explore should stay a compact secondary catalog").toBeLessThanOrEqual(440);
  expect(layout.exploreLeft).toBeGreaterThanOrEqual(layout.contentLeft - 1);
  expect(layout.exploreRight).toBeLessThanOrEqual(layout.contentRight + 1);
  expect(layout.headerTop).toBeGreaterThanOrEqual(layout.exploreTop - 1);
  expect(layout.headerBottom).toBeLessThanOrEqual(layout.exploreBottom + 1);
  await expectNoHorizontalOverflow(page, "1430x1075 Silver Orbit home");
});

test("an unfinished first constellation returns to a cinematic one-action home", async ({ page }) => {
  await page.setViewportSize({ width: 655, height: 610 });
  await page.goto("/play/");

  await expect(page.locator("#cosmicGate")).toBeHidden();
  await expect(page.locator("#startScreen")).toBeVisible();
  await expect(page.locator("#primaryOrbitTitle")).toHaveText("Make Mud");
  await expect(page.locator("#primaryOrbitButton")).toContainText("Start playing");
  await expect(page.locator("#primaryOrbitSecondary")).toBeHidden();
  await expect(page.locator("#modePicker")).toBeHidden();
  await expect(page.locator("#exploreHub")).toBeHidden();
  await expect(page.locator("#adventuresHub")).toBeHidden();

  await page.locator("#primaryOrbitButton").click();
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", false);
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#targetWord")).toHaveText("Mud");
  await page.locator("#skipFirstOrbit").click();

  await expect(page.locator("#startScreen")).toBeVisible();
  await expect(page.locator("#primaryOrbitTitle")).toHaveText("Return to Mud");
  await expect(page.locator("#primaryOrbitButton")).toContainText("Continue");
  await expect(page.locator("#primaryOrbitSecondary")).toBeHidden();
  await expect(page.locator("#modePicker")).toBeHidden();
  await expect(page.locator("#exploreHub")).toBeHidden();
  await expect(page.locator("#adventuresHub")).toBeHidden();
  await expect(page.locator(".home-vfx")).toHaveCSS("pointer-events", "none");

  const heroGeometry = await page.locator(".start-content").evaluate((hero) => {
    const rect = hero.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight };
  });
  expect(heroGeometry.top).toBeGreaterThanOrEqual(-1);
  expect(heroGeometry.bottom).toBeLessThanOrEqual(heroGeometry.viewportHeight + 1);

  await page.locator("#primaryOrbitButton").click();
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#targetWord")).toHaveText("Mud");
});

test("celestial decoration becomes still when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/");

  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

  const motion = await page.locator(".start-screen, .home-vfx, .home-vfx__halo, .home-vfx__meteor, .hero-forge__orbit, .primary-orbit-panel, #primaryOrbitButton")
    .evaluateAll((elements) => {
      const toMilliseconds = (part) => {
        const value = Number.parseFloat(part);
        return part.trim().endsWith("ms") ? value : value * 1000;
      };
      const maximum = (value) => Math.max(...value.split(",").map(toMilliseconds));
      return elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          label: element.id || element.className,
          animation: maximum(style.animationDuration),
          transition: maximum(style.transitionDuration)
        };
      });
    });

  for (const item of motion) {
    expect(item.animation, `${item.label} animation must be effectively still`).toBeLessThanOrEqual(1);
    expect(item.transition, `${item.label} transition must be effectively still`).toBeLessThanOrEqual(1);
  }
});

test("the one-action flow stays usable in Windows forced-colors mode", async ({ browserName, page }) => {
  test.skip(browserName !== "chromium", "Playwright forced-colors emulation is Chromium-only");

  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/play/");
  await expect(page.locator("#cosmicGate")).toBeHidden();

  expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
  const primaryButton = page.locator("#primaryOrbitButton");
  await expect(primaryButton).toBeVisible();
  await expect(primaryButton).toBeEnabled();

  const geometry = await primaryButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      width: rect.width,
      height: rect.height,
      borderStyle: style.borderStyle
    };
  });
  expect(geometry.width).toBeGreaterThanOrEqual(44);
  expect(geometry.height).toBeGreaterThanOrEqual(44);
  expect(geometry.borderStyle).not.toBe("none");

  // Playwright's actionability checks verify that the enabled control really
  // receives pointer events; this is stronger and less brittle than probing
  // one center pixel with elementFromPoint().
  await primaryButton.click();
  await expect(page.locator("#missionBriefingDialog")).toHaveJSProperty("open", true);
});

for (const viewport of [
  { name: "small phone", width: 320, height: 568 },
  { name: "short landscape", width: 758, height: 414 }
]) {
  test(`menus remain unclipped at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/play/");
    await expect(page.locator("body")).toHaveAttribute("data-home-stage", /.+/);

    const hub = page.locator("#hubMenuDialog");
    await hub.evaluate((dialog) => {
      document.body.classList.add("progress-ready", "adventures-ready", "advanced-ready");
      for (const card of dialog.querySelectorAll(".hub-menu-action:not(#installButton)")) {
        card.hidden = false;
        card.removeAttribute("data-progressive");
      }
      dialog.showModal();
    });
    await expect(hub).toBeVisible();
    await expectNoHorizontalOverflow(page, `${viewport.name} menu`);
    await expectControlsRemainInsideViewport(
      page,
      ["#hubMenuDialog", ".hub-menu-action"],
      `${viewport.name} menu`
    );
    const hubLayout = await hub.evaluate((dialog) => ({
      overflow: dialog.scrollWidth > dialog.clientWidth + 1,
      cards: [...dialog.querySelectorAll(".hub-menu-action")]
        .filter((card) => getComputedStyle(card).display !== "none")
        .map((card) => ({
          display: getComputedStyle(card).display,
          overflow: card.scrollWidth > card.clientWidth + 1 || card.scrollHeight > card.clientHeight + 1
        }))
    }));
    expect(hubLayout.overflow).toBe(false);
    expect(hubLayout.cards.length).toBeGreaterThanOrEqual(4);
    expect(hubLayout.cards.every((card) => card.display === "grid" && !card.overflow)).toBe(true);
    await hub.evaluate((dialog) => dialog.close());

    const result = page.locator("#resultDialog");
    await result.evaluate((dialog) => {
      dialog.querySelector("#resultTitle").textContent = "You made Telescope!";
      dialog.querySelector("#resultStats").textContent = "7 words found · 8 moves · 200 Run IQ";
      for (const button of dialog.querySelectorAll("#resultActions > button")) button.hidden = false;
      dialog.querySelector("#resultRetry").textContent = "Next target";
      dialog.querySelector("#resultReplay").textContent = "Try this target again";
      dialog.querySelector("#resultPrimary span").textContent = "Return home";
      dialog.showModal();
    });
    await expect(result).toBeVisible();
    await expectNoHorizontalOverflow(page, `${viewport.name} result`);
    await expectControlsRemainInsideViewport(
      page,
      ["#resultDialog", "#resultActions > button"],
      `${viewport.name} result`
    );
    const resultLayout = await result.evaluate((dialog) => ({
      overflow: dialog.scrollWidth > dialog.clientWidth + 1,
      actions: [...dialog.querySelectorAll("#resultActions > button")].map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height, overflow: button.scrollWidth > button.clientWidth + 1 };
      })
    }));
    expect(resultLayout.overflow).toBe(false);
    expect(resultLayout.actions).toHaveLength(3);
    expect(resultLayout.actions.every((button) => button.width >= 44 && button.height >= 44 && !button.overflow)).toBe(true);
  });
}
