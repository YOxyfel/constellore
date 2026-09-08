import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  CLEAN_COMPOSITE_CONFIRMATION,
  FINAL_ENCODE_CONFIRMATION,
  REVIEW_CANDIDATE_CONFIRMATION,
  VOYAGE_PRODUCTION_FRAMES,
  VOYAGE_REVIEW_LOOKDEV_MANIFEST_PATH,
  VOYAGE_REVIEW_OUTPUT_ROOT,
  buildCleanCompositeOperations,
  buildVoyageEncodeCommandPlans,
  buildVoyageReviewCandidateCommandPlans,
  executeCleanComposite,
  executeVoyageReviewCandidate,
  executeVoyageEncodes,
  inspectVoyageFrameSequence,
  preflightVoyageReviewCandidate,
  preflightVoyageEncodes,
  validateCleanAuthoredCompositor
} from "../scripts/voyage-projection-compositor.mjs";
import {
  loadVoyageProductionManifest,
  voyageProductionManifestDigest
} from "../scripts/voyage-projection-production.mjs";

const root = new URL("../", import.meta.url);

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "constellore-voyage-compositor-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function writeFixture(directory, projectPath, contents) {
  const absolute = join(directory, ...projectPath.split("/"));
  await mkdir(join(absolute, ".."), { recursive: true });
  await writeFile(absolute, contents);
  return { path: projectPath, sha256: sha256(contents) };
}

function reviewAudioProbe(overrides = {}) {
  return {
    streams: [{
      codec_type: "audio",
      sample_rate: "48000",
      bits_per_sample: 24,
      channels: 2,
      ...(overrides.stream || {})
    }],
    format: { duration: "57.000000", ...(overrides.format || {}) }
  };
}

function reviewOutputProbe(preflight, plan, overrides = {}) {
  const poster = plan.kind === "review-poster";
  const video = {
    codec_type: "video",
    codec_name: poster ? "webp" : plan.container === "mp4" ? "h264" : "vp9",
    profile: plan.container === "mp4" ? "High" : "Profile 0",
    width: 1920,
    height: 1080,
    avg_frame_rate: "24/1",
    nb_read_frames: poster ? "1" : "1368",
    ...(overrides.video || {})
  };
  const audio = poster ? [] : [{
    codec_type: "audio",
    codec_name: plan.container === "mp4" ? "aac" : "opus",
    profile: plan.container === "mp4" ? "LC" : "unknown",
    sample_rate: "48000",
    channels: 2,
    ...(overrides.audio || {})
  }];
  const aiMetadata = preflight?.aiLayersEnabled
    ? ";aiLayersEnabled=true;compositionMode=underlay"
    : ";aiLayersEnabled=false";
  return {
    streams: [video, ...audio],
    format: {
      duration: poster ? undefined : "57.000000",
      tags: {
        title: "Constellore Voyage Projection - NON-SHIPPING REVIEW",
        comment: `releaseEligible=false;candidate=${preflight.candidateId};variant=${plan.variantId}${aiMetadata}`
      },
      ...(overrides.format || {})
    }
  };
}

async function reviewCandidateFixture(t) {
  const directory = await temporaryDirectory(t);
  const manifest = await loadVoyageProductionManifest();
  const audioPaths = {
    promise: [
      "output/voyage-projection/audio/stems/voyage-projection-score-unresolved-guide.wav",
      "output/voyage-projection/audio/stems/voyage-projection-sfx-unresolved-guide.wav"
    ],
    completion: [
      "output/voyage-projection/audio/stems/voyage-projection-score-completion-guide.wav",
      "output/voyage-projection/audio/stems/voyage-projection-sfx-completion-guide.wav"
    ]
  };
  const audio = {};
  for (const [variant, paths] of Object.entries(audioPaths)) {
    audio[variant] = [];
    for (const [index, path] of paths.entries()) {
      const artifact = await writeFixture(directory, path, Buffer.from(`${variant} guide audio ${index}`));
      audio[variant].push({
        ...artifact,
        projectOwned: true,
        voiceFree: true,
        releaseEligible: false
      });
    }
  }
  const audioGuideRecord = {
    schemaVersion: 1,
    status: "non-final-guide",
    releaseEligible: false,
    createsRightsEvidence: false,
    contract: { sha256: voyageProductionManifestDigest(manifest) },
    voice: { included: false, status: "absent" },
    outputs: [
      ...audio.promise.map((artifact) => ({
        path: artifact.path,
        sha256: artifact.sha256,
        guideOnly: true,
        voiceIncluded: false,
        variants: ["promise", "progress"]
      })),
      ...audio.completion.map((artifact) => ({
        path: artifact.path,
        sha256: artifact.sha256,
        guideOnly: true,
        voiceIncluded: false,
        variants: ["completion"]
      }))
    ]
  };
  const audioGuideArtifact = await writeFixture(
    directory,
    "production/voyage-projection/scaffold/provenance/audio-guide-record.json",
    Buffer.from(`${JSON.stringify(audioGuideRecord, null, 2)}\n`)
  );
  const colorEvidence = await writeFixture(
    directory,
    "production/voyage-projection/review-exr-color-evidence.json",
    Buffer.from("fixture applied ACES view transform")
  );
  await writeFixture(directory, "output/voyage-projection/review-renders/promise/frame-0000.png", Buffer.from("png-first"));
  await writeFixture(directory, "output/voyage-projection/review-renders/promise/frame-1367.png", Buffer.from("png-last"));
  await writeFixture(directory, "output/voyage-projection/review-renders/completion/frame-0000.exr", Buffer.from("exr-first"));
  await writeFixture(directory, "output/voyage-projection/review-renders/completion/frame-1367.exr", Buffer.from("exr-last"));
  const candidate = {
    schemaVersion: 1,
    kind: "voyage-review-candidate",
    candidateId: "lighting-pass-03",
    contractSha256: voyageProductionManifestDigest(manifest),
    releaseEligible: false,
    shipping: false,
    cleanAuthored3d: true,
    aiLayersEnabled: false,
    durationSeconds: 57,
    frameCount: 1368,
    fps: 24,
    audioGuideRecord: audioGuideArtifact,
    variants: {
      promise: {
        authoredTimeline: true,
        framePattern: "output/voyage-projection/review-renders/promise/frame-%04d.png",
        audio: audio.promise
      },
      completion: {
        authoredTimeline: true,
        framePattern: "output/voyage-projection/review-renders/completion/frame-%04d.exr",
        exrColor: {
          sourceColorSpace: "ACEScg",
          viewTransformApplied: true,
          viewTransform: "ACES 1.3 Output - Rec.709 Gamma 2.4",
          deliveryColorSpace: "Rec.709 Gamma 2.4",
          evidence: colorEvidence
        },
        audio: audio.completion
      }
    }
  };
  const inspectSequence = async ({ pattern, startFrame, endFrameExclusive }) => ({
    pattern,
    startFrame,
    endFrameExclusive,
    expectedFrames: endFrameExclusive - startFrame,
    presentFrames: endFrameExclusive - startFrame,
    complete: true,
    totalBytes: 123,
    aggregateSha256: sha256(Buffer.from(`review:${pattern}`)),
    missing: [],
    records: []
  });
  const probeFrameSequence = async ({ extension }) => ({
    first: { streams: [{ codec_type: "video", codec_name: extension === ".png" ? "png" : "exr", width: 1920, height: 1080 }] },
    last: { streams: [{ codec_type: "video", codec_name: extension === ".png" ? "png" : "exr", width: 1920, height: 1080 }] },
    decodedFrames: 1368
  });
  const verifyAudioGuide = async () => ({ valid: true, errors: [] });
  return { directory, manifest, candidate, inspectSequence, probeFrameSequence, verifyAudioGuide };
}

