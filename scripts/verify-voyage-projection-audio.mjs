#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  APPROVED_VOYAGE_NARRATION,
  loadVoyageProductionManifest,
  voyageProductionManifestDigest
} from "./voyage-projection-production.mjs";

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_VOYAGE_AUDIO_SOURCE_ROOT = resolve(MODULE_DIRECTORY, "..");
export const VOYAGE_AUDIO_RECORD_PATH =
  "production/voyage-projection/scaffold/provenance/audio-guide-record.json";
export const VOYAGE_AUDIO_CUE_SHEET_PATH =
  "production/voyage-projection/scaffold/audio-cue-sheet.csv";
export const VOYAGE_AUDIO_GENERATOR_PATH = "scripts/build-voyage-projection-audio.py";
export const VOYAGE_AUDIO_CONTRACT_PATH = "scripts/voyage-projection-cinematic.v1.json";

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const BITS_PER_SAMPLE = 24;
const BLOCK_ALIGN = 6;
const BYTE_RATE = 288_000;
const DURATION_SECONDS = 57;
const FRAME_COUNT = SAMPLE_RATE * DURATION_SECONDS;
const DATA_BYTES = FRAME_COUNT * BLOCK_ALIGN;
const MAX_GUIDE_PEAK_DBFS = -3;

export const EXPECTED_VOYAGE_AUDIO_OUTPUTS = Object.freeze([
  Object.freeze({
    id: "score-completion",
    path: "output/voyage-projection/audio/stems/voyage-projection-score-completion-guide.wav",
    bus: "music",
    variants: Object.freeze(["completion"]),
    targetSamplePeakDbfs: -12
  }),
  Object.freeze({
    id: "score-unresolved",
    path: "output/voyage-projection/audio/stems/voyage-projection-score-unresolved-guide.wav",
    bus: "music",
    variants: Object.freeze(["promise", "progress"]),
    targetSamplePeakDbfs: -12
  }),
  Object.freeze({
    id: "sfx-completion",
    path: "output/voyage-projection/audio/stems/voyage-projection-sfx-completion-guide.wav",
    bus: "effects",
    variants: Object.freeze(["completion"]),
    targetSamplePeakDbfs: -8
  }),
  Object.freeze({
    id: "sfx-unresolved",
    path: "output/voyage-projection/audio/stems/voyage-projection-sfx-unresolved-guide.wav",
    bus: "effects",
    variants: Object.freeze(["promise", "progress"]),
    targetSamplePeakDbfs: -8
  })
]);

const EXPECTED_REDUCED_NARRATION = Object.freeze([
  Object.freeze({
    id: "understanding-makes-reachable",
    startSeconds: 0.4,
    endSeconds: 5.31,
    text: "Every world we understand becomes somewhere we can reach."
  }),
  Object.freeze({
    id: "discovery-makes-coordinate",
    startSeconds: 5.65,
    endSeconds: 9.47,
    text: "Every discovery gives the voyage another coordinate."
  }),
  Object.freeze({
    id: "map-has-no-word",
    startSeconds: 11.9,
    endSeconds: 18.99,
    text: "Beyond the last light, the map has no word for what comes next."
  }),
  Object.freeze({
    id: "make-one",
    startSeconds: 20.8,
    endSeconds: 23.53,
    text: "So we will make one."
  })
]);

const EXPECTED_SFX_CUES = Object.freeze([
  ["projection-online", 0, 0.9],
  ["engine-ignition", 0.25, 1.6],
  ["earth-liftoff", 2, 7],
  ["moon-coordinate", 7, 7.3],
  ["mercury-coordinate", 8.2, 8.5],
  ["venus-coordinate", 9.8, 10.1],
  ["mars-coordinate", 11.6, 11.9],
  ["jupiter-coordinate", 13.7, 14],
  ["saturn-coordinate", 15.7, 16],
  ["uranus-coordinate", 17.4, 17.7],
  ["neptune-coordinate", 19, 19.3],
  ["heliopause-shear", 20, 27],
  ["warp-ignition", 27, 28.6],
  ["warp-corridor", 27, 38],
  ["gravity-arrival", 38, 39.4],
  ["accretion-shear", 38, 48],
  ["singularity-collapse", 48, 53],
  ["return-fold", 53, 56.2],
  ["beyond-release", 53, 57]
]);

