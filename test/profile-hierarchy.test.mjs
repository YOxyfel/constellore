import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderProfileRankView } from "../public/home-menu-view.mjs";

const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const simpleStyles = readFileSync(new URL("../public/simple-ui.css", import.meta.url), "utf8");
const homeMenuView = readFileSync(new URL("../public/home-menu-view.mjs", import.meta.url), "utf8");
const rankSurface = readFileSync(new URL("../public/profile-rank-surface.mjs", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const profile = page.slice(page.indexOf('<dialog id="profileDialog"'), page.indexOf('<dialog id="recoveryDialog"'));
const menu = page.slice(page.indexOf('<dialog class="modal hub-menu-modal"'), page.indexOf('<footer class="start-footer"'));

test("the player profile leads with permanent Route Rank and separated lifetime stats", () => {
  assert.match(profile, /<h2 id="profileRankTitle">Your progress<\/h2>/);
  assert.match(profile, /class="profile-route-rank"[^>]+data-rank="bronze"/);
  assert.match(profile, /id="profileRouteRankName">Bronze<\/h3>/);
  assert.match(profile, /id="profileRouteRankMeter"[^>]+role="progressbar"/);
  assert.match(profile, /id="profileRouteRankUnlock">Silver unlocks Free play and custom targets/);
  assert.match(profile, /class="profile-grid profile-core-grid"[\s\S]*class="profile-total"[\s\S]*id="profileTotalDust"[\s\S]*Stardust[\s\S]*Spendable balance/);
  assert.match(profile, /class="profile-overview"[\s\S]*id="profileWords"[\s\S]*id="profileWins"[\s\S]*id="profileStreak"/);
  assert.match(profile, /<section class="profile-more"[^>]+aria-labelledby="profileMoreTitle"/);
  assert.match(profile, /id="profileMoreTitle">Progress and rewards/);
  assert.doesNotMatch(profile, /<details class="profile-more"/);

  for (const className of ["profile-archive", "profile-badges"]) {
    assert.match(profile, new RegExp(`<details class="[^"]*${className}[^"]*"`));
  }
  for (const className of ["profile-account", "profile-preferences", "profile-data"]) {
    assert.doesNotMatch(profile, new RegExp(`<details class="[^"]*${className}[^"]*"`), `${className} belongs in the main menu, not progress`);
    assert.match(menu, new RegExp(`<details class="[^"]*${className}[^"]*"[^>]*name="hub-settings"`));
  }
  assert.doesNotMatch(profile, /openProfileObservatory|Cosmetics Observatory/);
  assert.match(menu, /id="openObservatory"/);
  assert.doesNotMatch(profile, /<details class="[^"]*profile-disclosure[^"]*"[^>]*\sopen(?:\s|>)/, "secondary profile sections must start collapsed");
  assert.ok(profile.indexOf("profile-route-rank") < profile.indexOf("profile-overview"), "Route Rank must lead the progress story");
  assert.ok(profile.indexOf("profile-overview") < profile.indexOf("profile-disclosure-grid"), "key progress must appear before secondary collections");
  assert.match(menu, /id="hubMenuSettingsTitle">Settings and data<\/h3>/);
  assert.doesNotMatch(profile, /profile-modal__viewport|data-profile-frame-overlay/);
  assert.doesNotMatch(rankSurface, /profile-window-frame|createProfileRankFrameController|data-profile-frame/);
  assert.doesNotMatch(rankSurface, /profile-frame-equipped|profile-rank-frame-stage/);
  assert.doesNotMatch(rankSurface, /profile-frame-studio|profile-frame-picker|profileFramePicker/);
});

test("the profile is roomy on desktop, full-screen on mobile, and resets secondary tools", () => {
  assert.match(rankSurface, /[.]simple-ui [.]modal[.]profile-modal\s*\{[^}]*width:\s*min\(720px,/);
  assert.match(rankSurface, /[.]simple-ui [.]profile-core-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
  assert.match(rankSurface, /[.]simple-ui [.]profile-core-grid [.]profile-total\s*\{[^}]*display:\s*grid[^}]*border:[^}]*text-align:\s*center/);
  assert.match(rankSurface, /@media \(max-width:\s*700px\)[\s\S]*?[.]simple-ui [.]profile-core-grid\s*\{[^}]*repeat\(2,/);
  assert.match(rankSurface, /@media \(max-width:\s*420px\)[\s\S]*?[.]simple-ui [.]profile-core-grid [.]profile-total\s*\{[^}]*min-height:\s*86px/);
  assert.match(rankSurface, /@media \(max-width:\s*700px\)[\s\S]*?[.]simple-ui [.]modal[.]profile-modal\s*\{[^}]*width:\s*100%[^}]*height:\s*100dvh/);
  assert.doesNotMatch(rankSurface, /--profile-frame-/);
  assert.match(rankSurface, /[.]profile-modal > [.]modal-close\s*\{[^}]*background:/);
  assert.match(rankSurface, /[.]profile-modal > [.]modal-close:focus-visible\s*\{[^}]*outline:/);
  assert.match(rankSurface, /@media \(max-width:\s*700px\)[\s\S]*?[.]profile-modal > [.]modal-close\s*\{[^}]*safe-area-inset-top/);
  assert.match(rankSurface, /[.]profile-route-rank\s*\{[^}]*grid-template-columns:/);
  assert.match(styles, /[.]profile-disclosure\[open\]\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(homeMenuView, /routeRankProgressPresentation\(routeRank\)/);
  assert.match(homeMenuView, /profileRouteRankMeter[^]+aria-valuenow/);
  assert.match(app, /renderProfileRankView\(routeRank\)/);
  assert.doesNotMatch(app, /profileRankSurface[?][.]syncProfileRankFrame/);
  assert.match(app, /await prepareProfileRankSurface\(\)[^]+renderProfile\(\)/);
  assert.match(app, /try\s*\{[^]+import\("[.]\/profile-rank-surface[.]mjs[^]+catch\s*\{[^]+profileRankSurface = null/);
  assert.match(app, /profileBadgeSummary[^\n]+badges[.]filter\(\(badge\) => badge[.]earned\)/);
  assert.match(app, /cloudGroup[.]hidden\s*=\s*isStaticBeta/);
  assert.match(app, /querySelectorAll\("[.]profile-disclosure\[open\]"\)[.]forEach/);
  assert.match(app, /addEventListener\("toggle"[\s\S]*other !== section[\s\S]*other[.]open = false/);
  assert.match(app, /function openHubMenu\(\)[\s\S]*renderProfile\(\)[\s\S]*menu-disclosure\[open\]/);
});

test("Stardust has a persistent, synchronized home and menu wallet", () => {
  const header = page.slice(page.indexOf('<header class="start-nav">'), page.indexOf('<main class="start-content">'));
  assert.match(header, /id="homeStardustWallet"[^>]+role="status"[^>]+aria-label="0 Stardust available"/);
  assert.match(header, /class="stardust-wallet__copy"[^>]*>[\s\S]*Stardust[\s\S]*id="profileDust"/);
  assert.ok(header.indexOf("homeStardustWallet") < header.indexOf("profileButton"), "the balance should remain separate from Route Rank");
  assert.doesNotMatch(header, /profileButton[^]+id="profileDust"/);
  assert.match(menu, /id="hubStardustWallet"[^>]+role="status"[^>]+aria-label="0 Stardust available"/);
  assert.match(menu, /id="hubStardust"/);
  assert.match(app, /const formattedStardust = stardustBalance[.]toLocaleString\("en-US"\)/);
  for (const id of ["profileDust", "hubStardust", "profileTotalDust"]) {
    assert.match(app, new RegExp(`#${id}[^\\n]+formattedStardust`));
  }
  for (const id of ["homeStardustWallet", "hubStardustWallet"]) {
    assert.match(app, new RegExp(`#${id}[^\\n]+Stardust available`));
  }
  assert.doesNotMatch(app, /#profileLevel/);
});

test("sound settings expose an accessible three-channel volume mixer", () => {
  for (const [id, value] of [
    ["masterVolumePreference", ".75"],
    ["musicVolumePreference", "1"],
    ["sfxVolumePreference", "1"]
  ]) {
    assert.match(menu, new RegExp(`id="${id}" type="range" min="0" max="1" step="[.]05" value="${value}"`));
    assert.match(menu, new RegExp(`<label for="${id}">`));
    assert.match(menu, new RegExp(`<output id="[^"]+" for="${id}">`));
  }
  assert.match(menu, /class="feedback-mixer" role="group" aria-labelledby="feedbackMixerTitle"/);
  assert.match(styles, /[.]feedback-volume input\s*\{[^}]*min-height:\s*44px[^}]*accent-color:\s*var\(--violet\)/);
});

test("the base profile keeps the real rank if optional decoration cannot load", () => {
  const ids = [
    "profileRouteRankCard",
    "profileRouteRankMark",
    "profileRouteRankName",
    "profileRouteRankNumber",
    "profileRouteRankStatus",
    "profileRouteRankProgress",
    "profileRouteRankPercent",
    "profileRouteRankDetail",
    "profileRouteRankUnlock",
    "profileRouteRankMeter"
  ];
  const nodes = new Map(ids.map((id) => [id, {
    dataset: {},
    style: {},
    textContent: "",
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); }
  }]));
  const progress = renderProfileRankView({ rank: "gold" }, {
    getElementById(id) { return nodes.get(id); }
  });

  assert.equal(progress.name, "Gold");
  assert.equal(nodes.get("profileRouteRankName").textContent, "Gold");
  assert.equal(nodes.get("profileRouteRankNumber").textContent, "RANK 03");
  assert.equal(nodes.get("profileRouteRankCard").dataset.rank, "gold");
  assert.equal(nodes.get("profileRouteRankMeter").attributes.get("aria-valuenow"), String(progress.progress));
});
