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
  groupObservatoryCollectionsByFamily,
  loadoutsEqual,
  observatoryCollectionValue,
  observatoryEffectModeForKey,
  observatoryLoadoutSummary,
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

test("full-page Lab reserves a non-overlapping short-landscape preview and action footer", async () => {
  const [fullPageCss, previewCss] = await Promise.all([
    readFile(new URL("../public/cosmetics-observatory-full-page.css", import.meta.url), "utf8"),
    readFile(new URL("../public/cosmetic-world-preview.css", import.meta.url), "utf8")
  ]);

  assert.match(fullPageCss, /@media \(orientation: landscape\) and \(max-width: 900px\) and \(max-height: 500px\)/);
  assert.match(fullPageCss, /grid-template-rows:\s*54px 50px minmax\(0, 1fr\) 60px/);
  assert.match(fullPageCss, /[.]cosmetics-observatory__footer\s*\{[^}]*position:\s*relative[^}]*min-height:\s*60px[^}]*max-height:\s*60px/s);
  assert.match(fullPageCss, /[.]cosmetics-observatory__category-track\s*\{[^}]*mask-image:\s*linear-gradient/s);
  assert.match(fullPageCss, /[.]cosmetics-observatory__segment-button\s*\{[^}]*min-height:\s*48px/s);
  assert.match(previewCss, /#gameScreen > :not\([.]game-layout\)/);
  assert.match(previewCss, /#gameScreen [.]game-layout > :not\(#board\)/);
  assert.match(previewCss, /[.]cosmetic-world-preview__bar\s*\{[^}]*min-height:\s*56px[^}]*max-height:\s*64px/s);
});

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

