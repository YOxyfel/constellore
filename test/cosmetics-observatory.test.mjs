import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  COSMETICS_EFFECT_MODES,
  COSMETICS_OBSERVATORY_TABS,
  buildObservatoryModel,
  calculatePieceLoadout,
  calculatePiecePreviewLoadout,
  createCosmeticsObservatory,
  deriveCollectionLoadout,
  filterObservatoryCollections,
  filterObservatoryItems,
  loadoutsEqual,
  observatoryCollectionValue,
  observatoryEffectModeForKey,
  observatoryLoadoutIsOwned,
  observatoryPreviewAssetUrl,
  observatoryPreviewSurface,
  observatoryPurchaseStep,
  observatorySelectionState
} from "../public/cosmetics-observatory.mjs";

const SLOT_ORDER = ["wordPlaque", "trailSet", "boardFinish", "homeScene", "gateStyle", "uiFinish", "soundTheme"];

const ITEMS = [
  { id: "atlas.word", slot: "wordPlaque", label: "Woven Atlas", collectionId: "atlas", badge: "free" },
  { id: "atlas.trail", slot: "trailSet", label: "Classic Thread", collectionId: "atlas", entitlement: "free" },
  { id: "aurora.word", slot: "wordPlaque", label: "Frostglass", collectionId: "aurora", badge: "Supporter" },
  { id: "aurora.trail", slot: "trailSet", label: "Aurora Ribbon", collectionId: "aurora", badge: "Supporter" },
  { id: "earned.trail", slot: "trailSet", label: "First Light", badge: "earned", unlockHint: "Win one route." }
];

const COLLECTIONS = [
  {
    id: "atlas",
    label: "Celestial Atlas",
    badge: "Free",
    order: 1,
    tier: "Included",
    presentation: "foundation",
    creditPrice: 0
  },
  {
    id: "aurora",
    label: "Aurora Archive",
    badge: "Supporter",
    itemIds: ["aurora.word", "aurora.trail"],
    order: 2,
    tier: "Signature",
    presentation: "accent",
    creditPrice: 450
  }
];

test("observatory model normalizes manifest vocabulary and authoritative ownership", () => {
  const model = buildObservatoryModel({
    collections: COLLECTIONS,
    items: ITEMS,
    slotOrder: SLOT_ORDER,
    loadout: { wordPlaque: "atlas.word", trailSet: "atlas.trail", ignored: "nope" },
    owned: (item) => item.badge === "Free" || item.id === "earned.trail"
  });

  assert.deepEqual(model.slots, SLOT_ORDER);
  assert.deepEqual(model.loadout, { wordPlaque: "atlas.word", trailSet: "atlas.trail" });
  assert.equal(model.items.find((item) => item.id === "atlas.word").badge, "Free");
  assert.equal(model.items.find((item) => item.id === "earned.trail").badge, "Earned");
  assert.equal(model.items.find((item) => item.id === "earned.trail").owned, true);
  assert.equal(model.items.find((item) => item.id === "aurora.word").owned, false);
  assert.equal(model.collections.find((collection) => collection.id === "atlas").owned, true);
  assert.equal(model.collections.find((collection) => collection.id === "aurora").owned, false);
  assert.equal(model.slotLabels.wordPlaque, "Word plaques");
});

