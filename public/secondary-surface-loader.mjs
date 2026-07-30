const stylesheetPromises = new Map();

function unversionedAssetName(filename) {
  return String(filename || "").split("?", 1)[0];
}

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
    loadOptionalStylesheet("cosmos-circuit.css?v=5.0.0-beta.1"),
    import("./cosmos-circuit-runtime.mjs?v=5.0.0-beta.1")
  ]);
  return module.createCosmosCircuitRuntime(options);
}

export async function createLazyCosmeticsObservatory(options) {
  const [, module] = await Promise.all([
    loadOptionalStylesheet("cosmetics-observatory.css?v=5.0.0-beta.1"),
    import("./cosmetics-observatory.mjs?v=5.0.0-beta.1")
  ]);
  return module.createCosmeticsObservatory(options);
}

export async function createLazyCosmeticsObservatoryHost(options) {
  const [, , observatoryModule, hostModule] = await Promise.all([
    loadOptionalStylesheet("cosmetics-observatory.css?v=5.0.0-beta.1"),
    loadOptionalStylesheet("cosmetic-world-preview.css?v=5.0.0-beta.1"),
    import("./cosmetics-observatory.mjs?v=5.0.0-beta.1"),
    import("./cosmetic-world-preview.mjs?v=5.0.0-beta.1")
  ]);
  return hostModule.createCosmeticsObservatoryHost({
    ...options,
    createObservatory: observatoryModule.createCosmeticsObservatory
  });
}

export async function createLazyScramble(options) {
  const [, module, bridge] = await Promise.all([
    loadOptionalStylesheet("scramble.css?v=5.0.0-beta.1"),
    import("./scramble-runtime.mjs?v=5.0.0-beta.1"),
    import("./scramble-app-bridge.mjs?v=5.0.0-beta.1")
  ]);
  const onBeginMatch = options?.onBeginMatch;
  const onChapterChange = options?.onChapterChange;
  const projectForHost = (callback) => (match, metadata) => {
    const projection = bridge.projectScrambleHostMatch(match);
    return projection ? callback(projection, metadata) : false;
  };
  return module.createScrambleRuntime({
    ...options,
    onBeginMatch: typeof onBeginMatch === "function"
      ? projectForHost(onBeginMatch)
      : undefined,
    onChapterChange: typeof onChapterChange === "function"
      ? projectForHost(onChapterChange)
      : undefined
  });
}

export const SECONDARY_SURFACE_FILES = Object.freeze([
  "cosmos-circuit.css?v=5.0.0-beta.1",
  "cosmos-circuit-runtime.mjs?v=5.0.0-beta.1",
  "cosmos-circuit.mjs?v=5.0.0-beta.1",
  "cosmos-circuit-copy.mjs?v=5.0.0-beta.1",
  "circuit-lobby-tabs.mjs?v=5.0.0-beta.1",
  "circuit-live-ops.mjs?v=5.0.0-beta.1",
  "star-path.mjs?v=5.0.0-beta.1",
  "stardust-store.css?v=5.0.0-beta.1",
  "stardust-store.mjs?v=5.0.0-beta.1",
  "stardust-store-runtime.mjs?v=5.0.0-beta.1",
  "cosmetics-observatory.css?v=5.0.0-beta.1",
  "cosmetics-observatory.mjs?v=5.0.0-beta.1",
  "cosmetic-world-preview.css?v=5.0.0-beta.1",
  "cosmetic-world-preview.mjs?v=5.0.0-beta.1",
  "cosmic-interlude.css?v=5.0.0-beta.1",
  "scramble.css?v=5.0.0-beta.1",
  "scramble-runtime.mjs?v=5.0.0-beta.1",
  "scramble-app-bridge.mjs?v=5.0.0-beta.1",
  "scramble.mjs?v=5.0.0-beta.1",
  "scramble-arena.mjs?v=5.0.0-beta.1",
  "forge-clash.mjs?v=5.0.0-beta.1"
].map(unversionedAssetName));
