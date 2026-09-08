import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildBlenderArguments,
  runVoyageOfflineRender
} from "../scripts/voyage-projection-offline-render.mjs";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/u, "$1"));

test("offline Blender arguments retain the noninteractive deterministic boundary", () => {
  const args = buildBlenderArguments({
    planPath: resolve(root, ".codex-tmp/voyage-projection-offline/test.json"),
    outputDirectory: resolve(root, ".codex-tmp/voyage-projection-offline/render"),
    frames: [168],
    width: 960,
    height: 540,
    samples: 12,
    lookdevPlates: true
  });
  assert.deepEqual(args.slice(0, 7), [
    "--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1", "--python",
    resolve(root, "scripts/voyage-projection-blender.py").replaceAll("\\", "/")
  ]);
  assert.ok(args.includes(".codex-tmp/voyage-projection-offline/test.json"));
  assert.ok(args.includes("168"));
  assert.ok(args.includes("--lookdev-plates"));
  assert.equal(args.includes("--confirm-production"), false);
});

test("look-development plates cannot enter production rendering", () => {
  assert.throws(() => buildBlenderArguments({
    planPath: resolve(root, ".codex-tmp/voyage-projection-offline/test.json"),
    outputDirectory: resolve(root, ".codex-tmp/voyage-projection-offline/render"),
    mode: "production",
    lookdevPlates: true
  }), /review-only/);
});

test("production rendering fails closed without explicit storage and color authority", async () => {
  await assert.rejects(
    runVoyageOfflineRender({
      command: "production",
      blender: "C:/definitely-missing/blender.exe"
    }),
    /Blender|exited|ENOENT/
  );
});

test("the pinned Blender renderer applies and reports requested Eevee review samples", async () => {
  const source = await readFile(resolve(root, "scripts/voyage-projection-blender.py"), "utf8");
  assert.match(source, /scene[.]eevee[.]taa_render_samples = int\(self[.]args[.]samples\)/);
  assert.match(source, /"effective": voyage[.]effective_samples/);
  assert.match(source, /"controlled": voyage[.]effective_samples == args[.]samples/);
  assert.match(source, /scene[.]compositing_node_group = tree/);
  assert.match(source, /"fogGlowError": None/);
  assert.match(source, /str\(view[.]view_transform\)[.]casefold\(\) == "agx"/);
  assert.match(source, /"lookdevPlatesEnabled": bool\(args[.]lookdev_plates\)/);
  assert.match(source, /"compositionMode": "underlay"/);
  assert.match(source, /LOOKDEV_MANIFEST_PATH/);
  assert.match(source, /not beyond_visible or plate_replaces_volume/);
  assert.match(source, /def engine_plume_material\(/);
  assert.match(source, /def add_engine_plume_mesh\(/);
  assert.match(source, /"layeredEnginePlume": False/);
  assert.match(source, /self[.]review_polish\["layeredEnginePlume"\] = True/);
  assert.match(source, /Voyage Accretion Hot Core/);
  assert.match(source, /"singularity-corona" if shot_id in \("black-hole", "singularity"\)/);
  assert.match(source, /horizontal_anchor=0[.]292 if plate_id == "singularity-corona"/);
  assert.match(source, /vertical_anchor=0[.]435 if plate_id == "singularity-corona"/);
  assert.match(source, /plate_replaces_accretion/);
  assert.match(source, /"layeredAccretion": False/);
  assert.match(source, /"gravitationalLensing": False/);
  assert.match(source, /"unresolvedBeyondBeacon": False/);
  assert.match(source, /"plateReplacesBlackHoleGeometry": False/);
  assert.match(source, /set_tree_visibility\(self[.]groups\["blackHole"\], False\)/);
  assert.match(source, /def radial_halo_material\(/);
  assert.match(source, /Voyage Beyond Beacon Caustic/);
  assert.match(source, /def luminance_probe\(path: Path\)/);
  assert.match(source, /Distinct Voyage shots produced byte-identical output/);
});
