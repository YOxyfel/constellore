export {
  createMoonResultPresentation,
  createMoonWorldweavingActions
} from "./moon-result-presentation.mjs?v=5.0.0-beta.4";
export { createMoonOutpostActions } from "./moon-outpost-actions.mjs?v=5.0.0-beta.4";
export { createMoonHeartActions } from "./moon-heart-actions.mjs?v=5.0.0-beta.4";

const stylesheetPromises = new Map();

function unversionedAssetName(filename) {
  return String(filename || "").split("?", 1)[0];
}

// Release-boundary inventories live beside the optional-surface loader so the
// server, Pages, itch, service worker, and performance audit all classify the
// same files. The board is part of the playable offline shell; the opening
// projection is requested only when its cinematic experience is entered.
export const COMBINING_BOARD_CORE_FILES = Object.freeze([
  "combining-board.css?v=5.0.0-beta.4"
].map(unversionedAssetName));

export const COMBINING_BOARD_LAZY_FILES = Object.freeze([
  "combining-board-domain.mjs?v=5.0.0-beta.4",
  "combining-board-runtime.mjs?v=5.0.0-beta.4",
  "combining-board-scene.mjs?v=5.0.0-beta.4"
].map(unversionedAssetName));

export const PLAY_ON_DEMAND_FILES = Object.freeze([
  "concept-matter.mjs?v=5.0.0-beta.4",
  "concept-matter-runtime.mjs?v=5.0.0-beta.4",
  "concept-matter-app.mjs?v=5.0.0-beta.4"
].map(unversionedAssetName));

export const VOYAGE_PROJECTION_LAZY_FILES = Object.freeze([
  "voyage-projection-domain.mjs?v=5.0.0-beta.4",
  "voyage-projection-runtime.mjs?v=5.0.0-beta.4",
  "voyage-projection-scene.mjs?v=5.0.0-beta.4",
  "cinematic/voyage-projection-experience.css?v=5.0.0-beta.4",
  "cinematic/voyage-projection-experience.mjs?v=5.0.0-beta.4",
  "cinematic/voyage-projection-media.mjs?v=5.0.0-beta.4",
  "cinematic/voyage-projection-media.json"
].map(unversionedAssetName));

function stylesheetHref(filename) {
  const url = new URL(`./${unversionedAssetName(filename)}`, import.meta.url);
  const version = new URL(import.meta.url).searchParams.get("v");
  if (version) url.searchParams.set("v", version);
  return url.href;
}

export function loadOptionalStylesheet(filename, documentRef = globalThis.document) {
  const href = stylesheetHref(filename);
  if (stylesheetPromises.has(href)) return stylesheetPromises.get(href);
  const promise = new Promise((resolve, reject) => {
    const links = [...(documentRef?.querySelectorAll?.('link[rel="stylesheet"]') || [])];
    let link = links.find((candidate) => candidate.href === href);
    if (link?.sheet) {
      resolve(link);
      return;
    }
    if (!link) {
      link = documentRef.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.optionalSurface = filename;
      documentRef.head.append(link);
    }
    link.addEventListener("load", () => resolve(link), { once: true });
    link.addEventListener("error", () => {
      stylesheetPromises.delete(href);
      reject(new Error(`${filename} could not be loaded.`));
    }, { once: true });
  });
  stylesheetPromises.set(href, promise);
  return promise;
}

export async function createLazyCosmosCircuit(options) {
  const [, module] = await Promise.all([
    loadOptionalStylesheet("cosmos-circuit.css?v=5.0.0-beta.4"),
    import("./cosmos-circuit-runtime.mjs?v=5.0.0-beta.4")
  ]);
  return module.createCosmosCircuitRuntime(options);
}

export async function createLazyCosmeticsObservatory(options) {
  const [, , , , module] = await Promise.all([
    loadOptionalStylesheet("cosmetics-observatory.css?v=5.0.0-beta.4"),
    loadOptionalStylesheet("cosmetics-observatory-full-page.css?v=5.0.0-beta.4"),
    loadOptionalStylesheet("profile-rank-frame.css?v=5.0.0-beta.4"),
    loadOptionalStylesheet("arena-duel-card.css?v=5.0.0-beta.4"),
    import("./cosmetics-observatory.mjs?v=5.0.0-beta.4")
  ]);
  return module.createCosmeticsObservatory(options);
}

export async function createLazyCosmeticsObservatoryHost(options) {
  const [, , , , , observatoryModule, hostModule] = await Promise.all([
    loadOptionalStylesheet("cosmetics-observatory.css?v=5.0.0-beta.4"),
    loadOptionalStylesheet("cosmetics-observatory-full-page.css?v=5.0.0-beta.4"),
    loadOptionalStylesheet("profile-rank-frame.css?v=5.0.0-beta.4"),
    loadOptionalStylesheet("arena-duel-card.css?v=5.0.0-beta.4"),
    loadOptionalStylesheet("cosmetic-world-preview.css?v=5.0.0-beta.4"),
    import("./cosmetics-observatory.mjs?v=5.0.0-beta.4"),
    import("./cosmetic-world-preview.mjs?v=5.0.0-beta.4")
  ]);
  return hostModule.createCosmeticsObservatoryHost({
    ...options,
    createObservatory: observatoryModule.createCosmeticsObservatory
  });
}

