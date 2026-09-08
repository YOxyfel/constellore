import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createCosmeticsObservatoryHost } from "../public/cosmetic-world-preview.mjs";
import { PROFILE_FRAMES, profileFrameBySlug } from "../public/profile-frame-catalog.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const renderer = await readFile(new URL("../public/cosmetics.css", import.meta.url), "utf8");
const loader = await readFile(new URL("../public/secondary-surface-loader.mjs", import.meta.url), "utf8");
const previewHost = await readFile(new URL("../public/cosmetic-world-preview.mjs", import.meta.url), "utf8");
const previewStyles = await readFile(new URL("../public/cosmetic-world-preview.css", import.meta.url), "utf8");
const observatoryFullPageStyles = await readFile(new URL("../public/cosmetics-observatory-full-page.css", import.meta.url), "utf8");
const profileFrameStyles = await readFile(new URL("../public/profile-rank-frame.css", import.meta.url), "utf8");

class PreviewTestStyle {
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

class PreviewTestElement {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = new PreviewTestStyle();
    this.className = "";
    this.textContent = "";
    this.hidden = false;
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
    const normalizedName = String(name).toLowerCase();
    const normalizedValue = String(value);
    this.attributes.set(normalizedName, normalizedValue);
    if (normalizedName.startsWith("data-")) {
      const property = normalizedName
        .slice(5)
        .replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      this.dataset[property] = normalizedValue;
    }
    if (normalizedName === "tabindex") this.tabIndex = Number(normalizedValue);
  }

  getAttribute(name) {
    const normalizedName = String(name).toLowerCase();
    return this.attributes.has(normalizedName) ? this.attributes.get(normalizedName) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(String(name).toLowerCase());
  }

  removeAttribute(name) {
    const normalizedName = String(name).toLowerCase();
    this.attributes.delete(normalizedName);
    if (normalizedName.startsWith("data-")) {
      const property = normalizedName
        .slice(5)
        .replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      delete this.dataset[property];
    }
  }

  addEventListener(type, callback) {
    this.listeners.set(String(type), callback);
  }

  dispatchEvent(event) {
    this.listeners.get(String(event?.type))?.call(this, event);
    return true;
  }

  set src(value) {
    this.setAttribute("src", value);
  }

  get src() {
    return this.getAttribute("src") || "";
  }
}

function previewFactoryFixture({
  cosmeticEffects = "full",
  reducedMotion = false,
  reducedData = false,
  saveData = false,
  bodySaveData = false
} = {}) {
  const created = [];
  const body = new PreviewTestElement("body");
  if (bodySaveData) body.dataset.saveData = "true";
  const documentRef = {
    activeElement: null,
    body,
    createElement(tagName) {
      const node = new PreviewTestElement(tagName);
      created.push(node);
      return node;
    },
    getElementById() {
      return null;
    }
  };
  const windowRef = {
    addEventListener() {},
    navigator: { connection: { saveData } },
    matchMedia(query) {
      return {
        matches: query === "(prefers-reduced-motion: reduce)"
          ? reducedMotion
          : query === "(prefers-reduced-data: reduce)" && reducedData
      };
    }
  };
  let observatoryOptions = null;
  createCosmeticsObservatoryHost({
    documentRef,
    windowRef,
    createObservatory(options) {
      observatoryOptions = options;
      return { open() {} };
    },
    getProfile: () => ({
      callsign: "Stage Tester",
      cosmeticEffects
    }),
    sanitizeCosmeticEffects: (value) => (
      ["full", "reduced", "off"].includes(value) ? value : "full"
    )
  });
  return {
    created,
    createPreview: observatoryOptions.createProfileFramePreview
  };
}

function descendants(root) {
  return root.children.flatMap((child) => [child, ...descendants(child)]);
}

