import assert from "node:assert/strict";
import test from "node:test";

import {
  PLANET_HUB_DESTINATION_COORDINATES,
  PLANET_HUB_ROAD_RADIUS,
  PLANET_HUB_SPACE_LAYER_IDS,
  anchorAtCoordinates,
  anchorAtPhase,
  assertDestinationAnchorSpacing,
  capPlanetHubPixelRatio,
  createDestinationAnchors,
  createGreatCircleRoads,
  cross3,
  destinationFacingQuaternion,
  destinationQuaternion,
  dot3,
  nextPlanetHubDestination,
  normalize3,
  resolvePlanetHubGesture,
  selectPlanetHubQuality,
  validatePlanetHubManifest
} from "../public/planet-hub-domain.mjs";

function manifestFixture() {
  const tier = (world, quality) => ({
    planet: { url: `${world}-${quality}.glb`, bytes: 1, triangles: 10 },
    landmarks: Object.fromEntries(["forge", "journey", "arena"].map((destination) => [
      destination,
      { url: `${world}-${destination}-${quality}.glb`, bytes: 1, triangles: 10, extraProductionMetadata: true }
    ]))
  });
  return {
    schemaVersion: 1,
    worlds: Object.fromEntries(["earth", "moon"].map((world) => [world, {
      posters: Object.fromEntries(["forge", "journey", "arena"].map((destination) => [destination, `${world}-${destination}.webp`])),
      tiers: { low: tier(world, "low"), standard: tier(world, "standard") },
      attribution: { license: "CC BY 4.0" }
    }])),
    portal: {
      mp4: "portal.mp4",
      webm: "portal.webm",
      poster: "portal.webp",
      width: 1024,
      height: 512,
      frameCount: 200,
      durationSeconds: 6.667
    }
  };
}

test("Earth destination anchors use documented geographic continental sites and calibrated texture axes", () => {
  const anchors = createDestinationAnchors({ worldId: "earth" });
  assert.deepEqual(
    Object.fromEntries(Object.entries(anchors).map(([destination, anchor]) => [destination, {
      region: anchor.region,
      latitudeDegrees: anchor.latitudeDegrees,
      longitudeDegrees: anchor.longitudeDegrees
    }])),
    PLANET_HUB_DESTINATION_COORDINATES
  );
  assert.deepEqual(anchors.forge.normal, anchorAtCoordinates(50, 10).normal);
  assert.deepEqual(anchors.journey.normal, anchorAtCoordinates(-80, 0).normal);
  assert.deepEqual(anchors.arena.normal, anchorAtCoordinates(40, -100).normal);
  assert.deepEqual(anchorAtCoordinates(0, 0).normal, [-1, 0, 0], "prime meridian is -X on the verified runtime sphere");
  assert.deepEqual(anchorAtCoordinates(0, 90).normal, [0, 0, 1], "90E is +Z on the verified runtime sphere");
  assert.ok(anchors.forge.normal[1] > 0.7, "Forge sits in northern Europe");
  assert.ok(anchors.journey.normal[1] < -0.98, "Journey sits deep inside Antarctica");
  assert.ok(anchors.arena.normal[2] < -0.7, "Arena sits in western North America");
  assert.equal(assertDestinationAnchorSpacing(anchors), true);
  for (const anchor of Object.values(anchors)) {
    assert.ok(Math.abs(Math.hypot(...anchor.normal) - 1) < 1e-12);
    assert.ok(Math.abs(dot3(anchor.normal, anchor.tangent)) < 1e-12);
    assert.ok(Math.abs(dot3(anchor.normal, anchor.outward)) < 1e-12);
    const authoredFront = cross3(anchor.tangent, anchor.normal);
    const latitude = anchor.latitudeDegrees * Math.PI / 180;
    const longitude = anchor.longitudeDegrees * Math.PI / 180;
    const geographicNorth = normalize3([
      Math.sin(latitude) * Math.cos(longitude),
      Math.cos(latitude),
      -Math.sin(latitude) * Math.sin(longitude)
    ]);
    assert.ok(authoredFront.every((value, index) => Math.abs(value - geographicNorth[index]) < 1e-12),
      "orientSite maps authored local +Z to geographic north");
  }
});

