import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { importMapCspSource, importMapText } from '../scripts/inline-script-csp.mjs';

test('import-map CSP follows HTML newline preprocessing on Windows and Unix', () => {
  const script = '\n  {"imports":{"three":"./vendor/three.mjs"}}\n';
  const document = `<script type="importmap">${script}</script>`;
  const expected = `sha256-${createHash('sha256').update(script).digest('base64')}`;
  for (const newline of ['\n', '\r\n', '\r']) {
    const source = document.replaceAll('\n', newline);
    assert.equal(importMapText(source), script);
    assert.equal(importMapCspSource(source), expected);
  }
  assert.notEqual(importMapCspSource(document.replace('  {', ' {')), expected,
    'Normalizing newlines must not trim meaningful script whitespace.');
});
