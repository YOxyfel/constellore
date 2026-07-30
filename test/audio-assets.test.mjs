import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { AUDIO_PACKS, validateAudioPacks } from "../scripts/audio-assets.mjs";
import { COSMETIC_ITEMS } from "../public/cosmetic-catalog.mjs";
import { AUDIO_CUE_ORDER, AUDIO_CUE_SLOT_SECONDS, createAudioRuntime } from "../public/audio-runtime.mjs";
import { FEEDBACK_CUES } from "../public/engagement-features.mjs";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("eight declared sound themes ship bounded soundtrack, pulse, and SFX packs", async () => {
  const summary = await validateAudioPacks(projectFile("public/"));
  assert.equal(AUDIO_PACKS.length, 8);
  assert.equal(summary.length, 24);
  assert.deepEqual(
    AUDIO_PACKS.map((pack) => pack.slug),
    [
      "celestial-atlas",
      "aurora-archive",
      "solar-foundry",
      "lunar-garden",
      "eclipse-sovereign",
      "pixel-frontier",
      "bubble-reef",
      "stellar-vanguard"
    ]
  );
  assert.deepEqual(
    summary.filter((asset) => asset.kind === "soundtrack").map((asset) => asset.durationSeconds),
    Array(8).fill(64)
  );
  assert.equal(summary.filter((asset) => asset.kind === "gameplay-pulse").length, 8);
  assert.deepEqual(
    summary.filter((asset) => asset.kind === "gameplay-pulse").map((asset) => asset.durationSeconds),
    Array(8).fill(64)
  );
  assert.deepEqual(
    summary.filter((asset) => asset.kind === "sfx-bank").map((asset) => asset.durationSeconds),
    Array(8).fill(33.6)
  );
  for (const pack of AUDIO_PACKS) {
    const bytes = summary
      .filter((asset) => asset.path.startsWith(`audio/${pack.slug}/`))
      .reduce((total, asset) => total + asset.bytes, 0);
    assert.ok(bytes <= pack.maximumBytes);
  }
});

test("every cosmetic sound theme owns a subpath-safe score, synchronized pulse, and cue bank", () => {
  const themes = COSMETIC_ITEMS.filter((item) => item.slot === "soundTheme");
  assert.equal(themes.length, 8);
  for (const theme of themes) {
    assert.match(theme.assets.soundtrack.path, /^audio\/[a-z0-9-]+\/[a-z0-9-]+[.]mp3$/);
    assert.match(theme.assets.gameplayPulse.path, /^audio\/[a-z0-9-]+\/gameplay-pulse[.]mp3$/);
    assert.match(theme.assets.sfxBank.path, /^audio\/[a-z0-9-]+\/sfx-bank[.]mp3$/);
    assert.equal(theme.assets.soundtrack.duration, 64);
    assert.equal(theme.assets.gameplayPulse.duration, 64);
    assert.equal(theme.assets.sfxBank.duration, 33.6);
  }
  const catalogPaths = themes
    .flatMap((theme) => [
      theme.assets.soundtrack.path,
      theme.assets.gameplayPulse.path,
      theme.assets.sfxBank.path
    ])
    .sort();
  const manifestPaths = AUDIO_PACKS.flatMap((pack) => pack.assets.map((asset) => asset.path)).sort();
  assert.deepEqual(catalogPaths, manifestPaths, "the catalog and shipped audio-pack manifest must stay in exact sync");
});

test("the audio runtime covers every gameplay cue with stable sprite timing", () => {
  assert.deepEqual(AUDIO_CUE_ORDER, [
    "place",
    "combineStart",
    "success",
    "reject",
    "twist",
    "target",
    "sense",
    "mastery",
    "ghostPass",
    "gateClose",
    "gateOpen",
    "runStart",
    "resultReveal",
    "homeReturn",
    "timerWarning",
    "timeout",
    "failure",
    "reward",
    "collectionUnlock",
    "rankPromotion",
    "earth",
    "water",
    "fire",
    "air"
  ]);
  assert.equal(AUDIO_CUE_ORDER.length, 24);
  assert.equal(AUDIO_CUE_SLOT_SECONDS, 1.4);
  assert.deepEqual(Object.keys(FEEDBACK_CUES).filter((cue) => cue !== "uiSelect"), AUDIO_CUE_ORDER);
});

test("haptics remain independent from sound and respect accessibility and page lifecycle", () => {
  const keys = ["navigator", "document", "matchMedia"];
  const descriptors = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const patterns = [];
  let reducedMotion = false;
  const feedbackPreferences = { sound: false, music: false, haptics: true, muted: false, volume: 0.75 };
  let runtime;
  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { vibrate: (pattern) => patterns.push(pattern) }
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { hidden: false }
    });
    Object.defineProperty(globalThis, "matchMedia", {
      configurable: true,
      value: () => ({ matches: reducedMotion })
    });
    runtime = createAudioRuntime({ getPreferences: () => feedbackPreferences });
    assert.deepEqual(runtime.playFeedback("success"), { audio: false, haptic: true });
    assert.deepEqual(patterns, [[14]]);

    feedbackPreferences.haptics = false;
    assert.deepEqual(runtime.playFeedback("success"), { audio: false, haptic: false });
    feedbackPreferences.haptics = true;
    runtime.setSuspended(true);
    assert.deepEqual(runtime.playFeedback("success"), { audio: false, haptic: false });
    runtime.setSuspended(false);
    reducedMotion = true;
    assert.deepEqual(runtime.playFeedback("success"), { audio: false, haptic: false });
    assert.equal(patterns.length, 1);
  } finally {
    runtime?.dispose();
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test("audio generation and provenance remain sample-free and reproducible", async () => {
  const [generator, provenance] = await Promise.all([
    readFile(projectFile("scripts/build-audio-assets.py"), "utf8"),
    readFile(projectFile("AUDIO_ASSET_PROVENANCE.md"), "utf8")
  ]);
  assert.match(generator, /default_rng\(0xC057E110\)/);
  assert.match(generator, /libmp3lame/);
  assert.match(provenance, /no third-party samples/i);
  assert.match(provenance, /Charting the First Sky/);
  assert.match(provenance, /Frostglass Memory/);
  assert.match(provenance, /The Orrery Turns/);
  assert.match(provenance, /Midnight Bloom/);
  assert.match(provenance, /Crown of Shadow/);
  assert.match(provenance, /gameplay-pulse[.]mp3/);
  assert.match(provenance, /24 isolated 1[.]4-second cue slots/);
  assert.match(provenance, /rankPromotion/);
  assert.match(provenance, /earth/);
  assert.match(generator, /moon-bell/);
  assert.match(generator, /sovereign-pad/);
  assert.match(generator, /compose_pixel_frontier/);
  assert.match(generator, /compose_bubble_reef/);
  assert.match(generator, /compose_stellar_vanguard/);
});
