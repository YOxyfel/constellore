import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ANIMATED_PROFILE_FRAMES,
  PROFILE_FRAMES,
  profileFrameBySlug
} from "../public/profile-frame-catalog.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_FRAME_FIT_EDGES = ["top", "right", "bottom", "left"];

test("standalone profile-frame catalog contains twenty unique pieces and four effects", () => {
  assert.equal(PROFILE_FRAMES.length, 20);
  assert.equal(ANIMATED_PROFILE_FRAMES.length, 4);
  assert.equal(new Set(PROFILE_FRAMES.map((entry) => entry.id)).size, 20);
  assert.equal(new Set(PROFILE_FRAMES.map((entry) => entry.slug)).size, 20);
  assert.deepEqual(
    ANIMATED_PROFILE_FRAMES.map((entry) => entry.slug),
    ["lunar-reverie", "eventide-fracture", "ember-sovereign", "abyssal-pearl"]
  );
  assert.equal(
    PROFILE_FRAMES.filter((entry) => entry.layout === "partial").length,
    10
  );
  assert.equal(profileFrameBySlug("berry-burrow")?.name, "Berry Burrow");
  assert.equal(profileFrameBySlug("missing"), null);
});

test("only the angel and devil Arena frames declare canonical Lab preview videos", () => {
  assert.deepEqual(
    PROFILE_FRAMES
      .filter((entry) => entry.previewVideo)
      .map((entry) => [entry.slug, entry.previewVideo]),
    [
      [
        "empyrean-ascension",
        "./cinematic/profile-frame-previews/empyrean-ascension.mp4"
      ],
      [
        "infernal-dominion",
        "./cinematic/profile-frame-previews/infernal-dominion.mp4"
      ]
    ]
  );

  for (const entry of PROFILE_FRAMES) {
    if (!entry.previewVideo) {
      assert.equal(
        entry.previewVideo,
        null,
        `${entry.slug} must not inherit another frame's preview video`
      );
      continue;
    }
    assert.equal(
      entry.previewVideo,
      `./cinematic/profile-frame-previews/${entry.slug}.mp4`,
      `${entry.slug} must use its canonical slug as the preview-video filename`
    );
  }
});

test("every profile frame declares an immutable four-edge card fit", () => {
  const fits = new Set();

  for (const entry of PROFILE_FRAMES) {
    assert.deepEqual(Object.keys(entry.fit), PROFILE_FRAME_FIT_EDGES);
    assert.ok(Object.isFrozen(entry.fit), `${entry.slug} fit metadata must be immutable`);
    for (const edge of PROFILE_FRAME_FIT_EDGES) {
      assert.match(
        entry.fit[edge],
        /^\d+(?:[.]\d+)?%$/,
        `${entry.slug} ${edge} fit must be a percentage`
      );
    }
    assert.match(entry.contentInset, /^\d+(?:[.]\d+)?(?:px|%)$/);
    assert.match(entry.avatarTop, /^\d+(?:[.]\d+)?%$/);
    assert.ok(["frame", "partial"].includes(entry.layout));
    fits.add(PROFILE_FRAME_FIT_EDGES.map((edge) => entry.fit[edge]).join(" "));
  }

  assert.ok(fits.size > 1, "profile frames must be able to define distinct apertures");
});

test("every partial overlay has two outside islands and one card-clipped island", () => {
  const partialFrames = PROFILE_FRAMES.filter((entry) => entry.layout === "partial");
  const protectedContent = Object.freeze({
    top: 0.35,
    right: 0.80,
    bottom: 0.66,
    left: 0.20
  });

  for (const entry of partialFrames) {
    assert.equal(entry.islands.length, 3, `${entry.slug} must have three islands`);
    assert.ok(Object.isFrozen(entry.islands));
    assert.equal(
      entry.islands.filter((island) => island.plane === "outside").length,
      2,
      `${entry.slug} must have two outside islands`
    );
    assert.equal(
      entry.islands.filter((island) => island.plane === "card").length,
      1,
      `${entry.slug} must have one card-clipped island`
    );

    for (const island of entry.islands) {
      assert.ok(Object.isFrozen(island));
      assert.ok(Object.isFrozen(island.crop));
      assert.ok(Object.isFrozen(island.placement));
      if (island.shape) {
        assert.ok(Object.isFrozen(island.shape));
        assert.ok(island.shape.every((point) => (
          Object.isFrozen(point)
          && point.x >= 0
          && point.x <= 1
          && point.y >= 0
          && point.y <= 1
        )));
      }
      for (const value of Object.values(island.crop)) {
        assert.ok(value >= 0 && value <= 1);
      }
      assert.equal(typeof island.placement.x, "number");
      assert.equal(typeof island.placement.y, "number");

      const placed = {
        top: island.crop.top + island.placement.y,
        right: (1 - island.crop.right) + island.placement.x,
        bottom: (1 - island.crop.bottom) + island.placement.y,
        left: island.crop.left + island.placement.x
      };
      const obstructsContent = (
        placed.right > protectedContent.left
        && placed.left < protectedContent.right
        && placed.bottom > protectedContent.top
        && placed.top < protectedContent.bottom
      );
      assert.equal(
        obstructsContent,
        false,
        `${entry.slug} ${island.id} must clear the protected text and stats corridor`
      );
    }

    const anchor = entry.islands.find((island) => island.plane === "card");
    const placedAnchor = {
      top: anchor.crop.top + anchor.placement.y,
      right: (1 - anchor.crop.right) + anchor.placement.x,
      bottom: (1 - anchor.crop.bottom) + anchor.placement.y,
      left: anchor.crop.left + anchor.placement.x
    };
    assert.ok(
      placedAnchor.left <= 0.16
        || placedAnchor.right >= 0.84
        || placedAnchor.top <= 0.16
        || placedAnchor.bottom >= 0.84,
      `${entry.slug} card-clipped accent must stay attached to a card edge`
    );
  }
});

