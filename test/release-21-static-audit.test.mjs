import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { constellationVoyageCatalog } from "../public/constellation-voyages.mjs";
import { cosmicEventCatalog } from "../public/cosmic-events.mjs";
import { generateLocalWorldData, lookupGeneratedCombination } from "../scripts/build-local-world.mjs";

const FEATURE_MODULES = [
  "second-orbit",
  "explore-sandbox",
  "signature-routes",
  "living-atlas",
  "constellation-voyages",
  "recipe-insight",
  "community-results",
  "cosmic-events"
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
  const [app, pagesBuild, itchBuild, pagesVerify, itchVerify, onlineWorker, packageText] = await Promise.all([
    readProjectFile("public/app.js"),
    readProjectFile("scripts/build-pages.mjs"),
    readProjectFile("scripts/build-itch.mjs"),
    readProjectFile("scripts/verify-pages-build.mjs"),
    readProjectFile("scripts/verify-itch-build.mjs"),
    readProjectFile("public/service-worker.js"),
    readProjectFile("package.json")
  ]);
  const releaseVersionPattern = JSON.parse(packageText).version.replaceAll(".", "[.]");
  assert.ok(
    pagesBuild.includes('.filter((name) => /^(?:app[.]js|styles[.]css|.+[.]mjs|'),
    "Pages must discover every public runtime module"
  );
  assert.ok(
    pagesBuild.includes("for (const name of publicRuntimeFiles)"),
    "Pages must copy every discovered public runtime module"
  );
  assert.ok(
    pagesBuild.includes("const practiceAssets =") && pagesBuild.includes("assets: practiceAssets"),
    "Pages must pre-cache every copied practice runtime asset"
  );

  for (const module of FEATURE_MODULES) {
    const versioned = new RegExp(`${module}[.]mjs[?]v=${releaseVersionPattern}`);
    assert.match(app, versioned, `${module} must load from the browser entrypoint`);
    assert.match(onlineWorker, versioned, `${module} must be pre-cached by the hosted worker`);
    assert.match(pagesVerify, new RegExp(`"${module}[.]mjs"`), `${module} must be checked in the Pages artifact`);
    assert.match(itchVerify, new RegExp(`"${module}[.]mjs"`), `${module} must be checked in the itch ZIP`);
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

test("new feature copy keeps the 15px readable-text floor", async () => {
  const [gameStyles, websiteStyles] = await Promise.all([
    readProjectFile("public/styles.css"),
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

  for (const selector of [".step p", ".proof-feature p", ".faq-list p"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rule = websiteStyles.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`))?.[0] || "";
    assert.match(rule, /font-size:\s*(?:1[5-9]|[2-9][0-9])px/, `${selector} must keep readable launch copy`);
  }
});