test("the canonical loadout is applied before the opening gate is created", () => {
  const applyAt = app.indexOf("applyCosmeticLoadout();");
  const gateAt = app.indexOf("const cosmicGate = createCosmicGate");
  assert.ok(applyAt >= 0 && gateAt >= 0 && applyAt < gateAt);
  assert.match(app, /function ensureCosmeticsObservatoryHost\(\)/);
  assert.match(app, /createLazyCosmeticsObservatoryHost\(\{/);
  assert.doesNotMatch(app, /from "[.]\/cosmetics-observatory[.]mjs/);
  assert.match(loader, /import\("[.]\/cosmetics-observatory[.]mjs\?/);
  assert.match(loader, /import\("[.]\/cosmetic-world-preview[.]mjs\?/);
  assert.match(app, /collectionForCosmeticLoadout\(profile[.]cosmetics\)[?][.]slug \|\| "custom"/);
});

test("movement trails and fusion bursts run through the bounded canvas renderer", () => {
  assert.match(app, /from "[.]\/cosmetic-canvas[.]mjs\?/);
  assert.equal((app.match(/appendCosmeticDragTrail\(state, moveEvent, els[.]board\)/g) || []).length, 2);
  assert.match(app, /appendCosmeticFusionBurst\(state, resultAnchor[.]x, resultAnchor[.]y\)/);
  assert.match(app, /startCosmosCanvas\(\{/);
  assert.match(app, /measuredNodeAnchor\(/);
});

test("online cosmetics keep server ownership while current Route Rank refreshes collection rewards immediately", () => {
  const ownership = app.slice(
    app.indexOf("function cosmeticOwnershipOptions"),
    app.indexOf("function sanitizeCosmeticEffects")
  );
  assert.match(ownership, /const routeRank = currentRouteRank\(\)[?][.]rank/);
  assert.match(ownership, /const localEarnedProgress = isStaticBeta/);
  assert.match(ownership, /\["earth", "water", "fire", "air"\][.]includes\(inventoryKey\(word\)\)/);
  assert.match(ownership, /weekly: profile[.]weekly,\s*routeRank/);
  assert.match(ownership, /: \{ routeRank \}/);
  assert.match(ownership, /earnedIds: remote[.]earned/);
  assert.match(ownership, /progress: localEarnedProgress/);
  assert.match(previewHost, /collection[?][.]purchaseOnly\s*[?]\s*"Purchase only"/);
  assert.match(previewHost, /collection[?][.]rankUnlock\s*[?]\s*"Rank reward"/);
  assert.match(previewHost, /collection[?][.]unlockHint \|\| ""/);
});

test("the canonical collection-family registry and collection style metadata reach the Observatory", () => {
  assert.match(
    previewHost,
    /import \{\s*COSMETIC_COLLECTION_FAMILIES,\s*COSMETIC_COLLECTIONS,/
  );
  assert.match(previewHost, /collectionFamilies:\s*COSMETIC_COLLECTION_FAMILIES/);
  assert.match(previewHost, /collections:\s*COSMETIC_COLLECTIONS/);
  assert.match(previewHost, /collectionFamily:\s*collection[?][.]collectionFamily \|\| ""/);
  assert.match(previewHost, /styleLabel:\s*collection[?][.]styleLabel \|\| ""/);
  assert.match(previewHost, /createObservatory\(observatoryOptions\)/);
});

test("Arena frames are equipped in the Lab without entering cosmetic kits", () => {
  assert.match(previewHost, /profileFrames:\s*PROFILE_FRAMES/);
  assert.match(previewHost, /getProfileFrame:\s*\(\) => readStoredProfileFrame\(\)/);
  assert.match(previewHost, /createProfileFramePreview:\s*\(slug, entry\)/);
  assert.match(previewHost, /onProfileFrameCommit:\s*\(slug, meta\)/);
  assert.match(previewHost, /equipProfileFrame\(slug,\s*\{/);
  assert.match(previewHost, /arena_frame_changed/);
  assert.match(previewHost, /createArenaDuelCard/);
  assert.match(previewHost, /slotOrder:\s*COSMETIC_SLOTS/);
  assert.doesNotMatch(previewHost, /current[.]cosmetics[.]profileFrame/);
  assert.doesNotMatch(previewHost, /COSMETIC_SLOTS[.]push|COSMETIC_SLOTS\s*=\s*\[[^\]]*profileFrame/);
});

test("eligible frame video is a stage-level backdrop instead of Arena-card content", () => {
  const { createPreview } = previewFactoryFixture();
  const entry = profileFrameBySlug("empyrean-ascension");
  const preview = createPreview(entry.slug, entry);
  const livePreview = preview.element;

  assert.equal(livePreview.className, "cosmetics-observatory__profile-frame-live-preview");
  assert.equal(livePreview.getAttribute("data-profile-frame-live-preview"), "");
  assert.equal(livePreview.dataset.frame, entry.slug);
  assert.equal(livePreview.dataset.hasVideo, "true");
  assert.equal(preview.previewVideo.tagName, "VIDEO");
  assert.deepEqual(livePreview.children, [preview.previewVideo, preview.card.element]);
  assert.equal(preview.previewVideo.parentElement, livePreview);
  assert.equal(preview.card.element.parentElement, livePreview);
  assert.equal(descendants(preview.card.element).includes(preview.previewVideo), false);
  assert.equal(livePreview.style.getPropertyValue("--profile-frame-accent"), entry.palette[0]);

  preview.previewVideo.dispatchEvent({ type: "error" });
  assert.equal(preview.previewVideo.dataset.state, "missing");
  assert.equal(livePreview.children.includes(preview.card.element), true);
});

test("only video-authored frames under full effects allocate a stage backdrop", () => {
  for (const entry of PROFILE_FRAMES) {
    const { created, createPreview } = previewFactoryFixture();
    const preview = createPreview(entry.slug, entry);
    const expected = Boolean(entry.previewVideo);
    assert.equal(Boolean(preview.previewVideo), expected, entry.slug);
    assert.equal(preview.element.dataset.frame, entry.slug);
    assert.equal(preview.element.dataset.hasVideo, String(expected));
    assert.equal(
      created.filter((node) => node.tagName === "VIDEO").length,
      expected ? 1 : 0,
      entry.slug
    );
    assert.equal(preview.element.children.at(-1), preview.card.element);
  }

  const eligible = profileFrameBySlug("infernal-dominion");
  for (const policy of [
    { cosmeticEffects: "reduced" },
    { cosmeticEffects: "off" },
    { reducedMotion: true },
    { reducedData: true },
    { saveData: true },
    { bodySaveData: true }
  ]) {
    const { created, createPreview } = previewFactoryFixture(policy);
    const preview = createPreview(eligible.slug, eligible);
    assert.equal(preview.previewVideo, null, JSON.stringify(policy));
    assert.equal(preview.element.dataset.hasVideo, "false", JSON.stringify(policy));
    assert.equal(
      created.some((node) => node.tagName === "VIDEO"),
      false,
      JSON.stringify(policy)
    );
    assert.deepEqual(preview.element.children, [preview.card.element]);
  }
});

test("profile-frame stage CSS keeps the backdrop full-bleed, inert, and behind the card", () => {
  const liveSelector = ".cosmetics-observatory__profile-frame-live-preview {";
  const videoSelector = ".cosmetics-observatory__profile-frame-live-preview > .profile-frame-preview-video {";
  const cardSelector = ".cosmetics-observatory__profile-frame-live-preview > .arena-duel-card {";
  const liveRule = profileFrameStyles.slice(
    profileFrameStyles.indexOf(liveSelector),
    profileFrameStyles.indexOf("}", profileFrameStyles.indexOf(liveSelector)) + 1
  );
  const videoRule = profileFrameStyles.slice(
    profileFrameStyles.indexOf(videoSelector),
    profileFrameStyles.indexOf("}", profileFrameStyles.indexOf(videoSelector)) + 1
  );
  const cardRule = profileFrameStyles.slice(
    profileFrameStyles.indexOf(cardSelector),
    profileFrameStyles.indexOf("}", profileFrameStyles.indexOf(cardSelector)) + 1
  );

  assert.match(liveRule, /width:\s*100%/);
  assert.match(liveRule, /height:\s*100%/);
  assert.match(liveRule, /position:\s*relative/);
  assert.match(liveRule, /overflow:\s*hidden/);
  assert.match(videoRule, /width:\s*100%/);
  assert.match(videoRule, /height:\s*100%/);
  assert.match(videoRule, /position:\s*absolute/);
  assert.match(videoRule, /z-index:\s*0/);
  assert.match(videoRule, /inset:\s*0/);
  assert.match(videoRule, /object-fit:\s*cover/);
  assert.match(videoRule, /pointer-events:\s*none/);
  assert.match(cardRule, /position:\s*relative/);
  assert.match(cardRule, /z-index:\s*2/);
  assert.doesNotMatch(
    previewHost,
    /card[.]parts[.](?:artboard|plate|sigil)[^\n]*(?:append|before|after)\(previewVideo\)/
  );
});

test("mixed kits keep Home and Gate selectors independent from the UI theme alias", () => {
  const homeAndGate = renderer.slice(
    renderer.indexOf("/* Home scenes"),
    renderer.indexOf("/* UI finishes")
  );
  assert.doesNotMatch(homeAndGate, /[.]theme-(?:aurora|solar)/);
});

test("the Cosmetic Lab is reachable from the game shell and opening it has distinct analytics", () => {
  const header = page.slice(page.indexOf('<header class="start-nav">'), page.indexOf("</header>", page.indexOf('<header class="start-nav">')));
  const profile = page.slice(page.indexOf('<dialog id="profileDialog"'), page.indexOf('<dialog id="recoveryDialog"'));
  const customize = header.match(/<button\b(?=[^>]*id="customizeButton")[^>]*>/)?.[0] || "";
  assert.match(customize, /\baria-label="Open Cosmetic Lab"/);
  assert.doesNotMatch(customize, /\b(?:hidden|data-progressive)\b/);
  assert.match(page, /id="openObservatory"/);
  assert.match(page, /<b>Cosmetic Lab<\/b>/);
  assert.doesNotMatch(page.match(/<button\b(?=[^>]*id="openObservatory")[^>]*>/)?.[0] || "", /data-progressive/);
  assert.doesNotMatch(profile, /openObservatory|openProfileObservatory|Cosmetics Observatory/);
  assert.doesNotMatch(page, /id="openProfileObservatory"/);
  assert.doesNotMatch(page, /cosmetics-observatory[.]css/);
  assert.match(loader, /loadOptionalStylesheet\("cosmetics-observatory[.]css(?:[?]v=[^"]+)?"\)/);
  assert.match(loader, /loadOptionalStylesheet\("cosmetics-observatory-full-page[.]css(?:[?]v=[^"]+)?"\)/);
  assert.match(loader, /loadOptionalStylesheet\("profile-rank-frame[.]css(?:[?]v=[^"]+)?"\)/);
  assert.doesNotMatch(page, /cosmetic-world-preview[.]css/);
  assert.match(loader, /loadOptionalStylesheet\("cosmetic-world-preview[.]css(?:[?]v=[^"]+)?"\)/);
  assert.match(observatoryFullPageStyles, /\[data-presentation="full-page"\]/);
  assert.match(profileFrameStyles, /profile-rank-frame-islands--card-clipped/);
  assert.match(previewStyles, /[.]cosmetic-world-preview__bar/);
  assert.doesNotMatch(renderer, /[.]cosmetic-world-preview__bar/);
  assert.match(page, /cosmetics[.]css/);
  assert.match(previewHost, /track[?][.]\("cosmetics_observatory_opened"/);
  assert.match(app, /\[\$\("#openObservatory"\), \$\("#customizeButton"\)\][.]forEach/);
  assert.doesNotMatch(app, /track\("cosmetic_changed", \{ source: "observatory_opened" \}\)/);
});

test("Observatory music previews are transient, exclusive, and restore the equipped score", () => {
  assert.match(
    previewHost,
    /onPreview: \(loadout, meta\) => \{\s*if \(meta[?][.]carousel === true\) \{\s*transientLoadout = null;\s*return;\s*\}\s*const transient = meta[?][.]transient === true;\s*const applied = applyCosmeticLoadout\(loadout, \{ preview: transient \}\);\s*transientLoadout = transient [?] applied : null;/
  );
  assert.match(
    previewHost,
    /function present\(\{ loadout, meta, surface \}\)[\s\S]*?const applied = applyCosmeticLoadout\(loadout, \{ preview: true \}\);\s*transientLoadout = applied;/
  );
  assert.match(previewHost, /onPresentPreview: present/);
  assert.match(previewHost, /onDismissPreview: \(\) => closePreview\(\{ resumeObservatory: false \}\)/);
  const applyStart = app.indexOf("function applyCosmeticLoadout(");
  const applyEnd = app.indexOf("function renderCosmeticLoadout()", applyStart);
  const applySource = app.slice(applyStart, applyEnd);
  assert.match(applySource, /loadout[.]soundTheme !== profile[.]cosmetics[?][.]soundTheme/);
  assert.match(applySource, /gameAudio[.]setTheme\(loadout[.]soundTheme, \{ preview: true \}\)/);
  assert.match(applySource, /gameAudio[.]endPreview\(\)/);
  assert.match(applySource, /gameAudio[.]setTheme\(loadout[.]soundTheme\)/);
  assert.match(previewHost, /function closePreview[\s\S]*?gameAudio[?][.]endPreview[?][.]\(\)/);
  assert.match(previewHost, /function closePreview[\s\S]*?transientLoadout = null;\s*applyCosmeticLoadout\(\);\s*startCosmos[?][.]\(\)/);
  assert.match(previewHost, /onClose: \(\) => \{\s*if \(preview\)[\s\S]*?transientLoadout = null;\s*applyCosmeticLoadout\(\)/);
});

test("profile rerenders preserve the active or staged cosmetic preview", () => {
  const helperStart = app.indexOf("function applyVisibleCosmeticLoadout()");
  const helperEnd = app.indexOf("function renderCosmeticLoadout()", helperStart);
  const helperSource = app.slice(helperStart, helperEnd);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  assert.match(helperSource, /cosmeticsObservatoryHost[?][.]getPreviewLoadout[?][.]\(\)/);
  assert.match(helperSource, /applyCosmeticLoadout\(previewLoadout, \{ preview: true \}\)/);

  const renderStart = app.indexOf("function renderProfile()");
  const renderEnd = app.indexOf("function syncScrambleEntryState()", renderStart);
  const renderSource = app.slice(renderStart, renderEnd);
  assert.ok(renderStart >= 0 && renderEnd > renderStart);
  assert.match(renderSource, /applyVisibleCosmeticLoadout\(\)/);
});

test("collection unlocks spend only the server price with a unique idempotency key", () => {
  assert.match(previewHost, /getBalance: \(\) => profile\(\)[.]credits/);
  assert.match(previewHost, /onPurchase: async \(collection\) => \{/);
  assert.match(previewHost, /fetchJson\("\/api\/cosmetics\/buy"/);
  assert.match(previewHost, /collectionId: collection[.]id/);
  assert.match(previewHost, /globalThis[.]crypto[?][.]randomUUID[?][.]\(\)/);
  assert.doesNotMatch(
    previewHost.match(/fetchJson\("\/api\/cosmetics\/buy"[\s\S]*?\n\s*\}\);/)?.[0] || "",
    /\bprice\s*:/,
    "the client must never submit or choose the authoritative collection price"
  );
});
