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
    assets: ["/app.js?v=3.0.0", "/styles.css?v=3.0.0"]
  });
  assert.ok(source.includes('["/play/","/app.js?v=3.0.0"'));
  assert.match(source, /cache[.]match\(SHELL\[0\]\)/);
});
