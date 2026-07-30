import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { constellationVoyageCatalog } from "../public/constellation-voyages.mjs";
import { cosmicEventCatalog } from "../public/cosmic-events.mjs";
import { generateLocalWorldData, lookupGeneratedCombination } from "../scripts/build-local-world.mjs";

const FEATURE_MODULES = [
  "reveal-presentation",
  "second-orbit",
  "explore-sandbox",
  "signature-routes",
  "living-atlas",
  "constellation-voyages",
  "recipe-insight",
  "community-results",
  "cosmic-events",
  "adaptive-difficulty",
  "home-menu-view",
  "profile-rank-surface"
];
const CIRCUIT_DEPENDENCIES = [
  "cosmos-circuit",
  "cosmos-circuit-copy",
  "circuit-lobby-tabs",
  "circuit-live-ops",
  "star-path"
];

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every Voyage and Cosmic Event destination remains playable in static practice", async () => {
  const data = await generateLocalWorldData();
  const targets = new Set();
  for (const voyage of constellationVoyageCatalog()) {
    for (const chapter of voyage.chapters) targets.add(chapter.target);
  }
  for (const event of cosmicEventCatalog()) {
    for (const target of event.temporaryTargets) targets.add(target.word);
    for (const word of event.collection.words) targets.add(word);
  }

  assert.ok(targets.size >= 45, "the static audit should cover the full Voyage and Event target surface");
  for (const target of targets) {
    const key = target.toLocaleLowerCase("en-US");
    assert.equal(data.payload.targetDetails[key]?.target, target, `${target} must be selectable in local practice`);
    const route = data.payload.targetRoutes[key];
    assert.ok(Array.isArray(route), `${target} must retain a packaged local route`);
    const available = new Set(["earth", "water", "fire", "air"]);
    for (const step of route) {
      assert.ok(available.has(step.a.toLocaleLowerCase("en-US")), `${target}: ${step.a} must exist before ${step.word}`);
      assert.ok(available.has(step.b.toLocaleLowerCase("en-US")), `${target}: ${step.b} must exist before ${step.word}`);
      assert.equal(lookupGeneratedCombination(data, step.a, step.b)?.word, step.word, `${target}: packaged recipe drifted`);
      available.add(step.word.toLocaleLowerCase("en-US"));
    }
    assert.ok(available.has(key), `${target} must be reachable from the four starters`);
  }
});

