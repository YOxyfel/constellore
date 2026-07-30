/**
 * Canonical, public cosmetics manifest.
 *
 * IDs are intentionally stable and globally namespaced. They are persisted in
 * profiles and may be referenced by receipts, so changing an ID requires an
 * entry in LEGACY_COSMETIC_IDS rather than an in-place rename.
 */
export const COSMETIC_SCHEMA_VERSION = 10;

export const COSMETIC_SLOTS = Object.freeze([
  "wordPlaque",
  "trailSet",
  "boardFinish",
  "homeScene",
  "gateStyle",
  "uiFinish",
  "soundTheme"
]);

const collection = (value) => {
  const preset = Object.freeze({ ...value.preset });
  const rankUnlock = value.rankUnlock ? Object.freeze({ ...value.rankUnlock }) : null;
  const purchaseOnly = value.purchaseOnly === true;
  return Object.freeze({
    ...value,
    tags: Object.freeze([...value.tags]),
    rankUnlock,
    purchaseOnly,
    acquisition: purchaseOnly
      ? "purchase-only"
      : rankUnlock
        ? "purchase-or-rank"
        : value.access === "free"
          ? "included"
          : value.access,
    preset,
    // Compatibility aliases make the manifest directly consumable by the
    // Observatory and other data-driven catalog surfaces.
    loadout: preset,
    itemIds: Object.freeze(Object.values(preset)),
    preview: Object.freeze({ ...value.preview })
  });
};

const item = (value) => Object.freeze({
  ...value,
  kind: value.slot,
  tags: Object.freeze([...value.tags]),
  preview: Object.freeze({ ...value.preview }),
  recipe: Object.freeze({ ...value.recipe }),
  assets: value.assets
    ? Object.freeze(Object.fromEntries(
      Object.entries(value.assets).map(([key, asset]) => [
        key,
        asset && typeof asset === "object" ? Object.freeze({ ...asset }) : asset
      ])
    ))
    : null,
  unlock: value.unlock ? Object.freeze({ ...value.unlock }) : null
});

