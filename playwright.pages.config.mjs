import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config.mjs";

const port = Number(process.env.CONSTELLORE_PAGES_E2E_PORT || 4184);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig(baseConfig, {
  testMatch: /(?:constellore|mobile-home-static|pwa-offline)[.]spec[.]mjs$/,
  use: {
    ...baseConfig.use,
    baseURL
  },
  webServer: {
    command: "node scripts/serve-pages-preview.mjs",
    url: `${baseURL}/`,
    env: {
      ...process.env,
      PORT: String(port),
      CONSTELLORE_PAGES_PREFIX: "/"
    },
    reuseExistingServer: false,
    timeout: 30_000
  }
});
