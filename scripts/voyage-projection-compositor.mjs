import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { constants as fsConstants } from "node:fs";
import {
  copyFile,
  link,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  unlink,
  writeFile
} from "node:fs/promises";
import { execFile } from "node:child_process";
import {
  dirname,
  basename,
  isAbsolute,
  normalize,
  relative,
  resolve,
  sep
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  loadVoyageProductionManifest,
  voyageProductionManifestDigest
} from "./voyage-projection-production.mjs";
import {
  verifyVoyageProjectionAudio,
  VOYAGE_AUDIO_RECORD_PATH
} from "./verify-voyage-projection-audio.mjs";
import {
  verifyVoyageProjectionAudioReview,
  VOYAGE_AUDIO_REVIEW_RECORD_PATH
} from "./verify-voyage-projection-audio-master.mjs";
import { validateVoyageLookdev } from "./voyage-projection-lookdev.mjs";

export const VOYAGE_PRODUCTION_FPS = 24;
export const VOYAGE_PRODUCTION_SECONDS = 57;
export const VOYAGE_PRODUCTION_FRAMES = VOYAGE_PRODUCTION_FPS * VOYAGE_PRODUCTION_SECONDS;
export const CLEAN_COMPOSITE_CONFIRMATION = "CONFIRM_CLEAN_AUTHORED_3D_COPY";
export const FINAL_ENCODE_CONFIRMATION = "CONFIRM_FINAL_VOYAGE_ENCODE";
export const REVIEW_CANDIDATE_CONFIRMATION = "CONFIRM_NONSHIPPING_VOYAGE_REVIEW";
export const DEFAULT_COMPOSITOR_MANIFEST = "production/voyage-projection/scaffold/compositor-jobs.json";
export const DEFAULT_ENCODE_PREREQUISITES = "production/voyage-projection/final-encode-prerequisites.json";
export const VOYAGE_REVIEW_OUTPUT_ROOT = "output/voyage-projection/review-candidates";
export const VOYAGE_REVIEW_LOOKDEV_MANIFEST_PATH =
  "production/voyage-projection/lookdev/lookdev-manifest.json";

const FINAL_VARIANTS = Object.freeze([
  Object.freeze({
    id: "promise",
    label: "opening",
    audioPath: "output/voyage-projection/audio/voyage-projection-opening-master.wav",
    h264Path: "public/cinematic/voyage-projection-opening-master.mp4",
    vp9Path: "public/cinematic/voyage-projection-opening-master.webm"
  }),
  Object.freeze({
    id: "completion",
    label: "finale",
    audioPath: "output/voyage-projection/audio/voyage-projection-finale-master.wav",
    h264Path: "public/cinematic/voyage-projection-finale-master.mp4",
    vp9Path: "public/cinematic/voyage-projection-finale-master.webm"
  })
]);

const REQUIRED_PROVENANCE = Object.freeze([
  "authoritative-3d-production",
  "navigation-voice",
  "score-and-sound-design"
]);

const REQUIRED_APPROVALS = Object.freeze([
  "creative",
  "continuity",
  "accessibility",
  "rights-and-provenance"
]);

const REVIEW_POSTER_FRAMES = Object.freeze({
  promise: 168,
  completion: 1272
});

function list(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/.test(String(value || ""));
}

function normalizedProjectPath(value) {
  return String(value || "").replaceAll("\\", "/");
}

function validReviewCandidateId(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ""))
    && String(value).length <= 64;
}

function isOutputReviewPath(value, prefix = "output/voyage-projection/") {
  const raw = String(value || "");
  const normalized = normalizedProjectPath(raw);
  return !isAbsolute(raw)
    && normalized.startsWith(prefix)
    && !normalized.split("/").includes("..");
}

function isReviewFramePattern(value) {
  const normalized = normalizedProjectPath(value);
  return isOutputReviewPath(value)
    && (normalized.endsWith(".png") || normalized.endsWith(".exr"));
}

function pathInsideRoot(root, projectPath, label = "path") {
  const declared = String(projectPath || "").trim();
  if (!declared || isAbsolute(declared)) throw new Error(`${label} must be a non-empty project-relative path.`);
  const absoluteRoot = resolve(root);
  const candidate = resolve(absoluteRoot, normalize(declared));
  const fromRoot = relative(absoluteRoot, candidate);
  if (!fromRoot || fromRoot.startsWith(`..${sep}`) || fromRoot === ".." || isAbsolute(fromRoot)) {
    throw new Error(`${label} escapes the project root: ${declared}`);
  }
  return candidate;
}

function realPathInside(realRoot, candidate, label) {
  const fromRoot = relative(realRoot, candidate);
  if (fromRoot.startsWith(`..${sep}`) || fromRoot === ".." || isAbsolute(fromRoot)) {
    throw new Error(`${label} resolves outside the project root.`);
  }
  return candidate;
}

async function secureExistingProjectPath(root, projectPath, label = "path") {
  const lexical = pathInsideRoot(root, projectPath, label);
  const [realRoot, realCandidate] = await Promise.all([realpath(resolve(root)), realpath(lexical)]);
  return realPathInside(realRoot, realCandidate, label);
}

async function secureOutputProjectPath(root, projectPath, label = "output") {
  const lexical = pathInsideRoot(root, projectPath, label);
  const realRoot = await realpath(resolve(root));
  let ancestor = dirname(lexical);
  while (true) {
    try {
      const realAncestor = await realpath(ancestor);
      realPathInside(realRoot, realAncestor, label);
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  await mkdir(dirname(lexical), { recursive: true });
  const realParent = await realpath(dirname(lexical));
  realPathInside(realRoot, realParent, label);
  try {
    const details = await lstat(lexical);
    if (details.isSymbolicLink()) throw new Error(`${label} may not be a symbolic link or junction.`);
    const realCandidate = await realpath(lexical);
    realPathInside(realRoot, realCandidate, label);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return lexical;
}

function framePath(pattern, frame) {
  const declared = String(pattern || "");
  if ((declared.match(/%04d/g) || []).length !== 1) {
    throw new Error(`Frame pattern must contain exactly one %04d token: ${declared}`);
  }
  return declared.replace("%04d", String(frame).padStart(4, "0"));
}

async function fileRecord(root, projectPath) {
  const lexical = pathInsideRoot(root, projectPath);
  try {
    const details = await lstat(lexical);
    if (details.isSymbolicLink()) {
      return { path: normalizedProjectPath(projectPath), status: "symlink-rejected", bytes: null, sha256: null };
    }
    const absolute = await secureExistingProjectPath(root, projectPath, "file");
    if (!details.isFile() || details.size <= 0) {
      return { path: normalizedProjectPath(projectPath), status: "not-a-nonempty-file", bytes: details.size, sha256: null };
    }
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(absolute)) hash.update(chunk);
    return {
      path: normalizedProjectPath(projectPath),
      status: "present",
      bytes: details.size,
      sha256: hash.digest("hex")
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { path: normalizedProjectPath(projectPath), status: "missing", bytes: null, sha256: null };
    }
    throw error;
  }
}

/**
 * Inspect a numbered frame sequence without loading complete 4K frames into
 * memory. The aggregate binds frame number, project-relative path, byte count,
 * and each file's SHA-256 in deterministic order.
 */
export async function inspectVoyageFrameSequence({
  root,
  pattern,
  startFrame,
  endFrameExclusive
}) {
  const start = Number(startFrame);
  const end = Number(endFrameExclusive);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > 100_000) {
    throw new RangeError(`Invalid frame range ${startFrame}..${endFrameExclusive}.`);
  }
  framePath(pattern, start);
  const aggregate = createHash("sha256");
  const records = [];
  const missing = [];
  let totalBytes = 0;
  for (let frame = start; frame < end; frame += 1) {
    const path = framePath(pattern, frame);
    const record = await fileRecord(root, path);
    records.push({ frame, ...record });
    if (record.status !== "present") {
      missing.push({ frame, path: record.path, status: record.status });
      continue;
    }
    totalBytes += record.bytes;
    aggregate.update(`frame:${frame}\0path:${record.path}\0bytes:${record.bytes}\0sha256:${record.sha256}\n`);
  }
  return Object.freeze({
    pattern: normalizedProjectPath(pattern),
    startFrame: start,
    endFrameExclusive: end,
    expectedFrames: end - start,
    presentFrames: records.length - missing.length,
    complete: missing.length === 0,
    totalBytes,
    aggregateSha256: missing.length === 0 ? aggregate.digest("hex") : null,
    missing: Object.freeze(missing),
    records: Object.freeze(records)
  });
}

export function validateCleanAuthoredCompositor(manifest, compositor) {
  const errors = [];
  const digest = voyageProductionManifestDigest(manifest);
  if (!object(compositor) || compositor.schemaVersion !== 1) errors.push("Compositor manifest must use schemaVersion 1.");
  if (compositor?.contractSha256 !== digest) errors.push("Compositor manifest does not match the current production contract digest.");
  if (compositor?.defaultMode !== "clean-authored-3d") errors.push("Compositor default mode must remain clean-authored-3d.");
  if (compositor?.cleanAuthored3d?.validWithoutAiLayers !== true
    || compositor?.cleanAuthored3d?.changesProtectedPixels !== 0) {
    errors.push("Clean authored-3D compositing must be an identity copy with zero protected-pixel changes.");
  }
  if (compositor?.protectedPixelComparison?.maximumChangedPixels !== 0
    || manifest?.qualityGates?.protectedPixelComparison?.maximumChangedPixels !== 0) {
    errors.push("Protected-pixel policy must remain exactly zero changed pixels.");
  }

  const jobs = list(compositor?.jobs);
  if (!jobs.length) errors.push("Compositor manifest has no jobs.");
  const ids = new Set();
  for (const job of jobs) {
    if (!String(job?.id || "").trim() || ids.has(job.id)) errors.push(`Compositor job has a missing or duplicate id: ${job?.id || "<empty>"}.`);
    ids.add(job?.id);
    const range = job?.frameRange;
    if (!Number.isInteger(range?.startFrame)
      || !Number.isInteger(range?.endFrameExclusive)
      || range.startFrame < 0
      || range.endFrameExclusive <= range.startFrame
      || range.endFrameExclusive > VOYAGE_PRODUCTION_FRAMES) {
      errors.push(`Compositor job ${job?.id} has an invalid frame range.`);
    }
    for (const [label, pattern] of [
      ["beauty", job?.authoritativeBeautySequence],
      ["object ID", job?.authoritativeObjectIdSequence],
      ["output", job?.outputSequence]
    ]) {
      try { framePath(pattern, range?.startFrame || 0); }
      catch { errors.push(`Compositor job ${job?.id} has an invalid ${label} sequence pattern.`); }
    }
    for (const layer of list(job?.optionalAiLayers)) {
      if (layer?.enabled !== false) errors.push(`Compositor job ${job?.id} enables AI layer ${layer?.passId || "<unknown>"}; clean mode refuses all AI media.`);
    }
    if (job?.protectedPixelCheck?.maximumChangedPixels !== 0) {
      errors.push(`Compositor job ${job?.id} weakens the zero-delta protected-pixel boundary.`);
    }
    const result = job?.protectedPixelCheck?.result;
    if (result !== null && result !== undefined) {
      const changed = object(result) ? result.changedPixels : result;
      if (changed !== 0) errors.push(`Compositor job ${job?.id} reports protected-pixel changes.`);
    }
  }

  const assemblies = list(compositor?.timelineAssemblies);
  for (const variant of FINAL_VARIANTS) {
    const assembly = assemblies.find((candidate) => candidate?.variantId === variant.id);
    if (!assembly) {
      errors.push(`Missing ${variant.id} timeline assembly.`);
      continue;
    }
    if (assembly.frameRange?.startFrame !== 0
      || assembly.frameRange?.endFrameExclusive !== VOYAGE_PRODUCTION_FRAMES
      || assembly.frameRange?.lastFrame !== VOYAGE_PRODUCTION_FRAMES - 1) {
      errors.push(`${variant.id} timeline assembly must cover exactly frames 0-${VOYAGE_PRODUCTION_FRAMES - 1}.`);
    }
    let cursor = 0;
    for (const segment of list(assembly.segments)) {
      if (segment.startFrame !== cursor || segment.endFrameExclusive <= segment.startFrame) {
        errors.push(`${variant.id} timeline has a gap, overlap, or invalid segment at ${segment?.shotId || "<unknown>"}.`);
      }
      cursor = segment.endFrameExclusive;
      try { framePath(segment.inputSequence, segment.startFrame || 0); }
      catch { errors.push(`${variant.id} timeline segment ${segment?.shotId || "<unknown>"} has an invalid input pattern.`); }
    }
    if (cursor !== VOYAGE_PRODUCTION_FRAMES) errors.push(`${variant.id} timeline does not contain exactly ${VOYAGE_PRODUCTION_FRAMES} frames.`);
    try { framePath(assembly.outputSequence, 0); }
    catch { errors.push(`${variant.id} timeline has an invalid output sequence pattern.`); }
  }
  if (assemblies.some((assembly) => !FINAL_VARIANTS.some((variant) => variant.id === assembly?.variantId))) {
    errors.push("Clean final compositing may assemble only promise and completion variants.");
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), contractSha256: digest });
}

