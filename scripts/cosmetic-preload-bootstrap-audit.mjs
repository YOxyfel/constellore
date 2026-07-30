import assert from "node:assert/strict";
import vm from "node:vm";

const optionalScenePaths = (slug) => Object.freeze({
  home: Object.freeze(["sm", "md", "lg"].map((size) => `art/cosmetics/${slug}/home-${size}.webp`)),
  gate: Object.freeze(["sm", "md", "lg"].map((size) => `art/cosmetics/${slug}/gate-${size}.webp`))
});

export const SCENE_PRELOAD_PATHS = Object.freeze({
  celestial: Object.freeze({
    home: Object.freeze([
      "art/home/home-cosmos-v1-portrait.webp",
      "art/home/home-cosmos-v1-md.webp",
      "art/home/home-cosmos-v1-lg.webp"
    ]),
    gate: Object.freeze([
      "art/transitions/cosmic-gate-v2-portrait.webp",
      "art/transitions/cosmic-gate-v2-md.webp",
      "art/transitions/cosmic-gate-v2-lg.webp"
    ])
  }),
  aurora: optionalScenePaths("aurora-archive"),
  solar: optionalScenePaths("solar-foundry"),
  lunar: optionalScenePaths("lunar-garden"),
  eclipse: optionalScenePaths("eclipse-sovereign"),
  pixel: optionalScenePaths("pixel-frontier"),
  reef: optionalScenePaths("bubble-reef"),
  vanguard: optionalScenePaths("stellar-vanguard")
});

export const SCENE_PRELOAD_MEDIA = Object.freeze({
  home: Object.freeze([
    "(orientation: portrait), (max-aspect-ratio: 6/5)",
    "(orientation: landscape) and (aspect-ratio > 6/5) and (width < 900px), (orientation: landscape) and (aspect-ratio > 6/5) and (900px <= width < 2200px) and (resolution < 1.5dppx)",
    "(orientation: landscape) and (aspect-ratio > 6/5) and (width >= 2200px), (orientation: landscape) and (aspect-ratio > 6/5) and (width >= 900px) and (resolution >= 1.5dppx)"
  ]),
  gate: Object.freeze([
    "(orientation: portrait)",
    "(orientation: landscape) and (width < 900px), (orientation: landscape) and (900px <= width < 2200px) and (resolution < 1.5dppx)",
    "(orientation: landscape) and (width >= 2200px), (orientation: landscape) and (width >= 900px) and (resolution >= 1.5dppx)"
  ])
});

export function cosmeticPreloadBootstrapReference(html) {
  const document = String(html || "");
  const match = document.match(
    /<script\b(?=[^>]*\bdata-cosmetic-preload-bootstrap\b)([^>]*)>([\s\S]*?)<\/script>/i
  );
  assert.ok(match, "The document is missing the early cosmetic preload bootstrap.");
  const src = match[1].match(/\bsrc="([^"]+)"/i)?.[1];
  assert.ok(src, "The early cosmetic preload bootstrap must be an external same-origin script.");
  assert.equal(match[2].trim(), "", "The external cosmetic preload bootstrap tag must not contain inline script.");
  assert.match(src, /^(?:\/|[.]\/)cosmetic-preload-bootstrap[.]js[?]v=[0-9A-Za-z.-]+$/, "The cosmetic preload bootstrap must use a portable, versioned same-origin URL.");
  assert.doesNotMatch(match[1], /\b(?:async|defer)\b|\btype="module"/i, "The cosmetic preload bootstrap must remain parser-blocking so it can issue preloads before styles execute.");
  const firstStylesheetIndex = document.search(/<link\b(?=[^>]*\brel="stylesheet")[^>]*>/i);
  assert.ok(firstStylesheetIndex < 0 || match.index < firstStylesheetIndex, "The cosmetic preload bootstrap must execute before the first stylesheet.");
  return Object.freeze({ src, tag: match[0], index: match.index });
}

export function cosmeticPreloadBootstrapSource(html, externalSource) {
  cosmeticPreloadBootstrapReference(html);
  const source = String(externalSource || "");
  assert.ok(source.trim(), "The external cosmetic preload bootstrap source is missing.");
  return source;
}

function manifestPathFromHtml(html) {
  const href = String(html || "").match(/<link\b(?=[^>]*\brel="manifest")[^>]*\bhref="([^"]+)"/i)?.[1];
  assert.ok(href, "The document is missing its manifest base URL.");
  return href;
}

function staticImagePreloads(html) {
  return [...String(html || "").matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => /\brel="preload"/i.test(tag) && /\bas="image"/i.test(tag));
}

