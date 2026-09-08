import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  APPROVED_VOYAGE_NARRATION,
  APPROVED_VOYAGE_POSTERS,
  APPROVED_VOYAGE_SHOTS,
  DEFAULT_VOYAGE_APPROVED_MEDIA_MANIFEST_PATH,
  loadVoyageProductionManifest,
  validateApprovedVoyageMediaManifest,
  validateVoyageProductionDeliverables,
  validateVoyageProductionManifest,
  voyageProvenanceRequiredForRelease,
  voyageProductionManifestDigest
} from "../scripts/voyage-projection-production.mjs";
import {
  VOYAGE_DURATION_SECONDS,
  VOYAGE_NARRATION,
  createVoyageTimeline
} from "../public/voyage-projection-domain.mjs";

const EXPECTED_CONTRACT_DIGEST = "0459b858503d99cc30d04139b5aa6144d03fb81e4b2e95fb9be4973f149b1416";

function clone(value) {
  return structuredClone(value);
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "constellore-voyage-approved-media-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function writeFixture(root, projectPath, contents) {
  const path = join(root, ...projectPath.split("/"));
  await mkdir(join(path, ".."), { recursive: true });
  const data = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  await writeFile(path, data);
  return { path: projectPath, sha256: sha256(data) };
}

function fixtureWebp(width = 1920, height = 1080) {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

function approvedProbe(kind, overrides = {}) {
  const video = {
    codec_type: "video",
    codec_name: kind === "master" ? "prores" : kind === "mp4" ? "h264" : "vp9",
    profile: kind === "master" ? "4444 XQ" : kind === "mp4" ? "High" : "Profile 0",
    width: kind === "master" ? 3840 : 1920,
    height: kind === "master" ? 2160 : 1080,
    avg_frame_rate: "24/1",
    r_frame_rate: "24/1",
    nb_read_frames: "1368"
  };
  const audio = {
    codec_type: "audio",
    codec_name: kind === "master" ? "pcm_s24le" : kind === "mp4" ? "aac" : "opus",
    profile: kind === "mp4" ? "LC" : "unknown",
    sample_rate: "48000",
    bits_per_sample: kind === "master" ? 24 : 0,
    channels: 2
  };
  return {
    streams: [{ ...video, ...(overrides.video || {}) }, { ...audio, ...(overrides.audio || {}) }],
    format: { duration: "57.000000", ...(overrides.format || {}) }
  };
}

function mediaApproval(scope) {
  return {
    approved: true,
    humanApproved: {
      reviewer: `${scope} Reviewer`,
      approvedAt: "2026-08-06T12:00:00Z",
      evidencePath: `production/voyage-projection/approvals/${scope}.json`
    }
  };
}

async function approvedMediaFixture(t) {
  const root = await temporaryDirectory(t);
  const manifest = await loadVoyageProductionManifest();
  for (const entrypoint of manifest.deliverables.find((entry) => entry.id === "realtime-projection").entrypoints) {
    await writeFixture(root, entrypoint, `export const fixture = ${JSON.stringify(entrypoint)};\n`);
  }
  const paths = {
    opening: {
      master: "output/voyage-projection/masters/voyage-projection-opening-master.mov",
      mp4: "public/cinematic/voyage-projection-opening-master.mp4",
      webm: "public/cinematic/voyage-projection-opening-master.webm",
      poster: "public/cinematic/voyage-projection-opening-poster.webp",
      captions: "public/cinematic/voyage-projection-opening.en.vtt"
    },
    completion: {
      master: "output/voyage-projection/masters/voyage-projection-finale-master.mov",
      mp4: "public/cinematic/voyage-projection-finale-master.mp4",
      webm: "public/cinematic/voyage-projection-finale-master.webm",
      poster: "public/cinematic/voyage-projection-finale-poster.webp",
      captions: "public/cinematic/voyage-projection-finale.en.vtt"
    }
  };
  const files = {};
  for (const [key, record] of Object.entries(paths)) {
    files[key] = {
      master: await writeFixture(root, record.master, `${key} prores fixture`),
      mp4: await writeFixture(root, record.mp4, `${key} h264 fixture`),
      webm: await writeFixture(root, record.webm, `${key} vp9 fixture`),
      poster: await writeFixture(root, record.poster, fixtureWebp()),
      captions: await writeFixture(root, record.captions, "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nFixture\n")
    };
  }
  const progressPoster = await writeFixture(
    root,
    "public/cinematic/voyage-projection-progress-poster.webp",
    fixtureWebp()
  );
  const approval = { reviewer: "Fixture Reviewer", approvedAt: "2026-08-06T12:00:00Z" };
  const posterEvidence = {
    schemaVersion: 1,
    contractSha256: voyageProductionManifestDigest(manifest),
    source: "graded-composite",
    derivedFromGradedMaster: true,
    records: [
      {
        ...APPROVED_VOYAGE_POSTERS[0],
        path: paths.opening.poster,
        sourceCompositePath: "output/voyage-projection/composites/promise/solar/frame-0168.exr",
        sourceCompositeSha256: "b".repeat(64),
        posterSha256: files.opening.poster.sha256,
        derivedFromGradedMaster: true,
        humanApproval: approval
      },
      {
        ...APPROVED_VOYAGE_POSTERS[1],
        path: progressPoster.path,
        sourceCompositePath: "output/voyage-projection/composites/progress/black-hole/frame-0912.exr",
        sourceCompositeSha256: "c".repeat(64),
        posterSha256: progressPoster.sha256,
        derivedFromGradedMaster: true,
        humanApproval: approval
      },
      {
        ...APPROVED_VOYAGE_POSTERS[2],
        path: paths.completion.poster,
        sourceCompositePath: "output/voyage-projection/composites/completion/beyond/frame-1272.exr",
        sourceCompositeSha256: "d".repeat(64),
        posterSha256: files.completion.poster.sha256,
        derivedFromGradedMaster: true,
        humanApproval: approval
      }
    ]
  };
  await writeFixture(
    root,
    "production/voyage-projection/poster-evidence.json",
    `${JSON.stringify(posterEvidence, null, 2)}\n`
  );
  const contractSha256 = voyageProductionManifestDigest(manifest);
  const releaseApproval = mediaApproval("release");
  const promiseApproval = mediaApproval("promise");
  const completionApproval = mediaApproval("completion");
  for (const recordApproval of [releaseApproval, promiseApproval, completionApproval]) {
    await writeFixture(
      root,
      recordApproval.humanApproved.evidencePath,
      `${JSON.stringify({
        schemaVersion: 1,
        approved: true,
        contractSha256,
        reviewer: recordApproval.humanApproved.reviewer,
        approvedAt: recordApproval.humanApproved.approvedAt
      }, null, 2)}\n`
    );
  }
  const record = (key, contractPaths, recordApproval) => ({
    approval: recordApproval,
    mp4: `./${contractPaths.mp4.split("/").at(-1)}`,
    webm: `./${contractPaths.webm.split("/").at(-1)}`,
    poster: `./${contractPaths.poster.split("/").at(-1)}`,
    captions: `./${contractPaths.captions.split("/").at(-1)}`,
    masterSha256: files[key].master.sha256,
    mp4Sha256: files[key].mp4.sha256,
    webmSha256: files[key].webm.sha256,
    posterSha256: files[key].poster.sha256,
    captionsSha256: files[key].captions.sha256,
    durationSeconds: 57,
    frameCount: 1368,
    fps: 24
  });
  const media = {
    schemaVersion: 2,
    contractVersion: manifest.contractVersion,
    contractSha256,
    approval: releaseApproval,
    variants: {
      promise: record("opening", paths.opening, promiseApproval),
      completion: record("completion", paths.completion, completionApproval)
    }
  };
  await writeFixture(root, DEFAULT_VOYAGE_APPROVED_MEDIA_MANIFEST_PATH, `${JSON.stringify(media, null, 2)}\n`);
  return { root, manifest, media };
}

test("the versioned Voyage Projection production contract is deterministic and valid before final media exists", async () => {
  const manifest = await loadVoyageProductionManifest();
  const report = validateVoyageProductionManifest(manifest);

  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(manifest.contractVersion, "1.2.0");
  assert.equal(report.digest, EXPECTED_CONTRACT_DIGEST);
  assert.equal(voyageProductionManifestDigest(clone(manifest)), EXPECTED_CONTRACT_DIGEST);
  assert.deepEqual(report.warnings, [
    "Provenance navigation-voice is pending and must be documented before final media ships.",
    "Provenance score-and-sound-design is pending and must be documented before final media ships."
  ]);
});

test("poster extraction remains locked to graded 1080p frames with bounded delivery", async () => {
  const manifest = await loadVoyageProductionManifest();
  const posters = manifest.deliverables.find((entry) => entry.kind === "poster");
  assert.deepEqual(manifest.technical.posters, {
    width: 1920,
    height: 1080,
    format: "webp",
    maximumBytesEach: 650000,
    maximumBytesCombined: 1950000,
    source: "graded-composite",
    evidencePath: "production/voyage-projection/poster-evidence.json",
    frames: APPROVED_VOYAGE_POSTERS.map((poster) => ({ ...poster }))
  });
  assert.equal(posters.evidencePath, manifest.technical.posters.evidencePath);
  assert.deepEqual(posters.variants, ["promise", "progress", "completion"]);
  assert.equal(posters.paths.length, 3);
});

test("production shots and voice cues cannot drift from the realtime projection", async () => {
  const manifest = await loadVoyageProductionManifest();
  assert.equal(manifest.durationSeconds, VOYAGE_DURATION_SECONDS);

  for (const variant of manifest.variants) {
    assert.deepEqual(
      createVoyageTimeline(variant.id).map(({ id, startSeconds, endSeconds, setting }) => ({
        id,
        startSeconds,
        endSeconds,
        setting
      })),
      variant.shotIds.map((id) => {
        const shot = manifest.shots.find((candidate) => candidate.id === id);
        return { id: shot.id, startSeconds: shot.startSeconds, endSeconds: shot.endSeconds, setting: shot.setting };
      })
    );
  }

  assert.deepEqual(
    APPROVED_VOYAGE_SHOTS,
    manifest.shots.map(({ id, startSeconds, endSeconds, setting }) => ({ id, startSeconds, endSeconds, setting }))
  );
  assert.deepEqual(
    VOYAGE_NARRATION.map(({ id, startSeconds, endSeconds, shotId, text, variants }) => ({
      id,
      startSeconds,
      endSeconds,
      shotId,
      text,
      variants: [...variants]
    })),
    APPROVED_VOYAGE_NARRATION.map((cue) => ({ ...cue, variants: [...cue.variants] }))
  );
  assert.deepEqual(manifest.narration.cues, APPROVED_VOYAGE_NARRATION.map((cue) => ({
    ...cue,
    variants: [...cue.variants]
  })));
});

test("all AI work is isolated behind an authoritative 3D matte and excludes every protected element", async () => {
  const manifest = await loadVoyageProductionManifest();
  const passes = new Map(manifest.passes.map((pass) => [pass.id, pass]));
  const protectedElements = manifest.authorityPolicy.authoritativeElements;
  const allowed = new Set(manifest.authorityPolicy.aiAllowedElements);
  const aiPasses = manifest.passes.filter((pass) => pass.kind === "ai-assisted-vfx");

  assert.ok(aiPasses.length >= 6);
  for (const pass of aiPasses) {
    assert.equal(pass.isolated, true);
    assert.equal(pass.alphaOutput, true);
    assert.equal(pass.mask.required, true);
    assert.equal(passes.get(pass.mask.sourcePassId).kind, "authoritative-mask");
    assert.equal(passes.get(pass.mask.sourcePassId).aiAllowed, false);
    assert.ok(pass.mayAffect.every((element) => allowed.has(element)));
    assert.ok(protectedElements.every((element) => pass.mustNotAffect.includes(element)));
    assert.ok(pass.mayAffect.every((element) => !protectedElements.includes(element)));
  }
  assert.equal(manifest.authorityPolicy.protectedPixelDeltaMaximum, 0);
  assert.equal(manifest.qualityGates.protectedPixelComparison.maximumChangedPixels, 0);
});

test("validator rejects AI access to camera or rocket and rejects non-authoritative masks", async () => {
  const manifest = clone(await loadVoyageProductionManifest());
  const pass = manifest.passes.find((entry) => entry.id === "ai-deep-field");
  pass.mayAffect.push("camera", "rocket");
  pass.mustNotAffect = pass.mustNotAffect.filter((element) => !["camera", "rocket"].includes(element));
  pass.mask.sourcePassId = "beauty-3d";

  const report = validateVoyageProductionManifest(manifest);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes("may not affect protected or undeclared element camera")));
  assert.ok(report.errors.some((error) => error.includes("may not affect protected or undeclared element rocket")));
  assert.ok(report.errors.some((error) => error.includes("must explicitly exclude camera")));
  assert.ok(report.errors.some((error) => error.includes("non-AI authoritative-mask")));
});

