import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getBounds, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

export const MOON_SETTLEMENT_GATE1_ASSET_IDS = Object.freeze([
  "solar-power",
  "lunar-power",
  "bastion-shelter",
  "hive-shelter",
  "haven-shelter",
  "beacon-signal",
  "stars-signal",
  "starter-vault",
  "processor",
  "storage",
  "reservoir",
  "greenhouse"
]);

const WORKSPACE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BLENDER_SCRIPT = path.join(WORKSPACE, "scripts", "moon-settlement-gate1-blender.py");
const TEXTURE_SCRIPT = path.join(WORKSPACE, "scripts", "moon-settlement-textures.py");
const PUBLIC_ROOT = path.join(WORKSPACE, "public", "art", "moon-settlement");
const MODEL_ROOT = path.join(PUBLIC_ROOT, "models");
const MATERIAL_ROOT = path.join(PUBLIC_ROOT, "materials");
const MANIFEST_PATH = path.join(PUBLIC_ROOT, "manifest.json");
const PRODUCTION_ROOT = path.join(WORKSPACE, "production", "moon-settlement", "gate-1");
const SOURCE_PATH = path.join(PRODUCTION_ROOT, "source", "moon-settlement-gate1-kit.blend");
const REVIEW_PATH = path.join(PRODUCTION_ROOT, "review", "moon-settlement-gate1-kit.png");
const BLENDER_REPORT_PATH = path.join(PRODUCTION_ROOT, "blender-build-report.json");
const PROFESSIONAL_SOURCE_ROOT = path.join(PRODUCTION_ROOT, "source", "textures", "professional-v2");
const PBR_SOURCE_ROOT = path.join(PRODUCTION_ROOT, "source", "textures", "pbr");
const PBR_CONTRACT_PATH = path.join(PBR_SOURCE_ROOT, "fieldkit-role-contract.json");
const RUNTIME_PBR_CONTRACT_PATH = path.join(MATERIAL_ROOT, "fieldkit-role-contract.json");
const DEFAULT_BLENDER = "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const PROFESSIONAL_SOURCE_FILES = Object.freeze([
  "lunar-composite-source.png",
  "graphite-alloy-source.png",
  "lunar-regolith-source.png",
  "photovoltaic-source.png"
]);

const PBR_OUTPUT_TIERS = Object.freeze([
  Object.freeze({ id: "master", root: PBR_SOURCE_ROOT, suffix: "master", pixels: 2048 }),
  Object.freeze({ id: "embedded-standard", root: PBR_SOURCE_ROOT, suffix: "standard", pixels: 512 }),
  Object.freeze({ id: "embedded-low", root: PBR_SOURCE_ROOT, suffix: "low", pixels: 256 }),
  Object.freeze({ id: "shared-standard", root: MATERIAL_ROOT, suffix: "standard", pixels: 1024 }),
  Object.freeze({ id: "shared-low", root: MATERIAL_ROOT, suffix: "low", pixels: 512 })
]);

const PBR_CHANNELS = Object.freeze([
  Object.freeze({ id: "basecolor", channels: 4 }),
  Object.freeze({ id: "orm", channels: 3 }),
  Object.freeze({ id: "normal", channels: 3 })
]);