export function buildCleanCompositeOperations(compositor) {
  const operations = [];
  for (const job of list(compositor?.jobs)) {
    for (let frame = job.frameRange.startFrame; frame < job.frameRange.endFrameExclusive; frame += 1) {
      operations.push(Object.freeze({
        kind: "identity-composite",
        variantId: job.variantId,
        shotId: job.shotId,
        frame,
        source: framePath(job.authoritativeBeautySequence, frame),
        objectId: framePath(job.authoritativeObjectIdSequence, frame),
        destination: framePath(job.outputSequence, frame)
      }));
    }
  }
  for (const assembly of list(compositor?.timelineAssemblies)) {
    for (const segment of list(assembly.segments)) {
      for (let frame = segment.startFrame; frame < segment.endFrameExclusive; frame += 1) {
        operations.push(Object.freeze({
          kind: "timeline-assembly",
          variantId: assembly.variantId,
          shotId: segment.shotId,
          frame,
          source: framePath(segment.inputSequence, frame),
          destination: framePath(assembly.outputSequence, frame)
        }));
      }
    }
  }
  return Object.freeze(operations);
}

export async function preflightCleanAuthoredComposite({ root, manifest, compositor }) {
  const truth = validateCleanAuthoredCompositor(manifest, compositor);
  const errors = [...truth.errors];
  const sequenceReports = [];
  if (truth.valid) {
    for (const job of list(compositor.jobs)) {
      for (const [role, pattern] of [
        ["beauty", job.authoritativeBeautySequence],
        ["object-id", job.authoritativeObjectIdSequence]
      ]) {
        const report = await inspectVoyageFrameSequence({
          root,
          pattern,
          startFrame: job.frameRange.startFrame,
          endFrameExclusive: job.frameRange.endFrameExclusive
        });
        sequenceReports.push({ jobId: job.id, role, ...report });
        if (!report.complete) errors.push(`${job.id} ${role} sequence is incomplete (${report.presentFrames}/${report.expectedFrames}).`);
      }
    }
  }
  const operations = truth.valid ? buildCleanCompositeOperations(compositor) : [];
  return Object.freeze({
    mode: "clean-authored-3d",
    ready: errors.length === 0,
    errors: Object.freeze(errors),
    contractSha256: truth.contractSha256,
    sequenceReports: Object.freeze(sequenceReports),
    operations,
    confirmationRequired: CLEAN_COMPOSITE_CONFIRMATION
  });
}

function webFilter(width, height) {
  return `scale=${width}:${height}:flags=lanczos,setsar=1,format=yuv420p`;
}

export function buildVoyageEncodeCommandPlans(manifest) {
  const fps = Number(manifest?.technical?.timelineFps);
  const width = Number(manifest?.technical?.web?.width);
  const height = Number(manifest?.technical?.web?.height);
  if (fps !== VOYAGE_PRODUCTION_FPS || manifest?.durationSeconds !== VOYAGE_PRODUCTION_SECONDS) {
    throw new Error("Encode planning requires the locked 57-second, 24 fps contract.");
  }
  if (width !== 1920 || height !== 1080) throw new Error("Encode planning requires the locked 1920x1080 web delivery.");

  const plans = [];
  for (const variant of FINAL_VARIANTS) {
    const framePattern = `output/voyage-projection/composites/${variant.id}/timeline/frame-%04d.exr`;
    const common = [
      "-hide_banner", "-nostdin", "-n",
      "-framerate", String(fps), "-start_number", "0", "-i", framePattern,
      "-i", variant.audioPath,
      "-map", "0:v:0", "-map", "1:a:0",
      "-frames:v", String(VOYAGE_PRODUCTION_FRAMES),
      "-t", String(VOYAGE_PRODUCTION_SECONDS),
      "-vf", webFilter(width, height),
      "-fps_mode", "cfr",
      "-map_metadata", "-1", "-map_chapters", "-1",
      "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"
    ];
    plans.push(Object.freeze({
      id: `${variant.label}-h264-aac`,
      variantId: variant.id,
      container: "mp4",
      videoCodec: "h264-high",
      audioCodec: "aac-lc",
      executable: "ffmpeg",
      input: Object.freeze({ framePattern, audioPath: variant.audioPath }),
      output: variant.h264Path,
      arguments: Object.freeze([
        ...common,
        "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.1",
        "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
        "-threads", "1", "-x264-params", "scenecut=0:open-gop=0",
        "-c:a", "aac", "-profile:a", "aac_low", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart", variant.h264Path
      ])
    }));
    plans.push(Object.freeze({
      id: `${variant.label}-vp9-opus`,
      variantId: variant.id,
      container: "webm",
      videoCodec: "vp9",
      audioCodec: "opus",
      executable: "ffmpeg",
      input: Object.freeze({ framePattern, audioPath: variant.audioPath }),
      output: variant.vp9Path,
      arguments: Object.freeze([
        ...common,
        "-c:v", "libvpx-vp9", "-crf", "28", "-b:v", "0",
        "-deadline", "good", "-cpu-used", "2", "-threads", "1",
        "-row-mt", "0", "-tile-columns", "0", "-frame-parallel", "0",
        "-c:a", "libopus", "-b:a", "160k", "-ar", "48000",
        variant.vp9Path
      ])
    }));
  }
  return Object.freeze(plans);
}

function reviewWatermarkFilter(width, height) {
  return [
    webFilter(width, height),
    "drawbox=x=0:y=0:w=iw:h=68:color=black@0.72:t=fill",
    "drawtext=fontfile='public/fonts/Manrope-Variable.ttf':text='NON-SHIPPING REVIEW':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=20"
  ].join(",");
}

