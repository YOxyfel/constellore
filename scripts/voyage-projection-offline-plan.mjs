import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  VOYAGE_BODY_LAYOUT,
  VOYAGE_BODY_SHADER_PROFILES,
  VOYAGE_INTERSTELLAR_SYSTEMS,
  createVoyageSystemLayout,
  resolveVoyageProjectionFrame
} from "../public/voyage-projection-scene.mjs";
import {
  VOYAGE_DURATION_SECONDS,
  VOYAGE_VARIANTS,
  createVoyageTimeline,
  createVoyageWorldPresentation,
  normalizeVoyageVariant,
  shotAtTime
} from "../public/voyage-projection-domain.mjs";
import {
  loadVoyageProductionManifest,
  voyageProductionManifestDigest
} from "./voyage-projection-production.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FPS = 24;
const TOTAL_FRAMES = VOYAGE_DURATION_SECONDS * FPS;
const DEFAULT_OUTPUT_DIRECTORY = resolve(ROOT, ".codex-tmp", "voyage-projection-offline");

const AUTHORITATIVE_SOURCES = Object.freeze([
  "public/voyage-projection-domain.mjs",
  "public/voyage-projection-scene.mjs",
  "public/art/planet-hub/manifest.json",
  "scripts/voyage-projection-cinematic.v1.json"
]);

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function boundedProjectPath(root, value) {
  const rootPath = resolve(root);
  const candidate = resolve(rootPath, String(value || ""));
  const fromRoot = relative(rootPath, candidate);
  return !fromRoot || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot))
    ? candidate
    : null;
}

function normalizeFrame(value, fallback) {
  const frame = Number.parseInt(value, 10);
  return Number.isInteger(frame) ? Math.max(0, Math.min(TOTAL_FRAMES, frame)) : fallback;
}

