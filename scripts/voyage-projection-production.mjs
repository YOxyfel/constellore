import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, normalize, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { assertResponsiveWebpAsset } from "./cosmic-gate-assets.mjs";

export const DEFAULT_VOYAGE_PRODUCTION_MANIFEST = new URL(
  "./voyage-projection-cinematic.v1.json",
  import.meta.url
);

export const DEFAULT_VOYAGE_APPROVED_MEDIA_MANIFEST_PATH =
  "public/cinematic/voyage-projection-media.json";

export const APPROVED_VOYAGE_SHOTS = Object.freeze([
  Object.freeze({ id: "earth", startSeconds: 0, endSeconds: 7, setting: "earth-departure" }),
  Object.freeze({ id: "solar", startSeconds: 7, endSeconds: 20, setting: "solar-system" }),
  Object.freeze({ id: "heliopause", startSeconds: 20, endSeconds: 27, setting: "heliopause" }),
  Object.freeze({ id: "warp", startSeconds: 27, endSeconds: 38, setting: "interstellar-corridor" }),
  Object.freeze({ id: "black-hole", startSeconds: 38, endSeconds: 48, setting: "black-hole-approach" }),
  Object.freeze({ id: "singularity", startSeconds: 48, endSeconds: 53, setting: "event-horizon" }),
  Object.freeze({ id: "return", startSeconds: 53, endSeconds: 57, setting: "earth-return" }),
  Object.freeze({ id: "beyond", startSeconds: 53, endSeconds: 57, setting: "beyond-singularity" })
]);

export const APPROVED_VOYAGE_NARRATION = Object.freeze([
  Object.freeze({
    id: "understanding-makes-reachable",
    startSeconds: 1,
    endSeconds: 6.2,
    shotId: "earth",
    text: "Every world we understand becomes somewhere we can reach.",
    variants: Object.freeze(["promise", "progress", "completion"])
  }),
  Object.freeze({
    id: "discovery-makes-coordinate",
    startSeconds: 8.4,
    endSeconds: 14.2,
    shotId: "solar",
    text: "Every discovery gives the voyage another coordinate.",
    variants: Object.freeze(["promise", "progress", "completion"])
  }),
  Object.freeze({
    id: "map-has-no-word",
    startSeconds: 39.4,
    endSeconds: 46.8,
    shotId: "black-hole",
    text: "Beyond the last light, the map has no word for what comes next.",
    variants: Object.freeze(["promise", "progress", "completion"])
  }),
  Object.freeze({
    id: "make-one",
    startSeconds: 54,
    endSeconds: 56.4,
    shotId: "return",
    text: "So we will make one.",
    variants: Object.freeze(["promise", "progress"])
  })
]);

export const APPROVED_VOYAGE_POSTERS = Object.freeze([
  Object.freeze({ id: "opening", variantId: "promise", shotId: "solar", frame: 168 }),
  Object.freeze({ id: "progress", variantId: "progress", shotId: "black-hole", frame: 912 }),
  Object.freeze({ id: "finale", variantId: "completion", shotId: "beyond", frame: 1272 })
]);

const REQUIRED_VARIANTS = Object.freeze(["promise", "progress", "completion"]);
const REQUIRED_DELIVERY_KINDS = Object.freeze([
  "realtime",
  "pre-render-master",
  "pre-render-web",
  "reduced-motion",
  "poster"
]);
const VALID_COMPOSITE_MODES = new Set(["add", "over", "screen"]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function finite(value) {
  return Number.isFinite(Number(value));
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => [key, canonicalValue(value[key])])
  );
}

export function canonicalizeVoyageProductionManifest(manifest) {
  return `${JSON.stringify(canonicalValue(manifest))}\n`;
}

export function voyageProductionManifestDigest(manifest) {
  return createHash("sha256")
    .update(canonicalizeVoyageProductionManifest(manifest))
    .digest("hex");
}

export async function loadVoyageProductionManifest(path = DEFAULT_VOYAGE_PRODUCTION_MANIFEST) {
  const source = await readFile(path, "utf8");
  return JSON.parse(source);
}

function uniqueById(records, label, errors) {
  const ids = new Set();
  for (const [index, record] of records.entries()) {
    const id = String(record?.id || "").trim();
    if (!id) {
      errors.push(`${label}[${index}] must have a non-empty id.`);
    } else if (ids.has(id)) {
      errors.push(`${label} contains duplicate id ${id}.`);
    } else {
      ids.add(id);
    }
  }
  return ids;
}

function sameMembers(actual, expected) {
  return actual.length === expected.length
    && expected.every((value) => actual.includes(value));
}

