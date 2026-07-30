import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { COSMETIC_PACKS } from "./cosmetic-assets.mjs";
import { AUDIO_PACKS } from "./audio-assets.mjs";
import { COSMIC_GATE_ASSETS } from "./cosmic-gate-assets.mjs";
import { HOME_COSMOS_ASSETS } from "./home-cosmos-assets.mjs";
import { SECONDARY_SURFACE_FILES } from "../public/secondary-surface-loader.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist-pages");

async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const files = await filesIn(output);
const records = await Promise.all(files.map(async (path) => {
  const data = await readFile(path);
  return { path: relative(output, path).replaceAll("\\", "/"), bytes: data.length, gzip: gzipSync(data, { level: 9 }).length };
}));
const byPath = new Map(records.map((record) => [record.path, record]));
const required = (path) => {
  const record = byPath.get(path);
  assert.ok(record, `${path} is missing from the Pages performance audit.`);
  return record;
};
const STORY_PACK_PATHS = [
  "play/story/combination-story.mjs",
  "play/story/combination-story-view.mjs",
  "play/story/combination-story-runtime.mjs",
  "play/story/combination-story.css"
];
const STORY_PACK_MAXIMUM_BYTES = 40_000;
for (const path of STORY_PACK_PATHS) required(path);
const GOLDEN_PAIR_PACK_PATHS = [
  "play/story/golden-fusions/golden-pair-animations.mjs",
  "play/story/golden-fusions/golden-pair-view.mjs",
  "play/story/golden-fusions/golden-pair-runtime.mjs",
  "play/story/golden-fusions/golden-pair.css"
];
const GOLDEN_PAIR_PACK_MAXIMUM_BYTES = 56_000;
for (const path of GOLDEN_PAIR_PACK_PATHS) required(path);
const CINEMATIC_PACK_PATHS = [
  "play/cinematic/first-open-cinematic.mjs",
  "play/cinematic/first-open-cinematic.css",
  "play/cinematic/intro-video.mp4",
  "play/cinematic/intro-video-phone.mp4"
];
const CINEMATIC_PACK_MAXIMUM_BYTES = 11_000_000;
// v5 keeps the live-duel runtime lazy, but its small shell handoff still lives
// in app.js. The stricter aggregate gzip ceiling below remains unchanged.
// Arena host handoff, session recovery, and the protected post-win transition
// add 1.4 KB to v5's shell. Keep a narrow ceiling rather than hiding it in the
// much larger lazy Scramble allowance.
const CORE_APP_MAXIMUM_BYTES = 445_000;
// The v5 mobile-home rules add a sub-0.4% raw-CSS allowance; the aggregate
// 325 KB gzip ceiling below remains unchanged.
const CORE_GAME_CSS_MAXIMUM_BYTES = 263_000;
const CINEMATIC_CSS_MAXIMUM_BYTES = 45_000;
const BASE_ARTIFACT_MAXIMUM_BYTES = 8_715_000;
const CIRCUIT_PACK_MAXIMUM_BYTES = 235_000;
const CIRCUIT_SURFACE_MAXIMUM_BYTES = 265_000;
// The immersive collection preview adds five focused, keyboard-accessible
// presentation surfaces (board, home, gate, menu, and sound) while keeping
// gameplay locked. Bound its JS and CSS separately so this intentional feature
// cannot become an open-ended Observatory allowance.
const OBSERVATORY_RUNTIME_MAXIMUM_BYTES = 80_000;
const OBSERVATORY_SURFACE_MAXIMUM_BYTES = 130_000;
const STARDUST_SURFACE_MAXIMUM_BYTES = 13_000;
// The same bounded immersive-preview runtime is part of the aggregate optional
// surface inventory; preserve only a small cross-surface margin above it.
const SECONDARY_SURFACE_MAXIMUM_BYTES = 405_000;
// v5 Arena includes the authoritative multi-chapter Saga UI and its isolated
// app bridge. The whole pack remains lazy and outside the install shell.
const SCRAMBLE_SURFACE_MAXIMUM_BYTES = 205_000;
const SCRAMBLE_SURFACE_FILES = new Set([
  "scramble.css",
  "scramble-runtime.mjs",
  "scramble-app-bridge.mjs",
  "scramble.mjs",
  "scramble-arena.mjs",
  "forge-clash.mjs"
]);
const CORE_COSMETICS_CSS_MAXIMUM_BYTES = 60_000;
const OBSERVATORY_CSS_MAXIMUM_BYTES = 50_000;
const CIRCUIT_CSS_MAXIMUM_BYTES = 32_000;
const COSMIC_INTERLUDE_CSS_MAXIMUM_BYTES = 12_000;
for (const path of CINEMATIC_PACK_PATHS) required(path);
for (const path of SECONDARY_SURFACE_FILES) required(`play/${path}`);