async function reviewMasterAiCandidateFixture(t) {
  const fixture = await reviewCandidateFixture(t);
  const digest = voyageProductionManifestDigest(fixture.manifest);
  const masterAudio = {};
  for (const variant of ["promise", "completion"]) {
    const path = `output/voyage-projection/audio/review/voyage-projection-${variant}-review-master.wav`;
    masterAudio[variant] = await writeFixture(
      fixture.directory,
      path,
      Buffer.from(`${variant} verified review master`)
    );
  }
  const audioReviewMasterRecord = {
    schemaVersion: 1,
    status: "project-authored-review-master-candidate",
    releaseEligible: false,
    finalMaster: false,
    contract: { sha256: digest },
    provenance: {
      projectAuthored: true,
      generativeModelOutput: false
    },
    voice: { included: false, status: "absent" },
    reviewBoundary: {
      reviewOnly: true,
      mayPopulateFinalCompositorPaths: false
    },
    outputs: ["promise", "completion"].map((variant) => ({
      id: `${variant}-review-master`,
      variant,
      path: masterAudio[variant].path,
      sha256: masterAudio[variant].sha256,
      status: "voice-free-review-master-candidate",
      reviewOnly: true,
      finalMaster: false,
      releaseEligible: false,
      voiceIncluded: false
    }))
  };
  const audioReviewMasterArtifact = await writeFixture(
    fixture.directory,
    "production/voyage-projection/scaffold/provenance/audio-review-master-record.json",
    Buffer.from(`${JSON.stringify(audioReviewMasterRecord, null, 2)}\n`)
  );

  const lookdevAssets = [];
  for (const id of ["far-field-nebula", "warp-caustics"]) {
    const artifact = await writeFixture(
      fixture.directory,
      `production/voyage-projection/lookdev/${id}.png`,
      Buffer.from(`${id} review-only look-development plate`)
    );
    lookdevAssets.push({ id, ...artifact });
  }
  const lookdevManifest = {
    schemaVersion: 1,
    contractSha256: digest,
    status: "non-shipping-look-development",
    releaseEligible: false,
    assets: lookdevAssets
  };
  const lookdevManifestArtifact = await writeFixture(
    fixture.directory,
    VOYAGE_REVIEW_LOOKDEV_MANIFEST_PATH,
    Buffer.from(`${JSON.stringify(lookdevManifest, null, 2)}\n`)
  );

  const candidate = structuredClone(fixture.candidate);
  candidate.candidateId = "ai-underlay-review-01";
  candidate.aiLayersEnabled = true;
  delete candidate.audioGuideRecord;
  candidate.audioReviewMasterRecord = audioReviewMasterArtifact;
  candidate.lookdevProvenance = {
    reviewOnly: true,
    compositionMode: "underlay",
    manifest: lookdevManifestArtifact,
    assets: lookdevAssets.map((asset) => ({ ...asset, compositionMode: "underlay" }))
  };
  candidate.variants.promise.audio = [{ ...masterAudio.promise }];
  candidate.variants.completion.audio = [{ ...masterAudio.completion }];

  return {
    ...fixture,
    candidate,
    masterAudio,
    audioReviewMasterRecord,
    lookdevManifest,
    verifyAudioReview: async () => ({ valid: true, errors: [] }),
    verifyLookdev: async () => ({ valid: true, errors: [] })
  };
}

