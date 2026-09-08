import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.CONSTELLORE_E2E_PORT || 4183);
const baseURL = `http://127.0.0.1:${port}`;
const chromiumChannel = String(process.env.CONSTELLORE_E2E_CHROMIUM_CHANNEL || "").trim() || undefined;
const chromiumDevice = (device) => ({
  ...device,
  ...(chromiumChannel ? { channel: chromiumChannel } : {})
});
const chromiumWebGLHarness = {
  // Test-harness only: bundled headless Chromium otherwise marks its software
  // WebGL2 context as a major performance caveat. Production keeps rejecting
  // that class of context and continues to use the poster fallback.
  launchOptions: {
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
  }
};

export default defineConfig({
  testDir: "./e2e",
  // WebKit's mobile actionability checks and Firefox accessibility scans can
  // legitimately take longer on shared CI runners. Keep a finite ceiling so
  // real hangs still fail, while avoiding engine-speed flakes.
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Spinning up every detected core overwhelms the three browser engines on
  // typical contributor laptops and turns actionability checks into timeouts.
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    reducedMotion: "no-preference"
  },
  projects: [
    { name: "chromium-mobile", use: chromiumDevice(devices["Pixel 7"]) },
    {
      name: "chromium-desktop",
      use: { ...chromiumDevice(devices["Desktop Chrome"]), ...chromiumWebGLHarness }
    },
    {
      name: "chromium-reduced-motion",
      testMatch: /(?:reveal-presentation|first-open-cinematic|constellore|mobile-play-shell)[.]spec[.]mjs/,
      use: { ...chromiumDevice(devices["Pixel 7"]), reducedMotion: "reduce" }
    },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"] } }
  ],
  webServer: {
    command: "node server.mjs",
    url: `${baseURL}/healthz`,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      CONSTELLORE_DATA_PATH: ":memory:",
      CONSTELLORE_ENABLE_TEST_STORE: "false",
      CONSTELLORE_TEST_PLAYER_REGISTRATION_LIMIT: "500",
      // Browser fixtures seed local progression only. The authoritative Bronze
      // gate is covered by Duel service/API tests; this explicit test-only
      // override lets the two-client UI harness exercise the live match itself.
      CONSTELLORE_TEST_DUEL_MINIMUM_ROUTE_RANK: "1",
      CONSTELLORE_COMMERCE_FULFILLMENT_READY: "false",
      REWARDED_ADS_ENABLED: "false"
    },
    reuseExistingServer: process.env.CONSTELLORE_E2E_REUSE_SERVER === "true",
    timeout: 30_000
  }
});
