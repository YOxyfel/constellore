const CACHE_PREFIX = "constellore-play-";
const RELEASE_VERSION = "5.0.0-beta.4";
const CACHE = `${CACHE_PREFIX}5.0.0-beta.4`;
const LAZY_PACK_CACHE_PREFIX = `${CACHE_PREFIX}cosmetic-packs-`;
const LAZY_PACK_CACHE = `${LAZY_PACK_CACHE_PREFIX}5.0.0-beta.4`;
const BIRTHDAY_CACHE_PREFIX = `${CACHE_PREFIX}birthday-voyage-`;
const BIRTHDAY_CACHE = `${BIRTHDAY_CACHE_PREFIX}5.0.0-beta.4-v2`;
const CURRENT_CACHES = new Set([CACHE, LAZY_PACK_CACHE, BIRTHDAY_CACHE]);
const LEGACY_CACHES = new Set(["constellore-shell-v24","constellore-play-v27"]);
const IS_LOCAL_PREVIEW = ["localhost", "127.0.0.1", "::1"].includes(self.location.hostname);
const BASE = new URL("./", self.registration.scope);
const SHELL = ["/play/","/account-profile.mjs?v=5.0.0-beta.4","/adaptive-difficulty.mjs?v=5.0.0-beta.4","/app-icon-woven-c-v1-192.png","/app-icon-woven-c-v1-32.png","/app-icon-woven-c-v1-512.png","/app-icon-woven-c-v1.png","/app.js?v=5.0.0-beta.4","/arena-rank.mjs?v=5.0.0-beta.4","/art/celestial-atlas-bg-v1.webp","/art/moon-settlement/manifest.json","/art/moon-settlement/materials/fieldkit-basecolor-low.png","/art/moon-settlement/materials/fieldkit-basecolor-standard.png","/art/moon-settlement/materials/fieldkit-normal-low.png","/art/moon-settlement/materials/fieldkit-normal-standard.png","/art/moon-settlement/materials/fieldkit-orm-low.png","/art/moon-settlement/materials/fieldkit-orm-standard.png","/art/moon-settlement/materials/fieldkit-role-contract.json","/art/moon-settlement/models/bastion-shelter-low.glb","/art/moon-settlement/models/bastion-shelter-standard.glb","/art/moon-settlement/models/beacon-signal-low.glb","/art/moon-settlement/models/beacon-signal-standard.glb","/art/moon-settlement/models/greenhouse-low.glb","/art/moon-settlement/models/greenhouse-standard.glb","/art/moon-settlement/models/haven-shelter-low.glb","/art/moon-settlement/models/haven-shelter-standard.glb","/art/moon-settlement/models/hive-shelter-low.glb","/art/moon-settlement/models/hive-shelter-standard.glb","/art/moon-settlement/models/lunar-power-low.glb","/art/moon-settlement/models/lunar-power-standard.glb","/art/moon-settlement/models/processor-low.glb","/art/moon-settlement/models/processor-standard.glb","/art/moon-settlement/models/reservoir-low.glb","/art/moon-settlement/models/reservoir-standard.glb","/art/moon-settlement/models/solar-power-low.glb","/art/moon-settlement/models/solar-power-standard.glb","/art/moon-settlement/models/stars-signal-low.glb","/art/moon-settlement/models/stars-signal-standard.glb","/art/moon-settlement/models/starter-vault-low.glb","/art/moon-settlement/models/starter-vault-standard.glb","/art/moon-settlement/models/storage-low.glb","/art/moon-settlement/models/storage-standard.glb","/art/website/board-current.webp","/art/website/capture-metadata.json","/art/website/moonhaven-current.webp","/audio-runtime.mjs?v=5.0.0-beta.4","/board-camera-runtime.mjs?v=5.0.0-beta.4","/combination-report-delivery.mjs?v=5.0.0-beta.4","/combining-board.css?v=5.0.0-beta.4","/community-results.mjs?v=5.0.0-beta.4","/concept-bloom-domain.mjs?v=5.0.0-beta.4","/concept-bloom-lab.css?v=5.0.0-beta.4","/concept-bloom-lab.html","/concept-bloom-lab.mjs?v=5.0.0-beta.4","/concept-bond-runtime.mjs?v=5.0.0-beta.4","/concept-chemistry.css?v=5.0.0-beta.4","/concept-chemistry.mjs?v=5.0.0-beta.4","/concept-matter.css?v=5.0.0-beta.4","/constellation-card.mjs?v=5.0.0-beta.4","/constellation-voyages.mjs?v=5.0.0-beta.4","/cosmetic-canvas.mjs?v=5.0.0-beta.4","/cosmetic-catalog.mjs?v=5.0.0-beta.4","/cosmetic-economy.mjs?v=5.0.0-beta.4","/cosmetic-preload-bootstrap.js?v=5.0.0-beta.4","/cosmetics.css?v=5.0.0-beta.4","/cosmic-events.mjs?v=5.0.0-beta.4","/cosmic-gate.css?v=5.0.0-beta.4","/cosmic-gate.mjs?v=5.0.0-beta.4","/cosmic-interlude-runtime.mjs?v=5.0.0-beta.4","/cosmic-interludes.mjs?v=5.0.0-beta.4","/cosmic-quotes.mjs?v=5.0.0-beta.4","/cosmic-twists.mjs?v=5.0.0-beta.4","/ctrl-hover.mjs?v=5.0.0-beta.4","/default-profile.mjs?v=5.0.0-beta.4","/developer-console-runtime.mjs?v=5.0.0-beta.4","/developer-console.css?v=5.0.0-beta.4","/developer-console.mjs?v=5.0.0-beta.4","/engagement-features.mjs?v=5.0.0-beta.4","/epic-home.css?v=5.0.0-beta.4","/expedition.mjs?v=5.0.0-beta.4","/explore-sandbox.mjs?v=5.0.0-beta.4","/feedback-preferences-ui.mjs?v=5.0.0-beta.4","/first-game-experience.mjs?v=5.0.0-beta.4","/first-orbit.mjs?v=5.0.0-beta.4","/fonts/DMMono-Medium.ttf","/fonts/Manrope-Variable.ttf","/fonts/OFL-DM-Mono.txt","/fonts/OFL-Manrope.txt","/frictionless.mjs?v=5.0.0-beta.4","/golden-targets.mjs?v=5.0.0-beta.4","/guided-play-app.mjs?v=5.0.0-beta.4","/hero-recipes.mjs?v=5.0.0-beta.4","/home-menu-view.mjs?v=5.0.0-beta.4","/home-menu.mjs?v=5.0.0-beta.4","/icon-192.png","/icon-512.png","/icon-maskable-512.png","/icon.svg","/initial-app-state.mjs?v=5.0.0-beta.4","/inventory-view-runtime.mjs?v=5.0.0-beta.4","/living-atlas.mjs?v=5.0.0-beta.4","/local-beta.mjs?v=5.0.0-beta.4","/manifest.webmanifest","/mastery-catalog.mjs?v=5.0.0-beta.4","/mission-briefing.mjs?v=5.0.0-beta.4","/mobile-play-chrome.mjs?v=5.0.0-beta.4","/mobile-play-shell-runtime.mjs?v=5.0.0-beta.4","/mobile-play-shell.css?v=5.0.0-beta.4","/molecular-memory-runtime.mjs?v=5.0.0-beta.4","/molecular-memory.css?v=5.0.0-beta.4","/molecular-memory.mjs?v=5.0.0-beta.4","/moon-heart-actions.mjs?v=5.0.0-beta.4","/moon-heart-project.mjs?v=5.0.0-beta.4","/moon-outpost-actions.mjs?v=5.0.0-beta.4","/moon-outpost.mjs?v=5.0.0-beta.4","/moon-project-flight.css?v=5.0.0-beta.4","/moon-result-presentation.mjs?v=5.0.0-beta.4","/moon-settlement-domain.mjs?v=5.0.0-beta.4","/moon-settlement-lab.css?v=5.0.0-beta.4","/moon-settlement-lab.html","/moon-settlement-lab.mjs?v=5.0.0-beta.4","/moon-settlement-persistence.mjs?v=5.0.0-beta.4","/moon-settlement-placement.mjs?v=5.0.0-beta.4","/moon-settlement-presentation.mjs?v=5.0.0-beta.4","/moon-settlement-renderer.mjs?v=5.0.0-beta.4","/moon-settlement-timeline.mjs?v=5.0.0-beta.4","/moon-worldweaving-controller.mjs?v=5.0.0-beta.4","/path-guard.mjs?v=5.0.0-beta.4","/pending-scores.mjs?v=5.0.0-beta.4","/planet-hub.css?v=5.0.0-beta.4","/powerup-view-runtime.mjs?v=5.0.0-beta.4","/profile-rank-surface.mjs?v=5.0.0-beta.4","/rank-board-art-runtime.mjs?v=5.0.0-beta.4","/rank-board-art.mjs?v=5.0.0-beta.4","/recipe-feedback.mjs?v=5.0.0-beta.4","/recipe-insight.mjs?v=5.0.0-beta.4","/recipe-mastery.mjs?v=5.0.0-beta.4","/release.json","/remix-progression.mjs?v=5.0.0-beta.4","/remix-readiness.mjs?v=5.0.0-beta.4","/responsive-context.mjs?v=5.0.0-beta.4","/reveal-presentation.mjs?v=5.0.0-beta.4","/reveal-tree.mjs?v=5.0.0-beta.4","/route-distance.mjs?v=5.0.0-beta.4","/route-rank-client.mjs?v=5.0.0-beta.4","/route-remixes.mjs?v=5.0.0-beta.4","/run-entry.mjs?v=5.0.0-beta.4","/run-iq.mjs?v=5.0.0-beta.4","/salvage-cache.mjs?v=5.0.0-beta.4","/salvage-cosmetics.mjs?v=5.0.0-beta.4","/second-orbit.mjs?v=5.0.0-beta.4","/secondary-surface-loader.mjs?v=5.0.0-beta.4","/session-resume.mjs?v=5.0.0-beta.4","/share-card-runtime.mjs?v=5.0.0-beta.4","/shift-board.mjs?v=5.0.0-beta.4","/shuffled-start.mjs?v=5.0.0-beta.4","/signature-routes.mjs?v=5.0.0-beta.4","/simple-ui.css?v=5.0.0-beta.4","/stardust-store.mjs?v=5.0.0-beta.4","/stardust-supplies-ui.mjs?v=5.0.0-beta.4","/story/target-route-story.mjs?v=5.0.0-beta.4","/styles.css?v=5.0.0-beta.4","/target-pool.mjs?v=5.0.0-beta.4","/ui-foundation.css?v=5.0.0-beta.4","/universe-director.mjs?v=5.0.0-beta.4","/victory-handoff.mjs?v=5.0.0-beta.4","/website-atlas-preview.mjs?v=5.0.0-beta.4","/website-voyage-preview.mjs?v=5.0.0-beta.4","/word-bloom-input-runtime.mjs?v=5.0.0-beta.4","/word-bloom-view.mjs?v=5.0.0-beta.4","/word-node-bond-editor.mjs?v=5.0.0-beta.4","/word-node-chemistry.mjs?v=5.0.0-beta.4","/word-node-lab.css?v=5.0.0-beta.4","/word-node-lab.html","/word-node-lab.mjs?v=5.0.0-beta.4","/word-orbit-motion.css?v=5.0.0-beta.4","/word-orbit-runtime.mjs?v=5.0.0-beta.4","/word-orbit.css?v=5.0.0-beta.4","/word-orbit.mjs?v=5.0.0-beta.4","/word-semantic-facets.mjs?v=5.0.0-beta.4","/worldweaving.mjs?v=5.0.0-beta.4"].map((path) => new URL(path, BASE).href);
const SHELL_URLS = new Set(SHELL);
const LAZY_PREFIXES = ["/art/home/","/art/moon-outpost/","/art/profile-frames/","/art/ranks/","/art/transitions/","/cinematic/","/story/"].map((path) => new URL(path, BASE).href);
const LAZY_FILES = new Set(["/arena-duel-card.css?v=5.0.0-beta.4","/arena-duel-card.mjs?v=5.0.0-beta.4","/celestial-atlas-runtime.mjs?v=5.0.0-beta.4","/celestial-cosmology-runtime.mjs?v=5.0.0-beta.4","/cinematic/voyage-projection-experience.css?v=5.0.0-beta.4","/cinematic/voyage-projection-experience.mjs?v=5.0.0-beta.4","/cinematic/voyage-projection-media.json?v=5.0.0-beta.4","/cinematic/voyage-projection-media.mjs?v=5.0.0-beta.4","/circuit-live-ops.mjs?v=5.0.0-beta.4","/circuit-lobby-tabs.mjs?v=5.0.0-beta.4","/combining-board-domain.mjs?v=5.0.0-beta.4","/combining-board-runtime.mjs?v=5.0.0-beta.4","/combining-board-scene.mjs?v=5.0.0-beta.4","/concept-matter-app.mjs?v=5.0.0-beta.4","/concept-matter-runtime.mjs?v=5.0.0-beta.4","/concept-matter.mjs?v=5.0.0-beta.4","/cosmetic-world-preview.css?v=5.0.0-beta.4","/cosmetic-world-preview.mjs?v=5.0.0-beta.4","/cosmetics-observatory-full-page.css?v=5.0.0-beta.4","/cosmetics-observatory.css?v=5.0.0-beta.4","/cosmetics-observatory.mjs?v=5.0.0-beta.4","/cosmic-interlude.css?v=5.0.0-beta.4","/cosmos-circuit-copy.mjs?v=5.0.0-beta.4","/cosmos-circuit-runtime.mjs?v=5.0.0-beta.4","/cosmos-circuit.css?v=5.0.0-beta.4","/cosmos-circuit.mjs?v=5.0.0-beta.4","/forge-clash.mjs?v=5.0.0-beta.4","/moon-heart-actions.mjs?v=5.0.0-beta.4","/moon-heart-project-presentation.mjs?v=5.0.0-beta.4","/moon-heart-project-runtime.mjs?v=5.0.0-beta.4","/moon-heart-project.css?v=5.0.0-beta.4","/moon-home-project-entry.mjs?v=5.0.0-beta.4","/moon-outpost-actions.mjs?v=5.0.0-beta.4","/moon-outpost-presentation.mjs?v=5.0.0-beta.4","/moon-outpost-runtime.mjs?v=5.0.0-beta.4","/moon-outpost.css?v=5.0.0-beta.4","/moon-project-launch.mjs?v=5.0.0-beta.4","/moon-result-presentation.mjs?v=5.0.0-beta.4","/moon-worldweaving-runtime.mjs?v=5.0.0-beta.4","/moon-worldweaving.css?v=5.0.0-beta.4","/planet-hub-app.mjs?v=5.0.0-beta.4","/planet-hub-audio.mjs?v=5.0.0-beta.4","/planet-hub-cinematic.css?v=5.0.0-beta.4","/planet-hub-domain.mjs?v=5.0.0-beta.4","/planet-hub-host.mjs?v=5.0.0-beta.4","/planet-hub-moods.mjs?v=5.0.0-beta.4","/planet-hub-places.mjs?v=5.0.0-beta.4","/planet-hub-renderer.mjs?v=5.0.0-beta.4","/planet-hub-runtime.mjs?v=5.0.0-beta.4","/planet-hub-space.mjs?v=5.0.0-beta.4","/planet-hub-sun-effects.mjs?v=5.0.0-beta.4","/planet-hub-zoom.mjs?v=5.0.0-beta.4","/profile-frame-catalog.mjs?v=5.0.0-beta.4","/profile-rank-frame.css?v=5.0.0-beta.4","/profile-rank-frame.mjs?v=5.0.0-beta.4","/scramble-app-bridge.mjs?v=5.0.0-beta.4","/scramble-arena.mjs?v=5.0.0-beta.4","/scramble-runtime.mjs?v=5.0.0-beta.4","/scramble.css?v=5.0.0-beta.4","/scramble.mjs?v=5.0.0-beta.4","/star-path.mjs?v=5.0.0-beta.4","/stardust-store-runtime.mjs?v=5.0.0-beta.4","/stardust-store.css?v=5.0.0-beta.4","/stardust-store.mjs?v=5.0.0-beta.4","/voyage-projection-domain.mjs?v=5.0.0-beta.4","/voyage-projection-runtime.mjs?v=5.0.0-beta.4","/voyage-projection-scene.mjs?v=5.0.0-beta.4"].map((path) => new URL(path, BASE).href));
const LAZY_PACK_PREFIXES = ["/art/cosmetics/","/art/planet-hub/","/audio/","/vendor/three/"].map((path) => new URL(path, BASE).href);
const BIRTHDAY_PREFIXES = ["/art/birthday-voyage/","/cinematic/birthday-voyage/"].map((path) => new URL(path, BASE).href);
const BIRTHDAY_FILES = new Set(["/art/birthday-voyage/01-toyota-rav4-2002-gray-right-transparent.webp","/art/birthday-voyage/02-vienna-buildings.webp","/art/birthday-voyage/03-belgium-brussels-buildings.webp","/art/birthday-voyage/04-bulgaria-sofia-buildings.webp","/art/birthday-voyage/05-tokyo-buildings.webp","/art/birthday-voyage/06-shibuya-buildings.webp","/art/birthday-voyage/07-earth.webp","/art/birthday-voyage/08-moon.webp","/art/birthday-voyage/09-mars.webp","/art/birthday-voyage/10-kepler-452b.webp","/art/birthday-voyage/11-lion-right-profile.webp","/art/birthday-voyage/12-our-cosmos-together.webp","/art/birthday-voyage/13-rav4-spaceship-right-transparent.webp","/art/birthday-voyage/14-varna-buildings.webp","/art/birthday-voyage/masters/brussels-master.webp","/art/birthday-voyage/masters/earth-master.webp","/art/birthday-voyage/masters/kepler-452b-master.webp","/art/birthday-voyage/masters/lion-intro-poster-master.webp","/art/birthday-voyage/masters/mars-master.webp","/art/birthday-voyage/masters/moon-master.webp","/art/birthday-voyage/masters/our-cosmos-master.webp","/art/birthday-voyage/masters/shibuya-master.webp","/art/birthday-voyage/masters/sofia-master.webp","/art/birthday-voyage/masters/tokyo-master.webp","/art/birthday-voyage/masters/varna-master.webp","/art/birthday-voyage/masters/vienna-master.webp","/art/birthday-voyage/thumbs/brussels-thumb.webp","/art/birthday-voyage/thumbs/earth-thumb.webp","/art/birthday-voyage/thumbs/kepler-452b-thumb.webp","/art/birthday-voyage/thumbs/lion-intro-poster-thumb.webp","/art/birthday-voyage/thumbs/mars-thumb.webp","/art/birthday-voyage/thumbs/moon-thumb.webp","/art/birthday-voyage/thumbs/our-cosmos-thumb.webp","/art/birthday-voyage/thumbs/shibuya-thumb.webp","/art/birthday-voyage/thumbs/sofia-thumb.webp","/art/birthday-voyage/thumbs/tokyo-thumb.webp","/art/birthday-voyage/thumbs/varna-thumb.webp","/art/birthday-voyage/thumbs/vienna-thumb.webp","/birthday-voyage-audio.mjs?v=5.0.0-beta.4","/birthday-voyage-config.mjs?v=5.0.0-beta.4","/birthday-voyage-personal-media.mjs?v=5.0.0-beta.4","/birthday-voyage.css?v=5.0.0-beta.4","/birthday-voyage.mjs?v=5.0.0-beta.4","/cinematic/lion-intro-birthday.mp4"].map((path) => new URL(path, BASE).href));
const BIRTHDAY_FILE_PATHS = new Set([...BIRTHDAY_FILES].map((href) => new URL(href).pathname));

