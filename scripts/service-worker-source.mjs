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

function isBirthdayVoyagePath(value) {
  const pathname = String(value || "").split("?")[0];
  return /(?:^|\/)(?:birthday-voyage(?:-[a-z0-9-]+)?[.](?:css|js|mjs)|art\/birthday-voyage\/|cinematic\/(?:birthday-voyage\/|lion-intro-birthday[.]mp4$))/i.test(pathname);
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
  const normalizedAssets = [...new Set(assets.map(safeAssetPath).filter((path) => path !== safeNavigation))];
  const birthdayFilesFromAssets = normalizedAssets.filter(isBirthdayVoyagePath);
  const shell = [safeNavigation, ...normalizedAssets
    .filter((path) => !isBirthdayVoyagePath(path))
    .sort((left, right) => left.localeCompare(right, "en"))];
  const lazy = [...new Set(lazyAssets.map(safeLazyPrefix))]
    .sort((left, right) => left.localeCompare(right, "en"));
  const files = [...new Set(lazyFiles.map(safeAssetPath))]
    .sort((left, right) => left.localeCompare(right, "en"));
  const packs = [...new Set(lazyPacks.map(safeLazyPrefix))]
    .sort((left, right) => left.localeCompare(right, "en"));
  const rootPrefix = safeNavigation.startsWith("./") ? "./" : "/";
  const birthdayPrefixes = [
    `${rootPrefix}art/birthday-voyage/`,
    `${rootPrefix}cinematic/birthday-voyage/`
  ].map(safeLazyPrefix);
  const birthdayFiles = [...new Set([
    ...birthdayFilesFromAssets,
    `${rootPrefix}cinematic/lion-intro-birthday.mp4`
  ].map(safeAssetPath))].sort((left, right) => left.localeCompare(right, "en"));
  return `const CACHE_PREFIX = ${JSON.stringify(cachePrefix)};
const RELEASE_VERSION = ${JSON.stringify(version)};
const CACHE = \`\${CACHE_PREFIX}${version}\`;
const LAZY_PACK_CACHE_PREFIX = \`\${CACHE_PREFIX}cosmetic-packs-\`;
const LAZY_PACK_CACHE = \`\${LAZY_PACK_CACHE_PREFIX}${version}\`;
const BIRTHDAY_CACHE_PREFIX = \`\${CACHE_PREFIX}birthday-voyage-\`;
const BIRTHDAY_CACHE = \`\${BIRTHDAY_CACHE_PREFIX}${version}-v2\`;
const CURRENT_CACHES = new Set([CACHE, LAZY_PACK_CACHE, BIRTHDAY_CACHE]);
const LEGACY_CACHES = new Set(${JSON.stringify(legacyCaches)});
const IS_LOCAL_PREVIEW = ["localhost", "127.0.0.1", "::1"].includes(self.location.hostname);
const BASE = new URL("./", self.registration.scope);
const SHELL = ${JSON.stringify(shell)}.map((path) => new URL(path, BASE).href);
const SHELL_URLS = new Set(SHELL);
const LAZY_PREFIXES = ${JSON.stringify(lazy)}.map((path) => new URL(path, BASE).href);
const LAZY_FILES = new Set(${JSON.stringify(files)}.map((path) => new URL(path, BASE).href));
const LAZY_PACK_PREFIXES = ${JSON.stringify(packs)}.map((path) => new URL(path, BASE).href);
const BIRTHDAY_PREFIXES = ${JSON.stringify(birthdayPrefixes)}.map((path) => new URL(path, BASE).href);
const BIRTHDAY_FILES = new Set(${JSON.stringify(birthdayFiles)}.map((path) => new URL(path, BASE).href));
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
  const match = /^bytes=(\\d*)-(\\d*)$/i.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2])) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": \`bytes */\${size}\` }
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
      headers: { "Content-Range": \`bytes */\${size}\` }
    });
  }

  end = Math.min(end, size - 1);
  const body = bytes.slice(start, end + 1);
  const headers = new Headers(cached.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(body.byteLength));
  headers.set("Content-Range", \`bytes \${start}-\${end}/\${size}\`);
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
`;
}