function validateApprovedShots(manifest, shotById, errors) {
  for (const approved of APPROVED_VOYAGE_SHOTS) {
    const shot = shotById.get(approved.id);
    if (!shot) {
      errors.push(`Approved shot ${approved.id} is missing.`);
      continue;
    }
    for (const property of ["startSeconds", "endSeconds", "setting"]) {
      if (shot[property] !== approved[property]) {
        errors.push(
          `Shot ${approved.id}.${property} must be ${JSON.stringify(approved[property])}; received ${JSON.stringify(shot[property])}.`
        );
      }
    }
  }

  const variantById = new Map(list(manifest.variants).map((variant) => [variant.id, variant]));
  for (const id of REQUIRED_VARIANTS) {
    const variant = variantById.get(id);
    if (!variant) {
      errors.push(`Required variant ${id} is missing.`);
      continue;
    }
    const shotIds = list(variant.shotIds);
    if (shotIds.length !== 7) errors.push(`Variant ${id} must contain exactly seven authored shots.`);
    let cursor = 0;
    for (const shotId of shotIds) {
      const shot = shotById.get(shotId);
      if (!shot) {
        errors.push(`Variant ${id} references unknown shot ${shotId}.`);
        continue;
      }
      if (shot.startSeconds !== cursor) {
        errors.push(`Variant ${id} has a timeline gap or overlap before ${shotId} at ${cursor}s.`);
      }
      cursor = shot.endSeconds;
      if (list(shot.variants).length && !shot.variants.includes(id)) {
        errors.push(`Variant ${id} uses shot ${shotId}, but that shot does not allow it.`);
      }
    }
    if (cursor !== manifest.durationSeconds) {
      errors.push(`Variant ${id} must end at ${manifest.durationSeconds}s; received ${cursor}s.`);
    }
    const expectedTerminal = id === "completion" ? "beyond" : "return";
    if (shotIds.at(-1) !== expectedTerminal) {
      errors.push(`Variant ${id} must terminate with ${expectedTerminal}.`);
    }
  }
}

function validateNarration(manifest, shotById, errors) {
  const narration = manifest.narration;
  if (!isObject(narration)) {
    errors.push("narration must be an object.");
    return;
  }
  const cueById = new Map(list(narration.cues).map((cue) => [cue.id, cue]));
  for (const approved of APPROVED_VOYAGE_NARRATION) {
    const cue = cueById.get(approved.id);
    if (!cue) {
      errors.push(`Approved narration cue ${approved.id} is missing.`);
      continue;
    }
    for (const property of ["startSeconds", "endSeconds", "shotId", "text"]) {
      if (cue[property] !== approved[property]) {
        errors.push(
          `Narration ${approved.id}.${property} must be ${JSON.stringify(approved[property])}; received ${JSON.stringify(cue[property])}.`
        );
      }
    }
    if (!sameMembers(list(cue.variants), [...approved.variants])) {
      errors.push(`Narration ${approved.id} has unapproved variant coverage.`);
    }
    const shot = shotById.get(cue.shotId);
    if (shot && (cue.startSeconds < shot.startSeconds || cue.endSeconds > shot.endSeconds)) {
      errors.push(`Narration ${approved.id} falls outside shot ${cue.shotId}.`);
    }
  }
  if (cueById.size !== APPROVED_VOYAGE_NARRATION.length) {
    errors.push("Narration must contain only the four approved lines.");
  }
  if (narration.voiceProfile?.id !== "calm-navigation-intelligence") {
    errors.push("Narration must use the approved calm-navigation-intelligence voice profile.");
  }
  if (narration.captionPolicy?.alwaysAvailable !== true
    || narration.captionPolicy?.generatedTextInPicture !== false) {
    errors.push("Narration requires authored captions and prohibits generated in-picture text.");
  }
}

function validateAuthority(manifest, passById, provenanceById, errors) {
  const policy = manifest.authorityPolicy;
  if (!isObject(policy)) {
    errors.push("authorityPolicy must be an object.");
    return;
  }
  if (policy.authoritativeSource !== "authored-3d-scene") {
    errors.push("The authored 3D scene must remain authoritative.");
  }
  if (policy.aiRole !== "isolated-masked-vfx-only") {
    errors.push("AI must be restricted to isolated masked VFX passes.");
  }
  if (policy.protectedPixelDeltaMaximum !== 0) {
    errors.push("Protected authoritative pixels must allow zero AI-induced changes.");
  }

  const protectedElements = list(policy.authoritativeElements);
  const allowedElements = new Set(list(policy.aiAllowedElements));
  for (const required of [
    "camera",
    "rocket",
    "planet-geometry",
    "planet-limbs",
    "orbital-paths",
    "route-spline",
    "occlusion",
    "object-scale",
    "object-timing",
    "physics",
    "typography",
    "narration-timing"
  ]) {
    if (!protectedElements.includes(required)) {
      errors.push(`authorityPolicy.authoritativeElements must protect ${required}.`);
    }
  }

  for (const pass of passById.values()) {
    const aiPass = pass.kind === "ai-assisted-vfx";
    if (!aiPass) {
      if (pass.aiAllowed !== false) errors.push(`Authoritative pass ${pass.id} must explicitly prohibit AI.`);
      continue;
    }
    if (pass.isolated !== true || pass.alphaOutput !== true) {
      errors.push(`AI pass ${pass.id} must be isolated and alpha-bearing.`);
    }
    if (pass.mask?.required !== true) {
      errors.push(`AI pass ${pass.id} must require an authoritative mask.`);
    }
    const mask = passById.get(pass.mask?.sourcePassId);
    if (!mask || mask.kind !== "authoritative-mask" || mask.aiAllowed !== false) {
      errors.push(`AI pass ${pass.id} must reference a non-AI authoritative-mask pass.`);
    }
    if (!VALID_COMPOSITE_MODES.has(pass.compositeMode)) {
      errors.push(`AI pass ${pass.id} has unsupported composite mode ${pass.compositeMode}.`);
    }
    const mayAffect = list(pass.mayAffect);
    if (!mayAffect.length) errors.push(`AI pass ${pass.id} must declare a non-empty mayAffect list.`);
    for (const element of mayAffect) {
      if (!allowedElements.has(element)) errors.push(`AI pass ${pass.id} may not affect protected or undeclared element ${element}.`);
      if (protectedElements.includes(element)) errors.push(`AI pass ${pass.id} overlaps protected element ${element}.`);
    }
    for (const element of protectedElements) {
      if (!list(pass.mustNotAffect).includes(element)) {
        errors.push(`AI pass ${pass.id} must explicitly exclude ${element}.`);
      }
    }
    const provenance = provenanceById.get(pass.provenanceId);
    if (!provenance || provenance.kind !== "ai-vfx-tool") {
      errors.push(`AI pass ${pass.id} must reference AI-tool provenance.`);
    }
  }
}