const app = required("play/app.js");
const cosmeticPreloadBootstrap = required("play/cosmetic-preload-bootstrap.js");
const styles = required("play/styles.css");
const simpleStyles = required("play/simple-ui.css");
const cosmicStyles = required("play/cosmic-gate.css");
const epicHomeStyles = required("play/epic-home.css");
const cosmeticsStyles = required("play/cosmetics.css");
const observatoryStyles = required("play/cosmetics-observatory.css");
const cosmeticPreviewStyles = required("play/cosmetic-world-preview.css");
const circuitStyles = required("play/cosmos-circuit.css");
const circuitRuntime = required("play/cosmos-circuit-runtime.mjs");
const circuitDomain = required("play/cosmos-circuit.mjs");
const starPathDomain = required("play/star-path.mjs");
const circuitLiveOps = required("play/circuit-live-ops.mjs");
const circuitCopy = required("play/cosmos-circuit-copy.mjs");
const circuitLobbyTabs = required("play/circuit-lobby-tabs.mjs");
const observatoryRuntime = required("play/cosmetics-observatory.mjs");
const cosmeticPreviewRuntime = required("play/cosmetic-world-preview.mjs");
const stardustStyles = required("play/stardust-store.css");
const cosmicInterludeStyles = required("play/cosmic-interlude.css");
const stardustDomain = required("play/stardust-store.mjs");
const stardustRuntime = required("play/stardust-store-runtime.mjs");
const masteryCatalog = required("play/mastery-catalog.mjs");
const defaultProfile = required("play/default-profile.mjs");
const initialAppState = required("play/initial-app-state.mjs");
const victoryHandoff = required("play/victory-handoff.mjs");
const cosmeticCatalog = required("play/cosmetic-catalog.mjs");
const cosmeticEconomy = required("play/cosmetic-economy.mjs");
const world = required("play/local-world.mjs");
const initialCoreGzip = app.gzip + cosmeticPreloadBootstrap.gzip + styles.gzip + simpleStyles.gzip + cosmicStyles.gzip + epicHomeStyles.gzip
  + cosmeticsStyles.gzip + masteryCatalog.gzip + defaultProfile.gzip + initialAppState.gzip
  + cosmeticCatalog.gzip + cosmeticEconomy.gzip + victoryHandoff.gzip + world.gzip;
const circuitBytes = circuitRuntime.bytes + circuitDomain.bytes + starPathDomain.bytes + circuitLiveOps.bytes + circuitCopy.bytes + circuitLobbyTabs.bytes;
const circuitSurfaceBytes = circuitBytes + circuitStyles.bytes;
const observatoryRuntimeBytes = observatoryRuntime.bytes + cosmeticPreviewRuntime.bytes;
const observatoryStylesBytes = observatoryStyles.bytes + cosmeticPreviewStyles.bytes;
const observatorySurfaceBytes = observatoryRuntimeBytes + observatoryStylesBytes;
const stardustSurfaceBytes = stardustStyles.bytes + stardustDomain.bytes + stardustRuntime.bytes;
const secondarySurfaceRecords = SECONDARY_SURFACE_FILES
  .filter((path) => !SCRAMBLE_SURFACE_FILES.has(path) && path !== "cosmic-interlude.css")
  .map((path) => required(`play/${path}`));
const secondarySurfaceBytes = secondarySurfaceRecords.reduce((sum, record) => sum + record.bytes, 0);
const scrambleSurfaceBytes = [...SCRAMBLE_SURFACE_FILES]
  .map((path) => required(`play/${path}`))
  .reduce((sum, record) => sum + record.bytes, 0);
