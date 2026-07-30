import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALL_COSMETIC_BODY_CLASSES,
  COSMETIC_CATALOG,
  COSMETIC_COLLECTIONS,
  COSMETIC_SCHEMA_VERSION,
  COSMETIC_SLOTS,
  DEFAULT_COSMETIC_LOADOUT,
  EARNABLE_BADGES,
  EARNED_COSMETIC_IDS,
  REAL_MONEY_CATALOG,
  canonicalCosmeticId,
  collectionForCosmeticLoadout,
  cosmeticAnalyticsPayload,
  cosmeticBodyClasses,
  cosmeticById,
  cosmeticCollectionRankUnlockSatisfied,
  cosmeticClasses,
  cosmeticOptions,
  cosmeticOwnershipSnapshot,
  cosmeticTrailStyle,
  earnedBadges,
  economyIntegrityPolicy,
  equipCosmeticCollection,
  isCosmeticOwned,
  legacyThemeForCosmeticLoadout,
  migrateCosmeticLoadout,
  progressionAuraClass,
  resolveCosmeticAssetUrl,
  resolveCosmeticCollectionLoadout,
  sanitizeCosmeticLoadout,
  transformFeedbackAudio
} from "../public/cosmetic-economy.mjs";

const celestial = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "celestial-atlas");
const aurora = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "aurora-archive");
const solar = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "solar-foundry");
const lunar = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "lunar-garden");
const eclipse = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "eclipse-sovereign");
const pixel = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "pixel-frontier");
const bubble = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "bubble-reef");
const vanguard = COSMETIC_COLLECTIONS.find((entry) => entry.slug === "stellar-vanguard");
const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));

test("canonical manifest has stable namespaces, complete collections, and one valid item per preset slot", () => {
  assert.equal(COSMETIC_SCHEMA_VERSION, 10);
  assert.deepEqual(COSMETIC_SLOTS, [
    "wordPlaque", "trailSet", "boardFinish", "homeScene", "gateStyle", "uiFinish", "soundTheme"
  ]);
  assert.equal(COSMETIC_COLLECTIONS.length, 8);
  assert.equal(COSMETIC_CATALOG.length, 59);
  assert.ok(celestial && aurora && solar && lunar && eclipse && pixel && bubble && vanguard);
  assert.equal(new Set(COSMETIC_CATALOG.map((entry) => entry.id)).size, COSMETIC_CATALOG.length);
  assert.equal(new Set(COSMETIC_COLLECTIONS.map((entry) => entry.id)).size, COSMETIC_COLLECTIONS.length);

  for (const entry of [...COSMETIC_COLLECTIONS, ...COSMETIC_CATALOG]) {
    assert.match(entry.id, /^constellore\.[a-z0-9.-]+$/);
    assert.ok(Array.isArray(entry.tags) && entry.tags.length >= 2);
    assert.ok(entry.preview?.title && entry.preview?.body);
  }
  for (const collection of COSMETIC_COLLECTIONS) {
    assert.deepEqual(Object.keys(collection.preset), COSMETIC_SLOTS);
    for (const slot of COSMETIC_SLOTS) {
      const entry = cosmeticById(collection.preset[slot], slot);
      assert.ok(entry, `${collection.slug} must provide ${slot}`);
      assert.equal(entry.collectionId, collection.id);
      assert.equal(entry.access, collection.access);
    }
    for (const slot of ["homeScene", "gateStyle"]) {
      assert.deepEqual(Object.keys(cosmeticById(collection.preset[slot], slot).assets?.responsive || {}), ["sm", "md", "lg"]);
    }
  }
  assert.deepEqual(COSMETIC_COLLECTIONS.map(({
    slug,
    order,
    tier,
    presentation,
    access,
    entitlement,
    creditPrice
  }) => ({ slug, order, tier, presentation, access, entitlement, creditPrice })), [
    {
      slug: "celestial-atlas",
      order: 1,
      tier: "Included",
      presentation: "foundation",
      access: "free",
      entitlement: "free",
      creditPrice: 0
    },
    {
      slug: "aurora-archive",
      order: 2,
      tier: "Signature",
      presentation: "accent",
      access: "supporter",
      entitlement: "supporter",
      creditPrice: 450
    },
    {
      slug: "solar-foundry",
      order: 3,
      tier: "Crafted",
      presentation: "accent",
      access: "supporter",
      entitlement: "supporter",
      creditPrice: 800
    },
    {
      slug: "lunar-garden",
      order: 4,
      tier: "Deluxe",
      presentation: "accent",
      access: "supporter",
      entitlement: "supporter",
      creditPrice: 1200
    },
    {
      slug: "eclipse-sovereign",
      order: 5,
      tier: "Sovereign",
      presentation: "full-shell",
      access: "supporter",
      entitlement: "supporter",
      creditPrice: 2400
    },
    {
      slug: "pixel-frontier",
      order: 6,
      tier: "Arcade",
      presentation: "accent",
      access: "supporter",
      entitlement: "supporter",
      creditPrice: 700
    },
    {
      slug: "bubble-reef",
      order: 7,
      tier: "Playful",
      presentation: "accent",
      access: "supporter",
      entitlement: "supporter",
      creditPrice: 950
    },
    {
      slug: "stellar-vanguard",
      order: 8,
      tier: "Epic",
      presentation: "accent",
      access: "supporter",
      entitlement: "supporter",
      creditPrice: 1600
    }
  ]);
  assert.equal(eclipse.presentation, "full-shell");
  assert.equal(COSMETIC_COLLECTIONS.filter((entry) => entry.presentation === "full-shell").length, 1);
  assert.deepEqual(DEFAULT_COSMETIC_LOADOUT, celestial.preset);
  assert.deepEqual(EARNED_COSMETIC_IDS, [
    "constellore.earned.cartographer.word-plaque",
    "constellore.earned.first-light.trail-set",
    "constellore.earned.weekly-sigil.gate-style"
  ]);
  assert.ok(COSMETIC_CATALOG.every((entry) => COSMETIC_SLOTS.includes(entry.slot)));
});