test("Observatory labels rank rewards and purchase-only collections without hiding either purchase path", () => {
  const model = buildObservatoryModel({
    collections: [
      {
        id: "aurora",
        label: "Aurora Archive",
        access: "supporter",
        acquisition: "purchase-or-rank",
        rankUnlock: { id: "silver", name: "Silver", number: 2 },
        unlockHint: "Reach Silver Route Rank to unlock free, or buy now for 450 Star Credits.",
        creditPrice: 450,
        itemIds: ["aurora.word"]
      },
      {
        id: "pixel",
        label: "Pixel Frontier",
        access: "supporter",
        acquisition: "purchase-only",
        purchaseOnly: true,
        unlockHint: "Purchase only. Route Rank does not unlock this collection.",
        creditPrice: 700,
        itemIds: ["pixel.word"]
      }
    ],
    items: [
      {
        id: "aurora.word",
        slot: "wordPlaque",
        collectionId: "aurora",
        access: "supporter",
        acquisition: "purchase-or-rank",
        unlockHint: "Reach Silver Route Rank to unlock free, or buy now for 450 Star Credits."
      },
      {
        id: "pixel.word",
        slot: "wordPlaque",
        collectionId: "pixel",
        access: "supporter",
        acquisition: "purchase-only",
        unlockHint: "Purchase only. Route Rank does not unlock this collection."
      }
    ],
    slotOrder: SLOT_ORDER,
    loadout: {},
    owned: () => false
  });

  const rankReward = model.collections.find((collection) => collection.id === "aurora");
  const purchaseOnly = model.collections.find((collection) => collection.id === "pixel");
  assert.equal(rankReward.badge, "Rank reward");
  assert.equal(rankReward.acquisition, "purchase-or-rank");
  assert.equal(rankReward.rankUnlock.id, "silver");
  assert.match(rankReward.unlockHint, /Reach Silver Route Rank to unlock free/);
  assert.equal(purchaseOnly.badge, "Purchase only");
  assert.equal(purchaseOnly.acquisition, "purchase-only");
  assert.match(purchaseOnly.unlockHint, /Route Rank does not unlock/);
  assert.equal(model.items.find((item) => item.id === "aurora.word").badge, "Rank reward");
  assert.equal(model.items.find((item) => item.id === "pixel.word").badge, "Purchase only");
});

test("collection presentation metadata stays ordered, safe, and honestly valued", () => {
  const model = buildObservatoryModel({
    collections: [
      {
        id: "constellore.collection.eclipse-sovereign",
        label: "Eclipse Sovereign",
        badge: "Supporter",
        order: 5,
        tier: "Sovereign",
        presentation: "full-shell",
        creditPrice: 2400
      },
      {
        id: "constellore.collection.lunar-garden",
        label: "Lunar Garden",
        badge: "Supporter",
        order: 4,
        tier: "Deluxe",
        presentation: "accent",
        creditPrice: 1200
      },
      {
        id: "constellore.collection.pixel-frontier",
        label: "Pixel Frontier",
        badge: "Supporter",
        order: 6,
        tier: "Arcade",
        presentation: "accent",
        creditPrice: 700
      },
      {
        id: "constellore.collection.bubble-reef",
        label: "Bubble Reef",
        badge: "Supporter",
        order: 7,
        tier: "Playful",
        presentation: "accent",
        creditPrice: 950
      },
      {
        id: "constellore.collection.stellar-vanguard",
        label: "Stellar Vanguard",
        badge: "Supporter",
        order: 8,
        tier: "Epic",
        presentation: "accent",
        creditPrice: 1600
      },
      {
        id: "constellore.collection.celestial-atlas",
        label: "Celestial Atlas",
        badge: "Free",
        order: 1,
        tier: "Included",
        presentation: "foundation",
        creditPrice: 0
      }
    ],
    items: [
      {
        id: "constellore.lunar-garden.word-plaque.moonstone-bloom",
        slot: "wordPlaque",
        collectionId: "constellore.collection.lunar-garden"
      },
      {
        id: "constellore.eclipse-sovereign.word-plaque.sovereign-obsidian",
        slot: "wordPlaque",
        collectionId: "constellore.collection.eclipse-sovereign"
      },
      {
        id: "constellore.pixel-frontier.word-plaque.cartridge-frame",
        slot: "wordPlaque",
        collectionId: "constellore.collection.pixel-frontier"
      },
      {
        id: "constellore.bubble-reef.word-plaque.bubble-glass",
        slot: "wordPlaque",
        collectionId: "constellore.collection.bubble-reef"
      },
      {
        id: "constellore.stellar-vanguard.word-plaque.vanguard-alloy",
        slot: "wordPlaque",
        collectionId: "constellore.collection.stellar-vanguard"
      }
    ]
  });

  assert.deepEqual(model.collections.map((collection) => ({
    id: collection.id,
    order: collection.order,
    tier: collection.tier,
    presentation: collection.presentation,
    creditPrice: collection.creditPrice
  })), [
    {
      id: "constellore.collection.celestial-atlas",
      order: 1,
      tier: "Included",
      presentation: "foundation",
      creditPrice: 0
    },
    {
      id: "constellore.collection.lunar-garden",
      order: 4,
      tier: "Deluxe",
      presentation: "accent",
      creditPrice: 1200
    },
    {
      id: "constellore.collection.eclipse-sovereign",
      order: 5,
      tier: "Sovereign",
      presentation: "full-shell",
      creditPrice: 2400
    },
    {
      id: "constellore.collection.pixel-frontier",
      order: 6,
      tier: "Arcade",
      presentation: "accent",
      creditPrice: 700
    },
    {
      id: "constellore.collection.bubble-reef",
      order: 7,
      tier: "Playful",
      presentation: "accent",
      creditPrice: 950
    },
    {
      id: "constellore.collection.stellar-vanguard",
      order: 8,
      tier: "Epic",
      presentation: "accent",
      creditPrice: 1600
    }
  ]);
  assert.equal(model.items.find((item) => item.id.includes("lunar-garden")).tone, "lunar");
  assert.equal(model.items.find((item) => item.id.includes("eclipse-sovereign")).tone, "eclipse");
  assert.equal(model.items.find((item) => item.id.includes("pixel-frontier")).tone, "pixel");
  assert.equal(model.items.find((item) => item.id.includes("bubble-reef")).tone, "reef");
  assert.equal(model.items.find((item) => item.id.includes("stellar-vanguard")).tone, "vanguard");
  assert.equal(observatoryCollectionValue({ creditPrice: 0 }), "Included");
  assert.equal(observatoryCollectionValue({ creditPrice: 450 }), "450 C");
  assert.equal(observatoryCollectionValue({ creditPrice: 1200 }), "1,200 C");
  assert.equal(observatoryCollectionValue({ creditPrice: 2400 }), "2,400 C");
});

