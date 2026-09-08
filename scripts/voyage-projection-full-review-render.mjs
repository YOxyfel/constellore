import { createHash } from "node:crypto";
import { createReadStream, constants as fsConstants } from "node:fs";
import { execFile, spawn } from "node:child_process";
import {
  copyFile,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  normalize,
  relative,
  resolve,
  sep
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildVoyageOfflinePlan } from "./voyage-projection-offline-plan.mjs";
import {
  buildBlenderArguments,
  verifyOfflineRenderTools
} from "./voyage-projection-offline-render.mjs";
import {
  loadVoyageProductionManifest,
  voyageProductionManifestDigest
} from "./voyage-projection-production.mjs";
import { validateVoyageLookdev } from "./voyage-projection-lookdev.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FPS = 24;
const TOTAL_FRAMES = 1368;
const COMPLETION_START_FRAME = 1272;
const BLENDER_VERSION = "5.1.2";
const LOOKDEV_MANIFEST_PATH = "production/voyage-projection/lookdev/lookdev-manifest.json";
const FALLBACK_LINK_ERRORS = new Set(["EXDEV", "EPERM", "EACCES", "ENOTSUP", "EMLINK"]);

export const FULL_REVIEW_RENDER_CONFIRMATION = "CONFIRM_NONSHIPPING_FULL_VOYAGE_REVIEW";
export const DEFAULT_FULL_REVIEW_OUTPUT_ROOT = "output/voyage-projection/full-review";

function portable(value) {
  return String(value || "").replaceAll("\\", "/");
}

function object(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/u.test(String(value || ""));
}

function projectPath(root, value, label = "path") {
  const declared = String(value || "").trim();
  if (!declared || isAbsolute(declared)) throw new Error(`${label} must be a project-relative path.`);
  const rootPath = resolve(root);
  const candidate = resolve(rootPath, normalize(declared));
  const fromRoot = relative(rootPath, candidate);
  if (!fromRoot || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(`${label} escapes the project root: ${declared}.`);
  }
  return candidate;
}

function relativePath(root, absolute) {
  const fromRoot = relative(resolve(root), resolve(absolute));
  if (!fromRoot || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(`Path is outside the project root: ${absolute}.`);
  }
  return portable(fromRoot);
}

function validateOutputRoot(value) {
  const normalized = portable(value);
  if (isAbsolute(String(value || ""))
    || !normalized.startsWith("output/voyage-projection/")
    || normalized.split("/").includes("..")) {
    throw new Error("Full review output must remain under output/voyage-projection/.");
  }
  return normalized.replace(/\/$/u, "");
}

async function sha256File(absolute) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(absolute)) hash.update(chunk);
  return hash.digest("hex");
}

async function fileRecord(root, declaredPath) {
  const absolute = projectPath(root, declaredPath);
  try {
    const details = await lstat(absolute);
    if (details.isSymbolicLink()) return { path: portable(declaredPath), status: "symlink-rejected", bytes: null, sha256: null };
    if (!details.isFile() || details.size <= 0) {
      return { path: portable(declaredPath), status: "not-a-nonempty-file", bytes: details.size, sha256: null };
    }
    return {
      path: portable(declaredPath),
      status: "present",
      bytes: details.size,
      sha256: await sha256File(absolute)
    };
  } catch (error) {
    if (error?.code === "ENOENT") return { path: portable(declaredPath), status: "missing", bytes: null, sha256: null };
    throw error;
  }
}

async function pngDimensions(absolute) {
  const handle = await open(absolute, "r");
  try {
    const header = Buffer.alloc(24);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < 24
      || !header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } finally {
    await handle.close();
  }
}

function frameName(frame) {
  return `frame-${String(frame).padStart(4, "0")}.png`;
}

function planFramePath(outputRoot, variant, record) {
  return `${outputRoot}/renderer/${variant}/${record.shotId}/${frameName(record.frame)}`;
}

function timelineFramePath(outputRoot, variant, frame) {
  return `${outputRoot}/timelines/${variant}/${frameName(frame)}`;
}

