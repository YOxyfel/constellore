import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildVoyageOfflinePlan,
  writeVoyageOfflinePlan
} from "../scripts/voyage-projection-offline-plan.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test("offline Voyage plans sample the authoritative runtime on exact production frames", async () => {
  const plan = await buildVoyageOfflinePlan({
    root,
    variant: "promise",
    startFrame: 167,
    endFrameExclusive: 170
  });
  assert.equal(plan.releaseEligible, false);
  assert.equal(plan.fps, 24);
  assert.deepEqual(plan.frames.map((frame) => frame.shotId), ["earth", "solar", "solar"]);
  assert.equal(plan.frames[1].frame, 168);
  assert.equal(plan.frames[1].timelineSeconds, 7);
  assert.equal(plan.frames[1].camera.fov, 54);
  assert.deepEqual(plan.frames[1].rocket.position, [8.6, 5, -1.2]);
  assert.equal(plan.frames[1].rocket.visualScale, 2.4);
  assert.equal(plan.assets.earth.path, "public/art/planet-hub/models/earth-standard.glb");
  assert.equal(plan.assets.rocket.path, "public/art/planet-hub/models/rocket-standard.glb");
  assert.equal(plan.bodyLayout.some((body) => body.id === "moon"), true);
  assert.equal(plan.interstellarSystems.length, 5);
  assert.equal(plan.sources.length, 4);
  assert.match(plan.contractSha256, /^[a-f0-9]{64}$/);
});

test("offline Voyage plan files are deterministic and stay outside release assets", async () => {
  const relativeOutput = ".codex-tmp/voyage-projection-offline/test-frame.json";
  const first = await writeVoyageOfflinePlan({
    root,
    variant: "completion",
    startFrame: 1272,
    endFrameExclusive: 1273,
    outputPath: relativeOutput
  });
  const second = await writeVoyageOfflinePlan({
    root,
    variant: "completion",
    startFrame: 1272,
    endFrameExclusive: 1273,
    outputPath: relativeOutput
  });
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.bytes, second.bytes);
  assert.equal(first.plan.frames[0].shotId, "beyond");
  assert.equal(first.plan.frames[0].frame, 1272);
  assert.equal(first.plan.frames[0].timelineSeconds, 53);
  const source = await readFile(resolve(root, relativeOutput), "utf8");
  assert.doesNotMatch(source, /public[\\/]cinematic[\\/].*[.](?:mp4|webp)/i);
});

test("offline Voyage plans reject empty ranges and unknown variants", async () => {
  await assert.rejects(
    buildVoyageOfflinePlan({ root, variant: "invented" }),
    /Unknown Voyage variant/
  );
  await assert.rejects(
    buildVoyageOfflinePlan({ root, startFrame: 12, endFrameExclusive: 12 }),
    /non-empty/
  );
});
