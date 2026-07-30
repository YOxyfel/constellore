import assert from "node:assert/strict";
import test from "node:test";
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
  assert.match(source, /caches[.]open\(isLazyPackAsset [?] LAZY_PACK_CACHE : CACHE\)/);
  assert.match(source, /isLazyAsset \|\| isLazyFile \|\| isLazyPackAsset/);
  assert.match(source, /!CURRENT_CACHES[.]has\(key\)/);
  assert.match(source, /event[.]request[.]headers[.]has\("range"\)/);
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