function reviewAudioArguments(audioSources) {
  if (audioSources.length === 1) return ["-map", "1:a:0"];
  const inputs = audioSources.map((_, index) => `[${index + 1}:a:0]`).join("");
  return [
    "-filter_complex",
    `${inputs}amix=inputs=${audioSources.length}:duration=first:dropout_transition=0:normalize=1[review_audio]`,
    "-map", "[review_audio]"
  ];
}

function validateReviewAiDeclaration(candidate) {
  if (candidate?.aiLayersEnabled === false) {
    return candidate?.lookdevProvenance === undefined || candidate?.lookdevProvenance === null
      ? []
      : ["AI-disabled review candidates may not declare look-development provenance."];
  }
  if (candidate?.aiLayersEnabled !== true) {
    return ["Review candidate aiLayersEnabled must be explicitly true or false."];
  }
  const provenance = candidate?.lookdevProvenance;
  const binding = provenance?.manifest;
  if (!object(provenance)
    || provenance.reviewOnly !== true
    || provenance.compositionMode !== "underlay"
    || binding?.path !== VOYAGE_REVIEW_LOOKDEV_MANIFEST_PATH
    || !validSha256(binding?.sha256)
    || !Array.isArray(provenance.assets)
    || provenance.assets.length < 1) {
    return ["AI-enabled review candidates require explicit reviewOnly, compositionMode=underlay, and exact look-development manifest/hash/assets provenance."];
  }
  const ids = provenance.assets.map((asset) => asset?.id);
  if (new Set(ids).size !== ids.length
    || provenance.assets.some((asset) => !String(asset?.id || "").trim()
      || !String(asset?.path || "").trim()
      || !validSha256(asset?.sha256)
      || asset?.compositionMode !== "underlay")) {
    return ["Every AI review asset must be unique and bind an id, project path, SHA-256, and compositionMode=underlay."];
  }
  return [];
}

/**
 * Build deliberately non-shipping review encodes. Outputs are derived solely
 * from candidateId and can never target public/ or any final delivery path.
 */
export function buildVoyageReviewCandidateCommandPlans(manifest, candidate) {
  const fps = Number(manifest?.technical?.timelineFps);
  const width = Number(manifest?.technical?.web?.width);
  const height = Number(manifest?.technical?.web?.height);
  if (fps !== VOYAGE_PRODUCTION_FPS
    || manifest?.durationSeconds !== VOYAGE_PRODUCTION_SECONDS
    || width !== 1920
    || height !== 1080) {
    throw new Error("Review encode planning requires the locked 57-second, 24 fps, 1920x1080 contract.");
  }
  if (!validReviewCandidateId(candidate?.candidateId)) {
    throw new Error("Review candidateId must be a lowercase kebab-case identifier no longer than 64 characters.");
  }
  const aiErrors = validateReviewAiDeclaration(candidate);
  if (aiErrors.length) throw new Error(aiErrors.join(" "));

  const outputRoot = `${VOYAGE_REVIEW_OUTPUT_ROOT}/${candidate.candidateId}`;
  const plans = [];
  for (const variant of FINAL_VARIANTS) {
    const record = candidate?.variants?.[variant.id];
    if (!object(record) || !isReviewFramePattern(record.framePattern)) {
      throw new Error(`${variant.id} review framePattern must be a PNG or EXR sequence under output/voyage-projection/.`);
    }
    const audioSources = list(record.audio);
    if (!audioSources.length || audioSources.some((audio) => !isOutputReviewPath(audio?.path, "output/voyage-projection/audio/"))) {
      throw new Error(`${variant.id} review audio must use one or more files under output/voyage-projection/audio/.`);
    }

    const variantOutputRoot = `${outputRoot}/${variant.id}`;
    const aiMetadata = candidate.aiLayersEnabled
      ? ";aiLayersEnabled=true;compositionMode=underlay"
      : ";aiLayersEnabled=false";
    const metadata = [
      "-metadata", "title=Constellore Voyage Projection - NON-SHIPPING REVIEW",
      "-metadata", `comment=releaseEligible=false;candidate=${candidate.candidateId};variant=${variant.id}${aiMetadata}`
    ];
    const common = [
      "-hide_banner", "-nostdin", "-n",
      "-framerate", String(fps), "-start_number", "0", "-i", record.framePattern,
      ...audioSources.flatMap((audio) => ["-i", audio.path]),
      "-map", "0:v:0", ...reviewAudioArguments(audioSources),
      "-frames:v", String(VOYAGE_PRODUCTION_FRAMES),
      "-t", String(VOYAGE_PRODUCTION_SECONDS),
      "-vf", reviewWatermarkFilter(width, height),
      "-fps_mode", "cfr", "-map_metadata", "-1", "-map_chapters", "-1",
      "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
      ...metadata
    ];
    const h264Path = `${variantOutputRoot}/${variant.label}-nonshipping-review.mp4`;
    plans.push(Object.freeze({
      id: `${variant.label}-nonshipping-review-h264-aac`,
      kind: "review-video",
      variantId: variant.id,
      container: "mp4",
      videoCodec: "h264-high",
      audioCodec: "aac-lc",
      executable: "ffmpeg",
      releaseEligible: false,
      input: Object.freeze({
        framePattern: record.framePattern,
        audioPaths: Object.freeze(audioSources.map((audio) => audio.path))
      }),
      output: h264Path,
      arguments: Object.freeze([
        ...common,
        "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.1",
        "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p",
        "-threads", "1", "-x264-params", "scenecut=0:open-gop=0",
        "-c:a", "aac", "-profile:a", "aac_low", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", h264Path
      ])
    }));

    const vp9Path = `${variantOutputRoot}/${variant.label}-nonshipping-review.webm`;
    plans.push(Object.freeze({
      id: `${variant.label}-nonshipping-review-vp9-opus`,
      kind: "review-video",
      variantId: variant.id,
      container: "webm",
      videoCodec: "vp9",
      audioCodec: "opus",
      executable: "ffmpeg",
      releaseEligible: false,
      input: Object.freeze({
        framePattern: record.framePattern,
        audioPaths: Object.freeze(audioSources.map((audio) => audio.path))
      }),
      output: vp9Path,
      arguments: Object.freeze([
        ...common,
        "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0",
        "-deadline", "good", "-cpu-used", "4", "-threads", "1",
        "-row-mt", "0", "-tile-columns", "0", "-frame-parallel", "0",
        "-c:a", "libopus", "-b:a", "160k", "-ar", "48000", "-ac", "2",
        vp9Path
      ])
    }));

    const posterFrame = REVIEW_POSTER_FRAMES[variant.id];
    const posterPath = `${variantOutputRoot}/${variant.label}-nonshipping-review-poster.webp`;
    plans.push(Object.freeze({
      id: `${variant.label}-nonshipping-review-poster`,
      kind: "review-poster",
      variantId: variant.id,
      container: "webp",
      videoCodec: "webp",
      audioCodec: null,
      executable: "ffmpeg",
      releaseEligible: false,
      posterFrame,
      input: Object.freeze({ framePattern: record.framePattern, audioPaths: Object.freeze([]) }),
      output: posterPath,
      arguments: Object.freeze([
        "-hide_banner", "-nostdin", "-n",
        "-framerate", String(fps), "-start_number", String(posterFrame), "-i", record.framePattern,
        "-frames:v", "1", "-vf", reviewWatermarkFilter(width, height), "-an",
        "-c:v", "libwebp", "-quality", "86", "-compression_level", "6",
        "-map_metadata", "-1",
        ...metadata,
        posterPath
      ])
    }));
  }
  return Object.freeze(plans);
}

function approvalPresent(value) {
  return object(value)
    && String(value.reviewer || "").trim().length > 0
    && String(value.approvedAt || "").trim().length > 0;
}

async function validateEvidenceFile(root, evidence, label, errors) {
  if (!object(evidence) || !String(evidence.path || "").trim() || !validSha256(evidence.sha256)) {
    errors.push(`${label} must provide a project-relative evidence path and SHA-256.`);
    return;
  }
  let record;
  try { record = await fileRecord(root, evidence.path); }
  catch (error) { errors.push(`${label} path is invalid: ${error.message}`); return; }
  if (record.status !== "present") errors.push(`${label} evidence file is ${record.status}.`);
  else if (record.sha256 !== evidence.sha256) errors.push(`${label} evidence SHA-256 does not match its file.`);
}

function defaultProbeAudio(path) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_type,sample_rate,bits_per_sample,bits_per_raw_sample,channels",
      "-of", "json",
      path
    ], { windowsHide: true, maxBuffer: 2_000_000 }, (error, stdout, stderr) => {
      if (error) rejectPromise(new Error(`ffprobe failed: ${String(stderr || error.message).trim()}`));
      else {
        try { resolvePromise(JSON.parse(stdout)); }
        catch (parseError) { rejectPromise(new Error(`ffprobe returned invalid JSON: ${parseError.message}`)); }
      }
    });
  });
}

function execFilePromise(executable, arguments_, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(executable, arguments_, {
      cwd: options.cwd,
      windowsHide: true,
      maxBuffer: options.maxBuffer || 4_000_000
    }, (error, stdout, stderr) => {
      if (error) rejectPromise(new Error(`${executable} failed: ${String(stderr || error.message).trim()}`));
      else resolvePromise({ stdout, stderr });
    });
  });
}