function publicUrl(filePath) {
  return `./${path.relative(path.join(WORKSPACE, "public"), filePath).split(path.sep).join("/")}`;
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function inspectPng(filePath, { pixels, channels, channel }) {
  const file = await readFile(filePath);
  assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${filePath} must be a PNG.`);
  const image = sharp(filePath, { failOn: "error" });
  const metadata = await image.metadata();
  assert.equal(metadata.format, "png", `${filePath} must remain lossless PNG.`);
  assert.equal(metadata.width, pixels, `${filePath} has the wrong width.`);
  assert.equal(metadata.height, pixels, `${filePath} has the wrong height.`);
  assert.equal(metadata.channels, channels, `${filePath} has the wrong channel count.`);
  assert.equal(metadata.space, channels === 4 ? "srgb" : "srgb", `${filePath} must use an RGB-compatible PNG layout.`);

  const stats = await image.stats();
  assert.equal(stats.channels.length, channels, `${filePath} statistics do not match its declared channels.`);
  if (channel === "basecolor") {
    const alpha = stats.channels[3];
    assert.ok(alpha.min <= 96 && alpha.max === 255, `${filePath} must preserve transparent glass and opaque role tiles.`);
    assert.ok(stats.channels.slice(0, 3).every((entry) => entry.stdev > 4), `${filePath} must retain authored color detail.`);
  } else if (channel === "orm") {
    const [ao, roughness, metallic] = stats.channels;
    assert.ok(ao.min >= 128 && ao.max <= 255, `${filePath} has invalid ambient-occlusion values.`);
    assert.ok(roughness.min >= 8 && roughness.max <= 252 && roughness.max - roughness.min >= 24, `${filePath} must contain varied bounded roughness.`);
    assert.ok(metallic.min <= 8 && metallic.max >= 180, `${filePath} must distinguish dielectric and metallic roles.`);
  } else if (channel === "normal") {
    const [x, y, z] = stats.channels;
    assert.ok(x.mean >= 96 && x.mean <= 160 && y.mean >= 96 && y.mean <= 160, `${filePath} tangent normals are directionally biased.`);
    assert.ok(z.mean >= 175 && z.max === 255, `${filePath} must contain outward-facing tangent normals.`);
    assert.ok(x.stdev >= 1.0 && y.stdev >= 1.0, `${filePath} must contain visible normal detail.`);
  }
  return Object.freeze({
    path: path.relative(WORKSPACE, filePath).split(path.sep).join("/"),
    bytes: file.byteLength,
    sha256: await sha256(filePath),
    pixels,
    channels
  });
}

async function verifyProfessionalTextures() {
  for (const filename of PROFESSIONAL_SOURCE_FILES) {
    const filePath = path.join(PROFESSIONAL_SOURCE_ROOT, filename);
    const file = await readFile(filePath);
    assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${filename} must be a PNG source swatch.`);
    const metadata = await sharp(filePath).metadata();
    assert.equal(metadata.format, "png", `${filename} must remain PNG.`);
    assert.ok(metadata.width >= 1024 && metadata.height >= 1024, `${filename} is too small for a professional texture master.`);
    assert.equal(metadata.width, metadata.height, `${filename} must be square for deterministic role crops.`);
    assert.ok(metadata.channels >= 3, `${filename} must contain RGB source color.`);
  }

  const authoringContract = JSON.parse(await readFile(PBR_CONTRACT_PATH, "utf8"));
  const runtimeContract = JSON.parse(await readFile(RUNTIME_PBR_CONTRACT_PATH, "utf8"));
  assert.deepEqual(runtimeContract, authoringContract, "Authoring and runtime PBR role contracts must match exactly.");
  assert.equal(authoringContract.contract, "constellore-moon-settlement-fieldkit-pbr-v2");
  assert.equal(authoringContract.grid?.columns, 4);
  assert.equal(authoringContract.grid?.rows, 4);
  assert.equal(authoringContract.grid?.uvOrigin, "bottom-left");
  assert.equal(authoringContract.channels?.normal?.convention, "OpenGL +Y");
  assert.deepEqual(authoringContract.roles?.map(({ role }) => role), [
    "hull", "graphite", "regolith", "power",
    "material", "life", "signal", "matter",
    "damage", "solar", "glass", "soil",
    "window", "ceramic", "warm", "trim"
  ]);

  const records = {};
  for (const tier of PBR_OUTPUT_TIERS) {
    for (const channel of PBR_CHANNELS) {
      const filePath = path.join(tier.root, `fieldkit-${channel.id}-${tier.suffix}.png`);
      records[`${tier.id}-${channel.id}`] = await inspectPng(filePath, {
        pixels: tier.pixels,
        channels: channel.channels,
        channel: channel.id
      });
    }
  }
  assert.equal(authoringContract.outputs?.length, Object.keys(records).length, "The PBR contract must receipt every generated atlas.");
  return Object.freeze({
    contract: path.relative(WORKSPACE, RUNTIME_PBR_CONTRACT_PATH).split(path.sep).join("/"),
    records: Object.freeze(records)
  });
}

function triangleCount(document) {
  let count = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      count += (primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0) / 3;
    }
  }
  return Math.round(count);
}

async function inspectAsset(assetId, tier) {
  const filePath = path.join(MODEL_ROOT, `${assetId}-${tier}.glb`);
  const file = await readFile(filePath);
  assert.equal(file.subarray(0, 4).toString("utf8"), "glTF", `${assetId}-${tier} must be a binary glTF file.`);
  const document = await io.read(filePath);
  const root = document.getRoot();
  const scene = root.getDefaultScene() || root.listScenes()[0];
  assert.ok(scene, `${assetId}-${tier} must contain a scene.`);
  assert.ok(root.listMeshes().length > 0, `${assetId}-${tier} must contain mesh geometry.`);
  assert.ok(root.listMaterials().length > 0, `${assetId}-${tier} must contain authored PBR materials.`);
  assert.ok(root.listTextures().length > 0, `${assetId}-${tier} must contain an embedded texture atlas.`);
  assert.equal(root.listExtensionsRequired().length, 0, `${assetId}-${tier} must not require a decoder extension.`);
  const bounds = getBounds(scene);
  const extent = bounds.max.map((value, index) => value - bounds.min[index]);
  assert.ok(bounds.min[1] >= -0.03, `${assetId}-${tier} must sit on its Y=0 ground plane.`);
  assert.ok(extent[0] <= 1.56 && extent[2] <= 1.56, `${assetId}-${tier} exceeds the parcel footprint envelope.`);
  assert.ok(extent[1] >= 0.55 && extent[1] <= 1.85, `${assetId}-${tier} has an invalid authored height.`);
  const triangles = triangleCount(document);
  const bytes = file.byteLength;
  assert.ok(triangles > 80, `${assetId}-${tier} is too simple to be an authored structure.`);
  assert.ok(triangles <= (tier === "standard" ? 18_000 : 8_000), `${assetId}-${tier} exceeds its browser triangle ceiling.`);
  assert.ok(bytes <= (tier === "standard" ? 900_000 : 500_000), `${assetId}-${tier} exceeds its portable GLB byte ceiling.`);
  return Object.freeze({
    url: publicUrl(filePath),
    sha256: await sha256(filePath),
    bytes,
    triangles,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    bounds: Object.freeze({ min: bounds.min, max: bounds.max, extent })
  });
}

