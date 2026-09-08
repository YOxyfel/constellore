#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  inspectPcm24Wave,
  verifyVoyageProjectionAudio
} from "./verify-voyage-projection-audio.mjs";
import {
  loadVoyageProductionManifest,
  voyageProductionManifestDigest
} from "./voyage-projection-production.mjs";

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_VOYAGE_AUDIO_REVIEW_SOURCE_ROOT = resolve(MODULE_DIRECTORY, "..");
export const VOYAGE_AUDIO_REVIEW_RECORD_PATH =
  "production/voyage-projection/scaffold/provenance/audio-review-master-record.json";
export const VOYAGE_AUDIO_REVIEW_GENERATOR_PATH =
  "scripts/build-voyage-projection-audio-master.py";
const GUIDE_RECORD_PATH =
  "production/voyage-projection/scaffold/provenance/audio-guide-record.json";
const CONTRACT_PATH = "scripts/voyage-projection-cinematic.v1.json";

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const FRAME_COUNT = 2_736_000;
const TARGET_LOUDNESS_LUFS = -18;
const TRUE_PEAK_CEILING_DBTP = -2;
const SUPPORTED_TOOLCHAIN = Object.freeze({
  pythonVersion: "3.14.0",
  pythonImplementation: "CPython",
  numpyVersion: "2.5.0",
  bitGenerator: "PCG64"
});

const K_WEIGHTING_FILTERS = Object.freeze([
  Object.freeze({
    b: Object.freeze([1.53512485958697, -2.69169618940638, 1.19839281085285]),
    a: Object.freeze([1, -1.69065929318241, 0.73248077421585])
  }),
  Object.freeze({
    b: Object.freeze([1, -2, 1]),
    a: Object.freeze([1, -1.99004745483398, 0.99007225036621])
  })
]);

export const EXPECTED_VOYAGE_AUDIO_REVIEW_OUTPUTS = Object.freeze([
  Object.freeze({
    id: "completion-review-master",
    variant: "completion",
    path: "output/voyage-projection/audio/review/voyage-projection-completion-review-master.wav",
    sha256: "ae81025cf2ca7c30e3e5655bf3fbfbe6bf74c625de3aa251f17d225290e6e132",
    stems: Object.freeze(["score-completion", "sfx-completion"]),
    narrationWindows: Object.freeze([[1, 6.2], [8.4, 14.2], [39.4, 46.8]])
  }),
  Object.freeze({
    id: "promise-review-master",
    variant: "promise",
    path: "output/voyage-projection/audio/review/voyage-projection-promise-review-master.wav",
    sha256: "52294ba7bd2ff65c483dfaf421c20d4b7cfaeb495d7c284c3eca4aac8c56590b",
    stems: Object.freeze(["score-unresolved", "sfx-unresolved"]),
    narrationWindows: Object.freeze([[1, 6.2], [8.4, 14.2], [39.4, 46.8], [54, 56.4]])
  })
]);

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function normalizedPath(path) {
  const absolute = resolve(path);
  return process.platform === "win32" ? absolute.toLocaleLowerCase("en-US") : absolute;
}

function isContained(realRoot, candidate) {
  const traversal = relative(realRoot, candidate);
  return traversal === "" || (!traversal.startsWith("..") && !isAbsolute(traversal));
}

async function prepareSafeRoot(root, label) {
  const lexical = resolve(root);
  const parsed = parse(lexical);
  let current = parsed.root;
  const suffix = lexical.slice(parsed.root.length).split(/[\\/]+/u).filter(Boolean);
  for (const component of suffix) {
    current = join(current, component);
    const details = await lstat(current);
    if (details.isSymbolicLink()) throw new Error(`${label} contains a symlink, junction, or reparse point: ${current}`);
    const resolvedComponent = await realpath(current);
    if (normalizedPath(resolvedComponent) !== normalizedPath(current)) {
      throw new Error(`${label} resolves through a symlink, junction, or reparse point: ${current}`);
    }
  }
  const real = await realpath(lexical);
  if (normalizedPath(real) !== normalizedPath(lexical)) {
    throw new Error(`${label} resolves through an untrusted filesystem indirection.`);
  }
  return Object.freeze({ lexical, real });
}