function runtimeAssetPath(url) {
  const normalized = String(url || "").replace(/^\.\//, "");
  return normalized.startsWith("art/") ? `public/${normalized}` : normalized;
}

async function sourceHashes(root = ROOT) {
  const records = [];
  for (const path of AUTHORITATIVE_SOURCES) {
    const absolute = boundedProjectPath(root, path);
    const contents = await readFile(absolute);
    records.push({ path, bytes: contents.length, sha256: sha256(contents) });
  }
  return records;
}

async function loadPlanetAssets(root = ROOT) {
  const manifestPath = resolve(root, "public", "art", "planet-hub", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const standard = manifest.worlds?.earth?.tiers?.standard;
  const shared = manifest.shared?.tiers?.standard;
  const records = {
    earth: standard?.planet,
    moon: manifest.worlds?.moon?.tiers?.standard?.planet,
    sun: shared?.sun,
    rocket: shared?.rocket
  };
  const assets = {};
  for (const [id, record] of Object.entries(records)) {
    const path = runtimeAssetPath(record?.url);
    const absolute = boundedProjectPath(root, path);
    const contents = absolute ? await readFile(absolute) : null;
    if (!contents || contents.length !== record?.bytes || sha256(contents) !== record?.sha256) {
      throw new Error(`Offline Voyage asset ${id} does not match the planet-hub manifest.`);
    }
    assets[id] = {
      path,
      bytes: record.bytes,
      sha256: record.sha256,
      bounds: record.bounds,
      transform: record.transform || null,
      sockets: record.sockets || {}
    };
  }
  return assets;
}

function renderFrameRecord({ variant, frame }) {
  const timelineSeconds = frame / FPS;
  const shot = shotAtTime(timelineSeconds, { variant });
  const projection = resolveVoyageProjectionFrame({
    variant,
    timelineSeconds,
    shot,
    reducedMotion: false
  });
  return {
    frame,
    timelineSeconds,
    shotId: projection.shotId,
    shotProgress: projection.shotProgress,
    camera: projection.camera,
    rocket: projection.rocket,
    visibility: projection.visibility,
    effects: projection.effects
  };
}

export async function buildVoyageOfflinePlan({
  root = ROOT,
  variant = "promise",
  startFrame = 0,
  endFrameExclusive = TOTAL_FRAMES
} = {}) {
  const normalizedVariant = normalizeVoyageVariant(variant, null);
  if (!normalizedVariant || !VOYAGE_VARIANTS.includes(normalizedVariant)) {
    throw new Error(`Unknown Voyage variant ${variant}.`);
  }
  const firstFrame = normalizeFrame(startFrame, 0);
  const lastExclusive = normalizeFrame(endFrameExclusive, TOTAL_FRAMES);
  if (lastExclusive <= firstFrame) throw new Error("Offline Voyage frame range must be non-empty.");

  const manifest = await loadVoyageProductionManifest();
  const worldPresentation = createVoyageWorldPresentation({
    activeWorldId: "earth",
    completedWorldIds: [],
    availableWorldIds: ["earth", "moon"]
  });
  const frames = [];
  for (let frame = firstFrame; frame < lastExclusive; frame += 1) {
    frames.push(renderFrameRecord({ variant: normalizedVariant, frame }));
  }

  return {
    schemaVersion: 1,
    purpose: "authoritative-offline-render-input",
    releaseEligible: false,
    releaseBoundary: "Rendering this plan does not create an approved master; ACES color, final audio, provenance, protected-pixel review, and human approval remain mandatory.",
    contractSha256: voyageProductionManifestDigest(manifest),
    sourceModule: "public/voyage-projection-scene.mjs",
    variant: normalizedVariant,
    fps: FPS,
    totalTimelineFrames: TOTAL_FRAMES,
    frameRange: {
      startFrame: firstFrame,
      endFrameExclusive: lastExclusive,
      lastFrame: lastExclusive - 1
    },
    timeline: createVoyageTimeline(normalizedVariant),
    sources: await sourceHashes(root),
    assets: await loadPlanetAssets(root),
    coordinateConversion: {
      source: "Three.js Y-up right-handed",
      destination: "Blender Z-up right-handed",
      vector: "[x,y,z] -> [x,-z,y]"
    },
    bodyLayout: createVoyageSystemLayout({ worldPresentation }).bodies,
    bodyShaderProfiles: VOYAGE_BODY_SHADER_PROFILES,
    interstellarSystems: VOYAGE_INTERSTELLAR_SYSTEMS,
    frames
  };
}

export async function writeVoyageOfflinePlan({ outputPath, ...options } = {}) {
  const plan = await buildVoyageOfflinePlan(options);
  const destination = outputPath
    ? boundedProjectPath(options.root || ROOT, outputPath)
    : resolve(DEFAULT_OUTPUT_DIRECTORY, `${plan.variant}-${plan.frameRange.startFrame}-${plan.frameRange.lastFrame}.json`);
  if (!destination) throw new Error("Offline Voyage output must remain inside the project root.");
  await mkdir(dirname(destination), { recursive: true });
  const contents = `${JSON.stringify(plan, null, 2)}\n`;
  await writeFile(destination, contents, "utf8");
  return Object.freeze({
    path: destination,
    bytes: Buffer.byteLength(contents),
    sha256: sha256(contents),
    plan
  });
}

function argumentValue(argv, name, fallback = null) {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

const isCli = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  try {
    const variant = argumentValue(process.argv.slice(2), "variant", "promise");
    const startFrame = normalizeFrame(argumentValue(process.argv.slice(2), "start-frame"), 0);
    const endFrameExclusive = normalizeFrame(
      argumentValue(process.argv.slice(2), "end-frame-exclusive"),
      TOTAL_FRAMES
    );
    const outputPath = argumentValue(process.argv.slice(2), "output");
    const result = await writeVoyageOfflinePlan({ variant, startFrame, endFrameExclusive, outputPath });
    console.log(`Wrote ${result.plan.frames.length} authoritative ${variant} frames to ${result.path}`);
    console.log(`SHA-256 ${result.sha256}`);
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}
