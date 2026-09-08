import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { after, before } from "node:test";

import {
  EXPECTED_VOYAGE_AUDIO_REVIEW_OUTPUTS,
  VOYAGE_AUDIO_REVIEW_RECORD_PATH,
  measureVoyageReviewMaster,
  verifyVoyageProjectionAudioReview
} from "../scripts/verify-voyage-projection-audio-master.mjs";

const SOURCE_ROOT = resolve(import.meta.dirname, "..");
const GUIDE_BUILDER = resolve(SOURCE_ROOT, "scripts/build-voyage-projection-audio.py");
const REVIEW_BUILDER = resolve(SOURCE_ROOT, "scripts/build-voyage-projection-audio-master.py");
// Windows runners can expose TEMP through an 8.3 alias. Give the strict
// artifact-root guard a canonical test fixture; deliberate junction tests stay intact.
const SYSTEM_TEMP_ROOT = await realpath(tmpdir());
let artifactRoot;

function spawnPython(script, targetRoot = artifactRoot) {
  return spawnSync(
    "python",
    [script, "--source-root", SOURCE_ROOT, "--artifact-root", targetRoot],
    { cwd: SOURCE_ROOT, encoding: "utf8", timeout: 180_000 }
  );
}

function runPython(script, targetRoot = artifactRoot) {
  const result = spawnPython(script, targetRoot);
  assert.equal(result.status, 0, `${script} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function snapshot() {
  const record = await readFile(resolve(artifactRoot, VOYAGE_AUDIO_REVIEW_RECORD_PATH));
  const waves = {};
  for (const output of EXPECTED_VOYAGE_AUDIO_REVIEW_OUTPUTS) {
    waves[output.id] = sha256(await readFile(resolve(artifactRoot, output.path)));
  }
  return { record: sha256(record), waves };
}

before(async () => {
  artifactRoot = await mkdtemp(join(SYSTEM_TEMP_ROOT, "constellore-voyage-review-audio-"));
  runPython(GUIDE_BUILDER);
  const output = runPython(REVIEW_BUILDER);
  assert.match(output, /Voice: absent; human approval: absent; release eligible: false[.]/u);
});

after(async () => {
  await rm(artifactRoot, { recursive: true, force: true });
});

test("review builder emits two verified project-authored voice-free candidates", async () => {
  const report = await verifyVoyageProjectionAudioReview({ root: artifactRoot, sourceRoot: SOURCE_ROOT });
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(report.checked.outputCount, 2);
  assert.match(report.warnings[0], /Voice is absent/u);

  const record = JSON.parse(await readFile(resolve(artifactRoot, VOYAGE_AUDIO_REVIEW_RECORD_PATH), "utf8"));
  assert.equal(record.status, "project-authored-review-master-candidate");
  assert.equal(record.provenance.projectAuthored, true);
  assert.equal(record.provenance.thirdPartySamples, false);
  assert.equal(record.provenance.generativeModelOutput, false);
  assert.equal(record.voice.included, false);
  assert.equal(record.voice.navigationVoiceComplete, false);
  assert.equal(record.voice.rightsEvidence, null);
  assert.equal(record.reviewBoundary.humanApproval, null);
  assert.equal(record.reviewBoundary.mayPopulateFinalCompositorPaths, false);
  assert.equal(record.reviewBoundary.mayMutateRuntimeMediaApproval, false);
  assert.deepEqual(record.toolchain, {
    pythonVersion: "3.14.0",
    pythonImplementation: "CPython",
    numpyVersion: "2.5.0",
    bitGenerator: "PCG64",
    knownOutputSha256Locked: true,
    unsupportedEnvironmentPolicy: "reject-before-read-or-write"
  });
});

test("review candidates retain PCM24 geometry, loudness target, and true-peak headroom", async () => {
  const record = JSON.parse(await readFile(resolve(artifactRoot, VOYAGE_AUDIO_REVIEW_RECORD_PATH), "utf8"));
  for (const output of record.outputs) {
    const measured = measureVoyageReviewMaster(await readFile(resolve(artifactRoot, output.path)));
    assert.deepEqual(measured.errors, []);
    assert.equal(measured.sampleRateHz, 48_000);
    assert.equal(measured.bitsPerSample, 24);
    assert.equal(measured.channels, 2);
    assert.equal(measured.frames, 2_736_000);
    assert.equal(measured.durationSeconds, 57);
    assert.ok(Math.abs(measured.integratedLoudnessLufs - (-18)) <= 0.08);
    assert.ok(measured.loudnessRangeLu > 1 && measured.loudnessRangeLu < 20);
    assert.ok(measured.truePeakDbtp <= -2);
    assert.ok(measured.samplePeakDbfs <= measured.truePeakDbtp + 0.001);
    assert.ok(output.mix.narrationWindows.length >= 3, "Narration headroom automation is missing.");
  }
});

test("review-master generation is byte deterministic", async () => {
  const first = await snapshot();
  runPython(REVIEW_BUILDER);
  const second = await snapshot();
  assert.deepEqual(second, first);
});

test("review candidates cannot occupy final compositor master paths", async () => {
  for (const finalPath of [
    "output/voyage-projection/audio/voyage-projection-opening-master.wav",
    "output/voyage-projection/audio/voyage-projection-finale-master.wav"
  ]) {
    await assert.rejects(access(resolve(artifactRoot, finalPath)));
  }
  for (const output of EXPECTED_VOYAGE_AUDIO_REVIEW_OUTPUTS) {
    assert.match(output.path, /\/review\/.*-review-master[.]wav$/u);
  }
});

test("verifier rejects fabricated human approval and restores the generated boundary", async () => {
  const path = resolve(artifactRoot, VOYAGE_AUDIO_REVIEW_RECORD_PATH);
  const original = await readFile(path);
  const record = JSON.parse(original.toString("utf8"));
  record.reviewBoundary.humanApproval = {
    reviewer: "Not generated authority",
    approvedAt: "2026-08-06T12:00:00Z"
  };
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
  try {
    const report = await verifyVoyageProjectionAudioReview({ root: artifactRoot, sourceRoot: SOURCE_ROOT });
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((error) => error.includes("human-approval")));
  } finally {
    await writeFile(path, original);
  }
});

test("verifier rejects candidate audio tampering", async () => {
  const output = EXPECTED_VOYAGE_AUDIO_REVIEW_OUTPUTS[0];
  const path = resolve(artifactRoot, output.path);
  const original = await readFile(path);
  const tampered = Buffer.from(original);
  tampered[tampered.length - 2] ^= 0x01;
  await writeFile(path, tampered);
  try {
    const report = await verifyVoyageProjectionAudioReview({ root: artifactRoot, sourceRoot: SOURCE_ROOT });
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((error) => error.includes(`${output.id} digest does not match`)));
  } finally {
    await writeFile(path, original);
  }
});

test("verifier rejects mutated geometry, gain, width, and saturation provenance", async () => {
  const path = resolve(artifactRoot, VOYAGE_AUDIO_REVIEW_RECORD_PATH);
  const original = await readFile(path);
  const record = JSON.parse(original.toString("utf8"));
  const output = record.outputs[0];
  output.frames += 1;
  output.dataBytes += 6;
  output.durationSeconds -= 1;
  output.analysis.normalizationGainDb += 0.5;
  output.mix.stereoSideScale = 0.5;
  output.mix.saturationDrive = 1.2;
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
  try {
    const report = await verifyVoyageProjectionAudioReview({ root: artifactRoot, sourceRoot: SOURCE_ROOT });
    assert.equal(report.valid, false);
    for (const expected of [
      "provenance frames",
      "provenance dataBytes",
      "provenance durationSeconds",
      "normalizationGainDb",
      "stereoSideScale",
      "saturationDrive"
    ]) {
      assert.ok(report.errors.some((error) => error.includes(expected)), `${expected} mutation was not rejected.`);
    }
  } finally {
    await writeFile(path, original);
  }
});

test("verifier rejects toolchain drift and the builder pins explicit PCG64", async () => {
  const path = resolve(artifactRoot, VOYAGE_AUDIO_REVIEW_RECORD_PATH);
  const original = await readFile(path);
  const record = JSON.parse(original.toString("utf8"));
  record.toolchain.numpyVersion = "unsupported";
  record.toolchain.bitGenerator = "implicit-default";
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
  try {
    const report = await verifyVoyageProjectionAudioReview({ root: artifactRoot, sourceRoot: SOURCE_ROOT });
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((error) => error.includes("toolchain.numpyVersion")));
    assert.ok(report.errors.some((error) => error.includes("toolchain.bitGenerator")));
  } finally {
    await writeFile(path, original);
  }
  const builder = await readFile(REVIEW_BUILDER, "utf8");
  assert.match(builder, /np[.]random[.]Generator\(np[.]random[.]PCG64\(seed\)\)/u);
  assert.doesNotMatch(builder, /default_rng/u);
  assert.match(builder, /KNOWN_REVIEW_SHA256/u);
});

test("review output parent junction cannot escape the artifact root on Windows", {
  skip: process.platform !== "win32"
}, async (context) => {
  const isolatedRoot = await mkdtemp(join(SYSTEM_TEMP_ROOT, "constellore-voyage-junction-root-"));
  const escapedRoot = await mkdtemp(join(SYSTEM_TEMP_ROOT, "constellore-voyage-junction-escape-"));
  const reviewParent = resolve(isolatedRoot, "output/voyage-projection/audio/review");
  try {
    const guide = spawnPython(GUIDE_BUILDER, isolatedRoot);
    assert.equal(guide.status, 0, guide.stderr || guide.stdout);
    await mkdir(resolve(isolatedRoot, "output/voyage-projection/audio"), { recursive: true });
    try {
      await symlink(escapedRoot, reviewParent, "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        context.skip(`Junction creation is unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    const review = spawnPython(REVIEW_BUILDER, isolatedRoot);
    assert.notEqual(review.status, 0, "Review builder unexpectedly wrote through a junction.");
    assert.match(`${review.stdout}\n${review.stderr}`, /junction|reparse point|filesystem indirection/iu);
    await assert.rejects(access(resolve(escapedRoot, "voyage-projection-promise-review-master.wav")));
    await assert.rejects(access(resolve(escapedRoot, "voyage-projection-completion-review-master.wav")));
  } finally {
    try {
      await unlink(reviewParent);
    } catch {}
    await rm(isolatedRoot, { recursive: true, force: true });
    await rm(escapedRoot, { recursive: true, force: true });
  }
});

