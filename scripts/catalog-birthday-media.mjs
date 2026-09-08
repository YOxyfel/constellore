import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const INBOX_ROOT = path.join(PROJECT_ROOT, "birthday-media-inbox");
const DROP_ROOT = path.join(INBOX_ROOT, "DROP_FILES_HERE");
const CATALOG_ROOT = path.join(INBOX_ROOT, "_private-catalog");
const THUMB_ROOT = path.join(CATALOG_ROOT, "thumbnails");

const EXTENSIONS = new Map([
  [".jpg", "image"], [".jpeg", "image"], [".png", "image"],
  [".webp", "image"], [".gif", "image"], [".bmp", "image"],
  [".tif", "image"], [".tiff", "image"], [".heic", "image"],
  [".heif", "image"], [".avif", "image"],
  [".mp4", "video"], [".mov", "video"], [".m4v", "video"],
  [".webm", "video"], [".avi", "video"], [".mkv", "video"],
  [".mp3", "audio"], [".m4a", "audio"], [".aac", "audio"],
  [".wav", "audio"], [".flac", "audio"], [".ogg", "audio"],
  [".opus", "audio"],
]);

function run(command, args, { collectStdout = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    if (collectStdout) child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }
      reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`));
    });
  });
}

async function walk(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walk(absolute));
    else if (entry.isFile()) found.push(absolute);
  }
  return found;
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function probe(filePath) {
  const raw = await run("ffprobe", [
    "-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath,
  ]);
  return JSON.parse(raw.toString("utf8"));
}

function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? null;
}

function orientation(width, height) {
  if (!width || !height) return null;
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

function analyzePixels(buffer) {
  if (!buffer?.length) return null;
  let red = 0;
  let green = 0;
  let blue = 0;
  let light = 0;
  let lightSquared = 0;
  let colorDistance = 0;
  const pixels = Math.floor(buffer.length / 3);
  for (let index = 0; index < pixels * 3; index += 3) {
    const r = buffer[index];
    const g = buffer[index + 1];
    const b = buffer[index + 2];
    red += r;
    green += g;
    blue += b;
    const luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    light += luminance;
    lightSquared += luminance * luminance;
    colorDistance += Math.max(r, g, b) - Math.min(r, g, b);
  }
  const mean = light / pixels;
  const variance = Math.max(0, (lightSquared / pixels) - (mean * mean));
  const rgb = [red, green, blue].map((value) => Math.round(value / pixels));
  return {
    averageColor: `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`,
    brightness: Number((mean / 255).toFixed(3)),
    contrast: Number((Math.sqrt(variance) / 128).toFixed(3)),
    colorfulness: Number((colorDistance / pixels / 255).toFixed(3)),
  };
}

async function visualFingerprint(filePath, mediaKind, durationSeconds) {
  if (mediaKind === "audio") return null;
  const args = ["-v", "error"];
  if (mediaKind === "video" && durationSeconds > 0) {
    args.push("-ss", String(Math.max(0, durationSeconds * 0.5)));
  }
  args.push(
    "-i", filePath,
    "-frames:v", "1",
    "-vf", "scale=48:48:force_original_aspect_ratio=decrease,pad=48:48:(ow-iw)/2:(oh-ih)/2:black",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
  );
  try {
    return analyzePixels(await run("ffmpeg", args));
  } catch {
    return null;
  }
}

async function makeThumbnail(filePath, mediaKind, durationSeconds, outputPath) {
  if (mediaKind === "audio") return null;
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  if (mediaKind === "video" && durationSeconds > 0) {
    args.push("-ss", String(Math.max(0, durationSeconds * 0.5)));
  }
  args.push(
    "-i", filePath, "-frames:v", "1",
    "-vf", "scale='min(480,iw)':-2:flags=lanczos",
    "-q:v", "3", outputPath,
  );
  try {
    await run("ffmpeg", args);
    return path.relative(INBOX_ROOT, outputPath).split(path.sep).join("/");
  } catch {
    return null;
  }
}

function filenameHints(relativePath) {
  return path.basename(relativePath, path.extname(relativePath))
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((part) => part.length >= 2)
    .slice(0, 12);
}

async function catalogFile(filePath) {
  const relativePath = path.relative(DROP_ROOT, filePath).split(path.sep).join("/");
  const extension = path.extname(filePath).toLowerCase();
  const mediaKind = EXTENSIONS.get(extension);
  const fileStat = await stat(filePath);
  const digest = await sha256(filePath);
  let media = {};
  let probeError = null;
  try {
    media = await probe(filePath);
  } catch (error) {
    probeError = error.message;
  }

  const visualStream = media.streams?.find((stream) => stream.codec_type === "video") ?? null;
  const audioStream = media.streams?.find((stream) => stream.codec_type === "audio") ?? null;
  const durationSeconds = Number(firstDefined(media.format?.duration, visualStream?.duration, audioStream?.duration) ?? 0);
  const width = Number(visualStream?.width ?? 0) || null;
  const height = Number(visualStream?.height ?? 0) || null;
  const capturedAt = safeDate(firstDefined(
    media.format?.tags?.creation_time,
    visualStream?.tags?.creation_time,
    media.format?.tags?.date,
    visualStream?.tags?.date,
  ));
  const thumbName = `${digest.slice(0, 16)}.jpg`;
  const thumbnail = await makeThumbnail(filePath, mediaKind, durationSeconds, path.join(THUMB_ROOT, thumbName));
  const fingerprint = await visualFingerprint(filePath, mediaKind, durationSeconds);

  return {
    relativePath,
    originalName: path.basename(filePath),
    mediaKind,
    extension,
    sizeBytes: fileStat.size,
    createdAt: safeDate(fileStat.birthtime),
    modifiedAt: safeDate(fileStat.mtime),
    capturedAt,
    sha256: digest,
    dimensions: width && height ? { width, height } : null,
    durationMs: durationSeconds > 0 ? Math.round(durationSeconds * 1000) : null,
    codec: firstDefined(visualStream?.codec_name, audioStream?.codec_name),
    hasAudio: Boolean(audioStream),
    visualContent: mediaKind === "audio" ? null : {
      orientation: orientation(width, height),
      aspectRatio: width && height ? Number((width / height).toFixed(4)) : null,
      ...fingerprint,
      filenameHints: filenameHints(relativePath),
      reviewThumbnail: thumbnail,
      semanticReview: "pending-private-review",
    },
    review: {
      status: "unreviewed",
      destinationCandidates: [],
      recognizableCoupleMoment: null,
      emotionalMeaning: null,
      selectedForExperience: false,
      notes: "",
    },
    probeError,
  };
}

async function main() {
  await mkdir(DROP_ROOT, { recursive: true });
  await mkdir(THUMB_ROOT, { recursive: true });
  await access(DROP_ROOT);

  const candidates = (await walk(DROP_ROOT))
    .filter((filePath) => EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const entries = [];
  for (const [index, filePath] of candidates.entries()) {
    process.stdout.write(`\rCataloging ${index + 1}/${candidates.length}: ${path.basename(filePath).slice(0, 58).padEnd(58)}`);
    try {
      entries.push(await catalogFile(filePath));
    } catch (error) {
      const fileStat = await stat(filePath);
      entries.push({
        relativePath: path.relative(DROP_ROOT, filePath).split(path.sep).join("/"),
        originalName: path.basename(filePath),
        mediaKind: EXTENSIONS.get(path.extname(filePath).toLowerCase()),
        sizeBytes: fileStat.size,
        review: { status: "catalog-error", notes: error.message },
      });
    }
  }
  if (candidates.length) process.stdout.write("\n");

  const catalog = {
    catalogVersion: 1,
    generatedAt: new Date().toISOString(),
    privacy: {
      sourceRoot: "birthday-media-inbox/DROP_FILES_HERE",
      originalsModified: false,
      originalsPublished: false,
      catalogIsGitIgnored: true,
    },
    summary: {
      total: entries.length,
      images: entries.filter((entry) => entry.mediaKind === "image").length,
      videos: entries.filter((entry) => entry.mediaKind === "video").length,
      audio: entries.filter((entry) => entry.mediaKind === "audio").length,
      errors: entries.filter((entry) => entry.probeError || entry.review?.status === "catalog-error").length,
    },
    entries,
  };

  await writeFile(path.join(CATALOG_ROOT, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`Private catalog written: ${path.join(CATALOG_ROOT, "catalog.json")}`);
  console.log(entries.length ? `${entries.length} media file(s) cataloged without modifying originals.` : "Inbox is ready. No media files have been dropped yet.");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