test("frame sequence inspection reports holes and produces a deterministic aggregate", async (t) => {
  const directory = await temporaryDirectory(t);
  await writeFixture(directory, "frames/frame-0000.exr", Buffer.from("frame-zero"));
  await writeFixture(directory, "frames/frame-0001.exr", Buffer.from("frame-one"));

  const incomplete = await inspectVoyageFrameSequence({
    root: directory,
    pattern: "frames/frame-%04d.exr",
    startFrame: 0,
    endFrameExclusive: 3
  });
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.presentFrames, 2);
  assert.deepEqual(incomplete.missing, [{
    frame: 2,
    path: "frames/frame-0002.exr",
    status: "missing"
  }]);
  assert.equal(incomplete.aggregateSha256, null);

  await writeFixture(directory, "frames/frame-0002.exr", Buffer.from("frame-two"));
  const complete = await inspectVoyageFrameSequence({
    root: directory,
    pattern: "frames/frame-%04d.exr",
    startFrame: 0,
    endFrameExclusive: 3
  });
  const repeated = await inspectVoyageFrameSequence({
    root: directory,
    pattern: "frames/frame-%04d.exr",
    startFrame: 0,
    endFrameExclusive: 3
  });
  assert.equal(complete.complete, true);
  assert.match(complete.aggregateSha256, /^[a-f0-9]{64}$/);
  assert.equal(repeated.aggregateSha256, complete.aggregateSha256);

  await writeFixture(directory, "frames/frame-0001.exr", Buffer.from("changed-frame"));
  const changed = await inspectVoyageFrameSequence({
    root: directory,
    pattern: "frames/frame-%04d.exr",
    startFrame: 0,
    endFrameExclusive: 3
  });
  assert.notEqual(changed.aggregateSha256, complete.aggregateSha256);
});

test("clean compositor validation rejects AI enablement and any protected-pixel drift", async () => {
  const manifest = await loadVoyageProductionManifest();
  const compositor = JSON.parse(await readFile(new URL(
    "../production/voyage-projection/scaffold/compositor-jobs.json",
    import.meta.url
  ), "utf8"));
  const valid = validateCleanAuthoredCompositor(manifest, compositor);
  assert.equal(valid.valid, true, valid.errors.join("\n"));

  const aiEnabled = structuredClone(compositor);
  aiEnabled.jobs[0].optionalAiLayers[0].enabled = true;
  const aiReport = validateCleanAuthoredCompositor(manifest, aiEnabled);
  assert.equal(aiReport.valid, false);
  assert.ok(aiReport.errors.some((error) => error.includes("enables AI layer")));

  const changedPixels = structuredClone(compositor);
  changedPixels.jobs[0].protectedPixelCheck.result = { changedPixels: 1 };
  const pixelReport = validateCleanAuthoredCompositor(manifest, changedPixels);
  assert.equal(pixelReport.valid, false);
  assert.ok(pixelReport.errors.some((error) => error.includes("protected-pixel changes")));
});

test("clean composite plan is a byte-identity copy plus exact two-variant timeline assembly", async () => {
  const compositor = JSON.parse(await readFile(new URL(
    "../production/voyage-projection/scaffold/compositor-jobs.json",
    import.meta.url
  ), "utf8"));
  const operations = buildCleanCompositeOperations(compositor);
  const identity = operations.filter((operation) => operation.kind === "identity-composite");
  const timeline = operations.filter((operation) => operation.kind === "timeline-assembly");
  assert.equal(identity.length, VOYAGE_PRODUCTION_FRAMES * 2 + 1,
    "Promise and Completion need full clean copies; Progress contributes its one locked poster frame.");
  assert.equal(timeline.length, VOYAGE_PRODUCTION_FRAMES * 2);
  assert.equal(operations.every((operation) => operation.source !== operation.destination), true);
  assert.equal(operations.some((operation) => operation.variantId === "progress" && operation.frame === 912), true);
});

test("dry-run encode plans lock exact frames and deterministic H264/AAC plus VP9/Opus alternatives", async () => {
  const manifest = await loadVoyageProductionManifest();
  const plans = buildVoyageEncodeCommandPlans(manifest);
  assert.equal(plans.length, 4);
  for (const plan of plans) {
    assert.equal(plan.executable, "ffmpeg");
    assert.ok(plan.arguments.includes("-n"));
    assert.equal(plan.arguments.includes("-y"), false);
    const framesIndex = plan.arguments.indexOf("-frames:v");
    const durationIndex = plan.arguments.indexOf("-t");
    assert.equal(plan.arguments[framesIndex + 1], "1368");
    assert.equal(plan.arguments[durationIndex + 1], "57");
    assert.equal(plan.arguments[plan.arguments.indexOf("-threads") + 1], "1");
    assert.equal(plan.arguments.includes("-map_metadata"), true);
  }
  const h264 = plans.filter((plan) => plan.videoCodec === "h264-high");
  const vp9 = plans.filter((plan) => plan.videoCodec === "vp9");
  assert.equal(h264.length, 2);
  assert.equal(vp9.length, 2);
  assert.equal(h264.every((plan) => plan.arguments.includes("libx264") && plan.arguments.includes("aac")), true);
  assert.equal(vp9.every((plan) => plan.arguments.includes("libvpx-vp9") && plan.arguments.includes("libopus")), true);
  assert.deepEqual(vp9.map((plan) => plan.output), [
    "public/cinematic/voyage-projection-opening-master.webm",
    "public/cinematic/voyage-projection-finale-master.webm"
  ]);
});