export const COSMETIC_COLLECTIONS = Object.freeze([
  collection({
    id: "constellore.collection.celestial-atlas",
    slug: "celestial-atlas",
    label: "Celestial Atlas",
    eyebrow: "Included",
    access: "free",
    entitlement: "free",
    order: 1,
    creditPrice: 0,
    tier: "Included",
    presentation: "foundation",
    tags: ["Free", "Constellore", "Launch"],
    description: "The original observatory: ink-blue skies, woven charts, and quiet cosmic chimes.",
    preview: {
      title: "Chart the first sky",
      body: "A calm, legible constellation kit built around the living Rank sky."
    },
    preset: {
      wordPlaque: "constellore.celestial-atlas.word-plaque.woven-atlas",
      trailSet: "constellore.celestial-atlas.trail-set.classic-thread",
      boardFinish: "constellore.celestial-atlas.board-finish.rank-sky",
      homeScene: "constellore.celestial-atlas.home-scene.deep-sky-observatory",
      gateStyle: "constellore.celestial-atlas.gate-style.atlas-doors",
      uiFinish: "constellore.celestial-atlas.ui-finish.midnight-atlas",
      soundTheme: "constellore.celestial-atlas.sound-theme.cosmic-chimes"
    }
  }),
  collection({
    id: "constellore.collection.aurora-archive",
    slug: "aurora-archive",
    label: "Aurora Archive",
    eyebrow: "Supporter",
    access: "supporter",
    entitlement: "supporter",
    order: 2,
    creditPrice: 450,
    rankUnlock: { id: "silver", name: "Silver", number: 2 },
    unlockHint: "Reach Silver Route Rank to unlock free, or buy now for 450 Star Credits.",
    tier: "Signature",
    presentation: "accent",
    tags: ["Supporter", "Frostglass", "Launch"],
    description: "A crystalline archive washed in teal aurora, prismatic threads, and glass harmonics.",
    preview: {
      title: "Open the frostglass archive",
      body: "Cool luminous surfaces frame the board without obscuring word categories or Rank art."
    },
    preset: {
      wordPlaque: "constellore.aurora-archive.word-plaque.frostglass",
      trailSet: "constellore.aurora-archive.trail-set.aurora-ribbon",
      boardFinish: "constellore.aurora-archive.board-finish.nebula-glass",
      homeScene: "constellore.aurora-archive.home-scene.aurora-observatory",
      gateStyle: "constellore.aurora-archive.gate-style.crystal-archive",
      uiFinish: "constellore.aurora-archive.ui-finish.frostglass",
      soundTheme: "constellore.aurora-archive.sound-theme.glass-orbit"
    }
  }),
  collection({
    id: "constellore.collection.solar-foundry",
    slug: "solar-foundry",
    label: "Solar Foundry",
    eyebrow: "Supporter",
    access: "supporter",
    entitlement: "supporter",
    order: 3,
    creditPrice: 800,
    rankUnlock: { id: "gold", name: "Gold", number: 3 },
    unlockHint: "Reach Gold Route Rank to unlock free, or buy now for 800 Star Credits.",
    tier: "Crafted",
    presentation: "accent",
    tags: ["Supporter", "Brass", "Launch"],
    description: "An antique celestial foundry of engraved brass, ember comets, and analog star tones.",
    preview: {
      title: "Set the orrery in motion",
      body: "Warm metalwork and measured blueprint lines turn every route into a crafted instrument."
    },
    preset: {
      wordPlaque: "constellore.solar-foundry.word-plaque.engraved-brass",
      trailSet: "constellore.solar-foundry.trail-set.ember-comet",
      boardFinish: "constellore.solar-foundry.board-finish.cosmic-blueprint",
      homeScene: "constellore.solar-foundry.home-scene.solar-orrery",
      gateStyle: "constellore.solar-foundry.gate-style.foundry-doors",
      uiFinish: "constellore.solar-foundry.ui-finish.antique-brass",
      soundTheme: "constellore.solar-foundry.sound-theme.analog-stars"
    }
  }),
  collection({
    id: "constellore.collection.lunar-garden",
    slug: "lunar-garden",
    label: "Lunar Garden",
    eyebrow: "Deluxe",
    access: "supporter",
    entitlement: "supporter",
    order: 4,
    creditPrice: 1200,
    rankUnlock: { id: "emerald", name: "Emerald", number: 5 },
    unlockHint: "Reach Emerald Route Rank to unlock free, or buy now for 1,200 Star Credits.",
    tier: "Deluxe",
    presentation: "accent",
    tags: ["Supporter", "Moonlit", "Deluxe"],
    description: "A moonlit celestial conservatory of silverleaf arches, jade fireflies, and night-bloom harmonics.",
    preview: {
      title: "Enter the moon garden",
      body: "A serene botanical sky that preserves the familiar Home layout while changing its atmosphere and materials."
    },
    preset: {
      wordPlaque: "constellore.lunar-garden.word-plaque.moonstone-bloom",
      trailSet: "constellore.lunar-garden.trail-set.moonpetal-trace",
      boardFinish: "constellore.lunar-garden.board-finish.night-garden",
      homeScene: "constellore.lunar-garden.home-scene.lunar-garden",
      gateStyle: "constellore.lunar-garden.gate-style.moon-garden",
      uiFinish: "constellore.lunar-garden.ui-finish.lunar-silver",
      soundTheme: "constellore.lunar-garden.sound-theme.moon-bells"
    }
  }),
  collection({
    id: "constellore.collection.eclipse-sovereign",
    slug: "eclipse-sovereign",
    label: "Eclipse Sovereign",
    eyebrow: "Sovereign",
    access: "supporter",
    entitlement: "supporter",
    order: 5,
    creditPrice: 2400,
    rankUnlock: { id: "master", name: "Master", number: 8 },
    unlockHint: "Reach Master Route Rank to unlock free, or buy now for 2,400 Star Credits.",
    tier: "Sovereign",
    presentation: "full-shell",
    tags: ["Supporter", "Obsidian", "Prestige"],
    description: "The signature collection: black opal, champagne-gold coronas, orbital crowns, and sovereign resonance.",
    preview: {
      title: "Command the event horizon",
      body: "A complete Home transformation with bespoke borders, control chrome, atmospheric VFX, and the richest scene treatment."
    },
    preset: {
      wordPlaque: "constellore.eclipse-sovereign.word-plaque.sovereign-obsidian",
      trailSet: "constellore.eclipse-sovereign.trail-set.corona-rift",
      boardFinish: "constellore.eclipse-sovereign.board-finish.eclipse-court",
      homeScene: "constellore.eclipse-sovereign.home-scene.eclipse-throne",
      gateStyle: "constellore.eclipse-sovereign.gate-style.sovereign-eclipse",
      uiFinish: "constellore.eclipse-sovereign.ui-finish.sovereign-frame",
      soundTheme: "constellore.eclipse-sovereign.sound-theme.eclipse-choir"
    }
  }),
  collection({
    id: "constellore.collection.pixel-frontier",
    slug: "pixel-frontier",
    label: "Pixel Frontier",
    eyebrow: "Arcade",
    access: "supporter",
    entitlement: "supporter",
    order: 6,
    creditPrice: 700,
    purchaseOnly: true,
    unlockHint: "Purchase only. Route Rank does not unlock this collection.",
    tier: "Arcade",
    presentation: "accent",
    tags: ["Supporter", "Pixel", "Arcade"],
    description: "A crisp 16-bit observatory of cartridge frames, scanline sparks, and original chip-synth constellations.",
    preview: {
      title: "Cross the pixel frontier",
      body: "Every surface becomes a premium retro adventure while words and routes stay sharp."
    },
    preset: {
      wordPlaque: "constellore.pixel-frontier.word-plaque.cartridge-frame",
      trailSet: "constellore.pixel-frontier.trail-set.scanline-spark",
      boardFinish: "constellore.pixel-frontier.board-finish.pixel-cosmos",
      homeScene: "constellore.pixel-frontier.home-scene.bit-observatory",
      gateStyle: "constellore.pixel-frontier.gate-style.warp-gate",
      uiFinish: "constellore.pixel-frontier.ui-finish.arcade-console",
      soundTheme: "constellore.pixel-frontier.sound-theme.pixel-pulse"
    }
  }),
  collection({
    id: "constellore.collection.bubble-reef",
    slug: "bubble-reef",
    label: "Bubble Reef",
    eyebrow: "Playful",
    access: "supporter",
    entitlement: "supporter",
    order: 7,
    creditPrice: 950,
    purchaseOnly: true,
    unlockHint: "Purchase only. Route Rank does not unlock this collection.",
    tier: "Playful",
    presentation: "accent",
    tags: ["Supporter", "Undersea", "Playful"],
    description: "An original storybook reef of pearly portals, coral-pop menus, bubble trails, and buoyant musical cues.",
    preview: {
      title: "Dive into Bubble Reef",
      body: "A joyful undersea cartoon world with its own shell architecture and luminous current gate."
    },
    preset: {
      wordPlaque: "constellore.bubble-reef.word-plaque.bubble-glass",
      trailSet: "constellore.bubble-reef.trail-set.bubble-stream",
      boardFinish: "constellore.bubble-reef.board-finish.coral-storybook",
      homeScene: "constellore.bubble-reef.home-scene.reef-observatory",
      gateStyle: "constellore.bubble-reef.gate-style.pearl-current",
      uiFinish: "constellore.bubble-reef.ui-finish.coral-pop",
      soundTheme: "constellore.bubble-reef.sound-theme.bubble-beat"
    }
  }),
  collection({
    id: "constellore.collection.stellar-vanguard",
    slug: "stellar-vanguard",
    label: "Stellar Vanguard",
    eyebrow: "Epic",
    access: "supporter",
    entitlement: "supporter",
    order: 8,
    creditPrice: 1600,
    purchaseOnly: true,
    unlockHint: "Purchase only. Route Rank does not unlock this collection.",
    tier: "Epic",
    presentation: "accent",
    tags: ["Supporter", "Space Opera", "Epic"],
    description: "An original cinematic command sanctuary of vanguard alloy, ion crescents, and a solemn void overture.",
    preview: {
      title: "Stand at the silent meridian",
      body: "Grand space-opera scale, restrained command chrome, and an entirely original ceremonial sound."
    },
    preset: {
      wordPlaque: "constellore.stellar-vanguard.word-plaque.vanguard-alloy",
      trailSet: "constellore.stellar-vanguard.trail-set.ion-crescent",
      boardFinish: "constellore.stellar-vanguard.board-finish.command-deck",
      homeScene: "constellore.stellar-vanguard.home-scene.orbital-sanctuary",
      gateStyle: "constellore.stellar-vanguard.gate-style.meridian-gate",
      uiFinish: "constellore.stellar-vanguard.ui-finish.command-alloy",
      soundTheme: "constellore.stellar-vanguard.sound-theme.void-overture"
    }
  })
]);