test("Lunar Garden and Eclipse Sovereign use the contracted seven-piece IDs and media paths", () => {
  assert.deepEqual(lunar.preset, {
    wordPlaque: "constellore.lunar-garden.word-plaque.moonstone-bloom",
    trailSet: "constellore.lunar-garden.trail-set.moonpetal-trace",
    boardFinish: "constellore.lunar-garden.board-finish.night-garden",
    homeScene: "constellore.lunar-garden.home-scene.lunar-garden",
    gateStyle: "constellore.lunar-garden.gate-style.moon-garden",
    uiFinish: "constellore.lunar-garden.ui-finish.lunar-silver",
    soundTheme: "constellore.lunar-garden.sound-theme.moon-bells"
  });
  assert.deepEqual(eclipse.preset, {
    wordPlaque: "constellore.eclipse-sovereign.word-plaque.sovereign-obsidian",
    trailSet: "constellore.eclipse-sovereign.trail-set.corona-rift",
    boardFinish: "constellore.eclipse-sovereign.board-finish.eclipse-court",
    homeScene: "constellore.eclipse-sovereign.home-scene.eclipse-throne",
    gateStyle: "constellore.eclipse-sovereign.gate-style.sovereign-eclipse",
    uiFinish: "constellore.eclipse-sovereign.ui-finish.sovereign-frame",
    soundTheme: "constellore.eclipse-sovereign.sound-theme.eclipse-choir"
  });

  assert.deepEqual(cosmeticById(lunar.preset.soundTheme).assets, {
    soundtrack: {
      path: "audio/lunar-garden/midnight-bloom.mp3",
      title: "Midnight Bloom",
      duration: 64,
      gain: 0.42,
      previewAt: 17.6
    },
    gameplayPulse: { path: "audio/lunar-garden/gameplay-pulse.mp3", duration: 64, gain: 0.32 },
    sfxBank: { path: "audio/lunar-garden/sfx-bank.mp3", duration: 33.6 }
  });
  assert.deepEqual(cosmeticById(eclipse.preset.soundTheme).assets, {
    soundtrack: {
      path: "audio/eclipse-sovereign/crown-of-shadow.mp3",
      title: "Crown of Shadow",
      duration: 64,
      gain: 0.4,
      previewAt: 20.8
    },
    gameplayPulse: { path: "audio/eclipse-sovereign/gameplay-pulse.mp3", duration: 64, gain: 0.4 },
    sfxBank: { path: "audio/eclipse-sovereign/sfx-bank.mp3", duration: 33.6 }
  });
});

