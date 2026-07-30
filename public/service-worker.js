const CACHE_PREFIX = "constellore-play-";
const RELEASE_VERSION = "5.0.0-beta.1";
const CACHE = `${CACHE_PREFIX}5.0.0-beta.1`;
const LAZY_PACK_CACHE_PREFIX = `${CACHE_PREFIX}cosmetic-packs-`;
const LAZY_PACK_CACHE = `${LAZY_PACK_CACHE_PREFIX}5.0.0-beta.1`;
const CURRENT_CACHES = new Set([CACHE, LAZY_PACK_CACHE]);
const LEGACY_CACHES = new Set(["constellore-shell-v24","constellore-play-v27"]);
const IS_LOCAL_PREVIEW = ["localhost", "127.0.0.1", "::1"].includes(self.location.hostname);
const BASE = new URL("./", self.registration.scope);
const SHELL = ["/play/","/account-profile.mjs?v=5.0.0-beta.1","/adaptive-difficulty.mjs?v=5.0.0-beta.1","/app-icon-woven-c-v1-192.png","/app-icon-woven-c-v1-32.png","/app-icon-woven-c-v1-512.png","/app-icon-woven-c-v1.png","/app.js?v=5.0.0-beta.1","/art/celestial-atlas-bg-v1.webp","/audio-runtime.mjs?v=5.0.0-beta.1","/combination-report-delivery.mjs?v=5.0.0-beta.1","/community-results.mjs?v=5.0.0-beta.1","/constellation-card.mjs?v=5.0.0-beta.1","/constellation-voyages.mjs?v=5.0.0-beta.1","/cosmetic-canvas.mjs?v=5.0.0-beta.1","/cosmetic-catalog.mjs?v=5.0.0-beta.1","/cosmetic-economy.mjs?v=5.0.0-beta.1","/cosmetic-preload-bootstrap.js?v=5.0.0-beta.1","/cosmetics.css?v=5.0.0-beta.1","/cosmic-events.mjs?v=5.0.0-beta.1","/cosmic-gate.css?v=5.0.0-beta.1","/cosmic-gate.mjs?v=5.0.0-beta.1","/cosmic-interlude-runtime.mjs?v=5.0.0-beta.1","/cosmic-interludes.mjs?v=5.0.0-beta.1","/cosmic-quotes.mjs?v=5.0.0-beta.1","/cosmic-twists.mjs?v=5.0.0-beta.1","/ctrl-hover.mjs?v=5.0.0-beta.1","/default-profile.mjs?v=5.0.0-beta.1","/developer-console-runtime.mjs?v=5.0.0-beta.1","/developer-console.css?v=5.0.0-beta.1","/developer-console.mjs?v=5.0.0-beta.1","/engagement-features.mjs?v=5.0.0-beta.1","/epic-home.css?v=5.0.0-beta.1","/explore-sandbox.mjs?v=5.0.0-beta.1","/feedback-preferences-ui.mjs?v=5.0.0-beta.1","/first-game-experience.mjs?v=5.0.0-beta.1","/first-orbit.mjs?v=5.0.0-beta.1","/frictionless.mjs?v=5.0.0-beta.1","/golden-targets.mjs?v=5.0.0-beta.1","/hero-recipes.mjs?v=5.0.0-beta.1","/home-menu-view.mjs?v=5.0.0-beta.1","/home-menu.mjs?v=5.0.0-beta.1","/icon-192.png","/icon-512.png","/icon-maskable-512.png","/icon.svg","/initial-app-state.mjs?v=5.0.0-beta.1","/living-atlas.mjs?v=5.0.0-beta.1","/local-beta.mjs?v=5.0.0-beta.1","/manifest.webmanifest","/mastery-catalog.mjs?v=5.0.0-beta.1","/mission-briefing.mjs?v=5.0.0-beta.1","/path-guard.mjs?v=5.0.0-beta.1","/pending-scores.mjs?v=5.0.0-beta.1","/profile-rank-surface.mjs?v=5.0.0-beta.1","/rank-board-art-runtime.mjs?v=5.0.0-beta.1","/rank-board-art.mjs?v=5.0.0-beta.1","/recipe-feedback.mjs?v=5.0.0-beta.1","/recipe-insight.mjs?v=5.0.0-beta.1","/recipe-mastery.mjs?v=5.0.0-beta.1","/release.json","/remix-progression.mjs?v=5.0.0-beta.1","/remix-readiness.mjs?v=5.0.0-beta.1","/reveal-presentation.mjs?v=5.0.0-beta.1","/reveal-tree.mjs?v=5.0.0-beta.1","/route-distance.mjs?v=5.0.0-beta.1","/route-rank-client.mjs?v=5.0.0-beta.1","/route-remixes.mjs?v=5.0.0-beta.1","/run-entry.mjs?v=5.0.0-beta.1","/run-iq.mjs?v=5.0.0-beta.1","/second-orbit.mjs?v=5.0.0-beta.1","/secondary-surface-loader.mjs?v=5.0.0-beta.1","/session-resume.mjs?v=5.0.0-beta.1","/share-card-runtime.mjs?v=5.0.0-beta.1","/shift-board.mjs?v=5.0.0-beta.1","/shuffled-start.mjs?v=5.0.0-beta.1","/signature-routes.mjs?v=5.0.0-beta.1","/simple-ui.css?v=5.0.0-beta.1","/styles.css?v=5.0.0-beta.1","/target-pool.mjs?v=5.0.0-beta.1","/universe-director.mjs?v=5.0.0-beta.1","/victory-handoff.mjs?v=5.0.0-beta.1"].map((path) => new URL(path, BASE).href);
const SHELL_URLS = new Set(SHELL);
const LAZY_PREFIXES = ["/art/home/","/art/ranks/","/art/transitions/","/cinematic/","/story/"].map((path) => new URL(path, BASE).href);
const LAZY_FILES = new Set(["/circuit-live-ops.mjs?v=5.0.0-beta.1","/circuit-lobby-tabs.mjs?v=5.0.0-beta.1","/cosmetic-world-preview.css?v=5.0.0-beta.1","/cosmetic-world-preview.mjs?v=5.0.0-beta.1","/cosmetics-observatory.css?v=5.0.0-beta.1","/cosmetics-observatory.mjs?v=5.0.0-beta.1","/cosmic-interlude.css?v=5.0.0-beta.1","/cosmos-circuit-copy.mjs?v=5.0.0-beta.1","/cosmos-circuit-runtime.mjs?v=5.0.0-beta.1","/cosmos-circuit.css?v=5.0.0-beta.1","/cosmos-circuit.mjs?v=5.0.0-beta.1","/forge-clash.mjs?v=5.0.0-beta.1","/scramble-app-bridge.mjs?v=5.0.0-beta.1","/scramble-arena.mjs?v=5.0.0-beta.1","/scramble-runtime.mjs?v=5.0.0-beta.1","/scramble.css?v=5.0.0-beta.1","/scramble.mjs?v=5.0.0-beta.1","/star-path.mjs?v=5.0.0-beta.1","/stardust-store-runtime.mjs?v=5.0.0-beta.1","/stardust-store.css?v=5.0.0-beta.1","/stardust-store.mjs?v=5.0.0-beta.1"].map((path) => new URL(path, BASE).href));
const LAZY_PACK_PREFIXES = ["/art/cosmetics/","/audio/"].map((path) => new URL(path, BASE).href);

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
