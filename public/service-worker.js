const CACHE_PREFIX = "constellore-play-";
const CACHE = `${CACHE_PREFIX}3.3.0-beta.1`;
const LEGACY_CACHES = new Set(["constellore-shell-v24","constellore-play-v27"]);
const BASE = new URL("./", self.registration.scope);
const SHELL = ["/play/","/adaptive-difficulty.mjs?v=3.3.0-beta.1","/app-icon-woven-c-v1-192.png","/app-icon-woven-c-v1-32.png","/app-icon-woven-c-v1-512.png","/app-icon-woven-c-v1.png","/app.js?v=3.3.0-beta.1","/art/celestial-atlas-bg-v1.webp","/combination-report-delivery.mjs?v=3.3.0-beta.1","/community-results.mjs?v=3.3.0-beta.1","/constellation-card.mjs?v=3.3.0-beta.1","/constellation-voyages.mjs?v=3.3.0-beta.1","/cosmetic-economy.mjs?v=3.3.0-beta.1","/cosmic-events.mjs?v=3.3.0-beta.1","/cosmic-twists.mjs?v=3.3.0-beta.1","/ctrl-hover.mjs?v=3.3.0-beta.1","/engagement-features.mjs?v=3.3.0-beta.1","/explore-sandbox.mjs?v=3.3.0-beta.1","/first-orbit.mjs?v=3.3.0-beta.1","/frictionless.mjs?v=3.3.0-beta.1","/home-menu.mjs?v=3.3.0-beta.1","/icon-192.png","/icon-512.png","/icon-maskable-512.png","/icon.svg","/living-atlas.mjs?v=3.3.0-beta.1","/local-beta.mjs?v=3.3.0-beta.1","/manifest.webmanifest","/mission-briefing.mjs?v=3.3.0-beta.1","/pending-scores.mjs?v=3.3.0-beta.1","/rank-board-art-runtime.mjs?v=3.3.0-beta.1","/rank-board-art.mjs?v=3.3.0-beta.1","/recipe-feedback.mjs?v=3.3.0-beta.1","/recipe-insight.mjs?v=3.3.0-beta.1","/recipe-mastery.mjs?v=3.3.0-beta.1","/release.json","/remix-progression.mjs?v=3.3.0-beta.1","/remix-readiness.mjs?v=3.3.0-beta.1","/route-distance.mjs?v=3.3.0-beta.1","/route-rank-client.mjs?v=3.3.0-beta.1","/route-remixes.mjs?v=3.3.0-beta.1","/run-iq.mjs?v=3.3.0-beta.1","/second-orbit.mjs?v=3.3.0-beta.1","/shift-board.mjs?v=3.3.0-beta.1","/shuffled-start.mjs?v=3.3.0-beta.1","/signature-routes.mjs?v=3.3.0-beta.1","/simple-ui.css?v=3.3.0-beta.1","/styles.css?v=3.3.0-beta.1","/target-pool.mjs?v=3.3.0-beta.1","/universe-director.mjs?v=3.3.0-beta.1"].map((path) => new URL(path, BASE).href);
const SHELL_URLS = new Set(SHELL);
const LAZY_PREFIXES = ["/art/ranks/"].map((path) => new URL(path, BASE).href);

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
