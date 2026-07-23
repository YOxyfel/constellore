import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const profile = page.slice(page.indexOf('<dialog id="profileDialog"'), page.indexOf('<dialog id="recoveryDialog"'));

test("the player profile leads with a compact overview and progressively reveals secondary tools", () => {
  assert.match(profile, /YOUR CONSTELLATION/);
  assert.doesNotMatch(profile, /YOUR LIVING ATLAS/);
  assert.match(profile, /class="profile-overview"[\s\S]*id="profileTotalDust"[\s\S]*id="profileWords"[\s\S]*id="profileWins"[\s\S]*id="profileStreak"/);

  for (const className of ["profile-archive", "profile-badges", "profile-account", "profile-preferences", "profile-data"]) {
    assert.match(profile, new RegExp(`<details class="[^"]*${className}[^"]*"`));
  }
  assert.doesNotMatch(profile, /<details class="[^"]*profile-disclosure[^"]*"[^>]*\sopen(?:\s|>)/, "secondary profile sections must start collapsed");
  assert.ok(profile.indexOf("profile-overview") < profile.indexOf("profile-disclosure-grid"), "key progress must appear before secondary collections");
  assert.ok(profile.indexOf("profile-disclosure-grid") < profile.indexOf("profile-preferences"), "preferences must not interrupt the player progress story");
});

test("the profile is wide on desktop, full-screen on mobile, and resets to its overview", () => {
  assert.match(styles, /[.]profile-modal\s*\{[^}]*width:\s*min\(760px,/);
  assert.match(styles, /[.]profile-core-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,/);
  assert.match(styles, /@media \(max-width:\s*700px\)[\s\S]*?[.]profile-modal\s*\{[^}]*width:\s*100%[^}]*height:\s*100dvh/);
  assert.match(styles, /[.]profile-disclosure\[open\]\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(app, /profileBadgeSummary[^\n]+badges[.]filter\(\(badge\) => badge[.]earned\)/);
  assert.match(app, /cloudGroup[.]hidden\s*=\s*isStaticBeta/);
  assert.match(app, /querySelectorAll\("[.]profile-disclosure\[open\]"\)[.]forEach/);
  assert.match(app, /addEventListener\("toggle"[\s\S]*other !== section[\s\S]*other[.]open = false/);
});