function validateShotPasses(manifest, shotById, passById, errors) {
  for (const shot of shotById.values()) {
    if (!String(shot.storyBeat || "").trim()) errors.push(`Shot ${shot.id} must declare a storyBeat.`);
    if (!String(shot.cameraIntent || "").trim()) errors.push(`Shot ${shot.id} must declare cameraIntent.`);
    const authoritative = list(shot.authoritativePassIds);
    const ai = list(shot.aiPassIds);
    for (const required of ["beauty-3d", "object-id-3d"]) {
      if (!authoritative.includes(required)) errors.push(`Shot ${shot.id} must include ${required}.`);
    }
    for (const passId of authoritative) {
      const pass = passById.get(passId);
      if (!pass) errors.push(`Shot ${shot.id} references unknown pass ${passId}.`);
      else if (pass.kind === "ai-assisted-vfx") errors.push(`Shot ${shot.id} incorrectly classifies ${passId} as authoritative.`);
    }
    for (const passId of ai) {
      const pass = passById.get(passId);
      if (!pass) errors.push(`Shot ${shot.id} references unknown pass ${passId}.`);
      else if (pass.kind !== "ai-assisted-vfx") errors.push(`Shot ${shot.id} incorrectly classifies ${passId} as AI-assisted.`);
    }
  }
}

function validateDeliverableContract(manifest, errors) {
  const deliverables = list(manifest.deliverables);
  const kinds = new Set(deliverables.map((entry) => entry.kind));
  for (const kind of REQUIRED_DELIVERY_KINDS) {
    if (!kinds.has(kind)) errors.push(`Delivery matrix is missing ${kind}.`);
  }
  const realtime = deliverables.find((entry) => entry.id === "realtime-projection");
  if (!realtime || !sameMembers(list(realtime.variants), REQUIRED_VARIANTS)) {
    errors.push("The realtime projection must support promise, progress, and completion variants.");
  }
  const reduced = deliverables.find((entry) => entry.kind === "reduced-motion");
  if (!reduced || reduced.durationSeconds !== 24 || reduced.transition !== "crossfade-only") {
    errors.push("The reduced-motion projection must be a deterministic 24-second crossfade-only delivery.");
  }
  const posters = deliverables.find((entry) => entry.kind === "poster");
  if (!posters || list(posters.paths).length < 3) {
    errors.push("Poster fallbacks must cover opening, progress, and finale.");
  }
  const posterPolicy = manifest.technical?.posters;
  if (!isObject(posterPolicy)
    || posterPolicy.width !== 1920
    || posterPolicy.height !== 1080
    || posterPolicy.format !== "webp"
    || posterPolicy.maximumBytesEach !== 650_000
    || posterPolicy.maximumBytesCombined !== 1_950_000
    || posterPolicy.source !== "graded-composite") {
    errors.push("Poster fallbacks must use the locked 1920x1080 WebP graded-composite policy and byte ceilings.");
  }
  if (isObject(posterPolicy)) {
    const frames = list(posterPolicy.frames).map(({ id, variantId, shotId, frame }) => ({ id, variantId, shotId, frame }));
    if (JSON.stringify(frames) !== JSON.stringify(APPROVED_VOYAGE_POSTERS)) {
      errors.push("Poster extraction frames must remain opening 168, progress 912, and finale 1272 with their approved variants and shots.");
    }
    if (!String(posterPolicy.evidencePath || "").trim()
      || posterPolicy.evidencePath !== posters?.evidencePath) {
      errors.push("Poster fallbacks must declare one shared graded-master evidence record.");
    }
  }
  if (posters && (list(posters.paths).length !== 3
    || list(posters.paths).some((path) => !String(path).endsWith(".webp")))) {
    errors.push("Poster fallbacks must declare exactly three WebP files.");
  }
  const webPolicy = manifest.technical?.web;
  if (!isObject(webPolicy)
    || webPolicy.width !== 1920
    || webPolicy.height !== 1080
    || webPolicy.primaryCodec !== "h264-high"
    || webPolicy.audioCodec !== "aac-lc"
    || webPolicy.alternateCodec !== "vp9"
    || webPolicy.alternateContainer !== "webm"
    || webPolicy.alternateAudioCodec !== "opus"
    || webPolicy.captions !== "webvtt") {
    errors.push("Web delivery must lock H.264/AAC MP4 plus VP9/Opus WebM at 1920x1080 with WebVTT captions.");
  }
  for (const id of ["opening-web-video", "finale-web-video"]) {
    const web = deliverables.find((entry) => entry.id === id && entry.kind === "pre-render-web");
    if (!web
      || !String(web.path || "").endsWith(".mp4")
      || !String(web.alternatePath || "").endsWith(".webm")) {
      errors.push(`Delivery matrix ${id} must declare MP4 and WebM paths.`);
    }
  }
  for (const id of ["opening-master", "finale-master"]) {
    if (!deliverables.some((entry) => entry.id === id && entry.kind === "pre-render-master")) {
      errors.push(`Delivery matrix is missing ${id}.`);
    }
  }
}

