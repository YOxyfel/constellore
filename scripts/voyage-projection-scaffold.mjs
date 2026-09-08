import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  APPROVED_VOYAGE_POSTERS,
  DEFAULT_VOYAGE_PRODUCTION_MANIFEST,
  loadVoyageProductionManifest,
  validateVoyageProductionManifest,
  voyageProductionManifestDigest
} from "./voyage-projection-production.mjs";

const DEFAULT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_MANIFEST_PROJECT_PATH = "scripts/voyage-projection-cinematic.v1.json";
export const VOYAGE_SCAFFOLD_DIRECTORY = "production/voyage-projection/scaffold";
export const VOYAGE_OPENING_CAPTIONS_PATH = "public/cinematic/voyage-projection-opening.en.vtt";
export const VOYAGE_FINALE_CAPTIONS_PATH = "public/cinematic/voyage-projection-finale.en.vtt";

export const VOYAGE_SCAFFOLD_PATHS = Object.freeze([
  `${VOYAGE_SCAFFOLD_DIRECTORY}/scaffold-manifest.json`,
  `${VOYAGE_SCAFFOLD_DIRECTORY}/source-hashes.json`,
  `${VOYAGE_SCAFFOLD_DIRECTORY}/timeline.json`,
  `${VOYAGE_SCAFFOLD_DIRECTORY}/shot-cue-sheet.csv`,
  `${VOYAGE_SCAFFOLD_DIRECTORY}/opening.edl`,
  `${VOYAGE_SCAFFOLD_DIRECTORY}/finale.edl`,
  `${VOYAGE_SCAFFOLD_DIRECTORY}/render-jobs.json`,
  `${VOYAGE_SCAFFOLD_DIRECTORY}/compositor-jobs.json`,
  `${VOYAGE_SCAFFOLD_DIRECTORY}/encode-jobs.json`,
  `${VOYAGE_SCAFFOLD_DIRECTORY}/provenance/ai-vfx-records.json`,
  `${VOYAGE_SCAFFOLD_DIRECTORY}/provenance/pending-production-records.json`,
  `${VOYAGE_SCAFFOLD_DIRECTORY}/provenance/poster-evidence-template.json`,
  VOYAGE_OPENING_CAPTIONS_PATH,
  VOYAGE_FINALE_CAPTIONS_PATH
]);

function list(value) {
  return Array.isArray(value) ? value : [];
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function portablePath(value) {
  return String(value || "").replaceAll("\\", "/");
}

function projectPath(root, declaredPath) {
  const rootPath = resolve(root);
  const candidate = resolve(rootPath, declaredPath);
  const fromRoot = relative(rootPath, candidate);
  if (!fromRoot || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot))) return candidate;
  throw new Error(`Scaffold path escapes the project root: ${declaredPath}`);
}

function wholeFrame(seconds, fps, label) {
  const exact = Number(seconds) * fps;
  assert.equal(Number.isInteger(exact), true, `${label} must land on a whole frame; received ${exact}.`);
  return exact;
}

function nearestFrame(seconds, fps) {
  return Math.round(Number(seconds) * fps);
}

function frameTimecode(frame, fps) {
  const safe = Math.max(0, Math.trunc(frame));
  const frames = safe % fps;
  const totalSeconds = Math.floor(safe / fps);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return [hours, minutes, seconds, frames].map((value) => String(value).padStart(2, "0")).join(":");
}

function vttTimestamp(seconds) {
  const totalMilliseconds = Math.max(0, Math.round(Number(seconds) * 1000));
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const secondsPart = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secondsPart).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function captionText(manifest, variantId) {
  const cues = list(manifest.narration?.cues).filter((cue) => list(cue.variants).includes(variantId));
  const rows = [
    "WEBVTT",
    "",
    `NOTE Deterministically generated from ${DEFAULT_MANIFEST_PROJECT_PATH}; do not retime by hand.`,
    ""
  ];
  for (const cue of cues) {
    rows.push(cue.id);
    rows.push(`${vttTimestamp(cue.startSeconds)} --> ${vttTimestamp(cue.endSeconds)}`);
    rows.push(cue.text);
    rows.push("");
  }
  return `${rows.join("\n")}\n`;
}