async function safeProjectPath(root, relativePath, { mustExist = true } = {}) {
  const declared = String(relativePath || "");
  if (!declared || isAbsolute(declared) || declared.split(/[\\/]+/u).includes("..")) {
    throw new Error(`Project path must be a contained relative path: ${declared || "<empty>"}`);
  }
  const target = resolve(root.lexical, declared);
  if (!isContained(root.lexical, target)) throw new Error(`Project path escapes its lexical project root: ${declared}`);
  const components = declared.split(/[\\/]+/u).filter(Boolean);
  let current = root.lexical;
  let nearest = root.lexical;
  let missing = false;
  for (const component of components) {
    current = join(current, component);
    if (missing) continue;
    let details;
    try {
      details = await lstat(current);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      missing = true;
      continue;
    }
    if (details.isSymbolicLink()) throw new Error(`Project path contains a symlink, junction, or reparse point: ${current}`);
    const resolvedComponent = await realpath(current);
    if (normalizedPath(resolvedComponent) !== normalizedPath(current)
      || !isContained(root.real, resolvedComponent)) {
      throw new Error(`Project path escapes through a symlink, junction, or reparse point: ${current}`);
    }
    nearest = current;
  }
  const nearestReal = await realpath(nearest);
  if (!isContained(root.real, nearestReal)) throw new Error(`Nearest existing parent escapes the real project root: ${nearest}`);
  if (mustExist && missing) throw new Error(`Required project path does not exist: ${target}`);
  return target;
}

function nearlyEqual(actual, expected, tolerance = 0.000002) {
  return Number.isFinite(Number(actual))
    && Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function locateDataChunk(buffer) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (id === "data") return { offset: dataOffset, size };
    offset = dataOffset + size + (size % 2);
  }
  return null;
}

function signedPcm24(buffer, offset) {
  let value = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
  if (value & 0x800000) value -= 0x1000000;
  return value / 8_388_607;
}

function decodeStereoPcm24(buffer) {
  const data = locateDataChunk(buffer);
  if (!data || data.size !== FRAME_COUNT * 6) throw new Error("Review WAV has no canonical PCM24 data chunk.");
  const left = new Float64Array(FRAME_COUNT);
  const right = new Float64Array(FRAME_COUNT);
  let cursor = data.offset;
  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    left[frame] = signedPcm24(buffer, cursor);
    right[frame] = signedPcm24(buffer, cursor + 3);
    cursor += 6;
  }
  return [left, right];
}

function biquad(samples, { b, a }) {
  const output = new Float64Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const x0 = samples[index];
    const y0 = b[0] * x0 + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    output[index] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return output;
}

function blockMeans(energy, windowSeconds, stepSeconds) {
  const window = Math.round(windowSeconds * SAMPLE_RATE);
  const step = Math.round(stepSeconds * SAMPLE_RATE);
  if (energy.length < window) return [];
  const cumulative = new Float64Array(energy.length + 1);
  for (let index = 0; index < energy.length; index += 1) {
    cumulative[index + 1] = cumulative[index] + energy[index];
  }
  const result = [];
  for (let start = 0; start + window <= energy.length; start += step) {
    result.push((cumulative[start + window] - cumulative[start]) / window);
  }
  return result;
}

function loudnessFromEnergy(energy) {
  return -0.691 + 10 * Math.log10(Math.max(energy, 1e-20));
}