async function verifySourceArtifacts() {
  const blend = await readFile(SOURCE_PATH);
  // Blender 5 may transparently compress .blend files, so a legacy ASCII
  // header check is no longer reliable. The build itself saves this file and
  // the interactive Blender open check verifies readability afterward.
  assert.ok(blend.byteLength > 100_000, "The editable Blender source is missing or unexpectedly small.");
  const review = await readFile(REVIEW_PATH);
  assert.deepEqual([...review.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "The Blender review render must be a PNG.");
  const report = JSON.parse(await readFile(BLENDER_REPORT_PATH, "utf8"));
  assert.deepEqual(report.assets, [...MOON_SETTLEMENT_GATE1_ASSET_IDS]);
  return Object.freeze({
    blend: { path: path.relative(WORKSPACE, SOURCE_PATH).split(path.sep).join("/"), bytes: (await stat(SOURCE_PATH)).size, sha256: await sha256(SOURCE_PATH) },
    review: { path: path.relative(WORKSPACE, REVIEW_PATH).split(path.sep).join("/"), bytes: (await stat(REVIEW_PATH)).size, sha256: await sha256(REVIEW_PATH) }
  });
}

export async function verifyMoonSettlementAssets({ writeManifest = false } = {}) {
  const fieldkitTextures = await verifyProfessionalTextures();
  const profiles = { low: {}, standard: {} };
  const records = {};
  for (const tier of ["low", "standard"]) {
    for (const assetId of MOON_SETTLEMENT_GATE1_ASSET_IDS) {
      const inspection = await inspectAsset(assetId, tier);
      profiles[tier][assetId] = inspection.url;
      records[`${assetId}-${tier}`] = inspection;
    }
  }
  const source = await verifySourceArtifacts();
  const manifest = Object.freeze({
    version: 1,
    contract: "constellore-moon-settlement-gate1-v1",
    generatedBy: "Blender 5.1 + scripts/moon-settlement-gate1-blender.py",
    portable: true,
    compressedGeometry: false,
    fieldkitTextures,
    assetIds: [...MOON_SETTLEMENT_GATE1_ASSET_IDS],
    profiles,
    records,
    source
  });
  if (writeManifest) {
    await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  return manifest;
}

export async function buildMoonSettlementAssets() {
  const blender = process.env.CONSTELLORE_BLENDER || DEFAULT_BLENDER;
  const python = process.env.CONSTELLORE_PYTHON || "python";
  await access(TEXTURE_SCRIPT);
  await access(blender);
  await mkdir(MODEL_ROOT, { recursive: true });
  await mkdir(MATERIAL_ROOT, { recursive: true });
  await mkdir(path.dirname(SOURCE_PATH), { recursive: true });
  await mkdir(path.dirname(REVIEW_PATH), { recursive: true });
  execFileSync(python, [TEXTURE_SCRIPT, "--workspace", WORKSPACE], {
    cwd: WORKSPACE,
    stdio: "inherit",
    windowsHide: true
  });
  execFileSync(blender, [
    "--background",
    "--factory-startup",
    "--disable-autoexec",
    "--python-exit-code", "1",
    "--python", BLENDER_SCRIPT,
    "--",
    "--workspace", WORKSPACE,
    "--output", MODEL_ROOT,
    "--source", SOURCE_PATH,
    "--review", REVIEW_PATH
  ], { cwd: WORKSPACE, stdio: "inherit", windowsHide: true });
  return verifyMoonSettlementAssets({ writeManifest: true });
}

async function main() {
  const command = process.argv[2] || "build";
  const manifest = command === "verify"
    ? await verifyMoonSettlementAssets({ writeManifest: false })
    : command === "build"
      ? await buildMoonSettlementAssets()
      : null;
  if (!manifest) throw new Error(`Unknown Moon settlement asset command: ${command}`);
  const totalBytes = Object.values(manifest.records).reduce((sum, record) => sum + record.bytes, 0);
  const totalTriangles = Object.values(manifest.records).reduce((sum, record) => sum + record.triangles, 0);
  console.log(`Moon settlement kit verified: ${Object.keys(manifest.records).length} GLBs, ${totalTriangles.toLocaleString()} triangles, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB.`);
  console.log(`Editable source: ${manifest.source.blend.path}`);
  console.log(`Review render: ${manifest.source.review.path}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
