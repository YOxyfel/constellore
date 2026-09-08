import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFile, readFile, readdir, rm, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, prune, reorder, simplify, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import {
  PLANET_HUB_DESTINATIONS,
  PLANET_HUB_RING_TILT_DEGREES,
  PLANET_HUB_ROAD_RADIUS,
  assertDestinationAnchorSpacing,
  createDestinationAnchors,
} from '../public/planet-hub-domain.mjs';
import { assertUsablePlanetHubPosterMetadata } from './planet-hub-packaging.mjs';

const WORKSPACE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(WORKSPACE, 'scripts', 'planet-hub.config.json');
const OUTPUT = path.join(WORKSPACE, 'public', 'art', 'planet-hub');
const MODEL_OUTPUT = path.join(OUTPUT, 'models');
const POSTER_OUTPUT = path.join(OUTPUT, 'posters');
const MEDIA_OUTPUT = path.join(OUTPUT, 'media');
const DETAIL_OUTPUT = path.join(OUTPUT, 'details');
const SPACE_LAYER_OUTPUT = path.join(OUTPUT, 'space-layers');
const GALAXY_OUTPUT = path.join(OUTPUT, 'galaxy');
const PLACE_THUMBNAIL_OUTPUT = path.join(OUTPUT, 'place-thumbnails');
const TEMP = path.join(WORKSPACE, '.tmp', 'planet-hub-assets');
const POSTER_TEMP = path.join(TEMP, 'posters');
const EARTH_SURFACE_HELPER = path.join(WORKSPACE, 'scripts', 'build-earth-surface-detail.py');
const EARTH_ALBEDO_SOURCE = 'itch-assets/Models/Earth/textures/earth albedo.jpg';
const PYTHON_HELPER = path.join(WORKSPACE, 'scripts', 'planet-hub-textures.py');
const POSTER_PAGE = path.join(WORKSPACE, 'scripts', 'planet-hub-poster-page.html');
const MANIFEST_PATH = path.join(OUTPUT, 'manifest.json');
const DESTINATIONS = [...PLANET_HUB_DESTINATIONS];
const TIERS = ['low', 'standard'];
const DETAIL_DERIVATION_VERSION = 1;
const SPACE_LAYER_DERIVATION_VERSION = 1;
const GALAXY_TEXTURE_DERIVATION_VERSION = 1;
const PLACE_THUMBNAIL_DERIVATION_VERSION = 1;

const GALAXY_TEXTURE_SOURCE = 'itch-assets/Models/SpaceLayers/milky-way-source.png';
const PLACE_THUMBNAIL_SOURCE = 'itch-assets/Models/PlaceThumbnails/solar-bodies-source.png';
const PLACE_THUMBNAIL_ORDER = Object.freeze([
  'sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
]);

const SPACE_LAYER_SPECS = Object.freeze([
  Object.freeze({ id: 'cosmic-horizon', order: 1, source: 'itch-assets/Models/SpaceLayers/01-cosmic-horizon-source.png' }),
  Object.freeze({ id: 'deep-stars', order: 2, source: 'itch-assets/Models/SpaceLayers/02-deep-stars-source.png' }),
  Object.freeze({ id: 'deep-sky', order: 3, source: 'itch-assets/Models/SpaceLayers/03-deep-sky-source.png' }),
  Object.freeze({ id: 'nebula-filaments', order: 4, source: 'itch-assets/Models/SpaceLayers/04-nebula-filaments-source.png' }),
  Object.freeze({ id: 'near-stars', order: 5, source: 'itch-assets/Models/SpaceLayers/05-near-stars-source.png' }),
]);

const SOURCES = {
  earth: {
    source: 'itch-assets/Models/Earth/Earth1k.glb',
    tierSources: { standard: 'itch-assets/Models/Earth/Earth8K.glb' },
    kind: 'planet',
    material: 'phong1',
  },
  moon: { source: 'itch-assets/Models/Moon/Moon1K.glb', kind: 'planet' },
  sun: {
    source: 'itch-assets/Models/Sun/sun.glb',
    kind: 'planet',
    material: 'material',
    singleLod: true,
    sharedAcrossTiers: true,
    stripAnimations: true,
  },
  forge: { source: 'itch-assets/Models/MainZone/MainZoneTextured.glb', kind: 'landmark' },
  rocket: { source: 'itch-assets/Models/Rocket/RocketTextured.glb', kind: 'landmark' },
  portal: { source: 'itch-assets/Models/PortalZone/Portal.glb', kind: 'landmark' },
  'earth-landing': { source: 'itch-assets/Models/Earth/earth landing.glb', kind: 'landmark' },
  'moon-landing': { source: 'itch-assets/Models/Moon/moon landing.glb', kind: 'landmark' },
};

const PORTAL_COLOR = path.join(WORKSPACE, 'itch-assets', 'Models', 'PortalZone', 'VFX', 'Front_Portal_5_2682_2K', 'Front_Portal_5_2682_2K.mov');
const PORTAL_MATTE = path.join(WORKSPACE, 'itch-assets', 'Models', 'PortalZone', 'VFX', 'Front_Portal_5_2682_2K', 'Front_Portal_5_Matte_2K.mov');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const AUTHORED_DETAIL_SPECS = Object.freeze({
  earthClouds: Object.freeze({
    output: 'earth-clouds',
    source: 'itch-assets/Models/Earth/Earth8K.glb',
    material: 'lambert6',
    slot: 'baseColor',
    mode: 'clouds',
    colorSpace: 'srgb',
    usage: 'earth-cloud-alpha-shell',
  }),
  earthNight: Object.freeze({
    output: 'earth-night',
    source: 'itch-assets/Models/Earth/Earth8K.glb',
    material: 'phong1',
    slot: 'emissive',
    mode: 'night',
    colorSpace: 'srgb',
    usage: 'earth-night-emissive',
  }),
  sunEmissive: Object.freeze({
    output: 'sun-emissive',
    source: 'itch-assets/Models/Sun/sun.glb',
    material: 'material',
    slot: 'emissive',
    mode: 'sun-emissive',
    colorSpace: 'srgb',
    usage: 'sun-emissive',
  }),
});

const MATERIAL_SUPPORT_SPECS = Object.freeze({
  forge: Object.freeze({ source: 'itch-assets/Models/MainZone/MainZoneTextured.glb', material: 'tripo_node_53f5b7db_material' }),
  'earth-landing': Object.freeze({ source: 'itch-assets/Models/Earth/earth landing.glb', material: 'tripo_node_78d8f864-15d5-4a7d-b8ec-e12d30af8aaa_material' }),
  'moon-landing': Object.freeze({ source: 'itch-assets/Models/Moon/moon landing.glb', material: 'tripo_node_7c052cba-d41c-4091-bd69-bcf74925c56d_material' }),
  portal: Object.freeze({ source: 'itch-assets/Models/PortalZone/Portal.glb', material: 'tripo_node_d424c05c-ae10-487c-80cd-92d34a5d0bc3_material' }),
  rocket: Object.freeze({ source: 'itch-assets/Models/Rocket/RocketTextured.glb', material: 'tripo_node_c52a85b5_material' }),
});

function posix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function publicUrl(absolutePath) {
  return `./${posix(path.relative(path.join(WORKSPACE, 'public'), absolutePath))}`;
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

function run(command, args, options = {}) {
  const output = execFileSync(command, args, { cwd: WORKSPACE, encoding: 'utf8', stdio: options.capture ? 'pipe' : 'inherit' });
  return typeof output === 'string' ? output.trim() : '';
}

function inspectImage(filePath) {
  return JSON.parse(run('python', [PYTHON_HELPER, 'inspect', filePath], { capture: true }));
}

function assertUsablePosterImage(inspection, label, expectedFormat = 'WEBP') {
  assert.equal(inspection.format, expectedFormat, `${label} has the wrong image format.`);
  assertUsablePlanetHubPosterMetadata({ ...inspection, format: 'WEBP' }, label);
}

function packageVersion(name) {
  const packagePath = path.join(WORKSPACE, 'node_modules', ...name.split('/'), 'package.json');
  return execFileSync(process.execPath, ['-e', `process.stdout.write(require(${JSON.stringify(packagePath)}).version)`], { encoding: 'utf8' });
}

async function loadConfig() {
  return JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
}

function triangleCount(document) {
  let count = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      count += (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
    }
  }
  return Math.round(count);
}

