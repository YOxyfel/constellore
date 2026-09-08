import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { buildVoyageOfflinePlan } from "../scripts/voyage-projection-offline-plan.mjs";
import {
  FULL_REVIEW_RENDER_CONFIRMATION,
  materializeVoyageReviewFrame,
  orchestrateVoyageFullReview,
  validateVoyageRendererShotDiversity,
  validateVoyageFullReviewPlans
} from "../scripts/voyage-projection-full-review-render.mjs";
import {
  loadVoyageProductionManifest,
  voyageProductionManifestDigest
} from "../scripts/voyage-projection-production.mjs";

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "constellore-voyage-full-review-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function fixturePng(width, height, marker = "") {
  const buffer = Buffer.alloc(24 + Buffer.byteLength(marker));
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer.write(marker, 24);
  return buffer;
}

async function writeFixture(root, projectPath, contents) {
  const absolute = join(root, ...projectPath.split("/"));
  await mkdir(join(absolute, ".."), { recursive: true });
  await writeFile(absolute, contents);
  return { path: projectPath, bytes: contents.length, sha256: sha256(contents) };
}

function syntheticPlan(manifest, variant) {
  const frames = Array.from({ length: 1368 }, (_, frame) => {
    const shared = frame < 1272;
    return {
      frame,
      timelineSeconds: frame / 24,
      shotId: shared ? "shared-voyage" : variant === "promise" ? "return" : "beyond",
      state: shared ? { phase: frame } : { phase: frame, ending: variant }
    };
  });
  return {
    schemaVersion: 1,
    purpose: "authoritative-offline-render-input",
    releaseEligible: false,
    contractSha256: voyageProductionManifestDigest(manifest),
    variant,
    fps: 24,
    totalTimelineFrames: 1368,
    frameRange: { startFrame: 0, endFrameExclusive: 1368, lastFrame: 1367 },
    sources: [{ path: "public/voyage-projection-scene.mjs", sha256: "a".repeat(64) }],
    assets: { earth: { sha256: "b".repeat(64) } },
    frames
  };
}

test("current Promise and Completion offline plans share exactly frames 0000-1271 and diverge for the finale", async () => {
  const manifest = await loadVoyageProductionManifest();
  const [promisePlan, completionPlan] = await Promise.all([
    buildVoyageOfflinePlan({ variant: "promise", startFrame: 0, endFrameExclusive: 1368 }),
    buildVoyageOfflinePlan({ variant: "completion", startFrame: 0, endFrameExclusive: 1368 })
  ]);
  const report = validateVoyageFullReviewPlans({ manifest, promisePlan, completionPlan });
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(report.sharedFrames, 1272);
  assert.equal(report.completionRenderedFrames, 96);

  const drifted = structuredClone(completionPlan);
  drifted.frames[100].shotId = "unapproved-drift";
  const invalid = validateVoyageFullReviewPlans({ manifest, promisePlan, completionPlan: drifted });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes("diverge before the approved finale boundary at frame 100")));
});

test("full review orchestration requires explicit nonshipping confirmation before planning or writing", async (t) => {
  const root = await temporaryDirectory(t);
  let planned = false;
  await assert.rejects(
    orchestrateVoyageFullReview({
      root,
      confirmation: "yes",
      buildPlan: async () => { planned = true; }
    }),
    new RegExp(FULL_REVIEW_RENDER_CONFIRMATION)
  );
  assert.equal(planned, false);
});

test("renderer evidence rejects distinct shots collapsed into one frame hash", () => {
  const report = validateVoyageRendererShotDiversity([
    { shotId: "earth", sha256: "a".repeat(64) },
    { shotId: "warp", sha256: "a".repeat(64) }
  ]);
  assert.equal(report.valid, false);
  assert.match(report.error, /2 distinct shots into one frame hash/);
  assert.equal(validateVoyageRendererShotDiversity([
    { shotId: "earth", sha256: "a".repeat(64) },
    { shotId: "warp", sha256: "b".repeat(64) }
  ]).valid, true);
});