function isBirthdayRequestUrl(href) {
  if (BIRTHDAY_FILES.has(href) || BIRTHDAY_PREFIXES.some((prefix) => href.startsWith(prefix))) return true;
  try { return BIRTHDAY_FILE_PATHS.has(new URL(href).pathname); }
  catch { return false; }
}

function birthdayOfflineResponse() {
  return new Response(
    "This birthday memory is not saved on this device yet. Reconnect once, then it will be available for offline replay.",
    { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}

async function cacheBirthdayRequests(values = []) {
  const urls = [...new Set((Array.isArray(values) ? values : []).map((value) => {
    try {
      const url = new URL(String(value || ""), BASE);
      return url.origin === self.location.origin && isBirthdayRequestUrl(url.href) ? url.href : "";
    } catch {
      return "";
    }
  }).filter(Boolean))].slice(0, 3);
  const cache = await caches.open(BIRTHDAY_CACHE);
  const outcomes = await Promise.allSettled(urls.map(async (href) => {
    if (await cache.match(href)) return true;
    const response = await fetch(new Request(href, { credentials: "same-origin" }));
    if (!response.ok || response.type === "opaque") throw new Error("Birthday media unavailable.");
    await cache.put(href, response.clone());
    return true;
  }));
  return Object.freeze({
    requested: urls.length,
    cached: outcomes.filter((outcome) => outcome.status === "fulfilled").length
  });
}

async function serveCachedRange(request, cache) {
  const rangeHeader = request.headers.get("range");
  const cached = await cache.match(request.url);
  if (!rangeHeader || !cached) return fetch(request);

  const bytes = await cached.arrayBuffer();
  const size = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2])) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` }
    });
  }

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
    || start < 0 || start >= size || end < start) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` }
    });
  }

  end = Math.min(end, size - 1);
  const body = bytes.slice(start, end + 1);
  const headers = new Headers(cached.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(body.byteLength));
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  return new Response(body, {
    status: 206,
    statusText: "Partial Content",
    headers
  });
}

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
    return;
  }
  if (event.data?.type === "CONSTELLORE_CACHE_BIRTHDAY_MEDIA") {
    event.waitUntil(cacheBirthdayRequests(event.data.urls).then((result) => {
      event.source?.postMessage?.({
        type: "CONSTELLORE_BIRTHDAY_MEDIA_CACHED",
        requestId: String(event.data.requestId || "").slice(0, 80),
        ...result
      });
    }));
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
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.includes("/api/")) return;
  const isNavigation = event.request.mode === "navigate" && url.href.startsWith(BASE.href);
  const isLazyAsset = LAZY_PREFIXES.some((prefix) => url.href.startsWith(prefix));
  const isLazyFile = LAZY_FILES.has(url.href);
  const isLazyPackAsset = LAZY_PACK_PREFIXES.some((prefix) => url.href.startsWith(prefix));
  const isBirthdayAsset = isBirthdayRequestUrl(url.href);
  if (!isNavigation && !SHELL_URLS.has(url.href) && !isLazyAsset && !isLazyFile && !isLazyPackAsset && !isBirthdayAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(isBirthdayAsset ? BIRTHDAY_CACHE : isLazyPackAsset ? LAZY_PACK_CACHE : CACHE);
    if (event.request.headers.has("range")) {
      if ((isBirthdayAsset || isLazyPackAsset) && !(await cache.match(event.request.url))) {
        try {
          const response = await fetch(new Request(event.request.url, { credentials: "same-origin" }));
          if (response.ok && response.type !== "opaque") await cache.put(event.request.url, response.clone());
        } catch { /* The range helper returns a clear offline response below. */ }
      }
      if (isBirthdayAsset && !(await cache.match(event.request.url))) {
        try { return await fetch(event.request); }
        catch { return birthdayOfflineResponse(); }
      }
      return serveCachedRange(event.request, cache);
    }
    if (isNavigation) {
      // A controlled document and its lazy assets stay on one release. The
      // waiting worker owns the next shell and activates after this client is
      // gone (or after an explicit coordinated activation message).
      const cachedShell = await cache.match(SHELL[0]);
      if (cachedShell) return cachedShell;
    }
    if (isLazyAsset || isLazyFile || isLazyPackAsset || isBirthdayAsset) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
    }
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type !== "opaque") {
        try { await cache.put(isNavigation ? SHELL[0] : event.request, response.clone()); }
        catch { /* A quota failure must never replace a valid online response. */ }
      }
      return response;
    } catch {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (isNavigation) {
        const fallback = await cache.match(SHELL[0]);
        if (fallback) return fallback;
      }
      return isBirthdayAsset
        ? birthdayOfflineResponse()
        : new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
