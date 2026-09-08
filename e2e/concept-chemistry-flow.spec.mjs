import { expect, test } from "@playwright/test";
import { installSeenIntroFixture } from "./intro-fixture.mjs";

const STARTER_WORDS = Object.freeze(["Earth", "Water", "Fire", "Air"]);

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "The approved Concept Chemistry slice is exercised on Chromium desktop and mobile."
);

test.use({ serviceWorkers: "block" });

function profileFixture(player) {
  return {
    version: 10,
    playerId: player.id,
    playerToken: player.token,
    wins: 3,
    discovered: [...STARTER_WORDS],
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
      sound: false,
      music: false,
      haptics: false,
      resultDetails: false,
      helpNudges: false,
      fusionAnimation: "reduced",
      muted: true,
      volume: 0,
      musicVolume: 0,
      sfxVolume: 0
    }
  };
}

async function installProfile(page, { adaptiveTarget = "" } = {}) {
  const registrationResponse = await page.request.post("/api/player/register");
  expect(registrationResponse.ok()).toBe(true);
  const registration = await registrationResponse.json();
  const fixture = profileFixture({
    id: registration.player.id,
    token: registration.playerToken
  });
  const seededPlayer = {
    ...registration.player,
    wins: fixture.wins,
    discovered: fixture.discovered,
    routeRank: fixture.routeRank
  };

  await page.addInitScript(({ player, forcedAdaptiveTarget }) => {
    const nativeFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (input, init = {}) => {
      const request = input instanceof Request ? input : null;
      const url = new URL(request?.url || input, location.href);
      const method = String(init.method || request?.method || "GET").toUpperCase();
      if (url.pathname === "/api/run/start" && method === "POST" && forcedAdaptiveTarget) {
        const body = JSON.parse(String(init.body || "{}"));
        return nativeFetch(input, {
          ...init,
          body: JSON.stringify({
            ...body,
            mode: "reach",
            adaptive: true,
            adaptiveTarget: forcedAdaptiveTarget
          })
        });
      }
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
  }, { player: seededPlayer, forcedAdaptiveTarget: adaptiveTarget });

  await installSeenIntroFixture(page, {
    resetStorage: true,
    localStorageEntries: [
      ["constellore-profile-v1", JSON.stringify(fixture)],
      ["constellore-local-profile-v1", JSON.stringify(fixture)],
      ["constellore-birthday-voyage-complete-v1", "2026-01-01T00:00:00.000Z"]
    ]
  });
}

function guideFrom(payload) {
  const guide = payload?.run?.conceptChemistry || payload?.conceptChemistry;
  expect(guide?.kind).toBe("concept-chemistry-guide");
  expect(guide?.strict).toBe(true);
  expect(guide?.valid).toBe(true);
  expect(guide?.complete).toBe(false);
  expect(guide?.allowedPair?.a).toBeTruthy();
  expect(guide?.allowedPair?.b).toBeTruthy();
  return guide;
}

async function waitForOrbitHomeReady(page) {
  await expect(page.locator("#homePlaySplit")).toHaveAttribute("data-home-orbit-ready", "true", { timeout: 20_000 });
  await expect(page.locator("body")).not.toHaveClass(/cosmic-intro-pending/);
}

async function startStrictManufacturingRun(page) {
  await installProfile(page, { adaptiveTarget: "Manufacturing" });
  await page.goto("/play/?birthday=off");
  await expect(page.locator("#startScreen")).toBeVisible();
  await waitForOrbitHomeReady(page);
  const startedResponse = page.waitForResponse((response) => (
    new URL(response.url()).pathname === "/api/run/start"
    && response.request().method() === "POST"
  ));
  await page.locator("#primaryOrbitButton").click();
  const response = await startedResponse;
  expect(response.status()).toBe(201);
  const started = await response.json();
  expect(started.game.target).toBe("Manufacturing");
  const guide = guideFrom(started);

  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true);
  await expect(page.locator("#missionAdaptiveNote")).toContainText("Path Guard on");
  await page.locator("#beginMission").evaluate((button) => button.click());
  await expect(briefing).toHaveJSProperty("open", false);
  await expect(page.locator("#gameScreen")).toBeVisible();
  await expect(page.locator("#lawPill")).toContainText("PATH GUARD");
  return guide;
}

