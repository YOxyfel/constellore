import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { COSMETIC_PACKS } from "./cosmetic-assets.mjs";

const execFile = promisify(execFileCallback);
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const python = process.env.CONSTELLORE_PYTHON || (process.platform === "win32" ? "python" : "python3");
const builds = Object.freeze([
  Object.freeze({
    slug: "aurora-archive",
    args: [
      "--home-source", "itch-assets/cosmetics/aurora-archive-home-source.png",
      "--home-portrait-source", "itch-assets/cosmetics/aurora-archive-home-portrait-source.png",
      "--gate-source", "itch-assets/cosmetics/aurora-archive-gate-landscape-source.png",
      "--gate-portrait-source", "itch-assets/cosmetics/aurora-archive-gate-source.png",
      "--gate-landscape-quality-offset", "-5"
    ]
  }),
  Object.freeze({
    slug: "solar-foundry",
    args: [
      "--home-source", "itch-assets/cosmetics/solar-foundry-home-source.png",
      "--home-portrait-source", "itch-assets/cosmetics/solar-foundry-home-portrait-source.png",
      "--home-portrait-quality-offset", "-10",
      "--gate-source", "itch-assets/cosmetics/solar-foundry-gate-landscape-source.png",
      "--gate-portrait-source", "itch-assets/cosmetics/solar-foundry-gate-source.png"
    ]
  }),
  Object.freeze({
    slug: "lunar-garden",
    args: [
      "--home-source", "itch-assets/cosmetics/lunar-garden-home-source.png",
      "--home-portrait-source", "itch-assets/cosmetics/lunar-garden-home-portrait-source.png",
      "--gate-source", "itch-assets/cosmetics/lunar-garden-gate-landscape-source.png",
      "--gate-portrait-source", "itch-assets/cosmetics/lunar-garden-gate-source.png",
      "--gate-landscape-quality-offset", "-5"
    ]
  }),
  Object.freeze({
    slug: "eclipse-sovereign",
    args: [
      "--home-source", "itch-assets/cosmetics/eclipse-sovereign-home-source.png",
      "--home-portrait-source", "itch-assets/cosmetics/eclipse-sovereign-home-portrait-source.png",
      "--home-portrait-center-y", "0.15",
      "--gate-source", "itch-assets/cosmetics/eclipse-sovereign-gate-landscape-source.png",
      "--gate-portrait-source", "itch-assets/cosmetics/eclipse-sovereign-gate-source.png",
      "--gate-landscape-quality-offset", "-26"
    ]
  }),
  Object.freeze({
    slug: "pixel-frontier",
    args: [
      "--home-source", "itch-assets/cosmetics/pixel-frontier-home-source.png",
      "--home-portrait-source", "itch-assets/cosmetics/pixel-frontier-home-portrait-source.png",
      "--home-portrait-quality-offset", "-2",
      "--gate-source", "itch-assets/cosmetics/pixel-frontier-gate-source.png",
      "--gate-portrait-source", "itch-assets/cosmetics/pixel-frontier-gate-portrait-source.png",
      "--pixelated"
    ]
  }),
  Object.freeze({
    slug: "bubble-reef",
    args: [
      "--home-source", "itch-assets/cosmetics/bubble-reef-home-source.png",
      "--home-portrait-source", "itch-assets/cosmetics/bubble-reef-home-portrait-source.png",
      "--home-portrait-quality-offset", "-21",
      "--gate-source", "itch-assets/cosmetics/bubble-reef-gate-source.png",
      "--gate-portrait-source", "itch-assets/cosmetics/bubble-reef-gate-portrait-source.png",
      "--quality-offset", "-12"
    ]
  }),
  Object.freeze({
    slug: "stellar-vanguard",
    args: [
      "--home-source", "itch-assets/cosmetics/stellar-vanguard-home-source.png",
      "--home-portrait-source", "itch-assets/cosmetics/stellar-vanguard-home-portrait-source.png",
      "--gate-source", "itch-assets/cosmetics/stellar-vanguard-gate-source.png",
      "--gate-portrait-source", "itch-assets/cosmetics/stellar-vanguard-gate-portrait-source.png",
      "--quality-offset", "-10"
    ]
  })
]);

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const tempRoot = await mkdtemp(join(tmpdir(), "constellore-cosmetic-art-"));

try {
  const { stdout: toolchain } = await execFile(
    python,
    ["-c", "import PIL, PIL.features; print(f'Pillow {PIL.__version__}; WebP {PIL.features.version(\"webp\")}')"],
    { cwd: projectRoot }
  );
  let verified = 0;

  for (const build of builds) {
    const pack = COSMETIC_PACKS.find((entry) => entry.slug === build.slug);
    assert.ok(pack, `Missing cosmetic pack declaration for ${build.slug}.`);
    const output = join(tempRoot, build.slug);
    await execFile(
      python,
      ["scripts/build-cosmetic-art.py", ...build.args, "--output", output],
      { cwd: projectRoot, maxBuffer: 2_000_000 }
    );

    for (const asset of pack.assets) {
      const [rebuilt, shipped] = await Promise.all([
        readFile(join(output, asset.name)),
        readFile(join(projectRoot, "public", asset.path))
      ]);
      assert.equal(
        sha256(rebuilt),
        sha256(shipped),
        `${build.slug}/${asset.name} does not reproduce from its approved master and current recipe.`
      );
      verified += 1;
    }
  }

  const expected = COSMETIC_PACKS.reduce((total, pack) => total + pack.assets.length, 0);
  console.log(`Verified ${verified}/${expected} cosmetic derivatives byte-for-byte (${toolchain.trim()}).`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