test("new publish-safe kits use exact seven-piece presets and original audio contracts", () => {
  assert.deepEqual(
    [pixel, bubble, vanguard].map(({
      id,
      slug,
      label,
      eyebrow,
      access,
      entitlement,
      order,
      creditPrice,
      tier,
      presentation,
      tags,
      description,
      preview
    }) => ({
      id,
      slug,
      label,
      eyebrow,
      access,
      entitlement,
      order,
      creditPrice,
      tier,
      presentation,
      tags,
      description,
      preview
    })),
    [
      {
        id: "constellore.collection.pixel-frontier",
        slug: "pixel-frontier",
        label: "Pixel Frontier",
        eyebrow: "Arcade",
        access: "supporter",
        entitlement: "supporter",
        order: 6,
        creditPrice: 700,
        tier: "Arcade",
        presentation: "accent",
        tags: ["Supporter", "Pixel", "Arcade"],
        description: "A crisp 16-bit observatory of cartridge frames, scanline sparks, and original chip-synth constellations.",
        preview: {
          title: "Cross the pixel frontier",
          body: "Every surface becomes a premium retro adventure while words and routes stay sharp."
        }
      },
      {
        id: "constellore.collection.bubble-reef",
        slug: "bubble-reef",
        label: "Bubble Reef",
        eyebrow: "Playful",
        access: "supporter",
        entitlement: "supporter",
        order: 7,
        creditPrice: 950,
        tier: "Playful",
        presentation: "accent",
        tags: ["Supporter", "Undersea", "Playful"],
        description: "An original storybook reef of pearly portals, coral-pop menus, bubble trails, and buoyant musical cues.",
        preview: {
          title: "Dive into Bubble Reef",
          body: "A joyful undersea cartoon world with its own shell architecture and luminous current gate."
        }
      },
      {
        id: "constellore.collection.stellar-vanguard",
        slug: "stellar-vanguard",
        label: "Stellar Vanguard",
        eyebrow: "Epic",
        access: "supporter",
        entitlement: "supporter",
        order: 8,
        creditPrice: 1600,
        tier: "Epic",
        presentation: "accent",
        tags: ["Supporter", "Space Opera", "Epic"],
        description: "An original cinematic command sanctuary of vanguard alloy, ion crescents, and a solemn void overture.",
        preview: {
          title: "Stand at the silent meridian",
          body: "Grand space-opera scale, restrained command chrome, and an entirely original ceremonial sound."
        }
      }
    ]
  );

  assert.deepEqual(pixel.preset, {
    wordPlaque: "constellore.pixel-frontier.word-plaque.cartridge-frame",
    trailSet: "constellore.pixel-frontier.trail-set.scanline-spark",
    boardFinish: "constellore.pixel-frontier.board-finish.pixel-cosmos",
    homeScene: "constellore.pixel-frontier.home-scene.bit-observatory",
    gateStyle: "constellore.pixel-frontier.gate-style.warp-gate",
    uiFinish: "constellore.pixel-frontier.ui-finish.arcade-console",
    soundTheme: "constellore.pixel-frontier.sound-theme.pixel-pulse"
  });
  assert.deepEqual(bubble.preset, {
    wordPlaque: "constellore.bubble-reef.word-plaque.bubble-glass",
    trailSet: "constellore.bubble-reef.trail-set.bubble-stream",
    boardFinish: "constellore.bubble-reef.board-finish.coral-storybook",
    homeScene: "constellore.bubble-reef.home-scene.reef-observatory",
    gateStyle: "constellore.bubble-reef.gate-style.pearl-current",
    uiFinish: "constellore.bubble-reef.ui-finish.coral-pop",
    soundTheme: "constellore.bubble-reef.sound-theme.bubble-beat"
  });
  assert.deepEqual(vanguard.preset, {
    wordPlaque: "constellore.stellar-vanguard.word-plaque.vanguard-alloy",
    trailSet: "constellore.stellar-vanguard.trail-set.ion-crescent",
    boardFinish: "constellore.stellar-vanguard.board-finish.command-deck",
    homeScene: "constellore.stellar-vanguard.home-scene.orbital-sanctuary",
    gateStyle: "constellore.stellar-vanguard.gate-style.meridian-gate",
    uiFinish: "constellore.stellar-vanguard.ui-finish.command-alloy",
    soundTheme: "constellore.stellar-vanguard.sound-theme.void-overture"
  });

  assert.deepEqual(cosmeticById(pixel.preset.soundTheme).assets, {
    soundtrack: {
      path: "audio/pixel-frontier/bitstream-constellations.mp3",
      title: "Bitstream Constellations",
      duration: 64,
      gain: 0.4,
      previewAt: 16
    },
    gameplayPulse: { path: "audio/pixel-frontier/gameplay-pulse.mp3", duration: 64, gain: 0.4 },
    sfxBank: { path: "audio/pixel-frontier/sfx-bank.mp3", duration: 33.6 }
  });
  assert.deepEqual(cosmeticById(bubble.preset.soundTheme).assets, {
    soundtrack: {
      path: "audio/bubble-reef/bubbles-beyond-the-blue.mp3",
      title: "Bubbles Beyond the Blue",
      duration: 64,
      gain: 0.4,
      previewAt: 19.2
    },
    gameplayPulse: { path: "audio/bubble-reef/gameplay-pulse.mp3", duration: 64, gain: 0.36 },
    sfxBank: { path: "audio/bubble-reef/sfx-bank.mp3", duration: 33.6 }
  });
  assert.deepEqual(cosmeticById(vanguard.preset.soundTheme).assets, {
    soundtrack: {
      path: "audio/stellar-vanguard/beyond-the-silent-meridian.mp3",
      title: "Beyond the Silent Meridian",
      duration: 64,
      gain: 0.38,
      previewAt: 20.8
    },
    gameplayPulse: { path: "audio/stellar-vanguard/gameplay-pulse.mp3", duration: 64, gain: 0.38 },
    sfxBank: { path: "audio/stellar-vanguard/sfx-bank.mp3", duration: 33.6 }
  });
});