export function validateVoyageProductionManifest(manifest, { release = false } = {}) {
  const errors = [];
  const warnings = [];
  if (!isObject(manifest)) {
    return Object.freeze({ valid: false, errors: Object.freeze(["Manifest must be an object."]), warnings: Object.freeze([]), digest: null });
  }
  if (manifest.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (!/^1[.]\d+[.]\d+$/.test(String(manifest.contractVersion || ""))) {
    errors.push("contractVersion must be a 1.x semantic version.");
  }
  if (manifest.contractId !== "constellore-voyage-projection-cinematic") {
    errors.push("contractId must be constellore-voyage-projection-cinematic.");
  }
  if (manifest.durationSeconds !== 57 || manifest.durationSeconds > manifest.intent?.maximumRuntimeSeconds) {
    errors.push("The projection must remain the approved 57-second, sub-one-minute experience.");
  }
  if (manifest.technical?.timelineFps !== 24 || manifest.technical?.determinism?.randomSeed !== 314159) {
    errors.push("The production timebase must remain 24 fps with deterministic seed 314159.");
  }
  if (manifest.technical?.determinism?.simulationMustBeBaked !== true
    || manifest.technical?.determinism?.cameraCutsOnWholeFrames !== true) {
    errors.push("Simulation must be baked and camera cuts must land on whole frames.");
  }

  const passes = list(manifest.passes);
  const shots = list(manifest.shots);
  const variants = list(manifest.variants);
  const provenance = list(manifest.provenance);
  uniqueById(passes, "passes", errors);
  uniqueById(shots, "shots", errors);
  uniqueById(variants, "variants", errors);
  uniqueById(list(manifest.narration?.cues), "narration.cues", errors);
  uniqueById(list(manifest.deliverables), "deliverables", errors);
  uniqueById(provenance, "provenance", errors);

  const passById = new Map(passes.map((pass) => [pass.id, pass]));
  const shotById = new Map(shots.map((shot) => [shot.id, shot]));
  const provenanceById = new Map(provenance.map((record) => [record.id, record]));

  validateApprovedShots(manifest, shotById, errors);
  validateNarration(manifest, shotById, errors);
  validateAuthority(manifest, passById, provenanceById, errors);
  validateShotPasses(manifest, shotById, passById, errors);
  validateDeliverableContract(manifest, errors);

  if (manifest.qualityGates?.protectedPixelComparison?.maximumChangedPixels !== 0) {
    errors.push("The protected-pixel comparison must permit zero changed pixels.");
  }
  if (manifest.qualityGates?.camera?.aiStabilizationAllowed !== false
    || manifest.qualityGates?.camera?.handheldNoiseAllowed !== false) {
    errors.push("Camera QA must prohibit AI stabilization and handheld noise.");
  }
  for (const gate of ["captionsRequiredWhenNarrationPresent", "skipAlwaysAvailable", "noProgressionMutationOnReplay", "reducedMotionRequired", "posterFallbackRequired"]) {
    if (manifest.qualityGates?.accessibility?.[gate] !== true) errors.push(`Accessibility gate ${gate} must be enabled.`);
  }

  for (const record of provenance) {
    if (!voyageProvenanceRequiredForRelease(manifest, record)) continue;
    const ready = record.status === "documented" && record.commercialUseDocumented === true;
    if (ready) continue;
    const message = `Provenance ${record.id} is pending and must be documented before final media ships.`;
    if (release) errors.push(message);
    else warnings.push(message);
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    digest: voyageProductionManifestDigest(manifest)
  });
}

function safeProjectPath(root, path) {
  const rootPath = resolve(root);
  const candidate = resolve(rootPath, normalize(path));
  const fromRoot = relative(rootPath, candidate);
  if (!fromRoot || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot))) return candidate;
  return null;
}