function hash(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function sameArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function nearlyEqual(actual, expected, tolerance = 0.000002) {
  return Number.isFinite(Number(actual))
    && Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

export function parseVoyageAudioCueSheet(source) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.endsWith("\r") ? field.slice(0, -1) : field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("Cue sheet ends inside a quoted field.");
  if (field.length || record.length) {
    record.push(field.endsWith("\r") ? field.slice(0, -1) : field);
    records.push(record);
  }
  if (!records.length) return [];
  const headers = records.shift();
  if (headers.some((header) => !header)) throw new Error("Cue sheet contains an empty header.");
  return records
    .filter((row) => row.some((value) => value !== ""))
    .map((row, index) => {
      if (row.length !== headers.length) {
        throw new Error(`Cue sheet row ${index + 2} has ${row.length} fields; expected ${headers.length}.`);
      }
      return Object.fromEntries(headers.map((header, column) => [header, row[column]]));
    });
}

function signedPcm24(buffer, offset) {
  let value = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
  if (value & 0x800000) value -= 0x1000000;
  return value;
}

export function inspectPcm24Wave(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError("WAV input must be a Buffer.");
  const errors = [];
  if (buffer.length < 44) return { errors: ["WAV is shorter than the minimum 44-byte header."] };
  if (buffer.toString("ascii", 0, 4) !== "RIFF") errors.push("WAV does not begin with RIFF.");
  if (buffer.toString("ascii", 8, 12) !== "WAVE") errors.push("RIFF payload is not WAVE.");
  if (buffer.readUInt32LE(4) !== buffer.length - 8) {
    errors.push(`RIFF size is ${buffer.readUInt32LE(4)}; expected ${buffer.length - 8}.`);
  }

  const formatChunks = [];
  const dataChunks = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    const end = dataOffset + size;
    if (end > buffer.length) {
      errors.push(`Chunk ${id || "<empty>"} exceeds the WAV file.`);
      break;
    }
    if (id === "fmt ") formatChunks.push({ size, dataOffset });
    if (id === "data") dataChunks.push({ size, dataOffset });
    offset = end + (size % 2);
  }
  if (offset !== buffer.length) errors.push(`WAV chunk table ends at ${offset}; file ends at ${buffer.length}.`);
  if (formatChunks.length !== 1) errors.push(`WAV must contain exactly one fmt chunk; found ${formatChunks.length}.`);
  if (dataChunks.length !== 1) errors.push(`WAV must contain exactly one data chunk; found ${dataChunks.length}.`);
  if (errors.length || formatChunks.length !== 1 || dataChunks.length !== 1) return { errors };

  const format = formatChunks[0];
  const data = dataChunks[0];
  if (format.size !== 16) errors.push(`PCM fmt chunk must be 16 bytes; received ${format.size}.`);
  if (format.size < 16) return { errors };
  const audioFormat = buffer.readUInt16LE(format.dataOffset);
  const channels = buffer.readUInt16LE(format.dataOffset + 2);
  const sampleRateHz = buffer.readUInt32LE(format.dataOffset + 4);
  const byteRate = buffer.readUInt32LE(format.dataOffset + 8);
  const blockAlign = buffer.readUInt16LE(format.dataOffset + 12);
  const bitsPerSample = buffer.readUInt16LE(format.dataOffset + 14);
  if (audioFormat !== 1) errors.push(`WAV format must be integer PCM (1); received ${audioFormat}.`);
  if (channels !== CHANNELS) errors.push(`WAV must be stereo; received ${channels} channels.`);
  if (sampleRateHz !== SAMPLE_RATE) errors.push(`WAV sample rate must be ${SAMPLE_RATE}; received ${sampleRateHz}.`);
  if (byteRate !== BYTE_RATE) errors.push(`WAV byte rate must be ${BYTE_RATE}; received ${byteRate}.`);
  if (blockAlign !== BLOCK_ALIGN) errors.push(`WAV block align must be ${BLOCK_ALIGN}; received ${blockAlign}.`);
  if (bitsPerSample !== BITS_PER_SAMPLE) errors.push(`WAV must be ${BITS_PER_SAMPLE}-bit; received ${bitsPerSample}-bit.`);
  if (data.size !== DATA_BYTES) errors.push(`WAV data chunk must be ${DATA_BYTES} bytes; received ${data.size}.`);
  if (data.size % BLOCK_ALIGN !== 0) errors.push("WAV data chunk does not contain whole stereo frames.");

  let peak = 0;
  let sumSquares = 0;
  let sampleCount = 0;
  for (let cursor = data.dataOffset; cursor + 2 < data.dataOffset + data.size; cursor += 3) {
    const sample = signedPcm24(buffer, cursor);
    const magnitude = Math.abs(sample);
    if (magnitude > peak) peak = magnitude;
    const normalized = sample / 8_388_607;
    sumSquares += normalized * normalized;
    sampleCount += 1;
  }
  const peakNormalized = peak / 8_388_607;
  const rms = Math.sqrt(sumSquares / Math.max(1, sampleCount));
  return {
    errors,
    audioFormat,
    channels,
    sampleRateHz,
    byteRate,
    blockAlign,
    bitsPerSample,
    dataBytes: data.size,
    frames: data.size / BLOCK_ALIGN,
    durationSeconds: data.size / blockAlign / sampleRateHz,
    samplePeakDbfs: 20 * Math.log10(Math.max(peakNormalized, 1e-12)),
    rmsDbfs: 20 * Math.log10(Math.max(rms, 1e-12))
  };
}

