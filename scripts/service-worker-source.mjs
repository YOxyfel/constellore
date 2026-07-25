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
  legacyCaches = [],
  navigationPath = "./"
}) {
  if (!/^[a-z0-9-]+$/i.test(cachePrefix || "")) throw new Error("A safe cache prefix is required.");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version || "")) throw new Error("A release version is required.");
  const safeNavigation = safeAssetPath(navigationPath);
  const shell = [safeNavigation, ...[...new Set(assets.map(safeAssetPath).filter((path) => path !== safeNavigation))].sort((left, right) => left.localeCompare(right, "en"))];
  const lazy = [...new Set(lazyAssets.map(safeLazyPrefix))]
    .sort((left, right) => left.localeCompare(right, "en"));
  return `const CACHE_PREFIX = ${JSON.stringify(cachePrefix)};
const CACHE = \`\${CACHE_PREFIX}${version}\`;
const LEGACY_CACHES = new Set(${JSON.stringify(legacyCaches)});
const BASE = new URL("./", self.registration.scope);
const SHELL = ${JSON.stringify(shell)}.map((path) => new URL(path, BASE).href);
const SHELL_URLS = new Set(SHELL);
const LAZY_PREFIXES = ${JSON.stringify(lazy)}.map((path) => new URL(path, BASE).href);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => (key.startsWith(CACHE_PREFIX) && key !== CACHE) || LEGACY_CACHES.has(key))
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.includes("/api/")) return;
  const isNavigation = event.request.mode === "navigate" && url.href.startsWith(BASE.href);
  const isLazyAsset = LAZY_PREFIXES.some((prefix) => url.href.startsWith(prefix));
  if (!isNavigation && !SHELL_URLS.has(url.href) && !isLazyAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (isLazyAsset) {
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