test("purchase confirmation arms one collection and confirms only a matching second activation", () => {
  assert.deepEqual(observatoryPurchaseStep("", "lunar"), {
    action: "arm",
    armedCollectionId: "lunar"
  });
  assert.deepEqual(observatoryPurchaseStep("lunar", "eclipse"), {
    action: "arm",
    armedCollectionId: "eclipse"
  });
  assert.deepEqual(observatoryPurchaseStep("eclipse", "eclipse"), {
    action: "confirm",
    armedCollectionId: ""
  });
  assert.deepEqual(observatoryPurchaseStep("eclipse", ""), {
    action: "idle",
    armedCollectionId: ""
  });
});

test("collection loadouts support explicit maps, item IDs, and collection membership", () => {
  const derived = deriveCollectionLoadout(
    { id: "aurora", loadout: { uiFinish: "aurora.ui" }, itemIds: ["aurora.word"] },
    [...ITEMS, { id: "aurora.ui", slot: "uiFinish", collectionId: "aurora" }],
    SLOT_ORDER,
    { boardFinish: "atlas.board" }
  );

  assert.deepEqual(derived, {
    uiFinish: "aurora.ui",
    wordPlaque: "aurora.word",
    trailSet: "aurora.trail",
    boardFinish: "atlas.board"
  });
});

test("piece calculations preserve every unrelated presentation slot", () => {
  const current = {
    wordPlaque: "atlas.word",
    trailSet: "atlas.trail",
    boardFinish: "atlas.board",
    soundTheme: "atlas.sound"
  };
  const next = calculatePieceLoadout(current, { id: "aurora.trail", slot: "trailSet" });
  assert.deepEqual(next, { ...current, trailSet: "aurora.trail" });
  assert.equal(loadoutsEqual(current, next, SLOT_ORDER), false);
  assert.equal(loadoutsEqual(next, { ...next, unrelated: "" }, SLOT_ORDER), true);
});