function validateRecordBoundary(record, contractDigest, generatorDigest, errors) {
  if (record?.schemaVersion !== 1) errors.push("Audio guide record schemaVersion must be 1.");
  if (record?.status !== "non-final-guide") errors.push("Audio guide record status must remain non-final-guide.");
  if (record?.releaseEligible !== false) errors.push("Audio guides must remain releaseEligible=false.");
  if (record?.createsRightsEvidence !== false) errors.push("Audio guides must remain createsRightsEvidence=false.");
  if (record?.contract?.path !== VOYAGE_AUDIO_CONTRACT_PATH) errors.push("Audio record references the wrong Voyage contract path.");
  if (record?.contract?.sha256 !== contractDigest) errors.push("Audio record contract digest is stale or incorrect.");
  if (record?.generator?.path !== VOYAGE_AUDIO_GENERATOR_PATH) errors.push("Audio record references the wrong generator path.");
  if (record?.generator?.sha256 !== generatorDigest) errors.push("Audio record generator digest is stale or incorrect.");
  if (record?.generator?.seed !== 314_159) errors.push("Audio guide seed must remain 314159.");
  if (record?.generator?.method !== "deterministic sample-free additive synthesis and filtered procedural noise") {
    errors.push("Audio guide record has an unexpected synthesis method.");
  }
  if (record?.generator?.thirdPartySamples !== false) errors.push("Audio guides may not claim or include third-party samples.");
  if (record?.generator?.generativeModelOutput !== false) errors.push("Audio guides must identify that they are not generative-model output.");

  const format = record?.format;
  for (const [property, expected] of Object.entries({
    container: "wav",
    codec: "pcm_s24le",
    sampleRateHz: SAMPLE_RATE,
    channels: CHANNELS,
    bitsPerSample: BITS_PER_SAMPLE,
    durationSeconds: DURATION_SECONDS,
    maximumGuideSamplePeakDbfs: MAX_GUIDE_PEAK_DBFS
  })) {
    if (format?.[property] !== expected) errors.push(`Audio record format.${property} must be ${expected}.`);
  }

  const voice = record?.voice;
  if (voice?.included !== false || voice?.status !== "absent") errors.push("Audio guide voice must remain explicitly absent.");
  for (const property of ["provider", "performer", "livingPerformerImitation", "sourceSha256", "masteredSha256"]) {
    if (voice?.[property] !== null) errors.push(`Audio guide voice.${property} must remain null.`);
  }
  if (voice?.commercialUseDocumented !== false) errors.push("Audio guide voice rights must remain undocumented.");

  const rights = record?.rights;
  if (rights?.commercialUseDocumented !== false) errors.push("Guide record cannot claim documented commercial rights.");
  if (rights?.humanApproval !== null) errors.push("Guide record cannot fabricate human approval.");
  if (rights?.composerOrLibraryLicense !== null) errors.push("Guide record cannot fabricate a composer or library license.");
  if (typeof rights?.statement !== "string" || !rights.statement.includes("not owner approval")) {
    errors.push("Guide record must state that it is not owner approval.");
  }
}