function percentile(sorted, percent) {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * percent;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function measureLoudness(channels) {
  const energy = new Float64Array(FRAME_COUNT);
  for (const channel of channels) {
    let filtered = channel;
    for (const coefficients of K_WEIGHTING_FILTERS) filtered = biquad(filtered, coefficients);
    for (let index = 0; index < FRAME_COUNT; index += 1) energy[index] += filtered[index] * filtered[index];
  }
  const momentaryEnergy = blockMeans(energy, 0.4, 0.1);
  const momentaryLoudness = momentaryEnergy.map(loudnessFromEnergy);
  const absolute = momentaryEnergy.filter((value, index) => momentaryLoudness[index] >= -70);
  let integratedLoudnessLufs = -120;
  if (absolute.length) {
    const ungated = loudnessFromEnergy(absolute.reduce((sum, value) => sum + value, 0) / absolute.length);
    const relativeThreshold = ungated - 10;
    const gated = momentaryEnergy.filter((value, index) => (
      momentaryLoudness[index] >= -70 && momentaryLoudness[index] >= relativeThreshold
    ));
    if (gated.length) integratedLoudnessLufs = loudnessFromEnergy(gated.reduce((sum, value) => sum + value, 0) / gated.length);
  }
  const shortTerm = blockMeans(energy, 3, 1).map(loudnessFromEnergy);
  const lraGate = shortTerm
    .filter((value) => value >= -70 && value >= integratedLoudnessLufs - 20)
    .sort((left, right) => left - right);
  return {
    integratedLoudnessLufs,
    maximumMomentaryLufs: momentaryLoudness.length ? Math.max(...momentaryLoudness) : -120,
    maximumShortTermLufs: shortTerm.length ? Math.max(...shortTerm) : -120,
    loudnessRangeLu: lraGate.length ? percentile(lraGate, 0.95) - percentile(lraGate, 0.1) : 0
  };
}

function cubic(p0, p1, p2, p3, t) {
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
  );
}

function measureTruePeak(channels) {
  let peak = 0;
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) peak = Math.max(peak, Math.abs(channel[index]));
    for (let index = 0; index + 3 < channel.length; index += 1) {
      const p0 = channel[index];
      const p1 = channel[index + 1];
      const p2 = channel[index + 2];
      const p3 = channel[index + 3];
      peak = Math.max(
        peak,
        Math.abs(cubic(p0, p1, p2, p3, 0.25)),
        Math.abs(cubic(p0, p1, p2, p3, 0.5)),
        Math.abs(cubic(p0, p1, p2, p3, 0.75))
      );
    }
  }
  return 20 * Math.log10(Math.max(peak, 1e-12));
}

function dbToGain(decibels) {
  return 10 ** (decibels / 20);
}

function duckGainAt(frame, windows, depthDb) {
  const duck = dbToGain(depthDb);
  const ramp = Math.round(0.28 * SAMPLE_RATE);
  let gain = 1;
  for (const [startSeconds, endSeconds] of windows) {
    const start = Math.round(startSeconds * SAMPLE_RATE);
    const end = Math.round(endSeconds * SAMPLE_RATE);
    if (frame >= start && frame < end) return duck;
    const before = Math.max(0, start - ramp);
    if (frame >= before && frame < start) {
      const phase = (frame - before) / (start - before);
      gain = Math.min(gain, 1 + (duck - 1) * (0.5 - 0.5 * Math.cos(Math.PI * phase)));
    }
    const after = Math.min(FRAME_COUNT, end + ramp);
    if (frame >= end && frame < after) {
      const phase = (frame - end) / (after - end);
      gain = Math.min(gain, duck + (1 - duck) * (0.5 - 0.5 * Math.cos(Math.PI * phase)));
    }
  }
  return gain;
}

