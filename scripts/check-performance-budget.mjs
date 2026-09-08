import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { COSMETIC_PACKS } from "./cosmetic-assets.mjs";
import { AUDIO_PACKS } from "./audio-assets.mjs";
import { COSMIC_GATE_ASSETS } from "./cosmic-gate-assets.mjs";
import { HOME_COSMOS_ASSETS } from "./home-cosmos-assets.mjs";
import {
  COMBINING_BOARD_CORE_FILES,
  COMBINING_BOARD_LAZY_FILES,
  PLAY_ON_DEMAND_FILES,
  SECONDARY_SURFACE_FILES,
  VOYAGE_PROJECTION_LAZY_FILES
} from "../public/secondary-surface-loader.mjs";
import {
  isPlanetHubRuntimeFile,
  PLANET_HUB_ASSET_PATHS,
  PLANET_HUB_OPTIONAL_MODULE_FILES,
  PLANET_HUB_RELEASE_STYLE_FILES
} from "./planet-hub-packaging.mjs";
import { THREE_VENDOR_FILES } from "./sync-planet-hub-vendor.mjs";

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
const PLANET_HUB_GENERATED_PACK_MAXIMUM_BYTES = 12 * 1024 * 1024;
const PLANET_HUB_RUNTIME_GZIP_MAXIMUM_BYTES = 225 * 1024;
const PLANET_HUB_OPTIONAL_PACK_MAXIMUM_BYTES = 13 * 1024 * 1024;
const PLANET_HUB_CSS_MAXIMUM_BYTES = 48_000;
const planetHubAssetRecords = PLANET_HUB_ASSET_PATHS.map((path) => required(`play/${path}`));
const planetHubRuntimeRecords = records.filter((record) => (
  isPlanetHubRuntimeFile(record.path)
  || THREE_VENDOR_FILES.some((path) => record.path === `play/${path}`)
));
const planetHubStyles = required("play/planet-hub.css");
const planetHubOptionalModuleRecords = PLANET_HUB_OPTIONAL_MODULE_FILES
  .map((path) => required(`play/${path}`));
const planetHubCinematicStyles = PLANET_HUB_RELEASE_STYLE_FILES
  .map((path) => required(`play/${path}`));
const planetHubCinematicStyleBytes = planetHubCinematicStyles
  .reduce((sum, record) => sum + record.bytes, 0);
const planetHubAssetBytes = planetHubAssetRecords.reduce((sum, record) => sum + record.bytes, 0);
const planetHubRuntimeBytes = planetHubRuntimeRecords.reduce((sum, record) => sum + record.bytes, 0);
const planetHubRuntimeGzip = planetHubRuntimeRecords.filter((record) => /[.]m?js$/i.test(record.path)).reduce((sum, record) => sum + record.gzip, 0);
const planetHubOptionalModuleBytes = planetHubOptionalModuleRecords.reduce((sum, record) => sum + record.bytes, 0);
const planetHubOptionalBytes = planetHubAssetBytes
  + planetHubRuntimeBytes
  + planetHubOptionalModuleBytes
  + planetHubStyles.bytes
  + planetHubCinematicStyleBytes;
const isPlanetHubPackagePath = (path) => (
  path.startsWith("play/art/planet-hub/")
  || path.startsWith("play/vendor/three/")
  || PLANET_HUB_OPTIONAL_MODULE_FILES.some((name) => path === `play/${name}`)
  || /^play\/planet-hub(?:-[a-z0-9-]+)?[.](?:css|mjs)$/i.test(path)
);
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
const BIRTHDAY_VOYAGE_VIDEO_PATHS = [
  "play/cinematic/lion-intro-birthday.mp4"
];
const BIRTHDAY_VOYAGE_VIDEO_PACK_MAXIMUM_BYTES = 4_000_000;
const BIRTHDAY_VOYAGE_ROOT_PATHS = new Set([
  "play/birthday-voyage.mjs",
  "play/birthday-voyage-audio.mjs",
  "play/birthday-voyage-config.mjs",
  "play/birthday-voyage-personal-media.mjs",
  "play/birthday-voyage.css"
]);
const BIRTHDAY_VOYAGE_PACK_MAXIMUM_BYTES = 10_000_000;