async function probeJson(path) {
  const { stdout } = await execFilePromise("ffprobe", [
    "-v", "error", "-count_frames",
    "-show_entries",
    "format=duration,format_name:format_tags=title,comment:stream=codec_type,codec_name,profile,width,height,pix_fmt,color_space,color_primaries,color_transfer,r_frame_rate,avg_frame_rate,nb_frames,nb_read_frames,sample_rate,channels",
    "-of", "json", path
  ]);
  try { return JSON.parse(stdout); }
  catch (error) { throw new Error(`ffprobe returned invalid JSON: ${error.message}`); }
}

async function defaultProbeReviewFrameSequence({ root, pattern }) {
  const first = await secureExistingProjectPath(root, framePath(pattern, 0), "review frame");
  const last = await secureExistingProjectPath(root, framePath(pattern, VOYAGE_PRODUCTION_FRAMES - 1), "review frame");
  const absolutePattern = pathInsideRoot(root, pattern, "review frame pattern");
  const [firstProbe, lastProbe] = await Promise.all([probeJson(first), probeJson(last)]);
  await execFilePromise("ffmpeg", [
    "-v", "error", "-xerror", "-nostdin",
    "-framerate", String(VOYAGE_PRODUCTION_FPS), "-start_number", "0", "-i", absolutePattern,
    "-frames:v", String(VOYAGE_PRODUCTION_FRAMES), "-map", "0:v:0", "-f", "null", "-"
  ]);
  return Object.freeze({ first: firstProbe, last: lastProbe, decodedFrames: VOYAGE_PRODUCTION_FRAMES });
}

async function defaultProbeReviewMedia(path) {
  return probeJson(path);
}

async function defaultDecodeReviewMedia(path) {
  await execFilePromise("ffmpeg", [
    "-v", "error", "-xerror", "-nostdin", "-i", path,
    "-map", "0:v:0", "-map", "0:a:0?", "-f", "null", "-"
  ]);
}

function fraction(value) {
  const [numerator, denominator] = String(value || "").split("/").map(Number);
  return Number.isFinite(numerator) && (denominator === undefined || denominator !== 0)
    ? denominator === undefined ? numerator : numerator / denominator
    : Number.NaN;
}

function validateAudioProbe(probe, label, errors) {
  const stream = list(probe?.streams).find((candidate) => candidate?.codec_type === "audio");
  const sampleRate = Number(stream?.sample_rate);
  const bitDepth = Number(stream?.bits_per_raw_sample || stream?.bits_per_sample);
  const channels = Number(stream?.channels);
  const duration = Number(probe?.format?.duration);
  if (!stream) errors.push(`${label} has no audio stream.`);
  if (sampleRate !== 48_000) errors.push(`${label} must be 48 kHz; ffprobe reported ${sampleRate || "unknown"}.`);
  if (bitDepth !== 24) errors.push(`${label} must be 24-bit; ffprobe reported ${bitDepth || "unknown"}.`);
  if (channels < 1 || channels > 2) errors.push(`${label} must be mono or stereo; ffprobe reported ${channels || "unknown"} channels.`);
  if (!Number.isFinite(duration) || Math.abs(duration - VOYAGE_PRODUCTION_SECONDS) > 1 / VOYAGE_PRODUCTION_FPS) {
    errors.push(`${label} must be ${VOYAGE_PRODUCTION_SECONDS} seconds within one frame; ffprobe reported ${duration || "unknown"}.`);
  }
}

function validateReviewAudioProbe(probe, label, errors) {
  const stream = list(probe?.streams).find((candidate) => candidate?.codec_type === "audio");
  const sampleRate = Number(stream?.sample_rate);
  const bitDepth = Number(stream?.bits_per_raw_sample || stream?.bits_per_sample);
  const channels = Number(stream?.channels);
  const duration = Number(probe?.format?.duration);
  if (!stream) errors.push(`${label} has no audio stream.`);
  if (sampleRate !== 48_000) errors.push(`${label} must be 48 kHz; ffprobe reported ${sampleRate || "unknown"}.`);
  if (bitDepth !== 24) errors.push(`${label} must be 24-bit; ffprobe reported ${bitDepth || "unknown"}.`);
  if (channels !== 2) errors.push(`${label} must be stereo; ffprobe reported ${channels || "unknown"} channels.`);
  if (!Number.isFinite(duration) || Math.abs(duration - VOYAGE_PRODUCTION_SECONDS) > 1 / VOYAGE_PRODUCTION_FPS) {
    errors.push(`${label} must be ${VOYAGE_PRODUCTION_SECONDS} seconds within one frame; ffprobe reported ${duration || "unknown"}.`);
  }
}

function validateReviewFrameProbe(probe, extension, label, errors) {
  if (probe?.decodedFrames !== VOYAGE_PRODUCTION_FRAMES) {
    errors.push(`${label} must decode all ${VOYAGE_PRODUCTION_FRAMES} frames.`);
  }
  const expectedCodec = extension === ".png" ? "png" : "exr";
  const endpoints = [probe?.first, probe?.last];
  const geometries = [];
  for (const [index, endpoint] of endpoints.entries()) {
    const video = list(endpoint?.streams).find((stream) => stream?.codec_type === "video");
    if (video?.codec_name !== expectedCodec || Number(video?.width) <= 0 || Number(video?.height) <= 0) {
      errors.push(`${label} ${index === 0 ? "first" : "last"} frame is not a decodable ${expectedCodec.toUpperCase()} image.`);
      continue;
    }
    geometries.push(`${video.width}x${video.height}`);
  }
  if (geometries.length === 2 && geometries[0] !== geometries[1]) {
    errors.push(`${label} changes dimensions between its first and last frame.`);
  }
}

async function loadReviewAudioGuideBinding({ root, manifest, candidate, verifyAudioGuide, errors }) {
  const binding = candidate?.audioGuideRecord;
  if (!object(binding) || binding.path !== VOYAGE_AUDIO_RECORD_PATH || !validSha256(binding.sha256)) {
    errors.push(`Review candidate must bind ${VOYAGE_AUDIO_RECORD_PATH} and its exact SHA-256.`);
    return null;
  }
  let artifact;
  try { artifact = await fileRecord(root, binding.path); }
  catch (error) {
    errors.push(`Review-master provenance record is unsafe: ${error.message}`);
    return null;
  }
  if (artifact.status !== "present" || artifact.sha256 !== binding.sha256) {
    errors.push("Review audio-guide provenance record is missing, unsafe, or does not match its bound SHA-256.");
    return null;
  }
  let record;
  try { record = JSON.parse(await readFile(await secureExistingProjectPath(root, binding.path, "audio-guide record"), "utf8")); }
  catch (error) { errors.push(`Review audio-guide provenance record is invalid: ${error.message}`); return null; }
  if (record?.schemaVersion !== 1
    || record?.status !== "non-final-guide"
    || record?.releaseEligible !== false
    || record?.createsRightsEvidence !== false
    || record?.contract?.sha256 !== voyageProductionManifestDigest(manifest)
    || record?.voice?.included !== false
    || record?.voice?.status !== "absent") {
    errors.push("Review audio-guide provenance record lost its current, voice-free, non-final boundary.");
  }
  try {
    const verification = await verifyAudioGuide({
      root,
      sourceRoot: dirname(dirname(fileURLToPath(import.meta.url)))
    });
    if (verification?.valid !== true) {
      errors.push(`Review audio-guide verifier failed: ${list(verification?.errors).join("; ") || "unknown error"}.`);
    }
  } catch (error) {
    errors.push(`Review audio-guide verifier failed: ${error.message}`);
  }
  return record;
}

async function loadReviewAudioMasterBinding({ root, manifest, candidate, verifyAudioReview, errors }) {
  const binding = candidate?.audioReviewMasterRecord;
  if (!object(binding)
    || binding.path !== VOYAGE_AUDIO_REVIEW_RECORD_PATH
    || !validSha256(binding.sha256)) {
    errors.push(`Review-master candidate must bind ${VOYAGE_AUDIO_REVIEW_RECORD_PATH} and its exact SHA-256.`);
    return null;
  }
  const artifact = await fileRecord(root, binding.path);
  if (artifact.status !== "present" || artifact.sha256 !== binding.sha256) {
    errors.push("Review-master provenance record is missing, unsafe, or does not match its bound SHA-256.");
    return null;
  }
  let record;
  try {
    record = JSON.parse(await readFile(
      await secureExistingProjectPath(root, binding.path, "audio review-master record"),
      "utf8"
    ));
  } catch (error) {
    errors.push(`Review-master provenance record is invalid: ${error.message}`);
    return null;
  }
  if (record?.schemaVersion !== 1
    || record?.status !== "project-authored-review-master-candidate"
    || record?.releaseEligible !== false
    || record?.finalMaster !== false
    || record?.contract?.sha256 !== voyageProductionManifestDigest(manifest)
    || record?.provenance?.projectAuthored !== true
    || record?.provenance?.generativeModelOutput !== false
    || record?.voice?.included !== false
    || record?.voice?.status !== "absent"
    || record?.reviewBoundary?.reviewOnly !== true
    || record?.reviewBoundary?.mayPopulateFinalCompositorPaths !== false) {
    errors.push("Review-master provenance record lost its project-authored, voice-free, review-only boundary.");
  }
  try {
    const verification = await verifyAudioReview({
      root,
      sourceRoot: dirname(dirname(fileURLToPath(import.meta.url)))
    });
    if (verification?.valid !== true) {
      errors.push(`Review-master verifier failed: ${list(verification?.errors).join("; ") || "unknown error"}.`);
    }
  } catch (error) {
    errors.push(`Review-master verifier failed: ${error.message}`);
  }
  return record;
}