export async function createLazyScramble(options) {
  const [, , module, bridge, frameModule] = await Promise.all([
    loadOptionalStylesheet("scramble.css?v=5.0.0-beta.4"),
    loadOptionalStylesheet("arena-duel-card.css?v=5.0.0-beta.4"),
    import("./scramble-runtime.mjs?v=5.0.0-beta.4"),
    import("./scramble-app-bridge.mjs?v=5.0.0-beta.4"),
    import("./profile-rank-frame.mjs?v=5.0.0-beta.4")
  ]);
  const onBeginMatch = options?.onBeginMatch;
  const onChapterChange = options?.onChapterChange;
  const projectForHost = (callback) => (match, metadata) => {
    const projection = bridge.projectScrambleHostMatch(match);
    return projection ? callback(projection, metadata) : false;
  };
  return module.createScrambleRuntime({
    ...options,
    frameSlug: options?.frameSlug || (() => frameModule.readStoredProfileFrame()),
    onBeginMatch: typeof onBeginMatch === "function"
      ? projectForHost(onBeginMatch)
      : undefined,
    onChapterChange: typeof onChapterChange === "function"
      ? projectForHost(onChapterChange)
      : undefined
  });
}

export async function createLazyMoonWorldweaving(options) {
  const [, module] = await Promise.all([
    loadOptionalStylesheet("moon-worldweaving.css?v=5.0.0-beta.4"),
    import("./moon-worldweaving-runtime.mjs?v=5.0.0-beta.4")
  ]);
  return module.createMoonWorldweavingRuntime(options);
}

export async function createLazyMoonOutpost(options) {
  const [, module] = await Promise.all([
    loadOptionalStylesheet("moon-outpost.css?v=5.0.0-beta.4"),
    import("./moon-outpost-runtime.mjs?v=5.0.0-beta.4")
  ]);
  return module.createMoonOutpostRuntime(options);
}

export async function createLazyMoonHeartProject(options) {
  const [, module] = await Promise.all([
    loadOptionalStylesheet("moon-heart-project.css?v=5.0.0-beta.4"),
    import("./moon-heart-project-runtime.mjs?v=5.0.0-beta.4")
  ]);
  return module.createMoonHeartProjectRuntime(options);
}

export const SECONDARY_SURFACE_FILES = Object.freeze([
  ...COMBINING_BOARD_LAZY_FILES,
  ...VOYAGE_PROJECTION_LAZY_FILES,
  "moon-worldweaving.css?v=5.0.0-beta.4",
  "moon-worldweaving-runtime.mjs?v=5.0.0-beta.4",
  "moon-outpost.css?v=5.0.0-beta.4",
  "moon-outpost-runtime.mjs?v=5.0.0-beta.4",
  "moon-outpost-presentation.mjs?v=5.0.0-beta.4",
  "moon-outpost-actions.mjs?v=5.0.0-beta.4",
  "moon-home-project-entry.mjs?v=5.0.0-beta.4",
  "moon-project-launch.mjs?v=5.0.0-beta.4",
  "moon-heart-project.css?v=5.0.0-beta.4",
  "moon-heart-project-runtime.mjs?v=5.0.0-beta.4",
  "moon-heart-project-presentation.mjs?v=5.0.0-beta.4",
  "moon-heart-actions.mjs?v=5.0.0-beta.4",
  "moon-result-presentation.mjs?v=5.0.0-beta.4",
  "cosmos-circuit.css?v=5.0.0-beta.4",
  "cosmos-circuit-runtime.mjs?v=5.0.0-beta.4",
  "cosmos-circuit.mjs?v=5.0.0-beta.4",
  "cosmos-circuit-copy.mjs?v=5.0.0-beta.4",
  "circuit-lobby-tabs.mjs?v=5.0.0-beta.4",
  "circuit-live-ops.mjs?v=5.0.0-beta.4",
  "star-path.mjs?v=5.0.0-beta.4",
  "stardust-store.css?v=5.0.0-beta.4",
  "stardust-store.mjs?v=5.0.0-beta.4",
  "stardust-store-runtime.mjs?v=5.0.0-beta.4",
  "cosmetics-observatory.css?v=5.0.0-beta.4",
  "cosmetics-observatory-full-page.css?v=5.0.0-beta.4",
  "profile-rank-frame.css?v=5.0.0-beta.4",
  "profile-rank-frame.mjs?v=5.0.0-beta.4",
  "profile-frame-catalog.mjs?v=5.0.0-beta.4",
  "arena-duel-card.css?v=5.0.0-beta.4",
  "arena-duel-card.mjs?v=5.0.0-beta.4",
  "cosmetics-observatory.mjs?v=5.0.0-beta.4",
  "cosmetic-world-preview.css?v=5.0.0-beta.4",
  "cosmetic-world-preview.mjs?v=5.0.0-beta.4",
  "cosmic-interlude.css?v=5.0.0-beta.4",
  "scramble.css?v=5.0.0-beta.4",
  "scramble-runtime.mjs?v=5.0.0-beta.4",
  "scramble-app-bridge.mjs?v=5.0.0-beta.4",
  "scramble.mjs?v=5.0.0-beta.4",
  "scramble-arena.mjs?v=5.0.0-beta.4",
  "forge-clash.mjs?v=5.0.0-beta.4"
].map(unversionedAssetName));
