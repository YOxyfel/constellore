import test from "node:test";
import assert from "node:assert/strict";
import { createDeterministicZip, readZip, sha256, validateArchivePath } from "../scripts/release-archive.mjs";

test("release ZIP creation is deterministic, sorted, and readable", () => {
  const input = [
    { path: "nested/world.mjs", data: Buffer.from("export const world = 1;\n") },
    { path: "index.html", data: Buffer.from("<!doctype html><title>Constellore</title>\n") }
  ];
  const first = createDeterministicZip(input);
  const second = createDeterministicZip([...input].reverse());
  assert.deepEqual(first, second);
  assert.equal(sha256(first), sha256(second));
  const contents = readZip(first);
  assert.deepEqual(contents.map((entry) => entry.path), ["index.html", "nested/world.mjs"]);
  assert.equal(contents[0].data.toString("utf8"), "<!doctype html><title>Constellore</title>\n");
});

test("release ZIP paths reject traversal, roots, backslashes, and duplicates", () => {
  for (const path of ["../secret", "/rooted", "nested\\file", "a/./b", "a//b"]) {
    assert.throws(() => validateArchivePath(path), /Unsafe archive path/);
  }
  assert.throws(() => createDeterministicZip([
    { path: "index.html", data: Buffer.from("one") },
    { path: "index.html", data: Buffer.from("two") }
  ]), /unique/);
});

test("release ZIP verification rejects damaged bytes", () => {
  const archive = createDeterministicZip([{ path: "index.html", data: Buffer.from("hello deterministic cosmos") }]);
  const damaged = Buffer.from(archive);
  const dataStart = 30 + damaged.readUInt16LE(26) + damaged.readUInt16LE(28);
  damaged[dataStart] ^= 0xff;
  assert.throws(() => readZip(damaged));
});
