import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ALL_COSMETIC_BODY_CLASSES, COSMETIC_CATALOG } from "../public/cosmetic-economy.mjs";

const cssUrl = new URL("../public/cosmetics.css", import.meta.url);
const css = await readFile(cssUrl, "utf8");
const NEW_KIT_SLUGS = ["pixel-frontier", "bubble-reef", "stellar-vanguard"];
const NEW_KIT_RESPONSIVE_PATHS = NEW_KIT_SLUGS.flatMap((slug) =>
  ["home", "gate"].flatMap((scene) =>
    ["sm", "md", "lg"].map((size) => `/art/cosmetics/${slug}/${scene}-${size}.webp`)
  )
);

test("cosmetics renderer covers every canonical collection and slot identifier", () => {
  const required = [
    "collection-celestial-atlas",
    "collection-aurora-archive",
    "collection-solar-foundry",
    "word-plaque-woven-atlas",
    "word-plaque-frostglass",
    "word-plaque-engraved-brass",
    "word-plaque-cartographer",
    "board-scene-rank-sky",
    "board-scene-nebula-glass",
    "board-scene-cosmic-blueprint",
    "home-scene-constellore-cosmos",
    "home-scene-aurora-observatory",
    "home-scene-solar-orrery",
    "gate-style-constellore",
    "gate-style-crystal-archive",
    "gate-style-foundry",
    "ui-finish-woven-atlas",
    "ui-finish-frostglass",
    "ui-finish-engraved-brass",
    "trail-set-classic-thread",
    "trail-set-aurora-ribbon",
    "trail-set-ember-comet",
    "trail-set-first-light",
    "sound-theme-cosmic-chimes",
    "sound-theme-glass-orbit",
    "sound-theme-analog-stars"
  ];

  for (const identifier of required) {
    assert.match(css, new RegExp(String.raw`\b${identifier}\b`), `missing ${identifier}`);
  }
});

test("renderer aliases the canonical catalog body-class contract", () => {
  const canonical = [
    "cosmetic-collection--celestial-atlas",
    "cosmetic-collection--aurora-archive",
    "cosmetic-collection--solar-foundry",
    "cosmetic-collection--lunar-garden",
    "cosmetic-collection--eclipse-sovereign",
    "cosmetic-collection--pixel-frontier",
    "cosmetic-collection--bubble-reef",
    "cosmetic-collection--stellar-vanguard",
    "cosmetic-word-plaque--woven-atlas",
    "cosmetic-word-plaque--frostglass",
    "cosmetic-word-plaque--engraved-brass",
    "cosmetic-word-plaque--moonstone-bloom",
    "cosmetic-word-plaque--sovereign-obsidian",
    "cosmetic-word-plaque--cartridge-frame",
    "cosmetic-word-plaque--bubble-glass",
    "cosmetic-word-plaque--vanguard-alloy",
    "cosmetic-word-plaque--cartographer",
    "cosmetic-trail-set--classic-thread",
    "cosmetic-trail-set--aurora-ribbon",
    "cosmetic-trail-set--ember-comet",
    "cosmetic-trail-set--moonpetal-trace",
    "cosmetic-trail-set--corona-rift",
    "cosmetic-trail-set--scanline-spark",
    "cosmetic-trail-set--bubble-stream",
    "cosmetic-trail-set--ion-crescent",
    "cosmetic-trail-set--first-light",
    "cosmetic-board-scene--rank-sky",
    "cosmetic-board-scene--nebula-glass",
    "cosmetic-board-scene--cosmic-blueprint",
    "cosmetic-board-finish--night-garden",
    "cosmetic-board-finish--eclipse-court",
    "cosmetic-board-finish--pixel-cosmos",
    "cosmetic-board-finish--coral-storybook",
    "cosmetic-board-finish--command-deck",
    "cosmetic-home-scene--constellore-cosmos",
    "cosmetic-home-scene--aurora-observatory",
    "cosmetic-home-scene--solar-orrery",
    "cosmetic-home-scene--lunar-garden",
    "cosmetic-home-scene--eclipse-throne",
    "cosmetic-home-scene--bit-observatory",
    "cosmetic-home-scene--reef-observatory",
    "cosmetic-home-scene--orbital-sanctuary",
    "cosmetic-gate-style--constellore",
    "cosmetic-gate-style--crystal-archive",
    "cosmetic-gate-style--foundry",
    "cosmetic-gate-style--moon-garden",
    "cosmetic-gate-style--sovereign-eclipse",
    "cosmetic-gate-style--pixel-warp",
    "cosmetic-gate-style--pearl-current",
    "cosmetic-gate-style--meridian-gate",
    "cosmetic-gate-style--weekly-sigil",
    "cosmetic-ui-finish--woven-atlas",
    "cosmetic-ui-finish--frostglass",
    "cosmetic-ui-finish--antique-brass",
    "cosmetic-ui-finish--lunar-silver",
    "cosmetic-ui-finish--sovereign-frame",
    "cosmetic-ui-finish--arcade-console",
    "cosmetic-ui-finish--coral-pop",
    "cosmetic-ui-finish--command-alloy",
    "cosmetic-sound-theme--cosmic-chimes",
    "cosmetic-sound-theme--glass-orbit",
    "cosmetic-sound-theme--analog-stars",
    "cosmetic-sound-theme--moon-bells",
    "cosmetic-sound-theme--eclipse-choir",
    "cosmetic-sound-theme--pixel-pulse",
    "cosmetic-sound-theme--bubble-beat",
    "cosmetic-sound-theme--void-overture"
  ];

  for (const identifier of canonical) {
    assert.ok(css.includes(`.${identifier}`), `missing canonical class .${identifier}`);
  }
});