test("full review renders Promise once, renders only the Completion finale, resumes, and emits verified flat timelines", async (t) => {
  const root = await temporaryDirectory(t);
  const manifest = await loadVoyageProductionManifest();
  const outputRoot = "output/voyage-projection/full-review-fixture";
  const plans = {
    promise: syntheticPlan(manifest, "promise"),
    completion: syntheticPlan(manifest, "completion")
  };
  const renderCalls = [];
  let forceBlackProbe = false;
  let toolCalls = 0;
  const resolveTools = async () => {
    toolCalls += 1;
    return { blender: "fixture-blender", version: "5.1.2" };
  };
  const renderSegment = async ({
    variant,
    plan,
    planRecord,
    outputRoot: segmentOutputRoot,
    frames,
    width,
    height,
    lookdevPlates
  }) => {
    renderCalls.push({ variant, first: frames[0], last: frames.at(-1), count: frames.length, lookdevPlates });
    const templates = new Map();
    const reportFrames = [];
    for (const frame of frames) {
      const templateGroup = Math.floor(frame / 200);
      if (!templates.has(templateGroup)) {
        const templatePath = `${segmentOutputRoot}/renderer/${variant}-template-${templateGroup}.png`;
        templates.set(templateGroup, {
          path: templatePath,
          artifact: await writeFixture(root, templatePath, fixturePng(width, height, `${variant}-${templateGroup}`))
        });
      }
      const template = templates.get(templateGroup);
      const record = plan.frames[frame];
      const path = `${segmentOutputRoot}/renderer/${variant}/${record.shotId}/frame-${String(frame).padStart(4, "0")}.png`;
      const absolute = join(root, ...path.split("/"));
      await mkdir(join(absolute, ".."), { recursive: true });
      await link(join(root, ...template.path.split("/")), absolute);
      reportFrames.push({
        frame,
        shotId: record.shotId,
        path,
        bytes: template.artifact.bytes,
        sha256: template.artifact.sha256,
        luminanceProbe: { mean: 0.12, maximum: 0.8, nearBlack: false }
      });
    }
    await writeFixture(
      root,
      `${segmentOutputRoot}/renderer/render-report-${variant}-review.json`,
      Buffer.from(`${JSON.stringify({
        schemaVersion: 1,
        status: "non-shipping-review",
        releaseEligible: false,
        planPath: planRecord.path,
        planSha256: planRecord.sha256,
        contractSha256: plan.contractSha256,
        variant,
        mode: "review",
        renderer: { name: "Blender", version: "5.1.2", engine: "BLENDER_EEVEE" },
        resolution: { width, height },
        sampling: { requested: 1, effective: 1, controlled: true },
        lookdevPlatesEnabled: false,
        frames: reportFrames
      }, null, 2)}\n`)
    );
  };
  const options = {
    root,
    outputRoot,
    width: 320,
    height: 180,
    samples: 1,
    lookdevPlates: true,
    confirmation: FULL_REVIEW_RENDER_CONFIRMATION,
    manifest,
    buildPlan: async ({ variant }) => structuredClone(plans[variant]),
    resolveTools,
    renderSegment,
    probeRenderedShotSequence: async ({ startFrame, endFrameExclusive, width, height }) => ({
      decodedFrames: endFrameExclusive - startFrame,
      width,
      height,
      maxChannel: forceBlackProbe ? 0 : 220,
      nonzeroFrames: forceBlackProbe ? 0 : endFrameExclusive - startFrame
    })
  };

  const first = await orchestrateVoyageFullReview(options);
  assert.deepEqual(renderCalls, [
    { variant: "promise", first: 0, last: 1367, count: 1368, lookdevPlates: true },
    { variant: "completion", first: 1272, last: 1367, count: 96, lookdevPlates: true }
  ]);
  assert.equal(toolCalls, 1);
  assert.equal(first.releaseEligible, false);
  assert.equal(first.shipping, false);
  assert.equal(first.report.renderWork.promiseFramesRendered, 1368);
  assert.equal(first.report.renderWork.completionFramesRendered, 96);
  assert.equal(first.report.renderWork.completionFramesSharedFromPromise, 1272);
  assert.equal(first.report.timelines.promise.frames, 1368);
  assert.equal(first.report.timelines.completion.frames, 1368);
  assert.match(first.report.timelines.promise.aggregateSha256, /^[a-f0-9]{64}$/u);
  assert.match(first.report.timelines.completion.aggregateSha256, /^[a-f0-9]{64}$/u);
  const storedReport = JSON.parse(await readFile(join(root, ...first.reportPath.split("/")), "utf8"));
  assert.deepEqual(storedReport, first.report);

  const promiseFrame = join(root, ...`${outputRoot}/timelines/promise/frame-0000.png`.split("/"));
  const sharedCompletionFrame = join(root, ...`${outputRoot}/timelines/completion/frame-0000.png`.split("/"));
  const [promiseStat, completionStat] = await Promise.all([stat(promiseFrame), stat(sharedCompletionFrame)]);
  assert.equal(promiseStat.dev, completionStat.dev);
  assert.equal(promiseStat.ino, completionStat.ino);

  const resumed = await orchestrateVoyageFullReview({ ...options, resume: true });
  assert.equal(renderCalls.length, 2, "validated renderer reports must avoid a second Blender pass");
  assert.deepEqual(resumed.report, first.report);

  const promiseRendererReportPath = join(root, ...`${outputRoot}/renderer/render-report-promise-review.json`.split("/"));
  const promiseRendererReport = JSON.parse(await readFile(promiseRendererReportPath, "utf8"));
  promiseRendererReport.sampling.effective = 2;
  await writeFile(promiseRendererReportPath, `${JSON.stringify(promiseRendererReport, null, 2)}\n`);
  await assert.rejects(
    orchestrateVoyageFullReview({ ...options, resume: true }),
    /does not prove controlled 1-sample Eevee rendering/
  );
  promiseRendererReport.sampling.effective = 1;
  await writeFile(promiseRendererReportPath, `${JSON.stringify(promiseRendererReport, null, 2)}\n`);

  promiseRendererReport.lookdevPlatesEnabled = true;
  await writeFile(promiseRendererReportPath, `${JSON.stringify(promiseRendererReport, null, 2)}\n`);
  await assert.rejects(
    orchestrateVoyageFullReview({ ...options, resume: true }),
    /lacks explicit review-only underlay manifest\/hash provenance/
  );
  promiseRendererReport.lookdevPlatesEnabled = false;
  promiseRendererReport.frames[0].luminanceProbe.nearBlack = true;
  await writeFile(promiseRendererReportPath, `${JSON.stringify(promiseRendererReport, null, 2)}\n`);
  await assert.rejects(
    orchestrateVoyageFullReview({ ...options, resume: true }),
    /lacks valid non-black luminance evidence at frame 0/
  );
  promiseRendererReport.frames[0].luminanceProbe.nearBlack = false;
  await writeFile(promiseRendererReportPath, `${JSON.stringify(promiseRendererReport, null, 2)}\n`);

  forceBlackProbe = true;
  await assert.rejects(
    orchestrateVoyageFullReview({ ...options, resume: true }),
    /is visually empty after full-sequence decoding/
  );
  forceBlackProbe = false;

  await unlink(sharedCompletionFrame);
  await writeFile(sharedCompletionFrame, fixturePng(320, 180, "tampered"));
  await assert.rejects(
    orchestrateVoyageFullReview({ ...options, resume: true }),
    /Refusing to overwrite mismatched review frame/
  );
});

test("review-frame materialization verifies copy fallback when hardlinks are unavailable", async (t) => {
  const root = await temporaryDirectory(t);
  const sourcePath = "output/voyage-projection/full-review/source.png";
  const destinationPath = "output/voyage-projection/full-review/copied.png";
  const source = fixturePng(320, 180, "copy-fallback");
  await writeFixture(root, sourcePath, source);
  const linkFile = async () => {
    const error = new Error("cross-device link");
    error.code = "EXDEV";
    throw error;
  };
  const result = await materializeVoyageReviewFrame({
    root,
    sourcePath,
    destinationPath,
    linkFile
  });
  assert.equal(result.mode, "copied");
  assert.equal(result.source.sha256, result.destination.sha256);
  assert.deepEqual(await readFile(join(root, ...destinationPath.split("/"))), source);
});
