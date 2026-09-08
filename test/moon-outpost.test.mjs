import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MOON_OUTPOST_CACHE_TIERS,
  MOON_OUTPOST_ROCKET_LAYERS,
  createMoonOutpostModel,
  normalizeMoonOutpostAsset
} from "../public/moon-outpost-presentation.mjs";
import { moonOutpostNavigation } from "../public/moon-outpost-runtime.mjs";

const completeMoon = (power = "solar", shelter = "hive", signal = "stars") => ({
  id: "moon",
  title: "The Moon",
  completed: true,
  outcomeKey: `moon:${power}:${shelter}:${signal}`,
  worldword: { word: "Lander" },
  slots: [
    { id: "power", title: "Power", status: "anchored", choiceId: power, memory: { a: "Sun", b: "Power", word: "Solar Power" } },
    { id: "shelter", title: "Shelter", status: "anchored", choiceId: shelter, memory: { a: "Room", b: "Room", word: "House" } },
    { id: "signal", title: "Signal", status: "anchored", choiceId: signal, memory: { a: "Sky", b: "Star", word: "Constellation" } }
  ]
});

test("Outpost navigation keeps Back origin-aware and Main menu independent", () => {
  assert.deepEqual(moonOutpostNavigation(), {
    origin: "home",
    backLabel: "Home",
    backAriaLabel: "Back to Home"
  });
  assert.deepEqual(moonOutpostNavigation({ origin: "worldweaving" }), {
    origin: "worldweaving",
    backLabel: "Moon Worldweaving",
    backAriaLabel: "Back to Moon Worldweaving"
  });
  assert.equal(moonOutpostNavigation({ origin: "unknown" }).origin, "home");
});

test("Moon Outpost projects every 2 x 3 x 2 authored outcome without flattening choices", () => {
  const variants = new Set();
  for (const power of ["solar", "lunar"]) {
    for (const shelter of ["bastion", "hive", "haven"]) {
      for (const signal of ["beacon", "stars"]) {
        const model = createMoonOutpostModel(completeMoon(power, shelter, signal));
        assert.equal(model.launchReady, false);
        assert.equal(model.destination.contentReady, false);
        assert.equal(model.variantKey, `${power}-${shelter}-${signal}`);
        assert.deepEqual(model.slots.map(({ choiceId }) => choiceId), [power, shelter, signal]);
        variants.add(model.variantKey);
      }
    }
  }
  assert.equal(variants.size, 12);
});

test("Mars remains a noninteractive preparing destination until its content is declared ready", () => {
  const preparing = createMoonOutpostModel(completeMoon(), {
    destination: { id: "mars", title: "Mars", contentReady: false }
  });
  const released = createMoonOutpostModel(completeMoon(), {
    destination: { id: "mars", title: "Mars", contentReady: true }
  });
  assert.equal(preparing.launchReady, false);
  assert.equal(released.launchReady, true);
});

test("rocket art is layered, bounded, and defaults to the transparent generated hull", () => {
  assert.deepEqual(MOON_OUTPOST_ROCKET_LAYERS, ["shadow", "hull", "window", "engine", "markings", "glow"]);
  assert.equal(createMoonOutpostModel(completeMoon()).rocket.layers.hull, "./art/moon-outpost/rocket-core-v1.png");
  assert.equal(normalizeMoonOutpostAsset("art/moon-outpost/custom-window.webp"), "./art/moon-outpost/custom-window.webp");
  assert.equal(normalizeMoonOutpostAsset("../private.png"), "");
  assert.equal(normalizeMoonOutpostAsset("https://example.com/tracker.png"), "");
  assert.equal(normalizeMoonOutpostAsset("data:image/svg+xml,bad"), "");
});

test("cache catalog keeps four tiers visible while capability and economy remain host-owned", () => {
  const model = createMoonOutpostModel(completeMoon(), {
    cache: {
      state: {
        wallet: 240,
        freeOpens: { common: 1 },
        pity: { rare: { current: 3, threshold: 10 } },
        selectionShards: { current: 4, target: 10 }
      },
      catalog: [
        { id: "common", cost: 90, odds: [{ label: "Featured", value: "10%" }] },
        { id: "rare", cost: 180, odds: [{ label: "Featured", value: "20%" }] },
        { id: "epic", cost: 300 },
        { id: "mythic", cost: 600 }
      ],
      selectionOptions: [
        { id: "frame-comet", label: "Comet Frame", slot: "profile-frame", owned: false },
        { id: "trail-moon", label: "Moon Trail", slot: "trail", owned: true },
        { id: "", label: "Invalid", slot: "trail", owned: false }
      ]
    }
  });
  assert.deepEqual(MOON_OUTPOST_CACHE_TIERS, ["common", "rare", "epic", "mythic"]);
  assert.deepEqual(model.cache.tiers.map(({ id }) => id), MOON_OUTPOST_CACHE_TIERS);
  assert.equal(model.cache.tiers[0].freeOpens, 1);
  assert.equal(model.cache.tiers[0].canOpen, true);
  assert.equal(model.cache.tiers[1].pity.current, 3);
  assert.equal(model.cache.tiers[1].canOpen, true);
  assert.equal(model.cache.tiers[2].capabilityLocked, true);
  assert.equal(model.cache.tiers[3].capabilityLocked, true);
  assert.deepEqual(model.cache.selectionShards, { current: 4, target: 10, label: "Selection shards" });
  assert.deepEqual(model.cache.selectionOptions, [
    { id: "frame-comet", label: "Comet Frame", slot: "profile-frame", owned: false },
    { id: "trail-moon", label: "Moon Trail", slot: "trail", owned: true }
  ]);
  assert.equal(Object.isFrozen(model.cache.selectionOptions), true);

  const epicUnlocked = createMoonOutpostModel(completeMoon(), {
    cache: { state: { wallet: 500 }, catalog: [{ id: "epic", cost: 300, capabilityUnlocked: true }] }
  });
  assert.equal(epicUnlocked.cache.tiers[2].capabilityLocked, false);
  assert.equal(epicUnlocked.cache.tiers[2].canOpen, true);
});