test("validator rejects timeline, narration, and delivery fallback drift", async () => {
  const manifest = clone(await loadVoyageProductionManifest());
  manifest.shots.find((shot) => shot.id === "warp").startSeconds = 28;
  manifest.narration.cues.find((cue) => cue.id === "make-one").text = "We made it.";
  manifest.deliverables.find((entry) => entry.kind === "reduced-motion").durationSeconds = 57;
  manifest.deliverables = manifest.deliverables.filter((entry) => entry.kind !== "poster");

  const report = validateVoyageProductionManifest(manifest);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes("Shot warp.startSeconds must be 27")));
  assert.ok(report.errors.some((error) => error.includes("Narration make-one.text")));
  assert.ok(report.errors.some((error) => error.includes("24-second crossfade-only")));
  assert.ok(report.errors.some((error) => error.includes("Delivery matrix is missing poster")));
});

test("the normal contract tolerates unfinished masters while the final release gate blocks undocumented rights", async () => {
  const manifest = await loadVoyageProductionManifest();
  const contract = validateVoyageProductionManifest(manifest);
  const release = validateVoyageProductionManifest(manifest, { release: true });
  const requiredFiles = await validateVoyageProductionDeliverables(manifest);

  assert.equal(contract.valid, true);
  assert.equal(release.valid, false);
  assert.ok(!release.errors.some((error) => error.includes("ai-vfx-renderer")));
  assert.ok(release.errors.some((error) => error.includes("navigation-voice")));
  assert.ok(release.errors.some((error) => error.includes("score-and-sound-design")));
  assert.equal(requiredFiles.valid, true, requiredFiles.errors.join("\n"));
  assert.deepEqual(requiredFiles.checked, [
    "public/voyage-projection-domain.mjs",
    "public/voyage-projection-runtime.mjs",
    "public/voyage-projection-scene.mjs"
  ]);
});