test("review candidate tier accepts complete authored PNG and EXR timelines but emits only watermarked output artifacts", async (t) => {
  const fixture = await reviewCandidateFixture(t);
  const preflight = await preflightVoyageReviewCandidate({
    root: fixture.directory,
    manifest: fixture.manifest,
    candidate: fixture.candidate,
    probeAudio: async () => reviewAudioProbe(),
    inspectSequence: fixture.inspectSequence,
    probeFrameSequence: fixture.probeFrameSequence,
    verifyAudioGuide: fixture.verifyAudioGuide
  });
  assert.equal(preflight.ready, true, preflight.errors.join("\n"));
  assert.equal(preflight.mode, "nonshipping-review-candidate");
  assert.equal(preflight.releaseEligible, false);
  assert.equal(preflight.shipping, false);
  assert.equal(preflight.confirmationRequired, REVIEW_CANDIDATE_CONFIRMATION);
  assert.equal(preflight.plans.length, 6);
  assert.equal(preflight.plans.every((plan) => plan.releaseEligible === false), true);
  assert.equal(preflight.plans.every((plan) => plan.output.startsWith(`${VOYAGE_REVIEW_OUTPUT_ROOT}/lighting-pass-03/`)), true);
  assert.equal(preflight.plans.some((plan) => plan.output.startsWith("public/")), false);
  assert.equal(preflight.plans.every((plan) => plan.arguments.join(" ").includes("NON-SHIPPING REVIEW")), true);
  assert.deepEqual(
    preflight.plans.filter((plan) => plan.kind === "review-poster").map((plan) => plan.posterFrame),
    [168, 1272]
  );
  assert.equal(preflight.plans.filter((plan) => plan.kind === "review-video").length, 4);
  assert.equal(preflight.plans.filter((plan) => plan.container === "mp4").every((plan) => plan.arguments.includes("libx264")), true);
  assert.equal(preflight.plans.filter((plan) => plan.container === "webm").every((plan) => plan.arguments.includes("libvpx-vp9")), true);
  assert.equal(preflight.plans.filter((plan) => plan.kind === "review-video").every((plan) => plan.arguments.join(" ").includes("amix=inputs=2")), true);

  assert.deepEqual(
    buildVoyageReviewCandidateCommandPlans(fixture.manifest, fixture.candidate).map((plan) => plan.output),
    preflight.plans.map((plan) => plan.output)
  );

  const finalGate = await preflightVoyageEncodes({
    root: fixture.directory,
    manifest: fixture.manifest,
    prerequisites: fixture.candidate,
    probeAudio: async () => reviewAudioProbe(),
    inspectSequence: fixture.inspectSequence
  });
  assert.equal(finalGate.ready, false);
  assert.ok(finalGate.errors.some((error) => error.includes("Final encode prerequisites are not approved")));
  assert.ok(finalGate.errors.some((error) => error.includes("navigation-voice")));
});

test("nonshipping review candidates bind verified review-master WAVs and exact AI underlay provenance", async (t) => {
  const fixture = await reviewMasterAiCandidateFixture(t);
  const preflight = await preflightVoyageReviewCandidate({
    root: fixture.directory,
    manifest: fixture.manifest,
    candidate: fixture.candidate,
    probeAudio: async () => reviewAudioProbe(),
    inspectSequence: fixture.inspectSequence,
    probeFrameSequence: fixture.probeFrameSequence,
    verifyAudioGuide: fixture.verifyAudioGuide,
    verifyAudioReview: fixture.verifyAudioReview,
    verifyLookdev: fixture.verifyLookdev
  });
  assert.equal(preflight.ready, true, preflight.errors.join("\n"));
  assert.deepEqual(preflight.audioProvenance, {
    kind: "review-master",
    path: "production/voyage-projection/scaffold/provenance/audio-review-master-record.json",
    sha256: fixture.candidate.audioReviewMasterRecord.sha256
  });
  assert.equal(preflight.aiLayersEnabled, true);
  assert.equal(preflight.lookdevProvenance.reviewOnly, true);
  assert.equal(preflight.lookdevProvenance.compositionMode, "underlay");
  assert.equal(preflight.lookdevProvenance.assets.length, fixture.lookdevManifest.assets.length);
  for (const variant of ["promise", "completion"]) {
    const plans = preflight.plans.filter((plan) => plan.variantId === variant && plan.kind === "review-video");
    assert.equal(plans.length, 2);
    assert.deepEqual(plans[0].input.audioPaths, [fixture.masterAudio[variant].path]);
    assert.equal(plans.every((plan) => !plan.arguments.join(" ").includes("amix=")), true);
    assert.equal(plans.every((plan) => plan.arguments.join(" ").includes("aiLayersEnabled=true;compositionMode=underlay")), true);
  }
  const encoded = await executeVoyageReviewCandidate(preflight, {
    root: fixture.directory,
    confirmation: REVIEW_CANDIDATE_CONFIRMATION,
    execute: async (_executable, arguments_) => {
      await writeFile(arguments_.at(-1), Buffer.from("fixture AI-underlay review encode"));
    },
    probeMedia: async (_path, { preflight: review, plan }) => reviewOutputProbe(review, plan),
    decodeMedia: async () => {}
  });
  assert.equal(encoded.outputs.length, 6);
  assert.equal(encoded.outputs.every((output) => output.releaseEligible === false), true);

  const finalGate = await preflightVoyageEncodes({
    root: fixture.directory,
    manifest: fixture.manifest,
    prerequisites: fixture.candidate,
    probeAudio: async () => reviewAudioProbe(),
    inspectSequence: fixture.inspectSequence
  });
  assert.equal(finalGate.ready, false);
  assert.ok(finalGate.errors.some((error) => error.includes("every AI layer disabled")));
});