function isBirthdayVoyagePath(path) {
  return BIRTHDAY_VOYAGE_ROOT_PATHS.has(path)
    || path.startsWith("play/art/birthday-voyage/")
    || path.startsWith("play/cinematic/birthday-voyage/")
    || BIRTHDAY_VOYAGE_VIDEO_PATHS.includes(path);
}
const PROFILE_FRAME_PREVIEW_VIDEO_PATHS = [
  "play/cinematic/profile-frame-previews/empyrean-ascension.mp4",
  "play/cinematic/profile-frame-previews/infernal-dominion.mp4"
];
const PROFILE_FRAME_PREVIEW_VIDEO_PACK_MAXIMUM_BYTES = 13_000_000;
const PROFILE_FRAME_PACK_MAXIMUM_BYTES = 24_000_000;
// The Observatory board is a permanent direct-manipulation surface, so its
// complete renderer/domain/CSS cost is bounded as part of the install shell.
const COMBINING_BOARD_PACK_MAXIMUM_BYTES = 75_000;
// Voyage Projection is a deterministic optional cinematic. Its complete
// domain/runtime/scene/experience pack stays lazy and has its own ceiling.
// Final lifecycle hardening measures 107.8 KB; retain about 2.2 KB of raw
// headroom without charging any of the cinematic to the initial shell.
const VOYAGE_PROJECTION_PACK_MAXIMUM_BYTES = 110_000;
// v5 keeps rendering, semantic grouping, Voyage choreography, live-duel, and
// mobile-chrome state machines in focused modules. app.js retains the measured
// host glue that coordinates those systems with gameplay, session recovery,
// Arena, and Moon projects. Async Observatory activation measures 506.9 KB;
// preserve roughly 1 KB of raw headroom and the aggregate gzip cap below.
const CORE_APP_MAXIMUM_BYTES = 508_000;
// Base game and desktop UI styles stay bounded independently from the focused
// mobile and Concept Chemistry presentation modules below.
const CORE_GAME_CSS_MAXIMUM_BYTES = 320_000;
const MOBILE_PLAY_SHELL_CSS_MAXIMUM_BYTES = 43_000;
const CONCEPT_CHEMISTRY_CSS_MAXIMUM_BYTES = 7_000;
const CONCEPT_MATTER_CSS_MAXIMUM_BYTES = 13_000;
const MOLECULAR_MEMORY_CSS_MAXIMUM_BYTES = 10_000;
// Browse facets add the responsive category constellation, count badges, and
// reduced-motion handoffs. The minified stylesheet measures 21.1 KB; keep the
// dedicated one-thumb shell below a narrow 22 KB ceiling.
const WORD_ORBIT_CSS_MAXIMUM_BYTES = 22_000;
const WORD_ORBIT_MOTION_CSS_MAXIMUM_BYTES = 8_000;
// Preserve the pre-chemistry install-shell ceiling, then account for the
// first-reaction interaction explicitly. Bloom input/motion, Concept Bond,
// and Molecular Memory must be ready before a player's first guided fusion;
// their individual raw ceilings below keep this allowance from masking growth
// elsewhere. Board scenes, project workspaces, and cinematic packs stay lazy.
const INITIAL_CORE_GZIP_BASE_MAXIMUM_BYTES = 363_000;
const CONCEPT_CHEMISTRY_CORE_GZIP_ALLOWANCE_BYTES = 45_000;
// Concept Matter adds the inspectable recipe graph and its board interaction
// bridge to the eager play shell. Keep its measured transfer cost visible and
// independently bounded rather than absorbing it into Concept Chemistry.
const CONCEPT_MATTER_CORE_GZIP_ALLOWANCE_BYTES = 16_000;
const INITIAL_CORE_GZIP_MAXIMUM_BYTES = INITIAL_CORE_GZIP_BASE_MAXIMUM_BYTES
  + CONCEPT_CHEMISTRY_CORE_GZIP_ALLOWANCE_BYTES
  + CONCEPT_MATTER_CORE_GZIP_ALLOWANCE_BYTES;
const CONCEPT_CHEMISTRY_CORE_PACK_MAXIMUM_BYTES = 158_000;
const CONCEPT_CHEMISTRY_CORE_PACK_GZIP_MAXIMUM_BYTES = 42_000;
const CONCEPT_MATTER_CORE_PACK_MAXIMUM_BYTES = 74_000;
const CONCEPT_MATTER_CORE_PACK_GZIP_MAXIMUM_BYTES = 21_000;
// Constellation Bloom replaces the permanent mobile shelf with a bounded,
// edge-aware radial category and word selector while reusing the existing
// fusion bridge. The authored, offline semantic taxonomy is part of that core
// interaction rather than an optional pack. Scoped in-group search, its live
// result feedback, and the authored facet catalog bring the four modules to
// 60.2 KB; keep them under a narrow explicit ceiling instead of hiding growth
// in app.js.
const WORD_ORBIT_RUNTIME_MAXIMUM_BYTES = 61_000;
const WORD_BLOOM_INPUT_RUNTIME_MAXIMUM_BYTES = 9_500;
// The three-scene Orbit Home now owns its mobile stacked and short-landscape
// compositions as well as the desktop observatory, Forge sheet, and reduced-
// motion states. The measured minified pair is 117.1 KB; keep under 118 KB while
// the stricter aggregate transfer ceiling below continues to govern shipped weight.
const CINEMATIC_CSS_MAXIMUM_BYTES = 118_000;
// Preserve the pre-chemistry 9.41 MB artifact ceiling and expose the complete
// Concept Chemistry/Bloom source allowance separately. Board scenes and Voyage
// Projection remain excluded here and are governed by dedicated pack limits.
const BASE_ARTIFACT_PRE_CHEMISTRY_MAXIMUM_BYTES = 9_410_000;
const CONCEPT_CHEMISTRY_BASE_ARTIFACT_ALLOWANCE_BYTES = 150_000;
const CONCEPT_MATTER_BASE_ARTIFACT_ALLOWANCE_BYTES = 60_000;
const BASE_ARTIFACT_MAXIMUM_BYTES = BASE_ARTIFACT_PRE_CHEMISTRY_MAXIMUM_BYTES
  + CONCEPT_CHEMISTRY_BASE_ARTIFACT_ALLOWANCE_BYTES
  + CONCEPT_MATTER_BASE_ARTIFACT_ALLOWANCE_BYTES;