async function fileExists(path) {
  try {
    const details = await stat(path);
    return details.isFile() && details.size > 0;
  } catch {
    return false;
  }
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/.test(String(value || ""));
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function runtimePublicPath(projectPath) {
  const normalized = String(projectPath || "").replaceAll("\\", "/");
  return normalized.startsWith("public/cinematic/")
    ? `./${normalized.slice("public/cinematic/".length)}`
    : normalized.startsWith("public/") ? `./${normalized.slice("public/".length)}` : normalized;
}

function validApprovalDate(value) {
  const approvedAt = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(approvedAt)
    && Number.isFinite(Date.parse(approvedAt));
}

function auditableHumanApproval(value) {
  return isObject(value)
    && value.approved === true
    && isObject(value.humanApproved)
    && String(value.humanApproved.reviewer || "").trim().length > 0
    && validApprovalDate(value.humanApproved.approvedAt)
    && String(value.humanApproved.evidencePath || "").trim().length > 0;
}

async function validateApprovalEvidence(
  root,
  approval,
  label,
  expectedDigest,
  errors,
  checked
) {
  if (!auditableHumanApproval(approval)) return;
  const evidencePath = String(approval.humanApproved.evidencePath).trim();
  const resolved = safeProjectPath(root, evidencePath);
  checked.push(evidencePath);
  if (!resolved) {
    errors.push(`${label} approval evidence escapes the project root: ${evidencePath}.`);
    return;
  }
  if (!(await fileExists(resolved))) {
    errors.push(`${label} approval evidence is missing or empty: ${evidencePath}.`);
    return;
  }
  let evidence;
  try {
    evidence = JSON.parse(await readFile(resolved, "utf8"));
  } catch (error) {
    errors.push(`${label} approval evidence is not valid JSON: ${error.message}`);
    return;
  }
  if (!isObject(evidence)
    || evidence.schemaVersion !== 1
    || evidence.approved !== true
    || evidence.contractSha256 !== expectedDigest
    || evidence.reviewer !== approval.humanApproved.reviewer
    || evidence.approvedAt !== approval.humanApproved.approvedAt) {
    errors.push(`${label} approval evidence must record schemaVersion 1, an approved decision, the current contract digest, and the matching reviewer and approval time.`);
  }
}

function fraction(value) {
  const source = String(value ?? "").trim();
  if (!source) return Number.NaN;
  const [numerator, denominator] = source.split("/").map(Number);
  if (!Number.isFinite(numerator)) return Number.NaN;
  return denominator === undefined ? numerator : denominator ? numerator / denominator : Number.NaN;
}

function defaultProbeMedia(path) {
  return new Promise((resolveProbe, rejectProbe) => {
    execFile("ffprobe", [
      "-v", "error",
      "-count_frames",
      "-show_entries",
      "format=duration,format_name:stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,nb_read_frames,sample_rate,bits_per_sample,bits_per_raw_sample,channels",
      "-of", "json",
      path
    ], { windowsHide: true, maxBuffer: 2_000_000 }, (error, stdout, stderr) => {
      if (error) {
        rejectProbe(new Error(String(stderr || error.message).trim()));
        return;
      }
      try { resolveProbe(JSON.parse(stdout)); }
      catch (parseError) { rejectProbe(new Error(`ffprobe returned invalid JSON: ${parseError.message}`)); }
    });
  });
}

function validateProbeTimeline(probe, label, errors) {
  const video = list(probe?.streams).find((stream) => stream?.codec_type === "video");
  const duration = Number(probe?.format?.duration);
  const fps = fraction(video?.avg_frame_rate || video?.r_frame_rate);
  const frames = Number(video?.nb_read_frames || video?.nb_frames);
  if (!video) errors.push(`${label} has no video stream.`);
  if (!Number.isFinite(duration) || Math.abs(duration - 57) > 1 / 24) {
    errors.push(`${label} must be 57 seconds within one frame; ffprobe reported ${Number.isFinite(duration) ? duration : "unknown"}.`);
  }
  if (!Number.isFinite(fps) || Math.abs(fps - 24) > 0.001) {
    errors.push(`${label} must be 24 fps; ffprobe reported ${Number.isFinite(fps) ? fps : "unknown"}.`);
  }
  if (frames !== 1368) errors.push(`${label} must contain exactly 1368 video frames; ffprobe reported ${Number.isFinite(frames) ? frames : "unknown"}.`);
  return video;
}

function validateProbeAudio(probe, label, {
  codec,
  sampleRate = 48_000,
  bitDepth = null,
  profile = null
} = {}, errors) {
  const audio = list(probe?.streams).find((stream) => stream?.codec_type === "audio");
  if (!audio) {
    errors.push(`${label} has no audio stream.`);
    return null;
  }
  if (audio.codec_name !== codec) errors.push(`${label} audio must use ${codec}; ffprobe reported ${audio.codec_name || "unknown"}.`);
  if (profile && !String(audio.profile || "").toLocaleLowerCase("en").includes(profile)) {
    errors.push(`${label} audio profile must include ${profile}; ffprobe reported ${audio.profile || "unknown"}.`);
  }
  if (Number(audio.sample_rate) !== sampleRate) {
    errors.push(`${label} audio must be ${sampleRate} Hz; ffprobe reported ${audio.sample_rate || "unknown"}.`);
  }
  if (Number(audio.channels) !== 2) {
    errors.push(`${label} audio must be stereo; ffprobe reported ${audio.channels || "unknown"} channels.`);
  }
  if (bitDepth !== null) {
    const actualDepth = Number(audio.bits_per_raw_sample || audio.bits_per_sample);
    if (actualDepth !== bitDepth) errors.push(`${label} audio must be ${bitDepth}-bit; ffprobe reported ${actualDepth || "unknown"}.`);
  }
  return audio;
}

function validateMediaProbe(probe, kind, label, manifest, errors) {
  const video = validateProbeTimeline(probe, label, errors);
  const web = manifest.technical?.web;
  const master = manifest.technical?.master;
  if (kind === "master") {
    if (video?.codec_name !== "prores" || !String(video?.profile || "").toLocaleLowerCase("en").includes("xq")) {
      errors.push(`${label} video must use ProRes 4444 XQ; ffprobe reported ${video?.codec_name || "unknown"}/${video?.profile || "unknown"}.`);
    }
    if (Number(video?.width) !== master?.width || Number(video?.height) !== master?.height) {
      errors.push(`${label} must be ${master?.width}x${master?.height}; ffprobe reported ${video?.width || "unknown"}x${video?.height || "unknown"}.`);
    }
    validateProbeAudio(probe, label, {
      codec: "pcm_s24le",
      sampleRate: master?.audioSampleRateHz,
      bitDepth: master?.audioBitDepth
    }, errors);
    return;
  }
  if (Number(video?.width) !== web?.width || Number(video?.height) !== web?.height) {
    errors.push(`${label} must be ${web?.width}x${web?.height}; ffprobe reported ${video?.width || "unknown"}x${video?.height || "unknown"}.`);
  }
  if (kind === "mp4") {
    if (video?.codec_name !== "h264" || !String(video?.profile || "").toLocaleLowerCase("en").includes("high")) {
      errors.push(`${label} video must use H.264 High; ffprobe reported ${video?.codec_name || "unknown"}/${video?.profile || "unknown"}.`);
    }
    validateProbeAudio(probe, label, { codec: "aac", profile: "lc" }, errors);
  } else if (kind === "webm") {
    if (video?.codec_name !== "vp9") errors.push(`${label} video must use VP9; ffprobe reported ${video?.codec_name || "unknown"}.`);
    validateProbeAudio(probe, label, { codec: "opus" }, errors);
  }
}

function approvedMediaDefinitions(manifest) {
  const deliverables = list(manifest?.deliverables);
  return [
    { key: "promise", masterId: "opening-master", webId: "opening-web-video" },
    { key: "completion", masterId: "finale-master", webId: "finale-web-video" }
  ].map((definition) => {
    const master = deliverables.find((entry) => entry.id === definition.masterId);
    const web = deliverables.find((entry) => entry.id === definition.webId);
    return {
      key: definition.key,
      paths: {
        master: master?.path,
        mp4: web?.path,
        webm: web?.alternatePath,
        poster: web?.posterPath,
        captions: web?.captionsPath
      },
      manifestPaths: {
        mp4: runtimePublicPath(web?.path),
        webm: runtimePublicPath(web?.alternatePath),
        poster: runtimePublicPath(web?.posterPath),
        captions: runtimePublicPath(web?.captionsPath)
      }
    };
  });
}

/**
 * Validate the public switch that can expose mastered media to players. File
 * presence alone is deliberately insufficient: every path and hash must match
 * the current production contract, both variants require explicit production
 * and human approval, and FFprobe must confirm the locked streams.
 */
export async function validateApprovedVoyageMediaManifest(
  manifest,
  approvedMedia,
  {
    root = dirname(dirname(fileURLToPath(import.meta.url))),
    probeMedia = defaultProbeMedia
  } = {}
) {
  const errors = [];
  const checked = [];
  const expectedDigest = voyageProductionManifestDigest(manifest);
  if (!isObject(approvedMedia) || approvedMedia.schemaVersion !== 2) {
    return Object.freeze({ valid: false, errors: Object.freeze(["Approved Voyage media manifest must use schemaVersion 2."]), checked: Object.freeze([]) });
  }
  if (approvedMedia.contractVersion !== manifest.contractVersion) errors.push("Approved Voyage media manifest does not match the current contract version.");
  if (!auditableHumanApproval(approvedMedia.approval)) {
    errors.push("Approved Voyage media manifest lacks auditable approval and humanApproved evidence.");
  }
  await validateApprovalEvidence(
    root,
    approvedMedia.approval,
    "Approved Voyage media manifest",
    expectedDigest,
    errors,
    checked
  );
  if (approvedMedia.contractSha256 !== expectedDigest) errors.push("Approved Voyage media manifest does not match the current production contract digest.");
  const variants = approvedMedia.variants;
  const variantKeys = isObject(variants) ? Object.keys(variants).sort() : [];
  if (JSON.stringify(variantKeys) !== JSON.stringify(["completion", "promise"])) {
    errors.push("Approved Voyage media manifest must contain exactly Promise and Completion records.");
  }

  for (const definition of approvedMediaDefinitions(manifest)) {
    const record = variants?.[definition.key];
    if (!isObject(record)) {
      errors.push(`Approved Voyage media manifest is missing ${definition.key}.`);
      continue;
    }
    if (!auditableHumanApproval(record.approval)) {
      errors.push(`Approved Voyage media ${definition.key} requires auditable approval and humanApproved evidence.`);
    }
    await validateApprovalEvidence(
      root,
      record.approval,
      `Approved Voyage media ${definition.key}`,
      expectedDigest,
      errors,
      checked
    );
    if (Number(record.durationSeconds) !== 57 || Number(record.frameCount) !== 1368 || Number(record.fps) !== 24) {
      errors.push(`Approved Voyage media ${definition.key} must lock 57 seconds, 1368 frames, and 24 fps.`);
    }

    const hashFields = ["masterSha256", "mp4Sha256", "webmSha256", "posterSha256", "captionsSha256"];
    const finalHashes = hashFields.map((field) => record[field]);
    if (finalHashes.every(validSha256) && new Set(finalHashes).size !== finalHashes.length) {
      errors.push(`Approved Voyage media ${definition.key} final file SHA-256 values must be pairwise distinct.`);
    }

    const masterPath = definition.paths.master;
    const resolvedMaster = safeProjectPath(root, masterPath || "");
    if (!validSha256(record.masterSha256)) {
      errors.push(`Approved Voyage media ${definition.key}.masterSha256 is missing or invalid.`);
    } else if (!resolvedMaster || !(await fileExists(resolvedMaster))) {
      errors.push(`Approved Voyage media ${definition.key}.master file is missing ${masterPath || "<undeclared>"}.`);
    } else {
      checked.push(masterPath);
      const actualHash = await sha256File(resolvedMaster);
      if (record.masterSha256 !== actualHash) {
        errors.push(`Approved Voyage media ${definition.key}.masterSha256 does not match ${masterPath}.`);
      }
      try {
        const probe = await probeMedia(resolvedMaster, {
          variant: definition.key,
          kind: "master",
          path: masterPath
        });
        validateMediaProbe(probe, "master", `${definition.key} master`, manifest, errors);
      } catch (error) {
        errors.push(`Approved Voyage media ${definition.key}.master could not be probed: ${error.message}`);
      }
    }

    for (const field of ["mp4", "webm", "poster", "captions"]) {
      if (record[field] !== definition.manifestPaths[field]) {
        errors.push(`Approved Voyage media ${definition.key}.${field} must exactly match ${definition.manifestPaths[field]}.`);
      }
      const hashField = `${field}Sha256`;
      if (!validSha256(record[hashField])) {
        errors.push(`Approved Voyage media ${definition.key}.${hashField} is missing or invalid.`);
        continue;
      }
      const projectPath = definition.paths[field];
      const resolved = safeProjectPath(root, projectPath || "");
      if (!resolved || !(await fileExists(resolved))) {
        errors.push(`Approved Voyage media ${definition.key}.${field} file is missing ${projectPath || "<undeclared>"}.`);
        continue;
      }
      checked.push(projectPath);
      const actualHash = await sha256File(resolved);
      if (record[hashField] !== actualHash) errors.push(`Approved Voyage media ${definition.key}.${hashField} does not match ${projectPath}.`);
      if (["mp4", "webm"].includes(field)) {
        try {
          const probe = await probeMedia(resolved, {
            variant: definition.key,
            kind: field,
            path: projectPath
          });
          validateMediaProbe(probe, field, `${definition.key} ${field}`, manifest, errors);
        } catch (error) {
          errors.push(`Approved Voyage media ${definition.key}.${field} could not be probed: ${error.message}`);
        }
      }
    }
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), checked: Object.freeze(checked) });
}