test("AI-enabled review candidates fail closed on malformed or incomplete underlay provenance", async (t) => {
  const fixture = await reviewMasterAiCandidateFixture(t);
  const cases = [
    {
      label: "review-only flag",
      mutate(candidate) { candidate.lookdevProvenance.reviewOnly = false; },
      expected: "explicit reviewOnly"
    },
    {
      label: "composition mode",
      mutate(candidate) { candidate.lookdevProvenance.compositionMode = "overlay"; },
      expected: "compositionMode=underlay"
    },
    {
      label: "manifest digest",
      mutate(candidate) { candidate.lookdevProvenance.manifest.sha256 = "f".repeat(64); },
      expected: "does not match its bound SHA-256"
    },
    {
      label: "complete asset set",
      mutate(candidate) { candidate.lookdevProvenance.assets.pop(); },
      expected: "every verified manifest asset exactly once"
    },
    {
      label: "asset digest",
      mutate(candidate) { candidate.lookdevProvenance.assets[0].sha256 = "e".repeat(64); },
      expected: "does not exactly match the verified manifest"
    },
    {
      label: "duplicate asset",
      mutate(candidate) { candidate.lookdevProvenance.assets[1].id = candidate.lookdevProvenance.assets[0].id; },
      expected: "Every AI review asset must be unique"
    }
  ];
  for (const entry of cases) {
    const candidate = structuredClone(fixture.candidate);
    entry.mutate(candidate);
    const preflight = await preflightVoyageReviewCandidate({
      root: fixture.directory,
      manifest: fixture.manifest,
      candidate,
      probeAudio: async () => reviewAudioProbe(),
      inspectSequence: fixture.inspectSequence,
      probeFrameSequence: fixture.probeFrameSequence,
      verifyAudioGuide: fixture.verifyAudioGuide,
      verifyAudioReview: fixture.verifyAudioReview,
      verifyLookdev: fixture.verifyLookdev
    });
    assert.equal(preflight.ready, false, entry.label);
    assert.deepEqual(preflight.plans, [], entry.label);
    assert.ok(
      preflight.errors.some((error) => error.includes(entry.expected)),
      `${entry.label}: missing ${entry.expected}\n${preflight.errors.join("\n")}`
    );
  }

  const verifierFailure = await preflightVoyageReviewCandidate({
    root: fixture.directory,
    manifest: fixture.manifest,
    candidate: fixture.candidate,
    probeAudio: async () => reviewAudioProbe(),
    inspectSequence: fixture.inspectSequence,
    probeFrameSequence: fixture.probeFrameSequence,
    verifyAudioGuide: fixture.verifyAudioGuide,
    verifyAudioReview: fixture.verifyAudioReview,
    verifyLookdev: async () => ({ valid: false, errors: ["fixture lookdev failure"] })
  });
  assert.equal(verifierFailure.ready, false);
  assert.ok(verifierFailure.errors.some((error) => error.includes("fixture lookdev failure")));
});

test("review-master audio binding is exact, singular per variant, and verifier-backed", async (t) => {
  const fixture = await reviewMasterAiCandidateFixture(t);
  const cases = [
    {
      label: "both provenance records",
      mutate(candidate) { candidate.audioGuideRecord = { ...fixture.candidate.audioReviewMasterRecord }; },
      expected: "exactly one audio provenance record"
    },
    {
      label: "swapped variant",
      mutate(candidate) { candidate.variants.promise.audio = [{ ...fixture.masterAudio.completion }]; },
      expected: "not the exact promise WAV"
    },
    {
      label: "wrong audio digest",
      mutate(candidate) { candidate.variants.promise.audio[0].sha256 = "a".repeat(64); },
      expected: "not the exact promise WAV"
    },
    {
      label: "multiple master WAVs",
      mutate(candidate) { candidate.variants.promise.audio.push({ ...fixture.masterAudio.completion }); },
      expected: "exactly one verified variant WAV"
    }
  ];
  for (const entry of cases) {
    const candidate = structuredClone(fixture.candidate);
    entry.mutate(candidate);
    const preflight = await preflightVoyageReviewCandidate({
      root: fixture.directory,
      manifest: fixture.manifest,
      candidate,
      probeAudio: async () => reviewAudioProbe(),
      inspectSequence: fixture.inspectSequence,
      probeFrameSequence: fixture.probeFrameSequence,
      verifyAudioGuide: fixture.verifyAudioGuide,
      verifyAudioReview: fixture.verifyAudioReview,
      verifyLookdev: fixture.verifyLookdev
    });
    assert.equal(preflight.ready, false, entry.label);
    assert.deepEqual(preflight.plans, [], entry.label);
    assert.ok(preflight.errors.some((error) => error.includes(entry.expected)), preflight.errors.join("\n"));
  }

  const verifierFailure = await preflightVoyageReviewCandidate({
    root: fixture.directory,
    manifest: fixture.manifest,
    candidate: fixture.candidate,
    probeAudio: async () => reviewAudioProbe(),
    inspectSequence: fixture.inspectSequence,
    probeFrameSequence: fixture.probeFrameSequence,
    verifyAudioGuide: fixture.verifyAudioGuide,
    verifyAudioReview: async () => ({ valid: false, errors: ["fixture review-master failure"] }),
    verifyLookdev: fixture.verifyLookdev
  });
  assert.equal(verifierFailure.ready, false);
  assert.ok(verifierFailure.errors.some((error) => error.includes("fixture review-master failure")));
});

