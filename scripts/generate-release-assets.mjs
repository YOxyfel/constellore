import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

function encodePng(width, height, rgba) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    scanlines[row] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(scanlines, row + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function canvas(width, height) {
  const pixels = new Uint8Array(width * height * 4);
  function pixel(x, y, color) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    const offset = (py * width + px) * 4;
    const alpha = (color[3] ?? 255) / 255;
    const inverse = 1 - alpha;
    pixels[offset] = Math.round(color[0] * alpha + pixels[offset] * inverse);
    pixels[offset + 1] = Math.round(color[1] * alpha + pixels[offset + 1] * inverse);
    pixels[offset + 2] = Math.round(color[2] * alpha + pixels[offset + 2] * inverse);
    pixels[offset + 3] = 255;
  }
  function rect(x, y, rectWidth, rectHeight, color) {
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(width, Math.ceil(x + rectWidth));
    const bottom = Math.min(height, Math.ceil(y + rectHeight));
    for (let py = top; py < bottom; py += 1) for (let px = left; px < right; px += 1) pixel(px, py, color);
  }
  function circle(cx, cy, radius, color, thickness = 0) {
    const bound = Math.ceil(radius + Math.max(1, thickness));
    for (let y = Math.floor(cy - bound); y <= Math.ceil(cy + bound); y += 1) {
      for (let x = Math.floor(cx - bound); x <= Math.ceil(cx + bound); x += 1) {
        const distance = Math.hypot(x - cx, y - cy);
        if (thickness ? Math.abs(distance - radius) <= thickness / 2 : distance <= radius) pixel(x, y, color);
      }
    }
  }
  function line(x1, y1, x2, y2, color, thickness = 1) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      circle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, thickness / 2, color);
    }
  }
  return { width, height, pixels, pixel, rect, circle, line };
}

function background(surface, start, end) {
  for (let y = 0; y < surface.height; y += 1) {
    const vertical = y / Math.max(1, surface.height - 1);
    for (let x = 0; x < surface.width; x += 1) {
      const glow = Math.max(0, 1 - Math.hypot(x / surface.width - .78, y / surface.height - .34) * 1.7);
      surface.pixel(x, y, [
        start[0] + (end[0] - start[0]) * vertical + glow * 25,
        start[1] + (end[1] - start[1]) * vertical + glow * 14,
        start[2] + (end[2] - start[2]) * vertical + glow * 52,
        255
      ]);
    }
  }
}

function seededRandom(seed = 0x6f787966) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function stars(surface, count, seed) {
  const random = seededRandom(seed);
  for (let index = 0; index < count; index += 1) {
    const x = random() * surface.width;
    const y = random() * surface.height;
    const radius = random() > .91 ? 2 : 1;
    const alpha = 70 + Math.round(random() * 150);
    surface.circle(x, y, radius, [220, 231, 255, alpha]);
  }
}

function star(surface, cx, cy, radius, color) {
  surface.line(cx - radius, cy, cx + radius, cy, color, Math.max(1, radius / 5));
  surface.line(cx, cy - radius, cx, cy + radius, color, Math.max(1, radius / 5));
  surface.line(cx - radius * .55, cy - radius * .55, cx + radius * .55, cy + radius * .55, color, Math.max(1, radius / 7));
  surface.line(cx + radius * .55, cy - radius * .55, cx - radius * .55, cy + radius * .55, color, Math.max(1, radius / 7));
  surface.circle(cx, cy, radius * .23, color);
}

const FONT = Object.fromEntries(Object.entries({
  " ": "00000/00000/00000/00000/00000/00000/00000", ".": "00000/00000/00000/00000/00000/00110/00110", "-": "00000/00000/00000/11111/00000/00000/00000",
  A: "01110/10001/10001/11111/10001/10001/10001", B: "11110/10001/10001/11110/10001/10001/11110", C: "01111/10000/10000/10000/10000/10000/01111",
  D: "11110/10001/10001/10001/10001/10001/11110", E: "11111/10000/10000/11110/10000/10000/11111", F: "11111/10000/10000/11110/10000/10000/10000",
  G: "01111/10000/10000/10111/10001/10001/01111", H: "10001/10001/10001/11111/10001/10001/10001", I: "11111/00100/00100/00100/00100/00100/11111",
  J: "00111/00010/00010/00010/10010/10010/01100", K: "10001/10010/10100/11000/10100/10010/10001", L: "10000/10000/10000/10000/10000/10000/11111",
  M: "10001/11011/10101/10101/10001/10001/10001", N: "10001/11001/10101/10011/10001/10001/10001", O: "01110/10001/10001/10001/10001/10001/01110",
  P: "11110/10001/10001/11110/10000/10000/10000", Q: "01110/10001/10001/10001/10101/10010/01101", R: "11110/10001/10001/11110/10100/10010/10001",
  S: "01111/10000/10000/01110/00001/00001/11110", T: "11111/00100/00100/00100/00100/00100/00100", U: "10001/10001/10001/10001/10001/10001/01110",
  V: "10001/10001/10001/10001/10001/01010/00100", W: "10001/10001/10001/10101/10101/10101/01010", X: "10001/10001/01010/00100/01010/10001/10001",
  Y: "10001/10001/01010/00100/00100/00100/00100", Z: "11111/00001/00010/00100/01000/10000/11111"
}).map(([key, glyph]) => [key, glyph.split("/")]));