test("Moon destination anchors preserve the authored 0/120/240 ring", () => {
  const anchors = createDestinationAnchors({ worldId: "moon" });
  for (const [destination, phaseDegrees] of Object.entries({ forge: 0, journey: 120, arena: 240 })) {
    assert.equal(anchors[destination].worldId, "moon");
    assert.equal(anchors[destination].layout, "authored-ring");
    assert.equal(anchors[destination].phaseDegrees, phaseDegrees);
    assert.deepEqual(anchors[destination].normal, anchorAtPhase(phaseDegrees).normal);
  }
  assert.equal(assertDestinationAnchorSpacing(anchors), true);
  assert.ok(Math.abs(dot3(anchors.forge.normal, anchors.journey.normal) + 0.5) < 1e-12);
});

test("planet roads follow each world's anchors without z-fighting", () => {
  for (const worldId of ["earth", "moon"]) {
    const anchors = createDestinationAnchors({ worldId });
    const roads = createGreatCircleRoads({ worldId, pointsPerSegment: 9 });
    assert.equal(roads.length, 3);
    assert.deepEqual(roads.map(({ from, to }) => `${from}:${to}`), ["forge:journey", "journey:arena", "arena:forge"]);
    for (let index = 0; index < roads.length; index += 1) {
      const road = roads[index];
      const next = roads[(index + 1) % roads.length];
      assert.ok(road.points[0].every((value, axis) => (
        Math.abs(value - anchors[road.from].normal[axis] * PLANET_HUB_ROAD_RADIUS) < 1e-12
      )), `${worldId} ${road.from}:${road.to} begins at its source anchor`);
      assert.deepEqual(road.points.at(-1), next.points[0]);
      const planeNormal = cross3(anchors[road.from].normal, anchors[road.to].normal);
      for (const point of road.points) {
        assert.ok(Math.abs(Math.hypot(...point) - PLANET_HUB_ROAD_RADIUS) < 1e-10);
        assert.ok(Math.abs(dot3(point, planeNormal)) < 1e-10,
          `${worldId} ${road.from}:${road.to} follows its shortest great circle`);
      }
    }
  }
});

test("destination quaternions are normalized and differ by one exact site", () => {
  const quaternions = ["forge", "journey", "arena"].map((destination) => destinationQuaternion(destination));
  for (const quaternion of quaternions) assert.ok(Math.abs(Math.hypot(...quaternion) - 1) < 1e-12);
  assert.notDeepEqual(quaternions[0], quaternions[1]);
  assert.deepEqual(anchorAtPhase(360).normal, anchorAtPhase(0).normal);
});

test("focused destination quaternions align every landmark normal and authored front", () => {
  const anchors = createDestinationAnchors();
  const targetNormal = [0, 0.6, 0.8];
  const targetFront = [0, -0.8, 0.6];
  const rotate = (vector, quaternion) => {
    const [x, y, z] = vector;
    const [qx, qy, qz, qw] = quaternion;
    const tx = 2 * (qy * z - qz * y);
    const ty = 2 * (qz * x - qx * z);
    const tz = 2 * (qx * y - qy * x);
    return [
      x + qw * tx + qy * tz - qz * ty,
      y + qw * ty + qz * tx - qx * tz,
      z + qw * tz + qx * ty - qy * tx
    ];
  };
  for (const destination of ["forge", "journey", "arena"]) {
    const quaternion = destinationFacingQuaternion(destination, anchors, targetNormal, targetFront);
    const normal = rotate(anchors[destination].normal, quaternion);
    const front = rotate(anchors[destination].outward.map((value) => -value), quaternion);
    assert.ok(normal.every((value, index) => Math.abs(value - targetNormal[index]) < 1e-9));
    assert.ok(front.every((value, index) => Math.abs(value - targetFront[index]) < 1e-9));
  }
});

