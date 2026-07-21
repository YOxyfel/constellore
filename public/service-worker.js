const CACHE = "constellore-shell-v24";
const SHELL = ["/play/", "/styles.css?v=2.7.0", "/app.js?v=1.14.0", "/ctrl-hover.mjs?v=1.0.0", "/shift-board.mjs?v=1.1.0", "/frictionless.mjs?v=1.0.0", "/mission-briefing.mjs?v=1.0.1", "/recipe-mastery.mjs?v=1.0.0", "/engagement-features.mjs?v=1.2.0", "/first-orbit.mjs?v=1.0.0", "/universe-director.mjs?v=1.0.0", "/constellation-card.mjs?v=1.0.0", "/cosmetic-economy.mjs?v=1.0.0", "/recipe-feedback.mjs?v=1.0.0", "/pending-scores.mjs?v=1.0.0", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === "navigate") return caches.match("/play/");
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }));
});
