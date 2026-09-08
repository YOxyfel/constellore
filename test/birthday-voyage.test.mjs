import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  BIRTHDAY_FINALE_SIGNATURE,
  BIRTHDAY_FINAL_MESSAGE,
  BIRTHDAY_GIVER_NAME,
  BIRTHDAY_HONOREE_DISPLAY_NAME,
  BIRTHDAY_HONOREE_NAMES,
  BIRTHDAY_INTERFACE_PAIR,
  BIRTHDAY_VOYAGE_CONFIG,
  BIRTHDAY_VOYAGE_VERSION
} from "../public/birthday-voyage-config.mjs";

import {
  BIRTHDAY_CAR_OPTIONS,
  BIRTHDAY_CITY_OPTIONS,
  BIRTHDAY_FATED_ANSWERS,
  BIRTHDAY_ROUTE,
  BIRTHDAY_CAR_TRAVEL_MS,
  BIRTHDAY_CHAPTER_INTRO_MS,
  BIRTHDAY_CHAPTER_RAIL_SETTLE_MS,
  BIRTHDAY_CAR_RESELECT_MS,
  BIRTHDAY_PARKING_APPROACH_MS,
  BIRTHDAY_PARKING_REVERSE_MS,
  BIRTHDAY_PARKING_SETTLE_MS,
  BIRTHDAY_PARKING_STRAIGHTEN_MS,
  BIRTHDAY_ROCKET_TRAVEL_MS,
  BIRTHDAY_ROUTE_PREVIEW_MS,
  BIRTHDAY_HOVER_DWELL_MS,
  BIRTHDAY_RAGEBAIT_HOLD_MS,
  birthdayVehiclePose,
  birthdayRouteProgress,
  clearBirthdayVoyageCheckpoint,
  eliminateBirthdayCar,
  isBirthdayHonoree,
  isBirthdayVoyageLocalhost,
  normalizeBirthdayName,
  ragebaitAnimal,
  ragebaitCity,
  ragebaitDrink,
  resolveBirthdayVoyageAccess
} from "../public/birthday-voyage.mjs";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test("birthday name matching ignores accents, punctuation, case, and spacing", () => {
  assert.equal(normalizeBirthdayName("  Án-na   María! "), "an na maria");
  assert.equal(isBirthdayHonoree("ÁNNA MARÍA", ["Anna Maria"]), true);
  assert.equal(isBirthdayHonoree("Guest", ["Anna Maria"]), false);
  assert.equal(isBirthdayHonoree("YOUR_GIRLFRIEND_NAME"), false);
});

test("birthday personalization config ships safe, explicit fallbacks", () => {
  assert.ok(Array.isArray(BIRTHDAY_HONOREE_NAMES));
  assert.equal(BIRTHDAY_HONOREE_NAMES.some((name) => (
    /^(?:admin|your girlfriend name|your_girlfriend_name)$/i.test(String(name).trim())
  )), false);
  assert.equal(typeof BIRTHDAY_HONOREE_DISPLAY_NAME, "string");
  assert.equal(typeof BIRTHDAY_GIVER_NAME, "string");
  assert.match(BIRTHDAY_FINAL_MESSAGE, /\S/);
  assert.equal(BIRTHDAY_HONOREE_DISPLAY_NAME, "Sophia");
  assert.equal(BIRTHDAY_GIVER_NAME, "Yane");
  assert.equal(BIRTHDAY_INTERFACE_PAIR, "Sophia + Yane");
  assert.equal(BIRTHDAY_FINALE_SIGNATURE, "София ✦ Яне");
  assert.equal(BIRTHDAY_VOYAGE_VERSION, 2);
  assert.equal(BIRTHDAY_VOYAGE_CONFIG.recipient.aliases, BIRTHDAY_HONOREE_NAMES);
  assert.match(BIRTHDAY_FINAL_MESSAGE, /^Happy birthday, Sophia[.]/);
  assert.match(BIRTHDAY_FINAL_MESSAGE, /— Yane$/);
});

