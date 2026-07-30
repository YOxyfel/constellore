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

test("the cinematic runs once per browser session while active runs bypass it before boot", async () => {
  const [app, cinematic, sessionResume] = await Promise.all([
    readFile(projectFile("public/app.js"), "utf8"),
    readFile(projectFile("public/cinematic/first-open-cinematic.mjs"), "utf8"),
    readFile(projectFile("public/session-resume.mjs"), "utf8")
  ]);
  assert.doesNotMatch(app, /^import .*first-open-cinematic[.]mjs/m);
  assert.match(app, /const FIRST_OPEN_CINEMATIC_KEY = "constellore-first-open-cinematic-v1"/);
  assert.match(app, /import \{[^}]*markLaunchCinematicSessionPlayed[^}]*selectStartupResumeSnapshot[^}]*\} from "[.]\/session-resume[.]mjs[?]v=/);
  assert.match(sessionResume, /export const FIRST_OPEN_CINEMATIC_SESSION_KEY = "constellore-launch-cinematic-session-v1"/);
  assert.match(sessionResume, /export function markLaunchCinematicSessionPlayed\([\s\S]*target[?][.]setItem[?][.]\(key, "played"\)[\s\S]*target[?][.]getItem[?][.]\(key\) === "played"/);
  assert.match(cinematic, /export const FIRST_OPEN_CINEMATIC_SESSION_KEY = "constellore-launch-cinematic-session-v1"/);
  assert.match(cinematic, /function hasPlayedFirstOpenCinematicThisSession\(/);
  assert.match(cinematic, /if \(!force && playedThisSession\)[\s\S]*reason: "session-played"[\s\S]*menuHandoff: true/);
  assert.match(cinematic, /markFirstOpenCinematicSessionPlayed\(sessionStorage, sessionStorageKey\)/);

  const activeRunPreflight = app.indexOf("const startupResumeSnapshot = selectStartupResumeSnapshot({");
  const activeRunRead = app.indexOf("snapshot: readActiveRunSnapshot()", activeRunPreflight);
  const dynamicImport = app.indexOf('await import("./cinematic/first-open-cinematic.mjs?v=');
  const playback = app.indexOf("}).playLaunch()");
  const handoff = app.indexOf("onHandoff: handoffLaunchMenu");
  assert.ok(activeRunPreflight >= 0 && activeRunRead > activeRunPreflight && dynamicImport > activeRunRead && handoff > dynamicImport && playback > handoff);
  assert.match(app, /const startupResumeSnapshot = selectStartupResumeSnapshot\(\{\s*snapshot: readActiveRunSnapshot\(\),\s*sharedChallenge: startupSharedChallenge,\s*modeIntent: startupModeIntent\s*\}\)/);
  assert.match(app, /if \(!startupResumeSnapshot\) \{[\s\S]*[}][)][.]playLaunch\(\);[\s\S]*\} else \{[\s\S]*markLaunchCinematicSessionPlayed\(\)/);
  assert.match(app, /function handoffLaunchMenu\(\)[\s\S]*gameAudio[.]setScene\("home"\)[\s\S]*gameAudio[.]prime\(\)[\s\S]*releaseLaunchBlackout\(\)/);
  assert.match(app, /function releaseLaunchBlackout\(\)\s*\{\s*cosmicGate[.]skipIntro\(\);\s*\}/);
  assert.match(app, /onPlaybackIntent: \(\) => gameAudio[.]prime\(\{ startMusic: false \}\)/);
  assert.match(app, /[}][)][.]playLaunch\(\);[\s\S]*handoffLaunchMenu\(\);[\s\S]*markLaunchCinematicSessionPlayed\(\)[\s\S]*const ctrlHover/);
  assert.doesNotMatch(app.slice(dynamicImport, app.indexOf("const ctrlHover")), /cosmicGate[.]playIntro/);
  assert.match(app, /launchCinematicOutcome[.]menuHandoff === true/);
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