function textureDimensions(document) {
  return document.getRoot().listTextures().map((texture) => {
    const [width, height] = texture.getSize();
    return { width, height, mimeType: texture.getMimeType() };
  });
}

function cleanMaterials(document) {
  for (const extension of [...document.getRoot().listExtensionsUsed()]) extension.dispose();
  for (const material of document.getRoot().listMaterials()) {
    material.setMetallicFactor(0).setRoughnessFactor(0.82).setDoubleSided(false);
    material.setEmissiveFactor([0, 0, 0]);
    // The runtime deliberately uses a lit, non-emissive planet material. Drop
    // the now-unused authored emissive maps before packing so the standard
    // Earth can spend its byte budget on a sharper 2K albedo instead.
    material.setEmissiveTexture?.(null);
  }
}

function selectPlanetLod(document, spec, maximumTriangles = Number.POSITIVE_INFINITY) {
  let candidates = document.getRoot().listNodes().filter((node) => {
    const mesh = node.getMesh();
    if (!mesh) return false;
    return !spec.material || mesh.listPrimitives().some((primitive) => primitive.getMaterial()?.getName() === spec.material);
  });
  assert(candidates.length, 'Planet source contains no selectable mesh nodes.');
  if (spec.singleLod && candidates.length > 1) {
    const primitiveCount = (node) => node.getMesh().listPrimitives().reduce((sum, primitive) => (
      sum + (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3
    ), 0);
    const ranked = candidates
      .map((node) => ({ node, triangles: primitiveCount(node) }))
      .sort((left, right) => left.triangles - right.triangles);
    // Prefer the richest authored LOD already within budget. When every source
    // LOD is over budget, simplify the smallest one so UV seams and topology
    // suffer the least possible change.
    candidates = [(ranked.filter((entry) => entry.triangles <= maximumTriangles).at(-1) || ranked[0]).node];
  }
  const keep = new Set(candidates);
  for (const node of document.getRoot().listNodes()) {
    if (node.getMesh() && !keep.has(node)) node.dispose();
  }
}

function normalizeScene(document, kind) {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  const bounds = getBounds(scene);
  const center = bounds.min.map((value, index) => (value + bounds.max[index]) / 2);
  const extent = bounds.max.map((value, index) => value - bounds.min[index]);
  const scale = (kind === 'planet' ? 2 : 1) / Math.max(...extent);
  const pivot = kind === 'planet' ? center : [center[0], bounds.min[1], center[2]];
  const wrapper = document.createNode('PlanetHub_Normalized').setScale([scale, scale, scale]).setTranslation(pivot.map((value) => -value * scale));
  for (const child of [...scene.listChildren()]) wrapper.addChild(child);
  scene.addChild(wrapper);
}

function targetTriangles(name, tier, config) {
  const budget = config.budgets.tiers[tier];
  if (name === 'earth') return budget.earthTriangles;
  if (name === 'moon') return budget.moonTriangles;
  if (name === 'sun') return budget.sunTriangles;
  return budget.landmarkTriangles - 1;
}

async function buildModel(name, tier, config) {
  const spec = SOURCES[name];
  const sourcePath = path.join(WORKSPACE, spec.tierSources?.[tier] || spec.source);
  const workDirectory = path.join(TEMP, `${name}-${tier}`);
  await mkdir(workDirectory, { recursive: true });
  let document = await io.read(sourcePath);
  const maximum = targetTriangles(name, tier, config);
  if (spec.stripAnimations) {
    for (const animation of [...document.getRoot().listAnimations()]) animation.dispose();
  }
  if (spec.kind === 'planet') selectPlanetLod(document, spec, maximum);
  cleanMaterials(document);
  normalizeScene(document, spec.kind);
  Object.assign(document.getRoot().getAsset(), {
    generator: `Constellore Planet Hub / glTF Transform ${config.tools.gltfTransform}`,
  });
  const externalPath = path.join(workDirectory, `${name}.gltf`);
  await io.write(externalPath, document);
  const textureLimit = name === 'sun'
    ? config.budgets.tiers[tier].sunTextureSize
    : spec.kind === 'planet'
    ? config.budgets.tiers[tier].planetTextureSize
    : config.budgets.tiers[tier].landmarkTextureSize;
  run('python', [PYTHON_HELPER, 'resize', workDirectory, '--max', String(textureLimit)]);
  document = await io.read(externalPath);
  const before = triangleCount(document);
  const protectPlanetSeams = spec.kind === 'planet' && spec.singleLod;
  const transforms = protectPlanetSeams ? [dedup(), flatten()] : [dedup(), flatten(), weld()];
  if (before > maximum) transforms.push(simplify({
    simplifier: MeshoptSimplifier,
    ratio: Math.max(0.001, maximum / before * 0.985),
    error: protectPlanetSeams ? 0.01 : 1,
    lockBorder: protectPlanetSeams,
  }));
  transforms.push(prune(), reorder({ encoder: MeshoptEncoder }));
  await document.transform(...transforms);
  cleanMaterials(document);
  const outputPath = path.join(MODEL_OUTPUT, `${name}-${tier}.glb`);
  await io.write(outputPath, document);
  const outputDocument = await io.read(outputPath);
  const triangles = triangleCount(outputDocument);
  assert(triangles <= maximum, `${name}-${tier} has ${triangles} triangles, above ${maximum}.`);
  const bounds = getBounds(outputDocument.getRoot().getDefaultScene() ?? outputDocument.getRoot().listScenes()[0]);
  const fileStat = await stat(outputPath);
  return {
    url: publicUrl(outputPath),
    bytes: fileStat.size,
    triangles,
    sha256: await sha256(outputPath),
    bounds: { min: bounds.min.map((value) => Number(value.toFixed(6))), max: bounds.max.map((value) => Number(value.toFixed(6))) },
    textures: textureDimensions(outputDocument),
  };
}

function textureForMaterialSlot(material, slot) {
  if (slot === 'baseColor') return material.getBaseColorTexture?.() || null;
  if (slot === 'emissive') return material.getEmissiveTexture?.() || null;
  throw new Error(`Unsupported authored detail slot: ${slot}`);
}

function textureExtension(texture) {
  if (texture?.getMimeType?.() === 'image/png') return '.png';
  if (texture?.getMimeType?.() === 'image/webp') return '.webp';
  return '.jpg';
}

async function createDetailSourceReader() {
  const documents = new Map();
  const extracted = new Map();
  const sourceDirectory = path.join(TEMP, 'detail-sources');
  await mkdir(sourceDirectory, { recursive: true });
  return async function readDetailTexture(spec, slot = spec.slot || 'baseColor') {
    const key = `${spec.source}|${spec.material}|${slot}`;
    if (extracted.has(key)) return extracted.get(key);
    let document = documents.get(spec.source);
    if (!document) {
      document = await io.read(path.join(WORKSPACE, spec.source));
      documents.set(spec.source, document);
    }
    const material = document.getRoot().listMaterials().find((entry) => entry.getName() === spec.material);
    assert(material, `Detail source material ${spec.material} is missing from ${spec.source}.`);
    const texture = textureForMaterialSlot(material, slot);
    assert(texture?.getImage?.(), `Detail source ${spec.source} has no ${slot} texture on ${spec.material}.`);
    const safeName = key.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    const output = path.join(sourceDirectory, `${safeName}${textureExtension(texture)}`);
    await writeFile(output, texture.getImage());
    extracted.set(key, output);
    return output;
  };
}

async function detailTextureRecord(filePath, metadata) {
  const inspection = inspectImage(filePath);
  assert.equal(inspection.format, 'WEBP', `${filePath} is not a deterministic WebP derivative.`);
  assert.equal(inspection.width, metadata.width, `${filePath} has the wrong width.`);
  assert.equal(inspection.height, metadata.height, `${filePath} has the wrong height.`);
  if (metadata.hasAlpha !== undefined) {
    assert.equal(inspection.hasAlpha, metadata.hasAlpha, `${filePath} has the wrong alpha contract.`);
  }
  return {
    url: publicUrl(filePath),
    bytes: (await stat(filePath)).size,
    sha256: await sha256(filePath),
    width: inspection.width,
    height: inspection.height,
    mimeType: 'image/webp',
    colorSpace: metadata.colorSpace,
    usage: metadata.usage,
    authored: metadata.authored,
    derived: metadata.derived,
    source: metadata.source,
    channels: metadata.channels,
    algorithm: metadata.algorithm,
    hasAlpha: inspection.hasAlpha,
    lumaStdDev: inspection.lumaStdDev,
  };
}

async function deriveDetailTexture({
  sourcePath,
  outputName,
  tier,
  mode,
  width,
  height,
  role = null,
  metadata,
}) {
  const outputPath = path.join(DETAIL_OUTPUT, `${outputName}-${tier}.webp`);
  const args = [PYTHON_HELPER, 'derive', sourcePath, outputPath, '--mode', mode, '--width', String(width), '--height', String(height)];
  if (role) args.push('--role', role);
  run('python', args);
  return detailTextureRecord(outputPath, { ...metadata, width, height });
}

async function buildOptionalDetails(config) {
  await rm(DETAIL_OUTPUT, { recursive: true, force: true });
  await mkdir(DETAIL_OUTPUT, { recursive: true });
  const readDetailTexture = await createDetailSourceReader();
  const tiers = {};
  let totalBytes = 0;
  for (const tier of TIERS) {
    const limits = config.budgets.detailTiers[tier];
    const earthWidth = limits.earthTextureWidth;
    const sunWidth = limits.sunTextureWidth;
    const supportWidth = limits.supportTextureWidth;
    const earth = {};
    const sun = {};
    const materials = {};

    for (const [key, spec] of Object.entries(AUTHORED_DETAIL_SPECS)) {
      const sourcePath = await readDetailTexture(spec);
      const width = key === 'sunEmissive' ? sunWidth : earthWidth;
      const height = key === 'sunEmissive' ? Math.round(sunWidth / 2) : Math.round(earthWidth / 2);
      const record = await deriveDetailTexture({
        sourcePath,
        outputName: spec.output,
        tier,
        mode: spec.mode,
        width,
        height,
        metadata: {
          authored: true,
          derived: false,
          colorSpace: spec.colorSpace,
          usage: spec.usage,
          hasAlpha: spec.mode === 'clouds',
          channels: spec.mode === 'clouds' ? 'rgba' : 'rgb',
          source: { model: spec.source, material: spec.material, slot: spec.slot },
        },
      });
      if (key === 'earthClouds') earth.clouds = record;
      else if (key === 'earthNight') earth.night = record;
      else sun.emissive = record;
    }

    for (const [role, spec] of Object.entries(MATERIAL_SUPPORT_SPECS)) {
      const sourcePath = await readDetailTexture(spec, 'baseColor');
      const common = {
        authored: false,
        derived: true,
        colorSpace: 'linear',
        source: { model: spec.source, material: spec.material, slot: 'baseColor' },
        algorithm: `albedo-support-v${DETAIL_DERIVATION_VERSION}`,
      };
      const normal = await deriveDetailTexture({
        sourcePath,
        outputName: `${role}-normal`,
        tier,
        mode: 'normal',
        role,
        width: supportWidth,
        height: supportWidth,
        metadata: { ...common, usage: 'focus-normal', channels: 'tangent-normal-rgb', hasAlpha: false },
      });
      const orm = await deriveDetailTexture({
        sourcePath,
        outputName: `${role}-orm`,
        tier,
        mode: 'orm',
        role,
        width: supportWidth,
        height: supportWidth,
        metadata: { ...common, usage: 'focus-orm', channels: 'r=ao,g=roughness,b=metallic', hasAlpha: false },
      });
      materials[role] = { normal, orm };
      if (role === 'portal') {
        materials[role].emissive = await deriveDetailTexture({
          sourcePath,
          outputName: 'portal-emissive',
          tier,
          mode: 'portal-emissive',
          role,
          width: supportWidth,
          height: supportWidth,
          metadata: {
            ...common,
            colorSpace: 'srgb',
            usage: 'focus-emissive',
            channels: 'rgb',
            hasAlpha: false,
            algorithm: `conservative-portal-emissive-v${DETAIL_DERIVATION_VERSION}`,
          },
        });
      }
    }

    const tierRecords = [
      ...Object.values(earth),
      ...Object.values(sun),
      ...Object.values(materials).flatMap((entry) => Object.values(entry)),
    ];
    const tierBytes = tierRecords.reduce((sum, record) => sum + record.bytes, 0);
    assert(tierBytes <= limits.bytes, `${tier} optional details exceed ${limits.bytes} bytes (${tierBytes} bytes).`);
    totalBytes += tierBytes;
    tiers[tier] = { bytes: tierBytes, earth, sun, materials };
  }
  assert(totalBytes <= config.budgets.optionalDetailBytes,
    `Optional detail pack exceeds ${config.budgets.optionalDetailBytes} bytes (${totalBytes} bytes).`);
  return {
    schemaVersion: 1,
    derivationVersion: DETAIL_DERIVATION_VERSION,
    initialScene: false,
    loadPolicy: 'focus',
    textureContract: {
      flipY: false,
      uvChannel: 0,
      authoredColorSpace: 'srgb',
      supportColorSpace: 'none',
    },
    bytes: totalBytes,
    tiers,
  };
}

async function buildSpaceLayers(config) {
  const budget = config.budgets.spaceLayers;
  assert(budget?.tiers, 'Planet-hub config is missing space-layer tier budgets.');
  await rm(SPACE_LAYER_OUTPUT, { recursive: true, force: true });
  await mkdir(SPACE_LAYER_OUTPUT, { recursive: true });
  const tiers = {};
  let totalBytes = 0;
  for (const tier of TIERS) {
    const limits = budget.tiers[tier];
    assert(limits?.width && limits?.height && limits?.quality && limits?.bytes,
      `Planet-hub config is missing the ${tier} space-layer contract.`);
    assert.equal(limits.width, limits.height * 2, `${tier} space layers must use an exact 2:1 aspect ratio.`);
    const layers = [];
    for (const spec of SPACE_LAYER_SPECS) {
      const prefix = String(spec.order).padStart(2, '0');
      const sourcePath = path.join(WORKSPACE, spec.source);
      const outputPath = path.join(SPACE_LAYER_OUTPUT, `${prefix}-${spec.id}-${tier}.webp`);
      run('python', [
        PYTHON_HELPER,
        'space-layer',
        sourcePath,
        outputPath,
        '--width', String(limits.width),
        '--height', String(limits.height),
        '--quality', String(limits.quality),
      ]);
      const inspection = inspectImage(outputPath);
      assert.equal(inspection.format, 'WEBP', `${spec.id}-${tier} must be WebP.`);
      assert.equal(inspection.width, limits.width, `${spec.id}-${tier} has the wrong width.`);
      assert.equal(inspection.height, limits.height, `${spec.id}-${tier} has the wrong height.`);
      assert.equal(inspection.hasAlpha, false, `${spec.id}-${tier} must be opaque.`);
      assert(inspection.lumaStdDev > 0.05, `${spec.id}-${tier} is visually degenerate.`);
      const bytes = (await stat(outputPath)).size;
      layers.push({
        id: spec.id,
        order: spec.order,
        url: publicUrl(outputPath),
        bytes,
        sha256: await sha256(outputPath),
        width: inspection.width,
        height: inspection.height,
        mimeType: 'image/webp',
      });
    }
    const tierBytes = layers.reduce((sum, record) => sum + record.bytes, 0);
    assert(tierBytes <= limits.bytes, `${tier} space layers exceed ${limits.bytes} bytes (${tierBytes} bytes).`);
    totalBytes += tierBytes;
    tiers[tier] = {
      width: limits.width,
      height: limits.height,
      quality: limits.quality,
      bytes: tierBytes,
      layers,
    };
  }
  assert(totalBytes <= budget.bytes,
    `Space-layer pack exceeds ${budget.bytes} bytes (${totalBytes} bytes).`);
  return {
    schemaVersion: 1,
    derivationVersion: SPACE_LAYER_DERIVATION_VERSION,
    initialScene: false,
    loadPolicy: 'progressive-after-ready',
    textureContract: {
      projection: 'equirectangular',
      colorSpace: 'srgb',
      horizontalWrap: 'repeat',
      verticalWrap: 'clamp',
      mipmaps: false,
    },
    bytes: totalBytes,
    tiers,
  };
}

async function buildGalaxyTexture(config) {
  const budget = config.budgets.galaxyTexture;
  assert(budget?.tiers, 'Planet-hub config is missing galaxy-texture tier budgets.');
  await rm(GALAXY_OUTPUT, { recursive: true, force: true });
  await mkdir(GALAXY_OUTPUT, { recursive: true });
  const tiers = {};
  let totalBytes = 0;
  for (const tier of TIERS) {
    const limits = budget.tiers[tier];
    assert(limits?.width && limits?.quality && limits?.bytes,
      `Planet-hub config is missing the ${tier} galaxy-texture contract.`);
    const outputPath = path.join(GALAXY_OUTPUT, `milky-way-${tier}.webp`);
    run('python', [
      PYTHON_HELPER,
      'galaxy-texture',
      path.join(WORKSPACE, GALAXY_TEXTURE_SOURCE),
      outputPath,
      '--width', String(limits.width),
      '--height', String(limits.width),
      '--quality', String(limits.quality),
    ]);
    const inspection = inspectImage(outputPath);
    assert.equal(inspection.format, 'WEBP', `${tier} galaxy texture must be WebP.`);
    assert.equal(inspection.width, limits.width, `${tier} galaxy texture has the wrong width.`);
    assert.equal(inspection.height, limits.width, `${tier} galaxy texture has the wrong height.`);
    assert.equal(inspection.hasAlpha, false, `${tier} galaxy texture must be opaque.`);
    assert(inspection.lumaStdDev > 8, `${tier} galaxy texture is visually degenerate.`);
    const bytes = (await stat(outputPath)).size;
    assert(bytes <= limits.bytes, `${tier} galaxy texture exceeds ${limits.bytes} bytes (${bytes} bytes).`);
    totalBytes += bytes;
    tiers[tier] = {
      url: publicUrl(outputPath),
      bytes,
      sha256: await sha256(outputPath),
      width: inspection.width,
      height: inspection.height,
      mimeType: 'image/webp',
      quality: limits.quality,
    };
  }
  assert(totalBytes <= budget.bytes,
    `Galaxy textures exceed ${budget.bytes} bytes (${totalBytes} bytes).`);
  return {
    schemaVersion: 1,
    derivationVersion: GALAXY_TEXTURE_DERIVATION_VERSION,
    initialScene: false,
    loadPolicy: 'milky-way-tier',
    textureContract: {
      projection: 'face-on-disc',
      colorSpace: 'srgb',
      background: 'black-luminance-alpha',
      mipmaps: true,
    },
    bytes: totalBytes,
    tiers,
  };
}

async function buildPlaceThumbnails(config) {
  const limits = config.budgets.placeThumbnails;
  assert(limits?.width && limits?.height && limits?.tileSize && limits?.quality && limits?.bytes,
    'Planet-hub config is missing the Places-thumbnail contract.');
  assert.equal(limits.width, limits.tileSize * PLACE_THUMBNAIL_ORDER.length,
    'Places thumbnail sprite must contain ten square tiles.');
  assert.equal(limits.height, limits.tileSize,
    'Places thumbnail tiles must be square.');
  await rm(PLACE_THUMBNAIL_OUTPUT, { recursive: true, force: true });
  await mkdir(PLACE_THUMBNAIL_OUTPUT, { recursive: true });
  const outputPath = path.join(PLACE_THUMBNAIL_OUTPUT, 'solar-bodies.webp');
  run('python', [
    PYTHON_HELPER,
    'place-thumbnails',
    path.join(WORKSPACE, PLACE_THUMBNAIL_SOURCE),
    outputPath,
    '--width', String(limits.width),
    '--height', String(limits.height),
    '--quality', String(limits.quality),
  ]);
  const inspection = inspectImage(outputPath);
  assert.equal(inspection.format, 'WEBP', 'Places thumbnail sprite must be WebP.');
  assert.equal(inspection.width, limits.width, 'Places thumbnail sprite has the wrong width.');
  assert.equal(inspection.height, limits.height, 'Places thumbnail sprite has the wrong height.');
  assert.equal(inspection.hasAlpha, false, 'Places thumbnail sprite must be opaque.');
  assert(inspection.lumaStdDev > 20, 'Places thumbnail sprite is visually degenerate.');
  const bytes = (await stat(outputPath)).size;
  assert(bytes <= limits.bytes,
    `Places thumbnail sprite exceeds ${limits.bytes} bytes (${bytes} bytes).`);
  return {
    schemaVersion: 1,
    derivationVersion: PLACE_THUMBNAIL_DERIVATION_VERSION,
    initialScene: false,
    loadPolicy: 'places-panel',
    sprite: {
      url: publicUrl(outputPath),
      bytes,
      sha256: await sha256(outputPath),
      width: inspection.width,
      height: inspection.height,
      tileSize: limits.tileSize,
      count: PLACE_THUMBNAIL_ORDER.length,
      order: [...PLACE_THUMBNAIL_ORDER],
      quality: limits.quality,
      mimeType: 'image/webp',
    },
  };
}

function ffprobe(filePath) {
  return JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', filePath], { capture: true }));
}

async function buildPortalMedia(config) {
  const mp4 = path.join(MEDIA_OUTPUT, 'portal-alpha.mp4');
  const webm = path.join(MEDIA_OUTPUT, 'portal-alpha.webm');
  const poster = path.join(MEDIA_OUTPUT, 'portal-alpha.webp');
  const filter = '[0:v]crop=1080:1080:484:0,scale=512:512:flags=lanczos,setsar=1[color];[1:v]crop=1080:1080:484:0,scale=512:512:flags=lanczos,format=gray,setsar=1[matte];[color][matte]hstack=inputs=2,format=yuv420p[out]';
  const deterministic = ['-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-threads', '1'];
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', PORTAL_COLOR, '-i', PORTAL_MATTE, '-filter_complex', filter, '-map', '[out]', '-an', '-frames:v', '200', '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-b:v', '780k', '-maxrate', '780k', '-bufsize', '1560k', ...deterministic, '-movflags', '+faststart', mp4]);
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', PORTAL_COLOR, '-i', PORTAL_MATTE, '-filter_complex', filter, '-map', '[out]', '-an', '-frames:v', '200', '-r', '30', '-c:v', 'libvpx-vp9', '-deadline', 'good', '-cpu-used', '2', '-crf', '34', '-b:v', '560k', ...deterministic, webm]);
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '2.0', '-i', PORTAL_COLOR, '-ss', '2.0', '-i', PORTAL_MATTE, '-filter_complex', filter, '-map', '[out]', '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', poster]);
  assert((await stat(mp4)).size <= config.budgets.portalMp4Bytes, 'Portal MP4 exceeds its byte budget.');
  return {
    mp4: publicUrl(mp4),
    webm: publicUrl(webm),
    poster: publicUrl(poster),
    width: 1024,
    height: 512,
    frameCount: 200,
    durationSeconds: 6.667,
    muted: true,
    loopable: true,
    colorRect: [0, 0, 0.5, 1],
    matteRect: [0.5, 0, 0.5, 1],
    files: {
      mp4: { bytes: (await stat(mp4)).size, sha256: await sha256(mp4) },
      webm: { bytes: (await stat(webm)).size, sha256: await sha256(webm) },
      poster: { bytes: (await stat(poster)).size, sha256: await sha256(poster) },
    },
  };
}