test("every approved Sophia alias unlocks, case-insensitively, while placeholders do not", () => {
  for (const alias of ["Sophia", "София", "Sofi", "Салфетка", "Коте", "Слънце"]) {
    assert.equal(isBirthdayHonoree(alias.toLocaleUpperCase(), BIRTHDAY_HONOREE_NAMES), true, alias);
  }
  for (const unrelated of ["guest", "me", "admin", "", "your girlfriend name"]) {
    assert.equal(isBirthdayHonoree(unrelated, BIRTHDAY_HONOREE_NAMES), false, unrelated);
  }
});

test("the special query bypass is constrained to localhost", () => {
  assert.equal(isBirthdayVoyageLocalhost({ href: "http://localhost:4173/play/?birthday=special" }), true);
  assert.equal(isBirthdayVoyageLocalhost({ href: "http://127.0.0.1:4173/play/?birthday=special" }), true);
  assert.equal(isBirthdayVoyageLocalhost({ href: "http://[::1]:4173/play/?birthday=special" }), true);
  assert.equal(isBirthdayVoyageLocalhost({ href: "https://gift.example/play/?birthday=special" }), false);
  assert.deepEqual(
    resolveBirthdayVoyageAccess("Guest", {
      locationRef: { href: "https://gift.example/play/?birthday=replay" }
    }),
    { mode: "replay", special: false, forceReplay: true, localSpecial: false }
  );
  assert.equal(resolveBirthdayVoyageAccess("SOFI", {
    locationRef: { href: "https://gift.example/play/?birthday=replay" }
  }).special, true);
  assert.equal(resolveBirthdayVoyageAccess("admin", {
    locationRef: { href: "https://gift.example/play/?birthday=special" }
  }).special, false);
  assert.equal(resolveBirthdayVoyageAccess("admin", {
    locationRef: { href: "http://localhost:4173/play/?birthday=special" }
  }).special, true);
});

test("checkpoint clearing is storage-safe", () => {
  const storage = memoryStorage();
  storage.setItem("unrelated", "keep");
  assert.equal(clearBirthdayVoyageCheckpoint(storage), true);
  assert.equal(storage.getItem("unrelated"), "keep");
});

test("animal ragebait changes only Lion and approves every other animal", () => {
  assert.notEqual(ragebaitAnimal("Lion", () => 0), "Lion");
  assert.notEqual(ragebaitAnimal("Líôn!", () => 0), "Líôn!");
  assert.equal(ragebaitAnimal("Capybara", () => 0), "Capybara");
  assert.equal(ragebaitAnimal("Red panda", () => .75), "Red panda");
});

test("every city except Sofia deterministically becomes Sofia", () => {
  for (const city of BIRTHDAY_CITY_OPTIONS) {
    const result = ragebaitCity(city.id, () => .75);
    assert.equal(result.city.id, "sofia");
    assert.equal(result.sabotaged, city.id !== "sofia");
  }
});

test("car eliminations finish with one survivor and disguise Toyota as a sedan", () => {
  let eliminatedIds = [];
  for (const id of ["rav4", "mini", "porsche", "fiat"]) {
    const result = eliminateBirthdayCar(eliminatedIds, id);
    eliminatedIds = [...result.eliminatedIds];
  }
  const volvoResult = eliminateBirthdayCar(eliminatedIds, "volvo");
  assert.equal(eliminatedIds.length, 4);
  assert.equal(volvoResult.complete, true);
  assert.equal(volvoResult.morphed, false);
  assert.equal(volvoResult.survivor.id, "volvo");

  eliminatedIds = [];
  for (const id of ["mini", "porsche", "fiat", "volvo"]) {
    const result = eliminateBirthdayCar(eliminatedIds, id);
    eliminatedIds = [...result.eliminatedIds];
  }
  const toyotaResult = eliminateBirthdayCar(eliminatedIds, "mini");
  assert.equal(toyotaResult.complete, true);
  assert.equal(toyotaResult.morphed, true);
  assert.deepEqual(toyotaResult.survivor, {
    id: "sedan",
    label: "Sedan"
  });
  assert.deepEqual(toyotaResult.remainingIds, ["rav4"]);
  assert.equal(new Set(toyotaResult.eliminatedIds).size, 4);
  assert.equal(BIRTHDAY_CAR_OPTIONS.length, 5);
});