function validateCueSheet(rows, errors) {
  if (!rows.length) {
    errors.push("Audio cue sheet contains no cues.");
    return;
  }
  for (const [index, row] of rows.entries()) {
    const label = `Cue sheet row ${index + 2}`;
    if (row.release_eligible !== "false") errors.push(`${label} must remain release_eligible=false.`);
    if (!Number.isFinite(Number(row.start_seconds)) || !Number.isFinite(Number(row.end_seconds))) {
      errors.push(`${label} has invalid cue times.`);
    } else if (Number(row.end_seconds) <= Number(row.start_seconds)) {
      errors.push(`${label} must end after it starts.`);
    }
    if (row.type === "narration" && row.audio_included !== "false") {
      errors.push(`${label} may not claim included narration audio.`);
    }
    if ((row.type === "score" || row.type === "sfx") && row.audio_included !== "true") {
      errors.push(`${label} must identify its procedural guide audio as included.`);
    }
  }

  const canonicalNarration = rows.filter((row) => row.timeline === "canonical-57s" && row.type === "narration");
  if (canonicalNarration.length !== APPROVED_VOYAGE_NARRATION.length) {
    errors.push("Cue sheet must contain exactly the approved canonical narration cues.");
  }
  for (const expected of APPROVED_VOYAGE_NARRATION) {
    const row = canonicalNarration.find((candidate) => candidate.id === expected.id);
    if (!row) {
      errors.push(`Cue sheet is missing canonical narration ${expected.id}.`);
      continue;
    }
    if (!nearlyEqual(row.start_seconds, expected.startSeconds)
      || !nearlyEqual(row.end_seconds, expected.endSeconds)
      || row.description !== expected.text) {
      errors.push(`Canonical narration ${expected.id} does not match the locked contract.`);
    }
  }

  const reducedNarration = rows.filter((row) => row.timeline === "reduced-motion-24s" && row.type === "narration");
  if (reducedNarration.length !== EXPECTED_REDUCED_NARRATION.length) {
    errors.push("Cue sheet must contain exactly four reduced-motion narration cues.");
  }
  let previousEnd = 0;
  for (const expected of EXPECTED_REDUCED_NARRATION) {
    const row = reducedNarration.find((candidate) => candidate.id === expected.id);
    if (!row) {
      errors.push(`Cue sheet is missing reduced-motion narration ${expected.id}.`);
      continue;
    }
    const start = Number(row.start_seconds);
    const end = Number(row.end_seconds);
    if (!nearlyEqual(start, expected.startSeconds)
      || !nearlyEqual(end, expected.endSeconds)
      || row.description !== expected.text) {
      errors.push(`Reduced-motion narration ${expected.id} does not match its approved cue window.`);
    }
    if (start < previousEnd) errors.push(`Reduced-motion narration ${expected.id} overlaps the prior line.`);
    if (end > 24) errors.push(`Reduced-motion narration ${expected.id} exceeds the 24-second delivery.`);
    const words = expected.text.trim().split(/\s+/u).length;
    const durationAt110Wpm = words * 60 / 110;
    if (end - start + 0.002 < durationAt110Wpm) {
      errors.push(`Reduced-motion narration ${expected.id} is too short for 110 WPM.`);
    }
    previousEnd = end;
  }

  const sfxRows = rows.filter((row) => row.timeline === "canonical-57s" && row.type === "sfx");
  if (sfxRows.length !== EXPECTED_SFX_CUES.length) errors.push("Cue sheet does not contain the complete canonical SFX map.");
  for (const [id, start, end] of EXPECTED_SFX_CUES) {
    const row = sfxRows.find((candidate) => candidate.id === id);
    if (!row || !nearlyEqual(row.start_seconds, start) || !nearlyEqual(row.end_seconds, end)) {
      errors.push(`Cue sheet SFX cue ${id} is missing or mistimed.`);
    }
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function verifyVoyageProjectionAudio({
  root = DEFAULT_VOYAGE_AUDIO_SOURCE_ROOT,
  sourceRoot = DEFAULT_VOYAGE_AUDIO_SOURCE_ROOT
} = {}) {
  const artifactRoot = resolve(root);
  const canonicalSourceRoot = resolve(sourceRoot);
  const errors = [];
  const warnings = [];
  const checked = {
    root: artifactRoot,
    sourceRoot: canonicalSourceRoot,
    recordPath: VOYAGE_AUDIO_RECORD_PATH,
    cueSheetPath: VOYAGE_AUDIO_CUE_SHEET_PATH,
    outputCount: 0
  };

  let record;
  let cueSheetBuffer;
  let cueRows = [];
  let contract;
  let generatorBuffer;
  try {
    [record, cueSheetBuffer, contract, generatorBuffer] = await Promise.all([
      readJson(resolve(artifactRoot, VOYAGE_AUDIO_RECORD_PATH)),
      readFile(resolve(artifactRoot, VOYAGE_AUDIO_CUE_SHEET_PATH)),
      loadVoyageProductionManifest(resolve(canonicalSourceRoot, VOYAGE_AUDIO_CONTRACT_PATH)),
      readFile(resolve(canonicalSourceRoot, VOYAGE_AUDIO_GENERATOR_PATH))
    ]);
  } catch (error) {
    errors.push(`Unable to read Voyage audio guide inputs: ${error.message}`);
    return Object.freeze({ valid: false, errors: Object.freeze(errors), warnings: Object.freeze(warnings), checked: Object.freeze(checked) });
  }

  validateRecordBoundary(record, voyageProductionManifestDigest(contract), hash(generatorBuffer), errors);
  if (record?.cueSheet?.path !== VOYAGE_AUDIO_CUE_SHEET_PATH) errors.push("Audio record references the wrong cue-sheet path.");
  if (record?.cueSheet?.sha256 !== hash(cueSheetBuffer)) errors.push("Audio cue-sheet digest is stale or incorrect.");
  try {
    cueRows = parseVoyageAudioCueSheet(cueSheetBuffer.toString("utf8"));
    validateCueSheet(cueRows, errors);
  } catch (error) {
    errors.push(`Unable to parse Voyage audio cue sheet: ${error.message}`);
  }

  const outputs = Array.isArray(record?.outputs) ? record.outputs : [];
  checked.outputCount = outputs.length;
  if (outputs.length !== EXPECTED_VOYAGE_AUDIO_OUTPUTS.length) {
    errors.push(`Audio record must contain exactly ${EXPECTED_VOYAGE_AUDIO_OUTPUTS.length} guide stems.`);
  }
  const outputById = new Map();
  for (const output of outputs) {
    if (!output?.id || outputById.has(output.id)) errors.push(`Audio record contains a missing or duplicate output id ${output?.id || "<empty>"}.`);
    else outputById.set(output.id, output);
  }

  for (const expected of EXPECTED_VOYAGE_AUDIO_OUTPUTS) {
    const output = outputById.get(expected.id);
    if (!output) {
      errors.push(`Audio record is missing ${expected.id}.`);
      continue;
    }
    if (output.path !== expected.path) errors.push(`${expected.id} uses the wrong output path.`);
    if (output.path.startsWith("public/") || output.path.includes("/public/")) errors.push(`${expected.id} may not be written under public/.`);
    if (!output.path.startsWith("output/voyage-projection/audio/stems/")) errors.push(`${expected.id} must remain inside the guide-only output directory.`);
    if (output.bus !== expected.bus) errors.push(`${expected.id} uses the wrong bus.`);
    if (!sameArray(output.variants, expected.variants)) errors.push(`${expected.id} has incorrect variant coverage.`);
    if (output.guideOnly !== true || output.voiceIncluded !== false) errors.push(`${expected.id} must remain guide-only and voice-free.`);
    if (output.sampleRateHz !== SAMPLE_RATE || output.channels !== CHANNELS || output.bitsPerSample !== BITS_PER_SAMPLE) {
      errors.push(`${expected.id} record format must remain 48 kHz stereo PCM24.`);
    }
    if (output.targetSamplePeakDbfs !== expected.targetSamplePeakDbfs) errors.push(`${expected.id} has the wrong target sample peak.`);

    let buffer;
    try {
      buffer = await readFile(resolve(artifactRoot, expected.path));
    } catch (error) {
      errors.push(`Unable to read ${expected.id}: ${error.message}`);
      continue;
    }
    if (output.sha256 !== hash(buffer)) errors.push(`${expected.id} digest does not match its WAV file.`);
    if (output.bytes !== buffer.length) errors.push(`${expected.id} byte count does not match its WAV file.`);
    const inspection = inspectPcm24Wave(buffer);
    for (const error of inspection.errors || []) errors.push(`${expected.id}: ${error}`);
    if ((inspection.errors || []).length) continue;
    if (inspection.frames !== FRAME_COUNT || inspection.dataBytes !== DATA_BYTES || !nearlyEqual(inspection.durationSeconds, DURATION_SECONDS)) {
      errors.push(`${expected.id} must contain exactly ${FRAME_COUNT} frames / ${DURATION_SECONDS} seconds.`);
    }
    if (inspection.samplePeakDbfs > MAX_GUIDE_PEAK_DBFS + 0.000001) errors.push(`${expected.id} exceeds the guide headroom ceiling.`);
    if (inspection.rmsDbfs <= -120) errors.push(`${expected.id} is effectively silent.`);
    if (!nearlyEqual(inspection.samplePeakDbfs, expected.targetSamplePeakDbfs, 0.02)) errors.push(`${expected.id} misses its target sample peak.`);
    if (!nearlyEqual(output.samplePeakDbfs, inspection.samplePeakDbfs, 0.000002)) errors.push(`${expected.id} recorded sample peak is stale.`);
    if (!nearlyEqual(output.rmsDbfs, inspection.rmsDbfs, 0.000002)) errors.push(`${expected.id} recorded RMS is stale.`);
    if (output.dataBytes !== inspection.dataBytes || output.frames !== inspection.frames || !nearlyEqual(output.durationSeconds, inspection.durationSeconds)) {
      errors.push(`${expected.id} recorded WAV geometry is stale.`);
    }
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
    root: DEFAULT_VOYAGE_AUDIO_SOURCE_ROOT,
    sourceRoot: DEFAULT_VOYAGE_AUDIO_SOURCE_ROOT,
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--root") options.root = argv[++index];
    else if (argument === "--source-root") options.sourceRoot = argv[++index];
    else throw new Error(`Unknown argument ${argument}.`);
    if ((argument === "--root" || argument === "--source-root") && !options[argument === "--root" ? "root" : "sourceRoot"]) {
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
  const report = await verifyVoyageProjectionAudio(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else if (report.valid) {
    console.log(`Voyage Projection audio guides valid (${report.checked.outputCount} stems).`);
    console.log("Status: non-final-guide; release eligible: false; narration included: false.");
  } else {
    console.error("Voyage Projection audio guide verification failed:");
    for (const error of report.errors) console.error(`- ${error}`);
  }
  if (!report.valid) process.exitCode = 1;
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) await main();
