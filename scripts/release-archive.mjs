import { createHash } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});

export function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function validateArchivePath(path) {
  if (typeof path !== "string" || !path || path.length > 240) throw new Error("Archive paths must contain 1-240 characters.");
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) throw new Error(`Unsafe archive path: ${path}`);
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) throw new Error(`Unsafe archive path: ${path}`);
  return path;
}

export function createDeterministicZip(inputEntries) {
  const entries = [...inputEntries]
    .map((entry) => ({ path: validateArchivePath(entry.path), data: Buffer.from(entry.data) }))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
  if (!entries.length) throw new Error("Cannot create an empty release archive.");
  if (new Set(entries.map((entry) => entry.path)).size !== entries.length) throw new Error("Archive paths must be unique.");

  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const compressed = deflateRawSync(entry.data, { level: 9 });
    const checksum = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function findEndRecord(archive) {
  const minimum = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimum; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP end record is missing.");
}

export function readZip(archiveInput) {
  const archive = Buffer.from(archiveInput);
  if (archive.length < 22) throw new Error("ZIP archive is truncated.");
  const endOffset = findEndRecord(archive);
  const disk = archive.readUInt16LE(endOffset + 4);
  const centralDisk = archive.readUInt16LE(endOffset + 6);
  const entriesOnDisk = archive.readUInt16LE(endOffset + 8);
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralSize = archive.readUInt32LE(endOffset + 12);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  const commentLength = archive.readUInt16LE(endOffset + 20);
  if (disk || centralDisk || entriesOnDisk !== entryCount) throw new Error("Multi-disk ZIP archives are not supported.");
  if (entryCount > 2_000) throw new Error("ZIP archive contains too many entries.");
  if (endOffset + 22 + commentLength !== archive.length) throw new Error("ZIP archive has unexpected trailing data.");
  if (centralOffset + centralSize !== endOffset) throw new Error("ZIP central directory is inconsistent.");

  const entries = [];
  const paths = new Set();
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > endOffset || archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error("ZIP central entry is invalid.");
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const checksum = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const size = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const entryCommentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const next = nameStart + nameLength + extraLength + entryCommentLength;
    if (next > endOffset) throw new Error("ZIP central entry is truncated.");
    if (flags & 1 || flags & 8) throw new Error("Encrypted or data-descriptor ZIP entries are not supported.");
    if (![0, 8].includes(method)) throw new Error(`Unsupported ZIP compression method: ${method}`);
    const path = validateArchivePath(archive.subarray(nameStart, nameStart + nameLength).toString("utf8"));
    if (paths.has(path)) throw new Error(`Duplicate ZIP entry: ${path}`);
    paths.add(path);

    if (localOffset + 30 > centralOffset || archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid local ZIP entry: ${path}`);
    const localFlags = archive.readUInt16LE(localOffset + 6);
    const localMethod = archive.readUInt16LE(localOffset + 8);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const localNameStart = localOffset + 30;
    const dataStart = localNameStart + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (localFlags !== flags || localMethod !== method || dataEnd > centralOffset) throw new Error(`Inconsistent local ZIP entry: ${path}`);
    if (archive.subarray(localNameStart, localNameStart + localNameLength).toString("utf8") !== path) throw new Error(`Mismatched local ZIP path: ${path}`);
    const compressed = archive.subarray(dataStart, dataEnd);
    const data = method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed);
    if (data.length !== size || crc32(data) !== checksum) throw new Error(`ZIP integrity check failed: ${path}`);
    entries.push({ path, data, compressedSize, size, crc32: checksum });
    cursor = next;
  }
  if (cursor !== endOffset) throw new Error("ZIP central directory length does not match its entries.");
  return entries;
}
