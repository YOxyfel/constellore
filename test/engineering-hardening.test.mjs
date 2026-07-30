import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { clientAddress } from "../server.mjs";
import { createRevisionedStorageCoordinator } from "../public/pending-scores.mjs";

const [appSource, persistenceSource] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/pending-scores.mjs", import.meta.url), "utf8")
]);

test("trusted-proxy client identity is applied consistently and rejects malformed hops", () => {
  const previous = process.env.CONSTELLORE_TRUST_PROXY;
  const request = {
    socket: { remoteAddress: "127.0.0.1" },
    headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.2" }
  };
  try {
    delete process.env.CONSTELLORE_TRUST_PROXY;
    assert.equal(clientAddress(request), "127.0.0.1");

    process.env.CONSTELLORE_TRUST_PROXY = "true";
    assert.equal(clientAddress(request), "203.0.113.8");
    assert.equal(clientAddress({
      socket: { remoteAddress: "127.0.0.1" },
      headers: { "x-forwarded-for": "not-an-ip, also-bad" }
    }), "127.0.0.1");
  } finally {
    if (previous === undefined) delete process.env.CONSTELLORE_TRUST_PROXY;
    else process.env.CONSTELLORE_TRUST_PROXY = previous;
  }
});

test("local profile saves are revisioned and full reset clears every game-owned prefix", () => {
  assert.match(appSource, /const PROFILE_SAVE_META_KEY = "__localSave"/);
  assert.match(persistenceSource, /remoteRevision > baselineRevision/);
  assert.match(persistenceSource, /new scope[.]BroadcastChannel\(channelName\)/);
  assert.match(persistenceSource, /prefixes = \["constellore-", "wordforge-"\]/);
  assert.match(appSource, /clearGameStorage\(safeBrowserStorage\(\)\)/);
  assert.match(appSource, /clearGameStorage\(safeBrowserStorage\(globalThis, "sessionStorage"\)\)/);
});

test("revisioned local saves merge disjoint concurrent tab changes", () => {
  const records = new Map();
  const storage = {
    get length() { return records.size; },
    key(index) { return [...records.keys()][index] ?? null; },
    getItem(key) { return records.get(key) ?? null; },
    setItem(key, value) { records.set(key, value); },
    removeItem(key) { records.delete(key); }
  };
  const scope = { localStorage: storage, addEventListener() {} };
  const options = {
    key: "constellore-profile-v1",
    channelName: "profile-test",
    normalize: (value) => ({ wins: 0, credits: 0, ...value }),
    scope
  };
  const first = createRevisionedStorageCoordinator({ ...options, writer: "first" });
  const second = createRevisionedStorageCoordinator({ ...options, writer: "second" });

  const initial = first.save({ wins: 0, credits: 0 }, { wins: 0, credits: 0 });
  const secondBaseline = second.read();
  const firstUpdate = first.save({ ...initial.record, wins: 2 }, initial.baseline);
  const secondUpdate = second.save({ ...secondBaseline, credits: 7 }, secondBaseline);

  assert.equal(firstUpdate.record.wins, 2);
  assert.equal(secondUpdate.record.wins, 2);
  assert.equal(secondUpdate.record.credits, 7);
  assert.equal(secondUpdate.record.__localSave.revision, 3);
});

test("cloud gameplay sync is opt-in while account identity services still initialize", () => {
  assert.match(appSource, /cloudProfileEnabled: false/);
  assert.match(appSource, /config[.]cloudProfileEnabled === true/);
  assert.match(
    appSource,
    /async function initializeCloudServices\(\)[\s\S]*await restoreOwnership\(\{ silent: true }\)[\s\S]*config[.]cloudProfileEnabled === true/
  );
});