function shotFrames(shot, fps) {
  const startFrame = wholeFrame(shot.startSeconds, fps, `Shot ${shot.id} start`);
  const endFrameExclusive = wholeFrame(shot.endSeconds, fps, `Shot ${shot.id} end`);
  return {
    startFrame,
    endFrameExclusive,
    lastFrame: endFrameExclusive - 1,
    durationFrames: endFrameExclusive - startFrame,
    startTimecode: frameTimecode(startFrame, fps),
    endTimecodeExclusive: frameTimecode(endFrameExclusive, fps)
  };
}

function cueFrames(cue, fps) {
  const startFrame = nearestFrame(cue.startSeconds, fps);
  const endFrameExclusive = nearestFrame(cue.endSeconds, fps);
  return {
    startFrame,
    endFrameExclusive,
    lastFrame: endFrameExclusive - 1,
    durationFrames: endFrameExclusive - startFrame,
    startTimecode: frameTimecode(startFrame, fps),
    endTimecodeExclusive: frameTimecode(endFrameExclusive, fps),
    startQuantizationMilliseconds: Number(((startFrame / fps - cue.startSeconds) * 1000).toFixed(3)),
    endQuantizationMilliseconds: Number(((endFrameExclusive / fps - cue.endSeconds) * 1000).toFixed(3))
  };
}