async function serveWorkspace() {
  const server = createServer(async (request, response) => {
    try {
      const requestPath = new URL(request.url, 'http://127.0.0.1').pathname;
      const absolutePath = path.resolve(WORKSPACE, `.${decodeURIComponent(requestPath)}`);
      if (!absolutePath.startsWith(`${WORKSPACE}${path.sep}`)) throw new Error('Outside workspace');
      const mime = ({
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.glb': 'model/gltf-binary',
        '.webp': 'image/webp',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm'
      })[path.extname(absolutePath).toLowerCase()] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      response.end(await readFile(absolutePath));
    } catch {
      if (!response.headersSent) response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

async function buildPosters() {
  const { chromium } = await import('@playwright/test');
  await rm(POSTER_TEMP, { recursive: true, force: true });
  await mkdir(POSTER_TEMP, { recursive: true });
  const server = await serveWorkspace();
  const address = server.address();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    if (!String(error).includes('Executable doesn\'t exist')) throw error;
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
  }
  try {
    const page = await browser.newPage({
      viewport: { width: 1024, height: 1024 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce'
    });
    // Headless Chromium can lose the first high-performance WebGL2 context it
    // creates while the GPU process finishes its cold start. Consume that
    // one-time initialization on about:blank; capture validation and retries
    // below remain authoritative if a later context is lost for any reason.
    const warmup = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'high-performance' });
      if (!gl) return { available: false, lost: true };
      gl.clearColor(1, 0, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { available: true, lost: gl.isContextLost() };
    });
    assert.deepEqual(warmup, { available: true, lost: false }, 'Poster capture requires a live WebGL2 context.');
    page.on('pageerror', (error) => console.error(`[planet-hub poster] ${error?.stack || error}`));
    page.on('requestfailed', (request) => console.error(`[planet-hub poster] ${request.url()} — ${request.failure()?.errorText || 'request failed'}`));
    for (const worldId of ['earth', 'moon']) {
      for (const destination of DESTINATIONS) {
        const label = `${worldId}-${destination}`;
        const pngPath = path.join(POSTER_TEMP, `${label}.png`);
        const outputPath = path.join(POSTER_TEMP, `${worldId}-${destination}.webp`);
        let captureError;
        let captured = false;
        for (let attempt = 1; attempt <= 3 && !captured; attempt += 1) {
          try {
            await page.goto(`http://127.0.0.1:${address.port}/scripts/${path.basename(POSTER_PAGE)}?world=${worldId}&destination=${destination}&attempt=${attempt}`, { waitUntil: 'load' });
            await page.waitForFunction(() => (
              document.documentElement.dataset.ready === 'true'
              || Boolean(document.documentElement.dataset.captureFailure)
            ));
            const captureFailure = await page.evaluate(() => document.documentElement.dataset.captureFailure || '');
            assert.equal(captureFailure, '', `${label} capture failed before readback: ${captureFailure}`);
            await page.locator('canvas').screenshot({ path: pngPath, omitBackground: true });
            assertUsablePosterImage(inspectImage(pngPath), `${label} capture`, 'PNG');
            captured = true;
          } catch (error) {
            captureError = error;
            if (attempt < 3) console.warn(`[planet-hub poster] Retrying ${label} after unusable capture ${attempt}: ${error.message}`);
          }
        }
        if (!captured) throw new Error(`Unable to capture a usable poster for ${label}.`, { cause: captureError });
        run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', pngPath, '-c:v', 'libwebp', '-lossless', '0', '-quality', '86', outputPath]);
        assertUsablePosterImage(inspectImage(outputPath), `${label} poster`);
      }
    }
    await mkdir(POSTER_OUTPUT, { recursive: true });
    await Promise.all(['earth', 'moon'].flatMap((worldId) => DESTINATIONS.map((destination) => {
      const name = `${worldId}-${destination}.webp`;
      return copyFile(path.join(POSTER_TEMP, name), path.join(POSTER_OUTPUT, name));
    })));
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

function roundedVector(vector) {
  return vector.map((value) => Number(value.toFixed(9)));
}

function worldSites(worldId) {
  const anchors = createDestinationAnchors({ worldId });
  assertDestinationAnchorSpacing(anchors);
  return Object.fromEntries(DESTINATIONS.map((destination) => {
    const site = anchors[destination];
    const layoutMetadata = site.layout === 'geographic'
      ? {
          region: site.region,
          latitudeDegrees: site.latitudeDegrees,
          longitudeDegrees: site.longitudeDegrees,
        }
      : { phaseDegrees: site.phaseDegrees };
    return [destination, {
      layout: site.layout,
      ...layoutMetadata,
      anchor: roundedVector(site.normal),
      tangent: roundedVector(site.tangent),
    }];
  }));
}

function landmarkRecord(model, transform, sockets = {}) {
  return { ...model, transform, sockets };
}

async function buildPosterFileRecords() {
  const posterFiles = {};
  for (const worldId of ['earth', 'moon']) {
    for (const destination of DESTINATIONS) {
      const name = `${worldId}-${destination}`;
      const filePath = path.join(POSTER_OUTPUT, `${name}.webp`);
      const inspection = inspectImage(filePath);
      assertUsablePosterImage(inspection, `${name} poster`);
      posterFiles[name] = {
        url: publicUrl(filePath),
        bytes: (await stat(filePath)).size,
        sha256: await sha256(filePath),
        ...inspection
      };
    }
  }
  return posterFiles;
}

async function buildManifest(models, portal, optionalDetails, spaceLayers, galaxyTexture, placeThumbnails, config, { includePosterMetadata = true } = {}) {
  const sourceFiles = [...new Set([
    ...Object.values(SOURCES).flatMap((entry) => [entry.source, ...Object.values(entry.tierSources || {})]),
    ...SPACE_LAYER_SPECS.map((entry) => entry.source),
    GALAXY_TEXTURE_SOURCE,
    PLACE_THUMBNAIL_SOURCE,
    EARTH_ALBEDO_SOURCE,
    posix(path.relative(WORKSPACE, PORTAL_COLOR)),
    posix(path.relative(WORKSPACE, PORTAL_MATTE)),
  ])].sort();
  const sources = {};
  for (const source of sourceFiles) {
    const filePath = path.join(WORKSPACE, source);
    sources[source] = { bytes: (await stat(filePath)).size, sha256: await sha256(filePath) };
  }
  const worlds = {};
  for (const worldId of ['earth', 'moon']) {
    const sites = worldSites(worldId);
    worlds[worldId] = {
      posters: Object.fromEntries(DESTINATIONS.map((destination) => [destination, `./art/planet-hub/posters/${worldId}-${destination}.webp`])),
      tiers: {},
    };
    for (const tier of TIERS) {
      worlds[worldId].tiers[tier] = {
        planet: models[worldId][tier],
        landmarks: {
          forge: landmarkRecord(models.forge[tier], { ...sites.forge, scale: 0.4 }),
          journey: landmarkRecord(models[`${worldId}-landing`][tier], { ...sites.journey, scale: 0.34 }, { rocketDock: [0, 0.16, 0] }),
          arena: landmarkRecord(models.portal[tier], { ...sites.arena, scale: 0.38 }, { vfx: [0, 0.37, 0] }),
        },
      };
    }
  }
  const posterFiles = includePosterMetadata ? await buildPosterFileRecords() : {};
  const manifest = {
    schemaVersion: 1,
    productionVersion: 1,
    tools: config.tools,
    coordinateSystem: {
      up: 'Y',
      planetRadius: 1,
      roadRadius: PLANET_HUB_ROAD_RADIUS,
      destinationLayouts: {
        earth: {
          type: 'geographic',
          latitude: 'north-positive',
          longitude: 'east-positive',
          primeMeridianAxis: '+X',
          east90Axis: '-Z',
        },
        moon: { type: 'authored-ring', tiltDegrees: PLANET_HUB_RING_TILT_DEGREES },
      },
    },
    posterCamera: { width: 1024, height: 1024, perspectiveDegrees: 28, position: [0, 0.08, 4.5], target: [0, 0, 0], selectedAnchor: [0, 0.42, 0.907524] },
    worlds,
    shared: {
      tiers: Object.fromEntries(TIERS.map((tier) => [tier, {
        rocket: landmarkRecord(models.rocket[tier], { scale: 0.32 }, { engine: [0, 0.015, 0] }),
        sun: models.sun[tier],
      }])),
    },
    portal,
    optionalDetails,
    spaceLayers,
    galaxyTexture,
    placeThumbnails,
    posters: posterFiles,
    sources,
    attribution: {
      earth: { title: 'Earth', creator: 'AirStudios', creatorUrl: 'https://sketchfab.com/sebbe613', sourceUrl: 'https://sketchfab.com/3d-models/earth-5f9c35be31a047928eace8b415a8ee3a', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
      moon: { title: 'Moon', creator: 'matousekfoto', creatorUrl: 'https://sketchfab.com/matousekfoto', sourceUrl: 'https://sketchfab.com/3d-models/moon-5a917c638c1344d7af7e34e5d4122f72', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
      sun: { title: 'Sun', creator: 'SebastianSosnowski', creatorUrl: 'https://sketchfab.com/SebastianSosnowski', sourceUrl: 'https://sketchfab.com/3d-models/sun-9ef1c68fbb944147bcfcc891d3912645', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
      commercialProvenanceRequired: ['Tripo landmark models', 'Front Portal VFX color and matte'],
    },
    budgets: config.budgets,
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function refreshPosterManifest() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  for (const worldId of ['earth', 'moon']) {
    for (const destination of DESTINATIONS) {
      manifest.worlds[worldId].posters[destination] = `./art/planet-hub/posters/${worldId}-${destination}.webp`;
    }
  }
  manifest.posters = await buildPosterFileRecords();
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function refreshOptionalDetailManifest(optionalDetails) {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  manifest.optionalDetails = optionalDetails;
  manifest.budgets = await loadConfig().then((config) => config.budgets);
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function refreshPlaceThumbnailManifest(placeThumbnails) {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  manifest.placeThumbnails = placeThumbnails;
  const sourcePath = path.join(WORKSPACE, PLACE_THUMBNAIL_SOURCE);
  manifest.sources[PLACE_THUMBNAIL_SOURCE] = {
    bytes: (await stat(sourcePath)).size,
    sha256: await sha256(sourcePath),
  };
  manifest.budgets = await loadConfig().then((config) => config.budgets);
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function listFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(filePath));
    else result.push(filePath);
  }
  return result;
}

function verifyPortalFile(filePath, expectedCodec) {
  const report = ffprobe(filePath);
  const video = report.streams.find((stream) => stream.codec_type === 'video');
  assert(video, `Missing video stream: ${filePath}`);
  assert(!report.streams.some((stream) => stream.codec_type === 'audio'), `Portal derivative is not muted: ${filePath}`);
  assert.equal(video.codec_name, expectedCodec);
  assert.equal(Number(video.width), 1024);
  assert.equal(Number(video.height), 512);
  assert.equal(Number(video.nb_frames ?? video.nb_read_frames), 200);
  assert(Math.abs(Number(report.format.duration) - 6.666667) < 0.002);
}

export async function verifyPlanetHubAssets() {
  const config = await loadConfig();
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  for (const worldId of ['earth', 'moon']) {
    for (const destination of DESTINATIONS) assert.equal(manifest.worlds[worldId].posters[destination], `./art/planet-hub/posters/${worldId}-${destination}.webp`);
    for (const tier of TIERS) {
      const records = [manifest.worlds[worldId].tiers[tier].planet, ...Object.values(manifest.worlds[worldId].tiers[tier].landmarks)];
      for (const record of records) {
        const filePath = path.join(WORKSPACE, 'public', record.url.replace(/^\.\//, ''));
        assert.equal((await stat(filePath)).size, record.bytes);
        assert.equal(await sha256(filePath), record.sha256);
        const document = await io.read(filePath);
        assert.equal(triangleCount(document), record.triangles);
        assert.equal(document.getRoot().listExtensionsUsed().length, 0, `Runtime extension found in ${record.url}`);
        const textureLimit = record === manifest.worlds[worldId].tiers[tier].planet ? config.budgets.tiers[tier].planetTextureSize : config.budgets.tiers[tier].landmarkTextureSize;
        for (const texture of textureDimensions(document)) assert(Math.max(texture.width, texture.height) <= textureLimit);
      }
      const planet = manifest.worlds[worldId].tiers[tier].planet;
      assert(planet.triangles <= config.budgets.tiers[tier][`${worldId}Triangles`]);
      for (const landmark of Object.values(manifest.worlds[worldId].tiers[tier].landmarks)) assert(landmark.triangles < config.budgets.tiers[tier].landmarkTriangles);
      const orbitingSceneryBytes = manifest.shared.tiers[tier].sun.bytes
        + (worldId === 'earth' ? manifest.worlds.moon.tiers[tier].planet.bytes : 0);
      const sceneBytes = records.reduce((sum, record) => sum + record.bytes, 0)
        + manifest.shared.tiers[tier].rocket.bytes
        + orbitingSceneryBytes;
      assert(sceneBytes <= config.budgets.tiers[tier].sceneBytes, `${worldId}-${tier} initial scene is ${sceneBytes} bytes.`);
    }
  }
  for (const tier of TIERS) {
    const record = manifest.shared.tiers[tier].rocket;
    const filePath = path.join(WORKSPACE, 'public', record.url.replace(/^\.\//, ''));
    assert.equal((await stat(filePath)).size, record.bytes);
    assert.equal(await sha256(filePath), record.sha256);
    const document = await io.read(filePath);
    assert.equal(triangleCount(document), record.triangles);
    assert(record.triangles < config.budgets.tiers[tier].landmarkTriangles);
    assert.equal(document.getRoot().listExtensionsUsed().length, 0);

    const sun = manifest.shared.tiers[tier].sun;
    const sunPath = path.join(WORKSPACE, 'public', sun.url.replace(/^\.\//, ''));
    assert.equal((await stat(sunPath)).size, sun.bytes);
    assert.equal(await sha256(sunPath), sun.sha256);
    const sunDocument = await io.read(sunPath);
    assert.equal(triangleCount(sunDocument), sun.triangles);
    assert(sun.triangles <= config.budgets.tiers[tier].sunTriangles);
    assert(sun.bytes <= config.budgets.tiers[tier].sunBytes);
    assert.equal(sunDocument.getRoot().listExtensionsUsed().length, 0);
    for (const texture of textureDimensions(sunDocument)) {
      assert(Math.max(texture.width, texture.height) <= config.budgets.tiers[tier].sunTextureSize);
    }
  }
  for (const worldId of ['earth', 'moon']) {
    const expectedAnchors = createDestinationAnchors({ worldId });
    const manifestAnchors = Object.fromEntries(DESTINATIONS.map((destination) => {
      const transform = manifest.worlds[worldId].tiers.low.landmarks[destination].transform;
      return [destination, { normal: transform.anchor }];
    }));
    assertDestinationAnchorSpacing(manifestAnchors);
    for (const tier of TIERS) {
      for (const destination of DESTINATIONS) {
        const expected = expectedAnchors[destination];
        const transform = manifest.worlds[worldId].tiers[tier].landmarks[destination].transform;
        assert.equal(transform.layout, expected.layout, `${worldId}-${tier}-${destination} has stale layout metadata.`);
        assert.deepEqual(transform.anchor, roundedVector(expected.normal), `${worldId}-${tier}-${destination} has stale anchor metadata.`);
        assert.deepEqual(transform.tangent, roundedVector(expected.tangent), `${worldId}-${tier}-${destination} has stale tangent metadata.`);
        if (worldId === 'earth') {
          assert.equal(transform.region, expected.region);
          assert.equal(transform.latitudeDegrees, expected.latitudeDegrees);
          assert.equal(transform.longitudeDegrees, expected.longitudeDegrees);
        } else {
          assert.equal(transform.phaseDegrees, expected.phaseDegrees);
        }
      }
    }
  }
  const optionalDetails = manifest.optionalDetails;
  assert.equal(optionalDetails?.schemaVersion, 1);
  assert.equal(optionalDetails?.derivationVersion, DETAIL_DERIVATION_VERSION);
  assert.equal(optionalDetails?.initialScene, false, 'Optional detail textures must not enter the initial scene budget.');
  assert.equal(optionalDetails?.loadPolicy, 'focus');
  assert.deepEqual(optionalDetails?.textureContract, {
    flipY: false,
    uvChannel: 0,
    authoredColorSpace: 'srgb',
    supportColorSpace: 'none',
  });
  let optionalDetailBytes = 0;
  for (const tier of TIERS) {
    const details = optionalDetails.tiers[tier];
    const limits = config.budgets.detailTiers[tier];
    assert(details, `Missing ${tier} optional detail records.`);
    const authored = [details.earth.albedo, details.earth.clouds, details.earth.night, details.sun.emissive];
    for (const record of authored) {
      assert.equal(record.authored, true);
      assert.equal(record.derived, false);
    }
    assert.equal(details.earth.clouds.hasAlpha, false);
    assert.equal(details.earth.clouds.colorSpace, 'linear');
    assert.equal(details.earth.clouds.usage, 'earth-cloud-coverage');
    assert.equal(details.earth.albedo.width, tier === 'standard' ? 4096 : 2048);
    assert.equal(details.earth.albedo.loadPolicy, 'progressive-after-ready');
    const materialEntries = Object.entries(details.materials);
    assert.deepEqual(materialEntries.map(([name]) => name).sort(), Object.keys(MATERIAL_SUPPORT_SPECS).sort());
    for (const [role, maps] of materialEntries) {
      assert.equal(maps.normal.derived, true, `${tier} ${role} normal must remain explicitly derived.`);
      assert.equal(maps.orm.derived, true, `${tier} ${role} ORM must remain explicitly derived.`);
      assert.equal(maps.normal.algorithm, `albedo-support-v${DETAIL_DERIVATION_VERSION}`);
      assert.equal(maps.orm.algorithm, `albedo-support-v${DETAIL_DERIVATION_VERSION}`);
      if (role === 'portal') {
        assert.equal(maps.emissive.derived, true);
        assert.equal(maps.emissive.algorithm, `conservative-portal-emissive-v${DETAIL_DERIVATION_VERSION}`);
      } else {
        assert.equal(maps.emissive, undefined, `${role} has no defensible automatic emissive mask.`);
      }
    }
    const records = [
      ...authored,
      ...materialEntries.flatMap(([, maps]) => Object.values(maps)),
    ];
    const tierBytes = records.reduce((sum, record) => sum + record.bytes, 0);
    assert.equal(tierBytes, details.bytes, `${tier} optional detail byte total is stale.`);
    assert(tierBytes <= limits.bytes, `${tier} optional details exceed ${limits.bytes} bytes.`);
    optionalDetailBytes += tierBytes;
    for (const record of records) {
      const filePath = path.join(WORKSPACE, 'public', record.url.replace(/^\.\//, ''));
      assert.equal((await stat(filePath)).size, record.bytes);
      assert.equal(await sha256(filePath), record.sha256);
      const image = inspectImage(filePath);
      assert.equal(image.format, 'WEBP');
      assert.equal(image.width, record.width);
      assert.equal(image.height, record.height);
      assert.equal(image.hasAlpha, record.hasAlpha);
      assert(image.lumaStdDev > 0.05, `${record.url} is visually degenerate.`);
    }
  }
  assert.equal(optionalDetailBytes, optionalDetails.bytes, 'Optional detail byte total is stale.');
  assert(optionalDetailBytes <= config.budgets.optionalDetailBytes,
    `Optional details exceed ${config.budgets.optionalDetailBytes} bytes.`);
  const spaceLayers = manifest.spaceLayers;
  assert.equal(spaceLayers?.schemaVersion, 1);
  assert.equal(spaceLayers?.derivationVersion, SPACE_LAYER_DERIVATION_VERSION);
  assert.equal(spaceLayers?.initialScene, false, 'Space layers must not enter the initial scene budget.');
  assert.equal(spaceLayers?.loadPolicy, 'progressive-after-ready');
  assert.deepEqual(spaceLayers?.textureContract, {
    projection: 'equirectangular',
    colorSpace: 'srgb',
    horizontalWrap: 'repeat',
    verticalWrap: 'clamp',
    mipmaps: false,
  });
  let spaceLayerBytes = 0;
  for (const tier of TIERS) {
    const details = spaceLayers.tiers[tier];
    const limits = config.budgets.spaceLayers.tiers[tier];
    assert(details, `Missing ${tier} space-layer records.`);
    assert.equal(details.width, limits.width);
    assert.equal(details.height, limits.height);
    assert.equal(details.quality, limits.quality);
    assert.deepEqual(details.layers.map(({ id, order }) => ({ id, order })),
      SPACE_LAYER_SPECS.map(({ id, order }) => ({ id, order })),
      `${tier} space-layer order is stale.`);
    let tierBytes = 0;
    for (const [index, record] of details.layers.entries()) {
      const spec = SPACE_LAYER_SPECS[index];
      const expectedName = `${String(spec.order).padStart(2, '0')}-${spec.id}-${tier}.webp`;
      assert.equal(record.url, `./art/planet-hub/space-layers/${expectedName}`);
      assert.equal(record.width, limits.width);
      assert.equal(record.height, limits.height);
      assert.equal(record.mimeType, 'image/webp');
      const filePath = path.join(WORKSPACE, 'public', record.url.replace(/^\.\//, ''));
      assert.equal((await stat(filePath)).size, record.bytes);
      assert.equal(await sha256(filePath), record.sha256);
      const image = inspectImage(filePath);
      assert.equal(image.format, 'WEBP');
      assert.equal(image.width, limits.width);
      assert.equal(image.height, limits.height);
      assert.equal(image.hasAlpha, false);
      assert(image.lumaStdDev > 0.05, `${record.url} is visually degenerate.`);
      tierBytes += record.bytes;
    }
    assert.equal(tierBytes, details.bytes, `${tier} space-layer byte total is stale.`);
    assert(tierBytes <= limits.bytes, `${tier} space layers exceed ${limits.bytes} bytes.`);
    spaceLayerBytes += tierBytes;
  }
  assert.equal(spaceLayerBytes, spaceLayers.bytes, 'Space-layer byte total is stale.');
  assert(spaceLayerBytes <= config.budgets.spaceLayers.bytes,
    `Space layers exceed ${config.budgets.spaceLayers.bytes} bytes.`);
  const galaxyTexture = manifest.galaxyTexture;
  assert.equal(galaxyTexture?.schemaVersion, 1);
  assert.equal(galaxyTexture?.derivationVersion, GALAXY_TEXTURE_DERIVATION_VERSION);
  assert.equal(galaxyTexture?.initialScene, false, 'Galaxy textures must stay lazy.');
  assert.equal(galaxyTexture?.loadPolicy, 'milky-way-tier');
  assert.deepEqual(galaxyTexture?.textureContract, {
    projection: 'face-on-disc',
    colorSpace: 'srgb',
    background: 'black-luminance-alpha',
    mipmaps: true,
  });
  let galaxyTextureBytes = 0;
  for (const tier of TIERS) {
    const record = galaxyTexture?.tiers?.[tier];
    const limits = config.budgets.galaxyTexture.tiers[tier];
    assert(record, `Missing ${tier} galaxy texture record.`);
    assert.equal(record.url, `./art/planet-hub/galaxy/milky-way-${tier}.webp`);
    assert.equal(record.width, limits.width);
    assert.equal(record.height, limits.width);
    assert.equal(record.mimeType, 'image/webp');
    const filePath = path.join(WORKSPACE, 'public', record.url.replace(/^\.\//, ''));
    assert.equal((await stat(filePath)).size, record.bytes);
    assert.equal(await sha256(filePath), record.sha256);
    const image = inspectImage(filePath);
    assert.equal(image.format, 'WEBP');
    assert.equal(image.width, limits.width);
    assert.equal(image.height, limits.width);
    assert.equal(image.hasAlpha, false);
    assert(image.lumaStdDev > 8, `${record.url} is visually degenerate.`);
    assert(record.bytes <= limits.bytes, `${record.url} exceeds its tier budget.`);
    galaxyTextureBytes += record.bytes;
  }
  assert.equal(galaxyTextureBytes, galaxyTexture.bytes, 'Galaxy texture byte total is stale.');
  assert(galaxyTextureBytes <= config.budgets.galaxyTexture.bytes,
    `Galaxy textures exceed ${config.budgets.galaxyTexture.bytes} bytes.`);
  const placeThumbnails = manifest.placeThumbnails;
  const placeLimits = config.budgets.placeThumbnails;
  assert.equal(placeThumbnails?.schemaVersion, 1);
  assert.equal(placeThumbnails?.derivationVersion, PLACE_THUMBNAIL_DERIVATION_VERSION);
  assert.equal(placeThumbnails?.initialScene, false, 'Places thumbnails must stay outside the initial scene budget.');
  assert.equal(placeThumbnails?.loadPolicy, 'places-panel');
  const placeSprite = placeThumbnails?.sprite;
  assert(placeSprite, 'Missing Places thumbnail sprite record.');
  assert.equal(placeSprite.url, './art/planet-hub/place-thumbnails/solar-bodies.webp');
  assert.equal(placeSprite.width, placeLimits.width);
  assert.equal(placeSprite.height, placeLimits.height);
  assert.equal(placeSprite.tileSize, placeLimits.tileSize);
  assert.equal(placeSprite.count, PLACE_THUMBNAIL_ORDER.length);
  assert.deepEqual(placeSprite.order, PLACE_THUMBNAIL_ORDER);
  assert.equal(placeSprite.quality, placeLimits.quality);
  assert.equal(placeSprite.mimeType, 'image/webp');
  const placeSpritePath = path.join(WORKSPACE, 'public', placeSprite.url.replace(/^\.\//, ''));
  assert.equal((await stat(placeSpritePath)).size, placeSprite.bytes);
  assert.equal(await sha256(placeSpritePath), placeSprite.sha256);
  assert(placeSprite.bytes <= placeLimits.bytes,
    `Places thumbnail sprite exceeds ${placeLimits.bytes} bytes.`);
  const placeSpriteImage = inspectImage(placeSpritePath);
  assert.equal(placeSpriteImage.format, 'WEBP');
  assert.equal(placeSpriteImage.width, placeLimits.width);
  assert.equal(placeSpriteImage.height, placeLimits.height);
  assert.equal(placeSpriteImage.hasAlpha, false);
  assert(placeSpriteImage.lumaStdDev > 20, `${placeSprite.url} is visually degenerate.`);
  for (const [name, details] of Object.entries(manifest.sources)) {
    const filePath = path.join(WORKSPACE, name);
    assert.equal((await stat(filePath)).size, details.bytes);
    assert.equal(await sha256(filePath), details.sha256);
  }
  for (const details of Object.values(manifest.posters)) {
    const filePath = path.join(WORKSPACE, 'public', details.url.replace(/^\.\//, ''));
    assert.equal((await stat(filePath)).size, details.bytes);
    assert.equal(await sha256(filePath), details.sha256);
    const image = inspectImage(filePath);
    assertUsablePosterImage(image, details.url);
    for (const key of ['width', 'height', 'format', 'hasAlpha', 'lumaMean', 'lumaStdDev', 'visiblePixelRatio', 'opaquePixelRatio']) {
      assert.equal(details[key], image[key], `${details.url} has stale ${key} metadata.`);
    }
  }
  const mp4 = path.join(MEDIA_OUTPUT, 'portal-alpha.mp4');
  const webm = path.join(MEDIA_OUTPUT, 'portal-alpha.webm');
  verifyPortalFile(mp4, 'h264');
  verifyPortalFile(webm, 'vp9');
  assert((await stat(mp4)).size <= config.budgets.portalMp4Bytes);
  const files = await listFiles(OUTPUT);
  assert(!files.some((filePath) => /\.(blend1?|fbx|mov)$/i.test(filePath)), 'Raw source art entered the generated pack.');
  const packBytes = (await Promise.all(files.filter((filePath) => filePath !== MANIFEST_PATH).map(async (filePath) => (await stat(filePath)).size))).reduce((sum, bytes) => sum + bytes, 0);
  assert(packBytes <= config.budgets.packBytes, `Planet hub pack is ${(packBytes / 1048576).toFixed(2)} MiB.`);
  return { packBytes, files: files.length, manifest: MANIFEST_PATH };
}

async function verifyTools(config) {
  assert.equal(packageVersion('three'), config.tools.three);
  assert.equal(packageVersion('@gltf-transform/cli'), config.tools.gltfTransform);
  assert.equal(packageVersion('meshoptimizer'), config.tools.meshoptimizer);
  assert.equal(run('python', [PYTHON_HELPER, 'version'], { capture: true }), config.tools.pillow);
  const ffmpegVersion = run('ffmpeg', ['-version'], { capture: true }).match(/^ffmpeg version\s+([^\s-]+)/)?.[1];
  assert.equal(ffmpegVersion, config.tools.ffmpeg);
}

async function prepare() {
  const config = await loadConfig();
  await verifyTools(config);
  const resolvedOutput = path.resolve(OUTPUT);
  assert.equal(resolvedOutput, path.join(WORKSPACE, 'public', 'art', 'planet-hub'));
  await rm(resolvedOutput, { recursive: true, force: true });
  await rm(TEMP, { recursive: true, force: true });
  await Promise.all([mkdir(MODEL_OUTPUT, { recursive: true }), mkdir(POSTER_OUTPUT, { recursive: true }), mkdir(MEDIA_OUTPUT, { recursive: true }), mkdir(DETAIL_OUTPUT, { recursive: true }), mkdir(SPACE_LAYER_OUTPUT, { recursive: true }), mkdir(GALAXY_OUTPUT, { recursive: true }), mkdir(PLACE_THUMBNAIL_OUTPUT, { recursive: true }), mkdir(TEMP, { recursive: true })]);
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const models = {};
  for (const name of Object.keys(SOURCES)) {
    models[name] = {};
    if (SOURCES[name].sharedAcrossTiers) {
      const shared = await buildModel(name, 'low', config);
      for (const tier of TIERS) models[name][tier] = shared;
    } else {
      for (const tier of TIERS) models[name][tier] = await buildModel(name, tier, config);
    }
  }
  const portal = await buildPortalMedia(config);
  let optionalDetails = await buildOptionalDetails(config);
  const spaceLayers = await buildSpaceLayers(config);
  const galaxyTexture = await buildGalaxyTexture(config);
  const placeThumbnails = await buildPlaceThumbnails(config);
  // Poster generation renders through the production renderer, which consumes
  // this same manifest. Publish a provisional manifest first, then replace it
  // with the fully hashed poster inventory once all six captures exist.
  await buildManifest(models, portal, optionalDetails, spaceLayers, galaxyTexture, placeThumbnails, config, { includePosterMetadata: false });
  optionalDetails = await refreshEarthSurfaceDetails();
  await buildPosters();
  await buildManifest(models, portal, optionalDetails, spaceLayers, galaxyTexture, placeThumbnails, config);
  const result = await verifyPlanetHubAssets();
  await rm(TEMP, { recursive: true, force: true });
  return result;
}

async function refreshEarthSurfaceDetails() {
  // Replace duplicated cloud channels and add the higher-resolution surface
  // after the base optional pack is written, before rendering or validation.
  run('python', [EARTH_SURFACE_HELPER]);
  return JSON.parse(await readFile(MANIFEST_PATH, 'utf8')).optionalDetails;
}

async function prepareDetails() {
  const config = await loadConfig();
  await verifyTools(config);
  await mkdir(TEMP, { recursive: true });
  const optionalDetails = await buildOptionalDetails(config);
  await refreshOptionalDetailManifest(optionalDetails);
  await refreshEarthSurfaceDetails();
  const result = await verifyPlanetHubAssets();
  await rm(path.join(TEMP, 'detail-sources'), { recursive: true, force: true });
  return result;
}

async function prepareGalaxyTexture() {
  const config = await loadConfig();
  await verifyTools(config);
  const galaxyTexture = await buildGalaxyTexture(config);
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  manifest.galaxyTexture = galaxyTexture;
  const sourcePath = path.join(WORKSPACE, GALAXY_TEXTURE_SOURCE);
  manifest.sources[GALAXY_TEXTURE_SOURCE] = {
    bytes: (await stat(sourcePath)).size,
    sha256: await sha256(sourcePath),
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  return verifyPlanetHubAssets();
}

async function preparePlaceThumbnails() {
  const config = await loadConfig();
  await verifyTools(config);
  const placeThumbnails = await buildPlaceThumbnails(config);
  await refreshPlaceThumbnailManifest(placeThumbnails);
  return verifyPlanetHubAssets();
}

async function preparePosters() {
  const config = await loadConfig();
  await verifyTools(config);
  await mkdir(POSTER_OUTPUT, { recursive: true });
  await buildPosters();
  await refreshPosterManifest();
  const result = await verifyPlanetHubAssets();
  await rm(POSTER_TEMP, { recursive: true, force: true });
  return result;
}

const command = process.argv[2];
if (command === 'prepare') {
  const result = await prepare();
  console.log(`Planet hub prepared: ${result.files} files, ${(result.packBytes / 1048576).toFixed(2)} MiB.`);
} else if (command === 'posters') {
  const result = await preparePosters();
  console.log(`Planet hub posters prepared: ${result.files} files, ${(result.packBytes / 1048576).toFixed(2)} MiB.`);
} else if (command === 'details') {
  const result = await prepareDetails();
  console.log(`Planet hub details prepared: ${result.files} files, ${(result.packBytes / 1048576).toFixed(2)} MiB.`);
} else if (command === 'galaxy') {
  const result = await prepareGalaxyTexture();
  console.log(`Planet hub galaxy textures prepared: ${result.files} files, ${(result.packBytes / 1048576).toFixed(2)} MiB.`);
} else if (command === 'places') {
  const result = await preparePlaceThumbnails();
  console.log(`Planet hub Places thumbnails prepared: ${result.files} files, ${(result.packBytes / 1048576).toFixed(2)} MiB.`);
} else if (command === 'verify') {
  const result = await verifyPlanetHubAssets();
  console.log(`Planet hub verified: ${result.files} files, ${(result.packBytes / 1048576).toFixed(2)} MiB.`);
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.error('Usage: node scripts/planet-hub-assets.mjs <prepare|posters|details|galaxy|places|verify>');
  process.exitCode = 1;
}