const totalBytes = records.reduce((sum, record) => sum + record.bytes, 0);
const runtimeArt = records.filter((record) => record.path.startsWith("play/art/"));
const runtimeAudio = records.filter((record) => record.path.startsWith("play/audio/"));
const storyPack = STORY_PACK_PATHS.map(required);
const storyPackBytes = storyPack.reduce((sum, record) => sum + record.bytes, 0);
const goldenPairPack = GOLDEN_PAIR_PACK_PATHS.map(required);
const goldenPairPackBytes = goldenPairPack.reduce((sum, record) => sum + record.bytes, 0);
const cinematicPack = records.filter((record) => record.path.startsWith("play/cinematic/"));
const cinematicPackBytes = cinematicPack.reduce((sum, record) => sum + record.bytes, 0);
const cosmeticArt = runtimeArt.filter((record) => record.path.startsWith("play/art/cosmetics/"));
const baseRuntimeArt = runtimeArt.filter((record) => !record.path.startsWith("play/art/cosmetics/"));
const baseRuntimeArtBytes = baseRuntimeArt.reduce((sum, record) => sum + record.bytes, 0);
const baseArtifactBytes = records
  .filter((record) => (
    !record.path.startsWith("play/art/cosmetics/")
    && !record.path.startsWith("play/audio/")
    && !record.path.startsWith("play/story/")
    && !record.path.startsWith("play/cinematic/")
    && !SECONDARY_SURFACE_FILES.some((path) => record.path === `play/${path}`)
  ))
  .reduce((sum, record) => sum + record.bytes, 0);
const rankArt = baseRuntimeArt.filter((record) => record.path.startsWith("play/art/ranks/"));
const transitionArt = baseRuntimeArt.filter((record) => record.path.startsWith("play/art/transitions/"));
const homeArt = baseRuntimeArt.filter((record) => record.path.startsWith("play/art/home/"));
const shellArt = baseRuntimeArt.filter((record) => (
  !record.path.startsWith("play/art/ranks/")
  && !record.path.startsWith("play/art/transitions/")
  && !record.path.startsWith("play/art/home/")
));
const shellArtBytes = shellArt.reduce((sum, record) => sum + record.bytes, 0);
const maximumRankArtBytes = Math.max(0, ...rankArt.map((record) => record.bytes));
const maximumTransitionArtBytes = Math.max(0, ...transitionArt.map((record) => record.bytes));
const maximumHomeArtBytes = Math.max(0, ...homeArt.map((record) => record.bytes));
const initialArtCeiling = shellArtBytes + maximumRankArtBytes + maximumTransitionArtBytes + maximumHomeArtBytes;