function exactFrameRange(plan, variant, errors) {
  if (plan?.schemaVersion !== 1
    || plan?.purpose !== "authoritative-offline-render-input"
    || plan?.releaseEligible !== false
    || plan?.variant !== variant) {
    errors.push(`${variant} offline plan lost its authoritative non-shipping identity.`);
  }
  if (plan?.fps !== FPS
    || plan?.totalTimelineFrames !== TOTAL_FRAMES
    || plan?.frameRange?.startFrame !== 0
    || plan?.frameRange?.endFrameExclusive !== TOTAL_FRAMES
    || plan?.frameRange?.lastFrame !== TOTAL_FRAMES - 1
    || !Array.isArray(plan?.frames)
    || plan.frames.length !== TOTAL_FRAMES) {
    errors.push(`${variant} offline plan must contain exactly contiguous frames 0000-${TOTAL_FRAMES - 1}.`);
    return;
  }
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    if (plan.frames[frame]?.frame !== frame || plan.frames[frame]?.timelineSeconds !== frame / FPS) {
      errors.push(`${variant} offline plan is not contiguous at frame ${frame}.`);
      break;
    }
  }
}

export function validateVoyageFullReviewPlans({ manifest, promisePlan, completionPlan }) {
  const errors = [];
  const digest = voyageProductionManifestDigest(manifest);
  exactFrameRange(promisePlan, "promise", errors);
  exactFrameRange(completionPlan, "completion", errors);
  for (const [variant, plan] of [["promise", promisePlan], ["completion", completionPlan]]) {
    if (plan?.contractSha256 !== digest) errors.push(`${variant} offline plan does not match the current production contract.`);
  }
  if (JSON.stringify(promisePlan?.sources) !== JSON.stringify(completionPlan?.sources)
    || JSON.stringify(promisePlan?.assets) !== JSON.stringify(completionPlan?.assets)) {
    errors.push("Promise and Completion plans do not bind the same authoritative sources and assets.");
  }
  if (Array.isArray(promisePlan?.frames) && Array.isArray(completionPlan?.frames)) {
    for (let frame = 0; frame < COMPLETION_START_FRAME; frame += 1) {
      if (JSON.stringify(promisePlan.frames[frame]) !== JSON.stringify(completionPlan.frames[frame])) {
        errors.push(`Promise and Completion diverge before the approved finale boundary at frame ${frame}.`);
        break;
      }
    }
    const finaleDiffers = promisePlan.frames.slice(COMPLETION_START_FRAME).some((record, index) => (
      JSON.stringify(record) !== JSON.stringify(completionPlan.frames[COMPLETION_START_FRAME + index])
    ));
    if (!finaleDiffers) errors.push("Completion must diverge from Promise at the approved frame-1272 finale boundary.");
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    contractSha256: digest,
    sharedFrames: COMPLETION_START_FRAME,
    completionRenderedFrames: TOTAL_FRAMES - COMPLETION_START_FRAME
  });
}