test("every responsive scene asset in the canonical manifest exists in public output", () => {
  const sceneItems = COSMETIC_CATALOG.filter((entry) => entry.assets?.responsive);
  assert.equal(sceneItems.length, 16);
  for (const entry of sceneItems) {
    assert.deepEqual(Object.keys(entry.assets.responsive), ["sm", "md", "lg"]);
    for (const [size, assetPath] of Object.entries(entry.assets.responsive)) {
      assert.match(assetPath, /^\/art\/.+\.webp$/);
      assert.equal(
        existsSync(fileURLToPath(new URL(`.${assetPath}`, new URL("../public/", import.meta.url)))),
        true,
        `${entry.id} ${size} asset must exist`
      );
    }
  }
  assert.ok(existsSync(publicRoot));
  assert.equal(
    resolveCosmeticAssetUrl("/art/cosmetics/aurora-archive/home-md.webp", "https://example.test/constellore/play/cosmetic-economy.mjs"),
    "https://example.test/constellore/play/art/cosmetics/aurora-archive/home-md.webp"
  );
  assert.equal(resolveCosmeticAssetUrl("https://evil.test/tracker.png"), "");
});

test("schema 7 and transitional loadouts migrate deterministically to seven canonical slots", () => {
  assert.deepEqual(
    migrateCosmeticLoadout({ theme: "aurora", board: "nebula", trail: "prism", sound: "glass" }),
    aurora.preset
  );
  assert.deepEqual(
    migrateCosmeticLoadout({ theme: "solar", board: "nebula", trail: "prism", sound: "glass" }),
    {
      ...solar.preset,
      boardFinish: aurora.preset.boardFinish,
      trailSet: aurora.preset.trailSet,
      soundTheme: aurora.preset.soundTheme
    }
  );
  assert.deepEqual(migrateCosmeticLoadout({ version: 7, loadout: { theme: "void" } }), celestial.preset);
  assert.equal(canonicalCosmeticId("blueprint", "board"), solar.preset.boardFinish);
  assert.equal(canonicalCosmeticId("cosmic", "soundTheme"), celestial.preset.soundTheme);
  assert.equal(legacyThemeForCosmeticLoadout(aurora.preset), "aurora");
  assert.equal(legacyThemeForCosmeticLoadout({ ...aurora.preset, wordPlaque: "constellore.earned.cartographer.word-plaque" }), "aurora");
});