function reconstructNormalizationGain(scoreChannels, sfxChannels, expected) {
  const left = new Float64Array(FRAME_COUNT);
  const right = new Float64Array(FRAME_COUNT);
  const scoreGain = dbToGain(-0.5);
  const sfxGain = dbToGain(-1.5);
  const sideScale = 0.92;
  const drive = 1.035;
  const driveScale = Math.tanh(drive);
  const fadeFrames = Math.round(0.08 * SAMPLE_RATE);
  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    const scoreDuck = duckGainAt(frame, expected.narrationWindows, -2.2);
    const sfxDuck = duckGainAt(frame, expected.narrationWindows, -1.2);
    const mixedLeft = scoreChannels[0][frame] * scoreGain * scoreDuck
      + sfxChannels[0][frame] * sfxGain * sfxDuck;
    const mixedRight = scoreChannels[1][frame] * scoreGain * scoreDuck
      + sfxChannels[1][frame] * sfxGain * sfxDuck;
    const middle = 0.5 * (mixedLeft + mixedRight);
    const side = 0.5 * (mixedLeft - mixedRight) * sideScale;
    let leftValue = Math.tanh((middle + side) * drive) / driveScale;
    let rightValue = Math.tanh((middle - side) * drive) / driveScale;
    if (frame < fadeFrames) {
      const phase = frame / (fadeFrames - 1);
      const fade = Math.sin(phase * Math.PI / 2) ** 2;
      leftValue *= fade;
      rightValue *= fade;
    } else if (frame >= FRAME_COUNT - fadeFrames) {
      const phase = (FRAME_COUNT - 1 - frame) / (fadeFrames - 1);
      const fade = Math.sin(phase * Math.PI / 2) ** 2;
      leftValue *= fade;
      rightValue *= fade;
    }
    left[frame] = leftValue;
    right[frame] = rightValue;
  }
  const channels = [left, right];
  const loudness = measureLoudness(channels).integratedLoudnessLufs;
  const truePeak = measureTruePeak(channels);
  return Math.max(-12, Math.min(12, Math.min(
    TARGET_LOUDNESS_LUFS - loudness,
    TRUE_PEAK_CEILING_DBTP - truePeak
  )));
}

export function measureVoyageReviewMaster(buffer) {
  const inspection = inspectPcm24Wave(buffer);
  if (inspection.errors?.length) return { errors: inspection.errors };
  const channels = decodeStereoPcm24(buffer);
  return {
    errors: [],
    ...inspection,
    truePeakDbtp: measureTruePeak(channels),
    ...measureLoudness(channels)
  };
}

function validateReviewBoundary(record, contractDigest, generatorDigest, guideDigest, errors) {
  if (record?.schemaVersion !== 1) errors.push("Review-master record schemaVersion must be 1.");
  if (record?.status !== "project-authored-review-master-candidate") errors.push("Review-master record has the wrong status.");
  if (record?.releaseEligible !== false || record?.finalMaster !== false) errors.push("Review masters must remain non-final and release-ineligible.");
  if (record?.contract?.path !== CONTRACT_PATH || record?.contract?.sha256 !== contractDigest) errors.push("Review-master contract lineage is stale.");
  if (record?.generator?.path !== VOYAGE_AUDIO_REVIEW_GENERATOR_PATH
    || record?.generator?.sha256 !== generatorDigest
    || record?.generator?.seed !== 271_828
    || record?.generator?.deterministic !== true) {
    errors.push("Review-master generator lineage is stale or incomplete.");
  }
  if (record?.sourceGuideRecord?.path !== GUIDE_RECORD_PATH || record?.sourceGuideRecord?.sha256 !== guideDigest) {
    errors.push("Review-master source guide provenance is stale.");
  }
  const toolchain = record?.toolchain;
  for (const [property, expected] of Object.entries(SUPPORTED_TOOLCHAIN)) {
    if (toolchain?.[property] !== expected) errors.push(`Review-master toolchain.${property} must be ${expected}.`);
  }
  if (toolchain?.knownOutputSha256Locked !== true
    || toolchain?.unsupportedEnvironmentPolicy !== "reject-before-read-or-write") {
    errors.push("Review-master toolchain must lock known hashes and reject unsupported environments.");
  }
  const provenance = record?.provenance;
  if (provenance?.projectAuthored !== true
    || provenance?.thirdPartySamples !== false
    || provenance?.generativeModelOutput !== false
    || provenance?.externalPerformerMaterial !== false
    || !String(provenance?.ownershipBasis || "").includes("project-authored")) {
    errors.push("Review-master project-authored provenance is incomplete.");
  }
  const voice = record?.voice;
  if (voice?.included !== false
    || voice?.navigationVoiceComplete !== false
    || voice?.status !== "absent"
    || voice?.performer !== null
    || voice?.provider !== null
    || voice?.rightsEvidence !== null) {
    errors.push("Review masters must not claim narration, performers, providers, or voice rights.");
  }
  const boundary = record?.reviewBoundary;
  if (boundary?.reviewOnly !== true
    || boundary?.humanApprovalRequired !== true
    || boundary?.humanApproval !== null
    || boundary?.mayPopulateFinalCompositorPaths !== false
    || boundary?.mayMutateRuntimeMediaApproval !== false) {
    errors.push("Review-master human-approval and final-media boundary is invalid.");
  }
}