assert.ok(app.bytes <= CORE_APP_MAXIMUM_BYTES, `v5 app.js exceeded its intentional ${CORE_APP_MAXIMUM_BYTES / 1_000} KB shell ceiling (${app.bytes} bytes). Split new systems into focused modules.`);
assert.ok(cosmeticPreloadBootstrap.bytes <= 8_000, `cosmetic-preload-bootstrap.js exceeded 8 KB (${cosmeticPreloadBootstrap.bytes} bytes). Keep the parser-blocking bootstrap small.`);
assert.ok(
  styles.bytes + simpleStyles.bytes <= CORE_GAME_CSS_MAXIMUM_BYTES,
  `Game CSS exceeded ${CORE_GAME_CSS_MAXIMUM_BYTES / 1_000} KB (${styles.bytes + simpleStyles.bytes} bytes).`
);
assert.ok(
  cosmicStyles.bytes + epicHomeStyles.bytes <= CINEMATIC_CSS_MAXIMUM_BYTES,
  `Cinematic CSS exceeded ${CINEMATIC_CSS_MAXIMUM_BYTES / 1_000} KB (${cosmicStyles.bytes + epicHomeStyles.bytes} bytes).`
);
assert.ok(cosmeticsStyles.bytes <= CORE_COSMETICS_CSS_MAXIMUM_BYTES, `Core cosmetics CSS exceeded 60 KB (${cosmeticsStyles.bytes} bytes).`);
assert.ok(
  observatoryStylesBytes <= OBSERVATORY_CSS_MAXIMUM_BYTES,
  `Lazy Observatory CSS exceeded ${OBSERVATORY_CSS_MAXIMUM_BYTES / 1_000} KB (${observatoryStylesBytes} bytes).`
);
assert.ok(circuitStyles.bytes <= CIRCUIT_CSS_MAXIMUM_BYTES, `Cosmos Circuit CSS exceeded 32 KB (${circuitStyles.bytes} bytes).`);
assert.ok(
  cosmicInterludeStyles.bytes <= COSMIC_INTERLUDE_CSS_MAXIMUM_BYTES,
  `Lazy Cosmic Interlude CSS exceeded ${COSMIC_INTERLUDE_CSS_MAXIMUM_BYTES / 1_000} KB (${cosmicInterludeStyles.bytes} bytes).`
);
// Circuit and the Observatory are deliberate secondary surfaces. They do not
// enter the install shell or initial transfer, but their complete source still
// has a bounded optional-pack budget.
assert.ok(circuitBytes <= CIRCUIT_PACK_MAXIMUM_BYTES, `Cosmos Circuit and Star Path JS exceeded 235 KB (${circuitBytes} bytes).`);
assert.ok(circuitSurfaceBytes <= CIRCUIT_SURFACE_MAXIMUM_BYTES, `Complete Circuit surface exceeded 265 KB (${circuitSurfaceBytes} bytes).`);
assert.ok(
  observatoryRuntimeBytes <= OBSERVATORY_RUNTIME_MAXIMUM_BYTES,
  `Lazy Observatory runtime exceeded ${OBSERVATORY_RUNTIME_MAXIMUM_BYTES / 1_000} KB (${observatoryRuntimeBytes} bytes).`
);
assert.ok(
  observatorySurfaceBytes <= OBSERVATORY_SURFACE_MAXIMUM_BYTES,
  `Complete Observatory surface exceeded ${OBSERVATORY_SURFACE_MAXIMUM_BYTES / 1_000} KB (${observatorySurfaceBytes} bytes).`
);
assert.ok(stardustSurfaceBytes <= STARDUST_SURFACE_MAXIMUM_BYTES, `Complete Stardust surface exceeded 13 KB (${stardustSurfaceBytes} bytes).`);
assert.ok(
  secondarySurfaceBytes <= SECONDARY_SURFACE_MAXIMUM_BYTES,
  `Secondary surfaces exceeded ${SECONDARY_SURFACE_MAXIMUM_BYTES / 1_000} KB (${secondarySurfaceBytes} bytes).`
);
assert.ok(
  scrambleSurfaceBytes <= SCRAMBLE_SURFACE_MAXIMUM_BYTES,
  `Lazy Scramble Arena surface exceeded ${SCRAMBLE_SURFACE_MAXIMUM_BYTES / 1_000} KB (${scrambleSurfaceBytes} bytes).`
);
assert.ok(world.bytes <= 450_000, `local-world.mjs exceeded 450 KB (${world.bytes} bytes). Use the sparse graph payload.`);
assert.ok(
  rankArt.every((record) => (
    record.path.endsWith("-sm.webp") ? record.bytes <= 50_000
      : record.path.endsWith("-md.webp") ? record.bytes <= 140_000
        : record.path.endsWith("-lg.webp") ? record.bytes <= 320_000
          : false
  )),
  "A responsive rank-art asset exceeded its device-class budget."
);
assert.ok(rankArt.length === 18, `Expected 18 responsive rank-art assets; found ${rankArt.length}.`);
assert.equal(transitionArt.length, COSMIC_GATE_ASSETS.length, `Expected ${COSMIC_GATE_ASSETS.length} responsive cinematic transition assets; found ${transitionArt.length}.`);
for (const asset of COSMIC_GATE_ASSETS) {
  const record = byPath.get(`play/${asset.path}`);
  assert.ok(record, `${asset.path} is missing from the cinematic art budget.`);
  assert.ok(record.bytes <= asset.maximumBytes, `${asset.path} exceeded ${asset.maximumBytes} bytes (${record.bytes} bytes).`);
}
assert.equal(homeArt.length, HOME_COSMOS_ASSETS.length, `Expected ${HOME_COSMOS_ASSETS.length} responsive home-cosmos assets; found ${homeArt.length}.`);
for (const asset of HOME_COSMOS_ASSETS) {
  const record = byPath.get(`play/${asset.path}`);
  assert.ok(record, `${asset.path} is missing from the home art budget.`);
  assert.ok(record.bytes <= asset.maximumBytes, `${asset.path} exceeded ${asset.maximumBytes} bytes (${record.bytes} bytes).`);
}
assert.equal(
  cosmeticArt.length,
  COSMETIC_PACKS.reduce((sum, pack) => sum + pack.assets.length, 0),
  "The Pages build has an unexpected number of on-demand cosmetic assets."
);
const cosmeticPackBytes = [];
for (const pack of COSMETIC_PACKS) {
  let bytes = 0;
  for (const asset of pack.assets) {
    const record = byPath.get(`play/${asset.path}`);
    assert.ok(record, `${asset.path} is missing from the optional cosmetic-pack budget.`);
    assert.ok(record.bytes <= asset.maximumBytes, `${asset.path} exceeded ${asset.maximumBytes} bytes (${record.bytes} bytes).`);
    bytes += record.bytes;
  }
  assert.ok(bytes <= pack.maximumBytes, `${pack.slug} exceeded its ${pack.maximumBytes}-byte optional-pack budget (${bytes} bytes).`);
  cosmeticPackBytes.push(`${pack.slug} ${bytes} B`);
}
assert.equal(
  runtimeAudio.length,
  AUDIO_PACKS.reduce((sum, pack) => sum + pack.assets.length, 0),
  "The Pages build has an unexpected number of on-demand audio assets."
);
const audioPackBytes = [];
for (const pack of AUDIO_PACKS) {
  let bytes = 0;
  for (const asset of pack.assets) {
    const record = byPath.get(`play/${asset.path}`);
    assert.ok(record, `${asset.path} is missing from the optional audio-pack budget.`);
    assert.ok(record.bytes <= asset.maximumBytes, `${asset.path} exceeded ${asset.maximumBytes} bytes (${record.bytes} bytes).`);
    bytes += record.bytes;
  }
  assert.ok(bytes <= pack.maximumBytes, `${pack.slug} exceeded its ${pack.maximumBytes}-byte optional audio-pack budget (${bytes} bytes).`);
  audioPackBytes.push(`${pack.slug} ${bytes} B`);
}
assert.ok(baseRuntimeArtBytes <= 6_000_000, `Base packaged runtime art exceeded 6 MB (${baseRuntimeArtBytes} bytes).`);
assert.ok(initialArtCeiling <= 2_250_000, `Worst-case responsive first-view art exceeded 2.25 MB (${initialArtCeiling} bytes).`);
assert.ok(initialCoreGzip <= 325_000, `Core game transfer exceeded the 325 KB gzip budget (${initialCoreGzip} bytes).`);
assert.ok(storyPackBytes <= STORY_PACK_MAXIMUM_BYTES, `Combination Story exceeded its 40 KB optional-pack budget (${storyPackBytes} bytes).`);
assert.ok(goldenPairPackBytes <= GOLDEN_PAIR_PACK_MAXIMUM_BYTES, `Golden Pair animations exceeded their 56 KB optional-pack budget (${goldenPairPackBytes} bytes).`);
assert.ok(cinematicPackBytes <= CINEMATIC_PACK_MAXIMUM_BYTES, `Launch cinematic exceeded its 11 MB optional-pack budget (${cinematicPackBytes} bytes).`);
// The complete Circuit, Star Path, Crazy Path, accessibility, and manual-backup
// surfaces remain inside this measured package boundary. Keep the
// transfer-sensitive core gzip and per-asset ceilings unchanged.
// Outcome locking and the cancellable victory-presentation barrier are core
// integrity code, while the one-time journey itself remains in the lazy pack.
assert.ok(baseArtifactBytes <= BASE_ARTIFACT_MAXIMUM_BYTES, `Base Pages artifact exceeded 8.715 MB (${baseArtifactBytes} bytes).`);
assert.ok(
  totalBytes <= BASE_ARTIFACT_MAXIMUM_BYTES
    + COSMETIC_PACKS.reduce((sum, pack) => sum + pack.maximumBytes, 0)
    + AUDIO_PACKS.reduce((sum, pack) => sum + pack.maximumBytes, 0)
    + STORY_PACK_MAXIMUM_BYTES
    + GOLDEN_PAIR_PACK_MAXIMUM_BYTES
    + CINEMATIC_PACK_MAXIMUM_BYTES
    + SECONDARY_SURFACE_MAXIMUM_BYTES
    + SCRAMBLE_SURFACE_MAXIMUM_BYTES
    + COSMIC_INTERLUDE_CSS_MAXIMUM_BYTES,
  `Pages artifact exceeded the base plus declared optional-pack budgets (${totalBytes} bytes).`
);

console.log(`Performance budget passed: app ${app.bytes} B, preload bootstrap ${cosmeticPreloadBootstrap.bytes} B, CSS ${styles.bytes + simpleStyles.bytes + cosmicStyles.bytes + epicHomeStyles.bytes + cosmeticsStyles.bytes} B, Cosmic Interlude ${cosmicInterludeStyles.bytes} B, Circuit ${circuitBytes} B, secondary surfaces ${secondarySurfaceBytes} B, Scramble ${scrambleSurfaceBytes} B, world ${world.bytes} B, core gzip ${initialCoreGzip} B, first-view art <= ${initialArtCeiling} B, base artifact ${baseArtifactBytes} B, story pack ${storyPackBytes} B, Golden Pairs ${goldenPairPackBytes} B, cinematic pack ${cinematicPackBytes} B, cosmetic packs ${cosmeticPackBytes.join(", ")}, audio packs ${audioPackBytes.join(", ")}, total ${totalBytes} B.`);