test("renderer stays in sync with every class emitted by the canonical catalog", () => {
  for (const className of ALL_COSMETIC_BODY_CLASSES) {
    assert.ok(css.includes(`.${className}`), `missing catalog-emitted class .${className}`);
  }
});

test("word recipes cover board, inventory, ghost, category, badge, and interaction states", () => {
  for (const selector of [
    ".board-word",
    ".inventory-word",
    ".tray-drag-ghost",
    "[data-category=",
    ".emoji",
    ".source-tag",
    ".mastery-tag",
    ".cosmetics-observatory__button",
    ".cosmetics-observatory__segment-button",
    ".keyboard-selected",
    ".drop-target",
    ".tutorial-hot",
    ".sense-hot",
    ".rejected",
    ":focus-visible"
  ]) {
    assert.ok(css.includes(selector), `missing word/state selector ${selector}`);
  }
  assert.match(css, /min-height:\s*44px/);
});

test("board finishes retain runtime and legacy rank-art layers", () => {
  assert.ok(
    css.includes("var(--rank-board-image, var(--rank-board-art, none))"),
    "rank artwork must remain in the composed background stack"
  );
  assert.doesNotMatch(css, /--rank-board-(?:image|art)\s*:/, "renderer must not replace rank art variables");
  assert.match(css, /--rank-board-focal/);
  assert.match(css, /--rank-board-fallback/);
});