async function startExplore(page) {
  await installProfile(page);
  await page.goto("/play/?mode=explore&birthday=off");
  await waitForOrbitHomeReady(page);
  const launch = page.locator("#exploreHub [data-mode='explore']");
  await expect(launch).toHaveCount(1);
  await launch.evaluate((button) => button.click());
  const game = page.locator("#gameScreen");
  await expect(game).toBeVisible({ timeout: 20_000 });
  const briefing = page.locator("#missionBriefingDialog");
  await expect(briefing).toHaveJSProperty("open", true, { timeout: 20_000 });
  await page.locator("#beginMission").evaluate((button) => button.click());
  await expect(briefing).toHaveJSProperty("open", false);
  await expect(game).toHaveAttribute("data-play-phase", "normal");
}

async function enableSpatialBloom(page) {
  const game = page.locator("#gameScreen");
  if (await game.getAttribute("data-word-input") !== "bloom") {
    await page.locator("#pauseRunButton").click();
    const pause = page.locator("#pauseDialog");
    await expect(pause).toHaveJSProperty("open", true);
    const preference = pause.locator("[data-spatial-bloom-preference]");
    await expect(preference).toHaveAttribute("aria-pressed", "false");
    await preference.click();
    await expect(preference).toHaveAttribute("aria-pressed", "true");
    await page.locator("#resumePausedRun").click();
    await expect(pause).toHaveJSProperty("open", false);
  }
  await expect(game).toHaveAttribute("data-word-input", "bloom");
  await expect(page.locator("#constellationBloom")).toBeVisible();
}

async function expectBloomSettled(page) {
  await expect.poll(() => page.locator("#constellationBloom").evaluate((root) => root.dataset.transition || ""))
    .toBe("");
}

async function distantBlankBoardPoint(page, origin) {
  return page.locator("#board").evaluate((board, start) => {
    const rect = board.getBoundingClientRect();
    const protectedSelector = ".constellation-bloom, .board-word, button, a, input, select, textarea, [role='button'], .board-quick-tools, .board-assistance-rail, .mobile-assist-surface, .help-nudge, .board-top-hud";
    const candidates = [
      [.18, .78], [.82, .78], [.18, .46], [.82, .46], [.5, .78], [.5, .42]
    ].map(([fx, fy]) => ({ x: rect.left + rect.width * fx, y: rect.top + rect.height * fy }))
      .filter(({ x, y }) => {
        const target = document.elementFromPoint(x, y);
        return target && board.contains(target) && !target.closest(protectedSelector);
      })
      .sort((left, right) => (
        Math.hypot(right.x - start.x, right.y - start.y)
        - Math.hypot(left.x - start.x, left.y - start.y)
      ));
    return candidates[0] || { x: rect.left + 18, y: rect.bottom - 18 };
  }, origin);
}

async function relocateBloom(page) {
  const bloom = page.locator("#constellationBloom");
  const trigger = page.locator("#constellationBloomTrigger");
  const initialCenter = await trigger.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  const point = await distantBlankBoardPoint(page, initialCenter);
  await page.mouse.dblclick(point.x, point.y);
  await expect(bloom).toHaveAttribute("data-stage", "words");
  await expectBloomSettled(page);
  const movedCenter = await trigger.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  expect(Math.hypot(movedCenter.x - initialCenter.x, movedCenter.y - initialCenter.y)).toBeGreaterThan(20);
  await expect(bloom).toHaveCount(1);
}

