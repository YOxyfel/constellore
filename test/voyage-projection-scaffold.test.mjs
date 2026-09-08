import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  VOYAGE_FINALE_CAPTIONS_PATH,
  VOYAGE_OPENING_CAPTIONS_PATH,
  VOYAGE_SCAFFOLD_DIRECTORY,
  VOYAGE_SCAFFOLD_PATHS,
  expectedVoyagePreproductionScaffold,
  validateVoyagePreproductionScaffold
} from "../scripts/voyage-projection-scaffold.mjs";

function parsed(artifacts, path) {
  return JSON.parse(artifacts.get(path));
}

test("release synchronization refreshes Voyage source provenance before release verification", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const releaseSync = packageJson.scripts?.["release:sync"] || "";
  const publicSyncIndex = releaseSync.indexOf("node scripts/sync-public-release.mjs");
  const voyageScaffoldIndex = releaseSync.indexOf("npm run cinematic:voyage:scaffold");

  assert.ok(publicSyncIndex >= 0, "release:sync must synchronize public release metadata.");
  assert.ok(voyageScaffoldIndex > publicSyncIndex, "Voyage scaffold generation must run after public release synchronization.");
  assert.match(packageJson.scripts?.["build:release"] || "", /^npm run release:sync && npm run check:release/);
});

test("Voyage preproduction scaffold is byte deterministic and covers its declared inventory", async () => {
  const first = await expectedVoyagePreproductionScaffold();
  const second = await expectedVoyagePreproductionScaffold();
  assert.deepEqual([...first], [...second]);
  assert.deepEqual([...first.keys()], [...VOYAGE_SCAFFOLD_PATHS]);

  const manifest = parsed(first, `${VOYAGE_SCAFFOLD_DIRECTORY}/scaffold-manifest.json`);
  assert.equal(manifest.deterministic, true);
  assert.equal(manifest.generationTimestampIncluded, false);
  assert.equal(manifest.createsMedia, false);
  assert.equal(manifest.createsRightsEvidence, false);
  assert.equal(manifest.fps, 24);
  assert.equal(manifest.totalFrames, 1368);
  assert.equal(manifest.artifacts.length, VOYAGE_SCAFFOLD_PATHS.length - 1);
  assert.ok(manifest.artifacts.every((artifact) => /^[a-f0-9]{64}$/.test(artifact.sha256)));
});

test("timeline, cue sheet, EDL, and WebVTT preserve locked timing with explicit frame quantization", async () => {
  const artifacts = await expectedVoyagePreproductionScaffold();
  const timeline = parsed(artifacts, `${VOYAGE_SCAFFOLD_DIRECTORY}/timeline.json`);
  const promise = timeline.variants.find((variant) => variant.id === "promise");
  const warp = promise.shots.find((shot) => shot.id === "warp");
  assert.deepEqual(
    { start: warp.startFrame, end: warp.endFrameExclusive, last: warp.lastFrame },
    { start: 648, end: 912, last: 911 }
  );
  const mapCue = timeline.narrationCues.find((cue) => cue.id === "map-has-no-word");
  assert.equal(mapCue.startFrame, 946);
  assert.equal(mapCue.endFrameExclusive, 1123);
  assert.notEqual(mapCue.startQuantizationMilliseconds, 0);

  const opening = artifacts.get(VOYAGE_OPENING_CAPTIONS_PATH);
  const finale = artifacts.get(VOYAGE_FINALE_CAPTIONS_PATH);
  assert.match(opening, /00:00:54[.]000 --> 00:00:56[.]400\nSo we will make one[.]/);
  assert.doesNotMatch(finale, /So we will make one/);
  assert.match(finale, /00:00:39[.]400 --> 00:00:46[.]800/);
  assert.match(artifacts.get(`${VOYAGE_SCAFFOLD_DIRECTORY}/opening.edl`), /FCM: NON-DROP FRAME/);
  assert.match(artifacts.get(`${VOYAGE_SCAFFOLD_DIRECTORY}/shot-cue-sheet.csv`), /promise,narration,map-has-no-word/);
});

test("render and compositor plans keep authored passes authoritative and optional AI disabled", async () => {
  const artifacts = await expectedVoyagePreproductionScaffold();
  const render = parsed(artifacts, `${VOYAGE_SCAFFOLD_DIRECTORY}/render-jobs.json`);
  const compositor = parsed(artifacts, `${VOYAGE_SCAFFOLD_DIRECTORY}/compositor-jobs.json`);
  assert.equal(render.mediaGenerated, false);
  assert.ok(render.jobs.length > 0);
  assert.ok(render.jobs.every((job) => job.passKind !== "ai-assisted-vfx"));
  assert.ok(render.jobs.every((job) => job.execution.status === "planned-not-rendered" && job.output.sha256 === null));
  const progressPosterRenders = render.jobs.filter((job) => job.posterSourceOnly === true);
  assert.ok(progressPosterRenders.length >= 2);
  assert.ok(progressPosterRenders.every((job) => job.variantId === "progress"
    && job.shotId === "black-hole"
    && job.frameRange.startFrame === 912
    && job.frameRange.endFrameExclusive === 913));
  assert.equal(compositor.defaultMode, "clean-authored-3d");
  assert.equal(compositor.cleanAuthored3d.validWithoutAiLayers, true);
  assert.equal(compositor.protectedPixelComparison.maximumChangedPixels, 0);
  assert.ok(compositor.jobs.every((job) => job.optionalAiLayers.every((layer) => layer.enabled === false)));
  const progressComposite = compositor.jobs.find((job) => job.id === "progress:black-hole:composite:poster-source");
  assert.deepEqual(progressComposite.frameRange, { startFrame: 912, endFrameExclusive: 913, lastFrame: 912 });
  assert.equal(progressComposite.posterSourceOnly, true);
});