async function loadReviewAudioBinding({
  root,
  manifest,
  candidate,
  verifyAudioGuide,
  verifyAudioReview,
  errors
}) {
  const usesGuide = candidate?.audioGuideRecord !== undefined && candidate?.audioGuideRecord !== null;
  const usesReviewMaster = candidate?.audioReviewMasterRecord !== undefined
    && candidate?.audioReviewMasterRecord !== null;
  if (usesGuide === usesReviewMaster) {
    errors.push("Review candidate must bind exactly one audio provenance record: guide or review master.");
    return Object.freeze({ kind: null, record: null, binding: null });
  }
  if (usesReviewMaster) {
    return Object.freeze({
      kind: "review-master",
      record: await loadReviewAudioMasterBinding({ root, manifest, candidate, verifyAudioReview, errors }),
      binding: candidate.audioReviewMasterRecord
    });
  }
  return Object.freeze({
    kind: "guide",
    record: await loadReviewAudioGuideBinding({ root, manifest, candidate, verifyAudioGuide, errors }),
    binding: candidate.audioGuideRecord
  });
}

async function loadReviewLookdevBinding({ root, manifest, candidate, verifyLookdev, errors }) {
  errors.push(...validateReviewAiDeclaration(candidate));
  if (candidate?.aiLayersEnabled !== true) return null;
  const provenance = candidate.lookdevProvenance;
  const binding = provenance?.manifest;
  if (!object(provenance) || !object(binding)) return null;

  let manifestArtifact;
  try { manifestArtifact = await fileRecord(root, binding.path); }
  catch (error) {
    errors.push(`Review look-development manifest is unsafe: ${error.message}`);
    return null;
  }
  if (manifestArtifact.status !== "present" || manifestArtifact.sha256 !== binding.sha256) {
    errors.push("Review look-development manifest is missing, unsafe, or does not match its bound SHA-256.");
    return null;
  }
  let lookdevManifest;
  let manifestPath;
  try {
    manifestPath = await secureExistingProjectPath(root, binding.path, "review look-development manifest");
    lookdevManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    errors.push(`Review look-development manifest is invalid: ${error.message}`);
    return null;
  }
  if (lookdevManifest?.schemaVersion !== 1
    || lookdevManifest?.status !== "non-shipping-look-development"
    || lookdevManifest?.releaseEligible !== false
    || lookdevManifest?.contractSha256 !== voyageProductionManifestDigest(manifest)) {
    errors.push("Review look-development manifest lost its current non-shipping contract boundary.");
  }
  try {
    const verification = await verifyLookdev({ root, manifestPath });
    if (verification?.valid !== true) {
      errors.push(`Review look-development verifier failed: ${list(verification?.errors).join("; ") || "unknown error"}.`);
    }
  } catch (error) {
    errors.push(`Review look-development verifier failed: ${error.message}`);
  }

  const expectedAssets = list(lookdevManifest?.assets);
  const declaredAssets = list(provenance.assets);
  const expectedIds = expectedAssets.map((asset) => asset?.id).sort();
  const declaredIds = declaredAssets.map((asset) => asset?.id).sort();
  if (expectedAssets.length < 1
    || JSON.stringify(expectedIds) !== JSON.stringify(declaredIds)
    || new Set(declaredIds).size !== declaredIds.length) {
    errors.push("Review look-development provenance must bind every verified manifest asset exactly once.");
  }
  const declaredById = new Map(declaredAssets.map((asset) => [asset?.id, asset]));
  for (const expected of expectedAssets) {
    const declared = declaredById.get(expected?.id);
    const label = `Review look-development asset ${expected?.id || "<unknown>"}`;
    if (!declared
      || declared.path !== expected.path
      || declared.sha256 !== expected.sha256
      || declared.compositionMode !== "underlay") {
      errors.push(`${label} does not exactly match the verified manifest or underlay composition mode.`);
      continue;
    }
    let actual;
    try { actual = await fileRecord(root, declared.path); }
    catch (error) { errors.push(`${label} path is invalid: ${error.message}`); continue; }
    if (actual.status !== "present" || actual.sha256 !== declared.sha256) {
      errors.push(`${label} is missing, unsafe, or does not match its bound SHA-256.`);
    }
  }
  return Object.freeze({
    reviewOnly: true,
    compositionMode: "underlay",
    manifest: Object.freeze({ path: binding.path, sha256: binding.sha256 }),
    assets: Object.freeze(declaredAssets.map((asset) => Object.freeze({
      id: asset.id,
      path: asset.path,
      sha256: asset.sha256,
      compositionMode: asset.compositionMode
    })))
  });
}

/**
 * Review candidates intentionally bypass final approvals while retaining
 * technical completeness. They accept only clean authored timelines and
 * voice-free project-owned guide audio, and emit output/-only watermarked plans.
 */
export async function preflightVoyageReviewCandidate({
  root,
  manifest,
  candidate,
  probeAudio = defaultProbeAudio,
  inspectSequence = inspectVoyageFrameSequence,
  probeFrameSequence = defaultProbeReviewFrameSequence,
  verifyAudioGuide = verifyVoyageProjectionAudio,
  verifyAudioReview = verifyVoyageProjectionAudioReview,
  verifyLookdev = validateVoyageLookdev
}) {
  const errors = [];
  const sequences = {};
  const audioRecords = {};
  const digest = voyageProductionManifestDigest(manifest);
  if (!object(candidate) || candidate.schemaVersion !== 1 || candidate.kind !== "voyage-review-candidate") {
    errors.push("Review candidate must use schemaVersion 1 and kind voyage-review-candidate.");
  }
  if (candidate?.contractSha256 !== digest) errors.push("Review candidate does not match the current production contract digest.");
  if (!validReviewCandidateId(candidate?.candidateId)) {
    errors.push("Review candidateId must be a lowercase kebab-case identifier no longer than 64 characters.");
  }
  if (candidate?.releaseEligible !== false || candidate?.shipping !== false) {
    errors.push("Review candidate must explicitly remain non-shipping and releaseEligible false.");
  }
  if (candidate?.cleanAuthored3d !== true) {
    errors.push("Review candidate requires an authoritative clean authored-3D base timeline.");
  }
  if (candidate?.durationSeconds !== VOYAGE_PRODUCTION_SECONDS
    || candidate?.frameCount !== VOYAGE_PRODUCTION_FRAMES
    || candidate?.fps !== VOYAGE_PRODUCTION_FPS) {
    errors.push("Review candidate must lock 57 seconds, 1368 frames, and 24 fps.");
  }

  const variants = candidate?.variants;
  const variantKeys = object(variants) ? Object.keys(variants).sort() : [];
  if (JSON.stringify(variantKeys) !== JSON.stringify(["completion", "promise"])) {
    errors.push("Review candidate must contain exactly Promise and Completion timelines.");
  }
  const lookdevProvenance = await loadReviewLookdevBinding({
    root,
    manifest,
    candidate,
    verifyLookdev,
    errors
  });
  const audioBinding = await loadReviewAudioBinding({
    root,
    manifest,
    candidate,
    verifyAudioGuide,
    verifyAudioReview,
    errors
  });
  const boundAudioOutputs = new Map(list(audioBinding.record?.outputs).map((output) => [output.path, output]));
  const finalAudioPaths = new Set(FINAL_VARIANTS.map((variant) => variant.audioPath));
  for (const variant of FINAL_VARIANTS) {
    const record = variants?.[variant.id];
    if (!object(record)) {
      errors.push(`Review candidate is missing ${variant.id}.`);
      continue;
    }
    if (record.authoredTimeline !== true) errors.push(`${variant.id} review timeline must be explicitly authored.`);
    if (!isReviewFramePattern(record.framePattern)) {
      errors.push(`${variant.id} review framePattern must be a PNG or EXR sequence under output/voyage-projection/.`);
    } else {
      const extension = normalizedProjectPath(record.framePattern).endsWith(".png") ? ".png" : ".exr";
      if (extension === ".exr") {
        const color = record.exrColor;
        if (!object(color)
          || color.sourceColorSpace !== "ACEScg"
          || color.viewTransformApplied !== true
          || !String(color.viewTransform || "").trim()
          || color.deliveryColorSpace !== "Rec.709 Gamma 2.4") {
          errors.push(`${variant.id} EXR review timeline requires an applied, named ACEScg to Rec.709 Gamma 2.4 view transform.`);
        }
        await validateEvidenceFile(root, color?.evidence, `${variant.id} EXR view transform`, errors);
      }
      try {
        await secureExistingProjectPath(root, framePath(record.framePattern, 0), `${variant.id} review frame`);
        const report = await inspectSequence({
          root,
          pattern: record.framePattern,
          startFrame: 0,
          endFrameExclusive: VOYAGE_PRODUCTION_FRAMES
        });
        sequences[variant.id] = report;
        if (!report.complete || report.presentFrames !== VOYAGE_PRODUCTION_FRAMES) {
          errors.push(`${variant.id} authored review timeline is incomplete (${report.presentFrames}/${VOYAGE_PRODUCTION_FRAMES}).`);
        }
        validateReviewFrameProbe(
          await probeFrameSequence({ root, pattern: record.framePattern, variant: variant.id, extension }),
          extension,
          `${variant.id} authored review timeline`,
          errors
        );
      } catch (error) {
        errors.push(`${variant.id} authored review timeline could not be decoded and inspected: ${error.message}`);
      }
    }

    const audioSources = list(record.audio);
    audioRecords[variant.id] = [];
    if (!audioSources.length) errors.push(`${variant.id} review candidate requires voice-free project-owned audio.`);
    if (audioBinding.kind === "review-master" && audioSources.length !== 1) {
      errors.push(`${variant.id} review-master candidate must use exactly one verified variant WAV.`);
    }
    const seenAudioPaths = new Set();
    for (const [index, audio] of audioSources.entries()) {
      const label = `${variant.id} review audio[${index}]`;
      if (!isOutputReviewPath(audio?.path, "output/voyage-projection/audio/")
        || finalAudioPaths.has(audio?.path)) {
        errors.push(`${label} must be a non-final guide under output/voyage-projection/audio/.`);
        continue;
      }
      if (seenAudioPaths.has(audio.path)) {
        errors.push(`${label} duplicates ${audio.path}.`);
        continue;
      }
      seenAudioPaths.add(audio.path);
      if (!validSha256(audio.sha256)) {
        errors.push(`${label} must bind its exact SHA-256.`);
        continue;
      }
      const boundOutput = boundAudioOutputs.get(audio.path);
      if (audioBinding.kind === "review-master") {
        if (!boundOutput
          || boundOutput.sha256 !== audio.sha256
          || boundOutput.variant !== variant.id
          || boundOutput.status !== "voice-free-review-master-candidate"
          || boundOutput.reviewOnly !== true
          || boundOutput.finalMaster !== false
          || boundOutput.releaseEligible !== false
          || boundOutput.voiceIncluded !== false) {
          errors.push(`${label} is not the exact ${variant.id} WAV in the verified review-master provenance record.`);
          continue;
        }
      } else if (!boundOutput
        || boundOutput.sha256 !== audio.sha256
        || boundOutput.guideOnly !== true
        || boundOutput.voiceIncluded !== false
        || !list(boundOutput.variants).includes(variant.id)) {
        errors.push(`${label} is not bound to an approved variant entry in the verified audio-guide provenance record.`);
        continue;
      }
      let file;
      try { file = await fileRecord(root, audio.path); }
      catch (error) { errors.push(`${label} path is invalid: ${error.message}`); continue; }
      audioRecords[variant.id].push(file);
      if (file.status !== "present") {
        errors.push(`${label} is ${file.status}.`);
        continue;
      }
      if (file.sha256 !== audio.sha256) errors.push(`${label} SHA-256 does not match its file.`);
      try {
        validateReviewAudioProbe(
          await probeAudio(await secureExistingProjectPath(root, audio.path, label), { variant: variant.id, index, audio }),
          label,
          errors
        );
      } catch (error) {
        errors.push(`${label} could not be verified: ${error.message}`);
      }
    }
  }

  let plans = [];
  if (errors.length === 0) {
    try { plans = buildVoyageReviewCandidateCommandPlans(manifest, candidate); }
    catch (error) { errors.push(`Review encode plans could not be built: ${error.message}`); }
  }
  return Object.freeze({
    mode: "nonshipping-review-candidate",
    ready: errors.length === 0,
    releaseEligible: false,
    shipping: false,
    errors: Object.freeze(errors),
    candidateId: candidate?.candidateId || null,
    contractSha256: digest,
    exactFrames: VOYAGE_PRODUCTION_FRAMES,
    sequences: Object.freeze(sequences),
    audioRecords: Object.freeze(audioRecords),
    audioProvenance: Object.freeze({
      kind: audioBinding.kind,
      path: audioBinding.binding?.path || null,
      sha256: audioBinding.binding?.sha256 || null
    }),
    aiLayersEnabled: candidate?.aiLayersEnabled === true,
    lookdevProvenance,
    plans: Object.freeze(plans),
    confirmationRequired: REVIEW_CANDIDATE_CONFIRMATION
  });
}