async function openBloomWords(page) {
  const bloom = page.locator("#constellationBloom");
  await expectBloomSettled(page);
  if (await bloom.getAttribute("data-stage") === "closed") {
    await page.locator("#constellationBloomTrigger").click();
    await expect(bloom).toHaveAttribute("data-stage", "words");
    await expectBloomSettled(page);
  }
  await expect(page.locator("#constellationBloomSearch")).toBeVisible();
}

async function chooseBloomWord(page, word) {
  await openBloomWords(page);
  const choice = page.locator(`#constellationBloomWords [data-word="${word.toLocaleLowerCase("en-US")}"]`);
  if (!await choice.isVisible()) await page.locator("#constellationBloomSearch").fill(word);
  await expect(choice).toBeVisible();
  await choice.click();
}

async function boardNodeSnapshot(page) {
  return page.locator("#boardItems").evaluate((boardItems) => (
    [...boardItems.querySelectorAll(".board-word")].map((node) => ({
      id: node.dataset.id,
      word: node.dataset.word,
      x: node.style.getPropertyValue("--x"),
      y: node.style.getPropertyValue("--y")
    }))
  ));
}

function wrongStarterFor(guide) {
  const blocked = new Set([
    String(guide.activeWord).toLocaleLowerCase("en-US"),
    String(guide.requiredPartner).toLocaleLowerCase("en-US")
  ]);
  return STARTER_WORDS.find((word) => !blocked.has(word.toLocaleLowerCase("en-US")));
}

test("strict Concept Chemistry double-click relocates one Bloom, rejects an early branch in place, and continues from the accepted product", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const guide = await startStrictManufacturingRun(page);
  expect(guide.expectedProduct).toBe("Steam");
  expect(STARTER_WORDS).toContain(guide.activeWord);
  expect(STARTER_WORDS).toContain(guide.requiredPartner);
  const wrongPartner = wrongStarterFor(guide);
  expect(wrongPartner).toBeTruthy();

  await enableSpatialBloom(page);
  await relocateBloom(page);

  let combineRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/combine") combineRequests += 1;
  });

  await chooseBloomWord(page, guide.activeWord);
  const activeNode = page.locator(`.board-word[data-word="${guide.activeWord.toLocaleLowerCase("en-US")}"]`);
  await expect(activeNode).toHaveCount(1);
  await expect(activeNode).toHaveAttribute("aria-pressed", "true");
  const beforeBlockedPair = await boardNodeSnapshot(page);
  expect(beforeBlockedPair).toHaveLength(1);

  await chooseBloomWord(page, wrongPartner);
  await expect(page.locator("#alchemyNote")).toHaveClass(/wrong-path/);
  await expect(page.locator("#alchemyNote")).toContainText(/CONCEPT BOND.*REACTION LOCKED/i);
  await expect(page.locator("#alchemyNote")).toContainText(/Words kept; move unchanged/i);
  await expect(page.locator("#movesValue")).toHaveText("0");
  expect(await boardNodeSnapshot(page)).toEqual(beforeBlockedPair);
  expect(combineRequests).toBe(0);

  if (await activeNode.getAttribute("aria-pressed") !== "true") await activeNode.click();
  await expect(activeNode).toHaveAttribute("aria-pressed", "true");
  const acceptedResponse = page.waitForResponse((response) => (
    new URL(response.url()).pathname === "/api/combine"
    && response.request().method() === "POST"
    && response.status() === 200
  ));
  await chooseBloomWord(page, guide.requiredPartner);
  const accepted = await (await acceptedResponse).json();
  expect(accepted.word).toBe(guide.expectedProduct);
  const continuation = guideFrom(accepted);
  expect(continuation.activeWord).toBe(guide.expectedProduct);
  expect(continuation.allowedPair.key).not.toBe(guide.allowedPair.key);

  const product = page.locator(`.board-word[data-word="${guide.expectedProduct.toLocaleLowerCase("en-US")}"]`);
  await expect(product).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator("#movesValue")).toHaveText("1");
  await expect(product).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#conceptBondLayer")).toBeVisible();
  await expect(page.locator("#conceptChemistryStatus")).toContainText(
    `${guide.expectedProduct} has an open Concept Bond`
  );
  await expect(page.locator("#conceptChemistryStatus")).toContainText(continuation.requiredPartner);
  expect(combineRequests).toBe(1);
});

