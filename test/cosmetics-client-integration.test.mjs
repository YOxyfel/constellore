import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const renderer = await readFile(new URL("../public/cosmetics.css", import.meta.url), "utf8");
const loader = await readFile(new URL("../public/secondary-surface-loader.mjs", import.meta.url), "utf8");
const previewHost = await readFile(new URL("../public/cosmetic-world-preview.mjs", import.meta.url), "utf8");
const previewStyles = await readFile(new URL("../public/cosmetic-world-preview.css", import.meta.url), "utf8");

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

test("mixed kits keep Home and Gate selectors independent from the UI theme alias", () => {
  const homeAndGate = renderer.slice(
    renderer.indexOf("/* Home scenes"),
    renderer.indexOf("/* UI finishes")
  );
  assert.doesNotMatch(homeAndGate, /[.]theme-(?:aurora|solar)/);
});

test("the Observatory is reachable from the game shell and opening it has distinct analytics", () => {
  const header = page.slice(page.indexOf('<header class="start-nav">'), page.indexOf("</header>", page.indexOf('<header class="start-nav">')));
  const profile = page.slice(page.indexOf('<dialog id="profileDialog"'), page.indexOf('<dialog id="recoveryDialog"'));
  const customize = header.match(/<button\b(?=[^>]*id="customizeButton")[^>]*>/)?.[0] || "";
  assert.match(customize, /\baria-label="Customize your game"/);
  assert.doesNotMatch(customize, /\b(?:hidden|data-progressive)\b/);
  assert.match(page, /id="openObservatory"/);
  assert.doesNotMatch(page.match(/<button\b(?=[^>]*id="openObservatory")[^>]*>/)?.[0] || "", /data-progressive/);
  assert.doesNotMatch(profile, /openObservatory|openProfileObservatory|Cosmetics Observatory/);
  assert.doesNotMatch(page, /id="openProfileObservatory"/);
  assert.doesNotMatch(page, /cosmetics-observatory[.]css/);
  assert.match(loader, /loadOptionalStylesheet\("cosmetics-observatory[.]css(?:[?]v=[^"]+)?"\)/);
  assert.doesNotMatch(page, /cosmetic-world-preview[.]css/);
  assert.match(loader, /loadOptionalStylesheet\("cosmetic-world-preview[.]css(?:[?]v=[^"]+)?"\)/);
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
    /onPreview: \(loadout, meta\) => \{\s*const transient = meta[?][.]transient === true;\s*const applied = applyCosmeticLoadout\(loadout, \{ preview: transient \}\);\s*transientLoadout = transient [?] applied : null;/
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
