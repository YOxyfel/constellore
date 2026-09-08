import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test, { after, before } from "node:test";

import {
  EXPECTED_VOYAGE_AUDIO_OUTPUTS,
  VOYAGE_AUDIO_CUE_SHEET_PATH,
  VOYAGE_AUDIO_RECORD_PATH,
  inspectPcm24Wave,
  parseVoyageAudioCueSheet,
  verifyVoyageProjectionAudio
} from "../scripts/verify-voyage-projection-audio.mjs";

const SOURCE_ROOT = resolve(import.meta.dirname, "..");
const BUILDER = resolve(SOURCE_ROOT, "scripts/build-voyage-projection-audio.py");
let artifactRoot;

function runBuilder() {
  const result = spawnSync(
    "python",
    [BUILDER, "--source-root", SOURCE_ROOT, "--artifact-root", artifactRoot],
    { cwd: SOURCE_ROOT, encoding: "utf8", timeout: 120_000 }
  );
  assert.equal(result.status, 0, `Builder failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Status: non-final-guide; release eligible: false/u);
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function snapshotOutputs() {
  const record = await readFile(resolve(artifactRoot, VOYAGE_AUDIO_RECORD_PATH));
  const cueSheet = await readFile(resolve(artifactRoot, VOYAGE_AUDIO_CUE_SHEET_PATH));
  const waves = {};
  for (const output of EXPECTED_VOYAGE_AUDIO_OUTPUTS) {
    waves[output.id] = sha256(await readFile(resolve(artifactRoot, output.path)));
  }
  return {
    record: sha256(record),
    cueSheet: sha256(cueSheet),
    waves
  };
}

before(async () => {
  artifactRoot = await mkdtemp(join(tmpdir(), "constellore-voyage-audio-"));
  runBuilder();
});

after(async () => {
  await rm(artifactRoot, { recursive: true, force: true });
});

test("procedural builder emits only the four voice-free non-final guide stems", async () => {
  const report = await verifyVoyageProjectionAudio({ root: artifactRoot, sourceRoot: SOURCE_ROOT });
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.deepEqual(report.errors, []);
  assert.equal(report.checked.outputCount, 4);

  const stemDirectory = resolve(artifactRoot, "output/voyage-projection/audio/stems");
  assert.deepEqual(
    (await readdir(stemDirectory)).sort(),
    EXPECTED_VOYAGE_AUDIO_OUTPUTS.map((output) => output.path.split("/").at(-1)).sort()
  );

  const record = JSON.parse(await readFile(resolve(artifactRoot, VOYAGE_AUDIO_RECORD_PATH), "utf8"));
  assert.equal(record.status, "non-final-guide");
  assert.equal(record.releaseEligible, false);
  assert.equal(record.createsRightsEvidence, false);
  assert.deepEqual(record.voice, {
    included: false,
    status: "absent",
    provider: null,
    performer: null,
    commercialUseDocumented: false,
    livingPerformerImitation: null,
    sourceSha256: null,
    masteredSha256: null
  });
  assert.equal(record.rights.commercialUseDocumented, false);
  assert.equal(record.rights.humanApproval, null);
  assert.equal(record.rights.composerOrLibraryLicense, null);
  assert.ok(record.outputs.every((output) => output.guideOnly && !output.voiceIncluded));
  assert.ok(record.outputs.every((output) => !output.path.startsWith("public/")));
});

test("procedural guide generation is byte deterministic", async () => {
  const first = await snapshotOutputs();
  runBuilder();
  const second = await snapshotOutputs();
  assert.deepEqual(second, first);
});

test("reduced-motion narration map retains all words at 110 WPM without overlap", async () => {
  const source = await readFile(resolve(artifactRoot, VOYAGE_AUDIO_CUE_SHEET_PATH), "utf8");
  const rows = parseVoyageAudioCueSheet(source)
    .filter((row) => row.timeline === "reduced-motion-24s" && row.type === "narration")
    .sort((left, right) => Number(left.start_seconds) - Number(right.start_seconds));
  assert.equal(rows.length, 4);
  let previousEnd = 0;
  for (const row of rows) {
    const start = Number(row.start_seconds);
    const end = Number(row.end_seconds);
    const wordCount = row.description.trim().split(/\s+/u).length;
    assert.ok(start >= previousEnd, `${row.id} overlaps the prior cue.`);
    assert.ok(end <= 24, `${row.id} exceeds the 24-second delivery.`);
    assert.ok(end - start + 0.002 >= wordCount * 60 / 110, `${row.id} is clipped at 110 WPM.`);
    assert.equal(row.audio_included, "false");
    assert.equal(row.release_eligible, "false");
    previousEnd = end;
  }
});

test("strict verifier rejects a tampered guide without mutating canonical source files", async () => {
  const output = EXPECTED_VOYAGE_AUDIO_OUTPUTS[0];
  const path = resolve(artifactRoot, output.path);
  const original = await readFile(path);
  const tampered = Buffer.from(original);
  tampered[tampered.length - 1] ^= 0x01;
  await writeFile(path, tampered);
  try {
    const report = await verifyVoyageProjectionAudio({ root: artifactRoot, sourceRoot: SOURCE_ROOT });
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((error) => error.includes(`${output.id} digest does not match`)));
  } finally {
    await writeFile(path, original);
  }
  const restored = await verifyVoyageProjectionAudio({ root: artifactRoot, sourceRoot: SOURCE_ROOT });
  assert.equal(restored.valid, true, restored.errors.join("\n"));
});

test("strict WAV inspection rejects a forged sample rate", async () => {
  const output = EXPECTED_VOYAGE_AUDIO_OUTPUTS[0];
  const malformed = Buffer.from(await readFile(resolve(artifactRoot, output.path)));
  malformed.writeUInt32LE(44_100, 24);
  const inspection = inspectPcm24Wave(malformed);
  assert.ok(inspection.errors.some((error) => error.includes("sample rate must be 48000")));
});