const CIRCUIT_PACK_MAXIMUM_BYTES = 235_000;
const CIRCUIT_SURFACE_MAXIMUM_BYTES = 265_000;
// The immersive collection preview and independent Arena frame browser add
// focused, keyboard-accessible presentation surfaces while gameplay stays
// locked. Its measured complete surface is 253.2 KB after the dedicated phone
// and short-landscape Lab pass. Bound runtime, core CSS, full-page layout, and
// frame styling separately so this cannot become an open-ended allowance.
const OBSERVATORY_RUNTIME_MAXIMUM_BYTES = 139_000;
const OBSERVATORY_SURFACE_MAXIMUM_BYTES = 254_000;
const STARDUST_SURFACE_MAXIMUM_BYTES = 26_000;
// The same bounded immersive-preview runtime is part of the aggregate optional
// surface inventory. The responsive Lab brings the measured optional inventory
// to 585.9 KB; preserve only a small cross-surface margin above it.
const SECONDARY_SURFACE_MAXIMUM_BYTES = 587_000;
// The first Moon chapter is a self-contained, lazy experiment. Its responsive
// Scene/Weave shell measures 89.0 KB after minification. Measure it independently
// so the project cannot silently consume the shared secondary-surface allowance.
const MOON_WORLDWEAVING_SURFACE_MAXIMUM_BYTES = 90_000;
const MOON_WORLDWEAVING_SURFACE_FILES = new Set([
  "moon-worldweaving.css",
  "moon-worldweaving-runtime.mjs",
  "moon-result-presentation.mjs"
]);
// The Outpost is opened only after the Moon weave is complete. Keep its large
// responsive presentation and rocket art outside the install shell while the
// profile/economy domains needed to recognize that unlock stay in core.
// Presentation-only structure, cache, receipt, and message projection moved
// here from the eager controller to preserve the stricter core transfer cap. The
// measured responsive Scene/Console presentation is 141.2 KB after minification.
const MOON_OUTPOST_SURFACE_MAXIMUM_BYTES = 142_000;
const MOON_OUTPOST_ART_MAXIMUM_BYTES = 400_000;
const MOON_OUTPOST_PACK_MAXIMUM_BYTES = 520_000;
const MOON_OUTPOST_SURFACE_FILES = new Set([
  "moon-outpost.css",
  "moon-outpost-runtime.mjs",
  "moon-outpost-presentation.mjs",
  "moon-outpost-actions.mjs"
]);
// The launch pack owns the responsive planetary Home scene plus the tiny lazy
// black-fade bridge into Moon. The complete vehicle flight now lives in the 3D
// hub renderer; no duplicate film, fallback rocket, or media player is loaded.
const MOON_PROJECT_FLIGHT_MAXIMUM_BYTES = 34_000;
const MOON_PROJECT_FLIGHT_FILES = new Set([
  "moon-project-flight.css",
  "moon-home-project-entry.mjs",
  "moon-project-launch.mjs"
]);
// The Heart is a separate, on-demand Project workspace opened from the
// Outpost. Its authored presentation must remain outside both the eager shell
// and the shared secondary-surface allowance, with its own narrow prototype
// budget so future chapters cannot grow unnoticed.
// The lazy pack owns domain-to-dossier adaptation, responsive Scene/Project
// composition, authored copy, and its thin action bridge; strict evidence and
// merge authority stays in the eager domain. The measured pack is 89.7 KB.
const MOON_HEART_SURFACE_MAXIMUM_BYTES = 90_000;
const MOON_HEART_SURFACE_FILES = new Set([
  "moon-heart-project.css",
  "moon-heart-project-runtime.mjs",
  "moon-heart-project-presentation.mjs",
  "moon-heart-actions.mjs"
]);
const MOON_OUTPOST_PNG_PATHS = [
  "play/art/moon-outpost/rocket-core-v1.png"
];
// v5 Arena includes the authoritative multi-chapter Saga UI, shared league
// presentation, four mode environments, the compact mode carousel, contextual
// queue tabs, and its isolated app bridge. The measured 224.3 KB pack remains
// lazy and outside the install shell.
const SCRAMBLE_SURFACE_MAXIMUM_BYTES = 225_000;
const SCRAMBLE_SURFACE_FILES = new Set([
  "scramble.css",
  "scramble-runtime.mjs",
  "scramble-app-bridge.mjs",
  "scramble.mjs",
  "scramble-arena.mjs",
  "forge-clash.mjs"
]);
const CORE_COSMETICS_CSS_MAXIMUM_BYTES = 60_000;
const OBSERVATORY_CSS_MAXIMUM_BYTES = 79_000;
// The Lab is a true full-page workspace at desktop, portrait phone, and extreme
// landscape sizes. Its measured minified layout is 28.2 KB; retain a narrow cap
// rather than charging those responsive rules to the shared cosmetics surface.
const OBSERVATORY_FULL_PAGE_CSS_MAXIMUM_BYTES = 29_000;
const PROFILE_FRAME_CSS_MAXIMUM_BYTES = 10_000;
const CIRCUIT_CSS_MAXIMUM_BYTES = 32_000;
const COSMIC_INTERLUDE_CSS_MAXIMUM_BYTES = 12_000;
for (const path of CINEMATIC_PACK_PATHS) required(path);
for (const path of BIRTHDAY_VOYAGE_VIDEO_PATHS) required(path);
for (const path of BIRTHDAY_VOYAGE_ROOT_PATHS) required(path);
for (const path of PROFILE_FRAME_PREVIEW_VIDEO_PATHS) required(path);
for (const path of SECONDARY_SURFACE_FILES) required(`play/${path}`);
const combiningBoardCoreRecords = COMBINING_BOARD_CORE_FILES.map((path) => required(`play/${path}`));
const combiningBoardLazyRecords = COMBINING_BOARD_LAZY_FILES.map((path) => required(`play/${path}`));
const combiningBoardRecords = [...combiningBoardCoreRecords, ...combiningBoardLazyRecords];
const voyageProjectionRecords = VOYAGE_PROJECTION_LAZY_FILES.map((path) => required(`play/${path}`));
for (const path of MOON_OUTPOST_SURFACE_FILES) required(`play/${path}`);
for (const path of MOON_PROJECT_FLIGHT_FILES) required(`play/${path}`);
for (const path of MOON_OUTPOST_PNG_PATHS) required(path);

