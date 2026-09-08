import { createHash } from "node:crypto";
import { access, lstat, readFile, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  loadVoyageProductionManifest,
  voyageProductionManifestDigest
} from "./voyage-projection-production.mjs";

const DEFAULT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const DEFAULT_VOYAGE_LOOKDEV_MANIFEST = new URL(
  "../production/voyage-projection/lookdev/lookdev-manifest.json",
  import.meta.url
);

function projectPath(root, declaredPath) {
  const rootPath = resolve(root);
  const candidate = resolve(rootPath, String(declaredPath || ""));
  const fromRoot = relative(rootPath, candidate);
  if (!fromRoot || !escapesDirectory(fromRoot)) return candidate;
  return null;
}

function escapesDirectory(relativePath) {
  return isAbsolute(relativePath)
    || relativePath === ".."
    || relativePath.startsWith(`..${sep}`);
}

function filesystemPath(value) {
  if (value instanceof URL) {
    if (value.protocol !== "file:") return null;
    return resolve(fileURLToPath(value));
  }
  return resolve(String(value || ""));
}

function isContainedPath(parent, candidate, { allowParent = false } = {}) {
  const fromParent = relative(resolve(parent), resolve(candidate));
  if (!fromParent) return allowParent;
  return !escapesDirectory(fromParent);
}

function isSamePath(left, right) {
  return relative(resolve(left), resolve(right)) === "";
}

async function inspectLookdevPath({ root, lookdevDirectory, candidate }) {
  const rootPath = resolve(root);
  const candidatePath = filesystemPath(candidate);
  if (!candidatePath || !isContainedPath(lookdevDirectory, candidatePath)) {
    return Object.freeze({ valid: false, reason: "outside" });
  }

  let canonicalRoot;
  try {
    canonicalRoot = await realpath(rootPath);
  } catch {
    return Object.freeze({ valid: false, reason: "missing-root" });
  }

  const pathFromRoot = relative(rootPath, candidatePath);
  if (!pathFromRoot || escapesDirectory(pathFromRoot)) {
    return Object.freeze({ valid: false, reason: "outside" });
  }

  let cursor = rootPath;
  let nearestExisting = rootPath;
  for (const component of pathFromRoot.split(/[\\/]+/u).filter(Boolean)) {
    cursor = join(cursor, component);
    let stats;
    try {
      stats = await lstat(cursor);
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") break;
      return Object.freeze({ valid: false, reason: "unreadable" });
    }
    if (stats.isSymbolicLink()) {
      return Object.freeze({ valid: false, reason: "reparse" });
    }
    nearestExisting = cursor;
  }

  let canonicalLookdev;
  let canonicalNearest;
  try {
    canonicalLookdev = await realpath(lookdevDirectory);
    canonicalNearest = await realpath(nearestExisting);
  } catch {
    return Object.freeze({ valid: false, reason: "missing-lookdev" });
  }

  const expectedCanonicalLookdev = resolve(
    canonicalRoot,
    relative(rootPath, lookdevDirectory)
  );
  const expectedCanonicalNearest = resolve(
    canonicalRoot,
    relative(rootPath, nearestExisting)
  );
  if (!isSamePath(canonicalLookdev, expectedCanonicalLookdev)
    || !isSamePath(canonicalNearest, expectedCanonicalNearest)) {
    return Object.freeze({ valid: false, reason: "reparse" });
  }
  if (!isContainedPath(canonicalLookdev, canonicalNearest, {
    allowParent: isSamePath(canonicalLookdev, canonicalNearest)
  })) {
    return Object.freeze({ valid: false, reason: "outside" });
  }

  return Object.freeze({
    valid: true,
    path: candidatePath,
    exists: isSamePath(nearestExisting, candidatePath)
  });
}

