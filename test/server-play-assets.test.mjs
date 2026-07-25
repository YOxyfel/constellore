import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

test("the local /play preview serves the same relative asset paths as Pages and itch", () => {
  assert.match(server, /url[.]pathname[.]startsWith\("\/play\/"\)/);
  assert.match(server, /url[.]pathname[.]slice\("\/play\/"[.]length\)/);
  assert.match(server, /requestedPlayAsset \|\| url[.]pathname/);
});