test("AI provider provenance is required only when an optional AI pass is explicitly enabled", async () => {
  const manifest = await loadVoyageProductionManifest();
  const provider = manifest.provenance.find((record) => record.id === "ai-vfx-renderer");
  assert.equal(voyageProvenanceRequiredForRelease(manifest, provider), false);

  const enabled = clone(manifest);
  enabled.passes.find((pass) => pass.id === "ai-deep-field").enabled = true;
  assert.equal(voyageProvenanceRequiredForRelease(enabled, provider), true);
  const result = validateVoyageProductionManifest(enabled, { release: true });
  assert.ok(result.errors.some((error) => error.includes("ai-vfx-renderer")));
});

test("the delivery matrix includes realtime, masters, web video, reduced motion, and posters", async () => {
  const manifest = await loadVoyageProductionManifest();
  const kinds = new Set(manifest.deliverables.map((entry) => entry.kind));
  assert.deepEqual(kinds, new Set([
    "realtime",
    "pre-render-master",
    "pre-render-web",
    "reduced-motion",
    "poster"
  ]));
  assert.deepEqual(
    manifest.deliverables.find((entry) => entry.id === "realtime-projection").variants,
    ["promise", "progress", "completion"]
  );
  assert.equal(manifest.deliverables.find((entry) => entry.id === "opening-master").requiredFiles, false);
  assert.equal(manifest.deliverables.find((entry) => entry.id === "finale-master").requiredFiles, false);
  assert.equal(manifest.qualityGates.accessibility.noProgressionMutationOnReplay, true);
  assert.equal(manifest.qualityGates.accessibility.skipAlwaysAvailable, true);
});