/**
 * Validate final encode prerequisites against real timeline-frame and audio
 * files. The sidecar is intentionally absent until real production evidence is
 * supplied; this function never infers approval from media presence.
 */
export async function preflightVoyageEncodes({
  root,
  manifest,
  prerequisites,
  probeAudio = defaultProbeAudio,
  inspectSequence = inspectVoyageFrameSequence
}) {
  const errors = [];
  const digest = voyageProductionManifestDigest(manifest);
  const plans = buildVoyageEncodeCommandPlans(manifest);
  const sequences = {};
  for (const variant of FINAL_VARIANTS) {
    const pattern = `output/voyage-projection/composites/${variant.id}/timeline/frame-%04d.exr`;
    const report = await inspectSequence({
      root,
      pattern,
      startFrame: 0,
      endFrameExclusive: VOYAGE_PRODUCTION_FRAMES
    });
    sequences[variant.id] = report;
    if (!report.complete) errors.push(`${variant.id} graded timeline is incomplete (${report.presentFrames}/${VOYAGE_PRODUCTION_FRAMES}).`);
  }

  if (!object(prerequisites)) {
    errors.push(`Final encode prerequisite evidence is missing (${DEFAULT_ENCODE_PREREQUISITES}).`);
  } else {
    if (prerequisites.schemaVersion !== 1 || prerequisites.contractSha256 !== digest) {
      errors.push("Final encode prerequisites must identify the current production contract digest.");
    }
    if (prerequisites.status !== "approved") errors.push("Final encode prerequisites are not approved.");
    if (prerequisites.cleanAuthored3d !== true || prerequisites.aiLayersEnabled !== false) {
      errors.push("This executor accepts only clean authored-3D composites with every AI layer disabled.");
    }

    const color = prerequisites.color;
    if (!object(color)
      || color.sourceColorSpace !== "ACEScg"
      || color.deliveryColorSpace !== "Rec.709 Gamma 2.4"
      || color.transformApplied !== true
      || !String(color.transformName || "").trim()
      || !String(color.tool || "").trim()
      || !String(color.toolVersion || "").trim()
      || !approvalPresent(color.humanApproval)) {
      errors.push("Color prerequisites must prove an approved ACEScg to Rec.709 Gamma 2.4 transform with named tool/version.");
    }
    await validateEvidenceFile(root, color?.evidence, "Color transform", errors);

    for (const id of REQUIRED_PROVENANCE) {
      const record = prerequisites.provenance?.[id];
      if (!object(record) || record.status !== "documented" || record.commercialUseDocumented !== true) {
        errors.push(`Provenance ${id} is not documented for commercial use.`);
        continue;
      }
      const evidence = list(record.evidence);
      if (!evidence.length) errors.push(`Provenance ${id} has no evidence artifacts.`);
      for (const [index, artifact] of evidence.entries()) {
        await validateEvidenceFile(root, artifact, `Provenance ${id}[${index}]`, errors);
      }
    }
    for (const approval of REQUIRED_APPROVALS) {
      if (!approvalPresent(prerequisites.approvals?.[approval])) errors.push(`Final encode is missing ${approval} approval.`);
    }

    for (const variant of FINAL_VARIANTS) {
      const expectedSequence = sequences[variant.id];
      const composite = prerequisites.composites?.[variant.id];
      if (!object(composite)
        || composite.pattern !== expectedSequence.pattern
        || composite.frames !== VOYAGE_PRODUCTION_FRAMES
        || composite.aggregateSha256 !== expectedSequence.aggregateSha256
        || composite.colorSpace !== "Rec.709 Gamma 2.4") {
        errors.push(`${variant.id} composite evidence does not match the complete graded timeline.`);
      }

      const audio = prerequisites.audio?.[variant.id];
      if (!object(audio)
        || audio.path !== variant.audioPath
        || !validSha256(audio.sha256)
        || audio.sampleRateHz !== 48_000
        || audio.bitDepth !== 24
        || audio.durationFrames !== VOYAGE_PRODUCTION_FRAMES
        || !Number.isFinite(Number(audio.truePeakDbfs))
        || Number(audio.truePeakDbfs) > -1
        || audio.mastered !== true) {
        errors.push(`${variant.id} audio evidence must bind a 57-second 48 kHz/24-bit master with true peak at or below -1 dBFS.`);
        continue;
      }
      let audioRecord;
      try { audioRecord = await fileRecord(root, audio.path); }
      catch (error) { errors.push(`${variant.id} audio path is invalid: ${error.message}`); continue; }
      if (audioRecord.status !== "present") {
        errors.push(`${variant.id} mastered audio is ${audioRecord.status}.`);
        continue;
      }
      if (audioRecord.sha256 !== audio.sha256) errors.push(`${variant.id} mastered audio SHA-256 does not match its file.`);
      try {
        validateAudioProbe(await probeAudio(pathInsideRoot(root, audio.path, `${variant.id} audio`)), `${variant.id} mastered audio`, errors);
      } catch (error) {
        errors.push(`${variant.id} mastered audio could not be verified: ${error.message}`);
      }
    }
  }

  return Object.freeze({
    ready: errors.length === 0,
    errors: Object.freeze(errors),
    contractSha256: digest,
    exactFrames: VOYAGE_PRODUCTION_FRAMES,
    sequences: Object.freeze(sequences),
    plans,
    confirmationRequired: FINAL_ENCODE_CONFIRMATION
  });
}

async function copyIdentityOperation(root, operation) {
  const source = pathInsideRoot(root, operation.source, "composite source");
  const destination = pathInsideRoot(root, operation.destination, "composite destination");
  await mkdir(dirname(destination), { recursive: true });
  try {
    const existing = await fileRecord(root, operation.destination);
    if (existing.status === "present") {
      const sourceRecord = await fileRecord(root, operation.source);
      if (sourceRecord.status === "present" && sourceRecord.sha256 === existing.sha256) return "already-identical";
      throw new Error(`Refusing to replace non-identical composite output ${operation.destination}.`);
    }
  } catch (error) {
    if (!String(error.message).startsWith("Refusing")) throw error;
    throw error;
  }
  await copyFile(source, destination, fsConstants.COPYFILE_EXCL);
  return "copied";
}

