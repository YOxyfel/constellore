import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PROFILE_FRAMES, profileFrameBySlug } from "../public/profile-frame-catalog.mjs";
import {
  DEFAULT_PROFILE_FRAME_SLUG,
  PROFILE_FRAME_CHANGE_EVENT,
  PROFILE_FRAME_STORAGE_KEY,
  createProfileFramePreviewVideo,
  equipProfileFrame,
  profileFramePreviewVideoAllowed,
  readStoredProfileFrame,
  rememberProfileFrame,
  resolveProfileFrameArtUrl,
  resolveProfileFramePreviewVideoUrl,
  sanitizeProfileFrameSlug
} from "../public/profile-rank-frame.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function videoDocument() {
  const created = [];
  const documentRef = {
    createElement(tagName) {
      const attributes = new Map();
      const listeners = new Map();
      const node = {
        tagName: String(tagName).toUpperCase(),
        className: "",
        dataset: {},
        autoplay: false,
        controls: false,
        defaultMuted: false,
        loop: false,
        muted: false,
        paused: true,
        playsInline: false,
        preload: "",
        src: "",
        tabIndex: 0,
        setAttribute(name, value) {
          const attribute = String(name).toLowerCase();
          attributes.set(attribute, String(value));
          if (attribute === "autoplay") this.autoplay = true;
          if (attribute === "loop") this.loop = true;
          if (attribute === "muted") {
            this.defaultMuted = true;
            this.muted = true;
          }
          if (attribute === "playsinline") this.playsInline = true;
          if (attribute === "preload") this.preload = String(value);
          if (attribute === "src") this.src = String(value);
          if (attribute === "tabindex") this.tabIndex = Number(value);
        },
        getAttribute(name) {
          const attribute = String(name).toLowerCase();
          return attributes.has(attribute) ? attributes.get(attribute) : null;
        },
        hasAttribute(name) {
          return attributes.has(String(name).toLowerCase());
        },
        removeAttribute(name) {
          attributes.delete(String(name).toLowerCase());
        },
        addEventListener(type, callback) {
          listeners.set(String(type), callback);
        },
        removeEventListener(type) {
          listeners.delete(String(type));
        },
        play() {
          this.paused = false;
          return Promise.resolve();
        },
        pause() {
          this.paused = true;
        },
        load() {}
      };
      created.push(node);
      return node;
    }
  };
  return { created, documentRef };
}

test("Arena-frame selection accepts catalog slugs, none, and a safe fallback", () => {
  assert.equal(sanitizeProfileFrameSlug("berry-burrow"), "berry-burrow");
  assert.equal(sanitizeProfileFrameSlug(""), "");
  assert.equal(sanitizeProfileFrameSlug("not-a-frame"), DEFAULT_PROFILE_FRAME_SLUG);
  assert.equal(sanitizeProfileFrameSlug("not-a-frame", "also-missing"), "");
});

test("Arena-frame selection persists locally without entering the cloud profile", () => {
  const storage = memoryStorage();
  assert.equal(readStoredProfileFrame(storage), DEFAULT_PROFILE_FRAME_SLUG);
  assert.equal(rememberProfileFrame("lunar-reverie", storage), "lunar-reverie");
  assert.equal(storage.getItem(PROFILE_FRAME_STORAGE_KEY), "lunar-reverie");
  assert.equal(readStoredProfileFrame(storage), "lunar-reverie");
  assert.equal(rememberProfileFrame("", storage), "");
  assert.equal(readStoredProfileFrame(storage), "");
});

