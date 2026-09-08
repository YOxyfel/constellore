import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export function importMapText(document) {
  // HTML input preprocessing normalizes CRLF and lone CR before script text
  // reaches CSP. Hash that browser-visible text, including its whitespace.
  const normalized = String(document || "").replace(/\r\n?/g, "\n");
  const matches = [...normalized.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter((match) => /\btype\s*=\s*["']importmap["']/i.test(match[1]));
  assert.equal(matches.length, 1, "The game document must contain exactly one inline import map.");
  return matches[0][2];
}

export function sha256CspSource(text) {
  return `sha256-${createHash("sha256").update(String(text), "utf8").digest("base64")}`;
}

export function importMapCspSource(document) {
  return sha256CspSource(importMapText(document));
}
