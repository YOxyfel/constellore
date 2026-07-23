import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pages = await Promise.all(["privacy", "terms", "support"].map(async (name) => [name, await readFile(new URL(`../Website/${name}.html`, import.meta.url), "utf8")]));

test("public beta policy pages have identity, navigation, and no placeholders", () => {
  for (const [name, html] of pages) {
    assert.match(html, /Yane Zhekov|Oxyfel Games/, `${name} lacks an operator identity.`);
    assert.match(html, /<main\b[^>]*id="main"/i, `${name} lacks a main landmark.`);
    assert.match(html, /privacy[.]html|terms[.]html|support[.]html/i, `${name} lacks policy navigation.`);
    assert.doesNotMatch(html, /\bTODO\b|\bTBD\b/, `${name} contains an unresolved placeholder.`);
  }
});

test("commercial capabilities remain explicitly unavailable in free beta terms", () => {
  const terms = new Map(pages).get("terms");
  assert.match(terms, /no active checkout/i);
  assert.match(terms, /provider-verified fulfillment/i);
  assert.match(terms, /mandatory rights/i);
});

test("privacy copy matches the simplified deterministic public site", () => {
  const privacy = new Map(pages).get("privacy");
  assert.doesNotMatch(privacy, /wishlist control/i);
  assert.match(privacy, /Pages and itch Explore mode is deterministic/i);
});