export function runCosmeticPreloadBootstrap(html, {
  bootstrapSource,
  pageHref = "https://example.test/play/",
  manifestPath = manifestPathFromHtml(html),
  storage = {}
} = {}) {
  const source = cosmeticPreloadBootstrapSource(html, bootstrapSource);
  const links = [];
  const resolvedManifestHref = new URL(manifestPath, pageHref).href;
  const document = {
    querySelector(selector) {
      if (selector !== 'link[rel="manifest"]') return null;
      return {
        href: resolvedManifestHref,
        getAttribute(name) {
          return name === "href" ? manifestPath : null;
        }
      };
    },
    createElement(tagName) {
      assert.equal(tagName, "link", "The preload bootstrap may only create link elements.");
      return {
        dataset: {},
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = String(value);
        }
      };
    },
    head: {
      appendChild(node) {
        links.push(node);
        return node;
      }
    }
  };
  const localStorage = {
    getItem(key) {
      const value = storage[key];
      return value == null ? null : String(value);
    }
  };

  vm.runInNewContext(source, { document, localStorage, URL }, {
    filename: "cosmetic-preload-bootstrap.js",
    timeout: 1_000
  });
  return Object.freeze({
    links: Object.freeze(links),
    baseHref: new URL(".", resolvedManifestHref).href,
    manifestPath,
    source
  });
}

export function assertScenePreloadSet(result, scene, pack) {
  const links = result.links.filter((link) => link.dataset.scenePreload === scene);
  assert.equal(links.length, 3, `The bootstrap must declare exactly one responsive ${scene} set.`);
  assert.deepEqual(
    links.map((link) => link.dataset.scenePack),
    [pack, pack, pack],
    `The bootstrap mixed ${scene} packs and can trigger duplicate artwork downloads.`
  );
  assert.deepEqual(
    links.map((link) => link.href),
    SCENE_PRELOAD_PATHS[pack][scene].map((path) => new URL(path, result.baseHref).href),
    `The bootstrap selected the wrong ${scene} artwork.`
  );
  assert.deepEqual(
    links.map((link) => link.media),
    SCENE_PRELOAD_MEDIA[scene],
    `The bootstrap weakened the responsive ${scene} media contract.`
  );
  for (const link of links) {
    assert.equal(link.rel, "preload");
    assert.equal(link.as, "image");
    assert.equal(link.type, "image/webp");
    assert.equal(link.fetchPriority, "high");
    assert.equal(link.attributes.fetchpriority, "high");
  }
}

