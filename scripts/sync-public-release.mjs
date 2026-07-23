import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packageMetadata, withAssetVersion, writeReleaseMetadata } from "./release-metadata.mjs";
import { renderServiceWorker } from "./service-worker-source.mjs";
import { generateReleaseAssets } from "./generate-release-assets.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDirectory = join(root, "public");
const websiteDirectory = join(root, "Website");
const pkg = await packageMetadata();

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
  }
  await writeFile(path, source, "utf8");
}

for (const name of ["index.html", "privacy.html", "terms.html", "support.html"]) {
  const path = join(websiteDirectory, name);
  let source = withAssetVersion(await readFile(path, "utf8"), pkg.version);
  if (name === "index.html") {
    source = setBodyDataAttribute(source, "data-build-version", pkg.version);
    source = setBodyDataAttribute(source, "data-build-id", `${pkg.version}+source`);
  }
  await writeFile(path, source, "utf8");
}

await generateReleaseAssets();
await writeReleaseMetadata(join(publicDirectory, "release.json"), { channel: "server-beta", runtime: "server", revision: "source" });
const runtimeAssets = (await readdir(publicDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name !== "index.html" && entry.name !== "service-worker.js" && !entry.name.startsWith("social-card"))
  .map((entry) => `/${entry.name}${/\.(?:css|js|mjs)$/.test(entry.name) ? `?v=${pkg.version}` : ""}`)
  .sort((left, right) => left.localeCompare(right, "en"));
const worker = renderServiceWorker({
  cachePrefix: "constellore-play-",
  version: pkg.version,
  assets: runtimeAssets,
  navigationPath: "/play/",
  legacyCaches: ["constellore-shell-v24", "constellore-play-v27"]
});
await writeFile(join(publicDirectory, "service-worker.js"), worker, "utf8");
console.log(`Synchronized public release metadata and cache manifest for ${pkg.version}.`);
