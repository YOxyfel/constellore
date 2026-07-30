import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCosmeticPacks } from "./cosmetic-assets.mjs";
import { validateAudioPacks } from "./audio-assets.mjs";
import { packageMetadata, withAssetVersion, writeReleaseMetadata } from "./release-metadata.mjs";
import { renderServiceWorker } from "./service-worker-source.mjs";
import { generateReleaseAssets } from "./generate-release-assets.mjs";
import { SECONDARY_SURFACE_FILES } from "../public/secondary-surface-loader.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDirectory = join(root, "public");
const websiteDirectory = join(root, "Website");
const pkg = await packageMetadata();
await validateCosmeticPacks(publicDirectory);
await validateAudioPacks(publicDirectory);

async function listRelativeFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listRelativeFiles(path, name));
    else if (entry.isFile()) files.push(name);
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function setBodyDataAttribute(document, name, value) {
  let foundBody = false;
  const updated = document.replace(/<body\b([^>]*)>/i, (tag, attributes) => {
    foundBody = true;
    const encoded = String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const pattern = new RegExp(`\\s${name}="[^"]*"`, "i");
    const nextAttributes = pattern.test(attributes)
      ? attributes.replace(pattern, ` ${name}="${encoded}"`)
      : `${attributes} ${name}="${encoded}"`;
    return `<body${nextAttributes}>`;
  });
  if (!foundBody) throw new Error(`Missing <body> while synchronizing ${name}.`);
  return updated;
}

const publicEntries = (await readdir(publicDirectory)).sort((left, right) => left.localeCompare(right, "en"));
for (const name of ["index.html", "app.js", ...publicEntries.filter((entry) => entry.endsWith(".mjs"))]) {
  const path = join(publicDirectory, name);
  let source = withAssetVersion(await readFile(path, "utf8"), pkg.version);
  if (name === "index.html") {
    source = setBodyDataAttribute(source, "data-build-version", pkg.version);
    source = setBodyDataAttribute(source, "data-build-id", `${pkg.version}+source`);
  } else if (name === "app.js") {
    source = source.replace(
      /(type:\s*"CONSTELLORE_ACTIVATE_UPDATE",\s*version:\s*")[^"]+(")/,
      `$1${pkg.version}$2`
    );
  }
  await writeFile(path, source, "utf8");
}
const storyDirectory = join(publicDirectory, "story");
for (const name of await listRelativeFiles(storyDirectory)) {
  const path = join(storyDirectory, name);
  if (/\.(?:js|mjs)$/.test(name)) {
    await writeFile(path, withAssetVersion(await readFile(path, "utf8"), pkg.version), "utf8");
  }
}
const cinematicDirectory = join(publicDirectory, "cinematic");
for (const name of await listRelativeFiles(cinematicDirectory)) {
  const path = join(cinematicDirectory, name);
  if (/\.(?:js|mjs)$/.test(name)) {
    await writeFile(path, withAssetVersion(await readFile(path, "utf8"), pkg.version), "utf8");
  }
}

for (const name of ["index.html", "privacy.html", "terms.html", "support.html"]) {
  const path = join(websiteDirectory, name);
  let source = withAssetVersion(await readFile(path, "utf8"), pkg.version);
  if (name === "index.html") {
    source = setBodyDataAttribute(source, "data-build-version", pkg.version);
    source = setBodyDataAttribute(source, "data-build-id", `${pkg.version}+source`);
    source = source.replace(
      /(<b\b[^>]*\bid="siteBuildVersion"[^>]*>)[^<]*(<\/b>)/i,
      `$1${pkg.version}$2`
    );
  }
  await writeFile(path, source, "utf8");
}

await generateReleaseAssets();
await writeReleaseMetadata(join(publicDirectory, "release.json"), { channel: "server-beta", runtime: "server", revision: "source" });
const secondarySurfaceAssets = new Set(SECONDARY_SURFACE_FILES);
const runtimeAssets = (await listRelativeFiles(publicDirectory))
  .filter((name) => (
    name !== "index.html"
    && name !== "service-worker.js"
    && !secondarySurfaceAssets.has(name)
    && !name.startsWith("social-card")
    && !name.startsWith("screenshots/")
    && !name.startsWith("art/ranks/")
    && !name.startsWith("art/transitions/")
    && !name.startsWith("art/home/")
    && !name.startsWith("art/cosmetics/")
    && !name.startsWith("audio/")
    && !name.startsWith("story/")
    && !name.startsWith("cinematic/")
  ))
  .map((name) => `/${name}${/\.(?:css|js|mjs)$/.test(name) ? `?v=${pkg.version}` : ""}`)
  .sort((left, right) => left.localeCompare(right, "en"));
const worker = renderServiceWorker({
  cachePrefix: "constellore-play-",
  version: pkg.version,
  assets: runtimeAssets,
  lazyAssets: ["/art/ranks/", "/art/transitions/", "/art/home/", "/story/", "/cinematic/"],
  lazyFiles: SECONDARY_SURFACE_FILES.map((name) => `/${name}?v=${pkg.version}`),
  lazyPacks: ["/art/cosmetics/", "/audio/"],
  navigationPath: "/play/",
  legacyCaches: ["constellore-shell-v24", "constellore-play-v27"]
});
await writeFile(join(publicDirectory, "service-worker.js"), worker, "utf8");
console.log(`Synchronized public release metadata and cache manifest for ${pkg.version}.`);
