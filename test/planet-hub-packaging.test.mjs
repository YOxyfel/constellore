import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertNoRawPlanetHubSources,
  assertPlanetHubReleaseInventory,
  assertPlanetHubSourceRuntimeInventory,
  assertUsablePlanetHubPosterMetadata,
  buildPlanetHubRuntimeBundle,
  buildPlanetHubRuntimeModule,
  isPlanetHubOptionalModuleFile,
  isPlanetHubRuntimeFile,
  isPlanetHubReleaseMinifiedFile,
  PLANET_HUB_ASSET_PATHS,
  PLANET_HUB_BUNDLE_MINIMUM_SAVINGS_GZIP_BYTES,
  PLANET_HUB_BUNDLED_SOURCE_FILES,
  PLANET_HUB_DETAIL_PATHS,
  PLANET_HUB_GALAXY_PATHS,
  PLANET_HUB_OPTIONAL_MODULE_FILES,
  PLANET_HUB_PLACE_THUMBNAIL_PATHS,
  PLANET_HUB_RELEASE_RUNTIME_FILES,
  PLANET_HUB_RELEASE_LAZY_FILES,
  PLANET_HUB_RELEASE_STYLE_FILES,
  PLANET_HUB_SPACE_LAYER_NAMES,
  PLANET_HUB_SPACE_LAYER_PATHS,
  PLANET_HUB_SOURCE_LAZY_FILES,
  PLANET_HUB_SOURCE_RUNTIME_FILES,
  planetHubRuntimeBudget,
  validatePlanetHubProvenance
} from "../scripts/planet-hub-packaging.mjs";
import { renderServiceWorker } from "../scripts/service-worker-source.mjs";
import {
  expectedThreeVendorFiles,
  MOON_SETTLEMENT_THREE_EXPORTS,
  PLANET_HUB_THREE_EXPORTS,
  THREE_VENDOR_EXPORTS,
  VOYAGE_PROJECTION_THREE_EXPORTS,
  THREE_VENDOR_FILES
} from "../scripts/sync-planet-hub-vendor.mjs";
import { importMapCspSource, importMapText } from "../scripts/inline-script-csp.mjs";
import { DEFAULT_PLANET_HUB_THREE_SPECIFIER } from "../public/planet-hub-renderer.mjs";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("planet hub uses the exact pinned local Three.js ESM vendor pack", async () => {
  const pkg = JSON.parse(await readFile(projectFile("package.json"), "utf8"));
  assert.equal(pkg.devDependencies.three, "0.185.1");
  assert.equal(pkg.devDependencies["@gltf-transform/cli"], "4.4.2");
  assert.equal(pkg.devDependencies.meshoptimizer, "1.2.0");
  assert.equal(pkg.devDependencies.esbuild, "0.25.8");
  const vendor = await expectedThreeVendorFiles();
  assert.deepEqual([...vendor.keys()], THREE_VENDOR_FILES);
  assert.deepEqual(THREE_VENDOR_FILES, [
    "vendor/three/planet-hub-three.mjs",
    "vendor/three/GLTFLoader.js",
    "vendor/three/LICENSE.txt"
  ]);
  const loader = vendor.get("vendor/three/GLTFLoader.js");
  assert.equal(loader,
    `export { GLTFLoader } from "./planet-hub-three.mjs?v=${pkg.version}";\n`,
    "GLTFLoader and the import map must resolve one canonical Three module URL");
  const runtimeThreeUses = new Set();
  for (const file of ["planet-hub-renderer.mjs", "planet-hub-space.mjs", "planet-hub-moods.mjs", "planet-hub-sun-effects.mjs"]) {
    const source = await readFile(projectFile(`public/${file}`), "utf8");
    for (const match of source.matchAll(/\bTHREE(?:\?\.)?\.([A-Za-z_$][\w$]*)/g)) runtimeThreeUses.add(match[1]);
  }
  assert.deepEqual([...runtimeThreeUses].sort(), [...PLANET_HUB_THREE_EXPORTS].sort(),
    "The tree-shaken Three.js surface must track every Planet Hub runtime use.");
  const voyageThreeUses = new Set();
  const voyageSource = await readFile(projectFile("public/voyage-projection-scene.mjs"), "utf8");
  for (const match of voyageSource.matchAll(/\bTHREE(?:\?\.)?\.([A-Za-z_$][\w$]*)/g)) voyageThreeUses.add(match[1]);
  for (const match of voyageSource.matchAll(/\bmakeMaterial\("([A-Za-z_$][\w$]*)"/g)) voyageThreeUses.add(match[1]);
  const voyageOnlyUses = [...voyageThreeUses].filter((name) => !runtimeThreeUses.has(name));
  assert.deepEqual(voyageOnlyUses.sort(), [...VOYAGE_PROJECTION_THREE_EXPORTS].sort(),
    "The tree-shaken Three.js surface must track every additional Voyage Projection runtime use.");
  assert.deepEqual(
    [...new Set([
      ...PLANET_HUB_THREE_EXPORTS,
      ...VOYAGE_PROJECTION_THREE_EXPORTS,
      ...MOON_SETTLEMENT_THREE_EXPORTS
    ])].sort(),
    [...THREE_VENDOR_EXPORTS].sort(),
    "The canonical import-map module must expose the union of Planet Hub, Voyage, and Moon constructors."
  );
  assert.deepEqual(MOON_SETTLEMENT_THREE_EXPORTS, ["Box3", "PCFShadowMap"],
    "the Moon lab must retain exact authored-model bounds and its Standard filtered-shadow mode");
  const document = await readFile(projectFile("public/index.html"), "utf8");
  const importMap = JSON.parse(importMapText(document));
  assert.equal(importMap.imports.three,
    `./vendor/three/planet-hub-three.mjs?v=${pkg.version}`);
  assert.equal(DEFAULT_PLANET_HUB_THREE_SPECIFIER, "three",
    "The runtime must use the import-map key, not resolve a second relative Three URL against its module.");
  for (const documentUrl of [
    "http://127.0.0.1:4173/",
    "http://127.0.0.1:4173/play/",
    "https://yoxyfel.github.io/constellore/play/",
    "file:///Constellore/index.html"
  ]) {
    const canonicalUrl = new URL(importMap.imports[DEFAULT_PLANET_HUB_THREE_SPECIFIER], documentUrl).href;
    assert.match(canonicalUrl, /\/vendor\/three\/planet-hub-three[.]mjs[?]v=/,
      `${documentUrl} must keep the mapped Three module beside its document base.`);
  }
  for (const [path, expected] of vendor) {
    assert.equal(await readFile(projectFile(`public/${path}`), "utf8"), expected, `${path} drifted from the pinned npm package.`);
  }
});

test("release inventory requires the complete generated hub and rejects source art", () => {
  const valid = [...PLANET_HUB_ASSET_PATHS, ...THREE_VENDOR_FILES, "planet-hub-runtime.mjs", "planet-hub.css"];
  assert.doesNotThrow(() => assertPlanetHubReleaseInventory(valid, "fixture"));
  assert.throws(
    () => assertPlanetHubReleaseInventory(valid.filter((path) => !path.endsWith("moon-arena.webp")), "fixture"),
    /moon-arena[.]webp/
  );
  assert.throws(
    () => assertPlanetHubReleaseInventory(valid.filter((path) => !path.endsWith("05-near-stars-standard.webp")), "fixture"),
    /05-near-stars-standard[.]webp/
  );
  assert.throws(
    () => assertPlanetHubReleaseInventory(valid.filter((path) => !path.endsWith("solar-bodies.webp")), "fixture"),
    /solar-bodies[.]webp/
  );
  for (const source of [
    "itch-assets/Models/Constellore.blend",
    "art/planet-hub/Constellore.blend1",
    "art/planet-hub/source.fbx",
    "art/planet-hub/portal.mov"
  ]) assert.throws(() => assertNoRawPlanetHubSources([source]), /source|itch-assets|staging/i);
});

test("Living Planet Home exclusively owns its sky instead of compositing the legacy painted cosmos", async () => {
  const [document, styles] = await Promise.all([
    readFile(projectFile("public/index.html"), "utf8"),
    readFile(projectFile("public/planet-hub.css"), "utf8")
  ]);
  assert.match(document, /id="startScreen"[^>]*data-planet-hub-home/);
  assert.match(styles, /#startScreen[.]start-screen\[data-planet-hub-home\]::before/);
  assert.match(styles, /#startScreen[.]start-screen\[data-planet-hub-home\]::after/);
  assert.match(styles, /#startScreen[.]start-screen\[data-planet-hub-home\]\s*>\s*[.]home-vfx\s*\{[\s\S]*?display:\s*none\s*!important/);
  assert.match(styles, /#startScreen[.]start-screen\[data-planet-hub-home\]\s*\{[^}]*background-image:\s*none\s*!important/i);
});

test("the lazy cinematic HUD keeps copy readable and controls safely responsive", async () => {
  const styles = await readFile(projectFile("public/planet-hub-cinematic.css"), "utf8");
  assert.match(styles, /Cinematic HUD convergence/);
  assert.match(styles, /--planet-hud-card-width:\s*min\(620px/);
  assert.match(styles, /--planet-hud-card-height:\s*clamp\(184px,\s*24dvh,\s*208px\)/);
  assert.match(styles, /--planet-hud-safe-bottom:\s*max\(12px,\s*env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /data-home-hub-mode="focused"\][^{]*[.]home-orbit__scene\s*\{[^}]*width:\s*var\(--planet-hud-card-width\)/);
  assert.match(styles, /[.]moon-home-voyage__copy strong\s*\{[^}]*max-width:\s*none[^}]*font-size:\s*clamp\(34px/);
  assert.match(styles, /[.]moon-home-voyage__action\s*\{[^}]*min-height:\s*56px/);
  assert.match(styles, /[.]home-orbit__tabs\s*\{[^}]*box-sizing:\s*border-box[^}]*height:\s*100%[^}]*overflow:\s*hidden/);
  assert.match(styles, /[.]home-orbit__tab\s*\{[^}]*box-sizing:\s*border-box[^}]*height:\s*100%[^}]*min-height:\s*0/);
  assert.match(styles, /[.]home-orbit__rail\s*\{[^}]*grid-row:\s*1\s*!important[^}]*grid-column:\s*1\s*!important/,
    "the absolute rail must not inherit a legacy second grid row below the viewport");
  assert.match(styles, /[.]moon-home-voyage::before,[\s\S]*?[.]moon-home-voyage::after\s*\{[^}]*content:\s*none\s*!important/);
  assert.match(styles, /[.]moon-home-project-visit:disabled\s*\{[^}]*display:\s*none\s*!important/,
    "a stale disabled Moonhaven action must not overlap the live Journey card");
  assert.match(styles, /[.]moon-home-project-visit:not\(\[hidden\]\):not\(:disabled\)\s*\{[^}]*width:\s*var\(--planet-hud-action-width\)/,
    "the conditional Moonhaven action must reuse the shared CTA track");
  assert.match(styles, /@media \(max-width:\s*520px\) and \(orientation:\s*portrait\)[\s\S]*?grid-template-areas:\s*"copy"\s*"action"/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /@media \(forced-colors:\s*active\)/);
});

test("Planet Hub release modules are versioned and minified deterministically", async () => {
  assert.equal(isPlanetHubRuntimeFile("planet-hub-runtime.mjs"), true);
  assert.equal(isPlanetHubRuntimeFile("play/planet-hub-runtime.mjs"), true);
  assert.equal(isPlanetHubRuntimeFile("play/vendor/three/planet-hub-three.mjs"), false);
  assert.equal(isPlanetHubRuntimeFile("celestial-atlas-runtime.mjs"), false);
  assert.equal(isPlanetHubRuntimeFile("planet-hub-sun-effects.mjs"), false);
  assert.equal(isPlanetHubOptionalModuleFile("play/celestial-atlas-runtime.mjs"), true);
  assert.equal(isPlanetHubOptionalModuleFile("play/celestial-cosmology-runtime.mjs"), true);
  assert.equal(isPlanetHubOptionalModuleFile("play/planet-hub-places.mjs"), true);
  assert.equal(isPlanetHubOptionalModuleFile("play/planet-hub-sun-effects.mjs"), true);
  assert.equal(isPlanetHubReleaseMinifiedFile("celestial-atlas-runtime.mjs"), true);
  assert.equal(isPlanetHubReleaseMinifiedFile("celestial-cosmology-runtime.mjs"), true);
  assert.equal(isPlanetHubReleaseMinifiedFile("planet-hub-places.mjs"), true);
  assert.equal(isPlanetHubReleaseMinifiedFile("planet-hub-renderer.mjs"), true);
  assert.equal(isPlanetHubReleaseMinifiedFile("expedition.mjs"), true);
  assert.equal(isPlanetHubReleaseMinifiedFile("frictionless.mjs"), true);
  assert.equal(isPlanetHubReleaseMinifiedFile("moon-worldweaving-controller.mjs"), true);
  assert.equal(isPlanetHubReleaseMinifiedFile("moon-worldweaving-runtime.mjs"), true);
  assert.equal(isPlanetHubReleaseMinifiedFile("moon-result-presentation.mjs"), true);
  assert.equal(isPlanetHubReleaseMinifiedFile("moon-outpost.mjs"), false);
  const source = `/* @license removed from release output */
import { planetState } from "./planet-hub-domain.mjs";
const descriptiveLocalName = planetState?.active === true ? "active" : "idle";
export function readPlanetState() { return descriptiveLocalName; }
`;
  const first = await buildPlanetHubRuntimeModule(source, "1.2.3-beta.4");
  const second = await buildPlanetHubRuntimeModule(source, "1.2.3-beta.4");
  assert.equal(first, second);
  assert.match(first, /planet-hub-domain[.]mjs[?]v=1[.]2[.]3-beta[.]4/);
  assert.doesNotMatch(first, /@license|descriptiveLocalName/);
  assert.match(first, /export/);
  assert.ok(Buffer.byteLength(first) < Buffer.byteLength(source));
});

test("Planet Hub release bundle embeds its complete classified support inventory", async () => {
  const version = "1.2.3-beta.4";
  const entry = projectFile("public/planet-hub-runtime.mjs");
  const first = await buildPlanetHubRuntimeBundle(entry, version);
  const second = await buildPlanetHubRuntimeBundle(entry, version);
  assert.equal(first, second);
  for (const file of PLANET_HUB_BUNDLED_SOURCE_FILES) {
    assert.doesNotMatch(first, new RegExp(file.replaceAll(".", "[.]")), `${file} must be embedded rather than imported by the release runtime.`);
  }
  assert.deepEqual(PLANET_HUB_RELEASE_RUNTIME_FILES, [
    "planet-hub-host.mjs",
    "planet-hub-runtime.mjs"
  ]);
  assert.deepEqual(PLANET_HUB_SOURCE_RUNTIME_FILES, [
    ...PLANET_HUB_RELEASE_RUNTIME_FILES,
    ...PLANET_HUB_BUNDLED_SOURCE_FILES
  ]);
  assert.deepEqual(PLANET_HUB_RELEASE_STYLE_FILES, ["planet-hub-cinematic.css"]);
  assert.deepEqual(PLANET_HUB_OPTIONAL_MODULE_FILES, [
    "celestial-atlas-runtime.mjs",
    "celestial-cosmology-runtime.mjs",
    "planet-hub-audio.mjs",
    "planet-hub-places.mjs",
    "planet-hub-space.mjs",
    "planet-hub-sun-effects.mjs"
  ]);
  assert.deepEqual(PLANET_HUB_RELEASE_LAZY_FILES, [
    ...PLANET_HUB_RELEASE_RUNTIME_FILES,
    ...PLANET_HUB_OPTIONAL_MODULE_FILES,
    ...PLANET_HUB_RELEASE_STYLE_FILES
  ]);
  assert.deepEqual(PLANET_HUB_SOURCE_LAZY_FILES, [
    ...PLANET_HUB_SOURCE_RUNTIME_FILES,
    ...PLANET_HUB_OPTIONAL_MODULE_FILES,
    ...PLANET_HUB_RELEASE_STYLE_FILES
  ]);
  assertPlanetHubSourceRuntimeInventory(PLANET_HUB_SOURCE_RUNTIME_FILES);

  const budget = await planetHubRuntimeBudget(projectFile("public"), { version });
  assert.deepEqual(budget.sourceRuntimePaths, [...PLANET_HUB_SOURCE_RUNTIME_FILES].sort());
  assert.ok(!budget.runtimePaths.includes("celestial-atlas-runtime.mjs"));
  assert.ok(!budget.sourceRuntimePaths.includes("celestial-atlas-runtime.mjs"),
    "the optional atlas must not enter the 225 KiB core runtime accounting");
  assert.ok(!budget.runtimePaths.includes("celestial-cosmology-runtime.mjs"));
  assert.ok(!budget.sourceRuntimePaths.includes("celestial-cosmology-runtime.mjs"),
    "deep cosmology must not enter the 225 KiB core runtime accounting");
  assert.ok(!budget.runtimePaths.includes("planet-hub-places.mjs"));
  assert.ok(!budget.sourceRuntimePaths.includes("planet-hub-places.mjs"),
    "the place catalog must not enter the 225 KiB core runtime accounting");
  assert.ok(!budget.runtimePaths.includes("planet-hub-audio.mjs"));
  assert.ok(!budget.sourceRuntimePaths.includes("planet-hub-audio.mjs"),
    "semantic audio must remain on-demand instead of entering the interaction-critical core");
  assert.ok(!budget.runtimePaths.includes("planet-hub-sun-effects.mjs"));
  assert.ok(!budget.sourceRuntimePaths.includes("planet-hub-sun-effects.mjs"),
    "progressive lens optics must not enter the direct-manipulation core accounting");
  assert.ok(!budget.runtimePaths.includes("planet-hub-space.mjs"));
  assert.ok(!budget.sourceRuntimePaths.includes("planet-hub-space.mjs"),
    "the progressive space environment must not enter the direct-manipulation core accounting");
  assert.equal(budget.sourceRuntimeGzip - budget.releaseRuntimeGzip, budget.bundleSavingsGzip);
  assert.ok(budget.bundleSavingsGzip >= PLANET_HUB_BUNDLE_MINIMUM_SAVINGS_GZIP_BYTES,
    `Bundling must save at least 2 KiB gzip across every classified source module (${budget.bundleSavingsGzip} bytes saved).`);
});

test("Planet Hub source inventory rejects missing bundled support and unclassified modules", () => {
  assert.equal(PLANET_HUB_OPTIONAL_MODULE_FILES.includes("planet-hub-audio.mjs"), true);
  assert.throws(
    () => assertPlanetHubSourceRuntimeInventory(
      PLANET_HUB_SOURCE_RUNTIME_FILES.filter((file) => file !== "planet-hub-moods.mjs"),
      "fixture"
    ),
    /exact bridge, audio, bundle entry/i
  );
  for (const required of ["planet-hub-zoom.mjs"]) {
    assert.throws(
      () => assertPlanetHubSourceRuntimeInventory(
        PLANET_HUB_SOURCE_RUNTIME_FILES.filter((file) => file !== required),
        "fixture"
      ),
      /exact bridge, audio, bundle entry/i,
      `${required} must remain classified inside the bundled runtime inventory`
    );
  }
  assert.throws(
    () => assertPlanetHubSourceRuntimeInventory(
      [...PLANET_HUB_SOURCE_RUNTIME_FILES, "planet-hub-unclassified.mjs"],
      "fixture"
    ),
    /exact bridge, audio, bundle entry/i
  );
});

test("poster metadata rejects dimension-only blank or opaque fallback captures", () => {
  const usable = {
    width: 1024,
    height: 1024,
    format: "WEBP",
    hasAlpha: true,
    lumaStdDev: 44.29,
    visiblePixelRatio: 0.6936,
    opaquePixelRatio: 0.6637
  };
  assert.doesNotThrow(() => assertUsablePlanetHubPosterMetadata(usable, "fixture"));
  assert.throws(
    () => assertUsablePlanetHubPosterMetadata({ ...usable, hasAlpha: false }, "opaque fixture"),
    /transparent/i
  );
  assert.throws(
    () => assertUsablePlanetHubPosterMetadata({ ...usable, lumaStdDev: 0.79 }, "blank fixture"),
    /blank|degenerate/i
  );
  assert.throws(
    () => assertUsablePlanetHubPosterMetadata({ ...usable, visiblePixelRatio: 1 }, "full-frame fixture"),
    /visible-pixel coverage/i
  );
  assert.throws(
    () => assertUsablePlanetHubPosterMetadata({ ...usable, opaquePixelRatio: 0 }, "transparent fixture"),
    /opaque-pixel coverage/i
  );
  assert.throws(
    () => assertUsablePlanetHubPosterMetadata({ ...usable, width: 1 }, "tiny fixture"),
    /1024px wide/i
  );
});

test("poster capture excludes the runtime sky so fallback art stays transparent", async () => {
  const page = await readFile(projectFile("scripts/planet-hub-poster-page.html"), "utf8");
  assert.match(page, /effectsLevel:\s*['"]off['"]/,
    "Poster capture must not bake the procedural runtime sky behind the transparent planet fallback.");
  assert.match(page, /class TransparentPosterRenderer extends THREE[.]WebGLRenderer/,
    "Poster capture must adapt the production renderer through a build-only alpha framebuffer.");
  assert.match(page, /super\(\{\s*[.][.][.]options,\s*alpha:\s*true\s*\}\)/,
    "Poster capture must explicitly opt into an alpha framebuffer.");
  assert.match(page, /this[.]setClearColor\s*=\s*\(color\)\s*=>\s*setClearColor\(color,\s*0\)/,
    "Poster capture must clear the build-only framebuffer transparently.");
});

test("poster capture waits for renderer initialization and uses only its public lifecycle", async () => {
  const page = await readFile(projectFile("scripts/planet-hub-poster-page.html"), "utf8");
  assert.match(page, /const presentation = await createThreePlanetHubRenderer\s*\(/,
    "Poster capture must wait until the production renderer has loaded and drawn its scene.");
  assert.doesNotMatch(page, /presentation[.](?:resize|requestRender|renderer)\b/,
    "Poster capture must not depend on private renderer internals.");
  assert.match(page, /presentation[.]suspend\(\)/,
    "Poster capture should suspend the initialized renderer before readback.");
  const detailsReady = page.indexOf('window.posterDetailReadiness = await waitForPosterDetails(');
  assert.ok(detailsReady > page.indexOf('await createThreePlanetHubRenderer(')
    && detailsReady < page.indexOf('presentation.suspend()'),
    "poster generation must wait for progressive detail readiness before freezing the canvas");
  assert.match(page, /dataset[.]captureFailure = String\(error[?][.]message \|\| error\)/,
    "detail failures must surface to the bounded capture runner");
  assert.match(page, /canvas[.]getContext\(['"]webgl2['"]\)/,
    "Poster capture should inspect context loss through the canvas API.");
});

test("commercial provenance and CC BY globe attribution are release-gated", async () => {
  const provenance = await validatePlanetHubProvenance();
  const byId = new Map(provenance.records.map((record) => [record.id, record]));
  assert.equal(byId.get("tripo-landmarks").commercialUseDocumented, true);
  assert.equal(byId.get("portal-vfx").commercialUseDocumented, true);
  assert.equal(byId.get("solar-places-thumbnails").commercialUseDocumented, true);
  assert.equal(byId.get("earth-globe").author, "AirStudios");
  assert.equal(byId.get("moon-globe").author, "matousekfoto");
  assert.equal(byId.get("sun-globe").author, "SebastianSosnowski");
  const notices = await readFile(projectFile("THIRD_PARTY_NOTICES.md"), "utf8");
  assert.match(notices, /Earth[\s\S]*AirStudios[\s\S]*CC BY 4[.]0/i);
  assert.match(notices, /Moon[\s\S]*matousekfoto[\s\S]*CC BY 4[.]0/i);
  assert.match(notices, /Sun[\s\S]*SebastianSosnowski[\s\S]*CC BY 4[.]0/i);
});

test("Places thumbnails ship as one deterministic, lazy solar portrait sprite", async () => {
  const [manifest, config, helper] = await Promise.all([
    readFile(projectFile("public/art/planet-hub/manifest.json"), "utf8").then(JSON.parse),
    readFile(projectFile("scripts/planet-hub.config.json"), "utf8").then(JSON.parse),
    readFile(projectFile("scripts/planet-hub-textures.py"), "utf8")
  ]);
  assert.deepEqual(PLANET_HUB_PLACE_THUMBNAIL_PATHS, [
    "art/planet-hub/place-thumbnails/solar-bodies.webp"
  ]);
  assert.equal(manifest.placeThumbnails.schemaVersion, 1);
  assert.equal(manifest.placeThumbnails.derivationVersion, 1);
  assert.equal(manifest.placeThumbnails.initialScene, false);
  assert.equal(manifest.placeThumbnails.loadPolicy, "places-panel");
  assert.deepEqual(manifest.placeThumbnails.sprite.order, [
    "sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune"
  ]);
  assert.equal(manifest.placeThumbnails.sprite.url, `./${PLANET_HUB_PLACE_THUMBNAIL_PATHS[0]}`);
  assert.equal(manifest.placeThumbnails.sprite.width, config.budgets.placeThumbnails.width);
  assert.equal(manifest.placeThumbnails.sprite.height, config.budgets.placeThumbnails.height);
  assert.equal(manifest.placeThumbnails.sprite.tileSize, config.budgets.placeThumbnails.tileSize);
  assert.ok(manifest.placeThumbnails.sprite.bytes <= config.budgets.placeThumbnails.bytes);
  assert.match(helper, /PLACE_THUMBNAIL_SOURCE_SIZE\s*=\s*\(1983,\s*793\)/);
  assert.match(helper, /derive_place_thumbnail_sprite/);
});

test("Earth hub budgets the orbiting Moon and one shared optimized Sun", async () => {
  const manifest = JSON.parse(await readFile(projectFile("public/art/planet-hub/manifest.json"), "utf8"));
  const lowSun = manifest.shared.tiers.low.sun;
  const standardSun = manifest.shared.tiers.standard.sun;
  assert.equal(lowSun.url, "./art/planet-hub/models/sun-low.glb");
  assert.equal(standardSun.url, lowSun.url);
  assert.equal(standardSun.sha256, lowSun.sha256);
  assert.ok(lowSun.bytes <= 32_768);
  assert.ok(lowSun.triangles <= 512);
  for (const tier of ["low", "standard"]) {
    const earth = manifest.worlds.earth.tiers[tier];
    const sceneBytes = earth.planet.bytes
      + Object.values(earth.landmarks).reduce((sum, record) => sum + record.bytes, 0)
      + manifest.shared.tiers[tier].rocket.bytes
      + manifest.worlds.moon.tiers[tier].planet.bytes
      + manifest.shared.tiers[tier].sun.bytes;
    assert.ok(sceneBytes <= manifest.budgets.tiers[tier].sceneBytes, `${tier} Earth scene must include Moon and Sun within budget.`);
  }
});

test("cinematic detail maps stay focus-lazy, provenance-marked, and outside initial scenes", async () => {
  const [manifest, config] = await Promise.all([
    readFile(projectFile("public/art/planet-hub/manifest.json"), "utf8").then(JSON.parse),
    readFile(projectFile("scripts/planet-hub.config.json"), "utf8").then(JSON.parse)
  ]);
  const details = manifest.optionalDetails;
  assert.equal(details.schemaVersion, 1);
  assert.equal(details.initialScene, false);
  assert.equal(details.loadPolicy, "focus");
  assert.deepEqual(details.textureContract, {
    flipY: false,
    uvChannel: 0,
    authoredColorSpace: "srgb",
    supportColorSpace: "none"
  });
  assert.ok(details.bytes <= config.budgets.optionalDetailBytes);
  const paths = [];
  for (const tier of ["low", "standard"]) {
    const records = details.tiers[tier];
    assert.ok(records.bytes <= config.budgets.detailTiers[tier].bytes);
    assert.equal(records.earth.albedo.width, tier === "standard" ? 4096 : 2048);
    assert.equal(records.earth.albedo.initialScene, false);
    assert.equal(records.earth.albedo.loadPolicy, "progressive-after-ready");
    const albedoSource = manifest.sources[records.earth.albedo.source.file];
    assert.ok(albedoSource, "progressive albedo retains durable licensed-source provenance");
    assert.equal(albedoSource.sha256, records.earth.albedo.source.sha256);
    assert.equal(records.earth.clouds.hasAlpha, false, "one RGB coverage map avoids duplicated cloud opacity");
    assert.equal(records.earth.clouds.colorSpace, "linear");
    for (const authored of [records.earth.albedo, records.earth.clouds, records.earth.night, records.sun.emissive]) {
      assert.equal(authored.authored, true);
      assert.equal(authored.derived, false);
      paths.push(authored.url.replace(/^\.\//, ""));
    }
    for (const [role, maps] of Object.entries(records.materials)) {
      assert.equal(maps.normal.derived, true, `${tier} ${role} normal must be visibly labeled as inferred.`);
      assert.equal(maps.orm.derived, true, `${tier} ${role} ORM must be visibly labeled as inferred.`);
      assert.match(maps.normal.algorithm, /^albedo-support-v\d+$/);
      assert.match(maps.orm.algorithm, /^albedo-support-v\d+$/);
      paths.push(maps.normal.url.replace(/^\.\//, ""), maps.orm.url.replace(/^\.\//, ""));
      if (role === "portal") {
        assert.equal(maps.emissive.derived, true);
        assert.match(maps.emissive.algorithm, /^conservative-portal-emissive-v\d+$/);
        paths.push(maps.emissive.url.replace(/^\.\//, ""));
      } else {
        assert.equal(maps.emissive, undefined, `${role} has no defensible generated emissive mask.`);
      }
    }
  }
  assert.deepEqual(paths.sort(), [...PLANET_HUB_DETAIL_PATHS].sort());
});

test("space layers are deterministic progressive assets outside the initial scene", async () => {
  const [manifest, config] = await Promise.all([
    readFile(projectFile("public/art/planet-hub/manifest.json"), "utf8").then(JSON.parse),
    readFile(projectFile("scripts/planet-hub.config.json"), "utf8").then(JSON.parse)
  ]);
  const details = manifest.spaceLayers;
  assert.equal(details.schemaVersion, 1);
  assert.equal(details.derivationVersion, 1);
  assert.equal(details.initialScene, false);
  assert.equal(details.loadPolicy, "progressive-after-ready");
  assert.deepEqual(details.textureContract, {
    projection: "equirectangular",
    colorSpace: "srgb",
    horizontalWrap: "repeat",
    verticalWrap: "clamp",
    mipmaps: false
  });
  const paths = [];
  let totalBytes = 0;
  for (const tier of ["low", "standard"]) {
    const records = details.tiers[tier];
    const limits = config.budgets.spaceLayers.tiers[tier];
    assert.equal(records.width, limits.width);
    assert.equal(records.height, limits.height);
    assert.equal(records.quality, limits.quality);
    assert.deepEqual(
      records.layers.map((record) => `${String(record.order).padStart(2, "0")}-${record.id}`),
      PLANET_HUB_SPACE_LAYER_NAMES
    );
    const tierBytes = records.layers.reduce((sum, record) => {
      assert.equal(record.width, limits.width);
      assert.equal(record.height, limits.height);
      assert.equal(record.mimeType, "image/webp");
      paths.push(record.url.replace(/^\.\//, ""));
      return sum + record.bytes;
    }, 0);
    assert.equal(tierBytes, records.bytes);
    assert.ok(tierBytes <= limits.bytes);
    totalBytes += tierBytes;
  }
  assert.equal(totalBytes, details.bytes);
  assert.ok(totalBytes <= config.budgets.spaceLayers.bytes);
  assert.deepEqual(paths.sort(), [...PLANET_HUB_SPACE_LAYER_PATHS].sort());
  for (const name of PLANET_HUB_SPACE_LAYER_NAMES) {
    assert.ok(manifest.sources[`itch-assets/Models/SpaceLayers/${name}-source.png`],
      `${name} must retain a durable hashed master source.`);
  }
});

test("Milky Way art is a deterministic far-tier texture outside the initial scene", async () => {
  const [manifest, config] = await Promise.all([
    readFile(projectFile("public/art/planet-hub/manifest.json"), "utf8").then(JSON.parse),
    readFile(projectFile("scripts/planet-hub.config.json"), "utf8").then(JSON.parse)
  ]);
  const details = manifest.galaxyTexture;
  assert.equal(details.schemaVersion, 1);
  assert.equal(details.derivationVersion, 1);
  assert.equal(details.initialScene, false);
  assert.equal(details.loadPolicy, "milky-way-tier");
  assert.deepEqual(details.textureContract, {
    projection: "face-on-disc",
    colorSpace: "srgb",
    background: "black-luminance-alpha",
    mipmaps: true
  });
  const paths = [];
  let totalBytes = 0;
  for (const tier of ["low", "standard"]) {
    const record = details.tiers[tier];
    const limits = config.budgets.galaxyTexture.tiers[tier];
    assert.equal(record.width, limits.width);
    assert.equal(record.height, limits.width);
    assert.equal(record.quality, limits.quality);
    assert.equal(record.mimeType, "image/webp");
    assert.ok(record.bytes <= limits.bytes);
    paths.push(record.url.replace(/^\.\//, ""));
    totalBytes += record.bytes;
  }
  assert.equal(totalBytes, details.bytes);
  assert.ok(totalBytes <= config.budgets.galaxyTexture.bytes);
  assert.deepEqual(paths.sort(), [...PLANET_HUB_GALAXY_PATHS].sort());
  assert.ok(manifest.sources["itch-assets/Models/SpaceLayers/milky-way-source.png"]);
});

test("planet hub stays outside the install shell and range media warms its lazy pack", () => {
  const sourceWorker = renderServiceWorker({
    cachePrefix: "planet-test-",
    version: "1.0.0",
    assets: ["./app.js"],
    lazyFiles: PLANET_HUB_SOURCE_LAZY_FILES.map((file) => `./${file}?v=1.0.0`),
    lazyPacks: ["./art/planet-hub/", "./vendor/three/"]
  });
  const shell = sourceWorker.match(/const SHELL = ([^;]+);/)?.[1] || "";
  const sourceLazyFiles = sourceWorker.match(/const LAZY_FILES = new Set\(([^;]+)\);/)?.[1] || "";
  assert.doesNotMatch(shell, /planet-hub|vendor\/three/);
  for (const file of PLANET_HUB_SOURCE_LAZY_FILES) {
    assert.match(sourceLazyFiles, new RegExp(file.replaceAll(".", "[.]")),
      `${file} must remain a source-server lazy file.`);
  }
  assert.match(sourceWorker, /[.]\/art\/planet-hub\//);
  assert.match(sourceWorker, /[.]\/vendor\/three\//);
  assert.match(sourceWorker, /\(isBirthdayAsset \|\| isLazyPackAsset\) && !\(await cache[.]match/);

  const packagedWorker = renderServiceWorker({
    cachePrefix: "planet-package-test-",
    version: "1.0.0",
    assets: ["./app.js"],
    lazyFiles: PLANET_HUB_RELEASE_LAZY_FILES.map((file) => `./${file}?v=1.0.0`),
    lazyPacks: ["./art/planet-hub/", "./vendor/three/"]
  });
  const packagedLazyFiles = packagedWorker.match(/const LAZY_FILES = new Set\(([^;]+)\);/)?.[1] || "";
  assert.match(packagedLazyFiles, /planet-hub-audio[.]mjs/,
    "The semantic audio director must stay releasable through the dedicated lazy boundary.");
  assert.match(packagedLazyFiles, /planet-hub-runtime[.]mjs/);
  assert.match(packagedLazyFiles, /planet-hub-cinematic[.]css/,
    "The focus-only cinematic styles must stay behind the Planet Hub lazy boundary.");
  assert.match(packagedLazyFiles, /celestial-atlas-runtime[.]mjs/,
    "The system atlas must stay behind the Planet Hub lazy boundary.");
  assert.doesNotMatch(packagedLazyFiles, /planet-hub-moods[.]mjs/,
    "The mood director must be embedded in the packaged runtime rather than emitted twice.");
});

test("the cinematic stylesheet is lazy and the static poster CSS stays in the document shell", async () => {
  const [document, app, baseStyles, cinematicStyles] = await Promise.all([
    readFile(projectFile("public/index.html"), "utf8"),
    readFile(projectFile("public/planet-hub-app.mjs"), "utf8"),
    readFile(projectFile("public/planet-hub.css"), "utf8"),
    readFile(projectFile("public/planet-hub-cinematic.css"), "utf8")
  ]);
  assert.match(document, /href="\/planet-hub[.]css[?]v=/);
  assert.doesNotMatch(document, /planet-hub-cinematic[.]css/);
  assert.match(app, /PLANET_HUB_CINEMATIC_STYLESHEET\s*=\s*"planet-hub-cinematic[.]css(?:[?]v=[^"]+)?"/);
  assert.match(app, /stylesheetLoader[?][.]\(\)[\s\S]*runtimeImporter\(\)/,
    "Cinematic styles must settle before the 3D runtime can reveal Home.");
  assert.ok(baseStyles.length > 0 && cinematicStyles.length > 0);
});

test("local and Pages preview servers declare GLB and WebM MIME types", async () => {
  const [server, preview] = await Promise.all([
    readFile(projectFile("server.mjs"), "utf8"),
    readFile(projectFile("scripts/serve-pages-preview.mjs"), "utf8")
  ]);
  for (const source of [server, preview]) {
    assert.match(source, /"[.]glb": "model\/gltf-binary"/);
    assert.match(source, /"[.]webm": "video\/webm"/);
  }
});

test("server CSP hashes the exact inline import-map text without unsafe-inline scripts", async () => {
  const [document, server] = await Promise.all([
    readFile(projectFile("public/index.html"), "utf8"),
    readFile(projectFile("server.mjs"), "utf8")
  ]);
  const text = importMapText(document);
  assert.ok(text.startsWith("\n") && text.endsWith("\n  "), "Import-map whitespace must remain part of the hashed source.");
  assert.match(importMapCspSource(document), /^sha256-[A-Za-z0-9+/]{43}=$/);
  assert.match(server, /script-src 'self' '\$\{gameImportMapCspSource\}'/);
  assert.doesNotMatch(server, /script-src[^;]*unsafe-inline/);
});