function buildTimeline(manifest, contractSha256) {
  const fps = manifest.technical.timelineFps;
  const shots = new Map(list(manifest.shots).map((shot) => [shot.id, shot]));
  const totalFrames = wholeFrame(manifest.durationSeconds, fps, "Timeline duration");
  return {
    schemaVersion: 1,
    contractId: manifest.contractId,
    contractVersion: manifest.contractVersion,
    contractSha256,
    timebase: `1/${fps}`,
    fps,
    frameNumbering: "zero-based-end-exclusive",
    narrationQuantization: "nearest-frame; source second values remain authoritative for WebVTT",
    frameRange: { startFrame: 0, endFrameExclusive: totalFrames, lastFrame: totalFrames - 1 },
    variants: list(manifest.variants).map((variant) => ({
      id: variant.id,
      purpose: variant.purpose,
      terminalOutcome: variant.terminalOutcome,
      shots: list(variant.shotIds).map((shotId) => {
        const shot = shots.get(shotId);
        return {
          id: shot.id,
          setting: shot.setting,
          storyBeat: shot.storyBeat,
          cameraIntent: shot.cameraIntent,
          sourceSeconds: { start: shot.startSeconds, end: shot.endSeconds },
          ...shotFrames(shot, fps),
          authoritativePassIds: [...list(shot.authoritativePassIds)],
          optionalAiPassIds: [...list(shot.aiPassIds)],
          narrationCueIds: list(manifest.narration?.cues)
            .filter((cue) => cue.shotId === shot.id && list(cue.variants).includes(variant.id))
            .map((cue) => cue.id)
        };
      })
    })),
    narrationCues: list(manifest.narration?.cues).map((cue) => ({
      id: cue.id,
      shotId: cue.shotId,
      variants: [...list(cue.variants)],
      text: cue.text,
      sourceSeconds: { start: cue.startSeconds, end: cue.endSeconds },
      ...cueFrames(cue, fps)
    }))
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCueSheet(manifest, timeline) {
  const headers = [
    "variant", "type", "id", "shot_id", "start_seconds", "end_seconds", "start_frame",
    "end_frame_exclusive", "last_frame", "start_timecode", "end_timecode_exclusive", "description",
    "authoritative_passes", "optional_ai_passes"
  ];
  const rows = [headers];
  const cueById = new Map(timeline.narrationCues.map((cue) => [cue.id, cue]));
  for (const variant of timeline.variants) {
    for (const shot of variant.shots) {
      rows.push([
        variant.id, "shot", shot.id, shot.id, shot.sourceSeconds.start, shot.sourceSeconds.end,
        shot.startFrame, shot.endFrameExclusive, shot.lastFrame, shot.startTimecode, shot.endTimecodeExclusive,
        shot.storyBeat, shot.authoritativePassIds.join("|"), shot.optionalAiPassIds.join("|")
      ]);
      for (const cueId of shot.narrationCueIds) {
        const cue = cueById.get(cueId);
        rows.push([
          variant.id, "narration", cue.id, cue.shotId, cue.sourceSeconds.start, cue.sourceSeconds.end,
          cue.startFrame, cue.endFrameExclusive, cue.lastFrame, cue.startTimecode, cue.endTimecodeExclusive,
          cue.text, "", ""
        ]);
      }
    }
  }
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function buildEdl(manifest, timeline, variantId, title) {
  const variant = timeline.variants.find((entry) => entry.id === variantId);
  const lines = [`TITLE: ${title}`, "FCM: NON-DROP FRAME", ""];
  variant.shots.forEach((shot, index) => {
    const event = String(index + 1).padStart(3, "0");
    lines.push(`${event}  AX       V     C        ${shot.startTimecode} ${shot.endTimecodeExclusive} ${shot.startTimecode} ${shot.endTimecodeExclusive}`);
    lines.push(`* FROM CLIP NAME: ${shot.id}`);
    lines.push(`* SETTING: ${shot.setting}`);
    lines.push("");
  });
  lines.push(`* CONTRACT SHA256: ${timeline.contractSha256}`);
  lines.push(`* TIMEBASE: ${timeline.fps} FPS NON-DROP`);
  return `${lines.join("\n")}\n`;
}

function sequencePattern(variantId, shotId, passId) {
  return `output/voyage-projection/renders/${variantId}/${shotId}/${passId}/frame-%04d.exr`;
}

function compositePattern(variantId, shotId) {
  return `output/voyage-projection/composites/${variantId}/${shotId}/frame-%04d.exr`;
}

function exactFramePath(pattern, frame) {
  return pattern.replace("%04d", String(frame).padStart(4, "0"));
}

function buildRenderJobs(manifest, timeline) {
  const passById = new Map(list(manifest.passes).map((pass) => [pass.id, pass]));
  const variants = timeline.variants.filter((variant) => ["promise", "completion"].includes(variant.id));
  const jobs = [];
  for (const variant of variants) {
    for (const shot of variant.shots) {
      for (const passId of shot.authoritativePassIds) {
        const pass = passById.get(passId);
        jobs.push({
          id: `${variant.id}:${shot.id}:${passId}`,
          variantId: variant.id,
          shotId: shot.id,
          passId,
          passKind: pass.kind,
          frameRange: {
            startFrame: shot.startFrame,
            endFrameExclusive: shot.endFrameExclusive,
            lastFrame: shot.lastFrame
          },
          output: {
            format: pass.format,
            channels: [...list(pass.channels)],
            sequencePattern: sequencePattern(variant.id, shot.id, passId),
            sha256: null
          },
          execution: {
            status: "planned-not-rendered",
            renderer: null,
            command: null
          }
        });
      }
    }
  }
  const progressPoster = APPROVED_VOYAGE_POSTERS.find((poster) => poster.id === "progress");
  const progressVariant = timeline.variants.find((variant) => variant.id === progressPoster.variantId);
  const progressShot = progressVariant.shots.find((shot) => shot.id === progressPoster.shotId);
  for (const passId of progressShot.authoritativePassIds) {
    const pass = passById.get(passId);
    jobs.push({
      id: `${progressPoster.variantId}:${progressPoster.shotId}:${passId}:poster-source`,
      variantId: progressPoster.variantId,
      shotId: progressPoster.shotId,
      passId,
      passKind: pass.kind,
      posterSourceOnly: true,
      frameRange: {
        startFrame: progressPoster.frame,
        endFrameExclusive: progressPoster.frame + 1,
        lastFrame: progressPoster.frame
      },
      output: {
        format: pass.format,
        channels: [...list(pass.channels)],
        sequencePattern: sequencePattern(progressPoster.variantId, progressPoster.shotId, passId),
        sha256: null
      },
      execution: { status: "planned-not-rendered", renderer: null, command: null }
    });
  }
  return {
    schemaVersion: 1,
    contractSha256: timeline.contractSha256,
    authority: "authored-3d-scene",
    sourceModule: "public/voyage-projection-scene.mjs",
    mediaGenerated: false,
    technical: {
      width: manifest.technical.master.width,
      height: manifest.technical.master.height,
      fps: manifest.technical.timelineFps,
      workingColorSpace: manifest.technical.master.workingColorSpace,
      deliveryColorSpace: manifest.technical.master.deliveryColorSpace,
      deterministicSeed: manifest.technical.determinism.randomSeed,
      simulationMustBeBaked: manifest.technical.determinism.simulationMustBeBaked
    },
    jobs
  };
}

function buildCompositorJobs(manifest, timeline) {
  const passById = new Map(list(manifest.passes).map((pass) => [pass.id, pass]));
  const variants = timeline.variants.filter((variant) => ["promise", "completion"].includes(variant.id));
  const makeJob = (variantId, shot, frameRange, posterSourceOnly = false) => ({
    id: `${variantId}:${shot.id}:composite${posterSourceOnly ? ":poster-source" : ""}`,
    variantId,
    shotId: shot.id,
    posterSourceOnly,
    frameRange,
    authoritativeBeautySequence: sequencePattern(variantId, shot.id, "beauty-3d"),
    authoritativeObjectIdSequence: sequencePattern(variantId, shot.id, "object-id-3d"),
    outputSequence: compositePattern(variantId, shot.id),
    outputSha256: null,
    optionalAiLayers: shot.optionalAiPassIds.map((passId) => {
      const pass = passById.get(passId);
      return {
        passId,
        enabled: false,
        status: "blocked-until-media-and-provenance-exist",
        sequencePattern: sequencePattern(variantId, shot.id, passId),
        sequenceSha256: null,
        maskPassId: pass.mask.sourcePassId,
        maskSequencePattern: sequencePattern(variantId, shot.id, pass.mask.sourcePassId),
        maskSha256: null,
        compositeMode: pass.compositeMode,
        provenanceTemplateId: `${shot.id}:${passId}`
      };
    }),
    protectedPixelCheck: {
      requiredBeforeAiEnablement: true,
      maximumChangedPixels: manifest.qualityGates.protectedPixelComparison.maximumChangedPixels,
      result: null
    }
  });
  const jobs = variants.flatMap((variant) => variant.shots.map((shot) => makeJob(variant.id, shot, {
    startFrame: shot.startFrame,
    endFrameExclusive: shot.endFrameExclusive,
    lastFrame: shot.lastFrame
  })));
  const progressPoster = APPROVED_VOYAGE_POSTERS.find((poster) => poster.id === "progress");
  const progressVariant = timeline.variants.find((variant) => variant.id === progressPoster.variantId);
  const progressShot = progressVariant.shots.find((shot) => shot.id === progressPoster.shotId);
  jobs.push(makeJob(progressPoster.variantId, progressShot, {
    startFrame: progressPoster.frame,
    endFrameExclusive: progressPoster.frame + 1,
    lastFrame: progressPoster.frame
  }, true));
  return {
    schemaVersion: 1,
    contractSha256: timeline.contractSha256,
    defaultMode: "clean-authored-3d",
    mediaGenerated: false,
    cleanAuthored3d: {
      validWithoutAiLayers: true,
      changesProtectedPixels: 0,
      note: "Optional AI layers remain disabled unless their separately documented production records pass review."
    },
    protectedPixelComparison: { ...manifest.qualityGates.protectedPixelComparison },
    jobs,
    timelineAssemblies: variants.map((variant) => ({
      id: `${variant.id}:timeline-assembly`,
      variantId: variant.id,
      status: "planned-not-assembled",
      frameRange: { ...timeline.frameRange },
      segments: variant.shots.map((shot) => ({
        shotId: shot.id,
        startFrame: shot.startFrame,
        endFrameExclusive: shot.endFrameExclusive,
        inputSequence: compositePattern(variant.id, shot.id)
      })),
      outputSequence: `output/voyage-projection/composites/${variant.id}/timeline/frame-%04d.exr`,
      outputSha256: null
    }))
  };
}

function buildAiProvenanceRecords(manifest, timeline) {
  const passById = new Map(list(manifest.passes).map((pass) => [pass.id, pass]));
  const shots = new Map(list(manifest.shots).map((shot) => [shot.id, shot]));
  const unique = new Set();
  const records = [];
  for (const shot of shots.values()) {
    const frames = shotFrames(shot, manifest.technical.timelineFps);
    for (const passId of list(shot.aiPassIds)) {
      const templateId = `${shot.id}:${passId}`;
      if (unique.has(templateId)) continue;
      unique.add(templateId);
      const pass = passById.get(passId);
      records.push({
        templateId,
        status: "blocked-template",
        releaseReady: false,
        optional: true,
        shotId: shot.id,
        passId,
        frameRange: {
          startFrame: frames.startFrame,
          endFrameExclusive: frames.endFrameExclusive,
          lastFrame: frames.lastFrame
        },
        provenanceId: pass.provenanceId,
        authoritativeBeautySequence: sequencePattern("VARIANT_REQUIRED", shot.id, "beauty-3d"),
        authoritativeInputSha256: null,
        authoritativeMaskPassId: pass.mask.sourcePassId,
        authoritativeMaskSequence: sequencePattern("VARIANT_REQUIRED", shot.id, pass.mask.sourcePassId),
        authoritativeMaskSha256: null,
        provider: null,
        model: null,
        modelVersion: null,
        generatedAt: null,
        commercialTermsEvidence: null,
        seed: manifest.technical.determinism.randomSeed,
        prompt: null,
        negativePrompt: null,
        outputSequence: sequencePattern("VARIANT_REQUIRED", shot.id, passId),
        outputSha256: null,
        alphaOutputRequired: pass.alphaOutput,
        compositeMode: pass.compositeMode,
        mayAffect: [...list(pass.mayAffect)],
        mustNotAffect: [...list(pass.mustNotAffect)],
        humanApproval: {
          reviewer: null,
          approvedAt: null,
          protectedPixelChanges: null
        },
        missingRequiredEvidence: [
          "provider", "model", "modelVersion", "generatedAt", "commercialTermsEvidence", "prompt",
          "authoritativeInputSha256", "authoritativeMaskSha256", "outputSha256", "humanApproval"
        ]
      });
    }
  }
  return {
    schemaVersion: 1,
    contractSha256: timeline.contractSha256,
    recordPurpose: "Blank deterministic templates only; these records are not rights evidence.",
    aiUsedByDefault: false,
    records
  };
}

function buildPendingProvenance(manifest, timeline) {
  return {
    schemaVersion: 1,
    contractSha256: timeline.contractSha256,
    recordPurpose: "Blocking evidence checklist; null entries must never be interpreted as approval.",
    records: list(manifest.provenance)
      .filter((record) => record.releaseBlockedUntilDocumented === true)
      .map((record) => ({
        id: record.id,
        kind: record.kind,
        manifestStatus: record.status,
        status: "blocked-template",
        releaseReady: false,
        commercialUseDocumented: false,
        evidence: list(record.requiredEvidence).map((requirement) => ({
          requirement,
          status: "missing",
          artifactPath: null,
          sha256: null
        }))
      }))
  };
}

function buildPosterEvidenceTemplate(manifest, timeline) {
  const paths = list(manifest.deliverables.find((entry) => entry.kind === "poster")?.paths);
  return {
    schemaVersion: 1,
    contractSha256: timeline.contractSha256,
    status: "blocked-template",
    source: manifest.technical.posters.source,
    derivedFromGradedMaster: false,
    evidenceOutputPath: manifest.technical.posters.evidencePath,
    records: APPROVED_VOYAGE_POSTERS.map((poster, index) => ({
      ...poster,
      path: paths[index],
      sourceCompositePath: exactFramePath(compositePattern(poster.variantId, poster.shotId), poster.frame),
      sourceCompositeSha256: null,
      posterSha256: null,
      derivedFromGradedMaster: false,
      humanApproval: { reviewer: null, approvedAt: null }
    }))
  };
}

function ffmpegMasterArguments({ fps, framePattern, audioPath, outputPath, master }) {
  return [
    "-hide_banner", "-y", "-framerate", String(fps), "-start_number", "0", "-i", framePattern,
    "-i", audioPath, "-c:v", "prores_ks", "-profile:v", "5", "-pix_fmt", "yuva444p10le",
    "-c:a", "pcm_s24le", "-ar", String(master.audioSampleRateHz),
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", outputPath
  ];
}

function ffmpegH264Arguments({ masterPath, outputPath, web }) {
  return [
    "-hide_banner", "-y", "-i", masterPath, "-vf", `scale=${web.width}:${web.height}:flags=lanczos`,
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    "-c:a", "aac", "-ar", "48000", outputPath
  ];
}

function ffmpegVp9Arguments({ masterPath, outputPath, web }) {
  return [
    "-hide_banner", "-y", "-i", masterPath, "-vf", `scale=${web.width}:${web.height}:flags=lanczos`,
    "-c:v", "libvpx-vp9", "-crf", "28", "-b:v", "0", "-deadline", "good", "-cpu-used", "2",
    "-pix_fmt", "yuv420p", "-c:a", "libopus", "-b:a", "160k", "-ar", "48000", outputPath
  ];
}

function ffmpegPosterArguments({ sourcePath, outputPath, posters }) {
  return [
    "-hide_banner", "-y", "-i", sourcePath,
    "-vf", `scale=${posters.width}:${posters.height}:flags=lanczos`,
    "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", "-compression_level", "6",
    "-preset", "picture", outputPath
  ];
}

function buildEncodeJobs(manifest, timeline) {
  const deliverableById = new Map(list(manifest.deliverables).map((entry) => [entry.id, entry]));
  const definitions = [
    { label: "opening", variantId: "promise", masterId: "opening-master", webId: "opening-web-video" },
    { label: "finale", variantId: "completion", masterId: "finale-master", webId: "finale-web-video" }
  ];
  const jobs = [];
  for (const definition of definitions) {
    const master = deliverableById.get(definition.masterId);
    const web = deliverableById.get(definition.webId);
    const framePattern = `output/voyage-projection/composites/${definition.variantId}/timeline/frame-%04d.exr`;
    const audioPath = `output/voyage-projection/audio/voyage-projection-${definition.label}-master.wav`;
    jobs.push({
      id: `${definition.label}-prores-master`,
      kind: "prores-master",
      variantId: definition.variantId,
      ready: false,
      blockers: ["composited frame sequence missing", "48 kHz / 24-bit mastered audio missing"],
      inputs: { framePattern, frameSha256: null, audioPath, audioSha256: null },
      output: { path: master.path, sha256: null },
      executable: "ffmpeg",
      arguments: ffmpegMasterArguments({
        fps: manifest.technical.timelineFps,
        framePattern,
        audioPath,
        outputPath: master.path,
        master: manifest.technical.master
      })
    });
    jobs.push({
      id: `${definition.label}-h264-web`,
      kind: "h264-web",
      variantId: definition.variantId,
      ready: false,
      blockers: ["ProRes master missing"],
      inputs: { masterPath: master.path, masterSha256: null },
      output: { path: web.path, sha256: null },
      executable: "ffmpeg",
      arguments: ffmpegH264Arguments({ masterPath: master.path, outputPath: web.path, web: manifest.technical.web })
    });
    jobs.push({
      id: `${definition.label}-vp9-alternate`,
      kind: "vp9-web-plan",
      variantId: definition.variantId,
      ready: false,
      blockers: ["ProRes master missing"],
      inputs: { masterPath: master.path, masterSha256: null },
      output: { path: web.alternatePath, sha256: null },
      executable: "ffmpeg",
      arguments: ffmpegVp9Arguments({ masterPath: master.path, outputPath: web.alternatePath, web: manifest.technical.web })
    });
  }
  const posterPaths = list(deliverableById.get("poster-fallbacks")?.paths);
  for (const [index, poster] of APPROVED_VOYAGE_POSTERS.entries()) {
    const sourcePath = exactFramePath(compositePattern(poster.variantId, poster.shotId), poster.frame);
    jobs.push({
      id: `${poster.id}-poster`,
      kind: "poster-webp-plan",
      variantId: poster.variantId,
      shotId: poster.shotId,
      ready: false,
      blockers: ["graded composite frame missing", "creative approval missing"],
      sourceFrame: poster.frame,
      inputs: { sourcePath, sourceSha256: null },
      output: { path: posterPaths[index], sha256: null },
      executable: "ffmpeg",
      arguments: ffmpegPosterArguments({
        sourcePath,
        outputPath: posterPaths[index],
        posters: manifest.technical.posters
      })
    });
  }
  return {
    schemaVersion: 1,
    contractSha256: timeline.contractSha256,
    planOnly: true,
    executesCommands: false,
    fps: manifest.technical.timelineFps,
    totalFrames: timeline.frameRange.endFrameExclusive,
    jobs
  };
}

async function fileHashRecord(root, declaredPath) {
  const absolutePath = projectPath(root, declaredPath);
  try {
    const [details, contents] = await Promise.all([stat(absolutePath), readFile(absolutePath)]);
    if (!details.isFile()) throw new Error("not a file");
    return { path: declaredPath, status: "present", bytes: details.size, sha256: sha256(contents) };
  } catch {
    return { path: declaredPath, status: "missing", bytes: null, sha256: null };
  }
}

async function buildSourceHashes(manifest, root, manifestProjectPath, contractSha256) {
  const productionPipelinePaths = [
    "public/art/planet-hub/manifest.json",
    "public/cinematic/voyage-projection-experience.css",
    "public/cinematic/voyage-projection-experience.mjs",
    "public/cinematic/voyage-projection-media.json",
    "public/cinematic/voyage-projection-media.mjs",
    "public/vendor/three/planet-hub-three.mjs",
    "scripts/build-voyage-projection-audio.py",
    "scripts/verify-voyage-projection-audio.mjs",
    "scripts/voyage-projection-blender.py",
    "scripts/voyage-projection-compositor.mjs",
    "scripts/voyage-projection-offline-plan.mjs",
    "scripts/voyage-projection-offline-render.mjs",
    "scripts/voyage-projection-production.mjs",
    "scripts/voyage-projection-scaffold.mjs"
  ];
  const realtimePaths = list(manifest.deliverables)
    .filter((entry) => entry.kind === "realtime")
    .flatMap((entry) => list(entry.entrypoints));
  const evidencePaths = list(manifest.provenance).flatMap((record) => list(record.evidence));
  const paths = [...new Set([
    manifestProjectPath,
    ...realtimePaths,
    ...evidencePaths,
    ...productionPipelinePaths
  ])].sort();
  const inputs = [];
  for (const path of paths) inputs.push(await fileHashRecord(root, path));
  return {
    schemaVersion: 1,
    contractSha256,
    hashAlgorithm: "sha256",
    inputs,
    missingInputs: inputs.filter((entry) => entry.status === "missing").map((entry) => entry.path)
  };
}

function assertTruthBoundary(artifacts) {
  const ai = JSON.parse(artifacts.get(`${VOYAGE_SCAFFOLD_DIRECTORY}/provenance/ai-vfx-records.json`));
  const pending = JSON.parse(artifacts.get(`${VOYAGE_SCAFFOLD_DIRECTORY}/provenance/pending-production-records.json`));
  const poster = JSON.parse(artifacts.get(`${VOYAGE_SCAFFOLD_DIRECTORY}/provenance/poster-evidence-template.json`));
  const compositor = JSON.parse(artifacts.get(`${VOYAGE_SCAFFOLD_DIRECTORY}/compositor-jobs.json`));
  assert.ok(ai.records.length > 0, "AI provenance templates must cover every declared optional AI pass.");
  assert.ok(ai.records.every((record) => record.releaseReady === false && record.provider === null && record.outputSha256 === null));
  assert.ok(pending.records.length > 0, "Pending production evidence must remain explicitly represented.");
  assert.ok(pending.records.every((record) => record.releaseReady === false && record.commercialUseDocumented === false));
  assert.equal(poster.derivedFromGradedMaster, false);
  assert.ok(poster.records.every((record) => record.sourceCompositeSha256 === null
    && record.posterSha256 === null
    && record.derivedFromGradedMaster === false));
  assert.ok(compositor.jobs.every((job) => job.optionalAiLayers.every((layer) => layer.enabled === false)));
  assert.equal(compositor.protectedPixelComparison.maximumChangedPixels, 0);
}

export async function expectedVoyagePreproductionScaffold({
  root = DEFAULT_ROOT,
  manifestPath = DEFAULT_VOYAGE_PRODUCTION_MANIFEST
} = {}) {
  const manifest = await loadVoyageProductionManifest(manifestPath);
  const contract = validateVoyageProductionManifest(manifest);
  assert.equal(contract.valid, true, contract.errors.join("\n"));
  const contractSha256 = voyageProductionManifestDigest(manifest);
  const manifestAbsolutePath = fileURLToPath(manifestPath instanceof URL ? manifestPath : pathToFileURL(resolve(manifestPath)));
  const relativeManifestPath = portablePath(relative(resolve(root), manifestAbsolutePath)) || DEFAULT_MANIFEST_PROJECT_PATH;
  const timeline = buildTimeline(manifest, contractSha256);
  const sourceHashes = await buildSourceHashes(manifest, root, relativeManifestPath, contractSha256);
  const artifacts = new Map([
    [`${VOYAGE_SCAFFOLD_DIRECTORY}/source-hashes.json`, jsonText(sourceHashes)],
    [`${VOYAGE_SCAFFOLD_DIRECTORY}/timeline.json`, jsonText(timeline)],
    [`${VOYAGE_SCAFFOLD_DIRECTORY}/shot-cue-sheet.csv`, buildCueSheet(manifest, timeline)],
    [`${VOYAGE_SCAFFOLD_DIRECTORY}/opening.edl`, buildEdl(manifest, timeline, "promise", "VOYAGE PROJECTION OPENING")],
    [`${VOYAGE_SCAFFOLD_DIRECTORY}/finale.edl`, buildEdl(manifest, timeline, "completion", "VOYAGE PROJECTION FINALE")],
    [`${VOYAGE_SCAFFOLD_DIRECTORY}/render-jobs.json`, jsonText(buildRenderJobs(manifest, timeline))],
    [`${VOYAGE_SCAFFOLD_DIRECTORY}/compositor-jobs.json`, jsonText(buildCompositorJobs(manifest, timeline))],
    [`${VOYAGE_SCAFFOLD_DIRECTORY}/encode-jobs.json`, jsonText(buildEncodeJobs(manifest, timeline))],
    [`${VOYAGE_SCAFFOLD_DIRECTORY}/provenance/ai-vfx-records.json`, jsonText(buildAiProvenanceRecords(manifest, timeline))],
    [`${VOYAGE_SCAFFOLD_DIRECTORY}/provenance/pending-production-records.json`, jsonText(buildPendingProvenance(manifest, timeline))],
    [`${VOYAGE_SCAFFOLD_DIRECTORY}/provenance/poster-evidence-template.json`, jsonText(buildPosterEvidenceTemplate(manifest, timeline))],
    [VOYAGE_OPENING_CAPTIONS_PATH, captionText(manifest, "promise")],
    [VOYAGE_FINALE_CAPTIONS_PATH, captionText(manifest, "completion")]
  ]);
  const artifactRecords = [...artifacts].map(([path, contents]) => ({
    path,
    bytes: Buffer.byteLength(contents, "utf8"),
    sha256: sha256(contents)
  }));
  artifacts.set(`${VOYAGE_SCAFFOLD_DIRECTORY}/scaffold-manifest.json`, jsonText({
    schemaVersion: 1,
    contractId: manifest.contractId,
    contractVersion: manifest.contractVersion,
    contractSha256,
    generatedFrom: relativeManifestPath,
    deterministic: true,
    generationTimestampIncluded: false,
    createsMedia: false,
    createsRightsEvidence: false,
    fps: manifest.technical.timelineFps,
    totalFrames: timeline.frameRange.endFrameExclusive,
    truthBoundary: [
      "No movie, image, audio, voice, or AI VFX media is generated by this scaffold.",
      "Null provenance fields remain release blockers and are never inferred from local assets.",
      "Optional AI layers are disabled; clean authored 3D remains the default compositor mode."
    ],
    artifacts: artifactRecords.sort((left, right) => left.path.localeCompare(right.path, "en"))
  }));
  const ordered = new Map(VOYAGE_SCAFFOLD_PATHS.map((path) => [path, artifacts.get(path)]));
  assert.ok([...ordered.values()].every((contents) => typeof contents === "string"), "Scaffold path inventory drifted from generated artifacts.");
  assertTruthBoundary(ordered);
  return ordered;
}

export async function validateVoyagePreproductionScaffold(options = {}) {
  const root = options.root || DEFAULT_ROOT;
  const expected = await expectedVoyagePreproductionScaffold(options);
  const errors = [];
  const checked = [];
  for (const [declaredPath, contents] of expected) {
    checked.push(declaredPath);
    try {
      const actual = await readFile(projectPath(root, declaredPath), "utf8");
      if (actual !== contents) errors.push(`${declaredPath} drifted from the locked Voyage production contract.`);
    } catch {
      errors.push(`${declaredPath} is missing.`);
    }
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), checked: Object.freeze(checked) });
}

export async function syncVoyagePreproductionScaffold({ verifyOnly = false, ...options } = {}) {
  if (verifyOnly) return validateVoyagePreproductionScaffold(options);
  const root = options.root || DEFAULT_ROOT;
  const expected = await expectedVoyagePreproductionScaffold(options);
  for (const [declaredPath, contents] of expected) {
    const destination = projectPath(root, declaredPath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents, "utf8");
  }
  return validateVoyagePreproductionScaffold(options);
}

function parseArguments(argv) {
  const options = { root: DEFAULT_ROOT, manifestPath: DEFAULT_VOYAGE_PRODUCTION_MANIFEST, verifyOnly: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--verify") options.verifyOnly = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--root") options.root = resolve(argv[++index]);
    else if (argument === "--manifest") options.manifestPath = pathToFileURL(resolve(argv[++index]));
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main(argv) {
  const options = parseArguments(argv);
  const report = await syncVoyagePreproductionScaffold(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const error of report.errors) console.error(`ERROR ${error}`);
    console.log(report.valid
      ? `${options.verifyOnly ? "Verified" : "Generated"} deterministic Voyage preproduction scaffold (${report.checked.length} files).`
      : "FAIL deterministic Voyage preproduction scaffold");
  }
  if (!report.valid) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