test("collection families sort shelves and kits, hide empty future families, and retain unknown collections", () => {
  const model = buildObservatoryModel({
    collectionFamilies: [
      {
        id: "theme worlds",
        label: "Malformed Theme Worlds",
        order: -1
      },
      {
        id: "community-creations",
        label: "Community Creations",
        order: 4,
        future: true
      },
      {
        id: "theme-worlds",
        label: "Theme Worlds",
        kicker: "Genre transformations",
        order: 2
      },
      {
        id: "collaborations",
        label: "Collaborations",
        order: 3,
        future: true
      },
      {
        id: "constellore",
        label: "Constellore Originals",
        kicker: "Core universe",
        order: 1
      }
    ],
    collections: [
      {
        id: "unknown",
        label: "Uncatalogued Kit",
        collectionFamily: "future-unregistered",
        styleLabel: "Uncatalogued style",
        order: 0,
        itemIds: ["unknown.word"]
      },
      {
        id: "pixel",
        label: "Pixel Frontier",
        collectionFamily: "theme-worlds",
        styleLabel: "Retro arcade",
        order: 6,
        itemIds: ["pixel.word"]
      },
      {
        id: "aurora",
        label: "Aurora Archive",
        collectionFamily: "constellore",
        styleLabel: "Prismatic frostglass",
        order: 2,
        itemIds: ["aurora.word"]
      },
      {
        id: "atlas",
        label: "Celestial Atlas",
        collectionFamily: "constellore",
        styleLabel: "Classic celestial",
        order: 1,
        itemIds: ["atlas.word"]
      }
    ],
    items: [
      { id: "unknown.word", slot: "wordPlaque", collectionId: "unknown" },
      { id: "pixel.word", slot: "wordPlaque", collectionId: "pixel" },
      { id: "aurora.word", slot: "wordPlaque", collectionId: "aurora" },
      { id: "atlas.word", slot: "wordPlaque", collectionId: "atlas", access: "free" }
    ],
    slotOrder: ["wordPlaque"],
    owned: (item) => item.id === "atlas.word"
  });

  assert.deepEqual(model.collectionFamilies.map((family) => family.id), [
    "constellore",
    "theme-worlds",
    "collaborations",
    "community-creations",
    "other-collections"
  ]);
  assert.equal(model.collections.find((collection) => collection.id === "unknown").collectionFamily, "other-collections");
  assert.equal(model.collections.find((collection) => collection.id === "unknown").styleLabel, "Uncatalogued style");

  const groups = groupObservatoryCollectionsByFamily(model);
  assert.deepEqual(groups.map((family) => ({
    id: family.id,
    label: family.label,
    collectionIds: family.collections.map((collection) => collection.id)
  })), [
    {
      id: "constellore",
      label: "Constellore Originals",
      collectionIds: ["atlas", "aurora"]
    },
    {
      id: "theme-worlds",
      label: "Theme Worlds",
      collectionIds: ["pixel"]
    },
    {
      id: "other-collections",
      label: "Other Collections",
      collectionIds: ["unknown"]
    }
  ]);
  assert.equal(groups.some((family) => family.id === "collaborations"), false);
  assert.equal(groups.some((family) => family.id === "community-creations"), false);
  assert.equal(groups.find((family) => family.id === "other-collections").label, "Other Collections");
  assert.deepEqual(groupObservatoryCollectionsByFamily({ collections: {} }), []);
  assert.deepEqual(
    groupObservatoryCollectionsByFamily({ collections: [{ id: "b" }, { id: "a" }] })
      .flatMap((family) => family.collections.map((collection) => collection.id)),
    ["a", "b"]
  );

  const ownedGroups = groupObservatoryCollectionsByFamily(
    model,
    filterObservatoryCollections(model, { tab: "owned" })
  );
  assert.deepEqual(ownedGroups.map((family) => ({
    id: family.id,
    collectionIds: family.collections.map((collection) => collection.id)
  })), [
    {
      id: "constellore",
      collectionIds: ["atlas"]
    }
  ]);
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
  assert.equal(observatoryCollectionValue({ creditPrice: 450 }), "450 Star Credits");
  assert.equal(observatoryCollectionValue({ creditPrice: 1200 }), "1,200 Star Credits");
  assert.equal(observatoryCollectionValue({ creditPrice: 2400 }), "2,400 Star Credits");
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

test("loadout summary identifies the equipped collection, staged slots, and owned alternatives", () => {
  const model = buildObservatoryModel({
    collections: COLLECTIONS,
    items: ITEMS,
    slotOrder: ["wordPlaque", "trailSet"],
    loadout: { wordPlaque: "atlas.word", trailSet: "atlas.trail" },
    owned: (item) => item.badge === "Free" || item.id === "earned.trail"
  });
  const summary = observatoryLoadoutSummary(
    model,
    model.loadout,
    { ...model.loadout, trailSet: "earned.trail" }
  );

  assert.equal(summary.label, "Celestial Atlas");
  assert.equal(summary.collectionId, "atlas");
  assert.equal(summary.staged, true);
  assert.deepEqual(summary.slots.map((slot) => ({
    slot: slot.slot,
    itemLabel: slot.itemLabel,
    stagedItemLabel: slot.stagedItemLabel,
    staged: slot.staged,
    ownedOptions: slot.ownedOptions
  })), [
    {
      slot: "wordPlaque",
      itemLabel: "Woven Atlas",
      stagedItemLabel: "Woven Atlas",
      staged: false,
      ownedOptions: 1
    },
    {
      slot: "trailSet",
      itemLabel: "Classic Thread",
      stagedItemLabel: "First Light",
      staged: true,
      ownedOptions: 2
    }
  ]);

  const custom = observatoryLoadoutSummary(model, {
    wordPlaque: "aurora.word",
    trailSet: "atlas.trail"
  });
  assert.equal(custom.label, "Custom mix");
  assert.equal(custom.collectionId, "");
  assert.equal(custom.staged, false);
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

test("profile-frame media is cleaned before replacement and static fallback remains available", async () => {
  const moduleSource = await readFile(new URL("../public/cosmetics-observatory.mjs", import.meta.url), "utf8");
  const cleanup = moduleSource.slice(
    moduleSource.indexOf("function stopProfileFramePreviewMedia"),
    moduleSource.indexOf("function close(", moduleSource.indexOf("function stopProfileFramePreviewMedia"))
  );
  const close = moduleSource.slice(
    moduleSource.indexOf("function close("),
    moduleSource.indexOf("function badgeNode", moduleSource.indexOf("function close("))
  );
  const previewVisual = moduleSource.slice(
    moduleSource.indexOf("function carouselPreviewVisual"),
    moduleSource.indexOf("function bindCarouselSwipe", moduleSource.indexOf("function carouselPreviewVisual"))
  );
  const render = moduleSource.slice(
    moduleSource.indexOf("function render("),
    moduleSource.indexOf("function keydown", moduleSource.indexOf("function render("))
  );

  for (const token of [
    'querySelectorAll?.("[data-profile-frame-preview-video]")',
    "video.pause?.()",
    'video.removeAttribute("src")',
    "video.load?.()"
  ]) {
    assert.ok(cleanup.includes(token), `cleanup must retain ${token}`);
  }
  assert.match(close, /stopProfileFramePreviewMedia\(\)/);
  assert.ok(
    render.indexOf("stopProfileFramePreviewMedia(surface)")
      < render.indexOf("surface.replaceChildren()"),
    "preview media must be released before the old carousel DOM is detached"
  );
  assert.match(previewVisual, /try \{[\s\S]*?settings[.]createProfileFramePreview/);
  assert.match(previewVisual, /catch \{[\s\S]*?previewNode = null/);
  assert.match(
    previewVisual,
    /if \(previewNode[?][.]nodeType\) mount[.]append\(previewNode\);\s*else mount[.]append\(profileFrameThumbnailVisual\(entry\)\);/
  );
});

test("implementation keeps carousel selection safe and includes accessibility fallbacks", async () => {
  const moduleSource = await readFile(new URL("../public/cosmetics-observatory.mjs", import.meta.url), "utf8");
  const cssSource = await readFile(new URL("../public/cosmetics-observatory.css", import.meta.url), "utf8");
  const fullPageCssSource = await readFile(new URL("../public/cosmetics-observatory-full-page.css", import.meta.url), "utf8");
  const profileFrameCssSource = await readFile(new URL("../public/profile-rank-frame.css", import.meta.url), "utf8");
  const allObservatoryCssSource = `${cssSource}\n${fullPageCssSource}\n${profileFrameCssSource}`;
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
  assert.match(moduleSource, /Cosmetic Lab/);
  assert.match(moduleSource, /function stageCarouselEntry\(model, entry/);
  assert.match(moduleSource, /function carouselCategoryStrip\(model\)/);
  assert.match(moduleSource, /PROFILE_FRAME_CATEGORY = "profileFrames"/);
  assert.match(moduleSource, /carouselEntryForProfileFrame/);
  assert.match(moduleSource, /function commitProfileFrame\(/);
  assert.match(moduleSource, /settings[.]onProfileFrameCommit/);
  assert.match(moduleSource, /settings[.]createProfileFramePreview/);
  assert.match(moduleSource, /Preview without a frame/);
  assert.match(moduleSource, /function carouselFocusedPreview\(model, entries, selected\)/);
  assert.match(moduleSource, /viewport\.dataset\.hasPrevious = String\(index > 0\)/);
  assert.match(moduleSource, /viewport\.dataset\.hasNext = String\(index < entries\.length - 1\)/);
  assert.doesNotMatch(moduleSource, /carouselPeekVisual/);
  assert.doesNotMatch(moduleSource, /cosmetics-observatory__carousel-peek/);
  assert.match(moduleSource, /function bindCarouselSwipe\(node, model, index, total\)/);
  assert.match(moduleSource, /aria-roledescription/);
  assert.match(moduleSource, /role", "listbox"/);
  assert.match(moduleSource, /role", "option"/);
  assert.match(moduleSource, /includeLocked = true/);
  assert.match(moduleSource, /function carouselAccessState\(model, entry/);
  assert.match(moduleSource, /function carouselStateIcon\(state\)/);
  assert.match(moduleSource, /dataset\.ownershipIcon/);
  assert.match(moduleSource, /All \$\{allCount\} choices are shown/);
  assert.match(moduleSource, /dialog\.dataset\.presentation = "full-page"/);
  assert.match(moduleSource, /carouselOption && \["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"\]/);
  assert.match(moduleSource, /Math\.abs\(deltaX\) < 42/);
  assert.match(moduleSource, /Math\.abs\(deltaY\) \* 1\.25/);
  assert.match(moduleSource, /event\.target === carouselStage/);
  assert.match(moduleSource, /tab\.closest\('\[role="tablist"\]'\)/);
  assert.match(moduleSource, /gameplay stays locked in preview mode/);
  assert.match(moduleSource, /cosmetics-observatory__preview-surface/);
  assert.match(moduleSource, /dialog\.append\(surface, live\)/);
  assert.doesNotMatch(moduleSource, /surface\.append\([^;]*live\)/s);
  assert.match(moduleSource, /calculatePiecePreviewLoadout\(baseLoadout, item\)/);
  assert.match(moduleSource, /if \(!observatoryLoadoutIsOwned\(model, candidate\)\)/);
  assert.match(moduleSource, /callPreview\(previewLoadout, \{ \.\.\.entry\.meta, transient: true, carousel: true \}\)/);
  assert.doesNotMatch(moduleSource, /\bownerForLoadout\b/);
  assert.match(moduleSource, /const committedLoadout = asRecord\(persisted\)/);
  assert.match(moduleSource, /ArrowUp/);
  assert.match(moduleSource, /aria-busy/);
  assert.match(moduleSource, /Home backgrounds/);
  assert.match(moduleSource, /Board backgrounds & finishes/);
  assert.match(moduleSource, /Home background included/);
  assert.match(moduleSource, /Style tier/);
  assert.match(moduleSource, /\$\{pieceCount\} pieces/);
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
    /clearPurchaseConfirmation\(\);\s*selectedSlot = selectedSlot === slot [?] "" : slot;/,
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
  assert.match(profileFrameCssSource, /\.cosmetics-observatory__profile-frame-preview/);
  assert.match(profileFrameCssSource, /\.cosmetics-observatory__frame-thumb-visual/);
  assert.match(profileFrameCssSource, /profile-rank-frame-islands--card-clipped/);
  assert.match(cssSource, /\.cosmetics-observatory__category-track/);
  assert.match(cssSource, /\.cosmetics-observatory__carousel-stage/);
  assert.match(cssSource, /\.cosmetics-observatory__carousel-details/);
  assert.match(fullPageCssSource, /\[data-presentation="full-page"\]/);
  assert.match(allObservatoryCssSource, /width: 100vw/);
  assert.match(allObservatoryCssSource, /height: 100dvh/);
  assert.match(fullPageCssSource, /\.cosmetics-observatory__carousel-state-mark/);
  assert.match(fullPageCssSource, /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(fullPageCssSource, /outline-offset: -4px/);
  assert.match(allObservatoryCssSource, /touch-action: pan-y/);
});
