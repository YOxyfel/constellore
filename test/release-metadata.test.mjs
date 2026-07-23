import assert from "node:assert/strict";
import test from "node:test";
import { packageMetadata, releaseMetadata, withAssetVersion } from "../scripts/release-metadata.mjs";

test("release metadata derives one build identity from package.json", async () => {
  const pkg = await packageMetadata();
  const release = await releaseMetadata({ channel: "test", runtime: "local-practice" });
  assert.equal(release.version, pkg.version);
  assert.match(release.buildId, new RegExp(`^${pkg.version.replaceAll(".", "\\.")}\\+`));
  assert.equal(release.graphVersion, `world-${pkg.version}`);
  assert.equal(release.channel, "test");
  assert.equal(release.runtime, "local-practice");
  assert.equal(release.commerceEnabled, false);
});

test("asset references are normalized to the release version", () => {
  const source = 'import "./graph.mjs?v=1.0.0"; import("./runtime/local.mjs"); <script src="/app.js?v=2.1.0"></script><link href="website.css">';
  assert.equal(
    withAssetVersion(source, "3.0.0-beta.1"),
    'import "./graph.mjs?v=3.0.0-beta.1"; import("./runtime/local.mjs?v=3.0.0-beta.1"); <script src="/app.js?v=3.0.0-beta.1"></script><link href="website.css?v=3.0.0-beta.1">'
  );
});

test("asset versioning rejects an invalid release identifier", () => {
  assert.throws(() => withAssetVersion('import "./graph.mjs"', "latest?<script>"), /valid asset release version/);
});
