import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createMoonHomeProjectEntry } from "../public/moon-home-project-entry.mjs";
import { moonProjectLaunchPlan } from "../public/moon-project-launch.mjs";

test("Moon project handoff uses a clean black crossfade after the live 3D flight", () => {
  const plan = moonProjectLaunchPlan();

  assert.equal(plan.playVideo, false);
  assert.ok(plan.blackoutMs > 0);
  assert.ok(plan.revealMs > 0);
  assert.equal("startAt" in plan, false);
  assert.equal("playbackRate" in plan, false);
});

test("reduced motion keeps the shortened black handoff", () => {
  const plan = moonProjectLaunchPlan({ reducedMotion: true });
  assert.equal(plan.playVideo, false);
  assert.ok(plan.blackoutMs <= 100);
  assert.ok(plan.revealMs <= 150);
});

test("black handoff is a noninteractive live status without loading or playing another film", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../public/moon-project-launch.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/moon-project-flight.css", import.meta.url), "utf8")
  ]);
  assert.match(source, /role: "status"/);
  assert.doesNotMatch(source, /role: "dialog"|"aria-modal"|root[.]focus/);
  assert.doesNotMatch(source, /firstOpenCinematic|createPreparedVideo|video[.]play/);
  assert.match(source, /if \(opened\) restoreInert\(\);[\s\S]*?await nextPaint/,
    "the opened project regains interaction before its first revealed paint");
  assert.match(css, /moon-project-launch\[data-phase="blackout"\][\s\S]*moon-project-launch\[data-phase="handoff"\]/);
  assert.match(css, /moon-project-launch\[data-phase="reveal"\]/);
  assert.doesNotMatch(css, /moon-project-launch__(?:film|fallback|skip)/,
    "the black handoff must not retain hidden film, fallback-flight, or Skip UI styling");
});

test("Moon to Mars preparation opens Moonhaven without pretending to launch to Mars", async () => {
  let opened = 0;
  let synced = 0;
  const trigger = {
    disabled: false,
    setAttribute() {},
    removeAttribute() {}
  };
  const controller = {
    homeProject: () => ({
      surface: "outpost",
      journey: {
        origin: { id: "moon", label: "Moon" },
        destination: { id: "mars", label: "Mars" },
        launchReady: false
      }
    }),
    openCurrentProject: async () => { opened += 1; return true; },
    syncEntryState: () => { synced += 1; trigger.disabled = false; }
  };
  const entry = createMoonHomeProjectEntry({
    documentRef: { querySelector: () => trigger },
    getController: () => controller
  });

  assert.equal(await entry.prepare(), null);
  assert.equal(await entry.launch(trigger), true);
  assert.equal(opened, 1);
  assert.equal(synced, 1);
  assert.equal(trigger.disabled, false);
});

test("a handoff-module preflight failure keeps Earth active and can be retried", async () => {
  let activeWorldId = "earth";
  let loads = 0;
  let arrivals = 0;
  let opened = 0;
  let synced = 0;
  const failures = [];
  const trigger = {
    disabled: false,
    setAttribute() {},
    removeAttribute() {}
  };
  const controller = {
    homeProject: () => ({
      surface: "worldweaving",
      title: "Shape the Moon",
      journey: {
        actionKind: activeWorldId === "earth" ? "launch" : "continue",
        origin: { id: activeWorldId, label: activeWorldId === "earth" ? "Earth" : "Moon" },
        destination: { id: "moon", label: "Moon" }
      }
    }),
    recordArrival: () => { arrivals += 1; activeWorldId = "moon"; },
    openCurrentProject: async () => { opened += 1; return true; },
    syncEntryState: () => { synced += 1; trigger.disabled = false; }
  };
  const entry = createMoonHomeProjectEntry({
    documentRef: { querySelector: () => trigger },
    getController: () => controller,
    loadLaunchModule: async () => { loads += 1; throw new Error("launch chunk unavailable"); },
    showFailure: (error, fallback) => failures.push(error?.message || fallback)
  });

  assert.equal(await entry.launch(trigger), false);
  assert.equal(await entry.launch(trigger), false);
  assert.equal(activeWorldId, "earth");
  assert.equal(arrivals, 0);
  assert.equal(opened, 0);
  assert.equal(loads, 2, "a rejected lazy import is cleared so a later tap can retry it");
  assert.equal(synced, 2);
  assert.deepEqual(failures, ["launch chunk unavailable", "launch chunk unavailable"]);
});

test("arrival commits exactly once while deliberate later rocket taps replay travel without another arrival", async () => {
  let activeWorldId = "earth";
  let arrivals = 0;
  let opened = 0;
  let plays = 0;
  let releaseHandoff;
  const handoffGate = new Promise((resolve) => { releaseHandoff = resolve; });
  const trigger = {
    disabled: false,
    setAttribute() {},
    removeAttribute() {}
  };
  const controller = {
    homeProject: () => ({
      surface: "worldweaving",
      title: "Shape the Moon",
      journey: {
        actionKind: activeWorldId === "earth" ? "launch" : "continue",
        origin: { id: activeWorldId, label: activeWorldId === "earth" ? "Earth" : "Moon" },
        destination: { id: "moon", label: "Moon" }
      }
    }),
    recordArrival: () => { arrivals += 1; activeWorldId = "moon"; },
    openCurrentProject: async () => { opened += 1; return true; },
    syncEntryState: () => { trigger.disabled = false; }
  };
  const entry = createMoonHomeProjectEntry({
    documentRef: { querySelector: () => trigger },
    getController: () => controller,
    loadLaunchModule: async () => ({
      createMoonProjectLaunch: () => ({
        prepare: async () => true,
        play: async ({ open }) => {
          plays += 1;
          await handoffGate;
          return open({ trigger });
        }
      })
    })
  });

  const firstLaunch = entry.launch(trigger);
  assert.equal(await entry.launch(trigger), false, "a second press cannot start another flight");
  releaseHandoff();
  assert.equal(await firstLaunch, true);
  assert.equal(activeWorldId, "moon");
  assert.equal(arrivals, 1);
  assert.equal(plays, 1);
  assert.equal(opened, 1);

  assert.equal(await entry.launch(trigger), true);
  assert.equal(arrivals, 1);
  assert.equal(plays, 2, "an explicit rocket tap replays the black project handoff after confirmed arrival");
  assert.equal(opened, 2);
});

test("Home rocket supports one-touch ignition and separates Moonhaven from Mars preparation", async () => {
  const [css, html, app, controller] = await Promise.all([
    readFile(new URL("../public/moon-project-flight.css", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/moon-worldweaving-controller.mjs", import.meta.url), "utf8")
  ]);
  assert.match(css, /moon-home-voyage:is\(:active,:focus-visible\):not\(:disabled\) [.]moon-home-voyage__engine/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(html, /id="moonHomeProjectVisit"[^>]*hidden/);
  assert.match(app, /moonHomeProjectVisit[\s\S]*openCurrentProject/);
  assert.match(controller, /homeButton[.]disabled = !eligible \|\| journey[.]actionKind === "preparing"/);
  assert.match(controller, /action: "Mars voyage preparing"/);
});
