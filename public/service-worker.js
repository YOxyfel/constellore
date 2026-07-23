const CACHE_PREFIX = "constellore-play-";
const CACHE = `${CACHE_PREFIX}3.0.0-beta.2`;
const LEGACY_CACHES = new Set(["constellore-shell-v24","constellore-play-v27"]);
const BASE = new URL("./", self.registration.scope);
const SHELL = ["/play/","/app.js?v=3.0.0-beta.2","/community-results.mjs?v=3.0.0-beta.2","/constellation-card.mjs?v=3.0.0-beta.2","/constellation-voyages.mjs?v=3.0.0-beta.2","/cosmetic-economy.mjs?v=3.0.0-beta.2","/cosmic-events.mjs?v=3.0.0-beta.2","/cosmic-twists.mjs?v=3.0.0-beta.2","/ctrl-hover.mjs?v=3.0.0-beta.2","/engagement-features.mjs?v=3.0.0-beta.2","/explore-sandbox.mjs?v=3.0.0-beta.2","/first-orbit.mjs?v=3.0.0-beta.2","/frictionless.mjs?v=3.0.0-beta.2","/home-menu.mjs?v=3.0.0-beta.2","/icon-192.png","/icon-512.png","/icon-maskable-512.png","/icon.svg","/living-atlas.mjs?v=3.0.0-beta.2","/local-beta.mjs?v=3.0.0-beta.2","/manifest.webmanifest","/mission-briefing.mjs?v=3.0.0-beta.2","/pending-scores.mjs?v=3.0.0-beta.2","/recipe-feedback.mjs?v=3.0.0-beta.2","/recipe-insight.mjs?v=3.0.0-beta.2","/recipe-mastery.mjs?v=3.0.0-beta.2","/release.json","/second-orbit.mjs?v=3.0.0-beta.2","/shift-board.mjs?v=3.0.0-beta.2","/signature-routes.mjs?v=3.0.0-beta.2","/styles.css?v=3.0.0-beta.2","/universe-director.mjs?v=3.0.0-beta.2"].map((path) => new URL(path, BASE).href);
const SHELL_URLS = new Set(SHELL);

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
  if (!isNavigation && !SHELL_URLS.has(url.href)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type !== "opaque") {
        const cache = await caches.open(CACHE);
        await cache.put(isNavigation ? SHELL[0] : event.request, response.clone());
      }
      return response;
    } catch {
      const cache = await caches.open(CACHE);
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