const app = required("play/app.js");
const cosmeticPreloadBootstrap = required("play/cosmetic-preload-bootstrap.js");
const uiFoundationStyles = required("play/ui-foundation.css");
const manropeFont = required("play/fonts/Manrope-Variable.ttf");
const dmMonoFont = required("play/fonts/DMMono-Medium.ttf");
const styles = required("play/styles.css");
const simpleStyles = required("play/simple-ui.css");
const mobilePlayShellStyles = required("play/mobile-play-shell.css");
const conceptChemistryStyles = required("play/concept-chemistry.css");
const conceptMatterStyles = required("play/concept-matter.css");
const molecularMemoryStyles = required("play/molecular-memory.css");
const wordOrbitStyles = required("play/word-orbit.css");
const wordOrbitMotionStyles = required("play/word-orbit-motion.css");
const cosmicStyles = required("play/cosmic-gate.css");
const epicHomeStyles = required("play/epic-home.css");
const cosmeticsStyles = required("play/cosmetics.css");
const observatoryStyles = required("play/cosmetics-observatory.css");
const observatoryFullPageStyles = required("play/cosmetics-observatory-full-page.css");
const profileFrameStyles = required("play/profile-rank-frame.css");
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
const worldweavingDomain = required("play/worldweaving.mjs");
const moonWorldweavingController = required("play/moon-worldweaving-controller.mjs");
const expeditionDomain = required("play/expedition.mjs");
const moonHeartProjectDomain = required("play/moon-heart-project.mjs");
const moonOutpostDomain = required("play/moon-outpost.mjs");
const salvageCacheDomain = required("play/salvage-cache.mjs");
const salvageCosmeticsDomain = required("play/salvage-cosmetics.mjs");
const wordOrbitDomain = required("play/word-orbit.mjs");
const wordOrbitRuntime = required("play/word-orbit-runtime.mjs");
const wordBloomView = required("play/word-bloom-view.mjs");
const wordSemanticFacets = required("play/word-semantic-facets.mjs");
const mobilePlayShellRuntime = required("play/mobile-play-shell-runtime.mjs");
const wordBloomInputRuntime = required("play/word-bloom-input-runtime.mjs");
const conceptChemistryDomain = required("play/concept-chemistry.mjs");
const conceptBondRuntime = required("play/concept-bond-runtime.mjs");
const guidedPlayApp = required("play/guided-play-app.mjs");
const conceptMatterDomain = required("play/concept-matter.mjs");
const conceptMatterRuntime = required("play/concept-matter-runtime.mjs");
const conceptMatterApp = required("play/concept-matter-app.mjs");
const molecularMemoryDomain = required("play/molecular-memory.mjs");
const molecularMemoryRuntime = required("play/molecular-memory-runtime.mjs");
const inventoryViewRuntime = required("play/inventory-view-runtime.mjs");
const powerupViewRuntime = required("play/powerup-view-runtime.mjs");
const victoryHandoff = required("play/victory-handoff.mjs");
const arenaRank = required("play/arena-rank.mjs");
const cosmeticCatalog = required("play/cosmetic-catalog.mjs");
const cosmeticEconomy = required("play/cosmetic-economy.mjs");
const world = required("play/local-world.mjs");
const combiningBoardBytes = combiningBoardRecords.reduce((sum, record) => sum + record.bytes, 0);
const combiningBoardCoreGzip = combiningBoardCoreRecords.reduce((sum, record) => sum + record.gzip, 0);
const voyageProjectionBytes = voyageProjectionRecords.reduce((sum, record) => sum + record.bytes, 0);
const conceptChemistryCoreRecords = [
  conceptChemistryDomain,
  conceptBondRuntime,
  guidedPlayApp,
  conceptChemistryStyles,
  molecularMemoryDomain,
  molecularMemoryRuntime,
  molecularMemoryStyles,
  wordBloomView,
  wordBloomInputRuntime,
  wordOrbitMotionStyles
];
const conceptChemistryCoreBytes = conceptChemistryCoreRecords.reduce((sum, record) => sum + record.bytes, 0);
const conceptChemistryCoreGzip = conceptChemistryCoreRecords.reduce((sum, record) => sum + record.gzip, 0);
const conceptMatterCoreRecords = [conceptMatterDomain, conceptMatterRuntime, conceptMatterApp, conceptMatterStyles];
const conceptMatterCoreBytes = conceptMatterCoreRecords.reduce((sum, record) => sum + record.bytes, 0);
const conceptMatterCoreGzip = conceptMatterCoreRecords.reduce((sum, record) => sum + record.gzip, 0);
const initialCoreGzip = app.gzip + cosmeticPreloadBootstrap.gzip + uiFoundationStyles.gzip + styles.gzip + simpleStyles.gzip
  + mobilePlayShellStyles.gzip + conceptChemistryStyles.gzip + conceptMatterStyles.gzip + molecularMemoryStyles.gzip
  + wordOrbitStyles.gzip + wordOrbitMotionStyles.gzip + cosmicStyles.gzip + epicHomeStyles.gzip + planetHubStyles.gzip
  + cosmeticsStyles.gzip + masteryCatalog.gzip + defaultProfile.gzip + initialAppState.gzip
  + wordOrbitDomain.gzip + wordOrbitRuntime.gzip + wordBloomView.gzip + wordSemanticFacets.gzip + mobilePlayShellRuntime.gzip
  + wordBloomInputRuntime.gzip
  + conceptChemistryDomain.gzip + conceptBondRuntime.gzip + guidedPlayApp.gzip
  + molecularMemoryDomain.gzip + molecularMemoryRuntime.gzip
  + inventoryViewRuntime.gzip + powerupViewRuntime.gzip
  + worldweavingDomain.gzip + moonWorldweavingController.gzip
  + expeditionDomain.gzip + moonHeartProjectDomain.gzip + moonOutpostDomain.gzip + salvageCacheDomain.gzip + salvageCosmeticsDomain.gzip
  + cosmeticCatalog.gzip + cosmeticEconomy.gzip + victoryHandoff.gzip + arenaRank.gzip + world.gzip
  + combiningBoardCoreGzip;