test("Storm Seraph masks the overlapping shard and keeps its spear attached to the card edge", () => {
  const storm = profileFrameBySlug("storm-seraph");
  const thunderbird = storm.islands.find((entry) => entry.id === "thunderbird");
  const spear = storm.islands.find((entry) => entry.id === "lightning-spear");

  assert.equal(thunderbird.shape.length, 6);
  assert.deepEqual(
    thunderbird.shape.map((point) => [
      Math.round(point.x * 1086),
      Math.round(point.y * 1448)
    ]),
    [[228, 41], [1056, 41], [1056, 685], [338, 685], [338, 528], [228, 528]]
  );
  assert.equal(Math.round((1 - spear.crop.right) * 1086), 303);
  assert.equal(Math.round(spear.placement.x * 1086), -135);
});

test("every profile-frame master is an exact 3:4 RGBA PNG", async () => {
  for (const entry of PROFILE_FRAMES) {
    const filePath = path.join(projectRoot, "public", entry.art.replace(/^[.]\//, ""));
    const file = await readFile(filePath);
    const metadata = await stat(filePath);

    assert.ok(metadata.size > 100_000, `${entry.slug} should contain production artwork`);
    assert.deepEqual(
      [...file.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
      `${entry.slug} must be a PNG`
    );

    const width = file.readUInt32BE(16);
    const height = file.readUInt32BE(20);
    const colorType = file[25];
    assert.equal(width * 4, height * 3, `${entry.slug} must keep an exact 3:4 ratio`);
    assert.equal(colorType, 6, `${entry.slug} must contain RGBA pixels`);
  }
});

test("showcase exposes a motion control and explicit accessibility fallbacks", async () => {
  const [html, css, source] = await Promise.all([
    readFile(path.join(projectRoot, "public/profile-frames.html"), "utf8"),
    readFile(path.join(projectRoot, "public/profile-frame-showcase.css"), "utf8"),
    readFile(path.join(projectRoot, "public/profile-frame-showcase.mjs"), "utf8")
  ]);

  assert.match(html, /id="motionToggle"[\s\S]*Animated effects/);
  assert.match(html, /id="partialFrameGrid"/);
  assert.match(html, /id="fullFrameGrid"/);
  assert.match(html, /class="profile-frame-art" aria-hidden="true"/);
  assert.match(html, /class="profile-effect" aria-hidden="true"/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /\[data-effects="full"\] \.profile-effect/);
  assert.match(css, /[.]profile-frame-islands--card-clipped\s*\{[\s\S]*?clip-path:\s*inset/);
  assert.match(
    css,
    /[.]profile-card\s*\{[\s\S]*?inset:\s*var\(--card-top,[^)]+\)\s*var\(--card-right,[^)]+\)\s*var\(--card-bottom,[^)]+\)\s*var\(--card-left,[^)]+\)/,
    "the card must consume the per-frame aperture variables"
  );
  assert.match(source, /Object[.]entries\(entry[.]fit\)/);
  assert.match(source, /stage[.]style[.]setProperty\(`--card-\$\{edge\}`, value\)/);
  assert.match(source, /plane[.]append\(renderIsland\(entry, island, card\)\)/);
  assert.match(source, /--island-crop-\$\{edge\}/);
  assert.match(source, /entry[.]layout === "partial" \? partialGrid : fullGrid/);
  assert.match(source, /--card-content-inset/);
  assert.match(source, /--card-avatar-top/);
  assert.match(source, /card[.]dataset[.]layout = entry[.]layout/);
  assert.match(source, /document[.]documentElement[.]dataset[.]effects = enabled \? "full" : "off"/);
});

test("placement comparison sheet is a production-size PNG", async () => {
  const filePath = path.join(
    projectRoot,
    "public/art/profile-frame-placement-variations.png"
  );
  const file = await readFile(filePath);
  const metadata = await stat(filePath);

  assert.ok(metadata.size > 100_000);
  assert.deepEqual(
    [...file.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10]
  );
  assert.equal(file.readUInt32BE(16), 1740);
  assert.equal(file.readUInt32BE(20), 1380);
});

test("partial-overlay review sheet reflects the ten final placements", async () => {
  const filePath = path.join(
    projectRoot,
    "itch-assets/profile-frames/partial-overlay-contact-sheet.png"
  );
  const file = await readFile(filePath);
  const metadata = await stat(filePath);

  assert.ok(metadata.size > 400_000);
  assert.deepEqual(
    [...file.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10]
  );
  assert.equal(file.readUInt32BE(16), 1740);
  assert.equal(file.readUInt32BE(20), 2760);
});
