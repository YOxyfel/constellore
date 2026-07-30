import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validatePublicDuelApiUrl } from "../scripts/public-duel-config.mjs";
import { renderServiceWorker } from "../scripts/service-worker-source.mjs";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const SCRAMBLE_LAZY_FILES = [
  "scramble.mjs",
  "scramble-runtime.mjs",
  "scramble-app-bridge.mjs",
  "scramble-arena.mjs",
  "forge-clash.mjs",
  "scramble.css"
];

test("public duel release configuration accepts blank offline builds and one exact HTTPS base", () => {
  assert.equal(validatePublicDuelApiUrl(undefined), "");
  assert.equal(validatePublicDuelApiUrl("   "), "");
  assert.equal(
    validatePublicDuelApiUrl("  https://Duels.Example:443/api/duels/  "),
    "https://duels.example/api/duels"
  );
  assert.equal(
    validatePublicDuelApiUrl("https://duels.example:8443/api/duels"),
    "https://duels.example:8443/api/duels"
  );
});

test("public duel release configuration rejects unsafe or inexact bases", () => {
  for (const value of [
    "not-a-url",
    "http://duels.example/api/duels",
    "https:\\\\duels.example\\api\\duels",
    "https://user:password@duels.example/api/duels",
    "https://@duels.example/api/duels",
    "https://duels.example",
    "https://duels.example/api",
    "https://duels.example/api/duels/matches",
    "https://duels.example/api/duels/.",
    "https://duels.example/api/private/../duels",
    "https://duels.example/api/duels?source=release",
    "https://duels.example/api/duels?",
    "https://duels.example/api/duels#status",
    "https://duels.example/api/duels#"
  ]) {
    assert.throws(
      () => validatePublicDuelApiUrl(value),
      /PUBLIC_DUEL_API_URL/,
      `${value} should not be accepted as a public duel base.`
    );
  }
});

test("Pages and itch emit and verify the same optional duel base", async () => {
  const [pagesBuild, itchBuild, pagesVerifier, itchVerifier] = await Promise.all([
    readProjectFile("scripts/build-pages.mjs"),
    readProjectFile("scripts/build-itch.mjs"),
    readProjectFile("scripts/verify-pages-build.mjs"),
    readProjectFile("scripts/verify-itch-build.mjs")
  ]);

  assert.match(pagesBuild, /validatePublicDuelApiUrl\(configuredDuelApiUrl\)/);
  assert.match(pagesBuild, /setBodyDataAttribute\(gameHtml, "data-duel-api", duelApiUrl\)/);
  assert.match(itchBuild, /validatePublicDuelApiUrl\(process[.]env[.]PUBLIC_DUEL_API_URL\)/);
  assert.match(itchBuild, /PUBLIC_DUEL_API_URL:\s*duelApiUrl/);
  assert.match(itchBuild, /soloPlay:\s*"local-offline"/);
  assert.match(itchBuild, /soloProgressLocalOnly:\s*true/);
  assert.match(itchBuild, /liveDuels:\s*"online-only"/);
  assert.match(itchBuild, /duelRatingServerBacked:\s*true/);
  for (const verifier of [pagesVerifier, itchVerifier]) {
    assert.match(verifier, /validatePublicDuelApiUrl\(process[.]env[.]PUBLIC_DUEL_API_URL\)/);
    assert.match(verifier, /data-duel-api/);
    assert.match(verifier, /expectedDuelApiUrl/);
  }
});

test("Scramble ships as an exact lazy surface and never blocks the install shell", async () => {
  const [secondaryLoader, pagesBuild, pagesVerifier, itchVerifier] = await Promise.all([
    readProjectFile("public/secondary-surface-loader.mjs"),
    readProjectFile("scripts/build-pages.mjs"),
    readProjectFile("scripts/verify-pages-build.mjs"),
    readProjectFile("scripts/verify-itch-build.mjs")
  ]);
  const worker = renderServiceWorker({
    cachePrefix: "hybrid-test-",
    version: "4.0.0-beta.4",
    assets: ["./app.js?v=4.0.0-beta.4"],
    lazyFiles: SCRAMBLE_LAZY_FILES.map((file) => `./${file}?v=4.0.0-beta.4`)
  });
  const shell = worker.match(/const SHELL = ([^;]+);/)?.[1] || "";
  const lazyFiles = worker.match(/const LAZY_FILES = new Set\(([^;]+)\);/)?.[1] || "";

  assert.match(pagesBuild, /lazyFiles:\s*SECONDARY_SURFACE_FILES/);
  assert.match(pagesBuild, /stardust-store\|scramble/);
  for (const file of SCRAMBLE_LAZY_FILES) {
    const pattern = new RegExp(file.replaceAll(".", "[.]"));
    assert.match(secondaryLoader, pattern, `${file} is missing from the secondary-surface boundary.`);
    assert.match(pagesVerifier, pattern, `${file} is not verified in Pages.`);
    assert.match(itchVerifier, pattern, `${file} is not verified in itch.`);
    assert.match(lazyFiles, pattern, `${file} is missing from the worker's exact lazy-file allowlist.`);
  }
  assert.doesNotMatch(shell, /scramble/, "Scramble entered the service-worker install shell.");
});

test("hosted duel flags and cross-origin writes stay explicit and fail closed", async () => {
  const [environment, blueprint, deployDocs, app] = await Promise.all([
    readProjectFile(".env.example"),
    readProjectFile("render.yaml"),
    readProjectFile("DEPLOY_BETA.md"),
    readProjectFile("public/app.js")
  ]);

  assert.match(environment, /^CONSTELLORE_DUELS_ENABLED=false$/m);
  assert.match(environment, /^CONSTELLORE_PUBLIC_DUELS_ENABLED=false$/m);
  assert.match(environment, /^PUBLIC_DUEL_API_URL=$/m);
  assert.match(blueprint, /key:\s*CONSTELLORE_DUELS_ENABLED\s*\r?\n\s*value:\s*"true"/);
  assert.match(blueprint, /key:\s*CONSTELLORE_PUBLIC_DUELS_ENABLED\s*\r?\n\s*value:\s*"true"/);
  assert.match(
    blueprint,
    /key:\s*APP_ALLOWED_ORIGINS\s*\r?\n\s*value:\s*https:\/\/yoxyfel[.]github[.]io,https:\/\/html-classic[.]itch[.]zone/
  );
  assert.doesNotMatch(blueprint, /APP_ALLOWED_ORIGINS[\s\S]{0,100}[*]/);
  assert.doesNotMatch(blueprint, /[*][.]itch[.](?:io|zone)/);
  assert.match(deployDocs, /PUBLIC_DUEL_API_URL[\s\S]*exact hosted HTTPS base ending in `?\/api\/duels`?/i);
  assert.match(deployDocs, /inspect the iframe's actual `Origin`[\s\S]*do not add a broader fallback/i);
  assert.match(deployDocs, /solo[\s\S]*offline[\s\S]*live Scramble duels[\s\S]*online/i);
  assert.doesNotMatch(app, /\b(?:ensureCosmosCircuit|openCosmosCircuit|COSMOS_CIRCUIT_RELEASE_ENABLED)\b/);
  assert.match(app, /localStorage[.]removeItem\(COSMOS_CIRCUIT_SAVE_KEY\)/);
});