const circuitBytes = circuitRuntime.bytes + circuitDomain.bytes + starPathDomain.bytes + circuitLiveOps.bytes + circuitCopy.bytes + circuitLobbyTabs.bytes;
const interfaceFontBytes = manropeFont.bytes + dmMonoFont.bytes;
const circuitSurfaceBytes = circuitBytes + circuitStyles.bytes;
const observatoryRuntimeBytes = observatoryRuntime.bytes + cosmeticPreviewRuntime.bytes;
const observatoryStylesBytes = observatoryStyles.bytes + cosmeticPreviewStyles.bytes;
const observatoryEnhancementStylesBytes = observatoryFullPageStyles.bytes + profileFrameStyles.bytes;
const observatorySurfaceBytes = observatoryRuntimeBytes + observatoryStylesBytes + observatoryEnhancementStylesBytes;
const stardustSurfaceBytes = stardustStyles.bytes + stardustDomain.bytes + stardustRuntime.bytes;
const secondarySurfaceRecords = SECONDARY_SURFACE_FILES
  .filter((path) => !SCRAMBLE_SURFACE_FILES.has(path)
    && !MOON_WORLDWEAVING_SURFACE_FILES.has(path)
    && !MOON_OUTPOST_SURFACE_FILES.has(path)
    && !MOON_PROJECT_FLIGHT_FILES.has(path)
    && !MOON_HEART_SURFACE_FILES.has(path)
    && !COMBINING_BOARD_LAZY_FILES.includes(path)
    && !VOYAGE_PROJECTION_LAZY_FILES.includes(path)
    && path !== "cosmic-interlude.css")
  .map((path) => required(`play/${path}`));
const secondarySurfaceBytes = secondarySurfaceRecords.reduce((sum, record) => sum + record.bytes, 0);
const moonWorldweavingSurfaceBytes = [...MOON_WORLDWEAVING_SURFACE_FILES]
  .map((path) => required(`play/${path}`))
  .reduce((sum, record) => sum + record.bytes, 0);
const moonOutpostSurfaceBytes = [...MOON_OUTPOST_SURFACE_FILES]
  .map((path) => required(`play/${path}`))
  .reduce((sum, record) => sum + record.bytes, 0);
const moonProjectFlightBytes = [...MOON_PROJECT_FLIGHT_FILES]
  .map((path) => required(`play/${path}`))
  .reduce((sum, record) => sum + record.bytes, 0);
const moonHeartSurfaceBytes = [...MOON_HEART_SURFACE_FILES]
  .map((path) => required(`play/${path}`))
  .reduce((sum, record) => sum + record.bytes, 0);
const moonOutpostArt = records.filter((record) => record.path.startsWith("play/art/moon-outpost/"));
const moonOutpostArtBytes = moonOutpostArt.reduce((sum, record) => sum + record.bytes, 0);
const moonOutpostPackBytes = moonOutpostSurfaceBytes + moonOutpostArtBytes;
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
const cinematicPack = CINEMATIC_PACK_PATHS.map(required);
const cinematicPackBytes = cinematicPack.reduce((sum, record) => sum + record.bytes, 0);
const birthdayVoyageVideoPack = BIRTHDAY_VOYAGE_VIDEO_PATHS.map(required);
const birthdayVoyageVideoPackBytes = birthdayVoyageVideoPack.reduce((sum, record) => sum + record.bytes, 0);
const birthdayVoyagePack = records.filter((record) => isBirthdayVoyagePath(record.path));
const birthdayVoyagePackBytes = birthdayVoyagePack.reduce((sum, record) => sum + record.bytes, 0);
const profileFramePreviewVideos = records
  .filter((record) => record.path.startsWith("play/cinematic/profile-frame-previews/"))
  .sort((left, right) => left.path.localeCompare(right.path, "en"));
assert.deepEqual(
  profileFramePreviewVideos.map((record) => record.path),
  [...PROFILE_FRAME_PREVIEW_VIDEO_PATHS].sort((left, right) => left.localeCompare(right, "en")),
  "The Pages build has an unexpected profile-frame preview video inventory."
);
const profileFramePreviewVideoPackBytes = profileFramePreviewVideos
  .reduce((sum, record) => sum + record.bytes, 0);