test("review candidate preflight rejects incomplete, public, unprovenanced, untransformed, or undecodable sources", async (t) => {
  const fixture = await reviewCandidateFixture(t);
  const candidate = structuredClone(fixture.candidate);
  candidate.releaseEligible = true;
  candidate.shipping = true;
  candidate.variants.promise.framePattern = "public/cinematic/frame-%04d.png";
  candidate.variants.promise.audio[0].path = "output/voyage-projection/audio/stems/self-asserted.wav";
  delete candidate.variants.completion.exrColor;
  candidate.variants.completion.audio[0].sha256 = "f".repeat(64);
  const inspectSequence = async (options) => ({
    ...(await fixture.inspectSequence(options)),
    presentFrames: 1367,
    complete: false
  });
  const probeAudio = async (_path, context) => context.variant === "completion" && context.index === 1
    ? reviewAudioProbe({
      stream: { sample_rate: "44100", bits_per_sample: 16, channels: 1 },
      format: { duration: "56.0" }
    })
    : reviewAudioProbe();

  const report = await preflightVoyageReviewCandidate({
    root: fixture.directory,
    manifest: fixture.manifest,
    candidate,
    probeAudio,
    inspectSequence,
    probeFrameSequence: async ({ extension, variant }) => variant === "completion"
      ? { first: { streams: [] }, last: { streams: [] }, decodedFrames: 3 }
      : fixture.probeFrameSequence({ extension }),
    verifyAudioGuide: fixture.verifyAudioGuide
  });
  assert.equal(report.ready, false);
  assert.deepEqual(report.plans, []);
  for (const expected of [
    "explicitly remain non-shipping and releaseEligible false",
    "promise review framePattern must be a PNG or EXR sequence under output",
    "promise review audio[0] is not bound to an approved variant entry",
    "completion EXR review timeline requires an applied, named ACEScg",
    "completion authored review timeline is incomplete (1367/1368)",
    "completion authored review timeline must decode all 1368 frames",
    "completion authored review timeline first frame is not a decodable EXR",
    "completion review audio[0] is not bound to an approved variant entry",
    "completion review audio[1] must be 48 kHz",
    "completion review audio[1] must be 24-bit",
    "completion review audio[1] must be stereo",
    "completion review audio[1] must be 57 seconds"
  ]) {
    assert.ok(report.errors.some((error) => error.includes(expected)), `Missing error containing: ${expected}\n${report.errors.join("\n")}`);
  }
});

test("review candidate frame inputs cannot escape through a directory junction", async (t) => {
  const fixture = await reviewCandidateFixture(t);
  const outside = await temporaryDirectory(t);
  await writeFixture(outside, "frame-0000.png", Buffer.from("outside-first"));
  await writeFixture(outside, "frame-1367.png", Buffer.from("outside-last"));
  const junctionParent = join(fixture.directory, "output", "voyage-projection", "review-renders");
  const junctionPath = join(junctionParent, "junction-escape");
  await mkdir(junctionParent, { recursive: true });
  try {
    await symlink(outside, junctionPath, "junction");
  } catch (error) {
    t.skip(`Directory junction creation is unavailable: ${error.code || error.message}`);
    return;
  }
  const candidate = structuredClone(fixture.candidate);
  candidate.variants.promise.framePattern =
    "output/voyage-projection/review-renders/junction-escape/frame-%04d.png";
  const report = await preflightVoyageReviewCandidate({
    root: fixture.directory,
    manifest: fixture.manifest,
    candidate,
    probeAudio: async () => reviewAudioProbe(),
    inspectSequence: fixture.inspectSequence,
    probeFrameSequence: fixture.probeFrameSequence,
    verifyAudioGuide: fixture.verifyAudioGuide
  });
  assert.equal(report.ready, false);
  assert.ok(report.errors.some((error) => error.includes("resolves outside the project root")), report.errors.join("\n"));
});

