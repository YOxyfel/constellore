import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { renderServiceWorker } from "../scripts/service-worker-source.mjs";

test("service worker cache and shell are derived from one release version", () => {
  const source = renderServiceWorker({
    cachePrefix: "constellore-test-",
    version: "3.0.0-beta.1",
    assets: ["./app.js?v=3.0.0-beta.1", "./styles.css?v=3.0.0-beta.1"]
  });
  assert.match(source, /constellore-test-/);
  assert.match(source, /3[.]0[.]0-beta[.]1/);
  assert.match(source, /app[.]js[?]v=3[.]0[.]0-beta[.]1/);
  assert.match(source, /key[.]startsWith\(CACHE_PREFIX\)/);
  assert.match(source, /cache[.]put\(isNavigation [?] SHELL\[0\] : event[.]request/);
  assert.match(source, /async function serveCachedRange/);
  assert.match(source, /cache[.]match\(request[.]url\)/);
  assert.match(source, /status: 206/);
  assert.match(source, /Content-Range/);
  assert.doesNotMatch(source, /headers[.]has\("range"\)\) return;/);
  assert.match(source, /CONSTELLORE_ACTIVATE_UPDATE/);
  assert.match(source, /event[.]data[?][.]version === RELEASE_VERSION/);
  const installHandler = source.match(/self[.]addEventListener\("install"[\s\S]*?\n}\);/)?.[0] || "";
  assert.match(installHandler, /if \(IS_LOCAL_PREVIEW\)[\s\S]*skipWaiting/);
  assert.match(source, /const IS_LOCAL_PREVIEW = \["localhost", "127[.]0[.]0[.]1", "::1"\]/);
  assert.match(source, /if \(IS_LOCAL_PREVIEW\) return;/);
  assert.match(source, /key[.]startsWith\(CACHE_PREFIX\) \|\| LEGACY_CACHES[.]has\(key\)/);
  assert.doesNotMatch(source, /client[.]navigate/);
  assert.match(source, /if \(isNavigation\)[\s\S]*cache[.]match\(SHELL\[0\]\)[\s\S]*return cachedShell/);
  assert.doesNotMatch(source, /keys[.]filter\(\(key\) => key !== CACHE\)/);
});

test("cached media range requests return a valid partial response", async () => {
  const source = renderServiceWorker({
    cachePrefix: "range-test-",
    version: "3.0.0",
    assets: ["./cinematic/lion.mp4"]
  });
  const context = {
    Headers,
    Response,
    Set,
    URL,
    fetch: async () => {
      throw new Error("The precached media response should avoid the network.");
    },
    self: {
      location: { hostname: "gift.example" },
      registration: { scope: "https://gift.example/play/" },
      addEventListener() {}
    }
  };
  runInNewContext(`${source}\nglobalThis.__serveCachedRange = serveCachedRange;`, context);
  const bytes = Uint8Array.from({ length: 10 }, (_, index) => index);
  const response = await context.__serveCachedRange({
    headers: new Headers({ range: "bytes=2-5" }),
    url: "https://gift.example/play/cinematic/lion.mp4"
  }, {
    async match() {
      return new Response(bytes, { headers: { "Content-Type": "video/mp4" } });
    }
  });

  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 2-5/10");
  assert.equal(response.headers.get("Content-Length"), "4");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [2, 3, 4, 5]);
});

test("service worker renderer rejects an escaping asset", () => {
  assert.throws(() => renderServiceWorker({ cachePrefix: "safe-", version: "3.0.0", assets: ["../secret"] }), /Unsafe/);
});

test("server worker can cache root assets while navigation lives under play", () => {
  const source = renderServiceWorker({
    cachePrefix: "server-",
    version: "3.0.0",
    navigationPath: "/play/",
    assets: ["/app.js?v=3.0.0", "/styles.css?v=3.0.0"],
    lazyAssets: ["/art/ranks/"]
  });
  assert.ok(source.includes('["/play/","/app.js?v=3.0.0"'));
  assert.match(source, /cache[.]match\(SHELL\[0\]\)/);
  assert.match(source, /LAZY_PREFIXES/);
  assert.match(source, /isLazyAsset/);
  assert.ok(!source.match(/const SHELL = [^;]+art[/]ranks/), "rank art must not enter the install shell");
});