async function writeImmutableJson(root, declaredPath, value) {
  const absolute = projectPath(root, declaredPath);
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  await mkdir(dirname(absolute), { recursive: true });
  try {
    const existing = await readFile(absolute, "utf8");
    if (existing !== contents) throw new Error(`Refusing to overwrite mismatched review artifact ${declaredPath}.`);
    return Object.freeze({ path: portable(declaredPath), bytes: Buffer.byteLength(existing), sha256: createHash("sha256").update(existing).digest("hex"), existing: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await writeFile(absolute, contents, { encoding: "utf8", flag: "wx" });
  return Object.freeze({ path: portable(declaredPath), bytes: Buffer.byteLength(contents), sha256: createHash("sha256").update(contents).digest("hex"), existing: false });
}

function runExecutable(executable, arguments_, { cwd }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, arguments_, {
      cwd,
      windowsHide: true,
      stdio: "inherit",
      env: process.env
    });
    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${executable} exited ${code}.`));
    });
  });
}

async function defaultRenderSegment({
  root,
  tools,
  planPath,
  outputDirectory,
  frames,
  width,
  height,
  samples,
  lookdevPlates
}) {
  const arguments_ = buildBlenderArguments({
    planPath,
    outputDirectory,
    mode: "review",
    frames: frames.length === TOTAL_FRAMES ? [] : frames,
    width,
    height,
    samples,
    resume: true,
    lookdevPlates
  });
  await runExecutable(tools.blender, arguments_, { cwd: resolve(root) });
}

async function inspectExpectedExistingFrames({ root, outputRoot, plan, frames, width, height }) {
  let present = 0;
  for (const frame of frames) {
    const declared = planFramePath(outputRoot, plan.variant, plan.frames[frame]);
    const record = await fileRecord(root, declared);
    if (record.status === "missing") continue;
    if (record.status !== "present") throw new Error(`Existing render frame ${declared} is ${record.status}.`);
    const dimensions = await pngDimensions(projectPath(root, declared));
    if (dimensions?.width !== width || dimensions?.height !== height) {
      throw new Error(`Existing render frame ${declared} does not match ${width}x${height}.`);
    }
    present += 1;
  }
  return present;
}

export function validateVoyageRendererShotDiversity(frames) {
  const records = Array.isArray(frames) ? frames : [];
  const shotIds = new Set(records.map((frame) => frame?.shotId).filter(Boolean));
  const hashes = new Set(records.map((frame) => frame?.sha256).filter(Boolean));
  if (shotIds.size > 1 && hashes.size === 1) {
    return Object.freeze({
      valid: false,
      error: `Renderer report collapses ${shotIds.size} distinct shots into one frame hash.`,
      shotCount: shotIds.size,
      distinctFrameHashes: hashes.size
    });
  }
  return Object.freeze({ valid: true, error: null, shotCount: shotIds.size, distinctFrameHashes: hashes.size });
}

function contiguousShotSegments({ outputRoot, variant, plan, expectedFrames }) {
  const segments = [];
  for (const frame of expectedFrames) {
    const record = plan.frames[frame];
    const previous = segments.at(-1);
    if (!previous || previous.shotId !== record.shotId || previous.endFrameExclusive !== frame) {
      segments.push({
        shotId: record.shotId,
        startFrame: frame,
        endFrameExclusive: frame + 1,
        pattern: `${outputRoot}/renderer/${variant}/${record.shotId}/frame-%04d.png`
      });
    } else {
      previous.endFrameExclusive = frame + 1;
    }
  }
  return segments;
}

function execFileBuffer(executable, arguments_, { cwd, maxBuffer = 8_000_000 } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(executable, arguments_, {
      cwd,
      windowsHide: true,
      encoding: "buffer",
      maxBuffer
    }, (error, stdout, stderr) => {
      if (error) rejectPromise(new Error(`${executable} failed: ${String(stderr || error.message).trim()}`));
      else resolvePromise(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout || ""));
    });
  });
}

async function defaultProbeRenderedShotSequence({
  root,
  pattern,
  startFrame,
  endFrameExclusive,
  width,
  height
}) {
  const count = endFrameExclusive - startFrame;
  const probeWidth = 32;
  const probeHeight = 18;
  const bytesPerFrame = probeWidth * probeHeight * 3;
  const absolutePattern = projectPath(root, pattern, "renderer shot sequence");
  const decoded = await execFileBuffer("ffmpeg", [
    "-v", "error", "-xerror", "-nostdin",
    "-framerate", String(FPS), "-start_number", String(startFrame), "-i", absolutePattern,
    "-frames:v", String(count),
    "-vf", `scale=${probeWidth}:${probeHeight}:flags=area,format=rgb24`,
    "-an", "-f", "rawvideo", "pipe:1"
  ], { cwd: resolve(root), maxBuffer: Math.max(8_000_000, count * bytesPerFrame + 1_000_000) });
  if (decoded.length !== count * bytesPerFrame) {
    throw new Error(`ffmpeg decoded ${decoded.length} probe bytes; expected ${count * bytesPerFrame}.`);
  }
  let maxChannel = 0;
  let nonzeroFrames = 0;
  for (let frame = 0; frame < count; frame += 1) {
    let frameMaximum = 0;
    const start = frame * bytesPerFrame;
    const end = start + bytesPerFrame;
    for (let index = start; index < end; index += 1) frameMaximum = Math.max(frameMaximum, decoded[index]);
    maxChannel = Math.max(maxChannel, frameMaximum);
    if (frameMaximum > 2) nonzeroFrames += 1;
  }
  return Object.freeze({ decodedFrames: count, width, height, maxChannel, nonzeroFrames });
}

function validateRenderedShotProbe(probe, segment, width, height, variant) {
  const expected = segment.endFrameExclusive - segment.startFrame;
  if (probe?.decodedFrames !== expected
    || probe?.width !== width
    || probe?.height !== height) {
    throw new Error(`${variant} shot ${segment.shotId} did not decode all ${expected} frames at ${width}x${height}.`);
  }
  if (!Number.isFinite(Number(probe?.maxChannel))
    || Number(probe.maxChannel) <= 2
    || !Number.isInteger(probe?.nonzeroFrames)
    || probe.nonzeroFrames < 1) {
    throw new Error(`${variant} shot ${segment.shotId} is visually empty after full-sequence decoding.`);
  }
}

async function verifyRendererLookdevBoundary({ root, report, contractSha256, variant }) {
  if (report?.lookdevPlatesEnabled === false) return;
  if (report?.lookdevPlatesEnabled !== true) {
    throw new Error(`${variant} renderer report does not explicitly disable or provenance-bind look-development plates.`);
  }
  const provenance = report.lookdevProvenance;
  const binding = provenance?.manifest;
  if (provenance?.reviewOnly !== true
    || provenance?.compositionMode !== "underlay"
    || binding?.path !== LOOKDEV_MANIFEST_PATH
    || !validSha256(binding?.sha256)
    || !Array.isArray(provenance?.assets)
    || provenance.assets.length < 1) {
    throw new Error(`${variant} look-development use lacks explicit review-only underlay manifest/hash provenance.`);
  }
  const manifestRecord = await fileRecord(root, LOOKDEV_MANIFEST_PATH);
  if (manifestRecord.status !== "present" || manifestRecord.sha256 !== binding.sha256) {
    throw new Error(`${variant} look-development manifest binding does not match the verified file.`);
  }
  const verification = await validateVoyageLookdev({
    root,
    manifestPath: projectPath(root, LOOKDEV_MANIFEST_PATH, "look-development manifest")
  });
  if (!verification.valid) {
    throw new Error(`${variant} look-development manifest verification failed: ${verification.errors.join("; ")}`);
  }
  const manifest = JSON.parse(await readFile(projectPath(root, LOOKDEV_MANIFEST_PATH), "utf8"));
  if (manifest?.contractSha256 !== contractSha256) {
    throw new Error(`${variant} look-development manifest does not match the renderer contract.`);
  }
  const assets = new Map((manifest.assets || []).map((asset) => [asset.id, asset]));
  const seen = new Set();
  for (const record of provenance.assets) {
    const expected = assets.get(record?.id);
    if (!expected
      || seen.has(record.id)
      || record.path !== expected.path
      || record.sha256 !== expected.sha256
      || record.compositionMode !== "underlay") {
      throw new Error(`${variant} look-development asset provenance is missing, duplicated, or does not match the verified manifest.`);
    }
    seen.add(record.id);
    const actual = await fileRecord(root, record.path);
    if (actual.status !== "present" || actual.sha256 !== record.sha256) {
      throw new Error(`${variant} look-development asset ${record.id} does not match its bound file.`);
    }
  }
}

async function verifyRenderReport({
  root,
  outputRoot,
  variant,
  plan,
  planRecord,
  expectedFrames,
  width,
  height,
  samples,
  probeRenderedShotSequence,
  optional = false
}) {
  const reportPath = `${outputRoot}/renderer/render-report-${variant}-review.json`;
  let report;
  try { report = JSON.parse(await readFile(projectPath(root, reportPath), "utf8")); }
  catch (error) {
    if (optional && error?.code === "ENOENT") return null;
    throw new Error(`${variant} renderer report could not be read: ${error.message}`);
  }
  if (report?.schemaVersion !== 1
    || report?.status !== "non-shipping-review"
    || report?.releaseEligible !== false
    || report?.variant !== variant
    || report?.mode !== "review"
    || report?.contractSha256 !== plan.contractSha256
    || report?.planPath !== planRecord.path
    || report?.planSha256 !== planRecord.sha256
    || report?.renderer?.name !== "Blender"
    || report?.renderer?.version !== BLENDER_VERSION
    || report?.renderer?.engine !== "BLENDER_EEVEE"
    || report?.resolution?.width !== width
    || report?.resolution?.height !== height
    || !Array.isArray(report?.frames)
    || report.frames.length !== expectedFrames.length) {
    throw new Error(`${variant} renderer report does not match the requested non-shipping segment.`);
  }
  if (report?.sampling?.requested !== samples
    || report?.sampling?.effective !== samples
    || report?.sampling?.controlled !== true) {
    throw new Error(`${variant} renderer report does not prove controlled ${samples}-sample Eevee rendering.`);
  }
  await verifyRendererLookdevBoundary({ root, report, contractSha256: plan.contractSha256, variant });
  const records = new Map();
  for (const [index, frame] of expectedFrames.entries()) {
    const reportFrame = report.frames[index];
    const expectedPath = planFramePath(outputRoot, variant, plan.frames[frame]);
    if (reportFrame?.frame !== frame
      || reportFrame?.shotId !== plan.frames[frame].shotId
      || reportFrame?.path !== expectedPath) {
      throw new Error(`${variant} renderer report is noncontiguous or points outside its output at frame ${frame}.`);
    }
    const luminance = reportFrame?.luminanceProbe;
    if (!Number.isFinite(Number(luminance?.mean))
      || !Number.isFinite(Number(luminance?.maximum))
      || Number(luminance.maximum) <= 0.015
      || luminance?.nearBlack !== false) {
      throw new Error(`${variant} renderer report lacks valid non-black luminance evidence at frame ${frame}.`);
    }
    const actual = await fileRecord(root, expectedPath);
    if (actual.status !== "present"
      || actual.bytes !== reportFrame.bytes
      || actual.sha256 !== reportFrame.sha256) {
      throw new Error(`${variant} rendered frame ${frame} does not match its renderer report.`);
    }
    const dimensions = await pngDimensions(projectPath(root, expectedPath));
    if (dimensions?.width !== width || dimensions?.height !== height) {
      throw new Error(`${variant} rendered frame ${frame} does not match ${width}x${height}.`);
    }
    records.set(frame, actual);
  }
  const diversity = validateVoyageRendererShotDiversity(report.frames);
  if (!diversity.valid) throw new Error(`${variant} ${diversity.error}`);
  for (const segment of contiguousShotSegments({ outputRoot, variant, plan, expectedFrames })) {
    const probe = await probeRenderedShotSequence({
      root,
      variant,
      shotId: segment.shotId,
      pattern: segment.pattern,
      startFrame: segment.startFrame,
      endFrameExclusive: segment.endFrameExclusive,
      width,
      height
    });
    validateRenderedShotProbe(probe, segment, width, height, variant);
  }
  return Object.freeze({ reportPath, report, records });
}

export async function materializeVoyageReviewFrame({
  root,
  sourcePath,
  destinationPath,
  linkFile = link,
  copyFrame = copyFile
}) {
  const source = await fileRecord(root, sourcePath);
  if (source.status !== "present") throw new Error(`Review frame source ${sourcePath} is ${source.status}.`);
  const existing = await fileRecord(root, destinationPath);
  if (existing.status !== "missing") {
    if (existing.status !== "present" || existing.sha256 !== source.sha256 || existing.bytes !== source.bytes) {
      throw new Error(`Refusing to overwrite mismatched review frame ${destinationPath}.`);
    }
    const [sourceStat, destinationStat] = await Promise.all([
      stat(projectPath(root, sourcePath)),
      stat(projectPath(root, destinationPath))
    ]);
    return Object.freeze({ mode: sourceStat.dev === destinationStat.dev && sourceStat.ino === destinationStat.ino ? "already-hardlinked" : "already-identical", source, destination: existing });
  }

  const sourceAbsolute = projectPath(root, sourcePath);
  const destinationAbsolute = projectPath(root, destinationPath);
  await mkdir(dirname(destinationAbsolute), { recursive: true });
  let mode = "hardlinked";
  try {
    await linkFile(sourceAbsolute, destinationAbsolute);
  } catch (error) {
    if (error?.code === "EEXIST") {
      const raced = await fileRecord(root, destinationPath);
      if (raced.status === "present" && raced.sha256 === source.sha256 && raced.bytes === source.bytes) {
        return Object.freeze({ mode: "already-identical", source, destination: raced });
      }
      throw new Error(`Refusing to overwrite mismatched review frame ${destinationPath}.`);
    }
    if (!FALLBACK_LINK_ERRORS.has(error?.code)) throw error;
    await copyFrame(sourceAbsolute, destinationAbsolute, fsConstants.COPYFILE_EXCL);
    mode = "copied";
  }
  const destination = await fileRecord(root, destinationPath);
  if (destination.status !== "present" || destination.sha256 !== source.sha256 || destination.bytes !== source.bytes) {
    await unlink(destinationAbsolute).catch(() => {});
    throw new Error(`Materialized review frame ${destinationPath} failed SHA-256 verification.`);
  }
  return Object.freeze({ mode, source, destination });
}

async function verifyTimeline({ root, outputRoot, variant, width, height }) {
  const aggregate = createHash("sha256");
  const records = [];
  let totalBytes = 0;
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const declared = timelineFramePath(outputRoot, variant, frame);
    const record = await fileRecord(root, declared);
    if (record.status !== "present") throw new Error(`${variant} review timeline is not contiguous at frame ${frame} (${record.status}).`);
    const dimensions = await pngDimensions(projectPath(root, declared));
    if (dimensions?.width !== width || dimensions?.height !== height) {
      throw new Error(`${variant} review timeline frame ${frame} does not match ${width}x${height}.`);
    }
    totalBytes += record.bytes;
    aggregate.update(`frame:${frame}\0bytes:${record.bytes}\0sha256:${record.sha256}\n`);
    records.push(record);
  }
  return Object.freeze({
    pattern: `${outputRoot}/timelines/${variant}/frame-%04d.png`,
    frames: TOTAL_FRAMES,
    totalBytes,
    aggregateSha256: aggregate.digest("hex"),
    records: Object.freeze(records)
  });
}

function validateSettings(width, height, samples) {
  if (!Number.isInteger(width) || width < 320 || width > 7680 || width % 2 !== 0
    || !Number.isInteger(height) || height < 180 || height > 4320 || height % 2 !== 0) {
    throw new Error("Full review dimensions must be even integers within 320x180 and 7680x4320.");
  }
  if (!Number.isInteger(samples) || samples < 1 || samples > 512) {
    throw new Error("Full review samples must be an integer from 1 to 512.");
  }
}

export async function orchestrateVoyageFullReview({
  root = ROOT,
  outputRoot = DEFAULT_FULL_REVIEW_OUTPUT_ROOT,
  width = 1920,
  height = 1080,
  samples = 32,
  lookdevPlates = false,
  resume = false,
  confirmation,
  manifest = null,
  buildPlan = buildVoyageOfflinePlan,
  resolveTools = verifyOfflineRenderTools,
  renderSegment = defaultRenderSegment,
  probeRenderedShotSequence = defaultProbeRenderedShotSequence,
  linkFile = link,
  copyFrame = copyFile
} = {}) {
  if (confirmation !== FULL_REVIEW_RENDER_CONFIRMATION) {
    throw new Error(`Full review rendering requires --confirm=${FULL_REVIEW_RENDER_CONFIRMATION}.`);
  }
  validateSettings(Number(width), Number(height), Number(samples));
  const finalOutputRoot = validateOutputRoot(outputRoot);
  projectPath(root, finalOutputRoot, "full review output");
  const productionManifest = manifest || await loadVoyageProductionManifest();
  const [promisePlan, completionPlan] = await Promise.all([
    buildPlan({ root, variant: "promise", startFrame: 0, endFrameExclusive: TOTAL_FRAMES }),
    buildPlan({ root, variant: "completion", startFrame: 0, endFrameExclusive: TOTAL_FRAMES })
  ]);
  const validation = validateVoyageFullReviewPlans({
    manifest: productionManifest,
    promisePlan,
    completionPlan
  });
  if (!validation.valid) throw new Error(`Full review plans are invalid:\n${validation.errors.join("\n")}`);

  const planRecords = {};
  for (const [variant, plan] of [["promise", promisePlan], ["completion", completionPlan]]) {
    planRecords[variant] = await writeImmutableJson(
      root,
      `${finalOutputRoot}/plans/${variant}-full-review-plan.json`,
      plan
    );
  }
  const session = {
    schemaVersion: 1,
    status: "non-shipping-full-review-session",
    releaseEligible: false,
    shipping: false,
    contractSha256: validation.contractSha256,
    settings: {
      width: Number(width),
      height: Number(height),
      samples: Number(samples),
      lookdevPlates: Boolean(lookdevPlates)
    },
    plans: {
      promise: { path: planRecords.promise.path, sha256: planRecords.promise.sha256 },
      completion: { path: planRecords.completion.path, sha256: planRecords.completion.sha256 }
    }
  };
  const sessionRecord = await writeImmutableJson(root, `${finalOutputRoot}/render-session.json`, session);

  const rendererOutput = projectPath(root, `${finalOutputRoot}/renderer`);
  const segments = [
    { variant: "promise", plan: promisePlan, frames: Array.from({ length: TOTAL_FRAMES }, (_, frame) => frame) },
    { variant: "completion", plan: completionPlan, frames: Array.from({ length: TOTAL_FRAMES - COMPLETION_START_FRAME }, (_, index) => index + COMPLETION_START_FRAME) }
  ];
  const rendered = {};
  let tools = null;
  for (const segment of segments) {
    const planRecord = planRecords[segment.variant];
    const existingReport = await verifyRenderReport({
      root,
      outputRoot: finalOutputRoot,
      variant: segment.variant,
      plan: segment.plan,
      planRecord,
      expectedFrames: segment.frames,
      width: Number(width),
      height: Number(height),
      samples: Number(samples),
      probeRenderedShotSequence,
      optional: true
    });
    if (existingReport) {
      rendered[segment.variant] = existingReport;
      continue;
    }
    const present = await inspectExpectedExistingFrames({
      root,
      outputRoot: finalOutputRoot,
      plan: segment.plan,
      frames: segment.frames,
      width: Number(width),
      height: Number(height)
    });
    if (present > 0 && (!resume || !sessionRecord.existing)) {
      throw new Error(`${segment.variant} has ${present} existing frames without a matching resumable session.`);
    }
    tools ||= await resolveTools();
    await renderSegment({
      root,
      tools,
      variant: segment.variant,
      plan: segment.plan,
      planPath: projectPath(root, planRecord.path),
      planRecord,
      outputDirectory: rendererOutput,
      outputRoot: finalOutputRoot,
      frames: segment.frames,
      width: Number(width),
      height: Number(height),
      samples: Number(samples),
      lookdevPlates: Boolean(lookdevPlates),
      resume: true
    });
    rendered[segment.variant] = await verifyRenderReport({
      root,
      outputRoot: finalOutputRoot,
      variant: segment.variant,
      plan: segment.plan,
      planRecord,
      expectedFrames: segment.frames,
      width: Number(width),
      height: Number(height),
      samples: Number(samples),
      probeRenderedShotSequence
    });
  }

  const materialization = {
    promise: { hardlinked: 0, copied: 0, already: 0 },
    completionShared: { hardlinked: 0, copied: 0, already: 0 },
    completionRendered: { hardlinked: 0, copied: 0, already: 0 }
  };
  const countMode = (bucket, mode) => {
    if (mode === "hardlinked") bucket.hardlinked += 1;
    else if (mode === "copied") bucket.copied += 1;
    else bucket.already += 1;
  };
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const result = await materializeVoyageReviewFrame({
      root,
      sourcePath: planFramePath(finalOutputRoot, "promise", promisePlan.frames[frame]),
      destinationPath: timelineFramePath(finalOutputRoot, "promise", frame),
      linkFile,
      copyFrame
    });
    countMode(materialization.promise, result.mode);
  }
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const shared = frame < COMPLETION_START_FRAME;
    const result = await materializeVoyageReviewFrame({
      root,
      sourcePath: shared
        ? timelineFramePath(finalOutputRoot, "promise", frame)
        : planFramePath(finalOutputRoot, "completion", completionPlan.frames[frame]),
      destinationPath: timelineFramePath(finalOutputRoot, "completion", frame),
      linkFile,
      copyFrame
    });
    countMode(shared ? materialization.completionShared : materialization.completionRendered, result.mode);
  }

  const [promiseTimeline, completionTimeline] = await Promise.all([
    verifyTimeline({ root, outputRoot: finalOutputRoot, variant: "promise", width: Number(width), height: Number(height) }),
    verifyTimeline({ root, outputRoot: finalOutputRoot, variant: "completion", width: Number(width), height: Number(height) })
  ]);
  for (let frame = 0; frame < COMPLETION_START_FRAME; frame += 1) {
    if (promiseTimeline.records[frame].sha256 !== completionTimeline.records[frame].sha256) {
      throw new Error(`Completion shared prefix does not match Promise at frame ${frame}.`);
    }
  }

  const report = {
    schemaVersion: 1,
    status: "non-shipping-full-review",
    releaseEligible: false,
    shipping: false,
    contractSha256: validation.contractSha256,
    settings: session.settings,
    plans: session.plans,
    renderWork: {
      promiseFramesRendered: TOTAL_FRAMES,
      completionFramesRendered: TOTAL_FRAMES - COMPLETION_START_FRAME,
      completionFramesSharedFromPromise: COMPLETION_START_FRAME
    },
    timelines: {
      promise: {
        pattern: promiseTimeline.pattern,
        frames: promiseTimeline.frames,
        totalBytes: promiseTimeline.totalBytes,
        aggregateSha256: promiseTimeline.aggregateSha256
      },
      completion: {
        pattern: completionTimeline.pattern,
        frames: completionTimeline.frames,
        totalBytes: completionTimeline.totalBytes,
        aggregateSha256: completionTimeline.aggregateSha256
      }
    },
    truthBoundary: "This report proves only a complete non-shipping review render. It does not satisfy final color, audio, provenance, protected-pixel, creative, accessibility, or release approval."
  };
  const reportRecord = await writeImmutableJson(root, `${finalOutputRoot}/full-review-report.json`, report);
  return Object.freeze({
    releaseEligible: false,
    shipping: false,
    report,
    reportPath: reportRecord.path,
    sessionPath: sessionRecord.path,
    materialization: Object.freeze(materialization)
  });
}

function argumentValue(argv, name, fallback = null) {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  orchestrateVoyageFullReview({
    outputRoot: argumentValue(process.argv.slice(2), "output", DEFAULT_FULL_REVIEW_OUTPUT_ROOT),
    width: Number(argumentValue(process.argv.slice(2), "width", "1920")),
    height: Number(argumentValue(process.argv.slice(2), "height", "1080")),
    samples: Number(argumentValue(process.argv.slice(2), "samples", "32")),
    lookdevPlates: process.argv.includes("--lookdev-plates"),
    resume: process.argv.includes("--resume"),
    confirmation: argumentValue(process.argv.slice(2), "confirm", "")
  }).then((result) => {
    console.log(`Voyage full review complete: ${result.reportPath}`);
    console.log(`Promise ${result.report.timelines.promise.frames} frames; Completion ${result.report.timelines.completion.frames} frames; release eligible: false`);
  }).catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