test("equipping an Arena frame notifies interested presentation surfaces", () => {
  const storage = memoryStorage();
  let dispatched = null;
  const eventTarget = {
    dispatchEvent(event) {
      dispatched = event;
      return true;
    }
  };
  class CustomEventStub {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  assert.equal(equipProfileFrame("gravebound-king", {
    storage,
    eventTarget,
    CustomEventCtor: CustomEventStub
  }), "gravebound-king");
  assert.equal(storage.getItem(PROFILE_FRAME_STORAGE_KEY), "gravebound-king");
  assert.equal(dispatched.type, PROFILE_FRAME_CHANGE_EVENT);
  assert.deepEqual(dispatched.detail, { slug: "gravebound-king" });
});

test("profile-frame artwork resolves under both /play and portable itch roots", () => {
  const frame = profileFrameBySlug("storm-seraph");
  assert.equal(
    resolveProfileFrameArtUrl(frame, "https://example.test/play/profile-rank-frame.mjs"),
    "https://example.test/play/art/profile-frames/storm-seraph.png"
  );
  assert.equal(
    resolveProfileFrameArtUrl(frame, "https://example.test/profile-rank-frame.mjs"),
    "https://example.test/art/profile-frames/storm-seraph.png"
  );
  assert.equal(resolveProfileFrameArtUrl({ art: "https://evil.test/frame.png" }), "");
  assert.equal(resolveProfileFrameArtUrl({ art: "../private.png" }), "");
});

test("profile-frame preview videos resolve only from their safe local runtime directory", () => {
  const angel = profileFrameBySlug("empyrean-ascension");
  const devil = profileFrameBySlug("infernal-dominion");
  const ordinary = profileFrameBySlug("storm-seraph");

  assert.equal(
    resolveProfileFramePreviewVideoUrl(
      angel,
      "https://example.test/play/profile-rank-frame.mjs"
    ),
    "https://example.test/play/cinematic/profile-frame-previews/empyrean-ascension.mp4"
  );
  assert.equal(
    resolveProfileFramePreviewVideoUrl(
      devil,
      "https://example.test/profile-rank-frame.mjs"
    ),
    "https://example.test/cinematic/profile-frame-previews/infernal-dominion.mp4"
  );
  assert.equal(resolveProfileFramePreviewVideoUrl(ordinary), "");

  for (const previewVideo of [
    "https://evil.test/video.mp4",
    "//evil.test/video.mp4",
    "../private.mp4",
    "./cinematic/intro-video.mp4",
    "./cinematic/profile-frame-previews/../../private.mp4",
    "./cinematic/profile-frame-previews/angel.webm",
    "./cinematic/profile-frame-previews/angel.mp4?tracking=1"
  ]) {
    assert.equal(
      resolveProfileFramePreviewVideoUrl({ previewVideo }),
      "",
      `${previewVideo} must not resolve as a frame preview`
    );
  }
});

test("profile-frame preview-video policy blocks every reduced-motion and reduced-data mode", () => {
  assert.equal(profileFramePreviewVideoAllowed(), true);
  assert.equal(profileFramePreviewVideoAllowed({
    cosmeticEffects: "full",
    reducedMotion: false,
    reducedData: false,
    saveData: false
  }), true);

  for (const blocked of [
    { cosmeticEffects: "reduced" },
    { cosmeticEffects: "off" },
    { cosmeticEffects: "unknown" },
    { reducedMotion: true },
    { reducedData: true },
    { saveData: true },
    {
      cosmeticEffects: "full",
      reducedMotion: true,
      reducedData: true,
      saveData: true
    }
  ]) {
    assert.equal(
      profileFramePreviewVideoAllowed(blocked),
      false,
      `${JSON.stringify(blocked)} must suppress decorative preview video`
    );
  }
});

test("profile-frame preview video is silent, decorative, inline, and self-looping", () => {
  const { created, documentRef } = videoDocument();
  const video = createProfileFramePreviewVideo({
    documentRef,
    entry: profileFrameBySlug("empyrean-ascension"),
    moduleUrl: "https://example.test/play/profile-rank-frame.mjs"
  });

  assert.equal(created.length, 1);
  assert.equal(video, created[0]);
  assert.equal(video.tagName, "VIDEO");
  assert.equal(
    video.src || video.getAttribute("src"),
    "https://example.test/play/cinematic/profile-frame-previews/empyrean-ascension.mp4"
  );
  assert.equal(video.autoplay, true);
  assert.equal(video.defaultMuted, true);
  assert.equal(video.muted, true);
  assert.equal(video.loop, true);
  assert.equal(video.playsInline, true);
  assert.equal(video.controls, false);
  assert.equal(video.getAttribute("aria-hidden"), "true");
  assert.equal(video.tabIndex, -1);
});

test("blocked or missing profile-frame previews never create a media element", () => {
  const blockedPolicies = [
    { cosmeticEffects: "reduced" },
    { cosmeticEffects: "off" },
    { reducedMotion: true },
    { reducedData: true },
    { saveData: true }
  ];

  for (const policy of blockedPolicies) {
    const { created, documentRef } = videoDocument();
    assert.equal(
      createProfileFramePreviewVideo({
        documentRef,
        entry: profileFrameBySlug("infernal-dominion"),
        ...policy
      }),
      null
    );
    assert.equal(
      created.length,
      0,
      `${JSON.stringify(policy)} must avoid allocating a video element`
    );
  }

  for (const entry of [
    profileFrameBySlug("storm-seraph"),
    { previewVideo: "https://evil.test/video.mp4" },
    null
  ]) {
    const { created, documentRef } = videoDocument();
    assert.equal(createProfileFramePreviewVideo({ documentRef, entry }), null);
    assert.equal(created.length, 0);
  }
});

test("the Arena-frame catalog retains its intact authored compositions", () => {
  for (const entry of PROFILE_FRAMES) {
    assert.match(entry.art, /^\.\/art\/profile-frames\/[a-z0-9-]+[.]png$/u);
    assert.deepEqual(Object.keys(entry.fit).sort(), ["bottom", "left", "right", "top"]);
    assert.match(entry.contentInset, /^\d+(?:[.]\d+)?(?:px|%)$/u);
    assert.match(entry.avatarTop, /^\d+(?:[.]\d+)?%$/u);
    if (entry.layout === "partial") {
      assert.ok(entry.islands.length >= 3, `${entry.slug} must preserve its authored partial islands`);
    }
  }
});

test("the Lab owns frame selection while Rank stays undecorated", async () => {
  const [runtime, surface, frameStyles, observatory, previewHost, loader, app, buildPages, syncRelease] = await Promise.all([
    readFile(path.join(projectRoot, "public/profile-rank-frame.mjs"), "utf8"),
    readFile(path.join(projectRoot, "public/profile-rank-surface.mjs"), "utf8"),
    readFile(path.join(projectRoot, "public/profile-rank-frame.css"), "utf8"),
    readFile(path.join(projectRoot, "public/cosmetics-observatory.mjs"), "utf8"),
    readFile(path.join(projectRoot, "public/cosmetic-world-preview.mjs"), "utf8"),
    readFile(path.join(projectRoot, "public/secondary-surface-loader.mjs"), "utf8"),
    readFile(path.join(projectRoot, "public/app.js"), "utf8"),
    readFile(path.join(projectRoot, "scripts/build-pages.mjs"), "utf8"),
    readFile(path.join(projectRoot, "scripts/sync-public-release.mjs"), "utf8")
  ]);

  assert.match(runtime, /source[.]src = sourceUrl/);
  assert.match(runtime, /renderProfileFrameArt\(documentRef, stage, artRoot, entry\)/);
  assert.match(runtime, /export function createProfileFramePreview/);
  assert.match(runtime, /PROFILE_FRAME_CHANGE_EVENT/);
  assert.match(runtime, /entry[.]layout !== "partial"/);
  assert.doesNotMatch(runtime, /getElementById\("profileDialog"\)/);
  assert.doesNotMatch(runtime, /profileWindowFrame|profile-window-frame|data-profile-frame-overlay/);
  assert.doesNotMatch(runtime, /resolveProfileWindowPieces|createProfileRankFrameController/);
  assert.doesNotMatch(runtime, /Equipped profile frame|profileFrameEquipped|buildEquippedPresentation/);
  assert.doesNotMatch(runtime, /insertAdjacentElement\("afterend"/);
  assert.doesNotMatch(runtime, /profileFramePicker|profile-frame-picker|<select/);
  assert.doesNotMatch(runtime, /persist:\s*true/);
  assert.doesNotMatch(surface, /profile-window-frame|data-profile-frame|--profile-frame-/);
  assert.doesNotMatch(surface, /createProfileRankFrameController|syncProfileRankFrame/);
  assert.doesNotMatch(surface, /profile-modal__viewport/);
  assert.doesNotMatch(surface, /profile-frame-studio|profile-frame-picker/);
  assert.match(frameStyles, /profile-rank-frame-islands--card-clipped/);
  assert.match(frameStyles, /cosmetics-observatory__profile-frame-preview/);
  assert.match(observatory, /PROFILE_FRAME_CATEGORY = "profileFrames"/);
  assert.match(observatory, /function commitProfileFrame\(/);
  assert.match(observatory, /settings[.]onProfileFrameCommit/);
  assert.match(observatory, /settings[.]createProfileFramePreview/);
  assert.match(previewHost, /profileFrames:\s*PROFILE_FRAMES/);
  assert.match(previewHost, /onProfileFrameCommit:\s*\(slug, meta\)/);
  assert.match(previewHost, /equipProfileFrame\(slug/);
  assert.match(previewHost, /arena_frame_changed/);
  assert.match(loader, /loadOptionalStylesheet\("profile-rank-frame[.]css/);
  assert.doesNotMatch(app, /import \{ readStoredProfileFrame \} from "[.]\/profile-rank-frame[.]mjs/);
  assert.match(loader, /frameSlug:\s*options[?][.]frameSlug\s*\|\|\s*\(\(\)\s*=>\s*frameModule[.]readStoredProfileFrame\(\)\)/);
  assert.doesNotMatch(app, /profileRankSurface[?][.]syncProfileRankFrame/);

  for (const source of [buildPages, syncRelease]) {
    assert.match(source, /art\/profile-frames\//);
    assert.match(source, /lazyAssets:[^\n]+art\/profile-frames\//);
  }
});
