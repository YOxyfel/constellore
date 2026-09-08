import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { writeVoyageOfflinePlan } from "./voyage-projection-offline-plan.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BLENDER_VERSION = "5.1.2";
const DEFAULT_BLENDER_CANDIDATES = Object.freeze([
  process.env.CONSTELLORE_BLENDER,
  "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe",
  "blender"
].filter(Boolean));
const REVIEW_FRAMES = Object.freeze([0, 167, 168, 479, 480, 647, 648, 911, 912, 1151, 1152, 1271, 1272, 1367]);

function portable(path) {
  return String(path).replaceAll("\\", "/");
}

function projectRelative(path) {
  const value = relative(resolve(ROOT), resolve(path));
  if (!value || value.startsWith("..") || isAbsolute(value)) {
    throw new Error(`Offline render path is outside the project: ${path}`);
  }
  return portable(value);
}

function pngDimensions(buffer) {
  if (buffer.length < 24
    || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function argumentValue(argv, name, fallback = null) {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`);
}

function run(executable, args, { capture = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      cwd: ROOT,
      windowsHide: true,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
    }
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${executable} exited ${code}.${stderr ? `\n${stderr}` : ""}`));
    });
  });
}

export async function resolveBlenderExecutable(candidates = DEFAULT_BLENDER_CANDIDATES) {
  for (const candidate of candidates) {
    if (candidate.toLowerCase() === "blender") return candidate;
    try { await access(candidate); return candidate; } catch {}
  }
  throw new Error("Blender 5.1.2 was not found. Set CONSTELLORE_BLENDER to blender.exe.");
}

export async function verifyOfflineRenderTools({ blender = null } = {}) {
  const executable = blender || await resolveBlenderExecutable();
  const { stdout, stderr } = await run(executable, ["--version"], { capture: true });
  const version = `${stdout}\n${stderr}`.match(/Blender\s+(\d+[.]\d+[.]\d+)/)?.[1] || null;
  if (version !== BLENDER_VERSION) {
    throw new Error(`Voyage offline rendering requires Blender ${BLENDER_VERSION}; found ${version || "unknown"}.`);
  }
  return Object.freeze({ blender: executable, version });
}

export function buildBlenderArguments({
  planPath,
  outputDirectory,
  mode = "smoke",
  frames = [],
  width = 960,
  height = 540,
  samples = 16,
  resume = false,
  saveBlend = null,
  lookdevPlates = false
}) {
  const script = portable(resolve(ROOT, "scripts", "voyage-projection-blender.py"));
  const args = [
    "--background",
    "--factory-startup",
    "--disable-autoexec",
    "--python-exit-code", "1",
    "--python", script,
    "--",
    "--plan", projectRelative(planPath),
    "--output-dir", projectRelative(outputDirectory),
    "--mode", mode,
    "--width", String(width),
    "--height", String(height),
    "--samples", String(samples)
  ];
  if (frames.length) args.push("--frames", frames.join(","));
  if (resume) args.push("--resume");
  if (saveBlend) args.push("--save-blend", projectRelative(saveBlend));
  if (lookdevPlates) {
    if (mode === "production") throw new Error("Look-development plates are review-only.");
    args.push("--lookdev-plates");
  }
  return Object.freeze(args);
}

async function verifyReviewReport({ outputDirectory, variant, mode, width, height, expectedFrames }) {
  const reportPath = resolve(outputDirectory, `render-report-${variant}-${mode}.json`);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (report.releaseEligible !== false || report.variant !== variant || report.mode !== mode) {
    throw new Error("Offline render report lost its non-shipping identity.");
  }
  if (report.renderer?.version !== BLENDER_VERSION || report.frames.length !== expectedFrames.length) {
    throw new Error("Offline render report does not match the requested renderer/frame set.");
  }
  if (mode !== "production") {
    for (const record of report.frames) {
      const contents = await readFile(resolve(ROOT, record.path));
      const dimensions = pngDimensions(contents);
      if (dimensions?.width !== width || dimensions?.height !== height) {
        throw new Error(`Offline review frame ${record.frame} has invalid dimensions.`);
      }
    }
  }
  return Object.freeze({ reportPath, report });
}

export async function runVoyageOfflineRender({
  command = "smoke",
  variant = "promise",
  frame = 168,
  width,
  height,
  samples,
  outputDirectory,
  resume = false,
  lookdevPlates = false,
  confirmProduction = false,
  blender = null
} = {}) {
  const tools = await verifyOfflineRenderTools({ blender });
  if (command === "preflight") return Object.freeze({ ...tools, status: "ready" });
  const production = command === "production";
  if (production && !confirmProduction) {
    throw new Error("Production render requires --confirm-production because a full 4K sequence is storage-intensive.");
  }
  if (production && !process.env.OCIO) {
    throw new Error("Production render requires a pinned project-owned ACES OCIO configuration in OCIO.");
  }
  const review = command === "review";
  const mode = production ? "production" : review ? "review" : "smoke";
  const frames = production ? [] : review ? [...REVIEW_FRAMES] : [Number(frame)];
  const startFrame = frames.length ? Math.min(...frames) : 0;
  const endFrameExclusive = frames.length ? Math.max(...frames) + 1 : 1368;
  const planResult = await writeVoyageOfflinePlan({ variant, startFrame, endFrameExclusive });
  const destination = resolve(outputDirectory || (production
    ? "output/voyage-projection/renders"
    : ".codex-tmp/voyage-projection-offline/render"));
  const finalWidth = Number(width || (production ? 3840 : review ? 1920 : 960));
  const finalHeight = Number(height || (production ? 2160 : review ? 1080 : 540));
  const finalSamples = Number(samples || (production ? 128 : review ? 32 : 12));
  const blenderArgs = buildBlenderArguments({
    planPath: planResult.path,
    outputDirectory: destination,
    mode,
    frames,
    width: finalWidth,
    height: finalHeight,
    samples: finalSamples,
    resume,
    lookdevPlates
  });
  await run(tools.blender, blenderArgs);
  const verified = await verifyReviewReport({
    outputDirectory: destination,
    variant,
    mode,
    width: finalWidth,
    height: finalHeight,
    expectedFrames: production ? planResult.plan.frames.map((record) => record.frame) : frames
  });
  return Object.freeze({
    ...tools,
    mode,
    variant,
    planPath: planResult.path,
    planSha256: planResult.sha256,
    ...verified
  });
}

async function cli() {
  const argv = process.argv.slice(2);
  const command = argv.find((value) => !value.startsWith("--")) || "preflight";
  const result = await runVoyageOfflineRender({
    command,
    variant: argumentValue(argv, "variant", "promise"),
    frame: Number(argumentValue(argv, "frame", "168")),
    width: Number(argumentValue(argv, "width", "0")) || undefined,
    height: Number(argumentValue(argv, "height", "0")) || undefined,
    samples: Number(argumentValue(argv, "samples", "0")) || undefined,
    outputDirectory: argumentValue(argv, "output"),
    resume: hasFlag(argv, "resume"),
    lookdevPlates: hasFlag(argv, "lookdev-plates"),
    confirmProduction: hasFlag(argv, "confirm-production")
  });
  console.log(`Voyage offline ${command}: ${result.status || result.mode} with Blender ${result.version}`);
  if (result.reportPath) console.log(`Render report ${result.reportPath}`);
}

const isCli = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  cli().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