function textWidth(value, scale, spacing = 1) {
  return Math.max(0, value.length * (5 + spacing) * scale - spacing * scale);
}

function drawText(surface, value, x, y, scale, color, spacing = 1) {
  let cursor = x;
  for (const character of value.toUpperCase()) {
    const glyph = FONT[character] || FONT[" "];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((bit, columnIndex) => {
        if (bit === "1") surface.rect(cursor + columnIndex * scale, y + rowIndex * scale, scale, scale, color);
      });
    });
    cursor += (5 + spacing) * scale;
  }
}

function drawBrandMark(surface, cx, cy, radius) {
  surface.circle(cx, cy, radius * 1.55, [165, 134, 255, 22], Math.max(2, radius * .055));
  surface.circle(cx, cy, radius, [18, 22, 48, 235]);
  surface.circle(cx, cy, radius, [175, 147, 255, 185], Math.max(2, radius * .045));
  surface.circle(cx, cy, radius * .68, [105, 226, 255, 65], Math.max(2, radius * .035));
  star(surface, cx, cy, radius * .43, [216, 204, 255, 255]);
}

function iconPng(size, maskable = false) {
  const surface = canvas(size, size);
  background(surface, [7, 9, 20], [10, 12, 32]);
  stars(surface, Math.max(40, Math.round(size * .28)), maskable ? 0x5120aa : 0x1920aa);
  const radius = size * (maskable ? .245 : .31);
  drawBrandMark(surface, size / 2, size / 2, radius);
  return encodePng(size, size, surface.pixels);
}

function socialCardPng() {
  const surface = canvas(1200, 630);
  background(surface, [6, 8, 19], [9, 11, 29]);
  stars(surface, 220, 0xc057e110);
  surface.circle(969, 196, 268, [171, 139, 255, 28], 2);
  surface.circle(969, 196, 356, [100, 222, 255, 17], 2);
  surface.line(763, 446, 938, 303, [171, 139, 255, 85], 2);
  surface.line(938, 303, 1081, 395, [111, 231, 255, 75], 2);
  surface.circle(763, 446, 12, [171, 139, 255, 255]);
  surface.circle(938, 303, 16, [111, 231, 255, 255]);
  surface.circle(1081, 395, 11, [255, 204, 118, 255]);
  drawBrandMark(surface, 955, 182, 82);
  surface.rect(70, 72, 8, 486, [171, 139, 255, 210]);
  drawText(surface, "CONSTELLORE", 114, 98, 9, [210, 197, 255, 255], 2);
  drawText(surface, "BUILD A UNIVERSE.", 114, 250, 7, [246, 243, 255, 255], 1);
  drawText(surface, "FIND THE WORD.", 114, 334, 7, [112, 230, 255, 255], 1);
  drawText(surface, "TARGET-BASED WORD ROUTE PUZZLE", 117, 476, 3, [167, 171, 195, 255], 1);
  drawText(surface, "LOCAL PRACTICE BETA", 117, 523, 3, [121, 227, 194, 255], 1);
  return encodePng(surface.width, surface.height, surface.pixels);
}

export async function generateReleaseAssets() {
  const publicDirectory = join(root, "public");
  await mkdir(publicDirectory, { recursive: true });
  const assets = [
    ["icon-192.png", iconPng(192)],
    ["icon-512.png", iconPng(512)],
    ["icon-maskable-512.png", iconPng(512, true)],
    ["social-card.png", socialCardPng()]
  ];
  await Promise.all(assets.map(([name, contents]) => writeFile(join(publicDirectory, name), contents)));
  return assets.map(([name, contents]) => ({ name, bytes: contents.length }));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const assets = await generateReleaseAssets();
  for (const asset of assets) console.log(`Generated public/${asset.name} (${asset.bytes} bytes)`);
}
