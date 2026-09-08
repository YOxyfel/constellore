import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  loadVoyageProductionManifest,
  voyageProductionManifestDigest
} from "../scripts/voyage-projection-production.mjs";
import { validateVoyageLookdev } from "../scripts/voyage-projection-lookdev.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifestPath = join(root, "production", "voyage-projection", "lookdev", "lookdev-manifest.json");

function pngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

async function createIsolatedLookdevRoot(prefix = "constellore-voyage-lookdev-root-") {
  const temporaryRoot = await mkdtemp(join(tmpdir(), prefix));
  const temporaryLookdev = join(
    temporaryRoot,
    "production",
    "voyage-projection",
    "lookdev"
  );
  await mkdir(temporaryLookdev, { recursive: true });
  const lookdev = JSON.parse(await readFile(manifestPath, "utf8"));
  const temporaryManifestPath = join(temporaryLookdev, "lookdev-manifest.json");
  await writeFile(temporaryManifestPath, `${JSON.stringify(lookdev, null, 2)}\n`, "utf8");
  for (const asset of lookdev.assets) {
    await copyFile(
      join(root, ...asset.path.split("/")),
      join(temporaryLookdev, basename(asset.path))
    );
  }
  return {
    lookdev,
    temporaryLookdev,
    temporaryManifestPath,
    temporaryRoot
  };
}

test("Voyage AI look-development plates remain deterministic non-shipping references", async () => {
  const reusableReport = await validateVoyageLookdev({ root, manifestPath });
  assert.equal(reusableReport.valid, true, reusableReport.errors.join("\n"));
  assert.equal(reusableReport.checked.length, 4);

  const lookdev = JSON.parse(await readFile(manifestPath, "utf8"));
  const production = await loadVoyageProductionManifest();
  const allowed = new Set(production.authorityPolicy.aiAllowedElements);
  const declaredProduction = JSON.stringify(production);

  assert.equal(lookdev.schemaVersion, 1);
  assert.equal(lookdev.contractId, production.contractId);
  assert.equal(lookdev.contractVersion, production.contractVersion);
  assert.equal(lookdev.contractSha256, voyageProductionManifestDigest(production));
  assert.equal(lookdev.status, "non-shipping-look-development");
  assert.equal(lookdev.releaseEligible, false);
  assert.equal(lookdev.assets.length, 4);

  for (const asset of lookdev.assets) {
    const absolute = join(root, ...asset.path.split("/"));
    const bytes = await readFile(absolute);
    const dimensions = pngDimensions(bytes);
    assert.deepEqual(dimensions, { width: asset.width, height: asset.height });
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
    assert.ok(asset.allowedElements.length > 0);
    assert.ok(asset.allowedElements.every((element) => allowed.has(element)));
    assert.doesNotMatch(asset.prompt, /(?:rocket|planet|typography).*(?:include|visible|foreground)/i);
    assert.equal(declaredProduction.includes(basename(asset.path)), false,
      `${asset.id} must not become a production deliverable before matte-constrained derivation.`);
    await assert.rejects(
      access(join(root, "public", "cinematic", basename(asset.path))),
      undefined,
      `${asset.id} must remain outside the public runtime.`
    );
  }
});

test("Voyage look-development rejects a stale production-contract digest", async () => {
  const isolated = await createIsolatedLookdevRoot();
  const { lookdev, temporaryManifestPath, temporaryRoot } = isolated;
  lookdev.contractSha256 = "0".repeat(64);
  try {
    await writeFile(temporaryManifestPath, `${JSON.stringify(lookdev, null, 2)}\n`, "utf8");
    const report = await validateVoyageLookdev({
      root: temporaryRoot,
      manifestPath: temporaryManifestPath
    });
    assert.equal(report.valid, false);
    assert.ok(report.errors.includes(
      "Voyage look-development manifest is not bound to the current production contract digest."
    ));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Voyage look-development rejects a manifest outside its production directory", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "constellore-voyage-lookdev-outside-"));
  const outsideManifestPath = join(temporaryDirectory, "lookdev-manifest.json");
  try {
    await copyFile(manifestPath, outsideManifestPath);
    const report = await validateVoyageLookdev({ root, manifestPath: outsideManifestPath });
    assert.equal(report.valid, false);
    assert.deepEqual(report.checked, []);
    assert.ok(report.errors.includes(
      "Voyage look-development manifest is outside the non-shipping production directory."
    ));
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("Voyage look-development rejects symlink and Windows junction path components", async (context) => {
  const isolated = await createIsolatedLookdevRoot("constellore-voyage-lookdev-links-");
  const outsideDirectory = await mkdtemp(join(tmpdir(), "constellore-voyage-lookdev-target-"));
  const redirect = join(isolated.temporaryLookdev, "redirect");
  const redirectedManifest = join(outsideDirectory, "lookdev-manifest.json");
  const selected = isolated.lookdev.assets[0];
  const selectedName = basename(selected.path);
  try {
    await copyFile(manifestPath, redirectedManifest);
    await copyFile(join(root, ...selected.path.split("/")), join(outsideDirectory, selectedName));
    try {
      await symlink(
        outsideDirectory,
        redirect,
        process.platform === "win32" ? "junction" : "dir"
      );
    } catch (error) {
      if (["EPERM", "EINVAL", "ENOTSUP"].includes(error?.code)) {
        context.skip(`Link creation is unavailable on this host: ${error.code}`);
        return;
      }
      throw error;
    }

    const manifestReport = await validateVoyageLookdev({
      root: isolated.temporaryRoot,
      manifestPath: join(redirect, "lookdev-manifest.json")
    });
    assert.equal(manifestReport.valid, false);
    assert.deepEqual(manifestReport.checked, []);
    assert.ok(manifestReport.errors.includes(
      "Voyage look-development manifest contains a symbolic link, junction, or reparse point."
    ));

    selected.path = `production/voyage-projection/lookdev/redirect/${selectedName}`;
    await writeFile(
      isolated.temporaryManifestPath,
      `${JSON.stringify(isolated.lookdev, null, 2)}\n`,
      "utf8"
    );
    const assetReport = await validateVoyageLookdev({
      root: isolated.temporaryRoot,
      manifestPath: isolated.temporaryManifestPath
    });
    assert.equal(assetReport.valid, false);
    assert.ok(assetReport.errors.includes(
      `Look-development asset ${selected.id} path contains a symbolic link, junction, or reparse point.`
    ));

    selected.path = "production/voyage-projection/lookdev/redirect/missing.png";
    await writeFile(
      isolated.temporaryManifestPath,
      `${JSON.stringify(isolated.lookdev, null, 2)}\n`,
      "utf8"
    );
    const missingBelowLinkReport = await validateVoyageLookdev({
      root: isolated.temporaryRoot,
      manifestPath: isolated.temporaryManifestPath
    });
    assert.equal(missingBelowLinkReport.valid, false);
    assert.ok(missingBelowLinkReport.errors.includes(
      `Look-development asset ${selected.id} path contains a symbolic link, junction, or reparse point.`
    ));
    assert.equal(
      missingBelowLinkReport.errors.includes(
        `Look-development asset ${selected.id} is missing ${selected.path}.`
      ),
      false,
      "the nearest existing reparse parent must be rejected before reporting a missing asset"
    );
  } finally {
    await rm(isolated.temporaryRoot, { recursive: true, force: true });
    await rm(outsideDirectory, { recursive: true, force: true });
  }
});