test("provenance templates remain visibly blocking and never synthesize rights evidence", async () => {
  const artifacts = await expectedVoyagePreproductionScaffold();
  const ai = parsed(artifacts, `${VOYAGE_SCAFFOLD_DIRECTORY}/provenance/ai-vfx-records.json`);
  const pending = parsed(artifacts, `${VOYAGE_SCAFFOLD_DIRECTORY}/provenance/pending-production-records.json`);
  const posterEvidence = parsed(artifacts, `${VOYAGE_SCAFFOLD_DIRECTORY}/provenance/poster-evidence-template.json`);
  const encode = parsed(artifacts, `${VOYAGE_SCAFFOLD_DIRECTORY}/encode-jobs.json`);
  assert.equal(ai.aiUsedByDefault, false);
  assert.ok(ai.records.length >= 10);
  assert.ok(ai.records.every((record) => (
    record.status === "blocked-template"
    && record.releaseReady === false
    && record.provider === null
    && record.commercialTermsEvidence === null
    && record.outputSha256 === null
  )));
  assert.deepEqual(pending.records.map((record) => record.id), [
    "ai-vfx-renderer", "navigation-voice", "score-and-sound-design"
  ]);
  assert.ok(pending.records.every((record) => record.evidence.every((entry) => entry.status === "missing")));
  assert.ok(encode.jobs.every((job) => job.ready === false));
  assert.ok(encode.jobs.filter((job) => job.kind === "vp9-web-plan").every((job) => (
    job.output.path?.endsWith(".webm")
    && job.executable === "ffmpeg"
    && job.arguments.includes("libvpx-vp9")
    && job.arguments.includes("libopus")
  )));
  const posterJobs = encode.jobs.filter((job) => job.kind === "poster-webp-plan");
  assert.deepEqual(posterJobs.map((job) => [job.id, job.variantId, job.shotId, job.sourceFrame]), [
    ["opening-poster", "promise", "solar", 168],
    ["progress-poster", "progress", "black-hole", 912],
    ["finale-poster", "completion", "beyond", 1272]
  ]);
  assert.ok(posterJobs.every((job) => job.executable === "ffmpeg"
    && job.arguments.includes("libwebp")
    && job.arguments.includes("scale=1920:1080:flags=lanczos")
    && job.inputs.sourcePath.endsWith(`frame-${String(job.sourceFrame).padStart(4, "0")}.exr`)));
  assert.equal(posterEvidence.derivedFromGradedMaster, false);
  assert.equal(posterEvidence.evidenceOutputPath, "production/voyage-projection/poster-evidence.json");
  assert.ok(posterEvidence.records.every((record) => record.sourceCompositeSha256 === null
    && record.posterSha256 === null
    && record.humanApproval.reviewer === null));
});

test("source hashes cover every existing authoritative input and committed scaffold has not drifted", async () => {
  const artifacts = await expectedVoyagePreproductionScaffold();
  const sources = parsed(artifacts, `${VOYAGE_SCAFFOLD_DIRECTORY}/source-hashes.json`);
  assert.deepEqual(sources.missingInputs, []);
  assert.ok(sources.inputs.some((entry) => entry.path === "scripts/voyage-projection-cinematic.v1.json"));
  assert.ok(sources.inputs.some((entry) => entry.path === "scripts/voyage-projection-blender.py"));
  assert.ok(sources.inputs.some((entry) => entry.path === "scripts/voyage-projection-compositor.mjs"));
  assert.ok(sources.inputs.some((entry) => entry.path === "scripts/build-voyage-projection-audio.py"));
  assert.ok(sources.inputs.some((entry) => entry.path === "public/vendor/three/planet-hub-three.mjs"));
  assert.ok(sources.inputs.some((entry) => entry.path === "public/cinematic/voyage-projection-media.mjs"));
  assert.ok(sources.inputs.some((entry) => entry.path === "PLANET_HUB_ASSET_PROVENANCE.json"));
  assert.ok(sources.inputs.every((entry) => entry.status === "present" && /^[a-f0-9]{64}$/.test(entry.sha256)));

  const report = await validateVoyagePreproductionScaffold();
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.deepEqual(report.checked, [...VOYAGE_SCAFFOLD_PATHS]);
});
