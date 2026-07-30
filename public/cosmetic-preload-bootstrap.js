(() => {
  "use strict";
  const manifest = document.querySelector('link[rel="manifest"]');
  if (!manifest) return;
  const localRuntime = String(manifest.getAttribute("href") || "").startsWith("./");
  const record = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const packs = {
    celestial: {
      c: "constellore.collection.celestial-atlas",
      h: ["constellore.celestial-atlas.home-scene.deep-sky-observatory", "deep-sky-observatory"],
      g: ["constellore.celestial-atlas.gate-style.atlas-doors", "constellore.earned.weekly-sigil.gate-style", "atlas-doors", "weekly-sigil"],
      home: ["art/home/home-cosmos-v1-portrait.webp", "art/home/home-cosmos-v1-md.webp", "art/home/home-cosmos-v1-lg.webp"],
      gate: ["art/transitions/cosmic-gate-v2-portrait.webp", "art/transitions/cosmic-gate-v2-md.webp", "art/transitions/cosmic-gate-v2-lg.webp"]
    },
    aurora: {
      c: "constellore.collection.aurora-archive",
      d: "aurora-archive",
      s: 1,
      h: ["constellore.aurora-archive.home-scene.aurora-observatory", "aurora-observatory"],
      g: ["constellore.aurora-archive.gate-style.crystal-archive", "crystal-archive"]
    },
    solar: {
      c: "constellore.collection.solar-foundry",
      d: "solar-foundry",
      s: 1,
      h: ["constellore.solar-foundry.home-scene.solar-orrery", "solar-orrery"],
      g: ["constellore.solar-foundry.gate-style.foundry-doors", "foundry-doors"]
    },
    lunar: {
      c: "constellore.collection.lunar-garden",
      d: "lunar-garden",
      s: 1,
      h: ["constellore.lunar-garden.home-scene.lunar-garden", "lunar-garden"],
      g: ["constellore.lunar-garden.gate-style.moon-garden", "moon-garden"]
    },
    eclipse: {
      c: "constellore.collection.eclipse-sovereign",
      d: "eclipse-sovereign",
      s: 1,
      h: ["constellore.eclipse-sovereign.home-scene.eclipse-throne", "eclipse-throne"],
      g: ["constellore.eclipse-sovereign.gate-style.sovereign-eclipse", "sovereign-eclipse"]
    },
    pixel: {
      c: "constellore.collection.pixel-frontier",
      d: "pixel-frontier",
      s: 1,
      h: ["constellore.pixel-frontier.home-scene.bit-observatory", "bit-observatory"],
      g: ["constellore.pixel-frontier.gate-style.warp-gate", "warp-gate"]
    },
    reef: {
      c: "constellore.collection.bubble-reef",
      d: "bubble-reef",
      s: 1,
      h: ["constellore.bubble-reef.home-scene.reef-observatory", "reef-observatory"],
      g: ["constellore.bubble-reef.gate-style.pearl-current", "pearl-current"]
    },
    vanguard: {
      c: "constellore.collection.stellar-vanguard",
      d: "stellar-vanguard",
      s: 1,
      h: ["constellore.stellar-vanguard.home-scene.orbital-sanctuary", "orbital-sanctuary"],
      g: ["constellore.stellar-vanguard.gate-style.meridian-gate", "meridian-gate"]
    }
  };
  const media = {
    home: [
      "(orientation: portrait), (max-aspect-ratio: 6/5)",
      "(orientation: landscape) and (aspect-ratio > 6/5) and (width < 900px), (orientation: landscape) and (aspect-ratio > 6/5) and (900px <= width < 2200px) and (resolution < 1.5dppx)",
      "(orientation: landscape) and (aspect-ratio > 6/5) and (width >= 2200px), (orientation: landscape) and (aspect-ratio > 6/5) and (width >= 900px) and (resolution >= 1.5dppx)"
    ],
    gate: [
      "(orientation: portrait)",
      "(orientation: landscape) and (width < 900px), (orientation: landscape) and (900px <= width < 2200px) and (resolution < 1.5dppx)",
      "(orientation: landscape) and (width >= 2200px), (orientation: landscape) and (width >= 900px) and (resolution >= 1.5dppx)"
    ]
  };
  let profile = {};
  try {
    const keys = localRuntime
      ? ["constellore-local-profile-v1"]
      : ["constellore-profile-v1", "wordforge-profile-v3", "wordforge-profile-v2"];
    for (const key of keys) {
      const candidate = localStorage.getItem(key);
      if (!candidate) continue;
      const parsed = JSON.parse(candidate);
      if (record(parsed)) profile = parsed;
      break;
    }
  } catch {
    profile = {};
  }
  const raw = record(profile.cosmetics) ? profile.cosmetics : {};
  const loadout = record(raw.loadout) ? raw.loadout : raw;
  const legacyTheme = String(loadout.theme || profile.theme || "");
  const legacyPack = ["aurora", "constellore.aurora-archive.ui-finish.frostglass"].includes(legacyTheme)
    ? "aurora"
    : ["solar", "constellore.solar-foundry.ui-finish.antique-brass"].includes(legacyTheme)
      ? "solar"
      : "celestial";
  const packNames = Object.keys(packs);
  const selectedPack = (slot) => {
    const value = String(loadout[slot] || "");
    const key = slot === "homeScene" ? "h" : "g";
    return packNames.find((name) => packs[name][key].includes(value)) || legacyPack;
  };
  const ownership = record(profile.cosmeticOwnership) ? profile.cosmeticOwnership : {};
  const collections = Array.isArray(ownership.collections) ? ownership.collections : [];
  const items = Array.isArray(ownership.items) ? ownership.items : [];
  const mayUse = (name, scene) => {
    const pack = packs[name];
    const key = scene === "home" ? "h" : "g";
    return name === "celestial"
      || localRuntime
      || pack.s && (profile.premium === true || ownership.supporter === true)
      || collections.includes(pack.c)
      || items.includes(pack[key][0]);
  };
  const paths = (pack, scene) => pack[scene]
    || ["sm", "md", "lg"].map((size) => `art/cosmetics/${pack.d}/${scene}-${size}.webp`);
  const appendSet = (scene, requested) => {
    const name = mayUse(requested, scene) ? requested : "celestial";
    const base = new URL(".", manifest.href);
    paths(packs[name], scene).forEach((path, index) => {
      const preload = document.createElement("link");
      preload.rel = "preload";
      preload.as = "image";
      preload.type = "image/webp";
      preload.media = media[scene][index];
      preload.href = new URL(path, base).href;
      preload.fetchPriority = "high";
      preload.setAttribute("fetchpriority", "high");
      preload.dataset.scenePreload = scene;
      preload.dataset.scenePack = name;
      document.head.appendChild(preload);
    });
  };
  appendSet("gate", selectedPack("gateStyle"));
  appendSet("home", selectedPack("homeScene"));
})();