export function assertAdaptiveScenePreloadContract(html, {
  bootstrapSource,
  pageHref = "https://example.test/play/",
  manifestPath = manifestPathFromHtml(html)
} = {}) {
  assert.deepEqual(staticImagePreloads(html), [], "Static image preloads can fetch Celestial art before the saved cosmetic is known.");
  const source = cosmeticPreloadBootstrapSource(html, bootstrapSource);
  assert.doesNotMatch(source, /\beval\s*\(|\bFunction\s*\(|[.]innerHTML\b|document[.]write\s*\(/, "The early preload bootstrap uses a CSP-hostile execution or HTML injection primitive.");

  const run = (options) => runCosmeticPreloadBootstrap(html, { bootstrapSource, ...options });
  const assertGateFirst = (result) => assert.deepEqual(
    result.links.map((link) => link.dataset.scenePreload),
    ["gate", "gate", "gate", "home", "home", "home"],
    "Gate preloads must be appended before Home preloads so the opening-door first paint wins."
  );
  const defaultResult = run({ pageHref, manifestPath, storage: {} });
  assertGateFirst(defaultResult);
  assertScenePreloadSet(defaultResult, "home", "celestial");
  assertScenePreloadSet(defaultResult, "gate", "celestial");

  const localAurora = JSON.stringify({
    cosmetics: {
      homeScene: "constellore.aurora-archive.home-scene.aurora-observatory",
      gateStyle: "constellore.aurora-archive.gate-style.crystal-archive"
    }
  });
  const auroraResult = run({
    pageHref,
    manifestPath: "./manifest.webmanifest",
    storage: { "constellore-local-profile-v1": localAurora }
  });
  assertGateFirst(auroraResult);
  assertScenePreloadSet(auroraResult, "home", "aurora");
  assertScenePreloadSet(auroraResult, "gate", "aurora");

  const localLegacySolar = JSON.stringify({ theme: "solar", cosmetics: { theme: "solar" } });
  const solarResult = run({
    pageHref,
    manifestPath: "./manifest.webmanifest",
    storage: { "constellore-local-profile-v1": localLegacySolar }
  });
  assertGateFirst(solarResult);
  assertScenePreloadSet(solarResult, "home", "solar");
  assertScenePreloadSet(solarResult, "gate", "solar");

  const localNewProfiles = [
    {
      pack: "lunar",
      homeScene: "constellore.lunar-garden.home-scene.lunar-garden",
      gateStyle: "constellore.lunar-garden.gate-style.moon-garden"
    },
    {
      pack: "eclipse",
      homeScene: "constellore.eclipse-sovereign.home-scene.eclipse-throne",
      gateStyle: "constellore.eclipse-sovereign.gate-style.sovereign-eclipse"
    },
    {
      pack: "pixel",
      homeScene: "constellore.pixel-frontier.home-scene.bit-observatory",
      gateStyle: "constellore.pixel-frontier.gate-style.warp-gate"
    },
    {
      pack: "reef",
      homeScene: "constellore.bubble-reef.home-scene.reef-observatory",
      gateStyle: "constellore.bubble-reef.gate-style.pearl-current"
    },
    {
      pack: "vanguard",
      homeScene: "constellore.stellar-vanguard.home-scene.orbital-sanctuary",
      gateStyle: "constellore.stellar-vanguard.gate-style.meridian-gate"
    }
  ].map(({ pack, homeScene, gateStyle }) => {
    const result = run({
      pageHref,
      manifestPath: "./manifest.webmanifest",
      storage: {
        "constellore-local-profile-v1": JSON.stringify({ cosmetics: { homeScene, gateStyle } })
      }
    });
    assertGateFirst(result);
    assertScenePreloadSet(result, "home", pack);
    assertScenePreloadSet(result, "gate", pack);
    return result;
  });

  const supporterLunar = JSON.stringify({
    cosmetics: {
      homeScene: "constellore.lunar-garden.home-scene.lunar-garden",
      gateStyle: "constellore.lunar-garden.gate-style.moon-garden"
    },
    cosmeticOwnership: { supporter: true }
  });
  const supporterLunarResult = run({
    pageHref,
    manifestPath: "/manifest.webmanifest",
    storage: { "constellore-profile-v1": supporterLunar }
  });
  assertGateFirst(supporterLunarResult);
  assertScenePreloadSet(supporterLunarResult, "home", "lunar");
  assertScenePreloadSet(supporterLunarResult, "gate", "lunar");

  const explicitEclipse = JSON.stringify({
    cosmetics: {
      homeScene: "constellore.eclipse-sovereign.home-scene.eclipse-throne",
      gateStyle: "constellore.eclipse-sovereign.gate-style.sovereign-eclipse"
    },
    cosmeticOwnership: {
      collections: ["constellore.collection.eclipse-sovereign"]
    }
  });
  const explicitEclipseResult = run({
    pageHref,
    manifestPath: "/manifest.webmanifest",
    storage: { "constellore-profile-v1": explicitEclipse }
  });
  assertGateFirst(explicitEclipseResult);
  assertScenePreloadSet(explicitEclipseResult, "home", "eclipse");
  assertScenePreloadSet(explicitEclipseResult, "gate", "eclipse");

  const mixedServerProfile = JSON.stringify({
    cosmetics: {
      homeScene: "constellore.aurora-archive.home-scene.aurora-observatory",
      gateStyle: "constellore.solar-foundry.gate-style.foundry-doors"
    },
    cosmeticOwnership: {
      items: [
        "constellore.aurora-archive.home-scene.aurora-observatory",
        "constellore.solar-foundry.gate-style.foundry-doors"
      ]
    }
  });
  const mixedResult = run({
    pageHref,
    manifestPath: "/manifest.webmanifest",
    storage: { "constellore-profile-v1": mixedServerProfile }
  });
  assertGateFirst(mixedResult);
  assertScenePreloadSet(mixedResult, "home", "aurora");
  assertScenePreloadSet(mixedResult, "gate", "solar");

  const newMixedServerProfile = JSON.stringify({
    cosmetics: {
      homeScene: "constellore.lunar-garden.home-scene.lunar-garden",
      gateStyle: "constellore.eclipse-sovereign.gate-style.sovereign-eclipse"
    },
    cosmeticOwnership: {
      items: [
        "constellore.lunar-garden.home-scene.lunar-garden",
        "constellore.eclipse-sovereign.gate-style.sovereign-eclipse"
      ]
    }
  });
  const newMixedResult = run({
    pageHref,
    manifestPath: "/manifest.webmanifest",
    storage: { "constellore-profile-v1": newMixedServerProfile }
  });
  assertGateFirst(newMixedResult);
  assertScenePreloadSet(newMixedResult, "home", "lunar");
  assertScenePreloadSet(newMixedResult, "gate", "eclipse");

  const lockedEclipse = JSON.stringify({
    cosmetics: {
      homeScene: "constellore.eclipse-sovereign.home-scene.eclipse-throne",
      gateStyle: "constellore.lunar-garden.gate-style.moon-garden"
    }
  });
  const unownedResult = run({
    pageHref,
    manifestPath: "/manifest.webmanifest",
    storage: { "constellore-profile-v1": lockedEclipse }
  });
  assertGateFirst(unownedResult);
  assertScenePreloadSet(unownedResult, "home", "celestial");
  assertScenePreloadSet(unownedResult, "gate", "celestial");
  assert.equal(unownedResult.links.some((link) => link.href.includes("/art/cosmetics/")), false, "A tampered server profile can preload locked cosmetic pack art.");

  assert.equal(defaultResult.links.length, 6);
  assert.equal(auroraResult.links.length, 6);
  assert.equal(solarResult.links.length, 6);
  for (const result of localNewProfiles) assert.equal(result.links.length, 6);
  assert.equal(supporterLunarResult.links.length, 6);
  assert.equal(explicitEclipseResult.links.length, 6);
  assert.equal(mixedResult.links.length, 6);
  assert.equal(newMixedResult.links.length, 6);
  assert.equal(unownedResult.links.length, 6);
  return true;
}