test("the fate reveal restores the established favorites", () => {
  assert.deepEqual(BIRTHDAY_FATED_ANSWERS, {
    car: "Toyota RAV4",
    animal: "Lion",
    city: "Vienna",
    drink: "Water"
  });
});

test("water is affectionately saved as melted ice", () => {
  assert.deepEqual(ragebaitDrink("water"), {
    sabotaged: true,
    id: "melted-ice",
    label: "Melted ice"
  });
  assert.deepEqual(ragebaitDrink("tea"), {
    sabotaged: false,
    id: "tea",
    label: "Tea"
  });
});

test("route progress advances monotonically and every chapter plays for five seconds", () => {
  const progress = birthdayRouteProgress(BIRTHDAY_ROUTE);
  assert.equal(BIRTHDAY_ROUTE.length, 11);
  assert.deepEqual(BIRTHDAY_ROUTE.slice(0, 2).map(({ id }) => id), ["varna", "vienna"]);
  assert.equal(BIRTHDAY_ROUTE[0].label, "Varna");
  assert.match(BIRTHDAY_ROUTE[0].image, /14-varna-buildings[.]webp$/);
  assert.deepEqual(BIRTHDAY_ROUTE.slice(-2).map(({ id }) => id), ["kepler", "cosmos"]);
  assert.equal(new Set(BIRTHDAY_ROUTE.map(({ id }) => id)).size, BIRTHDAY_ROUTE.length);
  assert.match(BIRTHDAY_ROUTE.at(-1).image, /12-our-cosmos-together[.]webp$/);
  assert.equal(progress.length, BIRTHDAY_ROUTE.length);
  assert.equal(progress[0], 0);
  assert.equal(progress.at(-1), 1);
  for (let index = 1; index < progress.length; index += 1) {
    assert.ok(progress[index] > progress[index - 1]);
  }
  for (const destination of BIRTHDAY_ROUTE) {
    for (const key of [
      "thumb",
      "poster",
      "videoSources",
      "alt",
      "durationMs",
      "story",
      "scenePreset",
      "soundPreset"
    ]) {
      assert.ok(Object.hasOwn(destination, key), `${destination.id} is missing ${key}`);
    }
    assert.ok(Array.isArray(destination.videoSources));
    assert.equal(destination.durationMs, BIRTHDAY_ROUTE_PREVIEW_MS);
    assert.ok(Number.isFinite(destination.mobileX));
    assert.ok(Number.isFinite(destination.mobileY));
  }
  assert.equal(BIRTHDAY_ROUTE_PREVIEW_MS, 5_000);
});

test("vehicle pose stays upright and mirrors on leftward legs", () => {
  assert.deepEqual(birthdayVehiclePose(158), { angle: -10, facing: "left", scaleX: -1 });
  assert.deepEqual(birthdayVehiclePose(-145, { rocket: true }), { angle: 25, facing: "left", scaleX: -1 });
  assert.deepEqual(birthdayVehiclePose(8), { angle: 8, facing: "right", scaleX: 1 });
  for (let angle = -360; angle <= 360; angle += 7) {
    assert.ok(Math.abs(birthdayVehiclePose(angle).angle) <= 10);
    assert.ok(Math.abs(birthdayVehiclePose(angle, { rocket: true }).angle) <= 25);
  }
});

test("chapter and questionnaire timing keeps each transition deliberate but responsive", () => {
  assert.equal(BIRTHDAY_CHAPTER_INTRO_MS, 2_200);
  assert.equal(BIRTHDAY_CHAPTER_RAIL_SETTLE_MS, 1_050);
  assert.equal(BIRTHDAY_CAR_RESELECT_MS, 360);
  assert.equal(BIRTHDAY_HOVER_DWELL_MS, 320);
  assert.equal(BIRTHDAY_RAGEBAIT_HOLD_MS, 1_400);
});

