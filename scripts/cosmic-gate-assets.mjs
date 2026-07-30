import assert from "node:assert/strict";

export const COSMIC_GATE_ASSETS = Object.freeze([
  Object.freeze({
    name: "cosmic-gate-v2-md.webp",
    path: "art/transitions/cosmic-gate-v2-md.webp",
    width: 1920,
    height: 1080,
    maximumBytes: 650_000
  }),
  Object.freeze({
    name: "cosmic-gate-v2-lg.webp",
    path: "art/transitions/cosmic-gate-v2-lg.webp",
    width: 3840,
    height: 2160,
    maximumBytes: 1_250_000
  }),
  Object.freeze({
    name: "cosmic-gate-v2-portrait.webp",
    path: "art/transitions/cosmic-gate-v2-portrait.webp",
    width: 1440,
    height: 2560,
    maximumBytes: 850_000
  })
]);

export function webpDimensions(buffer, label) {
  assert.ok(buffer.length >= 30, `${label} is too small to be a valid WebP image.`);
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "RIFF", `${label} is not a WebP RIFF file.`);
  assert.equal(buffer.subarray(8, 12).toString("ascii"), "WEBP", `${label} is not a valid WebP container.`);

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.subarray(offset, offset + 4).toString("ascii");
    const size = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    assert.ok(dataOffset + size <= buffer.length, `${label} contains a truncated ${chunk} chunk.`);

    if (chunk === "VP8X") {
      assert.ok(size >= 10, `${label} contains an invalid VP8X header.`);
      return {
        width: buffer.readUIntLE(dataOffset + 4, 3) + 1,
        height: buffer.readUIntLE(dataOffset + 7, 3) + 1
      };
    }

    if (chunk === "VP8L") {
      assert.ok(size >= 5 && buffer[dataOffset] === 0x2f, `${label} contains an invalid VP8L header.`);
      const packed = buffer.readUInt32LE(dataOffset + 1);
      return {
        width: (packed & 0x3fff) + 1,
        height: ((packed >>> 14) & 0x3fff) + 1
      };
    }

    if (chunk === "VP8 ") {
      assert.ok(size >= 10, `${label} contains an invalid VP8 header.`);
      assert.deepEqual(
        [...buffer.subarray(dataOffset + 3, dataOffset + 6)],
        [0x9d, 0x01, 0x2a],
        `${label} contains an invalid VP8 frame header.`
      );
      return {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff
      };
    }

    offset = dataOffset + size + (size % 2);
  }

  assert.fail(`${label} does not contain a supported WebP image chunk.`);
}

export function assertResponsiveWebpAsset(buffer, asset, label = asset.path) {
  const dimensions = webpDimensions(buffer, label);
  assert.equal(dimensions.width, asset.width, `${label} has the wrong width.`);
  assert.equal(dimensions.height, asset.height, `${label} has the wrong height.`);
  assert.ok(buffer.length <= asset.maximumBytes, `${label} exceeded ${asset.maximumBytes} bytes (${buffer.length} bytes).`);
  return dimensions;
}

export function assertCosmicGateAsset(buffer, asset, label = asset.path) {
  return assertResponsiveWebpAsset(buffer, asset, label);
}
