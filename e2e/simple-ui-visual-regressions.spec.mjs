import { expect, test } from "@playwright/test";

const viewports = [
  { name: "wide desktop", width: 1440, height: 900 },
  { name: "compact desktop", width: 835, height: 677 },
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

for (const viewport of viewports) {
  test(`simple UI surfaces stay clean at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/play/");

    const primaryOrbit = page.locator(".primary-orbit-panel");
    const primaryButton = page.locator("#primaryOrbitButton");
    await expect(primaryOrbit).toBeVisible();
    await expect(primaryButton).toBeVisible();
    await primaryButton.scrollIntoViewIfNeeded();

    const artUrl = await page.evaluate(() => new URL("art/celestial-atlas-bg-v1.webp", window.location.href).href);
    const art = await page.request.get(artUrl);
    expect(art.ok(), "the celestial-atlas background must be served by the playable build").toBe(true);
    expect(art.headers()["content-type"]).toContain("image/webp");
    expect((await art.body()).byteLength, "the atlas art must not regress to an empty placeholder").toBeGreaterThan(50_000);

    const surface = await atlasSurfaceDetails(page);
    for (const [name, token] of Object.entries(surface.tokens)) {
      expect(token, `the living-atlas theme must define ${name}`).not.toBe("");
      expect(surface.tokenChannels[name], `${name} must resolve to a real color`).toHaveLength(3);
    }
    expect(
      surface.backgroundLayers.some((layer) => layer.includes("celestial-atlas-bg-v1.webp")),
      "the home scene must actually use the celestial-atlas artwork"
    ).toBe(true);
    expect(surface.primaryBackgroundImage, "the main action should retain its crafted gold surface").toContain("gradient");
    expect(surface.primaryBoxShadow, "the main action should retain visible surface depth").not.toBe("none");
    expect(surface.primaryBackgroundColor).not.toBe("rgb(0, 0, 0)");
    expect(surface.primaryColor).not.toBe(surface.legacyViolet);
    expect(surface.primaryIsTopmost, "decoration must never cover the main action").toBe(true);

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

    // Secondary home choices are intentionally hidden during the first-play
    // tutorial. Reveal the normal returning-player home state so this test
    // exercises the reported expanded "More ways to play" layout directly.
    const exploreHub = page.locator("#exploreHub");
    const cardLayout = await exploreHub.evaluate((hub) => {
      // Keep the returning-player layout and measurement in one browser task.
      // The startup sync can otherwise restore first-session between an
      // artificial class change and a later measurement in a busy full suite.
      document.body.classList.remove("first-session");
      hub.open = true;
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

    await primaryButton.click();
    const briefing = page.locator("#missionBriefingDialog");
    await expect(briefing).toHaveJSProperty("open", true);

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

test("celestial decoration becomes still when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play/");

  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

  const motion = await page.locator(".start-screen, .start-stars, .primary-orbit-panel, #primaryOrbitButton")
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

  expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
  const primaryButton = page.locator("#primaryOrbitButton");
  await expect(primaryButton).toBeVisible();
  await expect(primaryButton).toBeEnabled();

  const geometry = await primaryButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    const topmost = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      width: rect.width,
      height: rect.height,
      borderStyle: style.borderStyle,
      topmost: Boolean(topmost && (topmost === button || button.contains(topmost)))
    };
  });
  expect(geometry.width).toBeGreaterThanOrEqual(44);
  expect(geometry.height).toBeGreaterThanOrEqual(44);
  expect(geometry.borderStyle).not.toBe("none");
  expect(geometry.topmost, "forced color adjustments must not cover the main action").toBe(true);

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
      dialog.querySelector("#resultNextOptions").hidden = false;
      for (const button of dialog.querySelectorAll("#resultActions > button")) button.hidden = false;
      dialog.querySelector("#resultRetry").textContent = "Next challenge";
      dialog.querySelector("#resultReplay").textContent = "Restart challenge";
      dialog.querySelector("#resultPrimary span").textContent = "Main menu";
      dialog.showModal();
    });
    await expect(result).toBeVisible();
    await expectNoHorizontalOverflow(page, `${viewport.name} result`);
    await expectControlsRemainInsideViewport(
      page,
      ["#resultDialog", "#resultNextOptions", "#resultActions > button"],
      `${viewport.name} result`
    );
    const resultLayout = await result.evaluate((dialog) => ({
      overflow: dialog.scrollWidth > dialog.clientWidth + 1,
      optionsOverflow: (() => {
        const options = dialog.querySelector("#resultNextOptions");
        return options.scrollWidth > options.clientWidth + 1;
      })(),
      actions: [...dialog.querySelectorAll("#resultActions > button")].map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height, overflow: button.scrollWidth > button.clientWidth + 1 };
      })
    }));
    expect(resultLayout.overflow).toBe(false);
    expect(resultLayout.optionsOverflow).toBe(false);
    expect(resultLayout.actions).toHaveLength(3);
    expect(resultLayout.actions.every((button) => button.width >= 44 && button.height >= 44 && !button.overflow)).toBe(true);
  });
}