test("lazy asset prefixes are safe and cache on first request", () => {
  const source = renderServiceWorker({
    cachePrefix: "safe-",
    version: "3.2.0-beta.1",
    assets: ["./app.js"],
    lazyAssets: ["./art/ranks/"]
  });
  assert.match(source, /[.]\/art\/ranks\//);
  assert.match(source, /if \(cached\) return cached/);
  assert.throws(
    () => renderServiceWorker({
      cachePrefix: "safe-",
      version: "3.2.0",
      assets: [],
      lazyAssets: ["../art/"]
    }),
    /Unsafe/
  );
});

test("exact lazy files cache on first request without widening their allowlist", () => {
  const source = renderServiceWorker({
    cachePrefix: "safe-",
    version: "3.5.1-beta.5",
    assets: ["./app.js"],
    lazyFiles: ["./cosmos-circuit.mjs?v=3.5.1-beta.5"]
  });

  assert.match(source, /const LAZY_FILES = new Set\(\["[.]\/cosmos-circuit[.]mjs[?]v=3[.]5[.]1-beta[.]5"\]/);
  assert.match(source, /const isLazyFile = LAZY_FILES[.]has\(url[.]href\)/);
  assert.match(source, /isLazyAsset \|\| isLazyFile \|\| isLazyPackAsset/);
  assert.doesNotMatch(source, /LAZY_FILES[.]some\([\s\S]*startsWith/);
  assert.throws(
    () => renderServiceWorker({
      cachePrefix: "safe-",
      version: "3.5.1",
      assets: [],
      lazyFiles: ["../cosmos-circuit.mjs"]
    }),
    /Unsafe/
  );
});

test("optional cosmetic and audio packs use a separate versioned cache and explicit URL allowlist", () => {
  const source = renderServiceWorker({
    cachePrefix: "safe-",
    version: "3.5.1-beta.1",
    assets: ["./app.js"],
    lazyAssets: ["./art/ranks/"],
    lazyPacks: ["./art/cosmetics/", "./audio/"]
  });
  const shell = source.match(/const SHELL = ([^;]+);/)?.[1] || "";

  assert.doesNotMatch(shell, /art\/cosmetics\//);
  assert.doesNotMatch(shell, /audio\//);
  assert.match(source, /const LAZY_PACK_CACHE_PREFIX = `\$\{CACHE_PREFIX\}cosmetic-packs-`/);
  assert.match(source, /const LAZY_PACK_CACHE = `\$\{LAZY_PACK_CACHE_PREFIX\}3[.]5[.]1-beta[.]1`/);
  assert.match(source, /const LAZY_PACK_PREFIXES = \["[.]\/art\/cosmetics\/","[.]\/audio\/"\]/);
  assert.match(source, /caches[.]open\(isBirthdayAsset [?] BIRTHDAY_CACHE : isLazyPackAsset [?] LAZY_PACK_CACHE : CACHE\)/);
  assert.match(source, /isLazyAsset \|\| isLazyFile \|\| isLazyPackAsset/);
  assert.match(source, /!CURRENT_CACHES[.]has\(key\)/);
  assert.match(source, /event[.]request[.]headers[.]has\("range"\)[\s\S]*serveCachedRange/);
  assert.throws(
    () => renderServiceWorker({
      cachePrefix: "safe-",
      version: "3.5.1",
      assets: [],
      lazyPacks: ["./art/cosmetics/not-a-prefix.webp"]
    }),
    /Unsafe/
  );
});

test("birthday voyage assets never enter the atomic shell and use one private versioned cache", () => {
  const source = renderServiceWorker({
    cachePrefix: "gift-test-",
    version: "4.2.0",
    assets: [
      "./app.js?v=4.2.0",
      "./birthday-voyage.mjs?v=4.2.0",
      "./birthday-voyage-config.mjs?v=4.2.0",
      "./birthday-voyage-audio.mjs?v=4.2.0",
      "./birthday-voyage.css?v=4.2.0",
      "./art/birthday-voyage/varna-thumb.webp"
    ],
    lazyAssets: ["./cinematic/"]
  });
  const shell = source.match(/const SHELL = ([^;]+);/)?.[1] || "";
  const birthdayFiles = source.match(/const BIRTHDAY_FILES = new Set\(([^;]+)\);/)?.[1] || "";

  assert.match(shell, /app[.]js/);
  assert.doesNotMatch(shell, /birthday-voyage|lion-intro-birthday/);
  assert.match(source, /const BIRTHDAY_CACHE_PREFIX = `\$\{CACHE_PREFIX\}birthday-voyage-`/);
  assert.match(source, /const BIRTHDAY_CACHE = `\$\{BIRTHDAY_CACHE_PREFIX\}4[.]2[.]0-v2`/);
  assert.match(source, /CURRENT_CACHES = new Set\(\[CACHE, LAZY_PACK_CACHE, BIRTHDAY_CACHE\]\)/);
  assert.match(source, /BIRTHDAY_PREFIXES = \["[.]\/art\/birthday-voyage\/","[.]\/cinematic\/birthday-voyage\/"\]/);
  assert.match(source, /const BIRTHDAY_FILE_PATHS = new Set\(\[[.][.][.]BIRTHDAY_FILES\]/);
  assert.match(source, /BIRTHDAY_FILE_PATHS[.]has\(new URL\(href\)[.]pathname\)/);
  assert.match(birthdayFiles, /birthday-voyage[.]mjs/);
  assert.match(birthdayFiles, /birthday-voyage-config[.]mjs/);
  assert.match(birthdayFiles, /birthday-voyage-audio[.]mjs/);
  assert.match(birthdayFiles, /birthday-voyage[.]css/);
  assert.match(birthdayFiles, /lion-intro-birthday[.]mp4/);
  assert.match(source, /caches[.]open\(isBirthdayAsset [?] BIRTHDAY_CACHE/);
  assert.match(source, /function birthdayOfflineResponse\([\s\S]*This birthday memory is not saved on this device yet/);
  assert.match(source, /isBirthdayAsset[\s\S]*birthdayOfflineResponse\(\)/);
});

test("birthday cache warming is selective and failures cannot reject service-worker installation", () => {
  const source = renderServiceWorker({
    cachePrefix: "gift-test-",
    version: "4.2.1",
    assets: ["./app.js", "./birthday-voyage.mjs", "./art/birthday-voyage/varna.webp"]
  });
  const installHandler = source.match(/self[.]addEventListener\("install"[\s\S]*?\n\}\);/)?.[0] || "";
  const messageHandler = source.match(/self[.]addEventListener\("message"[\s\S]*?\n\}\);/)?.[0] || "";

  assert.doesNotMatch(installHandler, /BIRTHDAY_CACHE|cacheBirthdayRequests|birthday-voyage/);
  assert.match(messageHandler, /CONSTELLORE_CACHE_BIRTHDAY_MEDIA/);
  assert.match(source, /Promise[.]allSettled\(urls[.]map/);
  assert.match(source, /[.]filter\(Boolean\)\)\][.]slice\(0, 3\)/);
  assert.match(source, /CONSTELLORE_BIRTHDAY_MEDIA_CACHED/);
  assert.match(source, /if \(await cache[.]match\(href\)\) return true/);
});

test("a warmed birthday memory survives offline while a cold memory gets an explicit recovery response", async () => {
  const source = renderServiceWorker({
    cachePrefix: "gift-test-",
    version: "4.2.2",
    assets: ["./app.js", "./birthday-voyage.mjs", "./art/birthday-voyage/varna.webp"]
  });
  const stores = new Map();
  let online = true;
  let fetches = 0;
  const keyFor = (request) => typeof request === "string" ? request : request.url;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(request) { return store.get(keyFor(request))?.clone() || undefined; },
        async put(request, response) { store.set(keyFor(request), response.clone()); }
      };
    }
  };
  const context = {
    Headers,
    Request,
    Response,
    Set,
    URL,
    caches,
    fetch: async (request) => {
      fetches += 1;
      if (!online) throw new Error("offline");
      return new Response(`saved:${keyFor(request)}`, { status: 200 });
    },
    self: {
      location: { hostname: "gift.example", origin: "https://gift.example" },
      registration: { scope: "https://gift.example/play/" },
      addEventListener() {}
    }
  };
  runInNewContext(
    `${source}\nglobalThis.__cacheBirthdayRequests = cacheBirthdayRequests; globalThis.__birthdayOfflineResponse = birthdayOfflineResponse;`,
    context
  );

  const warmed = await context.__cacheBirthdayRequests([
    "./art/birthday-voyage/varna.webp",
    "https://untrusted.example/not-a-gift.webp"
  ]);
  assert.deepEqual({ ...warmed }, { requested: 1, cached: 1 });
  assert.equal(fetches, 1);
  online = false;
  const cache = await caches.open("gift-test-birthday-voyage-4.2.2-v2");
  const replay = await cache.match("https://gift.example/play/art/birthday-voyage/varna.webp");
  assert.match(await replay.text(), /^saved:/);
  const cold = context.__birthdayOfflineResponse();
  assert.equal(cold.status, 503);
  assert.match(await cold.text(), /Reconnect once/);
});