test("Explore keeps Concept Chemistry fail-open and accepts an ordinary free pairing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startExplore(page);
  await enableSpatialBloom(page);
  await expect(page.locator("#board")).toHaveAttribute("data-concept-chemistry", "free");
  await expect(page.locator("#conceptBondLayer")).toBeHidden();

  const acceptedResponse = page.waitForResponse((response) => (
    new URL(response.url()).pathname === "/api/combine"
    && response.request().method() === "POST"
    && response.status() === 200
  ));
  await chooseBloomWord(page, "Air");
  await chooseBloomWord(page, "Fire");
  const accepted = await (await acceptedResponse).json();
  expect(accepted.word).toBe("Energy");
  await expect(page.locator('.board-word[data-word="energy"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator("#movesValue")).toHaveText("1");
  await expect(page.locator("#alchemyNote")).not.toHaveClass(/wrong-path/);
  await expect(page.locator("#board")).toHaveAttribute("data-concept-chemistry", "free");
});

test("Explore opens a Compound Orb, peels one authored bond, and rejoins the exact same matter without another reaction", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startExplore(page);
  await enableSpatialBloom(page);

  let combineRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/combine") combineRequests += 1;
  });

  const acceptedResponse = page.waitForResponse((response) => (
    new URL(response.url()).pathname === "/api/combine"
    && response.request().method() === "POST"
    && response.status() === 200
  ));
  await chooseBloomWord(page, "Air");
  await chooseBloomWord(page, "Fire");
  expect((await (await acceptedResponse).json()).word).toBe("Energy");

  const energy = page.locator('.board-word[data-word="energy"]');
  await expect(energy).toHaveCount(1, { timeout: 15_000 });
  await expect(energy).toHaveClass(/concept-matter-node--derived/);
  await expect(energy.locator(":scope > .concept-matter-orb")).toHaveCount(1);
  const originalInstanceId = await energy.getAttribute("data-concept-matter-instance");
  expect(originalInstanceId).toBeTruthy();
  await expect(page.locator("#movesValue")).toHaveText("1");
  // The response and result node can arrive before combineNodes reaches its
  // finally block. Clear becomes enabled only after the shared busy lock drops.
  await expect(page.locator("#resetBoard")).toBeEnabled();
  expect(combineRequests).toBe(1);

  await energy.focus();
  await page.keyboard.press("i");
  const inspector = page.locator(".concept-matter-inspector");
  await expect(inspector).toBeVisible();
  await expect(inspector).toHaveAttribute("data-profile", "laboratory");
  await expect(inspector).toContainText("Energy");
  const peel = inspector.locator('.concept-matter-cut--peel[aria-disabled="false"]');
  await expect(peel).toHaveCount(1);
  await peel.click();

  const air = page.locator('.board-word[data-word="air"]');
  const fire = page.locator('.board-word[data-word="fire"]');
  await expect(energy).toHaveCount(0);
  await expect(inspector).toBeHidden();
  await expect(air).toHaveCount(1);
  await expect(fire).toHaveCount(1);
  await expect(page.locator("#movesValue")).toHaveText("1");
  expect(combineRequests).toBe(1);

  await air.press("Enter");
  await expect(air).toHaveAttribute("aria-pressed", "true");
  await fire.press("Enter");
  await expect(energy).toHaveCount(1);
  await expect(air).toHaveCount(0);
  await expect(fire).toHaveCount(0);
  await expect(energy.locator(":scope > .concept-matter-orb")).toHaveCount(1);
  await expect(energy).toHaveAttribute("data-concept-matter-instance", originalInstanceId);
  await expect(page.locator("#movesValue")).toHaveText("1");
  expect(combineRequests).toBe(1);
});