test("piece previews always branch from the equipped loadout instead of accumulating", () => {
  const base = {
    wordPlaque: "atlas.word",
    trailSet: "atlas.trail"
  };
  const firstPreview = calculatePiecePreviewLoadout(base, {
    id: "aurora.word",
    slot: "wordPlaque"
  });
  const secondPreview = calculatePiecePreviewLoadout(base, {
    id: "aurora.trail",
    slot: "trailSet"
  });

  assert.deepEqual(firstPreview, {
    wordPlaque: "aurora.word",
    trailSet: "atlas.trail"
  });
  assert.deepEqual(secondPreview, {
    wordPlaque: "atlas.word",
    trailSet: "aurora.trail"
  });
});

test("collections, pieces, and owned views filter without hiding locked previews", () => {
  const model = buildObservatoryModel({
    collections: COLLECTIONS,
    items: ITEMS,
    slotOrder: SLOT_ORDER,
    owned: (item) => item.badge === "Free"
  });

  assert.equal(filterObservatoryCollections(model, { tab: "collections" }).length, 2);
  assert.deepEqual(filterObservatoryCollections(model, { tab: "owned" }).map((item) => item.id), ["atlas"]);
  assert.equal(filterObservatoryItems(model, { tab: "pieces", slot: "wordPlaque" }).length, 2);
  assert.deepEqual(
    filterObservatoryItems(model, { tab: "owned" }).map((item) => item.id),
    ["atlas.word", "atlas.trail"]
  );
});

test("selection states distinguish equipped, previewed, locked, and equip-ready", () => {
  const current = { wordPlaque: "atlas.word", trailSet: "atlas.trail" };
  const candidate = { wordPlaque: "aurora.word", trailSet: "aurora.trail" };
  assert.deepEqual(observatorySelectionState({
    candidate,
    currentLoadout: current,
    previewLoadout: candidate,
    slotOrder: SLOT_ORDER,
    owned: false
  }), {
    owned: false,
    equipped: false,
    previewed: true,
    canEquip: false
  });
  assert.equal(observatorySelectionState({
    candidate,
    currentLoadout: current,
    previewLoadout: current,
    slotOrder: SLOT_ORDER,
    owned: true
  }).canEquip, true);
});

test("loadout ownership fails closed for locked, unknown, and wrong-slot IDs", () => {
  const model = buildObservatoryModel({
    collections: COLLECTIONS,
    items: ITEMS,
    slotOrder: SLOT_ORDER,
    loadout: { wordPlaque: "atlas.word", trailSet: "atlas.trail" },
    owned: (item) => item.badge === "Free"
  });

  assert.equal(observatoryLoadoutIsOwned(model, {
    wordPlaque: "atlas.word",
    trailSet: "atlas.trail"
  }), true);
  assert.equal(observatoryLoadoutIsOwned(model, {
    wordPlaque: "missing.word",
    trailSet: "atlas.trail"
  }), false);
  assert.equal(observatoryLoadoutIsOwned(model, {
    wordPlaque: "aurora.word",
    trailSet: "atlas.trail"
  }), false);
  assert.equal(observatoryLoadoutIsOwned(model, {
    wordPlaque: "atlas.trail"
  }), false);
  assert.equal(observatoryLoadoutIsOwned(model, {
    wordPlaque: "atlas.word"
  }), false);
  assert.equal(observatoryLoadoutIsOwned(model, {
    wordPlaque: "atlas.word",
    trailSet: "atlas.trail",
    unknownSlot: "atlas.word"
  }), false);
});

test("preview art accepts only local manifest assets and resolves deployment subpaths", () => {
  const moduleUrl = "https://example.test/constellore/play/cosmetics-observatory.mjs";
  assert.equal(
    observatoryPreviewAssetUrl({
      assets: {
        responsive: {
          sm: "/art/cosmetics/aurora-archive/home-sm.webp",
          md: "/art/cosmetics/aurora-archive/home-md.webp"
        }
      }
    }, { size: "sm", moduleUrl }),
    "https://example.test/constellore/play/art/cosmetics/aurora-archive/home-sm.webp"
  );
  assert.equal(
    observatoryPreviewAssetUrl({
      assets: { responsive: { sm: "https://tracker.invalid/pixel.png" } }
    }, { moduleUrl }),
    ""
  );
  assert.equal(
    observatoryPreviewAssetUrl({
      assets: { responsive: { sm: "/art/cosmetics/kit/image.webp?tracking=1" } }
    }, { moduleUrl }),
    ""
  );
});