test("quality selection is deterministic and applies tier-specific DPR caps", () => {
  assert.equal(selectPlanetHubQuality({ webgl2: false }), "static");
  assert.equal(selectPlanetHubQuality({ saveData: true }), "static");
  assert.equal(selectPlanetHubQuality({ contextLosses: 2 }), "static");
  assert.equal(selectPlanetHubQuality({ width: 390, height: 844, coarsePointer: true }), "low");
  assert.equal(selectPlanetHubQuality({ width: 768, height: 1024 }), "low");
  assert.equal(selectPlanetHubQuality({ width: 1440, height: 900, deviceMemory: 4 }), "low");
  assert.equal(selectPlanetHubQuality({ width: 1440, height: 900 }), "standard", "a capable desktop viewport must not be penalized when privacy APIs omit hardware hints");
  assert.equal(selectPlanetHubQuality({ width: 1440, height: 900, deviceMemory: 8, hardwareConcurrency: 8 }), "standard");
  assert.equal(selectPlanetHubQuality({ width: 1440, height: 900, deviceMemory: 8, hardwareConcurrency: 8, qualityOverride: "low" }), "low");
  assert.equal(selectPlanetHubQuality({ width: 1440, height: 900, deviceMemory: 8, hardwareConcurrency: 8, qualityOverride: "static" }), "static");
  assert.equal(selectPlanetHubQuality({ webgl2: false, qualityOverride: "low" }), "static", "a URL override cannot bypass a hard WebGL failure");
  assert.equal(capPlanetHubPixelRatio(3, "low"), 1.25);
  assert.equal(capPlanetHubPixelRatio(3, "standard"), 1.75);
});

test("gesture resolution accepts only quick intentional horizontal movement", () => {
  assert.deepEqual(resolvePlanetHubGesture({ startX: 200, startY: 100, endX: 110, endY: 105, durationMs: 300 }).direction, 1);
  assert.equal(resolvePlanetHubGesture({ startX: 100, startY: 100, endX: 170, endY: 102, durationMs: 300 }).direction, -1);
  assert.equal(resolvePlanetHubGesture({ startX: 100, startY: 100, endX: 130, endY: 102, durationMs: 100 }).accepted, false);
  assert.equal(resolvePlanetHubGesture({ startX: 100, startY: 100, endX: 180, endY: 180, durationMs: 100 }).accepted, false);
  assert.equal(resolvePlanetHubGesture({ startX: 100, startY: 100, endX: 180, endY: 101, durationMs: 900 }).accepted, false);
  assert.equal(nextPlanetHubDestination("forge", -1, ["forge", "arena"]), "arena");
});

test("manifest validation requires both runtime tiers, six posters, and packed portal metadata", () => {
  const valid = manifestFixture();
  assert.equal(validatePlanetHubManifest(valid).valid, true);
  valid.worlds.earth.tiers.low.landmarks.forge = "earth-forge-low.glb";
  assert.equal(validatePlanetHubManifest(valid).valid, true, "string shorthand remains valid");

  const invalid = structuredClone(valid);
  delete invalid.worlds.moon.posters.arena;
  invalid.portal.width = 512;
  invalid.worlds.earth.tiers.standard.planet.triangles = 90_001;
  invalid.worlds.moon.tiers.low.landmarks.journey.triangles = 10_001;
  const result = validatePlanetHubManifest(invalid, { throwOnError: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("worlds.moon.posters.arena")));
  assert.ok(result.errors.some((error) => error.includes("1024x512")));
  assert.ok(result.errors.some((error) => error.includes("90000 triangles")));
  assert.ok(result.errors.some((error) => error.includes("10000 triangles")));
  assert.throws(() => validatePlanetHubManifest(invalid), /Invalid planet hub manifest/);
});

test("manifest validates an optional progressive five-distance sky contract", () => {
  const valid = manifestFixture();
  valid.spaceLayers = {
    schemaVersion: 1,
    initialScene: false,
    loadPolicy: "progressive-after-ready",
    tiers: Object.fromEntries(["low", "standard"].map((quality) => [quality, {
      layers: PLANET_HUB_SPACE_LAYER_IDS.map((id) => ({
        id,
        url: `./art/planet-hub/space-layers/${id}-${quality}.webp`,
        bytes: 1,
        width: quality === "low" ? 1024 : 2048,
        height: quality === "low" ? 512 : 1024
      }))
    }]))
  };
  assert.equal(validatePlanetHubManifest(valid).valid, true);

  const invalid = structuredClone(valid);
  invalid.spaceLayers.initialScene = true;
  invalid.spaceLayers.tiers.standard.layers[1].id = "duplicate-sky";
  invalid.spaceLayers.tiers.low.layers[0].width = 2048;
  const result = validatePlanetHubManifest(invalid, { throwOnError: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("initialScene")));
  assert.ok(result.errors.some((error) => error.includes("deep-stars")));
  assert.ok(result.errors.some((error) => error.includes("invalid dimensions")));
});