const cosmeticArt = runtimeArt.filter((record) => record.path.startsWith("play/art/cosmetics/"));
const profileFrameArt = runtimeArt.filter((record) => record.path.startsWith("play/art/profile-frames/"));
const profileFramePackBytes = profileFrameArt.reduce((sum, record) => sum + record.bytes, 0);
const baseRuntimeArt = runtimeArt.filter((record) => (
  !record.path.startsWith("play/art/cosmetics/")
  && !record.path.startsWith("play/art/profile-frames/")
  && !record.path.startsWith("play/art/birthday-voyage/")
  && !record.path.startsWith("play/art/moon-outpost/")
  && !record.path.startsWith("play/art/planet-hub/")
));
const baseRuntimeArtBytes = baseRuntimeArt.reduce((sum, record) => sum + record.bytes, 0);
const baseArtifactBytes = records
  .filter((record) => (
    !isPlanetHubPackagePath(record.path)
    &&
    !record.path.startsWith("play/art/cosmetics/")
    && !record.path.startsWith("play/art/profile-frames/")
    && !isBirthdayVoyagePath(record.path)
    && !record.path.startsWith("play/audio/")
    && !record.path.startsWith("play/story/")
    && !record.path.startsWith("play/cinematic/")
    && !record.path.startsWith("play/art/moon-outpost/")
    && !MOON_OUTPOST_SURFACE_FILES.has(record.path.replace(/^play\//, ""))
    && !MOON_PROJECT_FLIGHT_FILES.has(record.path.replace(/^play\//, ""))
    && !PLAY_ON_DEMAND_FILES.some((path) => record.path === `play/${path}`)
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
assert.ok(mobilePlayShellStyles.bytes <= MOBILE_PLAY_SHELL_CSS_MAXIMUM_BYTES, `Mobile play shell CSS exceeded ${MOBILE_PLAY_SHELL_CSS_MAXIMUM_BYTES / 1_000} KB (${mobilePlayShellStyles.bytes} bytes).`);
assert.ok(conceptChemistryStyles.bytes <= CONCEPT_CHEMISTRY_CSS_MAXIMUM_BYTES, `Concept Chemistry CSS exceeded ${CONCEPT_CHEMISTRY_CSS_MAXIMUM_BYTES / 1_000} KB (${conceptChemistryStyles.bytes} bytes).`);
assert.ok(conceptMatterStyles.bytes <= CONCEPT_MATTER_CSS_MAXIMUM_BYTES, `Concept Matter CSS exceeded ${CONCEPT_MATTER_CSS_MAXIMUM_BYTES / 1_000} KB (${conceptMatterStyles.bytes} bytes).`);
assert.ok(molecularMemoryStyles.bytes <= MOLECULAR_MEMORY_CSS_MAXIMUM_BYTES, `Molecular Memory CSS exceeded ${MOLECULAR_MEMORY_CSS_MAXIMUM_BYTES / 1_000} KB (${molecularMemoryStyles.bytes} bytes).`);
assert.ok(wordOrbitStyles.bytes <= WORD_ORBIT_CSS_MAXIMUM_BYTES, `Word Orbit CSS exceeded ${WORD_ORBIT_CSS_MAXIMUM_BYTES / 1_000} KB (${wordOrbitStyles.bytes} bytes). Keep the one-thumb shell focused.`);
assert.ok(wordOrbitMotionStyles.bytes <= WORD_ORBIT_MOTION_CSS_MAXIMUM_BYTES, `Word Orbit motion CSS exceeded ${WORD_ORBIT_MOTION_CSS_MAXIMUM_BYTES / 1_000} KB (${wordOrbitMotionStyles.bytes} bytes). Keep Bloom choreography focused.`);
assert.ok(wordOrbitDomain.bytes + wordOrbitRuntime.bytes + wordSemanticFacets.bytes + mobilePlayShellRuntime.bytes <= WORD_ORBIT_RUNTIME_MAXIMUM_BYTES, `Word Orbit runtime exceeded ${WORD_ORBIT_RUNTIME_MAXIMUM_BYTES / 1_000} KB. Keep ranking, semantic facets, Lens, and shell bindings focused.`);
assert.ok(wordBloomInputRuntime.bytes <= WORD_BLOOM_INPUT_RUNTIME_MAXIMUM_BYTES, `Bloom input runtime exceeded ${WORD_BLOOM_INPUT_RUNTIME_MAXIMUM_BYTES / 1_000} KB (${wordBloomInputRuntime.bytes} bytes). Keep gesture choreography focused.`);
assert.ok(
  conceptChemistryCoreBytes <= CONCEPT_CHEMISTRY_CORE_PACK_MAXIMUM_BYTES,
  `Concept Chemistry core exceeded ${CONCEPT_CHEMISTRY_CORE_PACK_MAXIMUM_BYTES / 1_000} KB (${conceptChemistryCoreBytes} bytes).`
);
assert.ok(
  conceptChemistryCoreGzip <= CONCEPT_CHEMISTRY_CORE_PACK_GZIP_MAXIMUM_BYTES,
  `Concept Chemistry core exceeded ${CONCEPT_CHEMISTRY_CORE_PACK_GZIP_MAXIMUM_BYTES / 1_000} KB gzip (${conceptChemistryCoreGzip} bytes).`
);
assert.ok(
  conceptMatterCoreBytes <= CONCEPT_MATTER_CORE_PACK_MAXIMUM_BYTES,
  `Concept Matter core exceeded ${CONCEPT_MATTER_CORE_PACK_MAXIMUM_BYTES / 1_000} KB (${conceptMatterCoreBytes} bytes).`
);
assert.ok(
  conceptMatterCoreGzip <= CONCEPT_MATTER_CORE_PACK_GZIP_MAXIMUM_BYTES,
  `Concept Matter core exceeded ${CONCEPT_MATTER_CORE_PACK_GZIP_MAXIMUM_BYTES / 1_000} KB gzip (${conceptMatterCoreGzip} bytes).`
);
assert.ok(
  combiningBoardBytes <= COMBINING_BOARD_PACK_MAXIMUM_BYTES,
  `Combining Board pack exceeded ${COMBINING_BOARD_PACK_MAXIMUM_BYTES / 1_000} KB (${combiningBoardBytes} bytes).`
);
assert.ok(
  voyageProjectionBytes <= VOYAGE_PROJECTION_PACK_MAXIMUM_BYTES,
  `Voyage Projection exceeded ${VOYAGE_PROJECTION_PACK_MAXIMUM_BYTES / 1_000} KB (${voyageProjectionBytes} bytes).`
);
assert.ok(
  cosmicStyles.bytes + epicHomeStyles.bytes <= CINEMATIC_CSS_MAXIMUM_BYTES,
  `Cinematic CSS exceeded ${CINEMATIC_CSS_MAXIMUM_BYTES / 1_000} KB (${cosmicStyles.bytes + epicHomeStyles.bytes} bytes).`
);
assert.ok(planetHubStyles.bytes <= PLANET_HUB_CSS_MAXIMUM_BYTES, `Planet Hub CSS exceeded ${PLANET_HUB_CSS_MAXIMUM_BYTES / 1_000} KB (${planetHubStyles.bytes} bytes).`);
assert.ok(planetHubRuntimeGzip <= PLANET_HUB_RUNTIME_GZIP_MAXIMUM_BYTES, `Planet Hub JavaScript exceeded 225 KiB gzip (${planetHubRuntimeGzip} bytes).`);
assert.ok(planetHubAssetBytes <= PLANET_HUB_GENERATED_PACK_MAXIMUM_BYTES, `Generated Planet Hub asset pack exceeded 12 MiB (${planetHubAssetBytes} bytes).`);
assert.ok(planetHubOptionalBytes <= PLANET_HUB_OPTIONAL_PACK_MAXIMUM_BYTES, `Complete optional Planet Hub pack exceeded 13 MiB (${planetHubOptionalBytes} bytes).`);
assert.ok(cosmeticsStyles.bytes <= CORE_COSMETICS_CSS_MAXIMUM_BYTES, `Core cosmetics CSS exceeded 60 KB (${cosmeticsStyles.bytes} bytes).`);
assert.ok(
  observatoryStylesBytes <= OBSERVATORY_CSS_MAXIMUM_BYTES,
  `Lazy Observatory CSS exceeded ${OBSERVATORY_CSS_MAXIMUM_BYTES / 1_000} KB (${observatoryStylesBytes} bytes).`
);
assert.ok(
  observatoryFullPageStyles.bytes <= OBSERVATORY_FULL_PAGE_CSS_MAXIMUM_BYTES,
  `Full-page Observatory layout CSS exceeded ${OBSERVATORY_FULL_PAGE_CSS_MAXIMUM_BYTES / 1_000} KB (${observatoryFullPageStyles.bytes} bytes).`
);
assert.ok(
  profileFrameStyles.bytes <= PROFILE_FRAME_CSS_MAXIMUM_BYTES,
  `Arena frame preview CSS exceeded ${PROFILE_FRAME_CSS_MAXIMUM_BYTES / 1_000} KB (${profileFrameStyles.bytes} bytes).`
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
  moonWorldweavingSurfaceBytes <= MOON_WORLDWEAVING_SURFACE_MAXIMUM_BYTES,
  `Moon Worldweaving exceeded ${MOON_WORLDWEAVING_SURFACE_MAXIMUM_BYTES / 1_000} KB (${moonWorldweavingSurfaceBytes} bytes).`
);
assert.ok(
  moonOutpostSurfaceBytes <= MOON_OUTPOST_SURFACE_MAXIMUM_BYTES,
  `Moon Outpost presentation exceeded ${MOON_OUTPOST_SURFACE_MAXIMUM_BYTES / 1_000} KB (${moonOutpostSurfaceBytes} bytes).`
);
assert.ok(
  moonProjectFlightBytes <= MOON_PROJECT_FLIGHT_MAXIMUM_BYTES,
  `Moon project flight exceeded ${MOON_PROJECT_FLIGHT_MAXIMUM_BYTES / 1_000} KB (${moonProjectFlightBytes} bytes).`
);
assert.ok(
  moonHeartSurfaceBytes <= MOON_HEART_SURFACE_MAXIMUM_BYTES,
  `Moon Heart Project presentation exceeded ${MOON_HEART_SURFACE_MAXIMUM_BYTES / 1_000} KB (${moonHeartSurfaceBytes} bytes).`
);
assert.ok(
  moonOutpostArtBytes <= MOON_OUTPOST_ART_MAXIMUM_BYTES,
  `Moon Outpost art exceeded ${MOON_OUTPOST_ART_MAXIMUM_BYTES / 1_000} KB (${moonOutpostArtBytes} bytes).`
);
assert.ok(
  moonOutpostPackBytes <= MOON_OUTPOST_PACK_MAXIMUM_BYTES,
  `Complete Moon Outpost pack exceeded ${MOON_OUTPOST_PACK_MAXIMUM_BYTES / 1_000} KB (${moonOutpostPackBytes} bytes).`
);
for (const path of MOON_OUTPOST_PNG_PATHS) {
  const record = required(path);
  const png = await readFile(join(output, record.path));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${path} is not a PNG.`);
}
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
assert.ok(baseRuntimeArtBytes <= 6_150_000, `Base packaged runtime art exceeded 6.15 MB (${baseRuntimeArtBytes} bytes).`);
assert.ok(initialArtCeiling <= 2_500_000, `Worst-case responsive first-view art exceeded 2.5 MB (${initialArtCeiling} bytes).`);
// The responsive three-destination Home adds its mobile rail and desktop
// observatory to the first view. Film, project workspaces, and large art remain
// in their separately capped lazy packs.
assert.ok(
  initialCoreGzip <= INITIAL_CORE_GZIP_MAXIMUM_BYTES,
  `Core game transfer exceeded the ${INITIAL_CORE_GZIP_MAXIMUM_BYTES / 1_000} KB gzip budget (${initialCoreGzip} bytes).`
);
assert.ok(interfaceFontBytes <= 225_000, `Self-hosted interface fonts exceeded the 225 KB source budget (${interfaceFontBytes} bytes).`);
assert.ok(storyPackBytes <= STORY_PACK_MAXIMUM_BYTES, `Combination Story exceeded its 40 KB optional-pack budget (${storyPackBytes} bytes).`);
assert.ok(goldenPairPackBytes <= GOLDEN_PAIR_PACK_MAXIMUM_BYTES, `Golden Pair animations exceeded their 56 KB optional-pack budget (${goldenPairPackBytes} bytes).`);
assert.ok(cinematicPackBytes <= CINEMATIC_PACK_MAXIMUM_BYTES, `Launch cinematic exceeded its 11 MB optional-pack budget (${cinematicPackBytes} bytes).`);
assert.ok(
  birthdayVoyageVideoPackBytes <= BIRTHDAY_VOYAGE_VIDEO_PACK_MAXIMUM_BYTES,
  `Birthday Voyage video exceeded its 4 MB optional-pack budget (${birthdayVoyageVideoPackBytes} bytes).`
);
assert.ok(
  birthdayVoyagePackBytes <= BIRTHDAY_VOYAGE_PACK_MAXIMUM_BYTES,
  `Complete Birthday Voyage exceeded its 10 MB optional-pack budget (${birthdayVoyagePackBytes} bytes).`
);
assert.ok(
  profileFramePreviewVideoPackBytes <= PROFILE_FRAME_PREVIEW_VIDEO_PACK_MAXIMUM_BYTES,
  `Profile-frame preview videos exceeded their 13 MB optional-pack budget (${profileFramePreviewVideoPackBytes} bytes).`
);
assert.equal(profileFrameArt.length, 20, `Expected 20 optional profile-frame masters; found ${profileFrameArt.length}.`);
assert.ok(profileFramePackBytes <= PROFILE_FRAME_PACK_MAXIMUM_BYTES, `Profile frames exceeded their 24 MB optional-pack budget (${profileFramePackBytes} bytes).`);
// The complete Circuit, Star Path, Crazy Path, accessibility, and manual-backup
// surfaces remain inside this measured package boundary. Keep the
// transfer-sensitive core gzip and per-asset ceilings unchanged.
// Outcome locking and the cancellable victory-presentation barrier are core
// integrity code, while the one-time journey itself remains in the lazy pack.
assert.ok(
  baseArtifactBytes <= BASE_ARTIFACT_MAXIMUM_BYTES,
  `Base Pages artifact exceeded ${BASE_ARTIFACT_MAXIMUM_BYTES / 1_000_000} MB (${baseArtifactBytes} bytes).`
);
assert.ok(
  totalBytes <= BASE_ARTIFACT_MAXIMUM_BYTES
    + COSMETIC_PACKS.reduce((sum, pack) => sum + pack.maximumBytes, 0)
    + AUDIO_PACKS.reduce((sum, pack) => sum + pack.maximumBytes, 0)
    + STORY_PACK_MAXIMUM_BYTES
    + GOLDEN_PAIR_PACK_MAXIMUM_BYTES
    + CINEMATIC_PACK_MAXIMUM_BYTES
    + BIRTHDAY_VOYAGE_PACK_MAXIMUM_BYTES
    + PROFILE_FRAME_PREVIEW_VIDEO_PACK_MAXIMUM_BYTES
    + PROFILE_FRAME_PACK_MAXIMUM_BYTES
    + SECONDARY_SURFACE_MAXIMUM_BYTES
    + MOON_WORLDWEAVING_SURFACE_MAXIMUM_BYTES
    + MOON_OUTPOST_PACK_MAXIMUM_BYTES
    + MOON_PROJECT_FLIGHT_MAXIMUM_BYTES
    + MOON_HEART_SURFACE_MAXIMUM_BYTES
    + SCRAMBLE_SURFACE_MAXIMUM_BYTES
    + COSMIC_INTERLUDE_CSS_MAXIMUM_BYTES
    + COMBINING_BOARD_PACK_MAXIMUM_BYTES
    + VOYAGE_PROJECTION_PACK_MAXIMUM_BYTES
    + PLANET_HUB_OPTIONAL_PACK_MAXIMUM_BYTES,
  `Pages artifact exceeded the base plus declared optional-pack budgets (${totalBytes} bytes).`
);

console.log(`Performance budget passed: app ${app.bytes} B, preload bootstrap ${cosmeticPreloadBootstrap.bytes} B, CSS ${styles.bytes + simpleStyles.bytes + mobilePlayShellStyles.bytes + conceptChemistryStyles.bytes + conceptMatterStyles.bytes + molecularMemoryStyles.bytes + wordOrbitStyles.bytes + wordOrbitMotionStyles.bytes + cosmicStyles.bytes + epicHomeStyles.bytes + planetHubStyles.bytes + cosmeticsStyles.bytes} B, Concept Chemistry ${conceptChemistryCoreBytes} B (${conceptChemistryCoreGzip} B gzip), Concept Matter ${conceptMatterCoreBytes} B (${conceptMatterCoreGzip} B gzip), board pack ${combiningBoardBytes} B (${combiningBoardCoreGzip} B gzip eager), Voyage Projection ${voyageProjectionBytes} B lazy, Planet Hub ${planetHubOptionalBytes} B (assets ${planetHubAssetBytes} B, runtime ${planetHubRuntimeGzip} B gzip, atlas ${planetHubOptionalModuleBytes} B lazy, lazy CSS ${planetHubCinematicStyleBytes} B), Cosmic Interlude ${cosmicInterludeStyles.bytes} B, Circuit ${circuitBytes} B, secondary surfaces ${secondarySurfaceBytes} B, Moon Worldweaving ${moonWorldweavingSurfaceBytes} B, Moon Outpost ${moonOutpostPackBytes} B (surface ${moonOutpostSurfaceBytes} B, art ${moonOutpostArtBytes} B), Moon flight ${moonProjectFlightBytes} B, Moon Heart ${moonHeartSurfaceBytes} B, Scramble ${scrambleSurfaceBytes} B, world ${world.bytes} B, core gzip ${initialCoreGzip} B, first-view art <= ${initialArtCeiling} B, base artifact ${baseArtifactBytes} B, story pack ${storyPackBytes} B, Golden Pairs ${goldenPairPackBytes} B, launch cinematic ${cinematicPackBytes} B, Birthday Voyage ${birthdayVoyagePackBytes} B (video ${birthdayVoyageVideoPackBytes} B), profile-frame preview videos ${profileFramePreviewVideoPackBytes} B, profile frames ${profileFramePackBytes} B, cosmetic packs ${cosmeticPackBytes.join(", ")}, audio packs ${audioPackBytes.join(", ")}, total ${totalBytes} B.`);