test("sanitization enforces free, supporter, collection, item, and earned ownership", () => {
  assert.deepEqual(sanitizeCosmeticLoadout(aurora.preset), celestial.preset);
  assert.deepEqual(sanitizeCosmeticLoadout(aurora.preset, { founder: true }), aurora.preset);
  assert.deepEqual(sanitizeCosmeticLoadout(solar.preset, { supporter: true }), solar.preset);
  assert.deepEqual(
    sanitizeCosmeticLoadout(aurora.preset, { collectionIds: [aurora.id] }),
    aurora.preset
  );

  const frostglass = aurora.preset.wordPlaque;
  const explicitItem = sanitizeCosmeticLoadout(
    { ...celestial.preset, wordPlaque: frostglass },
    { itemIds: [frostglass] }
  );
  assert.equal(explicitItem.wordPlaque, frostglass);
  assert.equal(explicitItem.boardFinish, celestial.preset.boardFinish);

  const cartographer = "constellore.earned.cartographer.word-plaque";
  const firstLight = "constellore.earned.first-light.trail-set";
  const weeklySigil = "constellore.earned.weekly-sigil.gate-style";
  assert.equal(isCosmeticOwned(cartographer, { progress: { discoveries: 24 } }), false);
  assert.equal(isCosmeticOwned(cartographer, { progress: { discoveries: 25 } }), true);
  assert.equal(isCosmeticOwned(firstLight, { progress: { wins: 1 } }), true);
  assert.equal(isCosmeticOwned(weeklySigil, { progress: { weeklyComplete: true } }), true);

  const snapshot = cosmeticOwnershipSnapshot({
    supporter: true,
    progress: { discoveries: 25, wins: 1, weeklyComplete: true }
  });
  assert.equal(snapshot.collections.length, 8);
  assert.ok(EARNED_COSMETIC_IDS.every((id) => snapshot.earned.includes(id)));
  assert.ok(cosmeticOptions("board", { founder: true }).every((entry) => entry.owned));
  assert.equal(cosmeticOptions("board").filter((entry) => entry.owned).length, 1);
});

test("Route Rank unlocks standard collections at ranks 2, 3, 5, and 8 while special kits remain purchase-only", () => {
  const rankProgress = (id, number) => ({
    progress: { routeRank: { id, number } }
  });
  const policies = [
    { collection: aurora, below: ["bronze", 1], at: ["silver", 2] },
    { collection: solar, below: ["silver", 2], at: ["gold", 3] },
    { collection: lunar, below: ["diamond", 4], at: ["emerald", 5] },
    { collection: eclipse, below: ["ruby", 7], at: ["master", 8] }
  ];

  for (const { collection, below, at } of policies) {
    const before = rankProgress(...below);
    const reached = rankProgress(...at);

    assert.equal(collection.acquisition, "purchase-or-rank");
    assert.equal(collection.purchaseOnly, false);
    assert.ok(collection.creditPrice > 0);
    assert.equal(collection.rankUnlock?.id, at[0]);
    assert.equal(collection.rankUnlock?.number, at[1]);
    assert.equal(cosmeticCollectionRankUnlockSatisfied(collection, before.progress), false);
    assert.equal(cosmeticCollectionRankUnlockSatisfied(collection, reached.progress), true);
    assert.equal(
      Object.values(collection.preset).some((itemId) => isCosmeticOwned(itemId, before)),
      false,
      `${collection.label} must remain locked immediately below ${at[0]}`
    );
    assert.ok(
      Object.values(collection.preset).every((itemId) => isCosmeticOwned(itemId, reached)),
      `${collection.label} must unlock completely at ${at[0]}`
    );
    assert.deepEqual(sanitizeCosmeticLoadout(collection.preset, before), celestial.preset);
    assert.deepEqual(sanitizeCosmeticLoadout(collection.preset, reached), collection.preset);
    assert.equal(cosmeticOwnershipSnapshot(before).collections.includes(collection.id), false);
    assert.equal(cosmeticOwnershipSnapshot(reached).collections.includes(collection.id), true);
  }

  const masterSnapshot = cosmeticOwnershipSnapshot(rankProgress("master", 8));
  assert.deepEqual(masterSnapshot, {
    schemaVersion: COSMETIC_SCHEMA_VERSION,
    supporter: false,
    collections: [celestial.id, aurora.id, solar.id, lunar.id, eclipse.id],
    items: [
      ...Object.values(celestial.preset),
      ...Object.values(aurora.preset),
      ...Object.values(solar.preset),
      ...Object.values(lunar.preset),
      ...Object.values(eclipse.preset)
    ],
    earned: []
  });

  const purchaseOnly = [pixel, bubble, vanguard];
  const cosmicProgress = rankProgress("cosmic", 12);
  const cosmicSnapshot = cosmeticOwnershipSnapshot(cosmicProgress);
  assert.deepEqual(cosmicSnapshot, masterSnapshot);
  for (const collection of purchaseOnly) {
    assert.equal(collection.acquisition, "purchase-only");
    assert.equal(collection.purchaseOnly, true);
    assert.ok(collection.creditPrice > 0);
    assert.equal(collection.rankUnlock, null);
    assert.equal(cosmeticCollectionRankUnlockSatisfied(collection, cosmicProgress.progress), false);
    assert.equal(cosmicSnapshot.collections.includes(collection.id), false);
    assert.ok(Object.values(collection.preset).every((itemId) => !cosmicSnapshot.items.includes(itemId)));
    assert.ok(Object.values(collection.preset).every((itemId) => !isCosmeticOwned(itemId, cosmicProgress)));
    assert.ok(Object.values(collection.preset).every((itemId) => isCosmeticOwned(itemId, {
      ...cosmicProgress,
      collectionIds: [collection.id]
    })));
  }
});