test("review verifier rejects a junction before reading candidate audio on Windows", {
  skip: process.platform !== "win32"
}, async (context) => {
  const reviewParent = resolve(artifactRoot, "output/voyage-projection/audio/review");
  const escapedRoot = await mkdtemp(join(SYSTEM_TEMP_ROOT, "constellore-voyage-verifier-junction-"));
  const escapedReview = resolve(escapedRoot, "review");
  let moved = false;
  let linked = false;
  try {
    await rename(reviewParent, escapedReview);
    moved = true;
    try {
      await symlink(escapedReview, reviewParent, "junction");
      linked = true;
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        context.skip(`Junction creation is unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    const report = await verifyVoyageProjectionAudioReview({ root: artifactRoot, sourceRoot: SOURCE_ROOT });
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((error) => /junction|reparse point|filesystem indirection/iu.test(error)));
  } finally {
    if (linked) {
      try { await unlink(reviewParent); } catch {}
    }
    if (moved) {
      try { await rename(escapedReview, reviewParent); } catch {}
    }
    await rm(escapedRoot, { recursive: true, force: true });
  }
});

test("package commands keep guide and review build/verification distinct", async () => {
  const pkg = JSON.parse(await readFile(resolve(SOURCE_ROOT, "package.json"), "utf8"));
  assert.equal(
    pkg.scripts["cinematic:voyage:audio:review"],
    "npm run cinematic:voyage:audio:guide && python scripts/build-voyage-projection-audio-master.py"
  );
  assert.equal(
    pkg.scripts["cinematic:voyage:audio:review:verify"],
    "node scripts/verify-voyage-projection-audio-master.mjs"
  );
});
