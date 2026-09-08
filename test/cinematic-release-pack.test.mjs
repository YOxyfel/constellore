import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const CINEMATIC_FILES = [
  "cinematic/first-open-cinematic.mjs",
  "cinematic/first-open-cinematic.css",
  "cinematic/intro-video.mp4",
  "cinematic/intro-video-phone.mp4"
];

test("the optional launch cinematic pack declares every source artifact", async () => {
  for (const path of CINEMATIC_FILES) {
    assert.ok((await stat(projectFile(`public/${path}`))).size > 0, `${path} is missing or empty.`);
  }
});

test("public entry cannot import archived intros and preserves direct home and saved-run handoffs", async () => {
  const [app, website, landing] = await Promise.all([
    readFile(projectFile("public/app.js"), "utf8"),
    readFile(projectFile("Website/site.js"), "utf8"),
    readFile(projectFile("Website/index.html"), "utf8")
  ]);
  assert.doesNotMatch(app, /first-open-cinematic|voyage-projection-experience|FIRST_OPEN_CINEMATIC_KEY|markLaunchCinematicSessionPlayed/);
  assert.doesNotMatch(website, /watchVoyage|website-voyage-preview|playWebsiteVoyage/);
  assert.doesNotMatch(landing, /watchVoyage|Experience the opening|57-second Voyage/);
  assert.match(app, /const startupResumeSnapshot = selectStartupResumeSnapshot\(\{\s*snapshot: readActiveRunSnapshot\(\),\s*sharedChallenge: startupSharedChallenge,\s*modeIntent: startupModeIntent\s*\}\)/);
  assert.match(app, /const startupOpensHome = !startupResumeSnapshot \|\| startupScramblePreemptsResume/);
  assert.match(app, /if \(startupOpensHome\) void handoffLaunchMenu\(\)/);
  assert.match(app, /function handoffLaunchMenu\(\)[\s\S]*prepareHomeJourneyArt\(\)[\s\S]*releaseLaunchBlackout\(\)/);
  assert.match(app, /function releaseLaunchBlackout\(\)\s*\{\s*cosmicGate[.]skipIntro\(\);\s*\}/);
  assert.match(app, /const launchMenuHandoff = startupOpensHome/);
  assert.match(app, /function resetLocalPractice\([\s\S]*clearGameStorage\(safeBrowserStorage\(\)\)/);
});

test("Pages recursively transforms cinematic assets and keeps them out of the install shell", async () => {
  const source = await readFile(projectFile("scripts/build-pages.mjs"), "utf8");
  assert.match(source, /for \(const name of await listRelativeFiles\(cinematicSource\)\)/);
  assert.match(source, /mkdir\(dirname\(destination\), \{ recursive: true \}\)/);
  assert.match(source, /withAssetVersion\(await readFile\(source, "utf8"\), release[.]version\)/);
  assert.match(source, /minifyCss\(await readFile\(source, "utf8"\)\)/);
  assert.match(source, /!name[.]startsWith\("cinematic\/"\)/);
  assert.match(source, /lazyAssets: \[[^\]]*"[.]\/cinematic\/"/);
});

test("server release sync versions nested cinematic modules and keeps the pack lazy", async () => {
  const source = await readFile(projectFile("scripts/sync-public-release.mjs"), "utf8");
  assert.match(source, /listRelativeFiles\(cinematicDirectory\)/);
  assert.match(source, /if \(\/\\[.]\(\?:js\|mjs\)\$\/[.]test\(name\)\)/);
  assert.match(source, /withAssetVersion\(await readFile\(path, "utf8"\), pkg[.]version\)/);
  assert.match(source, /!name[.]startsWith\("cinematic\/"\)/);
  assert.match(source, /lazyAssets: \[[^\]]*"\/cinematic\/"/);
});

test("artifact verifiers and performance accounting enforce the optional cinematic boundary", async () => {
  const [pages, itch, budget, worker] = await Promise.all([
    readFile(projectFile("scripts/verify-pages-build.mjs"), "utf8"),
    readFile(projectFile("scripts/verify-itch-build.mjs"), "utf8"),
    readFile(projectFile("scripts/check-performance-budget.mjs"), "utf8"),
    readFile(projectFile("public/service-worker.js"), "utf8")
  ]);
  for (const path of CINEMATIC_FILES) {
    assert.ok(pages.includes(`"${path}"`), `Pages verifier does not require ${path}.`);
    assert.ok(itch.includes(`"${path}"`), `itch verifier does not require ${path}.`);
    assert.ok(budget.includes(`"play/${path}"`), `Performance audit does not require ${path}.`);
  }
  for (const verifier of [pages, itch]) {
    assert.match(verifier, /doesNotMatch\([^,]+, \/cinematic\\\//);
    assert.ok(
      verifier.includes("const LAZY_PREFIXES = [^;]*[.]\\/cinematic\\/"),
      "Artifact verifier does not require the cinematic lazy-runtime prefix."
    );
  }
  assert.match(worker, /const LAZY_PREFIXES = [^;]*\/cinematic\//);
  assert.match(budget, /CINEMATIC_PACK_MAXIMUM_BYTES = 11_000_000/);
  assert.match(budget, /!record[.]path[.]startsWith\("play\/cinematic\/"\)/);
  assert.match(budget, /\+ CINEMATIC_PACK_MAXIMUM_BYTES/);
});