test("owning every individual kit piece rolls up to collection ownership without partial-set false positives", () => {
  const completeAuroraSet = Object.values(aurora.preset);
  const complete = cosmeticOwnershipSnapshot({ itemIds: completeAuroraSet });
  const partial = cosmeticOwnershipSnapshot({ itemIds: completeAuroraSet.slice(0, -1) });

  assert.ok(complete.collections.includes(aurora.id));
  assert.equal(partial.collections.includes(aurora.id), false);
  assert.equal(complete.collections.includes(solar.id), false);
});

test("collection helpers equip complete presets, recognize custom mixes, and emit safe renderer classes", () => {
  assert.deepEqual(resolveCosmeticCollectionLoadout(aurora.id), aurora.preset);
  assert.deepEqual(equipCosmeticCollection({}, aurora.id, { supporter: true }), aurora.preset);
  assert.equal(collectionForCosmeticLoadout(aurora.preset)?.id, aurora.id);
  assert.equal(collectionForCosmeticLoadout({ ...aurora.preset, trailSet: solar.preset.trailSet }), null);

  assert.deepEqual(cosmeticBodyClasses(celestial.preset), [
    "cosmetic-collection--celestial-atlas",
    "cosmetic-word-plaque--woven-atlas",
    "cosmetic-trail-set--classic-thread",
    "cosmetic-board-finish--rank-sky",
    "cosmetic-home-scene--constellore-cosmos",
    "cosmetic-gate-style--constellore",
    "cosmetic-ui-finish--woven-atlas",
    "cosmetic-sound-theme--cosmic-chimes"
  ]);
  assert.ok(cosmeticClasses(celestial.preset).includes("theme-void"), "legacy style hooks stay available");
  assert.equal(new Set(ALL_COSMETIC_BODY_CLASSES).size, ALL_COSMETIC_BODY_CLASSES.length);
  assert.deepEqual(cosmeticAnalyticsPayload(aurora.preset), {
    cosmeticSchema: "10",
    collection: "aurora-archive",
    wordPlaque: "frostglass",
    trailSet: "aurora-ribbon",
    boardFinish: "nebula-glass",
    homeScene: "aurora-observatory",
    gateStyle: "crystal-archive",
    uiFinish: "frostglass",
    soundTheme: "glass-orbit"
  });
  assert.deepEqual(
    [pixel, bubble, vanguard].map((entry) => cosmeticAnalyticsPayload(entry.preset)),
    [
      {
        cosmeticSchema: "10",
        collection: "pixel-frontier",
        wordPlaque: "cartridge-frame",
        trailSet: "scanline-spark",
        boardFinish: "pixel-cosmos",
        homeScene: "bit-observatory",
        gateStyle: "warp-gate",
        uiFinish: "arcade-console",
        soundTheme: "pixel-pulse"
      },
      {
        cosmeticSchema: "10",
        collection: "bubble-reef",
        wordPlaque: "bubble-glass",
        trailSet: "bubble-stream",
        boardFinish: "coral-storybook",
        homeScene: "reef-observatory",
        gateStyle: "pearl-current",
        uiFinish: "coral-pop",
        soundTheme: "bubble-beat"
      },
      {
        cosmeticSchema: "10",
        collection: "stellar-vanguard",
        wordPlaque: "vanguard-alloy",
        trailSet: "ion-crescent",
        boardFinish: "command-deck",
        homeScene: "orbital-sanctuary",
        gateStyle: "meridian-gate",
        uiFinish: "command-alloy",
        soundTheme: "void-overture"
      }
    ]
  );
});