/**
 * AI finishing is optional. Merely declaring the isolated passes that could be
 * used later must not make a clean authored-3D master depend on an AI provider.
 * Explicitly enabling a pass restores the provider's normal release gate.
 */
export function voyageProvenanceRequiredForRelease(manifest, record) {
  if (!record || record.releaseBlockedUntilDocumented !== true) return false;
  if (record.kind !== "ai-vfx-tool") return true;
  return list(manifest?.passes).some((pass) => (
    pass?.kind === "ai-assisted-vfx"
    && pass?.provenanceId === record.id
    && pass?.enabled === true
  ));
}

function validatePosterEvidence(manifest, evidence, posterRecords, errors) {
  const policy = manifest.technical?.posters;
  const expectedDigest = voyageProductionManifestDigest(manifest);
  if (!isObject(evidence) || evidence.schemaVersion !== 1 || evidence.contractSha256 !== expectedDigest) {
    errors.push("Poster evidence must identify the current production contract digest.");
    return;
  }
  if (evidence.source !== "graded-composite" || evidence.derivedFromGradedMaster !== true) {
    errors.push("Poster evidence must prove extraction from the final graded composite master.");
  }
  const records = list(evidence.records);
  if (records.length !== APPROVED_VOYAGE_POSTERS.length) {
    errors.push("Poster evidence must contain exactly opening, progress, and finale records.");
    return;
  }
  for (const approved of APPROVED_VOYAGE_POSTERS) {
    const record = records.find((candidate) => candidate?.id === approved.id);
    const poster = posterRecords.find((candidate) => candidate.id === approved.id);
    if (!record
      || record.variantId !== approved.variantId
      || record.shotId !== approved.shotId
      || record.frame !== approved.frame
      || record.path !== poster?.path) {
      errors.push(`Poster evidence ${approved.id} does not match its locked extraction record.`);
      continue;
    }
    if (!validSha256(record.sourceCompositeSha256) || !validSha256(record.posterSha256)) {
      errors.push(`Poster evidence ${approved.id} is missing source-composite or poster SHA-256 evidence.`);
    } else if (record.posterSha256 !== poster.sha256) {
      errors.push(`Poster evidence ${approved.id} does not match the delivered poster SHA-256.`);
    }
    if (record.derivedFromGradedMaster !== true
      || !String(record.sourceCompositePath || "").trim()
      || !String(record.humanApproval?.reviewer || "").trim()
      || !String(record.humanApproval?.approvedAt || "").trim()) {
      errors.push(`Poster evidence ${approved.id} is missing graded-master lineage or human approval.`);
    }
  }
  if (policy?.source !== evidence.source) errors.push("Poster evidence source drifted from the production policy.");
}