test("the road car travels more deliberately than the rocket", () => {
  assert.ok(BIRTHDAY_CAR_TRAVEL_MS > BIRTHDAY_ROCKET_TRAVEL_MS);
  assert.equal(BIRTHDAY_ROCKET_TRAVEL_MS, 1_300);
  assert.ok([
    BIRTHDAY_PARKING_APPROACH_MS,
    BIRTHDAY_PARKING_REVERSE_MS,
    BIRTHDAY_PARKING_STRAIGHTEN_MS,
    BIRTHDAY_PARKING_SETTLE_MS
  ].every((duration) => Number.isFinite(duration) && duration > 0));
});

test("every destination image exists as WebP and birthday media uses a lazy cache", async () => {
  const worker = await readFile(new URL("../public/service-worker.js", import.meta.url), "utf8");
  for (const destination of BIRTHDAY_ROUTE) {
    assert.match(destination.image, /[.]webp$/);
    const publicPath = destination.image.replace(/^[.]\//, "");
    const asset = await readFile(new URL(`../public/${publicPath}`, import.meta.url));
    assert.ok(asset.length > 0, `${destination.label} image is empty`);
    assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP");
    for (const mediaPath of [destination.thumb, destination.poster]) {
      assert.match(mediaPath, /[.]webp$/);
      const media = await readFile(new URL(
        `../public/${mediaPath.replace(/^[.]\//, "")}`,
        import.meta.url
      ));
      assert.equal(media.subarray(0, 4).toString("ascii"), "RIFF");
      assert.equal(media.subarray(8, 12).toString("ascii"), "WEBP");
    }
  }
  const spacecraftPath = "art/birthday-voyage/13-rav4-spaceship-right-transparent.webp";
  const spacecraft = await readFile(new URL(`../public/${spacecraftPath}`, import.meta.url));
  assert.equal(spacecraft.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(spacecraft.subarray(8, 12).toString("ascii"), "WEBP");
  assert.match(worker, /const BIRTHDAY_CACHE_PREFIX/);
  assert.match(worker, /const BIRTHDAY_CACHE/);
  assert.match(worker, /const BIRTHDAY_PREFIXES/);
  assert.match(worker, /function isBirthdayRequestUrl/);
  assert.match(worker, /CONSTELLORE_CACHE_BIRTHDAY_MEDIA/);
  assert.match(worker, /async function serveCachedRange/);
  assert.match(worker, /status: 206/);
});

test("route previews use a fixed five-second playback window after their opening beat", () => {
  assert.equal(BIRTHDAY_ROUTE_PREVIEW_MS, 5_000);
  assert.equal(BIRTHDAY_CHAPTER_INTRO_MS, 2_200);
  assert.ok(BIRTHDAY_CHAPTER_INTRO_MS >= BIRTHDAY_ROUTE_PREVIEW_MS * .4);
  assert.ok(BIRTHDAY_CHAPTER_INTRO_MS <= BIRTHDAY_ROUTE_PREVIEW_MS * .5);
});

test("the lion opener ships release-quality H.264 video with an AAC sound stream", async () => {
  const asset = await readFile(new URL(
    "../public/cinematic/lion-intro-birthday.mp4",
    import.meta.url
  ));
  // The 960px source is intentionally retained for a crisp full-screen opener;
  // keep it beneath the lazy birthday-pack budget without crushing it to 640px.
  assert.ok(asset.length > 2_000_000);
  assert.ok(asset.length < 4_000_000);
  assert.ok(asset.includes(Buffer.from("avc1")));
  assert.ok(asset.includes(Buffer.from("mp4a")));
});

test("birthday replay is explicitly requested and ordinary entry does not load it", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const startup = app.slice(app.indexOf("const startupParams"), app.indexOf("const ctrlHover"));
  assert.match(startup, /new Set\(\["special", "replay", "guest"\]\)/);
  assert.match(startup, /if \(startupBirthdayForceReplay\) handoffBirthdayVoyage\(\)/);
  assert.equal((startup.match(/handoffBirthdayVoyage\(\)/g) || []).length, 1);
  assert.doesNotMatch(startup, /playStartupVoyageProjection|playLegacyLaunchCinematic/);
});