test("trail and sound recipes accept canonical IDs and legacy aliases without mutating feedback", () => {
  const trail = cosmeticTrailStyle("prism");
  assert.equal(trail.id, aurora.preset.trailSet);
  assert.equal(trail.color, "#70f7e5");
  assert.equal(trail.burst, "crystal");

  const original = { wave: "square", tones: [200, 400], duration: 100, gain: 0.03 };
  const glass = transformFeedbackAudio(original, "glass");
  const analog = transformFeedbackAudio(original, solar.preset.soundTheme);
  assert.deepEqual(original.tones, [200, 400]);
  assert.deepEqual(glass.tones, [270, 540]);
  assert.deepEqual(analog.tones, [164, 328]);
  assert.equal(glass.wave, "sine");
  assert.equal(analog.wave, "triangle");
});

test("real-money products remain creative and never sell competitive power", () => {
  const policy = economyIntegrityPolicy();
  assert.deepEqual(REAL_MONEY_CATALOG.map((entry) => entry.id), ["constellore_founders_pass"]);
  assert.equal(REAL_MONEY_CATALOG[0].label, "Supporter Pack");
  assert.deepEqual(REAL_MONEY_CATALOG[0].grants, ["founder_cosmetics"]);
  assert.deepEqual(
    REAL_MONEY_CATALOG[0].cosmeticCollections,
    [aurora.id, solar.id, lunar.id, eclipse.id, pixel.id, bubble.id, vanguard.id]
  );
  assert.equal(REAL_MONEY_CATALOG[0].competitive, false);
  assert.equal(policy.soldForCash.includes("star_credits"), false);
  assert.ok(policy.forbiddenCashProducts.includes("word_license"));
  assert.ok(policy.forbiddenCashProducts.includes("extra_moves"));
  assert.equal(policy.competitiveWordDivision, "open");
  assert.equal(policy.fluctuatingPricesCurrency, "star_credits");
  assert.equal(policy.personalizedPricing, false);
  assert.equal(policy.randomPaidContents, false);
  assert.equal(policy.cosmeticSchemaVersion, 10);
});

test("play achievements unlock badges and cosmetic-only profile auras", () => {
  const fresh = earnedBadges({});
  const firstOrbitBadge = EARNABLE_BADGES.find((badge) => badge.id === "first-orbit");
  assert.equal(fresh.length, EARNABLE_BADGES.length);
  assert.ok(fresh.every((badge) => badge.earned === false));
  assert.equal(firstOrbitBadge?.label, "First Orbit");
  assert.notEqual(firstOrbitBadge?.label, cosmeticById("constellore.earned.first-light.trail-set")?.label);
  assert.equal(progressionAuraClass({}), "aura-none");

  const established = {
    firstOrbit: { completed: true },
    wins: 4,
    discoveries: 120,
    masteryStars: 30,
    dailyStreak: 9,
    weekly: { complete: true }
  };
  assert.ok(earnedBadges(established).every((badge) => badge.earned));
  assert.equal(progressionAuraClass(established), "aura-prism");
  assert.equal(COSMETIC_CATALOG.some((entry) => entry.slot === "badge"), false);
});