test("structure simulator values are bounded projections and actions stay host-declared", () => {
  const model = createMoonOutpostModel(completeMoon(), {
    structures: {
      power: {
        stage: 4,
        name: "Helios Array",
        meaningCharge: { current: 72, capacity: 100 },
        passiveStardust: { pending: 38, ratePerHour: 4.5, cap: 80, calibrated: true },
        actions: {
          upgrade: { enabled: false, reason: "Needs 100 Meaning" },
          calibrate: { enabled: true, label: "Tune" },
          collect: { enabled: true }
        }
      },
      shelter: {
        stage: 2,
        name: "Room Hive",
        meaningCharge: { current: 1_000_000_000, cap: 40 },
        passive: { pending: 1_000_000_000, rate: 3, capacity: 50 }
      }
    }
  });
  const power = model.slots[0].simulator;
  assert.equal(power.stage, 4);
  assert.equal(power.name, "Helios Array");
  assert.deepEqual(power.meaning, { current: 72, capacity: 100, label: "Meaning charge" });
  assert.deepEqual(power.stardust, { pending: 38, ratePerHour: 4.5, cap: 80, calibrated: true });
  assert.equal(power.actions.upgrade.enabled, false);
  assert.equal(power.actions.upgrade.reason, "Needs 100 Meaning");
  assert.equal(power.actions.calibrate.label, "Tune");
  assert.equal(power.actions.collect.enabled, true);

  const shelter = model.slots[1].simulator;
  assert.equal(shelter.meaning.current, 1_000_000);
  assert.equal(shelter.stardust.pending, 1_000_000);
  assert.equal(Object.isFrozen(power.actions), true);
  assert.equal(Object.isFrozen(power.stardust), true);
});

test("runtime and CSS expose accessible isolated Outpost, cache, parallax, and launch hooks", async () => {
  const [runtime, css] = await Promise.all([
    readFile(new URL("../public/moon-outpost-runtime.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/moon-outpost.css", import.meta.url), "utf8")
  ]);
  for (const callback of ["onOpenCache", "onBeginLaunch", "onLaunchComplete", "onExploreWorldword", "onBack", "onMainMenu", "onReturnToWorldweaving", "onStructureAction", "onRedeemSelection"]) {
    assert.match(runtime, new RegExp(`\\b${callback}\\b`));
  }
  assert.match(runtime, /data-outpost-screen="overview"/);
  assert.match(runtime, /data-outpost-screen="cache"/);
  assert.match(runtime, /data-outpost-screen="launch"/);
  assert.match(runtime, /aria-live="polite"/);
  assert.match(runtime, /aria-pressed/);
  assert.match(runtime, /id="moonOutpostBackLabel">Home/);
  assert.match(runtime, /data-outpost-action="main-menu"/);
  assert.match(runtime, /data-outpost-action="pane" data-outpost-pane="scene">Scene/);
  assert.match(runtime, /data-outpost-action="pane" data-outpost-pane="detail">Console/);
  assert.match(runtime, /setProjectPane\("detail", \{ focus: compactProjectLayout \}\)/);
  assert.match(runtime, /nodes[.]overflow[.]hidden = redundantMainMenu/);
  assert.match(runtime, /else void navigateBack\(nodes[.]back\)/);
  assert.match(runtime, /pointermove/);
  assert.match(runtime, /prefers-reduced-motion: reduce/);
  assert.match(runtime, /onStructureAction\(\{ action: command, structureId \}, trigger\)/);
  assert.match(runtime, /onStructureAction[\s\S]{0,900}render\(\)/);
  assert.match(runtime, /onRedeemSelection\(\{ cosmeticId: option[.]id \}, trigger\)/);
  assert.match(runtime, /shards[.]current\s*>=\s*shards[.]target/);
  assert.match(runtime, /`Redeem \$\{shards[.]target\} shards`/);
  assert.match(runtime, /onRedeemSelection[\s\S]{0,1100}renderCacheCatalog\(\)/);
  assert.match(runtime, /complete:\s*Math[.]max\(1000, Number\(launchTimings[.]complete\) \|\| 2100\)/);
  assert.doesNotMatch(runtime, /from "[.]\/app[.]js/);
  assert.doesNotMatch(runtime, /localStorage|sessionStorage|fetch\s*\(/);

  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /orientation: landscape/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /Compact Outpost shell/);
  assert.match(css, /object-fit:\s*contain/);
  assert.match(css, /data-variant="solar"/);
  assert.match(css, /data-variant="hive"/);
  assert.match(css, /data-variant="stars"/);
  assert.match(css, /moon-outpost__simulator-metrics/);
  assert.match(css, /moon-outpost__simulator-actions/);
  assert.match(css, /moon-outpost__selection-redeem/);
});
