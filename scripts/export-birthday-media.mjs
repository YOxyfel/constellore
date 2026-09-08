import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const DROP_ROOT = path.join(PROJECT_ROOT, "birthday-media-inbox", "DROP_FILES_HERE");
const CATALOG_FILE = path.join(PROJECT_ROOT, "birthday-media-inbox", "_private-catalog", "catalog.json");
const PUBLIC_ROOT = path.join(PROJECT_ROOT, "public", "cinematic", "birthday-voyage", "v2");
const MANIFEST_FILE = path.join(PUBLIC_ROOT, "selected-media-manifest.json");
const RUNTIME_MEDIA_FILE = path.join(PROJECT_ROOT, "public", "birthday-voyage-personal-media.mjs");
const DESTINATIONS = new Set([
  "varna", "vienna", "brussels", "sofia", "tokyo", "shibuya",
  "earth", "moon", "mars", "kepler", "cosmos", "finale",
]);

const POSTER_FILTER = [
  "split=2[background][subject]",
  "[background]scale=1536:1024:force_original_aspect_ratio=increase,crop=1536:1024,gblur=sigma=30[blurred]",
  "[subject]scale=1536:1024:force_original_aspect_ratio=decrease[sharp]",
  "[blurred][sharp]overlay=(W-w)/2:(H-h)/2",
].join(";");
const THUMB_FILTER = [
  "split=2[background][subject]",
  "[background]scale=480:320:force_original_aspect_ratio=increase,crop=480:320,gblur=sigma=14[blurred]",
  "[subject]scale=480:320:force_original_aspect_ratio=decrease[sharp]",
  "[blurred][sharp]overlay=(W-w)/2:(H-h)/2",
].join(";");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const stderr = [];
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`));
    });
  });
}

function publicUrl(filePath) {
  return `/${path.relative(path.join(PROJECT_ROOT, "public"), filePath).split(path.sep).join("/")}`;
}

function clamp(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(minimum, Math.min(maximum, numeric)) : fallback;
}

async function readPreviousManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_FILE, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return { destinations: [] };
    throw error;
  }
}

function derivativePaths(entries = []) {
  return new Set(Array.from(entries || []).flatMap((entry) => [
    entry?.thumb,
    entry?.poster,
    entry?.audioSource,
    ...Array.from(entry?.videoSources || [], (source) => source?.src)
  ]).map((value) => String(value || "").trim()).filter((value) => (
    /^\/cinematic\/birthday-voyage\/v2\/[a-z0-9._-]+$/i.test(value)
  )));
}

async function pruneDeselectedDerivatives(previousEntries, currentEntries) {
  const previousPaths = derivativePaths(previousEntries);
  const currentPaths = derivativePaths(currentEntries);
  const safeRoot = `${path.resolve(PUBLIC_ROOT)}${path.sep}`.toLowerCase();
  for (const publicPath of previousPaths) {
    if (currentPaths.has(publicPath)) continue;
    const target = path.resolve(PROJECT_ROOT, "public", publicPath.slice(1));
    if (!target.toLowerCase().startsWith(safeRoot)) {
      throw new Error(`Refusing to prune outside the birthday derivative folder: ${publicPath}`);
    }
    try {
      await unlink(target);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

async function safeOriginal(relativePath) {
  const candidate = path.resolve(DROP_ROOT, relativePath);
  const [sourceRoot, sourceFile] = await Promise.all([realpath(DROP_ROOT), realpath(candidate)]);
  const prefix = `${sourceRoot}${path.sep}`.toLowerCase();
  if (!sourceFile.toLowerCase().startsWith(prefix)) {
    throw new Error(`Refusing to export a file outside the private drop folder: ${relativePath}`);
  }
  return sourceFile;
}

async function exportImage(entry, source, stem) {
  const poster = path.join(PUBLIC_ROOT, `${stem}-poster.webp`);
  const thumb = path.join(PUBLIC_ROOT, `${stem}-thumb.webp`);
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", source,
    "-map_metadata", "-1", "-frames:v", "1", "-filter_complex", POSTER_FILTER,
    "-c:v", "libwebp", "-quality", "90", "-compression_level", "6", poster,
  ]);
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", source,
    "-map_metadata", "-1", "-frames:v", "1", "-filter_complex", THUMB_FILTER,
    "-c:v", "libwebp", "-quality", "78", "-compression_level", "6", thumb,
  ]);
  return {
    mediaKind: "image",
    thumb: publicUrl(thumb),
    poster: publicUrl(poster),
    videoSources: [],
  };
}

async function exportVideo(entry, source, stem) {
  const clip = path.join(PUBLIC_ROOT, `${stem}-clip.mp4`);
  const poster = path.join(PUBLIC_ROOT, `${stem}-poster.webp`);
  const thumb = path.join(PUBLIC_ROOT, `${stem}-thumb.webp`);
  const sourceDurationMs = Number(entry.durationMs || 0);
  const startMs = clamp(entry.review?.clipStartMs, 0, Math.max(0, sourceDurationMs - 1_000), 0);
  const requestedDuration = clamp(entry.review?.clipDurationMs, 4_000, 6_000, 5_000);
  const availableDuration = sourceDurationMs > 0 ? Math.max(1_000, sourceDurationMs - startMs) : requestedDuration;
  const durationMs = Math.min(requestedDuration, availableDuration);
  const startSeconds = (startMs / 1000).toFixed(3);
  const durationSeconds = (durationMs / 1000).toFixed(3);

  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-ss", startSeconds, "-i", source,
    "-t", durationSeconds, "-map_metadata", "-1",
    "-vf", "scale=1440:960:force_original_aspect_ratio=decrease,pad=1440:960:(ow-iw)/2:(oh-ih)/2:black,fps=24",
    "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", clip,
  ]);
  const posterAt = (startMs / 1000) + (durationMs / 2000);
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-ss", posterAt.toFixed(3), "-i", source,
    "-map_metadata", "-1", "-frames:v", "1", "-filter_complex", POSTER_FILTER,
    "-c:v", "libwebp", "-quality", "90", "-compression_level", "6", poster,
  ]);
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-ss", posterAt.toFixed(3), "-i", source,
    "-map_metadata", "-1", "-frames:v", "1", "-filter_complex", THUMB_FILTER,
    "-c:v", "libwebp", "-quality", "78", "-compression_level", "6", thumb,
  ]);
  return {
    mediaKind: "video",
    durationMs,
    thumb: publicUrl(thumb),
    poster: publicUrl(poster),
    videoSources: [{ src: publicUrl(clip), type: "video/mp4" }],
  };
}

async function exportAudio(entry, source, stem) {
  const voice = path.join(PUBLIC_ROOT, `${stem}-voice.m4a`);
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", source,
    "-map_metadata", "-1", "-vn", "-c:a", "aac", "-b:a", "128k", voice,
  ]);
  return { mediaKind: "audio", audioSource: publicUrl(voice) };
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_FILE, "utf8"));
  const previousManifest = await readPreviousManifest();
  const selected = (catalog.entries || []).filter((entry) => entry.review?.selectedForExperience === true);
  await mkdir(PUBLIC_ROOT, { recursive: true });
  const exported = [];

  for (const entry of selected) {
    const destination = String(entry.review?.destinationCandidates?.[0] || "").toLowerCase();
    if (!DESTINATIONS.has(destination)) {
      throw new Error(`${entry.relativePath} is selected but has no valid first destinationCandidate.`);
    }
    const source = await safeOriginal(entry.relativePath);
    const stem = `${destination}-memory-${randomUUID().replaceAll("-", "").slice(0, 10)}`;
    const media = entry.mediaKind === "image"
      ? await exportImage(entry, source, stem)
      : entry.mediaKind === "video"
        ? await exportVideo(entry, source, stem)
        : await exportAudio(entry, source, stem);
    exported.push({
      destination,
      alt: String(entry.review?.alt || `${destination} memory from Sophia and Yane's journey`),
      story: String(entry.review?.story || ""),
      ...media,
    });
    console.log(`Exported selected ${entry.mediaKind}: ${destination}`);
  }

  const manifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    sourceCatalogVersion: catalog.catalogVersion,
    privacy: {
      originalsPublished: false,
      metadataStripped: true,
      onlyExplicitSelectionsExported: true,
    },
    destinations: exported,
  };
  await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const runtimeModule = `// Generated by \`npm run birthday:export\` from explicitly selected private\n`
    + `// derivatives. Private originals and source filenames are never included.\n`
    + `const entries = ${JSON.stringify(exported, null, 2)};\n`
    + `export const BIRTHDAY_PERSONAL_MEDIA = Object.freeze(entries.map((entry) => Object.freeze({\n`
    + `  ...entry,\n`
    + `  videoSources: Object.freeze(Array.from(entry.videoSources || [], (source) => Object.freeze({ ...source })))\n`
    + `})));\n`;
  await writeFile(RUNTIME_MEDIA_FILE, runtimeModule, "utf8");
  await pruneDeselectedDerivatives(previousManifest.destinations, exported);
  console.log(selected.length
    ? `Selected derivative manifest written: ${MANIFEST_FILE}`
    : "No files are marked selectedForExperience. Nothing private was exported.");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