test("approved media validation binds every final file, path, hash, approval, and probed stream", async (t) => {
  const fixture = await approvedMediaFixture(t);
  const probeMedia = async (_path, context) => approvedProbe(context.kind);
  const approval = await validateApprovedVoyageMediaManifest(
    fixture.manifest,
    fixture.media,
    { root: fixture.root, probeMedia }
  );
  assert.equal(approval.valid, true, approval.errors.join("\n"));
  assert.equal(approval.checked.length, 13);
  assert.ok(approval.checked.includes("production/voyage-projection/approvals/release.json"));
  assert.ok(approval.checked.includes("production/voyage-projection/approvals/promise.json"));
  assert.ok(approval.checked.includes("production/voyage-projection/approvals/completion.json"));

  const releaseFiles = await validateVoyageProductionDeliverables(fixture.manifest, {
    root: fixture.root,
    includeOptionalMedia: true,
    probeMedia
  });
  assert.equal(releaseFiles.valid, true, releaseFiles.errors.join("\n"));
  assert.ok(releaseFiles.checked.includes(DEFAULT_VOYAGE_APPROVED_MEDIA_MANIFEST_PATH));
  assert.ok(releaseFiles.checked.includes("public/cinematic/voyage-projection-opening-master.webm"));
  assert.ok(releaseFiles.checked.includes("public/cinematic/voyage-projection-finale-master.webm"));
});

