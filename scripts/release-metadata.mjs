import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function cleanBuildPart(value, fallback) {
  const cleaned = String(value || "").trim().replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 40);
  return cleaned || fallback;
}

export async function packageMetadata() {
  const parsed = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(parsed.version || "")) {
    throw new Error("package.json contains an invalid release version.");
  }
  return parsed;
}

export async function releaseMetadata({ channel = "development", runtime = "server", revision: revisionOverride } = {}) {
  const pkg = await packageMetadata();
  const revision = cleanBuildPart(revisionOverride || process.env.GITHUB_SHA || process.env.CONSTELLORE_BUILD_REVISION, "local");
  const normalizedChannel = cleanBuildPart(channel, "development");
  const normalizedRuntime = cleanBuildPart(runtime, "server");
  return Object.freeze({
    schemaVersion: 1,
    product: "Constellore",
    studio: "Oxyfel Games",
    version: pkg.version,
    buildId: `${pkg.version}+${revision.slice(0, 12)}`,
    revision,
    channel: normalizedChannel,
    runtime: normalizedRuntime,
    graphVersion: `world-${pkg.version}`,
    commerceEnabled: false
  });
}

export function withAssetVersion(source, version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version || "")) {
    throw new Error("A valid asset release version is required.");
  }
  return String(source).replace(
    /(["'])((?:(?:\.\.?\/|\/)?[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)\.(?:css|js|mjs))(?:\?v=[^"'#\s]+)?\1/g,
    (match, quote, path) => `${quote}${path}?v=${version}${quote}`
  );
}

export async function writeReleaseMetadata(destination, options) {
  const metadata = await releaseMetadata(options);
  await writeFile(destination, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return metadata;
}