export const COSMETIC_ITEMS = Object.freeze([
  item({
    id: "constellore.celestial-atlas.word-plaque.woven-atlas",
    slug: "woven-atlas",
    slot: "wordPlaque",
    collectionId: "constellore.collection.celestial-atlas",
    label: "Woven Atlas",
    access: "free",
    entitlement: "free",
    tags: ["Free", "Plaque"],
    description: "Midnight linen, a fine chart grid, and a bright category edge.",
    preview: { title: "Woven Atlas plaque", body: "Designed for maximum word and emoji clarity." },
    recipe: { cssToken: "woven-atlas", surface: "linen", edge: "category" }
  }),
  item({
    id: "constellore.celestial-atlas.trail-set.classic-thread",
    slug: "classic-thread",
    slot: "trailSet",
    collectionId: "constellore.collection.celestial-atlas",
    label: "Classic Thread",
    access: "free",
    entitlement: "free",
    tags: ["Free", "Trail"],
    description: "A restrained starlight trace with a clean fusion link.",
    preview: { title: "Classic Thread", body: "Fine ivory starlight with a soft discovery spark." },
    recipe: {
      cssToken: "classic-thread",
      color: "#f5dda0",
      secondary: "#9ac8ff",
      width: 2,
      glow: 8,
      dragLifetimeMs: 360,
      burst: "star"
    }
  }),
  item({
    id: "constellore.celestial-atlas.board-finish.rank-sky",
    slug: "rank-sky",
    slot: "boardFinish",
    collectionId: "constellore.collection.celestial-atlas",
    label: "Rank Sky",
    access: "free",
    entitlement: "free",
    tags: ["Free", "Board"],
    description: "The living Rank sky with a subtle observatory vignette.",
    preview: { title: "Rank Sky finish", body: "Preserves every Rank illustration as the primary board scene." },
    recipe: { cssToken: "rank-sky", overlay: "atlas-vignette", blend: "normal" }
  }),
  item({
    id: "constellore.celestial-atlas.home-scene.deep-sky-observatory",
    slug: "deep-sky-observatory",
    slot: "homeScene",
    collectionId: "constellore.collection.celestial-atlas",
    label: "Deep-Sky Observatory",
    access: "free",
    entitlement: "free",
    tags: ["Free", "Home"],
    description: "Constellore's original observatory horizon.",
    preview: { title: "Deep-Sky Observatory", body: "A quiet invitation into the atlas." },
    recipe: { cssToken: "constellore-cosmos", treatment: "original" },
    assets: {
      responsive: {
        sm: "/art/home/home-cosmos-v1-portrait.webp",
        md: "/art/home/home-cosmos-v1-md.webp",
        lg: "/art/home/home-cosmos-v1-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.celestial-atlas.gate-style.atlas-doors",
    slug: "atlas-doors",
    slot: "gateStyle",
    collectionId: "constellore.collection.celestial-atlas",
    label: "Atlas Doors",
    access: "free",
    entitlement: "free",
    tags: ["Free", "Gate"],
    description: "The engraved opening doors of the Celestial Atlas.",
    preview: { title: "Atlas Doors", body: "The original observatory threshold and opening motion." },
    recipe: { cssToken: "constellore", seam: "starlight", motion: "hinged" },
    assets: {
      responsive: {
        sm: "/art/transitions/cosmic-gate-v2-portrait.webp",
        md: "/art/transitions/cosmic-gate-v2-md.webp",
        lg: "/art/transitions/cosmic-gate-v2-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.celestial-atlas.ui-finish.midnight-atlas",
    slug: "midnight-atlas",
    slot: "uiFinish",
    collectionId: "constellore.collection.celestial-atlas",
    label: "Midnight Atlas",
    access: "free",
    entitlement: "free",
    tags: ["Free", "Interface"],
    description: "Deep ink menus with parchment-gold wayfinding.",
    preview: { title: "Midnight Atlas UI", body: "The reference Constellore interface treatment." },
    recipe: { cssToken: "woven-atlas", material: "ink", accent: "#f5dda0" }
  }),
  item({
    id: "constellore.celestial-atlas.sound-theme.cosmic-chimes",
    slug: "cosmic-chimes",
    slot: "soundTheme",
    collectionId: "constellore.collection.celestial-atlas",
    label: "Cosmic Chimes",
    access: "free",
    entitlement: "free",
    tags: ["Free", "Sound"],
    description: "Quiet cosmic chimes, woven word tones, and the Charting the First Sky score.",
    preview: { title: "Cosmic Chimes", body: "A calm celesta-and-harp orbit with balanced cues for long sessions." },
    recipe: { cssToken: "cosmic-chimes", wave: "default", pitch: 1, gain: 1 },
    assets: {
      soundtrack: { path: "audio/celestial-atlas/charting-the-first-sky.mp3", title: "Charting the First Sky", duration: 64, gain: 0.46, previewAt: 16 },
      gameplayPulse: { path: "audio/celestial-atlas/gameplay-pulse.mp3", duration: 64, gain: 0.42 },
      sfxBank: { path: "audio/celestial-atlas/sfx-bank.mp3", duration: 33.6 }
    }
  }),

  item({
    id: "constellore.aurora-archive.word-plaque.frostglass",
    slug: "frostglass",
    slot: "wordPlaque",
    collectionId: "constellore.collection.aurora-archive",
    label: "Frostglass",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Plaque"],
    description: "Translucent crystal with a cold luminous rim.",
    preview: { title: "Frostglass plaque", body: "Prismatic at the edges, dark and readable at its center." },
    recipe: { cssToken: "frostglass", surface: "crystal", edge: "aurora" }
  }),
  item({
    id: "constellore.aurora-archive.trail-set.aurora-ribbon",
    slug: "aurora-ribbon",
    slot: "trailSet",
    collectionId: "constellore.collection.aurora-archive",
    label: "Aurora Ribbon",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Trail"],
    description: "A cyan-to-violet drag ribbon, prism fusion link, and crystal burst.",
    preview: { title: "Aurora Ribbon", body: "A luminous trace that fades before it can crowd the board." },
    recipe: {
      cssToken: "aurora-ribbon",
      color: "#70f7e5",
      secondary: "#b18cff",
      width: 3,
      glow: 14,
      dragLifetimeMs: 440,
      burst: "crystal"
    }
  }),
  item({
    id: "constellore.aurora-archive.board-finish.nebula-glass",
    slug: "nebula-glass",
    slot: "boardFinish",
    collectionId: "constellore.collection.aurora-archive",
    label: "Nebula Glass",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Board"],
    description: "Frosted aurora glass layered over, never instead of, the Rank sky.",
    preview: { title: "Nebula Glass finish", body: "Adds crystalline depth while preserving the current Rank scene." },
    recipe: { cssToken: "nebula-glass", overlay: "aurora-glass", blend: "screen" }
  }),
  item({
    id: "constellore.aurora-archive.home-scene.aurora-observatory",
    slug: "aurora-observatory",
    slot: "homeScene",
    collectionId: "constellore.collection.aurora-archive",
    label: "Aurora Observatory",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Home"],
    description: "A crystalline archive beneath a living teal aurora.",
    preview: { title: "Aurora Observatory", body: "A cool, spacious observatory with a calm center for Home actions." },
    recipe: { cssToken: "aurora-observatory", treatment: "frostglass" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/aurora-archive/home-sm.webp",
        md: "/art/cosmetics/aurora-archive/home-md.webp",
        lg: "/art/cosmetics/aurora-archive/home-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.aurora-archive.gate-style.crystal-archive",
    slug: "crystal-archive",
    slot: "gateStyle",
    collectionId: "constellore.collection.aurora-archive",
    label: "Crystal Archive",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Gate"],
    description: "Faceted archive doors with an emerald aurora seam.",
    preview: { title: "Crystal Archive gate", body: "An icy threshold that opens on the same dependable timing." },
    recipe: { cssToken: "crystal-archive", seam: "aurora", motion: "faceted" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/aurora-archive/gate-sm.webp",
        md: "/art/cosmetics/aurora-archive/gate-md.webp",
        lg: "/art/cosmetics/aurora-archive/gate-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.aurora-archive.ui-finish.frostglass",
    slug: "frostglass",
    slot: "uiFinish",
    collectionId: "constellore.collection.aurora-archive",
    label: "Frostglass UI",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Interface"],
    description: "Dark translucent menus with cyan wayfinding and crystalline dividers.",
    preview: { title: "Frostglass UI", body: "High-contrast controls set into quiet translucent surfaces." },
    recipe: { cssToken: "frostglass", material: "crystal", accent: "#70f7e5" }
  }),
  item({
    id: "constellore.aurora-archive.sound-theme.glass-orbit",
    slug: "glass-orbit",
    slot: "soundTheme",
    collectionId: "constellore.collection.aurora-archive",
    label: "Glass Orbit",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Sound"],
    description: "Bright glass harmonics and the cool, luminous Frostglass Memory score.",
    preview: { title: "Glass Orbit", body: "Bowed glass, airy pads, and elevated cues tuned for gentle repeated play." },
    recipe: { cssToken: "glass-orbit", wave: "sine", pitch: 1.35, gain: 0.84 },
    assets: {
      soundtrack: { path: "audio/aurora-archive/frostglass-memory.mp3", title: "Frostglass Memory", duration: 64, gain: 0.43, previewAt: 19.2 },
      gameplayPulse: { path: "audio/aurora-archive/gameplay-pulse.mp3", duration: 64, gain: 0.38 },
      sfxBank: { path: "audio/aurora-archive/sfx-bank.mp3", duration: 33.6 }
    }
  }),

  item({
    id: "constellore.solar-foundry.word-plaque.engraved-brass",
    slug: "engraved-brass",
    slot: "wordPlaque",
    collectionId: "constellore.collection.solar-foundry",
    label: "Engraved Brass",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Plaque"],
    description: "Antique brass framing around a deep ink word field.",
    preview: { title: "Engraved Brass plaque", body: "Warm metal detail without sacrificing word contrast." },
    recipe: { cssToken: "engraved-brass", surface: "brass", edge: "ember" }
  }),
  item({
    id: "constellore.solar-foundry.trail-set.ember-comet",
    slug: "ember-comet",
    slot: "trailSet",
    collectionId: "constellore.collection.solar-foundry",
    label: "Ember Comet",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Trail"],
    description: "A warm comet trace, engraved fusion line, and cinder burst.",
    preview: { title: "Ember Comet", body: "Molten amber motion with a disciplined, fast fade." },
    recipe: {
      cssToken: "ember-comet",
      color: "#ffc761",
      secondary: "#f06b3e",
      width: 3,
      glow: 12,
      dragLifetimeMs: 400,
      burst: "embers"
    }
  }),
  item({
    id: "constellore.solar-foundry.board-finish.cosmic-blueprint",
    slug: "cosmic-blueprint",
    slot: "boardFinish",
    collectionId: "constellore.collection.solar-foundry",
    label: "Cosmic Blueprint",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Board"],
    description: "Fine orrery geometry and brass registration marks over the Rank sky.",
    preview: { title: "Cosmic Blueprint finish", body: "A measured technical overlay that leaves routes and Rank art legible." },
    recipe: { cssToken: "cosmic-blueprint", overlay: "orrery-grid", blend: "screen" }
  }),
  item({
    id: "constellore.solar-foundry.home-scene.solar-orrery",
    slug: "solar-orrery",
    slot: "homeScene",
    collectionId: "constellore.collection.solar-foundry",
    label: "Solar Orrery",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Home"],
    description: "An antique cosmic foundry arranged around a glowing mechanical sun.",
    preview: { title: "Solar Orrery", body: "Warm celestial machinery kept to the edges of the Home stage." },
    recipe: { cssToken: "solar-orrery", treatment: "brass" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/solar-foundry/home-sm.webp",
        md: "/art/cosmetics/solar-foundry/home-md.webp",
        lg: "/art/cosmetics/solar-foundry/home-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.solar-foundry.gate-style.foundry-doors",
    slug: "foundry-doors",
    slot: "gateStyle",
    collectionId: "constellore.collection.solar-foundry",
    label: "Foundry Doors",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Gate"],
    description: "Engraved brass doors split by a molten stellar seam.",
    preview: { title: "Foundry Doors", body: "A crafted mechanical threshold using the standard accessible opening motion." },
    recipe: { cssToken: "foundry", seam: "ember", motion: "orrery" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/solar-foundry/gate-sm.webp",
        md: "/art/cosmetics/solar-foundry/gate-md.webp",
        lg: "/art/cosmetics/solar-foundry/gate-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.solar-foundry.ui-finish.antique-brass",
    slug: "antique-brass",
    slot: "uiFinish",
    collectionId: "constellore.collection.solar-foundry",
    label: "Antique Brass UI",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Interface"],
    description: "Deep navy panels with brass dividers and ember focus rings.",
    preview: { title: "Antique Brass UI", body: "Warm, tactile menus with modern control contrast." },
    recipe: { cssToken: "antique-brass", material: "brass", accent: "#ffc761" }
  }),
  item({
    id: "constellore.solar-foundry.sound-theme.analog-stars",
    slug: "analog-stars",
    slot: "soundTheme",
    collectionId: "constellore.collection.solar-foundry",
    label: "Analog Stars",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Sound"],
    description: "Warm analog word tones, measured mechanisms, and The Orrery Turns score.",
    preview: { title: "Analog Stars", body: "Grounded brass-and-ember music with tactile foundry feedback." },
    recipe: { cssToken: "analog-stars", wave: "triangle", pitch: 0.82, gain: 1.08 },
    assets: {
      soundtrack: { path: "audio/solar-foundry/the-orrery-turns.mp3", title: "The Orrery Turns", duration: 64, gain: 0.42, previewAt: 16 },
      gameplayPulse: { path: "audio/solar-foundry/gameplay-pulse.mp3", duration: 64, gain: 0.44 },
      sfxBank: { path: "audio/solar-foundry/sfx-bank.mp3", duration: 33.6 }
    }
  }),

  item({
    id: "constellore.lunar-garden.word-plaque.moonstone-bloom",
    slug: "moonstone-bloom",
    slot: "wordPlaque",
    collectionId: "constellore.collection.lunar-garden",
    label: "Moonstone Bloom",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Plaque"],
    description: "Translucent moon-glass edged with living silverleaf.",
    preview: { title: "Moonstone Bloom plaque", body: "A calm jade-and-lilac word surface with a botanical silver edge." },
    recipe: { cssToken: "moonstone-bloom", surface: "moonstone", edge: "silverleaf" }
  }),
  item({
    id: "constellore.lunar-garden.trail-set.moonpetal-trace",
    slug: "moonpetal-trace",
    slot: "trailSet",
    collectionId: "constellore.collection.lunar-garden",
    label: "Moonpetal Trace",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Trail"],
    description: "A soft jade trail that sheds tiny moonlit petals.",
    preview: { title: "Moonpetal Trace", body: "Garden-light motion with a slow, graceful fade." },
    recipe: {
      cssToken: "moonpetal-trace",
      color: "#b9f2d0",
      secondary: "#d8e4ff",
      width: 2.6,
      glow: 12,
      dragLifetimeMs: 460,
      burst: "petals"
    }
  }),
  item({
    id: "constellore.lunar-garden.board-finish.night-garden",
    slug: "night-garden",
    slot: "boardFinish",
    collectionId: "constellore.collection.lunar-garden",
    label: "Night Garden",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Board"],
    description: "Moonflower constellations bloom gently over the current Rank sky.",
    preview: { title: "Night Garden finish", body: "A restrained botanical overlay that keeps every route readable." },
    recipe: { cssToken: "night-garden", overlay: "lunar-bloom", blend: "screen" }
  }),
  item({
    id: "constellore.lunar-garden.home-scene.lunar-garden",
    slug: "lunar-garden",
    slot: "homeScene",
    collectionId: "constellore.collection.lunar-garden",
    label: "Lunar Garden",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Home"],
    description: "A floating moon garden framed by silver arches and luminous flowers.",
    preview: { title: "Lunar Garden background", body: "A complete responsive main-menu background with the familiar layout left untouched." },
    recipe: { cssToken: "lunar-garden", treatment: "moon-garden" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/lunar-garden/home-sm.webp",
        md: "/art/cosmetics/lunar-garden/home-md.webp",
        lg: "/art/cosmetics/lunar-garden/home-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.lunar-garden.gate-style.moon-garden",
    slug: "moon-garden",
    slot: "gateStyle",
    collectionId: "constellore.collection.lunar-garden",
    label: "Moon Garden Gate",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Gate"],
    description: "A flowering silver arbor opens beneath a quiet crescent moon.",
    preview: { title: "Moon Garden gate", body: "A moon-garden threshold using the standard accessible opening motion." },
    recipe: { cssToken: "moon-garden", seam: "moonbeam", motion: "petals" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/lunar-garden/gate-sm.webp",
        md: "/art/cosmetics/lunar-garden/gate-md.webp",
        lg: "/art/cosmetics/lunar-garden/gate-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.lunar-garden.ui-finish.lunar-silver",
    slug: "lunar-silver",
    slot: "uiFinish",
    collectionId: "constellore.collection.lunar-garden",
    label: "Lunar Silver UI",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Interface"],
    description: "Deep garden-glass panels with silverleaf borders and jade focus rings.",
    preview: { title: "Lunar Silver UI", body: "A serene material and palette pass over the established interface." },
    recipe: { cssToken: "lunar-silver", material: "moon-glass", accent: "#b9f2d0" }
  }),
  item({
    id: "constellore.lunar-garden.sound-theme.moon-bells",
    slug: "moon-bells",
    slot: "soundTheme",
    collectionId: "constellore.collection.lunar-garden",
    label: "Moon Bells",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Sound"],
    description: "Soft glass tones, distant chimes, and the nocturnal Midnight Bloom score.",
    preview: { title: "Moon Bells", body: "Luminous feedback tuned to feel calm, botanical, and precise." },
    recipe: { cssToken: "moon-bells", wave: "sine", pitch: 1.12, gain: 0.88 },
    assets: {
      soundtrack: { path: "audio/lunar-garden/midnight-bloom.mp3", title: "Midnight Bloom", duration: 64, gain: 0.42, previewAt: 17.6 },
      gameplayPulse: { path: "audio/lunar-garden/gameplay-pulse.mp3", duration: 64, gain: 0.32 },
      sfxBank: { path: "audio/lunar-garden/sfx-bank.mp3", duration: 33.6 }
    }
  }),

  item({
    id: "constellore.eclipse-sovereign.word-plaque.sovereign-obsidian",
    slug: "sovereign-obsidian",
    slot: "wordPlaque",
    collectionId: "constellore.collection.eclipse-sovereign",
    label: "Sovereign Obsidian",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Plaque"],
    description: "Black-opal glass held inside a precise corona edge.",
    preview: { title: "Sovereign Obsidian plaque", body: "Prestige word chrome with warm light wrapped around an abyssal core." },
    recipe: { cssToken: "sovereign-obsidian", surface: "black-opal", edge: "corona" }
  }),
  item({
    id: "constellore.eclipse-sovereign.trail-set.corona-rift",
    slug: "corona-rift",
    slot: "trailSet",
    collectionId: "constellore.collection.eclipse-sovereign",
    label: "Corona Rift",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Trail"],
    description: "A brilliant gold-violet arc drawn from an orbiting corona.",
    preview: { title: "Corona Rift", body: "The richest trail treatment, ending in a compact eclipse burst." },
    recipe: {
      cssToken: "corona-rift",
      color: "#ffd98a",
      secondary: "#c276ff",
      width: 3.6,
      glow: 18,
      dragLifetimeMs: 520,
      burst: "corona"
    }
  }),
  item({
    id: "constellore.eclipse-sovereign.board-finish.eclipse-court",
    slug: "eclipse-court",
    slot: "boardFinish",
    collectionId: "constellore.collection.eclipse-sovereign",
    label: "Eclipse Court",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Board"],
    description: "Gravitational rings and distant orbital marks crown the Rank sky.",
    preview: { title: "Eclipse Court finish", body: "A dramatic event-horizon overlay that preserves gameplay contrast." },
    recipe: { cssToken: "eclipse-court", overlay: "event-horizon", blend: "screen" }
  }),
  item({
    id: "constellore.eclipse-sovereign.home-scene.eclipse-throne",
    slug: "eclipse-throne",
    slot: "homeScene",
    collectionId: "constellore.collection.eclipse-sovereign",
    label: "Eclipse Throne",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Home", "Prestige"],
    description: "A colossal crowned eclipse transforms Home into an obsidian observatory.",
    preview: { title: "Eclipse Throne background", body: "The signature full-shell main-menu background, built for dramatic chrome and atmospheric VFX." },
    recipe: { cssToken: "eclipse-throne", treatment: "full-shell" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/eclipse-sovereign/home-sm.webp",
        md: "/art/cosmetics/eclipse-sovereign/home-md.webp",
        lg: "/art/cosmetics/eclipse-sovereign/home-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.eclipse-sovereign.gate-style.sovereign-eclipse",
    slug: "sovereign-eclipse",
    slot: "gateStyle",
    collectionId: "constellore.collection.eclipse-sovereign",
    label: "Sovereign Eclipse Gate",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Gate", "Prestige"],
    description: "Obsidian doors orbit a brilliant, crown-shaped event horizon.",
    preview: { title: "Sovereign Eclipse gate", body: "A sovereign threshold using the standard accessible opening motion." },
    recipe: { cssToken: "sovereign-eclipse", seam: "corona", motion: "crowned" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/eclipse-sovereign/gate-sm.webp",
        md: "/art/cosmetics/eclipse-sovereign/gate-md.webp",
        lg: "/art/cosmetics/eclipse-sovereign/gate-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.eclipse-sovereign.ui-finish.sovereign-frame",
    slug: "sovereign-frame",
    slot: "uiFinish",
    collectionId: "constellore.collection.eclipse-sovereign",
    label: "Sovereign Frame UI",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Interface", "Prestige"],
    description: "Black-opal panels, champagne-gold coronas, and lensed violet highlights.",
    preview: { title: "Sovereign Frame UI", body: "The prestige shell reshapes the interface through materials, borders, and VFX—not layout." },
    recipe: { cssToken: "sovereign-frame", material: "black-opal", accent: "#ffd98a" }
  }),
  item({
    id: "constellore.eclipse-sovereign.sound-theme.eclipse-choir",
    slug: "eclipse-choir",
    slot: "soundTheme",
    collectionId: "constellore.collection.eclipse-sovereign",
    label: "Eclipse Choir",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Sound", "Prestige"],
    description: "Low orbital tones, a warm harmonic pulse, and the Crown of Shadow score.",
    preview: { title: "Eclipse Choir", body: "Weighty, cinematic feedback balanced for repeated play." },
    recipe: { cssToken: "eclipse-choir", wave: "triangle", pitch: 0.72, gain: 0.9 },
    assets: {
      soundtrack: { path: "audio/eclipse-sovereign/crown-of-shadow.mp3", title: "Crown of Shadow", duration: 64, gain: 0.4, previewAt: 20.8 },
      gameplayPulse: { path: "audio/eclipse-sovereign/gameplay-pulse.mp3", duration: 64, gain: 0.4 },
      sfxBank: { path: "audio/eclipse-sovereign/sfx-bank.mp3", duration: 33.6 }
    }
  }),

  item({
    id: "constellore.pixel-frontier.word-plaque.cartridge-frame",
    slug: "cartridge-frame",
    slot: "wordPlaque",
    collectionId: "constellore.collection.pixel-frontier",
    label: "Cartridge Frame",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Plaque", "Pixel"],
    description: "A chunky cartridge bezel with a bright category-color pixel edge.",
    preview: { title: "Cartridge Frame plaque", body: "Crisp stepped corners and an ink-dark center keep every word readable." },
    recipe: { cssToken: "cartridge-frame", surface: "pixel-cartridge", edge: "scanline" }
  }),
  item({
    id: "constellore.pixel-frontier.trail-set.scanline-spark",
    slug: "scanline-spark",
    slot: "trailSet",
    collectionId: "constellore.collection.pixel-frontier",
    label: "Scanline Spark",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Trail", "Pixel"],
    description: "A stepped cyan-violet trace ending in a compact eight-direction burst.",
    preview: { title: "Scanline Spark", body: "Blocky arcade motion with a fast fade that never crowds the route." },
    recipe: {
      cssToken: "scanline-spark",
      color: "#44e8ff",
      secondary: "#a56cff",
      width: 3,
      glow: 8,
      dragLifetimeMs: 360,
      burst: "pixel-star"
    }
  }),
  item({
    id: "constellore.pixel-frontier.board-finish.pixel-cosmos",
    slug: "pixel-cosmos",
    slot: "boardFinish",
    collectionId: "constellore.collection.pixel-frontier",
    label: "Pixel Cosmos",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Board", "Pixel"],
    description: "A sparse tile-grid and dithered nebula layer over the current Rank sky.",
    preview: { title: "Pixel Cosmos finish", body: "Retro texture around, never over, the playable word routes." },
    recipe: { cssToken: "pixel-cosmos", overlay: "pixel-dither", blend: "screen" }
  }),
  item({
    id: "constellore.pixel-frontier.home-scene.bit-observatory",
    slug: "bit-observatory",
    slot: "homeScene",
    collectionId: "constellore.collection.pixel-frontier",
    label: "Bit Observatory",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Home", "Pixel"],
    description: "A warm tiled observatory and warp ring floating in a jewel-tone pixel cosmos.",
    preview: { title: "Bit Observatory background", body: "A true pixel-art Home scene with a calm center for the menu." },
    recipe: { cssToken: "bit-observatory", treatment: "pixel-art" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/pixel-frontier/home-sm.webp",
        md: "/art/cosmetics/pixel-frontier/home-md.webp",
        lg: "/art/cosmetics/pixel-frontier/home-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.pixel-frontier.gate-style.warp-gate",
    slug: "warp-gate",
    slot: "gateStyle",
    collectionId: "constellore.collection.pixel-frontier",
    label: "Pixel Warp Gate",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Gate", "Pixel"],
    description: "A monumental tile-built portal opening onto a spiraling pixel starfield.",
    preview: { title: "Pixel Warp Gate", body: "A centered arcade threshold using the standard accessible opening timing." },
    recipe: { cssToken: "pixel-warp", seam: "scanline", motion: "stepped" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/pixel-frontier/gate-sm.webp",
        md: "/art/cosmetics/pixel-frontier/gate-md.webp",
        lg: "/art/cosmetics/pixel-frontier/gate-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.pixel-frontier.ui-finish.arcade-console",
    slug: "arcade-console",
    slot: "uiFinish",
    collectionId: "constellore.collection.pixel-frontier",
    label: "Arcade Console UI",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Interface", "Pixel"],
    description: "Stepped navy panels, cartridge-gold dividers, and electric-cyan focus states.",
    preview: { title: "Arcade Console UI", body: "A crisp retro material pass that preserves the established layout and touch targets." },
    recipe: { cssToken: "arcade-console", material: "pixel-console", accent: "#44e8ff" }
  }),
  item({
    id: "constellore.pixel-frontier.sound-theme.pixel-pulse",
    slug: "pixel-pulse",
    slot: "soundTheme",
    collectionId: "constellore.collection.pixel-frontier",
    label: "Pixel Pulse",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Sound", "Pixel"],
    description: "Original pulse leads, triangle bass, tiny noise drums, and the Bitstream Constellations score.",
    preview: { title: "Pixel Pulse", body: "Bright arcade feedback and a fully original 64-second chip-synth loop." },
    recipe: { cssToken: "pixel-pulse", wave: "square", pitch: 1.04, gain: 0.88 },
    assets: {
      soundtrack: { path: "audio/pixel-frontier/bitstream-constellations.mp3", title: "Bitstream Constellations", duration: 64, gain: 0.4, previewAt: 16 },
      gameplayPulse: { path: "audio/pixel-frontier/gameplay-pulse.mp3", duration: 64, gain: 0.4 },
      sfxBank: { path: "audio/pixel-frontier/sfx-bank.mp3", duration: 33.6 }
    }
  }),

  item({
    id: "constellore.bubble-reef.word-plaque.bubble-glass",
    slug: "bubble-glass",
    slot: "wordPlaque",
    collectionId: "constellore.collection.bubble-reef",
    label: "Bubble Glass",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Plaque", "Undersea"],
    description: "A translucent aqua plaque held by soft coral corners and a pearly rim.",
    preview: { title: "Bubble Glass plaque", body: "Playful iridescence around a deep, readable word field." },
    recipe: { cssToken: "bubble-glass", surface: "pearl-bubble", edge: "coral" }
  }),
  item({
    id: "constellore.bubble-reef.trail-set.bubble-stream",
    slug: "bubble-stream",
    slot: "trailSet",
    collectionId: "constellore.collection.bubble-reef",
    label: "Bubble Stream",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Trail", "Undersea"],
    description: "An aqua-pink current that sheds compact pearl bubbles as words meet.",
    preview: { title: "Bubble Stream", body: "A buoyant trail with a soft pop and a quick, board-friendly fade." },
    recipe: {
      cssToken: "bubble-stream",
      color: "#7cf4ef",
      secondary: "#ff9ed8",
      width: 3.2,
      glow: 14,
      dragLifetimeMs: 490,
      burst: "bubbles"
    }
  }),
  item({
    id: "constellore.bubble-reef.board-finish.coral-storybook",
    slug: "coral-storybook",
    slot: "boardFinish",
    collectionId: "constellore.collection.bubble-reef",
    label: "Coral Storybook",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Board", "Undersea"],
    description: "Shell arcs, caustic light, and tiny coral silhouettes frame the Rank sky.",
    preview: { title: "Coral Storybook finish", body: "A cheerful undersea border that leaves routes and categories unobstructed." },
    recipe: { cssToken: "coral-storybook", overlay: "reef-caustics", blend: "screen" }
  }),
  item({
    id: "constellore.bubble-reef.home-scene.reef-observatory",
    slug: "reef-observatory",
    slot: "homeScene",
    collectionId: "constellore.collection.bubble-reef",
    label: "Reef Observatory",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Home", "Undersea"],
    description: "A shell-built observatory among bright coral gardens and rising pearl bubbles.",
    preview: { title: "Reef Observatory background", body: "An original storybook undersea Home scene with a clear menu corridor." },
    recipe: { cssToken: "reef-observatory", treatment: "undersea-storybook" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/bubble-reef/home-sm.webp",
        md: "/art/cosmetics/bubble-reef/home-md.webp",
        lg: "/art/cosmetics/bubble-reef/home-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.bubble-reef.gate-style.pearl-current",
    slug: "pearl-current",
    slot: "gateStyle",
    collectionId: "constellore.collection.bubble-reef",
    label: "Pearl Current Gate",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Gate", "Undersea"],
    description: "A luminous current spirals inside a ring of shells, coral, and floating pearls.",
    preview: { title: "Pearl Current Gate", body: "A dedicated portrait-and-landscape reef threshold with familiar opening timing." },
    recipe: { cssToken: "pearl-current", seam: "bubble-light", motion: "current" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/bubble-reef/gate-sm.webp",
        md: "/art/cosmetics/bubble-reef/gate-md.webp",
        lg: "/art/cosmetics/bubble-reef/gate-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.bubble-reef.ui-finish.coral-pop",
    slug: "coral-pop",
    slot: "uiFinish",
    collectionId: "constellore.collection.bubble-reef",
    label: "Coral Pop UI",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Interface", "Undersea"],
    description: "Deep-ocean glass panels with pearly edges, aqua controls, and mango-coral accents.",
    preview: { title: "Coral Pop UI", body: "Friendly rounded materials with strong text contrast and unchanged control geometry." },
    recipe: { cssToken: "coral-pop", material: "reef-glass", accent: "#7cf4ef" }
  }),
  item({
    id: "constellore.bubble-reef.sound-theme.bubble-beat",
    slug: "bubble-beat",
    slot: "soundTheme",
    collectionId: "constellore.collection.bubble-reef",
    label: "Bubble Beat",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Sound", "Undersea"],
    description: "Elastic bass, coral plucks, bubble cues, and the original Bubbles Beyond the Blue score.",
    preview: { title: "Bubble Beat", body: "A buoyant 64-second reef loop with playful feedback and no sampled voices." },
    recipe: { cssToken: "bubble-beat", wave: "sine", pitch: 1.16, gain: 0.9 },
    assets: {
      soundtrack: { path: "audio/bubble-reef/bubbles-beyond-the-blue.mp3", title: "Bubbles Beyond the Blue", duration: 64, gain: 0.4, previewAt: 19.2 },
      gameplayPulse: { path: "audio/bubble-reef/gameplay-pulse.mp3", duration: 64, gain: 0.36 },
      sfxBank: { path: "audio/bubble-reef/sfx-bank.mp3", duration: 33.6 }
    }
  }),

  item({
    id: "constellore.stellar-vanguard.word-plaque.vanguard-alloy",
    slug: "vanguard-alloy",
    slot: "wordPlaque",
    collectionId: "constellore.collection.stellar-vanguard",
    label: "Vanguard Alloy",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Plaque", "Space Opera"],
    description: "Obsidian alloy and restrained bronze geometry around a deep command display.",
    preview: { title: "Vanguard Alloy plaque", body: "Cinematic metalwork kept disciplined around the word and category edge." },
    recipe: { cssToken: "vanguard-alloy", surface: "command-alloy", edge: "ion" }
  }),
  item({
    id: "constellore.stellar-vanguard.trail-set.ion-crescent",
    slug: "ion-crescent",
    slot: "trailSet",
    collectionId: "constellore.collection.stellar-vanguard",
    label: "Ion Crescent",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Trail", "Space Opera"],
    description: "A blue-violet ion trace that closes in a narrow crescent flare.",
    preview: { title: "Ion Crescent", body: "Heroic motion with a precise edge and a compact ceremonial burst." },
    recipe: {
      cssToken: "ion-crescent",
      color: "#9ec8ff",
      secondary: "#9b7cff",
      width: 3.1,
      glow: 16,
      dragLifetimeMs: 470,
      burst: "crescent"
    }
  }),
  item({
    id: "constellore.stellar-vanguard.board-finish.command-deck",
    slug: "command-deck",
    slot: "boardFinish",
    collectionId: "constellore.collection.stellar-vanguard",
    label: "Command Deck",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Board", "Space Opera"],
    description: "Bronze meridians and restrained navigation geometry frame the Rank sky.",
    preview: { title: "Command Deck finish", body: "A cinematic tactical overlay that keeps every word path easy to parse." },
    recipe: { cssToken: "command-deck", overlay: "silent-meridian", blend: "screen" }
  }),
  item({
    id: "constellore.stellar-vanguard.home-scene.orbital-sanctuary",
    slug: "orbital-sanctuary",
    slot: "homeScene",
    collectionId: "constellore.collection.stellar-vanguard",
    label: "Orbital Sanctuary",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Home", "Space Opera"],
    description: "An obsidian-and-bronze sanctuary overlooks a luminous giant and distant crescent craft.",
    preview: { title: "Orbital Sanctuary background", body: "Grand original space-opera scale arranged around a quiet command center." },
    recipe: { cssToken: "orbital-sanctuary", treatment: "cinematic-command" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/stellar-vanguard/home-sm.webp",
        md: "/art/cosmetics/stellar-vanguard/home-md.webp",
        lg: "/art/cosmetics/stellar-vanguard/home-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.stellar-vanguard.gate-style.meridian-gate",
    slug: "meridian-gate",
    slot: "gateStyle",
    collectionId: "constellore.collection.stellar-vanguard",
    label: "Silent Meridian Gate",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Gate", "Space Opera"],
    description: "Floating alloy segments orbit a radiant singularity above a ceremonial causeway.",
    preview: { title: "Silent Meridian Gate", body: "A centered cinematic threshold with original architecture and familiar accessible timing." },
    recipe: { cssToken: "meridian-gate", seam: "ion-star", motion: "orbital" },
    assets: {
      responsive: {
        sm: "/art/cosmetics/stellar-vanguard/gate-sm.webp",
        md: "/art/cosmetics/stellar-vanguard/gate-md.webp",
        lg: "/art/cosmetics/stellar-vanguard/gate-lg.webp"
      }
    }
  }),
  item({
    id: "constellore.stellar-vanguard.ui-finish.command-alloy",
    slug: "command-alloy",
    slot: "uiFinish",
    collectionId: "constellore.collection.stellar-vanguard",
    label: "Command Alloy UI",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Interface", "Space Opera"],
    description: "Near-black command panels, bronze meridians, and cool ion focus lights.",
    preview: { title: "Command Alloy UI", body: "Epic material weight without changing the interface layout or interaction rules." },
    recipe: { cssToken: "command-alloy", material: "vanguard-alloy", accent: "#9ec8ff" }
  }),
  item({
    id: "constellore.stellar-vanguard.sound-theme.void-overture",
    slug: "void-overture",
    slot: "soundTheme",
    collectionId: "constellore.collection.stellar-vanguard",
    label: "Void Overture",
    access: "supporter",
    entitlement: "supporter",
    tags: ["Supporter", "Sound", "Space Opera"],
    description: "Synthetic brass, broad pads, ceremonial percussion, and Beyond the Silent Meridian.",
    preview: { title: "Void Overture", body: "An original 64-second cinematic score with weighty, repeatable command cues." },
    recipe: { cssToken: "void-overture", wave: "triangle", pitch: 0.82, gain: 0.92 },
    assets: {
      soundtrack: { path: "audio/stellar-vanguard/beyond-the-silent-meridian.mp3", title: "Beyond the Silent Meridian", duration: 64, gain: 0.38, previewAt: 20.8 },
      gameplayPulse: { path: "audio/stellar-vanguard/gameplay-pulse.mp3", duration: 64, gain: 0.38 },
      sfxBank: { path: "audio/stellar-vanguard/sfx-bank.mp3", duration: 33.6 }
    }
  }),

  item({
    id: "constellore.earned.cartographer.word-plaque",
    slug: "cartographer",
    slot: "wordPlaque",
    collectionId: null,
    label: "Cartographer",
    access: "earned",
    entitlement: "earned",
    tags: ["Earned", "Plaque"],
    description: "A field-map plaque awarded for recording 25 discoveries.",
    preview: { title: "Cartographer plaque", body: "Discover 25 unique words to chart this finish." },
    recipe: { cssToken: "cartographer", surface: "field-map", edge: "ink" },
    unlock: { key: "discoveries", minimum: 25 }
  }),
  item({
    id: "constellore.earned.first-light.trail-set",
    slug: "first-light",
    slot: "trailSet",
    collectionId: null,
    label: "First Light",
    access: "earned",
    entitlement: "earned",
    tags: ["Earned", "Trail"],
    description: "A sunrise-white thread awarded after the first completed real route.",
    preview: { title: "First Light trail", body: "Complete one real route to kindle this trail." },
    recipe: {
      cssToken: "first-light",
      color: "#fff2b8",
      secondary: "#f6a66a",
      width: 2.5,
      glow: 11,
      dragLifetimeMs: 420,
      burst: "sunrise"
    },
    unlock: { key: "wins", minimum: 1 }
  }),
  item({
    id: "constellore.earned.weekly-sigil.gate-style",
    slug: "weekly-sigil",
    slot: "gateStyle",
    collectionId: null,
    label: "Weekly Sigil",
    access: "earned",
    entitlement: "earned",
    tags: ["Earned", "Gate"],
    description: "A rotating expedition sigil set into the Atlas Doors.",
    preview: { title: "Weekly Sigil gate", body: "Complete a Weekly Expedition to engrave its sigil on the gate." },
    recipe: { cssToken: "weekly-sigil", seam: "sigil", motion: "hinged" },
    unlock: { key: "weeklyComplete", value: true }
  })
]);

export const DEFAULT_COSMETIC_LOADOUT = Object.freeze({
  ...COSMETIC_COLLECTIONS[0].preset
});

/**
 * Complete aliases for every cosmetics ID shipped before schema version 8.
 * The old theme choice also acts as a collection hint for the four new slots.
 */
export const LEGACY_COSMETIC_IDS = Object.freeze({
  void: "constellore.celestial-atlas.ui-finish.midnight-atlas",
  aurora: "constellore.aurora-archive.ui-finish.frostglass",
  solar: "constellore.solar-foundry.ui-finish.antique-brass",
  starlit: "constellore.celestial-atlas.board-finish.rank-sky",
  nebula: "constellore.aurora-archive.board-finish.nebula-glass",
  blueprint: "constellore.solar-foundry.board-finish.cosmic-blueprint",
  classic: "constellore.celestial-atlas.trail-set.classic-thread",
  prism: "constellore.aurora-archive.trail-set.aurora-ribbon",
  comet: "constellore.solar-foundry.trail-set.ember-comet",
  cosmic: "constellore.celestial-atlas.sound-theme.cosmic-chimes",
  glass: "constellore.aurora-archive.sound-theme.glass-orbit",
  analog: "constellore.solar-foundry.sound-theme.analog-stars"
});

export const LEGACY_COSMETIC_SLOTS = Object.freeze({
  theme: "uiFinish",
  board: "boardFinish",
  trail: "trailSet",
  sound: "soundTheme"
});

export const COSMETIC_MANIFEST = Object.freeze({
  schemaVersion: COSMETIC_SCHEMA_VERSION,
  namespace: "constellore",
  slots: COSMETIC_SLOTS,
  collections: COSMETIC_COLLECTIONS,
  items: COSMETIC_ITEMS,
  defaultLoadout: DEFAULT_COSMETIC_LOADOUT,
  legacyIds: LEGACY_COSMETIC_IDS,
  legacySlots: LEGACY_COSMETIC_SLOTS
});
