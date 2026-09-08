import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageMetadata = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

export const THREE_VENDOR_VERSION = "0.185.1";
export const THREE_VENDOR_FILES = Object.freeze([
  "vendor/three/planet-hub-three.mjs",
  "vendor/three/GLTFLoader.js",
  "vendor/three/LICENSE.txt"
]);

// Keep the browser vendor pack limited to the API the Planet Hub actually uses.
// GLTFLoader is bundled into the same module so its Three.js dependencies share
// one tree-shaken graph instead of shipping the complete core and renderer builds.
export const PLANET_HUB_THREE_EXPORTS = Object.freeze([
  "ACESFilmicToneMapping",
  "AdditiveBlending",
  "AmbientLight",
  "BackSide",
  "BufferGeometry",
  "CatmullRomCurve3",
  "ClampToEdgeWrapping",
  "Color",
  "ConeGeometry",
  "CylinderGeometry",
  "DataTexture",
  "DirectionalLight",
  "DoubleSide",
  "Float32BufferAttribute",
  "Group",
  "HemisphereLight",
  "LinearFilter",
  "LineBasicMaterial",
  "LineSegments",
  "Matrix4",
  "Mesh",
  "MeshBasicMaterial",
  "MeshStandardMaterial",
  "NormalBlending",
  "PerspectiveCamera",
  "PlaneGeometry",
  "PointLight",
  "Points",
  "PointsMaterial",
  "Quaternion",
  "RGBAFormat",
  "Raycaster",
  "RepeatWrapping",
  "RingGeometry",
  "SRGBColorSpace",
  "Scene",
  "ShaderMaterial",
  "SphereGeometry",
  "TextureLoader",
  "TubeGeometry",
  "UnsignedByteType",
  "Vector2",
  "Vector3",
  "VideoTexture",
  "WebGLRenderer"
]);

// The Voyage Projection shares the canonical import-map module with Planet
// Hub. Keep its additional surface explicit so the tree-shaken browser build
// cannot silently omit constructors that are only exercised after the lazy
// cinematic loads.
export const VOYAGE_PROJECTION_THREE_EXPORTS = Object.freeze([
  "BufferAttribute",
  "TorusGeometry"
]);

// The isolated Moon Settlement lab shares the canonical Three.js graph but
// needs two additional runtime primitives: true bounds fitting for authored
// structures and the filtered PCF shadow mode used by its Standard quality tier.
export const MOON_SETTLEMENT_THREE_EXPORTS = Object.freeze([
  "Box3",
  "PCFShadowMap"
]);

export const THREE_VENDOR_EXPORTS = Object.freeze([
  ...PLANET_HUB_THREE_EXPORTS,
  ...VOYAGE_PROJECTION_THREE_EXPORTS.filter((name) => !PLANET_HUB_THREE_EXPORTS.includes(name)),
  ...MOON_SETTLEMENT_THREE_EXPORTS.filter((name) => (
    !PLANET_HUB_THREE_EXPORTS.includes(name) && !VOYAGE_PROJECTION_THREE_EXPORTS.includes(name)
  ))
]);

const sources = new Map([
  ["vendor/three/LICENSE.txt", "node_modules/three/LICENSE"]
]);

async function bundledPlanetHubThree() {
  const entry = `
export { ${THREE_VENDOR_EXPORTS.join(", ")} } from "three";
export { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
`;
  const result = await build({
    stdin: {
      contents: entry,
      loader: "js",
      resolveDir: root,
      sourcefile: "planet-hub-three-entry.mjs"
    },
    bundle: true,
    format: "esm",
    minify: true,
    legalComments: "none",
    platform: "browser",
    target: "es2022",
    write: false
  });
  assert.equal(result.warnings.length, 0, "Planet Hub Three.js vendor build emitted an unexpected warning.");
  assert.equal(result.outputFiles?.length, 1, "Planet Hub Three.js vendor build did not emit one ESM module.");
  return result.outputFiles[0].text;
}

export async function expectedThreeVendorFiles() {
  assert.equal(packageMetadata.devDependencies?.three, THREE_VENDOR_VERSION, `three must stay pinned to ${THREE_VENDOR_VERSION}.`);
  const files = new Map(await Promise.all([...sources].map(async ([outputPath, sourcePath]) => [
    outputPath,
    await readFile(join(root, sourcePath), "utf8")
  ])));
  files.set("vendor/three/planet-hub-three.mjs", await bundledPlanetHubThree());
  // Match the import-map URL exactly. A relative unversioned re-export makes
  // the browser instantiate the same bundled Three graph a second time under
  // a different module URL and emits "Multiple instances of Three.js".
  files.set("vendor/three/GLTFLoader.js",
    `export { GLTFLoader } from "./planet-hub-three.mjs?v=${packageMetadata.version}";\n`);
  return new Map(THREE_VENDOR_FILES.map((path) => [path, files.get(path)]));
}

export async function syncThreeVendor({ verifyOnly = false } = {}) {
  const expected = await expectedThreeVendorFiles();
  for (const [relativePath, contents] of expected) {
    const destination = join(root, "public", relativePath);
    if (verifyOnly) {
      assert.equal(await readFile(destination, "utf8"), contents, `${relativePath} is missing or does not match Three.js ${THREE_VENDOR_VERSION}. Run npm run assets:planet-hub.`);
      continue;
    }
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents, "utf8");
  }
  if (!verifyOnly) {
    for (const legacyFile of [
      "BufferGeometryUtils.js",
      "SkeletonUtils.js",
      "three.module.min.js",
      "three.core.min.js"
    ]) {
      await rm(join(root, "public", "vendor", "three", legacyFile), { force: true });
    }
  }
  return THREE_VENDOR_FILES;
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  const verifyOnly = process.argv.includes("--verify");
  await syncThreeVendor({ verifyOnly });
  console.log(`${verifyOnly ? "Verified" : "Synchronized"} Three.js ${THREE_VENDOR_VERSION} planet-hub vendor pack.`);
}