function pngDimensions(buffer) {
  if (buffer.length < 24
    || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || buffer.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export async function validateVoyageLookdev({
  root = DEFAULT_ROOT,
  manifestPath = DEFAULT_VOYAGE_LOOKDEV_MANIFEST
} = {}) {
  const errors = [];
  const rootPath = resolve(root);
  const lookdevDirectory = resolve(rootPath, "production", "voyage-projection", "lookdev");
  const manifestInspection = await inspectLookdevPath({
    root: rootPath,
    lookdevDirectory,
    candidate: manifestPath
  });
  if (!manifestInspection.valid) {
    const detail = manifestInspection.reason === "reparse"
      ? " contains a symbolic link, junction, or reparse point."
      : " is outside the non-shipping production directory.";
    return Object.freeze({
      valid: false,
      errors: Object.freeze([`Voyage look-development manifest${detail}`]),
      checked: Object.freeze([])
    });
  }
  if (!manifestInspection.exists) {
    return Object.freeze({
      valid: false,
      errors: Object.freeze(["Voyage look-development manifest is missing."]),
      checked: Object.freeze([])
    });
  }
  const source = await readFile(manifestInspection.path, "utf8");
  const manifest = JSON.parse(source);
  const production = await loadVoyageProductionManifest();
  const productionDigest = voyageProductionManifestDigest(production);
  const allowed = new Set(production.authorityPolicy.aiAllowedElements);
  const productionContract = JSON.stringify(production);
  if (manifest.schemaVersion !== 1
    || manifest.status !== "non-shipping-look-development"
    || manifest.releaseEligible !== false) {
    errors.push("Voyage look-development must remain an explicitly non-shipping schema-v1 collection.");
  }
  if (manifest.contractId !== production.contractId
    || manifest.contractVersion !== production.contractVersion
    || manifest.contractSha256 !== productionDigest) {
    errors.push("Voyage look-development manifest is not bound to the current production contract digest.");
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length !== 4) {
    errors.push("Voyage look-development must declare exactly four approved VFX references.");
  }
  const checked = [];
  for (const asset of manifest.assets || []) {
    const absolute = projectPath(rootPath, asset.path);
    const inspection = absolute
      ? await inspectLookdevPath({
        root: rootPath,
        lookdevDirectory,
        candidate: absolute
      })
      : Object.freeze({ valid: false, reason: "outside" });
    if (!inspection.valid) {
      if (inspection.reason === "reparse") {
        errors.push(`Look-development asset ${asset.id} path contains a symbolic link, junction, or reparse point.`);
      } else {
        errors.push(`Look-development asset ${asset.id} is outside the non-shipping production directory.`);
      }
      continue;
    }
    if (!inspection.exists) {
      errors.push(`Look-development asset ${asset.id} is missing ${asset.path}.`);
      continue;
    }
    if (!absolute) {
      errors.push(`Look-development asset ${asset.id} is outside the non-shipping production directory.`);
      continue;
    }
    let contents;
    try { contents = await readFile(inspection.path); }
    catch { errors.push(`Look-development asset ${asset.id} is missing ${asset.path}.`); continue; }
    checked.push(asset.path);
    const dimensions = pngDimensions(contents);
    if (!dimensions || dimensions.width !== asset.width || dimensions.height !== asset.height) {
      errors.push(`Look-development asset ${asset.id} has invalid PNG dimensions.`);
    }
    if (contents.length !== asset.bytes
      || createHash("sha256").update(contents).digest("hex") !== asset.sha256) {
      errors.push(`Look-development asset ${asset.id} does not match its byte/hash record.`);
    }
    if (!Array.isArray(asset.allowedElements)
      || !asset.allowedElements.length
      || asset.allowedElements.some((element) => !allowed.has(element))) {
      errors.push(`Look-development asset ${asset.id} exceeds the AI-permitted VFX element list.`);
    }
    if (productionContract.includes(basename(asset.path))) {
      errors.push(`Look-development asset ${asset.id} was incorrectly promoted into the production deliverables.`);
    }
    try {
      await access(resolve(root, "public", "cinematic", basename(asset.path)));
      errors.push(`Look-development asset ${asset.id} was incorrectly copied into the public runtime.`);
    } catch {}
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    checked: Object.freeze(checked)
  });
}

const isCli = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  const report = await validateVoyageLookdev();
  if (!report.valid) {
    for (const error of report.errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Verified ${report.checked.length} non-shipping Voyage VFX look-development plates.`);
  }
}