test("review candidate execution requires its own confirmation, cannot target public, and never overwrites", async (t) => {
  const fixture = await reviewCandidateFixture(t);
  const preflight = await preflightVoyageReviewCandidate({
    root: fixture.directory,
    manifest: fixture.manifest,
    candidate: fixture.candidate,
    probeAudio: async () => reviewAudioProbe(),
    inspectSequence: fixture.inspectSequence,
    probeFrameSequence: fixture.probeFrameSequence,
    verifyAudioGuide: fixture.verifyAudioGuide
  });
  assert.equal(preflight.ready, true, preflight.errors.join("\n"));

  await assert.rejects(
    executeVoyageReviewCandidate(preflight, { root: fixture.directory, confirmation: "yes" }),
    new RegExp(REVIEW_CANDIDATE_CONFIRMATION)
  );
  const escaped = {
    ...preflight,
    plans: [{ ...preflight.plans[0], output: "public/cinematic/forbidden-review.mp4" }]
  };
  await assert.rejects(
    executeVoyageReviewCandidate(escaped, {
      root: fixture.directory,
      confirmation: REVIEW_CANDIDATE_CONFIRMATION,
      execute: async () => {}
    }),
    /escape the non-shipping output boundary/
  );

  let executeCount = 0;
  const execute = async (_executable, arguments_) => {
    executeCount += 1;
    const output = arguments_.at(-1);
    await writeFile(output, Buffer.from(`encoded ${output}`));
  };
  const probeMedia = async (_path, { preflight: review, plan }) => reviewOutputProbe(review, plan);
  let decodeCount = 0;
  const decodeMedia = async () => { decodeCount += 1; };
  const result = await executeVoyageReviewCandidate(preflight, {
    root: fixture.directory,
    confirmation: REVIEW_CANDIDATE_CONFIRMATION,
    execute,
    probeMedia,
    decodeMedia
  });
  assert.equal(result.releaseEligible, false);
  assert.equal(result.shipping, false);
  assert.equal(result.outputs.length, 6);
  assert.equal(result.outputs.every((output) => output.releaseEligible === false && output.status === "present"), true);
  assert.equal(result.outputs.every((output) => output.metadataPath.endsWith(".review.json")), true);
  assert.equal(executeCount, 6);
  assert.equal(decodeCount, 6);

  const resumed = await executeVoyageReviewCandidate(preflight, {
    root: fixture.directory,
    confirmation: REVIEW_CANDIDATE_CONFIRMATION,
    execute,
    probeMedia,
    decodeMedia
  });
  assert.equal(resumed.outputs.length, 6);
  assert.equal(executeCount, 6, "validated outputs must resume without re-encoding");
  assert.equal(decodeCount, 12, "resumed outputs must still be decoded and probed");

  await assert.rejects(
    executeVoyageReviewCandidate(preflight, {
      root: fixture.directory,
      confirmation: REVIEW_CANDIDATE_CONFIRMATION,
      execute,
      probeMedia: async (_path, { preflight: review, plan }) => reviewOutputProbe(review, plan, { video: { width: 1280 } }),
      decodeMedia
    }),
    /must be 1920x1080/
  );
});

test("failed review output validation never promotes staged media and leaves a resumable clean boundary", async (t) => {
  const fixture = await reviewCandidateFixture(t);
  const preflight = await preflightVoyageReviewCandidate({
    root: fixture.directory,
    manifest: fixture.manifest,
    candidate: fixture.candidate,
    probeAudio: async () => reviewAudioProbe(),
    inspectSequence: fixture.inspectSequence,
    probeFrameSequence: fixture.probeFrameSequence,
    verifyAudioGuide: fixture.verifyAudioGuide
  });
  assert.equal(preflight.ready, true, preflight.errors.join("\n"));
  const firstPlan = preflight.plans[0];
  await assert.rejects(
    executeVoyageReviewCandidate(preflight, {
      root: fixture.directory,
      confirmation: REVIEW_CANDIDATE_CONFIRMATION,
      execute: async (_executable, arguments_) => {
        await writeFile(arguments_.at(-1), Buffer.from("corrupt encoded candidate"));
      },
      probeMedia: async (_path, { preflight: review, plan }) => reviewOutputProbe(review, plan, {
        video: { codec_name: "mpeg4" }
      }),
      decodeMedia: async () => {}
    }),
    /must use H\.264 High/
  );
  await assert.rejects(
    readFile(join(fixture.directory, ...firstPlan.output.split("/"))),
    (error) => error?.code === "ENOENT"
  );
  const candidateDirectory = join(fixture.directory, ...`${VOYAGE_REVIEW_OUTPUT_ROOT}/${preflight.candidateId}`.split("/"));
  assert.equal((await readdir(candidateDirectory)).some((name) => name.startsWith(".encode-staging-")), false);
});