test("home and gate collections use local responsive, on-demand assets", () => {
  for (const path of [
    "/art/cosmetics/aurora-archive/home-sm.webp",
    "/art/cosmetics/aurora-archive/home-md.webp",
    "/art/cosmetics/aurora-archive/home-lg.webp",
    "/art/cosmetics/aurora-archive/gate-sm.webp",
    "/art/cosmetics/aurora-archive/gate-md.webp",
    "/art/cosmetics/aurora-archive/gate-lg.webp",
    "/art/cosmetics/solar-foundry/home-sm.webp",
    "/art/cosmetics/solar-foundry/home-md.webp",
    "/art/cosmetics/solar-foundry/home-lg.webp",
    "/art/cosmetics/solar-foundry/gate-sm.webp",
    "/art/cosmetics/solar-foundry/gate-md.webp",
    "/art/cosmetics/solar-foundry/gate-lg.webp",
    "/art/cosmetics/lunar-garden/home-sm.webp",
    "/art/cosmetics/lunar-garden/home-md.webp",
    "/art/cosmetics/lunar-garden/home-lg.webp",
    "/art/cosmetics/lunar-garden/gate-sm.webp",
    "/art/cosmetics/lunar-garden/gate-md.webp",
    "/art/cosmetics/lunar-garden/gate-lg.webp",
    "/art/cosmetics/eclipse-sovereign/home-sm.webp",
    "/art/cosmetics/eclipse-sovereign/home-md.webp",
    "/art/cosmetics/eclipse-sovereign/home-lg.webp",
    "/art/cosmetics/eclipse-sovereign/gate-sm.webp",
    "/art/cosmetics/eclipse-sovereign/gate-md.webp",
    "/art/cosmetics/eclipse-sovereign/gate-lg.webp",
    ...NEW_KIT_RESPONSIVE_PATHS
  ]) {
    assert.ok(css.includes(path), `missing responsive asset ${path}`);
  }

  const catalogSource = JSON.stringify(COSMETIC_CATALOG);
  let verifiedNewKitReferences = 0;
  assert.equal(NEW_KIT_RESPONSIVE_PATHS.length, 18);
  for (const path of NEW_KIT_RESPONSIVE_PATHS) {
    assert.ok(css.includes(path), `renderer is missing new-kit asset ${path}`);
    verifiedNewKitReferences += 1;
    assert.ok(catalogSource.includes(path), `catalog is missing new-kit asset ${path}`);
    verifiedNewKitReferences += 1;
  }
  assert.equal(verifiedNewKitReferences, 36);
  assert.match(css, /image-rendering:\s*pixelated/, "Pixel Frontier keeps its hard pixel edges when scenes scale");

  assert.doesNotMatch(css, /(?:https?:)?\/\//i, "cosmetics must not load remote assets");
  assert.doesNotMatch(css, /data:[^;]+;base64/i, "cosmetics must not embed base64 payloads");
  assert.doesNotMatch(css, /@import\b/i, "cosmetics must be a standalone local layer");
});

test("Lunar stays slot-based while Eclipse reserves its holistic shell for the exact collection", () => {
  assert.match(
    css,
    /body(?::is\([^)]*[.]cosmetic-home-scene--lunar-garden[^)]*\)|[.]cosmetic-home-scene--lunar-garden)\s*\{\s*--home-cosmos-art:/
  );
  assert.match(
    css,
    /body(?::is\([^)]*[.]cosmetic-ui-finish--lunar-silver[^)]*\)|[.]cosmetic-ui-finish--lunar-silver)\s*\{[\s\S]*?--cosmetic-panel-surface:/
  );
  assert.doesNotMatch(
    css,
    /body[.]cosmetic-(?:home-scene--lunar-garden|ui-finish--lunar-silver)[^{]*#startScreen [^{]*[.]start-nav/,
    "Lunar pieces must not replace the familiar Home composition"
  );

  const exactShell = "body.simple-ui.cosmetic-collection--eclipse-sovereign";
  for (const selector of [
    "#startScreen",
    "#startScreen::before",
    "#startScreen .start-nav",
    "#startScreen .recipe-example",
    "#startScreen .primary-orbit-panel",
    "#startScreen :is(.home-catalog",
    ":is(.modal, .hub-menu-action, .profile-disclosure)"
  ]) {
    assert.ok(css.includes(`${exactShell} ${selector}`), `missing exact Eclipse shell selector ${selector}`);
  }
  assert.doesNotMatch(
    css,
    /body[.]cosmetic-home-scene--eclipse-throne[^{]*#startScreen [^{]*:is\([.]home-catalog/,
    "an individually equipped Eclipse background must not activate the complete shell"
  );
});

test("effects and accessibility policies provide explicit fallbacks", () => {
  for (const contract of [
    '[data-cosmetic-effects="full"]',
    '[data-cosmetic-effects="reduced"]',
    '[data-cosmetic-effects="off"]',
    '[data-save-data="true"]',
    "@media (prefers-reduced-data: reduce)",
    "@media (prefers-reduced-motion: reduce)",
    "@media (prefers-contrast: more)",
    "@media (forced-colors: active)",
    "forced-color-adjust",
    "--cosmetic-trail-enabled"
  ]) {
    assert.ok(css.includes(contract), `missing accessibility/effects contract ${contract}`);
  }

  for (const fallback of [
    'cosmetic-collection--eclipse-sovereign[data-cosmetic-effects="reduced"]',
    'cosmetic-collection--eclipse-sovereign[data-cosmetic-effects="off"]',
    "body.simple-ui.cosmetic-collection--eclipse-sovereign #startScreen"
  ]) {
    assert.ok(css.includes(fallback), `missing Eclipse fallback ${fallback}`);
  }
});