export async function verifyVoyageProjectionAudioReview({
  root = DEFAULT_VOYAGE_AUDIO_REVIEW_SOURCE_ROOT,
  sourceRoot = DEFAULT_VOYAGE_AUDIO_REVIEW_SOURCE_ROOT
} = {}) {
  const artifactRoot = resolve(root);
  const canonicalSourceRoot = resolve(sourceRoot);
  const errors = [];
  const warnings = [
    "Voice is absent. Passing this verifier does not approve a final mix or satisfy navigation-voice provenance."
  ];
  const checked = { root: artifactRoot, sourceRoot: canonicalSourceRoot, outputCount: 0 };

  let record;
  let guideRecord;
  let contract;
  let generatorBuffer;
  let guideBuffer;
  let safeArtifactRoot;
  let safeSourceRoot;
  try {
    [safeArtifactRoot, safeSourceRoot] = await Promise.all([
      prepareSafeRoot(artifactRoot, "artifact root"),
      prepareSafeRoot(canonicalSourceRoot, "source root")
    ]);
    const recordPath = await safeProjectPath(safeArtifactRoot, VOYAGE_AUDIO_REVIEW_RECORD_PATH);
    const guidePath = await safeProjectPath(safeArtifactRoot, GUIDE_RECORD_PATH);
    const contractPath = await safeProjectPath(safeSourceRoot, CONTRACT_PATH);
    const generatorPath = await safeProjectPath(safeSourceRoot, VOYAGE_AUDIO_REVIEW_GENERATOR_PATH);
    [record, guideRecord, contract, generatorBuffer, guideBuffer] = await Promise.all([
      readFile(recordPath, "utf8").then(JSON.parse),
      readFile(guidePath, "utf8").then(JSON.parse),
      loadVoyageProductionManifest(contractPath),
      readFile(generatorPath),
      readFile(guidePath)
    ]);
    for (const output of guideRecord.outputs || []) {
      await safeProjectPath(safeArtifactRoot, output.path);
    }
  } catch (error) {
    errors.push(`Unable to read Voyage review-master inputs: ${error.message}`);
    return Object.freeze({ valid: false, errors: Object.freeze(errors), warnings: Object.freeze(warnings), checked: Object.freeze(checked) });
  }
  const guideReport = await verifyVoyageProjectionAudio({ root: artifactRoot, sourceRoot: canonicalSourceRoot });
  if (!guideReport.valid) errors.push(...guideReport.errors.map((error) => `Source guide: ${error}`));
  validateReviewBoundary(
    record,
    voyageProductionManifestDigest(contract),
    sha256(generatorBuffer),
    sha256(guideBuffer),
    errors
  );

  const guideById = new Map((guideRecord.outputs || []).map((output) => [output.id, output]));
  const decodedGuideById = new Map();
  for (const [id, guide] of guideById) {
    try {
      const guidePath = await safeProjectPath(safeArtifactRoot, guide.path);
      decodedGuideById.set(id, decodeStereoPcm24(await readFile(guidePath)));
    } catch (error) {
      errors.push(`Unable to inspect source guide ${id}: ${error.message}`);
    }
  }
  const outputs = Array.isArray(record?.outputs) ? record.outputs : [];
  checked.outputCount = outputs.length;
  if (outputs.length !== EXPECTED_VOYAGE_AUDIO_REVIEW_OUTPUTS.length) errors.push("Review record must contain exactly two candidates.");
  const outputById = new Map();
  for (const output of outputs) {
    if (!output?.id || outputById.has(output.id)) errors.push(`Review record contains duplicate or empty output id ${output?.id || "<empty>"}.`);
    else outputById.set(output.id, output);
  }

  for (const expected of EXPECTED_VOYAGE_AUDIO_REVIEW_OUTPUTS) {
    const output = outputById.get(expected.id);
    if (!output) {
      errors.push(`Review record is missing ${expected.id}.`);
      continue;
    }
    if (output.variant !== expected.variant || output.path !== expected.path) errors.push(`${expected.id} has the wrong variant or path.`);
    if (!output.path.startsWith("output/voyage-projection/audio/review/")
      || !output.path.endsWith("-review-master.wav")
      || /voyage-projection-(?:opening|finale)-master[.]wav$/u.test(output.path)) {
      errors.push(`${expected.id} escaped the isolated review-master directory.`);
    }
    if (output.status !== "voice-free-review-master-candidate"
      || output.reviewOnly !== true
      || output.finalMaster !== false
      || output.releaseEligible !== false
      || output.voiceIncluded !== false) {
      errors.push(`${expected.id} has an invalid review or voice boundary.`);
    }
    const sourceStems = Array.isArray(output.sourceStems) ? output.sourceStems : [];
    if (sourceStems.length !== 2 || sourceStems.map((stem) => stem.id).join("|") !== expected.stems.join("|")) {
      errors.push(`${expected.id} has the wrong source-stem lineage.`);
    }
    for (const stem of sourceStems) {
      if (stem.sha256 !== guideById.get(stem.id)?.sha256) errors.push(`${expected.id} source stem ${stem.id} has a stale digest.`);
    }
    if (JSON.stringify(output.mix?.narrationWindows) !== JSON.stringify(expected.narrationWindows)
      || output.mix?.scoreGainDb !== -0.5
      || output.mix?.sfxGainDb !== -1.5
      || output.mix?.scoreNarrationDuckDb !== -2.2
      || output.mix?.sfxNarrationDuckDb !== -1.2) {
      errors.push(`${expected.id} no longer preserves the locked voice-space automation.`);
    }
    if (output.mix?.stereoSideScale !== 0.92) errors.push(`${expected.id} stereoSideScale must remain 0.92.`);
    if (output.mix?.saturationDrive !== 1.035) errors.push(`${expected.id} saturationDrive must remain 1.035.`);
    const analysis = output.analysis;
    if (analysis?.targetIntegratedLoudnessLufs !== TARGET_LOUDNESS_LUFS
      || analysis?.truePeakCeilingDbtp !== TRUE_PEAK_CEILING_DBTP
      || !String(analysis?.truePeakMethod || "").includes("calibrated release metering still required")) {
      errors.push(`${expected.id} analysis target or review disclaimer is invalid.`);
    }
    if (output.format?.container !== "wav"
      || output.format?.codec !== "pcm_s24le"
      || output.format?.sampleRateHz !== SAMPLE_RATE
      || output.format?.channels !== CHANNELS
      || output.format?.bitsPerSample !== 24) {
      errors.push(`${expected.id} format record is invalid.`);
    }

    let buffer;
    try {
      buffer = await readFile(await safeProjectPath(safeArtifactRoot, expected.path));
    } catch (error) {
      errors.push(`Unable to read ${expected.id}: ${error.message}`);
      continue;
    }
    const actualSha256 = sha256(buffer);
    if (output.sha256 !== actualSha256) errors.push(`${expected.id} digest does not match its WAV.`);
    if (actualSha256 !== expected.sha256) errors.push(`${expected.id} does not match the locked supported-toolchain hash.`);
    if (output.bytes !== buffer.length) errors.push(`${expected.id} byte count is stale.`);
    const measured = measureVoyageReviewMaster(buffer);
    for (const error of measured.errors || []) errors.push(`${expected.id}: ${error}`);
    if (measured.errors?.length) continue;
    if (measured.frames !== FRAME_COUNT || !nearlyEqual(measured.durationSeconds, 57)) errors.push(`${expected.id} must remain exactly 57 seconds.`);
    if (output.frames !== measured.frames) errors.push(`${expected.id} provenance frames do not match the WAV.`);
    if (output.dataBytes !== measured.dataBytes) errors.push(`${expected.id} provenance dataBytes do not match the WAV.`);
    if (!nearlyEqual(output.durationSeconds, measured.durationSeconds)) errors.push(`${expected.id} provenance durationSeconds does not match the WAV.`);
    if (!nearlyEqual(output.samplePeakDbfs, measured.samplePeakDbfs, 0.000002)
      || !nearlyEqual(output.rmsDbfs, measured.rmsDbfs, 0.000002)) {
      errors.push(`${expected.id} sample-peak or RMS record is stale.`);
    }
    if (!nearlyEqual(analysis.samplePeakDbfs, measured.samplePeakDbfs, 0.002)) errors.push(`${expected.id} analysis sample peak is stale.`);
    if (!nearlyEqual(analysis.truePeakDbtp, measured.truePeakDbtp, 0.003)) errors.push(`${expected.id} true-peak record is stale.`);
    if (!nearlyEqual(analysis.integratedLoudnessLufs, measured.integratedLoudnessLufs, 0.03)) errors.push(`${expected.id} integrated-loudness record is stale.`);
    if (!nearlyEqual(analysis.maximumMomentaryLufs, measured.maximumMomentaryLufs, 0.03)) errors.push(`${expected.id} momentary-loudness record is stale.`);
    if (!nearlyEqual(analysis.maximumShortTermLufs, measured.maximumShortTermLufs, 0.03)) errors.push(`${expected.id} short-term-loudness record is stale.`);
    if (!nearlyEqual(analysis.loudnessRangeLu, measured.loudnessRangeLu, 0.03)) errors.push(`${expected.id} loudness-range record is stale.`);
    const scoreChannels = decodedGuideById.get(expected.stems[0]);
    const sfxChannels = decodedGuideById.get(expected.stems[1]);
    if (scoreChannels && sfxChannels) {
      const reconstructedGain = reconstructNormalizationGain(scoreChannels, sfxChannels, expected);
      if (!nearlyEqual(analysis.normalizationGainDb, reconstructedGain, 0.0005)) {
        errors.push(`${expected.id} normalizationGainDb does not match the reconstructed source mix.`);
      }
    }
    if (measured.truePeakDbtp > TRUE_PEAK_CEILING_DBTP + 0.01) errors.push(`${expected.id} exceeds the review true-peak ceiling.`);
    if (Math.abs(measured.integratedLoudnessLufs - TARGET_LOUDNESS_LUFS) > 0.08) errors.push(`${expected.id} misses the review loudness target.`);
    if (measured.samplePeakDbfs > measured.truePeakDbtp + 0.001) errors.push(`${expected.id} reports an impossible sample/true-peak relationship.`);
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    checked: Object.freeze(checked)
  });
}

function parseArguments(argv) {
  const options = {
    root: DEFAULT_VOYAGE_AUDIO_REVIEW_SOURCE_ROOT,
    sourceRoot: DEFAULT_VOYAGE_AUDIO_REVIEW_SOURCE_ROOT,
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--root") options.root = argv[++index];
    else if (argument === "--source-root") options.sourceRoot = argv[++index];
    else throw new Error(`Unknown argument ${argument}.`);
    if ((argument === "--root" || argument === "--source-root")
      && !options[argument === "--root" ? "root" : "sourceRoot"]) {
      throw new Error(`${argument} requires a path.`);
    }
  }
  return options;
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  const report = await verifyVoyageProjectionAudioReview(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else if (report.valid) {
    console.log(`Voyage Projection review masters valid (${report.checked.outputCount} candidates).`);
    console.log("Project-authored: true; voice: absent; human approval: absent; release eligible: false.");
  } else {
    console.error("Voyage Projection review-master verification failed:");
    for (const error of report.errors) console.error(`- ${error}`);
  }
  if (!report.valid) process.exitCode = 1;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) await main();