test("Effects radios expose wrapping arrow, Home, and End navigation", () => {
  assert.equal(observatoryEffectModeForKey("full", "ArrowRight"), "reduced");
  assert.equal(observatoryEffectModeForKey("reduced", "ArrowDown"), "off");
  assert.equal(observatoryEffectModeForKey("off", "ArrowRight"), "full");
  assert.equal(observatoryEffectModeForKey("full", "ArrowLeft"), "off");
  assert.equal(observatoryEffectModeForKey("off", "Home"), "full");
  assert.equal(observatoryEffectModeForKey("full", "End"), "off");
  assert.equal(observatoryEffectModeForKey("reduced", "Enter"), "reduced");
});

test("piece previews open on the surface where the cosmetic is visible", () => {
  assert.equal(observatoryPreviewSurface({ slot: "wordPlaque" }), "board");
  assert.equal(observatoryPreviewSurface({ slot: "trailSet" }), "board");
  assert.equal(observatoryPreviewSurface({ slot: "boardFinish" }), "board");
  assert.equal(observatoryPreviewSurface({ slot: "homeScene" }), "home");
  assert.equal(observatoryPreviewSurface({ slot: "gateStyle" }), "gate");
  assert.equal(observatoryPreviewSurface({ slot: "uiFinish" }), "menu");
  assert.equal(observatoryPreviewSurface({ slot: "soundTheme" }), "sound");
  assert.equal(observatoryPreviewSurface({ type: "collection" }), "board");
});

test("public Observatory contract exposes stable tabs and effects modes", () => {
  assert.deepEqual(COSMETICS_OBSERVATORY_TABS, ["collections", "pieces", "owned"]);
  assert.deepEqual(COSMETICS_EFFECT_MODES, ["full", "reduced", "off"]);
  assert.throws(() => createCosmeticsObservatory(), /browser document/);
});

