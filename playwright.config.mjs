import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.CONSTELLORE_E2E_PORT || 4183);
const baseURL = `http://127.0.0.1:${port}`;
const chromiumChannel = String(process.env.CONSTELLORE_E2E_CHROMIUM_CHANNEL || "").trim() || undefined;
const chromiumDevice = (device) => ({
  ...device,
  ...(chromiumChannel ? { channel: chromiumChannel } : {})
});

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
    { name: "chromium-desktop", use: chromiumDevice(devices["Desktop Chrome"]) },
    {
      name: "chromium-reduced-motion",
      testMatch: /(?:reveal-presentation|first-open-cinematic|constellore)[.]spec[.]mjs/,
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
      CONSTELLORE_DATA_PATH: `./data/e2e-${port}.json`,
      CONSTELLORE_ENABLE_TEST_STORE: "false",
      CONSTELLORE_TEST_PLAYER_REGISTRATION_LIMIT: "500",
      CONSTELLORE_COMMERCE_FULFILLMENT_READY: "false",
      REWARDED_ADS_ENABLED: "false"
    },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