export async function executeCleanComposite(preflight, {
  root,
  confirmation
}) {
  if (confirmation !== CLEAN_COMPOSITE_CONFIRMATION) {
    throw new Error(`Clean composite execution requires --confirm ${CLEAN_COMPOSITE_CONFIRMATION}.`);
  }
  if (!preflight?.ready) throw new Error(`Clean composite preflight is blocked:\n${list(preflight?.errors).join("\n")}`);
  const counts = { copied: 0, alreadyIdentical: 0 };
  for (const operation of preflight.operations) {
    const result = await copyIdentityOperation(root, operation);
    if (result === "copied") counts.copied += 1;
    else counts.alreadyIdentical += 1;
  }
  return Object.freeze(counts);
}

function executeFile(executable, arguments_, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(executable, arguments_, {
      cwd: options.cwd,
      windowsHide: true,
      maxBuffer: 8_000_000
    }, (error, stdout, stderr) => {
      if (error) rejectPromise(new Error(`${executable} failed: ${String(stderr || error.message).trim()}`));
      else resolvePromise({ stdout, stderr });
    });
  });
}

export async function executeVoyageEncodes(preflight, {
  root,
  confirmation,
  execute = executeFile
}) {
  if (confirmation !== FINAL_ENCODE_CONFIRMATION) {
    throw new Error(`Final encode execution requires --confirm ${FINAL_ENCODE_CONFIRMATION}.`);
  }
  if (!preflight?.ready) throw new Error(`Final encode preflight is blocked:\n${list(preflight?.errors).join("\n")}`);
  const outputs = [];
  for (const plan of preflight.plans) {
    const output = pathInsideRoot(root, plan.output, `${plan.id} output`);
    try {
      const existing = await lstat(output);
      if (existing) throw new Error(`Refusing to overwrite existing final encode ${plan.output}.`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await mkdir(dirname(output), { recursive: true });
    await execute(plan.executable, [...plan.arguments], { cwd: resolve(root) });
    const record = await fileRecord(root, plan.output);
    if (record.status !== "present") throw new Error(`${plan.id} did not produce a non-empty output.`);
    outputs.push({ id: plan.id, ...record });
  }
  return Object.freeze(outputs);
}

function reviewMetadata(preflight, plan) {
  const aiMetadata = preflight?.aiLayersEnabled
    ? ";aiLayersEnabled=true;compositionMode=underlay"
    : ";aiLayersEnabled=false";
  return Object.freeze({
    title: "Constellore Voyage Projection - NON-SHIPPING REVIEW",
    comment: `releaseEligible=false;candidate=${preflight.candidateId};variant=${plan.variantId}${aiMetadata}`
  });
}

function validateReviewOutputProbe(probe, preflight, plan, errors) {
  const videos = list(probe?.streams).filter((stream) => stream?.codec_type === "video");
  const audios = list(probe?.streams).filter((stream) => stream?.codec_type === "audio");
  const video = videos[0];
  const audio = audios[0];
  const metadata = reviewMetadata(preflight, plan);
  if (videos.length !== 1) errors.push(`${plan.id} must contain exactly one video stream.`);
  if (Number(video?.width) !== 1920 || Number(video?.height) !== 1080) {
    errors.push(`${plan.id} must be 1920x1080; probe reported ${video?.width || "unknown"}x${video?.height || "unknown"}.`);
  }
  if (plan.kind === "review-poster") {
    if (video?.codec_name !== "webp") errors.push(`${plan.id} poster must decode as WebP.`);
    if (audios.length !== 0) errors.push(`${plan.id} poster may not contain audio.`);
    const frames = Number(video?.nb_read_frames || video?.nb_frames);
    if (frames !== 1) errors.push(`${plan.id} poster must contain exactly one decoded image.`);
    return;
  }
  if (audios.length !== 1) errors.push(`${plan.id} must contain exactly one audio stream.`);
  const duration = Number(probe?.format?.duration);
  const frames = Number(video?.nb_read_frames || video?.nb_frames);
  const fps = fraction(video?.avg_frame_rate || video?.r_frame_rate);
  if (!Number.isFinite(duration) || Math.abs(duration - VOYAGE_PRODUCTION_SECONDS) > 1 / VOYAGE_PRODUCTION_FPS) {
    errors.push(`${plan.id} must be 57 seconds within one frame.`);
  }
  if (frames !== VOYAGE_PRODUCTION_FRAMES) errors.push(`${plan.id} must contain exactly 1368 decoded video frames.`);
  if (!Number.isFinite(fps) || Math.abs(fps - VOYAGE_PRODUCTION_FPS) > 0.001) errors.push(`${plan.id} must be exactly 24 fps.`);
  if (plan.container === "mp4") {
    if (video?.codec_name !== "h264" || String(video?.profile || "").toLowerCase() !== "high") {
      errors.push(`${plan.id} must use H.264 High.`);
    }
    if (audio?.codec_name !== "aac" || String(audio?.profile || "").toLowerCase() !== "lc") {
      errors.push(`${plan.id} must use AAC-LC.`);
    }
  } else {
    if (video?.codec_name !== "vp9") errors.push(`${plan.id} must use VP9.`);
    if (audio?.codec_name !== "opus") errors.push(`${plan.id} must use Opus.`);
  }
  if (Number(audio?.sample_rate) !== 48_000 || Number(audio?.channels) !== 2) {
    errors.push(`${plan.id} audio must be 48 kHz stereo.`);
  }
  const tags = Object.fromEntries(Object.entries(probe?.format?.tags || {}).map(([key, value]) => [key.toLowerCase(), value]));
  if (tags.title !== metadata.title || tags.comment !== metadata.comment) {
    errors.push(`${plan.id} is missing exact non-shipping review metadata.`);
  }
}

async function validateReviewOutput({ absolute, preflight, plan, probeMedia, decodeMedia }) {
  await decodeMedia(absolute, { preflight, plan });
  const probe = await probeMedia(absolute, { preflight, plan });
  const errors = [];
  validateReviewOutputProbe(probe, preflight, plan, errors);
  if (errors.length) throw new Error(errors.join("\n"));
  return probe;
}

function reviewSidecar(preflight, plan, record, probe) {
  const video = list(probe?.streams).find((stream) => stream?.codec_type === "video");
  return {
    schemaVersion: 1,
    status: "non-shipping-review-artifact",
    releaseEligible: false,
    shipping: false,
    contractSha256: preflight.contractSha256,
    candidateId: preflight.candidateId,
    variant: plan.variantId,
    kind: plan.kind,
    artifact: {
      path: plan.output,
      bytes: record.bytes,
      sha256: record.sha256,
      container: plan.container,
      width: Number(video?.width),
      height: Number(video?.height),
      frames: plan.kind === "review-poster" ? 1 : VOYAGE_PRODUCTION_FRAMES,
      durationSeconds: plan.kind === "review-poster" ? null : VOYAGE_PRODUCTION_SECONDS
    }
  };
}

async function ensureReviewSidecar(root, preflight, plan, record, probe) {
  const sidecarPath = `${plan.output}.review.json`;
  const expected = `${JSON.stringify(reviewSidecar(preflight, plan, record, probe), null, 2)}\n`;
  const existing = await fileRecord(root, sidecarPath);
  if (existing.status === "present") {
    const actual = await readFile(await secureExistingProjectPath(root, sidecarPath, `${plan.id} sidecar`), "utf8");
    if (actual !== expected) throw new Error(`Refusing mismatched review metadata sidecar ${sidecarPath}.`);
    return existing;
  }
  if (existing.status !== "missing") throw new Error(`Review metadata sidecar ${sidecarPath} is ${existing.status}.`);
  const destination = await secureOutputProjectPath(root, sidecarPath, `${plan.id} sidecar`);
  const stagingDirectory = await mkdtemp(resolve(dirname(destination), ".sidecar-staging-"));
  const staged = resolve(stagingDirectory, basename(sidecarPath));
  try {
    await writeFile(staged, expected, { encoding: "utf8", flag: "wx" });
    await promoteReviewArtifact(staged, destination, `${plan.id} sidecar`);
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }
  return fileRecord(root, sidecarPath);
}

async function validateStagedReviewArtifact(staged, stagingDirectory, label) {
  const details = await lstat(staged);
  if (details.isSymbolicLink() || !details.isFile() || details.size <= 0) {
    throw new Error(`${label} did not produce a regular non-empty staged review artifact.`);
  }
  const [realStagingDirectory, realStaged] = await Promise.all([
    realpath(stagingDirectory),
    realpath(staged)
  ]);
  realPathInside(realStagingDirectory, realStaged, `${label} staged review artifact`);
}

async function promoteReviewArtifact(staged, destination, label) {
  try {
    await link(staged, destination);
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`Refusing to overwrite existing ${label}.`);
    throw error;
  }
  await unlink(staged);
}

export async function executeVoyageReviewCandidate(preflight, {
  root,
  confirmation,
  execute = executeFile,
  probeMedia = defaultProbeReviewMedia,
  decodeMedia = defaultDecodeReviewMedia
}) {
  if (confirmation !== REVIEW_CANDIDATE_CONFIRMATION) {
    throw new Error(`Review candidate execution requires --confirm ${REVIEW_CANDIDATE_CONFIRMATION}.`);
  }
  if (!preflight?.ready) {
    throw new Error(`Review candidate preflight is blocked:\n${list(preflight?.errors).join("\n")}`);
  }
  if (preflight.mode !== "nonshipping-review-candidate"
    || preflight.releaseEligible !== false
    || preflight.shipping !== false
    || !validReviewCandidateId(preflight.candidateId)) {
    throw new Error("Review candidate execution requires a valid non-shipping preflight.");
  }
  const outputPrefix = `${VOYAGE_REVIEW_OUTPUT_ROOT}/${preflight.candidateId}/`;
  const outputs = [];
  const boundary = await secureOutputProjectPath(root, `${outputPrefix}.boundary`, "review candidate output");
  const stagingDirectory = await mkdtemp(resolve(dirname(boundary), ".encode-staging-"));
  try {
    for (const plan of preflight.plans) {
      if (plan?.releaseEligible !== false || !isOutputReviewPath(plan?.output, outputPrefix)) {
        throw new Error(`Review plan ${plan?.id || "<unknown>"} attempted to escape the non-shipping output boundary.`);
      }
      const output = await secureOutputProjectPath(root, plan.output, `${plan.id} review output`);
      let record = await fileRecord(root, plan.output);
      let probe;
      if (record.status === "present") {
        probe = await validateReviewOutput({ absolute: output, preflight, plan, probeMedia, decodeMedia });
      } else if (record.status === "missing") {
        const staged = resolve(stagingDirectory, `${plan.id}-${basename(plan.output)}`);
        const arguments_ = [...plan.arguments];
        if (arguments_.at(-1) !== plan.output) throw new Error(`${plan.id} encode plan has a mismatched output argument.`);
        arguments_[arguments_.length - 1] = staged;
        await execute(plan.executable, arguments_, { cwd: resolve(root) });
        try { await validateStagedReviewArtifact(staged, stagingDirectory, plan.id); }
        catch { throw new Error(`${plan.id} did not produce its staged review output.`); }
        probe = await validateReviewOutput({ absolute: staged, preflight, plan, probeMedia, decodeMedia });
        await secureOutputProjectPath(root, plan.output, `${plan.id} review output`);
        await promoteReviewArtifact(staged, output, `${plan.id} review output`);
        record = await fileRecord(root, plan.output);
        if (record.status !== "present") throw new Error(`${plan.id} failed atomic review output promotion.`);
      } else {
        throw new Error(`Review output ${plan.output} is ${record.status}; refusing replacement.`);
      }
      const sidecar = await ensureReviewSidecar(root, preflight, plan, record, probe);
      outputs.push({ id: plan.id, kind: plan.kind, releaseEligible: false, metadataPath: sidecar.path, ...record });
    }
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }
  return Object.freeze({
    releaseEligible: false,
    shipping: false,
    candidateId: preflight.candidateId,
    outputs: Object.freeze(outputs)
  });
}

async function readJsonProjectFile(root, path, { optional = false } = {}) {
  try {
    const absolute = await secureExistingProjectPath(root, path, "JSON input");
    return JSON.parse(await readFile(absolute, "utf8"));
  }
  catch (error) {
    if (optional && error?.code === "ENOENT") return null;
    throw error;
  }
}

function parseArguments(argv) {
  const parsed = {
    root: dirname(dirname(fileURLToPath(import.meta.url))),
    compositor: DEFAULT_COMPOSITOR_MANIFEST,
    prerequisites: DEFAULT_ENCODE_PREREQUISITES,
    reviewCandidate: "",
    json: false,
    executeComposite: false,
    executeEncode: false,
    executeReviewCandidate: false,
    confirmation: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") parsed.root = resolve(argv[++index]);
    else if (argument === "--compositor") parsed.compositor = argv[++index];
    else if (argument === "--prerequisites") parsed.prerequisites = argv[++index];
    else if (argument === "--review-candidate") parsed.reviewCandidate = argv[++index] || "";
    else if (argument === "--json") parsed.json = true;
    else if (argument === "--execute-clean-composite") parsed.executeComposite = true;
    else if (argument === "--execute-encode") parsed.executeEncode = true;
    else if (argument === "--execute-review-candidate") parsed.executeReviewCandidate = true;
    else if (argument === "--confirm") parsed.confirmation = argv[++index] || "";
    else throw new Error(`Unknown argument ${argument}.`);
  }
  if ([parsed.executeComposite, parsed.executeEncode, parsed.executeReviewCandidate].filter(Boolean).length > 1) {
    throw new Error("Run clean composite, final encode, and review candidate encode as separate invocations.");
  }
  if (parsed.executeReviewCandidate && !parsed.reviewCandidate) {
    throw new Error("Review candidate execution requires --review-candidate <project-relative-json>.");
  }
  if (parsed.reviewCandidate && (parsed.executeComposite || parsed.executeEncode)) {
    throw new Error("Review candidate preflight cannot be combined with clean composite or final encode execution.");
  }
  return parsed;
}

export async function runVoyageProductionPreflight({
  root = dirname(dirname(fileURLToPath(import.meta.url))),
  compositorPath = DEFAULT_COMPOSITOR_MANIFEST,
  prerequisitesPath = DEFAULT_ENCODE_PREREQUISITES,
  probeAudio = defaultProbeAudio
} = {}) {
  const manifest = await loadVoyageProductionManifest();
  const compositor = await readJsonProjectFile(root, compositorPath);
  const prerequisites = await readJsonProjectFile(root, prerequisitesPath, { optional: true });
  const composite = await preflightCleanAuthoredComposite({ root, manifest, compositor });
  const encodes = await preflightVoyageEncodes({ root, manifest, prerequisites, probeAudio });
  return Object.freeze({
    schemaVersion: 1,
    dryRun: true,
    contractSha256: voyageProductionManifestDigest(manifest),
    cleanComposite: composite,
    encodes
  });
}

export async function runVoyageReviewCandidatePreflight({
  root = dirname(dirname(fileURLToPath(import.meta.url))),
  candidatePath,
  probeAudio = defaultProbeAudio,
  inspectSequence = inspectVoyageFrameSequence,
  probeFrameSequence = defaultProbeReviewFrameSequence,
  verifyAudioGuide = verifyVoyageProjectionAudio,
  verifyAudioReview = verifyVoyageProjectionAudioReview,
  verifyLookdev = validateVoyageLookdev
} = {}) {
  if (!String(candidatePath || "").trim()) throw new Error("A project-relative review candidate JSON path is required.");
  const manifest = await loadVoyageProductionManifest();
  const candidate = await readJsonProjectFile(root, candidatePath);
  return preflightVoyageReviewCandidate({
    root,
    manifest,
    candidate,
    probeAudio,
    inspectSequence,
    probeFrameSequence,
    verifyAudioGuide,
    verifyAudioReview,
    verifyLookdev
  });
}

function printHumanReport(report) {
  console.log(`Voyage clean-production preflight ${report.contractSha256}`);
  console.log(`Clean composite: ${report.cleanComposite.ready ? "READY" : "BLOCKED"}`);
  for (const error of report.cleanComposite.errors) console.log(`  - ${error}`);
  console.log(`Final encodes: ${report.encodes.ready ? "READY" : "BLOCKED"}`);
  for (const error of report.encodes.errors) console.log(`  - ${error}`);
  console.log("Dry-run FFmpeg plans:");
  for (const plan of report.encodes.plans) {
    console.log(`  ${plan.id}: ${plan.executable} ${plan.arguments.map((value) => JSON.stringify(value)).join(" ")}`);
  }
}

function printReviewCandidateReport(report) {
  console.log(`Voyage non-shipping review candidate ${report.candidateId || "<invalid>"}`);
  console.log(`Contract ${report.contractSha256}`);
  console.log(`Review encodes: ${report.ready ? "READY" : "BLOCKED"}; release eligible: false`);
  console.log(`Audio provenance: ${report.audioProvenance?.kind || "invalid"}; AI underlay: ${report.aiLayersEnabled ? "enabled (review-only)" : "disabled"}`);
  for (const error of report.errors) console.log(`  - ${error}`);
  for (const plan of report.plans) {
    console.log(`  ${plan.id}: ${plan.executable} ${plan.arguments.map((value) => JSON.stringify(value)).join(" ")}`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.reviewCandidate) {
    const review = await runVoyageReviewCandidatePreflight({
      root: options.root,
      candidatePath: options.reviewCandidate
    });
    if (options.executeReviewCandidate) {
      const result = await executeVoyageReviewCandidate(review, {
        root: options.root,
        confirmation: options.confirmation
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (options.json) console.log(JSON.stringify(review, null, 2));
    else printReviewCandidateReport(review);
    if (!review.ready) process.exitCode = 1;
    return;
  }
  const report = await runVoyageProductionPreflight({
    root: options.root,
    compositorPath: options.compositor,
    prerequisitesPath: options.prerequisites
  });
  if (options.executeComposite) {
    const result = await executeCleanComposite(report.cleanComposite, {
      root: options.root,
      confirmation: options.confirmation
    });
    console.log(`Clean composite copied ${result.copied} frames; ${result.alreadyIdentical} were already identical.`);
    return;
  }
  if (options.executeEncode) {
    const outputs = await executeVoyageEncodes(report.encodes, {
      root: options.root,
      confirmation: options.confirmation
    });
    console.log(JSON.stringify({ outputs }, null, 2));
    return;
  }
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else printHumanReport(report);
  if (!report.cleanComposite.ready || !report.encodes.ready) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(`Voyage production preflight failed: ${error.message}`);
    process.exitCode = 1;
  });
}
