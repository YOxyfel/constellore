function safeAssetPath(value) {
  const path = String(value || "");
  if (path === "./") return path;
  if (!/^(?:[.]\/|\/)[a-zA-Z0-9._/?=-]+$/.test(path) || path.includes("..") || path.startsWith("//")) throw new Error(`Unsafe service-worker asset path: ${path}`);
  return path;
}

function safeLazyPrefix(value) {
  const path = safeAssetPath(value);
  if (!path.endsWith("/") || path.includes("?")) {
    throw new Error(`Unsafe service-worker lazy prefix: ${path}`);
  }
  return path;
}

export function renderServiceWorker({
  cachePrefix,
  version,
  assets,
  lazyAssets = [],
  lazyFiles = [],
  lazyPacks = [],
  legacyCaches = [],
  navigationPath = "./"
}) {
  if (!/^[a-z0-9-]+$/i.test(cachePrefix || "")) throw new Error("A safe cache prefix is required.");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version || "")) throw new Error("A release version is required.");
  const safeNavigation = safeAssetPath(navigationPath);
  const shell = [safeNavigation, ...[...new Set(assets.map(safeAssetPath).filter((path) => path !== safeNavigation))].sort((left, right) => left.localeCompare(right, "en"))];
  const lazy = [...new Set(lazyAssets.map(safeLazyPrefix))]
    .sort((left, right) => left.localeCompare(right, "en"));
  const files = [...new Set(lazyFiles.map(safeAssetPath))]
    .sort((left, right) => left.localeCompare(right, "en"));
  const packs = [...new Set(lazyPacks.map(safeLazyPrefix))]
    .sort((left, right) => left.localeCompare(right, "en"));
  return `const CACHE_PREFIX = ${JSON.stringify(cachePrefix)};
const RELEASE_VERSION = ${JSON.stringify(version)};
const CACHE = \`\${CACHE_PREFIX}${version}\`;
const LAZY_PACK_CACHE_PREFIX = \`\${CACHE_PREFIX}cosmetic-packs-\`;
const LAZY_PACK_CACHE = \`\${LAZY_PACK_CACHE_PREFIX}${version}\`;
const CURRENT_CACHES = new Set([CACHE, LAZY_PACK_CACHE]);
const LEGACY_CACHES = new Set(${JSON.stringify(legacyCaches)});
const IS_LOCAL_PREVIEW = ["localhost", "127.0.0.1", "::1"].includes(self.location.hostname);
const BASE = new URL("./", self.registration.scope);
const SHELL = ${JSON.stringify(shell)}.map((path) => new URL(path, BASE).href);
const SHELL_URLS = new Set(SHELL);
const LAZY_PREFIXES = ${JSON.stringify(lazy)}.map((path) => new URL(path, BASE).href);
const LAZY_FILES = new Set(${JSON.stringify(files)}.map((path) => new URL(path, BASE).href));
const LAZY_PACK_PREFIXES = ${JSON.stringify(packs)}.map((path) => new URL(path, BASE).href);

self.addEventListener("install", (event) => {
  if (IS_LOCAL_PREVIEW) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  // Keep the current worker in control until every page using it has closed or
  // a controlled page explicitly opts into this exact release. This prevents
  // an old document from loading lazy assets through a newly activated worker.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CONSTELLORE_ACTIVATE_UPDATE"
    && event.data?.version === RELEASE_VERSION) {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("activate", (event) => {
  if (IS_LOCAL_PREVIEW) {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) || LEGACY_CACHES.has(key))
      .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()));
    return;
  }
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => (key.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.has(key)) || LEGACY_CACHES.has(key))
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (IS_LOCAL_PREVIEW) return;
  if (event.request.method !== "GET") return;
  if (event.request.headers.has("range")) return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.includes("/api/")) return;
  const isNavigation = event.request.mode === "navigate" && url.href.startsWith(BASE.href);
  const isLazyAsset = LAZY_PREFIXES.some((prefix) => url.href.startsWith(prefix));
  const isLazyFile = LAZY_FILES.has(url.href);
  const isLazyPackAsset = LAZY_PACK_PREFIXES.some((prefix) => url.href.startsWith(prefix));
  if (!isNavigation && !SHELL_URLS.has(url.href) && !isLazyAsset && !isLazyFile && !isLazyPackAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(isLazyPackAsset ? LAZY_PACK_CACHE : CACHE);
    if (isNavigation) {
      // A controlled document and its lazy assets stay on one release. The
      // waiting worker owns the next shell and activates after this client is
      // gone (or after an explicit coordinated activation message).
      const cachedShell = await cache.match(SHELL[0]);
      if (cachedShell) return cachedShell;
    }
    if (isLazyAsset || isLazyFile || isLazyPackAsset) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
    }
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type !== "opaque") {
        await cache.put(isNavigation ? SHELL[0] : event.request, response.clone());
      }
      return response;
    } catch {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (isNavigation) {
        const fallback = await cache.match(SHELL[0]);
        if (fallback) return fallback;
      }
      return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
});
`;
}