export async function validateVoyageProductionDeliverables(
  manifest,
  {
    root = dirname(dirname(fileURLToPath(import.meta.url))),
    includeOptionalMedia = false,
    approvedMediaManifestPath = DEFAULT_VOYAGE_APPROVED_MEDIA_MANIFEST_PATH,
    probeMedia = defaultProbeMedia
  } = {}
) {
  const errors = [];
  const checked = [];
  for (const deliverable of list(manifest?.deliverables)) {
    const shouldCheck = deliverable.requiredFiles === true
      || (includeOptionalMedia && (deliverable.path || deliverable.posterPath || deliverable.captionsPath || deliverable.paths));
    if (!shouldCheck) continue;
    const declaredPaths = [
      ...list(deliverable.entrypoints),
      ...list(deliverable.paths),
      deliverable.path,
      deliverable.alternatePath,
      deliverable.posterPath,
      deliverable.captionsPath,
      deliverable.evidencePath
    ].filter(Boolean);
    if (!declaredPaths.length) {
      errors.push(`Deliverable ${deliverable.id} has no file paths to verify.`);
      continue;
    }
    for (const declaredPath of declaredPaths) {
      const resolved = safeProjectPath(root, declaredPath);
      if (!resolved) {
        errors.push(`Deliverable ${deliverable.id} escapes the project root: ${declaredPath}.`);
        continue;
      }
      checked.push(declaredPath);
      if (!(await fileExists(resolved))) errors.push(`Deliverable ${deliverable.id} is missing ${declaredPath}.`);
    }
  }
  if (includeOptionalMedia) {
    const posters = list(manifest?.deliverables).find((entry) => entry.kind === "poster");
    const policy = manifest?.technical?.posters;
    const posterRecords = [];
    let combinedBytes = 0;
    for (const [index, declaredPath] of list(posters?.paths).entries()) {
      const resolved = safeProjectPath(root, declaredPath);
      if (!resolved || !(await fileExists(resolved))) continue;
      const contents = await readFile(resolved);
      const approved = APPROVED_VOYAGE_POSTERS[index];
      try {
        assertResponsiveWebpAsset(contents, {
          path: declaredPath,
          width: policy?.width,
          height: policy?.height,
          maximumBytes: policy?.maximumBytesEach
        }, declaredPath);
      } catch (error) {
        errors.push(`Deliverable poster ${approved?.id || index} failed validation: ${error.message}`);
      }
      combinedBytes += contents.length;
      posterRecords.push({ id: approved?.id, path: declaredPath, bytes: contents.length, sha256: sha256(contents) });
    }
    if (combinedBytes > Number(policy?.maximumBytesCombined || 0)) {
      errors.push(`Poster fallbacks exceeded their combined byte ceiling (${combinedBytes} bytes).`);
    }
    const evidencePath = safeProjectPath(root, posters?.evidencePath || "");
    if (evidencePath && await fileExists(evidencePath)) {
      try {
        validatePosterEvidence(manifest, JSON.parse(await readFile(evidencePath, "utf8")), posterRecords, errors);
      } catch (error) {
        errors.push(`Poster evidence could not be parsed: ${error.message}`);
      }
    }

    const approvedManifestPath = safeProjectPath(root, approvedMediaManifestPath);
    checked.push(approvedMediaManifestPath);
    if (!approvedManifestPath || !(await fileExists(approvedManifestPath))) {
      errors.push(`Approved Voyage media manifest is missing ${approvedMediaManifestPath}.`);
    } else {
      try {
        const approval = await validateApprovedVoyageMediaManifest(
          manifest,
          JSON.parse(await readFile(approvedManifestPath, "utf8")),
          { root, probeMedia }
        );
        errors.push(...approval.errors);
        checked.push(...approval.checked);
      } catch (error) {
        errors.push(`Approved Voyage media manifest could not be validated: ${error.message}`);
      }
    }
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    checked: Object.freeze(checked)
  });
}

