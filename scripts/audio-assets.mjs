import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const pack = (slug, soundtrack) => Object.freeze({
  slug,
  maximumBytes: 1_200_000,
  assets: Object.freeze([
    Object.freeze({
      kind: "soundtrack",
      path: `audio/${slug}/${soundtrack}`,
      minimumBytes: 480_000,
      maximumBytes: 525_000,
      durationSeconds: 64
    }),
    Object.freeze({
      kind: "gameplay-pulse",
      path: `audio/${slug}/gameplay-pulse.mp3`,
      minimumBytes: 290_000,
      maximumBytes: 350_000,
      durationSeconds: 64
    }),
    Object.freeze({
      kind: "sfx-bank",
      path: `audio/${slug}/sfx-bank.mp3`,
      minimumBytes: 250_000,
      maximumBytes: 290_000,
      durationSeconds: 33.6
    })
  ])
});

export const AUDIO_PACKS = Object.freeze([
  pack("celestial-atlas", "charting-the-first-sky.mp3"),
  pack("aurora-archive", "frostglass-memory.mp3"),
  pack("solar-foundry", "the-orrery-turns.mp3"),
  pack("lunar-garden", "midnight-bloom.mp3"),
  pack("eclipse-sovereign", "crown-of-shadow.mp3"),
  pack("pixel-frontier", "bitstream-constellations.mp3"),
  pack("bubble-reef", "bubbles-beyond-the-blue.mp3"),
  pack("stellar-vanguard", "beyond-the-silent-meridian.mp3")
]);

function containsMpegFrame(buffer) {
  const limit = Math.min(buffer.length - 1, 4_096);
  for (let index = 0; index < limit; index += 1) {
    if (buffer[index] === 0xff && (buffer[index + 1] & 0xe0) === 0xe0) return true;
  }
  return false;
}

export function assertAudioAsset(buffer, asset, label = asset.path) {
  assert.ok(Buffer.isBuffer(buffer), `${label} must be read as a Buffer.`);
  assert.ok(buffer.length >= asset.minimumBytes, `${label} is unexpectedly small (${buffer.length} bytes).`);
  assert.ok(buffer.length <= asset.maximumBytes, `${label} exceeded ${asset.maximumBytes} bytes (${buffer.length} bytes).`);
  assert.ok(
    buffer.subarray(0, 3).toString("ascii") === "ID3" || containsMpegFrame(buffer),
    `${label} is not a recognizable MP3 asset.`
  );
  return {
    path: asset.path,
    bytes: buffer.length,
    durationSeconds: asset.durationSeconds,
    kind: asset.kind
  };
}

export async function validateAudioPacks(publicDirectory = join(root, "public")) {
  const publicPath = publicDirectory instanceof URL ? fileURLToPath(publicDirectory) : publicDirectory;
  const audioDirectory = join(publicPath, "audio");
  const expectedDirectories = AUDIO_PACKS.map((entry) => entry.slug).sort((left, right) => left.localeCompare(right, "en"));
  const actualDirectories = (await readdir(audioDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));
  assert.deepEqual(actualDirectories, expectedDirectories, "Runtime audio must contain exactly the declared theme packs.");

  const summaries = [];
  for (const entry of AUDIO_PACKS) {
    const directory = join(audioDirectory, entry.slug);
    const actualFiles = (await readdir(directory, { withFileTypes: true }))
      .filter((file) => file.isFile())
      .map((file) => file.name)
      .sort((left, right) => left.localeCompare(right, "en"));
    const expectedFiles = entry.assets
      .map((asset) => asset.path.split("/").at(-1))
      .sort((left, right) => left.localeCompare(right, "en"));
    assert.deepEqual(actualFiles, expectedFiles, `${entry.slug} contains an undeclared or missing audio asset.`);
    let bytes = 0;
    for (const asset of entry.assets) {
      const summary = assertAudioAsset(await readFile(join(publicPath, asset.path)), asset);
      summaries.push(summary);
      bytes += summary.bytes;
    }
    assert.ok(bytes <= entry.maximumBytes, `${entry.slug} exceeded its ${entry.maximumBytes}-byte audio-pack budget (${bytes} bytes).`);
  }
  return summaries;
}