test("approved media fails closed on path, hash, metadata, codec, dimensions, or audio drift", async (t) => {
  const fixture = await approvedMediaFixture(t);
  const drifted = clone(fixture.media);
  drifted.variants.promise.mp4 = "./cinematic/not-the-approved-master.mp4";
  drifted.variants.promise.mp4Sha256 = "e".repeat(64);
  drifted.approval.humanApproved.reviewer = "Forged Reviewer";
  drifted.variants.promise.approval.humanApproved.evidencePath = "production/voyage-projection/approvals/missing.json";
  drifted.variants.completion.frameCount = 1367;
  drifted.variants.completion.webmSha256 = drifted.variants.completion.mp4Sha256;
  const probeMedia = async (_path, context) => {
    if (context.variant === "promise" && context.kind === "master") {
      return approvedProbe("master", {
        video: { profile: "LT", width: 1920, height: 1080 },
        audio: { codec_name: "pcm_s16le", sample_rate: "44100", bits_per_sample: 16, channels: 1 }
      });
    }
    if (context.variant === "promise" && context.kind === "mp4") {
      return approvedProbe("mp4", {
        video: { codec_name: "mpeg4", profile: "Simple", width: 1280, height: 720 },
        audio: { codec_name: "mp3", profile: "unknown", channels: 1 }
      });
    }
    if (context.variant === "completion" && context.kind === "webm") {
      return approvedProbe("webm", {
        video: { codec_name: "av1", width: 1280, nb_read_frames: "1367", avg_frame_rate: "25/1" },
        audio: { codec_name: "aac", sample_rate: "44100", channels: 6 },
        format: { duration: "56.0" }
      });
    }
    return approvedProbe(context.kind);
  };

  const report = await validateApprovedVoyageMediaManifest(
    fixture.manifest,
    drifted,
    { root: fixture.root, probeMedia }
  );
  assert.equal(report.valid, false);
  for (const expected of [
    "promise.mp4 must exactly match",
    "promise.mp4Sha256 does not match",
    "manifest approval evidence must record schemaVersion 1",
    "promise approval evidence is missing or empty",
    "promise master video must use ProRes 4444 XQ",
    "promise master must be 3840x2160",
    "promise master audio must use pcm_s24le",
    "promise master audio must be 48000 Hz",
    "promise master audio must be stereo",
    "promise master audio must be 24-bit",
    "promise mp4 must be 1920x1080",
    "promise mp4 video must use H.264 High",
    "promise mp4 audio must use aac",
    "promise mp4 audio profile must include lc",
    "promise mp4 audio must be stereo",
    "completion must lock 57 seconds, 1368 frames, and 24 fps",
    "completion final file SHA-256 values must be pairwise distinct",
    "completion webm must be 57 seconds",
    "completion webm must be 24 fps",
    "completion webm must contain exactly 1368",
    "completion webm must be 1920x1080",
    "completion webm video must use VP9",
    "completion webm audio must use opus",
    "completion webm audio must be 48000 Hz",
    "completion webm audio must be stereo"
  ]) {
    assert.ok(report.errors.some((error) => error.includes(expected)), `Missing error containing: ${expected}\n${report.errors.join("\n")}`);
  }
});

test("optional media validation preserves file blockers and rejects the public switch until explicitly approved", async () => {
  const manifest = await loadVoyageProductionManifest();
  const report = await validateVoyageProductionDeliverables(manifest, {
    includeOptionalMedia: true,
    probeMedia: async () => { throw new Error("unapproved media must never be probed"); }
  });
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes("Deliverable opening-master is missing")));
  assert.ok(report.errors.some((error) => error.includes("lacks auditable approval and humanApproved evidence")));
  assert.ok(report.errors.some((error) => error.includes("must contain exactly Promise and Completion records")));
});