function parseArguments(argv) {
  const options = {
    manifest: DEFAULT_VOYAGE_PRODUCTION_MANIFEST,
    root: dirname(dirname(fileURLToPath(import.meta.url))),
    release: false,
    includeOptionalMedia: false,
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--release") options.release = true;
    else if (argument === "--include-optional-media") options.includeOptionalMedia = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--manifest") options.manifest = resolve(argv[++index]);
    else if (argument === "--root") options.root = resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main(argv) {
  const options = parseArguments(argv);
  const manifest = await loadVoyageProductionManifest(options.manifest);
  const contract = validateVoyageProductionManifest(manifest, { release: options.release });
  const files = await validateVoyageProductionDeliverables(manifest, {
    root: options.root,
    includeOptionalMedia: options.includeOptionalMedia
  });
  const report = {
    valid: contract.valid && files.valid,
    contractVersion: manifest.contractVersion,
    digest: contract.digest,
    errors: [...contract.errors, ...files.errors],
    warnings: [...contract.warnings],
    checkedFiles: [...files.checked]
  };
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Voyage Projection production contract ${report.contractVersion}`);
    console.log(`SHA-256 ${report.digest}`);
    for (const warning of report.warnings) console.warn(`WARN ${warning}`);
    for (const error of report.errors) console.error(`ERROR ${error}`);
    console.log(report.valid ? "PASS deterministic production contract" : "FAIL deterministic production contract");
  }
  if (!report.valid) process.exitCode = 1;
  return report;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
