import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  PROFILE_FRAMES,
  profileFrameBySlug
} from "../public/profile-frame-catalog.mjs";
import {
  ARENA_DUEL_CARD_ART_HEIGHT,
  ARENA_DUEL_CARD_ART_WIDTH,
  createArenaDuelCard,
  normalizeArenaDuelCardModel,
  normalizeArenaDuelCardSide,
  normalizeArenaDuelCardStatus
} from "../public/arena-duel-card.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

class FakeStyle {
  values = new Map();

  setProperty(name, value) {
    this.values.set(name, String(value));
  }

  getPropertyValue(name) {
    return this.values.get(name) || "";
  }

  removeProperty(name) {
    this.values.delete(name);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.dataset = new Proxy({}, {
      set: (target, property, value) => {
        const normalized = String(value);
        target[property] = normalized;
        const suffix = String(property).replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
        this.attributes.set(`data-${suffix}`, normalized);
        return true;
      },
      deleteProperty: (target, property) => {
        delete target[property];
        const suffix = String(property).replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
        this.attributes.delete(`data-${suffix}`);
        return true;
      }
    });
    this.style = new FakeStyle();
    this.className = "";
    this.textContent = "";
    this.hidden = false;
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    const normalized = String(value);
    this.attributes.set(name, normalized);
    if (name.startsWith("data-")) {
      const property = name.slice(5).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      this.dataset[property] = normalized;
    }
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith("data-")) {
      const property = name.slice(5).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      delete this.dataset[property];
    }
  }

  set src(value) {
    this.setAttribute("src", value);
  }

  get src() {
    return this.getAttribute("src") || "";
  }

  addEventListener() {
    // The rendering contract only needs event registration to be accepted.
  }

  querySelector(selector) {
    const matches = (candidate) => {
      if (selector.startsWith(".")) {
        return candidate.className.split(/\s+/u).includes(selector.slice(1));
      }
      const dataMatch = selector.match(/^\[([a-z0-9-]+)\]$/iu);
      return dataMatch ? candidate.hasAttribute(dataMatch[1]) : false;
    };
    for (const child of this.children) {
      if (matches(child)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

const documentStub = Object.freeze({
  createElement(tagName) {
    return new FakeElement(tagName);
  }
});

function descendants(root) {
  return root.children.flatMap((child) => [child, ...descendants(child)]);
}

const percentage = (value) => `${(value * 100).toFixed(4)}%`;

function renderedFrameIslands(card) {
  return descendants(card.parts.artboard)
    .filter((node) => node.hasAttribute("data-arena-frame-island"));
}

function cssRule(styles, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`, "su"))?.[0] || "";
}

function percentageDeclaration(rule, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const value = rule.match(new RegExp(`${escaped}:\\s*(-?\\d+(?:[.]\\d+)?)%`, "u"))?.[1];
  assert.notEqual(value, undefined, `${property} needs a percentage value in ${rule}`);
  return Number(value);
}

function assertPartialFrameComposition(card, entry) {
  assert.equal(entry.layout, "partial");
  assert.equal(card.element.dataset.frameLayout, "partial");
  assert.equal(card.parts.art.hidden, true);
  assert.equal(
    card.parts.art.hasAttribute("src"),
    false,
    `${entry.slug} must not paint the raw master sheet behind its positioned islands`
  );

  const rendered = renderedFrameIslands(card);
  assert.equal(rendered.length, 3, `${entry.slug} must render its three catalog islands`);
  assert.deepEqual(
    new Set(rendered.map((node) => node.dataset.island)),
    new Set(entry.islands.map((island) => island.id)),
    `${entry.slug} must preserve every catalog island identity`
  );

  for (const island of entry.islands) {
    const node = rendered.find((candidate) => candidate.dataset.island === island.id);
    assert.ok(node, `${entry.slug} must render ${island.id}`);
    assert.equal(node.dataset.plane, island.plane);
    for (const edge of ["top", "right", "bottom", "left"]) {
      assert.equal(
        node.style.getPropertyValue(`--island-crop-${edge}`),
        percentage(island.crop[edge]),
        `${entry.slug} ${island.id} must preserve its ${edge} crop`
      );
    }
    assert.equal(node.style.getPropertyValue("--island-x"), percentage(island.placement.x));
    assert.equal(node.style.getPropertyValue("--island-y"), percentage(island.placement.y));

    const images = descendants(node).filter(({ tagName }) => tagName === "IMG");
    assert.equal(images.length, 1, `${entry.slug} ${island.id} must own one source image`);
    assert.match(
      images[0].getAttribute("src"),
      new RegExp(`/art/profile-frames/${entry.slug}[.]png$`, "u")
    );
  }
}

test("arena card normalizes bounded runtime-facing player data", () => {
  assert.equal(normalizeArenaDuelCardSide("right"), "rival");
  assert.equal(normalizeArenaDuelCardSide("home"), "self");
  assert.equal(normalizeArenaDuelCardStatus("won"), "winner");
  assert.equal(normalizeArenaDuelCardStatus("active"), "playing");

  const model = normalizeArenaDuelCardModel({
    player: {
      callsign: `  The\nNavigator ${"x".repeat(80)} `,
      rank: "Bronze",
      mark: "brnz",
      frameSlug: "berry-burrow"
    },
    side: "opponent",
    status: "ready",
    featured: true
  });
  assert.equal(model.callsign.length, 42);
  assert.equal(model.callsign.includes("\n"), false);
  assert.equal(model.rank, "Bronze");
  assert.equal(model.mark, "BRN");
  assert.equal(model.frameSlug, "berry-burrow");
  assert.equal(model.side, "rival");
  assert.equal(model.status, "ready");
  assert.equal(model.featured, true);

  assert.equal(
    normalizeArenaDuelCardModel({ player: { frameSlug: "hostile-frame" } }).frameSlug,
    "",
    "unknown network frame values must fail closed instead of selecting another cosmetic"
  );
});

test("arena duel card keeps identity outside one intact intrinsic 3:4 artwork", () => {
  const card = createArenaDuelCard({
    documentRef: documentStub,
    player: {
      callsign: "Wayfinder",
      rank: "Bronze · Rank 01",
      mark: "B",
      frameSlug: "berry-burrow"
    },
    side: "self",
    status: "ready"
  });

  assert.ok(card);
  assert.equal(card.element.className, "arena-duel-card");
  assert.equal(card.element.dataset.frame, "berry-burrow");
  assert.equal(card.element.dataset.side, "self");
  assert.equal(card.element.dataset.status, "ready");
  assert.equal(card.parts.art.getAttribute("width"), String(ARENA_DUEL_CARD_ART_WIDTH));
  assert.equal(card.parts.art.getAttribute("height"), String(ARENA_DUEL_CARD_ART_HEIGHT));
  assert.match(card.parts.art.getAttribute("src"), /\/art\/profile-frames\/berry-burrow[.]png$/u);
  assert.equal(card.parts.art.getAttribute("alt"), "");
  assert.equal(card.parts.art.getAttribute("aria-hidden"), "true");
  assert.equal(card.parts.callsign.textContent, "Wayfinder");
  assert.equal(card.parts.rank.textContent, "Bronze · Rank 01");
  assert.equal(card.parts.status.textContent, "Ready");
  assert.equal(card.parts.meta.parentElement, card.element);
  assert.equal(card.parts.artboard.parentElement, card.element);
  assert.notEqual(
    card.parts.meta.parentElement,
    card.parts.artboard,
    "identity metadata must be outside the artwork so ornate pixels cannot cover it"
  );

  const images = descendants(card.element).filter(({ tagName }) => tagName === "IMG");
  assert.equal(images.length, 1, "one frame must use exactly one complete source composition");

  card.sync({
    player: {
      callsign: "Rival Star",
      frameSlug: "not-in-the-catalog"
    },
    side: "right",
    status: "active",
    featured: true
  });
  assert.equal(card.element.dataset.side, "rival");
  assert.equal(card.element.dataset.status, "playing");
  assert.equal(card.element.dataset.featured, "true");
  assert.equal(card.element.dataset.frame, "none");
  assert.equal(card.parts.art.hidden, true);
  assert.equal(card.parts.art.hasAttribute("src"), false);
  assert.equal(card.parts.callsign.textContent, "Rival Star");
});

test("partial catalog frames render three positioned islands while full frames stay intact", () => {
  const card = createArenaDuelCard({ documentRef: documentStub });
  for (const entry of PROFILE_FRAMES) {
    assert.equal(card.selectFrame(entry.slug), entry.slug);
    assert.equal(card.element.dataset.frame, entry.slug);
    if (entry.layout === "partial") {
      assertPartialFrameComposition(card, entry);
      continue;
    }

    assert.equal(card.element.dataset.frameLayout, "frame");
    assert.equal(card.parts.art.hidden, false);
    assert.match(
      card.parts.art.getAttribute("src"),
      new RegExp(`/art/profile-frames/${entry.slug}[.]png$`, "u")
    );
    assert.equal(renderedFrameIslands(card).length, 0, `${entry.slug} must not create islands`);
    assert.equal(
      descendants(card.element).filter(({ tagName }) => tagName === "IMG").length,
      1,
      `${entry.slug} must keep one intact raster composition`
    );
  }
});

test("all twenty Arena frames preserve their authored aperture", () => {
  const card = createArenaDuelCard({
    documentRef: documentStub,
    player: { mark: "B" }
  });

  assert.equal(PROFILE_FRAMES.length, 20, "the geometry audit must cover the complete catalog");

  for (const entry of PROFILE_FRAMES) {
    card.selectFrame(entry.slug);

    for (const edge of ["top", "right", "bottom", "left"]) {
      assert.equal(
        card.parts.artboard.style.getPropertyValue(`--card-${edge}`),
        entry.fit[edge],
        `${entry.slug} must pass its authored ${edge} edge to the Arena plate`
      );
    }

  }

  card.selectFrame("");
  for (const property of ["--card-top", "--card-right", "--card-bottom", "--card-left"]) {
    assert.equal(
      card.parts.artboard.style.getPropertyValue(property),
      "",
      `clearing a frame must clear stale ${property} geometry`
    );
  }
});

test("Empyrean halo and Infernal crown honor their authored upward offsets", () => {
  const card = createArenaDuelCard({ documentRef: documentStub });
  for (const [slug, islandId, expectedPixelY] of [
    ["empyrean-ascension", "halo-beam", -820],
    ["infernal-dominion", "horned-crown", -865]
  ]) {
    const entry = profileFrameBySlug(slug);
    const catalogIsland = entry.islands.find((island) => island.id === islandId);
    assert.ok(catalogIsland, `${slug} must declare ${islandId}`);
    assert.equal(
      Math.round(catalogIsland.placement.y * ARENA_DUEL_CARD_ART_HEIGHT),
      expectedPixelY
    );

    card.selectFrame(slug);
    const renderedIsland = renderedFrameIslands(card)
      .find((node) => node.dataset.island === islandId);
    assert.ok(renderedIsland, `${slug} must render ${islandId}`);
    assert.equal(renderedIsland.dataset.plane, "card");
    assert.equal(renderedIsland.style.getPropertyValue("--island-x"), "0.0000%");
    assert.equal(
      renderedIsland.style.getPropertyValue("--island-y"),
      percentage(catalogIsland.placement.y)
    );
    assert.ok(
      Number.parseFloat(renderedIsland.style.getPropertyValue("--island-y")) < -50,
      `${slug} ${islandId} must move from the master-sheet bottom to the card crown`
    );
  }
});

test("full and partial frames keep the avatar sigil inside the fitted orbital plate", () => {
  const card = createArenaDuelCard({
    documentRef: documentStub,
    player: { mark: "B" }
  });

  for (const slug of ["berry-burrow", "empyrean-ascension"]) {
    const entry = profileFrameBySlug(slug);
    assert.ok(entry, `${slug} must remain in the frame catalog`);
    card.selectFrame(slug);
    assert.equal(card.element.dataset.frameLayout, entry.layout);
    assert.equal(
      card.parts.plate.parentElement,
      card.parts.artboard,
      `${slug} must keep its orbital ring in the shared artboard`
    );
    assert.equal(
      card.parts.sigil.parentElement,
      card.parts.plate,
      `${slug} must center the avatar sigil inside the fitted plate`
    );
    assert.equal(
      card.parts.sigil.style.getPropertyValue("top"),
      "",
      `${slug} must not apply a frame-specific vertical avatar offset`
    );
    assert.equal(
      card.parts.sigil.style.getPropertyValue("--arena-duel-sigil-center"),
      "",
      `${slug} must not override the shared orbital center inline`
    );
  }
});

test("the authored plate aperture and avatar share one visual center", async () => {
  const styles = await readFile(
    path.join(projectRoot, "public/arena-duel-card.css"),
    "utf8"
  );
  const artboardRule = cssRule(styles, ".arena-duel-card__artboard");
  const plateRule = cssRule(styles, ".arena-duel-card__plate");
  const orbitRule = cssRule(styles, ".arena-duel-card__plate::before");
  const sigilRule = cssRule(styles, ".arena-duel-card__sigil");
  assert.ok(artboardRule, "the shared artboard geometry must remain explicit");
  assert.ok(plateRule, "the shared plate geometry must remain explicit");
  assert.ok(orbitRule, "the decorative orbit geometry must remain explicit");
  assert.ok(sigilRule, "the avatar sigil geometry must remain explicit");

  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.match(
      plateRule,
      new RegExp(`var\\(--card-${edge},`, "u"),
      `the Arena plate must consume the authored ${edge} edge`
    );
  }
  assert.doesNotMatch(
    plateRule,
    /inset:\s*8[.]5%/u,
    "the Arena plate must not replace authored frame fits with one fixed inset"
  );

  assert.equal(percentageDeclaration(orbitRule, "inset"), 50);
  assert.match(
    orbitRule,
    /translate:\s*-50%\s+-50%/u,
    "the orbit must remain centered inside the authored plate aperture"
  );
  assert.match(
    sigilRule,
    /inset:\s*50%\s+auto\s+auto\s+50%/u,
    "the avatar must center itself inside the authored aperture"
  );
  assert.match(
    sigilRule,
    /translate:\s*-50%\s+-50%/u,
    "the sigil inset must describe its center rather than its top edge"
  );
});

test("arena duel card CSS preserves the source aspect and pointer-safe content separation", async () => {
  const [runtime, styles] = await Promise.all([
    readFile(path.join(projectRoot, "public/arena-duel-card.mjs"), "utf8"),
    readFile(path.join(projectRoot, "public/arena-duel-card.css"), "utf8")
  ]);

  assert.match(runtime, /createArenaDuelCard/);
  assert.match(runtime, /player/);
  assert.match(runtime, /frameSlug/);
  assert.match(runtime, /featured/);
  assert.match(runtime, /ARENA_DUEL_CARD_ART_WIDTH = 1086/);
  assert.match(runtime, /ARENA_DUEL_CARD_ART_HEIGHT = 1448/);
  assert.match(runtime, /data-arena-frame-island/);
  assert.match(runtime, /entry[.]layout\s*[!=]==?\s*"partial"/);

  assert.match(
    styles,
    /[.]arena-duel-card__artboard\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*4/su
  );
  assert.match(
    styles,
    /[.]arena-duel-card__art\s*\{[^}]*width:\s*100%[^}]*height:\s*auto/su
  );
  assert.match(
    styles,
    /[.]arena-duel-card__art\s*\{[^}]*pointer-events:\s*none/su
  );
  const artRule = styles.match(/[.]arena-duel-card__art\s*\{[^}]*\}/su)?.[0] || "";
  assert.ok(artRule, "the intact frame source needs an explicit CSS rule");
  assert.doesNotMatch(
    artRule,
    /object-fit|clip-path|mask|border-image|scale\s*:/u,
    "the full-frame raster must never be cropped, sliced, masked, or independently stretched"
  );
  assert.match(styles, /--island-x/);
  assert.match(styles, /--island-y/);
  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.match(styles, new RegExp(`--island-crop-${edge}`, "u"));
  }
  assert.match(styles, /[.]arena-duel-card__meta\s*\{/u);
  assert.doesNotMatch(
    styles,
    /[.]arena-duel-card__meta\s*\{[^}]*position:\s*absolute/su,
    "callsign, rank, mark, and status must remain outside the artwork's stacking plane"
  );
});