test("static Cosmic Events seed collection starters exactly like the server", async () => {
  const app = await readProjectFile("public/app.js");
  const sanitizer = app.match(/function sanitizeEventProgressForEvent\b[\s\S]*?\n}\n\nfunction sanitizeEventProgress\b/)?.[0] || "";
  assert.match(sanitizer, /\["Earth", "Water", "Fire", "Air"\]/);
  assert.match(sanitizer, /event[.]collection[.]words[.]some/);
  assert.match(sanitizer, /cosmicEventCollectionProgress\(event,[\s\S]*originWords/);

  const services = await readProjectFile("game-services.mjs");
  assert.match(services, /COSMIC_EVENT_ORIGIN_WORDS[.]has\(word[.]toLocaleLowerCase/);
});

test("all current feature modules and release artwork are copied, cached, and verified", async () => {
  const [app, circuitRuntime, secondaryLoader, pagesBuild, itchBuild, pagesVerify, itchVerify, onlineWorker, packageText, developerRuntime] = await Promise.all([
    readProjectFile("public/app.js"),
    readProjectFile("public/cosmos-circuit-runtime.mjs"),
    readProjectFile("public/secondary-surface-loader.mjs"),
    readProjectFile("scripts/build-pages.mjs"),
    readProjectFile("scripts/build-itch.mjs"),
    readProjectFile("scripts/verify-pages-build.mjs"),
    readProjectFile("scripts/verify-itch-build.mjs"),
    readProjectFile("public/service-worker.js"),
    readProjectFile("package.json"),
    readProjectFile("public/developer-console-runtime.mjs")
  ]);
  const releaseVersionPattern = JSON.parse(packageText).version.replaceAll(".", "[.]");
  assert.ok(
    pagesBuild.includes("const publicRuntimeFiles =")
      && pagesBuild.includes("cosmetic-preload-bootstrap")
      && pagesBuild.includes(".+[.]mjs"),
    "Pages must discover every public runtime module"
  );
  assert.ok(
    pagesBuild.includes("for (const name of publicRuntimeFiles)"),
    "Pages must copy every discovered public runtime module"
  );
  assert.ok(
    pagesBuild.includes("const practiceAssets =") && pagesBuild.includes("assets: practiceAssets"),
    "Pages must build an explicit install shell"
  );
  assert.match(pagesBuild, /lazyFiles: SECONDARY_SURFACE_FILES/, "Pages must keep optional surfaces out of install and cache them on first use");

  for (const module of FEATURE_MODULES) {
    const versioned = new RegExp(`${module}[.]mjs[?]v=${releaseVersionPattern}`);
    assert.match(app, versioned, `${module} must load from the browser entrypoint`);
    assert.match(onlineWorker, versioned, `${module} must be pre-cached by the hosted worker`);
    assert.match(pagesVerify, new RegExp(`"${module}[.]mjs"`), `${module} must be checked in the Pages artifact`);
    assert.match(itchVerify, new RegExp(`"${module}[.]mjs"`), `${module} must be checked in the itch ZIP`);
  }

  const circuitRuntimePattern = new RegExp(`cosmos-circuit-runtime[.]mjs[?]v=${releaseVersionPattern}`);
  assert.doesNotMatch(app, /^import .*cosmos-circuit-runtime/m, "Cosmos Circuit must not enter the static browser graph");
  assert.match(secondaryLoader, circuitRuntimePattern, "Cosmos Circuit must load through the secondary-surface boundary");
  assert.match(onlineWorker, circuitRuntimePattern, "Cosmos Circuit must be in the hosted worker's exact lazy-file allowlist");
  assert.match(onlineWorker, /const LAZY_FILES = new Set/, "The hosted worker must distinguish exact lazy files from its install shell");
  assert.match(pagesVerify, /"cosmos-circuit-runtime[.]mjs"/, "Cosmos Circuit must be checked in the Pages artifact");
  assert.match(itchVerify, /"cosmos-circuit-runtime[.]mjs"/, "Cosmos Circuit must be checked in the itch ZIP");
  for (const module of CIRCUIT_DEPENDENCIES) {
    const versioned = new RegExp(`${module}[.]mjs[?]v=${releaseVersionPattern}`);
    assert.match(circuitRuntime, versioned, `${module} must load from the Cosmos Circuit runtime`);
    assert.match(onlineWorker, versioned, `${module} must be available through the hosted worker's lazy-file allowlist`);
    assert.match(pagesVerify, new RegExp(`"${module}[.]mjs"`), `${module} must be checked in the Pages artifact`);
    assert.match(itchVerify, new RegExp(`"${module}[.]mjs"`), `${module} must be checked in the itch ZIP`);
  }
  for (const asset of ["cosmos-circuit.css"]) {
    const versioned = new RegExp(`${asset.replaceAll(".", "[.]")}[?]v=${releaseVersionPattern}`);
    assert.match(onlineWorker, versioned, `${asset} must be available through the hosted worker's lazy-file allowlist`);
    assert.match(pagesVerify, new RegExp(`"${asset.replaceAll(".", "[.]")}"`), `${asset} must be checked in the Pages artifact`);
    assert.match(itchVerify, new RegExp(`"${asset.replaceAll(".", "[.]")}"`), `${asset} must be checked in the itch ZIP`);
  }

  assert.match(app, new RegExp(`developer-console-runtime[.]mjs[?]v=${releaseVersionPattern}`));
  assert.match(app, new RegExp(`share-card-runtime[.]mjs[?]v=${releaseVersionPattern}`));
  assert.match(developerRuntime, new RegExp(`developer-console[.]mjs[?]v=${releaseVersionPattern}`));
  assert.match(developerRuntime, new RegExp(`developer-console[.]css[?]v=${releaseVersionPattern}`));
  for (const asset of ["developer-console.mjs", "developer-console-runtime.mjs", "developer-console.css", "share-card-runtime.mjs"]) {
    const pattern = new RegExp(asset.replaceAll(".", "[.]"));
    assert.match(onlineWorker, pattern, `${asset} must be pre-cached by the hosted worker`);
    assert.match(pagesVerify, pattern, `${asset} must be checked in the Pages artifact`);
    assert.match(itchVerify, pattern, `${asset} must be checked in the itch ZIP`);
  }

  assert.match(pagesBuild, /social-card-v3[.]jpg/, "the destination-first social card must be copied into the release tree");
  assert.match(pagesVerify, /social-card-v3[.]jpg/, "the destination-first social card must be verified in Pages");
  for (const icon of ["icon-192.png", "icon-512.png", "icon-maskable-512.png"]) {
    assert.match(pagesVerify, new RegExp(icon.replace(".", "[.]")), `${icon} must be verified in Pages`);
    assert.match(onlineWorker, new RegExp(icon.replace(".", "[.]")), `${icon} must be cached online`);
    assert.match(itchVerify, new RegExp(icon.replace(".", "[.]")), `${icon} must be verified in itch`);
  }
  assert.match(itchBuild, /cp\(join\(pagesOutput, "play"\)/, "itch packaging must derive from the verified Pages play tree");
});

test("new feature copy keeps the 18px primary reading floor", async () => {
  const [gameStyles, simpleStyles, websiteStyles] = await Promise.all([
    readProjectFile("public/styles.css"),
    readProjectFile("public/simple-ui.css"),
    readProjectFile("Website/styles.css")
  ]);
  const featureStyles = gameStyles.split("/* Signature Constellations")[1] || "";
  assert.ok(featureStyles, "the 2.1 feature stylesheet block must exist");
  const sizes = [
    ...featureStyles.matchAll(/font-size:\s*([0-9]+(?:[.][0-9]+)?)px/gi),
    ...featureStyles.matchAll(/font:\s*[^;{}]*?([0-9]+(?:[.][0-9]+)?)px(?:\/[0-9.]+)?/gi)
  ].map((match) => Number(match[1]));
  assert.ok(sizes.length >= 35, "the release audit should inspect every explicit 2.1 text size");
  assert.ok(sizes.every((size) => size >= 15), `2.1 feature copy fell below 15px: ${Math.min(...sizes)}px`);

  assert.match(simpleStyles, /body[.]simple-ui\s*\{[^}]*font-size:\s*18px/);
  assert.match(simpleStyles, /[.]simple-ui :is\(p, label, input, select, textarea\)\s*\{[^}]*font-size:\s*18px/);
  for (const selector of [".hero-lede", ".preview-message", ".site-footer p"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rule = websiteStyles.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`))?.[0] || "";
    assert.match(rule, /font-size:\s*(?:clamp\()?(?:1[8-9]|[2-9][0-9])px/, `${selector} must keep the 18px reading floor`);
  }
});