test("final encode preflight binds complete frame hashes, audio probes, color evidence, provenance, and approvals", async (t) => {
  const directory = await temporaryDirectory(t);
  const manifest = await loadVoyageProductionManifest();
  const digest = voyageProductionManifestDigest(manifest);

  const colorEvidence = await writeFixture(directory, "evidence/color.txt", Buffer.from("approved color transform"));
  const authoredEvidence = await writeFixture(directory, "evidence/authored.txt", Buffer.from("authored 3d rights"));
  const voiceEvidence = await writeFixture(directory, "evidence/voice.txt", Buffer.from("voice rights"));
  const soundEvidence = await writeFixture(directory, "evidence/sound.txt", Buffer.from("sound rights"));
  const openingAudio = await writeFixture(
    directory,
    "output/voyage-projection/audio/voyage-projection-opening-master.wav",
    Buffer.from("fixture opening audio bytes")
  );
  const finaleAudio = await writeFixture(
    directory,
    "output/voyage-projection/audio/voyage-projection-finale-master.wav",
    Buffer.from("fixture finale audio bytes")
  );

  const sequenceHash = (pattern) => sha256(Buffer.from(`complete:${pattern}`));
  const inspectSequence = async ({ pattern, startFrame, endFrameExclusive }) => ({
    pattern,
    startFrame,
    endFrameExclusive,
    expectedFrames: endFrameExclusive - startFrame,
    presentFrames: endFrameExclusive - startFrame,
    complete: true,
    totalBytes: 123,
    aggregateSha256: sequenceHash(pattern),
    missing: [],
    records: []
  });
  const humanApproval = { reviewer: "Fixture Reviewer", approvedAt: "2026-08-06T12:00:00Z" };
  const evidenceRecord = (artifact) => ({ status: "documented", commercialUseDocumented: true, evidence: [artifact] });
  const audioRecord = (artifact) => ({
    path: artifact.path,
    sha256: artifact.sha256,
    sampleRateHz: 48_000,
    bitDepth: 24,
    durationFrames: 1368,
    truePeakDbfs: -1.2,
    mastered: true
  });
  const prerequisites = {
    schemaVersion: 1,
    contractSha256: digest,
    status: "approved",
    cleanAuthored3d: true,
    aiLayersEnabled: false,
    color: {
      sourceColorSpace: "ACEScg",
      deliveryColorSpace: "Rec.709 Gamma 2.4",
      transformApplied: true,
      transformName: "Fixture ACES 1.3 output transform",
      tool: "OpenColorIO",
      toolVersion: "2.4-fixture",
      evidence: colorEvidence,
      humanApproval
    },
    provenance: {
      "authoritative-3d-production": evidenceRecord(authoredEvidence),
      "navigation-voice": evidenceRecord(voiceEvidence),
      "score-and-sound-design": evidenceRecord(soundEvidence)
    },
    approvals: Object.fromEntries([
      "creative", "continuity", "accessibility", "rights-and-provenance"
    ].map((id) => [id, humanApproval])),
    composites: {
      promise: {
        pattern: "output/voyage-projection/composites/promise/timeline/frame-%04d.exr",
        frames: 1368,
        aggregateSha256: sequenceHash("output/voyage-projection/composites/promise/timeline/frame-%04d.exr"),
        colorSpace: "Rec.709 Gamma 2.4"
      },
      completion: {
        pattern: "output/voyage-projection/composites/completion/timeline/frame-%04d.exr",
        frames: 1368,
        aggregateSha256: sequenceHash("output/voyage-projection/composites/completion/timeline/frame-%04d.exr"),
        colorSpace: "Rec.709 Gamma 2.4"
      }
    },
    audio: {
      promise: audioRecord(openingAudio),
      completion: audioRecord(finaleAudio)
    }
  };
  const probeAudio = async () => ({
    streams: [{ codec_type: "audio", sample_rate: "48000", bits_per_sample: 24, channels: 2 }],
    format: { duration: "57.000000" }
  });

  const ready = await preflightVoyageEncodes({
    root: directory,
    manifest,
    prerequisites,
    probeAudio,
    inspectSequence
  });
  assert.equal(ready.ready, true, ready.errors.join("\n"));
  assert.equal(ready.plans.length, 4);

  const aiEnabled = structuredClone(prerequisites);
  aiEnabled.aiLayersEnabled = true;
  const blocked = await preflightVoyageEncodes({
    root: directory,
    manifest,
    prerequisites: aiEnabled,
    probeAudio,
    inspectSequence
  });
  assert.equal(blocked.ready, false);
  assert.ok(blocked.errors.some((error) => error.includes("every AI layer disabled")));
});

test("both write phases reject execution before work unless their exact confirmation is supplied", async (t) => {
  const directory = await temporaryDirectory(t);
  await assert.rejects(
    executeCleanComposite({ ready: true, operations: [] }, { root: directory, confirmation: "yes" }),
    new RegExp(CLEAN_COMPOSITE_CONFIRMATION)
  );
  await assert.rejects(
    executeVoyageEncodes({ ready: true, plans: [] }, { root: directory, confirmation: "yes" }),
    new RegExp(FINAL_ENCODE_CONFIRMATION)
  );

  const clean = await executeCleanComposite(
    { ready: true, operations: [] },
    { root: directory, confirmation: CLEAN_COMPOSITE_CONFIRMATION }
  );
  assert.deepEqual(clean, { copied: 0, alreadyIdentical: 0 });

  const encoded = await executeVoyageEncodes(
    { ready: true, plans: [] },
    { root: directory, confirmation: FINAL_ENCODE_CONFIRMATION }
  );
  assert.deepEqual(encoded, []);
});

test("clean identity execution never overwrites a non-identical output", async (t) => {
  const directory = await temporaryDirectory(t);
  await writeFixture(directory, "renders/frame-0000.exr", Buffer.from("real beauty frame"));
  const preflight = {
    ready: true,
    errors: [],
    operations: [{
      kind: "identity-composite",
      source: "renders/frame-0000.exr",
      destination: "composites/frame-0000.exr"
    }]
  };
  const first = await executeCleanComposite(preflight, {
    root: directory,
    confirmation: CLEAN_COMPOSITE_CONFIRMATION
  });
  assert.deepEqual(first, { copied: 1, alreadyIdentical: 0 });
  assert.equal(await readFile(join(directory, "composites", "frame-0000.exr"), "utf8"), "real beauty frame");

  const second = await executeCleanComposite(preflight, {
    root: directory,
    confirmation: CLEAN_COMPOSITE_CONFIRMATION
  });
  assert.deepEqual(second, { copied: 0, alreadyIdentical: 1 });

  await writeFile(join(directory, "composites", "frame-0000.exr"), "different output");
  await assert.rejects(
    executeCleanComposite(preflight, {
      root: directory,
      confirmation: CLEAN_COMPOSITE_CONFIRMATION
    }),
    /Refusing to replace non-identical composite output/
  );
});