test("implementation avoids data-to-HTML injection and includes accessibility fallbacks", async () => {
  const moduleSource = await readFile(new URL("../public/cosmetics-observatory.mjs", import.meta.url), "utf8");
  const cssSource = await readFile(new URL("../public/cosmetics-observatory.css", import.meta.url), "utf8");
  assert.doesNotMatch(moduleSource, /\.innerHTML\s*=/);
  assert.match(moduleSource, /aria-live/);
  assert.match(moduleSource, /aria-labelledby/);
  assert.match(moduleSource, /event\.key === "Escape"/);
  assert.match(moduleSource, /previewMode/);
  assert.match(moduleSource, /previewSuspended/);
  assert.match(moduleSource, /settings\.onPresentPreview/);
  assert.match(moduleSource, /function resumePreview\(\)/);
  assert.match(moduleSource, /isPreviewSuspended/);
  assert.match(moduleSource, /Back to cosmetics/);
  assert.match(moduleSource, /gameplay stays locked in preview mode/);
  assert.match(moduleSource, /cosmetics-observatory__preview-surface/);
  assert.match(moduleSource, /dialog\.append\(surface, live\)/);
  assert.doesNotMatch(moduleSource, /surface\.append\([^;]*live\)/s);
  assert.match(moduleSource, /calculatePiecePreviewLoadout\(baseLoadout, item\)/);
  assert.match(moduleSource, /const previewOwned = observatoryLoadoutIsOwned\(model, previewLoadout\)/);
  assert.doesNotMatch(moduleSource, /\bownerForLoadout\b/);
  assert.match(moduleSource, /const committedLoadout = asRecord\(persisted\)/);
  assert.match(moduleSource, /ArrowUp/);
  assert.match(moduleSource, /aria-busy/);
  assert.match(moduleSource, /Main-menu backgrounds/);
  assert.match(moduleSource, /Board backgrounds & finishes/);
  assert.match(moduleSource, /Main-menu background included/);
  assert.match(moduleSource, /Presentation tier/);
  assert.match(moduleSource, /\$\{pieceCount\}-piece kit/);
  assert.match(moduleSource, /Included cosmetic slots/);
  assert.match(moduleSource, /Star Credit value/);
  assert.match(moduleSource, /dataset\.acquisition/);
  assert.match(moduleSource, /dataset\.unlockRank/);
  assert.match(moduleSource, /!collection\.owned && collection\.unlockHint/);
  assert.match(moduleSource, /!item\.owned && item\.unlockHint/);
  assert.match(cssSource, /cosmetics-observatory__badge\.is-rank-reward/);
  assert.match(cssSource, /cosmetics-observatory__badge\.is-purchase-only/);
  assert.match(moduleSource, /dataset\.purchaseControl/);
  assert.match(moduleSource, /dataset\.confirmArmed/);
  assert.match(moduleSource, /Confirm purchase of/);
  assert.match(moduleSource, /Activate Confirm purchase to spend exactly/);
  assert.match(
    moduleSource,
    /if \(confirmation\.action !== "confirm"\) \{[\s\S]*?return;[\s\S]*?\}\s*committing = true;/
  );
  assert.ok(
    moduleSource.indexOf('if (confirmation.action !== "confirm")')
      < moduleSource.indexOf("await settings.onPurchase(collection)"),
    "purchase callback must remain behind the confirmation guard"
  );
  for (const resetSequence of [
    /function preview\([^)]*\) \{[\s\S]*?clearPurchaseConfirmation\(\);/,
    /async function commit\([^)]*\) \{[\s\S]*?clearPurchaseConfirmation\(\);/,
    /function close\([^)]*\) \{[\s\S]*?clearPurchaseConfirmation\(\);/,
    /clearPurchaseConfirmation\(\);\s*activeTab = tab;/,
    /clearPurchaseConfirmation\(\);\s*selectedSlot = slot;/,
    /clearPurchaseConfirmation\(\);\s*selectedSlot = "";/
  ]) {
    assert.match(moduleSource, resetSequence);
  }
  for (const previewKind of [
    "is-word-plaque",
    "is-trail-set",
    "is-board-finish",
    "is-home-scene",
    "is-gate-style",
    "is-ui-finish",
    "is-sound-theme",
    "cosmetics-observatory__scene-split"
  ]) {
    assert.ok(cssSource.includes(previewKind), `missing representative preview ${previewKind}`);
  }
  assert.match(cssSource, /prefers-reduced-motion/);
  assert.match(cssSource, /prefers-reduced-data/);
  assert.match(cssSource, /forced-colors: active/);
  assert.match(cssSource, /prefers-contrast: more/);
  assert.match(cssSource, /\[data-preview-mode="true"\]/);
  assert.match(cssSource, /\.cosmetics-observatory__preview\.is-immersive/);
  assert.match(cssSource, /:is\(\s*\.cosmetics-observatory__preview,[\s\S]*?\)\.is-lunar/);
  assert.match(cssSource, /:is\(\s*\.cosmetics-observatory__preview,[\s\S]*?\)\.is-eclipse/);
  assert.match(cssSource, /:is\(\s*\.cosmetics-observatory__preview,[\s\S]*?\)\.is-pixel/);
  assert.match(cssSource, /:is\(\s*\.cosmetics-observatory__preview,[\s\S]*?\)\.is-reef/);
  assert.match(cssSource, /:is\(\s*\.cosmetics-observatory__preview,[\s\S]*?\)\.is-vanguard/);
  assert.match(cssSource, /\.cosmetics-observatory__collection-facts/);
  assert.match(cssSource, /\.cosmetics-observatory__included-slots/);
  assert.match(cssSource, /\.cosmetics-observatory__card\.is-full-shell/);
});
